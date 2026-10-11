// A search under a woman's form of a surname ("Nováková") is a search of the man's family ("Novák") too: the brief
// and `strom searched P…` show it both ways, so a negative search is not done again.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { sameFamilyName, surnameForms } from "../../src/core/people.ts";

const opts = { skip: !hasGit };

test("surname forms: a woman's form and the man's, in Czech, Polish and Cyrillic; nothing else", () => {
  const yes: [string, string][] = [
    ["Novák", "Nováková"],
    ["Víšek", "Víšková"],
    ["Němec", "Němcová"],
    ["Svoboda", "Svobodová"],
    ["Novotný", "Novotná"],
    ["Nowak", "Nowakowa"],
    ["Kowalski", "Kowalska"],
    ["Иванов", "Иванова"],
    ["Толстой", "Толстая"],
    ["Novák", "Nováková"], // decomposed (NFD)
    ["Ivanov", "Ivanova"],
  ];
  for (const [a, b] of yes) {
    assert.ok(sameFamilyName(a, b), `${a} ~ ${b}`);
    assert.ok(sameFamilyName(b, a), `${b} ~ ${a}`);
  }
  for (const [a, b] of [["Novák", "Novotný"], ["Kala", "Kalina"], ["Hora", "Horák"], ["", "Novák"], ["Svoboda", "Svobodník"]] as [string, string][])
    assert.ok(!sameFamilyName(a, b), `${a} ≁ ${b}`);
  assert.ok(surnameForms("Víšková").has("visek"));
});

test("a search under the woman's form shows in the man's brief and searched P…, and the other way", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "1905"]); // P1
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F", "--born", "1907"]); // P2
  await w.ok(["recordset", "add", "Kniha N 1900-1910", "--places", "Lhota", "--years", "1900-1910", "--access", "online-free"]); // B1
  await w.ok(["search", "add", "Křty Nováková 1900–1910", "--recordset", "B1", "--years", "1900-1910", "--surname", "Nováková", "--method", "page-by-page", "--result", "negative"]); // Q1
  await w.ok(["search", "add", "Oddaní Novák 1925", "--years", "1925", "--surname", "Novák", "--method", "index", "--result", "negative"]); // Q2

  const his = (await w.ok(["searched", "P1", "--json"])).json.searches.map((s: { id: string }) => s.id);
  assert.deepEqual(his, ["Q0001", "Q0002"]);
  const hers = (await w.ok(["searched", "P2", "--json"])).json.searches.map((s: { id: string }) => s.id);
  assert.deepEqual(hers, ["Q0001", "Q0002"]);
  assert.deepEqual((await w.ok(["searched", "Novák", "--json"])).json.searches.map((s: { id: string }) => s.id).includes("Q0001"), true);

  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "matrika Lhota", "--why", "a", "--done-when", "b", "--about", "P1"]);
  const brief = (await w.ok(["brief", "T1"])).out;
  assert.match(brief, /Q0001 \[negative\] Křty Nováková/);
  w.cleanup();
});
