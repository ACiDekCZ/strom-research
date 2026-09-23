// Duplicates — the same man from an imported tree and from the research —
// are merged, never deleted: everything goes to the record that stays, every
// reference follows, the duplicate remains as "merged into".

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";

const opts = { skip: !hasGit };

test("person and family merge: parents first, then the person; every reference follows", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Antonín /Víšek/", "--sex", "M", "--born", "BET 1811 AND 1812"]); // P1
  await w.ok(["person", "add", "Antonín /Višek/", "--sex", "M", "--born", "1811", "--note", "z importovaného rodokmenu"]); // P2
  await w.ok(["person", "add", "Markéta", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--married", "1839"]); // F1
  await w.ok(["person", "add", "Jakub /Víšek/", "--sex", "M"]); // P4
  await w.ok(["family", "add", "--partner", "P4", "--child", "P1"]); // F2
  await w.ok(["person", "add", "Jakub /Višek/"]); // P5
  await w.ok(["family", "add", "--partner", "P5", "--child", "P2"]); // F3
  await w.ok(["person", "add", "František /Víšek/", "--sex", "M"]); // P6
  await w.ok(["event", "add", "P6", "CHR", "--date", "1862", "--with", "godparent:P2"]);
  await w.ok(["task", "add", "Křest Antonína", "--level", "link", "--where", "Sloup 780", "--why", "a", "--done-when", "b", "--about", "P2"]);

  const refused = await w.run(["person", "merge", "P1", "P2", "--reason", "týž muž"]);
  assert.equal(refused.code, 2);
  assert.match(refused.err, /P0001 and P0002 have different birth parents \(F0002, F0003\)\n→ if they are the same parents, merge the families first: strom family merge F0002 F0003/);
  assert.equal((await w.run(["person", "merge", "P1", "P2"])).code, 2, "a reason is required");

  await w.ok(["person", "merge", "P4", "P5", "--reason", "týž Jakub, otec Antonína"]);
  assert.deepEqual(readJsonFile(path.join(w.cwd, "data", "families", "F0003.json")).partners, ["P0004"]);
  await w.ok(["family", "merge", "F2", "F3", "--reason", "Jakub a jeho syn Antonín, zapsaní dvakrát"]);
  const merged = await w.ok(["person", "merge", "P1", "P2", "--reason", "týž muž: nar. 1811 ve Vavřinci, syn Jakuba"]);
  assert.match(merged.out, /P0002 merged into P0001: 1 fact\(s\), 1 name\(s\)/);
  assert.match(merged.out, /note: P0001 now has BIRT twice — keep the better one/);

  const p1 = (await w.ok(["person", "show", "P1", "--json"])).json;
  assert.deepEqual(p1.person.names.map((n: any) => n.surname), ["Víšek", "Višek"]);
  assert.equal(p1.person.events.filter((e: any) => e.kind === "BIRT").length, 2);
  assert.equal(p1.person.notes[0].text, "z importovaného rodokmenu");
  assert.deepEqual(p1.partnerFamilies.map((f: any) => f.partners), [["P0001", "P0003"]]);
  assert.deepEqual(p1.parentFamilies.map((f: any) => [f.id, f.children.map((c: any) => c.person)]), [["F0002", ["P0001"]]]);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "persons", "P0006.json")).events[0].participants[0].person, "P0001");
  assert.deepEqual(readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json")).subject, ["P0001"]);
  const stub = readJsonFile(path.join(w.cwd, "data", "persons", "P0002.json"));
  assert.deepEqual([stub.mergedInto, stub.events.length], ["P0001", 0]);
  assert.match(stub.retracted.reason, /^merged into P0001: týž muž/);

  const gone = await w.run(["person", "show", "P2"]);
  assert.match(gone.err, /P0002 was merged into P0001\n→ strom person show P0001/);
  assert.equal((await w.run(["family", "show", "F3"])).code, 2);
  assert.doesNotMatch((await w.ok(["person", "list"])).out, /P0002|P0005/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.ok(!ged.includes("@P0002@") && !ged.includes("@F0003@"), "the duplicates are not exported");
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  w.cleanup();
});

test("merge refuses what cannot be one person or one couple", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Jana /Nováková/", "--sex", "F"]); // P2
  await w.ok(["person", "add", "Anna", "--sex", "F"]); // P3
  await w.ok(["person", "add", "Marie", "--sex", "F"]); // P4
  assert.match((await w.run(["person", "merge", "P1", "P2", "--reason", "x"])).err, /P0001 is M, P0002 is F/);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P3"]); // F1
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P4"]); // F2
  assert.match((await w.run(["family", "merge", "F1", "F2", "--reason", "x"])).err, /different couples/);
  assert.match((await w.run(["person", "merge", "P1", "P3", "--reason", "x"])).err, /P0001 is M, P0003 is F/);
  assert.match((await w.run(["person", "merge", "P3", "P3", "--reason", "x"])).err, /the same person/);
  w.cleanup();
});

test("person retract: a person who does not exist leaves the family and the GEDCOM, and is kept", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Anton /Novák/", "--sex", "M"]); // P2 — misread
  await w.ok(["person", "add", "Anna /Nováková/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  assert.equal((await w.run(["person", "retract", "P2"])).code, 2, "a reason is required");
  assert.match((await w.run(["person", "retract", "P1", "--reason", "x"])).err, /focus of G0001/);
  await w.ok(["person", "retract", "P2", "--reason", "misread: the entry names Anna, not Anton"]);
  assert.doesNotMatch((await w.ok(["research", "show", "G1"])).out, /Anton/, "no ancestor any more");
  assert.match((await w.ok(["research", "show", "G1"])).out, /Anna Nováková/);
  assert.doesNotMatch((await w.ok(["person", "list"])).out, /Anton/);
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.ok(!ged.includes("@P0002@"));
  assert.match(ged, /1 WIFE @P0003@\n1 CHIL @P0001@/);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "persons", "P0002.json")).retracted.reason, "misread: the entry names Anna, not Anton");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("an imported tree: the people already researched are pointed out, a wife under her married name too", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Antonín /Víšek/", "--sex", "M", "--born", "BET 1811 AND 1812"]); // P1
  await w.ok(["person", "add", "Jakub /Víšek/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Magdalena /Ševčíková/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  const ged = [
    "0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
    "0 @I1@ INDI", "1 NAME Antonín /Víšek/", "1 SEX M", "1 BIRT", "2 DATE 1812", "1 FAMC @F2@",
    "0 @I6@ INDI", "1 NAME Jakub /Víšek/", "1 SEX M", "1 FAMS @F2@",
    "0 @I7@ INDI", "1 NAME Magdalena /Víšková/", "1 SEX F", "1 FAMS @F2@",
    "0 @I8@ INDI", "1 NAME Antonín /Víšek/", "1 SEX M", "1 BIRT", "2 DATE 1850",
    "0 @F2@ FAM", "1 HUSB @I6@", "1 WIFE @I7@", "1 CHIL @I1@",
    "0 TRLR",
  ].join("\n");
  fs.writeFileSync(path.join(w.dir, "tree.ged"), ged + "\n");
  const intake = await w.ok(["intake", path.join(w.dir, "tree.ged")]);
  assert.match(intake.out, /probably already in the tree: P0004≈P0001, P0005≈P0002, P0006≈P0003/);
  const brief = (await w.ok(["brief", "T1"])).out;
  assert.match(brief, /## Probably already in the tree \(I0001\)/);
  assert.match(brief, /P0006 Magdalena Víšková ≈ P0003 Magdalena Ševčíková → strom person merge P0003 P0006/);
  assert.doesNotMatch(brief, /P0007 Antonín/, "a namesake born 38 years later is not the same man");
  w.cleanup();
});
