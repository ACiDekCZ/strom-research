// A census sheet as a reader reads it (spec 106 K3.1): the report of one real reading of a made-up bilingual sheet of
// 1890 (test/fixtures/readings/census-household-reader.md, Claude Code, one reader) — what strom does with what a reader
// writes, not with what a test wishes it wrote. The reader gives a list, the relation to the head in its own words
// ("manželka přednosty", "přednosta domácnosti, otec", "čeledín v domácnosti"), the age as written; the household is
// recorded from it with strom census add: each relation the fixed word where it is one, else as written (nothing lost).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { checkEntry, parseDocReport, type DocPerson } from "../../src/core/document.ts";
import { householdRoleOf } from "../../src/core/household.ts";
import { readingKind } from "../../src/core/readsync.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import type { Event, Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const FIXTURE = path.join(import.meta.dirname, "..", "fixtures", "readings", "census-household-reader.md");

function reading() {
  const report = parseDocReport(fs.readFileSync(FIXTURE, "utf8"));
  assert.equal(report.entries.length, 1);
  const { entry, checks } = checkEntry(report.entries[0]!, "D1");
  return { report, entry, checks };
}

test("the reader's census sheet: a list (a census source), one entry, every person's name and age in its transcript, the day of the census read", () => {
  const { report, entry, checks } = reading();
  assert.equal(report.doc.kind, "list");
  assert.deepEqual(readingKind({ doc: report.doc } as never), { kind: "census", information: "unknown" });
  assert.deepEqual(checks, []);
  assert.deepEqual(
    entry.persons.map((p) => [p.written, p.sex, p.age]),
    [
      ["Josef Lhoták", "M", "41"],
      ["Marie Lhotáková", "F", "36"],
      ["Anna", "F", "12"],
      ["Václav", "M", "8"],
      ["Kateřina Lhotáková", "F", "70"],
      ["Jan Lhota", "M", "19"],
      ["Petr Lhota", "M", undefined],
    ],
  );
  // the census day stands as a residence of the household; a birthplace column as births with a place alone
  const resi = entry.events.find((e) => e.type === "RESI")!;
  assert.equal(resi.date?.gedcom, "31 DEC 1890");
  assert.ok(entry.events.filter((e) => e.type === "BIRT").every((e) => !e.date && e.place));
});

test("the relations as the reader writes them: the fixed word where one is meant, two relations at once as written", () => {
  const { entry } = reading();
  const role = (p: DocPerson) => householdRoleOf("cs", p.roleText ?? "", p.sex ?? "U");
  assert.deepEqual(
    entry.persons.slice(0, 6).map((p) => [p.roleText, role(p).role, role(p).key]),
    [
      ["přednosta domácnosti, otec", "hlava domácnosti", "head"],
      ["manželka přednosty", "manželka", "wife"],
      ["dcera přednosty", "dcera", "daughter"],
      ["syn přednosty", "syn", "son"],
      ["matka přednosty, výměnkářka", "matka přednosty, výměnkářka", undefined],
      ["čeledín v domácnosti", "čeledín", "farmhand"],
    ],
  );
  // the sheet's own words in its column (the transcript), as an agent may copy them
  assert.deepEqual(
    ["přednosta", "manželka", "dcera", "syn", "výměnkářka, matka", "čeledín"].map((w) => householdRoleOf("cs", w, "U").key),
    ["head", "wife", "daughter", "son", undefined, "farmhand"],
  );
});

test("the relation in other languages and forms: the words after it that say whom it is to, the forms' word of the head; NFD, another script", () => {
  const of = (lang: string, w: string, sex: Person["sex"] = "U") => householdRoleOf(lang, w, sex);
  assert.deepEqual(of("de", "Tochter des Haushaltungsvorstandes"), { role: "Tochter", key: "daughter" });
  assert.deepEqual(of("de", "Haushaltungsvorstand"), { role: "Haushaltsvorstand", key: "head" });
  assert.deepEqual(of("de", "Gattin"), { role: "Ehefrau", key: "wife" });
  assert.deepEqual(of("en", "son of the head"), { role: "son", key: "son" });
  assert.deepEqual(of("en", "Head of the household, father"), { role: "head of household", key: "head" });
  assert.deepEqual(of("pl", "żona głowy rodziny"), { role: "żona", key: "wife" });
  assert.deepEqual(of("cs", "služebná v domácnosti", "F"), { role: "služebná v domácnosti" });
  assert.deepEqual(of("cs", "sluha v domácnosti".normalize("NFD"), "M"), { role: "sluha", key: "servant-m" });
  assert.deepEqual(of("cs", "Manželka Přednosty".normalize("NFD")), { role: "manželka", key: "wife" });
  // the same relation twice is that relation; the words alone are no relation; another script as written
  assert.deepEqual(of("cs", "syn, syn přednosty"), { role: "syn", key: "son" });
  assert.deepEqual(of("cs", "přednosty"), { role: "přednosty" });
  assert.deepEqual(of("cs", "жена главы"), { role: "жена главы" });
});

/** The people of the sheet the tree has (born long ago): the head, his wife, two children, his mother; not the farmhand. */
async function research(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M", "--born", "1849"]); // P0001
  await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F", "--born", "1854"]); // P0002
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F", "--born", "1878"]); // P0003
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1882"]); // P0004
  await w.ok(["person", "add", "Kateřina /Lhotáková/", "--sex", "F", "--born", "1820"]); // P0005
  await w.ok(["source", "add", "Sčítání lidu 1890, Lhota čp. 14", "--kind", "census"]); // S0001
  return w;
}

test("the household recorded from the reader's report: one shared census, each member's relation and age, the farmhand in the note, the head once", opts, async () => {
  const w = await research();
  try {
    const { entry } = reading();
    const inTree: Record<string, string> = { p1: "P0001", p2: "P0002", p3: "P0003", p4: "P0004", p5: "P0005" };
    const members = entry.persons.filter((p) => inTree[p.ref]);
    const farmhand = entry.persons.find((p) => p.ref === "p6")!;
    // the day as strom gives it with the reading (its GEDCOM form), never the reader's "31.12.1890"
    const day = entry.events.find((e) => e.type === "RESI")!.date!.gedcom!;
    const house = /Haus-Nr\.: (\d+)/u.exec(entry.transcript)![1]!;
    const r = await w.ok([
      "census", "add", "--source", "S0001", "--date", day, "--place", "Lhota", "--house", house,
      ...members.flatMap((p) => ["--member", `${inTree[p.ref]}:"${p.roleText}":${p.age}`]),
      "--others", `${farmhand.written}, ${farmhand.roleText}, ${farmhand.age}`,
      "--transcript", entry.transcript, "--json",
    ]);
    const h = r.json.household;
    assert.deepEqual(
      h.copies.map((c: { person: string; role: string; age?: string }) => [c.person, c.role, c.age]),
      [
        ["P0001", "hlava domácnosti", "41y"],
        ["P0002", "manželka", "36y"],
        ["P0003", "dcera", "12y"],
        ["P0004", "syn", "8y"],
        ["P0005", "matka přednosty, výměnkářka", "70y"],
      ],
    );
    const tree = Tree.open(w.cwd, w.env);
    const copies = Object.values(inTree).map((id) => tree.get<Person>(id)!.events.find((e: Event) => e.kind === "CENS")!);
    for (const e of copies) {
      assert.equal(e.share?.id, h.id);
      assert.equal(e.date, "31 DEC 1890");
      assert.equal(e.house, "14");
      assert.match(e.note ?? "", /Jan Lhota, čeledín v domácnosti, 19/u);
      assert.equal(e.citations?.[0]?.quote, entry.transcript);
    }
    // no person made of the farmhand, no birth of the birthplace column
    assert.equal(tree.list<Person>("person").length, 5);
    assert.ok(tree.list<Person>("person").every((p) => p.events.filter((e) => e.kind === "BIRT").length <= 1));
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const t = exportGedcom(tree, { for: "strom", head }).text;
    assert.deepEqual([...t.matchAll(/^3 _ROLE (.*)$/gmu)].map((m) => m[1]!.trim()), ["hlava domácnosti", "manželka", "dcera", "syn", "matka přednosty, výměnkářka"]);
    assert.deepEqual([...t.matchAll(/^2 AGE (.*)$/gmu)].map((m) => m[1]!.trim()), ["41y", "36y", "12y", "8y", "70y"]);
  } finally {
    w.cleanup();
  }
});
