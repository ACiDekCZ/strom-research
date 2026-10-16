// The claude-usage gate around the week's reset: a new week starts at once (the number grows with the week gone), what
// is left at the end of the week is spent when it holds a session, and a wait never goes past the reset.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const GATE = path.join(import.meta.dirname, "..", "..", "assets", "plugins", "gates", "claude-usage", "gate.ts");
const H = 3_600_000;
const DAY = 24 * H;
const WEEK = 7 * DAY;

type Said = { code: number | null; reason: string; until?: number };

/** The gate asked with what the agent said a minute ago: the week `used` %, its reset `resetIn` ms from now. */
function ask(args: string[], used: number, resetIn: number, o: { lang?: string; session?: number } = {}): Said & { now: number; resets: number } {
  const now = Date.now();
  const resets = now + resetIn;
  const at = new Date(now - 60_000).toISOString();
  const limits = [
    { kind: "five_hour", used: (o.session ?? 10) / 100, resetsAt: new Date(now + 2 * H).toISOString(), at },
    { kind: "seven_day", used: used / 100, resetsAt: new Date(resets).toISOString(), at },
  ];
  // no PATH: `claude -p /usage` is never what it reads here (it would stop the gate)
  const r = spawnSync(process.execPath, [GATE, ...args], {
    encoding: "utf8",
    env: { PATH: "", STROM_LANG: o.lang ?? "en", STROM_AGENT: "claude", STROM_AGENT_LIMITS: JSON.stringify(limits) },
  });
  const said = JSON.parse(r.stdout.trim().split("\n").pop()!) as { reason: string; until?: string };
  return { code: r.status, reason: said.reason, ...(said.until ? { until: Date.parse(said.until) } : {}), now, resets };
}

test("claude-usage right after the reset: a session starts at once, and the first day never spends the week", () => {
  // the reset this moment: 0 % gone, 0 % used — no day of waiting for 15 % of the week to pass
  const fresh = ask(["15"], 0, WEEK);
  assert.equal(fresh.code, 0, fresh.reason);
  assert.match(fresh.reason, /^week 0 % used, 0 % gone, 0 in hand \(at least 0 needed — half the week gone, early in the week\); weekly reset in 7\.0 days$/);
  // half an hour in, a little used: it waits only until half the week gone catches up (about an hour), never a day
  const little = ask(["15"], 0.3, WEEK - H / 2);
  assert.equal(little.code, 1, little.reason);
  assert.ok(little.until! - little.now < 2 * H, `${(little.until! - little.now) / H} h`);
  assert.ok(Math.abs(little.until! - (little.resets - WEEK + 0.006 * WEEK)) < 1000);
  // a day gone (≈ 14.3 %): at most half of it may be used — 7 % goes, 8 % waits
  assert.equal(ask(["15"], 7, WEEK - DAY).code, 0);
  const day = ask(["15"], 8, WEEK - DAY);
  assert.equal(day.code, 1);
  assert.match(day.reason, /^week 8 % used, 14 % gone, 6 in hand \(at least 8 needed — half the week gone, early in the week\) — until the week catches up; weekly reset in 6\.0 days$/);
  assert.ok(Math.abs(day.until! - (day.resets - WEEK + 0.16 * WEEK)) < 1000, "until 16 % of the week is gone");
  // from 2·n % gone on, the full number: 30 % gone, 15 used = 15 in hand
  assert.equal(ask(["15"], 15, WEEK * 0.7 - 60_000).code, 0);
  const full = ask(["15"], 16, WEEK * 0.7 - 60_000);
  assert.equal(full.code, 1);
  assert.match(full.reason, /\(at least 15 needed\) — until/, "no word of the week's start once the full number holds");
  // with no number: no faster than the week, as before
  assert.equal(ask([], 0, WEEK).code, 0);
  assert.equal(ask([], 1, WEEK - H).code, 1);
});

test("claude-usage in the middle of the week: the number in hand as before", () => {
  // 3 of 7 days gone (~42.9 %)
  const go = ask(["10"], 30, 4 * DAY);
  assert.equal(go.code, 0);
  assert.match(go.reason, /^week 30 % used, 42 % gone, 12 in hand \(at least 10 needed\); weekly reset in 4\.0 days$/);
  const ahead = ask(["20"], 30, 4 * DAY);
  assert.equal(ahead.code, 1);
  assert.ok(Math.abs(ahead.until! - (ahead.resets - WEEK + 0.5 * WEEK)) < 1000, "until 30 + 20 = 50 % of the week is gone");
  assert.equal(ask([], 60, 4 * DAY).code, 1, "used past the week gone: it waits, with no number too");
});

test("claude-usage before the reset: what is left goes when it holds a session; else until the reset, never past it", () => {
  // 1.7 h to the reset, 15 % of the week unused: it would be gone with the reset — a session starts
  const left = ask(["15"], 85, 1.7 * H);
  assert.equal(left.code, 0, left.reason);
  assert.equal(left.reason, "week 85 % used, weekly reset in 1.7 h — the 15 % left is enough for a session");
  // too little left for a session: it waits for the reset itself (and a minute), not a day of the new week
  const none = ask(["15"], 95, 1.7 * H);
  assert.equal(none.code, 1);
  assert.equal(none.reason, "week 95 % used, 98 % gone, 3 in hand (at least 15 needed) — until the weekly reset in 1.7 h");
  assert.ok(Math.abs(none.until! - (none.resets + 60_000)) < 1000, `${(none.until! - none.resets) / 60_000} min after the reset`);
  // the cap is the end of the week's room: 88 % of a cap of 95 holds no session
  const capped = ask(["15", "--cap", "95"], 88, 1.7 * H);
  assert.equal(capped.code, 1, capped.reason);
  assert.ok(Math.abs(capped.until! - (capped.resets + 60_000)) < 1000);
  // days before the reset, the week far ahead: never past the reset (before: the reset + n % of the new week)
  const far = ask(["14"], 95, 4 * DAY);
  assert.equal(far.code, 1);
  assert.ok(Math.abs(far.until! - (far.resets + 60_000)) < 1000);
  assert.match(far.reason, / — until the weekly reset in 4\.0 days$/);
  // with room for a session left: until the week's last two hours
  const room = ask(["14"], 88, 4 * DAY);
  assert.equal(room.code, 1);
  assert.ok(Math.abs(room.until! - (room.resets - 2 * H)) < 1000);
  assert.match(room.reason, / — until the last 2 h before the weekly reset in 4\.0 days$/);
  // the week caught up before its end: until then, as before
  const caught = ask(["10"], 50, 3 * DAY);
  assert.equal(caught.code, 1);
  assert.ok(Math.abs(caught.until! - (caught.resets - WEEK + 0.6 * WEEK)) < 1000);
  assert.ok(caught.until! < caught.resets);
});

test("claude-usage says when the week resets — in the research language — and a used-up session waits for its own reset", () => {
  assert.equal(ask(["15"], 85, 1.7 * H, { lang: "cs" }).reason, "týden: využito 85 %, obnoví se za 1,7 h — zbylých 15 % stačí na sezení");
  assert.equal(ask(["15"], 0, WEEK, { lang: "cs" }).reason, "týden: využito 0 %, uplynulo 0 %, náskok 0 (potřeba aspoň 0 – na začátku týdne polovina uplynulého); týden se obnoví za 7,0 dne");
  assert.equal(ask(["15"], 95, 1.7 * H, { lang: "de" }).reason, "Woche: 95 % genutzt, 98 % vergangen, Vorsprung 3 (mindestens 15 nötig) — bis zum Wochen-Reset in 1,7 h");
  assert.match(ask(["10"], 30, 30 * H, { lang: "de" }).reason, /; Wochen-Reset in 30,0 h$/);
  const session = ask(["10"], 30, 4 * DAY, { session: 100 });
  assert.equal(session.code, 1);
  assert.equal(session.reason, "the session is used up — until it resets; weekly reset in 4.0 days");
  assert.ok(Math.abs(session.until! - (session.now + 2 * H + 60_000)) < 1000);
});
