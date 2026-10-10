// Sessions: one agent working on one task. While a session is open, every
// operation is logged under its ID (data/ops/N0001.jsonl) and the tree knows
// who wrote what. Several agents may work side by side, each in a session of
// its own on a task of its own: the current session of an agent strom started
// lives in .strom/session-<worker>.json (STROM_WORKER, set by strom chat), of
// any other in .strom/session.json (local state, not evidence), or in
// STROM_SESSION (set by `strom run`). An agent may hold one session in each
// research (two conversations of the desktop app, neither started by strom):
// each research's session has its own pointer, .strom/sessions/<worker>~<G…>.json,
// and a command finds its own by what it names (a task, a session, a research).

import fs from "node:fs";
import path from "node:path";
import { UsageError } from "./errors.ts";
import type { Session, Task } from "./model.ts";
import { now, VERSION, type Tree } from "./tree.ts";
import { makeNote, makeNotes } from "./actions.ts";
import type { Env } from "./paths.ts";
import { detectAgent } from "./which.ts";
import { finishAsked, finishByLimit, finishFile } from "./clock.ts";
import { isLiveWorker, isWorkerId } from "./workers.ts";

function currentFile(tree: Tree, env: Env = tree.env): string {
  const w = env.STROM_WORKER;
  return path.join(tree.root, ".strom", isWorkerId(w) ? `session-${w}.json` : "session.json");
}

/** Who holds a session, for keeping agents apart: its worker, a run, or anyone else. */
function holder(s: Pick<Session, "worker" | "runner">): string {
  return s.worker ?? (s.runner ? "run" : "");
}

/** Who this process works for. */
function holderOf(env: Env, runner?: string): string {
  return isWorkerId(env.STROM_WORKER) ? env.STROM_WORKER : runner ? "run" : "";
}

/** Open sessions of other agents, and the tasks they hold. */
export function othersAtWork(tree: Tree, env: Env = tree.env, runner?: string): { sessions: Session[]; tasks: Set<string> } {
  const me = holderOf(env, runner);
  const sessions = openSessions(tree).filter((s) => holder(s) !== me);
  return { sessions, tasks: new Set(sessions.flatMap((s) => (s.task ? [s.task] : []))) };
}

/**
 * Sessions whose agent is gone: strom chat ended (or the computer went down)
 * with the session still open. The tree knows it from the worker's presence.
 */
export function abandonedSessions(tree: Tree): Session[] {
  return openSessions(tree).filter((s) => s.worker && !isLiveWorker(tree.root, s.worker));
}

/** The folder of the pointers of each research's session. */
function researchPointers(tree: Tree): string {
  return path.join(tree.root, ".strom", "sessions");
}

/** This agent's pointer to its session in one research ("~" is no letter of a worker's name). */
function researchFile(tree: Tree, research: string, env: Env = tree.env): string {
  const w = env.STROM_WORKER;
  return path.join(researchPointers(tree), `${isWorkerId(w) ? w : ""}~${research}.json`);
}

function pointerId(file: string): string | undefined {
  try {
    return (JSON.parse(fs.readFileSync(file, "utf8")) as { id?: string }).id;
  } catch {
    return undefined;
  }
}

/** The open sessions this agent's pointers name: the one pointer of an older strom, and one per research. */
export function ownSessions(tree: Tree, env: Env): Session[] {
  const w = env.STROM_WORKER;
  const prefix = `${isWorkerId(w) ? w : ""}~`;
  let names: string[] = [];
  try {
    names = fs.readdirSync(researchPointers(tree)).filter((n) => n.startsWith(prefix) && n.endsWith(".json"));
  } catch {
    // none yet
  }
  const ids = [pointerId(currentFile(tree, env)), ...names.map((n) => pointerId(path.join(researchPointers(tree), n)))];
  const out: Session[] = [];
  for (const id of ids) {
    const s = id ? tree.get<Session>(id) : undefined;
    if (s?.type === "session" && s.state === "open" && !out.includes(s)) out.push(s);
  }
  return out.sort((a, b) => a.started.localeCompare(b.started));
}

/** Of several sessions, the one the IDs a command names belong to: the session, its research, its task. */
function sessionOf(tree: Tree, sessions: Session[], refs: string[]): Session | undefined {
  for (const ref of refs) {
    const r = ref.toUpperCase();
    const task = /^T\d+$/.test(r) ? tree.get<Task>(r) : undefined;
    const hits = sessions.filter((s) => s.id === r || s.research === r || (task && (s.task === task.id || (!!task.research && s.research === task.research))));
    if (hits.length === 1) return hits[0];
  }
  return undefined;
}

/**
 * The open session of this agent: STROM_SESSION, else its pointers — with one in each of several researches, the one
 * of what the command names (`refs`: T…, N…, G…), else the one started last.
 */
export function currentSession(tree: Tree, env: Env, refs: string[] = []): Session | undefined {
  if (env.STROM_SESSION) {
    const s = tree.get<Session>(env.STROM_SESSION);
    return s?.state === "open" ? s : undefined;
  }
  const own = ownSessions(tree, env);
  if (own.length <= 1) return own[0];
  return sessionOf(tree, own, refs) ?? own.at(-1);
}

/** Several sessions of this agent and nothing the command names to tell which: the ones to choose from. */
export function whichSession(tree: Tree, env: Env, refs: string[] = []): Session[] | undefined {
  if (env.STROM_SESSION) return undefined;
  const own = ownSessions(tree, env);
  return own.length > 1 && !sessionOf(tree, own, refs) ? own : undefined;
}

/**
 * Point this agent at a session (its research's pointer, and the one pointer an older strom reads), or forget one:
 * only the pointers that name it.
 */
export function setCurrent(tree: Tree, id: string | undefined, forget?: Session): void {
  if (tree.dryRun) return;
  const file = currentFile(tree);
  if (id === undefined) {
    if (!forget || pointerId(file) === forget.id) fs.rmSync(file, { force: true });
    if (forget?.research && pointerId(researchFile(tree, forget.research)) === forget.id) fs.rmSync(researchFile(tree, forget.research), { force: true });
    return;
  }
  const line = JSON.stringify({ id, at: now() }) + "\n";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, line);
  const research = tree.get<Session>(id)?.research;
  if (research) {
    fs.mkdirSync(researchPointers(tree), { recursive: true });
    fs.writeFileSync(researchFile(tree, research), line);
  }
}

export function openSessions(tree: Tree): Session[] {
  return tree.list<Session>("session").filter((s) => s.state === "open");
}

/** Start a session on a task (the task goes to "doing"). One open session per agent; one agent per task. */
export function startSession(tree: Tree, opts: { task?: Task; research?: string; runner?: string; model?: string }): Session {
  return tree.withTreeLock(() => {
    const me = holderOf(tree.env, opts.runner);
    // one open session per agent in each research (each has its own pointer); a session of no research is the agent's only one
    const research = opts.research ?? opts.task?.research;
    const busy = openSessions(tree).filter((s) => holder(s) === me && (!research || !s.research || s.research === research));
    if (busy.length)
      throw new UsageError(`session ${busy[0]!.id} is still open${busy[0]!.task ? ` on ${busy[0]!.task}` : ""}`, {
        hint: `finish it: strom session close --summary "…" --next "…"   (or, if it died: strom session close ${busy[0]!.id} --interrupted)`,
      });
    const taken = opts.task ? othersAtWork(tree, tree.env, opts.runner).sessions.find((s) => s.task === opts.task!.id) : undefined;
    if (taken)
      throw new UsageError(`${opts.task!.id} is being worked on in session ${taken.id}${taken.agent ? ` (${taken.agent})` : ""}`, {
        hint: "take another task: strom session start (the next free one)",
      });
    const task = opts.task ? (tree.get<Task>(opts.task.id) ?? opts.task) : undefined;
    const agent = detectAgent(tree.env) ?? (opts.runner && opts.runner !== "script" ? opts.runner : undefined);
    // the model strom started the agent with (strom run, strom chat): what it read with, for a later review
    const model = opts.model ?? tree.env.STROM_MODEL?.trim();
    const t = now();
    const s: Session = {
      id: tree.allocate("N"),
      type: "session",
      state: "open",
      started: t,
      notes: [],
      created: t,
      updated: t,
      ...(opts.task ? { task: opts.task.id } : {}),
      ...(opts.research ?? opts.task?.research ? { research: (opts.research ?? opts.task?.research)! } : {}),
      ...(opts.runner ? { runner: opts.runner } : {}),
      ...(isWorkerId(tree.env.STROM_WORKER) ? { worker: tree.env.STROM_WORKER } : {}),
      ...(agent ? { agent } : {}),
      ...(model ? { model } : {}),
      strom: VERSION,
    };
    tree.put(s, { op: "session.start", targets: [s.id, ...(task ? [task.id] : [])], summary: `${s.id} session started${task ? ` on ${task.id}` : ""}` });
    tree.actor = s.id;
    if (task && task.state !== "doing") {
      // taken up: what kept it aside goes (a parked task's date and reason)
      const { parkedUntil: _until, parkedReason: _reason, ...rest } = task;
      const doing = { ...rest, state: "doing" as const, updated: now() };
      tree.put(doing, { op: "task.start", targets: [doing.id, s.id], summary: `${doing.id} start` });
    }
    setCurrent(tree, s.id);
    return s;
  });
}

export function sessionNote(tree: Tree, s: Session, text: string): Session {
  return tree.withTreeLock(() => {
    const next = { ...s, notes: [...s.notes, ...makeNotes(tree, text)], updated: now() };
    tree.put(next, { op: "session.note", targets: [s.id], summary: `${s.id} note: ${text.slice(0, 60)}` });
    return next;
  });
}

export interface CloseInput {
  summary: string;
  next: string;
  continueTask?: boolean;
  interrupted?: boolean;
  metrics?: Session["metrics"];
  /** strom closes it, not its agent — why. */
  endedBy?: Session["endedBy"];
}

/** Close a session. The task must not be left "doing" — done, parked, waiting, or explicitly continued. */
export function closeSession(tree: Tree, s: Session, input: CloseInput): Session {
  if (!input.interrupted && (!input.summary.trim() || !input.next.trim()))
    throw new UsageError("closing needs --summary and --next", { hint: 'e.g. --summary "found the baptism, parents Josef and Marie" --next "marriage of Josef ~1898 in B0002"' });
  const closed = tree.withTreeLock(() => {
    s = tree.get<Session>(s.id) ?? s;
    const task = s.task ? tree.get<Task>(s.task) : undefined;
    if (task && task.state === "doing") {
      if (!input.continueTask && !input.interrupted)
        throw new UsageError(`task ${task.id} is still in progress`, {
          hint: `close it first: strom task done ${task.id} --result "…" | task park | task wait — or keep it for the next session: --continue`,
        });
      const back: Task = { ...task, state: "open", notes: [...task.notes, makeNote(tree, `${input.interrupted ? "interrupted" : "continued"} in ${s.id}: ${input.next || "(no handover)"}`.slice(0, 500))], updated: now() };
      tree.put(back, { op: "task.continue", targets: [task.id, s.id], summary: `${task.id} back to the queue` });
    }
    const closed: Session = {
      ...s,
      state: input.interrupted ? "interrupted" : "closed",
      ended: now(),
      updated: now(),
      ...(input.summary.trim() ? { summary: input.summary.trim() } : {}),
      ...(input.next.trim() ? { next: input.next.trim() } : {}),
      ...(input.metrics ? { metrics: input.metrics } : {}),
      // asked to finish by the user (strom session finish): theirs, and a run stops after it
      ...(input.endedBy ? { endedBy: input.endedBy } : finishAsked(tree.root, s.id) && !finishByLimit(tree.root, s.id) ? { endedBy: "user" as const } : {}),
    };
    tree.put(closed, { op: "session.close", targets: [s.id], summary: `${s.id} ${closed.state}: ${(input.summary || "no summary").slice(0, 80)}` });
    // Only the session this agent calls its current one is forgotten — not another agent's.
    setCurrent(tree, undefined, s);
    return closed;
  });
  // asked to finish (strom session finish): done
  if (!tree.dryRun) fs.rmSync(finishFile(tree.root, closed.id), { force: true });
  return closed;
}

/** The last closed sessions (newest first), optionally of one research. */
export function recentSessions(tree: Tree, research?: string, n = 2): Session[] {
  return tree
    .list<Session>("session")
    .filter((s) => s.state !== "open" && (!research || !s.research || s.research === research))
    .sort((a, b) => (b.ended ?? b.updated).localeCompare(a.ended ?? a.updated))
    .slice(0, n);
}

/**
 * What the agent's sessions of a month ("2026-09", by when they started) cost: how many, the dollars known (a session
 * stopped before it said: its known part) — the readers they started included, and their part apart.
 */
export function monthSpend(tree: Tree, month: string): { month: string; sessions: number; amount: number; readers?: number } {
  const of = tree.list<Session>("session").filter((s) => s.started.slice(0, 7) === month);
  const amount = of.reduce((sum, s) => sum + (sessionCost(s.metrics) ?? 0), 0);
  const readers = of.reduce((sum, s) => sum + (s.metrics?.readersUsd ?? 0), 0);
  return { month, sessions: of.length, amount: cents(amount), ...(readers > 0 ? { readers: cents(readers) } : {}) };
}

const cents = (usd: number) => Math.round(usd * 100) / 100;

/** What a session cost in all: the agent's own and the readers it started (undefined: nothing known). */
export function sessionCost(m: Session["metrics"]): number | undefined {
  if (m?.costUsd === undefined && m?.readersUsd === undefined) return undefined;
  return cents((m.costUsd ?? 0) + (m.readersUsd ?? 0));
}

/** More was spent than the session's cost says: the agent or a reader stopped before it said. */
export function costPartial(m: Session["metrics"]): boolean {
  return !!(m?.costPartial || m?.readersPartial);
}

/** The metrics of a session the agent reported, keeping what its readers cost (strom recorded that, not the agent). */
export function withReaders(reported: NonNullable<Session["metrics"]>, had: Session["metrics"]): NonNullable<Session["metrics"]> {
  const { readersUsd, readers, readersPartial } = had ?? {};
  return { ...reported, ...(readersUsd !== undefined ? { readersUsd } : {}), ...(readers !== undefined ? { readers } : {}), ...(readersPartial ? { readersPartial } : {}) };
}

/**
 * Readers started from a session (strom read, clips, transcripts — the agent's command): what they cost is added to
 * that session, kept apart from the agent's own. No session open (the user's own command): nothing. The session's ID.
 */
export function addReaders(tree: Tree, env: Env, refs: string[], spent: { usd: number; runs: number; partial: boolean }): string | undefined {
  if (tree.dryRun || spent.runs <= 0) return undefined;
  return tree.withTreeLock(() => {
    const s = currentSession(tree, env, refs);
    if (!s) return undefined;
    const m = s.metrics ?? {};
    const metrics = {
      ...m,
      readersUsd: cents((m.readersUsd ?? 0) + spent.usd),
      readers: (m.readers ?? 0) + spent.runs,
      ...(spent.partial || m.readersPartial ? { readersPartial: true } : {}),
    };
    tree.put({ ...s, metrics, updated: now() }, { op: "session.readers", targets: [s.id], summary: `${s.id} readers: ${spent.runs} · $${spent.usd.toFixed(2)}` });
    return s.id;
  });
}
