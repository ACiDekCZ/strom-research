// The bridge's /status (core/live.ts) made on a thread of its own and kept for the state of the research it was made
// for. Working it out reads the whole research — every task for the queue, what waits for the person, the places, the
// lines — half a second on a research of a thousand tasks, seconds on a busy computer: made on the bridge's thread it
// held every other answer meanwhile, and the app, asking now and then with a short patience, said the research does not
// answer (found 2026-11-04 on a research of ~470 tasks in the queue while its agent wrote). Now:
//   - made once for a state (the commit, who is at work, the tree's and this computer's settings, the day, the agents
//     here, the history's rev, strom on disk) and answered from what was made while that state lasts; looked at again in
//     the background after STATUS_FRESH_MS, waited for as a new state after STATUS_OLD_MS;
//   - made on a thread of its own (livestatus-worker.ts, one for the bridge's life, keeping what it worked out), so the
//     bridge answers everything else meanwhile; one making at a time, the asks for the same state wait for it together;
//   - an ask while the research changes waits for the new state at most STATUS_WAIT_MS, else is answered what was made
//     for the state before (never nothing: the app's patience is short) — the next ask has the new one; but never when
//     who is at work changed: the app asks once after the event `working` and believed the state before — a conversation
//     ended with /exit stayed "at work" in the app, nothing asking again (found 2026-11-06), so that ask waits for the new;
//   - the parts that weigh (what waits, the queue, the work off the lines, the lines) each with its rev: an app that
//     says parts=1 is answered the rest and the revs, and asks a part (GET /status/<part>) only when its rev changed.

import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { Worker } from "node:worker_threads";
import type { Env } from "./paths.ts";

/** The parts of /status that weigh, each with the fields of /status it carries (GET /status/<part>, feature status.parts). */
export const STATUS_PARTS = {
  waiting: ["waiting"],
  queue: ["queue", "queueMore", "queueCounts"],
  offLine: ["offLine"],
  researches: ["researches"],
} as const;
export type StatusPart = keyof typeof STATUS_PARTS;

export function isStatusPart(name: string | undefined): name is StatusPart {
  return !!name && Object.hasOwn(STATUS_PARTS, name);
}

/** /status made for one state: the whole answer, the light one (parts=1) and each part with its rev. */
export interface StatusMade {
  /** The state it was made for (StatusKeeper.keyNow). */
  key: string;
  /** When it was made (ms). */
  at: number;
  full: string;
  lite: string;
  parts: Record<StatusPart, { rev: string; text: string }>;
}

/** The rev of a part: what it says, in short (the same JSON, the same rev). */
function revOf(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** /status as worked out, made into the answers (made where it is worked out: on the thread). */
export function splitStatus(status: Record<string, unknown>, key: string, at = Date.now()): StatusMade {
  const parts = {} as StatusMade["parts"];
  const lite: Record<string, unknown> = { ...status };
  const revs: Record<string, string> = {};
  for (const [name, fields] of Object.entries(STATUS_PARTS) as [StatusPart, readonly string[]][]) {
    const of: Record<string, unknown> = {};
    for (const f of fields) {
      if (status[f] !== undefined) of[f] = status[f];
      delete lite[f];
    }
    const said = JSON.stringify(of);
    const rev = revOf(said);
    revs[name] = rev;
    parts[name] = { rev, text: JSON.stringify({ part: name, rev, head: status.head, ...of }) };
  }
  return { key, at, full: JSON.stringify(status), lite: JSON.stringify({ ...lite, parts: revs }), parts };
}

/** What the thread is asked: /status for the app of that version, for the state key. */
export interface StatusJob {
  id: number;
  version: string | undefined;
  key: string;
  /** What the bridge's thread knows of the history's rev (core/live.ts historyRevKnown). */
  known?: { at: number; head: string; rev: string };
}
/**
 * Or /log at a commit: git asked about the commits the thread does not know yet, and each as the app reads it — what
 * depends on the research now (names, tasks, directions; every session read): a second on a large research.
 */
export interface LogJob {
  id: number;
  log: string;
}
/** What it says back (/log: its JSON text). */
export type StatusDone = { id: number; ok: true; made: StatusMade | string } | { id: number; ok: false; message: string; stack?: string };

/** Where the thread's code is: next to this file, the same kind (the sources run as .ts, the package as .js). */
const WORKER = new URL(`./livestatus-worker${path.extname(fileURLToPath(import.meta.url))}`, import.meta.url);

/** How long what was made is answered without looking again (a background look after it). */
export const STATUS_FRESH_MS = 5_000;
/**
 * How old what was made may be answered at once (made again in the background): what /status says beside the state
 * (the phone, the spend, a newer strom) is at most that late. Older: made again, waited for as a new state.
 */
export const STATUS_OLD_MS = 60_000;
/** How long an ask waits for the new state when what was made is of another state (then: what was made). */
export const STATUS_WAIT_MS = 1_500;

export interface KeeperOpts {
  root: string;
  env: Env;
  /** The state now, besides the commit and who is at work (the settings' files, the day): cheap, read at each ask. */
  stateNow: () => string;
  /**
   * Who is at work now (.strom/workers), as text: part of the state, read at each ask. An ask after it changed waits for
   * the new state, never answered the one before (the app would show a conversation that ended).
   */
  atWork?: () => string;
  /** /status worked out here, when no thread can be had (the same answer, on the bridge's thread). */
  inline: (version: string | undefined, key: string) => StatusMade;
  /** /log at a commit worked out here (no thread): its JSON text. */
  logHere?: (head: string) => string;
  /** Something to be written into the bridge's log. */
  note: (text: string) => void;
  /** What the bridge's thread found that the thread would find again later (the history's rev): told with each ask. */
  known?: () => StatusJob["known"];
  git?: string;
}

/** The commit the research is at: asked of git without holding the bridge (another process). */
function headAsync(root: string, git: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(git, ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 10_000 }, (err, out) => resolve(err ? "" : String(out).trim()));
  });
}

/** A part of the state written into its key on a line of its own. */
function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, " ");
}

/** Who is at work in a state's key (keyNow: its second line). */
function atWorkOf(key: string): string {
  return key.split("\n")[1] ?? "";
}

/** /status of one bridge: made on a thread, kept for its state, answered at once while that state lasts. */
export class StatusKeeper {
  private readonly o: KeeperOpts;
  private worker: Worker | undefined;
  private broken = false;
  private seq = 0;
  private readonly waiting = new Map<number, { resolve: (m: any) => void; reject: (e: Error) => void }>();
  /** What was made last, for each version of the app. */
  private readonly made = new Map<string, StatusMade>();
  /** What is being made, for each version and state. */
  private readonly making = new Map<string, Promise<StatusMade>>();
  /** Made again at the next ask whatever the state says (a write of the app's, written by the bridge). */
  private stale = false;
  ended = false;

  constructor(o: KeeperOpts) {
    this.o = o;
  }

  /** The state of the research now: its commit, who is at work and what changes beside it (one line each). */
  async keyNow(): Promise<string> {
    const h = await headAsync(this.o.root, this.o.git ?? "git");
    return `${h}\n${oneLine(this.o.atWork?.() ?? "")}\n${this.o.stateNow()}`;
  }

  /** What changed beside the state (the app wrote through the bridge): made again at the next ask. */
  forget(): void {
    this.stale = true;
  }

  /**
   * /status for the app of that version: what was made for the state now (looked at again in the background once
   * older than STATUS_FRESH_MS), else made now — waited for at most STATUS_WAIT_MS when something was made before.
   */
  async get(version: string | undefined): Promise<StatusMade> {
    const v = version ?? "";
    const key = await this.keyNow();
    const had = this.made.get(v);
    const age = had ? Date.now() - had.at : Infinity;
    if (had && had.key === key && !this.stale && age <= STATUS_OLD_MS) {
      if (age > STATUS_FRESH_MS) this.make(version, key).catch(() => undefined);
      return had;
    }
    this.stale = false;
    const fresh = this.make(version, key);
    // who is at work changed (a conversation began or ended): the state before would say what is no more
    if (!had || atWorkOf(had.key) !== atWorkOf(key)) return fresh;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<StatusMade>((resolve) => {
      timer = setTimeout(() => resolve(had), Number(this.o.env.STROM_LIVE_STATUS_WAIT_MS ?? STATUS_WAIT_MS));
    });
    try {
      return await Promise.race([fresh, late]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Made before the app asks (a new commit heard): ready when it asks. */
  warm(version: string | undefined): void {
    if (this.ended) return;
    this.keyNow()
      .then((key) => (this.made.get(version ?? "")?.key === key ? undefined : this.make(version, key)))
      .catch(() => undefined);
  }

  /** /status made for the state now before the bridge answers (it takes over from another): waited for at most ms. */
  ready(version: string | undefined, ms: number): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      this.get(version).then(() => undefined, () => undefined),
      new Promise<void>((resolve) => (timer = setTimeout(resolve, ms))),
    ]).finally(() => clearTimeout(timer));
  }

  /** The thread ended with the bridge. */
  end(): void {
    this.ended = true;
    const w = this.worker;
    this.worker = undefined;
    if (w) void w.terminate();
  }

  private make(version: string | undefined, key: string): Promise<StatusMade> {
    const v = version ?? "";
    const id = `${v}\n${key}`;
    const had = this.making.get(id);
    if (had) return had;
    const p = this.onThread(version, key)
      .catch((e: Error) => {
        // a thread that fails: worked out here, as before threads (the answer matters more than the bridge's time)
        this.o.note(`/status not made on its thread (${e.message}): made on the bridge's`);
        return this.o.inline(version, key);
      })
      .then((m) => {
        const before = this.made.get(v);
        if (!before || before.at <= m.at) this.made.set(v, m);
        return m;
      })
      .finally(() => this.making.delete(id));
    this.making.set(id, p);
    return p;
  }

  /** /log at a commit (its JSON text): on the thread, in turn with /status; here when it cannot be. */
  log(head: string): Promise<string> {
    const here = () => this.o.logHere!(head);
    if (this.broken || this.o.env.STROM_LIVE_STATUS_THREAD === "0") return Promise.resolve().then(here);
    const w = this.thread();
    const id = ++this.seq;
    return new Promise<string>((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      w.postMessage({ id, log: head } satisfies LogJob);
    }).catch(here);
  }

  private onThread(version: string | undefined, key: string): Promise<StatusMade> {
    if (this.broken || this.o.env.STROM_LIVE_STATUS_THREAD === "0") return Promise.resolve(this.o.inline(version, key));
    const w = this.thread();
    const id = ++this.seq;
    return new Promise<StatusMade>((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      w.postMessage({ id, version, key, known: this.o.known?.() } satisfies StatusJob);
    });
  }

  private thread(): Worker {
    if (this.worker) return this.worker;
    const env = Object.fromEntries(Object.entries(this.o.env).filter((e): e is [string, string] => typeof e[1] === "string"));
    const w = new Worker(WORKER, { workerData: { root: this.o.root, env }, env });
    // nothing to wait for once the bridge ends
    w.unref();
    w.on("message", (done: StatusDone) => {
      const asked = this.waiting.get(done.id);
      if (!asked) return;
      this.waiting.delete(done.id);
      if (done.ok) asked.resolve(done.made);
      else asked.reject(Object.assign(new Error(done.message), done.stack ? { stack: done.stack } : {}));
    });
    const gone = (why: string) => {
      if (this.worker === w) this.worker = undefined;
      // a thread that cannot start or dies: the next ones made here (once said)
      if (!this.ended && !this.broken) {
        this.broken = true;
        this.o.note(`the thread of /status ended (${why}): /status made on the bridge's thread`);
      }
      for (const [, asked] of this.waiting) asked.reject(new Error(why));
      this.waiting.clear();
    };
    w.on("error", (e) => gone(e.message));
    w.on("exit", (code) => gone(`exit ${code}`));
    this.worker = w;
    return w;
  }
}
