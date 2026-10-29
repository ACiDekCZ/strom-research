// The log of a run without the images its agent looked at (found 2026-10-27: 95–99 % of 16 GB of logs were the same
// scans in base64, twice in each line of Claude Code's stream). Each runner that writes its agent's stream writes it a
// whole line at a time through the same cut (core/logimages.ts): the image's place and size said, the view named when
// known; what the runner reads of the stream (the use, the result) it reads from the full line.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claudeRunner } from "../../src/runners/claude.ts";
import { codexRunner } from "../../src/runners/codex.ts";
import { agentStandIn } from "../helpers.ts";
import type { Runner, UsageSample } from "../../src/runners/runner.ts";

const fixtures = path.join(import.meta.dirname, "..", "fixtures", "agents");
const DATA = "/9j/4AAQSkZJRgABAQAAAQABAAD".repeat(20_000);

async function logOf(runner: Runner, command: string, stream: string[]): Promise<{ log: string; got: UsageSample[]; text: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom log ě "));
  try {
    const file = path.join(dir, "stream.jsonl");
    fs.writeFileSync(file, stream.join("\n") + "\n");
    const env = { ...agentStandIn(dir, command), FAKE_STREAM: file };
    const got: UsageSample[] = [];
    const logFile = path.join(dir, "runs", "N0001.log");
    const r = await runner.run({ cwd: dir, prompt: "Brief — Lhoták z Lhoty", kickoff: "k", env, logFile, onUsage: (u) => got.push(u) });
    assert.equal(r.exitCode, 0, `${runner.id}: ${r.text}`);
    return { log: fs.readFileSync(logFile, "utf8"), got, text: r.text };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("Claude Code: the log without the image's two copies, the view named; its use and result read as before", async () => {
  const lines = fs.readFileSync(path.join(fixtures, "claude-stream.jsonl"), "utf8").trimEnd().split("\n");
  const view = "/tmp/Lhota/.strom/views/B0001-7-ab12.jpg";
  const call = JSON.stringify({ type: "assistant", message: { id: "msg_view", content: [{ type: "tool_use", id: "toolu_view", name: "Read", input: { file_path: view } }] }, parent_tool_use_id: null });
  const image = JSON.stringify({
    type: "user",
    message: { role: "user", content: [{ tool_use_id: "toolu_view", type: "tool_result", content: [{ type: "image", source: { type: "base64", data: DATA, media_type: "image/jpeg" } }] }] },
    parent_tool_use_id: null,
    tool_use_result: { type: "image", file: { base64: DATA, type: "image/jpeg", originalSize: 400_000 } },
  });
  const stream = [...lines.slice(0, 2), call, image, ...lines.slice(2)];
  const plain = await logOf(claudeRunner, "claude", lines);
  const { log, got, text } = await logOf(claudeRunner, "claude", stream);
  assert.ok(!log.includes(DATA.slice(0, 2048)), "no base64 of the image in the log");
  assert.ok(log.length < 20_000, String(log.length));
  const rows = log.trimEnd().split("\n");
  assert.equal(rows.length, stream.length);
  for (const r of rows) JSON.parse(r);
  const cut = JSON.parse(rows[3]!);
  assert.equal(cut.tool_use_result.file.base64, `[image 396 kB left out: ${view}]`);
  assert.equal(cut.message.content[0].content[0].source.data, `[image 396 kB left out: ${view}]`);
  // every other line as the agent wrote it
  assert.deepEqual(rows.filter((_, i) => i !== 3), stream.filter((_, i) => i !== 3));
  // what the runner read of the stream: the same as without the image
  assert.deepEqual(got, plain.got);
  assert.equal(text, plain.text);
});

test("Codex (and every runner of JSON lines): the same cut, the events read from the full line", async () => {
  const lines = fs.readFileSync(path.join(fixtures, "codex-stream.jsonl"), "utf8").trimEnd().split("\n");
  const image = JSON.stringify({ type: "item.completed", item: { id: "item_9", type: "image_view", path: "/tmp/Lhota/x.jpg", image_url: `data:image/jpeg;base64,${DATA}` } });
  const stream = [...lines.slice(0, 4), image, ...lines.slice(4)];
  const plain = await logOf(codexRunner, "codex", lines);
  const { log, got } = await logOf(codexRunner, "codex", stream);
  assert.ok(!log.includes(DATA.slice(0, 2048)));
  const rows = log.trimEnd().split("\n");
  assert.equal(JSON.parse(rows[4]!).item.image_url, "data:image/jpeg;base64,[image 396 kB left out]");
  assert.deepEqual(rows.filter((_, i) => i !== 4), stream.filter((_, i) => i !== 4));
  assert.deepEqual(got, plain.got);
});
