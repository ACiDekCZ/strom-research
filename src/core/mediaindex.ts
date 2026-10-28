// What the images of a research say in short, without reading all of them: for
// each record set how many images stand (not withdrawn) and their numbers, the
// connector its images came by and its sharper copies (a part, a new scan of the
// same image: what the questions about the reading of scans stand on), and how
// many stand in all. The task queue, the brief and the overview ask it on
// every call, and a long research has tens of thousands of image records — read
// whole each time they cost a second. So it is kept in .strom/cache/images.json
// with a stamp of the images' folder (its modification time and how many
// records it holds) and used only while the folder is exactly as it was then;
// anything else — another stamp, an unreadable or older file, records this
// process holds in memory — and it is made again from the records themselves.
// A folder changed less than STABLE_MS ago is not trusted to a stamp at all
// (a file system's clock may give two changes in a row the same time).

import fs from "node:fs";
import path from "node:path";
import type { Media, RecordType } from "./model.ts";
import { RECORD_TYPES } from "./model.ts";
import { readJsonIfExists, writeFileAtomic } from "./json.ts";
import type { Tree } from "./tree.ts";

export interface ImagesIndex {
  /** Images that stand (not withdrawn). */
  alive: number;
  /** Per record set: how many of its images stand, their numbers (each once, sorted), and the long side of its scans (the median of its whole images whose size is known, px). */
  sets: Map<string, SetImages>;
}

export interface SetImages {
  count: number;
  images: number[];
  long?: number;
  /** The connector the first of its images fetched by one came by. */
  connector?: string;
  /** Its copies with more detail than the scan they are of (gain > 1), in the order of the records. */
  copies?: SharperCopy[];
}

/** A copy of a scan with more detail than the scan it is of: a part of it, or a new scan of the same image. */
export interface SharperCopy {
  id: string;
  image: number;
  created: string;
  /** How much more detail: the copy's width per the whole scan's (a part: its width over the part's share). */
  gain: number;
  part?: true;
  /** The connector it came by. */
  connector?: string;
}

/**
 * A weak scan: its long side at most this many pixels — what an archive's viewer gives at most (2000 px), where a
 * double page has under ~1000 px across each page. Readers of such scans (1 142–2 000 px) said the scan had no more
 * detail, never the view; a negative read on them is weak. Measured on the image's own size, nothing stored.
 */
export const WEAK_SCAN_PX = 2000;

/** The long side of a record set's scans when they are weak (WEAK_SCAN_PX), else nothing. */
export function weakScans(tree: Tree, recordset: string): number | undefined {
  const long = imagesIndex(tree).sets.get(recordset)?.long;
  return long !== undefined && long <= WEAK_SCAN_PX ? long : undefined;
}

interface Stamp {
  mtimeNs: string;
  count: number;
}

interface Stored {
  v: number;
  stamp: Stamp;
  alive: number;
  sets: Record<string, SetImages>;
}

const FORMAT = 3;
const TYPE: RecordType = "media";
/** A folder changed this recently may change again within the same tick of its clock: no stamp for it. */
export const STABLE_MS = 2000;

const memo = new WeakMap<Tree, { version: number; index: ImagesIndex }>();

export function indexFile(tree: Tree): string {
  return path.join(tree.root, ".strom", "cache", "images.json");
}

/** The images of the research in short (see above). */
export function imagesIndex(tree: Tree): ImagesIndex {
  const held = memo.get(tree);
  if (held && held.version === tree.version) return held.index;
  const index = load(tree);
  memo.set(tree, { version: tree.version, index });
  return index;
}

/** The record sets with at least one image that stands. */
export function setsWithImages(tree: Tree): Set<string> {
  return new Set([...imagesIndex(tree).sets].filter(([, s]) => s.count > 0).map(([id]) => id));
}

function load(tree: Tree): ImagesIndex {
  // What this process holds or wrote itself (a dry run's records exist only in memory): the records.
  if (tree.dryRun || tree.loaded(TYPE) || wroteImages(tree)) return build(tree.list<Media>(TYPE));
  const dir = path.join(tree.dataDir, RECORD_TYPES[TYPE].dir);
  const before = stampOf(dir);
  if (before) {
    try {
      const stored = readJsonIfExists<Stored>(indexFile(tree));
      if (stored && stored.v === FORMAT && sameStamp(stored.stamp, before)) return fromStored(stored);
    } catch {
      // unreadable: made again below
    }
  }
  const index = build(tree.list<Media>(TYPE));
  const after = stampOf(dir);
  if (after && before && sameStamp(before, after) && Date.now() - Number(BigInt(after.mtimeNs) / 1_000_000n) >= STABLE_MS) {
    try {
      const stored: Stored = { v: FORMAT, stamp: after, alive: index.alive, sets: Object.fromEntries(index.sets) };
      writeFileAtomic(indexFile(tree), JSON.stringify(stored));
    } catch {
      // a read-only folder: the index is only a help
    }
  }
  return index;
}

function wroteImages(tree: Tree): boolean {
  const prefix = `data/${RECORD_TYPES[TYPE].dir}/`;
  return tree.written.some((op) => (op.files ?? []).some((f) => f.path.startsWith(prefix)));
}

function stampOf(dir: string): Stamp | undefined {
  try {
    const st = fs.statSync(dir, { bigint: true });
    let count = 0;
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".json")) count++;
    return { mtimeNs: String(st.mtimeNs), count };
  } catch {
    return undefined;
  }
}

function sameStamp(a: Stamp, b: Stamp): boolean {
  return !!a && !!b && a.mtimeNs === b.mtimeNs && a.count === b.count;
}

function build(all: Media[]): ImagesIndex {
  const sets = new Map<string, SetImages>();
  const sides = new Map<string, number[]>();
  // the whole scans of each image (not withdrawn), for the copies' gain
  const wholes = new Map<string, Media[]>();
  const imageKey = (m: Media) => `${m.recordset}\n${m.image}`;
  let alive = 0;
  for (const m of all) {
    if (m.retracted) continue;
    alive++;
    if (!m.recordset) continue;
    const s = sets.get(m.recordset) ?? { count: 0, images: [] };
    s.count++;
    if (m.image !== undefined) s.images.push(m.image);
    if (s.connector === undefined && m.fetched?.connector) s.connector = m.fetched.connector;
    sets.set(m.recordset, s);
    // a part of an image is not its scan
    if (!m.part && m.width && m.height) {
      const l = sides.get(m.recordset) ?? [];
      l.push(Math.max(m.width, m.height));
      sides.set(m.recordset, l);
    }
    if (!m.part && m.image !== undefined) {
      const k = imageKey(m);
      const w = wholes.get(k) ?? [];
      w.push(m);
      wholes.set(k, w);
    }
  }
  for (const m of all) {
    const gain = gainOf(m, wholes.get(imageKey(m)) ?? []);
    if (gain === undefined || !(gain > 1)) continue;
    const s = sets.get(m.recordset!)!;
    (s.copies ??= []).push({ id: m.id, image: m.image!, created: m.created, gain, ...(m.part ? { part: true as const } : {}), ...(m.fetched?.connector ? { connector: m.fetched.connector } : {}) });
  }
  for (const [id, s] of sets) {
    s.images = [...new Set(s.images)].sort((x, y) => x - y);
    const l = sides.get(id)?.sort((x, y) => x - y);
    if (l?.length) s.long = l[Math.floor((l.length - 1) / 2)]!;
  }
  return { alive, sets };
}

/**
 * How much more detail a copy of a scan has than the scan it is of (`wholes`: the whole scans of its image that stand):
 * a part, by the whole scan of most pixels; a new scan, by the widest scan of the image made before it.
 */
function gainOf(m: Media, wholes: Media[]): number | undefined {
  if (m.retracted || !m.width || m.recordset === undefined || m.image === undefined) return undefined;
  if (m.part) {
    const pixels = (x: Media) => (x.width ?? 0) * (x.height ?? 0);
    const whole = wholes.reduce<Media | undefined>((best, x) => (!best || pixels(x) > pixels(best) ? x : best), undefined);
    return whole?.width && m.part.w > 0 ? m.width / m.part.w / whole.width : undefined;
  }
  const w = Math.max(0, ...wholes.filter((x) => x.id !== m.id && x.width && x.created < m.created).map((x) => x.width!));
  return w > 0 ? m.width / w : undefined;
}

/** The sharper copies of a record set (gain at least `min`). */
export function sharperCopies(tree: Tree, recordset: string, min: number): SharperCopy[] {
  return (imagesIndex(tree).sets.get(recordset)?.copies ?? []).filter((c) => c.gain >= min);
}

/** The connector a record set's images came by (the first of them fetched by one). */
export function connectorOfSet(tree: Tree, recordset: string): string | undefined {
  return imagesIndex(tree).sets.get(recordset)?.connector;
}

function fromStored(s: Stored): ImagesIndex {
  return { alive: s.alive, sets: new Map(Object.entries(s.sets)) };
}
