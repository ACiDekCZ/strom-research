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
