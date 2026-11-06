// Where an agent works now, for the Strom app's map while it follows the work (the bridge's working[].place, feature
// working.place): the place record (L…) of the book the agent examines — the parish or the village of its records,
// never an archive. Only what the agent wrote through strom tells it, nothing guessed: the newest record of its work the
// session wrote (an image fetched, a source, a search, a book) decides alone — its book's place, none when its book is
// unsure (a search in several books of several places, a source of no book: the web); before any, the books its task
// names. What it writes of people from a record (a fact, a citation) keeps the place of that record.
// A book is a place's when the place lists it among its records (strom place jurisdiction --recordset), else when one
// place record alone bears the name of the first place the book covers. Unsure (no such place, several of one name,
// the task's books in several places): none — the app shows the person's places then.

import type { Media, Place, RecordSet, Search, Source, Task } from "./model.ts";
import { foldText } from "./text.ts";
import type { Op, Tree } from "./tree.ts";

/** The place record (L…) of the book the agent examines now, when the research knows it. */
export function placeOfWork(tree: Tree, ops: Op[], task: Task | undefined): string | undefined {
  // the newest record of its work the session wrote decides alone: its book's place, or none — never an older book's
  for (let i = ops.length - 1; i >= 0; i--) {
    const main = ops[i]!.targets?.[0];
    if (main && /^[BMSQ]\d+$/.test(main)) return placeOfRecord(tree, main);
  }
  // nothing written yet: the books its task names, when they are all of one place
  return placeOfBooks(tree, (task?.where ?? []).map((w) => w.trim()));
}

/** The place of the books named, when they are all of one known place. */
function placeOfBooks(tree: Tree, ids: string[]): string | undefined {
  const books = ids.map((id) => tree.get<RecordSet>(id)).filter((b): b is RecordSet => b?.type === "recordset" && !b.retracted);
  const places = new Set(books.map((b) => placeOfBook(tree, b)));
  return places.size === 1 ? [...places][0] : undefined;
}

/** The place of a record of work: of its book, of the books of a search when all of one place; none when unsure. */
function placeOfRecord(tree: Tree, id: string): string | undefined {
  if (/^Q\d+$/.test(id)) {
    const q = tree.get<Search>(id);
    return q && !q.retracted ? placeOfBooks(tree, q.recordsets) : undefined;
  }
  const book = bookOf(tree, id);
  return book ? placeOfBook(tree, book) : undefined;
}

/** The book a record is of: a book itself, an image of it, a source from it. */
function bookOf(tree: Tree, id: string): RecordSet | undefined {
  const book = (b: string | undefined) => {
    const r = b ? tree.get<RecordSet>(b) : undefined;
    return r?.type === "recordset" && !r.retracted ? r : undefined;
  };
  if (/^B\d+$/.test(id)) return book(id);
  if (/^M\d+$/.test(id)) {
    const m = tree.get<Media>(id);
    return m && !m.retracted ? book(m.recordset) : undefined;
  }
  if (/^S\d+$/.test(id)) {
    const s = tree.get<Source>(id);
    if (!s || s.retracted) return undefined;
    return book(s.recordset) ?? book((s.media ?? []).map((m) => tree.get<Media>(m)?.recordset).find(Boolean));
  }
  return undefined;
}

/** The place record of a book: the one listing it among its records, else the one alone of the name of its first place. */
function placeOfBook(tree: Tree, book: RecordSet): string | undefined {
  const places = tree.list<Place>("place").filter((p) => !p.retracted);
  const listing = places.filter((p) => p.jurisdictions.some((j) => (j.recordsets ?? []).includes(book.id)));
  if (listing.length === 1) return listing[0]!.id;
  const first = book.places[0]?.trim();
  if (!first) return undefined;
  const name = foldText(first);
  const named = (listing.length ? listing : places).filter((p) => p.names.some((n) => foldText(n.name) === name));
  return named.length === 1 ? named[0]!.id : undefined;
}
