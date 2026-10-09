// What the images of a research say in short, without reading all of them: for
// each record set how many images stand (not withdrawn) and their numbers, and
// how many stand in all. The task queue, the brief and the overview ask it on
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
  /** Per record set: how many of its images stand, and their numbers (each once, sorted). */
  sets: Map<string, { count: number; images: number[] }>;
}

interface Stamp {
  mtimeNs: string;
  count: number;
}

interface Stored {
  v: number;
  stamp: Stamp;
  alive: number;
  sets: Record<string, { count: number; images: number[] }>;
}

const FORMAT = 1;
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
  const sets = new Map<string, { count: number; images: number[] }>();
  let alive = 0;
  for (const m of all) {
    if (m.retracted) continue;
    alive++;
    if (!m.recordset) continue;
    const s = sets.get(m.recordset) ?? { count: 0, images: [] };
    s.count++;
    if (m.image !== undefined) s.images.push(m.image);
    sets.set(m.recordset, s);
  }
  for (const s of sets.values()) s.images = [...new Set(s.images)].sort((x, y) => x - y);
  return { alive, sets };
}

function fromStored(s: Stored): ImagesIndex {
  return { alive: s.alive, sets: new Map(Object.entries(s.sets)) };
}
