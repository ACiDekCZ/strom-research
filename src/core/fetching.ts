// A fetch of a book's images at work, for strom read of the same book: a mark beside the research
// (.strom/fetch/active-<book>.<pid>.json — what strom keeps for itself, never data) that says which images are coming,
// how many are registered and that the fetch is alive. strom fetch registers its images in batches as they come
// (FETCH_BATCH), so readers can begin on the first ones; strom read waits for the rest while the fetch is alive and
// says exactly what it did not read when the fetch ended before them. Nothing of it asks the archive anything.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Images a fetch registers at once (one commit each): readers begin on the first batch, the history grows little. */
export const FETCH_BATCH = 10;

/** A fetch nothing was heard of this long (no image, no wait for a limit it said) is taken for gone. */
export const FETCH_SILENT_MS = 10 * 60_000;

export interface ActiveFetch {
  pid: number;
  host: string;
  /** The last sign of life (an image taken in, a batch registered, a wait said). */
  at: string;
  recordset: string;
  connector: string;
  book: string;
  /** The images this fetch asks for (those not registered when it began). */
  images: number[];
  /** Of them, how many are registered now. */
  registered: number;
  /** A wait for the archive's limit said: till then no image comes (ms since the epoch). */
  waitUntil?: number;
  session?: string;
  /** strom fetch --background: a strom of its own, its agent works meanwhile (BackgroundOf says whose it is). */
  background?: boolean;
  /** When it began. */
  since?: string;
  task?: string;
  /** The worker (a run: "run-…") whose session started it — a background fetch goes on with the run after its session closed. */
  worker?: string;
  /** Waits while a fetch in the foreground asks the same host (theirs first). */
  yielding?: boolean;
  /** Its work folder in .strom/fetch (a name, no path): taken away once its process is gone. */
  work?: string;
}

function dir(root: string): string {
  return path.join(root, ".strom", "fetch");
}

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Written whole (a temporary file renamed into place): a reader never sees half a mark. */
function writeMark(file: string, mark: ActiveFetch): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(mark));
  fs.renameSync(tmp, file);
}

/** The mark of a fetch beginning: kept up to date as it goes, gone when it ends (whatever way it ends). */
export function markFetch(root: string, start: Omit<ActiveFetch, "pid" | "host" | "at" | "registered" | "since">): { beat: (change?: Partial<Pick<ActiveFetch, "registered" | "waitUntil" | "yielding">>) => void; end: () => void } {
  fs.mkdirSync(dir(root), { recursive: true });
  const file = path.join(dir(root), `active-${start.recordset}.${process.pid}.json`);
  const at = new Date().toISOString();
  let mark: ActiveFetch = { ...start, pid: process.pid, host: os.hostname(), at, since: at, registered: 0 };
  let ended = false;
  const save = () => {
    try {
      writeMark(file, mark);
    } catch {
      // a mark that cannot be written: a reader of the book only does not wait for it
    }
  };
  save();
  return {
    beat: (change = {}) => {
      if (ended) return;
      const { waitUntil: _w, yielding: _y, ...rest } = mark;
      mark = { ...rest, ...change, at: new Date().toISOString() };
      if (change.waitUntil === undefined) delete mark.waitUntil;
      if (!change.yielding) delete mark.yielding;
      save();
    },
    end: () => {
      ended = true;
      fs.rmSync(file, { force: true });
    },
  };
}

/** Alive: its process is (on this computer), and it was heard of lately (or waits for a limit it said). */
function alive(m: ActiveFetch, now: number): boolean {
  if (m.host === os.hostname() && !processAlive(m.pid)) return false;
  const heard = Date.parse(m.at);
  return now - Math.max(Number.isFinite(heard) ? heard : 0, m.waitUntil ?? 0) < FETCH_SILENT_MS;
}

/** A work folder of a fetch as its mark names it: a name in .strom/fetch of the connector's form, nothing else. */
const WORK_NAME = /^[\p{L}\p{M}\p{N}._-]+-\d+$/u;

/**
 * A fetch of this computer whose mark is stale: its end written as interrupted (unless it wrote its own), its mark
 * taken away, and — its process gone — its work folder too (only that one). What it registered is the research's to
 * say (withRegistered): a process killed while it committed a batch had that batch written already. A process still
 * there (silent, or its pid taken by another) keeps its folder: strom tidy takes it after a day.
 */
function gone(root: string, file: string, m: ActiveFetch): void {
  const dead = !processAlive(m.pid);
  if (!fs.existsSync(endedFile(root, m.recordset, m.pid))) {
    markEnded(root, {
      pid: m.pid,
      recordset: m.recordset,
      connector: m.connector,
      book: m.book,
      images: m.images,
      registered: [],
      missed: m.images,
      interrupted: dead ? "gone" : "silent",
      ...(m.background ? { background: true } : {}),
      at: m.at,
      ...(m.since ? { since: m.since } : {}),
      ...(m.session ? { session: m.session } : {}),
      ...(m.task ? { task: m.task } : {}),
      exitCode: 1,
    });
  }
  fs.rmSync(file, { force: true });
  if (dead && m.work && WORK_NAME.test(m.work))
    try {
      fs.rmSync(path.join(dir(root), m.work), { recursive: true, force: true, maxRetries: 2 });
    } catch {
      // a file of it still open (Windows): strom tidy takes it later
    }
}

/**
 * The fetches of a book at work now (every book: none named); the mark of one that is gone is taken away, its end
 * written as interrupted (strom fetch --status, the brief).
 */
export function activeFetches(root: string, recordset?: string, now = Date.now()): ActiveFetch[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir(root));
  } catch {
    return [];
  }
  const out: ActiveFetch[] = [];
  for (const name of names) {
    if (!name.startsWith(recordset ? `active-${recordset}.` : "active-") || !name.endsWith(".json")) continue;
    const file = path.join(dir(root), name);
    let m: ActiveFetch;
    try {
      m = JSON.parse(fs.readFileSync(file, "utf8")) as ActiveFetch;
    } catch {
      continue; // being written: the next look reads it
    }
    if ((recordset && m.recordset !== recordset) || !Array.isArray(m.images)) continue;
    if (alive(m, now)) out.push(m);
    else if (m.host === os.hostname()) gone(root, file, m);
  }
  return out;
}

// ── strom fetch --background ─────────────────────────────────────────────────
// A fetch of the images the agent will read, by a strom of its own (a process apart from the agent's turn, as
// strom compact is): the agent works meanwhile. It belongs to the session and the task that started it and keeps to
// the session's limits (its waits for an archive's limit, never into the last minutes); it ends by itself when it is
// asked to stop (strom fetch --stop), when its session is asked to finish, when its session closes outside a run, or
// when the run its session was part of ends. A look every few seconds, never a signal: the same on Windows, and a stop
// never cuts a batch half written.

/** The environment of the strom that fetches in the background: whose it is (JSON of BackgroundOf). */
export const BACKGROUND_ENV = "STROM_FETCH_BG";

/** How often a fetch in the background looks whether it is to stop. */
export const BACKGROUND_LOOK_MS = 2000;

/** How long an ended fetch in the background is told by strom fetch --status and the brief. */
export const ENDED_SAID_MS = 24 * 3600_000;

/** Whose a fetch in the background is: the session (and its task, its worker) that started it. */
export interface BackgroundOf {
  session: string;
  task?: string;
  worker?: string;
}

export function backgroundOf(env: Record<string, string | undefined>): BackgroundOf | undefined {
  const v = env[BACKGROUND_ENV];
  if (!v) return undefined;
  try {
    const j = JSON.parse(v) as Partial<BackgroundOf>;
    return typeof j.session === "string" && /^N\d+$/.test(j.session)
      ? { session: j.session, ...(typeof j.task === "string" ? { task: j.task } : {}), ...(typeof j.worker === "string" && /^[\w.-]{1,80}$/.test(j.worker) ? { worker: j.worker } : {}) }
      : undefined;
  } catch {
    return undefined;
  }
}

/** A run's worker ("run-…"): its fetches in the background go on after their session closed, while the run works. */
export function isRunWorker(worker: string | undefined): boolean {
  return worker === "run" || !!worker?.startsWith("run-");
}

function stopFile(root: string, pid: number): string {
  return path.join(dir(root), `stop-${pid}`);
}

/** Ask a fetch in the background to stop: it registers what came and ends within seconds. */
export function askStop(root: string, pid: number, why: string): void {
  fs.mkdirSync(dir(root), { recursive: true });
  fs.writeFileSync(stopFile(root, pid), JSON.stringify({ at: new Date().toISOString(), why }) + "\n");
}

function stopAsked(root: string, pid: number): boolean {
  return fs.existsSync(stopFile(root, pid));
}

/**
 * Watch whether a fetch in the background is to stop: `why` says it (undefined: go on), looked at every
 * BACKGROUND_LOOK_MS; `stop` is called once with the reason. The returned function ends the watch.
 */
export function watchBackground(root: string, why: () => string | undefined, stop: (reason: string) => void): () => void {
  let stopped = false;
  const look = () => {
    if (stopped) return;
    let reason: string | undefined;
    try {
      reason = stopAsked(root, process.pid) ? "asked to stop (strom fetch --stop)" : why();
    } catch {
      reason = undefined; // a look that fails: the next one
    }
    if (reason) {
      stopped = true;
      stop(reason);
    }
  };
  const t = setInterval(look, BACKGROUND_LOOK_MS);
  t.unref?.();
  return () => {
    stopped = true;
    clearInterval(t);
    fs.rmSync(stopFile(root, process.pid), { force: true });
  };
}

/** What a fetch in the background gave, kept beside the research a while for strom fetch --status and the brief. */
export interface EndedFetch {
  pid: number;
  recordset: string;
  connector: string;
  book: string;
  images: number[];
  registered: number[];
  /** Asked for and not fetched (stopped, refused, a limit). */
  missed: number[];
  /** Why it stopped before the end, if it did. */
  stopped?: string;
  /**
   * It ended without a word: its process is gone (killed, the computer stopped) or nothing was heard of it for
   * FETCH_SILENT_MS — written by the strom that found its mark stale; `at` is the last sign of life.
   */
  interrupted?: "gone" | "silent";
  /** A fetch in the background (an interrupted one may have been in the foreground). */
  background?: boolean;
  at: string;
  since?: string;
  session?: string;
  task?: string;
  /** The exit code it ended with. */
  exitCode: number;
}

function endedFile(root: string, recordset: string, pid: number): string {
  return path.join(dir(root), `ended-${recordset}.${pid}.json`);
}

export function markEnded(root: string, ended: EndedFetch): void {
  try {
    fs.mkdirSync(dir(root), { recursive: true });
    writeMark(endedFile(root, ended.recordset, ended.pid), ended as unknown as ActiveFetch);
  } catch {
    // not kept: strom fetch --status only does not tell it
  }
}

/**
 * Of an interrupted fetch, what it registered and what not as the research has it now (`has`: the images of its
 * book registered); a fetch that wrote its own end said it already.
 */
export function withRegistered(e: EndedFetch, has: Set<number>): EndedFetch {
  return e.interrupted ? { ...e, registered: e.images.filter((n) => has.has(n)), missed: e.images.filter((n) => !has.has(n)) } : e;
}

/** The fetches in the background ended lately (ENDED_SAID_MS), newest first; older ones are taken away. */
export function endedFetches(root: string, now = Date.now()): EndedFetch[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir(root));
  } catch {
    return [];
  }
  const out: EndedFetch[] = [];
  for (const name of names) {
    if (!name.startsWith("ended-") || !name.endsWith(".json")) continue;
    const file = path.join(dir(root), name);
    try {
      const e = JSON.parse(fs.readFileSync(file, "utf8")) as EndedFetch;
      if (now - Date.parse(e.at) > ENDED_SAID_MS) fs.rmSync(file, { force: true });
      else out.push(e);
    } catch {
      continue;
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** The log of a fetch in the background (what it would have said at a terminal). */
export function backgroundLog(root: string, recordset: string): string {
  return path.join(dir(root), `background-${recordset}-${Date.now().toString(36)}.log`);
}
