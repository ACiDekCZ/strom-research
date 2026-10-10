// The agents' own web tools heard from their streams (core/metrics.ts): a page fetched with its host, a search, each
// once, after the fact — never one the permissions refused, never another tool. Grok, Antigravity, OpenCode and Codex
// from their streams; Claude Code never from its stream (its hook counts its WebFetch: once, not twice). Written to
// fetch.jsonl as `via` web|search lines of their own. Each runner is given a stand-in of its agent that prints a stream.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claudeRunner } from "../../src/runners/claude.ts";
import { codexRunner } from "../../src/runners/codex.ts";
import { opencodeRunner } from "../../src/runners/opencode.ts";
import { grokRunner } from "../../src/runners/grok.ts";
import { antigravityRunner } from "../../src/runners/antigravity.ts";
import type { Runner, RunResult } from "../../src/runners/runner.ts";
import { recordAgentWeb, webHost, webOpt, type AgentWeb } from "../../src/core/metrics.ts";

const fixtures = path.join(import.meta.dirname, "..", "fixtures", "agents");

/** A stand-in agent named `command` on a PATH of its own: it prints the stream of the file and ends. */
function standIn(dir: string, command: string): Record<string, string> {
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const script = path.join(bin, "agent.mjs");
  fs.writeFileSync(script, 'import fs from "node:fs";\nprocess.stdout.write(fs.readFileSync(process.env.FAKE_STREAM, "utf8"));\n');
  fs.writeFileSync(path.join(bin, command), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, `${command}.cmd`), `@"${process.execPath}" "${script}" %*\r\n`);
  return { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, HOME: dir, USERPROFILE: dir };
}

/** What a runner passed on of its agent's web tools, and the lines of fetch.jsonl they made in a research's folder. */
async function heardWeb(runner: Runner, command: string, stream: string): Promise<{ got: AgentWeb[]; lines: Record<string, unknown>[]; r: RunResult }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom web ě "));
  try {
    const env = { ...standIn(dir, command), FAKE_STREAM: stream };
    const got: AgentWeb[] = [];
    const tree = { root: path.join(dir, "Dvořákovi"), config: {} };
    const write = webOpt(tree, { session: "N0007", key: `${runner.id} model-w`, agent: runner.id }).onWeb!;
    const r = await runner.run({ cwd: dir, prompt: "Brief — Příliš žluťoučký kůň", kickoff: "k", env, logFile: path.join(dir, "runs", "N0007.log"), onWeb: (w) => (got.push(w), write(w)) });
    assert.equal(r.exitCode, 0, `${runner.id}: ${r.text}`);
    const file = path.join(tree.root, ".strom", "metrics", "fetch.jsonl");
    const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>) : [];
    return { got, lines, r };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** The lines without their time (checked apart). */
const shape = (lines: Record<string, unknown>[]) =>
  lines.map(({ at, ...rest }) => {
    assert.ok(typeof at === "string" && !Number.isNaN(Date.parse(at)), `at: ${String(at)}`);
    return rest;
  });

test("Grok: its web_fetch with the host of its page and its web_search, each once when done; a refused fetch never (strom's hook too), a failed one asked all the same", async () => {
  const { got, lines, r } = await heardWeb(grokRunner, "grok", path.join(fixtures, "grok-stream-web.jsonl"));
  assert.deepEqual(got, [
    // with the id of its call: the tree's hook records the same call by it (counted once)
    { via: "web", url: "https://Obec.Example/historie/kostel", tool: "web_fetch", toolUse: "call_1" },
    { via: "search", tool: "web_search", toolUse: "call_2" },
    { via: "web", url: "http://obec.example:8080/kronika", tool: "web_fetch", toolUse: "call_4" },
  ]);
  assert.deepEqual(shape(lines), [
    { via: "web", host: "obec.example", domain: "obec.example", session: "N0007", key: "grok model-w", agent: "grok", tool: "web_fetch", from: "stream", toolUse: "call_1" },
    { via: "search", session: "N0007", key: "grok model-w", agent: "grok", tool: "web_search", from: "stream", toolUse: "call_2" },
    { via: "web", host: "obec.example:8080", domain: "obec.example", session: "N0007", key: "grok model-w", agent: "grok", tool: "web_fetch", from: "stream", toolUse: "call_4" },
  ]);
  // strom's own hook refused one ("Hook denied: strom: …"): strom's refusal, not the permissions'; another hook's a
  // refusal like the permissions' — neither went out
  assert.deepEqual(r.refused, ["web_fetch: https://kronika.example/rok/1871"]);
  assert.deepEqual(r.denied, ["web_fetch: https://zakazano.example/x", "web_fetch: https://jinde.example/a"]);
  assert.deepEqual([r.metrics.refused, r.metrics.denied], [1, 2]);
});

test("Antigravity: search_web and read_url_content once per step when done (a step said done twice counts once); a refused one never", async () => {
  const { got, lines } = await heardWeb(antigravityRunner, "agy", path.join(fixtures, "antigravity-stream-web.jsonl"));
  assert.deepEqual(got, [
    { via: "search", tool: "search_web" },
    { via: "web", url: "https://obec.example/historie", tool: "read_url_content" },
  ]);
  assert.deepEqual(
    shape(lines).map((l) => [l.via, l.host, l.agent, l.from]),
    [
      ["search", undefined, "antigravity", "stream"],
      ["web", "obec.example", "antigravity", "stream"],
    ],
  );
});

test("OpenCode: webfetch and websearch once per call (said again: once), a failed fetch counted, a rejected one never", async () => {
  const { got, lines } = await heardWeb(opencodeRunner, "opencode", path.join(fixtures, "opencode-stream-web.jsonl"));
  assert.deepEqual(got, [
    { via: "web", url: "https://obec.example/historie", tool: "webfetch" },
    { via: "search", tool: "websearch" },
    { via: "web", url: "https://Kronika.Example:8443/rok/1870", tool: "webfetch" },
  ]);
  assert.deepEqual(
    shape(lines).map((l) => [l.via, l.host]),
    [
      ["web", "obec.example"],
      ["search", undefined],
      ["web", "kronika.example:8443"],
    ],
  );
});

test("Codex: its web search — a search, a page it opened with its host; a find in a page already open asks nothing more", async () => {
  const { got, lines } = await heardWeb(codexRunner, "codex", path.join(fixtures, "codex-stream-web.jsonl"));
  assert.deepEqual(got, [
    { via: "search", tool: "web_search" },
    { via: "web", url: "https://obec.example/historie", tool: "web_search" },
    { via: "search", tool: "web_search" },
  ]);
  assert.deepEqual(
    shape(lines).map((l) => [l.via, l.host, l.agent]),
    [
      ["search", undefined, "codex"],
      ["web", "obec.example", "codex"],
      ["search", undefined, "codex"],
    ],
  );
});

test("Claude Code: nothing from its stream (its hook counts its WebFetch and WebSearch)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom web claude "));
  try {
    const stream = path.join(dir, "claude-web.jsonl");
    const session = "00000000-0000-4000-8000-0000000000c9";
    const line = (o: unknown) => JSON.stringify(o);
    fs.writeFileSync(
      stream,
      [
        line({ type: "system", subtype: "init", cwd: "/tree", session_id: session, tools: ["Bash", "WebFetch", "WebSearch"], model: "claude-model-x" }),
        line({ type: "assistant", message: { id: "m1", role: "assistant", model: "claude-model-x", content: [{ type: "tool_use", id: "t1", name: "WebFetch", input: { url: "https://obec.example/historie", prompt: "dějiny" } }], usage: { input_tokens: 4, output_tokens: 5 } }, parent_tool_use_id: null, session_id: session }),
        line({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "stránka" }] }, parent_tool_use_id: null, session_id: session }),
        line({ type: "assistant", message: { id: "m2", role: "assistant", model: "claude-model-x", content: [{ type: "tool_use", id: "t2", name: "WebSearch", input: { query: "Týnec" } }], usage: { input_tokens: 4, output_tokens: 5 } }, parent_tool_use_id: null, session_id: session }),
        line({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t2", content: "výsledky" }] }, parent_tool_use_id: null, session_id: session }),
        line({ type: "result", subtype: "success", is_error: false, result: "Hotovo.", session_id: session, num_turns: 2, total_cost_usd: 0.01, usage: { input_tokens: 8, output_tokens: 10 } }),
      ].join("\n") + "\n",
    );
    const { got, lines, r } = await heardWeb(claudeRunner, "claude", stream);
    assert.deepEqual([got, lines], [[], []]);
    assert.equal(r.refused, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Claude Code: a call strom's own hook refused is strom's refusal, not the permissions' (its result lists both)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom web claude "));
  try {
    const stream = path.join(dir, "claude-refused.jsonl");
    const session = "00000000-0000-4000-8000-0000000000ca";
    const line = (o: unknown) => JSON.stringify(o);
    const reason = "strom: 12 requests to kronika.example through the web fetch tool in this session — more pages or items of one server go through strom fetch with a connector";
    fs.writeFileSync(
      stream,
      [
        line({ type: "system", subtype: "init", cwd: "/tree", session_id: session, tools: ["Bash", "WebFetch"], model: "claude-model-x" }),
        line({ type: "assistant", message: { id: "m1", role: "assistant", model: "claude-model-x", content: [{ type: "tool_use", id: "t1", name: "WebFetch", input: { url: "https://kronika.example/rok/1871", prompt: "dějiny" } }], usage: { input_tokens: 4, output_tokens: 5 } }, parent_tool_use_id: null, session_id: session }),
        // as Claude Code 2.x says it (live, 2026-10-10): the hook's reason after its own words, the meta saying a hook
        line({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: `PreToolUse:WebFetch hook error: ${reason}`, is_error: true, tool_use_id: "t1" }] }, parent_tool_use_id: null, session_id: session, tool_result_meta: [{ id: "t1", non_execution_kind: "permission-rule", permission_decision: { decision: "reject", source: "hook", reason_type: "hook" } }] }),
        line({ type: "assistant", message: { id: "m2", role: "assistant", model: "claude-model-x", content: [{ type: "tool_use", id: "t2", name: "Bash", input: { command: "git push" } }], usage: { input_tokens: 4, output_tokens: 5 } }, parent_tool_use_id: null, session_id: session }),
        line({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "Permission to use Bash has been denied.", is_error: true, tool_use_id: "t2" }] }, parent_tool_use_id: null, session_id: session }),
        line({
          type: "result", subtype: "success", is_error: false, result: "Hotovo.", session_id: session, num_turns: 2, total_cost_usd: 0.01, usage: { input_tokens: 8, output_tokens: 10 },
          permission_denials: [
            { tool_name: "WebFetch", tool_use_id: "t1", tool_input: { url: "https://kronika.example/rok/1871", prompt: "dějiny" } },
            { tool_name: "Bash", tool_use_id: "t2", tool_input: { command: "git push" } },
          ],
        }),
      ].join("\n") + "\n",
    );
    const { r } = await heardWeb(claudeRunner, "claude", stream);
    assert.deepEqual(r.refused, ["WebFetch: https://kronika.example/rok/1871"]);
    assert.deepEqual(r.denied, ["Bash: git push"]);
    assert.deepEqual([r.metrics.refused, r.metrics.denied], [1, 1]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the host of a page as fetch.jsonl names it: lowercase, its port only when not the scheme's own, any script", () => {
  assert.equal(webHost("https://Obec.Example:443/a?b=1"), "obec.example");
  assert.equal(webHost("http://obec.example:80/a"), "obec.example");
  assert.equal(webHost("http://obec.example:8080/a"), "obec.example:8080");
  assert.equal(webHost("obec.example/kronika"), "obec.example");
  // a name in another script: as the address resolves it (the limiter's hosts are the same)
  assert.equal(webHost("https://Příklad.example/x"), new URL("https://příklad.example/x").host);
  assert.equal(webHost("https://пример.example/x"), new URL("https://пример.example/x").host);
  assert.equal(webHost("file:///etc/passwd"), undefined);
  assert.equal(webHost(""), undefined);
  // a page without a host it can be told by: nothing written
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom web host "));
  try {
    recordAgentWeb(dir, { via: "web", url: "about:blank", session: "N0001" });
    assert.ok(!fs.existsSync(path.join(dir, ".strom", "metrics", "fetch.jsonl")));
    // an archive records nothing
    assert.deepEqual(webOpt({ root: dir, config: { mode: "archive" } }, { session: "N0001" }), {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
