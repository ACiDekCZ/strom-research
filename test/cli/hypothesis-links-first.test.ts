// A task to say what the variants of hypotheses would connect (origin hypothesis:links) comes first in the queue: short
// work, and the Strom app shows each variant "not linked yet" until it is done. A new one gets the highest priority the
// queue knows and stands before all the research — in strom task next, the brief, the task of strom run. The open ones
// an older strom made with priority 2 (behind hundreds of others) are raised once after the update — at its first run
// and at the bridge's start — each logged; done, put aside and lowered by the person stay as they are.

import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { rankTasks } from "../../src/core/queue.ts";
import { HYPOTHESIS_LINKS_FIRST, HYPOTHESIS_LINKS_ORIGIN, HYPOTHESIS_LINKS_PRIORITY, raiseHypothesisLinkTasks, settleHypothesisLinks } from "../../src/core/hypolinks.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

/** Jan (P1), his parents Josef (P2) and Marie (P3); Kašpar (P4), Dorota (P5) and Řehoř (P6), nobody's yet. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Novák/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Dvořáková/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]); // F1
  await w.ok(["person", "add", "Kašpar /Lang/", "--sex", "M"]); // P4
  await w.ok(["person", "add", "Dorota /Langová/", "--sex", "F"]); // P5
  await w.ok(["person", "add", "Řehoř /Šimek/", "--sex", "M"]); // P6
  return w;
}

/** Research of the nearest generations at the highest priority: by its score each comes before work about nobody's line. */
async function research(w: World, n: number) {
  for (let i = 0; i < n; i++)
    await w.ok(["task", "add", `Matrika ${i + 1}`, "--level", "locate", "--where", "katalog archivu", "--why", "rodiče", "--done-when", "kniha nalezena", "--about", i % 2 ? "P2" : "P3", "--priority", "5", "--anyway"]);
}

/** Hypotheses whose claims name people in words a link cannot be read from: a task for the agent. */
async function doubtful(w: World, n: number) {
  for (let i = 0; i < n; i++) await w.ok(["hypothesis", "add", `Odkud pocházel Josef ${i + 1}?`, "--about", "P2", "--variant", "A: nic", "--variant", "B: syn P0004 nebo P0006"]);
}

const head = (w: World) => spawnSync("git", ["-C", w.cwd, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const ours = (w: World) => Tree.open(w.cwd, w.env).list<Task>("task").filter((t) => t.origin === HYPOTHESIS_LINKS_ORIGIN);
const order = async (w: World) => (await w.ok(["task", "list", "--json"])).json.tasks.map((t: { id: string }) => t.id);
/** A newer strom's first run: the last version this computer ran an older one. */
function older(w: World) {
  const cfg = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  fs.writeFileSync(cfg, JSON.stringify({ ...readJsonFile(cfg), lastVersion: "1.0.0" }));
}
/** What an older strom left: its tasks at priority 2, no marker of their raise. */
async function asOlderStromLeft(w: World, ids: string[]) {
  for (const id of ids) await w.ok(["task", "edit", id, "--priority", "2"]);
  const t = Tree.open(w.cwd, w.env);
  t.withTreeLock(() => {
    t.updateConfig((c) => void (c.settled = (c.settled ?? []).filter((s) => s !== HYPOTHESIS_LINKS_FIRST)), { op: "config.set", summary: "test" });
    t.commit("test: as an older strom left it");
  });
}

test("a new hypothesis-links task: the highest priority, first in task next, the brief and strom run's choice — before many tasks of the nearest generations", opts, async () => {
  const w = await world();
  await research(w, 12);
  await doubtful(w, 1);
  const done = settleHypothesisLinks(Tree.open(w.cwd, w.env))!;
  assert.equal(done.tasks.length, 1);
  const id = done.tasks[0]!.id;
  const t = ours(w)[0]!;
  assert.equal(t.priority, HYPOTHESIS_LINKS_PRIORITY);
  assert.equal(t.level, "enrich");
  assert.deepEqual(readJsonFile(path.join(w.cwd, "strom.json")).settled, ["hypothesis-links", HYPOTHESIS_LINKS_FIRST]);

  assert.equal((await order(w))[0], id);
  const next = await w.ok(["task", "next", "--json"]);
  assert.equal(next.json.task.id, id);
  assert.match(next.json.why, /^the hypotheses' links first/);
  const brief = await w.ok(["brief"]);
  assert.match(brief.out, new RegExp(`## Task ${id} \\(enrich, priority 5\\)`));
  // strom run's choice: the queue with a story's turn; every strategy
  const tree = Tree.open(w.cwd, w.env);
  for (const strategy of ["balanced", "depth", "priority"] as const) assert.equal(rankTasks(tree, tree.list<Task>("task"), strategy, { storyTurn: true })[0]!.task.id, id, strategy);

  // tried twice and still open: back among the rest (nothing taken forever), its priority as it was
  for (let i = 0; i < 2; i++) {
    await w.ok(["session", "start", id]);
    await w.ok(["session", "close", "--continue", "--summary", "nothing yet", "--next", "go on"]);
  }
  assert.notEqual((await order(w))[0], id);
  w.cleanup();
});

test("after the update: an older strom's open tasks raised once, logged — at the first run; done and lowered stay; a priority the person sets after is theirs", opts, async () => {
  const w = await world();
  await research(w, 6);
  await doubtful(w, 13); // two tasks: ten hypotheses and three
  settleHypothesisLinks(Tree.open(w.cwd, w.env));
  const [a, b] = ours(w).map((t) => t.id) as [string, string];
  // newer hypotheses, the marker of the first settle taken off: a third task for them
  await doubtful(w, 4);
  const t0 = Tree.open(w.cwd, w.env);
  t0.withTreeLock(() => {
    t0.updateConfig((c) => void delete c.settled, { op: "config.set", summary: "test" });
    t0.commit("test: settled again");
  });
  settleHypothesisLinks(Tree.open(w.cwd, w.env));
  const c = ours(w).map((t) => t.id).find((x) => x !== a && x !== b)!;
  await asOlderStromLeft(w, [a, b, c]);
  await w.ok(["task", "done", c, "--result", "nic jasného"]);
  // the person lowered one below what strom gave: stays theirs
  await w.ok(["task", "edit", b, "--priority", "1"]);
  // without the raise: behind the research
  assert.notEqual((await order(w))[0], a);

  older(w);
  await w.ok(["stats"]);
  const after = new Map(ours(w).map((t) => [t.id, t]));
  assert.equal(after.get(a)!.priority, HYPOTHESIS_LINKS_PRIORITY);
  assert.equal(after.get(b)!.priority, 1, "lowered by the person: as it is");
  assert.equal(after.get(c)!.priority, 2, "done: as it is");
  assert.equal(after.get(c)!.state, "done");
  assert.equal((await order(w))[0], a);
  assert.equal((await w.ok(["task", "next", "--json"])).json.task.id, a);
  assert.match((await w.ok(["brief"])).out, new RegExp(`## Task ${a} \\(enrich, priority 5\\)`));
  // logged with the reason, the marker, one commit; the history says it in the research's language
  const tree = Tree.open(w.cwd, w.env);
  const ops = tree.readOps().filter((o) => o.op === "task.edit" && /hypothesis variants come first/.test(o.reason ?? ""));
  assert.deepEqual(ops.map((o) => o.summary), [`${a} priority 2 → 5`]);
  assert.ok(readJsonFile(path.join(w.cwd, "strom.json")).settled.includes(HYPOTHESIS_LINKS_FIRST));
  assert.match(spawnSync("git", ["-C", w.cwd, "log", "-1", "--format=%s"], { encoding: "utf8" }).stdout, new RegExp(`^Tasks to say what the variants of hypotheses would connect first in the queue \\(${a}\\)`));
  assert.equal(spawnSync("git", ["-C", w.cwd, "status", "--porcelain"], { encoding: "utf8" }).stdout, "");

  // once: the person lowers it now, a newer strom again — nothing written
  await w.ok(["task", "edit", a, "--priority", "3"]);
  const at = head(w);
  older(w);
  await w.ok(["stats"]);
  assert.equal(head(w), at);
  assert.equal(raiseHypothesisLinkTasks(Tree.open(w.cwd, w.env)), undefined);
  assert.equal(ours(w).find((t) => t.id === a)!.priority, 3);
  assert.equal((await w.ok(["check"])).code, 0);
  w.cleanup();
});

test("after the update through the bridge's start, once; an archive: nothing raised, nothing written", opts, async () => {
  const w = await world();
  await research(w, 4);
  await doubtful(w, 1);
  settleHypothesisLinks(Tree.open(w.cwd, w.env));
  const [a] = ours(w).map((t) => t.id) as [string];
  await asOlderStromLeft(w, [a]);
  await w.ok(["live", "start", "--json"]);
  try {
    assert.equal(ours(w)[0]!.priority, HYPOTHESIS_LINKS_PRIORITY);
    assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8"), new RegExp(`hypotheses: 1 task to say their variants' links first in the queue \\(${a}\\)`));
  } finally {
    await w.ok(["live", "stop"]);
  }
  const at = head(w);
  await w.ok(["live", "start", "--json"]);
  await w.ok(["live", "stop"]);
  assert.equal(head(w), at);

  // an archive: its tasks put aside — none raised, nothing written, at the first run and at the bridge's start
  const r = await world();
  await doubtful(r, 1);
  settleHypothesisLinks(Tree.open(r.cwd, r.env));
  const [x] = ours(r).map((t) => t.id) as [string];
  await asOlderStromLeft(r, [x]);
  await r.ok(["mode", "archive"], { tty: true });
  const before = head(r);
  older(r);
  await r.ok(["stats"]);
  await r.ok(["live", "start", "--json"]);
  await r.ok(["live", "stop"]);
  assert.equal(head(r), before);
  assert.deepEqual(ours(r).map((t) => [t.priority, t.state, t.heldBy]), [[2, "parked", "archive"]]);
  assert.ok(!(readJsonFile(path.join(r.cwd, "strom.json")).settled ?? []).includes(HYPOTHESIS_LINKS_FIRST));
  // research again: its task back open, raised at the bridge's next start
  await r.ok(["mode", "research"], { tty: true });
  await r.ok(["live", "start", "--json"]);
  await r.ok(["live", "stop"]);
  assert.equal(ours(r)[0]!.priority, HYPOTHESIS_LINKS_PRIORITY);
  w.cleanup();
  r.cleanup();
});
