// Claude's desktop app without Claude Code in the terminal (spec 062, story 4): the conversation goes on in the app,
// what strom starts by itself (strom run, the readers, the fixes, the links of the Strom app) needs the CLI. Said in the
// setup and the doctor with Claude Code offered (never installed without a person's yes), refused with a code before
// anything is asked or estimated, and the brief of such a conversation reads scans with the tree's strom-scan-reader.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, fakeConnector, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { readAccepts } from "../../src/core/live-read.ts";
import { agentCliMissing, appWithoutCli, cliMissing } from "../../src/core/agentcli.ts";

const unix = { skip: !hasGit || process.platform === "win32", timeout: 120_000 };

/** A PATH with git and the stand-in agent CLIs named (none: Claude Code is not here). */
function pathWith(w: World, agents: string[]): string {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git && !fs.existsSync(path.join(bin, "git"))) fs.symlinkSync(git, path.join(bin, "git"));
  for (const a of agents) fs.writeFileSync(path.join(bin, a), `#!/bin/sh\necho "$@" >> "${path.join(w.dir, `${a}.calls`)}"\nexit 0\n`, { mode: 0o755 });
  return bin;
}

/** Claude's desktop app here (STROM_APP_DIRS), and Claude Code in the terminal only when `cli`. */
function claudeApp(w: World, cli = false): void {
  const apps = path.join(w.dir, "Applications");
  fs.mkdirSync(path.join(apps, "Claude.app"), { recursive: true });
  w.env.STROM_APP_DIRS = apps;
  w.env.PATH = pathWith(w, cli ? ["claude"] : []);
}

const LINE = /Claude – aplikace \(samostatná práce a čtení skenů potřebují Claude Code\)/u;

test("found: Claude's app without its CLI, and the opposite", unix, () => {
  const w = new World();
  claudeApp(w);
  assert.equal(cliMissing("claude", w.env), true);
  assert.equal(appWithoutCli("claude", w.env), true);
  assert.equal(cliMissing("script", w.env), false, "the script runner is never missing");
  const both = new World();
  claudeApp(both, true);
  assert.equal(appWithoutCli("claude", both.env), false);
  const cliOnly = new World();
  cliOnly.env.PATH = pathWith(cliOnly, ["claude"]);
  assert.equal(appWithoutCli("claude", cliOnly.env), false);
  w.cleanup();
  both.cleanup();
  cliOnly.cleanup();
});

test("the setup: Claude's app alone said in one line and Claude Code offered — not now changes nothing, a yes runs the installer; --yes only says it", unix, async () => {
  // not now (0): the app stays the way to talk, nothing installed
  const no = new World();
  claudeApp(no);
  const r = await no.ok(["setup"], { answers: ["cs", "", "", "0", "", "", "", "", "", "", "", "n", "3", "n"] });
  assert.match(r.out, /✓ AI agent: Claude – aplikace\n/u);
  assert.match(r.out, LINE);
  assert.match(r.out, / {3}1 {2}Nainstalovat Claude Code do terminálu hned \(doporučeno; je potřeba předplatné Claude\)\n {3}0 {2}Zatím ne\n/u);
  assert.doesNotMatch(r.out, /Instalace Claude Code se nepovedla|je nainstalovaný/u);
  assert.equal(readJsonFile(path.join(no.env.STROM_CONFIG_DIR!, "config.json")).agent, "claude");
  assert.doesNotMatch(r.out, /(?<![\p{L}\p{M}\p{N}])(vy|váš|vaše|ty|tvůj)(?![\p{L}\p{M}\p{N}])/iu);
  no.cleanup();
  // yes: the installer runs (here as if it ended well: STROM_NO_INSTALL=ok) and the new terminal finds it
  const yes = new World();
  claudeApp(yes);
  yes.env.STROM_NO_INSTALL = "ok";
  const y = await yes.ok(["setup"], { answers: ["cs", "", "", "1", "", "", "", "", "", "", "", "n", "3", "n"] });
  assert.match(y.out, /Claude Code je nainstalovaný; najde ho nové okno terminálu\./u);
  yes.cleanup();
  // the installer did not work: said, with the line to run
  const failed = new World();
  claudeApp(failed);
  const f = await failed.ok(["setup"], { answers: ["cs", "", "", "", "", "", "", "", "", "", "", "n", "3", "n"] });
  assert.match(f.out, /Instalace Claude Code se nepovedla – v terminálu: curl -fsSL https:\/\/claude\.ai\/install\.sh \| bash/u);
  failed.cleanup();
  // --yes (no person asked): the line only, nothing installed
  const quiet = new World();
  claudeApp(quiet);
  quiet.env.STROM_NO_INSTALL = "ok";
  const q = await quiet.ok(["setup", "--yes", "--lang", "cs"]);
  assert.match(q.out, LINE);
  assert.doesNotMatch(q.out, /Nainstalovat Claude Code|je nainstalovaný/u);
  assert.equal((await quiet.ok(["setup", "--yes", "--lang", "cs", "--json"])).json.cliMissing, true);
  quiet.cleanup();
  // the opposite: Claude Code here (with its app or without): nothing said, nothing offered
  const both = new World();
  claudeApp(both, true);
  const b = await both.ok(["setup", "--yes", "--lang", "cs"]);
  assert.doesNotMatch(b.out, /samostatná práce a čtení skenů/u);
  assert.equal((await both.ok(["setup", "--yes", "--lang", "cs", "--json"])).json.cliMissing, undefined);
  both.cleanup();
});

test("the doctor: a warning with its code, never a failure; --fix offers Claude Code; the browser of a conversation in the app apart from strom run --chrome", unix, async () => {
  const w = new World();
  claudeApp(w);
  await w.ok(["setup", "--yes", "--lang", "cs"]);
  await w.ok(["init", "Lhotákovi"]);
  w.cwd = w.treeDir("Lhotákovi");
  const d = await w.ok(["doctor"]);
  assert.match(d.out, /!\s+agent v terminálu\s+samostatná práce, čtení skenů a práce z aplikace Strom potřebují Claude Code v terminálu {2}→ strom doctor --fix {2}\(curl -fsSL https:\/\/claude\.ai\/install\.sh \| bash\)/u);
  const cli = (await w.ok(["doctor", "--json"])).json.checks.find((c: { name: string }) => c.name === "cli");
  assert.deepEqual([cli.status, cli.code], ["warn", "agent.cli-missing"]);
  // --fix: offered to a person, not now changes nothing
  const fix = await w.run(["doctor", "--fix"], { tty: true, answers: ["0", "0", "0", "0"] });
  assert.match(fix.out, LINE);
  assert.match(fix.out, /Nainstalovat Claude Code do terminálu hned/u);
  // an archive through the browser, the extension in Chrome: there in a conversation in the app, not for strom run --chrome
  const dir = await fakeConnector(w, "archiv-a");
  const manifest = readJsonFile(path.join(dir, "connector.json"));
  fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ ...manifest, routes: ["direct", "browser"], can: [...new Set([...(manifest.can ?? []), "locate"])] }, null, 2));
  await w.ok(["connector", "use", "archiv-a", "--via", "browser"], { tty: true, answers: ["a", "a"] });
  const chrome = process.platform === "darwin" ? path.join(w.env.HOME!, "Library", "Application Support", "Google", "Chrome") : path.join(w.env.HOME!, ".config", "google-chrome");
  fs.mkdirSync(path.join(chrome, "Default", "Extensions", "fcoeoabgfenejglbffodgkkbkcdhcgfn"), { recursive: true });
  const browser = await w.run(["doctor"]);
  assert.match(browser.out, /prohlížeč \(Claude in Chrome\)\s+rozšíření v Chrome[^\n]* · v rozhovoru v aplikaci Claude ano; samostatná práce \(strom run --chrome\) jen s Claude Code v terminálu/u, browser.out);
  // the opposite: Claude Code here, no warning
  const both = new World();
  claudeApp(both, true);
  await both.ok(["setup", "--yes", "--lang", "cs"]);
  assert.equal((await both.ok(["doctor", "--json"])).json.checks.find((c: { name: string }) => c.name === "cli"), undefined);
  both.cleanup();
  w.cleanup();
});

test("strom run and strom read refuse at once with agent.cli-missing — before the consent of an agent elsewhere and before any estimate", unix, async () => {
  const w = new World();
  claudeApp(w);
  await w.ok(["setup", "--yes", "--lang", "cs"]);
  await w.ok(["init", "Lhotákovi"]);
  const tree = w.treeDir("Lhotákovi");
  w.cwd = tree;
  // a person: in the research's language, the conversation in the app and the install said
  const run = await w.run(["run"]);
  assert.notEqual(run.code, 0);
  assert.match(run.err, /Claude Code tu v terminálu není nainstalovaný – strom run ho spouští \(samotná aplikace to neumí\)/u);
  assert.match(run.err, /rozhovor v aplikaci Claude jde dál: strom chat · instalace Claude Code: strom doctor --fix/u);
  // an agent, outside the research's folder: the CLI said first — no consent asked (exit 4) for what cannot start
  const elsewhere = await w.run(["run", "--json"], { cwd: w.dir, env: { CLAUDECODE: "1" } });
  assert.equal(elsewhere.json.code, "agent.cli-missing", elsewhere.out + elsewhere.err);
  assert.notEqual(elsewhere.code, 4);
  assert.match(elsewhere.json.message, /^Claude Code \(claude\) is not installed here — strom run starts it in the terminal$/u);
  assert.match(elsewhere.json.hint, /strom chat/u);
  assert.deepEqual(elsewhere.json.params, { agent: "Claude Code", cli: "claude", command: "strom run", install: "strom doctor --fix", app: "Claude" });
  // strom read: nothing prepared, no estimate
  const read = await w.run(["read", "B0001", "--images", "1-3", "--question", "Každý křest příjmení Lhoták"]);
  assert.match(read.err, /Claude Code tu v terminálu není nainstalovaný – strom read ho spouští/u);
  assert.doesNotMatch(read.out + read.err, /minut|odhad|\$/iu);
  const json = await w.run(["read", "B0001", "--images", "1-3", "--question", "x", "--json"]);
  assert.equal(json.json.code, "agent.cli-missing");
  // no Claude app either: the same code, the hint without the app (the research itself then waits for its agent)
  const bare = agentCliMissing("claude", { ...w.env, STROM_APP_DIRS: "" }, "strom read");
  assert.deepEqual([bare.code, bare.params?.app, bare.hintCode], ["agent.cli-missing", undefined, undefined]);
  assert.match(bare.hint!, /^the user installs Claude Code: strom doctor --fix \(or in a terminal: /u);
  w.cleanup();
});

test("a link of the Strom app that starts strom run: the CLI said before the estimate and the question, the conversation in the app offered", unix, async () => {
  const w = new World();
  claudeApp(w);
  await w.ok(["setup", "--yes", "--lang", "cs"]);
  await w.ok(["init", "Lhotákovi"]);
  w.cwd = w.treeDir("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
  await w.ok(["place", "queue", "--all"]);
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
  const r = await w.run(["link", "open", `strom-research://places?tree=${id}&do=run`], { tty: true, answers: ["2", "", ""] });
  assert.match(r.out, LINE, r.out + r.err);
  assert.match(r.out, / {3}2 {2}Pokračovat v rozhovoru v aplikaci Claude\n/u);
  assert.doesNotMatch(r.out, /minut|Spustit jedno sezení/u, "no estimate, no question of the run");
  // the conversation chosen: strom chat in the app (claude://), no session of strom run
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions")) || fs.readdirSync(path.join(w.cwd, "data", "sessions")).length === 0);
  w.cleanup();
});

test("the Strom app's link to work on the queue: the CLI missing said first, no tasks shown, nothing asked of the run, nothing started", unix, async () => {
  const w = new World();
  claudeApp(w);
  await w.ok(["setup", "--yes", "--lang", "cs"]);
  await w.ok(["init", "Lhotákovi"]);
  w.cwd = w.treeDir("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  await w.ok(["task", "add", "Křest Jana v Lhotě", "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
  for (const link of [`strom-research://work?tree=${id}&do=tasks&n=3`, `strom-research://work?tree=${id}&do=loop`]) {
    const r = await w.run(["link", "open", link], { tty: true, answers: ["0", "", ""] });
    assert.match(r.out, LINE, r.out + r.err);
    assert.doesNotMatch(r.out, /Na řadě jsou|Skončí po vyřízení|Automatická práce|Pokračovat\?/u, "nothing of the run before the CLI");
  }
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions")) || fs.readdirSync(path.join(w.cwd, "data", "sessions")).length === 0);
  w.cleanup();
});

test("the menu: working alone says what it needs and offers only what strom can — Claude Code, the conversation in the app, not now", unix, async () => {
  const w = new World();
  claudeApp(w);
  await w.ok(["setup", "--yes", "--lang", "cs"]);
  await w.ok(["init", "Lhotákovi"]);
  const m = await w.ok([], { tty: true, answers: ["2", "0", "", "0"] });
  assert.match(m.out, /Samostatná práce potřebuje Claude Code v terminálu \(samotná aplikace to neumí\)\./u);
  assert.doesNotMatch(m.out, /strom setup nabídne/u);
  assert.match(m.out, / {3}1 {2}Nainstalovat Claude Code do terminálu hned[^\n]*\n {3}2 {2}Pokračovat v rozhovoru v aplikaci Claude\n {3}0 {2}Zatím ne\n/u);
  w.cleanup();
});

test("the brief of a conversation without Claude Code: scans read with the tree's strom-scan-reader, written in the tree all the same; the bridge says agent.cli-missing", unix, async () => {
  const w = new World();
  claudeApp(w);
  await w.ok(["setup", "--yes", "--lang", "cs"]);
  await w.ok(["init", "Lhotákovi"]);
  w.cwd = w.treeDir("Lhotákovi");
  assert.ok(fs.existsSync(path.join(w.cwd, ".claude", "agents", "strom-scan-reader.md")), "the subagent is in the tree without the CLI");
  const b = await w.ok(["brief"]);
  assert.match(b.out, /## No readers in this session \(Claude Code is not installed in the terminal here/u);
  assert.match(b.out, /read the scans with this tree's subagent strom-scan-reader — the Agent tool, subagent_type strom-scan-reader, no model/u);
  // the bridge's /status accepts.read: why agent.cli-missing (the app says it in its words; an unknown code is its "other")
  const accepts = readAccepts(Tree.open(w.cwd, w.env), new Settings(w.env, {}), w.env);
  assert.deepEqual([accepts?.ready, accepts?.why], [false, "agent.cli-missing"]);
  // the opposite: Claude Code here — strom read as before, nothing of the subagent instead
  const both = new World();
  claudeApp(both, true);
  await both.ok(["setup", "--yes", "--lang", "cs"]);
  await both.ok(["init", "Lhotákovi"]);
  both.cwd = both.treeDir("Lhotákovi");
  assert.doesNotMatch((await both.ok(["brief"])).out, /No readers in this session/u);
  both.cleanup();
  w.cleanup();
});
