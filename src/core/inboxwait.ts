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
// manager added aside, "33 2.jpg") — only a number the name gives unambiguously (personNumbers: one number, or one
// zero-padded counter among others; two numbers and no counter: not known); named with no number (a screenshot's date
// and time, a name with none), by their order when there are as many as images missing — never when any file of the
// batch has a number of its own (B0408: "1.jpg" is image 1, not the 33 missing); else nothing is taken and it is said
// what is needed. A folder is taken once the whole batch has settled (folderBusy): no file written for SETTLE_MS, no
// browser's download still running in it (.crdownload, .part, Safari's .download) — a large scan being copied, a batch
// half downloaded, is never taken half.
//
// The folder of a book the tasks still need, with no task waiting on it (spec 105 K1.4: "one download serves them
// all"): its images are taken by the numbers in their names alone (never by their order: nothing says which images they
// are) — a portal's .jp2 of an archive whose file names count the image × N (strom's list, imageFileTimes: MZA × 10)
// counted back. The tasks of the book then read them from disk.

import fs from "node:fs";
import path from "node:path";
import type { Media, RecordSet, Repository, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { collectFiles, copyless, IMAGE_FILE_EXT, inboxFolderFor, numberInName, parseImageList } from "./media.ts";
import { waitKindOf } from "./waitkind.ts";
import { booksOfTask, needsBooks, waitTarget } from "./books.ts";
import { imageFileTimesOf } from "./knownterms.ts";
import { hostOf } from "./terms.ts";
import { imagesIndex } from "./mediaindex.ts";
import { runs } from "../cli/format.ts";
import { entriesOf, sheetNamed, type Entries } from "./scannames.ts";
import { settlesAt } from "./inboxsettle.ts";

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

/** The files of a folder still being written (changed less than SETTLE_MS ago; empty, a browser's placeholder). */
export function unsettled(files: string[], now = Date.now()): string[] {
  return files.filter((f) => {
    try {
      const st = fs.statSync(f);
      return now - st.mtimeMs < SETTLE_MS || (st.size === 0 && now - st.mtimeMs < STALLED_MS);
    } catch {
      return true;
    }
  });
}

/** A browser's download not finished yet: Chrome's .crdownload, Firefox's .part, Safari's .download (a folder), a .tmp. */
export const DOWNLOADING = /\.(?:crdownload|part|partial|download|tmp)$/iu;

/** A download not written to for this long has stopped (a browser's failed or paused download): not waited for. */
export const STALLED_MS = 60_000;

/**
 * The downloads a browser is still writing into a folder (DOWNLOADING; Safari's is a folder, its file inside): those
 * written to within STALLED_MS — one stopped long ago holds nothing back. Their names.
 */
export function downloadsIn(dir: string, now = Date.now()): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((name) => {
    if (!DOWNLOADING.test(name.normalize("NFC"))) return false;
    const p = path.join(dir, name);
    try {
      let at = fs.statSync(p).mtimeMs;
      // a bundle (Safari): what is written is inside it
      if (fs.statSync(p).isDirectory()) for (const f of collectFiles([p])) at = Math.max(at, fs.statSync(f).mtimeMs);
      return now - at < STALLED_MS;
    } catch {
      return false;
    }
  });
}

/**
 * How many things of a folder are still being written: its files not settled and the browser's downloads running in
 * it (B0408: a batch half downloaded is never taken — the first file settled while the rest still came). 0: taken.
 */
export function folderBusy(dir: string, files: string[], now = Date.now()): number {
  return unsettled(files, now).length + downloadsIn(dir, now).length;
}

/**
 * The image number each file's name gives unambiguously (B0408): a copy's suffix aside (copyless), one group of digits
 * ("33", "IMG_0057", "snímek 8"), else the one zero-padded counter of three digits at least among other numbers (a
 * portal's "…_00141_sign-4411.jpg"); two numbers and no such counter ("1784 33", a screenshot's date and time "2026-11-04
 * 10.07"): not known.
 */
export function personNumbers(files: string[], want?: readonly number[]): (number | undefined)[] {
  return readNumbers(files, want).numbers;
}

/**
 * A date in a name (a screenshot's, a camera's: "2026-11-04 10.07", "4.11.2026", "IMG_20261104_100723"): its numbers
 * are never an image's — of such a name only what was read before (one group, one zero-padded counter).
 */
const DATED = [
  /(?<!\p{Nd})(?:19|20)[0-9]{2}([-._ ])(?:0?[1-9]|1[0-2])\1(?:0?[1-9]|[12][0-9]|3[01])(?!\p{Nd})/u,
  /(?<!\p{Nd})(?:0?[1-9]|[12][0-9]|3[01])([-._ ])(?:0?[1-9]|1[0-2])\1(?:19|20)[0-9]{2}(?!\p{Nd})/u,
  /(?<!\p{Nd})(?:19|20)[0-9]{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01])(?!\p{Nd})/u,
];

/** Four digits that look like a year (1500–2099): of a name with other numbers too, not taken by rule 5 when which images is not known. */
const YEAR = /^(?:1[5-9]|20)[0-9]{2}$/u;

/** The numbers of a folder's files read from their names, and the files whose name gives two images asked for. */
export interface ReadNumbers {
  numbers: (number | undefined)[];
  /** A name with two or more numbers of the images asked for ("0012_0236.jpg" of a task waiting for 12 and 236): not guessed. */
  ambiguous: { file: string; numbers: number[] }[];
}

/**
 * The image number each file's name gives (B0408; 1123: a portal's "__0236.jpg", "Lhota_11__125.jpg"), a copy's
 * suffix aside (copyless) — the first rule that gives one, in this order:
 *   1. one group of digits ("33", "IMG_0057", "snímek 8", "__0236"), leading zeros dropped;
 *   2. of several groups, the one number that is an image asked for (`want`): "CZ-SOA_1784_0236", "fond12_kniha3_236"
 *      of a task waiting for 236 — two numbers asked for in one name ("0012_0236" waiting for 12 and 236) are not
 *      guessed: said (`ambiguous`);
 *   3. the place of the group that changes from file to file of the folder (all with as many groups; of images asked
 *      for, each one of them): "Lhota_11__025", "Lhota_11__125" — the portal pads to three digits only;
 *   4. the one zero-padded counter of three digits at least among other numbers (a portal's "…_00141_sign-4411.jpg");
 *   5. the last number before the extension — an image asked for, or any when which ones is not known but one that
 *      looks like a year (YEAR: "33 1784" is left lying, said what it needs).
 * A name with a date (DATED: a screenshot's "2026-11-04 10.07") only by 1 and 4; digits of another script: not read.
 */
export function readNumbers(files: string[], want?: readonly number[]): ReadNumbers {
  const wanted = new Set(want ?? []);
  const known = wanted.size > 0;
  const asked = (n: number) => !known || wanted.has(n);
  const read = files.map((f) => {
    const stem = copyless(f);
    // a name that is a range of entries ("001-004.jpg", 141 K1.2): never one image's number
    const groups = entriesOf(f) ? [] : (stem.match(/\p{Nd}+/gu) ?? []);
    // digits of another script: not read as a number
    return { groups: groups.every((g) => /^[0-9]+$/u.test(g)) ? groups : [], dated: DATED.some((d) => d.test(stem)) };
  });
  const ambiguous: ReadNumbers["ambiguous"] = [];
  const unsure = new Set<number>();
  const numbers: (number | undefined)[] = read.map(({ groups, dated }, i) => {
    if (groups.length === 1) return Number(groups[0]);
    if (groups.length < 2 || dated || !known) return undefined;
    const hits = [...new Set(groups.map(Number).filter((n) => wanted.has(n)))];
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      ambiguous.push({ file: files[i]!, numbers: hits.sort((a, b) => a - b) });
      unsure.add(i);
    }
    return undefined;
  });
  // 3. the group that changes from file to file of the folder (as imageNumbers does for a download)
  const many = read.map((r, i) => i).filter((i) => read[i]!.groups.length > 1 && !read[i]!.dated);
  const n = read[many[0]!]?.groups.length ?? 0;
  if (many.length > 1 && many.every((i) => read[i]!.groups.length === n)) {
    const varying = [...Array(n).keys()].filter((k) => new Set(many.map((i) => Number(read[i]!.groups[k]))).size > 1);
    const k = varying.at(-1);
    if (k !== undefined && many.every((i) => asked(Number(read[i]!.groups[k]))))
      for (const i of many) if (numbers[i] === undefined && !unsure.has(i)) numbers[i] = Number(read[i]!.groups[k]);
  }
  read.forEach(({ groups, dated }, i) => {
    if (numbers[i] !== undefined || unsure.has(i) || groups.length < 2) return;
    // 4. a counter of three digits at least (a date's "04", a time's "07" are no counter)
    const padded = groups.filter((g) => g.length > 2 && g.startsWith("0"));
    if (padded.length === 1) numbers[i] = Number(padded[0]);
    // 5. the last number before the extension (Milan, 1123) — never of a date; which images not known, never one that
    // looks like a year among other numbers ("33 1784", "kniha_33_1784": not guessed, it lies there and says why)
    else if (!dated && asked(Number(groups.at(-1))) && (known || !YEAR.test(groups.at(-1)!))) numbers[i] = Number(groups.at(-1));
  });
  return { numbers, ambiguous };
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
 * number (or one that is no image's: 000.jpg) is left lying — it never holds back the rest (`left`). None with a number:
 * nothing taken, nothing said (spec 141 K1.1, K2.2: a file the person left there on purpose — said once when its task
 * came back, never again at every look of the bridge or a session, never advice to rename it).
 */
export function numberBookFiles(files: string[], _recordset: string, times?: number): BookNumbered {
  const all = personNumbers(files).map((n, i) => (n === undefined || !times || path.extname(files[i]!).toLowerCase() !== ".jp2" ? n : n % times === 0 ? n / times : undefined));
  const named = files.map((file, i) => ({ file, n: all[i] })).filter((x): x is { file: string; n: number } => x.n !== undefined && x.n > 0);
  return { files: named.map((x) => x.file), numbers: named.map((x) => x.n), by: "names", left: files.length - named.length };
}

/** The files of a book's folder with a number in the name (none: nothing to take), and how many are left lying without one. */
export type BookNumbered = { files: string[]; numbers: number[]; by: "names"; left: number };

/** How the files of a folder are numbered, or why they cannot be taken (for the person: what is needed). */
export type Numbered =
  | {
      numbers: number[];
      /** names: each by its name; order: onto the images missing; folder: the folder's order, once it settled (K1.3). */
      by: "names" | "order" | "folder";
      /** The files taken (the numbers', in their order) when some are left lying — else all of them. */
      files?: string[];
      /** Files left lying, not taken: their names give no image's number (141 K1.1) — never holding back the rest. */
      left?: LeftFile[];
      /** Of `by: folder`: the entries each file's name gives ("001-004.jpg"), where it gives them. */
      entries?: (Entries | undefined)[];
    }
  /** Named not by the images' numbers (entries, no number): taken in the folder's order once it settled (inboxsettle.ts). */
  | { later: true }
  | { problem: string; code: "inbox.unnamed" | "inbox.count"; params: Record<string, string> };

/** A file left lying in a task's folder, and why: its name gives 0 (no image's), two images asked for, or no number. */
export interface LeftFile {
  file: string;
  why: "zero" | "two" | "none";
}

/** The highest number of `ns`, 0 when none. */
const top = (ns: Iterable<number>): number => {
  let t = 0;
  for (const n of ns) if (n > t) t = n;
  return t;
};

/**
 * The image number of each file (141, K053), as the folder's names say it:
 *   - files named by images' numbers (readNumbers; a portal's .jp2 counted back by `times`), one of them asked for or
 *     which ones not known: each taken by its number; a file of the batch whose name gives 0 ("000.jpg"), two images
 *     asked for, or no number is left lying beside them, said (`left`), never holding back the rest;
 *   - none named so, as many files as images missing: onto them in their order (a screenshot's date and time is no
 *     number);
 *   - a name that is a range of entries ("001-004.jpg": named by the entries, never one image's number), numbers none
 *     of which is asked for (another count than the viewer's: a number in a name is never overruled by the order,
 *     B0408), or no number and not as many as missing, or which images not known: none is put onto an image asked for — `later` until the
 *     folder settled (`quiet`: nothing saved for QUIET_MS, core/inboxsettle.ts), then all of them in the folder's
 *     order as the next numbers of the book above every one registered or asked for (`by: folder`, with their
 *     entries): what each is, the agent reads off them;
 *   - one file alone whose name gives two images asked for: not guessed, said (1123).
 */
export function numberFiles(files: string[], want: number[] | undefined, have: ReadonlySet<number>, recordset: string, times?: number, o: { quiet?: boolean } = {}): Numbered {
  const { numbers: own, ambiguous } = readNumbers(files, want);
  const entries = files.map((f) => entriesOf(f));
  const names = own.map((n, i) => (n === undefined || !times || path.extname(files[i]!).toLowerCase() !== ".jp2" ? n : n % times === 0 ? n / times : undefined));
  const two = new Set(ambiguous.map((a) => a.file));
  const missing = (want ?? []).filter((n) => !have.has(n));
  const all = files.map((_, i) => i);
  const left = (keep: number[]): LeftFile[] =>
    files.flatMap((file, i) => (keep.includes(i) ? [] : [{ file, why: names[i] === 0 ? ("zero" as const) : two.has(file) ? ("two" as const) : ("none" as const) }]));
  // of these files, the rest left lying
  const taking = (keep: number[], numbers: number[], by: "names" | "order" | "folder", more: { entries?: (Entries | undefined)[] } = {}): Numbered =>
    keep.length === files.length ? { numbers, by, ...more } : { numbers, by, files: keep.map((i) => files[i]!), left: left(keep), ...more };
  // the folder's order once it settled: the next numbers of the book above every one registered or asked for
  const folder = (keep: number[]): Numbered => {
    if (!o.quiet) return { later: true };
    const from = top([...have, ...(want ?? [])]) + 1;
    return taking(keep, keep.map((_, k) => from + k), "folder", entries.some(Boolean) ? { entries: keep.map((i) => entries[i]) } : {});
  };
  // named by the entries: the folder's order once it settled, every file of it
  if (entries.some(Boolean)) return folder(all);
  const named = all.filter((i) => names[i] !== undefined && names[i]! > 0);
  // named by numbers, one of them an image asked for (or which ones not known): each by its name
  // (or another sheet of an image registered already, "7a.jpg": told by its content, K1.4)
  if (named.length && (!want?.length || named.some((i) => want.includes(names[i]!) || (have.has(names[i]!) && sheetNamed(files[i]!))))) return taking(named, named.map((i) => names[i]!), "names");
  // numbers none of which is an image asked for (another count than the viewer's, "kniha-00090.jpg" for 9, "1.jpg" for
  // 33): never put onto the images asked for (B0408), never registered under numbers the viewer may not mean — a foreign
  // scheme, in the folder's order once it settled
  if (named.length) return folder(all);
  // a name with two of the images asked for, nothing else there: not guessed, said with the file (1123)
  const lone = ambiguous[0];
  if (lone && ambiguous.length === files.length)
    return {
      problem: `${path.basename(lone.file)}: its name gives ${runs(lone.numbers)}, ${lone.numbers.length} of the images of ${recordset} asked for — not guessed: name it by the one it is (${lone.numbers.at(-1)!}.jpg)`,
      code: "inbox.count",
      params: { files: String(files.length), missing: runs(missing), want: runs(want ?? []), recordset, ambiguous: path.basename(lone.file), numbers: runs(lone.numbers), n: String(lone.numbers.at(-1)!) },
    };
  // what gives 0 or two images asked for lies there; the rest — no number in any name — by the order
  const rest = all.filter((i) => names[i] === undefined && !two.has(files[i]!));
  if (!rest.length) return taking([], [], "names");
  if (missing.length && rest.length === missing.length) return taking(rest, missing, "order");
  return folder(rest);
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
  /** The file whose name gives two of the images asked for (not guessed, 1123) — with `problem`. */
  ambiguous?: string;
  /** One of the images that name gives, for the example of what it is named by (the agent's problem names the same one). */
  ambiguousNumber?: number;
  /**
   * The files lying there are named not by the images' numbers (the entries on them, not as many as missing; spec 141
   * K1.3): taken in the folder's order once nothing more is saved — about this time (ISO).
   */
  waitsUntil?: string;
  /** Files lying there that are not taken: their names give no image's number (000.jpg; K1.1). */
  left?: string[];
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
  const until = numbered && "later" in numbered ? settlesAt(tree, dir, files, inboxWaits(tree).filter((x) => x.folder.normalize("NFC") === w.folder.normalize("NFC"))) : undefined;
  const left = numbered && "left" in numbered ? (numbered.left ?? []).map((l) => path.basename(l.file).normalize("NFC")) : [];
  const lyingNums = numbered && "numbers" in numbered ? new Set(numbered.numbers) : new Set<number>();
  const missing = want.filter((n) => !reg.has(n) && !lyingNums.has(n));
  // which ones not known: the files lying there and the images the Strom app handed to it for this wait
  const have = want.length ? want.length - missing.length : files.length + handedImages(tree, t, w.recordset).length;
  return { dir, folder: w.folder, recordset: w.recordset, have, want: want.length, missing, lying: files.length, next: nextImage(reg, files), ...(numbered && "problem" in numbered ? { problem: numbered.problem, problemCode: numbered.code, ...(numbered.params.ambiguous ? { ambiguous: numbered.params.ambiguous, ambiguousNumber: Number(numbered.params.n) } : {}) } : {}), ...(until ? { waitsUntil: new Date(until).toISOString() } : {}), ...(left.length ? { left } : {}) };
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
    // only a name with one number (57, IMG_0057, kniha-00057): a screenshot's date says no image's number; of images
    // asked for, as a folder's files are read (readNumbers: "Lhota_11__125" of a task waiting for 125)
    const runs = stem.match(/\p{Nd}+/gu)?.length ?? 0;
    const n = want.length ? readNumbers([o.name], want).numbers[0] : runs === 1 ? numberInName(stem) : undefined;
    if (n !== undefined && n > 0 && (!want.length || want.includes(n))) return { numbers: [n], by: "name" };
  }
  if (!want.length) {
    const from = o.next !== undefined && o.next > 0 ? o.next : 1;
    return { numbers: Array.from({ length: count }, (_, i) => from + i), by: "order" };
  }
  if (o.missing.length === count) return { numbers: [...o.missing], by: "order" };
  return { code: "waiting.image-unknown", missing: o.missing.length ? [...o.missing] : [...want] };
}

/** The name a file of the inbox is set aside under (commands/media.ts takeFiles): its name, then what it is. */
const ASIDE = /^(.+)\.(same-as|other-than)-(M\p{N}+)$/u;

/**
 * A file of a book's folder of the inbox set aside, not taken (B0408, B0374) — a question for the user until it is
 * answered (strom media aside): `same`, the same file as the image `media` (registered under another number); `other`,
 * another scan than `media`, image `image` registered already.
 */
export interface AsideFile {
  folder: string;
  /** Its name as it lies in the folder now. */
  file: string;
  /** Its path. */
  path: string;
  /** The name it was saved under. */
  name: string;
  recordset: string;
  /** The image number it was saved for (its name's). */
  image?: number;
  kind: "same" | "other";
  media: string;
  /** When it was saved (the file's time). */
  at: string;
}

/**
 * The files set aside in the folders of the research's books (only of a book of this research: the inbox is every
 * research's), newest first — derived from the files themselves, nothing written: a file taken away is no question.
 */
export function asideFiles(tree: Tree, shared: string | undefined): AsideFile[] {
  if (!shared) return [];
  const inbox = path.join(shared, "inbox");
  let folders: string[];
  try {
    folders = fs.readdirSync(inbox);
  } catch {
    return [];
  }
  const books = new Map(tree.list<RecordSet>("recordset").filter((b) => !b.retracted && !b.mergedInto).map((b) => [inboxFolderFor(b).normalize("NFC"), b.id]));
  const out: AsideFile[] = [];
  for (const folder of folders) {
    const recordset = books.get(folder.normalize("NFC"));
    if (!recordset) continue;
    let names: string[];
    try {
      names = fs.readdirSync(path.join(inbox, folder));
    } catch {
      continue;
    }
    for (const file of names) {
      const m = ASIDE.exec(file.normalize("NFC"));
      if (!m) continue;
      const media = tree.get<Media>(m[3]!);
      if (!media || media.retracted) continue;
      const p = path.join(inbox, folder, file);
      let at: string;
      try {
        const st = fs.statSync(p);
        if (!st.isFile()) continue;
        at = st.mtime.toISOString();
      } catch {
        continue;
      }
      const image = personNumbers([m[1]!])[0];
      out.push({ folder, file, path: p, name: m[1]!, recordset, ...(image !== undefined ? { image } : {}), kind: m[2] === "same-as" ? "same" : "other", media: media.id, at });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at) || a.file.localeCompare(b.file));
}
