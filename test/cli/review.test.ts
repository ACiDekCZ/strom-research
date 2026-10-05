// What the first review round fixed: the frontier never repeats what was
// tried, free text keeps its commas, batches, settings with tree scope,
// short errors, a stuck task is parked, the agent gets its brief on stdin.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { enterWorker } from "../../src/core/workers.ts";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { acquireLock } from "../../src/core/lock.ts";
import { LockedError } from "../../src/core/errors.ts";
import { prependPath } from "../../src/runners/runner.ts";
import { claudeArgs, headlessEnv } from "../../src/runners/claude.ts";
import { codexResumeArgs } from "../../src/runners/codex.ts";
import { clockLine, deadlineOf } from "../../src/core/clock.ts";
import { parseBatch } from "../../src/commands/batch.ts";
import { permissionPath } from "../../src/agents/files.ts";
import { opts, agent, world, startRun } from "./review.helpers.ts";

test("frontier: what was tried is never proposed again — locate, then request, then the user decides", opts, async () => {
  const w = await world();
  const first = (await w.ok(["frontier", "--apply", "--json"])).json.created;
  assert.equal(first.length, 1);
  await w.ok(["task", "done", first[0], "--result", "no register found for Kamenice"]);
  const second = (await w.ok(["frontier", "--json"])).json.frontier[0];
  assert.equal(second.proposal.level, "request", "not the same locate task again");
  const req = (await w.ok(["frontier", "--apply", "--json"])).json.created;
  await w.ok(["task", "drop", req[0], "--reason", "the archive does not answer"]);
  const third = (await w.ok(["frontier", "--json"])).json.frontier[0];
  assert.equal(third.proposal, undefined);
  assert.deepEqual(third.exhausted, [first[0], req[0]]);
  assert.match((await w.ok(["frontier"])).out, /exhausted .* ask the user/);
  assert.equal((await w.ok(["frontier", "--apply", "--json"])).json.created.length, 0);
  w.cleanup();
});

test("frontier: a finished link task uses up its record set; a new one is proposed", opts, async () => {
  const w = await world();
  await w.ok(["recordset", "add", "Kamenice N 1880-1890", "--kinds", "baptism", "--places", "Kamenice nad Lipou", "--years", "1880-1890"]);
  const t1 = (await w.ok(["frontier", "--apply", "--json"])).json.created[0];
  await w.ok(["task", "done", t1, "--result", "not in B0001, searched completely"]);
  const after = (await w.ok(["frontier", "--json"])).json.frontier[0];
  assert.equal(after.proposal.level, "locate"); // its record sets are used up: find others
  await w.ok(["recordset", "add", "Kamenice N 1885-1900 (copy)", "--kinds", "baptism", "--places", "Kamenice nad Lipou", "--years", "1885-1900"]);
  const next = (await w.ok(["frontier", "--json"])).json.frontier[0];
  assert.equal(next.proposal.level, "link");
  assert.deepEqual(next.proposal.where, ["B0002"]);
  w.cleanup();
});

test("frontier: a baptism already read that names only the mother is not searched again", opts, async () => {
  const w = await world();
  await w.ok(["recordset", "add", "Kamenice N 1880-1890", "--kinds", "baptism", "--places", "Kamenice nad Lipou", "--years", "1880-1890"]);
  await w.ok(["source", "add", "Křest Josefa 1885", "--kind", "baptism", "--recordset", "B1", "--form", "original", "--information", "primary"]);
  await w.ok(["event", "add", "P1", "BIRT", "--date", "3 MAY 1885", "--place", "Kamenice nad Lipou", "--cite", "S1", "--status", "proven"]);
  await w.ok(["person", "add", "Josefa /Nováková/", "--sex", "F", "--cite", "S1"]); // P2, the unmarried mother; no father column
  await w.ok(["family", "add", "--partner", "P2", "--child", "P1", "--cite", "S1"]);
  const items = (await w.ok(["frontier", "--json"])).json.frontier;
  assert.ok(!items.some((i: any) => i.person === "P0001"), "no second search for the same baptism, no locate for another book");
  assert.ok(items.some((i: any) => i.person === "P0002"), "the mother's own parents are the next step");
  w.cleanup();
});

test("frontier: a parent with no birth of their own is looked for around the eldest child's birth", opts, async () => {
  const w = await world();
  await w.ok(["event", "add", "P1", "BIRT", "--date", "3 MAY 1885", "--place", "Kamenice nad Lipou"]);
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]); // P2: known only as the father
  await w.ok(["family", "add", "--partner", "P2", "--child", "P1"]);
  const item = (await w.ok(["frontier", "--json", "--lang", "en"])).json.frontier.find((i: any) => i.person === "P0002");
  assert.equal(item.proposal.level, "locate", "not a dead end: \"needs a birth year or place first\"");
  assert.match(item.proposal.what, /Where are the baptisms of Kamenice nad Lipou around 1857\? \(for Jan Novák \(born ~1857, estimated from the eldest child known, 1885\)\)/);
  assert.match(item.proposal.where[0], /years 1845–1869/, "an estimate widens the years");
  // a marriage says more than a child
  await w.ok(["person", "add", "Marie /Nová/", "--sex", "F"]);
  await w.ok(["family", "edit", "F1", "--partner", "P3"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "1880", "--place", "Týnec"]);
  const again = (await w.ok(["frontier", "--json", "--lang", "en"])).json.frontier.find((i: any) => i.person === "P0002");
  assert.match(again.proposal.what, /Týnec around 1855\? .*estimated from their marriage 1880/);
  // the tree's research language is Czech: so are the tasks strom proposes in it
  const cs = (await w.ok(["frontier", "--json"])).json.frontier.find((i: any) => i.person === "P0002");
  assert.equal(cs.proposal.what, "Kde jsou zapsány křty: Týnec, kolem roku 1855? (hledá se Jan Novák (nar. asi 1855, odhad podle sňatku 1880))");
  assert.match(cs.proposal.why, /^rodiče neznámí; /);
  w.cleanup();
});

test("free text keeps its commas; lists of IDs may use them", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Oddací zápis", "--kind", "marriage"]);
  await w.ok(["source", "add", "Úmrtní zápis", "--kind", "death"]);
  const x = (await w.ok(["conflict", "add", "Rok narození", "--about", "P1", "--claim", "S1: aged 25, at the marriage 1910", "--claim", "S2: 70, at death 1955", "--json"])).json.conflict;
  assert.deepEqual(x.claims.map((c: any) => c.value), ["aged 25, at the marriage 1910", "70, at death 1955"]);
  const t = (await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice nad Lipou, fara, 1880-1890", "--why", "a", "--done-when", "b", "--json"])).json.task;
  assert.deepEqual(t.where, ["Kamenice nad Lipou, fara, 1880-1890"]);
  const s = (await w.ok(["search", "add", "x", "--recordset", "B1,B1", "--method", "index", "--result", "found", "--found", "S1,S2", "--json"]).catch(() => null));
  assert.equal(s, null); // B1 does not exist here: the comma list was split and checked
  w.cleanup();
});

test("dry run of a command in several steps sees its own first step", opts, async () => {
  const w = new World();
  await w.withTree();
  const r = await w.ok(["research", "new", "X", "--new-person", "Anna /Nová/", "--dry-run"]);
  assert.match(r.out, /\+P0001 Anna \/Nová\//);
  assert.match(r.out, /\+G0001 research "X"/);
  assert.match(r.out, /^Nanečisto \(--dry-run\): nic se nezapsalo/m);
  assert.equal(fs.existsSync(path.join(w.cwd, "data", "persons", "P0001.json")), false);
  w.cleanup();
});

test("short errors: a similar command, unknown options, --version, a quoted two-word command", async () => {
  const w = new World();
  const en = { env: { STROM_LANG: "en" } };
  const typo = await w.run(["person", "ad"], en);
  assert.equal(typo.code, 2);
  assert.match(typo.err, /similar command: strom person add\n/);
  assert.ok(typo.err.length < 200, "no wall of help");
  const opt = await w.run(["person", "add", "X", "--bron", "1900"], en);
  assert.match(opt.err, /unknown option --bron for strom person add\n→ similar option: --born\n/);
  // a person reads them in their language, never addressed
  const cs = await w.run(["person", "ad"], { env: { STROM_LANG: "cs" } });
  assert.match(cs.err, /neznámý příkaz „strom person ad“\n→ podobný příkaz: strom person add\n/);
  assert.match((await w.run(["brief", "--task", "T0003"])).err, /--task se u strom brief píše jako argument, ne jako volba\n→ strom brief <úkol>/);
  assert.match((await w.ok(["--version"])).out, /^strom \d+\.\d+\.\d+/);
  assert.match((await w.ok(["help", "research new"], { tty: true })).out, /^strom research new <name>/);
  const unknown = await w.ok(["help", "research nwe"], { tty: true });
  assert.match(unknown.out, /strom help research new/);
  assert.ok(unknown.out.length < 200);
  const json = await w.run(["frobnicate", "--json"]);
  assert.equal(json.out.split("\n").length, 2, "JSON is one compact line");
  w.cleanup();
});

test("a missing @file is a plain error, not a stack trace", opts, async () => {
  const w = await world();
  const r = await w.run(["source", "add", "X", "--transcript", "@chybi.txt"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /no such file or folder: .*chybi\.txt/);
  assert.doesNotMatch(r.err, /--debug/);
  w.cleanup();
});

test("writes report the IDs of the facts they create; family show; citing at creation", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Oddací zápis 1910", "--kind", "marriage", "--form", "original", "--information", "primary"]);
  const anna = await w.ok(["person", "add", "Anna /Svobodová/", "--sex", "F", "--born", "CAL 1888", "--cite", "S1", "--quote", "22 let"]);
  assert.match(anna.out, /\+P0002 Anna \/Svobodová\/ · E0002 BIRT CAL 1888 \[probable\]/);
  const fam = await w.ok(["family", "add", "--partner", "P1", "--partner", "P2", "--married", "12 FEB 1910", "--married-place", "Kamenice nad Lipou", "--cite", "S1"]);
  assert.match(fam.out, /\+F0001 .* · E0003 MARR 12 FEB 1910 Kamenice nad Lipou \[probable\]/);
  const card = (await w.ok(["person", "show", "P1"])).out;
  assert.match(card, /partner\s+F0001: P0002 Anna Svobodová/);
  assert.match(card, /E0003\s+MARR\s+12 FEB 1910/, "the marriage and its ID on the person card");
  const show = (await w.ok(["family", "show", "F1"])).out;
  assert.match(show, /^F0001 P0001 Josef Novák .* & P0002 Anna Svobodová/);
  assert.match(show, /E0003\s+MARR/);
  // The same couple again, the same birth again: warned, with what to do instead.
  assert.match((await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"])).out, /F0001 already joins these partners/);
  assert.match((await w.ok(["event", "add", "P1", "BIRT", "--date", "1885"])).out, /already has BIRT E0001 .* strom cite E0001/);
  w.cleanup();
});

test("finishing an intake task finishes its input", opts, async () => {
  const w = await world();
  await w.ok(["intake", "--text", "Pradědeček Josef, narozen asi 1885"]);
  const task = (await w.ok(["task", "list", "--level", "intake", "--json"])).json.tasks[0];
  await w.ok(["task", "done", task.id, "--result", "zapsáno jako vodítka"]);
  assert.equal((await w.ok(["input", "list", "--json"])).json.inputs[0].state, "processed");
  w.cleanup();
});

test("batch: one call, one commit, labels, all or nothing", opts, async () => {
  const w = await world();
  const before = spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).stdout.trim();
  const r = await w.ok([
    "batch",
    'source add "Oddací zápis 1910" --kind marriage --form original --information primary #zapis',
    'person add "Anna /Svobodová/" --sex F #anna',
    "family add --partner P0001 --partner @anna --married 1910 --cite @zapis #svatba",
    'event add P0001 OCCU --value "rolník, syn rolníka" --cite @zapis --with "witness:Jan Dvořák"',
  ]);
  assert.match(r.out, /4 command\(s\) as one change/);
  assert.match(r.out, /\+F0001 .* E0002 MARR 1910 \[probable\]/);
  const after = spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).stdout.trim();
  assert.equal(Number(after), Number(before) + 1, "one commit for the whole batch");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "persons", "P0001.json")).events.find((e: any) => e.kind === "OCCU").value, "rolník, syn rolníka");

  // A failing line undoes the lines before it.
  const bad = await w.run(["batch", 'person add "Karel /Novák/"', "event add P0099 BIRT --date 1900"]);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /line 2 \(event add\): no person P0099/);
  assert.equal(fs.existsSync(path.join(w.cwd, "data", "persons", "P0003.json")), false);
  assert.equal(spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout, "");

  // Lines from stdin, comments, continuation lines; an undefined label is an error.
  const piped = await w.ok(["batch"], { stdin: '# the children\nperson add "Karel /Novák/" \\\n  --sex M #karel\nfamily child F0001 @karel\n' });
  assert.match(piped.out, /F0001 \+child P0003/);
  assert.match((await w.run(["batch", "family child F0001 @nobody"])).err, /@nobody is not defined/);
  // labels are words in any script: an agent writing Czech names them in Czech
  const czech = await w.ok(["batch", 'person add "Šimon /Ševčík/" --sex M #šimon', "family child F0001 @šimon"]);
  assert.match(czech.out, /F0001 \+child P0004/);
  assert.match((await w.run(["batch", 'person add "X /Y/" #1x'])).err, /invalid label "#1x"/);
  assert.match((await w.run(["batch", "person list"])).err, /cannot run in a batch/);
  w.cleanup();
});

test("batch lines: a backslash continues the line, spaces after it or not", () => {
  const lines = parseBatch('person add "Jan /Novák/" \\  \n  --sex M \\\n  --note "x" #jan\nfamily add --partner @jan \\');
  assert.deepEqual(lines[0], { n: 1, argv: ["person", "add", "Jan /Novák/", "--sex", "M", "--note", "x"], label: "jan" });
  assert.deepEqual(lines[1]!.argv, ["family", "add", "--partner", "@jan"]);
});

test("batch lines: quotes, escapes, labels, comments", () => {
  const lines = parseBatch(`strom person add "Jan \\"Honza\\" /Novák/" --note 'it''s' #jan\n\n# comment\nfamily add --partner @jan`);
  assert.deepEqual(lines[0], { n: 1, argv: ["person", "add", 'Jan "Honza" /Novák/', "--note", "its"], label: "jan" });
  assert.deepEqual(lines[1], { n: 4, argv: ["family", "add", "--partner", "@jan"] });
  assert.deepEqual(parseBatch('note add P1 "#not-a-label"')[0]!.argv, ["note", "add", "P1", "#not-a-label"]);
});

test("settings: one set/get/unset with tree scope; config where shows every source", opts, async () => {
  const w = await world();
  await w.ok(["config", "set", "model.vision", "opus-x"]);
  assert.deepEqual([(await w.ok(["config", "get", "model.vision", "--json"])).json.value, (await w.ok(["config", "get", "model.vision", "--json"])).json.source], ["opus-x", "config"]);
  await w.ok(["config", "set", "model.vision", "opus-tree", "--for-tree"]);
  assert.equal((await w.ok(["config", "get", "model.vision"])).out.trim(), "opus-tree");
  assert.match(fs.readFileSync(path.join(w.cwd, "CLAUDE.md"), "utf8"), /`opus-tree`/, "agent files follow the setting");
  assert.equal(spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout, "", "committed with the agent files");
  assert.match((await w.ok(["verify"])).out, /^ok/, "a logged config change is not tampering");
  w.env.STROM_MODEL_VISION = "from-env";
  assert.equal((await w.ok(["config", "get", "model.vision"])).out.trim(), "from-env");
  delete w.env.STROM_MODEL_VISION;
  await w.ok(["config", "unset", "model.vision", "--for-tree"]);
  assert.equal((await w.ok(["config", "get", "model.vision"])).out.trim(), "opus-x");
  await w.ok(["config", "set", "run.minutes", "45"]);
  const where = (await w.ok(["config", "where"])).out;
  assert.match(where, /run\.minutes\s+45\s+config\s+STROM_RUN_MINUTES/);
  assert.match(where, /brief\.budget\s+25000\s+default/);
  assert.match(where, /STROM_TREE/);
  assert.equal((await w.run(["config", "set", "home", "/x", "--for-tree"])).code, 2, "home is not a tree setting");
  assert.equal((await w.run(["config", "set", "run.minutes", "-3"])).code, 2);
  w.cleanup();
});

test("--lang from outside applies to this call; the tree keeps its own", opts, async () => {
  const w = await world();
  assert.match((await w.ok(["guide", "--lang", "de"])).out, /research language of this tree is German/);
  assert.match((await w.ok(["guide"])).out, /research language of this tree is Czech/);
  await w.ok(["lang", "de"]);
  assert.match(fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8"), /research language is German/, "agent files follow");
  assert.equal(spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout, "");
  w.cleanup();
});

test("trees use: the chosen tree is found from anywhere", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  await w.ok(["init", "Dvořákovi"]);
  assert.equal((await w.run(["status"])).code, 2);
  await w.ok(["trees", "use", "dvorakovi"]);
  assert.equal((await w.ok(["status", "--json"])).json.tree.name, "Dvořákovi");
  w.cleanup();
});

test("an agent writing outside a session is logged as agent, not as the user", opts, async () => {
  const w = await world();
  w.env.CLAUDECODE = "1";
  await w.ok(["note", "add", "P1", "Poznámka agenta"]);
  const ops = (fs.readdirSync(path.join(w.cwd, "data", "ops"), { recursive: true }) as string[]).map((f) => path.basename(f));
  assert.ok(ops.some((f) => f.startsWith("agent-")), ops.join(" "));
  assert.equal(readJsonFile(path.join(w.cwd, "data", "persons", "P0001.json")).notes.at(-1).by, "agent");
  w.cleanup();
});

test("orientation: a person at a terminal is sent to strom run, an agent to session start", opts, async () => {
  const w = await world();
  assert.match((await w.ok([])).out, /dál\s+strom intake --text/, "first what the user knows");
  await w.ok(["intake", "--text", "Josef byl rolník"]);
  assert.match((await w.ok([])).out, /dál\s+strom session start/);
  // (a person at a terminal gets the menu from a bare `strom`; the orientation stays one flag away)
  assert.equal((await w.ok(["--json"], { tty: true })).json.next.command, "strom run");
  w.cleanup();
});

test("brief: the research question, the user's words and the input's text", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]);
  await w.ok(["research", "new", "Otec Marie", "--person", "P1", "--direction", "question", "--question", "Who was the father of Marie?", "--note", "Babička říkala, že byl mlynář"]);
  await w.ok(["intake", "--text", "Marie se narodila asi 1890 v Týnci"]);
  const b = (await w.ok(["session", "start"])).out;
  assert.match(b, /Research question: Who was the father of Marie\?/);
  assert.match(b, /From the user: Babička říkala, že byl mlynář/);
  assert.match(b, /## The material\nI0001 .*\ntext:\nMarie se narodila asi 1890 v Týnci/);
  w.cleanup();
});
