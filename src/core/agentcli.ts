// An agent's CLI missing where its desktop app is here (Claude without Claude Code in the terminal): the conversation
// goes on in the app, but what strom starts by itself — strom run, the readers (strom read, reading from the Strom
// app), the fixes — starts the agent's CLI, which is not here. Said before anything is asked or estimated, with a code
// a program reads (agent.cli-missing) and what to do: the conversation in the app goes on, the person installs the CLI.
// The Claude Code a desktop app carries inside it is never used: strom starts only the CLI on PATH (or where its
// installer puts it).

import type { Env } from "./paths.ts";
import { StromError } from "./errors.ts";
import { AGENTS, findAgent } from "./which.ts";
import { DESKTOP_APPS, hasDesktopApp } from "./apps.ts";
import { PROFILES } from "../agents/profiles.ts";

/** The code of the error (and the bridge's `why` for the readers). */
export const CLI_MISSING = "agent.cli-missing";

/** Is this agent's CLI missing here? (An agent strom does not start, or the script runner: never.) */
export function cliMissing(agent: string, env: Env, platform: NodeJS.Platform = process.platform): boolean {
  const a = AGENTS.find((x) => x.id === agent);
  return !!a && !findAgent(a.command, env, platform);
}

/** Its CLI missing, its desktop app here: the conversation goes on in the app, nothing else does. */
export function appWithoutCli(agent: string, env: Env, platform: NodeJS.Platform = process.platform): boolean {
  return cliMissing(agent, env, platform) && hasDesktopApp(agent, env, platform);
}

/** The line that installs Claude Code in a terminal (what strom's installer runs: core/install.ts). */
export function claudeInstallLine(platform: NodeJS.Platform = process.platform): string {
  return platform === "win32" ? "irm https://claude.ai/install.ps1 | iex" : "curl -fsSL https://claude.ai/install.sh | bash";
}

/** How the person installs the agent's CLI: strom's own offer for Claude Code (strom doctor --fix), else its page. */
export function installWay(agent: string): string {
  return agent === "claude" ? "strom doctor --fix" : (PROFILES[agent]?.url ?? "the agent's page");
}

/**
 * The error of a command that starts the agent's CLI (`command`: strom run, strom read, …) where it is not here —
 * thrown before any question or estimate. English for an agent and a program; a person reads ui.error.agent.cli-missing.
 */
export function agentCliMissing(agent: string, env: Env, command: string, platform: NodeJS.Platform = process.platform): StromError {
  const a = AGENTS.find((x) => x.id === agent);
  const name = a?.name ?? agent;
  const cmd = a?.command ?? agent;
  const app = hasDesktopApp(agent, env, platform) ? DESKTOP_APPS[agent]?.name : undefined;
  const install = installWay(agent);
  const how = agent === "claude" ? `${install} (or in a terminal: ${claudeInstallLine(platform)})` : install;
  return new StromError(`${name} (${cmd}) is not installed here — ${command} starts it in the terminal`, {
    hint: app
      ? `the conversation in the ${app} app goes on: strom chat. Working alone, the readers and the work from the Strom app need ${name} in the terminal — the user installs it: ${how}`
      : `the user installs ${name}: ${how} — or another agent here: strom agents use <agent>`,
    code: CLI_MISSING,
    hintCode: app ? `${CLI_MISSING}.app` : undefined,
    params: { agent: name, cli: cmd, command, install, ...(app ? { app } : {}) },
  });
}

/** Throw agentCliMissing when the agent's CLI is not here (the script runner and agents strom does not start pass). */
export function requireAgentCli(agent: string, env: Env, command: string): void {
  if (cliMissing(agent, env)) throw agentCliMissing(agent, env, command);
}
