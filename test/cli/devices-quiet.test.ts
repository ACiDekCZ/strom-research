// The gateway of other devices is tried behind a hidden setting (devices.mode, spec 094 K3.11): while it is off — the
// default — nothing of it is said anywhere a person or an agent reads (help, the catalog of commands, the guide, the
// settings, doctor, the orientation, the catalogs of texts, README, the changelog). It is turned on by the person alone
// in their own terminal: an agent is refused without a window (not even a dialog says it is there); off is anyone's,
// and nothing of it stays in the settings then.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { decodeQr, svgModules } from "../qr-decode.ts";
import { phonePage } from "../../src/core/phone.ts";
import { UI } from "../../src/cli/ui.ts";
import { PHRASES } from "../../src/core/phrases.ts";
import { settingDef } from "../../src/core/config.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
/** The setting, the features of the gateway, its paths and the words of its dialog (en, cs, de, pl). */
const QUIET = /devices\.mode|device\.(gateway|rename|events|phonePage)|\/device\/|device-(?:app|uploads)|(?<!\p{L})gateway(?!\p{L})|(?<!\p{L})(připojit zařízení|connect a device|gerät verbinden|połącz urządzenie)(?!\p{L})/iu;

const said = (text: string) => text.split("\n").filter((l) => QUIET.test(l));

test("the look sees what it looks for", () => {
  assert.ok(QUIET.test(settingDef("devices.mode").key));
  assert.ok(QUIET.test(settingDef("devices.mode").description), "the setting's own description");
  assert.ok(QUIET.test("Připojit zařízení…"));
  assert.ok(QUIET.test("Connect a device"));
  assert.ok(QUIET.test("POST /device/pair"));
  assert.ok(!QUIET.test("the phone's page: Připojit telefon"));
});

test("the catalogs of texts, README and the changelogs say nothing of the gateway", () => {
  const catalogs: [string, Record<string, string>][] = [
    ["en ui", UI as Record<string, string>],
    ["en phrases", PHRASES as Record<string, string>],
    ...fs.readdirSync(path.join(ROOT, "assets", "lang")).map((f): [string, Record<string, string>] => [f, JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "lang", f), "utf8"))]),
  ];
  for (const [name, catalog] of catalogs) assert.deepEqual(Object.entries(catalog).filter(([, text]) => typeof text === "string" && QUIET.test(text)), [], name);
  for (const f of fs.readdirSync(ROOT).filter((f) => /^(README|CHANGELOG)(\.[a-z]{2})?\.md$/.test(f))) assert.deepEqual(said(fs.readFileSync(path.join(ROOT, f), "utf8")), [], f);
});

test("devices.mode off (the default): help, the catalog of commands, the guide, the settings, doctor and the orientation say nothing of it", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    await w.ok(["init", "Lhotákovi"]);
    w.cwd = w.treeDir("Lhotákovi");
    const out: [string, string][] = [];
    for (const args of [[], ["help"], ["help", "--human"], ["help", "config"], ["help", "config", "set"], ["help", "config", "where"], ["config", "set", "--help"], ["commands", "--json"], ["guide"], ["doctor"], ["status"], ["config", "where"], ["config", "where", "--json"], ["config", "set", "nic.neexistuje", "x"], ["config", "set", "nic.neexistuje", "x", "--json"], ["config", "get", "nic.neexistuje"]]) {
      const r = await w.run(args, args[0] === "help" || args.includes("--help") ? { tty: true } : {});
      out.push([`strom ${args.join(" ")}`, r.out + r.err]);
    }
    // what the agents read: the tree's own files
    await w.ok(["agents", "sync"]);
    out.push(["AGENTS.md", fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8")]);
    for (const [label, text] of out) assert.ok(text.trim().length > 20, `${label}: said something`);
    for (const [label, text] of out) assert.deepEqual(said(text), [], `${label}:\n${text}`);
    // the unknown key's hint lists the settings (the look above saw a list)
    assert.match(out.find(([l]) => l === "strom config set nic.neexistuje x")![1], /browser\.downloads/);
    // turned off by hand (anyone's): still nothing said, nothing stored
    await w.ok(["config", "set", "devices.mode", "off"]);
    const where = await w.ok(["config", "where", "--json"]);
    assert.deepEqual(said(where.out), [], where.out);
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8")).devicesMode, undefined);
  } finally {
    w.cleanup();
  }
});

test("devices.mode on: an agent is refused without a window, nothing written; a person in their terminal turns it on; off is anyone's", async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    const config = () => JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8")) as Record<string, unknown>;
    // an agent — its own terminal too, a window that would say yes at once: never shown (the yes would have written it)
    const agents: { env: Record<string, string>; dialog: boolean; tty?: boolean }[] = [{ env: { CLAUDECODE: "1" }, dialog: true }, { env: { CLAUDECODE: "1" }, dialog: true, tty: true }, { env: { CODEX_SANDBOX: "seatbelt" }, dialog: true }];
    for (const opts of agents) {
      const r = await w.run(["config", "set", "devices.mode", "on", "--json"], opts);
      assert.equal(r.code, 4, r.out + r.err);
      assert.equal(r.json?.status, "needs-consent", r.out);
      assert.match(r.json.needs[0].question, /person's own choice.*own terminal/);
      assert.equal(r.json.needs[0].set, "strom config set devices.mode on");
      assert.doesNotMatch(r.err, /okn|window/i, "no window waited for");
      assert.equal(config().devicesMode, undefined, "nothing written");
    }
    // nor without a terminal at all (a script: no window either)
    const script = await w.run(["config", "set", "devices.mode", "on"], { dialog: true });
    assert.equal(script.code, 4, script.out + script.err);
    assert.equal(config().devicesMode, undefined);
    // the person in their own terminal: on, no question (strom config where says it now — the one place)
    const on = await w.run(["config", "set", "devices.mode", "on"], { tty: true, dialog: false });
    assert.equal(on.code, 0, on.out + on.err);
    assert.equal(config().devicesMode, "on");
    const where = await w.ok(["config", "where", "--json"]);
    assert.deepEqual(
      where.json.settings.filter((s: { key: string }) => s.key === "devices.mode").map((s: { value: unknown; source: string }) => [s.value, s.source]),
      [["on", "config"]],
    );
    assert.equal((await w.ok(["config", "get", "devices.mode"])).out.trim(), "on");
    // an agent setting on what is on already changes nothing and is not refused
    assert.equal((await w.run(["config", "set", "devices.mode", "on"], { env: { CLAUDECODE: "1" } })).code, 0);
    // off: an agent may — stored as nothing, strom config where silent again
    await w.ok(["config", "set", "devices.mode", "off"], { env: { CLAUDECODE: "1" } });
    assert.equal(config().devicesMode, undefined);
    assert.deepEqual(said((await w.ok(["config", "where", "--json"])).out), []);
    // on again by the person, unset by an agent
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    await w.ok(["config", "unset", "devices.mode"], { env: { CLAUDECODE: "1" } });
    assert.equal(config().devicesMode, undefined);
    // turned off keeps what the devices left (nothing is removed by the setting)
    const kept = path.join(w.env.STROM_CONFIG_DIR!, "devices.json");
    fs.writeFileSync(kept, JSON.stringify({ devices: [] }));
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    await w.ok(["config", "set", "devices.mode", "off"]);
    assert.ok(fs.existsSync(kept));
  } finally {
    w.cleanup();
  }
});

/** A free port of the loopback for a test's phone's server (never the phone's own 47800). */
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

function request(method: string, url: string, body?: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string; json: Record<string, any>; headers: http.IncomingHttpHeaders }> {
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

/** The phone's page as it is made (its nonce aside). */
const isPhonePage = (text: string, lang: string) => {
  const nonce = /nonce="([^"]+)"/.exec(text)?.[1];
  return !!nonce && text.replaceAll(nonce, "N") === phonePage(lang, "N");
};

test("devices.mode off: the bridge and the phone's server as before — no device.* feature, GET phone as it was, /device/* 404 device.disabled, / the phone's page, phone/pair and phone/devices/* unknown", { skip: !hasGit || process.platform === "win32", timeout: 180_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
    await w.ok(["event", "add", "P1", "BIRT", "--date", "ABT 1905", "--place", "Lhota"]);
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json"), JSON.stringify({ on: false, port: await freePort() }));
    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_DEVICE_LOCAL_NAME: "lhota-pc" };
    const bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
    const APP = { Origin: "https://stromapp.info", "Content-Type": "text/plain;charset=UTF-8" };
    assert.equal((await request("POST", `${bridge.url}/phone/on`, "{}", APP)).status, 200);
    let address = "";
    await until("the phone's server", async () => {
      address = (await request("GET", `${bridge.url}/phone`)).json.addresses?.[0]?.url ?? "";
      return !!address;
    }, { ms: 20_000 });

    // the bridge: no feature of the gateway, GET phone of the same fields as before, none of its addresses
    const status = (await request("GET", `${bridge.url}/status`)).json;
    assert.ok(status.features.includes("phone"));
    assert.deepEqual(status.features.filter((f: string) => f.startsWith("device")), []);
    const phone = await request("GET", `${bridge.url}/phone`, undefined, { Origin: "https://stromapp.info" });
    assert.deepEqual(Object.keys(phone.json).sort(), ["addressChangedAt", "addresses", "error", "firewall", "lanSeenAt", "network", "pair", "phones", "platform", "since", "state"]);
    assert.deepEqual(said(phone.text), []);
    for (const [m, p] of [["POST", "phone/pair"], ["POST", "phone/devices/dv_aaaaaaaaaaaaaaaa/restore"], ["DELETE", "phone/devices/dv_aaaaaaaaaaaaaaaa"], ["PUT", "phone/devices/dv_aaaaaaaaaaaaaaaa"]] as const) {
      const r = await request(m, `${bridge.url}/${p}`, JSON.stringify({ mode: "app" }), APP);
      assert.equal(r.status, 404, `${m} ${p}: ${r.text}`);
      assert.ok(!/device/.test(r.json.code ?? ""), r.text);
    }
    const preflight = await request("OPTIONS", `${bridge.url}/phone/devices/x`, undefined, { Origin: "https://stromapp.info", "Access-Control-Request-Method": "DELETE" });
    assert.equal(preflight.headers["access-control-allow-methods"], "GET, POST, PUT");
    // the bridge's QR code: the phone's page's code as before (no code of the app, no m=)
    const qr = await request("GET", `${bridge.url}/phone/qr.svg?lang=en`, undefined, { Origin: "https://stromapp.info" });
    assert.equal(qr.status, 200);
    assert.match(decodeQr(svgModules(qr.text)).text, new RegExp(`^${address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/pair\\?lang=en#[A-Za-z0-9_-]{22}$`));
    assert.ok(fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "phone-pair.json")));
    for (const f of ["device-pair.json", "device-codes.json"]) assert.equal(fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, f)), false, `no code of a device made: ${f}`);
    // a send naming a device of the gateway (X-Strom-Device): the device the file names, as before
    const given = (await request("GET", `${bridge.url}/tree.ged`, undefined, { Origin: "https://stromapp.info" })).text;
    const edited = given.replace(/(1 BIRT\r?\n(?:[2-9].*\r?\n)*?2 PLAC )Lhota(\r?\n)/, "$1Horní Lhota$2").replace(/^(1 _STROM_HEAD .*\r?\n)/m, "$11 _STROM_SENT s1\n1 _STROM_CLIENT dev-A\n2 NAME Notebook\n");
    assert.notEqual(edited, given);
    const sent = await request("POST", `${bridge.url}/sync`, edited, { ...APP, "X-Strom-Device": "dv_aaaaaaaaaaaaaaaa" });
    assert.equal(sent.status, 200, sent.text);
    const log = (await request("GET", `${bridge.url}/log`, undefined, { Origin: "https://stromapp.info" })).json;
    const entries = log.entries as { via?: unknown }[];
    assert.deepEqual(entries.filter((e) => e.via).map((e) => e.via), [{ id: "dev-A", name: "Notebook" }], JSON.stringify(log).slice(0, 400));

    // the phone's server: /device/* 404 device.disabled, the rest the phone's page as before
    for (const [m, p] of [["GET", "/device/hello"], ["GET", "/device/events"], ["GET", `/device/events?d=dv_aaaaaaaaaaaaaaaa&t=${Date.now()}&n=AAAAAAAAAAAAAAAA&a=${"A".repeat(43)}&tree=x`], ["POST", "/device/pair"], ["POST", "/device/x"]] as const) {
      const r = await request(m, `${address}${p}`, m === "POST" ? "{}" : undefined, m === "POST" ? { Origin: address } : {});
      assert.deepEqual([r.status, r.json.code], [404, "device.disabled"], `${m} ${p}`);
    }
    // a large file of a device (PUT /device/media/<sha>) as a device sends one, its state through the tunnel: nothing
    // there, nothing made — no folder of parts
    const media = await request("PUT", `${address}/device/media/${"a".repeat(64)}`, "x".repeat(4112), {
      Origin: address,
      "Content-Type": "application/octet-stream",
      "X-Strom-Device": "dv_aaaaaaaaaaaaaaaa",
      "X-Strom-Time": String(Date.now()),
      "X-Strom-Nonce": "AAAAAAAAAAAAAAAA",
      "X-Strom-Tree": "x",
      "X-Strom-Size": "1",
      "X-Strom-From": "0",
    });
    assert.deepEqual([media.status, media.json.code], [404, "device.disabled"]);
    const state = await request("POST", `${address}/device/x`, JSON.stringify({ v: 1, d: "dv_aaaaaaaaaaaaaaaa", t: Date.now(), n: "AAAAAAAAAAAAAAAA", c: "AAAAAAAAAAAAAAAAAAAAAA" }), { Origin: address, "Content-Type": "application/json" });
    assert.deepEqual([state.status, state.json.code], [404, "device.disabled"]);
    for (const dir of [w.env.STROM_CONFIG_DIR!, w.env.STROM_SHARED ?? path.join(w.home, "shared"), w.home]) assert.equal(fs.existsSync(path.join(dir, "device-uploads")), false, dir);
    for (const p of ["/?lang=en", "/pair?m=app&lang=en", "/pair?m=page&lang=en"]) {
      const r = await request("GET", `${address}${p}`);
      assert.equal(r.status, 200, p);
      assert.ok(isPhonePage(r.text, "en"), p);
    }
    for (const p of ["/manifest.json", "/icons/icon-192.png"]) assert.equal((await request("GET", `${address}${p}`)).status, 404, p);
    // the computer's name is no address of the phone's server while off
    const port = new URL(address).port;
    for (const p of ["/", "/device/hello"]) assert.deepEqual([(await request("GET", `${address}${p}`, undefined, { Host: `lhota-pc.local:${port}` })).json.code], ["phone.host"], p);
    await w.ok(["phone", "off"]);
    await w.ok(["live", "stop"]);
  } finally {
    w.cleanup();
  }
});
