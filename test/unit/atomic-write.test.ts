// A file written whole (a temporary file renamed into place) on Windows, where an antivirus or the search indexer
// holding the target for a moment makes the rename fail with EPERM, EBUSY or EACCES: tried again for a while, then
// the error; the temporary file never left behind. Elsewhere and for any other error: no second try. A record read
// the same way (a file held without letting it be read); what fails after the waits is marked with the held file.

import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RENAME_PATIENCE, readFileRetrying, readJson, renameRetrying, writeFileAtomic, type HeldError } from "../../src/core/json.ts";

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

/** fs.readFileSync failing with these codes first for `file` (the last one for good when `forever`), then reading. */
function failingRead(t: TestContext, file: string, codes: string[], forever = false) {
  const realRead = fs.readFileSync;
  let calls = 0;
  t.mock.method(fs, "readFileSync", (f: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
    if (String(f) === file) {
      const code = codes[Math.min(calls, codes.length - 1)];
      calls++;
      if (calls <= codes.length || forever) throw Object.assign(new Error(`${code}: resource busy or locked, open`), { code });
    }
    return (realRead as (...a: unknown[]) => unknown)(f, ...rest);
  });
  return () => calls;
}

test("Windows: a record held so it cannot be read (EBUSY) is read once it is free", (t) => {
  const dir = folder(t);
  const file = path.join(dir, "_counters.json");
  fs.writeFileSync(file, '{"P":3}\n');
  asWindows(t);
  const calls = failingRead(t, file, ["EBUSY", "EPERM"]);
  assert.deepEqual(readJson(file), { P: 3 });
  assert.equal(calls(), 3);
});

test("Windows: a record held for good fails after the waits, marked with the file another program holds", (t) => {
  const dir = folder(t);
  const file = path.join(dir, "_counters.json");
  fs.writeFileSync(file, "{}\n");
  asWindows(t);
  failingRead(t, file, ["EBUSY"], true);
  const start = Date.now();
  assert.throws(() => readFileRetrying(file), (e: HeldError) => e.code === "EBUSY" && e.heldFile === file);
  assert.ok(Date.now() - start >= RENAME_PATIENCE - 100);
});

test("Windows: a rename held for good is marked with its target, not the temporary file", (t) => {
  const dir = folder(t);
  const file = path.join(dir, "strom.json");
  asWindows(t);
  failingRename(t, ["EPERM"], true);
  assert.throws(() => writeFileAtomic(file, "{}\n"), (e: HeldError) => e.code === "EPERM" && e.heldFile === file);
});

test("macOS and Linux: EPERM on a read is no held file (thrown at once, unmarked); EBUSY is one", (t) => {
  const dir = folder(t);
  const file = path.join(dir, "a.json");
  fs.writeFileSync(file, "{}\n");
  const calls = failingRead(t, file, ["EPERM"], true);
  assert.throws(() => readFileRetrying(file, "darwin"), (e: HeldError) => e.code === "EPERM" && e.heldFile === undefined);
  assert.equal(calls(), 1);
  t.mock.restoreAll();
  failingRead(t, file, ["EBUSY"], true);
  assert.throws(() => readFileRetrying(file, "linux"), (e: HeldError) => e.code === "EBUSY" && e.heldFile === file);
});
