// An archive says nothing of an agent or AI (Milan's decision, 2026-10-03): its menu and settings, the orientation, init,
// sync, stats, plan, check, doctor, help and guide, the files of its folder and what the bridge tells the app. Research
// switched on, the agents' files come; an archive again, strom's own of them go (a person's notes stay).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

const AI = /agent|\bAI\b|umělá inteligence|Claude|Codex|OpenCode|Grok|Antigravity|\bmodel/i;

const ged = [
  "0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
  "0 @I1@ INDI", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1870", "2 PLAC Týnec", "2 SOUR @S1@", "3 PAGE fol. 3", "1 FAMS @F1@",
  "0 @I2@ INDI", "1 NAME Marie /Dvořáková/", "1 SEX F", "1 FAMS @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 MARR", "2 DATE 1899",
  "0 @S1@ SOUR", "1 TITL Křestní matrika Týnec", "1 TEXT Karel syn Josefa", "1 QUAY 3",
  "0 TRLR", "",
].join("\n");

test("an archive says nothing of an agent or AI anywhere a person or the app looks", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const said: [string, string][] = [];
  const look = async (label: string, args: string[], o: { tty?: boolean; answers?: string[] } = {}) => {
    const r = await w.run(args, o);
    said.push([label, r.out + r.err]);
    return r;
  };
  await look("init", ["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  const file = path.join(w.dir, "a.ged");
  fs.writeFileSync(file, ged);
  // the first tree into an empty archive is taken (found in the audit: refused as "0 of 3 people")
  const plan = await look("sync plan", ["sync", file]);
  assert.equal(plan.code, 0, plan.err);
  // an archive mirrors the app: never "a conflict for you to decide"
  assert.match(plan.out, /^Archiv: úpravy z aplikace platí, co v aplikaci už není, se odvolá s důvodem$/m);
  assert.doesNotMatch(plan.out, /dokud .*výzkum/);
  assert.equal((await look("sync apply", ["sync", file, "--apply"])).code, 0);
  // nothing put aside for an agent: no task to read what the user transcribed
  assert.equal((await w.ok(["task", "list", "--state", "all", "--json"])).json.total ?? 0, 0);
  const menu = (answers: string[]) => ({ tty: true, answers });
  await look("menu", ["menu"], menu(["0"]));
  for (const key of ["2", "3", "4", "5", "6", "7", "8"]) await look(`menu ${key}`, ["menu"], menu([key, "0", "0", "0"]));
  for (const key of ["1", "2", "3", "4"]) await look(`menu 5.${key}`, ["menu"], menu(["5", key, "", "0", "0", "0"]));
  await look("menu 1 (switch asked, no)", ["menu"], menu(["1", "n", "0"]));
  await look("settings: the setup", ["menu"], menu(["8", "1", "", "", "n", "0", "n", "0", "0", "0"]));
  for (const args of [[], ["stats"], ["plan"], ["check"], ["doctor"], ["recent"], ["person", "card", "P0001"], ["pedigree", "P0001"], ["live"], ["help"], ["help", "--human"], ["help", "--agent"], ["help", "sync"], ["help", "sync", "--human"], ["help", "doctor", "--human"], ["doctor", "--help"], ["guide"], ["mode"], ["sync", "--inbox"], ["intake", "--text", "Děda Karel byl mlynář"], ["sync", "undo", "I0001", "--dry-run"], ["history"], ["status"]])
    await look(`strom ${args.join(" ")}`, args, args[0] === "help" || args.includes("--help") ? { tty: true } : {}); // the person's help: at a terminal
  for (const [label, text] of said) {
    const bad = text.split("\n").filter((l) => AI.test(l));
    assert.deepEqual(bad, [], `${label}:\n${text}`);
  }
  // help: only what an archive uses (found on Windows: session, brief, gate, read offered) — for a person in the
  // research's language (Milan, 2026-10-04), the catalog (--agent) English
  const help = said.find(([label]) => label === "strom help --human")![1];
  const catalog = said.find(([label]) => label === "strom help --agent")![1];
  for (const cmd of ["session", "brief", "gate", "read", "task", "connector", "review", "research", "hypothesis", "search", "fetch", "story", "chat", "run"]) {
    assert.doesNotMatch(help, new RegExp(`^  strom ${cmd}\\b`, "m"), cmd);
    assert.doesNotMatch(catalog, new RegExp(`(?:^ {2}|^ {4}|: | · )${cmd}\\b`, "m"), cmd);
  }
  assert.match(help, /^ {2}strom sync undo +Vrátit, co poslání přineslo do výzkumu$/m, help);
  assert.match(catalog, /\bsync undo\b/);
  assert.match(said.find(([label]) => label === "strom help sync --human")![1], /^Načíst úpravy z aplikace Strom/m);
  // the orientation speaks of the archive, not to an agent (found on Windows: "mluv s uživatelem", "nabídni uživateli")
  const orientation = said.find(([label]) => label === "strom ")![1];
  assert.doesNotMatch(orientation, /mluv s uživatelem|nabídni|řekněte to uživateli|nenainstalovan/, orientation);
  // the history in the research's language, never the commits' English subjects (found 2026-10-04)
  const hist = said.find(([label]) => label === "strom history")![1];
  assert.doesNotMatch(hist, /\d+ changes|Create tree|Agent instructions|strom sync/, hist);
  assert.match(hist, /Rodokmen a\.ged|Materiál|Nová osoba|Nový pramen/, hist);
  // status in the research's language too (found on Windows)
  const status = said.find(([label]) => label === "strom status")![1];
  assert.match(status, /^Osoby: 2 · rodiny: 1$/m, status);
  assert.doesNotMatch(status, /persons|recent|check {2}|směry/, status);
  // sync with no file: in the research's language
  const which = await w.run(["sync"]);
  assert.match(which.err, /^chyba: který rodokmen\? soubor, nebo --app/m, which.err);
  // what came in lately: no tasks done to count where nobody does tasks
  const lately = said.find(([label]) => label === "strom recent")![1];
  assert.match(lately, /Nové osoby: 2/, lately);
  assert.doesNotMatch(lately, /úkol/, lately);
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).mode, "archive", "Enter never switched research on");
  // its folder: no files of the agents
  for (const f of ["AGENTS.md", "CLAUDE.md", ".claude", ".grok", "opencode.json"]) assert.ok(!fs.existsSync(path.join(w.cwd, f)), f);
  // what the bridge tells the app: no queue of tasks put aside, nothing spent, no agent
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as Record<string, unknown>;
    assert.deepEqual([status.queue, status.queueMore, status.spend, status.agent], [[], 0, undefined, undefined]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("research switched on, the agents' files come; an archive again, strom's own go and a person's notes stay", opts, async () => {
  const w = new World();
  await w.withTree("Novákovi");
  for (const f of ["AGENTS.md", "CLAUDE.md", "opencode.json"]) assert.ok(fs.existsSync(path.join(w.cwd, f)), f);
  // the person's own notes in CLAUDE.md, below the mark
  fs.appendFileSync(path.join(w.cwd, "CLAUDE.md"), "\nMoje poznámka: hledat v Týnci.\n");
  // a person's own file in notes/: never swept into the switch's commit (found on Windows)
  fs.writeFileSync(path.join(w.cwd, "notes", "moje.txt"), "Babička říkala…\n");
  const switched = await w.ok(["mode", "archive"], { tty: true });
  assert.match(switched.out, /^Výzkum je teď archiv\./m, switched.out);
  assert.doesNotMatch(switched.out, /put aside|the research is/, switched.out);
  for (const f of ["AGENTS.md", "opencode.json", ".claude", ".grok"]) assert.ok(!fs.existsSync(path.join(w.cwd, f)), f);
  assert.match(fs.readFileSync(path.join(w.cwd, "CLAUDE.md"), "utf8"), /Moje poznámka/, "a person's notes stay");
  await w.ok(["mode", "research"], { tty: true });
  // the switches in the history: in the research's language (found on Windows: "the research is an archive")
  const hist = (await w.ok(["history"])).out;
  assert.match(hist, /Výzkum je teď archiv/, hist);
  assert.match(hist, /Výzkum je znovu zapnutý/, hist);
  assert.doesNotMatch(hist, /the research|with an agent/, hist);
  for (const f of ["AGENTS.md", "opencode.json", path.join(".claude", "settings.json")]) assert.ok(fs.existsSync(path.join(w.cwd, f)), f);
  assert.equal(execFileSync("git", ["ls-files", "notes/moje.txt"], { cwd: w.cwd, encoding: "utf8" }), "", "the person's file left alone");
  assert.match(fs.readFileSync(path.join(w.cwd, "CLAUDE.md"), "utf8"), /Moje poznámka/);
  w.cleanup();
});
