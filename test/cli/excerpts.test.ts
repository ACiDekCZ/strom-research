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

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

/** A tree with a book of three small scans and a big one (image 4, 3200×2400). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Kniha N 1850-1870", "--kinds", "baptism", "--places", "Týnec", "--years", "1850-1870"]);
  const scans = path.join(w.dir, "kniha");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg", "s0003.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  fs.writeFileSync(path.join(scans, "s0004.jpg"), encodeImage(resize(decodeImage(fs.readFileSync(path.join(fixtures, "s0001.jpg"))), 3200, 2400), "jpeg"));
  await w.ok(["media", "add", scans, "--recordset", "B1", "--url", "https://archive.example.org/book/1"]);
  return w;
}

const source = (w: World, id: string) => readJsonFile(path.join(w.cwd, "data", "sources", `${id}.json`));

test("source clips: where the entry is, as its view was cut — fractions, a half, pixels, the whole image", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Křest Jana", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:2@0.1,0.2,0.5,0.1"]);
  let s = source(w, "S0001");
  assert.deepEqual(s.clips, [{ media: "M0002", region: { x: 0.1, y: 0.2, w: 0.5, h: 0.1 } }]);
  assert.deepEqual(s.media, ["M0002"], "a clip cites its image");
  // a half, then a crop within it (as media view --half left --crop …)
  await w.ok(["source", "edit", "S0001", "--clip", "B1:3@left:0.2,0.5,0.8,0.25"]);
  s = source(w, "S0001");
  assert.deepEqual(s.clips[1], { media: "M0003", region: { x: 0.1, y: 0.5, w: 0.4, h: 0.25 } });
  assert.deepEqual(s.media, ["M0002", "M0003"]);
  // pixels of the registered image; the M…:x,y,w,h form
  await w.ok(["source", "add", "Křest Anny", "--clip", "M0001:40,30,200,60"]);
  assert.deepEqual(source(w, "S0002").clips, [{ media: "M0001", region: { x: 0.1, y: 0.1, w: 0.5, h: 0.2 } }]);
  // the entry is the whole image (a certificate)
  await w.ok(["source", "add", "List", "--clip", "M0001"]);
  assert.deepEqual(source(w, "S0003").clips, [{ media: "M0001", region: { x: 0, y: 0, w: 1, h: 1 } }]);
  assert.match((await w.ok(["source", "show", "S0001"])).out, /clips {2}1\. M0002@0\.1,0\.2,0\.5,0\.1 · 2\. M0003@0\.1,0\.5,0\.4,0\.25/);
  // at most three; a wrong one goes by its number
  await w.ok(["source", "edit", "S0001", "--clip", "M0004@0.1,0.1,0.2,0.2"]);
  assert.match((await w.run(["source", "edit", "S0001", "--clip", "M0001@0.1,0.1,0.2,0.2"])).err, /at most 3 clips/);
  await w.ok(["source", "edit", "S0001", "--clip-remove", "2"]);
  assert.deepEqual(source(w, "S0001").clips.map((c: { media: string }) => c.media), ["M0002", "M0004"]);
  assert.match((await w.run(["source", "edit", "S0001", "--clip-remove", "5"])).err, /--clip-remove takes 1–2 or all/);
  await w.ok(["source", "edit", "S0001", "--clip-remove", "all"]);
  assert.equal(source(w, "S0001").clips, undefined);
  assert.match((await w.run(["source", "add", "X", "--clip", "B1:9@0.1,0.1,0.2,0.2"])).err, /image 9 of B0001 is not registered/);
  assert.equal((await w.run(["check"])).code, 0);
  w.cleanup();
});

test("media view: a crop says the clip of the source read in it", opts, async () => {
  const w = await world();
  const r = await w.ok(["media", "view", "B1:2", "--half", "right", "--crop", "0,0.5,1,0.25", "--json"]);
  assert.equal(r.json.clip, "M0002@0.5,0.5,0.5,0.25");
  assert.match((await w.ok(["media", "view", "B1:2", "--crop", "0.1,0.2,0.5,0.1"])).out, /the source of an entry read here: --clip M0002@0\.1,0\.2,0\.5,0\.1/);
  assert.doesNotMatch((await w.ok(["media", "view", "B1:2"])).out, /--clip/, "the whole image is no clip");
  w.cleanup();
});

test("the Strom file carries the entries cut out of their scans by default; it stays out of the history, the standard file in it", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["source", "add", "Křest Jana", "--kind", "baptism", "--recordset", "B1", "--date", "12 MAR 1865", "--clip", "B1:4@0.1,0.4,0.8,0.08"]);
  await w.ok(["source", "add", "Křest Anny", "--recordset", "B1", "--media", "B1:1"]); // on an image, no clip
  await w.ok(["event", "add", "P0001", "CHR", "--date", "12 MAR 1865", "--cite", "S0001"]);
  await w.ok(["person", "add", "Anna /Nováková/", "--sex", "F"]);
  await w.ok(["event", "add", "P0002", "CHR", "--cite", "S0002"]);
  // a tree that committed the Strom file before (an older strom) lets go of it once
  const file = path.join(w.cwd, "output", "tree-strom.ged");
  fs.writeFileSync(file, "0 HEAD\n0 TRLR\n");
  const ignore = path.join(w.cwd, ".gitignore");
  fs.writeFileSync(ignore, fs.readFileSync(ignore, "utf8").replace("/output/*-strom.ged\n", ""));
  Tree.open(w.cwd, w.env).commit("An export of an older strom", [".gitignore", "output/tree-strom.ged"]);
  assert.match(spawnSync("git", ["ls-files", "output"], { cwd: w.cwd, encoding: "utf8" }).stdout, /tree-strom\.ged/);
  const r = await w.ok(["export", "gedcom", "--json"]);
  assert.deepEqual(r.json.files.map((f: { for: string }) => f.for), ["standard", "strom"]);
  assert.equal(r.json.images.excerpts, 1);
  assert.deepEqual(r.json.images.unclipped, ["S0002"]);
  const ged = fs.readFileSync(file, "utf8");
  assert.match(ged, /0 @S0001@ SOUR[\s\S]*?1 REFN S0001\n1 OBJE\n2 FORM jpg\n2 _STROM_KIND excerpt\n2 _URL https:\/\/archive\.example\.org\/book\/1\n2 FILE data:image\/jpeg;base64,/);
  assert.match(ged, /2 SOUR @S0001@\n3 QUAY \d\n3 DATA\n4 DATE 12 MAR 1865/, "when the entry was made");
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  // the excerpt: the clip with a margin, at most 1200 px on its long side
  const lines = ged.split("\n");
  const at = lines.findIndex((l) => l.startsWith("2 FILE data:"));
  let data = lines[at]!.slice("2 FILE ".length);
  for (let i = at + 1; lines[i]!.startsWith("3 CONC "); i++) data += lines[i]!.slice("3 CONC ".length);
  const jpeg = Buffer.from(data.split(",")[1]!, "base64");
  const size = imageSize(jpeg)!;
  assert.equal(size.width, 1200);
  assert.ok(size.height > 120 && size.height < 200, JSON.stringify(size));
  // ignored by git (and no longer tracked), the standard file committed, the tree clean; the next export reuses the cut excerpt
  assert.match(fs.readFileSync(path.join(w.cwd, ".gitignore"), "utf8"), /^\/output\/\*-strom\.ged$/m);
  const tracked = spawnSync("git", ["ls-files", "output"], { cwd: w.cwd, encoding: "utf8" }).stdout;
  assert.match(tracked, /output\/tree\.ged/);
  assert.doesNotMatch(tracked, /tree-strom\.ged/);
  assert.equal(spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout, "");
  assert.equal(fs.readdirSync(path.join(w.cwd, ".strom", "excerpts")).length, 1);
  assert.doesNotMatch(fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8"), /OBJE/, "the standard file: the words only");
  // without images, by the setting
  await w.ok(["config", "set", "excerpts.for", "none", "--for-tree"]);
  await w.ok(["export", "gedcom"]);
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /OBJE/);
  await w.ok(["config", "unset", "excerpts.for", "--for-tree"]);
  // over the limit: the words stay, the image does not
  const small = await w.ok(["export", "gedcom", "--images-max-mb", "0.001", "--json"]);
  assert.equal(small.json.images.level, "smaller", "made smaller first");
  assert.deepEqual(small.json.images.dropped, ["S0001"], "then left out");
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /OBJE/);
  assert.match((await w.ok(["export", "gedcom", "--images-max-mb", "0.001"])).out, /WARNING made smaller to fit the limit of 0\.001 MB: smaller instead of normal[\s\S]*WARNING left out to fit/);
  assert.match((await w.run(["export", "gedcom", "--images", "--for", "standard"])).err, /images go into the file for the Strom app only/);
  // after a session, new excerpts are made for a while at most: none made yet and no time → the next export
  fs.rmSync(path.join(w.cwd, ".strom", "excerpts"), { recursive: true });
  const tree = Tree.open(w.cwd, w.env);
  const later = planExcerpts(tree, path.join(w.home, "shared"), { quality: "normal", for: "all", maxBytes: 1e9, budgetMs: -1 });
  assert.deepEqual([later.report.excerpts, later.report.later], [0, ["S0001"]]);
  assert.equal(planExcerpts(tree, path.join(w.home, "shared"), { quality: "normal", for: "all", maxBytes: 1e9 }).report.excerpts, 1);
  w.cleanup();
});

test("export with images: an excerpt comes from a part of the image fetched sharper", opts, async () => {
  const w = await world();
  // the upper left quarter of image 1, saved at twice the detail
  const part = path.join(w.dir, "detail.jpg");
  fs.writeFileSync(part, encodeImage(resize(decodeImage(fs.readFileSync(path.join(fixtures, "s0001.jpg"))), 400, 300), "jpeg"));
  await w.ok(["media", "add", part, "--recordset", "B1", "--image", "1", "--crop", "0,0,0.5,0.5"]);
  await w.ok(["source", "add", "Křest", "--clip", "B1:1@0.1,0.1,0.3,0.2"]);
  await w.ok(["export", "gedcom", "--images", "--images-for", "all"]); // cited by nobody: only with all
  const cut = fs.readdirSync(path.join(w.cwd, ".strom", "excerpts"));
  assert.equal(cut.length, 1);
  assert.match(cut[0]!, /^M0005-/, "cut from the sharper part");
  w.cleanup();
});

const stromRepo = path.resolve(import.meta.dirname, "..", "..", "..", "strom");
const tsx = path.join(stromRepo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");

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
  assert.match(ged, /0 @S0001@ SOUR\n(?:[^0].*\n)*1 OBJE\n2 FORM jpg\n2 _STROM_KIND excerpt\n2 FILE data:image\/jpeg;base64,/);
  assert.doesNotMatch(r.out, /no clip/);
  w.cleanup();
});

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
