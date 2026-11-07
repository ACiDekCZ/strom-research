// Getting what strom needs, with the user's yes — shared by the setup wizard
// and strom doctor --fix. A person in their own terminal is asked there; the
// user of an agent is asked in a window of the system (the agent can neither
// see nor click it); no window: the user runs strom doctor --fix themselves.

import type { Context } from "./context.ts";
import { ui } from "./ui.ts";
import { AGENTS, findAgent, isAgent } from "../core/which.ts";
import { gitVersion, resetCache } from "../core/git.ts";
import { gitWay, installOwnGit, linuxGitCommand, MINGIT } from "../core/deps.ts";
import { claudeInstaller, runInstaller } from "../core/install.ts";
import { agentsHere, DESKTOP_APPS } from "../core/apps.ts";
import { claudeInstallLine } from "../core/agentcli.ts";
import { PROFILES } from "../agents/profiles.ts";
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

/**
 * No agent on this computer: install Claude Code, show the page about agents, or only an archive for now (nothing
 * changes: a research waits for its agent, kept as an archive). Only a person here decides.
 */
export async function offerAgent(ctx: Context, out: (line: string) => void): Promise<void> {
  const lang = ctx.uiLang();
  out(ui(lang, "ui.setup.agent.none"));
  if (!personHere(ctx)) {
    out(ui(lang, "ui.setup.agent.manual", { url: researchUrl(lang, "agents") }));
    return;
  }
  const how = await ctx.choose(ui(lang, "ui.choose"), [{ label: ui(lang, "ui.setup.agent.install") }, { label: ui(lang, "ui.setup.agent.guide") }, { label: ui(lang, "ui.setup.agent.archive") }], 0);
  if (how === 0) {
    runInstaller(claudeInstaller(), ctx.env);
    if (agentsHere(ctx.env).some((a) => a.id === "claude")) out(ui(lang, "ui.setup.agent.login"));
  } else if (how === 1) {
    // the page, and its address in case no browser opens
    openForUser(researchUrl(lang, "agents"), ctx.env);
    out(ui(lang, "ui.setup.agent.manual", { url: researchUrl(lang, "agents") }));
  }
}

/**
 * The agent's CLI not here, its desktop app is (Claude without Claude Code in the terminal): said in one line — the
 * conversation goes on in the app, working alone and reading scans need the CLI. A person here chooses: install Claude
 * Code (strom's installer, as offerAgent does), go on with the conversation in the app (`chat`, where given), or not
 * now (0: nothing changes). Nobody here (--yes, no terminal, an agent): the line and how it is installed, nothing
 * installed. True when the CLI is here after it.
 */
export async function offerAgentCli(ctx: Context, out: (line: string) => void, agent: string, opts: { lang?: string; chat?: () => Promise<unknown>; said?: boolean } = {}): Promise<boolean> {
  const lang = opts.lang ?? ctx.uiLang();
  const a = AGENTS.find((x) => x.id === agent);
  if (!a || findAgent(a.command, ctx.env)) return true;
  const app = DESKTOP_APPS[agent]?.name ?? a.name;
  // (said already by the caller in its own words: the menu's item)
  if (!opts.said) out(ui(lang, "ui.setup.cli.apponly", { app, cli: a.name }));
  // strom installs Claude Code only (its installer); another agent's CLI: its page
  const ours = agent === "claude";
  const how = () => out(ours ? ui(lang, "ui.setup.cli.line", { cli: a.name, line: claudeInstallLine() }) : ui(lang, "ui.setup.agent.manual", { url: PROFILES[agent]?.url ?? "" }));
  if (!personHere(ctx)) {
    how();
    return false;
  }
  const choices = [...(ours ? [{ label: ui(lang, "ui.setup.cli.install", { cli: a.name }) }] : []), ...(opts.chat ? [{ label: ui(lang, "ui.setup.cli.chat", { app }) }] : [])];
  if (!choices.length) {
    how();
    return false;
  }
  const i = await ctx.choose(ui(lang, "ui.choose"), choices, 0, { back: ui(lang, "ui.setup.cli.later") });
  if (i === undefined) return false;
  if (!ours || i > 0) {
    await opts.chat!();
    return false;
  }
  const ended = runInstaller(claudeInstaller(), ctx.env);
  if (findAgent(a.command, ctx.env)) {
    out(ui(lang, "ui.setup.cli.done", { cli: a.name }));
    out(ui(lang, "ui.setup.agent.login"));
    return true;
  }
  out(ended ? ui(lang, "ui.setup.cli.newterminal", { cli: a.name }) : ui(lang, "ui.setup.cli.failed", { cli: a.name, line: claudeInstallLine() }));
  return false;
}
