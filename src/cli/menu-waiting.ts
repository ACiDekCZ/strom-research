// The menu's "What waits for you": everything that waits for the person (core/waiting.ts — the same items, kinds,
// places, order and counts the Strom app gets), by the place where it is dealt with: one archive's site, one e-mail to
// an office, one message to the family. What is to do apart from what waits for a reply from outside (sent).
//
//   the overview  the places of what is to do, a page of 15 at a time (next, previous, a range, all), filtered by
//                 section, "?" for what waits for a reply; a number opens a place — a place of one thing that thing;
//                 what the Strom app does not show (core/waiting.ts terminalOnly) first, under a heading of its own,
//                 the app's after it under theirs
//   a place       its things, then for all of them at once: the request texts joined, sent, a conversation
//   a thing       what it is and waits for, then only what makes sense for its kind: the archive or the site, the
//                 folder for images saved by hand, the request's text, sent (or back among what is to do), an answer
//                 in words or a file, a conversation; a decision (an archive, a story, the app's send, the reading of
//                 scans, a site to check) its own screen
//
// The answer is kept with the task, nothing more: the agent takes it up in its next work (strom task wake --answer).
// An archive: only what an archive has — no agent, no conversation.

import { inboxState, inboxWaitOf, type AsideFile, type InboxState } from "../core/inboxwait.ts";
import { laterWords as laterOf } from "../core/inboxwords.ts";
import fs from "node:fs";
import path from "node:path";
import type { Context } from "./context.ts";
import { agentReady, claudeHere, guarded, outOfAnswers, pause, translator, type Run } from "./menu-parts.ts";
import { decideSent, startDirection } from "./menu-research.ts";
import { decideArchive, decideFloor, decideMilder, decideTakeover } from "./menu-archives.ts";
import { askWhy, changeWarning, decisionOnTree, pickClaim, waitingDo } from "./menu-links.ts";
import { runs, truncate } from "./format.ts";
import { crumbLine, keyed, line, listLines, saidLines, shown, type ListRow, type Span } from "./screen.ts";
import { ui, type UIKey } from "./ui.ts";
import { Tree } from "../core/tree.ts";
import type { Conflict, Family, Hypothesis, HypothesisVariant, Media, Person, RecordSet, Research, Source, Task } from "../core/model.ts";
import { transcriptMark, userReading } from "../core/readers.ts";
import { phrase, type PhraseKey } from "../core/phrases.ts";
import { agentDecided } from "../core/hypolinks.ts";
import { normId } from "../core/records.ts";
import { actsAsArchive } from "../core/state.ts";
import { branchOf } from "../core/offline.ts";
import { eventName, humanClaim, humanDay, humanTask, humanWhen } from "./human.ts";
import { RETRY_MAX, type RetryView } from "../core/retry.ts";
import { provenReviewSince, provenToReview } from "../core/provenfix.ts";
import { conflictTitle, displayName, lifespan } from "../core/people.ts";
import { claimOf, isEditConflict, sentDevices, sideText } from "../core/conflicts.ts";
import { openForUser } from "../core/open.ts";
import { isArchive } from "../core/mode.ts";
import type { Question } from "../core/tuneask.ts";
import { listConnectors } from "../core/connector.ts";
import { bookBrowserArchive, personBrowserNote } from "../core/browserhelp.ts";
import { PROFILES } from "../agents/profiles.ts";
import { placeQuestions } from "../core/placesview.ts";
import { inApp, requestFile, requestTexts, waitingFor, waitingSplit, type Waiting, type WaitSection } from "../core/waiting.ts";
import { keepWaiting, keptWaiting, waitingStamp, type WaitCount } from "../core/waitkept.ts";
import { viewModel } from "../core/viewsizes.ts";
import { offeredBooks, type BookRow } from "../core/books.ts";
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
const KINDS = ["images", "letter", "family", "web", "check", "permission", "takeover", "milder", "story", "send", "tune", "aside", "conflict", "hypothesis", "place", "branch", "proven", "transcript", "other"] as const;

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
    // the hypotheses an agent proposes how to decide: only the person decides one (an archive: none) — and where the
    // person decides them, the open ones with no proposal (until left open)
    hypotheses: true,
    hypothesesOpen: ctx.settings.hypothesesDecide(tree.config) === "person",
    // the questions about the reading of scans: an archive asks none
    ...(isArchive(tree) ? {} : { tune: ctx.settings }),
    // the files of the inbox set aside: which one is the image
    aside: true,
  });
}

/**
 * How many things wait here (waitingSplit): as kept beside the research while nothing they are counted from changed
 * (core/waitkept.ts), else counted and kept.
 */
export function waitingCount(ctx: Context, tree: Tree): WaitCount {
  const stamp = stampOf(ctx, tree);
  const kept = keptWaiting(tree, stamp);
  if (kept) return kept;
  const count = waitingSplit(waitingHere(ctx, tree));
  keepWaiting(tree, stamp, count);
  return count;
}

/** What waits, counted: the count the menu shows kept with it (the menu then shows what What waits counted). */
function waitingCounted(ctx: Context, tree: Tree): Waiting[] {
  const all = waitingHere(ctx, tree);
  keepWaiting(tree, stampOf(ctx, tree), waitingSplit(all));
  return all;
}

function stampOf(ctx: Context, tree: Tree): string {
  const agent = ctx.settings.agent(tree.config).value;
  // who decides the hypotheses: the open ones with no proposal wait only where the person does
  return waitingStamp(tree, ctx.env, ctx.settings.shared()?.value, `${agent} ${viewModel(ctx.settings, agent, tree.config) ?? ""} ${claudeHere(ctx, tree.config)} ${ctx.settings.hypothesesDecide(tree.config)}`);
}

/** The keys of the overview in the person's language: next, previous, all, and a letter per section. */
export function waitKeys(lang: string): { next: string; prev: string; all: string; books: string; section: Record<WaitSection, string> } {
  const t = translator(lang);
  const low = (s: string) => s.toLocaleLowerCase(lang);
  return {
    next: low(t("ui.wait.key.next")),
    prev: low(t("ui.wait.key.prev")),
    all: low(t("ui.wait.key.all")),
    books: low(t("ui.wait.key.books")),
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

/** What a thing is, short: a task's words as written, its records named (a person's ID after their name only bracketed); a hypothesis's question its people named. */
function short(tree: Tree, lang: string, w: Waiting): string {
  return w.task ? humanTask(tree, w.item.what, lang, { asWritten: true }) : w.hypothesis ? humanClaim(tree, w.item.what) : w.item.what;
}

const sentAtOf = (w: Waiting) => String(w.item.sentAt ?? w.item.at);

interface Place {
  key: string;
  name: string;
  items: Waiting[];
  /** Its things only here in the terminal (the Strom app shows none of them). */
  only: boolean;
}

/** The places of a list, in its order (the items of one place stand together). */
function placesOf(items: Waiting[], only = false): Place[] {
  const by = new Map<string, Place>();
  for (const w of items) {
    let p = by.get(w.item.group.key);
    if (!p) by.set(w.item.group.key, (p = { key: w.item.group.key, name: w.item.group.name, items: [], only }));
    p.items.push(w);
  }
  return [...by.values()];
}

/**
 * The places of the overview: when something is only here in the terminal, its places first, apart from those the
 * Strom app shows too (a place with both — an archive's milder question beside its tasks — in each part with its own);
 * else the places as they come.
 */
function overviewPlaces(items: Waiting[]): Place[] {
  const here = items.filter((w) => !inApp(w));
  return here.length ? [...placesOf(here, true), ...placesOf(items.filter(inApp))] : placesOf(items);
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
    const all = waitingCounted(ctx, tree);
    if (!all.length) return void out(t("ui.waiting.none"));
    const todo = all.filter((w) => w.item.phase === "todo");
    const sent = all.filter((w) => w.item.phase === "sent");
    if (phase === "sent" && !sent.length) phase = "todo";
    const here = phase === "todo" ? todo : sent;
    const counts = new Map<WaitSection, number>();
    for (const w of here) counts.set(w.item.section, (counts.get(w.item.section) ?? 0) + 1);
    if (filter && !counts.get(filter)) filter = undefined;
    const places = overviewPlaces(filter ? here.filter((w) => w.item.section === filter) : here);
    // the part only here in the terminal and the part the Strom app shows too, each with its heading
    const split = places.some((p) => p.only);
    const pages = Math.max(1, Math.ceil(places.length / PAGE));
    page = Math.min(page, pages - 1);
    const [from, to] = view === "all" ? [0, places.length] : view ? [view.from, Math.min(view.to, places.length)] : [page * PAGE, Math.min(places.length, (page + 1) * PAGE)];
    const present = SECTIONS.filter((s) => counts.get(s));
    const sectionName = (s: WaitSection) => t(`ui.wait.sec.${s}` as UIKey);

    // the way here (the filter its last part), how many to do and how many wait for a reply (the app's numbers), the
    // kinds with their keys; the places in their parts with their counts in one column; the keys of the page under them
    const style = ctx.style;
    const way = [...(ctx.crumbs.length ? ctx.crumbs : ["Strom", t("ui.menu.waitlist")]), ...(phase === "sent" ? [t("ui.wait.sent.title")] : []), ...(filter ? [sectionName(filter)] : [])];
    const counts2 = phase === "todo" ? [t("ui.wait.todo.n", { n: todo.length }), ...(sent.length ? [t("ui.wait.sent.n", { n: sent.length })] : [])] : [t("ui.wait.sent.n", { n: sent.length }), ...(todo.length ? [t("ui.wait.todo.n", { n: todo.length })] : [])];
    const screen = ["", crumbLine(way, style), line([{ text: `  ${counts2.join(" · ")}`, role: "text" }], style, 2)];
    if (present.length) {
      const label = `  ${t("ui.wait.kinds")}  `;
      const spans: Span[] = [{ text: label, role: "text" }];
      for (const [i, sec] of present.entries()) spans.push(...(i ? [{ text: "  ", role: "text" as const }] : []), { text: `[${keys.section[sec]}]`, role: "key" }, { text: ` ${sectionName(sec)} `, role: "text" }, { text: String(counts.get(sec)), role: "value" });
      screen.push(line(spans, style, shown(label)));
    }
    if (!here.length) screen.push(`  ${t("ui.wait.none.todo")}`);
    screen.push("");
    const shownPlaces = places.slice(from, to);
    const parts: { heading?: { text: string; aside?: string; count: string }; rows: ListRow[] }[] = [];
    for (const [k, p] of shownPlaces.entries()) {
      if (!parts.length || (split && shownPlaces[k - 1]!.only !== p.only)) {
        const n = places.filter((x) => x.only === p.only).reduce((a, x) => a + x.items.length, 0);
        parts.push({ ...(split ? { heading: { text: t(p.only ? "ui.wait.only.part" : "ui.wait.app.part"), ...(p.only ? { aside: t("ui.wait.only.aside") } : {}), count: String(n) } } : {}), rows: [] });
      }
      parts[parts.length - 1]!.rows.push({ key: String(from + k + 1), name: p.name, count: String(p.items.length), detail: placeDetail(t, lang, tree, p, phase) });
    }
    screen.push(...listLines(parts, style));
    // what can be typed here, only what does something now: the pages in one line, the rest in another
    const nav: string[] = [];
    if (places.length > PAGE) {
      nav.push(view === undefined ? t("ui.wait.c.page", { page: page + 1, pages }) : t("ui.wait.c.shown", { from: from + 1, to, n: places.length }));
      nav.push(t("ui.wait.c.next", { key: `[${keys.next}]` }), t("ui.wait.c.prev", { key: `[${keys.prev}]` }), t("ui.wait.c.all", { key: `[${keys.all}]` }));
    }
    const more: string[] = [];
    // the books most tasks need: an offer to download them by hand, never counted in what waits
    const books = booksHere(ctx, tree);
    if (books.length) more.push(t("ui.wait.c.books", { key: `[${keys.books}]`, n: books.length }));
    if (phase === "todo" && sent.length) more.push(t("ui.wait.f.sent", { n: sent.length }));
    if (phase === "sent" && todo.length) more.push(t("ui.wait.f.todo", { n: todo.length }));
    // [0] on its own line, last, as on every screen (spec 144 K1), the prompt saying what Enter does
    const back = t(filter ? "ui.wait.f.unfilter" : "ui.wait.f.back");
    const footer = [
      ...(nav.length ? [line([...keyed(`  ${nav.join("  ")}`), { text: `  ${t("ui.wait.f.range", { range: "10-20" })}`, role: "dim" }], style, 2)] : []),
      // each on its own line, as an option: `[?]  waiting for a reply 1`
      ...more.map((m) => line(keyed(`  ${m}`), style, 7)),
    ];
    const backLine = line(keyed(`  ${back}`), style, 2);
    screen.push("", ...footer, ...(footer.length ? [""] : []), backLine, "");
    out(screen.join("\n"));
    const prompt = t(places.length ? "ui.wait.prompt" : "ui.wait.prompt.none", { label: back.replace(/^\[0\]\s+/u, "") });

    // the answer: Enter goes back; anything unknown shows what can be typed again, nothing happens
    for (;;) {
      if (outOfAnswers(ctx)) return;
      const a = (await ctx.ask(prompt)).trim().toLocaleLowerCase(lang);
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
      if (a === keys.books && books.length) {
        await inWaiting(ctx, way, () => guarded(ctx, lang, () => showBooks(ctx, lang, root, books)));
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
        // a thing alone at its place: the way to it with the place's name too
        await inWaiting(ctx, way, () => guarded(ctx, lang, async () => (p.items.length === 1 ? ctx.within(p.name, () => thing(ctx, run, lang, root, p.items[0]!), p.name) : place(ctx, run, lang, root, p.key, phase, filter, split ? p.only : undefined))));
        break;
      }
      out([...footer, backLine].join("\n"));
    }
  }
}

/** What the overview opens, on its way (What waits, its filter): the menu's way, or What waits' own outside it. */
async function inWaiting<R>(ctx: Context, way: string[], act: () => Promise<R>): Promise<R> {
  const before = ctx.crumbs;
  ctx.crumbs = [...way];
  try {
    return await act();
  } finally {
    ctx.crumbs = before;
  }
}

/** The books worth downloading by hand here (none in an archive: no agent reads them). */
function booksHere(ctx: Context, tree: Tree): BookRow[] {
  return actsAsArchive(tree) ? [] : offeredBooks(tree);
}

/** At most this many books on the screen of the books (all of them: strom task books). */
const BOOKS_SHOWN = 9;

/**
 * The books most tasks need (strom task books, in the research language): one download by hand serves all their
 * tasks. Read only, an overview — Enter after it. False when there is none to show.
 */
export async function showBooks(ctx: Context, lang: string, root: string, rows?: BookRow[]): Promise<boolean> {
  const tree = Tree.open(root, ctx.env);
  const books = rows ?? booksHere(ctx, tree);
  if (!books.length) return false;
  const t = translator(lang);
  const shared = ctx.settings.shared()?.value;
  const style = ctx.style;
  const way = [...(ctx.crumbs.length ? ctx.crumbs : ["Strom", t("ui.menu.waitlist")]), t("ui.books.title")];
  const screen = ["", crumbLine(way, style), line([{ text: `  ${t("ui.books.n", { n: books.length })} · ${t("ui.books.why")}`, role: "text" }], style, 2), ""];
  for (const [i, r] of books.slice(0, BOOKS_SHOWN).entries()) {
    const counts = [t("ui.books.tasks", { n: r.tasks }), ...(r.waiting ? [t("ui.books.waiting", { n: r.waiting })] : [])];
    const dir = shared ? ctx.display(path.join(shared, "inbox", r.folder)) : `inbox/${r.folder}`;
    screen.push(
      `${String(i + 1).padStart(2)}  ${truncate(r.title, 60)} · ${counts.join(" · ")}`,
      `    ${[r.archive?.name, r.years, r.images !== undefined ? t("ui.books.images", { images: r.images, have: r.onDisk, missing: r.missing ?? 0 }) : t("ui.books.disk", { have: r.onDisk })].filter(Boolean).join(" · ")}`,
      ...(r.need ? [`    ${t("ui.books.need", { need: r.need })}`] : []),
      ...(r.url ? [`    ${r.url}`] : []),
      `    ${t("ui.books.folder", { dir: `${dir}${path.sep}` })}`,
    );
  }
  if (books.length > BOOKS_SHOWN) screen.push(...saidLines(`  ${t("ui.books.more", { n: books.length - BOOKS_SHOWN })}`, style));
  ctx.io.stdout(screen.join("\n") + "\n");
  await pause(ctx, lang);
  return true;
}

/** One place: its things, then for all of them at once — the request texts joined, sent, a conversation. */
async function place(ctx: Context, run: Run, lang: string, root: string, key: string, phase: WaitPhase, filter: WaitSection | undefined, only?: boolean): Promise<void> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  for (;;) {
    if (outOfAnswers(ctx)) return;
    const tree = Tree.open(root, ctx.env);
    const items = waitingHere(ctx, tree).filter((w) => w.item.group.key === key && w.item.phase === phase && (!filter || w.item.section === filter) && (only === undefined || only === !inApp(w)));
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
    // all of the place's images the agent could manage now, returned to it at once in What waits' order (spec 089) —
    // shown only sometimes, so last
    const back = items.filter((w) => w.task && (w.item.retry as RetryView | undefined)?.can);
    if (back.length >= 2) {
      const known = back.map((w) => (w.item.retry as RetryView).images).filter((n): n is number => n !== undefined);
      choices.push({ label: known.length ? t("ui.wait.group.retry", { tasks: back.length, images: known.reduce((a, b) => a + b, 0) }) : t("ui.wait.group.retry.tasks", { tasks: back.length }) });
      acts.push(async () => {
        const ids = back.map((w) => w.task!.id);
        if ((await run(["task", "wake", ...ids, "--retry"], true)) !== 0) return;
        out(t("ui.wait.group.retry.done", { ids: ids.join(", ") }));
      });
    }
    // the place's screen: the way to it with its name, how many there, its things (drawn again after each act)
    const i = await ctx.within(name, () => ctx.choose("", choices, choices.length, { back: t("ui.browse.back"), summary: [t(phase === "todo" ? "ui.wait.todo.n" : "ui.wait.sent.n", { n: items.length })], screen: true }), name);
    if (i === undefined) return;
    await ctx.within(name, () => guarded(ctx, lang, async () => void (await acts[i]!())), name);
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
  if (!w.task || w.task.awaitsCheck || w.task.proposal) return decide(ctx, run, lang, root, w);
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
    const inbox = it.inbox as InboxState | undefined;
    const url = typeof it.url === "string" ? it.url : undefined;
    // the way here on top, each time the screen is drawn (after an act too)
    const way = ctx.wayHead(true);
    const lines = ["", ...(way.length ? [...way, ""] : []), ` ${x.id} · ${kindWord(t, kind)} · ${t("ui.wait.prio", { n: x.priority })}`, ` ${humanTask(tree, x.what, lang, { asWritten: true })}`];
    if (x.waitingOn) lines.push(`    ${t("ui.wait.d.on", { on: x.waitingOn })}`);
    if (typeof it.to === "string" && it.to !== it.group.name) lines.push(`    ${t("ui.wait.d.to", { to: it.to })}`);
    lines.push(`    ${t("ui.wait.d.place", { place: it.group.name })}`);
    lines.push(`    ${t("ui.wait.d.since", { day: humanDay(it.at, lang) })}${sent ? ` · ${sentWords(t, lang, sentAtOf(cur))}` : ""}`);
    if (x.awaits) lines.push(...imagesToSave(ctx, lang, tree, x), "", `    ${t("ui.wait.how1")}`, `    ${t("ui.wait.how2")}`);
    else lines.push(...imagesToSave(ctx, lang, tree, x));
    // the agent could manage it now (spec 089): why it waits now, and when it may be returned again if not now
    const retry = it.retry as RetryView | undefined;
    if (retry) lines.push("", `    ${t("ui.wait.d.retry", { says: retry.says })}`, ...(!retry.can && retry.until ? [`    ${t("ui.wait.retry.until", { max: RETRY_MAX, when: humanWhen(retry.until, lang) })}`] : []));
    // wrapped under their text on a terminal, a command a sentence ends with on a line of its own
    out(lines.flatMap((l) => (l.includes("\x1b") ? [l] : saidLines(l, ctx.style))).join("\n"));

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
      // a note the Strom app sent shorter than the research's (core/shorternote.ts): taken, or the research's kept
      if (x.shorterNote)
        for (const take of ["take", "keep"] as const)
          choices.push({
            label: t(take === "take" ? "ui.wait.a.shorter.take" : "ui.wait.a.shorter.keep"),
            act: async () => {
              if ((await run(["sync", "note", x.id, take], true)) !== 0) return false;
              out(t(take === "take" ? "ui.wait.shorter.taken" : "ui.wait.shorter.kept"));
              return true;
            },
          });
      if (url) open(kind === "web" ? "ui.wait.a.web" : "ui.wait.a.link", url);
      // a site of the one book of the task: its images saved into its folder bring it back
      if (inbox)
        choices.push({
          label: t("ui.wait.a.folder", { have: inbox.have, want: inbox.want || "?" }),
          act: async () => {
            fs.mkdirSync(inbox.dir, { recursive: true });
            openForUser(inbox.dir, ctx.env);
            out(t("ui.waiting.opened", { dir: ctx.display(inbox.dir) }));
            return false;
          },
        });
      answer();
    }
    if (canChat(ctx, tree)) choices.push({ label: t("ui.wait.a.chat"), act: () => waitingDo(ctx, run, lang, root, x.id, "chat", "", true) });
    // returned to the agent (spec 089): shown only sometimes, so last
    if (retry?.can)
      choices.push({
        label: retry.images !== undefined ? t("ui.wait.a.retry", { n: retry.images }) : t("ui.wait.a.retry.unknown"),
        act: async () => {
          if ((await run(["task", "wake", x.id, "--retry", "--expect", x.updated], true)) !== 0) return false;
          out(t("ui.wait.retry.done"));
          return true;
        },
      });
    const i = await ctx.choose("", choices, choices.length, { back: t("ui.browse.back") });
    if (i === undefined) return;
    if ((await guarded(ctx, lang, choices[i]!.act)) === true) return;
  }
}

/** A decision: its own screen — an archive's question, a story's new version, the app's send, the reading of scans, a site to check. */
async function decide(ctx: Context, run: Run, lang: string, root: string, w: Waiting): Promise<void> {
  // the way here above what the decision says (its question under it, the way not said again)
  const way = ctx.wayHead();
  if (way.length) ctx.io.stdout(`\n${way.join("\n")}\n`);
  if (w.conflict) return decideConflictHere(ctx, run, lang, root, w.conflict.id);
  if (w.hypothesis) return void (await decideHypothesis(ctx, run, lang, root, w.hypothesis.id));
  if (w.place) return decidePlace(ctx, run, lang, root, w.place.place.id);
  if (w.branch) return decideBranch(ctx, run, lang, root, w.branch.id);
  if (w.proven) return decideProven(ctx, run, lang, root);
  if (w.send) return void (await decideSent(ctx, run, lang, root, w.send));
  if (w.tune) return decideTune(ctx, run, lang, w.tune);
  if (w.aside) return decideAside(ctx, run, lang, root, w.aside);
  if (w.task?.proposal) return void (await decideTranscript(ctx, run, lang, root, w.task.id));
  const tree = Tree.open(root, ctx.env);
  if (w.story) return void (await decideStory(ctx, run, lang, root, w.story, storyOf(tree, w.story)));
  const q = w.question;
  // a level strom keeps stricter than strom's list of the archive's terms (computed, no question kept): kept or as the terms
  if (!q && w.item.kind === "permission" && w.item.id.startsWith("floor:") && typeof w.item.host === "string") return void (await decideFloor(ctx, run, lang, root, w.item.host));
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
  // two sends of the Strom app (spec 094 K2.2): each side named by the device it came from
  const devices = sentDevices(lang, c);
  if (devices) {
    out([...head, ` ${t("ui.conflict.sent", devices)}`, `    ${t("ui.wait.conflict.sent", { device: devices.later, value: value(user) })}`, `    ${t("ui.wait.conflict.sent", { device: devices.earlier, value: value(research) })}`].join("\n"));
  } else out([...head, `    ${t("ui.wait.conflict.app", { value: value(user) })}`, `    ${t(archive ? "ui.wait.conflict.archive" : "ui.wait.conflict.research", { value: value(research) })}`].join("\n"));
  const options = devices
    ? [{ label: t("ui.wait.conflict.take.sent", { device: devices.later }) }, { label: t("ui.wait.conflict.take.sent", { device: devices.earlier }) }]
    : [{ label: t("ui.wait.conflict.take.user") }, { label: t(archive ? "ui.wait.conflict.take.archive" : "ui.wait.conflict.take.research") }];
  const i = await ctx.choose("", options, 2, { back: t("ui.wait.conflict.open") });
  if (i === undefined) return;
  const why = await askWhy(ctx, lang);
  if (!why) return;
  if ((await run(["conflict", "resolve", id, `--take=${i === 0 ? "user" : "research"}`, `--reasoning=${t("ui.link.conflict.by", { why })}`], true)) !== 0) return;
  out(t("ui.link.conflict.done"));
}

/**
 * A hypothesis the person decides — one screen for What waits, a person's review and the Strom app's link
 * (strom-research://hypothesis): its question and its variants, then what it is.
 *   proposed by an agent   decided as proposed, decided otherwise (another variant, or none holds — and why), or left as
 *                          it is (the proposal into its notes)
 *   open, no proposal      decided (a variant, or none holds — and why), or left open (What waits no longer shows it)
 *   decided or set aside   the decision shown (and that an agent made it), changed: a variant or none, and why — the
 *                          reason of the change, required; the earlier decision stays readable in its notes
 * 0 changes nothing. An archive (or a research waiting for its agent): nothing of an agent — no proposal, no mark. What
 * the decision connects goes on the tree in the agent's next work (the brief says so). True when something was written.
 */
export async function decideHypothesis(ctx: Context, run: Run, lang: string, root: string, id: string): Promise<boolean> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const tree = Tree.open(root, ctx.env);
  const h = tree.get<Hypothesis>(normId(id, "hypothesis"));
  // meanwhile withdrawn or merged (another terminal): said, nothing asked
  if (!h || h.type !== "hypothesis" || h.retracted || h.mergedInto) return (out(t("ui.link.hypothesis.none", { id: normId(id, "hypothesis") })), false);
  const archive = actsAsArchive(tree);
  const p = archive ? undefined : h.proposal;
  const decision = h.decision ?? "";
  const now =
    h.state === "open"
      ? []
      : p
        ? [`    ${t("ui.wait.hypothesis.was", { decision })}`]
        : [`    ${h.state === "abandoned" ? t("ui.wait.hypothesis.setAside", { decision }) : h.chosen ? t("ui.wait.hypothesis.decidedFor", { variant: h.chosen, decision }) : t("ui.wait.hypothesis.decidedPlain", { decision })}`];
  // who decided it: an agent the person let decide them — said, so the person may change it (never in an archive)
  if (h.state !== "open" && !archive && agentDecided(h)) now.push(`    ${t("ui.wait.hypothesis.byAgent", { day: humanDay(h.decidedAt ?? h.updated, lang) })}`);
  const since = p ? p.at : h.state === "open" ? h.created : undefined;
  const proposed = p ? (p.abandon ? t("ui.wait.hypothesis.proposed.abandon", { decision: p.decision }) : t(p.variant ? "ui.wait.hypothesis.proposed" : "ui.wait.hypothesis.proposed.plain", { variant: p.variant ?? "", decision: p.decision })) : undefined;
  out(
    [
      "",
      ` ${h.id} · ${kindWord(t, "hypothesis")}${since ? ` · ${t("ui.wait.since", { day: humanDay(since, lang) })}` : ""}`,
      ` ${humanClaim(tree, h.question)}`,
      ...now,
      ...h.variants.map((v) => `    ${v.label}) ${humanClaim(tree, v.claim)}`),
      ...(proposed ? ["", `    ${proposed}`, ...(p!.reason ? [`    ${t("ui.wait.hypothesis.again", { reason: p!.reason })}`] : [])] : []),
    ].join("\n"),
  );
  // a change the tree cannot follow (the earlier link stays, other work stands on it; the new one is not written): said
  // first, the person goes on or cancels — cancel suggested
  const goesOn = async (v: HypothesisVariant): Promise<boolean> => {
    const stays = changeWarning(lang, tree, h, v);
    if (!stays) return true;
    out(stays);
    return ctx.confirm(t("ui.link.go"), false);
  };
  // another variant, or none holds — and why: the decision's words; a decided one decided again: the reason too
  const otherwise = async (): Promise<{ argv: string[]; abandon: boolean } | undefined> => {
    const v = await ctx.choose(t("ui.wait.hypothesis.pick"), [...h.variants.map((x) => ({ label: `${x.label}) ${truncate(humanClaim(tree, x.claim), 70)}` })), { label: t("ui.wait.hypothesis.none") }], h.variants.length + 1, { back: t("ui.browse.back") });
    if (v === undefined) return undefined;
    if (v < h.variants.length && !(await goesOn(h.variants[v]!))) return undefined;
    const why = await askWhy(ctx, lang);
    if (!why) return undefined;
    const abandon = v === h.variants.length;
    return { abandon, argv: ["hypothesis", "decide", h.id, ...(abandon ? ["--abandon"] : [`--variant=${h.variants[v]!.label}`]), `--decision=${why}`, ...(h.state === "open" ? [] : [`--reason=${why}`])] };
  };
  let picked: { argv: string[]; abandon: boolean } | undefined;
  if (p) {
    const i = await ctx.choose("", [{ label: t("ui.wait.hypothesis.accept") }, { label: t("ui.wait.hypothesis.other") }, { label: t("ui.wait.hypothesis.keep") }], 3, { back: t("ui.browse.back") });
    if (i === undefined) return false;
    if (i === 2) {
      if ((await run(["hypothesis", "decide", h.id, "--keep-open"], true)) !== 0) return false;
      out(t("ui.wait.hypothesis.kept"));
      return true;
    }
    const proposedVariant = !p.abandon && p.variant ? h.variants.find((x) => x.label === p.variant) : undefined;
    if (i === 0 && proposedVariant && !(await goesOn(proposedVariant))) return false;
    picked = i === 0 ? { argv: ["hypothesis", "decide", h.id, "--proposed"], abandon: !!p.abandon } : await otherwise();
  } else if (h.state === "open") {
    const i = await ctx.choose("", [{ label: t("ui.wait.hypothesis.decide") }, { label: t("ui.wait.hypothesis.leave") }], 2, { back: t("ui.browse.back") });
    if (i === undefined) return false;
    if (i === 1) {
      if ((await run(["hypothesis", "decide", h.id, "--keep-open"], true)) !== 0) return false;
      out(t("ui.wait.hypothesis.leftOpen"));
      return true;
    }
    picked = await otherwise();
  } else {
    const i = await ctx.choose("", [{ label: t("ui.wait.hypothesis.change") }], 1, { back: t("ui.browse.back") });
    if (i === undefined) return false;
    picked = await otherwise();
  }
  if (!picked || (await run(picked.argv, true)) !== 0) return false;
  out(t(picked.abandon ? "ui.wait.hypothesis.abandoned" : "ui.wait.hypothesis.decided"));
  // the person's decision is on the tree at once (spec 074 K1.5): what it wrote, took off, could not write
  // (and what of it is left to the agent: decisionOnTree says it, never in an archive)
  for (const line of decisionOnTree(lang, root, ctx.env, h)) out(line);
  return true;
}

/**
 * The facts the user made proven without the original record (the fix proven-originals left them as they are): a few
 * of them, why proven needs the original — kept proven (asked no more), or made probable (strom fixes review). Nothing
 * spent; 0 leaves them waiting.
 */
async function decideProven(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const tree = Tree.open(root, ctx.env);
  const facts = provenToReview(tree);
  // meanwhile answered (another terminal) or the facts changed: said, nothing asked
  if (!facts.length) return void out(t("ui.wait.proven.gone"));
  const at = provenReviewSince(tree);
  const owner = (id: string) => {
    const o = tree.get<Person | Family>(id);
    if (!o) return id;
    if (o.id.startsWith("F")) {
      const f = o as Family;
      const names = f.partners.map((x) => tree.get<Person>(x)).filter((x): x is Person => !!x).map((x) => displayName(x));
      return names.length ? `${names.join(" & ")} (${o.id})` : o.id;
    }
    return `${displayName(o as Person)} (${o.id})`;
  };
  out(
    [
      "",
      ` W-proven · ${kindWord(t, "proven")}${at ? ` · ${t("ui.wait.since", { day: humanDay(at, lang) })}` : ""}`,
      ` ${t("ui.waiting.proven", { n: facts.length })}`,
      `    ${t("ui.wait.proven.why")}`,
      ...facts.slice(0, 5).map((f) => `    • ${f.event} · ${eventName(f.kind, lang)}${f.date ? ` ${f.date}` : ""} · ${truncate(owner(f.owner), 60)}`),
      ...(facts.length > 5 ? [`    ${t("ui.wait.proven.more", { n: facts.length - 5 })}`] : []),
    ]
      .flatMap((l) => saidLines(l, ctx.style))
      .join("\n"),
  );
  const i = await ctx.choose("", [{ label: t("ui.wait.proven.keep") }, { label: t("ui.wait.proven.lower") }], 2, { back: t("ui.browse.back") });
  if (i === undefined) return;
  await run(["fixes", "review", "proven-originals", i === 0 ? "keep" : "lower"], true);
}

/**
 * A branch off the lines that grew (spec 038 K7.0 d): whose it is, how it hangs on a line, a few of its tasks — added to
 * a line (the nearest, else one picked), a line made for it (the new direction's wizard with its person, --branch),
 * left as it is, or not researched (strom offline answer). Nothing spent; 0 leaves it waiting.
 */
async function decideBranch(ctx: Context, run: Run, lang: string, root: string, id: string): Promise<void> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const tree = Tree.open(root, ctx.env);
  const b = branchOf(tree, ctx.settings, id);
  // meanwhile answered (in the app, another terminal) or no branch now: said, nothing asked
  if (!b?.grows) return void out(t("ui.wait.branch.gone"));
  const who = (p: string) => {
    const x = tree.get<Person>(p);
    return x ? label(x) : p;
  };
  const lineName = (g: string) => tree.get<Research>(g)?.name ?? g;
  const p = tree.get<Person>(b.person);
  const name = p ? displayName(p) : b.person;
  const at = b.tasks.map((x) => x.created).sort().pop() ?? "";
  out(
    [
      "",
      ` ${b.id} · ${kindWord(t, "branch")}${at ? ` · ${t("ui.wait.since", { day: humanDay(at, lang) })}` : ""}`,
      ` ${t("ui.waiting.branch", { who: name, tasks: b.tasks.length, persons: b.persons.length })}`,
      `    ${t("ui.offline.via", { who: who(b.via.person), rel: t(`ui.offline.rel.${b.via.rel}` as UIKey) })}`,
      ...(b.nearest ? [`    ${t("ui.wait.branch.nearest", { line: lineName(b.nearest) })}`] : []),
      ...b.tasks.slice(0, 3).map((x) => `    • ${truncate(humanTask(tree, x.what, lang, { asWritten: true }), 70)}`),
    ].join("\n"),
  );
  const i = await ctx.choose(
    "",
    [
      { label: b.nearest ? t("ui.wait.branch.line", { line: lineName(b.nearest) }) : t("ui.wait.branch.line.pick") },
      { label: t("ui.wait.branch.create") },
      { label: t("ui.wait.branch.keep") },
      { label: t("ui.wait.branch.never") },
    ],
    4,
    { back: t("ui.browse.back") },
  );
  if (i === undefined) return;
  if (i === 0) {
    let line = b.nearest;
    if (!line) {
      const lines = tree.list<Research>("research").filter((r) => !r.retracted && r.state === "active");
      if (!lines.length) return void out(t("ui.wait.branch.nolines"));
      const k = await ctx.choose(t("ui.wait.branch.which"), lines.slice(0, 9).map((r) => ({ label: r.name })), 0, { back: t("ui.browse.back") });
      if (k === undefined) return;
      line = lines[k]!.id;
    }
    if ((await run(["offline", "answer", b.id, "line", ...(line !== b.nearest ? ["--line", line] : [])], true)) !== 0) return;
    return void out(t("ui.wait.branch.done.line", { line: lineName(line) }));
  }
  if (i === 1) {
    // the new direction's wizard with the branch's person: what to find out, its title, what is known of it
    const kinds = ["ancestors", "descendants", "question"] as const;
    const k = await ctx.choose(t("ui.research.kind"), [{ label: t("ui.research.ancestors") }, { label: t("ui.research.descendants") }, { label: t("ui.research.question") }], 1, { back: t("ui.browse.back") });
    if (k === undefined) return;
    let question: string | undefined;
    if (kinds[k] === "question") {
      question = (await ctx.ask(t("ui.research.ask"))).trim();
      if (!question || question === "0") return;
    }
    return startDirection(ctx, run, lang, root, kinds[k]!, ["--person", b.person], name, question, b.id);
  }
  if ((await run(["offline", "answer", b.id, i === 2 ? "keep" : "never"], true)) !== 0) return;
  out(t(i === 2 ? "ui.wait.branch.done.keep" : "ui.wait.branch.done.never"));
}

/**
 * The research's question of a place, answered here as in the app's What waits (strom place answer, the person's own):
 * which of the candidates it is (or none, or no telling), the position on the map kept against the records, the facts
 * written as the record says or left. Nothing spent; 0 leaves it open.
 */
async function decidePlace(ctx: Context, run: Run, lang: string, root: string, id: string): Promise<void> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const a = placeQuestions(Tree.open(root, ctx.env)).find((x) => x.place.id === id);
  // meanwhile answered or changed (in the app, a sync): said, nothing asked
  if (!a) return void out(t("ui.wait.place.gone"));
  const q = a.question;
  const p = a.place;
  const name = p.names[0]?.name ?? p.id;
  const what = t(q.kind === "conflict" ? "ui.waiting.place.conflict" : q.kind === "form" ? "ui.waiting.place.form" : "ui.waiting.place.propose", { place: name });
  const lines = ["", ` ${p.id} · ${kindWord(t, "place")} · ${t("ui.wait.since", { day: humanDay(q.at, lang) })}`, ` ${what}`];
  if (a.forms.length) lines.push(`    ${a.forms.join(" · ")}`);
  if (q.why) lines.push(`    ${q.why}`);
  if (q.kind === "conflict") {
    const cur = q.current ?? p.coords;
    const by = p.locating?.by ?? "person";
    if (cur) lines.push(`    ${t("ui.wait.place.current", { lat: cur.lat, lon: cur.lon, by: t(`ui.wait.place.by.${by}` as UIKey) })}`);
  }
  const at = (x: { place: string; house?: string }) => (x.house ? `${x.place} ${x.house}` : x.place);
  if (q.kind === "form" && q.change) lines.push(`    ${t("ui.wait.place.change", { facts: q.change.facts, from: at(q.change.from), to: at(q.change.to) })}`);
  out(lines.join("\n"));
  const choices: { label: string; take: string }[] =
    q.kind === "form"
      ? [
          { label: t("ui.wait.place.yes"), take: "yes" },
          { label: t("ui.wait.place.no"), take: "no" },
          { label: t("ui.wait.place.unknown"), take: "unknown" },
        ]
      : [
          ...(q.candidates ?? []).map((c) => {
            const where = [c.district, c.country].filter(Boolean).join(", ");
            return { label: `${c.name}${where ? ` (${where})` : ""} — ${c.why}`, take: c.id };
          }),
          ...(q.kind === "conflict"
            ? [
                { label: t("ui.wait.place.keep"), take: "keep" },
                { label: t("ui.wait.place.unknown"), take: "unknown" },
              ]
            : [
                { label: t("ui.wait.place.none"), take: "none" },
                { label: t("ui.wait.place.unknown"), take: "unknown" },
              ]),
        ];
  const i = await ctx.choose(t("ui.wait.place.pick"), choices, choices.length, { back: t("ui.wait.conflict.open") });
  if (i === undefined) return;
  if ((await run(["place", "answer", p.id, `--take=${choices[i]!.take}`, `--expect=${p.id}=${q.at}`], true)) !== 0) return;
  out(t("ui.wait.place.done", { place: name }));
}

/** The images to save by hand and where (a task waiting for an archive's images). */
function imagesToSave(ctx: Context, lang: string, tree: Tree, x: Task): string[] {
  const t = translator(lang);
  const st = inboxState(tree, ctx.settings.shared()?.value, x);
  // a site the person looks at for the one book of the task: what is saved into its folder brings it back
  if (!x.awaits) {
    const w = inboxWaitOf(tree, x);
    if (!w) return [];
    const b = tree.get<RecordSet>(w.recordset);
    const dir = `${ctx.display(st?.dir ?? `inbox/${w.folder}`)}${path.sep}`;
    return [`    ${t("ui.wait.save.web", { book: b?.title ?? w.recordset, dir })}`, ...(st?.problemCode ? [`    ${problemWords(t, st)}`] : st?.waitsUntil || st?.left?.length ? [`    ${laterOf(t, st)}`] : st?.lying ? [`    ${t("ui.wait.saved", { have: st.lying, want: "?" })}`] : [])];
  }
  const b = tree.get<RecordSet>(x.awaits.recordset);
  return [
    `    ${t("ui.waiting.images", { images: x.awaits.images, book: b?.title ?? x.awaits.recordset })}${b?.url ? ` · ${b.url}` : ""}`,
    `    ${t("ui.wait.save", { dir: `${ctx.display(inbox(ctx, x) ?? `inbox/${x.awaits.folder}`)}${path.sep}` })}`,
    // how far it got: saved X of Y, which are missing, why what lies there is not taken
    ...(st && st.want ? [`    ${[t("ui.wait.saved", { have: st.have, want: st.want }), st.missing.length ? t("ui.wait.missing", { missing: runs(st.missing) }) : ""].filter(Boolean).join(" · ")}`] : []),
    ...(st?.problemCode ? [`    ${problemWords(t, st)}`] : []),
    ...(st && (st.waitsUntil || st.left?.length) ? [`    ${laterOf(t, st)}`] : []),
    // an archive only a person's browser goes to: whether the agent could save them itself (spec 048 K5.2)
    ...browserWords(ctx, t, tree, b?.url),
  ];
}

/** Beside images of an archive only a person's browser goes to: how the agent would save them itself, if it could. */
function browserWords(ctx: Context, t: ReturnType<typeof translator>, tree: Tree, url: string | undefined): string[] {
  if (isArchive(tree) || ctx.archiveHere()) return [];
  const a = bookBrowserArchive(tree, url, ctx.settings.shared()?.value);
  if (!a) return [];
  const agent = ctx.settings.agent(tree.config).value;
  const note = personBrowserNote(ctx.env, agent, a, tree.root);
  if (!note) return [];
  return [`    ${t(note.key, note.key === "ui.waiting.browser.agent" ? { agent: PROFILES[agent]?.name ?? agent } : note.params)}`];
}

/** What lies in a task's folder and is not taken yet, in the person's words (core/inboxwords.ts). */
export const laterWords = (t: ReturnType<typeof translator>, st: InboxState): string => laterOf(t, st);

/** Why the files saved for a task are not taken, in the person's words. */
export function problemWords(t: ReturnType<typeof translator>, st: InboxState): string {
  if (st.ambiguous) return t("ui.wait.inbox.ambiguous", { file: st.ambiguous, n: st.ambiguousNumber ?? st.missing[0] ?? "40" });
  const first = st.missing[0] ?? 40;
  // the number padded as a viewer's file names it (__0009.jpg — never __09.jpg)
  return st.problemCode === "inbox.unnamed" ? t("ui.wait.inbox.unnamed") : t("ui.wait.inbox.count", { files: st.lying, n: st.missing.length || st.want, first, padded: String(first).padStart(4, "0") });
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
  if (x.proposal) return void (await decideTranscript(ctx, run, lang, root, x.id));
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
  // a new wording proposed for a transcript: its own screen says what it is
  if (x.proposal) return (await decideTranscript(ctx, run, lang, root, x.id), true);
  ctx.io.stdout([` ${x.what}`, ...whatToDo(ctx, lang, tree, x), ...(x.awaits ? ["", ui(lang, "ui.wait.how1"), ui(lang, "ui.wait.how2")] : []), ""].join("\n") + "\n");
  await takeUp(ctx, run, lang, root, x);
  return true;
}

/**
 * A new wording an agent proposed for a transcript the person read or confirmed (core/proposal.ts): the transcript now
 * and the wording proposed, why, then the person's choice — the proposed wording taken (theirs now, typed at their
 * terminal), or the transcript kept (that wording never proposed again); 0 back with nothing changed. True when decided.
 */
export async function decideTranscript(ctx: Context, run: Run, lang: string, root: string, id: string): Promise<boolean> {
  const t = translator(lang);
  const out = (line = "") => ctx.io.stdout(line + "\n");
  const tree = Tree.open(root, ctx.env);
  const x = tree.get<Task>(id);
  // meanwhile decided (in the app, another terminal): said, nothing asked
  if (!x || x.type !== "task" || x.state !== "waiting" || !x.proposal) return (out(t("ui.waiting.gone")), false);
  const p = x.proposal;
  const s = tree.get<Source>(p.source);
  if (!s) return (out(t("ui.waiting.gone")), false);
  const u = userReading(s);
  const read = u ? phrase(lang, `proposal.read.${u.how}` as PhraseKey) : "";
  const indent = (text: string) => text.split("\n").map((l) => `    ${l}`);
  out(
    [
      "",
      ` ${x.id} · ${kindWord(t, "transcript")}`,
      ` ${t("ui.proposal.title", { source: s.id, title: s.title })}`,
      "",
      `  ${t("ui.proposal.now", { read, day: u ? humanDay(u.at, lang) : "" })}`,
      ...indent(s.transcript ?? ""),
      "",
      `  ${t("ui.proposal.new", { by: p.by, day: humanDay(p.at, lang) })}`,
      ...indent(p.text),
      ...(p.why ? ["", `  ${t("ui.proposal.why", { why: p.why })}`] : []),
    ].join("\n"),
  );
  const i = await ctx.choose(t("ui.proposal.pick"), [{ label: t("ui.proposal.take") }, { label: t("ui.proposal.keep") }], 2, { back: t("ui.browse.back") });
  if (i === undefined) return false;
  const take = i === 0 ? "proposal" : "keep";
  if ((await run(["source", "proposal", s.id, "--task", x.id, "--take", take, "--proposed", transcriptMark(p.text)], true)) !== 0) return false;
  out(t(take === "proposal" ? "ui.proposal.taken" : "ui.proposal.kept"));
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

/**
 * A file of a book's folder of the inbox set aside (B0408, B0374): the two shown to compare, then which one is the
 * image — the one registered kept (the file into the system's trash), the file taken as the image of its number (the one
 * there withdrawn, kept), or as another image of the book (its number typed). The same file as another image: which of
 * the two numbers is right is the research's to sort out; the file may go.
 */
async function decideAside(ctx: Context, run: Run, lang: string, root: string, a: AsideFile): Promise<void> {
  const t = translator(lang);
  const out = (s: string) => ctx.io.stdout(`${s}\n`);
  const tree = Tree.open(root, ctx.env);
  const shared = ctx.settings.shared()?.value;
  const m = tree.get<Media>(a.media);
  const image = a.image ?? "?";
  out(["", ` ${t(a.kind === "same" ? "ui.waiting.aside.same" : "ui.waiting.aside.other", { file: a.name, book: a.recordset, image, media: a.media })}`, `    ${a.path}`].join("\n"));
  const compare = () => {
    openForUser(a.path, ctx.env);
    if (m && shared) openForUser(path.join(shared, m.file), ctx.env);
  };
  const choices: { label: string; act: () => Promise<unknown> | unknown }[] = [{ label: t("ui.aside.compare"), act: compare }];
  if (a.kind === "other") {
    choices.push({ label: t("ui.aside.keep", { image }), act: () => run(["media", "aside", a.file, "--discard"]) });
    if (a.image !== undefined) choices.push({ label: t("ui.aside.take", { image }), act: () => run(["media", "aside", a.file, "--take"]) });
    choices.push({
      label: t("ui.aside.number"),
      act: async () => {
        const n = (await ctx.ask(t("ui.aside.number.ask"))).trim();
        if (!/^\p{Nd}+$/u.test(n)) return;
        return run(["media", "aside", a.file, `--image=${Number(n)}`]);
      },
    });
  } else choices.push({ label: t("ui.aside.discard"), act: () => run(["media", "aside", a.file, "--discard"]) });
  for (;;) {
    const i = await ctx.choose("", choices, choices.length, { back: t("ui.browse.back") });
    if (i === undefined) return;
    await choices[i]!.act();
    if (i > 0 || !fs.existsSync(a.path)) return;
  }
}
