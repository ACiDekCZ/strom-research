// The devices of the home network managed (devices.mode on, the phone's server on the loopback alone — STROM_PHONE_TEST;
// the copy of the app from a stand-in of its site on 127.0.0.1, never the internet; the computer's name a test's own,
// lhota-pc.local): the bridge says the computer's name and the rows of the devices, renames one (PUT phone/devices/<id>)
// and takes off a row with the icon of its home screen; the device in the tunnel renames itself, gets a code for its
// icon and one to move to the computer's name, and unpairs itself. The bridge's stream says each change (the event
// device: paired, renamed, gone, connected, unpaired). Refused: an icon's id from the computer, a name of nothing, the
// computer's paths of the devices from a device (403), another .local and another port (421), the old key after the
// move (401); off: the name 421, /device/* 404, no feature, PUT 404.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { deviceKey, fromB64url, openPair, openResponse, pairProof, responseBody, sealRequest, type RequestEnvelope } from "../../src/core/devices.ts";
import { liveLogFile } from "../../src/core/live.ts";
import { phoneLogFile } from "../../src/core/phone.ts";

const skip = !hasGit || process.platform === "win32";

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

type Answer = { status: number; text: string; json: Record<string, any> };

function request(method: string, url: string, body?: string, headers: Record<string, string> = {}): Promise<Answer> {
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

/** A stand-in of the app's site on the loopback that has no copy of the app (the gateway asks it, never the internet). */
async function site(): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => void res.writeHead(404, { "Content-Type": "text/plain" }).end("not here"));
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address() as net.AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((ok) => {
        server.closeAllConnections();
        server.close(() => ok());
      }),
  };
}

/** The bridge's stream of events: those named `device` as they come. */
function deviceStream(url: string): { events: any[]; close: () => void } {
  const events: any[] = [];
  let buffer = "";
  const req = http.get(url, { agent: false }, (res) => {
    res.setEncoding("utf8");
    res.on("data", (c: string) => {
      buffer += c;
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const name = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.+)$/m.exec(block)?.[1];
        if (name === "device" && data) events.push(JSON.parse(data));
      }
    });
    res.on("error", () => {});
  });
  req.on("error", () => {});
  return { events, close: () => req.destroy() };
}

type Dev = { id: string; key: Buffer };

test("the devices managed: the computer's name, the rows with their icons, renamed from both sides, moved to the name, unpaired; the bridge's events of them; every refusal; off as before", { skip, timeout: 300_000 }, async () => {
  const w = new World();
  const app = await site();
  let stream: ReturnType<typeof deviceStream> | undefined;
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json"), JSON.stringify({ on: false, port: await freePort() }));
    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_DEVICE_LOCAL_NAME: "Lhota-PC" };
    const APP = { Origin: app.origin, "X-Strom-App-Version": "3.99.0", "Content-Type": "text/plain;charset=UTF-8" };
    const bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
    // the copy of the app the devices get: the stand-in's (noted before the phone's server ever asks for it)
    assert.equal((await request("GET", `${bridge.url}/phone`, undefined, APP)).json.devices.name, "lhota-pc.local");
    const features = (await request("GET", `${bridge.url}/status`)).json.features as string[];
    for (const f of ["device.gateway", "device.rename", "device.events"]) assert.ok(features.includes(f), f);
    assert.ok(!features.includes("device.phonePage"), "one way to pair");
    stream = deviceStream(`${bridge.url}/events`);
    assert.equal((await request("POST", `${bridge.url}/phone/on`, "{}", APP)).status, 200);
    let address = "";
    await until("the phone's server", async () => {
      address = (await request("GET", `${bridge.url}/phone`, undefined, APP)).json.addresses?.[0]?.url ?? "";
      return !!address;
    }, { ms: 20_000 });
    const port = Number(new URL(address).port);
    const ip = `127.0.0.1:${port}`;
    const local = `lhota-pc.local:${port}`;
    const events = stream.events;
    const waitEvent = (what: string, id: string) => until(`the event ${what} of ${id}`, () => events.some((e) => e.what === what && e.id === id), { ms: 30_000, state: () => events });

    // the computer's name: hello at the address and at the name, exactly (any case); another .local or port 421
    const hello = await request("GET", `${address}/device/hello`);
    assert.deepEqual([hello.json.name, hello.json.local, typeof hello.json.label], ["lhota-pc.local", true, "string"]);
    assert.equal((await request("GET", `${address}/device/hello`, undefined, { Host: `LHOTA-PC.local:${port}` })).status, 200);
    for (const host of [`jina.local:${port}`, `lhota-pc.local:${port + 1}`]) assert.deepEqual([(await request("GET", `${address}/device/hello`, undefined, { Host: host })).json.code], ["phone.host"], host);

    // paired by the QR code: the event paired; the answer says the computer's name
    const pairWith = async (pairId: string, secret: string, host: string) => {
      const key = deviceKey(fromB64url(secret, 32)!, pairId);
      const r = await request("POST", `${address}/device/pair`, JSON.stringify({ pairId, proof: pairProof(key, pairId), name: "Telefon Lhotáků".normalize("NFD"), kind: "phone" }), { Host: host, Origin: `http://${host}`, "Content-Type": "application/json" });
      assert.equal(r.status, 200, r.text);
      return { key, said: openPair(key, pairId, r.json)! };
    };
    const code = await request("POST", `${bridge.url}/phone/pair`, JSON.stringify({ mode: "app" }), APP);
    const [pairId, secret] = String(code.json.url).split("#")[1]!.split(".") as [string, string];
    const first = await pairWith(pairId, secret, ip);
    assert.deepEqual([first.said.computer.name, typeof first.said.computer.label], ["lhota-pc.local", "string"]);
    const me: Dev = { id: first.said.device.id, key: first.key };
    const tree = (first.said.trees[0] as { id: string }).id;
    await waitEvent("paired", me.id);

    const x = async (dev: Dev, m: string, p: string, b?: unknown, o: { host?: string; envelope?: RequestEnvelope } = {}) => {
      const host = o.host ?? ip;
      const envelope = o.envelope ?? sealRequest(dev.key, dev.id, Date.now(), { m, p, tree, ...(b === undefined ? {} : { b }) });
      const r = await request("POST", `${address}/device/x`, JSON.stringify(envelope), { Host: host, Origin: `http://${host}`, "Content-Type": "application/json" });
      if (r.status !== 200) return { status: r.status, code: r.json.code as string, envelope, s: undefined as number | undefined, data: undefined as any };
      const inner = openResponse(dev.key, dev.id, envelope.n, r.json)!;
      const body = responseBody(inner);
      return { status: 200, code: undefined as string | undefined, envelope, s: inner.s, data: body ? JSON.parse(body.toString("utf8")) : undefined };
    };

    // /status through the gateway: the device's kind and what it may do (a move: it asks at the address)
    const status = await x(me, "GET", "status");
    assert.deepEqual(status.data.device, { id: me.id, name: "Telefon Lhotáků", kind: "phone", actions: ["device.rename", "device.unpair", "device.home", "device.move", "conflict.decide", "hypothesis.decide", "sync.undo", "media.put", "agent.start", "agent.bridge"], others: 0 });

    // renamed by the device itself: the event renamed, the bridge's row
    const renamed = await x(me, "POST", "device/rename", { name: "Лхота телефон" });
    assert.deepEqual([renamed.s, renamed.data.device.name], [200, "Лхота телефон"]);
    await waitEvent("renamed", me.id);
    assert.equal(events.find((e) => e.what === "renamed" && e.id === me.id).name, "Лхота телефон");
    // the computer's paths of the devices are the computer's: never from a device
    for (const [m, p] of [["PUT", `phone/devices/${me.id}`], ["DELETE", `phone/devices/${me.id}`], ["POST", "phone/pair"]] as const) {
      const r = await x(me, m, p, { name: "x" });
      assert.deepEqual([r.s, r.data.code], [403, "device.computer-only"], `${m} ${p}`);
    }
    assert.deepEqual([(await x(me, "POST", "device/merge/X0001", { take: "user" })).data.code], ["device.unknown-action"]);

    // the icon of the home screen: paired by its code, folded into the row (home), no row of its own
    const home = await x(me, "POST", "device/home", {});
    assert.match(home.data.url, new RegExp(`^http://127\\.0\\.0\\.1:${port}/#home\\.`));
    const [homeId, homeSecret] = String(home.data.url).split("#home.")[1]!.split(".") as [string, string];
    const iconPaired = await pairWith(homeId, homeSecret, ip);
    const icon: Dev = { id: iconPaired.said.device.id, key: iconPaired.key };
    assert.equal(iconPaired.said.device.name, "Лхота телефон");
    let phone = (await request("GET", `${bridge.url}/phone`, undefined, APP)).json.devices;
    assert.deepEqual(phone.list.map((d: any) => [d.id, d.name, d.home, d.connected, d.stale]), [[me.id, "Лхота телефон", true, true, false]]);
    assert.equal(phone.connectedNow, 1);
    assert.ok(!events.some((e) => e.id === icon.id), "an icon is no row");
    assert.deepEqual((await x(icon, "GET", "status")).data.device.actions, ["device.rename", "device.unpair", "device.move", "conflict.decide", "hypothesis.decide", "sync.undo", "media.put", "agent.start", "agent.bridge"]);

    // renamed on the computer: the row (the icon with it); an icon's id, nothing of a name, an id unknown, another page refused
    const put = await request("PUT", `${bridge.url}/phone/devices/${me.id}`, JSON.stringify({ name: "Tablet Lhotáků".normalize("NFD") }), APP);
    assert.equal(put.status, 200, put.text);
    assert.deepEqual([put.json.device.id, put.json.device.name, put.json.device.home], [me.id, "Tablet Lhotáků", true]);
    assert.deepEqual(put.json.devices.list.map((d: any) => d.name), ["Tablet Lhotáků"]);
    assert.equal((await x(icon, "GET", "status")).data.device.name, "Tablet Lhotáků");
    for (const [id, body, want] of [[icon.id, { name: "x" }, [404, "device.unknown"]], [me.id, { name: "  " }, [400, "device.name"]], [me.id, {}, [400, "device.name"]], ["dv_bbbbbbbbbbbbbbbb", { name: "x" }, [404, "device.unknown"]]] as const) {
      const r = await request("PUT", `${bridge.url}/phone/devices/${id}`, JSON.stringify(body), APP);
      assert.deepEqual([r.status, r.json.code], want, `${id} ${JSON.stringify(body)}`);
    }
    assert.equal((await request("PUT", `${bridge.url}/phone/devices/${me.id}`, JSON.stringify({ name: "x" }), { "Content-Type": "text/plain" })).status, 403, "only the app's pages");
    await until("the event renamed from the computer", () => events.some((e) => e.what === "renamed" && e.name === "Tablet Lhotáků"), { ms: 30_000, state: () => events });

    // gone (seen 10 minutes ago, the icon too) and connected again by its next request
    const file = path.join(w.env.STROM_CONFIG_DIR!, "devices.json");
    const kept = JSON.parse(fs.readFileSync(file, "utf8")) as { devices: Record<string, unknown>[] };
    fs.writeFileSync(file, JSON.stringify({ devices: kept.devices.map((d) => ({ ...d, lastSeenAt: new Date(Date.now() - 10 * 60_000).toISOString() })) }));
    await waitEvent("gone", me.id);
    assert.equal((await x(me, "GET", "status")).s, 200);
    await waitEvent("connected", me.id);

    // moved to the computer's name: the same device with a new key there; the old key at the address 401
    const move = await x(me, "POST", "device/move", {});
    assert.match(move.data.url, new RegExp(`^http://lhota-pc\\.local:${port}/#move\\.`));
    const [moveId, moveSecret] = String(move.data.url).split("#move.")[1]!.split(".") as [string, string];
    const moved = await pairWith(moveId, moveSecret, local);
    assert.equal(moved.said.device.id, me.id);
    const there: Dev = { id: me.id, key: moved.key };
    assert.deepEqual([(await x(me, "GET", "status")).code], ["device.unpaired"]);
    const at = await x(there, "GET", "status", undefined, { host: local });
    assert.deepEqual(at.data.device.actions, ["device.rename", "device.unpair", "device.home", "conflict.decide", "hypothesis.decide", "sync.undo", "media.put", "agent.start", "agent.bridge"], "no move where it is");
    assert.deepEqual([(await x(there, "POST", "device/move", {}, { host: local })).data.code], ["device.named"]);
    phone = (await request("GET", `${bridge.url}/phone`, undefined, APP)).json.devices;
    assert.deepEqual(phone.list.map((d: any) => [d.id, d.stale]), [[me.id, false]], "the name is an address of the gateway");
    // refused before any action at the name too: a byte changed, sent again
    const changed = await x(there, "POST", "device/unpair", {}, { host: local, envelope: { ...sealRequest(there.key, there.id, Date.now(), { m: "POST", p: "device/unpair", tree }), c: "AAAA" + "A".repeat(40) } });
    assert.deepEqual([changed.status, changed.code], [400, "device.bad"]);
    const once = await x(there, "GET", "status", undefined, { host: local });
    assert.deepEqual([(await x(there, "GET", "status", undefined, { host: local, envelope: once.envelope })).code], ["device.clock"]);

    // taken off on the computer: an icon's id is no row; the row with its icon, put back with it
    assert.deepEqual([(await request("DELETE", `${bridge.url}/phone/devices/${icon.id}`, undefined, APP)).json.code], ["device.unknown"]);
    const gone = await request("DELETE", `${bridge.url}/phone/devices/${me.id}`, undefined, APP);
    assert.equal(gone.status, 200, gone.text);
    for (const [d, host] of [[there, local], [icon, ip]] as const) assert.deepEqual([(await x(d, "GET", "status", undefined, { host })).code], ["device.unpaired"]);
    assert.equal((await request("POST", `${bridge.url}/phone/devices/${me.id}/restore`, JSON.stringify({ undo: gone.json.undo }), APP)).status, 200);
    assert.equal((await x(icon, "GET", "status")).s, 200, "the icon back with its device");

    // unpaired by the icon: the row gone, the event unpaired
    assert.deepEqual((await x(icon, "POST", "device/unpair", {})).data, { unpaired: true });
    for (const [d, host] of [[there, local], [icon, ip]] as const) assert.deepEqual([(await x(d, "GET", "status", undefined, { host })).code], ["device.unpaired"]);
    await waitEvent("unpaired", me.id);
    assert.deepEqual(events.find((e) => e.what === "unpaired").kind, "phone");
    for (const e of events) assert.deepEqual(Object.keys(e).sort(), ["at", "id", "kind", "name", "type", "what"]);

    // the secrets of the codes never in a log
    for (const log of [liveLogFile(w.cwd), phoneLogFile(w.env)]) {
      const text = fs.readFileSync(log, "utf8");
      for (const s of [secret, homeSecret, moveSecret]) assert.ok(!text.includes(s), log);
    }

    // off: the name 421, /device/* 404, no feature, PUT 404, no event
    const before = events.length;
    await w.ok(["config", "set", "devices.mode", "off"]);
    assert.deepEqual([(await request("GET", `${address}/device/hello`, undefined, { Host: local })).status], [421]);
    assert.deepEqual([(await request("GET", `${address}/device/hello`)).json.code], ["device.disabled"]);
    assert.ok(!(await request("GET", `${bridge.url}/status`)).json.features.some((f: string) => f.startsWith("device.")));
    assert.equal((await request("PUT", `${bridge.url}/phone/devices/${me.id}`, JSON.stringify({ name: "x" }), APP)).status, 404);
    await new Promise((r) => setTimeout(r, 6000));
    assert.equal(events.length, before, "nothing said while off");

    await w.ok(["phone", "off"]);
    await w.ok(["live", "stop"]);
  } finally {
    stream?.close();
    w.cleanup();
    await app.close();
  }
});
