// How a person starts: the menu, the conversation with the agent set up as
// they chose, the Strom app, the shortcut, the agents learning about strom.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { VERSION } from "../../src/core/tree.ts";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { conversationArgs } from "../../src/agents/launch.ts";
import { detectAgent, withoutAgentMarks } from "../../src/core/which.ts";
import { webAppProfile } from "../../src/core/chromium.ts";
import { installedStromApp, isStromName } from "../../src/core/stromapp.ts";
import { createShortcut, openInNewTerminal } from "../../src/core/shortcut.ts";
import { enterWorker } from "../../src/core/workers.ts";

const unix = { skip: !hasGit || process.platform === "win32" };

/** A PATH with git and fake agent CLIs that end at once. */
function pathWith(w: World, agents: string[]): string {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git && !fs.existsSync(path.join(bin, "git"))) fs.symlinkSync(git, path.join(bin, "git"));
  // The fake agent notes how it was started.
  for (const a of agents) fs.writeFileSync(path.join(bin, a), `#!/bin/sh\necho "$PWD" "$@" >> "${path.join(w.dir, `${a}.calls`)}"\nexit 0\n`, { mode: 0o755 });
  return bin;
}

test("a person runs strom: the first family tree, straight into the conversation; the menu after", unix, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude"]);
  await w.ok(["setup", "--yes"]);
  // name of the tree → the agent opens (fake: ends at once) → the menu → quit
  const r = await w.ok([], { tty: true, answers: ["Novákovi", "0"] });
  assert.match(r.out, /Jak se bude rodokmen jmenovat\?/);
  assert.match(r.out, /✓ Rodokmen „Novákovi“ je založený: /);
  assert.doesNotMatch(r.out, /next\s+strom research new/, "no line meant for agents");
  assert.match(r.out, /Otevírám rozhovor s agentem \(Claude Code\)\. Konec rozhovoru: \/exit\./);
  assert.match(r.out, /Claude Code se poprvé zeptá, jestli této složce důvěřovat/, "a folder it does not trust yet");
  const call = fs.readFileSync(path.join(w.dir, "claude.calls"), "utf8");
  assert.ok(call.startsWith(fs.realpathSync(w.treeDir("Novákovi"))), `in the tree folder: ${call}`);
  assert.match(call, /chci začít zkoumat svoje předky/, "the first message, in the user's language");
  assert.match(call, /--permission-mode auto --settings .+\/Novákovi\/\.claude\/settings\.json/);
  assert.match(call, /--no-chrome/, "no archive through the browser: no browser tools");
  assert.match(r.out, /Rodokmen: Novákovi · osob: 0/);
  assert.match(r.out, /1 {2}Začít výzkum s agentem/);
  assert.match(r.out, /Na shledanou/);
  // the browser in every session, the user's choice: the conversation gets it
  await w.ok(["config", "set", "agent.browser", "always"], { tty: true, answers: ["a"] });
  fs.rmSync(path.join(w.dir, "claude.calls"));
  await w.ok(["chat"], { tty: true });
  assert.match(fs.readFileSync(path.join(w.dir, "claude.calls"), "utf8"), / --chrome\b/);
  await w.ok(["config", "unset", "agent.browser"]);
  // An agent (or a script) still gets the orientation, never the menu.
  assert.match((await w.ok([])).out, /^strom \S+ — nástroj pro genealogický výzkum s AI agenty/);
  w.cleanup();
});

test("the menu: results and what waits; unknown choices are asked again", unix, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude"]);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  const r = await w.ok([], { tty: true, answers: ["9", "strom help --human", "3", "", "5", "1", "0", "0"] });
  assert.match(r.out, /Čekám jedno z čísel: 1, 2, .*, 0\./);
  // a command typed into the menu is said where it goes, in one line; the menu is not printed again
  assert.match(r.out, /Příkazy se píšou mimo menu: nejdřív 0 \(Konec\), pak strom help --human\n/);
  const before = r.out.slice(0, r.out.indexOf("Příkazy se píšou mimo menu"));
  assert.equal(before.match(/^ {3}0 {2}Konec$/gmu)?.length, 1);
  assert.match(r.out, /Nic nečeká/);
  assert.match(r.out, /Výsledky zatím nejsou/);
  w.cleanup();
});

test("the menu: a person can always change their mind — the current choice suggested, 0 goes back, nothing changes", unix, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude", "codex"]);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  await w.ok(["init", "Svobodovi"]);
  await w.ok(["trees", "use", "Novákovi"]);
  // another agent: Enter stays · working alone: 0 · another tree: Enter stays · a new one: 0 · quit
  const r = await w.ok([], { tty: true, answers: ["9", "", "2", "0", "6", "", "6", "3", "0", "0"] });
  assert.match(r.out, /Který AI agent a kde s ním mluvit\?\n {3}1 {2}OpenAI Codex CLI – v terminálu \(pro zkušenější\)\n {3}0 {2}Zpět – zůstat u: Claude Code – v terminálu\nVybrat \[0\]/);
  assert.ok(!fs.existsSync(path.join(w.dir, "codex.calls")), "no other agent started");
  assert.ok(!fs.existsSync(path.join(w.dir, "claude.calls")), "no conversation, no run");
  assert.match(r.out, /Který rodokmen\?\n {3}1 {2}Novákovi .*\n {3}2 {2}Svobodovi .*\n {3}3 {2}nový rodokmen\n {3}4 {2}zabalit „Novákovi“ a poslat někomu \(soubor ZIP\)\n {3}5 {2}rodokmen, který někdo poslal \(soubor ZIP\)\n {3}6 {2}odebrat rodokmen z tohoto počítače\n {3}0 {2}Zpět – zůstat u: Novákovi\nVybrat \[1\]/);
  assert.match(r.out, /Jak se bude jmenovat nový rodokmen\? \(třeba příjmení rodiny; 0 vrátí zpět\)/);
  assert.equal((await w.ok(["trees", "--json"])).json.trees.length, 2, "no tree made");
  assert.match((await w.ok(["status"])).out, /Novákovi/, "still the same tree");
  // handing it over from the menu: packed, then unpacked by someone else (a file dragged in)
  const p = await w.ok([], { tty: true, answers: ["6", "4", "1", "", "0"] });
  assert.match(p.out, /Které snímky přibalit\?\n {3}1 {2}jen se zápisy – 0 MB[^\n]*\n {3}2 {2}všechny – 0 MB\n {3}0 /);
  assert.match(p.out, /Zabaleno „Novákovi“: (.+\.zip) \(/);
  const zip = path.join(w.env.HOME!, /Zabaleno „Novákovi“: ~\/(.+\.zip) \(/.exec(p.out)![1]!);
  assert.ok(fs.existsSync(zip), zip);
  const b = new World();
  b.env.PATH = pathWith(b, ["claude"]);
  await b.ok(["setup", "--yes"]);
  await b.ok(["init", "Dvořákovi"]);
  const u = await b.ok([], { tty: true, answers: ["6", "4", `'${zip}'`, "a", "", "0"] });
  assert.match(u.out, /Přetáhnout sem soubor ZIP[\s\S]*„Novákovi“ je tady/);
  assert.equal((await b.ok(["trees", "--json"])).json.trees.length, 2);
  // taking one off from the menu: Enter goes back, nothing taken off
  const rm = await b.ok([], { tty: true, answers: ["6", "6", "", "0"] });
  assert.match(rm.out, /Který rodokmen odebrat z tohoto počítače\?\n[\s\S]* {3}0 {2}Zpět\nVybrat \[0\]/);
  assert.equal((await b.ok(["trees", "--json"])).json.trees.length, 2, "nothing taken off");
  b.cleanup();
  w.cleanup();
});

test("setup run again: every choice can be left as it is (0)", unix, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude"]);
  await w.ok(["setup", "--yes"]);
  const before = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  const r = await w.ok(["setup"], { tty: true, answers: ["", "", "0", "0", "0", "n", "0"] });
  assert.match(r.out, /\n {3}0 {2}Nechat, jak je\n/);
  const after = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  for (const k of ["agent", "models", "stromApp"]) assert.deepEqual(after[k], before[k], k);
  assert.equal(after.stories ?? "yes", before.stories ?? "yes", "the stories as they were");
  assert.equal(after.agentPermissions ?? "auto", before.agentPermissions ?? "auto", "the level as it was");
  w.cleanup();
});

test("strom chat: the agent set up as the user chose — Claude Code, Codex, Antigravity, OpenCode, Grok", unix, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude", "codex", "agy", "opencode", "grok"]);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  const print = async (agent: string) => (await w.ok(["chat", "--print", "--agent", agent, "--json"])).json;
  const claude = await print("claude");
  assert.equal(claude.cwd, w.treeDir("Novákovi"));
  const name = claude.args[claude.args.indexOf("--name") + 1];
  assert.match(name, /^Strom · Novákovi · \d{1,2}\. \d{1,2}\.$/, "a name in Claude Code's list of sessions");
  assert.deepEqual(claude.args.slice(1, 3), ["--permission-mode", "auto"]);
  const codex = await print("codex");
  assert.ok(codex.args.includes("--approve-for-me"));
  assert.ok(codex.args.includes("sandbox_workspace_write.network_access=true"), "strom fetches: the network stays on");
  assert.equal(codex.args.at(-1), claude.args[0], "the same first message");
  const agy = await print("antigravity");
  assert.deepEqual(agy.args.slice(0, 2), ["--mode", "accept-edits"], "auto: edits accepted, strom allowed by its settings");
  assert.equal(agy.args.at(-2), "--prompt-interactive");
  const opencode = await print("opencode");
  assert.deepEqual(opencode.args, ["--prompt", claude.args[0]], "auto: the tree's rules (opencode.json), no review of its own");
  const oc = readJsonFile(path.join(w.treeDir("Novákovi"), "opencode.json")).permission;
  assert.equal(oc.bash["strom *"], "allow");
  assert.equal(oc.bash["strom login *"], "deny");
  assert.equal(oc.bash["git *"], "deny");
  assert.equal(oc.edit["data/*"], "deny");
  assert.equal(oc.read["data/*"], "deny");
  assert.equal(Object.keys(oc.bash)[0], "*", "the general rule first: the last match counts");
  // Grok Build: the folder trusted (else it reads neither AGENTS.md nor the tree's rules), its own review under auto.
  const grok = await print("grok");
  assert.deepEqual(grok.args, ["--trust", "--permission-mode", "auto", claude.args[0]]);
  const toml = fs.readFileSync(path.join(w.treeDir("Novákovi"), ".grok", "config.toml"), "utf8");
  assert.match(toml, /^\[permission\]$/m);
  assert.match(toml, /"Bash\(strom:\*\)"/);
  for (const rule of ["Read(data/**)", "Edit(data/**)", "Bash(git:*)", "Bash(strom login:*)"]) assert.ok(toml.includes(JSON.stringify(rule)), rule);
  assert.ok(!toml.includes("PowerShell("), "one shell");
  // an absolute path as Grok reads it (Claude Code's "//…" is plain text to it)
  assert.ok(toml.includes(JSON.stringify(`Read(${w.env.STROM_CONFIG_DIR!}/**)`)), "the seal keys by their path");
  assert.ok(!/"(Read|Edit)\(\/\//.test(toml));
  assert.match(fs.readFileSync(path.join(w.treeDir("Novákovi"), ".grok", "rules", "strom.md"), "utf8"), /CLAUDE\.md in this folder is written for Claude Code/);
  // An agent elsewhere (it set strom up from the web page) hands the research over: its own
  // conversation, in a new terminal window (not opened in a test: the user is told how).
  w.env.CLAUDECODE = "1";
  // strom tells it so: outside the tree, the next step is the research's own conversation.
  assert.equal((await w.ok(["--json"], { cwd: w.dir })).json.next.command, "strom chat");
  assert.notEqual((await w.ok(["--json"], { cwd: w.treeDir("Novákovi") })).json.next.command, "strom chat", "in the tree folder: go on");
  // a bot on its own server (Grok Bot, Cursor's platform), no agent strom could start there: it goes on where it is
  const path0 = w.env.PATH;
  w.env.PATH = "/usr/bin:/bin"; // (the fake agents above are in the test's own bin folder)
  delete w.env.CLAUDECODE;
  const apps0 = w.env.STROM_APP_DIRS;
  w.env.STROM_APP_DIRS = w.dir; // (no desktop app of an agent there either)
  w.env.CURSOR_AGENT = "1";
  assert.notEqual((await w.ok(["--json"], { cwd: w.dir })).json.next.command, "strom chat");
  delete w.env.CURSOR_AGENT;
  if (apps0 === undefined) delete w.env.STROM_APP_DIRS;
  else w.env.STROM_APP_DIRS = apps0;
  w.env.CLAUDECODE = "1";
  w.env.PATH = path0;
  const h = await w.ok(["chat", "--json"]);
  assert.equal(h.json.handover, "none");
  assert.equal(h.json.cwd, w.treeDir("Novákovi"));
  assert.match((await w.ok(["chat"])).out, /Výzkum jde spustit ručně: v terminálu příkazem strom/);
  // The window strom opened for it (STROM_HANDOVER): the person's own — the conversation starts there, never another window;
  // the agent it starts does not carry the mark.
  w.env.STROM_HANDOVER = "1";
  await w.ok(["chat"]);
  assert.match(fs.readFileSync(path.join(w.dir, "claude.calls"), "utf8"), /--permission-mode/);
  delete w.env.STROM_HANDOVER;
  // An agent strom started is where the research happens already: no second conversation.
  w.env.STROM_WORKER = "claude-1";
  assert.equal((await w.run(["chat"])).code, 2);
  w.cleanup();
});

test("the handover window: the agent's marks cleared, STROM_HANDOVER set, one window at a time, the script gone once it ran", () => {
  const w = new World();
  const cwd = path.join(w.dir, "Novákovi");
  fs.mkdirSync(cwd);
  const env = { ...w.env, STROM_NO_OPEN: "", CLAUDECODE: "1", AI_AGENT: "claude-code_agent", CODEX_SANDBOX: "seatbelt", CODEX_HOME: "/x/codex", STROM_LANG: "de", STROM_SESSION: "X1", DISPLAY: "" };
  // Linux without a desktop: the script is written, no window opens.
  assert.equal(openInNewTerminal(["chat", "--agent", "claude"], cwd, env, "linux"), false);
  const dir = path.join(cwd, ".strom", "open");
  const [script] = fs.readdirSync(dir);
  const body = fs.readFileSync(path.join(dir, script!), "utf8");
  assert.match(body, /^#!\/bin\/sh\nrm -f -- "\$0"\nunset CLAUDECODE AI_AGENT CODEX_SANDBOX\n/);
  assert.match(body, /export STROM_LANG='de'\nexport STROM_HANDOVER=1\n/);
  assert.doesNotMatch(body, /CODEX_HOME|STROM_SESSION/, "the user's own settings stay, the agent's session does not go along");
  assert.equal(openInNewTerminal(["chat"], cwd, env, "linux"), "recent", "one window at a time");
  // Run, it deletes itself (a copy that stops before strom).
  const copy = path.join(dir, "copy.command");
  fs.writeFileSync(copy, body.replace(/^exec .*$/m, "exit 0"));
  assert.equal(spawnSync("/bin/sh", [copy]).status, 0);
  assert.ok(!fs.existsSync(copy));
  w.cleanup();
});

/** Desktop apps of the agents, as strom finds them (the names of their bundles). */
function appsWith(w: World, apps: string[]): string {
  const dir = path.join(w.dir, "Applications");
  for (const a of apps) fs.mkdirSync(path.join(dir, a), { recursive: true });
  return dir;
}

test("the agent's desktop app: found, chosen once, opened in the tree folder with the first message", unix, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude"]);
  w.env.STROM_APP_DIRS = appsWith(w, ["Claude.app", "ChatGPT.app"]);
  // language, folder, the agent and where (Enter = Claude's app), model, stories, level, no shortcut
  const r = await w.ok(["setup"], { answers: ["cs", "", "", "", "", "", "n"] });
  assert.match(r.out, /Který AI agent a kde s ním mluvit\?\n {3}1 {2}Claude – aplikace \(nejjednodušší\)\n {3}2 {2}Claude Code – v terminálu \(pro zkušenější\)\n {3}3 {2}ChatGPT \(Codex\) – aplikace \(nejjednodušší\)\nVybrat \[1\]/);
  assert.match(r.out, /✓ AI agent: Claude – aplikace/);
  const cfg = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  assert.equal(cfg().agentWhere, "app");
  await w.ok(["init", "Novákovi"]);
  const tree = w.treeDir("Novákovi");
  const p = (await w.ok(["chat", "--print", "--json"])).json;
  assert.equal(p.link, `claude://code/new?folder=${encodeURIComponent(tree)}&q=${encodeURIComponent("Ahoj, chci začít zkoumat svoje předky. Spusť `strom`, v pár větách mi vysvětli, jak spolu budeme pracovat, a zeptej se mě, koho hledáme a co už víme.")}`);
  // The app gets the model from the tree's settings (it takes no switches).
  assert.equal(readJsonFile(path.join(tree, ".claude", "settings.json")).model, "opus");
  // Not opened (a test): the person is told what to do by hand; auto is picked in the app.
  const c = await w.ok(["chat"]);
  assert.match(c.out, /Aplikace Claude se neotevřela\. Spustit ji ručně, otevřít složku .*Novákovi a napsat: Ahoj/);
  assert.match(c.out, /zvolit „Auto“/);
  assert.ok(!fs.existsSync(path.join(w.dir, "claude.calls")), "the CLI was not started");
  // The terminal after all: the CLI, as before.
  await w.ok(["config", "set", "agent.where", "terminal"]);
  assert.ok(Array.isArray((await w.ok(["chat", "--print", "--json"])).json.args));
  // Codex: its app, whatever the choice, when its CLI is not here.
  const codex = (await w.ok(["chat", "--print", "--agent", "codex", "--json"])).json;
  assert.match(codex.link, /^codex:\/\/new\?path=.*&prompt=Ahoj/);
  // The doctor says where; working alone needs the CLI.
  const d = await w.run(["doctor"]);
  assert.match(d.out, /kde se mluví s agentem\s+terminál \(Claude Code\)/);
  w.cleanup();
});

test("the app or the terminal: each a line of the agents' list, the app suggested — the setup, the menu, a reinstall", unix, async () => {
  // found on Mac: Codex's CLI, the apps of Claude and Codex — the agents listed by name, Claude (its app alone) suggested,
  // nothing asked of where
  const w = new World();
  w.env.PATH = pathWith(w, ["codex"]);
  w.env.STROM_APP_DIRS = appsWith(w, ["Claude.app", "Codex.app"]);
  // language, folder, Codex in the terminal, stories, level, no shortcut
  const r = await w.ok(["setup"], { answers: ["cs", "", "3", "", "", "n"] });
  assert.match(r.out, /Který AI agent a kde s ním mluvit\?\n {3}1 {2}Claude – aplikace \(nejjednodušší\)\n {3}2 {2}ChatGPT \(Codex\) – aplikace \(nejjednodušší\)\n {3}3 {2}OpenAI Codex CLI – v terminálu \(pro zkušenější\)\nVybrat \[1\]/);
  assert.match(r.out, /✓ AI agent: OpenAI Codex CLI – v terminálu/);
  const cfg = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  assert.equal(cfg().agent, "codex");
  assert.equal(cfg().agentWhere, "terminal");
  await w.ok(["init", "Novákovi"]);
  assert.ok(Array.isArray((await w.ok(["chat", "--print", "--json"])).json.args), "the terminal");
  // this time elsewhere: the other ways, Enter stays; Codex's app this once — the setting stays
  const m = await w.ok([], { tty: true, answers: ["9", "2", "0"] });
  assert.match(m.out, /9 {2}Tentokrát mluvit s jiným agentem nebo jinde/);
  assert.match(m.out, /Který AI agent a kde s ním mluvit\?\n {3}1 {2}Claude – aplikace \(nejjednodušší\)\n {3}2 {2}ChatGPT \(Codex\) – aplikace \(nejjednodušší\)\n {3}0 {2}Zpět – zůstat u: OpenAI Codex CLI – v terminálu\nVybrat \[0\]/);
  assert.match(m.out, /Aplikace ChatGPT \(Codex\) se neotevřela/);
  assert.ok(!fs.existsSync(path.join(w.dir, "codex.calls")), "not the CLI");
  assert.equal(cfg().agentWhere, "terminal");
  // the same once: strom chat --where
  assert.match((await w.ok(["chat", "--print", "--where", "app", "--json"])).json.link, /^codex:\/\/new\?path=/);
  assert.match((await w.run(["chat", "--print", "--where", "window"])).err, /takes app or terminal/);
  // installed again over settings kept from a strom that never asked (the agent had one form then): asked now, the
  // app suggested (once a process: the one run of the installer here)
  w.env.STROM_INSTALLER = "1";
  const kept = cfg();
  delete kept.agentWhere;
  kept.agent = "claude";
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify(kept));
  const re = await w.ok([], { tty: true, answers: ["", "n", "0"] });
  assert.match(re.out, /Který AI agent a kde s ním mluvit\?\n {3}1 {2}Claude – aplikace[^\n]*\n {3}2 [^\n]*\n {3}3 [^\n]*\nVybrat \[1\]/);
  assert.equal(cfg().agentWhere, "app");
  // an agent sets strom up: the way said, the other one named for the person to decide
  delete w.env.STROM_INSTALLER;
  const yes = await w.ok(["setup", "--yes", "--agent", "codex"]);
  assert.match(yes.out, /rozhovor +v aplikaci ChatGPT \(Codex\) – obojí je tu; rozhoduje uživatel: strom setup --where terminal/);
  await w.ok(["setup", "--yes", "--where", "terminal"]);
  assert.equal(cfg().agentWhere, "terminal");
  w.cleanup();

  // only the apps: they are named as apps; one form of one agent: nothing asked
  const a = new World();
  a.env.PATH = pathWith(a, []);
  a.env.STROM_APP_DIRS = appsWith(a, ["Claude.app", "Codex.app"]);
  const o = await a.ok(["setup"], { answers: ["cs", "", "", "", "", "", "n"] });
  assert.match(o.out, /\n {3}1 {2}Claude – aplikace \(nejjednodušší\)\n {3}2 {2}ChatGPT \(Codex\) – aplikace \(nejjednodušší\)\nVybrat \[1\]/);
  assert.doesNotMatch(/mluvit\?\n([^]*?)Vybrat/.exec(o.out)![1]!, /Claude Code|Codex CLI|terminál/, "no CLI here: none named");
  a.cleanup();
  const one = new World();
  one.env.PATH = pathWith(one, ["grok"]);
  const g = await one.ok(["setup"], { answers: ["cs", "", "", "", "n"] });
  assert.doesNotMatch(g.out, /kde s ním mluvit/);
  assert.match(g.out, /✓ AI agent: Grok Build – v terminálu/);
  one.cleanup();
});

test("an agent in a desktop app sets strom up: that is where the person talks; only the app — no working alone", unix, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, []);
  w.env.STROM_APP_DIRS = appsWith(w, ["Claude.app"]);
  w.env.CLAUDE_CODE_ENTRYPOINT = "claude-desktop";
  w.env.CLAUDECODE = "1";
  const s = await w.ok(["setup", "--yes", "--lang", "cs"]);
  assert.doesNotMatch(s.out, /not installed yet/, "the app is the agent");
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).agentWhere, "app");
  delete w.env.CLAUDE_CODE_ENTRYPOINT;
  delete w.env.CLAUDECODE;
  await w.ok(["init", "Novákovi"]);
  const m = await w.ok([], { tty: true, answers: ["2", "", "0"] });
  assert.match(m.out, /Samostatná práce potřebuje Claude Code v terminálu/);
  w.cleanup();
});

test("Gemini CLI is gone: a tree's files for it are taken away, a stored choice is Antigravity", unix, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["agy"]);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  const tree = w.treeDir("Novákovi");
  w.cwd = tree;
  // What strom wrote for Gemini CLI before.
  fs.writeFileSync(path.join(tree, "GEMINI.md"), "@./AGENTS.md\n\n<!-- strom: generated above this line (strom agents sync); your own notes below are kept -->\n");
  fs.mkdirSync(path.join(tree, ".gemini"));
  fs.writeFileSync(path.join(tree, ".gemini", "strom-policy.toml"), "# strom: generated (strom agents sync) — the rules Gemini CLI follows in this tree\n");
  await w.ok(["agents", "sync"]);
  assert.ok(!fs.existsSync(path.join(tree, "GEMINI.md")));
  assert.ok(!fs.existsSync(path.join(tree, ".gemini")));
  const cfgFile = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  fs.writeFileSync(cfgFile, JSON.stringify({ ...readJsonFile(cfgFile), agent: "gemini" }));
  assert.equal((await w.ok(["config", "get", "agent", "--json"])).json.value, "antigravity");
  w.cleanup();
});

test("conversation levels map to each agent's own switches", () => {
  const o = { root: "/t", kickoff: "k", settingsFile: "/t/.claude/settings.json", shared: "/s" };
  assert.deepEqual(conversationArgs("claude", { ...o, level: "ask" }), ["k", "--settings", "/t/.claude/settings.json"]);
  assert.deepEqual(conversationArgs("claude", { ...o, level: "full" }).slice(1, 3), ["--permission-mode", "bypassPermissions"]);
  assert.deepEqual(conversationArgs("codex", { ...o, level: "ask" }).slice(0, 4), ["--sandbox", "workspace-write", "--ask-for-approval", "on-request"]);
  assert.deepEqual(conversationArgs("codex", { ...o, level: "full" }).slice(0, 1), ["--dangerously-bypass-approvals-and-sandbox"]);
  assert.ok(!conversationArgs("codex", { ...o, level: "full" }).some((a) => a.includes("writable_roots")), "no sandbox: nothing to add");
  // its sandbox keeps a .git read-only even in the folder it works in: strom commits every change there
  assert.ok(conversationArgs("codex", { ...o, level: "ask" }).includes(`sandbox_workspace_write.writable_roots=${JSON.stringify([path.join("/t", ".git"), "/s"])}`));
  assert.deepEqual(conversationArgs("opencode", { ...o, level: "ask" }), ["--prompt", "k"]);
  assert.deepEqual(conversationArgs("opencode", { ...o, level: "full", model: "anthropic/claude-sonnet-5" }), ["--auto", "--prompt", "k"], "its conversation takes no --model: the tree's opencode.json has it");
  assert.deepEqual(conversationArgs("grok", { ...o, level: "ask" }), ["--trust", "k"], "ask: its own mode");
  assert.deepEqual(conversationArgs("grok", { ...o, level: "full", model: "grok-4.7" }), ["--trust", "--always-approve", "--model", "grok-4.7", "k"]);
});

test("which agent runs strom: Grok passes on the terminal it was started from; an agent strom starts gets no marks of another", () => {
  assert.equal(detectAgent({ GROK_AGENT: "1", CLAUDECODE: "1", CLAUDE_CODE_ENTRYPOINT: "cli" }), "grok");
  assert.equal(detectAgent({ CLAUDECODE: "1" }), "claude");
  assert.equal(detectAgent({ CURSOR_AGENT: "1", SAND_BOX_ID: "x" }), "cursor", "Cursor's agents, Grok Bot among them");
  const env = withoutAgentMarks({ PATH: "/bin", GROK_AGENT: "1", GROK_SESSION_ID: "x", CODEX_HOME: "/c", CODEX_THREAD_ID: "t", STROM_HOME: "/s" });
  assert.deepEqual(env, { PATH: "/bin", CODEX_HOME: "/c", STROM_HOME: "/s" }, "an agent's own settings (…_HOME) and strom's stay");
});

test("agents learn about strom in any folder, and forget it again; the user's own text stays", async () => {
  const w = new World();
  const codex = path.join(w.env.HOME!, ".codex", "AGENTS.md");
  fs.mkdirSync(path.dirname(codex), { recursive: true });
  fs.writeFileSync(codex, "# My rules\n\nAlways answer briefly.\n");
  await w.ok(["agents", "install", "--all"]);
  await w.ok(["agents", "install", "--all"]);
  const text = fs.readFileSync(codex, "utf8");
  assert.equal(text.match(/strom: begin/g)?.length, 1, "once, however often");
  assert.ok(text.startsWith("# My rules\n\nAlways answer briefly.\n"));
  assert.ok(fs.existsSync(path.join(w.env.HOME!, ".claude", "skills", "strom", "SKILL.md")));
  // Claude Code (and its app) run strom without asking; the user's own settings are kept.
  const claudeSettings = path.join(w.env.HOME!, ".claude", "settings.json");
  assert.deepEqual(readJsonFile(claudeSettings).permissions.allow, ["Bash(strom:*)", "PowerShell(strom:*)"], "each of its shells: Windows runs PowerShell");
  // (another installation of strom — the installer's command — also allowed itself by its path)
  fs.writeFileSync(claudeSettings, JSON.stringify({ model: "opus", permissions: { allow: ["Bash(git status:*)", "Bash(strom:*)", "Bash(/Users/x/.local/bin/strom:*)", "PowerShell(C:\\Users\\x\\AppData\\Local\\Programs\\Strom\\strom.cmd:*)", "Bash(stromboli:*)"], deny: ["Read(.env)"] } }));
  assert.match(fs.readFileSync(path.join(w.env.HOME!, ".gemini", "GEMINI.md"), "utf8"), /strom — family history research/);
  // Antigravity: its global rules where Gemini CLI kept them, strom allowed in its own settings, the user's settings kept.
  const agySettings = path.join(w.env.HOME!, ".gemini", "antigravity-cli", "settings.json");
  assert.deepEqual(readJsonFile(agySettings).permissions.allow, ["command(strom)"]);
  fs.writeFileSync(agySettings, JSON.stringify({ theme: "dark", permissions: { allow: ["command(git)", "command(strom)"] } }));
  // OpenCode: its own file named in its config, strom allowed there; a global AGENTS.md
  // of strom's would hide the user's ~/.claude/CLAUDE.md from it.
  const ocDir = path.join(w.env.HOME!, ".config", "opencode");
  const ocOwn = path.join(ocDir, "strom.md");
  assert.match(fs.readFileSync(ocOwn, "utf8"), /strom — family history research/);
  assert.ok(!fs.existsSync(path.join(ocDir, "AGENTS.md")));
  assert.deepEqual(readJsonFile(path.join(ocDir, "opencode.json")), { permission: { bash: { "strom *": "allow" } }, instructions: [ocOwn] });
  fs.writeFileSync(path.join(ocDir, "opencode.json"), JSON.stringify({ theme: "tokyonight", permission: { bash: "ask" }, instructions: ["~/rules.md"] }));
  // Grok Build: a skill of its own, strom allowed in its config.toml (strom's lines marked).
  const grokDir = path.join(w.env.HOME!, ".grok");
  assert.match(fs.readFileSync(path.join(grokDir, "skills", "strom", "SKILL.md"), "utf8"), /^---\nname: strom\n/);
  assert.match(fs.readFileSync(path.join(grokDir, "config.toml"), "utf8"), /^# strom: begin .*\n\[permission\]\nallow = \["Bash\(strom:\*\)"\]\n# strom: end\n$/);
  // the user's own table: strom's allow list goes into it (a second [permission] would break the file)
  const userToml = '[cli]\ninstaller = "internal"\n\n[permission]\ndeny = ["Bash(rm -rf *)"]\n\n[ui]\npermission_mode = "auto"\n';
  fs.writeFileSync(path.join(grokDir, "config.toml"), userToml);
  await w.ok(["agents", "install", "--all"]);
  const grokToml = fs.readFileSync(path.join(grokDir, "config.toml"), "utf8");
  assert.equal(grokToml.match(/^\[permission\]/gm)?.length, 1);
  assert.match(grokToml, /\[permission\]\n# strom: begin .*\nallow = \["Bash\(strom:\*\)"\]\n# strom: end\ndeny = /);
  assert.deepEqual(readJsonFile(path.join(ocDir, "opencode.json")), { theme: "tokyonight", permission: { bash: { "*": "ask", "strom *": "allow" } }, instructions: ["~/rules.md", ocOwn] });
  await w.ok(["agents", "uninstall"]);
  assert.equal(fs.readFileSync(path.join(grokDir, "config.toml"), "utf8"), userToml, "the user's file as it was");
  assert.ok(!fs.existsSync(path.join(grokDir, "skills", "strom")));
  assert.equal(fs.readFileSync(path.join(ocDir, "opencode.json"), "utf8"), JSON.stringify({ theme: "tokyonight", permission: { bash: "ask" }, instructions: ["~/rules.md"] }), "the user's file as it was, its plain bash rule too");
  assert.ok(!fs.existsSync(ocOwn));
  assert.deepEqual(readJsonFile(agySettings), { theme: "dark", permissions: { allow: ["command(git)"] } });
  assert.equal(fs.readFileSync(codex, "utf8"), "# My rules\n\nAlways answer briefly.\n");
  assert.ok(!fs.existsSync(path.join(w.env.HOME!, ".claude", "skills", "strom")));
  assert.deepEqual(readJsonFile(claudeSettings), { model: "opus", permissions: { allow: ["Bash(git status:*)", "Bash(stromboli:*)"], deny: ["Read(.env)"] } });
  assert.ok(!fs.existsSync(path.join(w.env.HOME!, ".gemini", "GEMINI.md")), "nothing else was in it");
  w.cleanup();
});

test("an agent's TOML config: the person's text after strom's block stays where it is, and the block goes out exactly", async () => {
  const w = new World();
  const toml = path.join(w.env.HOME!, ".grok", "config.toml");
  fs.mkdirSync(path.dirname(toml), { recursive: true });
  const mine = '# Moje nastavení — 設定, настройки\n[cli]\ninstaller = "internal"\n';
  fs.writeFileSync(toml, mine);
  await w.ok(["agents", "install", "--all"]);
  // the person writes their own text after strom's block
  const after = '\n[ui]\ntheme = "dark" # tmavé, тёмная\n';
  fs.appendFileSync(toml, after);
  const written = fs.readFileSync(toml, "utf8");
  // installed again: nothing moved, no second block — it is there as it is
  const again = await w.ok(["agents", "install", "--all", "--json"]);
  assert.equal(JSON.parse(again.out).agents.find((r: { file: string }) => r.file === toml).written, false);
  assert.equal(fs.readFileSync(toml, "utf8"), written);
  const r = await w.ok(["agents", "uninstall", "--json"]);
  assert.ok(JSON.parse(r.out).agents.some((x: { file: string }) => x.file === toml), "the config is in what uninstall took strom out of");
  assert.equal(fs.readFileSync(toml, "utf8"), mine + after, "the person's text before and after, byte for byte");
  // a file strom created, the person's text after its block: that text stays alone
  fs.rmSync(toml);
  await w.ok(["agents", "install", "--all"]);
  fs.appendFileSync(toml, after);
  await w.ok(["agents", "uninstall"]);
  assert.equal(fs.readFileSync(toml, "utf8"), after.slice(1));
  // the person's own line breaks (CRLF) and no line break at the end: back as they were
  const crlf = '[cli]\r\ninstaller = "internal" # Příliš žluťoučký kůň';
  fs.writeFileSync(toml, crlf);
  await w.ok(["agents", "install", "--all"]);
  assert.doesNotMatch(fs.readFileSync(toml, "utf8").replace(/\r\n/g, ""), /\n/, "strom's lines end as the person's do");
  await w.ok(["agents", "uninstall"]);
  assert.equal(fs.readFileSync(toml, "utf8"), crlf);
  w.cleanup();
});

test("an agent's TOML config: the person's text right after strom's block, or in a file that was empty, comes back byte for byte", async () => {
  const w = new World();
  const toml = path.join(w.env.HOME!, ".grok", "config.toml");
  fs.mkdirSync(path.dirname(toml), { recursive: true });
  const round = async (mine: string, edit: (written: string) => string, expected: string, what: string) => {
    fs.writeFileSync(toml, mine);
    await w.ok(["agents", "install", "--all"]);
    fs.writeFileSync(toml, edit(fs.readFileSync(toml, "utf8")));
    await w.ok(["agents", "uninstall"]);
    assert.equal(fs.readFileSync(toml, "utf8"), expected, what);
  };
  const mine = 'model = "grok-4" # Příliš žluťoučký kůň\n';
  const ui = '[ui]\ntheme = "dark" # tmavé, тёмная\n';
  // the person's text right after strom's end line, no blank line between: the blank line strom put before its block goes too
  await round(mine, (t) => t + ui, mine + ui, "text right after the end line");
  await round('[cli]\r\na = 1\r\n', (t) => t + '[ui]\r\nb = "設定"\r\n', '[cli]\r\na = 1\r\n[ui]\r\nb = "設定"\r\n', "CRLF, text right after the end line");
  // the end line deleted, the person's own table right after strom's last line
  const tools = '[tools]\nallow = ["Bash(ls:*)"]\n';
  await round(mine, (t) => t.replace("# strom: end\n", "") + tools, mine + tools, "the end line gone, text right after the block");
  // an empty file: strom's block first, the person's blank line and table after it stay theirs
  await round("", (t) => t + "\n" + ui, "\n" + ui, "an empty file, then the person's blank line and table");
  await round("", (t) => t + ui, ui, "an empty file, then the person's table");
  w.cleanup();
});

test("the agents' settings files of the person's on one line, with their own spaces, come back as they were; strom's entries are spaced the same way", async () => {
  const w = new World();
  const at = (...p: string[]) => path.join(w.env.HOME!, ...p);
  const claude = at(".claude", "settings.json");
  const agy = at(".gemini", "antigravity-cli", "settings.json");
  const oc = at(".config", "opencode", "opencode.json");
  const files: [string, string][] = [
    [claude, '{"model": "opus", "env": {"A": "1", "POZDRAV": "Dobrý den — こんにちは"}}'],
    [agy, '{ "theme": "dark" }'],
    [oc, '{ "theme": "тёмная", "instructions": [ "~/a.md" ] }\n'],
  ];
  for (const [f, text] of files) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
  }
  await w.ok(["agents", "install", "--all"]);
  assert.equal(fs.readFileSync(agy, "utf8"), '{ "theme": "dark", "permissions": { "allow": ["command(strom)"] } }', "strom's entries in the person's spacing");
  assert.match(fs.readFileSync(claude, "utf8"), /^\{"model": "opus", "env": \{"A": "1", "POZDRAV": "Dobrý den — こんにちは"\}, "permissions": \{"allow": \["Bash\(strom:\*\)", /);
  assert.match(fs.readFileSync(oc, "utf8"), /^\{ "theme": "тёмная", "instructions": \[ "~\/a\.md", "[^"]+strom\.md" \], "permission": \{ "bash": \{ "strom \*": "allow" \} \} \}\n$/);
  await w.ok(["agents", "uninstall"]);
  for (const [f, text] of files) assert.equal(fs.readFileSync(f, "utf8"), text, `${f}: byte for byte as it was`);
  // compact stays compact
  fs.writeFileSync(agy, '{"theme":"dark"}');
  await w.ok(["agents", "install", "--all"]);
  assert.equal(fs.readFileSync(agy, "utf8"), '{"theme":"dark","permissions":{"allow":["command(strom)"]}}');
  await w.ok(["agents", "uninstall"]);
  assert.equal(fs.readFileSync(agy, "utf8"), '{"theme":"dark"}');
  w.cleanup();
});

test("the agents' settings files of the person's come back from an install and an uninstall as they were: their layout, their empty objects", async () => {
  const w = new World();
  const at = (...p: string[]) => path.join(w.env.HOME!, ...p);
  const claude = at(".claude", "settings.json");
  const agy = at(".gemini", "antigravity-cli", "settings.json");
  const oc = at(".config", "opencode", "opencode.json");
  const rounds: [string, string][][] = [
    [
      // compact, no line break at the end
      [claude, '{"model":"opus","permissions":{"allow":["Bash(ls:*)"]},"env":{"POZDRAV":"Dobrý den — こんにちは","ESC":"\\u00e9\\t"}}'],
      // tabs, an empty permissions object of the person's
      [agy, '{\n\t"theme": "tmavá",\n\t"permissions": {}\n}\n'],
      // four spaces, a plain bash rule, an empty list of instructions
      [oc, '{\n    "theme": "тёмная",\n    "permission": {\n        "bash": "ask"\n    },\n    "instructions": []\n}\n'],
    ],
    [
      // an empty allow list of the person's, CRLF line breaks
      [claude, '{\r\n  "permissions": {\r\n    "allow": [],\r\n    "deny": ["Read(./tajné.env)"]\r\n  }\r\n}\r\n'],
      // {} with no line break at the end; a blank file
      [agy, "{}"],
      [oc, "\n"],
    ],
    [[claude, "  {}\n\n"], [agy, '{"permissions":{"allow":[]}}'], [oc, '{"permission":"ask"}']],
  ];
  for (const files of rounds) {
    for (const [f, text] of files) {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, text);
    }
    await w.ok(["agents", "install", "--all"]);
    for (const [f] of files) assert.match(fs.readFileSync(f, "utf8"), /strom/, `${f}: strom allowed`);
    await w.ok(["agents", "uninstall"]);
    for (const [f, text] of files) assert.equal(fs.readFileSync(f, "utf8"), text, `${f}: byte for byte as it was`);
  }
  // strom's lines are written in the person's way
  fs.writeFileSync(agy, '{\n\t"theme": "tmavá"\n}');
  await w.ok(["agents", "install", "--all"]);
  assert.equal(fs.readFileSync(agy, "utf8"), '{\n\t"theme": "tmavá",\n\t"permissions": {\n\t\t"allow": [\n\t\t\t"command(strom)"\n\t\t]\n\t}\n}');
  w.cleanup();
});

test("agents forget strom: what the install created goes when nothing else is in it, folders too; the person's files stay, also empty", async () => {
  const w = new World();
  const home = w.env.HOME!;
  const at = (...p: string[]) => path.join(home, ...p);
  const agentDirs = [".claude", ".codex", ".gemini", ".grok", path.join(".config", "opencode")];
  for (const d of agentDirs) assert.ok(!fs.existsSync(at(d)));
  // nothing of the agents here: everything strom writes is its own
  await w.ok(["agents", "install", "--all"]);
  assert.ok(fs.existsSync(at(".claude", "settings.json")));
  await w.ok(["agents", "uninstall"]);
  for (const f of [[".claude", "settings.json"], [".gemini", "antigravity-cli", "settings.json"], [".config", "opencode", "opencode.json"], [".grok", "config.toml"], [".codex", "AGENTS.md"], [".gemini", "GEMINI.md"]])
    assert.ok(!fs.existsSync(at(...f)), `${f.join("/")}: strom's alone, gone (found: {} left behind)`);
  for (const d of [...agentDirs, ".config"]) assert.ok(!fs.existsSync(at(d)), `${d}: a folder strom made, empty, gone`);
  // the person's files, empty or with nothing but what strom then adds: they stay, and their folders
  const mine: [string[], string][] = [
    [[".claude", "settings.json"], "{}\n"],
    [[".gemini", "antigravity-cli", "settings.json"], ""],
    [[".config", "opencode", "opencode.json"], "{}"],
    [[".grok", "config.toml"], ""],
    [[".codex", "AGENTS.md"], ""],
    [[".gemini", "GEMINI.md"], "\n"],
  ];
  for (const [f, text] of mine) {
    fs.mkdirSync(path.dirname(at(...f)), { recursive: true });
    fs.writeFileSync(at(...f), text);
  }
  await w.ok(["agents", "install", "--all"]);
  assert.match(fs.readFileSync(at(".codex", "AGENTS.md"), "utf8"), /strom: begin/);
  await w.ok(["agents", "uninstall"]);
  for (const [f] of mine) assert.ok(fs.existsSync(at(...f)), `${f.join("/")}: the person's, kept`);
  assert.deepEqual(readJsonFile(at(".claude", "settings.json")), {});
  assert.deepEqual(readJsonFile(at(".config", "opencode", "opencode.json")), {});
  assert.equal(fs.readFileSync(at(".grok", "config.toml"), "utf8"), "");
  assert.equal(fs.readFileSync(at(".codex", "AGENTS.md"), "utf8"), "");
  // the skills strom made in a folder of the person's: the skill and the skills folder go, the person's folder stays
  assert.ok(!fs.existsSync(at(".claude", "skills")) && !fs.existsSync(at(".grok", "skills")));
  w.cleanup();
});

test("agents install and uninstall speak the person's language (cs, de), never to the person; English as before", async () => {
  const w = new World();
  w.env.STROM_LANG = "cs";
  const none = await w.ok(["agents", "install"], { env: { ...w.env, PATH: "" } });
  assert.match(none.out, /žádný agent AI tu není nainstalovaný — strom setup ho nabídne/);
  await w.ok(["agents", "install", "--all"]);
  const again = await w.ok(["agents", "install", "--all"]);
  assert.match(again.out, /Claude Code: .*settings\.json \(už tam je\)/);
  const r = await w.ok(["agents", "uninstall"]);
  assert.match(r.out, /Claude Code: odebráno z .*settings\.json/);
  assert.doesNotMatch(r.out, /removed from/);
  assert.match((await w.ok(["agents", "uninstall"])).out, /není co odebrat/);
  await w.ok(["agents", "install", "--all"]);
  assert.match((await w.ok(["agents", "uninstall"], { env: { ...w.env, STROM_LANG: "de" } })).out, /Grok Build: entfernt aus .*config\.toml/);
  await w.ok(["agents", "install", "--all"]);
  assert.match((await w.ok(["agents", "uninstall"], { env: { ...w.env, STROM_LANG: "en" } })).out, /OpenAI Codex CLI: removed from .*AGENTS\.md/);
  w.cleanup();
});

test("agents forget strom after an installation that recorded nothing it created (1.12.1, the betas before): its files stay as that uninstall left them", async () => {
  const w = new World();
  const home = w.env.HOME!;
  await w.ok(["agents", "install", "--all"]);
  // an older strom kept no record; a newer one refreshing what it taught does not take the files for the person's
  const record = path.join(w.env.STROM_CONFIG_DIR!, "agents-taught.json");
  assert.ok(fs.existsSync(record), "this strom records what it created");
  fs.rmSync(record);
  await w.ok(["agents", "install", "--all"]);
  await w.ok(["agents", "uninstall"]);
  // whose the settings are nobody can tell: kept, as {}; a text file with nothing but strom's part went before too
  assert.deepEqual(readJsonFile(path.join(home, ".claude", "settings.json")), {});
  assert.deepEqual(readJsonFile(path.join(home, ".gemini", "antigravity-cli", "settings.json")), {});
  assert.deepEqual(readJsonFile(path.join(home, ".config", "opencode", "opencode.json")), {});
  assert.ok(!fs.existsSync(path.join(home, ".codex", "AGENTS.md")));
  assert.ok(!fs.existsSync(path.join(home, ".claude", "skills", "strom")));
  // an empty {} such an uninstall left: not strom's to take, whatever comes later
  await w.ok(["agents", "uninstall"]);
  assert.ok(fs.existsSync(path.join(home, ".claude", "settings.json")));
  w.cleanup();
});

test("a file strom created that the person deleted and made again is the person's: an install and uninstall later keep it", async () => {
  const w = new World();
  const home = w.env.HOME!;
  const settings = path.join(home, ".claude", "settings.json");
  const agents = path.join(home, ".codex", "AGENTS.md");
  await w.ok(["agents", "install", "--all"]);
  // the person deletes strom's files and makes their own
  fs.writeFileSync(settings, "{}\n");
  fs.writeFileSync(agents, "");
  await w.ok(["agents", "install", "--all"]);
  await w.ok(["agents", "uninstall"]);
  assert.equal(fs.readFileSync(settings, "utf8"), "{}\n", "the person's {} stays");
  assert.equal(fs.readFileSync(agents, "utf8"), "", "the person's empty AGENTS.md stays");
  w.cleanup();
});

test("the Strom app: noticed quietly — started by it, or installed from the browser", async () => {
  assert.ok(isStromName("Strom"));
  assert.ok(isStromName("Strom - Family Tree"));
  assert.ok(!isStromName("Strom Research"));
  assert.ok(!isStromName("Stromboli"));
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const cfg = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  assert.equal(cfg().stromAppSeen, undefined);
  // A Chrome app on macOS, a Start menu shortcut on Windows, a .desktop entry on Linux.
  const home = w.env.HOME!;
  // Each with the app's id in its browser (and the profile), so that strom opens the research in the app's own window.
  const id = "gggninmgbfdjkafhnhdnaaaopeicjmjo";
  const mac = path.join(home, "Applications", "Chrome Apps.localized", "Strom.app", "Contents");
  fs.mkdirSync(mac, { recursive: true });
  fs.writeFileSync(path.join(mac, "Info.plist"), `<?xml version="1.0"?><plist><dict>\n\t<key>CrAppModeShortcutID</key>\n\t<string>${id}</string>\n</dict></plist>`);
  assert.deepEqual(installedStromApp(w.env, "darwin"), { path: path.dirname(mac), kind: "Chrome app", browser: "Google Chrome", appId: id });
  const start = path.join(home, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Edge Apps");
  fs.mkdirSync(start, { recursive: true });
  fs.writeFileSync(path.join(start, "Strom.lnk"), Buffer.concat([Buffer.from([0x4c, 0, 0, 0]), Buffer.from(`--profile-directory="Profile 2" --app-id=${id}`, "utf16le")]));
  assert.deepEqual(installedStromApp({ ...w.env, APPDATA: undefined }, "win32"), { path: path.join(start, "Strom.lnk"), kind: "Edge App", browser: "Microsoft Edge", appId: id, profile: "Profile 2" });
  const apps = path.join(home, ".local", "share", "applications");
  fs.mkdirSync(apps, { recursive: true });
  fs.writeFileSync(path.join(apps, "chrome-abc-Default.desktop"), `[Desktop Entry]\nName=Strom\nExec=/opt/google/chrome/google-chrome --profile-directory=Default --app-id=${id}\n`);
  assert.deepEqual(installedStromApp(w.env, "linux"), { path: path.join(apps, "chrome-abc-Default.desktop"), kind: "browser app", browser: "Google Chrome", appId: id, profile: "Default" });
  // Its beta installed beside it is another app: each copy found by the address its shortcut gives (macOS, Linux).
  const beta = "gfdlgdadfagpfefeenjhmokfielbhchn";
  const plist = (app: string, at: string, url: string) => {
    const dir = path.join(home, "Applications", "Chrome Apps.localized", app, "Contents");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "Info.plist"), `<plist><dict>\n\t<key>CrAppModeShortcutID</key>\n\t<string>${at}</string>\n\t<key>CrAppModeShortcutURL</key>\n\t<string>${url}</string>\n</dict></plist>`);
    return path.dirname(dir);
  };
  fs.rmSync(path.dirname(mac), { recursive: true });
  const betaApp = plist("Strom Beta.app", beta, "https://beta.stromapp.info/run/");
  assert.equal(installedStromApp(w.env, "darwin"), undefined, "the beta is not the app of stromapp.info");
  assert.equal(installedStromApp(w.env, "darwin", "https://beta.stromapp.info/run/")?.path, betaApp);
  const mainApp = plist("Strom - Family Tree.app", id, "https://stromapp.info/run/");
  assert.equal(installedStromApp(w.env, "darwin")?.path, mainApp);
  assert.equal(installedStromApp(w.env, "darwin", "https://beta.stromapp.info/run/")?.appId, beta);
  assert.equal(installedStromApp(w.env, "darwin", "http://127.0.0.1:8080/"), undefined, "a development copy is not installed");
  assert.equal(installedStromApp({ ...w.env, APPDATA: undefined }, "win32", "https://beta.stromapp.info/run/"), undefined, "a shortcut without its address: by its name, stromapp.info only");
  fs.writeFileSync(path.join(apps, "chrome-beta-Default.desktop"), `[Desktop Entry]\nName=Strom Beta\nExec=/opt/google/chrome/google-chrome --profile-directory=Default --app=https://beta.stromapp.info/run/\n`);
  assert.equal(installedStromApp(w.env, "linux", "https://beta.stromapp.info/run/")?.path, path.join(apps, "chrome-beta-Default.desktop"));
  // The copy strom opens is the user's setting.
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  assert.equal(cfg().stromAppUrl, "https://beta.stromapp.info/run/");
  assert.match((await w.run(["config", "set", "strom.app.url", "https://example.org/"])).err, /neplatné strom\.app\.url „https:\/\/example\.org\/“/);
  await w.ok(["config", "unset", "strom.app.url"]);
  assert.equal(cfg().stromAppUrl, undefined);
  // The profile that holds it (folder names only).
  fs.mkdirSync(path.join(home, "Library", "Application Support", "Google", "Chrome", "Profile 3", "Web Applications", "Manifest Resources", id), { recursive: true });
  assert.equal(webAppProfile("Google Chrome", id, w.env, "darwin"), "Profile 3");
  // The app starts strom: remembered, nothing asked.
  w.env.STROM_APP = "1";
  w.env.STROM_APP_VERSION = "2.8.0";
  await w.ok(["config", "where"]);
  assert.deepEqual([cfg().stromAppSeen.via, cfg().stromAppSeen.version], ["started strom", "2.8.0"]);
  // The user's no stands.
  await w.ok(["config", "set", "strom.app", "no"]);
  const r = await w.ok(["app", "--json"]);
  assert.equal(r.json.opened, false, "tests open nothing");
  assert.equal(r.json.url, "https://stromapp.info/run/");
  w.cleanup();
});

test("the Strom app offered gently: the wizard asks once, the menu says what it can do, a run can be watched live", unix, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude"]);
  const cfg = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  // language, folder, model, stories, level, no shortcut — then the Strom app: not now
  const s = await w.ok(["setup"], { answers: ["cs", "", "", "", "", "n", "2"] });
  assert.match(s.out, /Aplikace Strom \(zdarma, v prohlížeči\) ukáže výzkum jako rodokmen[\s\S]*1 {2}Ano – nainstalovat ji teď/);
  assert.equal(cfg().stromApp, "yes");
  // Again: the answer pre-filled; no — never mentioned after.
  await w.ok(["setup"], { answers: ["", "", "", "", "", "n", "3"] });
  assert.equal(cfg().stromApp, "no");
  await w.ok(["init", "Novákovi"]);
  const none = await w.ok([], { tty: true, answers: ["0"] });
  assert.doesNotMatch(none.out, /aplikac/i, "the user's no stands");
  // Not said yet (an older setup): one quiet line and an item that explains — the answer here: install it.
  await w.ok(["config", "unset", "strom.app"]);
  const tip = await w.ok([], { tty: true, answers: ["7", "1", "n", "0"] });
  assert.match(tip.out, /Tip: výzkum jde prohlížet jako rodokmen v aplikaci Strom a sledovat ho živě, když agent pracuje – volba 7\./);
  assert.match(tip.out, /7 {2}Aplikace Strom – výzkum jako rodokmen, sledovaný živě/);
  assert.match(tip.out, /Otevřít ji zde: https:\/\/stromapp\.info\/run\//, "tests open nothing: the address is said");
  assert.match(tip.out, /Až bude nainstalovaná: otevřít v ní výzkum\?/);
  assert.equal(cfg().stromApp, "yes");
  // Wanted: the item opens the research, no tip; while an agent is at work it says so.
  const plain = await w.ok([], { tty: true, answers: ["0"] });
  assert.match(plain.out, /7 {2}Otevřít výzkum v aplikaci Strom/);
  assert.doesNotMatch(plain.out, /Tip:/);
  const leave = enterWorker(w.treeDir("Novákovi"), "codex-1", "Codex conversation");
  const busy = await w.ok([], { tty: true, answers: ["0"] });
  assert.match(busy.out, /Agent pracuje – živě ho jde sledovat v aplikaci Strom: volba 7\./);
  assert.match(busy.out, /7 {2}Sledovat práci agenta v aplikaci Strom \(živě\)/);
  leave();
  // Working alone, with a browser that reaches the bridge: watched live meanwhile? The last answer is suggested.
  w.env.STROM_APP_DIRS = appsWith(w, ["Google Chrome.app"]);
  fs.writeFileSync(path.join(w.dir, "Applications", "google-chrome"), "", { mode: 0o755 });
  const run = await w.run([], { tty: true, answers: ["2", "1", "n", "", "0"] });
  assert.match(run.out, /Sledovat mezitím práci živě v aplikaci Strom\? \(a\/n\) \[a\]/);
  assert.equal(cfg().stromAppFollow, "no");
  const again = await w.run([], { tty: true, answers: ["2", "1"] });
  assert.match(again.out, /Sledovat mezitím práci živě v aplikaci Strom\? \(a\/n\) \[n\]/);
  w.cleanup();
});

test("the results: strom tells the agent to offer the Strom app when it is not installed here — never when unwanted", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--born", "1905"]);
  await w.ok(["export", "gedcom"]);
  w.env.CLAUDECODE = "1";
  // A run nobody watches tells nobody: nothing is marked as told.
  w.env.STROM_SESSION = "X0001";
  assert.equal((await w.ok(["--json"])).json.stories, "tell");
  delete w.env.STROM_SESSION;
  const first = await w.ok([]);
  assert.match(first.out, /výsledky .*tree-strom\.ged – pro aplikaci Strom, tady zatím nenainstalovanou: nabídni uživateli, že v ní může výzkum průběžně sledovat – instalace z https:\/\/stromapp\.info\/run\/ \(strom app install ji tam otevře a řekne, kam kliknout\), pak strom app/);
  assert.match(first.out, /vyprávění\s+zapnuté \(výchozí\): řekni uživateli \(strom to řekne jen jednou\)/);
  assert.match(first.out, /otázky\s+řekni uživateli jednou, jednou větou, že se tu může ptát na kohokoli ve stromu/);
  // Told once: a conversation started afresh (/clear, the next day) does not say it all again.
  const o = (await w.ok(["--json"])).json;
  assert.equal(o.results.app, "offer");
  assert.equal(o.results.told, true);
  assert.equal(o.stories, "on");
  assert.equal(o.ask, undefined);
  assert.match(o.results.file, /tree-strom\.ged$/);
  const again = await w.ok([]);
  assert.match(again.out, /tree-strom\.ged – pro aplikaci Strom, tady nenainstalovanou; uživatel o ní už ví – zmiň ji znovu, jen když chce vidět výsledky/);
  assert.doesNotMatch(again.out, /otázky|řekni uživateli/);
  assert.match((await w.ok(["guide"])).out, /THE STROM APP — where the user sees the result/);
  await w.ok(["config", "set", "strom.app", "no"]);
  const n = (await w.ok(["--json"])).json;
  assert.equal(n.results.app, "not-wanted");
  assert.match(n.results.file, /tree\.ged$/);
  w.cleanup();
});

/** A request to the bridge, as a page of some origin makes it. */
function ask(url: string, opts: { method?: string; headers?: Record<string, string> } = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: opts.method ?? "GET", headers: opts.headers ?? {} }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("the live bridge: the Strom app reads the tree and hears what changes — this computer only, the app's pages only", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree();
  w.env.STROM_LIVE_POLL_MS = "200";
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    assert.match(info.url, /^http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{32}$/);
    assert.match(info.app, /^https:\/\/stromapp\.info\/run\/\?live=http%3A%2F%2F127\.0\.0\.1/);
    assert.equal((await w.ok(["live", "start", "--json"])).json.pid, info.pid, "one bridge per tree");
    const status = JSON.parse((await ask(`${info.url}/status`)).body);
    assert.equal(status.tree.name, "Novákovi");
    assert.match((await ask(`${info.url}/tree.ged`)).body, /1 SOUR STROM_RESEARCH/);
    assert.equal((await ask(`http://127.0.0.1:${info.port}/${"0".repeat(32)}/status`)).status, 404, "without the secret: nothing");
    // Only the app's pages may read it; a browser asks first whether a public page may talk to this computer.
    assert.equal((await ask(`${info.url}/status`, { headers: { Origin: "https://stromapp.info" } })).headers["access-control-allow-origin"], "https://stromapp.info");
    assert.equal((await ask(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } })).headers["access-control-allow-origin"], "https://beta.stromapp.info", "its beta too");
    const pre = await ask(`${info.url}/status`, { method: "OPTIONS", headers: { Origin: "https://stromapp.info", "Access-Control-Request-Method": "GET", "Access-Control-Request-Private-Network": "true" } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers["access-control-allow-private-network"], "true");
    // What changes is heard: a person recorded → a change with what strom wrote.
    const heard = await new Promise<string>((resolve, reject) => {
      let text = "";
      let added = false;
      const req = http.get(`${info.url}/events`, (res) => {
        res.on("data", (d) => {
          text += d;
          if (text.includes("event: hello") && !added) {
            added = true;
            void w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]);
          }
          if (text.includes("event: change")) {
            req.destroy();
            resolve(text);
          }
        });
      });
      req.on("error", reject);
      setTimeout(() => (req.destroy(), reject(new Error(`no change heard: ${text}`))), 8000);
    });
    assert.match(heard, /event: change\ndata: .*Karel/);
    // when: the commit's own time, as /log gives it
    const change = JSON.parse(/event: change\ndata: (.*)/.exec(heard)![1]!) as { head: string; at: string; entries: { head: string; at: string; what: string[] }[] };
    assert.equal(change.at, spawnSync("git", ["log", "-1", "--format=%cI", change.head], { cwd: w.cwd, encoding: "utf8" }).stdout.trim());
    // each new commit as /log gives it
    assert.equal(change.entries[0]!.head, change.head);
    assert.equal(change.entries[0]!.at, change.at);
    assert.match(change.entries.flatMap((e) => e.what).join("\n"), /Karel/);
    // a page of another site: nothing for it — and its secret replaced (the address got out)
    const evil = await ask(`${info.url}/status`, { headers: { Origin: "https://evil.example" } });
    assert.equal(evil.headers["access-control-allow-origin"], undefined);
    assert.equal(evil.status, 404);
    assert.equal((await ask(`${info.url}/status`)).status, 404, "the old secret no longer works");
  } finally {
    await w.ok(["live", "stop"]);
  }
  assert.equal((await w.ok(["live", "--json"])).json.running, false);
  w.cleanup();
});

test("the live bridge does not end because of one error, says what happened in its log, and comes back on its address", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree();
  w.env.STROM_LIVE_POLL_MS = "100";
  const log = path.join(w.cwd, ".strom", "live.log");
  const first = (await w.ok(["live", "start", "--json"])).json;
  // The app follows it; meanwhile the tree cannot be read (another strom writing it that moment).
  const events = http.get(`${first.url}/events`);
  events.on("error", () => {});
  try {
    // its hello: the bridge has read the tree once (a slow start would find it broken and say "the start failed")
    await new Promise((r) => events.on("response", (res) => res.once("data", r)));
    const config = path.join(w.cwd, "strom.json");
    const good = fs.readFileSync(config, "utf8");
    fs.writeFileSync(config, good.slice(0, 20));
    await new Promise((r) => setTimeout(r, 500));
    const broken = await ask(`${first.url}/status`);
    assert.equal(broken.status, 500);
    assert.ok(JSON.parse(broken.body).error, "a short JSON");
    fs.writeFileSync(config, good);
    await new Promise((r) => setTimeout(r, 300));
    assert.equal((await ask(`${first.url}/status`)).status, 200, "it goes on");
    events.destroy();
    const said = fs.readFileSync(log, "utf8");
    assert.match(said, /started: strom .*a new address/);
    assert.match(said, /a tick failed \(tried again\): .*\n\s+at /, "the error with its stack");
    assert.equal(said.match(/a tick failed/g)!.length, 1, "written once, not at every tick");
    assert.match(said, /works again \(\d+× failed\)/);
    assert.match(said, /GET \/…\/status failed/, "the secret is not written");
    assert.doesNotMatch(said, new RegExp(first.token));
    // Stopped (for good) and started again: its port, a new secret — the app needs the new address.
    // live stop waits until the bridge has ended
    await w.ok(["live", "stop"]);
    assert.match(fs.readFileSync(log, "utf8"), /stop asked: strom live stop\n.*ended: SIGTERM\n.*its secret dropped \(strom live stop\)/);
    const again = (await w.ok(["live", "start", "--json"])).json;
    assert.equal(again.port, first.port);
    assert.notEqual(again.token, first.token);
    assert.equal(again.moved, true, "the app needs the new address: said");
    assert.match(fs.readFileSync(log, "utf8"), /the port of the last bridge, a new secret/);
    // Ended without a word (killed): the next session brings it back, on its address; one stopped stays stopped.
    process.kill(again.pid, "SIGKILL");
    // gone (its parent, this test, has heard it ended: no process of that number left)
    for (let i = 0; i < 250; i++) {
      try {
        process.kill(again.pid, 0);
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    await w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]);
    await w.ok(["session", "start"]);
    const back = (await w.ok(["live", "--json"])).json;
    assert.equal(back.running, true);
    assert.equal(back.url, again.url, "brought back by itself: its address kept");
    assert.notEqual(back.pid, again.pid);
    assert.match(fs.readFileSync(log, "utf8"), new RegExp(`the bridge ${again.pid} ended without a word: started again`));
    // A bridge of another version (strom updated under it): kept by live start, replaced by live start --current — at its
    // address (strom update does so: the app goes on by itself)
    const liveJson = path.join(w.cwd, ".strom", "live.json");
    fs.writeFileSync(liveJson, JSON.stringify({ ...readJsonFile(liveJson), version: "1.0.0" }));
    assert.equal((await w.ok(["live", "start", "--json"])).json.pid, back.pid);
    const current = (await w.ok(["live", "start", "--current", "--json"])).json;
    assert.notEqual(current.pid, back.pid);
    assert.equal(current.url, again.url, "started again for a newer strom: its address kept");
    assert.equal(current.version, VERSION);
    await w.ok(["live", "stop"]);
    await w.ok(["session", "close", "--continue", "--summary", "nothing yet", "--next", "the same again"]);
    await w.ok(["session", "start"]);
    assert.equal((await w.ok(["live", "--json"])).json.running, false, "stopped by the user: not brought back");
    // Its port taken meanwhile: another one.
    const blocker = http.createServer();
    await new Promise<void>((r) => blocker.listen(first.port, "127.0.0.1", r));
    try {
      const moved = (await w.ok(["live", "start", "--json"])).json;
      assert.notEqual(moved.port, first.port);
      assert.equal(moved.moved, true, "the app needs the new address: said");
      assert.match(fs.readFileSync(log, "utf8"), new RegExp(`port ${first.port} is taken: another one`));
    } finally {
      blocker.close();
    }
    // (the address of a bridge that ran: a stuck one below pretends to be it)
    const last = readJsonFile(path.join(w.cwd, ".strom", "live-last.json"));
    await w.ok(["live", "stop"]);
    // A bridge stuck on something (it does not end when asked) still holding its port: live stop ends it for good,
    // and the next bridge takes its port again — the app following it goes on
    const stuckCode = `process.on("SIGTERM",()=>{});const s=require("http").createServer(()=>{});s.listen(${last.port},"127.0.0.1");setInterval(()=>{},1000)`;
    // up: it holds the port (its SIGTERM handler set before)
    const holding = async () => {
      for (let i = 0; i < 100; i++) {
        const up = await new Promise<boolean>((r) => {
          const c = net.connect(last.port, "127.0.0.1", () => (c.destroy(), r(true)));
          c.on("error", () => r(false));
        });
        if (up) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error("the stuck bridge did not come up");
    };
    const stuck = spawn(process.execPath, ["-e", stuckCode, "live", "serve"], { stdio: "ignore", detached: true });
    stuck.unref();
    await holding();
    fs.writeFileSync(path.join(w.cwd, ".strom", "live-last.json"), JSON.stringify({ ...last, pid: stuck.pid, ended: undefined }));
    fs.writeFileSync(path.join(w.cwd, ".strom", "live.json"), JSON.stringify({ port: last.port, token: last.token, pid: stuck.pid, url: `http://127.0.0.1:${last.port}/${last.token}`, started: new Date().toISOString() }));
    const ended = await w.ok(["live", "stop", "--json"]);
    assert.equal(ended.json.how, "killed");
    const exited = (c: ReturnType<typeof spawn>) => new Promise((r) => (c.exitCode !== null || c.signalCode ? r(c.signalCode) : c.once("exit", (_code, sig) => r(sig))));
    assert.equal(await exited(stuck), "SIGKILL", "the process is gone");
    // …and one that still holds the port when a new bridge starts (its note gone): ended, its port taken again
    const stuck2 = spawn(process.execPath, ["-e", stuckCode, "live", "serve"], { stdio: "ignore", detached: true });
    stuck2.unref();
    await holding();
    fs.writeFileSync(path.join(w.cwd, ".strom", "live-last.json"), JSON.stringify({ ...last, pid: stuck2.pid }));
    const retaken = (await w.ok(["live", "start", "--json"])).json;
    assert.equal(retaken.port, last.port);
    assert.equal(retaken.moved, undefined);
    assert.equal(await exited(stuck2), "SIGKILL");
    assert.match(fs.readFileSync(log, "utf8"), new RegExp(`the bridge before \\(${stuck2.pid}\\) still held port ${last.port}: ended`));
  } finally {
    events.destroy();
    await w.run(["live", "stop"]);
  }
  w.cleanup();
});

test("strom app opens this research in an app that can take it: the tree by its id, followed while somebody is at work", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree();
  // A copy of the app of its own (its development) — the research goes there, not to stromapp.info.
  w.env.STROM_APP_URL = "http://127.0.0.1:8080/";
  // No Chromium browser here (only Safari, say — it does not let the page reach this computer): the file, to drag in.
  const drag = (await w.ok(["app", "--json"])).json;
  assert.equal(drag.via, "drag");
  assert.equal(drag.file, path.join(w.treeDir("Novákovi"), "output", "tree-strom.ged"));
  assert.ok(fs.existsSync(drag.file), "written as the research is now");
  assert.match((await w.ok(["app"])).out, /Do jejího okna přetáhnout soubor .*tree-strom\.ged/);
  assert.match((await w.ok(["app", "--live"])).out, /Průběžné sledování výzkumu potřebuje Chrome nebo Edge/);
  // Chrome here: the research itself, through the bridge, in Chrome — never the default browser.
  const apps = path.join(w.dir, "Applications");
  fs.mkdirSync(path.join(apps, "Google Chrome.app"), { recursive: true });
  fs.writeFileSync(path.join(apps, "google-chrome"), "#!/bin/sh\n", { mode: 0o755 });
  w.env.STROM_APP_DIRS = apps;
  try {
    const r = (await w.ok(["app", "--json"])).json;
    assert.equal(r.via, "browser");
    assert.equal(r.browser, "Google Chrome");
    assert.equal(r.follow, false);
    assert.equal(r.url, `http://127.0.0.1:8080/?import-url=${encodeURIComponent(`${r.bridge}/tree.ged`)}`);
    const ged = (await ask(`${r.bridge}/tree.ged`)).body;
    const id = JSON.parse(fs.readFileSync(path.join(w.treeDir("Novákovi"), "strom.json"), "utf8")).id;
    assert.match(ged, new RegExp(`^1 _STROM_TREE ${id}$`, "m"), "the app knows the tree again by its id");
    await w.ok(["export", "gedcom"]);
    assert.doesNotMatch(fs.readFileSync(path.join(w.treeDir("Novákovi"), "output", "tree.ged"), "utf8"), /_STROM_TREE/, "only for the Strom app");
    // Somebody at work on it: the app follows it.
    const leave = enterWorker(w.treeDir("Novákovi"), "codex-1", "Codex");
    try {
      const f = (await w.ok(["app", "--json"])).json;
      assert.equal(f.follow, true);
      assert.equal(f.url, `http://127.0.0.1:8080/?live=${encodeURIComponent(f.bridge)}`);
    } finally {
      leave();
    }
    assert.match((await w.ok(["app", "--lang", "cs"])).out, /http:\/\/127\.0\.0\.1:8080\/\?import-url=/);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("the shortcut on the desktop starts this strom", { skip: process.platform === "win32" }, () => {
  const w = new World();
  const [file] = createShortcut("Strom výzkum", w.env, "darwin");
  assert.equal(file, path.join(w.env.HOME!, "Desktop", "Strom výzkum.command"));
  const text = fs.readFileSync(file!, "utf8");
  assert.match(text, /^#!\/bin\/sh\ncd "\$HOME"\nexec "\S*node\S*" "\S+cli\.ts"\n$/);
  assert.ok((fs.statSync(file!).mode & 0o111) !== 0, "runs on a double-click");
  // its own icon: the Strom app's tree with a magnifying glass (Finder keeps it in the file's attributes)
  if (process.platform === "darwin") assert.match(spawnSync("xattr", [file!], { encoding: "utf8" }).stdout, /com\.apple\.FinderInfo/);
  const linux = createShortcut("Strom výzkum", w.env, "linux");
  const entry = fs.readFileSync(linux[0]!, "utf8");
  assert.match(entry, /Terminal=true/);
  const icon = /^Icon=(.+)$/m.exec(entry)?.[1];
  assert.ok(icon && fs.existsSync(icon) && icon.endsWith("icon-512.png"), "the icon strom ships");
  // Windows without PowerShell (here): the command file on the desktop, as before; with it, a .lnk with the icon
  if (process.platform !== "win32") {
    const win = createShortcut("Strom výzkum", w.env, "win32");
    assert.equal(win[0], path.join(w.env.HOME!, "Desktop", "Strom výzkum.cmd"));
    assert.match(fs.readFileSync(win[0]!, "utf8"), /^@echo off\r\nchcp 65001/);
  }
  w.cleanup();
});

/** A fake headless agent: notes its arguments and the variables that matter, reads the brief, prints events. */
function fakeHeadless(w: World, name: string, events: object[]): void {
  const bin = path.join(w.dir, "bin");
  const lines = events.map((e) => JSON.stringify(e)).join("\n");
  fs.writeFileSync(
    path.join(bin, name),
    `#!/bin/sh\nprintf '%s\\n' "$*" > "${path.join(w.dir, `${name}.args`)}"\necho "session=$STROM_SESSION" > "${path.join(w.dir, `${name}.env`)}"\ncat > "${path.join(w.dir, `${name}.brief`)}"\ncat <<'EOT'\n${lines}\nEOT\n`,
    { mode: 0o755 },
  );
}

test("strom run with Codex, Antigravity and OpenCode: headless, their events read, the level their own switches", unix, async () => {
  const w = new World();
  w.env.PATH = `${pathWith(w, [])}:/bin:/usr/bin`;
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  w.cwd = w.treeDir("Novákovi");
  // (a task that comes back twice with nothing recorded is parked: one task per agent here)
  for (const what of ["Křest Jana", "Křest Josefa", "Křest Marie"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "farnost Sloup", "--why", "zkouška", "--done-when", "hotovo"]);
  fakeHeadless(w, "codex", [
    { type: "thread.started", thread_id: "t" },
    { type: "item.started", item: { type: "command_execution", command: "/bin/zsh -lc 'strom brief'" } },
    { type: "item.completed", item: { type: "agent_message", text: "Hotovo." } },
    { type: "turn.completed", usage: { input_tokens: 1200, cached_input_tokens: 800, output_tokens: 90 } },
  ]);
  const r = await w.ok(["run", "--agent", "codex", "--json"]);
  assert.equal(r.json.sessions[0].outcome, "ok");
  assert.match(r.err, /\$ strom brief/, "progress from its events");
  const args = fs.readFileSync(path.join(w.dir, "codex.args"), "utf8");
  assert.match(args, /^exec --json --skip-git-repo-check --sandbox workspace-write -c sandbox_workspace_write\.network_access=true -c sandbox_workspace_write\.writable_roots=\[".*Novákovi\/\.git",".*shared"\] -$/m);
  assert.match(fs.readFileSync(path.join(w.dir, "codex.brief"), "utf8"), /Křest Jana/, "the brief on stdin");
  const s = (await w.ok(["session", "show", "N0001", "--json"])).json.session;
  assert.equal(s.metrics.inputTokens, 1200);
  // Antigravity: the brief it reads itself (strom brief), the result event read.
  fakeHeadless(w, "agy", [
    { event: "tool_call", tool_call: { name: "run_command", input: { command: "strom brief" } } },
    { event: "result", result: { status: "SUCCESS", response: "Hotovo.", num_turns: 3, duration_seconds: 12, usage: { input_tokens: 700, output_tokens: 30, thinking_tokens: 10, cache_read_tokens: 50 } } },
  ]);
  const a = await w.ok(["run", "--agent", "antigravity", "--json"]);
  assert.equal(a.json.sessions[0].outcome, "ok");
  assert.match(fs.readFileSync(path.join(w.dir, "agy.args"), "utf8"), /^--print You are the researcher in strom session N0002\. Run `strom brief`.* --output-format stream-json --add-dir /);
  assert.equal((await w.ok(["session", "show", "N0002", "--json"])).json.session.metrics.outputTokens, 40);
  // OpenCode: the brief on stdin, its steps summed up, a refusal noticed.
  fakeHeadless(w, "opencode", [
    { type: "step_start", part: { type: "step-start" } },
    { type: "tool_use", part: { type: "tool", tool: "bash", state: { status: "completed", input: { command: "strom brief" } } } },
    { type: "step_finish", part: { type: "step-finish", tokens: { input: 500, output: 20, reasoning: 5, cache: { read: 300, write: 0 } }, cost: 0 } },
    { type: "tool_use", part: { type: "tool", tool: "bash", state: { status: "error", input: { command: "git log" }, error: "The user rejected permission to use this specific tool call." } } },
    { type: "text", part: { type: "text", text: "Hotovo." } },
    { type: "step_finish", part: { type: "step-finish", tokens: { input: 600, output: 30, reasoning: 0, cache: { read: 400, write: 0 } }, cost: 0 } },
  ]);
  const o = await w.ok(["run", "--agent", "opencode", "--json"]);
  assert.equal(o.json.sessions[0].outcome, "ok");
  assert.match(o.err, /\$ strom brief/);
  assert.match(fs.readFileSync(path.join(w.dir, "opencode.args"), "utf8"), /^run --format json --agent strom-run Your brief is above\./);
  // strom-run: the tree's rules with what would ask refused (OpenCode 2 ends a headless run at a question)
  const ocRun = readJsonFile(path.join(w.cwd!, "opencode.json")).agent["strom-run"].permission;
  assert.deepEqual([ocRun.bash["*"], ocRun.bash["strom *"], ocRun.bash["git *"], ocRun.edit["*"], ocRun.edit["notes/*"], ocRun.external_directory["*"]], ["deny", "allow", "deny", "deny", "allow", "deny"]);
  assert.match(fs.readFileSync(path.join(w.dir, "opencode.brief"), "utf8"), /strom session N0003/);
  const os_ = (await w.ok(["session", "show", "N0003", "--json"])).json.session;
  assert.equal(os_.metrics.inputTokens, 1100);
  assert.equal(os_.metrics.outputTokens, 55);
  // Grok Build: the brief in a file (it reads no stdin), the folder trusted, a session of strom's naming; its end event read.
  await w.ok(["task", "add", "Křest Anny", "--level", "locate", "--where", "farnost Sloup", "--why", "zkouška", "--done-when", "hotovo"]);
  fakeHeadless(w, "grok", [
    { type: "text", data: "Podívám se " },
    { type: "text", data: "na úkol." },
    { type: "tool_call", toolCallId: "c1", toolName: "run_terminal_command", status: "in_progress", rawInput: { command: "strom brief" } },
    { type: "tool_call_update", toolCallId: "c1", status: "completed", rawOutput: {} },
    { type: "tool_call", toolCallId: "c2", toolName: "run_terminal_command", status: "in_progress", rawInput: { command: "git log" } },
    { type: "tool_call_update", toolCallId: "c2", status: "failed", content: [{ type: "content", content: { type: "text", text: "Tool `run_terminal_command` was not executed: Denied by permission policy: deny rule on bash matching \"git\"" } }] },
    { type: "text", data: "Hotovo." },
    { type: "end", stopReason: "end_turn", sessionId: "s-1", num_turns: 4, usage: { input_tokens: 900, cache_read_input_tokens: 4000, output_tokens: 60, reasoning_tokens: 40 }, modelUsage: { "grok-4.7": { inputTokens: 900, outputTokens: 60 } }, total_cost_usd: 0.0123 },
  ]);
  const g = await w.ok(["run", "--agent", "grok", "--json"]);
  assert.equal(g.json.sessions[0].outcome, "ok");
  assert.match(g.err, /Podívám se na úkol\./, "its words, whole");
  assert.match(g.err, /\$ strom brief/);
  const gargs = fs.readFileSync(path.join(w.dir, "grok.args"), "utf8").trim();
  assert.match(gargs, /^--trust --prompt-file .*N0004\.prompt\.md --output-format streaming-json --permission-mode dontAsk --session-id [0-9a-f-]{36} --no-auto-update$/);
  assert.match(fs.readFileSync(path.join(w.cwd!, ".strom", "runs", "N0004.prompt.md"), "utf8"), /strom session N0004/);
  const gs = (await w.ok(["session", "show", "N0004", "--json"])).json.session;
  assert.deepEqual([gs.metrics.inputTokens, gs.metrics.outputTokens, gs.metrics.cacheReadTokens, gs.metrics.costUsd, gs.metrics.denied], [900, 100, 4000, 0.0123, 1]);
  assert.equal(gs.model, "grok-4.7", "the model it ran on");
  w.cleanup();
});

test("strom run: the user's level reaches every agent — full is each one's own switch", unix, async () => {
  const w = new World();
  w.env.PATH = `${pathWith(w, [])}:/bin:/usr/bin`;
  await w.ok(["setup", "--yes"]);
  await w.ok(["config", "set", "agent.permissions", "full"], { tty: true, answers: ["y"] });
  await w.ok(["init", "Novákovi"]);
  w.cwd = w.treeDir("Novákovi");
  const done = [{ type: "turn.completed", usage: {} }];
  const agents: [string, string, RegExp][] = [
    ["codex", "codex", / --dangerously-bypass-approvals-and-sandbox /],
    ["antigravity", "agy", / --dangerously-skip-permissions/],
    ["opencode", "opencode", /^run --format json --auto /],
    ["grok", "grok", / --always-approve /],
  ];
  for (const [agent, command, full] of agents) {
    await w.ok(["task", "add", `Křest (${agent})`, "--level", "locate", "--where", "farnost Sloup", "--why", "zkouška", "--done-when", "hotovo"]);
    fakeHeadless(w, command, done);
    await w.run(["run", "--agent", agent, "--json"]);
    assert.match(fs.readFileSync(path.join(w.dir, `${command}.args`), "utf8"), full, agent);
  }
  // …and Grok's tree rules keep away what the allow list would have
  assert.match(fs.readFileSync(path.join(w.cwd, ".grok", "config.toml"), "utf8"), /"Edit\(\.grok\/\*\*\)"/);
  w.cleanup();
});

test("strom uninstall takes off what strom put here — the research and the settings stay; the user decides", unix, async () => {
  const w = new World();
  w.env.PATH = `${pathWith(w, ["claude"])}:/bin:/usr/bin`;
  await w.withTree();
  await w.ok(["shortcut"]);
  const home = w.env.HOME!;
  fs.writeFileSync(path.join(home, ".zshrc"), 'alias ll="ls -l"\n\nexport PATH="/x/.local/bin:$PATH"  # strom research\n');
  const skill = path.join(home, ".claude", "skills", "strom", "SKILL.md");
  assert.ok(fs.existsSync(skill), "setup taught Claude Code");
  // An agent cannot say yes: the window asks the person, who says no here.
  w.env.CLAUDECODE = "1";
  const asked = await w.run(["uninstall"], { dialog: false });
  assert.notEqual(asked.code, 0);
  // said where it runs before it waits (a window behind others, a command silent for minutes: found on Windows)
  assert.match(asked.err, /okně systému.*nejvýš 5 min|window of the system.*at most 5 min/);
  // …its --yes is no yes of the person's
  assert.notEqual((await w.run(["uninstall", "--yes"], { dialog: false })).code, 0);
  assert.ok(fs.existsSync(skill), "nothing removed");
  delete w.env.CLAUDECODE;
  // A script with no terminal and no window here: ends at once and says how (its --yes)
  const script = await w.run(["uninstall", "--json"]);
  assert.equal(script.code, 4);
  assert.match(script.out, /strom uninstall --yes/);
  assert.ok(fs.existsSync(skill), "nothing removed");
  // The person at the terminal sees what goes and what stays, and says yes.
  const r = await w.ok(["uninstall"], { tty: true, answers: ["y"] });
  assert.match(r.out, /strom takes this off the computer:|strom z počítače odebere:/);
  assert.doesNotMatch(r.out, /npm uninstall/, "run from sources: nothing of npm's");
  assert.ok(!fs.existsSync(skill));
  assert.equal(fs.readFileSync(path.join(home, ".zshrc"), "utf8"), 'alias ll="ls -l"\n', "only strom's line goes");
  assert.equal(fs.readdirSync(path.join(home, "Desktop")).filter((f) => /strom/i.test(f)).length, 0, "the shortcut is gone");
  assert.ok(fs.existsSync(path.join(w.treeDir("Novákovi"), "strom.json")), "the research stays");
  assert.ok(fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json")), "the settings stay");
  assert.match((await w.ok(["uninstall"])).out, /Nothing of strom's|Na tomto počítači není nic/);
  w.cleanup();
});
