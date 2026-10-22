// The phone connection with real processes (its server on the loopback alone — STROM_PHONE_TEST, never the computer's
// network; a window stood for by a process that answers, never one of the system): turned on only by the person (a
// window, a terminal; an agent without either gets needs-input), turned off by anyone, the same state from every bridge
// of the computer, its server answering only by its own address and only the paths it knows.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { decodeQr, svgModules, terminalModules } from "../qr-decode.ts";
import { revivePhone, startPhone } from "../../src/core/phone.ts";

type Info = { pid: number; url: string };
type State = { state: string; addresses: { url: string; iface: string; kind: string | null }[]; phones: { id: string; name: string; stale: boolean }[]; error: { code: string } | null; since: string | null; platform: string; network: unknown; firewall: unknown; pair: unknown; lanSeenAt: string | null; addressChangedAt: string | null };

const APP = { Origin: "https://stromapp.info", "Content-Type": "text/plain;charset=UTF-8" };

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const run = (w: World) => JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone-run.json"), "utf8")) as { pid: number; ended?: { reason: string } };

async function phone(url: string): Promise<State> {
  const r = await fetch(`${url}/phone`);
  assert.equal(r.status, 200);
  return (await r.json()) as State;
}

async function post(url: string, what: string, body?: unknown, headers: Record<string, string> = APP) {
  const r = await fetch(`${url}/phone/${what}`, { method: "POST", headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, body: (await r.json()) as Record<string, any>, headers: r.headers };
}

/** A request to the phone's server with a Host of its own (fetch keeps the address's). */
function ask(url: string, p: string, host?: string): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.get({ host: u.hostname, port: u.port, path: p, agent: false, headers: host ? { Host: host } : {} }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (d: string) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
    });
    req.on("error", reject);
  });
}

const skip = !hasGit || process.platform === "win32";

test("strom phone on: the person alone — an agent without a terminal or a window gets needs-input; a no in the window changes nothing; a yes starts its server on the loopback, off ends it", { skip }, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    const off = await w.ok(["phone", "--json"]);
    assert.equal(off.json.state, "off");
    assert.deepEqual(off.json.phones, []);
    // no terminal, no window (STROM_NO_DIALOG): needs-input, nothing turned on
    const asked = await w.run(["phone", "on", "--json"], { env: { STROM_NONINTERACTIVE: "1" } });
    assert.equal(asked.code, 4, asked.out + asked.err);
    assert.equal(asked.json.status, "needs-consent");
    assert.equal(asked.json.needs[0].set, "strom phone on");
    // a no in the window
    const no = await w.run(["phone", "on", "--json"], { dialog: false });
    assert.notEqual(no.code, 0);
    assert.equal((await w.ok(["phone", "--json"])).json.state, "off");
    // the server refuses to run while off (an agent cannot start it round the consent)
    const serve = await w.run(["phone", "serve"], { env: { STROM_LANG: "en" } });
    assert.equal(serve.code, 1);
    assert.match(serve.err, /the phone connection is off/);
    // a yes in the window
    const on = await w.ok(["phone", "on", "--json"], { dialog: true });
    assert.equal(on.json.state, "on");
    assert.equal(on.json.addresses.length, 1);
    const url = on.json.addresses[0].url as string;
    assert.match(url, /^http:\/\/127\.0\.0\.1:478\d\d$/);
    const pid = run(w).pid;
    assert.ok(alive(pid));
    // only by its own address, only the paths it knows; nothing kept by a browser or sent on
    const who = await ask(url, "/whoami");
    assert.equal(who.status, 401);
    assert.equal(JSON.parse(who.body).code, "phone.unpaired");
    assert.equal(who.headers["cache-control"], "no-store");
    assert.equal(who.headers["referrer-policy"], "no-referrer");
    assert.equal(who.headers["x-frame-options"], "DENY");
    assert.equal((await ask(url, "/whoami", `evil.example:${new URL(url).port}`)).status, 421);
    assert.equal((await ask(url, "/whoami", "localhost")).status, 421);
    assert.equal((await ask(url, "/status")).status, 404);
    assert.equal((await ask(url, "/../config.json")).status, 404);
    // the phone reached the computer: said
    await until("the phone's visit written", () => (JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone-run.json"), "utf8")) as { lanSeenAt?: string }).lanSeenAt !== undefined, { ms: 10_000 });
    // turned off by anyone: its server ends, the settings say off
    const stopped = await w.ok(["phone", "off", "--json"]);
    assert.equal(stopped.json.state, "off");
    assert.equal(stopped.json.how, "stopped");
    await until("the server ended", () => !alive(pid), { ms: 10_000 });
    assert.ok(run(w).ended);
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json"), "utf8")).on, false);
    // its port free again (another test's phone server, run beside this one, may take it at once: what ended is its
    // process and its record above, not every answer of the port)
    await ask(url, "/whoami").then((r) => assert.notEqual(r.status, 200), () => undefined);
  } finally {
    w.cleanup();
  }
});

test("strom phone on in a terminal: the person's own yes, Enter says no (a terminal an agent opened turns nothing on, --yes neither); its errors in the person's language", { skip }, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    const cfg = path.join(w.env.STROM_CONFIG_DIR!, "phone.json");
    const isOn = () => fs.existsSync(cfg) && (JSON.parse(fs.readFileSync(cfg, "utf8")) as { on: boolean }).on;
    for (const answer of ["", "n", "ne"]) {
      const r = await w.ok(["phone", "on"], { tty: true, answers: [answer], env: { STROM_LANG: "cs" } });
      assert.match(r.out, /v místní síti 127\.0\.0\.1 přehled výzkumu[^\n]*\nZapnout propojení s telefonem\? \(a\/n\) \[n\]/);
      assert.match(r.out, /nezapnuto, nic se nezměnilo/);
      assert.equal(isOn(), false, `answered ${JSON.stringify(answer)}`);
    }
    // --yes answers no question of the person's: no terminal answer, no window here — needs-input
    const yes = await w.run(["phone", "on", "--yes"], { tty: true, answers: ["y"] });
    assert.equal(yes.code, 4, yes.out + yes.err);
    assert.equal(isOn(), false);
    // said in the person's language, never the agent's English
    const serve = await w.run(["phone", "serve"], { env: { STROM_LANG: "cs" } });
    assert.equal(serve.code, 1);
    assert.match(serve.err, /^chyba: propojení s telefonem je vypnuté\n→ zapíná se příkazem strom phone on v terminálu/);
    const qr = await w.run(["phone", "qr"], { env: { STROM_LANG: "de" } });
    assert.match(qr.err, /^Fehler: der QR-Code zum Koppeln/);
    // a yes: on, the QR code at once
    const on = await w.ok(["phone", "on"], { tty: true, answers: ["y"] });
    assert.equal(isOn(), true);
    assert.match(decodeQr(terminalModules(on.out.slice(on.out.indexOf("\x1b[30;107m")).split("\n\n")[0]!)).text, /^http:\/\/127\.0\.0\.1:\d+\/pair\?lang=\w+#[A-Za-z0-9_-]{22}$/);
    await w.ok(["phone", "off"]);
  } finally {
    w.cleanup();
  }
});

test("the bridges say the phone the same, and ask the person in a window they do not wait for: yes — on; off — the server ends; remove and restore", { skip }, async () => {
  const w = new World();
  try {
    await w.withTree("Novákovi");
    // the window's stand-in answers only in an isolated test
    const yes = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "400" };
    const a = (await w.ok(["live", "start", "--json"], { env: yes })).json as Info;
    await w.ok(["init", "Dvořákovi"]);
    w.cwd = w.treeDir("Dvořákovi");
    const b = (await w.ok(["live", "start", "--json"], { env: yes })).json as Info;
    // the app is told the bridge has it, and how it stands
    const status = (await (await fetch(`${a.url}/status`)).json()) as { features: string[]; phone: unknown };
    assert.ok(status.features.includes("phone"));
    assert.deepEqual(status.phone, { state: "off", phones: 0 });
    const first = await phone(a.url);
    assert.deepEqual(
      { state: first.state, addresses: first.addresses, phones: first.phones, error: first.error, since: first.since, pair: first.pair, lanSeenAt: first.lanSeenAt, addressChangedAt: first.addressChangedAt, platform: first.platform },
      { state: "off", addresses: [], phones: [], error: null, since: null, pair: null, lanSeenAt: null, addressChangedAt: null, platform: process.platform },
    );
    assert.ok("network" in first && "firewall" in first);
    // the code to pair while off; the headers the app reads
    const qr = await fetch(`${a.url}/phone/qr.svg`);
    assert.equal(qr.status, 409);
    assert.equal(((await qr.json()) as { code: string }).code, "phone.off");
    assert.equal(qr.headers.get("access-control-expose-headers"), "X-Strom-Pair-Expires, X-Strom-Pair-Url");
    // not from the app's pages: refused, nothing asked
    assert.equal((await post(a.url, "on", { lang: "cs" }, { "Content-Type": "text/plain" })).status, 403);
    // asked: a window up, not waited for
    const asked = await post(a.url, "on", { lang: "de" });
    assert.equal(asked.status, 200);
    assert.equal(asked.body.state, "confirm");
    assert.equal((await phone(b.url)).state, "confirm", "the other bridge says the same");
    // asked again while it waits: the same window
    assert.equal((await post(b.url, "on", {})).body.state, "confirm");
    await until("on after the yes", async () => (await phone(a.url)).state === "on" && (await phone(a.url)).addresses.length === 1, { ms: 20_000 });
    const on = await phone(a.url);
    assert.match(on.addresses[0]!.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(on.addresses[0]!.kind, null);
    assert.ok(on.since);
    const other = await phone(b.url);
    assert.deepEqual({ ...other, network: null, firewall: null }, { ...on, network: null, firewall: null }, "both bridges say the same");
    // turned on by a test: marked so, and off for a strom that is no test's (it would listen on the computer's network)
    const cfg0 = JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json"), "utf8")) as { on: boolean; test?: boolean };
    assert.deepEqual([cfg0.on, cfg0.test], [true, true]);
    assert.equal((await w.ok(["phone", "--json"], { env: { STROM_PHONE_TEST: "" } })).json.state, "off");
    assert.deepEqual(((await (await fetch(`${b.url}/status`)).json()) as { phone: unknown }).phone, { state: "on", phones: 0 });
    // the phones paired (pairing comes later: written here as it will be)
    const cfg = w.env.STROM_CONFIG_DIR!;
    fs.writeFileSync(
      path.join(cfg, "phones.json"),
      JSON.stringify({
        phones: [
          { id: "ph_aaaaaaaa", name: "Telefon Žofie", pairedAt: "2026-10-01T10:00:00.000Z", address: "http://192.168.9.9:47800" },
          { id: "ph_bbbbbbbb", name: "Telefon Žofie", pairedAt: "2026-10-02T10:00:00.000Z", address: on.addresses[0]!.url },
        ],
      }),
    );
    const listed = await phone(a.url);
    assert.deepEqual(listed.phones.map((p) => [p.id, p.stale]), [["ph_aaaaaaaa", true], ["ph_bbbbbbbb", false]]);
    assert.deepEqual((listed.phones[1] as unknown as { maybeReplaces: string[] }).maybeReplaces, ["ph_aaaaaaaa"]);
    // taken off, put back a moment after — by the bridge that took it (another: gone)
    assert.equal((await post(a.url, "remove/ph_nothere")).status, 404);
    assert.equal((await post(a.url, "remove/ph_nothere")).body.code, "phone.unknown");
    const removed = await post(a.url, "remove/ph_aaaaaaaa");
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.phones.map((p: { id: string }) => p.id), ["ph_bbbbbbbb"]);
    const gone = await post(b.url, "restore/ph_aaaaaaaa");
    assert.equal(gone.status, 404);
    assert.equal(gone.body.code, "phone.gone");
    const back = await post(a.url, "restore/ph_aaaaaaaa");
    assert.deepEqual(back.body.phones.map((p: { id: string }) => p.id), ["ph_aaaaaaaa", "ph_bbbbbbbb"]);
    // turned off from the other bridge: the server ends, the phones stay paired
    const pid = run(w).pid;
    const off = await post(b.url, "off");
    assert.equal(off.body.state, "off");
    await until("the server ended", () => !alive(pid), { ms: 10_000 });
    const after = await phone(a.url);
    assert.equal(after.state, "off");
    assert.equal(after.phones.length, 2);
    assert.match(fs.readFileSync(path.join(cfg, "phone.log"), "utf8"), /turned on: yes in the window[\s\S]*turned off \(the Strom app\)/);
  } finally {
    w.cleanup();
  }
});

test("a no in the window is said a minute (declined); a window that waits is closed when turned off; no window here: no-dialog", { skip }, async () => {
  const w = new World();
  try {
    await w.withTree("Novákovi");
    // no window can be shown (STROM_NO_DIALOG, no stand-in): said, nothing waits
    let info = (await w.ok(["live", "start", "--json"])).json as Info;
    // each answer its own research's bridge (one bridge stopped and started again keeps its port: a connection kept by
    // fetch would meet the new one)
    const next = async (name: string, env: Record<string, string>) => {
      await w.ok(["init", name]);
      w.cwd = w.treeDir(name);
      return (await w.ok(["live", "start", "--json"], { env })).json as Info;
    };
    const none = await post(info.url, "on", { lang: "cs" });
    assert.equal(none.body.state, "off");
    assert.equal(none.body.error.code, "no-dialog");
    // the window's stand-in answers only in an isolated test of the loopback or no network: else no window, nothing on
    for (const [name, env] of [
      ["Svobodovi", { STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "50" }],
      ["Пушкины", { STROM_ISOLATED: "1", STROM_PHONE_TEST: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "50" }],
    ] as const) {
      info = await next(name, env);
      const refused = await post(info.url, "on", { lang: "cs" });
      assert.equal(refused.body.error?.code, "no-dialog", name);
      assert.equal(fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json")), false, name);
    }
    // a no
    info = await next("Dvořákovi", { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "no", STROM_PHONE_TEST_ANSWER_MS: "200" });
    assert.equal((await post(info.url, "on", { lang: "cs" })).body.state, "confirm");
    await until("declined", async () => (await phone(info.url)).state === "declined", { ms: 15_000 });
    assert.deepEqual(((await (await fetch(`${info.url}/status`)).json()) as { phone: unknown }).phone, { state: "off", phones: 0 }, "a no reads as off for the menu");
    // a window nobody answers, turned off meanwhile: closed, off
    info = await next("Černí", { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "wait" });
    assert.equal((await post(info.url, "on", {})).body.state, "confirm");
    const dialog = (JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone-ask.json"), "utf8")) as { dialog: number }).dialog;
    assert.ok(alive(dialog));
    assert.equal((await post(info.url, "off")).body.state, "off");
    await until("the window closed", () => !alive(dialog), { ms: 10_000 });
    assert.equal((await phone(info.url)).state, "off");
    assert.equal(fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json")), false, "never on: nothing written");
    assert.equal(fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "phone-ask.json")), false);
  } finally {
    w.cleanup();
  }
});

test("pairing a phone: the QR code of the bridge (its headers, the address without the code) read back; the page takes the code once into a cookie of the key; whoami 401 for any other; taken off — 401, put back — paired", { skip }, async () => {
  const w = new World();
  try {
    await w.withTree("Novákovi");
    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200" };
    const b = (await w.ok(["live", "start", "--json"], { env })).json as Info;
    await post(b.url, "on", { lang: "cs" });
    await until("on", async () => (await phone(b.url)).addresses.length === 1, { ms: 20_000 });
    const address = (await phone(b.url)).addresses[0]!.url;
    // the code: never to an agent — strom phone qr only in the user's terminal
    const refused = await w.run(["phone", "qr", "--json"]);
    assert.notEqual(refused.code, 0);
    assert.equal(refused.json.code, "phone.qr-terminal");
    assert.equal((await w.run(["phone", "qr"])).code, 1);
    // the bridge's QR code, as the app asks it
    const qr = await fetch(`${b.url}/phone/qr.svg?lang=cs&address=${encodeURIComponent(address)}`, { headers: { Origin: "https://stromapp.info" } });
    assert.equal(qr.status, 200);
    assert.equal(qr.headers.get("content-type"), "image/svg+xml; charset=utf-8");
    assert.equal(qr.headers.get("cache-control"), "no-store");
    assert.equal(qr.headers.get("x-content-type-options"), "nosniff");
    assert.equal(qr.headers.get("access-control-allow-origin"), "https://stromapp.info");
    const expires = qr.headers.get("x-strom-pair-expires")!;
    const left = Date.parse(expires) - Date.now();
    assert.ok(left > 9 * 60_000 && left <= 10 * 60_000, expires);
    // the address the app shows under the code: never the code (the app's own check of it)
    const said = qr.headers.get("x-strom-pair-url")!;
    assert.equal(said, address);
    assert.match(said, /^http:\/\/[^\s#]+$/);
    const svg = await qr.text();
    const read = decodeQr(svgModules(svg)).text;
    const m = /^(http:\/\/[^/]+)\/pair\?lang=cs#([A-Za-z0-9_-]{22})$/.exec(read);
    assert.ok(m, read);
    assert.equal(m[1], address);
    const code = m[2]!;
    // shown again meanwhile, also in the terminal: the same code
    assert.equal(decodeQr(svgModules(await (await fetch(`${b.url}/phone/qr.svg`)).text())).text, `${address}/pair#${code}`);
    const shown = await w.ok(["phone", "qr"], { tty: true });
    assert.match(decodeQr(terminalModules(shown.out.split("\n\n")[0]!)).text, new RegExp(`^${address}/pair\\?lang=\\w+#${code}$`));
    assert.ok(shown.out.includes(address));
    assert.ok(!shown.out.includes(code), "the code is in the QR code alone");
    // strom phone on in the user's terminal: the QR code at once; to an agent: where it is shown
    const onHere = await w.ok(["phone", "on"], { tty: true });
    const qrAt = onHere.out.indexOf("\x1b[30;107m");
    assert.ok(qrAt > 0, onHere.out);
    assert.equal(decodeQr(terminalModules(onHere.out.slice(qrAt).split("\n\n")[0]!)).text.split("#")[1], code);
    const onAgent = await w.ok(["phone", "on"]);
    assert.ok(!onAgent.out.includes("\x1b[30;107m") && !onAgent.out.includes(code));
    assert.match(onAgent.out, /strom phone qr/);
    // an address that is not one of the server's (the app asks only those it was told): no code made for it
    for (const other of ["http://192.168.1.99:47800", `${address}/x`, "http://evil.example"]) {
      const r = await fetch(`${b.url}/phone/qr.svg?address=${encodeURIComponent(other)}`);
      assert.equal(r.status, 404, other);
      assert.equal(((await r.json()) as { code: string }).code, "phone.address");
    }
    assert.equal((await w.run(["phone", "qr", "--address", "http://192.168.1.99:47800"], { tty: true })).code, 1);
    // while it holds: said when, never the code
    const holding = await phone(b.url);
    assert.deepEqual(holding.pair, { expiresAt: expires });
    assert.ok(!JSON.stringify(holding).includes(code));
    assert.ok(!JSON.stringify((await w.ok(["phone", "--json"])).json).includes(code));
    assert.ok(!fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.log"), "utf8").includes(code));

    // the page: its script and style by a nonce alone, the language the code asks
    const page = await ask(address, "/pair?lang=cs");
    assert.equal(page.status, 200);
    assert.match(String(page.headers["content-type"]), /^text\/html; charset=utf-8/);
    const csp = String(page.headers["content-security-policy"]);
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
    assert.ok(nonce && page.body.includes(`<script nonce="${nonce}">`), csp);
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(page.body, /<html lang="cs">/);
    assert.match(page.body, /Spárováno/);
    assert.equal((await ask(address, "/", undefined)).status, 200);
    // not paired: 401
    assert.equal((await fetch(`${address}/whoami`)).status, 401);
    // from another page: refused, the code still holds
    const pairAt = (body: unknown, headers: Record<string, string> = {}) => fetch(`${address}/pair`, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", ...headers }, body: JSON.stringify(body) });
    assert.equal((await pairAt({ code }, { Origin: "http://evil.example" })).status, 403);
    assert.equal((await pairAt({ code: "x".repeat(22) })).status, 410);
    assert.equal((await pairAt({ code: "y".repeat(5000) })).status, 413);
    // paired: the key in a cookie the page's script cannot read, of this port alone, 400 days
    const ua = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
    const paired = await pairAt({ code, lang: "de" }, { Origin: address, "User-Agent": ua });
    assert.equal(paired.status, 200);
    const cookie = paired.headers.get("set-cookie")!;
    const port = new URL(address).port;
    const c = new RegExp(`^strom_phone_${port}=([A-Za-z0-9_-]{43}); Max-Age=34560000; Path=/; HttpOnly; SameSite=Strict$`).exec(cookie);
    assert.ok(c, cookie);
    const key = c[1]!;
    const me = (await paired.json()) as { id: string; name: string; lang: string };
    assert.deepEqual([me.name, me.lang], ["Android (Chrome)", "de"]);
    // once alone
    assert.equal((await pairAt({ code })).status, 410);
    assert.equal((await phone(b.url)).pair, null);
    const who = await fetch(`${address}/whoami`, { headers: { Cookie: `strom_phone_${port}=${key}` } });
    assert.equal(who.status, 200);
    assert.deepEqual(((await who.json()) as { id: string }).id, me.id);
    // another port's cookie, another key: not paired
    assert.equal((await fetch(`${address}/whoami`, { headers: { Cookie: `strom_phone_1${port}=${key}` } })).status, 401);
    assert.equal((await fetch(`${address}/whoami`, { headers: { Cookie: `strom_phone_${port}=${key.replace(/^./, (x) => (x === "A" ? "B" : "A"))}` } })).status, 401);
    // the phone's page in the language it paired with
    assert.match((await new Promise<string>((resolve) => http.get({ host: "127.0.0.1", port, path: "/", headers: { Cookie: `strom_phone_${port}=${key}` }, agent: false }, (r) => { let s = ""; r.on("data", (d) => (s += d)); r.on("end", () => resolve(s)); }))), /<html lang="de">/);
    // kept: the key's hash alone; the app's list says it, seen now, not stale
    const kept = fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phones.json"), "utf8");
    assert.ok(!kept.includes(key));
    const listed = (await phone(b.url)).phones as unknown as { id: string; name: string; stale: boolean; lastSeenAt: string; keyHash?: string }[];
    assert.deepEqual(listed.map((p) => [p.id, p.name, p.stale]), [[me.id, "Android (Chrome)", false]]);
    assert.ok(listed[0]!.lastSeenAt);
    assert.equal(listed[0]!.keyHash, undefined, "the hash stays on this computer");
    // taken off: 401; put back: paired again
    assert.equal((await post(b.url, `remove/${me.id}`)).status, 200);
    assert.equal((await fetch(`${address}/whoami`, { headers: { Cookie: `strom_phone_${port}=${key}` } })).status, 401);
    assert.equal((await post(b.url, `restore/${me.id}`)).status, 200);
    assert.equal((await fetch(`${address}/whoami`, { headers: { Cookie: `strom_phone_${port}=${key}` } })).status, 200);
    // a new code, then off: forgotten — a QR shown before pairs nothing
    const again = decodeQr(svgModules(await (await fetch(`${b.url}/phone/qr.svg`)).text())).text;
    assert.notEqual(again.split("#")[1], code);
    await post(b.url, "off");
    assert.equal(fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "phone-pair.json")), false);
    assert.equal((await fetch(`${b.url}/phone/qr.svg`)).status, 409);
    const off = await w.run(["phone", "qr"], { tty: true });
    assert.equal(off.code, 0);
    assert.match(off.out, /strom phone on/);
  } finally {
    w.cleanup();
  }
});

test("the computer started again: the phone's server gone is said as waiting, never a failure; the research started — its server back on its port, the paired phone gets through; turned off — never back", { skip }, async () => {
  const w = new World();
  try {
    await w.withTree("Novákovi");
    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200" };
    const b = (await w.ok(["live", "start", "--json"], { env })).json as Info;
    await post(b.url, "on", { lang: "cs" });
    await until("on", async () => (await phone(b.url)).addresses.length === 1, { ms: 20_000 });
    const address = (await phone(b.url)).addresses[0]!.url;
    const port = new URL(address).port;
    const code = decodeQr(svgModules(await (await fetch(`${b.url}/phone/qr.svg`)).text())).text.split("#")[1]!;
    const paired = await fetch(`${address}/pair`, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", Origin: address }, body: JSON.stringify({ code }) });
    assert.equal(paired.status, 200);
    const cookie = { Cookie: paired.headers.get("set-cookie")!.split(";")[0]! };
    assert.equal((await fetch(`${address}/whoami`, { headers: cookie })).status, 200);
    // the computer off: the bridge and the phone's server gone without a word; turned on a while ago
    const server = run(w).pid;
    process.kill(b.pid, "SIGKILL");
    // a second server started with the first (the window's yes and the bridge both) takes over the moment the first is
    // gone: killed too, until none runs for two seconds
    for (let quiet = 0; quiet < 10; await new Promise((r) => setTimeout(r, 200))) {
      const pid = run(w).pid;
      if (alive(pid)) {
        process.kill(pid, "SIGKILL");
        quiet = 0;
      } else quiet++;
    }
    assert.ok(!alive(b.pid) && !alive(server));
    const config = path.join(w.env.STROM_CONFIG_DIR!, "phone.json");
    fs.writeFileSync(config, JSON.stringify({ ...JSON.parse(fs.readFileSync(config, "utf8")), since: new Date(Date.now() - 60_000).toISOString() }));
    // before the research starts: on, waiting for it — never said as an error
    const waiting = await w.ok(["phone", "--json"]);
    assert.equal(waiting.json.state, "error");
    assert.equal(waiting.json.error.waiting, true);
    for (const [lang, said] of [["cs", /zapnuto, jeho server se znovu spustí se spuštěním výzkumu/], ["en", /on, its server starts again when the research starts/], ["de", /an, ihr Server startet wieder, sobald die Forschung startet/]] as const) {
      const out = (await w.ok(["phone"], { env: { STROM_LANG: lang } })).out;
      assert.match(out, said, out);
      assert.doesNotMatch(out, /nespustil|did not start|nicht gestartet/, out);
    }
    // the research started: its server back on the same port, the phone paired before gets through
    const b2 = (await w.ok(["live", "start", "--json"], { env })).json as Info;
    await until("back", async () => (await phone(b2.url)).addresses.length === 1, { ms: 20_000 });
    assert.equal((await phone(b2.url)).addresses[0]!.url, address);
    assert.notEqual(run(w).pid, server);
    assert.equal((await fetch(`${address}/whoami`, { headers: cookie })).status, 200);
    assert.equal((await phone(b2.url)).error, null);
    // turned off, the computer off again: the research started comes back without it
    await w.ok(["phone", "off"]);
    await until("server ended", async () => !alive(run(w).pid), { ms: 10_000 });
    process.kill(b2.pid, "SIGKILL");
    await until("bridge gone", async () => !alive(b2.pid), { ms: 10_000 });
    const b3 = (await w.ok(["live", "start", "--json"], { env })).json as Info;
    const off = await phone(b3.url);
    assert.equal(off.state, "off");
    assert.ok(run(w).ended, "no server started again");
    await fetch(`${address}/whoami`, { headers: cookie }).then(
      () => assert.fail("the phone's server is back though turned off"),
      () => undefined,
    );
    assert.equal((await w.ok(["phone", "--json"])).json.state, "off");
  } finally {
    w.cleanup();
  }
});

/** The phone's servers a process started (`parent`), seen at least once while watched for `ms`. */
async function serversOf(parent: number, ms: number): Promise<Set<number>> {
  const seen = new Set<number>();
  for (const end = Date.now() + ms; Date.now() < end; ) {
    const ps = spawnSync("ps", ["-ax", "-o", "pid=,ppid=,command="], { encoding: "utf8" }).stdout ?? "";
    for (const line of ps.split("\n")) {
      const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
      if (m && Number(m[2]) === parent && /\bphone serve\b/.test(m[3]!)) seen.add(Number(m[1]));
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  return seen;
}

test("the phone's server started again by several at once (bridges, a strom just updated): one process, not one each", { skip }, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    await w.ok(["phone", "on", "--json"], { dialog: true });
    const first = run(w).pid;
    // its server gone, the connection still on (the computer slept, a crash)
    process.kill(first, "SIGTERM");
    await until("the server ended", () => !alive(first), { ms: 10_000 });
    assert.equal((await w.ok(["phone", "--json"])).json.state, "on");
    // two bridges look in the same moment, before the new server has said itself
    assert.equal(revivePhone(w.env), undefined);
    assert.equal(revivePhone(w.env), undefined);
    const started = await serversOf(process.pid, 3000);
    assert.equal(started.size, 1, `servers started: ${[...started].join(", ")}`);
    await until("the new server runs", () => run(w).pid === [...started][0] && !run(w).ended, { ms: 10_000 });
    // and one asking later waits for that one, starts none
    assert.equal(startPhone(w.env)?.pid, [...started][0]);
  } finally {
    w.cleanup();
  }
});

test("strom phone serve, the first run of a newer strom: it is the server itself, it starts no second one beside it", { skip }, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    await w.ok(["phone", "on", "--json"], { dialog: true });
    const first = run(w).pid;
    process.kill(first, "SIGTERM");
    await until("the server ended", () => !alive(first), { ms: 10_000 });
    // an older strom ran here last: this one's first run catches up (and starts what is on but gone)
    const config = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
    fs.writeFileSync(config, JSON.stringify({ ...JSON.parse(fs.readFileSync(config, "utf8")), lastVersion: "0.0.1" }));
    const serve = spawn(process.execPath, [path.resolve(import.meta.dirname, "..", "..", "src", "cli.ts"), "phone", "serve"], { cwd: w.dir, env: { ...w.env, STROM_LANG: "en" }, stdio: "ignore" });
    try {
      await until("the server runs", () => fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "phone-run.json")) && run(w).pid === serve.pid && !run(w).ended, { ms: 15_000 });
      const beside = await serversOf(serve.pid!, 2000);
      assert.equal(beside.size, 0, `servers started beside it: ${[...beside].join(", ")}`);
    } finally {
      serve.kill("SIGTERM");
    }
  } finally {
    w.cleanup();
  }
});
