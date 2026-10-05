// A family of one parent from the Strom app (its beta.39: FAM with HUSB or WIFE alone + CHIL, FAMC/FAMS, PEDI): the
// child's tie to that parent is written; a child the research knows as born to other parents is a conflict for the
// user, never a second birth family; the research gives the family back as it is; the other parent added later in the
// app joins the same family — never a second one.

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
// Karel + Marie with their son Jan; Petr with his daughter Eva, her mother unknown
const base = () => [
  ...indi(1, "Karel /Dvořák/", "M", ["1 BIRT", "2 DATE 1870", "1 FAMS @F1@"]),
  ...indi(2, "Marie /Dvořáková/", "F", ["1 FAMS @F1@"]),
  ...indi(3, "Jan /Dvořák/", "M", ["1 BIRT", "2 DATE 1901", "1 FAMC @F1@"]),
  ...indi(4, "Petr /Novák/", "M", ["1 BIRT", "2 DATE 1875", "1 FAMS @F2@"]),
  ...indi(5, "Eva /Nováková/", "F", ["1 BIRT", "2 DATE 1903", "1 FAMC @F2@"]),
];
const families = ["0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "0 @F2@ FAM", "1 HUSB @I4@", "1 CHIL @I5@"];
// the research's IDs on the people it knows (the app keeps them as REFN): I1…I5 → P0001…P0005
const refn = (lines: string[]) => lines.flatMap((l) => {
  const m = /^0 @I(\d+)@ INDI$/.exec(l);
  return m && Number(m[1]) <= 5 ? [l, `1 REFN P000${m[1]}`, "2 TYPE strom-research"] : [l];
});

async function adopted(): Promise<{ w: World; send: (lines: string[]) => string }> {
  const w = new World();
  await w.withTree("Dvořákovi");
  const file = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(file, ged([...head0, ...base(), ...families]));
  await w.ok(["sync", file, "--apply", "--force"]);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  let n = 0;
  const send = (lines: string[]) => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const out = path.join(w.dir, `send-${++n}.ged`);
    fs.writeFileSync(out, ged([...head0, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`, ...refn(lines)]));
    return out;
  };
  return { w, send };
}

type Fam = { id: string; partners: string[]; children: { person: string; relation: string }[] };
const familiesOf = async (w: World) => fs.readdirSync(path.join(w.cwd, "data", "families")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "families", f), "utf8")) as Fam & { retracted?: unknown }).filter((f) => !f.retracted).map((f) => [f.id, f.partners.join("+"), f.children.map((c) => `${c.person}${c.relation === "birth" ? "" : `:${c.relation}`}`).join(" ")]);

test("a family of one parent comes in, goes back to the app as it is, and comes back as no change", opts, async () => {
  const { w, send } = await adopted();
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001+P0002", "P0003"], ["F0002", "P0004", "P0005"]]);
  const out = path.join(w.dir, "app.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  const text = fs.readFileSync(out, "utf8");
  assert.match(text, /0 @F0002@ FAM\n1 HUSB @P0004@\n1 CHIL @P0005@\n/);
  assert.match(text, /0 @P0005@ INDI[\s\S]*?\n1 FAMC @F0002@\n/);
  assert.match(text, /0 @P0004@ INDI[\s\S]*?\n1 FAMS @F0002@\n/);
  assert.deepEqual((await w.ok(["sync", send([...base(), ...families]), "--json"])).json.changes, []);
  w.cleanup();
});

test("the other parent added in the app joins the same family, never a second one", opts, async () => {
  const { w, send } = await adopted();
  // the app: Eva's mother Anna, new, beside Petr in the family that was his alone
  const lines = [...base(), ...indi(6, "Anna /Nováková/", "F", ["1 FAMS @F2@"]), "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "0 @F2@ FAM", "1 HUSB @I4@", "1 WIFE @I6@", "1 CHIL @I5@"];
  const plan = (await w.ok(["sync", send(lines), "--json"])).json.changes as { kind: string; action: string; family?: string }[];
  assert.deepEqual(plan.map((c) => [c.kind, c.action, c.family]), [["person.new", "add", undefined], ["partner.new", "add", "F0002"]], JSON.stringify(plan));
  const input = (await w.ok(["sync", send(lines), "--apply", "--json"])).json.input as string;
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001+P0002", "P0003"], ["F0002", "P0004+P0006", "P0005"]]);
  // taken back: Petr's alone again
  await w.ok(["sync", "undo", input]);
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001+P0002", "P0003"], ["F0002", "P0004", "P0005"]]);
  await w.ok(["sync", send(lines), "--apply"]);
  // the app has her back: sent again with her ID, nothing new
  const again = refn(lines).flatMap((l) => (l === "0 @I6@ INDI" ? [l, "1 REFN P0006", "2 TYPE strom-research"] : [l]));
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const file = path.join(w.dir, "again.ged");
  fs.writeFileSync(file, ged([...head0, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`, ...again]));
  assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, []);
  w.cleanup();
});

test("an existing person as the other parent joins the same family too", opts, async () => {
  const { w, send } = await adopted();
  // Marie named Eva's mother as well: F2 becomes Petr + Marie (the research's F0002, its child kept)
  const lines = [...base(), "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "0 @F2@ FAM", "1 HUSB @I4@", "1 WIFE @I2@", "1 CHIL @I5@"];
  await w.ok(["sync", send(lines), "--apply"]);
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001+P0002", "P0003"], ["F0002", "P0004+P0002", "P0005"]]);
  w.cleanup();
});

test("a child the research knows as born to other parents, given one parent in the app: a conflict, no second birth family", opts, async () => {
  const { w, send } = await adopted();
  // the app: Jan the son of Petr alone (another family of Petr's: F3)
  const lines = [...base(), "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "0 @F2@ FAM", "1 HUSB @I4@", "1 CHIL @I5@", "0 @F3@ FAM", "1 HUSB @I4@", "1 CHIL @I3@"];
  // said in the person's language
  assert.match((await w.ok(["sync", send(lines)], { tty: true })).out, /Jan Dvořák \[P0003\]: dítě — Petr Novák \[P0004\] → rozpor k rozhodnutí \(výzkum má jiné rodiče\)/);
  const r = (await w.ok(["sync", send(lines), "--apply", "--json"])).json;
  assert.equal(r.conflicts.length, 1, JSON.stringify(r));
  assert.deepEqual({ person: r.conflicts[0].person, fact: r.conflicts[0].fact }, { person: "P0003", fact: "FAMC" });
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001+P0002", "P0003"], ["F0002", "P0004", "P0005"]], "Jan's birth family kept, no other");
  // asked once
  assert.deepEqual((await w.ok(["sync", send(lines), "--json"])).json.changes.filter((c: { kind: string }) => c.kind === "child.parents"), []);
  const x = (await w.ok(["conflict", "list", "--json"])).json.conflicts as { id: string; title: string }[];
  assert.deepEqual(x.map((c) => c.title), ["Jan Dvořák: Rodiče — Karel Dvořák & Marie Dvořáková × Petr Novák"]);
  // the user's parents taken: Jan Petr's son in a family of Petr's own — never put with Petr's other child Eva
  const taken = (await w.ok(["conflict", "resolve", x[0]!.id, "--take", "user", "--reasoning", "the register says so"])).out;
  assert.match(taken, /Dítě rodiny Petr Novák: Jan Dvořák/, taken);
  // an agent reads what was written
  const agent = (await w.ok(["conflict", "show", x[0]!.id, "--json"])).json.conflict;
  assert.equal(agent.state, "resolved");
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001+P0002", ""], ["F0002", "P0004", "P0005"], ["F0003", "P0004", "P0003"]]);
  w.cleanup();
});

test("the other parent added in the app to one child of a parent alone: that child moved to the new couple, the sibling stays — no conflict, undone back (found on Mac: a father given one child, a conflict of parents)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const people = [
    ...indi(1, "Marie /Dvořáková/", "F", ["1 FAMS @F1@"]),
    ...indi(2, "Eva /Dvořáková/", "F", ["1 BIRT", "2 DATE 1903", "1 FAMC @F1@"]),
    ...indi(3, "Petr /Dvořák/", "M", ["1 BIRT", "2 DATE 1905", "1 FAMC @F1@"]),
  ];
  const file = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(file, ged([...head0, ...people, "0 @F1@ FAM", "1 WIFE @I1@", "1 CHIL @I2@", "1 CHIL @I3@"]));
  await w.ok(["sync", file, "--apply", "--force"]);
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001", "P0002 P0003"]]);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  // Eva's father Zbyněk added in the app: Marie and Zbyněk a family, Eva theirs; Petr still Marie's alone
  const sent = path.join(w.dir, "send.ged");
  fs.writeFileSync(sent, ged([
    ...head0, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`,
    ...refn(people.map((l, i) => (l === "1 FAMC @F1@" && people[i - 4]?.includes("Eva") ? "1 FAMC @F2@" : l))),
    ...indi(4, "Zbyněk /Dvořák/", "M", ["1 FAMS @F2@"]),
    "0 @F1@ FAM", "1 WIFE @I1@", "1 CHIL @I3@",
    "0 @F2@ FAM", "1 HUSB @I4@", "1 WIFE @I1@", "1 CHIL @I2@",
  ]));
  const plan = (await w.ok(["sync", sent, "--json"])).json.changes as { kind: string; action: string; family?: string; child?: string }[];
  assert.deepEqual(plan.filter((c) => c.kind !== "fact.new").map((c) => [c.kind, c.action, c.family, c.child]), [["person.new", "add", undefined, undefined], ["family.new", "add", undefined, undefined], ["child.moved", "add", "F0001", "P0002"]], JSON.stringify(plan));
  assert.match((await w.ok(["sync", sent], { tty: true })).out, /Eva Dvořáková \[P0002\]: dítě rodičů .*Zbyněk Dvořák.*Marie Dvořáková \[P0001\] — přesun z rodiny jednoho rodiče/);
  const r = (await w.ok(["sync", sent, "--apply", "--json"])).json;
  assert.equal(r.conflicts?.length ?? 0, 0, JSON.stringify(r));
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001", "P0003"], ["F0002", "P0004+P0001", "P0002"]]);
  // the same file again: nothing more
  assert.deepEqual((await w.ok(["sync", sent, "--json"])).json.changes.filter((c: { kind: string }) => c.kind !== "fact.new" && c.kind !== "person.new"), []);
  await w.ok(["sync", "undo", r.input]);
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001", "P0002 P0003"]]);
  w.cleanup();
});

test("a child adopted in the app (PEDI adopted) by one parent is written beside the birth family, no conflict", opts, async () => {
  const { w, send } = await adopted();
  const lines = [
    ...base().flatMap((l, i, all) => (l === "1 FAMC @F1@" ? [l, "1 FAMC @F3@", "2 PEDI adopted"] : [l])),
    ...families,
    "0 @F3@ FAM", "1 HUSB @I4@", "1 CHIL @I3@",
  ];
  const r = (await w.ok(["sync", send(lines), "--apply", "--json"])).json;
  assert.equal(r.conflicts?.length ?? 0, 0, JSON.stringify(r));
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001+P0002", "P0003"], ["F0002", "P0004", "P0005"], ["F0003", "P0004", "P0003:adopted"]]);
  w.cleanup();
});

// the app took Marie from Jan's family (the couple's link only: she stays in the tree)
const withoutMarie = () => [...base().map((l) => (l === "1 FAMS @F1@" ? "" : l)).filter(Boolean), "0 @F1@ FAM", "1 HUSB @I1@", "1 CHIL @I3@", "0 @F2@ FAM", "1 HUSB @I4@", "1 CHIL @I5@"];

test("a parent taken from the family in the app: said, the family kept as it is, nothing written beside it", opts, async () => {
  const { w, send } = await adopted();
  const plan = (await w.ok(["sync", send(withoutMarie()), "--json"])).json.changes as { kind: string; action: string; family?: string; person?: string }[];
  assert.deepEqual(plan.map((c) => [c.kind, c.action, c.family, c.person]), [["partner.gone", "report", "F0001", "P0002"]], JSON.stringify(plan));
  const r = (await w.ok(["sync", send(withoutMarie()), "--apply", "--json"])).json;
  assert.deepEqual(r.skipped ?? [], []);
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001+P0002", "P0003"], ["F0002", "P0004", "P0005"]]);
  w.cleanup();
});

test("an archive mirrors it: the parent taken from the family, back on undo", opts, async () => {
  const { w, send } = await adopted();
  await w.ok(["mode", "archive"], { tty: true });
  const r = (await w.ok(["sync", send(withoutMarie()), "--apply", "--json"])).json;
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001", "P0003"], ["F0002", "P0004", "P0005"]]);
  await w.ok(["sync", "undo", r.input]);
  assert.deepEqual(await familiesOf(w), [["F0001", "P0001+P0002", "P0003"], ["F0002", "P0004", "P0005"]]);
  w.cleanup();
});

test("the app's JSON: a child of one parent (parentIds, no couple holding the tie) is that parent's family", opts, async () => {
  const { w } = await adopted();
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const person = (x: string, first: string, last: string, gender: string, refn: string | undefined, parentIds: string[] = []) => ({ id: x, firstName: first, lastName: last, gender, ...(refn ? { refn, refnType: "strom-research" } : {}), parentIds, birthDate: refn === "P0005" ? "1903" : undefined });
  const app = {
    version: 10,
    research: { id },
    persons: {
      a: person("a", "Karel", "Dvořák", "male", "P0001"),
      b: person("b", "Marie", "Dvořáková", "female", "P0002"),
      c: person("c", "Jan", "Dvořák", "male", "P0003", ["a", "b"]),
      d: person("d", "Petr", "Novák", "male", "P0004"),
      e: person("e", "Eva", "Nováková", "female", "P0005", ["d"]),
      f: person("f", "Josef", "Novák", "male", undefined, ["d"]),
    },
    partnerships: { u: { person1Id: "a", person2Id: "b", childIds: ["c"] } },
  };
  const file = path.join(w.dir, "strom.json");
  fs.writeFileSync(file, JSON.stringify(app));
  const plan = (await w.ok(["sync", file, "--json"])).json.changes as { kind: string; family?: string; child?: string }[];
  assert.deepEqual(plan.filter((c) => c.kind !== "fact.new").map((c) => [c.kind, c.family, c.child]), [["person.new", undefined, undefined], ["child.new", "F0002", "x:f"]], JSON.stringify(plan));
  w.cleanup();
});

test("parents who are no couple (_STROM_NO_COUPLE): said to an app that knows it — a family of one parent, two the app sent so — never to one that does not", opts, async () => {
  const { w, send } = await adopted();
  const out = path.join(w.dir, "app.ged");
  const exported = async () => {
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
    return fs.readFileSync(out, "utf8");
  };
  // stromapp.info older than the release that reads it: nothing
  await w.ok(["config", "set", "strom.version", "3.8.2"]);
  assert.doesNotMatch(await exported(), /_STROM_NO_COUPLE/);
  await w.ok(["config", "unset", "strom.version"]);
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  assert.match(await exported(), /0 @F0002@ FAM\n1 HUSB @P0004@\n1 CHIL @P0005@\n1 _STROM_NO_COUPLE Y\n/);
  assert.match(await exported(), /0 @F0001@ FAM\n1 HUSB @P0001@\n1 WIFE @P0002@\n1 CHIL @P0003@\n0 /, "a couple: nothing");
  // the app gives Eva her mother Anna, the two no couple: the same family, kept so
  const lines = [...base(), ...indi(6, "Anna /Nováková/", "F", ["1 FAMS @F2@"]), "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "0 @F2@ FAM", "1 HUSB @I4@", "1 WIFE @I6@", "1 CHIL @I5@", "1 _STROM_NO_COUPLE Y"];
  await w.ok(["sync", send(lines), "--apply"]);
  assert.deepEqual((await familiesOf(w))[1], ["F0002", "P0004+P0006", "P0005"]);
  assert.match(await exported(), /0 @F0002@ FAM\n1 HUSB @P0004@\n1 WIFE @P0006@\n1 CHIL @P0005@\n1 _STROM_NO_COUPLE Y\n/);
  // a new family of two parents who are no couple: kept so too
  const two = [...lines, ...indi(7, "Tomáš /Dvořák/", "M", ["1 FAMC @F3@"]), "0 @F3@ FAM", "1 HUSB @I1@", "1 WIFE @I6@", "1 CHIL @I7@", "1 _STROM_NO_COUPLE Y"];
  await w.ok(["sync", send(two), "--apply"]);
  assert.match(await exported(), /0 @F0003@ FAM\n1 HUSB @P0001@\n1 WIFE @P0006@\n1 CHIL @P0007@\n1 _STROM_NO_COUPLE Y\n/);
  const { appKnowsNoCouple, APP_KNOWS_NO_COUPLE } = await import("../../src/core/stromapp.ts");
  const { Settings } = await import("../../src/core/config.ts");
  const prod = new Settings({ ...w.env, STROM_APP_URL: "https://stromapp.info/run/" }, {});
  assert.equal(appKnowsNoCouple(prod, "3.8.2"), false, "an older app: nothing");
  assert.equal(appKnowsNoCouple(prod), APP_KNOWS_NO_COUPLE !== undefined, "an app of unknown version: today's, once released");
  w.cleanup();
});

test("a \"?\" family married in the app keeps its union whatever its children: the app writes no MARR for a \"?\" of one child (married to itself), and nothing in the file takes nothing away (found on Mac: F0001 lost married when given a child)", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  // Petr married to somebody unknown, no child yet (the app writes its MARR)
  const people = (kids: number) => [
    ...indi(4, "Petr /Novák/", "M", ["1 BIRT", "2 DATE 1875", "1 FAMS @F2@"]),
    ...indi(5, "Eva /Nováková/", "F", ["1 BIRT", "2 DATE 1903", ...(kids >= 1 ? ["1 FAMC @F2@"] : [])]),
    ...(kids >= 2 ? indi(6, "Josef /Novák/", "M", ["1 BIRT", "2 DATE 1905", "1 FAMC @F2@"]) : []),
  ];
  const fam = (kids: number) => ["0 @F2@ FAM", "1 HUSB @I4@", ...(kids >= 1 ? ["1 CHIL @I5@"] : []), ...(kids >= 2 ? ["1 CHIL @I6@"] : []), ...(kids === 1 ? [] : ["1 MARR"])];
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...people(0), ...fam(0)]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const union = () => {
    const dir = path.join(w.cwd, "data", "families");
    const fs0 = fs.readdirSync(dir).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Fam & { union?: string; retracted?: unknown }).filter((f) => !f.retracted && f.partners.join("+") === "P0001");
    assert.equal(fs0.length, 1, JSON.stringify(fs0));
    return fs0[0]!.union;
  };
  assert.equal(union(), "married");
  let n = 0;
  for (const kids of [0, 1, 1, 2]) {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const ids = (lines: string[]) => lines.flatMap((l) => {
      const m = /^0 @I(\d+)@ INDI$/.exec(l);
      const known: Record<string, string> = { "4": "P0001", "5": "P0002" };
      return m && known[m[1]!] ? [l, `1 REFN ${known[m[1]!]}`, "2 TYPE strom-research"] : [l];
    });
    const out = path.join(w.dir, `send-${++n}.ged`);
    fs.writeFileSync(out, ged([...head0, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`, ...ids(people(kids)), ...fam(kids)]));
    await w.ok(["sync", out, "--apply"]);
    assert.equal(union(), "married", `after a send with ${kids} ${kids === 1 ? "child" : "children"}`);
  }
  w.cleanup();
});
