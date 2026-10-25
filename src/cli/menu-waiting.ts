// The menu's "What waits for you": everything that waits for the person (core/waiting.ts — the same items, kinds,
// places, order and counts the Strom app gets), by the place where it is dealt with: one archive's site, one e-mail to
// an office, one message to the family. What is to do apart from what waits for a reply from outside (sent).
//
//   the overview  the places of what is to do, a page of 15 at a time (next, previous, a range, all), filtered by
//                 section, "?" for what waits for a reply; a number opens a place — a place of one thing that thing
//   a place       its things, then for all of them at once: the request texts joined, sent, a conversation
//   a thing       what it is and waits for, then only what makes sense for its kind: the archive or the site, the
//                 folder for images saved by hand, the request's text, sent (or back among what is to do), an answer
//                 in words or a file, a conversation; a decision (an archive, a story, the app's send, the reading of
//                 scans, a site to check) its own screen
//
// The answer is kept with the task, nothing more: the agent takes it up in its next work (strom task wake --answer).
// An archive: only what an archive has — no agent, no conversation.

import path from "node:path";
import type { Context } from "./context.ts";
import { agentReady, claudeHere, guarded, outOfAnswers, pause, translator, type Run } from "./menu-parts.ts";
import { decideSent } from "./menu-research.ts";
import { decideArchive, decideMilder, decideTakeover } from "./menu-archives.ts";
import { askWhy, pickClaim, waitingDo } from "./menu-links.ts";
import { truncate } from "./format.ts";
import { ui, type UIKey } from "./ui.ts";
import { Tree } from "../core/tree.ts";
import type { Conflict, Family, Person, RecordSet, Task } from "../core/model.ts";
import { humanDay, humanTask } from "./human.ts";
import { conflictTitle, displayName, lifespan } from "../core/people.ts";
import { claimOf, isEditConflict, sideText } from "../core/conflicts.ts";
import { openForUser } from "../core/open.ts";
import { isArchive } from "../core/mode.ts";
import type { Question } from "../core/tuneask.ts";
import { listConnectors } from "../core/connector.ts";
import { requestFile, requestTexts, waitingFor, type Waiting, type WaitSection } from "../core/waiting.ts";
import { SENDABLE, type WaitKind, type WaitPhase } from "../core/waitkind.ts";

/** A person for the person reading: "Jan Novák (*1905) [P0001]". */
const label = (p: Person) => `${displayName(p)}${lifespan(p) ? ` (${lifespan(p)})` : ""} [${p.id}]`;

/** An answer is a note on the task (500 characters, with what it asked). */
const ANSWER_MAX = 300;
/** The places on one page of the overview. */
const PAGE = 15;
/** A request sent this many days ago with no reply yet: marked. */
const NO_REPLY_DAYS = 30;
/** The sections, in the order of the app's chips. */
const SECTIONS: readonly WaitSection[] = ["decide", "images", "letter", "family", "web", "other"];
/** The kinds a word is said for (anything else: "other"). */
const KINDS = ["images", "letter", "family", "web", "check", "permission", "takeover", "milder", "story", "send", "tune", "conflict", "other"] as const;

type T = ReturnType<typeof translator>;

/** Everything that waits for the person here, in the order of What waits: the app's items and the terminal's own. */
export function waitingHere(ctx: Context, tree: Tree): Waiting[] {
  return waitingFor(tree, {
    shared: ctx.settings.shared()?.value,
    claude: () => claudeHere(ctx, tree.config),
    sends: true,
    milder: true,
    // the open conflicts the person decides: every one in an archive, their own edits' in research
    conflicts: true,
    // the questions about the reading of scans: an archive asks none
    ...(isArchive(tree) ? {} : { tune: ctx.settings }),
  });
}

/** The keys of the overview in the person's language: next, previous, all, and a letter per section. */
export function waitKeys(lang: string): { next: string; prev: string; all: string; section: Record<WaitSection, string> } {
  const t = translator(lang);
  const low = (s: string) => s.toLocaleLowerCase(lang);
  return {
    next: low(t("ui.wait.key.next")),
    prev: low(t("ui.wait.key.prev")),
    all: low(t("ui.wait.key.all")),
    section: Object.fromEntries(SECTIONS.map((s) => [s, low(t(`ui.wait.key.${s}` as UIKey))])) as Record<WaitSection, string>,
  };
}

/** A kind of what waits in the person's words. */
function kindWord(t: T, kind: string): string {
  return t(`ui.wait.kind.${(KINDS as readonly string[]).includes(kind) ? kind : "other"}` as UIKey);
}

/** How long ago, in days: "today", "1 day ago", "8 days ago". */
function ago(t: T, iso: string, now = Date.now()): string {
  const days = daysSince(iso, now);
  return days === 0 ? t("ui.wait.ago.today") : days === 1 ? t("ui.wait.ago.one") : t("ui.wait.ago", { n: days });
}

function daysSince(iso: string, now = Date.now()): number {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? 0 : Math.max(0, Math.floor((now - at) / 86_400_000));
}

/** Sent when, how long ago, and the mark of a request with no reply for long. */
function sentWords(t: T, lang: string, iso: string): string {
  return `${t("ui.wait.sentline", { day: humanDay(iso, lang), ago: ago(t, iso) })}${daysSince(iso) > NO_REPLY_DAYS ? ` · ${t("ui.wait.noreply", { days: NO_REPLY_DAYS })}` : ""}`;
}

/** What a thing is, short: a task's words as written, its records named (a person's ID after their name only bracketed). */
function short(tree: Tree, lang: string, w: Waiting): string {
  return w.task ? humanTask(tree, w.item.what, lang, { asWritten: true }) : w.item.what;
}

const sentAtOf = (w: Waiting) => String(w.item.sentAt ?? w.item.at);

interface Place {
  key: string;
  name: string;
  items: Waiting[];
}

/** The places of a list, in its order (the items of one place stand together). */
function placesOf(items: Waiting[]): Place[] {
  const by = new Map<string, Place>();
  for (const w of items) {
    let p = by.get(w.item.group.key);
    if (!p) by.set(w.item.group.key, (p = { key: w.item.group.key, name: w.item.group.name, items: [] }));
    p.items.push(w);
  }
  return [...by.values()];
}

/** A place's line on the overview: the thing itself when it is one, else what is there by kind. */
function placeDetail(t: T, lang: string, tree: Tree, p: Place, phase: WaitPhase): string {
  const one = p.items.length === 1 ? truncate(short(tree, lang, p.items[0]!), 60) : undefined;
  if (phase === "sent") {
    const oldest = p.items.map(sentAtOf).sort()[0]!;
    return `${one ? `${one} · ` : ""}${sentWords(t, lang, oldest)}`;
  }
  if (one) return one;
  const kinds = [...new Set(p.items.map((w) => w.item.kind as string))];
  // the letters to one office, the questions to the family: one message
  if (kinds.length === 1 && kinds[0] === "letter") return t("ui.wait.letter.todo");
  if (kinds.length === 1 && kinds[0] === "family") return t("ui.wait.family.todo");
  return kinds.map((k) => `${kindWord(t, k)} ${p.items.filter((w) => w.item.kind === k).length}`).join(" · ");
}

/** Whether a conversation with the agent can be offered: never in an archive, nor without an agent here. */
function canChat(ctx: Context, tree: Tree): boolean {
  return !isArchive(tree) && agentReady(ctx, tree.config);
}

/** The menu's What waits: the overview (see the top of this file). */
export async function waitingForYou(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const keys = waitKeys(lang);
  let phase: WaitPhase = "todo";
  let filter: WaitSection | undefined;
  let page = 0;
  let view: { from: number; to: number } | "all" | undefined;
  for (;;) {
    if (outOfAnswers(ctx)) return;
    const tree = Tree.open(root, ctx.env);
    const all = waitingHere(ctx, tree);
    if (!all.length) return void out(t("ui.waiting.none"));
    const todo = all.filter((w) => w.item.phase === "todo");
    const sent = all.filter((w) => w.item.phase === "sent");
    if (phase === "sent" && !sent.length) phase = "todo";
    const here = phase === "todo" ? todo : sent;
    const counts = new Map<WaitSection, number>();
    for (const w of here) counts.set(w.item.section, (counts.get(w.item.section) ?? 0) + 1);
    if (filter && !counts.get(filter)) filter = undefined;
    const places = placesOf(filter ? here.filter((w) => w.item.section === filter) : here);
    const pages = Math.max(1, Math.ceil(places.length / PAGE));
    page = Math.min(page, pages - 1);
    const [from, to] = view === "all" ? [0, places.length] : view ? [view.from, Math.min(view.to, places.length)] : [page * PAGE, Math.min(places.length, (page + 1) * PAGE)];
    const present = SECTIONS.filter((s) => counts.get(s));
    const sectionName = (s: WaitSection) => t(`ui.wait.sec.${s}` as UIKey);

    // the heading: how many to do and how many wait for a reply (the app's numbers), the sections with their letters
    const head =
      phase === "todo"
        ? [t("ui.menu.waitlist"), t("ui.wait.todo.n", { n: todo.length }), ...(sent.length ? [t("ui.wait.sent.n", { n: sent.length })] : [])]
        : [t("ui.wait.sent.title"), String(sent.length), ...(todo.length ? [t("ui.wait.todo.n", { n: todo.length })] : [])];
    if (filter) head.push(t("ui.wait.filter", { section: sectionName(filter) }));
    const screen = ["", head.join(" · ")];
    if (present.length) screen.push(`  ${present.map((s) => `${keys.section[s]} ${sectionName(s)} ${counts.get(s)}`).join(" · ")}`);
    if (!here.length) screen.push(` ${t("ui.wait.none.todo")}`);
    const shown = places.slice(from, to);
    const names = shown.map((p) => `${truncate(p.name, 34)} · ${p.items.length}`);
    const width = Math.max(0, ...names.map((n) => [...n].length));
    for (const [k, p] of shown.entries()) {
      const name = names[k]!;
      screen.push(`${String(from + k + 1).padStart(2)}  ${name}${" ".repeat(width - [...name].length)}   ${placeDetail(t, lang, tree, p, phase)}`);
    }
    // what can be typed here, only what does something now
    const controls: string[] = [];
    if (places.length > PAGE) {
      controls.push(view === undefined ? t("ui.wait.c.page", { page: page + 1, pages }) : t("ui.wait.c.shown", { from: from + 1, to, n: places.length }));
    }
    if (places.length) controls.push(t("ui.wait.c.number"));
    if (places.length > PAGE) controls.push(t("ui.wait.c.next", { key: keys.next }), t("ui.wait.c.prev", { key: keys.prev }), "10-20", t("ui.wait.c.all", { key: keys.all }));
    if (present.length > 1 || filter) controls.push(t("ui.wait.c.filter", { keys: present.map((s) => keys.section[s]).join("/") }));
    if (phase === "todo" && sent.length) controls.push(t("ui.wait.c.sent"));
    if (phase === "sent" && todo.length) controls.push(t("ui.wait.c.todo"));
    controls.push(t(filter ? "ui.wait.c.unfilter" : "ui.wait.c.back"));
    const controlLine = ` ${controls.join(" · ")}`;
    screen.push(controlLine);
    out(screen.join("\n"));

    // the answer: Enter goes back; anything unknown shows what can be typed again, nothing happens
    for (;;) {
      if (outOfAnswers(ctx)) return;
      const a = (await ctx.ask(t("ui.choose"))).trim().toLocaleLowerCase(lang);
      if (a === "") {
        if (phase === "sent") {
          phase = "todo";
          filter = undefined;
          view = undefined;
          page = 0;
          break;
        }
        return;
      }
      if (a === "0") {
        if (filter) filter = undefined;
        else if (phase === "sent") phase = "todo";
        else return;
        view = undefined;
        page = 0;
        break;
      }
      if (a === "?" && (phase === "todo" ? sent.length : todo.length)) {
        phase = phase === "todo" ? "sent" : "todo";
        filter = undefined;
        view = undefined;
        page = 0;
        break;
      }
      if ((a === keys.next || a === keys.prev) && places.length > PAGE) {
        page = view === undefined ? Math.max(0, Math.min(pages - 1, page + (a === keys.next ? 1 : -1))) : Math.floor(from / PAGE);
        view = undefined;
        break;
      }
      if (a === keys.all && places.length > PAGE) {
        view = "all";
        break;
      }
      const section = present.find((s) => keys.section[s] === a);
      if (section) {
        filter = filter === section ? undefined : section;
        view = undefined;
        page = 0;
        break;
      }
      const range = /^(\d+)\s*[-–]\s*(\d+)$/u.exec(a);
      if (range) {
        const [f, l] = [Number(range[1]), Number(range[2])];
        if (f >= 1 && f <= l && f <= places.length) {
          view = { from: f - 1, to: Math.min(l, places.length) };
          break;
        }
      }
      if (/^\d+$/u.test(a) && Number(a) >= 1 && Number(a) <= places.length) {
        const p = places[Number(a) - 1]!;
        // a place of one: that thing at once
        await guarded(ctx, lang, async () => (p.items.length === 1 ? thing(ctx, run, lang, root, p.items[0]!) : place(ctx, run, lang, root, p.key, phase, filter)));
        break;
      }
      out(controlLine);
    }
  }
}

/** One place: its things, then for all of them at once — the request texts joined, sent, a conversation. */
async function place(ctx: Context, run: Run, lang: string, root: string, key: string, phase: WaitPhase, filter: WaitSection | undefined): Promise<void> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  for (;;) {
    if (outOfAnswers(ctx)) return;
    const tree = Tree.open(root, ctx.env);
    const items = waitingHere(ctx, tree).filter((w) => w.item.group.key === key && w.item.phase === phase && (!filter || w.item.section === filter));
    if (!items.length) return;
    const name = items[0]!.item.group.name;
    const tasks = items.filter((w) => w.task).map((w) => w.task!);
    const choices: { label: string }[] = [];
    const acts: (() => Promise<unknown>)[] = [];
    for (const w of items) {
      choices.push({ label: thingLine(t, lang, tree, w) });
      acts.push(() => thing(ctx, run, lang, root, w));
    }
    if (tasks.some((x) => requestFile(tree, x))) {
      choices.push({ label: t("ui.wait.group.text") });
      acts.push(() => requestText(ctx, lang, root, tasks.map((x) => x.id)));
    }
    // sent for the whole group: a request that goes out at once — to an office, to the family, or a place with a letter
    // or a question to the family to do; never an archive's site whose only request is something else
    const group = items[0]!.item.group;
    const sends = group.kind === "office" || group.kind === "family" || items.some((w) => w.task && w.item.phase === "todo" && (w.item.kind === "letter" || w.item.kind === "family"));
    const sendable = phase === "todo" && sends ? items.filter((w) => w.task && SENDABLE.includes(w.item.kind as WaitKind)).map((w) => w.task!) : [];
    if (sendable.length) {
      choices.push({ label: t("ui.wait.group.sent") });
      acts.push(async () => {
        out("");
        out(t("ui.wait.group.sent.list", { place: name }));
        for (const x of sendable) out(`  • ${x.id} ${truncate(humanTask(tree, x.what, lang, { asWritten: true }), 70)}`);
        if (!(await ctx.confirm(t("ui.wait.group.sent.sure"), false))) return;
        const ids = sendable.map((x) => x.id);
        if ((await run(["task", "sent", ...ids], true)) !== 0) return;
        out(t("ui.wait.group.sent.done", { ids: ids.join(", ") }));
      });
    }
    if (tasks.length && canChat(ctx, tree)) {
      choices.push({ label: t("ui.wait.group.chat") });
      acts.push(() => run(["chat", "--task", tasks[0]!.id]));
    }
    ctx.io.stdout("\n");
    const i = await ctx.choose(`${name} · ${t(phase === "todo" ? "ui.wait.todo.n" : "ui.wait.sent.n", { n: items.length })}`, choices, choices.length, { back: t("ui.browse.back") });
    if (i === undefined) return;
    await guarded(ctx, lang, async () => void (await acts[i]!()));
  }
}

/** A thing's line in its place: what, its kind, its priority — since when a decision waits, when a request went out. */
function thingLine(t: T, lang: string, tree: Tree, w: Waiting): string {
  const what = `${truncate(short(tree, lang, w), 60)} · ${kindWord(t, w.item.kind)}`;
  if (w.item.phase === "sent") return `${what} · ${sentWords(t, lang, sentAtOf(w))}`;
  if (w.task) return `${what} · ${t("ui.wait.prio", { n: w.task.priority })}`;
  return `${what} · ${t("ui.wait.since", { day: humanDay(w.item.at, lang) })}`;
}

/** The request texts of tasks, joined to be copied (each file once); Enter after it. */
async function requestText(ctx: Context, lang: string, root: string, ids: string[]): Promise<void> {
  const t = translator(lang);
  const tree = Tree.open(root, ctx.env);
  const r = requestTexts(tree, ids.map((id) => tree.get<Task>(id)).filter((x): x is Task => !!x));
  if (!r.notes.length) return void ctx.io.stdout(t("ui.wait.text.none") + "\n");
  ctx.io.stdout(`\n${t("ui.wait.text.head", { files: r.notes.join(", ") })}\n\n${r.text}\n\n`);
  await pause(ctx, lang);
}

/** One thing: a decision its own screen; a task what it is and waits for, then what makes sense for its kind. */
async function thing(ctx: Context, run: Run, lang: string, root: string, w: Waiting): Promise<void> {
  if (!w.task || w.task.awaitsCheck) return decide(ctx, run, lang, root, w);
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const id = w.task.id;
  for (;;) {
    if (outOfAnswers(ctx)) return;
    const tree = Tree.open(root, ctx.env);
    // as it is now: meanwhile taken up by an agent, sent, its images saved
    const cur = waitingHere(ctx, tree).find((v) => v.task?.id === id);
    if (!cur?.task) return void out(t("ui.waiting.gone"));
    const x = cur.task;
    const it = cur.item;
    const kind = it.kind;
    const sent = it.phase === "sent";
    const inbox = it.inbox as { dir: string; have: number; want: number } | undefined;
    const url = typeof it.url === "string" ? it.url : undefined;
    const lines = ["", ` ${x.id} · ${kindWord(t, kind)} · ${t("ui.wait.prio", { n: x.priority })}`, ` ${humanTask(tree, x.what, lang, { asWritten: true })}`];
    if (x.waitingOn) lines.push(`    ${t("ui.wait.d.on", { on: x.waitingOn })}`);
    if (typeof it.to === "string" && it.to !== it.group.name) lines.push(`    ${t("ui.wait.d.to", { to: it.to })}`);
    lines.push(`    ${t("ui.wait.d.place", { place: it.group.name })}`);
    lines.push(`    ${t("ui.wait.d.since", { day: humanDay(it.at, lang) })}${sent ? ` · ${sentWords(t, lang, sentAtOf(cur))}` : ""}`);
    if (x.awaits) lines.push(...imagesToSave(ctx, lang, tree, x), "", `    ${t("ui.wait.how1")}`, `    ${t("ui.wait.how2")}`);
    out(lines.join("\n"));

    // what makes sense for its kind: true leaves (it waits no more here), else it is shown again
    const choices: { label: string; act: () => Promise<boolean> }[] = [];
    const open = (key: UIKey, target: string) =>
      choices.push({
        label: t(key),
        act: async () => {
          openForUser(target, ctx.env);
          out(t("ui.wait.url", { url: target }));
          return false;
        },
      });
    const answer = (key: UIKey = "ui.wait.a.answer", prompt: UIKey = "ui.waiting.write") => choices.push({ label: t(key), act: () => answerTask(ctx, run, lang, root, x, prompt) });
    const file = () => choices.push({ label: t("ui.wait.a.file"), act: () => waitingDo(ctx, run, lang, root, x.id, "file", "", true) });
    if (kind === "images" && !sent) {
      if (url) open("ui.wait.a.archive", url);
      if (inbox)
        choices.push({
          label: t("ui.wait.a.folder", { have: inbox.have, want: inbox.want || "?" }),
          act: async () => {
            openForUser(inbox.dir, ctx.env);
            out(t("ui.waiting.opened", { dir: ctx.display(inbox.dir) }));
            return false;
          },
        });
      answer("ui.wait.a.cannot", "ui.wait.cannot.write");
    } else if (sent) {
      answer();
      file();
      choices.push({
        label: t("ui.wait.a.unsent"),
        act: async () => {
          if ((await run(["task", "sent", x.id, "--undo"], true)) !== 0) return false;
          out(t("ui.wait.unsent.done"));
          return true;
        },
      });
    } else if (SENDABLE.includes(kind as WaitKind)) {
      if (requestFile(tree, x)) choices.push({ label: t("ui.wait.a.note"), act: async () => (await requestText(ctx, lang, root, [x.id]), false) });
      choices.push({ label: t("ui.wait.a.sent"), act: () => waitingDo(ctx, run, lang, root, x.id, "sent", "", true) });
      answer();
      file();
    } else {
      if (url) open(kind === "web" ? "ui.wait.a.web" : "ui.wait.a.link", url);
      answer();
    }
    if (canChat(ctx, tree)) choices.push({ label: t("ui.wait.a.chat"), act: () => waitingDo(ctx, run, lang, root, x.id, "chat", "", true) });
    const i = await ctx.choose("", choices, choices.length, { back: t("ui.browse.back") });
    if (i === undefined) return;
    if ((await guarded(ctx, lang, choices[i]!.act)) === true) return;
  }
}

/** A decision: its own screen — an archive's question, a story's new version, the app's send, the reading of scans, a site to check. */
async function decide(ctx: Context, run: Run, lang: string, root: string, w: Waiting): Promise<void> {
  if (w.conflict) return decideConflictHere(ctx, run, lang, root, w.conflict.id);
  if (w.send) return void (await decideSent(ctx, run, lang, root, w.send));
  if (w.tune) return decideTune(ctx, run, lang, w.tune);
  const tree = Tree.open(root, ctx.env);
  if (w.story) return void (await decideStory(ctx, run, lang, root, w.story, storyOf(tree, w.story)));
  const q = w.question;
  if (q?.kind === "permission" && q.host) return void (await decideArchive(ctx, run, lang, root, q.host, q, q.archiveHosts));
  if (q?.kind === "takeover") return decideTakeover(ctx, run, lang, q);
  if (q?.kind === "milder" && q.connector) {
    const c = listConnectors(ctx.settings.shared()?.value, ctx.env).find((x) => x.name === q.connector);
    return decideMilder(ctx, run, lang, q, c?.manifest.title ?? q.title ?? q.connector);
  }
  if (w.task?.awaitsCheck) {
    ctx.io.stdout(`\n ${humanTask(tree, w.task.what, lang)}\n`);
    return checkSite(ctx, run, lang, root, w.task, true);
  }
}

/**
 * An open conflict, decided here — in an archive too, where nobody else decides it: what it is about and its sides. One
 * of the person's edits in the Strom app (a fact, a name, a title, a sex, a child's parents): the app's value kept or the
 * research's taken, as the app's link decides it (strom conflict resolve --take); any other: which claim holds, or the
 * person's own words. Why, always; 0 leaves it open.
 */
async function decideConflictHere(ctx: Context, run: Run, lang: string, root: string, id: string): Promise<void> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const tree = Tree.open(root, ctx.env);
  const c = tree.get<Conflict>(id);
  // meanwhile decided (in the app, another terminal): said, nothing asked
  if (!c || c.type !== "conflict" || c.state !== "open") return void out(t("ui.waiting.gone"));
  const head = ["", ` ${c.id} · ${kindWord(t, "conflict")} · ${t("ui.wait.since", { day: humanDay(c.created, lang) })}`, ` ${conflictTitle(tree, c)}`];
  const user = claimOf(c, "user");
  const research = claimOf(c, "research");
  if (!isEditConflict(c) || !user || !research) {
    out(head.join("\n"));
    await pickClaim(ctx, run, lang, tree, c, t("ui.wait.conflict.open"));
    return;
  }
  const value = (x: Conflict["claims"][number]) => sideText(tree, c, x) || t("ui.link.conflict.empty");
  // an archive's value is the archive's, not a research's
  const archive = isArchive(tree);
  out([...head, `    ${t("ui.wait.conflict.app", { value: value(user) })}`, `    ${t(archive ? "ui.wait.conflict.archive" : "ui.wait.conflict.research", { value: value(research) })}`].join("\n"));
  const i = await ctx.choose("", [{ label: t("ui.wait.conflict.take.user") }, { label: t(archive ? "ui.wait.conflict.take.archive" : "ui.wait.conflict.take.research") }], 2, { back: t("ui.wait.conflict.open") });
  if (i === undefined) return;
  const why = await askWhy(ctx, lang);
  if (!why) return;
  if ((await run(["conflict", "resolve", id, `--take=${i === 0 ? "user" : "research"}`, `--reasoning=${t("ui.link.conflict.by", { why })}`], true)) !== 0) return;
  out(t("ui.link.conflict.done"));
}

/** The images to save by hand and where (a task waiting for an archive's images). */
function imagesToSave(ctx: Context, lang: string, tree: Tree, x: Task): string[] {
  const t = translator(lang);
  if (!x.awaits) return [];
  const b = tree.get<RecordSet>(x.awaits.recordset);
  return [
    `    ${t("ui.waiting.images", { images: x.awaits.images, book: b?.title ?? x.awaits.recordset })}${b?.url ? ` · ${b.url}` : ""}`,
    `    ${t("ui.wait.save", { dir: `${ctx.display(inbox(ctx, x) ?? `inbox/${x.awaits.folder}`)}${path.sep}` })}`,
  ];
}

/** What to do for a task that waits: the images to save and where, or what it asks. */
function whatToDo(ctx: Context, lang: string, tree: Tree, x: Task): string[] {
  const t = translator(lang);
  // a check of a site only a person sees: what to check, and its link
  if (x.awaitsCheck) return [`    ${t("ui.waiting.check", { ask: x.awaitsCheck.ask })}`, `    ${x.awaitsCheck.url}`, `    ${t("ui.waiting.check.why")}`];
  if (!x.awaits) return [`    ${t("ui.waiting.do", { what: x.waitingOn || t("ui.waiting.ask") })}`];
  return imagesToSave(ctx, lang, tree, x);
}

function inbox(ctx: Context, x: Task): string | undefined {
  const shared = ctx.settings.shared()?.value;
  return shared && x.awaits ? path.join(shared, "inbox", x.awaits.folder) : undefined;
}

/**
 * The person's answer in words, kept with the task and the task back in the queue — no conversation offered: the agent
 * takes the answer up in its next work. True: kept.
 */
async function answerTask(ctx: Context, run: Run, lang: string, root: string, x: Task, prompt: UIKey = "ui.waiting.write"): Promise<boolean> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  out(t("ui.waiting.later"));
  let answer = "";
  for (;;) {
    answer = (await ctx.ask(t(prompt))).trim();
    if (!answer || answer === "0") return false;
    // kept as a note on the task, with what it asked: short — a longer story is for a conversation
    if (answer.length <= ANSWER_MAX) break;
    out(t("ui.waiting.long", { n: ANSWER_MAX }));
    if (outOfAnswers(ctx)) return false;
  }
  // meanwhile taken up by an agent (done, dropped, back in the queue): said, nothing written
  if (Tree.open(root, ctx.env).get<Task>(x.id)?.state !== "waiting") {
    out(t("ui.waiting.gone"));
    return true;
  }
  if ((await run(["task", "wake", x.id, `--answer=${answer}`], true)) !== 0) return false;
  out(`✓ ${t("ui.waiting.later")}`);
  return true;
}

/**
 * One task that waits, taken up: its folder opened for the images, a site checked, or the person's answer kept with the
 * task and the task back in the queue.
 */
async function takeUp(ctx: Context, run: Run, lang: string, root: string, x: Task): Promise<void> {
  const t = translator(lang);
  if (x.awaits) {
    const dir = inbox(ctx, x);
    if (dir) openForUser(dir, ctx.env);
    return void ctx.io.stdout(t("ui.waiting.opened", { dir: dir ? ctx.display(dir) : `inbox/${x.awaits.folder}` }) + "\n");
  }
  if (x.awaitsCheck) return checkSite(ctx, run, lang, root, x);
  await answerTask(ctx, run, lang, root, x);
}

/**
 * A check of a site only a person sees (strom task wait --check): the link, what is there — the book and its images,
 * only to be viewed there, nothing — and a note if any, 0 back with nothing changed; the task back with the answer.
 * What is there is picked by its number only: Enter goes back (a group of one check opens here at once, and two Enters
 * wrote an answer nobody gave).
 * `why`: said why only a person can (What waits; a link said it before).
 */
async function checkSite(ctx: Context, run: Run, lang: string, root: string, x: Task, why = false): Promise<void> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  const c = x.awaitsCheck!;
  out(`\n ${t("ui.waiting.check", { ask: c.ask })}\n    ${c.url}${why ? `\n    ${t("ui.waiting.check.why")}` : ""}`);
  const pick = await ctx.choose(t("ui.waiting.check.pick"), [{ label: t("ui.waiting.check.works") }, { label: t("ui.waiting.check.view") }, { label: t("ui.waiting.check.no") }], 3, { back: t("ui.browse.back") });
  if (pick === undefined) return;
  const check = (["works", "view", "no"] as const)[pick]!;
  let note = "";
  for (;;) {
    note = (await ctx.ask(t("ui.waiting.check.note"))).trim();
    if (note === "0") return;
    if (note.length <= ANSWER_MAX) break;
    out(t("ui.waiting.long", { n: ANSWER_MAX }));
    if (outOfAnswers(ctx)) return;
  }
  // meanwhile taken up (done, dropped, back in the queue): said, nothing written
  if (Tree.open(root, ctx.env).get<Task>(x.id)?.state !== "waiting") return void out(t("ui.waiting.gone"));
  if ((await run(["task", "wake", x.id, `--check=${check}`, ...(note ? [`--answer=${note}`] : [])], true)) !== 0) return;
  out(`✓ ${t("ui.waiting.later")}`);
}

/** One task that waits, named by a link of the Strom app: what it asks, then taken up as in the menu. False: it waits no more. */
export async function waitingTask(ctx: Context, run: Run, lang: string, root: string, id: string): Promise<boolean> {
  const tree = Tree.open(root, ctx.env);
  const x = tree.get<Task>(id);
  if (!x || x.state !== "waiting") return false;
  ctx.io.stdout([` ${x.what}`, ...whatToDo(ctx, lang, tree, x), ...(x.awaits ? ["", ui(lang, "ui.wait.how1"), ui(lang, "ui.wait.how2")] : []), ""].join("\n") + "\n");
  await takeUp(ctx, run, lang, root, x);
  return true;
}

/** Whose story it is, for the person: "Jan Novák (*1905) [P0001]", a couple by both. */
function storyOf(tree: Tree, id: string): string {
  const r = tree.get<Person | Family>(id);
  if (r?.type === "person") return label(r);
  if (r?.type === "family")
    return r.partners
      .map((p) => tree.get<Person>(p))
      .filter((p): p is Person => !!p)
      .map(label)
      .join(" & ");
  return id;
}

/**
 * The new version of a story the person approved before (the lock): read, then it takes the old one's place, or the
 * old one stays. `how` (a link of the Strom app): what was asked for there — still asked here, with the text before it.
 */
export async function decideStory(ctx: Context, run: Run, lang: string, root: string, id: string, who: string, how?: "final" | "keep"): Promise<boolean> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  const draft = Tree.open(root, ctx.env).get<Person | Family>(id)?.story?.draft;
  if (!draft) {
    out(t("ui.waiting.gone"));
    return false;
  }
  out("");
  out(t("ui.story.new.title", { who, day: draft.at.slice(0, 10) }));
  out("");
  if (draft.title) out(`„${draft.title}“`);
  out(draft.text.replace(/\*\*/g, ""));
  if (draft.note) out(`\n(${draft.note})`);
  const i = await ctx.choose(t("ui.story.new.pick"), [{ label: t("ui.story.new.take") }, { label: t("ui.story.new.keep") }], how === "keep" ? 1 : 0, { back: t("ui.browse.back") });
  if (i === undefined) return false;
  if ((await run(["story", i === 0 ? "approve" : "discard", id], true)) !== 0) return false;
  out(t(i === 0 ? "ui.story.new.taken" : "ui.story.new.kept"));
  return true;
}

/**
 * A question about the reading of scans (core/tuneask.ts): why, then the person's choice — the recommended suggested,
 * 0 back with nothing changed — answered by the command (strom media calibrate --answer). Smaller views chosen: the
 * paid calibration offered at once, which says its cost and asks first.
 */
async function decideTune(ctx: Context, run: Run, lang: string, q: Question): Promise<void> {
  const t = translator(lang);
  ctx.io.stdout(`\n ${t("ui.waiting.tune", { text: q.text })}\n    ${q.why}\n`);
  const pick = await ctx.choose(
    "",
    q.choices.map((c) => ({ label: `${c.label}${c.id === q.recommended ? ` ${t("ui.tune.q.recommended")}` : ""}` })),
    Math.max(0, q.choices.findIndex((c) => c.id === q.recommended)),
    { back: t("ui.browse.back") },
  );
  if (pick === undefined) return;
  const choice = q.choices[pick]!.id;
  if ((await run(["media", "calibrate", "--answer", `${q.id}=${choice}`])) !== 0) return;
  if (q.kind === "views.smaller" && choice === "calibrate") await run(["media", "calibrate"]);
}
