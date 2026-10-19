// What the test setup makes in the temp folder (a home of its own, an empty git config) is gone when the process
// ends (found 2026-10-16: tens of thousands of strom-test-home-* left behind).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const here = import.meta.dirname;

test("test/setup.ts and test/helpers.ts leave no home and no git config in the temp folder", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "strom-cleanup-"));
  try {
    const helpers = pathToFileURL(path.join(here, "..", "helpers.ts")).href;
    const script = `import ${JSON.stringify(helpers)}; console.log(JSON.stringify({ home: process.env.HOME, git: process.env.GIT_CONFIG_GLOBAL }));`;
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(path.join(here, "..", "setup.ts")).href, "--input-type=module", "-e", script], {
      encoding: "utf8",
      env: { ...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp },
    });
    assert.equal(r.status, 0, r.stderr);
    const made = JSON.parse(r.stdout.trim().split("\n").pop()!) as { home: string; git: string };
    // made where the process was told, while it ran
    assert.ok([tmp, fs.realpathSync(tmp)].includes(path.dirname(made.home)), made.home);
    assert.match(path.basename(made.home), /^strom-test-home-/u);
    assert.equal(fs.existsSync(made.home), false, "the home of helpers.ts gone");
    assert.equal(fs.existsSync(made.git), false, "the git config gone");
    const left = fs.readdirSync(tmp).filter((n) => n.startsWith("strom-test-home-") || n.startsWith("strom-test-gitconfig-"));
    assert.deepEqual(left, [], "nothing of setup.ts nor helpers.ts left");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
