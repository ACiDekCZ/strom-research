// macOS: an address for the installed Strom app goes to the Chromium browser running through its own socket (as the
// browser's second start would hand it over), with no program started — such a program stays in the Dock's recent
// apps as the browser not running. Not taken: the browser's program as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { handToRunning, openWebApp, singletonMessage } from "../../src/core/chromium.ts";

const unix = process.platform !== "win32";

/** A stand-in for the browser running: listens on the socket, writes what came, answers `reply` (none: never answers). */
async function fakeBrowser(socket: string, out: string, reply: string | null): Promise<ChildProcess> {
  const code = `const net=require("node:net"),fs=require("node:fs");const [sock,out,reply]=process.argv.slice(1);
const srv=net.createServer({allowHalfOpen:true},(c)=>{let got=Buffer.alloc(0);c.on("data",(d)=>{got=Buffer.concat([got,d])});
c.on("end",()=>{fs.writeFileSync(out,got);if(reply!=="-")c.end(reply)})});
srv.listen(sock,()=>process.stdout.write("ready\\n"));setTimeout(()=>process.exit(0),20000);`;
  const child = spawn(process.execPath, ["-e", code, socket, out, reply ?? "-"], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise<void>((resolve, reject) => {
    child.stdout!.on("data", (d: Buffer) => d.toString().includes("ready") && resolve());
    child.on("exit", () => reject(new Error("the stand-in browser ended")));
  });
  return child;
}

/** A home with "Google Chrome" whose program only notes it was started, its user data with the socket's link. */
function setup(): { home: string; marker: string; socket: string; out: string; env: Record<string, string> } {
  // short: a socket's path has a limit (104 bytes on macOS)
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "strs-"));
  const apps = path.join(home, "Apps");
  const exeDir = path.join(apps, "Google Chrome.app", "Contents", "MacOS");
  fs.mkdirSync(exeDir, { recursive: true });
  const marker = path.join(home, "started");
  fs.writeFileSync(path.join(exeDir, "Google Chrome"), `#!/bin/sh\necho "$@" > "${marker}"\n`, { mode: 0o755 });
  const ud = path.join(home, "Library", "Application Support", "Google", "Chrome");
  fs.mkdirSync(ud, { recursive: true });
  const socket = path.join(home, "s");
  fs.symlinkSync(socket, path.join(ud, "SingletonSocket"));
  return { home, marker, socket, out: path.join(home, "got"), env: { HOME: home, STROM_APP_DIRS: apps } };
}

async function startedSoon(marker: string): Promise<boolean> {
  for (let i = 0; i < 40; i++) {
    if (fs.existsSync(marker)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

test("the message a second start of the browser sends: START, the folder, the command line, NUL between", () => {
  assert.equal(singletonMessage(["/A/B", "--app-id=x", "--u=https://a.example/?q=Řehoř"], "/"), "START\0/\0/A/B\0--app-id=x\0--u=https://a.example/?q=Řehoř");
});

test("no socket: not handed over, at once", () => {
  const t = Date.now();
  assert.equal(handToRunning(path.join(os.tmpdir(), "no-such-strom-socket"), ["x"]), false);
  assert.ok(Date.now() - t < 1000);
});

test("macOS, the browser running: the app's address goes through its socket and no program starts (no Dock icon)", { skip: !unix }, async () => {
  const s = setup();
  const browser = await fakeBrowser(s.socket, s.out, "ACK");
  try {
    const url = "https://app.example/run/?live=http%3A%2F%2F127.0.0.1%3A4000%2Fk%2F&lang=cs";
    assert.equal(openWebApp({ browser: "Google Chrome", appId: "a".repeat(32), profile: "Profile 3" }, url, s.env, "darwin"), true);
    const exe = path.join(s.env.STROM_APP_DIRS!, "Google Chrome.app", "Contents", "MacOS", "Google Chrome");
    assert.equal(fs.readFileSync(s.out, "utf8"), singletonMessage([exe, "--profile-directory=Profile 3", `--app-id=${"a".repeat(32)}`, `--app-launch-url-for-shortcuts-menu-item=${url}`]));
    assert.equal(await startedSoon(s.marker), false, "the browser's program was started");
  } finally {
    browser.kill();
    fs.rmSync(s.home, { recursive: true, force: true });
  }
});

test("macOS, the browser shutting down or not running: its program as before", { skip: !unix }, async () => {
  const s = setup();
  const browser = await fakeBrowser(s.socket, s.out, "SHUTDOWN");
  try {
    assert.equal(openWebApp({ browser: "Google Chrome", appId: "b".repeat(32) }, "https://app.example/run/?import-url=x", s.env, "darwin"), true);
    assert.equal(await startedSoon(s.marker), true);
    assert.match(fs.readFileSync(s.marker, "utf8"), /--app-id=b{32} --app-launch-url-for-shortcuts-menu-item=https:\/\/app\.example\/run\/\?import-url=x/);
  } finally {
    browser.kill();
  }
  // nobody listens (the link left by a browser that ended)
  fs.rmSync(s.marker);
  assert.equal(openWebApp({ browser: "Google Chrome", appId: "b".repeat(32) }, "https://app.example/run/", s.env, "darwin"), true);
  assert.equal(await startedSoon(s.marker), true);
  fs.rmSync(s.home, { recursive: true, force: true });
});

test("a browser that never answers: not handed over within the time given", { skip: !unix }, async () => {
  const s = setup();
  const browser = await fakeBrowser(s.socket, s.out, null);
  try {
    const t = Date.now();
    assert.equal(handToRunning(path.join(s.home, "Library", "Application Support", "Google", "Chrome", "SingletonSocket"), ["x"], 800), false);
    assert.ok(Date.now() - t < 5000);
  } finally {
    browser.kill();
    fs.rmSync(s.home, { recursive: true, force: true });
  }
});
