// Holds of tasks (spec 127): a task is held by the open session working on it, and that session lives while its holder
// gives a sign of life. A hold is a small file beside the research (.strom/holds/<N…>.json, local state, never data):
// who holds the session, the process (a run or a conversation strom started), and when it last gave a sign (beat) —
// every command of strom in the session, the agent's hooks, the run's and the conversation's own timer. A hold whose
// process on this computer is gone lapses at once; any other when no sign came for task.hold (30 minutes unless set).
// A lapsed session is taken over by the next one who wants work (core/session.ts claimTask): closed as interrupted, its
// task back in the queue, and .strom/taken/<N…>.json says so to its old holder, whose writes are refused from then on.
// Nothing of it is in the data: an older strom reads and writes the research as before.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Session } from "./model.ts";
import type { Env } from "./paths.ts";
import { liveHolder, machineId, processAlive } from "./lock.ts";
import { readJsonIfExists, writeFileAtomic } from "./json.ts";
import { opsLogsOf } from "./opslog.ts";
import { isWorkerId, workerHolder } from "./workers.ts";
import { VERSION } from "./tree.ts";

export interface Hold {
  session: string;
  task?: string;
  research?: string;
  /** Who started it: a run strom started, a conversation strom started, or an agent (or a person) working directly. */
  by: "run" | "chat" | "agent";
  worker?: string;
  agent?: string;
  /** The agent's own conversation (CLAUDE_CODE_SESSION_ID, CODEX_THREAD_ID…): an agent working directly is told by it. */
  agentSession?: string;
  /** The process of a run or a conversation strom started (its worker's), on this computer or another. */
  pid?: number;
  host?: string;
  machine?: string;
  since: string;
  /** The last sign of life. */
  beat: string;
  /** Written again how many times. */
  seq: number;
  version: string;
}

/** A session taken over from its holder: what its old holder is told when it writes again. */
export interface Taken {
  session: string;
  task?: string;
  /** The session that took the work over (none: taken over by someone who then took no task). */
  by?: string;
  at: string;
  reason: "expired" | "dead";
  /** Minutes since its last sign of life. */
  minutes: number;
  worker?: string;
  agentSession?: string;
}

/** A sign of life is written at most this often (a command of strom, a hook, the run's timer). */
export const BEAT_MS = 60_000;
/** A beat further ahead than this is a clock gone wrong: taken as now. */
const FUTURE_MS = 2 * 60_000;
/** A record of a session taken over is kept this long for its old holder to read. */
const TAKEN_KEPT_MS = 7 * 24 * 3600_000;

function holdsDir(root: string): string {
  return path.join(root, ".strom", "holds");
}

export function holdFile(root: string, session: string): string {
  return path.join(holdsDir(root), `${session}.json`);
}

function takenDir(root: string): string {
  return path.join(root, ".strom", "taken");
}

export function takenFile(root: string, session: string): string {
  return path.join(takenDir(root), `${session}.json`);
}

/** The id of the conversation of an agent working directly (no worker of strom's), when its CLI says one. */
export function directAgentId(env: Env): string | undefined {
  const id = env.CLAUDE_CODE_SESSION_ID || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID || env.GROK_SESSION_ID || env.OPENCODE_SESSION_ID;
  return id && /^[\p{L}\p{N}._-]{1,120}$/u.test(id) ? id : undefined;
}

/** A session's hold and when its file was written (the disk's own time: another computer's clock may be wrong). */
export function readHold(root: string, session: string): { hold: Hold; mtimeMs: number } | undefined {
  const file = holdFile(root, session);
  try {
    const hold = JSON.parse(fs.readFileSync(file, "utf8")) as Hold;
    if (!hold || typeof hold !== "object" || typeof hold.beat !== "string") return undefined;
    return { hold, mtimeMs: fs.statSync(file).mtimeMs };
  } catch {
    return undefined;
  }
}

export function writeHold(root: string, hold: Hold): void {
  writeFileAtomic(holdFile(root, hold.session), JSON.stringify(hold, null, 2) + "\n");
}

export function removeHold(root: string, session: string): void {
  fs.rmSync(holdFile(root, session), { force: true });
}

/** The sessions holds are kept of (whatever their state: one of a closed session is left over). */
export function heldSessions(root: string): string[] {
  try {
    return fs.readdirSync(holdsDir(root)).filter((f) => /^N\d+\.json$/.test(f)).map((f) => f.slice(0, -5));
  } catch {
    return [];
  }
}

/** Is the process a hold names on this computer (its name, or its system id when the name changed)? */
function onThisComputer(h: Pick<Hold, "pid" | "host" | "machine">): boolean {
  return h.pid !== undefined && (h.host === os.hostname() || (h.machine !== undefined && h.machine === machineId()));
}

/** The hold's last sign of life, ms: its beat or its file's time, the later — a time ahead of `now` (a wrong clock) as now. */
export function lastSign(h: Pick<Hold, "beat" | "since">, now: number, mtimeMs?: number): number {
  const sure = (t: number) => (Number.isFinite(t) ? (t > now + FUTURE_MS ? now : Math.min(t, now)) : 0);
  return Math.max(sure(Date.parse(h.beat)), sure(mtimeMs ?? NaN), 0);
}

/**
 * Does a hold still hold (spec 127, design chapter 3)? Its process on this computer gone: no, at once. Otherwise while its
 * last sign of life is younger than `holdMs` — a process stopped (SIGSTOP, a computer asleep) or a pid the system gave to
 * another process gives none, so it lapses after `holdMs`; a clock gone wrong only keeps it longer.
 */
export function holdAlive(h: Hold, now: number, holdMs: number, mtimeMs?: number): boolean {
  if (onThisComputer(h) && !processAlive(h.pid!)) return false;
  return now - lastSign(h, now, mtimeMs) < holdMs;
}

export interface Life {
  alive: boolean;
  /** Why it lapsed: its process here is gone, or no sign of life came for the hold's time. */
  reason?: "dead" | "expired";
  hold?: Hold;
  since: number;
  lastSign: number;
  /** When it lapses with no further sign (none: it lasts while its process lives). */
  until?: number;
  /** A live process on this computer holds it: free when it ends. */
  here: boolean;
}

/**
 * The life of an open session: by its hold; a session without one (an older strom's, or of a version before holds) by its
 * worker while that lives, an old run by its run.lock, and any other by the last write to its operation logs (else its
 * start) — lapsed `holdMs` after it.
 */
export function sessionLife(root: string, dataDir: string, s: Session, now: number, holdMs: number): Life {
  const since = Date.parse(s.started) || now;
  const read = readHold(root, s.id);
  if (read) {
    const h = read.hold;
    const last = lastSign(h, now, read.mtimeMs);
    const here = onThisComputer(h);
    if (here && !processAlive(h.pid!)) return { alive: false, reason: "dead", hold: h, since, lastSign: last, here: false };
    const alive = now - last < holdMs;
    return { alive, ...(alive ? {} : { reason: "expired" as const }), hold: h, since, lastSign: last, until: last + holdMs, here: alive && here };
  }
  if (s.worker) {
    const w = workerHolder(root, s.worker);
    return w ? { alive: true, since, lastSign: now, here: w.host === os.hostname() || (w.machine !== undefined && w.machine === machineId()) } : { alive: false, reason: "dead", since, lastSign: since, here: false };
  }
  if (s.runner) {
    const old = liveHolder(path.join(root, ".strom", "run.lock"));
    return old ? { alive: true, since, lastSign: now, here: old.host === os.hostname() } : { alive: false, reason: "dead", since, lastSign: since, here: false };
  }
  let last = since;
  for (const f of opsLogsOf(dataDir, s.id)) {
    try {
      last = Math.max(last, Math.min(fs.statSync(f).mtimeMs, now));
    } catch {
      // gone meanwhile
    }
  }
  const alive = now - last < holdMs;
  return { alive, ...(alive ? {} : { reason: "expired" as const }), since, lastSign: last, until: last + holdMs, here: false };
}

/** Who holds a session started by this process: the run or conversation strom started (its process), or the agent itself. */
export function newHold(root: string, s: Session, env: Env): Hold {
  const worker = isWorkerId(env.STROM_WORKER) ? env.STROM_WORKER : undefined;
  const proc = worker ? workerHolder(root, worker) : undefined;
  const agentSession = worker ? undefined : directAgentId(env);
  const t = new Date().toISOString();
  return {
    session: s.id,
    ...(s.task ? { task: s.task } : {}),
    ...(s.research ? { research: s.research } : {}),
    by: s.runner ? "run" : worker ? "chat" : "agent",
    ...(worker ? { worker } : {}),
    ...(s.agent ? { agent: s.agent } : {}),
    ...(agentSession ? { agentSession } : {}),
    ...(proc ? { pid: proc.pid, host: proc.host, ...(proc.machine ? { machine: proc.machine } : {}) } : {}),
    since: t,
    beat: t,
    seq: 1,
    version: VERSION,
  };
}

/**
 * A sign of life of an open session: its hold's beat now (at most once a minute unless `force`); a session with no hold
 * yet (opened by an older strom) gets one when `create`. Never throws: a sign not written changes nothing of the command.
 */
export function beatSession(root: string, s: Session, env: Env, opts: { create?: boolean; force?: boolean } = {}): void {
  try {
    const read = readHold(root, s.id);
    if (!read) {
      if (opts.create) writeHold(root, newHold(root, s, env));
      return;
    }
    const now = Date.now();
    if (!opts.force && now - Date.parse(read.hold.beat) < BEAT_MS && now - read.mtimeMs < BEAT_MS) return;
    writeHold(root, { ...read.hold, beat: new Date(now).toISOString(), seq: (read.hold.seq ?? 0) + 1 });
  } catch {
    // not written: the next command writes it
  }
}

/**
 * The holds of one who works (a run's or a conversation's worker, a session strom run set, an agent's own conversation)
 * beat: what the agent's hooks and the timers of strom run and strom chat call — nothing of the tree opened.
 */
export function beatHolds(root: string, env: Env, opts: { force?: boolean } = {}): void {
  const worker = isWorkerId(env.STROM_WORKER) ? env.STROM_WORKER : undefined;
  const agentSession = worker ? undefined : directAgentId(env);
  if (!env.STROM_SESSION && !worker && !agentSession) return;
  for (const id of heldSessions(root)) {
    const read = readHold(root, id);
    if (!read) continue;
    const h = read.hold;
    const mine = id === env.STROM_SESSION || (worker !== undefined && h.worker === worker) || (agentSession !== undefined && h.agentSession === agentSession);
    if (!mine) continue;
    const now = Date.now();
    if (!opts.force && now - Date.parse(h.beat) < BEAT_MS && now - read.mtimeMs < BEAT_MS) continue;
    try {
      writeHold(root, { ...h, beat: new Date(now).toISOString(), seq: (h.seq ?? 0) + 1 });
    } catch {
      // the next beat
    }
  }
}

export function writeTaken(root: string, t: Taken): void {
  writeFileAtomic(takenFile(root, t.session), JSON.stringify(t, null, 2) + "\n");
}

export function readTaken(root: string, session: string): Taken | undefined {
  try {
    return readJsonIfExists<Taken>(takenFile(root, session));
  } catch {
    return undefined;
  }
}

/** Records of sessions taken over long ago, and holds of sessions no longer open: gone (claimTask, under the tree's lock). */
export function clearOld(root: string, open: Set<string>, now: number): void {
  for (const id of heldSessions(root)) if (!open.has(id)) removeHold(root, id);
  let names: string[] = [];
  try {
    names = fs.readdirSync(takenDir(root));
  } catch {
    return;
  }
  for (const n of names) {
    const file = path.join(takenDir(root), n);
    try {
      if (now - fs.statSync(file).mtimeMs > TAKEN_KEPT_MS) fs.rmSync(file, { force: true });
    } catch {
      // gone meanwhile
    }
  }
}
