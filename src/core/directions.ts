// Which direction of a research (G…) a task belongs to. A task names its
// research when it was added in a session of one (or named it); a task added
// elsewhere belongs to the direction its people are in — the narrowest one when
// several reach them (the ancestors of a grandmother before those of her
// grandson). The queue, the menu and the Strom app go by the same answer.

import type { Family, Research, Task } from "./model.ts";
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
