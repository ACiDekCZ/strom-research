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

test("the Strom app takes the export with images: an older one everything but the new tags, 3.1.0 the excerpts too", { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
  const { STROM_READS_EXCERPTS, stromReadsTags } = await import("../../src/gedcom/export.ts");
  const app = JSON.parse(fs.readFileSync(path.join(stromRepo, "package.json"), "utf8")).version as string;
  const w = await world();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["source", "add", "Křest Jana", "--kind", "baptism", "--recordset", "B1", "--date", "12 MAR 1865", "--transcript", "Joannes", "--clip", "B1:4@0.1,0.4,0.8,0.08"]);
  await w.ok(["event", "add", "P0001", "CHR", "--date", "12 MAR 1865", "--cite", "S0001"]);
  await w.ok(["export", "gedcom", "--images"]);
  const script = path.join(w.dir, "rt.ts");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(stromRepo, "src", "ged-parser.ts"))};
const parsed = parseGedcom(fs.readFileSync(process.argv[2], "utf8"));
const conv = convertToStrom(parsed);
const persons = Object.values(conv.data.persons) as any[];
const sources = Object.values(conv.data.sources ?? {}) as any[];
console.log(JSON.stringify({ dropped: [...parsed.droppedTags.entries()], stats: conv.stats, persons: persons.length, sources: sources.map((s) => ({ title: s.title, note: s.note, transcript: s.transcript, refn: s.refn, excerpts: s.excerpts?.length ?? 0 })), jan: persons[0]?.events?.map((e: any) => ({ type: e.type, sourceIds: e.sourceIds })) }));
`,
  );
  const r = spawnSync(tsx, [script, path.join(w.cwd, "output", "tree-strom.ged")], { cwd: stromRepo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim().split("\n").pop()!);
  assert.equal(out.persons, 1);
  assert.equal(out.sources.length, 1);
  assert.equal(out.jan[0].sourceIds.length, 1, "the citation stays");
  if (stromReadsTags(app, STROM_READS_EXCERPTS)) {
    // it reads them all: the transcript, the entry's REFN, its excerpt
    assert.deepEqual(out.dropped, []);
    assert.match(out.sources[0].transcript, /Joannes/);
    assert.equal(out.sources[0].refn, "S0001");
    assert.equal(out.sources[0].excerpts, 1);
  } else {
    // it says which it left out (the source's REFN and the excerpt); the rest comes in whole
    assert.deepEqual(out.dropped.map((d: [string, number]) => d[0]).sort(), ["OBJE", "REFN"]);
    assert.match(out.sources[0].note, /Joannes/);
  }
  w.cleanup();
});

test("an entry recorded from a scan without its clip: strom asks for it (source add, source edit, task done)", opts, async () => {
  const w = await world();
  const add = await w.ok(["source", "add", "Křest Jana", "--recordset", "B1", "--media", "B1:1"]);
  assert.match(add.out, /note: say where the entry is on M0001: strom source edit S0001 --clip M0001@x,y,w,h/);
  assert.match(add.out, /note: write the words of the entry as they stand .*: strom source edit S0001 --transcript @<file>/);
  assert.doesNotMatch((await w.ok(["source", "add", "Pohřeb Josefa", "--clip", "B1:4", "--transcript", "Josephus"])).out, /note:/, "clip and words: nothing to ask");
  assert.doesNotMatch((await w.ok(["source", "add", "Křest Anny", "--clip", "B1:2@0.1,0.1,0.3,0.1"])).out, /note: say where/);
  assert.doesNotMatch((await w.ok(["source", "add", "Dopis"])).out, /note: say where/, "not on a scan");
  assert.match((await w.ok(["source", "edit", "S0004", "--media", "B1:3"])).out, /note: say where the entry is on M0003[\s\S]*S0004 --transcript/);
  await w.ok(["task", "add", "Přečíst křty", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  const done = await w.ok(["task", "done", "T0001", "--result", "přečteno", "--produced", "S0001", "--produced", "S0002", "--produced", "S0003"]);
  assert.match(done.out, /S0001 --clip M0001/);
  assert.match(done.out, /S0001 --transcript/);
  assert.doesNotMatch(done.out, /S0002 --/, "its clip and its words: nothing to ask");
  assert.doesNotMatch(done.out, /S0003 --clip/);
  assert.match(done.out, /S0003 --transcript/, "a clip, but no words yet");
  w.cleanup();
});

test("media retract: an image put in the wrong place is withdrawn — kept, unused, its file free to register again", opts, async () => {
  const w = await world();
  // a detail registered as a sharper part of image 4 — it belongs to image 2
  const detail = path.join(w.dir, "detail.jpg");
  fs.writeFileSync(detail, encodeImage(resize(decodeImage(fs.readFileSync(path.join(fixtures, "s0002.jpg"))), 1600, 1200), "jpeg"));
  await w.ok(["media", "add", detail, "--recordset", "B1", "--image", "4", "--crop", "0,0,0.5,0.5"]); // M0005
  assert.match((await w.ok(["media", "show", "M0004"])).out, /parts of it, sharper .*: M0005/);
  await w.ok(["source", "add", "Křest Jana", "--clip", "M0001@0.1,0.1,0.5,0.2"]);
  const cited = await w.run(["media", "retract", "M0001", "--reason", "jiná strana"]);
  assert.equal(cited.code, 2, "a cited image is not withdrawn");
  assert.match(cited.err + cited.out, /M0001 is cited by S0001/);
  assert.equal((await w.run(["media", "retract", "M0005"])).code, 2, "a reason is required");
  assert.match((await w.ok(["media", "retract", "M0005", "--reason", "díl strany 2, ne 4"])).out, /M0005 retracted: díl strany 2, ne 4/);
  assert.doesNotMatch((await w.ok(["media", "show", "M0004"])).out, /parts of it/);
  assert.match((await w.ok(["media", "show", "M0005"])).out, /RETRACTED \d{4}-\d{2}-\d{2}: díl strany 2, ne 4/);
  const again = await w.ok(["media", "add", detail, "--recordset", "B1", "--image", "2", "--crop", "0,0,0.5,0.5"]);
  assert.doesNotMatch(again.out, /same file/);
  assert.match((await w.ok(["media", "show", "M0002"])).out, /parts of it, sharper .*: M0006/);
  w.cleanup();
});

test("the Strom file without images carries the entry's REFN and date for Strom 3.1.0 and an app of unknown version, not for an older one", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["source", "add", "Křest Jana", "--kind", "baptism", "--recordset", "B1", "--date", "12 MAR 1865", "--transcript", "Joannes"]);
  await w.ok(["event", "add", "P0001", "CHR", "--date", "12 MAR 1865", "--cite", "S0001"]);
  const ged = () => fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  for (const version of [undefined, "3.1.0"]) {
    if (version) await w.ok(["config", "set", "strom.version", version]);
    await w.ok(["export", "gedcom", "--for", "strom"]);
    assert.match(ged(), /0 @S0001@ SOUR\n(?:[^0].*\n)*1 REFN S0001\n/, version ?? "unknown");
    assert.match(ged(), /2 SOUR @S0001@\n(?:[3-9].*\n)*3 DATA\n4 DATE 12 MAR 1865\n/, version ?? "unknown");
    assert.doesNotMatch(ged(), /OBJE/, "images only in the export with images");
  }
  await w.ok(["config", "set", "strom.version", "3.0.1"]);
  await w.ok(["export", "gedcom", "--for", "strom"]);
  assert.doesNotMatch(ged(), /1 REFN S0001|4 DATE 12 MAR 1865/);
  w.cleanup();
});

test("a document the user gave as a scan is its own excerpt, the whole image", opts, async () => {
  const w = await world();
  const doc = path.join(w.dir, "Křestní list Anny.jpg");
  fs.copyFileSync(path.join(fixtures, "s0002.jpg"), doc);
  await w.ok(["intake", doc]);
  await w.ok(["person", "add", "Anna /Nováková/", "--sex", "F"]);
  await w.ok(["source", "add", "Křestní list Anny", "--kind", "certificate", "--input", "I0001"]);
  await w.ok(["event", "add", "P0001", "BIRT", "--date", "1901", "--cite", "S0001"]);
  const r = await w.ok(["export", "gedcom", "--images", "--json"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.match(ged, /0 @S0001@ SOUR\n(?:[^0].*\n)*1 OBJE\n2 FORM jpg\n2 _STROM_KIND excerpt\n2 _STROM_CLIP input\n2 FILE data:image\/jpeg;base64,/);
  assert.doesNotMatch(r.out, /no clip/);
  w.cleanup();
});
