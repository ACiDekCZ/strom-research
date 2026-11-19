// What a waiting task waits for in the shared inbox — derived, nothing written: images the person saves by hand into
// a folder of the inbox bring the task back, whoever registers them (the bridge watching the folder, the next session's
// start, strom media add --inbox).
//
//   - images with their numbers (strom task wait --images B…:<numbers>, Task.awaits): its folder; the task comes back
//     once all of them are registered — a part of them, it waits on and says which are missing;
//   - a site the person looks at (kind web) of a task whose `where` names one book alone: the images of that book saved
//     into its folder (inboxFolderFor), which numbers not known — any of them bring it back. A task strom 1.26 set
//     waiting so is woken the same way: nothing of it to rewrite. The book to be searched, when it is not that one
//     (core/books.ts waitTarget: the book given with --book, else the one its words name beyond its where): its folder;
//     a book still to be found (a place in words beside the book of the trail): no folder.
//
// The files of a folder are numbered by their names (the number the portal's viewer counts; a copy's suffix a file
// manager added aside, "33 2.jpg"); named otherwise (a screenshot's time, a download's own name), by their order when
// there are as many as images missing — never a file named by a number alone (B0408: "1.jpg" is image 1, not the 33
// missing); else nothing is taken and it is said what is needed. A file is taken once it has settled (not written for SETTLE_MS): a large scan
// being copied is never taken half.
//
// The folder of a book the tasks still need, with no task waiting on it (spec 105 K1.4: "one download serves them
// all"): its images are taken by the numbers in their names alone (never by their order: nothing says which images they
// are) — a portal's .jp2 of an archive whose file names count the image × N (strom's list, imageFileTimes: MZA × 10)
// counted back. The tasks of the book then read them from disk.

import fs from "node:fs";
import path from "node:path";
import type { Media, RecordSet, Repository, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { collectFiles, copyless, IMAGE_FILE_EXT, imageNumbers, inboxFolderFor, namedByNumber, numberInName, parseImageList } from "./media.ts";
import { waitKindOf } from "./waitkind.ts";
import { booksOfTask, needsBooks, waitTarget } from "./books.ts";
import { imageFileTimesOf } from "./knownterms.ts";
import { hostOf } from "./terms.ts";
import { imagesIndex } from "./mediaindex.ts";
import { runs } from "../cli/format.ts";

/** A file not written for this long has settled: it may be taken. */
export const SETTLE_MS = 3_000;

/** A task waiting for images in a folder of the shared inbox. */
export interface InboxWait {
  task: string;
  recordset: string;
  /** Its folder in the shared inbox (the name alone). */
  folder: string;
  /** The images it asked for (awaits); none: which ones is not known (a site the person looks at). */
  want?: number[];
  /** How it waits: images by their numbers, or a site the person looks at with one book. */
  by: "images" | "web";
}

/** The one book a task's `where` names (an existing record set), else none. */
export function singleBook(tree: Tree, t: Task): RecordSet | undefined {
  const ids = [...new Set(t.where.filter((w) => /^B\p{N}{4,}$/u.test(w)))];
  if (ids.length !== 1) return undefined;
  const b = tree.get<RecordSet>(ids[0]!);
  return b && !b.retracted && !b.mergedInto ? b : undefined;
}

/**
 * The book whose images saved by hand bring back a task waiting for a site the person looks at: the book it is to be
 * searched in (core/books.ts waitTarget), else the one book its where names; none when that is not known.
 */
export function webWaitBook(tree: Tree, t: Task): RecordSet | undefined {
  const target = waitTarget(tree, t);
  return target === undefined ? singleBook(tree, t) : (target ?? undefined);
}

/** What a task waits for in the shared inbox, if it does. */
export function inboxWaitOf(tree: Tree, t: Task): InboxWait | undefined {
  if (t.state !== "waiting") return undefined;
  if (t.awaits) return { task: t.id, recordset: t.awaits.recordset, folder: t.awaits.folder, want: parseImageList(t.awaits.images) ?? [], by: "images" };
  if (t.awaitsCheck || t.awaitsPermission || waitKindOf(t) !== "web") return undefined;
  const b = webWaitBook(tree, t);
  return b ? { task: t.id, recordset: b.id, folder: inboxFolderFor(b), by: "web" } : undefined;
}

/** Every task of the research waiting for images in the shared inbox. */
export function inboxWaits(tree: Tree): InboxWait[] {
  return tree.list<Task>("task").map((t) => inboxWaitOf(tree, t)).filter((w): w is InboxWait => !!w);
}

/**
 * The image numbers of a book registered in the research (a part counts: it was asked for too) — from the images' index
 * (core/mediaindex.ts: the same images, kept in .strom/cache while their folder is as it was), never every image record:
 * a long research has tens of thousands, read whole for each task waiting for images at every look of the bridge (its
 * /status, the desktop's widget every 15 s) — a second or two each time (found 2026-11-13: a bridge at ~40 % of a CPU).
 */
export function registeredImages(tree: Tree, recordset: string): Set<number> {
  return new Set(imagesIndex(tree).sets.get(recordset)?.images ?? []);
}

/** The image files lying in a folder of the inbox, in their order (as a person sorts them: 2 before 10). */
export function folderFiles(dir: string): string[] {
  let files: string[] = [];
  try {
    if (fs.existsSync(dir)) files = collectFiles([dir]).filter((f) => IMAGE_FILE_EXT.has(path.extname(f).toLowerCase()));
  } catch {
    return [];
  }
  return files.sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true }) || a.localeCompare(b));
}

/** The files of a folder still being written (changed less than SETTLE_MS ago). */
export function unsettled(files: string[], now = Date.now()): string[] {
  return files.filter((f) => {
    try {
      return now - fs.statSync(f).mtimeMs < SETTLE_MS;
    } catch {
      return true;
    }
  });
}

/** The folder of a book that tasks still need (core/books.ts), no task waiting on it — K1.4. */
export interface BookFolder {
  recordset: string;
  /** Its folder in the shared inbox (the name alone). */
  folder: string;
  /** The tasks that need the book (open, at work, put aside — those waiting wait on a folder of their own). */
  tasks: string[];
  /** By how much a portal's .jp2 names the image (imageFileTimes), when strom's list says. */
  times?: number;
}

/** By how much a portal's .jp2 names an image of this book (strom's list, imageFileTimes), when it says. */
export function bookTimes(tree: Tree, b: RecordSet | string): number | undefined {
  const book = typeof b === "string" ? tree.get<RecordSet>(b) : b;
  const url = book?.url ?? (book?.repository ? tree.get<Repository>(book.repository)?.url : undefined);
  return url ? imageFileTimesOf(hostOf(url)) : undefined;
}

/**
 * The folders of the books tasks still need that no task waits on (those are inboxWaits'), each once, by the books'
 * IDs. Nothing made: a folder the person never made has nothing to take.
 */
export function bookFolders(tree: Tree): BookFolder[] {
  const waited = new Set(inboxWaits(tree).map((w) => w.folder.normalize("NFC")));
  const by = new Map<string, BookFolder>();
  for (const t of tree.list<Task>("task")) {
    if (!needsBooks(t)) continue;
    for (const b of booksOfTask(tree, t)) {
      const folder = inboxFolderFor(b);
      if (waited.has(folder.normalize("NFC"))) continue;
      let f = by.get(b.id);
      if (!f) {
        const times = bookTimes(tree, b);
        f = { recordset: b.id, folder, tasks: [], ...(times ? { times } : {}) };
        by.set(b.id, f);
      }
      f.tasks.push(t.id);
    }
  }
  return [...by.values()].sort((a, b) => a.recordset.localeCompare(b.recordset, undefined, { numeric: true }));
}

/**
 * The image numbers of the files of a book's folder by their names alone (K1.4): a portal's .jp2 counted back by `times`
 * (one that is no multiple: its number is not known). The files with a number are taken, each as named; a file with no
 * number (or one that is no image's) is left lying — it never holds back the rest (`left`). None with a number: nothing
 * taken, and what the files need is said.
 */
export function numberBookFiles(files: string[], recordset: string, times?: number): BookNumbered {
  const all = imageNumbers(files).map((n, i) => (n === undefined || !times || path.extname(files[i]!).toLowerCase() !== ".jp2" ? n : n % times === 0 ? n / times : undefined));
  const named = files.map((file, i) => ({ file, n: all[i] })).filter((x): x is { file: string; n: number } => x.n !== undefined && x.n > 0);
  const left = files.length - named.length;
  if (named.length) return { files: named.map((x) => x.file), numbers: named.map((x) => x.n), by: "names", left };
  return {
    problem: `${left === 1 ? "a file" : `${left} files`} of ${recordset} without an image number in the name: name each by the number its viewer counts (40.jpg)`,
    code: "inbox.unnamed",
    params: { files: String(left), recordset },
  };
}

/** The files of a book's folder with a number in the name, and how many are left lying without one — or why none is taken. */
export type BookNumbered =
  | { files: string[]; numbers: number[]; by: "names"; left: number }
  | { problem: string; code: "inbox.unnamed"; params: Record<string, string> };

/** How the files of a folder are numbered, or why they cannot be taken (for the person: what is needed). */
export type Numbered =
  | { numbers: number[]; by: "names" | "order" }
  | { problem: string; code: "inbox.unnamed" | "inbox.count"; params: Record<string, string> };

/**
 * The image number of each file: by the names when they say one each (and, of images asked for, at least one of those);
 * else by their order onto the images still missing when there are as many files and none is named by a number alone
 * (B0408: "1.jpg" of a task waiting for 33 was taken for 33 — a number a person named is never overruled by the order;
 * a portal's own name or a screenshot's date and time is); else why not. `times`: a portal's .jp2 counted back
 * (numberBookFiles).
 */
export function numberFiles(files: string[], want: number[] | undefined, have: ReadonlySet<number>, recordset: string, times?: number): Numbered {
  const names = imageNumbers(files).map((n, i) => (n === undefined || !times || path.extname(files[i]!).toLowerCase() !== ".jp2" ? n : n % times === 0 ? n / times : undefined));
  const named = names.every((n): n is number => n !== undefined && n > 0);
  if (named && (!want?.length || names.some((n) => want.includes(n!)))) return { numbers: names as number[], by: "names" };
  const missing = (want ?? []).filter((n) => !have.has(n));
  if (want?.length && missing.length && files.length === missing.length && !files.some(namedByNumber)) return { numbers: missing, by: "order" };
  const said = names.filter((n): n is number => n !== undefined);
  if (!want?.length)
    return {
      problem: `${files.length === 1 ? "a file" : `${files.length} files`} of ${recordset} without an image number in the name: name each by the number its viewer counts (40.jpg)`,
      code: "inbox.unnamed",
      params: { files: String(files.length), recordset },
    };
  return {
    problem: `images ${runs(want)} of ${recordset} were asked for${missing.length && missing.length < want.length ? ` (missing ${runs(missing)})` : ""}, but the file names give ${said.length ? runs(said) : "no number"} — ${files.length === 1 ? "1 file" : `${files.length} files`} for ${missing.length || want.length} image${(missing.length || want.length) === 1 ? "" : "s"}: name each by the number its viewer counts (${(missing[0] ?? want[0])!}.jpg)`,
    code: "inbox.count",
    params: { files: String(files.length), missing: runs(missing), want: runs(want), recordset },
  };
}

/** How far a task's images saved by hand got: its folder, how many of what it asked for are there, what is missing. */
export interface InboxState {
  dir: string;
  folder: string;
  recordset: string;
  /** Of the images asked for, those registered and the files lying in the folder (at most as many as asked for). */
  have: number;
  /** How many it asked for; 0: which ones is not known (a site the person looks at). */
  want: number;
  /** The images asked for still missing (none registered, none lying there). */
  missing: number[];
  /** Files lying in the folder, not taken yet. */
  lying: number;
  /**
   * The next free image number of the book (the highest registered or lying in the folder + 1): what a file with no
   * number in its name is given for a task that does not know which images (K044) — the app offers it as said.
   */
  next: number;
  /** Why the files lying there cannot be taken (for the agent; the person's words from its code). */
  problem?: string;
  problemCode?: "inbox.unnamed" | "inbox.count";
}

/** The state of a task's folder of the shared inbox, if it waits for one. */
export function inboxState(tree: Tree, shared: string | undefined, t: Task): InboxState | undefined {
  const w = shared ? inboxWaitOf(tree, t) : undefined;
  if (!w || !shared) return undefined;
  const dir = path.join(shared, "inbox", w.folder);
  const files = folderFiles(dir);
  const reg = registeredImages(tree, w.recordset);
  const want = w.want ?? [];
  const numbered = files.length ? numberFiles(files, w.want, reg, w.recordset, bookTimes(tree, w.recordset)) : undefined;
  const lyingNums = numbered && "numbers" in numbered ? new Set(numbered.numbers) : new Set<number>();
  const missing = want.filter((n) => !reg.has(n) && !lyingNums.has(n));
  // which ones not known: the files lying there and the images the Strom app handed to it for this wait
  const have = want.length ? want.length - missing.length : files.length + handedImages(tree, t, w.recordset).length;
  return { dir, folder: w.folder, recordset: w.recordset, have, want: want.length, missing, lying: files.length, next: nextImage(reg, files), ...(numbered && "problem" in numbered ? { problem: numbered.problem, problemCode: numbered.code } : {}) };
}

/**
 * The next free image number of a book: the highest of its images registered and of the files lying in its folder
 * (only a name with one number counts: a camera's date and time names no image) + 1; none yet: 1.
 */
export function nextImage(registered: Iterable<number>, lying: string[]): number {
  let top = 0;
  for (const n of registered) if (n > top) top = n;
  for (const f of lying) {
    // (a copy's suffix a file manager added aside: "33 2.jpg" is 33)
    const stem = copyless(f);
    if ((stem.match(/\p{Nd}+/gu)?.length ?? 0) !== 1) continue;
    const n = numberInName(stem);
    if (n !== undefined && n > top) top = n;
  }
  return top + 1;
}

/** What the task asks now (its waitingOn, else what): the mark of a file handed to it for this wait (Task.files). */
export function askedNow(t: Task): string {
  const a = t.waitingOn || t.what;
  return a.length > 300 ? `${a.slice(0, 299)}…` : a;
}

/** The images of a book handed to a task for what it asks now (the Strom app's "Have the images"): their numbers. */
export function handedImages(tree: Tree, t: Task, recordset: string): number[] {
  const asked = askedNow(t);
  const out = new Set<number>();
  for (const f of t.files ?? []) {
    if (f.asked !== asked || !/^M\p{N}+$/u.test(f.input)) continue;
    const m = tree.get<Media>(f.input);
    if (m && !m.retracted && m.recordset === recordset && m.image !== undefined) out.add(m.image);
  }
  return [...out].sort((a, b) => a - b);
}

/** How the images sent for a task are numbered, or why they cannot be (the codes the bridge answers 409 with). */
export type ForTask = { numbers: number[]; by: "image" | "name" | "order" } | { code: "waiting.image-unwanted"; want: number[] } | { code: "waiting.image-unknown"; missing: number[] };

/**
 * The image numbers of `count` pictures sent for a task at once (one file, or the pages of a PDF): from `image` on when
 * the sender says it (each one asked for, else refused with what is asked); else the number in the file's name (one
 * picture, a number asked for or none asked); else, for a task that does not know which images, the next free numbers
 * of the book from `next` on (K044: a name with no number or several — a year and an act's number, a camera's date —
 * is never refused); else onto the images still missing when there are as many; else not known, with the images
 * missing to choose from (all asked for when none is missing: never an empty list).
 */
export function numbersForTask(count: number, o: { image?: number | undefined; name?: string | undefined; want?: number[] | undefined; missing: number[]; next?: number | undefined }): ForTask {
  const want = o.want ?? [];
  if (o.image !== undefined) {
    const numbers = Array.from({ length: count }, (_, i) => o.image! + i);
    if (want.length && numbers.some((n) => !want.includes(n))) return { code: "waiting.image-unwanted", want };
    return { numbers, by: "image" };
  }
  if (count === 1 && o.name) {
    const stem = o.name.normalize("NFC").replace(/\.[^.]*$/u, "");
    // only a name with one number (57, IMG_0057, kniha-00057): a screenshot's date says no image's number
    const runs = stem.match(/\p{Nd}+/gu)?.length ?? 0;
    const n = runs === 1 ? numberInName(stem) : undefined;
    if (n !== undefined && n > 0 && (!want.length || want.includes(n))) return { numbers: [n], by: "name" };
  }
  if (!want.length) {
    const from = o.next !== undefined && o.next > 0 ? o.next : 1;
    return { numbers: Array.from({ length: count }, (_, i) => from + i), by: "order" };
  }
  if (o.missing.length === count) return { numbers: [...o.missing], by: "order" };
  return { code: "waiting.image-unknown", missing: o.missing.length ? [...o.missing] : [...want] };
}
