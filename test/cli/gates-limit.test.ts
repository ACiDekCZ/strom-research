// The plan's limit of the agent cutting off a session of a run that goes on by itself (--loop, --until) under a gate:
// the run waits until the limit resets (as the agent said it; not said: the gate asked again after a while), then
// asks its gate and goes on — the interrupted task back in the queue (K036). Runs the user started end as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { hasGit, readJsonFile } from "../helpers.ts";
import { opts, world } from "./gates.helpers.ts";

const pausedIn = (cwd: string) => {
  const workers = path.join(cwd, ".strom", "workers");
  return fs.existsSync(workers) ? fs.readdirSync(workers).filter((f) => f.endsWith(".paused")).map((f) => path.join(workers, f)) : [];
};

test("--loop under a gate: a session cut off by the plan's limit — the run waits for the reset, asks the gate, goes on; the task back in the queue, never parked for it", opts, async () => {
  const w = await world([{ code: 0 }, { code: 0 }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true, answers: ["y"] });
  // the limit resets 3 s after the agent says so (no minute more here)
  Object.assign(w.env, { AGENT_MODE: "limit-once", AGENT_LIMIT_IN: "3000", STROM_TEST_LIMIT_RESERVE_MS: "0" });
  const r = await w.ok(["run", "--agent", "script", "--loop", "--max", "2", "--json"]);
  assert.equal(r.json.sessions.length, 2, r.err);
  assert.equal(r.json.sessions[0].outcome, "limit");
  assert.equal(r.json.sessions[1].outcome, "ok");
  assert.equal(r.json.stop, "done", "the limit ended no run");
  assert.match(r.err, /⏸ limit plánu agenta se vyčerpal – čekání do jeho obnovy \(.+\), pak nový dotaz na podmínku a práce pokračuje \(Ctrl-C běh ukončí\)/);
  const first = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  const second = readJsonFile(path.join(w.cwd, "data", "sessions", "N0002.json"));
  assert.equal(first.state, "interrupted");
  assert.equal(first.metrics.limit, true);
  // waited for the reset: the next session not before it (the agent's time cut to the second)
  assert.ok(Date.parse(second.started) - Date.parse(first.ended) >= 1500, `${first.ended} → ${second.started}`);
  // the gate asked before each session, the second time after the wait
  const asked = fs.readFileSync(path.join(w.gate, "asked.txt"), "utf8").trim().split("\n");
  assert.deepEqual(asked.map((l) => l.split(" ")[0]), ["0", "1"]);
  // back in the queue
  const cut = r.json.sessions[0].task as string;
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", `${cut}.json`)).state, "open");
  assert.deepEqual(pausedIn(w.cwd), [], "no pause left behind");
  // the session the limit cut off counts against its task never: one more recording nothing leaves it in the queue
  // (two such in a row park it)
  const again = await w.ok(["run", "--agent", "script", "--task", cut, "--json"]);
  assert.equal(again.json.sessions[0].outcome, "ok");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", `${cut}.json`)).state, "open");
  w.cleanup();
});

test("runs the user started end at the plan's limit as before, saying when it resets: --tasks 1, one task", opts, async () => {
  const w = await world([{ code: 0 }, { code: 0 }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true, answers: ["y"] });
  Object.assign(w.env, { AGENT_MODE: "limit", STROM_TEST_LIMIT_RESERVE_MS: "0" });
  for (const how of [["--tasks", "1"], []]) {
    const t0 = Date.now();
    const r = await w.ok(["run", "--agent", "script", ...how, "--json"]);
    assert.equal(r.json.sessions.length, 1);
    assert.equal(r.json.stop, "limit", how.join(" "));
    assert.match(r.json.stopped, /limit předplatného \(obnoví se 7pm\)/);
    assert.doesNotMatch(r.err, /⏸/);
    assert.ok(Date.now() - t0 < 60_000);
  }
  w.cleanup();
});

test("--loop --until under a gate: the limit resets after --until — the run ends (time), nothing waited for", opts, async () => {
  // ten minutes ahead, whatever the hour: --until past midnight is the next day's (parseUntil, on fixed clocks in
  // test/unit/planlimit.test.ts)
  const near = new Date(Date.now() + 10 * 60_000);
  const w = await world([{ code: 0 }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true, answers: ["y"] });
  Object.assign(w.env, { AGENT_MODE: "limit-once", AGENT_LIMIT_IN: String(2 * 3600_000) });
  const until = `${String(near.getHours()).padStart(2, "0")}:${String(near.getMinutes()).padStart(2, "0")}`;
  const t0 = Date.now();
  const r = await w.ok(["run", "--agent", "script", "--loop", "--until", until, "--json"]);
  assert.ok(Date.now() - t0 < 60_000);
  assert.equal(r.json.sessions.length, 1);
  assert.equal(r.json.sessions[0].outcome, "limit");
  assert.equal(r.json.stop, "time");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", `${r.json.sessions[0].task}.json`)).state, "open");
  w.cleanup();
});

test("--loop under a gate, the reset not said: paused for the gate's while (the Strom app hears until when and why), then the gate again", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await world([{ code: 0 }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true, answers: ["y"] });
  Object.assign(w.env, { AGENT_MODE: "limit-once" });
  // a real run (a signal reaches it, not the test runner)
  const child = spawn(process.execPath, [path.join(import.meta.dirname, "..", "..", "src", "cli.ts"), "run", "--agent", "script", "--loop"], { cwd: w.cwd, env: w.env, stdio: "ignore" });
  const exited = new Promise((resolve) => child.on("exit", resolve));
  for (const t0 = Date.now(); !pausedIn(w.cwd).length; ) {
    assert.ok(Date.now() - t0 < 30_000, "the run never waited");
    await new Promise((r) => setTimeout(r, 100));
  }
  const paused = JSON.parse(fs.readFileSync(pausedIn(w.cwd)[0]!, "utf8"));
  assert.equal(paused.reason, "limit plánu agenta se vyčerpal – práce pokračuje po jeho obnově");
  assert.ok(Math.abs(Date.parse(paused.until) - (Date.now() + 15 * 60_000)) < 60_000, paused.until);
  child.kill("SIGTERM");
  await exited;
  assert.deepEqual(pausedIn(w.cwd), [], "stopped while it waits: no longer paused");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "interrupted");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json")).state, "open");
  w.cleanup();
});

test("--loop under a gate, Claude Code at its plan's limit: \"You've hit your limit\" and a rejected rate_limit_event are the limit — the run waits for the window's reset and goes on", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await world([{ code: 0 }, { code: 0 }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true, answers: ["y"] });
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  // the first session: the five-hour window rejected (its reset 3 s ahead), Claude Code's words, exit 1; then done
  fs.writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/sh
cat > /dev/null
echo '{"type":"system","subtype":"init","model":"m","tools":["Task","Bash","Read","Edit","Write","WebFetch","WebSearch","ToolSearch","SendMessage"]}'
if [ ! -f "$PWD/.strom/claude-limit-once" ]; then
  : > "$PWD/.strom/claude-limit-once"
  reset=$(( $(date +%s) + 3 ))
  echo '{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","rateLimitType":"five_hour","resetsAt":'"$reset"',"unifiedWindows":{"five_hour":{"utilization":1,"resetsAt":'"$reset"'},"seven_day":{"utilization":0.3,"resetsAt":'"$(( reset + 86400 ))"'}}}}'
  echo '{"type":"result","subtype":"success","is_error":true,"result":"You\u2019ve hit your limit \u00b7 resets 3pm (Europe/Prague)","total_cost_usd":0,"num_turns":1}'
  exit 1
fi
echo '{"type":"result","result":"done","total_cost_usd":0.01,"num_turns":1}'
`,
    { mode: 0o755 },
  );
  Object.assign(w.env, { PATH: `${bin}${path.delimiter}${w.env.PATH}`, STROM_TEST_LIMIT_RESERVE_MS: "0" });
  const r = await w.ok(["run", "--agent", "claude", "--loop", "--max", "2", "--json"]);
  assert.equal(r.json.sessions.length, 2, r.err);
  assert.equal(r.json.sessions[0].outcome, "limit", r.err);
  assert.equal(r.json.sessions[1].outcome, "ok");
  assert.equal(r.json.stop, "done", "the limit ended no run");
  assert.match(r.err, /⏸ limit plánu agenta se vyčerpal \(pětihodinové okno\) – čekání do jeho obnovy/);
  const first = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.equal(first.metrics.limit, true);
  assert.deepEqual(pausedIn(w.cwd), []);
  w.cleanup();
});
