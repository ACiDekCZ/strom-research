// The person of the tree a participant named only may be (strom event add|edit --with): told, never linked by itself.
// Apart from core/participants.ts, which core/check.ts and core/actions.ts load: the forms of one surname
// (core/surnames.ts) draw the GEDCOM export in.

import type { Event, Family, Participant, ParticipantRole, Person } from "./model.ts";
import type { Tree } from "./tree.ts";
import { familiesAsChild, parentsOf } from "./people.ts";
import { sameFamily } from "./surnames.ts";
import { foldText } from "./text.ts";
import { nameWords, participantSpec } from "./participants.ts";

/** A participant named only, who may be a person of the tree: the one person around the record of that name. */
export interface ParticipantSuggestion {
  role: ParticipantRole;
  name: string;
  person: string;
  /** What --with takes for the person: "godparent:P0012". */
  with: string;
}

function siblingsOf(tree: Tree, id: string): Person[] {
  const out: Person[] = [];
  for (const f of familiesAsChild(tree, id))
    for (const c of f.children) {
      if (c.person === id) continue;
      const p = tree.get<Person>(c.person);
      if (p && !p.retracted && !out.includes(p)) out.push(p);
    }
  return out;
}

/** The people around a fact: the parents of its person (or of each partner), their parents and their brothers and sisters. */
export function aroundOf(tree: Tree, owner: Person | Family): Person[] {
  const base = owner.type === "person" ? [owner.id] : owner.partners;
  const out = new Map<string, Person>();
  const add = (ps: Person[]) => ps.forEach((p) => base.includes(p.id) || out.set(p.id, p));
  for (const id of base) {
    const parents = parentsOf(tree, id);
    add(parents);
    for (const p of parents) {
      add(parentsOf(tree, p.id));
      add(siblingsOf(tree, p.id));
    }
    // at a wedding the couple's own brothers and sisters stand by
    if (owner.type === "family") add(siblingsOf(tree, id));
  }
  return [...out.values()];
}

/**
 * The person of the tree a participant named only may be: of the people around the fact (aroundOf), the one whose
 * first given name and surname (one family's forms: core/surnames.ts) are the participant's. One alone, else nothing —
 * never linked by itself: the agent is told, and links it with strom event edit if the record says so.
 */
export function suggestPeople(tree: Tree, owner: Person | Family, participants: Participant[]): ParticipantSuggestion[] {
  const named = participants.filter((p) => p.name && !p.person);
  if (!named.length) return [];
  const around = aroundOf(tree, owner);
  if (!around.length) return [];
  const linked = new Set([...(owner.events ?? []).flatMap((e: Event) => (e.participants ?? []).map((p) => p.person)), ...participants.map((p) => p.person)].filter(Boolean));
  const family = sameFamily(tree);
  const out: ParticipantSuggestion[] = [];
  for (const p of named) {
    const words = nameWords(p.name!);
    if (words.length < 2) continue;
    const given = foldText(words[0]!);
    const surname = words[words.length - 1]!;
    const hits = around.filter(
      (x) => !linked.has(x.id) && x.names.some((n) => !!n.surname && foldText(n.given.split(/\s+/u)[0] ?? "") === given && family(n.surname, surname)),
    );
    if (hits.length !== 1) continue;
    out.push({ role: p.role, name: p.name!, person: hits[0]!.id, with: `${p.role}:${hits[0]!.id}` });
  }
  return out;
}

/** What strom says of each suggestion, for the agent (English): the person, and the command that would link it. */
export function suggestionLines(eventId: string, s: ParticipantSuggestion[], note: (x: ParticipantSuggestion) => string | undefined): string[] {
  return s.map(
    (x) =>
      `${x.role} ${x.name}: is this ${x.person}? \`${x.with}\` — if the record says so: strom event edit ${eventId} --without "${participantSpec(x.role, x.name)}" --with "${participantSpec(x.role, x.person, note(x))}" --reason "<why it is ${x.person}>"`,
  );
}
