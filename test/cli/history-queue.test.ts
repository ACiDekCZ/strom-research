// What the ancestors lived through (experiments.history), its tasks: raised by strom while the experiment is on in a
// research — the places of the facts to map, each region of them to search — held while it is off, none in an archive;
// after everything in the queue and never offered in a conversation unless asked for; one tree builds a region at a
// time; without a gate strom run gives them one session a day; the brief of such a session says what was found.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { rankTasks } from "../../src/core/queue.ts";
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

test("history tasks: after all the research — after stories and work waiting for images — and never offered in a conversation unless asked", opts, async () => {
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
    // asked for (strom run, task next --history): last of all
    const tree = Tree.open(w.cwd, w.env);
    const ranked = rankTasks(tree, tree.list<Task>("task"), "balanced", { history: true });
    assert.equal(ranked.at(-1)!.task.id, hist[0]!.id, ranked.map((r) => `${r.task.id} ${r.why}`).join("\n"));
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

test("history tasks: strom run without a gate gives them one session a day; with a gate, the gate decides", opts, async () => {
  const w = await world();
  try {
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "idle" });
    await w.ok(["frontier", "--apply"]);
    await dropOthers(w);
    const history = new Set(ofHistory(await tasks(w)).map((t) => t.id));
    const ofIt = (r: { json: { sessions: { task: string }[] } }) => r.json.sessions.filter((s) => history.has(s.task)).length;
    const r = await w.ok(["run", "--agent", "script", "--loop", "--json"]);
    assert.equal(ofIt(r), 1, r.err);
    assert.equal(r.json.stop, "history");
    assert.match(r.json.stopped, /dějiny míst počkají do zítřka/);
    // the same day again: none of them
    const again = await w.ok(["run", "--agent", "script", "--loop", "--json"]);
    assert.equal(ofIt(again), 0, again.err);
    assert.equal(again.json.stop, "history");
    // a gate decides instead
    const gate = path.join(w.home, "shared", "plugins", "gates", "vzdy");
    fs.mkdirSync(gate, { recursive: true });
    fs.writeFileSync(path.join(gate, "gate.json"), JSON.stringify({ interface: 1, title: "Vždy", command: ["node", "gate.ts"] }));
    fs.writeFileSync(path.join(gate, "gate.ts"), "process.exit(0);\n");
    await w.ok(["config", "set", "run.gate", "vzdy"], { tty: true, answers: ["y"] });
    await dropOthers(w);
    const gated = await w.ok(["run", "--agent", "script", "--loop", "--max", "1", "--json"]);
    assert.equal(ofIt(gated), 1, gated.err);
  } finally {
    w.cleanup();
  }
});

test("history tasks: the one session a day is for every tree sharing the folder — a run in another tree the same day gets none", opts, async () => {
  const w = await world();
  const a = w.cwd;
  try {
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "idle" });
    await w.ok(["init", "Lhotákovi z Lhoty"]);
    const b = w.treeDir("Lhotákovi z Lhoty");
    w.cwd = b;
    await w.ok(["research", "new", "Předci Marie Lhotákové", "--new-person", "Marie /Lhotáková/", "--sex", "F", "--born", "1860", "--born-place", "Nová Lhota"]);
    const ofIt = async (r: { json: { sessions: { task: string }[] } }) => {
      const history = new Set(ofHistory(await tasks(w)).map((t) => t.id));
      return r.json.sessions.filter((s) => history.has(s.task)).length;
    };
    for (const dir of [a, b]) {
      w.cwd = dir;
      await w.ok(["frontier", "--apply"]);
      await dropOthers(w);
    }
    w.cwd = a;
    const first = await w.ok(["run", "--agent", "script", "--loop", "--json"]);
    assert.equal(await ofIt(first), 1, first.err);
    assert.equal(readJsonFile(path.join(w.home, "shared", "history", "day.json")).tree, treeId(a));
    w.cwd = b;
    assert.ok(ofHistory(await tasks(w)).some((t) => t.state === "open"), "the other tree has its own");
    const other = await w.ok(["run", "--agent", "script", "--loop", "--json"]);
    assert.equal(await ofIt(other), 0, other.err);
    assert.equal(other.json.stop, "history");
    assert.match(other.json.stopped, /dějiny míst počkají do zítřka/);
    // the next day: free again
    const d = readJsonFile(path.join(w.home, "shared", "history", "day.json"));
    d.day = "2000-01-01";
    fs.writeFileSync(path.join(w.home, "shared", "history", "day.json"), JSON.stringify(d));
    const next = await w.ok(["run", "--agent", "script", "--loop", "--json"]);
    assert.equal(await ofIt(next), 1, next.err);
    assert.equal(readJsonFile(path.join(w.home, "shared", "history", "day.json")).tree, treeId(b));
  } finally {
    w.cleanup();
  }
});

test("history tasks: the day claimed by runs at once — of several processes exactly one gets it; the next day another may", opts, async () => {
  const shared = fs.mkdtempSync(path.join(os.tmpdir(), "strom-day-"));
  try {
    const mod = pathToFileURL(path.join(import.meta.dirname, "..", "..", "src", "core", "pastevents.ts")).href;
    const one = (tree: string, at: string) =>
      new Promise<string>((resolve, reject) => {
        const code = `import { claimHistoryDay } from ${JSON.stringify(mod)}; process.stdout.write(String(claimHistoryDay(${JSON.stringify(shared)}, ${JSON.stringify(tree)}, new Date(${JSON.stringify(at)}))));`;
        execFile(process.execPath, ["--input-type=module", "-e", code], (err, out, errText) => (err ? reject(new Error(errText || String(err))) : resolve(out.trim())));
      });
    const today = new Date().toISOString();
    const got = await Promise.all(Array.from({ length: 6 }, (_, i) => one(`tree-${i % 2}`, today)));
    assert.equal(got.filter((x) => x === "true").length, 1, got.join(","));
    assert.equal(await one("tree-9", today), "false", "taken today");
    assert.equal(await one("tree-9", new Date(Date.now() + 2 * 86_400_000).toISOString()), "true", "another day");
  } finally {
    fs.rmSync(shared, { recursive: true, force: true });
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
    assert.match(brief, /period: 1850–\d{4} — this tree's places only/);
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
    assert.match((await w.ok(["brief", link.id])).out, /## Local events \(an experiment\)\n.*\n {2}strom history local/);
    await w.ok(["config", "set", "experiments.history", "off"]);
    assert.doesNotMatch((await w.ok(["brief", link.id])).out, /history local/);
  } finally {
    w.cleanup();
  }
});
