// Antigravity ends a headless run at a command the tree's permissions refused (agy 1.3.3: the refused step, then its
// result with an empty answer and the denied action; found live — the session left interrupted, its task open). strom
// tells it to go on in the same conversation (--conversation) with what is allowed, while time is left, at most twice,
// each said in the output and the log, the level never raised; every process's use adds up.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AGY_GO_ON, antigravityRunner } from "../../src/runners/antigravity.ts";
import type { RunOptions, RunResult } from "../../src/runners/runner.ts";

const unix = { skip: process.platform === "win32" };
const CONV = "00000000-0000-4000-8000-0000000000d1";

const init = { event: "init", conversation_id: CONV, init: { cwd: "/tree" } };
const answer = (i: number, u: Record<string, number>, text?: string) => ({
  event: "step_update",
  step_update: { conversation_id: CONV, step_index: i, state: "DONE", step_type: "agent_response", ...(text ? { text_delta: text } : {}), usage: u },
});
const tool = (i: number, cmd: string, state: "ACTIVE" | "DONE" | "ERROR") => ({
  event: "step_update",
  step_update: {
    conversation_id: CONV,
    step_index: i,
    state,
    step_type: "tool",
    tool_name: "run_command",
    tool_info: {
      name: "run_command",
      parameters: { CommandLine: cmd },
      ...(state === "ERROR" ? { error: { type: "TOOL_ERROR", message: `permission check failed for unsandboxed "${cmd}": user denied permission to run command:\n${cmd}\nDo not attempt to circumvent this denial.` } } : {}),
    },
  },
});
const result = (response: string, u: Record<string, number>, denied: number) => ({
  event: "result",
  result: { conversation_id: CONV, status: "SUCCESS", response, num_turns: 1, duration_seconds: 4, usage: u, denied_actions: Array.from({ length: denied }, () => ({ action: "command", display_name: "RunCommand" })) },
});

/** The live case: strom brief, then a refused `ls`, and the run ends with no answer. */
const endsAtRefusal = [init, answer(1, { input_tokens: 30000, output_tokens: 200, cache_read_tokens: 0 }), tool(2, "strom brief", "ACTIVE"), tool(2, "strom brief", "DONE"), answer(3, { input_tokens: 2000, output_tokens: 150, cache_read_tokens: 30000 }), tool(4, "ls -la inputs notes", "ACTIVE"), tool(4, "ls -la inputs notes", "ERROR"), result("", { input_tokens: 32000, output_tokens: 350, cache_read_tokens: 30000 }, 1)];
/** Told to go on: it works through strom and answers. */
const goesOn = [init, answer(1, { input_tokens: 1500, output_tokens: 90, cache_read_tokens: 32000 }), tool(2, "strom session close", "ACTIVE"), tool(2, "strom session close", "DONE"), answer(3, { input_tokens: 500, output_tokens: 40, cache_read_tokens: 33500 }, "Zapsáno, sezení zavřeno."), result("Zapsáno, sezení zavřeno.", { input_tokens: 2000, output_tokens: 130, cache_read_tokens: 65500 }, 0)];

/** A stand-in agy: each start notes its arguments and prints the next stream of `streams` (the last one again after). */
async function agy(streams: unknown[][], opts: Partial<RunOptions> = {}): Promise<{ r: RunResult; starts: string[][]; progress: string[]; log: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom agy ě "));
  try {
    const bin = path.join(dir, "bin");
    fs.mkdirSync(bin, { recursive: true });
    streams.forEach((s, i) => fs.writeFileSync(path.join(dir, `s${i}.jsonl`), s.map((e) => JSON.stringify(e)).join("\n") + "\n"));
    const script = path.join(bin, "agent.mjs");
    fs.writeFileSync(
      script,
      `import fs from "node:fs";\nconst dir = ${JSON.stringify(dir)};\nconst asked = dir + "/asked.txt";\nconst n = fs.existsSync(asked) ? fs.readFileSync(asked, "utf8").trim().split("\\n").length : 0;\n` +
        `fs.appendFileSync(asked, JSON.stringify(process.argv.slice(2)) + "\\n");\n` +
        `process.stdout.write(fs.readFileSync(dir + "/s" + Math.min(n, ${streams.length - 1}) + ".jsonl", "utf8"));\n` +
        `process.stderr.write('jetski: no output produced — a tool required the "command" permission that headless mode cannot prompt for, so it was auto-denied.\\n');\n`,
    );
    fs.writeFileSync(path.join(bin, "agy"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
    const progress: string[] = [];
    const logFile = path.join(dir, "runs", "N0001.log");
    const r = await antigravityRunner.run({ cwd: dir, prompt: "Brief — Příliš žluťoučký kůň", kickoff: "k", env: { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, HOME: dir }, logFile, permissions: "auto", onProgress: (l) => progress.push(l), ...opts });
    const starts = fs.readFileSync(path.join(dir, "asked.txt"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
    return { r, starts, progress, log: fs.readFileSync(logFile, "utf8") };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("Antigravity that ended at a refused command goes on in its conversation, told to work through strom: said, the level kept, both processes' use", unix, async () => {
  const { r, starts, progress, log } = await agy([endsAtRefusal, goesOn], { timeoutMs: 30 * 60_000 });
  assert.equal(starts.length, 2, "it went on once");
  const [first, then] = starts as [string[], string[]];
  assert.ok(!first.includes("--conversation"));
  assert.equal(then[then.indexOf("--conversation") + 1], CONV, "the same conversation");
  const message = then[then.indexOf("--print") + 1]!;
  assert.match(message, /ls -la inputs notes/);
  assert.match(message, /only `strom …` commands are allowed/);
  // never a level that would allow it: the same switches as the first start
  assert.ok(!then.includes("--dangerously-skip-permissions"));
  assert.deepEqual(then.filter((a) => a.startsWith("--") && a !== "--conversation"), first.filter((a) => a.startsWith("--")));
  // the time left, not the whole session's again
  const left = Number(then[then.indexOf("--print-timeout") + 1]!.replace(/s$/, ""));
  assert.ok(left <= 30 * 60 && left > 29 * 60, `${left}`);
  assert.ok(progress.some((l) => /stopped at a refused command \(\$ ls -la inputs notes\).*1 of 2/.test(l)), progress.join("\n"));
  assert.match(log, /\[strom\] the agent stopped at a refused command/);
  assert.equal(r.outcome, "ok");
  assert.equal(r.text, "Zapsáno, sezení zavřeno.");
  assert.deepEqual(r.denied, ["Bash: ls -la inputs notes"]);
  const m = r.metrics;
  assert.deepEqual([m.inputTokens, m.outputTokens, m.cacheReadTokens, m.turns], [32000 + 2000, 350 + 130, 30000 + 65500, 2]);
  assert.equal(m.costPartial, undefined, "both processes said their use");
});

test("Antigravity refused again and again goes on at most twice; a refusal it went on after, a run with no time left or no conversation: no going on", unix, async () => {
  const again = await agy([endsAtRefusal]);
  assert.equal(again.starts.length, 1 + AGY_GO_ON, "at most twice");
  assert.equal(AGY_GO_ON, 2);
  assert.deepEqual(again.r.denied, Array.from({ length: 3 }, () => "Bash: ls -la inputs notes"), "each process's refusal once");
  assert.equal(again.r.metrics.inputTokens, 3 * 32000);
  // refused, then it went on by itself and answered: nothing to tell it
  const itself = await agy([[init, tool(1, "ls", "ACTIVE"), tool(1, "ls", "ERROR"), answer(2, { input_tokens: 10, output_tokens: 5, cache_read_tokens: 0 }, "Hotovo."), result("Hotovo.", { input_tokens: 10, output_tokens: 5, cache_read_tokens: 0 }, 1)]]);
  assert.equal(itself.starts.length, 1);
  // less than a minute left of the session: it ends as it ended
  const late = await agy([endsAtRefusal, goesOn], { timeoutMs: 50_000 });
  assert.equal(late.starts.length, 1);
  // a stream that named no conversation: nothing to go on in
  const unnamed = await agy([endsAtRefusal.filter((e) => e !== init), goesOn]);
  assert.equal(unnamed.starts.length, 1);
});
