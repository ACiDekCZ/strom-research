// Where an entry stands in its book, field by field (spec 075): the folio or page as the book numbers it, the image
// number as the archive's portal counts it, the call number of the book — beside the rest of the location (the
// locator: an entry's number, a column). An archive changes its links; the entry is found again by these.
//
// The GEDCOM keeps one readable PAGE for every program, composed from the fields given (never from an image the
// research only knows from the registered scans: an existing source's PAGE stays as it was), and the fields
// themselves (1 _STROM_FOLIO, _STROM_IMAGE, _STROM_LOCATOR) for a Strom app that reads them.

import type { Media, RecordSet, Source } from "./model.ts";
import { phrase } from "./phrases.ts";
import { foldText } from "./text.ts";

/** The image numbers of the source: its own (given), else those of its registered images (derived). */
export function sourceImage(s: Pick<Source, "image" | "media" | "clips">, media: (id: string) => Media | undefined): { value: string; derived: boolean } | undefined {
  const own = s.image?.trim();
  if (own) return { value: own, derived: false };
  const ids = new Set([...(s.media ?? []), ...(s.clips ?? []).map((c) => c.media)]);
  const numbers = [...new Set([...ids].map((id) => media(id)?.image).filter((n): n is number => Number.isInteger(n) && n! > 0))].sort((a, b) => a - b);
  if (!numbers.length) return undefined;
  return { value: imageNumbers(numbers), derived: true };
}

/** Sorted unique image numbers as one text: "57", a run "57–58", else "57, 60". */
export function imageNumbers(numbers: number[]): string {
  if (numbers.length === 1) return String(numbers[0]);
  const run = numbers.every((n, i) => i === 0 || n === numbers[i - 1]! + 1);
  return run ? `${numbers[0]}–${numbers[numbers.length - 1]}` : numbers.join(", ");
}

/** The call number of the book the entry is in: the source's own, else its record set's. */
export function sourceCallNumber(s: Pick<Source, "callNumber">, recordset: Pick<RecordSet, "callNumber"> | undefined): string | undefined {
  return s.callNumber?.trim() || recordset?.callNumber?.trim() || undefined;
}

// Not a letter, mark or digit before a word: where a word starts in any script (never \b, which knows ASCII only).
const START = "(?<![\\p{L}\\p{M}\\p{N}])";
// A number, a folio's side (r, v, recto, verso) right after it or after one space, and a range of them.
const SIDE = "(?:\\s?(?:recto|verso|[rv])(?![\\p{L}\\p{M}\\p{N}]))?";
// A number never goes on with a letter: "Pag. 1ma" (the first) is no page 1, "fol. 12a" no folio 12.
const FOLIO_NUMBER = `\\d+${SIDE}(?:\\s*[-–—]\\s*\\d+${SIDE})?(?![\\p{L}\\p{M}\\p{N}])`;
const IMAGE_NUMBER = "\\d+(?:\\s*[-–—]\\s*\\d+)?(?![\\p{L}\\p{M}\\p{N}])";
// The words of a folio or page (longest first: "strona" before "str." before "s."), each as the book writes it.
const FOLIO_WORDS = ["folium", "folio", "fol\\.?", "f\\.", "pag\\.?", "p\\.", "seite", "strona", "str\\.", "s\\."];
// The words of an image, then optionally its number's word (č., nr, no.).
const IMAGE_WORDS = ["snímek", "snimek", "sn\\.", "image", "img\\.?", "scan", "skan", "bild", "obraz", "obr\\.", "kadr"];
const FOLIO = new RegExp(`${START}(?:${FOLIO_WORDS.join("|")})(?![\\p{L}\\p{M}])\\s*(${FOLIO_NUMBER})`, "iu");
const IMAGE = new RegExp(`${START}(?:${IMAGE_WORDS.join("|")})(?![\\p{L}\\p{M}])\\s*(?:(?:č\\.|c\\.|nr\\.?|no\\.)\\s*)?(${IMAGE_NUMBER})`, "iu");
const BARE_FOLIO = new RegExp(`^\\s*(${FOLIO_NUMBER})\\s*$`, "iu");

/** A part of a locator: as it stands, its number, where it is in the text. */
type Part = { text: string; number: string; at: number };

function part(re: RegExp, text: string): Part | undefined {
  const m = re.exec(text);
  return m ? { text: m[0], number: m[1]!, at: m.index } : undefined;
}

/** The one part a text names, or none when it names two ("S. 12 of the edition (PDF S. 14), fol. 3r": which is it?). */
function onlyPart(re: RegExp, text: string): Part | undefined {
  const first = part(re, text);
  if (!first) return undefined;
  return part(re, text.slice(first.at + first.text.length)) ? undefined : first;
}

/**
 * The folio and the image a locator names, as a proposal only (strom source show; never written by itself): the
 * folio with its word as it stands ("fol. 12v", "pag. 112", "S. 15"), the image's number or range ("34", "57–58").
 * A locator that names two folios or two images proposes none of them.
 */
export function recognizeLocation(text: string | undefined): { folio?: string; image?: string } {
  if (!text?.trim()) return {};
  const t = text.normalize("NFC");
  const folio = onlyPart(FOLIO, t)?.text.replace(/\s+/gu, " ").trim();
  const image = onlyPart(IMAGE, t)?.number.replace(/\s+/gu, "");
  return { ...(folio ? { folio } : {}), ...(image ? { image } : {}) };
}

/** A number of a folio or image as compared: no spaces, one dash, folded ("12 v" is "12v", "57–58" is "57-58"). */
const sameNumber = (a: string, b: string) => {
  const n = (x: string) => foldText(x).replace(/\s+/gu, "").replace(/[–—]/gu, "-");
  return n(a) === n(b);
};

/** The folio's number of a folio given: after its word, or the folio alone a number. */
function folioNumber(folio: string): string | undefined {
  const t = folio.normalize("NFC");
  return part(FOLIO, t)?.number ?? BARE_FOLIO.exec(t)?.[1];
}

/**
 * The text with its part cut out, the separators around it tidied ("č. 5, snímek 3, ř. 2" → "č. 5, ř. 2"; "sn. 19 =
 * fol. 7" → "sn. 19"; "018 = fol. 5 — read in ink" → "018, read in ink").
 */
function cut(text: string, p: Part): string {
  const before = text.slice(0, p.at).replace(/(?:[\s,;:·=]|\s[-–—])+$/u, "");
  const sep = text.slice(before.length, p.at);
  let after = text.slice(p.at + p.text.length).replace(/^(?:[\s,;:·=]|[-–—]\s)+/u, "");
  let head = before;
  // a part in brackets: the brackets go with it
  if (/[(\[]$/u.test(head) && /^[)\]]/u.test(after)) {
    head = head.slice(0, -1).replace(/[\s,;:·]+$/u, "");
    after = after.slice(1).replace(/^[\s,;:·]+/u, "");
  }
  if (!head || !after) return head || after;
  const punct = /[,;:·]/u.exec(sep)?.[0] ?? ",";
  return `${head}${punct} ${after}`;
}

/** Whether a text says a part word by word (folded, a whole word: "fol. 1" is not in "fol. 12"). */
function says(text: string, what: string): boolean {
  const t = foldText(text);
  const w = foldText(what);
  if (!w) return false;
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`${START}${escaped}(?![\\p{L}\\p{M}\\p{N}])`, "u").test(t);
}

/**
 * What of a source's locator its fields say too (spec 075 N1): the folio and the image the locator names where a
 * field gives one — the same number (perhaps another word) or another — and the locator without them. Nothing of it
 * is written by itself: the PAGE is composed of it, strom source show and edit propose the rest.
 */
export function locatorOverlap(s: Pick<Source, "folio" | "image" | "locator">): { folio?: { named: string; same: boolean }; image?: { named: string; same: boolean }; rest: string } | undefined {
  const folio = s.folio?.trim();
  const image = s.image?.trim();
  let rest = s.locator?.trim().normalize("NFC");
  if (!rest || (!folio && !image)) return undefined;
  const out: { folio?: { named: string; same: boolean }; image?: { named: string; same: boolean } } = {};
  const f = folio ? part(FOLIO, rest) : undefined;
  if (f) {
    const n = folioNumber(folio!);
    out.folio = { named: f.text.replace(/\s+/gu, " ").trim(), same: n !== undefined && sameNumber(n, f.number) };
    rest = cut(rest, f);
  }
  const i = image ? part(IMAGE, rest) : undefined;
  if (i) {
    out.image = { named: i.number.replace(/\s+/gu, ""), same: sameNumber(image!, i.number) };
    rest = cut(rest, i);
  }
  return out.folio || out.image ? { ...out, rest } : undefined;
}

/**
 * The readable location of the source (GEDCOM PAGE) from the fields given: the folio, the rest of the location, the
 * image ("image 34" in the research's language), joined ", ". With neither folio nor image given it is the locator
 * exactly. An image derived from the registered scans is never in it.
 *
 * A part the locator names too is said once (N1): the same number, perhaps another word ("scan 101" beside image
 * 101), stays as the locator says it; another number gives way to the field (given later, on purpose) — the locator
 * itself is never changed, its whole text stays the research's (and the app's _STROM_LOCATOR).
 */
export function composedPage(s: Pick<Source, "folio" | "image" | "locator">, lang: string): string | undefined {
  const folio = s.folio?.trim();
  const image = s.image?.trim();
  if (!folio && !image) return s.locator;
  let locator = s.locator?.trim();
  let folioSaid = false;
  let imageSaid = false;
  const imagePart = image ? `${phrase(lang, "source.image")} ${image}` : undefined;
  if (locator) {
    const t = locator.normalize("NFC");
    const f = folio ? part(FOLIO, t) : undefined;
    let rest = t;
    if (f) {
      const n = folioNumber(folio!);
      if (n !== undefined && sameNumber(n, f.number)) folioSaid = true;
      else rest = cut(rest, f);
    } else if (folio && /\p{L}/u.test(folio) && says(t, folio)) folioSaid = true;
    const i = image ? part(IMAGE, rest) : undefined;
    if (i) {
      if (sameNumber(image!, i.number)) imageSaid = true;
      else rest = cut(rest, i);
    } else if (imagePart && says(rest, imagePart)) imageSaid = true;
    // the locator as it stands when nothing of it gave way
    locator = rest === t ? locator : rest;
  }
  const parts = [folio && !folioSaid ? folio : undefined, locator || undefined, imagePart && !imageSaid ? imagePart : undefined].filter((x): x is string => !!x);
  return parts.length ? parts.join(", ") : undefined;
}
