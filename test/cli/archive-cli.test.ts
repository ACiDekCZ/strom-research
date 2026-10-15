// The commands of an agent's work where nobody researches (an archive, a research waiting for its agent), as the app's
// links already were (K4.1): strom review and strom research new refused in one sentence of the research's language —
// no direction, no task, nothing of strom run; the person's sentence carries no English (the agent's hint stays in
// --json; English is the agent's own: its hint stays). strom mode research in an archive with no agent here: the agent first, as the menu's "switch research on"
// (K3.1). What an archive says of its tasks and of a family tree taken in: in the research's language.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Person, Research, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

/** No agent on this computer: only Node, git and the system's own programs. */
function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

const commits = (root: string) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: root, encoding: "utf8" }).trim());
const stored = (root: string) => (readJsonFile(path.join(root, "strom.json")) as { mode?: string }).mode;
/** English inside the person's sentence (an agent's hint, a word of the catalog left over). */
const ENGLISH = /the person|its first item|strom run|to go on|no tasks|persons|families|as leads/;

const LANGS = [
  { lang: "cs", archive: /^chyba: Tento výzkum je archiv: data přicházejí z aplikace Strom a nic se nezkoumá\. Výzkum se zapíná v menu, první položka\.$/m, waiting: /^chyba: Výzkum čeká na AI agenta \(Claude Code\), který na tomto počítači není/m, hint: /^→ nebo v terminálu: strom (mode research|setup)$/m },
  { lang: "en", archive: /^error: This research is an archive: its data come from the Strom app and nothing is researched\. Research is switched on in the menu, its first item\.$/m, waiting: /^error: The research waits for its AI agent \(Claude Code\), which is not on this computer/m, hint: /^→ strom (mode research|setup)\b/m },
  { lang: "de", archive: /^Fehler: Diese Forschung ist ein Archiv: die Daten kommen aus der Strom-App, und nichts wird erforscht\./m, waiting: /^Fehler: Die Forschung wartet auf ihren KI-Agenten \(Claude Code\)/m, hint: /^→ oder im Terminal: strom (mode research|setup)$/m },
] as const;

test("S2 strom review and strom research new in an archive and a research waiting for its agent: refused in one sentence (cs, en, de) — no direction, no task, no commit, nothing of strom run", opts, async () => {
  for (const { lang, archive, waiting, hint } of LANGS) {
    const w = new World();
    noAgent(w);
    w.env.STROM_LANG = lang;
    await w.ok(["setup", "--yes"]);
    await w.ok(["init", "Archiv", "--mode", "archive"]);
    await w.ok(["init", "Čekající"]);
    for (const [name, sentence] of [["Archiv", archive], ["Čekající", waiting]] as const) {
      const cwd = w.treeDir(name);
      await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"], { cwd });
      const before = commits(cwd);
      for (const cmd of [["review", "P0001"], ["review", "--unproven"], ["research", "new", "Předci Josefa", "--person", "P0001"], ["research", "new", "Předci Karla", "--new-person", "Karel /Novák/"]]) {
        const r = await w.run(cmd, { cwd });
        const said = `${lang} ${name} ${cmd.join(" ")}\n${r.out}${r.err}`;
        assert.equal(r.code, 2, said);
        assert.match(r.err, sentence, said);
        assert.match(r.err, hint, said);
        if (lang !== "en") assert.doesNotMatch(r.err, ENGLISH, said);
        assert.doesNotMatch(r.out + r.err, /strom run|\+G\d|\+T\d/, said);
      }
      const tree = Tree.open(cwd, w.env);
      assert.deepEqual([tree.list<Research>("research").length, tree.list<Task>("task").length, tree.list<Person>("person").length], [0, 0, 1], `${lang} ${name}: nothing written`);
      assert.equal(commits(cwd), before, `${lang} ${name}: no commit`);
      // a program and an agent: the code and the English with the agent's hint
      const j = await w.run(["review", "P0001", "--json"], { cwd });
      assert.equal(j.json?.code, name === "Archiv" ? "archive" : "agent.missing", j.out);
      assert.match(j.json?.message ?? "", name === "Archiv" ? /^This research is an archive/ : /^The research waits for its AI agent/, j.out);
    }
    // the conversation's refusal: its hint in the person's language too (found: "(the person: strom's menu, its first item)")
    const c = await w.run(["chat", "--print"], { cwd: w.treeDir("Archiv") });
    assert.match(c.err, archive, c.err);
    assert.match(c.err, hint, c.err);
    if (lang !== "en") assert.doesNotMatch(c.err, ENGLISH, c.err);
    w.cleanup();
  }
});

test("S2 a research whose agent is here: review and research new as before", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  const g = await w.ok(["research", "new", "Předci Josefa", "--person", "P0001"]);
  assert.match(g.out, /\+G0001 research/);
  assert.equal((await w.run(["review", "P0001"])).code, 0);
  w.cleanup();
});

test("N1 strom mode research in an archive with no agent here: the agent offered first; none got — the archive as it was, nothing written or committed, a sentence says why", opts, async () => {
  for (const [lang, later] of [
    ["cs", /^Archiv zůstává beze změny: výzkum jde zapnout, až bude na počítači AI agent\.$/m],
    ["en", /^The archive stays as it was: research can be switched on once an AI agent is on this computer\.$/m],
    ["de", /^Das Archiv bleibt, wie es war: die Forschung lässt sich einschalten, sobald ein KI-Agent auf dem Computer ist\.$/m],
  ] as const) {
    const w = new World();
    noAgent(w);
    w.env.STROM_LANG = lang;
    await w.ok(["setup", "--yes"]);
    await w.ok(["init", "Archiv", "--mode", "archive"]);
    w.cwd = w.treeDir("Archiv");
    const before = commits(w.cwd);
    // a person at the terminal: the agent offered (install · the page · only an archive for now) — 3
    const t = await w.ok(["mode", "research"], { tty: true, answers: ["3"] });
    assert.match(t.out, lang === "cs" ? /Na tomto počítači zatím není agent, se kterým pracovat/ : /./, t.out);
    assert.match(t.out, later, `${lang}\n${t.out}`);
    assert.doesNotMatch(t.out, /Práce s agentem je zapnutá|Work with an agent is on/, t.out);
    // no terminal (a script): the sentence, nothing asked
    const s = await w.ok(["mode", "research"]);
    assert.match(s.out, later, s.out);
    assert.equal((await w.ok(["mode", "research", "--json"])).json.changed, false);
    assert.equal(stored(w.cwd), "archive", lang);
    assert.equal(commits(w.cwd), before, `${lang}: nothing committed`);
    w.cleanup();
  }
});

test("S3 an archive's tasks in the research's language: no tasks, a task put aside — no English inside, no wake to go on", opts, async () => {
  for (const [lang, none, held] of [
    ["cs", /^Žádné úkoly\.$/m, /^odloženo: výzkum je archiv/m],
    ["en", /^No tasks\.$/m, /^kept for later: the research is an archive/m],
    ["de", /^Keine Aufgaben\.$/m, /^zurückgestellt: die Forschung ist ein Archiv/m],
  ] as const) {
    const w = new World();
    w.env.STROM_LANG = lang;
    await w.withTree();
    await w.ok(["task", "add", "Křest Josefa", "--level", "locate", "--where", "Týnec", "--why", "a", "--done-when", "b"]);
    await w.ok(["mode", "archive"], { tty: true });
    assert.match((await w.ok(["task", "list"])).out, none, lang);
    const show = (await w.ok(["task", "show", "T0001"])).out;
    assert.match(show, held, `${lang}\n${show}`);
    assert.doesNotMatch(show, /to go on|task wake/, `${lang}\n${show}`);
    w.cleanup();
  }
});

test("P4 a family tree taken in by an archive: its people are in it at once, said in the research's language (cs, en, de)", opts, async () => {
  const app = {
    version: 12,
    persons: {
      p_a: { id: "p_a", firstName: "Jan", lastName: "Testovací", gender: "male", birthDate: "1890", partnerships: ["u1"], parentIds: [], childIds: [] },
      p_b: { id: "p_b", firstName: "Marie", lastName: "Testovací", gender: "female", birthDate: "1893", partnerships: ["u1"], parentIds: [], childIds: [] },
    },
    partnerships: { u1: { id: "u1", person1Id: "p_a", person2Id: "p_b", childIds: [], status: "married" } },
  };
  for (const [lang, line] of [
    ["cs", /^ {2}I0001 rodokmen převzat – osoby: 2 · rodiny: 1 · údaje: 2, vše jako vodítka \(pramen S0001\)$/m],
    ["en", /^ {2}I0001 family tree taken in – people: 2 · families: 1 · facts: 2, all as leads \(source S0001\)$/m],
    ["de", /^ {2}I0001 Stammbaum übernommen – Personen: 2 · Familien: 1 · Angaben: 2, alle als Hinweise \(Quelle S0001\)$/m],
  ] as const) {
    const w = new World();
    noAgent(w);
    w.env.STROM_LANG = lang;
    await w.ok(["setup", "--yes"]);
    await w.ok(["init", "Archiv", "--mode", "archive"]);
    w.cwd = w.treeDir("Archiv");
    const file = path.join(w.dir, "strom-export.json");
    fs.writeFileSync(file, JSON.stringify(app));
    const r = await w.ok(["intake", file]);
    assert.match(r.out, line, `${lang}\n${r.out}`);
    if (lang !== "en") assert.doesNotMatch(r.out, ENGLISH, r.out);
    assert.doesNotMatch(r.out, /review task|task next/, r.out);
    const people = (await w.ok(["person", "list", "--json"])).json.persons.map((p: { name: string }) => p.name);
    assert.deepEqual(people, ["Jan Testovací", "Marie Testovací"], lang);
    w.cleanup();
  }
});

test("N2/N3 an archive and a research waiting for its agent advise no direction they would refuse; research list and person list (its next page too) in the research's language", opts, async () => {
  const SAID = {
    cs: { none: "Žádné směry výzkumu.", people: "Žádné osoby.", nomatch: "Žádná osoba neodpovídá.", leads: /údaje: 1\s+jen vodítka/, more: /^… dalších 1: strom person list --page 2$/m },
    de: { none: "Keine Forschungsrichtungen.", people: "Keine Personen.", nomatch: "Keine Person passt.", leads: /Angaben: 1\s+nur Hinweise/, more: /^… 1 weitere: strom person list --page 2$/m },
  } as const;
  for (const lang of ["cs", "de"] as const) {
    const w = new World();
    noAgent(w);
    w.env.STROM_LANG = lang;
    await w.ok(["setup", "--yes"]);
    const archive = await w.ok(["init", "Archiv", "--mode", "archive"]);
    const waiting = await w.ok(["init", "Čekající"]);
    for (const r of [archive, waiting]) assert.doesNotMatch(r.out, /research new/, `${lang}: ${r.out}`);
    assert.match(waiting.out, /strom\s*$/, `${lang}: the menu next, where the agent is installed`);
    for (const name of ["Archiv", "Čekající"]) {
      const cwd = w.treeDir(name);
      const list = await w.ok(["research", "list"], { cwd });
      assert.equal(list.out.trim(), SAID[lang].none, `${lang} ${name}`);
      assert.equal((await w.ok(["person", "list"], { cwd })).out.trim(), SAID[lang].people);
      await w.ok(["person", "add", "Josef /Novák/", "--born", "1905"], { cwd });
      const people = (await w.ok(["person", "list"], { cwd })).out;
      assert.match(people, SAID[lang].leads, `${lang} ${name}: ${people}`);
      assert.doesNotMatch(people, /leads only|\bev\b/);
      assert.equal((await w.ok(["person", "list", "Dvořák"], { cwd })).out.trim(), SAID[lang].nomatch);
      // a longer list: the line to the next page too
      await w.ok(["person", "add", "Anna /Nováková/", "--born", "1908"], { cwd });
      const paged = (await w.ok(["person", "list", "--limit", "1"], { cwd })).out;
      assert.match(paged, SAID[lang].more, `${lang} ${name}: ${paged}`);
      assert.doesNotMatch(paged, / more: /);
    }
    w.cleanup();
  }
  // a research with its agent here: the direction to start is still advised, its placeholders in the research's language
  const w = new World();
  w.env.STROM_LANG = "cs";
  await w.withTree();
  assert.match((await w.ok(["research", "list"])).out, /^Žádné směry výzkumu\. → strom research new "<[^>]+>" --new-person/);
  w.cleanup();
});
