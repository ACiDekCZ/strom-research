// K031: Codex's sandbox on Windows kept strom from the research's .git; each run stopped with the denied stop, the
// task stayed queued, and the next run started the same task again — 14 runs in a row. A task strom was refused in
// three sessions in a row (nothing recorded) is parked with its reason and the run goes on with the next; never more
// than one such park until a session records something again — then the run stops as before. Below three: as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const unix = { skip: !hasGit || process.platform === "win32", timeout: 180_000 };

/** A stand-in Codex whose sandbox refuses strom through PowerShell (as on Windows, GitHub #8). */
function refusingCodex(w: World): void {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git && !fs.existsSync(path.join(bin, "git"))) fs.symlinkSync(git, path.join(bin, "git"));
  const events = [
    { type: "thread.started", thread_id: "t" },
    { type: "item.completed", item: { type: "command_execution", command: `"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'strom.cmd session close --done x'`, aggregated_output: "error: no permission to write into .git — run this strom command outside the agent's sandbox", exit_code: 1, status: "failed" } },
    { type: "item.completed", item: { type: "agent_message", text: "Nelze zapisovat." } },
    { type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 9 } },
  ];
  fs.writeFileSync(path.join(bin, "codex"), `#!/bin/sh\ncat > /dev/null\ncat <<'EOT'\n${events.map((e) => JSON.stringify(e)).join("\n")}\nEOT\n`, { mode: 0o755 });
  w.env.PATH = `${bin}:/bin:/usr/bin`;
}

test("strom run: a task strom is refused in three sessions in a row is parked and the run goes on; one such park at a time (K031)", unix, async () => {
  const w = new World();
  try {
    refusingCodex(w);
    await w.ok(["setup", "--yes"]);
    await w.ok(["init", "Lhotákovi"]);
    w.cwd = w.treeDir("Lhotákovi");
    // the queue's order fixed by priority: T0001 first, then T0002
    for (const [what, priority] of [["Křest Jana", "5"], ["Křest Josefa", "1"]] as const)
      await w.ok(["task", "add", what, "--level", "locate", "--where", "farnost Lhota", "--why", "zkouška", "--done-when", "hotovo", "--priority", priority]);
    const task = async (id: string) => (await w.ok(["task", "show", id, "--json"])).json.task;
    const run = () => w.run(["run", "--agent", "codex", "--max", "3", "--json"]);

    // below three: the stop as before, the task stays queued
    for (const n of [1, 2]) {
      const r = await run();
      assert.equal(r.code, 1, r.err);
      assert.equal(r.json.stop, "denied.codex", `run ${n}`);
      assert.equal(r.json.sessions.length, 1);
      assert.equal(r.json.sessions[0].task, "T0001", `run ${n}: ${JSON.stringify(r.json.sessions)}`);
      assert.equal((await task("T0001")).state, "open", `run ${n}: T0001 stays queued`);
    }
    // the refused commands kept beside the session's log for strom error, never in the research's data
    const refused = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "runs", "N0001.denied.json"), "utf8"));
    assert.equal(refused.length, 1);
    assert.match(refused[0].command, /strom\.cmd session close --done x/u);
    assert.deepEqual([refused[0].strom, refused[0].whole], [true, false]);

    // the third in a row: T0001 parked with its reason, the same run goes on with T0002 (refused there once: the stop)
    const third = await run();
    assert.equal(third.json.stop, "denied.codex");
    assert.deepEqual(third.json.sessions.map((s: { task: string }) => s.task), ["T0001", "T0002"]);
    const parked = await task("T0001");
    assert.equal(parked.state, "parked");
    assert.equal(parked.parkedFor, "denied");
    assert.match(parked.parkedReason, /^3 sessions in a row: the agent's sandbox or permissions kept strom from the research — needs a look \(strom task show T0001\)\. Codex's sandbox lets strom out only as a command of its own .*strom agents sync.*a choice in strom's settings$/u);
    assert.match(third.out + third.err + JSON.stringify(third.json), /T0001 odložen: 3 sezení za sebou sandbox nebo oprávnění agenta nepustily strom k výzkumu/u);
    assert.equal((await task("T0002")).state, "open");

    // T0002 refused three times in a row too, nothing recorded since T0001's park: not parked, the run stops as before
    for (const n of [2, 3]) {
      const r = await run();
      assert.equal(r.json.stop, "denied.codex", `T0002, session ${n}`);
      assert.deepEqual(r.json.sessions.map((s: { task: string }) => s.task), ["T0002"]);
    }
    const kept = await task("T0002");
    assert.equal(kept.state, "open", "one refusal park at a time: the queue never emptied by a sandbox");
    assert.equal(kept.parkedFor, undefined);
  } finally {
    w.cleanup();
  }
});

test("strom run: a woken task counts its refusals again from its waking; the last task parked says Codex's sandbox (K031)", unix, async () => {
  const w = new World();
  try {
    refusingCodex(w);
    await w.ok(["setup", "--yes"]);
    await w.ok(["init", "Lhotákovi"]);
    w.cwd = w.treeDir("Lhotákovi");
    await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "farnost Lhota", "--why", "zkouška", "--done-when", "hotovo"]);
    const task = async (id: string) => (await w.ok(["task", "show", id, "--json"])).json.task;
    const run = () => w.run(["run", "--agent", "codex", "--max", "3", "--json"]);
    const codexAdvice = /sandbox Codexu: mimo sandbox jde strom jen jako samostatný příkaz .*strom agents sync.*volba v nastavení stromu/u;

    for (const n of [1, 2]) assert.equal((await run()).json.stop, "denied.codex", `run ${n}`);
    // the third: the queue's one task parked, the run ends with nothing left — the park says what the stop would have
    const third = await run();
    assert.equal((await task("T0001")).state, "parked");
    assert.equal(third.json.stop, "empty", JSON.stringify(third.json));
    assert.match(third.out + third.err, /T0001 odložen: 3 sezení za sebou/u);
    assert.match(third.out + third.err, codexAdvice, "Codex's sandbox said with the park");

    // woken by the person: one refusal more does not park it again — counted from its waking
    await w.ok(["task", "wake", "T0001"]);
    for (const n of [1, 2]) {
      const r = await run();
      assert.equal(r.json.stop, "denied.codex", `after waking, run ${n}: ${JSON.stringify(r.json)}`);
      assert.doesNotMatch(r.out + r.err, /T0001 odložen/u, `after waking, run ${n}`);
      assert.equal((await task("T0001")).state, "open", `after waking, run ${n}: T0001 stays queued`);
    }
    // a third in a row since its waking: parked again
    await run();
    const again = await task("T0001");
    assert.equal(again.state, "parked");
    assert.match(again.parkedReason, /^3 sessions in a row/u);
  } finally {
    w.cleanup();
  }
});
