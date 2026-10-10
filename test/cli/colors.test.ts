// An agent's shell that sets both NO_COLOR and FORCE_COLOR (Grok Build's): no warning of Node's on every strom
// command — strom prints no colours, NO_COLOR stands for strom and what it starts.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import "../helpers.ts";
import { settleColors } from "../../src/cli/colors.ts";

const cli = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");

test("NO_COLOR and FORCE_COLOR both: FORCE_COLOR goes, NO_COLOR stays; one alone untouched", () => {
  const both: Record<string, string | undefined> = { NO_COLOR: "1", FORCE_COLOR: "1", LANG: "cs_CZ.UTF-8" };
  assert.equal(settleColors(both), true);
  assert.deepEqual(both, { NO_COLOR: "1", LANG: "cs_CZ.UTF-8" });
  for (const one of [{ NO_COLOR: "1" }, { FORCE_COLOR: "0" }, {}]) {
    const env: Record<string, string | undefined> = { ...one };
    assert.equal(settleColors(env), false);
    assert.deepEqual(env, one);
  }
});

test("strom in a shell with both set says no word of Node's about colours", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom barvy ž "));
  try {
    const env = { ...process.env, HOME: dir, USERPROFILE: dir, STROM_CONFIG_DIR: path.join(dir, "config"), STROM_UPDATES: "off", NO_COLOR: "1", FORCE_COLOR: "1" };
    const r = spawnSync(process.execPath, [cli, "--version"], { env, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^strom \d/);
    assert.doesNotMatch(r.stderr, /NO_COLOR|FORCE_COLOR|Warning/, r.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
