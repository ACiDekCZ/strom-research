// When the plan's limit that cut off a session resets (core/planlimit.ts, K036): the windows the agent said full
// first, then its words; a time not ahead, or unreadable, is unknown. Fixed clocks: "now" is given, off midnight UTC.

import { test } from "node:test";
import assert from "node:assert/strict";
import { limitReserve, limitResume, LIMIT_RESERVE_MS, timeOf } from "../../src/core/planlimit.ts";
import { looksLikeLimit } from "../../src/runners/runner.ts";
import { parseUntil } from "../../src/commands/session.ts";

const NOW = Date.parse("2026-11-15T09:47:00Z");
const at = (iso: string) => Date.parse(iso);

test("the five-hour window said full: its reset; the week full too: the later one — never past it", () => {
  const five = { kind: "five_hour" as const, used: 1, resetsAt: "2026-11-15T11:00:00.000Z", at: "2026-11-15T09:46:00Z" };
  const week = { kind: "seven_day" as const, used: 1, resetsAt: "2026-11-19T07:00:00.000Z", at: "2026-11-15T09:46:00Z" };
  assert.deepEqual(limitResume({ limits: [five, { ...week, used: 0.6 }] }, NOW), { at: at("2026-11-15T11:00:00Z"), kind: "five_hour" });
  assert.deepEqual(limitResume({ limits: [{ ...five, used: 0.4 }, week] }, NOW), { at: at("2026-11-19T07:00:00Z"), kind: "seven_day" });
  assert.deepEqual(limitResume({ limits: [five, week] }, NOW), { at: at("2026-11-19T07:00:00Z"), kind: "seven_day" });
  // the windows over the agent's words
  assert.equal(limitResume({ limits: [five], resumeAt: "2026-11-15T15:00:00Z" }, NOW).at, at("2026-11-15T11:00:00Z"));
});

test("no window said full: the agent's words; a reset not ahead or past a week and a day, or no time: unknown", () => {
  assert.deepEqual(limitResume({ resumeAt: "2026-11-15T09:49:00Z" }, NOW), { at: at("2026-11-15T09:49:00Z") });
  assert.deepEqual(limitResume({ resumeAt: "2026-11-15T09:40:00Z" }, NOW), {});
  assert.deepEqual(limitResume({ resumeAt: "2026-11-30T09:40:00Z" }, NOW), {});
  assert.deepEqual(limitResume({}, NOW), {});
  assert.deepEqual(limitResume({ resumeAt: "soon" }, NOW), {});
  // a window full without its reset: which one is said, the time from the words
  const week = { kind: "seven_day" as const, used: 1, at: "2026-11-15T09:46:00Z" };
  assert.deepEqual(limitResume({ limits: [week] }, NOW), { kind: "seven_day" });
  // a full one whose reset is gone already: unknown, never a session into a limit still on
  assert.deepEqual(limitResume({ limits: [{ ...week, resetsAt: "2026-11-15T09:00:00Z" }] }, NOW), { kind: "seven_day" });
});

test("the agent's words read as a time: a date, in so long, a time of day (the next one, this computer's zone only)", () => {
  assert.equal(timeOf("2026-11-15T10:02:03Z", NOW, "UTC"), at("2026-11-15T10:02:03Z"));
  assert.equal(timeOf("in 2 hours 5 minutes", NOW, "UTC"), NOW + 125 * 60_000);
  assert.equal(timeOf("in 45 min.", NOW, "UTC"), NOW + 45 * 60_000);
  // a time of day: today if still ahead, else tomorrow (local time: checked relative to the computer's own clock)
  const local = (h: number, m: number, days = 0) => {
    const d = new Date(NOW);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= NOW) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + days);
    return d.getTime();
  };
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  assert.equal(timeOf("7pm", NOW, zone), local(19, 0));
  assert.equal(timeOf("3:05 PM", NOW, zone), local(15, 5));
  assert.equal(timeOf("12am", NOW, zone), local(0, 0));
  assert.equal(timeOf("19:30", NOW, zone), local(19, 30));
  assert.equal(timeOf(`7pm (${zone})`, NOW, zone), local(19, 0));
  assert.equal(timeOf("7pm (Pacific/Kiritimati)", NOW, "Europe/Prague"), undefined, "another zone: not guessed");
  assert.equal(timeOf("25:00", NOW, zone), undefined);
  assert.equal(timeOf("7", NOW, zone), undefined, "a number alone is no time");
  // Codex: "try again at Oct 12th, 2026 3:05 PM"
  const codex = timeOf("Nov 16th, 2026 3:05 PM", NOW, zone);
  assert.equal(codex, new Date(2026, 10, 16, 15, 5).getTime());
  assert.equal(timeOf("pozítří", NOW, zone), undefined, "words of no number: no time");
});

test("the minute after the reset; another only for a test of the sources", () => {
  assert.equal(limitReserve({}), LIMIT_RESERVE_MS);
  assert.equal(limitReserve({ STROM_TEST_LIMIT_RESERVE_MS: "0" }, { kind: "source" } as never), 0);
  assert.equal(limitReserve({ STROM_TEST_LIMIT_RESERVE_MS: "0" }, { kind: "npm" } as never), LIMIT_RESERVE_MS);
  assert.equal(limitReserve({ STROM_TEST_LIMIT_RESERVE_MS: "-5" }, { kind: "source" } as never), LIMIT_RESERVE_MS);
});

test("Claude Code's words at its plan's limit: \"You've hit your limit · resets 3pm (zone)\" is the limit, its time read in that zone", () => {
  for (const text of ["You've hit your limit · resets 3pm (Europe/Prague)", "You\u2019ve hit your usage limit · resets 3pm (Europe/Prague)"]) {
    const said = looksLikeLimit(text);
    assert.equal(said.limit, true, text);
    assert.equal(said.resumeAt, "3pm (Europe/Prague)");
    // 09:47Z = 10:47 in Prague: 3pm the same day
    const at = timeOf(said.resumeAt!, NOW, "Europe/Prague");
    assert.equal(new Date(at!).getHours(), 15);
    assert.ok(at! > NOW && at! - NOW < 24 * 3600_000);
  }
  // an agent's own words of another limit are no plan's limit
  assert.equal(looksLikeLimit("The archive's page hit the limit of 50 results.").limit, false);
});

test("--until HH:MM on fixed clocks: later today, or past midnight the next day — never a time gone", () => {
  const local = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi, 30).getTime();
  const noon = local(2026, 11, 15, 12, 5);
  assert.equal(parseUntil("12:15", noon), local(2026, 11, 15, 12, 15) - 30_000);
  assert.equal(parseUntil("08:00", noon), new Date(2026, 10, 16, 8, 0).getTime());
  const late = local(2026, 11, 15, 23, 55);
  assert.equal(parseUntil("00:05", late), new Date(2026, 10, 16, 0, 5).getTime());
  assert.ok(parseUntil("00:05", late)! > late);
  assert.equal(parseUntil(undefined, noon), undefined);
  assert.throws(() => parseUntil("24:00", noon), /HH:MM/);
});
