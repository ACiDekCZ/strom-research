// The order of the task queue: the nearest ancestors first, the work spread
// over the lines, nothing taken forever — and a strategy for who wants another.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { rankTasks } from "../../src/core/queue.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

/** Jan (P1), his parents Josef (P2) and Marie (P3), Josef's father Václav (P4). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  await w.ok(["person", "add", "Marie /Dvořáková/", "--sex", "F"]);
  await w.ok(["person", "add", "Václav /Novák/", "--sex", "M"]);
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  await w.ok(["family", "add", "--partner", "P4", "--child", "P2"]);
  return w;
}

const task = (w: World, what: string, about: string, ...more: string[]) =>
  w.ok(["task", "add", what, "--level", "locate", "--where", "katalog archivu", "--why", "rodiče", "--done-when", "kniha nalezena", "--about", about, ...more]);
const order = async (w: World) => (await w.ok(["task", "list", "--json"])).json.tasks.map((t: any) => t.id);
/** A session on the task that records nothing and hands it back. */
async function session(w: World, id: string) {
  await w.ok(["session", "start", id]);
  await w.ok(["session", "close", "--continue", "--summary", "nothing yet", "--next", "go on"]);
}

test("queue: the nearest generation first, and the reason is shown", opts, async () => {
  const w = await world();
  await task(w, "Rodiče Václava", "P4"); // T1, generation 3
  await task(w, "Rodiče Josefa", "P2"); // T2, generation 2
  assert.deepEqual(await order(w), ["T0002", "T0001"]);
  const next = await w.ok(["task", "next"]);
  assert.match(next.out, /first because: p3 · generation 2 \(queue: balanced\)/);
  // the user's priority still counts more than one generation
  await w.ok(["task", "edit", "T1", "--priority", "5"]);
  assert.deepEqual(await order(w), ["T0001", "T0002"]);
  w.cleanup();
});

test("queue: the work spreads over the lines — a line that just had a session waits for the others", opts, async () => {
  const w = await world();
  await task(w, "Rodiče Josefa", "P2"); // T1, the father's line
  await task(w, "Rodiče Marie", "P3"); // T2, the mother's line
  assert.deepEqual(await order(w), ["T0001", "T0002"]);
  await session(w, "T1");
  assert.deepEqual(await order(w), ["T0002", "T0001"], "the mother's line gets its turn");
  const list = (await w.ok(["task", "list", "--json"])).json.tasks;
  assert.equal(list[1].why, "p3 · generation 2 · its line had 1 of the last 4 sessions · tried 1×");
  await session(w, "T2");
  assert.deepEqual(await order(w), ["T0001", "T0002"], "and back");
  w.cleanup();
});

test("queue: the stories come after all the research — in a conversation always; working alone a story's turn after five sessions without one", opts, async () => {
  const w = await world();
  await task(w, "Rodiče Josefa", "P2"); // T1
  await task(w, "Rodiče Marie", "P3"); // T2
  await w.ok(["task", "add", "Napsat vyprávění: Josef Novák", "--level", "narrate", "--priority", "1", "--where", "zapsané údaje", "--why", "rodinná kniha", "--done-when", "strom story set P2", "--about", "P2"]); // T3
  // research that waits for a download still comes before a story
  await w.ok(["recordset", "add", "Oddaní 1880–1890", "--kinds", "marriage"]); // B1, no images
  await w.ok(["task", "add", "Sňatek Josefa", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis nalezen", "--about", "P2", "--priority", "1"]); // T4
  assert.deepEqual((await order(w)).slice(-2), ["T0004", "T0003"], "the story last, after work waiting for images");
  for (const id of ["T1", "T2", "T1", "T2", "T1"]) await session(w, id);
  assert.equal((await order(w)).at(-1), "T0003", "a conversation: the user leads — still last");
  const tree = Tree.open(w.cwd, w.env);
  const alone = rankTasks(tree, tree.list<Task>("task"), "balanced", { storyTurn: true });
  assert.equal(alone[0]!.task.id, "T0003", "working alone: its turn");
  assert.match(alone[0]!.why, /^a story's turn: none in the last 5 sessions · p1/);
  await session(w, "T3");
  const after = Tree.open(w.cwd, w.env);
  assert.equal(rankTasks(after, after.list<Task>("task"), "balanced", { storyTurn: true }).at(-1)!.task.id, "T0003", "written once: back to the research");
  w.cleanup();
});

test("queue: a task tried again and again sinks — deeper work gets its turn", opts, async () => {
  const w = await world();
  await task(w, "Rodiče Josefa", "P2"); // T1, generation 2
  await task(w, "Rodiče Václava", "P4"); // T2, generation 3 (a grandparent: a line of his own)
  await task(w, "Kniha sňatků", "P1", "--level", "link", "--where", "B9 neznámá"); // T3: needs images nobody has — always last
  for (let i = 0; i < 3; i++) await session(w, "T1");
  const ids = await order(w);
  assert.equal(ids[0], "T0002", "three sessions without an end: the next generation first");
  assert.equal(ids.at(-1), "T0003");
  assert.match((await w.ok(["task", "list", "--json"])).json.tasks.at(-1).why, /needs images the user has to download/);
  w.cleanup();
});

test("queue: the user's material first; strategies depth and priority on request", opts, async () => {
  const w = await world();
  await task(w, "Rodiče Josefa", "P2"); // T1
  await task(w, "Rodiče Marie", "P3"); // T2
  await w.ok(["intake", "--text", "Babička vyprávěla, že Marie byla z Týnce."]); // T3 intake
  assert.equal((await order(w))[0], "T0003");
  await w.ok(["task", "done", "T3", "--result", "zapsáno"]);
  await session(w, "T1");
  assert.deepEqual(await order(w), ["T0002", "T0001"]);
  // depth: stay on the line of the last session
  w.env.STROM_QUEUE_STRATEGY = "depth";
  assert.deepEqual(await order(w), ["T0001", "T0002"]);
  assert.match((await w.ok(["task", "next"])).out, /\(queue: depth\)/);
  // priority: strict priority, then generation — nothing else
  w.env.STROM_QUEUE_STRATEGY = "priority";
  await w.ok(["task", "edit", "T2", "--priority", "2"]);
  assert.deepEqual(await order(w), ["T0001", "T0002"]);
  delete w.env.STROM_QUEUE_STRATEGY;
  await w.ok(["config", "set", "queue.strategy", "depth", "--for-tree"]);
  assert.match((await w.ok(["task", "next"])).out, /\(queue: depth\)/);
  assert.equal((await w.run(["config", "set", "queue.strategy", "random"])).code, 2);
  w.cleanup();
});
