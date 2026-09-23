// How a person starts: the menu, the conversation with the agent set up as
// they chose, the Strom app, the shortcut, the agents learning about strom.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import http from "node:http";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { conversationArgs } from "../../src/agents/launch.ts";
import { installedStromApp, isStromName } from "../../src/core/stromapp.ts";
import { createShortcut } from "../../src/core/shortcut.ts";
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
  assert.match(r.out, /Jak se bude jmenovat váš rodokmen\?/);
  assert.match(r.out, /✓ Rodokmen „Novákovi“ je založený: /);
  assert.doesNotMatch(r.out, /next\s+strom research new/, "no line meant for agents");
  assert.match(r.out, /Otevírám rozhovor s agentem \(Claude Code\)\. Až budete chtít skončit, napište \/exit\./);
  assert.match(r.out, /Claude Code se poprvé zeptá, jestli této složce důvěřujete/, "a folder it does not trust yet");
  const call = fs.readFileSync(path.join(w.dir, "claude.calls"), "utf8");
  assert.ok(call.startsWith(fs.realpathSync(w.treeDir("Novákovi"))), `in the tree folder: ${call}`);
  assert.match(call, /chci začít zkoumat svoje předky/, "the first message, in the user's language");
  assert.match(call, /--permission-mode auto --settings .+\/Novákovi\/\.claude\/settings\.json/);
  assert.match(r.out, /Rodokmen: Novákovi · 0 osob/);
  assert.match(r.out, /1 {2}Začít výzkum s agentem/);
  assert.match(r.out, /Na shledanou/);
  // An agent (or a script) still gets the orientation, never the menu.
  assert.match((await w.ok([])).out, /^strom \S+ — nástroj pro genealogický výzkum s AI agenty/);
  w.cleanup();
});

test("the menu: results and what waits; unknown choices are asked again", unix, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude"]);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  const r = await w.ok([], { tty: true, answers: ["9", "3", "", "4", "0"] });
  assert.match(r.out, /Napište prosím jedno z čísel/);
  assert.match(r.out, /Nic na vás nečeká/);
  assert.match(r.out, /Výsledky zatím nejsou/);
  w.cleanup();
});

test("strom chat: the agent set up as the user chose — Claude Code, Codex, Antigravity, OpenCode", unix, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude", "codex", "agy", "opencode"]);
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
  // An agent elsewhere (it set strom up from the web page) hands the research over: its own
  // conversation, in a new terminal window (not opened in a test: the user is told how).
  w.env.CLAUDECODE = "1";
  // strom tells it so: outside the tree, the next step is the research's own conversation.
  assert.equal((await w.ok(["--json"], { cwd: w.dir })).json.next.command, "strom chat");
  assert.notEqual((await w.ok(["--json"], { cwd: w.treeDir("Novákovi") })).json.next.command, "strom chat", "in the tree folder: go on");
  const h = await w.ok(["chat", "--json"]);
  assert.equal(h.json.handover, "none");
  assert.equal(h.json.cwd, w.treeDir("Novákovi"));
  assert.match((await w.ok(["chat"])).out, /Spusťte výzkum sami: v terminálu příkazem strom/);
  // An agent strom started is where the research happens already: no second conversation.
  w.env.STROM_WORKER = "claude-1";
  assert.equal((await w.run(["chat"])).code, 2);
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
  // language, folder, where (Enter = the app), model, level, no shortcut
  const r = await w.ok(["setup"], { answers: ["cs", "", "", "", "", "n"] });
  assert.match(r.out, /Kde chcete s agentem mluvit\?/);
  assert.match(r.out, /V aplikaci Claude – nejjednodušší \(doporučeno\)/);
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
  assert.match(c.out, /Aplikace Claude se neotevřela\. Spusťte ji sami, otevřete složku .*Novákovi a napište: Ahoj/);
  assert.match(c.out, /zvolte „Auto“/);
  assert.ok(!fs.existsSync(path.join(w.dir, "claude.calls")), "the CLI was not started");
  // The terminal after all: the CLI, as before.
  await w.ok(["config", "set", "agent.where", "terminal"]);
  assert.ok(Array.isArray((await w.ok(["chat", "--print", "--json"])).json.args));
  // Codex: its app, whatever the choice, when its CLI is not here.
  const codex = (await w.ok(["chat", "--print", "--agent", "codex", "--json"])).json;
  assert.match(codex.link, /^codex:\/\/new\?path=.*&prompt=Ahoj/);
  // The doctor says where; working alone needs the CLI.
  const d = await w.run(["doctor"]);
  assert.match(d.out, /kde mluvíte s agentem\s+terminál \(Claude Code\)/);
  w.cleanup();
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
  const o = { kickoff: "k", settingsFile: "/t/.claude/settings.json", shared: "/s" };
  assert.deepEqual(conversationArgs("claude", { ...o, level: "ask" }), ["k", "--settings", "/t/.claude/settings.json"]);
  assert.deepEqual(conversationArgs("claude", { ...o, level: "full" }).slice(1, 3), ["--permission-mode", "bypassPermissions"]);
  assert.deepEqual(conversationArgs("codex", { ...o, level: "ask" }).slice(0, 4), ["--sandbox", "workspace-write", "--ask-for-approval", "on-request"]);
  assert.deepEqual(conversationArgs("codex", { ...o, level: "full" }).slice(0, 1), ["--dangerously-bypass-approvals-and-sandbox"]);
  assert.ok(!conversationArgs("codex", { ...o, level: "full" }).includes("--add-dir"), "no sandbox: nothing to add");
  assert.deepEqual(conversationArgs("opencode", { ...o, level: "ask" }), ["--prompt", "k"]);
  assert.deepEqual(conversationArgs("opencode", { ...o, level: "full", model: "anthropic/claude-sonnet-5" }), ["--auto", "--model", "anthropic/claude-sonnet-5", "--prompt", "k"]);
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
  await w.ok(["agents", "install", "--all"]);
  assert.deepEqual(readJsonFile(path.join(ocDir, "opencode.json")), { theme: "tokyonight", permission: { bash: { "*": "ask", "strom *": "allow" } }, instructions: ["~/rules.md", ocOwn] });
  await w.ok(["agents", "uninstall"]);
  assert.deepEqual(readJsonFile(path.join(ocDir, "opencode.json")), { theme: "tokyonight", permission: { bash: { "*": "ask" } }, instructions: ["~/rules.md"] });
  assert.ok(!fs.existsSync(ocOwn));
  assert.deepEqual(readJsonFile(agySettings), { theme: "dark", permissions: { allow: ["command(git)"] } });
  assert.equal(fs.readFileSync(codex, "utf8"), "# My rules\n\nAlways answer briefly.\n");
  assert.ok(!fs.existsSync(path.join(w.env.HOME!, ".claude", "skills", "strom")));
  assert.deepEqual(readJsonFile(claudeSettings), { model: "opus", permissions: { allow: ["Bash(git status:*)", "Bash(stromboli:*)"], deny: ["Read(.env)"] } });
  assert.ok(!fs.existsSync(path.join(w.env.HOME!, ".gemini", "GEMINI.md")), "nothing else was in it");
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
  fs.mkdirSync(path.join(home, "Applications", "Chrome Apps.localized", "Strom.app"), { recursive: true });
  assert.equal(installedStromApp(w.env, "darwin")?.kind, "Chrome app");
  const start = path.join(home, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Chrome Apps");
  fs.mkdirSync(start, { recursive: true });
  fs.writeFileSync(path.join(start, "Strom.lnk"), "");
  assert.equal(installedStromApp({ ...w.env, APPDATA: undefined }, "win32")?.kind, "Chrome App");
  const apps = path.join(home, ".local", "share", "applications");
  fs.mkdirSync(apps, { recursive: true });
  fs.writeFileSync(path.join(apps, "chrome-abc-Default.desktop"), "[Desktop Entry]\nName=Strom\nExec=chrome --app-id=abc\n");
  assert.equal(installedStromApp(w.env, "linux")?.kind, "browser app");
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

test("the results: strom tells the agent to offer the Strom app when it is not installed here — never when unwanted", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["export", "gedcom"]);
  w.env.CLAUDECODE = "1";
  const o = (await w.ok(["--json"])).json;
  assert.equal(o.results.app, "offer");
  assert.match(o.results.file, /tree-strom\.ged$/);
  assert.match((await w.ok([])).out, /výsledky .*tree-strom\.ged – pro aplikaci Strom, tady zatím nenainstalovanou: nabídni uživateli, že v ní může výzkum průběžně sledovat – instalace z https:\/\/stromapp\.info\/run\/ \(strom app install ji tam otevře a řekne, kam kliknout\), pak strom app/);
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
    assert.equal((await ask(`${info.url}/status`, { headers: { Origin: "https://evil.example" } })).headers["access-control-allow-origin"], undefined);
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
  } finally {
    await w.ok(["live", "stop"]);
  }
  assert.equal((await w.ok(["live", "--json"])).json.running, false);
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
  assert.match((await w.ok(["app"])).out, /Přetáhněte do jejího okna soubor .*tree-strom\.ged/);
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
  const linux = createShortcut("Strom výzkum", w.env, "linux");
  assert.match(fs.readFileSync(linux[0]!, "utf8"), /Terminal=true/);
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
  assert.match(args, /^exec --json --skip-git-repo-check --sandbox workspace-write -c sandbox_workspace_write\.network_access=true --add-dir .*shared -$/m);
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
  assert.match(fs.readFileSync(path.join(w.dir, "opencode.args"), "utf8"), /^run --format json Your brief is above\./);
  assert.match(fs.readFileSync(path.join(w.dir, "opencode.brief"), "utf8"), /strom session N0003/);
  const os_ = (await w.ok(["session", "show", "N0003", "--json"])).json.session;
  assert.equal(os_.metrics.inputTokens, 1100);
  assert.equal(os_.metrics.outputTokens, 55);
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
  assert.notEqual((await w.run(["uninstall"], { dialog: false })).code, 0);
  assert.ok(fs.existsSync(skill), "nothing removed");
  delete w.env.CLAUDECODE;
  // The person at the terminal sees what goes and what stays, and says yes.
  const r = await w.ok(["uninstall"], { tty: true, answers: ["y"] });
  assert.match(r.out, /strom takes this off your computer:|strom z počítače odebere:/);
  assert.doesNotMatch(r.out, /npm uninstall/, "run from sources: nothing of npm's");
  assert.ok(!fs.existsSync(skill));
  assert.equal(fs.readFileSync(path.join(home, ".zshrc"), "utf8"), 'alias ll="ls -l"\n', "only strom's line goes");
  assert.equal(fs.readdirSync(path.join(home, "Desktop")).filter((f) => /strom/i.test(f)).length, 0, "the shortcut is gone");
  assert.ok(fs.existsSync(path.join(w.treeDir("Novákovi"), "strom.json")), "the research stays");
  assert.ok(fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json")), "the settings stay");
  assert.match((await w.ok(["uninstall"])).out, /Nothing of strom's|Na tomto počítači není nic/);
  w.cleanup();
});
