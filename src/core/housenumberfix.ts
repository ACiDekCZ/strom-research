// strom fixes house-numbers (spec 030 K1.5): the house numbers of facts written so that one house was two — set right by
// rules, on a person's word alone:
// (a) a fact with no house whose note says one house number and no other ("čp. 13", "Adresa: čp. 13", "Nr. 13" as the
//     whole note): the number its house (the note stays as it is);
// (b) a house of a marker and a number alone ("čp. 16", "Haus Nr. 16", "House No. 16"): the number alone ("16"), as the
//     other facts of the municipality write it — one house, not two;
// (c) a marker of a house number before a street ("čp. Dlouhá 12"): the street and its number ("Dlouhá 12").
// The markers are the words of assets/terms/streets.json "house" (core/streets.ts). A note naming two numbers or more
// is left and said why. Free, one operation, kept for its undo (HOUSE_NUMBERS_FILE): the houses back as they were.

import fs from "node:fs";
import path from "node:path";
import type { Family, Person, TreeConfig } from "./model.ts";
import { houseMarkers } from "./streets.ts";
import { foldText } from "./text.ts";
import type { Tree } from "./tree.ts";

/** The strom that sets them right. */
export const HOUSE_NUMBERS_SINCE = "1.39.0";
/** Where the fix keeps what it changed, for its undo (sealed like the rest of quality/). */
export const HOUSE_NUMBERS_FILE = "quality/house-numbers.json";

/** One fact's house set right: whose, which, its house before (none) and after, and by which rule. */
export interface HouseNumberFix {
  owner: string;
  event: string;
  /** note: the number of its note; mark: the marker before a number alone taken off; street: the marker before a street. */
  how: "note" | "mark" | "street";
  before?: string;
  after: string;
}

/** A fact left as it is: its note names more house numbers than one. */
export interface HouseNumberLeft {
  owner: string;
  event: string;
  why: "several";
  numbers: string[];
}

export interface HouseNumberFindings {
  fixes: HouseNumberFix[];
  left: HouseNumberLeft[];
}

interface HouseNumbersFile {
  v: 1;
  runs: { at: string; version: string; items: HouseNumberFix[] }[];
}

/**
 * Markers that also number other things ("č. 5" of an entry, "Nr. 3" of a book, "No. 7"): a house number of a note only
 * where the note is nothing but it ("Nr. 13", "Adresse: Nr. 13").
 */
const GENERIC = new Set(["č.", "čís.", "nr.", "nr", "no.", "nro.", "num.", "numer", "№"].map((w) => foldText(w)));

/** A house number as written after its marker: digits, a letter, a part after a slash ("13", "12a", "13/2"). */
const NUMBER_AFTER = /^\s*(\p{N}+\p{L}?(?:\s*\/\s*\p{N}+\p{L}?)?)(?![\p{L}\p{M}\p{N}])/u;

/** The markers at the beginning of a text, one after another ("Haus Nr."): where the rest begins, and whether any is a house's own. */
function leadingMarkers(text: string): { rest: number; own: boolean } | undefined {
  const m = houseMarkers(text);
  return m.length && m[0]!.start === 0 ? chain(text, m, 0) : undefined;
}

/** Markers one after another from the one at `i` of `m`: where the text after them begins, whether any is a house's own. */
function chain(text: string, m: ReturnType<typeof houseMarkers>, i: number): { rest: number; own: boolean; next: number } {
  let end = m[i]!.end;
  let own = !GENERIC.has(m[i]!.fold);
  let k = i + 1;
  while (k < m.length && !text.slice(end, m[k]!.start).trim()) {
    own ||= !GENERIC.has(m[k]!.fold);
    end = m[k]!.end;
    k++;
  }
  return { rest: end, own, next: k };
}

const tidy = (s: string) => s.replace(/\s*\/\s*/gu, "/").replace(/\s+/gu, " ").trim();

/** What a house becomes (b, c): the number alone, the street with its number; undefined where it stays as it is. */
export function houseWithoutMark(house: string): { how: "mark" | "street"; house: string } | undefined {
  const h = house.normalize("NFC").trim();
  const lead = leadingMarkers(h);
  if (!lead) return undefined;
  const rest = h.slice(lead.rest).trim();
  if (!rest) return undefined;
  const n = NUMBER_AFTER.exec(rest);
  if (n && !rest.slice(n[0].length).replace(/[.\s]+$/u, "")) return { how: "mark", house: tidy(n[1]!) };
  // a street and its number after the marker: the marker of a house's own words only ("čp.", never "Haus am Markt")
  if (!/^[\p{L}]/u.test(rest) || !/\p{N}+\p{L}?\.?$/u.test(rest)) return undefined;
  const marker = foldText(h.slice(0, lead.rest)).trim();
  if (!/[.№]/u.test(marker)) return undefined;
  return { how: "street", house: rest.replace(/\.$/u, "").trim() };
}

/** The house numbers a note says, each once (a, by a marker): none where it names none. */
export function noteHouseNumbers(note: string): string[] {
  const text = note.normalize("NFC");
  const m = houseMarkers(text);
  // the whole note a house number: after a label of its own ("Adresa:", "Address:") a marker and a number, nothing else
  const label = /^[\p{L}\p{M} ]{1,30}:\s*/u.exec(text.trim());
  const bare = text.trim().slice(label ? label[0].length : 0);
  const whole = leadingMarkers(bare);
  const only = whole ? NUMBER_AFTER.exec(bare.slice(whole.rest)) : undefined;
  if (whole && only && !bare.slice(whole.rest + only[0].length).replace(/[.\s]+$/u, "")) return [tidy(only[1]!)];
  const out = new Map<string, string>();
  for (let i = 0; i < m.length; ) {
    const c = chain(text, m, i);
    i = c.next;
    if (!c.own) continue;
    const n = NUMBER_AFTER.exec(text.slice(c.rest));
    if (n) out.set(foldText(tidy(n[1]!)), tidy(n[1]!));
  }
  return [...out.values()];
}

const owners = (tree: Tree): (Person | Family)[] => [...tree.list<Person>("person"), ...tree.list<Family>("family")];

/** The facts whose house would be set right, and those left with why. */
export function houseNumberFixes(tree: Tree): HouseNumberFindings {
  const out: HouseNumberFindings = { fixes: [], left: [] };
  for (const o of owners(tree)) {
    if (o.retracted || (o as Person).mergedInto) continue;
    for (const e of o.events) {
      if (e.retracted || e.status === "retracted") continue;
      const house = e.house?.trim();
      if (house) {
        const c = houseWithoutMark(house);
        if (c && c.house !== e.house) out.fixes.push({ owner: o.id, event: e.id, how: c.how, before: e.house!, after: c.house });
        continue;
      }
      // a number of a note only for a fact of a place: a house is of a municipality
      if (!e.place?.trim() || !e.note?.trim()) continue;
      const numbers = noteHouseNumbers(e.note);
      if (numbers.length === 1) out.fixes.push({ owner: o.id, event: e.id, how: "note", after: numbers[0]! });
      else if (numbers.length > 1) out.left.push({ owner: o.id, event: e.id, why: "several", numbers });
    }
  }
  return out;
}

function readFile(tree: Tree): HouseNumbersFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...HOUSE_NUMBERS_FILE.split("/")), "utf8")) as Partial<HouseNumbersFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const fileContent = (f: HouseNumbersFile) => JSON.stringify(f, null, 2) + "\n";

/**
 * Each change put on its fact: its house `from` becomes `to` — a fact no longer so (changed since) is left and counted.
 * The records changed, and the changes made.
 */
function rewrite(tree: Tree, items: HouseNumberFix[], back: boolean): { records: (Person | Family)[]; done: HouseNumberFix[]; left: number } {
  const ownerOf = new Map<string, Person | Family>();
  for (const o of owners(tree)) for (const e of o.events) ownerOf.set(e.id, o);
  const records = new Map<string, Person | Family>();
  const done: HouseNumberFix[] = [];
  let left = 0;
  for (const it of items) {
    const was = ownerOf.get(it.event);
    const rec = was ? (records.get(was.id) ?? (structuredClone(was) as Person | Family)) : undefined;
    const e = rec?.events.find((x) => x.id === it.event);
    const from = back ? it.after : it.before;
    const to = back ? it.before : it.after;
    if (!rec || !e || e.retracted || (e.house ?? undefined) !== (from ?? undefined)) {
      left++;
      continue;
    }
    if (to) e.house = to;
    else delete e.house;
    records.set(rec.id, rec);
    done.push(it);
  }
  return { records: [...records.values()], done, left };
}

/** The fix: every house found set right — one operation, what it changed kept for its undo. Inside withTreeLock. */
export function applyHouseNumbers(tree: Tree, items: HouseNumberFix[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; left: number } {
  const { records, done, left } = rewrite(tree, items, false);
  if (!done.length) return { changed: 0, records: 0, left };
  const file = readFile(tree);
  file.runs.push({ at: new Date().toISOString(), version, items: done });
  tree.putMany(
    records,
    [{ rel: HOUSE_NUMBERS_FILE, content: fileContent(file) }],
    { op: "housenumber.fix", targets: records.map((r) => r.id).sort(), summary: `house numbers of facts set right: ${done.length} in ${records.length} records (fix house-numbers)` },
    config,
  );
  return { changed: done.length, records: records.length, left };
}

/** What the fix changed and is not undone yet. */
export function houseNumbersDone(tree: Tree): HouseNumberFix[] {
  return readFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each fact's house as it was — where still as the fix left it; one changed since is left and counted.
 * One operation; what the fix kept is emptied.
 */
export function undoHouseNumbers(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const items = houseNumbersDone(tree).reverse();
  if (!items.length) return { restored: 0, records: 0, left: 0 };
  const { records, done, left } = rewrite(tree, items, true);
  tree.putMany(
    records,
    [{ rel: HOUSE_NUMBERS_FILE, content: fileContent({ v: 1, runs: [] }) }],
    { op: "housenumber.unfix", targets: records.map((r) => r.id).sort(), summary: `house numbers of facts put back as they were: ${done.length} in ${records.length} records${left ? `, ${left} changed since left` : ""} (fix house-numbers undone)` },
    config,
  );
  return { restored: done.length, records: records.length, left };
}
