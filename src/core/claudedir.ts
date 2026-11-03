// Claude Code's own folder — its login, its settings, its transcripts, the skill strom teaches it: CLAUDE_CONFIG_DIR
// of the environment, else the setting agent.claudeConfigDir (a second subscription's folder, say), else ~/.claude.
// One answer for everything strom does with Claude Code: every `claude` it starts (runs, conversations, the gate that
// asks its usage, a list of its models) gets the folder in its environment (claudeEnv), and what strom reads or writes
// of Claude Code's own (transcripts, its settings, its skill, its record of trusted folders) is read there.
// Only Claude Code: the other agents keep their own folders.
//
// Its default folder said outright (CLAUDE_CONFIG_DIR=~/.claude) is not the default to Claude Code: it looks for its
// login under another name (macOS: the keychain's "Claude Code-credentials-<hash>") and is not logged in there, its
// `claude -p /usage` a bare /cost (found 2026-11-03: a run stopped before its first session). So the default said is
// no folder said: every `claude` strom starts goes without the variable (forClaude), as the plain `claude` the person
// logged in with.

import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadUserConfig, Settings, type UserConfig } from "./config.ts";
import { expandHome, userHome, type Env } from "./paths.ts";
import { findAgent } from "./which.ts";

/** Is this folder Claude Code's own default, ~/.claude (with a separator at the end, ~ unexpanded; case aside where the disk ignores it)? */
export function isDefaultClaudeDir(dir: string, env: Env): boolean {
  const norm = (p: string) => {
    const r = path.resolve(p);
    return process.platform === "linux" ? r : r.toLowerCase();
  };
  return norm(expandHome(dir.trim(), env)) === norm(path.join(userHome(env), ".claude"));
}

/**
 * The folder said outright — CLAUDE_CONFIG_DIR, else agent.claudeConfigDir (absolute, ~ expanded) — or undefined:
 * Claude Code's own default (also when the default is what is said: isDefaultClaudeDir).
 */
export function claudeConfigSet(env: Env, config?: UserConfig): string | undefined {
  const r = new Settings(env, {}, config ?? loadUserConfig(env)).resolve("agent.claudeConfigDir");
  const v = r && typeof r.value === "string" ? r.value.trim() : "";
  return v && !isDefaultClaudeDir(v, env) ? v : undefined;
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

/** Does env say Claude Code's default folder outright (CLAUDE_CONFIG_DIR=~/.claude), which a `claude` of strom goes without? */
export function saysDefaultClaudeDir(env: Env): boolean {
  return Boolean(env.CLAUDE_CONFIG_DIR?.trim()) && isDefaultClaudeDir(env.CLAUDE_CONFIG_DIR!, env);
}

/**
 * The whole environment of a `claude` strom starts: env with the folder of the setting (claudeEnv), and without
 * CLAUDE_CONFIG_DIR when it says the default folder — a plain `claude`, logged in as the person logged in.
 */
export function forClaude<E extends Env>(env: E, config?: UserConfig): E {
  const out = { ...env, ...claudeEnv(env, config) } as E;
  if (saysDefaultClaudeDir(env)) delete (out as Env).CLAUDE_CONFIG_DIR;
  return out;
}

/** How to log Claude Code in for strom's `claude` (its folder said, when one is): what a person runs once. */
export function claudeLoginCommand(env: Env, config?: UserConfig): string {
  const set = claudeConfigSet(env, config);
  if (!set) return "claude";
  return process.platform === "win32" ? `claude (CLAUDE_CONFIG_DIR=${set})` : `CLAUDE_CONFIG_DIR='${set.replace(/'/g, "'\\''")}' claude`;
}

/** Is this command Claude Code's (claude, claude.cmd, a path to it)? */
export function isClaudeCommand(command: string): boolean {
  return /^claude(?:\.(?:cmd|exe|bat))?$/iu.test(path.basename(command));
}

/**
 * Is the `claude` strom starts logged in (`claude auth status`, in its environment: forClaude)? false only when it says
 * so; undefined when it cannot tell (an older Claude Code, a stand-in, no answer in time) — then nothing is decided by it.
 */
export function claudeLoggedIn(env: Env, command = "claude"): boolean | undefined {
  const program = findAgent(command, env) ?? command;
  const shell = process.platform === "win32" && /\.(cmd|bat)$/i.test(program);
  try {
    const r = spawnSync(shell ? `"${program}"` : program, ["auth", "status"], { env: forClaude(env) as NodeJS.ProcessEnv, encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "ignore"], windowsHide: true, shell });
    const said = JSON.parse((r.stdout ?? "").trim()) as { loggedIn?: unknown };
    return typeof said?.loggedIn === "boolean" ? said.loggedIn : undefined;
  } catch {
    return undefined;
  }
}
