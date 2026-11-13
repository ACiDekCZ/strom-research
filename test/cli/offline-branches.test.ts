// Work off the lines, branches (spec 038 K7): a branch is the person off the lines nearest to one, with everyone reached
// only through them; the partner of a person of a line is the line's work; the person's choices on three floors (the
// tree, the branch in quality/offline.json, the task's queueAt); occasional takes one off the lines in queue.offLineShare
// sessions; a branch that grows gets a line proposed (What waits), computed when read.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

/**
 * Two lines: the ancestors of Jan Lhoták (G0001: Jan P1, Josef P2, Marie P3, Václav P5) and of Marie (G0002). Josef's
 * sister Anna (P4), her husband Karel (P6), their daughters Žofie (P7, written decomposed) and Жофия (P8): the branch
 * B-P0004. Josef's second wife Ludmila (P9): the line's work; her other husband Lhotomír (P10): a branch of his own.
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"]); // P4
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P5
  await w.ok(["person", "add", "Karel /Lhotský/", "--sex", "M"]); // P6
  await w.ok(["person", "add", "Žofie /Lhotská/".normalize("NFD"), "--sex", "F"]); // P7
  await w.ok(["person", "add", "Жофия /Лгота/", "--sex", "F"]); // P8
  await w.ok(["person", "add", "Ludmila /Lhotová/", "--sex", "F"]); // P9
  await w.ok(["person", "add", "Lhotomír /Lhota/", "--sex", "M"]); // P10
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  await w.ok(["family", "add", "--partner", "P5", "--child", "P2", "--child", "P4"]);
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P6", "--child", "P7", "--child", "P8"]);
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P9"]);
  await w.ok(["family", "add", "--partner", "P9", "--partner", "P10"]);
  await w.ok(["research", "new", "Předci Marie", "--person", "P3"]);
  return w;
}

const task = (w: World, what: string, about: string[], ...more: string[]) =>
  w.ok(["task", "add", what, "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "kniha nalezena", ...about.flatMap((a) => ["--about", a]), "--json", ...more]);
type Row = { id: string; why: string; offLine?: string; branch?: string; own?: string; reason?: Record<string, unknown>; helps?: { by: string; research?: string } };
const queue = async (w: World, ...more: string[]) => (await w.ok(["task", "list", "--json", ...more])).json.tasks as Row[];
const order = async (w: World) => (await queue(w)).map((t) => t.id);
const offline = async (w: World) => (await w.ok(["offline", "list", "--json"])).json.offLine;

test("branches: an ancestor's sister, her husband and children are one branch; the partner of a line's person is the line's work", opts, async () => {
  const w = await world();
  const line = (await task(w, "Křest Josefa", ["P2"])).json; // T1
  assert.equal(line.task.research, "G0001");
  const anna = (await task(w, "Oddavky Anny", ["P4"])).json; // T2
  assert.equal(anna.branch, "B-P0004");
  assert.equal((await task(w, "Křest Žofie", ["P7"])).json.branch, "B-P0004"); // T3
  assert.equal((await task(w, "Křest Жофии", ["P8"])).json.branch, "B-P0004"); // T4
  // Ludmila, Josef's second wife: the line's work, no branch
  const ludmila = (await task(w, "Původ Ludmily", ["P9"])).json; // T5
  assert.deepEqual(ludmila.helps, { by: "partner", research: "G0001" });
  assert.equal(ludmila.offLine, undefined);
  // her other husband: the partner of a partner is not — a branch of his own, reached through her
  const bohumil = (await task(w, "Původ Lhotomíra", ["P10"])).json; // T6
  assert.equal(bohumil.branch, "B-P0010");
  assert.equal(bohumil.offLine, "occasional");
  // a task in two branches: the one nearer a line (Lhotomír one link from Ludmila; Žofie two from Josef)
  assert.equal((await task(w, "Žofie a Lhotomír", ["P7", "P10"])).json.branch, "B-P0010"); // T7
  const v = await offline(w);
  assert.equal(v.mode, "occasional");
  assert.equal(v.own, false);
  assert.equal(v.share, 10);
  assert.equal(v.tasks, 5);
  const b = v.branches.find((x: { id: string }) => x.id === "B-P0004");
  assert.deepEqual(b.via, { person: "P0002", rel: "sibling" });
  assert.equal(b.nearest, "G0001");
  assert.equal(b.persons, 4);
  assert.equal(b.tasks, 3);
  assert.deepEqual(b.samples.map((s: { id: string }) => s.id), ["T0002", "T0003", "T0004"]);
  assert.equal(b.mode, "occasional");
  assert.equal(b.own, false);
  assert.deepEqual(v.branches.find((x: { id: string }) => x.id === "B-P0010").via, { person: "P0009", rel: "partner" });
  // the queue says why for a program
  const q = await queue(w);
  assert.deepEqual(q.find((t) => t.id === "T0001")!.reason, { kind: "line", research: "G0001" });
  assert.deepEqual(q.find((t) => t.id === "T0005")!.reason, { kind: "helps", research: "G0001", by: "partner" });
  assert.deepEqual(q.find((t) => t.id === "T0002")!.reason, { kind: "off", mode: "occasional", branch: "B-P0004" });
  // the key as typed, the person merged: the same branch
  assert.match((await w.ok(["offline", "show", "b-p4"])).out, /B-P0004/);
  const none = await w.run(["offline", "show", "B-P0002", "--json"]);
  assert.notEqual(none.code, 0, "a person of a line is no branch");
  w.cleanup();
});

test("the branch's choice: never out of the queue (nothing deleted), normal, last, a line, back to the default", opts, async () => {
  const w = await world();
  await task(w, "Křest Josefa", ["P2"]); // T1
  await task(w, "Oddavky Anny", ["P4"], "--priority", "5"); // T2
  await task(w, "Původ Lhotomíra", ["P10"]); // T3: another branch
  await w.ok(["offline", "set", "B-P0004", "--mode", "never"]);
  assert.deepEqual(await order(w), ["T0001", "T0003"]);
  assert.match((await w.ok(["task", "list"])).out, /1 more off the lines are not taken/);
  assert.equal((await w.ok(["task", "show", "T2", "--json"])).json.task.state, "open", "nothing deleted");
  const file = JSON.parse(fs.readFileSync(path.join(w.cwd, "quality", "offline.json"), "utf8"));
  assert.equal(file.branches.P0004.mode, "never");
  // the agent's brief names it
  assert.match((await w.ok(["brief", "T1"])).out, /not researched, the person's choice: the branches B-P0004/);
  // normal: in the queue as any task of no line
  await w.ok(["offline", "set", "B-P0004", "--mode", "normal"]);
  assert.deepEqual(await order(w), ["T0001", "T0002", "T0003"]);
  assert.equal((await queue(w)).find((t) => t.id === "T0002")!.offLine, undefined);
  // last
  await w.ok(["offline", "set", "B-P0004", "--mode", "last"]);
  assert.equal((await queue(w)).find((t) => t.id === "T0002")!.offLine, "last");
  // added to a line: its tasks help that line
  await w.ok(["offline", "set", "B-P0004", "--line", "G0002"]);
  const helped = (await queue(w)).find((t) => t.id === "T0002")!;
  assert.deepEqual(helped.helps, { by: "branch", research: "G0002" });
  assert.equal(helped.branch, "B-P0004");
  assert.deepEqual(helped.reason, { kind: "helps", research: "G0002", by: "branch" });
  assert.deepEqual((await w.ok(["task", "list", "--research", "G0002", "--json"])).json.tasks.map((t: Row) => t.id), ["T0002"]);
  assert.equal((await offline(w)).branches.find((x: { id: string }) => x.id === "B-P0004").mode, "line");
  // back to the tree's
  await w.ok(["offline", "set", "B-P0004", "--default"]);
  assert.equal((await queue(w)).find((t) => t.id === "T0002")!.offLine, "occasional");
  assert.ok(!JSON.parse(fs.readFileSync(path.join(w.cwd, "quality", "offline.json"), "utf8")).branches.P0004);
  // refusals: nothing given, two given, a mode unknown, a line unknown
  assert.notEqual((await w.run(["offline", "set", "B-P0004"])).code, 0);
  assert.notEqual((await w.run(["offline", "set", "B-P0004", "--mode", "never", "--default"])).code, 0);
  assert.notEqual((await w.run(["offline", "set", "B-P0004", "--mode", "sometimes"])).code, 0);
  assert.notEqual((await w.run(["offline", "set", "B-P0004", "--line", "G0042"])).code, 0);
  // the history says it in the research's language; the data check knows the file
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("the task's turn: next before everything once (gone after a session on it), last after everything, default", opts, async () => {
  const w = await world();
  await task(w, "Křest Josefa", ["P2"], "--priority", "5"); // T1
  await task(w, "Křest Marie", ["P3"]); // T2
  await task(w, "Oddavky Anny", ["P4"]); // T3 off the lines
  await w.ok(["offline", "set", "B-P0004", "--mode", "never"]);
  assert.deepEqual(await order(w), ["T0001", "T0002"]);
  // next: also a task of a branch not researched
  const next = (await w.ok(["task", "order", "T3", "--next", "--json"])).json;
  assert.equal(next.own, "next");
  assert.deepEqual(next.reason, { kind: "own", do: "next" });
  assert.equal(next.place, 1);
  await w.ok(["task", "order", "T2", "--next"]);
  assert.deepEqual(await order(w), ["T0002", "T0003", "T0001"], "two next: the last chosen first");
  // a session on it ends: the choice is used up
  await w.ok(["session", "start", "T3"]);
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  assert.equal((await w.ok(["task", "show", "T3", "--json"])).json.task.queueAt, undefined);
  assert.deepEqual(await order(w), ["T0002", "T0001"]);
  // last
  await w.ok(["task", "order", "T2", "--last"]);
  assert.deepEqual(await order(w), ["T0001", "T0002"]);
  assert.equal((await queue(w))[1]!.own, "last");
  await w.ok(["task", "order", "T2", "--default"]);
  assert.equal((await w.ok(["task", "show", "T2", "--json"])).json.task.queueAt, undefined);
  // refused: two at once, a task at work, a task done
  assert.notEqual((await w.run(["task", "order", "T2", "--next", "--last"])).code, 0);
  await w.ok(["session", "start", "T1"]);
  assert.match((await w.run(["task", "order", "T1", "--next"])).err + (await w.run(["task", "order", "T1", "--next"])).out, /in progress/);
  w.cleanup();
});

test("strom plan says why: a task put next by the person is not 'after the lines'; not taken by the branch's choice, the tree's or both", opts, async () => {
  const w = await world();
  await task(w, "Křest Josefa", ["P2"]); // T1
  await task(w, "Oddavky Anny", ["P4"]); // T2 off the lines, B-P0004
  await task(w, "Křest Žofie", ["P7"]); // T3 off the lines, B-P0004
  await task(w, "Původ Lhotomíra", ["P10"]); // T4 off the lines, B-P0010
  await w.ok(["offline", "set", "B-P0004", "--mode", "never"]);
  await w.ok(["task", "order", "T2", "--next"]);
  const plan = (await w.ok(["plan"])).out;
  assert.match(plan, /1\. +Oddavky Anny \(mimo linie: na řadě z volby\)/);
  assert.doesNotMatch(plan, /Oddavky Anny \(mimo linie: až po práci na liniích\)/);
  // the tree takes work off the lines now and then (occasional): only the branch's choice leaves T3 out
  assert.match(plan, /Mimo linie, nebere se: 1 \(volba u větve\)/);
  assert.doesNotMatch(plan, /nastavení queue\.offLine/);
  const json = (await w.ok(["plan", "--json"])).json;
  assert.deepEqual(json.tasks[0], { ...json.tasks[0], id: "T0002", offLine: "never", own: "next" });
  assert.deepEqual([json.offLineNever, json.offLineNeverBy], [1, { tree: 0, branch: 1 }]);
  // the tree's never too: both causes with their counts
  await w.ok(["config", "set", "queue.offLine", "never", "--for-tree"]);
  assert.match((await w.ok(["plan"])).out, /Mimo linie, nebere se: 2 \(nastavení queue\.offLine: 1, volba u větve: 1\)/);
  // at the end by the person's choice; the tree's never alone, said as before
  await w.ok(["offline", "set", "B-P0004", "--default"]);
  await w.ok(["task", "order", "T2", "--last"]);
  const last = (await w.ok(["plan"])).out;
  assert.match(last, /Oddavky Anny \(mimo linie: na konci z volby\)/);
  assert.match(last, /Mimo linie, nebere se: 2 \(nastavení queue\.offLine\)/);
  // in English: the same causes
  await w.ok(["lang", "en"]);
  assert.match((await w.ok(["plan"])).out, /Oddavky Anny \(off the lines: at the end, by choice\)/);
  w.cleanup();
});

test("occasional: one off the lines after share − 1 sessions of the lines, the nearest first; at once when the lines have nothing", opts, async () => {
  const w = await world();
  await w.ok(["config", "set", "queue.offLineShare", "4", "--for-tree"]);
  await task(w, "Křest Josefa", ["P2"]); // T1
  await task(w, "Křest Žofie", ["P7"], "--priority", "5"); // T2: two links from the line
  await task(w, "Oddavky Anny", ["P4"], "--priority", "1"); // T3: one link — the nearest
  const sessions = async (n: number) => {
    for (let i = 0; i < n; i++) {
      await w.ok(["session", "start", "T1"]);
      await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
    }
  };
  await sessions(2);
  assert.deepEqual(await order(w), ["T0001", "T0002", "T0003"]);
  await sessions(1);
  const q = await queue(w);
  assert.deepEqual(q.map((t) => t.id), ["T0003", "T0001", "T0002"], "the nearest to a line forward, whatever its priority");
  assert.match(q[0]!.why, /its turn, 3 sessions since the last one off them/);
  // a session on it: the lines again
  await w.ok(["session", "start", "T3"]);
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  assert.deepEqual((await order(w))[0], "T0001");
  // the lines with nothing to do: off the lines at once
  await w.ok(["task", "drop", "T1", "--reason", "nalezeno jinde"]);
  assert.deepEqual(await order(w), ["T0002", "T0003"]);
  // every strategy the same
  await sessions(0);
  await task(w, "Křest Marie", ["P3"]); // T4
  for (const strategy of ["balanced", "depth", "priority"]) {
    await w.ok(["config", "set", "queue.strategy", strategy, "--for-tree"]);
    assert.deepEqual((await order(w))[0], "T0004", strategy);
  }
  w.cleanup();
});

test("the default: unset is occasional; last set explicitly stays — for the tree or on this computer", opts, async () => {
  const w = await world();
  assert.equal((await w.ok(["config", "get", "queue.offLine", "--json"])).json.value, "occasional");
  await w.ok(["config", "set", "queue.offLine", "last", "--for-tree"]);
  assert.equal((await offline(w)).mode, "last");
  assert.equal((await offline(w)).own, true);
  await w.ok(["config", "unset", "queue.offLine", "--for-tree"]);
  await w.ok(["config", "set", "queue.offLine", "last"]);
  assert.equal((await offline(w)).mode, "last");
  await w.ok(["config", "unset", "queue.offLine"]);
  assert.equal((await offline(w)).mode, "occasional");
  assert.notEqual((await w.run(["config", "set", "queue.offLineShare", "1", "--for-tree"])).code, 0, "a whole number from 2");
  w.cleanup();
});

test("a branch that grows: a line proposed (What waits), again only at twice the size; off with suggestLines no or never", opts, async () => {
  const w = await world();
  await w.ok(["config", "set", "queue.suggestTasks", "2", "--for-tree"]);
  await w.ok(["config", "set", "queue.suggestPersons", "9", "--for-tree"]);
  await task(w, "Křest Josefa", ["P2"]);
  await task(w, "Oddavky Anny", ["P4"]);
  const grows = async () => (await offline(w)).branches.find((x: { id: string }) => x.id === "B-P0004")?.grows === true;
  const waits = async () => ((await w.ok(["status", "--json"])).json.offLine?.grows ?? []) as string[];
  assert.equal(await grows(), false);
  await task(w, "Křest Žofie", ["P7"]);
  assert.equal(await grows(), true);
  assert.deepEqual(await waits(), ["B-P0004"]);
  const said = (await w.ok(["status"])).out;
  assert.match(said, /Mimo linie: 2 úkoly – občas/);
  assert.match(said, /Větev – Anna Lhotáková – roste mimo linie: 2 úkoly, 4 osoby.*strom offline answer B-P0004/);
  assert.equal((await w.ok(["status", "--json"])).json.offLine.mode, "occasional");
  // nothing written by reading
  assert.ok(!fs.existsSync(path.join(w.cwd, "quality", "offline.json")));
  // the answer is the user's own: an agent is refused, nothing written
  const agent = await w.run(["offline", "answer", "B-P0004", "keep", "--json"], { env: { AI_AGENT: "1" } });
  assert.notEqual(agent.code, 0);
  assert.ok(!fs.existsSync(path.join(w.cwd, "quality", "offline.json")));
  await w.ok(["offline", "answer", "B-P0004", "keep"]);
  assert.equal(await grows(), false);
  await task(w, "Křest Жофии", ["P8"]);
  assert.equal(await grows(), false, "3 < 2 × 2");
  await task(w, "Smrt Anny", ["P4"]);
  assert.equal(await grows(), true, "twice the size at the answer");
  await w.ok(["config", "set", "queue.suggestLines", "no", "--for-tree"]);
  assert.equal(await grows(), false);
  await w.ok(["config", "unset", "queue.suggestLines", "--for-tree"]);
  await w.ok(["config", "set", "queue.offLine", "never", "--for-tree"]);
  assert.equal(await grows(), false);
  await w.ok(["config", "unset", "queue.offLine", "--for-tree"]);
  // answered line: added to the nearest line; never: not researched
  await w.ok(["offline", "answer", "B-P0004", "line"]);
  assert.equal((await offline(w)).branches.find((x: { id: string }) => x.id === "B-P0004").line, "G0001");
  await w.ok(["offline", "answer", "B-P0004", "never"]);
  assert.equal((await offline(w)).branches.find((x: { id: string }) => x.id === "B-P0004").mode, "never");
  assert.notEqual((await w.run(["offline", "answer", "B-P0004", "maybe"])).code, 0);
  w.cleanup();
});

test("a line for a branch: research new --branch adds the branch to the new line and answers the proposal", opts, async () => {
  const w = await world();
  await task(w, "Oddavky Anny", ["P4"]);
  await task(w, "Původ Karla", ["P6"]);
  const r = (await w.ok(["research", "new", "Předci Karla", "--person", "P6", "--branch", "B-P0004", "--json"])).json;
  assert.equal(r.branch, "B-P0004");
  const file = JSON.parse(fs.readFileSync(path.join(w.cwd, "quality", "offline.json"), "utf8"));
  assert.deepEqual([file.branches.P0004.mode, file.branches.P0004.line, file.answers.P0004.do], ["line", r.research.id, "create"]);
  // Anna is now the partner of the new line's person: her task is that line's work
  assert.deepEqual((await queue(w)).find((t) => t.id === "T0001")!.helps, { by: "partner", research: r.research.id });
  assert.notEqual((await w.run(["research", "new", "Předci Václava", "--person", "P5", "--branch", "B-P0005"])).code, 0, "no such branch: nothing created");
  assert.equal((await w.ok(["research", "list", "--json"])).json.researches.length, 3);
  w.cleanup();
});
