// Which records of the research name a file by its content (an image's or an input's `sha`), without reading them
// all: whether the research has a file already is asked for each original the app sends — by the bridge before and
// as it comes, and by the strom that takes it — and a long research has tens of thousands of image records (read
// whole each time, 7 s; found 2026-11-21). So the hashes are kept in .strom/cache/sha-index.json (written only by a
// process that holds the tree's lock; one that only reads keeps it in memory) with the commit and the folders' stamps
// they were read at, and brought up to date by what changed since: the files git says the
// commits since changed (git diff), and the files not committed (git status), with those not committed last time.
// Anything that fails — no file, another format, a commit git no longer has (a reset, a gc) — and it is made again
// from the records. It is only a help: what it names is read and checked (the record's own sha), and what this
// process holds or wrote itself is looked at too, so a second file of the same content in one hold of the lock is
// the first one's (never a second record).

import fs from "node:fs";
import path from "node:path";
import type { Input, Media, RecordType } from "./model.ts";
import { RECORD_TYPES } from "./model.ts";
import { readJson, readJsonIfExists, writeFileAtomic, type HeldError } from "./json.ts";
import { headCommit, heldStatus, runGit } from "./git.ts";
import { STABLE_MS } from "./mediaindex.ts";
import type { Tree } from "./tree.ts";

type ShaType = "media" | "input";
const TYPES: readonly ShaType[] = ["media", "input"];
const FORMAT = 1;

interface Stored {
  v: number;
  /** The commit the entries were brought up to (null: none yet). */
  head: string | null;
  /** The folders' modification times then (ns); empty: changed a moment before, not to be trusted. */
  stamps: Record<string, string>;
  /** Files not committed then (read again next time: they may have gone or changed). */
  dirty: string[];
  /** sha → the IDs of the records naming it. */
  entries: Record<string, string[]>;
}

/** The index of a research in memory: the stored form and the way back from an ID to its sha. */
interface Index {
  head: string | null;
  stamps: Record<string, string>;
  dirty: string[];
  bySha: Map<string, string[]>;
  byId: Map<string, string>;
}

/** The index of each research this process has looked at (a bridge asks again and again): never parsed twice. */
const indexes = new Map<string, Index>();
/** The trees whose index was checked against the files since they last forgot what they read (Tree.epoch). */
const checked = new WeakMap<Tree, number>();

export function shaIndexFile(root: string): string {
  return path.join(root, ".strom", "cache", "sha-index.json");
}

const dirOf = (type: ShaType) => `data/${RECORD_TYPES[type].dir}`;
const DIRS = TYPES.map(dirOf);

/** The ID a record's file is of (data/<dir>/<id>.json), undefined for anything else. */
function idOfPath(rel: string): string | undefined {
  const p = rel.replace(/\\/g, "/");
  for (const d of DIRS) {
    if (!p.startsWith(`${d}/`)) continue;
    const name = p.slice(d.length + 1);
    return !name.includes("/") && name.endsWith(".json") ? name.slice(0, -5) : undefined;
  }
  return undefined;
}

function drop(index: Index, id: string): void {
  const sha = index.byId.get(id);
  if (sha === undefined) return;
  index.byId.delete(id);
  const ids = index.bySha.get(sha)?.filter((x) => x !== id);
  if (ids?.length) index.bySha.set(sha, ids);
  else index.bySha.delete(sha);
}

function add(index: Index, id: string, sha: unknown): void {
  drop(index, id);
  if (typeof sha !== "string" || !sha) return;
  index.byId.set(id, sha);
  const ids = index.bySha.get(sha);
  if (ids) ids.push(id);
  else index.bySha.set(sha, [id]);
}

/** A record's file read again: its sha now, or none when it is gone or cannot be read (tree.list skips it too). */
function reread(index: Index, root: string, rel: string): void {
  const id = idOfPath(rel);
  if (!id) return;
  let rec: { sha?: unknown } | undefined;
  try {
    rec = readJson<{ sha?: unknown }>(path.join(root, ...rel.split("/")));
  } catch (e) {
    // one another program holds (Windows): no answer without it, as tree.list
    if ((e as HeldError).heldFile) throw e;
    rec = undefined;
  }
  if (rec && typeof rec === "object") add(index, id, rec.sha);
  else drop(index, id);
}

/** Each folder's modification time (ns), and whether all changed long enough ago to be trusted to it. */
function stampsOf(root: string): { stamps: Record<string, string>; stable: boolean } {
  const stamps: Record<string, string> = {};
  let stable = true;
  for (const d of DIRS) {
    try {
      const st = fs.statSync(path.join(root, ...d.split("/")), { bigint: true });
      stamps[d] = String(st.mtimeNs);
      if (Date.now() - Number(st.mtimeNs / 1_000_000n) < STABLE_MS) stable = false;
    } catch {
      stamps[d] = "none";
    }
  }
  return { stamps, stable };
}

const sameStamps = (a: Record<string, string>, b: Record<string, string>) => DIRS.every((d) => a[d] !== undefined && a[d] === b[d]);

/** git's words split (-z), each path once; a rename's or copy's old path too. */
function changedPaths(root: string, args: string[], porcelain: boolean, said?: string[]): string[] {
  let items = said;
  if (!items) {
    const r = runGit(root, args);
    if (r.status !== 0) throw new Error(`git ${args[0]} ended with ${r.status}`);
    items = r.stdout.split("\0").filter(Boolean);
  }
  if (!porcelain) return items;
  const out: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    out.push(item.slice(3));
    if (item[0] === "R" || item[0] === "C") {
      const from = items[++i];
      if (from) out.push(from);
    }
  }
  return out;
}

/**
 * What is not committed in the records' folders: what git said under this hold of the lock already (with what this
 * command wrote since, so a write taken back is read again too), else asked now.
 */
function notCommitted(root: string, held: Tree | undefined): string[] {
  const said = held ? heldStatus(root, DIRS) : undefined;
  const paths = changedPaths(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...DIRS], true, said);
  if (!said || !held) return paths;
  const own = held.touchedFiles().filter((p) => DIRS.some((d) => p.startsWith(`${d}/`)));
  return [...new Set([...paths, ...own])];
}

/** Made from the records themselves: every file of both folders read once. */
function build(root: string, held: Tree | undefined): Index {
  const head = headCommit(root) ?? null;
  const { stamps, stable } = stampsOf(root);
  const index: Index = { head, stamps: stable ? stamps : {}, dirty: [], bySha: new Map(), byId: new Map() };
  for (const d of DIRS) {
    const dir = path.join(root, ...d.split("/"));
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) if (f.endsWith(".json")) reread(index, root, `${d}/${f}`);
  }
  try {
    index.dirty = notCommitted(root, held);
  } catch {
    // no git to ask: trusted to nothing, made again next time
    index.head = null;
    index.stamps = {};
  }
  return index;
}

function fromStored(s: Stored | undefined): Index | undefined {
  if (!s || s.v !== FORMAT || typeof s.entries !== "object" || !s.entries || !Array.isArray(s.dirty) || typeof s.stamps !== "object" || !s.stamps) return undefined;
  const index: Index = { head: typeof s.head === "string" ? s.head : null, stamps: s.stamps, dirty: s.dirty.filter((x) => typeof x === "string"), bySha: new Map(), byId: new Map() };
  for (const [sha, ids] of Object.entries(s.entries)) {
    if (!Array.isArray(ids)) return undefined;
    for (const id of ids) if (typeof id === "string") add(index, id, sha);
  }
  return index;
}

/** The researches whose index in memory is newer than the one kept in .strom/cache (read by a process without the lock). */
const unsaved = new Set<string>();

/**
 * Kept in .strom/cache only by a process that holds the tree's lock (it writes into the research anyway): one that only
 * reads (the bridge answering the app, the warm writer reading ahead) keeps it in memory and writes nothing — and never
 * where the research's .strom is not (deleted: no folder made again).
 */
function save(root: string, index: Index, held: Tree | undefined): void {
  if (!held || !fs.existsSync(path.join(root, ".strom"))) {
    unsaved.add(root);
    return;
  }
  unsaved.delete(root);
  const stored: Stored = { v: FORMAT, head: index.head, stamps: index.stamps, dirty: index.dirty, entries: Object.fromEntries(index.bySha) };
  try {
    writeFileAtomic(shaIndexFile(root), JSON.stringify(stored));
  } catch {
    // a folder that cannot be written: the index is only a help
  }
}

/**
 * The index brought up to the files as they are now: nothing to do while the commit and the folders' stamps are as
 * they were; else the files changed since read again; anything failing — made again from the records.
 */
function upToDate(root: string, held: Tree | undefined): Index {
  let index = indexes.get(root);
  if (!index) {
    try {
      index = fromStored(readJsonIfExists<Stored>(shaIndexFile(root)));
    } catch {
      index = undefined; // unreadable: made again
    }
  }
  if (index) {
    try {
      const head = headCommit(root) ?? null;
      const { stamps, stable } = stampsOf(root);
      if (index.head !== null && head === index.head && sameStamps(index.stamps, stamps)) {
        indexes.set(root, index);
        if (held && unsaved.has(root)) save(root, index, held);
        return index;
      }
      if (index.head === null || head === null) throw new Error("no commit to go from");
      const again = new Set(index.dirty);
      if (head !== index.head) for (const p of changedPaths(root, ["diff", "--name-only", "-z", "--no-renames", index.head, head, "--", ...DIRS], false)) again.add(p);
      const dirty = notCommitted(root, held);
      for (const p of dirty) again.add(p);
      for (const p of again) reread(index, root, p);
      index.head = head;
      index.stamps = stable ? stamps : {};
      index.dirty = dirty;
      indexes.set(root, index);
      save(root, index, held);
      return index;
    } catch (e) {
      if ((e as HeldError).heldFile) throw e;
      // made again below
    }
  }
  index = build(root, held);
  indexes.set(root, index);
  save(root, index, held);
  return index;
}

/** The index of this tree, checked against the files once after the tree last forgot what it read (the lock taken). */
function indexOf(tree: Tree): Index {
  const held = indexes.get(tree.root);
  if (held && checked.get(tree) === tree.epoch) return held;
  const index = upToDate(tree.root, tree.holdsLock ? tree : undefined);
  checked.set(tree, tree.epoch);
  return index;
}

const fileOrder = (a: string, b: string) => {
  const x = `${a}.json`;
  const y = `${b}.json`;
  return x < y ? -1 : x > y ? 1 : 0;
};

/**
 * The records of a type naming this content (their `sha`), in the order tree.list gives them — as tree.list would
 * find them, without reading all the records: those the index names and those this process holds, each read and
 * checked. Retracted ones too: the caller says which count.
 */
export function recordsBySha<T extends Media | Input>(tree: Tree, type: ShaType, sha: string): T[] {
  if (tree.loaded(type)) return tree.list<T>(type).filter((x) => x.sha === sha);
  const prefix = RECORD_TYPES[type].prefix;
  const ids = new Set((indexOf(tree).bySha.get(sha) ?? []).filter((id) => id.startsWith(prefix)));
  for (const rec of tree.heldRecords<T>(type as RecordType)) if (rec.sha === sha) ids.add(rec.id);
  const out: T[] = [];
  for (const id of [...ids].sort(fileOrder)) {
    const rec = tree.get<T>(id);
    if (rec && rec.type === type && rec.sha === sha) out.push(rec);
  }
  return out;
}

/** Forget the indexes held in memory (a test that changes the files under a process that keeps them). */
export function forgetShaIndexes(): void {
  indexes.clear();
  unsaved.clear();
}
