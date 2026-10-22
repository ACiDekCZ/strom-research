// The phone: a phone of the person reaches the research on the local network (a photo of a gravestone, a page of a
// register taken with it goes straight into the research). Its state is this computer's, in strom's settings folder —
// whether the connection is on (phone.json: the person's yes alone, in their terminal or a window of the system), the
// phones paired (phones.json) — and its server is a process of its own (strom phone serve), beside the bridges: it
// listens on the private addresses of the computer's Wi-Fi or cable only (10/8, 172.16/12, 192.168/16 — never every
// address, never a VPN's, never a virtual machine's), answers only devices of that network that ask it by its own
// address, and only the paths it knows. The research's bridges (127.0.0.1) say the state to the Strom app and ask the person in a window to turn it on.

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFile, spawn, spawnSync } from "node:child_process";
import { configDir, type Env } from "./paths.ts";
import { readJsonIfExists, writeJson } from "./json.ts";
import { acquireLock, withLock } from "./lock.ts";
import { canShowDialog, WAIT_SECONDS, yesNoCommand, type DialogText } from "./dialog.ts";
import { diskVersion, stromLauncher } from "./self.ts";
import { VERSION } from "./tree.ts";
import { ui, UI, type UIKey } from "../cli/ui.ts";
import { assetPath, readAsset } from "./assets.ts";
import { Settings } from "./config.ts";
import { phoneSend } from "./phone-send.ts";

/** The port a phone is reached at; taken by another program, the next free one of PORT_TRIES (kept in phone.json). */
export const PHONE_PORT = 47800;
const PORT_TRIES = 20;
/** A no in the window is said for this long, then the connection reads as off. */
const DECLINED_MS = 60_000;
const LOG_BYTES = 256 * 1024;
/** A code to pair a phone holds this long, for one phone. */
export const PAIR_MS = 10 * 60_000;
/** How long a paired phone's key is kept by its browser (the longest a browser keeps a cookie). */
export const PHONE_KEY_DAYS = 400;

/**
 * phone.json: on or off (the person's yes), the port, since when on. `test`: turned on where STROM_PHONE_TEST was set (a
 * test's, on the loopback alone) — on only for a strom of a test, off for every other.
 */
export interface PhoneConfig {
  on: boolean;
  port?: number;
  since?: string;
  test?: true;
}

/**
 * A phone paired (phones.json). `address`: the origin it was paired at; `keyHash`: the SHA-256 of the key its browser
 * keeps (the key itself is nowhere here); `lang`: the language of its page, said by the code it paired with;
 * `homeKeyHash`: the key of its icon on the home screen (an iPhone's web app keeps cookies of its own), gone with it.
 */
export interface PairedPhone {
  id: string;
  name: string;
  pairedAt: string;
  lastSeenAt?: string;
  address: string;
  keyHash?: string;
  homeKeyHash?: string;
  lang?: string;
}

export interface PhoneAddress {
  url: string;
  iface: string;
  kind: "wifi" | "ethernet" | null;
}

export type PhoneErrorCode = "no-lan" | "port-busy" | "bind-failed";

/** phone-run.json: what the server does now, written by it (kept after it ended: the addresses it had). */
export interface PhoneRun {
  pid: number;
  version: string;
  started: string;
  port: number;
  state: "on" | "error";
  error?: { code: PhoneErrorCode; detail: string };
  addresses: PhoneAddress[];
  addressChangedAt?: string;
  lanSeenAt?: string;
  ended?: { at: string; reason: string };
}

/** phone-ask.json: a window that waits for the person's answer (the bridge that showed it, the window's process), or their no. */
interface PhoneAsk {
  at: string;
  bridge?: number;
  dialog?: number;
  declinedAt?: string;
}

export type PhoneStateName = "off" | "confirm" | "declined" | "on" | "error";

/** A phone as the app is told of it. */
export interface PhoneEntry {
  id: string;
  name: string;
  pairedAt: string;
  lastSeenAt: string | null;
  address: string;
  /** Paired at an address the computer no longer has. */
  stale: boolean;
  /** Entries of the same name at an address no longer had, paired before it (a hint; the person decides). */
  maybeReplaces: string[];
}

/** What the bridges say of the phone (GET phone), without what is looked up in the system (phoneProbe). */
export interface PhoneState {
  state: PhoneStateName;
  since: string | null;
  addresses: PhoneAddress[];
  addressChangedAt: string | null;
  lanSeenAt: string | null;
  pair: { expiresAt: string } | null;
  phones: PhoneEntry[];
  /** `waiting`: no server runs — not a failure, it starts again with the research (a session, the bridge, the menu). */
  error: { code: PhoneErrorCode; detail: string; waiting?: true } | null;
  platform: NodeJS.Platform;
}

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

function alive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function phoneConfig(env: Env): PhoneConfig {
  const c = readSafe<Record<string, unknown>>(file(env, "phone.json"));
  const port = typeof c?.port === "number" && Number.isInteger(c.port) && c.port > 0 && c.port < 65536 ? c.port : undefined;
  // turned on by a test: never on for a strom that is none (its server would listen on the computer's network)
  const on = c?.on === true && (c.test !== true || !!phoneTest(env));
  return { on, ...(port ? { port } : {}), ...(on && isTime(c?.since) ? { since: c.since } : {}), ...(on && c?.test === true ? { test: true as const } : {}) };
}

function writeConfig(env: Env, c: PhoneConfig): void {
  const { test: _t, ...rest } = c;
  writeJson(file(env, "phone.json"), c.on && phoneTest(env) ? { ...rest, test: true } : rest);
}

export function pairedPhones(env: Env): PairedPhone[] {
  const raw = readSafe<{ phones?: unknown }>(file(env, "phones.json"))?.phones;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p): PairedPhone[] => {
    const r = p && typeof p === "object" ? (p as Record<string, unknown>) : undefined;
    if (!r || typeof r.id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(r.id) || !isTime(r.pairedAt)) return [];
    return [
      {
        ...r,
        id: r.id,
        name: typeof r.name === "string" ? r.name : "",
        pairedAt: r.pairedAt,
        ...(isTime(r.lastSeenAt) ? { lastSeenAt: r.lastSeenAt } : {}),
        address: typeof r.address === "string" ? r.address : "",
        ...(typeof r.keyHash === "string" && /^[0-9a-f]{64}$/.test(r.keyHash) ? { keyHash: r.keyHash } : {}),
        ...(typeof r.homeKeyHash === "string" && /^[0-9a-f]{64}$/.test(r.homeKeyHash) ? { homeKeyHash: r.homeKeyHash } : {}),
        ...(typeof r.lang === "string" && /^[a-z]{2,3}$/.test(r.lang) ? { lang: r.lang } : {}),
      },
    ];
  });
}

function writePhones(env: Env, phones: PairedPhone[]): void {
  writeJson(file(env, "phones.json"), { phones });
}

export function phoneRun(env: Env): PhoneRun | undefined {
  const r = readSafe<PhoneRun>(file(env, "phone-run.json"));
  return r && typeof r.pid === "number" && Array.isArray(r.addresses) ? r : undefined;
}

function readAsk(env: Env): PhoneAsk | undefined {
  const a = readSafe<PhoneAsk>(file(env, "phone-ask.json"));
  return a && isTime(a.at) ? a : undefined;
}

/** A window that waits now: its process and the bridge that reads its answer both live. */
function asking(a: PhoneAsk | undefined): boolean {
  return !!a && !a.declinedAt && alive(a.dialog) && (!a.bridge || alive(a.bridge));
}

/** What the phone's server and the windows did, beside strom's settings (bounded). */
export function phoneLogFile(env: Env): string {
  return file(env, "phone.log");
}

export function notePhone(env: Env, text: string): void {
  try {
    const f = phoneLogFile(env);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, `${new Date().toISOString()} [${process.pid}] ${text}\n`);
    const size = fs.statSync(f).size;
    if (size > LOG_BYTES) {
      const kept = fs.readFileSync(f).subarray(size - LOG_BYTES / 2);
      fs.writeFileSync(f, kept.subarray(kept.indexOf(10) + 1));
    }
  } catch {
    // a log that cannot be written stops nothing
  }
}

/** An address of a private network (IPv4, also as IPv6 maps it): 10/8, 172.16/12, 192.168/16. */
export function privateIPv4(address: string): boolean {
  const m = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(address);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number) as [number, number, number, number];
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** Wi-Fi or a cable, as the system names its interface (macOS names both en…: unknown). */
export function interfaceKind(name: string, platform: NodeJS.Platform = process.platform): "wifi" | "ethernet" | null {
  if (/^(wl|wlan|wifi)/i.test(name) || /wi-?fi|wlan|wireless/i.test(name)) return "wifi";
  if (platform !== "darwin" && (/^(eth|en)/i.test(name) || /ethernet/i.test(name))) return "ethernet";
  return null;
}

// What is never a home network: a VPN's tunnel (no hardware of its own, or a name of one), a virtual machine's network
// or a container's, a link of the system's own, a mobile operator's (a modem, a phone's tethering: an address of 10.x
// there is of the operator's network). Linux and macOS name them by a prefix; Windows by a name a person may change and
// translate, so its words and the hardware address of its virtual adapters both count.
const VIRTUAL_PREFIX = /^(utun|tun|tap|ppp|ipsec|wg|gif|stf|bridge|vmnet|vnic|vboxnet|virbr|docker|br-|veth|vxlan|zt|tailscale|nordlynx|proton|lxcbr|lxdbr|cni|flannel|cali|kube|ham|awdl|llw|anpi|ap\d|ib|wwan|wwp|rmnet|ccmni|usb\d)/i;
const VIRTUAL_WORDS = new Set(["vpn", "tun", "tap", "wg", "wsl", "ppp", "vethernet", "vmnet", "wintun", "wireguard", "openvpn", "tailscale", "zerotier", "nordlynx", "hamachi", "npcap", "loopback", "bluetooth", "docker", "virtualbox", "vmware", "anyconnect", "globalprotect", "pangp", "forticlient", "fortinet", "protonvpn", "mullvad", "expressvpn", "surfshark", "cloudflare", "warp", "parallels", "cellular", "wwan", "lte", "mobilfunk", "mobilní"]);
// Windows' names of a mobile network: "Cellular", "Mobile Broadband", "Mobilní síť", "Mobilní širokopásmové připojení", "Mobilfunk"
const VIRTUAL_PHRASES = [/hyper-v/i, /host-only/i, /virtual/i, /\(default switch\)/i, /mobile broadband/i, /mobiles breitband/i];
/** Hardware addresses of virtual adapters: TAP-Windows (00:ff), Hyper-V (00:15:5d), VirtualBox's host-only (0a:00:27), Docker (02:42). */
const VIRTUAL_MAC = /^(00:ff|00:15:5d|0a:00:27|02:42)/i;

/** An interface that is no home network (Wi-Fi or a cable): a VPN's, a virtual machine's, a container's. */
export function virtualInterface(name: string, mac: string | undefined, platform: NodeJS.Platform = process.platform): boolean {
  // macOS names Wi-Fi and a cable en0, en1…: anything else (utun, ppp, ipsec, bridge100, vmnet, awdl…) is none
  if (platform === "darwin") return !/^en\d+$/.test(name);
  if (VIRTUAL_PREFIX.test(name)) return true;
  // a tunnel has no hardware address of its own
  if (!mac || /^(00:){5}00$/.test(mac) || VIRTUAL_MAC.test(mac)) return true;
  // Windows: "Local Area Connection* 2" (and so in every language) — a virtual Wi-Fi of the system's (hotspot, Wi-Fi Direct)
  if (name.includes("*")) return true;
  if (VIRTUAL_PHRASES.some((r) => r.test(name.normalize("NFC")))) return true;
  return name
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .some((w) => VIRTUAL_WORDS.has(w));
}

/** Is `ip` on the network of `local` (its mask)? */
function sameNetwork(ip: string, local: string, mask: string): boolean {
  const n = (a: string) => {
    const m = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(a);
    return m ? m.slice(1).reduce((acc, x) => ((acc << 8) | Number(x)) >>> 0, 0) : undefined;
  };
  const [a, b, m] = [n(ip), n(local), n(mask)];
  return a !== undefined && b !== undefined && m !== undefined && ((a & m) >>> 0) === ((b & m) >>> 0);
}

export interface LanAddress {
  ip: string;
  iface: string;
  kind: "wifi" | "ethernet" | null;
  /** The network's mask: who may ask at this address (a device of the same network). */
  mask: string;
}

/** STROM_PHONE_TEST: "loopback" — a test's server on 127.0.0.1 alone; any other value — no network at all. */
function phoneTest(env: Env): "loopback" | "none" | undefined {
  return env.STROM_PHONE_TEST === "loopback" ? "loopback" : env.STROM_PHONE_TEST ? "none" : undefined;
}

/**
 * The computer's addresses a phone may reach it at: private IPv4 of a Wi-Fi or a cable that is up (never loopback, never
 * a VPN's — neither its tunnel nor its shared range 100.64/10 —, never a virtual machine's network, never IPv6), Wi-Fi
 * and a cable first. STROM_PHONE_TEST (tests never bind the computer's network): "loopback" — 127.0.0.1 alone; any
 * other value — no network.
 */
export function lanAddresses(env: Env, ifaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces(), platform: NodeJS.Platform = process.platform): LanAddress[] {
  const test = phoneTest(env);
  if (test === "loopback") return [{ ip: "127.0.0.1", iface: "lo", kind: null, mask: "255.0.0.0" }];
  if (test) return [];
  const out: LanAddress[] = [];
  for (const [name, list] of Object.entries(ifaces)) {
    for (const a of list ?? []) {
      const v4 = a.family === "IPv4" || (a.family as unknown) === 4;
      if (v4 && !a.internal && privateIPv4(a.address) && !virtualInterface(name, a.mac, platform) && !out.some((o) => o.ip === a.address))
        out.push({ ip: a.address, iface: name, kind: interfaceKind(name, platform), mask: a.netmask });
    }
  }
  // Wi-Fi or a cable as the system says first (the window and the code show the first)
  return out.map((a, i) => ({ a, i })).sort((x, y) => Number(x.a.kind === null) - Number(y.a.kind === null) || x.i - y.i).map((x) => x.a);
}

/**
 * Who may ask the server anything: a device of the private network the server is asked at (`local`: its address and
 * mask — a peer of a VPN routed to that address is not of it), never the computer itself (`own`: its addresses — a
 * program of it, an agent too, is no phone); the loopback only in a test.
 */
export function remoteAllowed(remote: string | undefined, env: Env, local?: { ip: string; mask: string }, own: readonly string[] = []): boolean {
  if (!remote) return false;
  if (phoneTest(env) === "loopback" && /^(?:::ffff:)?127\.0\.0\.1$/i.test(remote)) return true;
  const ip = remote.replace(/^::ffff:/i, "");
  if (ip === local?.ip || own.includes(ip)) return false;
  return privateIPv4(remote) && !!local && sameNetwork(remote, local.ip, local.mask);
}

/** Every IPv4 address of this computer (what asks from one of them is the computer itself). */
function ownAddresses(): string[] {
  return Object.values(os.networkInterfaces()).flatMap((list) => (list ?? []).filter((a) => a.family === "IPv4" || (a.family as unknown) === 4).map((a) => a.address));
}

/** Is that process the phone's server (a pid the system gave again is not)? Windows: the note is what there is. */
export function isPhoneServer(pid: number, platform: NodeJS.Platform = process.platform): boolean {
  if (!alive(pid)) return false;
  if (platform === "win32") return true;
  const r = spawnSync("ps", ["-o", "stat=,command=", "-p", String(pid)], { encoding: "utf8", timeout: 10_000 });
  if (r.error || r.status === null) return true;
  const out = (r.stdout ?? "").trim();
  return !out.startsWith("Z") && /\bphone\s+serve\b/.test(out);
}

/** The phone's server when it runs. */
export function phoneRunning(env: Env): PhoneRun | undefined {
  const run = phoneRun(env);
  return run && !run.ended && alive(run.pid) ? run : undefined;
}

/** How long a server just started may take to say itself (phone-run.json) before another may be started. */
const SPAWN_SAYS_MS = 20_000;

/**
 * A server started a moment ago that has not said itself yet (Node starting, its addresses bound): its pid while it
 * lives. Several asking at once (a bridge of each research, a strom just updated) start that one, not one each.
 */
function startedJustNow(env: Env): number | undefined {
  const s = readSafe<{ pid?: unknown; at?: unknown }>(file(env, "phone-spawn.json"));
  if (!s || typeof s.pid !== "number" || typeof s.at !== "string") return undefined;
  const age = Date.now() - Date.parse(s.at);
  return age >= 0 && age < SPAWN_SAYS_MS && alive(s.pid) ? s.pid : undefined;
}

function spawnPhone(env: Env, extra: Record<string, string> = {}): number | undefined {
  const { command, args } = stromLauncher();
  const dir = configDir(env);
  let log: number | "ignore" = "ignore";
  try {
    fs.mkdirSync(dir, { recursive: true });
    log = fs.openSync(phoneLogFile(env), "a");
  } catch {
    // without a log
  }
  const child = spawn(command, [...args, "phone", "serve"], {
    cwd: dir,
    env: { ...(env as NodeJS.ProcessEnv), STROM_SPAWNED: "1", ...extra },
    detached: true,
    stdio: ["ignore", "ignore", log],
    windowsHide: true,
  });
  child.on("error", () => {});
  child.unref();
  if (typeof log === "number") fs.closeSync(log);
  if (child.pid) {
    try {
      writeJson(file(env, "phone-spawn.json"), { pid: child.pid, at: new Date().toISOString() });
    } catch {
      // another may start one meanwhile: the one that gets the server's lock serves, the other ends at once
    }
  }
  return child.pid;
}

/**
 * The server started in the background when the connection is on and none runs (one strom at a time starts it).
 * `waitMs`: how long to wait for it to say its addresses (0 — not at all: a bridge, which must not stop answering).
 */
export function startPhone(env: Env, opts: { waitMs?: number; why?: string } = {}): PhoneRun | undefined {
  const running = phoneRunning(env);
  if (running) return running;
  if (!phoneConfig(env).on) return undefined;
  let release: () => void;
  try {
    release = acquireLock(file(env, "phone-start.lock"), { owner: "starting the phone server", waitMs: opts.waitMs === 0 ? 0 : 15_000, staleMs: 60_000 });
  } catch {
    return phoneRunning(env);
  }
  try {
    const now = phoneRunning(env);
    if (now) return now;
    // one started a moment ago and not said yet: waited for, none started beside it
    let pid = startedJustNow(env);
    if (!pid) {
      if (opts.why) notePhone(env, opts.why);
      pid = spawnPhone(env);
    }
    const waitMs = opts.waitMs ?? 8000;
    for (let waited = 0; pid && waited < waitMs; waited += 50) {
      const run = phoneRun(env);
      if (run?.pid === pid) return run;
      if (!alive(pid)) break;
      sleepSync(50);
    }
    return undefined;
  } finally {
    release();
  }
}

/** Started again where the bridges are (a session, strom updated, the menu): when on and its server is gone. */
export function revivePhone(env: Env, opts: { waitMs?: number } = {}): PhoneRun | undefined {
  if (!phoneConfig(env).on || phoneRunning(env)) return undefined;
  const last = phoneRun(env);
  return startPhone(env, { waitMs: opts.waitMs ?? 0, why: last ? `the server ${last.pid} ${last.ended ? `ended (${last.ended.reason})` : "ended without a word"}: started again` : "on, no server: started" });
}

/** A window that waits for a yes closed (turned off meanwhile); a no said forgotten. */
function cancelAsk(env: Env): void {
  const a = readAsk(env);
  fs.rmSync(file(env, "phone-ask.json"), { force: true });
  if (a?.dialog && !a.declinedAt && alive(a.dialog)) {
    try {
      process.kill(a.dialog);
    } catch {
      // gone meanwhile
    }
  }
}

/**
 * Turned off — by anyone (the person, the app, an agent): its server ends (told by phone.json at its next look, on
 * Windows; a signal elsewhere), a window that waits is closed; the phones paired stay paired. `waitMs`: how long to wait
 * for the server to end before it is ended (0 — not at all: a bridge).
 */
export function stopPhone(env: Env, why: string, opts: { waitMs?: number } = {}): "none" | "stopped" | "killed" {
  const c = phoneConfig(env);
  if (c.on || fs.existsSync(file(env, "phone.json"))) writeConfig(env, { on: false, ...(c.port ? { port: c.port } : {}) });
  cancelAsk(env);
  forgetPairCode(env);
  const run = phoneRunning(env);
  if (!run) return "none";
  notePhone(env, `turned off (${why}): the server ${run.pid} ends`);
  if (process.platform !== "win32" && isPhoneServer(run.pid)) {
    try {
      process.kill(run.pid, "SIGTERM");
    } catch {
      // gone meanwhile
    }
  }
  const waitMs = opts.waitMs ?? 4000;
  if (waitMs === 0) return "stopped";
  for (let waited = 0; waited < waitMs; waited += 50) {
    if (!alive(run.pid)) return "stopped";
    sleepSync(50);
  }
  if (!isPhoneServer(run.pid)) return "stopped";
  try {
    process.kill(run.pid, "SIGKILL");
  } catch {
    // gone meanwhile
  }
  return "killed";
}

/** A server the bridge turned off without waiting, ended if it is still there a moment later. */
export function endPhoneLater(env: Env, pid: number, ms = 4000): void {
  setTimeout(() => {
    if (alive(pid) && !phoneConfig(env).on && isPhoneServer(pid)) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // gone meanwhile
      }
    }
  }, ms).unref();
}

/** The window's text, in the person's language: what a phone will see, at which address (its title the question). */
export function phoneWindowText(env: Env, lang: string): DialogText {
  // the first address, in one sentence (the designer's text, spec 012 §2): only the text and two buttons, No the default
  const ip = lanAddresses(env)[0]?.ip;
  return {
    title: ui(lang, "ui.phone.window.title"),
    question: ip ? ui(lang, "ui.phone.window", { ip }) : ui(lang, "ui.phone.window.noip"),
    yes: ui(lang, "ui.phone.window.yes"),
    no: ui(lang, "ui.phone.window.no"),
  };
}

/**
 * The window that asks the person: a window of the system, or — STROM_PHONE_TEST loopback|none with STROM_ISOLATED=1 and
 * STROM_PHONE_TEST_ANSWER yes|no|wait (tests: a stand-in that answers, never a window; what it turns on is a test's, on
 * the loopback alone, off for any strom that is no test's) — a process standing for one. None where no window can be
 * shown.
 */
function phoneDialog(env: Env, lang: string): { cmd: string; args: string[]; answer: (status: number | null, stdout: string) => boolean | undefined } | undefined {
  const test = (env.STROM_PHONE_TEST === "loopback" || env.STROM_PHONE_TEST === "none") && env.STROM_ISOLATED === "1" && env.STROM_PHONE_TEST_ANSWER;
  if (test === "yes" || test === "no" || test === "wait") {
    const ms = test === "wait" ? WAIT_SECONDS * 1000 : Number(env.STROM_PHONE_TEST_ANSWER_MS ?? 300);
    return { cmd: process.execPath, args: ["-e", `setTimeout(() => process.exit(${test === "yes" ? 0 : 1}), ${ms})`], answer: (status) => status === 0 };
  }
  if (!canShowDialog(env)) return undefined;
  return yesNoCommand(phoneWindowText(env, lang), process.platform, env);
}

/**
 * The person asked in a window, without waiting for the answer (a bridge must go on answering): "confirm" — the window
 * is up (or was already); "on" — on already; "no-dialog" — no window can be shown here (turned on in a terminal:
 * strom phone on). A yes turns it on and starts the server; a no is said for a minute; the window gives up after
 * WAIT_SECONDS (a no).
 */
export function askPhoneOn(env: Env, lang: string, done?: (yes: boolean) => void): "confirm" | "on" | "no-dialog" {
  if (phoneConfig(env).on) return "on";
  if (asking(readAsk(env))) return "confirm";
  const command = phoneDialog(env, lang);
  if (!command) return "no-dialog";
  const child = spawn(command.cmd, command.args, { env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "ignore"], windowsHide: false });
  if (!child.pid) return "no-dialog";
  let out = "";
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (d: string) => (out += d));
  child.on("error", () => {});
  const at = new Date().toISOString();
  writeJson(file(env, "phone-ask.json"), { at, bridge: process.pid, dialog: child.pid });
  notePhone(env, `asked in a window whether to turn on (its process ${child.pid})`);
  const giveUp = setTimeout(() => child.kill(), (WAIT_SECONDS + 10) * 1000);
  giveUp.unref();
  child.on("close", (status) => {
    clearTimeout(giveUp);
    const now = readAsk(env);
    // turned off meanwhile (the window closed by it): nothing to do
    if (!now || now.dialog !== child.pid || now.declinedAt) return done?.(false);
    const yes = command.answer(status, out) === true;
    if (yes) {
      const c = phoneConfig(env);
      writeConfig(env, { on: true, ...(c.port ? { port: c.port } : {}), since: new Date().toISOString() });
      fs.rmSync(file(env, "phone-ask.json"), { force: true });
      notePhone(env, "turned on: yes in the window");
      startPhone(env, { waitMs: 0 });
    } else {
      writeJson(file(env, "phone-ask.json"), { at: now.at, declinedAt: new Date().toISOString() });
      notePhone(env, "not turned on: no in the window, or no answer");
    }
    done?.(yes);
  });
  return "confirm";
}

/** Turned on by the person in their terminal (or a window strom showed there): on, and its server started. */
export function turnPhoneOn(env: Env, why: string): PhoneRun | undefined {
  const c = phoneConfig(env);
  if (!c.on) {
    writeConfig(env, { on: true, ...(c.port ? { port: c.port } : {}), since: new Date().toISOString() });
    cancelAsk(env);
    notePhone(env, `turned on: ${why}`);
  }
  return startPhone(env);
}

function phoneEntries(env: Env, known: string[] | undefined): PhoneEntry[] {
  const phones = pairedPhones(env);
  const stale = (p: PairedPhone) => !!known && !!p.address && !known.includes(p.address);
  return phones.map((p) => ({
    id: p.id,
    name: p.name,
    pairedAt: p.pairedAt,
    lastSeenAt: p.lastSeenAt ?? null,
    address: p.address,
    stale: stale(p),
    maybeReplaces: stale(p)
      ? []
      : phones.filter((q) => q.id !== p.id && stale(q) && q.name.normalize("NFC").toLowerCase() === p.name.normalize("NFC").toLowerCase() && Date.parse(q.pairedAt) < Date.parse(p.pairedAt)).map((q) => q.id),
  }));
}

/** What the bridges say of the phone: the same from every bridge of this computer (all of it is in the settings folder). */
export function phoneState(env: Env): PhoneState {
  const c = phoneConfig(env);
  const run = phoneRun(env);
  const running = run && !run.ended && alive(run.pid) ? run : undefined;
  const base = { addresses: [] as PhoneAddress[], addressChangedAt: null, lanSeenAt: null, pair: null, error: null, platform: process.platform, since: null };
  // the addresses of the last server: a phone paired at another one is stale
  const known = run?.addresses.map((a) => a.url);
  const phones = phoneEntries(env, known);
  if (c.on) {
    if (running) {
      return {
        ...base,
        state: running.state === "error" ? "error" : "on",
        since: c.since ?? null,
        addresses: running.addresses,
        addressChangedAt: running.addressChangedAt ?? null,
        lanSeenAt: running.lanSeenAt ?? null,
        error: running.state === "error" ? (running.error ?? { code: "bind-failed", detail: "" }) : null,
        pair: running.state === "on" && pairExpires(env) ? { expiresAt: pairExpires(env)! } : null,
        phones,
      };
    }
    // just turned on: its server on the way
    if (c.since && Date.now() - Date.parse(c.since) < 15_000) return { ...base, state: "on", since: c.since, phones };
    return { ...base, state: "error", since: c.since ?? null, error: { code: "bind-failed", detail: run?.ended ? `the server ended: ${run.ended.reason}` : "the server does not run", waiting: true }, phones };
  }
  const a = readAsk(env);
  if (asking(a)) return { ...base, state: "confirm", phones };
  if (a?.declinedAt && Date.now() - Date.parse(a.declinedAt) < DECLINED_MS) return { ...base, state: "declined", phones };
  return { ...base, state: "off", phones };
}

/** For /status: on, off (also a window that waits, a no) or an error, and how many phones are paired. */
export function phoneSummary(env: Env): { state: "on" | "error" | "off"; phones: number } {
  const s = phoneState(env);
  return { state: s.state === "on" || s.state === "error" ? s.state : "off", phones: s.phones.length };
}

/** A phone taken off the paired ones (under the lock): what was taken, to be put back in a moment. */
export function removePhone(env: Env, id: string): PairedPhone | undefined {
  return withLock(file(env, "phones.lock"), { owner: "the phones paired" }, () => {
    const phones = pairedPhones(env);
    const gone = phones.find((p) => p.id === id);
    if (gone) writePhones(env, phones.filter((p) => p.id !== id));
    if (gone) notePhone(env, `the phone ${id} taken off the paired ones`);
    return gone;
  });
}

/** A phone taken off put back as it was. */
export function restorePhone(env: Env, phone: PairedPhone): void {
  withLock(file(env, "phones.lock"), { owner: "the phones paired" }, () => {
    const phones = pairedPhones(env);
    if (phones.some((p) => p.id === phone.id)) return;
    writePhones(env, [...phones, phone].sort((a, b) => Date.parse(a.pairedAt) - Date.parse(b.pairedAt)));
    notePhone(env, `the phone ${phone.id} put back`);
  });
}

// Pairing: the Strom app (GET phone/qr.svg of a bridge) or strom phone qr shows a QR code of http://<address>/pair#<code>;
// the phone's camera opens it, the page sends the code (never to the server in its address: the part after # stays in
// the browser, and the page takes it out of its address at once) and gets a key of its own in a cookie only its page
// sends back. The code is one, for one phone, PAIR_MS long; the key is kept here only as its SHA-256.

interface PairFile {
  code: string;
  at: string;
  expiresAt: string;
  /** The tree whose QR code was shown last (its bridge, or strom phone in its folder): the page opens it once paired. */
  tree?: string;
}

function pairMs(env: Env): number {
  // a test's code may hold shorter (its expiry tested without waiting ten minutes)
  const t = Number(env.STROM_PHONE_PAIR_MS);
  return phoneTest(env) && Number.isFinite(t) && t > 0 ? t : PAIR_MS;
}

/** The clock of the code to pair a phone (a test's own: its expiry tested without a race with the time). */
type Clock = () => number;

function readPair(env: Env, clock: Clock = Date.now): PairFile | undefined {
  const p = readSafe<PairFile>(file(env, "phone-pair.json"));
  return p && typeof p.code === "string" && /^[A-Za-z0-9_-]{22}$/.test(p.code) && isTime(p.expiresAt) && Date.parse(p.expiresAt) > clock() ? p : undefined;
}

/** When the code to pair a phone ends, while there is one (never the code). */
export function pairExpires(env: Env, clock: Clock = Date.now): string | undefined {
  return readPair(env, clock)?.expiresAt;
}

/**
 * The code to pair a phone: the one that holds, else a new one (128 bits, PAIR_MS long, kept for strom's user alone).
 * `tree`: the tree whose QR code it is (the last one shown wins: the page opens it once paired).
 */
export function pairCode(env: Env, opts: { tree?: string } = {}, clock: Clock = Date.now): { code: string; expiresAt: string } {
  return withLock(file(env, "phone-pair.lock"), { owner: "the code to pair a phone" }, () => {
    const f = file(env, "phone-pair.json");
    const write = (p: PairFile) => {
      writeJson(f, p);
      try {
        fs.chmodSync(f, 0o600);
      } catch {
        // Windows: the user's folder is theirs
      }
    };
    const now = readPair(env, clock);
    if (now) {
      // the last shown counts: one shown with no tree (outside a tree's folder) opens the tree the page chose
      if (now.tree !== opts.tree) {
        const { tree: _, ...code } = now;
        write({ ...code, ...(opts.tree ? { tree: opts.tree } : {}) });
      }
      return { code: now.code, expiresAt: now.expiresAt };
    }
    const code = crypto.randomBytes(16).toString("base64url");
    const at = new Date(clock());
    const expiresAt = new Date(at.getTime() + pairMs(env)).toISOString();
    write({ code, at: at.toISOString(), expiresAt, ...(opts.tree ? { tree: opts.tree } : {}) });
    notePhone(env, `a code to pair a phone made, it holds until ${expiresAt}`);
    return { code, expiresAt };
  });
}

/** What the QR code says: the page to pair at an address of the server, its language, the code after # (never sent by a browser). */
export function pairUrl(address: string, code: string, lang?: string): string {
  return `${address}/pair${lang ? `?lang=${lang}` : ""}#${code}`;
}

/** The code forgotten (turned off: a QR shown before pairs nothing). */
export function forgetPairCode(env: Env): void {
  fs.rmSync(file(env, "phone-pair.json"), { force: true });
}

const keyHash = (key: string) => crypto.createHash("sha256").update(key, "utf8").digest("hex");

/** The phone and browser a User-Agent names ("iPhone (Safari)", "Android (Chrome)"); "" when it names none. */
export function phoneName(ua: string | undefined): string {
  const u = ua ?? "";
  const device = /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android" : /Macintosh/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows" : /Linux/.test(u) ? "Linux" : "";
  const browser = /EdgiOS|EdgA\/|Edg\//.test(u)
    ? "Edge"
    : /SamsungBrowser/.test(u)
      ? "Samsung Internet"
      : /FxiOS|Firefox\//.test(u)
        ? "Firefox"
        : /CriOS|Chrome\//.test(u)
          ? "Chrome"
          : /Safari\//.test(u)
            ? "Safari"
            : "";
  return device && browser ? `${device} (${browser})` : device || browser;
}

/**
 * The code given back by a phone's page, taken once: right and holding — the phone paired (its key, only now and only
 * to it); anything else — none, and the code still holds for the phone it was shown to.
 */
export function pairPhone(env: Env, code: string, info: { address: string; userAgent?: string; lang?: string }, clock: Clock = Date.now): { phone: PairedPhone; key: string; tree?: string } | undefined {
  const taken = withLock(file(env, "phone-pair.lock"), { owner: "the code to pair a phone" }, () => {
    const p = readPair(env, clock);
    const a = Buffer.from(p?.code ?? "");
    const b = Buffer.from(code);
    if (!p || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return undefined;
    forgetPairCode(env);
    return { tree: p.tree };
  });
  if (!taken) return undefined;
  const key = crypto.randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const phone = withLock(file(env, "phones.lock"), { owner: "the phones paired" }, () => {
    const phones = pairedPhones(env);
    let id: string;
    do id = `ph_${[...crypto.randomBytes(8)].map((b) => "abcdefghijklmnopqrstuvwxyz234567"[b & 31]).join("")}`;
    while (phones.some((p) => p.id === id));
    const p: PairedPhone = { id, name: phoneName(info.userAgent), pairedAt: now, lastSeenAt: now, address: info.address, keyHash: keyHash(key), ...(info.lang ? { lang: info.lang } : {}) };
    writePhones(env, [...phones, p]);
    return p;
  });
  notePhone(env, `the phone ${phone.id} (${phone.name || "no name"}) paired at ${phone.address}`);
  return { phone, key, ...(taken.tree ? { tree: taken.tree } : {}) };
}

/** The phone paired with this key (none: not paired, or taken off since). */
export function phoneByKey(env: Env, key: string | undefined): PairedPhone | undefined {
  if (!key || !/^[A-Za-z0-9_-]{43}$/.test(key)) return undefined;
  const h = keyHash(key);
  return pairedPhones(env).find((p) => p.keyHash === h || p.homeKeyHash === h);
}

/**
 * The icon on the home screen. An iPhone opens it as a web app of its own that does not see Safari's cookie; the page
 * puts this code into its address while it shows how to add the icon, and the icon, opened unpaired, gives it back for a
 * key of its own of the same phone (homeKeyHash). One code at a time, HOME_MS long, taken once, kept as its hash alone,
 * of a phone still paired.
 */
const HOME_MS = 10 * 60_000;

interface HomeFile {
  hash: string;
  phone: string;
  expiresAt: string;
  /** The tree shown as the icon was added: the icon opens it (its web app has none of the browser's storage). */
  tree?: string;
}

export function homeCode(env: Env, phone: PairedPhone, tree?: string): { code: string; expiresAt: string } {
  const code = crypto.randomBytes(16).toString("base64url");
  const expiresAt = new Date(Date.now() + HOME_MS).toISOString();
  withLock(file(env, "phone-pair.lock"), { owner: "the code of a phone's icon" }, () => {
    const f = file(env, "phone-home.json");
    const shown = tree && /^[A-Za-z0-9_-]{1,64}$/.test(tree) ? { tree } : {};
    writeJson(f, { hash: keyHash(code), phone: phone.id, expiresAt, ...shown } satisfies HomeFile);
    try {
      fs.chmodSync(f, 0o600);
    } catch {
      // Windows: the user's folder is theirs
    }
  });
  notePhone(env, `a code for the icon of the phone ${phone.id} made, it holds until ${expiresAt}`);
  return { code, expiresAt };
}

/** The code of an icon given back: right, holding and its phone still paired — a key of the icon's own (once alone). */
export function claimHome(env: Env, code: string): { phone: PairedPhone; key: string; tree?: string } | undefined {
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) return undefined;
  const id = withLock(file(env, "phone-pair.lock"), { owner: "the code of a phone's icon" }, () => {
    const f = file(env, "phone-home.json");
    const h = readSafe<HomeFile>(f);
    if (!h || typeof h.hash !== "string" || typeof h.phone !== "string" || !isTime(h.expiresAt)) return undefined;
    const a = Buffer.from(h.hash);
    const b = Buffer.from(keyHash(code));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return undefined;
    fs.rmSync(f, { force: true });
    return Date.parse(h.expiresAt) > Date.now() ? { phone: h.phone, ...(typeof h.tree === "string" ? { tree: h.tree } : {}) } : undefined;
  });
  if (!id) return undefined;
  const key = crypto.randomBytes(32).toString("base64url");
  const phone = withLock(file(env, "phones.lock"), { owner: "the phones paired" }, () => {
    const phones = pairedPhones(env);
    const i = phones.findIndex((p) => p.id === id.phone);
    if (i < 0) return undefined;
    phones[i] = { ...phones[i]!, homeKeyHash: keyHash(key), lastSeenAt: new Date().toISOString() };
    writePhones(env, phones);
    return phones[i];
  });
  if (!phone) return undefined;
  notePhone(env, `the phone ${phone.id} opened from its icon`);
  return { phone, key, ...(id.tree ? { tree: id.tree } : {}) };
}

/** A paired phone seen now (written at most once a minute). */
export function sawPhone(env: Env, phone: PairedPhone): void {
  if (phone.lastSeenAt && Date.now() - Date.parse(phone.lastSeenAt) < 60_000) return;
  withLock(file(env, "phones.lock"), { owner: "the phones paired" }, () => {
    const phones = pairedPhones(env);
    const i = phones.findIndex((p) => p.id === phone.id);
    if (i < 0) return;
    phones[i] = { ...phones[i]!, lastSeenAt: new Date().toISOString() };
    writePhones(env, phones);
  });
}

/** The name of the cookie of a phone's key: of the port too (a browser gives a cookie to every port of an address). */
export function phoneCookie(port: number): string {
  return `strom_phone_${port}`;
}

/** The languages a page can be in: English and those with a catalog. */
function pageLanguages(): string[] {
  let codes: string[] = [];
  try {
    codes = fs.readdirSync(assetPath("lang")).flatMap((f) => (/^[a-z]{2,3}\.json$/.test(f) ? [f.slice(0, -5)] : []));
  } catch {
    // English alone
  }
  return ["en", ...codes.filter((c) => c !== "en")];
}

/**
 * The language of the phone's page: the paired phone's (the code it paired with said the Strom app's), else the one its
 * address asks (?lang of the QR code), else the research language of this computer (set or found), and the browser's
 * only when that one has no texts — the page shows what the research writes, in its language (never the phone's).
 */
export function pageLang(env: Env, opts: { phone?: PairedPhone; asked?: string | null; acceptLanguage?: string }): string {
  const have = pageLanguages();
  const ok = (l: string | null | undefined) => (l && have.includes(l.toLowerCase()) ? l.toLowerCase() : undefined);
  const set = new Settings(env, {}).lang();
  const browser = (opts.acceptLanguage ?? "")
    .split(",")
    .map((p) => /^\s*([A-Za-z]{2,3})(?:[-_][A-Za-z0-9]+)*\s*(?:;|$)/.exec(p)?.[1])
    .find((l) => ok(l));
  return ok(opts.phone?.lang) ?? ok(opts.asked) ?? ok(set.value) ?? ok(browser) ?? "en";
}

/** The phone's page (assets/phone/index.html) in a language, its script and style allowed by the nonce alone. */
export function phonePage(lang: string, nonce: string): string {
  const texts = Object.fromEntries((Object.keys(UI) as UIKey[]).filter((k) => k.startsWith("ui.phone.page.")).map((k) => [k.slice("ui.phone.page.".length), ui(lang, k)]));
  const json = JSON.stringify(texts).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  // its style and script inside it, each under the nonce (nothing of them can end its element: our own files)
  return (readAsset("phone", "index.html") ?? "<!doctype html><title>Strom</title>")
    .replaceAll("{{LANG}}", lang)
    .replaceAll("{{NONCE}}", nonce)
    .replace("{{TEXTS}}", () => json)
    .replace("{{STYLE}}", () => readAsset("phone", "phone.css") ?? "")
    .replace("{{SCRIPT}}", () => readAsset("phone", "phone.js") ?? "");
}

// What the system says of the network and its firewall (a phone that cannot reach the computer: why), looked up at
// most once in PROBE_MS, in the background; never what decides anything.
const PROBE_MS = 30_000;
type Probe = { network: { category: "private" | "public" | "domain" | null; checkedAt: string } | null; firewall: { on: boolean | null; checkedAt: string } | null };
let probe: { at: number; value: Probe; running?: Promise<Probe> } | undefined;

function output(cmd: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { timeout: 10_000, windowsHide: true, encoding: "utf8" }, (err, stdout) => resolve(err ? undefined : stdout));
    } catch {
      resolve(undefined);
    }
  });
}

async function lookUp(env: Env, platform: NodeJS.Platform): Promise<Probe> {
  const checkedAt = new Date().toISOString();
  if (env.STROM_PHONE_TEST) return { network: null, firewall: null };
  if (platform === "darwin") {
    const out = await output("/usr/libexec/ApplicationFirewall/socketfilterfw", ["--getglobalstate"]);
    return { network: null, firewall: out === undefined ? null : { on: /enabled|State = [12]/i.test(out) ? true : /disabled|State = 0/i.test(out) ? false : null, checkedAt } };
  }
  if (platform === "win32") {
    const out = await output("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$p = Get-NetConnectionProfile | Select-Object -First 1; $c = [string]$p.NetworkCategory; $f = (Get-NetFirewallProfile -Profile $(if ($c -eq 'DomainAuthenticated') { 'Domain' } elseif ($c) { $c } else { 'Public' })).Enabled; Write-Output \"$c|$f\"",
    ]);
    if (out === undefined) return { network: null, firewall: null };
    const [cat, fw] = out.trim().split("|");
    const category = /^private$/i.test(cat ?? "") ? "private" : /^public$/i.test(cat ?? "") ? "public" : /^domain/i.test(cat ?? "") ? "domain" : null;
    return { network: { category, checkedAt }, firewall: { on: /true/i.test(fw ?? "") ? true : /false/i.test(fw ?? "") ? false : null, checkedAt } };
  }
  return { network: null, firewall: null };
}

/** The network and firewall as last looked up (null before the first look); a new look started when due. */
export function phoneProbe(env: Env, platform: NodeJS.Platform = process.platform): Probe {
  const now = Date.now();
  if (!probe || (now - probe.at > PROBE_MS && !probe.running)) {
    const value = probe?.value ?? { network: null, firewall: null };
    const running = lookUp(env, platform).then(
      (v) => ((probe = { at: Date.now(), value: v }), v),
      () => ((probe = { at: Date.now(), value }), value),
    );
    probe = { at: probe?.at ?? 0, value, running };
  }
  return probe.value;
}

/** Looked up now and waited for (strom phone status). */
export async function phoneProbeNow(env: Env, platform: NodeJS.Platform = process.platform): Promise<Probe> {
  phoneProbe(env, platform);
  return (await probe?.running) ?? probe?.value ?? { network: null, firewall: null };
}

function listenOn(ip: string, port: number, handler: http.RequestListener): Promise<{ server?: http.Server; code?: string; detail?: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    // a photo of tens of MB over a slow Wi-Fi: long enough (the headers soon)
    server.requestTimeout = 30 * 60_000;
    server.headersTimeout = 10_000;
    const failed = (e: NodeJS.ErrnoException) => resolve({ code: e.code, detail: `${ip}:${port}: ${e.message}` });
    server.once("error", failed);
    server.listen({ host: ip, port, exclusive: true }, () => {
      server.off("error", failed);
      server.on("error", () => {});
      resolve({ server });
    });
  });
}

/** A cookie of the request's Cookie header. */
function cookieOf(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

/**
 * The phone's server, in the foreground (strom phone serve; strom phone on starts it in the background). Only while the
 * connection is on: it ends when turned off, when another server took over or with a signal, and starts again with a
 * newer strom on disk. Each address looked at again every STROM_PHONE_REBIND_MS (30 s): a new network, an address gone.
 * Resolves with why it ended.
 */
export function servePhone(env: Env): Promise<string> {
  let releaseServe: () => void;
  try {
    releaseServe = acquireLock(file(env, "phone-serve.lock"), { owner: "the phone server", waitMs: 0, staleMs: 365 * 24 * 3600_000 });
  } catch {
    return Promise.resolve("another server runs");
  }
  return new Promise((resolve) => {
    const me = process.pid;
    const runs = env.STROM_PHONE_RENEWED ?? VERSION;
    const before = phoneRun(env);
    const servers = new Map<string, http.Server>();
    // each address bound and the mask of its network
    const nets = new Map<string, string>();
    let port = phoneConfig(env).port ?? PHONE_PORT;
    let current: PhoneRun = { pid: me, version: runs, started: new Date().toISOString(), port, state: "error", error: { code: "no-lan", detail: "" }, addresses: [], ...(before?.addressChangedAt ? { addressChangedAt: before.addressChangedAt } : {}), ...(before?.lanSeenAt ? { lanSeenAt: before.lanSeenAt } : {}) };
    let urls = before?.addresses.map((a) => a.url).sort();
    let ended = false;
    let seenWritten = 0;
    let own = ownAddresses();
    const save = () => {
      if (!ended) writeJson(file(env, "phone-run.json"), current);
    };

    const answer = (res: http.ServerResponse, status: number, body: unknown) => {
      res.writeHead(status, HEADERS);
      res.end(JSON.stringify(body));
    };
    const page = (res: http.ServerResponse, lang: string) => {
      const nonce = crypto.randomBytes(16).toString("base64");
      res.writeHead(200, {
        ...HEADERS,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; worker-src 'self'; child-src 'self'; connect-src 'self'; img-src 'self' data: blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      });
      res.end(phonePage(lang, nonce));
    };
    // what the phone's page sends and asks (phone-send.ts)
    const send = phoneSend(env, (text) => notePhone(env, text));
    const handler: http.RequestListener = (req, res) => {
      // a device of no private network, of another one than the address asked, or the computer itself: nothing answered at all
      const local = (req.socket.localAddress ?? "").replace(/^::ffff:/i, "");
      const mask = nets.get(local);
      if (!remoteAllowed(req.socket.remoteAddress, env, mask ? { ip: local, mask } : undefined, own)) return void req.socket.destroy();
      // the phone reached the computer (the app says so when a phone cannot pair: a firewall, another network)
      current.lanSeenAt = new Date().toISOString();
      if (Date.now() - seenWritten > 5000) {
        seenWritten = Date.now();
        save();
      }
      // asked by its own address only (a page of another address that names this one is turned away: DNS rebinding)
      const host = `${local}:${req.socket.localPort}`;
      if (req.headers.host !== host) {
        req.resume();
        return answer(res, 421, { code: "phone.host" });
      }
      let url: URL;
      try {
        url = new URL(req.url ?? "/", `http://${host}`);
      } catch {
        req.resume();
        return answer(res, 404, { code: "phone.not-found" });
      }
      const p = url.pathname;
      const phone = phoneByKey(env, cookieOf(req.headers.cookie, phoneCookie(req.socket.localPort ?? port)));
      const said = (who: PairedPhone) => ({ id: who.id, name: who.name, pairedAt: who.pairedAt, lang: pageLang(env, { phone: who }) });
      if (req.method === "GET" && (p === "/" || p === "/pair")) {
        req.resume();
        return page(res, pageLang(env, { ...(phone ? { phone } : {}), asked: url.searchParams.get("lang"), acceptLanguage: req.headers["accept-language"] ?? "" }));
      }
      if (req.method === "GET" && p === "/whoami") {
        req.resume();
        if (!phone) return answer(res, 401, { code: "phone.unpaired" });
        sawPhone(env, phone);
        return answer(res, 200, said(phone));
      }
      // the picture of the icon on the home screen (asked by the phone's system, paired or not)
      if (req.method === "GET" && p === "/phone/icon.png") {
        req.resume();
        res.writeHead(200, { ...HEADERS, "Content-Type": "image/png", "Cache-Control": "max-age=86400" });
        let icon = Buffer.alloc(0);
        try {
          icon = fs.readFileSync(assetPath("icon", "icon-256.png"));
        } catch {
          // no picture: the system draws one
        }
        return void res.end(icon);
      }
      if (req.method === "POST" && (p === "/pair" || p === "/home") && req.headers.origin !== undefined && req.headers.origin !== `http://${host}`) {
        req.resume();
        return answer(res, 403, { code: "phone.origin" });
      }
      // a code for the icon about to be added (the phone paired); the icon opened unpaired gives it back
      if (req.method === "POST" && p === "/phone/home") {
        req.resume();
        if (!phone) return answer(res, 401, { code: "phone.unpaired" });
        if (req.headers.origin !== `http://${host}`) return answer(res, 403, { code: "phone.origin" });
        return answer(res, 200, homeCode(env, phone, url.searchParams.get("tree") ?? undefined));
      }
      if (req.method === "POST" && p === "/home") {
        let body = "";
        let big = false;
        req.setEncoding("utf8");
        req.on("data", (d: string) => {
          if (body.length + d.length > 512) big = true;
          else body += d;
        });
        req.on("end", () => {
          if (big) return answer(res, 413, { code: "phone.large" });
          let sent: { code?: unknown } = {};
          try {
            sent = (JSON.parse(body || "{}") as typeof sent) ?? {};
          } catch {
            // no code
          }
          const claimed = typeof sent.code === "string" ? claimHome(env, sent.code) : undefined;
          if (!claimed) return answer(res, 410, { code: "phone.code" });
          res.setHeader("Set-Cookie", `${phoneCookie(req.socket.localPort ?? port)}=${claimed.key}; Max-Age=${PHONE_KEY_DAYS * 86400}; Path=/; HttpOnly; SameSite=Strict`);
          answer(res, 200, { ...said(claimed.phone), ...(claimed.tree ? { tree: claimed.tree } : {}) });
        });
        req.on("error", () => {});
        return;
      }
      if (req.method === "POST" && p === "/pair") {
        // its own page alone (another page cannot pair a phone with this computer)
        if (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`) {
          req.resume();
          return answer(res, 403, { code: "phone.origin" });
        }
        let body = "";
        let big = false;
        req.setEncoding("utf8");
        req.on("data", (d: string) => {
          if (body.length + d.length > 2048) big = true;
          else body += d;
        });
        req.on("end", () => {
          if (big) return answer(res, 413, { code: "phone.large" });
          let sent: { code?: unknown; lang?: unknown } = {};
          try {
            sent = (JSON.parse(body || "{}") as typeof sent) ?? {};
          } catch {
            // no code
          }
          const code = typeof sent.code === "string" && /^[A-Za-z0-9_-]{22}$/.test(sent.code) ? sent.code : undefined;
          const lang = typeof sent.lang === "string" && pageLanguages().includes(sent.lang.toLowerCase()) ? sent.lang.toLowerCase() : undefined;
          const paired = code ? pairPhone(env, code, { address: `http://${host}`, userAgent: req.headers["user-agent"] ?? "", ...(lang ? { lang } : {}) }) : undefined;
          // a code wrong, used or too old: the same answer (nothing said of which)
          if (!paired) return answer(res, 410, { code: "phone.code" });
          res.setHeader("Set-Cookie", `${phoneCookie(req.socket.localPort ?? port)}=${paired.key}; Max-Age=${PHONE_KEY_DAYS * 86400}; Path=/; HttpOnly; SameSite=Strict`);
          // the tree whose QR code it was: the page opens it
          answer(res, 200, { ...said(paired.phone), ...(paired.tree ? { tree: paired.tree } : {}) });
        });
        req.on("error", () => {});
        return;
      }
      // the page's worker that computes each photo's SHA-256 (no secure context: no crypto.subtle)
      if (req.method === "GET" && p === "/phone/sha256.js") {
        req.resume();
        res.writeHead(200, { ...HEADERS, "Content-Type": "text/javascript; charset=utf-8" });
        return void res.end(readAsset("phone", "sha256.js") ?? "");
      }
      if (p.startsWith("/phone/")) {
        if (!phone) {
          req.resume();
          return answer(res, 401, { code: "phone.unpaired" });
        }
        sawPhone(env, phone);
        if (send.handle(req, res, url, host)) return;
      }
      req.resume();
      return answer(res, 404, { code: "phone.not-found" });
    };

    const closeAll = () => {
      for (const s of servers.values()) s.close();
      servers.clear();
    };
    const bindAll = async () => {
      own = ownAddresses();
      const want = lanAddresses(env);
      for (const a of want) nets.set(a.ip, a.mask);
      for (const [ip, s] of servers) {
        if (!want.some((a) => a.ip === ip)) {
          s.close();
          servers.delete(ip);
          notePhone(env, `${ip}: the computer no longer has it`);
        }
      }
      let failure: { code: PhoneErrorCode; detail: string } | undefined;
      // nothing bound yet: one port for all, the next one when it is taken
      for (let tries = 0; servers.size === 0 && want.length && tries < PORT_TRIES; tries++) {
        failure = undefined;
        for (const a of want) {
          const r = await listenOn(a.ip, port, handler);
          if (ended) {
            r.server?.close();
            return;
          }
          if (r.server) servers.set(a.ip, r.server);
          else failure = r.code === "EADDRINUSE" ? { code: "port-busy", detail: r.detail ?? "" } : (failure ?? { code: "bind-failed", detail: r.detail ?? "" });
        }
        if (failure?.code !== "port-busy") break;
        closeAll();
        notePhone(env, `the port ${port} is taken by another program`);
        port = port + 1 >= PHONE_PORT + PORT_TRIES ? PHONE_PORT : port + 1;
        if (tries + 1 >= PORT_TRIES) break;
      }
      // a new address beside those bound: the same port
      for (const a of want) {
        if (servers.has(a.ip) || servers.size === 0) continue;
        const r = await listenOn(a.ip, port, handler);
        if (ended) {
            r.server?.close();
            return;
          }
        if (r.server) servers.set(a.ip, r.server);
        else notePhone(env, `${a.ip} not listened on: ${r.detail}`);
      }
      const c = phoneConfig(env);
      if (servers.size && c.on && c.port !== port && (c.port !== undefined || port !== PHONE_PORT)) writeConfig(env, { ...c, port });
      const addresses = want.filter((a) => servers.has(a.ip)).map((a) => ({ url: `http://${a.ip}:${port}`, iface: a.iface, kind: a.kind }));
      const now = addresses.map((a) => a.url).sort();
      if (urls && urls.length && now.join() !== urls.join()) {
        current.addressChangedAt = new Date().toISOString();
        notePhone(env, `the addresses now: ${now.join(", ") || "none"}`);
      }
      if (now.length) urls = now;
      const { error: _e, ...rest } = current;
      current = servers.size
        ? { ...rest, port, state: "on", addresses }
        : { ...rest, port, state: "error", addresses: [], error: want.length ? (failure ?? { code: "bind-failed", detail: "" }) : { code: "no-lan", detail: "no private network address (Wi-Fi or a cable)" } };
      save();
    };

    const end = (reason: string) => {
      if (ended) return;
      writeJson(file(env, "phone-run.json"), { ...current, ended: { at: new Date().toISOString(), reason } });
      ended = true;
      clearInterval(tick);
      clearInterval(rebind);
      closeAll();
      process.off("SIGTERM", onSignal);
      process.off("SIGINT", onSignal);
      releaseServe();
      notePhone(env, `the server ended: ${reason}`);
      resolve(reason);
    };
    const onSignal = () => end("ended by a signal");
    process.on("SIGTERM", onSignal);
    process.on("SIGINT", onSignal);

    let renewChecked = Date.now();
    const tick = setInterval(() => {
      if (!phoneConfig(env).on) return end("turned off");
      const r = phoneRun(env);
      if (r && r.pid !== me && !r.ended && alive(r.pid)) return end("another server took over");
      send.tick();
      // a photo still taken by a strom it started: started again after it
      if (Date.now() - renewChecked > Number(env.STROM_PHONE_RENEW_MS ?? 60_000) && !send.busy()) {
        renewChecked = Date.now();
        const disk = diskVersion(env);
        if (disk && !disk.probe && disk.version !== runs) {
          end(`strom ${disk.version} on disk: started again with it`);
          spawnPhone(env, { STROM_PHONE_RENEWED: disk.version });
        }
      }
    }, Number(env.STROM_PHONE_TICK_MS ?? 1000));
    const rebind = setInterval(() => void bindAll().catch((e) => notePhone(env, `the addresses not looked at: ${String(e)}`)), Number(env.STROM_PHONE_REBIND_MS ?? 30_000));

    if (!phoneConfig(env).on) return end("turned off");
    notePhone(env, `the server started (strom ${runs})`);
    void bindAll().catch((e) => notePhone(env, `the addresses not looked at: ${String(e)}`));
  });
}
