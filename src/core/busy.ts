// What works in a research right now — said before strom update (spec 037 K2.1) and in the bridge's /status for the
// Strom app (K2.2): the sessions open with their agent still at work, the runs, the conversations strom started.
// Read only: nothing is cleared away or closed here.

import { liveWorkers, runAlive, runsAtWork, isLiveWorker } from "./workers.ts";
import { openSessions } from "./session.ts";
import type { Tree } from "./tree.ts";

/** A session open without a worker (an agent started outside strom chat and strom run) counts this long. */
export const UNWATCHED_SESSION_MS = 6 * 3600_000;

export interface Busy {
  /** The sessions open now whose agent is still at work, oldest first. */
  sessions: { id: string; task?: string }[];
  /** The runs at work (strom run). */
  runs: number;
  /** The conversations strom started with no session open now. */
  conversations: number;
}

/** What works in the research `tree` now. */
export function busyIn(tree: Tree, now: number = Date.now()): Busy {
  const root = tree.root;
  const sessions = openSessions(tree).filter((s) =>
    s.worker ? isLiveWorker(root, s.worker) : s.runner ? runAlive(root, s) : now - Date.parse(s.started) < UNWATCHED_SESSION_MS,
  );
  const runs = runsAtWork(root);
  const holding = new Set(sessions.map((s) => s.worker).filter((w): w is string => !!w));
  const conversations = liveWorkers(root).filter((w) => w.id !== "run" && !w.id.startsWith("run-") && !holding.has(w.id)).length;
  return {
    sessions: sessions.sort((a, b) => a.started.localeCompare(b.started)).map((s) => ({ id: s.id, ...(s.task ? { task: s.task } : {}) })),
    runs: runs.length,
    conversations,
  };
}

/** Anything at work in `b`. */
export function isBusy(b: Busy): boolean {
  return b.sessions.length > 0 || b.runs > 0 || b.conversations > 0;
}
