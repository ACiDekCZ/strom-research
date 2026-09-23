// Review 2: the evidence behind a fact and what reaches the GEDCOM —
// conclusion vs. evidence quality, ages, the preferred fact, a foreign tree
// that comes in without losing what its author cited.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { normalizeAge, isGedcomAge } from "../../src/core/age.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { parseGedcomText } from "../../src/gedcom/parse.ts";
import { GedWriter } from "../../src/gedcom/lines.ts";

const opts = { skip: !hasGit };

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Josef /Novák/", "--sex", "M", "--born", "ABT 1885"]);
  await w.ok(["source", "add", "Rodokmen od tety", "--kind", "family-tree", "--form", "authored"]); // S1
  await w.ok(["source", "add", "Oddací zápis 1910", "--kind", "marriage", "--form", "original"]); // S2, information unknown
  await w.ok(["source", "add", "Křestní zápis 1885", "--kind", "baptism", "--form", "original", "--information", "primary"]); // S3
  await w.ok(["source", "add", "Index křtů", "--kind", "index", "--form", "derivative", "--information", "secondary"]); // S4
  return w;
}

test("ages as records give them become GEDCOM ages", () => {
  const cases: [string, string | undefined][] = [
    ["27", "27y"], ["27 let", "27y"], ["aged 27 years", "27y"], ["annorum 28", "28y"], ["aetatis 61 annorum", "61y"],
    ["27 let a 3 měsíce", "27y 3m"], ["3 Monate", "3m"], ["2 týdny", "14d"], ["<1y", "<1y"], ["infant", "INFANT"], ["sedm", undefined],
  ];
  for (const [raw, want] of cases) assert.equal(normalizeAge(raw), want, raw);
  assert.ok(isGedcomAge("27y 3m") && !isGedcomAge("27") && !isGedcomAge("27 let"));
});

test("the status may not claim more than the evidence gives", opts, async () => {
  const w = await world();
  // A family tree raises nothing: citing it keeps a lead a lead.
  const lead = (await w.ok(["cite", "E1", "S1", "--json"])).json.event;
  assert.equal(lead.status, "lead");
  const refused = await w.run(["event", "add", "P1", "OCCU", "--value", "rolník", "--cite", "S1", "--status", "probable"]);
  assert.equal(refused.code, 2);
  assert.match(refused.err, /family tree, a memory or a compiled work cannot make a fact probable/);
  // A record makes it probable; proven needs primary information for the fact.
  assert.equal((await w.ok(["cite", "E1", "S2", "--json"])).json.event.status, "probable");
  const noPrimary = await w.run(["event", "add", "P1", "CHR", "--date", "1885", "--cite", "S2", "--status", "proven"]);
  assert.match(noPrimary.err, /proven needs a record written at the time/);
  const ok = await w.ok(["event", "add", "P1", "CHR", "--date", "1885", "--cite", "S2", "--information", "primary", "--status", "proven", "--json"]);
  assert.deepEqual(ok.json.event.citations[0], { source: "S0002", information: "primary" });
  assert.equal((await w.ok(["event", "add", "P1", "BAPM", "--date", "1885", "--cite", "S3", "--status", "proven"])).code, 0);
  w.cleanup();
});

test("QUAY is the quality of each citation's evidence", opts, async () => {
  const w = await world();
  await w.ok(["event", "add", "P1", "OCCU", "--value", "rolník", "--cite", "S1"]); // family tree → 0
  await w.ok(["event", "add", "P1", "CHR", "--date", "1885", "--cite", "S3", "--status", "proven"]); // original primary → 3
  await w.ok(["event", "add", "P1", "RESI", "--place", "Kamenice", "--cite", "S2"]); // original, not assessed → 2
  await w.ok(["event", "add", "P1", "RELI", "--value", "římskokatolické", "--cite", "S4"]); // derivative secondary → 1
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  const quay = (src: string) => new RegExp(`2 SOUR @${src}@\\n(?:3 PAGE .*\\n)?3 QUAY (\\d)`).exec(ged)?.[1];
  assert.deepEqual(["S0001", "S0003", "S0002", "S0004"].map(quay), ["0", "3", "2", "1"]);
  w.cleanup();
});

test("the best-supported fact of a kind is the one readers see first", opts, async () => {
  const w = await world();
  await w.ok(["event", "add", "P1", "BIRT", "--date", "24 JUN 1885", "--cite", "S3", "--status", "proven"]);
  assert.match((await w.ok(["person", "list"])).out, /Josef Novák\s+\*1885/, "the proven date, not ~1885");
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.ok(ged.indexOf("2 DATE 24 JUN 1885") < ged.indexOf("2 DATE ABT 1885"), "the proven birth first");
  w.cleanup();
});

test("ages: of a person at an event, of both partners at a marriage", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Anna /Svobodová/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2", "--married", "1910", "--cite", "S2", "--age", "husband:25 let", "--age", "Anna:22"]);
  const f = readJsonFile(path.join(w.cwd, "data", "families", "F0001.json"));
  assert.deepEqual(f.events[0].ages, { P0001: "25y", P0002: "22y" });
  assert.equal((await w.run(["event", "add", "F1", "DIV", "--date", "1920", "--age", "30"])).code, 2, "whose age?");
  assert.equal((await w.run(["event", "add", "P1", "DEAT", "--age", "sedm"])).code, 2, "an age that cannot be read");
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1955", "--age", "aetatis 70 annorum", "--cite", "S2"]);
  assert.match((await w.ok(["person", "show", "P1"])).out, /DEAT\s+1955\s+age 70y/);
  w.cleanup();
});

test("a literal @ is escaped on writing and decoded on reading", () => {
  const g = new GedWriter();
  g.line(1, "NOTE", "mail: jan@example.cz");
  g.line(1, "FAMC", "@F1@");
  g.text(1, "NOTE", `${"x".repeat(240)}@@@`);
  assert.equal(g.lines[0], "1 NOTE mail: jan@@example.cz");
  assert.equal(g.lines[1], "1 FAMC @F1@");
  for (const l of g.lines.slice(2)) assert.ok(!/(^|[^@])@$/.test(l.replace(/@@/g, "")), `a split between @ and @: ${l}`);
  const parsed = parseGedcomText("0 @I1@ INDI\n1 NOTE mail: jan@@example.cz\n1 FAMC @F1@\n");
  assert.equal(parsed.records[0]!.children[0]!.value, "mail: jan@example.cz");
  assert.equal(parsed.records[0]!.children[1]!.value, "@F1@");
  const bad = validateGedcom("0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NOTE jan@example.cz\n1 BIRT\n2 AGE 27\n0 TRLR");
  assert.ok(bad.some((f) => /literal "@"/.test(f.message)));
  assert.ok(bad.some((f) => /AGE "27" is not a GEDCOM age/.test(f.message)));
});

const FOREIGN = `0 HEAD
1 SOUR OtherProgram
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Anna /Nováková/
2 TYPE married
1 NAME Anna /Dvořáková/
2 TYPE birth
1 SEX F
1 BIRT
2 DATE 3 MAR 1712
2 SOUR @S1@
3 PAGE fol. 12, č. 3
1 EVEN
1 CHR
2 DATE 4 MAR 1712
2 ASSO @I2@
3 RELA Godfather
2 _WITN Marie Černá
3 RELA Hebamme
1 DEAT
2 DATE 1780
2 AGE 68 years
1 FAMS @F1@
0 @I2@ INDI
1 NAME Jan /Černý/
1 SEX M
1 FAMS @F1@
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I1@
1 MARR
2 DATE 1735
2 HUSB
3 AGE 30
2 WIFE
3 AGE 23
0 @S1@ SOUR
1 TITL Matrika Martinice 1690-1760
1 REPO @R1@
2 CALN 1702
0 @R1@ REPO
1 NAME SOA Zámrsk
0 TRLR
`;

test("a foreign tree: nothing breaks the import, and what its author cited is kept", opts, async () => {
  const w = await world();
  const f = path.join(w.dir, "cizi.ged");
  fs.writeFileSync(f, FOREIGN);
  const r = await w.ok(["intake", f]);
  assert.match(r.out, /2 persons, 1 families/);
  const people = (await w.ok(["person", "list", "--json", "--full"])).json.persons;
  const anna = people.find((p: any) => p.names.some((n: any) => n.given === "Anna"));
  assert.equal(anna.names[0].surname, "Dvořáková", "the birth name leads");
  assert.equal(anna.names[1].kind, "married");
  const birth = anna.events.find((e: any) => e.kind === "BIRT");
  assert.equal(birth.citations[0].locator, "I1 BIRT", "no @ in the locator");
  assert.match(birth.note, /source there: Matrika Martinice 1690-1760 · SOA Zámrsk, 1702, fol\. 12, č\. 3/);
  assert.ok(anna.events.some((e: any) => e.kind === "EVEN" && e.label === "EVEN"), "a bare EVEN does not break the import");
  const chr = anna.events.find((e: any) => e.kind === "CHR");
  const jan = people.find((p: any) => p.names[0].given === "Jan");
  assert.deepEqual(chr.participants, [
    { role: "midwife", name: "Marie Černá" },
    { role: "godparent", person: jan.id },
  ]);
  assert.equal(anna.events.find((e: any) => e.kind === "DEAT").age, "68y");
  const fam = readJsonFile(path.join(w.cwd, "data", "families", "F0001.json"));
  assert.deepEqual(fam.events[0].ages, { [jan.id]: "30y", [anna.id]: "23y" });
  w.cleanup();
});

test("a house number is the house, not the place: its own field, ADDR in the GEDCOM, a warning when it sits in the place", opts, async () => {
  const w = await world();
  await w.ok(["event", "add", "P1", "CHR", "--date", "1885", "--place", "Vavřinec", "--house", "13", "--cite", "S3"]);
  assert.match((await w.ok(["person", "show", "P1"])).out, /CHR\s+1885\s+Vavřinec, house 13/);
  await w.ok(["event", "add", "P1", "RESI", "--place", "Vavřinec čp. 13"]);
  const check = await w.ok(["check"]);
  assert.match(check.out, /house-in-place\s+E0003\s+place "Vavřinec čp. 13" holds a house number/);
  assert.match(check.out, /strom event edit E0003 --place "Vavřinec" --house 13/);
  await w.ok(["event", "edit", "E3", "--place", "Vavřinec", "--house", "13", "--reason", "the house number out of the place"]);
  assert.doesNotMatch((await w.ok(["check"])).out, /house-in-place/);
  await w.ok(["export", "gedcom"]);
  const strict = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.match(strict, /1 CHR\n2 DATE 1885\n2 PLAC Vavřinec\n(?:3 .*\n)*2 ADDR (čp\.|House No\.) 13\n3 CITY Vavřinec\n/);
  assert.deepEqual(validateGedcom(strict, { strict: true }).filter((f) => f.level === "error"), []);
  // for Strom: the value on the ADDR line, no CITY; and in the note until Strom reads ADDR
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.match(ged, /2 ADDR (čp\.|House No\.) 13\n(?!3 CITY)/);
  assert.match(ged, /2 NOTE (čp\.|House No\.) 13/);
  w.cleanup();
});
