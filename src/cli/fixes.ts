// Getting what strom needs, with the user's yes — shared by the setup wizard
// and strom doctor --fix. A person in their own terminal is asked there; the
// user of an agent is asked in a window of the system (the agent can neither
// see nor click it); no window: the user runs strom doctor --fix themselves.

import type { Context } from "./context.ts";
import { ui } from "./ui.ts";
import { isAgent } from "../core/which.ts";
import { gitVersion, resetCache } from "../core/git.ts";
import { gitWay, installOwnGit, linuxGitCommand, MINGIT } from "../core/deps.ts";
import { claudeInstaller, runInstaller } from "../core/install.ts";
import { agentsHere } from "../core/apps.ts";
import { researchUrl } from "../core/stromapp.ts";
import { openForUser } from "../core/open.ts";
import { NeedsConsentError, StromError } from "../core/errors.ts";

/** Is the person answering here, in this terminal? */
function personHere(ctx: Context): boolean {
  return ctx.interactive && !isAgent(ctx.env);
}

/** The user's yes to installing something: here, or in a window. False when they say no. */
async function yes(ctx: Context, question: string, key: string): Promise<boolean> {
  if (personHere(ctx)) return ctx.confirm(question, true);
  try {
    ctx.requireHuman(`install ${key}`, "strom doctor --fix", `install.${key}`, question);
    return true;
  } catch (e) {
    if (e instanceof StromError && !(e instanceof NeedsConsentError)) return false; // they said no
    throw e;
  }
}

/** Git: strom's own on Windows, Apple's tools on macOS, the package manager's on Linux. True when git works after it. */
export async function fixGit(ctx: Context, out: (line: string) => void): Promise<boolean> {
  const lang = ctx.uiLang();
  const way = gitWay();
  if (way === "command") {
    out(ui(lang, "ui.setup.git.manual", { command: linuxGitCommand() }));
    return false;
  }
  if (!(await yes(ctx, ui(lang, way === "download" ? "ui.fix.git.download" : "ui.fix.git.window", { mb: MINGIT.mb }), "git"))) return false;
  if (way === "download") {
    out(ui(lang, "ui.fix.git.downloading"));
    const ok = await installOwnGit(ctx.env, (why) => out(ui(lang, "ui.fix.failed", { detail: why })));
    if (ok) out(ui(lang, "ui.setup.git.ok", { version: gitVersion(ctx.env) ?? "" }));
    return ok;
  }
  // macOS: Apple's window installs the command line tools; it takes a few minutes.
  runInstaller({ command: "xcode-select", args: ["--install"] }, ctx.env);
  if (!personHere(ctx)) {
    out(ui(lang, "ui.fix.git.inwindow"));
    return false;
  }
  await ctx.ask(ui(lang, "ui.setup.git.wait"));
  resetCache();
  const v = gitVersion(ctx.env);
  if (v) out(ui(lang, "ui.setup.git.ok", { version: v }));
  return Boolean(v);
}

/** No agent on this computer: install Claude Code, show the page about agents, or later. Only a person here decides. */
export async function offerAgent(ctx: Context, out: (line: string) => void): Promise<void> {
  const lang = ctx.uiLang();
  out(ui(lang, "ui.setup.agent.none"));
  if (!personHere(ctx)) {
    out(ui(lang, "ui.setup.agent.manual", { url: researchUrl(lang, "agents") }));
    return;
  }
  const how = await ctx.choose(ui(lang, "ui.choose"), [{ label: ui(lang, "ui.setup.agent.install") }, { label: ui(lang, "ui.setup.agent.guide") }, { label: ui(lang, "ui.setup.agent.later") }], 0);
  if (how === 0) {
    runInstaller(claudeInstaller(), ctx.env);
    if (agentsHere(ctx.env).some((a) => a.id === "claude")) out(ui(lang, "ui.setup.agent.login"));
  } else if (how === 1) openForUser(researchUrl(lang, "agents"), ctx.env);
}
