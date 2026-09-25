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
import { parseBatch } from "../../src/commands/batch.ts";
import { permissionPath } from "../../src/agents/files.ts";

const opts = { skip: !hasGit };
const agent = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Josefa", "--new-person", "Josef /Novák/", "--sex", "M", "--born", "ABT 1885", "--born-place", "Kamenice nad Lipou"]);
  return w;
}

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
  assert.match(r.out, /dry run/);
  assert.equal(fs.existsSync(path.join(w.cwd, "data", "persons", "P0001.json")), false);
  w.cleanup();
});

test("short errors: did you mean, unknown options, --version, a quoted two-word command", async () => {
  const w = new World();
  const typo = await w.run(["person", "ad"]);
  assert.equal(typo.code, 2);
  assert.match(typo.err, /did you mean: strom person add\n/);
  assert.ok(typo.err.length < 200, "no wall of help");
  const opt = await w.run(["person", "add", "X", "--bron", "1900"]);
  assert.match(opt.err, /unknown option --bron for strom person add\n→ did you mean --born\?/);
  assert.match((await w.run(["brief", "--task", "T0003"])).err, /task is an argument of strom brief, not an option\n→ strom brief <task>/);
  assert.match((await w.ok(["--version"])).out, /^strom \d+\.\d+\.\d+/);
  assert.match((await w.ok(["help", "research new"])).out, /^strom research new <name>/);
  const unknown = await w.ok(["help", "research nwe"]);
  assert.match(unknown.out, /did you mean: strom help research new/);
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
  const ops = fs.readdirSync(path.join(w.cwd, "data", "ops"));
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

test("strom run: the brief goes in on stdin, arguments after -- reach the agent", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "echo";
  await w.ok(["run", "--agent", "script", "--", "--add-dir", "/tmp/scans"]);
  const log = fs.readFileSync(path.join(w.cwd, ".strom", "runs", "N0001.log"), "utf8");
  assert.match(log, /args: --add-dir \/tmp\/scans/);
  assert.match(log, /stdin: brief/);
  w.cleanup();
});

test("strom run: a session over its time limit is stopped and its task goes back", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "sleep";
  const t0 = Date.now();
  const r = (await w.ok(["run", "--agent", "script", "--minutes", "0.02", "--json"])).json;
  assert.ok(Date.now() - t0 < 20_000, "stopped long before the agent would have finished");
  assert.equal(r.sessions[0].outcome, "timeout");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "interrupted");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json")).state, "open");
  w.cleanup();
});

/** `strom run` as a real process (signals reach it, not the test runner); resolves when a session is open. */
function startRun(w: World, args: string[]) {
  const child = spawn(process.execPath, [path.join(import.meta.dirname, "..", "..", "src", "cli.ts"), "run", ...args], { cwd: w.cwd, env: w.env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const exited = new Promise<{ code: number | null; signal: string | null; out: string }>((resolve) => child.on("exit", (code, signal) => resolve({ code, signal, out })));
  const opened = new Promise<void>((resolve, reject) => {
    const t0 = Date.now();
    const poll = setInterval(() => {
      if (fs.existsSync(path.join(w.cwd, "data", "sessions", "N0001.json")) && /▶ N0001/.test(out)) resolve(clearInterval(poll));
      else if (Date.now() - t0 > 20_000) reject(new Error(`no session started: ${out}`));
    }, 100);
  });
  return { child, exited, opened };
}

test("strom run: Ctrl-C stops the agent, closes the session and gives the task back", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "sleep";
  const run = startRun(w, ["--agent", "script", "--max", "3"]);
  await run.opened;
  run.child.kill("SIGINT");
  const r = await run.exited;
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /■ zastavuji – sezení se zavře a jeho úkol se vrátí do fronty.*\(SIGINT\)/);
  assert.match(r.out, /sezení: 1 · konec: zastavili jste/);
  const s = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.equal(s.state, "interrupted");
  assert.equal(s.summary, "zastaveno uživatelem", "written into the research: in its language");
  assert.equal(s.endedBy, "user");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json")).state, "open");
  assert.deepEqual(fs.readdirSync(path.join(w.cwd, ".strom", "workers")).filter((f) => f.startsWith("run")), [], "the run is no longer present");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("strom run: a session left open by a run that was killed is closed by the next run", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "sleep";
  const run = startRun(w, ["--agent", "script"]);
  await run.opened;
  process.kill(-run.child.pid!, "SIGKILL"); // the terminal closed, the computer went down: nothing could clean up
  await run.exited;
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "open");
  const o = (await w.ok(["--json"], { tty: true })).json.next;
  assert.equal(o.command, "strom run");
  assert.equal(o.why, "sezení N0001 zůstalo otevřené po běhu, který se zastavil – další běh ho zavře a pokračuje");
  w.env.AGENT_MODE = "work";
  const r = await w.ok(["run", "--agent", "script"]);
  assert.match(r.out, /· N0001 zavřeno – jeho běh se zastavil; T0001 je zpět ve frontě/);
  assert.match(r.out, /▶ N0002 · T0001/);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "interrupted");
  w.cleanup();
});

test("strom run beside another: each run has a name of its own, takes another task and leaves the other's session alone", opts, async () => {
  const w = await world();
  for (const what of ["Křest", "Oddavky"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "sleep";
  const first = startRun(w, ["--agent", "script"]);
  await first.opened;
  const held = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.match(held.worker, /^run-\d+-/);
  w.env.AGENT_MODE = "echo";
  const beside = await w.ok(["run", "--agent", "script", "--json"]);
  assert.match(beside.err, /⚠ V tomto rodokmenu už pracuje jiný běh \(od \d{1,2}:\d{2}\): tento si vezme jiné úkoly – náklady se sčítají\./);
  const second = beside.json;
  assert.notEqual(second.sessions[0].task, held.task, "another task");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "open", "the first run's session is left alone");
  first.child.kill("SIGINT");
  assert.equal((await first.exited).code, 0);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "interrupted");
  w.cleanup();
});

test("strom run: a task handed back twice without anything recorded is parked", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "5"]);
  await w.ok(["task", "add", "Jiný", "--level", "locate", "--where", "Jinde", "--why", "a", "--done-when", "b"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "idle";
  const r = (await w.ok(["run", "--agent", "script", "--max", "3", "--json"])).json;
  assert.deepEqual(r.sessions.map((s: any) => s.task), ["T0001", "T0001", "T0002"]);
  const t = readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json"));
  assert.equal(t.state, "parked");
  w.cleanup();
});

test("agent permissions use this computer's paths; PATH is replaced, not duplicated", opts, async () => {
  const w = await world();
  const s = readJsonFile(path.join(w.cwd, ".claude", "settings.json"));
  assert.ok(s.permissions.deny.includes(`Read(${permissionPath(w.env.STROM_CONFIG_DIR!)}/**)`));
  assert.ok(s.permissions.deny.includes("Read(data/**)"));
  assert.ok(s.permissions.deny.some((a: string) => a.includes("/shared/media/**")), "scans only through views");
  // A consent the agent may ask for — strom asks the person in a window; a password and the seal stay out of its reach.
  assert.ok(!s.permissions.deny.includes("Bash(strom allow:*)"));
  for (const own of ["Bash(strom login:*)", "Bash(strom connector add:*)", "Bash(strom connector remove:*)", "Bash(strom seal:*)"]) assert.ok(s.permissions.deny.includes(own), own);
  assert.ok(s.permissions.deny.some((a: string) => a.includes("/shared/net/**")), "the limiter's memory is strom's");
  assert.ok(s.permissions.allow.some((a: string) => /^Edit\(.*\/shared\/plugins\/connectors\/\*\*\)$/.test(a)), "it may build a connector");
  assert.equal(permissionPath("C:\\Users\\jan\\AppData\\Roaming\\strom"), "//c/Users/jan/AppData/Roaming/strom");
  const env = prependPath({ Path: "C:\\a", HOME: "x" }, "C:\\bin");
  assert.deepEqual(Object.keys(env).filter((k) => k.toUpperCase() === "PATH"), ["Path"]);
  assert.ok(env.Path!.startsWith("C:\\bin"));
  assert.deepEqual(claudeArgs({ kickoff: "k", name: "strom N0001", model: "opus", extraArgs: ["--add-dir", "x"] }), [
    "-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "dontAsk", "--name", "strom N0001", "--model", "opus", "--add-dir", "x",
  ]);
  // interactive: what the permissions do not decide, Claude Code's own review does — nobody clicks through every action
  assert.deepEqual(claudeArgs({ interactive: true, kickoff: "Run strom brief" }), ["Run strom brief", "--permission-mode", "auto"]);
  // browser tools only for connectors that fetch through the browser; the user's full level is Claude Code's bypass
  assert.deepEqual(claudeArgs({ kickoff: "k", chrome: false }).slice(-1), ["--no-chrome"]);
  assert.deepEqual(claudeArgs({ kickoff: "k", chrome: true, permissions: "full" }).slice(4), ["--permission-mode", "bypassPermissions", "--chrome"]);
  assert.deepEqual(claudeArgs({ interactive: true, kickoff: "k", permissions: "full" }), ["k", "--permission-mode", "bypassPermissions"]);
  // ask: Claude Code's own mode — it asks about what the tree's permissions do not decide; headless never asks
  assert.deepEqual(claudeArgs({ interactive: true, kickoff: "k", permissions: "ask" }), ["k"]);
  assert.deepEqual(claudeArgs({ kickoff: "k", permissions: "ask" }).slice(4, 6), ["--permission-mode", "dontAsk"]);
  // The tree's permissions go in explicitly: a project's own settings count only once the folder is trusted.
  assert.deepEqual(claudeArgs({ kickoff: "k", settingsFile: "/t/.claude/settings.json" }).slice(6, 8), ["--settings", "/t/.claude/settings.json"]);
  // headless: nothing is left running in the background (it would die with the turn), no wake-ups, long commands may finish
  const h = headlessEnv({ HOME: "x" }, 45 * 60_000);
  assert.equal(h.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS, "1");
  assert.equal(h.CLAUDE_CODE_DISABLE_CRON, "1");
  assert.equal(h.BASH_MAX_TIMEOUT_MS, String(45 * 60_000));
  assert.equal(headlessEnv({}, undefined).BASH_DEFAULT_TIMEOUT_MS, String(30 * 60_000));
  assert.ok(s.permissions.deny.includes("ScheduleWakeup"));
  w.cleanup();
});

test("lock: a live holder keeps its lock however long it works", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-lock-"));
  const file = path.join(dir, "x.lock");
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, host: os.hostname(), at: "2000-01-01T00:00:00.000Z", owner: "old but alive" }));
  assert.throws(() => acquireLock(file, { owner: "b", waitMs: 0, staleMs: 1000 }), LockedError);
  fs.rmSync(dir, { recursive: true });
});

test("strom run: an agent not allowed to run strom stops the loop at once", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["task", "add", "Jiný", "--level", "locate", "--where", "Jinde", "--why", "a", "--done-when", "b"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "denied";
  const r = await w.run(["run", "--agent", "script", "--max", "5", "--json"]);
  assert.equal(r.code, 1);
  assert.equal(r.json.sessions.length, 1, "no second session after the first was refused");
  assert.equal(r.json.stop, "denied");
  assert.match(r.json.stopped, /agent nesměl spouštět strom/);
  assert.match(r.err, /oprávnění odmítla 1×: Bash: strom input show I0001/);
  w.cleanup();
});

test("live run findings: a citation without a fact cites the name; a search task without a recorded search is flagged", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Vyprávění", "--kind", "family-memory", "--form", "authored"]);
  const named = await w.ok(["person", "add", "Jakub /Víšek/", "--cite", "S1"]);
  assert.match(named.out, /\+P\d{4} Jakub \/Víšek\/ ← S0001/);
  assert.equal((await w.run(["person", "add", "Jan /Víšek/", "--cite", "S1", "--status", "proven"])).code, 2, "a status needs a fact");
  await w.ok(["task", "add", "Kde jsou matriky", "--level", "locate", "--where", "Vavřinec", "--why", "a", "--done-when", "b"]);
  assert.match((await w.ok(["task", "done", "T1", "--result", "MZA, Sloup 782"])).out, /no search is recorded for T0001 — record what you looked at/);
  w.cleanup();
});

test("a task can be about a conflict or a hypothesis: its people come into the brief, settling it names the open tasks", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Oddací zápis", "--kind", "marriage"]);
  await w.ok(["source", "add", "Úmrtní zápis", "--kind", "death"]);
  await w.ok(["conflict", "add", "Rok narození Josefa", "--about", "P1", "--claim", "S1: 25 let při sňatku 1910", "--claim", "S2: 70 let při úmrtí 1955"]); // X1
  await w.ok(["hypothesis", "add", "Kdo byl otec Josefa?", "--about", "P1", "--variant", "A: Jan z čp. 12", "--variant", "B: Václav z čp. 3"]); // H1
  await w.ok(["task", "add", "Rozhodnout rok narození", "--level", "verify", "--where", "křty Kamenice 1883–1887", "--why", "dva údaje", "--done-when", "rozpor vyřešen", "--about", "X1"]); // T1
  await w.ok(["task", "add", "Otec Josefa", "--level", "verify", "--where", "křty Kamenice", "--why", "a", "--done-when", "b", "--about", "H1"]); // T2
  assert.deepEqual((await w.ok(["task", "list", "--about", "X1", "--json"])).json.tasks.map((t: any) => t.id), ["T0001"]);
  assert.match((await w.ok(["conflict", "show", "X1"])).out, /tasks {2}T0001/);
  assert.match((await w.ok(["hypothesis", "show", "H1"])).out, /tasks {2}T0002/);
  const brief = (await w.ok(["brief", "T1"])).out;
  assert.match(brief, /## People concerned\n {2}P0001 Josef Novák/, "the conflict's people");
  assert.match(brief, /## Open conflicts and hypotheses \(→ this task is about it\)\n→ X0001 Rok narození Josefa/);
  assert.match((await w.ok(["conflict", "resolve", "X1", "--resolution", "1885", "--reasoning", "křest"])).out, /still open about X0001: T0001/);
  assert.match((await w.ok(["brief", "T1"])).out, /→ X0001 \[resolved\] Rok narození Josefa: .* — resolved: 1885/, "its own conflict stays in the brief once resolved");
  assert.equal((await w.run(["task", "add", "x", "--level", "verify", "--where", "a", "--why", "b", "--done-when", "c", "--about", "L1"])).code, 2, "a missing record is refused");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("find: several arguments are several searches, each answered", opts, async () => {
  const w = await world();
  await w.ok(["intake", "--text", "Děda byl mlynář v čp. 12"]);
  await w.ok(["note", "add", "P1", "Ve starém výzkumu značen jako OLD-7"]);
  const r = await w.ok(["find", "mlynar", "OLD-7", "OLD-8"]);
  assert.match(r.out, /^mlynar\n {2}I0001/m);
  assert.match(r.out, /^OLD-7\n {2}P0001/m);
  assert.match(r.out, /nothing found for: OLD-8/);
  const j = (await w.ok(["find", "mlynar", "OLD-7", "OLD-8", "--json"])).json;
  assert.deepEqual(j.missing, ["OLD-8"]);
  assert.deepEqual(j.hits.map((h: any) => [h.query, h.id]).filter((x: any) => x[0] === "OLD-7"), [["OLD-7", "P0001"]]);
  assert.ok((await w.ok(["find", "mlynar čp", "--json"])).json.hits.some((h: any) => h.id === "I0001"), "one argument: all its words");
  assert.equal((await w.ok(["find", "mlynar OLD-7"])).out.trim(), "nothing found", "all its words, in one record");
  w.cleanup();
});

test("frontier: a baptism another task already records or checks in its book is not proposed again", opts, async () => {
  const w = await world();
  await w.ok(["recordset", "add", "Kamenice N 1880-1890", "--kinds", "baptism", "--places", "Kamenice nad Lipou", "--years", "1880-1890"]); // B1
  const before = (await w.ok(["frontier", "--json"])).json.frontier.find((i: any) => i.person === "P0001");
  assert.equal(before.proposal.level, "link");
  await w.ok(["task", "add", "Zapsat křest Josefa z B1", "--level", "enrich", "--where", "B1", "--why", "zápis je známý", "--done-when", "zapsán", "--about", "P1"]); // T1
  const after = (await w.ok(["frontier", "--json"])).json.frontier.find((i: any) => i.person === "P0001");
  assert.equal(after.coveredBy, "T0001");
  assert.deepEqual((await w.ok(["frontier", "--apply", "--json"])).json.created, []);
  w.cleanup();
});

test("strom run --task: the tasks picked, one session each, in that order — one done meanwhile is left out", opts, async () => {
  const w = await world();
  for (const what of ["Křest", "Oddavky", "Úmrtí"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["task", "done", "T0002", "--result", "nalezeno jinde"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "echo";
  const r = await w.ok(["run", "--agent", "script", "--task", "T0003,T0002", "--task", "T0001", "--json"]);
  assert.deepEqual(r.json.sessions.map((s: { task: string }) => s.task), ["T0003", "T0001"]);
  assert.match(r.err, /T0002 vynechán: už je hotový nebo zrušený/);
  w.cleanup();
});

test("the menu, working alone: the next tasks listed, the time limit said; the queue in order or the tasks picked by number", opts, async () => {
  const w = await world();
  for (const [what, p] of [["Křest Josefa", "5"], ["Oddavky rodičů", "3"], ["Úmrtí Josefa", "1"]]) await w.ok(["task", "add", what!, "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1", "--priority", p!]);
  Object.assign(w.env, { STROM_AGENT: "script", STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "echo" });
  // 2 working alone · 2 only the ones picked · a wrong answer, then 3 and 1 · Enter · 0 quit
  const r = await w.ok([], { tty: true, answers: ["2", "2", "4", "3, 1", "", "0"] });
  assert.match(r.out, /Na řadě jsou tyto úkoly, v pořadí, v jakém je agent vezme:\n {3}1\. Křest Josefa\n {3}2\. Oddavky rodičů\n {3}3\. Úmrtí Josefa\n/);
  assert.match(r.out, /Na jeden úkol má agent nejvýš 60 minut/);
  assert.match(r.out, /Čísla ze seznamu, 1 až 3/);
  const task = (n: string) => readJsonFile(path.join(w.cwd, "data", "sessions", `${n}.json`)).task;
  assert.deepEqual([task("N0001"), task("N0002")], ["T0003", "T0001"]);
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0003.json")), "only those two");
  // 0 goes back from both questions: nothing runs.
  await w.ok([], { tty: true, answers: ["2", "0", "2", "1", "0", "0"] });
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0003.json")));
  // Another run at work already: said first, and nothing starts without a yes.
  const other = enterWorker(w.cwd, "run-elsewhere", "Claude Code on its own");
  const warned = await w.ok([], { tty: true, answers: ["2", "", "0"] });
  other();
  assert.match(warned.out, /⚠ Agent už tu pracuje sám \(běhy: 1\)\. Další vedle něj si vezme jiné úkoly – náklady se sčítají\.\nSpustit další vedle něj\? \(a\/n\) \[n\]/);
  assert.doesNotMatch(warned.out, /Na řadě jsou tyto úkoly/, "no further questions");
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0003.json")));
  w.cleanup();
});
