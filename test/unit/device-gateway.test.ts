// The gateway of the devices of the home network (src/core/device-gateway.ts) on a server of the loopback: off — every
// /device/* is 404 device.disabled and the rest is the phone's page; on — hello, and the refusals before any key is
// looked for (another page's Origin, a body too big, no envelope, a device not paired). /status as a device is told it:
// nothing of the computer (folders, the agent's work, strom-research:// links). A request from the computer's own
// address never reaches the gateway (the phone's server closes the connection first).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { appGate, computerName, deviceActions, deviceGateway, localName, preparingLang, preparingPage, statusForDevice, TUNNEL_BODY_MAX } from "../../src/core/device-gateway.ts";
import { deviceAppRoot } from "../../src/core/deviceapp.ts";
import { remoteAllowed } from "../../src/core/phone.ts";
import { DEVICE_CONNECTED_MS, deviceById, deviceCode, deviceKey, devicePairCode, devicesList, fromB64url, openPair, openResponse, pairDevice, pairProof, responseBody, sealRequest, type RequestEnvelope } from "../../src/core/devices.ts";

function scratch(on: boolean): { env: Record<string, string>; dir: string; done: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-gateway-"));
  const config = path.join(dir, "config");
  fs.mkdirSync(config);
  fs.writeFileSync(path.join(config, "config.json"), JSON.stringify({ devicesMode: on ? "on" : "off" }));
  // the app's site a port of the loopback nobody listens on: the gateway downloads nothing (never the internet)
  return { env: { HOME: dir, STROM_CONFIG_DIR: config, STROM_SHARED: path.join(dir, "shared"), STROM_APP_URL: "http://127.0.0.1:9/run/" }, dir, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/**
 * A server of the loopback asking the gateway first, as the phone's server does once its checks passed (its own address,
 * or the computer's name the gateway knows — else 421): "page" when it is left to the page.
 */
async function serve(env: Record<string, string>): Promise<{ url: string; port: number; close: () => Promise<void> }> {
  const gateway = deviceGateway(env, () => {});
  const server = http.createServer((req, res) => {
    const { port } = server.address() as AddressInfo;
    const address = `127.0.0.1:${port}`;
    const host = req.headers.host === address ? address : gateway.named(req.headers.host, port);
    if (!host) {
      req.resume();
      return void res.writeHead(421, { "Content-Type": "application/json" }).end(JSON.stringify({ code: "phone.host" }));
    }
    // (X-Test-Phone-Paired: the request of a phone paired with the phone's page — its cookie, as the phone's server finds it)
    if (gateway.handle(req, res, { url: new URL(req.url ?? "/", `http://${host}`), host, port, phonePaired: req.headers["x-test-phone-paired"] === "1" })) return;
    req.resume();
    res.writeHead(200, { "Content-Type": "text/plain" }).end("page");
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: () =>
      new Promise<void>((ok) => {
        server.closeAllConnections();
        server.close(() => ok());
      }),
  };
}

function ask(url: string, method: string, body?: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string; json: Record<string, any> }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, agent: false, headers: { ...(body !== undefined ? { "Content-Length": String(Buffer.byteLength(body)) } : {}), ...headers } }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (c: Buffer) => parts.push(c));
      res.on("end", () => {
        const text = Buffer.concat(parts).toString("utf8");
        let json: Record<string, any> = {};
        try {
          json = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, text, json });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("off: /device/* is 404 device.disabled, the rest the phone's page as before", async () => {
  const s = scratch(false);
  const server = await serve(s.env);
  try {
    for (const [m, p] of [["GET", "/device/hello"], ["POST", "/device/pair"], ["POST", "/device/x"], ["GET", "/device"], ["GET", "/device/nothing"]] as const) {
      const r = await ask(`${server.url}${p}`, m, m === "POST" ? "{}" : undefined);
      assert.deepEqual([r.status, r.json.code], [404, "device.disabled"], `${m} ${p}`);
    }
    for (const p of ["/", "/pair?m=app", "/manifest.json", "/icons/icon-192.png"]) assert.equal((await ask(`${server.url}${p}`, "GET")).text, "page", p);
  } finally {
    await server.close();
    s.done();
  }
});

test("on: hello; another page's Origin 403, too big 413, no envelope 400, a device not paired 401; no app downloaded: the phone's page", async () => {
  const s = scratch(true);
  const server = await serve(s.env);
  try {
    const hello = await ask(`${server.url}/device/hello`, "GET");
    assert.equal(hello.status, 200);
    assert.deepEqual(hello.json, { v: 1, gateway: true, name: localName(s.env) ?? computerName(), label: computerName(), local: localName(s.env) !== null, port: Number(new URL(server.url).port), app: null });
    for (const p of ["/device/pair", "/device/x"]) {
      assert.deepEqual([(await ask(`${server.url}${p}`, "POST", "{}", { Origin: "http://evil.example" })).json.code], ["phone.origin"], p);
      assert.equal((await ask(`${server.url}${p}`, "POST", "{}", { Origin: "http://evil.example" })).status, 403, p);
    }
    // the gateway's own page may
    assert.equal((await ask(`${server.url}/device/x`, "POST", "{}", { Origin: server.url })).json.code, "device.bad");
    const big = await ask(`${server.url}/device/x`, "POST", "{}", { "Content-Length": String(TUNNEL_BODY_MAX + 1) });
    assert.deepEqual([big.status, big.json.code], [413, "device.large"]);
    assert.deepEqual([(await ask(`${server.url}/device/pair`, "POST", "x".repeat(5000))).status], [413]);
    for (const body of ["", "nope", "[]", '{"v":1}', JSON.stringify({ v: 1, d: "dv_nope", t: Date.now(), n: "AAAAAAAAAAAAAAAA", c: "AAAA" })]) {
      const r = await ask(`${server.url}/device/x`, "POST", body);
      assert.deepEqual([r.status, r.json.code], [400, "device.bad"], body);
    }
    const unknown = await ask(`${server.url}/device/x`, "POST", JSON.stringify({ v: 1, d: "dv_aaaaaaaaaaaaaaaa", t: Date.now(), n: "AAAAAAAAAAAAAAAA", c: "AAAAAAAAAAAAAAAAAAAAAAAA" }));
    assert.deepEqual([unknown.status, unknown.json.code], [401, "device.unpaired"]);
    // a pairing without a code made: expired; no JSON object: device.bad
    const pair = await ask(`${server.url}/device/pair`, "POST", JSON.stringify({ pairId: "A".repeat(22), proof: "A".repeat(43) }));
    assert.deepEqual([pair.status, pair.json.code], [410, "pair.expired"]);
    assert.deepEqual([(await ask(`${server.url}/device/pair`, "POST", "[]")).json.code], ["device.bad"]);
    // no app downloaded yet: the page that waits for it, never the phone's page; nothing else of the gateway's
    for (const p of ["/", "/pair?m=app", "/?m=page"]) assert.match((await ask(`${server.url}${p}`, "GET")).text, /location\.reload\(\)/, p);
    assert.equal((await ask(`${server.url}/manifest.json`, "GET")).json.code, "phone.not-found");
    assert.equal((await ask(`${server.url}/icons/..%2Fconfig.json`, "GET")).status, 404);
    assert.equal((await ask(`${server.url}/device/unknown`, "GET")).json.code, "phone.not-found");
  } finally {
    await server.close();
    s.done();
  }
});

test("/status as a device is told it: no folder of the computer, no agent's work, no strom-research:// link; the device said", () => {
  const s = scratch(true);
  try {
    const home = s.env.HOME!;
    const root = path.join(home, "Documents", "Strom", "Lhotákovi");
    const status = {
      strom: "1.34.0",
      features: ["phone", "device.gateway"],
      tree: { id: "t1", name: "Lhotákovi" },
      path: root,
      treesRoot: path.join(home, "Documents", "Strom"),
      work: { gate: null, minutes: 30 },
      agents: [{ id: "claude", name: "Claude Code" }],
      links: ["strom-research"],
      linkScheme: "strom-research-beta",
      browser: { on: true },
      books: { settings: { minTasks: 3 }, list: [{ title: "Matrika Lhota", folder: path.join(root, "inputs", "b1") }] },
      waiting: [
        { id: "T0001", text: "Napsat archivu v Lhotě", link: "strom-research://work?tree=t1&task=T0001" },
        { id: "T0002", text: `uloženo v ${path.join(root, "notes")}/x.md`, note: "Лхота — обычный текст" },
      ],
      said: ["čisté", `${home}/tajné`, "strom-research-beta://x"],
    };
    const out = statusForDevice(status, { id: "dv_aaaaaaaaaaaaaaaa", name: "Telefon Lhotáků", kind: "phone" }, { root, env: s.env });
    const text = JSON.stringify(out);
    for (const k of ["path", "treesRoot", "work", "agents", "links", "linkScheme", "browser"]) assert.ok(!(k in out), k);
    assert.ok(!text.includes(home), text);
    assert.doesNotMatch(text, /strom-research(-beta)?:/);
    assert.deepEqual(out.device, { id: "dv_aaaaaaaaaaaaaaaa", name: "Telefon Lhotáků", kind: "phone", actions: ["device.rename", "device.unpair", "device.home", "conflict.decide", "hypothesis.decide", "sync.undo", "media.put", "agent.bridge"], others: 0 });
    assert.deepEqual(out.books, { list: [{ title: "Matrika Lhota" }] });
    assert.deepEqual(out.said, ["čisté"]);
    assert.deepEqual((out.waiting as any[]).map((w) => [w.id, w.text, w.note]), [["T0001", "Napsat archivu v Lhotě", undefined], ["T0002", undefined, "Лхота — обычный текст"]]);
    assert.deepEqual(out.features, ["phone", "device.gateway"]);
  } finally {
    s.done();
  }
});

test("/status as a device is told it: how many other devices are connected now (others) — its own row (itself, the icons of its home screen) aside, rows alone, none seen lately", () => {
  const s = scratch(true);
  try {
    const T0 = Date.parse("2026-11-25T10:30:00Z");
    const proofOf = (pairId: string, secret: string) => pairProof(deviceKey(Buffer.from(secret, "base64url"), pairId), pairId);
    const pair = (name: string, kind: "phone" | "tablet" | "computer", at: number) => {
      const qr = devicePairCode(s.env, {}, () => at);
      const p = pairDevice(s.env, { pairId: qr.pairId, proof: proofOf(qr.pairId, qr.secret), name, kind, address: "http://192.168.1.40:47800" }, () => at);
      assert.ok(p.ok);
      return p.device;
    };
    const phone = pair("Telefon Lhotáků", "phone", T0);
    const tablet = pair("Tablet · Лхота".normalize("NFD"), "tablet", T0 + 10_000);
    const old = pair("Starý telefon", "phone", T0 - DEVICE_CONNECTED_MS - 1000);
    const home = deviceCode(s.env, phone, "home", () => T0);
    const icon = pairDevice(s.env, { pairId: home.id, proof: proofOf(home.id, home.secret), address: "http://192.168.1.40:47800" }, () => T0 + 20_000);
    assert.ok(icon.ok);
    const others = (d: { id: string }, now: number) => (statusForDevice({ tree: { id: "t1" } }, deviceById(s.env, d.id)!, { root: s.dir, env: s.env, now }).device as { others: number }).others;
    const now = T0 + 30_000;
    // the phone: the tablet (the old phone not seen lately; its own icon is its row)
    assert.equal(others(phone, now), 1);
    // the icon of the phone's home screen: the phone's row is its own — the tablet alone
    assert.equal(others(icon.device, now), 1);
    // the tablet: the phone's row once (the phone and its icon)
    assert.equal(others(tablet, now), 1);
    // the old phone asking: two rows besides its own
    assert.equal(others(old, now), 2);
    // later: the tablet no longer seen, the icon seen last keeps the phone's row connected
    assert.equal(others(tablet, T0 + 20_000 + DEVICE_CONNECTED_MS - 1), 1);
    assert.equal(others(tablet, T0 + 20_000 + DEVICE_CONNECTED_MS + 1), 0);
    // nothing else of the other devices said (no names, no ids)
    const said = JSON.stringify(statusForDevice({ tree: { id: "t1" } }, deviceById(s.env, phone.id)!, { root: s.dir, env: s.env, now }));
    for (const d of [tablet, old, icon.device]) assert.ok(!said.includes(d.id), d.id);
    assert.ok(!said.includes("Starý") && !said.includes("Tablet"), said);
  } finally {
    s.done();
  }
});

test("the computer's own address never reaches the gateway: refused before it, in a test of the loopback too", () => {
  const home = { ip: "192.168.1.40", mask: "255.255.255.0" };
  for (const env of [{}, { STROM_PHONE_TEST: "loopback" }]) {
    assert.equal(remoteAllowed("192.168.1.40", env, home), false);
    assert.equal(remoteAllowed("::ffff:192.168.1.40", env, home), false);
    assert.equal(remoteAllowed("192.168.1.41", env, home, ["192.168.1.41"]), false);
    assert.equal(remoteAllowed("192.168.1.41", env, home), true);
  }
  // in the phone's server the gateway is asked only after those checks and the one of its own address (Host: 421)
  const src = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "src", "core", "phone.ts"), "utf8");
  const handler = src.slice(src.indexOf("const handler: http.RequestListener"));
  const at = (s: string) => handler.indexOf(s);
  assert.ok(at("remoteAllowed(") > 0 && at('"phone.host"') > at("remoteAllowed(") && at("gateway.handle(") > at('"phone.host"'), "the gateway after the checks of the address");
});

test("the computer's name on the network: the first part of its hostname as DNS says it (none with diacritics), a test's own only on the loopback of an isolated run", () => {
  const test = { STROM_PHONE_TEST: "loopback", STROM_ISOLATED: "1" };
  const label = os.hostname().split(".")[0] ?? "";
  const own = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label) ? `${label.toLowerCase()}.local` : null;
  assert.equal(localName({}), own);
  assert.equal(localName({ STROM_DEVICE_LOCAL_NAME: "lhota-pc" }), own, "not a test: the computer's own");
  assert.equal(localName({ STROM_DEVICE_LOCAL_NAME: "lhota-pc", STROM_PHONE_TEST: "loopback" }), own, "not isolated: the computer's own");
  for (const [said, want] of [["lhota-pc", "lhota-pc.local"], ["Lhota-PC.local", "lhota-pc.local"], ["Počítač", null], ["Lhotův Mac", null], ["Лхота", null], ["", null], ["-lhota", null], ["lhota-", null], ["a".repeat(63), `${"a".repeat(63)}.local`], ["a".repeat(64), null]] as const)
    assert.equal(localName({ ...test, STROM_DEVICE_LOCAL_NAME: said }), want, said);
  // what a device may do with itself
  assert.deepEqual(deviceActions({}, { host: "192.168.1.23:47811", local: "lhota-pc.local:47811" }), ["device.rename", "device.unpair", "device.home", "device.move", "conflict.decide", "hypothesis.decide", "sync.undo", "media.put", "agent.bridge"]);
  assert.deepEqual(deviceActions({}, { host: "lhota-pc.local:47811", local: "lhota-pc.local:47811" }), ["device.rename", "device.unpair", "device.home", "conflict.decide", "hypothesis.decide", "sync.undo", "media.put", "agent.bridge"]);
  assert.deepEqual(deviceActions({ of: "dv_aaaaaaaaaaaaaaaa" }, { host: "192.168.1.23:47811", local: null }), ["device.rename", "device.unpair", "conflict.decide", "hypothesis.decide", "sync.undo", "media.put", "agent.bridge"]);
  // the agent started as the app on the computer starts it (spec 094 K3.15): only where the agent researches
  assert.deepEqual(deviceActions({}, { local: null, research: true }).slice(-3), ["media.put", "agent.start", "agent.bridge"]);
});

test("on: the computer's name <name>.local:<port> exactly (any case) — another .local, another port, or off: 421; hello says it", async () => {
  const s = scratch(true);
  const env = { ...s.env, STROM_PHONE_TEST: "loopback", STROM_ISOLATED: "1", STROM_DEVICE_LOCAL_NAME: "lhota-pc" };
  const server = await serve(env);
  try {
    for (const host of [`lhota-pc.local:${server.port}`, `LHOTA-PC.local:${server.port}`]) {
      const r = await ask(`${server.url}/device/hello`, "GET", undefined, { Host: host });
      assert.deepEqual([r.status, r.json.name, r.json.label, r.json.local], [200, "lhota-pc.local", computerName(), true], host);
    }
    for (const host of [`jina.local:${server.port}`, `lhota-pc.local:${server.port + 1}`, "lhota-pc.local", `lhota-pc.local.:${server.port}`, `evil.example:${server.port}`]) assert.equal((await ask(`${server.url}/device/hello`, "GET", undefined, { Host: host })).status, 421, host);
    fs.writeFileSync(path.join(s.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify({ devicesMode: "off" }));
    assert.equal((await ask(`${server.url}/`, "GET", undefined, { Host: `lhota-pc.local:${server.port}` })).status, 421, "off: as before");
    assert.equal((await ask(`${server.url}/`, "GET")).text, "page");
  } finally {
    await server.close();
    s.done();
  }
});

test("the actions of a device in the tunnel: renamed, an icon of the home screen paired by its code, moved to the computer's name (its old key 401), unpaired with its icon; refused: unknown actions, an icon's icon, a move where it is", async () => {
  const s = scratch(true);
  const env = { ...s.env, STROM_PHONE_TEST: "loopback", STROM_ISOLATED: "1", STROM_DEVICE_LOCAL_NAME: "lhota-pc" };
  const server = await serve(env);
  const unnamed = await serve({ ...env, STROM_DEVICE_LOCAL_NAME: "" });
  try {
    const ip = `127.0.0.1:${server.port}`;
    const local = `lhota-pc.local:${server.port}`;
    type Dev = { id: string; key: Buffer };
    const pair = async (pairId: string, secret: string, host: string, url = server.url) => {
      const key = deviceKey(fromB64url(secret, 32)!, pairId);
      const r = await ask(`${url}/device/pair`, "POST", JSON.stringify({ pairId, proof: pairProof(key, pairId), name: "Telefon", kind: "phone" }), { Host: host, Origin: `http://${host}` });
      return { r, key, said: r.status === 200 ? openPair(key, pairId, r.json) : undefined };
    };
    const x = async (dev: Dev, p: string, b: unknown, o: { host?: string; m?: string; envelope?: RequestEnvelope; url?: string } = {}) => {
      const host = o.host ?? ip;
      const envelope = o.envelope ?? sealRequest(dev.key, dev.id, Date.now(), { m: o.m ?? "POST", p, tree: "", ...(b === undefined ? {} : { b }) });
      const r = await ask(`${o.url ?? server.url}/device/x`, "POST", JSON.stringify(envelope), { Host: host, Origin: `http://${host}` });
      if (r.status !== 200) return { status: r.status, code: r.json.code as string, envelope };
      const inner = openResponse(dev.key, dev.id, envelope.n, r.json)!;
      return { status: 200, s: inner.s, data: JSON.parse(responseBody(inner)!.toString("utf8")), envelope };
    };
    const code = devicePairCode(env);
    const first = await pair(code.pairId, code.secret, ip);
    assert.equal(first.r.status, 200, first.r.text);
    assert.deepEqual(first.said!.computer, { name: "lhota-pc.local", label: computerName() });
    const me: Dev = { id: first.said!.device.id, key: first.key };

    // renamed: NFC, any script; nothing left — 400 device.name
    const renamed = await x(me, "device/rename", { name: "Telefon Lhotáků".normalize("NFD") });
    assert.deepEqual([renamed.s, renamed.data], [200, { device: { id: me.id, name: "Telefon Lhotáků", kind: "phone" } }]);
    assert.deepEqual([(await x(me, "device/rename", { name: " \u0000 " })).data.code, (await x(me, "device/rename", undefined)).data.code], ["device.name", "device.name"]);
    assert.equal((await x(me, "device/rename", { name: "Лхота" })).data.device.name, "Лхота");
    // anything else of device/: unknown (never carried to a bridge), whatever the method
    for (const [m, p] of [["POST", "device/conflict"], ["POST", "device/merge/X1"], ["POST", "device/nothing"], ["GET", "device/rename"], ["POST", "device/rename/x"], ["POST", "device"], ["POST", "device/constructor"], ["POST", "device/__proto__"]] as const) {
      const r = await x(me, p, {}, { m });
      assert.deepEqual([r.s, r.data.code], [404, "device.unknown-action"], `${m} ${p}`);
    }
    // the app's probe of the connection (a contract: never changed quietly): GET device without a body, of any tree or
    // none — answered sealed by the gateway itself (it is there, the key holds), 404 device.unknown-action, no bridge asked
    for (const tree of ["", "tr_nikde"]) {
      const envelope = sealRequest(me.key, me.id, Date.now(), { m: "GET", p: "device", tree });
      const probe = await x(me, "device", undefined, { envelope });
      assert.deepEqual([probe.status, probe.s, probe.data.code, probe.data.params], [200, 404, "device.unknown-action", { action: "device" }], `the probe, tree "${tree}"`);
    }

    // the icon of the home screen: its code at the address the device asks by, once; the icon a device of the row
    const home = await x(me, "device/home", {});
    assert.equal(home.s, 200);
    const h = new RegExp(`^http://${ip.replace(/\./g, "\\.")}/#home\\.([A-Za-z0-9_-]{22})\\.([A-Za-z0-9_-]{43})$`).exec(home.data.url);
    assert.ok(h, home.data.url);
    assert.ok(Date.parse(home.data.expiresAt) - Date.now() > 23 * 3600_000);
    const iconPaired = await pair(h[1]!, h[2]!, ip);
    assert.equal(iconPaired.r.status, 200, iconPaired.r.text);
    assert.deepEqual([iconPaired.said!.device.name, iconPaired.said!.device.kind], ["Лхота", "phone"]);
    const icon: Dev = { id: iconPaired.said!.device.id, key: iconPaired.key };
    assert.notEqual(icon.id, me.id);
    assert.deepEqual([(await pair(h[1]!, h[2]!, ip)).r.json.code], ["pair.used"]);
    assert.deepEqual([(await x(icon, "device/home", {})).s, (await x(icon, "device/home", {})).data.code], [409, "device.is-home"]);

    // the move: a code for the computer's name, paired there; the old key at the old address is unpaired there
    assert.deepEqual([(await x(me, "device/move", {}, { url: unnamed.url, host: `127.0.0.1:${unnamed.port}` })).data.code], ["device.no-name"]);
    const move = await x(me, "device/move", {});
    const mv = new RegExp(`^http://${local.replace(/\./g, "\\.")}/#move\\.([A-Za-z0-9_-]{22})\\.([A-Za-z0-9_-]{43})$`).exec(move.data.url);
    assert.ok(mv, move.data.url);
    assert.ok(Date.parse(move.data.expiresAt) - Date.now() <= 10 * 60_000);
    const moved = await pair(mv[1]!, mv[2]!, local);
    assert.equal(moved.r.status, 200, moved.r.text);
    assert.equal(moved.said!.device.id, me.id, "the same device");
    const there: Dev = { id: me.id, key: moved.key };
    const old = await x(me, "device/rename", { name: "x" });
    assert.deepEqual([old.status, old.code], [401, "device.unpaired"], "the old key at the old address");
    const oldThere = await x(me, "device/rename", { name: "x" }, { host: local });
    assert.deepEqual([oldThere.status, oldThere.code], [400, "device.bad"], "a byte wrong at its own address");
    assert.equal((await x(there, "device/rename", { name: "Лхота" }, { host: local })).s, 200);
    assert.deepEqual([(await x(there, "device/move", {}, { host: local })).data.code], ["device.named"]);
    const addresses = devicesList(env).map((d) => [d.id, d.address]);
    assert.deepEqual(addresses, [[me.id, `http://${local}`], [icon.id, `http://${ip}`]]);

    // refused before any action: a device not paired, a byte changed, sent again, a Host not its own
    const stranger = await x({ id: "dv_aaaaaaaaaaaaaaaa", key: Buffer.alloc(32, 1) }, "device/unpair", {});
    assert.deepEqual([stranger.status, stranger.code], [401, "device.unpaired"]);
    const once = await x(there, "device/rename", { name: "Лхота" }, { host: local });
    assert.deepEqual([(await x(there, "", undefined, { host: local, envelope: once.envelope })).code], ["device.clock"]);
    assert.equal((await x(there, "device/unpair", {}, { host: `jina.local:${server.port}` })).status, 421);

    // unpaired by the icon: the device's row gone, both keys 401
    const unpaired = await x(icon, "device/unpair", {});
    assert.deepEqual([unpaired.s, unpaired.data], [200, { unpaired: true }]);
    assert.deepEqual(devicesList(env), []);
    for (const [d, host] of [[icon, ip], [there, local]] as const) assert.deepEqual([(await x(d, "device/rename", { name: "x" }, { host })).code], ["device.unpaired"]);
  } finally {
    await server.close();
    await unnamed.close();
    s.done();
  }
});

test("the answer to a pairing says the tree whose window made the code (tree, as trees[].id): two trees, the code of B → B; a code of no tree, or of a tree not said here → no field", async () => {
  const s = scratch(false);
  const trees = path.join(s.dir, "trees");
  for (const [folder, id, name] of [["a", "tr_lhota_a", "Lhotákovi"], ["b", "tr_lhota_b", "Лхотаки"]] as const) {
    fs.mkdirSync(path.join(trees, folder), { recursive: true });
    fs.writeFileSync(path.join(trees, folder, "strom.json"), JSON.stringify({ id, name, lang: "cs", schema: 1 }));
  }
  fs.writeFileSync(path.join(s.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify({ devicesMode: "on", trees }));
  const env = { ...s.env, STROM_PHONE_TEST: "loopback", STROM_ISOLATED: "1", STROM_DEVICE_LOCAL_NAME: "lhota-pc" };
  const server = await serve(env);
  try {
    const host = `127.0.0.1:${server.port}`;
    const pair = async (code: { pairId: string; secret: string }) => {
      const key = deviceKey(fromB64url(code.secret, 32)!, code.pairId);
      const r = await ask(`${server.url}/device/pair`, "POST", JSON.stringify({ pairId: code.pairId, proof: pairProof(key, code.pairId), name: "Telefon", kind: "phone" }), { Host: host, Origin: `http://${host}` });
      assert.equal(r.status, 200, r.text);
      return openPair(key, code.pairId, r.json) as Record<string, any>;
    };
    const ofB = await pair(devicePairCode(env, { mode: "app", tree: "tr_lhota_b" }));
    assert.deepEqual(ofB.trees.map((t: { id: string }) => t.id).sort(), ["tr_lhota_a", "tr_lhota_b"]);
    assert.equal(ofB.tree, "tr_lhota_b");
    const ofA = await pair(devicePairCode(env, { mode: "app", tree: "tr_lhota_a" }));
    assert.equal(ofA.tree, "tr_lhota_a");
    for (const tree of [undefined, "tr_nikde"]) {
      const said = await pair(devicePairCode(env, { mode: "app", ...(tree ? { tree } : {}) }));
      assert.equal(said.trees.length, 2);
      assert.ok(!("tree" in said), JSON.stringify(said));
    }
    // a code a paired device was given (an icon of its home screen): no tree
    const icon = deviceCode(env, { id: ofB.device.id }, "home");
    const ofIcon = await pair({ pairId: icon.id, secret: icon.secret });
    assert.ok(!("tree" in ofIcon), JSON.stringify(ofIcon));
  } finally {
    await server.close();
    s.done();
  }
});

test("STROM_PHONE_TEST=lan of an isolated strom: the test's hooks hold (the gate of the app for the devices), no name of the computer on the network unless the test says one", () => {
  const lan = { STROM_PHONE_TEST: "lan", STROM_ISOLATED: "1" };
  assert.equal(appGate({ ...lan, STROM_DEVICE_APP_GATE: "3.40.0" }), "3.40.0");
  assert.equal(appGate({ STROM_PHONE_TEST: "loopback", STROM_ISOLATED: "1", STROM_DEVICE_APP_GATE: "3.40.0" }), "3.40.0");
  for (const env of [{ STROM_PHONE_TEST: "lan" }, { STROM_PHONE_TEST: "none", STROM_ISOLATED: "1" }, {}]) assert.equal(appGate({ ...env, STROM_DEVICE_APP_GATE: "3.40.0" }), undefined, JSON.stringify(env));
  assert.equal(appGate({ ...lan, STROM_DEVICE_APP_GATE: "nonsense" }), undefined);
  // never the computer's own name (a device of the test is not mixed with the phone connection of the person's strom)
  assert.equal(localName(lan), null);
  assert.equal(localName({ ...lan, STROM_DEVICE_LOCAL_NAME: "lhota-test" }), "lhota-test.local");
  assert.equal(localName({ ...lan, STROM_DEVICE_LOCAL_NAME: "" }), null);
  // not isolated: no test at all, the computer's own as for every strom
  assert.equal(localName({ STROM_PHONE_TEST: "lan", STROM_DEVICE_LOCAL_NAME: "lhota-test" }), localName({}));
});

/** A text for a person that addresses them (any of the four languages of the page that waits). */
const ADDRESSES = /(?<![\p{L}\p{M}\p{N}])(you|your|yours|vy|váš|vaše|vás|vám|ty|tvůj|tvoje|tobě|Sie|Ihr|Ihnen|du|dich|dir|dein|deine|ciebie|tobie|twój|pan|pani)(?![\p{L}\p{M}\p{N}])/iu;

/** The page that waits, its texts alone (what a person reads: the title, the paragraphs, the button). */
const textsOf = (html: string) => [...html.matchAll(/<(title|h1|p|button)[^>]*>(.*?)<\/\1>/gs)].map((m) => m[2]!.replace(/<[^>]+>/g, ""));

test("the page that waits for the app: four languages (?lang, else the browser's, else English), none addressing the person, NFC; the failure said in a sentence; it reloads itself and reads nothing of its address", () => {
  const titles: Record<string, RegExp> = { en: /^The computer is preparing the app$/, cs: /^Počítač připravuje aplikaci$/u, de: /^Der Computer bereitet die App vor$/, pl: /^Komputer przygotowuje aplikację$/u };
  for (const [lang, title] of Object.entries(titles)) {
    for (const failed of [false, true]) {
      const page = preparingPage(lang, "NONCE", { failed });
      assert.match(page, new RegExp(`<html lang="${lang}">`));
      const texts = textsOf(page);
      assert.match(texts[0]!, title, lang);
      assert.equal(texts.length, failed ? 5 : 4, `${lang}: ${texts.join(" | ")}`);
      for (const t of texts) {
        assert.doesNotMatch(t, ADDRESSES, `${lang}: ${t}`);
        assert.equal(t, t.normalize("NFC"), `${lang}: NFC`);
      }
      // its script and style under the nonce alone; it reads nothing of its address (the code after # stays for the app)
      assert.equal(page.match(/<script/g)!.length, 1);
      assert.match(page, /<script nonce="NONCE">/);
      assert.match(page, /<style nonce="NONCE">/);
      assert.doesNotMatch(page, /location\.(hash|href|search)|fetch\(|XMLHttpRequest|sendBeacon/);
      assert.match(page, /location\.reload\(\)/);
    }
  }
  assert.match(preparingPage("cs", "n", { failed: true }), /Počítač teď aplikaci stáhnout nemůže – je připojený k internetu\?/u);
  assert.doesNotMatch(preparingPage("cs", "n"), /internet/);
  // the language: ?lang first, the browser's in its order, then English; nothing of the object's own names
  assert.equal(preparingLang("de", "cs-CZ,cs;q=0.9"), "de");
  assert.equal(preparingLang(null, "cs-CZ,cs;q=0.9,en;q=0.8"), "cs");
  assert.equal(preparingLang("xx", "fr-FR, pl;q=0.7"), "pl");
  assert.equal(preparingLang(null, "fr-FR,uk;q=0.5"), "en");
  assert.equal(preparingLang("constructor", "__proto__, toString"), "en");
  assert.equal(preparingLang(undefined, undefined), "en");
  assert.equal(textsOf(preparingPage("toString", "n"))[0], "The computer is preparing the app");
});

test("on: / and /pair give the app alone — the page that waits while there is no copy to serve (none, under the gate), m=page no way back to the phone's page; the copy there: the app at the same address (a code made before it); a phone paired with the phone's page (its cookie, its icon's first opening) the page as before", async () => {
  const s = scratch(true);
  const env: Record<string, string> = { ...s.env, STROM_PHONE_TEST: "loopback", STROM_ISOLATED: "1", STROM_DEVICE_APP_GATE: "3.40.0-zkouska.2" };
  const server = await serve(env);
  const note = path.join(env.STROM_CONFIG_DIR!, "device-app.json");
  const copy = (version: string, extra: Record<string, unknown> = {}) => {
    const dir = path.join(deviceAppRoot(env), version);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), `<!doctype html><title>Strom</title><span id="about-version">${version}</span>`);
    fs.writeFileSync(note, JSON.stringify({ version, from: "http://127.0.0.1:9", checkedAt: new Date().toISOString(), ...extra }));
  };
  const get = (p: string, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; text: string; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
      http.get(`${server.url}${p}`, { agent: false, headers }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (d: string) => (text += d));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text, headers: res.headers }));
      }).on("error", reject);
    });
  const OLD_ICON = "/?home=AAAAAAAAAAAAAAAAAAAAAA";
  try {
    // a code of the app made before the computer has its copy (N2): the page that waits, in the browser's language
    const code = devicePairCode(env, { mode: "app" });
    assert.equal(code.mode, "app");
    for (const p of ["/", "/pair?m=app", "/pair?m=page", "/?m=page", "/pair", "/pair?m=page&lang=en"]) {
      const r = await get(p, { "Accept-Language": "cs-CZ,cs;q=0.9" });
      assert.equal(r.status, 200, p);
      assert.notEqual(r.text, "page", p);
      assert.match(String(r.headers["content-type"]), /^text\/html; charset=utf-8/);
      assert.equal(r.headers["cache-control"], "no-store");
      assert.equal(r.headers["x-content-type-options"], "nosniff");
      assert.equal(r.headers["referrer-policy"], "no-referrer");
      const csp = String(r.headers["content-security-policy"]);
      const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
      assert.ok(nonce && r.text.includes(`<script nonce="${nonce}">`), csp);
      assert.match(csp, /default-src 'none'/);
      assert.match(csp, /frame-ancestors 'none'/);
      assert.doesNotMatch(csp, /unsafe-inline/);
      // (the copy asked for by the first request: the site of the test refuses — said from then on)
      const lang = p.includes("lang=en") ? "en" : "cs";
      assert.ok([preparingPage(lang, "N"), preparingPage(lang, "N", { failed: true })].includes(r.text.replaceAll(nonce, "N")), p);
    }
    // the page asked the computer for its copy (under its brakes: one try, the failure noted, not again within its hour)
    const tried = () => fs.existsSync(note) && !!JSON.parse(fs.readFileSync(note, "utf8")).failedAt;
    for (let i = 0; i < 100 && !tried(); i++) await new Promise((r) => setTimeout(r, 50));
    assert.ok(tried(), "tried, failed");
    assert.match((await get("/")).text, /<p class="failed">/);
    // the last download failed: said in a sentence, tried again all the same
    copy("3.40.0-zkouska.1", { failedAt: new Date().toISOString(), error: "fetch failed" });
    const failed = await get("/pair?m=app", { "Accept-Language": "de-DE,de;q=0.9" });
    assert.match(failed.text, /Der Computer kann die App gerade nicht herunterladen/);
    // a copy under the gate of its version: the page that waits too
    copy("3.40.0-zkouska.1");
    for (const p of ["/", "/pair?m=app"]) assert.equal(textsOf((await get(p, { "Accept-Language": "pl" })).text)[0], "Komputer przygotowuje aplikację", p);
    // a phone paired with the phone's page: its page as before (its cookie; its icon opened the first time)
    for (const [p, h] of [["/", { "X-Test-Phone-Paired": "1" }], ["/pair?lang=en", { "X-Test-Phone-Paired": "1" }], [OLD_ICON, {}]] as const) assert.equal((await get(p, h)).text, "page", p);
    // such a phone scanning a new code: the app's (here the page that waits), never the old page
    assert.equal(textsOf((await get("/pair?m=app", { "X-Test-Phone-Paired": "1", "Accept-Language": "pl" })).text)[0], "Komputer przygotowuje aplikację");
    // the copy there: the app at the very address the code gave (its # untouched), at / and /pair, m=page too
    copy("3.40.0-zkouska.2");
    for (const p of ["/", "/pair?m=app", "/pair?m=page", "/?m=page&lang=en", "/pair?home=AAAAAAAAAAAAAAAAAAAAAA"]) {
      const r = await get(p);
      assert.equal(r.status, 200, p);
      assert.match(r.text, /<span id="about-version">3\.40\.0-zkouska\.2<\/span>/, p);
    }
    for (const [p, h] of [["/", { "X-Test-Phone-Paired": "1" }], [OLD_ICON, {}]] as const) assert.equal((await get(p, h)).text, "page", p);
    assert.match((await get("/pair?m=app", { "X-Test-Phone-Paired": "1" })).text, /about-version/, "a new code of a phone of the old page: the app");
    // not the old icon's code: the app
    for (const p of ["/?home=short", "/?home=AAAAAAAAAAAAAAAAAAAAAA%21"]) assert.match((await get(p)).text, /about-version/, p);
  } finally {
    await server.close();
    s.done();
  }
});
