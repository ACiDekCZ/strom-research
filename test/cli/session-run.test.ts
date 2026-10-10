// Sessions, the brief, the frontier, agent files and `strom run` with a
// scripted agent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { opts, agent, world } from "./session.helpers.ts";

test("strom run: a scripted agent works a task through strom; run closes, exports, commits", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  const r = await w.run(["run", "--agent", "script", "--json"]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.json.sessions[0].outcome, "ok");
  const s = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.equal(s.state, "closed");
  assert.equal(s.summary, "baptism of Jan found");
  const jan = readJsonFile(path.join(w.cwd, "data", "persons", "P0001.json"));
  assert.ok(jan.events.some((e: any) => e.kind === "CHR" && e.status === "proven"));
  assert.ok((fs.readdirSync(path.join(w.cwd, "data", "ops"), { recursive: true }) as string[]).some((f) => path.basename(f).startsWith("N0001.") && f.endsWith(".jsonl")), "the agent's writes are logged under its session");
  assert.match(fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8"), /2 DATE 25 JUN 1905/);
  assert.equal(spawnSync("git", ["status", "--porcelain", "--", "data", "output"], { cwd: w.cwd, encoding: "utf8" }).stdout, "");
  assert.match((await w.ok(["verify"])).out, /^ok/);
  w.cleanup();
});

test("a search made in a session served its task, unless it says otherwise", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]); // T1
  await w.ok(["task", "add", "Jiná kniha", "--level", "locate", "--where", "katalog", "--why", "a", "--done-when", "b"]); // T2
  await w.ok(["session", "start", "T1"]);
  const a = (await w.ok(["search", "add", "Křty Novák 1903–1907", "--recordset", "B1", "--years", "1903-1907", "--method", "page-by-page", "--result", "negative", "--json"])).json.search;
  assert.equal(a.task, "T0001");
  const b = (await w.ok(["search", "add", "Katalog", "--method", "catalog", "--result", "negative", "--task", "T2", "--json"])).json.search;
  assert.equal(b.task, "T0002");
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  assert.equal((await w.ok(["search", "add", "Mimo sezení", "--method", "web", "--result", "negative", "--json"])).json.search.task, undefined);
  w.cleanup();
});

test("strom run: an agent that dies leaves an interrupted session and the task back in the queue", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "die";
  await w.ok(["run", "--agent", "script"]);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "interrupted");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json")).state, "open");
  w.cleanup();
});

test("strom run: the subscription limit stops the loop", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "A", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  await w.ok(["task", "add", "B", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "limit";
  const r = (await w.ok(["run", "--agent", "script", "--max", "5", "--json"])).json;
  assert.equal(r.sessions.length, 1);
  assert.equal(r.stop, "limit");
  assert.match(r.stopped, /limit předplatného \(obnoví se 7pm\)/);
  // the session it cut off says the limit, never only that the agent stopped
  assert.equal(r.sessions[0].summary, "limit plánu agenta se vyčerpal dřív, než bylo sezení zavřeno (7pm)");
  w.cleanup();
});

test("strom run --until: session after session until then, without --max", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "A", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  await w.ok(["task", "add", "B", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "idle"; // records nothing: each task is parked after two sessions
  const later = new Date(Date.now() + 3 * 3600_000);
  const until = `${later.getHours()}:${String(later.getMinutes()).padStart(2, "0")}`;
  const r = (await w.ok(["run", "--agent", "script", "--until", until, "--json"])).json;
  assert.ok(r.sessions.length >= 4, "both tasks twice (and what the frontier adds), not one session");
  assert.equal(r.stop, "empty");
  assert.equal((await w.ok(["run", "--agent", "script", "--json"])).json.sessions.length, 0, "without --until one session at most");
  assert.equal((await w.run(["run", "--agent", "script", "--until", "25:99"])).code, 2);
  w.cleanup();
});

test("a task written before its book was known: the brief finds the book, task edit points the task at it", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "18 OCT 1862", "--born-place", "Týnec čp. 13"]);
  await w.ok(["task", "add", "Najít matriky pro Týnec", "--level", "locate", "--where", "farnost Týnce", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["task", "add", "Křest Jana 18. 10. 1862", "--level", "link", "--where", "matrika N pro Týnec, rok 1862", "--why", "rodiče", "--done-when", "zápis nalezen", "--about", "P1"]);
  // the locate task finds the books
  await w.ok(["recordset", "add", "Týnec 5, N 1850-1870", "--kinds", "baptism", "--places", "Týnec", "--years", "1850-1870"]);
  await w.ok(["recordset", "add", "Týnec 6, O 1850-1870", "--kinds", "marriage", "--places", "Týnec", "--years", "1850-1870"]);
  await w.ok(["recordset", "add", "Týnec 4, N 1800-1849", "--kinds", "baptism", "--places", "Týnec", "--years", "1800-1849"]);
  const done = await w.ok(["task", "done", "T1", "--result", "knihy založeny"]);
  assert.match(done.out, /T0002 name no record set yet — point them at the books found: strom task edit T0002 --where B…/);
  // the brief of the link task shows the baptisms of the birthplace in the year of the task, not the rest
  const brief = (await w.ok(["brief", "T2"])).out;
  assert.match(brief, /## Record sets \(the task names none; these cover it — point it at the right one: strom task edit T0002 --where B0001\)\n  B0001 Týnec 5/);
  assert.doesNotMatch(brief, /B0002 Týnec 6|B0003 Týnec 4/);
  const edited = await w.ok(["task", "edit", "T2", "--where", "B1", "--priority", "5"]);
  assert.match(edited.out, /T0002 where, priority → B0001/);
  const t = (await w.ok(["task", "show", "T2", "--json"])).json.task;
  assert.deepEqual([t.where, t.priority, t.what], [["B0001"], 5, "Křest Jana 18. 10. 1862"]);
  assert.match((await w.ok(["brief", "T2"])).out, /## Record sets\n  B0001/);
  assert.equal((await w.run(["task", "edit", "T2"])).code, 2, "nothing to change");
  assert.equal((await w.run(["task", "edit", "T2", "--where", "B9"])).code, 2, "no such record set");
  w.cleanup();
});
