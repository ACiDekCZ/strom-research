// Runs of a line (spec 126, B): `strom run --research G…` holds its line while it lives (.strom/lines/<G…>.json, a
// lock that dies with its process): a second run of the same line is refused in one sentence, and the work of the line
// is its alone. A task belongs to a set of lines — its own, the lines its people are in, the line it helps — and has one
// main line (core/offline.ts placer: its own unless ended, else the narrowest active line of its people). A run of line
// G takes the tasks whose main line is G, and shared tasks whose main line has no run; never a task whose main line
// another run holds (two lines meeting in a common ancestor: its question goes to one run, which sees its own work).
// A run of the whole queue leaves every task of a line with a run of its own. Work off the lines, history and places,
// and a task about nobody of no line stay the whole queue's. At most run.parallel runs work in a tree (default 3);
// conversations are not counted. Nothing in data/ changes: the locks are in .strom/.

import fs from "node:fs";
import path from "node:path";
import { acquireLock, liveHolder } from "./lock.ts";
import { LockedError, UsageError } from "./errors.ts";
import type { Task } from "./model.ts";
import { aboutPeople, scopes } from "./directions.ts";
import { placer } from "./offline.ts";
import { enterWorker, runsAtWork, type Worker } from "./workers.ts";
import { rememberLineAgent } from "./runstate.ts";
import type { Tree } from "./tree.ts";

export { DEFAULT_RUN_PARALLEL, RUN_PARALLEL_MAX } from "./config.ts";

const WEEK = 7 * 24 * 3600_000;

function linesDir(root: string): string {
  return path.join(root, ".strom", "lines");
}

export function lineFile(root: string, research: string): string {
  return path.join(linesDir(root), `${research}.json`);
}

/** A line held by a run: the run (its worker), since when, its process. */
export interface LineHold {
  research: string;
  worker: string;
  since: string;
  pid: number;
}

/** The lines held by runs alive now (read only: the lock of a run gone is no holder). */
export function lineHolds(root: string): Map<string, LineHold> {
  const out = new Map<string, LineHold>();
  let files: string[] = [];
  try {
    files = fs.readdirSync(linesDir(root)).filter((f) => /^G\d+\.json$/.test(f));
  } catch {
    return out;
  }
  for (const f of files) {
    const info = liveHolder(path.join(linesDir(root), f), WEEK);
    if (info) out.set(f.slice(0, -5), { research: f.slice(0, -5), worker: info.owner, since: info.at, pid: info.pid });
  }
  return out;
}

/** The time of a lock for a person: 12:29 today, else the day too. */
function at(iso: string, lang = "en"): string {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString(lang, today ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** How a run is stopped, for the agent: its window, or its session finished. */
const STOP_HINT = "stop a run in its own window (Ctrl-C finishes its session first), or ask it to stop: strom run stop <run-…> [--finish], or finish its session: strom session finish <N…> (strom session list --open)";

/**
 * A run starting (strom run): under a short lock of the tree's lines, the runs at work are counted against run.parallel,
 * a run of a line takes its line (refused when another run holds it, or a run of a strom before 1.25 works here: it
 * knows no lines), and the run's worker is entered — so two starting at once never both pass. Returns what to call at
 * the run's end (the line let go, the worker gone).
 */
export function enterRun(
  root: string,
  run: { worker: string; label: string; version: string; agent: string; research?: string; max: number },
): () => void {
  const leaveStart = acquireLock(path.join(linesDir(root), ".start.lock"), { owner: run.worker, waitMs: 15_000, staleMs: 60_000 });
  let leaveLine: (() => void) | undefined;
  try {
    const refused = refusalOf(root, runsAtWork(root), run.research, run.max);
    if (refused) throw refused;
    if (run.research) {
      try {
        leaveLine = acquireLock(lineFile(root, run.research), { owner: run.worker, waitMs: 0, staleMs: WEEK, machine: true, version: run.version });
      } catch (e) {
        if (!(e instanceof LockedError)) throw e;
        throw new UsageError(`line ${run.research} has a run already — one run per line`, { code: "run.line.held", params: { research: run.research }, hint: STOP_HINT });
      }
    }
    // the worker after the line: never present as a run of a line it does not hold
    const leaveWorker = enterWorker(root, run.worker, run.label, run.version, { ...(run.research ? { research: run.research } : {}), agent: run.agent });
    // the agent of the line's last run, remembered for the line (the Strom app offers it again)
    if (run.research) rememberLineAgent(root, run.research, run.agent);
    const line = leaveLine;
    leaveLine = undefined;
    return () => {
      leaveWorker();
      line?.();
    };
  } finally {
    leaveLine?.();
    leaveStart();
  }
}

/**
 * Why a run would be refused now (read only, nothing taken): a run of an older strom beside a run of a line, the line
 * held, run.parallel reached — the refusal enterRun gives; none: it would start (as things are now).
 */
export function runRefusal(root: string, run: { research?: string; max: number }): UsageError | undefined {
  return refusalOf(root, runsAtWork(root), run.research, run.max);
}

function refusalOf(root: string, runs: Worker[], research: string | undefined, max: number): UsageError | undefined {
  if (research) {
    const old = runs.find((w) => w.id === "run" && !w.version);
    if (old)
      return new UsageError(`a run of an older strom (before 1.25) works in this tree since ${at(old.since)}: it knows no lines and takes any task — a run of line ${research} starts once it ended`, {
        code: "run.line.older",
        params: { research, since: old.since },
        hint: "end the older run first (its own window), then strom run --research again",
      });
    const held = lineHolds(root).get(research);
    if (held)
      return new UsageError(`line ${research} has a run already: ${held.worker} (since ${at(held.since)}) — one run per line`, {
        code: "run.line.held",
        params: { research, run: held.worker, since: held.since },
        hint: `another line: strom run --research <G…> (strom research list), or the whole queue: strom run — ${STOP_HINT}`,
      });
  }
  if (runs.length >= max)
    return new UsageError(`${runs.length} runs work in this tree already (run.parallel ${max}): ${runs.map((w) => `${w.id}${w.research ? ` (${w.research})` : ""}`).join(", ")}`, {
      code: "run.parallel",
      params: { running: String(runs.length), max: String(max) },
      hint: `${STOP_HINT}; more at once is the person's choice: strom config set run.parallel <n>`,
    });
  return undefined;
}

/** Runs of a strom that knows no lines at work beside this one (before 1.36: a run's worker says no agent). */
export function runsWithoutLines(root: string, own: string): Worker[] {
  return runsAtWork(root).filter((w) => w.id !== own && !w.agent);
}

/**
 * Which tasks a run may take, as the lines are held now: `research` — the run's own line (none: the whole queue);
 * `own` — the run's worker (its own line is no other's). Computed once for a turn of the run.
 */
export function lineRunFilter(tree: Tree, research: string | undefined, own: string): (t: Task) => boolean {
  const holds = [...lineHolds(tree.root).values()].filter((h) => h.worker !== own);
  const others = new Set(holds.map((h) => h.research));
  // nothing held by another run, and a run of the whole queue: everything as before
  if (!research && !others.size) return () => true;
  const lines = linesOfTasks(tree);
  const memo = new Map<string, { lines: Set<string>; main?: string }>();
  const of = (t: Task) => {
    let m = memo.get(t.id);
    if (!m) memo.set(t.id, (m = lines(t)));
    return m;
  };
  if (!research) return (t) => ![...of(t).lines].some((g) => others.has(g));
  return (t) => {
    const { lines, main } = of(t);
    if (main === research) return true;
    return lines.has(research) && !(main && others.has(main));
  };
}

/**
 * The lines of a task: its own, its main one (placer: the line it belongs to or helps), and every line its people are
 * in — none for work off the lines, history, places and a task about nobody of no line.
 */
export function linesOfTasks(tree: Tree): (t: Task) => { lines: Set<string>; main?: string } {
  const all = scopes(tree);
  const place = placer(tree, all);
  return (t) => {
    const main = place(t).research;
    const about = aboutPeople(tree, t.subject);
    const lines = new Set<string>([...(t.research ? [t.research] : []), ...(main ? [main] : []), ...all.filter((s) => about.some((p) => s.people.has(p))).map((s) => s.research.id)]);
    return { lines, ...(main ? { main } : {}) };
  };
}

/**
 * Which run takes each task, as the lines are held now (the Strom app's queue[].run): a task whose main line a run
 * holds is that run's; a shared task (a common ancestor, help to another line) whose main line has no run goes to the
 * run of a line it is in; none — the whole queue's (a general run). Worked out once (for a /status); undefined when no
 * line is held.
 */
export function runTakers(tree: Tree): ((t: Task) => string | undefined) | undefined {
  const holds = lineHolds(tree.root);
  if (!holds.size) return undefined;
  const lines = linesOfTasks(tree);
  return (t) => {
    const { lines: of, main } = lines(t);
    if (main && holds.has(main)) return holds.get(main)!.worker;
    for (const g of [...of].sort()) if (holds.has(g)) return holds.get(g)!.worker;
    return undefined;
  };
}
