// The tree as a person looks through it: how far the research got (stats), the
// ancestors of one person (pedigree), one person's life (card), and what came
// in lately (recent). Read only, from the records and the operation logs; the
// commands in commands/browse.ts show them in the research language.

import type { Event, Family, Media, Person, Place, Session, Source, Status, Task } from "./model.ts";
import { ancestorGenerations, birthEvent, displayName, familiesAsPartner, formatName, lifespan, parentsOf, primaryName, sameName } from "./people.ts";
import { dateYears } from "./gdate.ts";
import { informationOf } from "./evidence.ts";
import type { Tree } from "./tree.ts";

/** A person in a line: who, and when they lived. */
export interface Who {
  id: string;
  name: string;
  /** "1811–1892", "*1811", "" */
  years: string;
}

export function who(p: Person): Who {
  return { id: p.id, name: displayName(p), years: lifespan(p) };
}

/** Facts that count: not retracted, not disproven. */
function facts(events: Event[]): Event[] {
  return events.filter((e) => !e.retracted && e.status !== "disproven" && e.status !== "retracted");
}

function alive<T extends { retracted?: unknown }>(records: T[]): T[] {
  return records.filter((r) => !r.retracted);
}

/** Born (baptised) by a record: the birth fact proven. */
export function birthProven(p: Person): boolean {
  return birthEvent(p)?.status === "proven";
}

// ── stats ──────────────────────────────────────────────────────────────────

export interface Generation {
  generation: number;
  expected: number;
  known: number;
  proven: number;
}

export interface Stats {
  persons: number;
  families: number;
  sources: number;
  images: number;
  places: number;
  facts: Record<"proven" | "probable" | "possible" | "lead", number>;
  /** Whose ancestors are counted (the main person, or the one asked for). */
  from?: Who;
  generations: Generation[];
  /** The ancestor born longest ago whose birth a record proves. */
  oldest?: Who;
  tasks: { queued: number; waiting: number; done: number };
  /** costPartial: sessions stopped before they said what they cost (more was spent than costUsd shows). */
  sessions: { count: number; last?: string; costUsd?: number; costPartial?: number };
  stories: { written: number; final: number };
}

export function treeStats(tree: Tree, from?: string): Stats {
  const persons = alive(tree.list<Person>("person"));
  const families = alive(tree.list<Family>("family"));
  const count = { proven: 0, probable: 0, possible: 0, lead: 0 };
  for (const e of [...persons, ...families].flatMap((r) => facts(r.events))) if (e.status in count) count[e.status as keyof typeof count]++;
  const stats: Stats = {
    persons: persons.length,
    families: families.length,
    sources: alive(tree.list<Source>("source")).length,
    images: alive(tree.list<Media>("media")).length,
    places: alive(tree.list<Place>("place")).length,
    facts: count,
    generations: [],
    tasks: { queued: 0, waiting: 0, done: 0 },
    sessions: { count: 0 },
    stories: { written: 0, final: 0 },
  };
  const root = from ? tree.get<Person>(from) : undefined;
  if (root) {
    stats.from = who(root);
    const gens = ancestorGenerations(tree, root.id);
    const deepest = Math.max(...gens.values());
    for (let g = 2; g <= deepest; g++) {
      const here = [...gens].filter(([, n]) => n === g).map(([id]) => tree.get<Person>(id)!);
      stats.generations.push({ generation: g, expected: 2 ** (g - 1), known: here.length, proven: here.filter(birthProven).length });
    }
    let oldest: { p: Person; year: number } | undefined;
    for (const id of gens.keys()) {
      const p = tree.get<Person>(id)!;
      const year = birthProven(p) ? dateYears(birthEvent(p)!.date ?? "")[0] : undefined;
      if (year !== undefined && id !== root.id && (!oldest || year < oldest.year)) oldest = { p, year };
    }
    if (oldest) stats.oldest = who(oldest.p);
  }
  for (const t of tree.list<Task>("task")) {
    if (t.state === "open" || t.state === "doing") stats.tasks.queued++;
    else if (t.state === "waiting") stats.tasks.waiting++;
    else if (t.state === "done") stats.tasks.done++;
  }
  let cost = 0;
  for (const s of tree.list<Session>("session")) {
    stats.sessions.count++;
    const at = s.ended ?? s.started;
    if (!stats.sessions.last || at > stats.sessions.last) stats.sessions.last = at;
    cost += s.metrics?.costUsd ?? 0;
    if (s.metrics?.costPartial) stats.sessions.costPartial = (stats.sessions.costPartial ?? 0) + 1;
  }
  if (cost > 0) stats.sessions.costUsd = Math.round(cost * 100) / 100;
  for (const r of [...persons, ...families])
    if (r.story) {
      stats.stories.written++;
      if (r.story.status === "final") stats.stories.final++;
    }
  return stats;
}

// ── pedigree ───────────────────────────────────────────────────────────────

export interface PedigreeNode {
  person?: Who & { proven: boolean };
  /** Shown already higher up (the same ancestor on two lines). */
  seen?: boolean;
  /** Parents, when this generation still shows them: known or not. */
  father?: PedigreeNode;
  mother?: PedigreeNode;
}

/** The ancestors of a person up to a number of generations (the person: 1), father and mother at each. */
export function pedigree(tree: Tree, id: string, generations: number): PedigreeNode {
  const seen = new Set<string>();
  const node = (p: Person, g: number): PedigreeNode => {
    const out: PedigreeNode = { person: { ...who(p), proven: birthProven(p) } };
    if (seen.has(p.id)) return { ...out, seen: true };
    seen.add(p.id);
    if (g >= generations) return out;
    const parents = parentsOf(tree, p.id);
    let father = parents.find((x) => x.sex === "M");
    let mother = parents.find((x) => x.sex === "F");
    for (const x of parents.filter((x) => x.sex !== "M" && x.sex !== "F")) {
      if (!father) father = x;
      else if (!mother && x !== father) mother = x;
    }
    out.father = father ? node(father, g + 1) : {};
    out.mother = mother ? node(mother, g + 1) : {};
    return out;
  };
  return node(tree.get<Person>(id)!, 1);
}

/** How many generations of ancestors are known from a person (the person: 1). */
export function knownGenerations(tree: Tree, id: string): number {
  return Math.max(...ancestorGenerations(tree, id).values());
}

// ── one person ─────────────────────────────────────────────────────────────

export interface CardFact {
  id: string;
  kind: string;
  label?: string;
  date?: string;
  place?: string;
  house?: string;
  value?: string;
  cause?: string;
  status: Status;
  /** The record it rests on (the first one cited). */
  source?: string;
}

export interface Card {
  person: Who;
  sex: string;
  otherNames: string[];
  facts: CardFact[];
  parents: Who[];
  families: { id: string; partner?: Who & { sex: string }; facts: CardFact[]; children: Who[] }[];
  story?: { status: "draft" | "final"; text: string };
}

/** The first year of a date (none: after every dated one). */
function yearOf(date: string | undefined): number {
  return (date ? dateYears(date)[0] : undefined) ?? Infinity;
}

/** Earliest first; undated after, in the order recorded. */
function byDate(a: Event, b: Event): number {
  const ya = yearOf(a.date);
  const yb = yearOf(b.date);
  return ya === yb ? 0 : ya < yb ? -1 : 1;
}

/** The kinds of record that are the record of a fact. */
const RECORD_OF: Record<string, string[]> = {
  BIRT: ["baptism", "birth"],
  CHR: ["baptism"],
  BAPM: ["baptism"],
  DEAT: ["death", "burial"],
  BURI: ["burial", "death"],
  MARR: ["marriage"],
};

export function cardFact(tree: Tree, e: Event): CardFact {
  // The record of the fact itself (a baptism for a birth, not the age at a marriage), else one that knew it first hand, else the first.
  const cited = e.citations.map((c) => ({ c, src: tree.get<Source>(c.source) }));
  const own = RECORD_OF[e.kind] ?? [];
  const source = (cited.find(({ src }) => src && own.includes(src.kind)) ?? cited.find(({ c, src }) => informationOf(src, c) === "primary") ?? cited[0])?.src?.title;
  return {
    id: e.id,
    kind: e.kind,
    status: e.status,
    ...(e.label ? { label: e.label } : {}),
    ...(e.date ? { date: e.date } : {}),
    ...(e.place ? { place: e.place } : {}),
    ...(e.house ? { house: e.house } : {}),
    ...(e.value ? { value: e.value } : {}),
    ...(e.cause ? { cause: e.cause } : {}),
    ...(source ? { source } : {}),
  };
}

export function personCard(tree: Tree, p: Person): Card {
  const main = primaryName(p);
  const families = familiesAsPartner(tree, p.id).map((f) => {
    const other = f.partners.filter((x) => x !== p.id).map((x) => tree.get<Person>(x)).find((x) => x && !x.retracted);
    return {
      id: f.id,
      ...(other ? { partner: { ...who(other), sex: other.sex } } : {}),
      facts: [...facts(f.events)].sort(byDate).map((e) => cardFact(tree, e)),
      children: f.children
        .map((c) => tree.get<Person>(c.person))
        .filter((c): c is Person => !!c && !c.retracted)
        .sort((a, b) => Math.sign(yearOf(birthEvent(a)?.date) - yearOf(birthEvent(b)?.date)) || 0)
        .map(who),
    };
  });
  return {
    person: who(p),
    sex: p.sex,
    otherNames: [...new Set(p.names.filter((n) => !sameName(n, main)).map(formatName))],
    facts: [...facts(p.events)].sort(byDate).map((e) => cardFact(tree, e)),
    parents: parentsOf(tree, p.id).map(who),
    families: families.sort((a, b) => Math.sign(yearOf(a.facts[0]?.date) - yearOf(b.facts[0]?.date)) || 0),
    ...(p.story ? { story: { status: p.story.status, text: p.story.text } } : {}),
  };
}

// ── what came in lately ────────────────────────────────────────────────────

export interface Recent {
  since: string;
  persons: Who[];
  facts: { owner: string; fact: CardFact; refined: boolean }[];
  sources: { id: string; title: string }[];
  stories: Who[];
  tasksDone: number;
  sessions: { id: string; at: string; task?: string; summary?: string }[];
}

/** What the research added and refined since a time (ISO): the operation logs say what, the records how it is now. */
export function recent(tree: Tree, since: string): Recent {
  const ops = tree.readOps().filter((o) => o.at >= since);
  const newPeople = alive(tree.list<Person>("person")).filter((p) => p.created >= since && !p.mergedInto);
  const owners = new Map<string, Person | Family>();
  const added = new Set<string>();
  const refined = new Set<string>();
  const owner = (id: string) => {
    if (!owners.has(id)) {
      const r = tree.get<Person | Family>(id);
      if (r && (r.type === "person" || r.type === "family") && !r.retracted) owners.set(id, r);
    }
    return owners.get(id);
  };
  // Facts of the people and families that came in, and those added to anyone.
  for (const r of [...newPeople, ...alive(tree.list<Family>("family")).filter((f) => f.created >= since)])
    for (const e of facts(r.events)) {
      owners.set(r.id, r);
      added.add(`${r.id} ${e.id}`);
    }
  let tasksDone = 0;
  const stories = new Set<string>();
  for (const o of ops) {
    const [first, ...rest] = o.targets;
    if (o.op === "task.done") tasksDone++;
    if (o.op === "story.set" && first && tree.get<Person>(first)?.type === "person") stories.add(first);
    if (!first || !owner(first)) continue;
    for (const e of rest.filter((x) => /^E\d+$/.test(x))) {
      const key = `${first} ${e}`;
      if (o.op === "event.add") added.add(key);
      else if (o.op.startsWith("event.") && !added.has(key)) refined.add(key);
    }
  }
  const factRows: Recent["facts"] = [];
  for (const [set, isRefined] of [[added, false], [refined, true]] as const)
    for (const key of set) {
      if (isRefined && added.has(key)) continue;
      const [id, eid] = key.split(" ") as [string, string];
      const r = owners.get(id);
      const e = r?.events.find((x) => x.id === eid);
      if (r && e && facts([e]).length) factRows.push({ owner: id, fact: cardFact(tree, e), refined: isRefined });
    }
  const rank: Record<string, number> = { proven: 0, probable: 1, possible: 2, lead: 3 };
  factRows.sort((a, b) => (rank[a.fact.status] ?? 9) - (rank[b.fact.status] ?? 9));
  const sessions = tree
    .list<Session>("session")
    .filter((s) => (s.ended ?? s.started) >= since && (s.summary || s.task))
    .sort((a, b) => (b.ended ?? b.started).localeCompare(a.ended ?? a.started))
    .map((s) => ({
      id: s.id,
      at: s.ended ?? s.started,
      ...(s.task && tree.get<Task>(s.task) ? { task: tree.get<Task>(s.task)!.what } : {}),
      ...(s.summary ? { summary: s.summary } : {}),
    }));
  return {
    since,
    persons: newPeople.map(who),
    facts: factRows,
    sources: alive(tree.list<Source>("source"))
      .filter((s) => s.created >= since)
      .map((s) => ({ id: s.id, title: s.title })),
    stories: [...stories].map((id) => who(tree.get<Person>(id)!)),
    tasksDone,
    sessions,
  };
}

/** The name of whoever a fact belongs to: a person, or a couple. */
export function ownerName(tree: Tree, id: string): string {
  const r = tree.get<Person | Family>(id);
  if (!r) return id;
  if (r.type === "person") return displayName(r);
  return r.partners.map((x) => tree.get<Person>(x)).filter((x): x is Person => !!x).map(displayName).join(" & ") || id;
}

