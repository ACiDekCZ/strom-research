// The phone's addresses and who may ask its server: private IPv4 of a Wi-Fi or a cable only — never a VPN's (its tunnel
// or its shared range), never a virtual machine's network, never a mobile operator's, never IPv6 —, a device of that
// network alone, never the computer itself; a test the loopback alone, and what a test turned on is off for any strom
// that is no test's. The code to pair a phone: one, for one phone, for a while; the key of a phone kept as its hash.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { forPhone } from "../../src/core/phone-watch.ts";
import { claimHome, homeCode, interfaceKind, lanAddresses, pageLang, pairCode, pairedPhones, pairExpires, pairPhone, pairUrl, phoneByKey, phoneConfig, phoneName, phonePage, privateIPv4, remoteAllowed, revivePhone, stopPhone, virtualInterface } from "../../src/core/phone.ts";

const MAC = "3c:22:fb:12:34:56";
const nic = (address: string, family: "IPv4" | "IPv6" = "IPv4", internal = false, mac = MAC, netmask = "255.255.255.0") => ({ address, family, internal, netmask, mac, cidr: null }) as never;

test("a private network's address: 10/8, 172.16/12, 192.168/16, also as IPv6 maps it — nothing else", () => {
  for (const ip of ["10.0.0.1", "10.255.255.254", "172.16.0.1", "172.31.255.1", "192.168.1.23", "::ffff:192.168.0.5", "::FFFF:10.1.2.3"]) assert.equal(privateIPv4(ip), true, ip);
  for (const ip of ["100.64.0.1", "100.127.1.1", "172.15.0.1", "172.32.0.1", "192.169.0.1", "127.0.0.1", "0.0.0.0", "8.8.8.8", "169.254.1.1", "fe80::1", "::1", "192.168.1.256", "192.168.1", "", "x192.168.1.1"])
    assert.equal(privateIPv4(ip), false, ip);
});

test("the computer's addresses for a phone: private IPv4 of an interface that is up — no loopback, no VPN's, no IPv6", () => {
  const ifaces = {
    lo0: [nic("127.0.0.1", "IPv4", true), nic("::1", "IPv6", true)],
    en0: [nic("192.168.1.23"), nic("fe80::1", "IPv6")],
    utun3: [nic("100.88.1.2")],
    wlp2s0: [nic("10.0.0.7")],
    eth0: [nic("172.20.1.4")],
  };
  assert.deepEqual(lanAddresses({}, ifaces, "linux"), [
    { ip: "192.168.1.23", iface: "en0", kind: "ethernet", mask: "255.255.255.0" },
    { ip: "10.0.0.7", iface: "wlp2s0", kind: "wifi", mask: "255.255.255.0" },
    { ip: "172.20.1.4", iface: "eth0", kind: "ethernet", mask: "255.255.255.0" },
  ]);
  // macOS names Wi-Fi and a cable both en…: unknown
  assert.equal(lanAddresses({}, ifaces, "darwin")[0]!.kind, null);
  assert.equal(interfaceKind("Wi-Fi", "win32"), "wifi");
  assert.equal(interfaceKind("WLAN", "win32"), "wifi");
  assert.equal(interfaceKind("Ethernet 2", "win32"), "ethernet");
  assert.equal(interfaceKind("Připojení k místní síti", "win32"), null);
  // a test: the loopback alone, or no network
  assert.deepEqual(lanAddresses({ STROM_PHONE_TEST: "loopback" }, ifaces), [{ ip: "127.0.0.1", iface: "lo", kind: null, mask: "255.0.0.0" }]);
  assert.deepEqual(lanAddresses({ STROM_PHONE_TEST: "none" }, ifaces), []);
  // any other test value: no network either, never the computer's
  assert.deepEqual(lanAddresses({ STROM_PHONE_TEST: "1" }, ifaces, "linux"), []);
});

test("never a VPN's or a virtual machine's network: macOS — en… alone, a tunnel listed first left out", () => {
  // as a Mac with a VPN, Parallels and a VPN over PPP says them (the tunnel first)
  const mac = {
    utun0: [nic("10.8.0.2", "IPv4", false, "00:00:00:00:00:00", "255.255.255.255")],
    en0: [nic("192.168.2.14")],
    bridge100: [nic("10.211.55.2", "IPv4", false, "3e:22:fb:aa:bb:64")],
    bridge101: [nic("10.37.129.2", "IPv4", false, "3e:22:fb:aa:bb:65")],
    ppp0: [nic("10.212.134.7", "IPv4", false, undefined as never, "255.255.0.0")],
    ipsec0: [nic("10.9.9.9")],
    vmnet8: [nic("172.16.21.1", "IPv4", false, "00:50:56:c0:00:08")],
    awdl0: [nic("192.168.77.1")],
    en7: [nic("192.168.3.5")],
  };
  assert.deepEqual(lanAddresses({}, mac, "darwin").map((a) => a.iface), ["en0", "en7"]);
  for (const name of ["utun0", "utun4", "ppp0", "ipsec0", "bridge100", "vmnet1", "vnic0", "gif0", "stf0", "awdl0", "llw0", "anpi0", "ap1"]) assert.equal(virtualInterface(name, MAC, "darwin"), true, name);
});

test("never a VPN's or a virtual machine's network: Linux and Windows by name, by a tunnel's missing hardware, by a virtual adapter's address", () => {
  for (const name of ["tun0", "tap0", "wg0", "ppp0", "docker0", "br-3f2a", "virbr0", "veth12ab", "vboxnet0", "vmnet8", "zt7nnig26", "tailscale0", "nordlynx", "lxcbr0"])
    assert.equal(virtualInterface(name, MAC, "linux"), true, name);
  for (const name of ["eth0", "enp3s0", "eno1", "wlan0", "wlp2s0", "br0"]) assert.equal(virtualInterface(name, MAC, "linux"), false, name);
  // Windows: the names its adapters get, in any language a person may give them
  for (const name of [
    "vEthernet (WSL)",
    "vEthernet (Default Switch)",
    "vEthernet (WSL (Hyper-V firewall))",
    "VirtualBox Host-Only Network",
    "VMware Network Adapter VMnet8",
    "Local Area Connection* 10",
    "Připojení k místní síti* 2",
    "LAN-Verbindung* 3",
    "OpenVPN TAP-Windows6",
    "OpenVPN Data Channel Offload",
    "NordLynx",
    "Tailscale",
    "ZeroTier One [8056c2e21c000001]",
    "ProtonVPN TUN",
    "Bluetooth Network Connection",
    "Síťové připojení Bluetooth",
    "Npcap Loopback Adapter",
    "Cisco AnyConnect VPN",
  ])
    assert.equal(virtualInterface(name, MAC, "win32"), true, name);
  // a tunnel named by its person (WireGuard: no hardware), a TAP or a Hyper-V adapter renamed "Ethernet 3"
  assert.equal(virtualInterface("domov", "00:00:00:00:00:00", "win32"), true);
  assert.equal(virtualInterface("Ethernet 3", "00:ff:7a:12:9c:01", "win32"), true);
  assert.equal(virtualInterface("Ethernet 4", "00:15:5d:01:02:03", "win32"), true);
  assert.equal(virtualInterface("Ethernet 5", "0a:00:27:00:00:0c", "win32"), true);
  for (const name of ["Ethernet", "Ethernet 2", "Wi-Fi", "Wi-Fi 2", "WLAN", "Připojení k místní síti", "Беспроводная сеть", "Ethernet\u0301".normalize("NFD")])
    assert.equal(virtualInterface(name, MAC, "win32"), false, name);
  const win = {
    "vEthernet (WSL)": [nic("172.29.80.1", "IPv4", false, "00:15:5d:aa:bb:cc", "255.255.240.0")],
    "Ethernet 3": [nic("10.8.0.6", "IPv4", false, "00:ff:7a:12:9c:01")],
    "Připojení k místní síti* 2": [nic("192.168.137.1", "IPv4", false, "5a:22:fb:12:34:57")],
    "Ethernet": [nic("10.0.0.20")],
    "Wi-Fi": [nic("192.168.1.30")],
  };
  // Wi-Fi and a cable alone, in the system's order
  assert.deepEqual(lanAddresses({}, win, "win32").map((a) => [a.iface, a.kind]), [["Ethernet", "ethernet"], ["Wi-Fi", "wifi"]]);
  // a name the system does not say the kind of goes after those it does
  assert.deepEqual(lanAddresses({}, { "Připojení k místní síti": [nic("192.168.5.5")], "Wi-Fi": [nic("192.168.1.30")] }, "win32").map((a) => a.iface), ["Wi-Fi", "Připojení k místní síti"]);
});

test("never a mobile operator's network (its 10.x is the operator's): Linux wwan, rmnet, usb tethering; Windows cellular in any language", () => {
  for (const name of ["wwan0", "wwp0s20f0u6", "rmnet_data0", "rmnet0", "ccmni0", "usb0", "usb1"]) assert.equal(virtualInterface(name, MAC, "linux"), true, name);
  for (const name of ["enx001122334455", "eth1", "wlan1"]) assert.equal(virtualInterface(name, MAC, "linux"), false, name);
  for (const name of ["Cellular", "Cellular 2", "Mobile Broadband Connection", "Mobilní síť", "Mobilní širokopásmové připojení", "Mobilní síť".normalize("NFD"), "Mobilfunk", "Mobiles Breitband", "LTE"])
    assert.equal(virtualInterface(name, MAC, "win32"), true, name);
  const ifaces = { wwan0: [nic("10.64.12.7")], wlan0: [nic("192.168.1.30")] };
  assert.deepEqual(lanAddresses({}, ifaces, "linux").map((a) => a.iface), ["wlan0"]);
});

test("who may ask the phone's server: never the computer itself by any of its addresses (an agent of it is no phone)", () => {
  const home = { ip: "192.168.1.23", mask: "255.255.255.0" };
  assert.equal(remoteAllowed("192.168.1.23", {}, home), false);
  assert.equal(remoteAllowed("::ffff:192.168.1.23", {}, home), false);
  assert.equal(remoteAllowed("192.168.1.40", {}, home, ["192.168.1.40", "10.0.0.20"]), false);
  assert.equal(remoteAllowed("192.168.1.41", {}, home, ["192.168.1.40"]), true);
});

test("the code to pair a phone: 128 bits, the same while it holds, taken once, gone at its time; the phone's key kept as its hash", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-phone-"));
  try {
    const env = { STROM_CONFIG_DIR: dir, STROM_PHONE_TEST: "loopback" };
    const one = pairCode(env);
    assert.match(one.code, /^[A-Za-z0-9_-]{22}$/);
    assert.equal(Buffer.from(one.code, "base64url").length, 16);
    const left = Date.parse(one.expiresAt) - Date.now();
    assert.ok(left > 9 * 60_000 && left <= 10 * 60_000, String(left));
    assert.deepEqual(pairCode(env), one, "shown again: the same");
    // shown by a tree's bridge or in its folder: the page opens that tree; the last shown counts, the code the same
    assert.equal(pairCode(env, { tree: "tr_one" }).code, one.code);
    assert.equal(pairCode(env, { tree: "tr_two" }).code, one.code);
    if (process.platform !== "win32") assert.equal(fs.statSync(path.join(dir, "phone-pair.json")).mode & 0o777, 0o600);
    assert.equal(pairUrl("http://192.168.1.23:47800", one.code, "cs"), `http://192.168.1.23:47800/pair?lang=cs#${one.code}`);
    // a wrong code: nothing, the right one still holds
    assert.equal(pairPhone(env, one.code.replace(/^./, (c) => (c === "A" ? "B" : "A")), { address: "http://127.0.0.1:47800" }), undefined);
    assert.equal(pairPhone(env, "", { address: "http://127.0.0.1:47800" }), undefined);
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    const paired = pairPhone(env, one.code, { address: "http://127.0.0.1:47800", userAgent: ua, lang: "de" })!;
    assert.ok(paired);
    assert.equal(paired.tree, "tr_two");
    assert.match(paired.phone.id, /^ph_[a-z2-7]{8}$/);
    assert.equal(paired.phone.name, "iPhone (Safari)");
    assert.match(paired.key, /^[A-Za-z0-9_-]{43}$/);
    // once alone
    assert.equal(pairPhone(env, one.code, { address: "http://127.0.0.1:47800" }), undefined);
    assert.equal(pairExpires(env), undefined);
    const kept = fs.readFileSync(path.join(dir, "phones.json"), "utf8");
    assert.ok(!kept.includes(paired.key), "never the key");
    assert.equal(pairedPhones(env)[0]!.keyHash, crypto.createHash("sha256").update(paired.key).digest("hex"));
    assert.equal(phoneByKey(env, paired.key)?.id, paired.phone.id);
    assert.equal(phoneByKey(env, paired.key.replace(/^./, (c) => (c === "A" ? "B" : "A"))), undefined);
    assert.equal(phoneByKey(env, undefined), undefined);
    // a new code; its time over: none, and nothing pairs with it
    const short = { ...env, STROM_PHONE_PAIR_MS: "50" };
    const two = pairCode(short);
    assert.notEqual(two.code, one.code);
    pairCode(short, { tree: "tr_one" });
    assert.equal(pairCode(short, {}).code, two.code, "shown with no tree: the code the same, no tree");
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "phone-pair.json"), "utf8")).tree, undefined);
    const until = Date.now() + 120;
    while (Date.now() < until);
    assert.equal(pairExpires(short), undefined);
    assert.equal(pairPhone(short, two.code, { address: "http://127.0.0.1:47800" }), undefined);
    // a shorter time only for a test
    const real = { STROM_CONFIG_DIR: dir, STROM_PHONE_PAIR_MS: "50" };
    assert.ok(Date.parse(pairCode(real).expiresAt) - Date.now() > 9 * 60_000);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the phone's name of its browser; the page's language: the phone's, the QR code's, the research's (set or found here), the browser's", () => {
  assert.equal(phoneName("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"), "Android (Chrome)");
  assert.equal(phoneName("Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36"), "Android (Samsung Internet)");
  assert.equal(phoneName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1"), "iPhone (Chrome)");
  assert.equal(phoneName(undefined), "");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-phone-"));
  try {
    const env = { STROM_CONFIG_DIR: dir, HOME: dir, LANG: "en_US.UTF-8" };
    const phone = { id: "ph_aaaaaaaa", name: "", pairedAt: "2026-10-01T10:00:00.000Z", address: "http://127.0.0.1:47800", lang: "de" };
    assert.equal(pageLang(env, { phone, asked: "cs", acceptLanguage: "en" }), "de");
    assert.equal(pageLang(env, { asked: "cs", acceptLanguage: "de-DE,de;q=0.9" }), "cs");
    assert.equal(pageLang({ ...env, STROM_LANG: "cs" }, { acceptLanguage: "de-DE,de;q=0.9" }), "cs", "the research language set here before the browser's");
    assert.equal(pageLang({ ...env, LANG: "cs_CZ.UTF-8" }, { acceptLanguage: "de-DE,de;q=0.9" }), "cs", "the research language found here before the browser's");
    assert.equal(pageLang(env, { asked: "xx", acceptLanguage: "de-DE,de;q=0.9" }), "en", "found here: English before the browser's");
    const french = { ...env, LANG: "fr_FR.UTF-8" };
    assert.equal(pageLang(french, { asked: "xx", acceptLanguage: "de-DE,de;q=0.9" }), "de", "the browser's only when the research's has no texts");
    assert.equal(pageLang(french, { acceptLanguage: "fr-FR, de;q=0.5" }), "de");
    assert.equal(pageLang(french, { acceptLanguage: "zz" }), "en");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // the page: its texts in its language, nothing of them can end its script
  for (const lang of ["en", "cs", "de"]) {
    const page = phonePage(lang, "NONCE123");
    assert.match(page, new RegExp(`<html lang="${lang}">`));
    assert.equal((page.match(/nonce="NONCE123"/g) ?? []).length, 2);
    const texts = JSON.parse(/<script id="texts" type="application\/json">([^<]*)<\/script>/.exec(page)![1]!) as Record<string, string>;
    for (const k of ["title", "pairing", "paired.title", "paired", "unpaired.title", "unpaired.why", "unpaired.queue", "expired.title", "expired", "unreachable.title", "unreachable", "retry", "btn.photo", "btn.gallery", "sheet.title", "commit", "keep.save", "keep.drop", "gone", "down.title"]) assert.ok(texts[k], `${lang} ${k}`);
    assert.doesNotMatch(page, /\{\{/);
  }
  assert.match(JSON.stringify(phonePage("cs", "n")), /Spárováno/);
});

test("who may ask the phone's server: a device of the network it is asked at; the loopback only in a test", () => {
  const home = { ip: "192.168.1.23", mask: "255.255.255.0" };
  assert.equal(remoteAllowed("192.168.1.40", {}, home), true);
  assert.equal(remoteAllowed("::ffff:10.0.0.9", {}, { ip: "10.0.0.20", mask: "255.255.255.0" }), true);
  // a peer of a VPN (10.8…) routed to the home address, another private network, no network known: nothing
  for (const r of ["10.8.0.1", "192.168.2.40", "172.16.0.5"]) assert.equal(remoteAllowed(r, {}, home), false, r);
  assert.equal(remoteAllowed("192.168.1.40", {}), false);
  for (const r of ["100.64.3.3", "8.8.4.4", "::1", "127.0.0.1", "::ffff:127.0.0.1", "fe80::2", "", undefined]) assert.equal(remoteAllowed(r, {}, home), false, String(r));
  assert.equal(remoteAllowed("::ffff:127.0.0.1", { STROM_PHONE_TEST: "loopback" }), true);
  assert.equal(remoteAllowed("127.0.0.1", { STROM_PHONE_TEST: "none" }), false);
});

test("turned on by a test: marked, off for a strom that is no test's — its server neither started nor kept", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-phone-"));
  try {
    const test = { STROM_CONFIG_DIR: dir, STROM_PHONE_TEST: "loopback" };
    const real = { STROM_CONFIG_DIR: dir };
    fs.writeFileSync(path.join(dir, "phone.json"), JSON.stringify({ on: true, since: new Date().toISOString(), test: true }));
    assert.equal(phoneConfig(test).on, true);
    assert.equal(phoneConfig(test).test, true);
    assert.deepEqual(phoneConfig(real), { on: false });
    assert.equal(revivePhone(real), undefined);
    assert.equal(fs.existsSync(path.join(dir, "phone-run.json")), false, "no server started");
    // the person's own yes is no test's
    fs.writeFileSync(path.join(dir, "phone.json"), JSON.stringify({ on: true, since: new Date().toISOString() }));
    assert.equal(phoneConfig(real).on, true);
    // turned off by anyone: the mark goes with it
    stopPhone(test, "a test", { waitMs: 0 });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "phone.json"), "utf8")), { on: false });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the phone's page: its script compiles and nothing of it ends the page's script; the worker's SHA-256 is node's", async () => {
  const asset = (name: string) => fs.readFileSync(path.join(import.meta.dirname, "../../assets/phone", name), "utf8");
  for (const name of ["phone.js", "sha256.js"]) {
    assert.doesNotThrow(() => new vm.Script(asset(name), { filename: name }));
    assert.doesNotMatch(asset(name), /<\/script|\{\{/i);
  }
  assert.doesNotMatch(asset("phone.css"), /<\/style|\{\{/i);
  // the worker in a sandbox: the parts of a blob read, its answers caught
  const answers: Record<string, unknown>[] = [];
  const self: { onmessage?: (e: { data: unknown }) => Promise<void>; postMessage: (m: Record<string, unknown>) => void } = { postMessage: (m) => answers.push(m) };
  vm.runInNewContext(asset("sha256.js"), { self, Uint8Array, Uint32Array, Math, Array, String });
  const random = crypto.randomBytes(9 * 1024 * 1024 + 77);
  for (const size of [0, 3, 55, 56, 63, 64, 65, 119, 4 * 1024 * 1024, 4 * 1024 * 1024 + 1, random.length]) {
    answers.length = 0;
    await self.onmessage!({ data: { id: `s${size}`, blob: new Blob([random.subarray(0, size)]) } });
    const last = answers.at(-1)!;
    assert.equal(last.id, `s${size}`);
    assert.equal(last.sha, crypto.createHash("sha256").update(random.subarray(0, size)).digest("hex"), `size ${size}`);
  }
  answers.length = 0;
  await self.onmessage!({ data: { id: "bad", blob: null } });
  assert.ok(answers.at(-1)!.error, "no blob: an error, not a hash");
});

test("the phone's page fills its texts as the catalog writes them: a name, a plural of each language", () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, "../../assets/phone/phone.js"), "utf8");
  const code = src.slice(src.indexOf("  const closing ="), src.indexOf("  const mb ="));
  for (const [lang, n, expect] of [["cs", 1, /^1 fotka/], ["cs", 3, /^3 fotky/], ["cs", 5, /^5 fotek/], ["en", 1, /^1 photo\b/], ["en", 2, /^2 photos/], ["de", 2, /^2 Fotos/]] as const) {
    const page = phonePage(lang, "n");
    const T = JSON.parse(/<script id="texts" type="application\/json">([^<]*)<\/script>/.exec(page)![1]!) as Record<string, string>;
    const t = new Function("T", "LANG", "plurals", `${code}; return t;`)(T, lang, new Intl.PluralRules(lang)) as (k: string, v?: Record<string, unknown>) => string;
    const text = t("strip.sent", { n });
    assert.match(text, expect, `${lang} ${n}: ${text}`);
    assert.doesNotMatch(text, /[{}#]/);
    assert.match(t("gone", { name: "Ж", first: "Ö" }), /Ж[\s\S]*Ö/);
  }
});

test("a text of the research for the phone: without the IDs of its records, any script", () => {
  assert.equal(forPhone("Křest Anežky Dvořákové (1842) [P0012]"), "Křest Anežky Dvořákové (1842)");
  assert.equal(forPhone("Ольга Жукова [P0003] a [F0001] rodina [S00042]."), "Ольга Жукова a rodina.");
  assert.equal(forPhone("Kniha [1842] zůstává"), "Kniha [1842] zůstává", "a year in brackets stays");
  assert.equal(forPhone("Ane\u0301zka [I0007]".normalize("NFD")), "Anézka".normalize("NFD"));
});

test("the icon on the home screen unpaired scans no QR code: the page says to open it in the browser and add the icon again, in each language", () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, "../../assets/phone/phone.js"), "utf8");
  assert.match(src, /if \(standalone\) \$\("unpairedHow"\)\.textContent = t\("unpaired\.howHome"\);/);
  for (const [lang, browser] of [["en", /browser/], ["cs", /prohlížeči/], ["de", /Browser/]] as const) {
    const T = JSON.parse(/<script id="texts" type="application\/json">([^<]*)<\/script>/.exec(phonePage(lang, "n"))![1]!) as Record<string, string>;
    assert.match(T["unpaired.howHome"] ?? "", browser, lang);
    assert.match(T["unpaired.howHome"]!, /Safari, Chrome/, lang);
    assert.notEqual(T["unpaired.howHome"], T["unpaired.how"], lang);
  }
});

test("a text of the research for the phone: no bare ID nor a list of them, no path of the research or of this computer, a link as its site alone; nothing left over", () => {
  const nfd = (s: string) => s.normalize("NFD");
  const cases: [string, string][] = [
    // bare IDs of each kind, a list of them, a document read's
    ["Odpovědět na dotaz farnosti T0608 a čekat", "Odpovědět na dotaz farnosti a čekat"],
    ["Hypotézy H0005, H0010, H0012, … rozhodnout", "Hypotézy rozhodnout"],
    ["Antwort des Archivs abwarten (T0400 und T0401; data/tasks/T0400.json)", "Antwort des Archivs abwarten"],
    ["Rodina Novákových – H0020 – rozhodnout, zda zůstat", "Rodina Novákových – rozhodnout, zda zůstat"],
    ["Viz dotaz (T0608) – čeká na odpověď", "Viz dotaz – čeká na odpověď"],
    [nfd("Čtení D20261019153012-a1b2 Anežky dokončeno"), nfd("Čtení Anežky dokončeno")],
    ["Опись X0003, Q0012 и K0002 проверить", "Опись проверить"],
    [nfd("Rozhodnout H0003 či H0004 podle zápisu"), nfd("Rozhodnout podle zápisu")],
    // paths: in the research, POSIX, the home's, Windows (both slashes), a share
    [nfd("Odpovědět na dotaz T0608 (notes/T0608-dotaz-farnost-…md)"), nfd("Odpovědět na dotaz")],
    ["Ответ архива [H0077] получен: ~/Documents/ответ.md", "Ответ архива получен"],
    ["Snímky jsou stažené (C:\\Users\\Anežka\\Strom\\inputs\\kniha.pdf, I0004).", "Snímky jsou stažené."],
    ["Brief an das Archiv \\\\server\\geteilt\\brief.docx und D:/Strom/x.jpg senden", "Brief an das Archiv und senden"],
    ["Uloženo v /Users/nekdo/Documents/x.pdf, zbývá přečíst", "Uloženo v, zbývá přečíst"],
    // links: the site alone, without www., a port, a login; what closes the sentence or a bracket stays
    ["Snímky z https://www.archiv.example.org/kniha/123?page=4 jsou stažené", "Snímky z archiv.example.org jsou stažené"],
    ["Napsat archivu (https://digi.example.cz/matriky/123) a počkat", "Napsat archivu (digi.example.cz) a počkat"],
    ["siehe www.familysearch.example/ark:/61903/abc.", "siehe familysearch.example."],
    ["Seite https://user@WWW.Archiv.Example.org:8080/x", "Seite archiv.example.org"],
    ["Архив: https://архив.пример.рф/фонд/12, опись 3", "Архив: архив.пример.рф, опись 3"],
    // nothing left: nothing
    ["T0608", ""],
    ["(notes/x.md, H0001)", ""],
    // what is none of them stays as it is
    ["1842/43, km/h, čp. 12/3, Ústí n./L., S. 12, T1, PSČ 12345 — Familie Müller (1842–1900)", "1842/43, km/h, čp. 12/3, Ústí n./L., S. 12, T1, PSČ 12345 — Familie Müller (1842–1900)"],
    ["Ano/ne: zápis z 3. 4. 1842 v 10:30", "Ano/ne: zápis z 3. 4. 1842 v 10:30"],
  ];
  for (const [text, expect] of cases) assert.equal(forPhone(text), expect, text);
  // what is left never has a doubled space, a bracket with nothing in it, nor a comma before a comma
  for (const [text] of cases) assert.doesNotMatch(forPhone(text), /\s{2}|\(\s*\)|\[\s*\]|,\s*,|\s[,.;:]/u, text);
});

test("the icon on the home screen: a code of a paired phone, taken once for a key of its own of the same phone, gone at its time; only the newest holds", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-phone-"));
  try {
    const env = { STROM_CONFIG_DIR: dir, STROM_PHONE_TEST: "loopback" };
    const paired = pairPhone(env, pairCode(env).code, { address: "http://127.0.0.1:47800" })!;
    const one = homeCode(env, paired.phone);
    assert.match(one.code, /^[A-Za-z0-9_-]{22}$/);
    assert.ok(!fs.readFileSync(path.join(dir, "phone-home.json"), "utf8").includes(one.code), "never the code");
    if (process.platform !== "win32") assert.equal(fs.statSync(path.join(dir, "phone-home.json")).mode & 0o777, 0o600);
    // a newer code: the older one holds no more
    const two = homeCode(env, paired.phone, "tr_one");
    assert.equal(claimHome(env, one.code), undefined);
    assert.equal(claimHome(env, "x"), undefined);
    const icon = claimHome(env, two.code)!;
    assert.equal(icon.phone.id, paired.phone.id);
    assert.notEqual(icon.key, paired.key);
    assert.equal(icon.tree, "tr_one", "the tree shown as it was added");
    assert.equal(claimHome(env, two.code), undefined, "once alone");
    assert.equal(phoneByKey(env, icon.key)?.id, paired.phone.id);
    assert.equal(phoneByKey(env, paired.key)?.id, paired.phone.id, "the browser's key still holds");
    assert.equal(pairedPhones(env).length, 1);
    assert.ok(!fs.readFileSync(path.join(dir, "phones.json"), "utf8").includes(icon.key), "never the key");
    // its time over: nothing
    const three = homeCode(env, paired.phone);
    const f = path.join(dir, "phone-home.json");
    fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(fs.readFileSync(f, "utf8")), expiresAt: new Date(Date.now() - 1000).toISOString() }));
    assert.equal(claimHome(env, three.code), undefined);
    // a phone taken off meanwhile: nothing
    const four = homeCode(env, paired.phone);
    fs.writeFileSync(path.join(dir, "phones.json"), JSON.stringify({ phones: [] }));
    assert.equal(claimHome(env, four.code), undefined);
    assert.equal(phoneByKey(env, icon.key), undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
