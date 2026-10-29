// What the ancestors lived through (experiments.history), the gaps of a finished catalog (K2.6): the years the tree's
// people lived in a region with no event of its catalog — more than GAP_YEARS in a row — get one task to fill them,
// paced as a region's; its session looks for those years alone; what it looked at is never looked for again (nor a
// gap whose task was dropped), unless the person asks for the region again; nothing left to do meanwhile, its task is
// done with why (filled, looked at by another research) — closed so, it is no look: its events taken back, raised again.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { GAP_YEARS, gapsOfTask, livedSpans, regionGaps } from "../../src/core/pastevents.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const NAMES = ["--name-cs", "Lhotsko", "--name-en", "Lhota Land", "--name-de", "Lhotaland"];

/** Jan Lhoták, born 1850 at Lhota, died 1925 at Nová Lhota: both places in cz-lhota (from 1800 unless said). */
async function world(link = "cz-lhota:1800-"): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1925", "--place", "Nová Lhota"]);
  await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
  await w.ok(["history", "region", "cz-lhota", ...NAMES]);
  for (const place of ["Lhota", "Nová Lhota"]) await w.ok(["history", "map", place, "--region", link]);
  return w;
}

function catalogFile(w: World, id = "cz-lhota"): string {
  return path.join(w.home, "shared", "history", "regions", `${id}.json`);
}

/** The catalog's events (each [from, to?]) written as strom would, finished or not; the rest of it kept. */
function events(w: World, spans: ([number] | [number, number])[], opts: { done?: boolean; by?: string; at?: string } = {}): void {
  const file = catalogFile(w);
  const c = readJsonFile(file);
  const source = { title: "Dějiny Lhotska", url: "https://example.org/lhotsko", checked: "2026-10-01", quote: "1866", sha: "0".repeat(64) };
  c.events = spans.map(([from, to], i) => ({
    id: `cz-lhota-${String(i + 1).padStart(4, "0")}`,
    from,
    to: to ?? from,
    kind: "other",
    text: { cs: "Událost", en: "Event", de: "Ereignis" },
    source,
    by: opts.by ?? "x",
    at: opts.at ?? "2026-10-01T00:00:00Z",
  }));
  c.next = spans.length + 1;
  if (opts.done ?? true) c.done = { at: "2026-10-02T00:00:00Z", tree: "x" };
  fs.writeFileSync(file, JSON.stringify(c));
}

async function tasks(w: World): Promise<Task[]> {
  return (await w.ok(["task", "list", "--state", "all", "--full", "--json", "--limit", "500"])).json.tasks;
}

const gapTasks = async (w: World) => (await tasks(w)).filter((t) => t.origin === "history:gaps:cz-lhota");

test("history gaps: the years the people lived there with no event — margins, the region's years, a long event's ends, the threshold; none for a catalog not finished or a region without people", opts, async () => {
  const w = await world();
  try {
    const tree = () => Tree.open(w.cwd, w.env);
    const shared = path.join(w.home, "shared");
    // Jan's facts 1850 and 1925: lived there 1845–1930
    assert.deepEqual(livedSpans(tree(), "cz-lhota"), [{ from: 1845, to: 1930 }]);
    // nothing between 1866 and 1914: one gap; the shorter runs (1849–1859, 1919–1920, 1922–1930) none
    events(w, [[1848], [1860], [1866], [1914, 1918], [1921]], { done: false });
    assert.deepEqual(regionGaps(tree(), shared, "cz-lhota"), [], "a catalog not finished: its own task looks for all");
    events(w, [[1848], [1860], [1866], [1914, 1918], [1921]]);
    assert.deepEqual(regionGaps(tree(), shared, "cz-lhota"), [{ from: 1867, to: 1913 }]);
    // the threshold: GAP_YEARS in a row is no gap, one more is
    assert.equal(GAP_YEARS, 15);
    events(w, [[1848], [1860], [1866], [1882], [1898], [1914, 1918], [1921]]);
    assert.deepEqual(regionGaps(tree(), shared, "cz-lhota"), [], "1867–1881 and 1883–1897: 15 years each");
    events(w, [[1848], [1860], [1866], [1883], [1898], [1914, 1918], [1921]]);
    assert.deepEqual(regionGaps(tree(), shared, "cz-lhota"), [{ from: 1867, to: 1882 }], "16 years");
    // an event of many years (the state, 1867–1918) marks its ends only
    events(w, [[1848], [1860], [1866], [1867, 1918], [1921]]);
    assert.deepEqual(regionGaps(tree(), shared, "cz-lhota"), [{ from: 1868, to: 1917 }]);
    // a margin at the edge: no event before 1866 — 1845–1865 is a gap (21 years)
    events(w, [[1866], [1880], [1895], [1910], [1921]]);
    assert.deepEqual(regionGaps(tree(), shared, "cz-lhota"), [{ from: 1845, to: 1865 }]);
    // a region without people there (a place of no dated fact): nothing
    await w.ok(["history", "region", "cz-jinde", "--name-cs", "Jinde", "--name-en", "Elsewhere", "--name-de", "Anderswo"]);
    assert.deepEqual(livedSpans(tree(), "cz-jinde"), []);
    assert.deepEqual(regionGaps(tree(), shared, "cz-jinde"), []);
  } finally {
    w.cleanup();
  }
  // the region's years: the places in it 1800–1900 only — Jan's death of 1925 is not there, his span ends at 1900
  const v = await world("cz-lhota:1800-1900");
  try {
    assert.deepEqual(livedSpans(Tree.open(v.cwd, v.env), "cz-lhota"), [{ from: 1845, to: 1855 }]);
  } finally {
    v.cleanup();
  }
  // a person's every fact counts, a family's for its partners: Marie (her marriage at Lhota in 1880, no other fact)
  const f = await world();
  try {
    const marie = (await f.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F", "--json"])).json.person.id;
    const fam = (await f.ok(["family", "add", "--partner", "P0001", "--partner", marie, "--json"])).json.family.id;
    await f.ok(["event", "add", fam, "MARR", "--date", "1880", "--place", "Lhota"]);
    // Jan 1845–1930 and Marie 1875–1885 joined
    assert.deepEqual(livedSpans(Tree.open(f.cwd, f.env), "cz-lhota"), [{ from: 1845, to: 1930 }]);
  } finally {
    f.cleanup();
  }
});

test("history gaps: a finished catalog with a gap gets one task to fill it, said by strom history status and strom plan; its brief asks for those years alone and strom history add refuses others", opts, async () => {
  const w = await world();
  try {
    events(w, [[1848], [1860], [1866], [1914, 1918], [1921]]);
    await w.ok(["frontier", "--apply"]);
    await w.ok(["frontier", "--apply"]);
    const [gap, ...more] = await gapTasks(w);
    assert.ok(gap, "a task of the gaps");
    assert.deepEqual(more, [], "once");
    assert.equal(gap.level, "enrich");
    assert.deepEqual(gap.where, ["1867–1913"]);
    assert.deepEqual(gapsOfTask(gap), [{ from: 1867, to: 1913 }]);
    assert.match(gap.what, /Události dějin v regionu Lhotsko pro roky, kdy katalog žádné nemá: 1867–1913/u, "in the research language");
    assert.ok(!(await tasks(w)).some((t) => t.origin === "history:region:cz-lhota" && t.state === "open"), "no region's task for a finished catalog");
    // strom history status: the gap at the region, the task with its ID
    const status = await w.ok(["history", "status"]);
    assert.match(status.out, /cz-lhota .*done 2026-10-02 +period 1845–1930 +gaps: 1867–1913/u);
    assert.match(status.out, new RegExp(`${gap.id} +history:gaps:cz-lhota +open +years 1867–1913`, "u"));
    const json = (await w.ok(["history", "status", "--json"])).json;
    assert.deepEqual(json.regions.find((r: { id: string }) => r.id === "cz-lhota").gaps, [{ from: 1867, to: 1913 }]);
    // strom plan: the region with its years, in the research language
    assert.match((await w.ok(["plan"])).out, /Lhotsko, roky bez událostí 1867–1913 \(osob: 1\)/u);
    // the brief: those years alone, about one event in 10–15 years, no strom history done
    const brief = (await w.ok(["brief", gap.id])).out;
    assert.match(brief, /## The gaps in the history of Lhotsko \(cz-lhota\)/);
    assert.match(brief, /no event: 1867–1913 \(47 years\)\n- look for events of these years alone/);
    assert.match(brief, /about one event every 10–15 years of each gap \(about 4 in all\)/);
    assert.match(brief, /cz-lhota-0003 1866 other "Událost"/, "what the catalog has, never again");
    assert.match(brief, /strom history add --region <id>/);
    assert.doesNotMatch(brief, /strom history done/);
    assert.match(brief, /these years are never looked for again/);
    // its session holds the finished region; an event outside the gaps refused before any request
    await w.ok(["session", "start", gap.id]);
    assert.equal(readJsonFile(catalogFile(w)).holder.tree, readJsonFile(path.join(w.cwd, "strom.json")).id);
    const add = ["history", "add", "--region", "cz-lhota", "--kind", "war", "--text-cs", "Válka", "--text-en", "War", "--text-de", "Krieg", "--url", "https://example.invalid/war"];
    const out = await w.run([...add, "--from", "1850", "--quote", "In 1850 a war"]);
    assert.notEqual(out.code, 0);
    assert.match(out.err, /this session fills the gaps of cz-lhota only \(1867–1913\): 1850 is outside them/);
    // closed with nothing found: looked at, never raised again; the region let go
    await w.ok(["session", "close", "--done", "nic doloženého", "--next", "nic"]);
    const c = readJsonFile(catalogFile(w));
    assert.equal(c.holder, undefined);
    assert.deepEqual(c.gaps.map((g: { from: number; to: number; added: number }) => [g.from, g.to, g.added]), [[1867, 1913, 0]]);
    assert.ok(c.done, "still finished");
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual((await gapTasks(w)).map((t) => t.state), ["done"], "a gap looked at: never again");
    assert.doesNotMatch((await w.ok(["history", "status"])).out, /gaps: /);
    // another research on this computer, its people there in the same years: the gap looked at is not looked for again
    await w.ok(["init", "Lhotákovi z Lhoty"]);
    w.cwd = w.treeDir("Lhotákovi z Lhoty");
    await w.ok(["research", "new", "Předci Marie Lhotákové", "--new-person", "Marie /Lhotáková/", "--sex", "F", "--born", "1870", "--born-place", "Lhota"]);
    await w.ok(["event", "add", "P0001", "DEAT", "--date", "1910", "--place", "Lhota"]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"]);
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual(livedSpans(Tree.open(w.cwd, w.env), "cz-lhota"), [{ from: 1865, to: 1915 }], "the same gap there");
    assert.deepEqual(await gapTasks(w), [], "the other tree's look holds here too");
  } finally {
    w.cleanup();
  }
});

test("history gaps: the events written counted when its task is done; dropped — never raised again until the person asks for the region again; filled meanwhile — the waiting task done", opts, async () => {
  const w = await world();
  try {
    events(w, [[1848], [1860], [1866], [1914, 1918], [1921]]);
    await w.ok(["frontier", "--apply"]);
    const [first] = await gapTasks(w);
    // the events this tree writes in the gap are counted when its task is done
    await w.ok(["session", "start", first!.id]);
    const me = readJsonFile(path.join(w.cwd, "strom.json")).id;
    const { holder } = readJsonFile(catalogFile(w));
    events(w, [[1848], [1860], [1866], [1914, 1918], [1921], [1890]], { by: me, at: new Date().toISOString() });
    fs.writeFileSync(catalogFile(w), JSON.stringify({ ...readJsonFile(catalogFile(w)), holder }));
    await w.ok(["session", "close", "--done", "jedna událost", "--next", "nic"]);
    assert.deepEqual(readJsonFile(catalogFile(w)).gaps.map((g: { from: number; to: number; added: number }) => [g.from, g.to, g.added]), [[1867, 1913, 1]]);
    // 1867–1889 and 1891–1913 are still more than 15 years each: looked at, never raised again
    await w.ok(["frontier", "--apply"]);
    assert.ok(!(await gapTasks(w)).some((t) => t.state === "open"), "looked at once");
    // the person asks for the region again: what was looked at goes; finished again, its gaps are raised again
    await w.ok(["history", "redo", "cz-lhota"]);
    assert.equal(readJsonFile(catalogFile(w)).gaps, undefined);
    await w.ok(["history", "done", "cz-lhota"]);
    await w.ok(["frontier", "--apply"]);
    const second = (await gapTasks(w)).find((t) => t.state === "open")!;
    assert.deepEqual(second.where, ["1867–1889", "1891–1913"]);
    // dropped: that is the answer
    await w.ok(["task", "drop", second.id, "--reason", "zkouška"]);
    await w.ok(["frontier", "--apply"]);
    assert.ok(!(await gapTasks(w)).some((t) => t.state === "open"), "dropped: not again");
    // asked again once more: raised; then filled meanwhile (another tree): the waiting task is done by itself
    await w.ok(["history", "redo", "cz-lhota"]);
    await w.ok(["history", "done", "cz-lhota"]);
    await w.ok(["frontier", "--apply"]);
    const third = (await gapTasks(w)).find((t) => t.state === "open")!;
    assert.ok(third);
    events(w, [[1848], [1860], [1866], [1880], [1890], [1900], [1910], [1914, 1918], [1921]]);
    await w.ok(["frontier", "--apply"]);
    const filled = (await gapTasks(w)).find((t) => t.id === third.id)!;
    assert.equal(filled.state, "done");
    assert.match(filled.result ?? "", /v událostech regionu Lhotsko už žádná mezera není/u);
  } finally {
    w.cleanup();
  }
});

test("history gaps: a waiting task closed by strom says why, truly — looked at by another research (nothing found, or what it wrote), or filled; filled and its events taken back, the gap is raised again", opts, async () => {
  const w = await world();
  try {
    events(w, [[1848], [1860], [1866], [1914, 1918], [1921]]);
    const a = w.cwd;
    // another research on this computer, Marie at Lhota 1870–1910: the same gap 1867–1913, the same shared catalog
    await w.ok(["init", "Lhotákovi z Lhoty"]);
    const b = w.treeDir("Lhotákovi z Lhoty");
    w.cwd = b;
    await w.ok(["research", "new", "Předci Marie Lhotákové", "--new-person", "Marie /Lhotáková/", "--sex", "F", "--born", "1870", "--born-place", "Lhota"]);
    await w.ok(["event", "add", "P0001", "DEAT", "--date", "1910", "--place", "Lhota"]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"]);
    const waiting = async () => {
      await w.ok(["frontier", "--apply"]);
      const t = (await gapTasks(w)).find((x) => x.state === "open")!;
      assert.deepEqual(t?.where, ["1867–1913"], "B's task of the gap");
      return t;
    };
    const closed = async (id: string) => {
      await w.ok(["frontier", "--apply"]);
      const t = (await gapTasks(w)).find((x) => x.id === id)!;
      assert.equal(t.state, "done");
      return t.result ?? "";
    };
    // A looks at the gap and finds nothing: B's waiting task says so — not that no gap is left
    let t = await waiting();
    w.cwd = a;
    await w.ok(["frontier", "--apply"]);
    await w.ok(["session", "start", (await gapTasks(w)).find((x) => x.state === "open")!.id]);
    await w.ok(["session", "close", "--done", "nic doloženého", "--next", "nic"]);
    w.cwd = b;
    let result = await closed(t.id);
    assert.match(result, /^roky 1867–1913 v událostech regionu Lhotsko už prohledal jiný výzkum: doložená událost v nich žádná$/u);
    assert.doesNotMatch(result, /žádná mezera/u);
    // asked again; another research's look wrote one event, the years left still a gap: what it wrote is said
    await w.ok(["history", "redo", "cz-lhota"]);
    await w.ok(["history", "done", "cz-lhota"]);
    t = await waiting();
    events(w, [[1848], [1860], [1866], [1890], [1914, 1918], [1921]]);
    const c = readJsonFile(catalogFile(w));
    c.gaps = [{ from: 1867, to: 1913, at: new Date().toISOString(), tree: "jiny", added: 1 }];
    fs.writeFileSync(catalogFile(w), JSON.stringify(c));
    assert.match(await closed(t.id), /^roky 1867–1913 v událostech regionu Lhotsko už prohledal jiný výzkum: zapsaných událostí v nich: 1$/u);
    // asked again (that event taken out by hand); filled meanwhile: no gap left
    await w.ok(["history", "redo", "cz-lhota"]);
    await w.ok(["history", "done", "cz-lhota"]);
    events(w, [[1848], [1860], [1866], [1914, 1918], [1921]]);
    t = await waiting();
    events(w, [[1848], [1860], [1866], [1880], [1890], [1900], [1910], [1914, 1918], [1921]]);
    assert.match(await closed(t.id), /^v událostech regionu Lhotsko už žádná mezera není$/u);
    // the events that filled it taken back: a task closed by strom is no look — the gap is raised again
    for (const id of ["cz-lhota-0004", "cz-lhota-0005", "cz-lhota-0006", "cz-lhota-0007"]) await w.ok(["history", "retract", id, "--why", "zkouška"]);
    const again = await waiting();
    assert.notEqual(again.id, t.id);
  } finally {
    w.cleanup();
  }
});

test("history gaps: the person asks for the region again — its open task of the gaps is done at once, why said; the catalog finished again raises it again", opts, async () => {
  const w = await world();
  try {
    events(w, [[1848], [1860], [1866], [1914, 1918], [1921]]);
    await w.ok(["frontier", "--apply"]);
    const open = (await gapTasks(w)).find((t) => t.state === "open")!;
    assert.ok(open);
    await w.ok(["history", "redo", "cz-lhota"]);
    const closed = (await gapTasks(w)).find((t) => t.id === open.id)!;
    assert.equal(closed.state, "done");
    assert.match(closed.result ?? "", /^události regionu Lhotsko se hledají znovu celé, tyto roky s nimi$/u);
    await w.ok(["frontier", "--apply"]);
    assert.ok(!(await gapTasks(w)).some((t) => t.state === "open"), "the region's own task looks for all");
    await w.ok(["history", "done", "cz-lhota"]);
    await w.ok(["frontier", "--apply"]);
    assert.ok((await gapTasks(w)).some((t) => t.state === "open" && t.id !== open.id));
  } finally {
    w.cleanup();
  }
});
