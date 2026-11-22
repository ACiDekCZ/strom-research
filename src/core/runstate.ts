// What the Strom app sees of a run (spec 126 U9): each run of strom run keeps a small file beside its worker
// (.strom/workers/<run>.run: its last step as its terminal says it, its sessions done, its model, a stop it was asked
// for), written whole (aside, then renamed) and at most about every 2 s; a stop is asked through a file of its own
// (.strom/workers/<run>.stop: finish — the agent writes down what it found, the run ends; stop — the task at work is
// finished, no next one starts), which the run reads between its sessions, while it waits and while its agent works.
// A run that ended is kept for a while in .strom/lines/ended.json (the last 20: why it ended), the agent of the last
// run of each line in .strom/lines/agents.json. Nothing in data/ changes: all of it is .strom's.

import fs from "node:fs";
import path from "node:path";
import { acquireLock } from "./lock.ts";

/** A run's worker as the app is told it and sends it back (strom run: run-<pid>-<base36>). */
export const RUN_ID = /^run-[A-Za-z0-9._-]{1,36}$/;

/** How a run is asked to stop: finish (its session's agent writes down what it found) or stop (after the task at work). */
export type RunStop = "finish" | "stop";

export interface RunState {
  /** The agent's last step as the run says it in its terminal (the research's language), at most STEP_MAX characters. */
  step?: string;
  /** Its sessions done. */
  sessions: number;
  model?: string;
  /** The stop it was asked for and has seen. */
  stop?: RunStop;
  /** Its session at work now, and that session's task. */
  session?: string;
  task?: string;
}

/** Why a run ended, as the app is told (runsEnded[].why). */
export type RunEnd = "done" | "stopped" | "limit" | "gate" | "time" | "archive" | "error";

export interface EndedRun {
  id: string;
  research: string | null;
  agent: string;
  since: string;
  ended: string;
  why: RunEnd;
}

export const STEP_MAX = 200;
/** How often a run's file is written at most while its agent works. */
const WRITE_MS = 2000;
/** How many ended runs are kept, and for how long the app is told of them. */
const ENDED_KEEP = 20;
export const ENDED_SHOWN_MS = 10 * 60_000;

function workersDir(root: string): string {
  return path.join(root, ".strom", "workers");
}

function linesDir(root: string): string {
  return path.join(root, ".strom", "lines");
}

export function runStateFile(root: string, id: string): string {
  return path.join(workersDir(root), `${id}.run`);
}

export function runStopFile(root: string, id: string): string {
  return path.join(workersDir(root), `${id}.stop`);
}

function endedFile(root: string): string {
  return path.join(linesDir(root), "ended.json");
}

function agentsFile(root: string): string {
  return path.join(linesDir(root), "agents.json");
}

/** A file written whole: aside, then renamed over the old one (a reader never sees half of it). Best effort. */
function writeWhole(file: string, data: unknown): boolean {
  const aside = `${file}.${process.pid}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(aside, JSON.stringify(data));
    fs.renameSync(aside, file);
    return true;
  } catch {
    fs.rmSync(aside, { force: true });
    return false;
  }
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

/** A step as the app is shown it: one line, at most STEP_MAX characters. */
export function shortStep(text: string): string {
  const one = text.replace(/\s+/gu, " ").trim();
  return one.length > STEP_MAX ? `${one.slice(0, STEP_MAX - 1).trimEnd()}…` : one;
}

/** What a run's file says (none: a run of a strom before it, or one that has not written it yet). */
export function readRunState(root: string, id: string): RunState | undefined {
  const s = readJson(runStateFile(root, id)) as Partial<RunState> | undefined;
  if (!s || typeof s !== "object") return undefined;
  return {
    ...(typeof s.step === "string" ? { step: shortStep(s.step) } : {}),
    sessions: Number.isInteger(s.sessions) && (s.sessions as number) >= 0 ? (s.sessions as number) : 0,
    ...(typeof s.model === "string" && s.model ? { model: s.model } : {}),
    ...(s.stop === "finish" || s.stop === "stop" ? { stop: s.stop } : {}),
    ...(typeof s.session === "string" && /^N\d+$/u.test(s.session) ? { session: s.session, ...(typeof s.task === "string" && /^T\d+$/u.test(s.task) ? { task: s.task } : {}) } : {}),
  };
}

/** The stop a run was asked for (none: it goes on). */
export function runStopAsked(root: string, id: string): RunStop | undefined {
  const s = readJson(runStopFile(root, id)) as { how?: unknown } | undefined;
  return s?.how === "finish" || s?.how === "stop" ? s.how : undefined;
}

/** A run asked to stop (a finish stays a finish: it asks more than a stop). */
export function askRunStop(root: string, id: string, how: RunStop, by = "user"): RunStop {
  const was = runStopAsked(root, id);
  const now = was === "finish" ? "finish" : how;
  if (now !== was) writeWhole(runStopFile(root, id), { how: now, at: new Date().toISOString(), by });
  return now;
}

/**
 * The run's own writer of its file: a step at most every WRITE_MS (the last one always written in the end), its
 * sessions and the stop it saw at once. `end` takes its files away.
 */
export function runStateWriter(root: string, id: string, model?: string): { step(text: string): void; session(id: string | undefined, task?: string): void; sessions(n: number): void; stop(how: RunStop): void; end(): void } {
  const state: RunState = { sessions: 0, ...(model ? { model } : {}) };
  let last = 0;
  let timer: NodeJS.Timeout | undefined;
  let ended = false;
  const write = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (ended) return;
    last = Date.now();
    writeWhole(runStateFile(root, id), state);
  };
  const soon = () => {
    if (ended || timer) return;
    const wait = last + WRITE_MS - Date.now();
    if (wait <= 0) return write();
    timer = setTimeout(write, wait);
    timer.unref();
  };
  write();
  return {
    step(text) {
      const s = shortStep(text);
      if (!s || s === state.step) return;
      state.step = s;
      soon();
    },
    session(session, task) {
      delete state.session;
      delete state.task;
      if (session) Object.assign(state, { session, ...(task ? { task } : {}) });
      write();
    },
    sessions(n) {
      state.sessions = n;
      write();
    },
    stop(how) {
      if (state.stop === how) return;
      state.stop = how;
      write();
    },
    end() {
      ended = true;
      if (timer) clearTimeout(timer);
      fs.rmSync(runStateFile(root, id), { force: true });
      fs.rmSync(runStopFile(root, id), { force: true });
    },
  };
}

/** A run's files taken away (its worker gone). */
export function clearRunFiles(root: string, id: string): void {
  fs.rmSync(runStateFile(root, id), { force: true });
  fs.rmSync(runStopFile(root, id), { force: true });
}

/** Why a run ended, from strom run's stop code (and whether it was asked to stop). */
export function runEndOf(stop: string, asked: boolean): RunEnd {
  if (asked || stop === "user") return "stopped";
  if (["done", "empty", "tasks", "sessions", "asleep"].includes(stop)) return "done";
  if (stop === "limit") return "limit";
  if (stop === "gate" || stop === "gate.cap" || stop === "gate.declined") return "gate";
  if (stop === "time") return "time";
  if (stop === "archive") return "archive";
  return "error";
}

function endedList(root: string): EndedRun[] {
  const list = readJson(endedFile(root));
  if (!Array.isArray(list)) return [];
  return list.filter(
    (e): e is EndedRun =>
      !!e && typeof e === "object" && typeof e.id === "string" && RUN_ID.test(e.id) && (e.research === null || typeof e.research === "string") && typeof e.agent === "string" && typeof e.since === "string" && typeof e.ended === "string" && typeof e.why === "string",
  );
}

/** A run ended: kept among the last ENDED_KEEP (under a short lock: two runs end at once). */
export function recordEnded(root: string, run: EndedRun): void {
  let leave: (() => void) | undefined;
  try {
    leave = acquireLock(path.join(linesDir(root), ".ended.lock"), { owner: run.id, waitMs: 5000, staleMs: 60_000 });
  } catch {
    // never held up by it: written without
  }
  try {
    writeWhole(endedFile(root), [...endedList(root).filter((e) => e.id !== run.id), run].slice(-ENDED_KEEP));
  } finally {
    leave?.();
  }
}

/**
 * A run's end as it stays in the research (.strom/runs/<run>.end.json, one file a run, never read back by strom): why
 * it ended (`why` as the app is told it in runsEnded[], runEndOf; `stopCode` strom run's own code and `reason` its words
 * in the terminal), its sessions and what they cost, the task last worked on and the one it would have started next.
 * Kept by strom tidy (the newest RUN_ENDS_KEPT always).
 */
export interface RunEndRecord {
  run: string;
  research: string | null;
  agent: string;
  since: string;
  at: string;
  why: RunEnd;
  stopCode: string;
  reason?: string;
  sessions: number;
  costUsd: number;
  lastTask?: string;
  nextTask?: string;
}

/** The ends of runs strom tidy keeps whatever their age. */
export const RUN_ENDS_KEPT = 20;

export function runEndFile(root: string, id: string): string {
  return path.join(root, ".strom", "runs", `${id}.end.json`);
}

/** A run's end written down. Never fails (false when it could not be written): a record is no reason to fail a run. */
export function recordRunEnd(root: string, rec: RunEndRecord): boolean {
  try {
    return writeWhole(runEndFile(root, rec.run), { ...rec, costUsd: Math.round(rec.costUsd * 100) / 100 });
  } catch {
    return false;
  }
}

/** The runs that ended in the last ENDED_SHOWN_MS, the newest last. */
export function endedRuns(root: string, now = Date.now()): EndedRun[] {
  return endedList(root).filter((e) => now - Date.parse(e.ended) <= ENDED_SHOWN_MS);
}

/** The agent of the last run of each line (G… → agent). */
export function lineAgents(root: string): Record<string, string> {
  const a = readJson(agentsFile(root));
  if (!a || typeof a !== "object" || Array.isArray(a)) return {};
  return Object.fromEntries(Object.entries(a as Record<string, unknown>).filter((e): e is [string, string] => /^G\d+$/u.test(e[0]) && typeof e[1] === "string"));
}

/** A line's run started with this agent: remembered for the line (called under the lock of the lines' start). */
export function rememberLineAgent(root: string, research: string, agent: string): void {
  const now = lineAgents(root);
  if (now[research] === agent) return;
  writeWhole(agentsFile(root), { ...now, [research]: agent });
}

/** What changes of the runs' files, for the bridge's state: the steps and stops of the runs, the ended, the lines' agents. */
export function runsStamp(root: string): string {
  const stamp = (file: string) => {
    try {
      return String(fs.statSync(file).mtimeMs);
    } catch {
      return "-";
    }
  };
  let files: string[] = [];
  try {
    files = fs.readdirSync(workersDir(root)).filter((f) => f.endsWith(".run") || f.endsWith(".stop")).sort();
  } catch {
    // no runs
  }
  return [...files.map((f) => `${f}@${stamp(path.join(workersDir(root), f))}`), stamp(endedFile(root)), stamp(agentsFile(root))].join(",");
}

/** The stops asked of the runs (who is finishing: the app waits for it, as for who is at work). */
export function stopsStamp(root: string): string {
  try {
    return fs
      .readdirSync(workersDir(root))
      .filter((f) => f.endsWith(".stop"))
      .sort()
      .join(",");
  } catch {
    return "";
  }
}
