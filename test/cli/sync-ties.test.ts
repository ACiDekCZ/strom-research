// How a child is tied to each parent, from the Strom app and back: a stepchild (_FREL/_MREL Step — PEDI has no word
// for it), an adopted and a foster child (PEDI), a child who is one parent's own and the other's stepchild; the app's
// JSON (parentRelTypes) the same. Written as it came, given back so the app reads it, an unedited copy no change; a
// tie changed in the app written to the child the research has (undone back); a word the research has none for said
// (found on Mac: a stepchild lost both ways, nothing said).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const head0 = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
const indi = (n: number, name: string, sex: string, more: string[] = []) => [`0 @I${n}@ INDI`, `1 NAME ${name}`, `1 SEX ${sex}`, ...more];
// Rudolf with his stepdaughter Stáňa; Anna with her adopted Tomáš; Olga with her foster child Filip; Jan and Marie with
// Petr (Marie's own, Jan's stepson) and Eva (theirs)
const people = (eva: string[] = []) => [
  ...indi(1, "Rudolf /Král/", "M", ["1 FAMS @F1@"]),
  ...indi(2, "Stáňa /Králová/", "F", ["1 BIRT", "2 DATE 1910", "1 FAMC @F1@"]),
  ...indi(3, "Anna /Malá/", "F", ["1 FAMS @F2@"]),
  ...indi(4, "Tomáš /Malý/", "M", ["1 BIRT", "2 DATE 1912", "1 FAMC @F2@", "2 PEDI adopted"]),
  ...indi(5, "Olga /Pěstounová/", "F", ["1 FAMS @F3@"]),
  ...indi(6, "Filip /Šťastný/", "M", ["1 BIRT", "2 DATE 1913", "1 FAMC @F3@", "2 PEDI foster"]),
  ...indi(7, "Jan /Dvořák/", "M", ["1 FAMS @F4@"]),
  ...indi(8, "Marie /Dvořáková/", "F", ["1 FAMS @F4@"]),
  ...indi(9, "Petr /Dvořák/", "M", ["1 BIRT", "2 DATE 1905", "1 FAMC @F4@"]),
  ...indi(10, "Eva /Dvořáková/", "F", ["1 BIRT", "2 DATE 1908", "1 FAMC @F4@", ...eva]),
];
const families = (eva: string[] = []) => [
  "0 @F1@ FAM", "1 HUSB @I1@", "1 CHIL @I2@", "2 _FREL Step",
  "0 @F2@ FAM", "1 WIFE @I3@", "1 CHIL @I4@",
  "0 @F3@ FAM", "1 WIFE @I5@", "1 CHIL @I6@",
  "0 @F4@ FAM", "1 HUSB @I7@", "1 WIFE @I8@", "1 CHIL @I9@", "2 _FREL Step", "2 _MREL Natural", "1 CHIL @I10@", ...eva,
];
const refn = (lines: string[]) => lines.flatMap((l) => {
  const m = /^0 @I(\d+)@ INDI$/.exec(l);
  return m ? [l, `1 REFN P${m[1]!.padStart(4, "0")}`, "2 TYPE strom-research"] : [l];
});

type Link = { person: string; relation: string; relations?: Record<string, string> };
type Fam = { id: string; partners: string[]; children: Link[]; retracted?: unknown };
const familiesOf = (w: World) =>
  fs
    .readdirSync(path.join(w.cwd, "data", "families"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "families", f), "utf8")) as Fam)
    .filter((f) => !f.retracted)
    .map((f) => [f.id, f.partners.join("+"), f.children.map((c) => [c.person, c.relation, ...(c.relations ? [c.relations] : [])])]);

test("a stepchild, an adopted and a foster child, one parent's own and the other's stepchild: written, given back as the app reads them, an unedited copy no change; a tie changed in the app written and undone back; a word the research has none for said", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...people(), ...families()]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  assert.deepEqual(familiesOf(w), [
    ["F0001", "P0001", [["P0002", "step"]]],
    ["F0002", "P0003", [["P0004", "adopted"]]],
    ["F0003", "P0005", [["P0006", "foster"]]],
    ["F0004", "P0007+P0008", [["P0009", "birth", { P0007: "step" }], ["P0010", "birth"]]],
  ]);
  // given back so the app reads it: _FREL/_MREL under the child (a stepchild has no PEDI the app reads)
  const out = path.join(w.dir, "app.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  const text = fs.readFileSync(out, "utf8");
  assert.match(text, /0 @F0001@ FAM\n1 HUSB @P0001@\n1 CHIL @P0002@\n2 _FREL Step\n/);
  assert.match(text, /1 CHIL @P0009@\n2 _FREL Step\n2 _MREL Natural\n/);
  assert.match(text, /0 @P0004@ INDI[\s\S]*?1 FAMC @F0002@\n2 PEDI adopted\n/);
  assert.match(text, /0 @P0006@ INDI[\s\S]*?1 FAMC @F0003@\n2 PEDI foster\n/);
  // the copy the app was given, back unedited: nothing
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const send = (lines: string[]) => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const file = path.join(w.dir, `send-${head.slice(0, 7)}.ged`);
    fs.writeFileSync(file, ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${head}`, ...refn(lines)]));
    return file;
  };
  assert.deepEqual((await w.ok(["sync", send([...people(), ...families()]), "--json"])).json.changes, []);
  // Eva Jan's stepdaughter in the app: her tie written, said in the research's language
  const edited = send([...people(), ...families(["2 _FREL Step", "2 _MREL Natural"])]);
  const shown = (await w.ok(["sync", edited], { tty: true })).out;
  assert.match(shown, /Eva Dvořáková \[P0010\]: nevlastní dítě \(Jan Dvořák \[P0007\]\), vlastní dítě \(Marie Dvořáková \[P0008\]\)/, shown);
  const r = (await w.ok(["sync", edited, "--apply", "--json"])).json;
  assert.deepEqual(familiesOf(w)[3], ["F0004", "P0007+P0008", [["P0009", "birth", { P0007: "step" }], ["P0010", "birth", { P0007: "step" }]]]);
  await w.ok(["sync", "undo", r.input]);
  assert.deepEqual(familiesOf(w)[3], ["F0004", "P0007+P0008", [["P0009", "birth", { P0007: "step" }], ["P0010", "birth"]]]);
  // a word the research has none for: said, nothing written
  const odd = (await w.ok(["sync", send([...people(), ...families(["2 _FREL Guardian"])]), "--json"])).json.changes as { kind: string; action: string; text?: string }[];
  assert.deepEqual(odd.map((c) => [c.kind, c.action, c.text]), [["child.relation", "report", "Guardian"]]);
  // a tie the file no longer names (a copy from an export that never gave it): only said, never taken away
  const lost = (await w.ok(["sync", send([...people(), ...families().filter((l) => l !== "2 _FREL Step")]), "--json"])).json.changes as { kind: string; action: string }[];
  assert.deepEqual(lost.map((c) => [c.kind, c.action]), [["child.relation", "report"], ["child.relation", "report"]]);
  w.cleanup();
});

test("the app's JSON: a child's ties to each parent (parentRelTypes) are read the same", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const person = (x: string, first: string, last: string, gender: string, parentIds: string[] = [], parentRelTypes?: Record<string, string>) => ({ id: x, firstName: first, lastName: last, gender, parentIds, ...(parentRelTypes ? { parentRelTypes } : {}) });
  const app = {
    version: 11,
    research: { id },
    persons: {
      a: person("a", "Rudolf", "Král", "male"),
      b: person("b", "Stáňa", "Králová", "female", ["a"], { a: "step" }),
      c: person("c", "Jan", "Dvořák", "male"),
      d: person("d", "Marie", "Dvořáková", "female"),
      e: person("e", "Petr", "Dvořák", "male", ["c", "d"], { c: "step" }),
      f: person("f", "Tomáš", "Malý", "male", ["c", "d"], { c: "adoptive", d: "adoptive" }),
    },
    partnerships: { u: { person1Id: "c", person2Id: "d", childIds: ["e", "f"] } },
  };
  const file = path.join(w.dir, "app.json");
  fs.writeFileSync(file, JSON.stringify(app));
  await w.ok(["sync", file, "--apply", "--force"]);
  const fams = familiesOf(w).map(([, partners, kids]) => [partners, kids]);
  assert.deepEqual(fams, [
    ["P0003+P0004", [["P0005", "birth", { P0003: "step" }], ["P0006", "adopted"]]],
    ["P0001", [["P0002", "step"]]],
  ]);
  w.cleanup();
});
