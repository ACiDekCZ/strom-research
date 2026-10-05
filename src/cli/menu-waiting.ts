// The menu's "What waits for you": each task that waits for the person, what
// to do for it (in their language, as the agent wrote it), the folder for the
// images they save by hand — and their answer, taken in here (strom task wake
// --answer): the task goes back to the agent with it.

import path from "node:path";
import type { Context } from "./context.ts";
import { subMenu, translator, type Item, type Run } from "./menu-parts.ts";
import { decideSent, offerChat } from "./menu-research.ts";
import { truncate } from "./format.ts";
import { Tree } from "../core/tree.ts";
import type { Family, Person, RecordSet, Task } from "../core/model.ts";
import { storiesToApprove } from "../core/stories.ts";
import { receivedPending } from "../core/sync.ts";
import { humanDay } from "./human.ts";
import { displayName, lifespan } from "../core/people.ts";

/** A person for the person reading: "Jan Novák (*1905) [P0001]". */
const label = (p: Person) => `${displayName(p)}${lifespan(p) ? ` (${lifespan(p)})` : ""} [${p.id}]`;
import { openForUser } from "../core/open.ts";
import { isArchive } from "../core/mode.ts";

/** At most this many are listed to answer (the menu's nine); the rest after them. */
const SHOWN = 9;
/** An answer is a note on the task (500 characters, with what it asked). */
const ANSWER_MAX = 300;

/** What to do for a task that waits: the images to save and where, or what it asks. */
function whatToDo(ctx: Context, lang: string, tree: Tree, x: Task): string[] {
  const t = translator(lang);
  if (!x.awaits) return [`    ${t("ui.waiting.do", { what: x.waitingOn || t("ui.waiting.ask") })}`];
  const b = tree.get<RecordSet>(x.awaits.recordset);
  return [
    `    ${t("ui.waiting.images", { images: x.awaits.images, book: b?.title ?? x.awaits.recordset })}${b?.url ? ` · ${b.url}` : ""}`,
    `    ${t("ui.wait.save", { dir: `${ctx.display(inbox(ctx, x) ?? `inbox/${x.awaits.folder}`)}${path.sep}` })}`,
  ];
}

function inbox(ctx: Context, x: Task): string | undefined {
  const shared = ctx.settings.shared()?.value;
  return shared && x.awaits ? path.join(shared, "inbox", x.awaits.folder) : undefined;
}

/** One task that waits, taken up: its folder opened for the images, or the person's answer and the task back in the queue. */
async function takeUp(ctx: Context, run: Run, lang: string, root: string, x: Task): Promise<void> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  if (x.awaits) {
    const dir = inbox(ctx, x);
    if (dir) openForUser(dir, ctx.env);
    return void out(t("ui.waiting.opened", { dir: dir ? ctx.display(dir) : `inbox/${x.awaits.folder}` }));
  }
  let answer = "";
  for (;;) {
    answer = (await ctx.ask(t("ui.waiting.write"))).trim();
    if (!answer || answer === "0") return;
    // kept as a note on the task, with what it asked: short — a longer story is for a conversation
    if (answer.length <= ANSWER_MAX) break;
    out(t("ui.waiting.long", { n: ANSWER_MAX }));
    if (ctx.io.answers !== undefined && ctx.io.answers.length === 0) return;
  }
  // meanwhile taken up by an agent (done, dropped, back in the queue): said, nothing written
  if (Tree.open(root, ctx.env).get<Task>(x.id)?.state !== "waiting") return void out(t("ui.waiting.gone"));
  if ((await run(["task", "wake", x.id, `--answer=${answer}`], true)) !== 0) return;
  out(t("ui.waiting.back"));
  await offerChat(ctx, run, lang, root, t("ui.waiting.chat"), t("ui.waiting.say", { what: truncate(x.what, 80) }));
}

/** One task that waits, named by a link of the Strom app: what it asks, then taken up as in the menu. False: it waits no more. */
export async function waitingTask(ctx: Context, run: Run, lang: string, root: string, id: string): Promise<boolean> {
  const tree = Tree.open(root, ctx.env);
  const x = tree.get<Task>(id);
  if (!x || x.state !== "waiting") return false;
  ctx.io.stdout([` ${x.what}`, ...whatToDo(ctx, lang, tree, x), ...(x.awaits ? ["", translator(lang)("ui.wait.how1"), translator(lang)("ui.wait.how2")] : []), ""].join("\n") + "\n");
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

export async function waitingForYou(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  await subMenu(ctx, lang, () => {
    const tree = Tree.open(root, ctx.env);
    const waiting = isArchive(tree) ? [] : tree.list<Task>("task").filter((x) => x.state === "waiting");
    const stories = storiesToApprove(tree);
    // what the Strom app sent on its own: first, the person's own edits
    const sent = receivedPending(root);
    if (!waiting.length && !stories.length && !sent.length) return { title: t("ui.waiting.none"), items: [] };
    // the trees from the app first, then the tasks, then the stories: at most the menu's nine together
    const shownSent = sent.slice(0, SHOWN);
    const shown = waiting.slice(0, SHOWN - shownSent.length);
    const shownStories = stories.slice(0, SHOWN - shownSent.length - shown.length);
    const k0 = shownSent.length;
    const text: string[] = [t(sent.length && !waiting.length && !stories.length ? "ui.waiting.title.sent" : "ui.waiting.title", { n: waiting.length + stories.length + sent.length })];
    for (const [k, r] of shownSent.entries()) text.push("", ` ${k + 1}. ${t("ui.waiting.sent", { day: humanDay(r.at, lang), time: r.at.slice(11, 16), n: r.changes })}`);
    for (const [k, x] of shown.entries()) {
      text.push("", ` ${k0 + k + 1}. ${x.what}`, ...whatToDo(ctx, lang, tree, x));
    }
    for (const [k, s] of shownStories.entries()) text.push("", ` ${k0 + shown.length + k + 1}. ${t("ui.waiting.story", { who: storyOf(tree, s.id) })}`);
    if (shown.some((x) => x.awaits)) text.push("", t("ui.wait.how1"), t("ui.wait.how2"));
    const hidden = waiting.length + stories.length + sent.length - shownSent.length - shown.length - shownStories.length;
    if (hidden > 0) text.push("", t("ui.waiting.more", { n: hidden }));
    const items: Item[] = [
      ...shownSent.map((r, k) => ({
        key: String(k + 1),
        label: t("ui.waiting.sent.read", { k: k + 1 }),
        act: async () => void (await decideSent(ctx, run, lang, root, r)),
      })),
      ...shown.map((x, k) => ({
        key: String(k0 + k + 1),
        label: x.awaits ? t("ui.waiting.folder", { k: k0 + k + 1 }) : t("ui.waiting.answer", { k: k0 + k + 1, what: truncate(x.what, 60) }),
        act: () => takeUp(ctx, run, lang, root, x),
      })),
      ...shownStories.map((s, k) => ({
        key: String(k0 + shown.length + k + 1),
        label: t("ui.waiting.story.read", { k: k0 + shown.length + k + 1, who: storyOf(tree, s.id) }),
        act: async () => void (await decideStory(ctx, run, lang, root, s.id, storyOf(tree, s.id))),
      })),
    ];
    return { title: `${text.join("\n")}\n\n${t(shown.length || shownSent.length ? "ui.waiting.pick" : "ui.waiting.pick.story")}`, items };
  });
}
