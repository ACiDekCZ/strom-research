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
import { forHouse, freeLicence, housesHeldCount, housesOfTask as housesOfTaskIds, houseWork, townOfTask } from "../../src/core/houses.ts";
import { regionsOf, sourcesFor } from "../../src/core/housesources.ts";
import type { House, Place, Task } from "../../src/core/model.ts";
import { validateRecord } from "../../src/core/validate.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const AGENT = { env: { CLAUDECODE: "1" } };
const UNATTENDED = { env: { AI_AGENT: "1", STROM_NONINTERACTIVE: "1" } };

const open = (w: World) => Tree.open(w.cwd, w.env);
/**
 * What an agent writes before it closes a house's research or a skeleton done (spec 145 T5, T1): the searches of its
 * list (three, so strom sees it gone through), the one line of what was gone through, and of a house its short look and
 * its look check (none: no more automatically).
 */
async function goneThrough(w: World, ref: string[], env = AGENT) {
  for (const q of ["adresní místo", "pomístní jména", "ortofoto"]) await w.ok(["search", "add", q, "--method", "web", "--result", "negative"], env);
  await w.ok(["house", "add", "passed", ...ref, "--checklist", "--what", "prošlo: adresní místo, pomístní jména, ortofoto"], env);
  if (ref[0] === "--town") return;
  await w.ok(["house", "add", "look", ref[0]!, "--text", "přízemní chalupa", "--certainty", "guess"], env);
  await w.ok(["house", "add", "look-check", ref[0]!, "--next", "none", "--text", "obrázek domu nikde, indikační skica jen ručně"], env);
}
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
    await goneThrough(w, ["--town", "L0001"]);
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
    await goneThrough(w, [asked.house]);
    await w.ok(["task", "done", asked.task, "--result", "dům prošel"], AGENT);
    const again = (await w.ok(["house", "request", asked.house, "--yes", "--json"])).json;
    assert.equal(again.again, true);
    assert.notEqual(again.task, asked.task);
    // a municipality's skeleton done: its day kept, never raised again
    await goneThrough(w, ["--town", "L0002"]);
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

    // today's holders and residents: never written (fixed years, open within the last 100 years for decades to come)
    const today = await w.run(["house", "add", "holder", "L0001", "9", "--name", "Bezruk Prouzal", "--since", "2010"]);
    assert.notEqual(today.code, 0);
    assert.match(today.err, /today's holders and residents/u);
    assert.match(today.err, /--until/u);
    const lodger = await w.run(["house", "add", "resident", "L0001", "9", "--name", "Vřesomil Prouzal", "--role", "tenant", "--since", "2020-03"]);
    assert.notEqual(lodger.code, 0);
    await w.ok(["house", "add", "holder", "L0001", "9", "--name", "Kapradin Lhoták", "--person", p.p1, "--since", "1930"]);
    await w.ok(["house", "add", "holder", "L0001", "9", "--name", "Hvozdík Prouzal", "--since", "1975", "--until", "1985"]);
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
    const pick = (text: string) => text.split("\n").find((l) => /Historie domů v tomto výzkumu/u.test(l))?.match(/^\s*\[(\d+)\]/u)?.[1];
    const look = await w.run([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.match(look.out, /\[\d+\] {2}Historie domů v tomto výzkumu {2,}vypnuto\n/u, look.out);
    const n = pick(look.out);
    assert.ok(n, look.out);
    // the line beside census records: nine items at most
    const what = look.out.slice(look.out.indexOf("Co nastavit?"));
    const parts = what.slice(0, what.indexOf("\nVolba (")).split("\n").filter((l) => /^\s+\[\w+\]\s{2}/u.test(l));
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
    // on: also the look of the houses (spec 145 T1), on by default — switched off for this research by the person
    const lookOff = await w.run([], { tty: true, answers: ["8", "1", n!, "1", "y", "0", "0"] });
    assert.match(lookOff.out, /I podoba domů: zapnuto/u, lookOff.out);
    assert.equal((await w.ok(["config", "get", "houses.look", "--json"])).json.value, "off");
    const shown = await w.run([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.match(shown.out, /Historie domů v tomto výzkumu {2,}zapnuto, bez podoby domů/u, shown.out);
    await w.run([], { tty: true, answers: ["8", "1", n!, "1", "y", "0", "0"] });
    assert.equal((await w.ok(["config", "get", "houses.look", "--json"])).json.value, "on");
    // off: held, said with their number; the line says so
    const off = await w.run([], { tty: true, answers: ["8", "1", n!, "2", "y", "0", "0"] });
    const held = housesHeldCount(open(w), false);
    assert.ok(held > 0);
    assert.match(off.out, new RegExp(`Odloženo: ${held} úkol\\S* domů\\. Po zapnutí se vrátí\\.`, "u"), off.out);
    assert.equal(open(w).config.houses, "off");
    const again = await w.run([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.match(again.out, new RegExp(`\\[\\d+\\] {2}Historie domů v tomto výzkumu {2,}vypnuto, odložen\\S* ${held} úkol\\S* domů`, "u"), again.out);
    // an archive: nothing of it
    await w.ok(["mode", "archive"], { tty: true });
    const archive = await w.run([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.doesNotMatch(archive.out, /Historie domů/u);
  } finally {
    w.cleanup();
  }
});

test("a house's task (spec 145 T5): its method first in its brief with its list of sources, none of the people's research; done only once the list is gone through", opts, async () => {
  const w = new World();
  try {
    await village(w);
    await w.ok(["config", "set", "houses", "on", "--for-tree"], { tty: true });
    const lhota9 = houseId(w, "L0001", "9");
    const lhota14 = houseId(w, "L0001", "14");
    const t = houseTasks(w).find((x) => x.origin === `house:${lhota9}`)!;
    const brief = (await w.ok(["brief", t.id], AGENT)).out;
    const at = (s: string) => brief.indexOf(s);
    assert.ok(at("## Task") >= 0 && at("## Task") < at("# Method: the history of a house"), brief);
    assert.ok(at("# Method: the history of a house") < at(`## The house ${lhota9}`), brief);
    assert.ok(at(`## The house ${lhota9}`) < at("## Commands for this task"), brief);
    assert.match(brief, /## Sources to go through \(the list is yours, never the house's\)/u);
    assert.match(brief, /\*\*No noise\.\*\*/u);
    assert.match(brief, /house add look-check/u);
    assert.match(brief, /no new tasks of the house's list/u);
    assert.doesNotMatch(brief, /## People concerned|# Method: recording|# Method: reading|Stay within the task|new questions → strom task add/u);

    // closed by its agent with nothing of the list: refused, what is missing said; nothing written
    await w.ok(["session", "start", t.id], AGENT);
    const early = await w.run(["session", "close", "--done", "dům prošel", "--next", "další dům"], AGENT);
    assert.notEqual(early.code, 0);
    assert.match(early.out + early.err, /not gone through/u);
    assert.match(early.out + early.err, new RegExp(`${lhota9}: the one line of the list of sources gone through`, "u"));
    assert.match(early.out + early.err, new RegExp(`${lhota14}: its short look`, "u"));
    assert.match(early.out + early.err, /the look check/u);
    assert.match(early.out + early.err, /0 searches and pages in this task's sessions/u);
    assert.equal(open(w).get<Task>(t.id)!.state, "doing");
    // the list gone through, each house its look and its check: done; none: what is not known of its look, no task
    await goneThrough(w, [lhota9]);
    await goneThrough(w, [lhota14]);
    await w.ok(["session", "close", "--done", "dům prošel", "--next", "další dům"], AGENT);
    assert.equal(open(w).get<Task>(t.id)!.state, "done");
    const h = record(w, lhota9);
    const line = h.passed.find((x) => x.checklist)!;
    assert.equal(line.what, "prošlo: adresní místo, pomístní jména, ortofoto");
    assert.ok(validateRecord(h).length === 0, JSON.stringify(validateRecord(h)));
    assert.equal(h.unknown.find((u) => u.about === "look")?.text, "podoba: víc automaticky nejde – obrázek domu nikde, indikační skica jen ručně");
    assert.ok(!houseTasks(w).some((x) => houseWork(x) === "look"));
  } finally {
    w.cleanup();
  }
});

test("the look of a house (spec 145 T1): its task only for material, a picture or a source; material given after the research; the chain's order whatever is moved to the top; off: no check, no task", opts, async () => {
  const w = new World();
  try {
    await village(w);
    await w.ok(["config", "set", "houses", "on", "--for-tree"], { tty: true });
    const lhota9 = houseId(w, "L0001", "9");
    const lhota14 = houseId(w, "L0001", "14");
    const town = houseTasks(w).find((x) => houseWork(x) === "town" && townOfTask(x) === "L0001")!;
    const house = houseTasks(w).find((x) => x.origin === `house:${lhota9}`)!;
    // material: only what was given to the house
    const none = await w.run(["house", "add", "look-check", lhota9, "--next", "material", "--text", "skica"], AGENT);
    assert.notEqual(none.code, 0);
    assert.match(none.err, /no material lies at/u);
    // a picture of the municipality seems to show no. 9: a task of its look follows; no. 14: no more automatically
    for (const [a, next] of [[lhota9, "picture"], [lhota14, "none"]] as const) {
      await w.ok(["house", "add", "passed", a, "--checklist", "--what", "prošlo: adresní místo, ortofoto"], AGENT);
      await w.ok(["house", "add", "unknown", a, "--look", "--text", "podoba nezjištěna"], AGENT);
      await w.ok(["house", "add", "look-check", a, "--next", next, "--text", next === "picture" ? "obrázek návsi ukazuje č. 9" : "nic dalšího"], AGENT);
    }
    const done = await w.ok(["task", "done", house.id, "--result", "dům prošel", "--json"], AGENT);
    const look = open(w).get<Task>(done.json.look)!;
    assert.equal(look.origin, `house:look:${lhota9}`);
    assert.deepEqual(look.subject, [lhota9]);
    assert.match(look.what, /^Podoba domu Lhota 9/u);
    assert.match(look.why, /obrázek návsi ukazuje č\. 9/u);
    assert.equal(houseWork(look), "look");
    // its brief: the look's part of the method, why it follows
    const lb = (await w.ok(["brief", look.id], AGENT)).out;
    assert.match(lb, /## The look of a house \(after its research\)/u);
    assert.match(lb, /why its look is researched further \(picture\): obrázek návsi ukazuje č\. 9/u);
    assert.doesNotMatch(lb, /## A house \(with/u);
    // the bridge's view: a house's work, its look (no new value of work)
    const shown = (await w.ok(["house", "show", lhota9, "--json"])).json.house;
    assert.equal(shown.lookCheck.next, "picture");

    // the house asked again: its look waits behind its research, and that one behind its skeleton — whatever is
    // moved to the top of the queue
    const again = (await w.ok(["house", "request", lhota9, "--yes", "--json"])).json;
    const order = async () => ((await w.ok(["task", "list", "--json"])).json.tasks as { id: string }[]).map((x) => x.id);
    const chain = (q: string[]) => [q.indexOf(town.id), q.indexOf(again.task), q.indexOf(look.id)];
    for (const top of [look.id, again.task]) {
      await w.ok(["task", "order", top, "--next"], { tty: true });
      const [a, b, c] = chain(await order()) as [number, number, number];
      assert.ok(a >= 0 && a < b && b < c, `${town.id} < ${again.task} < ${look.id}: ${(await order()).join(" ")}`);
    }
    const next = (await w.ok(["task", "next", "--json"], AGENT)).json;
    assert.equal(next.task?.id ?? next.id, town.id, JSON.stringify(next));

    // material given after a house's research: a task of its look (another house, done with nothing more of its look)
    const d8task = houseTasks(w).find((x) => houseWork(x) === "house" && !housesOfTaskIds(x).includes(lhota9) && x.state === "open")!;
    const d8 = housesOfTaskIds(d8task)[0]!;
    for (const a of housesOfTaskIds(d8task)) await goneThrough(w, [a]);
    await w.ok(["task", "done", d8task.id, "--result", "dům prošel"], AGENT);
    const given = (await w.ok(["house", "add", "material", d8, "--memory", "Fotka statku z roku 1930.", "--json"])).json;
    assert.equal(open(w).get<Task>(given.task)!.origin, `house:look:${d8}`);

    // the look of the houses off: done with no look check, never a task of its look
    await w.ok(["config", "set", "houses.look", "off", "--for-tree"], { tty: true });
    const lt = houseTasks(w).find((x) => houseWork(x) === "house" && x.state === "open" && x.id !== again.task)!;
    const l1 = housesOfTaskIds(lt)[0]!;
    for (const a of housesOfTaskIds(lt)) {
      await w.ok(["house", "add", "passed", a, "--checklist", "--what", "prošlo: ortofoto"], AGENT);
      await w.ok(["house", "add", "look", a, "--text", "srub", "--certainty", "guess"], AGENT);
    }
    await w.ok(["house", "add", "look-check", l1, "--next", "picture", "--text", "obrázek"], AGENT);
    const off = await w.ok(["task", "done", lt.id, "--result", "dům prošel", "--json"], AGENT);
    assert.equal(off.json.look, undefined);
    assert.ok(!houseTasks(w).some((x) => houseWork(x) === "look" && housesOfTaskIds(x).includes(l1)));
  } finally {
    w.cleanup();
  }
});

test("the look of a house without noise (spec 145 T1, T5): no more automatically said once, the person's word kept; its check and certainty in the research language; a picture only under a free licence; the chain's turn and a material's task said as they are", opts, async () => {
  const w = new World();
  try {
    await village(w);
    await w.ok(["config", "set", "houses", "on", "--for-tree"], { tty: true });
    const lhota9 = houseId(w, "L0001", "9");
    const lhota14 = houseId(w, "L0001", "14");
    const town = houseTasks(w).find((x) => houseWork(x) === "town" && townOfTask(x) === "L0001")!;
    const house = houseTasks(w).find((x) => x.origin === `house:${lhota9}`)!;
    const looks = (a: string) => record(w, a).unknown.filter((u) => u.about === "look");

    // the research's own "not known" of its look, then none: one item, the check's why — and none again: still one
    await w.ok(["house", "add", "passed", lhota14, "--checklist", "--what", "prošlo: adresní místo, ortofoto"], AGENT);
    await w.ok(["house", "add", "unknown", lhota14, "--look", "--text", "podoba nezjištěna"], AGENT);
    const none = (await w.ok(["house", "add", "look-check", lhota14, "--next", "none", "--text", "obrázek domu nikde, skica jen ručně", "--json"], AGENT)).json;
    assert.deepEqual(looks(lhota14).map((u) => u.text), ["podoba: víc automaticky nejde – obrázek domu nikde, skica jen ručně"]);
    assert.equal(none.item, looks(lhota14)[0]!.id);
    await w.ok(["house", "add", "look-check", lhota14, "--next", "none", "--text", "nic dalšího"], AGENT);
    assert.deepEqual(looks(lhota14).map((u) => u.text), ["podoba: víc automaticky nejde – nic dalšího"]);
    // shown once: under what is not known, no line of its check besides
    const cs14 = (await w.ok(["house", "show", lhota14, "--lang", "cs"])).out;
    assert.equal((cs14.match(/víc automaticky nejde/gu) ?? []).length, 1, cs14);
    assert.doesNotMatch(cs14, /Další o podobě|none:/u);
    // the person's own word of its look stays as written: none adds nothing
    await w.ok(["house", "add", "unknown", lhota9, "--look", "--text", "fotka u babičky Lhotákové".normalize("NFD")]);
    await w.ok(["house", "add", "look-check", lhota9, "--next", "none", "--text", "nic dalšího"], AGENT);
    assert.deepEqual(looks(lhota9).map((u) => [u.text, u.origin]), [["fotka u babičky Lhotákové", "user"]]);

    // its check and its certainty in the research language
    await w.ok(["house", "add", "passed", lhota9, "--checklist", "--what", "prošlo: adresní místo, ortofoto"], AGENT);
    await w.ok(["house", "add", "look", lhota9, "--text", "přízemní chalupa", "--certainty", "guess"], AGENT);
    await w.ok(["house", "add", "look-check", lhota9, "--next", "picture", "--text", "obrázek návsi ukazuje č. 9"], AGENT);
    const cs9 = (await w.ok(["house", "show", lhota9, "--lang", "cs"])).out;
    assert.match(cs9, /Další o podobě\n {2}obrázek obce: obrázek návsi ukazuje č\. 9/u);
    assert.match(cs9, /přízemní chalupa · odhad/u);
    assert.doesNotMatch(cs9, /picture:|· guess/u);
    const de9 = (await w.ok(["house", "show", lhota9, "--lang", "de"])).out;
    assert.match(de9, /ein Bild des Ortes: /u);
    assert.match(de9, /· geschätzt/u);
    const pl9 = (await w.ok(["house", "show", lhota9, "--lang", "pl"])).out;
    assert.match(pl9, /zdjęcie miejscowości: /u);
    assert.match(pl9, /· przypuszczenie/u);

    // a picture of the municipality (or of the house by address) only under a free licence
    const pic = (license: string) => w.run(["house", "add", "picture", "--town", "L0001", "--url", "https://x.example.org/a.jpg", "--license", license, "--shows", "náves"], AGENT);
    for (const bad of ["All rights reserved", "© Lhoták, všechna práva vyhrazena", "CC BY-NC-SA 4.0", "CC BY-ND 4.0", "proprietary"]) {
      const r = await pic(bad);
      assert.notEqual(r.code, 0, bad);
      assert.match(r.err, /allows no free use/u, bad);
      assert.match(r.err, /strom house add manual --town L0001/u, bad);
    }
    for (const good of ["CC BY-SA 4.0", "Public domain", "CC0 1.0", "volné dílo".normalize("NFD"), "https://creativecommons.org/licenses/by/4.0/"]) await w.ok(["house", "add", "picture", "--town", "L0001", "--url", "https://x.example.org/a.jpg", "--license", good, "--shows", "náves"], AGENT);
    const lookBad = await w.run(["house", "add", "look", lhota9, "--text", "chalupa", "--image", "https://x.example.org/b.jpg", "--license", "All rights reserved"], AGENT);
    assert.notEqual(lookBad.code, 0);
    assert.match(lookBad.err, /allows no free use/u);

    // the house's research done: its look follows (picture); no. 14 none, no task
    const done = await w.ok(["task", "done", house.id, "--result", "dům prošel", "--json"], AGENT);
    const look = done.json.look as string;
    assert.ok(look);
    // material given later to the house done with none: a task of its look — said as such
    const given = await w.ok(["house", "add", "material", lhota14, "--memory", "Fotka statku z roku 1930."]);
    assert.match(given.out, /: the house's look, raised by its material/u);
    assert.doesNotMatch(given.out, /the house's research, raised/u);

    // the chain: the look put next waits behind its house's research, which waits behind its skeleton — said
    const again = (await w.ok(["house", "request", lhota9, "--yes", "--json"])).json;
    const toLook = await w.ok(["task", "order", look, "--next", "--json"], { tty: true });
    assert.deepEqual(toLook.json.after, [again.task]);
    assert.match((await w.ok(["task", "order", look, "--next"], { tty: true })).out, new RegExp(`${look} comes after ${again.task} all the same: its house's research first`, "u"));
    const toHouse = await w.ok(["task", "order", again.task, "--next"], { tty: true });
    assert.match(toHouse.out, new RegExp(`${again.task} comes after ${town.id} all the same: its municipality's skeleton first`, "u"));
    // a task of no chain: nothing more said
    assert.doesNotMatch((await w.ok(["task", "order", town.id, "--next"], { tty: true })).out, /comes after/u);
  } finally {
    w.cleanup();
  }
});

test("a licence that allows free use (spec 145 T1): public domain in its usual words, CC0, CC BY, CC BY-SA, … — never NC, ND, all rights reserved, nor a word not known as free", () => {
  for (const ok of ["CC BY 4.0", "cc-by-sa-3.0-de", "Creative Commons Attribution-ShareAlike 4.0", "CC0", "Public Domain Mark 1.0", "PD-old-70", "Gemeinfrei", "domena publiczna", "Volné dílo".normalize("NFD"), "GFDL", "No known copyright restrictions", "https://creativecommons.org/publicdomain/zero/1.0/"])
    assert.ok(freeLicence(ok), ok);
  for (const no of ["All rights reserved", "Alle Rechte vorbehalten", "CC BY-NC 4.0", "CC BY-NC-ND 4.0", "CC BY-ND", "https://creativecommons.org/licenses/by-nc/4.0/", "© 2020", "free to view", "Всі права захищені", ""])
    assert.ok(!freeLicence(no), no);
});

test("the list of sources by country (spec 145 T5): a municipality's point in a region's box gives its list, the general one else; a special house besides", () => {
  const place = (lat?: number, lon?: number) => ({ id: "L0001", type: "place", names: [{ name: "Lhota" }], ...(lat !== undefined ? { coords: { lat, lon } } : {}) }) as unknown as Place;
  assert.deepEqual(regionsOf(place(49.61, 15.12)).map((r) => r.id), ["cz"]);
  assert.deepEqual(regionsOf(place(47.8, 13.0)).map((r) => r.id).sort(), ["at", "by"]);
  assert.deepEqual(regionsOf(place(40.0, -3.7)), []);
  assert.deepEqual(regionsOf(place()), []);
  const cz = sourcesFor(place(49.61, 15.12), "house");
  assert.deepEqual(cz.map((g) => g.region), ["Czechia (Bohemia, Moravia, Silesia)"]);
  assert.ok(cz[0]!.items.some((x) => x.id === "ruian" && x.by === "agent"));
  assert.ok(cz[0]!.items.some((x) => x.id === "sketch" && x.by === "hand"));
  const town = sourcesFor(place(49.61, 15.12), "town")[0]!.items.map((x) => x.id);
  for (const id of ["schaller", "sommer", "geonames", "pictures", "monuments", "sheets"]) assert.ok(town.includes(id), id);
  // a special house: the general list and the region's besides
  assert.deepEqual(sourcesFor(place(49.61, 15.12), "special").map((g) => g.region ?? "general"), ["general", "Czechia (Bohemia, Moravia, Silesia)"]);
  // nowhere known: the general list alone
  assert.deepEqual(sourcesFor(place(40.0, -3.7), "house").map((g) => g.region), [undefined]);
});
