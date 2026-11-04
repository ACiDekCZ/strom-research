// The bridge's order kept once a day (core/tidy.ts autoTidy) on a thread of its own: the summary of the reading of scans
// it makes again reads every task and session of the research — seconds on a research of thousands of tasks, ~11 s on
// one of 5 000 (found 2026-11-04) — and on the bridge's thread nothing else was answered meanwhile.

import { parentPort, workerData } from "node:worker_threads";
import { Tree } from "./tree.ts";
import { autoTidy } from "./tidy.ts";
import type { Env } from "./paths.ts";

const { root, env } = workerData as { root: string; env: Env };
try {
  autoTidy(Tree.open(root, env));
  parentPort!.postMessage({ ok: true });
} catch (e) {
  parentPort!.postMessage({ ok: false, message: (e as Error)?.message ?? String(e) });
}
