// strom fetch <connector> --recordset B… without the book: the book of the record set — the one its images came from
// through that connector, or what its link tells by another book's link of the research — and when strom cannot know
// it, the whole command with the book in it. And whose a fetch is: --task, else the one task the session worked on
// that names the book, else the session's task — in its mark, its measure.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { opts, world } from "./connectors.helpers.ts";
import { fakeConnector } from "../helpers.ts";

const images = async (w: Awaited<ReturnType<typeof world>>["w"], b: string) => ((await w.ok(["media", "list", "--recordset", b, "--json"])).json.media as { image: number }[]).map((m) => m.image).sort((x, y) => x - y);

test("fetch --recordset B… with no book: the book its images came from, --list too; another connector's book said with its command", opts, async () => {
  const { w, a } = await world();
  try {
    await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
    await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"]);
    const more = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "2-3"]);
    assert.match(more.err, /book 5359 of zkusebni: the book of B0001 \(its images came from it\)/);
    assert.deepEqual(await images(w, "B1"), [1, 2, 3]);
    assert.ok(a.hits.includes("/img/5359/2.jpg"), "asked for the book of B0001");
    const list = await w.ok(["fetch", "zkusebni", "--list", "--recordset", "B1"]);
    assert.match(list.out, /Týnec N 1784–1820/);
    // the images of B0001 came through zkusebni: another connector is told which, with the command
    await fakeConnector(w, "druhy", a.base);
    const other = await w.run(["fetch", "druhy", "--recordset", "B1", "--images", "4", "--background"]);
    assert.notEqual(other.code, 0);
    assert.match(other.err, /the images of B0001 came through connector zkusebni \(its book 5359\), not druhy/);
    assert.match(other.err, /strom fetch zkusebni 5359 --images 4 --recordset B0001 --background/);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("fetch --recordset B… with no book: read from its link by another book's link alike; not known: the whole command with <book>", opts, async () => {
  const { w, a } = await world();
  try {
    await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/d/5359/1`]); // B0001
    await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"]);
    await w.ok(["recordset", "add", "Týnec Z 1784–1820", "--kinds", "burial", "--url", `${a.base}/d/7000/1`]); // B0002
    const dry = await w.ok(["fetch", "zkusebni", "--recordset", "B2", "--images", "2", "--dry-run"]);
    assert.match(dry.err, new RegExp(`book 7000 of zkusebni: the book of B0002 \\(its link ${a.base.replace(/[.]/g, "\\.")}/d/7000/1\\)`));
    assert.match(dry.out, /would fetch images 2 of book 7000 as images of B0002/);
    // a link unlike any other: strom does not guess — the command as given, with the book to fill in
    await w.ok(["recordset", "add", "Čížkov O 1790–1830", "--kinds", "marriage", "--url", `${a.base}/jine/kniha?id=7001`]); // B0003
    const unknown = await w.run(["fetch", "zkusebni", "--recordset", "B3", "--images", "4-6", "--background"]);
    assert.notEqual(unknown.code, 0);
    assert.match(unknown.err, /give the book: which book of zkusebni B0003 is, strom does not know — no image of B0003 came through zkusebni, and its link .*\/jine\/kniha\?id=7001 does not tell/);
    assert.match(unknown.err, /strom fetch zkusebni <book> --images 4-6 --recordset B0003 --background — <book> is its ID on the portal \(in its link: /);
    // no link at all, a link on another site: said so
    await w.ok(["recordset", "add", "Lhota N 1800–1850", "--kinds", "baptism"]); // B0004
    assert.match((await w.run(["fetch", "zkusebni", "--list", "--recordset", "B4"])).err, /and it has no link[\s\S]*strom fetch zkusebni <book> --list --recordset B0004/);
    await w.ok(["recordset", "add", "Lhota Z 1800–1850", "--kinds", "burial", "--url", "https://jinde.example.org/kniha/12"]); // B0005
    assert.match((await w.run(["fetch", "zkusebni", "--recordset", "B5", "--images", "1"])).err, /its link https:\/\/jinde\.example\.org\/kniha\/12 is not on zkusebni's portal \(127\.0\.0\.1\)/);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("a fetch is for --task, else the one task this session worked on that names the book (NFD text too), else the session's task: in its measure", opts, async () => {
  const { w, a } = await world();
  try {
    await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
    await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "Týnec", "--why", "zkouška", "--done-when", "hotovo"]); // T0001
    await w.ok(["task", "add", "Křty jinde", "--level", "locate", "--where", "B1", "--why", "zkouška", "--done-when", "hotovo"]); // T0002: names it, not worked on
    await w.ok(["session", "start", "T1"]);
    // the task the agent works on, added in the session: its place of search names the book (decomposed accents)
    await w.ok(["task", "add", "Křest Marie", "--level", "locate", "--where", "Matriky – kniha B0001, sv. 2".normalize("NFD"), "--why", "zkouška", "--done-when", "hotovo"]); // T0003
    const measured = () => {
      const file = path.join(w.cwd, ".strom", "metrics", "fetch.jsonl");
      return fs.readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { cmd?: string; task?: string; session?: string }).filter((r) => r.cmd === "fetch").at(-1);
    };
    await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"]);
    assert.equal(measured()?.task, "T0003");
    assert.equal(measured()?.session, "N0001");
    // given: that one
    await w.ok(["fetch", "zkusebni", "5359", "--images", "2", "--recordset", "B1", "--task", "T2"]);
    assert.equal(measured()?.task, "T0002");
    const none = await w.run(["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B1", "--task", "T99"]);
    assert.notEqual(none.code, 0);
    assert.match(none.err, /T0099/);
    // two tasks of the session name it: no guess — the session's task, as before
    await w.ok(["task", "add", "Křest Josefa", "--level", "locate", "--where", "B1", "--why", "zkouška", "--done-when", "hotovo"]); // T0004
    await w.ok(["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B1"]);
    assert.equal(measured()?.task, "T0001");
  } finally {
    w.cleanup();
    await a.close();
  }
});
