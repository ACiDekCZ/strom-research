// The desktop apps of the agents — the easiest way in for a person who has
// never used an AI agent: no terminal, the agent in a window of its own.
// strom finds them (by name, or by the link they open on Windows and Linux),
// and opens a conversation in one with a link: the tree folder and the first
// message filled in. The person confirms the folder and sends the message.
//
//   Claude (Anthropic)   claude://code/new?folder=…&q=…      the Code tab, a local session
//   ChatGPT / Codex      codex://new?path=…&prompt=…
//   OpenCode             opencode://new?cwd=…&q=…
//
// Antigravity has an app too, but no known link that opens a conversation:
// strom talks to it in the terminal (agy).

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { userHome } from "./paths.ts";
import { AGENTS, findAgent, which } from "./which.ts";

export interface DesktopApp {
  agent: string;
  /** The app's name, as the user sees it. */
  name: string;
  /** The link scheme it registers. */
  scheme: string;
  /** Its bundle on macOS (any of these). */
  mac: string[];
  /** Its program on Linux, when there is one. */
  linux?: string;
  /** The link that opens a conversation in a folder with a first message (not sent: the person sends it). */
  link: (folder: string, message: string) => string;
}

const q = encodeURIComponent;

export const DESKTOP_APPS: Record<string, DesktopApp> = {
  claude: { agent: "claude", name: "Claude", scheme: "claude", mac: ["Claude.app"], linux: "claude-desktop", link: (f, m) => `claude://code/new?folder=${q(f)}&q=${q(m)}` },
  codex: { agent: "codex", name: "ChatGPT (Codex)", scheme: "codex", mac: ["Codex.app", "ChatGPT.app"], link: (f, m) => `codex://new?path=${q(f)}&prompt=${q(m)}` },
  opencode: { agent: "opencode", name: "OpenCode", scheme: "opencode", mac: ["OpenCode.app"], link: (f, m) => `opencode://new?cwd=${q(f)}&q=${q(m)}` },
};

const seen = new Map<string, boolean>();

/** Is this agent's desktop app on this computer? (STROM_APP_DIRS: folders to look in instead — tests.) */
export function hasDesktopApp(agent: string, env: Env, platform: NodeJS.Platform = process.platform): boolean {
  const app = DESKTOP_APPS[agent];
  if (!app) return false;
  const key = `${agent}|${platform}|${env.STROM_APP_DIRS ?? ""}|${env.HOME ?? env.USERPROFILE ?? ""}`;
  const known = seen.get(key);
  if (known !== undefined) return known;
  let found = false;
  if (env.STROM_APP_DIRS !== undefined) found = env.STROM_APP_DIRS.split(path.delimiter).some((d) => d && app.mac.some((n) => fs.existsSync(path.join(d, n))));
  else if (platform === "darwin") found = ["/Applications", path.join(userHome(env), "Applications")].some((d) => app.mac.some((n) => fs.existsSync(path.join(d, n))));
  else if (platform === "win32") {
    // An installed app registers its link for the user or for everyone.
    found = ["HKCU", "HKLM"].some((root) => spawnSync("reg", ["query", `${root}\\Software\\Classes\\${app.scheme}`], { stdio: "ignore", windowsHide: true }).status === 0);
  } else {
    if (app.linux && which(app.linux, env, platform)) found = true;
    else {
      const r = spawnSync("xdg-mime", ["query", "default", `x-scheme-handler/${app.scheme}`], { encoding: "utf8", env: env as NodeJS.ProcessEnv });
      found = r.status === 0 && Boolean(r.stdout?.trim());
    }
  }
  seen.set(key, found);
  return found;
}

/** An agent on this computer: its CLI, its desktop app, or both. */
export interface AgentHere {
  id: string;
  cli: boolean;
  app: boolean;
}

/** The agents strom can drive that are on this computer, in strom's order. */
export function agentsHere(env: Env, platform: NodeJS.Platform = process.platform): AgentHere[] {
  return AGENTS.map((a) => ({ id: a.id as string, cli: Boolean(findAgent(a.command, env, platform)), app: hasDesktopApp(a.id, env, platform) })).filter((a) => a.cli || a.app);
}

/** Where the person talks with the agent: its desktop app or the terminal. */
export type Where = "app" | "terminal";

/**
 * The user's choice, else the app when it is there (the easiest way), else
 * the terminal. An agent without an app, or an app strom cannot open, is the
 * terminal whatever the choice.
 */
export function whereToTalk(agent: string, chosen: string | undefined, env: Env): Where {
  const here = agentsHere(env).find((a) => a.id === agent);
  if (!here?.app) return "terminal";
  if (!here.cli) return "app";
  return chosen === "terminal" ? "terminal" : "app";
}

/** Is strom run by an agent inside a desktop app? (Claude Code says where it runs.) */
export function inDesktopApp(env: Env): boolean {
  return /desktop/i.test(env.CLAUDE_CODE_ENTRYPOINT ?? "");
}
