// What a device of the home network has sent of a large file so far (src/core/device-uploads.ts): its path made of the
// device's id and the hash alone, its note read tolerantly, written whole and the user's alone; dropped one by one and
// by device; swept — a device not paired any more, a day untouched, a half without its other half — never one being
// sent, never anything of another shape.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { deviceUploadsRoot, dropDeviceUploads, dropUpload, readUpload, sweepUploads, UPLOAD_KEEP_MS, uploadFiles, writeUpload } from "../../src/core/device-uploads.ts";

const A = "dv_aaaaaaaaaaaaaaaa";
const B = "dv_bbbbbbbbbbbbbbbb";
const sha = (c: string) => c.repeat(64);
const NOW = Date.parse("2026-11-24T12:00:00.000Z");

function world() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-uploads-"));
  const env = { HOME: dir, STROM_CONFIG_DIR: path.join(dir, "config"), STROM_SHARED: path.join(dir, "shared Lhoták") } as Record<string, string>;
  return { dir, env, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function put(env: Record<string, string>, d: string, s: string, at: number, blocks = 1, part = true) {
  writeUpload(env, d, s, { size: 2_000_000, blocks, tree: "tr_lhotakovi", at: new Date(at).toISOString() });
  if (part) fs.writeFileSync(uploadFiles(env, d, s).part, Buffer.alloc(blocks * 1024 * 1024));
}

test("an upload's files: <shared>/device-uploads/<device>/<sha>.part and .json — nothing of another shape", () => {
  const w = world();
  try {
    const root = deviceUploadsRoot(w.env);
    assert.equal(root, path.join(w.env.STROM_SHARED!, "device-uploads"));
    const f = uploadFiles(w.env, A, sha("a"));
    assert.deepEqual(f, { dir: path.join(root, A), part: path.join(root, A, `${sha("a")}.part`), note: path.join(root, A, `${sha("a")}.json`) });
    for (const [d, s] of [
      ["../dv_aaaaaaaaaaaaaaaa", sha("a")],
      ["dv_AAAAAAAAAAAAAAAA", sha("a")],
      [A, "../".repeat(21) + "a"],
      [A, sha("A")],
      [A, `${sha("a").slice(0, 63)}/`],
      [A, "ř".repeat(64)],
    ])
      assert.throws(() => uploadFiles(w.env, d!, s!), /not a device's id or a SHA-256/, `${d} ${s}`);
  } finally {
    w.done();
  }
});

test("an upload's note: written whole and the user's alone, read tolerantly; dropped alone, then its device's folder", { skip: process.platform === "win32" }, () => {
  const w = world();
  try {
    assert.equal(readUpload(w.env, A, sha("a")), undefined);
    put(w.env, A, sha("a"), NOW, 1);
    put(w.env, A, sha("b"), NOW, 2);
    assert.deepEqual(readUpload(w.env, A, sha("a")), { size: 2_000_000, blocks: 1, tree: "tr_lhotakovi", at: new Date(NOW).toISOString() });
    const f = uploadFiles(w.env, A, sha("a"));
    assert.equal(fs.statSync(f.note).mode & 0o777, 0o600);
    assert.equal(fs.statSync(f.dir).mode & 0o077, 0);
    // no temporary file left
    assert.deepEqual(fs.readdirSync(f.dir).sort(), [`${sha("a")}.json`, `${sha("a")}.part`, `${sha("b")}.json`, `${sha("b")}.part`]);
    // read tolerantly: anything not of its shape is nothing
    for (const bad of ["{", "[]", JSON.stringify({ size: 0, blocks: 1, tree: "t", at: new Date().toISOString() }), JSON.stringify({ size: 1, blocks: -1, tree: "t", at: new Date().toISOString() }), JSON.stringify({ size: 1, blocks: 1, tree: "t", at: "včera" })]) {
      fs.writeFileSync(f.note, bad);
      assert.equal(readUpload(w.env, A, sha("a")), undefined, bad);
    }
    dropUpload(w.env, A, sha("a"));
    assert.ok(!fs.existsSync(f.part) && !fs.existsSync(f.note));
    assert.ok(fs.existsSync(f.dir), "another file of the device is there still");
    dropUpload(w.env, A, sha("b"));
    assert.ok(!fs.existsSync(f.dir), "the device's folder gone once empty");
    put(w.env, B, sha("c"), NOW);
    dropDeviceUploads(w.env, B);
    assert.ok(!fs.existsSync(uploadFiles(w.env, B, sha("c")).dir));
    // an id of another shape drops nothing
    dropDeviceUploads(w.env, "..");
    assert.ok(fs.existsSync(w.env.STROM_SHARED!));
  } finally {
    w.done();
  }
});

test("swept: a device not paired, a day untouched, a half alone — never one being sent, never what the gateway does not write", () => {
  const w = world();
  try {
    assert.equal(sweepUploads(w.env, { paired: new Set(), now: NOW }), 0, "no folder: nothing");
    const root = deviceUploadsRoot(w.env);
    put(w.env, A, sha("a"), NOW - 3600_000); // fresh
    put(w.env, A, sha("b"), NOW - UPLOAD_KEEP_MS - 1); // a day untouched
    put(w.env, A, sha("c"), NOW - UPLOAD_KEEP_MS - 1); // a day untouched, but being sent now
    put(w.env, A, sha("d"), NOW, 1, false); // its .json alone
    fs.writeFileSync(path.join(root, A, `${sha("e")}.part`), "x"); // its .part alone
    fs.writeFileSync(path.join(root, A, "poznámka Lhoták.txt"), "x"); // not the gateway's
    put(w.env, B, sha("a"), NOW); // a device not paired any more
    fs.mkdirSync(path.join(root, "not-a-device"));
    // often: the devices unpaired and the halves; nothing of age
    assert.equal(sweepUploads(w.env, { paired: new Set([A]), busy: new Set([`${A}/${sha("c")}`]), now: NOW, keepMs: Infinity }), 3);
    assert.ok(!fs.existsSync(path.join(root, B)));
    assert.deepEqual(fs.readdirSync(path.join(root, A)).sort(), [`${sha("a")}.json`, `${sha("a")}.part`, `${sha("b")}.json`, `${sha("b")}.part`, `${sha("c")}.json`, `${sha("c")}.part`, "poznámka Lhoták.txt"].sort());
    // once an hour: a day untouched too — not the one being sent
    assert.equal(sweepUploads(w.env, { paired: new Set([A]), busy: new Set([`${A}/${sha("c")}`]), now: NOW }), 1);
    assert.ok(readUpload(w.env, A, sha("a")) && readUpload(w.env, A, sha("c")) && !readUpload(w.env, A, sha("b")));
    // a device unpaired while one of its files is being sent: its folder stays until it ends
    assert.equal(sweepUploads(w.env, { paired: new Set(), busy: new Set([`${A}/${sha("c")}`]), now: NOW, keepMs: Infinity }), 0);
    assert.ok(fs.existsSync(path.join(root, A)));
    assert.equal(sweepUploads(w.env, { paired: new Set(), now: NOW, keepMs: Infinity }), 1);
    assert.ok(!fs.existsSync(path.join(root, A)));
    assert.ok(fs.existsSync(path.join(root, "not-a-device")), "what the gateway does not write stays");
  } finally {
    w.done();
  }
});
