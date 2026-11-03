// The order of work of the research's lines (strom research order|move), a line changed (strom research edit, its
// effect on the tasks), a line never made twice (directions.exists), the queue by the order: a weight for balanced and
// depth, strictly one line after another for priority. Any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { rankTasks } from "../../src/core/queue.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const commits = (w: World) => Number(execFileSync("git", ["-C", w.cwd, "rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim());

/** Žofie Lhotáková (P0001) and her father Jan (P0002); Václav Lhoták (P0003) of another family; a question in Cyrillic. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Žofie /Lhotáková/", "--sex", "F", "--born", "1890"]); // P0001
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1860"]); // P0002
  await w.ok(["family", "add", "--partner", "P0002", "--child", "P0001"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1870"]); // P0003
  // a task about Jan before any line: none named on it — it belongs to the line its people are in
  await w.ok(["task", "add", "Křest Jana Lhotáka", "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P0002"]); // T0001
  await w.ok(["research", "new", "Předci Žofie", "--person", "P0001"]); // G0001
  await w.ok(["research", "new", "Předci Václava", "--person", "P0003"]); // G0002
  await w.ok(["research", "new", "Кто была Žofie?", "--person", "P0001", "--direction", "question", "--question", "Кто была Žofie Lhotáková?"]); // G0003
  return w;
}

const listed = async (w: World) => ((await w.ok(["research", "list", "--json"])).json.researches as { id: string; order: number }[]).map((r) => [r.id, r.order]);

test("the order of work: a new line last; order with lines left out and unknown IDs (one commit); move up, down, first, to; list, show and status in it", opts, async () => {
  const w = await world();
  try {
    assert.deepEqual(await listed(w), [["G0001", 1], ["G0002", 2], ["G0003", 3]]);
    const before = commits(w);
    const o = await w.ok(["research", "order", "g0003", "G0009", "--json"]);
    assert.deepEqual(o.json.order, ["G0003", "G0001", "G0002"]);
    assert.deepEqual(o.json.ignored, ["G0009"]);
    assert.equal(o.json.changed, true);
    assert.equal(commits(w), before + 1, "the whole order in one commit");
    assert.deepEqual(await listed(w), [["G0003", 1], ["G0001", 2], ["G0002", 3]]);
    // the same order again: nothing written
    const same = await w.ok(["research", "order", "G0003", "G0001", "G0002", "--json"]);
    assert.equal(same.json.changed, false);
    assert.equal(commits(w), before + 1);

    assert.deepEqual((await w.ok(["research", "move", "G0002", "--first", "--json"])).json.order, ["G0002", "G0003", "G0001"]);
    assert.deepEqual((await w.ok(["research", "move", "G0001", "--up", "--json"])).json.order, ["G0002", "G0001", "G0003"]);
    assert.deepEqual((await w.ok(["research", "move", "G0002", "--down", "--json"])).json.order, ["G0001", "G0002", "G0003"]);
    assert.deepEqual((await w.ok(["research", "move", "Кто была", "--to", "1", "--json"])).json.order, ["G0003", "G0001", "G0002"], "by part of the name, any script");
    for (const bad of [["G0001"], ["G0001", "--up", "--down"], ["G0001", "--to", "0"]]) {
      const r = await w.run(["research", "move", ...bad]);
      assert.notEqual(r.code, 0, bad.join(" "));
    }

    // a paused line keeps its place
    await w.ok(["research", "pause", "G0001"]);
    assert.deepEqual(await listed(w), [["G0003", 1], ["G0001", 2], ["G0002", 3]]);
    const text = (await w.ok(["research", "list"])).out;
    assert.match(text, /^1\. +G0003 +Кто была Žofie\?/mu);
    assert.match((await w.ok(["research", "show", "G0002"])).out, /3\. of 3 in the order of work/);
    assert.equal((await w.ok(["research", "show", "G0002", "--json"])).json.research.order, 3);
    const status = await w.ok(["status", "--json"]);
    assert.deepEqual(status.json.researches.map((r: { id: string; order: number }) => [r.id, r.order]), [["G0003", 1], ["G0001", 2], ["G0002", 3]]);
    assert.match((await w.ok(["status"])).out, /1\. +G0003/);
    // a new line goes last
    await w.ok(["person", "add", "Lhoťan /Lhoták/", "--sex", "M"]); // P0004
    assert.equal((await w.ok(["research", "new", "Předci Lhoťana", "--person", "P0004", "--json"])).json.research.order, 4);
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("a line never twice: the same person and kind, a question the same question (accents, case, decomposed) — in any state; another question is another line", opts, async () => {
  const w = await world();
  try {
    const twice = await w.run(["research", "new", "Znovu", "--person", "P0001", "--json"]);
    assert.notEqual(twice.code, 0);
    assert.equal(twice.json?.code, "directions.exists", twice.out + twice.err);
    assert.deepEqual(twice.json.existing, { id: "G0001", name: "Předci Žofie", state: "active" });
    // in the research's language for a person
    assert.match((await w.run(["research", "new", "Znovu", "--person", "P0001"])).err, /linie „Předci Žofie“ už je/);
    await w.ok(["research", "done", "G0003"]);
    const q = await w.run(["research", "new", "Jinak", "--person", "P0001", "--direction", "question", "--question", "  кто была žofie lhotáková?  ".normalize("NFD"), "--json"]);
    assert.equal(q.json?.code, "directions.exists", q.out + q.err);
    assert.deepEqual(q.json.existing, { id: "G0003", name: "Кто была Žofie?", state: "done" });
    await w.ok(["research", "new", "Kde žila?", "--person", "P0001", "--direction", "question", "--question", "Kde žila Žofie?"]);
    // a person research (strom review) is not one of them
    assert.equal((await w.ok(["research", "list", "--json"])).json.researches.length, 4);
  } finally {
    w.cleanup();
  }
});

test("research edit: a name (decomposed: kept composed), a question, limits narrowed and widened — the tasks beyond wait outside the line, nothing deleted; refused what does not fit", opts, async () => {
  const w = await world();
  try {
    const named = await w.ok(["research", "edit", "G0001", "--name", "Předci Žofie Lhotákové".normalize("NFD"), "--json"]);
    assert.equal(named.json.research.name, "Předci Žofie Lhotákové");
    assert.equal(named.json.research.order, 1);
    assert.equal(named.json.changed, true);
    assert.equal(named.json.effect, undefined, "no effect without a limit moved");
    const again = await w.ok(["research", "edit", "G0001", "--name", "Předci Žofie Lhotákové", "--json"]);
    assert.equal(again.json.changed, false);

    const T = Tree.open(w.cwd, w.env);
    assert.equal(T.get<Task>("T0001")!.research, undefined, "the task names no line of its own");
    // narrowed to Žofie alone: Jan's task beyond it
    const narrow = await w.ok(["research", "edit", "G0001", "--generations", "1", "--json"]);
    assert.deepEqual(narrow.json.research.limits, { generations: 1 });
    assert.equal(narrow.json.effect.outside, 1);
    assert.equal(narrow.json.effect.back, undefined);
    assert.equal(narrow.json.effect.said, "1 úkol je teď za limitem linie: čeká mimo ni, nic se nesmaže.");
    assert.equal((await w.ok(["task", "list", "--state", "all", "--json"])).json.tasks.length, 1, "nothing deleted");
    // widened: back
    const wide = await w.ok(["research", "edit", "G0001", "--generations", "none", "--before", "1700", "--json"]);
    assert.deepEqual(wide.json.research.limits, { before: 1700 });
    assert.deepEqual([wide.json.effect.outside, wide.json.effect.back], [0, 1]);
    assert.match(wide.json.effect.said, /1 úkol se vrátil do linie\./);
    assert.equal((await w.ok(["research", "edit", "G0001", "--before", "none", "--json"])).json.research.limits, undefined);

    // the question of a question line
    const q = await w.ok(["research", "edit", "G0003", "--question", "Где жила Žofie?", "--json"]);
    assert.equal(q.json.research.question, "Где жила Žofie?");
    // refused: a question of another kind, a reason of an active line, nothing to change, an empty name, a bad limit
    for (const bad of [["G0001", "--question", "Kdo?"], ["G0001", "--reason", "čeká"], ["G0001"], ["G0001", "--name", "  "], ["G0001", "--generations", "0"], ["G0001", "--before", "dávno"]]) {
      const r = await w.run(["research", "edit", ...bad]);
      assert.notEqual(r.code, 0, bad.join(" "));
    }
    // a paused line: why it waits, kept as a note
    await w.ok(["research", "pause", "G0002"]);
    await w.ok(["research", "edit", "G0002", "--reason", "rodina chce počkat"]);
    assert.equal((await w.ok(["research", "show", "G0002", "--json"])).json.research.notes.at(-1).text, "paused: rodina chce počkat");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("the queue by the order of work: balanced weighs the earlier line (the first +2), priority takes strictly the first line's tasks first; the why says the line's place", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["research", "new", "Předci Žofie", "--new-person", "Žofie /Lhotáková/", "--sex", "F", "--born", "1890"]); // G0001, P0001
    await w.ok(["research", "new", "Předci Václava", "--new-person", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]); // G0002, P0002
    const add = (what: string, about: string, research: string, priority: string) =>
      w.ok(["task", "add", what, "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", about, "--research", research, "--priority", priority]);
    await add("Křest Žofie", "P0001", "G0001", "5"); // T0001
    await add("Křest Václava", "P0002", "G0002", "3"); // T0002
    const first = (strategy: "balanced" | "depth" | "priority") => {
      const tree = Tree.open(w.cwd, w.env);
      return rankTasks(tree, tree.list<Task>("task"), strategy).map((r) => [r.task.id, r.why]);
    };
    // Václav's line first
    await w.ok(["research", "order", "G0002"]);
    const strict = first("priority");
    assert.deepEqual(strict.map((r) => r[0]), ["T0002", "T0001"], "strictly the first line's task first, whatever its priority");
    assert.match(strict[0]![1]!, /line 1 of 2/);
    assert.match(strict[1]![1]!, /line 2 of 2/);
    // a weight: +2 for the first line does not outweigh priority 5 against 3 (10 against 6 + 2)
    assert.deepEqual(first("balanced").map((r) => r[0]), ["T0001", "T0002"]);
    // the same priority: the weight decides
    await w.ok(["task", "edit", "T0001", "--priority", "3"]);
    assert.deepEqual(first("balanced").map((r) => r[0]), ["T0002", "T0001"]);
    assert.deepEqual(first("depth").map((r) => r[0]), ["T0002", "T0001"]);
    await w.ok(["research", "move", "G0001", "--first"]);
    assert.deepEqual(first("balanced").map((r) => r[0]), ["T0001", "T0002"]);
    // a paused line is out of the order the queue counts: one line, no place said
    await w.ok(["research", "pause", "G0002"]);
    assert.doesNotMatch(first("balanced")[0]![1]!, /line \d of/);
  } finally {
    w.cleanup();
  }
});

test("an archive: no line is written — edit, order, move, pause refused (code archive)", opts, async () => {
  const w = await world();
  try {
    await w.ok(["mode", "archive"], { tty: true });
    for (const args of [["research", "edit", "G0001", "--name", "Jinak"], ["research", "order", "G0002"], ["research", "move", "G0002", "--first"], ["research", "pause", "G0001"]]) {
      const r = await w.run([...args, "--json"]);
      assert.notEqual(r.code, 0, args.join(" "));
      assert.equal(r.json?.code, "archive", args.join(" "));
    }
  } finally {
    w.cleanup();
  }
});

test("the menu: the directions numbered in the order of work; one moved up, one renamed, a limit set and taken away", opts, async () => {
  const w = await world();
  try {
    // 4 add to the research · 5 the directions · 2 the second · 3 up · 0 back · 0 the end
    const up = await w.ok([], { tty: true, answers: ["4", "5", "2", "3", "0", "0"] });
    assert.match(up.out, /1 {2}Předci Žofie – běží · úkoly: 1\n +2 {2}Předci Václava/);
    assert.match(up.out, /„Předci Václava“ je teď 1\. z 3 v pořadí práce\./);
    assert.deepEqual(await listed(w), [["G0002", 1], ["G0001", 2], ["G0003", 3]]);
    // 6 edit · 1 the name (decomposed, kept composed)
    const renamed = await w.ok([], { tty: true, answers: ["4", "5", "2", "6", "1", "Žofiini předci".normalize("NFD"), "0", "0"] });
    assert.match(renamed.out, /„Žofiini předci“ je upravená\./);
    assert.equal((await w.ok(["research", "show", "G0001", "--json"])).json.research.name, "Žofiini předci");
    // 6 edit · 3 generations · 1 a number: Jan's task goes outside, said; then no limit: back
    const narrow = await w.ok([], { tty: true, answers: ["4", "5", "2", "6", "3", "1", "1", "0", "0"] });
    assert.match(narrow.out, /1 úkol je teď za limitem linie/);
    const wide = await w.ok([], { tty: true, answers: ["4", "5", "2", "6", "3", "2", "0", "0"] });
    assert.match(wide.out, /1 úkol se vrátil do linie\./);
    assert.equal((await w.ok(["research", "show", "G0001", "--json"])).json.research.limits, undefined);
  } finally {
    w.cleanup();
  }
});
