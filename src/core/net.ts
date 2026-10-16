// The polite network layer every connector goes through. One request at a time
// per host with a pause between requests and an hourly cap — shared by every
// strom process on this computer (state in <shared>/net/). No limit is made
// up: the pace is the service's (its connector says it, and where the service
// states it) or strom's default pause, or the user's own for the host; an
// hourly cap only where the service or the user sets one. The host's answers
// steer it: slower while it answers slowly, a wait when it says its limit is
// used up (RateLimit headers, Retry-After). An archive that asks
// us to slow down (429) gets one more try after the wait it asks for, then an
// hour off; one that refuses (401/403) is left alone for a day — and one that
// refuses strom's client itself (the first request of a run, a second day too)
// until the person lifts it; one that does
// not answer at all is treated the same way: silence from a live server is
// how a firewall block looks. Repeating a refused request is the quickest way
// from "slow down" to a blocked IP — for the user, and for every other
// genealogist behind it. strom reads a host's robots.txt itself, at most once a
// day and only when a request goes to the host anyway: the paths it keeps
// automated tools off are not asked, its Crawl-delay is a floor of the pace.

import fs from "node:fs";
import path from "node:path";
import { StromError } from "./errors.ts";
import { acquireLock } from "./lock.ts";
import { readJsonIfExists, writeJson } from "./json.ts";
import { VERSION } from "./tree.ts";
import { fetchH2, type H2Init } from "./http2.ts";
import { knownDisallow, knownPaceMs, loopbackGuard } from "./knownterms.ts";
import dns from "node:dns";
import { isIP } from "node:net";

export interface Pace {
  /** Pause between two requests to one host. */
  minIntervalMs: number;
  /** Requests to one host in any hour. */
  perHour: number;
}

/** strom's own pace for a host whose service says nothing: a pause, no hourly cap. */
export const DEFAULT_PACE: Pace = { minIntervalMs: 2000, perHour: Infinity };
/**
 * A person's pace, for the images of an archive whose terms restrict automated access (core/terms.ts), with the
 * person's permission "slowly": one image at most every 10 s, at most 120 an hour — part of what the person allows
 * (the window and the menu say it), never made faster by strom. The person's own pace for the host comes first.
 */
export const HUMAN_PACE: Pace = { minIntervalMs: 10_000, perHour: 120 };
/** The shortest pause there is — a service's, or the user's for a host. */
export const MIN_INTERVAL_MS = 250;

/** The pace a connector gives for its service (connector.json policy.pace): faster than strom's default only with where the service says so. */
export interface ServicePace extends Partial<Pace> {
  /** Where the service states its limits (its API documentation, its terms): a URL or a sentence. */
  source?: string;
}
/** How long a host that refused us (401/403) is left alone. */
export const REFUSED_MS = 24 * 3600_000;
/**
 * A host that refused strom's client itself is left alone until the person lifts it: its blockedUntil this far ahead
 * (an older strom keeps it too — it keeps a wait however far ahead it lies).
 */
export const REFUSED_FOREVER = Date.UTC(9999, 11, 31);
/** How long strom keeps a host's robots.txt before it reads it again (on a day a request goes there anyway). */
export const ROBOTS_MS = 24 * 3600_000;
/** The most of a robots.txt read (RFC 9309: at least 500 KiB). */
const ROBOTS_MAX = 512 * 1024;
/** The product token strom's robots.txt groups are matched by (its User-Agent begins with it). */
export const ROBOTS_TOKEN = "strom-research";
/**
 * The robots.txt product tokens of the agents' own web tools, as they send them: Claude Code's WebFetch identifies as
 * Claude-User (Anthropic's user-initiated fetcher, which honours robots.txt; a group for ClaudeBot, the training
 * crawler, is not one for it) — Claude-Web and Claude-Code taken as its too, the gentle side. Grok's web_fetch says
 * no token strom knows: strom's own groups and those for every robot (*) hold for it.
 */
export const AGENT_TOOL_TOKENS: Record<string, readonly string[]> = { claude: ["claude-user", "claude-web", "claude-code"], grok: [] };
/** The longest strom waits by itself (an hourly cap, a Retry-After) before it gives up for now — unless its caller waits longer (waitMs). */
export const MAX_WAIT_MS = 2 * 60_000;
/** An hour off after a host kept asking us to slow down, or stopped answering. */
export const COOL_OFF_MS = 3600_000;
const TIMEOUT_MS = 60_000;
/** Attempts per request: a busy server (5xx) a few, "slow down" (429) and silence only one more. */
const ATTEMPTS = { busy: 3, slowDown: 2, silent: 2 };

export const USER_AGENT = `strom-research/${VERSION} (genealogy research; one request at a time, paced)`;

export type NetFailure = "host" | "refused" | "blocked" | "cap" | "http" | "silent" | "robots";

/**
 * Why a host refused (401/403): client — it refused strom's client itself (the first request of a run refused a second
 * day too): left alone until the person lifts it; first — the first request of
 * a run refused once: a day, and a second such day makes it client; load — refused after strom's requests: a day;
 * login — 401 to a connector with a login: the login ran out, a day.
 */
export type RefusedKind = "client" | "first" | "load" | "login";
export const REFUSED_KINDS: readonly RefusedKind[] = ["client", "first", "load", "login"];

/** One group of a robots.txt that applies to strom (User-agent strom-research or *). */
export interface RobotsGroup {
  agents: string[];
  allow: string[];
  disallow: string[];
  /** Crawl-delay, seconds. */
  crawlDelay?: number;
}

/** A host's robots.txt as strom read it: when, its status (0: no answer), the groups that apply to strom. */
export interface RobotsState {
  at: number;
  status: number;
  groups: RobotsGroup[];
  /**
   * The groups of the agents' own web tools (AGENT_TOOL_TOKENS: Claude Code's WebFetch is Claude-User), kept beside
   * strom's: the tree's hook keeps an agent's web fetch to them too (core/webgate.ts). An older strom keeps them as they are.
   */
  tools?: RobotsGroup[];
  /** Where it was read (scheme, host, port): read there again. */
  origin?: string;
}

/** What strom read or decided of a host, told to the caller to keep it beside the person's settings (core/terms.ts). */
export interface NetVerdict {
  host: string;
  robots?: RobotsState;
  refused?: { kind: RefusedKind; status: number; until: number; at: number };
}

export class NetError extends StromError {
  readonly failure: NetFailure;
  readonly host: string;
  readonly status: number | undefined;
  /** A limit used up: when the host takes requests again (ms). */
  readonly until: number | undefined;
  /** A refusal of the host (refused, or left alone after one: blocked): why. */
  refusedKind?: RefusedKind;
  /** A path robots.txt keeps automated tools off: its line, the path, whether it is the whole site. */
  robots?: { line: string; path: string; all: boolean };

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
  /** Its robots.txt as strom last read it. */
  robots?: RobotsState;
  /** Why it was left alone, when a refusal (401/403) did it. */
  refusedKind?: RefusedKind;
  /** The first request of a run refused (once): a second such refusal on another day is a refusal of the client. */
  refusedFirst?: { at: number };
  /** When it last answered strom's request (not its robots.txt) with 2xx. */
  okAt?: number;
  /** Since when strom counts its answers (okAt): from its first request. A host met before has none — met before, answered. */
  tracked?: number;
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
  /**
   * A person's pace (core/terms.ts humanPace): images of a restricted archive. The pause is the longer of the
   * person's own for the host (else this one) and the service's; the hourly cap the smaller of the person's own (else
   * this one) and the service's — counted over every request to the host, its catalogue and robots.txt too (Milan,
   * 2026-10-11: never a cap raised).
   */
  human?: Pace;
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
  /**
   * Read the host's robots.txt first (at most once a day; a connector's, a test's and a probe's requests): the paths it
   * keeps automated tools off are not asked, its Crawl-delay is a floor of the pace.
   */
  robots?: boolean;
  /** robots: the robots.txt strom reads itself before a host's first request of the day — no robots read before it, no retries. */
  purpose?: "robots";
  /**
   * The hosts one run has sent a request to (its robots.txt aside): a refusal of its first request to a host may be one
   * of strom's client, of a later one never. None: every request is the first of its own run (a probe).
   */
  run?: Set<string>;
  /** The connector has a login: a 401 means it ran out, never a refusal of strom's client. */
  login?: boolean;
  /**
   * The person's permission for the host's archive (images slowly): a path its robots.txt keeps automated tools off may
   * be asked, at this pace — never when it keeps them off the whole site (only a person's browser goes there).
   */
  robotsPermit?: Pace;
  /** Told of what strom read and decided of a host (its robots.txt, a refusal) — to keep it beside the person's settings. */
  onVerdict?: (v: NetVerdict) => void;
  /**
   * A connector's run (strom fetch): in the foreground its requests go first — a fetch in the background (strom fetch
   * --background) waits at the host while one in the foreground asks it, told by onYield (true: waits, false: goes on).
   * None: neither (a probe, a robots.txt).
   */
  lane?: "foreground" | "background";
  onYield?: (waiting: boolean) => void;
  /** The run is stopped: a fetch in the background that waits for the foreground asks nothing more. */
  stop?: AbortSignal;
}

/**
 * A fetch in the foreground holds a host this long after its last request (a mark beside the host's state, renewed
 * with each request, gone when its run ends): a fetch in the background asks the host nothing meanwhile — the person
 * or the agent waits for the foreground, the background has time.
 */
export const FOREGROUND_HOLD_MS = 30_000;
/** How often a fetch in the background looks whether the foreground let the host go. */
const YIELD_LOOK_MS = 500;

const foregroundMarks = new Set<string>();

function foregroundMark(file: string, pid = process.pid): string {
  return `${file}.fg-${pid}`;
}

function holdForeground(file: string): void {
  const mark = foregroundMark(file);
  try {
    fs.writeFileSync(mark, "");
    if (!foregroundMarks.size) process.once("exit", releaseForeground);
    foregroundMarks.add(mark);
  } catch {
    // not marked: the background is not held back by this request
  }
}

/** A connector's run in the foreground is over: its hosts are let go at once (not FOREGROUND_HOLD_MS later). */
export function releaseForeground(): void {
  for (const mark of foregroundMarks) fs.rmSync(mark, { force: true });
  foregroundMarks.clear();
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Another strom fetches from the host in the foreground now (a mark of a live process, renewed lately). */
function foregroundAtHost(file: string): boolean {
  const base = `${path.basename(file)}.fg-`;
  let names: string[];
  try {
    names = fs.readdirSync(path.dirname(file));
  } catch {
    return false;
  }
  let held = false;
  for (const name of names) {
    if (!name.startsWith(base)) continue;
    const pid = Number(name.slice(base.length));
    const mark = path.join(path.dirname(file), name);
    if (!Number.isInteger(pid) || pid <= 0 || !pidAlive(pid)) {
      fs.rmSync(mark, { force: true });
      continue;
    }
    if (pid === process.pid) continue;
    try {
      if (Date.now() - fs.statSync(mark).mtimeMs < FOREGROUND_HOLD_MS) held = true;
    } catch {
      continue;
    }
  }
  return held;
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
export function hostPace(s: HostState, asked?: ServicePace, human?: Pace, host?: string): Pace {
  const p = basePace(s, asked, human);
  // the site's own Crawl-delay (as strom read it, and as strom's known terms of the archive keep it): a floor — slower only
  const crawl = Math.max(robotsDelayMs(s.robots), host ? knownPaceMs(host) : 0);
  return crawl > p.minIntervalMs ? { ...p, minIntervalMs: crawl } : p;
}

/**
 * Whether a person's own pace for a host (strom allow host --pace, kept in the shared folder) is taken as given: not
 * where an agent's command runs with settings or a shared folder not verified as the person's (core/trust.ts) — there
 * only where it is slower. Set by the command that goes to an archive, before its first request.
 */
export const netTrust: { ownPace: boolean } = { ownPace: true };

function basePace(s: HostState, asked?: ServicePace, human?: Pace): Pace {
  const p = paceWithOwn(s, asked, human);
  if (netTrust.ownPace || !s.own) return p;
  // the person's own only where it is slower than what holds without it
  const without = paceWithOwn({ ...s, own: undefined }, asked, human);
  return { minIntervalMs: Math.max(p.minIntervalMs, without.minIntervalMs), perHour: Math.min(p.perHour, without.perHour) };
}

function paceWithOwn(s: HostState, asked?: ServicePace, human?: Pace): Pace {
  const service = asked?.minIntervalMs !== undefined && (asked.minIntervalMs >= DEFAULT_PACE.minIntervalMs || asked.source?.trim()) ? asked.minIntervalMs : DEFAULT_PACE.minIntervalMs;
  if (human) {
    // a person's pace: never faster than the service's; the person's own for the host in place of strom's 10 s / 120
    const minIntervalMs = Math.max(MIN_INTERVAL_MS, s.own?.minIntervalMs ?? human.minIntervalMs, service);
    const own = s.own?.perHour !== undefined ? s.own.perHour || Infinity : human.perHour;
    const perHour = Math.min(own, asked?.perHour && asked.perHour > 0 ? asked.perHour : Infinity);
    return { minIntervalMs, perHour };
  }
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
  if (has("robots") && !robotsShape(raw.robots)) drop("robots");
  if (has("refusedKind") && !REFUSED_KINDS.includes(raw.refusedKind as RefusedKind)) drop("refusedKind");
  if (has("refusedFirst") && !(raw.refusedFirst && typeof raw.refusedFirst === "object" && until((raw.refusedFirst as { at?: unknown }).at))) drop("refusedFirst");
  if (has("okAt") && !until(raw.okAt)) drop("okAt");
  if (has("tracked") && !until(raw.tracked)) drop("tracked");
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
  delete s.refusedKind;
  delete s.refusedFirst;
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

/** A moment as the clock on the wall shows it here, with its day ("2026-10-11 14:32"): kept in a reason, read on another day. */
export function stamp(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Until when a host is left alone, in words: a time, or until the person lifts it (a refusal of strom's client). */
export function leftUntil(host: string, until: number): string {
  return until >= REFUSED_FOREVER ? `until the person lifts it (strom allow host ${host} --unblock)` : `until ${clock(until)}`;
}

/**
 * The groups of a robots.txt that apply to strom: User-agent strom-research (its product token, any case, a version
 * after it) and * — both, the stricter way. Comments, unknown lines and rules before any User-agent are left out.
 */
export function parseRobots(text: string): RobotsGroup[] {
  return parseGroups(text, (a) => a === "*" || a.split("/")[0]!.trim() === ROBOTS_TOKEN);
}

/** The groups of a robots.txt for the agents' own web tools (AGENT_TOOL_TOKENS), each with the tokens it names. */
export function parseToolRobots(text: string): RobotsGroup[] {
  const tokens = new Set(Object.values(AGENT_TOOL_TOKENS).flat());
  return parseGroups(text, (a) => tokens.has(a.split("/")[0]!.trim()));
}

function parseGroups(text: string, ours: (agent: string) => boolean): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let cur: RobotsGroup | undefined;
  let agentLine = false;
  for (const raw of text.slice(0, ROBOTS_MAX).split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*$/u, "").trim();
    const m = /^([^:]+):(.*)$/u.exec(line);
    if (!m) continue;
    const key = m[1]!.trim().toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!cur || !agentLine) groups.push((cur = { agents: [], allow: [], disallow: [] }));
      cur.agents.push(value.toLowerCase());
      agentLine = true;
      continue;
    }
    agentLine = false;
    if (!cur) continue;
    if (key === "disallow" && value) cur.disallow.push(value);
    else if (key === "allow" && value) cur.allow.push(value);
    else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) cur.crawlDelay = Math.max(cur.crawlDelay ?? 0, n);
    }
  }
  return groups.filter((g) => g.agents.some(ours)).map((g) => ({ ...g, agents: g.agents.filter(ours) }));
}

function robotsShape(v: unknown): v is RobotsState {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  const strings = (x: unknown) => Array.isArray(x) && x.every((y) => typeof y === "string");
  return (
    typeof r.at === "number" &&
    Number.isFinite(r.at) &&
    typeof r.status === "number" &&
    Array.isArray(r.groups) &&
    (r.groups as unknown[]).every((g) => !!g && typeof g === "object" && strings((g as RobotsGroup).agents) && strings((g as RobotsGroup).allow) && strings((g as RobotsGroup).disallow)) &&
    (r.tools === undefined ||
      (Array.isArray(r.tools) && (r.tools as unknown[]).every((g) => !!g && typeof g === "object" && strings((g as RobotsGroup).agents) && strings((g as RobotsGroup).allow) && strings((g as RobotsGroup).disallow))))
  );
}

/** A rule's path as a pattern (RFC 9309: * any characters, $ the end), matched from the start of the path. */
function ruleMatches(rule: string, target: string): boolean {
  const end = rule.endsWith("$");
  const body = (end ? rule.slice(0, -1) : rule).split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}${end ? "$" : ""}`, "su").test(target);
}

/**
 * What robots.txt says of a path (with its query): allowed, or the line that keeps automated tools off it — the
 * longest rule that matches wins, Allow at a tie (RFC 9309); `all`: the whole site (Disallow: / and nothing allowed).
 * /robots.txt itself is always allowed. No robots.txt read: nothing said.
 */
export function robotsVerdict(r: RobotsState | undefined, target: string): { allowed: boolean; line?: string; all?: boolean } {
  if (!r || target === "/robots.txt") return { allowed: true };
  const all = robotsAll(r);
  if (all) return { allowed: false, line: all, all: true };
  let best: { len: number; allow: boolean; rule: string } | undefined;
  for (const g of r.groups)
    for (const [rules, allow] of [[g.allow, true], [g.disallow, false]] as const)
      for (const rule of rules)
        if (ruleMatches(rule, target) && (!best || rule.length > best.len || (rule.length === best.len && allow))) best = { len: rule.length, allow, rule };
  return !best || best.allow ? { allowed: true } : { allowed: false, line: `Disallow: ${best.rule}` };
}

/**
 * What robots.txt says of a path for an agent's own web tool (its tokens, AGENT_TOOL_TOKENS): the groups that name the
 * tool, with strom's own (a site that keeps strom off keeps the agent's tool off too) — else, none naming it, those
 * for every robot (*) with strom's, as for strom (RFC 9309: a robot follows the group of its token, else *).
 */
export function toolRobotsVerdict(r: RobotsState | undefined, target: string, tokens: readonly string[]): { allowed: boolean; line?: string; all?: boolean } {
  if (!r) return { allowed: true };
  const tool = (r.tools ?? []).filter((g) => g.agents.some((a) => tokens.includes(a.split("/")[0]!.trim())));
  const groups = tool.length ? [...tool, ...r.groups.filter((g) => g.agents.some((a) => a !== "*"))] : r.groups;
  return robotsVerdict({ ...r, groups }, target);
}

/** The line of a robots.txt that keeps automated tools off the whole site: Disallow: / (or /*) with no Allow in its groups. */
export function robotsAll(r: RobotsState | undefined): string | undefined {
  if (!r || !r.groups.length) return undefined;
  const hit = r.groups.find((g) => g.disallow.some((d) => d === "/" || d === "/*"));
  if (!hit || r.groups.some((g) => g.allow.some((a) => a !== "/robots.txt"))) return undefined;
  return `Disallow: ${hit.disallow.find((d) => d === "/" || d === "/*")}`;
}

/** The longest Crawl-delay of the groups that apply to strom (ms; 0: none). */
export function robotsDelayMs(r: RobotsState | undefined): number {
  return Math.max(0, ...(r?.groups ?? []).map((g) => (g.crawlDelay ?? 0) * 1000));
}

/** Two moments on the same day of the clock on the wall here. */
function sameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/**
 * Why a host refused (401/403) — see RefusedKind. The first request of a run refused is a day's pause, also from a
 * host that never answered strom (one 403 of a firewall or an outage blocks nobody for good); the client only when it
 * is refused so again on another day. A 401 to a connector with a login is never one of the client.
 */
export function refusalKind(s: HostState, status: number, o: { first: boolean; login: boolean }, now: number): RefusedKind {
  if (status === 401 && o.login) return "login";
  if (!o.first) return "load";
  if (s.refusedFirst && !sameDay(s.refusedFirst.at, now)) return "client";
  return "first";
}

/** A refusal in words for the agent: what happened, and what strom does now. */
function refusalText(host: string, status: number, kind: RefusedKind, s: HostState): { message: string; hint: string } {
  if (kind === "client")
    return {
      message: `${host} refused strom's client on the first request, a second day too (HTTP ${status}; no load from strom): the site does not let automated tools in — not a block for too many requests. strom leaves it alone until the person lifts it`,
      hint: `do not try it through your web tools or a browser either; only the person lifts it: strom allow host ${host} --unblock`,
    };
  if (kind === "first")
    return {
      message: `${host} refused strom's first request (HTTP ${status}) — strom leaves it alone for a day; refused so again on another day, it is left alone until the person lifts it`,
      hint: "an archive that refuses may block the IP next: leave it alone for a day — stop, check its terms",
    };
  if (kind === "login")
    return {
      message: `${host} answered 401 — the login has most likely run out; strom leaves it alone for a day`,
      hint: `the person saves the login again in their own terminal (strom login <connector>) and lifts the pause: strom allow host ${host} --unblock`,
    };
  return { message: `${host} answered ${status} — strom stops and leaves it alone for a day`, hint: "an archive that refuses may block the IP next: stop, check its terms, ask it" };
}

/** A NetError with the refusal's kind (or robots' line) on it. */
function netError(failure: NetFailure, host: string, message: string, hint: string | undefined, status: number | undefined, extra: { refusedKind?: RefusedKind | undefined; robots?: NetError["robots"]; until?: number } = {}): NetError {
  const e = new NetError(failure, host, message, hint, status, extra.until);
  if (extra.refusedKind) e.refusedKind = extra.refusedKind;
  if (extra.robots) e.robots = extra.robots;
  return e;
}

/** A host left alone (a refusal, silence, "slow down"): what strom says of a request it does not send. */
function blockedError(host: string, s: HostState): NetError {
  const until = s.blockedUntil!;
  return netError("blocked", host, `${host}: ${s.reason ?? "refused us"} — left alone ${leftUntil(host, until)}`, until >= REFUSED_FOREVER ? `do not try it through your web tools or a browser either; only the person lifts it: strom allow host ${host} --unblock` : `do not retry: go on with other work; the user can lift it early with strom allow host ${host} --unblock`, undefined, { refusedKind: s.refusedKind, until });
}
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

/** A verdict told to the caller's keeper; whatever it does, the request goes on. */
function told(opts: NetOptions, v: NetVerdict): void {
  try {
    opts.onVerdict?.(v);
  } catch {
    // keeping it beside the settings is no reason to fail
  }
}

/**
 * A host's robots.txt for a request to it: the one kept when read within ROBOTS_MS, else read now — one request,
 * paced and counted as any (politeRequest, purpose robots), on a day a request goes to the host anyway. 2xx: its
 * groups for strom; 404 and 410: nothing kept off; anything else (5xx, 401/403, no answer, another status): unknown —
 * what was known before stays, nothing new decided: a refusal of robots.txt alone is no refusal of strom's client and
 * no pause (some archives answer 403 there to everybody) — the next real request decides.
 */
async function readRobots(u: URL, opts: NetOptions): Promise<RobotsState | undefined> {
  const now = opts.now ?? testHooks.now ?? Date.now;
  const host = u.hostname;
  const kept = hostState(opts.stateDir, host, now()).robots;
  if (kept && now() - kept.at < ROBOTS_MS && kept.at <= now() + STATE_MARGIN_MS) return kept;
  let got: RobotsState;
  const at = now();
  try {
    const { onRequest: _, ...rest } = opts;
    const res = await politeRequest(`${u.origin}/robots.txt`, { ...rest, purpose: "robots", method: "GET", headers: {}, body: undefined, private: { headers: [], body: false } });
    if (res.status >= 200 && res.status < 300) {
      const text = res.body.toString("utf8");
      const tools = parseToolRobots(text);
      got = { at, status: res.status, groups: parseRobots(text), ...(tools.length ? { tools } : {}), origin: u.origin };
    }
    else if (res.status === 404 || res.status === 410) got = { at, status: res.status, groups: [], origin: u.origin };
    else got = { groups: [], ...kept, at, status: res.status, origin: u.origin };
  } catch (err) {
    if (!(err instanceof NetError)) throw err;
    // left alone, its hourly cap: the request itself would meet the same
    if (err.failure === "blocked" || err.failure === "cap") throw err;
    got = { groups: [], ...kept, at, status: err.status ?? 0, origin: u.origin };
  }
  const file = stateFile(opts.stateDir, host);
  const release = acquireLock(`${file}.lock`, { owner: "strom net", waitMs: 10 * 60_000, staleMs: 10 * 60_000 });
  try {
    const cur = hostState(opts.stateDir, host, now());
    cur.robots = got;
    writeJson(file, cur);
  } finally {
    release();
  }
  told(opts, { host, robots: got });
  return got;
}

/**
 * A host whose "allowed" came from a test's own list of terms (STROM_ARCHIVES_FILE: only for this computer itself) is
 * asked only while its name still leads to this computer: resolved again before each request (a redirect's too) and
 * refused when any address is another — a name that resolved to 127.0.0.1 when the level was decided and elsewhere
 * now (DNS rebinding) is no way to an archive. What stays (said in the connectors' README): the moment between this
 * lookup and the connection's own.
 */
async function loopbackOnly(host: string): Promise<void> {
  if (!loopbackGuard.hosts.size) return;
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (![...loopbackGuard.hosts].some((x) => h === x || h.endsWith(`.${x}`))) return;
  let all: string[];
  try {
    all = isIP(h) ? [h] : loopbackGuard.lookup ? loopbackGuard.lookup(h) : (await dns.promises.lookup(h, { all: true })).map((a) => a.address);
  } catch {
    all = [];
  }
  const loop = (a: string) => {
    const v4 = a.replace(/^::ffff:/i, "");
    return (/^\d+\.\d+\.\d+\.\d+$/.test(v4) && v4.startsWith("127.")) || a === "::1";
  };
  if (!all.length || !all.every(loop))
    throw new NetError("host", host, `${host} no longer leads to this computer (${all.join(", ") || "not resolved"}) — its "allowed" of a test's own list holds only there`, "a test's list of terms allows only this computer itself");
}

/** A host's robots.txt read now if strom's copy is older than a day (an archive only a browser goes to: strom's one request there). */
export function robotsNow(origin: string, opts: NetOptions): Promise<RobotsState | undefined> {
  return readRobots(new URL(origin), opts);
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
  await loopbackOnly(host);
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
  const robotsAsked = opts.purpose === "robots";
  // the person's pace for this request: images of a restricted archive, or a path robots.txt keeps tools off (permitted)
  let human = opts.human;
  // (a request of /robots.txt itself — a probe — is that read, never one more before it)
  if (!robotsAsked && opts.robots && !(u.pathname === "/robots.txt" && !u.search)) {
    // the site's robots.txt first (read at most once a day): a path it keeps automated tools off is not asked
    const read = await readRobots(u, opts);
    // the paths strom's known terms of the archive keep automated requests off too (its robots.txt as checked)
    const known = knownDisallow(host);
    const robots: RobotsState | undefined = known.length ? { at: read?.at ?? 0, status: read?.status ?? 200, groups: [...(read?.groups ?? []), { agents: ["*"], allow: [], disallow: known }] } : read;
    const target = `${u.pathname}${u.search}`;
    const v = robotsVerdict(robots, target);
    if (!v.allowed) {
      if (v.all || !opts.robotsPermit)
        throw netError(
          "robots",
          host,
          v.all
            ? `${host}/robots.txt keeps automated tools off the whole site ("${v.line}") — strom asked it nothing: no direct request, only a person's browser`
            : `${host}/robots.txt keeps automated tools off ${target} ("${v.line}") — strom did not ask it`,
          v.all ? "by hand, or through the person's own browser with their permission (a connector with browser pages)" : `by hand, or the person's decision: strom allow archive ${host} --way slow`,
          undefined,
          { robots: { line: v.line!, path: target, all: !!v.all } },
        );
      human = opts.human ?? opts.robotsPermit;
    }
  }
  const attempts = robotsAsked ? { busy: 1, slowDown: 1, silent: 1 } : ATTEMPTS;
  const tries = { busy: 0, slowDown: 0, silent: 0 };
  let upgraded = false;
  let pace = hostPace(hostState(opts.stateDir, host, now()), opts.pace, human, host);
  // how long this request may wait for a limit used up, all waits together
  const waitBy = now() + Math.max(MAX_WAIT_MS, opts.waitMs ?? MAX_WAIT_MS);
  let waitedOutside = 0;

  for (;;) {
    // A fetch in the foreground first: the background waits while one asks this host (real time, never a test's clock).
    if (opts.lane === "foreground") holdForeground(file);
    else if (opts.lane === "background" && foregroundAtHost(file)) {
      let told = 0;
      while (foregroundAtHost(file)) {
        if (opts.stop?.aborted) throw new NetError("http", host, "stopped while a fetch in the foreground asked the host");
        // said now and then while it waits: a reader of the book knows it is alive
        if (Date.now() - told >= FOREGROUND_HOLD_MS) (opts.onYield?.(true), (told = Date.now()));
        await new Promise<void>((r) => setTimeout(r, YIELD_LOOK_MS));
      }
      opts.onYield?.(false);
    }
    // One request at a time per host, across processes: the lock is held from the pause to the answer.
    const release = acquireLock(`${file}.lock`, { owner: "strom net", waitMs: 10 * 60_000, staleMs: 10 * 60_000 });
    let res: Response | undefined;
    let failed: unknown;
    let slowed = false;
    let viaH2 = false;
    let took = 0;
    let outside: WaitOutside | undefined;
    let refusedAs: RefusedKind | undefined;
    let refusedState: HostState | undefined;
    try {
      const fresh = !fs.existsSync(file);
      let s = hostState(opts.stateDir, host, now());
      // a host strom meets first now: its answers counted from its first request (a refusal of the client known by them)
      if (fresh) s.tracked = now();
      pace = hostPace(s, opts.pace, human, host);
      slowed = (s.slowdown ?? 1) > 1;
      const t = now();
      if (s.blockedUntil && s.blockedUntil > t) throw blockedError(host, s);
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
      // a pause longer than the caller waits (a site's long Crawl-delay): said when to come back, never sooner
      if (gap > MAX_WAIT_MS && now() + gap > waitBy)
        throw new NetError("cap", host, `${host}'s pace (${paceText(pace)}${robotsDelayMs(s.robots) >= pace.minIntervalMs ? ", its robots.txt's Crawl-delay" : ""}) — the next request at ${clock(now() + gap)}`, `go on with other work; run it again at ${clock(now() + gap)} — not sooner`, undefined, now() + gap);
      if (gap > 0) {
        paused(opts, { host, ms: gap, why: "pace" });
        await sleep(gap);
      }
      s.last = now();
      s.recent.push(s.last);
      writeJson(file, s);
      // the run's first request to the host (its robots.txt aside): only its refusal may be one of strom's client
      const first = !opts.run?.has(host);
      if (!robotsAsked) opts.run?.add(host);
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
      const cool = (ms: number, reason: string, kind?: RefusedKind) => {
        s = hostState(opts.stateDir, host, now());
        s.blockedUntil = kind === "client" ? REFUSED_FOREVER : now() + ms;
        s.reason = reason;
        if (kind) s.refusedKind = kind;
        else delete s.refusedKind;
        // the first request refused once: a second such refusal on another day is one of the client
        if (kind === "first") s.refusedFirst ??= { at: now() };
        writeJson(file, s);
      };
      // a refusal of robots.txt itself decides nothing (as a 5xx): the site's word is unknown, the next real request decides
      if (res && !robotsAsked && (res.status === 401 || res.status === 403)) {
        refusedAs = refusalKind(s, res.status, { first, login: !!opts.login }, now());
        cool(REFUSED_MS, refusedAs === "client" ? `it refused strom's client (HTTP ${res.status} at ${stamp(now())})` : `it refused us (HTTP ${res.status} at ${stamp(now())})`, refusedAs);
        refusedState = s;
      } else if (!robotsAsked && res?.status === 429 && tries.slowDown + 1 >= ATTEMPTS.slowDown) cool(COOL_OFF_MS, `it asked us to slow down twice (HTTP 429 at ${stamp(now())})`);
      else if (!robotsAsked && !res && tries.silent + 1 >= ATTEMPTS.silent) cool(COOL_OFF_MS, `no answer at ${stamp(now())} — the server is down, or it blocks this IP`);
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
    if (res && !robotsAsked && (res.status === 401 || res.status === 403)) {
      const kind = refusedAs ?? "load";
      const st = refusedState ?? hostState(opts.stateDir, host, now());
      told(opts, { host, refused: { kind, status: res.status, until: st.blockedUntil ?? now() + REFUSED_MS, at: now() } });
      const said = refusalText(host, res.status, kind, st);
      throw netError("refused", host, said.message, said.hint, res.status, { refusedKind: kind, until: st.blockedUntil });
    }
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
      // it let strom in: a first request it refused once was no refusal of the client
      if (!robotsAsked && res.status >= 200 && res.status < 300) {
        cur.okAt = now();
        delete cur.refusedFirst;
      }
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
    if (tries[kind!] >= attempts[kind!]) {
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
export function reserveSlots(stateDir: string, host: string, asked: ServicePace | undefined, count: number, opts: { now?: () => number; leadMs?: number; human?: Pace } = {}): number[] {
  const now = opts.now ?? Date.now;
  fs.mkdirSync(stateDir, { recursive: true });
  const file = stateFile(stateDir, host);
  const release = acquireLock(`${file}.lock`, { owner: "strom net", waitMs: 10 * 60_000, staleMs: 10 * 60_000 });
  try {
    const t = now();
    const s = hostState(stateDir, host, t);
    const pace = hostPace(s, asked, opts.human, host);
    if (s.blockedUntil && s.blockedUntil > t)
      throw blockedError(host, s);
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
    const reason = status === 429 ? `it asked the browser to slow down (HTTP 429 at ${stamp(now())})` : `it refused the browser (HTTP ${status} at ${stamp(now())})`;
    s.blockedUntil = Math.max(s.blockedUntil ?? 0, now() + ms);
    s.reason = reason;
    writeJson(file, s);
    return `${host}: ${reason} — strom leaves it alone until ${clock(s.blockedUntil)}`;
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
    const pace = hostPace(s, asked, undefined, host);
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
