// The image codecs and operations, against pixels decoded by libjpeg/libpng
// (PIL) for the same synthetic files — no real scans in the tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { decodeJpeg } from "../../src/image/jpeg-decode.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { decodePng, encodePng } from "../../src/image/png.ts";
import { crop, grid, resize, rotate, stretch, toGrey, type RawImage } from "../../src/image/image.ts";
import { decodeImage, formatOf, imageSize, imageSizeOfFile } from "../../src/image/index.ts";
import os from "node:os";

const dir = path.join(import.meta.dirname, "..", "fixtures", "images");
const read = (f: string) => new Uint8Array(fs.readFileSync(path.join(dir, f)));

function maxDiff(a: Uint8Array, b: Uint8Array): number {
  assert.equal(a.length, b.length, "sizes differ");
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
  return m;
}

test("JPEG: baseline, progressive, grey, 4:2:0 and 4:4:4, restart markers, CMYK — as libjpeg decodes them", () => {
  for (const name of ["base420", "base444", "grey", "prog420", "proggrey", "restart", "cmyk"]) {
    const img = decodeJpeg(read(`${name}.jpg`));
    const d = maxDiff(img.data, read(`${name}.rgb`));
    assert.ok(d <= 4, `${name}: off by ${d}`);
  }
});

test("JPEG encoder: our files decode back close to the original, and the header says the size", () => {
  const img = decodeJpeg(read("base444.jpg"));
  const bytes = encodeJpeg(img, 92);
  assert.equal(formatOf(bytes), "jpeg");
  assert.deepEqual(imageSize(bytes), { width: 64, height: 48 });
  const back = decodeJpeg(bytes);
  let sum = 0;
  for (let i = 0; i < img.data.length; i++) sum += Math.abs(img.data[i]! - back.data[i]!);
  assert.ok(sum / img.data.length < 4, `mean error ${sum / img.data.length}`);
  const grey = encodeJpeg(toGrey(img), 85);
  assert.equal(decodeJpeg(grey).channels, 1);
});

test("PNG: every colour type, interlaced too; encoder is lossless", () => {
  for (const [file, ref] of [
    ["png-rgb.png", "png-rgb.rgb"],
    ["png-rgb-interlaced.png", "png-rgb.rgb"],
    ["png-rgba.png", "png-rgba.rgb"],
    ["png-pal.png", "png-pal.rgb"],
    ["png-pal-interlaced.png", "png-pal.rgb"],
    ["png-bw.png", "png-bw.rgb"],
    ["png-grey.png", "png-grey.rgb"],
  ] as const) {
    const img = decodePng(read(file));
    assert.equal(maxDiff(img.data, read(ref)), 0, file);
  }
  const img = decodePng(read("png-rgb.png"));
  assert.equal(maxDiff(decodePng(encodePng(img)).data, img.data), 0);
  assert.deepEqual(imageSize(encodePng(img)), { width: 29, height: 23 });
});

test("formats strom cannot crop say so", () => {
  assert.throws(() => decodeImage(new Uint8Array([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0])), /TIFF cannot be cropped by strom yet/);
  assert.throws(() => decodeImage(new Uint8Array([1, 2, 3, 4])), /not an image strom can read/);
});

test("operations: crop, resize (area average down, bilinear up), contrast, rotate, grid", () => {
  const img: RawImage = { width: 4, height: 2, channels: 1, data: new Uint8Array([0, 100, 200, 250, 10, 110, 210, 240]) };
  const c = crop(img, 1, 0, 2, 2);
  assert.deepEqual([...c.data], [100, 200, 110, 210]);
  const half = resize(img, 2, 1);
  assert.deepEqual([...half.data], [55, 225]); // means of 2×2 areas
  assert.equal(resize(img, 8, 4).width, 8);
  const s = stretch({ width: 3, height: 1, channels: 1, data: new Uint8Array([100, 120, 140]) }, 0, 100);
  assert.deepEqual([...s.data], [0, 128, 255]);
  const r = rotate(img, 90);
  assert.deepEqual([r.width, r.height, r.data[0], r.data[1]], [2, 4, 10, 0]);
  const g = grid({ width: 200, height: 100, channels: 3, data: new Uint8Array(200 * 100 * 3).fill(255) });
  assert.ok(g.data.some((v, i) => i % 3 === 1 && v === 0), "red lines drawn");
});

test("a region too big for one look is read in overlapping parts at full resolution", async () => {
  const { tiles } = await import("../../src/core/views.ts");
  const { readerPrompt } = await import("../../src/core/reader.ts");
  const four = tiles({ x: 3132, y: 2181, w: 2881, h: 2181 }, 1568);
  assert.deepEqual(four.map((t) => t.crop), ["3132,2181,1568,1568", "4445,2181,1568,1568", "3132,2794,1568,1568", "4445,2794,1568,1568"]);
  assert.equal(four[3]!.label, "part 4 of 4 (bottom right)");
  assert.deepEqual(tiles({ x: 0, y: 0, w: 900, h: 300 }, 1568).map((t) => t.crop), ["0,0,900,300"], "one look when it fits");
  // every part of the region lies inside it and together they cover it
  for (const t of four) {
    const [x, y, w, h] = t.crop.split(",").map(Number);
    assert.ok(x! >= 3132 && y! >= 2181 && x! + w! <= 3132 + 2881 && y! + h! <= 2181 + 2181);
  }
  const prompt = readerPrompt({ question: "q", report: "/r.md", lang: "cs", images: [{ id: "M0021", image: 27, view: "/v1.jpg", parts: four.map((t, i) => ({ label: t.label, view: `/v${i + 1}.jpg` })) }] });
  assert.match(prompt, /- M0021 · image 27 — 4 overlapping parts at full resolution, read them together:\n    part 1 of 4 \(top left\): \/v1\.jpg/);
});

test("a double page is read in two overlapping halves only where they show it at least 1.25× sharper", async () => {
  const { halves, readInHalves, SPREAD_GAIN, VIEW_MAX } = await import("../../src/core/views.ts");
  assert.equal(SPREAD_GAIN, 1.25);
  // halves overlap by 4 % of the width past the middle: an off-centre gutter stays whole in one of them
  assert.deepEqual(halves(6000, 4500), { left: { x: 0, y: 0, w: 3240, h: 4500 }, right: { x: 2760, y: 0, w: 3240, h: 4500 } });
  // a spread of a register (4:3): each page 1.33× sharper at the same long side — pixels per page: 784×1176 → 1045×1568
  assert.ok(readInHalves(6000, 4500));
  assert.ok(readInHalves(6000, 4500, 2000), "the same at a larger limit");
  const whole = VIEW_MAX / 6000;
  const half = VIEW_MAX / 4500;
  assert.ok(half / whole > 1.3 && Math.round(3240 * half) <= VIEW_MAX);
  assert.ok(readInHalves(5798, 4453, 2000), "1.30×");
  assert.ok(!readInHalves(5503, 4453, 2000), "1.24×: two views for too little");
  assert.ok(readInHalves(7400, 3000), "a spread of wide pages");
  assert.ok(!readInHalves(2343, 3300), "a single page: taller than wide");
  assert.ok(!readInHalves(3205, 3200), "a near-square spread: its halves are no sharper at the same long side");
  assert.ok(!readInHalves(1508, 1189), "a scan smaller than one view: already at its own pixels");
  assert.ok(readInHalves(1508, 1189, 800), "unless the views are smaller");
});

test("a view as big as the agent's model takes it in whole: 2000 px for the newer models, else 1568", async () => {
  const { imageMax, claudeModel } = await import("../../src/agents/images.ts");
  // Claude Code: Opus 4.7+, Sonnet 5+, Fable, Mythos — by name, alias, or the agent's own default
  for (const m of [undefined, "", "default", "opus", "opus[1m]", "sonnet", "fable", "claude-opus-4-7", "claude-opus-4-8", "claude-opus-5-5", "claude-opus-5-5[1m]", "claude-sonnet-5", "claude-sonnet-5-5", "claude-fable-1", "us.anthropic.claude-opus-4-7-v1:0", "anthropic/claude-sonnet-5-5"])
    assert.equal(imageMax("claude", m), 2000, String(m));
  for (const m of ["claude-opus-4-6", "claude-opus-4-1-20250805", "claude-opus-4-20250514", "claude-sonnet-4-6", "claude-sonnet-4-5", "claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "haiku", "claude-haiku-4-5", "claude-haiku-5-5", "some-other-model"])
    assert.equal(imageMax("claude", m), 1568, m);
  assert.deepEqual(claudeModel("claude-opus-4-20250514"), { family: "opus", version: 4 }, "a date is no minor version");
  assert.deepEqual(claudeModel("claude-3-5-sonnet-20241022"), { family: "sonnet", version: 3.5 });
  assert.equal(claudeModel("gpt-5"), undefined);
  // Codex and OpenCode pass 2000 px on; Grok, Antigravity and any other agent: 1568
  for (const m of [undefined, "gpt-5.5", "anthropic/claude-sonnet-4-6"]) {
    assert.equal(imageMax("codex", m), 2000);
    assert.equal(imageMax("opencode", m), 2000);
  }
  for (const a of ["grok", "antigravity", "script", "cursor", undefined]) assert.equal(imageMax(a, "opus"), 1568, String(a));
});

test("the size of an image file, whatever metadata comes before its frame (found in an archive of scans)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "strom velikost "));
  const jpeg = fs.readFileSync(path.join(dir, "s0001.jpg"));
  // 600 kB of an APP1 segment (EXIF, a thumbnail) between the start and the frame, in segments of 64 kB
  const app = Buffer.concat(Array.from({ length: 10 }, () => Buffer.concat([Buffer.from([0xff, 0xe1, 0xff, 0xff]), Buffer.alloc(0xfffd, 0x20)])));
  const big = Buffer.concat([jpeg.subarray(0, 2), app, jpeg.subarray(2)]);
  const file = path.join(tmp, "sken s0178.jpg");
  fs.writeFileSync(file, big);
  assert.equal(imageSize(big.subarray(0, 512 * 1024)), undefined, "not in the first 512 kB");
  assert.deepEqual(imageSizeOfFile(file), { width: 400, height: 300 });
  fs.writeFileSync(path.join(tmp, "x.png"), encodePng({ width: 7, height: 5, channels: 1, data: new Uint8Array(35) }));
  assert.deepEqual(imageSizeOfFile(path.join(tmp, "x.png")), { width: 7, height: 5 });
  fs.writeFileSync(path.join(tmp, "not.jpg"), "<html>");
  assert.equal(imageSizeOfFile(path.join(tmp, "not.jpg")), undefined);
  assert.equal(imageSizeOfFile(path.join(tmp, "missing.jpg")), undefined);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("a picture as it is shown: each EXIF orientation turned and mirrored as a viewer does", async () => {
  const { upright } = await import("../../src/image/image.ts");
  // 3 wide, 2 high, grey: a b c / d e f
  const img = { width: 3, height: 2, channels: 1 as const, data: Uint8Array.from([1, 2, 3, 4, 5, 6]) };
  const shown = (o: number) => {
    const r = upright(img, o);
    return [r.width, r.height, [...r.data].join("")];
  };
  assert.deepEqual(shown(1), [3, 2, "123456"]);
  assert.deepEqual(shown(2), [3, 2, "321654"], "mirrored");
  assert.deepEqual(shown(3), [3, 2, "654321"], "upside down");
  assert.deepEqual(shown(4), [3, 2, "456123"], "mirrored top to bottom");
  assert.deepEqual(shown(5), [2, 3, "142536"], "transposed");
  assert.deepEqual(shown(6), [2, 3, "415263"], "a quarter clockwise");
  assert.deepEqual(shown(7), [2, 3, "635241"], "transversed");
  assert.deepEqual(shown(8), [2, 3, "362514"], "a quarter anticlockwise");
  assert.equal(upright(img, undefined), img);
});
