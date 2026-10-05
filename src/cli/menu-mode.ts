// A research with an agent, or only an archive of the data from the Strom app:
// the menu's way to switch (the settings, and the archive's first item). The
// person decides here at their terminal; strom mode does it.

import type { Context } from "./context.ts";
import { agentReady, pause, translator, type Run } from "./menu-parts.ts";
import { offerAgent } from "./fixes.ts";
import { agentsHere } from "../core/apps.ts";
import { Tree } from "../core/tree.ts";
import { modeOf, type Mode } from "../core/mode.ts";
import type { Task } from "../core/model.ts";

/** Switch to `to`: what changes said and asked first; on to an agent, one is got when none is here. */
export async function switchTo(ctx: Context, run: Run, lang: string, root: string, to: Mode): Promise<void> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  const tree = Tree.open(root, ctx.env);
  if (modeOf(tree) === to) return;
  if (!(await ctx.confirm(t(to === "archive" ? "ui.consent.mode.archive" : "ui.consent.mode.research", { name: tree.config.name }), false))) return;
  const held = () => Tree.open(root, ctx.env).list<Task>("task").filter((x) => x.heldBy === "archive").length;
  const before = held();
  if ((await run(["mode", to], true)) !== 0) return pause(ctx, lang);
  out(t(to === "archive" ? "ui.mode.now.archive" : "ui.mode.now.research", { n: to === "archive" ? held() : before }));
  if (to === "research" && !agentReady(ctx, Tree.open(root, ctx.env).config)) {
    // no agent to work with: got now (the wizard when one is here, else the one offered)
    out(t("ui.mode.agent.get"));
    if (agentsHere(ctx.env).length) await run(["setup"]);
    else await offerAgent(ctx, out);
  }
  await pause(ctx, lang);
}

/** The settings' item: which it is now, the other one offered (0: back, nothing changes). */
export async function chooseMode(ctx: Context, run: Run, lang: string, root: string): Promise<void> {
  const t = translator(lang);
  const now = modeOf(Tree.open(root, ctx.env));
  ctx.io.stdout(t(now === "archive" ? "ui.mode.is.archive" : "ui.mode.is.research") + "\n");
  const i = await ctx.choose(t("ui.mode.pick"), [{ label: t("ui.mode.research") }, { label: t("ui.mode.archive") }], now === "archive" ? 1 : 0, { back: t("ui.browse.back") });
  if (i === undefined) return;
  await switchTo(ctx, run, lang, root, i === 1 ? "archive" : "research");
}
