// The devices of the home network (src/core/devices.ts): the code to pair one — one at a time, once, for a while; a
// wrong proof leaves it for the device it was shown to —, the devices paired (the user's alone, read tolerantly, taken
// off and put back), their names (NFC, any script, whole characters), and requests sent again refused.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CLOCK_MS,
  clientOfDevice,
  DEVICE_CONNECTED_MS,
  deviceById,
  deviceCode,
  deviceEvents,
  deviceRows,
  HOME_MS,
  MOVE_MS,
  deviceKey,
  deviceName,
  devicePairCode,
  devicePairNow,
  devicePairUrl,
  devicesList,
  devicesOn,
  forgetDevicePair,
  kindOf,
  NAME_MAX,
  NONCE_MS,
  NonceMemory,
  PAIR_MS,
  pairDevice,
  pairProof,
  removeDevice,
  renameDevice,
  restoreDevice,
  sawDevice,
} from "../../src/core/devices.ts";

const T0 = Date.parse("2026-11-24T10:00:00.000Z");
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function scratch(): { env: Record<string, string>; dir: string; done: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-devices-"));
  return { env: { STROM_CONFIG_DIR: dir, HOME: dir }, dir, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** The device's side of a pairing: the key from the QR code's secret, its proof. */
const proofOf = (code: { pairId: string; secret: string }) => pairProof(deviceKey(Buffer.from(code.secret, "base64url"), code.pairId), code.pairId);

const mode = (f: string) => fs.statSync(f).mode & 0o777;
const b64 = (b: Buffer) => b.toString("base64url");

test("devices.mode: on only by the user's config of this computer — no variable turns it on, a config unread is off", () => {
  const s = scratch();
  try {
    assert.equal(devicesOn(s.env), false);
    assert.equal(devicesOn({ ...s.env, STROM_DEVICES_MODE: "on", DEVICES_MODE: "on" }), false);
    fs.writeFileSync(path.join(s.dir, "config.json"), JSON.stringify({ devicesMode: "off" }));
    assert.equal(devicesOn(s.env), false);
    fs.writeFileSync(path.join(s.dir, "config.json"), JSON.stringify({ devicesMode: "on" }));
    assert.equal(devicesOn(s.env), true);
    fs.writeFileSync(path.join(s.dir, "config.json"), "{ broken");
    assert.equal(devicesOn(s.env), false);
  } finally {
    s.done();
  }
});

test("the code to pair: 22 + 43 characters base64url, 10 minutes, the QR's address with the code after #, the file the user's alone", () => {
  const s = scratch();
  try {
    const code = devicePairCode(s.env, { mode: "app", tree: "Lhotákovi" }, () => T0);
    assert.match(code.pairId, /^[A-Za-z0-9_-]{22}$/);
    assert.match(code.secret, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Date.parse(code.expiresAt) - T0, PAIR_MS);
    assert.equal(PAIR_MS, 10 * 60_000);
    assert.equal(code.tree, "Lhotákovi");
    assert.equal(devicePairUrl("http://192.168.1.23:47811/", code), `http://192.168.1.23:47811/pair?m=app#${code.pairId}.${code.secret}`);
    assert.equal(devicePairUrl("http://192.168.1.23:47811", { ...code, mode: "page" }), `http://192.168.1.23:47811/pair?m=page#${code.pairId}.${code.secret}`);
    const f = path.join(s.dir, "device-pair.json");
    if (process.platform !== "win32") assert.equal(mode(f), 0o600);
    assert.deepEqual(devicePairNow(s.env, () => T0 + 1000), code);
    assert.equal(devicePairNow(s.env, () => T0 + PAIR_MS), undefined, "expired: none to show");
    // the secret is never in the log
    const log = fs.readFileSync(path.join(s.dir, "phone.log"), "utf8");
    assert.ok(!log.includes(code.secret) && !log.includes(code.pairId), log);
  } finally {
    s.done();
  }
});

test("pairing: the right proof pairs once (pair.used after), a wrong one leaves the code, an old code is gone with a new one, an expired one is refused", () => {
  const s = scratch();
  try {
    const first = devicePairCode(s.env, {}, () => T0);
    const second = devicePairCode(s.env, { mode: "page" }, () => T0 + 1000);
    assert.notEqual(second.pairId, first.pairId);
    assert.deepEqual(pairDevice(s.env, { pairId: first.pairId, proof: proofOf(first), address: "192.168.1.40" }, () => T0 + 2000), { ok: false, error: "pair.expired" }, "replaced by the new one");

    // a wrong proof: refused, the code holds still
    const wrong = pairProof(deviceKey(Buffer.alloc(32, 7), second.pairId), second.pairId);
    for (const proof of [wrong, "", "x", 42, undefined, `${proofOf(second)}=`])
      assert.deepEqual(pairDevice(s.env, { pairId: second.pairId, proof, address: "192.168.1.40" }, () => T0 + 2000), { ok: false, error: "device.bad" }, String(proof));
    assert.ok(devicePairNow(s.env, () => T0 + 2000));

    const ok = pairDevice(s.env, { pairId: second.pairId, proof: proofOf(second), userAgent: IPHONE, address: "192.168.1.40" }, () => T0 + 3000);
    assert.ok(ok.ok);
    assert.equal(ok.mode, "page");
    assert.match(ok.device.id, /^dv_[a-z2-7]{16}$/);
    assert.equal(ok.device.name, "iPhone (Safari)");
    assert.equal(ok.device.kind, "phone");
    assert.equal(ok.device.via, "app");
    assert.equal(ok.device.address, "192.168.1.40");
    assert.equal(ok.device.pairedAt, new Date(T0 + 3000).toISOString());
    assert.deepEqual(ok.key, deviceKey(Buffer.from(second.secret, "base64url"), second.pairId), "K as the device derives it");
    assert.equal(devicePairNow(s.env, () => T0 + 3000), undefined, "used: no code left");
    // the same code again: used (not expired), also with a wrong proof, also later on
    assert.deepEqual(pairDevice(s.env, { pairId: second.pairId, proof: proofOf(second), address: "192.168.1.41" }, () => T0 + 4000), { ok: false, error: "pair.used" });
    assert.deepEqual(pairDevice(s.env, { pairId: second.pairId, proof: "x", address: "192.168.1.41" }, () => T0 + 30 * 60_000), { ok: false, error: "pair.used" });
    assert.equal(devicesList(s.env).length, 1);

    // expired, on a fixed clock
    const late = devicePairCode(s.env, {}, () => T0);
    assert.deepEqual(pairDevice(s.env, { pairId: late.pairId, proof: proofOf(late), address: "192.168.1.42" }, () => T0 + PAIR_MS), { ok: false, error: "pair.expired" });
    assert.ok(pairDevice(s.env, { pairId: late.pairId, proof: proofOf(late), address: "192.168.1.42" }, () => T0 + PAIR_MS - 1).ok, "a millisecond before: still holds");
    // unknown, not a pairId at all
    for (const pairId of ["AAAAAAAAAAAAAAAAAAAAAA", "", "../x", 7, null]) assert.deepEqual(pairDevice(s.env, { pairId, proof: "x", address: "x" }, () => T0), { ok: false, error: "pair.expired" });

    // turned off: a QR code shown before pairs nothing
    const shown = devicePairCode(s.env, {}, () => T0);
    forgetDevicePair(s.env, () => T0);
    assert.deepEqual(pairDevice(s.env, { pairId: shown.pairId, proof: proofOf(shown), address: "x" }, () => T0 + 1), { ok: false, error: "pair.expired" });
  } finally {
    s.done();
  }
});

test("devices.json: the user's alone, without keys to the bridge, read tolerantly; taken off and put back; seen at most once a minute", () => {
  const s = scratch();
  try {
    const code = devicePairCode(s.env, {}, () => T0);
    const ok = pairDevice(s.env, { pairId: code.pairId, proof: proofOf(code), name: "Tablet v kuchyni", kind: "tablet", address: "192.168.1.50" }, () => T0);
    assert.ok(ok.ok);
    const f = path.join(s.dir, "devices.json");
    if (process.platform !== "win32") assert.equal(mode(f), 0o600);
    const listed = devicesList(s.env);
    assert.equal(listed.length, 1);
    assert.ok(!("key" in listed[0]!), "no key for the bridge");
    assert.ok(!JSON.stringify(listed).includes(ok.device.key));
    assert.equal(deviceById(s.env, ok.device.id)?.key, ok.device.key);
    assert.equal(deviceById(s.env, "dv_aaaaaaaaaaaaaaaa"), undefined);
    assert.equal(deviceById(s.env, 42), undefined);

    // a bad row is skipped, the good one stays; a broken file is none
    const raw = JSON.parse(fs.readFileSync(f, "utf8"));
    raw.devices.push(null, "x", { id: "ph_abc", key: ok.device.key, pairedAt: "2026-11-24T10:00:00Z" }, { id: "dv_bbbbbbbbbbbbbbbb", key: "short", pairedAt: "2026-11-24T10:00:00Z" }, { id: "dv_cccccccccccccccc", key: ok.device.key, pairedAt: "never" }, { id: "dv_dddddddddddddddd", key: ok.device.key, pairedAt: "2026-11-24T10:00:00Z", kind: "toaster", name: 5 });
    fs.writeFileSync(f, JSON.stringify(raw));
    assert.deepEqual(
      devicesList(s.env).map((d) => [d.id, d.kind, d.name]),
      [
        [ok.device.id, "tablet", "Tablet v kuchyni"],
        ["dv_dddddddddddddddd", "computer", "dv_dddddddddddddddd"],
      ],
    );
    fs.writeFileSync(f, "{ broken");
    assert.deepEqual(devicesList(s.env), []);
    fs.writeFileSync(f, JSON.stringify({ devices: [ok.device] }));

    // seen: written at most once a minute
    sawDevice(s.env, { id: ok.device.id, lastSeenAt: ok.device.lastSeenAt }, () => T0 + 30_000);
    assert.equal(deviceById(s.env, ok.device.id)?.lastSeenAt, new Date(T0).toISOString());
    sawDevice(s.env, { id: ok.device.id, lastSeenAt: ok.device.lastSeenAt }, () => T0 + 61_000);
    assert.equal(deviceById(s.env, ok.device.id)?.lastSeenAt, new Date(T0 + 61_000).toISOString());

    // renamed: NFC, whole characters; nothing left — refused
    assert.equal(renameDevice(s.env, ok.device.id, "  Pracovna  ")?.name, "Pracovna");
    assert.equal(renameDevice(s.env, ok.device.id, " \u0000 "), undefined);
    assert.equal(renameDevice(s.env, "dv_eeeeeeeeeeeeeeee", "x"), undefined);

    // taken off (its key with it), put back as it was
    const gone = removeDevice(s.env, ok.device.id);
    assert.deepEqual(gone?.map((d) => d.id), [ok.device.id]);
    assert.equal(deviceById(s.env, ok.device.id), undefined);
    assert.ok(!fs.readFileSync(f, "utf8").includes(ok.device.key), "the key gone with it");
    assert.equal(removeDevice(s.env, ok.device.id), undefined);
    restoreDevice(s.env, gone!);
    restoreDevice(s.env, gone!);
    assert.equal(devicesList(s.env).length, 1);
    assert.equal(deviceById(s.env, ok.device.id)?.key, ok.device.key);
  } finally {
    s.done();
  }
});

test("a device's name: NFC, any script, at most 60 whole characters; else from the User-Agent", () => {
  const nfd = "Lhotáǩ".normalize("NFD") + " – télefon";
  assert.equal(deviceName(nfd), nfd.normalize("NFC"));
  assert.equal(deviceName("Телефон Лотаков"), "Телефон Лотаков");
  assert.equal(deviceName("家の タブレット"), "家の タブレット");
  assert.equal(deviceName("a\nb\tc"), "a b c");
  assert.equal(deviceName(""), "");
  assert.equal(deviceName(7), "");
  // cut at 60 characters, never inside one (a letter with its mark, an emoji of several code points)
  const long = "č".normalize("NFD").repeat(70);
  const cut = deviceName(long);
  assert.equal([...new Intl.Segmenter().segment(cut)].length, NAME_MAX);
  assert.equal(cut, "č".repeat(NAME_MAX));
  const family = deviceName("👨‍👩‍👧".repeat(70));
  assert.equal([...new Intl.Segmenter().segment(family)].length, NAME_MAX);
  assert.ok(family.endsWith("👨‍👩‍👧"));

  const s = scratch();
  try {
    const code = devicePairCode(s.env, {}, () => T0);
    const ok = pairDevice(s.env, { pairId: code.pairId, proof: proofOf(code), name: nfd, address: "x" }, () => T0);
    assert.ok(ok.ok);
    assert.equal(ok.device.name, nfd.normalize("NFC"));
    assert.equal(devicesList(s.env)[0]!.name, nfd.normalize("NFC"));
    assert.ok(fs.readFileSync(path.join(s.dir, "devices.json"), "utf8").includes(nfd.normalize("NFC")));
    const blank = devicePairCode(s.env, {}, () => T0);
    const two = pairDevice(s.env, { pairId: blank.pairId, proof: proofOf(blank), name: "   ", userAgent: "curl/8", address: "x" }, () => T0);
    assert.ok(two.ok);
    assert.equal(two.device.name, two.device.id, "neither a name nor a device in the User-Agent: its id");
  } finally {
    s.done();
  }
  assert.equal(kindOf(IPHONE), "phone");
  assert.equal(kindOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
  assert.equal(kindOf("Mozilla/5.0 (Linux; Android 14; SM-X200) Safari/537.36"), "tablet");
  assert.equal(kindOf("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36"), "phone");
  assert.equal(kindOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "computer");
});

test("a request sent again: the same nonce of the same device refused, a time over 2 minutes off refused (with the gateway's time) — each said apart (replay)", () => {
  const m = new NonceMemory();
  assert.deepEqual(m.check("dv_aaaaaaaaaaaaaaaa", T0, "n1", T0), { ok: true });
  assert.deepEqual(m.check("dv_aaaaaaaaaaaaaaaa", T0, "n1", T0 + 1000), { ok: false, error: "device.clock", now: T0 + 1000, replay: true });
  assert.deepEqual(m.check("dv_bbbbbbbbbbbbbbbb", T0, "n1", T0 + 1000), { ok: true }, "another device's nonce is its own");
  assert.deepEqual(m.check("dv_aaaaaaaaaaaaaaaa", T0 + CLOCK_MS + 1, "n2", T0), { ok: false, error: "device.clock", now: T0, replay: false });
  assert.deepEqual(m.check("dv_aaaaaaaaaaaaaaaa", T0 - CLOCK_MS - 1, "n3", T0), { ok: false, error: "device.clock", now: T0, replay: false });
  assert.deepEqual(m.check("dv_aaaaaaaaaaaaaaaa", T0 + CLOCK_MS, "n4", T0), { ok: true }, "2 minutes exactly: taken");
  assert.deepEqual(m.check("dv_aaaaaaaaaaaaaaaa", Number.NaN, "n5", T0), { ok: false, error: "device.clock", now: T0, replay: false });
  // past NONCE_MS the nonce is forgotten — and its time is out of CLOCK_MS by then anyway
  const later = T0 + NONCE_MS + 1;
  assert.equal(m.check("dv_aaaaaaaaaaaaaaaa", T0, "n1", later).ok, false, "too old to be taken");
  assert.ok(NONCE_MS > 2 * CLOCK_MS);
  m.forget("dv_aaaaaaaaaaaaaaaa");
  assert.deepEqual(m.check("dv_aaaaaaaaaaaaaaaa", T0, "n1", T0), { ok: true }, "unpaired and paired again: a new memory");
  // past what is remembered of a device: a request no newer than the oldest forgotten is not taken — as one sent again
  const full = new NonceMemory();
  for (let i = 0; i <= 20_000; i++) assert.equal(full.check("dv_cccccccccccccccc", T0 + i, `f${i}`, T0 + 20_000).ok, true);
  assert.deepEqual(full.check("dv_cccccccccccccccc", T0, "new", T0 + 20_000), { ok: false, error: "device.clock", now: T0 + 20_000, replay: true });
  assert.equal(full.check("dv_cccccccccccccccc", T0 + 1, "newer", T0 + 20_000).ok, true);
});

test("codes of a paired device: home pairs its icon (a device of its row, a key of its own), move the device itself (a new key at a new address); once, for their while; the QR code as it was", () => {
  const s = scratch();
  try {
    const qr = devicePairCode(s.env, {}, () => T0);
    const first = pairDevice(s.env, { pairId: qr.pairId, proof: proofOf(qr), name: "Telefon Lhotáků", kind: "phone", address: "http://192.168.1.23:47811" }, () => T0);
    assert.ok(first.ok);
    const me = first.device;
    const qr2 = devicePairCode(s.env, {}, () => T0 + 1000);

    // home: 24 hours, a new one of the same device takes the old one's place, another kind beside it
    const old = deviceCode(s.env, me, "home", () => T0);
    const home = deviceCode(s.env, me, "home", () => T0 + 1000);
    const move = deviceCode(s.env, me, "move", () => T0 + 1000);
    assert.match(home.id, /^[A-Za-z0-9_-]{22}$/);
    assert.match(home.secret, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Date.parse(home.expiresAt) - (T0 + 1000), HOME_MS);
    assert.equal(Date.parse(move.expiresAt) - (T0 + 1000), MOVE_MS);
    assert.deepEqual([HOME_MS, MOVE_MS], [24 * 3600_000, 10 * 60_000]);
    const f = path.join(s.dir, "device-codes.json");
    if (process.platform !== "win32") assert.equal(mode(f), 0o600);
    const log = () => fs.readFileSync(path.join(s.dir, "phone.log"), "utf8");
    for (const c of [old, home, move]) assert.ok(!log().includes(c.secret) && !log().includes(c.id), "never in the log");
    const asCode = (c: { id: string; secret: string }) => ({ pairId: c.id, secret: c.secret });
    assert.deepEqual(pairDevice(s.env, { pairId: old.id, proof: proofOf(asCode(old)), address: "x" }, () => T0 + 2000), { ok: false, error: "pair.expired" }, "replaced");
    // a wrong proof: refused, the code holds still
    assert.deepEqual(pairDevice(s.env, { pairId: home.id, proof: proofOf({ pairId: home.id, secret: Buffer.alloc(32, 9).toString("base64url") }), address: "x" }, () => T0 + 2000), { ok: false, error: "device.bad" });
    const icon = pairDevice(s.env, { pairId: home.id, proof: proofOf(asCode(home)), name: "jiné jméno", kind: "computer", address: "http://192.168.1.23:47811" }, () => T0 + 3000);
    assert.ok(icon.ok);
    assert.equal(icon.code, "home");
    assert.notEqual(icon.device.id, me.id);
    assert.deepEqual([icon.device.of, icon.device.name, icon.device.kind], [me.id, "Telefon Lhotáků", "phone"], "of the row, its name and kind");
    assert.deepEqual(icon.key, deviceKey(Buffer.from(home.secret, "base64url"), home.id));
    assert.deepEqual(pairDevice(s.env, { pairId: home.id, proof: proofOf(asCode(home)), address: "x" }, () => T0 + 4000), { ok: false, error: "pair.used" });
    assert.equal(deviceById(s.env, icon.device.id)?.of, me.id, "kept in devices.json");
    // the QR code made before still holds (a code of a device never takes its place)
    assert.ok(devicePairNow(s.env, () => T0 + 5000));

    // move: the same id, a new key and address, seen now; the old key gone
    const moved = pairDevice(s.env, { pairId: move.id, proof: proofOf(asCode(move)), address: "http://lhota-pc.local:47811" }, () => T0 + 6000);
    assert.ok(moved.ok);
    assert.deepEqual([moved.code, moved.device.id, moved.device.address, moved.device.lastSeenAt], ["move", me.id, "http://lhota-pc.local:47811", new Date(T0 + 6000).toISOString()]);
    assert.equal(deviceById(s.env, me.id)?.key, b64(moved.key));
    assert.notEqual(deviceById(s.env, me.id)?.key, me.key);
    assert.deepEqual(pairDevice(s.env, { pairId: move.id, proof: proofOf(asCode(move)), address: "x" }, () => T0 + 7000), { ok: false, error: "pair.used" });
    assert.equal(devicesList(s.env).length, 2);

    // expired on a fixed clock: move after 10 minutes, home after 24 hours (a millisecond before: holds)
    const late = deviceCode(s.env, me, "move", () => T0);
    assert.deepEqual(pairDevice(s.env, { pairId: late.id, proof: proofOf(asCode(late)), address: "x" }, () => T0 + MOVE_MS), { ok: false, error: "pair.expired" });
    const day = deviceCode(s.env, me, "home", () => T0);
    assert.deepEqual(pairDevice(s.env, { pairId: day.id, proof: proofOf(asCode(day)), address: "x" }, () => T0 + HOME_MS), { ok: false, error: "pair.expired" });
    const day2 = deviceCode(s.env, me, "home", () => T0);
    assert.ok(pairDevice(s.env, { pairId: day2.id, proof: proofOf(asCode(day2)), address: "x" }, () => T0 + HOME_MS - 1).ok);

    // the device unpaired meanwhile: its code is expired
    const orphan = deviceCode(s.env, me, "home", () => T0);
    assert.equal(removeDevice(s.env, me.id)?.length, 3, "the device with its two icons");
    assert.deepEqual(pairDevice(s.env, { pairId: orphan.id, proof: proofOf(asCode(orphan)), address: "x" }, () => T0 + 1000), { ok: false, error: "pair.expired" });
    // the QR code pairs as before
    assert.ok(pairDevice(s.env, { pairId: qr2.pairId, proof: proofOf(qr2), address: "x" }, () => T0 + 8000).ok);
  } finally {
    s.done();
  }
});

test("a row: renamed and unpaired with the icons of its home screen; an icon's id is no row from the computer, its own row from the icon", () => {
  const s = scratch();
  try {
    const qr = devicePairCode(s.env, {}, () => T0);
    const parent = pairDevice(s.env, { pairId: qr.pairId, proof: proofOf(qr), name: "Tablet", kind: "tablet", address: "http://192.168.1.23:47811" }, () => T0);
    assert.ok(parent.ok);
    const c = deviceCode(s.env, parent.device, "home", () => T0);
    const icon = pairDevice(s.env, { pairId: c.id, proof: proofOf({ pairId: c.id, secret: c.secret }), address: "http://192.168.1.23:47811" }, () => T0);
    assert.ok(icon.ok);
    assert.equal(renameDevice(s.env, icon.device.id, "x"), undefined, "an icon's id from the computer");
    const nfd = "Tablet Lhotáků".normalize("NFD");
    assert.equal(renameDevice(s.env, icon.device.id, nfd, { fromIcon: true })?.id, parent.device.id);
    assert.deepEqual(devicesList(s.env).map((d) => d.name), ["Tablet Lhotáků", "Tablet Lhotáků"]);
    assert.equal(renameDevice(s.env, parent.device.id, "Планшет")?.name, "Планшет");
    assert.deepEqual(devicesList(s.env).map((d) => d.name), ["Планшет", "Планшет"]);
    assert.equal(removeDevice(s.env, icon.device.id), undefined, "an icon goes with its device");
    const gone = removeDevice(s.env, icon.device.id, { fromIcon: true });
    assert.deepEqual(gone?.map((d) => d.id), [parent.device.id, icon.device.id]);
    assert.deepEqual(devicesList(s.env), []);
    restoreDevice(s.env, gone!);
    assert.deepEqual(devicesList(s.env).map((d) => [d.id, d.of]), [[parent.device.id, undefined], [icon.device.id, parent.device.id]]);
  } finally {
    s.done();
  }
});

test("the rows the bridge says: icons folded into their device's row (connected, seen, home), stale off the gateway's addresses; the events between two looks", () => {
  const at = (ms: number) => new Date(T0 + ms).toISOString();
  const dev = (id: string, o: Partial<{ of: string; lastSeenAt: string | null; address: string; name: string }> = {}) => ({ id, name: o.name ?? "Telefon", kind: "phone" as const, via: "app" as const, pairedAt: at(0), lastSeenAt: o.lastSeenAt === undefined ? at(0) : o.lastSeenAt, address: o.address ?? "http://192.168.1.23:47811", ...(o.of ? { of: o.of } : {}) });
  const A = "dv_aaaaaaaaaaaaaaaa";
  const I = "dv_iiiiiiiiiiiiiiii";
  const B = "dv_bbbbbbbbbbbbbbbb";
  const O = "dv_oooooooooooooooo";
  const list = [dev(A, { lastSeenAt: at(0) }), dev(I, { of: A, lastSeenAt: at(60_000) }), dev(B, { lastSeenAt: null, address: "http://LHOTA-PC.local:47811" }), dev(O, { of: "dv_zzzzzzzzzzzzzzzz", address: "http://192.168.1.77:47811" })];
  const rows = deviceRows(list, T0 + DEVICE_CONNECTED_MS + 1, ["192.168.1.23:47811", "lhota-pc.local:47811"]);
  assert.deepEqual(rows.map((r) => [r.id, r.connected, r.lastSeenAt, r.home, r.stale]), [
    [A, true, at(60_000), true, false],
    [B, false, null, false, false],
    [O, false, at(0), false, true],
  ]);
  assert.deepEqual(Object.keys(rows[0]!).sort(), ["connected", "home", "id", "kind", "lastSeenAt", "name", "pairedAt", "stale", "via"]);
  assert.ok(deviceRows(list, T0, []).every((r) => !r.stale), "no address known: none stale");

  const before = deviceRows(list, T0 + 1000);
  const after = deviceRows([dev(A, { name: "Лхота", lastSeenAt: at(0) }), dev(I, { of: A }), dev(B, { lastSeenAt: at(500) }), dev("dv_nnnnnnnnnnnnnnnn")], T0 + DEVICE_CONNECTED_MS + 100);
  assert.deepEqual(deviceEvents(before, after, at(5)).map((e) => [e.what, e.id, e.name]), [
    ["renamed", A, "Лхота"],
    ["gone", A, "Лхота"],
    ["connected", B, "Telefon"],
    ["paired", "dv_nnnnnnnnnnnnnnnn", "Telefon"],
    ["unpaired", O, "Telefon"],
  ]);
  assert.deepEqual(deviceEvents(before, before, at(5)), []);
  assert.deepEqual(deviceEvents(before, after, at(5))[0], { type: "device", what: "renamed", id: A, name: "Лхота", kind: "phone", at: at(5) });
});

test("the device a request of the gateway names (X-Strom-Device): its row — an icon of a home screen as its device; none while off, none of an id not paired", () => {
  const s = scratch();
  try {
    const qr = devicePairCode(s.env, {}, () => T0);
    const parent = pairDevice(s.env, { pairId: qr.pairId, proof: proofOf(qr), name: "Telefon Lhotáků".normalize("NFD"), kind: "phone", address: "http://192.168.1.23:47811" }, () => T0);
    assert.ok(parent.ok);
    const c = deviceCode(s.env, parent.device, "home", () => T0);
    const icon = pairDevice(s.env, { pairId: c.id, proof: proofOf({ pairId: c.id, secret: c.secret }), address: "http://192.168.1.23:47811" }, () => T0);
    assert.ok(icon.ok);
    // off (devices.mode not on): nobody
    assert.equal(clientOfDevice(s.env, parent.device.id), undefined);
    fs.writeFileSync(path.join(s.dir, "config.json"), JSON.stringify({ devicesMode: "on" }));
    const row = { id: parent.device.id, name: "Telefon Lhotáků" };
    assert.deepEqual(clientOfDevice(s.env, parent.device.id), row);
    assert.deepEqual(clientOfDevice(s.env, icon.device.id), row, "the icon as its device");
    renameDevice(s.env, parent.device.id, "Телефон");
    assert.deepEqual(clientOfDevice(s.env, icon.device.id), { id: parent.device.id, name: "Телефон" });
    for (const other of ["dv_bbbbbbbbbbbbbbbb", "", undefined, ["x"], 42]) assert.equal(clientOfDevice(s.env, other), undefined, String(other));
  } finally {
    s.done();
  }
});
