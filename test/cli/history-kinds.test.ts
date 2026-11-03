// The kinds of events the history looks for (history.kinds, spec 035): all by default (a research from before reads as
// it did), a kind added only by the person, one left out by anyone; strom history add and local refuse a kind not looked
// for, the briefs name only those looked for, a region's catalog looks for every kind a research sharing it wants; strom
// history align says first what it would hide, show again and look for, and does it only on the person's yes — hidden
// reversibly, the shared catalogs pruned only when asked and only of kinds no research wants, a kind turned on looked for
// only in the years looked through without it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { kindsOf, normalizeKinds } from "../../src/core/eventkinds.ts";
import { kindsValue } from "../../src/cli/menu-settings.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const AGENT = { CLAUDECODE: "1" };
const NAMES = ["--name-cs", "Lhotsko", "--name-en", "Lhota Land", "--name-de", "Lhotaland"];
const TEXTS = ["--text-cs", "Událost", "--text-en", "An event", "--text-de", "Ein Ereignis"];

/** Jan Lhoták born 1850 at Lhota (in cz-lhota from 1800), the history of the regions on for every research here. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
  await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
  await w.ok(["history", "region", "cz-lhota", ...NAMES]);
  await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"]);
  return w;
}

/** A second research on this computer, its Lhota in the same region; its own kinds (none: this computer's). */
async function second(w: World, kinds?: string): Promise<string> {
  await w.ok(["init", "Lhotovi"], { cwd: w.home });
  const cwd = w.treeDir("Lhotovi");
  await w.ok(["research", "new", "Předci Petra Lhoty", "--new-person", "Petr /Lhota/", "--sex", "M", "--born", "1852", "--born-place", "Lhota"], { cwd });
  await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"], { cwd });
  if (kinds) await w.ok(["config", "set", "history.kinds", kinds, "--for-tree"], { cwd, tty: true, answers: ["a"] });
  return cwd;
}

function catalogFile(w: World): string {
  return path.join(w.home, "shared", "history", "regions", "cz-lhota.json");
}

/** The region's events, as strom writes them: [n, year, kind]. */
function writeEvents(w: World, events: [number, number, string][], done = false): void {
  const c = readJsonFile(catalogFile(w));
  const source = { title: "Dějiny Lhotska", url: "https://example.org/lhotsko", checked: "2026-10-01", quote: "1850", sha: "0".repeat(64) };
  c.events = events.map(([n, from, kind]) => ({ id: `cz-lhota-${String(n).padStart(4, "0")}`, from, to: from, kind, text: { cs: "Událost", en: "Event", de: "Ereignis" }, source, by: "x", at: "2026-10-01T00:00:00Z" }));
  c.next = events.length + 1;
  if (done) c.done = { at: "2026-10-02T00:00:00Z", tree: "x" };
  fs.writeFileSync(catalogFile(w), JSON.stringify(c));
}

async function tasks(w: World, cwd?: string): Promise<Task[]> {
  return (await w.ok(["task", "list", "--state", "all", "--full", "--json", "--limit", "500"], cwd ? { cwd } : {})).json.tasks;
}

const hidden = (w: World): { event?: string; by?: string }[] => {
  const file = path.join(w.cwd, "history", "hidden.json");
  return fs.existsSync(file) ? readJsonFile(file).hidden : [];
};

/** An agent writing an event of the region: refused for its kind, or (looked for) on to the page it lacks. */
const addRegion = (w: World, kind: string, cwd?: string) => w.run(["history", "add", "--region", "cz-lhota", "--from", "1850", "--kind", kind, ...TEXTS], { env: AGENT, ...(cwd ? { cwd } : {}) });

test("history.kinds: all by default, none, a list or all but some — kept as meant; a kind unknown refused with what there is", () => {
  assert.equal(normalizeKinds("all"), "all");
  assert.equal(normalizeKinds(" * "), "all");
  assert.equal(normalizeKinds("none"), "none");
  assert.equal(normalizeKinds("Epidemic, war,war"), "war,epidemic", "sorted, once each, any case");
  assert.equal(normalizeKinds("all,-economy,-law"), "all,-law,-economy");
  assert.equal(normalizeKinds("-economy -law"), "all,-law,-economy", "the minus form read the same");
  assert.equal(normalizeKinds("war,epidemic,census,state,emigration,law,economy,disaster,other"), "all");
  for (const bad of ["válka", "war,bogus", "war,-law", "all,war", "war,none", ""]) assert.throws(() => normalizeKinds(bad), /kind|both|alone|no kind/u, bad);
  assert.deepEqual(kindsOf(undefined), kindsOf("all"));
  assert.deepEqual(kindsOf("nonsense"), kindsOf("all"), "a value not understood: what a research did before");
  assert.deepEqual(kindsOf("none"), []);
  assert.deepEqual(kindsOf("all,-law,-economy"), ["war", "epidemic", "census", "state", "emigration", "disaster", "other"]);
  // the menu writes the shorter: the kinds looked for, or all but the few left out
  assert.equal(kindsValue(["war", "epidemic"]), "war,epidemic");
  assert.equal(kindsValue(kindsOf("all,-law")), "all,-law");
  assert.equal(kindsValue([]), "none");
});

test("history.kinds: a research from before looks for every kind; a kind left out is anyone's, one added the person's alone; an unknown or decomposed one refused", opts, async () => {
  const w = await world();
  try {
    assert.equal((await w.ok(["config", "get", "history.kinds"])).out.trim(), "all");
    // the default: nothing refused for its kind (on to the page it lacks), nothing for align to do
    assert.match((await addRegion(w, "law")).err, /--url and --quote/u);
    const none = (await w.ok(["history", "align", "--json"])).json;
    assert.equal(none.applied, false);
    assert.deepEqual([none.hide.general.n, none.hide.local.n, none.show.n, none.backfill.length], [0, 0, 0, 0]);
    // a kind left out: anyone, also an agent; said that what was found stays until align
    const off = await w.ok(["config", "set", "history.kinds", "all,-law"], { env: AGENT });
    assert.match(off.out, /strom history align/u);
    // a kind added: the person's alone
    const add = await w.run(["config", "set", "history.kinds", "all"], { env: AGENT });
    assert.equal(add.code, 4, add.err);
    assert.equal((await w.ok(["config", "get", "history.kinds"])).out.trim(), "all,-law");
    // not understood: refused with the kinds there are — a kind written with an accent or decomposed too
    for (const bad of ["válka", "válka", "war,bogus"]) {
      const r = await w.run(["config", "set", "history.kinds", bad]);
      assert.equal(r.code, 2, bad);
      assert.match(r.err, /war, epidemic, census/u, bad);
    }
    await w.ok(["config", "set", "history.kinds", "all"], { tty: true, answers: ["a"] });
    assert.equal((await w.ok(["config", "get", "history.kinds"])).out.trim(), "all");
  } finally {
    w.cleanup();
  }
});

test("history.kinds: a kind off — history add and local refuse it before anything is read, the brief names only those looked for; none at all: no task of history", opts, async () => {
  const w = await world();
  try {
    await w.ok(["config", "set", "history.kinds", "all,-law,-economy"]);
    const r = await addRegion(w, "law");
    assert.notEqual(r.code, 0);
    assert.match(r.err, /events of the kind law are not looked for/u);
    assert.match(r.err, /only the person adds a kind/u);
    assert.match((await w.run(["history", "add", "--region", "cz-lhota", "--from", "1850", "--kind", "law", ...TEXTS, "--json"], { env: AGENT })).out, /history\.kindOff/u);
    assert.match((await addRegion(w, "war")).err, /--url and --quote/u, "a kind looked for goes on");
    // a local event (the research's own sources): this research's kinds, before the source is looked at
    const local = await w.run(["history", "local", "--source", "S0099", "--from", "1850", "--kind", "economy", "--text", "Neúroda"], { env: AGENT });
    assert.match(local.err, /events of the kind economy are not looked for in this research/u);
    assert.match((await w.run(["history", "local", "--source", "S0099", "--from", "1850", "--kind", "war", "--text", "Vojsko"], { env: AGENT })).err, /there is no source/u);
    // the region's brief: the kinds looked for and those not
    await w.ok(["frontier", "--apply"]);
    const region = (await tasks(w)).find((t) => t.origin === "history:region:cz-lhota" && t.state === "open")!;
    assert.ok(region, "the region's task");
    const brief = (await w.ok(["brief", region.id])).out;
    assert.match(brief, /- kinds: war, epidemic, census, state, emigration, disaster, other only — not looked for here: law, economy/u);
    // a reading session: the local events of the kinds looked for
    await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism"]);
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
    const link = (await tasks(w)).find((t) => t.what === "Křest Jana")!;
    assert.match((await w.ok(["brief", link.id])).out, /## Local events\n.*\n- kinds: [^\n]*not looked for here: law, economy/u);
    // none: no task of history raised, the brief of reading names no local events
    await w.ok(["config", "set", "history.kinds", "none"]);
    assert.doesNotMatch((await w.ok(["brief", link.id])).out, /## Local events/u);
    const v = new World();
    try {
      await v.withTree("Lhotákovi");
      await v.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
      await v.ok(["config", "set", "history.kinds", "none"]);
      await v.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
      await v.ok(["frontier", "--apply"]);
      assert.deepEqual((await tasks(v)).filter((t) => t.origin?.startsWith("history:")), [], "no kind looked for: no task of history");
    } finally {
      v.cleanup();
    }
  } finally {
    w.cleanup();
  }
});

test("history.kinds K1.5: a region's catalog looks for every kind a research on this computer sharing it wants — the write check and the brief alike", opts, async () => {
  const w = await world();
  try {
    await w.ok(["config", "set", "history.kinds", "all,-law,-economy"]);
    assert.match((await addRegion(w, "law")).err, /not looked for in the region cz-lhota by any research on this computer/u);
    // another research with Lhota in the region wants law (its own kinds): the region looks for it, this research does not
    await second(w, "all,-economy");
    assert.match((await addRegion(w, "law")).err, /--url and --quote/u, "wanted by a research sharing the region");
    assert.match((await addRegion(w, "economy")).err, /not looked for in the region/u, "wanted by none of them");
    await w.ok(["frontier", "--apply"]);
    const region = (await tasks(w)).find((t) => t.origin === "history:region:cz-lhota" && t.state === "open")!;
    assert.match((await w.ok(["brief", region.id])).out, /- kinds: war, epidemic, census, state, emigration, law, disaster, other only — not looked for here: economy/u);
  } finally {
    w.cleanup();
  }
});

test("history align: a preview without the person's yes (counts by kind, the regions' and the places' apart, the shared catalogs); hidden reversibly, pruned only with --prune-shared and only what no research wants", opts, async () => {
  const w = await world();
  try {
    writeEvents(w, [
      [1, 1848, "law"],
      [2, 1849, "economy"],
      [3, 1850, "war"],
      [4, 1852, "epidemic"],
    ]);
    await w.ok(["config", "set", "history.kinds", "all,-law,-economy"]);
    // no terminal, no --yes: what it would do, nothing changed
    const plan = (await w.ok(["history", "align", "--json"])).json;
    assert.equal(plan.applied, false);
    assert.deepEqual(plan.hide.general, { n: 2, kinds: { law: 1, economy: 1 }, events: ["cz-lhota-0001", "cz-lhota-0002"] });
    assert.equal(plan.hide.local.n, 0);
    assert.equal(plan.shared.n, 2, "no other research: nobody wants them");
    assert.equal(plan.shared.prune, false);
    const text = (await w.ok(["history", "align"])).out;
    assert.match(text, /Ke skrytí – události regionů: 2 \(zákon 1, hospodářství 1\)/u);
    assert.match(text, /smažou se jen s --prune-shared/u);
    assert.match(text, /Zatím se nic nezměnilo/u);
    assert.deepEqual(hidden(w), []);
    // an agent's --yes: refused (the person's alone, never in a window); nothing changed
    const agent = await w.run(["history", "align", "--yes"], { env: AGENT });
    assert.equal(agent.code, 4, agent.err);
    assert.deepEqual(hidden(w), []);
    // the person in a terminal: asked, a no changes nothing
    await w.ok(["history", "align"], { tty: true, answers: ["n"] });
    assert.deepEqual(hidden(w), []);
    const yes = await w.ok(["history", "align"], { tty: true, answers: ["a"] });
    assert.match(yes.out, /Dějiny srovnány: skryto 2/u);
    assert.deepEqual(hidden(w).map((h) => [h.event, h.by]), [["cz-lhota-0001", "align"], ["cz-lhota-0002", "align"]]);
    assert.ok(readJsonFile(catalogFile(w)).events.every((e: { retracted?: unknown }) => !e.retracted), "the shared catalog untouched");
    // again: nothing to hide
    assert.equal((await w.ok(["history", "align", "--json"])).json.hide.general.n, 0);
    // law looked for again: shown again by align (the person's yes: --yes in a terminal)
    await w.ok(["config", "set", "history.kinds", "all,-economy"], { tty: true, answers: ["a"] });
    const back = (await w.ok(["history", "align", "--json"])).json;
    assert.deepEqual(back.show, { n: 1, kinds: { law: 1 }, events: ["cz-lhota-0001"] });
    await w.ok(["history", "align", "--yes"], { tty: true });
    assert.deepEqual(hidden(w).map((h) => h.event), ["cz-lhota-0002"]);
    // another research wants law, none economy: --prune-shared deletes economy alone, restorable
    await second(w, "all,-economy");
    assert.deepEqual((await w.ok(["history", "align", "--json"])).json.shared.events, ["cz-lhota-0002"]);
    await w.ok(["config", "set", "history.kinds", "all,-law,-economy"]);
    const pruned = (await w.ok(["history", "align", "--yes", "--prune-shared", "--json"], { tty: true })).json;
    assert.deepEqual(pruned.done.pruned, ["cz-lhota-0002"], "law is wanted by the other research: kept in the catalog");
    const events = readJsonFile(catalogFile(w)).events as { id: string; retracted?: { by?: string } }[];
    assert.equal(events.find((e) => e.id === "cz-lhota-0002")!.retracted?.by, "person");
    assert.equal(events.find((e) => e.id === "cz-lhota-0001")!.retracted, undefined);
    assert.ok(hidden(w).some((h) => h.event === "cz-lhota-0001" && h.by === "align"), "hidden here all the same");
    await w.ok(["history", "restore", "cz-lhota-0002"], { tty: true, answers: ["a"] });
    assert.equal(readJsonFile(catalogFile(w)).events.find((e: { id: string }) => e.id === "cz-lhota-0002").retracted, undefined);
  } finally {
    w.cleanup();
  }
});

test("history align: a kind turned on is looked for only in the years looked through without it — one task of those kinds, never again once looked at; a catalog from before counts as every kind", opts, async () => {
  const w = await world();
  try {
    writeEvents(w, [[1, 1850, "war"]]);
    await w.ok(["config", "set", "history.kinds", "all,-law"]);
    await w.ok(["history", "done", "cz-lhota"]);
    const searched = readJsonFile(catalogFile(w)).searched;
    assert.equal(searched.length, 1);
    assert.ok(!searched[0].kinds.includes("law"), "looked through without law");
    // law turned on: one task of law alone, in the years looked through
    await w.ok(["config", "set", "history.kinds", "all"], { tty: true, answers: ["a"] });
    const plan = (await w.ok(["history", "align", "--json"])).json;
    assert.equal(plan.backfill.length, 1);
    assert.deepEqual(plan.backfill[0].kinds, ["law"]);
    assert.equal(plan.backfill[0].region, "cz-lhota");
    assert.equal(plan.sessions, 1);
    assert.match((await w.ok(["history", "align"])).out, /K dohledání tam, kde se dějiny prošly bez těchto druhů: úkolů 1 – asi 1 sezení agenta/u);
    const done = (await w.ok(["history", "align", "--yes", "--json"], { tty: true })).json;
    assert.equal(done.done.tasks.length, 1);
    const t = (await tasks(w)).find((x) => x.id === done.done.tasks[0])!;
    assert.equal(t.origin, "history:gaps:cz-lhota");
    assert.deepEqual(t.kinds, ["law"]);
    assert.deepEqual(t.where, plan.backfill[0].years);
    assert.match(t.what, /zákon/u);
    // its brief: those kinds alone, in those years
    const brief = (await w.ok(["brief", t.id])).out;
    assert.match(brief, /## The kinds law in the history of Lhotsko/u);
    // the task waiting: no second one
    assert.equal((await w.ok(["history", "align", "--json"])).json.backfill.length, 0);
    // looked at (its session closed): never again for law in those years
    await w.ok(["session", "start", t.id]);
    await w.ok(["session", "close", "--done", "nic", "--next", "nic"]);
    const gaps = readJsonFile(catalogFile(w)).gaps;
    assert.deepEqual(gaps.map((g: { kinds?: string[]; backfill?: boolean }) => [g.kinds, g.backfill]), [[["law"], true]]);
    assert.equal((await w.ok(["history", "align", "--json"])).json.backfill.length, 0, "years×kind looked at: not again");
    // a catalog finished before history.kinds (no kinds kept): every kind looked for, nothing to look for again
    const v = await world();
    try {
      writeEvents(v, [[1, 1850, "war"]], true);
      await v.ok(["config", "set", "history.kinds", "all,-law"]);
      await v.ok(["config", "set", "history.kinds", "all"], { tty: true, answers: ["a"] });
      assert.equal((await v.ok(["history", "align", "--json"])).json.backfill.length, 0);
    } finally {
      v.cleanup();
    }
  } finally {
    w.cleanup();
  }
});

test("the menu: the history's kinds, one number each — off for this computer's research, back on with the person's yes; align offered in a research", opts, async () => {
  const w = await world();
  try {
    const config = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
    // 8 settings · 2 working alone · 4 history · 2 kinds · 6 law off · 0 · 0 · 0 · 0 · 0 quit
    const r = await w.ok([], { tty: true, answers: ["8", "2", "4", "2", "6", "0", "0", "0", "0", "0"] });
    assert.match(r.out, / 2 {2}Druhy dějin: všechny\n/u);
    assert.match(r.out, / 3 {2}Srovnat dějiny s nastavením\n/u);
    assert.match(r.out, / 6 {2}zákon: zapnuto\n/u);
    assert.match(r.out, / 6 {2}zákon: vypnuto\n/u);
    assert.equal(config().historyKinds, "all,-law");
    await w.ok([], { tty: true, answers: ["8", "2", "4", "2", "6", "0", "0", "0", "0", "0"] });
    assert.equal(config().historyKinds, "all");
    // 3 align: what it would do, said in the research language (nothing to do here)
    const align = await w.ok([], { tty: true, answers: ["8", "2", "4", "3", "0", "0", "0", "0"] });
    assert.match(align.out, /Hledané druhy: všechny\nDějiny odpovídají hledaným druhům/u);
  } finally {
    w.cleanup();
  }
});
