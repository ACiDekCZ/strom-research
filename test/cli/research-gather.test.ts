// A line inside a wider one: the wider line's open tasks about its people only move to it — asked of a person, said to
// an agent, moved with --move-tasks or strom research gather, given back exactly with --undo (spec 126 K2.15).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

/**
 * The ancestors of Ondřej (G0001): his father Václav (P0002), his mother Žofie (P0003, written decomposed), Václav's
 * parents Иван (P0004, Cyrillic) and Anežka (P0005). Tasks of G0001, each naming it: about Václav (T0001, moves), about
 * Иван (T0002, moves), about Václav and Ondřej (T0003, Ondřej is outside the line of Václav), about Ondřej (T0004),
 * about Anežka held by a session at work (T0005), about Václav put aside (T0006), about Иван finished (T0007), about
 * nobody (T0008), about Václav waiting for the user (T0009, moves), about Anežka waiting and held by another's open
 * session (T0010).
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Ondřeje", "--new-person", "Ondřej /Lhoták/", "--sex", "M", "--born", "ABT 1900"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]);
  await w.ok(["person", "add", "Žofie /Lhotová/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P0002", "--partner", "P0003", "--child", "P0001"]);
  await w.ok(["person", "add", "Иван /Лхотак/", "--sex", "M"]);
  await w.ok(["person", "add", "Anežka /Lhotová/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P0004", "--partner", "P0005", "--child", "P0002"]);
  const add = async (what: string, about: string[]) => {
    const r = await w.ok(["task", "add", what, "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", ...about.flatMap((a) => ["--about", a]), "--research", "G0001", "--anyway", "--json"]);
    assert.equal(r.json.task.research, "G0001");
    return r.json.task.id as string;
  };
  assert.equal(await add("Křest Václava", ["P0002"]), "T0001");
  assert.equal(await add("Křest Ивана", ["P0004"]), "T0002");
  assert.equal(await add("Oddavky Václava a otec Ondřeje", ["P0002", "P0001"]), "T0003");
  assert.equal(await add("Křest Ondřeje", ["P0001"]), "T0004");
  assert.equal(await add("Křest Anežky", ["P0005"]), "T0005");
  assert.equal(await add("Úmrtí Václava", ["P0002"]), "T0006");
  assert.equal(await add("Úmrtí Ивана", ["P0004"]), "T0007");
  assert.equal(await add("Přehled rodu", []), "T0008");
  assert.equal(await add("Pohřeb Václava", ["P0002"]), "T0009");
  assert.equal(await add("Oddavky Anežky", ["P0005"]), "T0010");
  await w.ok(["task", "park", "T0006", "--reason", "matrika není online"]);
  await w.ok(["task", "done", "T0007", "--result", "nalezeno"]);
  await w.ok(["task", "wait", "T0009", "--on", "Zeptat se rodiny na hrob"]);
  // another agent's open session holds T0010, which waits for the user; this one's T0005 is at work
  const other = { STROM_WORKER: "druhy" };
  await w.ok(["session", "start", "T0010"], { env: other });
  await w.ok(["task", "wait", "T0010", "--on", "Zeptat se rodiny"], { env: other });
  await w.ok(["task", "start", "T0005"]);
  const state = await tasks(w);
  assert.equal(state.get("T0010")!.state, "waiting");
  assert.equal(state.get("T0005")!.state, "doing");
  return w;
}

async function tasks(w: World): Promise<Map<string, { research?: string; state: string }>> {
  const list = (await w.ok(["task", "list", "--state", "all", "--full", "--json"])).json.tasks as { id: string; research?: string; state: string }[];
  return new Map(list.map((t) => [t.id, t]));
}

async function lineOf(w: World, ids: string[]): Promise<(string | undefined)[]> {
  const all = await tasks(w);
  return ids.map((id) => all.get(id)!.research);
}

const MOVABLE = ["T0001", "T0002", "T0009"];
const STAYING = ["T0003", "T0004", "T0005", "T0006", "T0007", "T0008", "T0010"];

function ops(w: World, op: string): { op: string; targets: string[] }[] {
  const dir = path.join(w.cwd, "data", "ops");
  return (fs.readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => f.endsWith(".jsonl"))
    .flatMap((f) => fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter(Boolean))
    .map((l) => JSON.parse(l) as { op: string; targets: string[] })
    .filter((o) => o.op === op);
}

test("a line inside a wider one, no option and no terminal: nothing moves, one line says how many and the command; --json says movable", opts, async () => {
  const w = await world();
  const r = await w.ok(["research", "new", "Předci Václava", "--person", "P0002"]);
  assert.match(r.out, /3 open tasks of G0001 are about this line's people only and stay there; when the user wants them here: strom research gather G0002/);
  assert.deepEqual(await lineOf(w, MOVABLE), ["G0001", "G0001", "G0001"]);
  // one task: said in the singular
  const one = await w.ok(["research", "new", "Předci Ивана", "--person", "P0004"]);
  assert.match(one.out, /1 open task of G0001 is about this line's people only and stays there; when the user wants it here: strom research gather G0003/);
  // as JSON (the bridge and the app later): movable, nothing moved
  const w2 = await world();
  const j = await w2.ok(["research", "new", "Předci Václava", "--person", "P0002", "--json"]);
  assert.deepEqual(j.json.movable, { count: 3, from: ["G0001"] });
  assert.deepEqual(j.json.moved, []);
  // --yes is no person's yes to this: nothing moves either
  const w3 = await world();
  assert.match((await w3.ok(["research", "new", "Předci Václava", "--person", "P0002", "--yes"])).out, /strom research gather G0002/);
  assert.deepEqual(await lineOf(w3, MOVABLE), ["G0001", "G0001", "G0001"]);
  for (const x of [w, w2, w3]) x.cleanup();
});

test("--move-tasks moves only the open and waiting tasks about the new line's people, in one operation; --undo gives them back exactly", opts, async () => {
  const w = await world();
  const r = await w.ok(["research", "new", "Předci Václava", "--person", "P0002", "--move-tasks", "--json"]);
  assert.deepEqual(r.json.movable, { count: 3, from: ["G0001"] });
  assert.deepEqual(r.json.moved, MOVABLE);
  assert.deepEqual(await lineOf(w, MOVABLE), ["G0002", "G0002", "G0002"]);
  assert.deepEqual(await lineOf(w, STAYING), STAYING.map(() => "G0001"));
  const gathered = ops(w, "research.gather");
  assert.equal(gathered.length, 1, "one operation of the history");
  assert.deepEqual(gathered[0]!.targets, ["G0002", "G0001", ...MOVABLE]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  // given back: each to the line it came from, one operation
  const back = await w.ok(["research", "gather", "G0002", "--undo", "--json"]);
  assert.deepEqual(back.json.returned, MOVABLE);
  assert.deepEqual(back.json.to, ["G0001"]);
  assert.deepEqual(await lineOf(w, [...MOVABLE, ...STAYING]), [...MOVABLE, ...STAYING].map(() => "G0001"));
  assert.equal(ops(w, "research.ungather").length, 1);
  assert.match((await w.ok(["research", "gather", "G0002", "--undo"])).out, /nothing to give back/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("--keep-tasks moves nothing and says nothing; strom research gather moves them later, a narrower line again, --undo gives back only what still has the line", opts, async () => {
  const w = await world();
  const r = await w.ok(["research", "new", "Předci Václava", "--person", "P0002", "--keep-tasks"]);
  assert.doesNotMatch(r.out, /gather/);
  assert.deepEqual(await lineOf(w, MOVABLE), ["G0001", "G0001", "G0001"]);
  const g = await w.ok(["research", "gather", "Předci Václava", "--json"]);
  assert.deepEqual(g.json.moved, MOVABLE);
  assert.deepEqual(g.json.from, ["G0001"]);
  assert.match((await w.ok(["research", "gather", "G0002"])).out, /nothing to move/);
  // the line of Иван lies inside both: their tasks about him alone move to it, from each
  await w.ok(["task", "add", "Oddavky Ивана", "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P0004", "--research", "G0001", "--anyway"]);
  const n = await w.ok(["research", "new", "Předci Ивана", "--person", "P0004", "--json"]);
  assert.deepEqual(n.json.movable, { count: 2, from: ["G0001", "G0002"] });
  const moved = await w.ok(["research", "gather", "G0003", "--json"]);
  assert.deepEqual(moved.json.moved, ["T0002", "T0011"]);
  assert.deepEqual(moved.json.from, ["G0001", "G0002"]);
  // G0002's move given back: T0002 has another line now and stays there
  const back = await w.ok(["research", "gather", "G0002", "--undo", "--json"]);
  assert.deepEqual(back.json.returned, ["T0001", "T0009"]);
  assert.deepEqual(await lineOf(w, ["T0001", "T0002", "T0009", "T0011"]), ["G0001", "G0003", "G0001", "G0003"]);
  // and G0003's: each to its own
  assert.deepEqual((await w.ok(["research", "gather", "G0003", "--undo", "--json"])).json.returned, ["T0002", "T0011"]);
  assert.deepEqual(await lineOf(w, ["T0002", "T0011"]), ["G0002", "G0001"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a person at a terminal is asked in the research's language (yes suggested); an agent at a terminal is not asked", opts, async () => {
  const w = await world();
  const yes = await w.ok(["research", "new", "Předci Václava", "--person", "P0002"], { tty: true, answers: [""] });
  assert.match(yes.out, /V linii „Předci Ondřeje“ jsou 3 otevřené úkoly o lidech této linie\. Převést je sem\? \(a\/n\) \[a\]/);
  assert.deepEqual(await lineOf(w, MOVABLE), ["G0002", "G0002", "G0002"]);
  const w2 = await world();
  await w2.ok(["research", "new", "Předci Václava", "--person", "P0002"], { tty: true, answers: ["n"] });
  assert.deepEqual(await lineOf(w2, MOVABLE), ["G0001", "G0001", "G0001"]);
  const w3 = await world();
  const agent = await w3.ok(["research", "new", "Předci Václava", "--person", "P0002"], { tty: true, answers: ["a"], env: { CLAUDECODE: "1" } });
  assert.doesNotMatch(agent.out, /Převést/);
  assert.match(agent.out, /strom research gather G0002/);
  assert.deepEqual(await lineOf(w3, MOVABLE), ["G0001", "G0001", "G0001"]);
  for (const x of [w, w2, w3]) x.cleanup();
});

test("no task to move: nothing asked, nothing said", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Ondřeje", "--new-person", "Ondřej /Lhoták/", "--sex", "M"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]);
  await w.ok(["family", "add", "--partner", "P0002", "--child", "P0001"]);
  const r = await w.ok(["research", "new", "Předci Václava", "--person", "P0002", "--json"], { tty: true, answers: [] });
  assert.equal(r.json.movable, undefined);
  assert.doesNotMatch((await w.ok(["research", "list"])).out, /gather/);
  w.cleanup();
});

test("the menu: a new line inside a wider one asks once in the research's language, and the answer moves the tasks", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Ondřeje", "--new-person", "Ondřej /Lhoták/", "--sex", "M"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]);
  await w.ok(["family", "add", "--partner", "P0002", "--child", "P0001"]);
  await w.ok(["task", "add", "Křest Václava", "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P0002", "--research", "G0001", "--anyway"]);
  // 4 add · 2 new direction · 1 ancestors · 1 someone in the tree · the name · Enter: the title suggested · nothing known ·
  // Enter: yes, move it here · not with the agent now · 0 · 0
  await w.ok([], { tty: true, answers: ["4", "2", "1", "1", "Václav", "", "", "", "n", "0", "0"] });
  const line = (await w.ok(["research", "list", "--json"])).json.researches.find((x: { focus: string }) => x.focus === "P0002");
  assert.ok(line, "the line is there");
  assert.deepEqual(await lineOf(w, ["T0001"]), [line.id]);
  w.cleanup();
});
