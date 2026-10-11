// Whose settings these are (core/trust.ts, V2): under an agent — its marks, or one among strom's parent processes —
// the settings folder is the person's only when it is their default one for the real home, one they ran strom with
// themselves, or the installation's own, and never inside a family tree or the shared folder. Soft: settings not
// verified give no permission and no faster pace, and stop nothing.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { agentAmong, defaultSettingsDir, parseCim, parsePs, settingsTrust } from "../../src/core/trust.ts";
import { humanPace } from "../../src/core/terms.ts";
import { HUMAN_PACE, hostPace, netTrust } from "../../src/core/net.ts";

const dirs: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "strom trust "));
  dirs.push(d);
  return d;
};
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  netTrust.ownPace = true;
});
const source = { kind: "source" as const };

test("the parent processes: an agent's program found walking up, by its name or its script; a person's shell none", () => {
  const ps = parsePs(["  1     0 /sbin/launchd", " 500     1 /Applications/iTerm.app/Contents/MacOS/iTerm2", " 600   500 -zsh", " 700   600 /Users/x/.local/bin/claude --model opus", " 800   700 /bin/zsh -c strom fetch", " 900   800 node /x/strom/dist/cli.js fetch", " 950   600 node /usr/lib/node_modules/@openai/codex/bin/codex.js", " 960   950 strom"].join("\n"));
  assert.equal(agentAmong(ps, 900), "claude");
  assert.equal(agentAmong(ps, 960), "codex");
  assert.equal(agentAmong(ps, 600), undefined, "the person's own shell");
  assert.equal(agentAmong(parsePs(" 10 1 /Users/x/grok/bin/node /x/cli.js\n 11 10 vim notes-claude.txt"), 11), undefined, "a name inside another word or folder is not one");
  const cim = parseCim(['"ProcessId","ParentProcessId","Name","CommandLine"', '"4","0","System",""', '"100","4","explorer.exe","C:\\\\Windows\\\\explorer.exe"', '"200","100","claude.exe","""C:\\\\Users\\\\x\\\\.local\\\\bin\\\\claude.exe"""', '"300","200","node.exe","node C:\\\\strom\\\\cli.js"'].join("\r\n"));
  assert.equal(agentAmong(cim, 300), "claude");
});

test("under an agent: the default folder for the real home, a folder the person listed, never one inside a tree or the shared folder; a person always; the sources not checked", () => {
  const home = tmp();
  const env = { STROM_TEST_V2: "1", STROM_TEST_REAL_HOME: home, HOME: home, CLAUDECODE: "1" };
  const dflt = defaultSettingsDir(env, process.platform, source);
  assert.equal(dflt, path.join(home, ".config", "strom"));
  assert.equal(settingsTrust({ ...env }, { inst: source }).verified, true, "no folder of its own: the default one");
  assert.equal(settingsTrust({ ...env, HOME: tmp() }, { inst: source }).verified, false, "a HOME of the agent's own");
  const own = tmp();
  const t = settingsTrust({ ...env, STROM_CONFIG_DIR: own }, { inst: source });
  assert.equal(t.verified, false);
  assert.match(t.why ?? "", /not the person's/);
  assert.equal(t.restrictionsFrom, dflt, "what restricts read from the person's default folder too");
  fs.mkdirSync(dflt, { recursive: true });
  fs.writeFileSync(path.join(dflt, "settings-folders.json"), JSON.stringify({ folders: [{ path: own, at: "" }] }));
  assert.equal(settingsTrust({ ...env, STROM_CONFIG_DIR: own }, { inst: source }).verified, true, "listed by the person");
  // inside a family tree: never, listed or not
  const tree = tmp();
  fs.writeFileSync(path.join(tree, "strom.json"), "{}");
  const inTree = path.join(tree, ".cfg");
  fs.mkdirSync(inTree);
  fs.writeFileSync(path.join(dflt, "settings-folders.json"), JSON.stringify({ folders: [{ path: own, at: "" }, { path: inTree, at: "" }] }));
  const t2 = settingsTrust({ ...env, STROM_CONFIG_DIR: inTree }, { inst: source, cwd: tree });
  assert.equal(t2.verified, false);
  assert.match(t2.why ?? "", /inside/);
  // the shared folder: the one the settings name, not the agent's own
  const research = tmp();
  fs.writeFileSync(path.join(own, "config.json"), JSON.stringify({ home: research }));
  assert.equal(settingsTrust({ ...env, STROM_CONFIG_DIR: own }, { inst: source, shared: path.join(research, "shared") }).sharedVerified, true);
  const elsewhere = tmp();
  const t3 = settingsTrust({ ...env, STROM_CONFIG_DIR: own, STROM_SHARED: elsewhere }, { inst: source, shared: elsewhere });
  assert.equal(t3.verified, true);
  assert.equal(t3.sharedVerified, false, "a shared folder of the agent's own");
  assert.equal(t3.sharedNamed, path.join(research, "shared"), "the one the settings name restricts too");
  // an agent among the parent processes, no marks: the same
  assert.equal(settingsTrust({ STROM_TEST_V2: "1", STROM_TEST_REAL_HOME: home, STROM_TEST_ANCESTRY: "zsh,codex", STROM_CONFIG_DIR: tmp() }, { inst: source, network: true }).verified, false);
  // a person, and the sources unchecked
  assert.equal(settingsTrust({ STROM_TEST_V2: "1", STROM_TEST_REAL_HOME: home, STROM_TEST_ANCESTRY: "", STROM_CONFIG_DIR: tmp() }, { inst: source }).verified, true);
  assert.equal(settingsTrust({ CLAUDECODE: "1", STROM_CONFIG_DIR: tmp() }, { inst: source }).verified, true);
  // an isolated installation: its own, nothing of the person's default folder read
  assert.equal(settingsTrust({ ...env, STROM_ISOLATED: "1", STROM_CONFIG_DIR: tmp() }, { inst: source }).restrictionsFrom, undefined);
});

test("settings not verified: their pace only where it is slower — strom's archive.pace and a person's own for a host", () => {
  const home = tmp();
  const cfg = tmp();
  const env = { STROM_TEST_V2: "1", STROM_TEST_REAL_HOME: home, CLAUDECODE: "1", STROM_CONFIG_DIR: cfg };
  fs.writeFileSync(path.join(cfg, "config.json"), JSON.stringify({ archivePace: "2 500" }));
  assert.deepEqual(humanPace(env, source), HUMAN_PACE, "a faster one not taken");
  fs.writeFileSync(path.join(cfg, "config.json"), JSON.stringify({ archivePace: "20 60" }));
  assert.deepEqual(humanPace(env, source), { minIntervalMs: 20_000, perHour: 60 }, "a slower one taken");
  const faster = { recent: [], own: { minIntervalMs: 2000, perHour: 0, at: "" } };
  const slower = { recent: [], own: { minIntervalMs: 30_000, perHour: 20, at: "" } };
  netTrust.ownPace = false;
  assert.deepEqual(hostPace(faster, { minIntervalMs: 5000, perHour: 120, source: "x" }), { minIntervalMs: 5000, perHour: 120 });
  assert.deepEqual(hostPace(faster, undefined, HUMAN_PACE), HUMAN_PACE);
  assert.deepEqual(hostPace(slower, undefined, HUMAN_PACE), { minIntervalMs: 30_000, perHour: 20 });
  netTrust.ownPace = true;
  assert.deepEqual(hostPace(faster, undefined, HUMAN_PACE), { minIntervalMs: 2000, perHour: Infinity }, "the person's, as given");
});
