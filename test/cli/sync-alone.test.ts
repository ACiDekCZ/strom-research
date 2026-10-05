// One partner married to somebody unknown (the Strom app's beta.55: a "?" with no child, written as the family of the
// known partner alone with its MARR, DIV or _STAT): taken in as that partner's family, given back the same, an unedited
// copy no change, its union changed in the app written and undone back, the unknown one named in the app the same
// family; a couple's union MARR/DIV cannot say (partners, separated) kept both ways (found on Mac: "married to ?" lost
// when a tree was handed to the research).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const head0 = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
// Kamil married to somebody unknown; Ota and Věra partners, not married, with their son Petr
const people = (jana: string[] = []) => [
  "0 @I1@ INDI", "1 NAME Kamil /Bez/", "1 SEX M", "1 BIRT", "2 DATE 1880", "1 FAMS @F1@",
  "0 @I2@ INDI", "1 NAME Ota /Šťastný/", "1 SEX M", "1 FAMS @F2@",
  "0 @I3@ INDI", "1 NAME Věra /Šťastná/", "1 SEX F", "1 FAMS @F2@",
  "0 @I4@ INDI", "1 NAME Petr /Šťastný/", "1 SEX M", "1 BIRT", "2 DATE 1912", "1 FAMC @F2@",
  ...jana,
];
const families = (kamil: string[] = ["1 MARR"], husbAndWife: string[] = ["1 HUSB @I1@"]) => [
  "0 @F1@ FAM", ...husbAndWife, ...kamil,
  "0 @F2@ FAM", "1 HUSB @I2@", "1 WIFE @I3@", "1 CHIL @I4@", "1 _STAT Partners",
];
const refn = (lines: string[]) => lines.flatMap((l) => {
  const m = /^0 @I(\d+)@ INDI$/.exec(l);
  return m ? [l, `1 REFN P${m[1]!.padStart(4, "0")}`, "2 TYPE strom-research"] : [l];
});

type Fam = { id: string; partners: string[]; children: { person: string }[]; union?: string; retracted?: unknown };
const familiesOf = (w: World) =>
  fs
    .readdirSync(path.join(w.cwd, "data", "families"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "families", f), "utf8")) as Fam)
    .filter((f) => !f.retracted)
    .map((f) => [f.id, f.partners.join("+"), f.children.map((c) => c.person).join(" "), f.union ?? ""]);

test("one partner married to somebody unknown: taken in as that partner's family, given back the same, an unedited copy no change; the union changed in the app written and undone back; the unknown one named, the same family; a couple of partners kept so", opts, async () => {
  const w = new World();
  await w.withTree("Bezovi");
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...people(), ...families()]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  assert.deepEqual(familiesOf(w), [
    ["F0001", "P0001", "", "married"],
    ["F0002", "P0002+P0003", "P0004", "partners"],
  ]);
  // given back as the app writes it: the partner alone with a bare MARR, nothing of "no couple"; partners as _STAT
  const out = path.join(w.dir, "app.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  const text = fs.readFileSync(out, "utf8");
  assert.match(text, /0 @F0001@ FAM\n1 HUSB @P0001@\n1 MARR\n/);
  assert.doesNotMatch(text, /0 @F0001@ FAM\n(?:[1-9] [^\n]*\n)*1 _STROM_NO_COUPLE/);
  assert.match(text, /0 @F0002@ FAM\n(?:[1-9] [^\n]*\n)*1 _STAT Partners\n/);
  // a standard file: the marriage, no tag of the app's
  const standard = path.join(w.dir, "standard.ged");
  await w.ok(["export", "gedcom", "--for", "standard", "--out", standard]);
  assert.match(fs.readFileSync(standard, "utf8"), /0 @F0001@ FAM\n1 HUSB @P0001@\n1 MARR\n/);
  assert.doesNotMatch(fs.readFileSync(standard, "utf8"), /_STAT/);

  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const send = (lines: string[]) => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const file = path.join(w.dir, `send-${head.slice(0, 7)}-${lines.length}.ged`);
    fs.writeFileSync(file, ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${head}`, ...refn(lines)]));
    return file;
  };
  // the copy the app was given, back unedited: nothing, sent again nothing
  assert.deepEqual((await w.ok(["sync", send([...people(), ...families()]), "--json"])).json.changes, []);

  // divorced in the app: written, said in the research's language, undone back
  const divorced = send([...people(), ...families(["1 MARR", "1 DIV"])]);
  const shown = (await w.ok(["sync", divorced], { tty: true })).out;
  assert.match(shown, /Kamil Bez \[P0001\]: svazek – rozvod → převezme se/, shown);
  const r = (await w.ok(["sync", divorced, "--apply", "--json"])).json;
  assert.equal(familiesOf(w)[0]![3], "divorced");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  assert.match(fs.readFileSync(out, "utf8"), /0 @F0001@ FAM\n1 HUSB @P0001@\n1 MARR\n1 DIV\b/);
  await w.ok(["sync", "undo", r.input]);
  assert.equal(familiesOf(w)[0]![3], "married");

  // the unknown one named in the app: the same family, her the other partner — never a second family
  const jana = ["0 @I5@ INDI", "1 NAME Jana /Bezová/", "1 SEX F", "1 FAMS @F1@"];
  const named = (await w.ok(["sync", send([...people(jana), ...families(["1 MARR"], ["1 HUSB @I1@", "1 WIFE @I5@"])]), "--apply", "--json"])).json;
  assert.deepEqual(named.changes.map((c: { kind: string }) => c.kind).sort(), ["partner.new", "person.new"], JSON.stringify(named.changes));
  assert.deepEqual(familiesOf(w).map((f) => f.slice(0, 2)), [["F0001", "P0001+P0005"], ["F0002", "P0002+P0003"]]);
  w.cleanup();
});

test("one partner married to somebody unknown, and a second marriage beside it: two families, each matched again", opts, async () => {
  const w = new World();
  await w.withTree("Bezovi");
  const jana = ["0 @I5@ INDI", "1 NAME Jana /Bezová/", "1 SEX F", "1 FAMS @F3@"];
  const lines = [...people(jana), ...families(["1 DIV", "1 _STAT Divorced"]), "0 @F3@ FAM", "1 HUSB @I1@", "1 WIFE @I5@", "1 MARR", "2 DATE 1910"];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...lines]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  assert.deepEqual(familiesOf(w).map((f) => [f[1], f[3]]), [["P0001", "divorced"], ["P0002+P0003", "partners"], ["P0001+P0005", ""]]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const again = path.join(w.dir, "again.ged");
  fs.writeFileSync(again, ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${head}`, ...refn(lines)]));
  assert.deepEqual((await w.ok(["sync", again, "--json"])).json.changes, []);
  w.cleanup();
});

test("the app's JSON: a partnership with its \"?\" and no child is the family of the one partner, its status kept", opts, async () => {
  const w = new World();
  await w.withTree("Bezovi");
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const app = {
    version: 11,
    research: { id },
    persons: {
      a: { id: "a", firstName: "Kamil", lastName: "Bez", gender: "male", parentIds: [] },
      q: { id: "q", firstName: "", lastName: "", gender: "female", parentIds: [], isPlaceholder: true },
      b: { id: "b", firstName: "Ota", lastName: "Šťastný", gender: "male", parentIds: [] },
      c: { id: "c", firstName: "Věra", lastName: "Šťastná", gender: "female", parentIds: [] },
    },
    partnerships: {
      u: { person1Id: "a", person2Id: "q", childIds: [], status: "separated" },
      v: { person1Id: "b", person2Id: "c", childIds: [], status: "partners" },
    },
  };
  const file = path.join(w.dir, "app.json");
  fs.writeFileSync(file, JSON.stringify(app));
  await w.ok(["sync", file, "--apply", "--force"]);
  assert.deepEqual(familiesOf(w).map((f) => [f[1], f[3]]), [["P0001", "separated"], ["P0002+P0003", "partners"]]);
  w.cleanup();
});

test("the history names what the Strom app sent as that, never \"material from the family\" with the file's name", opts, async () => {
  const w = new World();
  await w.withTree("Bezovi");
  const sent = path.join(w.dir, "strom-app-0001.ged");
  fs.writeFileSync(sent, ged([...head0, ...people(), ...families()]));
  await w.ok(["sync", sent, "--apply", "--force"]);
  const history = (await w.ok(["history"])).out;
  assert.match(history, /Úpravy poslané z aplikace Strom/, history);
  assert.doesNotMatch(history, /Materiál od rodiny|strom-app-0001/, history);
  w.cleanup();
});

// The "?" of brothers and sisters (the Strom app's beta.56: its "?" family with two children or more sent with its MARR,
// DIV or _STAT; one child's "?" with none, only the child's one parent known): one family with its union, given back
// with it and no "no couple" mark, so the app keeps one "?" for them all (found on Mac: Marta's three children split
// into three families).
const marta = [
  "0 @I1@ INDI", "1 NAME Marta /Svobodová/", "1 SEX F", "1 FAMS @F1@",
  "0 @I2@ INDI", "1 NAME Eva /Svobodová/", "1 SEX F", "1 BIRT", "2 DATE 1901", "1 FAMC @F1@",
  "0 @I3@ INDI", "1 NAME Petr /Svoboda/", "1 SEX M", "1 BIRT", "2 DATE 1903", "1 FAMC @F1@",
  "0 @I4@ INDI", "1 NAME Pavla /Svobodová/", "1 SEX F", "1 BIRT", "2 DATE 1905", "1 FAMC @F1@",
  "0 @I5@ INDI", "1 NAME Kamil /Bez/", "1 SEX M", "1 FAMS @F2@",
  "0 @I6@ INDI", "1 NAME Ota /Bez/", "1 SEX M", "1 BIRT", "2 DATE 1910", "1 FAMC @F2@",
];
const martaFams = (union: string[]) => [
  "0 @F1@ FAM", "1 WIFE @I1@", ...union, "1 CHIL @I2@", "1 CHIL @I3@", "1 CHIL @I4@",
  "0 @F2@ FAM", "1 HUSB @I5@", "1 CHIL @I6@",
];

test("the \"?\" of brothers and sisters sent with its union: one family of the one parent with it, given back with it and no mark of no couple; one child's \"?\" with none stays the one parent's", opts, async () => {
  const w = new World();
  await w.withTree("Svobodovi");
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...marta, ...martaFams(["1 MARR"])]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  assert.deepEqual(familiesOf(w), [["F0001", "P0001", "P0002 P0003 P0004", "married"], ["F0002", "P0005", "P0006", ""]]);
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  const out = path.join(w.dir, "app.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  const text = fs.readFileSync(out, "utf8");
  const fam = (id: string) => /0 @F\d+@ FAM\n(?:[1-9] [^\n]*\n)*/g.exec(text.slice(text.indexOf(`0 @${id}@ FAM`)))![0];
  assert.match(fam("F0001"), /^0 @F0001@ FAM\n1 WIFE @P0001@\n(?:[1-9] [^\n]*\n)*1 MARR\n/, fam("F0001"));
  assert.doesNotMatch(fam("F0001"), /_STROM_NO_COUPLE/);
  assert.match(fam("F0002"), /1 _STROM_NO_COUPLE Y/, fam("F0002"));
  assert.doesNotMatch(fam("F0002"), /MARR/);

  // back unedited: nothing; divorced in the app: written
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const send = (lines: string[]) => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const file = path.join(w.dir, `send-${head.slice(0, 7)}-${lines.length}.ged`);
    fs.writeFileSync(file, ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${head}`, ...refn(lines)]));
    return file;
  };
  assert.deepEqual((await w.ok(["sync", send([...marta, ...martaFams(["1 MARR"])]), "--json"])).json.changes, []);
  await w.ok(["sync", send([...marta, ...martaFams(["1 MARR", "1 DIV"])]), "--apply"]);
  assert.equal(familiesOf(w)[0]![3], "divorced");
  w.cleanup();
});

test("a tree the app gave as the one parent's children (beta.55), its \"?\" sent with the union since (beta.56): the union written, given back with no mark of no couple", opts, async () => {
  const w = new World();
  await w.withTree("Svobodovi");
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...marta, ...martaFams([])]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  assert.equal(familiesOf(w)[0]![3], "");
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const file = path.join(w.dir, "send.ged");
  fs.writeFileSync(file, ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${head}`, ...refn([...marta, ...martaFams(["1 MARR"])])]));
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(r.changes.map((c: { kind: string; action: string }) => `${c.kind} ${c.action}`), ["family.union correct"], JSON.stringify(r.changes));
  assert.equal(familiesOf(w)[0]![3], "married");
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  const out = path.join(w.dir, "app.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  const text = fs.readFileSync(out, "utf8");
  assert.doesNotMatch(text.slice(text.indexOf("0 @F0001@ FAM"), text.indexOf("0 @F0002@ FAM")), /_STROM_NO_COUPLE/);
  assert.match(text.slice(text.indexOf("0 @F0002@ FAM")), /^0 @F0002@ FAM\n1 HUSB @P0005@\n1 CHIL @P0006@\n1 _STROM_NO_COUPLE Y\n/);
  w.cleanup();
});

test("the app's JSON: a \"?\" with children takes its status, one child's married \"?\" is only the child's one parent", opts, async () => {
  const w = new World();
  await w.withTree("Svobodovi");
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const person = (pid: string, firstName: string, gender: string, parentIds: string[] = []) => ({ id: pid, firstName, lastName: "Svoboda", gender, parentIds });
  const app = {
    version: 10,
    research: { id },
    persons: {
      m: person("m", "Marta", "female"),
      q1: { ...person("q1", "", "male"), isPlaceholder: true },
      e: person("e", "Eva", "female", ["m", "q1"]),
      p: person("p", "Petr", "male", ["m", "q1"]),
      k: person("k", "Karel", "male"),
      q2: { ...person("q2", "", "female"), isPlaceholder: true },
      o: person("o", "Ota", "male", ["k", "q2"]),
    },
    partnerships: {
      u: { person1Id: "m", person2Id: "q1", childIds: ["e", "p"], status: "married" },
      v: { person1Id: "k", person2Id: "q2", childIds: ["o"], status: "married" },
    },
  };
  const file = path.join(w.dir, "app.json");
  fs.writeFileSync(file, JSON.stringify(app));
  await w.ok(["sync", file, "--apply", "--force"]);
  assert.deepEqual(familiesOf(w).map((f) => [f[2], f[3]]).sort(), [["P0002 P0003", "married"], ["P0005", ""]].sort((a, b) => a[0]!.localeCompare(b[0]!)));
  w.cleanup();
});
