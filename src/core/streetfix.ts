// strom fixes street-places: facts an older strom took with a street or a house number in the place ("Lhota, Dlouhá
// 12") — set right by rules (core/streets.ts): the place the municipality as the research writes it elsewhere (so its
// place record and the history of the place are one), the street and the number its house where the fact has none (or
// has the number alone: "Dlouhá" and "12" are "Dlouhá 12"). A fact whose house says another thing is left and said
// why. Free, one operation, kept for its undo (STREET_PLACES_FILE).

import fs from "node:fs";
import path from "node:path";
import type { Family, Person, Place, TreeConfig } from "./model.ts";
import { placeRecordOf } from "./pastevents.ts";
import { houseWith, streetsOf } from "./streets.ts";
import type { Tree } from "./tree.ts";

/** Where the fix keeps what it changed, for its undo (sealed like the rest of quality/; travels with the research). */
export const STREET_PLACES_FILE = "quality/street-places.json";

/** A fact's place and house as they were, or as the fix makes them. */
export interface PlaceHouse {
  place: string;
  house?: string;
}

/** One fact set right: its owner, the fact, before → after, the place record of the municipality where there is one. */
export interface StreetFix {
  owner: string;
  event: string;
  before: PlaceHouse;
  after: PlaceHouse;
  record?: string;
}

/** A fact left as it is: its house says another thing than the street of its place. */
export interface StreetLeft {
  owner: string;
  event: string;
  place: string;
  house: string;
  /** What the place holds of a street or a house number. */
  street: string;
  why: "house";
}

export interface StreetFindings {
  fixes: StreetFix[];
  left: StreetLeft[];
}

interface StreetsFile {
  v: 1;
  /** Each time the fix set facts right, newest last. */
  runs: { at: string; version: string; items: StreetFix[] }[];
}

const owners = (tree: Tree): (Person | Family)[] => [...tree.list<Person>("person"), ...tree.list<Family>("family")];
const placeHouse = (place: string, house: string | undefined): PlaceHouse => ({ place, ...(house ? { house } : {}) });

/** The facts whose place holds a street or a house number, and how each would be set right (or why it is left). */
export function streetPlaceFixes(tree: Tree): StreetFindings {
  const streets = streetsOf(tree);
  const recordOf = placeRecordOf(tree.list<Place>("place"));
  const out: StreetFindings = { fixes: [], left: [] };
  for (const o of owners(tree)) {
    if (o.retracted || (o as Person).mergedInto) continue;
    for (const e of o.events) {
      if (e.retracted || e.status === "retracted" || !e.place) continue;
      const s = streets.split(e.place);
      if (!s) continue;
      const place = streets.townOf(s.town);
      const had = e.house?.trim();
      // the house: the street and the number where the fact has none, the street before a number alone
      const house = houseWith(s.house, had);
      if (house === undefined) {
        out.left.push({ owner: o.id, event: e.id, place: e.place, house: had!, street: s.house, why: "house" });
        continue;
      }
      const record = recordOf(place);
      out.fixes.push({ owner: o.id, event: e.id, before: placeHouse(e.place, e.house), after: placeHouse(place, house), ...(record ? { record } : {}) });
    }
  }
  return out;
}

/** Facts whose place strom would refuse now (strom check: street-place). */
export function streetPlaces(tree: Tree): { count: number; first?: string } {
  const f = streetPlaceFixes(tree);
  const all = [...f.fixes.map((x) => x.event), ...f.left.map((x) => x.event)];
  return { count: all.length, ...(all.length ? { first: all[0] } : {}) };
}

function readStreetsFile(tree: Tree): StreetsFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...STREET_PLACES_FILE.split("/")), "utf8")) as Partial<StreetsFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const fileContent = (f: StreetsFile) => JSON.stringify(f, null, 2) + "\n";
const same = (place: string | undefined, house: string | undefined, p: PlaceHouse) => place === p.place && (house ?? undefined) === (p.house ?? undefined);

/**
 * Each change put on its fact: the place and house `from` become `to` — a fact no longer so (changed since) is left and
 * counted. The records changed, and the changes made.
 */
function rewrite(tree: Tree, items: StreetFix[], from: "before" | "after"): { records: (Person | Family)[]; done: StreetFix[]; left: number } {
  const to = from === "before" ? "after" : "before";
  const records = new Map<string, Person | Family>();
  const done: StreetFix[] = [];
  let left = 0;
  const ownerOf = new Map<string, Person | Family>();
  for (const o of owners(tree)) for (const e of o.events) ownerOf.set(e.id, o);
  for (const it of items) {
    // the fact where it is now (a merge may have moved it)
    const was = ownerOf.get(it.event);
    const rec = was ? (records.get(was.id) ?? (structuredClone(was) as Person | Family)) : undefined;
    const e = rec?.events.find((x) => x.id === it.event);
    if (!rec || !e || !same(e.place, e.house, it[from])) {
      left++;
      continue;
    }
    e.place = it[to].place;
    if (it[to].house) e.house = it[to].house;
    else delete e.house;
    records.set(rec.id, rec);
    done.push(it);
  }
  return { records: [...records.values()], done, left };
}

/**
 * The fix: every fact found set right (the municipality its place, the street and the number its house) — one
 * operation, what it changed kept for its undo (STREET_PLACES_FILE). Inside withTreeLock.
 */
export function applyStreetPlaces(tree: Tree, items: StreetFix[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; left: number } {
  const { records, done, left } = rewrite(tree, items, "before");
  if (!done.length) return { changed: 0, records: 0, left };
  const file = readStreetsFile(tree);
  file.runs.push({ at: new Date().toISOString(), version, items: done });
  tree.putMany(
    records,
    [{ rel: STREET_PLACES_FILE, content: fileContent(file) }],
    { op: "streetplace.fix", targets: records.map((r) => r.id).sort(), summary: `streets out of the places of facts: ${done.length} in ${records.length} records (fix street-places)` },
    config,
  );
  return { changed: done.length, records: records.length, left };
}

/** What the fix changed and is not undone yet. */
export function streetPlacesDone(tree: Tree): StreetFix[] {
  return readStreetsFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each fact's place and house as they were — where still as the fix left them; one changed since is
 * left and counted. One operation; what the fix kept is emptied.
 */
export function undoStreetPlaces(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const file = readStreetsFile(tree);
  const items = file.runs.flatMap((r) => r.items).reverse();
  if (!items.length) return { restored: 0, records: 0, left: 0 };
  const { records, done, left } = rewrite(tree, items, "after");
  tree.putMany(
    records,
    [{ rel: STREET_PLACES_FILE, content: fileContent({ v: 1, runs: [] }) }],
    { op: "streetplace.unfix", targets: records.map((r) => r.id).sort(), summary: `places of facts put back as they were: ${done.length} in ${records.length} records${left ? `, ${left} changed since left` : ""} (fix street-places undone)` },
    config,
  );
  return { restored: done.length, records: records.length, left };
}
