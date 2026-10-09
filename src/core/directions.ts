// Which direction of a research (G…) a task belongs to. A task names its
// research when it was added in a session of one (or named it); a task added
// elsewhere belongs to the direction its people are in — the narrowest one when
// several reach them (the ancestors of a grandmother before those of her
// grandson). The queue, the menu and the Strom app go by the same answer.

import type { Family, Hypothesis, Person, Research, Task } from "./model.ts";
import { researchPeople } from "./frontier.ts";
import { subjectPeople } from "./records.ts";
import { typeOfId, type Tree } from "./tree.ts";

/** A research with the people it is about (its scope). */
export interface Scope {
  research: Research;
  people: Map<string, number>;
}

export function scopes(tree: Tree): Scope[] {
  return tree.list<Research>("research").map((research) => ({ research, people: researchPeople(tree, research) }));
}

/** The people a task is about: its persons, the partners of its families, the people of its conflicts and hypotheses. */
export function aboutPeople(tree: Tree, subject: string[]): string[] {
  const partners = subject.filter((id) => typeOfId(id) === "family").flatMap((id) => tree.get<Family>(id)?.partners ?? []);
  return [...new Set([...subjectPeople(tree, subject), ...partners])];
}

/** Whether a text names a record by its ID (any script around it: never \b, which knows only ASCII letters). */
export function namesId(text: string, id: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${id}(?![\\p{L}\\p{M}\\p{N}])`, "u").test(text);
}

const PERSON_ID = /(?<![\p{L}\p{M}\p{N}])P\d{4,}(?![\p{L}\p{M}\p{N}])/gu;

/**
 * The people a hypothesis is about: those of its subject, and the people of the tree its question and its variants'
 * claims name by ID ("the son of P0012 and P0013") — a variant that names a family nothing links to the tree would
 * join it, though the subject names only the person of the tree. What each variant cites for or against it is
 * evidence, not who it is about.
 */
export function hypothesisPeople(tree: Tree, h: Hypothesis): string[] {
  const named = [h.question, ...h.variants.map((v) => v.claim)].flatMap((text) => text.match(PERSON_ID) ?? []);
  const people = named.filter((id) => {
    const p = tree.get<Person>(id);
    return p && !p.retracted;
  });
  return [...new Set([...aboutPeople(tree, h.subject), ...people])];
}

/** The direction a task belongs to: its own, else the narrowest one its people are in; none for a task about nobody. */
export function directionOf(tree: Tree, t: Pick<Task, "subject"> & { research?: string }, all: Scope[]): string | undefined {
  if (t.research) return t.research;
  const about = aboutPeople(tree, t.subject);
  if (!about.length) return undefined;
  return all
    .filter((s) => about.some((p) => s.people.has(p)))
    .sort((a, b) => a.people.size - b.people.size || a.research.id.localeCompare(b.research.id))[0]?.research.id;
}

/**
 * Whether a task is work of a research (strom session start --research, strom
 * run --research): its own, or about the people it is about (a task added
 * elsewhere or before it began); a task about nobody and of no research, any
 * research's.
 */
export function ofResearch(tree: Tree, t: Task, scope: Scope): boolean {
  if (t.research === scope.research.id) return true;
  const about = aboutPeople(tree, t.subject);
  if (!about.length) return !t.research;
  return about.some((p) => scope.people.has(p)) || (!t.research && !scope.people.size);
}
