// The books the research's tasks need (spec 105): for each record set, the tasks that name it — open, put aside or
// waiting — and how much of it is on disk. Derived, nothing written. One download by hand serves every task of a book:
// its images belong to the book (core/inboxwait.ts registeredImages, one folder of the shared inbox for it), not to a
// task. Counted only from what the tasks say (where B…, awaits.recordset) — never a book guessed for a task that names
// none (core/frontier.ts taskRecordsets): the numbers are a lower bound, never an estimate.

import { imagesIndex } from "./mediaindex.ts";
import { inboxFolderFor, parseImageList } from "./media.ts";
import { runs } from "../cli/format.ts";
import { BOOKS_MIN_TASKS, Settings } from "./config.ts";
import { hostOf, wholeBookFor } from "./terms.ts";
import type { RecordSet, Repository, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { waitKindOf } from "./waitkind.ts";

/** How many tasks a book needs for the offer to download it, unless the setting books.minTasks says otherwise. */
export { BOOKS_MIN_TASKS };

/** The states of a task that still needs its book: to do, at work, put aside, waiting. */
const COUNTED: ReadonlySet<string> = new Set(["open", "doing", "parked", "waiting"]);

/** Access of a book whose images a person can download (free, or with a login). */
const DOWNLOADABLE: ReadonlySet<string> = new Set(["online-free", "online-login"]);

/** A record set's ID as a task's where names it. */
const BOOK_ID = /^B\d{4,}$/u;
/** A record set's ID within a task's words (waitingOn): bounded by no letter, mark or digit — in any script. */
const BOOK_ID_IN = /(?<![\p{L}\p{M}\p{N}])B\d{4,}(?![\p{L}\p{M}\p{N}])/gu;
/** A record's ID as a where names it (a book B…, an archive R…): no free text. */
const RECORD_ID = /^\p{Lu}\d{4,}$/u;

/** At most this many task IDs named in a sentence to the agent (the rest counted). */
export const SAME_BOOK_IDS_MAX = 10;

/**
 * What can be offered of a book: the whole book (the archive offers or allows it), the images or a range the tasks
 * need, selected images only, nothing — as the archive's terms say (assets/archives.json wholeBook); not known: a range.
 */
export type BookDownload = "whole" | "range" | "selected" | "none";

export interface BookRow {
  id: string;
  title: string;
  /** Its archive, with the archive's own site (for a book with no link of its own). */
  archive?: { id: string; name: string; url?: string };
  years?: string;
  access: RecordSet["access"];
  url?: string;
  /** The tasks that need it: waiting + open (with those at work) + parked. */
  tasks: number;
  waiting: number;
  open: number;
  parked: number;
  /** Their IDs, each state apart, in the order of their IDs. */
  ids: { open: string[]; parked: string[]; waiting: string[] };
  /** Its images, when the catalog knows how many. */
  images?: number;
  /** Its images registered in the research (each number once — there can be more than `images` says). */
  onDisk: number;
  /** Of its known images, those not registered: only when `images` is known. */
  missing?: number;
  /**
   * The image numbers its tasks know they need (what waiting tasks wait for) and not on disk yet, as people write them
   * ("57–58, 112"), and how many — when any.
   */
  need?: string;
  needCount?: number;
  download: BookDownload;
  /** What the archive's terms say of downloading its books, word for word, when strom's list knows (download not range). */
  downloadTerms?: { how: "offered" | "allowed" | "selected" | "never"; says: string; from: "terms" | "termsPage" | "reply"; host: string };
  /** Its folder of the shared inbox (the name alone). */
  folder: string;
  /**
   * Offered to download by hand: enough tasks, downloadable, not whole on disk — and something to offer: the whole book
   * where the archive offers or allows it, else the images its tasks need (never a book of download none).
   */
  offer: boolean;
}

/** Whether a task still needs its books: open, at work, put aside or waiting — and work in a book, not a decision. */
export function needsBooks(t: Task): boolean {
  return COUNTED.has(t.state) && !t.proposal && !t.shorterNote;
}

/** A book as it stands: a book merged into another is that one; a book taken back is none. */
export function liveBook(tree: Tree, id: string): RecordSet | undefined {
  let b = tree.get<RecordSet>(id);
  for (let i = 0; b?.mergedInto && i < 8; i++) b = tree.get<RecordSet>(b.mergedInto);
  return b && b.type === "recordset" && !b.retracted ? b : undefined;
}

/** The books a task names (its where, the book it waits for), as they stand, each once. */
export function booksOfTask(tree: Tree, t: Task): RecordSet[] {
  const ids = new Set(t.where.map((w) => w.trim()).filter((w) => BOOK_ID.test(w)));
  if (t.awaits?.recordset) ids.add(t.awaits.recordset);
  if (t.state === "waiting" && t.wait?.book) ids.add(t.wait.book);
  const out = new Map<string, RecordSet>();
  for (const id of ids) {
    const b = liveBook(tree, id);
    if (b) out.set(b.id, b);
  }
  return [...out.values()];
}

/** The books a task's where names, as they stand, each once (by their IDs). */
function whereBooks(tree: Tree, t: Task): Set<string> {
  return new Set(t.where.map((w) => w.trim()).filter((w) => BOOK_ID.test(w)).map((w) => liveBook(tree, w)?.id).filter((x): x is string => !!x));
}

/**
 * The book a waiting task is to be searched in, when it is not the one book its where names (that one may be only where
 * the trail was found: a note in a book of births pointing to the marriages of another parish) — read, nothing written:
 *   - the book the agent gave it (strom task wait|edit --book: wait.book);
 *   - else the one book its words name (waitingOn) beyond its where: an ID is the same in every language;
 *   - else none (null) for a site the person looks at or checks (kind web, check) whose where names one book beside a
 *     place or book in words (one still to be found): better no book than the book of the trail.
 * undefined: none of these — the task's book is the one its where names. Not for a task waiting for images by their
 * numbers (awaits says the book), nor for a task not waiting (the queue: the book a session reads is its where's).
 */
export function waitTarget(tree: Tree, t: Task): RecordSet | null | undefined {
  if (t.state !== "waiting" || t.awaits) return undefined;
  const given = t.wait?.book ? liveBook(tree, t.wait.book) : undefined;
  if (given) return given;
  const where = whereBooks(tree, t);
  const named = new Set(
    [...(t.waitingOn ?? "").normalize("NFC").matchAll(BOOK_ID_IN)].map((m) => liveBook(tree, m[0])?.id).filter((x): x is string => !!x && !where.has(x)),
  );
  if (named.size === 1) return liveBook(tree, [...named][0]!) ?? undefined;
  const kind = waitKindOf(t);
  if ((kind === "web" || kind === "check") && where.size === 1 && t.where.some((w) => w.trim() && !RECORD_ID.test(w.trim()))) return null;
  return undefined;
}

/**
 * The one book a task is about, for the Strom app's groups by book (spec 105): the book it waits for (awaits), else for
 * a waiting task the book it is to be searched in (waitTarget: none when that is not known), else the one book its
 * where names — as they stand. Several books, or none: undefined.
 */
export function bookOfTask(tree: Tree, t: Task): string | undefined {
  if (t.awaits?.recordset) return liveBook(tree, t.awaits.recordset)?.id;
  const target = waitTarget(tree, t);
  if (target !== undefined) return target?.id;
  const ids = whereBooks(tree, t);
  return ids.size === 1 ? [...ids][0] : undefined;
}

const byId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** How many tasks a book needs to be offered in this research (books.minTasks, else BOOKS_MIN_TASKS). */
export function minTasksOf(tree: Tree): number {
  return new Settings(tree.env, {}).booksMinTasks(tree.config);
}

/** What the terms let be downloaded of a book: its own address's host, else its archive's — the whole, selected, none, a range. */
export function downloadOf(tree: Tree, b: RecordSet, repo?: Repository): { download: BookDownload; terms?: BookRow["downloadTerms"] } {
  const url = b.url ?? repo?.url;
  const host = url ? hostOf(url) : undefined;
  const t = host ? wholeBookFor(tree.env, host) : undefined;
  if (!t) return { download: "range" };
  const download: BookDownload = t.how === "offered" || t.how === "allowed" ? "whole" : t.how === "selected" ? "selected" : "none";
  return { download, terms: { how: t.how, says: t.says, from: t.from, host: t.host } };
}

/** A book's tasks as bookRows counts them: the book, its tasks' IDs each state apart (by ID), the images its waiting tasks ask for. */
export interface BookTasks {
  b: RecordSet;
  ids: BookRow["ids"];
  need: Set<number>;
}

/**
 * Every book some task still needs, with its tasks (needsBooks: open — those at work among them —, parked, waiting),
 * each book as it stands (booksOfTask) — once over the tasks: what strom task books counts (bookRows), and what the gain
 * of what waits counts as the tasks a book serves (core/waitgain.ts).
 */
export function bookTasks(tree: Tree): Map<string, BookTasks> {
  const rows = new Map<string, BookTasks>();
  for (const t of tree.list<Task>("task")) {
    if (!needsBooks(t)) continue;
    for (const b of booksOfTask(tree, t)) {
      const r = rows.get(b.id) ?? { b, ids: { open: [], parked: [], waiting: [] }, need: new Set<number>() };
      rows.set(b.id, r);
      (t.state === "waiting" ? r.ids.waiting : t.state === "parked" ? r.ids.parked : r.ids.open).push(t.id);
      if (t.state === "waiting" && t.awaits && liveBook(tree, t.awaits.recordset)?.id === b.id) for (const n of parseImageList(t.awaits.images) ?? []) r.need.add(n);
    }
  }
  for (const { ids } of rows.values()) for (const l of [ids.open, ids.parked, ids.waiting]) l.sort(byId);
  return rows;
}

/**
 * Every book some task still needs, the most tasks first (then the most waiting, then by ID); offered by `minTasks`
 * (default the research's books.minTasks).
 */
export function bookRows(tree: Tree, minTasks = minTasksOf(tree)): BookRow[] {
  const index = imagesIndex(tree);
  // the images registered to a book merged into another count for that one
  const registered = new Map<string, Set<number>>();
  for (const [id, s] of index.sets) {
    const b = liveBook(tree, id);
    if (!b) continue;
    const set = registered.get(b.id) ?? new Set<number>();
    for (const n of s.images) set.add(n);
    registered.set(b.id, set);
  }
  const out: BookRow[] = [];
  for (const { b, ids, need } of bookTasks(tree).values()) {
    const repo = b.repository ? tree.get<Repository>(b.repository) : undefined;
    const reg = registered.get(b.id) ?? new Set<number>();
    const images = b.images && b.images > 0 ? b.images : undefined;
    let missing: number | undefined;
    if (images !== undefined) {
      let have = 0;
      for (const n of reg) if (n >= 1 && n <= images) have++;
      missing = images - have;
    }
    const tasks = ids.open.length + ids.parked.length + ids.waiting.length;
    const { download, terms } = downloadOf(tree, b, repo && !repo.retracted ? repo : undefined);
    const needed = [...need].filter((n) => !reg.has(n)).sort((x, y) => x - y);
    const row: BookRow = {
      id: b.id,
      title: b.title,
      ...(repo && !repo.retracted ? { archive: { id: repo.id, name: repo.name, ...(repo.url ? { url: repo.url } : {}) } } : {}),
      ...(b.years ? { years: b.years } : {}),
      access: b.access,
      ...(b.url ? { url: b.url } : {}),
      tasks,
      waiting: ids.waiting.length,
      open: ids.open.length,
      parked: ids.parked.length,
      ids,
      ...(images !== undefined ? { images } : {}),
      onDisk: reg.size,
      ...(missing !== undefined ? { missing } : {}),
      ...(needed.length ? { need: runs(needed), needCount: needed.length } : {}),
      download,
      ...(terms ? { downloadTerms: terms } : {}),
      folder: inboxFolderFor(b),
      offer: false,
    };
    row.offer = offerable(row, minTasks);
    out.push(row);
  }
  return out.sort((a, b) => b.tasks - a.tasks || b.waiting - a.waiting || byId(a.id, b.id));
}

/**
 * Whether a book is worth offering to download by hand (whether anything waits on it or not): enough tasks,
 * downloadable, not whole on disk, and something the archive's terms let be offered — the whole book, or the images its
 * tasks need and are not on disk yet (a range, selected images). Never a book of download none.
 */
export function offerable(r: BookRow, minTasks = BOOKS_MIN_TASKS): boolean {
  if (r.tasks < minTasks || !DOWNLOADABLE.has(r.access) || r.missing === 0) return false;
  return r.download === "whole" || ((r.download === "range" || r.download === "selected") && !!r.needCount);
}

/** The books offered to download (strom task books): those offerable, the most tasks first. */
export function offeredBooks(tree: Tree, minTasks = minTasksOf(tree)): BookRow[] {
  return bookRows(tree, minTasks).filter((r) => r.offer);
}

/** The tasks that still need a book (as it stands), open first, then put aside, then waiting — each by ID. */
export function tasksOfBook(tree: Tree, id: string): Task[] {
  const b = liveBook(tree, id);
  if (!b) return [];
  const order = (t: Task) => (t.state === "waiting" ? 2 : t.state === "parked" ? 1 : 0);
  return tree
    .list<Task>("task")
    .filter((t) => needsBooks(t) && booksOfTask(tree, t).some((x) => x.id === b.id))
    .sort((x, y) => order(x) - order(y) || byId(x.id, y.id));
}

/**
 * The sentence for the agent at a task's book: the other tasks that need the same book, so they can be done in one
 * session — open ones first, then the waiting and the put aside said as such; at most SAME_BOOK_IDS_MAX IDs named.
 */
export function sameBookLine(tree: Tree, task: Task, bookId: string, max = SAME_BOOK_IDS_MAX): string | undefined {
  const others = tasksOfBook(tree, bookId).filter((t) => t.id !== task.id);
  if (!others.length) return undefined;
  const b = liveBook(tree, bookId)!;
  const named: string[] = [];
  let left = max;
  for (const [state, word] of [["open", ""], ["waiting", "waiting "], ["parked", "parked "]] as const) {
    const ids = others.filter((t) => (state === "open" ? t.state === "open" || t.state === "doing" : t.state === state)).map((t) => t.id);
    const shown = ids.slice(0, Math.max(0, left));
    left -= shown.length;
    if (shown.length) named.push(`${word}${shown.join(" ")}`);
  }
  const rest = others.length - (max - Math.max(0, left));
  return `the same book is needed by ${others.length} more task${others.length > 1 ? "s" : ""}: ${named.join(" · ")}${rest > 0 ? ` (+${rest})` : ""} — strom task list --book ${b.id}`;
}
