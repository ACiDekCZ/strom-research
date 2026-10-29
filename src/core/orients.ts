// The EXIF orientation of each image in the shared store, remembered by its content (a file there is named by its
// SHA-256 and never changes): read from its file once, then never again. Found on Windows, a research on OneDrive:
// each start of the menu opened thousands of scans only for this — and a scan kept only in the cloud is downloaded
// whole when it is opened.

import fs from "node:fs";
import path from "node:path";
import { readJsonIfExists, writeFileAtomic } from "./json.ts";

const FILE = "orient.json";
const FORMAT = 1;

interface Stored {
  v: number;
  /** sha256 → its orientation (1: shown as it lies, also a picture that says none). */
  o: Record<string, number>;
}

/** Of each shared folder this process looked into: what is known, and whether something new waits to be kept. */
const held = new Map<string, { known: Map<string, number>; fresh: Map<string, number> }>();
let atExit = false;

function fileOf(shared: string): string {
  return path.join(shared, "cache", FILE);
}

function read(shared: string): Map<string, number> {
  try {
    const s = readJsonIfExists<Stored>(fileOf(shared));
    if (s && s.v === FORMAT && s.o && typeof s.o === "object") return new Map(Object.entries(s.o).filter(([, o]) => Number.isInteger(o) && o >= 1 && o <= 8));
  } catch {
    // unreadable: made again
  }
  return new Map();
}

function heldOf(shared: string): { known: Map<string, number>; fresh: Map<string, number> } {
  let h = held.get(shared);
  if (!h) held.set(shared, (h = { known: read(shared), fresh: new Map() }));
  return h;
}

/** The orientation remembered of this content, else undefined (its file is to be read). */
export function knownOrient(shared: string, sha: string): number | undefined {
  return heldOf(shared).known.get(sha.toLowerCase());
}

/** The orientation read from its file: remembered (kept when the process ends, or at keepOrients). */
export function rememberOrient(shared: string, sha: string, orient: number): void {
  const h = heldOf(shared);
  const key = sha.toLowerCase();
  h.known.set(key, orient);
  h.fresh.set(key, orient);
  if (!atExit) {
    atExit = true;
    process.once("exit", keepOrients);
  }
}

/**
 * What was read since, kept with what another strom kept meanwhile — only where the shared folder keeps its caches
 * (never a folder made for it: a shared folder gone, a test's taken away). A folder that cannot be written: read again
 * next time.
 */
export function keepOrients(): void {
  for (const [shared, h] of held) {
    if (!h.fresh.size || !fs.existsSync(path.join(shared, "cache"))) continue;
    try {
      const all = read(shared);
      for (const [k, o] of h.fresh) all.set(k, o);
      writeFileAtomic(fileOf(shared), JSON.stringify({ v: FORMAT, o: Object.fromEntries(all) } satisfies Stored));
      h.fresh.clear();
    } catch {
      // read again next time
    }
  }
}

/** Forgotten in this process (tests: the file read again). */
export function forgetOrients(): void {
  held.clear();
}
