// Installing an AI agent with the user's yes (Claude Code, by its own official
// installer), visibly in the user's terminal. Git: core/deps.ts.

import { spawnSync } from "node:child_process";
import path from "node:path";
import type { Env } from "./paths.ts";
import { userHome } from "./paths.ts";

export interface Installer {
  command: string;
  args: string[];
}

/** Claude Code's official installer. */
export function claudeInstaller(platform: NodeJS.Platform = process.platform): Installer {
  if (platform === "win32") return { command: "powershell.exe", args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "irm https://claude.ai/install.ps1 | iex"] };
  return { command: "/bin/sh", args: ["-c", "curl -fsSL https://claude.ai/install.sh | bash"] };
}

/** Run an installer in the user's terminal; true when it ended well. */
export function runInstaller(inst: Installer, env: Env): boolean {
  if (env.STROM_NO_INSTALL === "1") return false;
  const r = spawnSync(inst.command, inst.args, { stdio: "inherit", env: env as NodeJS.ProcessEnv });
  return !r.error && r.status === 0;
}

/**
 * Folders where agent installers put their program, which the PATH of this
 * very process may not have yet (the installer changed it for new terminals).
 */
export function agentBinDirs(env: Env, platform: NodeJS.Platform = process.platform): string[] {
  const home = userHome(env);
  if (platform === "win32") return [path.join(home, ".local", "bin"), path.join(env.APPDATA ?? path.join(home, "AppData", "Roaming"), "npm")];
  return [path.join(home, ".local", "bin"), path.join(home, ".claude", "local")];
}
