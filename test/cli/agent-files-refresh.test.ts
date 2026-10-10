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
