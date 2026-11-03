// Claude Code's own folder (a second subscription's, say): CLAUDE_CONFIG_DIR of the environment, else the setting
// agent.claudeConfigDir, else ~/.claude. Every `claude` strom starts gets it (a run, the gate that asks its usage), the
// transcripts are read there, and `strom config set` takes only a folder that is there — saying when the variable wins.
// Everything in folders of the test's own: no login, never the real Claude Code (a stand-in that writes what it got).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { World } from "../helpers.ts";
import { claudeConfigDir, claudeConfigSet, claudeEnv, claudeStateFile, isClaudeCommand } from "../../src/core/claudedir.ts";
import { configFile, Settings } from "../../src/core/config.ts";
import { claudeRunner } from "../../src/runners/claude.ts";
import { spawnAgent } from "../../src/runners/runner.ts";
import { askGate } from "../../src/core/gate.ts";
import { transcriptFile, projectSlug } from "../../src/core/transcripts.ts";
import { conversationEnv } from "../../src/agents/launch.ts";
import { globalTargets } from "../../src/agents/global.ts";

const posix = { skip: process.platform === "win32" };

/** A home of its own with strom's settings (agent.claudeConfigDir when given) and Claude Code's folders in it. */
function place(key?: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom claude dir ěš "));
  const home = path.join(dir, "home");
  const second = path.join(home, ".claude-lhota");
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  fs.mkdirSync(second, { recursive: true });
  const env: Record<string, string> = { HOME: home, USERPROFILE: home, STROM_CONFIG_DIR: path.join(dir, "config"), PATH: process.env.PATH ?? "" };
  if (key !== undefined) {
    fs.mkdirSync(env.STROM_CONFIG_DIR!, { recursive: true });
    fs.writeFileSync(configFile(env), JSON.stringify({ claudeConfigDir: key }));
  }
  return { dir, home, second, env, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test("the folder: CLAUDE_CONFIG_DIR > agent.claudeConfigDir (~ expanded) > ~/.claude; .claude.json beside it", () => {
  const none = place();
  const keyed = place("~/.claude-lhota");
  try {
    assert.equal(claudeConfigSet(none.env), undefined);
    assert.equal(claudeConfigDir(none.env), path.join(none.home, ".claude"));
    assert.equal(claudeStateFile(none.env), path.join(none.home, ".claude.json"), "Claude Code's own default: in the home folder");
    assert.deepEqual(claudeEnv(none.env), {});

    assert.equal(claudeConfigDir(keyed.env), keyed.second, "the setting, ~ expanded");
    assert.equal(claudeStateFile(keyed.env), path.join(keyed.second, ".claude.json"));
    assert.deepEqual(claudeEnv(keyed.env), { CLAUDE_CONFIG_DIR: keyed.second });
    assert.equal(new Settings(keyed.env, {}).resolve("agent.claudeConfigDir")?.source, "config");

    // the variable wins — and is inherited as it is (nothing added)
    const own = path.join(keyed.home, ".claude-own");
    const withVar = { ...keyed.env, CLAUDE_CONFIG_DIR: own };
    assert.equal(claudeConfigDir(withVar), own);
    assert.deepEqual(claudeEnv(withVar), {});
    assert.equal(new Settings(withVar, {}).resolve("agent.claudeConfigDir")?.source, "env");

    // Claude Code only: a conversation's environment, the command it is
    assert.deepEqual(conversationEnv("claude", keyed.env), { CLAUDE_CONFIG_DIR: keyed.second });
    assert.deepEqual(conversationEnv("codex", keyed.env), {});
    assert.ok(isClaudeCommand("claude") && isClaudeCommand("/opt/bin/claude") && isClaudeCommand("claude.cmd"));
    assert.ok(!isClaudeCommand("codex") && !isClaudeCommand("claude-usage"));

    // what strom teaches Claude Code goes into that folder
    const claudeFiles = globalTargets(keyed.env).filter((t) => t.agent === "claude").map((t) => t.file);
    assert.ok(claudeFiles.length && claudeFiles.every((f) => f.startsWith(keyed.second + path.sep)), claudeFiles.join(", "));
  } finally {
    none.done();
    keyed.done();
  }
});

/** A stand-in `claude` (and `codex`) that writes the CLAUDE_CONFIG_DIR it got into `out`, then ends. */
function standIns(dir: string): { bin: string; out: (name: string) => string | undefined } {
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  for (const name of ["claude", "codex"]) fs.writeFileSync(path.join(bin, name), `#!/bin/sh\ncat >/dev/null\nprintf '%s' "\${CLAUDE_CONFIG_DIR-<none>}" > "${path.join(dir, `${name}.got`)}"\nexit 0\n`, { mode: 0o755 });
  return { bin, out: (name) => (fs.existsSync(path.join(dir, `${name}.got`)) ? fs.readFileSync(path.join(dir, `${name}.got`), "utf8") : undefined) };
}

const ended = (child: ReturnType<typeof spawnAgent>) => new Promise<void>((resolve) => child.on("close", () => resolve()));

test("every claude strom starts gets the setting's folder — a run of the Claude runner too; the variable wins; other agents nothing", posix, async () => {
  const p = place("~/.claude-lhota");
  try {
    const s = standIns(p.dir);
    const env = { ...p.env, PATH: `${s.bin}${path.delimiter}${p.env.PATH}` };
    // a run (strom run's Claude runner)
    await claudeRunner.run({ cwd: p.dir, prompt: "brief", kickoff: "k", env, logFile: path.join(p.dir, "run.log") });
    assert.equal(s.out("claude"), p.second, "the run's claude got the setting's folder");
    // the variable of the environment wins
    const own = path.join(p.home, ".claude-own");
    await ended(spawnAgent("claude", [], { env: { ...env, CLAUDE_CONFIG_DIR: own }, stdio: ["ignore", "ignore", "ignore"] }));
    assert.equal(s.out("claude"), own);
    // another agent: as before
    await ended(spawnAgent("codex", [], { env, stdio: ["ignore", "ignore", "ignore"] }));
    assert.equal(s.out("codex"), "<none>");
  } finally {
    p.done();
  }
});

test("the gate that asks Claude Code its usage asks the one of the setting", () => {
  const p = place("~/.claude-lhota");
  try {
    const gateDir = path.join(p.dir, "gate");
    fs.mkdirSync(gateDir);
    fs.writeFileSync(path.join(gateDir, "gate.mjs"), "console.log(JSON.stringify({ reason: process.env.CLAUDE_CONFIG_DIR ?? '<none>' }));\n");
    const gate = { name: "probe", dir: gateDir, manifest: { interface: 1, command: ["node", "gate.mjs"] }, args: [] };
    const facts = { tree: p.dir, lang: "cs", agent: "claude", sessions: 0, costUsd: 0 };
    const said = askGate(gate, p.env, facts);
    assert.equal(said.verdict, "go");
    assert.equal(said.reason, p.second);
    const own = path.join(p.home, ".claude-own");
    assert.equal(askGate(gate, { ...p.env, CLAUDE_CONFIG_DIR: own }, facts).reason, own, "the variable wins");
  } finally {
    p.done();
  }
});

test("the transcripts are looked up in the setting's folder", () => {
  const p = place("~/.claude-lhota");
  try {
    const cwd = path.join(p.dir, "Lhotákovi");
    const uuid = "0f1e2d3c-4b5a-4968-8776-655443322110";
    const dir = path.join(p.second, "projects", projectSlug(cwd));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${uuid}.jsonl`), "{}\n");
    assert.equal(transcriptFile(uuid, { cwd, env: p.env }), path.join(dir, `${uuid}.jsonl`));
    assert.equal(transcriptFile(uuid, { cwd, env: p.env, settings: new Settings(p.env, {}) }), path.join(dir, `${uuid}.jsonl`));
    // without the setting: ~/.claude, where it is not
    const none = place();
    try {
      assert.equal(transcriptFile(uuid, { cwd, env: none.env }), undefined);
    } finally {
      none.done();
    }
  } finally {
    p.done();
  }
});

test("strom config set agent.claudeConfigDir: a folder that is there, ~ expanded; none refused with the hint; the variable that wins said", async () => {
  const w = new World();
  try {
    const home = w.env.HOME!;
    fs.mkdirSync(path.join(home, ".claude-lhota"));
    const missing = await w.run(["config", "set", "agent.claudeConfigDir", "~/.claude-lhoták"]);
    assert.notEqual(missing.code, 0);
    assert.match(missing.out + missing.err, /no folder/);
    assert.match(missing.out + missing.err, /CLAUDE_CONFIG_DIR=<folder> claude/);
    // whose login pays is the person's: an agent (or no terminal) is refused, nothing written
    const agent = await w.run(["config", "set", "agent.claudeConfigDir", "~/.claude-lhota"], { env: { CLAUDECODE: "1" } });
    assert.equal(agent.code, 4, agent.out + agent.err);
    assert.equal(claudeConfigDir(w.env), path.join(home, ".claude"));
    const set = await w.ok(["config", "set", "agent.claudeConfigDir", "~/.claude-lhota"], { tty: true });
    assert.doesNotMatch(set.out, /wins over this setting/);
    assert.match(set.out, /strom agents install/);
    assert.equal(new Settings(w.env, {}).resolve("agent.claudeConfigDir")?.value, path.join(home, ".claude-lhota"));
    const got = (await w.ok(["config", "get", "agent.claudeConfigDir", "--json"])).json;
    assert.equal(got.value, path.join(home, ".claude-lhota"));
    // a variable saying another folder: said in one sentence that it wins
    const said = await w.ok(["config", "set", "agent.claudeConfigDir", "~/.claude-lhota", "--json"], { env: { CLAUDE_CONFIG_DIR: path.join(home, ".claude") } });
    assert.ok(said.json.envWins, said.out);
    const plain = await w.ok(["config", "set", "agent.claudeConfigDir", "~/.claude-lhota"], { env: { CLAUDE_CONFIG_DIR: path.join(home, ".claude") } });
    assert.match(plain.out, /CLAUDE_CONFIG_DIR is set in this environment .* wins over this setting/);
    // unset: Claude Code's own default again
    await w.ok(["config", "unset", "agent.claudeConfigDir"], { tty: true });
    assert.equal(claudeConfigDir(w.env), path.join(home, ".claude"));
  } finally {
    w.cleanup();
  }
});
