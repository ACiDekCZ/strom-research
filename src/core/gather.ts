// Tasks of a wider line taken into a line inside it (strom research gather, strom research new --move-tasks).
//
// A new line is inside a wider one when its person is in that one's scope (the ancestors of a grandfather inside
// those of his grandson). The wider line's own tasks — those that name it as their research — about people all in
// the new line's scope then belong to the new one: they are taken over in one operation of the history, which says
// where each task came from, so it can be given back exactly (--undo). A task without a research of its own goes by
// the narrowest line already (core/directions.ts directionOf) and is never touched; nor is one at work (doing, or
// held by an open session), put aside, finished, or about anybody outside the new line. Nothing new in data/: the
// tasks' research changes, the history keeps the rest.

import type { Research, Task } from "./model.ts";
import { aboutPeople, scopes, type Scope } from "./directions.ts";
import { researchPeople } from "./frontier.ts";
import { openSessions } from "./session.ts";
import { now, type Op, type Tree } from "./tree.ts";

export const GATHER_OP = "research.gather";
export const UNGATHER_OP = "research.ungather";

/** The tasks a line would take from the wider lines it is inside, and those lines (in the order of their IDs). */
export interface Gatherable {
  tasks: Task[];
  from: string[];
}

/** Which tasks may move: open or waiting for the user, never one at work. */
const MOVABLE = new Set<string>(["open", "waiting"]);

/** The wider lines a line is inside: its person in their scope (a paused line keeps its tasks: the user's "not now"). */
export function widerLines(tree: Tree, line: Research, all: Scope[] = scopes(tree)): Research[] {
  return all
    .filter((s) => s.research.id !== line.id && !s.research.retracted && s.research.state !== "paused" && s.people.has(line.focus))
    .map((s) => s.research)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The tasks of the wider lines a line would take: their own, open or waiting, about people all in the line's scope. */
export function gatherable(tree: Tree, line: Research, all: Scope[] = scopes(tree)): Gatherable {
  const scope = all.find((s) => s.research.id === line.id)?.people;
  if (!scope?.size || line.retracted) return { tasks: [], from: [] };
  const wider = new Set(widerLines(tree, line, all).map((r) => r.id));
  if (!wider.size) return { tasks: [], from: [] };
  // held by a session open now (strom task start, a run's session): at work whatever its state says (spec 127)
  const held = new Set(openSessions(tree).flatMap((s) => (s.task ? [s.task] : [])));
  const tasks = tree
    .list<Task>("task")
    .filter((t) => {
      if (!t.research || !wider.has(t.research) || !MOVABLE.has(t.state) || t.retracted || held.has(t.id)) return false;
      const about = aboutPeople(tree, t.subject);
      return about.length > 0 && about.every((p) => scope.has(p));
    })
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const from = [...new Set(tasks.map((t) => t.research!))].sort();
  return { tasks, from };
}

/**
 * What a line not made yet would take (the Strom app asks before it makes one, spec 126 K2.15): the wider lines it
 * would be inside, and how many of their tasks would move to it. Nothing is written.
 */
export function gatherPreview(tree: Tree, line: Pick<Research, "focus" | "direction" | "limits" | "question">): { inside: string[]; move: number } {
  const at = now();
  const draft: Research = { id: "G0", type: "research", name: "", state: "active", priority: 3, notes: [], created: at, updated: at, ...line };
  const all = [...scopes(tree).filter((s) => s.research.id !== draft.id), { research: draft, people: researchPeople(tree, draft) }];
  return { inside: widerLines(tree, draft, all).map((r) => r.id), move: gatherable(tree, draft, all).tasks.length };
}

/** Groups of tasks by the line they came from, as an operation's targets keep them: [line, from, T…, from, T…]. */
function targetsOf(line: string, groups: Map<string, string[]>): string[] {
  return [line, ...[...groups].flatMap(([from, ids]) => [from, ...ids])];
}

/** The groups an operation's targets name (the line itself first, left out). */
export function groupsOf(op: Pick<Op, "targets">): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let from: string | undefined;
  for (const id of op.targets.slice(1)) {
    if (/^G\d+$/u.test(id)) {
      from = id;
      out.set(from, out.get(from) ?? []);
    } else if (from && /^T\d+$/u.test(id)) out.get(from)!.push(id);
  }
  return out;
}

function said(line: string, groups: Map<string, string[]>, back: boolean): string {
  const n = [...groups.values()].reduce((a, ids) => a + ids.length, 0);
  const each = [...groups].map(([from, ids]) => `${ids.join(" ")} ${back ? "to" : "from"} ${from}`).join("; ");
  return back ? `${line} gave back ${n} task${n === 1 ? "" : "s"}: ${each}` : `${line} took ${n} task${n === 1 ? "" : "s"} of the lines it is inside: ${each}`;
}

/** The tasks taken into the line, one operation (inside the tree's lock). Nothing to take: nothing written. */
export function gather(tree: Tree, line: Research): { moved: string[]; from: string[] } {
  return tree.withTreeLock(() => {
    const { tasks, from } = gatherable(tree, line);
    if (!tasks.length) return { moved: [], from: [] };
    const at = now();
    const groups = new Map<string, string[]>(from.map((g) => [g, tasks.filter((t) => t.research === g).map((t) => t.id)]));
    tree.putMany(
      tasks.map((t) => ({ ...t, research: line.id, updated: at })),
      [],
      { op: GATHER_OP, targets: targetsOf(line.id, groups), summary: said(line.id, groups, false) },
    );
    return { moved: tasks.map((t) => t.id), from };
  });
}

/** The line's last taking not given back yet, from the history (each given back takes off the last one before it). */
export function lastGather(tree: Tree, line: string): Op | undefined {
  const stack: Op[] = [];
  const ops = tree
    .readOps()
    .filter((o) => (o.op === GATHER_OP || o.op === UNGATHER_OP) && o.targets[0] === line)
    .map((o, i) => ({ o, i }))
    .sort((a, b) => a.o.at.localeCompare(b.o.at) || a.i - b.i);
  for (const { o } of ops) {
    if (o.op === GATHER_OP) stack.push(o);
    else stack.pop();
  }
  return stack.at(-1);
}

/**
 * The line's last taking given back: each of its tasks that still has the line goes back to the line it came from,
 * one operation (inside the tree's lock). A taking none of whose tasks has the line any more: nothing written.
 */
export function ungather(tree: Tree, line: Research): { returned: string[]; to: string[]; found: boolean } {
  return tree.withTreeLock(() => {
    const last = lastGather(tree, line.id);
    if (!last) return { returned: [], to: [], found: false };
    const at = now();
    const groups = new Map<string, string[]>();
    const records: Task[] = [];
    for (const [from, ids] of groupsOf(last)) {
      for (const id of ids) {
        const t = tree.get<Task>(id);
        if (t?.type !== "task" || t.research !== line.id) continue;
        groups.set(from, [...(groups.get(from) ?? []), id]);
        records.push({ ...t, research: from, updated: at });
      }
    }
    if (!records.length) return { returned: [], to: [], found: true };
    tree.putMany(records, [], { op: UNGATHER_OP, targets: targetsOf(line.id, groups), summary: said(line.id, groups, true) });
    return { returned: records.map((t) => t.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), to: [...groups.keys()].sort(), found: true };
  });
}
