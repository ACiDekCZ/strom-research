// The devices of the home network (spec 094 P3): a phone, a tablet or another computer runs the Strom app from the
// gateway of this computer (the phone's server, core/phone.ts) and reaches the research through it. Tried behind the
// hidden setting devices.mode (the person's alone, in their terminal): off — the default — nothing of it is anywhere.
//
// Pairing: the computer shows a QR code of http://<address>:<port>/pair?m=app#<pairId>.<secret> — the part after # never
// leaves the device's browser. The device derives its key K from the secret (HKDF-SHA256, salt the pairId, info
// "strom-device/1"), proves it holds K (HMAC-SHA256(K, "pair|" + pairId)) and gets the answer sealed with K. Neither the
// secret nor K ever crosses the network; the gateway keeps K (devices.json, the user's alone) to open what the device
// sends and seal what it answers: ChaCha20-Poly1305 (RFC 8439), a fresh 12-byte nonce each time, the context in the AAD.
// base64url without padding everywhere. The Strom app's code of the same is checked against test/fixtures/device-crypto.json.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { configDir, type Env } from "./paths.ts";
import { readJsonIfExists, renameRetrying } from "./json.ts";
import { withLock } from "./lock.ts";
import { loadUserConfig } from "./config.ts";
import { oneLineName } from "./text.ts";
import { notePhone, phoneName } from "./phone.ts";

/** The version of the protocol, in the info of the key and at the head of every AAD. */
export const DEVICE_PROTOCOL = "strom-device/1";
/** A code to pair a device holds this long, for one device. */
export const PAIR_MS = 10 * 60_000;
/** A pairId used is remembered this long (pair.used, not pair.expired, when it comes again). */
const USED_MS = 60 * 60_000;
const USED_KEPT = 20;
/** A request's time may differ from the gateway's by this much. */
export const CLOCK_MS = 2 * 60_000;
/** A nonce of a device is remembered this long: past it the request's time is out of CLOCK_MS anyway. */
export const NONCE_MS = 5 * 60_000;
/** Nonces remembered for one device at most (the oldest forgotten: a request no newer than it is refused). */
const NONCES_KEPT = 20_000;
/** A body of an answer longer than this is gzipped (unless the request says Accept-Encoding: identity). */
export const GZIP_FROM = 1024;
/** A device's name: so many characters at most (whole characters: a letter with its marks, an emoji). */
export const NAME_MAX = 60;
/** A code for the icon of the home screen holds this long (the icon is often added later), for one icon. */
export const HOME_MS = 24 * 3600_000;
/** A code to move a device to the computer's name (<name>.local) holds this long, once. */
export const MOVE_MS = 10 * 60_000;
/** A device seen within this long is connected now (its lastSeenAt is written at most once a minute). */
export const DEVICE_CONNECTED_MS = 90_000;

export type DeviceKind = "phone" | "tablet" | "computer";
export const DEVICE_KINDS: readonly DeviceKind[] = ["phone", "tablet", "computer"];

/**
 * A device paired (devices.json). `key`: K, base64url — the gateway's alone; never said to the bridge or the app.
 * `address`: the gateway's address the device asks at (http://<ip>:<port>, or http://<name>.local:<port> once moved).
 * `of`: the icon on the home screen of that device (iOS keeps an icon's storage apart: a key of its own) — one row with
 * it, renamed and unpaired with it.
 */
export interface Device {
  id: string;
  name: string;
  kind: DeviceKind;
  via: "app";
  pairedAt: string;
  lastSeenAt: string | null;
  address: string;
  key: string;
  of?: string;
}

/** A device as the bridge may say it (devicesList): everything but its key. */
export type DeviceShown = Omit<Device, "key">;

/** The clock of a test (its expiry, its minute, without a race with the time). */
export type Clock = () => number;

// ——— the switch ———

/**
 * Is the gateway of other devices on (devices.mode on)? Read from the user's config file of this computer alone — no
 * variable, no flag, no tree: nothing an agent can set. A config that cannot be read: off.
 */
export function devicesOn(env: Env): boolean {
  try {
    return loadUserConfig(env).devicesMode === "on";
  } catch {
    return false;
  }
}

// ——— files ———

function file(env: Env, name: string): string {
  return path.join(configDir(env), name);
}

function readSafe<T>(f: string): T | undefined {
  try {
    return readJsonIfExists<T>(f);
  } catch {
    return undefined;
  }
}

function isTime(v: unknown): v is string {
  return typeof v === "string" && Number.isFinite(Date.parse(v));
}

/** Written whole (a temp file and a rename) and for strom's user alone from its first byte (0600; Windows: their folder). */
function writePrivate(f: string, value: unknown): void {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = path.join(path.dirname(f), `.${path.basename(f)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    try {
      fs.chmodSync(tmp, 0o600);
    } catch {
      // Windows: the user's folder is theirs
    }
    renameRetrying(tmp, f);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

const B64URL = /^[A-Za-z0-9_-]*$/;

/** base64url bytes of exactly `bytes` (undefined: anything else). */
export function fromB64url(s: unknown, bytes?: number): Buffer | undefined {
  if (typeof s !== "string" || !B64URL.test(s) || s.length % 4 === 1) return undefined;
  const b = Buffer.from(s, "base64url");
  // the one spelling of these bytes (no stray bits in the last character)
  if (b.toString("base64url") !== s) return undefined;
  return bytes === undefined || b.length === bytes ? b : undefined;
}

export function b64url(b: Uint8Array): string {
  return Buffer.from(b).toString("base64url");
}

// ——— keys ———

/** K = HKDF-SHA256(ikm = the secret (32 bytes), salt = the pairId's UTF-8, info = "strom-device/1", 32 bytes). */
export function deviceKey(secret: Uint8Array, pairId: string): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", secret, Buffer.from(pairId, "utf8"), Buffer.from(DEVICE_PROTOCOL, "utf8"), 32));
}

/** The device's proof that it holds K: HMAC-SHA256(K, "pair|" + pairId), base64url. */
export function pairProof(key: Uint8Array, pairId: string): string {
  return crypto.createHmac("sha256", key).update(`pair|${pairId}`, "utf8").digest("base64url");
}

/** A proof checked in constant time. */
export function proofHolds(key: Uint8Array, pairId: string, proof: unknown): boolean {
  const said = fromB64url(proof, 32);
  if (!said) return false;
  return crypto.timingSafeEqual(said, Buffer.from(pairProof(key, pairId), "base64url"));
}

// ——— the code to pair ———

interface PairFile {
  pairId: string;
  secret: string;
  at: string;
  expiresAt: string;
  mode: "app" | "page";
  tree?: string;
  /** pairIds taken lately (pair.used when one comes again). */
  used?: { pairId: string; at: string }[];
}

export interface DevicePair {
  pairId: string;
  secret: string;
  expiresAt: string;
  mode: "app" | "page";
  tree?: string;
}

const PAIR_ID = /^[A-Za-z0-9_-]{22}$/;

function readPairFile(env: Env): PairFile | undefined {
  const p = readSafe<Record<string, unknown>>(file(env, "device-pair.json"));
  if (!p) return undefined;
  const used = Array.isArray(p.used) ? (p.used as unknown[]).filter((u): u is { pairId: string; at: string } => !!u && typeof u === "object" && typeof (u as { pairId?: unknown }).pairId === "string" && isTime((u as { at?: unknown }).at)) : [];
  const code = typeof p.pairId === "string" && PAIR_ID.test(p.pairId) && fromB64url(p.secret, 32) && isTime(p.expiresAt) && isTime(p.at);
  return {
    pairId: code ? (p.pairId as string) : "",
    secret: code ? (p.secret as string) : "",
    at: code ? (p.at as string) : "",
    expiresAt: code ? (p.expiresAt as string) : "",
    mode: p.mode === "page" ? "page" : "app",
    ...(code && typeof p.tree === "string" && p.tree ? { tree: p.tree } : {}),
    used,
  };
}

function keptUsed(used: PairFile["used"], now: number): { pairId: string; at: string }[] {
  return (used ?? []).filter((u) => now - Date.parse(u.at) < USED_MS).slice(-USED_KEPT);
}

/**
 * A new code to pair a device: 128 bits of pairId, a secret of 256 bits, PAIR_MS long, for one device — one at a time
 * (a code not used yet is gone with the new one). `mode`: app (the Strom app for the device) or page (the phone's page).
 * `tree`: the tree whose QR code it is. The secret is for the QR code alone: never logged, never sent but in it.
 */
export function devicePairCode(env: Env, opts: { mode?: "app" | "page"; tree?: string } = {}, clock: Clock = Date.now): DevicePair {
  return withLock(file(env, "device-pair.lock"), { owner: "the code to pair a device" }, () => {
    const now = clock();
    const was = readPairFile(env);
    const pairId = crypto.randomBytes(16).toString("base64url");
    const secret = crypto.randomBytes(32).toString("base64url");
    const at = new Date(now).toISOString();
    const expiresAt = new Date(now + PAIR_MS).toISOString();
    const mode = opts.mode === "page" ? "page" : "app";
    const tree = opts.tree && opts.tree.length <= 200 ? { tree: opts.tree } : {};
    writePrivate(file(env, "device-pair.json"), { pairId, secret, at, expiresAt, mode, ...tree, used: keptUsed(was?.used, now) } satisfies PairFile);
    notePhone(env, `a code to pair a device made, it holds until ${expiresAt}`);
    return { pairId, secret, expiresAt, mode, ...tree };
  });
}

/** The code that holds now (the last one made, not used, not expired) — for its QR code shown again. */
export function devicePairNow(env: Env, clock: Clock = Date.now): DevicePair | undefined {
  const p = readPairFile(env);
  if (!p?.pairId || Date.parse(p.expiresAt) <= clock()) return undefined;
  return { pairId: p.pairId, secret: p.secret, expiresAt: p.expiresAt, mode: p.mode, ...(p.tree ? { tree: p.tree } : {}) };
}

/** The code forgotten (the gateway turned off: a QR code shown before pairs nothing). Those used stay remembered. */
export function forgetDevicePair(env: Env, clock: Clock = Date.now): void {
  withLock(file(env, "device-pair.lock"), { owner: "the code to pair a device" }, () => {
    const p = readPairFile(env);
    if (!p) return;
    writePrivate(file(env, "device-pair.json"), { used: keptUsed(p.used, clock()) });
  });
}

/** What the QR code says: the app (or the phone's page) at an address of the gateway, the code after # (never sent by a browser). */
export function devicePairUrl(origin: string, pair: { pairId: string; secret: string; mode?: "app" | "page" }): string {
  return `${origin.replace(/\/+$/, "")}/pair?m=${pair.mode === "page" ? "page" : "app"}#${pair.pairId}.${pair.secret}`;
}

// ——— the devices paired ———

const DEVICE_ID = /^dv_[a-z2-7]{16}$/;

/** Of the shape of a device's id (dv_ and 16 of base32, lower case). */
export function isDeviceId(id: unknown): id is string {
  return typeof id === "string" && DEVICE_ID.test(id);
}

/** A device's name as it is kept: one line, NFC, at most NAME_MAX whole characters; "" when nothing is left. */
export function deviceName(raw: unknown): string {
  return typeof raw === "string" ? oneLineName(raw, NAME_MAX) : "";
}

/** The kind of a device a User-Agent names (an iPad, an Android without "Mobile": a tablet). */
export function kindOf(ua: string | undefined): DeviceKind {
  const u = ua ?? "";
  if (/iPad|Tablet/.test(u) || (/Android/.test(u) && !/Mobile/.test(u))) return "tablet";
  if (/iPhone|iPod|Android|Mobile/.test(u)) return "phone";
  return "computer";
}

function readDevices(env: Env): Device[] {
  const raw = readSafe<{ devices?: unknown }>(file(env, "devices.json"))?.devices;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((d): Device[] => {
    const r = d && typeof d === "object" ? (d as Record<string, unknown>) : undefined;
    if (!r || typeof r.id !== "string" || !DEVICE_ID.test(r.id) || !isTime(r.pairedAt) || !fromB64url(r.key, 32)) return [];
    const name = deviceName(r.name);
    return [
      {
        id: r.id,
        name: name || r.id,
        kind: DEVICE_KINDS.includes(r.kind as DeviceKind) ? (r.kind as DeviceKind) : "computer",
        via: "app",
        pairedAt: r.pairedAt,
        lastSeenAt: isTime(r.lastSeenAt) ? r.lastSeenAt : null,
        address: typeof r.address === "string" ? r.address : "",
        key: r.key as string,
        ...(typeof r.of === "string" && DEVICE_ID.test(r.of) && r.of !== r.id ? { of: r.of } : {}),
      },
    ];
  });
}

function writeDevices(env: Env, devices: Device[]): void {
  writePrivate(file(env, "devices.json"), { devices });
}

function withDevices<T>(env: Env, fn: (devices: Device[]) => T): T {
  return withLock(file(env, "devices.lock"), { owner: "the devices paired" }, () => fn(readDevices(env)));
}

/** The devices paired, without their keys (the bridge says these to the Strom app). */
export function devicesList(env: Env): DeviceShown[] {
  return readDevices(env).map(({ key: _k, ...d }) => d);
}

/** The device of this id, with its key (the gateway's alone); none: not paired, or taken off since. */
export function deviceById(env: Env, id: unknown): Device | undefined {
  if (typeof id !== "string" || !DEVICE_ID.test(id)) return undefined;
  return readDevices(env).find((d) => d.id === id);
}

/**
 * The device a request of the gateway names (its X-Strom-Device), as a send or an operation names it (spec 094 K2.2):
 * the row it is of — an icon of a home screen goes by its device's id and name. None while devices.mode is off, or for
 * an id no device paired here has.
 */
export function clientOfDevice(env: Env, id: unknown): { id: string; name?: string } | undefined {
  if (!devicesOn(env)) return undefined;
  const d = deviceById(env, id);
  if (!d) return undefined;
  const row = d.of ? (deviceById(env, d.of) ?? d) : d;
  const name = deviceName(row.name);
  return { id: row.id, ...(name ? { name } : {}) };
}

/** A device's K as bytes. */
export function keyOf(device: Device): Buffer {
  return Buffer.from(device.key, "base64url");
}

export type PairError = "device.bad" | "pair.used" | "pair.expired";

export type Paired = { ok: true; device: Device; key: Buffer; mode: "app" | "page"; tree?: string; code?: DeviceCodeKind } | { ok: false; error: PairError };

// ——— the codes a paired device asks for: its icon on the home screen, its move to the computer's name ———

export type DeviceCodeKind = "home" | "move";

/** device-codes.json: the codes given to paired devices (beside the QR code, never in its place) and those used lately. */
interface CodeEntry {
  id: string;
  secret: string;
  kind: DeviceCodeKind;
  /** The device it was given to (home: the icon's row; move: the device that moves). */
  of: string;
  at: string;
  expiresAt: string;
}

interface CodesFile {
  codes: CodeEntry[];
  used: { pairId: string; at: string }[];
}

function readCodes(env: Env): CodesFile {
  const raw = readSafe<Record<string, unknown>>(file(env, "device-codes.json"));
  const codes = Array.isArray(raw?.codes)
    ? (raw.codes as unknown[]).flatMap((c): CodeEntry[] => {
        const r = c && typeof c === "object" ? (c as Record<string, unknown>) : undefined;
        if (!r || typeof r.id !== "string" || !PAIR_ID.test(r.id) || !fromB64url(r.secret, 32) || (r.kind !== "home" && r.kind !== "move")) return [];
        if (typeof r.of !== "string" || !DEVICE_ID.test(r.of) || !isTime(r.at) || !isTime(r.expiresAt)) return [];
        return [{ id: r.id, secret: r.secret as string, kind: r.kind, of: r.of, at: r.at, expiresAt: r.expiresAt }];
      })
    : [];
  const used = Array.isArray(raw?.used) ? (raw.used as unknown[]).filter((u): u is { pairId: string; at: string } => !!u && typeof u === "object" && typeof (u as { pairId?: unknown }).pairId === "string" && isTime((u as { at?: unknown }).at)) : [];
  return { codes, used };
}

function withCodes<T>(env: Env, fn: (codes: CodesFile) => T): T {
  return withLock(file(env, "device-codes.lock"), { owner: "the codes of the devices" }, () => fn(readCodes(env)));
}

/**
 * A code for a paired device (device/home, device/move): its id 128 bits (a pairId), its secret 256 bits, paired with
 * as the QR code's (POST /device/pair) — once; home HOME_MS long (a new device, the icon, in the row of `device`),
 * move MOVE_MS (the same device, a new key at a new address). A new code of the same kind for the same device takes
 * the old one's place; the QR code stays as it is. The secret is for the address the device opens alone: never logged.
 */
export function deviceCode(env: Env, device: Pick<Device, "id">, kind: DeviceCodeKind, clock: Clock = Date.now): { id: string; secret: string; expiresAt: string } {
  const code = withCodes(env, (f) => {
    const now = clock();
    const id = crypto.randomBytes(16).toString("base64url");
    const secret = crypto.randomBytes(32).toString("base64url");
    const entry: CodeEntry = { id, secret, kind, of: device.id, at: new Date(now).toISOString(), expiresAt: new Date(now + (kind === "home" ? HOME_MS : MOVE_MS)).toISOString() };
    const kept = f.codes.filter((c) => Date.parse(c.expiresAt) > now && !(c.kind === kind && c.of === device.id));
    writePrivate(file(env, "device-codes.json"), { codes: [...kept, entry], used: keptUsed(f.used, now) } satisfies CodesFile);
    return entry;
  });
  notePhone(env, `a code ${kind === "home" ? "for the icon on the home screen" : "to move to the computer's name"} of the device ${device.id} made, it holds until ${code.expiresAt}`);
  return { id: code.id, secret: code.secret, expiresAt: code.expiresAt };
}

/**
 * POST /device/pair: the device's pairId and proof. The QR code that holds and a proof of its K — the device paired (K
 * kept here, the code used); a code a paired device was given (deviceCode) — home: a new device, the icon, in that
 * device's row (its name and kind), move: that device with the new K at the new address (the old key gone); a wrong
 * proof — device.bad and the code holds still (for the device it was shown to); a code used — pair.used; one unknown,
 * replaced or expired, or of a device unpaired since — pair.expired. `name`: the app's (NFC, NAME_MAX), else from the
 * User-Agent; `kind`: the app's, else from the User-Agent.
 */
export function pairDevice(env: Env, info: { pairId: unknown; proof: unknown; name?: unknown; kind?: unknown; userAgent?: string; address: string }, clock: Clock = Date.now): Paired {
  const pairId = typeof info.pairId === "string" && PAIR_ID.test(info.pairId) ? info.pairId : undefined;
  if (!pairId) return { ok: false, error: "pair.expired" };
  const qr = withLock(file(env, "device-pair.lock"), { owner: "the code to pair a device" }, (): { key: Buffer; mode: "app" | "page"; tree?: string } | PairError | "another" => {
    const now = clock();
    const p = readPairFile(env);
    const used = keptUsed(p?.used, now);
    if (used.some((u) => u.pairId === pairId)) return "pair.used";
    if (!p?.pairId || p.pairId !== pairId) return "another";
    if (Date.parse(p.expiresAt) <= now) return "pair.expired";
    const key = deviceKey(Buffer.from(p.secret, "base64url"), pairId);
    if (!proofHolds(key, pairId, info.proof)) return "device.bad";
    writePrivate(file(env, "device-pair.json"), { used: [...used, { pairId, at: new Date(now).toISOString() }].slice(-USED_KEPT) });
    return { key, mode: p.mode, ...(p.tree ? { tree: p.tree } : {}) };
  });
  // not the QR code: a code a paired device was given (its icon, its move)
  const taken =
    qr !== "another"
      ? qr
      : withCodes(env, (f): { key: Buffer; mode: "app"; code: CodeEntry } | PairError => {
          const now = clock();
          const used = keptUsed(f.used, now);
          if (used.some((u) => u.pairId === pairId)) return "pair.used";
          const code = f.codes.find((c) => c.id === pairId);
          if (!code || Date.parse(code.expiresAt) <= now || !readDevices(env).some((d) => d.id === code.of)) return "pair.expired";
          const key = deviceKey(Buffer.from(code.secret, "base64url"), pairId);
          if (!proofHolds(key, pairId, info.proof)) return "device.bad";
          writePrivate(file(env, "device-codes.json"), { codes: f.codes.filter((c) => c.id !== pairId && Date.parse(c.expiresAt) > now), used: [...used, { pairId, at: new Date(now).toISOString() }].slice(-USED_KEPT) } satisfies CodesFile);
          return { key, mode: "app", code };
        });
  if (typeof taken === "string") return { ok: false, error: taken };
  const at = new Date(clock()).toISOString();
  const code = "code" in taken ? taken.code : undefined;
  const device = withDevices(env, (devices): Device | undefined => {
    if (code?.kind === "move") {
      // the same device at its new address: the new key alone opens what it sends from now on
      const i = devices.findIndex((d) => d.id === code.of);
      if (i < 0) return undefined;
      devices[i] = { ...devices[i]!, key: b64url(taken.key), address: info.address, lastSeenAt: at };
      writeDevices(env, devices);
      return devices[i];
    }
    const parent = code ? devices.find((d) => d.id === code.of) : undefined;
    if (code && !parent) return undefined;
    let id: string;
    do id = `dv_${[...crypto.randomBytes(16)].map((b) => "abcdefghijklmnopqrstuvwxyz234567"[b & 31]).join("")}`;
    while (devices.some((d) => d.id === id));
    const name = parent ? parent.name : deviceName(info.name) || deviceName(phoneName(info.userAgent)) || id;
    const kind = parent ? parent.kind : DEVICE_KINDS.includes(info.kind as DeviceKind) ? (info.kind as DeviceKind) : kindOf(info.userAgent);
    const d: Device = { id, name, kind, via: "app", pairedAt: at, lastSeenAt: at, address: info.address, key: b64url(taken.key), ...(parent ? { of: parent.of ?? parent.id } : {}) };
    writeDevices(env, [...devices, d]);
    return d;
  });
  // the device unpaired between the code taken and now
  if (!device) return { ok: false, error: "pair.expired" };
  notePhone(env, code?.kind === "move" ? `the device ${device.id} moved to ${device.address}` : code ? `the icon ${device.id} of the device ${device.of} paired at ${device.address}` : `the device ${device.id} (${device.kind}) paired at ${device.address}`);
  return { ok: true, device, key: taken.key, mode: taken.mode, ...("tree" in taken && taken.tree ? { tree: taken.tree } : {}), ...(code ? { code: code.kind } : {}) };
}

/** A paired device seen now (written at most once a minute). */
export function sawDevice(env: Env, device: Pick<Device, "id" | "lastSeenAt">, clock: Clock = Date.now): void {
  const now = clock();
  if (device.lastSeenAt && now - Date.parse(device.lastSeenAt) < 60_000 && now >= Date.parse(device.lastSeenAt)) return;
  withDevices(env, (devices) => {
    const i = devices.findIndex((d) => d.id === device.id);
    if (i < 0) return;
    const seen = devices[i]!.lastSeenAt;
    if (seen && now - Date.parse(seen) < 60_000 && now >= Date.parse(seen)) return;
    devices[i] = { ...devices[i]!, lastSeenAt: new Date(now).toISOString() };
    writeDevices(env, devices);
  });
}

/**
 * The row of a device: the device and the icons of its home screen (of). An icon is no row of its own — asked by its
 * id from the computer (the bridge), none; asked by the icon itself (`fromIcon`), its device's row. An icon whose
 * device is gone is a row of its own.
 */
function rowOf(devices: Device[], id: string, fromIcon: boolean): { root: Device; members: Device[] } | undefined {
  const d = devices.find((x) => x.id === id);
  if (!d) return undefined;
  const parent = d.of ? devices.find((x) => x.id === d.of) : undefined;
  if (parent && !fromIcon) return undefined;
  const root = parent ?? d;
  return { root, members: devices.filter((x) => x.id === root.id || x.of === root.id) };
}

/**
 * A device's row renamed (1–NAME_MAX characters, NFC): the device as it is now; none — no such row (an icon's id from
 * the computer, unless `fromIcon`), or no name left.
 */
export function renameDevice(env: Env, id: string, name: unknown, opts: { fromIcon?: boolean } = {}): DeviceShown | undefined {
  const n = deviceName(name);
  if (!n) return undefined;
  return withDevices(env, (devices) => {
    const row = rowOf(devices, id, !!opts.fromIcon);
    if (!row) return undefined;
    const ids = new Set(row.members.map((m) => m.id));
    const renamed = devices.map((d) => (ids.has(d.id) ? { ...d, name: n } : d));
    writeDevices(env, renamed);
    const { key: _k, ...shown } = renamed.find((d) => d.id === row.root.id)!;
    return shown;
  });
}

/**
 * A device's row taken off the paired ones — the device and the icons of its home screen, their keys with them
 * (unpaired) — what was taken (the device first), to be put back in a moment. None: no such row (an icon's id from the
 * computer, unless `fromIcon`).
 */
export function removeDevice(env: Env, id: string, opts: { fromIcon?: boolean } = {}): Device[] | undefined {
  const gone = withDevices(env, (devices) => {
    const row = rowOf(devices, id, !!opts.fromIcon);
    if (!row) return undefined;
    const ids = new Set(row.members.map((m) => m.id));
    writeDevices(env, devices.filter((x) => !ids.has(x.id)));
    return [row.root, ...row.members.filter((m) => m.id !== row.root.id)];
  });
  if (gone) notePhone(env, `the device ${gone[0]!.id} taken off the paired ones${gone.length > 1 ? ` with ${gone.length - 1} icon(s) of its home screen` : ""}`);
  return gone;
}

/** Devices taken off put back as they were (those back already left as they are). */
export function restoreDevice(env: Env, taken: Device | Device[]): void {
  const back = Array.isArray(taken) ? taken : [taken];
  withDevices(env, (devices) => {
    const missing = back.filter((b) => !devices.some((d) => d.id === b.id));
    if (!missing.length) return;
    writeDevices(env, [...devices, ...missing].sort((a, b) => Date.parse(a.pairedAt) - Date.parse(b.pairedAt)));
  });
  if (back[0]) notePhone(env, `the device ${back[0].id} put back`);
}

// ——— the rows the bridge says ———

/** A row of the devices as GET phone says it: the device with the icons of its home screen folded in. */
export interface DeviceRow {
  id: string;
  name: string;
  kind: DeviceKind;
  via: "app";
  pairedAt: string;
  lastSeenAt: string | null;
  /** The device or an icon of it seen within DEVICE_CONNECTED_MS. */
  connected: boolean;
  /** Its address is none of the gateway's now (another IP, another port): it cannot find the computer there. */
  stale: boolean;
  /** It has an icon on its home screen too. */
  home: boolean;
}

/** An address of the gateway as `host:port`, lower case (http:// and a / at the end aside). */
export function hostOf(address: string): string {
  return address.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
}

/**
 * The devices as rows: each icon of a home screen (of) folded into its device's row — connected when the device or an
 * icon is, seen when the newer of them was, `home` when there is one. `hosts`: the gateway's addresses now (host:port);
 * a device asking at none of them is stale (none known: none is).
 */
export function deviceRows(devices: readonly Omit<Device, "key">[], now: number, hosts: readonly string[] = []): DeviceRow[] {
  const ids = new Set(devices.map((d) => d.id));
  const isRow = (d: Omit<Device, "key">) => !d.of || !ids.has(d.of);
  return devices.filter(isRow).map((d) => {
    const members = devices.filter((x) => x.id === d.id || (x.of === d.id && !isRow(x)));
    const seen = members.map((m) => m.lastSeenAt).filter((t): t is string => !!t);
    const lastSeenAt = seen.length ? seen.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : null;
    const connected = seen.some((t) => now - Date.parse(t) < DEVICE_CONNECTED_MS);
    const stale = hosts.length > 0 && !!d.address && !hosts.includes(hostOf(d.address));
    return { id: d.id, name: d.name, kind: d.kind, via: d.via, pairedAt: d.pairedAt, lastSeenAt, connected, stale, home: members.length > 1 };
  });
}

/** An event of the bridge's stream (device.events): what happened to a row of the devices. */
export interface DeviceEvent {
  type: "device";
  what: "paired" | "connected" | "gone" | "renamed" | "unpaired";
  id: string;
  name: string;
  kind: DeviceKind;
  at: string;
}

/** What changed between two looks at the rows: a new row paired, one gone unpaired, a name renamed, connected or gone. */
export function deviceEvents(before: readonly DeviceRow[], after: readonly DeviceRow[], at: string): DeviceEvent[] {
  const out: DeviceEvent[] = [];
  const said = (what: DeviceEvent["what"], d: DeviceRow) => out.push({ type: "device", what, id: d.id, name: d.name, kind: d.kind, at });
  for (const d of after) {
    const was = before.find((b) => b.id === d.id);
    if (!was) {
      said("paired", d);
      continue;
    }
    if (was.name !== d.name) said("renamed", d);
    if (was.connected !== d.connected) said(d.connected ? "connected" : "gone", d);
  }
  for (const b of before) if (!after.some((d) => d.id === b.id)) said("unpaired", b);
  return out;
}

// ——— the cipher ———

/** ChaCha20-Poly1305 (RFC 8439): the ciphertext and its 16-byte tag after it. */
export function seal(key: Uint8Array, nonce: Uint8Array, aad: Uint8Array, plain: Uint8Array): Buffer {
  const c = crypto.createCipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });
  c.setAAD(aad, { plaintextLength: plain.length });
  return Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
}

/** What seal sealed, or undefined when anything of it does not hold (the key, the nonce, the AAD, a byte) — never a throw. */
export function open(key: Uint8Array, nonce: Uint8Array, aad: Uint8Array, sealed: Uint8Array): Buffer | undefined {
  try {
    if (key.length !== 32 || nonce.length !== 12 || sealed.length < 16) return undefined;
    const d = crypto.createDecipheriv("chacha20-poly1305", key, nonce, { authTagLength: 16 });
    d.setAAD(aad, { plaintextLength: sealed.length - 16 });
    d.setAuthTag(sealed.subarray(sealed.length - 16));
    return Buffer.concat([d.update(sealed.subarray(0, sealed.length - 16)), d.final()]);
  } catch {
    return undefined;
  }
}

export function newNonce(): Buffer {
  return crypto.randomBytes(12);
}

const utf8 = (s: string) => Buffer.from(s, "utf8");

/** The AAD of a request: strom-device/1|<d>|<t>|req. */
export function requestAad(deviceId: string, t: number): Buffer {
  return utf8(`${DEVICE_PROTOCOL}|${deviceId}|${t}|req`);
}

/** The AAD of an answer: strom-device/1|<d>|<the request's nonce>|res. */
export function responseAad(deviceId: string, requestNonce: string): Buffer {
  return utf8(`${DEVICE_PROTOCOL}|${deviceId}|${requestNonce}|res`);
}

/** The AAD of the answer to a pairing: strom-device/1|<pairId>|pair. */
export function pairAad(pairId: string): Buffer {
  return utf8(`${DEVICE_PROTOCOL}|${pairId}|pair`);
}

/** The envelope of a request (POST /device/x). */
export interface RequestEnvelope {
  v: 1;
  d: string;
  t: number;
  n: string;
  c: string;
}

/** The envelope of an answer (to a request, to a pairing). */
export interface SealedEnvelope {
  v: 1;
  n: string;
  c: string;
}

/** What a request asks inside: the bridge's method and path (no token), the tree, its query, headers and body. */
export interface DeviceRequest {
  m: string;
  p: string;
  tree: string;
  q?: Record<string, string>;
  h?: Record<string, string>;
  /** A JSON body. */
  b?: unknown;
  /** A binary body, base64url (b or b64, never both). */
  b64?: string;
  /** b64 is gzip's bytes of the body (unpacked by the gateway before anything looks at it). */
  z?: "gzip";
}

/** What an answer says inside: the status, the headers, the body's bytes (base64url, null for none), gzipped or not. */
export interface DeviceResponse {
  s: number;
  h: Record<string, string>;
  b: string | null;
  z?: "gzip";
}

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/** The envelope of a request as sent, its shape checked (before any key is looked for); undefined: device.bad. */
export function parseRequestEnvelope(body: unknown): RequestEnvelope | undefined {
  const r = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : undefined;
  if (!r || r.v !== 1 || typeof r.d !== "string" || !DEVICE_ID.test(r.d) || typeof r.t !== "number" || !Number.isSafeInteger(r.t) || r.t < 0) return undefined;
  if (!fromB64url(r.n, 12) || typeof r.c !== "string" || !fromB64url(r.c)) return undefined;
  return { v: 1, d: r.d, t: r.t, n: r.n as string, c: r.c };
}

function stringRecord(v: unknown): Record<string, string> | undefined | false {
  if (v === undefined) return undefined;
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (typeof x !== "string") return false;
    out[k] = x;
  }
  return out;
}

/** What a request asks, its shape checked; undefined: not a request. */
function asRequest(v: unknown): DeviceRequest | undefined {
  const r = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  if (!r || typeof r.m !== "string" || !METHODS.has(r.m) || typeof r.p !== "string" || typeof r.tree !== "string") return undefined;
  const q = stringRecord(r.q);
  const h = stringRecord(r.h);
  if (q === false || h === false) return undefined;
  if (r.b !== undefined && r.b !== null && r.b64 !== undefined) return undefined;
  if (r.b64 !== undefined && (typeof r.b64 !== "string" || !fromB64url(r.b64))) return undefined;
  // a body gzipped: its bytes in b64 alone
  if (r.z !== undefined && (r.z !== "gzip" || typeof r.b64 !== "string")) return undefined;
  return { m: r.m, p: r.p, tree: r.tree, ...(q ? { q } : {}), ...(h ? { h } : {}), ...(r.b !== undefined && r.b !== null ? { b: r.b } : {}), ...(typeof r.b64 === "string" ? { b64: r.b64 } : {}), ...(r.z === "gzip" ? { z: "gzip" as const } : {}) };
}

function parseJson(b: Buffer | undefined): unknown {
  if (!b) return undefined;
  try {
    return JSON.parse(b.toString("utf8"));
  } catch {
    return undefined;
  }
}

/** A request sealed by a device (the tests play the device; the Strom app does the same). */
export function sealRequest(key: Uint8Array, deviceId: string, t: number, request: DeviceRequest, nonce: Uint8Array = newNonce()): RequestEnvelope {
  return { v: 1, d: deviceId, t, n: b64url(nonce), c: b64url(seal(key, nonce, requestAad(deviceId, t), utf8(JSON.stringify(request)))) };
}

/** A request opened with the key of its device: what it asks, or undefined (sealed by another key, changed, not a request). */
export function openRequest(key: Uint8Array, envelope: RequestEnvelope): DeviceRequest | undefined {
  const nonce = fromB64url(envelope.n, 12);
  const c = fromB64url(envelope.c);
  if (!nonce || !c) return undefined;
  return asRequest(parseJson(open(key, nonce, requestAad(envelope.d, envelope.t), c)));
}

/** Does the request ask its answer not gzipped (Accept-Encoding: identity, any case of the header's name)? */
export function wantsIdentity(request: Pick<DeviceRequest, "h"> | undefined): boolean {
  const h = request?.h ?? {};
  return Object.entries(h).some(([k, v]) => k.toLowerCase() === "accept-encoding" && v.trim().toLowerCase() === "identity");
}

/**
 * What an answer says inside: the body's bytes base64url — gzipped (z: "gzip") when longer than GZIP_FROM, unless
 * the request asked identity.
 */
export function responseOf(status: number, headers: Record<string, string>, body: Uint8Array | null, opts: { identity?: boolean } = {}): DeviceResponse {
  if (!body) return { s: status, h: headers, b: null };
  if (body.length > GZIP_FROM && !opts.identity) return { s: status, h: headers, b: b64url(zlib.gzipSync(body)), z: "gzip" };
  return { s: status, h: headers, b: b64url(body) };
}

/** An answer sealed for the device: a nonce of its own, the request's nonce in its AAD (never the answer of another request). */
export function sealResponse(key: Uint8Array, deviceId: string, requestNonce: string, response: DeviceResponse, nonce: Uint8Array = newNonce()): SealedEnvelope {
  return { v: 1, n: b64url(nonce), c: b64url(seal(key, nonce, responseAad(deviceId, requestNonce), utf8(JSON.stringify(response)))) };
}

/** An answer opened by the device; undefined when it is not the answer to this request, or changed. */
export function openResponse(key: Uint8Array, deviceId: string, requestNonce: string, envelope: unknown): DeviceResponse | undefined {
  const e = envelope && typeof envelope === "object" ? (envelope as Record<string, unknown>) : undefined;
  const nonce = fromB64url(e?.n, 12);
  const c = fromB64url(e?.c);
  if (e?.v !== 1 || !nonce || !c) return undefined;
  const r = parseJson(open(key, nonce, responseAad(deviceId, requestNonce), c)) as Record<string, unknown> | undefined;
  if (!r || typeof r.s !== "number" || (r.b !== null && typeof r.b !== "string") || (r.z !== undefined && r.z !== "gzip")) return undefined;
  const h = stringRecord(r.h);
  if (!h) return undefined;
  return { s: r.s, h, b: r.b as string | null, ...(r.z === "gzip" ? { z: "gzip" as const } : {}) };
}

/** The body of an answer as bytes (gunzipped when it was gzipped); null for none, undefined when they do not unpack. */
export function responseBody(response: DeviceResponse): Buffer | null | undefined {
  if (response.b === null) return null;
  const b = fromB64url(response.b);
  if (!b) return undefined;
  if (response.z !== "gzip") return b;
  try {
    return zlib.gunzipSync(b);
  } catch {
    return undefined;
  }
}

/** What the answer to a pairing says: the device as paired, the computer, the trees it may open. */
export interface PairAnswer {
  device: { id: string; name: string; kind: DeviceKind };
  /** name: <name>.local where the computer has one (the address a device may move to), else its name; label: its name to show. */
  computer: { name: string; label?: string };
  trees: unknown[];
}

/** The answer to a pairing sealed with the new K. */
export function sealPair(key: Uint8Array, pairId: string, answer: PairAnswer, nonce: Uint8Array = newNonce()): SealedEnvelope {
  return { v: 1, n: b64url(nonce), c: b64url(seal(key, nonce, pairAad(pairId), utf8(JSON.stringify(answer)))) };
}

// ——— the stream of events (GET /device/events) ———

/** Streams of events one device may hold open at once (its row: the device with the icons of its home screen). */
export const EVENT_STREAMS_MAX = 8;
/** A stream of events says `: ping` this often (a comment of SSE: nothing in it). */
export const EVENT_PING_MS = 25_000;

/**
 * What a device signs to open its stream of events (EventSource sends no header: its proof in the query) — every value
 * of the query that steers the stream (its device is its key): `events|<t>|<n>|<tree>|<app or nothing>`.
 */
export function eventsMessage(t: number, n: string, tree: string, app?: string): string {
  return `events|${t}|${n}|${tree}|${app ?? ""}`;
}

/** The proof of a stream of events: HMAC-SHA256(K, eventsMessage), base64url. */
export function eventsProof(key: Uint8Array, t: number, n: string, tree: string, app?: string): string {
  return crypto.createHmac("sha256", key).update(eventsMessage(t, n, tree, app), "utf8").digest("base64url");
}

/** The proof of a stream of events checked in constant time. */
export function eventsProofHolds(key: Uint8Array, t: number, n: string, tree: string, app: string | undefined, proof: unknown): boolean {
  const said = fromB64url(proof, 32);
  if (!said) return false;
  return crypto.timingSafeEqual(said, Buffer.from(eventsProof(key, t, n, tree, app), "base64url"));
}

/**
 * The AAD of an event of a stream: strom-device/1|<d>|<the stream's n>|event|<its order from 0> — an event of another
 * stream, one moved before another or one left out does not open.
 */
export function eventAad(deviceId: string, streamNonce: string, seq: number): Buffer {
  return utf8(`${DEVICE_PROTOCOL}|${deviceId}|${streamNonce}|event|${seq}`);
}

/** An event as the device opens it: the bridge's event's name and its data. */
export interface StreamEvent {
  event: string;
  data: unknown;
}

/** An event sealed for the device: `data: {"n", "c"}` of the stream (no name of the event outside: it is what it says). */
export function sealEvent(key: Uint8Array, deviceId: string, streamNonce: string, seq: number, event: StreamEvent, nonce: Uint8Array = newNonce()): { n: string; c: string } {
  return { n: b64url(nonce), c: b64url(seal(key, nonce, eventAad(deviceId, streamNonce, seq), utf8(JSON.stringify(event)))) };
}

/** An event opened by the device (its order counted from 0 in the stream); undefined when it is not that event of that stream. */
export function openEvent(key: Uint8Array, deviceId: string, streamNonce: string, seq: number, sealed: unknown): StreamEvent | undefined {
  const e = sealed && typeof sealed === "object" ? (sealed as Record<string, unknown>) : undefined;
  const nonce = fromB64url(e?.n, 12);
  const c = fromB64url(e?.c);
  if (!nonce || !c) return undefined;
  const ev = parseJson(open(key, nonce, eventAad(deviceId, streamNonce, seq), c)) as StreamEvent | undefined;
  return ev && typeof ev === "object" && typeof ev.event === "string" ? ev : undefined;
}

// ——— large files (PUT /device/media/<sha256>) ———
//
// A file goes in blocks, each sealed of its own: first the meta block (index 0, MEDIA_META bytes open — the headers of
// the bridge as JSON {"h": {…}} filled up with spaces), then the file's blocks 1…N of MEDIA_BLOCK bytes open (the last
// what is left). The nonce of block i is the request's nonce (its base) with i XORed into its last 4 bytes (big-endian),
// its AAD strom-device/1|<d>|<t>|media|<sha>|<i>|<last> (last 1 for block N alone) — a block of another file, another
// request, moved, left out or said last where it is not does not open.

/** The open bytes of a block of a file (the last one: what is left). */
export const MEDIA_BLOCK = 1024 * 1024;
/** The open bytes of the meta block (its JSON filled up with spaces). */
export const MEDIA_META = 4096;
/** The bytes of a sealed block beyond its open ones (Poly1305's tag). */
export const MEDIA_TAG = 16;

/** How many blocks a file of `size` bytes goes in (N; the meta block aside). */
export function mediaBlocks(size: number): number {
  return Math.ceil(size / MEDIA_BLOCK);
}

/** The open bytes of block i (1…N) of a file of `size` bytes. */
export function mediaBlockLength(size: number, i: number): number {
  return Math.min(MEDIA_BLOCK, size - (i - 1) * MEDIA_BLOCK);
}

/** The bytes a request's body has from block from+1 to block N, the meta block first (all sealed). */
export function mediaBodyLength(size: number, from: number): number {
  const n = mediaBlocks(size);
  const rest = from >= n ? 0 : size - from * MEDIA_BLOCK;
  return MEDIA_META + MEDIA_TAG + rest + (n - Math.min(from, n)) * MEDIA_TAG;
}

/** The nonce of block i: the base with i (32 bits, big-endian) XORed into its last 4 bytes. */
export function mediaBlockNonce(base: Uint8Array, i: number): Buffer {
  const n = Buffer.from(base);
  n.writeUInt32BE((n.readUInt32BE(8) ^ i) >>> 0, 8);
  return n;
}

/** The AAD of block i: strom-device/1|<d>|<t>|media|<sha>|<i>|<1 for the last block, else 0>. */
export function mediaAad(deviceId: string, t: number, sha: string, i: number, last: boolean): Buffer {
  return utf8(`${DEVICE_PROTOCOL}|${deviceId}|${t}|media|${sha}|${i}|${last ? 1 : 0}`);
}

/** The open meta block: {"h": headers} filled up with spaces to MEDIA_META bytes; undefined: longer than that. */
export function mediaMeta(headers: Record<string, string>): Buffer | undefined {
  const json = utf8(JSON.stringify({ h: headers }));
  if (json.length > MEDIA_META) return undefined;
  return Buffer.concat([json, Buffer.alloc(MEDIA_META - json.length, 0x20)]);
}

/** The headers an open meta block says (strings alone; none: {}); undefined: not a meta block. */
export function parseMediaMeta(plain: Buffer): Record<string, string> | undefined {
  if (plain.length !== MEDIA_META) return undefined;
  const m = parseJson(plain) as Record<string, unknown> | undefined;
  if (!m || typeof m !== "object" || Array.isArray(m) || Object.keys(m).some((k) => k !== "h")) return undefined;
  const h = stringRecord(m.h);
  return h === false ? undefined : (h ?? {});
}

/** Block i of a file sealed (the device's side). */
export function sealMediaBlock(key: Uint8Array, deviceId: string, t: number, base: Uint8Array, sha: string, i: number, last: boolean, plain: Uint8Array): Buffer {
  return seal(key, mediaBlockNonce(base, i), mediaAad(deviceId, t, sha, i, last), plain);
}

/** Block i of a file opened (the gateway's side); undefined when it is not that block of that request. */
export function openMediaBlock(key: Uint8Array, deviceId: string, t: number, base: Uint8Array, sha: string, i: number, last: boolean, sealed: Uint8Array): Buffer | undefined {
  return open(key, mediaBlockNonce(base, i), mediaAad(deviceId, t, sha, i, last), sealed);
}

/**
 * The body of a request of a file as a device sends it (the tests play the device; the Strom app does the same): the
 * meta block, then blocks from+1…to (to: N, the whole rest).
 */
export function sealMediaBody(key: Uint8Array, deviceId: string, t: number, base: Uint8Array, sha: string, headers: Record<string, string>, file: Uint8Array, from = 0, to = mediaBlocks(file.length)): Buffer {
  const meta = mediaMeta(headers);
  if (!meta) throw new RangeError(`the meta block is longer than ${MEDIA_META} bytes`);
  const n = mediaBlocks(file.length);
  const parts = [sealMediaBlock(key, deviceId, t, base, sha, 0, false, meta)];
  for (let i = from + 1; i <= Math.min(to, n); i++) parts.push(sealMediaBlock(key, deviceId, t, base, sha, i, i === n, file.subarray((i - 1) * MEDIA_BLOCK, i * MEDIA_BLOCK)));
  return Buffer.concat(parts);
}

/** The answer to a pairing opened by the device; undefined when it does not hold. */
export function openPair(key: Uint8Array, pairId: string, envelope: unknown): PairAnswer | undefined {
  const e = envelope && typeof envelope === "object" ? (envelope as Record<string, unknown>) : undefined;
  const nonce = fromB64url(e?.n, 12);
  const c = fromB64url(e?.c);
  if (e?.v !== 1 || !nonce || !c) return undefined;
  const a = parseJson(open(key, nonce, pairAad(pairId), c)) as PairAnswer | undefined;
  return a && typeof a === "object" && a.device && typeof a.device.id === "string" && a.computer && Array.isArray(a.trees) ? a : undefined;
}

// ——— against a request sent again ———

/** Not fresh: its time off (`replay` false), or its nonce sent already or older than what is remembered (`replay` true). */
export type Fresh = { ok: true } | { ok: false; error: "device.clock"; now: number; replay: boolean };

/**
 * The nonces of the devices seen lately, in the gateway's memory: a request whose time is more than CLOCK_MS from the
 * gateway's, or whose nonce the same device sent in the last NONCE_MS, is refused (409 device.clock with the gateway's
 * time: the app evens out its clock and asks once more). Asked only once the request opened with the device's key —
 * nobody without it fills the memory. Past NONCES_KEPT of one device the oldest is forgotten, and no request older than
 * it is taken any more.
 */
export class NonceMemory {
  private seen = new Map<string, { nonces: Map<string, { at: number; t: number }>; floor: number }>();

  check(deviceId: string, t: number, nonce: string, now: number): Fresh {
    if (!Number.isFinite(t) || Math.abs(t - now) > CLOCK_MS) return { ok: false, error: "device.clock", now, replay: false };
    let mine = this.seen.get(deviceId);
    if (!mine) this.seen.set(deviceId, (mine = { nonces: new Map(), floor: -Infinity }));
    for (const [n, s] of mine.nonces) {
      if (now - s.at <= NONCE_MS) break;
      mine.nonces.delete(n);
    }
    if (mine.nonces.has(nonce) || t <= mine.floor) return { ok: false, error: "device.clock", now, replay: true };
    mine.nonces.set(nonce, { at: now, t });
    while (mine.nonces.size > NONCES_KEPT) {
      const [oldest, s] = mine.nonces.entries().next().value as [string, { at: number; t: number }];
      mine.nonces.delete(oldest);
      mine.floor = Math.max(mine.floor, s.t);
    }
    return { ok: true };
  }

  /** A device unpaired: nothing of it kept. */
  forget(deviceId: string): void {
    this.seen.delete(deviceId);
  }
}

const memory = new NonceMemory();

/** checkFresh of the gateway's process (NonceMemory). */
export function checkFresh(deviceId: string, t: number, nonce: string, now: number = Date.now()): Fresh {
  return memory.check(deviceId, t, nonce, now);
}
