// The Strom app installed from Chrome or Edge on Windows (T25): found by its shortcut — the Start menu or the desktop —
// with its id and profile read from the shortcut as Windows writes it, so that strom opens the research in the app's
// own window and not in a tab of the browser. A shortcut keeps its strings wherever the parts before them end: at an
// odd byte as often as not (the program's path, the person's name in it), and read as UTF-16 from the file's start
// they were lost.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World } from "../helpers.ts";
import { installedStromApp, lnkText } from "../../src/core/stromapp.ts";
import { appWindow, openAppIn } from "../../src/core/appbrowser.ts";
import { Settings } from "../../src/core/config.ts";

const ID = "gggninmgbfdjkafhnhdnaaaopeicjmjo";

/** A shell link (MS-SHLLINK) as a browser writes it: its target in LinkInfo, the arguments and the icon in UTF-16. */
function lnk(target: string, args: string, icon: string, opts: { idList?: number } = {}): Buffer {
  const header = Buffer.alloc(76);
  header.writeUInt32LE(0x4c, 0);
  const hasIdList = opts.idList !== undefined;
  header.writeUInt32LE((hasIdList ? 0x01 : 0) | 0x02 | 0x20 | 0x40 | 0x80, 20);
  const parts: Buffer[] = [header];
  if (hasIdList) {
    const ids = Buffer.alloc(2 + opts.idList!);
    ids.writeUInt16LE(opts.idList!, 0);
    parts.push(ids);
  }
  // LinkInfo: header 0x1C, VolumeIDAndLocalBasePath, the path in ANSI, an empty common suffix
  const local = Buffer.from(target + "\0", "latin1");
  const info = Buffer.alloc(0x1c);
  const size = 0x1c + local.length + 1;
  info.writeUInt32LE(size, 0);
  info.writeUInt32LE(0x1c, 4);
  info.writeUInt32LE(1, 8);
  info.writeUInt32LE(0x1c, 16);
  info.writeUInt32LE(0x1c + local.length, 24);
  parts.push(info, local, Buffer.from([0]));
  for (const s of [args, icon]) {
    const n = Buffer.alloc(2);
    n.writeUInt16LE(s.length, 0);
    parts.push(n, Buffer.from(s, "utf16le"));
  }
  return Buffer.concat(parts);
}

function windows(w: World, user: string) {
  const home = path.join(w.dir, user);
  const env = {
    ...w.env,
    HOME: home,
    USERPROFILE: home,
    APPDATA: path.join(home, "AppData", "Roaming"),
    LOCALAPPDATA: path.join(home, "AppData", "Local"),
    OneDrive: undefined,
  };
  const programs = path.join(env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs");
  return { home, env, programs };
}

test("T25: the Strom app installed from Chrome on Windows (arm64 or x64) is found with its id at either alignment of the shortcut", () => {
  const w = new World();
  // Chrome per machine (Program Files — x64 and arm64 alike) and per user (the person's name in the path): four
  // lengths, two of them odd, the IDList of a byte more or less as well
  const cases: [string, string, number | undefined][] = [
    ["Jan", "C:\\Program Files\\Google\\Chrome\\Application\\chrome_proxy.exe", undefined],
    ["Jana", "C:\\Program Files\\Google\\Chrome\\Application\\chrome_proxy.exe", 25],
    ["Petr", "C:\\Users\\Petr\\AppData\\Local\\Google\\Chrome\\Application\\chrome_proxy.exe", undefined],
    ["Pavel", "C:\\Users\\Pavel\\AppData\\Local\\Google\\Chrome\\Application\\chrome_proxy.exe", 24],
  ];
  for (const [user, target, idList] of cases) {
    const { env, programs } = windows(w, user);
    const dir = path.join(programs, "Chrome Apps");
    fs.mkdirSync(dir, { recursive: true });
    const icon = `C:\\Users\\${user}\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 1\\Web Applications\\_crx_${ID}\\Strom - Family Tree.ico`;
    fs.writeFileSync(path.join(dir, "Strom - Family Tree.lnk"), lnk(target, `--profile-directory="Profile 1" --app-id=${ID}`, icon, { idList }));
    assert.deepEqual(
      installedStromApp(env, "win32"),
      { path: path.join(dir, "Strom - Family Tree.lnk"), kind: "Chrome App", browser: "Google Chrome", appId: ID, profile: "Profile 1" },
      `${user}: ${target}`,
    );
  }
  w.cleanup();
});

test("T25: an app of Edge in the Start menu itself, a shortcut on the desktop only, an id only in its icon", () => {
  const w = new World();
  const { env, programs, home } = windows(w, "Eva");
  fs.mkdirSync(programs, { recursive: true });
  // Edge puts its apps into Programs itself: the browser is the one the shortcut starts, not Chrome
  fs.writeFileSync(path.join(programs, "Strom - Family Tree.lnk"), lnk("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge_proxy.exe", `--profile-directory=Default --app-id=${ID}`, "C:\\x.ico"));
  assert.deepEqual(installedStromApp(env, "win32"), { path: path.join(programs, "Strom - Family Tree.lnk"), kind: "Edge App", browser: "Microsoft Edge", appId: ID, profile: "Default" });
  fs.rmSync(path.join(programs, "Strom - Family Tree.lnk"));
  // only on the desktop, its arguments without the id: the icon's folder says it (and the profile)
  const desk = path.join(home, "Desktop");
  fs.mkdirSync(desk, { recursive: true });
  fs.writeFileSync(path.join(desk, "Strom research.lnk"), lnk("C:\\strom\\strom.cmd", "", "C:\\strom\\strom.ico"));
  fs.writeFileSync(
    path.join(desk, "Strom - Family Tree.lnk"),
    lnk("C:\\Program Files\\Google\\Chrome\\Application\\chrome_proxy.exe", "", `C:\\Users\\Eva\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Web Applications\\_crx_${ID}\\Strom.ico`),
  );
  assert.deepEqual(installedStromApp(env, "win32"), { path: path.join(desk, "Strom - Family Tree.lnk"), kind: "Chrome App", browser: "Google Chrome", appId: ID, profile: "Default" });
  // the bytes of a shortcut cut short are read as far as they go
  assert.match(lnkText(lnk("C:\\a.exe", `--app-id=${ID}`, "").subarray(0, 120)), /C:\\a\.exe/);
  w.cleanup();
});

test("T25: with the app installed from the default browser, strom app opens its own window, not a tab", () => {
  const w = new World();
  const { env: base, programs } = windows(w, "Jan");
  const exes = path.join(w.dir, "Program Files");
  fs.mkdirSync(exes, { recursive: true });
  for (const f of ["chrome.exe", "msedge.exe"]) fs.writeFileSync(path.join(exes, f), "");
  const dir = path.join(programs, "Chrome Apps");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "Strom - Family Tree.lnk"), lnk("C:\\Program Files\\Google\\Chrome\\Application\\chrome_proxy.exe", `--profile-directory=Default --app-id=${ID}`, "C:\\x.ico"));
  const env = { ...base, STROM_APP_DIRS: exes, STROM_DEFAULT_BROWSER: "chrome" };
  const win = appWindow(new Settings(env, {}), env, "win32");
  assert.equal(win.browser?.name, "Google Chrome");
  assert.deepEqual(win.webApp, { browser: "Google Chrome", appId: ID, profile: "Default" });
  w.cleanup();
});

test("T25: the Strom app installed from Chrome opens in its own window although the default browser is Edge (or not read: Edge assumed) — installed app first, always", () => {
  const w = new World();
  const { env: base, programs } = windows(w, "Jan");
  const exes = path.join(w.dir, "Program Files");
  fs.mkdirSync(exes, { recursive: true });
  for (const f of ["chrome.exe", "msedge.exe"]) fs.writeFileSync(path.join(exes, f), "");
  const dir = path.join(programs, "Chrome Apps");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "Strom - Family Tree.lnk"), lnk("C:\\Program Files\\Google\\Chrome\\Application\\chrome_proxy.exe", `--profile-directory=Default --app-id=${ID}`, "C:\\x.ico"));
  const env = { ...base, STROM_APP_DIRS: exes, STROM_DEFAULT_BROWSER: "edge" };
  const win = appWindow(new Settings(env, {}), env, "win32");
  assert.equal(win.browser?.name, "Google Chrome");
  assert.deepEqual(win.webApp, { browser: "Google Chrome", appId: ID, profile: "Default" });
  // opened: the app's own window first (openAppIn's via "app")
  const opened = openAppIn(win, "https://stromapp.info/?live=x", env, (app) => app.browser === "Google Chrome");
  assert.deepEqual(opened, { opened: true, via: "app" });
  // the tree came from Edge (app.browser) and Edge has no app of it: the app installed from Chrome still
  const kept = appWindow(new Settings(env, {}, { appBrowser: "edge" }), env, "win32");
  assert.equal(kept.webApp?.browser, "Google Chrome");
  // a tree handed over from Edge (?adopt=) waits in Edge's storage: Edge's tab
  const adopt = appWindow(new Settings(env, {}, { appBrowser: "edge" }), env, "win32", { holdsTree: true });
  assert.equal(adopt.browser?.name, "Microsoft Edge");
  assert.equal(adopt.webApp, undefined);
  w.cleanup();
});
