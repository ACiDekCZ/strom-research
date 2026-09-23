// The order of the task queue. A research spreads out: the nearest ancestors
// first, but no line takes every session — a line that just had sessions waits
// while the others get theirs, a task tried again and again sinks instead of
// being taken forever, and work that needs a download comes after what can be
// done now. Strategies (setting queue.strategy): balanced (the default), depth
// (stay on the line of the last sessions), priority (strict priority).

import type { Media, Research, Session, Strategy, Task } from "./model.ts";
import { parentsOf } from "./people.ts";
import { taskRecordsets } from "./frontier.ts";
import { now, type Tree } from "./tree.ts";
import { subjectPeople } from "./records.ts";

export const LEVEL_ORDER: Record<string, number> = { intake: 0, locate: 1, link: 2, verify: 3, enrich: 4, request: 5, narrate: 6 };

/** Levels that read records: without images of their record sets they can only ask the user for them. */
const NEEDS_IMAGES = new Set(["link", "verify"]);

/** How many of the last sessions count as "recent" when spreading the work over the lines. */
const RECENT = 4;

/** A generation for work about no ancestor (a sibling, a side line, a book): after the close ancestors. */
const OFF_LINE_GENERATION = 4;

export interface Ranked {
  task: Task;
  /** Why it stands where it does, in a few words. */
  why: string;
}

/** A task that needs images none of its record sets has yet. */
export function lacksImages(tree: Tree, t: Task, withImages = new Set(tree.list<Media>("media").map((m) => m.recordset))): boolean {
  return NEEDS_IMAGES.has(t.level) && !taskRecordsets(tree, t).sets.some((b) => withImages.has(b.id));
}

export function effectiveState(t: Task, today: string): Task["state"] {
  if (t.state === "parked" && t.parkedUntil && t.parkedUntil <= today) return "open";
  return t.state;
}

/**
 * Every ancestor of the focus with its generation and its line: the focus, each
 * parent and each grandparent are lines of their own; everyone further back
 * belongs to the line of the grandparent they descend through.
 */
export function ancestorLines(tree: Tree, focus: string, max = 50): Map<string, { gen: number; line: string }> {
  const out = new Map([[focus, { gen: 1, line: focus }]]);
  let current = [focus];
  for (let g = 2; g <= max && current.length; g++) {
    const next: string[] = [];
    for (const id of current)
      for (const p of parentsOf(tree, id))
        if (!out.has(p.id)) {
          out.set(p.id, { gen: g, line: g <= 3 ? p.id : out.get(id)!.line });
          next.push(p.id);
        }
    current = next;
  }
  return out;
}

/** The open tasks in the order to work on them, each with the reason. */
export function rankTasks(tree: Tree, tasks: Task[], strategy: Strategy = "balanced"): Ranked[] {
  const today = now().slice(0, 10);
  const open = tasks.filter((t) => ["open", "doing"].includes(effectiveState(t, today)));
  const withImages = new Set(tree.list<Media>("media").map((m) => m.recordset));
  const researches = tree.list<Research>("research");
  const lines = new Map<string, Map<string, { gen: number; line: string }>>();
  const linesOf = (researchId: string | undefined) => {
    const r = researches.find((x) => x.id === researchId) ?? (researches.length === 1 ? researches[0] : undefined);
    if (!r || r.direction !== "ancestors") return undefined;
    if (!lines.has(r.id)) lines.set(r.id, ancestorLines(tree, r.focus));
    return lines.get(r.id);
  };
  /** The nearest ancestor a task is about: its generation and line. */
  const place = (t: Task) => {
    const map = linesOf(t.research);
    const found = [...t.subject, ...subjectPeople(tree, t.subject)].map((s) => map?.get(s)).filter((x): x is { gen: number; line: string } => !!x);
    return found.sort((a, b) => a.gen - b.gen)[0];
  };
  const tasksById = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  const ended = tree
    .list<Session>("session")
    .filter((s) => s.state !== "open" && s.task)
    .sort((a, b) => (b.ended ?? b.updated).localeCompare(a.ended ?? a.updated));
  const recentLines = ended.slice(0, RECENT).map((s) => {
    const t = tasksById.get(s.task!);
    return t ? (place(t)?.line ?? `task:${t.id}`) : undefined;
  });
  const tries = new Map<string, number>();
  for (const s of ended) tries.set(s.task!, (tries.get(s.task!) ?? 0) + 1);

  const rows = open.map((t) => {
    const at = place(t);
    const gen = at?.gen ?? OFF_LINE_GENERATION;
    const line = at?.line ?? `task:${t.id}`;
    const recent = recentLines.filter((l) => l === line).length;
    const tried = tries.get(t.id) ?? 0;
    const intake = t.level === "intake" ? 3 : 0;
    const score =
      strategy === "depth"
        ? 2 * t.priority + intake + 2 * recent - 0.5 * (gen - 1) - 1.5 * tried
        : strategy === "priority"
          ? 0
          : 2 * t.priority + intake - (gen - 1) - 2 * recent - 1.5 * tried;
    const blocked = lacksImages(tree, t, withImages);
    const why = [
      t.state === "doing" ? "in progress" : undefined,
      blocked ? "needs images the user has to download" : undefined,
      `p${t.priority}`,
      t.level === "intake" ? "the user's material" : at ? `generation ${gen}` : "not about an ancestor",
      recent ? `its line had ${recent} of the last ${RECENT} sessions` : undefined,
      tried ? `tried ${tried}×` : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
    return { task: t, why, doing: t.state === "doing" ? 0 : 1, blocked: blocked ? 1 : 0, score, gen };
  });
  return rows
    .sort(
      (a, b) =>
        a.doing - b.doing ||
        // work that can be done now comes before work that waits for the user's download
        a.blocked - b.blocked ||
        (strategy === "priority" ? b.task.priority - a.task.priority || a.gen - b.gen : b.score - a.score) ||
        (LEVEL_ORDER[a.task.level] ?? 9) - (LEVEL_ORDER[b.task.level] ?? 9) ||
        a.task.created.localeCompare(b.task.created),
    )
    .map(({ task, why }) => ({ task, why }));
}
