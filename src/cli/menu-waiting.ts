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

export async function waitingForYou(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  const shared = ctx.settings.shared()?.value;
  const inbox = (x: Task) => (shared && x.awaits ? path.join(shared, "inbox", x.awaits.folder) : undefined);
  await subMenu(ctx, lang, () => {
    const tree = Tree.open(root, ctx.env);
    const waiting = tree.list<Task>("task").filter((x) => x.state === "waiting");
    if (!waiting.length) return { title: t("ui.waiting.none"), items: [] };
    const shown = waiting.slice(0, SHOWN);
    const text: string[] = [t("ui.waiting.title", { n: waiting.length })];
    for (const [k, x] of shown.entries()) {
      text.push("", ` ${k + 1}. ${x.what}`);
      if (x.awaits) {
        const b = tree.get<RecordSet>(x.awaits.recordset);
        text.push(`    ${t("ui.waiting.images", { images: x.awaits.images, book: b?.title ?? x.awaits.recordset })}${b?.url ? ` · ${b.url}` : ""}`);
        text.push(`    ${t("ui.wait.save", { dir: `${ctx.display(inbox(x) ?? `inbox/${x.awaits.folder}`)}${path.sep}` })}`);
      } else text.push(`    ${t("ui.waiting.do", { what: x.waitingOn || t("ui.waiting.ask") })}`);
    }
    if (shown.some((x) => x.awaits)) text.push("", t("ui.wait.how1"), t("ui.wait.how2"));
    if (waiting.length > SHOWN) text.push("", t("ui.waiting.more", { n: waiting.length - SHOWN }));
    const items: Item[] = shown.map((x, k) =>
      x.awaits
        ? {
            key: String(k + 1),
            label: t("ui.waiting.folder", { k: k + 1 }),
            act: async () => {
              const dir = inbox(x);
              if (dir) openForUser(dir, ctx.env);
              out(t("ui.waiting.opened", { dir: dir ? ctx.display(dir) : `inbox/${x.awaits!.folder}` }));
            },
          }
        : {
            key: String(k + 1),
            label: t("ui.waiting.answer", { k: k + 1, what: truncate(x.what, 60) }),
            act: async () => {
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
            },
          },
    );
    return { title: `${text.join("\n")}\n\n${t("ui.waiting.pick")}`, items };
  });
}
