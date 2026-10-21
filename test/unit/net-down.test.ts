// A host that went silent (or asked twice to slow down) is left alone for a while: the caller hears until when,
// rounded up to the minute (a try at the minute said never comes too early); silence again before it answered leaves
// it alone longer (an hour, two, four — never shorter); a fetch in the background (lane) waits for a host that frees
// within its wait, the foreground never does. A fake clock and fake transports: nothing is slept, nothing leaves here.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { politeGet, hostState, clockUp, clock, leftAloneFor, NetError, SILENT_COOL_MS } from "../../src/core/net.ts";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "strom net down "));
const HOST = "archive.example.org";
const URL_ = `https://${HOST}/img/1`;
const MIN = 60_000;
const HOUR = 3600_000;

function world() {
  let now = Date.parse("2026-03-02T09:00:00Z") + 22_000; // 22 s past the minute
  let up = false;
  let calls = 0;
  const slept: number[] = [];
  const dir = tmp();
  const fetchImpl = (async () => {
    calls++;
    if (!up) throw new TypeError("fetch failed");
    return new Response("ok");
  }) as unknown as typeof fetch;
  const base = {
    stateDir: dir,
    hosts: [HOST],
    now: () => now,
    sleep: async (ms: number) => void (slept.push(ms), (now += ms)),
    fetchImpl,
  };
  return {
    dir,
    base,
    slept,
    calls: () => calls,
    at: () => now,
    pass: (ms: number) => void (now += ms),
    answer: (yes: boolean) => void (up = yes),
  };
}

test("net down: silence leaves the host alone an hour, said rounded up to the minute; a request meanwhile is not sent", async () => {
  const w = world();
  await assert.rejects(politeGet(URL_, w.base), (e: NetError) => {
    assert.equal(e.failure, "silent");
    assert.equal(e.until, hostState(w.dir, HOST).blockedUntil);
    assert.ok(e.until! - w.at() >= HOUR - MIN && e.until! - w.at() <= HOUR, String(e.until! - w.at()));
    // 22 s past the minute: the minute after, never the one before
    assert.match(e.message, new RegExp(`leaves it alone until ${clockUp(e.until!)}`));
    assert.notEqual(clockUp(e.until!), clock(e.until!));
    return true;
  });
  const sent = w.calls();
  await assert.rejects(politeGet(URL_, w.base), (e: NetError) => e.failure === "blocked" && e.until !== undefined && /do not retry before/.test(e.hint ?? ""));
  assert.equal(w.calls(), sent, "nothing goes to a host left alone");
});

test("net down: silent again before it answered — two hours, then four, never more; an answer starts from an hour again", async () => {
  const w = world();
  const off = async () => {
    await assert.rejects(politeGet(URL_, w.base), (e: NetError) => e.failure === "silent");
    const s = hostState(w.dir, HOST);
    const ms = s.blockedUntil! - w.at();
    w.pass(ms + 1000);
    return ms;
  };
  const near = (ms: number, want: number) => assert.ok(Math.abs(ms - want) < 5 * MIN, `${ms} ≈ ${want}`);
  near(await off(), SILENT_COOL_MS[0]);
  near(await off(), SILENT_COOL_MS[1]);
  near(await off(), SILENT_COOL_MS[2]);
  near(await off(), SILENT_COOL_MS[2]);
  assert.ok(SILENT_COOL_MS.every((ms) => ms >= HOUR), "never shorter than an hour");
  w.answer(true);
  assert.equal((await politeGet(URL_, w.base)).status, 200);
  assert.equal(hostState(w.dir, HOST).silentRun, undefined);
  w.answer(false);
  w.pass(HOUR);
  near(await off(), SILENT_COOL_MS[0]);
  // a day later, a silence counts from an hour again
  w.pass(25 * HOUR);
  near(await off(), SILENT_COOL_MS[0]);
});

test("net down: in the background a host that frees within the wait is waited for, then asked; the foreground ends at once", async () => {
  const w = world();
  await assert.rejects(politeGet(URL_, w.base), (e: NetError) => e.failure === "silent");
  const until = hostState(w.dir, HOST).blockedUntil!;
  w.pass(HOUR - 20 * MIN); // 20 minutes left
  w.answer(true);
  const sent = w.calls();
  // the foreground: at once, with the time
  await assert.rejects(politeGet(URL_, { ...w.base, lane: "foreground", waitMs: 30 * MIN }), (e: NetError) => e.failure === "blocked" && e.until === until);
  assert.equal(w.calls(), sent);
  // the background with a shorter wait: at once too
  await assert.rejects(politeGet(URL_, { ...w.base, lane: "background", waitMs: 10 * MIN }), (e: NetError) => e.failure === "blocked" && e.until === until);
  assert.equal(w.calls(), sent);
  // the background within its wait: told, waited for, then the request
  const told: string[] = [];
  const r = await politeGet(URL_, { ...w.base, lane: "background", waitMs: 30 * MIN, onWait: (x) => void told.push(`${x.why} ${Math.round(x.ms / MIN)}`) });
  assert.equal(r.status, 200);
  assert.deepEqual(told, ["down 20"]);
  assert.ok(w.at() >= until, "nothing before the time");
  assert.equal(w.calls(), sent + 1);
});

test("net down: a refusal is never waited for, in the background neither", async () => {
  const w = world();
  const s = { recent: [], blockedUntil: w.at() + 10 * MIN, reason: "it refused us (HTTP 403 at …)", refusedKind: "load" as const };
  assert.equal(leftAloneFor(s, w.at()), undefined);
  assert.equal(leftAloneFor({ recent: [], blockedUntil: w.at() + 10 * MIN, reason: "it refused the browser (HTTP 403 at …)" }, w.at()), undefined);
  assert.equal(leftAloneFor({ recent: [], blockedUntil: w.at() + 10 * MIN, reason: "no answer at … — the server is down" }, w.at()), w.at() + 10 * MIN);
  assert.equal(leftAloneFor({ recent: [], blockedUntil: w.at() - 1, reason: "no answer" }, w.at()), undefined);
});

test("clockUp: a time waited until is said rounded up to the minute; a whole minute stays", () => {
  const today = new Date(2026, 2, 2, 8, 0, 0).getTime();
  assert.equal(clockUp(new Date(2026, 2, 2, 11, 3, 22, 742).getTime(), today), "11:04");
  assert.equal(clockUp(new Date(2026, 2, 2, 11, 3, 0, 0).getTime(), today), "11:03");
  assert.equal(clockUp(new Date(2026, 2, 2, 23, 59, 1).getTime(), today), "2026-03-03 00:00");
});
