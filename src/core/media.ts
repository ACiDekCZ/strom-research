// Files that come into a research: stored unchanged, found again by their
// SHA-256. Small material from the family goes into the tree (and git) —
// it cannot be downloaded again; large files go to the shared media store.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Settings } from "./config.ts";
import { UsageError } from "./errors.ts";
import type { Input, Media, Region, Source } from "./model.ts";
import type { Tree } from "./tree.ts";
import { safeFolderName } from "./text.ts";

export const MAX_IN_TREE = 20 * 1024 * 1024;

export function fileSha256(file: string): string {
  const h = crypto.createHash("sha256");
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.allocUnsafe(1 << 20);
    let n: number;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return h.digest("hex");
}

/** Shared store path for a hash: media/ab/cd/abcd….ext */
export function sharedMediaPath(sharedDir: string, sha: string, ext: string): string {
  return path.join(sharedDir, "media", sha.slice(0, 2), sha.slice(2, 4), `${sha}${ext.toLowerCase()}`);
}

/** Copy into the shared store (no-op when the same content is already there). */
export function storeShared(sharedDir: string, file: string, sha: string): string {
  const dest = sharedMediaPath(sharedDir, sha, path.extname(file));
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // a clone where Node can make one (Linux on Btrfs or XFS: no space taken until one of them changes), else a copy —
    // on macOS Node copies (it cannot clone), so an archive of scans takes its size again
    fs.copyFileSync(file, dest, fs.constants.COPYFILE_FICLONE);
  }
  return dest;
}

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".rtf": "application/rtf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ged": "text/x-gedcom",
  ".json": "application/json",
  ".html": "text/html",
  ".csv": "text/csv",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
};

export function mimeOf(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

/** Every file under the given paths (folders recursively), hidden files skipped. */
export function collectFiles(paths: string[]): string[] {
  const out: string[] = [];
  const walk = (p: string) => {
    const base = path.basename(p);
    if (base.startsWith(".") || base === "Thumbs.db" || base === "desktop.ini") return;
    const st = fs.statSync(p);
    if (st.isDirectory()) for (const e of fs.readdirSync(p).sort()) walk(path.join(p, e));
    else if (st.isFile()) out.push(p);
  };
  for (const p of paths) walk(p);
  return out;
}

const digitGroups = (file: string): string[] => path.basename(file, path.extname(file)).match(/\d+/g) ?? [];

/**
 * The image number in one file name: the last zero-padded group of digits
 * ("s0057.jpg" → 57, "…_00141_sign-4411.jpg" → 141), else the last group.
 */
export function numberInName(file: string): number | undefined {
  const groups = digitGroups(file);
  const g = groups.filter((d) => d.length > 1 && d.startsWith("0")).at(-1) ?? groups.at(-1);
  return g === undefined ? undefined : Number(g);
}

/** The folder of the shared inbox where the user saves images of a record set by hand: "B0003 <its title>". */
export function inboxFolderFor(b: { id: string; title: string }): string {
  const name = [...safeFolderName(`${b.id} ${b.title}`)];
  return name.length <= 80 ? name.join("") : name.slice(0, 80).join("").replace(/[. ]+$/, "");
}

/** A list of image numbers as people write it: "9", "9-12", "9–12, 15" → [9, 10, 11, 12, 15]; undefined if it is not one. */
export function parseImageList(s: string, max = 2000): number[] | undefined {
  const parts = s.split(",").map((p) => p.trim());
  const out = new Set<number>();
  for (const p of parts) {
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(p);
    if (!m) return undefined;
    const a = Number(m[1]);
    const z = Number(m[2] ?? m[1]);
    if (a < 1 || z < a || z - a >= max) return undefined;
    for (let n = a; n <= z && out.size <= max; n++) out.add(n);
  }
  return out.size && out.size <= max ? [...out].sort((x, y) => x - y) : undefined;
}

/**
 * Image numbers of the files of one download: the group of digits that changes
 * from file to file (an archive's file names also carry a call number or a
 * fonds code that stays the same).
 */
export function imageNumbers(files: string[]): (number | undefined)[] {
  const groups = files.map(digitGroups);
  const n = groups[0]?.length ?? 0;
  if (files.length > 1 && n > 0 && groups.every((g) => g.length === n)) {
    const varying = [...Array(n).keys()].filter((i) => new Set(groups.map((g) => Number(g[i]))).size > 1);
    const i = varying.at(-1);
    if (i !== undefined) return groups.map((g) => Number(g[i]));
  }
  return files.map(numberInName);
}

/** The shared inbox by folder ("" = files lying in the inbox itself): one download, one record set. */
export function inboxFolders(inbox: string): { folder: string; files: string[] }[] {
  if (!fs.existsSync(inbox)) return [];
  const by = new Map<string, string[]>();
  for (const f of collectFiles([inbox])) {
    const rel = path.relative(inbox, f).split(path.sep);
    const folder = rel.length > 1 ? rel[0]! : "";
    by.set(folder, [...(by.get(folder) ?? []), f]);
  }
  return [...by].map(([folder, files]) => ({ folder, files }));
}

/**
 * Image n of a record set: the whole image, before any part of it fetched sharper —
 * of several copies of the whole image (a reduced download, then the full one), the sharpest.
 */
export function findImage(all: Media[], recordset: string, image: number): Media | undefined {
  const of = all.filter((m) => !m.retracted && m.recordset === recordset && m.image === image);
  const pixels = (m: Media) => (m.width ?? 0) * (m.height ?? 0);
  return of.filter((m) => !m.part).sort((a, b) => pixels(b) - pixels(a))[0] ?? of[0];
}

/**
 * Image n as a reference names it ("B0001:57"): the whole image. When only parts of it are
 * registered (its two halves), "B0001:57" says nothing of which: the parts are named, none is picked.
 */
export function imageOfRef(all: Media[], recordset: string, image: number): Media | undefined {
  const m = findImage(all, recordset, image);
  if (!m?.part) return m;
  const parts = all.filter((x) => x.recordset === recordset && x.image === image && x.part);
  if (parts.length < 2) return m;
  throw new UsageError(`image ${image} of ${recordset} is registered only in parts: ${parts.map((p) => `${p.id} (part ${regionText(p.part!)})`).join(", ")}`, {
    hint: `name the part the record is on: ${parts.map((p) => p.id).join(" or ")}`,
  });
}

/** The other copies of the same whole image, sharpest first. */
export function otherCopies(all: Media[], m: Media): Media[] {
  if (m.part || m.recordset === undefined || m.image === undefined) return [];
  return all
    .filter((x) => x.id !== m.id && !x.retracted && !x.part && x.recordset === m.recordset && x.image === m.image)
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));
}

/** The same part of an image (to a thousandth of it). */
export function sameRegion(a: Region, b: Region): boolean {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001 && Math.abs(a.w - b.w) < 0.001 && Math.abs(a.h - b.h) < 0.001;
}

/** No region, or one that covers the whole image. */
export function isWhole(r: Region | undefined): boolean {
  return !r || (r.x <= 0.001 && r.y <= 0.001 && r.x + r.w >= 0.999 && r.y + r.h >= 0.999);
}

/** At most this many clips on a source: an entry, and its continuation over a page break (or two). */
export const MAX_CLIPS = 3;

/** "M0012@0.05,0.4,0.45,0.18" — a clip as --clip takes it; "M0012" when it is the whole image. */
export function clipText(c: { media: string; region: Region }): string {
  return isWhole(c.region) ? c.media : `${c.media}@${regionText(c.region)}`;
}

/** "0.5,0,0.5,0.5" — a region as --crop takes it. */
export function regionText(r: Region): string {
  return [r.x, r.y, r.w, r.h].map((n) => String(Math.round(n * 1000) / 1000)).join(",");
}

/**
 * A registered part of a whole image that shows a region of it (fractions of the
 * whole) with more detail than the whole image has: the sharpest one, and where
 * the region is in it. Worth it from a fifth more pixels on. Another copy of the
 * whole image with more pixels counts as a part that covers all of it.
 */
export function sharperPart(all: Media[], whole: Media, r: Region): { part: Media; crop: Region; gain: number } | undefined {
  if (!whole.width || whole.part || whole.recordset === undefined || whole.image === undefined) return undefined;
  const e = 0.002;
  let best: { part: Media; crop: Region; gain: number } | undefined;
  for (const m of all) {
    const p = m.part ?? (m.id !== whole.id ? { x: 0, y: 0, w: 1, h: 1 } : undefined);
    if (!p || !m.width || m.retracted || m.recordset !== whole.recordset || m.image !== whole.image) continue;
    if (r.x < p.x - e || r.y < p.y - e || r.x + r.w > p.x + p.w + e || r.y + r.h > p.y + p.h + e) continue;
    const gain = m.width / p.w / whole.width;
    if (gain < 1.2 || (best && gain <= best.gain)) continue;
    const f = (n: number) => Math.min(1, Math.max(0, n));
    const x = f((r.x - p.x) / p.w);
    const y = f((r.y - p.y) / p.h);
    best = { part: m, gain, crop: { x, y, w: Math.min(1 - x, r.w / p.w), h: Math.min(1 - y, r.h / p.h) } };
  }
  return best;
}

/** Where an input's file is on disk (in the tree, or in the shared media store). */
export function inputPath(tree: Tree, input: Input): string | undefined {
  if (!input.file) return undefined;
  if (input.file.startsWith("inputs/")) return path.join(tree.root, input.file);
  if (input.file.startsWith("media:")) {
    const shared = new Settings(tree.env, {}).shared()?.value;
    return shared ? path.join(shared, input.file.slice(6)) : undefined;
  }
  return undefined;
}

/**
 * An entry read from a scan with no transcript: the note that asks for its words, as they stand in the record (its
 * own language and spelling) — the Strom app shows them next to the entry's image.
 */
export function transcriptNote(tree: Tree, s: Source): string | undefined {
  if (s.retracted || s.transcript?.trim()) return undefined;
  const onScan = s.clips?.length || s.media?.some((id) => /^image\/(jpeg|png)$/.test(tree.get<Media>(id)?.mime ?? ""));
  if (!onScan) return undefined;
  return `note: write the words of the entry as they stand (its own language and spelling, unread letters [?]): strom source edit ${s.id} --transcript @<file> — the Strom app shows them next to its image`;
}

/**
 * A source on a scan with no clip: the note that asks for one. The reader has the entry in front of them — it is
 * the moment to say where it is (the Strom app shows the entry cut out of the scan next to its words).
 */
export function clipNote(tree: Tree, s: Source): string | undefined {
  if (s.retracted || s.clips?.length || !s.media?.length) return undefined;
  const image = s.media.find((id) => /^image\/(jpeg|png)$/.test(tree.get<Media>(id)?.mime ?? ""));
  if (!image) return undefined;
  return `note: say where the entry is on ${image}: strom source edit ${s.id} --clip ${image}@x,y,w,h (the view you read it in prints it: strom media view ${image} --crop …) — the Strom app shows it cut out next to its words`;
}
