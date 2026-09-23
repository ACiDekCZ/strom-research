// What a record says about a person's name and about a family itself: a
// grandson's baptism gives the grandmother's maiden name and names her
// parents — people with no fact of their own that could carry the citation.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";

const opts = { skip: !hasGit };

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Antonín /Víšek/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Markéta", "--sex", "F"]); // P2, surname unknown
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  await w.ok(["source", "add", "Křest Františka 1862", "--kind", "baptism", "--information", "primary"]); // S1
  return w;
}

test("name add: the maiden name a record gives completes the name; variants keep their kind and record", opts, async () => {
  const w = await world();
  const r = await w.ok(["name", "add", "P2", "Markéta /Růžičková/", "--kind", "birth", "--cite", "S1", "--locator", "pag. 228", "--quote", "Margaretha, Tochter nach Johann Ružička", "--information", "secondary"]);
  assert.match(r.out, /P0002 name Markéta \/Růžičková\/ \(birth\) ← S0001/);
  let p = (await w.ok(["person", "show", "P2", "--json"])).json.person;
  assert.equal(p.names.length, 1, "the name without a surname is completed, not kept beside it");
  assert.deepEqual(p.names[0].citations, [{ source: "S0001", locator: "pag. 228", quote: "Margaretha, Tochter nach Johann Ružička", information: "secondary" }]);
  assert.equal((await w.run(["name", "add", "P2", "Markéta /Růžičková/", "--kind", "birth"])).code, 2, "the same name again needs a record");
  await w.ok(["name", "add", "Markéta Růžičková", "Markéta /Víšková/", "--kind", "married"]);
  p = (await w.ok(["person", "show", "P2", "--json"])).json.person;
  assert.deepEqual(p.names.map((n: any) => `${n.surname}:${n.kind}`), ["Růžičková:birth", "Víšková:married"]);
  const show = (await w.ok(["person", "show", "P2"])).out;
  assert.match(show, /^P0002 Markéta Růžičková/);
  assert.match(show, /names\n  Markéta Růžičková \(birth\)  ← S0001 pag. 228 \(secondary\)\n  Markéta Víšková \(married\)/);
  assert.equal((await w.run(["name", "add", "P2", "Marie /Víšková/", "--kind", "married", "--primary"])).code, 2);
  // the same words are one name: a weaker record's name becomes an alias with its citation, not a second entry
  await w.ok(["source", "add", "Křest 1862", "--kind", "baptism"]); // S2
  await w.ok(["name", "add", "P2", "Markéta /Víšková/", "--kind", "alias", "--cite", "S2"]);
  p = (await w.ok(["person", "show", "P2", "--json"])).json.person;
  assert.deepEqual(p.names.map((n: any) => `${n.surname}:${n.kind}:${(n.citations ?? []).length}`), ["Růžičková:birth:1", "Víšková:alias:1"]);
  assert.match((await w.ok(["check"])).out, /^ok/, "a name changing its kind is no loss");
  assert.equal((await w.run(["name", "add", "P2", "X /Y/", "--kind", "maiden"])).code, 2);
  w.cleanup();
});

test("a record naming parents: the person's name and the family itself carry the citation", opts, async () => {
  const w = await world();
  const simon = await w.ok(["person", "add", "Šimon /Ševčík/", "--sex", "M", "--cite", "S1", "--locator", "pag. 228", "--information", "secondary"]); // P3
  assert.match(simon.out, /\+P0003 Šimon \/Ševčík\/ ← S0001/);
  await w.ok(["person", "add", "Magdalena", "--sex", "F"]); // P4
  const fam = await w.ok(["family", "add", "--partner", "P3", "--child", "P4", "--cite", "S1", "--locator", "pag. 228", "--information", "secondary"]); // F2
  assert.match(fam.out, /\+F0002 Šimon Ševčík \(1 child\) ← S0001/);
  assert.match((await w.ok(["family", "show", "F2"])).out, /evidence of the family  ← S0001 pag. 228 \(secondary\)/);
  await w.ok(["person", "add", "Anna", "--sex", "F"]); // P5
  assert.match((await w.ok(["family", "child", "F2", "P5", "--cite", "S1", "--locator", "pag. 229"])).out, /F0002 \+child P0005 ← S0001/);
  assert.equal((await w.run(["cite", "F2", "S1", "--locator", "pag. 228"])).code, 2, "the same place twice");
  // a brother from the same entry: the child is new, the citation the family has already
  await w.ok(["person", "add", "Jakub", "--sex", "M"]); // P6
  await w.ok(["family", "child", "F2", "P6", "--cite", "S1", "--locator", "pag. 228"]);
  const f2 = (await w.ok(["family", "show", "F2", "--json"])).json.family;
  assert.deepEqual([f2.children.length, f2.citations.filter((c: any) => c.locator === "pag. 228").length], [3, 1]);
  assert.match((await w.ok(["cite", "P1", "S1", "--locator", "pag. 228"])).out, /P0001 Antonín \/Víšek\/ ← S0001/);
  assert.equal((await w.run(["cite", "P1", "S1", "--status", "proven"])).code, 2, "a name has no status");
  assert.equal((await w.run(["family", "add", "--partner", "P3", "--age", "husband:30"])).code, 2, "an age needs the marriage");
  const src = (await w.ok(["source", "show", "S1"])).out;
  assert.match(src, /P0003 name Šimon Ševčík \(pag. 228\)/);
  assert.match(src, /F0002 the family \(pag. 228\)/);
  assert.match(src, /P0001 name Antonín Víšek \(pag. 228\)/);
  assert.match((await w.ok(["check"])).out, /^ok/);

  await w.ok(["name", "add", "P4", "Magdalena /Ševčíková/", "--kind", "birth"]);
  await w.ok(["name", "add", "P4", "Magdalena /Víšková/", "--kind", "married"]);
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.match(ged, /1 NAME Šimon \/Ševčík\/\n2 SOUR @S0001@\n3 PAGE pag. 228\n3 QUAY 2\n/);
  assert.match(ged, /1 NAME Magdalena \/Ševčíková\/\n2 TYPE birth\n1 NAME Magdalena \/Víšková\/\n2 TYPE married\n/);
  assert.match(ged, /0 @F0002@ FAM\n1 HUSB @P0003@\n1 CHIL @P0004@\n1 CHIL @P0005@\n1 CHIL @P0006@\n1 SOUR @S0001@\n2 PAGE pag. 228\n2 QUAY 2\n1 SOUR @S0001@\n2 PAGE pag. 229\n/);
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  // for Strom (one PAGE per source there): the other page is a source of its own
  const forStrom = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.match(forStrom, /1 SOUR @S0001@\n2 PAGE pag. 228\n2 QUAY 2\n1 SOUR @S0001_2@\n2 PAGE pag. 229\n/);
  assert.match(forStrom, /0 @S0001_2@ SOUR\n1 TITL Křest Františka 1862 \(pag. 229\)\n/);
  assert.deepEqual(validateGedcom(forStrom).filter((f) => f.level === "error"), []);
  const strict = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.deepEqual(validateGedcom(strict, { strict: true }).filter((f) => f.level === "error"), []);
  w.cleanup();
});

test("person edit: sex and the spelling of the name; changing what is known needs a reason", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Jakub /Višek/"]); // P3, sex unknown
  assert.match((await w.ok(["person", "edit", "P3", "--sex", "M"])).out, /P0003 sex M/);
  assert.equal((await w.run(["person", "edit", "P3", "--sex", "F"])).code, 2, "M → F needs a reason");
  await w.ok(["cite", "P3", "S1"]);
  assert.equal((await w.run(["person", "edit", "P3", "--name", "Jakub /Víšek/"])).code, 2, "another name needs a reason");
  await w.ok(["person", "edit", "P3", "--name", "Jakub /Víšek/", "--reason", "misread: the register has Víšek"]);
  const p = (await w.ok(["person", "show", "P3", "--json"])).json.person;
  assert.deepEqual([p.names[0].surname, p.names[0].citations.length, p.sex], ["Víšek", 1, "M"]);
  assert.equal((await w.run(["person", "edit", "P3"])).code, 2, "nothing to change");
  w.cleanup();
});

test("diacritics and scripts: names, roles and ages as a Czech, German or Ukrainian record writes them", opts, async () => {
  const w = await world();
  // a name in Cyrillic is found by its words; Czech words without háčky find Czech names
  await w.ok(["person", "add", "Іван /Шевчук/", "--sex", "M"]); // P3
  assert.match((await w.ok(["person", "list", "шевчук"])).out, /P0003\s+Іван Шевчук/);
  assert.match((await w.ok(["person", "list", "visek"])).out, /P0001\s+Antonín Víšek/);
  assert.equal((await w.ok(["person", "show", "Іван Шевчук", "--json"])).json.person.id, "P0003");
  // roles in the words of the record
  const chr = await w.ok(["event", "add", "P1", "CHR", "--date", "1812", "--with", "kmotr:Franz Dvořáček", "--with", "svědek:Jan Novák", "--with", "Hebamme:M. Anna Bejček", "--with", "oddávající:Alois Wolf", "--json"]);
  assert.deepEqual(chr.json.event.participants.map((p: any) => p.role), ["godparent", "witness", "midwife", "officiant"]);
  assert.match((await w.run(["event", "add", "P1", "BURI", "--with", "soused:Jan"])).err, /invalid role "soused"/);
  // ages of the partners: "muž"/"muz"/"nevěsta" alike
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2", "--married", "1839", "--age", "muz:27", "--age", "nevěsta:22"]);
  const f = (await w.ok(["family", "show", "F2", "--json"])).json.family;
  assert.deepEqual(f.events[0].ages, { P0001: "27y", P0002: "22y" });
  w.cleanup();
});

test("composed and decomposed accents are the same letters: labels, search, the GEDCOM", opts, async () => {
  const w = await world();
  const nfd = (s: string) => s.normalize("NFD");
  // a label written composed, used decomposed (and the other way round)
  const b = await w.ok(["batch", `person add "${nfd("Šimon /Ševčík/")}" --sex M #šimon`, `family child F0001 @${nfd("šimon")}`]);
  assert.match(b.out, /F0001 \+child P0003/);
  assert.equal((await w.ok(["person", "show", "Šimon Ševčík", "--json"])).json.person.id, "P0003");
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.ok(ged.includes("1 NAME Šimon /Ševčík/".normalize("NFC")), "written composed");
  assert.ok(!ged.includes(nfd("Ševčík")));
  w.cleanup();
});

test("records are stored composed; file paths as they are", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Šimon /Ševčík/".normalize("NFD"), "--born-place", "Vavřinec".normalize("NFD")]);
  const raw = fs.readFileSync(path.join(w.cwd, "data", "persons", "P0003.json"), "utf8");
  assert.ok(raw.includes("Ševčík".normalize("NFC")) && raw.includes("Vavřinec".normalize("NFC")));
  assert.ok(!raw.includes("Ševčík".normalize("NFD")));
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a description is not a name: a stillborn child keeps an empty given name, the record's words go to the facts", opts, async () => {
  const w = await world();
  for (const name of ["(mrtvě narozený) /Víšek/", "(mrtvě narozený) /Víšek/".normalize("NFD"), "N.N. /Víšek/", "Totgeboren /Víšek/", "[syn] /Víšek/"]) {
    const r = await w.run(["person", "add", name, "--sex", "M"]);
    assert.equal(r.code, 2, name);
    assert.match(r.err, /not a name/);
  }
  assert.match((await w.run(["person", "add", "(mrtvě narozený) /Víšek/"])).err, /"\/Víšek\/" with an empty given name.*--age stillborn/s);
  await w.ok(["person", "add", "/Víšek/", "--sex", "M"]); // P3
  await w.ok(["event", "add", "P3", "DEAT", "--date", "11 JAN 1889", "--age", "mrtvě narozený"]);
  assert.match((await w.ok(["person", "show", "P3"])).out, /DEAT\s+11 JAN 1889/);
  // names in any script still pass; a description cannot come in through name add or person edit either
  await w.ok(["person", "add", "Іван /Шевчук/", "--sex", "M"]);
  assert.equal((await w.run(["name", "add", "P2", "(dcera) /Ševčíková/"])).code, 2);
  assert.equal((await w.run(["person", "edit", "P2", "--name", "N. N. /Ševčíková/", "--reason", "x"])).code, 2);
  w.cleanup();
});

test("a surname read only in part keeps its sure letters: the person can be found and exported", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Anna /Kr[?]ková/", "--sex", "F"]); // P3
  await w.ok(["name", "add", "P3", "Anna /Krejčková/", "--kind", "alias", "--cite", "S1", "--quote", "Anna Kr[?]kowa"]);
  const found = (await w.ok(["find", "kr[?]kova", "--type", "person", "--json"])).json;
  assert.ok(JSON.stringify(found).includes("P0003"), "found by the part that was read");
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.match(ged, /1 NAME Anna \/Kr\[\?\]ková\//);
  assert.deepEqual(validateGedcom(ged).filter((i) => i.level === "error"), []);
  w.cleanup();
});

test("names: a slash inside a name is refused with a way to write it; the GEDCOM stays valid", opts, async () => {
  const w = await world();
  for (const args of [
    ["person", "add", "Anna /⟨K/Č⟩emenská/", "--sex", "F"],
    ["name", "add", "P2", "Markéta /Ružičková/Růžičková/"],
    ["person", "edit", "P1", "--name", "Antonín /Víšek", "--reason", "x"],
  ]) {
    const r = await w.run(args);
    assert.equal(r.code, 2, args.join(" "));
    assert.match(r.err, /a slash inside a name/);
    assert.match(r.err, /\[\?\]emenská.*--kind alias/s, "the hint says how to write a letter not read for sure");
  }
  await w.ok(["person", "add", "Anna /[?]emenská/", "--sex", "F"]); // P3
  await w.ok(["name", "add", "P3", "Anna /Čemenská/", "--kind", "alias"]);
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.match(ged, /1 NAME Anna \/\[\?\]emenská\//);
  assert.deepEqual(validateGedcom(ged).filter((i) => i.level === "error"), []);
  w.cleanup();
});
