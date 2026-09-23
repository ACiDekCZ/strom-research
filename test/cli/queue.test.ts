// The order of the task queue: the nearest ancestors first, the work spread
// over the lines, nothing taken forever — and a strategy for who wants another.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";

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
