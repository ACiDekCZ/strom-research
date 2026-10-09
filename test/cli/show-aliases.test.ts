// What agents type for a command — strom show <ID>, lesson show, event show, --surnames, task add --done, media list
// B0001 — is taken (K4); aliases are no commands of their own in help (one line "also: …"), listed in the catalog. A
// mistake in calling a command says its usage at once (P5/K2): no strom help needed to try again.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  w.env.STROM_LANG = "en";
  await w.ok(["person", "add", "Šimon /Ševčík/", "--sex", "M", "--born", "1885"]);
  await w.ok(["repo", "add", "Státní oblastní archiv"]);
  await w.ok(["recordset", "add", "Matrika Týnec", "--repo", "R0001", "--kinds", "baptism", "--places", "Týnec", "--years", "1784-1850"]);
  await w.ok(["recordset", "add", "Метрическая книга", "--repo", "R0001", "--kinds", "marriage", "--places", "Москва", "--years", "1880-1900"]);
  await w.ok(["lesson", "add", "Folio = 2 × image + 1", "--on", "B0001", "--detail", "checked at six anchors"]);
  return w;
}

test("strom show: any record by its ID, several at once, the lesson with its detail, a fact with whose it is", opts, async () => {
  const w = await world();
  const one = await w.ok(["show", "P1"]);
  assert.match(one.out, /^P0001 Šimon Ševčík/);
  const many = await w.ok(["show", "P0001", "K0001", "E0001", "B0002", "P0099"]);
  assert.match(many.out, /P0001 Šimon Ševčík/);
  assert.match(many.out, /K0001 lesson · recordset B0001/);
  assert.match(many.out, /detail +checked at six anchors/);
  assert.match(many.out, /E0001 of P0001/);
  assert.match(many.out, /Метрическая книга/);
  assert.match(many.out, /P0099: no person P0099/);
  const j = (await w.ok(["show", "P0001", "K0001", "--json"])).json;
  assert.deepEqual(j.records.map((r: any) => [r.id, r.command]), [["P0001", "person show"], ["K0001", "show"]]);
  // what agents type for it
  assert.match((await w.ok(["lesson", "show", "K0001"])).out, /rule +Folio/);
  assert.match((await w.ok(["event", "show", "E0001"])).out, /E0001 of P0001/);
  assert.match((await w.ok(["fact", "show", "E1"])).out, /E0001 of P0001/);
  // no ID: found (an old code, a word — any script, accents optional)
  assert.match((await w.ok(["show", "sevcik"])).out, /P0001 +person/);
  assert.match((await w.ok(["show", "москва"])).out, /B0002/);
  w.cleanup();
});

test("aliases: in the catalog, one line in help, never commands of their own", opts, async () => {
  const w = await world();
  const help = (await w.ok(["help", "show"])).out;
  assert.match(help, /Also: strom lesson show · strom event show · strom fact show/);
  assert.match((await w.ok(["help", "search", "add"])).out, /Also: --where \(= --recordset\) · --surnames \(= --surname\)/);
  const overview = (await w.ok(["help"])).out;
  assert.doesNotMatch(overview, /lesson show|event show/);
  const cat = (await w.ok(["commands", "--json"])).json;
  const list: any[] = cat.commands ?? cat;
  assert.equal(list.filter((c) => c.command === "lesson show").length, 0);
  assert.deepEqual(list.find((c) => c.command === "show").aliases, ["lesson show", "event show", "fact show", "record show"]);
  assert.deepEqual(list.find((c) => c.command === "search add").options.find((o: any) => o.name === "--surname").aliases, ["--surnames"]);
  w.cleanup();
});

test("option aliases and list filters agents look for", opts, async () => {
  const w = await world();
  const s = (await w.ok(["search", "add", "Křest Šimona", "--surnames", "Ševčík", "--where", "B0001", "--years", "1880-1890", "--method", "index", "--result", "negative", "--json"])).json;
  assert.deepEqual(s.search.scope.surnames, ["Ševčík"]);
  assert.deepEqual(s.search.recordsets, ["B0001"]);
  const t = (await w.ok(["task", "add", "Křest Šimona", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done", "nalezen nebo prohledáno", "--about", "P0001", "--json"])).json;
  assert.equal(t.task.doneWhen, "nalezen nebo prohledáno");
  assert.match((await w.ok(["find", "Ševčík", "--kind", "person"])).out, /P0001/);
  // recordset list by place (accents optional, any script), kind, years, archive
  const byPlace = (await w.ok(["recordset", "list", "--place", "tynec", "--json"])).json.recordsets.map((b: any) => b.id);
  assert.deepEqual(byPlace, ["B0001"]);
  assert.deepEqual((await w.ok(["recordset", "list", "--place", "МОСКВА", "--json"])).json.recordsets.map((b: any) => b.id), ["B0002"]);
  assert.deepEqual((await w.ok(["recordset", "list", "--kind", "marriage", "--json"])).json.recordsets.map((b: any) => b.id), ["B0002"]);
  assert.deepEqual((await w.ok(["recordset", "list", "--years", "1840-1885", "--json"])).json.recordsets.map((b: any) => b.id), ["B0001", "B0002"]);
  assert.deepEqual((await w.ok(["recordset", "list", "--years", "1890", "--repo", "R0001", "--json"])).json.recordsets.map((b: any) => b.id), ["B0002"]);
  // media list with the record set as its argument
  const ml = await w.ok(["media", "list", "B0001"]);
  assert.match(ml.out, /no images registered/);
  assert.equal((await w.run(["media", "list", "B0099"])).code, 2);
  w.cleanup();
});

test("a mistake in calling a command says its usage at once — to an agent", opts, async () => {
  const w = await world();
  const env = { AI_AGENT: "some-agent" };
  const unknown = await w.run(["search", "add", "x", "--surnamez", "Novák"], { env });
  assert.equal(unknown.code, 2);
  assert.match(unknown.err, /similar option: --surname/);
  assert.match(unknown.err, /usage: strom search add <question> \[options\]/);
  assert.match(unknown.err, /--recordset <B…>… /);
  const missing = await w.run(["task", "done"], { env });
  assert.match(missing.err, /missing <task>/);
  assert.match(missing.err, /usage: strom task done <task> \[options\]\n +--result <text>/);
  // an option the command needs, said by the command itself
  const required = await w.run(["task", "done", "T0001"], { env });
  assert.match(required.err, /--result is required/);
  assert.match(required.err, /usage: strom task done/);
  // limits said
  assert.match((await w.run(["task", "add"], { env })).err, /--done-when <text> \(≤500\)/);
  // a mistake of another kind (a record not there) says no usage
  assert.doesNotMatch((await w.run(["person", "show", "P0099"], { env })).err, /usage:/);
  // --json: the usage as a field (a program reads it)
  const j = await w.run(["task", "done", "--json"]);
  assert.match(j.json.usage, /^usage: strom task done <task>/);
  // in a batch: under its line
  const b = await w.run(["batch", "task done T0001", 'person add "Eva /Nová/" --sexx F'], { env });
  assert.match(b.err, /line 1 \(task done\): --result is required[\s\S]*usage: strom task done/);
  assert.match(b.err, /line 2 \(person add\): unknown option --sexx[\s\S]*usage: strom person add/);
  // a person reads the error and its hint, no English usage
  assert.doesNotMatch((await w.run(["task", "done"])).err, /usage:/);
  assert.doesNotMatch((await w.run(["batch", "task done T0001", "task done T0002"])).err, /usage:/);
  w.cleanup();
});

test("find puts the records named so before a word in a text; research show takes the one active research", opts, async () => {
  const w = await world();
  // a note naming Týnec on the person, the book named so: the book first
  await w.ok(["note", "add", "P0001", "narozen snad v Týnci nebo Tynec"]);
  const hits = (await w.ok(["find", "tynec", "--json"])).json.hits.map((h: any) => h.id);
  assert.equal(hits[0], "B0001");
  assert.ok(hits.includes("P0001"));
  assert.match((await w.run(["research", "show"])).err, /no active research/);
  await w.ok(["research", "new", "Předci Šimona", "--person", "P0001"]);
  assert.match((await w.ok(["research", "show"])).out, /Předci Šimona/);
  await w.ok(["research", "new", "Potomci Šimona", "--person", "P0001", "--direction", "descendants"]);
  assert.match((await w.run(["research", "show"])).err, /2 researches are active: name one/);
  w.cleanup();
});
