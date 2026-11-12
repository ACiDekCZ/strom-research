// The facts of the tree as rows (strom query): one row is one fact of a person — or of a family (a marriage), then a
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
//
// The stories (--story): a row per story of a person or of a couple (for each partner among the people asked about)
// whose text holds a word asked for, the same way as a fact's value; with the sentence it is in and the sources that
// sentence rests on where they can be told (the sources it names, the facts of the story of the years it names), else
// the sources of the whole story. A story retells the facts: it shows where to look, never what is proven.

import type { Event, Family, Person, Place, Source, Status, Story } from "./model.ts";
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
import { sourcesNamed, storySources } from "./storykeep.ts";
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

// ── stories ─────────────────────────────────────────────────────────────────

/** The fact filters of a query: any of them chooses the people of a story query (those with a fact answering them). */
export function asksFacts(q: FactQuery): boolean {
  return !!(q.kinds?.length || q.values?.length || q.place || q.house || q.years || q.source || q.statuses?.length);
}

export interface StoryRow {
  person: Person;
  /** The record the story is of: the person, or a family of theirs (a couple's story). */
  owner: Person | Family;
  relation?: Relation;
  self: boolean;
  line?: number;
  /** The sentence the word is in, cut around the word when it is long. */
  snippet: string;
  /** Not approved by the user: a draft, or a new version waiting beside the approved story. */
  draft: boolean;
  /** The sources the sentence rests on ("sentence": those it names, or the story's facts of the years it names), else the story's. */
  sources: { id: string; title: string }[];
  basis: "sentence" | "story";
}

export interface StoryAnswer {
  of: Person;
  kin: KinSet;
  variants: string[];
  known: boolean;
  rows: StoryRow[];
  people: number;
  /** People of the set without the word in a story, but with it elsewhere in their record (a note): what strom find finds. */
  elsewhere: string[];
}

const SNIPPET = 160;

/** A story's text as sentences: its paragraphs and sentences, without the marks the app shows (## , - , **). */
function sentences(text: string): string[] {
  return text
    .normalize("NFC")
    .split(/\n\s*\n/u)
    .flatMap((para) =>
      para
        .split("\n")
        .map((l) => l.replace(/^\s*(?:#{1,6}\s+|[-*]\s+)/u, ""))
        .join(" ")
        .replace(/\*\*|(?<![\p{L}\p{N}])\*|\*(?![\p{L}\p{N}])/gu, "")
        .split(/(?<=[.!?…])\s+(?=[\p{Lu}\p{N}„"“«‚(])/u),
    )
    .map((x) => x.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
}

/** The sentence cut around the word that matched (the whole sentence when short). */
function snippetOf(sentence: string, m: OccupationMatcher): string {
  if (sentence.length <= SNIPPET) return sentence;
  // where the word starts: the last word from which on the text still matches
  let at = 0;
  for (const w of sentence.matchAll(/[\p{L}\p{M}\p{N}]+/gu)) {
    if (!m.matches(sentence.slice(w.index))) break;
    at = w.index;
  }
  const from = Math.max(0, at - 60);
  const start = from === 0 ? 0 : sentence.indexOf(" ", from) + 1 || from;
  let end = Math.min(sentence.length, start + SNIPPET);
  if (end < sentence.length) end = sentence.lastIndexOf(" ", end) > at ? sentence.lastIndexOf(" ", end) : end;
  return `${start > 0 ? "…" : ""}${sentence.slice(start, end).trim()}${end < sentence.length ? "…" : ""}`;
}

/** The stories of the people asked about that hold a word asked for, with the sentence and what it rests on. */
export function findStories(tree: Tree, q: FactQuery, words: string[]): StoryAnswer {
  const of = tree.get<Person>(q.of);
  if (!live(of)) throw new Error(`no person ${q.of}`);
  const { people: set, line } = kinSet(tree, of.id, q.kin);
  const surname = q.surname ? familyForms(tree, q.surname) : undefined;
  const surnameOf = (p: Person) => !surname || p.names.some((n) => [...surnameForms(surnameFormOf(n.surname ?? ""))].some((f) => surname.has(f)));
  // the fact filters choose the people: those with a fact answering them
  const withFacts = asksFacts(q) ? new Set(findFacts(tree, q).rows.map((r) => r.person.id)) : undefined;
  const people = [...set].filter((id) => surnameOf(tree.get<Person>(id)!) && (!withFacts || withFacts.has(id)));

  const matchers = words.map((v) => occupationMatcher(v, { exact: !!q.exact })).filter((m) => m.word);
  const sources = new Map(tree.list<Source>("source").map((s) => [s.id, s]));
  const events = new Map<string, Event>();
  for (const t of ["person", "family"] as const) for (const r of tree.list<Person | Family>(t)) for (const e of r.events) events.set(e.id, e);
  const titled = (ids: string[]) => ids.map((id) => ({ id, title: sources.get(id)?.title ?? "" }));

  /** The first sentence of the story (the approved one, then a new version waiting) holding a word, and what it rests on. */
  const inStory = (st: Story | undefined): Pick<StoryRow, "snippet" | "draft" | "sources" | "basis"> | undefined => {
    if (!st) return undefined;
    for (const v of [st, ...(st.draft ? [st.draft] : [])]) {
      for (const sentence of sentences([v.title, v.text].filter(Boolean).join("\n\n"))) {
        const m = matchers.find((x) => x.matches(sentence));
        if (!m) continue;
        const draft = v !== st || st.status !== "final";
        // the sources the sentence names; else those cited by the story's facts of a year the sentence names
        let ids = sourcesNamed(tree, sentence);
        if (!ids.length) {
          const years = new Set((sentence.match(/(?<![\p{L}\p{N}])\d{3,4}(?![\p{L}\p{N}])/gu) ?? []).map(Number));
          const facts = v.facts.map((f) => events.get(f)).filter((e): e is Event => !!e && !e.retracted && dateYears(e.date ?? "").some((y) => years.has(y)));
          ids = [...new Set(facts.flatMap((e) => e.citations.map((c) => c.source)))].filter((id) => sources.has(id) && !sources.get(id)!.retracted);
        }
        if (ids.length) return { snippet: snippetOf(sentence, m), draft, sources: titled(ids), basis: "sentence" };
        return { snippet: snippetOf(sentence, m), draft, sources: storySources(tree, v, events).map((x) => ({ id: x.id, title: x.title })), basis: "story" };
      }
    }
    return undefined;
  };

  const found: Omit<StoryRow, "relation">[] = [];
  const told = new Set<string>();
  const familyStory = new Map<string, ReturnType<typeof inStory>>();
  for (const id of people) {
    const p = tree.get<Person>(id)!;
    const where = { person: p, self: id === of.id, ...(line.has(id) ? { line: line.get(id)! } : {}) };
    const own = inStory(p.story);
    if (own) found.push({ ...where, owner: p, ...own });
    for (const f of familiesAsPartner(tree, id)) {
      if (f.retracted) continue;
      if (!familyStory.has(f.id)) familyStory.set(f.id, inStory(f.story));
      const hit = familyStory.get(f.id);
      if (hit) found.push({ ...where, owner: f, ...hit });
    }
    if (own || found.some((r) => r.person.id === id)) told.add(id);
  }

  const relationOf = relationsFrom(tree, of.id);
  const relations = new Map<string, Relation | undefined>();
  const rows: StoryRow[] = found.map((r) => {
    if (!relations.has(r.person.id)) relations.set(r.person.id, r.self ? undefined : relationOf(r.person.id));
    const relation = relations.get(r.person.id);
    return { ...r, ...(relation ? { relation } : {}) };
  });
  rows.sort(byRow);

  // the people with a word only elsewhere in their record (a note, a name): strom find
  const folded = matchers.map((m) => foldText(m.word)).filter(Boolean);
  const elsewhere = people.filter((id) => {
    if (told.has(id)) return false;
    const p = tree.get<Person>(id)!;
    const hay = foldText(searchText({ ...p, story: undefined, events: p.events.filter((e) => !e.retracted && e.status !== "retracted") }));
    return folded.some((w) => hay.includes(w));
  });
  const variants = [...new Set(matchers.flatMap((m) => m.variants))];
  return { of, kin: q.kin, variants, known: matchers.some((m) => m.known), rows, people: new Set(rows.map((r) => r.person.id)).size, elsewhere };
}

/** The line first by generation (the person, the parents, …), then the others by generation, each person's facts by date. */
function byRow(a: GroupedRow, b: GroupedRow): number {
  const ga = a.line ?? a.relation?.generation ?? -Infinity;
  const gb = b.line ?? b.relation?.generation ?? -Infinity;
  const la = a.line !== undefined ? 0 : 1;
  const lb = b.line !== undefined ? 0 : 1;
  if (la !== lb) return la - lb;
  if (ga !== gb) return la === 0 ? ga - gb : gb - ga;
  if (a.person.id !== b.person.id) return a.person.id < b.person.id ? -1 : 1;
  const ya = dateYears(a.fact?.date ?? "")[0] ?? Infinity;
  const yb = dateYears(b.fact?.date ?? "")[0] ?? Infinity;
  return ya - yb;
}

// ── groups ──────────────────────────────────────────────────────────────────

/** What a row is grouped by: whom it is of, how related; a fact's place and date where it is a fact's. */
export interface GroupedRow {
  person: Person;
  relation?: Relation;
  line?: number;
  fact?: Event;
}

export interface FactGroupCount<R extends GroupedRow = FactRow> {
  /** The group's key: "G5", "side", a term, a place, "1810s", a surname; "unknown" where the row has none. */
  key: string;
  people: number;
  facts: number;
  rows: R[];
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
export function groupKey<R extends GroupedRow>(r: R, by: FactGroup, term: (r: R) => string | undefined): string {
  switch (by) {
    case "generation":
      return r.line !== undefined ? `G${r.line}` : r.relation ? "side" : "unknown";
    case "kin":
      return term(r) ?? "unknown";
    case "place":
      return r.fact?.place?.normalize("NFC").trim() || "unknown";
    case "decade": {
      const y = dateYears(r.fact?.date ?? "")[0];
      return y === undefined ? "unknown" : `${Math.floor(y / 10) * 10}s`;
    }
    case "surname": {
      const s = primaryName(r.person).surname;
      return s?.trim() ? surnameKey(s) : "unknown";
    }
  }
}

/** The rows by group: in order of the line (generation), of the years (decade), else the most first; "unknown" last. */
export function groupRows<R extends GroupedRow>(rows: R[], by: FactGroup, term: (r: R) => string | undefined): { groups: FactGroupCount<R>[]; labels: Map<string, string> } {
  const map = new Map<string, R[]>();
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
  const rank = (g: FactGroupCount<R>): number => {
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
