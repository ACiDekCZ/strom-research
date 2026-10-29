// An index first (D3; the person's answer to the tune question index.first): a book browsed image by image — read by
// readers (strom read) or fetched for it (strom fetch) — where an index of the same parish, years and kind of record is
// known and nobody searched it for this yet: the index is named before anything runs, with the command that reads it
// (found live: 61 images of a marriage book read by readers for 3.90 USD while the parish's index lay downloaded).
// In a conversation only said; in a session of strom run refused (exit 2) unless the agent says --no-index. The brief
// lists the index books of a task's books in its "Already known" part.
//
// From how many images: the person's answer to index.first (core/tuneask.ts), else INDEX_FIRST_DEFAULT — what the
// question recommends: browsing pays below ~20–40 scans, an index above (a letter of an index costs 1–4 USD, browsing
// 0.09–0.18 USD a scan).

import type { Lesson, Media, Person, Place, RecordSet, Search, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import type { Settings, UserConfig } from "./config.ts";
import type { Env } from "./paths.ts";
import { UsageError } from "./errors.ts";
import { currentSession } from "./session.ts";
import { researchKey } from "./viewsizes.ts";
import { indexFirstThreshold } from "./tuneask.ts";
import { imagesIndex } from "./mediaindex.ts";
import { yearsOverlap } from "./years.ts";
import { foldText } from "./text.ts";
import { sameFamily } from "./surnames.ts";
import { subjectPeople } from "./records.ts";
import { runs, shellArg, truncate } from "../cli/format.ts";

/** From this many images on, an index of the parish is named first when the person has not answered index.first. */
export const INDEX_FIRST_DEFAULT = 30;

/** The images from how many on an index is named first (undefined: the person said never). */
export function indexFirstFrom(root: string, cfg: UserConfig, key: string): number | undefined {
  const t = indexFirstThreshold(root, cfg, key);
  if (t === "never") return undefined;
  return t ?? INDEX_FIRST_DEFAULT;
}

export interface IndexBook {
  set: RecordSet;
  /** Its images registered here (each once). */
  images: number[];
  /** How it is arranged, as a lesson of it says (else its layout). */
  arranged?: string;
  /** Its images came through this connector (its ID of the book there). */
  fetch?: { connector: string; book: string };
}

const isIndex = (b: RecordSet) => b.kinds.some((k) => foldText(k) === "index");

/** A record set's places as names to compare (an L… is its names), with the parishes they belonged to. */
function placeKeys(tree: Tree, b: RecordSet): Set<string> {
  const out = new Set<string>();
  const first = (s: string) => foldText(s.split(",")[0]!.trim());
  for (const x of b.places) {
    const pl = /^L\d{4,}$/u.test(x.trim()) ? tree.get<Place>(x.trim()) : undefined;
    if (pl?.type === "place") for (const n of pl.names) out.add(first(n.name));
    else if (x.trim()) out.add(first(x));
  }
  for (const pl of tree.list<Place>("place"))
    if (!pl.retracted && pl.names.some((n) => out.has(first(n.name))))
      for (const j of pl.jurisdictions) if (j.kind === "parish" && j.name.trim()) out.add(first(j.name));
  return out;
}

/** The kinds of record a book holds, its index left out. */
const recordKinds = (b: RecordSet) => b.kinds.map(foldText).filter((k) => k && k !== "index");

/**
 * The index books of a book's parish: an index (kinds: index) of a place it covers or the parish of one, its years
 * reaching into the book's and its kinds of record the book's (an index naming no kind, or a book naming none: any).
 * None for a book that is an index or holds one itself.
 */
export function indexBooksOf(tree: Tree, book: RecordSet): IndexBook[] {
  if (book.retracted || isIndex(book)) return [];
  const places = placeKeys(tree, book);
  if (!places.size) return [];
  const kinds = recordKinds(book);
  const out: IndexBook[] = [];
  const sets = imagesIndex(tree).sets;
  for (const b of tree.list<RecordSet>("recordset")) {
    if (b.id === book.id || b.retracted || !isIndex(b)) continue;
    const its = recordKinds(b);
    if (kinds.length && its.length && !its.some((k) => kinds.includes(k))) continue;
    if (!yearsOverlap(b.years, book.years)) continue;
    if (![...placeKeys(tree, b)].some((p) => places.has(p))) continue;
    out.push(describe(tree, b, sets.get(b.id)?.images ?? []));
  }
  return out;
}

function describe(tree: Tree, b: RecordSet, images: number[]): IndexBook {
  const lesson = tree.list<Lesson>("lesson").find((l) => !l.retracted && l.target === b.id);
  const arranged = lesson ? `${lesson.id}: ${truncate(lesson.rule, 90)}` : b.layout ? truncate(b.layout, 90) : undefined;
  const fetched = tree.list<Media>("media").find((m) => m.recordset === b.id && m.fetched)?.fetched;
  return { set: b, images, ...(arranged ? { arranged } : {}), ...(fetched ? { fetch: { connector: fetched.connector, book: fetched.book } } : {}) };
}

/** Names a question gives: its words in capitals (a name, a place), the first word of it left out; folded. */
export function questionNames(question: string): string[] {
  const words = [...question.matchAll(/[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu)].map((m) => ({ w: m[0], at: m.index ?? 0 }));
  return [...new Set(words.filter((x, i) => i > 0 && x.w.length >= 3 && /^\p{Lu}/u.test(x.w)).map((x) => foldText(x.w)))];
}

/** Two folded names alike: the same, one a form of the other (a question declines them: Šanielové, Šaniel). */
function sameName(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return [...short].length >= 4 && long.startsWith(short) && [...long].length - [...short].length <= 4;
}

/** The surnames of the people a task is about. */
function taskSurnames(tree: Tree, task: Task | undefined): string[] {
  if (!task) return [];
  return subjectPeople(tree, task.subject ?? [])
    .map((id) => tree.get<Person>(id))
    .filter((p): p is Person => !!p && p.type === "person")
    .flatMap((p) => p.names.map((n) => n.surname ?? "").filter(Boolean));
}

/**
 * Whether an index was searched for this: a search recorded in it by the task at work, or one whose question or
 * surnames name a name of the question or a surname of the task's people (none named: any search in it).
 */
function searchedFor(tree: Tree, index: string, o: { question?: string | undefined; task?: Task | undefined }): boolean {
  const searches = tree.list<Search>("search").filter((s) => !s.retracted && s.recordsets.includes(index));
  if (!searches.length) return false;
  const names = [...questionNames(o.question ?? ""), ...taskSurnames(tree, o.task).map(foldText)];
  if (!names.length) return true;
  const same = sameFamily(tree);
  return searches.some((s) => {
    if (o.task && s.task === o.task.id) return true;
    const words = questionNames(s.question).concat((s.scope.surnames ?? []).map(foldText));
    return names.some((n) => words.some((x) => sameName(x, n)) || (s.scope.surnames ?? []).some((x) => same(x, n)));
  });
}

/**
 * The index books to read first before browsing `n` images of a book: those of its parish nobody searched for this —
 * none below the threshold (the person's answer, else INDEX_FIRST_DEFAULT) or when the person said never.
 */
export function indexFirst(tree: Tree, book: RecordSet, n: number, o: { from: number | undefined; question?: string | undefined; task?: Task | undefined }): IndexBook[] {
  if (o.from === undefined || n < o.from) return [];
  return indexBooksOf(tree, book).filter((ib) => !searchedFor(tree, ib.set.id, o));
}

/** The line that names an index to read first (an agent's: English). */
export function indexFirstLine(ib: IndexBook, question?: string): string {
  const b = ib.set;
  const here = ib.images.length ? `${ib.images.length} images here: ${runs(ib.images)}` : "no images here yet";
  const how = ib.arranged ? `; arranged — ${ib.arranged}` : "";
  const q = question ? shellArg(question) : '"…"';
  const next = ib.images.length
    ? `read it first: strom read ${b.id} --images <its images for the name> --question ${q}`
    : ib.fetch
      ? `fetch the images for the name first: strom fetch ${ib.fetch.connector} ${ib.fetch.book} --images <from-to> --recordset ${b.id}`
      : `its images first: strom recordset show ${b.id}`;
  return `${b.id} is an index of this parish and years (${here}${how}) — ${next}`;
}

/** What the brief says of the index books next to a task's books. */
export function indexBriefLines(tree: Tree, books: RecordSet[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const book of books)
    for (const ib of indexBooksOf(tree, book)) {
      if (seen.has(ib.set.id)) continue;
      seen.add(ib.set.id);
      out.push(
        `  ${ib.set.id} "${truncate(ib.set.title, 60)}" — an index of the parish of ${book.id}${ib.set.years ? ` (${ib.set.years})` : ""} · ${ib.images.length ? `downloaded: ${ib.images.length} images` : "not downloaded"}${ib.arranged ? ` · arranged — ${ib.arranged}` : ""}`,
      );
    }
  return out.length ? ["index books (look the name up there before browsing a book):", ...out] : [];
}

/**
 * Before `n` images of a book are browsed (strom read) or fetched to be browsed (strom fetch): the index books to read
 * first said (`say`); in a session of strom run refused unless the agent said --no-index (an index read already, or of
 * no use here). A conversation goes on: its person sees the line too.
 */
export function guardIndexFirst(
  tree: Tree,
  o: { settings: Settings; env: Env; book: RecordSet; n: number; question?: string | undefined; noIndex: boolean; command: string; say: (line: string) => void },
): void {
  if (o.noIndex) return;
  const session = currentSession(tree, o.env);
  const task = session?.task ? tree.get<Task>(session.task) : undefined;
  const key = researchKey(o.settings, o.settings.agent(tree.config).value, tree.config, tree.root);
  const first = indexFirst(tree, o.book, o.n, { from: indexFirstFrom(tree.root, o.settings.config, key), question: o.question, task });
  if (!first.length) return;
  const said = first.slice(0, 2).map((ib) => indexFirstLine(ib, o.question));
  if (session?.runner)
    throw new UsageError(`${o.n} images of ${o.book.id} to browse, while an index of its parish and years is known and nobody searched it for this:\n${said.join("\n")}`, {
      hint: `the index first, then the images it names; read already or of no use here (other years, another kind): ${o.command} --no-index`,
      code: "read.index-first",
    });
  for (const l of said) o.say(l);
}
