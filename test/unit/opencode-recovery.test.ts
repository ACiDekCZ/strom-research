import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { opencodeRunner, opencodeTransportFailure, recoverOpenCode } from "../../src/runners/opencode.ts";
import type { RunOptions, RunResult } from "../../src/runners/runner.ts";

const failure = (text = "EPROTO: The TLS handshake failed."): RunResult => ({ outcome: "error", exitCode: 1, text, metrics: {} });
const success = (): RunResult => ({ outcome: "ok", exitCode: 0, text: "saved", metrics: {} });
function options(dir: string, extra: Partial<RunOptions> = {}): RunOptions {
  return { cwd: dir, env: {}, prompt: "Synthetic protocol only", kickoff: "test", logFile: path.join(dir, "run.log"), timeoutMs: 90000, ...extra };
}

test("retry only explicit transport errors, never permanent or permission failures", () => {
  for (const message of ["EPROTO TLS handshake failed", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND"]) assert.equal(opencodeTransportFailure(failure(message)), true, message);
  for (const message of ["unknown failure", "TLS certificate expired", "EPROTO certificate invalid", "ECONNRESET quota exceeded", "EPROTO rate limit", "ENOTFOUND unauthorized API key"]) assert.equal(opencodeTransportFailure(failure(message)), false, message);
  for (const extra of [{ outcome: "limit" }, { outcome: "auth" }, { outcome: "timeout" }, { outcome: "stopped" }, { outcome: "ok" }, { modelRejected: true }, { denied: ["shell denied"] }, { refused: ["strom refused"] }] satisfies Partial<RunResult>[]) assert.equal(opencodeTransportFailure({ ...failure(), ...extra }), false);
});

test("recovery resumes the same session with time spent working and waiting deducted", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-recovery-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let clock = 0;
  const calls: [string | undefined, number | undefined][] = [];
  const waits: number[] = [];
  const result = await recoverOpenCode(options(dir), async (id, left) => { calls.push([id, left]); clock += 1000; return calls.length === 1 ? failure() : success(); }, () => "ses_main", async (ms) => { waits.push(ms); clock += ms; }, () => clock);
  assert.deepEqual(calls, [[undefined, 90000], ["ses_main", 84000]]);
  assert.deepEqual(waits, [5000]); assert.equal(result.outcome, "ok"); assert.equal(result.metrics.durationMs, 7000);
  assert.match(fs.readFileSync(options(dir).logFile, "utf8"), /resuming the same session \(1\/2\)/);
});

test("persistent failures have exactly two retries even without a time limit", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-recovery-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let calls = 0; const waits: number[] = [];
  const result = await recoverOpenCode(options(dir, { timeoutMs: undefined }), async () => { calls++; return failure(); }, () => "ses_main", async (ms) => { waits.push(ms); }, () => 0);
  assert.equal(calls, 3); assert.deepEqual(waits, [5000, 15000]); assert.equal(result.outcome, "error");
});

test("missing session, insufficient time and safety failures never start a retry", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-recovery-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const item of [{ id: undefined, result: failure() }, { id: "ses_main", result: failure(), budget: 64999 }, { id: "ses_main", result: { ...failure(), outcome: "auth" as const } }, { id: "ses_main", result: { ...failure(), outcome: "limit" as const } }, { id: "ses_main", result: { ...failure(), denied: ["denied"] } }]) {
    let calls = 0;
    await recoverOpenCode(options(dir, { timeoutMs: item.budget ?? 90000 }), async () => { calls++; return item.result; }, () => item.id, async () => assert.fail("must not wait"), () => 0);
    assert.equal(calls, 1);
  }
});

test("a delayed backoff cannot start another process after the remaining budget is exhausted", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-recovery-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let clock = 0; let calls = 0;
  await recoverOpenCode(options(dir), async () => { calls++; return failure(); }, () => "ses_main", async () => { clock = 31000; }, () => clock);
  assert.equal(calls, 1);
});

test("cancellation before work or during backoff issues no further requests", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-recovery-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const before = new AbortController(); before.abort();
  assert.equal((await recoverOpenCode(options(dir, { signal: before.signal }), async () => assert.fail("already aborted"), () => "ses_main")).outcome, "stopped");
  const during = new AbortController(); let calls = 0;
  const result = await recoverOpenCode(options(dir, { signal: during.signal }), async () => { calls++; return failure(); }, () => "ses_main", async () => { during.abort(); throw Object.assign(new Error("aborted"), { name: "AbortError" }); });
  assert.equal(calls, 1); assert.equal(result.outcome, "stopped");
});

test("an unexpected backoff failure is not swallowed", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-recovery-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await assert.rejects(recoverOpenCode(options(dir), async () => failure(), () => "ses_main", async () => { throw new Error("unexpected failure"); }), /unexpected failure/);
});

function standIn(dir: string): Record<string, string> {
  fs.writeFileSync(path.join(dir, "agent.mjs"), `import fs from "node:fs";
process.stdin.resume();process.stdin.on("end",()=>{
 const file=process.env.TEST_CALLS;const calls=JSON.parse(fs.readFileSync(file,"utf8"));calls.push(process.argv.slice(2));fs.writeFileSync(file,JSON.stringify(calls));
 const n=calls.length;const mode=process.env.TEST_MODE;const emit=(type,part)=>console.log(JSON.stringify({type,sessionID:"ses_main",part}));
 emit("step_start",{});
 if(mode!=="last-empty"||n===1)emit("step_finish",{reason:"stop",tokens:{input:n*10,output:n,cache:{read:n*100}}});
 if(mode==="wrap"&&!process.argv.includes("--session")){setInterval(()=>{},1000);return;}
 if(n===1&&mode!=="wrap"){console.log(JSON.stringify({type:"error",error:{message:"EPROTO: The TLS handshake failed."}}));process.exitCode=1;}
 else if(mode==="last-empty"){console.log(JSON.stringify({type:"error",error:{data:{message:"usage limit reached"}}}));process.exitCode=1;}
 else emit("text",{text:"saved"});
});`);
  fs.writeFileSync(path.join(dir, "opencode.cmd"), '@echo off\r\n"%FAKE_NODE%" "%~dp0agent.mjs" %*\r\n');
  fs.writeFileSync(path.join(dir, "opencode"), '#!/bin/sh\nexec "$FAKE_NODE" "$(dirname "$0")/agent.mjs" "$@"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, "calls.json"), "[]");
  return { PATH: dir + path.delimiter + (process.env.PATH ?? ""), FAKE_NODE: process.execPath, TEST_CALLS: path.join(dir, "calls.json") };
}

test("real JSONL runner parses V2 errors, resumes with original switches and accumulates usage", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-recovery-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = standIn(dir);
  const result = await opencodeRunner.run(options(dir, { env, model: "test/model#max", permissions: "auto", extraArgs: ["--standalone"] }));
  const calls: string[][] = JSON.parse(fs.readFileSync(env.TEST_CALLS!, "utf8"));
  assert.equal(calls.length, 2); assert.ok(calls[1]!.includes("--session")); assert.ok(calls[1]!.includes("ses_main")); assert.ok(calls[1]!.includes("--standalone")); assert.ok(calls[1]!.includes("test/model#max"));
  assert.deepEqual([result.outcome, result.metrics.turns, result.metrics.inputTokens, result.metrics.outputTokens, result.metrics.cacheReadTokens], ["ok", 2, 30, 3, 300]);
});

test("a final attempt without usage events preserves earlier totals and stops at quota", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-recovery-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env: Record<string, string> = { ...standIn(dir), TEST_MODE: "last-empty" };
  const result = await opencodeRunner.run(options(dir, { env }));
  assert.equal(JSON.parse(fs.readFileSync(env.TEST_CALLS!, "utf8")).length, 2);
  assert.deepEqual([result.outcome, result.metrics.turns, result.metrics.inputTokens, result.metrics.outputTokens, result.metrics.cacheReadTokens], ["limit", 1, 10, 1, 100]);
});

test("reader retry preserves its restricted agent and never asks for Strom or shell work", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-recovery-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = standIn(dir);
  const result = await opencodeRunner.run(options(dir, { env, readerFiles: { views: [], report: path.join(dir, "report.md") } }));
  const calls: string[][] = JSON.parse(fs.readFileSync(env.TEST_CALLS!, "utf8"));
  assert.equal(result.outcome, "ok"); assert.equal(calls.length, 2); assert.ok(calls[1]!.includes("strom-reader")); assert.ok(calls[1]!.includes("--standalone"));
  assert.match(calls[1]!.at(-1)!, /no shell, no strom commands/); assert.doesNotMatch(calls[1]!.at(-1)!, /First run strom/);
});

test("time limit still resumes the same session only to wrap up, without network retries", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-recovery-")); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env: Record<string, string> = { ...standIn(dir), TEST_MODE: "wrap" };
  const result = await opencodeRunner.run(options(dir, { env, timeoutMs: 1500, wrapUp: { ms: 10000, prompt: "Only save and close" } }));
  const calls: string[][] = JSON.parse(fs.readFileSync(env.TEST_CALLS!, "utf8"));
  assert.equal(result.outcome, "timeout"); assert.equal(calls.length, 2); assert.ok(calls[1]!.includes("ses_main")); assert.equal(calls[1]!.at(-1), "Only save and close"); assert.equal(result.metrics.turns, 2);
});
