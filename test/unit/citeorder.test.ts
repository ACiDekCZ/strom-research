// The order of a fact's citations (spec 095 K1.1): the user's main citation first, then the primary record of the
// fact's own event (the earliest written first), the other QUAY 3, the rest by QUAY — never a later burial entry before
// the baptism of a birth. QUAY of a record of another event is 2 for the fact (V1). A citation the user removed is
// refused again unless with a reason (K3.2).

import { test } from "node:test";
import assert from "node:assert/strict";
import { clearRemoved, mainCitation, monthsApart, orderCitations, quayAt, recordOfFact, refuseRemoved, removedByUser, sourceEvents } from "../../src/core/citeorder.ts";
import { UsageError } from "../../src/core/errors.ts";
import type { Citation, Event, Source, SourceKind, UncitedEntry } from "../../src/core/model.ts";

const src = (id: string, kind: SourceKind, title: string, date?: string, over: Partial<Source> = {}): Source =>
  ({ id, type: "source", kind, title, information: "primary", form: "original", ...(date ? { date } : {}), ...over }) as Source;

/** Lhoták's records: his baptism, his death 60 years later (the death entry names his birth), a later index, a family memory. */
const SOURCES = new Map<string, Source>([
  ["S0001", src("S0001", "death", "Úmrtí Prokopa Lhotáka", "12 MAR 1911")],
  ["S0002", src("S0002", "baptism", "Křest Prokopa Lhotáka", "3 FEB 1850")],
  ["S0003", src("S0003", "index", "Index narozených", "1900", { form: "derivative" })],
  ["S0004", src("S0004", "family-memory", "Vyprávění Terezie")],
  ["S0005", src("S0005", "birth", "Narození Prokopa", "30 JAN 1850")],
  ["S0006", src("S0006", "baptism", "Крещение (opis 1870)", "1870")],
]);
const of = (id: string) => SOURCES.get(id);
const ids = (cs: Citation[]) => cs.map((c) => c.source);

test("K1.1: a later death entry never comes before the baptism of a birth", () => {
  const cites: Citation[] = [{ source: "S0001" }, { source: "S0004" }, { source: "S0003" }, { source: "S0002" }];
  assert.deepEqual(ids(orderCitations(cites, of, { kind: "BIRT", date: "1 FEB 1850" })), ["S0002", "S0001", "S0003", "S0004"]);
  // the stored order is left as it is
  assert.deepEqual(ids(cites), ["S0001", "S0004", "S0003", "S0002"]);
  // a death fact: the death entry is its record
  assert.deepEqual(ids(orderCitations(cites, of, { kind: "DEAT", date: "10 MAR 1911" })), ["S0001", "S0002", "S0003", "S0004"]);
});

test("K1.1: an original entry of the event nobody assessed is its record too, a later death entry after it", () => {
  const plain = (s: Source): Source => ({ ...s, information: "unknown" });
  const unassessed = (id: string) => (SOURCES.has(id) ? plain(SOURCES.get(id)!) : undefined);
  const cites: Citation[] = [{ source: "S0001" }, { source: "S0003" }, { source: "S0002" }];
  assert.deepEqual(ids(orderCitations(cites, unassessed, { kind: "BIRT", date: "1 FEB 1850" })), ["S0002", "S0001", "S0003"]);
  // the citation's own word that it is secondary for the fact: no primary record
  assert.deepEqual(ids(orderCitations([{ source: "S0001" }, { source: "S0002", information: "secondary" }], unassessed, { kind: "BIRT" })), ["S0001", "S0002"]);
});

test("K1.1: of two records of the event the earlier written first; one written over 12 months later is no primary record", () => {
  const cites: Citation[] = [{ source: "S0006" }, { source: "S0002" }, { source: "S0005" }];
  // S0006 (a copy written 20 years later, the source's number before none) — not the primary record of 1850
  assert.deepEqual(ids(orderCitations(cites, of, { kind: "BIRT", date: "1 FEB 1850" })), ["S0005", "S0002", "S0006"]);
  // a date missing does not decide: then all three are records, the earliest written first
  assert.deepEqual(ids(orderCitations(cites, of, { kind: "BIRT" })), ["S0005", "S0002", "S0006"]);
  assert.equal(monthsApart("1870", "1 FEB 1850"), 239);
  assert.equal(monthsApart("FEB 1850", "1 FEB 1850"), 0);
  assert.equal(monthsApart("nečitelné", "1850"), undefined);
});

test("K1.1: the user's main citation first; of two citations of one source the order they were added in", () => {
  const cites: Citation[] = [{ source: "S0002", locator: "fol. 7" }, { source: "S0003" }, { source: "S0002", locator: "fol. 8" }, { source: "S0001", main: { by: "user", at: "2026-11-15T09:30:00.000Z" } }];
  const ordered = orderCitations(cites, of, { kind: "BIRT", date: "1850" });
  assert.deepEqual(
    ordered.map((c) => `${c.source} ${c.locator ?? ""}`.trim()),
    ["S0001", "S0002 fol. 7", "S0002 fol. 8", "S0003"],
  );
  assert.equal(mainCitation(ordered)?.source, "S0001");
  assert.equal(mainCitation(orderCitations(cites.slice(0, 3), of, { kind: "BIRT" })), undefined, "none marked: none");
  // a citation of a source not there keeps among the lowest; a name's citations (no kind) by QUAY and number
  assert.deepEqual(ids(orderCitations([{ source: "S0099" }, { source: "S0004" }, { source: "S0003" }, { source: "S0001" }], of)), ["S0001", "S0003", "S0004", "S0099"]);
});

test("V1: QUAY of a record of another event is 2 at the fact, its own information says otherwise", () => {
  const death = of("S0001")!;
  assert.equal(quayAt(death, { source: "S0001" }, "BIRT"), 2, "the death entry's birth date is secondary");
  assert.equal(quayAt(death, { source: "S0001" }, "DEAT"), 3);
  assert.equal(quayAt(death, { source: "S0001" }), 3, "no fact: as the source has it");
  assert.equal(quayAt(death, { source: "S0001", information: "primary" }, "BIRT"), 3, "the citation's own word");
  assert.equal(quayAt(of("S0003")!, { source: "S0003" }, "BIRT"), 2, "an index: no event of its own");
  assert.equal(recordOfFact(of("S0002"), "BIRT"), true);
  assert.equal(recordOfFact(of("S0001"), "birt"), false);
  assert.equal(recordOfFact(of("S0003"), "BIRT"), undefined);
  assert.deepEqual(sourceEvents(of("S0001")), ["DEAT"]);
  assert.deepEqual(sourceEvents(of("S0004")), []);
});

test("K3.2: a citation the user removed is refused with its code; a reason closes the removal", () => {
  // the source of a fact as its ID, the reason in Czech decomposed (NFD) and in Cyrillic
  const e: Pick<Event, "id"> & { uncited: UncitedEntry[] } = { id: "E0001", uncited: [{ source: "S0001", at: "2026-11-15T09:30:00.000Z", by: "user", sync: "I0003" }] };
  assert.equal(removedByUser(e, "S0001")?.sync, "I0003");
  assert.equal(removedByUser(e, "S0002"), undefined);
  refuseRemoved(e, "S0002");
  assert.throws(
    () => refuseRemoved(e, "S0001"),
    (err: unknown) => err instanceof UsageError && err.code === "cite.removedByUser" && /--reason/u.test(String(err.hint)) && /2026-11-15/u.test(err.message),
  );
  const why = "zápis jmenuje Prokopa Lhotáka z Lhoty".normalize("NFD");
  const closed = clearRemoved(e, "S0001", why, "2026-11-15T10:00:00.000Z");
  assert.equal(removedByUser(closed, "S0001"), undefined);
  assert.deepEqual(closed.uncited[0]!.cleared, { at: "2026-11-15T10:00:00.000Z", reason: why });
  refuseRemoved(closed, "S0001");
  assert.equal(clearRemoved(e, "S0002", "запись", "2026-11-15T10:00:00.000Z"), e, "nothing removed: the same fact");
  // one register, two entries of the person: the removal of one place is no removal of another
  const placed: Pick<Event, "id"> & { uncited: UncitedEntry[] } = { id: "E0002", uncited: [{ source: "S0001", locator: "fol. 3", at: "2026-11-15T09:30:00.000Z", by: "user" }] };
  refuseRemoved(placed, "S0001", "fol. 4");
  assert.throws(() => refuseRemoved(placed, "S0001", "fol. 3".normalize("NFD")), UsageError);
  assert.throws(() => refuseRemoved(placed, "S0001"), UsageError, "no place: the whole source, the removed entry with it");
  assert.equal(clearRemoved(placed, "S0001", "jiný zápis", "2026-11-15T10:00:00.000Z", "fol. 4"), placed, "another place cited: the removal stays");
});
