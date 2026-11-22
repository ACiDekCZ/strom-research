// The images searched against the years around a date estimated from an age (spec 131 U1, K1.3–K1.5): said to the
// agent at search add/edit, session close and task done, never refused, nothing written to the data — the regression of
// a close over images 66–85 of a book of baptisms when the person, born about 1761 by their age, was baptised 1755.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

/** A research of the Lhoták family: the book of baptisms of Lhota 1732–1784, Lhotimír born ABT 1761, images 66–85 searched. */
async function world(margin?: number): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  w.env.STROM_LANG = "en";
  w.env.STROM_NONINTERACTIVE = "1";
  if (margin !== undefined) await w.ok(["config", "set", "search.ageMargin", String(margin), "--for-tree"]);
  await w.ok(["person", "add", "Lhotimír /Lhoták/", "--sex", "M"]); // P0001
  await w.ok(["event", "add", "P0001", "BIRT", "--date", "ABT 1761", "--place", "Lhota"]);
  await w.ok(["person", "add", "Lhotislav /Lhoták/", "--sex", "M"]); // P0002: no date estimated
  await w.ok(["recordset", "add", "Lhota, křty 1732–1784", "--kinds", "baptism", "--places", "Lhota", "--years", "1732-1784", "--images", "251"]); // B0001
  await w.ok(["task", "add", "Křest Lhotimíra", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "nalezen", "--about", "P0001"]); // T0001
  await w.ok(["task", "add", "Křest Lhotislava", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "nalezen", "--about", "P0002"]); // T0002
  await w.ok(["session", "start", "T0001"]);
  // the siblings found: both searches found something, none negative (as in the run it comes from)
  await w.ok(["source", "add", "Křest Lhotomila Lhotáka 1759", "--kind", "baptism", "--recordset", "B0001", "--image", "68"]); // S0001
  await w.ok(["search", "add", "Křty Lhoták 1758–1764", "--recordset", "B0001", "--pages", "66-80", "--years", "1758-1764", "--method", "page-by-page", "--result", "found", "--found", "S0001"]); // Q0001
  await w.ok(["search", "add", "Křty Lhoták 1764–1767", "--recordset", "B0001", "--pages", "81–85", "--years", "1764-1767", "--method", "page-by-page", "--result", "found", "--found", "S0001"]); // Q0002
  return w;
}

/** What the last commit wrote into the research's data: its files and the operations logged (no times). */
function lastWrite(w: World): { files: string[]; ops: string[] } {
  const files = spawnSync("git", ["show", "--name-only", "--format=", "HEAD"], { cwd: w.cwd, encoding: "utf8" })
    .stdout.split("\n")
    .filter(Boolean)
    .map((f) => f.replace(/\d{4}-\d\d\/\d\d\/[^/]+$/u, "<ops>"))
    .sort();
  const diff = spawnSync("git", ["show", "--format=", "HEAD", "--", "data/ops"], { cwd: w.cwd, encoding: "utf8" }).stdout;
  const ops = diff
    .split("\n")
    .filter((l) => l.startsWith("+{"))
    .map((l) => JSON.parse(l.slice(1)) as { op: string; summary?: string })
    .map((o) => `${o.op} ${o.summary ?? ""}`);
  return { files, ops };
}

test("the regression: session close --done over images 66–85 — closed (exit 0), told 1756–1757 were not searched and the book continues before image 66", opts, async () => {
  const w = await world();
  const r = await w.run(["session", "close", "--done", "křest v sn. 66–85 není", "--next", "sourozenci Lhotimíra"]);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /coverage of B0001: P0001 ABT 1761 ±5 → 1756–1766/);
  assert.match(r.out, /1756–1757 not searched — the book continues before image 66/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "tasks", "T0001.json"), "utf8")).state, "done");
  assert.equal(fs.readFileSync(path.join(w.cwd, ".strom", "clock", "N0001.coverage"), "utf8").trim(), "B0001");
  w.cleanup();
});

test("--json carries coverage; told once a session and book: task done, then session close says nothing more (K1.3, K1.4)", opts, async () => {
  const w = await world();
  const done = await w.ok(["task", "done", "T0001", "--result", "křest v sn. 66–85 není", "--json"]);
  assert.equal(done.json.task.state, "done");
  assert.equal(done.json.coverage.length, 1);
  const c = done.json.coverage[0];
  assert.equal(c.recordset, "B0001");
  assert.deepEqual([c.window.from, c.window.to, c.window.person, c.window.date, c.window.margin], [1756, 1766, "P0001", "ABT 1761", 5]);
  assert.deepEqual(c.searched, [{ from: 1758, to: 1767 }]);
  assert.deepEqual(c.missing, [{ from: 1756, to: 1757, where: "before image 66", continues: true }]);
  const close = await w.ok(["session", "close", "--summary", "křest nenalezen", "--next", "sourozenci", "--json"]);
  assert.equal(close.json.coverage, undefined, "said once in the session");
  w.cleanup();
});

test("the warning writes nothing to the data: the close writes the same files and operations as one with nothing to say (K1.4)", opts, async () => {
  const warned = await world();
  const quiet = await world(1); // ABT 1761 ±1: 1760–1762, within the images searched
  const a = await warned.run(["session", "close", "--done", "nenalezen", "--next", "dál"]);
  const b = await quiet.run(["session", "close", "--done", "nenalezen", "--next", "dál"]);
  assert.equal(a.code, 0);
  assert.equal(b.code, 0);
  assert.match(a.out, /not searched/);
  assert.doesNotMatch(b.out, /coverage of/);
  assert.deepEqual(lastWrite(warned), lastWrite(quiet));
  assert.equal(fs.existsSync(path.join(quiet.cwd, ".strom", "clock", "N0001.coverage")), false);
  warned.cleanup();
  quiet.cleanup();
});

test("search.ageMargin: the research's setting widens the window; a whole number from 1 to 30 (K1.2)", opts, async () => {
  const w = await world(8);
  const r = await w.ok(["task", "done", "T0001", "--result", "nenalezen", "--json"]);
  // ABT 1761 ±8 → 1753–1769: before image 66 and after image 85
  assert.deepEqual(r.json.coverage[0].missing.map((m: { from: number; to: number; where: string }) => [m.from, m.to, m.where]), [[1753, 1757, "before image 66"], [1768, 1769, "after image 85"]]);
  assert.match((await w.run(["config", "set", "search.ageMargin", "0", "--for-tree"])).err, /search.ageMargin is a whole number of years from 1 to 30/);
  assert.match((await w.run(["config", "set", "search.ageMargin", "abc", "--for-tree"])).err, /from 1 to 30/);
  assert.match((await w.run(["config", "set", "search.ageMargin", "31", "--for-tree"])).err, /from 1 to 30/);
  assert.match((await w.run(["config", "set", "search.ageMargin", "2.5", "--for-tree"])).err, /whole number/);
  w.cleanup();
});

test("search add/edit: a negative search over images 66–85 claiming 1756–1766 is told, recorded all the same; one without an estimate over the years they hold is not", opts, async () => {
  const w = await world();
  const neg = await w.run(["search", "add", "Křest Lhotimíra", "--recordset", "B0001", "--pages", "66-85", "--years", "1756-1766", "--method", "page-by-page", "--result", "negative", "--json"]);
  assert.equal(neg.code, 0, neg.err);
  const j = JSON.parse(neg.out);
  assert.equal(j.search.id, "Q0003");
  assert.deepEqual(j.coverage[0].missing.map((m: { from: number; to: number; where: string }) => [m.from, m.to, m.where]), [[1756, 1757, "before image 66"]]);
  const text = await w.ok(["search", "add", "Křest Lhotimíra", "--recordset", "B0001", "--pages", "66-85", "--years", "1756-1766", "--method", "page-by-page", "--result", "negative"]);
  assert.match(text.out, /1756–1757 not searched — the book continues before image 66/);
  // the years the images hold, for a task whose person has no date estimated: nothing
  const fine = await w.ok(["search", "add", "Křest Lhotislava", "--recordset", "B0001", "--pages", "66-85", "--years", "1758-1767", "--method", "page-by-page", "--result", "negative", "--task", "T0002"]);
  assert.doesNotMatch(fine.out, /coverage of/);
  // a found search is no claim of absence: nothing
  const found = await w.ok(["search", "add", "Křty Lhoták", "--recordset", "B0001", "--pages", "66-85", "--years", "1756-1766", "--method", "page-by-page", "--result", "found", "--found", "S0001"]);
  assert.doesNotMatch(found.out, /coverage of/);
  // an edit of it is told the same
  const noted = await w.ok(["search", "edit", "Q0003", "--note", "sn. 66–85 celé", "--json"]);
  assert.deepEqual(noted.json.coverage[0].missing.map((m: { from: number; to: number }) => [m.from, m.to]), [[1756, 1757]]);
  // edited to take in images 61–65 (1755–1758 by another search): nothing left to say
  await w.ok(["search", "add", "Křty Lhoták 1755–1758", "--recordset", "B0001", "--pages", "61-65", "--years", "1755-1758", "--method", "page-by-page", "--result", "negative", "--task", "T0002"]);
  const edit = await w.ok(["search", "edit", "Q0003", "--pages", "61-85", "--reason", "sn. 61–65 prohledány", "--json"]);
  assert.equal(edit.json.coverage, undefined);
  w.cleanup();
});
