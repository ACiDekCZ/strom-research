// strom fixes readers: before strom READERS_SINCE every write of "user" counted as the user's reading of a source
// (core/review.ts readersOf) — an import, the conversion of an old research, a batch, a script and an agent strom does
// not recognise all write as "user", so their sources said "read by the user" and were never offered for a reading.
// Set right once by rules: a source a person wrote by hand (one write of theirs, none of a run of many — core/readers.ts
// bulkWrites) keeps the user's reading (Source.read.user, how "earlier"); one only a run of many wrote has none from then
// on (nothing of it is changed: the writes of "user" count no more, READERS_SETTLED). Never one the user really read:
// the Strom app's transcripts that count, a reading confirmed there, a transcript typed by hand since. Free, one
// operation, kept for its undo (READERS_FIX_FILE): the undo gives those sources the user's reading back.

import fs from "node:fs";
import path from "node:path";
import type { Source, TreeConfig } from "./model.ts";
import { now, VERSION, type Tree } from "./tree.ts";
import { bulkWrites, fixedDecision, markOf, READERS_SETTLED, readersSettled, userReading } from "./readers.ts";
import { freshConfig, quiet } from "./hypolinks.ts";
import { writableUnasked } from "./integrity.ts";

/** The strom version from which a write of "user" is no reading of the user's. */
export const READERS_SINCE = "1.29.0";

/** Where the fix keeps what it changed, for its undo (sealed like the rest of quality/; travels with the research). */
export const READERS_FIX_FILE = "quality/readers.json";

/** A source whose "read by the user" came only from a run of many writes: no reader "user" any more. */
export interface ReaderFix {
  source: string;
  title: string;
  /** The first of those writes. */
  at: string;
}

/** A source a person wrote by hand: the user's reading kept (as an earlier reading). */
export interface ReaderKept {
  source: string;
  title: string;
  at: string;
}

export interface ReaderFindings {
  fixes: ReaderFix[];
  kept: ReaderKept[];
}

interface ReadersFile {
  v: 1;
  /** Each time the fix set things right, newest last. */
  runs: { at: string; version: string; items: ReaderFix[]; kept: string[] }[];
}

/** What the fix finds: nothing once the readers are set right (the marker in strom.json). */
export function readerFixes(tree: Tree): ReaderFindings {
  const out: ReaderFindings = { fixes: [], kept: [] };
  if (readersSettled(tree)) return out;
  // the app's sources and the entries of a reading never took "user" from a write (readersOf), nor one the user read
  const sources = new Map(tree.list<Source>("source").filter((s) => !s.retracted && !s.app && !s.reading && !userReading(s)).map((s) => [s.id, s]));
  if (!sources.size) return out;
  const bulk = bulkWrites(tree);
  const hand = new Map<string, string>();
  const many = new Map<string, string>();
  for (const o of tree.readOps()) {
    if (o.by !== "user" || (o.op !== "source.add" && o.op !== "source.edit")) continue;
    for (const id of o.targets) {
      if (!sources.has(id)) continue;
      const into = bulk.has(o.sig) ? many : hand;
      if (!into.has(id) || into.get(id)! > o.at) into.set(id, o.at);
    }
  }
  const byId = (a: { source: string }, b: { source: string }) => a.source.localeCompare(b.source, undefined, { numeric: true });
  for (const [id, at] of hand) out.kept.push({ source: id, title: sources.get(id)!.title, at });
  for (const [id, at] of many) if (!hand.has(id)) out.fixes.push({ source: id, title: sources.get(id)!.title, at });
  out.fixes.sort(byId);
  out.kept.sort(byId);
  return out;
}

function readFile(tree: Tree): ReadersFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...READERS_FIX_FILE.split("/")), "utf8")) as Partial<ReadersFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const fileContent = (f: ReadersFile) => JSON.stringify(f, null, 2) + "\n";

/** The marker in strom.json, with whatever else the caller changes there (the fix's decision). */
const settledWith = (config?: (c: TreeConfig) => void) => (c: TreeConfig) => {
  c.settled = [...new Set([...(c.settled ?? []), READERS_SETTLED])];
  config?.(c);
};

/**
 * The fix: the sources a person wrote by hand keep the user's reading (Source.read.user, earlier), those only a run of
 * many wrote lose it — the marker in strom.json, what it changed kept for its undo; one operation, even when nothing
 * is found (the marker alone: from then on a write of "user" is no reading). Inside withTreeLock.
 */
export function applyReaders(tree: Tree, items: ReaderFix[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; left: number } {
  const at = now();
  const found = readerFixes(tree);
  const records: Source[] = found.kept
    .map((k) => tree.get<Source>(k.source))
    .filter((s): s is Source => !!s)
    .map((s) => {
      const mark = markOf(s);
      return { ...structuredClone(s), read: { ...s.read, user: { how: "earlier" as const, at: found.kept.find((k) => k.source === s.id)!.at, ...(mark ? { txt: mark } : {}) } }, updated: at };
    });
  const done = items.filter((it) => found.fixes.some((f) => f.source === it.source));
  // nothing to set right: the marker alone, said nowhere
  if (!done.length && !records.length) {
    tree.updateConfig(settledWith(config), { op: "tree.settle", summary: "the readers of the sources: a write of \"user\" is no reading from now on (nothing to set right)" });
    return { changed: 0, records: 0, left: items.length };
  }
  const file = readFile(tree);
  file.runs.push({ at, version, items: done, kept: records.map((r) => r.id) });
  tree.putMany(
    records,
    [{ rel: READERS_FIX_FILE, content: fileContent(file) }],
    {
      op: "readers.fix",
      targets: [...done.map((d) => d.source), ...records.map((r) => r.id)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      summary: `the readers of the sources set right: ${done.length} in ${done.length + records.length} sources no more read by the user (a write of "user" alone is no reading), ${records.length} kept as the user's own (fix readers)`,
    },
    settledWith(config),
  );
  return { changed: done.length, records: records.length, left: items.length - done.length };
}

/** The sources the fix took "read by the user" from and not given back yet. */
export function readersDone(tree: Tree): ReaderFix[] {
  return readFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each source it took the user's reading from has it back (an earlier reading of the transcript as it is
 * now) — where the user has no reading of it meanwhile. One operation; what the fix kept is emptied.
 */
export function undoReaders(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const file = readFile(tree);
  if (!file.runs.some((r) => r.items.length)) return { restored: 0, records: 0, left: 0 };
  const at = now();
  const records: Source[] = [];
  let left = 0;
  for (const run of file.runs)
    for (const it of run.items) {
      const s = tree.get<Source>(it.source);
      if (!s || s.retracted || userReading(s) || records.some((r) => r.id === it.source)) {
        left++;
        continue;
      }
      const mark = markOf(s);
      records.push({ ...structuredClone(s), read: { ...s.read, user: { how: "earlier", at: it.at, ...(mark ? { txt: mark } : {}) } }, updated: at });
    }
  tree.putMany(
    records,
    [{ rel: READERS_FIX_FILE, content: fileContent({ v: 1, runs: [] }) }],
    { op: "readers.unfix", targets: records.map((r) => r.id), summary: `the readers of the sources put back: ${records.length} in ${records.length} sources read by the user again${left ? `, ${left} changed since left` : ""} (fix readers undone)` },
    config,
  );
  return { restored: records.length, records: records.length, left };
}

/**
 * Once per research, at the first start of this strom (after its backup) and at a bridge's start: the fix applied by
 * itself, its decision kept as the person's fixes are (`decision`: strom fixes undo readers puts it back) — in one
 * commit. Skipped while somebody is at work on the tree or holds its lock, while strom may not write it unasked
 * (another computer's seal, data changed outside strom), in a dry run. What it did, else undefined.
 */
export function settleReaders(tree: Tree, decision: (c: TreeConfig) => void = fixedDecision("readers", VERSION)): { changed: number; kept: number } | undefined {
  if (tree.dryRun || readersSettled(tree) || !quiet(tree)) return undefined;
  let out: { changed: number; kept: number } | undefined;
  tree.atomically(() => {
    // read afresh under the lock: another strom may have settled it meanwhile
    if (!freshConfig(tree) || readersSettled(tree) || !writableUnasked(tree)) return;
    const found = readerFixes(tree);
    const r = applyReaders(tree, found.fixes, READERS_SINCE, found.fixes.length || found.kept.length ? decision : undefined);
    tree.commit(r.changed || r.records ? `Readers of the sources set right: ${r.changed} no more read by the user, ${r.records} kept as the user's own` : "Readers of the sources: a write of the user alone is no reading from now on");
    out = { changed: r.changed, kept: r.records };
  });
  return out;
}
