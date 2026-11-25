// What the name of a scan saved by hand says beyond one image number (spec 141, K053): a portal that names its files
// by the entries on them ("001-004.jpg": entries 1 to 4 — never image 4), and a sheet saved under a number already
// given ("007a.jpg" beside "007.jpg": another scan, a zoomed-in part or a copy — its content tells which).

import path from "node:path";
import { copyless } from "./media.ts";

/** The entries a scan holds, as its name gives them: from, to (inclusive). */
export interface Entries {
  from: number;
  to: number;
}

/** A name that is a range alone: "001-004", "005–007", "1 - 4" — digits of the Latin script only. */
const RANGE_NAME = /^([0-9]+)\s*[-–—]\s*([0-9]+)$/u;

/**
 * A copy's suffix a file manager adds after a name that is a range (" 2" … " 9": Finder's first copies) — the other
 * suffixes (" copy", " (1)") copyless takes away already.
 */
const RANGE_COPY = /^([0-9]+\s*[-–—]\s*[0-9]+)\s+[2-9]$/u;

/**
 * The entries a file's name gives when the whole name (a copy's suffix aside) is a range of two numbers, the first not
 * above the second: "001-004.jpg" → 1–4. Never part of a longer name ("Lhota 1784-1830 33.jpg", a date "2026-11-04"):
 * undefined.
 */
export function entriesOf(file: string): Entries | undefined {
  const stem = copyless(file);
  const m = RANGE_NAME.exec(RANGE_COPY.exec(stem)?.[1] ?? stem);
  if (!m) return undefined;
  const from = Number(m[1]);
  const to = Number(m[2]);
  return from <= to ? { from, to } : undefined;
}

/** "1–4" — the entries as said. */
export function entriesText(e: Entries): string {
  return e.from === e.to ? String(e.from) : `${e.from}–${e.to}`;
}

/**
 * Whether a file is named by a number and a letter after it ("007a.jpg", "9b.jpg", "33a 2.jpg"): a sheet saved under
 * a number of its own — another scan, a zoomed-in part of it, or a copy; its content tells which (never its name).
 */
export function sheetNamed(file: string): boolean {
  return /^[0-9]+\p{L}$/u.test(copyless(file));
}

/** A file's name without its folder (as said to the person and the agent). */
export function fileName(file: string): string {
  return path.basename(file).normalize("NFC");
}
