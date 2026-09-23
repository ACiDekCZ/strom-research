// Correcting and completing what is known about sources, archives, record
// sets and places: only what is given changes, nothing is lost, and changing
// what a record says needs a reason.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["repo", "add", "MZA Brno", "--country", "CZ"]); // R1
  await w.ok(["recordset", "add", "Sloup 782", "--repo", "R1", "--kinds", "baptism", "--places", "Sloup", "--years", "1847-1868"]); // B1
  await w.ok(["place", "add", "Vavřinec", "--kind", "village"]); // L1
  await w.ok(["source", "add", "Křest Františka 1862", "--kind", "baptism", "--recordset", "B1", "--locator", "pag. 228", "--transcript", "Franz, Sohn des Anton Višek"]); // S1
  return w;
}

test("source edit: fill in freely, change evidence only with a reason", opts, async () => {
  const w = await world();
  fs.writeFileSync(path.join(w.cwd, "preklad.txt"), "František, syn Antonína Víška\n");
  const r = await w.ok(["source", "edit", "S1", "--translation", "@preklad.txt", "--language", "de", "--information", "primary", "--note", "přečteno v plném rozlišení"]);
  assert.match(r.out, /S0001 translation, language, information, note/);
  assert.equal((await w.run(["source", "edit", "S1", "--transcript", "Franz, Sohn des Anton Víšek"])).code, 2, "the transcript is evidence");
  assert.match((await w.run(["source", "edit", "S1", "--locator", "pag. 229"])).err, /changing locator of S0001 needs --reason/);
  await w.ok(["source", "edit", "S1", "--transcript", "Franz, Sohn des Anton Víšek", "--reason", "re-read: Víšek with an accent"]);
  await w.ok(["source", "edit", "S1", "--information", "primary"]); // the same value is no change
  const s = (await w.ok(["source", "show", "S1", "--json"])).json.source;
  assert.equal(s.transcript, "Franz, Sohn des Anton Víšek");
  assert.equal(s.translation, "František, syn Antonína Víška\n");
  assert.deepEqual([s.language, s.information, s.locator, s.notes.length], ["de", "primary", "pag. 228", 1]);
  assert.equal((await w.run(["source", "edit", "S1"])).code, 2, "nothing to change");
  assert.equal((await w.run(["source", "edit", "S1", "--form", "copy"])).code, 2, "invalid form");
  const log = fs.readdirSync(path.join(w.cwd, "data", "ops")).map((f) => fs.readFileSync(path.join(w.cwd, "data", "ops", f), "utf8")).join("");
  assert.match(log, /"op":"source.edit".*"reason":"re-read: Víšek with an accent"/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("repo, record set and place edits: what they cover, their terms, other names", opts, async () => {
  const w = await world();
  await w.ok(["repo", "edit", "R1", "--automation", "manual", "--terms", "no bulk downloads"]);
  assert.deepEqual(((await w.ok(["repo", "show", "R1", "--json"])).json.repository as any).automation, "manual");
  await w.ok(["recordset", "edit", "B1", "--places", "Sloup,Vavřinec,Petrovice", "--layout", "by village; Vavřinec on images 96–125"]);
  const b = (await w.ok(["recordset", "show", "B1", "--json"])).json.recordset;
  assert.deepEqual(b.places, ["Sloup", "Vavřinec", "Petrovice"]);
  assert.deepEqual(b.kinds, ["baptism"], "what was not given stays");
  await w.ok(["place", "edit", "L1", "--alt", "Wawrzinetz@de", "--lat", "49.41", "--lon", "16.74"]);
  assert.equal((await w.run(["place", "edit", "L1", "--alt", "Wawrzinetz@de"])).code, 2, "a name it has is nothing new");
  const p = (await w.ok(["place", "show", "L1", "--json"])).json.place;
  assert.deepEqual(p.names.map((n: any) => n.name), ["Vavřinec", "Wawrzinetz"]);
  assert.deepEqual(p.coords, { lat: 49.41, lon: 16.74 });
  assert.equal((await w.run(["place", "edit", "L1", "--lat", "49"])).code, 2, "both coordinates");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a second record adds to a fact: ages, house, witnesses free; changing what was known needs a reason", opts, async () => {
  const w = await world();
  await w.ok(["research", "new", "Předci", "--new-person", "Antonín /Víšek/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Markéta", "--sex", "F"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2", "--married", "28 MAY 1839", "--married-place", "Petrovice"]); // F1, E1 lead
  await w.ok(["source", "add", "Oddavky 1839", "--kind", "marriage", "--information", "primary"]); // S2
  await w.ok(["cite", "E1", "S2", "--status", "proven"]);
  const r = await w.ok(["event", "edit", "E1", "--age", "husband:27", "--age", "wife:17", "--house", "21", "--with", "witness:Martin Martinek", "--with", "witness:Joseph Urban", "--with", "oddávající:Vinzenz Bistrzitzky"]);
  assert.match(r.out, /E0001 MARR edited/);
  let e = (await w.ok(["family", "show", "F1", "--json"])).json.family.events[0];
  assert.deepEqual(e.ages, { P0001: "27y", P0002: "17y" });
  assert.equal(e.house, "21");
  assert.deepEqual(e.participants.map((p: any) => `${p.role}:${p.name}`), ["witness:Martin Martinek", "witness:Joseph Urban", "officiant:Vinzenz Bistrzitzky"]);
  // the same witness again is not added twice; another age for a partner is a change
  await w.ok(["event", "edit", "E1", "--with", "witness:Martin Martinek"]);
  assert.equal((await w.ok(["family", "show", "F1", "--json"])).json.family.events[0].participants.length, 3);
  assert.match((await w.run(["event", "edit", "E1", "--age", "wife:18"])).err, /changing the age of P0002 of E0001 needs --reason/);
  assert.match((await w.run(["event", "edit", "E1", "--house", "22"])).err, /changing the house of E0001 needs --reason/);
  assert.match((await w.run(["event", "edit", "E1", "--age", "27"])).err, /one --age|whose age/);
  await w.ok(["event", "edit", "E1", "--house", "22", "--reason", "re-read: 22"]);
  e = (await w.ok(["family", "show", "F1", "--json"])).json.family.events[0];
  assert.equal(e.house, "22");
  // a participant recorded in the wrong role is taken off and entered again — a change, with its reason
  assert.match((await w.run(["event", "edit", "E1", "--without", "witness:Joseph Urban", "--with", "officiant:Joseph Urban"])).err, /changing the participants of E0001 needs --reason/);
  assert.match((await w.run(["event", "edit", "E1", "--without", "witness:Jan Dvořák", "--reason", "x"])).err, /E0001 has no witness Jan Dvořák[\s\S]*witness:Martin Martinek/);
  await w.ok(["event", "edit", "E1", "--without", "svědek:JOSEPH URBAN", "--with", "officiant:Joseph Urban", "--reason", "the record names him the second priest"]);
  e = (await w.ok(["family", "show", "F1", "--json"])).json.family.events[0];
  assert.deepEqual(e.participants.map((p: any) => `${p.role}:${p.name}`), ["witness:Martin Martinek", "officiant:Vinzenz Bistrzitzky", "officiant:Joseph Urban"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a decided hypothesis is decided again only with a reason, and the earlier decision is kept", opts, async () => {
  const w = await world();
  await w.ok(["research", "new", "Předci", "--new-person", "Markéta", "--sex", "F"]); // P1
  await w.ok(["hypothesis", "add", "Rodné příjmení Markéty?", "--about", "P1", "--variant", "A: Ševčíková", "--variant", "B: Růžičková"]);
  await w.ok(["hypothesis", "decide", "H1", "--decision", "B) Růžičková — křest syna 1862"]);
  assert.match((await w.run(["hypothesis", "decide", "H1", "--decision", "A) Ševčíková"])).err, /H0001 is already decided: "B\) Růžičková — křest syna 1862"\n→ deciding again needs --reason/);
  await w.ok(["hypothesis", "decide", "H1", "--decision", "A) Ševčíková — oddavky 1839", "--reason", "the marriage entry of 1839 overturns it"]);
  const h = (await w.ok(["hypothesis", "show", "H1", "--json"])).json.hypothesis;
  assert.equal(h.decision, "A) Ševčíková — oddavky 1839");
  assert.match(h.notes.at(-1).text, /^earlier decided: B\) Růžičková — křest syna 1862/);
  w.cleanup();
});

test("search edit: fill in freely, change where it looked or what came out only with a reason", opts, async () => {
  const w = await world();
  await w.ok(["recordset", "add", "Sloup 783", "--kinds", "baptism"]); // B2
  await w.ok(["search", "add", "Křty Víšek 1860–1865", "--recordset", "B1", "--years", "1860-1865", "--method", "page-by-page", "--result", "negative"]); // Q1
  assert.match((await w.ok(["search", "edit", "Q1", "--pages", "95-120", "--surname", "Víšek", "--note", "snímky 101–104 nečitelné"])).out, /Q0001 surnames, pages, note/, "filling in what was not recorded");
  assert.match((await w.run(["search", "edit", "Q1", "--recordset", "B2"])).err, /changing recordsets of Q0001 needs --reason/);
  assert.match((await w.run(["search", "edit", "Q1", "--result", "found"])).err, /changing result of Q0001 needs --reason/);
  assert.match((await w.run(["search", "edit", "Q1", "--result", "found", "--reason", "přehlédnuto"])).err, /result found needs --found/);
  await w.ok(["search", "edit", "Q1", "--recordset", "B2", "--years", "1861-1865", "--reason", "rejstřík patří k druhému svazku"]);
  const q = (await w.ok(["search", "show", "Q1", "--json"])).json.search;
  assert.deepEqual(q.recordsets, ["B0002"]);
  assert.deepEqual(q.scope, { years: "1861-1865", surnames: ["Víšek"], pages: "95-120" });
  assert.equal(q.notes[0].text, "snímky 101–104 nečitelné");
  assert.match((await w.ok(["searched", "B2"])).out, /Q0001/, "the search now counts for the right book");
  assert.equal((await w.run(["search", "edit", "Q1"])).code, 2, "nothing to change");
  await w.ok(["search", "edit", "Q1", "--no-recordset", "--method", "catalog", "--place", "Sloup", "--reason", "hledáno v katalogu archivu, ne v knize"]);
  assert.deepEqual((await w.ok(["search", "show", "Q1", "--json"])).json.search.recordsets, []);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});
