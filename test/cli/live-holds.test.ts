// What the bridge tells the Strom app of the holds (spec 127 K3.1, features task.holds and archive.holds): /status
// working[] lists an agent working directly too, each with its session's hold (by, since, its last sign of life, free by
// when at the latest); a run waiting for a restricted archive says what it waits for (waits); the queue says a task an
// open session holds (heldBy) and a task whose restricted archive another session uses now (archiveHeld) — in this
// research or another one sharing its archives. A hold that lapsed is said no more. Only a local address, no real archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, fakeConnector, hasGit } from "../helpers.ts";
import { enterWorker, markPaused } from "../../src/core/workers.ts";

/** An agent working directly (no run, no conversation of strom's): told by its own conversation's id. */
const A = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "lhotak-a" };
/** An hourly cap of the archive's service: its site is restricted whatever its terms. */
const CAPPED = { automation: "allowed", pace: { minIntervalMs: 2000, perHour: 120, source: "test" } };
const SITE = "127.0.0.1";
const MIN = 60_000;

interface Hold {
  by: string;
  since: string;
  beat: string;
  until?: string;
}
interface Item {
  who: string;
  since: string;
  session?: string;
  task?: string;
  paused?: { until: string; archive?: string; since?: string };
  hold?: Hold;
  waits?: { archive: string; since: string; until: string };
}
interface QItem {
  id: string;
  heldBy?: Hold & { session: string; who: string };
  archiveHeld?: { site: string; until: string; own: boolean; by: string; session?: string; since?: string; beat?: string };
}
interface Status {
  features: string[];
  working: Item[];
  queue: QItem[];
}

const status = async (url: string): Promise<Status> => (await (await fetch(`${url}/status`)).json()) as Status;

/** A hold's last sign of life put `minutes` back (its beat and its file's time): as if no sign came since. */
function age(root: string, session: string, minutes: number): void {
  const file = path.join(root, ".strom", "holds", `${session}.json`);
  const t = new Date(Date.now() - minutes * MIN);
  const hold = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ ...hold, since: t.toISOString(), beat: t.toISOString() }, null, 2));
  fs.utimesSync(file, t, t);
}

test("working[] with an agent working directly and its hold, a run waiting for an archive (waits), the queue's heldBy; a hold that lapsed said no more; features task.holds and archive.holds", { skip: !hasGit || process.platform === "win32", timeout: 180_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhoták");
    w.env.STROM_LIVE_POLL_MS = "100";
    for (const t of (await w.ok(["task", "list", "--state", "all", "--json"])).json.tasks as { id: string }[]) await w.ok(["task", "drop", t.id, "--reason", "test"]);
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
    const t1 = (await w.ok(["task", "add", "Křest Jana Lhotáka", "--level", "locate", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P0001", "--json"])).json.task.id as string;
    const t2 = (await w.ok(["task", "add", "Sňatek Jana Lhotáka", "--level", "locate", "--where", "matrika Lhota", "--why", "manželka", "--done-when", "zápis", "--about", "P0001", "--json"])).json.task.id as string;
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    let s = await status(info.url);
    assert.ok(s.features.includes("task.holds") && s.features.includes("archive.holds"), s.features.join(" "));
    assert.deepEqual(s.working, [], "nobody at work");

    // an agent working directly takes T1: at work, with its hold — free by its last sign + task.hold (30 min)
    const sid = (await w.ok(["session", "start", t1, "--json"], { env: A })).json.session.id as string;
    s = await status(info.url);
    assert.equal(s.working.length, 1, JSON.stringify(s.working));
    const me = s.working[0]!;
    assert.equal(me.session, sid);
    assert.match(me.who, /^Claude Code /u);
    assert.equal(me.hold!.by, "agent");
    assert.equal(Date.parse(me.hold!.until!) - Date.parse(me.hold!.beat), 30 * MIN, JSON.stringify(me.hold));
    assert.ok(Math.abs(Date.parse(me.hold!.beat) - Date.now()) < 5 * MIN);
    const held = s.queue.find((q) => q.id === t1)!;
    assert.deepEqual([held.heldBy?.session, held.heldBy?.who, held.heldBy?.by, held.heldBy?.until], [sid, "Claude Code", "agent", me.hold!.until]);
    assert.ok(!s.queue.find((q) => q.id === t2)!.heldBy, "the other task is free");

    // a run strom started, waiting for a restricted archive another session uses: paused, and waits for it
    const since = new Date(Date.now() - 3 * MIN).toISOString();
    const until = new Date(Date.now() + 27 * MIN).toISOString();
    const leave = enterWorker(w.cwd, "run-lhota", "Claude Code on its own");
    try {
      markPaused(w.cwd, "run-lhota", { until, reason: "waiting for the archive lhota-example.org", archive: "lhota-example.org", since });
      s = await status(info.url);
      const run = s.working.find((x) => !x.session)!;
      assert.deepEqual(run.waits, { archive: "lhota-example.org", since, until });
      assert.equal(run.paused?.archive, "lhota-example.org");
      assert.ok(!("hold" in run), "no session: no hold");
      assert.ok(s.working.some((x) => x.session === sid), "the agent working directly beside it");
    } finally {
      leave();
    }

    // its hold lapsed (no sign of life for longer than task.hold): no longer at work, its task no longer held
    age(w.cwd, sid, 45);
    s = await status(info.url);
    assert.deepEqual(s.working.filter((x) => x.session === sid), [], JSON.stringify(s.working));
    assert.ok(!s.queue.find((q) => q.id === t1)?.heldBy, "a lapsed hold holds nothing");
    await w.ok(["live", "stop"]);
  } finally {
    w.cleanup();
  }
});

test("archiveHeld: a task on a restricted archive another research's session uses (own: false), and one of this research's own session (own: true, its session); free again: said no more", { skip: !hasGit || process.platform === "win32", timeout: 240_000 }, async () => {
  const w = new World();
  try {
    const base = "http://127.0.0.1:9";
    const a = await w.withTree("Lhoták");
    await w.ok(["init", "Lhotka"]);
    const b = w.treeDir("Lhotka");
    await fakeConnector(w, "lhota", base, CAPPED);
    for (const cwd of [a, b]) {
      for (const t of (await w.ok(["task", "list", "--state", "all", "--json"], { cwd })).json.tasks as { id: string }[]) await w.ok(["task", "drop", t.id, "--reason", "test"], { cwd });
      await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--url", `${base}/kniha/5359`], { cwd });
      await w.ok(["task", "add", "Křest Jana Lhotáka (~1790)", "--level", "locate", "--where", "B0001", "--why", "rodiče", "--done-when", "zápis", "--priority", "5"], { cwd });
    }
    const second = (await w.ok(["task", "add", "Křest Marie Lhotákové (~1792)", "--level", "locate", "--where", "B0001", "--why", "sestra", "--done-when", "zápis", "--priority", "4", "--json"], { cwd: a })).json.task.id as string;
    const tasks = (cwd: string) => w.ok(["task", "list", "--json"], { cwd }).then((r) => r.json.tasks as { id: string; what: string }[]);
    const onSiteA = (await tasks(a)).find((t) => /^Křest Jana/u.test(t.what))!.id;
    const onSiteB = (await tasks(b)).find((t) => /^Křest Jana/u.test(t.what))!.id;

    // Lhoták's agent takes its task on the archive (and the archive with it)
    const sid = (await w.ok(["session", "start", onSiteA, "--json"], { env: A, cwd: a })).json.session.id as string;
    w.env.STROM_LIVE_POLL_MS = "100";
    const liveA = (await w.ok(["live", "start", "--json"], { cwd: a })).json as { url: string };
    const liveB = (await w.ok(["live", "start", "--json"], { cwd: b })).json as { url: string };

    // Lhotka's task on it waits for the archive another research uses
    let sb = await status(liveB.url);
    const theirs = sb.queue.find((q) => q.id === onSiteB)!;
    assert.equal(theirs.archiveHeld?.site, SITE, JSON.stringify(theirs));
    assert.deepEqual([theirs.archiveHeld!.own, theirs.archiveHeld!.by, theirs.archiveHeld!.session], [false, "agent", undefined]);
    assert.ok(Date.parse(theirs.archiveHeld!.until) > Date.now(), "free later");
    assert.ok(!theirs.heldBy);

    // Lhoták's own other task on it: its own session uses the archive; the task at work is held, not waiting
    const sa = await status(liveA.url);
    const mine = sa.queue.find((q) => q.id === second)!;
    assert.deepEqual([mine.archiveHeld?.site, mine.archiveHeld?.own, mine.archiveHeld?.session], [SITE, true, sid], JSON.stringify(mine));
    const atWork = sa.queue.find((q) => q.id === onSiteA)!;
    assert.equal(atWork.heldBy?.session, sid);
    assert.ok(!atWork.archiveHeld, "held, not waiting for its own archive");

    // the session closed: the archive let go, nothing waits for it any more
    await w.ok(["session", "close", "--summary", "hotovo", "--next", "nic", "--continue"], { env: A, cwd: a });
    sb = await status(liveB.url);
    assert.ok(!sb.queue.find((q) => q.id === onSiteB)!.archiveHeld, JSON.stringify(sb.queue));
    await w.ok(["live", "stop"], { cwd: a });
    await w.ok(["live", "stop"], { cwd: b });
  } finally {
    w.cleanup();
  }
});
