// An archive: a research nobody researches. The user enters the data in the
// Strom app; the research keeps them (each sync a commit — the history of the
// tree), their sources and a backup (strom pack). No agent works on it: its
// tasks are put aside as they come, a conversation or a run is refused, and
// what the app sends is written as it is (the user's word wins, what the app no
// longer has is withdrawn with the reason). Switched by the person alone
// (strom mode), there and back: nothing is deleted, the tasks put aside come
// back to the queue.

import type { Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { UsageError } from "./errors.ts";
import { phrase } from "./phrases.ts";

export type Mode = "archive" | "research";

export const MODES = ["research", "archive"] as const;

export function modeOf(tree: { config: { mode?: string } }): Mode {
  return tree.config.mode === "archive" ? "archive" : "research";
}

export function isArchive(tree: { config: { mode?: string } }): boolean {
  return modeOf(tree) === "archive";
}

/** A task coming into an archive waits put aside (records.create): no agent takes it. */
export function heldInArchive(tree: Tree, task: Record<string, unknown>): Record<string, unknown> {
  if (!isArchive(tree) || task.state !== "open") return task;
  return { ...task, state: "parked", heldBy: "archive", parkedReason: phrase(tree.lang, "archive.held") };
}

/** No agent works on an archive: said, with what the person does to change it. */
export function refuseInArchive(tree: Tree, what: string): void {
  if (!isArchive(tree)) return;
  throw new UsageError(`this research is an archive: no agent works on it (${what})`, {
    hint: "the user switches work with an agent on: strom mode research (the menu: Settings → research with an agent, or only an archive)",
  });
}

/**
 * The research becomes an archive or a research again: its config, and its tasks — open (and begun, nobody at them)
 * ones put aside; back, those an archive put aside in the queue again. The caller holds the lock and commits.
 */
export function switchMode(tree: Tree, to: Mode): { tasks: string[] } {
  tree.updateConfig(
    (c) => {
      if (to === "archive") c.mode = "archive";
      else delete c.mode;
    },
    { op: "config.set", summary: to === "archive" ? "the research is an archive" : "the research works with an agent again" },
  );
  if (to === "archive") return { tasks: holdForArchive(tree) };
  const touched: string[] = [];
  for (const t of tree.list<Task>("task")) {
    if (t.state === "parked" && t.heldBy === "archive") {
      const { heldBy: _h, parkedReason: _r, heldFrom, ...rest } = t;
      const back = heldFrom ?? "open";
      tree.put({ ...rest, state: back, updated: new Date().toISOString() } as Task, {
        op: "task.wake",
        targets: [t.id],
        summary: back === "waiting" ? `${t.id} waits for the user again: work with an agent again` : `${t.id} back in the queue: work with an agent again`,
        reason: "research switched on",
      });
      touched.push(t.id);
    }
  }
  return { tasks: touched };
}

/**
 * An archive's tasks put aside — open, begun (nobody at them) and those that wait for the user (an archive asks the
 * person nothing; found 2026-10-03: "4 wait for you" in an archive, its waiting tasks never put aside before rc.17).
 * Each logged with the reason; back to what it was when research is switched on. The caller holds the lock.
 */
export function holdForArchive(tree: Tree): string[] {
  const touched: string[] = [];
  for (const t of tree.list<Task>("task")) {
    if (t.state !== "open" && t.state !== "doing" && t.state !== "waiting") continue;
    const held: Task = {
      ...t,
      state: "parked",
      heldBy: "archive",
      ...(t.state === "waiting" ? { heldFrom: "waiting" as const } : {}),
      parkedReason: phrase(tree.lang, "archive.held"),
      updated: new Date().toISOString(),
    };
    tree.put(held, { op: "task.park", targets: [t.id], summary: `${t.id} put aside: the research is an archive`, reason: "the research is an archive" });
    touched.push(t.id);
  }
  return touched;
}

/** An archive with tasks not put aside (switched by an older strom, or written to since): they are, committed. */
export function settleArchive(tree: Tree): string[] {
  if (!isArchive(tree) || tree.dryRun) return [];
  const loose = (t: Task) => t.state === "open" || t.state === "doing" || t.state === "waiting";
  if (!tree.list<Task>("task").some(loose)) return [];
  let held: string[] = [];
  tree.withTreeLock(() => {
    held = holdForArchive(tree);
    if (held.length) tree.commit(`Tasks put aside: the research is an archive (${held.join(", ")})`);
  });
  return held;
}
