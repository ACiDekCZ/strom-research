// What the work of one computer shares (spec 126 U8). Runs side by side — of one research, or of several researches with
// the same shared folder — never use more of what one run would: the agent's plan, a site's pages, the readers. Kept in
// the shared folder, each under a lock of its own (core/lock.ts: a lock whose process here is gone is free at once):
//
//   <shared>/agents/limit-<agent>.json  the agent's plan at its limit until … ({until, since, by, tree, agent, kind}):
//                                       written by the run whose session the limit cut off; no other run of that agent
//                                       (and its account: Claude Code's folder, Codex's) here begins a session before it —
//                                       a session at work goes on. Past its until it counts no more.
//   <shared>/agents/gate-<agent>.lock   a run asks its gate under it and holds it until the session the gate let go has
//                                       begun: two runs never get "go" out of the same room of the plan at once.
//   <shared>/readers/slot-<n>.lock      a reader of scans at work (n below read.parallel): at most read.parallel readers
//                                       of every reading of this computer at once; a reader waits for a slot.
//   <limiter's folder>/site~<site>.web.json  the pages of a site the agents' web tools had (core/web.ts), of every session
//                                       here: web.perHost counted for the computer within the session's time too.
//
// Nothing of it adds a request to an archive or raises a limit: each only keeps a run, a reader or a page back.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { acquireLock } from "./lock.ts";
import { LockedError } from "./errors.ts";
import { writeFileAtomic } from "./json.ts";
import { claudeConfigSet } from "./claudedir.ts";
import { installation, type Installation } from "./self.ts";
import type { Env } from "./paths.ts";

function agentsDir(shared: string): string {
  return path.join(shared, "agents");
}

/**
 * The agent and its account as this computer's runs share its plan: the agent's id, with Claude Code's folder or Codex's
 * home when one is said (a second subscription is a plan of its own) — its path hashed, never written as it is.
 */
export function agentKey(agent: string, env: Env): string {
  let account: string | undefined;
  try {
    account = agent === "claude" ? claudeConfigSet(env) : agent === "codex" ? env.CODEX_HOME?.trim() || undefined : undefined;
  } catch {
    account = undefined;
  }
  const safe = agent.replace(/[^a-z0-9-]/gi, "_");
  if (!account) return safe;
  return `${safe}-${crypto.createHash("sha256").update(path.resolve(account)).digest("hex").slice(0, 8)}`;
}

// ── the agent's plan at its limit ────────────────────────────────────────────

export interface LimitMark {
  /** Until when no session of the agent begins here (ISO). */
  until: string;
  /** When the limit cut a session off (ISO). */
  since: string;
  /** The run that met it (its worker's name). */
  by: string;
  /** Its research's folder. */
  tree?: string;
  agent: string;
  /** Which window of the plan, as the agent said it. */
  kind?: string;
}

const limitFile = (shared: string, key: string) => path.join(agentsDir(shared), `limit-${key}.json`);

/** A mark without its time (written by hand, or cut short): this long after it was written, as a run waits today. */
const MARK_DEFAULT_MS = 15 * 60_000;

/** The agent's plan at its limit now (its mark, its until still ahead), or undefined. Never throws. */
export function limitMark(shared: string | undefined, agent: string, env: Env, now = Date.now()): LimitMark | undefined {
  if (!shared) return undefined;
  let m: Partial<LimitMark>;
  try {
    m = JSON.parse(fs.readFileSync(limitFile(shared, agentKey(agent, env)), "utf8")) as Partial<LimitMark>;
  } catch {
    return undefined;
  }
  if (!m || typeof m !== "object") return undefined;
  const since = Date.parse(String(m.since ?? ""));
  const until = Date.parse(String(m.until ?? "")) || (Number.isFinite(since) ? since + MARK_DEFAULT_MS : NaN);
  // over, or a time strom never writes (a plan's longest window is a week)
  if (!Number.isFinite(until) || until <= now || until - now > 9 * 24 * 3600_000) return undefined;
  return { until: new Date(until).toISOString(), since: Number.isFinite(since) ? new Date(since).toISOString() : new Date(now).toISOString(), by: String(m.by ?? "?"), agent, ...(typeof m.tree === "string" ? { tree: m.tree } : {}), ...(typeof m.kind === "string" ? { kind: m.kind } : {}) };
}

/**
 * The agent's plan at its limit until `until` (ms), said by the run `by` whose session it cut off — the later of it and a
 * mark there already. Never throws: a mark not written keeps every other run as it was.
 */
export function markLimit(shared: string | undefined, agent: string, env: Env, o: { until: number; by: string; tree?: string; kind?: string | undefined; now?: number }): void {
  if (!shared) return;
  const key = agentKey(agent, env);
  const file = limitFile(shared, key);
  try {
    fs.mkdirSync(agentsDir(shared), { recursive: true });
    const release = acquireLock(`${file}.lock`, { owner: `limit ${o.by}`, waitMs: 3000, staleMs: 60_000 });
    try {
      const now = o.now ?? Date.now();
      const had = limitMark(shared, agent, env, now);
      if (had && Date.parse(had.until) >= o.until) return;
      const mark: LimitMark = { until: new Date(o.until).toISOString(), since: new Date(now).toISOString(), by: o.by, agent, ...(o.tree ? { tree: o.tree } : {}), ...(o.kind ? { kind: o.kind } : {}) };
      writeFileAtomic(file, JSON.stringify(mark, null, 2) + "\n");
    } finally {
      release();
    }
  } catch {
    // no shared folder to write to: each run meets the limit itself, as before
  }
}

// ── the gate's turn ──────────────────────────────────────────────────────────

/** A run waits at most this long for its turn at the gate; then it asks all the same (a holder stuck past it). */
const GATE_TURN_WAIT_MS = 10 * 60_000;
/** A turn held longer than this is no longer held (the gate's longest answer and a session's start well within it). */
const GATE_TURN_MAX_MS = 10 * 60_000;

/**
 * The turn to ask the gate (for an agent and its account): held until the session the gate let go has begun, so that
 * two runs never get "go" out of the same room at once. Waited for outside every other lock, without blocking the run
 * (a Ctrl-C ends the wait); undefined: no shared folder, or not had in time — the gate asked all the same.
 */
export async function gateTurn(shared: string | undefined, agent: string, env: Env, owner: string, signal?: AbortSignal): Promise<(() => void) | undefined> {
  if (!shared) return undefined;
  const file = path.join(agentsDir(shared), `gate-${agentKey(agent, env)}.lock`);
  const end = Date.now() + GATE_TURN_WAIT_MS;
  for (;;) {
    try {
      return acquireLock(file, { owner, waitMs: 0, staleMs: GATE_TURN_MAX_MS, maxAgeMs: GATE_TURN_MAX_MS, machine: true });
    } catch (err) {
      if (!(err instanceof LockedError)) return undefined;
    }
    if (Date.now() >= end || signal?.aborted) return undefined;
    await sleep(200, signal);
  }
}

// ── readers of scans ─────────────────────────────────────────────────────────

/** A reader waits at most this long for its slot (another reading's readers at work); then it is not started. */
export const READER_SLOT_WAIT_MS = 30 * 60_000;
/** How often a reader waiting for its slot looks again. */
const SLOT_LOOK_MS = 500;

/** How long a reader waits for its slot: READER_SLOT_WAIT_MS, else STROM_TEST_READER_SLOT_WAIT_MS (the sources only, a test's). */
export function readerSlotWait(env: Env, inst: Installation = installation()): number {
  const ms = inst.kind === "source" && env.STROM_TEST_READER_SLOT_WAIT_MS !== undefined ? Number(env.STROM_TEST_READER_SLOT_WAIT_MS) : NaN;
  return Number.isInteger(ms) && ms >= 0 ? ms : READER_SLOT_WAIT_MS;
}

const slotFile = (shared: string, k: number) => path.join(shared, "readers", `slot-${k}.lock`);
/** A slot of another computer (a shared folder on a network disk) is free after this. */
const SLOT_STALE_MS = 6 * 3600_000;

/**
 * A slot for one reader of scans: at most `max` (read.parallel) readers of every reading of this computer at once. A
 * slot is a lock (core/lock.ts): let go as the reader ends, free at once when its process is gone (killed, the computer
 * restarted). Waited for at most `waitMs` (`onWait` told once, with how many may read at once), else undefined: no slot — the
 * reader is not started. No shared folder: no slot needed.
 */
export async function readerSlot(shared: string | undefined, max: number, o: { owner: string; waitMs: number; signal?: AbortSignal; onWait?: (busy: number) => void; stop?: () => boolean }): Promise<(() => void) | undefined> {
  if (!shared) return () => {};
  const end = Date.now() + o.waitMs;
  let told = false;
  for (;;) {
    for (let k = 0; k < max; k++) {
      try {
        return acquireLock(slotFile(shared, k), { owner: o.owner, waitMs: 0, staleMs: SLOT_STALE_MS, machine: true });
      } catch (err) {
        if (!(err instanceof LockedError)) return () => {};
      }
    }
    if (Date.now() >= end || o.signal?.aborted || o.stop?.()) return undefined;
    if (!told) {
      told = true;
      o.onWait?.(max);
    }
    await sleep(Math.min(SLOT_LOOK_MS, Math.max(1, end - Date.now())), o.signal);
  }
}

// ── a site's pages through the agents' web tools ─────────────────────────────

interface SitePages {
  requests: { at: number; who: string }[];
}

/** The pages of a site are kept this long (whatever window a research here counts them in). */
const SITE_KEEP_MS = 24 * 3600_000;
/** At most so many pages of a site are kept (the newest). */
const SITE_KEEP_N = 5000;

const siteFile = (stateDir: string, site: string) => path.join(stateDir, `site~${site.replace(/[^a-z0-9.-]/gi, "_")}.web.json`);

function readSite(stateDir: string, site: string): SitePages {
  try {
    const v = JSON.parse(fs.readFileSync(siteFile(stateDir, site), "utf8")) as SitePages;
    if (v && Array.isArray(v.requests)) return { requests: v.requests.filter((r) => r && typeof r.at === "number" && Number.isFinite(r.at)) };
  } catch {
    // none yet, or broken: counted from now
  }
  return { requests: [] };
}

/** The pages of a site the agents' web tools had on this computer within `windowMs` before `now` (every session). */
export function sitePagesHere(stateDir: string, site: string, windowMs: number, now = Date.now()): number {
  return readSite(stateDir, site).requests.filter((r) => r.at > now - windowMs && r.at <= now + windowMs).length;
}

/**
 * When the site takes a page of the agents' web tools again on this computer: the moment fewer than `limit − free + 1`
 * of its pages lie within `windowMs` — the oldest that must leave the window, plus the window (page by page: one more
 * used, the next frees as the one after it leaves). `free`: how many pages must be free (1: the next page). `now` when
 * that many are free already.
 */
export function siteFreeAt(stateDir: string, site: string, windowMs: number, limit: number, now = Date.now(), free = 1): number {
  const ats = readSite(stateDir, site)
    .requests.map((r) => r.at)
    .filter((at) => at > now - windowMs && at <= now + windowMs)
    .sort((a, b) => a - b);
  const leave = ats.length - (limit - Math.max(1, Math.min(free, limit)));
  if (leave <= 0) return now;
  return ats[leave - 1]! + windowMs;
}

/** The sites whose pages the agents' web tools had on this computer (their files in the limiter's folder). */
export function webSites(stateDir: string): string[] {
  try {
    return fs
      .readdirSync(stateDir)
      .filter((f) => f.startsWith("site~") && f.endsWith(".web.json"))
      .map((f) => f.slice(5, -9));
  } catch {
    return [];
  }
}

/** One page of a site more, of the session `who` (under the site's lock where the caller has it). Never throws. */
export function noteSitePage(stateDir: string, site: string, who: string, now = Date.now()): void {
  try {
    const s = readSite(stateDir, site);
    const requests = [...s.requests.filter((r) => r.at > now - SITE_KEEP_MS), { at: now, who }].slice(-SITE_KEEP_N);
    writeFileAtomic(siteFile(stateDir, site), JSON.stringify({ requests }) + "\n");
  } catch {
    // counted in the session all the same
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}
