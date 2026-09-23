// Domain write operations. Every change to the evidence goes through here,
// under the tree lock, validated and sealed by Tree.put.

import { UsageError } from "./errors.ts";
import { normalizeDate } from "./gdate.ts";
import { normalizeAge } from "./age.ts";
import { checkStatus, defaultStatus } from "./evidence.ts";
import {
  eventKind,
  FAMILY_EVENT_KINDS,
  NOTE_MAX,
  STATUSES,
  type ChildRelation,
  type Citation,
  type Direction,
  type Event,
  type Family,
  type Name,
  type Note,
  type Person,
  type Research,
  type Sex,
  type Status,
  type Participant,
  type ParticipantRole,
  PARTICIPANT_ROLES,
  NAME_KINDS,
  RECORD_TYPES,
  type AnyRecord,
  type RecordType,
  type Story,
} from "./model.ts";
import { displayName, familiesAsChild, familiesAsPartner, gedcomName, isBirthFamily, notAName, parseName, primaryName, sameName, slashInName } from "./people.ts";
import { foldText } from "./text.ts";
import { roleWord } from "./roles.ts";
import { now, typeOfId, type Tree } from "./tree.ts";

/** Kinds that only make sense on a couple (a reader drops them on a person). */
const FAMILY_ONLY = new Set(["MARR", "MARB", "MARC", "MARL", "MARS", "DIV", "DIVF", "ANUL", "ENGA"]);

export function makeNote(tree: Tree, text: string): Note {
  const t = text.trim();
  if (!t) throw new UsageError("the note is empty");
  if (t.length > NOTE_MAX)
    throw new UsageError(`note is ${t.length} characters (max ${NOTE_MAX})`, {
      hint: "keep notes short; longer reasoning belongs in a conflict or hypothesis, the words of a record in the source transcript",
    });
  return { text: t, at: now(), by: tree.actor };
}

export function parseStatus(v: string | undefined, fallback: Status): Status {
  if (v === undefined) return fallback;
  if (!(STATUSES as readonly string[]).includes(v) || v === "retracted")
    throw new UsageError(`invalid status "${v}"`, { hint: "use proven, probable, possible, lead or disproven" });
  return v as Status;
}

export function parseDate(v: string | undefined, what = "date"): string | undefined {
  if (v === undefined) return undefined;
  const d = normalizeDate(v);
  if (!d)
    throw new UsageError(`invalid ${what} "${v}"`, {
      hint: 'use GEDCOM form: "24 JUN 1783", "JUN 1783", "1783", "ABT 1783", "BEF 1850", "BET 1811 AND 1812" (or ISO 1783-06-24)',
    });
  return d;
}

export function parseSex(v: string | undefined): Sex {
  if (v === undefined) return "U";
  const s = v.toUpperCase();
  if (s === "M" || s === "MALE") return "M";
  if (s === "F" || s === "FEMALE") return "F";
  if (s === "U" || s === "UNKNOWN") return "U";
  throw new UsageError(`invalid sex "${v}"`, { hint: "use M, F or U" });
}

export interface EventInput {
  kind: string;
  date?: string | undefined;
  place?: string | undefined;
  house?: string | undefined;
  cause?: string | undefined;
  value?: string | undefined;
  label?: string | undefined;
  age?: string | undefined;
  /** Ages of partners at a family event: person ID → age as written. */
  ages?: Record<string, string> | undefined;
  participants?: Participant[];
  status?: string | undefined;
  citations?: Citation[];
  note?: string | undefined;
}

/** An age as the record gives it → GEDCOM form, or a clear error. */
export function parseAge(v: string, whose = ""): string {
  const age = normalizeAge(v);
  if (!age)
    throw new UsageError(`cannot read the age "${v}"${whose ? ` of ${whose}` : ""}`, {
      hint: 'give it as years/months/days: "27", "27 let", "27y 3m", "3 months", "<1y", INFANT, STILLBORN — the exact words go in --quote',
    });
  return age;
}

/** "godparent:Marie Dvořáková" or "witness:P0012" → participant. */
export function parseParticipant(tree: Tree, spec: string): Participant {
  const m = /^([\p{L}-]+)\s*:\s*(.+)$/u.exec(spec.trim());
  if (!m) throw new UsageError(`invalid participant "${spec}"`, { hint: `use role:name or role:P0012 — roles: ${PARTICIPANT_ROLES.join(", ")}` });
  // "kmotr:…", "svědek:…", "Hebamme:…" are understood too
  const role = roleWord(m[1]);
  if (!role) throw new UsageError(`invalid role "${m[1]}"`, { hint: PARTICIPANT_ROLES.join(", ") });
  const who = m[2]!.trim();
  if (/^P\d+$/i.test(who)) {
    const id = "P" + who.slice(1).padStart(4, "0");
    if (!tree.get(id)) throw new UsageError(`no person ${who}`);
    return { role, person: id };
  }
  return { role, name: who };
}

function checkCitation(tree: Tree, c: Citation): void {
  if (tree.get(c.source)?.type !== "source") throw new UsageError(`no source ${c.source}`, { hint: 'strom source add "<title>" …' });
}

/** A list of citations with one more; the same place of the same source twice is refused. */
function withCitation(list: Citation[] | undefined, c: Citation, what: string): Citation[] {
  if ((list ?? []).some((x) => x.source === c.source && x.locator === c.locator)) throw new UsageError(`${what} already cites ${c.source} there`);
  return [...(list ?? []), c];
}

/** Build an event with a fresh ID. Enforces: proven/probable need a citation. */
export function makeEvent(tree: Tree, input: EventInput, forFamily = false): Event {
  const kind = eventKind(input.kind);
  if (!kind) throw new UsageError(`unknown event kind "${input.kind}"`, { hint: "use a GEDCOM tag like BIRT, CHR, DEAT, BURI, MARR, OCCU, RESI (strom help event add)" });
  if (forFamily && !FAMILY_EVENT_KINDS.has(kind))
    throw new UsageError(`${kind} is a personal event, not a family event`, { hint: "add it to a person: strom event add <person> " + kind });
  if (!forFamily && FAMILY_ONLY.has(kind))
    throw new UsageError(`${kind} belongs to a family, not to one person`, {
      hint: `strom event add <F…> ${kind} — or strom family add --partner … --married <date>; if the spouse is unknown use EVEN --label "Marriage"`,
    });
  const citations = input.citations ?? [];
  for (const c of citations)
    if (tree.get(c.source)?.type !== "source") throw new UsageError(`no source ${c.source}`, { hint: 'strom source add "<title>" …' });
  const status = parseStatus(input.status, defaultStatus(tree, citations));
  checkStatus(tree, status, citations);
  if (forFamily && input.age?.trim())
    throw new UsageError("a family event has the age of each partner", { hint: '--age P0001:25 --age P0002:22 (or husband:25 / wife:22)' });
  if (kind === "EVEN" && !input.label?.trim() && !input.value?.trim())
    throw new UsageError("EVEN needs --label (what happened, e.g. \"Fire\")");
  if (["OCCU", "RELI", "TITL", "NATI"].includes(kind) && !input.value?.trim())
    throw new UsageError(`${kind} needs --value (the fact itself, e.g. "blacksmith")`);
  const ev: Event = { id: tree.allocate("E"), kind, status, citations };
  const date = parseDate(input.date);
  if (date) ev.date = date;
  if (input.place?.trim()) ev.place = input.place.trim();
  if (input.house?.trim()) ev.house = input.house.trim();
  if (input.cause?.trim()) ev.cause = input.cause.trim();
  if (input.value?.trim()) ev.value = input.value.trim();
  if (input.label?.trim()) ev.label = input.label.trim();
  if (input.age?.trim()) ev.age = parseAge(input.age);
  if (input.ages && Object.keys(input.ages).length)
    ev.ages = Object.fromEntries(Object.entries(input.ages).map(([who, a]) => [who, parseAge(a, who)]));
  if (input.participants?.length) ev.participants = input.participants;
  if (input.note?.trim()) ev.note = makeNote(tree, input.note).text;
  return ev;
}

/** "E0002 MARR 1910 [lead]" — how a new fact is reported, so its ID can be cited at once. */
export function eventSummary(e: Event): string {
  return `${e.id} ${e.kind}${e.date ? ` ${e.date}` : ""}${e.place ? ` ${e.place}` : ""} [${e.status}]`;
}

export interface PersonInput {
  name: string;
  sex?: string | undefined;
  born?: string | undefined;
  bornPlace?: string | undefined;
  died?: string | undefined;
  diedPlace?: string | undefined;
  note?: string | undefined;
  /** Record the birth/death facts cite (the record the person comes from). */
  citation?: Citation | undefined;
  status?: string | undefined;
}

/** A name the record gives — never a description of the person in its place, and one GEDCOM can hold. */
function checkGiven(name: Name): void {
  const slash = slashInName(name);
  if (slash)
    throw new UsageError(slash, {
      hint: 'a letter not read for sure: "Anna /[?]emenská/", and each reading as an alias — strom name add P… "Anna /Kemenská/" --kind alias',
    });
  const why = notAName(name.given);
  if (why)
    throw new UsageError(why, {
      hint: `the record does not name the person: "/${name.surname || "Surname"}/" with an empty given name; what it says goes to the facts — a stillborn child: strom event add P… DEAT --date … --age stillborn; unbaptised or unnamed: a --note`,
    });
}

export function addPerson(tree: Tree, input: PersonInput): Person {
  const name: Name = parseName(input.name);
  if (!name.given && !name.surname) throw new UsageError("the person needs a name");
  checkGiven(name);
  const sex = parseSex(input.sex);
  // Without a birth or death to carry it, the record is evidence of the person's name.
  const facts = input.born || input.bornPlace || input.died || input.diedPlace;
  if (input.citation && !facts) {
    checkCitation(tree, input.citation);
    name.citations = [input.citation];
  }
  // Validate dates before allocating IDs.
  parseDate(input.born, "birth date");
  parseDate(input.died, "death date");
  return tree.withTreeLock(() => {
    const t = now();
    const events: Event[] = [];
    const cited = { citations: input.citation ? [input.citation] : [], status: input.status };
    if (input.born || input.bornPlace) events.push(makeEvent(tree, { kind: "BIRT", date: input.born, place: input.bornPlace, ...cited }));
    if (input.died || input.diedPlace) events.push(makeEvent(tree, { kind: "DEAT", date: input.died, place: input.diedPlace, ...cited }));
    const person: Person = {
      id: tree.allocate("P"),
      type: "person",
      names: [name],
      sex,
      events,
      notes: input.note ? [makeNote(tree, input.note)] : [],
      created: t,
      updated: t,
    };
    tree.put(person, {
      op: "person.add",
      targets: [person.id],
      summary: [`+${person.id} ${gedcomName(name)}${name.citations ? ` ← ${name.citations[0]!.source}` : ""}`, ...events.map(eventSummary)].join(" · "),
    });
    return person;
  });
}

function requirePerson(tree: Tree, id: string): Person {
  const p = tree.get<Person>(id);
  if (!p || p.type !== "person") throw new UsageError(`no person ${id}`, { hint: "strom person list" });
  if (p.mergedInto) throw new UsageError(`${id} was merged into ${p.mergedInto}`, { hint: `use ${p.mergedInto}` });
  return p;
}

export interface FamilyInput {
  partners: string[];
  children: string[];
  relation?: string | undefined;
  married?: string | undefined;
  marriedPlace?: string | undefined;
  note?: string | undefined;
  /** Record the marriage fact cites. */
  citation?: Citation | undefined;
  status?: string | undefined;
  /** Ages of the partners at the marriage: person ID → age as written. */
  ages?: Record<string, string> | undefined;
}

const RELATIONS: ChildRelation[] = ["birth", "adopted", "step", "foster", "unknown"];

export function addFamily(tree: Tree, input: FamilyInput): Family {
  if (input.partners.length > 2) throw new UsageError("a family has at most two partners");
  if (input.partners.length + input.children.length === 0) throw new UsageError("give at least one --partner or --child");
  const relation = (input.relation ?? "birth") as ChildRelation;
  if (!RELATIONS.includes(relation)) throw new UsageError(`invalid relation "${input.relation}"`, { hint: RELATIONS.join(", ") });
  for (const id of [...input.partners, ...input.children]) requirePerson(tree, id);
  if (new Set([...input.partners, ...input.children]).size !== input.partners.length + input.children.length)
    throw new UsageError("the same person is listed twice");
  if (relation === "birth")
    for (const c of input.children) {
      const fam = familiesAsChild(tree, c).find((f) => isBirthFamily(f, c));
      if (fam) throw new UsageError(`${c} already has birth parents in ${fam.id}`, { hint: `strom family show ${fam.id} — or, if these are other parents: --relation adopted|step|foster` });
    }
  parseDate(input.married, "marriage date");
  const married = Boolean(input.married || input.marriedPlace);
  if (input.citation && !married) checkCitation(tree, input.citation);
  return tree.withTreeLock(() => {
    const t = now();
    const events: Event[] = [];
    if (married)
      events.push(
        makeEvent(tree, { kind: "MARR", date: input.married, place: input.marriedPlace, citations: input.citation ? [input.citation] : [], status: input.status, ages: input.ages }, true),
      );
    const family: Family = {
      id: tree.allocate("F"),
      type: "family",
      partners: input.partners,
      children: input.children.map((person) => ({ person, relation })),
      events,
      // Without a marriage the record is evidence of the family itself (a child's parents).
      ...(input.citation && !married ? { citations: [input.citation] } : {}),
      notes: input.note ? [makeNote(tree, input.note)] : [],
      created: t,
      updated: t,
    };
    const names = input.partners.map((id) => displayName(requirePerson(tree, id))).join(" & ");
    tree.put(family, {
      op: "family.add",
      targets: [family.id, ...input.partners, ...input.children],
      summary: [
        `+${family.id} ${names || "family"}${input.children.length ? ` (${input.children.length} child${input.children.length > 1 ? "ren" : ""})` : ""}${family.citations ? ` ← ${family.citations[0]!.source}` : ""}`,
        ...events.map(eventSummary),
      ].join(" · "),
    });
    return family;
  });
}

/** Add a child to an existing family — with the record that names the child's parents, if given. */
export function addChild(tree: Tree, familyId: string, child: string, relationInput?: string, citation?: Citation): Family {
  const relation = (relationInput ?? "birth") as ChildRelation;
  if (!RELATIONS.includes(relation)) throw new UsageError(`invalid relation "${relationInput}"`, { hint: RELATIONS.join(", ") });
  requirePerson(tree, child);
  if (citation) checkCitation(tree, citation);
  return tree.withTreeLock(() => {
    const fam = tree.get<Family>(familyId);
    if (!fam || fam.type !== "family") throw new UsageError(`no family ${familyId}`);
    if (fam.children.some((c) => c.person === child) || fam.partners.includes(child)) throw new UsageError(`${child} is already in ${familyId}`);
    if (relation === "birth") {
      const other = familiesAsChild(tree, child).find((f) => isBirthFamily(f, child));
      if (other) throw new UsageError(`${child} already has birth parents in ${other.id}`);
    }
    // One entry names the parents and each child: the family may cite it already.
    const cited = citation && (fam.citations ?? []).some((x) => x.source === citation.source && x.locator === citation.locator);
    const updated: Family = {
      ...fam,
      children: [...fam.children, { person: child, relation }],
      ...(citation && !cited ? { citations: withCitation(fam.citations, citation, fam.id) } : {}),
      updated: now(),
    };
    tree.put(updated, { op: "family.child", targets: [fam.id, child], summary: `${fam.id} +child ${child}${citation ? ` ← ${citation.source}` : ""}` });
    return updated;
  });
}

export interface FamilyEdit {
  /** The other partner, found later. */
  partner?: string | undefined;
  /** A child whose relation changes — to both partners, or to `parent` only. */
  child?: string | undefined;
  relation?: string | undefined;
  parent?: string | undefined;
  /** A person linked by mistake. */
  remove?: string | undefined;
}

/**
 * Change who belongs to a family and how: the partner found later, a child
 * that is a stepchild of one of them, a person linked by mistake. Everything
 * but adding the partner changes what is known: it needs a reason.
 */
export function editFamily(tree: Tree, familyId: string, edit: FamilyEdit, reason?: string): Family {
  if (!edit.partner && !edit.child && !edit.remove) throw new UsageError("nothing to change", { hint: `strom family edit ${familyId} --partner <who> · --child <who> --relation step [--parent <who>] · --remove <who>` });
  if ((edit.child || edit.remove) && !reason?.trim()) throw new UsageError("changing who belongs to a family, or how, needs --reason", { hint: 'e.g. --reason "the baptism names Jan as stepfather"' });
  if (edit.child && !edit.relation) throw new UsageError("--child needs --relation", { hint: RELATIONS.join(", ") });
  if (edit.relation && !edit.child) throw new UsageError("--relation belongs to a --child");
  if (edit.parent && !edit.child) throw new UsageError("--parent belongs to a --child");
  const relation = edit.relation as ChildRelation | undefined;
  if (relation && !RELATIONS.includes(relation)) throw new UsageError(`invalid relation "${edit.relation}"`, { hint: RELATIONS.join(", ") });
  return tree.withTreeLock(() => {
    const fam = tree.get<Family>(familyId);
    if (!fam || fam.type !== "family") throw new UsageError(`no family ${familyId}`);
    const next: Family = structuredClone(fam);
    const what: string[] = [];
    if (edit.partner) {
      requirePerson(tree, edit.partner);
      if (next.partners.includes(edit.partner) || next.children.some((c) => c.person === edit.partner)) throw new UsageError(`${edit.partner} is already in ${familyId}`);
      if (next.partners.length >= 2) throw new UsageError(`${familyId} has two partners`, { hint: "another couple is another family: strom family add …" });
      next.partners.push(edit.partner);
      what.push(`+partner ${edit.partner}`);
    }
    if (edit.child) {
      const link = next.children.find((c) => c.person === edit.child);
      if (!link) throw new UsageError(`${edit.child} is not a child of ${familyId}`, { hint: `add the child: strom family child ${familyId} ${edit.child}` });
      if (edit.parent) {
        if (!next.partners.includes(edit.parent)) throw new UsageError(`${edit.parent} is not a partner of ${familyId}`, { hint: `partners: ${next.partners.join(", ") || "none"}` });
        const relations = { ...link.relations, [edit.parent]: relation! };
        if (relations[edit.parent] === link.relation) delete relations[edit.parent];
        if (Object.keys(relations).length) link.relations = relations;
        else delete link.relations;
        what.push(`${edit.child} ${relation} of ${edit.parent}`);
      } else {
        link.relation = relation!;
        delete link.relations;
        what.push(`${edit.child} ${relation}`);
      }
      if (isBirthFamily(next, edit.child)) {
        const other = familiesAsChild(tree, edit.child).find((f) => f.id !== familyId && isBirthFamily(f, edit.child!));
        if (other) throw new UsageError(`${edit.child} already has birth parents in ${other.id}`);
      }
    }
    if (edit.remove) {
      const was = next.partners.includes(edit.remove) || next.children.some((c) => c.person === edit.remove);
      if (!was) throw new UsageError(`${edit.remove} is not in ${familyId}`);
      next.partners = next.partners.filter((p) => p !== edit.remove);
      next.children = next.children.filter((c) => c.person !== edit.remove);
      for (const c of next.children)
        if (c.relations?.[edit.remove]) {
          delete c.relations[edit.remove];
          if (!Object.keys(c.relations).length) delete c.relations;
        }
      for (const e of next.events) if (e.ages?.[edit.remove]) delete e.ages[edit.remove];
      if (next.partners.length + next.children.length === 0) throw new UsageError(`${familyId} would be empty`, { hint: "a family recorded by mistake stays: say so in a note (strom note add …)" });
      what.push(`-${edit.remove}`);
    }
    next.updated = now();
    tree.put(next, {
      op: "family.edit",
      targets: [familyId, ...[edit.partner, edit.child, edit.parent, edit.remove].filter((x): x is string => !!x)],
      summary: `${familyId} ${what.join(", ")}`,
      ...(reason ? { reason } : {}),
    });
    return next;
  });
}

/** Facts a person or couple has once: a second one is a duplicate or a conflict. */
export const SINGLE_KINDS = new Set(["BIRT", "CHR", "BAPM", "DEAT", "BURI", "CREM", "MARR", "DIV"]);

export function addEvent(tree: Tree, ownerId: string, input: EventInput): { owner: Person | Family; event: Event; same?: Event } {
  const type = typeOfId(ownerId);
  if (type !== "person" && type !== "family") throw new UsageError(`${ownerId} is not a person or a family`);
  parseDate(input.date);
  return tree.withTreeLock(() => {
    const owner = tree.get<Person | Family>(ownerId);
    if (!owner) throw new UsageError(`no ${type} ${ownerId}`);
    const event = makeEvent(tree, input, type === "family");
    const updated = { ...owner, events: [...owner.events, event], updated: now() } as Person | Family;
    tree.put(updated, {
      op: "event.add",
      targets: [owner.id, event.id],
      summary: `+${event.id} ${event.kind} ${owner.id}${event.date ? ` ${event.date}` : ""} [${event.status}]`,
    });
    // One birth, one death: a second one is usually the same fact from another record.
    const same = SINGLE_KINDS.has(event.kind) ? owner.events.find((e) => e.kind === event.kind && !e.retracted && e.status !== "disproven") : undefined;
    return { owner: updated, event, ...(same ? { same } : {}) };
  });
}

export function addNote(tree: Tree, id: string, text: string): Note {
  const type = typeOfId(id);
  if (!type) throw new UsageError(`unknown ID ${id}`);
  const note = makeNote(tree, text);
  tree.withTreeLock(() => {
    const rec = tree.get<Person | Family | Research>(id);
    if (!rec) throw new UsageError(`no record ${id}`);
    const updated = { ...rec, notes: [...rec.notes, note], updated: now() } as Person | Family | Research;
    tree.put(updated, { op: "note.add", targets: [id], summary: `${id} +note` });
  });
  return note;
}

export interface ResearchInput {
  name: string;
  focus: string;
  direction?: string | undefined;
  generations?: number | undefined;
  before?: number | undefined;
  question?: string | undefined;
  priority?: number | undefined;
  note?: string | undefined;
}

export function addResearch(tree: Tree, input: ResearchInput): Research {
  const direction = (input.direction ?? "ancestors") as Direction;
  if (!["ancestors", "descendants", "person", "question"].includes(direction))
    throw new UsageError(`invalid direction "${input.direction}"`, { hint: "ancestors, descendants, person or question" });
  requirePerson(tree, input.focus);
  if (direction === "question" && !input.question?.trim()) throw new UsageError("--question is required for direction question");
  return tree.withTreeLock(() => {
    const t = now();
    const r: Research = {
      id: tree.allocate("G"),
      type: "research",
      name: input.name.trim(),
      focus: input.focus,
      direction,
      state: "active",
      priority: input.priority ?? 3,
      notes: input.note ? [makeNote(tree, input.note)] : [],
      created: t,
      updated: t,
    };
    const limits: { generations?: number; before?: number } = {};
    if (input.generations) limits.generations = input.generations;
    if (input.before) limits.before = input.before;
    if (Object.keys(limits).length) r.limits = limits;
    if (input.question?.trim()) r.question = input.question.trim();
    tree.put(r, { op: "research.add", targets: [r.id, input.focus], summary: `+${r.id} research "${r.name}"` });
    return r;
  });
}

/** Find the person or family that holds an event. */
export function findEventOwner(tree: Tree, eventId: string): { owner: Person | Family; event: Event } {
  const id = eventId.toUpperCase();
  for (const t of ["person", "family"] as const)
    for (const r of tree.list<Person | Family>(t)) {
      const event = r.events.find((e) => e.id === id);
      if (event) return { owner: r, event };
    }
  throw new UsageError(`no event ${eventId}`, { hint: "event IDs are listed in strom person show <who>" });
}

function replaceEvent(tree: Tree, eventId: string, change: (e: Event) => Event, op: { op: string; summary: (e: Event) => string; reason?: string | undefined }): Event {
  return tree.withTreeLock(() => {
    const { owner, event } = findEventOwner(tree, eventId);
    const next = change(structuredClone(event));
    const updated = { ...owner, events: owner.events.map((e) => (e.id === event.id ? next : e)), updated: now() } as Person | Family;
    tree.put(updated, { op: op.op, targets: [owner.id, event.id], summary: op.summary(next), ...(op.reason ? { reason: op.reason } : {}) });
    return next;
  });
}

/** Attach a citation to a fact; optionally raise its status. */
export function citeEvent(tree: Tree, eventId: string, citation: Citation, status?: string): Event {
  const src = tree.get(citation.source);
  if (!src || src.type !== "source") throw new UsageError(`no source ${citation.source}`, { hint: 'strom source add "<title>" …' });
  const newStatus = status === undefined ? undefined : parseStatus(status, "lead");
  return replaceEvent(tree, eventId, (e) => {
    if (e.citations.some((c) => c.source === citation.source && c.locator === citation.locator)) throw new UsageError(`${e.id} already cites ${citation.source} there`);
    const next = { ...e, citations: [...e.citations, citation] };
    // A record raises a lead to probable; a family tree or a memory does not.
    if (newStatus) next.status = newStatus;
    else if (next.status === "lead") next.status = defaultStatus(tree, next.citations);
    checkStatus(tree, next.status, next.citations);
    return next;
  }, { op: "event.cite", summary: (e) => `${e.id} ${e.kind} ← ${citation.source} [${e.status}]` });
}

/** Cite a person (the name they are shown by) or a family itself. */
export function citeRecord(tree: Tree, id: string, citation: Citation): Person | Family {
  checkCitation(tree, citation);
  return tree.withTreeLock(() => {
    const rec = tree.get<Person | Family>(id);
    if (rec?.type === "person") {
      const primary = primaryName(rec);
      const names = rec.names.map((n) => (n === primary ? { ...n, citations: withCitation(n.citations, citation, `${id} ${gedcomName(n)}`) } : n));
      const updated: Person = { ...rec, names, updated: now() };
      tree.put(updated, { op: "person.cite", targets: [id], summary: `${id} ${gedcomName(primary)} ← ${citation.source}` });
      return updated;
    }
    if (rec?.type === "family") {
      const updated: Family = { ...rec, citations: withCitation(rec.citations, citation, id), updated: now() };
      tree.put(updated, { op: "family.cite", targets: [id], summary: `${id} ← ${citation.source}` });
      return updated;
    }
    throw new UsageError(`no person or family ${id}`);
  });
}

export interface NameInput {
  name: string;
  kind?: string | undefined;
  citation?: Citation | undefined;
  /** Show the person by this name. */
  primary?: boolean | undefined;
}

/**
 * Another name of a person: the birth surname a record reveals, a married
 * name, a spelling of another record. The same name again only adds its
 * citation. A name whose surname was unknown gives way to the full one.
 */
export function addName(tree: Tree, id: string, input: NameInput): { person: Person; name: Name } {
  const name: Name = parseName(input.name);
  if (!name.given && !name.surname) throw new UsageError("the name is empty");
  checkGiven(name);
  if (input.kind !== undefined) {
    if (!NAME_KINDS.includes(input.kind as Name["kind"] & string)) throw new UsageError(`invalid --kind "${input.kind}"`, { hint: NAME_KINDS.join(", ") });
    name.kind = input.kind as Name["kind"];
  }
  if (input.primary && name.kind && name.kind !== "birth") throw new UsageError(`a person is shown by a birth name, not a ${name.kind} one`, { hint: "drop --primary, or --kind birth" });
  if (input.citation) checkCitation(tree, input.citation);
  return tree.withTreeLock(() => {
    const p = requirePerson(tree, id);
    const i = p.names.findIndex((n) => sameName(n, name));
    let names: Name[];
    let added: Name;
    let completes = false;
    if (i >= 0) {
      // The same words: one name — the record adds its citation, --kind says what kind of name it is.
      const cur = p.names[i]!;
      const rekind = name.kind !== undefined && name.kind !== cur.kind;
      if (!input.citation && !input.primary && !rekind) throw new UsageError(`${id} already has the name ${gedcomName(name)}`, { hint: `cite it: strom name add ${id} "${gedcomName(name)}" --cite S…` });
      added = { ...cur, ...(rekind ? { kind: name.kind } : {}), ...(input.citation ? { citations: withCitation(cur.citations, input.citation, `${id} ${gedcomName(name)}`) } : {}) };
      names = p.names.map((n, j) => (j === i ? added : n));
      if (input.primary) names = [added, ...names.filter((n) => n !== added)];
    } else {
      added = input.citation ? { ...name, citations: [input.citation] } : name;
      const primary = primaryName(p);
      const plain = !name.kind || name.kind === "birth";
      // "Markéta" of the family memory is "Markéta /Růžičková/" of the register: one name, now complete.
      completes = Boolean(plain && !primary.surname && name.surname && foldText(primary.given) === foldText(name.given) && !primary.citations?.length);
      const rest = completes ? p.names.filter((n) => n !== primary) : p.names;
      names = input.primary || (plain && !primary.surname && name.surname) ? [added, ...rest] : [...rest, added];
    }
    const updated: Person = { ...p, names, updated: now() };
    tree.put(updated, {
      op: "person.name",
      targets: [id],
      summary: `${id} name ${gedcomName(added)}${added.kind ? ` (${added.kind})` : ""}${input.citation ? ` ← ${input.citation.source}` : ""}`,
      ...(completes ? { reason: `the name without a surname is completed: ${gedcomName(added)}` } : {}),
    });
    return { person: updated, name: added };
  });
}

export interface PersonEdit {
  sex?: string | undefined;
  /** Corrected spelling of the name the person is shown by. */
  name?: string | undefined;
}

/** Change a person's sex or correct the spelling of their name — with a reason, unless an unknown sex is filled in. */
export function editPerson(tree: Tree, id: string, edit: PersonEdit, reason?: string): Person {
  const sex = edit.sex === undefined ? undefined : parseSex(edit.sex);
  const name = edit.name === undefined ? undefined : parseName(edit.name);
  if (name && !name.given && !name.surname) throw new UsageError("the name is empty");
  if (name) checkGiven(name);
  if (sex === undefined && !name) throw new UsageError("nothing to change", { hint: `strom person edit ${id} --sex M|F · --name "<Given /Surname/>"` });
  return tree.withTreeLock(() => {
    const p = requirePerson(tree, id);
    const primary = primaryName(p);
    // Filling in an unknown sex is no change; another sex or another name is.
    const overwrites = (sex !== undefined && p.sex !== "U" && p.sex !== sex) || name;
    if (overwrites && !reason?.trim()) throw new UsageError("changing a name or a known sex needs --reason", { hint: 'e.g. --reason "misread: the register has Víšek, not Višek"' });
    const names = name ? p.names.map((n) => (n === primary ? { ...n, given: name.given, surname: name.surname } : n)) : p.names;
    const updated: Person = { ...p, ...(sex !== undefined ? { sex } : {}), names, updated: now() };
    const what = [sex !== undefined ? `sex ${sex}` : "", name ? `name ${gedcomName(name)}` : ""].filter(Boolean).join(", ");
    tree.put(updated, { op: "person.edit", targets: [id], summary: `${id} ${what}`, ...(reason ? { reason } : {}) });
    return updated;
  });
}

export interface EventEdit {
  date?: string | undefined;
  place?: string | undefined;
  house?: string | undefined;
  cause?: string | undefined;
  value?: string | undefined;
  label?: string | undefined;
  status?: string | undefined;
  note?: string | undefined;
  /** A person's age as the record gives it. */
  age?: string | undefined;
  /** Partners' ages at a family event: person ID → age. */
  ages?: Record<string, string> | undefined;
  /** People the record names in a role (added to those known). */
  participants?: Participant[] | undefined;
  /** Participants recorded wrongly (a godparent entered as a witness, a misread name): taken off. */
  drop?: Participant[] | undefined;
}

/**
 * Change a fact, or add what another record says about it (ages, the house,
 * godparents, witnesses). Filling in what was unknown is free; changing what
 * was known — or the status — needs a reason.
 */
export function editEvent(tree: Tree, eventId: string, edit: EventEdit, reason?: string): Event {
  const date = edit.date === undefined ? undefined : parseDate(edit.date);
  const age = edit.age === undefined ? undefined : parseAge(edit.age);
  const ages = edit.ages ? Object.fromEntries(Object.entries(edit.ages).map(([who, a]) => [who, parseAge(a, who)])) : undefined;
  return replaceEvent(tree, eventId, (e) => {
    const changed: string[] = [];
    const set = <K extends "date" | "place" | "house" | "cause" | "value" | "label" | "age">(k: K, v: string | undefined) => {
      if (v === undefined) return;
      const nv = v.trim();
      if (e[k] !== undefined && e[k] !== nv) changed.push(k);
      if (nv) next[k] = nv;
      else delete next[k];
    };
    const next: Event = { ...e };
    set("date", date);
    set("place", edit.place);
    set("house", edit.house);
    set("cause", edit.cause);
    set("value", edit.value);
    set("label", edit.label);
    if (age !== undefined) {
      if (typeOfId(findEventOwner(tree, e.id).owner.id) === "family") throw new UsageError("a family event has the age of each partner", { hint: "--age husband:25 --age wife:22" });
      set("age", age);
    }
    if (ages) {
      for (const [who, a] of Object.entries(ages)) if (e.ages?.[who] !== undefined && e.ages[who] !== a) changed.push(`age of ${who}`);
      next.ages = { ...e.ages, ...ages };
    }
    const key = (p: Participant) => `${p.role}|${p.person ?? foldText(p.name ?? "")}`;
    if (edit.drop?.length) {
      const gone = new Set(edit.drop.map(key));
      for (const d of edit.drop)
        if (!(e.participants ?? []).some((p) => key(p) === key(d)))
          throw new UsageError(`${e.id} has no ${d.role} ${d.person ?? d.name}`, { hint: `its participants: ${(e.participants ?? []).map((p) => `${p.role}:${p.person ?? p.name}`).join(", ") || "none"}` });
      next.participants = (e.participants ?? []).filter((p) => !gone.has(key(p)));
      if (!next.participants.length) delete next.participants;
      changed.push("participants");
    }
    if (edit.participants?.length) {
      const known = new Set((next.participants ?? []).map(key));
      next.participants = [...(next.participants ?? []), ...edit.participants.filter((p) => !known.has(key(p)))];
    }
    if (edit.note !== undefined) next.note = makeNote(tree, edit.note).text;
    if (edit.status !== undefined) {
      next.status = parseStatus(edit.status, e.status);
      if (next.status !== e.status) changed.push("status");
      checkStatus(tree, next.status, next.citations);
    }
    if (changed.length && !reason?.trim())
      throw new UsageError(`changing the ${changed.join(", ")} of ${e.id} needs --reason`, { hint: 'e.g. --reason "record S0012 gives 1811, not 1813"' });
    return next;
  }, { op: "event.edit", summary: (e) => `${e.id} ${e.kind} edited`, reason });
}

/** Withdraw a fact without deleting it. */
export function retractEvent(tree: Tree, eventId: string, reason: string): Event {
  if (!reason?.trim()) throw new UsageError("retracting needs --reason");
  return replaceEvent(tree, eventId, (e) => ({ ...e, status: "retracted", retracted: { at: now(), reason: reason.trim() } }), {
    op: "event.retract",
    summary: (e) => `${e.id} ${e.kind} retracted`,
    reason,
  });
}

/**
 * A person who turned out not to exist (a misreading, a wrong link): kept,
 * retracted with the reason; no longer anyone's parent, child or partner in
 * the listings and the GEDCOM. A duplicate is merged instead.
 */
export function retractPerson(tree: Tree, id: string, reason: string): Person {
  if (!reason?.trim()) throw new UsageError("retracting needs --reason", { hint: 'e.g. --reason "misread: the entry names Anna, not Anton"' });
  return tree.withTreeLock(() => {
    const p = requirePerson(tree, id);
    if (p.retracted) throw new UsageError(`${id} is already retracted`);
    const focus = tree.list<{ id: string; focus?: string } & AnyRecord>("research").find((r) => r.focus === id);
    if (focus) throw new UsageError(`${id} is the focus of ${focus.id}`, { hint: "a research needs its person" });
    const updated: Person = { ...p, retracted: { at: now(), reason: reason.trim() }, updated: now() };
    tree.put(updated, { op: "person.retract", targets: [id], summary: `${id} ${gedcomName(primaryName(p))} retracted`, reason: reason.trim() });
    return updated;
  });
}

// ── merging duplicates ─────────────────────────────────────────────────────

/** `value` with every reference `from` replaced by `to` (a list keeps it once). */
function replaceId(value: unknown, from: string, to: string): unknown {
  if (value === from) return to;
  if (Array.isArray(value)) {
    const out = value.map((v) => replaceId(v, from, to));
    return value.includes(from) ? [...new Set(out)] : out;
  }
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceId(v, from, to)]));
  return value;
}

/** Point every other record that names `from` at `to`: tasks, hypotheses, researches, participants, families. */
function repoint(tree: Tree, from: string, to: string, skip: Set<string>, op: { op: string; reason: string }): number {
  let n = 0;
  for (const type of Object.keys(RECORD_TYPES) as RecordType[]) {
    for (const rec of tree.list<AnyRecord>(type)) {
      // a merged or retracted record is history: it keeps what it said
      if (skip.has(rec.id) || rec.retracted) continue;
      const text = JSON.stringify(rec);
      if (!text.includes(`"${from}"`)) continue;
      const next = replaceId(rec, from, to) as AnyRecord;
      if (next.type === "family") {
        // the same child twice: the first link (with its relation) stays
        const seen = new Set<string>();
        next.children = next.children.filter((c) => !seen.has(c.person) && seen.add(c.person));
      }
      tree.put({ ...next, updated: now() } as AnyRecord, { op: op.op, targets: [rec.id, from, to], summary: `${rec.id}: ${from} → ${to}`, reason: op.reason });
      n++;
    }
  }
  return n;
}

/**
 * Two records of one person: everything of `other` goes to `keep` (names,
 * facts, notes, families, every reference); `other` stays, retracted, as
 * "merged into". Different birth parents or sexes are refused.
 */
export function mergePersons(tree: Tree, keepId: string, otherId: string, reason: string): { person: Person; repointed: number } {
  if (!reason?.trim()) throw new UsageError("merging needs --reason", { hint: 'e.g. --reason "same baptism entry: B0003:114"' });
  if (keepId === otherId) throw new UsageError("that is the same person");
  return tree.withTreeLock(() => {
    const keep = requirePerson(tree, keepId);
    const other = requirePerson(tree, otherId);
    if (keep.retracted || other.retracted) throw new UsageError(`${keep.retracted ? keepId : otherId} is retracted`);
    if (keep.sex !== "U" && other.sex !== "U" && keep.sex !== other.sex) throw new UsageError(`${keepId} is ${keep.sex}, ${otherId} is ${other.sex}`, { hint: "correct the wrong one first: strom person edit … --sex … --reason …" });
    const together = familiesAsPartner(tree, keepId).find((f) => f.partners.includes(otherId));
    if (together) throw new UsageError(`${keepId} and ${otherId} are the partners of ${together.id}`);
    const birth = (id: string) => familiesAsChild(tree, id).find((f) => isBirthFamily(f, id));
    const kb = birth(keepId);
    const ob = birth(otherId);
    if (kb && ob && kb.id !== ob.id)
      throw new UsageError(`${keepId} and ${otherId} have different birth parents (${kb.id}, ${ob.id})`, {
        hint: `if they are the same parents, merge the families first: strom family merge ${kb.id} ${ob.id} --reason "…"`,
      });
    // names: the other's variants join; the same name brings its citations
    const names = keep.names.map((n) => {
      const same = other.names.find((o) => sameName(o, n));
      const cites = [...(n.citations ?? []), ...(same?.citations ?? []).filter((c) => !(n.citations ?? []).some((x) => x.source === c.source && x.locator === c.locator))];
      return cites.length ? { ...n, citations: cites } : n;
    });
    for (const o of other.names) if (!names.some((n) => sameName(n, o))) names.push(o);
    const refs = [...(keep.refs ?? []), ...(other.refs ?? []).filter((r) => !(keep.refs ?? []).some((k) => k.system === r.system && k.id === r.id))];
    const why = reason.trim();
    const merged: Person = {
      ...keep,
      names,
      sex: keep.sex === "U" ? other.sex : keep.sex,
      events: [...keep.events, ...other.events],
      notes: [...keep.notes, ...other.notes],
      ...(refs.length ? { refs } : {}),
      updated: now(),
    };
    tree.put(merged, {
      op: "person.merge",
      targets: [keepId, otherId, ...other.events.map((e) => e.id)],
      summary: `${otherId} merged into ${keepId}: ${other.events.length} fact(s), ${other.names.length} name(s)`,
      reason: why,
    });
    const stub: Person = { ...other, events: [], retracted: { at: now(), reason: `merged into ${keepId}: ${why}` }, mergedInto: keepId, updated: now() };
    tree.put(stub, { op: "person.merge", targets: [otherId, keepId], summary: `${otherId} → ${keepId}`, reason: why });
    const repointed = repoint(tree, otherId, keepId, new Set([keepId, otherId]), { op: "person.merge", reason: why });
    return { person: merged, repointed };
  });
}

/** Two records of one family (the same couple): partners, children, facts and citations go to `keep`. */
export function mergeFamilies(tree: Tree, keepId: string, otherId: string, reason: string): { family: Family; repointed: number } {
  if (!reason?.trim()) throw new UsageError("merging needs --reason", { hint: 'e.g. --reason "the same couple: Antonín Víšek and Markéta Růžičková"' });
  if (keepId === otherId) throw new UsageError("that is the same family");
  return tree.withTreeLock(() => {
    const get = (id: string) => {
      const f = tree.get<Family>(id);
      if (!f || f.type !== "family") throw new UsageError(`no family ${id}`);
      if (f.retracted) throw new UsageError(`${id} is retracted`);
      return f;
    };
    const keep = get(keepId);
    const other = get(otherId);
    const partners = [...new Set([...keep.partners, ...other.partners])];
    if (partners.length > 2)
      throw new UsageError(`${keepId} and ${otherId} are different couples (${partners.join(", ")})`, { hint: "if a partner is recorded twice, merge those persons first: strom person merge …" });
    const children = [...keep.children, ...other.children.filter((c) => !keep.children.some((k) => k.person === c.person))];
    const citations = [...(keep.citations ?? []), ...(other.citations ?? []).filter((c) => !(keep.citations ?? []).some((x) => x.source === c.source && x.locator === c.locator))];
    const refs = [...(keep.refs ?? []), ...(other.refs ?? []).filter((r) => !(keep.refs ?? []).some((k) => k.system === r.system && k.id === r.id))];
    const why = reason.trim();
    const merged: Family = {
      ...keep,
      partners,
      children,
      events: [...keep.events, ...other.events],
      ...(citations.length ? { citations } : {}),
      notes: [...keep.notes, ...other.notes],
      ...(refs.length ? { refs } : {}),
      updated: now(),
    };
    tree.put(merged, {
      op: "family.merge",
      targets: [keepId, otherId, ...partners, ...children.map((c) => c.person)],
      summary: `${otherId} merged into ${keepId}: ${other.children.length} child link(s), ${other.events.length} fact(s)`,
      reason: why,
    });
    const stub: Family = { ...other, events: [], retracted: { at: now(), reason: `merged into ${keepId}: ${why}` }, mergedInto: keepId, updated: now() };
    tree.put(stub, { op: "family.merge", targets: [otherId, keepId], summary: `${otherId} → ${keepId}`, reason: why });
    const repointed = repoint(tree, otherId, keepId, new Set([keepId, otherId]), { op: "family.merge", reason: why });
    return { family: merged, repointed };
  });
}

// ── stories ────────────────────────────────────────────────────────────────

export interface StoryInput {
  text: string;
  title?: string | undefined;
  facts?: string[] | undefined;
  note?: string | undefined;
  final?: boolean | undefined;
}

/** Write (or rewrite) the story of a person or a couple. The facts it leans on must exist. */
export function setStory(tree: Tree, id: string, input: StoryInput): Person | Family {
  const text = input.text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new UsageError("the story is empty");
  const facts = [...new Set((input.facts ?? []).map((f) => f.trim().toUpperCase()))];
  for (const f of facts) findEventOwner(tree, f);
  return tree.withTreeLock(() => {
    const rec = tree.get<Person | Family>(id);
    if (!rec || (rec.type !== "person" && rec.type !== "family")) throw new UsageError(`no person or family ${id}`);
    if (rec.mergedInto) throw new UsageError(`${id} was merged into ${rec.mergedInto}`);
    const story: Story = {
      ...(input.title?.trim() ? { title: input.title.trim() } : {}),
      status: input.final ? "final" : "draft",
      text,
      facts,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      at: now(),
      by: tree.actor,
    };
    const updated = { ...rec, story, updated: now() } as Person | Family;
    const words = text.split(/\s+/).length;
    tree.put(updated, { op: "story.set", targets: [id], summary: `${id} story${rec.story ? " rewritten" : ""}: ${words} words, ${story.status}` });
    return updated;
  });
}
