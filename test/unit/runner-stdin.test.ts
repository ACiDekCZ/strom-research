// A headless agent that ends before it read its brief closes the pipe: the rest of the write fails with EPIPE, which
// must never end strom itself (found 2026-10-07: "write EPIPE" at the script runner in a full npm test). Each runner
// that writes the brief on stdin is given a child that exits at once, without reading, and a brief far larger than a
// pipe's buffer (the script runner's also goes into its environment, STROM_PROMPT: within the system's limit).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scriptRunner } from "../../src/runners/script.ts";
import { codexRunner } from "../../src/runners/codex.ts";
import { claudeRunner } from "../../src/runners/claude.ts";
import type { Runner } from "../../src/runners/runner.ts";

const brief = (bytes: number) => `Brief — Příliš žluťoučký kůň, Пётр Иванов.\n${"x".repeat(bytes)}\n`;

async function runOnce(runner: Runner, env: Record<string, string>, dir: string, prompt: string) {
  const errors: unknown[] = [];
  const caught = (e: unknown) => errors.push(e);
  process.on("uncaughtException", caught);
  try {
    const r = await runner.run({ cwd: dir, prompt, kickoff: "k", env, logFile: path.join(dir, "run.log") });
    // an error of the stream comes after the child's end now and then: a moment for it
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { r, errors };
  } finally {
    process.off("uncaughtException", caught);
  }
}

test("a runner whose child exits at once without reading its brief: no EPIPE escapes, the run ends as the child did", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-stdin-"));
  try {
    const script = path.join(dir, "exits.mjs");
    fs.writeFileSync(script, "process.exit(3);\n");
    const { r, errors } = await runOnce(scriptRunner, { PATH: process.env.PATH ?? "", STROM_RUNNER_SCRIPT: script }, dir, brief(256 * 1024));
    assert.deepEqual(errors, []);
    assert.equal(r.exitCode, 3);
    assert.equal(r.outcome, "error");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the agents' runners that write the brief on stdin (Claude Code, the JSON-lines ones): an agent that ends at once", { skip: process.platform === "win32" }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-stdin-"));
  try {
    const bin = path.join(dir, "bin");
    fs.mkdirSync(bin);
    for (const name of ["claude", "codex"]) fs.writeFileSync(path.join(bin, name), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const env = { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, HOME: dir };
    for (const runner of [claudeRunner, codexRunner]) {
      const { r, errors } = await runOnce(runner, env, dir, brief(16 * 1024 * 1024));
      assert.deepEqual(errors, [], runner.id);
      assert.ok(r.exitCode !== undefined, runner.id);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
