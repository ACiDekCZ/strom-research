// strom fetch at an archive's hourly cap (P7): it waits for the cap itself and says until when, instead of the agent
// sleeping and asking again; past its wait it ends with exit 7 and the time to try again — the images it got
// registered, never a request more than the cap. A local archive and a fake clock: nothing is slept.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { opts, world } from "./connectors.helpers.ts";
import { pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks, type Pace } from "../../src/core/net.ts";
import { noSharperPart, requestsSpan } from "../../src/commands/connectors.ts";
import type { Media } from "../../src/core/model.ts";

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

test("fetch: says beforehand how many requests it asks and how long at the host's pace and cap, with what is left this hour (N0233)", opts, async () => {
  const { w, a } = await world();
  capped(pluginDir(w, "zkusebni"));
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  const first = await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"]);
  assert.match(first.err, /1 image\(s\) through zkusebni: at least 1 request\(s\) to 127\.0\.0\.1, about 0 s at its pace \(≥2 s apart, at most 2 an hour — 2 left this hour\)\n/);
  assert.doesNotMatch(first.err, /holds the rest back/);
  // more than the cap leaves this hour: said, with the way round it — whole images first, a part only where needed
  const many = await w.run(["fetch", "zkusebni", "5359", "--images", "2-3", "--recordset", "B1"]);
  assert.match(many.err, /2 image\(s\) through zkusebni: at least 2 request\(s\) to 127\.0\.0\.1, about (59|60) min at its pace \(≥2 s apart, at most 2 an hour — 1 left this hour\)\n {2}the hourly cap holds the rest back: fetch the whole images first \(a request each\) and a part only of an image whose entry needs it/);
  // the method and the command's help say the order
  const method = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "assets", "method", "reading.md"), "utf8");
  assert.match(method, /Whole images first, a part only where entries need\n {2}it: an archive's hourly cap stops the rest\./);
  assert.match((await w.ok(["help", "fetch"])).out, /fetch whole images first \(a request each\) and a part only of an image whose entry needs it/);
  w.cleanup();
});

test("requestsSpan: requests one at a time at the pause, held back by the hourly cap with the last hour counted", () => {
  const pace: Pace = { minIntervalMs: 5000, perHour: 120 };
  const now = 1_000_000_000_000;
  assert.equal(requestsSpan(1, pace, [], now), 0);
  assert.equal(requestsSpan(34, pace, [], now), 33 * 5000, "a whole book's 33 images and its page: under the cap");
  // 132 requests (both halves of 33 images, two requests each) under a cap of 120: the rest an hour after the first
  assert.equal(requestsSpan(132, pace, [], now), 3600_000 + 11 * 5000);
  // the cap used up by the last hour: the first waits for the oldest to be an hour old
  const full = Array.from({ length: 120 }, (_, i) => now - 1800_000 + i * 1000);
  assert.equal(requestsSpan(1, pace, full, now), 1800_000);
  assert.equal(requestsSpan(3, { minIntervalMs: 2000, perHour: Infinity }, full, now), 4000, "no cap: the pause alone");
});

test("noSharperPart: each image weighed against its own scan — halves of a book the portal gives 2402 px across (N0233)", () => {
  const m = (id: string, image: number, width: number, height: number, part?: { x: number; y: number; w: number; h: number }): Media =>
    ({ id, type: "media", recordset: "B0001", image, width, height, mime: "image/jpeg", file: `${id}.jpg`, sha: id, size: 1, created: "", updated: "", notes: [], ...(part ? { part, fetched: { connector: "archiv-ústí", book: "7" } } : {}) }) as Media;
  const all = [
    m("M1", 112, 2777, 2312), // an older, larger scan
    m("M2", 113, 1389, 1156),
    m("M3", 113, 1201, 2000, { x: 0, y: 0, w: 0.5, h: 1 }), // a half: 2402 px across the image
  ];
  const half = { x: 0.5, y: 0, w: 0.5, h: 1 };
  const skip = noSharperPart(all, "archiv-ústí", "B0001", 112, half);
  assert.deepEqual(skip && { ...skip, gain: Math.round(skip.gain * 10) / 10 }, { detail: 2402, width: 2777, gain: 0.9 });
  assert.equal(noSharperPart(all, "archiv-ústí", "B0001", 113, half), undefined, "a small scan here: the half is 1.7× sharper");
  assert.equal(noSharperPart(all, "archiv-ústí", "B0001", 112, { x: 0.6, y: 0.2, w: 0.2, h: 0.1 }), undefined, "a smaller part may come sharper");
  assert.equal(noSharperPart(all, "jiný", "B0001", 112, half), undefined, "another connector's portal");
});
