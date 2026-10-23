// Small previews of the family's material for the Strom app (GET <token>/media/<sha>?thumb=<px>): a JPEG whose longer
// side is at most 128, 256 or 512 pixels, turned as the picture is shown (its EXIF orientation). Made of a JPEG or a
// PNG by strom itself, of a HEIC photo and of a PDF's first page through what makes them readable here
// (core/readable.ts); anything else has none (the app shows the kind's icon). The original is never changed: the
// previews are a cache in .strom/thumbs/, by the file's content, made again when asked (strom tidy keeps it within
// limits). Made by a strom of its own (strom media thumb), so the bridge answers others meanwhile.

import fs from "node:fs";
import path from "node:path";
import { StromError } from "./errors.ts";
import type { Env } from "./paths.ts";
import { readableFile } from "./readable.ts";
import { resize, toRgb, upright } from "../image/image.ts";
import { decodeImage, encodeImage, exifOrientationOf, formatOf } from "../image/index.ts";

/** The sizes asked for (the longer side, in pixels). */
export const THUMB_SIZES = [128, 256, 512] as const;

/** Where the preview of a content of that size is kept. */
export function thumbPath(root: string, sha: string, px: number): string {
  return path.join(root, ".strom", "thumbs", `${sha}-${px}.jpg`);
}

/** The preview made already, touched as used (the newest stay): its path, or undefined. */
export function cachedThumb(root: string, sha: string, px: number): string | undefined {
  const f = thumbPath(root, sha, px);
  try {
    if (!fs.statSync(f).isFile()) return undefined;
  } catch {
    return undefined;
  }
  try {
    const now = new Date();
    fs.utimesSync(f, now, now);
  } catch {
    // read only: nothing lost
  }
  return f;
}

/**
 * The preview of a file (its content `sha`) made and kept: its path. Throws a StromError `thumb.type` when it is no
 * picture strom makes a preview of here (TIFF, GIF, WebP, a document, sound; HEIC or a PDF this computer cannot
 * convert), `thumb.failed` when the picture cannot be read.
 */
export function makeThumb(root: string, file: string, sha: string, px: number, env: Env): string {
  const have = cachedThumb(root, sha, px);
  if (have) return have;
  const head = Buffer.alloc(32);
  const fd = fs.openSync(file, "r");
  try {
    fs.readSync(fd, head, 0, 32, 0);
  } finally {
    fs.closeSync(fd);
  }
  const f = formatOf(head);
  const name = path.basename(file);
  if (f !== "jpeg" && f !== "png" && f !== "heic" && f !== "pdf") throw new StromError(`${name}: no preview of ${f === "unknown" ? "this kind of file" : f.toUpperCase()} here`, { code: "thumb.type", params: { kind: f } });
  let source = file;
  if (f === "heic" || f === "pdf") {
    try {
      source = readableFile(root, file, { env, page: 1 }).file;
    } catch (e) {
      throw new StromError(`${name}: no preview — ${e instanceof Error ? e.message : String(e)}`, { code: "thumb.type", params: { kind: f } });
    }
  }
  let out: Uint8Array;
  try {
    const bytes = fs.readFileSync(source);
    const img = decodeImage(bytes);
    const scale = Math.min(1, px / Math.max(img.width, img.height));
    const small = resize(img, Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
    out = encodeImage(toRgb(upright(small, formatOf(bytes) === "jpeg" ? exifOrientationOf(bytes) : undefined)), "jpeg", 82);
  } catch (e) {
    throw new StromError(`${name}: its preview could not be made (${e instanceof Error ? e.message : String(e)})`, { code: "thumb.failed" });
  }
  const to = thumbPath(root, sha, px);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  const part = `${to}.${process.pid}.part`;
  fs.writeFileSync(part, out);
  try {
    fs.renameSync(part, to);
  } catch {
    // another made it meanwhile (Windows does not replace): that one is the same
    fs.rmSync(part, { force: true });
  }
  return to;
}
