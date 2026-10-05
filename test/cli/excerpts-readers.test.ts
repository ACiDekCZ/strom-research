// Where an entry is on its scan (a source's clips), and the file for the Strom
// app with the entry cut out of its scan — by default, never committed.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { decodeImage, encodeImage, imageSize } from "../../src/image/index.ts";
import { resize } from "../../src/image/image.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { Tree } from "../../src/core/tree.ts";
import { planExcerpts } from "../../src/core/excerpt.ts";
import { opts, fixtures, world, source, stromRepo, tsx } from "./excerpts.helpers.ts";

test("strom clips: readers find the entries of sources without clips, a second look checks, what passes is kept", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["source", "add", "Křest Jana", "--kind", "baptism", "--recordset", "B1", "--media", "B1:1", "--transcript", "Joannes filius Josephi"]);
  await w.ok(["source", "add", "Křest cizí", "--recordset", "B1", "--media", "B1:2"]);
  await w.ok(["source", "add", "Dopis"]); // on no image
  await w.ok(["source", "add", "Křest Anny", "--clip", "B1:3@0.1,0.1,0.3,0.1"]); // has its clip
  await w.ok(["source", "add", "Pohřeb úzký", "--recordset", "B1", "--media", "B1:4"]); // cut off at first
  await w.ok(["source", "add", "Křty prošlé 1850–1860, žádný Novák", "--recordset", "B1", "--media", "B1:3"]); // S0006: a search, not an entry
  await w.ok(["event", "add", "P0001", "CHR", "--cite", "S0001"]);
  const dry = await w.ok(["clips", "--dry-run", "--json"]);
  assert.equal(dry.json.sources, 4);
  w.env.STROM_RUNNER_SCRIPT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
  const r = await w.run(["clips", "--agent", "script", "--json"]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.deepEqual(r.json.clipped.sort(), ["S0001", "S0005"]);
  assert.deepEqual(r.json.many, ["S0006"], "a search over many entries gets no clip");
  assert.equal(source(w, "S0006").clips, undefined);
  // cut off at the bottom: cut out lower, and checked again
  assert.deepEqual(source(w, "S0005").clips, [{ media: "M0004", region: { x: 0.1, y: 0.2, w: 0.5, h: 0.15 } }]);
  assert.deepEqual(r.json.rejected.map((v: { source: string }) => v.source), ["S0002"]);
  assert.deepEqual(source(w, "S0001").clips, [{ media: "M0001", region: { x: 0.1, y: 0.2, w: 0.5, h: 0.1 } }]);
  assert.equal(source(w, "S0002").clips, undefined, "the check turned it down");
  assert.deepEqual(source(w, "S0004").clips, [{ media: "M0003", region: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } }], "a clip there is kept");
  const find = fs.readFileSync(path.join(w.cwd, "notes", "readings", fs.readdirSync(path.join(w.cwd, "notes", "readings")).find((f) => f.endsWith("-clips-find-1.md"))!), "utf8");
  assert.match(find, /## S0001 · M0001\nresult: found/);
  assert.equal(spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout, "", "committed");
  // again: only what is still missing (the other entry, and the search)
  assert.equal((await w.ok(["clips", "--dry-run", "--json"])).json.sources, 2);
  w.cleanup();
});

test("strom transcripts: readers write the words of entries cut out of their scans, a second look checks, what passes is kept", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Křest Jana", "--clip", "B1:1@0.1,0.2,0.5,0.1"]); // S0001
  await w.ok(["source", "add", "Křest oprava", "--clip", "B1:2@0.1,0.2,0.5,0.1"]); // S0002: corrected by the check
  await w.ok(["source", "add", "Křest cizí", "--clip", "B1:3@0.1,0.2,0.5,0.1"]); // S0003: another entry
  await w.ok(["source", "add", "Pohřeb nečitelný", "--clip", "B1:4@0.1,0.2,0.5,0.1"]); // S0004: not read
  await w.ok(["source", "add", "Křest Anny", "--clip", "B1:1@0.1,0.4,0.5,0.1", "--transcript", "Anna"]); // has its words
  await w.ok(["source", "add", "Dopis"]); // on no image
  assert.equal((await w.ok(["transcripts", "--dry-run", "--json"])).json.sources, 4);
  w.env.STROM_RUNNER_SCRIPT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
  const r = await w.run(["transcripts", "--agent", "script", "--json"]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.deepEqual(r.json.transcribed.sort(), ["S0001", "S0002"]);
  assert.deepEqual(r.json.corrected, ["S0002"]);
  assert.deepEqual(r.json.rejected.map((v: { source: string }) => v.source), ["S0003"]);
  assert.deepEqual(r.json.unread, [{ source: "S0004", result: "unreadable" }]);
  assert.equal(source(w, "S0001").transcript, "Joannes filius\nJosephi Nowak [?]");
  assert.equal(source(w, "S0002").transcript, "Joannes filius\nJosephi Nowák", "the corrected words");
  assert.equal(source(w, "S0003").transcript, undefined);
  assert.equal(source(w, "S0005").transcript, "Anna", "words there are kept");
  assert.match(source(w, "S0001").notes.at(-1).text, /strom transcripts/);
  assert.equal(spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout, "", "committed");
  // again: only what is still missing
  assert.equal((await w.ok(["transcripts", "--dry-run", "--json"])).json.sources, 2);
  w.cleanup();
});

test("the main person comes first in the GEDCOM files: the one set, else the nearest descendant of every research's focus", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Linie Novákova", "--new-person", "Jan /Novák/", "--sex", "M"]); // P0001
  await w.ok(["research", "new", "Linie Svobodová", "--new-person", "Marie /Svobodová/", "--sex", "F"]); // P0002
  await w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]); // P0003, their son
  await w.ok(["person", "add", "Petr /Novák/", "--sex", "M"]); // P0004, his son
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002", "--child", "P0003"]);
  await w.ok(["family", "add", "--partner", "P0003", "--child", "P0004"]);
  const first = async () => {
    await w.ok(["export", "gedcom"]);
    const out = {} as Record<string, string>;
    for (const f of ["tree.ged", "tree-strom.ged"]) out[f] = /^0 @(P\d+)@ INDI/m.exec(fs.readFileSync(path.join(w.cwd, "output", f), "utf8"))![1]!;
    return out;
  };
  assert.deepEqual(await first(), { "tree.ged": "P0003", "tree-strom.ged": "P0003" }, "the son of both lines, not his son");
  await w.ok(["config", "set", "main.person", "P0004", "--for-tree"]);
  assert.deepEqual(await first(), { "tree.ged": "P0004", "tree-strom.ged": "P0004" });
  assert.match((await w.run(["config", "set", "main.person", "Petr", "--for-tree"])).err, /a person's ID, e\.g\. P0009/);
  w.cleanup();
});

test("export with images: the entries nearest to the research first; the farther ones by the setting excerpts.for", opts, async () => {
  const w = await world();
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Novák/", "--sex", "M"]); // P0001
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P0002 father: ancestor
  await w.ok(["person", "add", "Anna /Nováková/", "--sex", "F"]); // P0003 sister: family
  await w.ok(["person", "add", "Cizí /Člověk/", "--sex", "M"]); // P0004 linked to nobody
  await w.ok(["family", "add", "--partner", "P0002", "--child", "P0001", "--child", "P0003"]);
  for (const [n, p] of [[1, "P0004"], [2, "P0003"], [3, "P0002"]] as const) {
    await w.ok(["source", "add", `Zápis ${n}`, "--clip", `B1:${n}@0.1,0.1,0.5,0.1`]);
    await w.ok(["event", "add", p, "BIRT", "--cite", `S000${n}`]);
  }
  let r = (await w.ok(["export", "gedcom", "--images", "--json"])).json.images;
  assert.equal(r.sources, 2, "the ancestors and their families (default)");
  assert.equal(r.outOfScope, 1);
  r = (await w.ok(["export", "gedcom", "--images", "--images-for", "line", "--json"])).json.images;
  assert.equal(r.sources, 1);
  // over the limit even at the smallest: the farthest go first
  await w.ok(["export", "gedcom", "--images", "--images-for", "all"]);
  const each = fs.statSync(path.join(w.cwd, "output", "tree-strom.ged")).size / 3 / 1024 / 1024;
  r = (await w.ok(["export", "gedcom", "--images", "--images-for", "all", "--images-max-mb", String(each), "--json"])).json.images;
  assert.deepEqual(r.dropped.slice(0, 1), ["S0001"], "linked to nobody: left out first");
  w.cleanup();
});
