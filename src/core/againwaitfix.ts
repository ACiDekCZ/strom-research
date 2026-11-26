// strom fixes again-waits (1126): a task saving images of its book once more (strom media save --again) that a strom
// before awaits.again waited only for the first of them — its wait "23" while its own text names images 23–25 and 40 —
// and counted the copy registered before as saved: it looked done while the rest had not come. Found: a task waiting
// for images (awaits) that saves them once more (a save --again of it in .strom/browser-saves.json, or awaits.again),
// whose own text (its what, else its done-when) names images of its book registered and not in its wait. The numbers of
// the text: digit runs and ranges ("23–25", "40"), never one written in the book's title, years or call number, only
// those registered for that book. Set right by rules: the wait holds them all (awaits.images the union), and those
// whose new copy did not come since the task began saving once more (awaits.again: no copy of the image registered
// since, no save once more of it taken) are counted missing until it comes. Free, kept for its undo (AGAIN_WAITS_FILE):
// each wait back as it was where still as the fix left it.

import fs from "node:fs";
import path from "node:path";
import type { Media, RecordSet, Task, TreeConfig } from "./model.ts";
import { now, type Tree } from "./tree.ts";
import { liveBook } from "./books.ts";
import { loadSaves, type SaveRecord } from "./browser.ts";
import { registeredImages } from "./inboxwait.ts";
import { isWhole, parseImageList } from "./media.ts";
import { runs } from "../cli/format.ts";

/** The strom that sets them right. */
export const AGAIN_WAITS_SINCE = "1.38.0";
/** Where the fix keeps what it changed, for its undo (sealed like the rest of quality/; travels with the research). */
export const AGAIN_WAITS_FILE = "quality/again-waits.json";

/** A wait of images: what it waits for, and those of them saved once more whose new copy it waits for. */
export interface Awaited {
  images: string;
  again?: string;
}

/** One task whose wait would hold every image its text names: which, its book, the images added, its wait before and after. */
export interface AgainWaitFix {
  task: string;
  what: string;
  /** The people it is of. */
  subject: string[];
  recordset: string;
  title: string;
  /** The images its text names that its wait did not hold ("24–25, 40"). */
  added: string;
  before: Awaited;
  after: Awaited;
  /** The task's `updated` before the fix (the undo puts it back as it was). */
  updated: string;
}

interface AgainFile {
  v: 1;
  /** Each time the fix set waits right, newest last. */
  runs: { at: string; version: string; items: AgainWaitFix[] }[];
}

/** The longest range of a text taken as images (a longer one is a span of years, never images). */
const RANGE_MAX = 500;

/** A digit's value, in any script (Unicode keeps a script's digits 0–9 in one run, in their order). */
function digitValue(ch: string): number {
  const cp = ch.codePointAt(0)!;
  let start = cp;
  while (start > 0 && /\p{Nd}/u.test(String.fromCodePoint(start - 1)) && cp - start < 100) start--;
  return (cp - start) % 10;
}

/** A run of digits as a number, in any script ("٢٣" too). */
function numberOf(digits: string): number {
  let n = 0;
  for (const ch of digits) n = n * 10 + digitValue(ch);
  return n;
}

/** A run of digits standing alone (no letter, mark or digit beside it: never the digits of an ID, B0012, T1963). */
const ALONE = String.raw`(?<![\p{L}\p{M}\p{N}])(\p{Nd}+)(?![\p{L}\p{M}\p{N}])`;
/** A number or a range of two ("23–25", "23 - 25"). */
const NUMBERS = new RegExp(String.raw`${ALONE}(?:\s*[-–]\s*${ALONE})?`, "gu");

/** The numbers a text names, each once: its runs of digits and ranges — none written among `not` (nor a range touching one). */
export function textNumbers(text: string, not: ReadonlySet<number> = new Set()): number[] {
  const out = new Set<number>();
  for (const m of text.normalize("NFC").matchAll(NUMBERS)) {
    const a = numberOf(m[1]!);
    const z = m[2] !== undefined ? numberOf(m[2]) : a;
    if (not.has(a) || not.has(z)) continue;
    if (z >= a && z - a < RANGE_MAX) for (let n = a; n <= z; n++) out.add(n);
    else {
      out.add(a);
      out.add(z);
    }
  }
  return [...out].sort((x, y) => x - y);
}

/** The numbers a book is known by in words: its title, years and call number ("Lhota 49", "1850–1870"). */
function bookNumbers(b: RecordSet): Set<number> {
  const out = new Set<number>();
  for (const s of [b.title, b.years, b.callNumber]) for (const m of (s ?? "").normalize("NFC").matchAll(new RegExp(ALONE, "gu"))) out.add(numberOf(m[1]!));
  return out;
}

/** Tasks saving images once more whose wait holds fewer images than their own text names. */
export function againWaitFixes(tree: Tree): AgainWaitFix[] {
  const saves = loadSaves(tree.root);
  const saving = new Set(saves.filter((r) => r.again).map((r) => r.task));
  const tasks = tree.list<Task>("task").filter((t) => t.state === "waiting" && !t.retracted && t.awaits && (t.awaits.again || saving.has(t.id)));
  if (!tasks.length) return [];
  const media = tree.list<Media>("media").filter((m) => !m.retracted && isWhole(m.part) && m.recordset && m.image !== undefined);
  const out: AgainWaitFix[] = [];
  for (const t of tasks.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))) {
    const aw = t.awaits!;
    const b = liveBook(tree, aw.recordset);
    if (!b) continue;
    const reg = new Set([...registeredImages(tree, aw.recordset), ...registeredImages(tree, b.id)]);
    const not = bookNumbers(b);
    const named = (text: string | undefined) => textNumbers(text ?? "", not).filter((n) => reg.has(n));
    const fromWhat = named(t.what);
    const said = fromWhat.length ? fromWhat : named(t.doneWhen);
    const want = parseImageList(aw.images) ?? [];
    const added = said.filter((n) => !want.includes(n));
    if (!added.length) continue;
    const all = [...new Set([...want, ...added])].sort((x, y) => x - y);
    const again = againOf(tree, t, b, all, reg, saves, media);
    out.push({
      task: t.id,
      what: t.what,
      subject: [...t.subject],
      recordset: b.id,
      title: b.title,
      added: runs(added),
      before: { images: aw.images, ...(aw.again ? { again: aw.again } : {}) },
      after: { images: runs(all), ...(again.length ? { again: runs(again) } : {}) },
      updated: t.updated,
    });
  }
  return out;
}

/**
 * Of the images a task waits for, those saved once more whose new copy did not come: registered, and no copy of it
 * registered since the task began saving once more (its first save --again; else since it was made), no save once more
 * of it taken — with those its wait said so already.
 */
function againOf(tree: Tree, t: Task, b: RecordSet, all: number[], reg: ReadonlySet<number>, saves: readonly SaveRecord[], media: readonly Media[]): number[] {
  const own = saves.filter((r) => r.task === t.id && r.again);
  const since = own.length ? Math.min(...own.map((r) => r.at)) : Date.parse(t.created);
  const came = (n: number) =>
    own.some((r) => r.n === n && r.taken !== undefined) ||
    media.some((m) => m.image === n && liveBook(tree, m.recordset!)?.id === b.id && Date.parse(m.created) > since);
  const had = parseImageList(t.awaits?.again ?? "") ?? [];
  return [...new Set([...had, ...all.filter((n) => reg.has(n) && !came(n))])].filter((n) => all.includes(n)).sort((x, y) => x - y);
}

function readFile(tree: Tree): AgainFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...AGAIN_WAITS_FILE.split("/")), "utf8")) as Partial<AgainFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const fileContent = (f: AgainFile) => JSON.stringify(f, null, 2) + "\n";

/** A task's wait as a fix's `before` or `after` says it. */
function withWait(t: Task, w: Awaited): Task {
  const { again: _a, ...rest } = t.awaits!;
  return { ...structuredClone(t), awaits: { ...rest, images: w.images, ...(w.again ? { again: w.again } : {}) } };
}

const sameWait = (t: Task, w: Awaited) => t.awaits?.images === w.images && (t.awaits.again ?? undefined) === (w.again ?? undefined);

/**
 * The records written, each in an operation of its own (task.wait), the file kept for the undo and the decision with
 * the last — one commit, by the caller. Nothing changed: the file and the decision alone.
 */
function write(tree: Tree, records: { rec: Task; summary: string }[], file: AgainFile, config: ((c: TreeConfig) => void) | undefined, reason: string, none: string): void {
  const kept = [{ rel: AGAIN_WAITS_FILE, content: fileContent(file) }];
  if (!records.length) {
    tree.putMany([], kept, { op: "fix.decide", targets: [], summary: none }, config);
    return;
  }
  records.forEach(({ rec, summary }, i) => {
    const last = i === records.length - 1;
    tree.putMany([rec], last ? kept : [], { op: "task.wait", targets: [rec.id], summary, reason }, last ? config : undefined);
  });
}

/**
 * The fix: each task found waits for every image its text names, those whose new copy did not come counted missing —
 * one changed since it was found is left and counted. Inside withTreeLock.
 */
export function applyAgainWaits(tree: Tree, items: AgainWaitFix[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; left: number } {
  const at = now();
  const records: { rec: Task; summary: string }[] = [];
  const done: AgainWaitFix[] = [];
  let left = 0;
  for (const it of items) {
    const was = tree.get<Task>(it.task);
    if (!was || was.state !== "waiting" || !was.awaits || was.updated !== it.updated || !sameWait(was, it.before)) {
      left++;
      continue;
    }
    records.push({ rec: { ...withWait(was, it.after), updated: at }, summary: `${it.task} wait: images ${it.after.images} of ${it.recordset}, ${it.added} added from its text (fix again-waits)` });
    done.push(it);
  }
  if (!done.length) return { changed: 0, records: 0, left };
  const file = readFile(tree);
  file.runs.push({ at, version, items: done });
  write(tree, records, file, config, "fix again-waits", "");
  return { changed: done.length, records: records.length, left };
}

/** What the fix set right and is not undone yet. */
export function againWaitsDone(tree: Tree): AgainWaitFix[] {
  return readFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each task's wait as it was — where still as the fix left it (waiting, its wait the fix's); one changed
 * since is left and counted. What the fix kept is emptied.
 */
export function undoAgainWaits(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const items = againWaitsDone(tree).reverse();
  if (!items.length) return { restored: 0, records: 0, left: 0 };
  const records: { rec: Task; summary: string }[] = [];
  let left = 0;
  for (const it of items) {
    const was = tree.get<Task>(it.task);
    if (!was || was.state !== "waiting" || !was.awaits || !sameWait(was, it.after) || records.some((r) => r.rec.id === it.task)) {
      left++;
      continue;
    }
    records.push({ rec: { ...withWait(was, it.before), updated: it.updated }, summary: `${it.task} wait: images ${it.before.images} of ${it.recordset} as it was (fix again-waits undone)` });
  }
  write(tree, records, { v: 1, runs: [] }, config, "fix again-waits undone", `waits of tasks saving images once more: nothing to put back${left ? `, ${left} changed since left` : ""} (fix again-waits undone)`);
  return { restored: records.length, records: records.length, left };
}
