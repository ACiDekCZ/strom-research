// What a waiting task waits for in the shared inbox — derived, nothing written: images the person saves by hand into
// a folder of the inbox bring the task back, whoever registers them (the bridge watching the folder, the next session's
// start, strom media add --inbox).
//
//   - images with their numbers (strom task wait --images B…:<numbers>, Task.awaits): its folder; the task comes back
//     once all of them are registered — a part of them, it waits on and says which are missing;
//   - a site the person looks at (kind web) of a task whose `where` names one book alone: the images of that book saved
//     into its folder (inboxFolderFor), which numbers not known — any of them bring it back. A task strom 1.26 set
//     waiting so is woken the same way: nothing of it to rewrite.
//
// The files of a folder are numbered by their names (the number the portal's viewer counts); named otherwise (a
// screenshot's time, a download's own name), by their order when there are as many as images missing; else nothing is
// taken and it is said what is needed. A file is taken once it has settled (not written for SETTLE_MS): a large scan
// being copied is never taken half.

import fs from "node:fs";
import path from "node:path";
import type { Media, RecordSet, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { collectFiles, IMAGE_FILE_EXT, imageNumbers, inboxFolderFor, numberInName, parseImageList } from "./media.ts";
import { waitKindOf } from "./waitkind.ts";
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

/** What a task waits for in the shared inbox, if it does. */
export function inboxWaitOf(tree: Tree, t: Task): InboxWait | undefined {
  if (t.state !== "waiting") return undefined;
  if (t.awaits) return { task: t.id, recordset: t.awaits.recordset, folder: t.awaits.folder, want: parseImageList(t.awaits.images) ?? [], by: "images" };
  if (t.awaitsCheck || t.awaitsPermission || waitKindOf(t) !== "web") return undefined;
  const b = singleBook(tree, t);
  return b ? { task: t.id, recordset: b.id, folder: inboxFolderFor(b), by: "web" } : undefined;
}

/** Every task of the research waiting for images in the shared inbox. */
export function inboxWaits(tree: Tree): InboxWait[] {
  return tree.list<Task>("task").map((t) => inboxWaitOf(tree, t)).filter((w): w is InboxWait => !!w);
}

/** The image numbers of a book registered in the research (a part counts: it was asked for too). */
export function registeredImages(tree: Tree, recordset: string): Set<number> {
  return new Set(tree.list<Media>("media").filter((m) => !m.retracted && m.recordset === recordset && m.image !== undefined).map((m) => m.image!));
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

/** How the files of a folder are numbered, or why they cannot be taken (for the person: what is needed). */
export type Numbered =
  | { numbers: number[]; by: "names" | "order" }
  | { problem: string; code: "inbox.unnamed" | "inbox.count"; params: Record<string, string> };

/**
 * The image number of each file: by the names when they say one each (and, of images asked for, at least one of those);
 * else by their order onto the images still missing when there are as many files; else why not.
 */
export function numberFiles(files: string[], want: number[] | undefined, have: ReadonlySet<number>, recordset: string): Numbered {
  const names = imageNumbers(files);
  const named = names.every((n): n is number => n !== undefined && n > 0);
  if (named && (!want?.length || names.some((n) => want.includes(n!)))) return { numbers: names as number[], by: "names" };
  const missing = (want ?? []).filter((n) => !have.has(n));
  if (want?.length && missing.length && files.length === missing.length) return { numbers: missing, by: "order" };
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
  const numbered = files.length ? numberFiles(files, w.want, reg, w.recordset) : undefined;
  const lyingNums = numbered && "numbers" in numbered ? new Set(numbered.numbers) : new Set<number>();
  const missing = want.filter((n) => !reg.has(n) && !lyingNums.has(n));
  // which ones not known: the files lying there and the images the Strom app handed to it for this wait
  const have = want.length ? want.length - missing.length : files.length + handedImages(tree, t, w.recordset).length;
  return { dir, folder: w.folder, recordset: w.recordset, have, want: want.length, missing, lying: files.length, ...(numbered && "problem" in numbered ? { problem: numbered.problem, problemCode: numbered.code } : {}) };
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
 * picture, a number asked for or none asked); else onto the images still missing when there are as many; else not known.
 */
export function numbersForTask(count: number, o: { image?: number | undefined; name?: string | undefined; want?: number[] | undefined; missing: number[] }): ForTask {
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
  if (want.length && o.missing.length === count) return { numbers: [...o.missing], by: "order" };
  return { code: "waiting.image-unknown", missing: [...o.missing] };
}
