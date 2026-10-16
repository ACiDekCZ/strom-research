// The same book under two IDs: one book of an archive registered twice is fetched twice — every image asked of the
// archive again, then found by its hash to be another book's. A book is known by its link, or by the book of a
// connector its images came from.

import type { Media, RecordSet } from "./model.ts";
import type { Tree } from "./tree.ts";

/** A link as it is compared: no fragment, no trailing slash, the scheme and host in lower case (http = https). */
export function bookUrlKey(url: string): string {
  const u = url.trim().replace(/#.*$/u, "").replace(/\/+$/u, "");
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?]*)(.*)$/iu.exec(u);
  if (!m) return u;
  const scheme = m[1]!.toLowerCase().replace(/^https$/u, "http");
  return `${scheme}://${m[2]!.toLowerCase()}${m[3]}`;
}

export interface SameBook {
  book: RecordSet;
  /** Its images registered in the research (whole images, each counted once). */
  images: number;
  /** How it is the same: the same link, or images fetched from the same book of the connector. */
  by: "url" | "connector";
}

/**
 * The books of the research that are this one: the same link, or images fetched through this connector from this
 * book. `except` — the book asked about itself, and those it was knowingly registered beside (`duplicates`).
 */
export function sameBooks(tree: Tree, of: { url?: string; connector?: string; book?: string }, except?: string): SameBook[] {
  const key = of.url ? bookUrlKey(of.url) : undefined;
  const media = tree.list<Media>("media");
  const own = except ? tree.get<RecordSet>(except) : undefined;
  const skip = new Set([...(except ? [except] : []), ...(own?.duplicates?.of ?? [])]);
  const out: SameBook[] = [];
  for (const b of tree.list<RecordSet>("recordset")) {
    if (skip.has(b.id) || b.duplicates?.of.includes(except ?? "")) continue;
    const mine = media.filter((m) => m.recordset === b.id);
    const by =
      key && b.url && bookUrlKey(b.url) === key
        ? "url"
        : of.connector && of.book !== undefined && mine.some((m) => m.fetched?.connector === of.connector && m.fetched?.book === String(of.book))
          ? "connector"
          : undefined;
    if (!by) continue;
    out.push({ book: b, images: new Set(mine.filter((m) => !m.part && m.image !== undefined).map((m) => m.image)).size, by });
  }
  // the book registered first is the book: the others are its copies
  return out.sort((a, b) => a.book.created.localeCompare(b.book.created) || a.book.id.localeCompare(b.book.id));
}

/** "B0169 (148 images here)" */
export function sameBookText(s: SameBook): string {
  return `${s.book.id}${s.images ? ` (${s.images} image${s.images === 1 ? "" : "s"} here)` : " (no images here yet)"}`;
}

/** The book of a connector a record set is: as its connector knows it (its ID on the portal), and how strom knows it. */
export interface BookRoute {
  connector: string;
  book: string;
  /** Its images came from that book (`fetched`), or its link is a link of that book (another book's link told how). */
  by: "images" | "link";
}

/**
 * Which book of a connector a record set is (with `connector`: of that connector only): the book its images were
 * fetched from — else read from its link, by a book of the research whose link and book of the same connector are
 * known (the same link, or a link alike with the other book's ID in its place: …/d/7000/1 is book 7000, so …/d/8012/1
 * is book 8012). Only one book it can be: none, or two, is undefined — never a guess between them.
 */
export function bookRoute(tree: Tree, recordset: string, connector?: string): BookRoute | undefined {
  const media = tree.list<Media>("media");
  const mine = (m: Media) => m.recordset === recordset && !!m.fetched && (!connector || m.fetched.connector === connector);
  // an image withdrawn (a placeholder the portal gave) came from the book all the same: the others first
  const got = media.find((m) => mine(m) && !m.retracted) ?? media.find(mine);
  if (got?.fetched) return { connector: got.fetched.connector, book: got.fetched.book, by: "images" };
  const url = tree.get<RecordSet>(recordset)?.url;
  if (!url) return undefined;
  const key = bookUrlKey(url);
  // the books of the research with a link whose images came through a connector: their link and their book
  const known = new Map<string, { url: string; connector: string; book: string }>();
  for (const m of media) {
    if (!m.fetched || !m.recordset || m.recordset === recordset || (connector && m.fetched.connector !== connector)) continue;
    const b = tree.get<RecordSet>(m.recordset);
    if (b?.url) known.set(`${b.id} ${m.fetched.connector} ${m.fetched.book}`, { url: bookUrlKey(b.url), connector: m.fetched.connector, book: m.fetched.book });
  }
  const found = new Map<string, BookRoute>();
  for (const k of known.values()) for (const book of bookInLink(key, k.url, k.book)) found.set(`${k.connector} ${book}`, { connector: k.connector, book, by: "link" });
  return found.size === 1 ? [...found.values()][0] : undefined;
}

/** A letter, a mark or a digit: what an ID in a link is never cut off from. */
const WORDISH = /[\p{L}\p{M}\p{N}]/u;
/** What a book's ID in a link never holds: it is one part of the path or one value of the query. */
const SEPARATOR = /[/?&=#]/u;

/** The books `key` (a link) names, as `other` (the link of `book`) names that book: the rest of the two links the same. */
function bookInLink(key: string, other: string, book: string): string[] {
  const out = new Set<string>();
  if (!book) return [];
  for (let i = other.indexOf(book); i >= 0; i = other.indexOf(book, i + 1)) {
    const before = other.slice(0, i);
    const after = other.slice(i + book.length);
    // the ID whole, never a part of a longer word or number
    if ((before && WORDISH.test(before.at(-1)!)) || (after && WORDISH.test(after[0]!))) continue;
    // where the ID stands in a link the host and path before it say which link it is: never the host itself
    if (!before.includes("/", before.indexOf("//") + 2)) continue;
    if (!key.startsWith(before) || !key.endsWith(after) || key.length <= before.length + after.length) continue;
    const id = key.slice(before.length, key.length - after.length);
    if (!SEPARATOR.test(id) && WORDISH.test(id[0]!) && WORDISH.test(id.at(-1)!)) out.add(id);
  }
  return [...out];
}
