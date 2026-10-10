// What a Claude Code session strom started did with its context, read from Claude Code's own transcript on this
// computer: the tokens of each request, the names of the tools it used and the files it read — never a word of the
// conversation. It is how strom sees what nothing else shows it: the context cleared mid-session and files opened
// again after it (M3: the share of the Reads after the first clear that open a file read before a clear), and what
// each subagent (a scan reader) cost.
//
// The transcript is Claude Code's internal format and changes with its versions, so everything here is tolerant: a
// file not found, a field missing or renamed, a line cut short — that part is "unknown" or left out, never an error.
// It only reads; it writes nothing anywhere. The setting tune.transcripts off: nothing is read at all.
//
// Where Claude Code keeps it: <CLAUDE_CONFIG_DIR, else ~/.claude>/projects/<the session's folder as a slug>/<uuid>.jsonl,
// its subagents in <slug>/<uuid>/subagents/agent-<id>.jsonl (older versions kept them in the main file, marked
// isSidechain). One line per content block of a response: the lines of one response share message.id and repeat its
// usage (the last one carries the final output count).

import fs from "node:fs";
import path from "node:path";
import { userHome, type Env } from "./paths.ts";
import { eachLineOf } from "./lines.ts";
import type { Settings } from "./config.ts";

/** A drop of the context between two requests of one agent larger than this is a clear (or a compaction). */
export const CLEAR_DROP = 15_000;

/** The tokens of requests, summed. The split of the cache writes by lifetime is unknown where no request gave it. */
export interface TranscriptUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h: number | "unknown";
  cacheWrite5m: number | "unknown";
}

/** The context dropped at a request: its size before (the request before) and at it. */
export interface TranscriptClear {
  /** The index of the request (in the order of the agent's requests) whose context was the smaller one. */
  request: number;
  before: number;
  after: number;
}

/** One file the agent read (the Read tool), as many times as it did. */
export interface TranscriptRead {
  /** The path as the agent gave it first. */
  path: string;
  count: number;
  /** The request of its first Read. */
  first: number;
  /** Its Reads after the first clear. */
  afterClear: number;
  /** Its Reads that opened it again after a clear it had been read before. */
  reopened: number;
}

/** M3 of one agent: of the Reads after its first clear, how many opened again a file read before a clear. */
export interface TranscriptReopen {
  /** All Reads of the agent. */
  reads: number;
  /** Its Reads after the first clear. */
  afterClear: number;
  /** Those that opened again a file read before the latest clear preceding them. */
  reopened: number;
  /** reopened / afterClear; 0 with nothing read after a clear (or no clear). */
  share: number;
}

/** What one agent (the main one, or a subagent) did with its context. */
export interface AgentTranscript {
  /** The model it reported last (unknown: not said). */
  model: string | "unknown";
  /** Its requests (responses of the model), in order. */
  requests: number;
  usage: TranscriptUsage;
  /** The size of its context at each request (input + cache read + cache write); null where the request said none. */
  context: (number | null)[];
  clears: TranscriptClear[];
  /** How many times it called each tool. */
  tools: Record<string, number>;
  reads: TranscriptRead[];
  /** M3; unknown when no request said its context (a clear could not be seen). */
  reopen: TranscriptReopen | "unknown";
}

export interface SubagentTranscript extends AgentTranscript {
  /** Its id as Claude Code names its file (agent-<id>.jsonl), or the agentId of an older transcript's lines. */
  id: string;
}

export interface ClaudeTranscript {
  /** ok: read; off: tune.transcripts off, nothing read; missing: no transcript of that session here. */
  status: "ok" | "off" | "missing";
  /** The main transcript read. */
  file?: string;
  main: AgentTranscript | "unknown";
  subagents: SubagentTranscript[] | "unknown";
  /** The main agent and its subagents together. */
  total: TranscriptUsage | "unknown";
  /** Lines that could not be read (cut short, not JSON, not an object). */
  skipped: number;
}

export interface TranscriptOptions {
  /** The folder the session was started in (the tree's folder): Claude Code files its transcripts by it. */
  cwd: string;
  /** The home folder (default: HOME/USERPROFILE of env, else the system's). */
  home?: string;
  /** CLAUDE_CONFIG_DIR, HOME (default: process.env). */
  env?: Env;
  /** tune.transcripts of these settings: off → nothing read. */
  settings?: Settings;
  /** Said outright (wins over settings). */
  enabled?: boolean;
}

const UNKNOWN: ClaudeTranscript = { status: "missing", main: "unknown", subagents: "unknown", total: "unknown", skipped: 0 };

/** A session id strom gives Claude Code (--session-id): a UUID, nothing else (never a path). */
const SESSION_ID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/** A subagent's transcript in its folder. */
const SUBAGENT_FILE = /^agent-(.+)\.jsonl$/;

/** Claude Code's own folder: CLAUDE_CONFIG_DIR, else ~/.claude. */
export function claudeDir(env: Env, home?: string): string {
  return env.CLAUDE_CONFIG_DIR ? path.resolve(env.CLAUDE_CONFIG_DIR) : path.join(home ?? userHome(env), ".claude");
}

/**
 * The name Claude Code gives the folder of a project's transcripts: every character but an ASCII letter or digit a
 * dash ("/Users/x/My Tree" → "-Users-x-My-Tree", "C:\Users\x" → "C--Users-x"). Deliberately ASCII and by UTF-16 unit,
 * as Claude Code does it — this reproduces its name, it does not match anybody's text. A name it made longer than 200
 * keeps its first 200 and a hash of its own: found by searching (transcriptFile).
 */
export function projectSlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

/** The transcript of a session: under its folder's slug (as written, NFC, NFD), else in whichever project holds it. */
export function transcriptFile(uuid: string, opts: TranscriptOptions): string | undefined {
  if (!SESSION_ID.test(uuid)) return undefined;
  const projects = path.join(claudeDir(opts.env ?? process.env, opts.home), "projects");
  const name = `${uuid}.jsonl`;
  const slugs = new Set([projectSlug(opts.cwd), projectSlug(opts.cwd.normalize("NFC")), projectSlug(opts.cwd.normalize("NFD"))]);
  for (const slug of slugs) {
    const f = path.join(projects, slug, name);
    if (isFile(f)) return f;
  }
  // another spelling of the folder (a link resolved, /private/tmp, a long name with its hash): the id is unique
  let dirs: string[];
  try {
    dirs = fs.readdirSync(projects);
  } catch {
    return undefined;
  }
  for (const d of dirs) {
    const f = path.join(projects, d, name);
    if (isFile(f)) return f;
  }
  return undefined;
}

/** Is tune.transcripts on (the default)? */
function enabled(opts: TranscriptOptions): boolean {
  if (opts.enabled !== undefined) return opts.enabled;
  return opts.settings ? opts.settings.tuneTranscripts() : true;
}

/**
 * What a Claude Code session strom started did with its context: its transcript (and its subagents') read for the
 * tokens of each request, the tools and the files read. Never throws; never returns a word of the conversation.
 */
export function claudeTranscript(uuid: string, opts: TranscriptOptions): ClaudeTranscript {
  if (!enabled(opts)) return { ...UNKNOWN, status: "off" };
  try {
    const file = transcriptFile(uuid, opts);
    if (!file) return { ...UNKNOWN };
    const main = readAgents(file);
    if (!main) return { ...UNKNOWN };
    let skipped = main.skipped;
    const own = main.agents.get(MAIN);
    const mainAgent = summarize(own ?? newAgent());
    // the subagents: their own files, else (older transcripts) their lines in the main one
    let subagents: SubagentTranscript[] | "unknown" = [];
    for (const [id, a] of main.agents) if (id !== MAIN) subagents.push({ id, ...summarize(a) });
    const dir = path.join(path.dirname(file), uuid, "subagents");
    let names: string[] = [];
    try {
      names = fs.readdirSync(dir);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") subagents = "unknown";
    }
    if (subagents !== "unknown")
      for (const n of names.sort()) {
        const m = SUBAGENT_FILE.exec(n);
        if (!m) continue;
        const read = readAgents(path.join(dir, n), true);
        if (!read) continue;
        skipped += read.skipped;
        const a = read.agents.get(MAIN);
        if (a) subagents.push({ id: m[1]!, ...summarize(a) });
      }
    const total = subagents === "unknown" ? "unknown" : sumUsage([mainAgent.usage, ...subagents.map((s) => s.usage)]);
    return { status: "ok", file, main: mainAgent, subagents, total, skipped };
  } catch {
    return { ...UNKNOWN };
  }
}

// --- reading -------------------------------------------------------------------------------------------------------

const MAIN = "\u0000main";

interface Request {
  usage?: RawUsage;
  model?: string;
  /** Said by Claude Code itself, not the model ("<synthetic>": a limit reached, an error): no context of its own. */
  synthetic?: true;
  tools: { id?: string; name: string; readPath?: string }[];
}

interface RawUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  cacheWrite1h?: number;
  cacheWrite5m?: number;
}

interface Agent {
  /** Requests by message id, in the order first seen. */
  requests: Map<string, Request>;
}

function newAgent(): Agent {
  return { requests: new Map() };
}

/** The agents of one transcript file (the main one, and subagents of an older transcript); undefined: no such file. */
function readAgents(file: string, wholeIsOne = false): { agents: Map<string, Agent>; skipped: number } | undefined {
  const agents = new Map<string, Agent>();
  let skipped = 0;
  let anon = 0;
  const ok = eachLine(file, (line) => {
    // only the model's responses carry what is read here; nothing else is even parsed
    if (!line.includes('"assistant"')) return;
    let e: unknown;
    try {
      e = JSON.parse(line);
    } catch {
      skipped++;
      return;
    }
    if (!isObject(e)) return void skipped++;
    if (e.type !== "assistant") return;
    const msg = e.message;
    if (!isObject(msg)) return;
    const who = wholeIsOne || e.isSidechain !== true ? MAIN : typeof e.agentId === "string" && e.agentId ? e.agentId : "sidechain";
    let agent = agents.get(who);
    if (!agent) agents.set(who, (agent = newAgent()));
    const key = typeof msg.id === "string" ? msg.id : typeof e.requestId === "string" ? e.requestId : `\u0000${anon++}`;
    let req = agent.requests.get(key);
    if (!req) agent.requests.set(key, (req = { tools: [] }));
    const usage = rawUsage(msg.usage);
    if (usage) req.usage = usage; // the last line of a response carries its final counts
    if (typeof msg.model === "string" && msg.model && !msg.model.startsWith("<")) req.model = msg.model;
    else if (typeof msg.model === "string" && msg.model.startsWith("<")) req.synthetic = true;
    if (Array.isArray(msg.content))
      for (const b of msg.content) {
        if (!isObject(b) || b.type !== "tool_use" || typeof b.name !== "string") continue;
        const id = typeof b.id === "string" ? b.id : undefined;
        if (id && req.tools.some((t) => t.id === id)) continue;
        const input = isObject(b.input) ? b.input : undefined;
        const readPath = b.name === "Read" && typeof input?.file_path === "string" && input.file_path ? input.file_path : undefined;
        req.tools.push({ ...(id ? { id } : {}), name: b.name, ...(readPath ? { readPath } : {}) });
      }
  });
  return ok ? { agents, skipped } : undefined;
}

/** The counts of one request's usage, each only when it is a number. */
function rawUsage(u: unknown): RawUsage | undefined {
  if (!isObject(u)) return undefined;
  const out: RawUsage = {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
  const set = (k: keyof RawUsage, v: unknown) => {
    const n = num(v);
    if (n !== undefined) out[k] = n;
  };
  set("input", u.input_tokens);
  set("output", u.output_tokens);
  set("cacheRead", u.cache_read_input_tokens);
  set("cacheWrite", u.cache_creation_input_tokens);
  if (isObject(u.cache_creation)) {
    set("cacheWrite1h", u.cache_creation.ephemeral_1h_input_tokens);
    set("cacheWrite5m", u.cache_creation.ephemeral_5m_input_tokens);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * The size of the context a request was given: what it read new, from the cache and wrote to it. None for a message
 * Claude Code made itself (a limit reached: "<synthetic>") or one that says nothing was given (0) — no clear.
 */
function contextOf(u: RawUsage | undefined, synthetic = false): number | null {
  if (synthetic || !u || (u.input === undefined && u.cacheRead === undefined && u.cacheWrite === undefined)) return null;
  const c = (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
  return c > 0 ? c : null;
}

function summarize(agent: Agent): AgentTranscript {
  const reqs = [...agent.requests.values()];
  const usage = sumUsage(reqs.map((r) => r.usage ?? {}));
  const context = reqs.map((r) => contextOf(r.usage, r.synthetic));
  // a clear: the context smaller by more than CLEAR_DROP than at the last request that said its own
  const clears: TranscriptClear[] = [];
  let last: number | null = null;
  context.forEach((c, i) => {
    if (c === null) return;
    if (last !== null && last - c > CLEAR_DROP) clears.push({ request: i, before: last, after: c });
    last = c;
  });
  const tools: Record<string, number> = {};
  const reads = new Map<string, TranscriptRead>();
  /** the request of each file's last Read */
  const lastRead = new Map<string, number>();
  const firstClear = clears[0]?.request;
  let readCount = 0;
  let afterClear = 0;
  let reopened = 0;
  reqs.forEach((r, i) => {
    // the latest clear at or before this request
    let clear: number | undefined;
    for (const c of clears) if (c.request <= i) clear = c.request;
    for (const t of r.tools) {
      tools[t.name] = (tools[t.name] ?? 0) + 1;
      if (!t.readPath) continue;
      readCount++;
      // the same file however its name was spelled (NFC, NFD, ./, ..): compared, never stored so
      const key = path.normalize(t.readPath).normalize("NFC");
      let rd = reads.get(key);
      if (!rd) reads.set(key, (rd = { path: t.readPath, count: 0, first: i, afterClear: 0, reopened: 0 }));
      rd.count++;
      if (firstClear !== undefined && i >= firstClear) {
        rd.afterClear++;
        afterClear++;
        const before = lastRead.get(key);
        if (clear !== undefined && before !== undefined && before < clear) {
          rd.reopened++;
          reopened++;
        }
      }
      lastRead.set(key, i);
    }
  });
  const known = context.some((c) => c !== null);
  const model = [...reqs].reverse().find((r) => r.model)?.model ?? "unknown";
  return {
    model,
    requests: reqs.length,
    usage,
    context,
    clears,
    tools,
    reads: [...reads.values()],
    reopen: known ? { reads: readCount, afterClear, reopened, share: afterClear ? reopened / afterClear : 0 } : "unknown",
  };
}

function sumUsage(list: (RawUsage | TranscriptUsage)[]): TranscriptUsage {
  const out: TranscriptUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheWrite1h: "unknown", cacheWrite5m: "unknown" };
  for (const u of list) {
    out.input += u.input ?? 0;
    out.output += u.output ?? 0;
    out.cacheRead += u.cacheRead ?? 0;
    out.cacheWrite += u.cacheWrite ?? 0;
    for (const k of ["cacheWrite1h", "cacheWrite5m"] as const) {
      const v = u[k];
      if (typeof v === "number") out[k] = (out[k] === "unknown" ? 0 : out[k]) + v;
    }
  }
  return out;
}

// --- files ---------------------------------------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFile(f: string): boolean {
  try {
    return fs.statSync(f).isFile();
  } catch {
    return false;
  }
}

/**
 * Each line of a file that may hold a response of the model, read in pieces (a transcript can be large; a line over
 * the limit — an image — is skipped, never held whole); false when it cannot be opened. A read failing midway: what
 * was read so far stands.
 */
function eachLine(file: string, fn: (line: string) => void): boolean {
  let fd: number;
  try {
    fd = fs.openSync(file, "r");
  } catch {
    return false;
  }
  try {
    eachLineOf(
      (b) => {
        try {
          return fs.readSync(fd, b, 0, b.length, null);
        } catch {
          return 0;
        }
      },
      fn,
      { filter: (line) => line.includes('"assistant"') },
    );
    return true;
  } finally {
    fs.closeSync(fd);
  }
}
