// strom fixes book-counts (1126): a book downloaded whole before strom wrote a book's count of images (from a
// connector's catalogue, or after a whole book on disk) has none — it stays offered to download by hand for ever
// (core/books.ts offerable: what is missing of it never known). Found: a book its tasks still need, offered, that its
// archive lets be downloaded whole, with no count, whose images registered run 1…N with no gap (N ≥ 2,
// core/books.ts countUnknownOf). Set right on a person's word alone: its count N written (recordset.edit) — the person
// who knows another count from the archive's page writes that one instead (strom recordset edit B… --images <n>) and
// the book is no longer found. Free, kept for its undo (BOOK_COUNTS_FILE): the counts taken off where still as written.

import fs from "node:fs";
import path from "node:path";
import type { RecordSet, TreeConfig } from "./model.ts";
import { now, type Tree } from "./tree.ts";
import { bookRows } from "./books.ts";
import { knownTerms } from "./terms.ts";

/** The strom that sets them right. */
export const BOOK_COUNTS_SINCE = "1.38.0";
/** Where the fix keeps what it wrote, for its undo (sealed like the rest of quality/; travels with the research). */
export const BOOK_COUNTS_FILE = "quality/book-counts.json";

/** One book whose count would be written: which, its title and archive, and the count (its images on disk 1…N). */
export interface BookCountFix {
  recordset: string;
  title: string;
  archive?: string;
  images: number;
}

interface BookCountsFile {
  v: 1;
  /** Each time the fix wrote counts, newest last. */
  runs: { at: string; version: string; items: BookCountFix[] }[];
}

/**
 * The books offered to download whole for ever: a task still needs them (any number of tasks — the person's least
 * for offering a book, books.minTasks, never hides one), no count, their images 1…N on disk. Their archive: its record,
 * else the name strom's list of archives gives the host.
 */
export function bookCountFixes(tree: Tree): BookCountFix[] {
  const rows = bookRows(tree, 1).filter((r) => r.offer && r.download === "whole" && r.images === undefined && r.countUnknown);
  if (!rows.length) return [];
  const terms = knownTerms(tree.env);
  const named = (host: string | undefined) => (host ? terms.find((k) => k.host === host && k.name)?.name : undefined);
  return rows
    .map((r) => {
      const archive = r.archive?.name ?? named(r.downloadTerms?.host);
      return { recordset: r.id, title: r.title, ...(archive ? { archive } : {}), images: r.countUnknown!.from1to };
    })
    .sort((a, b) => a.recordset.localeCompare(b.recordset, undefined, { numeric: true }));
}

function readFile(tree: Tree): BookCountsFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...BOOK_COUNTS_FILE.split("/")), "utf8")) as Partial<BookCountsFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const fileContent = (f: BookCountsFile) => JSON.stringify(f, null, 2) + "\n";

/**
 * The records written, each in an operation of its own (recordset.edit: the history says each book), the file kept for
 * the undo and the decision with the last — one commit, by the caller. Nothing changed: the file and the decision alone.
 */
function write(tree: Tree, records: { rec: RecordSet; summary: string }[], file: BookCountsFile, config: ((c: TreeConfig) => void) | undefined, reason: string, none: string): void {
  const kept = [{ rel: BOOK_COUNTS_FILE, content: fileContent(file) }];
  if (!records.length) {
    tree.putMany([], kept, { op: "fix.decide", targets: [], summary: none }, config);
    return;
  }
  records.forEach(({ rec, summary }, i) => {
    const last = i === records.length - 1;
    tree.putMany([rec], last ? kept : [], { op: "recordset.edit", targets: [rec.id], summary, reason }, last ? config : undefined);
  });
}

/**
 * The fix: each book found has its count written — one changed since it was found (retracted, merged, a count of its
 * own) is left and counted. Inside withTreeLock.
 */
export function applyBookCounts(tree: Tree, items: BookCountFix[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; left: number } {
  const records: { rec: RecordSet; summary: string }[] = [];
  const done: BookCountFix[] = [];
  let left = 0;
  for (const it of items) {
    const was = tree.get<RecordSet>(it.recordset);
    if (!was || was.type !== "recordset" || was.retracted || was.mergedInto || (was.images !== undefined && was.images > 0)) {
      left++;
      continue;
    }
    records.push({ rec: { ...structuredClone(was), images: it.images, updated: now() }, summary: `${it.recordset} images ${it.images} (fix book-counts: its images 1–${it.images} on disk)` });
    done.push(it);
  }
  if (!done.length) return { changed: 0, records: 0, left };
  const file = readFile(tree);
  file.runs.push({ at: new Date().toISOString(), version, items: done });
  write(tree, records, file, config, "fix book-counts", "");
  return { changed: done.length, records: records.length, left };
}

/** What the fix wrote and is not undone yet. */
export function bookCountsDone(tree: Tree): BookCountFix[] {
  return readFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each count it wrote taken off — where the book's count is still the one written; one changed since is
 * left and counted. What the fix kept is emptied.
 */
export function undoBookCounts(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const items = bookCountsDone(tree).reverse();
  if (!items.length) return { restored: 0, records: 0, left: 0 };
  const records: { rec: RecordSet; summary: string }[] = [];
  let left = 0;
  for (const it of items) {
    const was = tree.get<RecordSet>(it.recordset);
    if (!was || was.retracted || was.images !== it.images || records.some((r) => r.rec.id === it.recordset)) {
      left++;
      continue;
    }
    const rec = structuredClone(was);
    delete rec.images;
    rec.updated = now();
    records.push({ rec, summary: `${it.recordset} images ${it.images} taken off (fix book-counts undone)` });
  }
  write(tree, records, { v: 1, runs: [] }, config, "fix book-counts undone", `counts of books written by the fix book-counts: nothing to put back${left ? `, ${left} changed since left` : ""} (fix book-counts undone)`);
  return { restored: records.length, records: records.length, left };
}
