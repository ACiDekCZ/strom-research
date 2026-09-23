// Inputs: anything the research starts from becomes an unchanged base with
// intake tasks; family trees are imported as leads and matched on return.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { fromFlexDate, importDate } from "../../src/core/import.ts";

const opts = { skip: !hasGit };

const GED = `0 HEAD
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Josef /Novák/
1 SEX M
1 BIRT
2 DATE ABT. 1870
2 PLAC Bělušice
1 OCCU mlynář
1 NOTE @N1@
1 FAMC @F2@
0 @I2@ INDI
1 NAME Václav /Novák/
1 SEX M
1 BIRT
2 DATE c. 1840
1 DEAT
2 DATE po válce
1 FAMS @F2@
0 @F2@ FAM
1 HUSB @I2@
1 CHIL @I1@
1 MARR
2 DATE 1865
0 @N1@ NOTE Podle tety Marie.
0 TRLR
`;

function materials(w: World): string {
  const d = path.join(w.dir, "podklady od rodiny");
  fs.mkdirSync(path.join(d, "skeny"), { recursive: true });
  fs.writeFileSync(path.join(d, "skeny", "rodný list.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
  fs.writeFileSync(path.join(d, "vzpomínky.txt"), "Děda Jan byl mlynář v Týnci.");
  fs.writeFileSync(path.join(d, "teta.ged"), GED);
  fs.writeFileSync(path.join(d, ".DS_Store"), "junk");
  fs.writeFileSync(
    path.join(d, "strom.json"),
    JSON.stringify({ persons: { p_a: { id: "p_a", firstName: "Anna", lastName: "Nováková", gender: "female", birthDate: "~1872", birthPlace: "Týnec" } }, partnerships: {} }),
  );
  return d;
}

test("dates written by other programs", () => {
  assert.equal(importDate("ABT. 1870"), "ABT 1870");
  assert.equal(importDate("c. 1840"), "ABT 1840");
  assert.equal(importDate("1905?"), "1905");
  assert.equal(importDate("po válce"), undefined);
  assert.equal(fromFlexDate("~1872"), "ABT 1872");
  assert.equal(fromFlexDate("<1900-05"), "BEF MAY 1900");
  assert.equal(fromFlexDate("1900-05-03"), "3 MAY 1900");
});

test("intake a folder: every file an input, one task for the folder; hidden files skipped; duplicates skipped", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/"]);
  const d = materials(w);
  const r = (await w.ok(["intake", d, "--text", "Děda byl údajně v legiích", "--json"])).json;
  assert.deepEqual(r.inputs.map((i: any) => [i.kind, i.name]), [
    ["document", "rodný list.jpg"],
    ["tree", "strom.json"],
    ["tree", "teta.ged"],
    ["text", "vzpomínky.txt"],
    ["text", "Děda byl údajně v legiích"],
  ]);
  const i1 = readJsonFile(path.join(w.cwd, "data", "inputs", "I0001.json"));
  assert.ok(fs.existsSync(path.join(w.cwd, i1.file)), "small files are kept in the tree");
  const tasks = (await w.ok(["task", "list", "--level", "intake", "--json", "--full"])).json.tasks;
  // the plain files of the folder share one task; each family tree and the text get their own
  assert.equal(tasks.length, 4);
  assert.ok(tasks.some((t: any) => t.where.join(" ") === "I0001 I0004" && /^Rozebrat soubory – podklady od rodiny: 2 \(I0001–I0004\)$/.test(t.what)), JSON.stringify(tasks.map((t: any) => t.what)));
  assert.equal(tasks[0].research, "G0001");
  const again = (await w.ok(["intake", d, "--json"])).json;
  assert.equal(again.inputs.length, 0);
  assert.equal(again.skipped, 4);
  assert.match((await w.ok(["input", "show", "I4"])).out, /Děda Jan byl mlynář v Týnci\./);
  w.cleanup();
});

test("a GEDCOM tree comes in as leads citing the tree, with references to its IDs", opts, async () => {
  const w = new World();
  await w.withTree();
  const f = path.join(w.dir, "teta.ged");
  fs.writeFileSync(f, GED);
  await w.ok(["intake", f]);
  const people = (await w.ok(["person", "list", "--json", "--full"])).json.persons;
  assert.deepEqual(people.map((p: any) => p.names[0].given), ["Josef", "Václav"]);
  const josef = people[0];
  assert.deepEqual(josef.refs[0].id, "@I1@");
  assert.equal(josef.events.find((e: any) => e.kind === "BIRT").date, "ABT 1870");
  assert.equal(josef.events.find((e: any) => e.kind === "OCCU").value, "mlynář");
  assert.ok(josef.events.every((e: any) => e.status === "lead" && e.citations[0].source === "S0001"));
  assert.deepEqual(josef.notes.map((n: any) => n.text), ["Podle tety Marie."]);
  const vaclav = people[1];
  assert.equal(vaclav.events.find((e: any) => e.kind === "DEAT").note, "date as written: po válce");
  const fam = readJsonFile(path.join(w.cwd, "data", "families", "F0001.json"));
  assert.deepEqual(fam.partners, ["P0002"]);
  assert.deepEqual(fam.children, [{ person: "P0001", relation: "birth" }]);
  const src = readJsonFile(path.join(w.cwd, "data", "sources", "S0001.json"));
  assert.deepEqual([src.kind, src.form, src.input], ["family-tree", "authored", "I0001"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a tree coming back from the Strom app is matched by REFN, not duplicated", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--born", "1905"]);
  await w.ok(["person", "add", "Josef /Novák/"]);
  await w.ok(["family", "add", "--partner", "P2", "--child", "P1"]);
  await w.ok(["export", "gedcom"]);
  const back = path.join(w.dir, "from-strom.ged");
  fs.copyFileSync(path.join(w.cwd, "output", "tree.ged"), back);
  const r = (await w.ok(["intake", back, "--json"])).json;
  assert.equal(r.inputs.length, 1);
  const i = readJsonFile(path.join(w.cwd, "data", "inputs", "I0001.json"));
  assert.deepEqual(i.imported, { persons: 0, families: 0, sources: 1 });
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 2);
  // what the user added in the Strom app comes back as leads on our people — nothing we have is doubled
  let ged = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  ged = ged.replace(/(1 REFN P0001\r?\n)/, "$11 DEAT\n2 DATE 1970\n2 PLAC Týnec\n");
  ged = ged.replace(/(0 @[^@]+@ FAM\r?\n)/, "0 @X1@ INDI\n1 NAME Anna /Nováková/\n1 SEX F\n1 BIRT\n2 DATE 1908\n$1");
  ged = ged.replace(/(0 @([^@]+)@ FAM\r?\n(?:[1-9].*\r?\n)*)/, "$11 CHIL @X1@\n");
  fs.writeFileSync(back, ged);
  const again = await w.ok(["intake", back]);
  assert.match(again.out, /added to what we have \(leads — check them\): P0001: DEAT 1970 · F0001: child P0003/);
  const p1 = (await w.ok(["person", "show", "P1"])).out;
  assert.match(p1, /DEAT\s+1970\s+Týnec\s+\[lead\]/);
  assert.equal(p1.match(/BIRT/g)?.length, 1, "the birth we have is not doubled");
  assert.match((await w.ok(["family", "show", "F1"])).out, /P0003 Anna Nováková/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("--no-import registers a tree without importing it", opts, async () => {
  const w = new World();
  await w.withTree();
  const f = path.join(w.dir, "teta.ged");
  fs.writeFileSync(f, GED);
  await w.ok(["intake", f, "--no-import", "--lang", "en"]);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 0);
  const t = (await w.ok(["task", "show", "T1", "--json"])).json.task;
  assert.equal(t.what, "Read the family tree I0001 (teta.ged), not imported", "no word of an import that did not happen");
  assert.match(t.doneWhen, /strom input skip I0001/);
  await w.ok(["input", "skip", "I1", "--reason", "duplicate of another tree"]);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "inputs", "I0001.json")).state, "skipped");
  w.cleanup();
});

test("a folder full of images is a book of scans: intake refuses it and says where it goes", opts, async () => {
  const w = new World();
  await w.withTree();
  const d = path.join(w.dir, "sloup782");
  fs.mkdirSync(d);
  for (let i = 1; i <= 21; i++) fs.writeFileSync(path.join(d, `s${String(i).padStart(4, "0")}.jpg`), Buffer.from([0xff, 0xd8, i]));
  const r = await w.run(["intake", d]);
  assert.equal(r.code, 2);
  assert.match(r.err, /21 images in .* look like the scans of a book/);
  assert.match(r.err, /strom media add .* --recordset B…/);
  const forced = (await w.ok(["intake", d, "--documents", "--json"])).json;
  assert.equal(forced.inputs.length, 21);
  assert.equal((await w.ok(["task", "list", "--json"])).json.total, 1, "one task for the folder");
  w.cleanup();
});

test("intake --research: the intake tasks go to the research named, not only to the only active one", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Linie Nováků", "--new-person", "Josef /Novák/", "--sex", "M"]); // G1
  await w.ok(["research", "new", "Linie Dvořáků", "--new-person", "Marie /Dvořáková/", "--sex", "F"]); // G2
  const f = path.join(w.dir, "zápisky.txt");
  fs.writeFileSync(f, "Děda Václav byl mlynář v Týnci.\n");
  await w.ok(["intake", f, "--research", "G2"]);
  await w.ok(["intake", "--text", "Babička Anna se narodila v Kolíně"]);
  const tasks = (await w.ok(["task", "list", "--json", "--full"])).json.tasks.filter((t: any) => t.level === "intake");
  assert.deepEqual(tasks.map((t: any) => t.research ?? null), ["G0002", null], "two researches are active: without --research none is guessed");
  assert.match((await w.run(["intake", "--text", "x", "--research", "G9"])).err, /G0009/);
  w.cleanup();
});
