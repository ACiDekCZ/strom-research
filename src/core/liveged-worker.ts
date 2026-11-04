// The bridge's thread for what takes long (core/liveged.ts): one job, its result said back, then it ends.

import { parentPort, workerData } from "node:worker_threads";
import { buildGed, excerptAnswer, fixesHere, widgetHere, type Done, type Job } from "./liveged.ts";

const job = workerData as Job;
let done: Done;
let move: ArrayBuffer[] = [];
try {
  if (job.job === "ged") {
    const made = buildGed(job.ask);
    done = { ok: true, made };
    // the file's bytes handed over, not copied (a buffer of its own: buildGed)
    move = [made.bytes.buffer as ArrayBuffer];
  } else if (job.job === "widget") {
    done = { ok: true, made: await widgetHere(job.ask) };
  } else if (job.job === "fixes") {
    done = { ok: true, made: await fixesHere(job.ask) };
  } else {
    const a = excerptAnswer(job.ask);
    done = { ok: true, made: { code: a.code, text: JSON.stringify(a.body) } };
  }
} catch (e) {
  done = { ok: false, message: (e as Error)?.message ?? String(e), ...((e as Error)?.stack ? { stack: (e as Error).stack } : {}) };
}
parentPort!.postMessage(done, move);
