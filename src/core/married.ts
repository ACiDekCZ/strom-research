// The names of a person after a marriage in order, the one now last (spec 010 K4.1, K4.2): one rule with the Strom app
// (its married-suggestion.ts lastMarriageSurnameIndex and marriage-order.ts marriagesInOrder).

import type { Family, Name, Person } from "./model.ts";
import { birthEvent, preferred, primaryName, sameFamilyName } from "./people.ts";

const MONTH = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * A date's place in time as the Strom app puts weddings in order: year, month and day of its first date ("ABT 1850"
 * 1850, "BET 1811 AND 1812" 1811), a "BEF" just before it; undefined for a date it cannot read.
 */
export function dateOrderKey(date: string | undefined): number | undefined {
  const s = date?.trim().toUpperCase().replace(/\s+/g, " ");
  if (!s) return undefined;
  const m = /^(?:(ABT|CAL|EST|BEF|AFT|BET|FROM|TO|INT) )?(?:(\d{1,2}) )?(?:([A-Z]{3}) )?(\d{3,4})(?!\d)/u.exec(s);
  if (!m) return undefined;
  const month = m[3] ? MONTH.indexOf(m[3]) + 1 : 0;
  if (m[3] && !month) return undefined;
  const key = Number(m[4]) * 10000 + month * 100 + (m[2] ? Number(m[2]) : 0);
  return m[1] === "BEF" ? key - 0.5 : key;
}

/** One marriage of a person: the spouse's surname, its wedding (none: undefined) and its place in time. */
export interface MarriageOf {
  surname: string;
  wedding?: number;
  /** The wedding, else just before the earliest of its divorce and its children's births; Infinity with none. */
  key: number;
  index: number;
}

/**
 * The marriages of a person (a family of two partners not only partners or separated — the Strom app's married or
 * divorced, its default), in the order of `families` (their FAMS): each spouse's surname, the name of their identity.
 */
export function marriagesOf(id: string, families: Family[], person: (id: string) => Person | undefined): MarriageOf[] {
  const out: MarriageOf[] = [];
  families.forEach((f, index) => {
    if (f.union === "partners" || f.union === "separated") return;
    const spouse = f.partners.find((x) => x !== id);
    const sp = spouse ? person(spouse) : undefined;
    if (!sp || sp.retracted) return;
    const wedding = dateOrderKey(preferred(f.events, "MARR")?.date);
    let key = wedding ?? Infinity;
    if (wedding === undefined) {
      const bounds = [preferred(f.events, "DIV")?.date, ...f.children.map((c) => { const k = person(c.person); return k ? birthEvent(k)?.date : undefined; })];
      for (const d of bounds) {
        const k = dateOrderKey(d);
        if (k !== undefined) key = Math.min(key, k - 0.5);
      }
    }
    out.push({ surname: primaryName(sp).surname, ...(wedding !== undefined ? { wedding } : {}), key, index });
  });
  return out;
}

/**
 * The spouses' surnames a name after a marriage comes from, the one now first: the marriages with a wedding date from
 * the latest back, then the others from the last in order (the order of the Strom app's marriagesInOrder).
 */
function surnamesLatestFirst(marriages: MarriageOf[]): string[] {
  const all = [...marriages].sort((a, b) => (a.key !== b.key ? (a.key < b.key ? -1 : 1) : a.index - b.index));
  const dated = all.filter((m) => m.wedding !== undefined).reverse();
  const undated = all.filter((m) => m.wedding === undefined).reverse();
  return [...dated, ...undated].map((m) => m.surname);
}

/**
 * The names after a marriage `names` (in the order they were written) in the order the files give them, the one now
 * last: the one the person is shown by (Name.primary), else the one the user chose (Name.marriedNow, spec 010 K4.2),
 * else the name of the spouse of the latest marriage (K4.1: a wife's form of his surname too — Novák, Nováková). The
 * others from the oldest marriage on, a name of no spouse before them all; between equals the order they were written.
 */
export function marriedInOrder(names: Name[], marriages: MarriageOf[]): Name[] {
  const spouses = surnamesLatestFirst(marriages);
  const ranked = names.map((n, i) => {
    const at = spouses.findIndex((s) => sameFamilyName(n.surname, s));
    return { n, i, rank: at < 0 ? Infinity : at };
  });
  ranked.sort((a, b) => (a.rank !== b.rank ? (a.rank > b.rank ? -1 : 1) : a.i - b.i));
  const order = ranked.map((r) => r.n);
  const chosen = names.find((n) => n.primary) ?? names.find((n) => n.marriedNow);
  return chosen ? [...order.filter((n) => n !== chosen), chosen] : order;
}

/** The names of a person in a Strom file's order: the name of their identity first, the names after a marriage last, the one now the very last. */
export function namesInOrder(p: Person, marriages: MarriageOf[]): Name[] {
  const primary = primaryName(p);
  const married = p.names.filter((n) => n !== primary && n.kind === "married");
  return [primary, ...p.names.filter((n) => n !== primary && n.kind !== "married"), ...marriedInOrder(married, marriages)];
}
