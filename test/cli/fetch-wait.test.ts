// strom fetch at an archive's hourly cap (P7): it waits for the cap itself and says until when, instead of the agent
// sleeping and asking again; past its wait it ends with exit 7 and the time to try again — the images it got
// registered, never a request more than the cap. A local archive and a fake clock: nothing is slept.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { opts, world } from "./connectors.helpers.ts";
import { pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";

/** The archive's terms: two requests an hour. */
function capped(dir: string): void {
  const file = path.join(dir, "connector.json");
  const m = readJsonFile(file);
  fs.writeFileSync(file, JSON.stringify({ ...m, policy: { ...m.policy, pace: { perHour: 2, source: "the archive's terms of use" } } }, null, 2));
}

test("fetch: past the wait for an hourly cap — exit 7, the time and the command to run again", opts, async () => {
  const { w, a } = await world();
  capped(pluginDir(w, "zkusebni"));
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  assert.match((await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"])).out, /2 image\(s\) of B0001 \(images 1–2\) fetched and registered/);
  const r = await w.run(["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B1"]);
  assert.equal(r.code, 7, r.out + r.err);
  assert.match(r.out, /stopped: 2 requests to 127\.0\.0\.1 in the last hour — its hourly cap; try again at (\d{4}-\d\d-\d\d )?\d\d:\d\d/);
  assert.match(r.out, /→ the archive's limit is used up: try again at (\d{4}-\d\d-\d\d )?\d\d:\d\d \(strom fetch zkusebni 5359 --images 3 --recordset B0001 — what is here already is not fetched again\); meanwhile other work/);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 2, "nothing beyond the cap");
  w.cleanup();
});

test("fetch: an hourly cap used up within its wait — said with the time, waited for, then on", opts, async () => {
  const { w, a } = await world();
  capped(pluginDir(w, "zkusebni"));
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  let clock = Date.now();
  const slept: number[] = [];
  testHooks.now = () => clock;
  testHooks.sleep = async (ms) => void (slept.push(ms), (clock += ms));
  try {
    await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
    clock += 40 * 60_000;
    slept.length = 0;
    const r = await w.run(["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B1"]);
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.err, /127\.0\.0\.1: its hourly cap is used up — strom waits until (\d{4}-\d\d-\d\d )?\d\d:\d\d \(20 min\), then goes on by itself \(it waits at most 30 min\); do not stop it/);
    assert.match(r.out, /1 image\(s\) of B0001 \(images 3\) fetched and registered/);
    assert.ok(slept.some((ms) => ms > 19 * 60_000), slept.join(","));
    // a session of strom run with 15 minutes left: no wait into its last 10 — the time to try again instead
    clock += 2 * 60_000;
    w.env.STROM_DEADLINE = new Date(Date.now() + 15 * 60_000).toISOString();
    await w.ok(["recordset", "add", "Týnec Z 1784–1820", "--kinds", "burial", "--url", `${a.base}/book/5360`]); // B0002
    const late = await w.run(["fetch", "zkusebni", "5360", "--images", "1-2", "--recordset", "B2"]);
    assert.equal(late.code, 7, late.out + late.err);
    assert.match(late.out, /try again at/);
  } finally {
    testHooks.now = undefined;
    delete w.env.STROM_DEADLINE;
  }
  w.cleanup();
});
