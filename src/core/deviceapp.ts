// The Strom app for the other devices of the home network (spec 094 P4): the gateway (core/phone.ts) serves them a copy
// of the app this computer runs — downloaded here, from the app's own site (stromapp.info, its beta) or its development
// copy on this computer, never from anywhere else. Only while devices.mode is on; a new version at most once a day
// (If-None-Match), nothing at all while it is off. Kept in <shared>/device-app/<version>/ (strom's cache: downloaded
// again whenever it is gone; the config folder where no shared folder is set), the last two versions.
//
// The app's version is read from the file itself (<span id="about-version">X.Y.Z</span>, stamped into its index.html
// when the app is built) — the version the computer's app said to the bridge (X-Strom-App-Version) only where the file
// says none: the copy kept is what the version names.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { configDir, isolated, type Env } from "./paths.ts";
import { readJsonIfExists } from "./json.ts";
import { acquireLock, liveHolder, withLock } from "./lock.ts";
import { LockedError } from "./errors.ts";
import { Settings } from "./config.ts";
import { APP_DEVICE_MODE, APP_DEVICE_MODE_BETA, appUrlSetting, defaultAppUrl, deviceAppServable, isAppVersion, isStromAppOrigin, STROM_APP_BETA_URL, STROM_APP_URL } from "./stromapp.ts";
import { compareVersions } from "./update.ts";
import { devicesOn, type Clock } from "./devices.ts";
import { notePhone } from "./phone.ts";

/** A new version looked for at most once in this long. */
export const DEVICE_APP_EVERY_MS = 24 * 3600_000;
/** A download that failed is tried again after this long. */
export const DEVICE_APP_RETRY_MS = 3600_000;
/**
 * The computer's app says a newer version than the copy, or the copy is under the gate of the app's version: the site
 * asked at once, not after a day — and while it still gives the older one (its release going on, a CDN), asked again at
 * most once in this long; the copy kept meanwhile.
 */
export const DEVICE_APP_BEHIND_MS = 5 * 60_000;
export const INDEX_MAX = 40 * 1024 * 1024;
export const MANIFEST_MAX = 64 * 1024;
export const ICON_MAX = 1024 * 1024;
export const ICONS_MAX = 8;
const SHASUMS_MAX = 64 * 1024;
const TIMEOUT_MS = 120_000;
/** Versions kept. */
const KEPT = 2;

const ICON_TYPES: Record<string, string> = { ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp" };
const VERSION_IN_FILE = /<span id="about-version">([^<]{1,80})<\/span>/;

function file(env: Env, name: string): string {
  return path.join(configDir(env), name);
}

/** What strom knows of the app for the devices (<config>/device-app.json). */
interface DeviceAppNote {
  /** The app the bridge was asked by about the phone: its origin, its version. */
  source?: { origin: string; appVersion?: string; at: string };
  /** The copy kept now: its version, the origin of the site it came from, its ETag, when the site was asked last. */
  version?: string;
  from?: string;
  etag?: string;
  checkedAt?: string;
  /** The last download that failed: when, why (tried again after DEVICE_APP_RETRY_MS). */
  failedAt?: string;
  error?: string;
  /**
   * The version sought — the newer one the computer's app said, or the gate the copy is under —, asked the site for when
   * (the site gave an older one): not asked again before DEVICE_APP_BEHIND_MS.
   */
  sought?: { version: string; at: string };
}

function readNote(env: Env): DeviceAppNote {
  try {
    const n = readJsonIfExists<DeviceAppNote>(file(env, "device-app.json"));
    return n && typeof n === "object" && !Array.isArray(n) ? n : {};
  } catch {
    return {};
  }
}

function writeNote(env: Env, change: (n: DeviceAppNote) => DeviceAppNote | undefined): void {
  withLock(file(env, "device-app.lock"), { owner: "the app for the devices" }, () => {
    const next = change(readNote(env));
    if (!next) return;
    const f = file(env, "device-app.json");
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = `${f}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
    fs.renameSync(tmp, f);
  });
}

/**
 * The app that asked the bridge about the phone (its Origin, its X-Strom-App-Version): the devices get the copy of the
 * app this computer runs — its site, its beta, its development copy. Only an origin of the Strom app; written only
 * when it changed. Never throws.
 */
export function noteDeviceAppSource(env: Env, origin: string | undefined, appVersion?: string, clock: Clock = Date.now): void {
  try {
    if (!origin || !isStromAppOrigin(origin)) return;
    const v = appVersion?.trim();
    const version = v && isAppVersion(v) ? v : undefined;
    const was = readNote(env).source;
    if (was && was.origin === origin && was.appVersion === version) return;
    writeNote(env, (n) => {
      if (n.source && n.source.origin === origin && n.source.appVersion === version) return undefined;
      return { ...n, source: { origin, ...(version ? { appVersion: version } : {}), at: new Date(clock()).toISOString() } };
    });
  } catch {
    // a note not written: the default copy then
  }
}

/**
 * The base address the copy is downloaded from (ends with /): https of the app's site or its beta, http of the loopback
 * alone. An isolated installation (STROM_ISOLATED) asks the loopback alone — a development copy of the app on this
 * computer —, never the app's site: none, nothing downloaded.
 */
export function deviceAppSource(env: Env): string | undefined {
  const origin = readNote(env).source?.origin;
  let setting: string | undefined;
  try {
    setting = appUrlSetting(new Settings(env, {})).url;
  } catch {
    setting = undefined;
  }
  let base: string;
  if (origin === "https://stromapp.info") base = STROM_APP_URL;
  else if (origin === "https://beta.stromapp.info") base = STROM_APP_BETA_URL;
  else if (origin && isStromAppOrigin(origin)) {
    // the development copy: the path strom.app.url names on the same origin, else /run/
    const same = setting && safeUrl(setting)?.origin === origin ? safeUrl(setting)!.pathname : "/run/";
    base = `${origin}${same}`;
  } else base = setting && isStromAppOrigin(safeUrl(setting)?.origin ?? "") ? setting : defaultAppUrl(env);
  const u = safeUrl(base);
  if (!u || !isStromAppOrigin(u.origin) || u.search || u.hash) return undefined;
  const loopback = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
  if (u.protocol !== "https:" && !loopback) return undefined;
  if (isolated(env) && !loopback) return undefined;
  if (u.pathname.endsWith("/")) return u.href;
  // ".../run/index.html": its folder; ".../run": the folder itself
  return /\.[A-Za-z0-9]{1,8}$/.test(u.pathname) ? u.href.replace(/[^/]*$/, "") : `${u.href}/`;
}

function safeUrl(s: string): URL | undefined {
  try {
    return new URL(s);
  } catch {
    return undefined;
  }
}

/** The folder of the copies: <shared>/device-app, the config folder's where no shared folder is set. */
export function deviceAppRoot(env: Env): string {
  let shared: string | undefined;
  try {
    shared = new Settings(env, {}).shared()?.value;
  } catch {
    shared = undefined;
  }
  return path.join(shared ?? configDir(env), "device-app");
}

export interface DeviceAppFiles {
  dir: string;
  version: string;
  etag: string | undefined;
  /** The origin of the site the copy came from (none: downloaded by an older strom) — the app's beta has a gate of its own. */
  from?: string;
}

/** The copy the gateway serves now: its folder (index.html in it), its version, its ETag; none — none downloaded. */
export function deviceAppFiles(env: Env): DeviceAppFiles | undefined {
  const n = readNote(env);
  if (!n.version || !isAppVersion(n.version)) return undefined;
  const dir = path.join(deviceAppRoot(env), n.version);
  if (!fs.existsSync(path.join(dir, "index.html"))) return undefined;
  return { dir, version: n.version, etag: n.etag, ...(n.from ? { from: n.from } : {}) };
}

/** The gate of the app for the devices in a test (STROM_DEVICE_APP_GATE of a test of the phone's server, isolated): never elsewhere. */
export function appGate(env: Env): string | undefined {
  const asked = env.STROM_DEVICE_APP_GATE;
  const test = (env.STROM_PHONE_TEST === "loopback" || env.STROM_PHONE_TEST === "lan") && env.STROM_ISOLATED === "1";
  return asked && test && isAppVersion(asked) ? asked : undefined;
}

/** The copy the gateway serves now: downloaded and of a version the gate lets in (a test's, else the app's); none — none to serve. */
export function servableDeviceApp(env: Env): DeviceAppFiles | undefined {
  const files = deviceAppFiles(env);
  // the gate of a test, else the app's (undefined: its default); a copy of its beta site by its own gate too
  return files && deviceAppServable(files.version, appGate(env), files.from) ? files : undefined;
}

/** The last download of the copy failed (tried again after DEVICE_APP_RETRY_MS): the gateway's page says so. */
export function deviceAppFailed(env: Env): boolean {
  return !!readNote(env).failedAt;
}

export interface DeviceAppState {
  app: "ready" | "fetching" | "none";
  appVersion?: string;
}

/**
 * For /phone: a copy ready (its version), one being downloaded, or none. Ready only as the gateway serves it: a copy
 * under the gate of the app's version is none — the devices get the page that the computer prepares the app.
 */
export function deviceAppState(env: Env): DeviceAppState {
  const ready = servableDeviceApp(env);
  if (liveHolder(file(env, "device-app.fetch.lock"), 30 * 60_000)) return ready ? { app: "fetching", appVersion: ready.version } : { app: "fetching" };
  return ready ? { app: "ready", appVersion: ready.version } : { app: "none" };
}

export type EnsureResult =
  | { result: "off" }
  | { result: "fresh"; version: string }
  | { result: "busy" }
  | { result: "unchanged"; version: string }
  | { result: "fetched"; version: string }
  | { result: "failed"; error: string };

class Refused extends Error {}

/** A body read up to `max` bytes: past it — refused (Content-Length said first, the bytes counted as they come). */
async function readCapped(res: Response, max: number, what: string): Promise<Buffer> {
  const said = Number(res.headers.get("content-length"));
  if (Number.isFinite(said) && said > max) {
    await res.body?.cancel().catch(() => {});
    throw new Refused(`${what} too big (${said} bytes)`);
  }
  if (!res.body) return Buffer.alloc(0);
  const parts: Buffer[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw new Refused(`${what} too big (over ${max} bytes)`);
    }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts);
}

async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, { redirect: "error", headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

const typeOf = (res: Response) => (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();

/** A path under the base of the app, of safe parts alone (letters, digits, . _ -; no . or ..): the relative path, or undefined. */
function underBase(base: URL, href: URL): string | undefined {
  if (href.origin !== base.origin || href.search || href.hash || !href.pathname.startsWith(base.pathname)) return undefined;
  const rel = decodeURIComponentSafe(href.pathname.slice(base.pathname.length));
  if (!rel) return undefined;
  const parts = rel.split("/");
  if (parts.length > 4 || parts.some((p) => !/^[A-Za-z0-9._-]{1,100}$/.test(p) || p === "." || p === "..")) return undefined;
  return parts.join("/");
}

function decodeURIComponentSafe(s: string): string | undefined {
  try {
    return decodeURIComponent(s);
  } catch {
    return undefined;
  }
}

/** SHASUMS256.txt: name → sha256 (hex, lower case). */
function parseShasums(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64}) [ *]?(.+)$/.exec(line.trim());
    if (m) out.set(m[2]!.trim().replace(/^\.\//, ""), m[1]!.toLowerCase());
  }
  return out;
}

const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

/**
 * The newer version the computer's app said than the copy kept (source.appVersion): the version, or undefined (none
 * said, not a version, the same or older).
 */
function behind(n: DeviceAppNote, version: string | undefined): string | undefined {
  const said = n.source?.appVersion;
  return version && said && isAppVersion(said) && compareVersions(said, version) > 0 ? said : undefined;
}

/**
 * The gate the copy kept is under (the app's, a test's; of the app's beta site, the lower of its own and the app's): the
 * gate, or undefined — the copy passes it, or no version would (a gate pending: nothing newer is served either, the site
 * asked once a day as before).
 */
function underGate(env: Env, version: string | undefined, from: string | undefined): string | undefined {
  if (!version || deviceAppServable(version, appGate(env), from)) return undefined;
  const gate = appGate(env) ?? APP_DEVICE_MODE;
  const beta = APP_DEVICE_MODE_BETA && from === new URL(STROM_APP_BETA_URL).origin ? APP_DEVICE_MODE_BETA : undefined;
  return gate && beta ? (compareVersions(beta, gate) < 0 ? beta : gate) : (gate ?? beta);
}

/** The version the copy kept should reach and does not: the newer one the computer's app says, else the gate it is under. */
function sought(env: Env, n: DeviceAppNote, kept: { version: string; from?: string } | undefined): string | undefined {
  return behind(n, kept?.version) ?? underGate(env, kept?.version, kept?.from);
}

const within = (t: number, at: string | undefined, ms: number) => {
  const a = at ? Date.parse(at) : NaN;
  return Number.isFinite(a) && t >= a && t - a < ms;
};

/**
 * The copy of the app for the devices made sure of: only while devices.mode is on (off — not one request), the site
 * asked at most once a day (its ETag: 304 — kept as it is) — at once where the computer's app says a newer version than
 * the copy, or the copy is under the gate of the app's version (the gateway cannot serve it), then at most once in
 * DEVICE_APP_BEHIND_MS while the site still gives the older one (the copy never removed for it) —, one download at a
 * time (another running — busy). The
 * index (≤ 40 MB, text/html, its version in it), the manifest (optional, ≤ 64 KB) and up to 8 icons it names (PNG, SVG,
 * WebP, ≤ 1 MB each, only under the app's own path — any other skipped); SHASUMS256.txt beside them checked where the
 * site has one (404: TLS alone; a sum that does not hold — nothing kept). Written whole (a temporary folder renamed),
 * the last two versions kept. Never throws.
 */
export async function ensureDeviceApp(env: Env, opts: { now?: Clock } = {}): Promise<EnsureResult> {
  const now = opts.now ?? Date.now;
  if (!devicesOn(env)) return { result: "off" };
  let release: (() => void) | undefined;
  try {
    const n = readNote(env);
    const kept = deviceAppFiles(env);
    const t = now();
    // a copy of another site than the one asked now (the app moved to its beta, or back), or one an older strom did not
    // say the site of: downloaded again, at once
    const source = deviceAppSource(env);
    const sameSite = !source || !kept || kept.from === new URL(source).origin;
    // the computer's app says a newer version than the copy, or the copy is under the gate: asked at once — unless asked
    // for that version lately
    const want = sameSite ? sought(env, n, kept) : undefined;
    const fresh = want ? n.sought?.version === want && within(t, n.sought.at, DEVICE_APP_BEHIND_MS) : within(t, n.checkedAt, DEVICE_APP_EVERY_MS);
    if (kept && sameSite && fresh) return { result: "fresh", version: kept.version };
    if (within(t, n.failedAt, DEVICE_APP_RETRY_MS)) return { result: "failed", error: n.error ?? "failed lately" };
    try {
      release = acquireLock(file(env, "device-app.fetch.lock"), { owner: "the app for the devices downloaded", waitMs: 0, staleMs: 30 * 60_000 });
    } catch (err) {
      if (err instanceof LockedError) return { result: "busy" };
      throw err;
    }
    const result = await download(env, kept, now, sameSite);
    if (result.result === "unchanged" || result.result === "fetched") {
      // the site still gives an older version than the computer's app says, or one under the gate: asked again after
      // DEVICE_APP_BEHIND_MS
      const still = sought(env, readNote(env), deviceAppFiles(env));
      writeNote(env, (x) => {
        if (!still && !x.sought) return undefined;
        return { ...x, sought: still ? { version: still, at: new Date(now()).toISOString() } : undefined };
      });
    }
    if (result.result === "failed") {
      writeNote(env, (x) => ({ ...x, failedAt: new Date(now()).toISOString(), error: result.error }));
      notePhone(env, `the app for the devices not downloaded: ${result.error}`);
    }
    return result;
  } catch (err) {
    return { result: "failed", error: err instanceof Error ? err.message : String(err) };
  } finally {
    release?.();
  }
}

async function download(env: Env, kept: DeviceAppFiles | undefined, now: Clock, sameSite = true): Promise<EnsureResult> {
  const source = deviceAppSource(env);
  if (!source) return { result: "failed", error: "no address of the Strom app to download it from" };
  const base = new URL(source);
  const at = () => new Date(now()).toISOString();
  try {
    const index = await get(new URL("index.html", base).href, kept?.etag && sameSite ? { "If-None-Match": kept.etag } : {});
    if (index.status === 304 && kept && sameSite) {
      await index.body?.cancel().catch(() => {});
      writeNote(env, (x) => ({ ...x, from: base.origin, checkedAt: at(), failedAt: undefined, error: undefined }));
      return { result: "unchanged", version: kept.version };
    }
    if (index.status !== 200) {
      await index.body?.cancel().catch(() => {});
      return { result: "failed", error: `index.html: HTTP ${index.status}` };
    }
    if (typeOf(index) !== "text/html") {
      await index.body?.cancel().catch(() => {});
      return { result: "failed", error: `index.html: ${typeOf(index) || "no type"}, not text/html` };
    }
    const etag = index.headers.get("etag") ?? undefined;
    const html = await readCapped(index, INDEX_MAX, "index.html");
    const inFile = VERSION_IN_FILE.exec(html.toString("utf8"))?.[1]?.trim();
    const noted = readNote(env).source?.appVersion;
    const version = inFile && isAppVersion(inFile) ? inFile : noted && isAppVersion(noted) ? noted : undefined;
    if (!version) return { result: "failed", error: "index.html says no version of the app" };

    const files = new Map<string, Buffer>([["index.html", html]]);
    // the manifest and its icons: optional
    const manifest = await optional(new URL("manifest.json", base).href, MANIFEST_MAX, ["application/manifest+json", "application/json"]);
    if (manifest) {
      files.set("manifest.json", manifest);
      let icons: unknown;
      try {
        icons = (JSON.parse(manifest.toString("utf8")) as { icons?: unknown }).icons;
      } catch {
        icons = undefined;
      }
      const wanted = new Set<string>();
      for (const icon of Array.isArray(icons) ? icons : []) {
        const src = icon && typeof icon === "object" ? (icon as { src?: unknown }).src : undefined;
        if (typeof src !== "string") continue;
        const href = safeUrl(new URL(src, new URL("manifest.json", base)).href);
        const rel = href ? underBase(base, href) : undefined;
        const type = rel ? ICON_TYPES[path.extname(rel).toLowerCase()] : undefined;
        if (!rel || !type || rel === "index.html" || rel === "manifest.json") continue;
        wanted.add(rel);
        if (wanted.size >= ICONS_MAX) break;
      }
      for (const rel of wanted) {
        const got = await optional(new URL(rel, base).href, ICON_MAX, [ICON_TYPES[path.extname(rel).toLowerCase()]!]);
        if (got) files.set(rel, got);
      }
    }

    // the sums of the site, where it has them
    const sums = await get(new URL("SHASUMS256.txt", base).href);
    if (sums.status === 200) {
      const listed = parseShasums((await readCapped(sums, SHASUMS_MAX, "SHASUMS256.txt")).toString("utf8"));
      if (!listed.has("index.html")) return { result: "failed", error: "SHASUMS256.txt lists no index.html" };
      for (const [rel, bytes] of files) {
        const want = listed.get(rel);
        if (want && want !== sha256(bytes)) return { result: "failed", error: `${rel}: its SHA-256 is not the one of SHASUMS256.txt` };
      }
    } else {
      await sums.body?.cancel().catch(() => {});
      if (sums.status !== 404) return { result: "failed", error: `SHASUMS256.txt: HTTP ${sums.status}` };
    }

    store(env, version, files);
    writeNote(env, (x) => ({ ...x, version, from: base.origin, ...(etag ? { etag } : { etag: undefined }), checkedAt: at(), failedAt: undefined, error: undefined }));
    prune(env, version);
    notePhone(env, `the app for the devices downloaded: ${version} from ${base.origin}`);
    return { result: "fetched", version };
  } catch (err) {
    return { result: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}

/** A file the copy may go without: its bytes, or undefined (not there, another type, too big — a refusal of an index is not this). */
async function optional(url: string, max: number, types: string[]): Promise<Buffer | undefined> {
  const res = await get(url);
  if (res.status !== 200 || !types.includes(typeOf(res))) {
    await res.body?.cancel().catch(() => {});
    return undefined;
  }
  try {
    return await readCapped(res, max, url);
  } catch (err) {
    if (err instanceof Refused) return undefined;
    throw err;
  }
}

/** The files written into a temporary folder beside the copies and renamed whole to <version>/. */
function store(env: Env, version: string, files: Map<string, Buffer>): void {
  const root = deviceAppRoot(env);
  fs.mkdirSync(root, { recursive: true });
  const tmp = path.join(root, `.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`);
  try {
    for (const [rel, bytes] of files) {
      const f = path.join(tmp, ...rel.split("/"));
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, bytes);
    }
    const final = path.join(root, version);
    if (fs.existsSync(final)) {
      const old = path.join(root, `.old-${process.pid}-${crypto.randomBytes(4).toString("hex")}`);
      fs.renameSync(final, old);
      fs.renameSync(tmp, final);
      fs.rmSync(old, { recursive: true, force: true });
    } else fs.renameSync(tmp, final);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** The last KEPT versions kept (the one just written among them), the rest — and what a download left behind — removed. */
function prune(env: Env, current: string): void {
  const root = deviceAppRoot(env);
  let names: string[];
  try {
    names = fs.readdirSync(root);
  } catch {
    return;
  }
  const versions = names.filter((n) => isAppVersion(n) && n !== current).sort((a, b) => compareVersions(b, a));
  for (const n of versions.slice(KEPT - 1)) fs.rmSync(path.join(root, n), { recursive: true, force: true });
  for (const n of names.filter((n) => n.startsWith(".tmp-") || n.startsWith(".old-"))) {
    const pid = Number(n.split("-")[1]);
    if (pid !== process.pid) fs.rmSync(path.join(root, n), { recursive: true, force: true });
  }
}
