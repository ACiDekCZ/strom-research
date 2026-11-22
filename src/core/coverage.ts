// Whether the images searched in a book cover the years a search had to cover (spec 131 U1): the agent is told, never
// refused, when a person's estimated date (from an age: ABT 1761) widened by search.ageMargin reaches years of the book
// no search looked at — "1756–1757 not searched — the book continues before image 66". Which years an image holds is
// known only from the searches themselves (their --pages with their --years, read page by page or in an index); where
// that is unknown or the searches disagree, nothing is said. Nothing is written to the data: a close marks the books it
// spoke of beside the session's clock (.strom/clock/<N…>.coverage), so each is said once a session.

import fs from "node:fs";
import path from "node:path";
import type { Family, Person, RecordSet, Search, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { parseYears } from "./years.ts";
import { dateYears } from "./gdate.ts";
import { RECORD_KINDS } from "./frontier.ts";
export { AGE_MARGIN, AGE_MARGIN_MAX } from "./config.ts";

/** Images between two searches whose years are known, beyond which no year is guessed between them. */
export const INTERPOLATE_MAX = 10;
/** The methods whose --pages and --years together say which years the images hold. */
const ANCHOR_METHODS: readonly string[] = ["page-by-page", "index"];

export interface Span {
  from: number;
  to: number;
}

/** What a search says of its images: images a..b hold the years y1..y2. */
interface Anchor {
  a: number;
  b: number;
  y1: number;
  y2: number;
  id: string;
}

/** One missing stretch of years and where in the book it likely is. */
export interface CoverageGap extends Span {
  /** "before image 66", "after image 85", "images 70–74" */
  where: string;
  /** the book continues there: images before the first searched, or after the last */
  continues: boolean;
  /** images left out between two searched stretches whose years touch theirs: the years are about those images' */
  images?: Span;
}

/** One coverage warning: a book, the years that had to be searched, the years searched, the years missing. */
export interface Coverage {
  recordset: string;
  /** The years to cover: an estimated date of a person ± the margin, or the search's own --years. */
  window: Span & { person?: string; date?: string; margin?: number; years?: string };
  /** The years the searched images hold (as far as the searches tell). */
  searched: Span[];
  /** The images searched in the book. */
  images: Span[];
  missing: CoverageGap[];
  /** The searches the years of the images are taken from. */
  by: string[];
}

/** "66-85", "61-65, 81-85", "66–85" (any dash) → the ranges; undefined for anything else ("fol. 12", "p. 3"). */
export function pageRanges(text: string | undefined): Span[] | undefined {
  if (!text) return undefined;
  const out: Span[] = [];
  for (const part of text.split(/[,;]+/u).map((x) => x.trim()).filter(Boolean)) {
    const m = /^(\d+)(?:\s*[-‐‑‒–—―−]\s*(\d+))?$/u.exec(part);
    if (!m) return undefined;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    out.push(a <= b ? { from: a, to: b } : { from: b, to: a });
  }
  return out.length ? out : undefined;
}

/** Spans joined where they touch or overlap, in order. */
export function mergeSpans(spans: readonly Span[], touch = 1): Span[] {
  const sorted = [...spans].sort((x, y) => x.from - y.from || x.to - y.to);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out.at(-1);
    if (last && s.from <= last.to + touch) last.to = Math.max(last.to, s.to);
    else out.push({ ...s });
  }
  return out;
}

const live = (s: Search) => !s.retracted && !s.mergedInto;

/**
 * The searches of a book that say which years its images hold (K1.1): one book only, --pages one range, --years, read
 * page by page or in an index. Undefined when two of them disagree (the same image in years apart, or later images in
 * earlier years): then nothing is known of the book's years by image.
 */
export function anchorsOf(searches: readonly Search[], recordset: string, except?: string): Anchor[] | undefined {
  const out: Anchor[] = [];
  for (const s of searches) {
    if (!live(s) || s.id === except || s.recordsets.length !== 1 || s.recordsets[0] !== recordset) continue;
    if (!ANCHOR_METHODS.includes(s.method)) continue;
    const pages = pageRanges(s.scope.pages);
    const years = parseYears(s.scope.years);
    if (!pages || pages.length !== 1 || !years) continue;
    out.push({ a: pages[0]!.from, b: pages[0]!.to, y1: years.from, y2: years.to, id: s.id });
  }
  for (const x of out)
    for (const y of out) {
      if (x === y) continue;
      const imagesMeet = x.a <= y.b && y.a <= x.b;
      const yearsMeet = x.y1 <= y.y2 && y.y1 <= x.y2;
      if (imagesMeet && !yearsMeet) return undefined;
      if (!imagesMeet && x.b < y.a && x.y1 > y.y2) return undefined;
    }
  return out.sort((x, y) => x.a - y.a || x.b - y.b);
}

/**
 * The years image n holds, as the anchors tell: within one, by its place in it — of several, those over the fewest
 * images (a search over a wider stretch says its years less closely: often the years looked for, not those the images
 * hold); between two close ones, between their years.
 */
export function yearsAt(anchors: readonly Anchor[], n: number): Span | undefined {
  const around = anchors.filter((x) => n >= x.a && n <= x.b);
  const fewest = Math.min(...around.map((x) => x.b - x.a));
  const inside = around.filter((x) => x.b - x.a === fewest);
  if (inside.length) {
    const spans = inside.map((x) => {
      const len = x.b - x.a + 1;
      const per = (x.y2 - x.y1) / len;
      return { from: x.y1 + Math.floor((n - x.a) * per), to: x.y1 + Math.ceil((n - x.a + 1) * per) };
    });
    return { from: Math.min(...spans.map((s) => s.from)), to: Math.max(...spans.map((s) => s.to)) };
  }
  const before = anchors.filter((x) => x.b < n).sort((x, y) => y.b - x.b)[0];
  const after = anchors.filter((x) => x.a > n).sort((x, y) => x.a - y.a)[0];
  if (!before || !after || after.a - before.b - 1 > INTERPOLATE_MAX) return undefined;
  return { from: Math.min(before.y2, after.y1), to: Math.max(before.y2, after.y1) };
}

/**
 * The window a GEDCOM date estimated from an age asks a search to cover (K1.2): ABT/EST/CAL x → x ± margin, BET a AND b →
 * a − margin … b + margin. Nothing for a date as written in a record, nor an open one (BEF, AFT, FROM, TO).
 */
export function estimateWindow(date: string | undefined, margin: number): Span | undefined {
  if (!date) return undefined;
  const d = date.trim().toUpperCase();
  if (/^(ABT|EST|CAL) /u.test(d)) {
    const y = dateYears(d)[0];
    return y === undefined ? undefined : { from: y - margin, to: y + margin };
  }
  if (/^BET .+ AND .+$/u.test(d)) {
    const ys = dateYears(d);
    return ys.length < 2 ? undefined : { from: Math.min(...ys) - margin, to: Math.max(...ys) + margin };
  }
  return undefined;
}

const span = (s: Span) => (s.from === s.to ? String(s.from) : `${s.from}–${s.to}`);

/**
 * The coverage of one window in one book (K1.1–K1.3), from the searches of the book: undefined when nothing is missing
 * or nothing can be told — no searched images, an image's years unknown, the searches disagreeing, the missing years
 * outside the book's own years.
 */
export function bookCoverage(
  book: Pick<RecordSet, "id" | "years" | "images">,
  searches: readonly Search[],
  window: Coverage["window"],
  extra: { pages?: Span[]; except?: string } = {},
): Coverage | undefined {
  const anchors = anchorsOf(searches, book.id, extra.except);
  if (!anchors?.length) return undefined;
  const of = searches.filter((s) => live(s) && s.recordsets.includes(book.id));
  const images = mergeSpans([...(extra.pages ?? []), ...of.flatMap((s) => pageRanges(s.scope.pages) ?? [])]);
  if (!images.length) return undefined;
  const searched: Span[] = [];
  for (const seg of images) {
    const first = yearsAt(anchors, seg.from);
    const last = yearsAt(anchors, seg.to);
    if (!first || !last) return undefined;
    searched.push({ from: Math.min(first.from, last.from), to: Math.max(first.to, last.to) });
  }
  // a search over years without its images (a register's index, a catalogue): those years count as searched
  for (const s of of) {
    const y = s.id !== extra.except && !pageRanges(s.scope.pages) ? parseYears(s.scope.years) : undefined;
    if (y) searched.push({ from: y.from, to: y.to });
  }
  const covered = mergeSpans(searched);
  const own = parseYears(book.years);
  const lo = Math.max(window.from, own?.from ?? -Infinity);
  const hi = Math.min(window.to, own?.to ?? Infinity);
  if (lo > hi) return undefined;
  const gaps: Span[] = [];
  let at = lo;
  for (const c of covered) {
    if (c.to < at) continue;
    if (c.from > hi) break;
    if (c.from > at) gaps.push({ from: at, to: Math.min(c.from - 1, hi) });
    at = Math.max(at, c.to + 1);
  }
  if (at <= hi) gaps.push({ from: at, to: hi });
  const firstImage = images[0]!.from;
  const lastImage = images.at(-1)!.to;
  const missing = gaps.map((g): CoverageGap => {
    if (g.to < covered[0]!.from) return firstImage > 1 ? { ...g, where: `before image ${firstImage}`, continues: true } : { ...g, where: "not in the images searched", continues: false };
    if (g.from > covered.at(-1)!.to)
      return book.images === undefined || lastImage < book.images ? { ...g, where: `after image ${lastImage}`, continues: true } : { ...g, where: "not in the images searched", continues: false };
    // between two stretches of searched images: the images between them
    const i = searched.findIndex((s, k) => k < images.length && s.to < g.from && (searched[k + 1]?.from ?? Infinity) > g.to);
    const between = i >= 0 && i + 1 < images.length ? { from: images[i]!.to + 1, to: images[i + 1]!.from - 1 } : undefined;
    return { ...g, where: between ? `images ${span(between)}` : "between the images searched", continues: !!between };
  });
  // images left out between two searched stretches whose years touch or overlap theirs (1–9 and 20–30 searched,
  // 10–19 not): no whole year is missing, yet the images of the years at the seam were never looked at — named always
  for (let k = 0; k + 1 < images.length; k++) {
    const left = { from: images[k]!.to + 1, to: images[k + 1]!.from - 1 };
    if (missing.some((m) => m.where === `images ${span(left)}`)) continue;
    const a = yearsAt(anchors, left.from);
    const b = yearsAt(anchors, left.to);
    const held = a && b ? { from: Math.min(a.from, b.from), to: Math.max(a.to, b.to) } : { from: Math.min(searched[k]!.to, searched[k + 1]!.from), to: Math.max(searched[k]!.to, searched[k + 1]!.from) };
    const from = Math.max(lo, held.from);
    const to = Math.min(hi, held.to);
    if (from <= to) missing.push({ from, to, where: `images ${span(left)}`, continues: true, images: left });
  }
  if (!missing.length) return undefined;
  missing.sort((x, y) => x.from - y.from || x.to - y.to);
  const by = [...new Set(anchors.map((x) => x.id))];
  return { recordset: book.id, window, searched: covered, images, missing, by };
}

/** One line for the agent (English): what had to be searched, what was, what is missing and where. */
export function coverageLine(c: Coverage): string {
  const w = c.window;
  const what = w.person && w.date ? `${w.person} ${w.date} ±${w.margin} → ${span(w)}` : `--years ${span(w)}`;
  const miss = c.missing
    .map((m) => (m.images ? `images ${span(m.images)} (about ${span(m)}) not searched` : `${span(m)} not searched — ${m.continues ? `the book continues ${m.where}` : m.where}`))
    .join("; ");
  return `note: coverage of ${c.recordset}: ${what}; images ${c.images.map(span).join(", ")} hold about ${c.searched.map(span).join(", ")} (by ${c.by.join(", ")}); ${miss} — a negative result there is not yet founded`;
}

/** The record kinds of a book the events of these kinds are written in (birth, marriage, death). */
function eventKindsFor(book: RecordSet): string[] {
  return Object.entries(RECORD_KINDS)
    .filter(([, kinds]) => book.kinds.some((k) => kinds.includes(k)))
    .map(([tag]) => tag);
}

/** The dates estimated from an age of the people of a task, for the events a book holds: person, event, date. */
function estimatedDates(tree: Tree, task: Task, book: RecordSet): { person: string; date: string }[] {
  const tags = eventKindsFor(book);
  if (!tags.length) return [];
  const out: { person: string; date: string }[] = [];
  const families = tree.list<Family>("family").filter((f) => !f.retracted);
  for (const id of task.subject) {
    const rec = tree.get<Person | Family>(id);
    if (!rec || rec.retracted) continue;
    const events = rec.type === "person" ? [...rec.events, ...families.filter((f) => f.partners.includes(id)).flatMap((f) => f.events)] : rec.type === "family" ? rec.events : [];
    for (const e of events) if (!e.retracted && e.date && tags.includes(e.kind) && estimateWindow(e.date, 0)) out.push({ person: id, date: e.date });
  }
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(`${x.person} ${x.date}`) ? false : (seen.add(`${x.person} ${x.date}`), true)));
}

/** The windows of the estimated dates of a task's people in one book, each told once. */
function personWindows(tree: Tree, task: Task, book: RecordSet, margin: number): Coverage["window"][] {
  return estimatedDates(tree, task, book).map((d) => ({ ...estimateWindow(d.date, margin)!, person: d.person, date: d.date, margin }));
}

/**
 * The coverage of a search being recorded or changed (search add/edit, K1.3): only one that found nothing, or not all,
 * over images it names — its own --years and the estimated dates of its task's people, in each book it names.
 */
export function searchCoverage(tree: Tree, s: Pick<Search, "recordsets" | "scope" | "result" | "task"> & { id?: string }, margin: number): Coverage[] {
  if (s.result === "found") return [];
  const pages = pageRanges(s.scope.pages);
  if (!pages) return [];
  const searches = tree.list<Search>("search");
  const task = s.task ? tree.get<Task>(s.task) : undefined;
  const out: Coverage[] = [];
  for (const id of s.recordsets) {
    const book = tree.get<RecordSet>(id);
    if (!book || book.type !== "recordset") continue;
    const own = parseYears(s.scope.years);
    const windows: Coverage["window"][] = [...(own ? [{ from: own.from, to: own.to, years: s.scope.years }] : []), ...(task ? personWindows(tree, task, book, margin) : [])];
    for (const w of windows) {
      const c = bookCoverage(book, searches, w, { pages, ...(s.id ? { except: s.id } : {}) });
      if (c) {
        out.push(c);
        break; // one line a book: the first window not covered
      }
    }
  }
  return out;
}

/**
 * The coverage of a task being closed (session close, task done; K1.3): the books its searches were made in, for its
 * people's dates estimated from an age only — each book once a session (the marker beside the session's clock).
 */
export function closeCoverage(tree: Tree, taskId: string | undefined, session: string | undefined, margin: number): Coverage[] {
  const task = taskId ? tree.get<Task>(taskId) : undefined;
  if (!task || task.type !== "task") return [];
  const searches = tree.list<Search>("search");
  const books = [...new Set(searches.filter((s) => live(s) && s.task === task.id).flatMap((s) => s.recordsets))];
  const said = session ? saidIn(tree, session) : new Set<string>();
  const out: Coverage[] = [];
  for (const id of books) {
    if (said.has(id)) continue;
    const book = tree.get<RecordSet>(id);
    if (!book || book.type !== "recordset") continue;
    for (const w of personWindows(tree, task, book, margin)) {
      const c = bookCoverage(book, searches, w);
      if (c) {
        out.push(c);
        break;
      }
    }
  }
  if (session && out.length && !tree.dryRun) markSaid(tree, session, out.map((c) => c.recordset));
  return out;
}

const markerFile = (tree: Tree, session: string) => path.join(tree.root, ".strom", "clock", `${session}.coverage`);

function saidIn(tree: Tree, session: string): Set<string> {
  try {
    return new Set(fs.readFileSync(markerFile(tree, session), "utf8").split(/\s+/u).filter(Boolean));
  } catch {
    return new Set();
  }
}

function markSaid(tree: Tree, session: string, books: string[]): void {
  try {
    const file = markerFile(tree, session);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, books.join("\n") + "\n");
  } catch {
    // only a reminder: said again next time
  }
}
