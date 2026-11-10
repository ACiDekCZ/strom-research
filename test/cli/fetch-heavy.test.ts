// strom fetch says an image of many requests (tiles, most likely) once a run, as connector test does: a connector built
// before its test said it would otherwise fetch a book for a day without a word. From the run's own measure — nothing
// more is asked of the archive for it; in the background its mark carries it (strom fetch --status, the brief). A
// local server plays the archive; the pauses of a fetch in the test's process are recorded, not slept. Each process
// started in the background is ended by the test.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { opts, tiled, world } from "./connectors.helpers.ts";
import { until } from "../helpers.ts";

const started = new Set<number>();
after(() => {
  for (const pid of started)
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ended already
    }
});

const WARNING = /⚠ connector zkusebni: one image costs 12 requests \(tiles, most likely\) — at its pace \(at least 2 s apart, no hourly cap\) about 24 s an image, 80 min for a book of 200 images/g;

test("fetch: an image of twelve requests (tiles) said once a run, with what a book takes and what to build first; one request an image, or ten, says nothing", opts, async () => {
  const { w, a, dir } = await world();
  try {
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism"]); // B0001
    tiled(dir, a.base, 12);
    const r = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"]);
    const said = r.out + r.err;
    assert.equal(said.match(WARNING)?.length, 1, said);
    assert.match(r.err, /this fetch goes on at that pace\n {4}a connector of one request an image first \(DISCOVERY\.md, step 2\): the portal's own link to the full image, a download of the whole book \(ZIP, PDF\), a IIIF image \(full\/max\) — then strom connector test zkusebni --fetch 5359 --images 1/);
    assert.match(r.out, /3 images of B0001 \(images 1–3\) fetched and registered/);
    assert.equal(a.hits.filter((h) => h.startsWith("/tile/")).length, 36, "only the fetch's own requests");
    // --json: the cost in the data, the text on stderr only
    const j = await w.ok(["fetch", "zkusebni", "5359", "--images", "4-5", "--recordset", "B1", "--json"]);
    assert.equal(j.json.heavy.perImage, 12);
    assert.equal(j.json.heavy.bookImages, undefined);
    assert.ok(j.json.heavy.bookMs > 0);
    assert.equal(j.err.match(WARNING)?.length, 1, j.err);
    // one image: said at its end, from the whole run
    const one = await w.ok(["fetch", "zkusebni", "5359", "--images", "6", "--recordset", "B1", "--json"]);
    assert.equal(one.json.heavy.perImage, 12);
    // one request an image: nothing
    const whole = await w.ok(["fetch", "zkusebni", "whole", "--images", "1-2"]);
    assert.doesNotMatch(whole.out + whole.err, /tiles, most likely|DISCOVERY\.md, step 2/);
    // ten requests an image is not past it
    tiled(dir, a.base, 10);
    const ten = await w.ok(["fetch", "zkusebni", "5359", "--images", "7-8", "--recordset", "B1", "--json"]);
    assert.doesNotMatch(ten.out + ten.err, /tiles, most likely/);
    assert.equal(ten.json.heavy, undefined);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("fetch --background: the cost of an image of many requests kept on its mark — strom fetch --status says it, --json gives it", opts, async () => {
  const { w, a, dir } = await world();
  try {
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism"]); // B0001
    // the child fetches at a real pace: the person's own, short, for the test
    await w.ok(["allow", "host", "127.0.0.1", "--pace", "0.25"], { tty: true, answers: ["y"] });
    await w.ok(["task", "add", "Křest Lhotáka", "--level", "locate", "--where", "B1", "--why", "zkouška", "--done-when", "hotovo"]);
    await w.ok(["session", "start", "T1"]);
    tiled(dir, a.base, 11);
    const bg = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1", "--background", "--json"]);
    const pid = bg.json.pid as number;
    assert.ok(pid > 0, bg.out);
    started.add(pid);
    type Ended = { pid: number; heavy?: { perImage: number; bookMs: number; bookImages?: number } };
    const ended = async () => ((await w.ok(["fetch", "--status", "--json"])).json.ended as Ended[]).find((e) => e.pid === pid);
    await until("the fetch in the background ended", async () => !!(await ended()), { ms: 60_000 });
    const e = (await ended())!;
    assert.equal(e.heavy?.perImage, 11, JSON.stringify(e));
    assert.equal(e.heavy?.bookImages, undefined);
    const text = (await w.ok(["fetch", "--status"])).out;
    assert.match(text, /B0001 \(zkusebni 5359\): 2\/2 images registered[^\n]* · ⚠ 11 requests an image \(tiles, most likely\): about \d+ min for a book of 200 images — a connector of one request an image first \(DISCOVERY\.md, step 2\)/, text);
    // one at work (its mark as a fetch in the background keeps it): how to stop it said too, in the brief as well
    const at = new Date().toISOString();
    const mark = { pid: process.pid, host: os.hostname(), at, since: at, recordset: "B0001", connector: "zkusebni", book: "5359", images: [3, 4, 5], registered: 1, session: "N0001", background: true, heavy: { perImage: 12, bookMs: 4_800_000, bookImages: 254 } };
    fs.writeFileSync(path.join(w.cwd, ".strom", "fetch", `active-B0001.${process.pid}.json`), JSON.stringify(mark));
    const said = "⚠ 12 requests an image (tiles, most likely): about 80 min for its 254 images — strom fetch --stop B0001; a connector of one request an image first (DISCOVERY.md, step 2)";
    const now = (await w.ok(["fetch", "--status"])).out;
    assert.ok(now.includes(`B0001 (zkusebni 5359): 1/3 images registered · in the background`) && now.includes(` · ${said}\n`), now);
    const brief = (await w.ok(["brief", "T1"])).out;
    assert.ok(brief.includes(`- B0001: 1/3 images registered (in the background) — strom read B0001 --images 3-5 reads them as they come; not fetched again\n  · ${said}`), brief);
  } finally {
    w.cleanup();
    await a.close();
  }
});
