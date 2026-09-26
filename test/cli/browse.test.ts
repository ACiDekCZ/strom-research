// Looking through the family tree, as a person does it from the menu: the
// research at a glance, the ancestors of one person, one person's card and what
// came in lately — in the research language, from the records as they are.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { humanDate } from "../../src/cli/human.ts";
import { recent } from "../../src/core/overview.ts";
import { Tree } from "../../src/core/tree.ts";
import { pickNumbers } from "../../src/cli/menu.ts";

/** A small research: Jan, his parents (the baptism names them), his father's marriage, a grandfather known by name. */
async function family(w: World): Promise<void> {
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905"]);
  await w.ok(["source", "add", "Křest Jana Nováka 1905", "--kind", "baptism", "--form", "original", "--information", "primary", "--transcript", "Joannes filius Josephi Novák"]);
  await w.ok(["event", "edit", "E0001", "--date", "25 JUN 1905", "--reason", "the baptism gives the day"]);
  await w.ok(["cite", "E0001", "S0001", "--status", "proven"]);
  await w.ok(["event", "add", "P0001", "CHR", "--date", "26 JUN 1905", "--place", "Týnec nad Labem", "--house", "12", "--cite", "S0001", "--status", "proven"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  await w.ok(["person", "add", "Marie /Dvořáková/", "--sex", "F", "--born", "BEF 1885"]);
  await w.ok(["family", "add", "--partner", "P0002", "--partner", "P0003", "--child", "P0001", "--married", "BET 1900 AND 1904", "--cite", "S0001"]);
  await w.ok(["person", "add", "Václav /Novák/", "--sex", "M"]);
  await w.ok(["family", "add", "--partner", "P0004", "--child", "P0002"]);
  await w.ok(["event", "add", "P0002", "OCCU", "--value", "mlynář", "--date", "1905", "--cite", "S0001", "--status", "proven"]);
}

test("dates as a person reads them, in their language", () => {
  assert.equal(humanDate("31 AUG 1830", "cs"), "31. 8. 1830");
  assert.equal(humanDate("31 AUG 1830", "de"), "31.8.1830");
  assert.equal(humanDate("31 AUG 1830", "en"), "31 Aug 1830");
  assert.equal(humanDate("AUG 1830", "cs"), "srpen 1830");
  assert.equal(humanDate("ABT 1830", "cs"), "asi 1830");
  assert.equal(humanDate("CAL 1830", "de"), "etwa 1830");
  assert.equal(humanDate("BEF MAR 1853", "cs"), "před 3/1853", "after a word, a month in numbers: no case to bend");
  assert.equal(humanDate("BEF MAR 1853", "en"), "before Mar 1853");
  assert.equal(humanDate("BET 1811 AND 1812", "cs"), "mezi 1811 a 1812");
  assert.equal(humanDate("FROM 1839 TO 1845", "en"), "from 1839 to 1845");
  assert.equal(humanDate("AFT 1850", "xx"), "after 1850", "no catalog: English words");
  assert.equal(humanDate("INT 1850 (podle věku)", "cs"), "INT 1850 (PODLE VĚKU)", "what it cannot read stays as written");
});

test("the research at a glance, the ancestors of one person, one person's card", { skip: !hasGit }, async () => {
  const w = new World();
  await family(w);
  const stats = (await w.ok(["stats"])).out;
  assert.match(stats, /^Novákovi – přehled výzkumu/);
  assert.match(stats, /Osoby: 4 · rodiny: 2 · záznamy z pramenů: 1/);
  assert.match(stats, /Údaje: doložené 3 · pravděpodobné 1 · možné 0 · jen stopy 1/);
  assert.match(stats, /Předkové – Jan Novák \(\*1905\):\n {2}rodiče +známých 2 z 2 · narození doloženo: 0\n {2}prarodiče +známých 1 z 4 · narození doloženo: 0/);
  const json = (await w.ok(["stats", "--json"])).json;
  assert.deepEqual(json.generations.map((g: { known: number }) => g.known), [2, 1]);
  assert.equal(json.from.id, "P0001");

  const ped = (await w.ok(["pedigree"])).out;
  assert.equal(
    ped.split("\n").slice(0, 6).join("\n"),
    ["Jan Novák (*1905) ✓", "├─ Josef Novák", "│  ├─ Václav Novák", "│  │  └─ ? rodiče zatím neznámí", "│  └─ ? matka zatím neznámá", "└─ Marie Dvořáková (*<1885)"].join("\n"),
  );
  assert.match(ped, /U každého nejdřív otec, pak matka · ✓ narození doloženo záznamem/);
  assert.match((await w.ok(["pedigree", "Jan Novák", "--generations", "2"])).out, /Známí předkové sahají až do 3\. generace: strom pedigree P0001 --generations 3/);
  assert.notEqual((await w.run(["pedigree", "--generations", "0"])).code, 0);

  const jan = (await w.ok(["person", "card", "jan novak"])).out;
  assert.match(jan, /^Jan Novák \(\*1905\)\n {2}narození +25\. 6\. 1905 · doloženo — Křest Jana Nováka 1905\n {2}křest +26\. 6\. 1905, Týnec nad Labem č\. 12 · doloženo/);
  assert.match(jan, /Rodiče: Josef Novák, Marie Dvořáková \(\*<1885\)/);
  const josef = (await w.ok(["person", "card", "P0002"])).out;
  assert.match(josef, /povolání +mlynář, 1905 · doloženo/);
  assert.match(josef, /Rodiče: Václav Novák\nManželka: Marie Dvořáková \(\*<1885\)\n {2}sňatek +mezi 1900 a 1904 · pravděpodobné — Křest Jana Nováka 1905\n {2}Děti: Jan Novák \(\*1905\)/);
  // The same in English, when the research is.
  const en = (await w.ok(["person", "card", "P0001", "--lang", "en"])).out;
  assert.match(en, /birth +25 Jun 1905 · proven/);
  assert.match(en, /baptism +26 Jun 1905, Týnec nad Labem, house 12/);
  w.cleanup();
});

test("what came in lately: new people, facts added or refined, what the agent did", { skip: !hasGit }, async () => {
  const w = new World();
  await family(w);
  // A name in another script, typed decomposed.
  await w.ok(["person", "add", "Иван /Петров/".normalize("NFD"), "--sex", "M", "--born", "1901"]);
  await w.ok(["session", "start"]);
  await w.ok(["session", "close", "--continue", "--summary", "Rejstřík prošel, Josef nalezen", "--next", "oddavky"]);
  const r = (await w.ok(["recent"])).out;
  assert.match(r, /^Co přibylo od \d{1,2}\. \d{1,2}\./);
  assert.match(r, /Nové osoby: 5 · údaje: nové \d+, upřesněné 0/);
  assert.match(r, /Noví lidé:\n(.*\n)* {2}Иван Петров \(\*1901\)/);
  assert.match(r, /Jan Novák – narození: 25\. 6\. 1905 · doloženo/);
  assert.match(r, /Novák & Marie Dvořáková – sňatek: mezi 1900 a 1904/);
  assert.match(r, /Co dělal agent:\n {2}\d{1,2}\. \d{1,2}\. – (.+: )?Rejstřík prošel, Josef nalezen/);
  // The same for a program.
  const json = (await w.ok(["recent", "--json"])).json;
  assert.equal(json.persons.length, 5);
  assert.ok(json.persons.some((p: { name: string }) => p.name === "Иван Петров".normalize("NFC")), "names in NFC");
  assert.notEqual((await w.run(["recent", "--days", "x"])).code, 0);
  // A fact recorded before, made more exact since: refined, not new.
  const since = new Date().toISOString();
  await w.ok(["event", "edit", "E0002", "--place", "Týnec nad Labem", "--house", "12/1", "--reason", "the house as the entry gives it"]);
  const later = recent(Tree.open(w.cwd, w.env), since);
  assert.deepEqual(later.facts.map((f) => [f.fact.id, f.refined]), [["E0002", true]]);
  assert.equal(later.persons.length, 0);
  w.cleanup();
});

test("what the agent will do next: the queue in its order, for the user — records by their names, the stories after", { skip: !hasGit }, async () => {
  const w = new World();
  await family(w);
  const empty = (await w.ok(["plan"])).out;
  await w.ok(["recordset", "add", "Týnec 17, O 1880-1910", "--kinds", "marriage", "--places", "Týnec nad Labem", "--years", "1880-1910", "--access", "online-free"]);
  const task = (what: string, level: string, ...more: string[]) =>
    w.ok(["task", "add", what, "--level", level, "--why", "rodiče Jana", "--done-when", "nalezeno", "--about", "P0002", ...more]);
  await task("Oddavky Josefa a Marie", "link", "--where", "B0001", "--priority", "5");
  await task("Přečíst celý zápis S0001", "enrich", "--where", "S0001");
  await task("Vyprávění o Josefovi", "narrate", "--where", "fakta");
  await w.ok(["task", "start", "T0002"]);
  const plan = (await w.ok(["plan"])).out;
  assert.match(plan, /^Co agent udělá dál – Novákovi:\n {2}právě teď +Přečíst celý zápis Křest Jana Nováka 1905\n/, "in progress first; a record by its title");
  assert.match(plan, /\n {2}1\. +Oddavky Josefa a Marie \(nejdřív potřebuje snímky\)\n/);
  assert.match(plan, /Potom vyprávění: 1 \(Josef Novák\)/);
  assert.match(plan, /Pořadí změníte v rozhovoru s agentem/);
  assert.doesNotMatch(plan, /T000|B0001|S0001|narrate|link/, "no IDs, no levels");
  const json = (await w.ok(["plan", "--json"])).json;
  assert.deepEqual(json.tasks.map((t: { id: string }) => t.id).slice(0, 2), ["T0002", "T0001"]);
  assert.equal(json.stories.length, 1);
  assert.ok(empty.startsWith("Co agent udělá dál"));
  w.cleanup();
});

test("the menu: look through the family tree", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await family(w);
  // 5 look through · 5 the ancestors (Enter: the main person) · Enter · 1 the overview · Enter · 0 back · 0 quit
  const r = await w.ok([], { tty: true, answers: ["5", "5", "", "", "1", "", "0", "0"] });
  assert.match(r.out, /Prohlížet rodokmen: přehled, osoby, předkové, co je nového/);
  assert.match(r.out, /Čí předky\? \(jméno nebo ID jako P0012; 0 vrátí zpět\) \[Jan Novák\]/);
  assert.match(r.out, /├─ Josef Novák/);
  assert.match(r.out, /Novákovi – přehled výzkumu/);
  assert.match(r.out, /Na shledanou/);
  w.cleanup();
});

test("tasks picked by their numbers: one, a list, a range — anything else asks again", () => {
  assert.deepEqual(pickNumbers("2", 5), [2]);
  assert.deepEqual(pickNumbers("3, 1", 5), [3, 1], "in the order given");
  assert.deepEqual(pickNumbers("2-4 1 3", 5), [2, 3, 4, 1], "each once");
  assert.deepEqual(pickNumbers("2 – 3", 5), [2, 3], "a range with spaces and a dash");
  for (const bad of ["6", "0", "a", "3-1", "1,,x", ""]) assert.equal(pickNumbers(bad, 5), undefined, bad);
});
