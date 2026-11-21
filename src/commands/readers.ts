// Readers strom starts for a whole research at once (strom clips, strom
// transcripts): each a short run of the agent in its own folder outside the
// tree, allowed to open the views it is given and to write its report into
// notes/readings — never anything else. strom writes to the research from
// what the reports say.

import fs from "node:fs";
import path from "node:path";
import type { Context } from "../cli/context.ts";
import { UsageError } from "../core/errors.ts";
import { requireAgentCli, requireClaudeLogin } from "../core/agentcli.ts";
import { claudeLoginCommand } from "../core/claudedir.ts";
import { AGENTS, isAgent, withoutAgentMarks } from "../core/which.ts";
import { ui } from "../cli/ui.ts";
import { readerSettings, readerStall } from "../core/reader.ts";
import { readerLimit } from "../core/readstats.ts";
import { RUNNERS } from "../runners/index.ts";
import { permissionPath } from "../agents/files.ts";
import { viewSizesFor } from "../core/viewsizes.ts";
import type { Tree } from "../core/tree.ts";
import type { Settings } from "../core/config.ts";
import type { Env } from "../core/paths.ts";
import { refuseReadersWhenFinishing } from "../core/clock.ts";
import { recordReader, tokensOf, usageOpt } from "../core/metrics.ts";
import { imageSizeOfFile } from "../image/index.ts";
import { currentSession } from "../core/session.ts";
import { noReaderHere, refusedBySandbox, sandboxOf } from "../core/sandbox.ts";
import { VERSION } from "../core/tree.ts";
import { refuseInArchive } from "../core/state.ts";
import { readProvider, type ReadBox, type ReadOutput, type ReadProvider } from "../core/readprovider.ts";
import { linesPathOf, within, type DocPageView, type SourceAbout } from "../core/document.ts";

export interface Readers {
  /** The agent that reads (a service: its id). */
  agent: string;
  /** A reading service (core/readprovider.ts): it reads the transcript alone. None: an agent. */
  kind?: "service";
  model: string | undefined;
  /** The reasoning effort it reads with (none: the agent's own setting). */
  effort: string | undefined;
  /** The longest side of a view the readers' model takes in whole. */
  viewMax: number;
  /** What a small crop is enlarged to for this agent and model (core/viewsizes.ts min). */
  viewMin: number;
  /** What that enlargement may reach: what the model takes in whole, above a calibrated viewMax (views.ts liftMax). */
  viewLift: number;
  parallel: number;
  /** The name of this run's reports: notes/readings/<stem>-<reader>.md. */
  stem: string;
  reportsDir: string;
  /** One reader: it looks at these views and writes its report; the report's text comes back. */
  read: (name: string, views: string[], title: string, prompt: (report: string) => string, more?: ReadMore) => Promise<{ report: string; text: string; outcome: string; costUsd?: number; costPartial?: boolean; credits?: number; resumeAt?: string; modelRejected?: true }>;
  cost: () => number;
  /** How many readers ran, and whether one stopped before it said what it cost. */
  runs: () => number;
  partial: () => boolean;
  failed: string[];
  progress: (s: string) => void;
}

/** What one reader of a run may have besides its views: the first lines of its report, a way to stop it. */
export interface ReadMore {
  /** The report's first lines (else "# <title>"). */
  head?: string;
  /** Stops the reader (a reading cancelled): its outcome is "stopped". */
  signal?: AbortSignal;
  /** A document read (strom document read): its pages as viewed and what the research knows of its source — what a service reads by. */
  doc?: { pages: DocPageView[]; source?: SourceAbout | undefined };
}

/**
 * The agent of the readers: one named for this command (--agent, STROM_AGENT), else the agent the session at work was
 * started with (strom run --agent, a conversation of another agent), else the tree's.
 */
export function readerAgent(ctx: Context, tree: Tree): string {
  return readerAgentOf(ctx.settings, ctx.env, tree);
}

/** The same without a command's context (the bridge): its settings and environment. */
export function readerAgentOf(settings: Settings, env: Env, tree: Tree): string {
  const said = settings.agent(tree.config);
  if (said.source === "flag" || said.source === "env") return said.value;
  const s = currentSession(tree, env);
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

/** How long a reader's own folder left behind (its strom stopped before it cleared it) is kept. */
export const READER_ROOM_KEEP_MS = 2 * 24 * 3600_000;
let roomsSwept = false;

/**
 * A reader's own folder beside the desk (`<shared>/cache/readers/<name>`: its settings, its room), made empty. The
 * first in a process clears the folders of readers that ended long ago (sweepReaderRooms: found 18 Nov 2026, ~3900 of
 * them never cleared); each is cleared as its reader ends (leaveReaderRoom).
 */
export function readerRoomDir(shared: string, name: string): string {
  const work = path.join(shared, "cache", "readers");
  if (!roomsSwept) {
    roomsSwept = true;
    sweepReaderRooms(work);
  }
  const own = path.join(work, name);
  fs.rmSync(own, { recursive: true, force: true });
  fs.mkdirSync(own, { recursive: true });
  return own;
}

/**
 * The folders of readers left in `work` (the readers' cache) unchanged for READER_ROOM_KEEP_MS: removed — never the
 * desk all readers work in, never a file or a link (only what strom made there: folders). How many went.
 */
export function sweepReaderRooms(work: string, now = Date.now()): number {
  let gone = 0;
  let names: string[];
  try {
    names = fs.readdirSync(work);
  } catch {
    return 0;
  }
  for (const name of names) {
    if (name === "desk") continue;
    const p = path.join(work, name);
    try {
      const st = fs.lstatSync(p);
      if (!st.isDirectory() || now - st.mtimeMs < READER_ROOM_KEEP_MS) continue;
      fs.rmSync(p, { recursive: true, force: true });
      gone++;
    } catch {
      // being cleared by another strom, or not ours to clear: left
    }
  }
  return gone;
}

/** A reader's own folder cleared as it ends (its report and log are elsewhere: nothing of it is needed after). */
export function leaveReaderRoom(own: string): void {
  try {
    fs.rmSync(own, { recursive: true, force: true });
  } catch {
    // still held (Windows: a process of the agent not ended yet): the next sweep takes it
  }
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

/** An agent strom has no reader for: the agents that read said (each agent of a research does), none of them preferred. */
export function noReaderFor(agentId: string, command: string): UsageError {
  const agents = Object.keys(RUNNERS).filter((a) => a !== "script");
  return new UsageError(`no reader for agent "${agentId}"`, { hint: `${command} reads with ${agents.join(", ")}: ${command} … --agent <one of them>` });
}

/**
 * Readers are paid model work: none where nobody researches — an archive, or a research waiting for its agent when the
 * readers' agent is not here either (refuseInArchive: one sentence, nothing read, nothing written).
 */
export function refuseReadersInArchive(ctx: Context, tree: Tree, command: string): void {
  refuseInArchive(tree, command, readerAgent(ctx, tree));
}

/** The readers' agent CLI not here (Claude's desktop app alone): said at once (agent.cli-missing), before anything is asked or estimated. */
export function refuseReadersWithoutCli(ctx: Context, tree: Tree, command: string): void {
  requireAgentCli(readerAgent(ctx, tree), ctx.env, command);
}

/**
 * Claude Code in the terminal said outright not logged in (`claude auth status`, in the readers' environment): no reader
 * is started — every one would end "auth" at $0.00 (K040). Said at once with how to log in (agent.logged-out).
 */
export function refuseReadersLoggedOut(ctx: Context, agentId: string, command: string): void {
  const { STROM_SESSION: _s, ...env } = ctx.env;
  requireClaudeLogin(agentId, withoutAgentMarks(env), command);
}

/**
 * A reader that ended "auth": its agent's CLI not logged in, said with how to log in (K040) — English for an agent,
 * else in the research's language.
 */
/** The language the readers' progress is said in: the research's for a person, English for an agent. */
export function readersLang(ctx: Context, tree: Tree): string {
  return isAgent(ctx.env) ? "en" : tree.lang;
}

export function readerAuthSaid(ctx: Context, tree: Tree, agentId: string): string {
  const lang = readersLang(ctx, tree);
  if (agentId === "claude") return ui(lang, "ui.read.auth", { command: claudeLoginCommand(ctx.env) });
  return ui(lang, "ui.run.stop.auth", { command: AGENTS.find((a) => a.id === agentId)?.command ?? agentId });
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
export function readers(ctx: Context, tree: Tree, shared: string, kind: string, first: string, opts: Record<string, unknown>, reportsAt?: string, own: { stem?: string; with?: { agent: string; model?: string | undefined; effort?: string | undefined } } = {}): Readers {
  // who reads: as asked for these readers (strom document read: each reader its own), else the research's readers
  const agentId = own.with?.agent ?? readerAgent(ctx, tree);
  refuseInArchive(tree, `strom ${kind}`, agentId);
  refuseReadersWhenFinishing(tree.root, ctx.env);
  refuseReadersInSandbox(ctx, `strom ${kind}`);
  requireAgentCli(agentId, ctx.env, `strom ${kind}`);
  refuseReadersLoggedOut(ctx, agentId, `strom ${kind}`);
  const runner = RUNNERS[agentId];
  if (!runner) throw noReaderFor(agentId, `strom ${kind}`);
  const model = own.with ? own.with.model || undefined : typeof opts.model === "string" ? opts.model : ctx.settings.models(agentId, tree.config).vision;
  const effort = own.with ? own.with.effort || undefined : ctx.settings.effort(agentId, tree.config)?.value;
  const sizes = viewSizesFor(ctx.settings, agentId, tree.config, model, tree.root);
  const parallel = opts.parallel === undefined ? 3 : Math.max(1, Number(opts.parallel) || 1);
  // a reader's time limit: by hand, else by the views it is given and what the readers before it needed (readerLimit)
  const minutesSaid = opts.minutes === undefined ? undefined : Number(opts.minutes);
  if (minutesSaid !== undefined && !(minutesSaid > 0)) throw new UsageError(`invalid --minutes "${String(opts.minutes)}"`, { hint: "the minutes one reader may take, e.g. 10" });
  const day = new Date().toISOString().slice(0, 10);
  const reportsDir = reportsAt ?? path.join(tree.root, "notes", "readings");
  fs.mkdirSync(reportsDir, { recursive: true });
  const stem = own.stem ?? claimStem(tree.root, kind, `${day}-${kind}`, (s) => fs.existsSync(path.join(reportsDir, `${s}-${first}-1.md`)));
  const progress = (s: string) => (ctx.json ? ctx.io.stderr : ctx.io.stdout)(s + "\n");
  let cost = 0;
  let runs = 0;
  let partial = false;
  const failed: string[] = [];
  let authTold = false;
  const read = async (name: string, views: string[], title: string, prompt: (report: string) => string, more: ReadMore = {}) => {
    const report = path.join(reportsDir, `${stem}-${name}.md`);
    const own = readerRoomDir(shared, `${stem}-${name}`);
    const settingsFile = path.join(own, "reader-settings.json");
    fs.writeFileSync(settingsFile, JSON.stringify(readerSettings(views, report, permissionPath), null, 2));
    // the strom, agent and model that read, kept with the report (a later check of strom's knows them)
    fs.writeFileSync(report, more.head ?? `# ${title}\nStrom: ${VERSION}\nAgent: ${agentId}\nModel: ${model ?? "default"}\n\n`);
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
      readerFiles: { views, report, room: own },
      // without the user's own add-ons (skills, plugins, MCP servers) unless they said otherwise
      ...(ctx.settings.agentAddons(tree.config) ? {} : { clean: true }),
      timeoutMs: limit.minutes * 60_000,
      // silent after a retry of its service: resumed once, then halted — never waited for to its limit
      stalled: readerStall(ctx.env),
      logFile: path.join(tree.root, ".strom", "runs", `${kind}-${stem}-${name}.log`),
      ...(model ? { model } : {}),
      // the reasoning effort the person chose for the agent (model.effort): readers read with it too
      ...(effort ? { effort } : {}),
      ...(more.signal ? { signal: more.signal } : {}),
      ...usageOpt(tree, `${kind}-${stem}-${name}`, { agent: agentId, key: sizes.asked ?? sizes.key, ...(model ? { model } : {}), ...(effort ? { effort } : {}), reader: kind }),
    });
    const ranMs = Date.now() - startedAt;
    // its own folder (settings, room) cleared as it ends
    leaveReaderRoom(own);
    // the reader as it went, for the measure of the reading of scans (core/metrics.ts)
    recordReader(tree, ctx.env, {
      reader: `${kind}-${stem}-${name}`,
      kind,
      agent: agentId,
      key: sizes.asked ?? sizes.key,
      model,
      reported: r.metrics.model,
      views: views.length,
      // the views it was given, by their file: two readers of one reading (a document read twice) each get their own
      viewFiles: views.map((v) => path.basename(v)),
      px: views.reduce((n, v) => {
        const s = imageSizeOfFile(v);
        return n + (s ? s.width * s.height : 0);
      }, 0),
      outcome: r.outcome,
      // its service went silent after a retry (outcome "error": halted, as an older strom reads it too), and how often
      ...(r.stalled ? { stalled: true } : {}),
      ...(r.stalls ? { stalls: r.stalls } : {}),
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
    // not logged in: said once as it happens, with how to log in (K040)
    if (r.outcome === "auth" && !authTold) {
      authTold = true;
      progress(`■ ${name}: ${readerAuthSaid(ctx, tree, agentId)}`);
    }
    if (r.outcome !== "ok") failed.push(`${name} (${r.outcome === "error" && refusedBySandbox(r.text) ? "no reader can start in this sandbox" : r.stalled ? ui(readersLang(ctx, tree), "ui.read.stalled") : r.outcome === "error" && r.modelRejected ? `${agentId === "codex" ? `the model ${model ?? "it reads with"} is not available in the Codex CLI installed here — update Codex: npm install -g @openai/codex@latest, or another model` : `${agentId} does not take the model ${model ?? "it reads with"} — another model`}` : r.outcome === "timeout" ? ui(readersLang(ctx, tree), "ui.read.failed.timeout", { minutes: limit.minutes }) : r.outcome})`);
    const written = fs.readFileSync(report, "utf8");
    if (!/^##\s/m.test(written) && r.text.trim()) fs.appendFileSync(report, r.text.trim() + "\n");
    return { report, text: fs.readFileSync(report, "utf8"), outcome: r.outcome, ...(r.metrics.costUsd !== undefined ? { costUsd: r.metrics.costUsd } : {}), ...(r.metrics.costPartial ? { costPartial: true } : {}), ...(r.resumeAt ? { resumeAt: r.resumeAt } : {}), ...(r.outcome === "error" && r.modelRejected ? { modelRejected: true as const } : {}) };
  };
  return { agent: agentId, model, effort, viewMax: sizes.read, viewMin: sizes.min, viewLift: sizes.max, parallel, stem, reportsDir, read, cost: () => cost, runs: () => runs, partial: () => partial, failed, progress };
}

/**
 * The readers of a reading as asked (`own.with`): a reading service's (core/readprovider.ts kind "service":
 * serviceReaders), else an agent's (readers()) — one shape for both, so a reading goes on as it is with either.
 */
export function readTeam(ctx: Context, tree: Tree, shared: string, kind: string, first: string, opts: Record<string, unknown>, reportsAt?: string, own: { stem?: string; with?: { agent: string; model?: string | undefined; effort?: string | undefined } } = {}): Readers {
  const p = own.with ? readProvider(own.with.agent, ctx.env) : undefined;
  if (p?.kind === "service") return serviceReaders(ctx, tree, shared, kind, p, opts, reportsAt, own);
  return readers(ctx, tree, shared, kind, first, opts, reportsAt, own);
}

/** The longest side of an image a service is given where it says none: the original's, as it is (never enlarged). */
const SERVICE_MAX_SIDE = 12_000;
/** The minutes a service may take for one reader (all its pages) where --minutes says none. */
const SERVICE_MINUTES = 10;

/** What the research knows of a source read again, as a service is told it (never a transcript or a name). */
function contextOf(about: SourceAbout | undefined): { kind?: string; language?: string; date?: string; locator?: string } {
  if (!about) return {};
  return { ...(about.kind ? { kind: about.kind } : {}), ...(about.language ? { language: about.language } : {}), ...(about.date ? { date: about.date } : {}), ...(about.locator ? { locator: about.locator } : {}) };
}

/** The place of the lines of a view on its page: their box (fractions of the view) of the whole page. */
function onPage(view: DocPageView, box: ReadBox): ReadBox {
  const part = view.shows ?? view.region;
  return part ? within(part, box) : box;
}

/** Where all the lines of a view stand together (fractions of the view), none when a line says not where. */
function around(lines: { box?: ReadBox }[]): ReadBox | undefined {
  if (!lines.length || lines.some((l) => !l.box)) return undefined;
  const x0 = Math.min(...lines.map((l) => l.box![0]));
  const y0 = Math.min(...lines.map((l) => l.box![1]));
  const x1 = Math.max(...lines.map((l) => l.box![0] + l.box![2]));
  const y1 = Math.max(...lines.map((l) => l.box![1] + l.box![3]));
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return [r(x0), r(y0), r(Math.min(1, x1) - x0), r(Math.min(1, y1) - y0)];
}

/**
 * The readers of a reading service: each page's view given to it alone in its own work folder (`read()`), what it
 * read written as a reader's report of today's form — the document block (legible), one entry of each page with its
 * transcript and where it stands, the done line — and its lines with where they stand beside it (<report>.lines.json,
 * fractions of the page). A service reads the transcript alone: no translation, no people (core/readprovider.ts).
 */
function serviceReaders(ctx: Context, tree: Tree, shared: string, kind: string, p: ReadProvider, opts: Record<string, unknown>, reportsAt: string | undefined, own: { stem?: string; with?: { agent: string; model?: string | undefined } }): Readers {
  refuseInArchive(tree, `strom ${kind}`);
  refuseReadersWhenFinishing(tree.root, ctx.env);
  const ready = p.ready(ctx.env);
  if (!ready.ready || !p.read) throw new UsageError(`${p.title} cannot read now (${ready.why ?? "it reads nothing"})`, { code: "read.agent", params: { agent: p.id, why: ready.why ?? "" }, hint: "another reader: --blind-agent <agent>" });
  const readOne = p.read.bind(p);
  const model = own.with?.model || undefined;
  const minutesSaid = opts.minutes === undefined ? undefined : Number(opts.minutes);
  if (minutesSaid !== undefined && !(minutesSaid > 0)) throw new UsageError(`invalid --minutes "${String(opts.minutes)}"`, { hint: "the minutes one reader may take, e.g. 10" });
  const minutes = minutesSaid ?? SERVICE_MINUTES;
  const reportsDir = reportsAt ?? path.join(tree.root, "notes", "readings");
  fs.mkdirSync(reportsDir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const stem = own.stem ?? claimStem(tree.root, kind, `${day}-${kind}`, (s) => fs.existsSync(path.join(reportsDir, `${s}-1-1.md`)));
  const progress = (s: string) => (ctx.json ? ctx.io.stderr : ctx.io.stdout)(s + "\n");
  const parallel = opts.parallel === undefined ? 3 : Math.max(1, Number(opts.parallel) || 1);
  let cost = 0;
  let runs = 0;
  let partial = false;
  const failed: string[] = [];
  const read: Readers["read"] = async (name, views, title, _prompt, more = {}) => {
    const report = path.join(reportsDir, `${stem}-${name}.md`);
    const work = readerRoomDir(shared, `${stem}-${name}`);
    fs.writeFileSync(report, more.head ?? `# ${title}\nStrom: ${VERSION}\nReader: ${p.id} (service)\n\n`);
    const pages: DocPageView[] = more.doc?.pages ?? views.map((v, i) => ({ n: i + 1, view: v }));
    const startedAt = Date.now();
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), minutes * 60_000);
    timer.unref?.();
    const onCancel = () => stop.abort();
    more.signal?.addEventListener("abort", onCancel, { once: true });
    const entries: string[] = [];
    const kept: { page: number; lines: { text: string; box?: ReadBox; confidence?: number; block?: number }[] }[] = [];
    const unreadable: string[] = [];
    let outcome = "ok";
    let why: string | undefined;
    let resets: string | undefined;
    let said: string | undefined;
    let usd: number | undefined;
    let credits: number | undefined;
    let costPartial = false;
    try {
      for (const view of pages) {
        if (stop.signal.aborted) break;
        const image = path.join(work, `page-${view.n}${path.extname(view.view) || ".jpg"}`);
        fs.copyFileSync(view.view, image);
        let out: ReadOutput;
        try {
          const ended = new Promise<ReadOutput>((resolve) => stop.signal.addEventListener("abort", () => resolve({ outcome: "stopped", transcript: "", lines: [] }), { once: true }));
          out = await Promise.race([readOne({ image, page: view.n, ...(view.region ? { region: view.region } : {}), context: contextOf(more.doc?.source), ...(model ? { model } : {}) }, { env: ctx.env, work, signal: stop.signal }), ended]);
        } catch (e) {
          out = { outcome: "error", transcript: "", lines: [], why: e instanceof Error ? e.message : String(e) };
        }
        if (out.model) said = out.model;
        if (out.cost) {
          if (out.cost.unit === "usd") usd = (usd ?? 0) + out.cost.amount;
          else credits = (credits ?? 0) + out.cost.amount;
          if (out.cost.partial) costPartial = true;
        }
        if (out.outcome === "unreadable") {
          unreadable.push(out.why ?? "other");
          continue;
        }
        if (out.outcome !== "ok") {
          outcome = out.outcome === "stopped" && !more.signal?.aborted ? "timeout" : out.outcome;
          why = out.why;
          resets = out.resets;
          break;
        }
        if (!out.transcript.trim() && !out.lines.length) {
          unreadable.push("other");
          continue;
        }
        // its text regions (a register's entries) each an entry, in their order; none said: all its lines one entry
        const blocks = out.lines.length && out.lines.every((l) => l.block !== undefined) ? [...new Set(out.lines.map((l) => l.block!))].sort((a, b) => a - b).map((k) => out.lines.filter((l) => l.block === k)) : [out.lines];
        for (const ls of blocks) {
          const text = blocks.length > 1 ? ls.map((l) => l.text).join(" | ") : out.transcript;
          if (!text.trim()) continue;
          const box = around(ls);
          entries.push(`## Entry e${entries.length + 1} · page ${view.n}\n${box ? `region: ${box.join(",")}\n` : ""}transcript: ${text.replace(/\s*\n\s*/gu, " | ")}\n`);
        }
        kept.push({ page: view.n, lines: out.lines.map((l) => ({ text: l.text, ...(l.box ? { box: onPage(view, l.box) } : {}), ...(l.confidence !== undefined ? { confidence: l.confidence } : {}), ...(l.block !== undefined ? { block: l.block } : {}) })) });
      }
    } finally {
      clearTimeout(timer);
      more.signal?.removeEventListener("abort", onCancel);
      leaveReaderRoom(work);
    }
    if (outcome === "ok" && stop.signal.aborted) outcome = more.signal?.aborted ? "stopped" : "timeout";
    const legible = !unreadable.length ? "yes" : entries.length ? "partly" : "no";
    const body = [`## Document\nlegible: ${legible}\n${legible !== "yes" ? `why: ${unreadable[0]}\n` : ""}`, ...entries, ...(outcome === "ok" ? [`done: ${entries.length} entries\n`] : [])].join("\n");
    fs.appendFileSync(report, body);
    if (kept.length) fs.writeFileSync(linesPathOf(report), JSON.stringify({ protocol: 1, provider: p.id, kind: "service", ...(said ?? model ? { model: said ?? model } : {}), pages: kept }, null, 2) + "\n");
    const ranMs = Date.now() - startedAt;
    recordReader(tree, ctx.env, {
      reader: `${kind}-${stem}-${name}`,
      kind,
      agent: p.id,
      provider: "service",
      key: model ? `${p.id} ${model}` : p.id,
      model,
      reported: said,
      views: pages.length,
      viewFiles: pages.map((v) => path.basename(v.view)),
      px: pages.reduce((n, v) => {
        const s = imageSizeOfFile(v.view);
        return n + (s ? s.width * s.height : 0);
      }, 0),
      outcome,
      usd,
      ...(credits !== undefined ? { credits } : {}),
      ...(costPartial ? { usdPartial: true } : {}),
      ms: ranMs,
      wallMs: ranMs,
      minutes,
      minutesFrom: minutesSaid !== undefined ? "option" : "default",
      report: tree.relative(report),
    });
    cost += usd ?? 0;
    runs++;
    if (costPartial || (usd === undefined && credits === undefined)) partial = true;
    if (outcome !== "ok") failed.push(`${name} (${outcome === "timeout" ? ui(readersLang(ctx, tree), "ui.read.failed.timeout", { minutes }) : outcome}${why && outcome !== "timeout" ? `: ${why}` : ""})`);
    return { report, text: fs.readFileSync(report, "utf8"), outcome, ...(usd !== undefined ? { costUsd: usd } : {}), ...(costPartial ? { costPartial: true } : {}), ...(credits !== undefined ? { credits } : {}), ...(resets ? { resumeAt: resets } : {}) };
  };
  return { agent: p.id, kind: "service", model, effort: undefined, viewMax: p.maxSide ?? SERVICE_MAX_SIDE, viewMin: 1, viewLift: 0, parallel, stem, reportsDir, read, cost: () => cost, runs: () => runs, partial: () => partial, failed, progress };
}
