// Views of images: the only way an agent looks at a scan. A view is a file in
// .strom/views/ (the one folder of images an agent may read) made from a
// registered image: a crop, a half of a double page, scaled to what a reader
// can take in, contrast stretched on the part being read. Making views through
// strom also tells strom which images were looked at.
//
// Why: an image an agent opens stays in its context and is paid for on every
// later turn; a whole double page at full resolution is the most expensive
// thing there is, and readers shrink big images anyway — small script then
// becomes illegible. So: browse at a reduced size, read at full resolution
// only the column or entry that matters.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { UsageError } from "./errors.ts";
import { now, type Tree } from "./tree.ts";
import { crop, grid, resize, rotate, stretch, toGrey, type RawImage } from "../image/image.ts";
import { decodeImage, encodeImage, ImageFormatError, imageSize } from "../image/index.ts";
import type { Media, Region } from "./model.ts";

/** Longest side of a view by default: what vision models take in without shrinking it again. */
export const VIEW_MAX = 1568;
/** Small crops are enlarged at least to this long side (script gets bigger, not sharper). */
const VIEW_MIN = 800;

export interface ViewSpec {
  /** "x,y,w,h": fractions of the image (all ≤ 1) or pixels. */
  crop?: string | undefined;
  half?: "left" | "right" | "top" | "bottom" | undefined;
  /** Explicit scale of the result (2 = twice as big as the original pixels). */
  scale?: number | undefined;
  /** Longest side of the result when no --scale is given. */
  max?: number | undefined;
  contrast?: boolean | undefined;
  grey?: boolean | undefined;
  grid?: boolean | undefined;
  rotate?: 90 | 180 | 270 | undefined;
  png?: boolean | undefined;
}

export interface View {
  file: string;
  width: number;
  height: number;
  /** Result pixels per original pixel. */
  scale: number;
  original: { width: number; height: number };
  /** The part of the original shown, in original pixels. */
  region: { x: number; y: number; w: number; h: number };
  cached: boolean;
}

export function parseCrop(spec: string, w: number, h: number): { x: number; y: number; w: number; h: number } {
  const nums = spec.split(/[,\s]+/).filter(Boolean).map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n) || n < 0))
    throw new UsageError(`invalid --crop "${spec}"`, { hint: 'give x,y,width,height as fractions ("0.1,0.35,0.4,0.2") or pixels ("400,1200,1500,600")' });
  const relative = nums.every((n) => n <= 1);
  const [x, y, cw, ch] = relative ? [nums[0]! * w, nums[1]! * h, nums[2]! * w, nums[3]! * h] : nums;
  if (cw! <= 0 || ch! <= 0) throw new UsageError("--crop needs a width and a height");
  return { x: Math.max(0, x!), y: Math.max(0, y!), w: Math.min(cw!, w - x!), h: Math.min(ch!, h - y!) };
}

/** The part of a W×H image a view shows (--half, then --crop within it), in its pixels. */
export function viewRegion(spec: Pick<ViewSpec, "half" | "crop">, W: number, H: number): { x: number; y: number; w: number; h: number } {
  let region = { x: 0, y: 0, w: W, h: H };
  if (spec.half === "left") region = { x: 0, y: 0, w: Math.ceil(W / 2), h: H };
  else if (spec.half === "right") region = { x: Math.floor(W / 2), y: 0, w: W - Math.floor(W / 2), h: H };
  else if (spec.half === "top") region = { x: 0, y: 0, w: W, h: Math.ceil(H / 2) };
  else if (spec.half === "bottom") region = { x: 0, y: Math.floor(H / 2), w: W, h: H - Math.floor(H / 2) };
  if (spec.crop) {
    const c = parseCrop(spec.crop, region.w, region.h);
    region = { x: region.x + c.x, y: region.y + c.y, w: c.w, h: c.h };
  }
  return region;
}

/**
 * A region too big for one look at full resolution, as overlapping tiles of at
 * most `max` px (in original pixels, "x,y,w,h" for --crop). One tile when it fits.
 */
export function tiles(region: { x: number; y: number; w: number; h: number }, max = VIEW_MAX, overlap = 0.1): { crop: string; label: string }[] {
  const step = Math.floor(max * (1 - overlap));
  const cols = Math.max(1, Math.ceil((region.w - max) / step) + 1);
  const rows = Math.max(1, Math.ceil((region.h - max) / step) + 1);
  const out: { crop: string; label: string }[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = cols === 1 ? region.x : Math.round(region.x + ((region.w - Math.min(max, region.w)) * c) / (cols - 1));
      const y = rows === 1 ? region.y : Math.round(region.y + ((region.h - Math.min(max, region.h)) * r) / (rows - 1));
      const w = Math.round(Math.min(max, region.w));
      const h = Math.round(Math.min(max, region.h));
      const where = [rows > 1 ? ["top", "middle", "bottom"][r === 0 ? 0 : r === rows - 1 ? 2 : 1] : "", cols > 1 ? ["left", "centre", "right"][c === 0 ? 0 : c === cols - 1 ? 2 : 1] : ""].filter(Boolean).join(" ");
      out.push({ crop: `${Math.round(x)},${Math.round(y)},${w},${h}`, label: `part ${r * cols + c + 1} of ${rows * cols}${where ? ` (${where})` : ""}` });
    }
  return out;
}

/** Make (or reuse) a view of an image file. `key` names it (M0012, I0003). */
export function makeView(tree: Tree, source: string, key: string, spec: ViewSpec): View {
  if (!fs.existsSync(source)) throw new UsageError(`the image file is missing: ${source}`, { hint: "the shared folder may have moved: strom config where" });
  const bytes = new Uint8Array(fs.readFileSync(source));
  const size = imageSize(bytes);
  if (!size) {
    // not JPEG/PNG: decodeImage says what to do
    try {
      decodeImage(bytes);
    } catch (err) {
      if (err instanceof ImageFormatError) throw new UsageError(err.message);
      throw err;
    }
  }
  const W = size!.width;
  const H = size!.height;
  let region = viewRegion(spec, W, H);
  region = { x: Math.round(region.x), y: Math.round(region.y), w: Math.max(1, Math.round(region.w)), h: Math.max(1, Math.round(region.h)) };
  const long = Math.max(region.w, region.h);
  const scale =
    spec.scale !== undefined
      ? spec.scale
      : long > (spec.max ?? VIEW_MAX)
        ? (spec.max ?? VIEW_MAX) / long
        : spec.crop || spec.half
          ? Math.min(3, Math.max(1, VIEW_MIN / long))
          : 1;
  if (!(scale > 0) || scale > 8) throw new UsageError("--scale must be between 0 and 8");
  const outW = Math.max(1, Math.round(region.w * scale));
  const outH = Math.max(1, Math.round(region.h * scale));
  if (Math.max(outW, outH) > 6000) throw new UsageError(`the view would be ${outW}×${outH} px`, { hint: "crop a smaller part, or a smaller --scale" });

  const sha = crypto.createHash("sha256").update(bytes).update(JSON.stringify({ region, scale, spec: { ...spec, crop: undefined, half: undefined, scale: undefined, max: undefined } })).digest("hex");
  const ext = spec.png ? "png" : "jpg";
  const dir = path.join(tree.root, ".strom", "views");
  const file = path.join(dir, `${key}-${sha.slice(0, 10)}.${ext}`);
  const cached = fs.existsSync(file);
  let dims = { width: outW, height: outH };
  if (!cached) {
    let img: RawImage = decodeImage(bytes);
    img = crop(img, region.x, region.y, region.w, region.h);
    if (spec.grey) img = toGrey(img);
    if (outW !== img.width || outH !== img.height) img = resize(img, outW, outH);
    if (spec.contrast) img = stretch(img);
    if (spec.rotate) img = rotate(img, spec.rotate);
    if (spec.grid) img = grid(img);
    dims = { width: img.width, height: img.height };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, encodeImage(img, spec.png ? "png" : "jpeg"));
  } else if (spec.rotate === 90 || spec.rotate === 270) dims = { width: outH, height: outW };
  // Which images were looked at, and by whom (session costs, "who read this").
  fs.appendFileSync(path.join(dir, "views.jsonl"), JSON.stringify({ at: now(), key, by: tree.actor, view: path.basename(file), region, scale }) + "\n");
  return { file, ...dims, scale, original: { width: W, height: H }, region, cached };
}

/** One line telling the reader what it sees and how to see more. */
export function describeView(v: View, display: (p: string) => string, fetchPart?: string): string {
  const pct = Math.round(v.scale * 100);
  const part = v.region.w === v.original.width && v.region.h === v.original.height ? "whole image" : `part ${v.region.x},${v.region.y} ${v.region.w}×${v.region.h} px`;
  const hint =
    v.scale < 0.75
      ? " — reduced: crop the part you need to read it at full size (--crop x,y,w,h, --half left|right, --grid to find it)"
      : v.scale > 1.25
        ? `\nenlarged from ${v.region.w}×${v.region.h} px of the scan: it has no more detail than that. What you cannot read for sure is marked [?] in the transcript and stays out of the fields; ${
            fetchPart
              ? `this part sharper from the archive (one request): ${fetchPart}`
              : 'a sharper scan: ask the user (strom task wait … --images B…:<n> --on "…": zoomed in on the entry, or the full-resolution scan)'
          }`
        : "";
  return `${display(v.file)}\n${v.width}×${v.height} px · ${part} of ${v.original.width}×${v.original.height} · ${pct} %${hint}`;
}

/** A part of an image from --half / --crop (fractions, or pixels of the registered whole image). */
export function partRegion(opts: Record<string, unknown>, whole?: Media): Region {
  const half = opts.half === undefined ? undefined : String(opts.half);
  if (half !== undefined && !["left", "right", "top", "bottom"].includes(half)) throw new UsageError(`invalid --half "${half}"`, { hint: "left, right, top or bottom" });
  const crop = opts.crop === undefined ? undefined : String(opts.crop);
  const pixels = !!crop && crop.split(/[,\s]+/).filter(Boolean).map(Number).some((n) => n > 1);
  if (pixels && !(whole?.width && whole.height))
    throw new UsageError("--crop in pixels needs the image registered (its size); give fractions of it", { hint: "--crop 0.5,0.2,0.5,0.3 — x, y, width, height as parts of the whole image" });
  // fractions are measured on a large image, so that halves come out exact
  const [W, H] = pixels ? [whole!.width!, whole!.height!] : [1_000_000, 1_000_000];
  const px = viewRegion({ half: half as "left" | undefined, crop }, W, H);
  const f = (n: number) => Math.round(n * 10_000) / 10_000;
  const r = { x: f(px.x / W), y: f(px.y / H), w: f(px.w / W), h: f(px.h / H) };
  if (r.w * r.h > 0.95) throw new UsageError("that is the whole image", { hint: "without --crop and --half it is the image itself" });
  return r;
}
