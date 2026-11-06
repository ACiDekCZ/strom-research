// A conversation that ended is no longer at work, in the app too (found 2026-11-06: ended with /exit, the app still
// showed "Claude Code conversation" and the spinner at a person, .strom/workers empty):
//   - /status asked after who is at work changed waits for the new state — the state before, answered when the new one
//     took longer than STROM_LIVE_STATUS_WAIT_MS, said the conversation still worked and nothing asked again;
//   - a worker's lock written under the computer's other name (a Mac's hostname changes with the network) is decided by
//     its pid here, never kept a week; a worker of another computer (a research on a network disk) keeps the time rule.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { StatusKeeper, splitStatus, type StatusMade } from "../../src/core/livestatus.ts";
import { acquireLock, liveHolder, machineId, readLock } from "../../src/core/lock.ts";
import { enterWorker, liveWorkers } from "../../src/core/workers.ts";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "strom-ended ěš "));

/** A keeper whose /status takes `ms` to be made and says who was at work when it was asked. */
function slowKeeper(root: string, atWork: () => string, state: () => string, ms: number): StatusKeeper {
  const keeper = new StatusKeeper({
    root,
    env: { STROM_LIVE_STATUS_WAIT_MS: "30" },
    atWork,
    stateNow: state,
    inline: (_v, key) => splitStatus({ working: JSON.parse(atWork()) }, key),
    note: () => undefined,
  });
  // made elsewhere, slowly (as a busy computer's thread)
  (keeper as unknown as { onThread: (v: string | undefined, key: string) => Promise<StatusMade> }).onThread = (_v, key) => {
    const working = JSON.parse(atWork());
    return new Promise((resolve) => setTimeout(() => resolve(splitStatus({ working, state: state() }, key)), ms));
  };
  return keeper;
}

const working = (m: StatusMade) => (JSON.parse(m.full) as { working: unknown[] }).working;

test("/status after a conversation ended: never the state before, however long the new one takes", async () => {
  const root = tmp();
  let atWork = JSON.stringify([{ id: "claude-1", label: "Claude Code conversation" }]);
  let state = "a";
  const keeper = slowKeeper(root, () => atWork, () => state, 300);
  try {
    assert.equal(working(await keeper.get("3.24.0")).length, 1, "at work");
    // something else changed (a setting): the state before at once, as before (the app's patience is short)
    state = "b";
    // (no clock: the answer is the state before — the new one, made slowly, would carry "b"; a busy computer can
    // never fail it)
    const before = await keeper.get("3.24.0");
    assert.match(before.full, /"state":"a"/, "answered without waiting for the new");
    assert.equal(working(before).length, 1);
    // the conversation ended (/exit): the ask waits for the new state, never says it still works
    atWork = "[]";
    state = "c";
    const after = await keeper.get("3.24.0");
    assert.deepEqual(working(after), [], "nobody at work");
    assert.match(after.full, /"state":"c"/);
    // and one beginning: the same
    atWork = JSON.stringify([{ id: "codex-2", label: "Codex conversation" }]);
    assert.equal(working(await keeper.get("3.24.0")).length, 1);
  } finally {
    keeper.end();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** A pid no process has now (one that just ended). */
function deadPid(): number {
  const r = spawnSync(process.execPath, ["-e", ""]);
  return r.pid!;
}

test("a worker written under the computer's other name: its pid decides here; another computer's: the time", (t) => {
  const here = machineId();
  if (!here) return t.skip("this system gives no id of the computer");
  const root = tmp();
  try {
    // a worker strom writes says which computer it is on
    const leave = enterWorker(root, "claude-1", "Claude Code conversation", "1.28.0");
    const file = path.join(root, ".strom", "workers", "claude-1.json");
    assert.equal(readLock(file)?.machine, here);
    leave();
    const dir = path.dirname(file);
    fs.mkdirSync(dir, { recursive: true });
    const write = (id: string, info: Record<string, unknown>) =>
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ host: "Another-Name-Of-This-Mac.local", at: new Date().toISOString(), owner: "Claude Code conversation", ...info }));
    // this computer, its name changed since: the conversation's process is gone → no longer at work
    write("gone", { pid: deadPid(), machine: here });
    // this computer under another name, the process alive → at work
    write("alive", { pid: process.pid, machine: here });
    // another computer (a network disk), its pid unknown here → at work by the time, as before
    write("elsewhere", { pid: deadPid(), machine: "0123456789abcdef" });
    // a worker of an older strom (no computer said): as before
    write("older", { pid: deadPid() });
    assert.deepEqual(liveWorkers(root).map((w) => w.id).sort(), ["alive", "elsewhere", "older"]);
    assert.equal(fs.existsSync(path.join(dir, "gone.json")), false, "cleared away");
    // the tree's lock keeps its rule: no computer said, another name → the time (a research shared over a network disk)
    const lock = path.join(root, ".strom", "tree.lock");
    const release = acquireLock(lock, { owner: "strom", waitMs: 0 });
    assert.equal(readLock(lock)?.machine, undefined, "only a worker says its computer");
    release();
    fs.writeFileSync(lock, JSON.stringify({ pid: deadPid(), host: "Another-Name-Of-This-Mac.local", at: new Date().toISOString(), owner: "strom" }));
    assert.ok(liveHolder(lock), "held by another computer's process, by the time");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
