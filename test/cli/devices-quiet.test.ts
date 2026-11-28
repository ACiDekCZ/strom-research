// The gateway of other devices (devices.mode, spec 094 K3.11, public from 28. 11.): on by default — help, the menu and
// the window that turns the phone's connection on offer a phone, a tablet or another computer, the bridge says its
// features. Off — the person's, stored as off and kept (never taken for the default) — nothing of it is offered anywhere
// a person or an agent reads (help, the catalog of commands, the guide, doctor, the orientation); the settings name the
// setting alone. Turned off by anyone; on again (set on, or unset back to the default) by the person alone in their own
// terminal: an agent is refused without a window (not even a dialog says it is there).

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
/** What offers a device (beside the phone): its words, a tablet, the features and paths of the gateway. */
const OFFER = /device\.(gateway|rename|events|phonePage)|\/device\/|(?<!\p{L})(připojit zařízení|connect a device|gerät verbinden|połącz urządzenie|tablet\p{L}*)(?!\p{L})/iu;
/** The texts of the catalogs said only where the gateway is on (each with its own key: never said while it is off). */
const DEVICE_KEYS = new Set([
  "ui.help.devices.phone",
  "ui.help.devices.phone.qr",
  "ui.phone.qr.devices",
  "ui.phone.qr.app.devices",
  "ui.error.phone.off.devices.hint",
  "ui.error.phone.qr-terminal.devices.hint",
  "ui.settings.phone.devices",
  "ui.settings.phone.devices.on",
  "ui.phone.menu.connect",
  "ui.phone.window.devices.title",
  "ui.phone.window.devices",
  "ui.phone.window.devices.noip",
  "ui.phone.on.devices",
  "ui.phone.starting.devices",
  "ui.phone.waiting.devices",
  "ui.phone.error.devices",
  "ui.phone.confirm.devices",
  "ui.phone.declined.devices",
  "ui.phone.off.devices",
  "ui.phone.phones.devices",
  "ui.phone.nophones.devices",
  "ui.phone.turnedoff.devices",
  "ui.phone.qr.off.devices",
  "ui.phone.notturned.devices",
  "ui.phone.menu.off.devices",
]);

const said = (text: string) => text.split("\n").filter((l) => QUIET.test(l));
const offered = (text: string) => text.split("\n").filter((l) => OFFER.test(l));

test("the look sees what it looks for", () => {
  assert.ok(QUIET.test(settingDef("devices.mode").key));
  assert.ok(QUIET.test(settingDef("devices.mode").description), "the setting's own description");
  assert.ok(QUIET.test("Připojit zařízení…"));
  assert.ok(QUIET.test("Connect a device"));
  assert.ok(QUIET.test("POST /device/pair"));
  assert.ok(!QUIET.test("the phone's page: Připojit telefon"));
  for (const t of ["Telefon, tablet nebo další počítač", "a phone, a tablet or another computer", "Połącz urządzenie", "Tablets"]) assert.ok(OFFER.test(t), t);
  assert.ok(!OFFER.test("Připojit telefon…"));
});

test("the catalogs of texts offer the devices only by the texts of their own keys, each in every language; the changelog of 1.38.0 tells of them in each", () => {
  const catalogs: [string, Record<string, string>][] = [
    ["en ui", UI as Record<string, string>],
    ["en phrases", PHRASES as Record<string, string>],
    ...fs.readdirSync(path.join(ROOT, "assets", "lang")).map((f): [string, Record<string, string>] => [f, JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "lang", f), "utf8"))]),
  ];
  for (const [name, catalog] of catalogs) {
    assert.deepEqual(Object.entries(catalog).filter(([k, text]) => typeof text === "string" && QUIET.test(text) && !DEVICE_KEYS.has(k)), [], name);
    if (name !== "en phrases") for (const k of DEVICE_KEYS) assert.ok(typeof catalog[k] === "string" && catalog[k]!.length > 10, `${name}: ${k}`);
  }
  for (const f of fs.readdirSync(ROOT).filter((f) => /^CHANGELOG(\.[a-z]{2})?\.md$/.test(f))) {
    const text = fs.readFileSync(path.join(ROOT, f), "utf8");
    const section = text.slice(text.indexOf("## 1.38.0"), text.indexOf("## 1.37.0"));
    assert.match(section, /tablet/iu, f);
    assert.match(section, /devices\.mode off/u, f);
    assert.doesNotMatch(section, /beta/iu, f);
  }
  for (const f of fs.readdirSync(ROOT).filter((f) => /^README(\.[a-z]{2})?\.md$/.test(f))) assert.deepEqual(said(fs.readFileSync(path.join(ROOT, f), "utf8")), [], f);
});

test("devices.mode not set (the default, 094 K3.11): on — the help of the phone offers a phone, a tablet or another computer, the settings say on (default)", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    assert.equal((JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8")) as Record<string, unknown>).devicesMode, undefined);
    assert.equal((await w.ok(["config", "get", "devices.mode"])).out.trim(), "on");
    const where = await w.ok(["config", "where", "--json"]);
    assert.deepEqual(
      where.json.settings.filter((s: { key: string }) => s.key === "devices.mode").map((s: { value: unknown; source: string }) => [s.value, s.source]),
      [["on", "default"]],
    );
    for (const args of [["help", "phone"], ["help", "phone", "qr"]]) {
      const r = await w.ok(args);
      assert.ok(offered(r.out).length > 0, `strom ${args.join(" ")}:\n${r.out}`);
      assert.match(r.out, /a phone, a tablet or another computer/u, args.join(" "));
    }
    assert.match((await w.ok(["help", "phone"])).out, /Research → Devices → Connect a device…/u);
    const human = await w.ok(["help", "phone", "--human"], { env: { STROM_LANG: "cs" } });
    assert.match(human.out, /telefon, tablet nebo další počítač/u, human.out);
    const qr = await w.ok(["help", "phone", "qr", "--human"], { env: { STROM_LANG: "cs" } });
    assert.match(qr.out, /QR kód k připojení zařízení – telefonu, tabletu nebo dalšího počítače/u, qr.out);
    // asked by an agent: refused, the way the app names it — Connect a device
    const agent = await w.run(["phone", "qr", "--json"], { env: { CLAUDECODE: "1" } });
    assert.match(agent.out + agent.err, /Research → Devices → Connect a device…/u);
  } finally {
    w.cleanup();
  }
});

test("devices.mode off (the person's, stored as off): help, the catalog of commands, the guide, doctor and the orientation offer nothing of it; the settings name the setting alone", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    await w.ok(["init", "Lhotákovi"]);
    w.cwd = w.treeDir("Lhotákovi");
    // turned off by an agent (anyone's): stored as off — never as nothing, which is on
    await w.ok(["config", "set", "devices.mode", "off"], { env: { CLAUDECODE: "1" } });
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8")).devicesMode, "off");
    const out: [string, string][] = [];
    for (const args of [[], ["help"], ["help", "--human"], ["help", "phone"], ["help", "phone", "qr"], ["help", "phone", "--human"], ["help", "phone", "qr", "--human"], ["help", "config"], ["commands", "--json"], ["guide"], ["doctor"], ["status"]]) {
      const r = await w.run(args, args[0] === "help" || args.includes("--help") ? { tty: true } : {});
      out.push([`strom ${args.join(" ")}`, r.out + r.err]);
    }
    const agent = await w.run(["phone", "qr", "--json"], { env: { CLAUDECODE: "1" } });
    out.push(["strom phone qr --json (an agent)", agent.out + agent.err]);
    // what the agents read: the tree's own files
    await w.ok(["agents", "sync"]);
    out.push(["AGENTS.md", fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8")]);
    for (const [label, text] of out) assert.ok(text.trim().length > 20, `${label}: said something`);
    for (const [label, text] of out) assert.deepEqual(offered(text), [], `${label}:\n${text}`);
    // the settings: the setting itself, off, from the config
    const where = await w.ok(["config", "where", "--json"]);
    assert.deepEqual(
      where.json.settings.filter((s: { key: string }) => s.key === "devices.mode").map((s: { value: unknown; source: string }) => [s.value, s.source]),
      [["off", "config"]],
    );
    assert.equal((await w.ok(["config", "get", "devices.mode"])).out.trim(), "off");
  } finally {
    w.cleanup();
  }
});

test("the menu's settings: the devices (a phone, a tablet, another computer) where the gateway is on, the default; the phone connection alone where it is off", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    // 8 settings · 1 the setup: its steps · 0 · 0 · 0
    const menu = async () => (await w.ok([], { tty: true, answers: ["8", "1", "0", "0", "0"], env: { STROM_LANG: "cs" } })).out;
    const on = await menu();
    assert.match(on, /\[\d\] {2}Zařízení {2,}vypnuto {2,}telefon, tablet nebo další počítač v domácí síti otevře výzkum v aplikaci Strom\n/u, on);
    assert.doesNotMatch(on, /Propojení s telefonem/u);
    w.devicesOff();
    const off = await menu();
    assert.match(off, /\[\d\] {2}Propojení s telefonem {2,}vypnuto/u, off);
    assert.deepEqual(offered(off), [], off);
  } finally {
    w.cleanup();
  }
});

test("strom phone's lines of its state and of a no (094 U21): of the devices — a phone, a tablet or another computer — where the gateway is on, the default; of the phone alone where it is off", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    const cs = { env: { STROM_LANG: "cs" } };
    const state = await w.ok(["phone"], cs);
    assert.match(state.out, /^propojení se zařízeními: vypnuto\n {2}žádné spárované zařízení \(telefon, tablet ani další počítač\)$/mu, state.out);
    assert.doesNotMatch(state.out, /telefonem|spárovaný telefon/u, state.out);
    const no = await w.ok(["phone", "on"], { tty: true, answers: [""], env: { STROM_LANG: "cs" } });
    assert.match(no.out, /Zapnout propojení se zařízeními\?/u, no.out);
    assert.match(no.out, /^propojení se zařízeními: nezapnuto, nic se nezměnilo$/mu, no.out);
    assert.doesNotMatch(no.out, /propojení s telefonem/u, no.out);
    assert.match((await w.ok(["phone", "off"], cs)).out, /^propojení se zařízeními je vypnuté; spárovaná zařízení zůstávají spárovaná\npropojení se zařízeními: vypnuto$/mu);
    for (const [lang, line] of [["en", "connection of devices: off"], ["de", "Verbindung mit Geräten: aus"], ["pl", "połączenie z urządzeniami: wyłączone"]] as const) {
      assert.match((await w.ok(["phone"], { env: { STROM_LANG: lang } })).out, new RegExp(`^${line}$`, "mu"), lang);
    }
    // off: the phone's lines as before, nothing of a device
    w.devicesOff();
    const was = await w.ok(["phone"], cs);
    assert.match(was.out, /^propojení s telefonem: vypnuto\n {2}žádný spárovaný telefon$/mu, was.out);
    const wasNo = await w.ok(["phone", "on"], { tty: true, answers: [""], env: { STROM_LANG: "cs" } });
    assert.match(wasNo.out, /^propojení s telefonem: nezapnuto, nic se nezměnilo$/mu, wasNo.out);
    const wasOff = await w.ok(["phone", "off"], cs);
    assert.match(wasOff.out, /^propojení s telefonem je vypnuté; spárované telefony zůstávají spárované\npropojení s telefonem: vypnuto$/mu, wasOff.out);
    for (const r of [was, wasNo, wasOff]) assert.doesNotMatch(r.out, /se zařízeními|spárovan\p{L}* zařízení|tablet/u, r.out);
  } finally {
    w.cleanup();
  }
});

test("the menu's Devices while on (094 U21): its title and its turning off say the devices, strom phone list lists them with the phones; off: the phone's as before", { skip: !hasGit || process.platform === "win32", timeout: 120_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const dir = w.env.STROM_CONFIG_DIR!;
    // a tablet paired by the app, with the icon of its home screen (one row); the connection on, its server on the loopback
    const key = Buffer.alloc(32, 7).toString("base64url");
    const at = "2026-11-20T10:00:00.000Z";
    const tablet = { id: "dv_abcdefghijklmnop", name: "Lhotův tablet", kind: "tablet", via: "app", pairedAt: at, lastSeenAt: null, address: "http://127.0.0.1:1", key };
    fs.writeFileSync(path.join(dir, "devices.json"), JSON.stringify({ devices: [tablet, { ...tablet, id: "dv_bcdefghijklmnopq", of: tablet.id }] }));
    fs.writeFileSync(path.join(dir, "phone.json"), JSON.stringify({ on: true, test: true, port: await freePort(), since: at }));
    const cs = { STROM_LANG: "cs" };
    // 8 settings · 1 the setup: its steps — Devices' number from them, then in, 0 back, 0, 0, 0
    const settings = (await w.ok([], { tty: true, answers: ["8", "1", "0", "0", "0"], env: cs })).out;
    const n = /\[(\d)\] {2}Zařízení {2,}/u.exec(settings)?.[1];
    assert.ok(n, settings);
    const devices = (await w.ok([], { tty: true, answers: ["8", "1", n, "0", "0", "0", "0"], env: cs })).out;
    assert.match(devices, /^ *propojení se zařízeními: zapnuto/mu, devices);
    assert.match(devices, /\[1\] {2}Vypnout propojení se zařízeními \(spárovaná zařízení zůstanou spárovaná\)/u, devices);
    assert.doesNotMatch(devices, /propojení s telefonem|spárované telefony/u, devices);
    // strom phone list: the tablet (its icon not a row of its own); the count said with the command
    const list = await w.ok(["phone", "list"], { env: cs });
    assert.match(list.out, /^dv_abcdefghijklmnop {2}Lhotův tablet {2}tablet {2}2026-11-20 /mu, list.out);
    assert.doesNotMatch(list.out, /dv_bcdefghijklmnopq/u, list.out);
    assert.deepEqual((await w.ok(["phone", "list", "--json"])).json.devices.map((d: { id: string; key?: string }) => [d.id, d.key]), [[tablet.id, undefined]]);
    assert.match((await w.ok(["phone"], { env: cs })).out, /^ {2}spárovaná zařízení: 1 \(strom phone list\)$/mu);
    // off: the phone's as before, no device listed
    w.devicesOff();
    const was = (await w.ok([], { tty: true, answers: ["8", "1", n, "0", "0", "0", "0"], env: cs })).out;
    assert.match(was, /^ *propojení s telefonem: zapnuto/mu, was);
    assert.match(was, /\[1\] {2}Vypnout propojení s telefonem \(spárované telefony zůstanou spárované\)/u, was);
    assert.doesNotMatch(was, /se zařízeními|spárovan\p{L}* zařízení/u, was);
    const wasList = await w.ok(["phone", "list", "--json"], { env: cs });
    assert.equal(wasList.json.devices, undefined);
    assert.match((await w.ok(["phone", "list"], { env: cs })).out, /^ {2}žádný spárovaný telefon$/mu);
    await w.ok(["phone", "off"]);
  } finally {
    w.cleanup();
  }
});

test("devices.mode on again: only where it was off, by the person in their terminal — an agent is refused without a window (set on, unset), nothing written; off is anyone's", async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    const config = () => JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8")) as Record<string, unknown>;
    // not set (on): an agent setting on changes nothing and is not refused
    assert.equal((await w.run(["config", "set", "devices.mode", "on"], { env: { CLAUDECODE: "1" } })).code, 0);
    await w.ok(["config", "unset", "devices.mode"], { env: { CLAUDECODE: "1" } });
    assert.equal(config().devicesMode, undefined);
    // off: an agent may
    await w.ok(["config", "set", "devices.mode", "off"], { env: { CLAUDECODE: "1" } });
    assert.equal(config().devicesMode, "off");
    // an agent — its own terminal too, a window that would say yes at once: never shown (the yes would have written it);
    // set on or unset back to the default alike
    const agents: { args: string[]; env: Record<string, string>; dialog: boolean; tty?: boolean }[] = [
      { args: ["config", "set", "devices.mode", "on", "--json"], env: { CLAUDECODE: "1" }, dialog: true },
      { args: ["config", "set", "devices.mode", "on", "--json"], env: { CLAUDECODE: "1" }, dialog: true, tty: true },
      { args: ["config", "set", "devices.mode", "on", "--json"], env: { CODEX_SANDBOX: "seatbelt" }, dialog: true },
      { args: ["config", "unset", "devices.mode", "--json"], env: { CLAUDECODE: "1" }, dialog: true },
    ];
    for (const { args, ...opts } of agents) {
      const r = await w.run(args, opts);
      assert.equal(r.code, 4, r.out + r.err);
      assert.equal(r.json?.status, "needs-consent", r.out);
      assert.match(r.json.needs[0].question, /person's own choice.*own terminal/);
      assert.equal(r.json.needs[0].set, "strom config set devices.mode on");
      assert.doesNotMatch(r.err, /okn|window/i, "no window waited for");
      assert.equal(config().devicesMode, "off", "nothing written");
    }
    // nor without a terminal at all (a script: no window either)
    for (const args of [["config", "set", "devices.mode", "on"], ["config", "unset", "devices.mode"]]) {
      const script = await w.run(args, { dialog: true });
      assert.equal(script.code, 4, script.out + script.err);
      assert.equal(config().devicesMode, "off");
    }
    // the person in their own terminal: on, no question
    const on = await w.run(["config", "set", "devices.mode", "on"], { tty: true, dialog: false });
    assert.equal(on.code, 0, on.out + on.err);
    assert.equal(config().devicesMode, "on");
    // off again, unset back to the default by the person
    await w.ok(["config", "set", "devices.mode", "off"]);
    assert.equal(config().devicesMode, "off");
    await w.ok(["config", "unset", "devices.mode"], { tty: true });
    assert.equal(config().devicesMode, undefined);
    assert.equal((await w.ok(["config", "get", "devices.mode"])).out.trim(), "on");
    // turned off keeps what the devices left (nothing is removed by the setting)
    const kept = path.join(w.env.STROM_CONFIG_DIR!, "devices.json");
    fs.writeFileSync(kept, JSON.stringify({ devices: [] }));
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

test("devices.mode not set: the bridge says the features of the gateway; off: the bridge and the phone's server as before — no device.* feature, GET phone as it was, /device/* 404 device.disabled, / the phone's page, phone/pair and phone/devices/* unknown", { skip: !hasGit || process.platform === "win32", timeout: 180_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
    await w.ok(["event", "add", "P1", "BIRT", "--date", "ABT 1905", "--place", "Lhota"]);
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json"), JSON.stringify({ on: false, port: await freePort() }));
    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_DEVICE_LOCAL_NAME: "lhota-pc" };
    const bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
    const APP = { Origin: "https://stromapp.info", "Content-Type": "text/plain;charset=UTF-8" };
    // not set (the default): on — the bridge says the gateway's features, the app goes by them alone
    const before = (await request("GET", `${bridge.url}/status`)).json;
    assert.deepEqual(before.features.filter((f: string) => f.startsWith("device")), ["device.gateway", "device.rename", "device.events", "device.agent"]);
    // the person's off from here on
    w.devicesOff();
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
