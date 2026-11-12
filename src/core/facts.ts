// The facts of the tree as rows (strom facts): one row is one fact of a person — or of a family (a marriage), then a
// row for each partner among the people asked about — with whom it is of, how that person is related to the person
// the question is about (the main person, or --of), what it says, where, when, how sure and on what sources. Read only.
//
// Retracted persons, families and facts never; a disproven fact only when it is asked for (--status disproven). The
// filters all apply together; several words of a value are any of them. A word of a value is found at the start of a
// word of the fact's value, label or cause (never its note), folded (no accents, any script), with the forms of its
// occupation in other languages when it is one (core/occupations.ts) — "exact": the word itself, as a whole word.
//
// Whom the rows are of (kin): the ancestors of the person (and the person), the blood relatives (those ancestors and
// all their descendants: the side branches too), the family (the blood relatives and their partners), or all. The
// sets come from the families' links; how each person is related (core/relation.ts) is worked out only for the rows
// found, from one view of the person's family (relationsFrom) — no walk over the tree for each row.

import type { Event, Family, Person, Place, Source, Status } from "./model.ts";
import { STATUSES, eventKind } from "./model.ts";
import { ancestorGenerations, displayName, familiesAsPartner, lifespan, primaryName } from "./people.ts";
import { familyForms, isWomansForm, surnameFormOf } from "./surnames.ts";
import { surnameForms } from "./people.ts";
import { occupationMatcher, type OccupationMatcher } from "./occupations.ts";
import { relationsFrom, type Relation, type RelationTerm } from "./relation.ts";
import { recordIndex } from "./placeid.ts";
import { dateYears } from "./gdate.ts";
import { foldText, tokens } from "./text.ts";
import { houseKey } from "./house.ts";
import { searchText } from "./searchtext.ts";
import type { Tree } from "./tree.ts";

export const KIN_SETS = ["ancestors", "blood", "family", "all"] as const;
export type KinSet = (typeof KIN_SETS)[number];

export const FACT_GROUPS = ["generation", "kin", "place", "decade", "surname"] as const;
export type FactGroup = (typeof FACT_GROUPS)[number];

/** The statuses a fact is shown with unless --status says which: all but disproven (and retracted, never). */
export const SHOWN_STATUSES: Status[] = ["proven", "probable", "possible", "lead"];
/** The statuses --status takes. */
export const ASKED_STATUSES = STATUSES.filter((s) => s !== "retracted");

export interface FactQuery {
  /** The person the relations are to (P…). */
  of: string;
  kin: KinSet;
  /** GEDCOM tags (OCCU, BIRT, …). */
  kinds?: string[];
  /** Words of the value: any of them. */
  values?: string[];
  /** The words as whole words, without the forms of an occupation. */
  exact?: boolean;
  place?: string;
  house?: string;
  years?: { from: number; to: number };
  surname?: string;
  /** A source's ID (S…), or words of its title. */
  source?: string;
  statuses?: Status[];
}

export interface FactRow {
  person: Person;
  /** The record the fact is of: the person, or a family of theirs. */
  owner: Person | Family;
  fact: Event;
  /** How the person is related to `of`: none for `of` itself and for a person not related. */
  relation?: Relation;
  /** The person is `of`. */
  self: boolean;
  /** The person is `of` or one of their ancestors: their generation (`of` 1, the parents 2, …). */
  line?: number;
  sources: { id: string; title: string }[];
}

export interface FactAnswer {
  of: Person;
  kin: KinSet;
  /** The forms of the words asked for, as the list of occupations writes them (the words themselves when none). */
  variants: string[];
  /** Whether some word asked for is an occupation of the list (its forms in other languages found too). */
  known: boolean;
  rows: FactRow[];
  /** The people of the rows. */
  people: number;
  /** People of the set whose record has a word asked for, but no fact of it (a surname, a note): what strom find finds. */
  elsewhere: string[];
}

/** A kind as typed (OCCU, occu, occupation): its GEDCOM tag. */
export function factKind(input: string): string {
  const t = input.trim();
  return eventKind(t) ?? t.toUpperCase();
}

/** "1750-1850", "1750–1850", "1750": the years, both ends in; undefined when it is none. */
export function parseYears(input: string): { from: number; to: number } | undefined {
  const m = /^\s*(\d{3,4})\s*(?:[-–—]\s*(\d{3,4}))?\s*$/u.exec(input);
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

const live = (p: Person | undefined): p is Person => !!p && p.type === "person" && !p.retracted && !p.mergedInto;

/** The people the rows are of: the set of `kin` around `of`, and the line (`of` and their ancestors) with generations. */
export function kinSet(tree: Tree, of: string, kin: KinSet): { people: Set<string>; line: Map<string, number> } {
  const line = ancestorGenerations(tree, of);
  for (const id of [...line.keys()]) if (!live(tree.get<Person>(id))) line.delete(id);
  if (kin === "all") return { people: new Set(tree.list<Person>("person").filter(live).map((p) => p.id)), line };
  const people = new Set(line.keys());
  if (kin === "ancestors") return { people, line };
  // the ancestors' descendants: every child of a family of theirs, down
  const queue = [...people];
  while (queue.length) {
    const id = queue.pop()!;
    for (const f of familiesAsPartner(tree, id))
      for (const c of f.children)
        if (!people.has(c.person) && live(tree.get<Person>(c.person))) {
          people.add(c.person);
          queue.push(c.person);
        }
  }
  if (kin === "family")
    for (const id of [...people])
      for (const f of familiesAsPartner(tree, id)) for (const p of f.partners) if (!people.has(p) && live(tree.get<Person>(p))) people.add(p);
  return { people, line };
}

/** Do the folded words of a text begin with each word asked for (any order)? */
function wordsBegin(text: string, asked: string[]): boolean {
  const have = tokens(text);
  return asked.every((a) => have.some((h) => h.startsWith(a)));
}

/** The facts of the tree that answer the query, with whom each is of and how they are related. */
export function findFacts(tree: Tree, q: FactQuery): FactAnswer {
  const of = tree.get<Person>(q.of);
  if (!live(of)) throw new Error(`no person ${q.of}`);
  const { people, line } = kinSet(tree, of.id, q.kin);
  const kinds = q.kinds?.length ? new Set(q.kinds.map(factKind)) : undefined;
  const statuses = new Set<string>(q.statuses?.length ? q.statuses : SHOWN_STATUSES);
  const matchers: OccupationMatcher[] = (q.values ?? []).map((v) => occupationMatcher(v, { exact: !!q.exact })).filter((m) => m.word);
  const valueOf = (e: Event) => !matchers.length || matchers.some((m) => m.matches(e.value) || m.matches(e.label) || m.matches(e.cause));
  const placeAsked = q.place ? tokens(q.place) : [];
  const placeRecord = placeAsked.length ? recordIndex(tree) : undefined;
  const placeCache = new Map<string, boolean>();
  const placeOf = (e: Event) => {
    if (!placeAsked.length) return true;
    if (!e.place?.trim()) return false;
    let ok = placeCache.get(e.place);
    if (ok === undefined) {
      const rec: Place | undefined = placeRecord!(e.place.normalize("NFC").trim());
      ok = wordsBegin(e.place, placeAsked) || (!!rec && rec.names.some((n) => wordsBegin(n.name, placeAsked)));
      placeCache.set(e.place, ok);
    }
    return ok;
  };
  const house = q.house ? houseKey(q.house) : undefined;
  const sources = new Map(tree.list<Source>("source").map((s) => [s.id, s]));
  const sourceAsked = q.source?.trim();
  const sourceId = sourceAsked && /^[Ss]\d+$/u.test(sourceAsked) ? `S${sourceAsked.slice(1).padStart(4, "0")}` : undefined;
  const sourceWords = sourceAsked && !sourceId ? foldText(sourceAsked) : undefined;
  const sourceOf = (e: Event) =>
    !sourceAsked ||
    (e.citations ?? []).some((c) => (sourceId ? c.source === sourceId : !!sourceWords && foldText(sources.get(c.source)?.title ?? "").includes(sourceWords)));
  const surname = q.surname ? familyForms(tree, q.surname) : undefined;
  const surnameOf = (p: Person) => !surname || p.names.some((n) => [...surnameForms(surnameFormOf(n.surname ?? ""))].some((f) => surname.has(f)));
  const factOk = (e: Event) =>
    !e.retracted &&
    statuses.has(e.status) &&
    (!kinds || kinds.has(e.kind)) &&
    valueOf(e) &&
    placeOf(e) &&
    (!house || (!!e.house && houseKey(e.house) === house)) &&
    (!q.years || dateYears(e.date ?? "").some((y) => y >= q.years!.from && y <= q.years!.to)) &&
    sourceOf(e);

  const found: Omit<FactRow, "relation" | "sources">[] = [];
  const families = new Set<string>();
  for (const id of people) {
    const p = tree.get<Person>(id)!;
    if (!surnameOf(p)) continue;
    for (const e of p.events) if (factOk(e)) found.push({ person: p, owner: p, fact: e, self: id === of.id, ...(line.has(id) ? { line: line.get(id)! } : {}) });
    for (const f of familiesAsPartner(tree, id)) {
      if (families.has(`${f.id} ${id}`)) continue;
      families.add(`${f.id} ${id}`);
      for (const e of f.events) if (factOk(e)) found.push({ person: p, owner: f, fact: e, self: id === of.id, ...(line.has(id) ? { line: line.get(id)! } : {}) });
    }
  }

  // how each person found is related: one view of `of`'s family, each person once
  const relationOf = relationsFrom(tree, of.id);
  const relations = new Map<string, Relation | undefined>();
  const rows: FactRow[] = found.map((r) => {
    if (!relations.has(r.person.id)) relations.set(r.person.id, r.self ? undefined : relationOf(r.person.id));
    const relation = relations.get(r.person.id);
    const cited = [...new Set((r.fact.citations ?? []).map((c) => c.source))];
    return { ...r, ...(relation ? { relation } : {}), sources: cited.map((s) => ({ id: s, title: sources.get(s)?.title ?? "" })) };
  });
  rows.sort(byRow);

  // the people of the set who have a word asked for in their record, but no fact of it of the kinds asked
  const elsewhere: string[] = [];
  if (matchers.length) {
    const words = matchers.map((m) => foldText(m.word)).filter(Boolean);
    const withFact = new Set<string>();
    for (const id of people) {
      const p = tree.get<Person>(id)!;
      const has = (e: Event) => !e.retracted && e.status !== "retracted" && (!kinds || kinds.has(e.kind)) && valueOf(e);
      if (p.events.some(has) || familiesAsPartner(tree, id).some((f) => f.events.some(has))) withFact.add(id);
    }
    for (const id of people) {
      if (withFact.has(id)) continue;
      // the person's record as strom find reads it, without the facts taken back
      const p = tree.get<Person>(id)!;
      const hay = foldText(searchText({ ...p, events: p.events.filter((e) => !e.retracted && e.status !== "retracted") }));
      if (words.some((w) => hay.includes(w))) elsewhere.push(id);
    }
  }
  const variants = [...new Set(matchers.flatMap((m) => m.variants))];
  return { of, kin: q.kin, variants, known: matchers.some((m) => m.known), rows, people: new Set(rows.map((r) => r.person.id)).size, elsewhere };
}

/** The line first by generation (the person, the parents, …), then the others by generation, each person's facts by date. */
function byRow(a: FactRow, b: FactRow): number {
  const ga = a.line ?? a.relation?.generation ?? -Infinity;
  const gb = b.line ?? b.relation?.generation ?? -Infinity;
  const la = a.line !== undefined ? 0 : 1;
  const lb = b.line !== undefined ? 0 : 1;
  if (la !== lb) return la - lb;
  if (ga !== gb) return la === 0 ? ga - gb : gb - ga;
  if (a.person.id !== b.person.id) return a.person.id < b.person.id ? -1 : 1;
  const ya = dateYears(a.fact.date ?? "")[0] ?? Infinity;
  const yb = dateYears(b.fact.date ?? "")[0] ?? Infinity;
  return ya - yb;
}

// ── groups ──────────────────────────────────────────────────────────────────

export interface FactGroupCount {
  /** The group's key: "G5", "side", a term, a place, "1810s", a surname; "unknown" where the row has none. */
  key: string;
  people: number;
  facts: number;
  rows: FactRow[];
}

type Lang = keyof RelationTerm;
export function termLang(lang: string): Lang {
  const l = lang.toLowerCase().slice(0, 2);
  return l === "cs" || l === "de" || l === "pl" ? l : "en";
}

/** A surname's key in a group: the man's form of a woman's one ("Lhotáková", "Lhoták" one group), folded. */
function surnameKey(surname: string): string {
  const form = surnameFormOf(surname);
  const own = foldText(form);
  if (!own || !isWomansForm(form)) return own;
  const others = [...surnameForms(form)].filter((f) => f !== own).sort((a, b) => a.length - b.length || (a < b ? 1 : -1));
  return others[0] ?? own;
}

/** The key of a row's group by `by`; `term` gives a relation's words (the research's language). */
export function groupKey(r: FactRow, by: FactGroup, term: (r: FactRow) => string | undefined): string {
  switch (by) {
    case "generation":
      return r.line !== undefined ? `G${r.line}` : r.relation ? "side" : "unknown";
    case "kin":
      return term(r) ?? "unknown";
    case "place":
      return r.fact.place?.normalize("NFC").trim() || "unknown";
    case "decade": {
      const y = dateYears(r.fact.date ?? "")[0];
      return y === undefined ? "unknown" : `${Math.floor(y / 10) * 10}s`;
    }
    case "surname": {
      const s = primaryName(r.person).surname;
      return s?.trim() ? surnameKey(s) : "unknown";
    }
  }
}

/** The rows by group: in order of the line (generation), of the years (decade), else the most first; "unknown" last. */
export function groupRows(rows: FactRow[], by: FactGroup, term: (r: FactRow) => string | undefined): { groups: FactGroupCount[]; labels: Map<string, string> } {
  const map = new Map<string, FactRow[]>();
  const labels = new Map<string, string>();
  for (const r of rows) {
    const k = groupKey(r, by, term);
    map.set(k, [...(map.get(k) ?? []), r]);
    // a surname's group named as written, a man's form first
    if (by === "surname" && k !== "unknown") {
      const s = surnameFormOf(primaryName(r.person).surname);
      if (!labels.has(k) || foldText(s) === k) labels.set(k, s);
    }
  }
  const groups = [...map].map(([key, rs]) => ({ key, people: new Set(rs.map((r) => r.person.id)).size, facts: rs.length, rows: rs }));
  const rank = (g: FactGroupCount): number => {
    if (g.key === "unknown") return Infinity;
    if (by === "generation") return g.key === "side" ? 1e6 : Number(g.key.slice(1));
    if (by === "decade") return Number(g.key.slice(0, -1));
    return -g.facts;
  };
  groups.sort((a, b) => rank(a) - rank(b) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { groups, labels };
}

/** A person's name and years: "Jan Lhoták (1781–1840)". */
export function personLabel(p: Person): string {
  const years = lifespan(p);
  return `${displayName(p)}${years ? ` (${years})` : ""}`;
}
