// An archive left alone for a while (it went silent): a session is told once (exit 7, until when, the next step), and
// a fetch of the same session asking it again before then ends at once — exit 8, no estimate, nothing sent. Found in a
// live run: an agent ran the same fetch 78 times in 38 minutes, each answered "left alone until …". Outside a
// session, in another session, after the time off, and at a new time off strom set since: as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { netFile, opts, robotsReadToday, world } from "./connectors.helpers.ts";
import { clockUp } from "../../src/core/net.ts";

/** The host left alone after a silence, until `ms` from now — as the limiter writes it. */
function silentUntil(w: Parameters<typeof netFile>[0], ms: number): number {
  robotsReadToday(w);
  const file = netFile(w);
  const s = JSON.parse(fs.readFileSync(file, "utf8"));
  const until = Date.now() + ms;
  fs.writeFileSync(file, JSON.stringify({ ...s, blockedUntil: until, reason: "no answer at 2026-03-02 10:03 — the server is down, or it blocks this IP", silentRun: { n: 1, at: Date.now() } }));
  return until;
}

/** The time off over (or lifted): the host takes requests again. */
function awake(w: Parameters<typeof netFile>[0]): void {
  const file = netFile(w);
  const { blockedUntil: _b, reason: _r, silentRun: _s, ...s } = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify(s));
}

const images = (a: { hits: string[] }) => a.hits.filter((h) => h.startsWith("/img/")).length;

test("fetch: a session told once that an archive is left alone — the next step said, asked again: exit 8 at once, nothing sent", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  await w.ok(["task", "add", "Křest Jana Lhotáka", "--level", "locate", "--where", "B1", "--why", "zkouška", "--done-when", "hotovo"]);
  await w.ok(["session", "start", "T1"]);
  const at = silentUntil(w, 50 * 60_000);
  const first = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
  assert.equal(first.code, 7, first.out + first.err);
  // what to do now, exactly: other work, or the task back to the queue — and that asking again is refused
  assert.ok(first.out.includes(`next: work on what needs nothing from 127.0.0.1 (images here already, another book); the task needs it: back to the queue for later — strom session close --continue --summary "…" --next "…" — no sleeping, no fetch of 127.0.0.1 before ${clockUp(at)}: asked again in this session, strom refuses at once (exit 8)`), first.out);
  const told = path.join(w.cwd, ".strom", "left-alone");
  assert.equal(fs.readdirSync(told).length, 1, "kept for the session");
  // asked again (other images too): refused before anything — no estimate, no request
  for (const args of [["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"], ["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B1"], ["fetch", "zkusebni", "--find", "Lhota"]]) {
    const again = await w.run(args);
    assert.equal(again.code, 8, again.out + again.err);
    assert.match(again.err, new RegExp(`127\\.0\\.0\\.1 is left alone until ${clockUp(at)} \\(it went silent, or asked to slow down\\) — this session was told so already: nothing done, nothing sent`));
    assert.match(again.err, /no fetch of 127\.0\.0\.1 before .*: work on what needs nothing from it, or back to the queue for later — strom session close --continue/);
    assert.doesNotMatch(again.err + again.out, /requests to 127\.0\.0\.1/, "no estimate");
  }
  // --json: the code and the time, for a program
  const j = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1", "--json"]);
  assert.equal(j.code, 8);
  const e = JSON.parse(j.out) as { code: string; params: { host: string; until: string } };
  assert.equal(e.code, "fetch.left-alone");
  assert.equal(e.params.host, "127.0.0.1");
  assert.equal(Date.parse(e.params.until), Math.ceil(at / 60_000) * 60_000);
  // what is being fetched is still said
  assert.equal((await w.run(["fetch", "--status"])).code, 0);
  assert.equal(images(a), 0, "nothing goes to the archive");
  // a new time off strom set since (a new silence) is a new answer: told once again
  silentUntil(w, 3 * 3600_000);
  assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"])).code, 7);
  assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"])).code, 8);
  // the time off over: a fetch as usual
  awake(w);
  const ok = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
  assert.equal(ok.code, 0, ok.out + ok.err);
  assert.match(ok.out, /2 images of B0001 \(images 1–2\) fetched and registered/);
  assert.equal(images(a), 2);
  w.cleanup();
});

test("fetch: asked again in another session, or outside a session — exit 7 as before; the session's note goes with it", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  await w.ok(["task", "add", "Křest Jana Lhotáka", "--level", "locate", "--where", "B1", "--why", "zkouška", "--done-when", "hotovo"]);
  silentUntil(w, 50 * 60_000);
  // no session: told each time, as before (the person at a terminal)
  for (let i = 0; i < 2; i++) {
    const r = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
    assert.equal(r.code, 7, r.out + r.err);
    assert.match(r.out, /next: other work until \d\d:\d\d — no sleeping, no asking again sooner/);
    assert.doesNotMatch(r.out, /exit 8/);
  }
  assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "left-alone")), "nothing kept outside a session");
  await w.ok(["session", "start", "T1"]);
  assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"])).code, 7);
  assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"])).code, 8);
  await w.ok(["session", "close", "--continue", "--summary", "archiv neodpovídá", "--next", "stáhnout snímky 1–2 B0001"]);
  assert.deepEqual(fs.readdirSync(path.join(w.cwd, ".strom", "left-alone")), [], "gone with its session");
  // the next session is told once again
  await w.ok(["session", "start", "T1"]);
  assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"])).code, 7);
  assert.equal(images(a), 0);
  w.cleanup();
});

test("brief: an archive of the task's books left alone after silence — work elsewhere and on after the time; none: not a word of it", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  await w.ok(["task", "add", "Křest Jana Lhotáka", "--level", "locate", "--where", "B1", "--why", "zkouška", "--done-when", "hotovo"]);
  robotsReadToday(w);
  const calm = await w.ok(["session", "start", "T1"]);
  assert.match(calm.out, /archive|B0001/);
  assert.doesNotMatch(calm.out, /left alone|back to the queue for later/);
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "znovu"]);
  const at = silentUntil(w, 50 * 60_000);
  const brief = await w.ok(["session", "start", "T1"]);
  assert.ok(brief.out.includes(`— nothing to it before then: work on what needs nothing from it, else back to the queue for later (strom session close --continue) and on after ${clockUp(at)}`), brief.out);
  w.cleanup();
});
