// Whether an image is a zoomed-in part of another scan, and where it lies in it. A person saving scans by hand keeps a
// cut-out beside the page ("9a.jpg" beside "9.jpg": the entry made larger to read); that is neither the same scan
// (samescan.ts: a copy, made smaller or cut a little) nor another page — it is a part of page 9.
//
// Told by the handwriting alone, as samescan.ts tells a copy: the printed rules of a form and the light of the page are
// taken away (writingOf) and what is left — the writing — of the part is looked for in the whole. First on both made
// small: the part made as small as it would be in the whole at each size it may have there, moved over every place;
// then the best few places again at a finer size. A part only when its writing is very alike there and nothing written
// strongly in either is missing in the other at that place; another page of the same form has other writing (or only
// some of it the same) and is never taken for a part of it. When not sure, or nothing written to tell by: undefined.

import type { RawImage } from "../image/image.ts";
import { resize } from "../image/image.ts";
import type { Region } from "./model.ts";
import { pictureOf, writingOf } from "./samescan.ts";

/**
 * The widths the whole is searched at first (every size and place of the part): a part of `from` of the width of the
 * whole up to the `from` of the size before at `width` — so it is some 10 to 30 pixels wide where it is looked for, a
 * large part at a small size, a small one at a larger. The best places are told again at each next size, then at FINE.
 * The smallest part looked for is the last `from` of the whole's width.
 */
const SEARCHED = [
  { width: 32, from: 0.4 },
  { width: 45, from: 0.27 },
  { width: 64, from: 0.15 },
];
const FINE = 180;

/** A "part" this large (of the width and of the height) is the whole page: a copy, scanLikeness's to tell. */
const WHOLE_ALREADY = 0.92;

/** How many of the best places of a search are told again at the next size. */
const CANDIDATES = 6;

/**
 * At the next size each place is moved by up to this many pixels and its width changed by up to as many — a pixel at
 * the size before is about one and a half at the next searched, nearly three at FINE.
 */
const MOVE = 2;
const MOVE_FINE = 3;

/**
 * The writing of the part and of the whole at its place alike at least this much (a correlation, 1 = the same): a part
 * cut out, made larger and saved again is 0.78–0.99, the best place of a part of another page of the form ≤ 0.4.
 */
export const PART_LIKENESS = 0.6;

/**
 * And of the strong writing of either at that place, at most this share with nothing of it near it in the other — a
 * part cut out of the page loses nothing written strongly (≤ 0.03); another page sharing some strokes has the rest
 * missing (≥ 0.3 of them).
 */
export const PART_MISSING = 0.1;

/** The pixels at the part's edge (at FINE) left out of what is missing. */
const EDGE = 2;

/** Strong writing: at least this of the darkest strokes of a picture (its 99.9th percentile), never less than 6. */
const STRONG = 0.4;

/**
 * At least this many pixels of the part's writing at FINE (darker than the page around by INK of 255), else nothing to
 * tell by: the smallest part with a word or two on it has some 30–60, a blank piece of a page (the noise of a scan) none.
 */
const LEAST_WRITING = 24;
const INK = 12;

/** A map of writing (writingOf) with its sums, so the correlation with a part at any place takes the part's size alone. */
interface Whole {
  m: Float64Array;
  w: number;
  h: number;
  s1: Float64Array;
  s2: Float64Array;
}

function wholeOf(m: Float64Array, w: number, h: number): Whole {
  const s1 = new Float64Array((w + 1) * (h + 1));
  const s2 = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let a = 0;
    let b = 0;
    for (let x = 0; x < w; x++) {
      const v = m[y * w + x]!;
      a += v;
      b += v * v;
      s1[(y + 1) * (w + 1) + x + 1] = s1[y * (w + 1) + x + 1]! + a;
      s2[(y + 1) * (w + 1) + x + 1] = s2[y * (w + 1) + x + 1]! + b;
    }
  }
  return { m, w, h, s1, s2 };
}

/** The writing of the part made `pw` × `ph`, filtered as a page `across` wide; less its mean, with its sum of squares. */
interface Part {
  p: Float64Array;
  w: number;
  h: number;
  norm: number;
}

function partOfSize(part: RawImage, pw: number, ph: number, across: number): Part {
  const p = writingOf(resize(part, pw, ph), across);
  let mean = 0;
  for (const v of p) mean += v;
  mean /= p.length;
  let norm = 0;
  for (let i = 0; i < p.length; i++) {
    const v = p[i]! - mean;
    p[i] = v;
    norm += v * v;
  }
  return { p, w: pw, h: ph, norm };
}

/** The correlation of the part with the whole where its top left corner is at (x, y); -1 when nothing to tell. */
function alikeAt(part: Part, whole: Whole, x: number, y: number): number {
  const { p, w: pw, h: ph, norm } = part;
  const { m, w: W, s1, s2 } = whole;
  let dot = 0;
  for (let j = 0; j < ph; j++) {
    const row = (y + j) * W + x;
    const prow = j * pw;
    for (let i = 0; i < pw; i++) dot += p[prow + i]! * m[row + i]!;
  }
  const n = pw * ph;
  const at = (xx: number, yy: number, s: Float64Array) => s[yy * (W + 1) + xx]!;
  const box = (s: Float64Array) => at(x + pw, y + ph, s) - at(x, y + ph, s) - at(x + pw, y, s) + at(x, y, s);
  const a = box(s1);
  const v = box(s2) - (a * a) / n;
  if (v < 1e-6 || norm < 1e-6) return -1;
  return dot / Math.sqrt(norm * v);
}

/** A place of the part in the whole at a size: its correlation there, its width and its top left corner (pixels). */
interface Place {
  c: number;
  pw: number;
  x: number;
  y: number;
}

/** The whole at a size, with the writing of the part at each width tried there. */
interface Level {
  whole: Whole;
  parts: Map<number, Part>;
}

/** Keep `q` among the CANDIDATES best places (best first): one of each spot, a better one near it takes its turn. */
function keep(best: Place[], q: Place): void {
  const near = best.findIndex((b) => Math.abs(b.pw - q.pw) <= 2 && Math.abs(b.x - q.x) <= 2 && Math.abs(b.y - q.y) <= 2);
  if (near >= 0) {
    if (best[near]!.c >= q.c) return;
    best.splice(near, 1);
  }
  best.push(q);
  best.sort((a, b) => b.c - a.c);
  if (best.length > CANDIDATES) best.length = CANDIDATES;
}

/**
 * A picture made smaller by halves (down to some 32 pixels wide), so each size of it is made from the least of them
 * still twice as wide: a part made larger, a scan of a page are thousands of pixels, never needed wider than FINE.
 */
function halvesOf(img: RawImage): RawImage[] {
  const halves = [img];
  for (let last = img; last.width >= 64 && last.height >= 8; ) {
    const w = Math.floor(last.width / 2);
    halves.push((last = resize(last, w, Math.max(1, Math.round((w * img.height) / img.width)))));
  }
  return halves;
}

/** Of the halves of a picture, the one to make it `w` wide from. */
function madeFrom(halves: RawImage[], w: number): RawImage {
  return halves.findLast((h) => h.width >= 2 * w) ?? halves[0]!;
}

/** The share of the darkest strokes (99.9th percentile) of a map, as STRONG says. */
function strongOf(values: Float64Array): number {
  const sorted = Float64Array.from(values).sort();
  return Math.max(STRONG * (sorted[Math.floor(sorted.length * 0.999)] ?? 0), 6);
}

/**
 * Where the writing of `part` is best found in `whole`, at the finer size: `region` in fractions of the whole, `alike`
 * the correlation there, `missing` the share of the strong writing of either with nothing of it near it in the other;
 * undefined when there is nothing written to tell by or the part cannot lie in the whole (its shape, or narrower than the
 * smallest part looked for).
 */
export function matchPart(part: RawImage, whole: RawImage): { region: Region; alike: number; missing: number } | undefined {
  if (!part.width || !part.height || !whole.width || !whole.height) return undefined;
  const shape = part.height / part.width;
  const parts = halvesOf(part);
  const wholes = halvesOf(whole);
  // the whole at a size, its writing; the part's writing at each width it is tried at there
  const level = (w: number): Level => {
    const h = Math.max(4, Math.round((w * whole.height) / whole.width));
    return { whole: wholeOf(writingOf(resize(madeFrom(wholes, w), w, h)), w, h), parts: new Map() };
  };
  const partAt = (lv: Level, pw: number): Part | undefined => {
    const ph = Math.round(pw * shape);
    if (pw < 4 || ph < 4 || pw > lv.whole.w || ph > lv.whole.h) return undefined;
    let p = lv.parts.get(pw);
    if (!p) lv.parts.set(pw, (p = partOfSize(madeFrom(parts, pw), pw, ph, lv.whole.w)));
    return p.norm < 1e-6 ? undefined : p;
  };
  // the part of each width from `lo` to `hi` of the whole at every place
  const search = (lv: Level, lo: number, hi: number, best: Place[]) => {
    const W = lv.whole.w;
    for (let pw = Math.max(4, Math.round(lo * W)); pw <= Math.min(W, Math.round(hi * W)); pw++) {
      const p = partAt(lv, pw);
      if (!p) continue;
      for (let y = 0; y + p.h <= lv.whole.h; y++)
        for (let x = 0; x + pw <= W; x++) {
          const c = alikeAt(p, lv.whole, x, y);
          if (best.length < CANDIDATES || c > best[best.length - 1]!.c) keep(best, { c, pw, x, y });
        }
    }
  };
  // each place found at `was` again at `lv`: moved by up to `move` pixels, its width changed by up to as many
  const refine = (places: Place[], was: Level, lv: Level, move: number, best: Place[]) => {
    const k = lv.whole.w / was.whole.w;
    for (const b of places) {
      let top: Place | undefined;
      const mid = Math.round(b.pw * k);
      for (let pw = mid - move; pw <= mid + move; pw++) {
        const p = partAt(lv, pw);
        if (!p) continue;
        // the middle of the part stays where it was found, its size changed around it
        const x0 = Math.round((b.x + b.pw / 2) * k - pw / 2);
        const y0 = Math.round((b.y + (b.pw * shape) / 2) * k - p.h / 2);
        for (let y = Math.max(0, y0 - move); y <= Math.min(lv.whole.h - p.h, y0 + move); y++)
          for (let x = Math.max(0, x0 - move); x <= Math.min(lv.whole.w - pw, x0 + move); x++) {
            const c = alikeAt(p, lv.whole, x, y);
            if (!top || c > top.c) top = { c, pw, x, y };
          }
      }
      if (top) keep(best, top);
    }
  };
  // the larger parts first at the smallest size; the best places of each size among those of the next
  let places: Place[] = [];
  let was: Level | undefined;
  let upTo = 1;
  for (const { width, from } of SEARCHED) {
    const lv = level(width);
    const here: Place[] = [];
    search(lv, from, upTo, here);
    if (was) refine(places, was, lv, MOVE, here);
    places = here;
    was = lv;
    upTo = from;
  }
  const fine = level(FINE);
  const best: Place[] = [];
  if (was) refine(places, was, fine, MOVE_FINE, best);
  const found = best[0];
  if (!found || found.c <= -1) return undefined;
  const p = partAt(fine, found.pw)!;
  const ph = p.h;
  const fw = fine.whole.w;
  const fh = fine.whole.h;
  // nothing written in the part (a blank piece of the page, the noise of a scan alone): nothing to tell by
  const strongPart = strongOf(p.p);
  let written = 0;
  for (const v of p.p) if (v > INK) written++;
  if (written < LEAST_WRITING) return undefined;
  // what either has strongly at that place, the other has near it too
  const m = fine.whole.m;
  const there = new Float64Array(p.w * ph);
  for (let j = 0; j < ph; j++) for (let i = 0; i < p.w; i++) there[j * p.w + i] = m[(found.y + j) * fw + found.x + i]!;
  const strongWhole = strongOf(there);
  const near = (map: Float64Array, w: number, h: number, i: number, j: number) => {
    let most = -Infinity;
    for (let jj = Math.max(0, j - 1); jj <= Math.min(h - 1, j + 1); jj++)
      for (let ii = Math.max(0, i - 1); ii <= Math.min(w - 1, i + 1); ii++) most = Math.max(most, map[jj * w + ii]!);
    return most;
  };
  // (not at the part's very edge: the page around a stroke there is cut off in the part, not in the whole)
  let drawn = 0;
  let missed = 0;
  for (let j = EDGE; j < ph - EDGE; j++)
    for (let i = EDGE; i < p.w - EDGE; i++) {
      if (p.p[j * p.w + i]! > strongPart) {
        drawn++;
        if (near(there, p.w, ph, i, j) < 0.3 * strongWhole) missed++;
      }
      if (there[j * p.w + i]! > strongWhole) {
        drawn++;
        if (near(p.p, p.w, ph, i, j) < 0.3 * strongPart) missed++;
      }
    }
  return {
    region: { x: found.x / fw, y: found.y / fh, w: found.pw / fw, h: ph / fh },
    alike: found.c,
    missing: drawn ? missed / drawn : 0,
  };
}

/**
 * Where picture `part` lies in picture `whole` (both grey, as shown), in fractions of the whole — when it is a part of
 * it cut out (and made larger): its writing alike there (PART_LIKENESS) and none of it missing (PART_MISSING). Undefined
 * when it is not, when it cannot be told (nothing written), or when the "part" is the whole page (a copy: samescan.ts).
 */
export function findPart(part: RawImage, whole: RawImage): Region | undefined {
  const found = matchPart(part, whole);
  if (!found || found.alike < PART_LIKENESS || found.missing > PART_MISSING) return undefined;
  if (found.region.w > WHOLE_ALREADY && found.region.h > WHOLE_ALREADY) return undefined;
  return found.region;
}

/** Where the picture of file `partFile` lies in that of `wholeFile` (findPart); undefined for a format strom does not read. */
export function partOf(partFile: string, wholeFile: string): Region | undefined {
  const part = pictureOf(partFile);
  const whole = part ? pictureOf(wholeFile) : undefined;
  if (!part || !whole) return undefined;
  return findPart(part, whole);
}
