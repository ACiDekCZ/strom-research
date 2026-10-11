// The Antigravity runner: the brief in a file it reads whole (agy reads no stdin beside --print and keeps only the
// end of a long command output), its stream read — output tokens as it counts them, refusals named.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { antigravityArgs, antigravityBriefFile, antigravityFirstMessage, readEvent } from "../../src/runners/antigravity.ts";
import type { Heard } from "../../src/runners/jsonl.ts";

const sample = path.join(import.meta.dirname, "..", "fixtures", "agents", "antigravity-stream.jsonl");

test("antigravity: the first message points to the brief's file — the brief never in argv", () => {
  const file = antigravityBriefFile(path.join("/tree", ".strom", "runs", "N0001.log"));
  assert.equal(file, path.join("/tree", ".strom", "runs", "N0001.prompt.md"));
  const first = antigravityFirstMessage(file);
  assert.match(first, /^Your brief for this strom session is the file .*N0001\.prompt\.md\. Read that whole file first/);
  assert.match(first, /last ~8 kB of a command's output/);
  const args = antigravityArgs({ permissions: "auto", shared: "/shared", timeoutMs: 300_000 }, first);
  assert.deepEqual(args, ["--print", first, "--output-format", "stream-json", "--add-dir", "/shared", "--print-timeout", "300s"]);
  assert.ok(args.join(" ").length < 2000, "a short command line (Windows: 32k)");
  assert.deepEqual(antigravityArgs({ permissions: "full", model: "m" }, "k"), ["--print", "k", "--output-format", "stream-json", "--dangerously-skip-permissions", "--model", "m"]);
});

test("antigravity: a recorded stream — output tokens hold its thinking, refusals named, progress from its steps", () => {
  const heard: Heard = { metrics: {}, text: "", isError: false, denied: [] };
  const progress: string[] = [];
  const said = new Map<number, string>();
  for (const line of fs.readFileSync(sample, "utf8").split("\n")) if (line.trim()) readEvent(JSON.parse(line) as Record<string, unknown>, heard, said, (l) => progress.push(l));
  // input + output = total: the thinking tokens are not added again
  assert.deepEqual(heard.metrics, { inputTokens: 27842, outputTokens: 5509, cacheReadTokens: 61177, turns: 1, durationMs: 29500 });
  assert.equal(heard.text, "Křest nalezen, zapsáno.\nDalší řádek.\n");
  assert.equal(heard.isError, false);
  // the refused command by its step, the rest of denied_actions by their kind; a file that is not there is no refusal
  assert.deepEqual(heard.denied, ["Bash: git log -1", "ReadUrlContent"]);
  assert.deepEqual(progress, [
    "view_file /tree/.strom/runs/N0001.prompt.md",
    "$ strom person card P0001",
    "$ git log -1",
    "refused by permissions: $ git log -1",
    "view_file /tree/missing.txt",
    "Křest nalezen, zapsáno.",
    "refused by permissions: ReadUrlContent",
  ]);
});

test("antigravity: denied_actions alone (no step said it) are still counted", () => {
  const heard: Heard = { metrics: {}, text: "", isError: false, denied: [] };
  readEvent({ event: "result", result: { status: "SUCCESS", response: "", usage: { input_tokens: 10, output_tokens: 5, thinking_tokens: 4 }, denied_actions: [{ action: "command", display_name: "RunCommand" }] } }, heard, new Map());
  assert.deepEqual(heard.denied, ["Bash: (a command)"]);
  assert.equal(heard.metrics.outputTokens, 5);
});
