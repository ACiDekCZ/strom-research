// What the ancestors lived through (experiments.history), its tasks: raised by strom while the experiment is on in a
// research — the places of the facts to map, each region of them to search — held while it is off, none in an archive;
// never offered in a conversation unless asked for; one tree builds a region at a time; strom run takes them now and then
// between the family research by the pace (experiments.historyPace), a region a session just worked at or the person
// asked for first, the others by their weight in the tree; the brief
// of such a session says what was found.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { rankTasks } from "../../src/core/queue.ts";
import { historyDue, historyTurn, regionOrder } from "../../src/core/pastevents.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const agent = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
const NAMES = ["--name-cs", "Lhotsko", "--name-en", "Lhota Land", "--name-de", "Lhotaland"];

async function world(on = true, name = "Lhotákovi"): Promise<World> {
  const w = new World();
  await w.withTree(name);
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1925", "--place", "Nová Lhota"]);
  if (on) await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
  return w;
}

async function tasks(w: World, cwd?: string): Promise<Task[]> {
  return (await w.ok(["task", "list", "--state", "all", "--full", "--json", "--limit", "500"], cwd ? { cwd } : {})).json.tasks;
}

const ofHistory = (ts: Task[]) => ts.filter((t) => t.origin.startsWith("history:"));

function catalogFile(w: World, id: string): string {
  return path.join(w.home, "shared", "history", "regions", `${id}.json`);
}

/** The research's own open tasks dropped: what the frontier made since leaves only the history's. */
async function dropOthers(w: World): Promise<void> {
  for (const t of (await tasks(w)).filter((x) => !x.origin.startsWith("history:") && x.state === "open")) await w.ok(["task", "drop", t.id, "--reason", "zkouška"]);
}

function treeId(dir: string): string {
  return readJsonFile(path.join(dir, "strom.json")).id;
}

test("history tasks: raised only while the experiment is on, once each; held while it is off and back when on; none in an archive", opts, async () => {
  const w = await world(false);
  try {
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual(ofHistory(await tasks(w)), [], "off: none");
    await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
    const said = await w.ok(["frontier", "--apply"]);
    assert.doesNotMatch(said.out, /history/i, "not said in a conversation");
    let hist = ofHistory(await tasks(w));
    assert.equal(hist.length, 1);
    const places = hist[0]!;
    assert.equal(places.origin, "history:places");
    assert.equal(places.level, "enrich");
    assert.equal(places.priority, 1);
    assert.deepEqual([...places.where].sort(), ["Lhota", "Nová Lhota"]);
    assert.match(places.what, /Místa údajů pro dějiny předků \(2\)/, "in the research language");
    // idempotent: never a second one open
    await w.ok(["frontier", "--apply"]);
    assert.equal(ofHistory(await tasks(w)).length, 1);
    // a region of its places: its task, once
    await w.ok(["history", "region", "cz-lhota", ...NAMES]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"]);
    await w.ok(["frontier", "--apply"]);
    await w.ok(["frontier", "--apply"]);
    hist = ofHistory(await tasks(w));
    assert.deepEqual(hist.map((t) => t.origin).sort(), ["history:places", "history:region:cz-lhota"]);
    assert.match(hist.find((t) => t.origin === "history:region:cz-lhota")!.what, /Události dějin v regionu Lhotsko/);
    // the places' task done, a place still unmapped it named: no new one; a new place: a new one
    const pt = hist.find((t) => t.origin === "history:places")!;
    await w.ok(["task", "done", pt.id, "--result", "Lhota zmapována"]);
    await w.ok(["frontier", "--apply"]);
    assert.equal(ofHistory(await tasks(w)).filter((t) => t.origin === "history:places" && t.state === "open").length, 0);
    await w.ok(["event", "add", "P0001", "BURI", "--date", "1925", "--place", "Lhota u Lhoty"]);
    await w.ok(["frontier", "--apply"]);
    const again = ofHistory(await tasks(w)).filter((t) => t.origin === "history:places" && t.state === "open");
    assert.equal(again.length, 1);
    assert.ok(again[0]!.where.includes("Lhota u Lhoty"));
    // on: asked for by name, the region's task is offered; off: held (still open), back when on again
    const before = (await w.ok(["task", "next", "--history", "--json"])).json.task;
    assert.ok(before, "offered when asked for");
    await w.ok(["config", "set", "experiments.history", "off"]);
    for (const t of ofHistory(await tasks(w)).filter((x) => x.state !== "done")) assert.equal(t.state, "open", "kept as they are");
    const off = await w.ok(["task", "list", "--json", "--limit", "500"]);
    assert.ok(!off.json.tasks.some((t: { what: string }) => /dějin|Místa údajů/.test(t.what)));
    assert.ok(!ofHistory([(await w.ok(["task", "next", "--history", "--json"])).json.task].filter(Boolean)).length, "off: held");
    await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
    assert.ok(ofHistory([(await w.ok(["task", "next", "--history", "--level", "enrich", "--json"])).json.task].filter(Boolean)).length, "on again: back");
  } finally {
    w.cleanup();
  }
  // an archive: none made, none offered
  const a = await world(true, "Lhotákovi archiv");
  try {
    await a.ok(["mode", "archive"], { tty: true, answers: ["a"] });
    await a.run(["frontier", "--apply"]);
    assert.deepEqual(ofHistory(await tasks(a)), [], "an archive: none");
  } finally {
    a.cleanup();
  }
});

test("history tasks: the places to map before all the research where asked (strom run) — and never offered in a conversation unless asked", opts, async () => {
  const w = await world();
  try {
    await w.ok(["frontier", "--apply"]);
    await w.ok(["task", "add", "Text o Lhotákovi", "--level", "narrate", "--where", "P1", "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "1"]);
    await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism"]);
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", "1"]);
    const all = await tasks(w);
    const hist = ofHistory(all);
    assert.equal(hist.length, 1);
    // a conversation: the queue and the next task never name them
    const list = (await w.ok(["task", "list", "--json", "--limit", "500"])).json.tasks as { id: string }[];
    assert.ok(!list.some((t) => t.id === hist[0]!.id));
    assert.notEqual((await w.ok(["task", "next", "--json"])).json.task?.id, hist[0]!.id);
    // asked for (strom run, task next --history): the places to map first of all — a small step the regions need
    const tree = Tree.open(w.cwd, w.env);
    const ranked = rankTasks(tree, tree.list<Task>("task"), "balanced", { history: true });
    assert.equal(ranked[0]!.task.id, hist[0]!.id, ranked.map((r) => `${r.task.id} ${r.why}`).join("\n"));
    assert.match(ranked[0]!.why, /places of the facts to map: before the research whatever the pace/);
    assert.ok(ranked.some((r) => r.task.level === "narrate") && ranked.some((r) => r.task.level === "link"));
    assert.ok(!rankTasks(tree, tree.list<Task>("task"), "balanced").some((r) => r.task.id === hist[0]!.id), "not unless asked");
    // the rest dropped: then it is the one
    for (const t of all.filter((x) => !x.origin.startsWith("history:") && x.state === "open")) await w.ok(["task", "drop", t.id, "--reason", "zkouška"]);
    assert.equal((await w.ok(["task", "next", "--json"])).json.task, null, "a conversation: none");
    assert.equal((await w.ok(["task", "next", "--history", "--json"])).json.task.id, hist[0]!.id);
    // nothing of it in help or the catalog of commands
    assert.doesNotMatch((await w.ok(["help", "task", "next"])).out, /--history/);
    for (const out of [(await w.ok(["commands", "--json"])).out, (await w.ok(["guide"])).out]) assert.doesNotMatch(out, /tasks of history|history:places|history:region/);
  } finally {
    w.cleanup();
  }
});

test("history tasks: one tree builds a region — another's task waits until it is finished or 7 days pass; finished, theirs is done too", opts, async () => {
  const w = await world();
  const a = w.cwd;
  try {
    await w.ok(["history", "region", "cz-lhota", ...NAMES]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota"]);
    await w.ok(["history", "map", "Nová Lhota", "--region", "cz-lhota"]);
    await w.ok(["frontier", "--apply"]);
    const ra = ofHistory(await tasks(w)).find((t) => t.origin === "history:region:cz-lhota")!;
    // a second research on this computer, its place in the same region
    await w.ok(["init", "Lhotákovi z Lhoty"]);
    const b = w.treeDir("Lhotákovi z Lhoty");
    w.cwd = b;
    await w.ok(["research", "new", "Předci Marie Lhotákové", "--new-person", "Marie /Lhotáková/", "--sex", "F", "--born", "1860", "--born-place", "Lhota"]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota"]);
    await w.ok(["frontier", "--apply"]);
    const rb = ofHistory(await tasks(w)).find((t) => t.origin === "history:region:cz-lhota")!;
    await dropOthers(w);
    assert.equal((await w.ok(["task", "next", "--history", "--json"])).json.task.id, rb.id, "free: offered");
    // the first tree takes the region (its session on it)
    w.cwd = a;
    await w.ok(["session", "start", ra.id]);
    assert.equal(readJsonFile(catalogFile(w, "cz-lhota")).holder.tree, treeId(a));
    // the other tree's task waits out of the queue; started by its ID, the agent hears why
    w.cwd = b;
    assert.equal((await w.ok(["task", "next", "--history", "--json"])).json.task, null, "held by the first tree");
    const started = await w.ok(["session", "start", rb.id]);
    assert.match(started.out, /another research on this computer builds the catalog of cz-lhota/);
    assert.equal(readJsonFile(catalogFile(w, "cz-lhota")).holder.tree, treeId(a), "never taken from the other tree");
    await w.ok(["session", "close", "--continue", "--summary", "drženo", "--next", "později"]);
    await dropOthers(w);
    // 7 days on: free to be taken
    const c = readJsonFile(catalogFile(w, "cz-lhota"));
    const since = c.holder.since;
    c.holder.since = new Date(Date.now() - 8 * 86_400_000).toISOString();
    fs.writeFileSync(catalogFile(w, "cz-lhota"), JSON.stringify(c));
    assert.equal((await w.ok(["task", "next", "--history", "--json"])).json.task.id, rb.id, "after 7 days");
    c.holder.since = since;
    fs.writeFileSync(catalogFile(w, "cz-lhota"), JSON.stringify(c));
    assert.equal((await w.ok(["task", "next", "--history", "--json"])).json.task, null);
    // the first tree finishes: the holder goes, its task done with the catalog; the other's done by itself
    w.cwd = a;
    await w.ok(["history", "done", "cz-lhota"]);
    await w.ok(["session", "close", "--done", "události nalezené", "--next", "nic"]);
    const done = readJsonFile(catalogFile(w, "cz-lhota"));
    assert.ok(done.done && !done.holder);
    assert.equal((await tasks(w)).find((t) => t.id === ra.id)!.state, "done");
    w.cwd = b;
    await w.ok(["frontier", "--apply"]);
    assert.equal((await tasks(w)).find((t) => t.id === rb.id)!.state, "done", "finished by the other tree");
    // a region's task done by session close: its catalog finished too (asked again: the person's redo)
    await w.ok(["history", "redo", "cz-lhota"]);
    await w.ok(["frontier", "--apply"]);
    const next = ofHistory(await tasks(w)).find((t) => t.origin === "history:region:cz-lhota" && t.state === "open")!;
    assert.ok(next, "asked again: a new task");
    await w.ok(["session", "start", next.id]);
    await w.ok(["session", "close", "--done", "hotovo", "--next", "nic"]);
    assert.ok(readJsonFile(catalogFile(w, "cz-lhota")).done, "finished with its task");
  } finally {
    w.cleanup();
  }
});

test("history tasks: the pace — sometimes about every 5th session (3–7), rare about every 10th (6–14), by the tree and the last session of history", () => {
  for (const [every, lo, hi] of [
    [5, 3, 7],
    [10, 6, 14],
  ] as const) {
    const due = Array.from({ length: 400 }, (_, i) => historyDue(every, `tree-${i}:first`));
    assert.ok(due.every((d) => d >= lo && d <= hi), `${every}: ${Math.min(...due)}–${Math.max(...due)}`);
    assert.equal(new Set(due).size, hi - lo + 1, "every value of the spread comes up");
    const mean = due.reduce((a, b) => a + b, 0) / due.length;
    assert.ok(Math.abs(mean - every) < 0.5, `${every}: mean ${mean}`);
    assert.equal(historyDue(every, "tree-1:S0042"), historyDue(every, "tree-1:S0042"), "the same seed, the same turn");
  }
});

test("history tasks: strom run takes them between the family research by the pace — the turn strom plan says; idle only when nothing else is left; never a stop for the day", opts, async () => {
  const w = await world();
  try {
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "idle" });
    // the places mapped: a region's task alone (the places go first whatever the pace — the test below)
    await w.ok(["history", "region", "cz-lhota", ...NAMES]);
    for (const p of ["Lhota", "Nová Lhota"]) await w.ok(["history", "map", p, "--region", "cz-lhota:1800-"]);
    await w.ok(["frontier", "--apply"]);
    await dropOthers(w);
    assert.deepEqual(ofHistory(await tasks(w)).map((t) => t.origin), ["history:region:cz-lhota"]);
    for (let i = 1; i <= 10; i++) await w.ok(["task", "add", `Matrika Lhota ${i}`, "--level", "locate", "--where", `Lhota ${i}`, "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "2"]);
    const history = new Set(ofHistory(await tasks(w)).map((t) => t.id));
    const due = historyDue(5, `${treeId(w.cwd)}:first`);
    // strom plan says when (the default pace: sometimes)
    const plan = await w.ok(["plan", "--json"]);
    assert.equal(plan.json.history.pace, "sometimes");
    assert.equal(plan.json.history.in, due - 1);
    assert.match((await w.ok(["plan"])).out, new RegExp(`Dějiny míst: .* – za ~${due - 1} sezení\\.`, "u"));
    // up to its turn only: a second turn of the idle test agent would put the region aside as stuck
    const r = await w.ok(["run", "--agent", "script", "--loop", "--max", String(due), "--json"]);
    const order = (r.json.sessions as { task: string }[]).map((s) => history.has(s.task));
    assert.equal(order.indexOf(true) + 1, due, `${due}: ${order.join(",")}\n${r.err}`);
    assert.ok(order.slice(0, due - 1).every((h) => !h), "the family research first");
    assert.notEqual(r.json.stop, "history", "no stop for the day");
    // idle: none while the family research has work, then taken
    await w.ok(["config", "set", "experiments.historyPace", "idle"]);
    assert.match((await w.ok(["plan"])).out, /Dějiny míst: .* – až rodinný výzkum nebude mít co dělat\./u);
    const idle = await w.ok(["run", "--agent", "script", "--loop", "--max", "6", "--json"]);
    assert.equal((idle.json.sessions as { task: string }[]).filter((s) => history.has(s.task)).length, 0, idle.err);
    await dropOthers(w);
    for (const t of (await tasks(w)).filter((x) => !history.has(x.id) && x.state === "doing")) await w.ok(["task", "drop", t.id, "--reason", "zkouška"]);
    const last = await w.ok(["run", "--agent", "script", "--loop", "--max", "1", "--json"]);
    assert.ok(history.has(last.json.sessions[0].task), last.err);
  } finally {
    w.cleanup();
  }
});

test("history tasks: the places to map go first right after it is turned on and whenever a new place comes — whatever the pace; the regions wait for their turn", opts, async () => {
  const w = await world();
  try {
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "idle" });
    await w.ok(["config", "set", "experiments.historyPace", "rare"]);
    await w.ok(["frontier", "--apply"]);
    await dropOthers(w);
    for (let i = 1; i <= 6; i++) await w.ok(["task", "add", `Matrika Lhota ${i}`, "--level", "locate", "--where", `Lhota ${i}`, "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "2"]);
    const places = ofHistory(await tasks(w)).find((t) => t.origin === "history:places")!;
    assert.ok(places);
    assert.match((await w.ok(["plan"])).out, /Dějiny míst: .* – příští sezení – nejdřív zmapovat místa\./u);
    assert.match((await w.ok(["history", "status"])).out, new RegExp(`the next session, the places to map first \\(${places.id}\\)`, "u"));
    // the next session, though the pace is rare and the family research has work
    const first = await w.ok(["run", "--agent", "script", "--loop", "--max", "1", "--json"]);
    assert.equal(first.json.sessions[0].task, places.id, first.err);
    // mapped (a region now), done: the region waits for its turn — the family research meanwhile
    await w.ok(["history", "region", "cz-lhota", ...NAMES]);
    for (const p of ["Lhota", "Nová Lhota"]) await w.ok(["history", "map", p, "--region", "cz-lhota:1800-"]);
    await w.ok(["task", "done", places.id, "--result", "zmapováno"]);
    await w.ok(["frontier", "--apply"]);
    await dropOthers(w);
    for (let i = 7; i <= 12; i++) await w.ok(["task", "add", `Matrika Lhota ${i}`, "--level", "locate", "--where", `Lhota ${i}`, "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "2"]);
    const region = ofHistory(await tasks(w)).find((t) => t.origin === "history:region:cz-lhota")!;
    assert.ok(region);
    const due = historyDue(10, `${treeId(w.cwd)}:first`);
    assert.ok(due >= 6);
    const next = await w.ok(["run", "--agent", "script", "--loop", "--max", "2", "--json"]);
    assert.ok(!(next.json.sessions as { task: string }[]).some((s) => s.task === region.id), next.err);
    // a new place of the facts: its mapping first again, the region still waits
    await w.ok(["event", "add", "P0001", "BURI", "--date", "1925", "--place", "Lhota u Lhoty"]);
    await w.ok(["frontier", "--apply"]);
    const again = ofHistory(await tasks(w)).find((t) => t.origin === "history:places" && t.state === "open")!;
    assert.ok(again && again.id !== places.id);
    const r = await w.ok(["run", "--agent", "script", "--loop", "--max", "1", "--json"]);
    assert.equal(r.json.sessions[0].task, again.id, r.err);
  } finally {
    w.cleanup();
  }
});

test("history tasks: a region a recent session worked at without a catalog goes first — said by strom plan and strom history status, with the open tasks and their IDs", opts, async () => {
  const w = await world();
  try {
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "idle" });
    // none yet: one line saying when they come
    const none = await w.ok(["history", "status"]);
    assert.match(none.out, /no tasks of history yet: strom raises them when the next session of the research ends/);
    await w.ok(["history", "region", "cz-lhota", ...NAMES]);
    await w.ok(["history", "region", "cz-nova", "--name-cs", "Novolhotsko", "--name-en", "New Lhota Land", "--name-de", "Neulhotaland"]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"]);
    await w.ok(["history", "map", "Nová Lhota", "--region", "cz-nova:1800-"]);
    await w.ok(["frontier", "--apply"]);
    await dropOthers(w);
    const hist = ofHistory(await tasks(w));
    const nova = hist.find((t) => t.origin === "history:region:cz-nova")!;
    const lhota = hist.find((t) => t.origin === "history:region:cz-lhota")!;
    assert.ok(nova && lhota);
    await w.ok(["task", "add", "Matrika Lhota", "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "2"]);
    await w.ok(["run", "--agent", "script", "--loop", "--max", "1"]);
    const tree = () => Tree.open(w.cwd, w.env);
    const shared = path.join(w.home, "shared");
    assert.equal(historyTurn(tree(), shared).prefer, undefined, "nothing worked at since");
    // what a session wrote: a person born in Nová Lhota (its region has no catalog yet)
    await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]);
    await w.ok(["event", "add", "P0002", "BIRT", "--date", "1855", "--place", "Nová Lhota"]);
    const turn = historyTurn(tree(), shared);
    assert.deepEqual(turn.prefer, { task: nova.id, place: "Nová Lhota", region: "cz-nova" });
    const t = tree();
    const ranked = rankTasks(t, t.list<Task>("task"), "balanced", { history: true, turn: { ...turn, now: true } });
    assert.equal(ranked[0]!.task.id, nova.id, ranked.map((x) => `${x.task.id} ${x.why}`).join("\n"));
    assert.match(ranked[0]!.why, /Nová Lhota/);
    assert.match((await w.ok(["plan"])).out, /přednost: místo Nová Lhota z nedávného sezení/u);
    const status = await w.ok(["history", "status"]);
    assert.match(status.out, /tasks of history in the order strom run takes them, one a turn \(strom run --task <T…> starts one now\):/);
    for (const x of hist) assert.match(status.out, new RegExp(`${x.id}\\b`, "u"));
    assert.match(status.out, new RegExp(`first: ${nova.id} \\(a recent session worked at Nová Lhota\\)`, "u"));
    const json = (await w.ok(["history", "status", "--json"])).json;
    assert.deepEqual(json.tasks.map((x: { id: string }) => x.id).sort(), hist.map((x) => x.id).sort());
    assert.equal(json.turn.prefer.task, nova.id);
    // its catalog finished: no longer first
    await w.ok(["history", "done", "cz-nova"]);
    assert.equal(historyTurn(tree(), shared).prefer, undefined);
  } finally {
    w.cleanup();
  }
});

test("history tasks: turned on late in a large tree — the regions by their weight: the most people first, a land before the state above it, a region of one person last; one a turn, never all at once; the person's word first", opts, async () => {
  const w = await world();
  try {
    // Lhota and Nová Lhota (Lhotsko): Jan (1850, 1925), Marie and Josef; Podlesí: Anna and Karel; Lhotečky: Ivo
    // alone. The state held all three lands until 1918: the most people, yet after its lands.
    const born = async (name: string, sex: string, year: string, place: string) => {
      const id = (await w.ok(["person", "add", name, "--sex", sex, "--json"])).json.person.id;
      await w.ok(["event", "add", id, "BIRT", "--date", year, "--place", place]);
    };
    await born("Marie /Lhotáková/", "F", "1852", "Lhota");
    await born("Josef /Lhoták/", "M", "1860", "Nová Lhota");
    await born("Anna /Lhotská/", "F", "1855", "Podlesí");
    await born("Karel /Lhotáček/", "M", "1857", "Podlesí");
    await born("Ivo /Lhotečný/", "M", "1870", "Lhotečky");
    const region = (id: string, cs: string) => w.ok(["history", "region", id, "--name-cs", cs, "--name-en", cs, "--name-de", cs]);
    await region("cz-lhotsko", "Lhotsko");
    await region("cz-podlesi", "Podlesí");
    await region("cz-samota", "Lhotečsko");
    await region("cz-stat", "Velkolhotsko");
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhotsko:1800-", "--region", "cz-stat:1800-1918"]);
    await w.ok(["history", "map", "Nová Lhota", "--region", "cz-lhotsko:1800-", "--region", "cz-stat:1800-1918"]);
    await w.ok(["history", "map", "Podlesí", "--region", "cz-podlesi:1800-", "--region", "cz-stat:1800-1918"]);
    await w.ok(["history", "map", "Lhotečky", "--region", "cz-samota:1800-", "--region", "cz-stat:1800-1918"]);
    await w.ok(["frontier", "--apply"]);
    const tree = () => Tree.open(w.cwd, w.env);
    const shared = path.join(w.home, "shared");
    const order = regionOrder(tree(), shared);
    assert.deepEqual(
      order.map((x) => [x.id, x.persons]),
      [
        ["cz-lhotsko", 3],
        ["cz-podlesi", 2],
        ["cz-stat", 6],
        ["cz-samota", 1],
      ],
      "Jan's death in 1925 is after the state: counted for Lhotsko only",
    );
    const hist = ofHistory(await tasks(w));
    const of = (id: string) => hist.find((t) => t.origin === `history:region:${id}`)!;
    assert.equal(hist.filter((t) => t.origin.startsWith("history:region:")).length, 4);
    // one a turn: at the turn the heaviest region before the family research, the others after it
    const t = tree();
    const turn = historyTurn(t, shared);
    assert.deepEqual(turn.order?.map((x) => x.id), ["cz-lhotsko", "cz-podlesi", "cz-stat", "cz-samota"]);
    await w.ok(["task", "add", "Matrika Lhota", "--level", "locate", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "2"]);
    const all = tree().list<Task>("task");
    const ranked = rankTasks(tree(), all, "balanced", { history: true, turn: { ...turn, now: true } }).map((x) => x.task);
    assert.equal(ranked[0]!.id, of("cz-lhotsko").id);
    assert.ok(!ranked[1]!.origin?.startsWith("history:"), "the next one is the family research's, not another region");
    const later = ranked.filter((x) => x.origin?.startsWith("history:region:")).map((x) => x.origin);
    assert.deepEqual(later, ["cz-lhotsko", "cz-podlesi", "cz-stat", "cz-samota"].map((x) => `history:region:${x}`));
    const away = rankTasks(tree(), all, "balanced", { history: true, turn: { ...turn, now: false } }).map((x) => x.task);
    assert.ok(!away[0]!.origin?.startsWith("history:"), "not its turn: none first");
    // strom plan and strom history status say the order
    assert.match((await w.ok(["plan"])).out, /Regiony na řadě, po jednom: Lhotsko 1845–1930 \(osob: 3\) · Podlesí 1850–1862 \(osob: 2\) · Velkolhotsko 1845–1875 \(osob: 6\) · Lhotečsko 1865–1875 \(osob: 1\)/u);
    const status = await w.ok(["history", "status"]);
    const at = (id: string) => status.out.indexOf(`history:region:${id}`);
    assert.ok(at("cz-lhotsko") < at("cz-podlesi") && at("cz-podlesi") < at("cz-stat") && at("cz-stat") < at("cz-samota"), status.out);
    assert.match(status.out, new RegExp(`1\\.\\s+${of("cz-lhotsko").id}\\s+history:region:cz-lhotsko\\s+open\\s+3 people, 4 facts`, "u"));
    const json = (await w.ok(["history", "status", "--json"])).json;
    assert.deepEqual(json.tasks.filter((x: { weight?: unknown }) => x.weight).map((x: { weight: { id: string } }) => x.weight.id), ["cz-lhotsko", "cz-podlesi", "cz-stat", "cz-samota"]);
    // the person's word (the app's person card): that region first of them, still at the turn
    await w.ok(["history", "first", "cz-samota"]);
    const asked = historyTurn(tree(), shared);
    assert.deepEqual([asked.asked?.task, asked.asked?.region], [of("cz-samota").id, "cz-samota"]);
    const firstNow = rankTasks(tree(), tree().list<Task>("task"), "balanced", { history: true, turn: { ...asked, now: true } }).map((x) => x.task);
    assert.equal(firstNow[0]!.id, of("cz-samota").id);
    assert.match((await w.ok(["plan"])).out, /přednost: Lhotečsko, na přání/u);
    // an agent never asks it: the person's
    const agentRun = await w.run(["history", "first", "cz-podlesi"], { env: { ...w.env, STROM_IN_AGENT: "1" } });
    assert.notEqual(agentRun.code, 0);
    assert.match(agentRun.err + agentRun.out, /Look for the history of this region first\?/, "refused as the person's");
    const none = await w.run(["history", "first", "cz-nikde"]);
    assert.notEqual(none.code, 0);
    assert.match(none.err, /no place of the tree belongs to the region cz-nikde/);
    // the lands finished, their catalogs holding the state's events: the state comes last, its brief says what they
    // have, and the same event of both is at the place once — the land's
    const write = (id: string, events: [n: number, year: number, kind: string, text: string][]) => {
      const file = catalogFile(w, id);
      const c = readJsonFile(file);
      const source = { title: "Dějiny", url: "https://example.org/dejiny", checked: "2026-10-01", quote: "1866", sha: "0".repeat(64) };
      c.events = events.map(([n, from, kind, text]) => ({ id: `${id}-${String(n).padStart(4, "0")}`, from, to: from, kind, text: { cs: text, en: text, de: text }, source, by: "x", at: "2026-10-01T00:00:00Z" }));
      c.next = events.length + 1;
      fs.writeFileSync(file, JSON.stringify(c));
    };
    write("cz-lhotsko", [[1, 1866, "war", "Válka ve Lhotsku"], [2, 1880, "census", "Sčítání"]]);
    write("cz-stat", [[1, 1866, "war", "Válka státu"], [2, 1848, "law", "Zrušení roboty"]]);
    for (const id of ["cz-lhotsko", "cz-podlesi"]) await w.ok(["history", "done", id]);
    assert.equal(regionOrder(tree(), shared).find((x) => x.id === "cz-stat")?.covered, undefined, "Lhotečky not held yet");
    await w.ok(["history", "done", "cz-samota"]);
    const late = regionOrder(tree(), shared);
    assert.deepEqual(late.map((x) => x.id), ["cz-lhotsko", "cz-podlesi", "cz-samota", "cz-stat"]);
    assert.deepEqual(late.at(-1)!.covered, ["cz-lhotsko", "cz-podlesi", "cz-samota"]);
    const brief = (await w.ok(["brief", of("cz-stat").id])).out;
    assert.match(brief, /## Found already for the same places and years: cz-lhotsko, cz-podlesi, cz-samota \(finished, 2 events\)/);
    assert.match(brief, /they lack nothing worth writing: strom history done cz-stat at once/);
    assert.match(brief, /cz-lhotsko-0001 1866 war/);
    const app = (await w.ok(["history", "status", "--app", "--json"])).json;
    assert.deepEqual(app.places["Lhota"].events.sort(), ["cz-lhotsko-0001", "cz-lhotsko-0002", "cz-stat-0002"], "the state's war of 1866 is the land's");
    assert.deepEqual(app.places["Podlesí"].events.sort(), ["cz-stat-0001", "cz-stat-0002"], "no land event there: the state's own");
  } finally {
    w.cleanup();
  }
});

test("history tasks: how often — asked when the person turns it on in the terminal (Enter: sometimes), never elsewhere; more often only by the person, a tree only less often", opts, async () => {
  const w = await world(false);
  const cfg = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  try {
    const on = await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["2"] });
    assert.match(on.out, /Jak často hledat události dějin, když agent pracuje sám\?/u);
    assert.match(on.out, /občas – zhruba každé 5\. sezení \(výchozí\)/u);
    assert.match(on.out, /strom config set experiments\.historyPace sometimes\|rare\|idle/);
    assert.equal(cfg().experimentsHistory, "on");
    assert.equal(cfg().experimentsHistoryPace, "rare");
    // off and on again: the pace chosen stays, nothing asked
    await w.ok(["config", "set", "experiments.history", "off"]);
    const again = await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: [] });
    assert.doesNotMatch(again.out, /Jak často/u);
    assert.equal(cfg().experimentsHistoryPace, "rare");
    // more often: the person's (no terminal: a consent asked of them); less often: anyone's
    const agentEnv = { STROM_NO_DIALOG: "1", CLAUDECODE: "1" };
    const oftener = await w.run(["config", "set", "experiments.historyPace", "sometimes"], { env: agentEnv });
    assert.notEqual(oftener.code, 0);
    assert.match(oftener.out + oftener.err, /consent|souhlas/iu);
    assert.equal(cfg().experimentsHistoryPace, "rare");
    await w.ok(["config", "set", "experiments.historyPace", "idle"], { env: agentEnv });
    assert.equal(cfg().experimentsHistoryPace, "idle");
    await w.ok(["config", "set", "experiments.historyPace", "sometimes"], { tty: true, answers: [] });
    assert.equal(cfg().experimentsHistoryPace, "sometimes");
    // a tree: only less often than the person's
    await w.ok(["config", "set", "experiments.historyPace", "rare", "--for-tree"]);
    assert.equal(readJsonFile(path.join(w.cwd, "strom.json")).experimentsHistoryPace, "rare");
    assert.equal((await w.ok(["config", "get", "experiments.historyPace"])).out.trim(), "rare");
    await w.ok(["config", "set", "experiments.historyPace", "rare"], { tty: true, answers: [] });
    const more = await w.run(["config", "set", "experiments.historyPace", "sometimes", "--for-tree"]);
    assert.equal(more.code, 2, more.err);
    assert.match(more.err, /less often/);
  } finally {
    w.cleanup();
  }
  // turned on with nobody at a terminal (a window said yes): nothing asked, the default
  const x = await world(false, "Lhotákovi okno");
  try {
    const r = await x.ok(["config", "set", "experiments.history", "on"], { env: { CLAUDECODE: "1" }, dialog: true });
    assert.doesNotMatch(r.out, /Jak často/u);
    const c = readJsonFile(path.join(x.env.STROM_CONFIG_DIR!, "config.json"));
    assert.equal(c.experimentsHistory, "on");
    assert.equal(c.experimentsHistoryPace, undefined, "the default: sometimes");
    assert.equal((await x.ok(["config", "get", "experiments.historyPace"])).out.trim(), "sometimes");
  } finally {
    x.cleanup();
  }
});

test("history tasks: the brief of a region's session — its period, the events written with those taken back and hidden, the commands; a reading session names local events only while on", opts, async () => {
  const w = await world();
  try {
    await w.ok(["history", "region", "cz-lhota", ...NAMES]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"]);
    const file = catalogFile(w, "cz-lhota");
    const c = readJsonFile(file);
    const source = { title: "Dějiny Lhoty", url: "https://example.org/lhota", checked: "2026-10-01", quote: "1866", sha: "0".repeat(64) };
    const ev = (n: number, from: number, kind: string, text: string, more = {}) => ({ id: `cz-lhota-000${n}`, from, to: from, kind, text: { cs: text, en: text, de: text }, source, by: "x", at: "2026-10-01T00:00:00Z", ...more });
    c.events = [ev(1, 1866, "epidemic", "Cholera ve Lhotě"), ev(2, 1921, "census", "Sčítání lidu"), ev(3, 1867, "epidemic", "Cholera znovu", { retracted: { at: "2026-10-02T00:00:00Z", why: "duplicate" } })];
    c.next = 4;
    fs.writeFileSync(file, JSON.stringify(c));
    await w.ok(["history", "hide", "cz-lhota-0001", "--place", "Lhota"]);
    await w.ok(["frontier", "--apply"]);
    const region = ofHistory(await tasks(w)).find((t) => t.origin === "history:region:cz-lhota")!;
    const brief = (await w.ok(["brief", region.id])).out;
    assert.match(brief, /## The history of Lhotsko \(cz-lhota\)/);
    assert.match(brief, /period: 1845–1855 — the years this tree's people lived at its places: their facts there, 5 years before and after, to this year only when the facts reach the last 30 years; look for events of these years alone/);
    assert.match(brief, /cz-lhota-0001 1866 epidemic "Cholera ve Lhotě" \[hidden here 1×\]/);
    assert.match(brief, /cz-lhota-0003 1867 epidemic "Cholera znovu" \[taken back: duplicate\]/);
    assert.match(brief, /by kind: epidemic 1/);
    assert.match(brief, /strom history add --region <id>/);
    assert.match(brief, /--same-as/);
    assert.match(brief, /strom history done cz-lhota/);
    assert.match(brief, /never ask the person, never strom allow/);
    assert.doesNotMatch(brief, /## Method/i);
    // the places' session: the places waiting and how to map them
    const places = ofHistory(await tasks(w)).find((t) => t.origin === "history:places")!;
    const pb = (await w.ok(["brief", places.id])).out;
    assert.match(pb, /"Nová Lhota" — facts 1925/);
    assert.match(pb, /a wrong region is worse than none/);
    assert.match(pb, /strom history map <place>/);
    assert.match(pb, /cz-lhota — Lhotsko \/ Lhota Land \/ Lhotaland/);
    // a reading session: one short section while on, nothing while off
    await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism"]);
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
    const link = (await tasks(w)).find((t) => t.what === "Křest Jana")!;
    assert.match((await w.ok(["brief", link.id])).out, /## Local events\n.*\n {2}strom history local/);
    await w.ok(["config", "set", "experiments.history", "off"]);
    assert.doesNotMatch((await w.ok(["brief", link.id])).out, /history local/);
  } finally {
    w.cleanup();
  }
});

test("history tasks: strom run --history takes them alone, in their order whatever the pace — the family research waits; strom plan says how many are left", opts, async () => {
  const w = await world();
  try {
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "idle" });
    await w.ok(["history", "region", "cz-lhota", ...NAMES]);
    for (const p of ["Lhota", "Nová Lhota"]) await w.ok(["history", "map", p, "--region", "cz-lhota:1800-"]);
    await w.ok(["frontier", "--apply"]);
    await dropOthers(w);
    for (let i = 1; i <= 3; i++) await w.ok(["task", "add", `Matrika Lhota ${i}`, "--level", "locate", "--where", `Lhota ${i}`, "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "1"]);
    const region = ofHistory(await tasks(w)).find((t) => t.origin === "history:region:cz-lhota")!;
    // idle: plain strom run never takes it while the family research has work; --history takes it at once
    await w.ok(["config", "set", "experiments.historyPace", "idle"]);
    const plan = await w.ok(["plan", "--json"]);
    assert.equal(plan.json.history.left, 1);
    assert.match((await w.ok(["plan"])).out, /Úkolů dějin zbývá: 1 \(všechny napřed: strom run --history\)/u);
    // the menu: the way last, how many asked (0 goes back: nothing runs)
    const menu = await w.ok([], { tty: true, env: { STROM_AGENT: "script" }, answers: ["2", "3", "0", "0"] });
    assert.match(menu.out, / 3 {2}Hledat dějiny teď \(1 úkol dějin\)/u, menu.out);
    assert.match(menu.out, /Kolik úkolů dějin\? \(0 zpět\)/u);
    assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0001.json")), "nothing ran");
    const r = await w.ok(["run", "--agent", "script", "--history", "--json"]);
    assert.deepEqual((r.json.sessions as { task: string }[]).map((s) => s.task), [region.id], r.err);
    // like task next --history: nothing of it in help (an experiment)
    assert.doesNotMatch((await w.ok(["help", "run"])).out, /--history/);
    // not with --task or --research; not while it is off
    const both = await w.run(["run", "--agent", "script", "--history", "--task", region.id, "--json"]);
    assert.equal(both.code, 2);
    assert.equal(both.json.code, "run.history");
    // none left: said, the family research untouched
    await w.ok(["task", "drop", region.id, "--reason", "zkouška"]);
    const none = await w.ok(["run", "--agent", "script", "--history", "--max", "3", "--json"]);
    assert.deepEqual(none.json.sessions, []);
    assert.equal(none.json.stop, "empty");
    assert.equal(none.json.stopped, "žádné úkoly dějin nezbývají");
    assert.equal((await tasks(w)).filter((t) => /^Matrika Lhota/.test(t.what) && t.state === "open").length, 3);
    await w.ok(["config", "set", "experiments.history", "off"]);
    const off = await w.run(["run", "--agent", "script", "--history", "--json"]);
    assert.notEqual(off.code, 0);
    assert.equal(off.json.code, "history.off");
  } finally {
    w.cleanup();
  }
});
