// An archive left alone for a while because it went silent (or asked twice to slow down) — found in a live run: an
// agent asked again 62 times in 20 minutes. strom fetch says it as "later" (exit 7), with the time rounded up and what
// to do meanwhile; --background waits for a host that frees within its wait instead of ending at once, and starts
// nothing when it frees later. The host's state is written as the limiter keeps it; no request goes to it meanwhile.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { netFile, opts, robotsReadToday, world } from "./connectors.helpers.ts";
import { until } from "../helpers.ts";
import { clockUp } from "../../src/core/net.ts";

const started = new Set<number>();
after(() => {
  for (const pid of started)
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ended already
    }
});

/** The host left alone after a silence, until `ms` from now — as the limiter writes it. */
function silentUntil(w: Parameters<typeof netFile>[0], ms: number): number {
  robotsReadToday(w);
  const file = netFile(w);
  const s = JSON.parse(fs.readFileSync(file, "utf8"));
  const until = Date.now() + ms;
  fs.writeFileSync(file, JSON.stringify({ ...s, blockedUntil: until, reason: "no answer at 2026-03-02 10:03 — the server is down, or it blocks this IP", silentRun: { n: 1, at: Date.now() } }));
  return until;
}

test("fetch: an archive left alone after silence — exit 7 at once, the time rounded up, other work meanwhile; nothing sent", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  const at = silentUntil(w, 50 * 60_000 + 22_000);
  const r = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
  assert.equal(r.code, 7, r.out + r.err);
  assert.match(r.out, /stopped: 127\.0\.0\.1: no answer at .* — left alone until/);
  assert.ok(r.out.includes(`→ 127.0.0.1 is left alone until ${clockUp(at)} (it went silent, or asked to slow down — strom sends it nothing before then): try again at ${clockUp(at)}, not sooner`), r.out);
  // outside a session (the person at a terminal): other work; a session hears more (fetch-asked-again.test.ts)
  assert.ok(r.out.includes(`next: other work until ${clockUp(at)} — no sleeping, no asking again sooner`), r.out);
  assert.doesNotMatch(r.out, /limit is used up/);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 0, "nothing goes to the archive meanwhile");
  // --json: the time to try again, rounded up, and the host
  const j = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1", "--json"]);
  assert.equal(j.code, 7);
  const data = JSON.parse(j.out) as { retryAt: string; leftAlone: string };
  assert.equal(data.leftAlone, "127.0.0.1");
  assert.equal(Date.parse(data.retryAt), Math.ceil(at / 60_000) * 60_000);
  w.cleanup();
});

test("fetch --background: an archive left alone longer than its wait — nothing started, exit 7; within it — started, it waits, --status says until when", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "B1", "--why", "zkouška", "--done-when", "hotovo"]);
  await w.ok(["session", "start", "T1"]);
  // in the foreground within a session: the way to let it wait is said
  const soon = silentUntil(w, 20 * 60_000);
  const fg = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
  assert.equal(fg.code, 7, fg.out + fg.err);
  assert.match(fg.out, /or let it wait by itself: strom fetch zkusebni 5359 --images 1-2 --recordset B0001 --background/);
  // longer than a fetch in the background waits: nothing started
  silentUntil(w, 50 * 60_000);
  const long = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1", "--background"]);
  assert.equal(long.code, 7, long.out + long.err);
  assert.match(long.out, /nothing started in the background: 127\.0\.0\.1 is left alone longer than a fetch in the background waits \(30 min\)/);
  assert.doesNotMatch(long.out, /or let it wait by itself/);
  assert.deepEqual(fs.existsSync(path.join(w.cwd, ".strom", "fetch")) ? fs.readdirSync(path.join(w.cwd, ".strom", "fetch")).filter((f) => f.endsWith(".pid") || f.startsWith("active")) : [], []);
  // within it: started, said, and it waits for the archive (nothing sent before the time)
  const at = silentUntil(w, 20 * 60_000);
  assert.ok(at >= soon);
  const bg = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1", "--background"]);
  const pid = Number(/pid (\d+)/.exec(bg.out)?.[1]);
  started.add(pid);
  assert.match(bg.out, /fetching 2 images of B0001 \(images 1–2\) in the background/);
  assert.ok(bg.out.includes(`127.0.0.1 is left alone until ${clockUp(at)} (it went silent, or asked to slow down): the fetch waits for it, then goes on by itself`), bg.out);
  await until("the fetch in the background waits for the archive", async () => /waits for the archive until (\d{4}-\d\d-\d\d )?\d\d:\d\d, then goes on by itself/.test((await w.ok(["fetch", "--status"])).out), { ms: 30_000 });
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 0);
  // stopped while it waits: it ends at once, no timer keeps it
  assert.doesNotMatch((await w.ok(["fetch", "--stop", "B1"])).out, /still stopping/);
  w.cleanup();
});
