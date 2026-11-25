// This computer's caches for the other devices of the home network kept in order unasked (spec 094 U9c): what a device
// was sending and did not finish goes after a day whatever devices.mode is (the bytes as they came, no longer sealed);
// the copies of the app for the devices beyond the one served and the newest other, and what a download that ended
// left, only while devices.mode is on and never while it is being downloaded. Never a link, never anything else in
// their folders, never anything outside; strom tidy says nothing of either (devices.mode off as on), a dry run takes
// nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { autoTidy, tidyDevices } from "../../src/core/tidy.ts";
import { Tree } from "../../src/core/tree.ts";

const opts = { skip: !hasGit };
const HOUR = 3600_000;
/** The clock of the test: noon, never midnight. */
const AT = Date.parse("2026-11-20T12:00:00.000Z");
const DEV = "dv_abcdefghijklmnop";
const SHA = (c: string) => c.repeat(64);

/** A file (a folder for null) last touched this many hours before `at`. */
function aged(p: string, hours: number, at = AT, content: string | null = "x"): string {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (content === null) fs.mkdirSync(p, { recursive: true });
  else fs.writeFileSync(p, content);
  const t = new Date(at - hours * HOUR);
  fs.utimesSync(p, t, t);
  return p;
}

const exists = (p: string) => {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
};

/** A process id no process has now (one just ended). */
const deadPid = () => spawnSync(process.execPath, ["-e", ""]).pid!;

async function world(): Promise<{ w: World; shared: string; outside: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const shared = path.join(w.home, "shared");
  assert.ok(fs.statSync(shared).isDirectory());
  const outside = path.join(w.dir, "venku");
  fs.mkdirSync(outside, { recursive: true });
  return { w, shared, outside };
}

/** Uploads of a device: a pair old, a pair one half new, halves without a pair, a fresh one, what is not an upload, links. */
function uploads(shared: string, outside: string, at = AT) {
  const up = path.join(shared, "device-uploads");
  const dev = (...p: string[]) => path.join(up, DEV, ...p);
  const p = {
    oldPair: [aged(dev(`${SHA("a")}.part`), 30, at), aged(dev(`${SHA("a")}.json`), 25, at)],
    halfNew: [aged(dev(`${SHA("b")}.part`), 30, at), aged(dev(`${SHA("b")}.json`), 2, at)],
    orphanOld: aged(dev(`${SHA("c")}.json`), 48, at),
    orphanPartOld: aged(dev(`${SHA("d")}.part`), 48, at),
    fresh: aged(dev(`${SHA("e")}.part`), 1, at),
    notUpload: aged(dev("Poznámka Лгота.txt"), 100, at),
    notDevice: aged(path.join(up, "jiné", `${SHA("f")}.part`), 100, at),
    emptyOld: aged(path.join(up, "dv_bbbbbbbbbbbbbbbb"), 5, at, null),
    emptyNew: aged(path.join(up, "dv_cccccccccccccccc"), 0, at, null),
    outsideFile: aged(path.join(outside, `${SHA("1")}.part`), 100, at),
    outsideDir: aged(path.join(outside, "zařízení", `${SHA("2")}.part`), 100, at),
    linkFile: dev(`${SHA("3")}.part`),
    linkDir: path.join(up, "dv_dddddddddddddddd"),
  };
  fs.symlinkSync(p.outsideFile, p.linkFile);
  fs.symlinkSync(path.dirname(p.outsideDir), p.linkDir);
  return p;
}

test("a device's unfinished uploads go after a day, a pair by its newer half, whatever devices.mode is; never a link, nothing else, nothing outside", opts, async () => {
  const { w, shared, outside } = await world();
  try {
    const u = uploads(shared, outside);
    const r = tidyDevices(w.env, AT); // devices.mode off (never set)
    for (const f of [...u.oldPair, u.orphanOld, u.orphanPartOld]) assert.equal(exists(f), false, f);
    for (const f of [...u.halfNew, u.fresh, u.notUpload, u.notDevice, u.emptyNew, u.outsideFile, u.outsideDir, u.linkFile, u.linkDir]) assert.equal(exists(f), true, f);
    assert.equal(exists(u.emptyOld), false, "an empty device folder untouched for a while");
    assert.equal(fs.readlinkSync(u.linkFile), u.outsideFile);
    assert.equal(r.removed, 4);
    // the next day the rest of the pair goes, the device's folder stays while something is in it
    const later = tidyDevices(w.env, AT + 2 * 24 * HOUR);
    for (const f of [...u.halfNew, u.fresh]) assert.equal(exists(f), false, f);
    assert.equal(later.removed, 3);
    assert.equal(exists(path.join(shared, "device-uploads", DEV)), true);
    assert.equal(exists(u.notUpload), true);
  } finally {
    w.cleanup();
  }
});

test("a link for the uploads' folder or the app's: nothing in it touched", opts, async () => {
  const { w, shared, outside } = await world();
  try {
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    const old = aged(path.join(outside, DEV, `${SHA("a")}.part`), 100);
    const app = aged(path.join(outside, "app", "3.1.0", "index.html"), 100);
    aged(path.join(outside, "app", "3.2.0", "index.html"), 100);
    aged(path.join(outside, "app", "3.3.0", "index.html"), 100);
    fs.symlinkSync(outside, path.join(shared, "device-uploads"));
    fs.symlinkSync(path.join(outside, "app"), path.join(shared, "device-app"));
    assert.deepEqual(tidyDevices(w.env, AT), { removed: 0, freed: 0 });
    assert.equal(exists(old), true);
    assert.equal(exists(app), true);
  } finally {
    w.cleanup();
  }
});

/** Copies of the app for the devices: 3.2.0 served (device-app.json), others older and newer, leftovers of downloads, a link. */
function apps(w: World, shared: string, outside: string) {
  const root = path.join(shared, "device-app");
  const v = (n: string) => aged(path.join(root, n, "index.html"), 100);
  for (const n of ["3.1.0", "3.2.0", "3.3.0", "3.4.0", "3.10.0"]) v(n);
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "device-app.json"), JSON.stringify({ version: "3.2.0" }));
  const linked = aged(path.join(outside, "3.0.0", "index.html"), 100);
  fs.symlinkSync(path.dirname(linked), path.join(root, "3.0.0"));
  const dead = deadPid();
  return {
    root,
    linked,
    tmpDead: aged(path.join(root, `.tmp-${dead}-0a1b2c3d`), 2, AT, null),
    oldDead: aged(path.join(root, `.old-${dead}-0a1b2c3e`), 2, AT, null),
    tmpLive: aged(path.join(root, `.tmp-${process.pid}-0a1b2c3f`), 2, AT, null),
    tmpNew: aged(path.join(root, `.tmp-${dead}-0a1b2c40`), 0, AT, null),
    other: aged(path.join(root, "README Лгота.txt"), 100),
  };
}

test("the app's copies: with devices.mode on the one served and the newest other kept, a download's leftovers gone once it ended; off, or while a download runs, untouched", opts, async () => {
  const { w, shared, outside } = await world();
  try {
    const a = apps(w, shared, outside);
    const have = () => fs.readdirSync(a.root).sort();
    const all = have();
    // off: nothing of the app touched
    tidyDevices(w.env, AT);
    assert.deepEqual(have(), all);
    // on, but being downloaded: untouched
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    const lock = path.join(w.env.STROM_CONFIG_DIR!, "device-app.fetch.lock");
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "the app for the devices downloaded" }));
    tidyDevices(w.env, AT);
    assert.deepEqual(have(), all);
    fs.rmSync(lock, { force: true });
    // on: the one served (3.2.0) and the newest other (3.10.0), a link, what is not the app's, a download running or just ended
    const r = tidyDevices(w.env, AT);
    assert.deepEqual(have(), [path.basename(a.tmpLive), path.basename(a.tmpNew), "3.0.0", "3.10.0", "3.2.0", "README Лгота.txt"].sort());
    assert.equal(r.removed, 5);
    assert.equal(exists(a.linked), true);
  } finally {
    w.cleanup();
  }
});

test("strom tidy keeps the devices' caches in order and says nothing of them (devices.mode off as on); a dry run takes nothing", opts, async () => {
  const { w, shared, outside } = await world();
  try {
    const now = Date.now();
    const u = uploads(shared, outside, now);
    const plain = (s: string) => assert.doesNotMatch(s, /device|zařízení|Gerät|urządz|upload|nahráv/iu, s);
    const dry = await w.ok(["tidy", "--dry-run"]);
    plain(dry.out);
    assert.equal(exists(u.oldPair[0]!), true, "a dry run takes nothing");
    for (const mode of ["off", "on"]) {
      if (mode === "on") {
        await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
        aged(u.oldPair[0]!, 30, now);
      }
      const r = await w.ok(["tidy"]);
      plain(r.out);
      plain((await w.ok(["tidy", "--json"])).out);
      assert.equal(exists(u.oldPair[0]!), false, mode);
      assert.equal(exists(u.fresh), true, mode);
      assert.equal(exists(u.outsideFile), true, mode);
    }
  } finally {
    w.cleanup();
  }
});

test("by itself (after a session, once a day by the bridge): the same, its tree's tidy.log says it in plain words", opts, async () => {
  const { w, shared, outside } = await world();
  try {
    const now = Date.now();
    const u = uploads(shared, outside, now);
    const root = w.treeDir("Lhotákovi");
    autoTidy(Tree.open(root, w.env));
    assert.equal(exists(u.oldPair[0]!), false);
    assert.equal(exists(u.fresh), true);
    const log = fs.readFileSync(path.join(root, ".strom", "tidy.log"), "utf8");
    assert.match(log, /this computer's caches\): 4 removed/);
    assert.doesNotMatch(log, /device|upload/i);
  } finally {
    w.cleanup();
  }
});
