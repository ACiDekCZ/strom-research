// A task's hold (spec 127): when it still holds, and the time a person sets for it.

import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { directAgentId, holdAlive, lastSign, type Hold } from "../../src/core/holds.ts";
import { parseDuration } from "../../src/core/config.ts";

const NOW = Date.parse("2026-11-21T10:17:00Z");
const MIN = 60_000;
const at = (ms: number) => new Date(ms).toISOString();
const hold = (o: Partial<Hold> = {}): Hold => ({ session: "N0001", by: "agent", since: at(NOW - 40 * MIN), beat: at(NOW - 10 * MIN), seq: 1, version: "1.36.0", ...o });

test("a hold holds while its last sign of life is younger than the hold's time", () => {
  assert.equal(holdAlive(hold(), NOW, 30 * MIN), true);
  assert.equal(holdAlive(hold({ beat: at(NOW - 31 * MIN) }), NOW, 30 * MIN), false);
  // the file's own time counts too (a beat written by a clock behind)
  assert.equal(holdAlive(hold({ beat: at(NOW - 31 * MIN) }), NOW, 30 * MIN, NOW - 5 * MIN), true);
});

test("a beat ahead of the clock counts as now: a clock gone wrong only keeps a hold longer, never ends it early", () => {
  assert.equal(lastSign(hold({ beat: at(NOW + 5 * 60 * MIN) }), NOW), NOW);
  assert.equal(holdAlive(hold({ beat: at(NOW + 5 * 60 * MIN) }), NOW, 30 * MIN), true);
  // a minute ahead (two computers' clocks): taken as it is
  assert.equal(lastSign(hold({ beat: at(NOW + MIN) }), NOW + 2 * MIN), NOW + MIN);
});

test("a hold whose process on this computer is gone lapses at once; another computer's pid is never asked", () => {
  const gone = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  const pid = Number(gone.stdout);
  assert.equal(holdAlive(hold({ pid, host: os.hostname(), beat: at(NOW) }), NOW, 30 * MIN), false);
  assert.equal(holdAlive(hold({ pid: process.pid, host: os.hostname(), beat: at(NOW) }), NOW, 30 * MIN), true);
  assert.equal(holdAlive(hold({ pid, host: "jiný-počítač", beat: at(NOW) }), NOW, 30 * MIN), true);
});

test("a pid the system gave to another process (alive, never beating) holds no longer than the hold's time", () => {
  assert.equal(holdAlive(hold({ pid: process.pid, host: os.hostname(), beat: at(NOW - 31 * MIN) }), NOW, 30 * MIN, NOW - 31 * MIN), false);
});

test("a beat two hours behind with its file fresh holds (another computer's clock); both two hours behind, lapsed", () => {
  assert.equal(holdAlive(hold({ beat: at(NOW - 120 * MIN) }), NOW, 30 * MIN, NOW - MIN), true);
  assert.equal(holdAlive(hold({ beat: at(NOW - 120 * MIN) }), NOW, 30 * MIN, NOW - 120 * MIN), false);
  assert.equal(holdAlive(hold({ beat: at(NOW + 120 * MIN) }), NOW, 30 * MIN, NOW + 120 * MIN), true);
});

test("a direct agent's own conversation names its hold; anything else is no name", () => {
  assert.equal(directAgentId({ CLAUDE_CODE_SESSION_ID: "3f2a-ČÍSLO_1.b" }), "3f2a-ČÍSLO_1.b");
  assert.equal(directAgentId({ CLAUDE_CODE_SESSION_ID: "../x" }), undefined);
  assert.equal(directAgentId({}), undefined);
});

test("the hold's time: minutes, or with a unit", () => {
  assert.equal(parseDuration("30"), 30);
  assert.equal(parseDuration("45m"), 45);
  assert.equal(parseDuration("2h"), 120);
  assert.equal(parseDuration("1h30m"), 90);
  assert.equal(parseDuration("půl hodiny"), undefined);
});
