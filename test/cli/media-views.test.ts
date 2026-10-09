// Several views in one call of strom media view: images, a range, pages, parts of each — the files listed in the order
// they are opened, each with its image, page and clip; within the model's image size and the halves rule; at most
// VIEW_MAX_IMAGES images and VIEW_MAX_VIEWS views.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { decodeImage, encodeImage } from "../../src/image/index.ts";

const opts = { skip: !hasGit };

/** Images 1–2: double pages 3200×2000; 3: a single page 1500×2200; 4: a small spread 400×300. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Kniha křtů 1801-1830", "--kinds", "baptism", "--places", "Dolní Ves", "--years", "1801-1830"]);
  const dir = path.join(w.dir, "scans");
  fs.mkdirSync(dir);
  // (each its own content: the same image twice is stored once)
  const img = (name: string, width: number, height: number, grey: number) =>
    fs.writeFileSync(path.join(dir, name), encodeImage({ width, height, channels: 3, data: new Uint8Array(width * height * 3).fill(grey) }, "jpeg"));
  img("s0001.jpg", 3200, 2000, 200);
  img("s0002.jpg", 3200, 2000, 180);
  img("s0003.jpg", 1500, 2200, 160);
  img("s0004.jpg", 400, 300, 140);
  await w.ok(["media", "add", dir, "--recordset", "B1"]);
  return w;
}

const size = (f: string) => {
  const i = decodeImage(new Uint8Array(fs.readFileSync(f)));
  return [i.width, i.height];
};

test("media view: several images in one call — a range, several arguments, pages; listed in order, each with its image", opts, async () => {
  const w = await world();
  const r = await w.ok(["media", "view", "B1:1-3"]);
  const out = r.out.trim().split("\n");
  assert.equal(out[0], "3 view(s) of 3 image(s) — open them all at once:");
  // a path, then its caption: the image as asked for, its ID
  assert.match(out[1]!, /\.strom[\\/]views[\\/]M0001-[0-9a-f]{10}\.jpg$/);
  assert.match(out[2]!, /^ {2}B0001:1 \(M0001\) · 2000×1250 px · whole image of 3200×2000 · 63 % · reduced$/);
  assert.match(out[3]!, /M0002-/);
  assert.match(out[5]!, /M0003-/);
  assert.match(r.out, /^reduced: crop the part you need/m, "the hint once, not per view");
  const j = (await w.ok(["media", "view", "B1:1-3", "--json"])).json;
  assert.equal(j.images, 3);
  assert.deepEqual(j.views.map((v: { image: string }) => v.image), ["M0001", "M0002", "M0003"]);
  assert.deepEqual(j.views.map((v: { ref: string }) => v.ref), ["B0001:1", "B0001:2", "B0001:3"]);
  for (const v of j.views) assert.ok(fs.existsSync(v.view));
  // the same by several arguments, a list, --image, and the M… IDs (the image named as its record set's)
  const ids = async (...a: string[]) => (await w.ok(["media", "view", ...a, "--json"])).json.views.map((v: { image: string }) => v.image);
  assert.deepEqual(await ids("B1:1", "B1:3"), ["M0001", "M0003"]);
  assert.deepEqual(await ids("B1:1,3"), ["M0001", "M0003"]);
  assert.deepEqual(await ids("B1", "--image", "2", "3"), ["M0002", "M0003"]);
  assert.deepEqual(await ids("B1", "--image", "1-2"), ["M0001", "M0002"]);
  assert.deepEqual(await ids("M0003", "M0001", "B1:1"), ["M0003", "M0001"], "in the order asked, each image once");
  assert.match((await w.ok(["media", "view", "M0003", "M0001"])).out, /^ {2}B0001:3 \(M0003\) · /m);
  // pages of a calibrated book: "--page 10 11", a range
  await w.ok(["recordset", "calibrate", "B1", "--point", "1=10", "--point", "3=12"]);
  assert.deepEqual(await ids("B1", "--page", "10", "11"), ["M0001", "M0002"]);
  assert.deepEqual(await ids("B1", "--page", "11-12"), ["M0002", "M0003"]);
  assert.match((await w.ok(["media", "view", "B1", "--page", "10", "12"])).out, /^ {2}B0001:3 \(M0003, page 12\) · /m);
  // images of a range not registered: said, the others made
  const some = await w.ok(["media", "view", "B1:3-6", "--json"]);
  assert.deepEqual(some.json.views.map((v: { image: string }) => v.image), ["M0003", "M0004"]);
  assert.deepEqual(some.json.missing, ["B0001:5", "B0001:6"]);
  assert.match((await w.ok(["media", "view", "B1:3-6"])).out, /^not registered: B0001:5, B0001:6 — strom media list --recordset B0001$/m);
  const none = await w.run(["media", "view", "B1:7-8"]);
  assert.equal(none.code, 2);
  assert.match(none.err, /none of these images is registered: B0001:7, B0001:8/);
  // an image whose file is not here (a research handed over without it): said, the others made
  const file = path.join(w.home, "shared", JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "images", "M0002.json"), "utf8")).file);
  fs.renameSync(file, `${file}.away`);
  const gone = await w.ok(["media", "view", "B1:1-3", "--json"]);
  assert.deepEqual(gone.json.views.map((v: { image: string }) => v.image), ["M0001", "M0003"]);
  assert.equal(gone.json.images, 2);
  assert.equal(gone.json.failed[0].ref, "B0001:2");
  assert.match((await w.ok(["media", "view", "B1:1-3"])).out, /^2 view\(s\) of 2 image\(s\)[^]*^no view of B0001:2: the image file is missing: .+ → the shared folder may have moved: strom config where$/m);
  assert.match((await w.run(["media", "view", "B1:2", "M0002"])).err, /the image file is missing/, "none to show: said as one image's is");
  fs.renameSync(`${file}.away`, file);
  // a number alone names no image
  const alone = await w.run(["media", "view", "M0001", "57"]);
  assert.equal(alone.code, 2);
  assert.match(alone.err, /a number alone names no image: 57/);
  assert.equal((await w.run(["media", "view", "B1:9-x"])).code, 2);
  w.cleanup();
});

test("media view: several parts of each image — both pages of a spread by the halves rule, sides, crops, a grid", opts, async () => {
  const w = await world();
  // --half both: the two pages of a spread overlapping at the gutter, each sharper than the whole in one view
  const both = (await w.ok(["media", "view", "B1:1", "B1:3", "B1:4", "--half", "both", "--json"])).json;
  assert.deepEqual(
    both.views.map((v: { image: string; part?: string; note?: string }) => [v.image, v.part ?? v.note]),
    [
      ["M0001", "left page"],
      ["M0001", "right page"],
      ["M0003", "one view: its halves would be no sharper"],
      ["M0004", "one view: its halves would be no sharper"],
    ],
  );
  assert.deepEqual(both.views[0].region, { x: 0, y: 0, w: 1728, h: 2000 });
  assert.deepEqual(both.views[1].region, { x: 1472, y: 0, w: 1728, h: 2000 });
  assert.deepEqual(size(both.views[0].view), [1728, 2000], "at full resolution: within the 2000 px the model takes");
  assert.equal(both.views[2].clip, undefined, "a whole image is no clip");
  assert.equal(both.views[0].clip, "M0001@0,0,0.54,1", "each part with its clip, for an exact citation");
  const text = (await w.ok(["media", "view", "B1:1", "--half", "both"])).out;
  assert.match(text, /^ {2}B0001:1 \(M0001\) · left page · 1728×2000 px · part 0,0 1728×2000 px of 3200×2000 · 100 % · --clip M0001@0,0,0\.54,1$/m);
  assert.match(text, /^ {2}B0001:1 \(M0001\) · right page · .* · --clip M0001@0\.46,0,0\.54,1$/m);
  // the model's size holds for every view: an agent whose model takes 1568
  w.env.STROM_AGENT = "grok";
  const small = (await w.ok(["media", "view", "B1:1-2", "--half", "both", "--json"])).json;
  delete w.env.STROM_AGENT;
  assert.equal(small.views.length, 4);
  for (const v of small.views) assert.ok(Math.max(v.width, v.height) <= 1568, `${v.width}×${v.height}`);
  // --half left --half right (as before: the exact halves), a comma list too
  const sides = (await w.ok(["media", "view", "M0001", "--half", "left", "--half", "right", "--json"])).json;
  assert.deepEqual(sides.views.map((v: { region: unknown }) => v.region), [{ x: 0, y: 0, w: 1600, h: 2000 }, { x: 1600, y: 0, w: 1600, h: 2000 }]);
  assert.deepEqual(sides.views.map((v: { part: string }) => v.part), ["left half", "right half"]);
  assert.equal((await w.ok(["media", "view", "M0001", "--half", "left,right", "--json"])).json.views.length, 2);
  // several crops of one image: each with its clip
  const crops = (await w.ok(["media", "view", "B1:3", "--crop", "0.1,0.1,0.4,0.2", "--crop", "0.1,0.5,0.4,0.2", "--json"])).json;
  assert.deepEqual(crops.views.map((v: { clip: string }) => v.clip), ["M0003@0.1,0.1,0.4,0.2", "M0003@0.1,0.5,0.4,0.2"]);
  // a grid of overlapping parts: of the image, or of each page of a spread
  const grid = (await w.ok(["media", "view", "B1:3", "--split", "2x2", "--json"])).json;
  assert.equal(grid.views.length, 4);
  assert.deepEqual(grid.views.map((v: { part: string }) => v.part), ["part 1 of 4 (top left)", "part 2 of 4 (top right)", "part 3 of 4 (bottom left)", "part 4 of 4 (bottom right)"]);
  assert.deepEqual(grid.views[0].region, { x: 0, y: 0, w: 840, h: 1232 });
  assert.deepEqual(grid.views[3].region, { x: 660, y: 968, w: 840, h: 1232 });
  assert.ok(grid.views[0].region.w > 1500 / 2 && grid.views[0].region.h > 2200 / 2, "the parts overlap");
  const pages = (await w.ok(["media", "view", "B1:1", "--half", "both", "--split", "1x2", "--json"])).json;
  assert.deepEqual(pages.views.map((v: { part: string }) => v.part), ["left page, part 1 of 2 (top)", "left page, part 2 of 2 (bottom)", "right page, part 1 of 2 (top)", "right page, part 2 of 2 (bottom)"]);
  assert.equal(pages.views[2].region.x, 1472);
  // a crop within each half, as one --half with one --crop always was
  const inHalf = (await w.ok(["media", "view", "M0001", "--half", "left", "--half", "right", "--crop", "0,0,0.5,0.5", "--json"])).json;
  assert.deepEqual(inHalf.views.map((v: { region: unknown }) => v.region), [{ x: 0, y: 0, w: 800, h: 1000 }, { x: 1600, y: 0, w: 800, h: 1000 }]);
  // mistakes are said before anything is made
  assert.match((await w.run(["media", "view", "M0001", "--split", "9x9"])).err, /invalid --split "9x9"/);
  assert.match((await w.run(["media", "view", "M0001", "--split", "1x1"])).err, /invalid --split/);
  assert.match((await w.run(["media", "view", "M0001", "--half", "middle"])).err, /invalid --half "middle"/);
  assert.match((await w.run(["media", "view", "M0001", "M0003", "--crop", "a,b"])).err, /invalid --crop/);
  assert.match((await w.run(["media", "view", "M0001", "--split", "2x2", "--crop", "100,100,400,400"])).err, /--split takes a crop in fractions/);
  w.cleanup();
});

test("media view: at most 12 images and 24 views in one call, said with the call that fits", opts, async () => {
  const w = await world();
  const before = fs.existsSync(path.join(w.cwd, ".strom", "views")) ? fs.readdirSync(path.join(w.cwd, ".strom", "views")).length : 0;
  const many = await w.run(["media", "view", "B1:1-13"]);
  assert.equal(many.code, 2);
  assert.match(many.err, /13 image\(s\) — at most 12 images and 24 views in one call: every view stays in the context that opens it/);
  assert.match(many.err, /12 image\(s\) now, the next ones in the next call: strom media view B0001:1-12/);
  const views = await w.run(["media", "view", "B1:1-7", "--split", "2x2"]);
  assert.equal(views.code, 2);
  assert.match(views.err, /7 image\(s\) × 4 views — at most 12 images and 24 views/);
  assert.match(views.err, /strom media view B0001:1-6 --split 2x2/);
  const pages = await w.run(["media", "view", "B1", "--page", "1-13", "--half", "both"]);
  assert.match(pages.err, /strom media view B0001 --page 1-12 --half both/);
  assert.match((await w.run(["media", "view", "B1:1", "--split", "5x5"])).err, /fewer parts of each image/);
  const after = fs.existsSync(path.join(w.cwd, ".strom", "views")) ? fs.readdirSync(path.join(w.cwd, ".strom", "views")).length : 0;
  assert.equal(after, before, "nothing made");
  // 12 images × 2 = 24 views: just within
  assert.equal((await w.ok(["media", "view", "B1:1-4", "--half", "left", "--half", "right", "--json"])).json.views.length, 8);
  w.cleanup();
});

test("media view: one image, one view — said as before, not as a list", opts, async () => {
  const w = await world();
  const one = await w.ok(["media", "view", "B1:3", "--crop", "0.1,0.1,0.4,0.2"]);
  const out = one.out.trim().split("\n");
  assert.match(out[0]!, /\.strom[\\/]views[\\/]M0003-[0-9a-f]{10}\.jpg$/);
  assert.match(out[1]!, /^800×587 px · part 150,220 600×440 px of 1500×2200 · 133 %$/);
  assert.match(one.out, /^the source of an entry read here: --clip M0003@0\.1,0\.1,0\.4,0\.2$/m);
  const j = (await w.ok(["media", "view", "B1:3", "--half", "left", "--json"])).json;
  assert.equal(j.views, undefined);
  assert.equal(j.image, "M0003");
  assert.deepEqual(j.region, { x: 0, y: 0, w: 750, h: 2200 });
  await w.ok(["recordset", "calibrate", "B1", "--point", "1=10", "--point", "3=12"]);
  assert.equal((await w.ok(["media", "view", "B1", "--page", "11", "--json"])).json.image, "M0002");
  assert.equal((await w.ok(["media", "view", "B1", "--image", "2", "--json"])).json.image, "M0002");
  assert.match((await w.run(["media", "view", "B1:9"])).err, /image 9 of B0001 is not registered/);
  assert.match((await w.run(["media", "view", "B1"])).err, /which image\?/);
  w.cleanup();
});

test("the method and the agents' instructions ask for the views of a scan or a batch in one call", async () => {
  const { SELF_READING, PROFILES } = await import("../../src/agents/profiles.ts");
  const reading = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "assets", "method", "reading.md"), "utf8");
  assert.doesNotMatch(reading, /paid for again on every turn/, "an image stays in the context; it is not paid for again in full");
  assert.match(reading, /stays in your context to the end of the session/);
  assert.match(reading, /\*\*The views of a scan, or of a batch, in one call\*\*/);
  assert.match(reading, /strom media view B0001:57-60 --half both/);
  assert.match(SELF_READING, /strom media view B0001:57-66 --half both` — open them together/);
  assert.match(PROFILES.claude!.instructions({}), /views of a scan \(or of a few\) in one call/);
});
