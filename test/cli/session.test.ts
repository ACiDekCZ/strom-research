// Sessions, the brief, the frontier, agent files and `strom run` with a
// scripted agent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { opts, agent, world } from "./session.helpers.ts";

test("init writes agent instructions and permissions", opts, async () => {
  const w = await world();
  const agents = fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8");
  assert.match(agents, /Never create, edit or delete anything in `data\/`/);
  assert.match(agents, /research language is Czech/);
  assert.equal(fs.readFileSync(path.join(w.cwd, "CLAUDE.md"), "utf8").split("\n")[0], "@AGENTS.md");
  const settings = readJsonFile(path.join(w.cwd, ".claude", "settings.json"));
  assert.ok(settings.permissions.allow.includes("Bash(strom:*)"));
  assert.ok(settings.permissions.allow.includes("PowerShell(strom:*)"), "Claude Code on Windows runs PowerShell");
  assert.ok(settings.permissions.deny.includes("PowerShell(git:*)"));
  assert.ok(settings.permissions.deny.includes("Edit(data/**)"));
  // Own notes below the marker survive a re-sync.
  fs.appendFileSync(path.join(w.cwd, "AGENTS.md"), "My own rule.\n");
  await w.ok(["agents", "sync"]);
  assert.match(fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8"), /My own rule\./);
  w.cleanup();
});

test("frontier proposes the next tasks from the tree itself", opts, async () => {
  const w = await world();
  const f = (await w.ok(["frontier", "--json"])).json.frontier;
  assert.equal(f[0].person, "P0001");
  assert.equal(f[0].proposal.level, "link");
  assert.deepEqual(f[0].proposal.where, ["B0001"]); // record set of the birthplace and year
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M", "--born", "ABT 1870", "--born-place", "Bělušice"]);
  await w.ok(["family", "add", "--partner", "P2", "--child", "P1"]);
  const f2 = (await w.ok(["frontier", "--json"])).json.frontier;
  const josef = f2.find((x: any) => x.person === "P0002");
  assert.equal(josef.proposal.level, "locate"); // nothing known for Bělušice yet
  const created = (await w.ok(["frontier", "--apply", "--json"])).json.created;
  assert.equal(created.length, 2);
  assert.equal((await w.ok(["frontier", "--apply", "--json"])).json.created.length, 0); // covered now
  w.cleanup();
});

test("stories of the ancestors: on by default, proposed once records tell a life, added to after more; the user may say no", opts, async () => {
  const w = await world();
  // The user is to be told (on by default).
  assert.equal((await w.ok(["--json"])).json.stories, "tell");
  assert.match((await w.ok([])).out, /vyprávění\s+zapnuté \(výchozí\)/);
  await w.ok(["source", "add", "Křest Jana Nováka 1905", "--kind", "baptism", "--recordset", "B0001", "--locator", "fol. 45, č. 12", "--information", "primary"]);
  const cite = ["--cite", "S0001", "--locator", "fol. 45, č. 12"];
  await w.ok(["event", "add", "P1", "CHR", "--date", "25 JUN 1905", "--place", "Týnec nad Labem", ...cite]);
  await w.ok(["event", "add", "P1", "OCCU", "--value", "mlynář", ...cite]);
  assert.deepEqual((await w.ok(["frontier", "--json"])).json.stories, [], "two facts from records: not yet a life");
  await w.ok(["event", "add", "P1", "RESI", "--place", "Týnec nad Labem", "--house", "12", ...cite]);
  // First, once, the search beyond the registers; the story when it is finished.
  const before = (await w.ok(["frontier", "--json"])).json.stories;
  assert.equal(before.length, 1);
  assert.equal(before[0].level, "enrich");
  assert.equal(before[0].origin, "story:sources");
  assert.match(before[0].what, /^Mimo matriky, pro vyprávění: Jan Novák .*noviny, adresáře/);
  const search = (await w.ok(["frontier", "--apply", "--json"])).json.created.at(-1);
  assert.equal((await w.ok(["frontier", "--json"])).json.stories.length, 0, "the story waits for the search");
  assert.match((await w.ok(["brief", search])).out, /## Beyond the registers[\s\S]*Your person, not a namesake/);
  await w.ok(["task", "done", search, "--result", "nic dalšího se nenašlo"]);
  const due = (await w.ok(["frontier", "--json"])).json.stories;
  assert.equal(due.length, 1);
  assert.equal(due[0].level, "narrate");
  assert.match(due[0].what, /^Napsat vyprávění: Jan Novák/);
  const made = (await w.ok(["frontier", "--apply", "--json"])).json.created;
  const task = made.at(-1);
  assert.match((await w.ok(["task", "show", task])).out, /narrate/);
  assert.equal((await w.ok(["frontier", "--json"])).json.stories.length, 0, "a task covers it");
  // Written from the facts: nothing more until records bring more.
  const facts = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.map((e: any) => e.id);
  fs.writeFileSync(path.join(w.cwd, "notes", "story-P1.md"), "Jan Novák se narodil v Týnci nad Labem a byl mlynářem.\n");
  await w.ok(["story", "set", "P1", "--text", "@notes/story-P1.md", ...facts.flatMap((f: string) => ["--fact", f])]);
  await w.ok(["task", "done", task, "--result", "vyprávění napsáno"]);
  assert.equal((await w.ok(["frontier", "--json"])).json.stories.length, 0);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1970", "--place", "Týnec nad Labem", ...cite]);
  await w.ok(["event", "add", "P1", "BURI", "--date", "1970", "--place", "Týnec nad Labem", ...cite]);
  const more = (await w.ok(["frontier", "--json"])).json.stories;
  assert.match(more[0].what, /^Doplnit vyprávění: Jan Novák .* 2 nové údaje/);
  // The user says no: never proposed, and not brought up.
  await w.ok(["config", "set", "stories", "no"]);
  assert.equal((await w.ok(["frontier", "--json"])).json.stories.length, 0);
  assert.equal((await w.ok(["--json"])).json.stories, "off");
  w.cleanup();
});

test("the search beyond the registers before a story: the user may say no to it, or drop it — the story comes either way; the background on its sources", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Křest Jana Nováka 1905", "--kind", "baptism", "--recordset", "B0001", "--locator", "fol. 45, č. 12", "--information", "primary"]);
  const cite = ["--cite", "S0001", "--locator", "fol. 45, č. 12"];
  for (const e of [["CHR", "--date", "25 JUN 1905", "--place", "Týnec nad Labem"], ["OCCU", "--value", "mlynář"], ["RESI", "--place", "Týnec nad Labem", "--house", "12"]]) await w.ok(["event", "add", "P1", ...e, ...cite]);
  // dropped (the user's answer about the search, not about the story): the story is proposed
  const search = (await w.ok(["frontier", "--apply", "--json"])).json.created.at(-1);
  await w.ok(["task", "add", "Křest Josefa", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  const order = (await w.ok(["task", "list", "--json"])).json.tasks.map((t: any) => t.id);
  assert.ok(order.indexOf(search) > order.indexOf("T0003"), `with the stories, after the research: ${order}`);
  assert.match((await w.ok(["plan"])).out, /Potom vyprávění: 1 \(Jan Novák/);
  await w.ok(["task", "drop", search, "--reason", "nechci"]);
  assert.equal((await w.ok(["frontier", "--json"])).json.stories[0].level, "narrate");
  // no search at all, the user's setting: the story at once
  const w2 = await world();
  await w2.ok(["config", "set", "stories.sources", "no"]);
  await w2.ok(["source", "add", "Křest Jana Nováka 1905", "--kind", "baptism", "--recordset", "B0001", "--locator", "fol. 45, č. 12", "--information", "primary"]);
  for (const e of [["CHR", "--date", "25 JUN 1905", "--place", "Týnec nad Labem"], ["OCCU", "--value", "mlynář"], ["RESI", "--place", "Týnec nad Labem", "--house", "12"]]) await w2.ok(["event", "add", "P1", ...e, ...cite]);
  assert.equal((await w2.ok(["frontier", "--json"])).json.stories[0].level, "narrate");
  // the background of place and time: only from a source recorded, named with --source
  await w.ok(["source", "add", "Dějiny Týnce nad Labem", "--kind", "book", "--form", "authored", "--transcript", "Roku 1866 prošla městem pruská vojska."]);
  fs.writeFileSync(path.join(w.cwd, "notes", "story-P1.md"), "Jan Novák byl mlynářem v Týnci nad Labem.\n");
  assert.match((await w.run(["story", "set", "P1", "--text", "@notes/story-P1.md", "--source", "S0009"])).err, /^chyba: S0009 v rodokmenu není\n→ pozadí místa a doby se nejdřív zapíše jako pramen: strom source add/);
  await w.ok(["story", "set", "P1", "--text", "@notes/story-P1.md", "--source", "S0002"]);
  assert.match((await w.ok(["story", "show", "P1"])).out, /the background of place and time from\n\s+S0002 Dějiny Týnce nad Labem/);
  w.cleanup();
  w2.cleanup();
});

test("a session: start prints the brief, close needs summary and the task settled", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  await w.ok(["lesson", "add", "Folio = 2 × snímek + 1", "--on", "B1"]);
  const start = (await w.ok(["session", "start", "--json"])).json;
  assert.equal(start.session.id, "N0001");
  assert.match(start.brief, /## Task T0001 \(link/);
  assert.match(start.brief, /lessons:\n\s+K0001 \(B0001\): Folio = 2 × snímek \+ 1/);
  assert.match(start.brief, /# Method: proving a link/);
  // writes are now logged under the session
  await w.ok(["note", "add", "P1", "Pracuji na tom"]);
  assert.ok((fs.readdirSync(path.join(w.cwd, "data", "ops"), { recursive: true }) as string[]).some((f) => path.basename(f).startsWith("N0001.") && f.endsWith(".jsonl")));
  assert.equal((await w.run(["session", "start"])).code, 2); // one open session at a time
  assert.equal((await w.run(["session", "close", "--summary", "x"])).code, 2); // --next missing
  const still = await w.run(["session", "close", "--summary", "x", "--next", "y"]);
  assert.match(still.err, /T0001 is still in progress/);
  w.env.CLAUDECODE = "1";
  const closed = await w.ok(["session", "close", "--summary", "zatím nic", "--next", "fol. 40-60", "--continue"]);
  assert.match(closed.out, /next task: best in a fresh context\. Nothing is lost[\s\S]*typing \/clear/, "in a conversation: a fresh context for the next task");
  delete w.env.CLAUDECODE;
  const task = readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json"));
  assert.equal(task.state, "open");
  assert.match(task.notes.at(-1).text, /continued in N0001: fol\. 40-60/);
  assert.ok(fs.existsSync(path.join(w.cwd, "output", "tree.ged")), "closing exports the GEDCOM");
  const next = (await w.ok(["session", "start", "--json"])).json;
  assert.match(next.brief, /## Last sessions\n\s+N0001 closed on T0001: zatím nic\n\s+next: fol\. 40-60/);
  w.cleanup();
});

test("brief respects its budget and says where the rest is", opts, async () => {
  const w = await world();
  for (let i = 0; i < 40; i++) await w.ok(["search", "add", `Hledání ${i} ${"x".repeat(80)}`, "--recordset", "B1", "--method", "index", "--result", "negative"]);
  await w.ok(["task", "add", "Křest", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
  const b = (await w.ok(["brief", "--budget", "1200", "--json"])).json;
  assert.ok(b.total <= 1500, `brief ${b.total} tokens`);
  assert.ok(b.sections.some((s: any) => s.cut));
  assert.match(b.text, /cut to fit the brief — see: strom /);
  w.cleanup();
});
