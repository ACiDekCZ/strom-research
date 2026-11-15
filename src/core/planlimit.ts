// When the plan's limit of an agent that cut off a session resets — so a run that goes on by itself (strom run --loop,
// --until under a gate) waits for it, then asks its gate and goes on, instead of ending (K036). strom knows no agent's
// limits beyond what the agent said: the windows of its plan (Claude Code's rate_limit_event, a full one with its
// reset), else the words of its message ("resets at …", "try again at …") where they name a time. Nothing said, or
// nothing read as a time: unknown — the run asks its gate again after a while.

import type { AgentLimit } from "../runners/runner.ts";
import type { Env } from "./paths.ts";
import { installation, type Installation } from "./self.ts";

/** After the reset, a minute more before the gate is asked (as the claude-usage gate's AFTER_RESET). */
export const LIMIT_RESERVE_MS = 60_000;
/** A reset said more than this far ahead is no reset of a plan's window (a week is the longest): unknown. */
const FURTHEST_MS = 8 * 24 * 3600_000;

export interface LimitResume {
  /** When the limit resets (ms), as the agent said it — none when it said nothing read as a time. */
  at?: number;
  /** Which window of the plan is full, when the agent said so. */
  kind?: AgentLimit["kind"];
}

/**
 * When the limit that cut off a session resets. The windows of the plan said full (used ≥ 1) and their resets first
 * (both full: the later one — the work waits for both); else the agent's words. A time not after now, or past a week
 * and a day, is unknown: never a wait made up, never a session started into a limit still on.
 */
export function limitResume(result: { limits?: AgentLimit[]; resumeAt?: string }, now: number, tz?: string): LimitResume {
  const full = (result.limits ?? []).filter((l) => l.used >= 1);
  const resets = full.map((l) => ({ kind: l.kind, at: l.resetsAt ? Date.parse(l.resetsAt) : NaN })).filter((r) => Number.isFinite(r.at) && r.at > now && r.at - now <= FURTHEST_MS);
  const kind = full.length === 1 ? full[0]!.kind : full.some((l) => l.kind === "seven_day") ? "seven_day" : full[0]?.kind;
  if (resets.length) {
    const last = resets.reduce((a, b) => (b.at > a.at ? b : a));
    return { at: last.at, kind: last.kind };
  }
  const said = result.resumeAt ? timeOf(result.resumeAt, now, tz) : undefined;
  const at = said !== undefined && said > now && said - now <= FURTHEST_MS ? said : undefined;
  return { ...(at !== undefined ? { at } : {}), ...(kind ? { kind } : {}) };
}

/**
 * A time in an agent's words: a date and time (ISO, "Oct 12th, 2026 3:05 PM"), "in 2 hours 5 minutes", or a time of
 * day ("7pm", "3:05 PM", "19:00" — the next one after now, in this computer's time; with a zone in brackets only
 * when it is this computer's). Anything else: undefined.
 */
export function timeOf(text: string, now: number, tz: string | undefined = localZone()): number | undefined {
  const t = text.normalize("NFC").trim().replace(/[.\s]+$/u, "");
  // in 2 hours 5 minutes, in 45 min
  const rel = /^in\s+(?:(\d{1,3})\s*(?:h|hours?|hrs?))?[\s,]*(?:(?:and\s+)?(\d{1,4})\s*(?:m|min|mins|minutes?))?$/iu.exec(t);
  if (rel && (rel[1] || rel[2])) return now + (Number(rel[1] ?? 0) * 60 + Number(rel[2] ?? 0)) * 60_000;
  // a time of day, its zone in brackets: only this computer's
  const day = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:\(([^)]+)\))?$/iu.exec(t);
  if (day && (day[2] !== undefined || day[3] !== undefined)) {
    if (day[4] && tz && day[4].trim() !== tz) return undefined;
    if (day[4] && !tz) return undefined;
    let h = Number(day[1]);
    const m = Number(day[2] ?? 0);
    const half = day[3]?.toLowerCase();
    if (m > 59 || (half ? h < 1 || h > 12 : h > 23)) return undefined;
    if (half === "pm" && h < 12) h += 12;
    if (half === "am" && h === 12) h = 0;
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  // a date and a time: its year said (a number alone is none), its ordinals off ("12th")
  if (!/\p{N}{4}/u.test(t)) return undefined;
  const parsed = Date.parse(t.replace(/(\p{N})(?:st|nd|rd|th)(?=[\s,]|$)/gu, "$1").replace(/\s+at\s+/iu, " "));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function localZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/**
 * The minute after the reset (LIMIT_RESERVE_MS). STROM_TEST_LIMIT_RESERVE_MS (the sources only): another, for a test
 * that waits for a reset a few seconds ahead.
 */
export function limitReserve(env: Env, inst: Installation = installation()): number {
  const ms = inst.kind === "source" && env.STROM_TEST_LIMIT_RESERVE_MS !== undefined ? Number(env.STROM_TEST_LIMIT_RESERVE_MS) : NaN;
  return Number.isInteger(ms) && ms >= 0 ? ms : LIMIT_RESERVE_MS;
}
