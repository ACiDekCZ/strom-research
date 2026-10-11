// A host's state (<shared>/net/<host>.json) that holds what strom never writes there — a request's time a year ahead
// (the clock set back, a hand edit), a string, a negative number, a number JSON cannot hold — is read as broken: those
// parts left out, the hour told again by the caller's journal, the next request paced as any, and the file written
// clean. Never faster than the state says: a wait the host or a refusal set stays however far ahead it lies, a slowdown
// beyond the most strom writes is that most.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { agentRequest, hostState, politeGet, readHostState, reserveSlots, setOwnPace, DEFAULT_PACE, NetError, REFUSED_MS, SLOTS_AHEAD_MS } from "../../src/core/net.ts";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "strom net state "));
const HOST = "archive.example.org";
const YEAR = 365 * 24 * 3600_000;
// (today: setOwnPace reads the state by the real clock)
const NOW = Date.now();

/** The host's state written as text (so that 1e400, which JSON.stringify cannot write, is in it as a person's editor leaves it). */
const put = (dir: string, text: string, host = HOST) => fs.writeFileSync(path.join(dir, `${host}.json`), text);
const raw = (dir: string, host = HOST) => JSON.parse(fs.readFileSync(path.join(dir, `${host}.json`), "utf8")) as Record<string, unknown>;

/** Every time of a state: a number, now or before it (or a slot just ahead), no null. */
function clean(dir: string, at: number, host = HOST): void {
  const s = raw(dir, host);
  for (const k of ["last", "blockedUntil", "waitUntil"]) if (k in s) assert.ok(typeof s[k] === "number" && (s[k] as number) <= at + 60_000, `${k} clean: ${JSON.stringify(s[k])}`);
  assert.ok(Array.isArray(s.recent) && (s.recent as unknown[]).every((x) => typeof x === "number" && x <= at + 60_000), `recent clean: ${JSON.stringify(s.recent)}`);
  if ("slowdown" in s) assert.ok(typeof s.slowdown === "number" && s.slowdown >= 1, `slowdown clean: ${s.slowdown}`);
}

const nonsense: [string, string][] = [
  ["last a year ahead", `{"last": ${NOW + YEAR}, "recent": [${NOW - 60_000}]}`],
  ["recent a year ahead", `{"last": ${NOW - 60_000}, "recent": [${NOW - 60_000}, ${NOW + YEAR}]}`],
  ["strings", `{"last": "y", "recent": "x"}`],
  ["negative", `{"last": -5, "recent": [-5], "slowdown": -5, "latencyMs": -5, "waitUntil": -5, "blockedUntil": -5}`],
  ["beyond any number", `{"last": 1e400, "recent": [1e400], "waitUntil": 1e400, "blockedUntil": 1e400}`],
  ["a word for a time", `{"recent": [], "waitUntil": "zítra", "blockedUntil": "zítra", "slowdown": "x", "latencyMs": "x"}`],
  ["null", `{"last": null, "recent": [null]}`],
];

test("net state: nonsense in a valid file is broken — read as fresh, the agent's request goes at once and the file is written clean", async () => {
  for (const [what, text] of nonsense) {
    const dir = tmp();
    put(dir, text);
    const read = readHostState(dir, HOST, NOW);
    assert.equal(read.broken, true, `${what}: broken`);
    const r = await agentRequest(dir, HOST, undefined, {
      inside: (slot) => ({ take: !slot.refused, value: slot }),
      maxWaitMs: 30_000,
      lockWaitMs: 1000,
      now: () => NOW,
      sleep: async () => {},
      recover: () => [NOW - 120_000],
    });
    assert.equal(r.value.refused, undefined, `${what}: not refused (${JSON.stringify(r.value.refused)})`);
    assert.equal(r.value.late, false, `${what}: not late`);
    assert.ok(r.value.waitMs <= DEFAULT_PACE.minIntervalMs, `${what}: paced as any (${r.value.waitMs} ms)`);
    clean(dir, NOW);
    assert.ok((raw(dir).recent as number[]).includes(NOW - 120_000) || !read.timesLost, `${what}: the hour told again by the journal`);
    assert.equal(readHostState(dir, HOST, NOW).broken, false, `${what}: clean afterwards`);
  }
});

test("net state: what strom writes stays — slots reserved ahead, a wait a refusal or the host set however far ahead (the gentle side), the user's own long pace; never faster than it says", async () => {
  const dir = tmp();
  // the slots of many requests at once (agentRequest within the call's wait, the browser's within SLOTS_AHEAD_MS)
  put(dir, JSON.stringify({ last: NOW + SLOTS_AHEAD_MS, recent: [NOW - 1000, NOW + 28_000, NOW + SLOTS_AHEAD_MS], slowdown: 16, latencyMs: 59_000, http2: true }));
  assert.equal(readHostState(dir, HOST, NOW).broken, false, "reserved slots stay");
  put(dir, JSON.stringify({ recent: [], blockedUntil: NOW + REFUSED_MS, reason: "it refused us (HTTP 403)" }));
  assert.equal(readHostState(dir, HOST, NOW).state.blockedUntil, NOW + REFUSED_MS, "a refusal: left alone for its day");
  // a year ahead too (a server's word, a clock set back): kept — the person lifts a refusal with strom allow host --unblock
  put(dir, JSON.stringify({ recent: [], waitUntil: NOW + YEAR, blockedUntil: NOW + YEAR, reason: "it refused us" }));
  const far = readHostState(dir, HOST, NOW);
  assert.deepEqual([far.broken, far.state.waitUntil, far.state.blockedUntil], [false, NOW + YEAR, NOW + YEAR], "a long wait stays");
  const refused = await agentRequest(dir, HOST, undefined, { inside: (slot) => ({ take: false, value: slot }), maxWaitMs: 30_000, lockWaitMs: 1000, now: () => NOW, sleep: async () => {} });
  assert.equal(refused.value.refused?.why, "blocked", "still left alone");
  // a slowdown or an answer's time beyond the most strom writes: that most — slower, never the pace without them
  put(dir, `{"recent": [], "slowdown": 50, "latencyMs": 1e400}`);
  const slow = readHostState(dir, HOST, NOW);
  assert.deepEqual([slow.broken, slow.state.slowdown, slow.state.latencyMs], [true, 16, 600_000]);
  // the user's own pace for the host, however long, survives a broken time beside it
  put(dir, JSON.stringify({ recent: [], last: NOW + YEAR, own: { minIntervalMs: 7 * 24 * 3600_000, perHour: 0, at: "2026-10-01T00:00:00.000Z" } }));
  const r = readHostState(dir, HOST, NOW);
  assert.equal(r.broken, true);
  assert.deepEqual(r.state.own, { minIntervalMs: 7 * 24 * 3600_000, perHour: 0, at: "2026-10-01T00:00:00.000Z" }, "the user's pace kept");
  assert.equal(r.state.last, undefined);
  // a newer strom's field is kept as it is
  put(dir, JSON.stringify({ recent: [], future: { x: 1 } }));
  assert.deepEqual((readHostState(dir, HOST, NOW).state as unknown as Record<string, unknown>).future, { x: 1 });
});

test("net state: strom's own requests — a year-ahead last waits no year, a year-ahead block refuses nothing, and the file is clean after", async () => {
  for (const [what, text] of nonsense) {
    const dir = tmp();
    put(dir, text);
    let clock = NOW;
    const waits: number[] = [];
    const o = { stateDir: dir, hosts: [HOST], now: () => clock, sleep: async (ms: number) => void (waits.push(ms), (clock += ms)), fetchImpl: (async () => new Response("ok")) as typeof fetch };
    await politeGet(`https://${HOST}/a`, o);
    assert.ok(waits.every((w) => w <= DEFAULT_PACE.minIntervalMs), `${what}: paced as any (${waits.join(",")})`);
    clean(dir, clock);
    await politeGet(`https://${HOST}/b`, o);
    assert.deepEqual(waits.slice(-1), [DEFAULT_PACE.minIntervalMs], `${what}: the next one paced`);
  }
});

test("net state: a site's last slot a year ahead is put right; the browser's slots never reach beyond SLOTS_AHEAD_MS", async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "site~example.org.json"), JSON.stringify({ last: NOW + YEAR }));
  const r = await agentRequest(dir, HOST, undefined, {
    inside: (slot) => ({ take: !slot.refused, value: slot }),
    maxWaitMs: 30_000,
    lockWaitMs: 1000,
    site: { key: "example.org", gapMs: () => 5000 },
    now: () => NOW,
    sleep: async () => {},
  });
  assert.equal(r.value.late, false, "not held by the site's year");
  assert.equal(r.value.waitMs, 0);
  assert.equal((JSON.parse(fs.readFileSync(path.join(dir, "site~example.org.json"), "utf8")) as { last: number }).last, NOW);
  // a slow host (16 × a minute's answer): fewer slots than asked, none beyond the hour ahead
  const slow = tmp();
  put(slow, JSON.stringify({ recent: [], latencyMs: 60_000, slowdown: 16 }));
  const times = reserveSlots(slow, HOST, undefined, 50, { now: () => NOW });
  assert.ok(times.length >= 1 && times.length < 50, `fewer (${times.length})`);
  assert.ok(times.every((t) => t <= NOW + SLOTS_AHEAD_MS), "within the hour ahead");
  assert.equal(readHostState(slow, HOST, NOW).broken, false);
  // its last slot as far as it goes: the next plan says when, plans nothing
  setOwnPace(slow, HOST, { minIntervalMs: 2 * SLOTS_AHEAD_MS });
  assert.throws(() => reserveSlots(slow, HOST, undefined, 1, { now: () => NOW }), (e: unknown) => e instanceof NetError && e.failure === "cap" && e.until !== undefined && e.until > NOW);
  assert.ok(hostState(slow, HOST, NOW).recent.length === times.length, "nothing more reserved");
});

test("net state: a host that says its limit is used up for a year is left alone that year — kept as it said, never read as broken", async () => {
  const dir = tmp();
  const clock = NOW;
  const o = { stateDir: dir, hosts: [HOST], now: () => clock, sleep: async () => {}, fetchImpl: (async () => new Response("ok", { headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(YEAR / 1000) } })) as typeof fetch };
  await politeGet(`https://${HOST}/a`, o);
  assert.equal(hostState(dir, HOST, NOW).waitUntil, NOW + YEAR);
  await assert.rejects(politeGet(`https://${HOST}/b`, o), (e: unknown) => e instanceof NetError && e.failure === "cap", "nothing sent before then");
  assert.equal(readHostState(dir, HOST, NOW).broken, false);
});
