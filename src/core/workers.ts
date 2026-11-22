// Who works in a tree right now. Several agents may: a conversation with
// Claude Code, another with Codex, a run on its own. Each one strom starts
// gets a name of its own (STROM_WORKER) and is present while its strom process
// lives (.strom/workers/<name>.json, a lock that dies with the process). Every
// worker has its own current session, and never gets a task another one has.

import fs from "node:fs";
import path from "node:path";
import { acquireLock, liveHolder, type LockInfo } from "./lock.ts";
import { clearRunFiles } from "./runstate.ts";

export interface Worker {
  id: string;
  /** What it is, for people: "Claude Code conversation". */
  label: string;
  since: string;
  /** The version of strom it works with (a worker of a strom before 1.25: none). */
  version?: string;
  /** A run waiting for its gate: when it asks again, and what the gate said. */
  paused?: Paused;
  /** A run of one line (strom run --research, spec 126): its line. */
  research?: string;
  /** A run's agent (claude, codex, …). */
  agent?: string;
}

export interface Paused {
  until: string;
  reason?: string;
  /** Waiting for a restricted archive another session uses (spec 127 K2.3): its site, and since when the run waits. */
  archive?: string;
  since?: string;
  /** What it waits for, as a word (the Strom app's runs[].paused.reason): the plan's limit, an archive. */
  kind?: "limit" | "archive";
}

function dir(root: string): string {
  return path.join(root, ".strom", "workers");
}

function pauseFile(root: string, id: string): string {
  return path.join(dir(root), `${id}.paused`);
}

/** A run waits for its gate (the app shows it paused, not at work) — or goes on (undefined). */
export function markPaused(root: string, id: string, paused: Paused | undefined): void {
  const file = pauseFile(root, id);
  if (!paused) return fs.rmSync(file, { force: true });
  fs.mkdirSync(dir(root), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(paused));
}

function pausedOf(root: string, id: string): Paused | undefined {
  try {
    const p = JSON.parse(fs.readFileSync(pauseFile(root, id), "utf8")) as Paused;
    return typeof p.until === "string" ? { until: p.until, ...(typeof p.reason === "string" ? { reason: p.reason } : {}), ...(typeof p.archive === "string" ? { archive: p.archive } : {}), ...(typeof p.since === "string" ? { since: p.since } : {}), ...(p.kind === "limit" || p.kind === "archive" ? { kind: p.kind } : {}) } : undefined;
  } catch {
    return undefined;
  }
}

/** A worker's name, safe as a file name. */
export function isWorkerId(id: string | undefined): id is string {
  return !!id && /^[\w.-]{1,80}$/.test(id);
}

/**
 * Be present in the tree until the returned function is called (or the process ends); `version`: the strom it works
 * with; a run's `research` (its line) and `agent`, shown between its sessions too.
 */
export function enterWorker(root: string, id: string, label: string, version?: string, run: { research?: string; agent?: string } = {}): () => void {
  return acquireLock(path.join(dir(root), `${id}.json`), { owner: label, waitMs: 0, staleMs: 7 * 24 * 3600_000, machine: true, ...(version ? { version } : {}), ...(run.research ? { research: run.research } : {}), ...(run.agent ? { agent: run.agent } : {}) });
}

/** The workers present now; files of workers that are gone are cleared away. */
export function liveWorkers(root: string): Worker[] {
  const out: Worker[] = [];
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir(root)).filter((f) => f.endsWith(".json"));
  } catch {
    return out;
  }
  for (const f of files) {
    const file = path.join(dir(root), f);
    const id = f.slice(0, -5);
    const info = liveHolder(file, 7 * 24 * 3600_000);
    if (info) {
      const paused = pausedOf(root, id);
      out.push({ id, label: info.owner, since: info.at, ...(info.version ? { version: info.version } : {}), ...(paused ? { paused } : {}), ...(typeof info.research === "string" ? { research: info.research } : {}), ...(typeof info.agent === "string" ? { agent: info.agent } : {}) });
    } else {
      fs.rmSync(file, { force: true });
      fs.rmSync(pauseFile(root, id), { force: true });
      // a run's step and the stop asked of it (core/runstate.ts)
      clearRunFiles(root, id);
    }
  }
  return out;
}

/** Is any agent strom started at work in the tree now (a conversation, a run)? Read only: nothing cleared away. */
export function anyoneAtWork(root: string): boolean {
  try {
    return fs
      .readdirSync(dir(root))
      .some((f) => f.endsWith(".json") && !!liveHolder(path.join(dir(root), f), 7 * 24 * 3600_000));
  } catch {
    return false;
  }
}

/**
 * The versions of strom other than `version` that work in the tree now (read only, nothing cleared away): a worker that
 * says none is of a strom before 1.25 — "" stands for it.
 */
export function otherVersionsAtWork(root: string, version: string): string[] {
  const out = new Set<string>();
  try {
    for (const f of fs.readdirSync(dir(root))) {
      if (!f.endsWith(".json")) continue;
      const info = liveHolder(path.join(dir(root), f), 7 * 24 * 3600_000);
      if (info && info.version !== version) out.add(info.version ?? "");
    }
  } catch {
    // no workers
  }
  return [...out];
}

export function isLiveWorker(root: string, id: string): boolean {
  return !!workerHolder(root, id);
}

/** The process a live worker is (its lock: pid, host, computer), undefined when it is gone. */
export function workerHolder(root: string, id: string): LockInfo | undefined {
  return liveHolder(path.join(dir(root), `${id}.json`), 7 * 24 * 3600_000);
}

/**
 * The runs at work in a tree (strom run: each present as a worker of its own, "run-…"). A run of an older strom held
 * .strom/run.lock instead, and its sessions carry no worker.
 */
export function runsAtWork(root: string): Worker[] {
  const runs = liveWorkers(root).filter((w) => w.id === "run" || w.id.startsWith("run-"));
  const old = liveHolder(path.join(root, ".strom", "run.lock"));
  return old ? [...runs, { id: "run", label: old.owner, since: old.at }] : runs;
}

/** Is the run that holds a session still at work? */
export function runAlive(root: string, s: { worker?: string }): boolean {
  return s.worker ? isLiveWorker(root, s.worker) : !!liveHolder(path.join(root, ".strom", "run.lock"));
}
