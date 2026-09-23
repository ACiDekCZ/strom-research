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
}

function dir(root: string): string {
  return path.join(root, ".strom", "workers");
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
    const info = liveHolder(file, 7 * 24 * 3600_000);
    if (info) out.push({ id: f.slice(0, -5), label: info.owner, since: info.at });
    else fs.rmSync(file, { force: true });
  }
  return out;
}

export function isLiveWorker(root: string, id: string): boolean {
  return !!liveHolder(path.join(dir(root), `${id}.json`), 7 * 24 * 3600_000);
}
