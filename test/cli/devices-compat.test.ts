// The gateway of the devices of the home network goes on with every newer strom (spec 094): the state a strom wrote
// (test/fixtures/devices, made by make-devices.ts with that strom's own code — devices.mode on, a device paired, the
// icon of its home screen in its row, the phone's server's settings, an operation the device wrote) is read by the strom
// of today: the bridge lists the devices, the device's key from the fixture opens the tunnel (a request sealed with
// fixed values, the phone's server on the loopback alone), strom history --json names the device, a new write of the
// device through the tunnel names it too, and no field the older strom wrote is lost.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile, until } from "../helpers.ts";
import { openResponse, responseBody, sealRequest, type DeviceRequest } from "../../src/core/devices.ts";
import { deviceTrees } from "../../src/core/device-gateway.ts";

const fixtures = path.join(import.meta.dirname, "..", "fixtures", "devices");
const hasTar = spawnSync("tar", ["--version"]).status === 0;
const skip = !hasGit || !hasTar || process.platform === "win32";
const VERSION = "3.99.0";
/** The device's name as the fixture's strom wrote it. */
const NAME = "Telefon Lhotáků";
/** The nonce of the sealed request: fixed, as a test vector's. */
const NONCE = Buffer.from("c3Ryb20tY29tcGF0", "base64url");

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

/** A stand-in of the app's site on the loopback (its copy for the devices under /run/): nothing from the internet. */
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

/** The world the fixture's strom left: its user's home and config, where they are now. */
function unpack(archive: string): World {
  const w = new World();
  const r = spawnSync("tar", ["-xzf", archive, "-C", w.dir]);
  assert.equal(r.status, 0, String(r.stderr));
  const home = path.join(w.dir, "home");
  Object.assign(w.env, { HOME: home, USERPROFILE: home, STROM_CONFIG_DIR: path.join(w.dir, "config") });
  const file = path.join(w.dir, "config", "config.json");
  fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), home: w.home }, null, 2));
  w.cwd = w.treeDir("Lhotákovi");
  return w;
}

type Row = Record<string, unknown> & { id: string; key: string; of?: string; name: string };

for (const archive of fs.existsSync(fixtures) ? fs.readdirSync(fixtures).filter((f) => f.endsWith(".tar.gz")).sort() : []) {
  const version = archive.replace(/\.tar\.gz$/, "");
  test(`the devices of strom ${version} go on with this one: listed, the tunnel opens with the key kept, the device named in the history, nothing written lost`, { skip, timeout: 240_000 }, async () => {
    const w = unpack(path.join(fixtures, archive));
    const app = await site();
    const config = w.env.STROM_CONFIG_DIR!;
    const read = (f: string) => readJsonFile(path.join(config, f)) as Record<string, any>;
    try {
      const rows = read("devices.json").devices as Row[];
      const phone = rows.find((d) => !d.of)!;
      const icon = rows.find((d) => d.of)!;
      assert.ok(phone && icon && icon.of === phone.id, JSON.stringify(rows.map((d) => [d.id, d.of])));
      const ME = { id: phone.id, name: NAME };
      const keptConfig = read("config.json");
      // the phone's server at a port free here, everything else of its settings as written
      const phoneWas = read("phone.json");
      fs.writeFileSync(path.join(config, "phone.json"), JSON.stringify({ ...phoneWas, port: await freePort() }));

      // the research reads as it was written; the device's operation named in its history
      assert.match((await w.ok(["check"])).out, /^ok — data souhlasí|(^|\n)0 chyb,/);
      const named = async () => ((await w.ok(["history", "--json"])).json.commits as { via?: unknown }[]).filter((c) => c.via).map((c) => c.via);
      assert.deepEqual(await named(), [ME]);

      // the bridge lists the devices (the icon in its device's row), never a key
      const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_DEVICE_APP_GATE: VERSION, STROM_DEVICE_LOCAL_NAME: "lhota-pc" };
      const APP = { Origin: app.origin, "X-Strom-App-Version": VERSION, "Content-Type": "text/plain;charset=UTF-8" };
      const bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
      assert.equal((await request("POST", `${bridge.url}/phone/on`, "{}", APP)).status, 200);
      let address = "";
      let shown: Answer | undefined;
      await until("the phone's server", async () => {
        shown = await request("GET", `${bridge.url}/phone`, undefined, APP);
        address = shown.json.addresses?.[0]?.url ?? "";
        return !!address;
      }, { ms: 20_000 });
      const list = shown!.json.devices?.list as { id: string; name: string; kind: string; home: boolean }[];
      assert.deepEqual(list.map((d) => [d.id, d.name, d.kind, d.home]), [[phone.id, NAME, "phone", true]], shown!.text);
      for (const d of rows) assert.ok(!shown!.text.includes(d.key), "no key said");

      // the tunnel opens with the key the fixture kept: a request sealed with fixed values
      const tree = deviceTrees(w.env).said[0]!.id;
      const key = Buffer.from(phone.key, "base64url");
      const x = async (r: Omit<DeviceRequest, "tree">, nonce?: Buffer) => {
        const envelope = sealRequest(key, phone.id, Date.now(), { tree, ...r }, nonce);
        const got = await request("POST", `${address}/device/x`, JSON.stringify(envelope), { Origin: address, "Content-Type": "application/json" });
        assert.equal(got.status, 200, got.text);
        const inner = openResponse(key, phone.id, envelope.n, got.json);
        assert.ok(inner, "the answer opens with the kept key");
        const body = responseBody(inner);
        return { s: inner.s, data: body ? JSON.parse(body.toString("utf8")) : undefined };
      };
      const status = await x({ m: "GET", p: "status" }, NONCE);
      assert.equal(status.s, 200);
      assert.deepEqual([status.data.device.id, status.data.device.name], [phone.id, NAME]);

      // a write of the device through the tunnel: named in the history as the older one is
      const sent = await x({ m: "POST", p: "waiting/T0002", b: { do: "sent" } });
      assert.equal(sent.s, 200, JSON.stringify(sent.data));
      assert.deepEqual(await named(), [ME, ME]);

      // nothing the older strom wrote lost: each row's fields (lastSeenAt the device seen now), the settings
      const now = read("devices.json").devices as Row[];
      for (const was of rows) {
        const is = now.find((d) => d.id === was.id);
        assert.ok(is, was.id);
        for (const [k, v] of Object.entries(was)) if (k !== "lastSeenAt") assert.deepEqual(is[k], v, `${was.id}.${k}`);
      }
      const configNow = read("config.json");
      // (where the research is: moved here; the version strom last ran as: today's)
      for (const [k, v] of Object.entries(keptConfig)) if (k !== "home" && k !== "lastVersion") assert.deepEqual(configNow[k], v, `config.${k}`);
      const phoneNow = read("phone.json");
      for (const k of Object.keys(phoneWas)) if (k !== "port" && k !== "on") assert.deepEqual(phoneNow[k], phoneWas[k], `phone.${k}`);
      assert.match((await w.ok(["check"])).out, /^ok — data souhlasí|(^|\n)0 chyb,/);

      await w.ok(["phone", "off"]);
      await w.ok(["live", "stop"]);
    } finally {
      w.cleanup();
      await app.close();
    }
  });
}
