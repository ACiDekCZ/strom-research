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

test("strom run: the brief goes in on stdin, arguments after -- reach the agent", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "echo";
  await w.ok(["run", "--agent", "script", "--", "--add-dir", "/tmp/scans"]);
  const log = fs.readFileSync(path.join(w.cwd, ".strom", "runs", "N0001.log"), "utf8");
  assert.match(log, /args: --add-dir \/tmp\/scans/);
  assert.match(log, /stdin: brief/);
  w.cleanup();
});

test("strom run: a session over its time limit is stopped and its task goes back", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "sleep";
  const t0 = Date.now();
  const r = (await w.ok(["run", "--agent", "script", "--minutes", "0.02", "--json"])).json;
  assert.ok(Date.now() - t0 < 20_000, "stopped long before the agent would have finished");
  assert.equal(r.sessions[0].outcome, "timeout");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "interrupted");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json")).state, "open");
  w.cleanup();
});

test("strom run: the agent knows when its session is stopped, is reminded near the end, and gets time to write down what it found", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "sleep-wrap";
  const r = (await w.ok(["run", "--agent", "script", "--minutes", "0.02", "--json"])).json;
  assert.equal(r.sessions[0].outcome, "timeout");
  // the brief said when
  assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "briefs", "N0001.md"), "utf8"), /^Time: this session is stopped at \d\d:\d\d \(it is \d\d:\d\d now\)\. Do not hurry and do not stop early/m);
  // resumed after the limit: strom's output said the time was up, the agent wrote down what it had and closed
  const log = fs.readFileSync(path.join(w.cwd, ".strom", "runs", "N0001.log"), "utf8");
  assert.match(log, /⏳ this session's time is up: record what you found and close it now/);
  const s = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.equal(s.state, "closed");
  assert.equal(s.summary, "wrapped up: images 1-10 read, nothing");
  assert.match(s.notes[0].text, /read images 1-10/);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json")).state, "open");
  w.cleanup();
});

test("the session's clock: nothing until its last ten minutes, then how long is left, then that it is up", () => {
  const end = Date.parse("2026-09-25T12:00:00Z");
  const env = { STROM_DEADLINE: new Date(end).toISOString() };
  assert.equal(clockLine({}, end), undefined, "no limit, no reminder");
  assert.equal(clockLine(env, end - 11 * 60_000), undefined);
  assert.match(clockLine(env, end - 6 * 60_000 + 1)!, /^⏳ 6 min left: this session is stopped at \d\d:\d\d\. Go on, but write each find down/);
  assert.match(clockLine(env, end - 2 * 60_000)!, /^⏳ 2 min left: .* Record what you have found now/);
  assert.match(clockLine(env, end + 1)!, /time is up/);
  // a short session is reminded in proportion: never from its first minute (the agent would give up at once)
  const short = { ...env, STROM_MINUTES: "5" };
  assert.equal(clockLine(short, end - 4 * 60_000), undefined);
  assert.match(clockLine(short, end - 70_000)!, /Go on/);
  assert.match(clockLine(short, end - 30_000)!, /Record what you have found now/);
  assert.equal(deadlineOf({ STROM_DEADLINE: "nonsense" }), undefined);
});

test("a session asked to finish (strom session finish): its agent is told at each strom command until it closes", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  assert.match((await w.run(["session", "finish"])).err, /v tomto výzkumu teď žádné sezení neběží/);
  const id = (await w.ok(["session", "start", "--json"])).json.session.id as string;
  // the session's agent: strom commands with its session in the environment
  const agent = async (args: string[]) => {
    w.env.STROM_SESSION = id;
    try {
      return await w.ok(args);
    } finally {
      delete w.env.STROM_SESSION;
    }
  };
  assert.doesNotMatch((await agent(["status"])).err, /finish this session/);
  assert.match((await w.ok(["session", "finish"])).out, new RegExp(`Sezení ${id} \\(úkol .*\\) dostalo žádost skončit`));
  assert.match((await agent(["status"])).err, /⏳ the user asks you to finish this session now: start nothing new; record in strom what you found/);
  assert.doesNotMatch((await w.ok(["status"])).err, /finish this session/, "only its own agent is told");
  await agent(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "finish", `${id}.json`)), "done with: gone");
  assert.match((await w.run(["session", "finish", id])).err, /už je uzavřené/);
  w.cleanup();
});

test("resuming an agent to write down what it found: its own session, the same sandbox", () => {
  assert.deepEqual(codexResumeArgs("abc", { cwd: "/t", shared: "/s", model: "gpt-5" }), [
    "exec", "resume", "--json", "--skip-git-repo-check",
    "-c", 'sandbox_mode="workspace-write"', "-c", "sandbox_workspace_write.network_access=true", "-c", `sandbox_workspace_write.writable_roots=${JSON.stringify([path.join("/t", ".git"), "/s"])}`,
    "--model", "gpt-5", "abc", "-",
  ]);
  assert.deepEqual(codexResumeArgs("abc", { cwd: "/t", permissions: "full" }), ["exec", "resume", "--json", "--skip-git-repo-check", "--dangerously-bypass-approvals-and-sandbox", "abc", "-"]);
});

test("strom run: the first Ctrl-C asks the session to finish — the agent writes down and closes it, no next session", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await world();
  for (const what of ["Křest", "Oddavky"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "finish";
  const run = startRun(w, ["--agent", "script", "--max", "3"]);
  await run.opened;
  run.child.kill("SIGINT");
  const r = await run.exited;
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /■ Ctrl-C: sezení N0001 dostalo žádost skončit – agent zapíše, co našel, a sezení uzavře, pak běh skončí/);
  assert.match(r.out, /sezení: 1 · konec: zastaveno ručně/);
  const s = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.equal(s.state, "closed", "closed by its agent, not cut off");
  assert.match(s.summary, /asked to finish: images 1-5 read/);
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0002.json")), "no next session");
  assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "finish", "N0001.json")));
  w.cleanup();
});

test("the Strom app's \"finish and stop\" (strom-research://finish): the session at work finishes, and the run starts no next one", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await world();
  for (const what of ["Křest", "Oddavky"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "finish";
  const run = startRun(w, ["--agent", "script", "--max", "3"]);
  await run.opened;
  const tree = readJsonFile(path.join(w.cwd, "strom.json")).id;
  const asked = await w.ok(["link", "open", `strom-research://finish?tree=${tree}&session=N0001`], { tty: true, answers: ["a", ""] });
  assert.match(asked.out, /Aplikace Strom žádá: požádat agenta .*, aby dokončil sezení N0001 \(/);
  assert.match(asked.out, /Sezení N0001 \(úkol .*\) dostalo žádost skončit/);
  const r = await run.exited;
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /sezení: 1 · konec: zastaveno ručně/);
  const s = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.equal(s.state, "closed", "closed by its agent");
  assert.equal(s.endedBy, "user", "the user's end: no failure of the agent");
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0002.json")), "no next session");
  assert.match((await w.ok(["link", "open", `strom-research://finish?tree=${tree}&session=N0001`], { tty: true, answers: [""] })).out, /Sezení N0001 už neběží/);
  w.cleanup();
});

test("strom run: Ctrl-C twice stops the agent now, closes the session and gives the task back", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "sleep";
  const run = startRun(w, ["--agent", "script", "--max", "3"]);
  await run.opened;
  run.child.kill("SIGINT");
  // Windows: the console stops the agent at the first one already
  if (process.platform !== "win32") {
    await new Promise((r) => setTimeout(r, 300));
    run.child.kill("SIGINT");
  }
  const r = await run.exited;
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /■ zastavuji – sezení se zavře a jeho úkol se vrátí do fronty.*\(SIGINT\)/);
  assert.match(r.out, /sezení: 1 · konec: zastaveno ručně/);
  const s = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.equal(s.state, "interrupted");
  assert.equal(s.summary, "zastaveno uživatelem", "written into the research: in its language");
  assert.equal(s.endedBy, "user");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json")).state, "open");
  assert.deepEqual(fs.readdirSync(path.join(w.cwd, ".strom", "workers")).filter((f) => f.startsWith("run")), [], "the run is no longer present");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("strom run: a session left open by a run that was killed is closed by the next run", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "sleep";
  const run = startRun(w, ["--agent", "script"]);
  await run.opened;
  process.kill(-run.child.pid!, "SIGKILL"); // the terminal closed, the computer went down: nothing could clean up
  await run.exited;
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "open");
  const o = (await w.ok(["--json"], { tty: true })).json.next;
  assert.equal(o.command, "strom run");
  assert.equal(o.why, "sezení N0001 zůstalo otevřené po běhu, který se zastavil – další běh ho zavře a pokračuje");
  w.env.AGENT_MODE = "work";
  const r = await w.ok(["run", "--agent", "script"]);
  assert.match(r.out, /· N0001 zavřeno – jeho běh se zastavil; T0001 je zpět ve frontě/);
  assert.match(r.out, /▶ N0002 · T0001/);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "interrupted");
  w.cleanup();
});
