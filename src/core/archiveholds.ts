// Holds of a restricted archive (spec 127, K2): on a site whose terms (or the person's permission) want a person's pace
// or a person's browser, or whose connector has an hourly cap, one session at a time works on this computer — whichever
// research it is of. A hold says WHO uses the site; the limiter (core/net.ts) still says HOW FAST. A hold never adds a
// request, never raises a pace or a cap: it only keeps a second session off the site while the first works there.
//
// <shared>/net/holds/<site>.json   the hold: the task hold's fields (core/holds.ts) and the tree and the site
// <shared>/net/holds/<site>.lock   a short lock while it is read and written (taken after the tree's, never before it)
// <shared>/net/holds/<site>.wait/  the queue: <tree-hash>-<pid>.json {since} of each one waiting for the site
// <shared>/net/holds/<site>.free   when it was let go last: the oldest waiting has PRIORITY_MS to take it
// <shared>/net/holds/bulk.json     the one bulk download of this computer (strom fetch of images on a restricted site)
//
// A hold lapses when its session ends or its holder's process here is gone, or after archive.hold with no request of
// its holder to the site (its beat: each request). Refusals of the archive (401/403/429) are no hold: the limiter's own.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { Env } from "./paths.ts";
import { acquireLock, machineId, processAlive } from "./lock.ts";
import { writeFileAtomic } from "./json.ts";
import { webDomain } from "./metrics.ts";
import { BEAT_MS, holdAlive, lastSign, readHold } from "./holds.ts";
import { Settings } from "./config.ts";
import { VERSION } from "./tree.ts";
import { allows, archiveLevel, connectorLevels, type ArchiveLevel } from "./terms.ts";
import { listConnectors, type Connector, type ConnectorManifest } from "./connector.ts";
import { clock, hostAllowed } from "./net.ts";
import { taskRecordsets } from "./frontier.ts";
import { setHosts } from "./archivewait.ts";
import type { Task } from "./model.ts";
import type { Tree } from "./tree.ts";

/** After a site is let go, the oldest one waiting for it has this long to take it before anybody else. */
export const PRIORITY_MS = 2 * 60_000;
/** One waiting whose entry was not touched for this long (it polls far more often) no longer waits. */
export const WAITER_STALE_MS = 5 * 60_000;
/** The key of the one bulk download of this computer. */
export const BULK = "bulk";

export type HolderKind = "run" | "chat" | "agent" | "fetch";

export interface SiteHold {
  site: string;
  /** The research's folder. */
  tree: string;
  research?: string;
  session?: string;
  task?: string;
  by: HolderKind;
  worker?: string;
  agent?: string;
  agentSession?: string;
  pid?: number;
  host?: string;
  machine?: string;
  since: string;
  beat: string;
  seq: number;
  version: string;
}

/** Who takes a site: a session of a research (it holds it while it lives), else a process (strom fetch without one). */
export interface Holder {
  tree: string;
  session?: string;
  task?: string;
  research?: string;
  by: HolderKind;
  worker?: string;
  agent?: string;
  agentSession?: string;
  /** The process holding it: a fetch's, a run's; none for an agent working directly (its commands and hooks beat). */
  pid?: number;
}

export interface SiteLife {
  alive: boolean;
  reason?: "dead" | "expired";
  since: number;
  lastSign: number;
  /** When it lapses with no further request. */
  until: number;
}

export interface Waiter {
  site: string;
  tree: string;
  pid: number;
  since: string;
  by: HolderKind;
  session?: string;
  host?: string;
  machine?: string;
  key: string;
}

export type SiteClaim =
  | { ok: true; hold: SiteHold; fresh: boolean }
  | { ok: false; hold: SiteHold; life: SiteLife }
  | { ok: false; hold?: undefined; waiter: Waiter; until: number };

const LOCK_WAIT_MS = 3000;

export function holdsDir(shared: string): string {
  return path.join(shared, "net", "holds");
}

function safe(site: string): string {
  return site.replace(/[^a-z0-9.-]/gi, "_");
}

const holdFile = (shared: string, site: string) => path.join(holdsDir(shared), `${safe(site)}.json`);
const lockFile = (shared: string, site: string) => path.join(holdsDir(shared), `${safe(site)}.lock`);
const waitDir = (shared: string, site: string) => path.join(holdsDir(shared), `${safe(site)}.wait`);
const freeFile = (shared: string, site: string) => path.join(holdsDir(shared), `${safe(site)}.free`);

export function archiveHoldMs(env: Env): number {
  return new Settings(env, {}).holdMinutes("archive.hold") * 60_000;
}

export function archiveWaitMs(env: Env): number {
  return new Settings(env, {}).holdMinutes("archive.wait") * 60_000;
}

function taskHoldMs(env: Env): number {
  return new Settings(env, {}).holdMinutes("task.hold") * 60_000;
}

// ── restricted ───────────────────────────────────────────────────────────

/**
 * An archive's level that makes its site restricted (spec 127 K2.1): its terms want a person's pace or a person's
 * browser (allows(…).human, browserOnly), or the person gave a permission "slowly" or "through the browser". An archive
 * closed to tools (forbidden, refused) takes no request at all: nothing to hold.
 */
export function restrictedLevel(a: Pick<ArchiveLevel, "level" | "permission" | "browserOnly" | "refused">): boolean {
  if (a.level === "forbidden" || a.refused) return false;
  if (a.browserOnly) return true;
  if (a.permission === "slow" || a.permission === "browser") return true;
  const direct = allows(a, "images", "direct");
  const browser = allows(a, "images", "browser");
  return (direct.ok && direct.human) || (browser.ok && browser.human);
}

/** A connector whose service has an hourly cap: its sites are restricted whatever their terms. */
export function cappedConnector(m: Pick<ConnectorManifest, "policy">): boolean {
  const n = m.policy?.pace?.perHour;
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** The site a host is held by (the limiter's site~<site>.json key). */
export function siteOf(host: string): string {
  return webDomain(host);
}

// ── holds ────────────────────────────────────────────────────────────────

function here(h: { host?: string; machine?: string }): boolean {
  return h.host === os.hostname() || (h.machine !== undefined && h.machine === machineId());
}

export function readSiteHold(shared: string, site: string): { hold: SiteHold; mtimeMs: number } | undefined {
  const file = holdFile(shared, site);
  try {
    const hold = JSON.parse(fs.readFileSync(file, "utf8")) as SiteHold;
    if (!hold || typeof hold !== "object" || typeof hold.beat !== "string" || typeof hold.tree !== "string") return undefined;
    return { hold, mtimeMs: fs.statSync(file).mtimeMs };
  } catch {
    return undefined;
  }
}

/**
 * Does a site's hold still hold? Its process here gone, or its session no longer held (closed, taken over, lapsed —
 * core/holds.ts): no, at once. Otherwise while its last request is younger than archive.hold.
 */
export function siteLife(h: SiteHold, env: Env, now = Date.now(), mtimeMs?: number): SiteLife {
  const ms = archiveHoldMs(env);
  const last = lastSign(h, now, mtimeMs);
  const since = Number.isFinite(Date.parse(h.since)) ? Date.parse(h.since) : last;
  const base = { since, lastSign: last, until: last + ms };
  if (here(h)) {
    if (h.pid !== undefined && !processAlive(h.pid)) return { ...base, alive: false, reason: "dead" };
    if (h.session) {
      const t = readHold(h.tree, h.session);
      if (!t || !holdAlive(t.hold, now, taskHoldMs(env), t.mtimeMs)) return { ...base, alive: false, reason: "dead" };
    }
  }
  if (now - last >= ms) return { ...base, alive: false, reason: "expired" };
  return { ...base, alive: true };
}

/** The same holder: the same research's session, else the same process, else the same agent working directly. */
export function sameHolder(h: Pick<SiteHold, "tree" | "session" | "pid" | "agentSession" | "host" | "machine">, who: Holder): boolean {
  if (path.resolve(h.tree) !== path.resolve(who.tree) || !here(h)) return false;
  if (who.session || h.session) return h.session === who.session;
  if (who.pid !== undefined || h.pid !== undefined) return h.pid === who.pid;
  return !!who.agentSession && h.agentSession === who.agentSession;
}

function treeHash(tree: string): string {
  return crypto.createHash("sha256").update(path.resolve(tree)).digest("hex").slice(0, 12);
}

function waiterKey(tree: string, pid: number): string {
  return `${treeHash(tree)}-${pid}`;
}

function withSiteLock<T>(shared: string, site: string, fn: () => T): T {
  const release = acquireLock(lockFile(shared, site), { owner: `hold ${site}`, waitMs: LOCK_WAIT_MS, staleMs: 60_000, maxAgeMs: 10 * 60_000, version: VERSION, machine: true });
  try {
    return fn();
  } finally {
    release();
  }
}

function freeAt(shared: string, site: string): number | undefined {
  try {
    const t = Date.parse(fs.readFileSync(freeFile(shared, site), "utf8").trim());
    return Number.isFinite(t) ? t : undefined;
  } catch {
    return undefined;
  }
}

function markFree(shared: string, site: string, now: number): void {
  try {
    writeFileAtomic(freeFile(shared, site), new Date(now).toISOString() + "\n");
  } catch {
    // (only the priority of the one waiting depends on it: without it, it lasts as long as that one waits)
  }
}

/**
 * Those waiting for a site, the longest waiting first. An entry whose process here is gone, or not touched for
 * WAITER_STALE_MS (one waiting touches it each time it looks), no longer waits — removed.
 */
export function waiters(shared: string, site: string, now = Date.now()): Waiter[] {
  const dir = waitDir(shared, site);
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: Waiter[] = [];
  for (const f of names) {
    const file = path.join(dir, f);
    try {
      const w = JSON.parse(fs.readFileSync(file, "utf8")) as Omit<Waiter, "key">;
      const stale = now - fs.statSync(file).mtimeMs >= WAITER_STALE_MS;
      if (stale || (here(w) && !processAlive(w.pid))) {
        fs.rmSync(file, { force: true });
        continue;
      }
      out.push({ ...w, key: f.slice(0, -5) });
    } catch {
      // (one being written, or broken: not counted)
    }
  }
  return out.sort((a, b) => Date.parse(a.since) - Date.parse(b.since) || a.key.localeCompare(b.key));
}

/** Wait for a site: in its queue (from the first time; each time after only touched — it still waits). */
export function joinQueue(shared: string, site: string, who: Holder, pid = process.pid): Waiter {
  const dir = waitDir(shared, site);
  const key = waiterKey(who.tree, pid);
  const file = path.join(dir, `${key}.json`);
  try {
    const w = JSON.parse(fs.readFileSync(file, "utf8")) as Omit<Waiter, "key">;
    const t = new Date();
    fs.utimesSync(file, t, t);
    return { ...w, key };
  } catch {
    const machine = machineId();
    const w: Omit<Waiter, "key"> = { site, tree: path.resolve(who.tree), pid, since: new Date().toISOString(), by: who.by, ...(who.session ? { session: who.session } : {}), host: os.hostname(), ...(machine ? { machine } : {}) };
    fs.mkdirSync(dir, { recursive: true });
    writeFileAtomic(file, JSON.stringify(w) + "\n");
    return { ...w, key };
  }
}

export function leaveQueue(shared: string, site: string, tree: string, pid = process.pid): void {
  fs.rmSync(path.join(waitDir(shared, site), `${waiterKey(tree, pid)}.json`), { force: true });
}

/**
 * Whether `who` may take a free site now: nobody waits, or it is the one waiting longest, or the longest waiting let
 * PRIORITY_MS pass since the site was let go without taking it. Else the one waiting that goes first, and until when.
 */
function priority(shared: string, site: string, who: Holder, pid: number, now: number): { waiter: Waiter; until: number } | undefined {
  const first = waiters(shared, site, now)[0];
  if (!first || first.key === waiterKey(who.tree, pid)) return undefined;
  const at = freeAt(shared, site) ?? now;
  return now - at < PRIORITY_MS ? { waiter: first, until: at + PRIORITY_MS } : undefined;
}

/**
 * Whether a site would be `who`'s now (nothing written): free, or its own hold, and nobody waiting before it. A hold
 * that lapsed counts as free (taken over by the one that takes it).
 */
export function siteFor(shared: string, site: string, who: Holder, env: Env, now = Date.now(), pid = who.pid ?? process.pid): SiteClaim {
  const cur = readSiteHold(shared, site);
  if (cur) {
    const life = siteLife(cur.hold, env, now, cur.mtimeMs);
    if (life.alive) return sameHolder(cur.hold, who) ? { ok: true, hold: cur.hold, fresh: false } : { ok: false, hold: cur.hold, life };
  }
  const first = priority(shared, site, who, pid, now);
  if (first) return { ok: false, waiter: first.waiter, until: first.until };
  return { ok: true, hold: newSiteHold(site, who, now), fresh: true };
}

function newSiteHold(site: string, who: Holder, now: number): SiteHold {
  const t = new Date(now).toISOString();
  const machine = machineId();
  return {
    site,
    tree: path.resolve(who.tree),
    ...(who.research ? { research: who.research } : {}),
    ...(who.session ? { session: who.session } : {}),
    ...(who.task ? { task: who.task } : {}),
    by: who.by,
    ...(who.worker ? { worker: who.worker } : {}),
    ...(who.agent ? { agent: who.agent } : {}),
    ...(who.agentSession ? { agentSession: who.agentSession } : {}),
    ...(who.pid !== undefined ? { pid: who.pid } : {}),
    host: os.hostname(),
    ...(machine ? { machine } : {}),
    since: t,
    beat: t,
    seq: 1,
    version: VERSION,
  };
}

/**
 * Take a site for `who` (or beat its own hold: a request to it — at most once a minute written): under the site's short
 * lock, never waiting for anything else while it is held. A hold that lapsed is let go first. Held by another, or
 * another waiting before it: not taken, and who holds it or waits first said. Taken: its own entry in the queue goes.
 */
export function claimSite(shared: string, site: string, who: Holder, env: Env, o: { now?: number; pid?: number } = {}): SiteClaim {
  const pid = o.pid ?? who.pid ?? process.pid;
  // its own hold beaten less than a minute ago: nothing to write, no lock
  const now0 = o.now ?? Date.now();
  const quick = readSiteHold(shared, site);
  if (quick && sameHolder(quick.hold, who) && now0 - lastSign(quick.hold, now0, quick.mtimeMs) < BEAT_MS && siteLife(quick.hold, env, now0, quick.mtimeMs).alive) return { ok: true, hold: quick.hold, fresh: false };
  fs.mkdirSync(holdsDir(shared), { recursive: true });
  return withSiteLock(shared, site, () => {
    const now = o.now ?? Date.now();
    const cur = readSiteHold(shared, site);
    if (cur) {
      const life = siteLife(cur.hold, env, now, cur.mtimeMs);
      if (life.alive) {
        if (!sameHolder(cur.hold, who)) return { ok: false, hold: cur.hold, life };
        const hold: SiteHold = { ...cur.hold, beat: new Date(now).toISOString(), seq: (cur.hold.seq ?? 0) + 1, ...(who.task && !cur.hold.task ? { task: who.task } : {}) };
        writeFileAtomic(holdFile(shared, site), JSON.stringify(hold, null, 2) + "\n");
        leaveQueue(shared, site, who.tree, pid);
        return { ok: true, hold, fresh: false };
      }
      // lapsed: let go now (the time it was let go starts the priority of the one waiting longest)
      fs.rmSync(holdFile(shared, site), { force: true });
      markFree(shared, site, now);
    }
    const first = priority(shared, site, who, pid, now);
    if (first) return { ok: false, waiter: first.waiter, until: first.until };
    const hold = newSiteHold(site, who, now);
    writeFileAtomic(holdFile(shared, site), JSON.stringify(hold, null, 2) + "\n");
    leaveQueue(shared, site, who.tree, pid);
    fs.rmSync(freeFile(shared, site), { force: true });
    return { ok: true, hold, fresh: true };
  });
}

/**
 * A site taken for a task by the process starting its session, handed to the session once it began (under the site's
 * lock): from then it lapses with the session, or with no request for archive.hold.
 */
export function transferSite(shared: string, site: string, from: Holder, to: Holder): boolean {
  try {
    return withSiteLock(shared, site, () => {
      const cur = readSiteHold(shared, site);
      if (!cur || !sameHolder(cur.hold, from)) return false;
      const { pid: _, session: _s, task: _t, research: _r, worker: _w, agent: _a, agentSession: _g, ...rest } = cur.hold;
      const hold: SiteHold = { ...rest, by: to.by, tree: path.resolve(to.tree), ...(to.session ? { session: to.session } : {}), ...(to.task ? { task: to.task } : {}), ...(to.research ? { research: to.research } : {}), ...(to.worker ? { worker: to.worker } : {}), ...(to.agent ? { agent: to.agent } : {}), ...(to.agentSession ? { agentSession: to.agentSession } : {}), ...(to.pid !== undefined ? { pid: to.pid } : {}), seq: (cur.hold.seq ?? 0) + 1 };
      writeFileAtomic(holdFile(shared, site), JSON.stringify(hold, null, 2) + "\n");
      return true;
    });
  } catch {
    return false; // (held by its process still: it lapses when that ends, or with no request)
  }
}

/** Let a site go (`who`'s own hold only): the one waiting longest goes first now. */
export function releaseSite(shared: string, site: string, who: Holder): boolean {
  const cur = readSiteHold(shared, site);
  if (!cur || !sameHolder(cur.hold, who)) return false;
  try {
    return withSiteLock(shared, site, () => {
      const again = readSiteHold(shared, site);
      if (!again || !sameHolder(again.hold, who)) return false;
      fs.rmSync(holdFile(shared, site), { force: true });
      markFree(shared, site, Date.now());
      return true;
    });
  } catch {
    return false; // (its lock busy past its wait: the hold lapses with its session all the same)
  }
}

/** The sites held now, each with its hold (the bulk download's left out). */
export function siteHolds(shared: string): { hold: SiteHold; mtimeMs: number }[] {
  let names: string[];
  try {
    names = fs.readdirSync(holdsDir(shared)).filter((f) => f.endsWith(".json") && f !== `${BULK}.json`);
  } catch {
    return [];
  }
  const out: { hold: SiteHold; mtimeMs: number }[] = [];
  for (const f of names) {
    const r = readSiteHold(shared, f.slice(0, -5));
    if (r) out.push(r);
  }
  return out;
}

/** Every site a session (or a process) holds let go: its session closed, its fetch ended. */
export function releaseHolder(shared: string | undefined, who: Holder): string[] {
  if (!shared) return [];
  const gone: string[] = [];
  for (const { hold } of siteHolds(shared)) if (sameHolder(hold, who) && releaseSite(shared, hold.site, who)) gone.push(hold.site);
  return gone;
}

/** The sites held now by someone other than `who` (alive), or with another waiting before it: the tasks on them wait. */
export function heldSites(shared: string | undefined, who: Holder, env: Env, now = Date.now()): Map<string, Exclude<SiteClaim, { ok: true }>> {
  const out = new Map<string, Exclude<SiteClaim, { ok: true }>>();
  if (!shared || !fs.existsSync(holdsDir(shared))) return out;
  const sites = new Set(siteHolds(shared).map((h) => h.hold.site));
  // a site let go a moment ago with one waiting first holds too (its priority)
  try {
    for (const f of fs.readdirSync(holdsDir(shared))) if (f.endsWith(".free")) sites.add(f.slice(0, -5));
  } catch {
    // (none)
  }
  for (const site of sites) {
    if (site === BULK) continue;
    const r = siteFor(shared, site, who, env, now);
    if (!r.ok) out.set(site, r);
  }
  return out;
}

// ── words ────────────────────────────────────────────────────────────────

/** Who holds a site, for the agent: the research's session, or strom fetch of another research. */
export function holderWords(h: Pick<SiteHold, "tree" | "session" | "task" | "by">, tree?: string): string {
  const own = tree !== undefined && path.resolve(tree) === path.resolve(h.tree);
  const what = h.by === "fetch" ? "strom fetch" : h.by === "run" ? "strom run" : h.by === "chat" ? "strom chat" : "an agent";
  if (own) return h.session ? `session ${h.session}${h.task ? ` (${h.task})` : ""} of this research` : `${what} of this research`;
  return `${what} of another research (${path.basename(h.tree)})`;
}

// ── tasks ────────────────────────────────────────────────────────────────

/**
 * Whether a host's site is restricted (K2.1): a connector of the plugins folder that reaches it — its levels (the
 * terms, the person's permission) or its hourly cap —, else the host's own level. Read only.
 */
export function restrictedHost(env: Env, host: string, o: { shared?: string; tree?: Tree; connectors?: Connector[] } = {}): boolean {
  const connectors = o.connectors ?? (o.shared ? listConnectors(o.shared, env) : []);
  const c = connectors.find((x) => hostAllowed(host, x.manifest.hosts));
  const net = o.shared ? path.join(o.shared, "net") : undefined;
  const input = { readOnly: true, ...(o.tree ? { tree: o.tree } : {}), ...(net ? { net } : {}) };
  if (c) {
    if (cappedConnector(c.manifest)) return true;
    const site = siteOf(host);
    return connectorLevels(env, c, input).some((a) => siteOf(a.host) === site && restrictedLevel(a));
  }
  try {
    return restrictedLevel(archiveLevel(env, { ...input, url: host }));
  } catch {
    return false;
  }
}

/** The sites of each record set of a task with an address (none: the task needs no archive's images). */
function setSites(tree: Tree, t: Task): string[][] {
  return taskRecordsets(tree, t).sets.map((b) => [...new Set(setHosts(tree, b).map(siteOf))]).filter((x) => x.length);
}

/**
 * The site a task's work lies on, when every record set of it with an address lies on one and the same site and that
 * site is restricted (spec 127 K2.2): its session takes it with the task.
 */
export function restrictedSiteOfTask(tree: Tree, t: Task, shared: string | undefined, connectors?: Connector[]): string | undefined {
  const sets = setSites(tree, t);
  if (!sets.length) return undefined;
  const site = sets[0]![0]!;
  if (!sets.every((x) => x.includes(site))) return undefined;
  const hosts = [...new Set(taskRecordsets(tree, t).sets.flatMap((b) => setHosts(tree, b)).filter((h) => siteOf(h) === site))];
  const cs = connectors ?? (shared ? listConnectors(shared, tree.env) : []);
  return hosts.some((h) => restrictedHost(tree.env, h, { ...(shared ? { shared } : {}), tree, connectors: cs })) ? site : undefined;
}

/**
 * A task whose every record set with an address lies on a site another holds (or another waits for first): the site
 * it waits for (K2.3) — undefined where one of them lies elsewhere (the task can go on there) or it needs no archive.
 */
export function heldSiteOfTask(tree: Tree, t: Task, held: Map<string, unknown>): string | undefined {
  if (!held.size) return undefined;
  const sets = setSites(tree, t);
  if (!sets.length) return undefined;
  let first: string | undefined;
  for (const sites of sets) {
    const on = sites.find((s) => held.has(s));
    if (!on) return undefined;
    first ??= on;
  }
  return first;
}

// ── an agent's own tools ─────────────────────────────────────────────────

/**
 * A request of an agent's own tool (its web fetch, its browser) to a host: on a restricted site its session takes the
 * site, or beats its own hold; held by another, or another waiting first, not taken (the caller refuses it). Undefined:
 * a site that restricts nothing (no hold), or a holder nobody could tell again (no session, no agent's id: only checked).
 */
export function takeSiteFor(shared: string, o: { env: Env; tree: Tree; host: string; level?: ArchiveLevel; human?: boolean; session?: { id: string; task?: string; research?: string; runner?: string; agent?: string }; agentSession?: string }): SiteClaim | undefined {
  const host = o.host.toLowerCase();
  let restricted = !!o.human || (o.level ? restrictedLevel(o.level) : false);
  if (!restricted) {
    try {
      restricted = restrictedHost(o.env, host, { shared, tree: o.tree });
    } catch {
      restricted = false;
    }
  }
  if (!restricted) return undefined;
  const site = siteOf(host);
  const worker = o.env.STROM_WORKER && /^[\p{L}\p{N}._-]{1,80}$/u.test(o.env.STROM_WORKER) ? o.env.STROM_WORKER : undefined;
  const s = o.session;
  const who: Holder = s
    ? { tree: o.tree.root, session: s.id, ...(s.task ? { task: s.task } : {}), ...(s.research ? { research: s.research } : {}), by: s.runner ? "run" : worker ? "chat" : "agent", ...(worker ? { worker } : {}), ...(s.agent ? { agent: s.agent } : {}), ...(o.agentSession ? { agentSession: o.agentSession } : {}) }
    : { tree: o.tree.root, by: "agent", ...(o.agentSession ? { agentSession: o.agentSession } : {}) };
  if (!who.session && !who.agentSession) {
    const r = siteFor(shared, site, { ...who, pid: -1 }, o.env);
    return r.ok ? undefined : r;
  }
  try {
    return claimSite(shared, site, who, o.env, { pid: -1 });
  } catch {
    return undefined; // (its short lock busy past its wait: the limiter still paces the request)
  }
}

/** The refusal of an agent's tool on a site another session uses: who, since when, until when — for the agent. */
export function archiveHeldText(host: string, c: Exclude<SiteClaim, { ok: true }>, tree: string): string {
  const now = Date.now();
  const at = (t: number) => clock(t, now);
  const who = c.hold ? holderWords(c.hold, tree) : `${c.waiter.by === "fetch" ? "strom fetch" : c.waiter.by === "run" ? "strom run" : "an agent"} waiting longer`;
  const until = Math.max(c.hold ? c.life.until : c.until, now);
  const since = c.hold ? `since ${at(c.life.since)}, last request ${at(c.life.lastSign)}, ` : "";
  return `strom: ${host} — ${siteOf(host)} restricts automated access and ${who} uses it now (${since}free by ${at(until)} at the latest): one session at a time on it. Nothing was asked of it — work without it meanwhile (strom task next), then try again.`;
}
