// A tree an older strom wrote gets the agent files of today (the web hook, the delegate hook, Grok's hooks, the hook
// shims) before any agent strom starts works in it: a conversation (in the terminal or the desktop app's link) and a run.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readJsonFile } from "../helpers.ts";
import { opts, world } from "./session.helpers.ts";

test("an older tree's agent files are refreshed before strom chat (the desktop app's link too) and strom run start an agent", { ...opts, skip: opts.skip || process.platform === "win32" }, async () => {
  const w = await world();
  const settings = path.join(w.cwd, ".claude", "settings.json");
  const grok = path.join(w.cwd, ".grok", "hooks", "strom.json");
  const hookShim = path.join(w.cwd, ".strom", "bin", "strom-hook.cmd");
  const older = () => {
    const s = readJsonFile(settings) as Record<string, unknown>;
    delete s.hooks;
    fs.writeFileSync(settings, JSON.stringify(s, null, 2) + "\n");
    fs.rmSync(grok, { force: true });
    fs.rmSync(hookShim, { force: true });
  };
  const fresh = (what: string) => {
    const hooks = (readJsonFile(settings) as { hooks?: { PreToolUse?: { matcher: string }[] } }).hooks;
    assert.deepEqual(hooks?.PreToolUse?.map((g) => g.matcher), ["WebFetch|WebSearch", "Task|Agent"], `${what}: Claude Code's hooks`);
    assert.ok(fs.existsSync(grok), `${what}: Grok's hooks`);
    assert.ok(fs.existsSync(hookShim), `${what}: the hook's shim`);
  };
  older();
  await w.ok(["chat", "--print", "--where", "app", "--agent", "claude"]);
  fresh("the desktop app's link");
  older();
  await w.ok(["chat", "--print", "--where", "terminal", "--agent", "claude"]);
  fresh("a conversation in the terminal");
  older();
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  await w.run(["run", "--agent", "script"]);
  fresh("a run");
  w.cleanup();
});

test("the first run of another strom writes the tree's .strom/bin again for this one; strom agents sync says when it wrote it; a tree with none gets none", opts, async () => {
  const w = await world();
  const bin = path.join(w.cwd, ".strom", "bin");
  const files = ["strom", "strom.cmd", "strom-hook.cmd"].map((f) => path.join(bin, f));
  const now = files.map((f) => fs.readFileSync(f, "utf8"));
  const lower = () => {
    const cfg = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
    fs.writeFileSync(cfg, JSON.stringify({ ...readJsonFile(cfg), lastVersion: "1.0.0" }));
  };
  // an older strom's shim (its broken strom.cmd)
  fs.writeFileSync(files[0]!, "#!/bin/sh\nexec /old/node /old/cli.js \"$@\"\n", { mode: 0o755 });
  fs.writeFileSync(files[1]!, '@echo off\r\n"%LOCALAPPDATA%\\old\\node.exe" "%LOCALAPPDATA%\\old\\cli.js" %*\r\nexit /b\r\n');
  lower();
  await w.ok(["stats"]);
  assert.deepEqual(files.map((f) => fs.readFileSync(f, "utf8")), now, "this strom's");
  if (process.platform !== "win32") assert.equal(fs.statSync(files[0]!).mode & 0o111, 0o111, "runnable");
  assert.deepEqual(fs.readdirSync(bin).filter((f) => f.endsWith(".tmp")), [], "no temporary file left");
  // strom agents sync: one line when it wrote it, none when it was as it is
  fs.writeFileSync(files[1]!, "@echo off\r\nold\r\n");
  const synced = await w.ok(["agents", "sync", "--json"]);
  assert.equal(synced.json.shim, true);
  assert.match((await w.ok(["agents", "sync"])).out, /^agent files are up to date$/m);
  assert.doesNotMatch((await w.ok(["agents", "sync"])).out, /\.strom\/bin rewritten/);
  fs.writeFileSync(files[1]!, "@echo off\r\nold\r\n");
  assert.match((await w.ok(["agents", "sync"])).out, /strom for the agents: \.strom\/bin rewritten/);
  // a research with no .strom/bin: none made by another strom's first run
  fs.rmSync(bin, { recursive: true, force: true });
  lower();
  await w.ok(["stats"]);
  assert.equal(fs.existsSync(bin), false);
  w.cleanup();
});
