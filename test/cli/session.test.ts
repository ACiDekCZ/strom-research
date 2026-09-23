// Sessions, the brief, the frontier, agent files and `strom run` with a
// scripted agent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };
const agent = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905", "--born-place", "Týnec nad Labem"]);
  await w.ok(["repo", "add", "SOA Praha", "--automation", "manual"]);
  await w.ok(["recordset", "add", "Týnec 17, N 1903-1920", "--repo", "R1", "--kinds", "baptism", "--places", "Týnec nad Labem", "--years", "1903-1920", "--access", "online-free"]);
  return w;
}

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
  assert.ok(fs.existsSync(path.join(w.cwd, "data", "ops", "N0001.jsonl")));
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

test("strom run: a scripted agent works a task through strom; run closes, exports, commits", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  const r = await w.run(["run", "--agent", "script", "--json"]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.json.sessions[0].outcome, "ok");
  const s = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.equal(s.state, "closed");
  assert.equal(s.summary, "baptism of Jan found");
  const jan = readJsonFile(path.join(w.cwd, "data", "persons", "P0001.json"));
  assert.ok(jan.events.some((e: any) => e.kind === "CHR" && e.status === "proven"));
  assert.ok(fs.existsSync(path.join(w.cwd, "data", "ops", "N0001.jsonl")), "the agent's writes are logged under its session");
  assert.match(fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8"), /2 DATE 25 JUN 1905/);
  assert.equal(spawnSync("git", ["status", "--porcelain", "--", "data", "output"], { cwd: w.cwd, encoding: "utf8" }).stdout, "");
  assert.match((await w.ok(["verify"])).out, /^ok/);
  w.cleanup();
});

test("a search made in a session served its task, unless it says otherwise", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]); // T1
  await w.ok(["task", "add", "Jiná kniha", "--level", "locate", "--where", "katalog", "--why", "a", "--done-when", "b"]); // T2
  await w.ok(["session", "start", "T1"]);
  const a = (await w.ok(["search", "add", "Křty Novák 1903–1907", "--recordset", "B1", "--years", "1903-1907", "--method", "page-by-page", "--result", "negative", "--json"])).json.search;
  assert.equal(a.task, "T0001");
  const b = (await w.ok(["search", "add", "Katalog", "--method", "catalog", "--result", "negative", "--task", "T2", "--json"])).json.search;
  assert.equal(b.task, "T0002");
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  assert.equal((await w.ok(["search", "add", "Mimo sezení", "--method", "web", "--result", "negative", "--json"])).json.search.task, undefined);
  w.cleanup();
});

test("strom run: an agent that dies leaves an interrupted session and the task back in the queue", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "die";
  await w.ok(["run", "--agent", "script"]);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "interrupted");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json")).state, "open");
  w.cleanup();
});

test("strom run: the subscription limit stops the loop", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "A", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  await w.ok(["task", "add", "B", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "limit";
  const r = (await w.ok(["run", "--agent", "script", "--max", "5", "--json"])).json;
  assert.equal(r.sessions.length, 1);
  assert.equal(r.stop, "limit");
  assert.match(r.stopped, /limit předplatného \(obnoví se 7pm\)/);
  w.cleanup();
});

test("strom run --until: session after session until then, without --max", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "A", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  await w.ok(["task", "add", "B", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.AGENT_MODE = "idle"; // records nothing: each task is parked after two sessions
  const later = new Date(Date.now() + 3 * 3600_000);
  const until = `${later.getHours()}:${String(later.getMinutes()).padStart(2, "0")}`;
  const r = (await w.ok(["run", "--agent", "script", "--until", until, "--json"])).json;
  assert.ok(r.sessions.length >= 4, "both tasks twice (and what the frontier adds), not one session");
  assert.equal(r.stop, "empty");
  assert.equal((await w.ok(["run", "--agent", "script", "--json"])).json.sessions.length, 0, "without --until one session at most");
  assert.equal((await w.run(["run", "--agent", "script", "--until", "25:99"])).code, 2);
  w.cleanup();
});

test("a task written before its book was known: the brief finds the book, task edit points the task at it", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "18 OCT 1862", "--born-place", "Týnec čp. 13"]);
  await w.ok(["task", "add", "Najít matriky pro Týnec", "--level", "locate", "--where", "farnost Týnce", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["task", "add", "Křest Jana 18. 10. 1862", "--level", "link", "--where", "matrika N pro Týnec, rok 1862", "--why", "rodiče", "--done-when", "zápis nalezen", "--about", "P1"]);
  // the locate task finds the books
  await w.ok(["recordset", "add", "Týnec 5, N 1850-1870", "--kinds", "baptism", "--places", "Týnec", "--years", "1850-1870"]);
  await w.ok(["recordset", "add", "Týnec 6, O 1850-1870", "--kinds", "marriage", "--places", "Týnec", "--years", "1850-1870"]);
  await w.ok(["recordset", "add", "Týnec 4, N 1800-1849", "--kinds", "baptism", "--places", "Týnec", "--years", "1800-1849"]);
  const done = await w.ok(["task", "done", "T1", "--result", "knihy založeny"]);
  assert.match(done.out, /T0002 name no record set yet — point them at the books found: strom task edit T0002 --where B…/);
  // the brief of the link task shows the baptisms of the birthplace in the year of the task, not the rest
  const brief = (await w.ok(["brief", "T2"])).out;
  assert.match(brief, /## Record sets \(the task names none; these cover it — point it at the right one: strom task edit T0002 --where B0001\)\n  B0001 Týnec 5/);
  assert.doesNotMatch(brief, /B0002 Týnec 6|B0003 Týnec 4/);
  const edited = await w.ok(["task", "edit", "T2", "--where", "B1", "--priority", "5"]);
  assert.match(edited.out, /T0002 where, priority → B0001/);
  const t = (await w.ok(["task", "show", "T2", "--json"])).json.task;
  assert.deepEqual([t.where, t.priority, t.what], [["B0001"], 5, "Křest Jana 18. 10. 1862"]);
  assert.match((await w.ok(["brief", "T2"])).out, /## Record sets\n  B0001/);
  assert.equal((await w.run(["task", "edit", "T2"])).code, 2, "nothing to change");
  assert.equal((await w.run(["task", "edit", "T2", "--where", "B9"])).code, 2, "no such record set");
  w.cleanup();
});
