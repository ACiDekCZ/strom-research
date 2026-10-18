// A file written whole (a temporary file renamed into place) on Windows, where an antivirus or the search indexer
// holding the target for a moment makes the rename fail with EPERM, EBUSY or EACCES: tried again for a while, then
// the error; the temporary file never left behind. Elsewhere and for any other error: no second try.

import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RENAME_PATIENCE, renameRetrying, writeFileAtomic } from "../../src/core/json.ts";

const realRename = fs.renameSync;

function folder(t: TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-atomic-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** process.platform as Windows says it, for this test alone. */
function asWindows(t: TestContext): void {
  const was = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { ...was, value: "win32" });
  t.after(() => Object.defineProperty(process, "platform", was));
}

/** fs.renameSync failing with these codes first (one per call; the last one for good when `forever`), then renaming. */
function failingRename(t: TestContext, codes: string[], forever = false) {
  let calls = 0;
  t.mock.method(fs, "renameSync", (from: fs.PathLike, to: fs.PathLike) => {
    const code = codes[Math.min(calls, codes.length - 1)];
    calls++;
    if (calls <= codes.length || forever) throw Object.assign(new Error(`${code}: operation not permitted, rename`), { code });
    realRename(from, to);
  });
  return () => calls;
}

const tmpsIn = (dir: string) => fs.readdirSync(dir).filter((f) => f.endsWith(".tmp"));

test("Windows: a target held twice (EPERM) is written on the third try, no temporary file left", (t) => {
  const dir = folder(t);
  const file = path.join(dir, "strom.json");
  fs.writeFileSync(file, "old\n");
  asWindows(t);
  const calls = failingRename(t, ["EPERM", "EPERM"]);
  writeFileAtomic(file, "new\n");
  assert.equal(calls(), 3);
  assert.equal(fs.readFileSync(file, "utf8"), "new\n");
  assert.deepEqual(tmpsIn(dir), []);
});

test("Windows: EBUSY and EACCES are a held file too", (t) => {
  const dir = folder(t);
  const file = path.join(dir, "P0001.json");
  asWindows(t);
  const calls = failingRename(t, ["EBUSY", "EACCES"]);
  writeFileAtomic(file, "{}\n");
  assert.equal(calls(), 3);
  assert.equal(fs.readFileSync(file, "utf8"), "{}\n");
});

test("Windows: a target held for good fails with its error after the waits, the old file kept, the temporary file gone", (t) => {
  const dir = folder(t);
  const file = path.join(dir, "strom.json");
  fs.writeFileSync(file, "old\n");
  asWindows(t);
  const calls = failingRename(t, ["EPERM"], true);
  const start = Date.now();
  assert.throws(() => writeFileAtomic(file, "new\n"), { code: "EPERM" });
  const took = Date.now() - start;
  assert.ok(calls() > 3, `tried ${calls()} times`);
  assert.ok(took >= RENAME_PATIENCE - 100 && took < RENAME_PATIENCE + 1500, `waited ${took} ms`);
  assert.equal(fs.readFileSync(file, "utf8"), "old\n");
  assert.deepEqual(tmpsIn(dir), []);
});

test("Windows: any other error (ENOENT) is thrown at once, no second try", (t) => {
  const dir = folder(t);
  asWindows(t);
  const calls = failingRename(t, ["ENOENT"], true);
  assert.throws(() => writeFileAtomic(path.join(dir, "x.json"), "{}\n"), { code: "ENOENT" });
  assert.equal(calls(), 1);
  assert.deepEqual(tmpsIn(dir), []);
});

test("macOS and Linux: EPERM is a lasting refusal there, thrown at once", (t) => {
  const dir = folder(t);
  fs.writeFileSync(path.join(dir, "a"), "a");
  for (const platform of ["darwin", "linux"] as const) {
    const calls = failingRename(t, ["EPERM"], true);
    assert.throws(() => renameRetrying(path.join(dir, "a"), path.join(dir, "b"), platform), { code: "EPERM" });
    assert.equal(calls(), 1, platform);
    t.mock.restoreAll();
  }
});
