// The agents' use as each says it (core/metrics.ts, the measure of the reading of scans): every runner whose agent
// says its tokens passes them on, per request where its stream has them (Claude Code, Codex, OpenCode with its cost and
// the cache written, Grok per model response, Antigravity per step), else once at the end, with the agent's own id of
// the session —
// never a number the agent did not say. Each runner is given a stand-in of its agent that prints a recorded stream.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claudeRunner } from "../../src/runners/claude.ts";
import { codexRunner } from "../../src/runners/codex.ts";
import { opencodeRunner } from "../../src/runners/opencode.ts";
import { grokRunner } from "../../src/runners/grok.ts";
import { antigravityRunner, readEvent } from "../../src/runners/antigravity.ts";
import type { Runner, RunResult, UsageSample } from "../../src/runners/runner.ts";
import { usageFileName, usageRecorder } from "../../src/core/metrics.ts";
import { clearsOf } from "../../src/core/readstats.ts";

const fixtures = path.join(import.meta.dirname, "..", "fixtures", "agents");

/** A stand-in agent named `command` on a PATH of its own: it prints the stream of the fixture and ends. */
function standIn(dir: string, command: string): Record<string, string> {
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const script = path.join(bin, "agent.mjs");
  fs.writeFileSync(script, 'import fs from "node:fs";\nprocess.stdout.write(fs.readFileSync(process.env.FAKE_STREAM, "utf8"));\n');
  fs.writeFileSync(path.join(bin, command), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, `${command}.cmd`), `@"${process.execPath}" "${script}" %*\r\n`);
  return { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, HOME: dir, USERPROFILE: dir };
}

async function ran(runner: Runner, command: string, fixture: string): Promise<{ got: UsageSample[]; r: RunResult }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom usage ě "));
  try {
    const env = { ...standIn(dir, command), FAKE_STREAM: path.join(fixtures, fixture) };
    const got: UsageSample[] = [];
    const r = await runner.run({ cwd: dir, prompt: "Brief — Příliš žluťoučký kůň", kickoff: "k", env, logFile: path.join(dir, "runs", "N0001.log"), onUsage: (u) => got.push(u) });
    assert.equal(r.exitCode, 0, `${runner.id}: ${r.text}`);
    return { got, r };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function heard(runner: Runner, command: string, fixture: string): Promise<UsageSample[]> {
  return (await ran(runner, command, fixture)).got;
}

test("Claude Code: its session's UUID and model, each request's use once (its last line), the subagent's apart", async () => {
  const got = await heard(claudeRunner, "claude", "claude-stream.jsonl");
  assert.deepEqual(got[0], { agentSession: "00000000-0000-4000-8000-0000000000c1", model: "claude-model-x" });
  const main = got.filter((u) => u.out !== undefined && !u.sub);
  assert.deepEqual(
    main.map((u) => [u.out, u.ctx, u.model]),
    [
      [95, 21004, "claude-model-x"],
      [120, 21806, "claude-model-x"],
      [30, 22105, "claude-model-x"],
    ],
  );
  assert.deepEqual(main[0], { model: "claude-model-x", in: 4, out: 95, cr: 0, cw: 21000, cw1h: 21000, cw5m: 0, ctx: 21004 });
  const sub = got.filter((u) => u.sub);
  assert.deepEqual(
    sub.map((u) => [u.sub, u.out, u.model]),
    [
      ["toolu_02", 40, "claude-reader-y"],
      ["toolu_02", 60, "claude-reader-y"],
    ],
  );
  assert.ok(got.every((u) => u.usd === undefined), "no cost per request: Claude Code says it only for the whole session");
});

test("Codex: its thread and each turn's use as a whole with its steps — no context (its input sums the turn's requests), no cost", async () => {
  const { got, r } = await ran(codexRunner, "codex", "codex-stream.jsonl");
  assert.deepEqual(got, [
    { agentSession: "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee" },
    { total: true, in: 48210, cr: 40192, out: 1302, turns: 2 },
    { total: true, in: 51000, cr: 48000, out: 210, turns: 1 },
  ]);
  // its turns are its steps (messages, tools called), never the turns of exec
  assert.deepEqual([r.outcome, r.metrics.turns, r.metrics.inputTokens, r.metrics.costPartial], ["ok", 3, 99210, undefined]);
});

test("Codex: a turn that failed at the plan's limit — the use known kept, the rest partial, the limit said with its time", async () => {
  const { got, r } = await ran(codexRunner, "codex", "codex-stream-limit.jsonl");
  assert.deepEqual(got, [{ agentSession: "0199aaaa-bbbb-7ccc-8ddd-ffffffffffff" }, { turns: 3, partial: true }]);
  assert.equal(r.outcome, "limit", "the limit, not a crash: its words kept over the later 'turn failed'");
  assert.equal(r.resumeAt, "Oct 12th, 2026 3:05 PM");
  assert.match(r.text, /usage limit/);
  assert.deepEqual([r.metrics.turns, r.metrics.costPartial, r.metrics.inputTokens], [3, true, undefined]);
});

test("Codex: stopped at its time limit and resumed to write down — two turns' sums, neither a context (no clear made up)", { skip: process.platform === "win32" }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom usage ě "));
  try {
    const bin = path.join(dir, "bin");
    fs.mkdirSync(bin, { recursive: true });
    const script = path.join(bin, "agent.mjs");
    // exec: its turn, then it works on until stopped; exec resume: the short turn of the wrap-up
    fs.writeFileSync(
      script,
      'import fs from "node:fs";\nconst resumed = process.argv.includes("resume");\nprocess.stdout.write(fs.readFileSync(resumed ? process.env.FAKE_RESUME : process.env.FAKE_STREAM, "utf8"));\nif (!resumed) setInterval(() => {}, 1000);\n',
    );
    fs.writeFileSync(path.join(bin, "codex"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
    const env = { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, HOME: dir, FAKE_STREAM: path.join(fixtures, "codex-stream-exec.jsonl"), FAKE_RESUME: path.join(fixtures, "codex-stream-resume.jsonl") };
    const got: UsageSample[] = [];
    const r = await codexRunner.run({ cwd: dir, prompt: "Brief", kickoff: "k", env, logFile: path.join(dir, "runs", "N0001.log"), timeoutMs: 1500, wrapUp: { ms: 20_000, prompt: "Time is up" }, onUsage: (u) => got.push(u) });
    assert.equal(r.outcome, "timeout");
    assert.deepEqual(got.slice(1), [
      { total: true, in: 7012000, cr: 6800000, out: 41000, turns: 3 },
      { total: true, in: 310000, cr: 300000, out: 900, turns: 1 },
    ]);
    assert.ok(got.every((u) => u.ctx === undefined), "a turn's sum is no context: the smaller one after the resume is no clear");
    assert.deepEqual([r.metrics.inputTokens, r.metrics.turns], [7322000, 4]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Codex: its stream names no model — the one strom started it with, else its config.toml's, is the session's", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom usage ě "));
  try {
    const home = path.join(dir, "codex");
    fs.mkdirSync(home);
    fs.writeFileSync(path.join(home, "config.toml"), 'model = "gpt-model-config"\nprofile = "fast"\n[profiles.fast]\nmodel = "gpt-model-profile"\n');
    const env = { ...standIn(dir, "codex"), FAKE_STREAM: path.join(fixtures, "codex-stream.jsonl"), CODEX_HOME: home };
    const run = async (o: { model?: string; extraArgs?: string[] }) => {
      const got: UsageSample[] = [];
      const r = await codexRunner.run({ cwd: dir, prompt: "Brief", kickoff: "k", env, logFile: path.join(dir, "runs", "N0001.log"), onUsage: (u) => got.push(u), ...o });
      return { first: got[0], model: r.metrics.model };
    };
    assert.deepEqual(await run({}), { first: { agentSession: "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee", model: "gpt-model-profile" }, model: "gpt-model-profile" });
    assert.equal((await run({ model: "gpt-model-strom" })).model, "gpt-model-strom");
    assert.equal((await run({ model: "gpt-model-strom", extraArgs: ["-m", "gpt-model-own"] })).model, "gpt-model-own", "the session's own switch comes last: Codex takes it");
    assert.equal((await run({ extraArgs: ["--profile", "none"] })).model, "gpt-model-config");
    fs.rmSync(path.join(home, "config.toml"));
    assert.deepEqual(await run({}), { first: { agentSession: "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee" }, model: undefined }, "none known: none said");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Codex: a failed turn that carries its use counts it", async () => {
  const { got, r } = await ran(codexRunner, "codex", "codex-stream-failed-usage.jsonl");
  assert.deepEqual(got.slice(1), [
    { total: true, in: 30000, cr: 20000, out: 800, turns: 2 },
    { total: true, in: 32000, cr: 30000, out: 120, turns: 1 },
  ]);
  assert.deepEqual([r.outcome, r.metrics.inputTokens, r.metrics.outputTokens, r.metrics.turns, r.metrics.costPartial], ["error", 62000, 920, 3, undefined]);
});

test("OpenCode: its session, each step's use with its cost and the cache written, the scan reader's steps apart", async () => {
  const got = await heard(opencodeRunner, "opencode", "opencode-stream.jsonl");
  assert.deepEqual(got, [
    { agentSession: "ses_main0001" },
    { in: 1200, out: 100, cr: 15000, cw: 3000, ctx: 19200, usd: 0.0123 },
    { agentSession: "ses_reader0002", sub: "ses_reader0002", in: 900, out: 40, cr: 0, cw: 5000, ctx: 5900, usd: 0.004 },
    { in: 300, out: 25, cr: 18000, cw: 0, ctx: 18300, usd: 0.002 },
  ]);
});

test("Grok: its session and the whole run's use at its end, with its cost and model — its output holds its reasoning, never added again", async () => {
  const got = await heard(grokRunner, "grok", "grok-stream.jsonl");
  assert.deepEqual(got, [
    { agentSession: "00000000-0000-4000-8000-0000000000f1", model: "grok-model-z" },
    { total: true, in: 30500, out: 850, cr: 22000, usd: 0.031, turns: 3, model: "grok-model-z" },
  ]);
});

test("Grok: each model response's use as a sample of the series (the context: input, cache read and written), the whole run's with the cache written — its context clear seen", async () => {
  const got = await heard(grokRunner, "grok", "grok-stream-series.jsonl");
  assert.deepEqual(got, [
    { in: 4200, out: 400, cr: 0, cw: 52000, ctx: 56200 },
    { in: 1800, out: 420, cr: 56200, cw: 40000, ctx: 98000 },
    { in: 2500, out: 250, cr: 30000, cw: 3500, ctx: 36000 },
    { in: 900, out: 120, cr: 36000, ctx: 36900 },
    { agentSession: "00000000-0000-4000-8000-0000000000f2", model: "grok-model-z" },
    { total: true, in: 9400, out: 1190, cr: 122200, cw: 95500, usd: 0.052, turns: 4, model: "grok-model-z" },
  ]);
  // the series as readstats reads it: the context dropped once by more than a clear (98 000 → 36 000)
  const series = got.filter((u) => !u.total && u.ctx !== undefined).map((u, i) => ({ t: i, ctx: u.ctx, sub: "" }));
  assert.equal(series.length, 4);
  assert.deepEqual(clearsOf(series), { clears: 1, first: { t: 2, ctx: 98000 } });
});

test("Antigravity: its conversation, each answer step's use, the whole run's at its result — no cost", async () => {
  const got = await heard(antigravityRunner, "agy", "antigravity-stream.jsonl");
  assert.deepEqual(got, [
    { agentSession: "00000000-0000-4000-8000-000000000001" },
    { in: 14866, out: 356, cr: 0, ctx: 14866 },
    { in: 12976, out: 5153, cr: 61177, ctx: 74153 },
    { total: true, turns: 1, in: 27842, out: 5509, cr: 61177 },
  ]);
  // an event that says no use: nothing
  const none: UsageSample[] = [];
  readEvent({ event: "result", result: { status: "SUCCESS", response: "" } }, { metrics: {}, text: "", isError: false, denied: [] }, new Map(), undefined, (u) => none.push(u));
  assert.deepEqual(none, []);
});

test("the use written: a head, the agent's session once, each sample — nothing when the agent says nothing, nothing in an archive", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom usage ě "));
  try {
    const file = path.join(root, ".strom", "metrics", "usage", "N0001.jsonl");
    // said nothing: no file
    const silent = usageRecorder({ root, config: {} }, "N0001", { agent: "codex", key: "codex" });
    assert.ok(silent);
    assert.equal(fs.existsSync(file), false);
    const on = usageRecorder({ root, config: {} }, "N0001", { agent: "claude", key: "claude opus", session: "N0001" })!;
    on({ agentSession: "u-1", model: "claude-model-x" });
    on({ model: "claude-model-x", in: 4, out: 95, ctx: 21004 });
    on({ agentSession: "u-1", in: 5, out: 30 });
    const lines = fs.readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    assert.deepEqual(
      lines.map(({ at, ...rest }) => (assert.match(String(at), /^\d{4}-\d\d-\d\dT/), rest)),
      [
        { start: true, agent: "claude", key: "claude opus", session: "N0001" },
        { agentSession: "u-1", model: "claude-model-x" },
        { model: "claude-model-x", in: 4, out: 95, ctx: 21004 },
        { in: 5, out: 30 },
      ],
    );
    // an archive: no agent, nothing recorded
    assert.equal(usageRecorder({ root, config: { mode: "archive" } }, "N0002", {}), undefined);
    // a name that would lead elsewhere stays in the folder
    assert.equal(usageFileName("../../etc/x"), "_.._etc_x.jsonl");
    assert.equal(usageFileName("..\\..\\x"), "_.._x.jsonl");
    assert.equal(path.dirname(path.join(root, ".strom", "metrics", "usage", usageFileName("../a/b"))), path.join(root, ".strom", "metrics", "usage"));
    assert.equal(usageFileName("read-2026-10-10-B0001-1-6-Čtení-1"), "read-2026-10-10-B0001-1-6-Čtení-1.jsonl");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("OpenCode stopped at its time limit resumes its own session, never its scan reader's that spoke last", { skip: process.platform === "win32" }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom resume ě "));
  try {
    const bin = path.join(dir, "bin");
    fs.mkdirSync(bin, { recursive: true });
    const script = path.join(bin, "agent.mjs");
    const asked = path.join(dir, "asked.txt");
    // the first start: the stream (the reader's steps last), then works on past the limit; resumed: ends at once
    fs.writeFileSync(
      script,
      'import fs from "node:fs";\nfs.appendFileSync(process.env.FAKE_ASKED, JSON.stringify(process.argv.slice(2)) + "\\n");\n' +
        'if (process.argv.includes("--session")) process.exit(0);\nprocess.stdout.write(fs.readFileSync(process.env.FAKE_STREAM, "utf8"));\nsetTimeout(() => {}, 30_000);\n',
    );
    fs.writeFileSync(path.join(bin, "opencode"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
    const env = { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, HOME: dir, FAKE_STREAM: path.join(fixtures, "opencode-stream-reader-last.jsonl"), FAKE_ASKED: asked };
    await opencodeRunner.run({ cwd: dir, prompt: "Brief — Příliš žluťoučký kůň", kickoff: "k", env, logFile: path.join(dir, "runs", "N0001.log"), timeoutMs: 1500, wrapUp: { ms: 10_000, prompt: "Zapsat, co se našlo." } });
    const starts = fs.readFileSync(asked, "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
    assert.equal(starts.length, 2, "resumed once");
    const resumed = starts[1]!;
    assert.equal(resumed[resumed.indexOf("--session") + 1], "ses_main0001");
    assert.equal(resumed.at(-1), "Zapsat, co se našlo.");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * A stand-in agent that prints its first stream and works on until stopped (the time limit); started again with
 * `resumeFlag` among its arguments, it prints the stream of the wrap-up and ends.
 */
async function stoppedThenResumed(runner: Runner, command: string, first: unknown[], resumed: unknown[], resumeFlag: string): Promise<RunResult> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom usage ě "));
  try {
    const bin = path.join(dir, "bin");
    fs.mkdirSync(bin, { recursive: true });
    const script = path.join(bin, "agent.mjs");
    const lines = (events: unknown[]) => events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    fs.writeFileSync(path.join(dir, "first.jsonl"), lines(first));
    fs.writeFileSync(path.join(dir, "resumed.jsonl"), lines(resumed));
    fs.writeFileSync(
      script,
      `import fs from "node:fs";\nconst again = process.argv.includes(${JSON.stringify(resumeFlag)});\nprocess.stdout.write(fs.readFileSync(${JSON.stringify(dir)} + (again ? "/resumed.jsonl" : "/first.jsonl"), "utf8"));\nif (!again) setInterval(() => {}, 1000);\n`,
    );
    fs.writeFileSync(path.join(bin, command), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
    const env = { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, HOME: dir };
    return await runner.run({ cwd: dir, prompt: "Brief — Příliš žluťoučký kůň", kickoff: "k", env, logFile: path.join(dir, "runs", "N0001.log"), timeoutMs: 1500, wrapUp: { ms: 20_000, prompt: "Zapsat, co se našlo." }, onUsage: () => undefined });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const grokUsage = (n: number, inp: number, out: number, cr: number, cw?: number) => ({ type: "usage", messageId: `resp_${n}`, usage: { input_tokens: inp, output_tokens: out, cache_read_input_tokens: cr, ...(cw === undefined ? {} : { cache_creation_input_tokens: cw }) } });

test("Grok stopped at its time limit and finished through resume: the session's tokens are both processes' — the first one's from its responses, its cost unknown", { skip: process.platform === "win32" }, async () => {
  const r = await stoppedThenResumed(
    grokRunner,
    "grok",
    [grokUsage(1, 4000, 300, 0, 50000), { type: "text", data: "Čtu křty." }, grokUsage(2, 1500, 200, 50000, 2000), grokUsage(3, 900, 100, 52000)],
    [grokUsage(4, 600, 80, 52000), { type: "end", sessionId: "00000000-0000-4000-8000-0000000000f3", stopReason: "end_turn", num_turns: 1, total_cost_usd: 0.012, usage: { input_tokens: 600, output_tokens: 80, cache_read_input_tokens: 52000 }, modelUsage: { "grok-model-z": {} } }],
    "--resume",
  );
  assert.equal(r.outcome, "timeout");
  const m = r.metrics;
  assert.deepEqual([m.inputTokens, m.outputTokens, m.cacheReadTokens, m.cacheWriteTokens, m.turns], [7000, 680, 154000, 52000, 4]);
  // only the wrap-up said its cost: the first process's is unknown, never a price made up
  assert.equal(m.costUsd, 0.012);
  assert.equal(m.costPartial, true);
});

test("Claude Code stopped at its time limit and finished through resume: the first start's own requests count (its subagent's apart), its cost unknown", { skip: process.platform === "win32" }, async () => {
  const sid = "00000000-0000-4000-8000-0000000000c9";
  const said = (id: string, u: Record<string, number>, sub?: string) => ({ type: "assistant", message: { id, role: "assistant", model: "claude-model-x", content: [{ type: "text", text: "…" }], usage: u }, parent_tool_use_id: sub ?? null, session_id: sid });
  const r = await stoppedThenResumed(
    claudeRunner,
    "claude",
    [
      { type: "system", subtype: "init", model: "claude-model-x", session_id: sid },
      said("msg_01", { input_tokens: 4, cache_creation_input_tokens: 21000, cache_read_input_tokens: 0, output_tokens: 2 }),
      said("msg_01", { input_tokens: 4, cache_creation_input_tokens: 21000, cache_read_input_tokens: 0, output_tokens: 95 }),
      said("msg_02", { input_tokens: 6, cache_creation_input_tokens: 800, cache_read_input_tokens: 21000, output_tokens: 120 }),
      said("msg_s1", { input_tokens: 9000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 40 }, "toolu_02"),
      said("msg_03", { input_tokens: 3, cache_creation_input_tokens: 300, cache_read_input_tokens: 21800, output_tokens: 30 }),
    ],
    [{ type: "result", subtype: "success", is_error: false, num_turns: 1, result: "Zapsáno.", session_id: sid, total_cost_usd: 0.05, usage: { input_tokens: 2, cache_creation_input_tokens: 100, cache_read_input_tokens: 22100, output_tokens: 60 } }],
    "--resume",
  );
  assert.equal(r.outcome, "timeout");
  const m = r.metrics;
  assert.deepEqual([m.inputTokens, m.outputTokens, m.cacheReadTokens, m.cacheWriteTokens], [4 + 6 + 3 + 2, 95 + 120 + 30 + 60, 21000 + 21800 + 22100, 21000 + 800 + 300 + 100]);
  assert.equal(m.costUsd, 0.05);
  assert.equal(m.costPartial, true);
});

test("Antigravity stopped at its time limit before its result keeps its answer steps' tokens, its cost unknown", { skip: process.platform === "win32" }, async () => {
  const conv = "00000000-0000-4000-8000-0000000000a9";
  const step = (i: number, u: Record<string, number>) => ({ event: "step_update", step_update: { conversation_id: conv, step_index: i, state: "DONE", step_type: "agent_response", usage: u } });
  const r = await stoppedThenResumed(antigravityRunner, "agy", [{ event: "init", conversation_id: conv }, step(1, { input_tokens: 14000, output_tokens: 300, cache_read_tokens: 0 }), step(3, { input_tokens: 2000, output_tokens: 150, cache_read_tokens: 14000 })], [], "--never");
  assert.equal(r.outcome, "timeout");
  assert.deepEqual([r.metrics.inputTokens, r.metrics.outputTokens, r.metrics.cacheReadTokens, r.metrics.costPartial], [16000, 450, 14000, true]);
});
