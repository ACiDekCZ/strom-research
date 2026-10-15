// A research with an agent, or only an archive of the data from the Strom app:
// the menu's way to switch (the settings, and the archive's first item). The
// person decides here at their terminal; strom mode does it.

import type { Context } from "./context.ts";
import { agentReady, pause, translator, type Run } from "./menu-parts.ts";
import { offerAgent } from "./fixes.ts";
import { agentsHere } from "../core/apps.ts";
import { Tree } from "../core/tree.ts";
import { modeOf, type Mode } from "../core/mode.ts";
import { stateOf } from "../core/state.ts";
import type { UIKey } from "./ui.ts";
import type { Task } from "../core/model.ts";

/**
 * Switch to `to`: what changes said and asked first. On to research the agent first — got when the research's is not
 * here (the wizard when another one is, else the one offered); none got, the archive stays as it was, nothing written,
 * and a sentence says why. Research switched on where the setup's steps of an agent were never asked: offered then.
 */
export async function switchTo(ctx: Context, run: Run, lang: string, root: string, to: Mode): Promise<void> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  const tree = Tree.open(root, ctx.env);
  if (modeOf(tree) === to) return;
  let asked = false;
  if (to === "research" && !agentReady(ctx, tree.config)) {
    out(t("ui.mode.agent.get"));
    if (agentsHere(ctx.env).length) {
      await run(["setup", "--research"]);
      asked = true;
    } else await offerAgent(ctx, out);
    ctx.settings.reload();
    if (!agentReady(ctx, Tree.open(root, ctx.env).config)) {
      out(t("ui.mode.later"));
      return pause(ctx, lang);
    }
  }
  if (!(await ctx.confirm(t(to === "archive" ? "ui.consent.mode.archive" : "ui.consent.mode.research", { name: tree.config.name }), false))) return;
  const held = () => Tree.open(root, ctx.env).list<Task>("task").filter((x) => x.heldBy === "archive").length;
  const before = held();
  if ((await run(["mode", to], true)) !== 0) return pause(ctx, lang);
  out(t(to === "archive" ? "ui.mode.now.archive" : "ui.mode.now.research", { n: to === "archive" ? held() : before }));
  // the agent's steps of the setup (its model, where to talk, what it may do alone…) skipped while there was no agent
  // or an archive was chosen: offered now, Enter takes them
  if (to === "research" && !asked && agentStepsSkipped(ctx)) {
    if (await ctx.confirm(t("ui.mode.setup"), true)) await run(["setup", "--research"]);
  }
  await pause(ctx, lang);
}

/** The setup's steps of an agent never asked on this computer (stories: asked with them by every wizard before these). */
function agentStepsSkipped(ctx: Context): boolean {
  ctx.settings.reload();
  const c = ctx.settings.config;
  return !c.agentAsked && c.stories === undefined;
}

/** What the research of the tree is now, as the settings say it: research, waiting for its agent, or an archive. */
export function modeState(ctx: Context, root: string): UIKey {
  const state = stateOf(Tree.open(root, ctx.env));
  return state === "archive" ? "ui.mode.archive" : state === "waiting" ? "ui.mode.waiting" : "ui.mode.research";
}

/**
 * The settings' item: which this research is now, the other one offered, and what a new research on this computer is
 * (the setting mode, the person's choice) — no tree: that one alone. 0: back, nothing changes.
 */
export async function chooseMode(ctx: Context, run: Run, lang: string, root: string | undefined): Promise<void> {
  const t = translator(lang);
  const out = (line: string) => ctx.io.stdout(line + "\n");
  const tree = root ? Tree.open(root, ctx.env) : undefined;
  const state = tree ? stateOf(tree) : undefined;
  if (tree) out(t(state === "archive" ? "ui.mode.is.archive" : state === "waiting" ? "ui.mode.is.waiting" : "ui.mode.is.research"));
  ctx.settings.reload();
  const archiveNew = ctx.settings.config.mode === "archive";
  out(t("ui.mode.new.is", { state: t(archiveNew ? "ui.mode.archive" : "ui.mode.research") }));
  const ways = [
    ...(tree ? [{ label: t("ui.mode.this.research") }, { label: t("ui.mode.this.archive") }] : []),
    { label: t("ui.mode.new.research") },
    { label: t("ui.mode.new.archive") },
  ];
  const now = tree ? (state === "archive" ? 1 : 0) : archiveNew ? 1 : 0;
  const i = await ctx.choose(t("ui.mode.pick"), ways, now, { back: t("ui.browse.back") });
  if (i === undefined) return;
  if (tree && i < 2) return switchTo(ctx, run, lang, root!, i === 1 ? "archive" : "research");
  const archive = i - (tree ? 2 : 0) === 1;
  if (archive === archiveNew) return;
  if ((await run(archive ? ["config", "set", "mode", "archive"] : ["config", "unset", "mode"], true)) !== 0) return pause(ctx, lang);
  out(t("ui.mode.new.is", { state: t(archive ? "ui.mode.archive" : "ui.mode.research") }));
  await pause(ctx, lang);
}

/**
 * strom setup in an archive (the Strom app's link to the research's settings): research offered beside it — the archive
 * suggested (Enter keeps it), research switched on as the menu does it (the agent first). Nothing of an agent said.
 */
export async function offerResearch(ctx: Context, run: Run, root: string): Promise<void> {
  const tree = Tree.open(root, ctx.env);
  if (modeOf(tree) !== "archive") return;
  const lang = tree.lang;
  const t = translator(lang);
  const i = await ctx.choose(t("ui.setup.mode.ask", { name: tree.config.name }), [{ label: t("ui.setup.mode.keep") }, { label: t("ui.menu.archive.agent") }], 0, { back: t("ui.keep") });
  if (i === 1) await switchTo(ctx, run, lang, root, "research");
}
