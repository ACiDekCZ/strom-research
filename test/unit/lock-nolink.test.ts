// The tree lock on a disk without hard links (found on Windows: a drive redirected over Remote Desktop said EISDIR to
// every link, and strom wrote nothing there): the lock is created exclusively instead, appears with its content, and an
// unreadable lock counts as damaged only after a long watch (one being written on such a disk is no abandoned one: on a
// redirected drive its content appeared late, its time 0 till then).

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { acquireLock, hardLinksHere, linkForTests, readLock } from "../../src/core/lock.ts";
import { LockedError } from "../../src/core/errors.ts";

const refusing = (code: string) => () => {
  throw Object.assign(new Error(`${code}: link refused`), { code });
};

afterEach(() => linkForTests());

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "strom-nolink ěš "));

for (const code of ["EISDIR", "ENOTSUP", "EXDEV", "ENOSYS", "EPERM"])
  test(`a disk that makes no hard links (${code}): the lock is taken, whole, exclusive, and released`, () => {
    linkForTests(refusing(code));
    const dir = tmp();
    const file = path.join(dir, ".strom", "tree.lock");
    const release = acquireLock(file, { owner: "a", waitMs: 0 });
    assert.equal(readLock(file)?.owner, "a", "its content there at once");
    assert.throws(() => acquireLock(file, { owner: "b", waitMs: 0 }), LockedError, "held is held");
    release();
    assert.equal(fs.existsSync(file), false);
    acquireLock(file, { owner: "c", waitMs: 0 })();
    assert.deepEqual(fs.readdirSync(path.dirname(file)), [], "nothing left beside it");
    fs.rmSync(dir, { recursive: true, force: true });
  });

test("a link refused for another reason (no right to write) is no disk without links: said, not worked round", () => {
  linkForTests(refusing("EACCES"));
  const dir = tmp();
  const file = path.join(dir, "x.lock");
  assert.throws(() => acquireLock(file, { owner: "a", waitMs: 0 }), (e: NodeJS.ErrnoException) => e.code === "EACCES");
  assert.equal(fs.existsSync(file), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("an unreadable lock is not taken over by its file's time: watched unchanged a while first, then damaged", () => {
  const dir = tmp();
  const file = path.join(dir, "x.lock");
  fs.writeFileSync(file, "");
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(file, old, old);
  assert.throws(() => acquireLock(file, { owner: "a", waitMs: 0 }), LockedError, "old by its time, but not watched yet");
  const began = Date.now();
  const release = acquireLock(file, { owner: "a", waitMs: 20_000 });
  assert.ok(Date.now() - began >= 4900, "taken over only after watching it");
  assert.equal(readLock(file)?.owner, "a");
  release();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("an unreadable lock made long ago by the disk's own clock is taken over at once; a time of 0 is no time", () => {
  const dir = tmp();
  const file = path.join(dir, "x.lock");
  fs.writeFileSync(file, "");
  fs.utimesSync(file, 0, 0);
  assert.throws(() => acquireLock(file, { owner: "a", waitMs: 0 }), LockedError, "a time of 0 says nothing");
  const long = new Date(Date.now() - 11 * 60_000);
  fs.utimesSync(file, long, long);
  const release = acquireLock(file, { owner: "a", waitMs: 0 });
  assert.equal(readLock(file)?.owner, "a");
  release();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a stale lock on a disk without links is taken over", () => {
  linkForTests(refusing("EISDIR"));
  const dir = tmp();
  const file = path.join(dir, "x.lock");
  fs.writeFileSync(file, JSON.stringify({ pid: 999_999_999, host: os.hostname(), at: new Date().toISOString(), owner: "gone" }));
  const release = acquireLock(file, { owner: "a", waitMs: 0 });
  assert.equal(readLock(file)?.owner, "a");
  release();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("hardLinksHere: true where links go, false where the disk refuses them, nothing left either way", () => {
  const dir = tmp();
  assert.equal(hardLinksHere(dir), true);
  linkForTests(refusing("EISDIR"));
  assert.equal(hardLinksHere(dir), false);
  assert.deepEqual(fs.readdirSync(dir), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("four processes on a disk without links, one beside them with links: each addition under the lock kept", async () => {
  const { spawn } = await import("node:child_process");
  const dir = tmp();
  const file = path.join(dir, ".strom", "tree.lock");
  const counter = path.join(dir, "n");
  fs.writeFileSync(counter, "0");
  const worker = path.join(import.meta.dirname, "..", "fixtures", "lock-worker.ts");
  const run = (mode: string) =>
    new Promise<number>((resolve) => spawn(process.execPath, [worker, file, counter, "40", mode], { stdio: "inherit" }).on("exit", (code) => resolve(code ?? 1)));
  const codes = await Promise.all(["nolink", "nolink", "nolink", "nolink", "link"].map(run));
  assert.deepEqual(codes, [0, 0, 0, 0, 0]);
  assert.equal(fs.readFileSync(counter, "utf8"), "200");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("four processes on a disk showing a lock's content late, its time 0 till then: one holder at a time", async () => {
  const { spawn } = await import("node:child_process");
  const dir = tmp();
  const file = path.join(dir, ".strom", "tree.lock");
  const counter = path.join(dir, "n");
  fs.writeFileSync(counter, "0");
  const worker = path.join(import.meta.dirname, "..", "fixtures", "lock-worker.ts");
  const run = () =>
    new Promise<number>((resolve) => spawn(process.execPath, [worker, file, counter, "6", "slow"], { stdio: "inherit" }).on("exit", (code) => resolve(code ?? 1)));
  const codes = await Promise.all([1, 2, 3, 4].map(run));
  assert.deepEqual(codes, [0, 0, 0, 0], "3: two held it at once");
  assert.equal(fs.readFileSync(counter, "utf8"), "24");
  fs.rmSync(dir, { recursive: true, force: true });
});
