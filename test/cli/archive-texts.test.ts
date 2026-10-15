// What an archive and a research waiting for its agent say (K3.4, K4.1–K4.5 of the archive without an agent): the
// app's links that ask an agent refused at once in one sentence, the refusal in every language, material kept (not
// "the agent goes through it"), the setup with no agent impersonal, a batch kept (not waiting to be sorted), the
// agents' files a person changed losing only strom's part, and the setup in an archive offering research.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { batchStatus } from "../../src/core/batches.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

/** No agent on this computer: only Node, git and the system's own programs. */
function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

/** An agent installed: a fake Claude Code first on PATH. */
function installAgent(w: World): void {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  w.env.PATH = [bin, w.env.PATH].join(path.delimiter);
}

const treeId = (root: string) => (readJsonFile(path.join(root, "strom.json")) as { id: string }).id;
const commits = (root: string) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: root, encoding: "utf8" }).trim());
const tasks = (w: World) => Tree.open(w.cwd, w.env).list<Task>("task").length;
const NO_AI = /agent|\bAI\b|umělá inteligence|Claude|Codex|OpenCode|Grok|Antigravity|\bmodel/i;

/** An archive (the person's choice) and a research waiting for its agent, each with one person. */
async function trees(): Promise<{ archive: World; waiting: World }> {
  const archive = new World();
  noAgent(archive);
  await archive.ok(["setup", "--yes"]);
  await archive.ok(["init", "Archiv", "--mode", "archive"]);
  archive.cwd = archive.treeDir("Archiv");
  await archive.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  const waiting = new World();
  noAgent(waiting);
  await waiting.withTree("Čekající");
  await waiting.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  return { archive, waiting };
}

const LINKS = (id: string) => [
  `strom-research://chat?tree=${id}`,
  `strom-research://chat?tree=${id}&person=P0001`,
  `strom-research://review?tree=${id}&person=P0001&scope=family`,
  `strom-research://research?tree=${id}&person=P0001&direction=ancestors`,
  `strom-research://conflict?tree=${id}&id=X0001&do=agent`,
];

test("K4.1 the app's links that ask an agent (chat, review, research, conflict&do=agent): refused at once in one sentence — in a terminal and with none — nothing asked, no task, no commit", opts, async () => {
  const { archive, waiting } = await trees();
  for (const [w, label, sentence] of [
    [archive, "archive", /^Tento výzkum je archiv: data přicházejí z aplikace Strom a nic se nezkoumá\. Výzkum se zapíná v menu, první položka\.$/m],
    [waiting, "waiting", /^Výzkum čeká na AI agenta \(Claude Code\), který na tomto počítači není: do té doby drží data z aplikace Strom jako archiv\./m],
  ] as const) {
    const before = { tasks: tasks(w), commits: commits(w.cwd) };
    for (const link of LINKS(treeId(w.cwd))) {
      // a terminal: the sentence, Enter closes — nothing else asked (the answers left say so)
      const t = await w.ok(["link", "open", link], { tty: true, answers: [""] });
      assert.match(t.out, sentence, `${label} ${link}\n${t.out}`);
      assert.doesNotMatch(t.out, /\$|Kolik|cena|úkol/i, `${label} ${link}: nothing of a cost or tasks\n${t.out}`);
      if (label === "archive") assert.doesNotMatch(t.out, NO_AI, `${label} ${link}\n${t.out}`);
      // no terminal (the system started strom): said in a window, no terminal opened
      const q = await w.ok(["link", "open", link, "--json"]);
      assert.equal(q.json.refused, label, `${label} ${link}: ${JSON.stringify(q.json)}`);
      assert.equal(q.json.done, false);
    }
    assert.deepEqual({ tasks: tasks(w), commits: commits(w.cwd) }, before, `${label}: nothing written`);
  }
  archive.cleanup();
  waiting.cleanup();
});

test("K4.1 a link of an agent in a research whose agent is here: not refused", opts, async () => {
  const w = new World();
  noAgent(w);
  installAgent(w);
  await w.withTree();
  const q = await w.run(["link", "open", `strom-research://review?tree=${treeId(w.cwd)}&person=P0001&scope=person`, "--json"]);
  assert.equal(q.json?.refused, undefined, q.out + q.err);
  w.cleanup();
});

test("K4.2 the refusal of an archive in Czech, English and German; a research waiting for its agent names the agent; neither falls back to English", opts, async () => {
  const cases = [
    ["cs", /Tento výzkum je archiv: data přicházejí z aplikace Strom/, /Výzkum čeká na AI agenta \(Claude Code\)/],
    ["en", /This research is an archive: its data come from the Strom app and nothing is researched\./, /The research waits for its AI agent \(Claude Code\), which is not on this computer/],
    ["de", /Diese Forschung ist ein Archiv: die Daten kommen aus der Strom-App/, /Die Forschung wartet auf ihren KI-Agenten \(Claude Code\)/],
  ] as const;
  for (const [lang, archived, waits] of cases) {
    const w = new World();
    noAgent(w);
    w.env.STROM_LANG = lang;
    await w.ok(["setup", "--yes"]);
    await w.ok(["init", "Archiv", "--mode", "archive"]);
    await w.ok(["init", "Wartend"]);
    for (const cmd of [["chat", "--print"], ["session", "start"], ["run"]]) {
      const a = await w.run(cmd, { cwd: w.treeDir("Archiv") });
      assert.match(a.err, archived, `${lang} ${cmd.join(" ")}\n${a.err}`);
      assert.doesNotMatch(a.err.split("\n")[0]!, NO_AI, `${lang}: an archive says nothing of an agent`);
      assert.equal(a.code, 2);
      const b = await w.run(cmd, { cwd: w.treeDir("Wartend") });
      assert.match(b.err, waits, `${lang} ${cmd.join(" ")}\n${b.err}`);
    }
    // the code a program reads
    const j = await w.run(["chat", "--print", "--json"], { cwd: w.treeDir("Archiv") });
    assert.match(j.out + j.err, /"code":\s*"archive"/);
    w.cleanup();
  }
});

test("K4.3 material in an archive: kept, said so — no conversation offered, nothing of an agent; the command too (no task next)", opts, async () => {
  const { archive, waiting } = await trees();
  // the menu: 4 add · 1 material · 2 what is known · the words · Enter back · 0
  const m = await archive.ok([], { tty: true, answers: ["4", "1", "2", "Děda Josef byl mlynář v Týnci", "", "0"] });
  assert.match(m.out, /✓ Uloženo do archivu: 1\. Projde se, až se zapne výzkum\./, m.out);
  assert.doesNotMatch(m.out, /Agent to projde|Pustit se do toho s agentem/, m.out);
  const after = m.out.slice(m.out.indexOf("Uloženo do archivu"));
  assert.doesNotMatch(after, NO_AI, after);
  // its task put aside: it waits for research switched on, nothing lost
  const t = Tree.open(archive.cwd, archive.env).list<Task>("task").filter((x) => x.level === "intake");
  assert.ok(t.length && t.every((x) => x.heldBy === "archive"), JSON.stringify(t));
  // the command
  const c = await archive.ok(["intake", "--text", "Babička Anna pekla chleba"]);
  assert.match(c.out, /^✓ Uloženo do archivu: 1\. Projde se, až se zapne výzkum\.$/m, c.out);
  assert.doesNotMatch(c.out, /task next|intake task/, c.out);
  assert.doesNotMatch(c.out, NO_AI, c.out);
  // a file, then the same file again: nothing new, said so
  const letter = path.join(archive.dir, "dopis.txt");
  fs.writeFileSync(letter, "Milá sestro, Josef se oženil v Týnci.\n");
  assert.match((await archive.ok(["intake", letter])).out, /Uloženo do archivu: 1/);
  const again = await archive.ok(["intake", letter]);
  assert.match(again.out, /^Tyhle podklady už ve výzkumu jsou – nic nepřibylo\.$/m, again.out);
  assert.doesNotMatch(again.out, /task next|intake task/, again.out);
  // waiting for its agent: kept for the agent, its task open
  const wm = await waiting.ok([], { tty: true, answers: ["4", "1", "2", "Děda Josef byl mlynář", "", "0"] });
  assert.match(wm.out, /✓ Uloženo do výzkumu: 1\. Agent to projde, až bude na počítači\./, wm.out);
  assert.doesNotMatch(wm.out, /Pustit se do toho s agentem/, wm.out);
  const wc = await waiting.ok(["intake", "--text", "Teta Marie"]);
  assert.match(wc.out, /Uloženo do výzkumu: 1/, wc.out);
  assert.doesNotMatch(wc.out, /task next/, wc.out);
  assert.ok(Tree.open(waiting.cwd, waiting.env).list<Task>("task").some((x) => x.level === "intake" && x.state === "open" && !x.heldBy));
  archive.cleanup();
  waiting.cleanup();
});

test("K4.3 the menu of an empty archive: Add to the archive is material only; the Strom app not installed — nothing followed live", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  const r = await w.ok([], { tty: true, answers: ["0"] });
  assert.match(r.out, / 4 {2}Přidat do archivu: podklady\n/, r.out);
  assert.doesNotMatch(r.out, /sledovaný živě/, r.out);
  assert.doesNotMatch(r.out, NO_AI, r.out);
  w.cleanup();
});

test("K4.4 the setup with no agent: impersonal, install the agent or only an archive for now — never 'start strom again'", opts, async () => {
  const w = new World();
  noAgent(w);
  // the wizard, every answer suggested: Enter at each question, the agent's question: 3 only an archive
  const r = await w.run(["setup"], { tty: true, answers: ["", "", "", "3", "", "", "", "", "", "", ""] });
  assert.match(r.out, /Na tomto počítači není AI agent – výzkum v matrikách a archivech se dělá s ním\./, r.out);
  assert.match(r.out, /Nainstalovat Claude Code hned/, r.out);
  assert.match(r.out, /Zatím jen archiv/, r.out);
  assert.doesNotMatch(r.out, /Nenašel jsem|Později|znovu spustit/, r.out);
  // no person to answer: the way to install said, nothing more
  const q = await w.run(["setup", "--yes"]);
  assert.doesNotMatch(q.out + q.err, /Nenašel jsem|znovu spustit/, q.out + q.err);
  w.cleanup();
});

test("K4.4 the setup's texts with no agent in every language: impersonal (no I, no you), no 'start again'", () => {
  const root = path.join(import.meta.dirname, "..", "..");
  const en = fs.readFileSync(path.join(root, "src", "cli", "ui.ts"), "utf8");
  const cs = readJsonFile(path.join(root, "assets", "lang", "cs.json")) as Record<string, string>;
  const de = readJsonFile(path.join(root, "assets", "lang", "de.json")) as Record<string, string>;
  const enOf = (k: string) => JSON.parse(en.match(new RegExp(`"${k.replace(/\./g, "\\.")}": ("(?:[^"\\\\]|\\\\.)*")`))![1]!) as string;
  for (const k of ["ui.setup.agent.none", "ui.setup.agent.manual", "ui.setup.agent.archive", "ui.setup.agent.guide"]) {
    assert.doesNotMatch(enOf(k), /\b(I|me|you|your)\b|again/i, `${k}: ${enOf(k)}`);
    assert.doesNotMatch(cs[k]!, /jsem|znovu|vy |váš|tvůj/i, `${k}: ${cs[k]}`);
    assert.doesNotMatch(de[k]!, /\b(ich|Sie|Ihr|du|erneut)\b/, `${k}: ${de[k]}`);
  }
  assert.equal(cs["ui.setup.agent.later"], undefined);
  for (const k of ["ui.archive.refuse", "ui.link.new.archive", "ui.link.new.taken.archive", "ui.intake.done.archive", "ui.menu.more.archive.empty", "ui.menu.app.new.archive", "ui.setup.mode.ask", "ui.setup.mode.keep"]) {
    assert.doesNotMatch(enOf(k), NO_AI, `${k}: ${enOf(k)}`);
    assert.doesNotMatch(cs[k]!, NO_AI, `${k}: ${cs[k]}`);
    assert.doesNotMatch(de[k]!, /Agent|KI|Modell/, `${k}: ${de[k]}`);
  }
});

test("K4.5 a batch in an archive or a research waiting for its agent is kept, not waiting to be sorted: kept on it, said so, gone after a month", opts, async () => {
  const { archive, waiting } = await trees();
  for (const w of [archive, waiting]) {
    const batches = path.join(w.cwd, ".strom", "batches");
    fs.mkdirSync(batches, { recursive: true });
    const now = new Date().toISOString();
    fs.writeFileSync(path.join(batches, "b1.json"), JSON.stringify({ id: "b1", name: "Krabice", created: now, updated: now, done: now, inputs: [], known: [], refused: [], nested: [], tasks: [] }));
    const old = new Date(Date.now() - 40 * 24 * 3600_000).toISOString();
    fs.writeFileSync(path.join(batches, "b0.json"), JSON.stringify({ id: "b0", name: "Stará", created: old, updated: old, done: old, inputs: [], known: [], refused: [], nested: [], tasks: [] }));
    const st = batchStatus(Tree.open(w.cwd, w.env));
    assert.deepEqual(st.map((b) => [b.id, b.kept]), [["b1", true]], JSON.stringify(st));
    const out = (await w.ok(["input", "batch"])).out;
    assert.match(out, /0 kept/, out);
    assert.doesNotMatch(out, /sorted/, out);
  }
  // research: no kept
  const r = new World();
  noAgent(r);
  installAgent(r);
  await r.withTree();
  const batches = path.join(r.cwd, ".strom", "batches");
  fs.mkdirSync(batches, { recursive: true });
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(batches, "b1.json"), JSON.stringify({ id: "b1", created: now, updated: now, done: now, inputs: [], known: [], refused: [], nested: [], tasks: [] }));
  assert.equal(batchStatus(Tree.open(r.cwd, r.env))[0]?.kept, undefined);
  archive.cleanup();
  waiting.cleanup();
  r.cleanup();
});

test("K3.4 an archive switched on: an agent's JSON a person changed loses only strom's keys, the shim the agents' hooks start goes", opts, async () => {
  const w = new World();
  await w.withTree("Novákovi");
  const settings = path.join(w.cwd, ".claude", "settings.json");
  const cur = readJsonFile(settings) as { permissions: { allow: string[] }; env?: Record<string, string> };
  cur.permissions.allow.push("Bash(ls:*)");
  cur.env = { MOJE: "1" };
  fs.writeFileSync(settings, JSON.stringify(cur, null, 2) + "\n");
  assert.ok(fs.existsSync(path.join(w.cwd, ".strom", "bin")), "the shim is there");
  await w.ok(["mode", "archive"], { tty: true });
  assert.deepEqual(readJsonFile(settings), { permissions: { allow: ["Bash(ls:*)"] }, env: { MOJE: "1" } }, "only what the person added stays");
  assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "bin")), "the shim gone");
  for (const f of ["AGENTS.md", "opencode.json", ".grok"]) assert.ok(!fs.existsSync(path.join(w.cwd, f)), f);
  assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).trim(), "", "committed");
  // research again: strom's part back beside the person's
  await w.ok(["mode", "research"], { tty: true });
  const back = readJsonFile(settings) as { permissions: { allow: string[] } };
  assert.ok(back.permissions.allow.includes("Bash(strom:*)"), JSON.stringify(back));
  w.cleanup();
});

test("K3.4 an unreadable agent's JSON in an archive switched on: left as it is", opts, async () => {
  const w = new World();
  await w.withTree("Novákovi");
  const oc = path.join(w.cwd, "opencode.json");
  fs.writeFileSync(oc, "{ not json, the person's own\n");
  await w.ok(["mode", "archive"], { tty: true });
  assert.equal(fs.readFileSync(oc, "utf8"), "{ not json, the person's own\n");
  w.cleanup();
});

test("A4 strom setup in an archive offers research: kept an archive (Enter), or switched on", opts, async () => {
  const w = new World();
  noAgent(w);
  installAgent(w);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  const keep = await w.run(["setup"], { tty: true, answers: Array(20).fill("") });
  assert.match(keep.out, /„Archiv“ je archiv\. Nechat ho tak, nebo zapnout výzkum\?/, keep.out);
  assert.equal((readJsonFile(path.join(w.cwd, "strom.json")) as { mode?: string }).mode, "archive", "Enter keeps it");
  // the person's yes: language, folder, the app, its links (the shortcut is there now) · 2 switch research on · a yes ·
  // the agent's steps: no
  const on = await w.run(["setup"], { tty: true, answers: ["", "", "", "", "2", "a", "n", "", ""] });
  assert.match(on.out, /Práce s agentem je zapnutá|Výzkum je znovu zapnutý/, on.out);
  assert.equal((readJsonFile(path.join(w.cwd, "strom.json")) as { mode?: string }).mode, undefined, "research");
  // a research: nothing asked
  const again = await w.run(["setup"], { tty: true, answers: Array(20).fill("") });
  assert.doesNotMatch(again.out, /Nechat ho tak, nebo zapnout výzkum/, again.out);
  w.cleanup();
});
