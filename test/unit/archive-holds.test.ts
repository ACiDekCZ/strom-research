// A restricted archive's hold (spec 127 K2): which sites are restricted, when a hold still holds, the queue of those
// waiting for a site and the priority of the one waiting longest once it is let go.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { cappedConnector, claimSite, holdsDir, joinQueue, PRIORITY_MS, readSiteHold, releaseHolder, releaseSite, restrictedLevel, siteLife, waiters, WAITER_STALE_MS, type Holder, type SiteHold } from "../../src/core/archiveholds.ts";

const MIN = 60_000;

function scratch(): { shared: string; env: Record<string, string>; tree: (name: string) => string; done: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-archive-holds-"));
  const config = path.join(dir, "config");
  fs.mkdirSync(config);
  return {
    shared: path.join(dir, "shared"),
    env: { HOME: dir, STROM_CONFIG_DIR: config },
    tree: (name) => fs.mkdirSync(path.join(dir, name), { recursive: true }) ?? path.join(dir, name),
    done: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

const deadPid = () => Number(spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" }).stdout);

test("a restricted site: a person's pace or browser by its terms or by the person's permission, or a connector's hourly cap", () => {
  assert.equal(restrictedLevel({ level: "restricted", browserOnly: { by: "terms" } }), true);
  assert.equal(restrictedLevel({ level: "restricted", permission: "slow" }), true);
  assert.equal(restrictedLevel({ level: "restricted", permission: "browser" }), true);
  // the person's permission slowly on an archive that allows it all the same
  assert.equal(restrictedLevel({ level: "allowed", permission: "slow" }), true);
  assert.equal(restrictedLevel({ level: "allowed" }), false);
  // restricted terms with no permission given: no request goes there at all — nothing to hold
  assert.equal(restrictedLevel({ level: "restricted" }), false);
  // closed to tools, or refusing: no request at all, never held (its refusals stay the limiter's)
  assert.equal(restrictedLevel({ level: "forbidden", browserOnly: { by: "terms" } }), false);
  assert.equal(restrictedLevel({ level: "restricted", permission: "slow", refused: { kind: "403" } as never }), false);
  assert.equal(cappedConnector({ policy: { automation: "allowed", pace: { minIntervalMs: 2000, perHour: 120 } } }), true);
  assert.equal(cappedConnector({ policy: { automation: "allowed", pace: { minIntervalMs: 2000, perHour: 0 } } }), false);
  assert.equal(cappedConnector({ policy: { automation: "allowed", pace: { minIntervalMs: 2000 } } }), false);
  assert.equal(cappedConnector({ policy: { automation: "allowed" } }), false);
});

test("a site's hold: alive while its holder sent a request within archive.hold; its process here gone or its session closed, at once not", () => {
  const s = scratch();
  const now = Date.now();
  const at = (ms: number) => new Date(ms).toISOString();
  const base: SiteHold = { site: "archiv-lhota.example", tree: s.tree("lhota"), by: "agent", agentSession: "a-1", host: os.hostname(), since: at(now - 50 * MIN), beat: at(now - 10 * MIN), seq: 1, version: "1.36.0" };
  assert.equal(siteLife(base, s.env, now).alive, true);
  const old = siteLife({ ...base, beat: at(now - 31 * MIN) }, s.env, now);
  assert.equal(old.alive, false);
  assert.equal(old.reason, "expired");
  // the person set it longer: 45 minutes
  fs.writeFileSync(path.join(s.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify({ archiveHold: 45 }));
  assert.equal(siteLife({ ...base, beat: at(now - 31 * MIN) }, s.env, now).alive, true);
  assert.equal(siteLife({ ...base, beat: at(now - 31 * MIN) }, s.env, now).until, now - 31 * MIN + 45 * MIN);
  // a fetch's process gone: at once
  assert.equal(siteLife({ ...base, by: "fetch", pid: deadPid(), beat: at(now) }, s.env, now).reason, "dead");
  // another computer's pid is never asked
  assert.equal(siteLife({ ...base, by: "fetch", pid: deadPid(), host: "jiný-počítač", beat: at(now) }, s.env, now).alive, true);
  // a session no longer held (its task hold gone: closed, taken over)
  assert.equal(siteLife({ ...base, session: "N0001", beat: at(now) }, s.env, now).reason, "dead");
  s.done();
});

test("one holder at a time; its requests beat its hold; another is refused with who holds it", () => {
  const s = scratch();
  const site = "archiv-lhota.example";
  const a: Holder = { tree: s.tree("lhota"), by: "agent", agentSession: "a-1" };
  const b: Holder = { tree: s.tree("lhotka"), by: "agent", agentSession: "b-1" };
  const first = claimSite(s.shared, site, a, s.env, { pid: -2 });
  assert.equal(first.ok, true);
  assert.equal(first.ok && first.fresh, true);
  const other = claimSite(s.shared, site, b, s.env, { pid: -3 });
  assert.equal(other.ok, false);
  assert.equal(!other.ok && other.hold?.agentSession, "a-1");
  // a request a minute later: its hold beaten, the same since
  const later = Date.now() + 61_000;
  const beat = claimSite(s.shared, site, a, s.env, { pid: -2, now: later });
  assert.equal(beat.ok && !beat.fresh, true);
  assert.equal(readSiteHold(s.shared, site)!.hold.beat, new Date(later).toISOString());
  assert.equal(readSiteHold(s.shared, site)!.hold.seq, 2);
  // lapsed (no request for archive.hold): the next one takes it
  const lapsed = claimSite(s.shared, site, b, s.env, { pid: -3, now: later + 31 * MIN });
  assert.equal(lapsed.ok && lapsed.fresh, true);
  assert.deepEqual(releaseHolder(s.shared, b), [site]);
  assert.equal(readSiteHold(s.shared, site), undefined);
  s.done();
});

test("the queue: once let go, the one waiting longest has its priority — an ending holder does not take it back meanwhile", () => {
  const s = scratch();
  const site = "archiv-lhota.example";
  const a: Holder = { tree: s.tree("lhota"), by: "agent", agentSession: "a-1" };
  const b: Holder = { tree: s.tree("lhotka"), by: "run", pid: process.pid };
  assert.equal(claimSite(s.shared, site, a, s.env, { pid: -2 }).ok, true);
  assert.equal(claimSite(s.shared, site, b, s.env).ok, false);
  joinQueue(s.shared, site, b);
  assert.equal(waiters(s.shared, site).length, 1);
  assert.equal(releaseSite(s.shared, site, a), true);
  // the holder that ended wants it again at once: the one waiting goes first
  const again = claimSite(s.shared, site, a, s.env, { pid: -2 });
  assert.equal(again.ok, false);
  assert.equal(!again.ok && !again.hold && again.waiter.tree, path.resolve(b.tree));
  const took = claimSite(s.shared, site, b, s.env);
  assert.equal(took.ok && took.fresh, true);
  // out of the queue once it has it
  assert.deepEqual(waiters(s.shared, site), []);
  s.done();
});

test("the priority lasts two minutes: the one waiting longest that does not take it lets the others in", () => {
  const s = scratch();
  const site = "archiv-lhota.example";
  const a: Holder = { tree: s.tree("lhota"), by: "agent", agentSession: "a-1" };
  const b: Holder = { tree: s.tree("lhotka"), by: "run", pid: process.pid };
  assert.equal(claimSite(s.shared, site, a, s.env, { pid: -2 }).ok, true);
  joinQueue(s.shared, site, b);
  releaseSite(s.shared, site, a);
  const freeAt = Date.parse(fs.readFileSync(path.join(holdsDir(s.shared), `${site}.free`), "utf8").trim());
  assert.equal(claimSite(s.shared, site, a, s.env, { pid: -2, now: freeAt + PRIORITY_MS - 1000 }).ok, false);
  assert.equal(claimSite(s.shared, site, a, s.env, { pid: -2, now: freeAt + PRIORITY_MS + 1000 }).ok, true);
  s.done();
});

test("one waiting whose process is gone, or that stopped looking, no longer waits", () => {
  const s = scratch();
  const site = "archiv-lhota.example";
  const gone: Holder = { tree: s.tree("lhota"), by: "fetch" };
  joinQueue(s.shared, site, gone, deadPid());
  assert.deepEqual(waiters(s.shared, site), []);
  assert.deepEqual(fs.readdirSync(path.join(holdsDir(s.shared), `${site}.wait`)), []);
  // another computer's entry not touched for WAITER_STALE_MS
  const far = joinQueue(s.shared, site, gone, 424242);
  const file = path.join(holdsDir(s.shared), `${site}.wait`, `${far.key}.json`);
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), host: "jiný-počítač", machine: "jiný" }));
  assert.equal(waiters(s.shared, site).length, 1);
  const old = new Date(Date.now() - WAITER_STALE_MS - 1000);
  fs.utimesSync(file, old, old);
  assert.deepEqual(waiters(s.shared, site), []);
  s.done();
});
