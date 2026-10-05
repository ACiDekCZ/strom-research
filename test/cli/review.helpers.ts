// What the tests of review share: they are split over files (review*.test.ts) that run side by side.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { enterWorker } from "../../src/core/workers.ts";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { acquireLock } from "../../src/core/lock.ts";
import { LockedError } from "../../src/core/errors.ts";
import { prependPath } from "../../src/runners/runner.ts";
import { claudeArgs, headlessEnv } from "../../src/runners/claude.ts";
import { codexResumeArgs } from "../../src/runners/codex.ts";
import { clockLine, deadlineOf } from "../../src/core/clock.ts";
import { parseBatch } from "../../src/commands/batch.ts";
import { permissionPath } from "../../src/agents/files.ts";

export const opts = { skip: !hasGit };
export const agent = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

export async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Josefa", "--new-person", "Josef /Novák/", "--sex", "M", "--born", "ABT 1885", "--born-place", "Kamenice nad Lipou"]);
  return w;
}

/** `strom run` as a real process (signals reach it, not the test runner); resolves when a session is open. */
export function startRun(w: World, args: string[]) {
  const child = spawn(process.execPath, [path.join(import.meta.dirname, "..", "..", "src", "cli.ts"), "run", ...args], { cwd: w.cwd, env: w.env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const exited = new Promise<{ code: number | null; signal: string | null; out: string }>((resolve) => child.on("exit", (code, signal) => resolve({ code, signal, out })));
  const opened = new Promise<void>((resolve, reject) => {
    const t0 = Date.now();
    const poll = setInterval(() => {
      if (fs.existsSync(path.join(w.cwd, "data", "sessions", "N0001.json")) && /▶ N0001/.test(out)) resolve(clearInterval(poll));
      else if (Date.now() - t0 > 20_000) reject(new Error(`no session started: ${out}`));
    }, 100);
  });
  return { child, exited, opened, out: () => out };
}
