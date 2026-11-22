// The bridge's writer of the queue of originals (core/mediaqueue.ts): one at a time, each by a strom of the bridge's
// (its warm writer, core/warmwriter.ts) under one hold of the tree's lock and one commit, the lock free between them.
// Files of no batch are written a moment after they came (STROM_MEDIA_QUEUE_MS, 300 ms: what comes together, one
// commit); a batch's once the app says it is whole (POST /batch/<id>/done: its files and its close one commit) or once
// no file of it came for a while (STROM_MEDIA_BATCH_QUIET_MS, 10 s). The jobs a bridge before it left are taken over as
// it starts. The research busy (another strom holds it): tried again in a while. A close that failed (a file another
// program held — found on Windows —, the research busy, …): the batch's files written again in a while all the same,
// never left waiting for the next bridge (the app closes it again as the answer's `retry` says).

import { EXIT } from "./errors.ts";
import { jobsOf, listJobs, type QueueJob } from "./mediaqueue.ts";
import type { RunStrom, StromResult } from "./warmwriter.ts";

/** How many files one strom media queued takes at most (and how long it goes on taking). */
const CHUNK_FILES = 50;
const CHUNK_MS = 1000;

export interface MediaQueue {
  /** The jobs a bridge before this one left: taken over (as the bridge starts). */
  takeOver(): void;
  /** A file queued now. */
  queued(job: QueueJob): void;
  /**
   * The app says a batch is whole: its queued files written, then `close` runs (strom input batch done, which takes what
   * is left of them in its commit) and says when it is done — and whether the batch was closed (false: its files left
   * in the queue are written again in a while).
   */
  close(id: string, close: (done: (closed: boolean) => void) => void): void;
  /** A strom of the queue at work now. */
  writing(): boolean;
  /** Files waiting to be written (a moment, a batch not whole yet, the research busy). */
  pending(): number;
  /** The bridge ends: nothing more started (the jobs wait for the next bridge). */
  end(): void;
}

export function mediaQueue(o: { root: string; env: NodeJS.ProcessEnv; run: RunStrom; note(text: string): void }): MediaQueue {
  const windowMs = Number(o.env.STROM_MEDIA_QUEUE_MS ?? 300);
  const quietMs = Number(o.env.STROM_MEDIA_BATCH_QUIET_MS ?? 10_000);
  // what waits to be done, in order: the files of no batch, a batch's files, a batch closed
  type Work = { kind: "loose" } | { kind: "batch"; id: string } | { kind: "close"; id: string; close: (done: (closed: boolean) => void) => void };
  const todo: Work[] = [];
  let busy = false;
  let ended = false;
  let looseTimer: ReturnType<typeof setTimeout> | undefined;
  const batchTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let backoff = 0;

  const add = (w: Work) => {
    if (ended) return;
    const same = todo.some((t) => t.kind === w.kind && (w.kind === "loose" || (t as { id: string }).id === w.id));
    if (w.kind === "close" || !same) todo.push(w);
    kick();
  };
  const kick = () => {
    if (busy || ended || retryTimer || !todo.length) return;
    const w = todo.shift()!;
    busy = true;
    const finish = () => {
      busy = false;
      setImmediate(kick);
    };
    const later = (work: Work = w) => {
      // tried again in a while (never at once: no loop against a research that fails), the work kept
      todo.unshift(work);
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        kick();
      }, backoff);
      retryTimer.unref();
      finish();
    };
    if (w.kind === "close") {
      const close = () =>
        w.close((closed) => {
          if (closed || ended || !jobsOf(o.root, w.id).length) return finish();
          // not closed and its files wait: written again in a while (the batch open until the app closes it again)
          backoff = Math.min(backoff ? backoff * 2 : 1000, 300_000);
          o.note(`the batch ${w.id} not closed now: its queued files written again in ${Math.round(backoff / 1000)} s`);
          later({ kind: "batch", id: w.id });
        });
      // its files first while more wait than one strom takes, then the close takes the rest (one commit for a small
      // batch); the research busy meanwhile: closed now all the same — the close says it is busy (503) to the app
      if (jobsOf(o.root, w.id).length > CHUNK_FILES) return take(w.id, (r) => (r === "more" ? (todo.unshift(w), finish()) : close()));
      return close();
    }
    take(w.kind === "batch" ? w.id : null, (r) => (r === "busy" ? later() : r === "more" ? (todo.unshift(w), finish()) : finish()));
  };

  /** One strom media queued: "more" left, "done", or "busy" (the research busy or the write failed). */
  const take = (batch: string | null, then: (r: "more" | "done" | "busy") => void) => {
    o.run(["media", "queued", ...(batch ? ["--batch", batch] : []), "--max-files", String(CHUNK_FILES), "--max-ms", String(CHUNK_MS), "--json"], (r: StromResult) => {
      let data: { left?: unknown; files?: unknown; message?: unknown } = {};
      try {
        data = JSON.parse(r.stdout) as typeof data;
      } catch {
        // said by the exit code
      }
      if (r.code === 0) {
        backoff = 0;
        const n = Array.isArray(data.files) ? data.files.length : 0;
        const left = typeof data.left === "number" ? data.left : 0;
        if (n) o.note(`${n} queued file(s)${batch ? ` of the batch ${batch}` : ""} written${left ? `, ${left} wait` : ""}`);
        return then(left > 0 ? "more" : "done");
      }
      backoff = Math.min(backoff ? backoff * 2 : 1000, r.code === EXIT.locked ? 30_000 : 300_000);
      o.note(`queued files${batch ? ` of the batch ${batch}` : ""} not written now (exit ${r.code ?? r.signal ?? r.error?.message}${typeof data.message === "string" ? `: ${data.message}` : ""}): again in ${Math.round(backoff / 1000)} s`);
      then("busy");
    });
  };

  const looseSoon = () => {
    if (looseTimer || ended) return;
    looseTimer = setTimeout(() => {
      looseTimer = undefined;
      add({ kind: "loose" });
    }, windowMs);
    looseTimer.unref();
  };
  const batchQuiet = (id: string) => {
    if (ended) return;
    const had = batchTimers.get(id);
    if (had) clearTimeout(had);
    const t = setTimeout(() => {
      batchTimers.delete(id);
      add({ kind: "batch", id });
    }, quietMs);
    t.unref();
    batchTimers.set(id, t);
  };

  return {
    takeOver() {
      // what a bridge before this one left
      const left = listJobs(o.root);
      if (!left.length) return;
      o.note(`${left.length} queued file(s) taken over`);
      if (left.some((q) => !q.job.batch)) looseSoon();
      for (const id of new Set(left.map((q) => q.job.batch).filter((b): b is string => !!b))) batchQuiet(id);
    },
    queued(job) {
      if (job.batch) batchQuiet(job.batch);
      else looseSoon();
    },
    close(id, close) {
      const t = batchTimers.get(id);
      if (t) clearTimeout(t);
      batchTimers.delete(id);
      add({ kind: "close", id, close });
    },
    writing: () => busy,
    pending: () => todo.length + batchTimers.size + (looseTimer ? 1 : 0),
    end() {
      ended = true;
      if (looseTimer) clearTimeout(looseTimer);
      if (retryTimer) clearTimeout(retryTimer);
      for (const t of batchTimers.values()) clearTimeout(t);
      batchTimers.clear();
      todo.length = 0;
    },
  };
}
