// The polite network layer: paced, capped, backing off when asked, stopping
// when refused — against a local server, with the pauses recorded, not slept.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import http2 from "node:http2";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";
import { politeGet, politeRequest, hostState, clearBlock, paceOf, hostPace, limitUsedUp, setOwnPace, MIN_INTERVAL_MS, hostAllowed, NetError, CookieJar, USER_AGENT, DEFAULT_PACE, COOL_OFF_MS } from "../../src/core/net.ts";

async function server(): Promise<{ base: string; hits: Record<string, number>; agents: string[]; close: () => Promise<void> }> {
  const hits: Record<string, number> = {};
  const agents: string[] = [];
  const s = http.createServer((req, res) => {
    const p = req.url ?? "/";
    hits[p] = (hits[p] ?? 0) + 1;
    agents.push(String(req.headers["user-agent"]));
    if (p === "/ok") return res.end("ok");
    if (p === "/busy" && hits[p]! < 2) return res.writeHead(429, { "retry-after": "1" }).end();
    if (p === "/busy") return res.end("finally");
    if (p === "/stop") return res.writeHead(429).end();
    if (p === "/login") return res.writeHead(302, { location: "/in-session", "set-cookie": "JSESSIONID=abc; Path=/; HttpOnly" }).end();
    if (p === "/in-session") return res.end(`cookie=${req.headers.cookie ?? ""}`);
    if (p === "/form") {
      let body = "";
      req.on("data", (d) => (body += d));
      return req.on("end", () => res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(`${req.method} ${req.headers["content-type"]} ${req.headers.referer} ${body}`));
    }
    if (p === "/forbidden") return res.writeHead(403).end();
    if (p === "/in") return res.writeHead(302, { location: "/ok" }).end();
    if (p === "/out") return res.writeHead(302, { location: "http://elsewhere.example/" }).end();
    return res.writeHead(404).end();
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref(); // a failed test must not keep the run alive
  const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  return { base, hits, agents, close: () => new Promise<void>((r) => s.close(() => r())) };
}

function opts(dir: string, waits: number[], extra: Partial<Parameters<typeof politeGet>[1]> = {}) {
  return { stateDir: dir, hosts: ["127.0.0.1"], sleep: async (ms: number) => void waits.push(ms), ...extra };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "strom net "));

test("net: a pause between requests to one host, the strom user agent", async () => {
  const srv = await server();
  const dir = tmp();
  const waits: number[] = [];
  for (let i = 0; i < 3; i++) assert.equal((await politeGet(`${srv.base}/ok`, opts(dir, waits))).body.toString(), "ok");
  assert.equal(waits.length, 2, "no pause before the first request");
  assert.ok(waits.every((w) => w > DEFAULT_PACE.minIntervalMs - 200 && w <= DEFAULT_PACE.minIntervalMs), waits.join(","));
  assert.ok(srv.agents.every((a) => a === USER_AGENT));
  assert.equal(hostState(dir, "127.0.0.1").recent.length, 3, "shared state on disk");
  await srv.close();
});

test("net: the service's pace — faster than strom's only where the service says so; no cap made up; the user's own for a host", () => {
  assert.deepEqual(paceOf(), { minIntervalMs: 2000, perHour: Infinity }, "a pause, no hourly cap");
  assert.deepEqual(paceOf({ minIntervalMs: 100, perHour: 10_000 }), { minIntervalMs: 2000, perHour: 10_000 }, "faster without a source: strom's pause");
  assert.deepEqual(paceOf({ minIntervalMs: 500, source: "https://api.example.org/docs#limits" }), { minIntervalMs: 500, perHour: Infinity });
  assert.deepEqual(paceOf({ minIntervalMs: 10, source: "the API documentation" }).minIntervalMs, MIN_INTERVAL_MS);
  assert.deepEqual(paceOf({ minIntervalMs: 5000, perHour: 60 }), { minIntervalMs: 5000, perHour: 60 });
  assert.deepEqual(hostPace({ recent: [], own: { minIntervalMs: 1000, at: "" } }, { minIntervalMs: 5000, perHour: 60 }), { minIntervalMs: 1000, perHour: 60 }, "the user's pause, the service's cap");
  assert.deepEqual(hostPace({ recent: [], own: { perHour: 0, at: "" } }, { perHour: 60 }).perHour, Infinity, "the user's none");
  assert.equal(DEFAULT_PACE.perHour, Infinity);
  assert.ok(hostAllowed("iiif.digi.example.cz", ["digi.example.cz"]));
  assert.ok(!hostAllowed("example.cz.evil.org", ["example.cz"]));
});

test("net: 429 — wait as asked, slow down, one more try; asked twice, an hour off", async () => {
  const srv = await server();
  const dir = tmp();
  const waits: number[] = [];
  const r = await politeGet(`${srv.base}/busy`, opts(dir, waits));
  assert.equal(r.body.toString(), "finally");
  assert.equal(srv.hits["/busy"], 2);
  assert.ok(waits.includes(1000), `Retry-After honoured: ${waits.join(",")}`);
  assert.ok((hostState(dir, "127.0.0.1").slowdown ?? 1) > 1, "and slower from now on");
  await assert.rejects(politeGet(`${srv.base}/stop`, opts(dir, waits)), (e: NetError) => e.failure === "refused" && e.status === 429);
  assert.equal(srv.hits["/stop"], 2);
  const s = hostState(dir, "127.0.0.1");
  assert.ok(s.blockedUntil! - Date.now() > COOL_OFF_MS - 60_000 && s.blockedUntil! - Date.now() <= COOL_OFF_MS, "an hour, not a day");
  await assert.rejects(politeGet(`${srv.base}/ok`, opts(dir, waits)), (e: NetError) => e.failure === "blocked");
  await srv.close();
});

test("net: silence is a block — one more try, then an hour off", async () => {
  const dir = tmp();
  const waits: number[] = [];
  let calls = 0;
  const silent = (async () => {
    calls++;
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  await assert.rejects(politeGet("https://archive.example.org/x", { stateDir: dir, hosts: ["archive.example.org"], sleep: async (ms) => void waits.push(ms), fetchImpl: silent }), (e: NetError) => e.failure === "silent" && /down, or it blocks this IP/.test(e.message));
  assert.equal(calls, 2);
  assert.match(hostState(dir, "archive.example.org").reason ?? "", /no answer/);
});

test("net: a session — cookies kept across a redirect; a form sent with POST and its headers", async () => {
  const srv = await server();
  const dir = tmp();
  const waits: number[] = [];
  const cookies = new CookieJar();
  const r = await politeGet(`${srv.base}/login`, opts(dir, waits, { cookies }));
  assert.equal(r.body.toString(), "cookie=JSESSIONID=abc", "the cookie set by the redirect goes to its target");
  assert.equal((await politeGet(`${srv.base}/in-session`, opts(dir, waits))).body.toString(), "cookie=", "another run has its own jar");
  const f = await politeRequest(`${srv.base}/form`, opts(dir, waits, { cookies, method: "POST", body: "place=T%C3%BDnec", headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: `${srv.base}/`, "User-Agent": "Mozilla/5.0" } }));
  assert.equal(f.body.toString(), `POST application/x-www-form-urlencoded ${srv.base}/ place=T%C3%BDnec`);
  assert.equal(srv.agents.at(-1), USER_AGENT, "who we are is not the connector's to change");
  assert.match(f.headers["content-type"] ?? "", /^text\/plain/, "the answer's headers reach the connector");
  await srv.close();
});

test("net: 403 — stop, and leave the host alone for a day, in every process", async () => {
  const srv = await server();
  const dir = tmp();
  const waits: number[] = [];
  await assert.rejects(politeGet(`${srv.base}/forbidden`, opts(dir, waits)), (e: NetError) => e.failure === "refused" && e.status === 403);
  await assert.rejects(politeGet(`${srv.base}/ok`, opts(dir, waits)), (e: NetError) => e.failure === "blocked" && /left alone until/.test(e.message));
  assert.equal(srv.hits["/ok"], undefined, "nothing more was sent");
  clearBlock(dir, "127.0.0.1");
  assert.equal((await politeGet(`${srv.base}/ok`, opts(dir, waits))).status, 200);
  await srv.close();
});

test("net: the hourly cap; hosts outside the list; redirects are checked one by one", async () => {
  const srv = await server();
  const dir = tmp();
  const waits: number[] = [];
  const capped = opts(dir, waits, { pace: { perHour: 2 } });
  await politeGet(`${srv.base}/ok`, capped);
  await politeGet(`${srv.base}/ok`, capped);
  await assert.rejects(politeGet(`${srv.base}/ok`, capped), (e: NetError) => e.failure === "cap" && /resumes at/.test(e.message));
  const dir2 = tmp();
  await assert.rejects(politeGet("http://elsewhere.example/x", opts(dir2, waits)), (e: NetError) => e.failure === "host");
  await assert.rejects(politeGet("file:///etc/passwd", opts(dir2, waits, { hosts: [""] })), (e: NetError) => e.failure === "host");
  assert.equal((await politeGet(`${srv.base}/in`, opts(dir2, waits))).body.toString(), "ok");
  await assert.rejects(politeGet(`${srv.base}/out`, opts(dir2, waits)), (e: NetError) => e.failure === "host", "a redirect may not lead off the list");
  await srv.close();
});

/** A server like an image server that speaks HTTP/2 only. (Its HTTP/1.1 side, which answers 426, is the fetch of the test.) */
async function h2Only(): Promise<{ base: string; seen: string[]; close: () => Promise<void> }> {
  const seen: string[] = [];
  const h2 = http2.createServer((req, res) => {
    const p = req.url;
    seen.push(`${req.method} ${p} ${req.headers["user-agent"]} cookie=${req.headers.cookie ?? ""}`);
    if (p === "/page") {
      res.setHeader("set-cookie", ["a=1; Path=/", "b=2; Path=/"]);
      res.setHeader("content-type", "text/plain; charset=utf-8");
      return res.end("Žďár · Москва");
    }
    if (p === "/packed") {
      res.setHeader("content-encoding", "gzip");
      return res.end(zlib.gzipSync("stisknuto: Žďár"));
    }
    if (p === "/moved") return res.writeHead(302, { location: "/page" }).end();
    if (p === "/form") {
      let body = "";
      req.on("data", (d) => (body += d));
      return req.on("end", () => res.end(`${req.method} ${req.headers["content-type"]} ${decodeURIComponent(body.replace(/\+/g, " "))}`));
    }
    return res.writeHead(404).end();
  });
  await new Promise<void>((r) => h2.listen(0, "127.0.0.1", r));
  h2.unref();
  return { base: `http://127.0.0.1:${(h2.address() as AddressInfo).port}`, seen, close: () => new Promise<void>((r) => h2.close(() => r())) };
}

test("net: 426 Upgrade Required — asked again over HTTP/2, paced, and so from then on; the same user agent, cookies, forms", async () => {
  const srv = await h2Only();
  const dir = tmp();
  const waits: number[] = [];
  const cookies = new CookieJar();
  let h1 = 0;
  const fetchImpl = (async () => (h1++, new Response(null, { status: 426 }))) as typeof fetch;
  const first = await politeGet(`${srv.base}/page`, opts(dir, waits, { cookies, fetchImpl }));
  assert.equal(first.status, 200);
  assert.equal(first.body.toString("utf8"), "Žďár · Москва");
  assert.equal(h1, 1, "one question over HTTP/1.1");
  assert.equal(waits.length, 1, "the second question waits its turn like any other");
  assert.equal(hostState(dir, "127.0.0.1").http2, true, "remembered for the host");
  assert.equal(hostState(dir, "127.0.0.1").recent.length, 2, "both count");
  // from now on over HTTP/2 at once: the session's cookies, a redirect, a compressed answer, a form
  assert.equal((await politeGet(`${srv.base}/moved`, opts(dir, waits, { cookies, fetchImpl }))).body.toString("utf8"), "Žďár · Москва");
  assert.equal((await politeGet(`${srv.base}/packed`, opts(dir, waits, { fetchImpl }))).body.toString("utf8"), "stisknuto: Žďár");
  const form = await politeRequest(`${srv.base}/form`, opts(dir, waits, { fetchImpl, method: "POST", body: "misto=%C5%BD%C4%8F%C3%A1r+nad+S%C3%A1zavou", headers: { "Content-Type": "application/x-www-form-urlencoded", Connection: "keep-alive" } }));
  assert.equal(form.body.toString("utf8"), "POST application/x-www-form-urlencoded misto=Žďár nad Sázavou");
  assert.equal(h1, 1, "no more HTTP/1.1");
  assert.ok(srv.seen.every((l) => l.includes(USER_AGENT)), "who is asking does not change");
  assert.match(srv.seen[1]!, /^GET \/moved .* cookie=a=1; b=2$/);
  assert.match(srv.seen[2]!, /^GET \/page .* cookie=a=1; b=2$/, "the redirect, followed by strom, over HTTP/2 too");
  await srv.close();
});

test("net: a header fetch() cannot send is refused before anything goes out — it is no silence of the archive", async () => {
  const dir = tmp();
  let sent = 0;
  const fetchImpl = (async () => (sent++, new Response("ok"))) as unknown as typeof fetch;
  const o = { stateDir: dir, hosts: ["archiv.example.org"], fetchImpl, sleep: async () => undefined };
  await assert.rejects(politeRequest("https://archiv.example.org/x", { ...o, headers: { Referer: "https://archiv.example.org/Žďár nad Sázavou" } }), (e: NetError) => e.failure === "http" && /characters a header cannot carry/.test(e.message));
  await assert.rejects(politeRequest("https://archiv.example.org/x", { ...o, headers: { "X-Note": "a\r\nX-Evil: 1" } }), (e: NetError) => e.failure === "http");
  await assert.rejects(politeRequest("https://archiv.example.org/x", { ...o, headers: { "Bad Name": "x" } }), (e: NetError) => e.failure === "http");
  assert.equal(sent, 0);
  assert.equal(hostState(dir, "archiv.example.org").blockedUntil, undefined, "not left alone for an hour");
  // Latin-1 is what a header carries: "café" goes
  assert.equal((await politeRequest("https://archiv.example.org/x", { ...o, headers: { "X-Note": "café" } })).status, 200);
});

test("net: the host steers — slow answers stretch the pause, a used-up limit is waited for; the user's own pace", async () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(limitUsedUp(h({ "ratelimit-remaining": "3" }), 0), undefined);
  assert.equal(limitUsedUp(h({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": "30" }), 1000), 31_000);
  assert.equal(limitUsedUp(h({ ratelimit: "limit=100, remaining=0, reset=5" }), 0), 5000);
  assert.equal(limitUsedUp(h({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1900000000" }), 0), 1_900_000_000_000, "the moment itself");
  const dir = tmp();
  const waits: number[] = [];
  let clock = 1_000_000;
  const answers: Response[] = [
    new Response("ok", { headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "60" } }),
    new Response("ok"),
    new Response("ok"),
  ];
  const slow = async () => {
    clock += 5000; // the host takes 5 s to answer
    return answers.shift()!;
  };
  const o = { stateDir: dir, hosts: ["archive.example.org"], now: () => clock, sleep: async (ms: number) => void (waits.push(ms), (clock += ms)), fetchImpl: slow as typeof fetch };
  await politeGet("https://archive.example.org/a", o);
  assert.equal(hostState(dir, "archive.example.org").latencyMs, 5000);
  assert.equal(hostState(dir, "archive.example.org").waitUntil, 1_005_000 + 60_000);
  await politeGet("https://archive.example.org/b", o);
  assert.deepEqual(waits, [60_000], "waited until the host's limit came back — longer than any pause");
  await politeGet("https://archive.example.org/c", o);
  assert.equal(waits[1], 5000, "the pause as long as the host takes to answer, not strom's 2 s");
  // the user's own pace for the host
  setOwnPace(dir, "archive.example.org", { minIntervalMs: 500, perHour: 2 });
  assert.deepEqual(hostState(dir, "archive.example.org").own?.perHour, 2);
  setOwnPace(dir, "archive.example.org", undefined);
  assert.equal(hostState(dir, "archive.example.org").own, undefined);
});
