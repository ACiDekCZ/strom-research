// Work off the lines in the menu (spec 038 K7): Settings → the agent working alone → Work off the lines — when (each
// choice with what it does and how many tasks it decides), lines proposed for branches that grow, the branches and
// tasks with a choice of their own back to the default; What waits — a branch that grows answered: added to a line,
// a line made for it, left as it is, not researched. All through the ordinary commands; 0 changes nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

/**
 * Two lines: the ancestors of Jan Lhoták (G0001: Jan P1, Josef P2, Marie P3, Václav P5) and of Marie (G0002). Josef's
 * sister Anna (P4), her husband Karel (P6), their daughters Žofie (P7, written decomposed) and Жофия (P8): the branch
 * B-P0004.
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
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  await w.ok(["family", "add", "--partner", "P5", "--child", "P2", "--child", "P4"]);
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P6", "--child", "P7", "--child", "P8"]);
  await w.ok(["research", "new", "Předci Marie", "--person", "P3"]);
  return w;
}

const task = (w: World, what: string, about: string[]) =>
  w.ok(["task", "add", what, "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "kniha nalezena", ...about.flatMap((a) => ["--about", a])]);
const offLine = async (w: World) => (await w.ok(["config", "get", "queue.offLine", "--json"])).json.value as string;
const branch = async (w: World) => ((await w.ok(["offline", "list", "--json"])).json.offLine.branches as { id: string; mode: string; own: boolean; line?: string; grows?: true }[]).find((b) => b.id === "B-P0004");
/** Settings → the agent working alone → Work off the lines, then the answers given, then back to the main menu and out. */
const offMenu = (w: World, ...answers: string[]) => w.ok([], { tty: true, answers: ["8", "2", "6", ...answers, "0", "0", "0", "0"] });

test("the menu: work off the lines — when, each choice with what it does and how many tasks; 0 changes nothing", opts, async () => {
  const w = await world();
  await task(w, "Křest Josefa", ["P2"]); // T1, the line's
  await task(w, "Oddavky Anny", ["P4"]); // T2
  await task(w, "Křest Žofie".normalize("NFD"), ["P7"]); // T3
  await task(w, "Křest Жофии", ["P8"]); // T4
  const look = await offMenu(w, "1", "0");
  assert.match(look.out, /Mimo linie: práce na vedlejší větvi/);
  assert.match(look.out, /Práce mimo linie · 3 otevřené úkoly, z toho ve frontě 3\n +1 {2}Kdy: občas, jednou za čas\n +2 {2}Navrhovat linie u rostoucích větví: zapnuto\n +0 {2}Zpět/);
  assert.match(look.out, /1 {2}občas, jednou za čas – jeden úkol mimo linie za 10 sezení, nejbližší linii první; jinak až po práci na liniích · 3 úkoly\n/);
  assert.match(look.out, /2 {2}na konci, až po liniích – úkoly mimo linie až ve chvíli, kdy linie nemají co dělat · 3 úkoly\n/);
  assert.match(look.out, /3 {2}normálně, jako práce linií – úkoly mimo linie podle priority, stejně jako práce linií · 3 úkoly\n/);
  assert.match(look.out, /4 {2}nikdy – úkoly mimo linie se neberou; nic se nesmaže · 3 úkoly\n/);
  // the current one suggested
  assert.match(look.out, /4 {2}nikdy – [^\n]*\n +0 {2}Zpět\nVybrat \[1\]/u);
  assert.equal(await offLine(w), "occasional");
  assert.equal((await w.ok(["config", "get", "queue.offLine", "--json"])).json.source, "default", "0: nothing written");
  // each choice, this computer's (the research has no value of its own)
  for (const [key, mode] of [["2", "last"], ["3", "normal"], ["4", "never"], ["1", "occasional"]] as const) {
    const r = await offMenu(w, "1", key);
    assert.equal(await offLine(w), mode);
    assert.notEqual((await w.ok(["config", "get", "queue.offLine", "--json"])).json.source, "tree");
    if (mode === "never") assert.match(r.out, /Kdy: nikdy/);
  }
  // a research with its own value: the change is for it
  await w.ok(["config", "set", "queue.offLine", "normal", "--for-tree"]);
  await offMenu(w, "1", "2");
  const kept = (await w.ok(["config", "get", "queue.offLine", "--json"])).json;
  assert.deepEqual([kept.value, kept.source], ["last", "tree"]);
  w.cleanup();
});

test("the menu: lines proposed for branches that grow — on and off; with never said it proposes nothing", opts, async () => {
  const w = await world();
  await task(w, "Oddavky Anny", ["P4"]);
  const off = await offMenu(w, "2", "a");
  assert.match(off.out, /Větev mimo linie s 10 otevřenými úkoly nebo 5 lidmi se ukáže v Co čeká/);
  assert.equal((await w.ok(["config", "get", "queue.suggestLines", "--json"])).json.value, "no");
  assert.match((await offMenu(w)).out, /2 {2}Navrhovat linie u rostoucích větví: vypnuto\n/);
  // no: nothing changed
  await offMenu(w, "2", "n");
  assert.equal((await w.ok(["config", "get", "queue.suggestLines", "--json"])).json.value, "no");
  await offMenu(w, "2", "a");
  assert.equal((await w.ok(["config", "get", "queue.suggestLines", "--json"])).json.value, "yes");
  // never: the switch does nothing now, said so
  await w.ok(["config", "set", "queue.offLine", "never", "--for-tree"]);
  const never = await offMenu(w, "2", "n");
  assert.match(never.out, /2 {2}Navrhovat linie u rostoucích větví: zapnuto \(s volbou nikdy se nic nenavrhuje\)/);
  assert.match(never.out, /Práce mimo linie je nastavená na nikdy: nic mimo linie se nebere a žádná linie se nenavrhuje/);
  w.cleanup();
});

test("the menu: branches with a choice of their own and tasks with their own turn, each back to the default", opts, async () => {
  const w = await world();
  await task(w, "Křest Josefa", ["P2"]); // T1
  await task(w, "Oddavky Anny", ["P4"]); // T2
  await task(w, "Křest Жофии", ["P8"]); // T3
  // none of them: the items are not there
  assert.doesNotMatch((await offMenu(w)).out, /Větve s vlastní volbou|Úkoly s ručním pořadím/);
  await w.ok(["offline", "set", "B-P0004", "--mode", "never"]);
  await w.ok(["task", "order", "T1", "--next"]);
  const both = await offMenu(w, "3", "1", "n");
  assert.match(both.out, /3 {2}Větve s vlastní volbou: 1\n +4 {2}Úkoly s ručním pořadím: 1\n/);
  assert.match(both.out, /1 {2}Anna Lhotáková \[P0004\] – nikdy · 2 úkoly\n/);
  assert.match(both.out, /Visí na: Josef Lhoták \[P0002\] – sourozenec/);
  assert.match(both.out, /Vrátit výchozí \(volba stromu: občas, jednou za čas\)\?/);
  assert.equal((await branch(w))!.own, true, "no: nothing changed");
  // yes: back to the tree's choice; the numbers stay — the turns keep 4
  const back = await offMenu(w, "3", "1", "a");
  assert.match(back.out, /✓ Vráceno na výchozí\./);
  assert.match(back.out, /\n +4 {2}Úkoly s ručním pořadím: 1\n +0 {2}Zpět/);
  assert.deepEqual([(await branch(w))!.own, (await branch(w))!.mode], [false, "occasional"]);
  const turn = await offMenu(w, "4", "1", "a");
  assert.match(turn.out, /1 {2}Křest Josefa \[T0001\] – hned\n/);
  assert.match(turn.out, /Vrátit výchozí pořadí fronty\?/);
  assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.queueAt, undefined);
  assert.doesNotMatch((await offMenu(w)).out, /Větve s vlastní volbou|Úkoly s ručním pořadím/);
  w.cleanup();
});

/** A world whose branch B-P0004 grows (two tasks: queue.suggestTasks 2). */
async function grown(): Promise<World> {
  const w = await world();
  await w.ok(["config", "set", "queue.suggestTasks", "2", "--for-tree"]);
  await task(w, "Křest Josefa", ["P2"]); // T1
  await task(w, "Oddavky Anny", ["P4"]); // T2
  await task(w, "Křest Žofie".normalize("NFD"), ["P7"]); // T3
  return w;
}
const written = (w: World) => path.join(w.cwd, "quality", "offline.json");
const answers = (w: World) => JSON.parse(fs.readFileSync(written(w), "utf8")) as { branches: Record<string, { mode: string; line?: string }>; answers: Record<string, { do: string }> };

test("What waits: a branch that grows — its screen, 0 leaves it, left as it is, then added to the nearest line", opts, async () => {
  const w = await grown();
  const look = await w.ok([], { tty: true, answers: ["3", "1", "0", "0", "0"] });
  assert.match(look.out, /Větve mimo linie · 1 +Větev – Anna Lhotáková – roste mimo linie: 2 úkoly, 4 osoby/);
  assert.match(look.out, /B-P0004 · větev/);
  assert.match(look.out, /Visí na: Josef Lhoták \[P0002\] – sourozenec/);
  assert.match(look.out, /Nejbližší linie: Předci Jana/);
  assert.match(look.out, /• Oddavky Anny\n +• Křest Žofie/u);
  assert.match(look.out, /1 {2}Přidat k linii Předci Jana\n +2 {2}Založit linii\n +3 {2}Nechat, jak je\n +4 {2}Nezkoumat\n +0 {2}Zpět/);
  assert.ok(!fs.existsSync(written(w)), "0: nothing written");
  // left as it is: kept with its size, no longer waiting
  const keep = await w.ok([], { tty: true, answers: ["3", "1", "3", "0"] });
  assert.match(keep.out, /✓ Necháno, jak je; linie se znovu navrhne až při dvojnásobné velikosti\./);
  assert.equal(answers(w).answers.P0004!.do, "keep");
  assert.equal((await branch(w))!.grows, undefined);
  // twice the size: proposed again — added to the nearest line
  await task(w, "Křest Жофии", ["P8"]);
  await task(w, "Smrt Anny", ["P4"]);
  assert.equal((await branch(w))!.grows, true);
  const line = await w.ok([], { tty: true, answers: ["3", "1", "1", "0"] });
  assert.match(line.out, /✓ Větev jde s linií Předci Jana\./);
  assert.deepEqual([answers(w).answers.P0004!.do, answers(w).branches.P0004!.mode, answers(w).branches.P0004!.line], ["line", "line", "G0001"]);
  w.cleanup();
});

test("What waits: a branch that grows — not researched; a line made for it through the new direction's wizard", opts, async () => {
  const w = await grown();
  const never = await w.ok([], { tty: true, answers: ["3", "1", "4", "0"] });
  assert.match(never.out, /✓ Větev se nezkoumá: její úkoly čekají, nic se nesmazalo\./);
  assert.equal((await branch(w))!.mode, "never");
  assert.equal(answers(w).answers.P0004!.do, "never");
  w.cleanup();

  const c = await grown();
  // create: the descendants of Anna suggested, the title suggested, nothing more known
  const made = await c.ok([], { tty: true, answers: ["3", "1", "2", "", "", "", "0", "0"] });
  assert.match(made.out, /Co zkoumat\?/);
  assert.match(made.out, /3 {2}Jednu otázku[^\n]*\n +0 {2}Zpět\nVybrat \[2\]/u);
  const r = (await c.ok(["research", "list", "--json"])).json.researches as { id: string; name: string; direction?: string }[];
  assert.equal(r.length, 3);
  const g = r.find((x) => !["G0001", "G0002"].includes(x.id))!;
  assert.match(g.name, /Anna Lhotáková/);
  assert.deepEqual([answers(c).answers.P0004!.do, answers(c).branches.P0004!.line], ["create", g.id]);
  c.cleanup();
});
