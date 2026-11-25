// The agent started from a device of the home network (spec 094 K3.15): a paired device asks the gateway to do what a
// link of the Strom app on the computer does (strom-research://work, chat, …) — on the computer a terminal opens with
// the agent, as after a click in the app there. The question the terminal would ask before it starts is asked on the
// device first: strom goes through the link's way without doing anything (a preview: nothing written, nothing started)
// and says what the terminal would ask; the device's yes comes back as a token (YES_MS, once, for that link and that
// device alone) the terminal takes instead of its question. What asks always (a price in money, a consent, the gate)
// is left to the terminal, and the device is told it waits at the computer.
//
// What waits for the person at the computer (a window of a consent, a question in a terminal opened from a device) is
// marked in .strom/asking while it waits — the glance says "waits at the computer" by it; a mark of a process that is
// gone counts for nothing (and is taken away).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Env } from "./paths.ts";
import type { AppClient } from "./model.ts";
import { viaChecked } from "./devicevia.ts";
import { RUN_ID } from "./runstate.ts";

/** How long the device's yes holds. */
export const YES_MS = 10 * 60_000;

/** A token of a yes: 16 random bytes, base64url. */
const YES_TOKEN = /^[A-Za-z0-9_-]{22}$/;

/** What the terminal would do with a link, said by its preview (thrown from the first point that decides it). */
export type PreviewOutcome =
  | { kind: "ask"; what: string; note: string[] }
  | { kind: "started" }
  | { kind: "computer"; why: "price" | "question" };

/** The preview of a link reached the point that decides what the terminal would do: nothing done before it. */
export class DevicePreview extends Error {
  readonly outcome: PreviewOutcome;
  constructor(outcome: PreviewOutcome) {
    super(`device preview: ${outcome.kind}`);
    this.outcome = outcome;
  }
}

/**
 * The device that opened this terminal (STROM_FROM_DEVICE, its name STROM_FROM_DEVICE_NAME — the gateway's, from the
 * pairing alone): its id and its name as one line; none where the id is not a device's.
 */
export function fromDevice(env: Env): AppClient | undefined {
  return viaChecked({ id: env.STROM_FROM_DEVICE, name: env.STROM_FROM_DEVICE_NAME });
}

/** The environment that names the device that opened a terminal (nothing for none). */
export function fromDeviceEnv(device: AppClient | undefined): Record<string, string> {
  return device ? { STROM_FROM_DEVICE: device.id, ...(device.name ? { STROM_FROM_DEVICE_NAME: device.name } : {}) } : {};
}

function yesDir(root: string): string {
  return path.join(root, ".strom", "device-yes");
}

interface YesFile {
  link: string;
  device: string;
  until: string;
  /** Sent to the terminal opened with it: never sent again, the terminal alone takes it. */
  sent?: true;
}

/** The device's yes to a link, kept for the terminal: its token and until when it holds. Old ones go. */
export function newYes(root: string, link: string, device: string, now = Date.now()): { yes: string; expiresAt: string } {
  const dir = yesDir(root);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) {
    const kept = readYes(path.join(dir, f));
    if (!kept || Date.parse(kept.until) <= now) fs.rmSync(path.join(dir, f), { force: true });
  }
  const yes = crypto.randomBytes(16).toString("base64url");
  const until = new Date(now + YES_MS).toISOString();
  const file: YesFile = { link, device, until };
  fs.writeFileSync(path.join(dir, `${yes}.json`), JSON.stringify(file) + "\n", { mode: 0o600 });
  return { yes, expiresAt: until };
}

function readYes(file: string): YesFile | undefined {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<YesFile>;
    return typeof j.link === "string" && typeof j.device === "string" && typeof j.until === "string" ? { link: j.link, device: j.device, until: j.until, ...(j.sent === true ? { sent: true } : {}) } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the yes holds for this link and this device (not taken): `sent` — as the terminal takes it (sent to it), else
 * as the device sends it (not sent yet).
 */
export function yesHolds(root: string, yes: string | undefined, link: string, device: string | undefined, now = Date.now(), sent = false): boolean {
  if (!yes || !YES_TOKEN.test(yes) || !device) return false;
  const kept = readYes(path.join(yesDir(root), `${yes}.json`));
  return !!kept && kept.link === link && kept.device === device && Date.parse(kept.until) > now && !!kept.sent === sent;
}

/**
 * The yes sent to the terminal opened with it (`on`; false: the terminal did not open — the device may send it again
 * while it holds). Written whole (renamed into place): never a half of it read.
 */
export function sendYes(root: string, yes: string, on = true): void {
  const file = path.join(yesDir(root), `${yes}.json`);
  const kept = readYes(file);
  if (!kept) return;
  const { sent: _, ...rest } = kept;
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(on ? { ...rest, sent: true } : rest) + "\n", { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch {
    fs.rmSync(tmp, { force: true });
  }
}

/** The yes taken by the terminal it was sent to: true once, while it holds — never again. */
export function takeYes(root: string, yes: string | undefined, link: string, device: string | undefined, now = Date.now()): boolean {
  if (!yesHolds(root, yes, link, device, now, true)) return false;
  const file = path.join(yesDir(root), `${yes}.json`);
  // taken by renaming it away first: of two terminals only one gets it
  const taken = `${file}.${process.pid}.taken`;
  try {
    fs.renameSync(file, taken);
  } catch {
    return false;
  }
  fs.rmSync(taken, { force: true });
  return true;
}

/** What waits for the person at the computer: a window of a consent, or a question in a terminal. */
export interface Asking {
  kind: "consent" | "question";
  since: string;
  run?: string;
  device?: string;
}

function askingDir(root: string): string {
  return path.join(root, ".strom", "asking");
}

let marks = 0;

/**
 * Marked as waiting for the person at the computer while `fn` waits (a window, a question): the run it is of (its worker,
 * or a run of this process), the device that opened the terminal. Never fails what it marks.
 */
export function markAsking(root: string | undefined, kind: Asking["kind"], env: Env): () => void {
  if (!root) return () => undefined;
  const run = RUN_ID.test(env.STROM_WORKER ?? "") ? env.STROM_WORKER : undefined;
  const device = fromDevice(env)?.id;
  const file = path.join(askingDir(root), `${process.pid}-${++marks}.json`);
  try {
    fs.mkdirSync(askingDir(root), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ kind, since: new Date().toISOString(), pid: process.pid, ...(run ? { run } : {}), ...(device ? { device } : {}) }) + "\n");
  } catch {
    return () => undefined;
  }
  return () => fs.rmSync(file, { force: true });
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** What waits for the person at the computer now (oldest first): marks of a process that is gone are taken away. */
export function askingNow(root: string, runs: string[] = []): Asking[] {
  const dir = askingDir(root);
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((f) => /^\d{1,10}-\d{1,9}\.json$/.test(f));
  } catch {
    return [];
  }
  const out: Asking[] = [];
  for (const f of names) {
    const file = path.join(dir, f);
    let j: { kind?: unknown; since?: unknown; pid?: unknown; run?: unknown; device?: unknown };
    try {
      j = JSON.parse(fs.readFileSync(file, "utf8")) as typeof j;
    } catch {
      continue;
    }
    const pid = Number(f.split("-")[0]);
    if (!processAlive(pid)) {
      fs.rmSync(file, { force: true });
      continue;
    }
    if ((j.kind !== "consent" && j.kind !== "question") || typeof j.since !== "string") continue;
    // the run it is of: its worker named, else a run of the process that asks (run-<pid>-…)
    const run = typeof j.run === "string" && RUN_ID.test(j.run) ? j.run : runs.find((r) => r.startsWith(`run-${pid}-`));
    const device = typeof j.device === "string" ? viaChecked({ id: j.device })?.id : undefined;
    out.push({ kind: j.kind, since: j.since, ...(run ? { run } : {}), ...(device ? { device } : {}) });
  }
  return out.sort((a, b) => a.since.localeCompare(b.since));
}
