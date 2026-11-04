// The bridge's thread for /status (core/livestatus.ts): one for the bridge's life, each ask worked out in turn, what it
// worked out before (the queue's order, the readings, the history's rev) kept between them.

import { parentPort, workerData } from "node:worker_threads";
import { HistoryCache, historyRevLearn, status } from "./live.ts";
import { Tree } from "./tree.ts";
import { ReadingsSeen } from "./live-read.ts";
import { splitStatus, type LogJob, type StatusDone, type StatusJob } from "./livestatus.ts";
import type { Env } from "./paths.ts";

const { root, env } = workerData as { root: string; env: Env };
const seen = new ReadingsSeen(root, env);
// what git said of the commits, kept: a /log asks it about the new ones only
const histories = new HistoryCache(root);

parentPort!.on("message", (job: StatusJob | LogJob) => {
  let done: StatusDone;
  try {
    if ("log" in job) {
      const made = JSON.stringify({ entries: histories.log(Tree.open(root, env), job.log) });
      parentPort!.postMessage({ id: job.id, ok: true, made } satisfies StatusDone);
      return;
    }
    // the time it was asked: an ask made while this one was worked out is newer
    const at = Date.now();
    historyRevLearn(root, job.known);
    done = { id: job.id, ok: true, made: splitStatus(status(root, env, job.version, seen), job.key, at) };
  } catch (e) {
    done = { id: job.id, ok: false, message: (e as Error)?.message ?? String(e), ...((e as Error)?.stack ? { stack: (e as Error).stack } : {}) };
  }
  parentPort!.postMessage(done);
});
