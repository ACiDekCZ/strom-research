// The runs of a research as the bridge tells the Strom app (spec 126 U9, feature run.lines): each run alive (strom run,
// a worker "run-…") with its line, agent, state and last step, and the runs ended lately and why — read at each ask of
// /status (a few small files of .strom: the run's step changes every few seconds, the research does not); the limit of
// runs at once, the agents strom can start here, which run takes each task of the queue, and whether a run of each line
// can start now (and if not why) — worked out with /status (the lines' holds and the lines of the tasks read once).
// Read only.

import { PROFILES } from "../agents/profiles.ts";
import type { Research, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import type { Env } from "./paths.ts";
import { DEFAULT_RUN_PARALLEL, RUN_PARALLEL_MAX, type Settings } from "./config.ts";
import { agentsHere } from "./apps.ts";
import { lineHolds, linesOfTasks } from "./linerun.ts";
import { endedRuns, lineAgents, readRunState, runStopAsked, type EndedRun } from "./runstate.ts";
import { liveWorkers, runsAtWork, type Worker } from "./workers.ts";

export type { EndedRun };

export interface RunView {
  id: string;
  research: string | null;
  agent: string;
  agentName: string;
  model?: string;
  since: string;
  state: "working" | "between" | "paused" | "finishing";
  paused?: { until: string; reason?: string; since?: string };
  session?: string;
  task?: string;
  lastStep?: string;
  sessions: number;
}

/** Why a run of a line cannot start now (researches[].why). */
export type CannotStart = "archive" | "waitingAgent" | "noAgent" | "oldRun" | "running" | "paused" | "done" | "limit" | "empty";

export interface RunsNow {
  limits: { maxRuns: number; running: number; cap: number };
  agents: { id: string; name: string; default?: boolean }[];
  /** Which run takes a task (a run of a line): none — the whole queue's. */
  taker(t: Task): string | undefined;
  /** The run that holds a line, whether a run of it can start (and why not), the agent of its last run. */
  line(r: Research, ranked: Task[]): { run?: string; canStart: boolean; why?: CannotStart; agent?: string };
}

/** What a paused run waits for, said as a word where strom knows it (limit, archive), else the reason as said. */
function pausedOf(w: Worker): RunView["paused"] {
  if (!w.paused) return undefined;
  const reason = w.paused.kind ?? w.paused.reason;
  return { until: w.paused.until, ...(reason ? { reason } : {}), ...(w.paused.since ? { since: w.paused.since } : {}) };
}

/** The runs alive now and those ended lately (never asked in an archive or a research waiting for its agent). */
export function runsLive(root: string, fallbackAgent: () => string): { runs: RunView[]; runsEnded: EndedRun[] } {
  const runs: RunView[] = liveWorkers(root)
    .filter((w) => w.id.startsWith("run-"))
    .map((w) => {
      const state = readRunState(root, w.id);
      const agent = w.agent ?? fallbackAgent();
      const finishing = !!state?.stop || !!runStopAsked(root, w.id);
      const paused = pausedOf(w);
      return {
        id: w.id,
        research: w.research ?? null,
        agent,
        agentName: PROFILES[agent]?.name ?? agent,
        ...(state?.model ? { model: state.model } : {}),
        since: w.since,
        state: finishing ? "finishing" : paused ? "paused" : state?.session ? "working" : "between",
        ...(paused && !finishing ? { paused } : {}),
        ...(state?.session ? { session: state.session, ...(state.task ? { task: state.task } : {}) } : {}),
        ...(state?.step ? { lastStep: state.step } : {}),
        sessions: state?.sessions ?? 0,
      };
    });
  return { runs, runsEnded: endedRuns(root) };
}

/** The limit of runs at once (run.parallel, the person's), the runs at work, the most it can be. */
export function runLimits(root: string, settings: Settings): RunsNow["limits"] {
  return { maxRuns: settings.number("run.parallel", undefined, DEFAULT_RUN_PARALLEL), running: runsAtWork(root).length, cap: RUN_PARALLEL_MAX };
}

/** The runs' limit, the agents here and the lines' runs, for a /status (never in an archive or a research waiting for its agent). */
export function runsNow(tree: Tree, settings: Settings, env: Env): RunsNow {
  const root = tree.root;
  const own = settings.agent(tree.config).value;
  const atWork = runsAtWork(root);
  const maxRuns = settings.number("run.parallel", undefined, DEFAULT_RUN_PARALLEL);
  const limits = { maxRuns, running: atWork.length, cap: RUN_PARALLEL_MAX };
  const agents = agentsHere(env)
    .filter((a) => a.cli && PROFILES[a.id])
    .map((a) => ({ id: a.id, name: PROFILES[a.id]!.name, ...(a.id === own ? { default: true } : {}) }));
  const holds = lineHolds(root);
  const remembered = lineAgents(root);
  const old = atWork.some((w) => w.id === "run" && !w.version);
  let lines: ((t: Task) => { lines: Set<string>; main?: string }) | undefined;
  const memo = new Map<string, { lines: Set<string>; main?: string }>();
  const of = (t: Task) => {
    let m = memo.get(t.id);
    if (!m) memo.set(t.id, (m = (lines ??= linesOfTasks(tree))(t)));
    return m;
  };
  const taker = (t: Task): string | undefined => {
    if (!holds.size) return undefined;
    const { lines: in_, main } = of(t);
    if (main && holds.has(main)) return holds.get(main)!.worker;
    for (const g of [...in_].sort()) if (holds.has(g)) return holds.get(g)!.worker;
    return undefined;
  };
  const line = (r: Research, ranked: Task[]) => {
    const run = holds.get(r.id)?.worker;
    const agent = remembered[r.id];
    const why: CannotStart | undefined = !agents.length
      ? "noAgent"
      : old
        ? "oldRun"
        : run
          ? "running"
          : r.state === "paused"
            ? "paused"
            : r.state === "done"
              ? "done"
              : atWork.length >= maxRuns
                ? "limit"
                : // what a run of the line would take: its own tasks, and the shared ones whose main line has no run
                  !ranked.some((t) => {
                      const { lines: in_, main } = of(t);
                      return main === r.id || (in_.has(r.id) && !(main && holds.has(main)));
                    })
                  ? "empty"
                  : undefined;
    return { ...(run ? { run } : {}), canStart: !why, ...(why ? { why } : {}), ...(agent ? { agent } : {}) };
  };
  return { limits, agents, taker, line };
}
