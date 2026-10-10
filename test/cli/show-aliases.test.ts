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
  // a short list says nothing more; a long one ends with the filters not used yet
  assert.doesNotMatch((await w.ok(["recordset", "list"])).out, /fewer:/);
  await w.ok(["batch", ...Array.from({ length: 30 }, (_, i) => `recordset add "Matrika Dolní Ves ${i + 1}" --places "Dolní Ves" --years ${1700 + i}-${1710 + i}`)]);
  const long = (await w.ok(["recordset", "list"])).out.trim().split("\n");
  assert.equal(long.length, 33);
  assert.equal(long.at(-1), "32 record sets — fewer: strom recordset list <text> --place <name> --kind <kind> --years <from-to> --repo <R…>");
  assert.doesNotMatch((await w.ok(["recordset", "list", "--place", "dolni ves"])).out, /fewer:/, "30 lines: not long");
  assert.equal((await w.ok(["recordset", "list", "--years", "1700-1800"])).out.trim().split("\n").at(-1), "31 record sets — fewer: strom recordset list <text> --place <name> --kind <kind> --repo <R…>");
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
  // a name agents type for another option (the shell tool's timeout for the readers' time): pointed to it, never taken
  const timeout = await w.run(["read", "B0001", "--images", "1-2", "--timeout", "3000"], { env });
  assert.equal(timeout.code, 2);
  assert.match(timeout.err, /unknown option --timeout for strom read\n→ meant: --minutes <n> — time limit of one reader/);
  assert.match((await w.run(["read", "B0001", "--images", "1-2", "--timeout=3000"], { env })).err, /meant: --minutes <n>/);
  // a range of read from the higher number: said (and 35..38 read as 35-38)
  assert.match((await w.run(["read", "B0001", "--images", "38..35", "--question", "x"], { env })).err, /--images 38\.\.35: a range from the lower number\n→ --images 35-38/);
  assert.match((await w.run(["read", "B0001", "--images", "35..38", "--question", "x"], { env })).err, /no registered images 35–38 of B0001/);
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

test("a show command of one record given several IDs shows each in turn as strom show; an ID is never a value to quote (N0194)", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Ольга /Петрова/", "--sex", "F", "--born", "1890"]);
  // two people: both shown, one after another
  const two = await w.ok(["person", "show", "P0001", "P2"]);
  assert.match(two.out, /^P0001 Šimon Ševčík/);
  assert.match(two.out, /P0002 Ольга Петрова/);
  // --json: the records in turn, as strom show gives them
  const j = (await w.ok(["person", "show", "P0001", "P0002", "--json"])).json;
  assert.deepEqual(j.records.map((r: any) => [r.id, r.command]), [["P0001", "person show"], ["P0002", "person show"]]);
  assert.equal(j.records[1].data.person.id, "P0002");
  // IDs of other kinds: each by the show command of its kind (a lesson, a fact, a record set, an image by number)
  const mixed = await w.ok(["task", "show", "P0002", "K0001", "E0001", "B0002"]);
  assert.match(mixed.out, /P0002 Ольга Петрова/);
  assert.match(mixed.out, /K0001 lesson/);
  assert.match(mixed.out, /E0001 of P0001/);
  assert.match(mixed.out, /Метрическая книга/);
  // a word that is no ID after the person: the line as meant, quoted (a name in two words)
  const name = await w.run(["person", "show", "Šimon", "Ševčík"]);
  assert.notEqual(name.code, 0);
  assert.match(name.err, /unexpected argument "Ševčík"/);
  assert.match(name.err, /as meant: strom person show "Šimon Ševčík"|quote values with spaces/);
  // IDs and a word: the IDs said as strom show takes them, never quoted
  const both = await w.run(["person", "show", "P0001", "P0002", "navíc"]);
  assert.notEqual(both.code, 0);
  assert.match(both.err, /several records: strom show P0001 P0002/);
  assert.doesNotMatch(both.err, /quote|"P0001 P0002|as meant/);
  // a batch line: a show command is no line of a batch — said so, no quotes suggested
  const b = await w.run(["batch", "person show P0001 P0002"]);
  assert.notEqual(b.code, 0);
  assert.match(b.err, /cannot run in a batch/);
  assert.doesNotMatch(b.err, /quote|as meant/);
  w.cleanup();
});

test("recordset add and edit: --place is --places (NALEZY 14)", opts, async () => {
  const w = await world();
  await w.ok(["recordset", "add", "Matrika Bělušice", "--repo", "R0001", "--kinds", "burial", "--place", "Bělušice,Lžovice", "--years", "1800-1850"]);
  assert.deepEqual((await w.ok(["recordset", "list", "--json"])).json.recordsets.find((b: any) => b.id === "B0003").places, ["Bělušice", "Lžovice"]);
  await w.ok(["recordset", "edit", "B0003", "--place=Lžovice"]);
  assert.deepEqual((await w.ok(["recordset", "list", "--json"])).json.recordsets.find((b: any) => b.id === "B0003").places, ["Lžovice"]);
  assert.match((await w.ok(["help", "recordset", "add"])).out, /--place \(= --places\)/);
  w.cleanup();
});
