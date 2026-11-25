// The gateway of the devices of the home network with real processes (devices.mode on, the phone's server on the
// loopback alone — STROM_PHONE_TEST; the Strom app for the devices from a stand-in of its site on 127.0.0.1, never the
// internet): a code to pair made by the tree's bridge, the device plays the Strom app — derives K from the code after #,
// pairs, and asks the bridge through the sealed tunnel (status without anything of the computer, the tree gzipped, one
// write of the person's). / gives the app (the gate of its version by the test's switch), the phone's page to a phone
// paired with it. Refused: a path only the computer has, another Host, a device not paired, a byte changed, a request
// sent again, a clock 3 minutes off, another page's Origin, a device taken off; devices.mode off while the server runs —
// /device/* 404 at once, the device kept and asking again without pairing once it is on.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import zlib from "node:zlib";
import { World, hasGit, until } from "../helpers.ts";
import { decodeQr, svgModules } from "../qr-decode.ts";
import { deviceKey, fromB64url, GZIP_FROM, openPair, openResponse, pairProof, responseBody, sealRequest, type DeviceRequest, type RequestEnvelope } from "../../src/core/devices.ts";
import { liveLogFile } from "../../src/core/live.ts";
import { phoneLogFile, phonePage } from "../../src/core/phone.ts";

const skip = !hasGit || process.platform === "win32";
const VERSION = "3.99.0";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

type Answer = { status: number; text: string; bytes: Buffer; json: Record<string, any>; headers: http.IncomingHttpHeaders };

function request(method: string, url: string, body?: string, headers: Record<string, string> = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, agent: false, headers: { ...(body !== undefined ? { "Content-Length": String(Buffer.byteLength(body)) } : {}), ...headers } }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (c: Buffer) => parts.push(c));
      res.on("end", () => {
        const bytes = Buffer.concat(parts);
        const text = bytes.toString("utf8");
        let json: Record<string, any> = {};
        try {
          json = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, text, bytes, json, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

/** A stand-in of the app's site on the loopback: its copy under /run/ (index with its version, manifest, an icon). */
async function site(): Promise<{ origin: string; icon: Buffer; close: () => Promise<void> }> {
  const icon = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), crypto.randomBytes(60)]);
  const files: Record<string, [string, Buffer | string]> = {
    "/run/index.html": ["text/html; charset=utf-8", `<!doctype html><html><head><link rel="manifest" href="manifest.json"><title>Strom</title></head><body><span id="about-version">${VERSION}</span><p>Aplikace pro zařízení — Лхота</p>${"<!-- výplň -->".repeat(200)}</body></html>`],
    "/run/manifest.json": ["application/manifest+json", JSON.stringify({ name: "Strom", start_url: "./", scope: "./", icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }] })],
    "/run/icons/icon-192.png": ["image/png", icon],
  };
  const server = http.createServer((req, res) => {
    const f = files[req.url ?? ""];
    if (!f) return void res.writeHead(404, { "Content-Type": "text/plain" }).end("not here");
    res.writeHead(200, { "Content-Type": f[0] }).end(f[1]);
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address() as net.AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    icon,
    close: () =>
      new Promise<void>((ok) => {
        server.closeAllConnections();
        server.close(() => ok());
      }),
  };
}

const isPhonePage = (text: string, lang: string) => {
  const nonce = /nonce="([^"]+)"/.exec(text)?.[1];
  return !!nonce && text.replaceAll(nonce, "N") === phonePage(lang, "N");
};

type Device = { id: string; key: Buffer };
type Tunnel = Answer & { envelope: RequestEnvelope; s?: number; inner?: ReturnType<typeof openResponse>; body?: Buffer | null; data?: any };

test("the gateway of the devices: paired through the bridge's code, the sealed tunnel to the tree's bridge, the app at /; every refusal", { skip, timeout: 300_000 }, async () => {
  const w = new World();
  const app = await site();
  try {
    await w.withTree("Lhotákovi");
    const a = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--json"])).json.person.id as string;
    const b = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1851", "--json"])).json.person.id as string;
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json"), JSON.stringify({ on: false, port: await freePort() }));
    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_DEVICE_APP_GATE: VERSION, STROM_DEVICE_LOCAL_NAME: "lhota-pc" };
    const APP = { Origin: app.origin, "X-Strom-App-Version": VERSION, "Content-Type": "text/plain;charset=UTF-8" };
    let bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
    assert.equal((await request("POST", `${bridge.url}/phone/on`, "{}", APP)).status, 200);
    let address = "";
    await until("the phone's server", async () => {
      address = (await request("GET", `${bridge.url}/phone`, undefined, APP)).json.addresses?.[0]?.url ?? "";
      return !!address;
    }, { ms: 20_000 });

    // the bridge: the features of the gateway; GET phone notes the app's copy, which the computer downloads
    const direct = await request("GET", `${bridge.url}/status`);
    for (const f of ["device.gateway", "device.phonePage"]) assert.ok(direct.json.features.includes(f), f);
    let devices: Record<string, any> = {};
    await until("the app for the devices downloaded", async () => {
      devices = (await request("GET", `${bridge.url}/phone`, undefined, APP)).json.devices;
      return devices?.app === "ready";
    }, { ms: 30_000, state: () => devices });
    assert.deepEqual(devices, { app: "ready", appVersion: VERSION, name: "lhota-pc.local", list: [], connectedNow: 0 });

    // a code to pair from the bridge: the address and its QR code, the secret after # never in a log
    assert.equal((await request("POST", `${bridge.url}/phone/pair`, JSON.stringify({ mode: "app" }), { "Content-Type": "text/plain" })).status, 403, "only the app's pages");
    assert.equal((await request("POST", `${bridge.url}/phone/pair`, JSON.stringify({ mode: "both" }), APP)).json.code, "phone.pair-body");
    const code = await request("POST", `${bridge.url}/phone/pair`, JSON.stringify({ mode: "app" }), APP);
    assert.equal(code.status, 200, code.text);
    const m = new RegExp(`^${address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/pair\\?m=app#([A-Za-z0-9_-]{22})\\.([A-Za-z0-9_-]{43})$`).exec(code.json.url);
    assert.ok(m, code.json.url);
    const [, pairId, secret] = m as unknown as [string, string, string];
    assert.equal(decodeQr(svgModules(code.json.qr)).text, code.json.url);
    assert.ok(Date.parse(code.json.expiresAt) > Date.now());
    for (const log of [liveLogFile(w.cwd), phoneLogFile(w.env)]) assert.ok(!fs.readFileSync(log, "utf8").includes(secret), log);

    // the device: K from the code, its proof; the answer sealed with K
    const key = deviceKey(fromB64url(secret, 32)!, pairId);
    const pairBody = JSON.stringify({ pairId, proof: pairProof(key, pairId), name: "Telefon Lhotáků".normalize("NFD"), kind: "phone" });
    assert.equal((await request("POST", `${address}/device/pair`, pairBody, { Origin: "http://evil.example" })).status, 403, "another page pairs nothing");
    const paired = await request("POST", `${address}/device/pair`, pairBody, { Origin: address, "Content-Type": "application/json" });
    assert.equal(paired.status, 200, paired.text);
    const said = openPair(key, pairId, paired.json);
    assert.ok(said, "the answer opens with K");
    assert.match(said.device.id, /^dv_[a-z2-7]{16}$/);
    assert.deepEqual([said.device.name, said.device.kind], ["Telefon Lhotáků", "phone"]);
    assert.deepEqual(said.trees.map((t: any) => [t.name, t.archive]), [["Lhotákovi", false]]);
    assert.ok(!JSON.stringify(said).includes(w.home), "no folder of the computer");
    const tree = (said.trees[0] as { id: string }).id;
    const used = await request("POST", `${address}/device/pair`, pairBody, { Origin: address });
    assert.deepEqual([used.status, used.json.code], [410, "pair.used"]);
    const me: Device = { id: said.device.id, key };

    const x = async (dev: Device, r: Omit<DeviceRequest, "tree"> & { tree?: string }, o: { t?: number; change?: (e: RequestEnvelope) => RequestEnvelope; envelope?: RequestEnvelope; headers?: Record<string, string> } = {}): Promise<Tunnel> => {
      const envelope = o.envelope ?? sealRequest(dev.key, dev.id, o.t ?? Date.now(), { tree, ...r });
      const sent = o.change ? o.change(envelope) : envelope;
      const got = await request("POST", `${address}/device/x`, JSON.stringify(sent), { Origin: address, "Content-Type": "application/json", ...o.headers });
      if (got.status !== 200) return { ...got, envelope };
      const inner = openResponse(dev.key, dev.id, envelope.n, got.json);
      assert.ok(inner, "the answer opens with K");
      const body = responseBody(inner);
      let data: any;
      try {
        data = body ? JSON.parse(body.toString("utf8")) : undefined;
      } catch {
        data = undefined;
      }
      return { ...got, envelope, s: inner.s, inner, body, data };
    };

    // the tunnel: /status as a device is told it — the device, nothing of the computer
    assert.equal(direct.json.path, w.cwd, "the bridge says its folder to the computer's app");
    const status = await x(me, { m: "GET", p: "status" });
    assert.equal(status.status, 200, status.text);
    assert.equal(status.s, 200);
    for (const f of ["device.gateway", "device.phonePage"]) assert.ok(status.data.features.includes(f), f);
    assert.deepEqual(status.data.device, { id: me.id, name: "Telefon Lhotáků", kind: "phone", actions: ["device.rename", "device.unpair", "device.home", "device.move", "conflict.decide", "hypothesis.decide", "sync.undo", "media.put"], others: 0 });
    for (const k of ["work", "agents", "path", "treesRoot"]) assert.ok(!(k in status.data), k);
    assert.ok(!status.body!.toString("utf8").includes(w.home), "no folder of the computer");
    assert.doesNotMatch(status.body!.toString("utf8"), /strom-research(-[\p{L}\p{N}]+)?:/u);
    // seen now: connected
    const seen = (await request("GET", `${bridge.url}/phone`, undefined, APP)).json.devices;
    assert.deepEqual(seen.list.map((d: any) => [d.id, d.name, d.kind, d.via, d.connected, d.stale, d.home]), [[me.id, "Telefon Lhotáků", "phone", "app", true, false, false]]);
    assert.equal(seen.connectedNow, 1);

    // past 1 KiB gzipped inside (status is), base64url; the tree as the bridge gives it
    assert.equal(status.inner!.z, "gzip");
    const ged = await x(me, { m: "GET", p: "tree.ged" });
    assert.equal(ged.s, 200);
    assert.equal(ged.inner!.z, ged.body!.length > GZIP_FROM ? "gzip" : undefined);
    assert.match(ged.body!.toString("utf8"), /^(\uFEFF)?0 HEAD/);
    assert.match(ged.body!.toString("utf8"), /Lhoták/);
    // the answer not gzipped when the device asks so
    assert.equal((await x(me, { m: "GET", p: "status", h: { "Accept-Encoding": "identity" } })).inner!.z, undefined);

    // one write of the person's: a finding marked no error, as the app's
    const dismiss = await x(me, { m: "POST", p: "quality/dismiss", b: { kind: "possibleDuplicate", persons: [b, a] } });
    assert.equal(dismiss.s, 200, dismiss.body?.toString("utf8"));
    assert.equal(dismiss.data.ok, true);
    const quality = await x(me, { m: "GET", p: "quality" });
    assert.deepEqual(quality.data.dismissed.map((d: any) => [d.kind, d.persons, d.by]), [["possibleDuplicate", [a, b], "app"]]);

    // refused inside: what only the computer does, a tree not known
    const agent = await x(me, { m: "POST", p: "hypotheses", b: { decide: "agent" } });
    assert.deepEqual([agent.s, agent.data.code, agent.data.action], [403, "device.computer-only", "hypotheses"]);
    const climb = await x(me, { m: "GET", p: "status/../../config.json" });
    assert.deepEqual([climb.s, climb.data.code], [403, "device.computer-only"]);
    // the bridge's secret in a path, as it is, percent-encoded, at its front: refused by the gateway itself (the bridge
    // never says device.computer-only) — a word of no secret is carried
    const token = new URL(bridge.url).pathname.split("/").filter(Boolean)[0]!;
    assert.ok(token.length >= 16, bridge.url);
    const encoded = [...token].map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join("");
    for (const p of [`status/${token}`, `status/${encoded}`, `status/x${token}`, `excerpt/${token.slice(0, 2)}%${token.charCodeAt(2).toString(16).padStart(2, "0")}${token.slice(3)}`]) {
      const secret = await x(me, { m: "GET", p });
      assert.deepEqual([secret.s, secret.data.code, secret.data.action], [403, "device.computer-only", "path"], p);
    }
    const front = await x(me, { m: "GET", p: `${token}/status` });
    assert.deepEqual([front.s, front.data.code], [403, "device.computer-only"]);
    assert.notEqual((await x(me, { m: "GET", p: "status/lhota" })).data?.code, "device.computer-only", "carried to the bridge");
    const unknownTree = await x(me, { m: "GET", p: "status", tree: "nope" });
    assert.deepEqual([unknownTree.s, unknownTree.data.code], [404, "tree.unknown"]);

    // refused outside: another Host, another page, a device not paired, a byte changed, sent again, a clock 3 minutes off
    const port = new URL(address).port;
    assert.equal((await x(me, { m: "GET", p: "status" }, { headers: { Host: `evil.example:${port}` } })).status, 421);
    assert.deepEqual([(await x(me, { m: "GET", p: "status" }, { headers: { Origin: "http://evil.example" } })).json.code], ["phone.origin"]);
    const stranger = await x({ id: "dv_aaaaaaaaaaaaaaaa", key: crypto.randomBytes(32) }, { m: "GET", p: "status" });
    assert.deepEqual([stranger.status, stranger.json.code], [401, "device.unpaired"]);
    const changed = await x(me, { m: "GET", p: "status" }, { change: (e) => ({ ...e, c: e.c.slice(0, 5) + (e.c[5] === "A" ? "B" : "A") + e.c.slice(6) }) });
    assert.deepEqual([changed.status, changed.json.code], [400, "device.bad"]);
    const once = sealRequest(me.key, me.id, Date.now(), { m: "GET", p: "status", tree });
    assert.equal((await x(me, { m: "GET", p: "status" }, { envelope: once })).s, 200);
    const again = await x(me, { m: "GET", p: "status" }, { envelope: once });
    // sent again: said apart from a clock off (replay) — the device never sends a write again blindly
    assert.deepEqual([again.status, again.json.code, again.json.replay], [409, "device.clock", true]);
    const late = await x(me, { m: "GET", p: "status" }, { t: Date.now() + 3 * 60_000 });
    assert.deepEqual([late.status, late.json.code, late.json.replay], [409, "device.clock", false]);
    assert.ok(Math.abs(late.json.now - Date.now()) < 60_000, "the gateway's time");

    // / : the app (its gate by the test's switch), cached by its ETag, gzipped when asked; ?m=page the phone's page
    const page = await request("GET", `${address}/`);
    assert.equal(page.status, 200);
    assert.match(page.text, new RegExp(`<span id="about-version">${VERSION.replace(/\./g, "\\.")}</span>`));
    assert.match(page.text, /Лхота/);
    assert.equal(page.headers["cache-control"], "no-cache");
    assert.equal(page.headers["x-content-type-options"], "nosniff");
    assert.equal(page.headers["referrer-policy"], "no-referrer");
    assert.match(String(page.headers["content-security-policy"]), /frame-ancestors 'none'/);
    const etag = String(page.headers.etag);
    assert.ok(etag.length > 4);
    const cached = await request("GET", `${address}/pair?m=app`, undefined, { "If-None-Match": etag });
    assert.deepEqual([cached.status, cached.bytes.length], [304, 0]);
    const packed = await request("GET", `${address}/`, undefined, { "Accept-Encoding": "gzip, br" });
    assert.equal(packed.headers["content-encoding"], "gzip");
    assert.equal(zlib.gunzipSync(packed.bytes).toString("utf8"), page.text);
    assert.ok(isPhonePage((await request("GET", `${address}/?m=page&lang=en`)).text, "en"));
    const manifest = await request("GET", `${address}/manifest.json`);
    assert.deepEqual([manifest.json.start_url, manifest.json.scope, manifest.json.icons.map((i: any) => i.src)], ["/", "/", ["/icons/icons/icon-192.png"]]);
    // (an icon under /icons/ by its path in the app's folder)
    const icon = await request("GET", `${address}/icons/icons/icon-192.png`);
    assert.deepEqual([icon.status, icon.headers["content-type"]], [200, "image/png"]);
    assert.ok(icon.bytes.equals(app.icon));
    for (const p of ["/icons/..%2F..%2Fdevices.json", "/icons/../devices.json", "/icons/index.html", "/icons/icon-192.png"]) assert.equal((await request("GET", `${address}${p}`)).status, 404, p);
    const hello = await request("GET", `${address}/device/hello`);
    assert.deepEqual([hello.json.v, hello.json.gateway, hello.json.port, hello.json.app], [1, true, Number(port), VERSION]);
    // a phone paired with the phone's page gets its page
    const pageCode = await request("POST", `${bridge.url}/phone/pair`, JSON.stringify({ mode: "page", lang: "en" }), APP);
    assert.match(pageCode.json.url, /\/pair\?m=page&lang=en#[A-Za-z0-9_-]{22}$/);
    const phonePaired = await request("POST", `${address}/pair`, JSON.stringify({ code: pageCode.json.url.split("#")[1] }), { Origin: address, "Content-Type": "text/plain;charset=UTF-8" });
    assert.equal(phonePaired.status, 200, phonePaired.text);
    const cookie = String(phonePaired.headers["set-cookie"]).split(";")[0]!;
    assert.ok(isPhonePage((await request("GET", `${address}/?lang=en`, undefined, { Cookie: cookie })).text, "en"), "the phone's page for a phone of it");

    // devices.mode off while the server runs: /device/* 404 at once, / the phone's page; the device kept
    await w.ok(["config", "set", "devices.mode", "off"]);
    const off = await x(me, { m: "GET", p: "status" });
    assert.deepEqual([off.status, off.json.code], [404, "device.disabled"]);
    assert.ok(isPhonePage((await request("GET", `${address}/?lang=en`)).text, "en"));
    assert.ok(!(await request("GET", `${bridge.url}/status`)).json.features.some((f: string) => f.startsWith("device.")));
    assert.ok(!("devices" in (await request("GET", `${bridge.url}/phone`, undefined, APP)).json));
    const kept = JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "devices.json"), "utf8")) as { devices: { id: string }[] };
    assert.deepEqual(kept.devices.map((d) => d.id), [me.id]);
    // on again: the device asks without pairing
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    assert.equal((await x(me, { m: "GET", p: "status" })).s, 200);

    // the bridge not running: started for the device
    await w.ok(["live", "stop"]);
    const started = await x(me, { m: "GET", p: "status" });
    assert.equal(started.s, 200, started.body?.toString("utf8"));
    bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };

    // taken off through the bridge: 401 at once; put back within its while with its undo; taken off again for good
    const gone = await request("DELETE", `${bridge.url}/phone/devices/${me.id}`, undefined, APP);
    assert.equal(gone.status, 200, gone.text);
    assert.ok(gone.json.undo);
    assert.deepEqual(gone.json.devices.list, []);
    assert.deepEqual([(await x(me, { m: "GET", p: "status" })).status], [401]);
    const back = await request("POST", `${bridge.url}/phone/devices/${me.id}/restore`, JSON.stringify({ undo: gone.json.undo }), APP);
    assert.equal(back.status, 200, back.text);
    assert.equal((await x(me, { m: "GET", p: "status" })).s, 200);
    const goneAgain = await request("DELETE", `${bridge.url}/phone/devices/${me.id}`, undefined, APP);
    assert.equal(goneAgain.status, 200);
    const unpaired = await x(me, { m: "GET", p: "status" });
    assert.deepEqual([unpaired.status, unpaired.json.code], [401, "device.unpaired"]);
    assert.deepEqual([(await request("POST", `${bridge.url}/phone/devices/${me.id}/restore`, JSON.stringify({ undo: "nope" }), APP)).json.code], ["device.gone"]);
    assert.deepEqual([(await request("DELETE", `${bridge.url}/phone/devices/dv_bbbbbbbbbbbbbbbb`, undefined, APP)).json.code], ["device.unknown"]);
    assert.equal((await request("DELETE", `${bridge.url}/phone/devices/${me.id}`, undefined, { "Content-Type": "text/plain" })).status, 403, "only the app's pages");

    await w.ok(["phone", "off"]);
    await w.ok(["live", "stop"]);
  } finally {
    w.cleanup();
    await app.close();
  }
});
