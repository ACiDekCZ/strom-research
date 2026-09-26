// The menu's two submenus, as a person uses them: adding to the research
// (material from the family, a new direction) and the settings of this
// computer (the agent working alone, hooks, Remote Control, archives).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, fakeConnector, hasGit, readJsonFile } from "../helpers.ts";
import { droppedPaths } from "../../src/cli/menu-parts.ts";

const unix = { skip: !hasGit || process.platform === "win32" };

/** A tree with strom set up, Claude Code as a fake that ends at once, and the tree's folder to work in. */
async function world(): Promise<World> {
  const w = new World();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git) fs.symlinkSync(git, path.join(bin, "git"));
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\necho "$@" >> "${path.join(w.dir, "claude.calls")}"\nexit 0\n`, { mode: 0o755 });
  w.env.PATH = bin; // only these: no agent of this computer
  await w.withTree();
  return w;
}

test("paths dropped into the terminal: quoted, escaped, several — on Windows a backslash is the path's", () => {
  assert.deepEqual(droppedPaths("/Users/a/My\\ Folder"), ["/Users/a/My Folder"]);
  assert.deepEqual(droppedPaths("'/tmp/Dopisy babičky' \"/tmp/rodokmen.ged\" "), ["/tmp/Dopisy babičky", "/tmp/rodokmen.ged"]);
  assert.deepEqual(droppedPaths("/tmp/a.jpg /tmp/b.jpg"), ["/tmp/a.jpg", "/tmp/b.jpg"]);
  assert.deepEqual(droppedPaths('"C:\\Users\\Jana\\Fotky rodiny"', "win32"), ["C:\\Users\\Jana\\Fotky rodiny"]);
  assert.deepEqual(droppedPaths("  "), []);
});

test("the menu: material from the family — a folder dragged in, what the person knows, the scans of a book sent to the agent", unix, async () => {
  const w = await world();
  const docs = path.join(w.dir, "Dopisy babičky");
  fs.mkdirSync(docs);
  fs.writeFileSync(path.join(docs, "dopis 1923.jpg"), "a letter");
  fs.writeFileSync(path.join(docs, "křestní list.pdf"), "a certificate");
  const dropped = docs.replace(/ /g, "\\ ");
  // 4 add · 1 material · 1 files · the folder dropped in · not now with the agent · 0 back · 0 quit
  const r = await w.ok([], { tty: true, answers: ["4", "1", "1", dropped, "n", "0", "0"] });
  assert.match(r.out, /Rozšířit výzkum\n {3}1 {2}Přidat podklady/);
  assert.match(r.out, /✓ Přidáno do výzkumu: 2\. Agent to projde při další práci\./);
  assert.equal((await w.ok(["input", "list", "--json"])).json.inputs.length, 2);
  // the same again: nothing new · then what the person knows, and on with the agent (the first message says what it is)
  const again = await w.ok([], { tty: true, answers: ["4", "1", "1", `'${docs}'`, "1", "2", "Děda Jan byl mlynář v Týnci, narozen asi 1905.", "", "0", "0"] });
  assert.match(again.out, /Tyhle podklady už ve výzkumu jsou – nic nepřibylo\./);
  const inputs = (await w.ok(["input", "list", "--json"])).json.inputs;
  assert.equal(inputs.length, 3);
  assert.match(fs.readFileSync(path.join(w.dir, "claude.calls"), "utf8"), /Do výzkumu jsem přidal\(a\) nové podklady/);
  // a folder of many images: the scans of a book — not taken in here
  const book = path.join(w.dir, "sken matriky");
  fs.mkdirSync(book);
  for (let i = 1; i <= 21; i++) fs.writeFileSync(path.join(book, `${i}.jpg`), `image ${i}`);
  const scans = await w.ok([], { tty: true, answers: ["4", "1", "1", `"${book}"`, "n", "0", "0"] });
  assert.match(scans.out, /Ve složce sken matriky je 21 obrázků\. Jsou to rodinné dokumenty a fotky\?/);
  assert.match(scans.out, /řekněte agentovi v rozhovoru, odkud jsou/);
  assert.equal((await w.ok(["input", "list", "--json"])).json.inputs.length, 3, "nothing taken in");
  // a path that is not there is asked again
  const missing = await w.ok([], { tty: true, answers: ["4", "1", "1", "/nikde/nic", "0", "0", "0"] });
  assert.match(missing.out, /Nenašel jsem: \/nikde\/nic/);
  assert.doesNotMatch(missing.out, /Stiskněte Enter/, "0 goes back at once: nothing to read, no Enter");
  w.cleanup();
});

test("the menu: a new direction — the ancestors of someone new, with what the person knows; the descendants of someone in the tree", unix, async () => {
  const w = await world();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  // 4 add · 2 new direction · 1 ancestors · 2 someone new · the name · 2 a woman · Enter: the name suggested · what is known · not now · 0 · 0
  const r = await w.ok([], { tty: true, answers: ["4", "2", "1", "2", "Marie Svobodová", "2", "", "Narozena asi 1920 v Týnci, provdaná Nováková.", "n", "0", "0"] });
  assert.match(r.out, /Jak výzkum pojmenovat\? \[Předci: Marie Svobodová\]/);
  assert.match(r.out, /✓ Výzkum „Předci: Marie Svobodová“ je založený\./);
  const research = (await w.ok(["research", "list", "--json"])).json.researches.find((x: { name: string }) => x.name === "Předci: Marie Svobodová");
  assert.ok(research, "the research is there");
  const marie = (await w.ok(["person", "show", research.focus, "--json"])).json.person;
  assert.equal(marie.sex, "F");
  assert.deepEqual([marie.names[0].given, marie.names[0].surname], ["Marie", "Svobodová"]);
  const told = (await w.ok(["input", "list", "--json", "--full"])).json.inputs.find((i: { text?: string }) => i.text?.includes("provdaná Nováková"));
  assert.ok(told, "what the person knows is an input");
  // the descendants of someone in the tree, started with the agent at once
  const d = await w.ok([], { tty: true, answers: ["4", "2", "2", "1", "Jan", "", "", "", "0", "0"] });
  assert.match(d.out, /Jak výzkum pojmenovat\? \[Potomci: Jan Novák\]/);
  assert.equal((await w.ok(["research", "list", "--json"])).json.researches.find((x: { name: string }) => x.name === "Potomci: Jan Novák").direction, "descendants");
  assert.match(fs.readFileSync(path.join(w.dir, "claude.calls"), "utf8"), /Založil\(a\) jsem nový výzkum „Potomci: Jan Novák“/);
  w.cleanup();
});

test("the menu: the settings of this computer — the agent working alone, a hook, Remote Control, downloaders asking first", unix, async () => {
  const w = await world();
  const hook = path.join(w.home, "shared", "plugins", "hooks", "zprava");
  fs.mkdirSync(hook, { recursive: true });
  fs.writeFileSync(path.join(hook, "hook.json"), JSON.stringify({ interface: 1, title: "Zpráva do telefonu", command: ["node", "hook.ts"] }));
  const config = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  // 7 settings · 2 working alone · 1 minutes: 90 · 2 the condition: 1 Claude usage, 12 · 0 back
  // · 3 hooks · 1 on: yes · 0 back · 6 Remote Control: yes · 4 archives · 1 ask first: yes · 0 back · 0 back · 0 quit
  const r = await w.ok([], { tty: true, answers: ["7", "2", "1", "90", "2", "1", "12", "0", "3", "1", "a", "0", "6", "a", "4", "1", "a", "0", "0", "0"] });
  assert.match(r.out, /Nastavení \(na tomto počítači\)\n {3}1 {2}Jazyk, agent, model/);
  assert.match(r.out, /Samostatná práce agenta: 90 min na úkol · podmínka: Claude usage 12/);
  assert.match(r.out, /Zpráva do telefonu: zapnuto/);
  assert.match(r.out, /Sledovat agenta z telefonu \(Remote Control\): rozhovory i samostatná práce/);
  assert.match(r.out, /Stahovače se vás ptají, než začnou: zapnuto/);
  const c = config();
  assert.equal(c.runMinutes, 90);
  assert.equal(c.runGate, "claude-usage 12");
  assert.deepEqual(c.hooks, ["zprava"]);
  assert.equal(c.agentRemote, "on");
  assert.equal(c.connectorsConsent, "on");
  // and back: no condition, the hook off — 0 in a question changes nothing
  await w.ok([], { tty: true, answers: ["7", "2", "2", "2", "0", "3", "1", "0", "0", "0"] });
  assert.equal(config().runGate, undefined);
  assert.equal(config().hooks, undefined);
  w.cleanup();
});

test("the menu without an AI agent: said, item 1 gets one, nothing offered that needs it — nothing of Claude's; the numbers stay", unix, async () => {
  const w = await world();
  fs.rmSync(path.join(w.dir, "bin", "claude"));
  // 1 get an agent: 3 later · Enter · 2 working alone: said · Enter · 4 add · 1 material · 2 what is known · the text · 0 · 7 settings · 0 · 0
  const r = await w.ok([], { tty: true, answers: ["1", "3", "", "2", "", "4", "1", "2", "Babička Anna pocházela z Kolína.", "0", "7", "0", "0"] });
  assert.match(r.out, /Na počítači zatím není žádný AI agent – výzkum dělá on\. Volba 1 ho nainstaluje\./);
  assert.match(r.out, / 1 {2}Nainstalovat nebo vybrat AI agenta\n {3}2 {2}Nechat agenta pracovat samotného\n {3}3 {2}Co čeká na vás/, "the same numbers as with an agent");
  assert.match(r.out, /Agent se do toho pustí, až bude na počítači/);
  // Claude Code is named only where it is recommended to install
  assert.doesNotMatch(r.out.replace(/.*Nainstalovat Claude Code hned.*\n/u, ""), /Remote Control|Claude|Začít na něm s agentem|Projít to s agentem/);
  assert.equal((await w.ok(["input", "list", "--json"])).json.inputs.length, 1, "the material is in, for the agent to come");
  w.cleanup();
});

test("the menu never has more than nine items: two agents and a new version at once", unix, async () => {
  const w = await world();
  fs.writeFileSync(path.join(w.dir, "bin", "codex"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const release = path.join(w.dir, "release");
  fs.mkdirSync(release);
  fs.writeFileSync(path.join(release, "VERSION"), "9.9.9\n");
  Object.assign(w.env, { STROM_DOWNLOAD_BASE: `file://${release}`, STROM_UPDATES: "check" });
  await w.ok(["init", "Svobodovi"]);
  const r = await w.ok([], { tty: true, answers: ["0"] });
  const items = [...r.out.matchAll(/^ {3}(\d) {2}/gmu)].map((m) => Number(m[1]));
  assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7, 8, 9, 0], r.out);
  assert.match(r.out, /Tentokrát mluvit s jiným agentem/);
  assert.match(r.out, /Vyšla nová verze stromu: 9\.9\.9 – aktualizovat ji můžete v Nastavení \(volba 7\)\./);
  w.cleanup();
});

test("the menu: what waits for the person — what to do for each, the folder for images, their answer back to the agent", unix, async () => {
  const w = await world();
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["recordset", "add", "Žďár N 1784–1820", "--url", "https://archive.example.org/book/5359"]); // B1
  await w.ok(["task", "add", "Kde jsou zapsány křty obce Týnec", "--level", "locate", "--where", "matriky farnosti", "--why", "křest Jana", "--done-when", "kniha nalezena"]); // T1
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis"]); // T2
  await w.ok(["task", "wait", "T1", "--on", "V badatelně archivu najít knihu narozených pro Týnec a poslat odkaz na ni."]);
  await w.ok(["task", "wait", "T2", "--images", "B1:9-10", "--on", "snímky 9–10 knihy Žďár"]);
  // 3 what waits · 2 open the folder of the images · 1 answer the first · the link · not with the agent now · 0 back · 0 quit
  const r = await w.ok([], { tty: true, answers: ["3", "2", "1", "https://archive.example.org/book/77", "n", "0", "0"] });
  assert.match(r.out, /Agent od vás potřebuje \(2\):\n\n 1\. Kde jsou zapsány křty obce Týnec\n {4}Co udělat: V badatelně archivu najít knihu narozených pro Týnec a poslat odkaz na ni\./);
  assert.match(r.out, / 2\. Křest Jana\n {4}Uložit ručně: snímky 9–10 z Žďár N 1784–1820 · https:\/\/archive\.example\.org\/book\/5359\n {4}uložte je do .+inbox\/B0001 Žďár N 1784–1820\//);
  assert.match(r.out, /1 {2}Odpovědět k 1: Kde jsou zapsány křty obce Týnec\n {3}2 {2}Otevřít složku pro snímky k 2/);
  assert.match(r.out, /✓ Úkol se vrátil agentovi i s vaší odpovědí\./);
  const t1 = (await w.ok(["task", "show", "T1", "--json"])).json.task;
  assert.equal(t1.state, "open");
  assert.match(t1.notes.at(-1).text, /^Odpověď uživatele \(na: V badatelně archivu najít knihu narozených pro Týnec.*\): https:\/\/archive\.example\.org\/book\/77$/);
  // what is left: the images only
  assert.match(r.out, /Agent od vás potřebuje \(1\):\n\n 1\. Křest Jana/);
  w.cleanup();
});

test("the menu, where it could go wrong: an empty folder, strom's own folder, a file:// address, the same research twice, a wrong number, a long answer, a tree's own time", unix, async () => {
  const w = await world();
  assert.deepEqual(droppedPaths("file:///tmp/Dopisy%20babi%C4%8Dky"), ["/tmp/Dopisy babičky"]);
  const empty = path.join(w.dir, "prázdná");
  fs.mkdirSync(empty);
  fs.writeFileSync(path.join(empty, ".DS_Store"), "");
  const letters = path.join(w.dir, "dopisy");
  fs.mkdirSync(letters);
  fs.writeFileSync(path.join(letters, "dopis.txt"), "Milá Anno…");
  const book = path.join(w.dir, "matrika");
  fs.mkdirSync(book);
  for (let i = 1; i <= 21; i++) fs.writeFileSync(path.join(book, `${i}.jpg`), `image ${i}`);
  const r = await w.ok([], {
    tty: true,
    answers: ["4", "1", "1", `"${empty}"`, "1", "1", `"${w.cwd}"`, "0", "1", "1", `"${book}" "${letters}"`, "n", "n", "0", "0"],
  });
  assert.match(r.out, /Není v tom nic, co by se dalo přidat\./);
  assert.match(r.out, /je složka samotného stromu \(výzkumu\), ne rodinné podklady\./);
  assert.match(r.out, /matrika: skeny matriky nebo jiné knihy patří k té knize/);
  assert.match(r.out, /✓ Přidáno do výzkumu: 1\./, "the letters are taken in, the book is not");
  // the same research twice: said, nothing made
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Novák/", "--sex", "M"]);
  const twice = await w.ok([], { tty: true, answers: ["4", "2", "1", "1", "Jan", "0", "0"] });
  assert.match(twice.out, /Takový výzkum už je: „Předci Jana“/);
  assert.equal((await w.ok(["research", "list", "--json"])).json.researches.length, 1);
  // claude-usage takes a number of points; a tree with a time of its own gets the change
  await w.ok(["config", "set", "run.minutes", "45", "--for-tree"]);
  const s = await w.ok([], { tty: true, answers: ["7", "2", "2", "1", "hodně", "15", "1", "30", "0", "0", "0"] });
  assert.match(s.out, /Napište prosím počet bodů od 0 do 100/);
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).runGate, "claude-usage 15");
  assert.match(s.out, /Čas na jeden úkol: 30 min/);
  assert.equal((await w.ok(["config", "get", "run.minutes", "--json"])).json.value, 30);
  // a long answer to what waits is asked again, shorter
  await w.ok(["task", "add", "Kde je kniha", "--level", "locate", "--where", "archiv", "--why", "křest", "--done-when", "odkaz"]);
  await w.ok(["task", "wait", "T1", "--on", "poslat odkaz na knihu"]);
  const long = await w.ok([], { tty: true, answers: ["3", "1", "x".repeat(301), "https://archive.example.org/book/1", "n", "0", "0"] });
  assert.match(long.out, /Na odpověď sem je to dlouhé \(nejvýš 300 znaků\)/);
  assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open");
  w.cleanup();
});

test("Remote Control on in Claude Code itself: the settings say so, and what strom's own setting adds", unix, async () => {
  const w = await world();
  const claudeDir = path.join(w.dir, "claude config");
  fs.mkdirSync(claudeDir);
  fs.writeFileSync(path.join(claudeDir, "settings.json"), JSON.stringify({ remoteControlAtStartup: true }));
  w.env.CLAUDE_CONFIG_DIR = claudeDir;
  const r = await w.ok([], { tty: true, answers: ["7", "6", "n", "0", "0"] });
  assert.match(r.out, /Sledovat agenta z telefonu \(Remote Control\): rozhovory ano, samostatná práce ne/);
  assert.match(r.out, /Samostatnou práci agenta \(volba 2 v menu\) až když zapnete i tohle\.\nZapnout to i pro samostatnou práci\?/);
  w.cleanup();
});

test(
  "another folder for the research: it moves along — the trees, the shared folder with the plugins; never while an agent works, never into a full folder; never by a setting alone",
  unix,
  async () => {
    const w = await world();
    await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
    const hook = path.join(w.home, "shared", "plugins", "hooks", "zprava");
    fs.mkdirSync(hook, { recursive: true });
    fs.writeFileSync(path.join(hook, "hook.json"), JSON.stringify({ interface: 1, command: ["node", "hook.ts"] }));
    const old = w.home;
    const config = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
    // an agent or a script cannot move it by a setting
    const set = await w.run(["config", "set", "home", path.join(w.dir, "jinam")]);
    assert.equal(set.code, 2);
    assert.match(set.err, /the research is in .* changing home would leave it behind/);
    // a folder that holds something already: it stays
    const full = path.join(w.dir, "plná složka");
    fs.mkdirSync(full);
    fs.writeFileSync(path.join(full, "něco.txt"), "x");
    const r1 = await w.ok(["setup"], { tty: true, answers: ["", full, "0", "0", "0", "n", "0"] });
    assert.match(r1.out, /Ve složce .*plná složka už něco je/);
    assert.match(r1.out, /Výzkum zůstává ve složce/);
    assert.equal(config().home, old);
    // an agent at work in a tree: it stays
    const { enterWorker } = await import("../../src/core/workers.ts");
    const leave = enterWorker(w.treeDir("Novákovi"), "chat-1", "rozhovor");
    const target = path.join(w.dir, "Nový disk", "Strom");
    const r2 = await w.ok(["setup"], { tty: true, answers: ["", target, "0", "0", "0", "n", "0"] });
    assert.match(r2.out, /V rodokmenu Novákovi teď někdo pracuje \(agent, samostatná práce nebo živé sledování v aplikaci Strom\)/);
    leave();
    // moved, on a yes: the tree works from there, the hook is found, the old folder is gone
    const r3 = await w.ok(["setup"], { tty: true, answers: ["", target, "", "0", "0", "0", "n", "0"] });
    assert.match(r3.out, /Výzkum je ve složce .* \(rodokmeny: Novákovi\) i se sdílenou složkou/);
    assert.match(r3.out, /✓ Výzkum je teď ve složce .*Nový disk\/Strom\./);
    assert.equal(config().home, target);
    assert.ok(!fs.existsSync(old), "the old folder moved");
    w.cwd = path.join(target, "Novákovi");
    assert.equal((await w.ok(["person", "list", "--json"])).json.persons.length, 1);
    await w.ok(["check"]);
    assert.deepEqual(
      (await w.ok(["hook", "list", "--json"])).json.hooks.map((h: { name: string }) => h.name),
      ["zprava"],
    );
    w.cleanup();
  },
);

test("the Strom app wanted but not installed here: installing it from the browser is offered first, else it opens", unix, async () => {
  const w = await world();
  await w.ok(["config", "set", "strom.app", "yes"]);
  // 6 the app · yes, install it · 0 quit
  const r = await w.ok([], { tty: true, answers: ["6", "", "0"] });
  assert.match(r.out, /Aplikace Strom na tomto počítači ještě není nainstalovaná\. Nainstalovat ji teď jako aplikaci z prohlížeče/);
  // no: it opens in the browser, as before
  const no = await w.ok([], { tty: true, answers: ["6", "n", "0"] });
  assert.match(no.out, /Nainstalovat ji teď jako aplikaci z prohlížeče/);
  w.cleanup();
});

test("archives through the browser: the way each downloader takes, switched in the menu; only Claude Code can, with the Claude in Chrome extension — said by the menu and doctor", unix, async () => {
  const w = await world();
  const dir = await fakeConnector(w, "archiv-a");
  const manifest = readJsonFile(path.join(dir, "connector.json"));
  fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ ...manifest, routes: ["direct", "browser"], can: [...new Set([...(manifest.can ?? []), "locate"])] }, null, 2));
  // 7 settings · 4 archives · 2 through the browser · yes · 0 · 0 · 0
  const r = await w.ok([], { tty: true, answers: ["7", "4", "2", "", "0", "0", "0"] });
  assert.match(r.out, /• Testovací archiv — snímky přímo, strom hlídá tempo/);
  assert.match(r.out, /2 {2}Testovací archiv: stahovat raději přes váš prohlížeč/);
  assert.match(r.out, /✓ Testovací archiv: odteď přes váš prohlížeč\./);
  assert.match(r.out, /• Testovací archiv — snímky přes váš prohlížeč/);
  assert.match(r.out, /Chrome k tomu potřebuje rozšíření Claude in Chrome .* tady ho v žádném prohlížeči nevidím: https:\/\/chromewebstore\.google\.com\/detail\//);
  assert.match((await w.run(["doctor"])).out, /prohlížeč \(Claude in Chrome\)\s+rozšíření není nainstalované \(potřebuje ho Testovací archiv\)/);
  // the extension in Chrome's profile: found
  const chrome = process.platform === "darwin" ? path.join(w.env.HOME!, "Library", "Application Support", "Google", "Chrome") : path.join(w.env.HOME!, ".config", "google-chrome");
  fs.mkdirSync(path.join(chrome, "Default", "Extensions", "fcoeoabgfenejglbffodgkkbkcdhcgfn"), { recursive: true });
  assert.match((await w.run(["doctor"])).out, /prohlížeč \(Claude in Chrome\)\s+rozšíření v Chrome/);
  // another agent does the research: it has no browser tools — said, in the doctor and before a conversation
  fs.writeFileSync(path.join(w.dir, "bin", "codex"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await w.ok(["agents", "use", "codex"]);
  assert.match((await w.run(["doctor"])).out, /Testovací archiv stahují přes prohlížeč – to umí jen Claude Code \(teď: OpenAI Codex CLI\)/);
  const a = await w.ok([], { tty: true, answers: ["7", "4", "0", "0", "0"] });
  assert.match(a.out, /Testovací archiv: stahuje se přes prohlížeč – to umí jen Claude Code \(rozšíření Claude in Chrome\); výzkum teď dělá OpenAI Codex CLI\./);
  w.cleanup();
});

test("what a review of the menu found: a move from the settings, 0 for the folder, a folder with .DS_Store, the top of a disk, consents after a move", unix, async () => {
  const w = await world();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  const config = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  const old = w.home;
  // a consent knows its connector by the folder
  const consents = path.join(w.env.STROM_CONFIG_DIR!, "consents.json");
  fs.writeFileSync(consents, JSON.stringify({ connectors: { zkouska: { dir: path.join(old, "shared", "plugins", "connectors", "zkouska"), hash: "x", hosts: [], at: "2026-01-01" } }, hosts: {} }));
  // 0 for the folder keeps it
  await w.ok(["setup"], { tty: true, answers: ["", "0", "0", "0", "0", "n", "0"] });
  assert.equal(config().home, old);
  assert.ok(!fs.existsSync(path.join(w.cwd, "0")) && !fs.existsSync(path.join(w.dir, "0")));
  // moved from the menu's settings into a folder Finder has been in: the menu goes on, with the tree where it is now
  const target = path.join(w.dir, "Nové místo");
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, ".DS_Store"), "");
  const r = await w.ok([], { tty: true, answers: ["7", "1", "", target, "", "0", "0", "0", "n", "0", "5", "1", "", "0", "0"] });
  assert.match(r.out, /✓ Výzkum je teď ve složce .*Nové místo\./);
  assert.match(r.out, /Novákovi – přehled výzkumu/, "the menu goes on, the tree opened where it is now");
  assert.doesNotMatch(r.out + r.err, /not a Strom tree|error:/);
  assert.equal(readJsonFile(consents).connectors.zkouska.dir, path.join(target, "shared", "plugins", "connectors", "zkouska"));
  // the top of a disk (only its own hidden folders): into a folder of its own there
  const disk = path.join(w.dir, "USB");
  fs.mkdirSync(path.join(disk, ".fseventsd"), { recursive: true });
  const d = await w.ok(["setup"], { tty: true, answers: ["", disk, "", "0", "0", "0", "n", "0"] });
  assert.match(d.out, /✓ Výzkum je teď ve složce .*USB\/Nové místo\./);
  assert.equal(config().home, path.join(disk, "Nové místo"));
  w.cleanup();
});

test("what a review of the menu found: words that start with a dash, Enter in a submenu, an answer to what waits no more, a broken hook turned off, a broken link in a folder", unix, async () => {
  const w = await world();
  // words that start with a dash are the person's words
  await w.ok([], { tty: true, answers: ["4", "1", "2", "- děda byl mlynář", "n", "0", "0"] });
  const inputs = (await w.ok(["input", "list", "--json", "--full"])).json.inputs;
  assert.equal(inputs[0].text, "- děda byl mlynář");
  // Enter in a submenu goes back: the hook stays off
  const hook = path.join(w.home, "shared", "plugins", "hooks", "zprava");
  fs.mkdirSync(hook, { recursive: true });
  fs.writeFileSync(path.join(hook, "hook.json"), JSON.stringify({ interface: 1, command: ["node", "hook.ts"] }));
  await w.ok([], { tty: true, answers: ["7", "3", "", "", "0"] });
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).hooks, undefined);
  // a hook turned on whose folder is gone can be turned off
  await w.ok(["hook", "on", "zprava"], { tty: true });
  fs.rmSync(hook, { recursive: true });
  await w.ok(["hook", "off", "zprava"], { tty: true });
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).hooks, undefined);
  // an answer to a task that waits no more is refused
  await w.ok(["task", "add", "Kde je kniha", "--level", "locate", "--where", "archiv", "--why", "křest", "--done-when", "odkaz"]);
  assert.equal((await w.run(["task", "wake", "T1", "--answer", "odkaz"])).code, 2);
  // a broken link inside a dropped folder is left out
  const docs = path.join(w.dir, "dopisy");
  fs.mkdirSync(docs);
  fs.writeFileSync(path.join(docs, "dopis.txt"), "Milá Anno");
  fs.symlinkSync(path.join(w.dir, "nikde"), path.join(docs, "alias"));
  const r = await w.ok([], { tty: true, answers: ["4", "1", "1", `"${docs}"`, "n", "0", "0"] });
  assert.match(r.out, /✓ Přidáno do výzkumu: 1\./);
  w.cleanup();
});
