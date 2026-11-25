// What a paired device of the home network decides through the gateway itself, as the person (devices.mode on, the
// phone's server on the loopback alone — STROM_PHONE_TEST; the app for the devices from a stand-in of its site on
// 127.0.0.1): a conflict of an edit of the app by side, a hypothesis (a variant, none holds, the proposal not taken), a
// send taken back (its preview first: nothing written). Each a strom of its own in the tree's folder, for the app, the
// device named on its operations (via) — in the bridge's /log and strom history --json, as a send of the device is (its
// own words of its device replaced by the device's, whatever it says; a header of its own never carried). Refused: a
// body not taken, a record by another shape, what only the computer does, a research held by another strom (503,
// Retry-After), a device not paired, a byte changed, a request sent again, another Host, devices.mode off.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, until } from "../helpers.ts";
import { deviceKey, fromB64url, openPair, openResponse, pairProof, responseBody, sealRequest, type DeviceRequest, type RequestEnvelope } from "../../src/core/devices.ts";

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

type Answer = { status: number; text: string; json: Record<string, any>; headers: http.IncomingHttpHeaders };

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
        resolve({ status: res.statusCode ?? 0, text, json, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

/** A stand-in of the app's site on the loopback: its copy under /run/. */
async function site(): Promise<{ origin: string; close: () => Promise<void> }> {
  const files: Record<string, [string, string]> = {
    "/run/index.html": ["text/html; charset=utf-8", `<!doctype html><html><head><link rel="manifest" href="manifest.json"><title>Strom</title></head><body><span id="about-version">${VERSION}</span></body></html>`],
    "/run/manifest.json": ["application/manifest+json", JSON.stringify({ name: "Strom", start_url: "./", scope: "./", icons: [] })],
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
    close: () =>
      new Promise<void>((ok) => {
        server.closeAllConnections();
        server.close(() => ok());
      }),
  };
}

type Device = { id: string; key: Buffer };
type Tunnel = Answer & { s?: number; h?: Record<string, string>; data?: any };

test("a device decides as the person through the gateway: a conflict by side, a hypothesis, a send taken back (its preview first); the device on each operation; every refusal", { skip, timeout: 300_000 }, async () => {
  const w = new World();
  const app = await site();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    await w.ok(["source", "add", "Křest Jana Lhotáka 1885", "--kind", "baptism"]); // S1
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
    await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Lhota", "--cite", "S1"]); // E1: cited — an edit of it a conflict
    await w.ok(["event", "add", "P1", "BIRT", "--date", "ABT 1885", "--place", "Lhota"]); // E2: of nobody's record — an edit of it written
    await w.ok(["hypothesis", "add", "Čí syn je Jan?", "--about", "P1", "--variant", "A: syn Václava", "--variant", "B: syn Jakuba"]); // H1
    await w.ok(["hypothesis", "add", "Kde se Jan narodil?", "--about", "P1", "--variant", "A: v Lhotě", "--variant", "B: jinde"]); // H2
    await w.ok(["hypothesis", "add", "Kdy se Jan oženil?", "--about", "P1", "--variant", "A: 1910", "--variant", "B: 1911"]); // H3
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json"), JSON.stringify({ on: false, port: await freePort() }));
    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_DEVICE_APP_GATE: VERSION, STROM_DEVICE_LOCAL_NAME: "lhota-pc" };
    const APP = { Origin: app.origin, "X-Strom-App-Version": VERSION, "Content-Type": "text/plain;charset=UTF-8" };
    const bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
    assert.equal((await request("POST", `${bridge.url}/phone/on`, "{}", APP)).status, 200);
    let address = "";
    await until("the phone's server", async () => {
      address = (await request("GET", `${bridge.url}/phone`, undefined, APP)).json.addresses?.[0]?.url ?? "";
      return !!address;
    }, { ms: 20_000 });

    // paired as the app pairs
    const code = await request("POST", `${bridge.url}/phone/pair`, JSON.stringify({ mode: "app" }), APP);
    assert.equal(code.status, 200, code.text);
    const [, pairId, secret] = /#([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(code.json.url) as unknown as [string, string, string];
    const key = deviceKey(fromB64url(secret, 32)!, pairId);
    const paired = await request("POST", `${address}/device/pair`, JSON.stringify({ pairId, proof: pairProof(key, pairId), name: "Telefon Lhotáků".normalize("NFD"), kind: "phone" }), { Origin: address, "Content-Type": "application/json" });
    assert.equal(paired.status, 200, paired.text);
    const said = openPair(key, pairId, paired.json)!;
    const tree = (said.trees[0] as { id: string }).id;
    const me: Device = { id: said.device.id, key };

    const x = async (dev: Device, r: Omit<DeviceRequest, "tree"> & { tree?: string }, o: { envelope?: RequestEnvelope; change?: (e: RequestEnvelope) => RequestEnvelope; headers?: Record<string, string> } = {}): Promise<Tunnel> => {
      const envelope = o.envelope ?? sealRequest(dev.key, dev.id, Date.now(), { tree, ...r });
      const sent = o.change ? o.change(envelope) : envelope;
      const got = await request("POST", `${address}/device/x`, JSON.stringify(sent), { Origin: address, "Content-Type": "application/json", ...o.headers });
      if (got.status !== 200) return got;
      const inner = openResponse(dev.key, dev.id, envelope.n, got.json);
      assert.ok(inner, "the answer opens with K");
      const body = responseBody(inner);
      let data: any;
      try {
        data = body ? JSON.parse(body.toString("utf8")) : undefined;
      } catch {
        data = undefined;
      }
      return { ...got, s: inner.s, h: inner.h, data };
    };
    const act = (p: string, b?: unknown, more: Partial<DeviceRequest> = {}) => x(me, { m: "POST", p, ...(b !== undefined ? { b } : {}), ...more });
    const root = w.treeDir("Lhotákovi");
    const head = () => spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
    const viaOps = (since: number) => {
      const out: { op: string; via?: { id: string; name?: string } }[] = [];
      const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const f = path.join(d, e.name);
          if (e.isDirectory()) walk(f);
          else if (e.name.endsWith(".jsonl")) for (const l of fs.readFileSync(f, "utf8").split("\n").filter(Boolean)) out.push(JSON.parse(l));
        }
      };
      walk(path.join(root, "data", "ops"));
      return out.filter((o) => Date.parse((o as unknown as { at: string }).at) >= since);
    };
    const ME = { id: me.id, name: "Telefon Lhotáků" };

    // /status: what the device may do there
    assert.deepEqual((await x(me, { m: "GET", p: "status" })).data.device.actions.slice(-6), ["conflict.decide", "hypothesis.decide", "sync.undo", "media.put", "agent.start", "agent.bridge"]);

    // a send of the device: whatever device it names in its file or a header, the device it is (its row's name)
    const gedText = await (async () => {
      const envelope = sealRequest(me.key, me.id, Date.now(), { tree, m: "GET", p: "tree.ged" });
      const got = await request("POST", `${address}/device/x`, JSON.stringify(envelope), { Origin: address, "Content-Type": "application/json" });
      return responseBody(openResponse(me.key, me.id, envelope.n, got.json)!)!.toString("utf8");
    })();
    let edited = gedText.replace("2 DATE 3 MAR 1885", "2 DATE 4 MAR 1885");
    edited = edited.replace(/(1 BIRT\r?\n(?:[2-9].*\r?\n)*?2 PLAC )Lhota(\r?\n)/, "$1Horní Lhota$2");
    edited = edited.replace(/^(1 _STROM_HEAD .*\r?\n)/m, "$11 _STROM_SENT s1\n1 _STROM_CLIENT dev-cizi\n2 NAME Cizí prohlížeč\n");
    assert.notEqual(edited, gedText);
    const before = Date.now() - 1000;
    const sent = await act("sync", edited, { h: { "Content-Type": "text/plain;charset=UTF-8", "X-Strom-App-Version": VERSION, "X-Strom-Device": "dv_bbbbbbbbbbbbbbbb" } });
    assert.equal(sent.s, 200, JSON.stringify(sent.data));
    const input = sent.data.input as string;
    assert.match(input, /^I\d+$/, JSON.stringify(sent.data));
    const conflict = (await w.ok(["conflict", "list", "--json"])).json.conflicts.find((c: { state: string }) => c.state === "open")?.id as string;
    assert.match(conflict, /^X\d+$/);
    const sendOps = viaOps(before);
    assert.ok(sendOps.length > 0);
    for (const o of sendOps) assert.deepEqual(o.via, ME, o.op);

    // the bridge itself never decides for a device (its allowlist as before)
    for (const [p, b] of [[`conflict/${conflict}`, { take: "user" }], [`sync/${input}/undo`, {}], ["hypotheses/H0001", { decide: "A" }]] as const) {
      const r = await act(p, b);
      assert.deepEqual([r.s, r.data.code], [403, "device.computer-only"], p);
    }

    // refused before anything: a record by another shape, a part not taken, a body not taken, only on the computer
    const t0 = head();
    const refusals: [string, unknown, number, string][] = [
      ["device/conflict/S0001", { take: "user" }, 400, "device.id"],
      ["device/conflict/X1x", { take: "user" }, 400, "device.id"],
      [`device/conflict/${conflict}/again`, { take: "user" }, 404, "device.unknown-action"],
      ["device/conflict", { take: "user" }, 404, "device.unknown-action"],
      [`device/conflict/${conflict}`, { take: "agent" }, 400, "device.body"],
      [`device/conflict/${conflict}`, [1, 2], 400, "device.body"],
      [`device/conflict/${conflict}`, { take: "user", reasoning: "a\u0007b" }, 400, "device.body"],
      [`device/conflict/${conflict}`, { take: "user", reasoning: "é".repeat(501) }, 400, "device.body"],
      [`device/conflict/${conflict}`, { take: "user", reasoning: 7 }, 400, "device.body"],
      [`device/conflict/${conflict}`, { take: "user", reasoning: "x".repeat(4100) }, 400, "device.body"],
      [`device/conflict/${conflict}`, { take: "user", leave: true }, 403, "device.computer-only"],
      [`device/conflict/${conflict}`, { resolution: "1885" }, 403, "device.computer-only"],
      ["device/hypothesis/H0001", { reopen: true }, 403, "device.computer-only"],
      ["device/hypothesis/H0001", { variant: "C", newVariant: "C: syn Josefa" }, 403, "device.computer-only"],
      ["device/hypothesis/H0001", { support: "S0001" }, 403, "device.computer-only"],
      ["device/hypothesis/H0001", { objection: "ne" }, 403, "device.computer-only"],
      ["device/hypothesis/H0001", {}, 400, "device.body"],
      ["device/hypothesis/H0001", { proposed: true, variant: "A" }, 400, "device.body"],
      ["device/hypothesis/H0001", { keepOpen: "yes" }, 400, "device.body"],
      [`device/sync/${input}`, {}, 404, "device.unknown-action"],
      [`device/sync/${input}/redo`, {}, 404, "device.unknown-action"],
      [`device/sync/${input}/undo`, { dry: "yes" }, 400, "device.body"],
      [`device/sync/${input}/undo`, { all: true }, 403, "device.computer-only"],
      ["device/sync/I0099/undo", {}, 404, "sync.not-sync"],
      ["device/conflict/X0099", { take: "user" }, 404, "record.none"],
      ["device/hypothesis/H0099", { variant: "A" }, 404, "record.none"],
      ["device/hypothesis/H0001", { variant: "Z" }, 400, "hypothesis.no-variant"],
      ["device/hypothesis/H0001", { proposed: true }, 400, "hypothesis.no-proposal"],
    ];
    for (const [p, b, s, c] of refusals) {
      const r = await act(p, b);
      assert.deepEqual([r.s, r.data?.code], [s, c], `${p} ${JSON.stringify(b).slice(0, 80)}: ${JSON.stringify(r.data)}`);
    }
    // a body that is no JSON; GET; a research not known
    const raw = await x(me, { m: "POST", p: `device/conflict/${conflict}`, b64: Buffer.from("{take").toString("base64url") });
    assert.deepEqual([raw.s, raw.data.code], [400, "device.body"]);
    assert.deepEqual([(await x(me, { m: "GET", p: `device/conflict/${conflict}` })).data.code], ["device.unknown-action"]);
    const nowhere = await act(`device/conflict/${conflict}`, { take: "user" }, { tree: "nope" });
    assert.deepEqual([nowhere.s, nowhere.data.code], [404, "tree.unknown"]);
    assert.equal(head(), t0, "nothing written by a refusal");

    // the research held by another strom: busy, Retry-After, nothing written
    const lock = path.join(root, ".strom", "tree.lock");
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    const busy = await act(`device/conflict/${conflict}`, { take: "user" });
    fs.rmSync(lock);
    assert.deepEqual([busy.s, busy.data.code, Number(busy.h!["Retry-After"]) > 0], [503, "research.busy", true], JSON.stringify(busy));
    assert.equal(head(), t0);

    // refused outside, for each new path: not paired, a byte changed, sent again, another Host
    for (const p of [`device/conflict/${conflict}`, "device/hypothesis/H0001", `device/sync/${input}/undo`]) {
      const stranger = await x({ id: "dv_aaaaaaaaaaaaaaaa", key: crypto.randomBytes(32) }, { m: "POST", p, b: {} });
      assert.deepEqual([stranger.status, stranger.json.code], [401, "device.unpaired"], p);
      const changed = await x(me, { m: "POST", p, b: {} }, { change: (e) => ({ ...e, c: e.c.slice(0, 5) + (e.c[5] === "A" ? "B" : "A") + e.c.slice(6) }) });
      assert.deepEqual([changed.status, changed.json.code], [400, "device.bad"], p);
      const once = sealRequest(me.key, me.id, Date.now(), { tree, m: "POST", p, b: { bad: true } });
      assert.equal((await x(me, { m: "POST", p }, { envelope: once })).s, 403, p);
      const again = await x(me, { m: "POST", p }, { envelope: once });
      assert.deepEqual([again.status, again.json.code], [409, "device.clock"], p);
      const port = new URL(address).port;
      assert.equal((await x(me, { m: "POST", p, b: {} }, { headers: { Host: `evil.example:${port}` } })).status, 421, p);
    }
    assert.equal(head(), t0);

    // the conflict by side, no reasoning: the sentence of the device in the research's language; the app's decision
    const t1 = Date.now() - 1000;
    const decided = await act(`device/conflict/${conflict}`, { take: "user" });
    assert.equal(decided.s, 200, JSON.stringify(decided.data));
    assert.equal(decided.data.head, head());
    assert.equal(typeof decided.data.parent, "string");
    const c = (await w.ok(["conflict", "show", conflict, "--json"])).json.conflict;
    assert.deepEqual([c.state, c.taken, c.decidedBy, c.decidedIn, c.reasoning], ["resolved", "user", "user", "app", "rozhodnuto na zařízení Telefon Lhotáků"]);
    for (const o of viaOps(t1)) assert.deepEqual(o.via, ME, o.op);
    const gone = await act(`device/conflict/${conflict}`, { take: "research", reasoning: "Lhota – Лхота".normalize("NFD") });
    assert.deepEqual([gone.s, gone.data.code], [409, "conflict.gone"]);

    // hypotheses: a variant with its decision (NFC), none holds, the proposal not taken; decided again — gone
    const h1 = await act("device/hypothesis/H0001", { variant: "A", decision: "Křest uvádí otce Václava".normalize("NFD") });
    assert.equal(h1.s, 200, JSON.stringify(h1.data));
    assert.deepEqual([h1.data.hypothesis.state, h1.data.hypothesis.chosen, h1.data.hypothesis.decidedIn, h1.data.hypothesis.decision], ["decided", "A", "app", "Křest uvádí otce Václava"]);
    const h2 = await act("device/hypothesis/H0002", { abandon: true });
    assert.deepEqual([h2.s, h2.data.hypothesis.state, h2.data.hypothesis.decision], [200, "abandoned", "rozhodnuto na zařízení Telefon Lhotáků"]);
    const h3 = await act("device/hypothesis/H0003", { keepOpen: true });
    assert.deepEqual([h3.s, h3.data.hypothesis.state, typeof h3.data.hypothesis.leftOpen], [200, "open", "string"]);
    const twice = await act("device/hypothesis/H0001", { variant: "B" });
    assert.deepEqual([twice.s, twice.data.code], [409, "hypothesis.gone"]);
    const abandonedAgain = await act("device/hypothesis/H0002", { keepOpen: true });
    assert.deepEqual([abandonedAgain.s, abandonedAgain.data.code], [409, "hypothesis.gone"]);

    // the send taken back: its preview first (nothing written), then done; done already: said
    const t2 = head();
    const dry = await act(`device/sync/${input}/undo`, { dry: true });
    assert.equal(dry.s, 200, JSON.stringify(dry.data));
    assert.equal(head(), t2, "a preview writes nothing");
    assert.ok(dry.data.undone > 0);
    assert.deepEqual(
      dry.data.fields.filter((f: { field: string }) => f.field === "place").map((f: { what: string; from: string; to: string }) => [f.what, f.from, f.to]),
      [["Narození – Jan Lhoták (E0002)", "Horní Lhota", "Lhota"]],
      JSON.stringify(dry.data.fields),
    );
    const t3 = Date.now() - 1000;
    const undone = await act(`device/sync/${input}/undo`, {});
    assert.equal(undone.s, 200, JSON.stringify(undone.data));
    assert.notEqual(head(), t2);
    assert.deepEqual(undone.data.fields, dry.data.fields);
    for (const o of viaOps(t3)) assert.deepEqual(o.via, ME, o.op);
    const birth = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.find((e: { kind: string; retracted?: unknown }) => e.kind === "BIRT" && !e.retracted);
    assert.equal(birth.place, "Lhota");
    const twiceUndone = await act(`device/sync/${input}/undo`, {});
    assert.deepEqual([twiceUndone.s, twiceUndone.data.undone, typeof twiceUndone.data.undoneAt], [200, 0, "string"]);

    // the device in the history: the bridge's /log and strom history --json
    const log = await request("GET", `${bridge.url}/log`, undefined, APP);
    const logged = log.json.entries as { head: string; via?: { id: string } }[];
    assert.ok(Array.isArray(logged), log.text.slice(0, 300));
    const byDevice = logged.filter((e) => e.via?.id === me.id);
    assert.ok(byDevice.length >= 4, `the send, the conflict, the hypotheses, the undo: ${JSON.stringify(logged.map((e) => e.via))}`);
    const hist = (await w.ok(["history", "--json"])).json.commits as { hash: string; via?: { id: string; name?: string } }[];
    assert.deepEqual(hist.filter((c) => c.via).map((c) => c.via), byDevice.map(() => ME));
    assert.deepEqual(hist.filter((c) => c.via).map((c) => c.hash), byDevice.map((e) => e.head));

    // devices.mode off: the new paths not there
    await w.ok(["config", "set", "devices.mode", "off"]);
    for (const p of [`device/conflict/${conflict}`, "device/hypothesis/H0003", `device/sync/${input}/undo`]) {
      const off = await act(p, {});
      assert.deepEqual([off.status, off.json.code], [404, "device.disabled"], p);
    }

    await w.ok(["phone", "off"]);
    await w.ok(["live", "stop"]);
  } finally {
    w.cleanup();
    await app.close();
  }
});

test("the device on an operation only for the app's write of the person: never an agent's, never outside the app, never an id of no device", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const id = "dv_abcdefghijklmnop";
    const device = { STROM_VIA_DEVICE: id, STROM_VIA_DEVICE_NAME: "Telefon Lhotáků".normalize("NFD") };
    const last = () => {
      const files: string[] = [];
      const walk = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".jsonl") && files.push(path.join(d, e.name));
      };
      walk(path.join(w.treeDir("Lhotákovi"), "data", "ops"));
      const ops = files.flatMap((f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { at: string; by: string; via?: unknown }));
      return ops.sort((a, b) => a.at.localeCompare(b.at)).at(-1)!;
    };
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"], { env: { ...device, STROM_FOR_APP: "1" } });
    assert.deepEqual([last().by, last().via], ["user", { id, name: "Telefon Lhotáků" }]);
    for (const env of [device, { ...device, STROM_FOR_APP: "1", CLAUDECODE: "1" }, { ...device, STROM_FOR_APP: "1", STROM_VIA_DEVICE: "dev-A" }]) {
      await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F"], { env });
      assert.equal(last().via, undefined, JSON.stringify(env));
    }
  } finally {
    w.cleanup();
  }
});
