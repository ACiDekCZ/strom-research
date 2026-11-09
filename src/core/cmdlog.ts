// The journal of commands (spec 070 K1.2, K3.3): every command that ended with an error, and under an agent every
// command, one line each — when, which command, its arguments masked (core/redact.ts: never a name, a place or a
// note), how it ended, the error's message masked, who ran it. strom error reads it; nothing else does.
//
// Always in strom's settings folder, never in a research (a command writes nothing there it was not asked to, and
// --dry-run writes nothing anywhere: such a command is never noted). Each line of a research carries its key — a
// stable hash of the research's folder, never its name or path — so strom error takes the research's own. It keeps
// itself small: past its size its newest half stays.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Env } from "./paths.ts";
import { configDir } from "./paths.ts";
import { detectAgent } from "./which.ts";

export const COMMAND_LOG = "commands.jsonl";
/** Past this size the journal keeps its newest half. */
export const COMMAND_LOG_BYTES = 256 * 1024;

export interface CommandRecord {
  at: string;
  /** The command's words (person add, fetch). */
  cmd: string;
  /** Its arguments and options, masked. */
  args: string[];
  exit: number;
  /** The error's code (strom's own), when it ended with one. */
  code?: string;
  /** The error's message, masked. */
  error?: string;
  /** The agent that ran it (claude, codex …), its worker and session. */
  agent?: string;
  worker?: string;
  session?: string;
  ms?: number;
  /** The research it ran in: its key (treeKey), never a name or a path. */
  tree?: string;
}

/** Where the journal is: strom's settings folder, for every research. */
export function commandLogFile(env: Env): string {
  return path.join(configDir(env), COMMAND_LOG);
}

/** A research's key in the journal: a stable hash of its folder (the same folder through a link, any case on Windows). */
export function treeKey(root: string): string {
  let real = path.resolve(root);
  try {
    real = fs.realpathSync.native(real);
  } catch {
    // as it is
  }
  if (process.platform === "win32") real = real.toLowerCase();
  return crypto.createHash("sha256").update(real).digest("hex").slice(0, 16);
}

/** Which session of an agent a command is of: strom run's, the agent's own conversation, else none known. */
export function agentSessionOf(env: Env): string | undefined {
  return env.STROM_SESSION || env.CLAUDE_CODE_SESSION_ID || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID || env.GROK_SESSION_ID || env.OPENCODE_SESSION_ID || undefined;
}

/** One command noted (never throws: a journal not written changes nothing of the command). */
export function noteCommand(env: Env, root: string | undefined, rec: Omit<CommandRecord, "agent" | "worker" | "session" | "tree">): void {
  try {
    const file = commandLogFile(env);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const agent = detectAgent(env);
    const full: CommandRecord = {
      ...rec,
      ...(root ? { tree: treeKey(root) } : {}),
      ...(agent ? { agent } : {}),
      ...(env.STROM_WORKER ? { worker: env.STROM_WORKER } : {}),
      ...(agentSessionOf(env) ? { session: agentSessionOf(env) } : {}),
    };
    fs.appendFileSync(file, JSON.stringify(full) + "\n");
    trim(file);
  } catch {
    // not noted
  }
}

function trim(file: string): void {
  const size = fs.statSync(file).size;
  if (size <= COMMAND_LOG_BYTES) return;
  const text = fs.readFileSync(file, "utf8");
  const keep = text.slice(text.length - Math.floor(COMMAND_LOG_BYTES / 2));
  const from = keep.indexOf("\n");
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, from >= 0 ? keep.slice(from + 1) : "");
  fs.renameSync(tmp, file);
}

/** The commands noted since a time, oldest first (lines not read are left out); with a research's root, its own only. */
export function readCommands(file: string, sinceMs = 0, root?: string): CommandRecord[] {
  const key = root ? treeKey(root) : undefined;
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const out: CommandRecord[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as CommandRecord;
      if (typeof r.at !== "string" || typeof r.cmd !== "string") continue;
      if (key && r.tree !== key) continue;
      if (Date.parse(r.at) >= sinceMs) out.push(r);
    } catch {
      // a line cut short
    }
  }
  return out;
}
