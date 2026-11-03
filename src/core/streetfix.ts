// strom fixes street-places: facts an older strom took with a street or a house number in the place ("Lhota, Dlouhá
// 12") — set right by rules (core/streets.ts): the place the municipality as the research writes it elsewhere (so its
// place record and the history of the place are one), the street and the number its house where the fact has none (or
// has the number alone: "Dlouhá" and "12" are "Dlouhá 12"). A fact whose house says another thing is left and said
// why. Free, one operation, kept for its undo (STREET_PLACES_FILE).
// A number alone after a municipality's name ("Lhota 16") is set right only where a person said, for the whole
// municipality, that its numbers are houses (STREET_PLACES_FILE "towns"); until then each such municipality is offered
// with how many facts it would set right (StreetTown), "Praha 5" and other parts of a municipality never (core/streets.ts).

import fs from "node:fs";
import path from "node:path";
import type { Family, Person, Place, TreeConfig } from "./model.ts";
import { placeRecordOf } from "./pastevents.ts";
import { houseWith, STREET_PLACES_FILE, streetsOf, townAnswers, type TownAnswer } from "./streets.ts";
import type { Tree } from "./tree.ts";

/** Where the fix keeps what it changed, for its undo, and the persons' answers (sealed like the rest of quality/). */
export { STREET_PLACES_FILE };

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

/**
 * A municipality with numbers alone after its name ("Lhota 16", "Lhota 3"): set right only once a person says its
 * numbers are houses — the facts it would then set right, the places as written.
 */
export interface StreetTown {
  /** The municipality as the research writes it ("Lhota"). */
  town: string;
  /** Its name folded: what the person's answer is kept by. */
  key: string;
  fixes: StreetFix[];
  /** The places as written, each once, the most written first. */
  places: string[];
}

export interface StreetFindings {
  fixes: StreetFix[];
  left: StreetLeft[];
  /** Municipalities with numbers alone after the name, nobody has said yet whether they are houses. */
  towns: StreetTown[];
}

interface StreetsFile {
  v: 1;
  /** Each time the fix set facts right, newest last. */
  runs: { at: string; version: string; items: StreetFix[] }[];
  /** The persons' answers on numbers alone after a municipality's name, by its name folded. */
  towns?: Record<string, TownAnswer>;
}

const owners = (tree: Tree): (Person | Family)[] => [...tree.list<Person>("person"), ...tree.list<Family>("family")];
const placeHouse = (place: string, house: string | undefined): PlaceHouse => ({ place, ...(house ? { house } : {}) });

/** The facts whose place holds a street or a house number, and how each would be set right (or why it is left). */
export function streetPlaceFixes(tree: Tree): StreetFindings {
  const streets = streetsOf(tree);
  const recordOf = placeRecordOf(tree.list<Place>("place"));
  const out: StreetFindings = { fixes: [], left: [], towns: [] };
  const towns = new Map<string, { town: string; fixes: StreetFix[]; places: Map<string, number> }>();
  for (const o of owners(tree)) {
    if (o.retracted || (o as Person).mergedInto) continue;
    for (const e of o.events) {
      if (e.retracted || e.status === "retracted" || !e.place) continue;
      const s = streets.split(e.place);
      if (!s) {
        // a number alone after a municipality nobody has answered for yet: what it would set right
        const b = streets.bare(e.place);
        if (!b || b.houses !== undefined) continue;
        const house = houseWith(b.house, e.house?.trim());
        if (house === undefined) continue;
        const place = streets.townOf(b.town);
        const record = recordOf(place);
        const t = towns.get(b.key) ?? { town: streets.townOf(b.name), fixes: [], places: new Map<string, number>() };
        t.fixes.push({ owner: o.id, event: e.id, before: placeHouse(e.place, e.house), after: placeHouse(place, house), ...(record ? { record } : {}) });
        const written = e.place.normalize("NFC").trim();
        t.places.set(written, (t.places.get(written) ?? 0) + 1);
        towns.set(b.key, t);
        continue;
      }
      const place = streets.townOf(s.town, s.sentence);
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
  // what an older fix left of a sentence in the place ("v Lhotici v" of "v Lhotici v čp. 46", before prepositions were
  // known): the place as the rules split it now, the fact's house kept — only where the fact is as that fix left it
  const ownerOf = new Map<string, { owner: Person | Family; place?: string; house?: string }>();
  for (const o of owners(tree)) {
    if (o.retracted || (o as Person).mergedInto) continue;
    for (const e of o.events) if (!e.retracted && e.status !== "retracted") ownerOf.set(e.id, { owner: o, place: e.place, house: e.house });
  }
  const taken = new Set(out.fixes.map((f) => f.event));
  for (const it of readStreetsFile(tree).runs.flatMap((r) => r.items)) {
    const now = ownerOf.get(it.event);
    if (!now || taken.has(it.event) || !same(now.place, now.house, it.after)) continue;
    const s = streets.split(it.before.place);
    const place = s ? streets.townOf(s.town, s.sentence) : undefined;
    if (!place || place === it.after.place) continue;
    const record = recordOf(place);
    out.fixes.push({ owner: now.owner.id, event: it.event, before: it.after, after: placeHouse(place, it.after.house), ...(record ? { record } : {}) });
    taken.add(it.event);
  }
  out.towns = [...towns]
    .map(([key, t]) => ({ town: t.town, key, fixes: t.fixes, places: [...t.places].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p]) => p) }))
    .sort((a, b) => b.fixes.length - a.fixes.length || a.town.localeCompare(b.town));
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
    const towns = townAnswers(tree.root);
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [], ...(Object.keys(towns).length ? { towns } : {}) };
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

/** A person's answers for municipalities: by the name folded, the municipality and whether its numbers are houses. */
export type TownAnswers = Record<string, { town: string; houses: boolean }>;

/**
 * The fix: every fact found set right (the municipality its place, the street and the number its house) — one
 * operation, what it changed kept for its undo (STREET_PLACES_FILE), the person's answers on bare numbers with it
 * (`towns`; answers alone, nothing set right: their own operation). Inside withTreeLock.
 */
export function applyStreetPlaces(tree: Tree, items: StreetFix[], version: string, config?: (c: TreeConfig) => void, towns: TownAnswers = {}): { changed: number; records: number; left: number } {
  const { records, done, left } = rewrite(tree, items, "before");
  const answered = Object.entries(towns);
  if (!done.length && !answered.length) return { changed: 0, records: 0, left };
  const file = readStreetsFile(tree);
  const at = new Date().toISOString();
  if (done.length) file.runs.push({ at, version, items: done });
  if (answered.length) file.towns = { ...file.towns, ...Object.fromEntries(answered.map(([k, a]) => [k, { town: a.town, houses: a.houses, at }])) };
  const said = answered.map(([, a]) => `${a.town}: ${a.houses ? "houses" : "not houses"}`).join("; ");
  tree.putMany(
    records,
    [{ rel: STREET_PLACES_FILE, content: fileContent(file) }],
    done.length
      ? { op: "streetplace.fix", targets: records.map((r) => r.id).sort(), summary: `streets out of the places of facts: ${done.length} in ${records.length} records (fix street-places)${said ? `; numbers after a municipality: ${said}` : ""}` }
      : { op: "streetplace.towns", targets: [], summary: `numbers after a municipality: ${answered.length} answered (${said}) (fix street-places)` },
    config,
  );
  return { changed: done.length, records: records.length, left };
}

/** The persons' answers on bare numbers forgotten (strom fixes reopen street-places: asked again). Inside withTreeLock. */
export function forgetTownAnswers(tree: Tree, config?: (c: TreeConfig) => void): number {
  const file = readStreetsFile(tree);
  const n = Object.keys(file.towns ?? {}).length;
  if (!n) return 0;
  delete file.towns;
  tree.putMany([], [{ rel: STREET_PLACES_FILE, content: fileContent(file) }], { op: "streetplace.towns", targets: [], summary: `numbers after a municipality asked again: ${n} (fix street-places reopened)` }, config);
  return n;
}

/** What the fix changed and is not undone yet. */
export function streetPlacesDone(tree: Tree): StreetFix[] {
  return readStreetsFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each fact's place and house as they were — where still as the fix left them; one changed since is
 * left and counted. One operation; what the fix kept is emptied, the persons' answers on bare numbers with it.
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
