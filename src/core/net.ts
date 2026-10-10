// The polite network layer every connector goes through. One request at a time
// per host with a pause between requests and an hourly cap — shared by every
// strom process on this computer (state in <shared>/net/). No limit is made
// up: the pace is the service's (its connector says it, and where the service
// states it) or strom's default pause, or the user's own for the host; an
// hourly cap only where the service or the user sets one. The host's answers
// steer it: slower while it answers slowly, a wait when it says its limit is
// used up (RateLimit headers, Retry-After). An archive that asks
// us to slow down (429) gets one more try after the wait it asks for, then an
// hour off; one that refuses (401/403) is left alone for a day; one that does
// not answer at all is treated the same way: silence from a live server is
// how a firewall block looks. Repeating a refused request is the quickest way
// from "slow down" to a blocked IP — for the user, and for every other
// genealogist behind it.

import fs from "node:fs";
import path from "node:path";
import { StromError } from "./errors.ts";
import { acquireLock } from "./lock.ts";
import { readJsonIfExists, writeJson } from "./json.ts";
import { VERSION } from "./tree.ts";
import { fetchH2, type H2Init } from "./http2.ts";

export interface Pace {
  /** Pause between two requests to one host. */
  minIntervalMs: number;
  /** Requests to one host in any hour. */
  perHour: number;
}

/** strom's own pace for a host whose service says nothing: a pause, no hourly cap. */
export const DEFAULT_PACE: Pace = { minIntervalMs: 2000, perHour: Infinity };
/** The shortest pause there is — a service's, or the user's for a host. */
export const MIN_INTERVAL_MS = 250;

/** The pace a connector gives for its service (connector.json policy.pace): faster than strom's default only with where the service says so. */
export interface ServicePace extends Partial<Pace> {
  /** Where the service states its limits (its API documentation, its terms): a URL or a sentence. */
  source?: string;
}
/** How long a host that refused us (401/403) is left alone. */
export const REFUSED_MS = 24 * 3600_000;
/** The longest strom waits by itself (an hourly cap, a Retry-After) before it gives up for now — unless its caller waits longer (waitMs). */
export const MAX_WAIT_MS = 2 * 60_000;
/** An hour off after a host kept asking us to slow down, or stopped answering. */
export const COOL_OFF_MS = 3600_000;
const TIMEOUT_MS = 60_000;
/** Attempts per request: a busy server (5xx) a few, "slow down" (429) and silence only one more. */
const ATTEMPTS = { busy: 3, slowDown: 2, silent: 2 };

export const USER_AGENT = `strom-research/${VERSION} (genealogy research; one request at a time, paced)`;

export type NetFailure = "host" | "refused" | "blocked" | "cap" | "http" | "silent";

export class NetError extends StromError {
  readonly failure: NetFailure;
  readonly host: string;
  readonly status: number | undefined;
  /** A limit used up: when the host takes requests again (ms). */
  readonly until: number | undefined;

  constructor(failure: NetFailure, host: string, message: string, hint?: string, status?: number, until?: number) {
    super(message, hint ? { hint } : {});
    this.name = "NetError";
    this.failure = failure;
    this.host = host;
    this.status = status;
    this.until = until;
  }
}

/** A limit used up for longer than a pause: waited for with the host's lock let go (thrown inside, caught by politeRequest). */
class WaitOutside {
  readonly until: number;
  readonly why: "cap" | "limit";
  constructor(until: number, why: "cap" | "limit") {
    this.until = until;
    this.why = why;
  }
}

/** When the host takes a request again: its hourly cap used up (the oldest request that keeps it full is an hour old). */
function capFree(recent: number[], perHour: number): number {
  const sorted = [...recent].sort((a, b) => a - b);
  return sorted[sorted.length - perHour]! + 3600_000;
}

/**
 * The shares of a host's hourly cap at which strom fetch says that little of the hour is left — to the agent after
 * every fetch past the first, to the person once at each share reached. Only said: the pace and the cap stay.
 */
export const CAP_WARN = [0.8, 0.9] as const;

/** A host near its hourly cap (CAP_WARN): the requests of the last hour, the cap, what is left, when the next frees. */
export interface CapNear {
  used: number;
  cap: number;
  left: number;
  /** When the oldest request of the hour is an hour old, so that one more may go (ms). */
  free: number;
  /** The highest share of CAP_WARN reached. */
  share: number;
}

export function capNear(s: HostState, pace: Pace, now: number): CapNear | undefined {
  if (!Number.isFinite(pace.perHour) || !(pace.perHour > 0)) return undefined;
  const hour = s.recent.filter((t) => t > now - 3600_000);
  const share = [...CAP_WARN].reverse().find((x) => hour.length >= x * pace.perHour);
  if (share === undefined) return undefined;
  return { used: hour.length, cap: pace.perHour, left: Math.max(0, pace.perHour - hour.length), free: Math.min(...hour) + 3600_000, share };
}

/** A limit used up: try again then. */
function capError(host: string, why: "cap" | "limit", until: number, perHour: number): NetError {
  const what = why === "cap" ? `${perHour} requests to ${host} in the last hour — its hourly cap` : `${host} says its limit is used up`;
  return new NetError("cap", host, `${what}; try again at ${clock(until)}`, `go on with other work; run it again at ${clock(until)} — not sooner: strom sends nothing to ${host} before then${why === "limit" ? `; the person can lift it early: strom allow host ${host} --unblock` : ""}`, undefined, until);
}

export interface HostState {
  /** When the last request started (ms). */
  last?: number;
  /** Request times within the last hour. */
  recent: number[];
  /** Pace multiplier after the host asked us to slow down. */
  slowdown?: number;
  /** It answered HTTP/1.1 with 426 (Upgrade Required): it is asked over HTTP/2. */
  http2?: boolean;
  blockedUntil?: number;
  reason?: string;
  /** How long the host takes to answer, on average (ms). */
  latencyMs?: number;
  /** The host said its limit is used up until then (RateLimit headers). */
  waitUntil?: number;
  /** The user's own pace for the host (strom allow host --pace/--per-hour). */
  own?: OwnPace;
}

/** A host's pace as the user set it: a part unset is the service's (perHour 0: no cap). */
export interface OwnPace {
  minIntervalMs?: number;
  perHour?: number;
  at: string;
}

export interface NetOptions {
  /** Where the shared state lives (<shared>/net). */
  stateDir: string;
  /** Hosts this caller may contact ("example.org" also allows its subdomains). */
  hosts: string[];
  pace?: ServicePace;
  method?: "GET" | "POST" | "HEAD";
  /** Extra request headers (Referer, Accept, a Cookie of the caller's own …); strom sets User-Agent itself. */
  headers?: Record<string, string>;
  body?: string;
  /** A login of the user in these headers, or in the body: it goes to the address asked and nowhere else, not even by a redirect. */
  private?: { headers: string[]; body: boolean };
  /** Cookies of one run: kept from answers, sent back to the hosts that set them. */
  cookies?: CookieJar;
  /**
   * How long the caller waits for a limit used up (an hourly cap, the host's "limit used up") — strom fetch, for the
   * agent that would only sleep and ask again: longer than strom's own MAX_WAIT_MS, never past it — and told first.
   */
  waitMs?: number;
  /** Told before a wait for a limit: the host, until when, and why. */
  onWait?: (w: { host: string; until: number; ms: number; why: "cap" | "limit" }) => void;
  /** Told of every pause a request makes (the host's pace, its hourly cap, a limit used up) — measured, never decided by. */
  onPause?: (p: { host: string; ms: number; why: "pace" | "cap" | "limit" }) => void;
  /** Told of every request that goes to a host (a redirect and a retry are requests too) — measured only. */
  onRequest?: (host: string) => void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
  fetchH2?: (url: string, init: H2Init) => Promise<Response>;
}

export interface NetResponse {
  status: number;
  contentType: string;
  headers: Record<string, string>;
  body: Buffer;
  url: string;
}

/** Headers a caller may not set: who we are, and what strom manages. */
const OWN_HEADERS = new Set(["user-agent", "host", "content-length", "connection", "transfer-encoding"]);
/** Headers that describe a body: gone when a redirect turns a POST into a GET. */
const BODY_HEADERS = new Set(["content-type", "content-encoding", "content-language"]);

/** A minimal cookie jar for one run: name=value per domain and path; enough for a session. */
export class CookieJar {
  private jar: { name: string; value: string; domain: string; hostOnly: boolean; path: string }[] = [];

  /** A jar with the cookies kept from before (a file of `entries()`); anything else is left out. */
  static from(entries: unknown): CookieJar {
    const j = new CookieJar();
    if (Array.isArray(entries))
      for (const c of entries as Record<string, unknown>[])
        if (c && typeof c.name === "string" && typeof c.value === "string" && typeof c.domain === "string" && typeof c.path === "string")
          j.jar.push({ name: c.name, value: c.value, domain: c.domain, hostOnly: c.hostOnly !== false, path: c.path });
    return j;
  }

  /** Its cookies, to keep them between separate requests (the probes of one connector). */
  entries(): { name: string; value: string; domain: string; hostOnly: boolean; path: string }[] {
    return this.jar.map((c) => ({ ...c }));
  }

  store(url: URL, setCookies: string[]): void {
    for (const line of setCookies) {
      const [pair, ...attrs] = line.split(";");
      const eq = pair!.indexOf("=");
      if (eq <= 0) continue;
      const name = pair!.slice(0, eq).trim();
      const value = pair!.slice(eq + 1).trim();
      let domain = url.hostname.toLowerCase();
      let hostOnly = true;
      let cpath = "/";
      let expired = false;
      for (const a of attrs) {
        const [k, ...v] = a.split("=");
        const key = k!.trim().toLowerCase();
        const val = v.join("=").trim();
        if (key === "domain" && val) {
          const d = val.replace(/^\./, "").toLowerCase();
          if (hostAllowed(url.hostname, [d])) {
            domain = d;
            hostOnly = false;
          }
        } else if (key === "path" && val.startsWith("/")) cpath = val;
        else if (key === "max-age" && Number(val) <= 0) expired = true;
        else if (key === "expires" && Date.parse(val) < Date.now()) expired = true;
      }
      this.jar = this.jar.filter((c) => !(c.name === name && c.domain === domain && c.path === cpath));
      if (!expired) this.jar.push({ name, value, domain, hostOnly, path: cpath });
    }
  }

  header(url: URL): string | undefined {
    const host = url.hostname.toLowerCase();
    const hits = this.jar.filter((c) => (c.hostOnly ? host === c.domain : hostAllowed(host, [c.domain])) && url.pathname.startsWith(c.path));
    return hits.length ? hits.map((c) => `${c.name}=${c.value}`).join("; ") : undefined;
  }
}

/** For tests running strom in-process: record the pauses instead of sleeping (no env or flag reaches this). */
/** Longer than any of strom's requests holds a host's lock (its pause, its waits within MAX_WAIT_MS, the answer within TIMEOUT_MS): an agent's web fetch takes over one older. */
export const HOST_LOCK_MAX_AGE_MS = 30 * 60_000;

export const testHooks: { sleep?: (ms: number) => Promise<void>; now?: () => number; /** agentRequest's wait for a host's lock */ lockWaitMs?: number } = {};

/** The pace a connector gives for its service, on a host the user set nothing for. */
export function paceOf(asked?: ServicePace): Pace {
  return hostPace({ recent: [] }, asked);
}

/**
 * The pace for a host: the user's own for it first, else the service's — its
 * pause (faster than strom's default only with where the service says so) and
 * its hourly cap if it has one — else strom's pause, with no cap. The host's
 * answers stretch the pause where the requests are made.
 */
export function hostPace(s: HostState, asked?: ServicePace): Pace {
  const service = asked?.minIntervalMs !== undefined && (asked.minIntervalMs >= DEFAULT_PACE.minIntervalMs || asked.source?.trim()) ? asked.minIntervalMs : DEFAULT_PACE.minIntervalMs;
  const minIntervalMs = Math.max(MIN_INTERVAL_MS, s.own?.minIntervalMs ?? service);
  // the user's own cap (0: none), else the service's, else none
  const perHour = s.own?.perHour !== undefined ? s.own.perHour || Infinity : asked?.perHour && asked.perHour > 0 ? asked.perHour : DEFAULT_PACE.perHour;
  return { minIntervalMs, perHour };
}

/** A pace in words: "at least 2 s apart" and its hourly cap, if it has one. */
export function paceText(pace: Pace): string {
  return `at least ${pace.minIntervalMs / 1000} s apart${Number.isFinite(pace.perHour) ? `, at most ${pace.perHour} an hour` : ", no hourly cap"}`;
}

/** The pause before the next request to a host: its pace, longer while it answers slowly or asked us to slow down. */
function gapOf(s: HostState, pace: Pace): number {
  return Math.max(pace.minIntervalMs, s.latencyMs ?? 0) * (s.slowdown ?? 1);
}

/** When a host's own limit is used up by its RateLimit headers (RateLimit: remaining=0, reset=…, or X-RateLimit-*). */
export function limitUsedUp(headers: Headers, now: number): number | undefined {
  const combined = headers.get("ratelimit") ?? "";
  const remaining = headers.get("ratelimit-remaining") ?? headers.get("x-ratelimit-remaining") ?? /remaining=(\d+)/.exec(combined)?.[1];
  if (remaining === undefined || remaining === null || Number(remaining) > 0) return undefined;
  const reset = Number(headers.get("ratelimit-reset") ?? headers.get("x-ratelimit-reset") ?? /reset=(\d+)/.exec(combined)?.[1]);
  if (!Number.isFinite(reset)) return now + 60_000;
  // seconds from now, or (X-RateLimit-Reset of some servers) the moment itself
  return reset > 1e9 ? reset * 1000 : now + reset * 1000;
}

/** The user's own pace for a host (strom allow host --pace/--per-hour); undefined parts go back to strom's. */
export function setOwnPace(dir: string, host: string, own: Omit<OwnPace, "at"> | undefined): HostState {
  fs.mkdirSync(dir, { recursive: true });
  const file = stateFile(dir, host);
  const release = acquireLock(`${file}.lock`, { owner: "strom net", waitMs: 60_000, staleMs: 10 * 60_000 });
  try {
    const s = hostState(dir, host);
    if (own && (own.minIntervalMs !== undefined || own.perHour !== undefined)) s.own = { ...own, at: new Date().toISOString() };
    else delete s.own;
    writeJson(file, s);
    return s;
  } finally {
    release();
  }
}

export function hostAllowed(host: string, hosts: string[]): boolean {
  const h = host.toLowerCase();
  return hosts.some((x) => {
    const a = x.toLowerCase().replace(/^\*\./, "");
    return h === a || h.endsWith("." + a);
  });
}

function stateFile(dir: string, host: string): string {
  return path.join(dir, `${host.replace(/[^a-z0-9.-]/gi, "_")}.json`);
}

/** The state of a site's requests (agentRequest's `site`): beside the hosts', never a host's own file. */
function siteStateFile(dir: string, site: string): string {
  return path.join(dir, `site~${site.replace(/[^a-z0-9.-]/gi, "_")}.json`);
}

export function hostState(dir: string, host: string, at?: number): HostState {
  return readHostState(dir, host, at).state;
}

/** The furthest ahead strom reserves a host's requests (reserveSlots: the browser's): its slots and its last one within it. */
export const SLOTS_AHEAD_MS = 3600_000;
/** What a time read from a host's state may lie beyond the furthest strom writes there: the clock put right a little. */
const STATE_MARGIN_MS = 5 * 60_000;
/** The longest a host's answer is taken to take on average (its timeout is TIMEOUT_MS): one above is taken as this long. */
const LATENCY_MAX_MS = 10 * TIMEOUT_MS;

/**
 * A host's state as its file keeps it — `broken` when the file is there but no state can be read from it (cut short by
 * a crash, overwritten), or a part of it holds what strom never writes there: a time not a number or negative, a time
 * of a request further ahead than strom ever reserves one (the clock set back, a hand edit: `{"last": <a year ahead>}`
 * would hold the host for a year — put right, the next request goes at the host's pace from now, never sooner), a
 * slowdown below 1. Those parts are left out (`timesLost` when the hour's times or the last one were among them: the
 * caller's own journal may tell them again), the rest kept — the user's own pace, and fields of a newer strom — and the
 * next write puts the clean state in its place whole (writeJson: aside, then renamed): never a host left uncounted for
 * good because its file cannot be read. Nothing read here makes strom faster than the state says: a wait the host or a
 * refusal set (waitUntil, blockedUntil) stays however far ahead it lies, and a slowdown or an answer's time beyond the
 * most strom writes is taken as that most, never left out.
 */
export function readHostState(dir: string, host: string, at: number = (testHooks.now ?? Date.now)()): { state: HostState; broken: boolean; timesLost: boolean } {
  let v: unknown;
  try {
    v = readJsonIfExists<unknown>(stateFile(dir, host));
  } catch {
    return { state: { recent: [] }, broken: true, timesLost: true };
  }
  if (v === undefined) return { state: { recent: [] }, broken: false, timesLost: false };
  if (!v || typeof v !== "object" || Array.isArray(v)) return { state: { recent: [] }, broken: true, timesLost: true };
  return checkHostState(v as Record<string, unknown>, at);
}

/** A time strom may have written: a number, not negative, at most `ahead` (+ the margin) after `at`. */
export function stateTime(x: unknown, at: number, ahead: number): x is number {
  return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= at + ahead + STATE_MARGIN_MS;
}

function checkHostState(raw: Record<string, unknown>, at: number): { state: HostState; broken: boolean; timesLost: boolean } {
  let broken = false;
  let timesLost = false;
  const out: Record<string, unknown> = { ...raw };
  const drop = (k: string, times = false) => {
    delete out[k];
    broken = true;
    if (times) timesLost = true;
  };
  const has = (k: string) => Object.prototype.hasOwnProperty.call(raw, k);
  if (has("last") && !stateTime(raw.last, at, SLOTS_AHEAD_MS)) drop("last", true);
  if (has("recent") && !Array.isArray(raw.recent)) {
    broken = timesLost = true;
  }
  const recent = Array.isArray(raw.recent) ? raw.recent : [];
  out.recent = recent.filter((x) => stateTime(x, at, SLOTS_AHEAD_MS));
  if ((out.recent as unknown[]).length !== recent.length) broken = timesLost = true;
  // the last request lost: the latest of the hour's that could be read, so the pace counts from it
  if (has("last") && out.last === undefined && (out.recent as number[]).length) out.last = Math.max(...(out.recent as number[]));
  // (beyond the most strom writes: that most — slower, never faster; below 1 or no number: none, the pace itself)
  const most = (k: string, max: number) => {
    out[k] = max;
    broken = true;
  };
  if (has("slowdown")) {
    const v = raw.slowdown;
    if (typeof v === "number" && v > 16) most("slowdown", 16);
    else if (!(typeof v === "number" && v >= 1)) drop("slowdown");
  }
  if (has("http2") && typeof raw.http2 !== "boolean") drop("http2");
  // a wait a refusal or the host set is kept however long — even from a clock set back: the gentle side; the person's
  // way out is strom allow host <host> --unblock (a refusal), else it runs out
  const until = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= 0;
  if (has("blockedUntil") && !until(raw.blockedUntil)) drop("blockedUntil");
  if (has("reason") && typeof raw.reason !== "string") drop("reason");
  if (has("latencyMs")) {
    const v = raw.latencyMs;
    if (typeof v === "number" && v > LATENCY_MAX_MS) most("latencyMs", LATENCY_MAX_MS);
    else if (!(typeof v === "number" && v >= 0)) drop("latencyMs");
  }
  if (has("waitUntil") && !until(raw.waitUntil)) drop("waitUntil");
  if (has("own")) {
    const own = raw.own;
    if (!own || typeof own !== "object" || Array.isArray(own)) drop("own");
    else {
      // the user's own pace: any length they set (at least MIN_INTERVAL_MS), any whole cap (0: none)
      const o = { ...(own as Record<string, unknown>) };
      const part = (k: string, ok: boolean) => {
        if (Object.prototype.hasOwnProperty.call(o, k) && !ok) {
          delete o[k];
          broken = true;
        }
      };
      part("minIntervalMs", typeof o.minIntervalMs === "number" && Number.isFinite(o.minIntervalMs) && o.minIntervalMs >= 0);
      part("perHour", typeof o.perHour === "number" && Number.isInteger(o.perHour) && o.perHour >= 0);
      part("at", typeof o.at === "string");
      out.own = o;
    }
  }
  return { state: out as unknown as HostState, broken, timesLost };
}

/** The hosts the limiter has met (it keeps a state for each). */
export function knownHosts(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("site~"))
    .map((f) => f.slice(0, -5));
}

/** Lift a refusal by hand (the user checked with the archive). */
export function clearBlock(dir: string, host: string): void {
  const file = stateFile(dir, host);
  const s = hostState(dir, host);
  delete s.blockedUntil;
  delete s.reason;
  // the limit a host said is used up (kept as given, a year too): the person lifts it the same way
  delete s.waitUntil;
  s.slowdown = 1;
  writeJson(file, s);
}

function retryAfterMs(value: string | null, now: number): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs)) return secs * 1000;
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - now) : undefined;
}

const when = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
/** A time as the clock on the wall shows it here ("14:32"), with the day when it is not today. */
export function clock(ms: number, today = Date.now()): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  const t = new Date(today);
  const sameDay = d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  return `${sameDay ? "" : `${day} `}${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** One request, politely. Throws NetError when the host is not allowed, refused us, went silent, or is capped. */
/** A pause told to the caller's measure; whatever it does, the request goes on. */
function paused(opts: NetOptions, p: { host: string; ms: number; why: "pace" | "cap" | "limit" }): void {
  try {
    opts.onPause?.(p);
  } catch {
    // a measurement is no reason to fail
  }
}

export async function politeRequest(url: string, opts: NetOptions, redirects = 0): Promise<NetResponse> {
  const now = opts.now ?? testHooks.now ?? Date.now;
  const sleep = opts.sleep ?? testHooks.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const doFetch = opts.fetchImpl ?? fetch;
  const doFetchH2 = opts.fetchH2 ?? fetchH2;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new NetError("http", "", `not a URL: ${url}`);
  }
  const host = u.hostname;
  if (!/^https?:$/.test(u.protocol)) throw new NetError("host", host, `only http and https: ${url}`);
  if (!hostAllowed(host, opts.hosts))
    throw new NetError("host", host, `${host} is not one of the hosts this connector may contact (${opts.hosts.join(", ")})`, "a connector names its hosts in connector.json; each needs the user's consent: strom allow host <host>");
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    if (OWN_HEADERS.has(k.toLowerCase())) continue;
    // checked here: what fetch() refuses to send is no silence of the archive
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(k)) throw new NetError("http", host, `request header "${k}": not a header name`);
    if (!/^[\t\x20-\x7e\x80-\xff]*$/.test(String(v)))
      throw new NetError("http", host, `request header ${k}: characters a header cannot carry (a line break, or letters beyond Latin-1)`, "encode it as the portal's pages do: a URL with encodeURI(), other text as the portal expects");
    headers[k.toLowerCase()] = String(v);
  }
  headers["user-agent"] = USER_AGENT;
  const cookie = [headers.cookie, opts.cookies?.header(u)].filter(Boolean).join("; ");
  if (cookie) headers.cookie = cookie;
  fs.mkdirSync(opts.stateDir, { recursive: true });
  const file = stateFile(opts.stateDir, host);
  const tries = { busy: 0, slowDown: 0, silent: 0 };
  let upgraded = false;
  let pace = hostPace(hostState(opts.stateDir, host, now()), opts.pace);
  // how long this request may wait for a limit used up, all waits together
  const waitBy = now() + Math.max(MAX_WAIT_MS, opts.waitMs ?? MAX_WAIT_MS);
  let waitedOutside = 0;

  for (;;) {
    // One request at a time per host, across processes: the lock is held from the pause to the answer.
    const release = acquireLock(`${file}.lock`, { owner: "strom net", waitMs: 10 * 60_000, staleMs: 10 * 60_000 });
    let res: Response | undefined;
    let failed: unknown;
    let slowed = false;
    let viaH2 = false;
    let took = 0;
    let outside: WaitOutside | undefined;
    try {
      let s = hostState(opts.stateDir, host, now());
      pace = hostPace(s, opts.pace);
      slowed = (s.slowdown ?? 1) > 1;
      const t = now();
      if (s.blockedUntil && s.blockedUntil > t)
        throw new NetError("blocked", host, `${host}: ${s.reason ?? "refused us"} — left alone until ${when(s.blockedUntil)}`, "do not retry: go on with other work; the user can lift it early with strom allow host <host> --unblock");
      s.recent = s.recent.filter((x) => x > t - 3600_000);
      if (s.recent.length >= pace.perHour) {
        const free = capFree(s.recent, pace.perHour);
        if (free > waitBy) throw capError(host, "cap", free, pace.perHour);
        // a pause: here, holding the host; longer: with the host let go, said first
        if (free - t > MAX_WAIT_MS) throw new WaitOutside(free, "cap");
        paused(opts, { host, ms: free - t, why: "cap" });
        await sleep(free - t);
      }
      if (s.waitUntil && s.waitUntil > now()) {
        if (s.waitUntil > waitBy) throw capError(host, "limit", s.waitUntil, pace.perHour);
        if (s.waitUntil - now() > MAX_WAIT_MS) throw new WaitOutside(s.waitUntil, "limit");
        paused(opts, { host, ms: s.waitUntil - now(), why: "limit" });
        await sleep(s.waitUntil - now());
      }
      const gap = (s.last ?? 0) + gapOf(s, pace) - now();
      if (gap > 0) {
        paused(opts, { host, ms: gap, why: "pace" });
        await sleep(gap);
      }
      s.last = now();
      s.recent.push(s.last);
      writeJson(file, s);
      try {
        opts.onRequest?.(host);
      } catch {
        // a measurement is no reason to fail
      }
      viaH2 = !!s.http2;
      const asked = now();
      try {
        // redirects are followed here, one by one, so that each target is checked and paced
        const body = opts.body !== undefined && method === "POST" ? { body: opts.body } : {};
        res = viaH2
          ? await doFetchH2(url, { method, headers, ...body, signal: AbortSignal.timeout(TIMEOUT_MS) })
          : await doFetch(url, { method, headers, ...body, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch (err) {
        failed = err;
      }
      took = now() - asked;
      const cool = (ms: number, reason: string) => {
        s = hostState(opts.stateDir, host, now());
        s.blockedUntil = now() + ms;
        s.reason = reason;
        writeJson(file, s);
      };
      if (res && (res.status === 401 || res.status === 403)) cool(REFUSED_MS, `it refused us (HTTP ${res.status} at ${when(now())})`);
      else if (res?.status === 429 && tries.slowDown + 1 >= ATTEMPTS.slowDown) cool(COOL_OFF_MS, `it asked us to slow down twice (HTTP 429 at ${when(now())})`);
      else if (!res && tries.silent + 1 >= ATTEMPTS.silent) cool(COOL_OFF_MS, `no answer at ${when(now())} — the server is down, or it blocks this IP`);
    } catch (err) {
      if (!(err instanceof WaitOutside)) throw err;
      outside = err;
    } finally {
      release();
    }
    if (outside) {
      // a slot freed may go to another strom first: waited again, a few times at most, then said when to try again
      if (++waitedOutside > 3) throw capError(host, outside.why, outside.until, pace.perHour);
      opts.onWait?.({ host, until: outside.until, ms: Math.max(0, outside.until - now()), why: outside.why });
      paused(opts, { host, ms: Math.max(0, outside.until - now()), why: outside.why });
      await sleep(Math.max(0, outside.until - now()));
      continue;
    }

    // 426 "Upgrade Required": the server speaks HTTP/2 only (Node's fetch speaks HTTP/1.1).
    // Asked once more over HTTP/2, paced like any request, and remembered for the host.
    if (res?.status === 426 && !viaH2 && !upgraded) {
      upgraded = true;
      const cur = hostState(opts.stateDir, host, now());
      cur.http2 = true;
      writeJson(file, cur);
      continue;
    }
    if (!res && viaH2) {
      // no HTTP/2 answer: the next request tries HTTP/1.1 again
      const cur = hostState(opts.stateDir, host, now());
      delete cur.http2;
      writeJson(file, cur);
    }
    if (res && (res.status === 401 || res.status === 403))
      throw new NetError("refused", host, `${host} answered ${res.status} — strom stops and leaves it alone for a day`, "an archive that refuses may block the IP next: stop, check its terms, ask it", res.status);
    if (res) opts.cookies?.store(u, res.headers.getSetCookie?.() ?? []);
    const location = res && res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (location) {
      if (redirects >= 5) throw new NetError("http", host, `too many redirects from ${url}`);
      // after a POST, a redirect is followed with GET (as browsers do), except 307/308
      const keep = res!.status === 307 || res!.status === 308 || method !== "POST";
      const next = new URL(location, url);
      const leaves = next.origin !== u.origin;
      if (leaves && keep && opts.private?.body && opts.body !== undefined)
        throw new NetError("http", host, `${url} sends the login on to ${next.origin} — strom does not follow`, "a login goes to the address it was asked for, and nowhere else");
      const own = new Set((leaves ? (opts.private?.headers ?? []) : []).map((k) => k.toLowerCase()));
      const headers = Object.fromEntries(Object.entries(opts.headers ?? {}).filter(([k]) => !own.has(k.toLowerCase()) && (keep || !BODY_HEADERS.has(k.toLowerCase()))));
      return politeRequest(next.toString(), { ...opts, headers, ...(keep ? {} : { method: "GET", body: undefined, private: { headers: opts.private?.headers ?? [], body: false } }) }, redirects + 1);
    }
    const kind = !res ? "silent" : res.status === 429 ? "slowDown" : res.status >= 500 ? "busy" : undefined;
    if (res && !kind) {
      // an answer without trouble: back towards the pace, how long it took, a limit the host says is used up
      const cur = hostState(opts.stateDir, host, now());
      if (slowed) cur.slowdown = Math.max(1, (cur.slowdown ?? 1) * 0.8);
      cur.latencyMs = Math.round(cur.latencyMs === undefined ? took : cur.latencyMs * 0.7 + took * 0.3);
      // the pause counts from the answer: a host that works long on each gets as long to rest
      cur.last = Math.max(cur.last ?? 0, now());
      const until = limitUsedUp(res.headers, now());
      if (until) cur.waitUntil = until;
      else delete cur.waitUntil;
      writeJson(file, cur);
      const out: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        if (k !== "set-cookie") out[k] = v;
      });
      return { status: res.status, contentType: res.headers.get("content-type") ?? "", headers: out, body: Buffer.from(await res.arrayBuffer()), url: res.url || url };
    }
    // Busy, "slow down", or no answer: slow down, and try again — a little.
    const cur = hostState(opts.stateDir, host, now());
    cur.slowdown = Math.min(16, (cur.slowdown ?? 1) * 2);
    writeJson(file, cur);
    tries[kind!]++;
    if (tries[kind!] >= ATTEMPTS[kind!]) {
      if (kind === "silent") throw new NetError("silent", host, `no answer from ${host} (${(failed as Error)?.message ?? "timeout"}) — it is down, or it blocks this IP; strom leaves it alone for an hour`, "do not retry: a firewall that drops requests looks exactly like this");
      if (kind === "slowDown") throw new NetError("refused", host, `${host} asked us twice to slow down (429) — strom leaves it alone for an hour`, "go on with other work; a smaller batch next time", 429);
      throw new NetError("http", host, `${host} answered ${res!.status} ${tries.busy} times — the server has trouble; try later`, undefined, res!.status);
    }
    const asked = res ? retryAfterMs(res.headers.get("retry-after"), now()) : undefined;
    const wait = asked ?? pace.minIntervalMs * 2 ** (tries.busy + tries.slowDown + tries.silent) * 2;
    if (wait > MAX_WAIT_MS) throw new NetError("cap", host, `${host} asks us to wait ${Math.round(wait / 60_000)} min — strom does not wait that long`, "go on with other work and come back later", res?.status);
    await sleep(wait);
  }
}

/**
 * Times for requests that another program makes — the user's browser — kept in
 * the same shared state as strom's own: the first free slot and then one per
 * pause, within the hourly cap. The browser keeps to them; strom's own requests
 * to the host wait until they are over. Fewer than asked when the hour is full.
 */
export function reserveSlots(stateDir: string, host: string, asked: ServicePace | undefined, count: number, opts: { now?: () => number; leadMs?: number } = {}): number[] {
  const now = opts.now ?? Date.now;
  fs.mkdirSync(stateDir, { recursive: true });
  const file = stateFile(stateDir, host);
  const release = acquireLock(`${file}.lock`, { owner: "strom net", waitMs: 10 * 60_000, staleMs: 10 * 60_000 });
  try {
    const t = now();
    const s = hostState(stateDir, host, t);
    const pace = hostPace(s, asked);
    if (s.blockedUntil && s.blockedUntil > t)
      throw new NetError("blocked", host, `${host}: ${s.reason ?? "refused us"} — left alone until ${when(s.blockedUntil)}`, "do not retry: go on with other work; the user can lift it early with strom allow host <host> --unblock");
    if (s.waitUntil && s.waitUntil - t > MAX_WAIT_MS) throw capError(host, "limit", s.waitUntil, pace.perHour);
    s.recent = s.recent.filter((x) => x > t - 3600_000);
    const free = Math.min(count, pace.perHour - s.recent.length);
    if (free <= 0) throw capError(host, "cap", capFree(s.recent, pace.perHour), pace.perHour);
    const gap = gapOf(s, pace);
    const first = Math.max(t + (opts.leadMs ?? 0), (s.last ?? 0) + gap, s.waitUntil ?? 0);
    // never further ahead than SLOTS_AHEAD_MS: fewer than asked, the rest next time
    if (first > t + SLOTS_AHEAD_MS)
      throw new NetError("cap", host, `${host}: strom has planned its requests for the next hour already; try again at ${clock(first - SLOTS_AHEAD_MS)}`, `go on with other work; run it again at ${clock(first - SLOTS_AHEAD_MS)}`, undefined, first - SLOTS_AHEAD_MS);
    const times = Array.from({ length: Math.min(free, Math.floor((t + SLOTS_AHEAD_MS - first) / gap) + 1) }, (_, i) => first + i * gap);
    s.last = times.at(-1)!;
    s.recent.push(...times);
    writeJson(file, s);
    return times;
  } finally {
    release();
  }
}

/** What another program got from a host (the browser): a refusal leaves it alone as if strom had got it. */
export function refusedBy(stateDir: string, host: string, status: number, now: () => number = Date.now): string | undefined {
  const ms = status === 401 || status === 403 ? REFUSED_MS : status === 429 ? COOL_OFF_MS : undefined;
  if (!ms) return undefined;
  fs.mkdirSync(stateDir, { recursive: true });
  const file = stateFile(stateDir, host);
  const release = acquireLock(`${file}.lock`, { owner: "strom net", waitMs: 10 * 60_000, staleMs: 10 * 60_000 });
  try {
    const s = hostState(stateDir, host, now());
    const reason = status === 429 ? `it asked the browser to slow down (HTTP 429 at ${when(now())})` : `it refused the browser (HTTP ${status} at ${when(now())})`;
    s.blockedUntil = Math.max(s.blockedUntil ?? 0, now() + ms);
    s.reason = reason;
    writeJson(file, s);
    return `${host}: ${reason} — strom leaves it alone until ${when(s.blockedUntil)}`;
  } finally {
    release();
  }
}

/** Why a host takes no request of another program now: left alone (a refusal, silence), its own limit, its hourly cap. */
export interface HostRefusal {
  why: "blocked" | "limit" | "cap";
  until: number;
  reason?: string;
  perHour?: number;
}

/** What `inside` is told under the host's lock: a refusal of the host, and when the request's slot of its pace would be. */
export interface AgentSlot {
  refused: HostRefusal | undefined;
  /** How long the request would wait for the host's pace (ms): its slot is now + this. */
  waitMs: number;
  /**
   * The slot is later than `maxWaitMs`: no slot of the pace is reserved — taken by `inside`, the request goes at the end
   * of the call's wait (`maxWaitMs` from its start), counted in the host's hour, its pace not kept.
   */
  late: boolean;
}

/**
 * A request another program makes to a host — an agent's own web tool (core/web.ts) — kept like strom's own, in the
 * host's state shared by every strom process. The host's lock is held only for a moment, to reserve: refused while the
 * host is left alone (401/403/429, silence), while it says its limit is used up, and when its hourly cap (the user's,
 * the service's) is full; else `inside` decides (false: nothing taken) knowing the slot the host's pace gives the
 * request (the host's last slot + its pause), and a request taken has that slot reserved — counted in the host's hour
 * and its last slot moved — and `after` told, all before the lock is let go; only then it waits until its slot, outside
 * the lock, so many requests at once are each counted and spaced by the pace. A slot later than `maxWaitMs` from the
 * call's start (the wait for the lock with it) is `late`:
 * never reserved — the caller says no, or takes it to go at the end of the call's wait, counted in the hour. `wait:
 * false` (a request that went out already): counted now, no slot. The locks (the host's, then the site's) not had within
 * `lockWaitMs` together: the lock's error is thrown (LockedError — the caller decides).
 *
 * `site`: the requests of the host's whole site (its registrable domain, the host's mirrors with it) kept together too —
 * its own state (a file of its own beside the hosts'), its lock taken under the host's (always in that order: no lock
 * of a host is ever waited for under a site's), so whatever `site.gapMs()` and `inside` read there holds for every host
 * of the site; `site.gapMs()` (read under both locks): a pause the site's requests keep between them besides the host's
 * pace (0: none) — the slot is the later of the two; every request taken moves the site's last slot.
 */
export async function agentRequest<T>(
  stateDir: string,
  host: string,
  asked: ServicePace | undefined,
  o: {
    inside: (slot: AgentSlot) => { take: boolean; value: T };
    /** Told with the lock still held, once the request is counted (or not): the pause it will make for the host's pace. */
    after?: (value: T, waitedMs: number) => void;
    maxWaitMs: number;
    /** False: the request went out already — counted now, never waited for. */
    wait?: boolean;
    lockWaitMs: number;
    site?: { key: string; gapMs: () => number };
    /**
     * The host's state found broken: the times of its requests in the last hour as the caller's own journal tells them
     * (ms), put into the fresh state written at once — the hour and the pace go on from what is known.
     */
    recover?: (now: number) => number[];
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<{ value: T; waitedMs: number }> {
  const now = o.now ?? testHooks.now ?? Date.now;
  const sleep = o.sleep ?? testHooks.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  fs.mkdirSync(stateDir, { recursive: true });
  const file = stateFile(stateDir, host);
  const wait = o.wait !== false;
  let value: T;
  let waitedMs = 0;
  // the wait for the host's turn counts in the call's wait too
  const begun = now();
  // (a host's lock is held for one request with its pauses — minutes at most: one older is left by a process gone)
  const lockOpts = { owner: "strom net", waitMs: testHooks.lockWaitMs ?? o.lockWaitMs, staleMs: 10 * 60_000, maxAgeMs: HOST_LOCK_MAX_AGE_MS };
  // (the locks' wait on the real clock, as acquireLock waits: the host's and the site's together within lockWaitMs)
  const lockBegun = Date.now();
  const release = acquireLock(`${file}.lock`, lockOpts);
  let releaseSite: (() => void) | undefined;
  try {
    const siteFile = o.site ? siteStateFile(stateDir, o.site.key) : undefined;
    if (siteFile) releaseSite = acquireLock(`${siteFile}.lock`, { ...lockOpts, waitMs: Math.max(0, lockOpts.waitMs - (Date.now() - lockBegun)) });
    // a site's state that cannot be read: a fresh one (written below with the request's slot, or now)
    const t = now();
    let siteBroken = false;
    let site: { last?: number } | undefined;
    if (siteFile) {
      try {
        const v = readJsonIfExists<{ last?: number }>(siteFile);
        site = v && typeof v === "object" && !Array.isArray(v) ? v : {};
        siteBroken = v !== undefined && site !== v;
        // its last slot as agentRequest writes it: within the call's wait, never a time strom does not write
        if (site.last !== undefined && !stateTime(site.last, t, Math.max(o.maxWaitMs, MAX_WAIT_MS))) {
          site = { ...site };
          delete site.last;
          siteBroken = true;
        }
      } catch {
        site = {};
        siteBroken = true;
      }
    }
    const { state: s, broken, timesLost } = readHostState(stateDir, host, t);
    if (timesLost) {
      // the hour's times from what the journal tells, with those that could be read
      const known = (o.recover?.(t) ?? []).filter((x) => Number.isFinite(x) && x > t - 3600_000 && x <= t + SLOTS_AHEAD_MS);
      s.recent = [...new Set([...s.recent, ...known])].sort((a, b) => a - b);
      if (s.recent.length) s.last = Math.max(s.last ?? 0, ...s.recent);
    }
    const pace = hostPace(s, asked);
    s.recent = s.recent.filter((x) => x > t - 3600_000);
    const refused: HostRefusal | undefined =
      s.blockedUntil && s.blockedUntil > t
        ? { why: "blocked", until: s.blockedUntil, ...(s.reason ? { reason: s.reason } : {}) }
        : s.waitUntil && s.waitUntil > t
          ? { why: "limit", until: s.waitUntil }
          : s.recent.length >= pace.perHour
            ? { why: "cap", until: capFree(s.recent, pace.perHour), perHour: pace.perHour }
            : undefined;
    // the request's slot: the host's last one (strom's own, another agent's, one reserved and not yet gone) + its pause
    const siteGap = site && wait ? o.site!.gapMs() : 0;
    const slot = wait ? Math.max(t, (s.last ?? 0) + gapOf(s, pace), siteGap > 0 ? (site!.last ?? 0) + siteGap : 0) : t;
    const late = wait && slot - begun > o.maxWaitMs;
    const decided = o.inside({ refused, waitMs: Math.round(slot - t), late });
    value = decided.value;
    if (decided.take && !refused) {
      // a late one goes at the end of the call's wait: in the hour, no slot of the pace (the later slots stay theirs)
      const at = late ? Math.max(t, begun + o.maxWaitMs) : slot;
      waitedMs = Math.round(at - t);
      s.last = Math.max(s.last ?? 0, at);
      s.recent.push(at);
      writeJson(file, s);
      if (siteFile) writeJson(siteFile, { ...site, last: Math.max(site!.last ?? 0, at) });
    } else {
      // nothing taken: a broken state is put right all the same, from what is known
      if (broken) writeJson(file, s);
      if (siteFile && siteBroken) writeJson(siteFile, site);
    }
    o.after?.(value, waitedMs);
  } finally {
    releaseSite?.();
    release();
  }
  // the pause for the pace, with the host let go: the next request reserves its own slot after this one meanwhile
  if (waitedMs > 0) await sleep(waitedMs);
  return { value, waitedMs };
}

/** A GET — see politeRequest. */
export function politeGet(url: string, opts: NetOptions): Promise<NetResponse> {
  return politeRequest(url, { ...opts, method: "GET" });
}
