// Find executables on PATH without running them (running an outdated,
// blocked binary can trigger OS malware warnings).

import fs from "node:fs";
import path from "node:path";
import type { Env } from "./paths.ts";
import { agentBinDirs } from "./install.ts";

export function which(cmd: string, env: Env, platform: NodeJS.Platform = process.platform): string | undefined {
  const dirs = (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean);
  const exts = platform === "win32" ? (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").map((e) => e.toLowerCase()) : [""];
  for (const dir of dirs)
    for (const ext of exts) {
      const file = path.join(dir, cmd + ext);
      try {
        const st = fs.statSync(file);
        if (st.isFile() && (platform === "win32" || (st.mode & 0o111) !== 0)) return file;
      } catch {
        // not here
      }
    }
  return undefined;
}

/** Agent CLIs strom can drive. */
export const AGENTS = [
  { id: "claude", command: "claude", name: "Claude Code" },
  { id: "codex", command: "codex", name: "OpenAI Codex CLI" },
  { id: "antigravity", command: "agy", name: "Antigravity CLI" },
  { id: "opencode", command: "opencode", name: "OpenCode" },
] as const;

/** Which AI agent's shell tool runs strom? (they set these variables) */
export function detectAgent(env: Env): string | undefined {
  if (env.CLAUDECODE) return "claude";
  if (Object.keys(env).some((k) => k.startsWith("ANTIGRAVITY_"))) return "antigravity";
  if (Object.keys(env).some((k) => k.startsWith("CODEX_"))) return "codex";
  if (env.OPENCODE === "1" || env.OPENCODE_PID) return "opencode";
  if (env.AI_AGENT) return env.AI_AGENT.toLowerCase();
  return undefined;
}

/** Is an agent running strom — its shell tool, or an agent strom run started? */
export function isAgent(env: Env): boolean {
  return Boolean(detectAgent(env) || env.STROM_SESSION);
}

/** An agent CLI on PATH, or where its installer puts it (a PATH not updated yet in this terminal). */
export function findAgent(cmd: string, env: Env, platform: NodeJS.Platform = process.platform): string | undefined {
  return which(cmd, env, platform) ?? which(cmd, { ...env, PATH: agentBinDirs(env, platform).join(path.delimiter), Path: undefined }, platform);
}
