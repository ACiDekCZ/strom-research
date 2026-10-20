// A document read at once for the Strom app, through the bridge (the app's spec ZADANI_VYZKUM_vyfot-a-precti.md and
// the research's answer to it): the app sends the files (PUT /media/<sha256> with X-Strom-Read: 1, an input without an
// intake task), asks for them to be read (POST /read) and follows the reading (/status reads, the event read, GET
// /read/<id> — what its readers wrote so far too). Each reading is strom document read's (core/document.ts): queued
// by a strom of its own as the person's (--queue), then read by another, detached from the bridge — it outlives a
// bridge started again — one at a time in a tree, three more queued at most.
//
// What the app may spend: at most 20 readings an hour and 60 a day (read.app, raised by the person alone); never in an
// archive or a research waiting for its agent (no accepts.read there, every route 404 read.none). Nothing of the tree
// changes: the reading keeps an input and its result (notes/readings) — what goes into the tree the app sends as the
// person's edit (POST /sync).

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type { Env } from "./paths.ts";
import { newerTree, Tree } from "./tree.ts";
import type { Settings } from "./config.ts";
import { actsAsArchive } from "./state.ts";
import { APP_READ_FROM, alive, backBefore, buildResult, DOC_PAGES, FINAL_STATES, loadState, parseRegion, READ_ID, readsDir, reportPath, resultPath, saveState, shownName, statePath, type ReadResult, type ReadState, type ReadStateName } from "./document.ts";
import { knownOriginal } from "./originals.ts";
import { readableTypes } from "./readable.ts";
import { makeView } from "./views.ts";
import { inputPath } from "./media.ts";
import { sandboxOf } from "./sandbox.ts";
import { AGENTS, which } from "./which.ts";
import { assetPath } from "./assets.ts";
import { EXIT } from "./errors.ts";
import { forApp, refusal } from "./receive.ts";
import { stromLauncher } from "./self.ts";
import { normId } from "./records.ts";
import type { Input, Media, Person, Source } from "./model.ts";

/** The readings the app may ask, unless the person set others (read.app). */
export const APP_READ_DEFAULT = { hour: 20, day: 60 } as const;
/** Readings of the app waiting beside the one being read. */
export const READ_QUEUE_MAX = 3;
/** The largest file read (a page is read at 2000 px at most: a larger file adds nothing). */
export const READ_MAX_BYTES = 50 * 1024 * 1024;
/** The agents whose reader of documents was tried (the others wait for a live test: why agent.untested). */
export const READ_TESTED = ["claude", "script"];
/** The longest side of a page's picture for the app. */
const PAGE_PX = 2000;
const DAY_MS = 24 * 3600_000;
/** /status reads: those at work, and those ended in the last days. */
const STATUS_DAYS = 7;
/** GET /reads: the last days, and every reading no source is of yet. */
const LIST_DAYS = 90;
/** A queued reading whose strom was started and has not begun: started again after so long, given up after so many tries. */
const START_WAIT_MS = 30_000;
const START_TRIES = 3;
/** How long the agent's limit or login said by a reader keeps the app from asking (unless the agent says when it resets). */
const LIMIT_MS = 3600_000;
const AUTH_MS = 15 * 60_000;

export interface ReadLimits {
  hour: number;
  day: number;
}

/** read.app as it is set ("<hour> <day>"), else the default. */
export function appReadLimits(v: string | undefined): ReadLimits {
  const m = /^\s*(\d+)\s+(\d+)\s*$/u.exec(v ?? "");
  return m ? { hour: Number(m[1]), day: Number(m[2]) } : { ...APP_READ_DEFAULT };
}

/** The languages a reading translates into: those strom speaks (its catalogs and English). */
export function readLangs(): string[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(assetPath("lang"));
  } catch {
    // no catalogs: English alone
  }
  return [...new Set(["en", ...files.filter((f) => /^[a-z]{2,3}\.json$/u.test(f)).map((f) => f.slice(0, -5))])].sort();
}

// ── what was asked ──────────────────────────────────────────────────────────────────────────────────────────────

function askedFile(root: string): string {
  return path.join(readsDir(root), "app-asked.jsonl");
}

/** When the app asked readings (a new one, one again) in the last day. */
function askedTimes(root: string, now = Date.now()): number[] {
  let text = "";
  try {
    text = fs.readFileSync(askedFile(root), "utf8");
  } catch {
    return [];
  }
  const out: number[] = [];
  for (const line of text.split("\n")) {
    try {
      const at = Date.parse(String((JSON.parse(line) as { at?: unknown }).at));
      if (at > now - DAY_MS) out.push(at);
    } catch {
      // a line cut short
    }
  }
  return out.sort((a, b) => a - b);
}

/** A reading the app asked: noted (the file keeps the last day). */
export function noteAsked(root: string, id: string, what: "read" | "again", now = Date.now()): void {
  const keep = askedTimes(root, now).map((at) => JSON.stringify({ at: new Date(at).toISOString() }));
  fs.mkdirSync(readsDir(root), { recursive: true });
  const tmp = `${askedFile(root)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, [...keep, JSON.stringify({ at: new Date(now).toISOString(), id, what })].join("\n") + "\n");
  fs.renameSync(tmp, askedFile(root));
}

/** The limit a new reading would pass (`pending`: asked, not noted yet): none, or which and in how many seconds it frees. */
export function limitReached(root: string, limits: ReadLimits, pending: number, now = Date.now()): { per: "hour" | "day"; retry: number } | undefined {
  const times = askedTimes(root, now);
  for (const [per, ms, most] of [["hour", 3600_000, limits.hour], ["day", DAY_MS, limits.day]] as const) {
    const within = times.filter((t) => t > now - ms);
    if (within.length + pending < most) continue;
    // free once the oldest that keeps it full is older than the window (asked meanwhile: a minute)
    const oldest = within[Math.max(0, within.length + pending - most)];
    return { per, retry: oldest === undefined ? 60 : Math.max(1, Math.ceil((oldest + ms - now) / 1000)) };
  }
  return undefined;
}

// ── what the readings are ───────────────────────────────────────────────────────────────────────────────────────

/**
 * A reading as the bridge shows it: one at work whose process is gone, cancelled — read again, the reading before
 * (strom says so when it is next asked).
 */
function shown(s: ReadState): ReadState {
  if (FINAL_STATES.includes(s.state) || alive(s.pid) || (s.state === "queued" && !s.pid)) return s;
  return backBefore(s) ?? { ...s, state: "cancelled" };
}

export interface AppRead {
  id: string;
  state: ReadStateName;
  version: number;
  at: string;
  since: string;
  /** Its files (pages of one file a PDF's). */
  files: number;
  pages: number;
  readers: number;
  /** Readers that read to an end. */
  done: number;
  /** Entries read so far. */
  entries: number;
  name?: string;
  person?: string;
  /** Who asked it: the app, or the research (its agent, a person in the terminal). */
  from: "app" | "research";
  /** GET /reads: whether a source of the research is of it. */
  inSource?: boolean;
}

/** What /status, the event read and GET /reads say of each reading, made again only when one of its files changed. */
export class ReadingsSeen {
  private readonly cache = new Map<string, { key: string; read: AppRead }>();
  private readonly root: string;
  private readonly env: Env;
  constructor(root: string, env: Env) {
    this.root = root;
    this.env = env;
  }

  /** The readings here (their states, else their results in git), newest first. */
  all(): { read: AppRead; state?: ReadState }[] {
    const ids = new Set<string>();
    for (const dir of [readsDir(this.root), path.join(this.root, "notes", "readings")])
      for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
        const id = f.endsWith(".json") ? f.slice(0, -5) : "";
        if (READ_ID.test(id)) ids.add(id);
      }
    const out: { read: AppRead; state?: ReadState }[] = [];
    let tree: Tree | undefined;
    for (const id of ids) {
      const s = loadState(this.root, id);
      const key = this.keyOf(id, s);
      const had = this.cache.get(id);
      if (had && had.key === key) {
        out.push({ read: had.read, ...(s ? { state: shown(s) } : {}) });
        continue;
      }
      tree ??= Tree.open(this.root, this.env);
      const read = s ? this.ofState(tree, shown(s)) : this.ofResult(id);
      if (!read) continue;
      this.cache.set(id, { key, read });
      out.push({ read, ...(s ? { state: shown(s) } : {}) });
    }
    return out.sort((a, b) => b.read.at.localeCompare(a.read.at) || b.read.id.localeCompare(a.read.id));
  }

  /** What tells a reading changed: its state (and whether its process is there), its reports and result as they grow. */
  private keyOf(id: string, s: ReadState | undefined): string {
    const stamp = (f: string) => {
      try {
        const st = fs.statSync(f);
        return `${st.mtimeMs}:${st.size}`;
      } catch {
        return "-";
      }
    };
    if (!s) return stamp(resultPath(this.root, id));
    return [stamp(statePath(this.root, id)), shown(s).state, ...s.reports.map((r) => stamp(reportPath(this.root, id, r.n)))].join("|");
  }

  private ofState(tree: Tree, s: ReadState): AppRead {
    let entries = 0;
    let done = 0;
    try {
      const r = buildResult(tree, s);
      entries = r.entries.length;
      done = r.readers.ran;
    } catch {
      // a report being written: counted the next time
    }
    return this.summary(s, entries, done, s.from === APP_READ_FROM);
  }

  private ofResult(id: string): AppRead | undefined {
    try {
      const r = JSON.parse(fs.readFileSync(resultPath(this.root, id), "utf8")) as ReadResult & { from?: string };
      if (r.id !== id || !Array.isArray(r.pages)) return undefined;
      return this.summary({ ...r, readers: r.readers?.asked ?? 1 }, r.entries?.length ?? 0, r.readers?.ran ?? 0, false);
    } catch {
      return undefined;
    }
  }

  private summary(s: { id: string; state: ReadStateName; version: number; at: string; since: string; pages: ReadState["pages"]; readers: number; persons?: string[] }, entries: number, done: number, app: boolean): AppRead {
    return {
      id: s.id,
      state: s.state,
      version: s.version,
      at: s.at,
      since: s.since,
      files: new Set(s.pages.map((p) => p.file)).size,
      pages: s.pages.length,
      readers: s.readers,
      done,
      entries,
      ...(s.pages[0]?.name ? { name: s.pages[0].name } : {}),
      ...(s.persons?.[0] ? { person: s.persons[0] } : {}),
      from: app ? "app" : "research",
    };
  }
}

/** /status reads: those at work, and those ended in the last week. */
export function statusReads(seen: ReadingsSeen, now = Date.now()): AppRead[] {
  return seen
    .all()
    .map((r) => r.read)
    .filter((r) => !FINAL_STATES.includes(r.state) || Date.parse(r.since) > now - STATUS_DAYS * DAY_MS);
}

/**
 * GET /reads: the last 90 days, and every reading no source of the research is of. inSource: a source of this tree —
 * the only one a reading can be of (its input, state and result are the tree's; the sync takes no other's) — and not
 * retracted (a sync undone, a source merged away): the reading is then to be come back to again.
 */
export function listedReads(tree: Tree, seen: ReadingsSeen, now = Date.now()): AppRead[] {
  const inSources = new Set(tree.list<Source>("source").flatMap((s) => (!s.retracted && typeof s.reading === "string" ? [s.reading] : [])));
  return seen
    .all()
    .map((r) => ({ ...r.read, inSource: inSources.has(r.read.id) }))
    .filter((r) => !r.inSource || Date.parse(r.at) > now - LIST_DAYS * DAY_MS);
}

/** What the readings the app asked this month cost (they run in no session of the agent). */
export function appReadSpend(root: string, month: string): { count: number; amount: number } {
  let count = 0;
  let usd = 0;
  const dir = readsDir(root);
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const id = f.endsWith(".json") ? f.slice(0, -5) : "";
    if (!READ_ID.test(id)) continue;
    const s = loadState(root, id);
    if (!s || s.from !== APP_READ_FROM || s.at.slice(0, 7) !== month) continue;
    // read: a reader began (one cancelled while queued read nothing)
    if (s.reports.length) count++;
    usd += s.reports.reduce((n, r) => n + (r.usd ?? 0), 0);
  }
  return { count, amount: Math.round(usd * 100) / 100 };
}

// ── whether a reading can start here ────────────────────────────────────────────────────────────────────────────

export interface ReadAccepts {
  ready: boolean;
  why: string | null;
  /** why limit: when the agent says its limit resets. */
  resets?: string;
  readers: 2;
  types: string[];
  max: number;
  pages: number;
  langs: string[];
}

/**
 * What the app may ask to be read (accepts.read): none in an archive or a research waiting for its agent (it says
 * nothing of an agent); else whether a reader can start now, and why not — a machine's code the app says in its words.
 */
export function readAccepts(tree: Tree, settings: Settings, env: Env, seen?: ReadingsSeen, now = Date.now()): ReadAccepts | undefined {
  if (actsAsArchive(tree)) return undefined;
  const not = notReady(tree, settings, env, seen, now);
  return {
    ready: !not,
    why: not?.why ?? null,
    ...(not?.resets ? { resets: not.resets } : {}),
    readers: 2,
    types: readableTypes(env),
    max: READ_MAX_BYTES,
    pages: DOC_PAGES,
    langs: readLangs(),
  };
}

function notReady(tree: Tree, settings: Settings, env: Env, seen: ReadingsSeen | undefined, now: number): { why: string; resets?: string } | undefined {
  // started inside a sandbox no agent starts from (a bridge an agent of Codex started)
  if (sandboxOf(env)) return { why: "agent.sandbox" };
  if (!settings.shared()?.value) return { why: "shared.none" };
  const agent = settings.agent(tree.config).value;
  // (the agents' table of core, not the runners': a runner's module reaches the bridge, and so would come round to itself)
  const known = AGENTS.find((a) => a.id === agent);
  if (agent !== "script" && (!known || !which(known.command, env))) return { why: "agent.none" };
  if (!READ_TESTED.includes(agent)) return { why: "agent.untested" };
  // the last reading that ended: its agent out of its limit, or not signed in — until another reads
  const last = (seen ?? new ReadingsSeen(tree.root, env)).all().find((r) => r.state && FINAL_STATES.includes(r.state.state))?.state;
  if (last?.state === "failed") {
    const outcomes = last.reports.filter((r) => r.version === last.version).map((r) => r.outcome);
    const ended = Date.parse(last.since);
    if (outcomes.includes("limit")) {
      const resets = last.reports.map((r) => r.resets).find((r): r is string => !!r && Date.parse(r) > 0);
      if (resets ? Date.parse(resets) > now : ended + LIMIT_MS > now) return { why: "limit", ...(resets ? { resets } : {}) };
    } else if (outcomes.includes("auth") && ended + AUTH_MS > now) return { why: "auth" };
  }
  return undefined;
}

// ── the routes ──────────────────────────────────────────────────────────────────────────────────────────────────

/** What the bridge gives the readings (live.ts). */
export interface ReadBridge {
  root: string;
  env: Env;
  settings(): Settings;
  note(text: string): void;
  safely(req: http.IncomingMessage, res: http.ServerResponse, fn: () => void): void;
}

type Refusal = ReturnType<typeof refusal>;
const BODY_MAX = 16 * 1024;
/** The names of files sent to be read kept until they are asked (the last ones). */
const NAMES_KEPT = 200;

/**
 * The readings of the app: POST /read, /read/<id>/again, /read/<id>/cancel; GET /read/<id>, /read/<id>/page/<n>.jpg,
 * /reads; the queue read one at a time (tick, each tick of the bridge); what changed, for the event read.
 */
export class AppReadings {
  readonly seen: ReadingsSeen;
  /** Asked, its strom still queuing it (counted against the limits and the queue meanwhile). */
  private pending = 0;
  /** The strom started to read a queued one: when, how many times. */
  private readonly starting = new Map<string, { at: number; tries: number }>();
  private readonly told = new Map<string, string>();
  private primed = false;
  /** The name each file to read came under (X-Strom-Name of its last PUT): a file the research had already keeps its own. */
  private readonly names = new Map<string, string>();

  private readonly b: ReadBridge;
  constructor(b: ReadBridge) {
    this.b = b;
    this.seen = new ReadingsSeen(b.root, b.env);
  }

  /** A file sent to be read (PUT /media with X-Strom-Read) under its name in the app: the reading of it shown so (sent with no name: its record's own). */
  named(sha: string, name: string | undefined): void {
    this.names.delete(sha);
    // cleaned as strom document read --name cleans it: nothing left (only slashes, control characters) = no name
    const shown = name && shownName(name);
    if (shown) this.names.set(sha, shown);
    for (const old of this.names.keys()) {
      if (this.names.size <= NAMES_KEPT) break;
      this.names.delete(old);
    }
  }

  /** A reading of the app at work or queued (the bridge does not end idle meanwhile). */
  active(): boolean {
    return this.pending > 0 || this.appStates().some((s) => !FINAL_STATES.includes(s.state));
  }

  private appStates(): ReadState[] {
    return this.seen
      .all()
      .map((r) => r.state)
      .filter((s): s is ReadState => !!s && s.from === APP_READ_FROM);
  }

  answer(req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, what: string, sub: string | undefined, act: string | undefined, rest: string | undefined): boolean {
    const id = sub ?? "";
    if (req.method === "POST" && what === "read" && !sub) this.post(req, res, origin, (body, tree) => this.asked(tree, body));
    else if (req.method === "POST" && what === "read" && act === "again" && !rest) this.post(req, res, origin, (body, tree) => this.again(tree, id, body));
    else if (req.method === "POST" && what === "read" && act === "cancel" && !rest) this.post(req, res, origin, (_body, tree) => this.cancel(tree, id), true);
    else if (req.method === "GET" && what === "read" && sub && !act) this.result(res, id);
    else if (req.method === "GET" && what === "read" && act === "page" && rest) this.page(res, id, rest);
    else if (req.method === "GET" && what === "reads" && !sub) this.list(res);
    else return false;
    return true;
  }

  // ── reading ──

  private json(res: http.ServerResponse, code: number, body: unknown): void {
    if (res.headersSent) return;
    const retry = code === 429 || code === 503 ? (body as { retry?: number }).retry : undefined;
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
  }

  private none(id: string): { code: number; body: Refusal } {
    return { code: 404, body: refusal(`no reading ${id.slice(0, 40)} of the Strom app here`, "read.none", { id: id.slice(0, 40) }) };
  }

  private open(id: string): { tree: Tree; result: ReadResult } | undefined {
    if (!READ_ID.test(id)) return undefined;
    const tree = Tree.open(this.b.root, this.b.env);
    if (actsAsArchive(tree)) return undefined;
    const s = loadState(this.b.root, id);
    if (s) return { tree, result: buildResult(tree, shown(s)) };
    try {
      const r = JSON.parse(fs.readFileSync(resultPath(this.b.root, id), "utf8")) as ReadResult;
      return r.id === id ? { tree, result: r } : undefined;
    } catch {
      return undefined;
    }
  }

  /** GET /read/<id>: its result, or what its readers wrote so far; each page's picture for the app. */
  private result(res: http.ServerResponse, id: string): void {
    const got = this.open(id);
    if (!got) {
      const n = this.none(id);
      return this.json(res, n.code, n.body);
    }
    this.json(res, 200, { ...got.result, pages: got.result.pages.map((p) => ({ ...p, image: `read/${id}/page/${p.n}.jpg` })) });
  }

  /** GET /read/<id>/page/<n>.jpg: the page upright as a JPEG of 2000 px at most (a HEIC's, a PDF's page too). */
  private page(res: http.ServerResponse, id: string, rest: string): void {
    const m = /^(\d{1,3})\.jpg$/u.exec(rest);
    const got = this.open(id);
    const p = m && got ? got.result.pages.find((x) => x.n === Number(m[1])) : undefined;
    if (!got || !p) {
      const n = got ? { code: 404, body: refusal(`no page ${rest.slice(0, 20)} of ${id}`, "read.no-page", { id, page: rest.slice(0, 20) }) } : this.none(id);
      return this.json(res, n.code, n.body);
    }
    const file = this.fileOf(got.tree, p.file);
    if (!file || !fs.existsSync(file)) return this.json(res, 410, refusal("the file of that page is not on this computer", "read.page-gone", { id, page: String(p.n) }));
    const view = makeView(got.tree, file, p.file, { max: PAGE_PX, ...(p.page > 1 ? { page: p.page } : {}) }, { kind: "whole" });
    const size = fs.statSync(view.file).size;
    res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": String(size), "Cache-Control": "no-store" });
    fs.createReadStream(view.file)
      .on("error", () => res.destroy())
      .pipe(res);
  }

  private fileOf(tree: Tree, record: string): string | undefined {
    const shared = this.b.settings().shared()?.value;
    if (record.startsWith("M")) {
      const m = tree.get<Media>(record);
      return m && shared ? path.join(shared, m.file) : undefined;
    }
    const i = tree.get<Input>(record);
    return i ? inputPath(tree, i) : undefined;
  }

  /** GET /reads: the readings of the last 90 days and those no source is of yet, newest first. */
  private list(res: http.ServerResponse): void {
    const tree = Tree.open(this.b.root, this.b.env);
    if (actsAsArchive(tree)) return this.json(res, 404, refusal("this research reads no documents", "read.none"));
    this.json(res, 200, { reads: listedReads(tree, this.seen) });
  }

  // ── asking ──

  /**
   * A POST: from the app's pages alone, a research no newer strom wrote, no archive; its body a JSON object; then what
   * `ask` says — a command to run as the person's (its --json data made the answer), or the answer itself.
   */
  private post(req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, ask: (body: Record<string, unknown>, tree: Tree) => Ask, anyState = false): void {
    if (!origin) {
      req.resume();
      return this.json(res, 403, refusal("only the Strom app may ask for a reading", "app.only"));
    }
    let text = "";
    let over = false;
    req.on("data", (c: Buffer) => {
      if (text.length + c.length > BODY_MAX) over = true;
      else text += c.toString("utf8");
    });
    req.on("end", () =>
      this.b.safely(req, res, () => {
        const newer = newerTree(this.b.root, this.b.env);
        if (newer) return this.json(res, 423, { ...refusal(newer.message, "locked"), reasonCode: newer.code, ...(newer.params ? { reasonParams: newer.params } : {}) });
        const tree = Tree.open(this.b.root, this.b.env);
        if (actsAsArchive(tree)) return this.json(res, 404, refusal("this research reads no documents", "read.none"));
        if (!anyState) {
          const accepts = readAccepts(tree, this.b.settings(), this.b.env, this.seen);
          if (accepts && !accepts.ready) return this.json(res, 503, { ...refusal(`no reader can start now (${accepts.why})`, "read.not-ready", { why: String(accepts.why) }), ...(accepts.resets ? { resets: accepts.resets } : {}), retry: 60 });
        }
        let body: Record<string, unknown> = {};
        try {
          const parsed: unknown = text.trim() ? JSON.parse(text) : {};
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
          body = parsed as Record<string, unknown>;
        } catch {
          over = true;
        }
        if (over) return this.json(res, 400, refusal(`the body: a JSON object of at most ${BODY_MAX / 1024} KB`, "read.bad-body"));
        const asked = ask(body, tree);
        if ("code" in asked) return this.json(res, asked.code, asked.body);
        this.run(asked, (code, out) => this.json(res, code, out));
      }),
    );
  }

  /** The queue full, a limit reached: refused (429 read.limit, with when to ask again). */
  private limited(): { code: number; body: Record<string, unknown> } | undefined {
    const waiting = this.appStates().filter((s) => !FINAL_STATES.includes(s.state)).length + this.pending;
    if (waiting >= 1 + READ_QUEUE_MAX) return { code: 429, body: { ...refusal(`${READ_QUEUE_MAX} readings wait already beside the one being read`, "read.limit", { per: "queue" }), retry: 60 } };
    const limits = appReadLimits(this.b.settings().readApp());
    const reached = limitReached(this.b.root, limits, this.pending);
    if (reached) return { code: 429, body: { ...refusal(`the Strom app asked ${reached.per === "hour" ? `${limits.hour} readings this hour` : `${limits.day} readings today`} (read.app)`, "read.limit", { per: reached.per, most: String(reached.per === "hour" ? limits.hour : limits.day) }), retry: reached.retry } };
    return undefined;
  }

  /** POST /read {files, readers, lang, person, note, region}: checked, queued as the person's. */
  private asked(tree: Tree, body: Record<string, unknown>): Ask {
    const bad = (why: string): Ask => ({ code: 400, body: refusal(`the body: ${why}`, "read.bad-body") });
    const files = body.files;
    if (!Array.isArray(files) || !files.length || !files.every((f) => typeof f === "string" && /^[0-9a-fA-F]{64}$/u.test(f))) return bad(`"files": the SHA-256 of each page's file, in order`);
    if (files.length > DOC_PAGES) return { code: 413, body: refusal(`at most ${DOC_PAGES} pages are read at once`, "read.pages", { pages: String(DOC_PAGES) }) };
    const readers = body.readers === undefined ? 1 : body.readers;
    if (readers !== 1 && readers !== 2) return bad(`"readers": 1 or 2`);
    const langs = readLangs();
    const lang = body.lang === undefined ? tree.lang : body.lang;
    if (typeof lang !== "string" || !langs.includes(lang)) return { code: 400, body: refusal(`"lang": one of ${langs.join(", ")}`, "read.lang", { lang: String(lang).slice(0, 12) }) };
    let person: string | undefined;
    if (body.person !== undefined && body.person !== null) {
      if (typeof body.person !== "string" || !/^[Pp]\d{1,9}$/u.test(body.person)) return bad(`"person": a person of the research, P…`);
      person = normId(body.person, "person");
      const p = tree.get<Person>(person);
      if (!p || p.type !== "person" || p.retracted) return { code: 404, body: refusal(`no person ${person} in this research`, "read.no-person", { person }) };
    }
    if (body.note !== undefined && body.note !== null && typeof body.note !== "string") return bad(`"note": text`);
    const note = typeof body.note === "string" ? body.note.replace(/[\p{Cc}]/gu, " ").trim().slice(0, 500) : "";
    let region: string | undefined;
    if (body.region !== undefined && body.region !== null) {
      const r = Array.isArray(body.region) && body.region.length === 4 && body.region.every((x) => typeof x === "number") ? parseRegion(body.region.join(",")) : undefined;
      if (!r || files.length > 1) return { code: 400, body: refusal(`"region": [x, y, w, h], fractions of the page from its top left — for a document of one file`, "read.region") };
      region = r.join(",");
    }
    const shared = this.b.settings().shared()?.value;
    const records: string[] = [];
    // each file under the name the app sent it with last, else its record's own (never its hash)
    const names: string[] = [];
    const types = readableTypes(this.b.env);
    for (const f of files as string[]) {
      const sha = f.toLowerCase();
      const known = knownOriginal(tree, shared, sha);
      if (!known) return { code: 404, body: refusal(`the research has no file ${sha} (PUT /media/${sha} first)`, "read.no-file", { sha }) };
      if (!known.file || !fs.existsSync(known.file)) return { code: 410, body: refusal(`the file ${sha} is not on this computer`, "read.no-file", { sha }) };
      if (!types.includes(known.mime)) return { code: 415, body: refusal(`a reader reads no ${known.mime} here`, "read.type", { sha, mime: known.mime }) };
      if (known.bytes > READ_MAX_BYTES) return { code: 413, body: refusal(`larger than a reading takes (${READ_MAX_BYTES / 1024 / 1024} MB)`, "read.large", { sha, mb: String(READ_MAX_BYTES / 1024 / 1024) }) };
      records.push(known.id);
      const name = this.names.get(sha);
      if (name) names.push(`--name=${records.length}:${name}`);
    }
    const limited = this.limited();
    if (limited) return limited;
    return {
      what: "a reading",
      args: ["document", "read", ...records, "--queue", "--readers", String(readers), "--into", lang, ...(person ? ["--person", person] : []), ...(note ? [`--note=${note}`] : []), ...(region ? [`--region=${region}`] : []), ...names],
      asked: "read",
    };
  }

  /** POST /read/<id>/again {readers}: the app's reading read again (after one reader: the blind second alone). */
  private again(_tree: Tree, id: string, body: Record<string, unknown>): Ask {
    const s = READ_ID.test(id) ? loadState(this.b.root, id) : undefined;
    if (!s || s.from !== APP_READ_FROM) return this.none(id);
    if (!FINAL_STATES.includes(shown(s).state)) return { code: 409, body: refusal(`${id} is being read now`, "read.busy", { id }) };
    const readers = body.readers === undefined ? s.readers : body.readers;
    if (readers !== 1 && readers !== 2) return { code: 400, body: refusal(`the body: "readers": 1 or 2`, "read.bad-body") };
    const limited = this.limited();
    if (limited) return limited;
    return { what: `${id} again`, args: ["document", "again", id, "--queue", "--readers", String(readers)], asked: "again" };
  }

  /** POST /read/<id>/cancel: its readers stopped (what they wrote stays), or a queued one cancelled. */
  private cancel(_tree: Tree, id: string): Ask {
    const s = READ_ID.test(id) ? loadState(this.b.root, id) : undefined;
    if (!s || s.from !== APP_READ_FROM) return this.none(id);
    return { what: `${id} cancelled`, args: ["document", "cancel", id] };
  }

  /** The command run as the person's (forApp), its --json said as the answer. */
  private run(asked: Command, reply: (code: number, body: Record<string, unknown>) => void): void {
    const { command, args } = stromLauncher();
    if (asked.asked) this.pending++;
    let counted = !!asked.asked;
    const uncount = () => {
      if (counted) this.pending--;
      counted = false;
    };
    const child: ChildProcess = spawn(command, [...args, ...asked.args, "--json"], { cwd: this.b.root, env: forApp(this.b.env, this.b.root), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let out = "";
    let err = "";
    child.stdout!.on("data", (d: Buffer) => (out += d.toString("utf8")));
    child.stderr!.on("data", (d: Buffer) => (err += d.toString("utf8")));
    child.on("error", (e) => {
      uncount();
      reply(500, refusal(e.message, "read.failed"));
    });
    child.on("close", (code) => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(out) as Record<string, unknown>;
      } catch {
        // said by the exit code
      }
      if (code === 0) {
        const id = String(data.id ?? "");
        try {
          if (asked.asked && READ_ID.test(id)) noteAsked(this.b.root, id, asked.asked);
        } finally {
          uncount();
        }
        if (asked.asked) {
          this.b.note(`${asked.what} queued: ${id}${data.version && Number(data.version) > 1 ? ` (version ${String(data.version)})` : ""}`);
          reply(202, { read: id, state: String(data.state ?? "queued"), version: Number(data.version ?? 1) });
          this.dispatch();
        } else reply(200, { read: String(data.id ?? ""), state: String(data.state ?? ""), cancelled: data.cancelled === true });
        return;
      }
      uncount();
      const why = String(data.message ?? err.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? `exit ${code}`);
      this.b.note(`${asked.what} not asked (exit ${code}): ${why}`);
      if (code === EXIT.locked) return reply(503, { ...refusal(why, "research.busy"), retry: 5 });
      const said = typeof data.code === "string" ? data.code : "";
      const params = data.params && typeof data.params === "object" ? Object.fromEntries(Object.entries(data.params as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : {};
      // what the reading cannot read (a type, a PDF no system here draws, a HEIC not converted), too many pages
      if (/^read\.(type|pdf-render|heic|convert|page)/u.test(said)) return reply(415, refusal(why, said, params));
      if (said === "read.pages") return reply(413, refusal(why, said, params));
      reply(500, { ...refusal(why, "read.failed"), ...(said ? { reasonCode: said } : {}) });
    });
  }

  // ── the queue ──

  /**
   * Each tick of the bridge: no reading of the app at work, the oldest queued one read — by a strom of its own detached
   * from the bridge (it outlives a bridge started again). One whose strom did not begin is started again, three times
   * at most, then failed. What changed since the last tick: for the event read.
   */
  tick(): AppRead[] {
    const all = this.dispatch();
    const changed: AppRead[] = [];
    for (const { read } of all) {
      const key = JSON.stringify(read);
      if (this.told.get(read.id) === key) continue;
      this.told.set(read.id, key);
      // as they were when this bridge began: in its first /status already, never said again
      if (this.primed) changed.push(read);
    }
    this.primed = true;
    return changed;
  }

  /** No reading of the app at work: the oldest queued one read. The readings as they are now. */
  dispatch(): { read: AppRead; state?: ReadState }[] {
    const all = this.seen.all();
    const app = all.map((r) => r.state).filter((s): s is ReadState => !!s && s.from === APP_READ_FROM);
    const now = Date.now();
    for (const [id, st] of this.starting) if (!app.some((s) => s.id === id && s.state === "queued" && !s.pid) && now - st.at > START_WAIT_MS) this.starting.delete(id);
    const atWork = app.some((s) => !FINAL_STATES.includes(s.state) && (s.pid ? alive(s.pid) : this.startedLately(s.id, now)));
    if (!atWork) {
      const next = app.filter((s) => s.state === "queued" && !s.pid).sort((a, b) => a.since.localeCompare(b.since) || a.id.localeCompare(b.id))[0];
      if (next) this.start(next, now);
    }
    return all;
  }

  private startedLately(id: string, now: number): boolean {
    const st = this.starting.get(id);
    return !!st && now - st.at < START_WAIT_MS;
  }

  private start(s: ReadState, now: number): void {
    const was = this.starting.get(s.id);
    if (was && now - was.at < START_WAIT_MS) return;
    const tries = (was?.tries ?? 0) + 1;
    if (tries > START_TRIES) {
      // never begun: failed, said why (the bridge reads the next)
      saveState(this.b.root, { ...s, state: "failed", since: new Date().toISOString(), error: "its reader could not start" });
      this.starting.delete(s.id);
      this.b.note(`${s.id}: its reader did not start (${START_TRIES} tries): failed`);
      return;
    }
    this.starting.set(s.id, { at: now, tries });
    const { command, args } = stromLauncher();
    const child = spawn(command, [...args, "document", "read", s.id, "--json"], { cwd: this.b.root, env: forApp(this.b.env, this.b.root), stdio: "ignore", detached: true, windowsHide: true });
    child.on("error", (e) => this.b.note(`${s.id}: its reader not started: ${e.message}`));
    child.unref();
    this.b.note(`${s.id}: read now${tries > 1 ? ` (try ${tries})` : ""}`);
  }
}

interface Command {
  what: string;
  args: string[];
  /** A new reading, one again: counted against the limits. */
  asked?: "read" | "again";
}
type Ask = Command | { code: number; body: Record<string, unknown> };
