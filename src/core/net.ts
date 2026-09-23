// The polite network layer every connector goes through. One request at a time
// per host with a pause between requests and an hourly cap — shared by every
// strom process on this computer (state in <shared>/net/). An archive that asks
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

/** The defaults are the fastest strom goes; a connector may only ask for slower. */
export const DEFAULT_PACE: Pace = { minIntervalMs: 2000, perHour: 400 };
/** How long a host that refused us (401/403) is left alone. */
export const REFUSED_MS = 24 * 3600_000;
/** The longest strom waits by itself (an hourly cap, a Retry-After) before it gives up for now. */
const MAX_WAIT_MS = 2 * 60_000;
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

  constructor(failure: NetFailure, host: string, message: string, hint?: string, status?: number) {
    super(message, hint ? { hint } : {});
    this.name = "NetError";
    this.failure = failure;
    this.host = host;
    this.status = status;
  }
}

interface HostState {
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
}

export interface NetOptions {
  /** Where the shared state lives (<shared>/net). */
  stateDir: string;
  /** Hosts this caller may contact ("example.org" also allows its subdomains). */
  hosts: string[];
  pace?: Partial<Pace>;
  method?: "GET" | "POST" | "HEAD";
  /** Extra request headers (Referer, Accept, a Cookie of the caller's own …); strom sets User-Agent itself. */
  headers?: Record<string, string>;
  body?: string;
  /** A login of the user in these headers, or in the body: it goes to the address asked and nowhere else, not even by a redirect. */
  private?: { headers: string[]; body: boolean };
  /** Cookies of one run: kept from answers, sent back to the hosts that set them. */
  cookies?: CookieJar;
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
export const testHooks: { sleep?: (ms: number) => Promise<void> } = {};

/** The pace for a host: never faster than the defaults. */
export function paceOf(asked?: Partial<Pace>): Pace {
  return {
    minIntervalMs: Math.max(DEFAULT_PACE.minIntervalMs, asked?.minIntervalMs ?? 0),
    perHour: Math.min(DEFAULT_PACE.perHour, asked?.perHour ?? Infinity),
  };
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

export function hostState(dir: string, host: string): HostState {
  return readJsonIfExists<HostState>(stateFile(dir, host)) ?? { recent: [] };
}

/** The hosts the limiter has met (it keeps a state for each). */
export function knownHosts(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5));
}

/** Lift a refusal by hand (the user checked with the archive). */
export function clearBlock(dir: string, host: string): void {
  const file = stateFile(dir, host);
  const s = hostState(dir, host);
  delete s.blockedUntil;
  delete s.reason;
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

/** One request, politely. Throws NetError when the host is not allowed, refused us, went silent, or is capped. */
export async function politeRequest(url: string, opts: NetOptions, redirects = 0): Promise<NetResponse> {
  const now = opts.now ?? Date.now;
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
  const pace = paceOf(opts.pace);
  fs.mkdirSync(opts.stateDir, { recursive: true });
  const file = stateFile(opts.stateDir, host);
  const tries = { busy: 0, slowDown: 0, silent: 0 };
  let upgraded = false;

  for (;;) {
    // One request at a time per host, across processes: the lock is held from the pause to the answer.
    const release = acquireLock(`${file}.lock`, { owner: "strom net", waitMs: 10 * 60_000, staleMs: 10 * 60_000 });
    let res: Response | undefined;
    let failed: unknown;
    let slowed = false;
    let viaH2 = false;
    try {
      let s = hostState(opts.stateDir, host);
      slowed = (s.slowdown ?? 1) > 1;
      const t = now();
      if (s.blockedUntil && s.blockedUntil > t)
        throw new NetError("blocked", host, `${host}: ${s.reason ?? "refused us"} — left alone until ${when(s.blockedUntil)}`, "do not retry: go on with other work; the user can lift it early with strom allow host <host> --unblock");
      s.recent = s.recent.filter((x) => x > t - 3600_000);
      if (s.recent.length >= pace.perHour) {
        const free = s.recent[0]! + 3600_000;
        if (free - t > MAX_WAIT_MS) throw new NetError("cap", host, `${pace.perHour} requests to ${host} in the last hour — the hourly cap; resumes at ${when(free)}`, "go on with other work and come back later");
        await sleep(free - t);
      }
      const gap = (s.last ?? 0) + pace.minIntervalMs * (s.slowdown ?? 1) - now();
      if (gap > 0) await sleep(gap);
      s.last = now();
      s.recent.push(s.last);
      writeJson(file, s);
      viaH2 = !!s.http2;
      try {
        // redirects are followed here, one by one, so that each target is checked and paced
        const body = opts.body !== undefined && method === "POST" ? { body: opts.body } : {};
        res = viaH2
          ? await doFetchH2(url, { method, headers, ...body, signal: AbortSignal.timeout(TIMEOUT_MS) })
          : await doFetch(url, { method, headers, ...body, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch (err) {
        failed = err;
      }
      const cool = (ms: number, reason: string) => {
        s = hostState(opts.stateDir, host);
        s.blockedUntil = now() + ms;
        s.reason = reason;
        writeJson(file, s);
      };
      if (res && (res.status === 401 || res.status === 403)) cool(REFUSED_MS, `it refused us (HTTP ${res.status} at ${when(now())})`);
      else if (res?.status === 429 && tries.slowDown + 1 >= ATTEMPTS.slowDown) cool(COOL_OFF_MS, `it asked us to slow down twice (HTTP 429 at ${when(now())})`);
      else if (!res && tries.silent + 1 >= ATTEMPTS.silent) cool(COOL_OFF_MS, `no answer at ${when(now())} — the server is down, or it blocks this IP`);
    } finally {
      release();
    }

    // 426 "Upgrade Required": the server speaks HTTP/2 only (Node's fetch speaks HTTP/1.1).
    // Asked once more over HTTP/2, paced like any request, and remembered for the host.
    if (res?.status === 426 && !viaH2 && !upgraded) {
      upgraded = true;
      const cur = hostState(opts.stateDir, host);
      cur.http2 = true;
      writeJson(file, cur);
      continue;
    }
    if (!res && viaH2) {
      // no HTTP/2 answer: the next request tries HTTP/1.1 again
      const cur = hostState(opts.stateDir, host);
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
      if (slowed) {
        const cur = hostState(opts.stateDir, host);
        cur.slowdown = Math.max(1, (cur.slowdown ?? 1) * 0.8);
        writeJson(file, cur);
      }
      const out: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        if (k !== "set-cookie") out[k] = v;
      });
      return { status: res.status, contentType: res.headers.get("content-type") ?? "", headers: out, body: Buffer.from(await res.arrayBuffer()), url: res.url || url };
    }
    // Busy, "slow down", or no answer: slow down, and try again — a little.
    const cur = hostState(opts.stateDir, host);
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
export function reserveSlots(stateDir: string, host: string, asked: Partial<Pace> | undefined, count: number, opts: { now?: () => number; leadMs?: number } = {}): number[] {
  const now = opts.now ?? Date.now;
  const pace = paceOf(asked);
  fs.mkdirSync(stateDir, { recursive: true });
  const file = stateFile(stateDir, host);
  const release = acquireLock(`${file}.lock`, { owner: "strom net", waitMs: 10 * 60_000, staleMs: 10 * 60_000 });
  try {
    const s = hostState(stateDir, host);
    const t = now();
    if (s.blockedUntil && s.blockedUntil > t)
      throw new NetError("blocked", host, `${host}: ${s.reason ?? "refused us"} — left alone until ${when(s.blockedUntil)}`, "do not retry: go on with other work; the user can lift it early with strom allow host <host> --unblock");
    s.recent = s.recent.filter((x) => x > t - 3600_000);
    const free = Math.min(count, pace.perHour - s.recent.length);
    if (free <= 0) throw new NetError("cap", host, `${pace.perHour} requests to ${host} in the last hour — the hourly cap; resumes at ${when(s.recent[0]! + 3600_000)}`, "go on with other work and come back later");
    const gap = pace.minIntervalMs * (s.slowdown ?? 1);
    const first = Math.max(t + (opts.leadMs ?? 0), (s.last ?? 0) + gap);
    const times = Array.from({ length: free }, (_, i) => first + i * gap);
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
    const s = hostState(stateDir, host);
    const reason = status === 429 ? `it asked the browser to slow down (HTTP 429 at ${when(now())})` : `it refused the browser (HTTP ${status} at ${when(now())})`;
    s.blockedUntil = Math.max(s.blockedUntil ?? 0, now() + ms);
    s.reason = reason;
    writeJson(file, s);
    return `${host}: ${reason} — strom leaves it alone until ${when(s.blockedUntil)}`;
  } finally {
    release();
  }
}

/** A GET — see politeRequest. */
export function politeGet(url: string, opts: NetOptions): Promise<NetResponse> {
  return politeRequest(url, { ...opts, method: "GET" });
}
