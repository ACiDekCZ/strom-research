// The glance of a task returned to the agent again (spec 094 D17): how many images it still waits for, as /status
// knows them (retry.images) — the device says "Try again through the agent · n images"; none known, none said.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { glanceOf } from "../../src/core/glance.ts";

const item = (id: string, retry: Record<string, unknown>) => ({
  id,
  kind: "task",
  section: "archive",
  phase: "todo",
  what: "Snímky matriky Lhota 1850",
  at: "2026-11-25T10:00:00.000Z",
  group: { key: "archive", name: "Archiv", kind: "archive" },
  retry,
  do: ["retry"],
});

test("glance: retry.n — the images a task returned to the agent waits for, only where /status knows a count", { skip: !hasGit }, () => {
  const w = new World();
  try {
    const tree = Tree.create(path.join(w.dir, "Lhotákovi"), "Lhotákovi", "cs", w.env);
    const g = glanceOf(tree, {
      status: { tree: { id: tree.config.id, name: "Lhotákovi" } },
      researches: [],
      waiting: [
        item("T0001", { can: true, says: "Prohlížeč agenta je připraven", images: 12 }),
        item("T0002", { can: false, until: "2026-11-26T10:00:00.000Z", says: "Zkusit znovu zítra", images: 3 }),
        item("T0003", { can: true, says: "Jen z obrazovky" }),
        item("T0004", { can: true, says: "—", images: 0 }),
        item("T0005", { can: true, says: "—", images: "12" }),
      ],
    });
    const retry = Object.fromEntries(g.waiting.items.map((i) => [i.id, i.retry]));
    assert.deepEqual(retry.T0001, { can: true, says: "Prohlížeč agenta je připraven", n: 12 });
    assert.deepEqual(retry.T0002, { can: false, until: "2026-11-26T10:00:00.000Z", says: "Zkusit znovu zítra", n: 3 });
    assert.deepEqual(retry.T0003, { can: true, says: "Jen z obrazovky" }, "no count known: none said");
    assert.equal("n" in retry.T0004!, false, "nothing left: no count");
    assert.equal("n" in retry.T0005!, false, "only a number");
  } finally {
    w.cleanup();
  }
});
