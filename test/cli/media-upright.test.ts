// A photo turned by its EXIF reaches the reader upright: strom media view shows it as the photo is meant, places the
// agent names (--crop, --clip, the clip a view says) are of the picture shown; a clip is kept as the file lies — the
// data as before.
// A PDF the user gave is read page by page (I0001:2), the original kept. Made-up pictures only.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { decodeImage, encodeImage } from "../../src/image/index.ts";
import { upright, type RawImage } from "../../src/image/image.ts";
import { halves, jpegWithOrientation, makePdf } from "../image-samples.ts";

const opts = { skip: !hasGit };
const mean = (f: string) => {
  const i = decodeImage(new Uint8Array(fs.readFileSync(f)));
  return { w: i.width, h: i.height, mean: i.data.reduce((a, b) => a + b, 0) / i.data.length };
};

test("media view: a photo with EXIF orientation 6 upright — its size as shown, a crop of the picture shown, the clip of it", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Kniha oddaných 1850-1870", "--kinds", "marriage", "--places", "Horní Ves", "--years", "1850-1870"]);
  const dir = path.join(w.dir, "fotky z telefonu");
  fs.mkdirSync(dir);
  // as a phone keeps it: lying on its side (200×100, its left half dark), turned a quarter by its EXIF
  fs.writeFileSync(path.join(dir, "IMG_0001.jpg"), jpegWithOrientation(halves(200, 100), 6));
  await w.ok(["media", "add", dir, "--recordset", "B1"]);

  const whole = (await w.ok(["media", "view", "M0001", "--json"])).json;
  assert.deepEqual([whole.width, whole.height], [100, 200], "upright: higher than wide");
  assert.deepEqual(whole.original, { width: 100, height: 200 }, "the size of the picture shown");
  const top = mean(whole.view);
  assert.deepEqual([top.w, top.h], [100, 200]);

  // the top half of the upright photo is the left half of the file: dark
  const r = await w.ok(["media", "view", "M0001", "--crop", "0,0,1,0.5", "--json"]);
  const v = r.json;
  const seen = mean(v.view);
  assert.equal(seen.w, seen.h, "a square: the top half of 100×200");
  assert.ok(seen.mean < 60, `dark: ${seen.mean}`);
  assert.deepEqual(v.region, { x: 0, y: 0, w: 100, h: 100 }, "the place as asked, on the picture shown");
  assert.equal(v.clip, "M0001@0,0,1,0.5", "the clip as --clip takes it: of the picture shown");
  const bottom = mean((await w.ok(["media", "view", "M0001", "--crop", "0,0.5,1,0.5", "--json"])).json.view);
  assert.ok(bottom.mean > 200, `light: ${bottom.mean}`);
  // the text says the same clip
  assert.match((await w.ok(["media", "view", "M0001", "--crop", "0,0,1,0.5"])).out, /--clip M0001@0,0,1,0\.5/);
  // kept as the file lies: the left half of the file — what the app turns with the photo
  await w.ok(["source", "add", "Oddání 1855", "--kind", "marriage", "--recordset", "B1", "--clip", v.clip]);
  assert.deepEqual((await w.ok(["source", "show", "S1", "--json"])).json.source.clips, [{ media: "M0001", region: { x: 0, y: 0, w: 0.5, h: 1 } }]);
  w.cleanup();
});

/** A picture of w×h as it is shown: its top left quarter dark, the rest light. */
function quarter(w: number, h: number): RawImage {
  const data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.fill(x < w / 2 && y < h / 2 ? 20 : 235, (y * w + x) * 3, (y * w + x) * 3 + 3);
  return { width: w, height: h, channels: 3, data };
}

/** The mean of a part of a picture (fractions of it). */
function meanOf(img: RawImage, r: { x: number; y: number; w: number; h: number }): number {
  let sum = 0;
  let n = 0;
  for (let y = Math.round(r.y * img.height); y < Math.round((r.y + r.h) * img.height); y++)
    for (let x = Math.round(r.x * img.width); x < Math.round((r.x + r.w) * img.width); x++) {
      sum += img.data[(y * img.width + x) * img.channels]!;
      n++;
    }
  return sum / n;
}

for (const orient of [3, 6, 8])
  test(`source --clip on a photo with EXIF orientation ${orient}: the place the agent read in the upright view is the place kept (as the file lies), shown back the same`, opts, async () => {
    const w = new World();
    await w.withTree();
    await w.ok(["recordset", "add", "Kniha pokřtěných 1880-1890", "--kinds", "baptism", "--places", "Dolní Lhota", "--years", "1880-1890"]);
    // the photo as it is meant (160×240, its top left quarter dark), kept in the file as a phone lies it
    const meant = quarter(160, 240);
    const lying = upright(meant, orient === 6 ? 8 : orient === 8 ? 6 : orient);
    const file = path.join(w.dir, "Fotka křtu.jpg".normalize("NFD"));
    fs.writeFileSync(file, jpegWithOrientation(lying, orient));
    await w.ok(["media", "add", file, "--recordset", "B1", "--image", "1"]);

    // the agent reads the top left quarter of the upright view: dark
    const v = (await w.ok(["media", "view", "B1:1", "--crop", "0,0,0.5,0.5", "--json"])).json;
    assert.ok(mean(v.view).mean < 60, `the view is dark: ${mean(v.view).mean}`);
    assert.equal(v.clip, "M0001@0,0,0.5,0.5", "the clip as the agent read it");
    assert.match((await w.ok(["media", "view", "B1:1", "--crop", "0,0,0.5,0.5"])).out, /--clip M0001@0,0,0\.5,0\.5/, "one view says its clip too");

    // the clip the view said, the crop the agent gave by the image's number, its pixels: the same place
    await w.ok(["source", "add", "Křest 1885", "--kind", "baptism", "--recordset", "B1", "--clip", v.clip]);
    await w.ok(["source", "add", "Křest 1886", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:1@0,0,0.5,0.5"]);
    await w.ok(["source", "add", "Křest 1887", "--kind", "baptism", "--recordset", "B1", "--clip", "M0001@0,0,80,120"]);
    const inFile = decodeImage(new Uint8Array(fs.readFileSync(file)));
    for (const id of ["S1", "S2", "S3"]) {
      const s = (await w.ok(["source", "show", id, "--json"])).json.source;
      const region = s.clips[0].region;
      assert.ok(meanOf(inFile, region) < 60, `${id}: kept where the file is dark (${JSON.stringify(region)})`);
      assert.match((await w.ok(["source", "show", id])).out, /clips {2}1\. M0001@0,0,0\.5,0\.5/, `${id}: shown back as --clip takes it`);
    }

    // a split of the upright view: its top left part is dark
    const split = (await w.ok(["media", "view", "M0001", "--split", "2x2", "--json"])).json;
    const views = split.views ?? split.images?.[0]?.views;
    assert.ok(views?.length === 4, JSON.stringify(Object.keys(split)));
    assert.ok(mean(views[0].view).mean < 80, `part 1 (top left) dark: ${mean(views[0].view).mean}`);
    assert.ok(mean(views[3].view).mean > 180, `part 4 (bottom right) light: ${mean(views[3].view).mean}`);
    w.cleanup();
  });

test("media view: a PDF the user gave page by page (I0001:2) — a page of scans read without programs, past its end said; the original kept", opts, async () => {
  const w = new World();
  await w.withTree();
  const pdf = path.join(w.dir, "Dopis z fary – Šťastná.pdf".normalize("NFD"));
  const page = (grey: number, width: number, height: number) => ({ bytes: encodeImage({ width, height, channels: 3, data: new Uint8Array(width * height * 3).fill(grey) }, "jpeg", 92), width, height });
  fs.writeFileSync(pdf, makePdf([{ jpeg: page(40, 300, 400) }, { jpeg: page(220, 400, 300), rotate: 90 }]));
  await w.ok(["intake", pdf]);
  const kept = path.join(w.cwd, "inputs");
  const file = fs.readdirSync(kept, { recursive: true }).map(String).find((f) => f.endsWith(".pdf"))!;
  const before = crypto.createHash("sha256").update(fs.readFileSync(path.join(kept, file))).digest("hex");

  const env = { STROM_NO_CONVERT: "1" };
  const p2 = (await w.ok(["media", "view", "I0001:2", "--json"], { env })).json;
  const two = mean(p2.view);
  assert.ok(two.h > two.w, "turned upright as the PDF shows it");
  assert.ok(two.mean > 180, "the second page");
  const one = mean((await w.ok(["media", "view", "I0001", "--json"], { env })).json.view);
  assert.ok(one.mean < 80, "the first page");
  const past = await w.run(["media", "view", "I0001:3"], { env: { ...env, CLAUDECODE: "1" } });
  assert.notEqual(past.code, 0);
  assert.match(past.err, /has 2 pages, no page 3/);
  assert.match((await w.run(["media", "view", "I0001:3"], { env })).err, /má 2 strany, strana 3 v něm není\n→ strana od 1 do 2/);
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(kept, file))).digest("hex"), before);

  // a PDF of text with nothing here to draw it: one sentence, in English for an agent, the person's language for a person
  const text = path.join(w.dir, "Матрика.pdf");
  fs.writeFileSync(text, makePdf([{}]));
  await w.ok(["intake", text]);
  const agent = await w.run(["media", "view", "I0002"], { env: { ...env, CLAUDECODE: "1" } });
  assert.match(agent.err, /cannot be turned into pictures for reading on this computer — the original stays as it is/);
  const person = await w.run(["media", "view", "I0002"], { env: { ...env, STROM_LANG: "cs" } });
  assert.match(person.err, /toto PDF nejde na tomto počítači převést na obrázky pro čtení – originál zůstává beze změny/);

  // a document that is no picture, asked without a page: said as with a page, in the person's language
  const note = path.join(w.dir, "Poznámka ze hřbitova.txt".normalize("NFD"));
  fs.writeFileSync(note, "Hrob č. 12, nápis nečitelný.\n");
  await w.ok(["intake", note]);
  const noImage = await w.run(["media", "view", "I0003"], { env: { ...env, STROM_LANG: "cs" } });
  assert.notEqual(noImage.code, 0);
  assert.doesNotMatch(noImage.err, /JPEG or PNG\)/);
  assert.match(noImage.err, /není obrázek/);
  const toAgent = await w.run(["media", "view", "I0003", "--json"], { env: { ...env, CLAUDECODE: "1" } });
  assert.match(toAgent.err + toAgent.out, /read\.type/);
  assert.match(toAgent.err + toAgent.out, /no picture a reader reads \(JPEG, PNG, HEIC or PDF/);
  w.cleanup();
});
