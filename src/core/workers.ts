// Who works in a tree right now. Several agents may: a conversation with
// Claude Code, another with Codex, a run on its own. Each one strom starts
// gets a name of its own (STROM_WORKER) and is present while its strom process
// lives (.strom/workers/<name>.json, a lock that dies with the process). Every
// worker has its own current session, and never gets a task another one has.

import fs from "node:fs";
import path from "node:path";
import { acquireLock, liveHolder } from "./lock.ts";

export interface Worker {
  id: string;
  /** What it is, for people: "Claude Code conversation". */
  label: string;
  since: string;
  /** A run waiting for its gate: when it asks again, and what the gate said. */
  paused?: Paused;
}

export interface Paused {
  until: string;
  reason?: string;
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
    return typeof p.until === "string" ? { until: p.until, ...(typeof p.reason === "string" ? { reason: p.reason } : {}) } : undefined;
  } catch {
    return undefined;
  }
}

/** A worker's name, safe as a file name. */
export function isWorkerId(id: string | undefined): id is string {
  return !!id && /^[\w.-]{1,80}$/.test(id);
}

/** Be present in the tree until the returned function is called (or the process ends). */
export function enterWorker(root: string, id: string, label: string): () => void {
  return acquireLock(path.join(dir(root), `${id}.json`), { owner: label, waitMs: 0, staleMs: 7 * 24 * 3600_000 });
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
      out.push({ id, label: info.owner, since: info.at, ...(paused ? { paused } : {}) });
    } else {
      fs.rmSync(file, { force: true });
      fs.rmSync(pauseFile(root, id), { force: true });
    }
  }
  return out;
}

export function isLiveWorker(root: string, id: string): boolean {
  return !!liveHolder(path.join(dir(root), `${id}.json`), 7 * 24 * 3600_000);
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
