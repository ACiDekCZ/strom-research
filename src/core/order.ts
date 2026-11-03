// The order of work of the lines of a research (G…): which comes first. A line keeps its place in `order` (1, 2, 3 …);
// a research of an older strom has none — its lines go by priority, highest first, then by when they began. A line
// with a place comes before one without. Paused and finished lines keep their place: resumed, a line is back where it
// was. The queue goes by it (core/queue.ts): a weight for balanced and depth, strict for priority.

import type { Research, Strategy } from "./model.ts";
import { now, type Tree } from "./tree.ts";

/** The lines in the order of work. */
export function workOrder<T extends Pick<Research, "id" | "priority" | "created" | "order">>(lines: T[]): T[] {
  return [...lines].sort((a, b) => {
    const ao = a.order, bo = b.order;
    if (ao !== undefined && bo !== undefined && ao !== bo) return ao - bo;
    if (ao !== undefined && bo === undefined) return -1;
    if (ao === undefined && bo !== undefined) return 1;
    if (ao === undefined && bo === undefined && a.priority !== b.priority) return b.priority - a.priority;
    return a.created === b.created ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.created < b.created ? -1 : 1;
  });
}

/** Each line's place in the order of work, 1 for the first. */
export function orderNumbers(lines: Pick<Research, "id" | "priority" | "created" | "order">[]): Map<string, number> {
  return new Map(workOrder(lines).map((r, i) => [r.id, i + 1]));
}

/** What the order means for the queue: a weight (balanced, depth) or strictly one line after another (priority). */
export function orderMode(strategy: Strategy): "weight" | "strict" {
  return strategy === "priority" ? "strict" : "weight";
}

/**
 * The lines with the order wanted: the given IDs first in their order, the rest after them in their order until now;
 * IDs no line has are ignored.
 */
export function arranged(lines: Research[], ids: string[]): { lines: Research[]; ignored: string[] } {
  const current = workOrder(lines);
  const byId = new Map(current.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const ignored: string[] = [];
  const first: Research[] = [];
  for (const raw of ids) {
    const id = raw.trim().toUpperCase();
    const r = byId.get(id);
    if (!r) {
      if (!ignored.includes(raw)) ignored.push(raw);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    first.push(r);
  }
  return { lines: [...first, ...current.filter((r) => !seen.has(r.id))], ignored };
}

/**
 * Write the order of work: every line whose place changes, in one operation (one commit). The caller holds the tree
 * lock. Returns the IDs in the new order.
 */
export function writeOrder(tree: Tree, ordered: Research[], op: { op: string; summary: string; targets?: string[] }): string[] {
  const t = now();
  const changed = ordered.flatMap((r, i) => (r.order === i + 1 ? [] : [{ ...r, order: i + 1, updated: t }]));
  if (changed.length) tree.putMany(changed, [], { op: op.op, targets: op.targets ?? changed.map((r) => r.id), summary: op.summary });
  return ordered.map((r) => r.id);
}

/** Where a line goes: to a place (1 = first), one up, one down, or first. */
export type Move = { to: number } | { up: true } | { down: true } | { first: true };

/** The IDs in order once the line has moved. */
export function moved(lines: Research[], id: string, move: Move): string[] {
  const ids = workOrder(lines).map((r) => r.id);
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const to = "to" in move ? Math.min(Math.max(1, Math.trunc(move.to)), ids.length) - 1 : "first" in move ? 0 : "up" in move ? Math.max(0, from - 1) : Math.min(ids.length - 1, from + 1);
  ids.splice(from, 1);
  ids.splice(to, 0, id);
  return ids;
}
