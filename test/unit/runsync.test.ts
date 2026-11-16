// A short command run to its end (core/runsync.ts): an npm launcher on Windows goes through cmd.exe verbatim, never
// node's shell option (DEP0190 in a reader's output); at its time limit everything it started is ended — a launcher's
// node too, not cmd.exe alone (K040, Windows). Where the platform allows: a real process tree.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "../helpers.ts";
import { cmdQuote, isLauncher, runSync, startOf } from "../../src/core/runsync.ts";

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function gone(pid: number, ms = 5000): Promise<boolean> {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 100))) if (!alive(pid)) return true;
  return false;
}

test("a Windows launcher goes through cmd.exe, its line one verbatim argument; anything else as it is", () => {
  assert.equal(isLauncher("C:\\npm\\claude.cmd", "win32"), true);
  assert.equal(isLauncher("C:\\npm\\CLAUDE.BAT", "win32"), true);
  assert.equal(isLauncher("C:\\npm\\claude.exe", "win32"), false);
  assert.equal(isLauncher("/usr/local/bin/claude.cmd", "darwin"), false);
  const s = startOf("C:\\Program Files\\nodejs\\claude.cmd", ["auth", "status", "Lhoták & syn"], { ComSpec: "C:\\Windows\\system32\\cmd.exe" }, "win32");
  assert.deepEqual(s, {
    file: "C:\\Windows\\system32\\cmd.exe",
    args: ["/d", "/s", "/c", '""C:\\Program Files\\nodejs\\claude.cmd" auth status "Lhoták & syn""'],
    verbatim: true,
  });
  assert.equal(startOf("claude.cmd", ["x"], {}, "win32").file, "cmd.exe");
  assert.deepEqual(startOf("/usr/bin/claude", ["auth", "status"], {}, "linux"), { file: "/usr/bin/claude", args: ["auth", "status"], verbatim: false });
  assert.equal(cmdQuote('a "b"'), '"a ""b"""');
  assert.equal(cmdQuote("--version"), "--version");
});

test("no command of strom is started with node's shell option (DEP0190)", () => {
  const src = path.join(import.meta.dirname, "..", "..", "src");
  const found: string[] = [];
  for (const f of fs.readdirSync(src, { recursive: true, encoding: "utf8" }))
    if (f.endsWith(".ts") && /\b(?:spawn|spawnSync|execFile|execFileSync)\([^;]*(?:\bshell:\s*(?!["'])|[{,]\s*shell\s*[,}])/u.test(fs.readFileSync(path.join(src, f), "utf8"))) found.push(f);
  assert.deepEqual(found, []);
});

test("its output passed on and its exit said, under the watchdog too", () => {
  for (const wholeTree of [false, true]) {
    const r = runSync(process.execPath, ["-e", "console.log(JSON.stringify({loggedIn:true, name:'Václav Лхотак'})); process.exit(3)"], { env: process.env, timeout: 10_000, wholeTree });
    assert.equal(r.status, 3, `wholeTree ${wholeTree}`);
    assert.deepEqual(JSON.parse(r.stdout.trim()), { loggedIn: true, name: "Václav Лхотак" });
    assert.equal(r.timedOut, false);
  }
  const missing = runSync(path.join(os.tmpdir(), "no-such-program-of-strom"), [], { env: process.env, timeout: 2000, wholeTree: true });
  assert.equal(missing.stdout, "");
  assert.notEqual(missing.status, 0);
});

/** A program that starts a child of its own (as a launcher starts node) which writes its pid and waits forever. */
function treeScript(dir: string): { script: string; pidFile: string } {
  const pidFile = path.join(dir, "child.pid");
  const child = path.join(dir, "child.js");
  fs.writeFileSync(child, `require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`);
  const script = path.join(dir, "parent.js");
  fs.writeFileSync(script, `require("node:child_process").spawn(process.execPath, [${JSON.stringify(child)}], { stdio: "ignore" }); setInterval(() => {}, 1000);`);
  return { script, pidFile };
}

test("at its time limit everything it started is ended (its own process group)", { skip: process.platform === "win32" }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-runsync-"));
  try {
    const { script, pidFile } = treeScript(dir);
    const r = runSync(process.execPath, [script], { env: process.env, timeout: 1500, wholeTree: true });
    assert.equal(r.timedOut, true);
    const pid = Number(fs.readFileSync(pidFile, "utf8"));
    assert.ok(await gone(pid), "the child it started ended too");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Windows: a .cmd launcher out of time leaves no node running (K040)", { skip: process.platform !== "win32" }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-runsync-"));
  try {
    const { script, pidFile } = treeScript(dir);
    const launcher = path.join(dir, "agent.cmd");
    fs.writeFileSync(launcher, `@"${process.execPath}" "${script}" %*\r\n`);
    const r = runSync(launcher, ["auth", "status"], { env: process.env, timeout: 3000 });
    assert.equal(r.timedOut, true);
    const pid = Number(fs.readFileSync(pidFile, "utf8"));
    assert.ok(await gone(pid), "the launcher's node and what it started ended");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
