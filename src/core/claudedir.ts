// Claude Code's own folder — its login, its settings, its transcripts, the skill strom teaches it: CLAUDE_CONFIG_DIR
// of the environment, else the setting agent.claudeConfigDir (a second subscription's folder, say), else ~/.claude.
// One answer for everything strom does with Claude Code: every `claude` it starts (runs, conversations, the gate that
// asks its usage, a list of its models) gets the folder in its environment (claudeEnv), and what strom reads or writes
// of Claude Code's own (transcripts, its settings, its skill, its record of trusted folders) is read there.
// Only Claude Code: the other agents keep their own folders.

import path from "node:path";
import { loadUserConfig, Settings, type UserConfig } from "./config.ts";
import { userHome, type Env } from "./paths.ts";

/** The folder said outright — CLAUDE_CONFIG_DIR, else agent.claudeConfigDir (absolute, ~ expanded) — or undefined: Claude Code's own default. */
export function claudeConfigSet(env: Env, config?: UserConfig): string | undefined {
  const r = new Settings(env, {}, config ?? loadUserConfig(env)).resolve("agent.claudeConfigDir");
  const v = r && typeof r.value === "string" ? r.value.trim() : "";
  return v || undefined;
}

/** Claude Code's folder: the one said (claudeConfigSet), else ~/.claude (`home`: another home folder than env's). */
export function claudeConfigDir(env: Env, config?: UserConfig, home?: string): string {
  return claudeConfigSet(env, config) ?? path.join(home ?? userHome(env), ".claude");
}

/** Claude Code's own record (.claude.json: trusted folders and the like): in its folder when one is said, else in the home folder. */
export function claudeStateFile(env: Env, config?: UserConfig): string {
  const set = claudeConfigSet(env, config);
  return set ? path.join(set, ".claude.json") : path.join(userHome(env), ".claude.json");
}

/**
 * What a `claude` strom starts gets in its environment besides env: CLAUDE_CONFIG_DIR of the setting, when env carries
 * none (env's own is inherited as it is — it wins). Nothing when neither says a folder.
 */
export function claudeEnv(env: Env, config?: UserConfig): Record<string, string> {
  if (env.CLAUDE_CONFIG_DIR) return {};
  const set = claudeConfigSet(env, config);
  return set ? { CLAUDE_CONFIG_DIR: set } : {};
}

/** Is this command Claude Code's (claude, claude.cmd, a path to it)? */
export function isClaudeCommand(command: string): boolean {
  return /^claude(?:\.(?:cmd|exe|bat))?$/iu.test(path.basename(command));
}
