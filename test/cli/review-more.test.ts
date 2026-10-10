// What the first review round fixed: the frontier never repeats what was
// tried, free text keeps its commas, batches, settings with tree scope,
// short errors, a stuck task is parked, the agent gets its brief on stdin.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { enterWorker } from "../../src/core/workers.ts";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { acquireLock } from "../../src/core/lock.ts";
import { LockedError } from "../../src/core/errors.ts";
import { prependPath } from "../../src/runners/runner.ts";
import { claudeArgs, headlessEnv } from "../../src/runners/claude.ts";
import { codexResumeArgs } from "../../src/runners/codex.ts";
import { clockLine, deadlineOf } from "../../src/core/clock.ts";
import { parseBatch } from "../../src/commands/batch.ts";
import { permissionPath } from "../../src/agents/files.ts";
import { opts, agent, world, startRun } from "./review.helpers.ts";

/** Headless: nothing that waits for a person (a question, the browser's pairing request). */
const NO_WAIT = ["--disallowedTools", "AskUserQuestion,mcp__claude-in-chrome__switch_browser"];

test("strom run beside another: each run has a name of its own, takes another task and leaves the other's session alone", opts, async () => {
  const w = await world();
  for (const what of ["Křest", "Oddavky"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "sleep";
  const first = startRun(w, ["--agent", "script"]);
  await first.opened;
  const held = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.match(held.worker, /^run-\d+-/);
  w.env.AGENT_MODE = "echo";
  const beside = await w.ok(["run", "--agent", "script", "--json"]);
  assert.match(beside.err, /⚠ V tomto rodokmenu už pracuje jiný běh \(od \d{1,2}:\d{2}\): tento si vezme jiné úkoly – náklady se sčítají\./);
  const second = beside.json;
  assert.notEqual(second.sessions[0].task, held.task, "another task");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "open", "the first run's session is left alone");
  first.child.kill("SIGINT");
  if (process.platform !== "win32") {
    // the first asks it to finish — once the run said so (a busy computer: a fixed pause let the second come first and
    // the run waited on, found 2026-10-04); this one: now
    for (const end = Date.now() + 20_000; Date.now() < end && !/Ctrl-C: sezení N0001 dostalo žádost skončit/.test(first.out()); ) await new Promise((r) => setTimeout(r, 100));
    first.child.kill("SIGINT");
  }
  const ended = await Promise.race([first.exited, new Promise<undefined>((r) => setTimeout(() => r(undefined), 60_000))]);
  if (!ended) first.child.kill("SIGKILL");
  assert.equal(ended?.code, 0, `the first run did not end: ${first.out()}`);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "interrupted");
  w.cleanup();
});

test("strom run: a task handed back twice without anything recorded is parked", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "5"]);
  await w.ok(["task", "add", "Jiný", "--level", "locate", "--where", "Jinde", "--why", "a", "--done-when", "b"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "idle";
  const r = (await w.ok(["run", "--agent", "script", "--max", "3", "--json"])).json;
  assert.deepEqual(r.sessions.map((s: any) => s.task), ["T0001", "T0001", "T0002"]);
  const t = readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json"));
  assert.equal(t.state, "parked");
  w.cleanup();
});

test("agent permissions use this computer's paths; PATH is replaced, not duplicated", opts, async () => {
  const w = await world();
  const s = readJsonFile(path.join(w.cwd, ".claude", "settings.json"));
  assert.ok(s.permissions.deny.includes(`Read(${permissionPath(w.env.STROM_CONFIG_DIR!)}/**)`));
  assert.ok(s.permissions.deny.includes("Read(data/**)"));
  assert.ok(s.permissions.deny.some((a: string) => a.includes("/shared/media/**")), "scans only through views");
  // A consent the agent may ask for — strom asks the person in a window; a password and the seal stay out of its reach.
  assert.ok(!s.permissions.deny.includes("Bash(strom allow:*)"));
  for (const own of ["Bash(strom login:*)", "Bash(strom connector add:*)", "Bash(strom connector remove:*)", "Bash(strom seal:*)"]) assert.ok(s.permissions.deny.includes(own), own);
  assert.ok(s.permissions.deny.some((a: string) => a.includes("/shared/net/**")), "the limiter's memory is strom's");
  assert.ok(s.permissions.allow.some((a: string) => /^Edit\(.*\/shared\/plugins\/connectors\/\*\*\)$/.test(a)), "it may build a connector");
  assert.equal(permissionPath("C:\\Users\\jan\\AppData\\Roaming\\strom"), "//c/Users/jan/AppData/Roaming/strom");
  const env = prependPath({ Path: "C:\\a", HOME: "x" }, "C:\\bin");
  assert.deepEqual(Object.keys(env).filter((k) => k.toUpperCase() === "PATH"), ["Path"]);
  assert.ok(env.Path!.startsWith("C:\\bin"));
  assert.deepEqual(claudeArgs({ kickoff: "k", name: "strom N0001", model: "opus", extraArgs: ["--add-dir", "x"] }), [
    "-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "dontAsk", "--name", "strom N0001", "--model", "opus", ...NO_WAIT, "--add-dir", "x",
  ]);
  // interactive: what the permissions do not decide, Claude Code's own review does — nobody clicks through every action
  assert.deepEqual(claudeArgs({ interactive: true, kickoff: "Run strom brief" }), ["Run strom brief", "--permission-mode", "auto"]);
  // browser tools only for connectors that fetch through the browser; the user's full level is Claude Code's bypass
  assert.deepEqual(claudeArgs({ kickoff: "k", chrome: false }).slice(-3), ["--no-chrome", ...NO_WAIT]);
  assert.deepEqual(claudeArgs({ kickoff: "k", chrome: true, permissions: "full" }).slice(4), ["--permission-mode", "bypassPermissions", "--chrome", ...NO_WAIT]);
  assert.deepEqual(claudeArgs({ interactive: true, kickoff: "k", permissions: "full" }), ["k", "--permission-mode", "bypassPermissions"]);
  // Remote Control (agent.remote): always with a name — a bare flag would take the next argument
  assert.deepEqual(claudeArgs({ interactive: true, kickoff: "k", name: "Strom · Novákovi", remote: true }), ["k", "--permission-mode", "auto", "--name", "Strom · Novákovi", "--remote-control", "Strom · Novákovi"]);
  assert.deepEqual(claudeArgs({ kickoff: "k", remote: true }).slice(-4), ["--remote-control", "Strom", ...NO_WAIT]);
  // ask: Claude Code's own mode — it asks about what the tree's permissions do not decide; headless never asks
  assert.deepEqual(claudeArgs({ interactive: true, kickoff: "k", permissions: "ask" }), ["k"]);
  assert.deepEqual(claudeArgs({ kickoff: "k", permissions: "ask" }).slice(4, 6), ["--permission-mode", "dontAsk"]);
  // The tree's permissions go in explicitly: a project's own settings count only once the folder is trusted.
  assert.deepEqual(claudeArgs({ kickoff: "k", settingsFile: "/t/.claude/settings.json" }).slice(6, 8), ["--settings", "/t/.claude/settings.json"]);
  // headless: nothing is left running in the background (it would die with the turn), no wake-ups, long commands may finish
  const h = headlessEnv({ HOME: "x" }, 45 * 60_000);
  assert.equal(h.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS, "1");
  assert.equal(h.CLAUDE_CODE_DISABLE_CRON, "1");
  assert.equal(h.BASH_MAX_TIMEOUT_MS, String(45 * 60_000));
  assert.equal(headlessEnv({}, undefined).BASH_DEFAULT_TIMEOUT_MS, String(30 * 60_000));
  assert.ok(s.permissions.deny.includes("ScheduleWakeup"));
  w.cleanup();
});

test("lock: a live holder keeps its lock however long it works", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-lock-"));
  const file = path.join(dir, "x.lock");
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, host: os.hostname(), at: "2000-01-01T00:00:00.000Z", owner: "old but alive" }));
  assert.throws(() => acquireLock(file, { owner: "b", waitMs: 0, staleMs: 1000 }), LockedError);
  fs.rmSync(dir, { recursive: true });
});

test("strom run: an agent not allowed to run strom stops the loop at once", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["task", "add", "Jiný", "--level", "locate", "--where", "Jinde", "--why", "a", "--done-when", "b"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "denied";
  const r = await w.run(["run", "--agent", "script", "--max", "5", "--json"]);
  assert.equal(r.code, 1);
  assert.equal(r.json.sessions.length, 1, "no second session after the first was refused");
  assert.equal(r.json.stop, "denied");
  assert.match(r.json.stopped, /agent nesměl spouštět strom/);
  assert.match(r.err, /oprávnění odmítla 1×: Bash: strom input show I0001/);
  w.cleanup();
});

test("strom run: one refused command that starts with strom does not stop a loop the agent otherwise worked in", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["task", "add", "Jiný", "--level", "locate", "--where", "Jinde", "--why", "a", "--done-when", "b"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "denied-once";
  const r = await w.run(["run", "--agent", "script", "--max", "2", "--json"]);
  assert.equal(r.json.sessions.length, 2, "the second session started");
  assert.notEqual(r.json.stop, "denied");
  assert.match(r.err, /oprávnění odmítla 1×: Bash: strom fetch/);
  w.cleanup();
});

test("live run findings: a citation without a fact cites the name; a search task without a recorded search is flagged", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Vyprávění", "--kind", "family-memory", "--form", "authored"]);
  const named = await w.ok(["person", "add", "Jakub /Víšek/", "--cite", "S1"]);
  assert.match(named.out, /\+P\d{4} Jakub \/Víšek\/ ← S0001/);
  assert.equal((await w.run(["person", "add", "Jan /Víšek/", "--cite", "S1", "--status", "proven"])).code, 2, "a status needs a fact");
  await w.ok(["task", "add", "Kde jsou matriky", "--level", "locate", "--where", "Vavřinec", "--why", "a", "--done-when", "b"]);
  assert.match((await w.ok(["task", "done", "T1", "--result", "MZA, Sloup 782"])).out, /no search is recorded for T0001 — record what you looked at/);
  w.cleanup();
});

test("a task can be about a conflict or a hypothesis: its people come into the brief, settling it names the open tasks", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Oddací zápis", "--kind", "marriage"]);
  await w.ok(["source", "add", "Úmrtní zápis", "--kind", "death"]);
  await w.ok(["conflict", "add", "Rok narození Josefa", "--about", "P1", "--claim", "S1: 25 let při sňatku 1910", "--claim", "S2: 70 let při úmrtí 1955"]); // X1
  await w.ok(["hypothesis", "add", "Kdo byl otec Josefa?", "--about", "P1", "--variant", "A: Jan z čp. 12", "--variant", "B: Václav z čp. 3"]); // H1
  await w.ok(["task", "add", "Rozhodnout rok narození", "--level", "verify", "--where", "křty Kamenice 1883–1887", "--why", "dva údaje", "--done-when", "rozpor vyřešen", "--about", "X1"]); // T1
  await w.ok(["task", "add", "Otec Josefa", "--level", "verify", "--where", "křty Kamenice", "--why", "a", "--done-when", "b", "--about", "H1"]); // T2
  assert.deepEqual((await w.ok(["task", "list", "--about", "X1", "--json"])).json.tasks.map((t: any) => t.id), ["T0001"]);
  assert.match((await w.ok(["conflict", "show", "X1"])).out, /tasks {2}T0001/);
  assert.match((await w.ok(["hypothesis", "show", "H1"])).out, /tasks {2}T0002/);
  const brief = (await w.ok(["brief", "T1"])).out;
  assert.match(brief, /## People concerned\n {2}P0001 Josef Novák/, "the conflict's people");
  assert.match(brief, /## Open conflicts and hypotheses \(→ this task is about it\)\n→ X0001 Rok narození Josefa/);
  assert.match((await w.ok(["conflict", "resolve", "X1", "--resolution", "1885", "--reasoning", "křest"])).out, /k X0001 jsou ještě otevřené úkoly T0001/);
  assert.match((await w.ok(["brief", "T1"])).out, /→ X0001 \[resolved\] Rok narození Josefa: .* — resolved: 1885/, "its own conflict stays in the brief once resolved");
  assert.equal((await w.run(["task", "add", "x", "--level", "verify", "--where", "a", "--why", "b", "--done-when", "c", "--about", "L1"])).code, 2, "a missing record is refused");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("find: several arguments are several searches, each answered", opts, async () => {
  const w = await world();
  await w.ok(["intake", "--text", "Děda byl mlynář v čp. 12"]);
  await w.ok(["note", "add", "P1", "Ve starém výzkumu značen jako OLD-7"]);
  const r = await w.ok(["find", "mlynar", "OLD-7", "OLD-8"]);
  assert.match(r.out, /^mlynar\n {2}I0001/m);
  assert.match(r.out, /^OLD-7\n {2}P0001/m);
  assert.match(r.out, /nothing found for: OLD-8/);
  const j = (await w.ok(["find", "mlynar", "OLD-7", "OLD-8", "--json"])).json;
  assert.deepEqual(j.missing, ["OLD-8"]);
  assert.deepEqual(j.hits.map((h: any) => [h.query, h.id]).filter((x: any) => x[0] === "OLD-7"), [["OLD-7", "P0001"]]);
  assert.ok((await w.ok(["find", "mlynar čp", "--json"])).json.hits.some((h: any) => h.id === "I0001"), "one argument: all its words");
  assert.equal((await w.ok(["find", "mlynar OLD-7"])).out.trim(), "nothing found", "all its words, in one record");
  w.cleanup();
});

test("frontier: a baptism another task already records or checks in its book is not proposed again", opts, async () => {
  const w = await world();
  await w.ok(["recordset", "add", "Kamenice N 1880-1890", "--kinds", "baptism", "--places", "Kamenice nad Lipou", "--years", "1880-1890"]); // B1
  const before = (await w.ok(["frontier", "--json"])).json.frontier.find((i: any) => i.person === "P0001");
  assert.equal(before.proposal.level, "link");
  await w.ok(["task", "add", "Zapsat křest Josefa z B1", "--level", "enrich", "--where", "B1", "--why", "zápis je známý", "--done-when", "zapsán", "--about", "P1"]); // T1
  const after = (await w.ok(["frontier", "--json"])).json.frontier.find((i: any) => i.person === "P0001");
  assert.equal(after.coveredBy, "T0001");
  assert.deepEqual((await w.ok(["frontier", "--apply", "--json"])).json.created, []);
  w.cleanup();
});

test("strom run --task: the tasks picked, one session each, in that order — one done meanwhile is left out", opts, async () => {
  const w = await world();
  for (const what of ["Křest", "Oddavky", "Úmrtí"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["task", "done", "T0002", "--result", "nalezeno jinde"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "echo";
  const r = await w.ok(["run", "--agent", "script", "--task", "T0003,T0002", "--task", "T0001", "--json"]);
  assert.deepEqual(r.json.sessions.map((s: { task: string }) => s.task), ["T0003", "T0001"]);
  assert.match(r.err, /T0002 vynechán: už je hotový nebo zrušený/);
  w.cleanup();
});

test("the menu, working alone: the next tasks listed, the time limit said; the queue in order or the tasks picked by number", opts, async () => {
  const w = await world();
  for (const [what, p] of [["Křest Josefa", "5"], ["Oddavky rodičů", "3"], ["Úmrtí Josefa", "1"]]) await w.ok(["task", "add", what!, "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1", "--priority", p!]);
  Object.assign(w.env, { STROM_AGENT: "script", STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "echo" });
  // 2 working alone · 2 only the ones picked · a wrong answer, then 3 and 1 · Enter · 0 quit
  const r = await w.ok([], { tty: true, answers: ["2", "2", "4", "3, 1", "", "0"] });
  assert.match(r.out, /Na řadě jsou tyto úkoly, v pořadí, v jakém je agent vezme:\n {3}1\. Křest Josefa\n {3}2\. Oddavky rodičů\n {3}3\. Úmrtí Josefa\n/);
  assert.match(r.out, /Na jeden úkol má agent nejvýš 60 minut/);
  assert.match(r.out, /Čísla ze seznamu, 1 až 3/);
  const task = (n: string) => readJsonFile(path.join(w.cwd, "data", "sessions", `${n}.json`)).task;
  assert.deepEqual([task("N0001"), task("N0002")], ["T0003", "T0001"]);
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0003.json")), "only those two");
  // 0 goes back from both questions: nothing runs.
  await w.ok([], { tty: true, answers: ["2", "0", "2", "1", "0", "0"] });
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0003.json")));
  // Another run at work already: said first, and nothing starts without a yes.
  const other = enterWorker(w.cwd, "run-elsewhere", "Claude Code on its own");
  const warned = await w.ok([], { tty: true, answers: ["2", "", "0"] });
  other();
  assert.match(warned.out, /⚠ Agent už tu pracuje sám \(běhy: 1\)\. Další vedle něj si vezme jiné úkoly – náklady se sčítají\.\nSpustit další vedle něj\? \(a\/n\) \[n\]/);
  assert.doesNotMatch(warned.out, /Na řadě jsou tyto úkoly/, "no further questions");
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0003.json")));
  w.cleanup();
});
