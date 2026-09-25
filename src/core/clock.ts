// The session's time. `strom run` stops an agent at its time limit (run.minutes),
// and what the agent had only in its context is lost then (found in a live run:
// 25 minutes of reading a census film, nothing written down, all gone). So the
// agent is told when its session is stopped (STROM_DEADLINE, set by the run; the
// brief says it), near the end every strom command it runs reminds it, and at
// the limit an agent that can be resumed gets a few minutes more to write down
// what it found and close the session (runners: wrapUp).

import type { Env } from "./paths.ts";

/** From how long before the end strom's output reminds the agent (a short session: its last quarter). */
export const REMIND_MS = 10 * 60_000;
/** From how long before the end the reminder says to write down and close (a short session: its last eighth). */
export const CLOSE_MS = 3 * 60_000;
/** The time an agent stopped at its limit gets to write down what it found. */
export const WRAP_UP_MS = 5 * 60_000;

/** When this session is stopped (ms since the epoch), if a run set a limit. */
export function deadlineOf(env: Env): number | undefined {
  const t = Date.parse(env.STROM_DEADLINE ?? "");
  return Number.isNaN(t) ? undefined : t;
}

/** The session's whole time limit (STROM_MINUTES), if the run said it. */
function limitOf(env: Env): number | undefined {
  const m = Number(env.STROM_MINUTES);
  return m > 0 ? m * 60_000 : undefined;
}

/** A time of day as the agent reads it in its brief and in the reminders. */
export function clockTime(t: number): string {
  return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * The line strom adds to a command's output near the end of the session (none before): first that the time is
 * getting short (go on, writing down), in the last minutes to write down and close, then that it is up. A short
 * session is reminded in proportion — a reminder from its first minute would only make the agent give up.
 */
export function clockLine(env: Env, now = Date.now()): string | undefined {
  const end = deadlineOf(env);
  if (end === undefined) return undefined;
  const limit = limitOf(env);
  const remind = limit ? Math.min(REMIND_MS, limit / 4) : REMIND_MS;
  const close = limit ? Math.min(CLOSE_MS, limit / 8) : CLOSE_MS;
  const left = end - now;
  if (left > remind) return undefined;
  const min = Math.max(1, Math.ceil(left / 60_000));
  if (left <= 0) return '⏳ this session\'s time is up: record what you found and close it now: strom session close --continue --summary "…" --next "exactly where you stopped"';
  if (left <= close)
    return `⏳ ${min} min left: this session is stopped at ${clockTime(end)}. Record what you have found now (facts, sources, the images searched), then close: strom session close --summary "…" --next "…"`;
  return `⏳ ${min} min left: this session is stopped at ${clockTime(end)}. Go on, but write each find down as you have it and start nothing you cannot finish by then.`;
}

/** What the brief says of the session's time: when, and not to hurry — strom says when it is getting short. */
export function briefClock(end: number, now = Date.now()): string {
  return (
    `Time: this session is stopped at ${clockTime(end)} (it is ${clockTime(now)} now). Do not hurry and do not stop early: strom's output tells you ` +
    "when the time is getting short; until then work on the task as usual. Write each find and each stretch of images searched into strom the " +
    "moment you have it: what is only in your context is lost when the session ends."
  );
}
