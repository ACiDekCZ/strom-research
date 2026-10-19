// Canonical JSON and atomic file writes.
//
// Every record is written in one canonical form (fixed key order, 2-space
// indent, trailing newline) so that git diffs only ever show real changes.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** Keys that come first, in this order; everything else is alphabetical. */
const LEADING_KEYS = ["id", "type", "name", "names", "title", "status", "kind"];

function keyRank(key: string): number {
  const i = LEADING_KEYS.indexOf(key);
  return i === -1 ? LEADING_KEYS.length : i;
}

function compareKeys(a: string, b: string): number {
  const ra = keyRank(a);
  const rb = keyRank(b);
  if (ra !== rb) return ra - rb;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Deep copy with canonical key order; drops `undefined` values. */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort(compareKeys)) {
      const v = src[key];
      if (v === undefined) continue;
      out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

export function stringifyCanonical(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2) + "\n";
}

/** How long a rename on Windows waits in all for a file another program holds (ms), the waits growing. */
export const RENAME_PATIENCE = 1500;
const RENAME_FIRST_WAIT = 25;
/** What another program holding the target (an antivirus, the search indexer, a backup) makes a rename fail with. */
const HELD = new Set(["EPERM", "EBUSY", "EACCES"]);

/** An error of a file another program held past the waits (cli/main.ts says so in plain words): the file it was about. */
export interface HeldError extends NodeJS.ErrnoException {
  heldFile?: string;
}

/**
 * fn, again for a while on Windows when a file it uses is held: an antivirus, the indexer or a sync tool that has the
 * file open for a moment makes a rename, a read or a removal fail with EPERM, EBUSY or EACCES. The waits grow (25, 50,
 * 100 … ms) up to RENAME_PATIENCE in all, then the last error is thrown, marked with the file another program held.
 * Waiting is synchronous (Atomics.wait: the thread sleeps, no busy loop). Elsewhere a file is not held by an open one:
 * these codes mean a lasting refusal, thrown at once (EBUSY marked all the same: it says the file is in use).
 */
function retryingHeld<T>(file: string, platform: NodeJS.Platform, fn: () => T): T {
  let wait = RENAME_FIRST_WAIT;
  let left = platform === "win32" ? RENAME_PATIENCE : 0;
  for (;;) {
    try {
      return fn();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? "";
      if (!HELD.has(code)) throw err;
      if (left <= 0) {
        if (platform === "win32" || code === "EBUSY") (err as HeldError).heldFile = file;
        throw err;
      }
      const ms = Math.min(wait, left);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
      left -= ms;
      wait *= 2;
    }
  }
}

/** fs.renameSync, again for a while on Windows when the target is held (retryingHeld). */
export function renameRetrying(from: string, to: string, platform: NodeJS.Platform = process.platform): void {
  retryingHeld(to, platform, () => fs.renameSync(from, to));
}

/**
 * fs.readFileSync, again for a while on Windows when another program holds the file without letting it be read
 * (found on Windows: _counters.json held, a person added failed at once with Node's bare EBUSY).
 */
export function readFileRetrying(file: string, platform: NodeJS.Platform = process.platform): Buffer {
  return retryingHeld(file, platform, () => fs.readFileSync(file));
}

/** fs.rmSync (force), again for a while on Windows when another program holds the file. */
export function removeRetrying(file: string, platform: NodeJS.Platform = process.platform): void {
  retryingHeld(file, platform, () => fs.rmSync(file, { force: true }));
}

/** Write via a temp file in the same directory and rename: never a half file. */
export function writeFileAtomic(file: string, content: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  fs.writeFileSync(tmp, content, "utf8");
  try {
    renameRetrying(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

export function writeJson(file: string, value: unknown): void {
  writeFileAtomic(file, stringifyCanonical(value));
}

export function readJson<T = unknown>(file: string): T {
  const text = readFileRetrying(file).toString("utf8");
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(`invalid JSON in ${file}: ${(err as Error).message}`);
  }
}

export function readJsonIfExists<T = unknown>(file: string): T | undefined {
  if (!fs.existsSync(file)) return undefined;
  return readJson<T>(file);
}

/** Append one JSON line (append-only logs). */
export function appendJsonLine(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(canonicalize(value)) + "\n", "utf8");
}

export function readJsonLines<T = unknown>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  const out: T[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    out.push(JSON.parse(line) as T);
  }
  return out;
}
