// Three devices of the home network at once on one gateway (devices.mode on, the phone's server on the loopback alone —
// STROM_PHONE_TEST): a phone, the icon of its home screen (its row) and a tablet of their own, each following its events
// (/device/events), asking through the tunnel (status, a batch closed) and sending files in blocks (PUT /device/media),
// all at the same time. Each answer opens with its device's key alone; the files of two rows reach the one bridge
// whole, none lost; the icon waits for its row's file (429) and sends after; nothing left running.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { b64url, deviceKey, eventsProof, fromB64url, MEDIA_BLOCK, openEvent, openPair, openResponse, pairProof, responseBody, sealMediaBody, sealRequest, type DeviceRequest, type StreamEvent } from "../../src/core/devices.ts";
import { deviceUploadsRoot } from "../../src/core/device-uploads.ts";

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

type Answer = { status: number; body: Buffer; json: Record<string, any> };

function request(method: string, url: string, body?: Buffer | string, headers: Record<string, string> = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const b = typeof body === "string" ? Buffer.from(body) : body;
    const req = http.request(url, { method, agent: false, headers: { ...(b !== undefined ? { "Content-Length": String(b.length) } : {}), ...headers } }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (c: Buffer) => parts.push(c));
      res.on("end", () => {
        const all = Buffer.concat(parts);
        let json: Record<string, any> = {};
        try {
          json = JSON.parse(all.toString("utf8"));
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: all, json });
      });
    });
    req.on("error", reject);
    req.end(b);
  });
}

function pdf(size: number, seed: number): Buffer {
  const b = Buffer.alloc(size);
  for (let j = 0; j < size; j++) b[j] = (j * 31 + 7 + seed) & 255;
  Buffer.from("%PDF-1.4\n").copy(b, 0);
  Buffer.from("\n%%EOF\n").copy(b, size - 7);
  return b;
}
const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

type Dev = { id: string; key: Buffer; name: string };
type Follow = { events: StreamEvent[]; bad: number; status: number; close: () => void };

/** A stream of events as a device follows it: each event opened with its key, in its order. */
function follow(url: string, dev: Dev, n: string): Promise<Follow> {
  return new Promise((resolve, reject) => {
    const f: Follow = { events: [], bad: 0, status: 0, close: () => {} };
    const req = http.get(url, { agent: false }, (res) => {
      f.status = res.statusCode ?? 0;
      res.setEncoding("utf8");
      res.on("error", () => {});
      let buffer = "";
      let seq = 0;
      res.on("data", (c: string) => {
        buffer += c;
        let i: number;
        while ((i = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          if (block.startsWith(":")) continue;
          const data = /^data: (.*)$/.exec(block)?.[1];
          const opened = data ? openEvent(dev.key, dev.id, n, seq++, JSON.parse(data)) : undefined;
          if (opened) f.events.push(opened);
          else f.bad++;
        }
      });
      resolve(f);
    });
    req.on("error", (e) => {
      if (!f.status) reject(e);
    });
    f.close = () => req.destroy();
  });
}

test("three devices at once: their events, the tunnel and files in blocks on one gateway — each answer theirs alone, every file whole", { skip, timeout: 300_000 }, async () => {
  const w = new World();
  const site = http.createServer((_req, res) => void res.writeHead(404, { "Content-Type": "text/plain" }).end("not here"));
  await new Promise<void>((ok) => site.listen(0, "127.0.0.1", ok));
  const streams: Follow[] = [];
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json"), JSON.stringify({ on: false, port: await freePort() }));
    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_DEVICE_LOCAL_NAME: "lhota-pc", STROM_DEVICE_PING_MS: "400" };
    const APP = { Origin: `http://127.0.0.1:${(site.address() as net.AddressInfo).port}`, "X-Strom-App-Version": "3.99.0", "Content-Type": "text/plain;charset=UTF-8" };
    const bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
    assert.equal((await request("POST", `${bridge.url}/phone/on`, "{}", APP)).status, 200);
    let address = "";
    await until("the phone's server", async () => {
      address = (await request("GET", `${bridge.url}/phone`, undefined, APP)).json.addresses?.[0]?.url ?? "";
      return !!address;
    }, { ms: 20_000 });
    const ORIGIN = { Origin: address };
    let tree = "";
    const pairWith = async (pairId: string, secret: string, name: string): Promise<Dev> => {
      const key = deviceKey(fromB64url(secret, 32)!, pairId);
      const r = await request("POST", `${address}/device/pair`, JSON.stringify({ pairId, proof: pairProof(key, pairId), name, kind: "phone" }), { ...ORIGIN, "Content-Type": "application/json" });
      assert.equal(r.status, 200, r.body.toString());
      const said = openPair(key, pairId, r.json)!;
      tree = (said.trees[0] as { id: string }).id;
      return { id: said.device.id, key, name };
    };
    const code = async () => String((await request("POST", `${bridge.url}/phone/pair`, JSON.stringify({ mode: "app" }), APP)).json.url).split("#")[1]!.split(".") as [string, string];

    type Opened = { s?: number; data?: any; status: number; raw: Record<string, any>; n: string };
    const x = async (dev: Dev, r: Omit<DeviceRequest, "tree">): Promise<Opened> => {
      const envelope = sealRequest(dev.key, dev.id, Date.now(), { tree, ...r } as DeviceRequest);
      const got = await request("POST", `${address}/device/x`, JSON.stringify(envelope), { ...ORIGIN, "Content-Type": "application/json" });
      if (got.status !== 200) return { status: got.status, raw: got.json, n: envelope.n };
      const inner = openResponse(dev.key, dev.id, envelope.n, got.json);
      assert.ok(inner, `${dev.name}: the answer opens with its key`);
      const body = responseBody(inner);
      return { status: 200, s: inner.s, data: body?.length ? JSON.parse(body.toString("utf8")) : undefined, raw: got.json, n: envelope.n };
    };

    const phone = await pairWith(...(await code()), "Telefon Lhotáků");
    const home = await x(phone, { m: "POST", p: "device/home", b: {} });
    const [homeId, homeSecret] = String(home.data.url).split("#home.")[1]!.split(".") as [string, string];
    const icon = await pairWith(homeId, homeSecret, "Ikona · Лхота");
    const tablet = await pairWith(...(await code()), "Tablet Lhotáků".normalize("NFD"));
    const all = [phone, icon, tablet];

    /** A file sent in blocks as its device sends it; its answer opened. */
    const put = async (dev: Dev, file: Buffer, meta: Record<string, string>): Promise<Opened> => {
      const t = Date.now();
      const base = crypto.randomBytes(12);
      const sha = sha256(file);
      const body = sealMediaBody(dev.key, dev.id, t, base, sha, meta, file);
      const got = await request("PUT", `${address}/device/media/${sha}`, body, { ...ORIGIN, "Content-Type": "application/octet-stream", "X-Strom-Device": dev.id, "X-Strom-Time": String(t), "X-Strom-Nonce": b64url(base), "X-Strom-Tree": tree, "X-Strom-Size": String(file.length), "X-Strom-From": "0" });
      const n = b64url(base);
      if (got.status !== 200) return { status: got.status, raw: got.json, n };
      const inner = openResponse(dev.key, dev.id, n, got.json);
      assert.ok(inner, `${dev.name}: the file's answer opens with its key`);
      const raw = responseBody(inner);
      return { status: 200, s: inner.s, data: raw?.length ? JSON.parse(raw.toString("utf8")) : undefined, raw: got.json, n };
    };

    // each follows its events
    for (const dev of all) {
      const t = Date.now();
      const n = b64url(crypto.randomBytes(12));
      const q = new URLSearchParams({ d: dev.id, t: String(t), n, a: eventsProof(dev.key, t, n, tree), tree });
      const f = await follow(`${address}/device/events?${q}`, dev, n);
      streams.push(f);
      assert.equal(f.status, 200, dev.name);
    }
    await until("each device's hello", () => streams.every((f) => f.events.some((e) => e.event === "hello")), { ms: 30_000 });
    streams.forEach((f, i) => assert.equal((f.events.find((e) => e.event === "hello")!.data as any).device.id, all[i]!.id));

    // all at once: the status of each, a file of two rows (two and three blocks), the icon's file while its row sends one
    const files = [pdf(2 * MEDIA_BLOCK + 70_000, 1), pdf(MEDIA_BLOCK + 9_000, 2), pdf(40_000, 3)];
    const [statuses, sentPhone, sentTablet] = await Promise.all([
      Promise.all(all.map((dev) => x(dev, { m: "GET", p: "status" }))),
      put(phone, files[0]!, { "X-Strom-Batch": "lhota-telefon-01", "X-Strom-Name": encodeURIComponent("telefon Лхота.pdf".normalize("NFD")) }),
      put(tablet, files[1]!, { "X-Strom-Batch": "lhota-tablet-01", "X-Strom-Name": "tablet.pdf" }),
    ]);
    statuses.forEach((r, i) => {
      assert.equal(r.s, 200, all[i]!.name);
      assert.equal(r.data.device.id, all[i]!.id);
      // the other devices connected now: one row besides its own (the phone and the icon of its home screen are one row)
      assert.equal(r.data.device.others, 1, all[i]!.name);
      // another device's key opens nothing of it
      for (const o of all) if (o !== all[i]) assert.equal(openResponse(o.key, all[i]!.id, r.n, r.raw), undefined);
    });
    for (const [r, f, owner] of [[sentPhone, files[0]!, phone], [sentTablet, files[1]!, tablet]] as const) {
      assert.deepEqual([r.status, r.s, r.data?.sha], [200, 200, sha256(f)], JSON.stringify(r.data));
      // opened with its own device's key (put), never with another's
      for (const o of all) if (o !== owner) assert.equal(openResponse(o.key, owner.id, r.n, r.raw), undefined, `${o.name} opens nothing of ${owner.name}'s`);
    }
    // the icon of the phone's row while the row sends: told to wait (429) or taken once the row's file is in — never both
    const iconSent = await put(icon, files[2]!, { "X-Strom-Batch": "lhota-ikona-01", "X-Strom-Name": "ikona.pdf" });
    assert.deepEqual([iconSent.s, iconSent.data?.sha], [200, sha256(files[2]!)], JSON.stringify(iconSent.data));

    // the batches closed through the tunnel at once (a write of each device)
    const closed = await Promise.all([
      x(phone, { m: "POST", p: "batch/lhota-telefon-01/done", b: { name: "Telefon · Лхота".normalize("NFD"), files: 1, person: "P0001" } }),
      x(tablet, { m: "POST", p: "batch/lhota-tablet-01/done", b: { name: "Tablet", files: 1, person: "P0001" } }),
      x(icon, { m: "POST", p: "batch/lhota-ikona-01/done", b: { name: "Ikona", files: 1 } }),
    ]);
    closed.forEach((r, i) => assert.equal(r.s, 200, `${i}: ${JSON.stringify(r.data)}`));
    // every file whole in the research, none lost
    for (const f of files) {
      const back = await request("GET", `${bridge.url}/media/${sha256(f)}?file=1`);
      assert.equal(back.status, 200);
      assert.ok(back.body.equals(f), "the file's bytes");
    }
    assert.deepEqual(fs.existsSync(deviceUploadsRoot(w.env)) ? fs.readdirSync(deviceUploadsRoot(w.env), { recursive: true }) : [], [], "no part left");
    // each stream told of the writes, each event opened with its own device's key alone
    await until("a change told to each", () => streams.every((f) => f.events.some((e) => e.event === "change")), { ms: 30_000 });
    for (const f of streams) assert.equal(f.bad, 0);

    for (const f of streams) f.close();
    await w.ok(["phone", "off"]);
    await w.ok(["live", "stop"]);
  } finally {
    for (const f of streams) f.close();
    w.cleanup();
    await new Promise<void>((ok) => {
      site.closeAllConnections();
      site.close(() => ok());
    });
  }
});
