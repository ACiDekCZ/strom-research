// A zoomed-in part of a scan told by its content (141): a cut-out of a page made larger and saved again is found in the
// page, where it lies; a cut-out of another page of the same printed form, a copy of the whole page and a blank piece
// are never taken for a part of it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findPart, matchPart, partOf, PART_LIKENESS, PART_MISSING } from "../../src/core/findpart.ts";
import { decodeImage, encodeImage } from "../../src/image/index.ts";
import { crop, resize } from "../../src/image/image.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { jpeg, page, zoomed } from "../scanpages.ts";
import type { RawImage } from "../../src/image/image.ts";
import type { Region } from "../../src/core/model.ts";

function near(found: Region | undefined, truth: Region, what: string): void {
  assert.ok(found, `${what}: not found`);
  for (const k of ["x", "y", "w", "h"] as const) assert.ok(Math.abs(found[k] - truth[k]) <= 0.03, `${what}: ${k} ${found[k].toFixed(3)}, truly ${truth[k].toFixed(3)}`);
}

test("141: a cut-out of a page (30, 50, 70 % of its width, anywhere on it) made larger and saved again is found where it lies", () => {
  for (const rng of ["float", "even"] as const) {
    const whole = jpeg(page(1, 600, 800, { rng }), 85);
    const cuts: [Region, number][] = [
      [{ x: 0.1, y: 0.15, w: 0.3, h: 0.25 }, 3],
      [{ x: 0.62, y: 0.7, w: 0.3, h: 0.15 }, 2],
      [{ x: 0.25, y: 0.4, w: 0.5, h: 0.45 }, 1.5],
      [{ x: 0.5, y: 0.05, w: 0.5, h: 0.3 }, 2.5],
      [{ x: 0, y: 0.3, w: 0.7, h: 0.7 }, 1.5],
      [{ x: 0.2, y: 0.1, w: 0.7, h: 0.5 }, 2],
    ];
    for (const [at, up] of cuts) {
      const part = zoomed(page(1, 600, 800, { rng }), at, up);
      near(findPart(part, whole), at, `${rng} ${JSON.stringify(at)} ×${up}`);
    }
  }
  // the page itself only a reduced copy (as downloaded first), the part from the full scan: found as well
  const small = jpeg(resize(page(3), 300, 400), 60);
  const at = { x: 0.3, y: 0.5, w: 0.4, h: 0.3 };
  near(findPart(zoomed(page(3), at, 2), small), at, "in a reduced copy");
});

test("141: a cut-out of another page of the same form (the same printed rules, other handwriting) is never a part of it", () => {
  const wholes = { float: jpeg(page(1, 600, 800), 85), even: jpeg(page(1, 600, 800, { rng: "even" }), 85) };
  let likest = -1;
  let alikeMissing = 1;
  for (let seed = 2; seed < 52; seed++) {
    const rng = seed % 2 ? "even" : "float";
    const w = [0.3, 0.5, 0.7, 0.4][seed % 4]!;
    const h = Math.min(0.9, w * [0.6, 1, 1.2][seed % 3]!);
    const at = { x: ((seed * 37) % 100) / 100 * (1 - w), y: ((seed * 53) % 100) / 100 * (1 - h), w, h };
    const part = zoomed(page(seed, 600, 800, { rng }), at, [1.5, 2][seed % 2]!, seed % 4 === 0);
    // findPart's own measure, once (findPart itself for a few)
    const m = matchPart(part, wholes[rng]);
    assert.ok(!m || m.alike < PART_LIKENESS || m.missing > PART_MISSING, `seed ${seed} (${rng}): ${JSON.stringify(m)}`);
    if (seed < 6) assert.equal(findPart(part, wholes[rng]), undefined);
    if (m) {
      likest = Math.max(likest, m.alike);
      if (m.alike >= PART_LIKENESS) alikeMissing = Math.min(alikeMissing, m.missing);
    }
  }
  // told by the likeness alone (another page sharing some strokes would be told by what is missing)
  assert.ok(likest < PART_LIKENESS, `the likest other page ${likest.toFixed(3)}`);
  assert.ok(alikeMissing > PART_MISSING);
});

test("141: a copy of the whole page (reduced, cut a little) is not a part — samescan's to tell; a blank piece of the page cannot be told", () => {
  const whole = jpeg(page(1), 85);
  assert.equal(findPart(jpeg(resize(page(1), 300, 400), 60), whole), undefined, "a reduced copy");
  assert.equal(findPart(jpeg(crop(page(1), 0, 24, 600, 776)), whole), undefined, "cut a little at the top");
  // the form with nothing written on it: its rules taken away, nothing to tell by
  const form = page(1, 600, 800, { strokes: 0 });
  assert.equal(findPart(zoomed(form, { x: 0.2, y: 0.3, w: 0.4, h: 0.3 }, 2), whole), undefined, "a blank piece of the form");
  assert.equal(findPart(zoomed(page(1, 600, 800, { strokes: 0, form: false }), { x: 0.2, y: 0.3, w: 0.4, h: 0.3 }, 2), whole), undefined, "blank paper");
  // a part of a page with nothing written on the page searched in
  assert.equal(findPart(zoomed(page(1), { x: 0.2, y: 0.3, w: 0.4, h: 0.3 }, 2), jpeg(form)), undefined, "the whole blank");
});

test("141: partOf reads the files (JPEG, PNG) — a part saved beside its page is found, another page not; a file strom does not read cannot be told", () => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "findpart-"));
  try {
    const f = (n: string) => path.join(dir, n);
    // the page as a large scan, the part cut out of it at its full size, saved under names in another script
    const big = resize(page(4, 600, 800, { rng: "even" }), 1800, 2400);
    fs.writeFileSync(f("9.jpg"), encodeJpeg(big, 85));
    const at = { x: 0.15, y: 0.55, w: 0.5, h: 0.25 };
    fs.writeFileSync(f("9a – výřez.jpg".normalize("NFD")), encodeJpeg(crop(big, at.x * 1800, at.y * 2400, at.w * 1800, at.h * 2400), 85));
    fs.writeFileSync(f("страница 10.jpg"), encodeJpeg(crop(resize(page(5, 600, 800, { rng: "even" }), 1800, 2400), at.x * 1800, at.y * 2400, at.w * 1800, at.h * 2400), 85));
    fs.writeFileSync(f("9.gif"), new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0]));
    // a screenshot of the part (a PNG), made smaller than the scan's own pixels
    const shot = { x: 0.5, y: 0.1, w: 0.35, h: 0.3 };
    fs.writeFileSync(f("9b.png"), encodeImage(resize(crop(big, shot.x * 1800, shot.y * 2400, shot.w * 1800, shot.h * 2400), 420, 480), "png"));
    near(partOf(f("9a – výřez.jpg".normalize("NFD")), f("9.jpg")), at, "9a beside 9");
    near(partOf(f("9b.png"), f("9.jpg")), shot, "a screenshot");
    assert.equal(partOf(f("страница 10.jpg"), f("9.jpg")), undefined);
    assert.equal(partOf(f("9.jpg"), f("9.jpg")), undefined, "the page itself is no part of it");
    assert.equal(partOf(f("9.gif"), f("9.jpg")), undefined);
    assert.equal(partOf(f("9a – výřez.jpg".normalize("NFD")), f("9.gif")), undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
