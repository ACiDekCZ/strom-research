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

/** Write via a temp file in the same directory and rename: never a half file. */
export function writeFileAtomic(file: string, content: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`);
  fs.writeFileSync(tmp, content, "utf8");
  try {
    fs.renameSync(tmp, file);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}

export function writeJson(file: string, value: unknown): void {
  writeFileAtomic(file, stringifyCanonical(value));
}

export function readJson<T = unknown>(file: string): T {
  const text = fs.readFileSync(file, "utf8");
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
