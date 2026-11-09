// The data of the people a problem is about (strom error --with-data, spec 070 K1.7): only the persons, families and
// books named, only on the person's yes — their names, facts, citations and how sure each fact is; never an image, a
// note, a story, a transcript or anything of another person (a relative is named by ID only).

import type { Citation, Event, Family, Name, Person, RecordSet, Source } from "./model.ts";
import { formatName } from "./people.ts";
import type { Tree } from "./tree.ts";
import { UsageError } from "./errors.ts";

/** What --person, --family and --book name. */
export interface DataAsked {
  person: string[];
  family: string[];
  book: string[];
}

/** One record added: its ID and how the README names it. */
export interface DataAdded {
  id: string;
  kind: "person" | "family" | "book";
  label: string;
}

const PREFIX = { person: "P", family: "F", book: "B" } as const;

/** An ID as strom writes it ("p12" → "P0012"); undefined: not an ID of that kind. */
export function dataId(kind: keyof typeof PREFIX, ref: string): string | undefined {
  const m = new RegExp(`^${PREFIX[kind]}(\\d+)$`, "i").exec(ref.trim());
  if (!m) return undefined;
  return `${PREFIX[kind]}${m[1]!.padStart(4, "0")}`;
}

const citation = (c: Citation) => ({ source: c.source, ...(c.locator ? { locator: c.locator } : {}), ...(c.information ? { information: c.information } : {}) });

const name = (n: Name) => ({
  given: n.given,
  surname: n.surname,
  ...(n.prefix ? { prefix: n.prefix } : {}),
  ...(n.suffix ? { suffix: n.suffix } : {}),
  ...(n.kind ? { kind: n.kind } : {}),
  ...(n.primary ? { primary: true } : {}),
  ...(n.citations?.length ? { citations: n.citations.map(citation) } : {}),
  ...(n.origin ? { origin: n.origin.by } : {}),
});

/** A fact: its values, citations and how sure it is — the note, a quote and the participants' names left out. */
const fact = (e: Event) => ({
  id: e.id,
  kind: e.kind,
  ...(e.date ? { date: e.date } : {}),
  ...(e.place ? { place: e.place } : {}),
  ...(e.house ? { house: e.house } : {}),
  ...(e.value ? { value: e.value } : {}),
  ...(e.label ? { label: e.label } : {}),
  ...(e.cause ? { cause: e.cause } : {}),
  ...(e.age ? { age: e.age } : {}),
  status: e.status,
  citations: e.citations.map(citation),
  ...(e.participants?.length ? { participants: e.participants.map((p) => ({ role: p.role, ...(p.person ? { person: p.person } : {}) })) } : {}),
  ...(e.confirmed ? { confirmed: e.confirmed.at } : {}),
  ...(e.verified ? { verified: { at: e.verified.at, result: e.verified.result, cites: e.verified.cites, ...(e.verified.readers ? { readers: e.verified.readers } : {}) } } : {}),
  ...(e.origin ? { origin: e.origin.by } : {}),
  ...(e.retracted ? { retracted: e.retracted.at } : {}),
});

/** A source cited: what it is and where (no transcript, no translation, no file). */
const source = (s: Source) => ({
  id: s.id,
  kind: s.kind,
  title: s.title,
  ...(s.recordset ? { book: s.recordset } : {}),
  ...(s.repository ? { repository: s.repository } : {}),
  ...(s.locator ? { locator: s.locator } : {}),
  ...(s.date ? { date: s.date } : {}),
  ...(s.language ? { language: s.language } : {}),
  transcript: !!s.transcript,
});

/** The host of an address, nothing of its path (a session of an archive's site could be in it). */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * The data of what was named, read from the research as it is (nothing written). An ID not there: refused, with what
 * lists them — nothing made before the person knows what goes in.
 */
export function readAskedData(tree: Tree, asked: DataAsked): { data: Record<string, unknown>; added: DataAdded[] } {
  const people: unknown[] = [];
  const families: unknown[] = [];
  const books: unknown[] = [];
  const added: DataAdded[] = [];
  const cited = new Set<string>();
  const cite = (cs: Citation[] | undefined) => cs?.forEach((c) => cited.add(c.source));
  const missing = (kind: "person" | "family" | "book", ref: string, list: string) =>
    new UsageError(`no ${kind} ${ref} in this research`, { hint: list, code: "record.none", params: { kind, id: ref } });

  for (const ref of asked.person) {
    const id = dataId("person", ref);
    const p = id ? tree.get<Person>(id) : undefined;
    if (!p) throw missing("person", ref, "strom person list");
    const names = p.names.map(name);
    p.names.forEach((n) => cite(n.citations));
    p.events.forEach((e) => cite(e.citations));
    people.push({ id: p.id, sex: p.sex, names, facts: p.events.map(fact) });
    added.push({ id: p.id, kind: "person", label: p.names[0] ? formatName(p.names[0]) : "" });
  }
  for (const ref of asked.family) {
    const id = dataId("family", ref);
    const f = id ? tree.get<Family>(id) : undefined;
    if (!f) throw missing("family", ref, "strom person show <person>");
    cite(f.citations);
    f.events.forEach((e) => cite(e.citations));
    families.push({
      id: f.id,
      partners: f.partners,
      children: f.children.map((c) => ({ person: c.person, relation: c.relation, ...(c.relations ? { relations: c.relations } : {}) })),
      facts: f.events.map(fact),
      ...(f.citations?.length ? { citations: f.citations.map(citation) } : {}),
      ...(f.union ? { union: f.union } : {}),
      ...(f.noCouple ? { noCouple: true } : {}),
    });
    const partners = f.partners.map((x) => {
      const p = tree.get<Person>(x);
      return p?.names[0] ? `${formatName(p.names[0])} [${x}]` : x;
    });
    added.push({ id: f.id, kind: "family", label: partners.join(" & ") });
  }
  for (const ref of asked.book) {
    const id = dataId("book", ref);
    const b = id ? tree.get<RecordSet>(id) : undefined;
    if (!b) throw missing("book", ref, "strom recordset list");
    const sources = tree.list<Source>("source").filter((s) => s.recordset === b.id);
    books.push({
      id: b.id,
      title: b.title,
      ...(b.repository ? { repository: b.repository } : {}),
      ...(b.callNumber ? { callNumber: b.callNumber } : {}),
      kinds: b.kinds,
      places: b.places,
      ...(b.years ? { years: b.years } : {}),
      access: b.access,
      ...(b.url ? { host: hostOf(b.url) } : {}),
      ...(b.images !== undefined ? { images: b.images } : {}),
      ...(b.layout ? { layout: b.layout } : {}),
      sources: sources.map(source),
    });
    added.push({ id: b.id, kind: "book", label: b.title });
  }
  const sources = [...cited]
    .sort()
    .map((id) => tree.get<Source>(id))
    .filter((s): s is Source => !!s)
    .map(source);
  return {
    data: { people, families, books, sources },
    added,
  };
}
