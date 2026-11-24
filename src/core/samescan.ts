// Whether two files are the same scan (B0374): a sharper copy of an image saved by hand (a reduced download, then the
// full one) shows the same page; another scan saved under a number already taken (page 203 saved as 3.jpg) does not —
// it is never taken as a sharper copy of the image, unsaid (commands/media.ts takeFiles sets it aside and asks).
//
// "same" only when it is sure: what tells two pages of one printed form apart is the handwriting, not the form — the
// printed rules are taken away (what runs on along a row or a column), the light of the page too, and only the writing
// that is left is compared. The two pictures are first put over each other (a copy cut a little otherwise is moved and
// made a little larger: found on the writing made small), then compared part by part at a finer size; the same scan made
// smaller, saved again or cut a little is alike in each part, another page of the same form is not alike in most. When
// not sure — or nothing written to compare — it is not "same": set aside and asked, never taken.

import fs from "node:fs";
import type { RawImage } from "../image/image.ts";
import { resize, toGrey, upright } from "../image/image.ts";
import { decodeImage, exifOrientationOf, formatOf, imageSize, imageSizeOfFile, exifOrientation } from "../image/index.ts";

/**
 * Shapes that differ by more than this (of the width to the height) are two pictures. A copy cut a little on one side
 * only (up to 5 % of it) still has its writing compared — that is what tells another page of the same form apart.
 */
export const SHAPE_TOLERANCE = 0.06;

/**
 * Of the writing compared part by part: alike at least this much (a correlation, 1 = the same) in three parts of four
 * (the lower quartile of the parts with writing) is the same scan. A copy is 0.7–0.97 (cut a little: the lower end);
 * another page of the form ≤ 0.2 — one sharing most of its strokes more, told by SAME_SCAN_MISSING.
 */
export const SAME_SCAN_LIKENESS = 0.6;

/** The width the pictures are put over each other at, and the width they are compared at. */
const COARSE = 48;
const FINE = 160;

/** How far a copy may be cut otherwise: moved by up to this of the width, made larger or smaller by up to SCALE. */
const MOVE = 0.08;
const SCALE = 0.08;

/** The parts compared (a grid of TILES × TILES); at least MIN_PARTS of them with writing, else nothing to tell by. */
const TILES = 5;
const MIN_PARTS = 3;

/**
 * And of the strong writing of either, at most this share with nothing of it near it in the other: a copy loses none of
 * what is written strongly; a page with other writing (or only some of it the same) has it missing.
 */
export const SAME_SCAN_MISSING = 0.03;

/** Strong writing: at least this of the darkest strokes of a picture (its 99.9th percentile). */
const STRONG = 0.4;

/** How far (pixels of FINE) a part may still be moved against the other once the pictures are over each other. */
const SHIFT = 3;

/** The shape of a file's picture as shown (width / height, its EXIF turn), or undefined. */
function shapeOf(file: string): number | undefined {
  const size = imageSizeOfFile(file);
  if (!size || !size.width || !size.height) return undefined;
  const o = exifOrientation(file);
  const across = o !== undefined && o >= 5 && o <= 8;
  return across ? size.height / size.width : size.width / size.height;
}

/**
 * A JPEG is decoded made smaller (1/2, 1/4, 1/8: the mean of each part of a block, jpeg-decode.ts) as long as it stays
 * at least this wide and high: the writing is compared at FINE, a large scan (6000 px) is never decoded whole for it.
 */
const DECODED_AT_LEAST = 2 * FINE;

/** How much smaller a JPEG of this size is decoded (DECODED_AT_LEAST). */
export function reduceFor(size: { width: number; height: number } | undefined): 1 | 2 | 4 | 8 {
  if (!size) return 1;
  const least = Math.min(size.width, size.height);
  for (const r of [8, 4, 2] as const) if (least / r >= DECODED_AT_LEAST) return r;
  return 1;
}

/** The picture of a file as shown, grey — only of a JPEG or a PNG (what strom reads itself); a large JPEG made smaller. */
export function pictureOf(file: string): RawImage | undefined {
  const bytes = new Uint8Array(fs.readFileSync(file));
  const f = formatOf(bytes);
  if (f !== "jpeg" && f !== "png") return undefined;
  try {
    return toGrey(upright(decodeImage(bytes, f === "jpeg" ? { reduce: reduceFor(imageSize(bytes)) } : {}), exifOrientationOf(bytes)));
  } catch {
    return undefined;
  }
}

/**
 * The median of each window of 2L + 1 of n values (`src` from `start`, every `stride`; at the ends the window is cut),
 * less from the value itself, into `out` (the same places): a window kept sorted as it moves along.
 */
function lessMedian(src: Float64Array, out: Float64Array, start: number, stride: number, n: number, L: number, win: Float64Array): void {
  let c = 0;
  const add = (v: number) => {
    let lo = 0;
    let hi = c;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (win[mid]! < v) lo = mid + 1;
      else hi = mid;
    }
    win.copyWithin(lo + 1, lo, c);
    win[lo] = v;
    c++;
  };
  const drop = (v: number) => {
    let lo = 0;
    let hi = c;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (win[mid]! < v) lo = mid + 1;
      else hi = mid;
    }
    win.copyWithin(lo, lo + 1, c);
    c--;
  };
  for (let i = 0; i <= Math.min(n - 1, L); i++) add(src[start + i * stride]!);
  for (let i = 0; i < n; i++) {
    out[start + i * stride] = src[start + i * stride]! - win[c >> 1]!;
    if (i + 1 + L < n) add(src[start + (i + 1 + L) * stride]!);
    if (i - L >= 0) drop(src[start + (i - L) * stride]!);
  }
}

/**
 * The writing of a picture made small (w × h, grey): the ink (the light of the page around taken away), less what runs on
 * along its row and then along its column (the printed rules and columns of a form: the median of the row or the column
 * around). Handwriting — short strokes — is what stays.
 *
 * How near "around" is follows the width of the page at this size: `across`, by default the picture's own width. A part
 * of a page (findpart.ts) passes the width the whole page has at the same size, so both are filtered alike.
 */
export function writingOf(small: RawImage, across = small.width): Float64Array {
  const { width: w, height: h } = small;
  const v = small.data;
  const r = Math.max(2, Math.round(across / 40));
  const sum = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += v[y * w + x]!;
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1]! + row;
    }
  }
  const ink = new Float64Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h, y + r + 1);
      const s = sum[y1 * (w + 1) + x1]! - sum[y0 * (w + 1) + x1]! - sum[y1 * (w + 1) + x0]! + sum[y0 * (w + 1) + x0]!;
      ink[y * w + x] = s / ((x1 - x0) * (y1 - y0)) - v[y * w + x]!;
    }
  const L = Math.max(4, Math.round(across / 10));
  const win = new Float64Array(2 * L + 2);
  const rows = new Float64Array(w * h);
  for (let y = 0; y < h; y++) lessMedian(ink, rows, y * w, 1, w, L, win);
  const out = new Float64Array(w * h);
  for (let x = 0; x < w; x++) lessMedian(rows, out, x, w, h, L, win);
  return out;
}

/** Map `m` (w × h) as seen moved by (ox, oy) and made larger by 1/k around its middle; NaN where it does not reach. */
function warp(m: Float64Array, w: number, h: number, k: number, ox: number, oy: number): Float64Array {
  const out = new Float64Array(w * h);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let j = 0; j < h; j++) {
    const fy = k * (j - cy) + cy + oy;
    const y0 = Math.min(Math.floor(fy), h - 2);
    const ty = fy - y0;
    for (let i = 0; i < w; i++) {
      const fx = k * (i - cx) + cx + ox;
      if (fx < 0 || fy < 0 || fx > w - 1 || fy > h - 1) {
        out[j * w + i] = NaN;
        continue;
      }
      const x0 = Math.min(Math.floor(fx), w - 2);
      const tx = fx - x0;
      const p = y0 * w + x0;
      out[j * w + i] = (m[p]! * (1 - tx) + m[p + 1]! * tx) * (1 - ty) + (m[p + w]! * (1 - tx) + m[p + w + 1]! * tx) * ty;
    }
  }
  return out;
}

/** The correlation of `x` and `y` (moved by dx, dy) over a box of `x` — where both reach; undefined: nothing to tell. */
function correlation(x: Float64Array, y: Float64Array, w: number, h: number, box: [number, number, number, number], dx = 0, dy = 0): number | undefined {
  const [x0, y0, x1, y1] = box;
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let j = Math.max(y0, -dy); j < Math.min(y1, h - dy); j++)
    for (let i = Math.max(x0, -dx); i < Math.min(x1, w - dx); i++) {
      const b = y[(j + dy) * w + i + dx]!;
      if (Number.isNaN(b)) continue;
      const a = x[j * w + i]!;
      n++;
      sx += a;
      sy += b;
      sxy += a * b;
      sxx += a * a;
      syy += b * b;
    }
  if (n < 16) return undefined;
  const cxx = sxx - (sx * sx) / n;
  const cyy = syy - (sy * sy) / n;
  if (cxx < 1e-6 || cyy < 1e-6) return undefined;
  return (sxy - (sx * sy) / n) / Math.sqrt(cxx * cyy);
}

/** The energy of a map's writing over a box (NaN left out), per pixel. */
function energy(m: Float64Array, w: number, box: [number, number, number, number]): number {
  const [x0, y0, x1, y1] = box;
  let s = 0;
  let n = 0;
  for (let j = y0; j < y1; j++)
    for (let i = x0; i < x1; i++) {
      const v = m[j * w + i]!;
      if (Number.isNaN(v)) continue;
      s += v * v;
      n++;
    }
  return n ? s / n : 0;
}

/**
 * How alike the writing of two pictures is, `b` put over `a` first: `alike` a correlation (-1 … 1, the lower quartile
 * of the parts with writing), `missing` the share of the strong writing of either that the other has nothing of near
 * it; undefined when there is nothing written to compare.
 */
export function compareScans(a: RawImage, b: RawImage): { alike: number; missing: number } | undefined {
  const w = FINE;
  const h = Math.max(TILES * 4, Math.round((FINE * a.height) / a.width));
  const fa = resize(a, w, h);
  const fb = resize(b, w, h);
  // put over each other: on the writing made small, b moved and made larger or smaller
  const cw = COARSE;
  const ch = Math.max(8, Math.round((COARSE * h) / w));
  const ca = writingOf(resize(fa, cw, ch));
  const cb = writingOf(resize(fb, cw, ch));
  const move = Math.round(MOVE * cw);
  const whole: [number, number, number, number] = [0, 0, cw, ch];
  let best = { c: -Infinity, k: 1, ox: 0, oy: 0 };
  for (let k = 1 - SCALE; k <= 1 + SCALE + 1e-9; k += 0.02) {
    const wb = warp(cb, cw, ch, k, 0, 0);
    for (let oy = -move; oy <= move; oy++)
      for (let ox = -move; ox <= move; ox++) {
        const c = correlation(ca, wb, cw, ch, whole, ox, oy);
        if (c !== undefined && c > best.c) best = { c, k, ox, oy };
      }
  }
  if (best.c === -Infinity) return undefined;
  // part by part at the finer size, each part moved a little more
  const x = writingOf(fa);
  const s = w / cw;
  const y = warp(writingOf(fb), w, h, best.k, best.ox * s, best.oy * s);
  const tw = Math.floor(w / TILES);
  const th = Math.floor(h / TILES);
  const boxes: [number, number, number, number][] = [];
  for (let ty = 0; ty < TILES; ty++) for (let tx = 0; tx < TILES; tx++) boxes.push([tx * tw, ty * th, (tx + 1) * tw, (ty + 1) * th]);
  const ex = boxes.map((bx) => energy(x, w, bx));
  const ey = boxes.map((bx) => energy(y, w, bx));
  const mx = Math.max(...ex);
  const my = Math.max(...ey);
  // nothing written (a blank page, the noise of a scan alone): nothing to tell them apart by
  if (mx < 4 && my < 4) return undefined;
  // strong writing of each (STRONG of its darkest strokes, never the noise of a scan): what one of them has strongly,
  // the other has near it too
  const strong = (m: Float64Array) => {
    const v = new Float64Array(m.length);
    let n = 0;
    for (const q of m) if (!Number.isNaN(q)) v[n++] = q;
    const sorted = v.subarray(0, n).sort();
    return Math.max(STRONG * (sorted[Math.floor(n * 0.999)] ?? 0), 6);
  };
  const sx = strong(x);
  const sy = strong(y);
  const near = (m: Float64Array, i: number, j: number) => {
    let most = -Infinity;
    for (let jj = Math.max(0, j - 1); jj <= Math.min(h - 1, j + 1); jj++)
      for (let ii = Math.max(0, i - 1); ii <= Math.min(w - 1, i + 1); ii++) {
        const q = m[jj * w + ii]!;
        if (!Number.isNaN(q) && q > most) most = q;
      }
    return most;
  };
  const parts: number[] = [];
  let drawn = 0;
  let missed = 0;
  boxes.forEach((bx, t) => {
    if (ex[t]! < 0.15 * mx && ey[t]! < 0.15 * my) return;
    let c = -1;
    let at = [0, 0];
    for (let dy = -SHIFT; dy <= SHIFT; dy++)
      for (let dx = -SHIFT; dx <= SHIFT; dx++) {
        const v = correlation(x, y, w, h, bx, dx, dy) ?? -1;
        if (v > c) {
          c = v;
          at = [dx, dy];
        }
      }
    parts.push(Math.max(0, c));
    const [dx, dy] = at as [number, number];
    for (let j = Math.max(bx[1], 1 - dy); j < Math.min(bx[3], h - 1 - dy); j++)
      for (let i = Math.max(bx[0], 1 - dx); i < Math.min(bx[2], w - 1 - dx); i++) {
        const b = y[(j + dy) * w + i + dx]!;
        if (Number.isNaN(b)) continue;
        if (x[j * w + i]! > sx) {
          drawn++;
          if (near(y, i + dx, j + dy) < 0.3 * sy) missed++;
        }
        if (b > sy) {
          drawn++;
          if (near(x, i, j) < 0.3 * sx) missed++;
        }
      }
  });
  if (parts.length < MIN_PARTS) return undefined;
  parts.sort((p, q) => p - q);
  return { alike: parts[Math.floor(parts.length / 4)]!, missing: drawn ? missed / drawn : 0 };
}

/**
 * Whether file `a` is the same scan as file `b`: "other" when the shapes differ (SHAPE_TOLERANCE) or the writing is not
 * alike (SAME_SCAN_LIKENESS) or some of it is missing in the other (SAME_SCAN_MISSING); "same" only when neither;
 * undefined when it cannot be told (a format strom does not read itself, nothing written to compare) — never "same".
 */
export function scanLikeness(a: string, b: string): "same" | "other" | undefined {
  const sa = shapeOf(a);
  const sb = shapeOf(b);
  if (sa !== undefined && sb !== undefined && Math.abs(sa - sb) / Math.max(sa, sb) > SHAPE_TOLERANCE) return "other";
  const pa = pictureOf(a);
  const pb = pa ? pictureOf(b) : undefined;
  if (!pa || !pb) return undefined;
  return sameScan(pa, pb);
}

/** Of two pictures (grey, as shown), whether `b` is the same scan as `a` — as scanLikeness, past the shapes. */
export function sameScan(a: RawImage, b: RawImage): "same" | "other" | undefined {
  const c = compareScans(a, b);
  if (c === undefined) return undefined;
  return c.alike >= SAME_SCAN_LIKENESS && c.missing <= SAME_SCAN_MISSING ? "same" : "other";
}
