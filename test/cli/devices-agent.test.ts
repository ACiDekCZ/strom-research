// The agent started from a device as the app on the computer starts it (spec 094 K3.15): POST device/agent {link, yes?}
// through the gateway (devices.mode on, the phone's server on the loopback alone — STROM_PHONE_TEST; the app for the
// devices from a stand-in of its site), the terminal's script written as it would be and nothing opened
// (STROM_TERMINAL_TEST=script, an isolated strom). The question the terminal would ask asked on the device (ask: a yes
// token, nothing written), the yes opening the terminal with it — once; run.confirm no started at once; a price in
// money and another question left to the terminal (computer); an archive only said. Refused: a device not paired, a
// link of another research or another scheme, what only the computer does. /status: device.agent, agent.start and
// agent.bridge. Made-up names only (Lhoták, Lhota); any script, NFD in.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, until } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { deviceKey, fromB64url, openPair, openResponse, pairProof, responseBody, sealRequest, type DeviceRequest } from "../../src/core/devices.ts";
import type { Session, Task } from "../../src/core/model.ts";

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
type Tunnel = Answer & { s?: number; data?: any };

test("device/agent through the gateway: asked on the device (a yes, nothing written), the terminal opened by the yes once; run.confirm no, a price, another question, an archive; every refusal", { skip, timeout: 300_000 }, async () => {
  const w = new World();
  const app = await site();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    const id = Tree.open(w.cwd, w.env).config.id;
    for (const t of (await w.ok(["task", "list", "--state", "all", "--json"])).json.tasks as { id: string }[]) await w.ok(["task", "drop", t.id, "--reason", "test"]);
    // a person born off the map (Cyrillic), a task of the queue in decomposed text
    await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1822", "--born-place", "Лгота"]);
    await w.ok(["task", "add", "Porovnat čtení křtu".normalize("NFD"), "--level", "verify", "--where", "matrika Lhota", "--why", "dvě čtení", "--done-when", "rozdíly rozhodnuté", "--about", "P1"]);
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json"), JSON.stringify({ on: false, port: await freePort() }));
    const env = { STROM_ISOLATED: "1", STROM_TERMINAL_TEST: "script", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_DEVICE_APP_GATE: VERSION, STROM_DEVICE_LOCAL_NAME: "lhota-pc" };
    const APP = { Origin: app.origin, "X-Strom-App-Version": VERSION, "Content-Type": "text/plain;charset=UTF-8" };
    const bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
    assert.equal((await request("POST", `${bridge.url}/phone/on`, "{}", APP)).status, 200);
    let address = "";
    await until("the phone's server", async () => {
      address = (await request("GET", `${bridge.url}/phone`, undefined, APP)).json.addresses?.[0]?.url ?? "";
      return !!address;
    }, { ms: 20_000 });

    // paired as the app pairs, its name decomposed
    const code = await request("POST", `${bridge.url}/phone/pair`, JSON.stringify({ mode: "app" }), APP);
    assert.equal(code.status, 200, code.text);
    const [, pairId, secret] = /#([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(code.json.url) as unknown as [string, string, string];
    const key = deviceKey(fromB64url(secret, 32)!, pairId);
    const paired = await request("POST", `${address}/device/pair`, JSON.stringify({ pairId, proof: pairProof(key, pairId), name: "Telefon Lhotáků".normalize("NFD"), kind: "phone" }), { Origin: address, "Content-Type": "application/json" });
    assert.equal(paired.status, 200, paired.text);
    const said = openPair(key, pairId, paired.json)!;
    const tree = (said.trees[0] as { id: string }).id;
    const me: Device = { id: said.device.id, key };

    const x = async (dev: Device, r: Omit<DeviceRequest, "tree">): Promise<Tunnel> => {
      const envelope = sealRequest(dev.key, dev.id, Date.now(), { tree, ...r });
      const got = await request("POST", `${address}/device/x`, JSON.stringify(envelope), { Origin: address, "Content-Type": "application/json" });
      if (got.status !== 200) return got;
      const inner = openResponse(dev.key, dev.id, envelope.n, got.json);
      assert.ok(inner, "the answer opens with K");
      const body = responseBody(inner);
      return { ...got, s: inner.s, data: body ? JSON.parse(body.toString("utf8")) : undefined };
    };
    const agent = (b: unknown) => x(me, { m: "POST", p: "device/agent", b });
    const root = w.treeDir("Lhotákovi");
    const head = () => spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
    const openDir = path.join(root, ".strom", "open");
    const scripts = () => (fs.existsSync(openDir) ? fs.readdirSync(openDir).map((f) => fs.readFileSync(path.join(openDir, f), "utf8")) : []);
    // the window a moment ago would make the next one "recent": each step its own
    const clear = () => fs.rmSync(openDir, { recursive: true, force: true });
    const link = (what: string) => `strom-research://${what}${what.includes("?") ? "&" : "?"}tree=${id}`;

    // /status of the device: the feature and what it may do
    const status = await x(me, { m: "GET", p: "status" });
    assert.ok((status.data.features as string[]).includes("device.agent"), JSON.stringify(status.data.features));
    assert.deepEqual((status.data.device.actions as string[]).slice(-2), ["agent.start", "agent.bridge"]);

    // refused before anything: not paired, a link of another research, of another scheme, not a link, a body of more,
    // what only the computer does — nothing written, nothing opened
    const t0 = head();
    const stranger = await x({ id: "dv_aaaaaaaaaaaaaaaa", key: crypto.randomBytes(32) }, { m: "POST", p: "device/agent", b: { link: link("work?do=tasks&n=1") } });
    assert.deepEqual([stranger.status, stranger.json.code], [401, "device.unpaired"]);
    const refusals: [unknown, number, string, string?][] = [
      [{ link: "strom-research://work?tree=t_00000000000000000000&do=tasks&n=1" }, 400, "device.link"],
      [{ link: link("work?do=tasks&n=1").replace("strom-research:", "https:") }, 400, "device.link"],
      [{ link: "Lhota – Лхота".normalize("NFD") }, 400, "device.link"],
      [{ link: `${link("work?do=tasks&n=1")}&x=${"é".repeat(2048)}` }, 400, "device.body"],
      [{ link: link("work?do=tasks&n=1"), run: true }, 400, "device.body"],
      [{ link: link("open") }, 403, "device.computer-only", "link.open"],
      [{ link: link("send") }, 403, "device.computer-only", "link.send"],
      [{ link: link("task?task=T0001&do=sent") }, 403, "device.computer-only", "link.task"],
    ];
    for (const [b, s, c, action] of refusals) {
      const r = await agent(b);
      assert.deepEqual([r.s, r.data?.code], [s, c], JSON.stringify([b, r.data]).slice(0, 300));
      if (action) assert.equal(r.data.action, action);
      if (s !== 400 || c !== "device.body") assert.equal(typeof r.data.text, "string", JSON.stringify(r.data));
    }
    assert.equal(head(), t0);
    assert.deepEqual(scripts(), []);

    // asked on the device: what the terminal would ask, in the research's language — nothing written, nothing opened
    const asked = await agent({ link: link("work?do=tasks&n=2") });
    assert.equal(asked.s, 200, JSON.stringify(asked.data));
    assert.equal(asked.data.state, "ask", JSON.stringify(asked.data));
    assert.equal(asked.data.ask.tree, "Lhotákovi");
    assert.match(asked.data.ask.what, /\p{L}/u);
    assert.ok((asked.data.ask.note as string[]).some((l) => l.includes("Porovnat čtení křtu")), JSON.stringify(asked.data.ask.note));
    assert.ok(!JSON.stringify(asked.data.ask).includes(root), "no folder of the computer");
    assert.match(asked.data.yes, /^[A-Za-z0-9_-]{22}$/u);
    assert.ok(Date.parse(asked.data.expiresAt) > Date.now());
    assert.equal(head(), t0, "nothing written by the preview");
    assert.deepEqual(scripts(), [], "nothing opened by the preview");

    // the yes: the terminal opened with it, the device named (from its pairing); once only
    const since = Date.now() - 1000;
    const yes = await agent({ link: link("work?do=tasks&n=2"), yes: asked.data.yes });
    assert.deepEqual([yes.s, yes.data], [200, { state: "started" }]);
    const [script] = scripts();
    assert.ok(script, "the terminal's script");
    assert.match(script!, new RegExp(`STROM_DEVICE_YES='${asked.data.yes}'`, "u"));
    assert.match(script!, new RegExp(`STROM_FROM_DEVICE='${me.id}'`, "u"));
    assert.match(script!, /STROM_FROM_DEVICE_NAME='Telefon Lhotáků'/u);
    assert.match(script!, /'link' 'open' 'strom-research:\/\/work\?/u);
    assert.doesNotMatch(script!, /STROM_FOR_APP|STROM_VIA_DEVICE/u);
    const log = fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.log"), "utf8");
    assert.ok(log.split("\n").some((l) => Date.parse(l.split(" ")[0]!) >= since && l.endsWith(`agent started by the device ${me.id} (work)`)), log.slice(-600));
    const twice = await agent({ link: link("work?do=tasks&n=2"), yes: asked.data.yes });
    assert.deepEqual([twice.s, twice.data.code], [410, "agent.yes-expired"]);
    // another link with that yes: not valid either
    const other = await agent({ link: link("work?do=tasks&n=3"), yes: asked.data.yes });
    assert.deepEqual([other.s, other.data.code], [410, "agent.yes-expired"]);
    clear();
    assert.equal(head(), t0);

    // run.confirm no: started at once, as on the computer — no yes
    await w.ok(["config", "set", "run.confirm", "no"], { tty: true, answers: ["a"] });
    const unasked = await agent({ link: link("work?do=tasks&n=1") });
    assert.deepEqual([unasked.s, unasked.data], [200, { state: "started" }]);
    assert.equal(scripts().length, 1);
    assert.doesNotMatch(scripts()[0]!, /STROM_DEVICE_YES/u);
    clear();
    await w.ok(["config", "unset", "run.confirm"]);

    // another question first (automatic work with no gate of the person's): the terminal keeps it, opened now
    const loop = await agent({ link: link("work?do=loop") });
    assert.deepEqual([loop.s, loop.data], [200, { state: "computer", why: "question" }]);
    assert.equal(scripts().length, 1);
    clear();

    // a price in money (sessions measured here): always asked in the terminal, opened now
    await w.ok(["place", "queue", "--all"]);
    const task = Tree.open(root, w.env).list<Task>("task").find((t) => t.origin === "places:identify")!;
    assert.ok(task, "the task of the places' queue");
    for (let i = 0; i < 3; i++) {
      await w.ok(["session", "start", task.id]);
      await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
    }
    const t = Tree.open(root, w.env);
    t.withTreeLock(() => {
      t.list<Session>("session").forEach((s, i) => t.put({ ...s, metrics: { ...s.metrics, costUsd: [0.4, 0.6, 0.8][i] } }, { op: "session.update", targets: [s.id], summary: `${s.id} measured` }));
      t.commit("Sessions measured");
    });
    const t1 = head();
    const priced = await agent({ link: link("places?do=run") });
    assert.deepEqual([priced.s, priced.data], [200, { state: "computer", why: "price" }]);
    assert.equal(scripts().length, 1);
    assert.equal(head(), t1, "nothing queued by the preview");
    clear();

    // an archive: only said, nothing opened; /status without the feature, agent.start not offered
    await w.ok(["mode", "archive"], { tty: true });
    const archived = await agent({ link: link("work?do=tasks&n=1") });
    assert.equal(archived.s, 200);
    assert.deepEqual([archived.data.state, archived.data.refused], ["said", "archive"], JSON.stringify(archived.data));
    assert.ok(archived.data.text.length > 0);
    assert.deepEqual(scripts(), []);
    const archive = await x(me, { m: "GET", p: "status" });
    assert.ok(!(archive.data.features as string[]).includes("device.agent"));
    assert.ok(!(archive.data.device.actions as string[]).includes("agent.start"));

    await w.ok(["phone", "off"]);
    await w.ok(["live", "stop"]);
  } finally {
    w.cleanup();
    await app.close();
  }
});
