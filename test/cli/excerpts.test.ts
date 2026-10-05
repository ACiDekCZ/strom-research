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
  assert.match(ged, /0 @S0001@ SOUR[\s\S]*?1 REFN S0001\n1 OBJE\n2 FORM jpg\n2 _STROM_KIND excerpt\n2 _STROM_CLIP c[0-9a-f]{10}\n2 _URL https:\/\/archive\.example\.org\/book\/1\n2 FILE data:image\/jpeg;base64,/);
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
