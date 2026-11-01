import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closedOpenCodeResult, opencodeRunner } from "../../src/runners/opencode.ts";
import type { RunResult } from "../../src/runners/runner.ts";

function completed(): RunResult {
  return {
    outcome: "error", exitCode: 1, text: "Task closed", metrics: { turns: 2 },
    normalStop: true, processExit: { code: 1, signal: null, stderr: false },
  };
}

test("OpenCode: normal stop and authoritative closed session permit the next task, retaining raw exit 1", () => {
  const result = completed();
  const accepted = closedOpenCodeResult(result, "closed");
  assert.equal(accepted.outcome, "ok");
  assert.equal(accepted.exitCode, 1);
  assert.equal(accepted.exitWarning, true);
  assert.equal(accepted.metrics, result.metrics);
});

test("OpenCode: a completion-looking answer is insufficient while Strom's session is open or interrupted", () => {
  for (const state of ["open", "interrupted"]) {
    const result = completed();
    assert.equal(closedOpenCodeResult(result, state), result);
  }
});

test("OpenCode: quota, auth, model rejection, denied actions, signals and runtime diagnostics still stop", () => {
  const failures: Partial<RunResult>[] = [
    { outcome: "limit" }, { outcome: "auth" }, { outcome: "stopped" }, { outcome: "timeout" },
    { modelRejected: true }, { denied: ["Bash: strom denied"] }, { refused: ["strom: web denied"] },
    { normalStop: false }, { exitCode: 2 }, { exitCode: 130 },
    { processExit: { code: null, signal: "SIGTERM", stderr: false } },
    { processExit: { code: 1, signal: "SIGTERM", stderr: false } },
    { processExit: { code: 1, signal: null, stderr: true } },
  ];
  for (const failure of failures) {
    const result = { ...completed(), ...failure };
    assert.equal(closedOpenCodeResult(result, "closed"), result);
  }
});

test("OpenCode: older result metadata and clean success are not rewritten", () => {
  const older = completed(); delete older.processExit;
  assert.equal(closedOpenCodeResult(older, "closed"), older);
  const ok: RunResult = { ...completed(), outcome: "ok", exitCode: 0 };
  assert.equal(closedOpenCodeResult(ok, "closed"), ok);
});

test("OpenCode JSONL: only the last normal main-session stop can qualify exit 1", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-closed-result-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "agent.mjs"), 'import fs from "node:fs";process.stdin.resume();process.stdin.on("end",()=>{const c=JSON.parse(fs.readFileSync(process.env.TEST_CASE,"utf8"));for(const e of c.events)console.log(JSON.stringify(e));if(c.stderr)process.stderr.write(c.stderr);process.exitCode=c.code;});');
  fs.writeFileSync(path.join(dir, "opencode.cmd"), '@echo off\r\n"%FAKE_NODE%" "%~dp0agent.mjs" %*\r\n');
  fs.writeFileSync(path.join(dir, "opencode"), '#!/bin/sh\nexec "$FAKE_NODE" "$(dirname "$0")/agent.mjs" "$@"\n', { mode: 0o755 });
  const start = (sessionID = "main") => ({ type: "step_start", sessionID, part: {} });
  const stop = (reason = "stop", sessionID = "main") => ({ type: "step_finish", sessionID, part: { reason } });
  const cases = [
    { name: "normal", events: [start(), stop()], code: 1, accepted: true },
    { name: "unfinished", events: [start(), stop("tool-calls")], code: 1, accepted: false },
    { name: "child-stop", events: [start(), stop("tool-calls"), stop("stop", "child")], code: 1, accepted: false },
    { name: "later-step", events: [start(), stop(), start()], code: 1, accepted: false },
    { name: "protocol-error", events: [start(), { type: "error", error: { data: { message: "fatal service failure" } } }, stop()], code: 1, accepted: false },
    { name: "stderr", events: [start(), stop()], code: 1, stderr: "runtime failure", accepted: false },
    { name: "exit-two", events: [start(), stop()], code: 2, accepted: false },
    { name: "reader", events: [start(), stop()], code: 1, reader: true, accepted: false },
    { name: "denied", events: [start(), { type: "tool_use", sessionID: "main", part: { tool: "shell", state: { status: "error", error: "permission denied", input: { command: "strom denied" } } } }, stop()], code: 1, accepted: false },
  ];
  for (const item of cases) {
    const file = path.join(dir, item.name + ".json"); fs.writeFileSync(file, JSON.stringify(item));
    const logFile = path.join(dir, item.name + ".log");
    const result = await opencodeRunner.run({ cwd: dir, prompt: "Protocol only", kickoff: "test", env: { PATH: dir + path.delimiter + (process.env.PATH ?? ""), FAKE_NODE: process.execPath, TEST_CASE: file }, logFile, timeoutMs: 10000, ...(item.reader ? { readerFiles: { views: [], report: path.join(dir, "report.md") } } : {}) });
    assert.equal(result.outcome, "error", item.name + ": raw error retained before checking Strom state");
    assert.equal(closedOpenCodeResult(result, "closed").outcome === "ok", item.accepted, item.name);
    assert.equal(closedOpenCodeResult(result, "open"), result);
    assert.deepEqual(result.processExit, { code: item.code, signal: null, stderr: Boolean(item.stderr) });
    const raw = JSON.parse(fs.readFileSync(logFile + ".exit.jsonl", "utf8"));
    assert.equal(raw.code, item.code); assert.equal(raw.signal, null); assert.equal(raw.stderr, Boolean(item.stderr));
  }
});
