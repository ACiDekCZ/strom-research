// What the person said of a house in the Strom app, read back by strom sync (spec 030 part 2, §4.1 answer 8).
//
// The app keeps a house of its tree as a record of its own (its data version 27):
//
//   0 @H1@ _HOUSE
//   1 PLAC <the municipality, as its facts write it>
//   1 _NUM <the number as written>        (several: the numbers in time, each with 2 DATE FROM … TO …)
//   1 NAME <its name after the family>
//   1 _SAME @H2@                          (the person joined the two: one house)
//   1 _STROM_KEY <the house's key>        (as the research gave it: core/houses.ts keyOfHouse)
//
// All of it is the person's word: the name is theirs (nameBy user, over the research's and an import's), a number the
// research lacks is added as theirs (origin user; the research's numbers stay as they are), the houses joined are kept
// on the record (same: [A…]). Nothing is ever taken away: a house the file no longer has, a name it no longer gives,
// a number it leaves out — the research keeps them. A house of a municipality the research has no place of is only
// said: nothing is guessed. A house the research has no record of yet gets one when the file says something of it.
//
// The research writes no _HOUSE back to the GEDCOM yet (the app reads it only from its data version 27: a gate of
// that version first, gedcom/export.ts).

import { children, val, type GedNode } from "../gedcom/parse.ts";
import type { House, HouseNumber, Place } from "./model.ts";
import { addHouse, houseIndex, houseRows, recordOf, type HouseIndex, type HouseRow } from "./houses.ts";
import { appHouseKey, houseRowKey } from "./streets.ts";
import { importDate } from "./import.ts";
import { now, type Tree } from "./tree.ts";
import { update } from "./records.ts";
import { UsageError } from "./errors.ts";

/** A number of a house as the file gives it: written as is, from and to when. */
export interface SHouseNumber {
  number: string;
  from?: string;
  to?: string;
}

/** A house as the Strom app's file has it (`0 @Hn@ _HOUSE`). */
export interface SHouse {
  /** Its xref in the file, without the @ ("H1"). */
  xref: string;
  /** The municipality (PLAC), NFC. */
  town: string;
  numbers: SHouseNumber[];
  name?: string;
  /** The houses of the file it is joined with (their xrefs). */
  same: string[];
  /** The key the research gave it (_STROM_KEY). */
  key?: string;
}

const clean = (s: string | undefined): string => (s ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();

/** FROM … TO …, FROM …, TO …, or one date: the number's from and to. */
function numberDates(raw: string | undefined): Pick<SHouseNumber, "from" | "to"> {
  const d = clean(raw).toUpperCase();
  if (!d) return {};
  const m = /^(?:FROM\s+(.+?))?\s*(?:TO\s+(.+))?$/u.exec(d);
  const from = m?.[1] ? importDate(m[1]) : undefined;
  const to = m?.[2] ? importDate(m[2]) : undefined;
  if (from || to) return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
  const one = importDate(d);
  return one ? { from: one } : {};
}

/** The houses of a GEDCOM file (`0 @Hn@ _HOUSE`), by their xref: undefined when it has none. */
export function gedHouses(records: GedNode[]): Map<string, SHouse> | undefined {
  const out = new Map<string, SHouse>();
  for (const r of records) {
    if (r.tag !== "_HOUSE" || !r.xref) continue;
    const xref = r.xref.replace(/@/gu, "");
    const numbers = children(r, "_NUM")
      .map((n) => ({ number: clean(n.value), ...numberDates(val(n, "DATE")) }))
      .filter((n) => n.number);
    const name = clean(val(r, "NAME"));
    const key = clean(val(r, "_STROM_KEY"));
    out.set(xref, {
      xref,
      town: clean(val(r, "PLAC")),
      numbers,
      ...(name ? { name } : {}),
      same: children(r, "_SAME")
        .map((n) => n.value.replace(/@/gu, "").trim())
        .filter(Boolean),
      ...(key ? { key } : {}),
    });
  }
  return out.size ? out : undefined;
}

/** A change of a house the file brings: its name, a number, two houses joined — or a municipality the research has no place of. */
export interface HouseChange {
  what: "name" | "number" | "same" | "town";
  /** The house's key (`<municipality>|<number>`, as the app computes it). */
  key: string;
  /** The municipality as the file writes it. */
  town: string;
  /** The number the house is known by. */
  house: string;
  /** The municipality's place record (L…) and the house's record (A…), where the research has them. */
  place?: string;
  id?: string;
  /** name: the file's name, and the research's before ("" none). */
  name?: string;
  was?: string;
  /** number: the number the research lacks. */
  number?: SHouseNumber;
  /** same: the house it is joined with. */
  same?: { key: string; house: string; id?: string };
}

/** A house of the file as the research knows it: its municipality, its key, its row (where the research has one). */
interface Resolved {
  place: Place;
  key: string;
  house: string;
  row?: HouseRow;
}

/** The number a house is known by: the one it has now (no end), else the last given. */
function currentNumber(h: SHouse): string | undefined {
  return [...h.numbers].reverse().find((n) => !n.to)?.number ?? h.numbers.at(-1)?.number;
}

function resolve(h: SHouse, index: HouseIndex, rows: HouseRow[]): Resolved | undefined {
  const place = h.town ? index.placeOf(h.town) : undefined;
  if (!place) return undefined;
  const town = index.townOf(place);
  const ofPlace = (r: HouseRow) => !r.place.id || r.place.id === place.id;
  // the key the research gave it, else the number it has now, else its earlier ones (latest first), else the one it has now
  const byKey = h.key ? rows.find((r) => r.key === h.key && ofPlace(r)) : undefined;
  if (byKey) return { place, key: byKey.key, house: byKey.house, row: byKey };
  const number = currentNumber(h);
  for (const n of [...new Set([number, ...[...h.numbers].reverse().map((x) => x.number)])]) {
    if (!n) continue;
    const key = houseRowKey(town, n);
    const row = rows.find((r) => r.key === key);
    if (row) return { place, key, house: row.house, row };
  }
  return number ? { place, key: houseRowKey(town, number), house: number } : undefined;
}

/** A number of the file the research has already: the same number (as the app keys it) in the record's numbers or as its own. */
function hasNumber(rec: House | undefined, house: string, n: SHouseNumber): boolean {
  const k = appHouseKey(n.number);
  if (rec?.numbers.some((x) => !x.notSame && appHouseKey(x.number) === k)) return true;
  // the house's own number without a time: nothing to add
  return !n.from && !n.to && appHouseKey(house) === k && !rec?.numbers.length;
}

/** What the file's houses change in the research: never anything taken away. */
export function planHouses(tree: Tree, houses: Map<string, SHouse> | undefined): HouseChange[] {
  if (!houses?.size) return [];
  const index = houseIndex(tree);
  const rows = houseRows(tree, { index });
  const out: HouseChange[] = [];
  const known = new Map<string, Resolved | undefined>();
  const of = (xref: string): Resolved | undefined => {
    if (!known.has(xref)) {
      const h = houses.get(xref);
      known.set(xref, h ? resolve(h, index, rows) : undefined);
    }
    return known.get(xref);
  };
  const joined = new Set<string>();
  for (const h of houses.values()) {
    const r = of(h.xref);
    const said = currentNumber(h) ?? "";
    if (!r) {
      // a municipality the research has no place of: said, nothing guessed (only when the house says something)
      if (h.town && (h.name || h.numbers.length || h.same.length)) out.push({ what: "town", key: h.key ?? "", town: h.town, house: said });
      continue;
    }
    const rec = r.row?.record ? (tree.get<House>(r.row.record.id) ?? r.row.record) : undefined;
    const base = { key: r.key, town: h.town, house: r.house, place: r.place.id, ...(rec ? { id: rec.id } : {}) };
    if (h.name && h.name !== clean(rec?.name)) out.push({ ...base, what: "name", name: h.name, was: rec?.name ?? "" });
    const added = new Set<string>();
    for (const n of h.numbers) {
      const k = appHouseKey(n.number);
      if (added.has(k) || hasNumber(rec, r.house, n)) continue;
      added.add(k);
      out.push({ ...base, what: "number", number: n });
    }
    for (const x of h.same) {
      const o = of(x);
      if (!o || o.key === r.key) continue;
      const pair = [r.key, o.key].sort().join("\n");
      if (joined.has(pair)) continue;
      joined.add(pair);
      const other = o.row?.record ? (tree.get<House>(o.row.record.id) ?? o.row.record) : undefined;
      if (rec && other && (rec.same?.includes(other.id) || other.same?.includes(rec.id))) continue;
      out.push({ ...base, what: "same", same: { key: o.key, house: o.house, ...(other ? { id: other.id } : {}) } });
    }
  }
  return out;
}

/** What applying a change of a house did, for its undo: the records made, each record's state before. */
export interface HouseApplied {
  made: string[];
  edits: { id: string; before: string }[];
  /** Not written: the name is the person's, and this is not the person's sync. */
  kept?: true;
}

/** The record of a house of the file: the one the research has, one of the tree's house, else one the person made. */
function recordFor(tree: Tree, key: string, place: string | undefined, house: string, made: string[]): House {
  const row = houseRows(tree).find((r) => r.key === key);
  if (row?.record) return tree.get<House>(row.record.id) ?? row.record;
  if (row?.tree?.place) {
    const had = new Set(tree.list<House>("house").map((h) => h.id));
    const rec = recordOf(tree, row);
    if (!had.has(rec.id)) made.push(rec.id);
    return rec;
  }
  const p = place ? tree.get<Place>(place) : undefined;
  if (!p || p.retracted) throw new UsageError(`the municipality of the house "${key}" is no place of the research`, { code: "house.town", params: { house: key } });
  const rec = addHouse(tree, p, house, { byUser: true });
  made.push(rec.id);
  return rec;
}

/** A record's name as it was before a sync named it (its undo); a number's, a join's undo names what it added. */
const nameBefore = (h: House) => JSON.stringify({ name: h.name ?? null, nameBy: h.nameBy ?? null });

/** Write one change of a house: `by` the person (their sync), else the research (never over the person's name). */
export function applyHouseChange(tree: Tree, c: HouseChange, by: "user" | "research", reason: string): HouseApplied {
  const made: string[] = [];
  const edits: HouseApplied["edits"] = [];
  if (c.what === "town") return { made, edits };
  const rec = recordFor(tree, c.key, c.place, c.house, made);
  if (c.what === "name" && c.name) {
    if (by !== "user" && rec.nameBy === "user" && rec.name) return { made, edits, kept: true };
    if (rec.name === c.name && rec.nameBy === by) return { made, edits };
    edits.push({ id: rec.id, before: nameBefore(rec) });
    update<House>(tree, rec.id, "house", (h) => ({ ...h, name: c.name!, nameBy: by }), { op: "house.set", summary: `${rec.id} name "${c.name}": ${reason}`, reason });
  } else if (c.what === "number" && c.number) {
    const n = c.number;
    if (hasNumber(rec, rec.house, n)) return { made, edits };
    let id = "";
    update<House>(
      tree,
      rec.id,
      "house",
      (h) => {
        let max = 0;
        for (const x of h.numbers) max = Math.max(max, Number(/^n(\d+)$/u.exec(x.id)?.[1] ?? 0));
        id = `n${max + 1}`;
        const item: HouseNumber = { id, origin: by, at: now().slice(0, 10), number: n.number, ...(n.from ? { from: n.from } : {}), ...(n.to ? { to: n.to } : {}), certainty: "high" };
        return { ...h, numbers: [...h.numbers, item] };
      },
      { op: "house.item", summary: `${rec.id} +number ${n.number}: ${reason}`, reason },
    );
    edits.push({ id: rec.id, before: JSON.stringify({ numbers: [id] }) });
  } else if (c.what === "same" && c.same) {
    const other = recordFor(tree, c.same.key, c.place, c.same.house, made);
    if (other.id === rec.id) return { made, edits };
    for (const [a, b] of [
      [rec, other],
      [other, rec],
    ] as const) {
      const now_ = tree.get<House>(a.id) ?? a;
      if (now_.same?.includes(b.id)) continue;
      edits.push({ id: a.id, before: JSON.stringify({ same: [b.id] }) });
      update<House>(tree, a.id, "house", (h) => ({ ...h, same: [...(h.same ?? []), b.id] }), { op: "house.set", summary: `${a.id} the same house as ${b.id}: ${reason}`, reason });
    }
  }
  return { made, edits };
}

/** Undo a change of a house a sync made: its name as it was, the numbers and the joins it added taken off. */
export function undoHouseEdit(tree: Tree, id: string, before: string, reason: string): void {
  const h = tree.get<House>(id);
  if (!h || h.retracted) return;
  const b = JSON.parse(before || "{}") as { name?: string | null; nameBy?: House["nameBy"] | null; numbers?: string[]; same?: string[] };
  update<House>(
    tree,
    id,
    "house",
    ({ name: _n, nameBy: _b, same: _s, ...x }) => {
      const same = (h.same ?? []).filter((s) => !(b.same ?? []).includes(s));
      const name = "name" in b ? b.name : h.name;
      const nameBy = "nameBy" in b ? b.nameBy : h.nameBy;
      return {
        ...x,
        ...(name ? { name } : {}),
        ...(name && nameBy ? { nameBy } : {}),
        numbers: x.numbers.filter((n) => !(b.numbers ?? []).includes(n.id)),
        ...(same.length ? { same } : {}),
      } as House;
    },
    { op: "house.set", summary: `${id} as before: ${reason}`, reason },
  );
}

/** Undo a house record a sync made: retracted with the reason. */
export function undoHouseAdd(tree: Tree, id: string, reason: string): void {
  const h = tree.get<House>(id);
  if (!h || h.retracted) return;
  update<House>(tree, id, "house", (x) => ({ ...x, retracted: { at: now(), reason } }), { op: "house.retract", summary: `${id} retracted: ${reason}`, reason });
}
