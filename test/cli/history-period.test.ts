// What the ancestors lived through (experiments.history), a region's period (K2.7): its events are looked for in the
// years the tree's people lived at its places — their facts there, LIVED_MARGIN before and after, to this year only when
// they reach the last PRESENT_YEARS; spans more than GAP_YEARS apart stay apart. A finished catalog keeps the years it
// was looked through for (`searched`); a period grown later (an ancestor found earlier, another tree sharing it) gets a
// task of the new years alone — the task of a finished catalog's years (history:gaps:<id>), paced as a region's. A
// catalog finished before the years were kept counts as looked through for what its brief said then: nothing raised again.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { GAP_DENSITY, PRESENT_YEARS, regionNew, regionPeriod } from "../../src/core/pastevents.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const NAMES = ["--name-cs", "Lhotsko", "--name-en", "Lhota Land", "--name-de", "Lhotaland"];
const NOW = new Date().getFullYear();

/** Jan Lhoták, born 1850 at Lhota, died 1925 at Lhota: the place in cz-lhota from 1600. */
async function world(name = "Lhotákovi", born = "1850", died = "1925"): Promise<World> {
  const w = new World();
  await w.withTree(name);
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", born, "--born-place", "Lhota"]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", died, "--place", "Lhota"]);
  await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
  await w.ok(["history", "region", "cz-lhota", ...NAMES]);
  await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1600-"]);
  return w;
}

function catalogFile(w: World): string {
  return path.join(w.home, "shared", "history", "regions", "cz-lhota.json");
}

/** An event every ten years of these spans (no gap in them), the rest of the catalog kept; finished by `done` when given. */
function events(w: World, spans: [number, number][], done?: { tree: string; at?: string }): void {
  const c = readJsonFile(catalogFile(w));
  const source = { title: "Dějiny Lhotska", url: "https://example.org/lhotsko", checked: "2026-10-01", quote: "1866", sha: "0".repeat(64) };
  const years = spans.flatMap(([from, to]) => Array.from({ length: Math.floor((to - from) / 10) + 1 }, (_, i) => from + i * 10));
  c.events = years.map((y, i) => ({ id: `cz-lhota-${String(i + 1).padStart(4, "0")}`, from: y, to: y, kind: "other", text: { cs: "Událost", en: "Event", de: "Ereignis" }, source, by: "x", at: "2026-10-01T00:00:00Z" }));
  c.next = years.length + 1;
  if (done) c.done = { at: done.at ?? "2026-10-02T00:00:00Z", tree: done.tree };
  fs.writeFileSync(catalogFile(w), JSON.stringify(c));
}

async function tasks(w: World): Promise<Task[]> {
  return (await w.ok(["task", "list", "--state", "all", "--full", "--json", "--limit", "500"])).json.tasks;
}
const yearTasks = async (w: World) => (await tasks(w)).filter((t) => t.origin === "history:gaps:cz-lhota");
const treeId = (w: World): string => readJsonFile(path.join(w.cwd, "strom.json")).id;

test("history period: a short stay — those years alone; a long one reaching the last years — to this year; spans far apart stay apart, close ones joined; said by the brief", opts, async () => {
  // a grandfather a few years at a war: 1943 and 1945 — 1938–1950, not to this year
  const w = await world("Lhotákovi", "1943", "1945");
  try {
    const period = regionPeriod(Tree.open(w.cwd, w.env), "cz-lhota");
    assert.deepEqual(period.spans, [{ from: 1938, to: 1950 }]);
    assert.equal(period.undated, undefined);
    await w.ok(["frontier", "--apply"]);
    const region = (await tasks(w)).find((t) => t.origin === "history:region:cz-lhota")!;
    const brief = (await w.ok(["brief", region.id])).out;
    assert.match(brief, /- period: 1938–1950 — the years this tree's people lived at its places/);
    assert.doesNotMatch(brief, new RegExp(`1938–${NOW}`));
    // the plan and the status say it
    assert.match((await w.ok(["plan"])).out, /Lhotsko 1938–1950 \(osob: 1\)/u);
    assert.match((await w.ok(["history", "status"])).out, /cz-lhota .* period 1938–1950/u);
    assert.deepEqual((await w.ok(["history", "status", "--json"])).json.regions.find((r: { id: string }) => r.id === "cz-lhota").period, [{ from: 1938, to: 1950 }]);
    // a granddaughter born there in the last 30 years: her span reaches this year; 1951–1994 apart (more than 15 years)
    assert.equal(PRESENT_YEARS, 30);
    const eva = (await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", String(NOW - 20), "--born-place", "Lhota", "--json"])).json.person.id;
    assert.ok(eva);
    assert.deepEqual(regionPeriod(Tree.open(w.cwd, w.env), "cz-lhota").spans, [{ from: 1938, to: 1950 }, { from: NOW - 25, to: NOW }]);
    // a facts' year 31 years back is no present: its own years alone
    await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M", "--born", "1962", "--born-place", "Lhota"]);
    // 1957–1967 is 6 years after 1950: joined (a run of 15 years or fewer is no gap either)
    assert.deepEqual(regionPeriod(Tree.open(w.cwd, w.env), "cz-lhota").spans, [{ from: 1938, to: 1967 }, { from: NOW - 25, to: NOW }]);
  } finally {
    w.cleanup();
  }
});

test("history period: a finished catalog keeps its years; an ancestor found earlier — a task of the new years alone, said by the status, the plan and the brief, history add refuses others; a few new years wait", opts, async () => {
  const w = await world();
  try {
    events(w, [[1845, 1930]]);
    await w.ok(["frontier", "--apply"]);
    const region = (await tasks(w)).find((t) => t.origin === "history:region:cz-lhota")!;
    await w.ok(["session", "start", region.id]);
    await w.ok(["history", "done", "cz-lhota"]);
    await w.ok(["session", "close", "--done", "události nalezeny", "--next", "nic"]);
    const c = readJsonFile(catalogFile(w));
    assert.deepEqual(c.searched.map((g: { from: number; to: number; tree: string }) => [g.from, g.to, g.tree]), [[1845, 1930, treeId(w)]], "the period looked through");
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual(await yearTasks(w), [], "nothing new");
    // his father, born 1840 there: 1835–1844 — fewer than GAP_DENSITY years beside those looked through, they wait
    assert.equal(GAP_DENSITY, 12);
    const father = (await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M", "--born", "1840", "--born-place", "Lhota", "--json"])).json.person.id;
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual(await yearTasks(w), [], "10 new years wait");
    // born 1800 instead, died 1860: 1795–1844 new — one task of those years alone
    await w.ok(["event", "add", father, "BIRT", "--date", "1800", "--place", "Lhota"]);
    await w.ok(["event", "add", father, "DEAT", "--date", "1860", "--place", "Lhota"]);
    const tree = Tree.open(w.cwd, w.env);
    assert.ok(regionPeriod(tree, "cz-lhota").spans[0]!.from <= 1795);
    await w.ok(["frontier", "--apply"]);
    const [extend, ...more] = await yearTasks(w);
    assert.ok(extend, "a task of the new years");
    assert.deepEqual(more, []);
    assert.deepEqual(extend.where, ["1795–1844"]);
    assert.match(extend.what, /Události dějin v regionu Lhotsko pro roky osob stromu, které se ještě neprohledaly: 1795–1844/u);
    assert.deepEqual(regionNew(tree, path.join(w.home, "shared"), "cz-lhota"), [{ from: 1795, to: 1844 }]);
    // strom history status, strom plan: what waits
    const status = (await w.ok(["history", "status"])).out;
    assert.match(status, /cz-lhota .*period 1795–1930 +not looked through: 1795–1844/u);
    assert.match(status, new RegExp(`${extend.id} +history:gaps:cz-lhota +open +years 1795–1844`, "u"));
    assert.match((await w.ok(["plan"])).out, /Lhotsko, roky k prohledání 1795–1844 \(osob: 2\)/u);
    // the brief: these years alone, never looked through
    const brief = (await w.ok(["brief", extend.id])).out;
    assert.match(brief, /## The years not looked through yet in the history of Lhotsko \(cz-lhota\)/);
    assert.match(brief, /these years of this tree's people there were never looked through: 1795–1844 \(50 years\)/);
    assert.doesNotMatch(brief, /have no event:/);
    assert.match(brief, /about one event every 10–15 years of each span of these years \(about 4 in all\)/);
    assert.doesNotMatch(brief, /strom history done/);
    // its session: an event of the years looked through before refused
    await w.ok(["session", "start", extend.id]);
    const add = ["history", "add", "--region", "cz-lhota", "--kind", "war", "--text-cs", "Válka", "--text-en", "War", "--text-de", "Krieg", "--url", "https://example.invalid/war"];
    const out = await w.run([...add, "--from", "1866", "--quote", "In 1866 a war"]);
    assert.notEqual(out.code, 0);
    assert.match(out.err, /this session looks through the years of cz-lhota never looked through only \(1795–1844\): 1866 is outside them/);
    await w.ok(["session", "close", "--done", "nic doloženého", "--next", "nic"]);
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual((await yearTasks(w)).map((t) => t.state), ["done"], "looked through: never again");
    assert.doesNotMatch((await w.ok(["history", "status"])).out, /not looked through/);
  } finally {
    w.cleanup();
  }
});

test("history period: a catalog shared by two trees — the second one's years beyond the first's get a task of them alone; within them nothing; what it looked through holds for both", opts, async () => {
  const w = await world();
  try {
    events(w, [[1845, 1930]]);
    await w.ok(["history", "done", "cz-lhota"]);
    const a = w.cwd;
    assert.deepEqual(readJsonFile(catalogFile(w)).searched.map((g: { from: number; to: number }) => [g.from, g.to]), [[1845, 1930]]);
    // another research on this computer: Marie at Lhota 1700–1760 and Anna 1870–1910
    await w.ok(["init", "Lhotákovi z Lhoty"]);
    w.cwd = w.treeDir("Lhotákovi z Lhoty");
    await w.ok(["research", "new", "Předci Marie Lhotákové", "--new-person", "Marie /Lhotáková/", "--sex", "F", "--born", "1700", "--born-place", "Lhota"]);
    await w.ok(["event", "add", "P0001", "DEAT", "--date", "1760", "--place", "Lhota"]);
    await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F", "--born", "1870", "--born-place", "Lhota"]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1600-"]);
    await w.ok(["frontier", "--apply"]);
    const [extend, ...more] = await yearTasks(w);
    assert.deepEqual(extend?.where, ["1695–1765"], "the years beyond the first tree's alone");
    assert.deepEqual(more, []);
    assert.ok(!(await tasks(w)).some((t) => t.origin === "history:region:cz-lhota" && t.state === "open"), "the region is finished: no task of it again");
    await w.ok(["session", "start", extend!.id]);
    await w.ok(["session", "close", "--done", "nic doloženého", "--next", "nic"]);
    const c = readJsonFile(catalogFile(w));
    assert.deepEqual(c.gaps.map((g: { from: number; to: number }) => [g.from, g.to]), [[1695, 1765]]);
    // the first tree, an ancestor of its own there in 1700–1760 too: looked through by the other — nothing raised
    w.cwd = a;
    await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1710", "--born-place", "Lhota"]);
    await w.ok(["event", "add", "P0002", "DEAT", "--date", "1755", "--place", "Lhota"]);
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual(await yearTasks(w), [], "the years both trees' people lived there, looked through once");
  } finally {
    w.cleanup();
  }
});

test("history period: a catalog finished before its years were kept — counted looked through for what its brief said then, nothing raised again; the tree that finished it writes that down once, an ancestor found earlier later gets the new years", opts, async () => {
  // finished by this tree (no `searched`): the oldest fact 1850 to the year it was finished
  const w = await world();
  try {
    events(w, [[1845, 1930]], { tree: "" });
    const c0 = readJsonFile(catalogFile(w));
    c0.done.tree = treeId(w);
    fs.writeFileSync(catalogFile(w), JSON.stringify(c0));
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual(await yearTasks(w), [], "nothing raised again");
    assert.ok(!(await tasks(w)).some((t) => t.origin === "history:region:cz-lhota"), "no region's task");
    const c = readJsonFile(catalogFile(w));
    assert.deepEqual(c.searched.map((g: { from: number; to: number; at: string; tree: string }) => [g.from, g.to, g.at, g.tree]), [[1850, 2026, "2026-10-02T00:00:00Z", treeId(w)]], "what the brief said then, written once");
    // an ancestor found earlier: the years before 1850 (and its margin) are new
    await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M", "--born", "1790", "--born-place", "Lhota"]);
    await w.ok(["event", "add", "P0002", "DEAT", "--date", "1840", "--place", "Lhota"]);
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual((await yearTasks(w)).map((t) => t.where), [["1785–1849"]]);
    // the ancestor taken back: no such years any more — the waiting task done, saying so
    await w.ok(["person", "retract", "P0002", "--reason", "zkouška"]);
    await w.ok(["frontier", "--apply"]);
    const [gone] = await yearTasks(w);
    assert.equal(gone!.state, "done");
    assert.match(gone!.result ?? "", /^roky 1785–1849 už nejsou roky osob tohoto stromu v regionu Lhotsko: údaje jeho osob v tom regionu se změnily$/u);
  } finally {
    w.cleanup();
  }
  // finished by another tree before (unknown period): from 1600 to that year — an ancestor of 1700 raises nothing, nothing written
  const v = await world();
  try {
    events(v, [[1845, 1930]], { tree: "x" });
    await v.ok(["person", "add", "Josef /Lhoták/", "--sex", "M", "--born", "1700", "--born-place", "Lhota"]);
    await v.ok(["frontier", "--apply"]);
    assert.deepEqual(await yearTasks(v), [], "1695–1705 counted looked through (11 years: no gap either)");
    assert.equal(readJsonFile(catalogFile(v)).searched, undefined, "another tree's catalog untouched");
  } finally {
    v.cleanup();
  }
});
