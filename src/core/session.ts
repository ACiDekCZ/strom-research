// Sessions: one agent working on one task. While a session is open, every
// operation is logged under its ID (data/ops/N0001.jsonl) and the tree knows
// who wrote what. Several agents may work side by side, each in a session of
// its own on a task of its own: the current session of an agent strom started
// lives in .strom/session-<worker>.json (STROM_WORKER, set by strom chat), of
// any other in .strom/session.json (local state, not evidence), or in
// STROM_SESSION (set by `strom run`).

import fs from "node:fs";
import path from "node:path";
import { UsageError } from "./errors.ts";
import type { Session, Task } from "./model.ts";
import { now, type Tree } from "./tree.ts";
import { makeNote } from "./actions.ts";
import type { Env } from "./paths.ts";
import { detectAgent } from "./which.ts";
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

/** The open session of this tree, if any. */
export function currentSession(tree: Tree, env: Env): Session | undefined {
  let id = env.STROM_SESSION;
  if (!id) {
    try {
      id = (JSON.parse(fs.readFileSync(currentFile(tree, env), "utf8")) as { id?: string }).id;
    } catch {
      return undefined;
    }
  }
  const s = id ? tree.get<Session>(id) : undefined;
  return s?.state === "open" ? s : undefined;
}

export function setCurrent(tree: Tree, id: string | undefined): void {
  if (tree.dryRun) return;
  const file = currentFile(tree);
  if (id === undefined) fs.rmSync(file, { force: true });
  else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ id, at: now() }) + "\n");
  }
}

export function openSessions(tree: Tree): Session[] {
  return tree.list<Session>("session").filter((s) => s.state === "open");
}

/** Start a session on a task (the task goes to "doing"). One open session per agent; one agent per task. */
export function startSession(tree: Tree, opts: { task?: Task; research?: string; runner?: string }): Session {
  return tree.withTreeLock(() => {
    const me = holderOf(tree.env, opts.runner);
    const busy = openSessions(tree).filter((s) => holder(s) === me && (!opts.research || !s.research || s.research === opts.research));
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
    };
    tree.put(s, { op: "session.start", targets: [s.id, ...(task ? [task.id] : [])], summary: `${s.id} session started${task ? ` on ${task.id}` : ""}` });
    tree.actor = s.id;
    if (task && task.state !== "doing") {
      const doing = { ...task, state: "doing" as const, updated: now() };
      tree.put(doing, { op: "task.start", targets: [doing.id, s.id], summary: `${doing.id} start` });
    }
    setCurrent(tree, s.id);
    return s;
  });
}

export function sessionNote(tree: Tree, s: Session, text: string): Session {
  return tree.withTreeLock(() => {
    const next = { ...s, notes: [...s.notes, makeNote(tree, text)], updated: now() };
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
  return tree.withTreeLock(() => {
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
      ...(input.endedBy ? { endedBy: input.endedBy } : {}),
    };
    tree.put(closed, { op: "session.close", targets: [s.id], summary: `${s.id} ${closed.state}: ${(input.summary || "no summary").slice(0, 80)}` });
    // Only the session this agent calls its current one is forgotten — not another agent's.
    if (currentSession(tree, tree.env)?.id === s.id) setCurrent(tree, undefined);
    return closed;
  });
}

/** The last closed sessions (newest first), optionally of one research. */
export function recentSessions(tree: Tree, research?: string, n = 2): Session[] {
  return tree
    .list<Session>("session")
    .filter((s) => s.state !== "open" && (!research || !s.research || s.research === research))
    .sort((a, b) => (b.ended ?? b.updated).localeCompare(a.ended ?? a.updated))
    .slice(0, n);
}
