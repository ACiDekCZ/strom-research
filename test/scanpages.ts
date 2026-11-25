// Made-up scans of a register for tests of telling scans apart by their content (core/samescan.ts, core/findpart.ts):
// a page of a printed form with handwriting of its own seed, a cut-out of it made larger.

import { encodeJpeg } from "../src/image/jpeg-encode.ts";
import { decodeImage } from "../src/image/index.ts";
import { crop, resize } from "../src/image/image.ts";
import type { RawImage } from "../src/image/image.ts";
import type { Region } from "../src/core/model.ts";

/**
 * A made-up page of a register (as in test/cli/inbox-aside.test.ts): the printed form's lines and columns, then
 * handwriting (strokes) of its own seed. "float" an LCG in floating point whose streams run into each other (pages of
 * other seeds share a part of their strokes: the hardest other page), "even" one whose pages are each their own.
 */
export function page(seed: number, width = 600, height = 800, o: { strokes?: number; rng?: "float" | "even"; form?: false } = {}): RawImage {
  let s = seed;
  const r =
    o.rng === "even"
      ? () => {
          s = (s + 0x6d2b79f5) | 0;
          let t = Math.imul(s ^ (s >>> 15), 1 | s);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }
      : () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const d = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) d[y * width + x] = 225 - Math.round((x / width) * 25);
  if (o.form !== false) for (let y = 70; y < height; y += 40) for (let x = 30; x < width - 30; x++) d[y * width + x] = 60;
  if (o.form !== false) for (const x of [30, 140, 300, 470, width - 31]) for (let y = 70; y < height - 30; y++) d[y * width + x] = 60;
  for (let k = 0; k < (o.strokes ?? 500); k++) {
    let x = 40 + r() * (width - 80);
    let y = 80 + r() * (height - 120);
    const dx = (r() - 0.5) * 3;
    const dy = (r() - 0.5) * 3;
    for (let i = 0; i < 20; i++) {
      x += dx + (r() - 0.5);
      y += dy + (r() - 0.5);
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi > 0 && yi > 0 && xi < width - 1 && yi < height - 1) d[yi * width + xi] = d[yi * width + xi + 1] = 35;
    }
  }
  return { width, height, channels: 1, data: d };
}

/** A picture saved as a JPEG and read back. */
export const jpeg = (img: RawImage, quality = 80): RawImage => decodeImage(encodeJpeg(img, quality));

/** A cut-out of `img` at (x, y, w, h) in fractions of it, made `up` times larger and saved as a JPEG (unless `saved` false). */
export function zoomed(img: RawImage, at: Region, up: number, saved = true): RawImage {
  const c = crop(img, at.x * img.width, at.y * img.height, at.w * img.width, at.h * img.height);
  const big = resize(c, c.width * up, c.height * up);
  return saved ? jpeg(big) : big;
}

