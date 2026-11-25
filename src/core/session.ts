// Sessions: one agent working on one task. While a session is open, every
// operation is logged under its ID (data/ops/N0001.jsonl) and the tree knows
// who wrote what. Several agents may work side by side, each in a session of
// its own on a task of its own: the current session of an agent strom started
// lives in .strom/session-<worker>.json (STROM_WORKER, set by strom chat), of
// any other in .strom/session.json (local state, not evidence), or in
// STROM_SESSION (set by `strom run`). An agent may hold one session in each
// research (two conversations of the desktop app, neither started by strom):
// each research's session has its own pointer, .strom/sessions/<worker>~<G…>.json,
// and a command finds its own by what it names (a task, a session, a research). An agent working directly (no
// worker) whose CLI tells its conversation (CLAUDE_CODE_SESSION_ID…) has pointers of its own, .strom/session-@<id>.json,
// and its session's hold names it (core/holds.ts): two such agents never take each other's session.

import fs from "node:fs";
import path from "node:path";
import { ArchiveHeld, EXIT, StromError, TaskTaken, UsageError } from "./errors.ts";
import type { Research, Session, Task } from "./model.ts";
import { effectiveDirection, scopes } from "./directions.ts";
import { now, VERSION, type Tree } from "./tree.ts";
import { makeNote, makeNotes } from "./actions.ts";
import type { Env } from "./paths.ts";
import { detectAgent } from "./which.ts";
import { finishAsked, finishByLimit, finishFile, timeSaidFile } from "./clock.ts";
import { isLiveWorker, isWorkerId, otherVersionsAtWork } from "./workers.ts";
import { compareVersions } from "./semver.ts";
import { clearOld, directAgentId, newHold, readHold, readTaken, removeHold, sessionLife, takenFile, writeHold, writeTaken, type Life, type Taken } from "./holds.ts";
import { phrase } from "./phrases.ts";
import { clock } from "./net.ts";
import { PROFILES } from "../agents/profiles.ts";
import { readCodexConfig } from "../agents/effort.ts";
import { clearSessionWait, permissionWait, waitingForDecision } from "./archivewait.ts";
import { forgetLeftAlone } from "./leftalone.ts";
import { Settings } from "./config.ts";
import { unsavedOwnWait } from "./ownsave.ts";
import { runs } from "../cli/format.ts";
import { claimSite, heldSiteOfTask, heldSites, holderWords, releaseHolder, restrictedSiteOfTask, transferSite, type Holder, type SiteClaim } from "./archiveholds.ts";
import { forGaps, regionOfTask, takeRegion } from "./pastevents.ts";
import { placeOfTask, takePlace } from "./placehistory.ts";
import { PLACES_IDENTIFY_ORIGIN, placesSessionCounts } from "./placeid.ts";
import { fromDevice } from "./deviceagent.ts";

/** Whose pointers: a worker's, an agent's own conversation's ("@<id>": no letter of a worker's name), or anyone else's (""). */
function pointerName(env: Env): string {
  const w = env.STROM_WORKER;
  if (isWorkerId(w)) return w;
  const id = directAgentId(env);
  return id ? `@${id}` : "";
}

function currentFile(tree: Tree, env: Env = tree.env): string {
  const name = pointerName(env);
  return path.join(tree.root, ".strom", name ? `session-${name}.json` : "session.json");
}

/** Who holds a session, for keeping agents apart: its worker, a run, an agent's own conversation (its hold), or anyone else. */
function holder(tree: Tree, s: Pick<Session, "id" | "worker" | "runner">): string {
  if (s.worker) return s.worker;
  if (s.runner) return "run";
  const id = readHold(tree.root, s.id)?.hold.agentSession;
  return id ? `@${id}` : "";
}

/** Who this process works for. */
function holderOf(env: Env, runner?: string): string {
  if (isWorkerId(env.STROM_WORKER)) return env.STROM_WORKER;
  if (runner) return "run";
  const id = directAgentId(env);
  return id ? `@${id}` : "";
}

/** Is this open session the one asking's own (env: its worker, its run, its agent's conversation)? */
export function isOwnSession(tree: Tree, s: Session, env: Env = tree.env, runner?: string): boolean {
  return holder(tree, s) === holderOf(env, runner);
}

/** Open sessions of other agents, and the tasks they hold. */
export function othersAtWork(tree: Tree, env: Env = tree.env, runner?: string): { sessions: Session[]; tasks: Set<string> } {
  const me = holderOf(env, runner);
  const sessions = openSessions(tree).filter((s) => holder(tree, s) !== me);
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
  return path.join(researchPointers(tree), `${pointerName(env)}~${research}.json`);
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
  const prefix = `${pointerName(env)}~`;
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

/**
 * The line a session on a task works for when none is named: the task's own, or — its line ended — the narrowest active
 * line its people are in (core/directions.ts effectiveDirection; the task keeps its research); a task of no research: none.
 */
function taskLine(tree: Tree, task: Task | undefined): string | undefined {
  if (!task?.research) return undefined;
  if (tree.get<Research>(task.research)?.state !== "done") return task.research;
  return effectiveDirection(tree, task, scopes(tree));
}

/** Start a session on a task (the task goes to "doing"). One open session per agent; one agent per task. */
export function startSession(tree: Tree, opts: { task?: Task; research?: string; runner?: string; model?: string; effort?: string }): Session {
  return tree.withTreeLock(() => {
    const me = holderOf(tree.env, opts.runner);
    // one open session per agent in each research (each has its own pointer); a session of no research is the agent's only one
    const research = opts.research ?? taskLine(tree, opts.task);
    const busy = openSessions(tree).filter((s) => holder(tree, s) === me && (!research || !s.research || s.research === research));
    if (busy.length)
      throw new UsageError(`session ${busy[0]!.id} is still open${busy[0]!.task ? ` on ${busy[0]!.task}` : ""}`, {
        hint: `finish it: strom session close --summary "…" --next "…"   (or, if it died: strom session close ${busy[0]!.id} --interrupted)`,
      });
    const taken = opts.task ? othersAtWork(tree, tree.env, opts.runner).sessions.find((s) => s.task === opts.task!.id) : undefined;
    if (taken) throw heldError(tree, taken, opts.task!.id);
    const task = opts.task ? (tree.get<Task>(opts.task.id) ?? opts.task) : undefined;
    const agent = detectAgent(tree.env) ?? (opts.runner && opts.runner !== "script" ? opts.runner : undefined);
    // the model strom started the agent with (strom run, strom chat): what it read with, for a later review
    const model = opts.model ?? tree.env.STROM_MODEL?.trim();
    // the reasoning effort it ran with: strom's (the person's model.effort), else what Codex's own config says (read only)
    const effort = opts.effort ?? (tree.env.STROM_MODEL_EFFORT?.trim() || (agent === "codex" ? readCodexConfig(tree.env).effort : undefined));
    // the device of the home network whose terminal started it (spec 094 K3.15: who started it)
    const device = fromDevice(tree.env);
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
      ...(research ? { research } : {}),
      ...(opts.runner ? { runner: opts.runner } : {}),
      ...(isWorkerId(tree.env.STROM_WORKER) ? { worker: tree.env.STROM_WORKER } : {}),
      ...(agent ? { agent } : {}),
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {}),
      ...(device ? { device } : {}),
      strom: VERSION,
    };
    tree.put(s, { op: "session.start", targets: [s.id, ...(task ? [task.id] : [])], summary: `${s.id} session started${task ? ` on ${task.id}` : ""}` });
    tree.actor = s.id;
    if (task && task.state !== "doing") {
      // taken up: what kept it aside goes (a parked task's date and reason)
      const { parkedUntil: _until, parkedReason: _reason, parkedFor: _for, awaitsPermission: _decision, ...rest } = task;
      const doing = { ...rest, state: "doing" as const, updated: now() };
      tree.put(doing, { op: "task.start", targets: [doing.id, s.id], summary: `${doing.id} start` });
    }
    // a region's task of history: this tree holds the region while it builds its catalog, or fills its gaps (another
    // tree's task waits); a place's own history likewise (core/placehistory.ts)
    const region = task ? regionOfTask(task) : undefined;
    const place = task ? placeOfTask(task) : undefined;
    const shared = (region || place) && !tree.dryRun ? new Settings(tree.env, {}).shared()?.value : undefined;
    if (region && shared) takeRegion(shared, region, tree.config.id, forGaps(task!));
    if (place && shared) takePlace(shared, tree, place);
    setCurrent(tree, s.id);
    // its hold: who works in it, and the sign of life that keeps it (core/holds.ts)
    if (!tree.dryRun) writeHold(tree.root, newHold(tree.root, s, tree.env));
    return s;
  });
}

/** How long a task stays held without a sign of life, ms (task.hold: this computer's setting). */
export function holdMs(env: Env): number {
  return new Settings(env, {}).holdMinutes("task.hold") * 60_000;
}

/** The life of an open session (core/holds.ts sessionLife) with this computer's task.hold. */
export function lifeOf(tree: Tree, s: Session, now = Date.now()): Life {
  return sessionLife(tree.root, tree.dataDir, s, now, holdMs(tree.env));
}

/** Who holds a session, as the sentences say it: the agent's name, else what strom started. */
function whoHolds(s: Session, life?: Life): string {
  if (s.agent) return PROFILES[s.agent]?.name ?? s.agent;
  const by = life?.hold?.by ?? (s.runner ? "run" : s.worker ? "chat" : "agent");
  return by === "run" ? "strom run" : by === "chat" ? "strom chat" : "agent";
}

/**
 * A task held by another's open session (spec 127 K1.5): who, since when, the last sign of life and when it is free at the
 * latest — or, held by a live process on this computer, free when it ends.
 */
export function heldError(tree: Tree, s: Session, task: string, hint = "take another task: strom task next"): TaskTaken {
  const now = Date.now();
  const life = lifeOf(tree, s, now);
  return new TaskTaken(task, s.id, s.agent, {
    who: whoHolds(s, life),
    since: clock(life.since, now),
    last: clock(life.lastSign, now),
    ...(life.here || life.until === undefined ? {} : { until: clock(Math.max(life.until, now), now) }),
    hint,
  });
}

export interface Want {
  /** The task asked for by its ID (session start T…, task start T…): held by another, refused (K1.5). */
  task?: Task;
  /** The task proposed before (strom run, asked of its gate): taken when still free, else the next free one. */
  prefer?: string;
  /** The next free task of the queue, the tasks others hold left out. */
  next?: (busy: Set<string>) => Task | undefined;
  /** No session without a task: nothing free, nothing started (strom run). */
  need?: boolean;
  /** Sessions taken over before (takeOverLapsed): their records get the session that takes the work over. */
  tookOver?: Taken[];
  /** Told the tasks left out for their archive when nothing free is left (strom run: it waits for the archive). */
  archiveHeld?: ArchiveSkip[];
  research?: string;
  runner?: string;
  model?: string;
  effort?: string;
}

export interface Claimed {
  session: Session;
  task?: Task;
  /** The sessions of others taken over first (their holder gave no sign of life for task.hold, or its process is gone). */
  tookOver: Taken[];
  /** The task proposed, taken meanwhile by another: the one started instead is `task`. */
  instead?: string;
  /** Tasks left out because the archive they need (a restricted site) another session uses now (spec 127 K2.3). */
  archiveHeld: ArchiveSkip[];
}

/** A task left out because its archive is held: the site, who holds it, until when at the latest. */
export interface ArchiveSkip {
  task: string;
  site: string;
  /** For the agent: who uses it (core/archiveholds.ts holderWords). */
  who: string;
  /** The session holding it when it is of this research. */
  own?: string;
  since?: number;
  last?: number;
  until: number;
}

/** What a site held (or waited for first by another) tells of itself, for the sentences. */
export function archiveSkip(task: string, site: string, c: Exclude<SiteClaim, { ok: true }>, tree: string): ArchiveSkip {
  if (c.hold) {
    const own = path.resolve(c.hold.tree) === path.resolve(tree) && c.hold.session ? c.hold.session : undefined;
    return { task, site, who: holderWords(c.hold, tree), ...(own ? { own } : {}), since: c.life.since, last: c.life.lastSign, until: c.life.until };
  }
  return { task, site, who: `${c.waiter.by === "fetch" ? "strom fetch" : c.waiter.by === "run" ? "strom run" : "an agent"} of ${path.resolve(c.waiter.tree) === path.resolve(tree) ? "this research" : `another research (${path.basename(c.waiter.tree)})`}, waiting longer`, until: c.until };
}

function dedupe(skips: ArchiveSkip[]): ArchiveSkip[] {
  const seen = new Set<string>();
  return skips.filter((k) => !seen.has(k.task) && !!seen.add(k.task));
}

/** A task whose archive another session uses: refused, with the next free task offered (K2.5). */
export function archiveHeldError(skip: ArchiveSkip, free?: string): ArchiveHeld {
  const now = Date.now();
  return new ArchiveHeld(skip.task, skip.site, {
    who: skip.who,
    ...(skip.own ? { own: skip.own } : {}),
    since: clock(skip.since ?? now, now),
    last: clock(skip.last ?? now, now),
    until: clock(Math.max(skip.until, now), now),
    hint: free ? `take another task: strom session start ${free} (the next free one)` : "take another task: strom task next",
  });
}

/** The tasks a session start left out for their archive, said to the agent in one line each site (K2.5). */
export function archiveHeldLines(skips: ArchiveSkip[], took?: string): string[] {
  const now = Date.now();
  const bySite = new Map<string, ArchiveSkip[]>();
  for (const k of skips) bySite.set(k.site, [...(bySite.get(k.site) ?? []), k]);
  return [...bySite.values()].map((ks) => {
    const k = ks[0]!;
    return `${ks.map((x) => x.task).join(", ")} left for now: ${k.site} restricts automated access and ${k.who} uses it (${k.since !== undefined ? `since ${clock(k.since, now)}, last request ${clock(k.last ?? k.since, now)}, ` : ""}free by ${clock(Math.max(k.until, now), now)} at the latest)${took ? ` — took ${took} instead` : ""}`;
  });
}

/**
 * The open sessions of others that lapsed (core/holds.ts sessionLife), taken over under the tree's lock: closed as
 * interrupted by the one taking work (its kind: run, chat, agent), their task back to the queue with a note, a record
 * for their old holder (.strom/taken/<N…>.json; the session that took the work over is added by claimTask). Holds of
 * sessions no longer open, and records long read, go.
 */
export function takeOverLapsed(tree: Tree, runner?: string): Taken[] {
  if (tree.dryRun) return [];
  return tree.withTreeLock(() => {
    const env = tree.env;
    const now = Date.now();
    const ms = holdMs(env);
    const kind: NonNullable<Session["endedBy"]> = runner ? "run" : isWorkerId(env.STROM_WORKER) ? "chat" : "agent";
    const took: Taken[] = [];
    for (const s of openSessions(tree)) {
      if (isOwnSession(tree, s, env, runner)) continue;
      const life = sessionLife(tree.root, tree.dataDir, s, now, ms);
      if (life.alive) continue;
      took.push(takeOver(tree, s, life, kind, now));
    }
    clearOld(tree.root, new Set(openSessions(tree).map((s) => s.id)), now);
    return took;
  });
}

/**
 * One open session taken over (its holder gave no sign of life, or its process is gone): closed as interrupted, its task
 * back to the queue with a note of the takeover, and the record its old holder is told by when it writes again
 * (.strom/taken/<N…>.json) — `summary`: what the session's summary says instead of the takeover (a run's own words).
 */
export function takeOver(tree: Tree, s: Session, life: Life, endedBy: NonNullable<Session["endedBy"]>, now = Date.now(), summary?: string): Taken {
  const minutes = Math.max(0, Math.round((now - life.lastSign) / 60_000));
  // a process gone (kill -9, a closed window): taken at once, never "after 0 minutes"
  const why = life.reason === "dead" ? phrase(tree.lang, "session.taken.dead", { session: s.id }) : phrase(tree.lang, "session.taken", { minutes, session: s.id });
  closeSession(tree, s, { summary: summary ?? why, next: why, interrupted: true, endedBy });
  const worker = s.worker ?? life.hold?.worker;
  const agentSession = life.hold?.agentSession;
  const t: Taken = { session: s.id, ...(s.task ? { task: s.task } : {}), at: new Date(now).toISOString(), reason: life.reason ?? "expired", minutes, ...(worker ? { worker } : {}), ...(agentSession ? { agentSession } : {}) };
  if (!tree.dryRun) writeTaken(tree.root, t);
  return t;
}

/**
 * Take work (spec 127): under the tree's lock, (1) the sessions of others that lapsed are taken over — closed as
 * interrupted, their task back to the queue with a note, .strom/taken/<N…>.json for their old holder; (2) the tasks the
 * live ones hold are left out; (3) the session starts; (4) its hold is written (startSession). The one way a session
 * begins: strom run, session start (an agent of strom chat, or working directly), task start.
 */
export function claimTask(tree: Tree, want: Want): Claimed | undefined {
  return tree.withTreeLock(() => {
    const env = tree.env;
    // the sites others hold now (restricted archives, spec 127 K2): read under the tree's lock, each site's own lock
    // only taken after it (tree → archive, never the reverse)
    const shared = tree.dryRun ? undefined : new Settings(env, {}).shared()?.value;
    const by: Holder["by"] = want.runner ? "run" : isWorkerId(env.STROM_WORKER) ? "chat" : "agent";
    const me: Holder = { tree: tree.root, by, pid: process.pid };
    const held = heldSites(shared, me, env);
    const skipped: ArchiveSkip[] = [];
    // the archive of a task taken for it (its process first, its session once it starts): not taken — another took it
    // a moment ago, or waits for it first — the task is left out as the ones held already
    const takeArchive = (t: Task): { site?: string; ok: boolean } => {
      if (!shared) return { ok: true };
      const site = restrictedSiteOfTask(tree, t, shared);
      if (!site) return { ok: true };
      const c = claimSite(shared, site, me, env);
      if (c.ok) return { site, ok: true };
      held.set(site, c);
      skipped.push(archiveSkip(t.id, site, c, tree.root));
      return { site, ok: false };
    };
    const leaveOut = (t: Task): boolean => {
      const site = heldSiteOfTask(tree, t, held);
      if (!site) return false;
      skipped.push(archiveSkip(t.id, site, held.get(site)!, tree.root));
      return true;
    };
    // the next free one of the queue whose archive is free (a bounded look: each left out is out of the queue)
    const nextFree = (busy: Set<string>): { task?: Task; site?: string } => {
      const out = new Set(busy);
      for (let i = 0; i < 500; i++) {
        const t = want.next?.(out);
        if (!t) return {};
        out.add(t.id);
        if (leaveOut(t)) continue;
        const a = takeArchive(t);
        if (a.ok) return { task: t, ...(a.site ? { site: a.site } : {}) };
      }
      return {};
    };
    const refuse = (holder: Session, busy: Set<string>) => {
      const free = nextFree(busy).task;
      return heldError(tree, holder, want.task!.id, free ? `take another task: strom session start ${free.id} (the next free one)` : "take another task: strom task next");
    };
    const refuseArchive = (busy: Set<string>) => {
      const skip = skipped.find((k) => k.task === want.task!.id)!;
      const free = nextFree(new Set([...busy, want.task!.id])).task;
      return archiveHeldError(skip, free?.id);
    };
    // the task asked for held by another who lives, or its archive: refused before anything is taken over — a refused
    // command writes nothing, and a takeover it wrote would be taken back with it
    if (want.task) {
      const before = othersAtWork(tree, env, want.runner);
      const holder = before.sessions.find((s) => s.task === want.task!.id);
      if (holder && lifeOf(tree, holder).alive) throw refuse(holder, before.tasks);
      if (leaveOut(want.task)) throw refuseArchive(before.tasks);
    }
    const took = [...(want.tookOver ?? []), ...takeOverLapsed(tree, want.runner)];
    const others = othersAtWork(tree, env, want.runner);
    const busy = others.tasks;
    let task: Task | undefined;
    let site: string | undefined;
    let instead: string | undefined;
    if (want.task) {
      const holder = others.sessions.find((s) => s.task === want.task!.id);
      if (holder) throw refuse(holder, busy);
      task = tree.get<Task>(want.task.id) ?? want.task;
      const a = takeArchive(task);
      if (!a.ok) throw refuseArchive(busy);
      site = a.site;
    } else if (want.prefer) {
      const p = tree.get<Task>(want.prefer);
      const a = p && !busy.has(p.id) && ["open", "doing", "parked"].includes(p.state) && !leaveOut(p) ? takeArchive(p) : undefined;
      if (p && a?.ok) {
        task = p;
        site = a.site;
      } else {
        instead = want.prefer;
        ({ task, site } = nextFree(new Set([...busy, want.prefer])));
      }
    } else ({ task, site } = nextFree(busy));
    const record = (by?: string) => {
      if (tree.dryRun) return;
      for (const t of took) writeTaken(tree.root, { ...t, ...(by ? { by } : {}) });
    };
    if (!task && want.need) {
      record();
      want.archiveHeld?.push(...dedupe(skipped));
      return undefined;
    }
    const session = startSession(tree, { ...(task ? { task } : {}), ...(want.research ? { research: want.research } : {}), ...(want.runner ? { runner: want.runner } : {}), ...(want.model ? { model: want.model } : {}), ...(want.effort ? { effort: want.effort } : {}) });
    record(session.id);
    // the archive taken for the task: its session's now (it lapses with the session, or with no request for archive.hold)
    if (site && shared) {
      const worker = isWorkerId(env.STROM_WORKER) ? env.STROM_WORKER : undefined;
      const agentSession = worker ? undefined : directAgentId(env);
      transferSite(shared, site, me, { tree: tree.root, session: session.id, ...(task ? { task: task.id } : {}), ...(want.research ? { research: want.research } : {}), by, ...(worker ? { worker } : {}), ...(session.agent ? { agent: session.agent } : {}), ...(agentSession ? { agentSession } : {}) });
    }
    return { session, ...(task ? { task: tree.get<Task>(task.id) ?? task } : {}), tookOver: took, ...(instead && task?.id !== instead ? { instead } : {}), archiveHeld: dedupe(skipped) };
  });
}

/** The first strom that holds tasks (spec 127): one before it works as before beside this one. */
const HOLDS_SINCE = "1.36.0-0";

/** The versions of strom without holds of tasks at work in this tree ("< 1.25": one that says none). */
export function olderBeside(root: string): string[] {
  return otherVersionsAtWork(root, VERSION)
    .filter((v) => !v || compareVersions(v, HOLDS_SINCE) < 0)
    .map((v) => v || "< 1.25");
}

/** Said to the agent once a session starts: an older strom beside this one, whose sessions are never taken over while it works. */
export function olderBesideLine(root: string): string | undefined {
  const older = olderBeside(root);
  return older.length ? `strom ${older.join(", ")} works beside this one, without holds of tasks: its sessions are not taken over while it runs, and restricted archives are watched only by the limiter` : undefined;
}

/** A session taken over, said to the agent that took work. */
export function tookOverLine(t: Taken): string {
  return `took over session ${t.session}${t.task ? ` (${t.task})` : ""}: ${t.reason === "dead" ? "its process had ended" : `no sign of life for ${t.minutes} min`}; its task is back in the queue`;
}

/** The IDs this agent's pointers name, open or not (core/holds.ts: a session taken over from it is closed). */
function pointedIds(tree: Tree, env: Env): string[] {
  const prefix = `${pointerName(env)}~`;
  let names: string[] = [];
  try {
    names = fs.readdirSync(researchPointers(tree)).filter((n) => n.startsWith(prefix) && n.endsWith(".json"));
  } catch {
    // none
  }
  return [pointerId(currentFile(tree, env)), ...names.map((n) => pointerId(path.join(researchPointers(tree), n)))].filter((x): x is string => !!x);
}

/**
 * The session taken over from the one asking (spec 127 K4): the session strom run gave it, or the one its pointers name,
 * closed by another who took the work over — none while it holds an open session of its own.
 */
export function takenOf(tree: Tree, env: Env): Taken | undefined {
  if (env.STROM_SESSION) {
    const s = tree.get<Session>(env.STROM_SESSION);
    return s && s.state !== "open" ? readTaken(tree.root, s.id) : undefined;
  }
  if (ownSessions(tree, env).length) return undefined;
  for (const id of pointedIds(tree, env)) {
    const s = tree.get<Session>(id);
    const t = s && s.state !== "open" ? readTaken(tree.root, id) : undefined;
    if (t) return t;
  }
  return undefined;
}

/** What the old holder of a session taken over is told when it writes again (exit 3): its work stays, the task is another's. */
export function takenError(t: Taken): StromError {
  const at = clock(Date.parse(t.at));
  const what = t.task ? `task ${t.task}` : `the work of session ${t.session}`;
  return new StromError(
    `${what} was taken over${t.by ? ` by session ${t.by}` : ""} at ${at} ${t.reason === "dead" ? "as its process had ended" : `after ${t.minutes} min without a sign of life`}; your session ${t.session} is closed as interrupted, what you wrote stays.${t.task ? ` Do not write to ${t.task}.` : ""}`,
    {
      exitCode: EXIT.needsInput,
      code: "session.taken",
      ...(t.reason === "dead" ? { textCode: "session.taken.dead", hintCode: "session.taken" } : {}),
      hint: "next free task: strom task next",
      params: { task: t.task ?? t.session, by: t.by ?? "–", at, minutes: String(t.minutes), session: t.session },
    },
  );
}

/** Commands that take work themselves (a session of their own): never refused for a session taken over before. */
const TAKES_WORK = new Set(["session start", "task start", "run", "chat"]);

/** Commands of one task: refused when another's open session holds it (task.held). */
const OF_A_TASK = new Set(["task start", "task done", "task park", "task wait", "note add"]);

/** The task a command of one task names (its first argument, a T…), else none. */
function taskOfCommand(cmd: string[], args: string[]): string | undefined {
  const id = args[0]?.trim().toUpperCase();
  return OF_A_TASK.has(cmd.join(" ")) && id && /^T\d+$/.test(id) ? `T${id.slice(1).padStart(4, "0")}` : undefined;
}

/** A task held by another's open session: refused to the one asking (spec 127 K1.5, task.held). */
export function assertNotHeld(tree: Tree, env: Env, task: string): void {
  const other = othersAtWork(tree, env).sessions.find((s) => s.task === task);
  if (other) throw heldError(tree, other, task);
}

/**
 * Fencing (spec 127 K4), before a writing command: a command of one task another's session holds is refused with
 * task.held; any other write of one whose session was taken over, with session.taken — reads pass.
 */
export function fence(tree: Tree, env: Env, cmd: string[], args: string[]): void {
  const name = cmd.join(" ");
  const task = taskOfCommand(cmd, args);
  if (task && name !== "task start" && tree.get<Task>(task)) assertNotHeld(tree, env, task);
  if (TAKES_WORK.has(name)) return;
  const taken = takenOf(tree, env);
  if (taken) throw takenError(taken);
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
/** The person's "next" for a task is used once: a session on it ended (strom task order; "last" stays). */
function onceDone(t: Task): Task {
  if (t.queueAt?.do !== "next") return t;
  const { queueAt: _used, ...rest } = t;
  return rest;
}

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
      const note = makeNote(tree, `${input.interrupted ? "interrupted" : "continued"} in ${s.id}: ${input.next || "(no handover)"}`.slice(0, 500));
      // a fetch of this session met an archive's question the person has not answered yet: the task waits for the
      // decision (woken by it, core/archivewait.ts), not back in the queue to ask again and again
      const decision = permissionWait(tree, task, s.id);
      if (decision) {
        const waits: Task = { ...onceDone(waitingForDecision(tree, task, decision)), notes: [...task.notes, note], updated: now() };
        tree.put(waits, { op: "task.wait", targets: [task.id, s.id], summary: `${task.id} waits for the person's decision on ${decision.hosts.join(", ")}` });
      } else {
        const back: Task = { ...onceDone(task), state: "open", notes: [...task.notes, note], updated: now() };
        tree.put(back, { op: "task.continue", targets: [task.id, s.id], summary: `${task.id} back to the queue` });
      }
    } else if (task && task.state === "waiting") {
      // waiting for images its own agent's browser was to save, none of which came (core/ownsave.ts): back in the queue
      // with the images left — a wait no file would ever end, never the person's
      const settings = new Settings(tree.env, {});
      const left = unsavedOwnWait(tree, task, { shared: settings.shared()?.value, downloads: settings.downloads() });
      if (left) {
        const images = runs(left.map((r) => r.n));
        const note = makeNote(tree, `${input.interrupted ? "interrupted" : "closed"} in ${s.id}: image ${images} of ${task.awaits!.recordset} still to be saved through the browser (strom media save) — nothing came`.slice(0, 500));
        const back: Task = { ...onceDone(task), state: "open", notes: [...task.notes, note], updated: now() };
        for (const k of ["waitingOn", "awaits", "awaitsCheck", "awaitsPermission", "wait", "sent"] as const) delete back[k];
        tree.put(back, { op: "task.continue", targets: [task.id, s.id], summary: `${task.id} back to the queue: image ${images} of ${task.awaits!.recordset} not saved through the browser` });
      }
    }
    // a session on the places: what it did counted by strom (identified, verified, asked …) before the agent's words
    const counts = task?.origin === PLACES_IDENTIFY_ORIGIN ? placesSessionCounts(tree, s.id) : "";
    if (counts) input = { ...input, summary: input.summary.trim() ? `${counts} — ${input.summary.trim()}` : counts };
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
  if (!tree.dryRun) {
    removeHold(tree.root, closed.id);
    // the restricted archives it held let go: the one waiting longest for each goes first (spec 127 K2)
    releaseHolder(new Settings(tree.env, {}).shared()?.value, { tree: tree.root, session: closed.id, by: "agent" });
    // a record of a takeover a failed command took back (its session open again): never its holder's refusal once it
    // closes (takeOver writes its own record after this close)
    fs.rmSync(takenFile(tree.root, closed.id), { force: true });
    fs.rmSync(finishFile(tree.root, closed.id), { force: true });
    clearSessionWait(tree.root, closed.id);
    forgetLeftAlone(tree.root, closed.id);
    // the time it was told (core/clock.ts timeLine) and an early close said once: gone with it
    for (const f of [timeSaidFile(tree.root, closed.id), timeSaidFile(tree.root, closed.id).replace(/\.json$/, ".close")]) fs.rmSync(f, { force: true });
  }
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
