// The report of a problem (strom error, spec 070): what strom can say of this computer, its installation and a
// research without anything of a person in it — read only, never written, never sent. The parts the command puts
// together (cli: doctor, the agents) come from commands/error.ts; this module reads the rest and writes the zip.
//
// Nothing here writes into a research: no lock, no commit, no migration, no cleanup of strom's own files (the fetches'
// notes are read as they lie — core/fetching.ts would tidy them away). git runs with --no-optional-locks.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { RECORD_TYPES, type RecordType } from "./model.ts";
import { runGit } from "./git.ts";
import { readJsonIfExists } from "./json.ts";
import { readCommands, commandLogFile, type CommandRecord } from "./cmdlog.ts";
import { liveRunning } from "./live.ts";
import { ZipWriter } from "./zip.ts";
import type { Env } from "./paths.ts";
import type { Masker } from "./redact.ts";
import { AGENTS, detectAgent, findAgent } from "./which.ts";
import { hasDesktopApp, inDesktopApp } from "./apps.ts";
import { codexInChatgptApp } from "./browserhelp.ts";
import { codexHookState } from "./codexhook.ts";
import { connectorsDir, loadConsents, readManifest } from "./connector.ts";
import { loadLogins } from "./logins.ts";
import { check } from "./check.ts";
import { installation } from "./self.ts";
import * as stromApp from "./stromapp.ts";
import type { Tree } from "./tree.ts";

/** Whom the report is sent to: the one place it is written (spec 070, Milan 2026-11-08). */
export const REPORT_ADDRESS = "milan@stromapp.info";

/** The areas --about adds details of. */
export const REPORT_ABOUT = ["fetch", "sync", "agent", "install", "windows"] as const;
export type ReportAbout = (typeof REPORT_ABOUT)[number];

/** Which problem, what to run (spec 070 K2.3): the help's table. */
const REPORT_PROBLEMS: [string, string][] = [
  ["a download stops, fails or waits long", "strom error --about fetch"],
  ["the Strom app: sync, the bridge, the tree not shown", "strom error --about sync"],
  ["the agent: a conversation or strom run went wrong", "strom error --about agent"],
  ["installing or updating strom", "strom error --about install"],
  ["anything on Windows", "strom error --about windows"],
  ["something else", "strom error"],
];
const problemTable = (rows: [string, string][]) => "What to run for which problem:\n" + rows.map(([p, c]) => `  ${p.padEnd(52)} ${c}`).join("\n");
/** The table in the help, and an archive's own (nothing of an agent). */
export const REPORT_TABLE = problemTable(REPORT_PROBLEMS);
export const REPORT_TABLE_ARCHIVE = problemTable(REPORT_PROBLEMS.filter(([, c]) => !c.endsWith("agent")));

/** Where the problem happened, as the person says it. */
export const REPORT_WHERE = ["chat", "terminal", "app", "unknown"] as const;
export type ReportWhere = (typeof REPORT_WHERE)[number];

const DAY = 24 * 3600_000;

/** --since: 2d, 1w, 12h, a date (YYYY-MM-DD); default 7 days. Undefined: not one of those. */
export function sinceOf(said: string | undefined, now = Date.now()): number | undefined {
  if (said === undefined || said === "") return now - 7 * DAY;
  const m = /^(\d{1,4})\s*([hdw])$/i.exec(said.trim());
  if (m) return now - Number(m[1]) * { h: 3600_000, d: DAY, w: 7 * DAY }[m[2]!.toLowerCase() as "h" | "d" | "w"];
  if (/^\d{4}-\d{2}-\d{2}$/.test(said.trim())) {
    const t = Date.parse(`${said.trim()}T00:00:00`);
    return Number.isFinite(t) ? t : undefined;
  }
  return undefined;
}

/** strom-error-2026-11-09-143005.zip (the local time). */
export function reportFileName(at = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `strom-error-${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}.zip`;
}

/** One area of the report: what it read, or the error that kept it from reading (the report is made all the same). */
export interface Area {
  name: string;
  ok: boolean;
  error?: string;
  data?: unknown;
}

/** An area read: an error of it is the area's, never the report's. */
export function readArea(name: string, masker: Masker, fn: () => unknown): Area {
  try {
    return { name, ok: true, data: fn() };
  } catch (e) {
    const code = (e as { code?: unknown }).code;
    return { name, ok: false, error: `${typeof code === "string" ? `${code}: ` : ""}${masker.text(String((e as Error)?.message ?? e)).slice(0, 400)}` };
  }
}

/** The free room of the disk a folder is on, in bytes (undefined: not known). */
export function freeBytes(dir: string): number | undefined {
  try {
    const s = fs.statfsSync(dir);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return undefined;
  }
}

/** The version a program says of itself (its first line), within a few seconds; none: undefined. */
export function versionOf(program: string, args = ["--version"], env: Env = process.env, timeoutMs = 4000): string | undefined {
  try {
    const r = spawnSync(program, args, { encoding: "utf8", timeout: timeoutMs, env: env as NodeJS.ProcessEnv, windowsHide: true, shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(program) });
    const first = `${r.stdout ?? ""}`.split(/\r?\n/).find((l) => l.trim());
    return r.status === 0 && first ? first.trim().slice(0, 120) : undefined;
  } catch {
    return undefined;
  }
}

/** The system: its kind and version, the processor, the language, the time zone. */
export function systemArea(env: Env): Record<string, unknown> {
  let release: string | undefined;
  try {
    release = typeof os.version === "function" ? os.version() : undefined;
  } catch {
    release = undefined;
  }
  return {
    os: process.platform,
    release: os.release(),
    ...(release ? { version: release } : {}),
    arch: process.arch,
    node: process.version,
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    langEnv: env.LC_ALL || env.LANG || undefined,
    cpus: os.cpus().length,
    memoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
  };
}

/** How many records of each kind a research has: the files of its data folders counted, none read. */
function counts(root: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [type, def] of Object.entries(RECORD_TYPES) as [RecordType, (typeof RECORD_TYPES)[RecordType]][]) {
    try {
      out[type] = fs.readdirSync(path.join(root, "data", def.dir)).filter((f) => f.endsWith(".json")).length;
    } catch {
      out[type] = 0;
    }
  }
  return out;
}

/** The size of a folder (its files), within a time; past it: what was counted, and that it was cut short. */
export function folderSize(dir: string, ms = 4000): { bytes: number; files: number; partial?: true } {
  const end = Date.now() + ms;
  let bytes = 0;
  let files = 0;
  const stack = [dir];
  while (stack.length) {
    if (Date.now() > end) return { bytes, files, partial: true };
    const d = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) {
        try {
          bytes += fs.statSync(p).size;
          files++;
        } catch {
          // gone meanwhile
        }
      }
    }
  }
  return { bytes, files };
}

/** git of a research: clean or not (how many files), its commits, when it was last written — never a message. */
export function gitArea(root: string): Record<string, unknown> {
  if (!fs.existsSync(path.join(root, ".git"))) return { repository: false };
  const run = (args: string[]) => runGit(root, ["--no-optional-locks", ...args]);
  const status = run(["status", "--porcelain", "--untracked-files=normal"]);
  if (status.status !== 0) throw new Error(`git status failed: ${status.stderr.trim().split("\n")[0] ?? ""}`);
  const changed = status.stdout.split("\n").filter((l) => l.trim());
  const count = run(["rev-list", "--count", "HEAD"]);
  const last = run(["log", "-1", "--format=%cI"]);
  return {
    repository: true,
    clean: changed.length === 0,
    uncommitted: changed.length,
    uncommittedData: changed.filter((l) => l.slice(3).startsWith("data/")).length,
    commits: count.status === 0 ? Number(count.stdout.trim()) : 0,
    ...(last.status === 0 && last.stdout.trim() ? { lastCommit: last.stdout.trim() } : {}),
  };
}

/** The research's settings that say nothing of a person: its schema, versions, language, mode. */
export function treeSettingsArea(root: string): Record<string, unknown> {
  const file = path.join(root, "strom.json");
  if (!fs.existsSync(file)) throw new Error("strom.json missing");
  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`strom.json unreadable: ${(e as Error).message.split("\n")[0]}`);
  }
  const pick = (k: string) => (cfg[k] === undefined ? {} : { [k]: cfg[k] });
  return {
    ...pick("schema"),
    ...pick("lang"),
    ...pick("mode"),
    ...pick("createdWith"),
    ...pick("migratedWith"),
    ...pick("created"),
    settled: Array.isArray(cfg.settled) ? (cfg.settled as unknown[]).length : 0,
  };
}

/** The fingerprint of a research: numbers only (spec 070 K1.2). */
export function fingerprintArea(root: string): Record<string, unknown> {
  const n = counts(root);
  const size = folderSize(root);
  let strom: { bytes: number; files: number; partial?: true } | undefined;
  try {
    strom = folderSize(path.join(root, ".strom"), 2000);
  } catch {
    strom = undefined;
  }
  return { counts: n, images: n.media ?? 0, size, ...(strom ? { stromFolder: strom } : {}), free: freeBytes(root) };
}

/** The lines of a text log since a time (lines "ISO …"), newest last, at most `max` bytes: the newest kept. */
function linesSince(file: string, sinceMs: number, max: number, mask: (line: string) => string): { lines: string[]; total: number; trimmed: number } {
  let text: string;
  try {
    const st = fs.statSync(file);
    // a big log: only its end read (what is newest)
    if (st.size > 4 * max) {
      const fd = fs.openSync(file, "r");
      try {
        const buf = Buffer.alloc(4 * max);
        fs.readSync(fd, buf, 0, buf.length, st.size - buf.length);
        text = buf.toString("utf8");
        text = text.slice(text.indexOf("\n") + 1);
      } finally {
        fs.closeSync(fd);
      }
    } else text = fs.readFileSync(file, "utf8");
  } catch {
    return { lines: [], total: 0, trimmed: 0 };
  }
  const all = text.split(/\r?\n/).filter((l) => {
    if (!l.trim()) return false;
    const at = Date.parse(/^(\S+)/.exec(l)?.[1] ?? "");
    return !Number.isFinite(at) || at >= sinceMs;
  });
  const out: string[] = [];
  let bytes = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    const m = mask(all[i]!);
    bytes += Buffer.byteLength(m) + 1;
    if (bytes > max) break;
    out.unshift(m);
  }
  return { lines: out, total: all.length, trimmed: all.length - out.length };
}

/** A line of a text log masked: its time and process kept, its text masked. */
function maskLine(masker: Masker): (line: string) => string {
  return (line) => {
    const m = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)(\s+\[\d+\])?\s?(.*)$/.exec(line);
    return m ? `${m[1]}${m[2] ?? ""} ${masker.text(m[3] ?? "")}` : masker.text(line);
  };
}

/** The JSON lines of a journal since a time, each passed through `pick` (what of it may go), the newest within `max` bytes. */
function jsonSince(file: string, sinceMs: number, max: number, pick: (r: Record<string, unknown>) => Record<string, unknown> | undefined): { records: Record<string, unknown>[]; total: number; trimmed: number } {
  const got = linesSince(file, 0, max * 4, (l) => l);
  const records: Record<string, unknown>[] = [];
  for (const l of got.lines) {
    try {
      const r = JSON.parse(l) as Record<string, unknown>;
      const at = Date.parse(String(r.at ?? r.time ?? r.started ?? ""));
      if (Number.isFinite(at) && at < sinceMs) continue;
      const p = pick(r);
      if (p) records.push(p);
    } catch {
      // a line cut short
    }
  }
  const out: Record<string, unknown>[] = [];
  let bytes = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    bytes += JSON.stringify(records[i]).length + 1;
    if (bytes > max) break;
    out.unshift(records[i]!);
  }
  return { records: out, total: records.length + got.trimmed, trimmed: records.length - out.length + got.trimmed };
}

/** strom's own values of a journal (a command, a connector's folder, a host, a state): kept as they are, swept at the end. */
const PLAIN = new Set(["at", "since", "until", "waitUntil", "cmd", "connector", "via", "status", "result", "decision", "host", "domain", "by", "worker", "session", "tool", "gate", "verdict", "signal", "then", "rs", "book", "recordset", "run", "task", "kind", "pid"]);

/** What of a record may go: numbers, booleans, IDs and strom's short words; any other text masked. */
function only(r: Record<string, unknown>, keep: readonly string[], masker: Masker, texts: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keep) {
    const v = r[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = texts.includes(k) ? masker.text(v.slice(0, 300)) : PLAIN.has(k) && /^[\p{L}\p{N}._:@/+-]{0,80}$/u.test(v) ? v : masker.args([v.slice(0, 120)])[0];
    else if (Array.isArray(v)) out[k] = v.length <= 20 && v.every((x) => typeof x === "number") ? v : v.length;
    else if (typeof v === "object") out[k] = numbersOf(v as Record<string, unknown>, masker);
  }
  return out;
}

/** An object of numbers (the hosts of a fetch: requests, pace, waits): its keys masked as words, its numbers kept. */
function numbersOf(v: Record<string, unknown>, masker: Masker, depth = 0): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v).slice(0, 40)) {
    const key = /^[a-z0-9.-]+$/i.test(k) ? masker.text(k) : masker.args([k])[0]!;
    if (typeof x === "number" || typeof x === "boolean") out[key] = x;
    else if (x && typeof x === "object" && !Array.isArray(x) && depth < 2) out[key] = numbersOf(x as Record<string, unknown>, masker, depth + 1);
  }
  return out;
}

const FETCH_KEYS = ["at", "cmd", "connector", "via", "book", "rs", "requests", "pages", "got", "located", "books", "later", "stopped", "status", "refused", "result", "hosts", "ms", "gain", "media", "by", "worker", "session", "host", "domain", "decision", "why", "advice", "n", "paceMs", "tool"] as const;
const GATE_KEYS = ["at", "run", "gate", "status", "signal", "verdict", "reason", "waitMs", "until", "hard", "task", "sessions", "costUsd", "then"] as const;

export interface LogLimits {
  live: number;
  gate: number;
  tidy: number;
  fetch: number;
  commands: number;
}

export const LOG_LIMITS: LogLimits = { live: 200 * 1024, gate: 100 * 1024, tidy: 40 * 1024, fetch: 400 * 1024, commands: 150 * 1024 };

/** The technical logs of a research since a time, masked, each within its size (the newest kept); what was left out said. */
export function logsArea(root: string, sinceMs: number, masker: Masker, limits: LogLimits = LOG_LIMITS): { logs: Record<string, unknown>; trimmed: Record<string, number> } {
  const s = path.join(root, ".strom");
  const live = linesSince(path.join(s, "live.log"), sinceMs, limits.live, maskLine(masker));
  const tidy = linesSince(path.join(s, "tidy.log"), sinceMs, limits.tidy, maskLine(masker));
  const gate = jsonSince(path.join(s, "gate.log"), sinceMs, limits.gate, (r) => only(r, GATE_KEYS, masker, ["reason"]));
  const fetch = jsonSince(path.join(s, "metrics", "fetch.jsonl"), sinceMs, limits.fetch, (r) => only(r, FETCH_KEYS, masker, ["stopped", "why", "advice"]));
  const trimmed: Record<string, number> = {};
  for (const [k, v] of Object.entries({ "live.log": live, "tidy.log": tidy, "gate.log": gate, "fetch.jsonl": fetch })) if (v.trimmed > 0) trimmed[k] = v.trimmed;
  return {
    logs: { "live.log": live.lines, "tidy.log": tidy.lines, "gate.log": gate.records, "fetch.jsonl": fetch.records },
    trimmed,
  };
}

/** The commands of the journal since a time (in a research its own, outside one every one), masked already when written. */
export function commandsArea(env: Env, root: string | undefined, sinceMs: number, masker: Masker, max = LOG_LIMITS.commands): { commands: CommandRecord[]; trimmed: number } {
  const all = readCommands(commandLogFile(env), sinceMs, root).sort((a, b) => a.at.localeCompare(b.at));
  const out: CommandRecord[] = [];
  // the research's key is a hash of its path (the user's name in it): in the report only "R1", "R2"… in the order first seen
  const labels = new Map<string, string>();
  for (const r of all) if (r.tree && !labels.has(r.tree)) labels.set(r.tree, `R${labels.size + 1}`);
  let bytes = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    const r = all[i]!;
    // masked when written; masked again, the research's words now known (a name the journal could not know then)
    const m: CommandRecord = { ...r, args: r.args.map((a) => masker.sweep(a)), ...(r.error ? { error: masker.sweep(r.error) } : {}), ...(r.tree ? { tree: labels.get(r.tree)! } : {}) };
    bytes += JSON.stringify(m).length + 1;
    if (bytes > max) break;
    out.unshift(m);
  }
  return { commands: out, trimmed: all.length - out.length };
}

/** The fetches running and ended lately (their notes read as they lie: never tidied away from here). */
export function fetchesArea(root: string, sinceMs: number, masker: Masker): { running: unknown[]; ended: unknown[] } {
  const dir = path.join(root, ".strom", "fetch");
  const running: unknown[] = [];
  const ended: unknown[] = [];
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return { running, ended };
  }
  const keep = ["at", "since", "recordset", "connector", "book", "registered", "missed", "stopped", "interrupted", "background", "session", "task", "worker", "exitCode", "waitUntil", "host", "pid"];
  for (const f of files) {
    const kind = /^(active|ended)-.*\.json$/.exec(f)?.[1];
    if (!kind) continue;
    const r = readJsonIfExists<Record<string, unknown>>(path.join(dir, f));
    if (!r) continue;
    const at = Date.parse(String(r.at ?? r.since ?? ""));
    if (kind === "ended" && Number.isFinite(at) && at < sinceMs) continue;
    const rec = { ...only(r, keep, masker, ["stopped"]), ...(Array.isArray(r.images) ? { images: r.images.length } : {}) };
    if (kind === "active") {
      let alive = false;
      try {
        if (typeof r.pid === "number") {
          process.kill(r.pid, 0);
          alive = true;
        }
      } catch (e) {
        alive = (e as NodeJS.ErrnoException).code === "EPERM";
      }
      running.push({ ...rec, alive });
    } else ended.push(rec);
  }
  return { running, ended };
}

/** The sessions of the agents since a time: when, how they ended, their numbers — never their summary or notes. */
export function sessionsArea(root: string, sinceMs: number, masker: Masker): { sessions: unknown[]; open: number } {
  const dir = path.join(root, "data", RECORD_TYPES.session.dir);
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return { sessions: [], open: 0 };
  }
  const out: Record<string, unknown>[] = [];
  let open = 0;
  for (const f of files) {
    const s = readJsonIfExists<Record<string, unknown>>(path.join(dir, f));
    if (!s) continue;
    if (s.state === "open") open++;
    const at = Date.parse(String(s.ended ?? s.started ?? ""));
    if (Number.isFinite(at) && at < sinceMs && s.state !== "open") continue;
    const m = (s.metrics ?? {}) as Record<string, unknown>;
    const nums: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(m)) if (typeof v === "number" || typeof v === "boolean") nums[k] = v;
    const id = typeof s.id === "string" ? s.id : f.replace(/\.json$/, "");
    out.push({
      id,
      state: s.state,
      ...(typeof s.task === "string" ? { task: s.task } : {}),
      ...(typeof s.agent === "string" ? { agent: s.agent } : {}),
      ...(typeof s.model === "string" ? { model: s.model } : {}),
      ...(typeof s.effort === "string" ? { effort: s.effort } : {}),
      ...(typeof s.strom === "string" ? { strom: s.strom } : {}),
      ...(typeof s.runner === "string" ? { runner: s.runner } : {}),
      ...(typeof s.endedBy === "string" ? { endedBy: s.endedBy } : {}),
      started: s.started,
      ...(s.ended ? { ended: s.ended } : {}),
      ...(Object.keys(nums).length ? { metrics: nums } : {}),
      ...runExit(root, id),
      ...runDenied(root, id, masker),
    });
  }
  out.sort((a, b) => String(a.started).localeCompare(String(b.started)));
  return { sessions: out.slice(-60), open };
}

/**
 * The commands the agent's permissions or sandbox refused in a run's session, as the run kept them beside its log
 * (.strom/runs/<session>.denied.json, commands/session.ts keepDenied: at most DENIED_KEPT, each cut to
 * DENIED_CHARS): each masked as every value going out, whether strom was the one refused, whether refused whole (K031).
 */
function runDenied(root: string, id: string, masker: Masker): { denied?: { command: string; strom: boolean; whole: boolean }[] } {
  try {
    const kept = readJsonIfExists<unknown>(path.join(root, ".strom", "runs", `${id}.denied.json`));
    if (!Array.isArray(kept)) return {};
    const denied = kept
      .filter((d): d is { command: string; strom?: unknown; whole?: unknown } => typeof d?.command === "string")
      .slice(0, DENIED_KEPT)
      // masked as a log's line (what is quoted one code, a path's parts, any word not strom's), then cut: the run keeps
      // more of it than the report shows, so a quote and a path are whole when masked (K031)
      .map((d) => ({ command: cutDenied(masker.text(cutDenied(d.command, DENIED_KEPT_CHARS))), strom: d.strom === true, whole: d.whole === true }));
    return denied.length ? { denied } : {};
  } catch {
    return {};
  }
}

/**
 * How many refused commands of a session are kept for strom error, and how long each in the report (K031: the report
 * stays small) — and how long each as the run keeps it (masked whole before it is cut for the report).
 */
export const DENIED_KEPT = 10;
export const DENIED_CHARS = 200;
export const DENIED_KEPT_CHARS = 2000;

/**
 * A refused command cut to `max` characters, "…" where it was cut: whole characters, never part of a word (a name cut
 * in half would no longer be known to the masker) nor of a masked word's code (‹3fa9c›) — any script.
 */
export function cutDenied(command: string, max = DENIED_CHARS): string {
  const chars = [...command];
  if (chars.length <= max) return command;
  const head = chars.slice(0, max - 1).join("");
  // (alternatives, not a class: Node 26's V8 misses a class of properties before $ when the last character is astral)
  const inWord = /(?:\p{L}|\p{M}|\p{N})$/u.test(head) && /^(?:\p{L}|\p{M}|\p{N})/u.test(chars[max - 1]!);
  return (inWord ? head.replace(/(?:\p{L}|\p{M}|\p{N})+$/u, "") : head).replace(/‹[0-9a-f]{0,5}$/u, "") + "…";
}

/** What strom wrote of a run's agent's end into its log (never the agent's own output): its exit code. */
function runExit(root: string, id: string): { exitCode?: number } {
  const file = path.join(root, ".strom", "runs", `${id}.log`);
  try {
    const st = fs.statSync(file);
    const fd = fs.openSync(file, "r");
    try {
      const n = Math.min(st.size, 16 * 1024);
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, st.size - n);
      const m = [...buf.toString("utf8").matchAll(/\[strom\][^\n]*exit code (-?\d+)/g)].at(-1);
      return m ? { exitCode: Number(m[1]) } : {};
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return {};
  }
}

/** The bridge to the Strom app: running or not, its version, when it started and ended, the last sync — never its address. */
export function bridgeArea(root: string, masker: Masker): Record<string, unknown> {
  const running = liveRunning(root);
  const last = readJsonIfExists<Record<string, unknown>>(path.join(root, ".strom", "live-last.json"));
  const ended = last?.ended && typeof last.ended === "object" ? (last.ended as Record<string, unknown>) : undefined;
  const syncDir = path.join(root, ".strom", "sync");
  let lastSync: string | undefined;
  let syncFiles = 0;
  try {
    for (const f of fs.readdirSync(syncDir)) {
      const st = fs.statSync(path.join(syncDir, f));
      syncFiles++;
      const at = st.mtime.toISOString();
      if (!lastSync || at > lastSync) lastSync = at;
    }
  } catch {
    // no sync yet
  }
  // the last error the bridge wrote down (masked)
  let lastError: string | undefined;
  try {
    const tail = linesSince(path.join(root, ".strom", "live.log"), 0, 64 * 1024, (l) => l).lines;
    const err = [...tail].reverse().find((l) => /error|failed|refused|cannot|denied/i.test(l));
    if (err) lastError = maskLine(masker)(err).slice(0, 400);
  } catch {
    // none
  }
  return {
    running: !!running,
    ...(running ? { version: running.version, started: running.started, pid: running.pid } : {}),
    ...(ended ? { lastEnded: { ...(typeof ended.kind === "string" ? { kind: ended.kind } : {}), ...(typeof ended.at === "string" ? { at: ended.at } : {}) } } : {}),
    ...(lastSync ? { lastSync } : {}),
    syncFiles,
    ...(lastError ? { lastError } : {}),
  };
}

/** The words of a research a report must never carry: its people's names, places, the titles of its books and sources. */
export function researchTerms(root: string, masker: Masker, ms = 5000): void {
  const end = Date.now() + ms;
  const read = (type: RecordType, fn: (r: Record<string, unknown>) => void) => {
    let files: string[];
    try {
      files = fs.readdirSync(path.join(root, "data", RECORD_TYPES[type].dir));
    } catch {
      return;
    }
    for (const f of files) {
      if (Date.now() > end) return;
      if (!f.endsWith(".json")) continue;
      const r = readJsonIfExists<Record<string, unknown>>(path.join(root, "data", RECORD_TYPES[type].dir, f));
      if (r) fn(r);
    }
  };
  const strong: string[] = [];
  const weak: string[] = [];
  const str = (v: unknown) => (typeof v === "string" ? [v] : []);
  read("person", (p) => {
    for (const n of [...((p.names as unknown[]) ?? []), ...((p.retractedNames as unknown[]) ?? [])]) {
      const x = (n ?? {}) as Record<string, unknown>;
      strong.push(...str(x.given), ...str(x.surname), ...str(x.prefix), ...str(x.suffix));
    }
    for (const e of (p.events as unknown[]) ?? []) strong.push(...str(((e ?? {}) as Record<string, unknown>).place));
  });
  read("place", (p) => {
    for (const n of (p.names as unknown[]) ?? []) strong.push(...str(((n ?? {}) as Record<string, unknown>).name));
    strong.push(...str(p.name));
  });
  read("recordset", (r) => weak.push(...str(r.title), ...str(r.place), ...str(r.parish)));
  read("source", (s) => weak.push(...str(s.title)));
  read("repository", (r) => weak.push(...str(r.name)));
  masker.addTerms(strong);
  masker.addTerms(weak, { weak: true });
}

/** The research's own name and folder: words never to carry either. */
export function treeNameTerms(root: string): string[] {
  const cfg = readJsonIfExists<{ name?: unknown }>(path.join(root, "strom.json"));
  return [path.basename(root), ...(typeof cfg?.name === "string" ? [cfg.name] : [])];
}

/** The zip: README.txt and report.json, and data.json only with the data the person agreed to (--with-data). */
export function writeReport(file: string, readme: string, report: unknown, data?: unknown): number {
  const z = new ZipWriter(file);
  try {
    const at = new Date();
    z.add("README.txt", Buffer.from(readme.replace(/\r?\n/g, process.platform === "win32" ? "\r\n" : "\n"), "utf8"), { mtime: at });
    z.add("report.json", Buffer.from(JSON.stringify(report, null, 2) + "\n", "utf8"), { mtime: at });
    if (data !== undefined) z.add("data.json", Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf8"), { mtime: at });
    z.close();
  } catch (e) {
    z.abort();
    throw e;
  }
  return fs.statSync(file).size;
}

// ── what the command adds (commands/error.ts): the settings, the agents, the connectors, the details of --about ──────

/** Where strom error was started from (spec 070 K3.2): an agent and its app, strom run, a person's terminal. */
export function launchedFrom(env: Env, tty: boolean): Record<string, unknown> {
  const agent = detectAgent(env);
  const run = !!env.STROM_SESSION || /^run-/.test(env.STROM_WORKER ?? "");
  let app: string | undefined;
  if (agent === "claude") app = inDesktopApp(env) ? "claude-desktop" : "claude-cli";
  else if (agent === "codex") app = codexInChatgptApp(env) ? "chatgpt-app" : "codex-cli";
  else if (agent) app = agent;
  return {
    by: run ? "strom-run" : agent ? "agent" : tty ? "terminal" : "script",
    ...(agent ? { agent } : {}),
    ...(app ? { app } : {}),
    ...(env.STROM_FOR_APP === "1" || env.STROM_APP_VERSION ? { stromApp: true } : {}),
  };
}

/** The settings that say nothing of a person (a whitelist: anything else of the settings never goes). */
const CONFIG_PLAIN = [
  "lang", "mode", "stromVersion", "lastVersion", "lastChannel", "npmChannel", "stories", "runGate", "archivePace", "readApp", "briefBudget", "runMinutes",
  "webPerHost", "readParallel", "queueStrategy", "queueOffLine", "queueOffLineShare", "queueSuggestLines", "queueSuggestTasks", "queueSuggestPersons",
  "connectorsConsent", "browserDownloads", "experimentsHistory", "experimentsHistoryPace", "experimentsHistoryPlaces", "experimentsPlaceHistory",
  "historyKinds", "historyAsked", "stromApp", "links", "shortcut", "appBrowser", "terminal", "updates", "excerptsQuality", "excerptsFor", "excerptsMb",
  "tuneTranscripts", "tuneAuto", "liveIdleMinutes", "stromAppFollow",
] as const;
/** …and those of the agents (never in an archive's report). */
const CONFIG_AGENT = ["agent", "agentAsked", "agentPermissions", "agentWhere", "agentRemote", "agentBrowser", "agentAddons"] as const;

/** strom's settings through the whitelist: plain values, counts of lists, never a path, a name or a key. */
export function configArea(config: Record<string, unknown>, o: { archive: boolean }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const plain = (v: unknown) => typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && /^[\p{L}\p{N} ._:+,/-]{0,60}$/u.test(v) && !/[\\/]{2}|^[~/]|^[A-Za-z]:/.test(v));
  for (const k of [...CONFIG_PLAIN, ...(o.archive ? [] : CONFIG_AGENT)]) if (config[k] !== undefined && plain(config[k])) out[k] = config[k];
  if (!o.archive && config.models && typeof config.models === "object") {
    const models: Record<string, Record<string, string>> = {};
    for (const [agent, tiers] of Object.entries(config.models as Record<string, Record<string, unknown>>))
      if (/^[a-z]+$/.test(agent) && tiers && typeof tiers === "object")
        models[agent] = Object.fromEntries(Object.entries(tiers).filter(([t, m]) => /^[a-z]+$/.test(t) && typeof m === "string" && /^[\p{L}\p{N}._:\[\]-]{1,60}$/u.test(m)) as [string, string][]);
    out.models = models;
  }
  if (Array.isArray(config.hooks)) out.hooks = config.hooks.length;
  if (config.connectorRoutes && typeof config.connectorRoutes === "object")
    out.connectorRoutes = Object.fromEntries(Object.entries(config.connectorRoutes as Record<string, { via?: unknown }>).filter(([n]) => /^[a-z0-9-]{1,60}$/.test(n)).map(([n, r]) => [n, typeof r?.via === "string" ? r.via : "?"]));
  for (const k of ["extraTrees", "seenTrees", "backups"]) if (Array.isArray(config[k])) out[k] = (config[k] as unknown[]).length;
  for (const k of ["home", "shared", "trees", "currentTree", "claudeConfigDir", "stromAppUrl", "terminalPath", "mainPerson"]) if (config[k] !== undefined) out[`${k}Set`] = true;
  const seen = config.stromAppSeen as { via?: unknown; at?: unknown; version?: unknown } | undefined;
  if (seen && typeof seen === "object")
    out.stromAppSeen = { ...(typeof seen.via === "string" && /^[a-z-]{1,20}$/.test(seen.via) ? { via: seen.via } : {}), ...(typeof seen.at === "string" ? { at: seen.at.slice(0, 30) } : {}), ...(typeof seen.version === "string" ? { version: seen.version.slice(0, 30) } : {}) };
  const check = config.updateCheck as { at?: unknown; latest?: unknown; channel?: unknown } | undefined;
  if (check && typeof check === "object") out.updateCheck = { at: String(check.at ?? "").slice(0, 30), latest: String(check.latest ?? "").slice(0, 30), ...(check.channel ? { channel: String(check.channel).slice(0, 10) } : {}) };
  return out;
}

/** The variables of strom's own the process was given (their names; the values of a few that say no path). */
export function envArea(env: Env): Record<string, unknown> {
  const values = new Set(["STROM_CHANNEL", "STROM_LANG", "STROM_ISOLATED", "STROM_NONINTERACTIVE", "STROM_NO_DIALOG", "STROM_UPDATES", "STROM_FOR_APP", "STROM_APP_VERSION", "STROM_SPAWNED", "STROM_TIMING"]);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(env).sort()) {
    if (!/^STROM_[A-Z0-9_]+$/.test(k) || env[k] === undefined) continue;
    const v = String(env[k]);
    out[k] = values.has(k) && /^[\p{L}\p{N}._:-]{0,40}$/u.test(v) ? v : "set";
  }
  return out;
}

/** The agents of this computer: their command line found and its version, their desktop app; strom's hooks in a research. */
export function agentsArea(env: Env, config: Record<string, unknown>, root: string | undefined, masker: Masker): Record<string, unknown> {
  const here = AGENTS.map((a) => {
    const cli = findAgent(a.command, env);
    const version = cli ? versionOf(cli, ["--version"], env) : undefined;
    return { id: a.id as string, cli: !!cli, ...(version ? { version: masker.sweep(version) } : {}), app: hasDesktopApp(a.id, env) };
  }).filter((a) => a.cli || a.app);
  let hooks: Record<string, unknown> | undefined;
  if (root) {
    let claude: string = "missing";
    try {
      const s = JSON.parse(fs.readFileSync(path.join(root, ".claude", "settings.json"), "utf8")) as { hooks?: unknown };
      claude = s.hooks && JSON.stringify(s.hooks).includes("strom") ? "on" : "off";
    } catch {
      claude = "missing";
    }
    let codex: string;
    try {
      codex = codexHookState(root, env);
    } catch {
      codex = "unknown";
    }
    hooks = { claude, codex };
  }
  return { installed: here, ...(typeof config.agent === "string" ? { default: config.agent } : {}), ...(hooks ? { hooks } : {}) };
}

/** The connectors of the shared folder: name, version, hosts, ways, its last test — never a login (only how many hosts have one). */
export function connectorsArea(env: Env, shared: string | undefined, root: string | undefined, masker: Masker): Record<string, unknown> {
  const dir = shared ? connectorsDir(shared) : undefined;
  const list: Record<string, unknown>[] = [];
  const broken: Record<string, unknown>[] = [];
  let names: string[] = [];
  try {
    names = dir ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_")).map((e) => e.name).sort() : [];
  } catch {
    names = [];
  }
  // the last test of each (strom connector test notes it among the fetches)
  const tests = new Map<string, Record<string, unknown>>();
  if (root)
    for (const r of jsonSince(path.join(root, ".strom", "metrics", "fetch.jsonl"), 0, 400 * 1024, (r) => (r.cmd === "test" ? r : undefined)).records)
      if (typeof r.connector === "string") tests.set(r.connector, { at: r.at, ...(typeof r.status === "string" ? { status: r.status } : {}), ...(typeof r.requests === "number" ? { requests: r.requests } : {}) });
  for (const name of names) {
    const shown = /^[a-z0-9-]{1,60}$/.test(name) ? name : masker.args([name])[0]!;
    try {
      const m = readManifest(path.join(dir!, name), env);
      list.push({
        name: shown,
        interface: m.interface,
        ...(m.version ? { version: String(m.version).slice(0, 30) } : {}),
        hosts: m.hosts.slice(0, 20),
        can: m.can,
        ...(m.routes ? { routes: m.routes } : {}),
        automation: m.policy?.automation,
        ...(tests.get(name) ? { lastTest: tests.get(name) } : {}),
      });
    } catch (e) {
      broken.push({ name: shown, problem: masker.text(String((e as Error).message).slice(0, 300)) });
    }
  }
  const consents = loadConsents(env);
  let logins = 0;
  try {
    logins = Object.keys(loadLogins(env)).length;
  } catch {
    logins = 0;
  }
  return {
    connectors: list,
    ...(broken.length ? { broken } : {}),
    consented: Object.keys(consents.connectors).filter((n) => /^[a-z0-9-]{1,60}$/.test(n)),
    allowedHosts: Object.keys(consents.hosts).filter((h) => /^[a-z0-9.-]{1,120}$/i.test(h)),
    hostsWithLogin: logins,
  };
}

/** strom check of a research: how many findings of each kind (their codes), never what they say. */
export function checkArea(tree: Tree): Record<string, unknown> {
  const byCode: Record<string, number> = {};
  let errors = 0;
  let warnings = 0;
  for (const f of check(tree)) {
    if (f.level === "error") errors++;
    else warnings++;
    const key = `${f.level}:${/^[a-z0-9._-]{1,60}$/i.test(f.code) ? f.code : "other"}`;
    byCode[key] = (byCode[key] ?? 0) + (f.count ?? 1);
  }
  return { errors, warnings, byCode };
}

/** The installation: how strom came here, its channel, its launchers on PATH, the last lines of its update log (masked). */
export function installArea(env: Env, masker: Masker): Record<string, unknown> {
  const inst = installation();
  const dirs = String(env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean);
  const onPath = dirs.filter((d) => ["strom", "strom.cmd", "strom.exe"].some((f) => fs.existsSync(path.join(d, f))));
  let updateLog: string[] = [];
  if (inst.root) updateLog = linesSince(path.join(inst.root, "update.log"), 0, 16 * 1024, maskLine(masker)).lines;
  return {
    kind: inst.kind,
    ...(inst.channel ? { channel: inst.channel } : {}),
    ...(inst.node ? { node: inst.node } : {}),
    ...(inst.command ? { command: inst.command } : {}),
    launchers: inst.launchers?.length ?? 0,
    pathEntries: dirs.length,
    stromOnPath: onPath.map((d) => masker.text(d)),
    ...(updateLog.length ? { updateLog } : {}),
  };
}

/** Windows: what strom's way there depends on — read without PowerShell (the registry through reg.exe). */
export function windowsArea(env: Env, masker: Masker, platform: NodeJS.Platform = process.platform): Record<string, unknown> {
  if (platform !== "win32") return { windows: false };
  const reg = (key: string, value: string): string | undefined => {
    try {
      const r = spawnSync("reg", ["query", key, "/v", value], { encoding: "utf8", timeout: 4000, windowsHide: true });
      return r.status === 0 ? /REG_\w+\s+(.+)$/m.exec(r.stdout)?.[1]?.trim() : undefined;
    } catch {
      return undefined;
    }
  };
  const profile = env.USERPROFILE ?? "";
  return {
    windows: true,
    executionPolicy: {
      user: reg("HKCU\\Software\\Microsoft\\PowerShell\\1\\ShellIds\\Microsoft.PowerShell", "ExecutionPolicy") ?? "not set",
      machine: reg("HKLM\\Software\\Microsoft\\PowerShell\\1\\ShellIds\\Microsoft.PowerShell", "ExecutionPolicy") ?? "not set",
    },
    oneDrive: !!env.OneDrive,
    profileNotAscii: /[^\x20-\x7e]/.test(profile),
    profilePathLength: profile.length,
    longPaths: reg("HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem", "LongPathsEnabled") ?? "not set",
    comSpec: env.ComSpec ? masker.text(env.ComSpec) : undefined,
    arch: env.PROCESSOR_ARCHITECTURE,
  };
}

/** The bridge's details (--about sync): its files of sync (when, how big — never what), the app's gates of this strom. */
export function syncArea(root: string): Record<string, unknown> {
  const dir = path.join(root, ".strom", "sync");
  const files: { at: string; bytes: number; kind: string }[] = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      const st = fs.statSync(path.join(dir, f));
      files.push({ at: st.mtime.toISOString(), bytes: st.isFile() ? st.size : 0, kind: st.isDirectory() ? "folder" : (/\.([a-z0-9]{1,6})$/i.exec(f)?.[1] ?? "file").toLowerCase() });
    }
  } catch {
    // none
  }
  files.sort((a, b) => a.at.localeCompare(b.at));
  const gates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(stromApp)) if (/^APP_[A-Z_]+$/.test(k) && (typeof v === "string" || typeof v === "boolean" || v === undefined)) gates[k] = v ?? null;
  return { files: files.slice(-40), filesTotal: files.length, gates };
}
