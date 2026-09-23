// A family as the records show it: the partner found later, a child that is
// the wife's own and the husband's stepchild, a person linked by mistake.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";

const opts = { skip: !hasGit };

test("family edit: the partner found later, a stepchild of one parent, a wrong link", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]); // P2
  await w.ok(["person", "add", "Josef /Dvořák/", "--sex", "M"]); // P3
  await w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]); // P4
  await w.ok(["family", "add", "--partner", "P2", "--child", "P1", "--child", "P4"]); // F1: the mother and her son

  assert.match((await w.ok(["family", "edit", "F1", "--partner", "P3"])).out, /F0001 \+partner P0003/);
  assert.equal((await w.run(["family", "edit", "F1", "--child", "P1", "--relation", "step", "--parent", "P3"])).code, 2, "a reason is needed");
  const step = await w.ok(["family", "edit", "F1", "--child", "P1", "--relation", "step", "--parent", "Josef Dvořák", "--reason", "the baptism names Josef as stepfather"]);
  assert.match(step.out, /F0001 P0001 step of P0003/);
  const f = readJsonFile(path.join(w.cwd, "data", "families", "F0001.json"));
  assert.deepEqual(f.children[0], { person: "P0001", relation: "birth", relations: { P0003: "step" } });
  // parents: the mother only; the stepfather is no ancestor
  const show = await w.ok(["person", "show", "P1", "--json"]);
  assert.deepEqual(show.json.parentFamilies[0].partners, ["P0002", "P0003"]);
  assert.match((await w.ok(["person", "show", "P1"])).out, /parents  F0001: P0002 Marie Nováková & P0003 Josef Dvořák \[step\]/);
  assert.match((await w.ok(["family", "show", "F1"])).out, /Jan Novák \[step of P0003\]/);
  const research = (await w.ok(["research", "show", "G1", "--json"])).json;
  assert.ok(!JSON.stringify(research).includes("P0003"), "a stepfather is not an ancestor");

  // the GEDCOM: _FREL/_MREL for Strom and other programs, a note in strict mode
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.match(ged, /1 CHIL @P0001@\n2 _FREL Step\n2 _MREL Natural\n/);
  assert.match(ged, /1 CHIL @P0004@\n(?!2 _)/, "a child of both keeps no per-parent tags");
  assert.deepEqual(validateGedcom(ged).filter((x) => x.level === "error"), []);
  const strict = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.ok(!strict.includes("_FREL"));
  assert.match(strict, /1 NOTE Jan Novák — Josef Dvořák: (stepchild|nevlastní dítě), Marie Nováková: (own child|vlastní dítě)/);
  assert.deepEqual(validateGedcom(strict, { strict: true }).filter((x) => x.level === "error"), []);

  // back to both, then a wrong link removed
  await w.ok(["family", "edit", "F1", "--child", "P1", "--relation", "birth", "--parent", "P3", "--reason", "re-read: own father"]);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "families", "F0001.json")).children[0].relations, undefined);
  await w.ok(["family", "edit", "F1", "--remove", "P4", "--reason", "Karel belongs to another Marie"]);
  assert.deepEqual(readJsonFile(path.join(w.cwd, "data", "families", "F0001.json")).children.map((c: any) => c.person), ["P0001"]);
  assert.match((await w.run(["family", "edit", "F1", "--partner", "P4"])).err, /F0001 has two partners/);
  assert.match((await w.run(["family", "edit", "F1", "--partner", "P2"])).err, /P0002 is already in F0001/);
  assert.match((await w.run(["family", "edit", "F1", "--child", "P1", "--relation", "step", "--parent", "P1", "--reason", "x"])).err, /not a partner/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a foreign tree with _FREL/_MREL keeps the relation to each parent", opts, async () => {
  const w = new World();
  await w.withTree();
  const ged = [
    "0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
    "0 @I1@ INDI", "1 NAME Josef /Dvořák/", "1 SEX M",
    "0 @I2@ INDI", "1 NAME Marie /Nováková/", "1 SEX F",
    "0 @I3@ INDI", "1 NAME Jan /Novák/", "1 SEX M",
    "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "2 _FREL Step", "2 _MREL Natural",
    "0 TRLR",
  ].join("\n");
  fs.writeFileSync(path.join(w.dir, "rodokmen.ged"), ged + "\n");
  await w.ok(["intake", path.join(w.dir, "rodokmen.ged")]);
  const fam = fs.readdirSync(path.join(w.cwd, "data", "families")).map((f) => readJsonFile(path.join(w.cwd, "data", "families", f)))[0];
  assert.equal(fam.children[0].relation, "birth");
  assert.deepEqual(Object.values(fam.children[0].relations), ["step"]);
  w.cleanup();
});
