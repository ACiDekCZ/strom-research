// The agent started from a device (spec 094 K3.15, src/core/deviceagent.ts): the device's yes kept for the terminal —
// once, for that link and that device, YES_MS long, sent by the gateway before the terminal takes it; what waits for the
// person at the computer (.strom/asking) — a mark of a process that is gone counts for nothing and is taken away; the
// glance says it (withAsking: the run asking marked too, never in an archive).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { YES_MS, askingNow, fromDevice, markAsking, newYes, sendYes, takeYes, yesHolds } from "../../src/core/deviceagent.ts";
import { withAsking, withRuns, type Glance } from "../../src/core/glance.ts";

const LINK = "strom-research://work?tree=t_lhota&do=tasks&n=2";
const DEV = "dv_abcdefghijklmnop";

function scratch(): { root: string; done: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-deviceagent-ěš-"));
  return { root, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("the device's yes: for that link and device alone, sent once by the gateway, taken once by the terminal, gone after YES_MS", () => {
  const { root, done } = scratch();
  try {
    const now = Date.now();
    const { yes, expiresAt } = newYes(root, LINK, DEV, now);
    assert.match(yes, /^[A-Za-z0-9_-]{22}$/u);
    assert.equal(Date.parse(expiresAt), now + YES_MS);
    // as the device sends it: that link, that device, in time
    assert.ok(yesHolds(root, yes, LINK, DEV, now));
    assert.ok(!yesHolds(root, yes, `${LINK}&x=1`, DEV, now), "another link");
    assert.ok(!yesHolds(root, yes, LINK, "dv_bbbbbbbbbbbbbbbb", now), "another device");
    assert.ok(!yesHolds(root, yes, LINK, DEV, now + YES_MS), "too late");
    assert.ok(!yesHolds(root, "../../x", LINK, DEV, now), "no token's shape");
    // not sent: the terminal takes nothing
    assert.ok(!takeYes(root, yes, LINK, DEV, now));
    // sent: never sent again, the terminal takes it once
    sendYes(root, yes);
    assert.ok(!yesHolds(root, yes, LINK, DEV, now), "sent: not sent again");
    // the terminal did not open: sent back, the device may send it again
    sendYes(root, yes, false);
    assert.ok(yesHolds(root, yes, LINK, DEV, now));
    sendYes(root, yes);
    assert.ok(!takeYes(root, yes, LINK, "dv_bbbbbbbbbbbbbbbb", now), "another device's terminal");
    assert.ok(takeYes(root, yes, LINK, DEV, now));
    assert.ok(!takeYes(root, yes, LINK, DEV, now), "once");
    assert.ok(!yesHolds(root, yes, LINK, DEV, now));
    // an old one goes when a new one is made
    const old = newYes(root, LINK, DEV, now - 2 * YES_MS).yes;
    newYes(root, LINK, DEV, now);
    assert.ok(!fs.existsSync(path.join(root, ".strom", "device-yes", `${old}.json`)));
  } finally {
    done();
  }
});

test("the device that opened a terminal: its id and name from STROM_FROM_DEVICE(_NAME) — the name in NFC, an id of no device none", () => {
  assert.deepEqual(fromDevice({ STROM_FROM_DEVICE: DEV, STROM_FROM_DEVICE_NAME: "Telefon Lhotáků".normalize("NFD") }), { id: DEV, name: "Telefon Lhotáků" });
  assert.deepEqual(fromDevice({ STROM_FROM_DEVICE: DEV, STROM_FROM_DEVICE_NAME: "Лхота телефон" }), { id: DEV, name: "Лхота телефон" });
  assert.equal(fromDevice({ STROM_FROM_DEVICE: "dev-A" }), undefined);
  assert.equal(fromDevice({}), undefined);
});

test("what waits at the computer: a mark of a living process said (its run, its device), one of a process gone taken away; the glance says it", () => {
  const { root, done } = scratch();
  try {
    const run = `run-${process.pid}-abc`;
    const unmark = markAsking(root, "question", { STROM_FROM_DEVICE: DEV, STROM_WORKER: run });
    const dir = path.join(root, ".strom", "asking");
    // a mark of a process that ended
    const dead = spawnSync(process.execPath, ["-e", ""]).pid!;
    const gone = path.join(dir, `${dead}-1.json`);
    fs.writeFileSync(gone, JSON.stringify({ kind: "consent", since: new Date(0).toISOString(), pid: dead }) + "\n");
    // a mark of no shape of its own: left alone, said nothing of
    fs.writeFileSync(path.join(dir, `${process.pid}-999.json`), JSON.stringify({ kind: "other", since: "x" }) + "\n");
    const now = askingNow(root, [run]);
    assert.equal(now.length, 1, JSON.stringify(now));
    assert.deepEqual({ ...now[0], since: undefined }, { kind: "question", since: undefined, run, device: DEV });
    assert.ok(!fs.existsSync(gone), "the mark of a process gone taken away");

    // the glance: what waits and the run asking — never in an archive
    const g: Glance = { head: "h", tree: { id: "t", name: "Lhotákovi", lang: "cs", state: "research", persons: 1, families: 0 }, now: [], runs: [], lines: [], waiting: { n: 0, items: [] }, people: {} };
    const withRun = withRuns(g, [{ id: run, research: null, since: "2026-11-25T10:00:00Z", state: "working", sessions: 1, device: { id: DEV, name: "Telefon Lhotáků" } } as never]);
    assert.deepEqual(withRun.runs[0]!.device, { id: DEV, name: "Telefon Lhotáků" });
    const asked = withAsking(withRun, now);
    assert.deepEqual(asked.onComputer, now);
    assert.deepEqual(asked.runs[0]!.onComputer, { kind: "question", since: now[0]!.since });
    assert.equal(withAsking(withRun, []).onComputer, undefined, "nothing waits: none");
    assert.equal(withAsking({ ...withRun, tree: { ...withRun.tree, state: "archive" } }, now).onComputer, undefined, "an archive: nothing of it");

    unmark();
    assert.deepEqual(askingNow(root), []);
    // no research: nothing marked, nothing fails
    assert.doesNotThrow(() => markAsking(undefined, "consent", {})());
  } finally {
    done();
  }
});
