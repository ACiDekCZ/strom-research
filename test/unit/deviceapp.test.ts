// The Strom app for the other devices (src/core/deviceapp.ts), against a stand-in of the app's site on 127.0.0.1: only
// while devices.mode is on (off — not one request), at most once a day, its ETag asked, the sums of the site checked,
// nothing too big, no icon from outside the app's own path, the last two versions kept — and the gate of the app's
// version pending: nothing served.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { acquireLock } from "../../src/core/lock.ts";
import { deviceAppFiles, deviceAppRoot, deviceAppSource, deviceAppState, DEVICE_APP_BEHIND_MS, DEVICE_APP_EVERY_MS, ensureDeviceApp, ICON_MAX, INDEX_MAX, noteDeviceAppSource } from "../../src/core/deviceapp.ts";
import { APP_DEVICE_MODE, APP_DEVICE_MODE_BETA, deviceAppServable, STROM_APP_BETA_URL, STROM_APP_URL } from "../../src/core/stromapp.ts";
import { servable } from "../../src/core/device-gateway.ts";

const T0 = Date.parse("2026-11-24T10:00:00.000Z");
const DAY = DEVICE_APP_EVERY_MS;

interface Route {
  status?: number;
  type?: string;
  body?: Buffer | string;
  etag?: string;
  /** Bytes sent in chunks without a Content-Length. */
  stream?: number;
  location?: string;
}

/** A stand-in of the app's site: routes by path, every request counted. */
async function site(): Promise<{ origin: string; routes: Map<string, Route>; requests: { path: string; headers: http.IncomingHttpHeaders }[]; close: () => Promise<void> }> {
  const routes = new Map<string, Route>();
  const requests: { path: string; headers: http.IncomingHttpHeaders }[] = [];
  const server = http.createServer((req, res) => {
    requests.push({ path: req.url ?? "", headers: req.headers });
    res.on("error", () => {});
    const r = routes.get(req.url ?? "");
    if (!r) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("not here");
      return;
    }
    if (r.location) {
      res.writeHead(r.status ?? 302, { Location: r.location }).end();
      return;
    }
    if (r.etag && req.headers["if-none-match"] === r.etag) {
      res.writeHead(304, { ETag: r.etag }).end();
      return;
    }
    const headers: Record<string, string> = { "Content-Type": r.type ?? "application/octet-stream", ...(r.etag ? { ETag: r.etag } : {}) };
    if (r.stream !== undefined) {
      res.writeHead(r.status ?? 200, headers);
      const chunk = Buffer.alloc(1024 * 1024, 0x61);
      let left = r.stream;
      const more = () => {
        while (left > 0) {
          const n = Math.min(left, chunk.length);
          left -= n;
          if (!res.write(chunk.subarray(0, n))) return void res.once("drain", more);
        }
        res.end();
      };
      res.on("close", () => (left = 0));
      more();
      return;
    }
    res.writeHead(r.status ?? 200, headers).end(r.body ?? "");
  });
  server.on("clientError", () => {});
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    routes,
    requests,
    close: () =>
      new Promise<void>((ok) => {
        server.closeAllConnections();
        server.close(() => ok());
      }),
  };
}

const html = (version: string | undefined, extra = "") => `<!doctype html><html><head><link rel="manifest" href="manifest.json"></head><body>${version ? `<span id="about-version">${version}</span>` : ""}${extra}</body></html>`;
const png = (seed: string, size = 64) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), crypto.createHash("sha256").update(seed).digest(), Buffer.alloc(Math.max(0, size - 36))]);
const sum = (b: Buffer | string) => crypto.createHash("sha256").update(b).digest("hex");

function world(origin: string, on = true): { env: Record<string, string>; dir: string; done: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-deviceapp-"));
  const config = path.join(dir, "config");
  fs.mkdirSync(config);
  if (on) fs.writeFileSync(path.join(config, "config.json"), JSON.stringify({ devicesMode: "on" }));
  return { env: { HOME: dir, STROM_CONFIG_DIR: config, STROM_SHARED: path.join(dir, "shared"), STROM_APP_URL: `${origin}/run/` }, dir, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function app(s: Awaited<ReturnType<typeof site>>, version: string, opts: { etag?: string; icons?: unknown[] } = {}) {
  s.routes.set("/run/index.html", { type: "text/html; charset=utf-8", body: html(version), ...(opts.etag ? { etag: opts.etag } : {}) });
  s.routes.set("/run/manifest.json", { type: "application/manifest+json", body: JSON.stringify({ name: "Strom", icons: opts.icons ?? [{ src: "icons/icon-192.png" }] }) });
  s.routes.set("/run/icons/icon-192.png", { type: "image/png", body: png("192") });
}

test("devices.mode off: not one request — the app is never downloaded, nothing written", async () => {
  const s = await site();
  const w = world(s.origin, false);
  try {
    app(s, "3.40.0");
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 }), { result: "off" });
    assert.equal(s.requests.length, 0);
    assert.ok(!fs.existsSync(deviceAppRoot(w.env)));
    assert.deepEqual(deviceAppState(w.env), { app: "none" });
    // a config that cannot be read: off too
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "{ broken");
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 }), { result: "off" });
    assert.equal(s.requests.length, 0);
  } finally {
    w.done();
    await s.close();
  }
});

test("downloaded into <shared>/device-app/<version>/: the index, the manifest and its icons under the app's path alone — once a day, then its ETag", async () => {
  const s = await site();
  const w = world(s.origin);
  try {
    app(s, "3.40.0", {
      etag: '"v340"',
      icons: [
        { src: "icons/icon-192.png" },
        { src: "/run/icons/icon-512.svg" },
        { src: `${s.origin}/other/outside.png` },
        { src: "../outside.png" },
        { src: "https://example.invalid/icon.png" },
        { src: "icons/icon.gif" },
        { src: "icons/%2e%2e/x.png" },
        { src: "icons/big.png" },
        { src: "index.html" },
        7,
      ],
    });
    s.routes.set("/run/icons/icon-512.svg", { type: "image/svg+xml", body: "<svg xmlns='http://www.w3.org/2000/svg'/>" });
    s.routes.set("/other/outside.png", { type: "image/png", body: png("outside") });
    s.routes.set("/outside.png", { type: "image/png", body: png("outside") });
    s.routes.set("/run/icons/big.png", { type: "image/png", body: png("big", ICON_MAX + 1) });

    assert.deepEqual(deviceAppState(w.env), { app: "none" });
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 }), { result: "fetched", version: "3.40.0" });
    const dir = path.join(w.dir, "shared", "device-app", "3.40.0");
    assert.deepEqual(deviceAppFiles(w.env), { dir, version: "3.40.0", etag: '"v340"', from: s.origin });
    assert.deepEqual(deviceAppState(w.env), { app: "ready", appVersion: "3.40.0" });
    assert.equal(fs.readFileSync(path.join(dir, "index.html"), "utf8"), html("3.40.0"));
    assert.ok(fs.existsSync(path.join(dir, "manifest.json")));
    assert.deepEqual(fs.readFileSync(path.join(dir, "icons", "icon-192.png")), png("192"));
    assert.ok(fs.existsSync(path.join(dir, "icons", "icon-512.svg")));
    assert.deepEqual(fs.readdirSync(path.join(dir, "icons")).sort(), ["icon-192.png", "icon-512.svg"], "the too big icon skipped");
    // nothing outside the app's path asked at all
    const asked = s.requests.map((r) => r.path);
    for (const p of asked) assert.ok(p.startsWith("/run/"), p);
    assert.ok(!asked.includes("/run/icons/icon.gif"));
    assert.deepEqual(fs.readdirSync(path.join(w.dir, "shared", "device-app")), ["3.40.0"], "no temporary folder left");

    // the same day: not one request
    const before = s.requests.length;
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + DAY - 1 }), { result: "fresh", version: "3.40.0" });
    assert.equal(s.requests.length, before);
    // the next day: asked with its ETag — 304, kept as it is
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + DAY }), { result: "unchanged", version: "3.40.0" });
    assert.equal(s.requests.length, before + 1);
    assert.equal(s.requests.at(-1)!.headers["if-none-match"], '"v340"');
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + DAY + 1000 }), { result: "fresh", version: "3.40.0" });
    assert.equal(s.requests.length, before + 1);
  } finally {
    w.done();
    await s.close();
  }
});

test("the sums of the site: kept when they hold, nothing kept when one does not; 404 — TLS alone", async () => {
  const s = await site();
  const w = world(s.origin);
  try {
    app(s, "3.40.0");
    const icon = png("192");
    s.routes.set("/run/SHASUMS256.txt", { type: "text/plain", body: `${sum("tampered")}  index.html\n${sum(icon)}  icons/icon-192.png\n` });
    const bad = await ensureDeviceApp(w.env, { now: () => T0 });
    assert.equal(bad.result, "failed");
    assert.match((bad as { error: string }).error, /index\.html: its SHA-256/);
    assert.equal(deviceAppFiles(w.env), undefined);
    assert.deepEqual(fs.existsSync(deviceAppRoot(w.env)) ? fs.readdirSync(deviceAppRoot(w.env)) : [], [], "nothing kept");
    // failed: not asked again within the hour
    const n = s.requests.length;
    assert.equal((await ensureDeviceApp(w.env, { now: () => T0 + 60_000 })).result, "failed");
    assert.equal(s.requests.length, n);
    // a sum of an icon that does not hold: nothing kept either
    s.routes.set("/run/SHASUMS256.txt", { type: "text/plain", body: `${sum(html("3.40.0"))}  index.html\n${sum("other")}  icons/icon-192.png\n` });
    assert.equal((await ensureDeviceApp(w.env, { now: () => T0 + 3600_000 })).result, "failed");
    assert.equal(deviceAppFiles(w.env), undefined);
    // the sums hold
    s.routes.set("/run/SHASUMS256.txt", { type: "text/plain", body: `${sum(html("3.40.0"))}  index.html\n${sum(icon)} *icons/icon-192.png\n` });
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + 2 * 3600_000 }), { result: "fetched", version: "3.40.0" });
    // none on the site: kept on TLS alone (here the loopback)
    s.routes.delete("/run/SHASUMS256.txt");
    app(s, "3.41.0");
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + 2 * 3600_000 + DAY }), { result: "fetched", version: "3.41.0" });
    // another error of the sums' address: nothing new kept
    app(s, "3.42.0");
    s.routes.set("/run/SHASUMS256.txt", { status: 500, type: "text/plain", body: "x" });
    assert.equal((await ensureDeviceApp(w.env, { now: () => T0 + 2 * 3600_000 + 2 * DAY })).result, "failed");
    assert.equal(deviceAppFiles(w.env)?.version, "3.41.0");
  } finally {
    w.done();
    await s.close();
  }
});

test("refused: an index too big (counted as it comes), not HTML, with no version, a redirect — nothing kept", async () => {
  const s = await site();
  const w = world(s.origin);
  try {
    let t = T0;
    /** A call of its own, two hours after the one before (past the hour a failure waits). */
    const next = () => {
      const at = (t += 2 * 3600_000);
      return { now: () => at };
    };
    s.routes.set("/run/index.html", { type: "text/html", stream: INDEX_MAX + 1 });
    const big = await ensureDeviceApp(w.env, next());
    assert.equal(big.result, "failed");
    assert.match((big as { error: string }).error, /too big/);
    s.routes.set("/run/index.html", { type: "application/octet-stream", body: html("3.40.0") });
    assert.match(((await ensureDeviceApp(w.env, next())) as { error: string }).error, /not text\/html/);
    s.routes.set("/run/index.html", { type: "text/html", body: html(undefined) });
    assert.match(((await ensureDeviceApp(w.env, next())) as { error: string }).error, /no version/);
    s.routes.set("/run/index.html", { type: "text/html", body: html("3.40") });
    assert.equal((await ensureDeviceApp(w.env, next())).result, "failed", "3.40 is no version of the app");
    s.routes.set("/run/index.html", { status: 302, location: "https://example.invalid/run/index.html" });
    assert.equal((await ensureDeviceApp(w.env, next())).result, "failed");
    assert.ok(!s.requests.some((r) => !r.path.startsWith("/run/")));
    assert.equal(deviceAppFiles(w.env), undefined);
    assert.deepEqual(fs.existsSync(deviceAppRoot(w.env)) ? fs.readdirSync(deviceAppRoot(w.env)) : [], []);
    // the version the computer's app said, where the file says none
    noteDeviceAppSource(w.env, s.origin, "3.40.1");
    s.routes.set("/run/index.html", { type: "text/html", body: html(undefined) });
    assert.deepEqual(await ensureDeviceApp(w.env, next()), { result: "fetched", version: "3.40.1" });
  } finally {
    w.done();
    await s.close();
  }
});

test("the last two versions kept; one download at a time (another running — busy, not one request)", async () => {
  const s = await site();
  const w = world(s.origin);
  try {
    for (const [i, v] of ["3.40.0", "3.41.0", "3.42.0"].entries()) {
      app(s, v);
      assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + i * DAY }), { result: "fetched", version: v });
    }
    assert.deepEqual(fs.readdirSync(deviceAppRoot(w.env)).sort(), ["3.41.0", "3.42.0"]);
    assert.equal(deviceAppFiles(w.env)?.version, "3.42.0");

    const release = acquireLock(path.join(w.env.STROM_CONFIG_DIR!, "device-app.fetch.lock"), { owner: "a test" });
    try {
      const n = s.requests.length;
      assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + 5 * DAY }), { result: "busy" });
      assert.equal(s.requests.length, n);
      assert.deepEqual(deviceAppState(w.env), { app: "fetching", appVersion: "3.42.0" });
    } finally {
      release();
    }
    assert.deepEqual(deviceAppState(w.env), { app: "ready", appVersion: "3.42.0" });
  } finally {
    w.done();
    await s.close();
  }
});

test("where from: the copy of the app the computer runs — its site, its beta, its development on the loopback; nothing else", async () => {
  const s = await site();
  const w = world(s.origin);
  try {
    // no note: strom.app.url (here the loopback)
    assert.equal(deviceAppSource(w.env), `${s.origin}/run/`);
    // the app's site, its beta
    noteDeviceAppSource(w.env, "https://beta.stromapp.info", "3.40.0-beta.2");
    assert.equal(deviceAppSource(w.env), STROM_APP_BETA_URL);
    noteDeviceAppSource(w.env, "https://stromapp.info", "3.40.0");
    assert.equal(deviceAppSource(w.env), STROM_APP_URL);
    // another origin is never noted
    for (const origin of ["https://evil.example", "http://stromapp.info", "http://192.168.1.5:8080", "null", ""]) noteDeviceAppSource(w.env, origin, "9.9.9");
    assert.equal(deviceAppSource(w.env), STROM_APP_URL);
    const note = JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "device-app.json"), "utf8"));
    assert.deepEqual(note.source.origin, "https://stromapp.info");
    assert.equal(note.source.appVersion, "3.40.0");
    // the development copy: the path strom.app.url names on its origin
    noteDeviceAppSource(w.env, s.origin);
    assert.equal(deviceAppSource({ ...w.env, STROM_APP_URL: `${s.origin}/dev/run/` }), `${s.origin}/dev/run/`);
    assert.equal(deviceAppSource({ ...w.env, STROM_APP_URL: "https://stromapp.info/run/" }), `${s.origin}/run/`);
    // no note, a setting not of the app: the channel's default
    fs.rmSync(path.join(w.env.STROM_CONFIG_DIR!, "device-app.json"));
    assert.equal(deviceAppSource({ ...w.env, STROM_APP_URL: "https://evil.example/run/" }), STROM_APP_URL);
  } finally {
    w.done();
    await s.close();
  }
});

test("an isolated installation: the loopback alone — never the app's site (its default, its note, its beta): nothing downloaded", async () => {
  const s = await site();
  const w = world(s.origin);
  const real = globalThis.fetch;
  const asked: string[] = [];
  // any request not to the stand-in on the loopback is counted and refused (never the internet)
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(`${s.origin}/`)) {
      asked.push(url);
      return Promise.reject(new Error("no network in a test"));
    }
    return real(input, init);
  }) as typeof fetch;
  try {
    app(s, "3.40.0");
    const iso: Record<string, string> = { ...w.env, STROM_ISOLATED: "1" };
    // the app's site noted (the computer's app on stromapp.info), its beta, the channel's default: none
    noteDeviceAppSource(iso, "https://stromapp.info", "3.40.0");
    assert.equal(deviceAppSource(iso), undefined);
    assert.equal(deviceAppSource(w.env), STROM_APP_URL, "not isolated: the app's site");
    const none = await ensureDeviceApp(iso, { now: () => T0 });
    assert.equal(none.result, "failed");
    assert.deepEqual([asked, s.requests.length], [[], 0], "not one request");
    assert.deepEqual(deviceAppState(iso), { app: "none" });
    noteDeviceAppSource(iso, "https://beta.stromapp.info", "3.40.0-beta.1");
    assert.equal(deviceAppSource(iso), undefined);
    fs.rmSync(path.join(w.env.STROM_CONFIG_DIR!, "device-app.json"));
    const { STROM_APP_URL: _u, ...bare } = iso;
    assert.equal(deviceAppSource(bare), undefined, "the channel's default is the app's site");
    assert.equal(deviceAppSource({ ...iso, STROM_APP_URL: "https://stromapp.info/run/" }), undefined);
    assert.equal((await ensureDeviceApp(bare, { now: () => T0 })).result, "failed");
    assert.deepEqual([asked, s.requests.length], [[], 0], "not one request");
    // the development copy on the loopback (strom.app.url; the computer's app from there): downloaded from it
    assert.equal(deviceAppSource(iso), `${s.origin}/run/`);
    noteDeviceAppSource(iso, s.origin, "3.40.0");
    assert.equal(deviceAppSource(iso), `${s.origin}/run/`);
    assert.deepEqual(await ensureDeviceApp(iso, { now: () => T0 + 2 * 3600_000 }), { result: "fetched", version: "3.40.0" });
    assert.deepEqual(asked, []);
    assert.ok(s.requests.some((r) => r.path === "/run/index.html"));
  } finally {
    globalThis.fetch = real;
    w.done();
    await s.close();
  }
});

test("the gate of the app for the devices: pending — nothing served; set — that version and newer", () => {
  assert.equal(APP_DEVICE_MODE, undefined, "the app has not said its version yet");
  for (const v of ["3.40.0", "99.0.0", undefined]) assert.equal(deviceAppServable(v), false);
  assert.equal(deviceAppServable("3.40.0", "3.40.0"), true);
  assert.equal(deviceAppServable("3.41.0-beta.1", "3.40.0"), true);
  assert.equal(deviceAppServable("3.39.9", "3.40.0"), false);
  assert.equal(deviceAppServable(undefined, "3.40.0"), false);
  assert.equal(deviceAppServable("3.40", "3.40.0"), false);
});

test("the gate of the app's beta (APP_DEVICE_MODE_BETA): a copy downloaded from the app's beta site of that version or newer is served before APP_DEVICE_MODE — never a copy of the app's site, a development copy or one whose site is not known", () => {
  assert.equal(APP_DEVICE_MODE_BETA, "3.32.0-beta.4");
  const BETA = "https://beta.stromapp.info";
  assert.equal(deviceAppServable("3.32.0-beta.4", undefined, BETA), true);
  assert.equal(deviceAppServable("3.32.0-beta.5", undefined, BETA), true);
  assert.equal(deviceAppServable("3.32.0", undefined, BETA), true);
  assert.equal(deviceAppServable("3.32.0-beta.3", undefined, BETA), false);
  assert.equal(deviceAppServable("3.31.0", undefined, BETA), false);
  for (const from of ["https://stromapp.info", "http://localhost:5173", "http://127.0.0.1:8080", undefined]) assert.equal(deviceAppServable("3.32.0-beta.4", undefined, from), false, String(from));
  assert.equal(deviceAppServable(undefined, undefined, BETA), false);
  assert.equal(deviceAppServable("3.32", undefined, BETA), false);
  // APP_DEVICE_MODE set: every copy from it on, the beta's as well
  assert.equal(deviceAppServable("3.33.0", "3.33.0", "https://stromapp.info"), true);
  assert.equal(deviceAppServable("3.32.0-beta.4", "3.33.0", BETA), true);
});

test("what the gateway serves (no gate of a test): the copy of the app's beta site; the copy of its site or of an older strom (its site not said) — the phone's page", () => {
  const w = world("http://127.0.0.1:9");
  try {
    const copy = (version: string, from?: string) => {
      const dir = path.join(deviceAppRoot(w.env), version);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), html(version));
      fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "device-app.json"), JSON.stringify({ version, ...(from ? { from } : {}) }));
    };
    assert.equal(w.env.STROM_DEVICE_APP_GATE, undefined);
    copy("3.32.0-beta.4", "https://beta.stromapp.info");
    assert.equal(servable(w.env)?.version, "3.32.0-beta.4");
    copy("3.32.0-beta.3", "https://beta.stromapp.info");
    assert.equal(servable(w.env), undefined);
    copy("3.32.0-beta.4", "https://stromapp.info");
    assert.equal(servable(w.env), undefined);
    copy("3.32.0-beta.4");
    assert.equal(servable(w.env), undefined);
  } finally {
    w.done();
  }
});

test("a copy of another site than the one asked now, or one an older strom did not say the site of: downloaded again at once, without its ETag, its site noted", async () => {
  const s = await site();
  const w = world(s.origin);
  try {
    app(s, "3.40.0", { etag: '"v340"' });
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 }), { result: "fetched", version: "3.40.0" });
    const note = path.join(w.env.STROM_CONFIG_DIR!, "device-app.json");
    // an older strom's note: no site
    const { from: _f, ...older } = JSON.parse(fs.readFileSync(note, "utf8"));
    fs.writeFileSync(note, JSON.stringify(older));
    const before = s.requests.length;
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + 1000 }), { result: "fetched", version: "3.40.0" }, "not fresh: its site not known");
    const index = s.requests.slice(before).find((r) => r.path === "/run/index.html")!;
    assert.equal(index.headers["if-none-match"], undefined, "downloaded whole");
    assert.equal(deviceAppFiles(w.env)?.from, s.origin);
    // its site known now: fresh again the same day
    const now = s.requests.length;
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + 2000 }), { result: "fresh", version: "3.40.0" });
    assert.equal(s.requests.length, now);
    // the next day, 304: the site noted again
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + DAY + 2000 }), { result: "unchanged", version: "3.40.0" });
    assert.equal(deviceAppFiles(w.env)?.from, s.origin);
  } finally {
    w.done();
    await s.close();
  }
});

test("the computer's app says a newer version than the copy: the site asked at once, not after a day; while it still gives the older one, again at most once in DEVICE_APP_BEHIND_MS — the copy never removed", async () => {
  const s = await site();
  const w = world(s.origin);
  const BEHIND = DEVICE_APP_BEHIND_MS;
  const note = () => JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "device-app.json"), "utf8"));
  const index = () => s.requests.filter((r) => r.path === "/run/index.html");
  try {
    assert.ok(BEHIND >= 5 * 60_000 && BEHIND <= 10 * 60_000, "a few minutes");
    app(s, "3.32.0-beta.4", { etag: '"b4"' });
    noteDeviceAppSource(w.env, s.origin, "3.32.0-beta.4", () => T0);
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 }), { result: "fetched", version: "3.32.0-beta.4" });
    // the computer's app is at beta.5 a minute later; the same version or an older one said changes nothing
    noteDeviceAppSource(w.env, s.origin, "3.32.0-beta.3", () => T0 + 30_000);
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + 30_000 }), { result: "fresh", version: "3.32.0-beta.4" }, "an older version said: as before");
    noteDeviceAppSource(w.env, s.origin, "3.32.0-beta.5", () => T0 + 60_000);
    const t1 = T0 + 60_000;
    let asked = index().length;
    // asked at once, its ETag sent: the site still gives beta.4 (304) — the copy kept, the version sought noted
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => t1 }), { result: "unchanged", version: "3.32.0-beta.4" });
    assert.equal(index().length, asked + 1);
    assert.equal(index().at(-1)!.headers["if-none-match"], '"b4"');
    assert.deepEqual(note().sought, { version: "3.32.0-beta.5", at: new Date(t1).toISOString() });
    assert.equal(note().failedAt, undefined, "not a failure");
    assert.equal(deviceAppFiles(w.env)?.version, "3.32.0-beta.4");
    // the brake: not one request before DEVICE_APP_BEHIND_MS
    asked = s.requests.length;
    for (const t of [t1 + 1000, t1 + BEHIND / 2, t1 + BEHIND - 1]) assert.deepEqual(await ensureDeviceApp(w.env, { now: () => t }), { result: "fresh", version: "3.32.0-beta.4" });
    assert.equal(s.requests.length, asked);
    // then asked again: a CDN gives beta.4 whole, another ETag — kept, sought again, still braked
    app(s, "3.32.0-beta.4", { etag: '"b4-cdn"' });
    const t2 = t1 + BEHIND;
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => t2 }), { result: "fetched", version: "3.32.0-beta.4" });
    assert.deepEqual(note().sought, { version: "3.32.0-beta.5", at: new Date(t2).toISOString() });
    asked = s.requests.length;
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => t2 + BEHIND - 1 }), { result: "fresh", version: "3.32.0-beta.4" });
    assert.equal(s.requests.length, asked);
    // a real failure: failedAt, tried again after DEVICE_APP_RETRY_MS (not the brake) — the copy kept, served
    s.routes.set("/run/index.html", { status: 503, type: "text/plain", body: "busy" });
    const t3 = t2 + BEHIND;
    assert.equal((await ensureDeviceApp(w.env, { now: () => t3 })).result, "failed");
    assert.equal(note().failedAt, new Date(t3).toISOString());
    asked = s.requests.length;
    assert.equal((await ensureDeviceApp(w.env, { now: () => t3 + BEHIND })).result, "failed");
    assert.equal(s.requests.length, asked, "a failure waits its hour");
    assert.equal(deviceAppFiles(w.env)?.version, "3.32.0-beta.4");
    assert.ok(fs.existsSync(path.join(deviceAppFiles(w.env)!.dir, "index.html")));
    // the site has beta.5 now: downloaded, the sought version forgotten, fresh for a day again; beta.4 kept beside it
    app(s, "3.32.0-beta.5", { etag: '"b5"' });
    const t4 = t3 + 3600_000;
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => t4 }), { result: "fetched", version: "3.32.0-beta.5" });
    assert.equal(note().sought, undefined);
    assert.deepEqual(fs.readdirSync(deviceAppRoot(w.env)).sort(), ["3.32.0-beta.4", "3.32.0-beta.5"]);
    asked = s.requests.length;
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => t4 + BEHIND }), { result: "fresh", version: "3.32.0-beta.5" });
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => t4 + DAY - 1 }), { result: "fresh", version: "3.32.0-beta.5" });
    assert.equal(s.requests.length, asked);
  } finally {
    w.done();
    await s.close();
  }
});

test("as on the computer that had it: a copy downloaded a minute before the app's new version, written by a strom before this one (no sought), the computer's app at the new one — asked at once after the gateway restarts", async () => {
  const s = await site();
  const w = world(s.origin);
  try {
    app(s, "3.32.0-beta.4", { etag: '"b4"' });
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 }), { result: "fetched", version: "3.32.0-beta.4" });
    noteDeviceAppSource(w.env, s.origin, "3.32.0-beta.5", () => T0 + 1000);
    const f = path.join(w.env.STROM_CONFIG_DIR!, "device-app.json");
    const { sought: _s, ...older } = JSON.parse(fs.readFileSync(f, "utf8"));
    fs.writeFileSync(f, JSON.stringify(older));
    app(s, "3.32.0-beta.5", { etag: '"b5"' });
    assert.deepEqual(await ensureDeviceApp(w.env, { now: () => T0 + 60_000 }), { result: "fetched", version: "3.32.0-beta.5" });
    assert.equal(deviceAppFiles(w.env)?.version, "3.32.0-beta.5");
  } finally {
    w.done();
    await s.close();
  }
});
