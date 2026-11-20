// The kind of a task as the person sees the work (spec 065 K7.4): what the queue is filtered by (strom task list --kind,
// GET /queue?kind=, the Strom app's chips) and counted by (/status queueCounts.kind). Every task is of exactly one kind,
// the first that fits in this order:
// - history — a task of the history of the places (core/pastevents.ts forHistory);
// - story — a story to write, or the sources looked for before it (core/stories.ts forStory);
// - verify — a verification against the originals (spec 065: the sweep's, a bulk one's, the person's "verify" and its
//   search for the record; core/verifyfacts.ts isVerifyTask);
// - places — the identification of the places of the facts (core/placeid.ts);
// - material — the person's material processed (level intake: scans, photos, documents, files of the app);
// - request — a question to an archive or the family (level request);
// - enrich — sources beyond the registers about a person placed (level enrich);
// - records — the records of the registers looked for and read (levels locate and link, a second reading: verify);
// - other — none of these.
// Computed from the task alone, nothing written: an older strom's tasks have their kind too.

import type { Task } from "./model.ts";
import { forHistory } from "./pastevents.ts";
import { forStory } from "./stories.ts";
import { isVerifyTask } from "./verifyfacts.ts";
import { PLACES_IDENTIFY_ORIGIN } from "./placeid.ts";

export const TASK_KINDS = ["verify", "records", "material", "places", "enrich", "request", "story", "history", "other"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** The kind of a task (one of TASK_KINDS). */
export function taskKind(t: Pick<Task, "level" | "origin">): TaskKind {
  if (forHistory(t)) return "history";
  if (forStory(t)) return "story";
  if (isVerifyTask(t)) return "verify";
  if (t.origin === PLACES_IDENTIFY_ORIGIN) return "places";
  switch (t.level) {
    case "intake":
      return "material";
    case "request":
      return "request";
    case "enrich":
      return "enrich";
    case "locate":
    case "link":
    case "verify":
      return "records";
    default:
      return "other";
  }
}

/** A kind as the person or the app names it (any case, spaces around), else undefined. */
export function parseTaskKind(s: string): TaskKind | undefined {
  const k = s.trim().toLowerCase();
  return (TASK_KINDS as readonly string[]).includes(k) ? (k as TaskKind) : undefined;
}

/** How many tasks of each kind (only the kinds that have one). */
export function kindCounts(tasks: Iterable<Pick<Task, "level" | "origin">>): Partial<Record<TaskKind, number>> {
  const out: Partial<Record<TaskKind, number>> = {};
  for (const t of tasks) {
    const k = taskKind(t);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
