// The kinds of the history's events (core/pastevents.ts) and which of them a research looks for (history.kinds).
//
// The value a person sets is one of: all (the default — every kind, as before the setting existed), none, a list of the
// kinds looked for ("war,epidemic"), or all but some ("all,-economy,-law"; "-economy,-law" read the same, though a shell
// argument cannot begin with "-"). The two lists are kept as typed (only sorted and without repeats): "all but" takes a
// kind a later strom adds, a list of its own does not — so each says what it meant.

import { UsageError } from "./errors.ts";

export const EVENT_KINDS = ["war", "epidemic", "census", "state", "emigration", "law", "economy", "disaster", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** The default of history.kinds: every kind. */
export const ALL_KINDS = "all";
export const NO_KINDS = "none";

const isKind = (k: string): k is EventKind => (EVENT_KINDS as readonly string[]).includes(k);

/** The hint of every refusal of a value: what is allowed. */
export const KINDS_HINT = `all (default), none, the kinds looked for ("war,epidemic") or all but some ("all,-economy,-law"); the kinds: ${EVENT_KINDS.join(", ")}`;

/**
 * A value of history.kinds checked and written as kept (all, none, a sorted list, "all" and "-" before each kind left out);
 * throws a UsageError naming what is wrong and the kinds there are.
 */
export function normalizeKinds(raw: string, key = "history.kinds"): string {
  const v = raw.trim().toLowerCase();
  if (v === ALL_KINDS || v === "*") return ALL_KINDS;
  if (v === NO_KINDS || v === "-") return NO_KINDS;
  const parts = v.split(/[\s,;]+/u).filter(Boolean);
  // "all,-economy": all but those
  if (parts[0] === ALL_KINDS && parts.length > 1 && parts.slice(1).every((p) => p.startsWith("-"))) parts.shift();
  else if (parts.includes(ALL_KINDS) || parts.includes(NO_KINDS))
    throw new UsageError(`invalid ${key} "${raw}": all or none alone, or all first and the kinds left out after it ("all,-economy")`, { code: "history.kinds", hint: KINDS_HINT });
  if (parts.length === 0) throw new UsageError(`invalid ${key} "${raw}": no kind named`, { code: "history.kinds", hint: KINDS_HINT });
  const minus = parts.filter((p) => p.startsWith("-"));
  if (minus.length > 0 && minus.length < parts.length)
    throw new UsageError(`invalid ${key} "${raw}": the kinds looked for or the kinds left out, not both`, { code: "history.kinds", hint: KINDS_HINT });
  const names = parts.map((p) => p.replace(/^[-+]/u, ""));
  const unknown = names.filter((n) => !isKind(n));
  if (unknown.length > 0)
    throw new UsageError(`unknown kind${unknown.length > 1 ? "s" : ""} of the history in ${key}: ${unknown.join(", ")}`, { code: "history.kinds", hint: KINDS_HINT });
  const sorted = EVENT_KINDS.filter((k) => names.includes(k));
  if (minus.length > 0) return sorted.length === EVENT_KINDS.length ? NO_KINDS : [ALL_KINDS, ...sorted.map((k) => `-${k}`)].join(",");
  return sorted.length === EVENT_KINDS.length ? ALL_KINDS : sorted.join(",");
}

/** The kinds a value of history.kinds looks for (unset or not understood: all — what a research did before). */
export function kindsOf(value: unknown): EventKind[] {
  if (typeof value !== "string") return [...EVENT_KINDS];
  let v: string;
  try {
    v = normalizeKinds(value);
  } catch {
    return [...EVENT_KINDS];
  }
  if (v === ALL_KINDS) return [...EVENT_KINDS];
  if (v === NO_KINDS) return [];
  const parts = v.split(",");
  if (parts[0] === ALL_KINDS) {
    const out = new Set(parts.slice(1).map((p) => p.slice(1)));
    return EVENT_KINDS.filter((k) => !out.has(k));
  }
  return EVENT_KINDS.filter((k) => parts.includes(k));
}

/** Every kind looked for? */
export function allKinds(kinds: readonly string[]): boolean {
  return EVENT_KINDS.every((k) => kinds.includes(k));
}

/** The kinds of `b` that `a` lacks. */
export function kindsAdded(a: readonly string[], b: readonly string[]): EventKind[] {
  return EVENT_KINDS.filter((k) => b.includes(k) && !a.includes(k));
}

/** A list of kinds as written in texts and briefs ("war, epidemic"; "none"). */
export function sayKinds(kinds: readonly string[]): string {
  return kinds.length === 0 ? NO_KINDS : EVENT_KINDS.filter((k) => kinds.includes(k)).join(", ");
}

/**
 * The value of history.kinds that looks for these kinds, written in the form the one before had: all but some where it
 * was all or all but some (a kind a later strom adds is then looked for too), else the list itself.
 */
export function kindsSetting(kinds: readonly string[], before?: string): string {
  const on = EVENT_KINDS.filter((k) => kinds.includes(k));
  if (on.length === EVENT_KINDS.length) return ALL_KINDS;
  if (on.length === 0) return NO_KINDS;
  const allBut = before === undefined || before.trim() === "" || before.trim().toLowerCase().startsWith(ALL_KINDS) || before.trim().startsWith("-");
  return allBut ? normalizeKinds([ALL_KINDS, ...EVENT_KINDS.filter((k) => !on.includes(k)).map((k) => `-${k}`)].join(",")) : normalizeKinds(on.join(","));
}

/** A list of kinds as an app or a link names them: each a known kind, else none (refused by the caller). */
export function kindsNamed(list: unknown): EventKind[] | undefined {
  if (!Array.isArray(list) || list.some((k) => typeof k !== "string" || !isKind(k))) return undefined;
  return EVENT_KINDS.filter((k) => list.includes(k));
}
