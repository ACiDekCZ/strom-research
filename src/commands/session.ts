// session · brief · frontier · agents · run — the research loop.
//
// `strom run` is plain code, not an LLM: it picks the task, starts a session,
// hands the brief to an agent CLI as a child process, waits for it to exit,
// closes what the agent left open, exports the GEDCOM and commits. Between
// sessions not a single token is spent.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import type { Context } from "../cli/context.ts";
import { lines, table, truncate } from "../cli/format.ts";
import { NeedsConsentError, UsageError, StromError } from "../core/errors.ts";
import type { Research, Session, Task } from "../core/model.ts";
import { closeSession, currentSession, openSessions, othersAtWork, sessionNote, startSession } from "../core/session.ts";
import { buildBrief } from "../brief/brief.ts";
import { DEFAULT_BUDGET, DEFAULT_RUN_MINUTES, Settings } from "../core/config.ts";
import { prependPath } from "../runners/runner.ts";
import { frontier } from "../core/frontier.ts";
import { storyProposals } from "../core/stories.ts";
import { OFF_MAP_HOW, offMapLine, placesOffMap } from "../core/places.ts";
import { create, csvOpt, requireRecord, update } from "../core/records.ts";
import { taskQueue, waitingLines } from "./tasks.ts";
import { resolveResearch } from "./research.ts";
import { writeGedcoms } from "./output.ts";
import { syncAgentFiles } from "../agents/files.ts";
import { setTreeSetting } from "./setup.ts";
import { RUNNERS } from "../runners/index.ts";
import { PROFILES } from "../agents/profiles.ts";
import { AGENTS, detectAgent, isAgent, which } from "../core/which.ts";
import { askGate, ensureGatesDir, loadGate, type Gate, type GateAnswer } from "../core/gate.ts";
import { keepAwake } from "../core/awake.ts";
import { deadlineOf, WRAP_UP_MS } from "../core/clock.ts";
import { stromLauncher } from "../core/self.ts";
import { phrase } from "../core/phrases.ts";
import { enterWorker, runAlive, runsAtWork } from "../core/workers.ts";
import type { Env } from "../core/paths.ts";
import { assertIntact, snapshot, verifyFast } from "../core/integrity.ts";
import { guard } from "../core/guard.ts";
import { hasErrors } from "../core/check.ts";
import { Tree } from "../core/tree.ts";
import { treeBrowserConnectors } from "../core/connector.ts";
import { browserNote } from "./connectors.ts";
import { reviewProposals } from "../core/review.ts";

function written(tree: Tree): string {
  return lines(...tree.written.map((o) => o.summary), tree.dryRun ? "(dry run — nothing written)" : undefined);
}

function researchOf(tree: Tree, ref: unknown): Research | undefined {
  if (typeof ref === "string") return resolveResearch(tree, ref);
  const active = tree.list<Research>("research").filter((r) => r.state === "active");
  return active.length === 1 ? active[0] : undefined;
}

/** The places of facts not on the map yet, when a session ends: the few with most facts, to complete while they are fresh. */
function offMap(tree: Tree): string | undefined {
  const off = placesOffMap(tree);
  if (!off.length) return undefined;
  return lines(`· for the map — places of facts without coordinates (${off.length}):`, ...off.slice(0, 3).map((m) => `    ${offMapLine(m)}`), `    ${OFF_MAP_HOW} · all: strom place list --off-map`);
}

type Proposal = Omit<Task, "id" | "type" | "created" | "updated" | "notes" | "state">;

/** The tasks strom would propose for a research now: its frontier, the review of a person, the stories due (unless the user said no). */
export function researchProposals(tree: Tree, research: Research): { proposal: Proposal; kind: string }[] {
  const out: { proposal: Proposal; kind: string }[] = [];
  for (const item of frontier(tree, research)) if (item.proposal) out.push({ proposal: { ...item.proposal, origin: "frontier" }, kind: "frontier" });
  for (const proposal of reviewProposals(tree, research)) out.push({ proposal, kind: "review" });
  if (new Settings(tree.env, {}).stories(tree.config).on) for (const proposal of storyProposals(tree, research)) out.push({ proposal: { ...proposal, origin: "frontier" }, kind: "story" });
  return out;
}

/** Create the tasks strom proposes for a research; returns their IDs. */
export function applyFrontier(tree: Tree, research: Research): string[] {
  return researchProposals(tree, research).map(({ proposal, kind }) => create<Task>(tree, "task", { ...proposal, state: "open" }, (id) => `+${id} task "${truncate(proposal.what, 60)}" (${kind})`).id);
}

/** Commit behind the same gate as every write. */
export function commitNow(tree: Tree, message: string): boolean {
  const snap = snapshot(tree);
  if (hasErrors([...verifyFast(tree, snap).findings, ...guard(tree, snap)])) return false;
  tree.withTreeLock(() => tree.commit(message));
  tree.settle();
  return true;
}

// ── sessions ───────────────────────────────────────────────────────────────

register(
  {
    path: ["session", "start"],
    summary: "Start a working session on the next task (or a given one) and print its brief",
    group: "research",
    tree: true,
    writes: true,
    args: [{ name: "task", description: "task ID (default: strom task next)" }],
    options: [
      { name: "research", type: "string", value: "<G…>", description: "take the next task of this research" },
      { name: "budget", type: "string", value: "<tokens>", description: `brief size (default ${DEFAULT_BUDGET})` },
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const research = researchOf(tree, opts.research);
      // The next task nobody else is working on (other agents may be at work in this tree).
      const others = othersAtWork(tree).tasks;
      const task = args[0] ? requireRecord<Task>(tree, args[0], "task") : taskQueue(tree, { ...(research ? { research: research.id } : {}), strategy: ctx.settings.strategy(tree.config) }).find((t) => !others.has(t.id));
      if (task && !["open", "doing", "parked"].includes(task.state)) throw new UsageError(`${task.id} is ${task.state}`);
      const s = startSession(tree, { ...(task ? { task } : {}), ...(research ? { research: research.id } : {}) });
      const brief = buildBrief(tree, { ...(task ? { task } : {}), session: s, budget: ctx.settings.number("brief.budget", tree.config, DEFAULT_BUDGET), shared: ctx.settings.shared()?.value });
      return { text: lines(written(tree), "", brief.text), data: { session: s, brief: brief.text, sections: brief.sections } };
    },
  },
  {
    path: ["session", "note"],
    summary: "A note in the session diary (what you are doing, what you noticed)",
    group: "research",
    tree: true,
    writes: true,
    args: [{ name: "text", description: "the note", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const s = currentSession(tree, ctx.env);
      if (!s) throw new UsageError("no open session", { hint: "strom session start" });
      sessionNote(tree, s, args[0]!);
      return { text: written(tree) };
    },
  },
  {
    path: ["session", "close"],
    summary: "Finish the session: summary, next step; exports the GEDCOM and fills the task queue",
    group: "research",
    tree: true,
    writes: true,
    description: "The task must be done, parked or waiting — or --continue returns it to the queue for the next session.",
    args: [{ name: "session", description: "session ID (default: the open one)" }],
    options: [
      { name: "summary", type: "string", value: "<text>", description: "what was proven, what was searched in vain" },
      { name: "next", type: "string", value: "<text>", description: "the next cheapest step" },
      { name: "continue", type: "boolean", description: "the task is not finished: back to the queue with --next as handover" },
      { name: "interrupted", type: "boolean", description: "close a session whose agent died (no summary needed)" },
    ],
    examples: ['strom session close --summary "baptism of Jan found, parents Josef and Marie" --next "marriage of Josef ~1898, B0002"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const s = args[0] ? requireRecord<Session>(tree, args[0], "session") : currentSession(tree, ctx.env);
      if (!s || s.state !== "open") throw new UsageError("no open session", { hint: "strom session list" });
      const closed = closeSession(tree, s, {
        summary: String(opts.summary ?? ""),
        next: String(opts.next ?? ""),
        continueTask: Boolean(opts.continue),
        interrupted: Boolean(opts.interrupted),
      });
      const research = s.research ? tree.get<Research>(s.research) : undefined;
      const newTasks = research ? applyFrontier(tree, research) : [];
      const geds = tree.dryRun ? [] : writeGedcoms(ctx, tree);
      const ged = geds[0];
      return {
        text: lines(
          written(tree),
          ged ? `GEDCOM ${geds.map((g) => ctx.display(g.file)).join(" · ")}: ${ged.stats.persons} persons, ${ged.stats.families} families` : undefined,
          newTasks.length ? `${newTasks.length} new task(s) from the research frontier` : undefined,
          offMap(tree),
          // In a conversation, the next task is best begun in a fresh context: all of this one is in strom.
          !s.runner && ctx.env.STROM_NONINTERACTIVE !== "1" ? freshContext(ctx, tree, s) : undefined,
        ),
        data: { session: closed, newTasks, ged: ged?.file, geds: geds.map((g) => g.file) },
      };
    },
  },
  {
    path: ["session", "list"],
    summary: "Sessions so far: task, outcome, summary, cost",
    group: "research",
    tree: true,
    run(ctx) {
      const all = ctx.tree().list<Session>("session").slice().reverse();
      const cost = (s: Session) => costText(s.metrics);
      return {
        text: all.length ? table(all.map((s) => [s.id, s.state, s.task ?? "", s.started.slice(0, 16).replace("T", " "), cost(s), truncate(s.summary ?? "", 70)])) : "no sessions yet → strom session start",
        data: { sessions: all },
      };
    },
  },
  {
    path: ["session", "show"],
    summary: "One session: task, summary, handover, metrics, diary",
    group: "research",
    tree: true,
    args: [{ name: "session", description: "session ID (default: the open one or the last)", required: false }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const s = args[0] ? requireRecord<Session>(tree, args[0], "session") : (currentSession(tree, ctx.env) ?? tree.list<Session>("session").at(-1));
      if (!s) throw new UsageError("no sessions yet");
      const m = s.metrics ?? {};
      return {
        text: lines(
          `${s.id} ${s.state}${s.task ? ` · task ${s.task}` : ""}${s.runner ? ` · ${s.runner}` : ""}${s.agent && s.agent !== s.runner ? ` · ${s.agent}` : ""}${s.model ? ` · ${s.model}` : ""} · ${s.started.slice(0, 16).replace("T", " ")}${s.ended ? ` – ${s.ended.slice(11, 16)}` : ""}`,
          s.summary ? `summary  ${s.summary}` : undefined,
          s.next ? `next     ${s.next}` : undefined,
          Object.keys(m).length
            ? `metrics  ${[
                m.turns && `${m.turns} turns`,
                m.inputTokens && `${m.inputTokens} in`,
                m.outputTokens && `${m.outputTokens} out`,
                m.cacheReadTokens && `${m.cacheReadTokens} cache read`,
                costText(m),
                s.ended && `${Math.max(1, Math.round((Date.parse(s.ended) - Date.parse(s.started)) / 60000))} min`,
                m.denied && `${m.denied} refused by permissions`,
              ]
                .filter(Boolean)
                .join(" · ")}`
            : undefined,
          ...s.notes.map((n) => `  ${n.at.slice(11, 16)} ${n.text}`),
        ),
        data: { session: s },
      };
    },
  },
  {
    path: ["brief"],
    summary: "The brief for a task (what `session start` prints), with --stats for its size by section",
    group: "research",
    tree: true,
    args: [{ name: "task", description: "task ID (default: the open session's task, else the next task)" }],
    options: [
      { name: "stats", type: "boolean", description: "only the size of each section" },
      { name: "budget", type: "string", value: "<tokens>", description: `size limit (default ${DEFAULT_BUDGET})` },
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const s = currentSession(tree, ctx.env);
      const task = args[0] ? requireRecord<Task>(tree, args[0], "task") : s?.task ? tree.get<Task>(s.task) : taskQueue(tree, { strategy: ctx.settings.strategy(tree.config) })[0];
      const b = buildBrief(tree, { ...(task ? { task } : {}), ...(s ? { session: s, deadline: deadlineOf(ctx.env) } : {}), budget: ctx.settings.number("brief.budget", tree.config, DEFAULT_BUDGET), shared: ctx.settings.shared()?.value });
      if (opts.stats)
        return {
          text: lines(table(b.sections.map((x) => [x.name, `${x.tokens}`, x.cut ? "cut" : ""])), `total ~${b.total} tokens of ${b.budget}`),
          data: b,
        };
      return { text: b.text, data: b };
    },
  },
  {
    path: ["frontier"],
    summary: "The research frontier: who still lacks proven parents, and the tasks that would find them",
    group: "tasks",
    tree: true,
    writes: true,
    options: [
      { name: "research", type: "string", value: "<G…>", description: "which research (default: the only active one)" },
      { name: "apply", type: "boolean", description: "create the proposed tasks" },
    ],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      const r = researchOf(tree, opts.research);
      if (!r) throw new UsageError("which research?", { hint: "strom frontier --research G0001" });
      if (opts.apply) {
        const ids = applyFrontier(tree, r);
        return { text: ids.length ? written(tree) : "nothing to add — every frontier person has a task", data: { created: ids } };
      }
      const items = frontier(tree, r);
      const stories = ctx.settings.stories(tree.config).on ? storyProposals(tree, r) : [];
      const storyLine = stories.length ? `\nstories to write: ${stories.length} (${stories.map((p) => p.subject[0]).join(" ")}) → strom frontier --apply` : undefined;
      return {
        text: items.length
          ? lines(
              table(
                items.map((i) => [
                  i.person.id,
                  `G${i.generation}`,
                  truncate(i.reason, 30),
                  i.coveredBy
                    ? `task ${i.coveredBy}`
                    : i.proposal
                      ? `→ ${i.proposal.level}: ${truncate(i.proposal.what, 60)}`
                      : i.exhausted
                        ? `exhausted (${i.exhausted.join(" ")}) — ask the user how to go on`
                        : "needs a birth year or place first",
                ]),
              ),
              items.some((i) => i.proposal) ? "\ncreate the proposed tasks: strom frontier --apply" : undefined,
              storyLine,
            )
          : lines("the frontier is empty — every ancestor in scope has proven parents (or the research has no limits reached)", storyLine),
        data: { frontier: items.map((i) => ({ person: i.person.id, generation: i.generation, reason: i.reason, coveredBy: i.coveredBy, proposal: i.proposal, exhausted: i.exhausted })), stories },
      };
    },
  },
);

// ── agents ─────────────────────────────────────────────────────────────────

register(
  {
    path: ["agents", "sync"],
    summary: "Write AGENTS.md, CLAUDE.md and the agent permissions for this tree",
    group: "setup",
    tree: true,
    run(ctx) {
      const tree = ctx.tree();
      const files = syncAgentFiles(tree);
      if (files.length) tree.withTreeLock(() => tree.commit(`Agent instructions: ${files.join(", ")}`, files));
      return { text: files.length ? `updated ${files.join(", ")}` : "agent files are up to date", data: { files } };
    },
  },
  {
    path: ["agents", "list"],
    summary: "Agents: which one does the research, which are installed, how they delegate",
    group: "setup",
    run(ctx) {
      const tree = ctx.hasTree() ? ctx.tree().config : undefined;
      const active = ctx.settings.agent(tree);
      const found = AGENTS.map((a) => ({
        ...a,
        path: which(a.command, ctx.env),
        runner: a.id in RUNNERS,
        active: a.id === active.value,
        delegation: PROFILES[a.id]?.delegation,
        models: ctx.settings.models(a.id, tree),
      }));
      const tiers = (m: Record<string, string | undefined>) => Object.entries(m).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" ");
      return {
        text: lines(
          table(found.map((a) => [a.active ? "▸" : " ", a.id, a.name, a.path ? "installed" : "not installed", `delegates ${a.delegation === "native" ? "to its own subagents" : "via strom"}`, tiers(a.models), a.runner ? "" : "(no runner yet)"])),
          "",
          `active: ${active.value} (${active.source}) · change: strom agents use <agent> [--for-tree]  ·  one run: --agent <agent>  ·  models: strom config set model.<tier> <model>`,
        ),
        data: { agents: found, active },
      };
    },
  },
  {
    path: ["agents", "use"],
    summary: "Choose the agent: for you (default) or only for this tree (--for-tree)",
    group: "setup",
    args: [{ name: "agent", description: Object.keys(PROFILES).join(", "), required: true }],
    options: [{ name: "for-tree", type: "boolean", description: "only for the current tree (saved in strom.json)" }],
    examples: ["strom agents use codex", "strom agents use claude --for-tree"],
    run(ctx, { args, opts }) {
      const id = args[0]!.toLowerCase();
      if (!PROFILES[id]) throw new UsageError(`unknown agent "${id}"`, { hint: Object.keys(PROFILES).join(", ") });
      if (opts["for-tree"]) setTreeSetting(ctx, "agent", id);
      else {
        ctx.settings.config.agent = id;
        ctx.settings.save();
      }
      const installed = which(PROFILES[id]!.command, ctx.env);
      return { text: `${PROFILES[id]!.name} ${opts["for-tree"] ? "for this tree" : "is your default agent"}${installed ? "" : " — not installed yet"}`, data: { agent: id, tree: Boolean(opts["for-tree"]) } };
    },
  },
);

// ── run ────────────────────────────────────────────────────────────────────

/** A `strom` on PATH for the agent, pointing at this very installation. */
export function shimDir(tree: Tree): string {
  const dir = path.join(tree.root, ".strom", "bin");
  const { command, args } = stromLauncher();
  const run = [command, ...args].map((a) => `"${a}"`).join(" ");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "strom"), `#!/bin/sh\nexec ${run} "$@"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, "strom.cmd"), `@echo off\r\n${run} %*\r\n`);
  return dir;
}

function parseUntil(v: unknown): number | undefined {
  if (typeof v !== "string") return undefined;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new UsageError(`--until must be a time of day, HH:MM (e.g. 23:30), not "${v}"`);
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** Sessions in a row that worked on a task without writing anything to the research before it is parked. */
const MAX_IDLE_SESSIONS = 2;

/** How many research writes a session made (bookkeeping of sessions and tasks does not count). */
function sessionWrites(tree: Tree, sessionId: string): number {
  const file = path.join(tree.dataDir, "ops", `${sessionId}.jsonl`);
  if (!fs.existsSync(file)) return 0;
  let n = 0;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const op = /"op":"([^"]+)"/.exec(line)?.[1];
    if (op && !op.startsWith("session.") && !op.startsWith("task.")) n++;
  }
  return n;
}

/** Sessions ended from outside: not the agent's failure to make progress. */
const BY_USER = "stopped by the user";
const RUN_GONE = "the run stopped before the session ended (interrupted, or the computer went down)";

/** The last sessions on a task that ended without a single research write, newest first. */
function idleSessions(tree: Tree, taskId: string): number {
  const sessions = tree
    .list<Session>("session")
    .filter((x) => x.task === taskId && x.state !== "open")
    .sort((a, b) => (b.ended ?? b.updated).localeCompare(a.ended ?? a.updated));
  let n = 0;
  for (const x of sessions) {
    if (sessionWrites(tree, x.id) > 0) break;
    // Ended from outside (the user, the run gone) is no failure of the agent; the English summaries are of older sessions.
    if (x.endedBy === "user" || x.endedBy === "run" || x.endedBy === "chat" || x.summary === BY_USER || x.summary === RUN_GONE) continue;
    n++;
  }
  return n;
}

register({
  path: ["run"],
  summary: "Run research sessions with an AI agent: pick task → brief → agent → close → export → commit",
  group: "research",
  tree: true,
  passthrough: true,
  description:
    "One session by default; with --until, session after session until that time. The agent works headless with\n" +
    "the tree's permissions (anything else is denied), or with the terminal (--interactive). Stops at the\n" +
    "subscription limit, when the queue is empty, or at --until (a session already running finishes, within\n" +
    "--minutes). The agent knows when its session is stopped (the brief; strom's output counts down its last\n" +
    "10 minutes, a short session its last quarter); at --minutes it is stopped, and Claude Code, Codex and OpenCode\n" +
    "get 5 minutes more to write down what they found and close (an unfinished task goes back to the queue); a task\n" +
    "that comes back twice in a row with nothing recorded is parked. --task picks the tasks (one session each, in that order;\n" +
    "one done or held by another agent meanwhile is left out). --loop: session after session for as long as there\n" +
    "is work. A gate (setting run.gate, or --gate; plugins/gates/<name>) is asked before each session of --loop and\n" +
    "--until: go on, wait (the run waits and asks again) or stop — the user's condition, e.g. the subscription's room\n" +
    "(strom gate list). Tasks started otherwise (one, --max, --task) are the user's choice: the gate is asked once,\n" +
    "and when it would not start, the user is asked whether to start anyway (an agent: a window of the system).\n" +
    "Arguments after -- go to the agent CLI unchanged.",
  options: [
    { name: "task", type: "string", multiple: true, value: "<T…>", description: "work on these tasks, in this order (repeatable or T0003,T0007; default: the next one of the queue)" },
    { name: "research", type: "string", value: "<G…>", description: "only tasks of this research" },
    { name: "max", type: "string", value: "<n>", description: "at most n sessions (default 1; with --until, no limit)" },
    { name: "until", type: "string", value: "<HH:MM>", description: "start no session after this time" },
    { name: "loop", type: "boolean", description: "session after session for as long as there is work (and the gate lets it)" },
    { name: "gate", type: "string", value: "<name [n]>", description: 'ask this gate before each session, with what it is given, e.g. "claude-usage 20" (default: run.gate)' },
    { name: "no-gate", type: "boolean", description: "ask no gate this time (only you: an agent cannot)" },
    { name: "minutes", type: "string", value: "<n>", description: `time limit of one session (default: run.minutes, ${DEFAULT_RUN_MINUTES})` },
    { name: "budget", type: "string", value: "<tokens>", description: `brief size (default: brief.budget, ${DEFAULT_BUDGET})` },
    { name: "model", type: "string", value: "<model>", description: "model of the main agent (default: model.lead)" },
    { name: "interactive", type: "boolean", description: "give the agent the terminal (you can talk to it)" },
  ],
  examples: ["strom run", "strom run --max 3 --until 23:00", "strom run --loop", "strom run --task T0003,T0007", "strom run --interactive", "strom run --agent codex", "strom run --minutes 30 -- --add-dir ~/Scans"],
  run: async (ctx: Context, { opts, extra }) => {
    const root = ctx.tree().root;
    const treeCfg = ctx.tree().config;
    const runnerId = ctx.settings.agent(treeCfg).value;
    const runner = RUNNERS[runnerId];
    if (!runner)
      throw new UsageError(`no runner for agent "${runnerId}" yet`, { hint: `available: ${Object.keys(RUNNERS).filter((r) => r !== "script").join(", ")} — strom agents use claude` });
    const models = ctx.settings.models(runnerId, treeCfg);
    if (runnerId !== "script" && !which(runner.command, ctx.env))
      throw new StromError(`${runner.command} is not installed`, { hint: runnerId === "claude" ? "install Claude Code: https://claude.com/claude-code — then log in once by running: claude" : `install ${runner.command}` });
    const until = parseUntil(opts.until);
    // Tasks the user picked: one session each, in their order (then the queue, when --max asks for more).
    const picked = csvOpt(opts.task).map((id) => requireRecord<Task>(Tree.open(root, ctx.env), id, "task").id);
    const max = opts.max === undefined ? (picked.length ? picked.length : until || opts.loop ? Infinity : 1) : Number(opts.max);
    if (max !== Infinity && (!Number.isInteger(max) || max < 1)) throw new UsageError("--max must be a positive number");
    const minutes = ctx.settings.number("run.minutes", treeCfg, DEFAULT_RUN_MINUTES);
    const gate = runGate(ctx, opts);
    const budget = ctx.settings.number("brief.budget", treeCfg, DEFAULT_BUDGET);
    // Each run has a name of its own (as a conversation does): several work side by side, never on one task.
    const worker = `run-${process.pid}-${Date.now().toString(36)}`;
    const runEnv: Env = { ...ctx.env, STROM_WORKER: worker };
    // Present in the tree for the others at work (conversations with agents): strom shows who works.
    const beside = runsAtWork(root);
    const leave = enterWorker(root, worker, `${PROFILES[runnerId]?.name ?? runnerId} on its own`);
    let stopAwake = keepAwake(ctx.env);
    // Progress goes to stderr when stdout carries JSON.
    const out = (s: string) => (ctx.json ? ctx.io.stderr : ctx.io.stdout)(s + "\n");
    const report: { session: string; task?: string; outcome: string; summary?: string; costUsd?: number }[] = [];
    // What the gate answered, for the record of the run.
    const gates: { at: string; verdict: string; reason?: string; anyway?: boolean }[] = [];
    // Why the run stopped: a code for the exit status and for data, words for the user (their language).
    const lang = Tree.open(root, runEnv).lang;
    type Stop = "done" | "user" | "time" | "empty" | "problems" | "denied" | "limit" | "auth" | "failed" | "gate" | "gate.error" | "gate.declined";
    let stopCode: Stop = "done";
    let stopValues: Record<string, string> = {};
    // Ctrl-C, a closed terminal, a shutdown: stop the agent, close its session, give the task back.
    const stop = new AbortController();
    const onSignal = (sig: NodeJS.Signals) => {
      if (stop.signal.aborted) process.exit(130); // a second Ctrl-C: now
      out(`\n${ui(lang, "ui.run.stopping")} (${sig})`);
      stop.abort();
    };
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
    for (const sig of signals) process.on(sig, onSignal);
    if (beside.length) out(ui(lang, "ui.run.others", { since: new Date(beside[0]!.since).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" }) }));
    try {
      {
        const tree = Tree.open(root, runEnv);
        assertIntact(tree);
        const files = syncAgentFiles(tree);
        if (files.length) tree.withTreeLock(() => tree.commit(`Agent instructions: ${files.join(", ")}`, files));
        // A session of a run that is no longer at work: the run was killed or the computer went down.
        // Close it; its task goes back to the queue. (The sessions of other runs at work stay theirs.)
        for (const s of openSessions(tree).filter((x) => x.runner && !runAlive(root, x))) {
          closeSession(tree, s, { summary: phrase(tree.lang, "session.run"), next: "", interrupted: true, endedBy: "run" });
          commitNow(tree, `${s.id} interrupted: its run had stopped`);
          out(ui(lang, "ui.run.gone", { session: s.id, back: s.task ? ui(lang, "ui.run.back", { task: s.task }) : "" }));
        }
      }
      const bin = shimDir(Tree.open(root, runEnv));
      // How the agent is let work, said once: browser tools for whose sites, and a loosening the user chose.
      // Browser tools only for the archives this tree works with (the plugins folder is shared by every tree).
      const browser = runnerId === "claude" ? treeBrowserConnectors(Tree.open(root, runEnv), ctx.settings.shared()?.value) : [];
      const permissions = ctx.settings.agentPermissions();
      for (const c of browser) out(ui(lang, "ui.run.browser", { name: c.manifest.title ?? c.name, hosts: c.manifest.hosts.join(", ") }));
      if (browser.length && /haiku/i.test(models.lead ?? "")) out(ui(lang, "ui.run.browser.model", { model: models.lead! }));
      // Archives through the browser with an agent that has no browser tools, or without the extension: said before it starts.
      const browserSays = browserNote(ctx, Tree.open(root, runEnv), runnerId);
      if (browserSays) out(browserSays);
      if (permissions === "full") out(ui(lang, "ui.run.full"));
      // The gate holds a run that goes on by itself (--loop, --until). Tasks the user starts themselves (one, --max n,
      // --task) are their choice: the gate is asked once, and when it would not start, the user decides.
      const gateHolds = Boolean(opts.loop || until);
      let gateAnswered = false;
      if (gate) out(ui(lang, gateHolds ? "ui.run.gate" : "ui.run.gate.once", { name: gate.manifest.title ?? gate.name }));
      for (let i = 0; i < max; i++) {
        if (stop.signal.aborted) {
          stopCode = "user";
          break;
        }
        if (until && Date.now() > until) {
          stopCode = "time";
          break;
        }
        const tree = Tree.open(root, runEnv); // fresh: the agent wrote from other processes
        const research = researchOf(tree, opts.research);
        // Other agents may be at work in this tree (conversations): never their tasks.
        const others = othersAtWork(tree, tree.env, runnerId).tasks;
        // Working alone: now and then a story's turn (in a conversation the user leads).
        const free = () => taskQueue(tree, { ...(research ? { research: research.id } : {}), strategy: ctx.settings.strategy(tree.config), storyTurn: true }).find((t) => !others.has(t.id));
        let task: Task | undefined;
        if (i < picked.length) {
          task = tree.get<Task>(picked[i]!);
          const left = !task || !["open", "doing", "parked", "waiting"].includes(task.state) ? task?.state : others.has(task.id) ? "held" : undefined;
          if (left) {
            out(ui(lang, left === "held" ? "ui.run.skip.held" : "ui.run.skip", { task: picked[i]! }));
            continue;
          }
        } else task = free();
        if (!task && research) {
          applyFrontier(tree, research);
          task = free();
        }
        if (!task) {
          stopCode = "empty";
          break;
        }
        // The user's condition, between sessions only: go on, wait and ask again, or stop — in a run that goes on by
        // itself. Tasks the user started themselves: asked once, and the user decides when it would not start.
        if (gate && !gateAnswered) {
          const said = askGate(gate, runEnv, { tree: root, lang, agent: runnerId, model: models.lead, sessions: report.length, costUsd: report.reduce((a, r) => a + (r.costUsd ?? 0), 0), nextTask: task.id });
          const answer: (typeof gates)[number] = { at: new Date().toISOString(), verdict: said.verdict, ...(said.reason ? { reason: said.reason } : {}) };
          gates.push(answer);
          const name = gate.manifest.title ?? gate.name;
          if (!gateHolds) {
            gateAnswered = true;
            if (said.verdict !== "go") {
              if (!(await startAnyway(ctx, name, gateReason(said, lang), lang))) {
                stopCode = "gate.declined";
                stopValues = { name, reason: gateReason(said, lang) };
                break;
              }
              answer.anyway = true;
            }
          } else if (said.verdict === "stop" || said.verdict === "error") {
            stopCode = said.verdict === "stop" ? "gate" : "gate.error";
            stopValues = { name, reason: said.reason ?? "" };
            break;
          } else if (said.verdict === "wait") {
            const at = Date.now() + said.waitMs!;
            if (until && at > until) {
              stopCode = "time";
              break;
            }
            out(ui(lang, "ui.run.gate.wait", { at: new Date(at).toLocaleString(lang, { weekday: "short", hour: "2-digit", minute: "2-digit" }), reason: said.reason ?? "" }));
            // nothing to do meanwhile: the computer may sleep
            stopAwake();
            await pause(at - Date.now(), stop.signal);
            stopAwake = keepAwake(ctx.env);
            i--; // this was no session: ask again, with the queue as it is then
            continue;
          }
        }
        const session = startSession(tree, { task, ...(research ? { research: research.id } : {}), runner: runnerId, ...(models.lead ? { model: models.lead } : {}) });
        commitNow(tree, `${session.id} session started on ${task.id}`);
        // When the agent is stopped: it knows (the brief, strom's reminders near the end), and gets a few minutes more to write down what it found.
        const deadline = Date.now() + minutes * 60_000;
        const brief = buildBrief(tree, { task, session, budget, shared: ctx.settings.shared()?.value, deadline });
        const briefFile = path.join(root, ".strom", "briefs", `${session.id}.md`);
        fs.mkdirSync(path.dirname(briefFile), { recursive: true });
        fs.writeFileSync(briefFile, brief.text);
        out(`${ui(lang, "ui.run.start.session", { session: session.id, task: task.id, what: truncate(task.what, 70) })} · brief ~${brief.total} tokens`);
        const prompt =
          `You are the researcher in strom session ${session.id}. Below is the brief for your task. ` +
          "Work only through `strom` commands in this folder; record findings as you go; finish with `strom session close` as the brief says.\n\n" +
          brief.text;
        const kickoff = `You are the researcher in strom session ${session.id}. Run \`strom brief\` and follow it; work only through strom; finish with \`strom session close\`.`;
        const env = {
          ...prependPath(runEnv, bin),
          STROM_SESSION: session.id,
          STROM_DEADLINE: new Date(deadline).toISOString(),
          STROM_MINUTES: String(minutes),
          ...(opts.interactive ? {} : { STROM_NONINTERACTIVE: "1" }),
        };
        const result = await runner.run({
          cwd: root,
          prompt,
          kickoff,
          env,
          // Found again in the agent's list of sessions: the family, the line, the task.
          name: ["Strom", tree.config.name, tree.get<Research>(task.research ?? research?.id ?? "")?.name, `${truncate(task.what, 50)} (${task.id})`].filter(Boolean).join(" · "),
          logFile: path.join(root, ".strom", "runs", `${session.id}.log`),
          timeoutMs: minutes * 60_000,
          wrapUp: {
            ms: WRAP_UP_MS,
            prompt:
              `Time is up: strom stopped you at the session's limit (${minutes} min). You have ${WRAP_UP_MS / 60_000} minutes, no more. Do not open anything new: ` +
              "record in strom what you found and have not recorded yet (facts, sources, the images searched, in vain too), " +
              `then \`strom session close --continue --summary "…" --next "exactly where you stopped"\` (or finish the task, if it is done).`,
          },
          settingsFile: path.join(root, ".claude", "settings.json"),
          shared: ctx.settings.shared()?.value,
          ...(models.lead ? { model: models.lead } : {}),
          ...(opts.interactive ? { interactive: true } : {}),
          ...(runnerId === "claude" ? { chrome: browser.length > 0, permissions, remote: ctx.settings.agentRemote() } : {}),
          ...(extra?.length ? { extraArgs: extra } : {}),
          onProgress: (l) => out(`  · ${l}`),
          signal: stop.signal,
        });
        // Close what the agent left open, record the metrics, export, commit.
        const after = Tree.open(root, runEnv);
        let s = after.get<Session>(session.id)!;
        if (s.state === "open")
          s = closeSession(after, s, {
            summary: result.outcome === "stopped" ? phrase(after.lang, "session.user") : phrase(after.lang, "session.agent", { outcome: result.outcome }),
            next: "",
            interrupted: true,
            metrics: result.metrics,
            endedBy: result.outcome === "stopped" ? "user" : "agent",
          });
        else update<Session>(after, s.id, "session", (x) => ({ ...x, metrics: result.metrics }), { op: "session.metrics", summary: `${s.id} metrics` });
        // the model it really ran on, as the agent said (an alias such as "opus" names no version)
        if (result.metrics.model && s.model !== result.metrics.model)
          s = update<Session>(after, s.id, "session", (x) => ({ ...x, model: result.metrics.model }), { op: "session.metrics", summary: `${s.id} model ${result.metrics.model}` });
        // A task that comes back again and again without anything being recorded
        // is stuck: park it (the user decides), work on the next one.
        const back = after.get<Task>(task.id);
        const idle = back && back.state === "open" ? idleSessions(after, task.id) : 0;
        if (idle >= MAX_IDLE_SESSIONS) {
          const why = `${idle} sessions in a row recorded nothing for it — needs a look (strom task show ${task.id})`;
          update<Task>(after, task.id, "task", (t) => ({ ...t, state: "parked", parkedReason: why }), {
            op: "task.park",
            summary: `${task.id} park: ${idle} sessions without a result`,
            reason: why,
          });
          out(ui(lang, "ui.run.parked", { task: task.id, n: idle }));
        }
        if (research) applyFrontier(after, research);
        const geds = writeGedcoms(ctx, after);
        const committed = commitNow(after, `${s.id} ${s.state}: ${truncate(s.summary ?? "", 60)} · ${geds.map((g) => after.relative(g.file)).join(", ")}`);
        report.push({ session: s.id, task: task.id, outcome: result.outcome, ...(s.summary ? { summary: s.summary } : {}), ...(result.metrics.costUsd !== undefined ? { costUsd: result.metrics.costUsd } : {}) });
        out(`■ ${s.id} ${s.state} · ${result.outcome}${costText(result.metrics) ? ` · ${costText(result.metrics)}` : ""}${s.summary ? ` · ${truncate(s.summary, 80)}` : ""}`);
        if (result.denied?.length) out(ui(lang, "ui.run.denied", { n: result.denied.length, what: result.denied.slice(0, 3).join(" · ") }));
        if (!committed) {
          stopCode = "problems";
          break;
        }
        if (stop.signal.aborted) {
          stopCode = "user";
          break;
        }
        // An agent that may not run strom can do nothing: stop, do not burn session after session.
        if (result.denied?.some((d) => /^Bash: (\S*\/)?strom\b/.test(d))) {
          stopCode = "denied";
          break;
        }
        if (result.outcome === "limit") {
          stopCode = "limit";
          stopValues = { resets: result.resumeAt ? ui(lang, "ui.run.stop.resets", { at: result.resumeAt }) : "" };
          break;
        }
        if (result.outcome === "auth") {
          stopCode = "auth";
          stopValues = { command: runner.command };
          break;
        }
        if (result.outcome === "error") {
          stopCode = "failed";
          stopValues = { detail: truncate(result.text, 120) };
          break;
        }
      }
    } finally {
      for (const sig of signals) process.off(sig, onSignal);
      stopAwake();
      leave();
    }
    // What the research now waits for from the user who started it.
    const waiting = waitingLines(Tree.open(root, runEnv), { shared: ctx.settings.shared()?.value, display: (p) => ctx.display(p) });
    const reason = ui(lang, `ui.run.stop.${stopCode}` as UIKey, stopValues);
    return {
      text: lines(ui(lang, "ui.run.summary", { n: report.length, reason }), waiting ? `\n${waiting}` : undefined),
      data: { sessions: report, stopped: reason, stop: stopCode, ...(gate ? { gate: { name: gate.name, answers: gates } } : {}) },
      exitCode: ["failed", "problems", "auth", "denied", "gate.error"].includes(stopCode) ? 1 : 0,
    };
  },
});

/**
 * The gate this run asks (run.gate, or --gate), or none (--no-gate). Going round the user's gate is the user's
 * decision: an agent asks them (a window of the system).
 */
function runGate(ctx: Context, opts: Record<string, unknown>): Gate | undefined {
  const set = ctx.settings.runGate();
  const asked = typeof opts.gate === "string" ? opts.gate : undefined;
  if (opts["no-gate"]) {
    if (set && isAgent(ctx.env)) ctx.requireHuman(`Let the agent work on its own without the gate "${set}"?`, "strom run --no-gate", "run.gate", ui(ctx.uiLang(), "ui.consent.gate.skip", { name: set }));
    return undefined;
  }
  const name = asked ?? set;
  if (!name) return undefined;
  if (asked && set && asked !== set && isAgent(ctx.env)) ctx.requireHuman(`Ask the gate "${asked}" instead of "${set}"?`, `strom run --gate ${asked}`, "run.gate", ui(ctx.uiLang(), "ui.consent.gate.set", { name: asked }));
  const shared = ctx.settings.shared()?.value;
  if (!shared) throw new StromError("no shared folder, so no gates", { hint: "strom setup" });
  ensureGatesDir(shared);
  return loadGate(shared, name);
}

/** Why the gate would not start, for the user: its own words, else what it answered. */
function gateReason(said: GateAnswer, lang: string): string {
  return said.reason ?? ui(lang, said.verdict === "error" ? "ui.run.gate.noanswer" : said.verdict === "wait" ? "ui.run.gate.later" : "ui.run.gate.no");
}

/**
 * Tasks the user started themselves while the gate would not start: the user decides — on a terminal, a question;
 * asked by an agent, a window of the system (going round the user's condition is never the agent's decision). A run
 * nobody can ask keeps to the gate.
 */
async function startAnyway(ctx: Context, name: string, reason: string, lang: string): Promise<boolean> {
  const question = ui(lang, "ui.run.gate.anyway", { name, reason });
  if (ctx.interactive && !isAgent(ctx.env)) return ctx.confirm(question, false);
  if (!isAgent(ctx.env)) return false;
  try {
    ctx.requireHuman(`Start the tasks although the condition "${name}" would not (${reason})?`, "strom run --no-gate", "run.gate", question);
    return true;
  } catch (err) {
    if (err instanceof NeedsConsentError) throw err; // nobody to ask: the user runs it themselves
    return false; // the user said no in the window
  }
}

/** Wait, until the time or until the user stops the run. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted || ms <= 0) return resolve();
    const t = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(t);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}

/** What a session cost: "$1.20"; "$0.30+" or "cost unknown" when the agent was stopped before it said. */
function costText(m: Session["metrics"]): string {
  if (m?.costPartial) return m.costUsd ? `$${m.costUsd.toFixed(2)}+` : "cost unknown";
  return m?.costUsd !== undefined ? `$${m.costUsd.toFixed(2)}` : "";
}

/** How the user clears the agent's context, in the agent's own words. */
const CLEAR: Record<string, string> = { claude: "/clear", codex: "/new", opencode: "/new" };

/** The hint after a session in a conversation: the next task in a fresh context (images stay in a context and are paid on every turn). */
function freshContext(ctx: Context, tree: Tree, s: Session): string {
  const since = Date.parse(s.started);
  let images = 0;
  try {
    const dir = path.join(tree.root, ".strom", "views");
    images = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).mtimeMs >= since).length;
  } catch {
    // no views
  }
  const how = CLEAR[detectAgent(ctx.env) ?? ""];
  return lines(
    "",
    `next task: best in a fresh context${images ? ` — this session opened ${images} image(s), and they stay in yours` : ""}. Nothing is lost: strom keeps it all.`,
    `  Suggest it to the user in a sentence: ${how ? `typing ${how}` : "a new conversation"}, then \`strom\` goes on. A long queue: suggest letting the agent`,
    "  work on its own (strom's menu) — every task in a fresh session. If they would rather go on here, go on.",
  );
}
