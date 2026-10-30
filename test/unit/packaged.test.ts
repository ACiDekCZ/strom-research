// An app packaged for Windows (MSIX) and strom: the settings of before taken over, the private copies found, an update
// started from the app told apart by a file it makes (Windows' redirection stood for by the writer).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { privateCopies, writesPrivately } from "../../src/core/packaged.ts";
import { oldKeys, oldSettingsDirs, packagedSettingsPattern, takeOverOldSettings } from "../../src/core/oldsettings.ts";
import type { Installation } from "../../src/core/self.ts";

const inst = { kind: "installed", root: "x" } as Installation;

function windows() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-packaged-"));
  const local = path.join(dir, "AppData", "Local");
  const roaming = path.join(dir, "AppData", "Roaming");
  const program = path.join(local, "Programs", "Strom");
  const app = path.join(local, "Packages", "Lhota.App_abc");
  fs.mkdirSync(program, { recursive: true });
  fs.mkdirSync(path.join(app, "LocalCache", "Roaming"), { recursive: true });
  const env = { USERPROFILE: dir, LOCALAPPDATA: local, APPDATA: roaming };
  return { dir, local, roaming, program, app, env };
}

test("an update from a packaged app is told apart by the file it makes; a terminal's is not", () => {
  const w = windows();
  // the terminal: the file lands where it was made
  assert.equal(writesPrivately(w.env, w.program, "win32", inst), false);
  assert.deepEqual(fs.readdirSync(w.program), [], "the probe is gone");
  // the packaged app: Windows puts it into the app's copy
  const copy = path.join(w.app, "LocalCache", "Local", "Programs", "Strom");
  const redirected = (file: string) => {
    fs.mkdirSync(copy, { recursive: true });
    fs.writeFileSync(path.join(copy, path.basename(file)), "");
  };
  assert.equal(writesPrivately(w.env, w.program, "win32", inst, redirected), true);
  assert.deepEqual(fs.readdirSync(copy), [], "the probe is gone from the copy too");
  // seen from the terminal: the copy the app made for itself
  assert.deepEqual(privateCopies(w.env, w.program, "win32"), [copy]);
  // never off Windows, never a folder outside AppData
  assert.equal(writesPrivately(w.env, w.program, "darwin", inst, redirected), false);
  assert.equal(writesPrivately(w.env, path.join(w.dir, "elsewhere"), "win32", inst, redirected), false);
  assert.deepEqual(privateCopies(w.env, w.program, "linux"), []);
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("the settings of before: %APPDATA%\\strom and each app's copy, taken over once, the keys left for their research", () => {
  const w = windows();
  const real = path.join(w.roaming, "strom");
  const copy = path.join(w.app, "LocalCache", "Roaming", "strom");
  for (const [d, key] of [[real, "aa"], [copy, "bb"]] as const) {
    fs.mkdirSync(path.join(d, "keys"), { recursive: true });
    fs.writeFileSync(path.join(d, "keys", "T1.key"), key);
    fs.writeFileSync(path.join(d, "config.json"), JSON.stringify({ from: d === real ? "terminal" : "app" }));
  }
  fs.writeFileSync(path.join(copy, "logins.json"), "{}");
  fs.writeFileSync(path.join(real, "config.json.tmp"), "half");
  assert.deepEqual(oldSettingsDirs(w.env, "win32", inst), [real, copy]);
  // with settings of their own: none
  assert.deepEqual(oldSettingsDirs({ ...w.env, STROM_CONFIG_DIR: path.join(w.dir, "own") }, "win32", inst), []);
  // macOS and Linux: nothing of before, nothing taken over
  assert.deepEqual(oldSettingsDirs(w.env, "darwin", inst), []);
  assert.deepEqual(oldSettingsDirs(w.env, "linux", inst), []);
  assert.equal(takeOverOldSettings(w.env, "linux", inst), undefined);
  const now = path.join(w.dir, ".config", "strom");
  assert.equal(takeOverOldSettings(w.env, "win32", inst), real);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(now, "config.json"), "utf8")), { from: "terminal" }, "the terminal's word kept");
  assert.ok(fs.existsSync(path.join(now, "logins.json")), "what only the app's copy had");
  assert.ok(!fs.existsSync(path.join(now, "keys")), "the keys are taken one by one");
  assert.ok(!fs.existsSync(path.join(now, "config.json.tmp")));
  // never moved: an older strom reads them still; taken once
  assert.ok(fs.existsSync(path.join(real, "config.json")) && fs.existsSync(path.join(copy, "config.json")));
  assert.equal(takeOverOldSettings(w.env, "win32", inst), undefined);
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("the old keys of a research: each different one once, the first seen first", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-oldkeys-"));
  const [a, b, c] = ["a", "b", "c"].map((n) => path.join(dir, n));
  for (const [d, key] of [[a, "aa"], [b, "aa"], [c, "cc"]] as const) {
    fs.mkdirSync(path.join(d!, "keys"), { recursive: true });
    fs.writeFileSync(path.join(d!, "keys", "T1.key"), `${key}\n`);
  }
  const env = { STROM_TEST_OLD_SETTINGS: [a, b, c, path.join(dir, "none")].join(path.delimiter) };
  const keys = oldKeys(env, "T1", { kind: "source", root: dir } as Installation);
  assert.deepEqual(keys.map((k) => [k.file, k.key.toString("hex")]), [[path.join(a!, "keys", "T1.key"), "aa"], [path.join(c!, "keys", "T1.key"), "cc"]]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("every packaged app's copy of the old settings as one pattern, those made later too; none off Windows or with settings of their own", () => {
  const w = windows();
  assert.equal(packagedSettingsPattern(w.env, "win32", inst), path.join(w.local, "Packages", "*", "LocalCache", "Roaming", "strom"));
  assert.equal(packagedSettingsPattern(w.env, "darwin", inst), undefined);
  assert.equal(packagedSettingsPattern(w.env, "linux", inst), undefined);
  assert.equal(packagedSettingsPattern({ ...w.env, STROM_CONFIG_DIR: w.dir }, "win32", inst), undefined);
  fs.rmSync(w.dir, { recursive: true, force: true });
});
