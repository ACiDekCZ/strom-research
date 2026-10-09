// An archive's hourly cap used up: the caller that waits longer (strom fetch) waits for it itself — told first, the
// host let go meanwhile, never a request more than the cap — and beyond its wait says when to try again (P7).
// A fake clock and a local server: nothing is slept, nothing leaves this computer.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { politeGet, NetError, clock, MAX_WAIT_MS } from "../../src/core/net.ts";

async function server(at: () => number): Promise<{ base: string; times: number[]; close: () => Promise<void> }> {
  const times: number[] = [];
  const s = http.createServer((_req, res) => {
    times.push(at());
    res.end("ok");
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref();
  return { base: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, times, close: () => new Promise<void>((r) => s.close(() => r())) };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "strom net wait "));
const HOUR = 3600_000;

function setup() {
  let now = Date.parse("2026-03-02T09:00:00Z");
  const events: string[] = [];
  const dir = tmp();
  const lock = path.join(dir, "127.0.0.1.json.lock");
  const o = {
    stateDir: dir,
    hosts: ["127.0.0.1"],
    pace: { perHour: 2, minIntervalMs: 2000, source: "the archive's terms" },
    now: () => now,
    sleep: async (ms: number) => {
      events.push(`sleep ${Math.round(ms / 60_000)} min${fs.existsSync(lock) ? " holding the host" : ""}`);
      now += ms;
    },
    onWait: (w: { host: string; until: number; why: string }) => events.push(`told: ${w.why} until ${w.until - start} ms`),
  };
  const start = now;
  return { o, events, advance: (ms: number) => (now += ms), at: () => now, start };
}

test("net: an hourly cap used up within the caller's wait — told first, waited with the host let go, then on; never more than the cap", async () => {
  const t = setup();
  const srv = await server(t.at);
  await politeGet(`${srv.base}/a`, { ...t.o, waitMs: 30 * 60_000 });
  await politeGet(`${srv.base}/b`, { ...t.o, waitMs: 30 * 60_000 });
  t.advance(40 * 60_000);
  t.events.length = 0;
  const third = await politeGet(`${srv.base}/c`, { ...t.o, waitMs: 30 * 60_000 });
  assert.equal(third.body.toString(), "ok");
  assert.deepEqual(t.events.slice(0, 2), [`told: cap until ${HOUR} ms`, "sleep 20 min"], "said before it waits, the host not held");
  assert.equal(srv.times.length, 3);
  // in any hour at most two
  for (let i = 2; i < srv.times.length; i++) assert.ok(srv.times[i]! - srv.times[i - 2]! >= HOUR, srv.times.join(","));
  await srv.close();
});

test("net: an hourly cap used up for longer than the caller waits — nothing sent, the time to try again said", async () => {
  const t = setup();
  const srv = await server(t.at);
  await politeGet(`${srv.base}/a`, { ...t.o, waitMs: 30 * 60_000 });
  await politeGet(`${srv.base}/b`, { ...t.o, waitMs: 30 * 60_000 });
  t.advance(10 * 60_000);
  await assert.rejects(politeGet(`${srv.base}/c`, { ...t.o, waitMs: 30 * 60_000 }), (e: NetError) => {
    assert.equal(e.failure, "cap");
    assert.equal(e.until, t.start + HOUR);
    assert.match(e.message, new RegExp(`2 requests to 127\\.0\\.0\\.1 in the last hour — its hourly cap; try again at ${clock(t.start + HOUR)}`));
    assert.match(e.hint ?? "", /run it again at (\d{4}-\d\d-\d\d )?\d\d:\d\d — not sooner/);
    return true;
  });
  assert.equal(srv.times.length, 2, "no request beyond the cap");
  // a caller that waits no longer than strom's own (anything but strom fetch): as before, 2 min at most
  t.advance(15 * 60_000);
  await assert.rejects(politeGet(`${srv.base}/c`, t.o), (e: NetError) => e.failure === "cap" && e.until === t.start + HOUR);
  assert.ok(MAX_WAIT_MS < 5 * 60_000);
  await srv.close();
});

test("net: the host says its limit is used up (RateLimit) — waited for the same way", async () => {
  let now = Date.parse("2026-03-02T09:00:00Z");
  const dir = tmp();
  let hits = 0;
  const s = http.createServer((_req, res) => {
    hits++;
    res.writeHead(200, hits === 1 ? { "ratelimit-remaining": "0", "ratelimit-reset": "600" } : {}).end("ok");
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref();
  const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  const told: string[] = [];
  const o = { stateDir: dir, hosts: ["127.0.0.1"], now: () => now, sleep: async (ms: number) => void (now += ms), onWait: (w: { why: string }) => void told.push(w.why) };
  await politeGet(`${base}/a`, { ...o, waitMs: 30 * 60_000 });
  await politeGet(`${base}/b`, { ...o, waitMs: 30 * 60_000 });
  assert.deepEqual(told, ["limit"]);
  assert.equal(hits, 2);
  await new Promise<void>((r) => s.close(() => r()));
});

test("clock: the time of day here, with the day when it is not today", () => {
  const at = new Date(2026, 2, 2, 9, 5).getTime();
  assert.equal(clock(at, at), "09:05");
  assert.equal(clock(at, at + 24 * HOUR), "2026-03-02 09:05");
});
