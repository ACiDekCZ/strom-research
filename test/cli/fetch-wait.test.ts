// strom fetch at an archive's hourly cap (P7): it waits for the cap itself and says until when, instead of the agent
// sleeping and asking again; past its wait it ends with exit 7 and the time to try again — the images it got
// registered, never a request more than the cap. A local archive and a fake clock: nothing is slept.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { opts, world } from "./connectors.helpers.ts";
import { pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks, type Pace } from "../../src/core/net.ts";
import { requestsSpan } from "../../src/commands/connectors.ts";
import { partHere, SHARPER } from "../../src/core/media.ts";
import type { Media } from "../../src/core/model.ts";
import { Tree } from "../../src/core/tree.ts";
import { changeLines } from "../../src/core/changelog.ts";

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

test("fetch near a host's hourly cap: the agent hears what is left and when it frees at 80 % and on, the person once at 80 % and once at 90 % — the cap and the pace untouched", opts, async () => {
  const { w, a } = await world();
  const file = path.join(pluginDir(w, "zkusebni"), "connector.json");
  const m = readJsonFile(file);
  fs.writeFileSync(file, JSON.stringify({ ...m, policy: { ...m.policy, pace: { perHour: 10, source: "the archive's terms of use" } } }, null, 2));
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
  await w.ok(["recordset", "add", "Týnec Z 1784–1820", "--kinds", "burial"]); // B0002
  await w.ok(["recordset", "add", "Týnec O 1784–1820", "--kinds", "marriage"]); // B0003
  const capOps = () => Tree.open(w.cwd, w.env).readOps().filter((o) => o.op === "net.cap");
  // 7 of 10: nothing said
  const quiet = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"]);
  await w.ok(["fetch", "zkusebni", "5360", "--images", "1-3", "--recordset", "B2"]);
  await w.ok(["fetch", "zkusebni", "5361", "--images", "1", "--recordset", "B3"]);
  assert.doesNotMatch(quiet.out, /requests an hour used/);
  assert.equal(capOps().length, 0);
  // the 8th: 80 % — the agent is told plainly, the person once
  const eighty = await w.ok(["fetch", "zkusebni", "5361", "--images", "2", "--recordset", "B3"]);
  assert.match(eighty.out, /⚠ 127\.0\.0\.1: 8 of its 10 requests an hour used \(80 % of its cap\) — 2 left this hour; the next frees at (\d{4}-\d\d-\d\d )?\d\d:\d\d, as each request is an hour old\. Write down what was found now and work on what is here meanwhile \(the images fetched, reading, other tasks\); never go round the cap/);
  assert.equal(capOps().length, 1);
  assert.match(capOps()[0]!.summary, /^127\.0\.0\.1: 8 of its 10 requests an hour used; the next frees at \d{4}-\d\d-\d\dT/);
  // the 9th: 90 % — said again, and the person hears the second share
  const ninety = await w.ok(["fetch", "zkusebni", "5361", "--images", "3", "--recordset", "B3"]);
  assert.match(ninety.out, /9 of its 10 requests an hour used \(90 % of its cap\) — 1 left this hour/);
  assert.equal(capOps().length, 2);
  // the history in the research language, for a person: what happened, never "you"
  const tree = Tree.open(w.cwd, w.env);
  const cs = changeLines(tree, capOps(), "", "cs").map((l) => l.text);
  assert.equal(cs.length, 2);
  assert.match(cs[0]!, /^Archiv 127\.0\.0\.1 je blízko hodinového limitu: využito 8 z 10 požadavků za hodinu, další volný v \d\d:\d\d; mezitím výzkum pokračuje s tím, co už je k dispozici$/);
  assert.match(changeLines(tree, capOps().slice(1), "", "de")[0]!.text, /^Archiv 127\.0\.0\.1 nahe an seiner Grenze pro die Stunde: 9 von 10 Anfragen/);
  assert.match(changeLines(tree, capOps().slice(1), "", "en")[0]!.text, /^The archive 127\.0\.0\.1 nearly at its hourly limit: 9 of 10 requests an hour used/);
  // only said: the cap and the pace stay the archive's
  const pace = (await w.ok(["connector", "show", "zkusebni", "--json"])).json;
  assert.equal(JSON.stringify(pace).includes('"perHour":10'), true);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 9);
  // what the person hears is in the history, committed: the research checks clean
  assert.equal(spawnSync("git", ["status", "--porcelain", "data"], { cwd: w.cwd, encoding: "utf8" }).stdout, "");
  await w.ok(["check"]);
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

test("partHere: each image weighed against its own scan — halves of a book the portal gives 2402 px across (N0233)", () => {
  const m = (id: string, image: number, width: number, height: number, part?: { x: number; y: number; w: number; h: number }): Media =>
    ({ id, type: "media", recordset: "B0001", image, width, height, mime: "image/jpeg", file: `${id}.jpg`, sha: id, size: 1, created: "", updated: "", notes: [], ...(part ? { part, fetched: { connector: "archiv-ústí", book: "7" } } : {}) }) as Media;
  const all = [
    m("M1", 112, 2777, 2312), // an older, larger scan
    m("M2", 113, 1389, 1156),
    m("M3", 113, 1201, 2000, { x: 0, y: 0, w: 0.5, h: 1 }), // a half: 2402 px across the image
  ];
  const half = { x: 0.5, y: 0, w: 0.5, h: 1 };
  const skip = partHere(all, "archiv-ústí", "B0001", 112, half);
  assert.deepEqual(skip && [skip.held.id, skip.how, skip.most, Math.round(skip.detail)], ["M1", "whole", 2402, 2777]);
  assert.equal(partHere(all, "archiv-ústí", "B0001", 113, half), undefined, "a small scan here: the half is 1.7× sharper");
  assert.equal(partHere(all, "archiv-ústí", "B0001", 112, { x: 0.6, y: 0.2, w: 0.2, h: 0.1 }), undefined, "a smaller part may come sharper");
  assert.equal(partHere(all, "jiný", "B0001", 112, half), undefined, "another connector's portal");
  assert.equal(partHere(all, "archiv-ústí", "B0001", 112, half, (x) => x.id !== "M1"), undefined, "a scan whose file is not here holds nothing");
});

test("partHere: a part inside a part here comes from it unless a new one could be sharper by SHARPER — the same part never again", () => {
  assert.equal(SHARPER, 1.2);
  const m = (id: string, image: number, width: number, part?: { x: number; y: number; w: number; h: number }, connector = "portál"): Media =>
    ({ id, type: "media", recordset: "B0001", image, width, height: width, mime: "image/jpeg", file: `${id}.jpg`, sha: id, size: 1, created: "", updated: "", notes: [], ...(part ? { part, fetched: { connector, book: "7" } } : {}) }) as Media;
  // a portal that gives a part 1000 px at most: the whole image 1000 px, a quarter 1000 px (2000 across the image)
  const all = [m("M1", 5, 1000), m("M2", 5, 1000, { x: 0.5, y: 0, w: 0.5, h: 0.5 })];
  const same = partHere(all, "portál", "B0001", 5, { x: 0.5, y: 0, w: 0.5, h: 0.5 });
  assert.deepEqual(same && [same.held.id, same.how], ["M2", "same"]);
  // a little less than the quarter, inside it: at most 2000 × 0.5/0.45 = 2222 across — not 1.2× the 2000 here
  const inner = partHere(all, "portál", "B0001", 5, { x: 0.52, y: 0.02, w: 0.45, h: 0.45 });
  assert.deepEqual(inner && [inner.held.id, inner.how, inner.most, Math.round(inner.crop.x * 100) / 100, Math.round(inner.crop.w * 100) / 100], ["M2", "inside", 2222, 0.04, 0.9]);
  // a third of the quarter: it may come three times as sharp — asked for
  assert.equal(partHere(all, "portál", "B0001", 5, { x: 0.6, y: 0.1, w: 0.15, h: 0.15 }), undefined);
  // outside the quarter: the whole image holds it at 1000 across, a part may bring more
  assert.equal(partHere(all, "portál", "B0001", 5, { x: 0.1, y: 0.6, w: 0.3, h: 0.3 }), undefined);
  // the portal's sharpest shown: a part of image 6 half the quarter's size came no sharper (2100 across, a scan of
  // 2100 px) — no part of the book passes it, the smallest inside the quarter is answered from the quarter
  const plateau = [...all, m("M3", 6, 525, { x: 0, y: 0, w: 0.25, h: 0.25 })];
  const tiny = partHere(plateau, "portál", "B0001", 5, { x: 0.6, y: 0.1, w: 0.05, h: 0.05 });
  assert.deepEqual(tiny && [tiny.held.id, tiny.how, tiny.most, tiny.native], ["M2", "inside", 2100, true]);
  // a part another connector fetched teaches nothing of this portal
  assert.equal(partHere([...all, m("M3", 6, 525, { x: 0, y: 0, w: 0.25, h: 0.25 }, "jiný")], "portál", "B0001", 5, { x: 0.6, y: 0.1, w: 0.05, h: 0.05 }), undefined);
});
