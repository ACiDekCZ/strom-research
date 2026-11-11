// OpenCode's run as strom reads its end: exit code 1 alone after a clean end is said as such (RunResult.exitOnly, strom
// run decides), never for a reader nor beside anything else that says an error; a passing network error (a TLS
// handshake, a reset, a name not resolved) resumes the same session after a wait, within its time — never a
// cancellation, a login, a limit, a certificate, a model or a permission refused. Each start of the stand-in agent
// follows a plan: its events, its stderr, how it ends.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GO_ON_MIN_MS } from "../../src/runners/jsonl.ts";
import { opencodeError, opencodeRunner } from "../../src/runners/opencode.ts";
import { transientNetworkError, type RunOptions, type RunResult } from "../../src/runners/runner.ts";
import { agentStandIn } from "../helpers.ts";

interface Start {
  events: object[];
  stderr?: string;
  code?: number;
  /** Ends killed by this signal (not on Windows). */
  signal?: NodeJS.Signals;
  /** Works this long before it ends (at the least: a loaded computer makes it longer). */
  workMs?: number;
}

const SID = "ses_main0001";
const step = (reason: string, input = 100, output = 10) => ({ type: "step_finish", sessionID: SID, part: { type: "step-finish", reason, cost: 0.01, tokens: { input, output, reasoning: 0, cache: { read: 50, write: 0 } } } });
const text = (t: string) => ({ type: "text", sessionID: SID, part: { type: "text", text: t } });
const tool = (command: string) => ({ type: "tool_use", sessionID: SID, part: { type: "tool", tool: "bash", state: { status: "completed", input: { command } } } });
const clean = [{ type: "step_start", sessionID: SID, part: { type: "step-start" } }, tool("strom session close --summary Lhoták"), step("tool-calls"), text("Hotovo, Lhota prošlá."), step("stop")];

/** Runs OpenCode's runner on a stand-in that follows `plan` start by start; what each start was given comes back too. */
async function ran(plan: Start[], given: Partial<RunOptions> = {}, env: Record<string, string> = {}): Promise<{ r: RunResult; starts: string[][]; progress: string[]; log: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom recover ě "));
  try {
    const base = agentStandIn(dir, "opencode");
    fs.writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan));
    fs.writeFileSync(
      path.join(dir, "bin", "agent.mjs"),
      [
        'import fs from "node:fs";',
        "const dir = process.env.FAKE_DIR;",
        'const asked = dir + "/asked.jsonl";',
        'const n = fs.existsSync(asked) ? fs.readFileSync(asked, "utf8").trim().split("\\n").length : 0;',
        'fs.appendFileSync(asked, JSON.stringify(process.argv.slice(2)) + "\\n");',
        'const plan = JSON.parse(fs.readFileSync(dir + "/plan.json", "utf8"));',
        "const p = plan[Math.min(n, plan.length - 1)];",
        'for (const e of p.events) process.stdout.write(JSON.stringify(e) + "\\n");',
        "if (p.stderr) process.stderr.write(p.stderr);",
        "if (p.workMs) await new Promise((r) => setTimeout(r, p.workMs));",
        "if (p.signal) process.kill(process.pid, p.signal);",
        "else process.exitCode = p.code ?? 0;",
        "",
      ].join("\n"),
    );
    const progress: string[] = [];
    const logFile = path.join(dir, "runs", "N0001.log");
    const r = await opencodeRunner.run({
      cwd: dir,
      prompt: "Brief — Příliš žluťoučký kůň",
      kickoff: "k",
      env: { ...base, FAKE_DIR: dir, STROM_AGENT_RETRY_MS: "10,20", ...env },
      logFile,
      model: "provider/model-x",
      permissions: "auto",
      onProgress: (l) => progress.push(l),
      ...given,
    });
    const starts = fs
      .readFileSync(path.join(dir, "asked.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as string[]);
    return { r, starts, progress, log: fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8") : "" };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const unix = { skip: process.platform === "win32" };

test("exit code 1 alone after a clean end: said as such — the outcome stays the agent's (strom run decides)", async () => {
  const { r } = await ran([{ events: clean, code: 1 }]);
  assert.equal(r.outcome, "error");
  assert.equal(r.exitCode, 1);
  assert.equal(r.exitOnly, true);
  assert.equal(r.text, "Hotovo, Lhota prošlá.");
});

test("exit code 1 beside anything that says an error, or after a step that did not end: no such thing", async () => {
  const errorEvent = { type: "error", sessionID: SID, error: { name: "UnknownError", data: { message: "Lhoták: something broke" } } };
  for (const [why, start] of [
    ["an error event", { events: [...clean, errorEvent], code: 1 }],
    ["error text on stderr", { events: clean, stderr: "Error: Unexpected end of JSON input\n", code: 1 }],
    ["its last step cut off", { events: clean.slice(0, -1), code: 1 }],
    ["its last step ended by length", { events: [...clean.slice(0, -1), step("length")], code: 1 }],
    ["exit code 2", { events: clean, code: 2 }],
    ["a refused command", { events: [clean[0]!, { type: "tool_use", sessionID: SID, part: { type: "tool", tool: "bash", state: { status: "error", input: { command: "git log" }, error: "The user rejected permission to use this specific tool call." } } }, ...clean.slice(1)], code: 1 }],
  ] as const) {
    const { r } = await ran([start as Start]);
    assert.equal(r.outcome, "error", why);
    assert.equal(r.exitOnly, undefined, why);
  }
});

test("exit code 1 by a signal is no clean end", unix, async () => {
  const { r } = await ran([{ events: clean, signal: "SIGTERM" }]);
  assert.equal(r.outcome, "error");
  assert.equal(r.exitOnly, undefined);
});

test("a reader is never said to have ended cleanly by its exit code", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom reader ě "));
  try {
    const files = { views: [path.join(dir, "v1.jpg")], report: path.join(dir, "report.md") };
    for (const given of [{ reader: true }, { readerFiles: files }, { reader: true, readerFiles: files }]) {
      const { r } = await ran([{ events: clean, code: 1 }], given);
      assert.equal(r.outcome, "error");
      assert.equal(r.exitOnly, undefined);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const failed = (error: object, extra: object[] = []) => ({ events: [{ type: "step_start", sessionID: SID, part: { type: "step-start" } }, tool("strom brief"), step("tool-calls", 1000, 40), ...extra, { type: "error", sessionID: SID, error }], code: 1 });

test("a passing network error: the same session resumed after a wait, the same switches, the use of both added up", async () => {
  const told: { n: number; max: number; waitMs: number; why: string }[] = [];
  const { r, starts, log } = await ran([failed({ name: "UnknownError", data: { message: "EPROTO: The TLS handshake failed" } }), { events: [text("Hotovo."), step("stop", 300, 25)], code: 0 }], { onRecover: (x) => told.push(x) });
  assert.equal(r.outcome, "ok", r.text);
  assert.equal(r.recovered, 1);
  assert.equal(r.text, "Hotovo.");
  assert.equal(starts.length, 2);
  const [first, again] = starts as [string[], string[]];
  assert.deepEqual(first.slice(0, -1), ["run", "--format", "json", "--agent", "strom-run", "--model", "provider/model-x"]);
  assert.deepEqual(again.slice(0, 7), first.slice(0, 7), "the same level and model");
  assert.equal(again[again.indexOf("--session") + 1], SID);
  assert.match(again.at(-1)!, /connection to the model's service failed on the way \(EPROTO\)[^]*Go on exactly where you stopped/);
  assert.deepEqual(told, [{ n: 1, max: 2, waitMs: 10, why: "EPROTO" }]);
  assert.match(log, /\[strom\] the agent's connection failed \(EPROTO, exit code 1\) — its session ses_main0001 resumed in 0 s \(1\/2\)/);
  assert.deepEqual([r.metrics.inputTokens, r.metrics.outputTokens, r.metrics.turns], [1300, 65, 2], "both processes' steps");
});

test("the newer error event (session.error, its error in properties), and an error only on stderr: resumed as well", async () => {
  const v2 = { type: "session.error", sessionID: SID, properties: { sessionID: SID, error: { type: "provider_error", message: "fetch failed", cause: { code: "ECONNRESET", message: "read ECONNRESET" } } } };
  const a = await ran([{ events: [step("tool-calls"), v2], code: 1 }, { events: [step("stop")], code: 0 }]);
  assert.equal(a.r.outcome, "ok");
  assert.equal(a.r.recovered, 1);
  assert.equal(opencodeError(v2)?.whole, "provider_error: fetch failed: ECONNRESET: read ECONNRESET");
  const b = await ran([{ events: [step("tool-calls")], stderr: "Error: getaddrinfo EAI_AGAIN api.provider.example\n", code: 1 }, { events: [step("stop")], code: 0 }]);
  assert.equal(b.r.outcome, "ok");
  assert.equal(b.starts.length, 2);
  // the earlier error format still read: its message the agent's last words
  assert.deepEqual(opencodeError({ type: "error", error: { name: "APIError", data: { message: "Lhoták", statusCode: 503 } } }), { message: "Lhoták", whole: "APIError: HTTP 503: Lhoták" });
});

test("failing again and again: at most twice resumed, then the error it was", async () => {
  const told: number[] = [];
  const { r, starts } = await ran([failed({ name: "UnknownError", data: { message: "read ECONNRESET" } })], { onRecover: (x) => told.push(x.waitMs) });
  assert.equal(starts.length, 3);
  assert.deepEqual(told, [10, 20], "a growing wait");
  assert.equal(r.outcome, "error");
  assert.equal(r.recovered, 2);
  assert.match(r.text, /ECONNRESET/);
});

test("never resumed: a certificate, a login, a limit, a model, a permission, a cancellation, no network error at all", async () => {
  for (const error of [
    { name: "UnknownError", data: { message: "UNABLE_TO_VERIFY_LEAF_SIGNATURE: unable to verify the first certificate (EPROTO)" } },
    { name: "ProviderAuthError", data: { providerID: "x", message: "ECONNRESET while refreshing the token" } },
    { name: "APIError", data: { message: "Rate limit exceeded, socket hang up", statusCode: 429 } },
    { name: "APIError", data: { message: "model provider/model-x is no longer available (ETIMEDOUT)" } },
    { name: "MessageAbortedError", data: { message: "The operation was aborted: ECONNRESET" } },
    { name: "UnknownError", data: { message: "permission denied: ENOTFOUND" } },
    { name: "UnknownError", data: { message: "Unexpected token in JSON" } },
  ]) {
    const { r, starts } = await ran([failed(error), { events: [step("stop")], code: 0 }]);
    assert.equal(starts.length, 1, JSON.stringify(error));
    assert.equal(r.outcome === "ok", false, JSON.stringify(error));
    assert.equal(r.recovered, undefined);
  }
});

test("within the session's time: the wait and the work before count — too little left after the wait, it ends as it failed", async () => {
  const fail = failed({ name: "UnknownError", data: { message: "EPROTO: The TLS handshake failed" } });
  const later = { events: [step("stop")], code: 0 };
  // what must be left after the wait (GO_ON_MIN_MS) and a minute more: after a wait of 10 ms enough is left — resumed
  // (however long a loaded computer takes to start the agent); after a wait longer than that minute it would not be
  const ample = GO_ON_MIN_MS + 60_000;
  assert.equal((await ran([fail, later], { timeoutMs: ample })).starts.length, 2);
  assert.equal((await ran([fail, later], { timeoutMs: ample }, { STROM_AGENT_RETRY_MS: "61000,65000" })).starts.length, 1);
  // half a second more than must be left, and the first start worked a second before it failed: not resumed (a slower
  // computer only leaves less)
  assert.equal((await ran([{ ...fail, workMs: 1000 }, later], { timeoutMs: GO_ON_MIN_MS + 500 })).starts.length, 1);
  assert.equal((await ran([fail, later], { timeoutMs: 30_000 })).starts.length, 1);
});

test("Ctrl-C while it waits: not resumed, the run stopped", async () => {
  const stop = new AbortController();
  const { r, starts } = await ran([failed({ name: "UnknownError", data: { message: "read ECONNRESET" } }), { events: [step("stop")], code: 0 }], { signal: stop.signal, onRecover: () => stop.abort() }, { STROM_AGENT_RETRY_MS: "5000" });
  assert.equal(starts.length, 1);
  assert.equal(r.outcome, "stopped");
});

test("what is a passing network error and what is not", () => {
  for (const said of ["EPROTO: The TLS handshake failed", "Error: read ECONNRESET", "connect ETIMEDOUT 10.0.0.1:443", "getaddrinfo EAI_AGAIN api.example", "getaddrinfo ENOTFOUND api.example", "socket hang up", "UND_ERR_SOCKET other side closed"])
    assert.ok(transientNetworkError(said), said);
  for (const said of [
    "",
    "self signed certificate in certificate chain",
    "CERT_HAS_EXPIRED ECONNRESET",
    "401 Unauthorized ECONNRESET",
    "Invalid API key: ETIMEDOUT",
    "usage limit reached; ECONNRESET",
    "The operation was aborted (ECONNRESET)",
    "EPROTONOSUPPORT",
    "Příliš žluťoučký kůň ECONNRESETX",
  ])
    assert.equal(transientNetworkError(said), undefined, said);
});
