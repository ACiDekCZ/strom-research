// What helps most (spec 105 K4.1): how much dealing with a thing that waits for the person would grow the family tree
// — new ancestors, the tasks it frees — and why, in a few words in the research's language. Deterministic and cheap: no
// reader, no network, nothing written; worked out once for the whole of What waits (waitingFor with `gain`: kinship,
// the directions, the books' tasks each once, the edge of only the people the items are about). The cost of a download
// is never weighed: the tree grown is what counts (spec 105, its decisions).
//
// The score of an item with tasks behind it (a task's item: the task; an archive's question: its `tasks`):
//   generation +50 — someone the item is about (the people of its tasks' subjects: aboutPeople) stands at the edge of
//     the tree with both parents or one missing and the research reaching them: as treeEdges says it (edgeReach),
//     missing parents | father | mother and scope "in" — never a parent unproven (proof), never one beyond a direction's
//     limit, paused, done, most likely living, outside the directions or off the tree. Its part names one of them: the
//     highest generation in the direction that reaches them, then the lowest ID.
//   line +30 — someone it is about is an ancestor of the people the research is for (kinship 0).
//   unblocks +10 × min(n, 10) — n: the tasks dealing with it frees, each once: its own, and every task open (those at
//     work among them) or put aside that needs the book of one of its own — the book of a task as What waits says it
//     (bookOfTask: the one it waits for, else the one to be searched in, else the one book its where names), the tasks
//     of that book as strom task books counts them (core/books.ts bookTasks: needsBooks, every book a task names, each
//     as it stands). Other waiting tasks of the book are not counted: each is an item of its own. A part only for n ≥ 2;
//     a task alone adds its 10 unsaid.
// No gain (no field): an item with no task behind it (a story, a send, a conflict, a place, a branch, a hypothesis, a
// new wording of a transcript, a connector taken over), and one whose score is 0 (a question no task waits for).

import type { Person, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { aboutPeople, scopes, type Scope } from "./directions.ts";
import { edgeReach, type EdgeReach } from "./edge.ts";
import { kinship } from "./kin.ts";
import { bookOfTask, bookTasks, type BookTasks } from "./books.ts";
import { displayName } from "./people.ts";
import { phrase } from "./phrases.ts";

/** What each part adds to the score: a new generation, the direct line, each task freed (at most UNBLOCKS_MAX counted). */
export const GAIN_POINTS = { generation: 50, line: 30, task: 10 } as const;
export const UNBLOCKS_MAX = 10;

/** Why an item helps: a new generation above a person, the direct line, the tasks it frees (two or more). */
export type GainPart = { kind: "generation"; person: string; name: string; missing: "parents" | "father" | "mother" } | { kind: "line" } | { kind: "unblocks"; n: number };

/** The gain of an item (/status waiting[].gain, strom task list --order gain): its score, its parts, and they said. */
export interface Gain {
  score: number;
  /** The parts in the research's language, joined by " · " (generation, line, unblocks); "" when only a task alone counts. */
  says: string;
  parts: GainPart[];
}

/** An item of What waits as the gain reads it: its ID, the tasks behind it. */
export interface GainItem {
  id: string;
  tasks: Task[];
}

const byId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** The parts said in a language, in their order. */
export function gainSays(lang: string, parts: GainPart[]): string {
  return parts
    .map((p) => (p.kind === "generation" ? phrase(lang, `wait.gain.${p.missing}`, { name: p.name }) : p.kind === "line" ? phrase(lang, "wait.gain.line") : phrase(lang, "wait.gain.unblocks", { n: p.n })))
    .join(" · ");
}

/** The gain of each item with tasks behind it whose score is above 0, by the item's ID. `all`: the research's directions, when the caller has them. */
export function waitGains(tree: Tree, items: GainItem[], all?: Scope[]): Map<string, Gain> {
  const out = new Map<string, Gain>();
  const withTasks = items.filter((i) => i.tasks.length);
  if (!withTasks.length) return out;
  const kin = kinship(tree);
  const reachOf = edgeReach(tree, (all ?? scopes(tree)).filter((s) => !s.research.retracted), kin);
  // each person's edge once, only of the people the items are about
  const reached = new Map<string, EdgeReach | undefined>();
  const reach = (id: string) => {
    if (!reached.has(id)) {
      const p = tree.get<Person>(id);
      reached.set(id, p?.type === "person" && !p.retracted ? reachOf(p) : undefined);
    }
    return reached.get(id);
  };
  let books: Map<string, BookTasks> | undefined;
  for (const item of withTasks) {
    const people = [...new Set(item.tasks.flatMap((t) => aboutPeople(tree, t.subject)))];
    const parts: GainPart[] = [];
    let score = 0;
    // a new generation: the person at the edge the research reaches, the highest generation first
    let edge: { person: string; generation: number; missing: "parents" | "father" | "mother" } | undefined;
    for (const id of people) {
      const r = reach(id);
      if (!r || r.scope !== "in" || r.missing === "proof") continue;
      const generation = r.through?.people.get(id) ?? 0;
      if (!edge || generation > edge.generation || (generation === edge.generation && byId(id, edge.person) < 0)) edge = { person: id, generation, missing: r.missing };
    }
    if (edge) {
      const p = tree.get<Person>(edge.person)!;
      parts.push({ kind: "generation", person: edge.person, name: displayName(p), missing: edge.missing });
      score += GAIN_POINTS.generation;
    }
    if (people.some((id) => kin.get(id) === 0)) {
      parts.push({ kind: "line" });
      score += GAIN_POINTS.line;
    }
    // the tasks it frees: its own, and the open and parked ones of its own tasks' books
    const freed = new Set(item.tasks.map((t) => t.id));
    for (const t of item.tasks) {
      const book = bookOfTask(tree, t);
      const row = book ? (books ??= bookTasks(tree)).get(book) : undefined;
      for (const id of [...(row?.ids.open ?? []), ...(row?.ids.parked ?? [])]) freed.add(id);
    }
    score += GAIN_POINTS.task * Math.min(freed.size, UNBLOCKS_MAX);
    if (freed.size >= 2) parts.push({ kind: "unblocks", n: freed.size });
    if (score > 0) out.set(item.id, { score, says: gainSays(tree.lang, parts), parts });
  }
  return out;
}
