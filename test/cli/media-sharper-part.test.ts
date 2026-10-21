// A part of an image fetched sharper, beside its whole image reduced: a view of a place it holds is made from it — also
// a crop drawn a little past it (cut to it, the strip left out said with the view of it) —, and one it shows only some of
// is said with the view of that place; strom read reads a crop from it as well. Without such a part: as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";

const opts = { skip: !hasGit };

/** Images 1–2 of B0001, 1708×1331 (a scan reduced); of image 1 the part 0.03,0.46,0.47,0.27 at 2000×895 (M0003, 2.5×). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Kniha oddaných 1801–1830", "--kinds", "marriage"]);
  const dir = path.join(w.dir, "skeny");
  fs.mkdirSync(dir);
  const img = (name: string, width: number, height: number, grey: number) =>
    fs.writeFileSync(path.join(dir, name), encodeImage({ width, height, channels: 3, data: new Uint8Array(width * height * 3).fill(grey) }, "jpeg"));
  img("s0001.jpg", 1708, 1331, 200);
  img("s0002.jpg", 1708, 1331, 180);
  await w.ok(["media", "add", dir, "--recordset", "B1"]);
  const part = path.join(w.dir, "výřez ř.jpg");
  fs.writeFileSync(part, encodeImage({ width: 2000, height: 895, channels: 3, data: new Uint8Array(2000 * 895 * 3).fill(120) }, "jpeg"));
  await w.ok(["media", "add", part, "--recordset", "B1", "--image", "1", "--crop", "0.03,0.46,0.47,0.27"]);
  return w;
}

test("media view: a sharper part that holds the place, or nearly all of it, is read from; one that shows some of it is said", opts, async () => {
  const w = await world();
  try {
    const view = async (...a: string[]) => (await w.ok(["media", "view", ...a, "--json"])).json;
    // the place inside the part: from it, nothing cut
    const inside = await view("B1:1", "--crop", "0.05,0.5,0.2,0.2");
    assert.equal(inside.from, "M0003");
    assert.equal(inside.cut, undefined);
    // a crop drawn a hundredth past the part (as a run drew it): from the part, cut to it; the strip left out said
    const past = await view("B1:1", "--crop", "0.03,0.45,0.24,0.28");
    assert.equal(past.from, "M0003", "not the whole image reduced");
    // the places in --json to a thousandth, as the text says them
    assert.deepEqual(past.cut, { x: 0.03, y: 0.46, w: 0.24, h: 0.27 });
    assert.deepEqual(past.left, [{ x: 0.03, y: 0.45, w: 0.24, h: 0.01 }]);
    const text = (await w.ok(["media", "view", "B1:1", "--crop", "0.03,0.45,0.24,0.28"])).out;
    assert.match(text, /from M0003, a part of the image fetched sharper \(2\.5× the detail of the whole image\), cut to it: 0\.03,0\.46,0\.24,0\.27 of the place asked — the rest \(the whole image, less sharp\): strom media view B0001:1 --crop 0\.03,0\.45,0\.24,0\.01$/m);
    // the strip itself: from the whole image, nothing of the part said
    const strip = await view("B1:1", "--crop", "0.03,0.45,0.24,0.01");
    assert.equal(strip.from, undefined);
    assert.equal(strip.sharper, undefined);
    // a half the part lies in: the view from the whole image, the part said with the view of its place
    const half = await w.ok(["media", "view", "B1:1", "--half", "left"]);
    assert.match(half.out, /^M0003, a part of the image fetched sharper \(2\.5× the detail\), shows 0\.03,0\.46,0\.47,0\.27 of this place, not all of it — this view is from the whole image; that place sharper: strom media view B0001:1 --crop 0\.03,0\.46,0\.47,0\.27$/m);
    const halfJson = await view("B1:1", "--half", "left");
    assert.equal(halfJson.from, undefined);
    assert.deepEqual(halfJson.sharper.part, "M0003");
    assert.deepEqual(halfJson.sharper.shows, { x: 0.03, y: 0.46, w: 0.47, h: 0.27 });
    // several views: each said under its own
    const several = (await w.ok(["media", "view", "B1:1", "--crop", "0.03,0.45,0.24,0.28", "B1:2", "--crop", "0.03,0.45,0.24,0.28"])).out;
    assert.match(several, /^ {2}from M0003, a part of the image fetched sharper \(2\.5× the detail of the whole image\), cut to it: /m);
    assert.equal(several.match(/cut to it/g)!.length, 1, "image 2 has no part");
    // elsewhere on the image, and an image with no part: as before
    for (const [ref, crop] of [["B1:1", "0.6,0.1,0.3,0.3"], ["B1:2", "0.03,0.45,0.24,0.28"]] as const) {
      const r = await view(ref, "--crop", crop);
      assert.equal(r.from, undefined, `${ref} ${crop}`);
      assert.equal(r.sharper, undefined);
      assert.doesNotMatch((await w.ok(["media", "view", ref, "--crop", crop])).out, /fetched sharper/);
    }
  } finally {
    w.cleanup();
  }
});

test("strom read --crop: a reader reads the place from the sharper part that holds nearly all of it; a whole image without one as before", opts, async () => {
  const w = await world();
  try {
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "reader.mjs");
    // the reader says the images it was given (and so which copy each view is of)
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, 'const p = process.env.STROM_PROMPT ?? "";\nfor (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\n');
    const read = await w.ok(["read", "B1:1", "--crop", "0.03,0.45,0.24,0.28", "--question", "Sňatek Nováka", "--agent", "script"]);
    assert.match(read.out, /^B0001:1: read from M0003, a part of the image fetched sharper \(2\.5× the detail\), cut to it: 0\.03,0\.46,0\.24,0\.27 of the crop — the rest \(the whole image, less sharp\): strom media view B0001:1 --crop 0\.03,0\.45,0\.24,0\.01$/m);
    assert.match(read.out, /M0003/);
    const plain = await w.ok(["read", "B1:2", "--crop", "0.03,0.45,0.24,0.28", "--question", "Sňatek Nováka", "--agent", "script"]);
    assert.doesNotMatch(plain.out, /fetched sharper/);
    assert.doesNotMatch(plain.out, /M0003/);
  } finally {
    w.cleanup();
  }
});
