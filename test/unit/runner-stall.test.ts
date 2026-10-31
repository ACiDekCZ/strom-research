// A reader silent after a retry of its agent's service (found 2026-10-27: Claude Code's api_retry, then not one line for
// 14.5 minutes, until strom stopped the reader at its time limit — two readers taken for readers without a result, and
// the batches made smaller for it). With RunOptions.stalled the runner stops it after a short silence and resumes the
// same session once where it stopped (its brief not sent again: what it read is not read again); silent again, it ends
// at once as halted (outcome "error", stalled) — never a time limit. A retry followed by more lines is no silence, and
// a session without the watch (the main agent's) waits as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { apiRetry, claudeRunner } from "../../src/runners/claude.ts";
import { READER_STALL_MS, readerStall } from "../../src/core/reader.ts";
import type { RunOptions } from "../../src/runners/runner.ts";

const unix = { skip: process.platform === "win32" };

const INIT = JSON.stringify({ type: "system", subtype: "init", session_id: "s", model: "claude-opus-5-5", tools: ["Read", "Edit", "Write"] });
const RETRY = JSON.stringify({ type: "system", subtype: "api_retry", attempt: 1, max_retries: 10, retry_delay_ms: 0, error_status: null, error: "unknown" });
const RESULT = (text: string) => JSON.stringify({ type: "result", result: text, total_cost_usd: 0.02, num_turns: 2, usage: { input_tokens: 3, output_tokens: 5 } });

/**
 * Claude Code as a fake: each start written down (its arguments and what came on stdin); the first start says a retry
 * and goes silent; a resumed one (--resume) answers (FAKE_MODE recover) or goes silent again (again). FAKE_MODE lively:
 * the retry is followed by a line and an answer, each within the watch — no silence.
 */
function fakeClaude(dir: string): { env: Record<string, string>; calls: () => { args: string[]; stdin: string }[] } {
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const calls = path.join(dir, "calls.jsonl");
  const script = path.join(bin, "fake.mjs");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
const args = process.argv.slice(2);
const stdin = fs.readFileSync(0, "utf8");
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ args, stdin }) + "\\n");
const say = (l) => process.stdout.write(l + "\\n");
const silent = () => setTimeout(() => {}, 60_000);
const mode = process.env.FAKE_MODE;
say(${JSON.stringify(INIT)});
if (mode === "lively") {
  say(${JSON.stringify(RETRY)});
  // each line within the watch, all of them together longer than it
  setTimeout(() => say(${JSON.stringify(JSON.stringify({ type: "assistant", message: { id: "m1", content: [{ type: "text", text: "Image 1" }] } }))}), 1200);
  setTimeout(() => say(${JSON.stringify(RESULT("## Image 1 · M0001\nresult: nothing"))}), 2700);
} else if (!args.includes("--resume")) { say(${JSON.stringify(RETRY)}); silent(); }
else if (mode === "recover") say(${JSON.stringify(RESULT("## Image 1 · M0001\nresult: nothing"))});
else { say(${JSON.stringify(RETRY)}); silent(); }
`,
  );
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
  return {
    env: { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, HOME: dir },
    calls: () => (fs.existsSync(calls) ? fs.readFileSync(calls, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : []),
  };
}

async function reader(mode: string, more: Partial<RunOptions> = {}, watch = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom stall ř "));
  const { env, calls } = fakeClaude(dir);
  const progress: string[] = [];
  const started = Date.now();
  try {
    const r = await claudeRunner.run({
      cwd: dir,
      prompt: "Read the images — Lhoták z Lhoty, Пётр",
      kickoff: "k",
      env: { ...env, FAKE_MODE: mode },
      reader: true,
      timeoutMs: 30_000,
      ...(watch ? { stalled: { ms: 300, prompt: "Go on where you stopped." } } : {}),
      logFile: path.join(dir, "runs", "read-x-1.log"),
      onProgress: (l) => progress.push(l),
      ...more,
    });
    return { r, calls: calls(), took: Date.now() - started, progress, log: fs.readFileSync(path.join(dir, "runs", "read-x-1.log"), "utf8") };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("Claude Code's retry of its service read from its stream; the watch's default and its override", () => {
  assert.deepEqual(apiRetry(JSON.parse(RETRY)), { delayMs: 0 });
  assert.deepEqual(apiRetry({ type: "system", subtype: "api_retry", retry_delay_ms: 4200 }), { delayMs: 4200 });
  assert.equal(apiRetry({ type: "system", subtype: "init" }), undefined);
  assert.equal(apiRetry({ type: "assistant" }), undefined);
  assert.equal(readerStall({}).ms, READER_STALL_MS);
  assert.ok(READER_STALL_MS >= 120_000 && READER_STALL_MS <= 180_000, "about two and a half minutes");
  assert.equal(readerStall({ STROM_READER_STALL_MS: "250" }).ms, 250);
  assert.equal(readerStall({ STROM_READER_STALL_MS: "nic" }).ms, READER_STALL_MS);
});

test("a reader silent after a retry: stopped after the short silence, the same session resumed once with the message — it answers", unix, async () => {
  const { r, calls, took } = await reader("recover");
  assert.equal(r.outcome, "ok", r.text);
  assert.equal(r.stalls, 1);
  assert.equal(r.stalled, undefined);
  assert.match(r.text, /result: nothing/);
  assert.ok(took < 15_000, `never waited for its time limit: ${took} ms`);
  assert.equal(calls.length, 2);
  const id = calls[0]!.args[calls[0]!.args.indexOf("--session-id") + 1];
  assert.ok(id);
  assert.deepEqual(calls[1]!.args.slice(-2), ["--resume", id], "the same session, where it stopped");
  assert.match(calls[0]!.stdin, /Lhoták z Lhoty, Пётр/);
  assert.equal(calls[1]!.stdin, "Go on where you stopped.", "its brief not sent again");
  // the first start's cost unknown (stopped before its result): the whole one's partial, never a price made up
  assert.equal(r.metrics.costPartial, true);
});

test("silent again when resumed: it ends at once as halted (error, stalled) — never its time limit", unix, async () => {
  const { r, calls, took, progress } = await reader("again");
  assert.equal(r.outcome, "error");
  assert.equal(r.stalled, true);
  assert.equal(r.stalls, 2);
  assert.equal(calls.length, 2, "resumed once, not again");
  assert.ok(took < 15_000, `${took} ms`);
  assert.ok(progress.some((l) => /went silent after a retry/.test(l)) && progress.some((l) => /silent again — stopped/.test(l)), progress.join("\n"));
});

test("a retry followed by more lines is no silence; a session without the watch (the main agent's) waits to its limit as before", unix, async () => {
  const lively = await reader("lively", { stalled: { ms: 2500, prompt: "Go on where you stopped." } });
  assert.equal(lively.r.outcome, "ok");
  assert.equal(lively.r.stalls, undefined);
  assert.equal(lively.calls.length, 1);
  const plain = await reader("again", { reader: false, timeoutMs: 6000 }, false);
  assert.equal(plain.r.outcome, "timeout");
  assert.equal(plain.r.stalls, undefined);
  assert.equal(plain.calls.length, 1);
  assert.match(plain.log, /"subtype":"api_retry"/);
});
