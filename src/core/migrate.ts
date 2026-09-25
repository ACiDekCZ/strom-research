// Bringing a tree's data to the schema of this strom. A tree records the schema
// its data follow (strom.json "schema"). What an older strom wrote, a newer one
// reads as it is as long as the schema stays; a change an older strom could not
// read — a new value of a list (a task level, a kind of source), a field that
// becomes required, a field whose meaning changes — raises SCHEMA_VERSION and
// comes with a migration here. The first strom that opens such a tree brings it
// forward, step by step, each step a logged operation in one sealed commit; an
// older strom then refuses the tree and says to update (core/tree.ts), rather
// than misreading it.

import { SCHEMA_VERSION } from "./model.ts";
import { assertIntact } from "./integrity.ts";
import type { Tree } from "./tree.ts";

export interface Migration {
  /** The schema the step brings the data to (the one before is to - 1). */
  to: number;
  /** What changes, in a line (the commit message). */
  what: string;
  /** Rewrite what needs it — through tree.put / tree.updateConfig, so that every change is logged. */
  run(tree: Tree): void;
}

/** The steps from schema 1 on (none yet: 1 is the schema strom 1.0 was published with). */
export const MIGRATIONS: Migration[] = [];

/** Bring the tree to the target schema; returns what was done, one line a step. */
export function migrate(tree: Tree, migrations: Migration[] = MIGRATIONS, target = SCHEMA_VERSION): string[] {
  const from = tree.config.schema ?? 1;
  if (from >= target) return [];
  const steps = migrations.filter((m) => m.to > from && m.to <= target).sort((a, b) => a.to - b.to);
  if (steps.map((m) => m.to).join() !== Array.from({ length: target - from }, (_, i) => from + i + 1).join())
    throw new Error(`no way from schema ${from} to ${target}: a migration is missing`);
  // Never rewrite data that was changed outside strom.
  assertIntact(tree);
  const done: string[] = [];
  for (const m of steps)
    tree.withTreeLock(() => {
      m.run(tree);
      tree.updateConfig((c) => void (c.schema = m.to), { op: "tree.migrate", summary: `schema ${m.to}: ${m.what}` });
      tree.commit(`Data brought to schema ${m.to}: ${m.what}`);
      done.push(`schema ${m.to}: ${m.what}`);
    });
  return done;
}
