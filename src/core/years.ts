// Spans of years as agents and people write them: "1903", "1903-1907", "1903–1907" (an en dash, as in the help),
// "1903 — 1907". One reading for every place that stores or compares them (searches, record sets), so a dash of
// another kind is never "no filter" and a span written backwards is never a span nothing falls into.

import { UsageError } from "./errors.ts";

export interface YearSpan {
  from: number;
  to: number;
  /** written later year first ("1907-1903"): read as from-to */
  reversed?: true;
}

/** Hyphen, the dashes and the minus sign people type between two years. */
const SPAN = /^\s*(\d{3,4})\s*(?:[-‐‑‒–—―−]\s*(\d{3,4}))?\s*$/u;

/** The span a text gives, or undefined when it is not one year or two. */
export function parseYears(text: string | undefined): YearSpan | undefined {
  const m = text === undefined ? null : SPAN.exec(text);
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = m[2] === undefined ? a : Number(m[2]);
  return a <= b ? { from: a, to: b } : { from: b, to: a, reversed: true };
}

/** The stored form: "1903" or "1903-1907" (a plain hyphen, earlier year first). */
export function yearsText(span: YearSpan): string {
  return span.from === span.to ? String(span.from) : `${span.from}-${span.to}`;
}

/** Whether two spans share a year; a text that is no span (none given) limits nothing. */
export function yearsOverlap(a: string | undefined, b: string | undefined): boolean {
  const x = parseYears(a);
  const y = parseYears(b);
  if (!x || !y) return true;
  return x.from <= y.to && y.from <= x.to;
}

/**
 * A --years option read for storing or filtering: "1903", "1903-1907", any dash. Later year first is swapped (what
 * was meant) and said in `notes`; anything else is an error with the usage, never "no filter".
 */
export function yearsOption(v: unknown, notes: string[], example = "1903-1907"): string | undefined {
  if (v === undefined || v === false) return undefined;
  const span = typeof v === "string" ? parseYears(v) : undefined;
  if (!span) throw new UsageError(`invalid --years "${String(v)}"`, { hint: `one year or a span, earlier year first: --years ${example.split("-")[0]} or --years ${example}` });
  const text = yearsText(span);
  if (span.reversed) notes.push(`note: --years ${String(v).trim()} read as ${text}`);
  return text;
}
