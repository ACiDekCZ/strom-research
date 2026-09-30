// The live bridge: the Strom app follows a research while it goes on. strom
// runs a small web server on this computer only (127.0.0.1, a random port, a
// secret token in every address) that only reads: the app, opened with
// ?live=<address>, takes the tree's GEDCOM from it and hears what changes —
// who is at work on what, what was recorded, what waits for the user. Nothing
// leaves the computer. The bridge ends by itself when nobody has asked it
// anything for a while (LIVE_IDLE_MS), or with strom live stop.
//
//   GET <token>/status     the tree, its researches, who is at work, what waits
//   GET <token>/tree.ged   the tree for the Strom app, as it is now, each entry with its image (the settings excerpts.*)
//   GET <token>/images.ged the same (the address an older strom gave)
//   GET <token>/log        what the research saved, newest first (each commit: when, what, for which task;
//                          text: its lines as the user reads them, kinds: what each is about)
//   GET <token>/events     server-sent events: hello, change, working
//   POST <token>/sync      the Strom app sends the user's edited tree back (?send=): kept to be shown
//                          and written on the user's word (strom sync) — nothing of the research changes
//   POST <token>/cancel    …or says it sends nothing ({"reason": "unchanged" | "cancelled" | "no-tree"})
//
// Only pages of the Strom app may read it (CORS: https://stromapp.info, its beta, and a
// local copy on localhost for its development), and a browser asks first
// whether a public page may talk to this computer (Private Network Access).
//
// It never ends because of one error: a read that fails while another strom
// writes is tried again at the next tick, a request that fails answers 500.
// What it did and what went wrong is in .strom/live.log (start, end and why,
// errors with their stack). Started again, it takes the address it had
// (.strom/live-last.json: its port while free, its token), so the app following
// it goes on by itself; a bridge that ended without a word is started again
// when a session starts (reviveLive).

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import type { Env } from "./paths.ts";
import { Tree, VERSION, type Op } from "./tree.ts";
import { changeLines, type ChangeKind } from "./changelog.ts";
import { directionOf, scopes, type Scope } from "./directions.ts";
import { ancestorGenerations } from "./people.ts";
import { phrase } from "./phrases.ts";
import { exportGedcom } from "../gedcom/export.ts";
import { excerptSettings, planExcerpts } from "./excerpt.ts";
import { noteAdoptFailed, noteNothingSent, pendingAdoption, receiveAdopted, receiveTree, SYNC_MAX_BYTES } from "./sync.ts";
import { ui } from "../cli/ui.ts";

/** New images for the app, made for at most so long when the tree changed (the rest the next time). */
const LIVE_IMAGES_MS = 20_000;
import { liveWorkers, type Paused } from "./workers.ts";
import { monthSpend, openSessions } from "./session.ts";
import { rankTasks } from "./queue.ts";
import { humanTask } from "../cli/human.ts";
import { knownNewerVersion } from "./update.ts";
import type { SyncInput } from "./sync.ts";
import { gitProgram, runGit } from "./git.ts";
import { appOpensLinks, appShowsEdges, isStromAppOrigin } from "./stromapp.ts";
import { Settings } from "./config.ts";
import { linkActions, linkHandlerState } from "./links.ts";
import { stromLauncher } from "./self.ts";
import type { Session, Task } from "./model.ts";

export interface LiveInfo {
  port: number;
  token: string;
  pid: number;
  /** The address the app is given (?live=…). */
  url: string;
  started: string;
  /** The strom version that serves it (a bridge of an older strom has none). */
  version?: string;
}

/** Where a running bridge of a tree is noted. */
export function liveFile(root: string): string {
  return path.join(root, ".strom", "live.json");
}

/** What the bridge did and what went wrong: plain text, the newest LIVE_LOG_BYTES at most. */
export function liveLogFile(root: string): string {
  return path.join(root, ".strom", "live.log");
}

const LIVE_LOG_BYTES = 200 * 1024;

/** The last bridge of a tree, kept after it ended: its address to take again, whether it ended as it should. */
interface LiveLast {
  port: number;
  token: string;
  pid: number;
  started: string;
  /** How it ended (idle, stopped, a signal); none while it runs — or when it ended without a word. */
  ended?: { at: string; reason: string };
}

function lastFile(root: string): string {
  return path.join(root, ".strom", "live-last.json");
}

function readLast(root: string): LiveLast | undefined {
  try {
    const last = JSON.parse(fs.readFileSync(lastFile(root), "utf8")) as LiveLast;
    return Number.isInteger(last.port) && /^[0-9a-f]{32}$/.test(last.token) ? last : undefined;
  } catch {
    return undefined;
  }
}

function writeLast(root: string, last: LiveLast): void {
  try {
    const file = lastFile(root);
    fs.writeFileSync(`${file}.${process.pid}`, JSON.stringify(last, null, 2));
    fs.renameSync(`${file}.${process.pid}`, file);
  } catch {
    // the next start takes a new address
  }
}

/** One line (or an error with its stack) into the bridge's log; never fails, never grows past its size. */
export function noteLive(root: string, text: string): void {
  try {
    const file = liveLogFile(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${new Date().toISOString()} [${process.pid}] ${text}\n`);
    const size = fs.statSync(file).size;
    if (size > LIVE_LOG_BYTES) {
      const kept = fs.readFileSync(file).subarray(size - LIVE_LOG_BYTES / 2);
      const from = kept.indexOf(10) + 1;
      fs.writeFileSync(file, kept.subarray(from));
    }
  } catch {
    // a log that cannot be written stops nothing
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? (e.stack ?? `${e.name}: ${e.message}`) : String(e);
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The bridge of this tree when it runs. */
export function liveRunning(root: string): LiveInfo | undefined {
  try {
    const info = JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as LiveInfo;
    if (info.pid && alive(info.pid)) return info;
  } catch {
    // none
  }
  return undefined;
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Start the bridge of a tree in the background (or find it running); undefined when it did not come up.
 * `current`: what is asked for is new (a copy with images): a bridge of an older strom is started again.
 */
export function startLive(root: string, env: Env, opts: { current?: boolean } = {}): LiveInfo | undefined {
  const running = liveRunning(root);
  if (running && (!opts.current || running.version === VERSION)) return running;
  if (running) stopLive(root, `a bridge of strom ${VERSION} is wanted (this one: ${running.version ?? "older"})`);
  fs.rmSync(liveFile(root), { force: true });
  const { command, args } = stromLauncher();
  // what the bridge says itself goes to its log — also what Node says when the bridge dies
  let log: number | "ignore" = "ignore";
  try {
    fs.mkdirSync(path.dirname(liveLogFile(root)), { recursive: true });
    log = fs.openSync(liveLogFile(root), "a");
  } catch {
    // without a log
  }
  const child = spawn(command, [...args, "live", "serve"], {
    cwd: root,
    env: { ...(env as NodeJS.ProcessEnv), STROM_TREE: root },
    detached: true,
    stdio: ["ignore", "ignore", log],
    windowsHide: true,
  });
  child.unref();
  if (typeof log === "number") fs.closeSync(log);
  for (let i = 0; i < 100; i++) {
    const info = liveRunning(root);
    if (info) return info;
    sleep(50);
  }
  return undefined;
}

/** Stop the bridge of a tree (why: into its log); false when none ran. */
export function stopLive(root: string, why = "strom live stop"): boolean {
  const info = liveRunning(root);
  if (!info) return false;
  noteLive(root, `stop asked: ${why}`);
  const last = readLast(root);
  if (last?.pid === info.pid) writeLast(root, { ...last, ended: { at: new Date().toISOString(), reason: why } });
  try {
    process.kill(info.pid);
  } catch {
    // already gone
  }
  fs.rmSync(liveFile(root), { force: true });
  return true;
}

/**
 * The bridge of a tree that ended without a word (a crash, killed) is started again — on its address, so the
 * Strom app following it goes on by itself. One that ended as it should (idle, stopped) stays so.
 */
export function reviveLive(root: string, env: Env): LiveInfo | undefined {
  const last = readLast(root);
  if (!last || last.ended || alive(last.pid) || liveRunning(root)) return undefined;
  noteLive(root, `the bridge ${last.pid} ended without a word: started again`);
  const info = startLive(root, env);
  // one that does not come up is not tried at every session again
  if (!info) writeLast(root, { ...last, ended: { at: new Date().toISOString(), reason: "did not start again" } });
  return info;
}

/** The pages that may read the bridge: the Strom app, and a local copy of it for its development. */
function allowedOrigin(origin: string | undefined): string | undefined {
  return origin && isStromAppOrigin(origin) ? origin : undefined;
}

function head(root: string): string {
  const r = spawnSync(gitProgram() ?? "git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : "";
}

/** The last commit and when it was made (the app: "changed 5 min ago"). */
function tip(root: string): { head: string; at?: string } {
  const r = spawnSync(gitProgram() ?? "git", ["log", "-1", "--format=%H%x1f%cI"], { cwd: root, encoding: "utf8", windowsHide: true });
  const [head = "", at = ""] = r.status === 0 ? r.stdout.trim().split("\x1f") : [];
  return { head, ...(at ? { at } : {}) };
}

/** What one commit saved, as lines: each change a command listed, else its subject. */
function saved(subject: string, body: string): string[] {
  const listed = body.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  return listed.length ? listed : [subject];
}

function subjects(root: string, from: string, to: string): string[] {
  const r = spawnSync(gitProgram() ?? "git", ["log", "--format=%x1e%s%x1f%b", from ? `${from}..${to}` : "-1", to], { cwd: root, encoding: "utf8", windowsHide: true });
  if (r.status !== 0) return [];
  const commits = r.stdout.split("\x1e").slice(1).reverse();
  return commits.flatMap((c) => {
    const [subject = "", body = ""] = c.split("\x1f");
    return saved(subject.trim(), body);
  });
}

/** At most so many commits /log gives (the app takes no more). */
const LOG_MAX = 500;

/**
 * What the research saved, newest first: each commit, when, what, and the task
 * it was saved for — the session whose operation log (data/ops/N….jsonl) or
 * record the commit wrote, else the one session open at that time.
 */
/** The operations each commit logged (data/ops/*.jsonl only grow: its added lines), in the order they were made. */
function opsByCommit(root: string, range: string[]): Map<string, Op[]> {
  const out = new Map<string, Op[]>();
  const r = runGit(root, ["log", ...range, "--format=%x1e%H", "-p", "--unified=0", "--no-color", "--no-ext-diff", "--", "data/ops/"]);
  if (r.status !== 0) return out;
  for (const c of r.stdout.split("\x1e").slice(1)) {
    const [hash = "", ...rest] = c.split("\n");
    const ops: Op[] = [];
    for (const line of rest)
      if (line.startsWith("+{"))
        try {
          ops.push(JSON.parse(line.slice(1)) as Op);
        } catch {
          // a line cut short: its commit is said by its subject
        }
    out.set(hash.trim(), ops.sort((a, b) => a.at.localeCompare(b.at)));
  }
  return out;
}

function history(root: string, tree: Tree, range: string[] = [`-n${LOG_MAX}`]): { head: string; at: string; what: string[]; text: string[]; kinds: ChangeKind[]; task?: string; research?: string }[] {
  const r = runGit(root, ["log", ...range, "--format=%x1e%H%x1f%cI%x1f%s%x1f%b%x1f", "--name-only"]);
  if (r.status !== 0) return [];
  const ops = opsByCommit(root, range);
  const sessions = new Map(tree.list<Session>("session").map((s) => [s.id, s]));
  const all = scopes(tree);
  const now = Date.now();
  const taskOf = (s: Session | undefined): { task?: string } => {
    if (!s?.task) return {};
    const task = tree.get<Task>(s.task);
    return { task: task ? `${task.id} ${task.what}` : s.task };
  };
  return r.stdout
    .split("\x1e")
    .slice(1)
    .map((c) => {
      const [head = "", at = "", subject = "", body = "", files = ""] = c.split("\x1f");
      const named = new Set<string>();
      for (const f of files.split("\n")) {
        const m = /^data\/(?:ops\/(N\d+)\.jsonl|sessions\/(N\d+)\.json)$/.exec(f.trim());
        if (m) named.add((m[1] ?? m[2])!);
      }
      const when = Date.parse(at);
      const open = named.size ? [] : [...sessions.values()].filter((s) => Date.parse(s.started) <= when && when <= (s.ended ? Date.parse(s.ended) : now));
      const s = named.size === 1 ? sessions.get([...named][0]!) : open.length === 1 ? open[0] : undefined;
      const lines = changeLines(tree, ops.get(head) ?? [], subject.trim(), tree.lang);
      const research = s ? sessionResearch(tree, s, all) : undefined;
      return { head, at, what: saved(subject.trim(), body), text: lines.map((l) => l.text), kinds: lines.map((l) => l.kind), ...taskOf(s), ...(research ? { research } : {}) };
    });
}

/** The direction a task belongs to, for the app's names of directions on tasks and its filter. */
function researchOf(tree: Tree, t: Task, all: Scope[]): { research?: string } {
  const research = directionOf(tree, t, all);
  return research ? { research } : {};
}

/** The one person a task is about (its subject names exactly one), for the app's badge on that person. */
function personOf(t: Task | undefined): { person?: string } {
  const people = (t?.subject ?? []).filter((id) => /^P\d{1,7}$/.test(id));
  return people.length === 1 ? { person: people[0]! } : {};
}

/** Who works, as the user reads it: "Claude Code on its own", "Codex conversation" in the research language. */
function whoAtWork(label: string, lang: string): string {
  const run = /^(.+) on its own$/.exec(label);
  if (run) return phrase(lang, "who.run", { agent: run[1]! });
  const chat = /^(.+) conversation$/.exec(label);
  return chat ? phrase(lang, "who.chat", { agent: chat[1]! }) : label;
}

/**
 * The person an agent works on, for the app to follow it in the tree: the first person its task is about (a marriage
 * names both, the one it asks about first), else the last one its session wrote about.
 */
function workedOn(root: string, tree: Tree, s: Session, task: Task | undefined): { person?: string } {
  const known = (id: string) => /^P\d{1,7}$/.test(id) && tree.get(id) !== undefined;
  const first = (task?.subject ?? []).find(known);
  if (first) return { person: first };
  const file = path.join(root, "data", "ops", `${s.id}.jsonl`);
  let lines: string[] = [];
  try {
    lines = fs.readFileSync(file, "utf8").split("\n");
  } catch {
    return {};
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    let op: Op;
    try {
      op = JSON.parse(lines[i]!) as Op;
    } catch {
      continue; // empty, or a line being written
    }
    const person = (op.targets ?? []).findLast(known);
    if (person) return { person };
  }
  return {};
}

/** Who is at work now, on which task (an agent strom started, and its open session). */
function working(root: string, tree: Tree, all: Scope[]): { who: string; since: string; session?: string; task?: string; person?: string; research?: string; paused?: Paused }[] {
  const open = openSessions(tree);
  return liveWorkers(root).map((w) => {
    const s = open.find((x) => x.worker === w.id);
    const task = s?.task ? tree.get<Task>(s.task) : undefined;
    const research = s ? sessionResearch(tree, s, all) : undefined;
    return {
      who: whoAtWork(w.label, tree.lang),
      since: w.since,
      ...(w.paused ? { paused: w.paused } : {}),
      ...(s ? { session: s.id, ...(s.task ? { task: task ? `${task.id} ${task.what}` : s.task } : {}), ...workedOn(root, tree, s, task) } : {}),
      ...(research ? { research } : {}),
    };
  });
}

/** The direction a session worked on: its own, else its task's. */
function sessionResearch(tree: Tree, s: Session, all: Scope[]): string | undefined {
  if (s.research) return s.research;
  const task = s.task ? tree.get<Task>(s.task) : undefined;
  return task ? directionOf(tree, task, all) : undefined;
}

/** At most so many characters of a reason or a summary the app is sent. */
const SHORT = 140;
const short = (text: string) => (text.length > SHORT ? `${text.slice(0, SHORT - 1).trimEnd()}…` : text);

/** Generations the app is told of a direction of ancestors: parents first. */
const DIRECTION_GENERATIONS = 12;

/**
 * The directions of the research for the app: how each goes, its tasks (each task counted in the one
 * direction it belongs to), whether an agent is at work on it, why it was paused or ended and since when,
 * the ancestors known in each generation, and what its last session did.
 */
function directions(tree: Tree, all: Scope[], queued: Task[], workingOn: (string | undefined)[]): Record<string, unknown>[] {
  const tasks = tree.list<Task>("task");
  const of = new Map(tasks.map((t) => [t.id, directionOf(tree, t, all)]));
  const ended = tree
    .list<Session>("session")
    .filter((s) => s.state !== "open" && s.ended && s.summary)
    .sort((a, b) => b.ended!.localeCompare(a.ended!));
  return all.map(({ research: r }) => {
    // a paused or ended one: what would come back to the queue
    const inQueue = r.state === "active" ? queued.filter((t) => of.get(t.id) === r.id).length : tasks.filter((t) => ["open", "doing"].includes(t.state) && of.get(t.id) === r.id).length;
    const reason = r.state === "active" ? undefined : [...r.notes].reverse().find((n) => n.text.startsWith(`${r.state}: `))?.text.slice(r.state.length + 2).trim();
    const last = ended.find((s) => sessionResearch(tree, s, all) === r.id);
    let generations: number[] | undefined;
    if (r.direction === "ancestors" && tree.get(r.focus)) {
      const gens = ancestorGenerations(tree, r.focus, DIRECTION_GENERATIONS + 1);
      const deepest = Math.min(Math.max(2, ...gens.values()), DIRECTION_GENERATIONS + 1);
      generations = [];
      for (let g = 2; g <= deepest; g++) generations.push([...gens.values()].filter((n) => n === g).length);
    }
    return {
      id: r.id,
      name: r.name,
      state: r.state,
      direction: r.direction,
      focus: r.focus,
      tasks: inQueue,
      waiting: tasks.filter((t) => t.state === "waiting" && of.get(t.id) === r.id).length,
      working: workingOn.includes(r.id),
      ...(reason ? { reason: short(reason) } : {}),
      since: r.stateSince ?? (r.state === "active" ? r.created : r.updated),
      ...(generations ? { generations } : {}),
      ...(last ? { last: { at: last.ended, text: short(last.summary!.replace(/\s+/g, " ").trim()) } } : {}),
    };
  });
}

/** How long what the system says of the links is taken as true (asking it costs a program started). */
const LINKS_FRESH_MS = 60_000;
let linksSeen: { at: number; actions: string[] } | undefined;

/** The strom-research:// links this computer takes: said to the app only while the scheme leads to this strom. */
function links(env: Env): string[] {
  if (!linksSeen || Date.now() - linksSeen.at > LINKS_FRESH_MS) linksSeen = { at: Date.now(), actions: linkActions(linkHandlerState(env)) };
  return linksSeen.actions;
}

/** At most so many tasks of the queue the app is told (the rest counted): what comes next, then what was put aside. */
const QUEUE_NEXT = 14;
const QUEUE_PARKED = 6;

/** The agent's queue in its order, for the user (records by their names), and how many more there are. */
function queue(tree: Tree, next: Task[], all: Scope[]): { queue: { id: string; text: string; state: "next" | "parked"; person?: string; research?: string }[]; queueMore: number } {
  const lang = tree.lang;
  const parked = tree.list<Task>("task").filter((t) => t.state === "parked");
  const item = (state: "next" | "parked") => (t: Task) => ({ id: t.id, text: humanTask(tree, t.what, lang), state, ...personOf(t), ...researchOf(tree, t, all) });
  const shown = [...next.slice(0, QUEUE_NEXT).map(item("next")), ...parked.slice(0, QUEUE_PARKED).map(item("parked"))];
  return { queue: shown, queueMore: next.length + parked.length - shown.length };
}

/** The last tree the Strom app sent (through the bridge) that the research took and has not taken back. */
function lastIntake(tree: Tree): { id: string; at: string } | undefined {
  const last = tree
    .list<SyncInput>("input")
    .filter((i) => i.sync && !i.sync.undone && i.sync.applied.length && i.name.startsWith("strom-app-"))
    .sort((a, b) => a.created.localeCompare(b.created))
    .pop();
  return last ? { id: last.id, at: last.created } : undefined;
}

/** What the app shows beside the tree. */
function status(root: string, env: Env): Record<string, unknown> {
  const tree = Tree.open(root, env);
  const settings = new Settings(env, {});
  const waiting = tree.list<Task>("task").filter((t) => t.state === "waiting");
  const newer = knownNewerVersion(settings, env);
  const intake = lastIntake(tree);
  const last = tip(root);
  const all = scopes(tree);
  const next = rankTasks(tree, tree.list<Task>("task"), settings.strategy(tree.config)).map((r) => r.task);
  const atWork = working(root, tree, all);
  return {
    strom: VERSION,
    tree: { id: tree.config.id, name: tree.config.name, lang: tree.lang },
    head: last.head,
    ...(last.at ? { headAt: last.at } : {}),
    persons: tree.count("person"),
    families: tree.count("family"),
    researches: directions(tree, all, next, atWork.filter((w) => !w.paused).map((w) => w.research)),
    working: atWork,
    open: openSessions(tree).map((s) => ({ id: s.id, task: s.task, started: s.started })),
    // since when it waits: its last change is the one that made it wait
    waiting: waiting.map((t) => ({ id: t.id, what: t.what, on: t.waitingOn ?? "", at: t.updated, ...personOf(t), ...researchOf(tree, t, all) })),
    links: links(env),
    ...queue(tree, next, all),
    ...(newer ? { update: { version: newer } } : {}),
    spend: { ...monthSpend(tree, new Date().toISOString().slice(0, 7)), currency: "USD" },
    ...(intake ? { lastIntake: intake } : {}),
  };
}

/** Run the bridge of the tree here, until idle or stopped. */
export function serveLive(root: string, env: Env): Promise<void> {
  // the address of the last bridge, so the app that followed it finds this one
  const last = readLast(root);
  const token = last?.token ?? crypto.randomBytes(16).toString("hex");
  const idleMs = Number(env.STROM_LIVE_IDLE_MS ?? 2 * 60 * 60_000);
  const pollMs = Number(env.STROM_LIVE_POLL_MS ?? 2000);
  const streams = new Set<http.ServerResponse>();
  let lastAsked = Date.now();
  let ged: { head: string; links: string; text: string } | undefined;
  let log: { head: string; text: string } | undefined;

  /** A request that failed: said to the app, written into the log — the bridge goes on. */
  const failed = (req: http.IncomingMessage, res: http.ServerResponse, e: unknown) => {
    noteLive(root, `${req.method} ${String(req.url ?? "").replace(token, "…")} failed: ${errorText(e)}`);
    try {
      // an answer begun (the events) is only ended
      if (res.headersSent) res.end();
      else res.writeHead(500, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ error: (e as Error)?.message ?? String(e) }));
    } catch {
      res.destroy();
    }
  };

  const safely = (req: http.IncomingMessage, res: http.ServerResponse, fn: () => void) => {
    try {
      fn();
    } catch (e) {
      failed(req, res, e);
    }
  };

  const server = http.createServer((req, res) => safely(req, res, () => answer(req, res)));

  const answer = (req: http.IncomingMessage, res: http.ServerResponse) => {
    lastAsked = Date.now();
    const origin = allowedOrigin(req.headers.origin);
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      if (origin) {
        res.setHeader("Access-Control-Allow-Methods", "GET, POST");
        res.setHeader("Access-Control-Allow-Headers", String(req.headers["access-control-request-headers"] ?? ""));
        if (req.headers["access-control-request-private-network"]) res.setHeader("Access-Control-Allow-Private-Network", "true");
      }
      res.writeHead(origin ? 204 : 403).end();
      return;
    }
    const [, t, what] = (req.url ?? "").split("?")[0]!.split("/");
    if (req.method === "POST" && t === token && what === "sync") {
      receive(req, res, origin);
      return;
    }
    if (req.method === "POST" && t === token && what === "cancel") {
      nothing(req, res, origin);
      return;
    }
    if (req.method === "POST" && t === token && what === "adopt") {
      receive(req, res, origin, "adopt");
      return;
    }
    if (req.method !== "GET" || t !== token) {
      res.writeHead(404).end();
      return;
    }
    try {
      if (what === "adopt") {
        // the new research started from the app's link: which tree of the app it waits for (its mark), its name
        const mark = pendingAdoption(root);
        const tree = Tree.open(root, env);
        const body = mark ? { token: mark, name: tree.config.name, tree: tree.config.id } : { error: "this research waits for no tree" };
        const text = JSON.stringify(body);
        res.writeHead(mark ? 200 : 404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(text);
      } else if (what === "status") {
        // what is answered is made first: a read that fails can still answer 500
        const text = JSON.stringify(status(root, env));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(text);
      } else if (what === "log") {
        const h = head(root);
        if (!log || log.head !== h) log = { head: h, text: JSON.stringify({ entries: history(root, Tree.open(root, env)) }) };
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(log.text);
      } else if (what === "tree.ged" || what === "images.ged") {
        const h = head(root);
        if (!ged || ged.head !== h || ged.links !== (appOpensLinks(new Settings(env, {})) ? links(env).join(" ") : "")) {
          const tree = Tree.open(root, env);
          // the images from the cache; new ones made for a while at most (the rest the next time the tree changes)
          const set = excerptSettings(tree);
          const images = set ? planExcerpts(tree, set.shared, { quality: set.quality, for: set.for, maxBytes: set.mb * 1024 * 1024, budgetMs: LIVE_IMAGES_MS }) : undefined;
          // an app that opens strom-research:// links: each excerpt's mark, and the links this computer takes
          const opens = appOpensLinks(new Settings(env, {}));
          // …and where the tree ends, for an app that shows it
          const edges = appShowsEdges(new Settings(env, {}));
          const offered = opens ? links(env) : [];
          ged = {
            head: h,
            links: offered.join(" "),
            text: exportGedcom(tree, { for: "strom", ...(h ? { head: h } : {}), ...(images ? { excerpts: images.of } : {}), ...(opens ? { clips: true, research: true } : {}), ...(edges ? { edges } : {}), ...(offered.length ? { links: offered } : {}) }).text,
          };
        }
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Strom-Head": h }).end(ged.text);
      } else if (what === "events") {
        const hello = JSON.stringify(status(root, env));
        res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write(`event: hello\ndata: ${hello}\n\n`);
        streams.add(res);
        req.on("close", () => streams.delete(res));
        res.on("error", () => streams.delete(res));
      } else res.writeHead(404).end();
    } catch (e) {
      failed(req, res, e);
    }
  };

  /** The user's tree from the app: only from its pages, only so large; the answer in the research's language. */
  const receive = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, as: "sync" | "adopt" = "sync") => {
    const reply = (code: number, body: Record<string, unknown>) =>
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    const lang = () => {
      try {
        return Tree.open(root, env).lang;
      } catch {
        return "en";
      }
    };
    if (!origin) {
      reply(403, { error: "only the Strom app may send a tree here" });
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let over = false;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > SYNC_MAX_BYTES) over = true;
      else chunks.push(c);
    });
    req.on("error", (e) => noteLive(root, `a tree from the app did not come whole: ${errorText(e)}`));
    req.on("end", () => safely(req, res, () => {
      if (over) {
        reply(413, { error: ui(lang(), "ui.sync.bridge.large") });
        return;
      }
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        if (as === "adopt") {
          // kept for the research in the terminal to take in; the app links its tree to this research
          receiveAdopted(root, text);
          reply(200, { tree: Tree.open(root, env).config.id, head: head(root) ?? "" });
          return;
        }
        const got = receiveTree(root, env, text);
        reply(200, { ok: true, changes: got.changes, file: path.basename(got.file) });
      } catch (e) {
        const m = (e as Error).message;
        // the new research in the terminal waits for it: told, it stops waiting
        if (as === "adopt" && pendingAdoption(root)) noteAdoptFailed(root, /empty|no people/.test(m) ? "empty" : "other");
        const key = /another research/.test(m) ? "ui.sync.bridge.other" : /does not look like/.test(m) ? "ui.sync.bridge.foreign" : /empty|no people|not a GEDCOM/.test(m) ? "ui.sync.bridge.empty" : undefined;
        reply(400, { error: key ? ui(lang(), key) : m });
      }
    }));
  };

  /** The app sends nothing (unchanged, the user said no, no tree of this research): strom sync --app stops waiting. */
  const nothing = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined) => {
    const reply = (code: number, body: Record<string, unknown>) =>
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    if (!origin) {
      reply(403, { error: "only the Strom app may say so" });
      return;
    }
    let body = "";
    req.on("data", (c: Buffer) => {
      if (body.length < 4096) body += c.toString("utf8");
    });
    req.on("end", () => safely(req, res, () => {
      let reason = "cancelled";
      try {
        reason = String((JSON.parse(body) as { reason?: unknown }).reason ?? reason);
      } catch {
        reason = body.trim() || reason;
      }
      reply(200, { ok: true, reason: noteNothingSent(root, reason) });
    }));
  };

  // What breaks where nobody catches it is written down; the bridge only reads, so it goes on.
  process.on("uncaughtException", (e) => noteLive(root, `uncaught: ${errorText(e)}`));
  process.on("unhandledRejection", (e) => noteLive(root, `unhandled: ${errorText(e)}`));

  return new Promise((resolve) => {
    let up = false;
    let wanted = last?.port ?? 0;
    server.on("error", (e: NodeJS.ErrnoException) => {
      if (!up && wanted && e.code === "EADDRINUSE") {
        // its old port is taken meanwhile: another one (the app following the old address stops following)
        noteLive(root, `port ${wanted} is taken: another one`);
        wanted = 0;
        server.listen(0, "127.0.0.1");
        return;
      }
      noteLive(root, `the server: ${errorText(e)}`);
      if (!up) resolve();
    });
    server.listen(wanted, "127.0.0.1");
    server.once("listening", () => {
      up = true;
      const port = (server.address() as { port: number }).port;
      const info: LiveInfo = { port, token, pid: process.pid, url: `http://127.0.0.1:${port}/${token}`, started: new Date().toISOString(), version: VERSION };
      fs.mkdirSync(path.dirname(liveFile(root)), { recursive: true });
      fs.writeFileSync(liveFile(root), JSON.stringify(info, null, 2));
      writeLast(root, { port, token, pid: process.pid, started: info.started });
      noteLive(root, `started: strom ${VERSION}, port ${port}, ${last && last.port === port ? "the address of the last bridge" : last ? "the token of the last bridge, another port" : "a new address"}`);

      // A read that fails (another strom writing that moment) is tried again at the next tick; written down once.
      let trouble: { text: string; times: number } | undefined;
      const safe = <T>(what: string, fn: () => T): T | undefined => {
        try {
          const got = fn();
          if (trouble) noteLive(root, `works again (${trouble.times}× failed)`);
          trouble = undefined;
          return got;
        } catch (e) {
          const text = errorText(e);
          if (trouble?.text === text) trouble.times++;
          else {
            trouble = { text, times: 1 };
            noteLive(root, `${what} failed (tried again): ${text}`);
          }
          return undefined;
        }
      };

      // What changed: strom commits every change, so a new commit is news.
      let seen = safe("the start", () => head(root)) ?? "";
      const atWork = () => {
        const tree = Tree.open(root, env);
        return working(root, tree, scopes(tree));
      };
      let workers = safe("the start", () => JSON.stringify(atWork())) ?? "";
      const send = (event: string, data: unknown) => {
        for (const s of streams) s.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      const timer = setInterval(() => {
        if (streams.size) lastAsked = Date.now();
        if (Date.now() - lastAsked > idleMs) return stop("idle: nobody asked for a while");
        if (!streams.size) return;
        safe("a tick", () => {
          const { head: h, at } = tip(root);
          if (h && h !== seen) {
            // when the commit was made: the same as in /log, so the app knows it has it; each new commit as /log gives it (its task)
            const entries = history(root, Tree.open(root, env), seen ? [`-n${LOG_MAX}`, `${seen}..${h}`] : ["-1", h]);
            send("change", { head: h, what: subjects(root, seen, h), at: at ?? new Date().toISOString(), entries });
            seen = h;
          }
          const now = atWork();
          const w = JSON.stringify(now);
          if (w !== workers) {
            workers = w;
            send("working", now);
          }
        });
      }, pollMs);
      const keepAlive = setInterval(() => {
        for (const s of streams) s.write(": still here\n\n");
      }, 20_000);
      const stop = (why: string) => {
        clearInterval(timer);
        clearInterval(keepAlive);
        for (const s of streams) s.end();
        server.close();
        try {
          const now = JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as LiveInfo;
          if (now.pid === process.pid) fs.rmSync(liveFile(root), { force: true });
        } catch {
          // gone already
        }
        const was = readLast(root);
        if (was?.pid === process.pid && !was.ended) writeLast(root, { ...was, ended: { at: new Date().toISOString(), reason: why } });
        noteLive(root, `ended: ${why}`);
        resolve();
      };
      process.once("SIGTERM", () => stop("SIGTERM"));
      process.once("SIGINT", () => stop("SIGINT"));
    });
  });
}
