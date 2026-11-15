// The order of a fact's citations (spec 095 K1.1): one rule for the research and the Strom app, computed from what a
// GEDCOM carries, so that the first citation of a fact is its record — the baptism entry of a birth, never a later
// burial entry — and every program shows the same document by it.
//
//   1. the main citation the user chose (Citation.main), at most one of a fact;
//   2. the primary record of that event: a source of the kind of the fact (EVENTS_RECORDED below), QUAY 3 — or an
//      original whose information nobody assessed (QUAY 2 only for want of a word: the entry of the event itself) —,
//      written at most 12 months from the fact (a date missing or unreadable does not decide) — the earliest first;
//   3. the other citations of QUAY 3;
//   4. the rest by QUAY, highest first;
//   5. ties: the source's number, then the order the citations were added in.
//
// The stored order is never changed (nothing migrated): the order is the export's, the brief's and the CLI's.

import { informationOf, quay } from "./evidence.ts";
import { dateMonths } from "./gdate.ts";
import { UsageError } from "./errors.ts";
import type { Citation, Event, Source, SourceKind, UncitedEntry } from "./model.ts";

/** The events a source of a kind records, as GEDCOM 5.5.1 EVENTS_RECORDED (`1 DATA / 2 EVEN` on the source record). */
export const SOURCE_EVENTS: Partial<Record<SourceKind, readonly string[]>> = {
  baptism: ["CHR"],
  birth: ["BIRT"],
  marriage: ["MARR"],
  death: ["DEAT"],
  burial: ["BURI"],
  census: ["CENS"],
};

/** The events whose primary record a fact of a kind is (the table of spec 095, oddíl 2): none for any other kind. */
const FACT_RECORDS: Record<string, readonly string[]> = {
  BIRT: ["BIRT", "CHR", "BAPM"],
  CHR: ["BIRT", "CHR", "BAPM"],
  BAPM: ["BIRT", "CHR", "BAPM"],
  DEAT: ["DEAT", "BURI", "CREM"],
  BURI: ["DEAT", "BURI", "CREM"],
  CREM: ["DEAT", "BURI", "CREM"],
  MARR: ["MARR"],
  MARB: ["MARR"],
  MARL: ["MARR"],
  ENGA: ["MARR"],
  CENS: ["CENS"],
};

/** The events a source records (its kind's), none for a kind of no event (an index, a certificate, a book …). */
export function sourceEvents(src: Pick<Source, "kind"> | undefined): readonly string[] {
  return (src && SOURCE_EVENTS[src.kind]) ?? [];
}

/** Is the source a record of this fact's own event (its kind against the fact's)? Undefined: the fact or the source has no such kind. */
export function recordOfFact(src: Pick<Source, "kind"> | undefined, factKind: string | undefined): boolean | undefined {
  const wanted = factKind ? FACT_RECORDS[factKind.toUpperCase()] : undefined;
  const has = sourceEvents(src);
  if (!wanted || !has.length) return undefined;
  return has.some((e) => wanted.includes(e));
}

/**
 * GEDCOM QUAY of a fact's citation (spec 095 V1): a record of another event than the fact (a burial entry at a birth)
 * whose citation says no information of its own is secondary for it — the source's primary information is the burial's,
 * not the birth's. Everything else as `quay` has it. Only the export and the order go by it (the status does not).
 */
export function quayAt(src: Source | undefined, c: Citation, factKind?: string): 0 | 1 | 2 | 3 {
  if (src && factKind && c.information === undefined && recordOfFact(src, factKind) === false && informationOf(src, c) === "primary")
    return quay(src, { ...c, information: "secondary" });
  return quay(src, c);
}

/** The number of a source's ID (S0012 → 12); none: a source of no number, after every numbered one. */
function sourceNumber(id: string): number {
  const m = /^S(\d+)$/i.exec(id);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

/** The gap between two dates in months, as loosely as each is written (0 where they overlap); undefined: either unreadable. */
export function monthsApart(a: string | undefined, b: string | undefined): number | undefined {
  const [x, y] = [dateMonths(a), dateMonths(b)];
  if (!x || !y) return undefined;
  return Math.max(0, x.min - y.max, y.min - x.max);
}

export interface OrderOf {
  /** The fact's GEDCOM tag (none: a name's or a record's own citations — no primary record there). */
  kind?: string | undefined;
  /** The fact's date. */
  date?: string | undefined;
}

/**
 * A fact's citations in the order of spec 095 K1.1 (a new array; the stored one is left as it is). `source` gives the
 * research's source of an ID (none: a citation of a source not there, kept in its place among the lowest).
 */
export function orderCitations<C extends Citation>(citations: readonly C[], source: (id: string) => Source | undefined, fact: OrderOf = {}): C[] {
  const keyed = citations.map((c, i) => {
    const src = source(c.source);
    const q = src ? quayAt(src, c, fact.kind) : -1;
    const gap = src?.date && fact.date ? monthsApart(src.date, fact.date) : undefined;
    const original = q === 3 || (q === 2 && src?.form === "original" && informationOf(src, c) === "unknown");
    const primary = original && recordOfFact(src, fact.kind) === true && (gap === undefined || gap <= 12);
    const written = src?.date ? dateMonths(src.date)?.min : undefined;
    const rank = c.main ? 0 : primary ? 1 : q === 3 ? 2 : 3;
    return { c, i, rank, q, written, n: sourceNumber(c.source) };
  });
  keyed.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.rank === 1) {
      // the earlier written first, the undated after the dated
      const [x, y] = [a.written ?? Number.POSITIVE_INFINITY, b.written ?? Number.POSITIVE_INFINITY];
      if (x !== y) return x - y;
    }
    if (a.rank === 3 && a.q !== b.q) return b.q - a.q;
    if (a.n !== b.n) return a.n - b.n;
    return a.i - b.i;
  });
  return keyed.map((k) => k.c);
}

/**
 * The main citation of a fact as the research gives it (spec 095 3.1): the one marked, and of two citations of the same
 * source at it the first in the order — none marked: none.
 */
export function mainCitation<C extends Citation>(ordered: readonly C[]): C | undefined {
  const first = ordered[0];
  return first?.main ? first : undefined;
}

// ── citations the user removed from a fact (spec 095 K3.2, K3.3) ──

/**
 * The user's removal of this source from the fact still in force (none: the fact may cite it). With `locator` (a place
 * in the source, "" none): only a removal of that place, or of the whole source — one register may hold a person's
 * baptism and burial entries, the user's removal of one is not a removal of the other; no place given: any removal.
 */
export function removedByUser(e: Pick<Event, "uncited">, source: string, locator?: string): UncitedEntry | undefined {
  const at = (l: string | undefined) => (l ?? "").normalize("NFC").trim();
  return e.uncited?.find((u) => u.source === source && !u.cleared && (locator === undefined || !at(u.locator) || !at(locator) || at(u.locator) === at(locator)));
}

/** Refuse a citation the user removed from the fact: an agent cites it again only with a reason (`strom cite … --reason`). */
export function refuseRemoved(e: Pick<Event, "id" | "uncited">, source: string, locator?: string): void {
  const u = removedByUser(e, source, locator ?? "");
  if (!u) return;
  throw new UsageError(`the user removed ${source} from ${e.id} (${u.at.slice(0, 10)}): it is not cited there again on its own`, {
    code: "cite.removedByUser",
    params: { fact: e.id, source, at: u.at },
    hint: `only with a new reason why the record belongs to this fact: strom cite ${e.id} ${source} --reason "<why>" — else leave it out`,
  });
}

/** The fact with the user's removals of a source closed (of that place in it, `locator` given): cited again (by the user, or with a reason). */
export function clearRemoved<E extends Pick<Event, "uncited">>(e: E, source: string, reason: string, at: string, locator?: string): E {
  if (!removedByUser(e, source, locator)) return e;
  return { ...e, uncited: e.uncited!.map((u) => (removedByUser({ uncited: [u] }, source, locator) ? { ...u, cleared: { at, reason } } : u)) };
}
