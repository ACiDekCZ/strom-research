// The history of the tree's houses by itself (spec 030 part 2): the setting houses (off unless set, turned on by the
// person alone), the rule that raises a house's task (a direct ancestor, two generations or thirty years, older than a
// hundred years, its municipality a place record) — a municipality's skeleton before its houses, neighbouring houses of
// one family together, at most HOUSE_AUTO_OPEN groups, behind the family research in the queue; off: held, nothing
// written, back once on; strom house request (on top, whatever the setting; done: again; the person's alone);
// a municipality's skeleton (--town, summary) and its day done; today's holders refused; material raising a task while
// on; the brief of a house's task. Synthetic data only (made-up names), with diacritics, decomposed input and a
// municipality in Cyrillic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { houseAuto, houseBrief, houseEstimate, HOUSE_AUTO_OPEN } from "../../src/core/houseauto.ts";
import { forHouse, housesHeldCount, houseWork, townOfTask } from "../../src/core/houses.ts";
import type { House, Task } from "../../src/core/model.ts";
import { validateRecord } from "../../src/core/validate.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const AGENT = { env: { CLAUDECODE: "1" } };
const UNATTENDED = { env: { AI_AGENT: "1", STROM_NONINTERACTIVE: "1" } };

const open = (w: World) => Tree.open(w.cwd, w.env);
const houseTasks = (w: World) => open(w).list<Task>("task").filter((t) => forHouse(t) && !t.retracted);
const record = (w: World, id: string) => open(w).get<House>(id)!;
/** The house record (A…) of a municipality and number. */
function houseId(w: World, place: string, number: string): string {
  const h = open(w).list<House>("house").find((x) => !x.retracted && !x.town && x.place === place && x.house === number);
  assert.ok(h, `no record of ${place} ${number}`);
  return h.id;
}

/**
 * The Lhotáks, the Prouzals and the Kapradinovás in three municipalities — Lhota (L0001), Dolní Lhota (L0002) and
 * Лхотка (L0003) — and Horní Lhotka, no place record:
 *   Lhota 9 (P1, P2: two generations), Lhota 14 (P4, 1840–1880), both Lhoták: one task;
 *   Lhota 12 (P2 1895–1899, one generation): none; Lhota 20 (P5, an uncle only): none;
 *   Dolní Lhota 3 (P6, P7: two generations), Dolní Lhota 8 (P9 Kapradinová, 1850–1900): another family;
 *   Dolní Lhota 7 (P1 1950–1990): younger than a hundred years, none;
 *   Лхотка 1 (P7, P8) and Лхотка 2 (P8 1850–1890), both Prouzal: one task;
 *   Horní Lhotka 5 (P2, P4): no municipality's record, none.
 */
async function village(w: World) {
  await w.withTree("Lhotákovi");
  await w.ok(["place", "add", "Lhota", "--kind", "village"]); // L0001
  await w.ok(["place", "add", "Dolní Lhota".normalize("NFD"), "--kind", "village"]); // L0002
  await w.ok(["place", "add", "Лхотка", "--kind", "village"]); // L0003
  const person = async (name: string) => (await w.ok(["person", "add", name, "--json"])).json.person.id as string;
  const p1 = await person("Kapradin /Lhoták/");
  const p2 = await person("Mlhoslav /Lhoták/");
  const p3 = await person("Rosenka /Lhotáková/");
  const p4 = await person("Ozubec /Lhoták/");
  const p5 = await person("Bodlák /Lhoták/");
  const p6 = await person("Vratislava /Prouzalová/");
  const p7 = await person("Hromoslav /Prouzal/");
  const p8 = await person("Bohumil /Prouzal/");
  const p9 = await person("Bezinka /Kapradinová/");
  await w.ok(["family", "add", "--partner", p2, "--partner", p6, "--child", p1]);
  await w.ok(["family", "add", "--partner", p4, "--partner", p3, "--child", p2, "--child", p5]);
  await w.ok(["family", "add", "--partner", p7, "--partner", p9, "--child", p6]);
  await w.ok(["family", "add", "--partner", p8, "--child", p7]);
  await w.ok(["config", "set", "main.person", p1, "--for-tree"]);
  const fact = async (who: string, kind: string, date: string, place: string, house: string) => w.ok(["event", "add", who, kind, "--date", date, "--place", place, "--house", house]);
  await fact(p1, "BIRT", "1900", "Lhota", "9");
  await fact(p2, "BIRT", "1870", "Lhota", "9");
  await fact(p2, "RESI", "1895", "Lhota", "12");
  await fact(p2, "RESI", "1899", "Lhota", "12");
  await fact(p4, "BIRT", "1840", "Lhota", "14");
  await fact(p4, "DEAT", "1880", "Lhota", "14");
  await fact(p5, "BIRT", "1860", "Lhota", "20");
  await fact(p5, "DEAT", "1900", "Lhota", "20");
  await fact(p6, "BIRT", "1875", "Dolní Lhota", "3");
  await fact(p7, "RESI", "1845", "Dolní Lhota".normalize("NFD"), "3");
  await fact(p9, "BIRT", "1850", "Dolní Lhota", "8");
  await fact(p9, "DEAT", "1900", "Dolní Lhota", "8");
  await fact(p1, "RESI", "1950", "Dolní Lhota", "7");
  await fact(p1, "RESI", "1990", "Dolní Lhota", "7");
  await fact(p7, "BIRT", "1815", "Лхотка", "1");
  await fact(p8, "BIRT", "1790", "Лхотка", "1");
  await fact(p8, "RESI", "1850", "Лхотка", "2");
  await fact(p8, "DEAT", "1890", "Лхотка", "2");
  await fact(p2, "RESI", "1880", "Horní Lhotka", "5");
  await fact(p4, "RESI", "1850", "Horní Lhotka", "5");
  return { p1, p2, p4, p5, p6, p7, p8, p9 };
}

test("houseAuto: the houses of the direct ancestors, two generations or thirty years, older than a hundred years, in a municipality's record", opts, async () => {
  const w = new World();
  try {
    await village(w);
    const auto = houseAuto(open(w));
    assert.deepEqual(
      auto.houses.map((h) => h.key),
      ["лхотка|1", "dolni lhota|3", "lhota|9", "lhota|14", "dolni lhota|8", "лхотка|2"],
      JSON.stringify(auto.houses.map((h) => [h.key, h.ancestors, h.from])),
    );
    assert.deepEqual(auto.towns, ["L0003", "L0002", "L0001"]);
    // before any session of houses: the minutes by default, never a price
    const est = houseEstimate(open(w), auto);
    assert.deepEqual([est.houses, est.towns, est.minutes, est.usd, est.measured], [6, 3, 6 * 30 + 3 * 20, undefined, false]);
    assert.deepEqual(est.perHouse, { minutes: 30 });
  } finally {
    w.cleanup();
  }
});

test("houses on: the person's alone; a municipality's skeleton and its houses' tasks, neighbours together, at most three groups, after the family research; off held with nothing written; on again back", opts, async () => {
  const w = new World();
  try {
    const p = await village(w);
    assert.equal((await w.ok(["config", "get", "houses", "--json"])).json.value, "off");
    assert.deepEqual(houseTasks(w), []);
    // the agent never turns it on
    const agentOn = await w.run(["config", "set", "houses", "on", "--for-tree"], UNATTENDED);
    assert.equal(agentOn.code, 4, agentOn.out + agentOn.err);
    // a task of the family research first
    const fam = (await w.ok(["task", "add", "Křest Kapradina Lhotáka", "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "nalezeno", "--about", p.p1, "--json"])).json.task.id as string;
    // the person turns it on: raised at once, in the same commit
    await w.ok(["config", "set", "houses", "on", "--for-tree"], { tty: true });
    const raised = houseTasks(w);
    assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }), "", "raised in the setting's commit");
    const towns = raised.filter((t) => houseWork(t) === "town");
    const houses = raised.filter((t) => houseWork(t) === "house");
    assert.deepEqual(towns.map(townOfTask).sort(), ["L0001", "L0002", "L0003"]);
    assert.equal(houses.length, HOUSE_AUTO_OPEN);
    const lhota9 = houseId(w, "L0001", "9");
    const lhota14 = houseId(w, "L0001", "14");
    const grouped = houses.find((t) => t.origin === `house:${lhota9}`)!;
    assert.deepEqual(grouped.houses, [lhota14], "the neighbouring house of the same family with it");
    assert.ok(!houses.some((t) => t.origin === `house:${houseId(w, "L0003", "2")}`), "Лхотка 2 goes with Лхотка 1");
    assert.equal(open(w).list<House>("house").filter((h) => !h.town && h.place === "L0002" && h.house === "8").length, 0, "the fourth group waits");
    assert.ok(raised.every((t) => !t.asked));
    for (const t of raised) assert.deepEqual(validateRecord(t), [], t.id);
    for (const h of open(w).list<House>("house")) assert.deepEqual(validateRecord(h), [], h.id);
    // the queue: the family research first, a municipality's skeleton before its houses
    const queue = ((await w.ok(["task", "list", "--json"])).json.tasks as { id: string }[]).map((t) => t.id);
    assert.equal(queue[0], fam, queue.join(" "));
    for (const h of houses) {
      const town = towns.find((t) => townOfTask(t) === record(w, h.origin.slice("house:".length)).place)!;
      assert.ok(queue.indexOf(town.id) < queue.indexOf(h.id), `${town.id} before ${h.id}: ${queue.join(" ")}`);
    }
    // the list of houses: queued, a municipality's record never a house
    const rows = (await w.ok(["house", "list", "--json"])).json.houses as { key: string; state: string; task?: string }[];
    assert.equal(rows.find((r) => r.key === "lhota|14")!.state, "queued");
    assert.equal(rows.find((r) => r.key === "lhota|14")!.task, grouped.id, "found through the task's houses");
    assert.ok(!rows.some((r) => r.key.endsWith("|")));

    // off: held — out of the queue and its counts, nothing written of the tasks
    await w.ok(["config", "set", "houses", "off", "--for-tree"], UNATTENDED);
    const before = JSON.stringify(houseTasks(w));
    const list = (await w.ok(["task", "list", "--json"])).json;
    assert.deepEqual((list.tasks as { id: string }[]).map((t) => t.id), [fam]);
    assert.equal(list.housesHeld, raised.length);
    assert.equal(housesHeldCount(open(w), false), raised.length);
    assert.match((await w.ok(["task", "list"])).out, /6 tasks of the houses held/u);
    assert.equal(((await w.ok(["task", "list", "--kind", "house", "--json"])).json.tasks as unknown[]).length, raised.length);
    assert.equal(((await w.ok(["house", "list", "--json"])).json.houses as { key: string; state: string }[]).find((r) => r.key === "lhota|9")!.state, "held");
    assert.equal(JSON.stringify(houseTasks(w)), before, "nothing written");
    // a task held, started by its ID: the agent hears why
    const started = await w.ok(["session", "start", grouped.id], AGENT);
    assert.match(started.out, /history of the houses is off/u);
    await w.ok(["session", "close", "--continue", "--summary", "drženo", "--next", "jiný úkol"], AGENT);

    // on again: back, nothing new raised
    await w.ok(["config", "set", "houses", "on", "--for-tree"], { tty: true });
    assert.equal(houseTasks(w).length, raised.length);
    assert.ok(((await w.ok(["task", "list", "--json"])).json.tasks as { id: string }[]).some((t) => t.id === grouped.id));

    // a municipality's skeleton closed done in its session: its record keeps the day
    const lhota = towns.find((t) => townOfTask(t) === "L0001")!;
    await w.ok(["session", "start", lhota.id], AGENT);
    await w.ok(["house", "add", "summary", "--town", "L0001", "--text", "fara Lhota, panství Lhota"], AGENT);
    await w.ok(["session", "close", "--done", "kostra zapsána", "--next", "domy obce"], AGENT);
    const skeleton = open(w).list<House>("house").find((h) => h.town && h.place === "L0001")!;
    assert.match(skeleton.done ?? "", /^\d{4}-\d{2}-\d{2}$/u);
    assert.equal(skeleton.text, "fara Lhota, panství Lhota");
    assert.equal(execFileSync("git", ["status", "--porcelain", "data"], { cwd: w.cwd, encoding: "utf8" }), "", "written in its commit");
  } finally {
    w.cleanup();
  }
});

test("house request: the person's alone, on top whatever the setting, its municipality's skeleton before it; on: moved; done: again; not a house of nobody of the tree", opts, async () => {
  const w = new World();
  try {
    const p = await village(w);
    const fam = (await w.ok(["task", "add", "Sňatek Mlhoslava", "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "nalezeno", "--about", p.p2, "--json"])).json.task.id as string;
    // an agent: refused; no terminal and no --yes: needs input
    const agent = await w.run(["house", "request", "L0002", "8"], UNATTENDED);
    assert.equal(agent.code, 4, agent.out + agent.err);
    const script = await w.run(["house", "request", "L0002", "8", "--json"]);
    assert.equal(script.code, 3, script.out + script.err);
    assert.match(script.out, /strom house request L0002 8 --yes/u);
    // in a terminal: the question with what it takes; no
    const no = await w.ok(["house", "request", "L0002", "8"], { tty: true, answers: ["n"] });
    assert.match(no.out, /Asi 50 minut/u);
    assert.deepEqual(houseTasks(w), []);
    // off: the house's task and its municipality's skeleton, on top
    const asked = (await w.ok(["house", "request", "L0002", "8", "--yes", "--json"])).json;
    assert.equal(asked.made, true);
    assert.equal(asked.again, false);
    const queue = ((await w.ok(["task", "list", "--json"])).json.tasks as { id: string }[]).map((t) => t.id);
    assert.deepEqual(queue, [asked.town, asked.task, fam]);
    const t = open(w).get<Task>(asked.task)!;
    assert.ok(t.asked);
    // never held while off
    assert.equal(housesHeldCount(open(w), false), 0);
    // shown asked, first in the queue
    assert.match((await w.ok(["house", "show", asked.house])).out, /vyžádáno, 2\. ve frontě/u);
    // with neighbours: only of the same municipality
    const other = await w.run(["house", "request", "L0002", "3", "--with", "L0001 9", "--yes"]);
    assert.notEqual(other.code, 0);
    assert.match(other.out + other.err, /another municipality/u);
    // a house nobody of the tree lived in: refused
    await w.ok(["house", "add", "L0001", "99"]);
    const nobody = await w.run(["house", "request", "L0001", "99", "--yes", "--json"]);
    assert.notEqual(nobody.code, 0);
    assert.match(nobody.out + nobody.err, /house\.unknown|nobody of the tree/u);

    // on: a task raised by itself moved on top, asked from now on
    await w.ok(["config", "set", "houses", "on", "--for-tree"], { tty: true });
    const auto = houseTasks(w).find((t) => houseWork(t) === "house" && !t.asked)!;
    const moved = (await w.ok(["house", "request", auto.subject[0]!, "--yes", "--json"])).json;
    assert.equal(moved.made, false);
    assert.equal(moved.task, auto.id);
    assert.ok(open(w).get<Task>(auto.id)!.asked);
    // its municipality's skeleton, not done yet, before it
    assert.deepEqual(((await w.ok(["task", "list", "--json"])).json.tasks as { id: string }[]).slice(0, 2).map((t) => t.id), [moved.town, auto.id]);

    // done: looked for again, a new task
    await w.ok(["task", "done", asked.task, "--result", "dům prošel"], AGENT);
    const again = (await w.ok(["house", "request", asked.house, "--yes", "--json"])).json;
    assert.equal(again.again, true);
    assert.notEqual(again.task, asked.task);
    // a municipality's skeleton done: its day kept, never raised again
    await w.ok(["task", "done", asked.town, "--result", "kostra hotova"], AGENT);
    assert.ok(open(w).list<House>("house").find((h) => h.town && h.place === "L0002")!.done);
    assert.match((await w.ok(["house", "show", "--town", "L0002"])).out, /hotovo \d{4}-\d{2}-\d{2}/u);
    const third = (await w.ok(["house", "request", asked.house, "--yes", "--json"])).json;
    assert.equal(third.town, undefined, "the skeleton done: no task of it");
  } finally {
    w.cleanup();
  }
});

test("a municipality's skeleton (--town, summary), today's holders refused, material raises a task while on, the brief of a house's task", opts, async () => {
  const w = new World();
  try {
    const p = await village(w);
    // the skeleton: its summary and its items; never a house
    await w.ok(["house", "add", "summary", "--town", "Dolní Lhota".normalize("NFD"), "--text", "panství Lhota, fara Dolní Lhota".normalize("NFD")]);
    await w.ok(["house", "add", "passed", "--town", "L0002", "--what", "Pozemková kniha 1850–1880", "--found", "no"]);
    await w.ok(["house", "add", "manual", "--town", "L0002", "--what", "Mapa stabilního katastru", "--url", "https://mapy.example.org/l2"]);
    const town = (await w.ok(["house", "show", "--town", "L0002", "--json"])).json.town;
    assert.equal(town.text, "panství Lhota, fara Dolní Lhota");
    assert.deepEqual([town.passed.length, town.manual.length], [1, 1]);
    assert.ok(!((await w.ok(["house", "list", "--json"])).json.houses as { id?: string }[]).some((r) => r.id === town.id));
    assert.match((await w.run(["house", "add", "summary", "--text", "x"])).err, /missing --town/u);
    assert.match((await w.run(["house", "add", "holder", "--town", "L0002", "--name", "x"])).err, /--town|unknown option/u);
    // a house shows its municipality's skeleton
    const d3 = (await w.ok(["house", "show", "L0002", "3", "--json"])).json.house;
    assert.equal(d3.town.text, "panství Lhota, fara Dolní Lhota");

    // today's holders and residents: never written
    const year = new Date().getFullYear();
    const today = await w.run(["house", "add", "holder", "L0001", "9", "--name", "Bezruk Prouzal", "--since", String(year - 20)]);
    assert.notEqual(today.code, 0);
    assert.match(today.err, /today's holders and residents/u);
    assert.match(today.err, /--until/u);
    const lodger = await w.run(["house", "add", "resident", "L0001", "9", "--name", "Vřesomil Prouzal", "--role", "tenant", "--since", `${year - 5}-03`]);
    assert.notEqual(lodger.code, 0);
    await w.ok(["house", "add", "holder", "L0001", "9", "--name", "Kapradin Lhoták", "--person", p.p1, "--since", "1930"]);
    await w.ok(["house", "add", "holder", "L0001", "9", "--name", "Hvozdík Prouzal", "--since", String(year - 50), "--until", String(year - 40)]);
    await w.ok(["house", "add", "holder", "L0001", "9", "--name", "Mlhoslav Lhoták", "--since", "1895"]);

    // material while off: kept, no task
    const lhota9 = houseId(w, "L0001", "9");
    const off = (await w.ok(["house", "add", "material", lhota9, "--memory", "Dům měl doškovou střechu.", "--json"])).json;
    assert.equal(off.task, undefined);
    assert.deepEqual(houseTasks(w), []);
    // on: a house of the tree with no task gets one (asked: never held)
    await w.ok(["config", "set", "houses", "on", "--for-tree"], { tty: true });
    const d8 = (await w.ok(["house", "add", "material", "L0002", "8", "--memory", "Studna na dvoře.", "--json"])).json;
    assert.ok(d8.task, JSON.stringify(d8));
    assert.ok(open(w).get<Task>(d8.task)!.asked);
    // a house with a task alive: none more
    const twice = (await w.ok(["house", "add", "material", "L0002", "8", "--memory", "Ještě jedna vzpomínka.", "--json"])).json;
    assert.equal(twice.task, undefined);

    // the brief of a house's task: the people of the tree with their facts, what was gone through, the skeleton
    await w.ok(["house", "add", "passed", lhota9, "--what", "Matrika Lhota 1860–1900", "--found", "yes"]);
    const t = houseTasks(w).find((x) => x.origin === `house:${lhota9}`)!;
    const brief = houseBrief(open(w), t)!;
    assert.match(brief, new RegExp(`${p.p2} Mlhoslav Lhoták: E\\d+ BIRT 1870`, "u"));
    assert.match(brief, /gone through already \(never again\): Matrika Lhota 1860–1900/u);
    assert.match(brief, /neighbouring houses of one family/u);
    const started = await w.ok(["session", "start", t.id], AGENT);
    assert.match(started.out, /gone through already \(never again\)/u);
  } finally {
    w.cleanup();
  }
});

test("the menu's settings: the history of the houses with its tasks held, what it would take said before it is on, switched by the person; none in an archive; the briefs of a municipality's and a house's task with their method", opts, async () => {
  const w = new World();
  try {
    await village(w);
    const pick = (text: string) => text.split("\n").find((l) => /Historie domů v tomto výzkumu/u.test(l))?.match(/^\s*(\d+)/u)?.[1];
    const look = await w.run([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.match(look.out, /Historie domů v tomto výzkumu: vypnuto/u, look.out);
    const n = pick(look.out);
    assert.ok(n, look.out);
    // the line beside census records: nine items at most
    const what = look.out.slice(look.out.indexOf("Co nastavit?"));
    const parts = what.slice(0, what.indexOf("Vybrat")).split("\n").filter((l) => /^\s+\d\s{2}/u.test(l));
    assert.ok(parts.length <= 10, look.out);
    // before it is on: what it is, how many houses in how many municipalities, the minutes (no price measured); Enter: nothing
    const no = await w.run([], { tty: true, answers: ["8", "1", n!, "", "0", "0"] });
    assert.match(no.out, /\d+ dom\S* v \d+ obcích, celkem asi \d+ minut práce agenta\./u, no.out);
    assert.doesNotMatch(no.out, /Taková sezení/u);
    assert.equal((await w.ok(["config", "get", "houses", "--json"])).json.value, "off");
    assert.deepEqual(houseTasks(w), []);
    // the person's yes: on for this research, its tasks raised
    await w.run([], { tty: true, answers: ["8", "1", n!, "y", "0", "0"] });
    assert.equal((await w.ok(["config", "get", "houses", "--json"])).json.value, "on");
    const raised = houseTasks(w);
    assert.ok(raised.length > 0);
    // the briefs: a municipality's skeleton, a house's research — each its own part of the method
    const town = raised.find((t) => houseWork(t) === "town")!;
    const house = raised.find((t) => houseWork(t) === "house")!;
    const tb = (await w.ok(["brief", town.id], AGENT)).out;
    assert.match(tb, /## A municipality's skeleton/u);
    assert.doesNotMatch(tb, /## A house \(|taking over the research/u);
    const hb = (await w.ok(["brief", house.id], AGENT)).out;
    assert.match(hb, /## A house \(/u);
    assert.match(hb, /never goes out/u);
    assert.match(hb, /## The house A\d+:/u);
    assert.doesNotMatch(hb, /## A municipality's skeleton \(once/u);
    // off: held, said with their number; the line says so
    const off = await w.run([], { tty: true, answers: ["8", "1", n!, "y", "0", "0"] });
    const held = housesHeldCount(open(w), false);
    assert.ok(held > 0);
    assert.match(off.out, new RegExp(`Odloženo: ${held} úkol\\S* domů\\. Po zapnutí se vrátí\\.`, "u"), off.out);
    assert.equal(open(w).config.houses, "off");
    const again = await w.run([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.match(again.out, new RegExp(`Historie domů v tomto výzkumu: vypnuto, odložen\\S* ${held} úkol\\S* domů`, "u"), again.out);
    // an archive: nothing of it
    await w.ok(["mode", "archive"], { tty: true });
    const archive = await w.run([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.doesNotMatch(archive.out, /Historie domů/u);
  } finally {
    w.cleanup();
  }
});
