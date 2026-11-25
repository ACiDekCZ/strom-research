// The stream of events of a device of the home network (GET /device/events; devices.mode on, the phone's server on the
// loopback alone — STROM_PHONE_TEST; the app's site a stand-in on 127.0.0.1, never the internet; a ping a test's own,
// STROM_DEVICE_PING_MS): the device plays the Strom app — signs its query with K (EventSource sends no header) and
// opens each event in its order. The bridge's hello as /status through the gateway (nothing of the computer), the event
// device of a rename, a ping; an event moved does not open. Refused: the query's shape, a device not paired, a proof of
// another key, a nonce sent again (of the stream or of the tunnel, either way), a clock 3 minutes off, a tree not known,
// another page, a ninth stream of the device's row (the icon of its home screen counted with it). A stand-in of a
// tree's bridge (its live.json the test's own) shows what is told: the agent's work, an event not known and the bridge's
// comment are not, the computer's paths dropped; the device gone — the bridge's stream closed; the bridge's stream ended
// — the device's too; the bridge down — 502. Turned off: the streams closed, 404; unpaired: told so, sealed, and closed.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { b64url, deviceKey, eventsProof, fromB64url, openEvent, openPair, openResponse, pairProof, responseBody, sealRequest, type StreamEvent } from "../../src/core/devices.ts";
import { liveFile } from "../../src/core/live.ts";
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

/** A server of the loopback closed with every connection it holds. */
function closeServer(server: http.Server): Promise<void> {
  return new Promise<void>((ok) => {
    server.closeAllConnections();
    server.close(() => ok());
  });
}

type Dev = { id: string; key: Buffer };

/** A stream of events as the device follows it: each event opened in its order; its pings, its blocks as they came. */
type Follow = { n: string; status: number; headers: http.IncomingHttpHeaders; json: Record<string, any>; events: StreamEvent[]; blocks: string[]; pings: number; bad: number; ended: boolean; close: () => void };

function follow(url: string, dev: Dev, n: string, headers: Record<string, string> = {}): Promise<Follow> {
  return new Promise((resolve, reject) => {
    const f: Follow = { n, status: 0, headers: {}, json: {}, events: [], blocks: [], pings: 0, bad: 0, ended: false, close: () => {} };
    const req = http.get(url, { agent: false, headers }, (res) => {
      f.status = res.statusCode ?? 0;
      f.headers = res.headers;
      res.setEncoding("utf8");
      res.on("error", () => {});
      if (f.status !== 200) {
        let text = "";
        res.on("data", (c: string) => (text += c));
        res.on("end", () => {
          try {
            f.json = JSON.parse(text);
          } catch {
            // not JSON
          }
          f.ended = true;
          resolve(f);
        });
        return;
      }
      let buffer = "";
      let seq = 0;
      res.on("data", (c: string) => {
        buffer += c;
        let i: number;
        while ((i = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          f.blocks.push(block);
          if (block.startsWith(":")) {
            if (block === ": ping") f.pings++;
            continue;
          }
          const data = /^data: (.*)$/.exec(block)?.[1];
          const opened = data ? openEvent(dev.key, dev.id, n, seq++, JSON.parse(data)) : undefined;
          if (opened) f.events.push(opened);
          else f.bad++;
        }
      });
      res.on("end", () => (f.ended = true));
      res.on("close", () => (f.ended = true));
      resolve(f);
    });
    req.on("error", (e) => {
      f.ended = true;
      if (!f.status) reject(e);
    });
    f.close = () => req.destroy();
  });
}

test("the stream of events of a device: sealed in its order, nothing of the computer, every refusal, its ends", { skip, timeout: 300_000 }, async () => {
  const w = new World();
  const site = http.createServer((_req, res) => void res.writeHead(404, { "Content-Type": "text/plain" }).end("not here"));
  await new Promise<void>((ok) => site.listen(0, "127.0.0.1", ok));
  // a stand-in of the bridge of the second tree: its stream as the test writes it
  const TOKEN = crypto.randomBytes(16).toString("hex");
  const standIn = { mode: "ok" as "ok" | "fail", conns: [] as { res: http.ServerResponse; closed: boolean; headers: http.IncomingHttpHeaders }[], hello: {} as Record<string, unknown> };
  const fake = http.createServer((req, res) => {
    if (req.url !== `/${TOKEN}/events`) return void res.writeHead(404).end();
    if (standIn.mode === "fail") return void res.writeHead(500).end();
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8" });
    const c = { res, closed: false, headers: req.headers };
    standIn.conns.push(c);
    res.on("close", () => (c.closed = true));
    res.write(`event: hello\ndata: ${JSON.stringify(standIn.hello)}\n\n`);
  });
  await new Promise<void>((ok) => fake.listen(0, "127.0.0.1", ok));
  const fakePort = (fake.address() as net.AddressInfo).port;
  const opened: Follow[] = [];
  let standInFile: string | undefined;
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["init", "Lhotovi"], { cwd: w.home });
    const second = w.treeDir("Lhotovi");
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json"), JSON.stringify({ on: false, port: await freePort() }));
    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_DEVICE_LOCAL_NAME: "lhota-pc", STROM_DEVICE_PING_MS: "400" };
    const APP = { Origin: `http://127.0.0.1:${(site.address() as net.AddressInfo).port}`, "X-Strom-App-Version": "3.99.0", "Content-Type": "text/plain;charset=UTF-8" };
    const bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
    // the bridge says the stream only while on
    assert.ok(((await request("GET", `${bridge.url}/status`)).json.features as string[]).includes("device.events"));
    assert.equal((await request("POST", `${bridge.url}/phone/on`, "{}", APP)).status, 200);
    let address = "";
    await until("the phone's server", async () => {
      address = (await request("GET", `${bridge.url}/phone`, undefined, APP)).json.addresses?.[0]?.url ?? "";
      return !!address;
    }, { ms: 20_000 });
    const port = Number(new URL(address).port);
    const ip = `127.0.0.1:${port}`;

    const pairWith = async (pairId: string, secret: string) => {
      const key = deviceKey(fromB64url(secret, 32)!, pairId);
      const r = await request("POST", `${address}/device/pair`, JSON.stringify({ pairId, proof: pairProof(key, pairId), name: "Telefon Lhotáků", kind: "phone" }), { Origin: `http://${ip}`, "Content-Type": "application/json" });
      assert.equal(r.status, 200, r.text);
      return { key, said: openPair(key, pairId, r.json)! };
    };
    const code = await request("POST", `${bridge.url}/phone/pair`, JSON.stringify({ mode: "app" }), APP);
    const [pairId, secret] = String(code.json.url).split("#")[1]!.split(".") as [string, string];
    const first = await pairWith(pairId, secret);
    const me: Dev = { id: first.said.device.id, key: first.key };
    const trees = first.said.trees as { id: string; name: string }[];
    const tree = trees.find((t) => t.name === "Lhotákovi")!.id;
    const tree2 = trees.find((t) => t.name === "Lhotovi")!.id;
    assert.ok(tree && tree2, JSON.stringify(trees));

    const x = async (dev: Dev, m: string, p: string, b?: unknown, nonce?: Buffer) => {
      const envelope = sealRequest(dev.key, dev.id, Date.now(), { m, p, tree, ...(b === undefined ? {} : { b }) }, nonce);
      const r = await request("POST", `${address}/device/x`, JSON.stringify(envelope), { Origin: `http://${ip}`, "Content-Type": "application/json" });
      if (r.status !== 200) return { status: r.status, code: r.json.code as string, n: envelope.n, s: undefined as number | undefined, data: undefined as any };
      const inner = openResponse(dev.key, dev.id, envelope.n, r.json)!;
      const body = responseBody(inner);
      return { status: 200, code: undefined as string | undefined, n: envelope.n, s: inner.s, data: body ? JSON.parse(body.toString("utf8")) : undefined };
    };
    /** The query of a stream: signed by the device's K (or `key`), its time and nonce fresh unless said. */
    const query = (dev: Dev, t0: string, o: { t?: number; n?: string; app?: string; key?: Buffer; a?: string; drop?: string } = {}) => {
      const t = o.t ?? Date.now();
      const n = o.n ?? b64url(crypto.randomBytes(12));
      const q = new URLSearchParams({ d: dev.id, t: String(t), n, a: o.a ?? eventsProof(o.key ?? dev.key, t, n, t0, o.app), tree: t0, ...(o.app ? { app: o.app } : {}) });
      if (o.drop) q.delete(o.drop);
      return { url: `${address}/device/events?${q}`, n };
    };
    const open = async (dev: Dev, t0: string, o: Parameters<typeof query>[2] = {}, headers: Record<string, string> = {}) => {
      const q = query(dev, t0, o);
      const f = await follow(q.url, dev, q.n, headers);
      opened.push(f);
      return f;
    };

    // followed: 200, an event stream of no name outside, the hello first — /status as a device is told it
    const main = await open(me, tree, { app: "3.99.0" });
    assert.equal(main.status, 200, JSON.stringify(main.json));
    assert.match(String(main.headers["content-type"]), /^text\/event-stream/);
    assert.equal(main.headers["cache-control"], "no-store");
    assert.equal(main.headers["x-content-type-options"], "nosniff");
    await until("the hello", () => main.events.length > 0, { ms: 30_000, state: () => main.blocks });
    const hello = main.events[0]!;
    assert.equal(hello.event, "hello");
    const status = hello.data as Record<string, any>;
    assert.deepEqual([status.device.id, status.device.kind], [me.id, "phone"]);
    assert.ok((status.features as string[]).includes("device.events"));
    for (const k of ["work", "agents", "path", "treesRoot", "links", "linkScheme", "browser"]) assert.equal(status[k], undefined, k);
    const said = JSON.stringify(hello);
    for (const p of [w.cwd, fs.realpathSync(w.cwd), w.home, w.env.STROM_CONFIG_DIR!, w.env.HOME!, "strom-research://"]) assert.ok(!said.includes(p), `the hello names ${p}`);
    // each block `data: {"n", "c"}` alone: nothing outside says what the event is
    for (const b of main.blocks.filter((b) => !b.startsWith(":"))) {
      assert.match(b, /^data: \{[^\n]*\}$/);
      assert.deepEqual(Object.keys(JSON.parse(b.slice(6))).sort(), ["c", "n"]);
    }

    // renamed: the bridge's event device, sealed; an event moved in the stream does not open (the bridge looks at the
    // rows every 5 s: its look after the pairing first — told on this stream, or before it opened — else the new row
    // comes with the new name)
    const looked = Date.now() + 6000;
    await until("the bridge's look after the pairing", () => Date.now() > looked || main.events.some((e) => e.event === "device" && (e.data as any).what === "paired"), { ms: 30_000 });
    assert.equal((await x(me, "POST", "device/rename", { name: "Лхота телефон" })).s, 200);
    const isRenamed = (e: StreamEvent) => e.event === "device" && (e.data as any).what === "renamed";
    await until("the event renamed", () => main.events.some(isRenamed), { ms: 30_000, state: () => main.events });
    const renamed = main.events.find(isRenamed)!.data as Record<string, any>;
    assert.deepEqual([renamed.type, renamed.id, renamed.name], ["device", me.id, "Лхота телефон"]);
    assert.equal(main.bad, 0);
    const sealed = main.blocks.filter((b) => !b.startsWith(":")).map((b) => JSON.parse(b.slice(6)));
    const at = main.events.findIndex(isRenamed);
    assert.ok(at > 0);
    assert.deepEqual(openEvent(me.key, me.id, main.n, at, sealed[at]), main.events[at]);
    assert.equal(openEvent(me.key, me.id, main.n, at + 1, sealed[at]), undefined, "moved later");
    assert.equal(openEvent(me.key, me.id, main.n, 0, sealed[at]), undefined, "moved first");
    assert.equal(openEvent(me.key, me.id, main.n, at, sealed[0]), undefined, "the hello in its place");
    assert.equal(openEvent(me.key, me.id, b64url(crypto.randomBytes(12)), at, sealed[at]), undefined, "another stream's");
    // a ping of nothing (a test's 400 ms)
    await until("a ping", () => main.pings >= 1, { ms: 10_000, state: () => main.blocks });
    assert.ok(main.blocks.includes(": ping"));

    // every stream but the first closed, and the gateway has seen each end (its note in the phone's log)
    const endedNotes = () => (fs.readFileSync(phoneLogFile(w.env), "utf8").match(/ for the device dv_[a-z2-7]{16} ended: /g) ?? []).length;
    const settle = async () => {
      for (const f of opened) if (f !== main) f.close();
      const want = opened.filter((f) => f !== main && (f.status === 200 || f.status === 502)).length;
      await until("the gateway saw the streams end", () => endedNotes() >= want, { ms: 20_000, state: () => [endedNotes(), want] });
    };

    // refused, before the bridge is asked
    const refused = async (f: Promise<Follow>, want: [number, string], label: string) => {
      const r = await f;
      assert.deepEqual([r.status, r.json.code], want, `${label}: ${JSON.stringify(r.json)}`);
      return r;
    };
    for (const drop of ["d", "t", "n", "a", "tree"]) await refused(open(me, tree, { drop }), [400, "device.bad"], `no ${drop}`);
    await refused(open(me, tree, { app: "not a version" }), [400, "device.bad"], "an app of no version");
    await refused(open({ id: "dv_bbbbbbbbbbbbbbbb", key: me.key }, tree), [401, "device.unpaired"], "a device not paired");
    await refused(open(me, tree, { key: crypto.randomBytes(32) }), [400, "device.bad"], "another key");
    await refused(open(me, tree, { a: eventsProof(me.key, Date.now(), b64url(crypto.randomBytes(12)), tree) }), [400, "device.bad"], "the proof of another query");
    // the proof binds the tree and the app's version too
    {
      const t = Date.now();
      const n = b64url(crypto.randomBytes(12));
      await refused(open(me, tree2, { t, n, a: eventsProof(me.key, t, n, tree) }), [400, "device.bad"], "another tree");
      await refused(open(me, tree, { t, n, app: "3.98.0", a: eventsProof(me.key, t, n, tree, "3.99.0") }), [400, "device.bad"], "another version");
    }
    const late = await refused(open(me, tree, { t: Date.now() - 3 * 60_000 }), [409, "device.clock"], "3 minutes off");
    assert.deepEqual([typeof late.json.now, late.json.replay], ["number", false]);
    // a nonce once: the stream's again, the tunnel's for a stream, the stream's for the tunnel
    const once = query(me, tree);
    const ok = await follow(once.url, me, once.n);
    opened.push(ok);
    assert.equal(ok.status, 200);
    ok.close();
    assert.equal((await refused(follow(once.url, me, once.n), [409, "device.clock"], "the stream's nonce again")).json.replay, true);
    const tunnelled = await x(me, "GET", "status");
    assert.equal(tunnelled.s, 200);
    await refused(open(me, tree, { n: tunnelled.n }), [409, "device.clock"], "the tunnel's nonce");
    const streamed = query(me, tree);
    opened.push(await follow(streamed.url, me, streamed.n));
    assert.deepEqual([(await x(me, "GET", "status", undefined, fromB64url(streamed.n, 12))).code], ["device.clock"], "the stream's nonce in the tunnel");
    await refused(open(me, "tr_nothere"), [404, "tree.unknown"], "a tree not known");
    await refused(open(me, tree, {}, { Origin: "http://192.168.1.50:8080" }), [403, "phone.origin"], "another page");
    await refused(open(me, tree, {}, { Host: `jina.local:${port}` }), [421, "phone.host"], "another Host");

    // eight streams of a row at once: the icon of its home screen counted with its device
    await settle();
    const home = await x(me, "POST", "device/home", {});
    const [homeId, homeSecret] = String(home.data.url).split("#home.")[1]!.split(".") as [string, string];
    const iconPaired = await pairWith(homeId, homeSecret);
    const icon: Dev = { id: iconPaired.said.device.id, key: iconPaired.key };
    const row: Follow[] = [main];
    for (let i = 0; i < 6; i++) row.push(await open(me, tree));
    row.push(await open(icon, tree));
    assert.deepEqual(row.map((f) => f.status), Array(8).fill(200));
    await refused(open(icon, tree), [429, "device.streams"], "the ninth of the icon");
    await refused(open(me, tree2), [429, "device.streams"], "the ninth of the device, another tree");
    // one closed (seen by the gateway): room for one again, and only one
    const seen = endedNotes();
    row.pop()!.close();
    await until("the gateway saw it end", () => endedNotes() > seen, { ms: 20_000 });
    assert.equal((await open(me, tree)).status, 200, "the eighth again");
    await refused(open(me, tree), [429, "device.streams"], "the ninth again");
    await settle();

    // the stand-in of the second tree's bridge (the test's own live.json): what is told and what is not
    standInFile = liveFile(second);
    fs.mkdirSync(path.dirname(standInFile), { recursive: true });
    fs.writeFileSync(standInFile, JSON.stringify({ port: fakePort, token: TOKEN, pid: process.pid, url: `http://127.0.0.1:${fakePort}/${TOKEN}`, started: new Date().toISOString(), root: second }));
    standIn.hello = { name: "Lhotovi", features: ["device.events"], path: second, treesRoot: w.home, work: [{ who: "agent" }], agents: [{ name: "a" }], links: { open: "strom-research://open" }, linkScheme: "strom-research", note: path.join(second, "notes", "a.md"), people: 3 };
    const fakeMe = await open(me, tree2, { app: "3.99.0" });
    assert.equal(fakeMe.status, 200, JSON.stringify(fakeMe.json));
    await until("the stand-in asked", () => standIn.conns.length === 1);
    const conn = standIn.conns[0]!;
    assert.deepEqual([conn.headers["x-strom-device"], conn.headers["x-strom-app-version"]], [me.id, "3.99.0"]);
    conn.res.write(`event: working\ndata: [{"who":"agent","task":"T0001"}]\n\n`);
    conn.res.write(": still here\n\n");
    conn.res.write(`event: secret\ndata: {"x":1}\n\n`);
    conn.res.write(`event: change\ndata: ${JSON.stringify({ head: "abc", what: ["person P0001: Jan Lhoták"], entries: [{ subject: "Jan Lhoták", file: path.join(second, "data", "people.json") }] })}\n\n`);
    conn.res.write(`event: quality\ndata: {"rev":"r1"}\n\n`);
    await until("the events of the stand-in", () => fakeMe.events.length >= 3, { ms: 20_000, state: () => fakeMe.events });
    assert.deepEqual(fakeMe.events.map((e) => e.event), ["hello", "change", "quality"]);
    assert.deepEqual(fakeMe.events[0]!.data, { name: "Lhotovi", features: ["device.events"], people: 3, device: { id: me.id, name: "Лхота телефон", kind: "phone", actions: ["device.rename", "device.unpair", "device.home", "device.move", "conflict.decide", "hypothesis.decide", "sync.undo", "media.put"], others: 0 } });
    assert.deepEqual(fakeMe.events[1]!.data, { head: "abc", what: ["person P0001: Jan Lhoták"], entries: [{ subject: "Jan Lhoták" }] });
    assert.ok(!fakeMe.blocks.includes(": still here"), "the bridge's comment is not told");
    // the device closes: the gateway's stream of the bridge closed with it
    fakeMe.close();
    await until("the bridge's stream closed", () => conn.closed, { ms: 10_000 });
    // the bridge's stream ends: the device's ends (it connects again)
    const again = await open(me, tree2);
    await until("the stand-in asked again", () => standIn.conns.length === 2);
    standIn.conns[1]!.res.end();
    await until("the device's stream ended", () => again.ended, { ms: 10_000 });
    // the bridge answers no stream: 502 before any stream
    standIn.mode = "fail";
    await refused(open(me, tree2), [502, "bridge.down"], "the bridge refuses");
    fs.rmSync(standInFile, { force: true });
    standInFile = undefined;

    // turned off: the streams closed at once, the stream unknown (404), no feature
    const before = await open(icon, tree);
    assert.equal(before.status, 200);
    await w.ok(["config", "set", "devices.mode", "off"]);
    await until("the streams closed when off", () => main.ended && before.ended, { ms: 10_000 });
    assert.ok(!main.events.some((e) => (e.data as any)?.what === "unpaired"), "off tells nothing");
    await refused(open(me, tree), [404, "device.disabled"], "off");
    assert.ok(!((await request("GET", `${bridge.url}/status`)).json.features as string[]).some((f) => f.startsWith("device.")));
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });

    // unpaired (by the icon, the row with it): each stream of the row told so, sealed, its last event, and closed
    const mine = await open(me, tree);
    const icons = await open(icon, tree);
    assert.deepEqual([mine.status, icons.status], [200, 200]);
    await until("both hellos", () => mine.events.length > 0 && icons.events.length > 0, { ms: 30_000 });
    assert.deepEqual((await x(icon, "POST", "device/unpair", {})).data, { unpaired: true });
    await until("both streams closed", () => mine.ended && icons.ended, { ms: 10_000 });
    for (const f of [mine, icons]) {
      const last = f.events.at(-1)!;
      assert.equal(last.event, "device");
      assert.deepEqual([(last.data as any).type, (last.data as any).what, (last.data as any).id], ["device", "unpaired", me.id]);
      assert.equal(f.bad, 0);
    }
    await refused(open(me, tree), [401, "device.unpaired"], "unpaired");
    const log = fs.readFileSync(phoneLogFile(w.env), "utf8");
    assert.match(log, /ended: the device closed it/);
    assert.match(log, /ended: unpaired/);

    await w.ok(["phone", "off"]);
    await w.ok(["live", "stop"]);
  } finally {
    for (const f of opened) f.close();
    if (standInFile) fs.rmSync(standInFile, { force: true });
    await closeServer(fake);
    await closeServer(site);
    w.cleanup();
  }
});
