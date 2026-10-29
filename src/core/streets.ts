// A street is no place: the place of a fact is the municipality (with the parts above it the research writes:
// "Lhota, okres Horní"), the street and the house number are its house ("Dlouhá 12"). The words that tell a street or a
// house number are data (assets/terms/streets.json), never code; compared folded, word by word, in any script. Beside
// them the research's own houses tell its streets: "Dlouhá 88" at Lhota makes "Lhota, Dlouhá" a street of Lhota.
// strom refuses a place written so now (strom event add|edit --place, person add --born-place …), keys the history of
// the places by the municipality (core/pastevents.ts), and sets old facts right by rules (strom fixes street-places).

import { readAsset } from "./assets.ts";
import { UsageError } from "./errors.ts";
import type { Event, Family, Person } from "./model.ts";
import { foldText } from "./text.ts";
import type { Tree } from "./tree.ts";

interface TermsFile {
  words: Record<string, string[]>;
  suffixes: string[];
  last: string[];
  house: string[];
}

interface Terms {
  words: Set<string>;
  suffixes: string[];
  last: Set<string>;
  /** Each marker of a house number as its folded words ("č. p." → ["c.", "p."]), the longest first. */
  house: string[][];
}

/** A word as written: letters, marks and numbers, a dot at its end kept ("č.", "nám."); "№" a word of its own. */
const TOKEN = /[\p{L}\p{M}\p{N}]+\.?|№/gu;
/** A house number: digits, a letter after them ("12", "12a", "3."). */
const NUMBER = /^\p{N}+\p{L}?\.?$/u;
const LETTER = /\p{L}/u;

let terms: Terms | undefined;

/** The words of assets/terms/streets.json, folded; none where the file is missing (nothing is then a street). */
export function streetTerms(): Terms {
  if (terms) return terms;
  let f: Partial<TermsFile> = {};
  try {
    f = JSON.parse(readAsset("terms", "streets.json") ?? "{}") as Partial<TermsFile>;
  } catch {
    f = {};
  }
  const words = (s: string) => [...foldText(s).matchAll(TOKEN)].map((m) => m[0]);
  terms = {
    words: new Set(Object.values(f.words ?? {}).flat().map((w) => foldText(w))),
    suffixes: (f.suffixes ?? []).map((w) => foldText(w)),
    last: new Set((f.last ?? []).map((w) => foldText(w))),
    house: (f.house ?? []).map(words).filter((w) => w.length).sort((a, b) => b.length - a.length),
  };
  return terms;
}

interface Tok {
  fold: string;
  start: number;
  end: number;
}

function tokens(text: string): Tok[] {
  return [...text.matchAll(TOKEN)].map((m) => ({ fold: foldText(m[0]), start: m.index, end: m.index + m[0].length }));
}

/** How many words a marker of a house number takes at `i` ("č. p." two), 0 where none stands. */
function markerAt(toks: Tok[], i: number): number {
  for (const m of streetTerms().house) if (m.every((w, k) => toks[i + k]?.fold === w)) return m.length;
  return 0;
}

const isNumber = (t: Tok | undefined) => !!t && NUMBER.test(t.fold);

/** A house of numbers alone ("12", "13/2"). */
export function numbersOnly(text: string): boolean {
  const toks = tokens(text.normalize("NFC"));
  return toks.length > 0 && toks.every(isNumber);
}

/** Where a house number begins at the end of a part (its marker, or the numbers alone): the index of its first word. */
function numberTail(toks: Tok[]): { at: number; number: number } | undefined {
  let i = toks.length;
  while (i > 0 && isNumber(toks[i - 1])) i--;
  if (i === toks.length) return undefined;
  for (let s = Math.max(0, i - 3); s < i; s++) {
    const m = markerAt(toks, s);
    if (m && s + m === i) return { at: s, number: i };
  }
  return { at: i, number: i };
}

/** A word of a street: one of the words, one ending so, or a last word ("Main St."). */
function streetWord(toks: Tok[]): boolean {
  const t = streetTerms();
  return toks.some(
    (x, i) =>
      t.words.has(x.fold) ||
      // a word ending so, with three letters before at least ("Hauptstr.", never "Ostr.")
      t.suffixes.some((s) => x.fold.length >= s.length + 3 && x.fold.endsWith(s)) ||
      (i === toks.length - 1 && toks.length > 1 && t.last.has(x.fold)),
  );
}

/** A street's name folded, without the house number after it ("Dlouhá 12" → "dlouha"); "" when no letter is left. */
function nameOf(toks: Tok[]): string {
  const tail = numberTail(toks);
  const words = toks.slice(0, tail ? tail.at : toks.length);
  return words.some((w) => LETTER.test(w.fold)) && !markerAt(words, 0) ? words.map((w) => w.fold).join(" ") : "";
}

/** The street and house of a house the research wrote ("Dlouhá 88" → "dlouha"; "13" → none). */
export function streetOfHouse(house: string): string {
  return nameOf(tokens(house.normalize("NFC")));
}

/**
 * The house of a fact whose place held `street`: the street (and its number) where the fact has no house, the street
 * before a house of numbers alone ("nám. Míru" and "5" are "nám. Míru 5"), the house as it is where it says the same
 * (or names the street with its number: "Dlouhá 88" beside "Dlouhá"); undefined where it says another thing.
 */
export function houseWith(street: string, had: string | undefined): string | undefined {
  const h = had?.trim();
  if (!h || foldText(h) === foldText(street)) return h || street;
  const numbered = /\p{N}/u.test(street);
  if (!numbered && numbersOnly(h)) return `${street} ${h}`;
  if (!numbered && streetOfHouse(street) && streetOfHouse(h) === streetOfHouse(street)) return h;
  return undefined;
}

/** A place split into the municipality and the house: what the place holds of a street or a house number. */
export interface StreetSplit {
  /** The place without them ("Lhota", "Lhota, okres Horní"). */
  town: string;
  /** The street and the number as written ("Dlouhá 12", "nám. Míru", "12"). */
  house: string;
  /** How it is told: a street's word or a house number's marker (`word`), or a street of the research's houses (`known`). */
  by: "word" | "known";
}

/**
 * What a place holds of a street or a house number, or undefined where nothing of it is clear: a part with a street's
 * word ("Lhota, nám. Míru"), a house number with its marker or a part of numbers alone ("Lhota, č. p. 12", "Lhota, 12"),
 * a street the research's houses at the same municipality name (`known`: "Lhota, Dlouhá" where a house is "Dlouhá 88"),
 * a part after the municipality of words and a house number ("Lhota, Dlouhá 12"). A second part that is none of these
 * (a part of the village, a parish, a district, the municipality's own name with a number: "Praha, Praha 5") stays.
 */
export function splitStreet(place: string, known?: (town: string) => ReadonlySet<string> | undefined): StreetSplit | undefined {
  const text = place.normalize("NFC");
  const parts = text.split(",").map((p) => p.trim());
  if (!parts[0]) return undefined;
  const streets = known?.(foldText(parts[0]));
  const keep: string[] = [];
  const house: string[] = [];
  let by: StreetSplit["by"] = "word";
  for (const [i, part] of parts.entries()) {
    const toks = tokens(part);
    if (!toks.length) continue;
    const tail = numberTail(toks);
    // the first part is the municipality: a street before it only with its number ("Hauptstraße 3, Lhotau"), and only
    // where another part is left
    const free = i > 0 || parts.length > 1;
    if (free && tail && tail.at === 0) {
      // numbers alone, or with their marker: the house number ("12", "č. p. 12")
      house.push(part.slice(toks[tail.number]!.start).trim());
      continue;
    }
    if (free && (i > 0 || tail) && streetWord(toks)) {
      house.push(part);
      continue;
    }
    if (i > 0 && streets?.has(nameOf(toks))) {
      house.push(part);
      by = "known";
      continue;
    }
    // a part after the municipality of words and a house number at its end ("Lhota, Dlouhá 12", "Lhota, Polní 5/3",
    // "Lhota, Dlouhá 3a"): a street with its number — but never the municipality's own name with a number after it
    // ("Praha, Praha 5": a district of it)
    if (i > 0 && tail && tail.at === tail.number && tail.at > 0 && nameOf(toks) && nameOf(toks) !== nameOf(tokens(parts[0]!))) {
      house.push(part);
      continue;
    }
    // a house number with its marker at the end of a part ("Lhota č. p. 12", "Lhota, Horní Lhota Nr. 3"): the number
    if (tail && tail.at < tail.number && tail.at > 0) {
      keep.push(part.slice(0, toks[tail.at]!.start).replace(/[\s,;:–-]+$/u, "").trim());
      house.push(part.slice(toks[tail.number]!.start).trim());
      continue;
    }
    keep.push(part);
  }
  if (!house.length || !keep.length || !keep[0]) return undefined;
  return { town: keep.join(", "), house: house.join(" "), by };
}

// ── the research's own: its streets, its forms of a municipality ────────────────────────────────────────────────

const ownersOf = (tree: Tree): (Person | Family)[] => [...tree.list<Person>("person"), ...tree.list<Family>("family")];
const live = (o: Person | Family, e: Event) => !o.retracted && !(o as Person).mergedInto && !e.retracted && e.status !== "retracted";

export interface Streets {
  /** What a place holds of a street or a house number (the research's streets counted), or undefined. */
  split(place: string): StreetSplit | undefined;
  /**
   * The place as the research writes the municipality: its own spelling of it where its facts write it so, else the one
   * form its facts write of that first part ("Lhota, okres Horní"), else the municipality as split.
   */
  townOf(town: string): string;
  /** The place a fact's place stands for: the municipality where it holds a street or a house number, else itself. */
  placeOf(place: string): string;
}

const memo = new WeakMap<Tree, { version: number; streets: Streets }>();

/** The research's streets and its forms of the municipalities, read once a version of the tree. */
export function streetsOf(tree: Tree): Streets {
  const had = memo.get(tree);
  if (had && had.version === tree.version) return had.streets;
  // the streets of each municipality: of the houses its facts give
  const known = new Map<string, Set<string>>();
  const places: string[] = [];
  for (const o of ownersOf(tree))
    for (const e of o.events) {
      if (!live(o, e) || !e.place) continue;
      places.push(e.place.normalize("NFC").replace(/\s+/gu, " ").trim());
      const street = e.house ? streetOfHouse(e.house) : "";
      if (!street) continue;
      const town = foldText(e.place.split(",")[0]!);
      const s = known.get(town) ?? new Set<string>();
      s.add(street);
      known.set(town, s);
    }
  const split = (place: string) => splitStreet(place, (t) => known.get(t));
  // the forms of the municipalities the facts write without a street: each spelling counted, by the whole and its first part
  const spellings = new Map<string, Map<string, number>>();
  const byFirst = new Map<string, Set<string>>();
  for (const p of places) {
    if (!p || split(p)) continue;
    const f = foldText(p);
    const m = spellings.get(f) ?? new Map<string, number>();
    m.set(p, (m.get(p) ?? 0) + 1);
    spellings.set(f, m);
    const first = foldText(p.split(",")[0]!);
    byFirst.set(first, (byFirst.get(first) ?? new Set<string>()).add(f));
  }
  const most = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
  const townOf = (town: string) => {
    const f = foldText(town);
    const exact = spellings.get(f);
    if (exact) return most(exact);
    if (!town.includes(",")) {
      const forms = byFirst.get(f);
      if (forms?.size === 1) return most(spellings.get([...forms][0]!)!);
    }
    return town;
  };
  const streets: Streets = {
    split,
    townOf,
    placeOf: (place) => {
      const s = split(place);
      return s ? townOf(s.town) : place;
    },
  };
  memo.set(tree, { version: tree.version, streets });
  return streets;
}

/**
 * Checks a place written now (strom event add|edit --place, person add --born-place|--died-place, family add
 * --married-place): a street or a house number in it is refused with what to write instead — the municipality as the
 * place, the street and the number as the house. `house`: the house given with it (or the fact's); `flag`: the option.
 */
export function checkStreetPlace(tree: Tree, place: string | undefined, house: string | undefined, flag = "--place"): void {
  if (!place?.trim()) return;
  const streets = streetsOf(tree);
  const s = streets.split(place);
  if (!s) return;
  const town = streets.townOf(s.town);
  const given = house?.trim();
  const both = houseWith(s.house, given);
  const set = both ?? s.house;
  const hint =
    flag === "--place"
      ? `the municipality as the place, the street and the number as the house: --place "${town}" --house "${set}"${both ? "" : ` (the house given, "${given}", differs: write it as the record gives it)`}`
      : `the municipality alone: ${flag} "${town}", then the street and the number as the fact's house: strom event edit <E…> --house "${set}"`;
  throw new UsageError(`the place "${place.trim()}" holds ${s.by === "known" ? "a street of the research's houses" : "a street or a house number"} ("${s.house}"): the place is the municipality`, {
    hint,
    code: "place.street",
    params: { place: place.trim(), town, house: set },
  });
}
