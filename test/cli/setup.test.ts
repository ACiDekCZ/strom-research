import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";

test("orientation before setup points to setup", async () => {
  const w = new World();
  const r = await w.ok([]);
  // In the user's language (the tests run in Czech): they watch it in the agent's session.
  assert.match(r.out, /dál\s+strom setup --yes --lang/);
  assert.match(r.out, /řekni to uživateli/);
  assert.match((await w.ok(["--lang", "en"])).out, /next\s+strom setup --yes --lang[^\n]*\n\s+\(strom is not set up yet: this creates .* \(tell the user/);
  const j = (await w.ok(["--json"])).json;
  assert.match(j.next.command, /^strom setup --yes --lang /);
  // A person at a terminal is asked instead.
  assert.equal((await w.ok(["--json"], { tty: true })).json.next.command, "strom setup");
  w.cleanup();
});

test("no TTY: a missing home is a needs-input result (exit 3), never a prompt", async () => {
  const w = new World();
  const r = await w.run(["init", "Novákovi", "--json"]);
  assert.equal(r.code, 3);
  assert.equal(r.json.status, "needs-input");
  assert.equal(r.json.needs[0].key, "home");
  assert.match(r.json.needs[0].set, /strom setup --home/);
  w.cleanup();
});

test("setup --yes uses the suggested home under Documents and creates shared folders", async () => {
  const w = new World();
  const r = await w.ok(["setup", "--yes", "--json"]);
  assert.equal(r.json.home, w.home);
  assert.equal(r.json.shared, path.join(w.home, "shared"));
  assert.equal(r.json.lang, "cs");
  for (const d of ["media", "catalog", "tools", "cache", "inbox"]) assert.ok(fs.existsSync(path.join(w.home, "shared", d)), d);
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).home, w.home);
  w.cleanup();
});

/** A PATH with git and the given fake agent CLIs only — what is installed is up to the test. */
function pathWith(w: World, agents: string[]): string {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const git = spawnSync(process.platform === "win32" ? "where" : "which", ["git"], { encoding: "utf8" }).stdout.split(/\r?\n/)[0]!.trim();
  if (git && !fs.existsSync(path.join(bin, path.basename(git)))) fs.symlinkSync(git, path.join(bin, path.basename(git)));
  for (const a of agents) fs.writeFileSync(path.join(bin, a), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  return bin;
}

test("the setup wizard: the user's language, Enter takes the suggestion, agents learn about strom", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude"]);
  // language, folder (Enter), model (Enter = Opus), what the agent may do (Enter = on its own), no shortcut
  const r = await w.ok(["setup"], { answers: ["cs", "", "", "", "n"] });
  assert.match(r.out, /Vítejte ve Strom výzkumu/);
  assert.match(r.out, /✓ AI agent: Claude Code/);
  assert.match(r.out, /Opus – nejlépe čte staré rukopisy/);
  assert.match(r.out, /✓ Claude Code teď strom zná v jakékoli složce/);
  const cfg = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  assert.equal(cfg.home, w.home);
  assert.equal(cfg.lang, "cs");
  assert.equal(cfg.agent, "claude");
  assert.equal(cfg.models.claude.lead, "opus");
  assert.equal(cfg.agentPermissions, "auto");
  const skill = fs.readFileSync(path.join(w.env.HOME!, ".claude", "skills", "strom", "SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: strom\ndescription: /);
  // Again: every answer pre-filled with the current value; Enter keeps it.
  const again = await w.ok(["setup"], { answers: ["", "", "", "", "n"] });
  assert.match(again.out, /Nastavení – Enter ponechá současnou hodnotu/);
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).models.claude.lead, "opus");
  w.cleanup();
});

test("the setup wizard: several agents — the user picks; full needs a second yes", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude", "codex"]);
  // language, folder, agent 2 (Codex: no model question, a word on the model), no stories, level 3 (full) — then "no" to the warning, no shortcut
  const r = await w.ok(["setup"], { answers: ["en", "", "2", "2", "3", "n", "n"] });
  assert.match(r.out, /Which AI agent should do the research\?/);
  assert.match(r.out, /The research needs a strong model .* in OpenAI Codex CLI, choose its best model/);
  assert.match(r.out, /Should the agent also write stories of your ancestors/);
  assert.match(r.out, /The agent will be able to run any program/);
  const cfg = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  assert.equal(cfg.agent, "codex");
  assert.equal(cfg.agentPermissions, "auto", "no second yes: the level stays");
  assert.equal(cfg.stories, "no");
  assert.match(fs.readFileSync(path.join(w.env.HOME!, ".codex", "AGENTS.md"), "utf8"), /strom: begin/);
  w.cleanup();
});

test("the setup wizard: no agent — install one, the guide, or later", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, []);
  // language, folder, "show me which agents there are", level, no shortcut
  const r = await w.ok(["setup"], { answers: ["cs", "", "2", "", "n"] });
  assert.match(r.out, /Nenašel jsem žádného AI agenta/);
  assert.match(r.out, /Nainstalujte AI agenta \(jak: https:\/\/stromapp\.info\/research\/\?lang=cs#agents\)/);
  assert.doesNotMatch(r.out, /Který model/, "no agent: no model question");
  w.cleanup();
});

test("set up by an agent: that agent is the user's default, not the first one installed", async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude", "agy"]);
  w.env.ANTIGRAVITY_AGENT = "1";
  await w.ok(["setup", "--yes", "--lang", "cs"]);
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).agent, "antigravity");
  w.cleanup();
});

test("setup without a terminal: flags; shared data can be separated", async () => {
  const w = new World();
  const big = path.join(w.dir, "big disk");
  await w.ok(["setup", "--yes", "--shared", big, "--lang", "de"]);
  const where = (await w.ok(["config", "where", "--json"])).json.settings;
  const get = (k: string) => where.find((s: any) => s.key === k);
  assert.equal(get("home").value, w.home);
  assert.equal(get("shared").value, big);
  assert.equal(get("trees").value, w.home);
  assert.equal(get("lang").value, "de");
  w.cleanup();
});

test("config set/get and env override", async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["config", "set", "lang", "pl"]);
  assert.equal((await w.ok(["config", "get", "lang"])).out.trim(), "pl");
  w.env.STROM_LANG = "sk";
  const j = (await w.ok(["config", "get", "lang", "--json"])).json;
  assert.deepEqual([j.value, j.source], ["sk", "env"]);
  assert.equal((await w.run(["config", "set", "colour", "x"])).code, 2);
  w.cleanup();
});

test("init creates a git-backed tree; orientation then shows it", { skip: !hasGit }, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const r = await w.ok(["init", "Novákovi", "--json"]);
  const root = w.treeDir("Novákovi");
  assert.equal(r.json.root, root);
  assert.ok(fs.existsSync(path.join(root, ".git")));
  assert.equal(readJsonFile(path.join(root, "strom.json")).lang, "cs");
  const log = spawnSync("git", ["log", "--oneline"], { cwd: root, encoding: "utf8" }).stdout;
  assert.match(log, /Create tree "Novákovi"/);
  // From anywhere: the only tree is found automatically.
  const o = (await w.ok(["--json"])).json;
  assert.equal(o.tree.name, "Novákovi");
  assert.match(o.next.command, /research new/);
  w.cleanup();
});

test("init refuses a non-empty folder; trees lists every tree; --tree selects by name", { skip: !hasGit }, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  assert.equal((await w.run(["init", "Novákovi"])).code, 2);
  const outside = path.join(w.dir, "elsewhere", "Dvořákovi");
  await w.ok(["init", "Dvořákovi", "--dir", outside]);
  const trees = (await w.ok(["trees", "--json"])).json.trees.map((t: any) => t.name).sort();
  assert.deepEqual(trees, ["Dvořákovi", "Novákovi"]);
  // Two trees and not inside one: strom asks which (usage error), --tree picks.
  assert.equal((await w.run(["status"])).code, 2);
  const s = (await w.ok(["status", "--tree", "dvorakovi", "--json"])).json;
  assert.equal(s.tree.root, outside);
  w.cleanup();
});

test("lang shows and changes the tree's research language", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  assert.match((await w.ok(["lang"])).out, /Czech \(cs\)/);
  await w.ok(["lang", "de"]);
  assert.equal(readJsonFile(path.join(w.cwd, "strom.json")).lang, "de");
  assert.match((await w.ok(["guide"])).out, /research language of this tree is German/);
  w.cleanup();
});

test("doctor reports git and missing home with a fix", async () => {
  const w = new World();
  const r = await w.run(["doctor", "--json"]);
  const home = r.json.checks.find((c: any) => c.name === "home");
  assert.equal(home.status, "fail");
  assert.equal(home.fix, "strom setup");
  assert.equal(r.code, 1);
  w.cleanup();
});

test("doctor --fix: what strom can put right, each with the user's yes — here, or in a window for an agent's user", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  w.env.PATH = pathWith(w, ["claude"]);
  await w.ok(["setup", "--yes"]);
  // The agents forgot strom, no shortcut: yes to the shortcut, no to the Strom app.
  await w.ok(["agents", "uninstall"]);
  const before = await w.run(["doctor", "--json"]);
  assert.equal(before.json.checks.find((c: any) => c.name === "knows").fix, "strom doctor --fix");
  const r = await w.run(["doctor", "--fix"], { tty: true, answers: ["a", "n"] });
  assert.match(r.out, /Claude Code teď strom zná v jakékoli složce/);
  assert.match(r.out, /Zástupce: /);
  assert.ok(fs.existsSync(path.join(w.env.HOME!, ".claude", "skills", "strom", "SKILL.md")));
  const after = (await w.run(["doctor", "--json"])).json.checks;
  assert.equal(after.find((c: any) => c.name === "knows").status, "ok");
  assert.equal(after.find((c: any) => c.name === "shortcut").status, "ok");

  // No git: the agent is told first; its user answers in a window (here: no — nothing is installed).
  w.env.STROM_GIT = path.join(w.dir, "no git");
  w.env.CLAUDECODE = "1";
  const o = await w.ok(["--json"]);
  assert.equal(o.json.next.command, "strom doctor --fix");
  const d = await w.run(["doctor", "--fix", "--json"], { dialog: false });
  assert.equal(d.code, 1);
  assert.equal(d.json.checks.find((c: any) => c.name === "git").status, "fail");
  // Yes in the window: Apple's installer is opened (not in a test) and the user finishes it there.
  const y = await w.run(["doctor", "--fix"], { dialog: true });
  assert.match(y.out, /Dokončete instalaci v okně systému/);
  w.cleanup();
});

test("the real entry point runs as a process", () => {
  const cli = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
  const r = spawnSync(process.execPath, [cli, "commands", "--json"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(JSON.parse(r.stdout).commands.length > 10);
});

test("agent choice: flag > STROM_AGENT > tree > user > default", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  const get = async (args: string[] = []) => (await w.ok(["config", "get", "agent", "--json", ...args])).json;
  assert.deepEqual([(await get()).value, (await get()).source], ["claude", "config"]); // setup stored the default
  await w.ok(["agents", "use", "codex"]);
  assert.equal((await get()).value, "codex");
  await w.ok(["agents", "use", "antigravity", "--for-tree"]);
  assert.deepEqual([(await get()).value, (await get()).source], ["antigravity", "tree"]);
  w.env.STROM_AGENT = "claude";
  assert.deepEqual([(await get()).value, (await get()).source], ["claude", "env"]);
  assert.deepEqual([(await get(["--agent", "codex"])).value, (await get(["--agent", "codex"])).source], ["codex", "flag"]);
  assert.equal((await w.run(["agents", "use", "nonsense"])).code, 2);
  assert.equal((await w.run(["config", "set", "agent", "nonsense"])).code, 2);
  w.cleanup();
});

test("each agent gets delegation rules for its kind; models per tier are configurable", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  const claude = fs.readFileSync(path.join(w.cwd, "CLAUDE.md"), "utf8");
  assert.match(claude, /Use the Agent tool for subagents/);
  assert.match(claude, /handwriting.*`opus` — never cheaper/);
  assert.match(claude, /About ten images per delegate/);
  // AGENTS.md is read by every agent — the same whichever is the default, since several may work
  // here side by side: nothing Claude-specific, reading rules for those without subagents.
  let agents = fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8");
  assert.doesNotMatch(agents, /Delegating work|strom read/);
  assert.match(agents, /no pipes/);
  assert.match(agents, /Reading scans \(Codex, Antigravity, OpenCode\)/);
  assert.match(agents, /batches of at most ten/);
  assert.match(claude, /not the way "Reading scans" in AGENTS\.md says/);
  await w.ok(["agents", "use", "codex", "--for-tree"]);
  assert.equal(fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8"), agents, "the default agent changes nothing in it");
  // Settings changed for the tree are committed with the agent files: nothing left dirty.
  assert.equal(spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout, "");
  await w.ok(["agents", "use", "claude", "--for-tree"]);
  const cfgFile = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  const cfg = readJsonFile(cfgFile);
  cfg.models = { claude: { text: "sonnet-custom" } };
  fs.writeFileSync(cfgFile, JSON.stringify(cfg));
  await w.ok(["agents", "sync"]);
  assert.match(fs.readFileSync(path.join(w.cwd, "CLAUDE.md"), "utf8"), /`sonnet-custom`/);
  const list = (await w.ok(["agents", "list", "--json"])).json;
  assert.equal(list.agents.find((a: any) => a.id === "claude").models.text, "sonnet-custom");
  w.cleanup();
});

test("a new version: seen at most once a day, said by strom, the menu and doctor; strom update, or npm's way", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree();
  const release = path.join(w.dir, "release");
  fs.mkdirSync(release);
  fs.writeFileSync(path.join(release, "VERSION"), "9.9.9\n");
  w.env.STROM_DOWNLOAD_BASE = `file://${release}`;
  w.env.STROM_UPDATES = "check";
  const o = await w.ok([]);
  assert.match(o.out, /aktualizace\s+vyšla 9\.9\.9 \(tato je \d+\.\d+\.\d+\) – řekni to uživateli; strom update/);
  assert.equal((await w.ok(["--json"])).json.update, "9.9.9");
  // Asked once: the answer is kept for a day.
  const cfg = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  assert.equal(cfg.updateCheck.latest, "9.9.9");
  fs.writeFileSync(path.join(release, "VERSION"), "9.9.10\n");
  assert.equal((await w.ok(["--json"])).json.update, "9.9.9", "not asked again within a day");
  assert.match((await w.ok(["update", "--check"])).out, /Vyšla nová verze: 9\.9\.10/);
  assert.match((await w.ok(["update"])).out, /běží ze zdrojáků: git pull/, "run from sources: git's way");
  assert.match((await w.run(["doctor"])).out, /nová verze\s+vyšla 9\.9\.10\s+→ strom update/);
  // The menu offers it.
  const said = /Vyšla nová verze stromu: 9\.9\.10 – aktualizovat ji můžete v Nastavení \(volba (\d)\)\./.exec((await w.ok([], { tty: true, answers: ["0"] })).out);
  assert.ok(said, "said above the menu, with where");
  assert.match((await w.ok([], { tty: true, answers: [said[1]!, "0", "0"] })).out, /Nastavení \(na tomto počítači\)\n[\s\S]* {3}\d {2}Aktualizovat strom na 9\.9\.10\n {3}0 {2}Zpět/);
  // Off: never asked, never said.
  await w.ok(["config", "set", "updates", "off"]);
  delete w.env.STROM_UPDATES;
  assert.equal((await w.ok(["--json"])).json.update, undefined);
  w.cleanup();
});
