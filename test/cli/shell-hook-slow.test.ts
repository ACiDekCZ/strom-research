// The hook before each shell command of the agent on a slow computer (K059): it answers at once — none of a new
// version's first run (no backup, no research settled, no bridge started) —, its time limit is the web's (60 s, written
// into a research an older strom set up at the first run of this one), and a slow one is noted in the journal of
// commands, which strom error shows: how long it took, Node's start included, nothing of the agent's command.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { zipTexts } from "./error.helpers.ts";
import { main } from "../../src/cli/main.ts";
import { claudeShellHooks, grokShellHook, SHELL_HOOK_TIMEOUT_S } from "../../src/core/bridgeguard.ts";
import { DESKTOP_TERMINAL_MATCHER } from "../../src/core/desktopterminal.ts";
import { commandLogFile, readCommands } from "../../src/core/cmdlog.ts";
import { Tree, VERSION } from "../../src/core/tree.ts";

const opts = { skip: !hasGit };

type Group = { matcher: string; hooks: { command: string; timeout: number; shell?: string }[] };

const event = (w: World) => JSON.stringify({ session_id: "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "echo Lhoták z Lhoty" } });

const shellGroups = (w: World) =>
  (readJsonFile(path.join(w.cwd, ".claude", "settings.json")) as { hooks: { PreToolUse: Group[] } }).hooks.PreToolUse.filter((g) => g.matcher === "Bash|PowerShell" || g.matcher === DESKTOP_TERMINAL_MATCHER);

const log = (w: World, ...args: string[]) => spawnSync("git", ["log", "--format=%s", ...args], { cwd: w.cwd, encoding: "utf8" }).stdout;

test("the shell's hook after an update does none of the first run; the next command of strom does it and brings the research's hooks up to date", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  // as an older strom left it: the shell's hooks with 10 s, a first run of this version and another channel to come
  const settings = path.join(w.cwd, ".claude", "settings.json");
  const s = readJsonFile(settings) as { hooks: { PreToolUse: Group[] } };
  for (const g of s.hooks.PreToolUse) if (g.matcher === "Bash|PowerShell" || g.matcher === DESKTOP_TERMINAL_MATCHER) for (const h of g.hooks) h.timeout = 10;
  fs.writeFileSync(settings, JSON.stringify(s, null, 2) + "\n");
  // committed (sealed) as that strom did
  const older = Tree.open(w.cwd, w.env);
  older.withTreeLock(() => older.commit("Agent instructions: .claude/settings.json", [".claude/settings.json"]));
  const cfg = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  const other = (readJsonFile(cfg) as { lastChannel?: string }).lastChannel === "beta" ? "stable" : "beta";
  fs.writeFileSync(cfg, JSON.stringify({ ...readJsonFile(cfg), lastVersion: "1.0.0", lastChannel: other }, null, 2));
  const before = fs.readFileSync(cfg, "utf8");
  const head = log(w, "-1");

  const r = await w.run(["agents", "shell", "--hook"], { stdin: event(w), env: { CLAUDECODE: "1" } });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out.trim(), "", "nothing refused");
  assert.equal(fs.readFileSync(cfg, "utf8"), before, "the first run of this version left to the next command: no lastVersion, no channel, no backup noted");
  assert.ok(!fs.existsSync(path.join(w.home, "backups")), "no backup made in the hook");
  assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "live.json")), "no bridge started");
  assert.equal(log(w, "-1"), head, "nothing settled, nothing committed");
  assert.ok(shellGroups(w).every((g) => g.hooks.every((h) => h.timeout === 10)), "the research's settings as they were");
  // the web's and the subagents' hooks alike (as before)
  for (const args of [["net", "web", "--hook"], ["agents", "delegate", "--hook"]]) {
    await w.run(args, { stdin: "{}", env: { CLAUDECODE: "1" } });
    assert.equal(fs.readFileSync(cfg, "utf8"), before, args.join(" "));
  }

  // a command of strom: the first run, and the research's hooks as this strom writes them, in one commit
  await w.ok(["stats"]);
  assert.equal((readJsonFile(cfg) as { lastVersion?: string }).lastVersion, VERSION);
  assert.ok(shellGroups(w).length === 2 && shellGroups(w).every((g) => g.hooks.every((h) => h.timeout === SHELL_HOOK_TIMEOUT_S)), "the shell's hooks with the new time limit");
  assert.match(log(w, "-5"), /^Agent hooks: \.claude\/settings\.json$/m);
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout;
  assert.doesNotMatch(status, /settings\.json/, "committed");
  // once: the next first run finds nothing to write
  fs.writeFileSync(cfg, JSON.stringify({ ...readJsonFile(cfg), lastVersion: "1.0.0" }, null, 2));
  const commits = log(w).split("\n").length;
  await w.ok(["stats"]);
  assert.equal(log(w).split("\n").length, commits, "no commit when the hooks are as this strom writes them");
});

test("the shell's hook waits as long as the web's: Claude Code's both groups and Grok's, on Windows too (its failure never blocks)", () => {
  assert.ok(SHELL_HOOK_TIMEOUT_S >= 30, "at least 30 s");
  const root = path.join(path.sep, "tmp", "Lhotákovi");
  for (const platform of ["win32", "darwin", "linux"] as const) {
    const c = claudeShellHooks(root, platform).PreToolUse as Group[];
    assert.deepEqual(c.map((g) => g.matcher), ["Bash|PowerShell", DESKTOP_TERMINAL_MATCHER]);
    for (const g of c) {
      assert.equal(g.hooks[0]!.timeout, SHELL_HOOK_TIMEOUT_S, platform);
      if (platform === "win32") {
        assert.equal(g.hooks[0]!.shell, "powershell");
        assert.match(g.hooks[0]!.command, /agents shell --hook; exit 0$/);
      } else assert.match(g.hooks[0]!.command, /agents shell --hook \|\| true$/);
    }
    assert.equal((grokShellHook(root, platform) as { hooks: { timeout: number }[] }).hooks[0]!.timeout, SHELL_HOOK_TIMEOUT_S, `Grok ${platform}`);
  }
});

test("a slow hook is noted with its time (Node's start included) and strom error shows it; a quick one never is", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"));
  await w.withTree("Lhotákovi");
  const env = { ...w.env, CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s-k059" };
  const hook = async (startedAgoMs: number) => {
    let out = "";
    const code = await main(["agents", "shell", "--hook"], { stdout: (s) => void (out += s), stderr: () => {}, tty: false, stdinText: () => event(w), processStartedAt: Date.now() - startedAgoMs }, env, w.cwd);
    assert.equal(code, 0);
    assert.equal(out.trim(), "");
  };
  const hooks = () => readCommands(commandLogFile(env)).filter((r) => r.cmd === "agents shell");
  await hook(0);
  assert.deepEqual(hooks(), [], "a quick hook: never noted");
  await hook(12_000);
  const noted = hooks();
  assert.equal(noted.length, 1);
  assert.equal(noted[0]!.hook, true);
  assert.ok(noted[0]!.processMs! >= 12_000, `its whole process: ${noted[0]!.processMs}`);
  assert.equal(noted[0]!.exit, 0);
  assert.deepEqual(noted[0]!.args, ["--hook"], "the command's words alone");
  assert.doesNotMatch(fs.readFileSync(commandLogFile(env), "utf8"), /Lhot|echo/, "nothing of the agent's command or the research");

  const r = await w.ok(["error", "--yes", "--json"], { env: { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s-k059" } });
  const got = JSON.parse(zipTexts(r.json.file)["report.json"]!);
  const shown = (got.areas.commands.commands as { cmd: string; hook?: boolean; processMs?: number }[]).filter((c) => c.hook);
  assert.equal(shown.length, 1);
  assert.equal(shown[0]!.cmd, "agents shell");
  assert.ok(shown[0]!.processMs! >= 12_000);
});
