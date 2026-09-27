// The menu's "What waits for you": each task that waits for the person, what
// to do for it (in their language, as the agent wrote it), the folder for the
// images they save by hand — and their answer, taken in here (strom task wake
// --answer): the task goes back to the agent with it.

import path from "node:path";
import type { Context } from "./context.ts";
import { subMenu, translator, type Item, type Run } from "./menu-parts.ts";
import { offerChat } from "./menu-research.ts";
import { truncate } from "./format.ts";
import { Tree } from "../core/tree.ts";
import type { RecordSet, Task } from "../core/model.ts";
import { openForUser } from "../core/open.ts";

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

export async function waitingForYou(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  await subMenu(ctx, lang, () => {
    const tree = Tree.open(root, ctx.env);
    const waiting = tree.list<Task>("task").filter((x) => x.state === "waiting");
    if (!waiting.length) return { title: t("ui.waiting.none"), items: [] };
    const shown = waiting.slice(0, SHOWN);
    const text: string[] = [t("ui.waiting.title", { n: waiting.length })];
    for (const [k, x] of shown.entries()) {
      text.push("", ` ${k + 1}. ${x.what}`, ...whatToDo(ctx, lang, tree, x));
    }
    if (shown.some((x) => x.awaits)) text.push("", t("ui.wait.how1"), t("ui.wait.how2"));
    if (waiting.length > SHOWN) text.push("", t("ui.waiting.more", { n: waiting.length - SHOWN }));
    const items: Item[] = shown.map((x, k) => ({
      key: String(k + 1),
      label: x.awaits ? t("ui.waiting.folder", { k: k + 1 }) : t("ui.waiting.answer", { k: k + 1, what: truncate(x.what, 60) }),
      act: () => takeUp(ctx, run, lang, root, x),
    }));
    return { title: `${text.join("\n")}\n\n${t("ui.waiting.pick")}`, items };
  });
}
