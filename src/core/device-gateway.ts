/**
 * The gateway of the devices of the home network (devices.mode on): the phone's server (strom phone serve, phone.ts)
 * gives a device the Strom app this computer runs, pairs it (POST /device/pair) and carries its sealed requests to the
 * bridge of a tree on the loopback (POST /device/x) — each checked against what a device may ask (device-allow.ts),
 * every answer sealed for that device alone. The phone's server checks first, as for every request, that it comes from
 * a device of the same private network and not from the computer itself, and that it names the server by its own
 * address (Host); only then is the gateway asked.
 *
 * Off (devices.mode off or not set, read at each request): nothing of it is there — /device/* answers 404
 * device.disabled, everything else is the phone's page as before, and the server answers its addresses alone (Host).
 *
 * On, the gateway also answers at the computer's own name, <name>.local:<port> exactly (the name the system says on
 * the network: Bonjour, avahi): a device paired at an IP address moves there once (device/move), and stays found when
 * the address changes.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import type { Env } from "./paths.ts";
import { Settings } from "./config.ts";
import { knownTreesIn, Tree, type KnownTree } from "./tree.ts";
import { actsAsArchive } from "./state.ts";
import { forApp, langOf, refusal, stromBy } from "./receive.ts";
import { freeBytes, originalMax, ORIGINAL_RESERVE } from "./originals.ts";
import { SYNC_MAX_BYTES } from "./sync.ts";
import { dropDeviceUploads, dropUpload, readUpload, sweepUploads, uploadFiles, writeUpload, deviceUploadsRoot } from "./device-uploads.ts";
import { headOf } from "./stamp.ts";
import { isDiskFull } from "./errors.ts";
import { phrase } from "./phrases.ts";
import { spawnRun } from "./warmwriter.ts";
import { deviceAllows } from "./device-allow.ts";
import { deviceAppFiles, deviceAppSource, ensureDeviceApp } from "./deviceapp.ts";
import { deviceAppServable, isAppVersion, STROM_APP_URL } from "./stromapp.ts";
import {
  EVENT_PING_MS,
  EVENT_STREAMS_MAX,
  MEDIA_BLOCK,
  MEDIA_META,
  MEDIA_TAG,
  NonceMemory,
  clientOfDevice,
  deviceById,
  deviceCode,
  deviceName,
  deviceRows,
  devicesList,
  devicesOn,
  eventsProofHolds,
  forgetDevicePair,
  fromB64url,
  isDeviceId,
  keyOf,
  mediaBlockLength,
  mediaBlocks,
  mediaBodyLength,
  openMediaBlock,
  openRequest,
  parseMediaMeta,
  pairDevice,
  parseRequestEnvelope,
  removeDevice,
  renameDevice,
  responseOf,
  sawDevice,
  sealEvent,
  sealPair,
  sealResponse,
  wantsIdentity,
  type Device,
  type DeviceRequest,
  type DeviceResponse,
} from "./devices.ts";

/** What a pairing may send (pairId, proof, name, kind). */
export const PAIR_BODY_MAX = 4 * 1024;
/** What a request of the tunnel may send (its body base64url inside, sealed). */
export const TUNNEL_BODY_MAX = 12 * 1024 * 1024;

/** The words of a body each action of a record takes (a conflict X, a hypothesis H, a send's undo I). */
const TAKES: Record<"X" | "H" | "I", string[]> = { X: ["take", "reasoning"], H: ["variant", "decision", "proposed", "abandon", "keepOpen"], I: ["dry"] };

/** The most a body of a decision or an undo a device asks of the gateway may be (its JSON). */
const ACTION_BODY_MAX = 4 * 1024;

/** A device's text (a reasoning, a decision, a variant): NFC, one of no control character, at most 500 — none: undefined, else null. */
function deviceText(v: unknown): string | undefined | null {
  if (v === undefined) return undefined;
  if (typeof v !== "string") return null;
  const t = v.normalize("NFC").trim();
  if (/\p{Cc}/u.test(t) || [...t].length > 500) return null;
  return t || undefined;
}
/** How long the bridge of a tree is waited for to answer a request carried to it. */
const BRIDGE_MS = 120_000;

/**
 * The headers of the bridge a file's meta block may say (any case of their names), each as the bridge takes it — a
 * device's own words percent-encoded where the bridge decodes them (X-Strom-Name, -Note, -Path): printable ASCII alone.
 * X-Strom-Read (reading it is an agent's paid work) is the computer's; any other is refused.
 */
const MEDIA_HEADERS: ReadonlyMap<string, string> = new Map(
  ["X-Strom-Name", "X-Strom-Note", "X-Strom-Person", "X-Strom-Family", "X-Strom-Source", "X-Strom-Region", "X-Strom-Batch", "X-Strom-Path", "X-Strom-Zip", "X-Strom-Task", "X-Strom-Image", "X-Strom-Replace", "X-Strom-List-Ref", "Prefer"].map((h) => [h.toLowerCase(), h]),
);
/** A value of a header of a file's meta block: at most so many characters. */
const MEDIA_HEADER_MAX = 2048;
/** A ZIP of a batch may be larger than one file (the bridge unpacks it, each of its files no larger than one): below 4 GB. */
const ZIP_MAX = 4 * 1024 ** 3 - 1;
/** The longest a file's size may say (a shape: anything past the limits is refused 413 once the request is opened). */
const MEDIA_SIZE_SHAPE = 2 ** 42;
/** How long the bridge is waited for (without a byte either way) while a file goes to it and is taken. */
const MEDIA_BRIDGE_MS = 10 * 60_000;
/** A device asked to send its next file after this many seconds (one file at a time for a row). */
const MEDIA_BUSY_RETRY = 5;
/** What a request's body may have read ahead of the block being opened before it is paused. */
const BODY_AHEAD = 2 * 1024 * 1024 + 64 * 1024; // (two blocks; a number of its own: devices.ts and this module import each other)
const DRAIN_MAX = 8 * 1024 * 1024; // what of a body answered early is read and thrown away at most (eight blocks)

/** A request's body read by exact lengths as it comes (paused while two blocks' worth wait). */
function bodyReader(req: http.IncomingMessage) {
  let chunks: Buffer[] = [];
  let have = 0;
  let ended = false;
  let broken = false;
  let dropping = false;
  let wake: (() => void) | undefined;
  const poke = () => {
    const w = wake;
    wake = undefined;
    w?.();
  };
  req.on("data", (c: Buffer) => {
    if (dropping) return;
    chunks.push(c);
    have += c.length;
    if (have >= BODY_AHEAD) req.pause();
    poke();
  });
  req.on("end", () => {
    ended = true;
    poke();
  });
  req.on("error", () => {
    broken = true;
    poke();
  });
  req.on("close", () => {
    if (!ended && !req.complete) broken = true;
    poke();
  });
  const wait = () =>
    new Promise<void>((resolve) => {
      wake = resolve;
      req.resume();
    });
  return {
    /** Exactly n bytes; undefined: the body ended (or the device went) first. */
    async take(n: number): Promise<Buffer | undefined> {
      while (have < n && !ended && !broken) await wait();
      if (have < n) return undefined;
      const all = chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks);
      const rest = all.subarray(n);
      chunks = rest.length ? [rest] : [];
      have = rest.length;
      if (have < BODY_AHEAD && !dropping) req.resume();
      return all.subarray(0, n);
    },
    /** Does anything come after what was taken (waited for: true), or did the body end there (false)? */
    async more(): Promise<boolean> {
      while (!have && !ended && !broken) await wait();
      return have > 0;
    },
    /** The device went before its body ended (nobody to answer). */
    get broken() {
      return broken;
    },
    /** Bytes come and not taken. */
    get left() {
      return have;
    },
    /** The rest read and thrown away (answered before the body came whole). */
    drop() {
      dropping = true;
      chunks = [];
      have = 0;
      req.resume();
    },
  };
}

/**
 * Answered before the request's body came whole: the rest read and thrown away, the connection kept — a device still
 * sending is told the answer, as the bridge refuses one (a connection ended under a body still coming may lose the
 * answer: a reset) — but never more than DRAIN_MAX of it: past that the connection ends once the answer is out, never
 * held open for a body of any length nobody takes.
 */
function drain(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.complete) return;
  let thrown = 0;
  const count = (c: Buffer) => {
    thrown += c.length;
    if (thrown <= DRAIN_MAX) return;
    req.off("data", count);
    const end = () => req.socket?.destroy();
    if (res.writableFinished) end();
    else res.once("finish", end);
  };
  req.on("data", count);
  req.resume();
}

/**
 * An answer given before the request's body came whole. On a connection kept (as a browser keeps it): at once, the rest
 * thrown away (drain). On one that ends with the answer (the device said Connection: close, or HTTP/1.0): the server
 * ends it the moment the answer is out, and the rest of the body still coming meets a closed socket — a reset that may
 * reach the device before the answer it was given (on Linux a write EPIPE). There the rest is read and thrown away
 * first, then the answer — but past DRAIN_MAX the answer goes at once and the connection ends with it, never held open
 * for a body nobody takes.
 */
function answerEarly(req: http.IncomingMessage, res: http.ServerResponse, write: () => void): void {
  if (req.complete || res.shouldKeepAlive) {
    write();
    drain(req, res);
    return;
  }
  let thrown = 0;
  let written = false;
  const go = () => {
    if (written) return;
    written = true;
    req.off("data", count);
    req.off("end", go);
    req.off("close", go);
    write();
  };
  const count = (c: Buffer) => {
    thrown += c.length;
    if (thrown > DRAIN_MAX) go();
  };
  req.on("data", count);
  req.once("end", go);
  req.once("close", go);
  req.resume();
}

/** The SHA-256 of a file (hex), read as a stream. */
function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(file)
      .on("data", (c) => h.update(c))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", reject);
  });
}

/** A path or a value percent-decoded (a broken escape: as it is). */
function decodedSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The headers of the bridge's answer a device is told: its type, when to ask again, its ETag, strom's own (X-Strom-*). */
function bridgeHeaders(got: http.IncomingHttpHeaders): Record<string, string> {
  const headers: Record<string, string> = {};
  const said = (name: string, as: string) => {
    const v = got[name];
    if (typeof v === "string") headers[as] = v;
  };
  said("content-type", "Content-Type");
  said("retry-after", "Retry-After");
  said("etag", "ETag");
  said("preference-applied", "Preference-Applied");
  for (const [k, v] of Object.entries(got)) if (k.startsWith("x-strom-") && !k.startsWith("x-strom-pair") && typeof v === "string") headers[k.replace(/(^|-)([a-z])/g, (_m, d: string, c: string) => d + c.toUpperCase())] = v;
  return headers;
}

/**
 * A test's hooks of the gateway (STROM_DEVICE_*): an isolated strom's test of the loopback, or of the network with a real
 * phone (STROM_PHONE_TEST=lan) — never elsewhere.
 */
function testHooks(env: Env): boolean {
  return (env.STROM_PHONE_TEST === "loopback" || env.STROM_PHONE_TEST === "lan") && env.STROM_ISOLATED === "1";
}

/** How often the gateway looks for uploads of devices unpaired (STROM_DEVICE_SWEEP_MS in a test: testHooks). */
function sweepMs(env: Env): number {
  const asked = Number(env.STROM_DEVICE_SWEEP_MS);
  return testHooks(env) && Number.isInteger(asked) && asked >= 50 ? asked : 10_000;
}

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

/**
 * The policy of the app for the devices. The app is one file of its own (its scripts and styles inline, its workers
 * from blobs, map tiles and its own pages of the web): a list of its sources would break it at its next version. What
 * a page cannot set itself is set here — never in a frame of another page — and what it never needs is closed: no
 * <base> elsewhere, no plugins, no form sent away.
 */
export const DEVICE_APP_CSP = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'";

/** What the phone's server knows of a request when it asks the gateway. */
export interface GatewayAsk {
  url: URL;
  /** The address the request named (Host), checked: `<ip>:<port>`, or `<name>.local:<port>` (on, lower case). */
  host: string;
  /** The port of the server. */
  port: number;
  /** The request carries the cookie of a phone paired with the phone's page. */
  phonePaired: boolean;
}

export interface DeviceGateway {
  /** The request answered by the gateway (true), or left to the phone's page (false). */
  handle(req: http.IncomingMessage, res: http.ServerResponse, ask: GatewayAsk): boolean;
  /** Each tick of the phone's server: the app for the devices made sure of while on; a code to pair forgotten when turned off. */
  tick(): void;
  /** A bridge being started for a device (the server is not started again meanwhile). */
  busy(): boolean;
  /** The server ends: every stream of events closed, with its stream of the bridge. */
  end(): void;
  /**
   * The Host of a request that is not the address it came to: `<name>.local:<port>` of this computer exactly (any case),
   * while on — the Host as the gateway goes by it (lower case); anything else, or off: none (421 as before).
   */
  named(host: string | undefined, port: number): string | undefined;
}

/** The computer as a device is told it: its name without its domain, one line, NFC, at most 60 characters. */
export function computerName(): string {
  const raw = os.hostname().split(".")[0] ?? "";
  const name = [...raw.normalize("NFC").replace(/[\p{Cc}\p{Cf}]/gu, "").trim()].slice(0, 60).join("");
  return name || "Strom";
}

/** A label of DNS (ASCII: a name of the network, not a person's text): letters, digits, hyphens inside, at most 63. */
const DNS_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

/**
 * The computer's own name on the home network, `<name>.local` (lower case): the first part of its hostname, when it
 * is a name DNS can say (none — a name with diacritics, spaces, nothing: null, the devices stay at an IP address). A
 * test (testHooks) may say it (STROM_DEVICE_LOCAL_NAME; "" for none) — never elsewhere; a test of the network with a real
 * phone (lan) never the computer's own (a device of it is not mixed with the phone connection of a strom that is no
 * test's): none unless said.
 */
export function localName(env: Env): string | null {
  const asked = env.STROM_DEVICE_LOCAL_NAME;
  const lan = env.STROM_PHONE_TEST === "lan" && env.STROM_ISOLATED === "1";
  const test = asked !== undefined && testHooks(env);
  if (lan && !test) return null;
  const raw = test ? asked.replace(/\.local$/i, "") : (os.hostname().split(".")[0] ?? "");
  return DNS_LABEL.test(raw) ? `${raw.toLowerCase()}.local` : null;
}

/**
 * What a device may do with itself, as /status through the gateway says it (the app draws these alone): rename its
 * row, unpair itself, an icon on its home screen (not from an icon), a move to the computer's name (where it has one and
 * the device does not ask there already), the decisions of the research it may take, a file sent in blocks
 * (PUT /device/media/<sha256>). `local`: `<name>.local:<port>`, or null.
 */
export function deviceActions(device: Pick<Device, "of">, at: { host?: string; local: string | null }): string[] {
  return ["device.rename", "device.unpair", ...(device.of ? [] : ["device.home"]), ...(at.local && at.host && at.host !== at.local ? ["device.move"] : []), "conflict.decide", "hypothesis.decide", "sync.undo", "media.put"];
}

/** The gate of the app for the devices in a test (STROM_DEVICE_APP_GATE; testHooks): never elsewhere. */
export function appGate(env: Env): string | undefined {
  const asked = env.STROM_DEVICE_APP_GATE;
  if (asked && testHooks(env) && isAppVersion(asked)) return asked;
  return undefined;
}

/** The copy of the app the gateway serves now: downloaded and of a version the gate lets in; none — the phone's page. */
export function servable(env: Env): ReturnType<typeof deviceAppFiles> {
  const files = deviceAppFiles(env);
  if (!files) return undefined;
  // the gate of a test of the loopback, else the app's (undefined: its default); a copy of its beta site by its own gate too
  return deviceAppServable(files.version, appGate(env), files.from) ? files : undefined;
}

/** The origin of the copy of the app the devices are given — what the bridge lets write (its pages alone). */
function appOrigin(env: Env): string {
  const base = deviceAppSource(env);
  try {
    return new URL(base ?? STROM_APP_URL).origin;
  } catch {
    return new URL(STROM_APP_URL).origin;
  }
}

/** The trees a device may open: their ids, names, whether nobody researches there — never where they are. */
export function deviceTrees(env: Env): { known: KnownTree[]; said: { id: string; name: string; archive: boolean }[] } {
  const settings = new Settings(env, {});
  const known = knownTreesIn(settings.trees()?.value, settings.config.extraTrees ?? []);
  const said = known.flatMap((t) => {
    try {
      return [{ id: t.id, name: t.name, archive: actsAsArchive(Tree.open(t.root, env)) }];
    } catch {
      return [];
    }
  });
  return { known, said };
}

/**
 * /status as a device is told it: nothing of the computer — where its research and folders are, the agent's work and
 * runs, the settings of the books, the browser, the links strom-research:// —, and the device itself with what it may
 * do there (deviceActions; `host`: the Host it asks by, `local`: `<name>.local:<port>` or null) and how many other
 * devices are connected now (`others`: the rows seen within DEVICE_CONNECTED_MS, its own row — itself and the icons of
 * its home screen — aside; nothing else of them).
 */
export function statusForDevice(status: Record<string, unknown>, device: Pick<Device, "id" | "name" | "kind" | "of">, opts: { root: string; env: Env; host?: string; local?: string | null; now?: number }): Record<string, unknown> {
  const { work: _w, agents: _a, path: _p, treesRoot: _t, links: _l, linkScheme: _s, browser: _b, ...rest } = status;
  const books = rest.books && typeof rest.books === "object" && !Array.isArray(rest.books) ? (rest.books as Record<string, unknown>) : undefined;
  if (books) {
    const { settings: _bs, ...kept } = books;
    rest.books = kept;
  }
  const prefixes = computerPaths(opts.root, opts.env);
  const scheme = typeof status.linkScheme === "string" ? status.linkScheme : "strom-research";
  const scrubbed = scrub(rest, prefixes, scheme) as Record<string, unknown>;
  const others = deviceRows(devicesList(opts.env), opts.now ?? Date.now()).filter((r) => r.connected && r.id !== device.id && r.id !== device.of).length;
  return { ...scrubbed, device: { id: device.id, name: device.name, kind: device.kind, actions: deviceActions(device, { ...(opts.host ? { host: opts.host } : {}), local: opts.local ?? null }), others } };
}

/** The folders of this computer a value must not name (the research, its trees, the shared folder, home, settings). */
function computerPaths(root: string, env: Env): string[] {
  const out = new Set<string>();
  const add = (p: string | undefined) => {
    if (!p || p.length < 2) return;
    out.add(p);
    out.add(p.replace(/\\/g, "/"));
  };
  add(root);
  try {
    const s = new Settings(env, {});
    add(s.trees()?.value);
    add(s.shared()?.value);
  } catch {
    // the research's folder and home are what there is
  }
  add(env.HOME);
  add(env.USERPROFILE);
  add(env.STROM_CONFIG_DIR);
  add(os.homedir());
  return [...out];
}

/** A value without the strings that name a folder of the computer or a link of strom-research (dropped where they are). */
function scrub(v: unknown, prefixes: string[], scheme: string): unknown {
  if (typeof v === "string") return named(v, prefixes, scheme) ? undefined : v;
  if (Array.isArray(v)) return v.flatMap((x) => (typeof x === "string" && named(x, prefixes, scheme) ? [] : [scrub(x, prefixes, scheme)]));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const s = scrub(x, prefixes, scheme);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  return v;
}

/** Does a string name a folder of the computer or a link of strom-research — anywhere in it (a sentence that says one too)? */
function named(s: string, prefixes: string[], scheme: string): boolean {
  const lower = s.toLowerCase();
  if (lower.startsWith(`${scheme.toLowerCase()}:`) || lower.startsWith("strom-research:") || lower.includes(`${scheme.toLowerCase()}://`) || lower.includes("strom-research://")) return true;
  return prefixes.some((p) => s === p || s.includes(`${p}/`) || s.includes(`${p}\\`) || s.includes(`${p}${path.sep}`) || s.endsWith(p));
}

/** A JSON body read up to `max` bytes; past it: "large". */
function readBody(req: http.IncomingMessage, max: number, done: (body: Buffer | "large") => void): void {
  const said = Number(req.headers["content-length"]);
  if (Number.isFinite(said) && said > max) {
    req.resume();
    return done("large");
  }
  const parts: Buffer[] = [];
  let size = 0;
  let big = false;
  req.on("data", (c: Buffer) => {
    if (big) return;
    size += c.length;
    if (size > max) {
      big = true;
      parts.length = 0;
      return;
    }
    parts.push(c);
  });
  req.on("end", () => done(big ? "large" : Buffer.concat(parts)));
  req.on("error", () => {});
}

function parseJson(b: Buffer): unknown {
  try {
    return JSON.parse(b.toString("utf8"));
  } catch {
    return undefined;
  }
}

/**
 * The events of the bridge a device is told (GET /device/events), each as /status through the gateway says things:
 * nothing of the computer. What is the computer's alone — the agent's work (working), as /status drops it — and an
 * event not known here (a newer bridge's, until it is looked at) are not told.
 */
const DEVICE_EVENTS: ReadonlySet<string> = new Set(["hello", "change", "read", "history", "quality", "device", "end"]);

/** An event of the bridge longer than this ends the stream (the bridge's own on the loopback: never one of a device). */
const EVENT_BLOCK_MAX = 64 * 1024 * 1024;

/** How often a stream of events says `: ping` (STROM_DEVICE_PING_MS in a test: testHooks — never elsewhere). */
function pingMs(env: Env): number {
  const asked = Number(env.STROM_DEVICE_PING_MS);
  return testHooks(env) && Number.isInteger(asked) && asked >= 50 ? asked : EVENT_PING_MS;
}

/** A stream of events open for a device (or being opened: counted from its first moment). */
interface EventStream {
  device: Device;
  /** Its row: the device, or the device whose home screen it is the icon of (EVENT_STREAMS_MAX counts the row). */
  row: string;
  /** Its answer begun (200 said to the device). */
  open: boolean;
  pinged: number;
  res: http.ServerResponse;
  /** Told it is unpaired (sealed, as its last event) and closed. */
  unpaired(): void;
  end(why: string): void;
}

/** The copy of the app read once per version (its ETag of its bytes, its gzip made once). */
interface AppCopy {
  dir: string;
  version: string;
  mtimeMs: number;
  size: number;
  etag: string;
  raw: Buffer;
  gz?: Promise<Buffer>;
}

const IMAGE_TYPES: Record<string, string> = { ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp" };

export function deviceGateway(env: Env, note: (text: string) => void): DeviceGateway {
  const nonces = new NonceMemory();
  let copy: AppCopy | undefined;
  let wasOn: boolean | undefined;
  let appAsked = 0;
  const starting = new Map<string, Promise<boolean>>();
  const answer = (res: http.ServerResponse, status: number, body: Record<string, unknown>) => {
    if (res.headersSent) return;
    res.writeHead(status, HEADERS);
    res.end(JSON.stringify(body));
  };

  const appCopy = (files: NonNullable<ReturnType<typeof deviceAppFiles>>): AppCopy | undefined => {
    const index = path.join(files.dir, "index.html");
    let st: fs.Stats;
    try {
      st = fs.statSync(index);
    } catch {
      return undefined;
    }
    if (copy && copy.dir === files.dir && copy.mtimeMs === st.mtimeMs && copy.size === st.size) return copy;
    const raw = fs.readFileSync(index);
    copy = { dir: files.dir, version: files.version, mtimeMs: st.mtimeMs, size: st.size, etag: `"${files.version}-${crypto.createHash("sha256").update(raw).digest("base64url").slice(0, 22)}"`, raw };
    return copy;
  };

  /** GET / and GET /pair: the app for the devices. */
  const serveApp = (req: http.IncomingMessage, res: http.ServerResponse, files: NonNullable<ReturnType<typeof deviceAppFiles>>): boolean => {
    const c = appCopy(files);
    if (!c) return false;
    req.resume();
    const headers: Record<string, string> = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      ETag: c.etag,
      Vary: "Accept-Encoding",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": DEVICE_APP_CSP,
    };
    const match = String(req.headers["if-none-match"] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/^W\//, ""));
    if (match.includes(c.etag)) {
      res.writeHead(304, headers).end();
      return true;
    }
    const gzip = /(?:^|[,\s])gzip(?:\s*;\s*q=(?!0(?:\.0*)?(?:[,\s]|$))[\d.]+)?(?:[,\s]|$)/i.test(String(req.headers["accept-encoding"] ?? ""));
    if (!gzip) {
      res.writeHead(200, { ...headers, "Content-Length": String(c.raw.length) }).end(c.raw);
      return true;
    }
    c.gz ??= new Promise((resolve, reject) => zlib.gzip(c.raw, (e, out) => (e ? reject(e) : resolve(out))));
    c.gz.then(
      (gz) => res.writeHead(200, { ...headers, "Content-Encoding": "gzip", "Content-Length": String(gz.length) }).end(gz),
      () => res.writeHead(200, { ...headers, "Content-Length": String(c.raw.length) }).end(c.raw),
    );
    return true;
  };

  /** GET /manifest.json: the app's own, opened at the gateway's root, its icons under /icons/. */
  const serveManifest = (req: http.IncomingMessage, res: http.ServerResponse): boolean => {
    req.resume();
    const files = servable(env);
    let m: Record<string, unknown> | undefined;
    try {
      const raw = files ? JSON.parse(fs.readFileSync(path.join(files.dir, "manifest.json"), "utf8")) : undefined;
      m = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;
    } catch {
      m = undefined;
    }
    if (!files || !m) {
      answer(res, 404, { code: "phone.not-found" });
      return true;
    }
    const icons = Array.isArray(m.icons)
      ? (m.icons as unknown[]).flatMap((icon) => {
          const src = icon && typeof icon === "object" ? (icon as { src?: unknown }).src : undefined;
          const rel = typeof src === "string" ? iconPath(src) : undefined;
          return rel && fs.existsSync(path.join(files.dir, ...rel.split("/"))) ? [{ ...(icon as Record<string, unknown>), src: `/icons/${rel}` }] : [];
        })
      : undefined;
    const out = { ...m, start_url: "/", scope: "/", ...(icons ? { icons } : {}) };
    res.writeHead(200, { ...HEADERS, "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "no-cache" }).end(JSON.stringify(out));
    return true;
  };

  /** An icon's src of the manifest as the path it was kept at (relative to the app's folder), or undefined. */
  const iconPath = (src: string): string | undefined => {
    const base = deviceAppSource(env);
    if (!base) return undefined;
    try {
      const b = new URL(base);
      const u = new URL(src, new URL("manifest.json", b));
      if (u.origin !== b.origin || u.search || u.hash || !u.pathname.startsWith(b.pathname)) return undefined;
      return safeRel(decodeURIComponent(u.pathname.slice(b.pathname.length)));
    } catch {
      return undefined;
    }
  };

  /** GET /icons/<path>: an icon kept with the app (PNG, SVG, WebP) — nothing else of its folder, nothing outside it. */
  const serveIcon = (req: http.IncomingMessage, res: http.ServerResponse, p: string): boolean => {
    req.resume();
    const files = servable(env);
    let rel: string | undefined;
    try {
      rel = safeRel(decodeURIComponent(p.slice("/icons/".length)));
    } catch {
      rel = undefined;
    }
    const type = rel ? IMAGE_TYPES[path.extname(rel).toLowerCase()] : undefined;
    if (!files || !rel || !type) {
      answer(res, 404, { code: "phone.not-found" });
      return true;
    }
    let bytes: Buffer;
    try {
      const file = path.join(files.dir, ...rel.split("/"));
      const real = fs.realpathSync(file);
      if (!real.startsWith(fs.realpathSync(files.dir) + path.sep)) throw new Error("outside");
      bytes = fs.readFileSync(real);
    } catch {
      answer(res, 404, { code: "phone.not-found" });
      return true;
    }
    res
      .writeHead(200, {
        "Content-Type": type,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        ...(type === "image/svg+xml" ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } : {}),
      })
      .end(bytes);
    return true;
  };

  /** POST /device/pair: the device's pairId and its proof — the answer sealed with its new K. */
  const pair = (req: http.IncomingMessage, res: http.ServerResponse, ask: GatewayAsk) => {
    readBody(req, PAIR_BODY_MAX, (body) => {
      if (body === "large") return answer(res, 413, { code: "device.large" });
      const sent = parseJson(body);
      const s = sent && typeof sent === "object" && !Array.isArray(sent) ? (sent as Record<string, unknown>) : undefined;
      if (!s) return answer(res, 400, { code: "device.bad" });
      const paired = pairDevice(env, { pairId: s.pairId, proof: s.proof, name: s.name, kind: s.kind, userAgent: String(req.headers["user-agent"] ?? ""), address: `http://${ask.host}` });
      if (!paired.ok) return answer(res, paired.error === "device.bad" ? 400 : 410, { code: paired.error });
      // (moved: the same id with a new key — nothing it sent before counts)
      nonces.forget(paired.device.id);
      note(`the device ${paired.device.id} paired (${paired.code ?? paired.mode})`);
      const { said } = deviceTrees(env);
      // the tree whose window made the code (as trees[].id) — the app opens that one; a code of no tree (home, move), or
      // of a tree no longer said here: no field
      const tree = paired.tree && said.some((t) => t.id === paired.tree) ? { tree: paired.tree } : {};
      const sealed = sealPair(paired.key, String(s.pairId), {
        device: { id: paired.device.id, name: paired.device.name, kind: paired.device.kind },
        computer: { name: localName(env) ?? computerName(), label: computerName() },
        trees: said,
        ...tree,
      });
      answer(res, 200, sealed as unknown as Record<string, unknown>);
    });
  };

  /** A tree's bridge: the one running, else started (by a strom of its own, never holding this server) — false: none. */
  const bridgeOf = async (root: string, device: string): Promise<{ port: number; token: string } | undefined> => {
    const { liveRunning, noteLive } = await import("./live.ts");
    const running = liveRunning(root);
    if (running) return running;
    let start = starting.get(root);
    if (!start) {
      noteLive(root, `the bridge started for a device of the home network (${device})`);
      start = new Promise<boolean>((resolve) => {
        spawnRun(root, forApp(env, root), () => {})(["live", "start", "--json"], ({ code }) => resolve(code === 0));
      }).finally(() => starting.delete(root));
      starting.set(root, start);
    }
    await start;
    return liveRunning(root);
  };

  /** A request carried to the bridge: its answer as the device is told it. */
  const carry = (bridge: { port: number; token: string }, r: DeviceRequest, body: Buffer | undefined, device: Device): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> =>
    new Promise((resolve, reject) => {
      const q = r.q && Object.keys(r.q).length ? `?${new URLSearchParams(r.q).toString()}` : "";
      const h = Object.fromEntries(Object.entries(r.h ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
      const headers: Record<string, string> = { Origin: appOrigin(env), "X-Strom-Device": device.id };
      const version = h["x-strom-app-version"]?.trim();
      if (version && isAppVersion(version)) headers["X-Strom-App-Version"] = version;
      const type = h["content-type"];
      if (body) headers["Content-Type"] = type && !/[\r\n]/.test(type) && type.length < 200 ? type : r.b64 !== undefined ? "application/octet-stream" : "application/json";
      const etag = h["if-none-match"];
      if (etag && !/[\r\n]/.test(etag) && etag.length < 200) headers["If-None-Match"] = etag;
      if (body) headers["Content-Length"] = String(body.length);
      const out = http.request({ host: "127.0.0.1", port: bridge.port, method: r.m, path: `/${bridge.token}/${r.p}${q}`, headers, agent: false, timeout: BRIDGE_MS }, (res) => {
        const parts: Buffer[] = [];
        res.on("data", (c: Buffer) => parts.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 502, headers: res.headers, body: Buffer.concat(parts) }));
        res.on("error", reject);
      });
      out.on("timeout", () => out.destroy(new Error("the bridge did not answer in time")));
      out.on("error", reject);
      out.end(body);
    });

  /**
   * What a device asks of the gateway itself (p device/<action>, POST): never carried to a bridge, never judged by its
   * allowlist, its tree not asked for. Each answers [status, body] sealed for the device like any answer.
   * device/conflict/<X>, device/hypothesis/<H>, device/sync/<I>/undo come here by their first part (`rest`: the parts
   * after it) — done as the person by a strom of its own in the tree's folder (asPerson), under the tree's lock.
   */
  type ActionAsk = { device: Device; ask: GatewayAsk; body: unknown; rest: string[]; tree: string; bytes: number };
  type Answer = [number, Record<string, unknown>, Record<string, string>?];
  const actions: Record<string, (a: ActionAsk) => Answer | Promise<Answer>> = {
    // the device's row renamed (the icons of its home screen with it)
    rename: ({ device, body }) => {
      const name = body && typeof body === "object" && !Array.isArray(body) ? deviceName((body as { name?: unknown }).name) : "";
      if (!name) return [400, refusal(`the body: {"name": "1–60 characters"}`, "device.name")];
      const renamed = renameDevice(env, device.id, name, { fromIcon: true });
      if (!renamed) return [401, { code: "device.unpaired" }];
      note(`the device ${renamed.id} renamed by itself`);
      return [200, { device: { id: device.id, name: renamed.name, kind: renamed.kind } }];
    },
    // the device unpaired by itself: its row gone (the icons of its home screen with it) — 401 at its next request
    unpair: ({ device }) => {
      const gone = removeDevice(env, device.id, { fromIcon: true }) ?? [];
      for (const d of gone) {
        nonces.forget(d.id);
        dropDeviceUploads(env, d.id);
      }
      note(`the device ${device.id} unpaired itself`);
      return [200, { unpaired: true }];
    },
    // a code for the icon about to be added to the home screen (iOS: its own storage, its own key), HOME_MS, once
    home: ({ device, ask }) => {
      if (device.of) return [409, refusal("this is the icon of the home screen already", "device.is-home")];
      const code = deviceCode(env, device, "home");
      return [200, { url: `http://${ask.host}/#home.${code.id}.${code.secret}`, expiresAt: code.expiresAt }];
    },
    // a code to move to the computer's name (<name>.local): the same device, a new key there, MOVE_MS, once
    move: ({ device, ask }) => {
      const name = localName(env);
      if (!name) return [409, refusal("the computer has no name on the network: the device stays at its address", "device.no-name")];
      const local = `${name}:${ask.port}`;
      if (ask.host === local) return [409, refusal("the device asks by the computer's name already", "device.named")];
      const code = deviceCode(env, device, "move");
      return [200, { url: `http://${local}/#move.${code.id}.${code.secret}`, expiresAt: code.expiresAt }];
    },
    // a conflict of the person's edit decided on the device: a side taken (never left to an agent from there)
    conflict: (a) =>
      asPerson(a, "X", (id, body, said, decidedOn) => {
        const take = body.take;
        if (take !== "research" && take !== "user") return 'the body: {"take": "research" | "user", "reasoning"?: "…"}';
        const reasoning = said(body.reasoning);
        if (reasoning === null) return "reasoning: text of at most 500 characters";
        return ["conflict", "resolve", id, `--take=${take}`, `--reasoning=${reasoning ?? decidedOn()}`];
      }),
    // a hypothesis decided on the device: a variant, none holds, as proposed, the proposal not taken — opening one again,
    // its support, an objection, a new variant: on the computer alone
    hypothesis: (a) =>
      asPerson(a, "H", (id, body, said, decidedOn) => {
        const keys = Object.keys(body);
        const only = (k: string) => keys.length === 1 && body[k] === true;
        if (only("proposed")) return ["hypothesis", "decide", id, "--proposed", "--from-app"];
        if (only("keepOpen")) return ["hypothesis", "decide", id, "--keep-open", "--from-app"];
        const decision = said(body.decision);
        if (decision === null) return "decision: text of at most 500 characters";
        if (body.abandon === true && keys.every((k) => k === "abandon" || k === "decision")) return ["hypothesis", "decide", id, "--abandon", `--decision=${decision ?? decidedOn()}`, "--from-app"];
        const variant = said(body.variant);
        if (variant === null || (variant === undefined && decision === undefined) || !keys.every((k) => k === "variant" || k === "decision"))
          return 'the body: {"variant"?, "decision"?} | {"proposed": true} | {"abandon": true, "decision"?} | {"keepOpen": true}';
        return ["hypothesis", "decide", id, ...(variant !== undefined ? [`--variant=${variant}`] : []), `--decision=${decision ?? decidedOn()}`, "--from-app"];
      }),
    // a send of the app taken back on the device ({dry: true}: what it would change, nothing written)
    sync: (a) =>
      asPerson(a, "I", (id, body) => {
        if (body.dry !== undefined && typeof body.dry !== "boolean") return 'the body: {} | {"dry": true}';
        return ["sync", "undo", id, ...(body.dry === true ? ["--dry-run"] : [])];
      }, "undo"),
  };

  /**
   * A command of the research run as the person on the device's word (`<kind><digits>` its record, from the path by its
   * shape alone; `tail`: the one part after it): a strom of its own in the tree's folder, for the app (no mark of an
   * agent), the device named on each operation (via) — its --json data and the research's head. Its arguments an array
   * (no shell); a text of the device always the value of its option (--x=…), NFC, of no control character, at most 500.
   */
  const asPerson = (
    a: ActionAsk,
    kind: "X" | "H" | "I",
    argvOf: (id: string, body: Record<string, unknown>, said: (v: unknown) => string | undefined | null, decidedOn: () => string) => string[] | string,
    tail?: string,
  ): Promise<Answer> | Answer => {
    const [raw, ...more] = a.rest;
    if (more.length !== (tail ? 1 : 0) || (tail && more[0] !== tail)) return [404, refusal("no such action of a device", "device.unknown-action", { action: a.rest.join("/").slice(0, 80) })];
    const m = raw ? new RegExp(`^${kind}(\\d{1,9})$`, "i").exec(raw) : null;
    if (!m) return [400, refusal(`the path names a record by its ID: ${kind}0001`, "device.id", { id: (raw ?? "").slice(0, 40) })];
    const id = `${kind}${m[1]!.padStart(4, "0")}`;
    if (a.bytes > ACTION_BODY_MAX) return [400, refusal(`the body: JSON of at most ${ACTION_BODY_MAX} bytes`, "device.body")];
    // (a body that is no JSON: refused as such; none at all: {})
    if (a.bytes && a.body === undefined) return [400, refusal("the body: JSON", "device.body")];
    const body = a.body === undefined ? {} : a.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) return [400, refusal("the body: a JSON object", "device.body")];
    // what only the computer does there (a conflict left to an agent, a resolution of its own, a hypothesis opened again,
    // its support, an objection, a new variant…): any word the action does not take
    const other = Object.keys(body).find((k) => !TAKES[kind].includes(k));
    if (other !== undefined) {
      const action = `${kind === "X" ? "conflict" : kind === "H" ? "hypothesis" : "sync.undo"}.${other.slice(0, 40)}`;
      return [403, { ...refusal(`only on the computer: ${action}`, "device.computer-only", { action }), action }];
    }
    const tree = deviceTrees(env).known.find((t) => t.id === a.tree);
    if (!tree) return [404, refusal("no such research on this computer", "tree.unknown", { tree: a.tree.slice(0, 80) })];
    // (an icon of a home screen as its device: the row)
    const via = clientOfDevice(env, a.device.id) ?? { id: a.device.id, name: a.device.name };
    // "decided on the device <name>", in the research's language: the reasoning of a decision the device gave none
    const decidedOn = () => phrase(langOf(tree.root, env), "device.decided", { name: via.name || via.id });
    const argv = argvOf(id, body as Record<string, unknown>, deviceText, decidedOn);
    if (typeof argv === "string") return [400, refusal(argv, "device.body")];
    const run = spawnRun(tree.root, { ...forApp(env, tree.root), STROM_VIA_DEVICE: via.id, ...(via.name ? { STROM_VIA_DEVICE_NAME: via.name } : {}) }, () => {});
    const receiver = { root: tree.root, env, note, track: () => {}, head: () => (headOf(tree.root) === "nohead" ? "" : headOf(tree.root)), safely: (_q: http.IncomingMessage, _s: http.ServerResponse, fn: () => void) => fn(), run };
    return new Promise<Answer>((resolve) =>
      stromBy(receiver, argv, (status, said) => {
        const code = typeof said.code === "string" ? said.code : "";
        // decided meanwhile (another device, the app, the computer): nothing to decide there any more
        if (kind === "X" && (code === "conflict.decided" || code === "conflict.taken")) return resolve([409, { ...said, code: "conflict.gone" }]);
        if (kind === "H" && code === "hypothesis.decided") return resolve([409, { ...said, code: "hypothesis.gone" }]);
        if (code === "record.none" || code === "sync.not-sync") return resolve([404, said]);
        if (status === 503) return resolve([503, said, { "Retry-After": String(said.retry ?? 5) }]);
        if (status === 200) note(`${argv.slice(0, 3).join(" ")} by the device ${a.device.id}`);
        resolve([status, said]);
      }),
    );
  };

  const deviceAction = (r: DeviceRequest, a: Omit<ActionAsk, "rest" | "tree">): Answer | Promise<Answer> => {
    const [first, ...rest] = r.p.slice("device/".length).split("/");
    const act = first ? actions[first] : undefined;
    // (an action of the record a path names takes its parts; the device's own ones none)
    const ofRecord = first === "conflict" || first === "hypothesis" || first === "sync";
    // what the gateway has of a file being sent (GET device/media/<sha>): the one action that reads
    if (first === "media" && r.m === "GET" && rest.length) return mediaKept(a.device, rest);
    if (!act || !Object.hasOwn(actions, first!) || r.m !== "POST" || (!ofRecord && rest.length) || (ofRecord && !rest.length)) return [404, refusal("no such action of a device", "device.unknown-action", { action: r.p.slice(0, 80) })];
    return act({ ...a, rest, tree: r.tree });
  };

  /** POST /device/x: a sealed request of a paired device, carried to the bridge of its tree; the answer sealed for it. */
  const tunnel = (req: http.IncomingMessage, res: http.ServerResponse, ask: GatewayAsk) => {
    readBody(req, TUNNEL_BODY_MAX, (raw) => {
      if (raw === "large") return answer(res, 413, { code: "device.large" });
      const envelope = parseRequestEnvelope(parseJson(raw));
      if (!envelope) return answer(res, 400, { code: "device.bad" });
      const device = deviceById(env, envelope.d);
      if (!device) {
        nonces.forget(envelope.d);
        return answer(res, 401, { code: "device.unpaired" });
      }
      const key = keyOf(device);
      const r = openRequest(key, envelope);
      // not opened by its key at another address than the device's own: the device moved away from there (its old key
      // gone with it) — unpaired there
      if (!r) return answer(res, device.address && device.address.toLowerCase() !== `http://${ask.host}` ? 401 : 400, { code: device.address && device.address.toLowerCase() !== `http://${ask.host}` ? "device.unpaired" : "device.bad" });
      const fresh = nonces.check(device.id, envelope.t, envelope.n, Date.now());
      // (replay: its nonce taken already — sent again, never carried twice: the device does not send a write again blindly)
      if (!fresh.ok) return answer(res, 409, { code: "device.clock", now: fresh.now, replay: fresh.replay });
      sawDevice(env, device);
      const identity = wantsIdentity(r);
      const sealed = (response: DeviceResponse) => answer(res, 200, sealResponse(key, device.id, envelope.n, response) as unknown as Record<string, unknown>);
      const inner = (status: number, body: Record<string, unknown>) => sealed(responseOf(status, { "Content-Type": "application/json; charset=utf-8" }, Buffer.from(JSON.stringify(body)), { identity }));
      const who: Device = device;
      const sent = r.b64 !== undefined ? Buffer.from(r.b64, "base64url") : r.b !== undefined ? Buffer.from(typeof r.b === "string" ? r.b : JSON.stringify(r.b)) : undefined;
      // a body gzipped (z): unpacked before anything looks at it, never past what the bridge takes at most (a bomb stops there)
      if (r.z === "gzip") {
        return void zlib.gunzip(sent!, { maxOutputLength: SYNC_MAX_BYTES }, (err, unpacked) => {
          if (!err) return carried({ ...r, z: undefined }, unpacked);
          if ((err as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE" || err instanceof RangeError) return inner(413, { ...refusal(`the body unpacked is larger than ${SYNC_MAX_BYTES} bytes`, "device.large", { max: String(SYNC_MAX_BYTES) }), max: SYNC_MAX_BYTES });
          inner(400, refusal("the body (z: gzip): gzip's bytes, base64url", "device.body"));
        });
      }
      carried(r, sent);

      /** The request opened (its body unpacked): the gateway's own action, or carried to the bridge if it may be. */
      function carried(r: DeviceRequest, body: Buffer | undefined): void {
        const device = who;
      // judged by the bytes the bridge gets (a body sent as text or base64 is judged as the JSON it is)
      const judged = body ? parseJson(body) : undefined;
      // what the device asks of the gateway itself (its name, its unpairing, its icon, its move; a decision, an undo)
      if (r.p === "device" || r.p.startsWith("device/")) {
        const done = ([status, said, headers]: Answer) =>
          headers ? sealed(responseOf(status, { "Content-Type": "application/json; charset=utf-8", ...headers }, Buffer.from(JSON.stringify(said)), { identity })) : inner(status, said);
        const got = deviceAction(r, { device, ask, body: judged, bytes: body?.length ?? 0 });
        if (Array.isArray(got)) return done(got);
        return void got.then(done, (e: unknown) => {
          note(`an action of the device ${device.id} failed: ${(e as Error).message}`);
          inner(500, refusal("the request failed on the computer", "device.failed"));
        });
      }
      void (async () => {
        const allowed = deviceAllows(r.m, r.p, judged);
        if (!allowed.ok) return inner(403, { ...refusal(`only on the computer: ${allowed.action}`, "device.computer-only", { action: allowed.action }), action: allowed.action });
        const tree = deviceTrees(env).known.find((t) => t.id === r.tree);
        if (!tree) return inner(404, refusal("no such research on this computer", "tree.unknown", { tree: r.tree.slice(0, 80) }));
        const bridge = await bridgeOf(tree.root, device.id).catch(() => undefined);
        if (!bridge) return inner(502, refusal("the research's bridge did not start", "bridge.down"));
        // the bridge's secret never in a path a device sends
        const checked = deviceAllows(r.m, r.p, judged, bridge.token);
        if (!checked.ok) return inner(403, { ...refusal(`only on the computer: ${checked.action}`, "device.computer-only", { action: checked.action }), action: checked.action });
        let got: Awaited<ReturnType<typeof carry>>;
        try {
          got = await carry(bridge, { ...r, p: checked.path }, body, device);
        } catch (e) {
          note(`a request of the device ${device.id} not carried to the bridge: ${(e as Error).message}`);
          return inner(502, refusal("the research's bridge did not answer", "bridge.down"));
        }
        const headers: Record<string, string> = {};
        const said = (name: string, as: string) => {
          const v = got.headers[name];
          if (typeof v === "string") headers[as] = v;
        };
        said("content-type", "Content-Type");
        said("retry-after", "Retry-After");
        said("etag", "ETag");
        for (const [k, v] of Object.entries(got.headers)) if (k.startsWith("x-strom-") && !k.startsWith("x-strom-pair") && typeof v === "string") headers[k.replace(/(^|-)([a-z])/g, (_m, d: string, c: string) => d + c.toUpperCase())] = v;
        let bytes: Buffer | null = got.body.length ? got.body : null;
        const first = checked.path.split("/")[0];
        if (first === "status" && got.status === 200 && bytes) {
          const parsed = parseJson(bytes);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const name = localName(env);
            bytes = Buffer.from(JSON.stringify(statusForDevice(parsed as Record<string, unknown>, device, { root: tree.root, env, host: ask.host, local: name ? `${name}:${ask.port}` : null })));
          }
        }
        sealed(responseOf(got.status, headers, bytes, { identity }));
      })().catch((e) => {
        note(`a request of the device ${device.id} failed: ${(e as Error).message}`);
        inner(500, refusal("the request failed on the computer", "device.failed"));
      });
      }
    });
  };

  /**
   * PUT /device/media/<sha256>: a large file of a paired device in sealed blocks (devices.mode on). Its open headers
   * X-Strom-Device, -Time, -Nonce (the base of the blocks' nonces), -Tree, -Size, -From (the blocks the gateway has),
   * -App-Version?; its body the meta block (the bridge's headers) and blocks From+1…N. Refused open before it is opened
   * (the headers' shape 400 device.bad, a device not paired 401, a meta block that does not open 400 — 401 at an address
   * the device moved away from —, its time or nonce 409 device.clock); everything after sealed for the device as the
   * tunnel's answers. The blocks opened are kept in <shared>/device-uploads/<device>/<sha>.part (a device goes on from
   * there); the file whole and of its hash is carried to the tree's bridge (PUT <secret>/media/<sha>), its answer sealed.
   */
  const uploading = new Map<string, string>();
  /** The blocks whole the gateway keeps of a file of a device (none: undefined) — what it says and goes on from. */
  const keptOf = (deviceId: string, sha: string): { size: number; have: number } | undefined => {
    const kept = readUpload(env, deviceId, sha);
    let length = -1;
    try {
      length = fs.statSync(uploadFiles(env, deviceId, sha).part).size;
    } catch {
      length = -1;
    }
    if (!kept || kept.blocks < 1 || kept.blocks > mediaBlocks(kept.size) || length < Math.min(kept.blocks * MEDIA_BLOCK, kept.size)) return undefined;
    return { size: kept.size, have: kept.blocks };
  };
  /** Of a file of `size` bytes: the blocks the gateway has (another size kept: none). */
  const mediaHave = (deviceId: string, sha: string, size: number): number => {
    const kept = keptOf(deviceId, sha);
    return kept && kept.size === size ? kept.have : 0;
  };
  const media = (req: http.IncomingMessage, res: http.ServerResponse, ask: GatewayAsk, rawSha: string) => {
    // every answer of a file: one given before its body came whole lets the rest go by, thrown away (answerEarly)
    let answered = false;
    const reply = (status: number, body: Record<string, unknown>) => {
      if (answered || res.headersSent) return;
      answered = true;
      answerEarly(req, res, () => answer(res, status, body));
    };
    const refuse = reply;
    const head = (n: string) => {
      const v = req.headers[n];
      return typeof v === "string" ? v : undefined;
    };
    const num = (v: string | undefined) => (v !== undefined && /^\d{1,16}$/.test(v) ? Number(v) : NaN);
    const d = head("x-strom-device") ?? "";
    const t = num(head("x-strom-time"));
    const n = head("x-strom-nonce") ?? "";
    const treeId = head("x-strom-tree") ?? "";
    const size = num(head("x-strom-size"));
    const from = num(head("x-strom-from"));
    const app = head("x-strom-app-version")?.trim();
    const said = req.headers["content-length"] !== undefined ? num(head("content-length")) : undefined;
    // the shape first, before anything is read or touched: the path of a file is made of the device's id and the hash alone
    const shaped =
      /^[0-9a-fA-F]{64}$/.test(rawSha) &&
      isDeviceId(d) &&
      Number.isSafeInteger(t) &&
      !!fromB64url(n, 12) &&
      !!treeId &&
      treeId.length <= 200 &&
      !/[\u0000-\u001f\u007f]/u.test(treeId) &&
      Number.isSafeInteger(size) &&
      size >= 1 &&
      size <= MEDIA_SIZE_SHAPE &&
      Number.isSafeInteger(from) &&
      from <= mediaBlocks(size) &&
      (app === undefined || app === "" || isAppVersion(app)) &&
      (said === undefined || (Number.isSafeInteger(said) && said >= MEDIA_META + MEDIA_TAG && said <= mediaBodyLength(size, from)));
    if (!shaped) return refuse(400, { code: "device.bad" });
    const sha = rawSha.toLowerCase();
    const device = deviceById(env, d);
    if (!device) {
      nonces.forget(d);
      return refuse(401, { code: "device.unpaired" });
    }
    const key = keyOf(device);
    const away = !!device.address && device.address.toLowerCase() !== `http://${ask.host}`;
    const reader = bodyReader(req);
    const blocks = mediaBlocks(size);
    let release = () => {};
    void (async () => {
      const sealedMeta = await reader.take(MEDIA_META + MEDIA_TAG);
      if (!sealedMeta) return reply(400, { code: "device.bad" });
      const meta = openMediaBlock(key, d, t, fromB64url(n, 12)!, sha, 0, false, sealedMeta);
      if (!meta) {
        reader.drop();
        return reply(away ? 401 : 400, { code: away ? "device.unpaired" : "device.bad" });
      }
      // from here on every answer sealed for the device (its request's nonce, as the tunnel's)
      const sealed = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) => {
        if (res.headersSent) return;
        reply(200, sealResponse(key, device.id, n, responseOf(status, { "Content-Type": "application/json; charset=utf-8", ...headers }, Buffer.from(JSON.stringify(body)), { identity: false })) as unknown as Record<string, unknown>);
      };
      // answered before the body came whole: the rest read and thrown away (a browser still sending is told the answer)
      const done = (status: number, body: Record<string, unknown>, headers?: Record<string, string>) => {
        reader.drop();
        sealed(status, body, headers);
      };
      const fresh = nonces.check(device.id, t, n, Date.now());
      if (!fresh.ok && !fresh.replay) {
        reader.drop();
        return reply(409, { code: "device.clock", now: fresh.now, replay: false });
      }
      // the same request again (a browser sends a PUT again by itself once its connection broke): nothing of it read,
      // written or carried — the device is told, sealed, what the gateway has of the file and goes on from there
      if (!fresh.ok) return done(409, refusal("this request was taken already: send from the blocks the computer has", "media.replay", { have: String(mediaHave(device.id, sha, size)) }));
      sawDevice(env, device);
      const h = parseMediaMeta(meta);
      if (!h) return done(400, refusal("the meta block: {\"h\": {…}} as JSON", "device.bad"));
      // the bridge's headers a device may send for a file, each once, as the bridge takes it (no line break, printable)
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(h)) {
        const lk = k.toLowerCase();
        if (lk === "x-strom-read") return done(403, { ...refusal("only on the computer: media.read", "device.computer-only", { action: "media.read" }), action: "media.read" });
        const as = MEDIA_HEADERS.get(lk);
        if (!as || as in headers || v.length > MEDIA_HEADER_MAX || !/^[ -~]*$/u.test(v)) return done(400, refusal(`the meta block's header ${k.slice(0, 60)}: one of the bridge's for a file, printable ASCII (percent-encoded), at most ${MEDIA_HEADER_MAX} characters`, "device.bad", { header: k.slice(0, 60) }));
        headers[as] = v;
      }
      const tree = deviceTrees(env).known.find((x) => x.id === treeId);
      if (!tree) return done(404, refusal("no such research on this computer", "tree.unknown", { tree: treeId.slice(0, 80) }));
      const max = headers["X-Strom-Zip"] === "1" ? ZIP_MAX : originalMax(env);
      if (size > max) return done(413, { ...refusal(`the file is larger than the research takes (${Math.round(max / 1024 / 1024)} MB)`, "media.large", { mb: String(Math.round(max / 1024 / 1024)) }), max });
      // one file at a time for a device's row (the icons of its home screen with it)
      const row = device.of ?? device.id;
      if (uploading.has(row)) return done(429, refusal("another file of this device is being sent", "device.busy"), { "Retry-After": String(MEDIA_BUSY_RETRY) });
      uploading.set(row, `${device.id}/${sha}`);
      release = () => {
        if (uploading.get(row) === `${device.id}/${sha}`) uploading.delete(row);
      };
      const files = uploadFiles(env, device.id, sha);
      const bytesOf = (k: number) => Math.min(k * MEDIA_BLOCK, size);
      const partLength = () => {
        try {
          return fs.statSync(files.part).size;
        } catch {
          return -1;
        }
      };
      // what the gateway has of this file: its blocks whole (none: from the beginning)
      const kept = readUpload(env, device.id, sha);
      const have = mediaHave(device.id, sha, size);
      if (from > 0 && from !== have) return done(409, refusal(`the computer has ${have} blocks of this file: send from there`, "media.from", { have: String(have) }), undefined);
      if (from === 0 && kept) dropUpload(env, device.id, sha);
      const free = freeBytes(deviceUploadsRoot(env));
      if (free !== undefined && free - (size - bytesOf(from)) < ORIGINAL_RESERVE) return done(507, refusal("the computer's disk is full", "media.full"));
      const at = (k: number) => writeUpload(env, device.id, sha, { size, blocks: k, tree: tree.id, at: new Date().toISOString() });
      let got = from;
      const hash = from === 0 ? crypto.createHash("sha256") : undefined;
      // refused while its blocks came (once its file is closed): what was opened before stays (nothing: nothing kept)
      let refused: [number, Record<string, unknown>] | undefined;
      const failed = (status: number, body: Record<string, unknown>) => {
        if (got === 0) dropUpload(env, device.id, sha);
        done(status, body);
      };
      try {
        at(from);
        const fh = await fs.promises.open(files.part, from === 0 ? "w" : "r+", 0o600);
        try {
          try {
            await fh.chmod(0o600);
          } catch {
            // Windows: the user's folder is theirs
          }
          await fh.truncate(bytesOf(from));
          for (let i = from + 1; i <= blocks; i++) {
            if (!(await reader.more())) break;
            const sealedBlock = await reader.take(mediaBlockLength(size, i) + MEDIA_TAG);
            if (!sealedBlock) {
              await fh.truncate(bytesOf(got));
              refused = [400, refusal(`block ${i} ended before its end`, "device.bad", { have: String(got) })];
              break;
            }
            const plain = openMediaBlock(key, device.id, t, fromB64url(n, 12)!, sha, i, i === blocks, sealedBlock);
            if (!plain) {
              await fh.truncate(bytesOf(got));
              refused = [400, refusal(`block ${i} does not open: not that block of this request`, "device.bad", { have: String(got) })];
              break;
            }
            await fh.write(plain, 0, plain.length, (i - 1) * MEDIA_BLOCK);
            hash?.update(plain);
            got = i;
            at(got);
          }
        } finally {
          await fh.close();
        }
      } catch (e) {
        if (isDiskFull(e)) return failed(507, refusal("the computer's disk is full", "media.full"));
        throw e;
      }
      if (refused) return failed(...refused);
      if (got < blocks) {
        // the request ended before the file's last block: the device goes on from what the gateway has
        if (reader.broken) return;
        return sealed(200, { sha, have: got, size });
      }
      // more than the file's blocks: refused (what was opened stays — the device sends From = N to have it delivered)
      if (await reader.more()) {
        return done(400, refusal("the body goes on past the file's last block", "device.bad", { have: String(got) }));
      }
      // unpaired meanwhile: nothing of it delivered, nothing kept
      if (!deviceById(env, device.id)) {
        dropDeviceUploads(env, device.id);
        return reply(401, { code: "device.unpaired" });
      }
      const whole = hash ? hash.digest("hex") : await hashFile(files.part);
      if (whole !== sha || partLength() !== size) {
        dropUpload(env, device.id, sha);
        return sealed(409, refusal("the file sent is not of its SHA-256: send it again from the beginning", "media.hash"));
      }
      const bridge = await bridgeOf(tree.root, device.id).catch(() => undefined);
      if (!bridge) return sealed(502, refusal("the research's bridge did not start", "bridge.down"));
      // the bridge's secret never in what a device sends (as it is, or percent-encoded)
      if (Object.values(headers).some((v) => v.includes(bridge.token) || decodedSafe(v).includes(bridge.token))) {
        dropUpload(env, device.id, sha);
        return sealed(403, { ...refusal("only on the computer: path", "device.computer-only", { action: "path" }), action: "path" });
      }
      let carried: { status: number; headers: http.IncomingHttpHeaders; body: Buffer };
      try {
        carried = await deliver(bridge, sha, size, headers, files.part, device, app);
      } catch (e) {
        note(`a file of the device ${device.id} not carried to the bridge: ${(e as Error).message}`);
        return sealed(502, refusal("the research's bridge did not answer", "bridge.down"));
      }
      // taken (or refused for good): nothing kept; busy, slow or failing on the computer: kept for From = N
      if ((carried.status >= 200 && carried.status < 300) || (carried.status >= 400 && carried.status < 500 && carried.status !== 408 && carried.status !== 429)) dropUpload(env, device.id, sha);
      if (carried.status >= 200 && carried.status < 300) note(`a file of the device ${device.id} delivered to ${tree.id} (${size} bytes)`);
      if (!res.headersSent) reply(200, sealResponse(key, device.id, n, responseOf(carried.status, bridgeHeaders(carried.headers), carried.body.length ? carried.body : null, { identity: false })) as unknown as Record<string, unknown>);
    })()
      .catch((e: unknown) => {
        note(`a file of the device ${device.id} failed: ${(e as Error).message}`);
        reader.drop();
        if (!res.headersSent) reply(500, { code: "device.failed" });
      })
      .finally(() => release());
  };

  /**
   * The file kept, whole, carried to the bridge as the Strom app on the computer sends one: its answer. A bridge may
   * answer before it took the whole file (refused it, had it already): its answer is the answer, nothing more is sent —
   * a connection it closes under the rest never leaves the file waiting for room that does not come (the file stopped
   * half-sent, the device's request never answered).
   */
  const deliver = (bridge: { port: number; token: string }, sha: string, size: number, meta: Record<string, string>, part: string, device: Device, app: string | undefined): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> =>
    new Promise((resolve, reject) => {
      const headers: Record<string, string> = { ...meta, Origin: appOrigin(env), "X-Strom-Device": device.id, "Content-Type": "application/octet-stream", "Content-Length": String(size) };
      if (app && isAppVersion(app)) headers["X-Strom-App-Version"] = app;
      let answered: { status: number; headers: http.IncomingHttpHeaders; body: Buffer } | undefined;
      let response: http.IncomingMessage | undefined;
      let read = false;
      let over = false;
      // answered and the file read to its end (or let go): only then is it said (and its .part may go, Windows too)
      const settle = () => {
        if (answered && read && !over) {
          over = true;
          resolve(answered);
        }
      };
      // failed before the bridge's answer came whole (after it: its answer stands, its end on its way)
      const fail = (e: Error) => {
        if (over || answered || response?.complete) return;
        over = true;
        file.destroy();
        reject(e);
      };
      const out = http.request({ host: "127.0.0.1", port: bridge.port, method: "PUT", path: `/${bridge.token}/media/${sha}`, headers, agent: false, timeout: MEDIA_BRIDGE_MS }, (got) => {
        response = got;
        const parts: Buffer[] = [];
        got.on("data", (c: Buffer) => parts.push(c));
        got.on("end", () => {
          answered = { status: got.statusCode ?? 502, headers: got.headers, body: Buffer.concat(parts) };
          if (!read) {
            // answered before the file went whole: the rest not sent
            file.unpipe(out);
            file.destroy();
            out.destroy();
          }
          settle();
        });
        got.on("error", fail);
      });
      out.on("timeout", () => out.destroy(new Error("the bridge did not take the file in time")));
      out.on("error", fail);
      // the connection gone with no answer (and no error said): failed — never waited on (an answer come whole ends as
      // its own)
      out.on("close", () => {
        if (!answered && !response?.complete) fail(new Error("the bridge closed the connection before its answer"));
      });
      const file = fs.createReadStream(part);
      file.on("close", () => {
        read = true;
        settle();
      });
      file.on("error", (e) => out.destroy(e));
      file.pipe(out);
    });

  /** What the gateway has of a file of the device (GET device/media/<sha> through the tunnel). */
  const mediaKept = (device: Device, rest: string[]): Answer => {
    const raw = rest[0] ?? "";
    if (rest.length !== 1 || !/^[0-9a-fA-F]{64}$/.test(raw)) return [400, refusal("the path names a file by its SHA-256", "device.id", { id: raw.slice(0, 64) })];
    const sha = raw.toLowerCase();
    const kept = keptOf(device.id, sha);
    return [200, kept ? { sha, size: kept.size, have: kept.have } : { sha, have: 0 }];
  };

  /**
   * GET /device/events?d&t&n&a&tree[&app]: the bridge's events of a tree, each sealed for the device (EventSource sends
   * no header: the proof in the query, a = HMAC-SHA256(K, eventsMessage)). Refused as the tunnel refuses, before the
   * bridge is asked: the query's shape 400 device.bad, a device not paired 401, a proof that does not hold 400 (401 at
   * an address the device moved away from), its time or its nonce (the tunnel's memory: never sent again either way) 409
   * device.clock, a tree not known 404 tree.unknown, a ninth stream of the row 429 device.streams; the bridge not
   * started or not answering 502 bridge.down. Each event `data: {"n", "c"}`, its AAD strom-device/1|d|n|event|<order>.
   */
  const streams = new Set<EventStream>();
  const events = (req: http.IncomingMessage, res: http.ServerResponse, ask: GatewayAsk) => {
    req.resume();
    const q = ask.url.searchParams;
    const d = q.get("d") ?? "";
    const t = /^\d{1,16}$/.test(q.get("t") ?? "") ? Number(q.get("t")) : NaN;
    const n = q.get("n") ?? "";
    const a = q.get("a");
    const treeId = q.get("tree") ?? "";
    const app = q.get("app") ?? undefined;
    if (!d || d.length > 40 || !Number.isSafeInteger(t) || !fromB64url(n, 12) || !fromB64url(a, 32) || !treeId || treeId.length > 200 || (app !== undefined && !isAppVersion(app))) return answer(res, 400, { code: "device.bad" });
    const device = deviceById(env, d);
    if (!device) {
      nonces.forget(d);
      return answer(res, 401, { code: "device.unpaired" });
    }
    const key = keyOf(device);
    if (!eventsProofHolds(key, t, n, treeId, app, a)) {
      // (not by its key at another address than its own: the device moved away from there — unpaired there)
      const away = !!device.address && device.address.toLowerCase() !== `http://${ask.host}`;
      return answer(res, away ? 401 : 400, { code: away ? "device.unpaired" : "device.bad" });
    }
    const fresh = nonces.check(device.id, t, n, Date.now());
    if (!fresh.ok) return answer(res, 409, { code: "device.clock", now: fresh.now, replay: fresh.replay });
    const tree = deviceTrees(env).known.find((x) => x.id === treeId);
    if (!tree) return answer(res, 404, { code: "tree.unknown" });
    const row = device.of ?? device.id;
    if ([...streams].filter((s) => s.row === row).length >= EVENT_STREAMS_MAX) return answer(res, 429, { code: "device.streams", max: EVENT_STREAMS_MAX });
    sawDevice(env, device);
    const name = localName(env);
    const at = { root: tree.root, env, host: ask.host, local: name ? `${name}:${ask.port}` : null };
    const prefixes = computerPaths(tree.root, env);
    let scheme = "strom-research";
    let seq = 0;
    let ended = false;
    let upstream: http.ClientRequest | undefined;
    const send = (event: string, data: unknown) => {
      if (ended || !stream.open) return;
      res.write(`data: ${JSON.stringify(sealEvent(key, device.id, n, seq++, { event, data }))}\n\n`);
    };
    const stream: EventStream = {
      device,
      row,
      open: false,
      pinged: Date.now(),
      res,
      unpaired() {
        if (!stream.open) return stream.end("unpaired");
        send("device", { type: "device", what: "unpaired", id: row, at: new Date().toISOString() });
        stream.end("unpaired");
      },
      end(why) {
        if (ended) return;
        ended = true;
        streams.delete(stream);
        upstream?.destroy();
        if (!stream.open) answer(res, why === "unpaired" ? 401 : 502, { code: why === "unpaired" ? "device.unpaired" : "bridge.down" });
        else res.end();
        note(`the events of ${tree.id} for the device ${device.id} ended: ${why}`);
      },
    };
    streams.add(stream);
    // the device gone (closed, its network away): the bridge's stream with it — none left open
    res.on("close", () => stream.end("the device closed it"));
    // one block of the bridge's stream: its event told sealed, as the device may be told it
    const block = (text: string) => {
      let event = "message";
      const data: string[] = [];
      for (const line of text.split("\n")) {
        if (line.startsWith(":")) continue;
        const i = line.indexOf(":");
        const field = i < 0 ? line : line.slice(0, i);
        const value = i < 0 ? "" : line.slice(i + 1).replace(/^ /, "");
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
      // (a comment — the bridge's own "still here" — is no event: the gateway says its own ping)
      if (!data.length || !DEVICE_EVENTS.has(event)) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.join("\n"));
      } catch {
        return;
      }
      if (event === "hello") {
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
        const status = parsed as Record<string, unknown>;
        if (typeof status.linkScheme === "string") scheme = status.linkScheme;
        return send(event, statusForDevice(status, device, at));
      }
      send(event, scrub(parsed, prefixes, scheme));
    };
    void (async () => {
      const bridge = await bridgeOf(tree.root, device.id).catch(() => undefined);
      if (ended) return;
      if (!bridge) return stream.end("the research's bridge did not start");
      const headers: Record<string, string> = { Origin: appOrigin(env), "X-Strom-Device": device.id, Accept: "text/event-stream" };
      if (app) headers["X-Strom-App-Version"] = app;
      upstream = http.request({ host: "127.0.0.1", port: bridge.port, method: "GET", path: `/${bridge.token}/events`, headers, agent: false }, (got) => {
        if (got.statusCode !== 200) {
          got.resume();
          return stream.end(`the bridge answered ${got.statusCode}`);
        }
        if (ended) return void got.destroy();
        stream.open = true;
        stream.pinged = Date.now();
        res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", Connection: "keep-alive" });
        res.flushHeaders();
        got.setEncoding("utf8");
        let buffer = "";
        got.on("data", (c: string) => {
          buffer += c;
          let i: number;
          while (!ended && (i = buffer.indexOf("\n\n")) >= 0) {
            const text = buffer.slice(0, i);
            buffer = buffer.slice(i + 2);
            block(text);
          }
          if (buffer.length > EVENT_BLOCK_MAX) stream.end("an event of the bridge too long");
        });
        // the bridge ended (stopped, started again with a newer strom): the device connects again
        got.on("end", () => stream.end("the bridge's stream ended"));
        got.on("close", () => stream.end("the bridge's stream closed"));
        got.on("error", () => stream.end("the bridge's stream failed"));
      });
      upstream.on("error", (e) => stream.end(`the bridge's stream: ${e.message}`));
      upstream.end();
    })().catch((e: unknown) => stream.end(`failed: ${(e as Error).message}`));
  };

  /** Each tick: the streams of a device unpaired (or moved: another key) told so and closed; off: all closed; a ping due. */
  const tickStreams = (on: boolean) => {
    if (!streams.size) return;
    if (!on) {
      for (const s of [...streams]) s.end("turned off");
      return;
    }
    const now = Date.now();
    const ping = pingMs(env);
    for (const s of [...streams]) {
      const still = deviceById(env, s.device.id);
      if (!still || still.key !== s.device.key) {
        s.unpaired();
        continue;
      }
      if (s.open && now - s.pinged >= ping) {
        s.pinged = now;
        s.res.write(": ping\n\n");
        // (a device following its events is connected: seen, written at most once a minute)
        sawDevice(env, still);
      }
    }
  };

  /** The files sent in part of devices not paired any more (often), and of those untouched a day (once an hour). */
  let sweptAt = 0;
  let sweptOldAt = 0;
  const sweep = () => {
    const now = Date.now();
    if (now - sweptAt < sweepMs(env)) return;
    sweptAt = now;
    const old = now - sweptOldAt >= 3600_000;
    if (old) sweptOldAt = now;
    try {
      const gone = sweepUploads(env, { paired: new Set(devicesList(env).map((d) => d.id)), busy: new Set(uploading.values()), now, ...(old ? {} : { keepMs: Infinity }) });
      if (gone) note(`files sent in part taken away: ${gone}`);
    } catch (e) {
      note(`the files sent in part not looked through: ${(e as Error).message}`);
    }
  };

  return {
    handle(req, res, ask) {
      const p = ask.url.pathname;
      const on = devicesOn(env);
      if (p === "/device" || p.startsWith("/device/")) {
        if (!on) {
          req.resume();
          answer(res, 404, { code: "device.disabled" });
          return true;
        }
        if (req.method === "GET" && p === "/device/hello") {
          req.resume();
          // name: where a device may find the computer (<name>.local, local: true), else the computer's name; label: to show
          const name = localName(env);
          answer(res, 200, { v: 1, gateway: true, name: name ?? computerName(), label: computerName(), local: !!name, port: ask.port, app: servable(env)?.version ?? null });
          return true;
        }
        const follows = req.method === "GET" && p === "/device/events";
        const sends = req.method === "PUT" && p.startsWith("/device/media/");
        if (follows || sends || (req.method === "POST" && (p === "/device/pair" || p === "/device/x"))) {
          // the gateway's own pages alone (another page of the network neither pairs nor asks nor follows)
          if (req.headers.origin !== undefined && req.headers.origin !== `http://${ask.host}`) {
            req.resume();
            answer(res, 403, { code: "phone.origin" });
            return true;
          }
          if (follows) events(req, res, ask);
          else if (sends) media(req, res, ask, p.slice("/device/media/".length));
          else if (p === "/device/pair") pair(req, res, ask);
          else tunnel(req, res, ask);
          return true;
        }
        req.resume();
        answer(res, 404, { code: "phone.not-found" });
        return true;
      }
      if (!on) return false;
      if (req.method === "GET" && (p === "/" || p === "/pair")) {
        // a phone of the phone's page, or the page asked for: the page
        if (ask.phonePaired || ask.url.searchParams.get("m") === "page") return false;
        const files = servable(env);
        return files ? serveApp(req, res, files) : false;
      }
      if (req.method === "GET" && p === "/manifest.json") return serveManifest(req, res);
      if (req.method === "GET" && p.startsWith("/icons/")) return serveIcon(req, res, p);
      return false;
    },
    tick() {
      const on = devicesOn(env);
      // turned off: a QR code shown before pairs nothing
      if (wasOn && !on) forgetDevicePair(env);
      wasOn = on;
      tickStreams(on);
      if (on) sweep();
      if (!on || Date.now() - appAsked < 60_000) return;
      appAsked = Date.now();
      void ensureDeviceApp(env).then((r) => {
        if (r.result === "fetched") note(`the app for the devices downloaded (${r.version})`);
        else if (r.result === "failed") note(`the app for the devices not downloaded: ${r.error}`);
      });
    },
    busy: () => starting.size > 0 || uploading.size > 0,
    end() {
      for (const s of [...streams]) s.end("the server ended");
    },
    named(host, port) {
      if (!host || !devicesOn(env)) return undefined;
      const name = localName(env);
      const local = name ? `${name}:${port}` : undefined;
      return local && host.toLowerCase() === local ? local : undefined;
    },
  };
}

/** A path of safe parts alone (letters, digits, . _ -; no . or ..; at most 4 deep), or undefined. */
function safeRel(rel: string): string | undefined {
  if (!rel) return undefined;
  const parts = rel.split("/");
  if (parts.length > 4 || parts.some((x) => !/^[A-Za-z0-9._-]{1,100}$/.test(x) || x === "." || x === "..")) return undefined;
  return parts.join("/");
}
