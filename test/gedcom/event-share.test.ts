// A shared event of the Strom app (spec 085): each person's copy of it carries 2 _STROM_SHARE <id> (3 _ROLE the
// person's role as written), a godparent's or a witness's own event 2 _STROM_ROLE <role> (3 _STROM_AT @…@ whose,
// 4 TYPE its tag). strom intake reads them, the research keeps them (an edit, a retraction, a merge) and gives them back
// in the Strom GEDCOM under the same fact — never in the standard one. GEDCOM 7 ROLE under an ASSO and _SHAR of other
// programs come in as participants.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Event, Family, Person } from "../../src/core/model.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { validateRecord } from "../../src/core/validate.ts";
import { editEvent, mergePersons, retractEvent } from "../../src/core/actions.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { gedcomRole, roleAtMark, shareMark } from "../../src/core/roles.ts";
import { phrase } from "../../src/core/phrases.ts";

const opts = { skip: !hasGit };

/** The Strom app's file: a census shared by three people (a maid's role written decomposed), a godparent's own events. */
const APP_GED = [
  "0 HEAD",
  "1 SOUR STROM",
  "2 VERS 3.29.0",
  "1 GEDC",
  "2 VERS 5.5.1",
  "2 FORM LINEAGE-LINKED",
  "1 CHAR UTF-8",
  "0 @I3@ INDI",
  "1 NAME Prokop /Lhoták/",
  "1 SEX M",
  "1 CENS",
  "2 DATE 15 FEB 1921",
  "2 PLAC Lhota pod Dubinou",
  "2 AGE 42y",
  "2 _STROM_SHARE SH7K2QX",
  "2 SOUR @S21@",
  "3 PAGE č. d. 14",
  "1 RESI",
  "2 DATE 1925",
  "2 PLAC Lhota pod Dubinou",
  "2 _STROM_SHARE SH-7K",
  "0 @I4@ INDI",
  "1 NAME Terezie /Lhotáková/",
  "1 SEX F",
  "1 CENS",
  "2 DATE 15 FEB 1921",
  "2 PLAC Lhota pod Dubinou",
  "2 AGE 38y",
  "2 _STROM_SHARE SH7K2QX",
  "2 SOUR @S21@",
  "3 PAGE č. d. 14",
  "0 @I9@ INDI",
  "1 NAME Marie /Lhotová/",
  "1 SEX F",
  "1 CENS",
  "2 DATE 15 FEB 1921",
  "2 PLAC Lhota pod Dubinou",
  "2 AGE 19y",
  "2 _STROM_SHARE SH7K2QX",
  `3 _ROLE ${"služka".normalize("NFD")}`,
  "2 SOUR @S21@",
  "3 PAGE č. d. 14",
  "0 @I5@ INDI",
  "1 NAME Václav /Lhoták/",
  "1 SEX M",
  "1 BAPM",
  "2 DATE 7 MAR 1909",
  "2 PLAC Lhota",
  "0 @I7@ INDI",
  "1 NAME Jakub /Lhota/",
  "1 SEX M",
  "1 EVEN",
  "2 TYPE Kmotrovství",
  "2 DATE 14 MAR 1909",
  "2 PLAC Lhota",
  "2 _STROM_ROLE godparent",
  "3 _STROM_AT @I5@",
  "4 TYPE BAPM",
  "2 SOUR @S21@",
  "3 PAGE fol. 23",
  "1 EVEN",
  "2 TYPE Svědectví",
  "2 DATE 2 JUN 1920",
  "2 PLAC Lhota",
  "2 _STROM_ROLE witness",
  "3 _STROM_AT @F1@",
  "4 TYPE MARR",
  "1 EVEN",
  "2 TYPE Pomoc",
  "2 DATE 1922",
  "2 _STROM_ROLE Helfer",
  "3 _STROM_AT @I99@",
  "4 TYPE CHR",
  "0 @F1@ FAM",
  "1 HUSB @I3@",
  "1 WIFE @I4@",
  "1 CHIL @I5@",
  "1 MARR",
  "2 DATE 2 JUN 1920",
  "2 PLAC Lhota",
  "2 _STROM_SHARE FAMSHARE1",
  "1 EVEN",
  "2 TYPE Svědectví páru",
  "2 DATE 1930",
  "2 _STROM_ROLE witness",
  "3 _STROM_AT @I7@",
  "4 TYPE MARR",
  "0 @S21@ SOUR",
  "1 TITL Sčítání lidu 1921",
  "0 TRLR",
  "",
].join("\n");

async function intake(w: World, name: string, text: string): Promise<Tree> {
  const f = path.join(w.dir, name);
  fs.writeFileSync(f, text);
  await w.ok(["intake", f]);
  return Tree.open(w.cwd, w.env);
}

const person = (tree: Tree, given: string): Person => tree.list<Person>("person").find((p) => p.names[0]!.given === given)!;
const fact = (p: Person | Family, kind: string, label?: string): Event => p.events.find((e) => e.kind === kind && (!label || e.label === label))!;
/** The lines of one record of a GEDCOM (0 @P…@ INDI up to the next record). */
const recordOf = (ged: string, id: string): string => {
  const at = ged.indexOf(`0 @${id}@ `);
  assert.ok(at >= 0, `${id} in the file`);
  const end = ged.indexOf("\n0 ", at + 1);
  return ged.slice(at, end < 0 ? undefined : end + 1);
};

test("the app's shared census of three people and a godparent's own events: read, given back in the Strom GEDCOM line by line, never in the standard one", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const tree = await intake(w, "strom.ged", APP_GED);
    const [prokop, terezie, marie, vaclav, jakub] = ["Prokop", "Terezie", "Marie", "Václav", "Jakub"].map((g) => person(tree, g)) as [Person, Person, Person, Person, Person];
    assert.deepEqual(fact(prokop, "CENS").share, { id: "SH7K2QX" });
    assert.deepEqual(fact(terezie, "CENS").share, { id: "SH7K2QX" });
    assert.deepEqual(fact(marie, "CENS").share, { id: "SH7K2QX", role: "služka" }, "the role as written, composed");
    // an ID that is none: the fact without the mark
    assert.equal(fact(prokop, "RESI").share, undefined);
    assert.equal(fact(prokop, "RESI").date, "1925");
    const family = tree.list<Family>("family").find((f) => f.partners.includes(prokop.id))!;
    assert.deepEqual(fact(jakub, "EVEN", "Kmotrovství").roleAt, { role: "godparent", at: vaclav.id, kind: "BAPM" });
    // a family's event: whose once the families are made
    assert.deepEqual(fact(jakub, "EVEN", "Svědectví").roleAt, { role: "witness", at: family.id, kind: "MARR" });
    // a role not one of ours: other; a person not of the file: the role alone
    assert.deepEqual(fact(jakub, "EVEN", "Pomoc").roleAt, { role: "other", kind: "CHR" });
    // a family: its own role at another's event, never a share (a couple's event is the couple's)
    assert.equal(fact(family, "MARR").share, undefined);
    assert.deepEqual(fact(family, "EVEN").roleAt, { role: "witness", at: jakub.id, kind: "MARR" });
    assert.match((await w.ok(["check"])).out, /^ok/);

    const strom = exportGedcom(tree, { for: "strom" }).text;
    assert.deepEqual(validateGedcom(strom).filter((f) => /_STROM_SHARE|_ROLE|_STROM_ROLE|_STROM_AT/.test(f.message)), []);
    assert.match(recordOf(strom, prokop.id), /\n1 CENS\n2 DATE 15 FEB 1921\n2 PLAC Lhota pod Dubinou\n2 AGE 42y\n2 _STROM_SHARE SH7K2QX\n2 SOUR @S\d+@\n/);
    assert.match(recordOf(strom, terezie.id), /\n2 AGE 38y\n2 _STROM_SHARE SH7K2QX\n2 SOUR @S\d+@\n/);
    assert.match(recordOf(strom, marie.id), /\n2 AGE 19y\n2 _STROM_SHARE SH7K2QX\n3 _ROLE služka\n2 SOUR @S\d+@\n/);
    assert.ok(recordOf(strom, jakub.id).includes(`1 EVEN\n2 TYPE Kmotrovství\n2 DATE 14 MAR 1909\n2 PLAC Lhota\n2 _STROM_ROLE godparent\n3 _STROM_AT @${vaclav.id}@\n4 TYPE BAPM\n2 SOUR @`));
    assert.ok(recordOf(strom, jakub.id).includes(`2 _STROM_ROLE witness\n3 _STROM_AT @${family.id}@\n4 TYPE MARR\n`));
    // whose not known: the role alone, its tag with nothing to stand under
    assert.ok(recordOf(strom, jakub.id).includes("2 DATE 1922\n2 _STROM_ROLE other\n"));
    assert.doesNotMatch(recordOf(strom, jakub.id), /4 TYPE CHR/);
    assert.ok(recordOf(strom, family.id).includes(`2 _STROM_ROLE witness\n3 _STROM_AT @${jakub.id}@\n4 TYPE MARR\n`));
    assert.doesNotMatch(strom, /FAMSHARE1/);

    // the standard GEDCOM: plain facts of each person, a godparent's event an EVEN with its TYPE
    const standard = exportGedcom(tree, { for: "standard" }).text;
    assert.doesNotMatch(standard, /_STROM_SHARE|_STROM_ROLE|_STROM_AT|_ROLE/);
    assert.match(standard, /1 EVEN\n2 TYPE Kmotrovství\n2 DATE 14 MAR 1909\n/);
    assert.equal(standard.match(/1 CENS\n2 DATE 15 FEB 1921\n/g)?.length, 3);

    // a part of the tree: whose not in it, no _STROM_AT (never a pointer to nothing)
    const part = exportGedcom(tree, { for: "strom", persons: new Set([jakub.id, marie.id]) }).text;
    assert.ok(recordOf(part, jakub.id).includes("2 _STROM_ROLE godparent\n2 SOUR @"));
    assert.doesNotMatch(part, /_STROM_AT/);
    assert.match(recordOf(part, marie.id), /2 _STROM_SHARE SH7K2QX\n3 _ROLE služka\n/);
    assert.deepEqual(validateGedcom(part).filter((f) => f.level === "error"), []);

    // and back again: the research's own file read by another research gives the same marks
    const w2 = new World();
    await w2.withTree("Lhotovi");
    try {
      const again = await intake(w2, "back.ged", strom);
      assert.deepEqual(fact(person(again, "Marie"), "CENS").share, { id: "SH7K2QX", role: "služka" });
      assert.deepEqual(fact(person(again, "Jakub"), "EVEN", "Kmotrovství").roleAt, { role: "godparent", at: person(again, "Václav").id, kind: "BAPM" });
    } finally {
      w2.cleanup();
    }
  } finally {
    w.cleanup();
  }
});

test("3 ROLE under _STROM_SHARE is read like 3 _ROLE (any script), and written back as _ROLE", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const ged = APP_GED.replace(`3 _ROLE ${"služka".normalize("NFD")}`, "3 ROLE   горничная  дома");
    const tree = await intake(w, "role.ged", ged);
    const marie = person(tree, "Marie");
    assert.deepEqual(fact(marie, "CENS").share, { id: "SH7K2QX", role: "горничная дома" });
    assert.match(recordOf(exportGedcom(tree, { for: "strom" }).text, marie.id), /2 _STROM_SHARE SH7K2QX\n3 _ROLE горничная дома\n/);
  } finally {
    w.cleanup();
  }
});

test("a fact corrected, taken back or of a person merged keeps its marks; a merge leaves an ID of the app that looks like ours", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    let tree = await intake(w, "strom.ged", APP_GED);
    const prokop = person(tree, "Prokop");
    const cens = fact(prokop, "CENS");
    editEvent(tree, cens.id, { date: "16 FEB 1921", place: "Lhota" }, "the census sheet says the 16th");
    tree = Tree.open(w.cwd, w.env);
    const edited = fact(person(tree, "Prokop"), "CENS");
    assert.equal(edited.date, "16 FEB 1921");
    assert.deepEqual(edited.share, { id: "SH7K2QX" });
    const jakub = person(tree, "Jakub");
    const godp = fact(jakub, "EVEN", "Kmotrovství");
    editEvent(tree, godp.id, { date: "15 MAR 1909" }, "fol. 23 says the 15th");
    retractEvent(tree, fact(person(tree, "Marie"), "CENS").id, "another Marie");
    tree = Tree.open(w.cwd, w.env);
    assert.deepEqual(fact(person(tree, "Jakub"), "EVEN", "Kmotrovství").roleAt, godp.roleAt);
    const retracted = fact(person(tree, "Marie"), "CENS");
    assert.equal(retracted.status, "retracted");
    assert.deepEqual(retracted.share, { id: "SH7K2QX", role: "služka" }, "kept for the history");

    // a merge: the app's ID of a shared event is no reference of ours, though it looks like one
    const a = (await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M", "--json"])).json.person.id as string;
    const b = (await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M", "--json"])).json.person.id as string;
    tree = Tree.open(w.cwd, w.env);
    const terezie = structuredClone(person(tree, "Terezie"));
    fact(terezie, "CENS").share = { id: b };
    tree.put(terezie, { op: "event.update", targets: [terezie.id], summary: "an app's ID like ours" });
    mergePersons(tree, a, b, "the same Josef");
    tree = Tree.open(w.cwd, w.env);
    assert.deepEqual(fact(person(tree, "Terezie"), "CENS").share, { id: b });
    // whose a role was follows a merge (a reference of ours)
    const v2 = (await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--json"])).json.person.id as string;
    tree = Tree.open(w.cwd, w.env);
    const vaclav = person(tree, "Václav");
    mergePersons(tree, v2, vaclav.id, "the same Václav");
    tree = Tree.open(w.cwd, w.env);
    assert.equal(fact(person(tree, "Jakub"), "EVEN", "Kmotrovství").roleAt?.at, v2);
  } finally {
    w.cleanup();
  }
});

test("GEDCOM 7 ROLE under an ASSO and _SHAR of other programs: participants with our roles, the others' words kept", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const ged = [
      "0 HEAD",
      "1 SOUR OTHER_PROGRAM",
      "1 GEDC",
      "2 VERS 5.5.1",
      "1 CHAR UTF-8",
      "0 @I1@ INDI",
      "1 NAME Petr /Lhoták/",
      "1 SEX M",
      "1 BAPM",
      "2 DATE 3 MAR 1850",
      "2 ASSO @I2@",
      "3 ROLE GODP",
      "2 ASSO @I3@",
      "3 ROLE OTHER",
      `4 PHRASE ${"porodní bába".normalize("NFD")}`,
      "2 ASSO @I4@",
      "3 ROLE NGHBR",
      "2 ASSO @I5@",
      "3 RELA Witness",
      "3 ROLE GODP",
      "2 ASSO @VOID@",
      "3 PHRASE Иван Лхотак",
      "3 ROLE WITN",
      "2 ASSO @I6@",
      "3 ROLE OTHER",
      "4 PHRASE kostelník",
      "1 CENS",
      "2 DATE 1880",
      "2 _SHAR @I2@",
      "3 ROLE Witness",
      "2 _SHAR @I4@",
      "3 ROLE Household",
      "2 _SHAR @I77@",
      "3 ROLE Witness",
      "0 @I2@ INDI",
      "1 NAME Jan /Lhota/",
      "0 @I3@ INDI",
      "1 NAME Anna /Lhotová/",
      "0 @I4@ INDI",
      "1 NAME Karel /Lhota/",
      "0 @I5@ INDI",
      "1 NAME Josef /Lhota/",
      "0 @I6@ INDI",
      "1 NAME Matěj /Lhota/",
      "0 @F1@ FAM",
      "1 HUSB @I2@",
      "1 WIFE @I3@",
      "1 MARR",
      "2 DATE 1849",
      "2 ASSO @I4@",
      "3 ROLE CLERGY",
      "2 ASSO @I5@",
      "3 ROLE FRIEND",
      "4 PHRASE kamarád ženicha",
      "0 TRLR",
      "",
    ].join("\n");
    const tree = await intake(w, "other.ged", ged);
    const id = (given: string) => person(tree, given).id;
    const petr = person(tree, "Petr");
    assert.deepEqual(fact(petr, "BAPM").participants, [
      { role: "godparent", person: id("Jan") },
      { role: "midwife", person: id("Anna") },
      { role: "other", person: id("Karel"), note: phrase(tree.config.lang, "role.neighbour") },
      { role: "godparent", person: id("Josef") },
      { role: "witness", name: "Иван Лхотак" },
      { role: "other", person: id("Matěj"), note: "kostelník" },
    ]);
    assert.deepEqual(fact(petr, "CENS").participants, [
      { role: "witness", person: id("Jan") },
      { role: "other", person: id("Karel"), note: "Household" },
    ]);
    const family = tree.list<Family>("family")[0]!;
    assert.deepEqual(fact(family, "MARR").participants, [
      { role: "officiant", person: id("Karel") },
      { role: "other", person: id("Josef"), note: "kamarád ženicha" },
    ]);
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("gedcomRole, shareMark, roleAtMark: the words read the same in import and sync", () => {
  assert.deepEqual(gedcomRole("GODP", undefined, "en"), { role: "godparent" });
  assert.deepEqual(gedcomRole("witn", undefined, "en"), { role: "witness" });
  assert.deepEqual(gedcomRole("CLERGY", undefined, "en"), { role: "officiant" });
  assert.deepEqual(gedcomRole("OFFICIATOR", undefined, "en"), { role: "officiant" });
  assert.deepEqual(gedcomRole("OTHER", "porodní bába".normalize("NFD"), "en"), { role: "midwife" });
  assert.deepEqual(gedcomRole("OTHER", "kostelník", "en"), { role: "other", note: "kostelník" });
  assert.deepEqual(gedcomRole("OTHER", undefined, "en"), { role: "other" });
  assert.deepEqual(gedcomRole("NGHBR", undefined, "en"), { role: "other", note: "neighbour" });
  assert.deepEqual(gedcomRole("NGHBR", undefined, "cs"), { role: "other", note: "soused" });
  assert.deepEqual(gedcomRole("FATH", undefined, "de"), { role: "other", note: "Vater" });
  assert.deepEqual(gedcomRole("Principal", undefined, "cs"), { role: "other", note: "Principal" });
  assert.deepEqual(gedcomRole("Witness", undefined, "cs"), { role: "witness" });
  assert.deepEqual(gedcomRole("Svědek", undefined, "cs"), { role: "witness" });
  assert.equal(gedcomRole("  ", "x", "en"), undefined);
  assert.deepEqual(shareMark("SH7K2QX", "  služka \n domu ".normalize("NFD")), { share: { id: "SH7K2QX", role: "služka domu" } });
  assert.deepEqual(shareMark(" sh1 "), { share: { id: "sh1" } });
  assert.deepEqual(shareMark("SH 7"), { unreadable: "SH 7" });
  assert.deepEqual(shareMark("ščítání"), { unreadable: "ščítání" });
  assert.deepEqual(shareMark("x".repeat(65)), { unreadable: "x".repeat(65) });
  assert.deepEqual(shareMark(""), {});
  assert.deepEqual(roleAtMark("Godparent", "P0005", "bapm"), { role: "godparent", at: "P0005", kind: "BAPM" });
  assert.deepEqual(roleAtMark("kmotr", "S0001", "NOPE"), { role: "other" });
  assert.equal(roleAtMark(""), undefined);
});

test("the model: a share on a person's fact, a role at another's on any; nonsense refused", () => {
  const ev = (more: Partial<Event>): Event => ({ id: "E0001", kind: "CENS", status: "lead", citations: [], ...more }) as Event;
  const person = (e: Event) => ({ id: "P0001", type: "person", names: [{ given: "Jan", surname: "Lhoták" }], sex: "M", events: [e], notes: [], created: "2026-11-13T00:00:00.000Z", updated: "2026-11-13T00:00:00.000Z" });
  const family = (e: Event) => ({ id: "F0001", type: "family", partners: ["P0001", "P0002"], children: [], events: [e], notes: [], created: "2026-11-13T00:00:00.000Z", updated: "2026-11-13T00:00:00.000Z" });
  const paths = (rec: unknown) => validateRecord(rec).map((p) => p.path);
  assert.deepEqual(paths(person(ev({ share: { id: "SH7K2QX", role: "služka" } }))), []);
  assert.deepEqual(paths(person(ev({ kind: "EVEN", label: "Kmotrovství", roleAt: { role: "godparent", at: "P0002", kind: "BAPM" } }))), []);
  assert.deepEqual(paths(person(ev({ roleAt: { role: "witness" } }))), []);
  assert.deepEqual(paths(family(ev({ kind: "EVEN", label: "Svědectví", roleAt: { role: "witness", at: "F0002", kind: "MARR" } }))), []);
  assert.deepEqual(paths(person(ev({ share: { id: "SH 7" } }))), ["events[0].share"]);
  assert.deepEqual(paths(person(ev({ share: { id: "SH7", role: " " } }))), ["events[0].share.role"]);
  assert.deepEqual(paths(family(ev({ kind: "MARR", share: { id: "SH7" } }))), ["events[0].share"]);
  assert.deepEqual(paths(person(ev({ roleAt: { role: "kmotr" as never } }))), ["events[0].roleAt"]);
  assert.deepEqual(paths(person(ev({ roleAt: { role: "godparent", at: "S0001" } }))), ["events[0].roleAt.at"]);
  assert.deepEqual(paths(person(ev({ roleAt: { role: "godparent", kind: "NOPE" } }))), ["events[0].roleAt.kind"]);
});

test("the bridge says it reads, keeps and gives back shared events (feature event.share)", () => {
  assert.ok((BRIDGE_FEATURES as readonly string[]).includes("event.share"));
});
