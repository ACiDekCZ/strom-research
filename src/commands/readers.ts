// Readers strom starts for a whole research at once (strom clips, strom
// transcripts): each a short run of the agent in its own folder outside the
// tree, allowed to open the views it is given and to write its report into
// notes/readings — never anything else. strom writes to the research from
// what the reports say.

import fs from "node:fs";
import path from "node:path";
import type { Context } from "../cli/context.ts";
import { StromError, UsageError } from "../core/errors.ts";
import { readerSettings } from "../core/reader.ts";
import { readerLimit } from "../core/readstats.ts";
import { RUNNERS } from "../runners/index.ts";
import { which, withoutAgentMarks } from "../core/which.ts";
import { permissionPath } from "../agents/files.ts";
import { viewSizesFor } from "../core/viewsizes.ts";
import type { Tree } from "../core/tree.ts";
import { refuseReadersWhenFinishing } from "../core/clock.ts";
import { recordReader, tokensOf, usageOpt } from "../core/metrics.ts";
import { imageSizeOfFile } from "../image/index.ts";
import { currentSession } from "../core/session.ts";
import { noReaderHere, refusedBySandbox, sandboxOf } from "../core/sandbox.ts";

export interface Readers {
  model: string | undefined;
  /** The longest side of a view the readers' model takes in whole. */
  viewMax: number;
  parallel: number;
  /** The name of this run's reports: notes/readings/<stem>-<reader>.md. */
  stem: string;
  reportsDir: string;
  /** One reader: it looks at these views and writes its report; the report's text comes back. */
  read: (name: string, views: string[], title: string, prompt: (report: string) => string) => Promise<{ report: string; text: string; outcome: string; costUsd?: number }>;
  cost: () => number;
  /** How many readers ran, and whether one stopped before it said what it cost. */
  runs: () => number;
  partial: () => boolean;
  failed: string[];
  progress: (s: string) => void;
}

/**
 * The agent of the readers: one named for this command (--agent, STROM_AGENT), else the agent the session at work was
 * started with (strom run --agent, a conversation of another agent), else the tree's.
 */
export function readerAgent(ctx: Context, tree: Tree): string {
  const said = ctx.settings.agent(tree.config);
  if (said.source === "flag" || said.source === "env") return said.value;
  const s = currentSession(tree, ctx.env);
  return [s?.runner, s?.agent].find((a): a is string => !!a && !!RUNNERS[a]) ?? said.value;
}

/**
 * The one folder every reader works in: outside the tree (a reader must not pick up the researcher's instructions,
 * CLAUDE.md, AGENTS.md), empty, and the same for all of them — an agent records each folder it works in (its sessions,
 * Codex's and Grok's trust of it), so one folder for all readers, never one per reader. Each reader's own files
 * (its settings) stay in a folder of its own beside it.
 */
export function readerDesk(shared: string): string {
  const desk = path.join(shared, "cache", "readers", "desk");
  fs.mkdirSync(desk, { recursive: true });
  return desk;
}

/**
 * The stem of a reading no other reading has (found live: two strom read of one image started in the same second got
 * one reader id — one usage file, one log, one report, one record, the second reader's result lost): `<base>`, else
 * `<base>-run2`, `-run3`, … — the first whose reports are not there (`taken`) and whose claim this process creates
 * itself, whole or not at all (.strom/runs/claims/<prefix>-<stem>.claim, flag wx): readings started at the same moment
 * in other processes take the next. Claims of earlier days go (a stem carries its day).
 */
export function claimStem(root: string, prefix: string, base: string, taken: (stem: string) => boolean): string {
  const dir = path.join(root, ".strom", "runs", "claims");
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (f.endsWith(".claim") && Date.now() - fs.statSync(p).mtimeMs > 2 * 24 * 3600_000) fs.rmSync(p, { force: true });
    }
  } catch {
    // a claim of before left: no reason to stop
  }
  for (let n = 1; n < 10_000; n++) {
    const stem = n === 1 ? base : `${base}-run${n}`;
    if (taken(stem)) continue;
    try {
      fs.writeFileSync(path.join(dir, `${prefix}-${stem}.claim`), `${process.pid}\n`, { flag: "wx" });
      return stem;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") continue;
      // the folder cannot be written: as before, by the reports alone
      return stem;
    }
  }
  return `${base}-${process.pid}`;
}

/** Inside a sandbox that lets no agent start (Codex's) no reader is started: said at once, with what to do instead. */
export function refuseReadersInSandbox(ctx: Context, command: string): void {
  const sb = sandboxOf(ctx.env);
  if (sb) throw noReaderHere(sb, command);
}

/**
 * Set up the readers of a run (--model, --parallel, --minutes; the agent of the session, else of the tree). `reportsDir`: where their reports
 * go when they are not the research's readings (notes/readings) — a calibration's, beside the research in .strom.
 */
export function readers(ctx: Context, tree: Tree, shared: string, kind: string, first: string, opts: Record<string, unknown>, reportsAt?: string): Readers {
  refuseReadersWhenFinishing(tree.root, ctx.env);
  refuseReadersInSandbox(ctx, `strom ${kind}`);
  const agentId = readerAgent(ctx, tree);
  const runner = RUNNERS[agentId];
  if (!runner) throw new UsageError(`no reader for agent "${agentId}" yet`, { hint: `strom ${kind} works with Claude Code: strom ${kind} … --agent claude` });
  if (agentId !== "script" && !which(runner.command, ctx.env)) throw new StromError(`${runner.command} is not installed`);
  const model = typeof opts.model === "string" ? opts.model : ctx.settings.models(agentId, tree.config).vision;
  const effort = ctx.settings.effort(agentId, tree.config)?.value;
  const sizes = viewSizesFor(ctx.settings, agentId, tree.config, model, tree.root);
  const parallel = opts.parallel === undefined ? 3 : Math.max(1, Number(opts.parallel) || 1);
  // a reader's time limit: by hand, else by the views it is given and what the readers before it needed (readerLimit)
  const minutesSaid = opts.minutes === undefined ? undefined : Number(opts.minutes);
  if (minutesSaid !== undefined && !(minutesSaid > 0)) throw new UsageError(`invalid --minutes "${String(opts.minutes)}"`, { hint: "the minutes one reader may take, e.g. 10" });
  const day = new Date().toISOString().slice(0, 10);
  const reportsDir = reportsAt ?? path.join(tree.root, "notes", "readings");
  fs.mkdirSync(reportsDir, { recursive: true });
  const stem = claimStem(tree.root, kind, `${day}-${kind}`, (s) => fs.existsSync(path.join(reportsDir, `${s}-${first}-1.md`)));
  const work = path.join(shared, "cache", "readers");
  const progress = (s: string) => (ctx.json ? ctx.io.stderr : ctx.io.stdout)(s + "\n");
  let cost = 0;
  let runs = 0;
  let partial = false;
  const failed: string[] = [];
  const read = async (name: string, views: string[], title: string, prompt: (report: string) => string) => {
    const report = path.join(reportsDir, `${stem}-${name}.md`);
    const own = path.join(work, `${stem}-${name}`);
    fs.mkdirSync(own, { recursive: true });
    const settingsFile = path.join(own, "reader-settings.json");
    fs.writeFileSync(settingsFile, JSON.stringify(readerSettings(views, report, permissionPath), null, 2));
    fs.writeFileSync(report, `# ${title}\n\n`);
    const text = prompt(report);
    // its time limit: by hand, else by its views and what the readers of this agent and model before it needed
    const limit = minutesSaid !== undefined ? { minutes: minutesSaid, from: "option" as const } : readerLimit(tree.root, sizes.key, views.length);
    if (limit.from === "learned") progress(`  ${name}: at most ${limit.minutes} min (earlier readers of this agent and model needed more)`);
    const startedAt = Date.now();
    const { STROM_SESSION: _s, ...env } = ctx.env;
    const r = await runner.run({
      cwd: readerDesk(shared),
      prompt: text,
      kickoff: text,
      // (not the marks of the agent that ran strom read: the reader is an agent of its own)
      env: { ...withoutAgentMarks(env), STROM_NONINTERACTIVE: "1", STROM_READER: "1" },
      settingsFile,
      reader: true,
      // without the user's own add-ons (skills, plugins, MCP servers) unless they said otherwise
      ...(ctx.settings.agentAddons(tree.config) ? {} : { clean: true }),
      timeoutMs: limit.minutes * 60_000,
      logFile: path.join(tree.root, ".strom", "runs", `${kind}-${stem}-${name}.log`),
      ...(model ? { model } : {}),
      // the reasoning effort the person chose for the agent (model.effort): readers read with it too
      ...(effort ? { effort } : {}),
      ...usageOpt(tree, `${kind}-${stem}-${name}`, { agent: agentId, key: sizes.asked ?? sizes.key, ...(model ? { model } : {}), ...(effort ? { effort } : {}), reader: kind }),
    });
    const ranMs = Date.now() - startedAt;
    // the reader as it went, for the measure of the reading of scans (core/metrics.ts)
    recordReader(tree, ctx.env, {
      reader: `${kind}-${stem}-${name}`,
      kind,
      agent: agentId,
      key: sizes.asked ?? sizes.key,
      model,
      reported: r.metrics.model,
      views: views.length,
      px: views.reduce((n, v) => {
        const s = imageSizeOfFile(v);
        return n + (s ? s.width * s.height : 0);
      }, 0),
      outcome: r.outcome,
      usd: r.metrics.costUsd,
      ...(r.metrics.costPartial ? { usdPartial: true } : {}),
      tokens: tokensOf(r.metrics),
      turns: r.metrics.turns,
      ms: r.metrics.durationMs,
      // how long strom waited for it, its limit and where that came from (the next reader's limit learns from them)
      wallMs: ranMs,
      minutes: limit.minutes,
      minutesFrom: limit.from,
      report: tree.relative(report),
    });
    cost += r.metrics.costUsd ?? 0;
    runs++;
    if (r.metrics.costUsd === undefined || r.metrics.costPartial) partial = true;
    // refused by a sandbox that does not say so: said as such, never only "error"
    if (r.outcome !== "ok") failed.push(`${name} (${r.outcome === "error" && refusedBySandbox(r.text) ? "no reader can start in this sandbox" : r.outcome === "timeout" ? `stopped at its time limit, ${limit.minutes} min` : r.outcome})`);
    const written = fs.readFileSync(report, "utf8");
    if (!/^##\s/m.test(written) && r.text.trim()) fs.appendFileSync(report, r.text.trim() + "\n");
    return { report, text: fs.readFileSync(report, "utf8"), outcome: r.outcome, ...(r.metrics.costUsd !== undefined ? { costUsd: r.metrics.costUsd } : {}) };
  };
  return { model, viewMax: sizes.read, parallel, stem, reportsDir, read, cost: () => cost, runs: () => runs, partial: () => partial, failed, progress };
}
