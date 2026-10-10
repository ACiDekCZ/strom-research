// strom's delegates run on the model strom set for them (core/delegate.ts): the tree's Claude Code settings run
// `strom agents delegate --hook` before each call of the subagent tool (Task, Agent). A call of strom-scan-reader that
// names another model than the person's model.vision (else the model of the agent that starts it) is refused; without
// `model`, with the same model (an alias of it too), or of a subagent strom did not define, it goes on.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { claudeDelegateHooks, delegateEvent, sameModel, transcriptModel } from "../../src/core/delegate.ts";

const opts = { skip: !hasGit };

/** Claude Code's PreToolUse event of a subagent call. */
const call = (w: World, input: Record<string, unknown>, o: { tool?: string; transcript?: string } = {}) =>
  JSON.stringify({ session_id: "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: o.tool ?? "Agent", tool_input: { description: "Read", prompt: "Přečti B0001:1-6", ...input }, ...(o.transcript ? { transcript_path: o.transcript } : {}) });

async function hook(w: World, stdin: string, env: Record<string, string> = {}) {
  const r = await w.run(["agents", "delegate", "--hook"], { stdin, env: { CLAUDECODE: "1", ...env } });
  assert.equal(r.code, 0, `the hook never fails: ${r.err}`);
  const out = r.out.trim();
  return out ? (JSON.parse(out) as { hookSpecificOutput: { hookEventName: string; permissionDecision: string; permissionDecisionReason: string } }).hookSpecificOutput : undefined;
}

/** A transcript of the main agent whose last answer ran on `model`. */
function transcript(w: World, model: string): string {
  const file = path.join(w.dir, "transcript-ž.jsonl");
  const lines = [
    { type: "user", message: { role: "user", content: "Začni" } },
    { type: "assistant", message: { role: "assistant", model: "claude-older-1", content: [] } },
    { type: "assistant", isSidechain: true, message: { role: "assistant", model: "claude-sidechain-9", content: [] } },
    { type: "assistant", message: { role: "assistant", model, content: [{ type: "text", text: "Čtu" }] } },
    { type: "assistant", isSidechain: true, message: { role: "assistant", model: "claude-sonnet-5", content: [] } },
  ];
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return file;
}

test("the tree's Claude Code settings run strom's delegate hook before each subagent call (Task and Agent), beside the web hook; refreshed in an older tree", opts, async () => {
  const w = new World();
  await w.withTree();
  const file = path.join(w.cwd, ".claude", "settings.json");
  type Group = { matcher: string; hooks: { type: string; command: string; timeout: number }[] };
  const pre = () => (readJsonFile(file) as { hooks: { PreToolUse: Group[] } }).hooks.PreToolUse;
  const groups = pre();
  assert.deepEqual(groups.map((g) => g.matcher), ["WebFetch|WebSearch", "Task|Agent"]);
  const h = groups[1]!.hooks[0]!;
  assert.equal(h.type, "command");
  assert.ok(h.timeout > 0 && h.timeout <= 30, "a short time limit of its own");
  if (process.platform !== "win32") assert.equal(h.command, `'${path.join(w.cwd, ".strom", "bin", "strom")}' agents delegate --hook || true`, "the tree's own strom; its failure never blocks");
  // Windows: in PowerShell, never exit 2
  const win = claudeDelegateHooks("C:\\Users\\Jan Novák\\Strom\\T", "win32").PreToolUse[0] as { hooks: { command: string; shell?: string }[] };
  assert.equal(win.hooks[0]!.shell, "powershell");
  assert.equal(win.hooks[0]!.command, "& 'C:\\Users\\Jan Novák\\Strom\\T\\.strom\\bin\\strom.cmd' agents delegate --hook; exit 0");

  // a tree an older strom wrote (the web hook only): the agents' files bring the delegate hook in
  const old = readJsonFile(file) as { hooks: { PreToolUse: Group[] } };
  old.hooks.PreToolUse = old.hooks.PreToolUse.filter((g) => g.matcher !== "Task|Agent");
  fs.writeFileSync(file, JSON.stringify(old, null, 2) + "\n");
  await w.ok(["agents", "sync"]);
  assert.deepEqual(pre().map((g) => g.matcher), ["WebFetch|WebSearch", "Task|Agent"]);
  w.cleanup();
});

test("the event: a subagent call of Claude Code (Task or Agent) with its type and model; anything else nothing", () => {
  assert.deepEqual(delegateEvent(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Task", tool_input: { subagent_type: "strom-scan-reader", model: "sonnet", prompt: "x" }, cwd: "/t", transcript_path: "/t/a.jsonl" })), {
    tool: "Task", subagent: "strom-scan-reader", model: "sonnet", cwd: "/t", transcript: "/t/a.jsonl",
  });
  assert.equal(delegateEvent(JSON.stringify({ tool_name: "Agent", tool_input: { subagent_type: "strom-scan-reader" } }))?.model, undefined);
  for (const bad of ["", "{", "[]", JSON.stringify({ tool_name: "WebFetch", tool_input: { url: "https://example.org/" } }), JSON.stringify({ tool_name: "Agent", tool_input: { prompt: "x" } }), JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: { subagent_type: "strom-scan-reader", model: "haiku" } })])
    assert.equal(delegateEvent(bad), undefined, bad);
});

test("one model by its names: an alias of its family, a full id with its window or date; another family or version is another", () => {
  assert.ok(sameModel("claude", "opus", "claude-opus-5-5[1m]"));
  assert.ok(sameModel("claude", "claude-opus-5-5", "opus"));
  assert.ok(sameModel("claude", "Claude-Opus-5-5-20260801", "claude-opus-5-5"));
  assert.ok(!sameModel("claude", "sonnet", "claude-opus-5-5"));
  assert.ok(!sameModel("claude", "sonnet", "opus"));
  assert.ok(!sameModel("claude", "claude-opus-5", "claude-opus-5-5"));
  // an alias seen to run on a model: that model
  assert.ok(sameModel("claude", "opus", "claude-opus-5-5", { "claude opus": [{ key: "claude claude-opus-5-5", at: "2026-10-01T00:00:00Z" }] }));
  assert.ok(!sameModel("claude", "sonnet", "claude-sonnet-5", { "claude sonnet": [{ key: "claude claude-sonnet-4", at: "2026-10-01T00:00:00Z" }] }));
});

test("the transcript's last model of the main agent (never a subagent's), from its tail", () => {
  const w = new World();
  const file = transcript(w, "claude-opus-5-5");
  assert.equal(transcriptModel(file), "claude-opus-5-5");
  assert.equal(transcriptModel(file, 40), undefined, "a tail with no whole line of the main agent");
  assert.equal(transcriptModel(path.join(w.dir, "none.jsonl")), undefined);
  assert.equal(transcriptModel(undefined), undefined);
  w.cleanup();
});

test("the scan reader on the model strom set: a call without model, with the same, or of another subagent goes on; another model is refused, the way on said", opts, async () => {
  const w = new World();
  await w.withTree();
  const reader = { subagent_type: "strom-scan-reader" };
  // inherit (no model.vision): the main agent's model — from its transcript
  const opus = transcript(w, "claude-opus-5-5");
  assert.equal(await hook(w, call(w, reader, { transcript: opus })), undefined, "no model: its own");
  assert.equal(await hook(w, call(w, { ...reader, model: "opus" }, { transcript: opus })), undefined, "the same model by its alias");
  assert.equal(await hook(w, call(w, { ...reader, model: "inherit" }, { transcript: opus })), undefined);
  const no = (await hook(w, call(w, { ...reader, model: "sonnet" }, { transcript: opus })))!;
  assert.equal(no.hookEventName, "PreToolUse");
  assert.equal(no.permissionDecision, "deny");
  assert.match(no.permissionDecisionReason, /^strom: strom-scan-reader reads on the model strom set for it — the model you run on \(claude-opus-5-5\), not sonnet\. Which model reads old handwriting is the user's choice \(model\.vision\), never the agent's\. Call it again the same way without `model`\.$/);
  // the old name of the tool alike
  assert.equal((await hook(w, call(w, { ...reader, model: "haiku" }, { tool: "Task", transcript: opus })))?.permissionDecision, "deny");
  // a subagent strom did not define: left alone, whatever its model
  assert.equal(await hook(w, call(w, { subagent_type: "general-purpose", model: "sonnet" }, { transcript: opus })), undefined);
  assert.equal(await hook(w, call(w, { model: "sonnet" }, { transcript: opus })), undefined, "no type: nothing to say");
  // no transcript: what strom started the agent with (STROM_MODEL, model.lead)
  assert.equal(await hook(w, call(w, { ...reader, model: "opus" }), { STROM_MODEL: "opus" }), undefined);
  assert.equal((await hook(w, call(w, { ...reader, model: "sonnet" }), { STROM_MODEL: "opus" }))?.permissionDecision, "deny");
  // nothing known of the main agent's model (no transcript, no model.lead, no session's): nothing to compare with — any
  // model named goes on
  assert.equal(await hook(w, call(w, { ...reader, model: "opus" })), undefined);
  assert.equal(await hook(w, call(w, { ...reader, model: "sonnet" })), undefined);

  // the person chose a model for handwriting (model.vision): that one, whatever the main agent runs on
  await w.ok(["config", "set", "model.vision", "sonnet", "--for-tree"]);
  assert.equal(await hook(w, call(w, { ...reader, model: "sonnet" }, { transcript: opus })), undefined, "the person's own choice");
  assert.equal(await hook(w, call(w, reader, { transcript: opus })), undefined);
  const other = (await hook(w, call(w, { ...reader, model: "opus" }, { transcript: opus })))!;
  assert.equal(other.permissionDecision, "deny");
  assert.match(other.permissionDecisionReason, /^strom: strom-scan-reader reads on the model strom set for it — sonnet \(model\.vision\), not opus\./);
  // and with nothing known of the main agent's model: compared with model.vision all the same
  assert.equal((await hook(w, call(w, { ...reader, model: "opus" })))?.permissionDecision, "deny");
  assert.equal(await hook(w, call(w, { ...reader, model: "sonnet" })), undefined);

  // anything wrong lets the call go: no tree here, a broken event
  assert.equal(await hook(w, JSON.stringify({ tool_name: "Agent", cwd: w.dir, tool_input: { ...reader, model: "haiku" } }), {}), undefined);
  assert.equal(await hook(w, "{not json"), undefined);
  w.cleanup();
});

test("strom agents delegate: strom's subagents and the model each runs on", opts, async () => {
  const w = new World();
  await w.withTree();
  assert.deepEqual((await w.ok(["agents", "delegate", "--json"])).json.delegates, { "strom-scan-reader": "inherit" });
  await w.ok(["config", "set", "model.vision", "opus-x", "--for-tree"]);
  const o = await w.ok(["agents", "delegate"]);
  assert.match(o.out, /strom-scan-reader {2}model: opus-x \(model\.vision\)/);
  assert.match(o.out, /without `model`/);
  w.cleanup();
});
