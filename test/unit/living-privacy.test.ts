// The living in a GEDCOM file going out (spec 151): one rule of who is living with the Strom app's outputs — the table
// of cases both share (test/fixtures/living-rule-cases.json, the app's own copy where it is on this computer) — the
// latest year a date may mean, and the file each mode makes of a full one: the dead as they were, the living kept to
// what the mode leaves, the header's mark that keeps the file from ever being taken back as the tree.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { jsonPrivacyOf, latestYear, livingModeOf, livingOf, privacyOf, protectGedcom, rawRecords, treeFilePrivacyOf, yearsOnly } from "../../src/gedcom/privacy.ts";

interface Case {
  id: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  deathDate?: string;
  burialDate?: string;
  retractedDeathDate?: string;
  isDeceased?: boolean;
  events?: { type?: string; date?: string }[];
  parentIds?: string[];
}
interface Cases {
  currentYear: number;
  persons: Case[];
  unions: { id: string; person1Id: string; person2Id: string; startDate?: string; events?: { date?: string }[] }[];
  expect: Record<string, boolean>;
}

/** A flex date of the Strom app as GEDCOM writes it: 1950, ~1915, <1920, >1900, 1910..1930, 1910/1930. */
function gedDate(flex: string): string {
  const s = flex.trim();
  if (s.startsWith("~")) return `ABT ${s.slice(1)}`;
  if (s.startsWith("<")) return `BEF ${s.slice(1)}`;
  if (s.startsWith(">")) return `AFT ${s.slice(1)}`;
  const range = /^(\d{3,4})(?:\.\.|\/)(\d{3,4})$/u.exec(s);
  if (range) return s.includes("..") ? `BET ${range[1]} AND ${range[2]}` : `FROM ${range[1]} TO ${range[2]}`;
  return s;
}

/** The cases as the full GEDCOM of the research has them: a retracted death never in it. */
function asGedcom(c: Cases): string {
  const out = ["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
  const fams: { partners: string[]; date?: string; events: string[]; children: string[] }[] = [];
  for (const u of c.unions) fams.push({ partners: [u.person1Id, u.person2Id], ...(u.startDate ? { date: u.startDate } : {}), events: (u.events ?? []).flatMap((e) => (e.date ? [e.date] : [])), children: [] });
  for (const p of c.persons) {
    if (!p.parentIds?.length) continue;
    const key = [...p.parentIds].sort().join("+");
    let f = fams.find((x) => [...x.partners].sort().join("+") === key);
    if (!f) fams.push((f = { partners: [...p.parentIds], events: [], children: [] }));
    f.children.push(p.id);
  }
  for (const p of c.persons) {
    out.push(`0 @${p.id}@ INDI`, `1 NAME ${p.firstName ?? ""} /${p.lastName ?? ""}/`);
    if (p.birthDate) out.push("1 BIRT", `2 DATE ${gedDate(p.birthDate)}`);
    if (p.deathDate) out.push("1 DEAT", `2 DATE ${gedDate(p.deathDate)}`);
    else if (p.isDeceased) out.push("1 DEAT Y");
    if (p.burialDate) out.push("1 BURI", `2 DATE ${gedDate(p.burialDate)}`);
    for (const e of p.events ?? []) if (e.date) out.push(e.type === "residence" ? "1 RESI" : "1 EVEN", `2 DATE ${gedDate(e.date)}`);
  }
  fams.forEach((f, i) => {
    out.push(`0 @F${i + 1}@ FAM`, ...f.partners.map((id, k) => `1 ${k ? "WIFE" : "HUSB"} @${id}@`), ...f.children.map((id) => `1 CHIL @${id}@`));
    if (f.date) out.push("1 MARR", `2 DATE ${gedDate(f.date)}`);
    for (const d of f.events) out.push("1 EVEN", `2 DATE ${gedDate(d)}`);
  });
  out.push("0 TRLR");
  return `${out.join("\n")}\n`;
}

function judged(c: Cases): Record<string, boolean> {
  const living = livingOf(rawRecords(asGedcom(c)), c.currentYear);
  return Object.fromEntries(Object.keys(c.expect).map((id) => [id, living.has(`@${id}@`)]));
}

const OWN = path.join(import.meta.dirname, "..", "fixtures", "living-rule-cases.json");
const APP = path.join(import.meta.dirname, "..", "..", "..", "strom-beta", "test", "fixtures", "living-rule-cases.json");

test("who is living: the table of cases the Strom app shares, in 2026", () => {
  const c = JSON.parse(fs.readFileSync(OWN, "utf8")) as Cases;
  assert.equal(Object.keys(c.expect).length, 20);
  assert.deepEqual(judged(c), c.expect);
});

// the app's own copy (on the maintainer's computer, beside the research's folder): the same result over it
test("who is living: the Strom app's copy of the table judged the same (only where the app's folder is here)", { skip: !fs.existsSync(APP) }, () => {
  const c = JSON.parse(fs.readFileSync(APP, "utf8")) as Cases;
  assert.deepEqual(judged(c), c.expect);
});

test("the latest year a date may mean: a range by its end, after bounds nothing, a dual year its later one", () => {
  assert.equal(latestYear("12 MAR 1850"), 1850);
  assert.equal(latestYear("ABT 1915"), 1915);
  assert.equal(latestYear("BEF 1920"), 1920);
  assert.equal(latestYear("AFT 1900"), undefined);
  assert.equal(latestYear("BET 1910 AND 1930"), 1930);
  assert.equal(latestYear("FROM 1910 TO 1930"), 1930);
  assert.equal(latestYear("FROM 1910"), 1910);
  assert.equal(latestYear("TO 1930"), 1930);
  assert.equal(latestYear("1700/01"), 1701);
  assert.equal(latestYear("@#DJULIAN@ 1 JAN 1700"), 1700);
  assert.equal(latestYear("(on the day of the fire)"), undefined);
  assert.equal(latestYear(""), undefined);
});

test("a date to its years alone, a qualifier kept", () => {
  assert.equal(yearsOnly("12 MAR 1950"), "1950");
  assert.equal(yearsOnly("ABT JUN 1950"), "ABT 1950");
  assert.equal(yearsOnly("BET 3 JAN 1910 AND 1912"), "BET 1910 AND 1912");
  assert.equal(yearsOnly("INT 1950 (about)"), "1950");
  assert.equal(yearsOnly("(unknown)"), undefined);
});

test("the modes as typed: the app's names too; anything else none", () => {
  assert.equal(livingModeOf("Initials"), "initials");
  assert.equal(livingModeOf("minimal"), "surname");
  assert.equal(livingModeOf("anonymous"), "hidden");
  assert.equal(livingModeOf("omit"), undefined);
  assert.equal(livingModeOf(""), undefined);
});

// a small family: the grandfather dead with his source; his son and the son's wife living, their marriage told; the
// granddaughter living, her address and e-mail — names with diacritics, one decomposed (NFD), one in a non-Latin script
const FAMILY = [
  "0 HEAD",
  "1 SOUR STROM_RESEARCH",
  "2 VERS 1.38.0",
  "1 _STROM_TREE 0123abcd",
  "1 _STROM_HEAD 89ef",
  "1 GEDC",
  "2 VERS 5.5.1",
  "1 CHAR UTF-8",
  "0 @P1@ INDI",
  "1 NAME Čeněk /Lhoták/",
  "1 SEX M",
  "1 BIRT",
  "2 DATE 3 MAR 1890",
  "2 SOUR @S1@",
  "3 PAGE fol. 12",
  "1 DEAT",
  "2 DATE 1960",
  "1 FAMS @F1@",
  "0 @P2@ INDI",
  `1 NAME ${"Ľubomír".normalize("NFD")} /Lhoták/`,
  "1 SEX M",
  "1 BIRT",
  "2 DATE 14 FEB 1950",
  "2 PLAC Lhota",
  "2 SOUR @S2@",
  "1 OCCU učitel",
  "1 NOTE Hraje na housle.",
  "2 CONT Druhý řádek.",
  "1 FAMC @F1@",
  "1 FAMS @F2@",
  "0 @P3@ INDI",
  "1 NAME Věra /Lhotová/",
  "1 NAME Věra /Šťastná/",
  "2 TYPE married",
  "1 SEX F",
  "1 BIRT",
  "2 DATE ABT JUN 1952",
  "1 FAMS @F2@",
  "1 ASSO @P1@",
  "2 RELA godfather",
  "0 @P4@ INDI",
  "1 NAME Ἑλένη /Λοτάκ/",
  "1 SEX F",
  "1 BIRT",
  "2 DATE 1978",
  "1 RESI",
  "2 ADDR Dlouhá 12",
  "1 EMAIL helena@example.org",
  "1 FAMC @F2@",
  "1 ASSO @P3@",
  "2 RELA witness",
  "0 @F1@ FAM",
  "1 HUSB @P1@",
  "1 CHIL @P2@",
  "0 @F2@ FAM",
  "1 HUSB @P2@",
  "1 WIFE @P3@",
  "1 CHIL @P4@",
  "2 _FREL birth",
  "1 MARR",
  "2 DATE 12 JUL 1975",
  "2 PLAC Lhota",
  "1 NOTE Svatba v dešti.",
  "0 @S1@ SOUR",
  "1 TITL Křty Lhota 1880–1900",
  "0 @S2@ SOUR",
  "1 TITL Křty Lhota 1940–1960",
  "0 @S3@ SOUR",
  "1 TITL Nikdo necituje",
  "0 TRLR",
  "",
].join("\n");

const protect = (mode: "initials" | "surname" | "hidden") => {
  const living = livingOf(rawRecords(FAMILY), 2026);
  return protectGedcom(FAMILY, { mode, living, livingLabel: "Žijící osoba" });
};

test("the family's living: the son, his wife and their daughter; the grandfather dead", () => {
  assert.deepEqual([...livingOf(rawRecords(FAMILY), 2026)].sort(), ["@P2@", "@P3@", "@P4@"]);
});

test("each mode keeps the dead and the links as they were, the living to what the mode leaves", () => {
  for (const mode of ["initials", "surname", "hidden"] as const) {
    const { text, living, left } = protect(mode);
    assert.equal(living, 3, mode);
    const count = (re: RegExp) => (text.match(re) ?? []).length;
    assert.equal(count(/^0 @[^@]+@ INDI$/gmu), 4, mode);
    assert.equal(count(/^0 @[^@]+@ FAM$/gmu), 2, mode);
    // the header: the mark, never the tie to the research
    assert.match(text, new RegExp(`^1 _STROM_PRIVACY ${mode}\\n2 _LIVING 3$`, "mu"), mode);
    assert.doesNotMatch(text, /_STROM_TREE|_STROM_HEAD/u, mode);
    assert.deepEqual(privacyOf(text), { mode, living: 3 });
    // the dead as he was, with his source
    assert.match(text, /^0 @P1@ INDI\n1 NAME Čeněk \/Lhoták\/\n1 SEX M\n1 BIRT\n2 DATE 3 MAR 1890\n2 SOUR @S1@\n3 PAGE fol\. 12\n1 DEAT\n2 DATE 1960\n1 FAMS @F1@$/mu, mode);
    assert.match(text, /^0 @S1@ SOUR$/mu, mode);
    // a source only the living cited is gone, one nobody cited stays
    assert.doesNotMatch(text, /@S2@/u, mode);
    assert.match(text, /^0 @S3@ SOUR$/mu, mode);
    // nothing of their lives, nobody pointed at by another's record
    for (const gone of ["učitel", "housle", "Druhý", "Dlouhá", "example.org", "Svatba", "PLAC", "ASSO", "14 FEB", "JUN", "JUL", "Šťastná"]) assert.ok(!text.includes(gone), `${mode}: ${gone}`);
    // the families' structure kept: partners, children, the child's tie, that they married
    assert.match(text, /^0 @F2@ FAM\n1 HUSB @P2@\n1 WIFE @P3@\n1 CHIL @P4@\n2 _FREL birth\n1 MARR/mu, mode);
    assert.match(text, /^1 FAMC @F1@\n1 FAMS @F2@$/mu, mode);
    // facts left out: the son's birth and occupation, his wife's birth, the daughter's birth and home (5) — the years of
    // birth stay as facts of initials
    assert.equal(left.events, mode === "initials" ? 2 : 5, mode);
    assert.equal(left.sources, 1, mode);
    // every line still a line of a GEDCOM: never a broken one
    for (const l of text.split("\n").filter(Boolean)) assert.match(l, /^\d+ (?:@[^@\s]+@ )?[A-Z0-9_]+(?: .*)?$/u, `${mode}: ${l}`);
  }
});

test("initials: a capital with a dot of any script, NFC; the year of birth with its qualifier; the year of the marriage", () => {
  const { text } = protect("initials");
  assert.match(text, /^0 @P2@ INDI\n1 NAME Ľ\. \/L\.\/\n1 SEX M\n1 BIRT\n2 DATE 1950\n1 FAMC @F1@\n1 FAMS @F2@$/mu);
  assert.ok(text.includes("Ľ.".normalize("NFC")) && !text.includes("Ľ"));
  assert.match(text, /^1 NAME V\. \/L\.\/\n1 NAME V\. \/Š\.\/\n2 TYPE married\n1 SEX F\n1 BIRT\n2 DATE ABT 1952$/mu);
  assert.match(text, /^1 NAME Ἑ\. \/Λ\.\/$/mu);
  assert.match(text, /^1 MARR\n2 DATE 1975$/mu);
});

test("surname: the label and the surname alone; hidden: the label alone; neither a year", () => {
  const surname = protect("surname").text;
  assert.match(surname, /^0 @P2@ INDI\n1 NAME Žijící osoba \/Lhoták\/\n1 SEX M\n1 FAMC @F1@\n1 FAMS @F2@$/mu);
  assert.match(surname, /^1 NAME Žijící osoba \/Λοτάκ\/$/mu);
  assert.match(surname, /^1 MARR$/mu);
  assert.doesNotMatch(surname, /1950|1952|1975|1978/u);
  const hidden = protect("hidden").text;
  assert.match(hidden, /^0 @P3@ INDI\n1 NAME Žijící osoba \/\/\n1 SEX F\n1 FAMS @F2@$/mu);
  assert.doesNotMatch(hidden, /Lhoták\/\n1 SEX M\n1 FAMC/u);
  assert.doesNotMatch(hidden, /Lhotová|Λοτάκ|1950|1952|1975|1978/u);
});

test("the mark of a protected file: GEDCOM and JSON; a full one none", () => {
  assert.equal(privacyOf(FAMILY), undefined);
  assert.deepEqual(privacyOf("0 HEAD\n1 _STROM_PRIVACY surname\n2 _LIVING 12\n0 TRLR\n"), { mode: "surname", living: 12 });
  // a mode this strom does not know (a newer one's): protected all the same
  assert.deepEqual(privacyOf("0 HEAD\n1 _STROM_PRIVACY omit\n0 TRLR\n"), { mode: "hidden" });
  assert.equal(privacyOf("0 HEAD\n1 _STROM_PRIVACY full\n0 TRLR\n"), undefined);
  // only the header's: a note of a person saying it is no mark
  assert.equal(privacyOf("0 HEAD\n0 @P1@ INDI\n1 _STROM_PRIVACY initials\n0 TRLR\n"), undefined);
  assert.deepEqual(jsonPrivacyOf({ persons: [], privacy: "initials" }), { mode: "initials" });
  assert.deepEqual(jsonPrivacyOf({ privacy: { mode: "anonymous", living: 3 } }), { mode: "hidden", living: 3 });
  assert.equal(jsonPrivacyOf({ privacy: "full" }), undefined);
  assert.equal(jsonPrivacyOf({ persons: [] }), undefined);
  assert.deepEqual(treeFilePrivacyOf('{"privacy":"minimal"}'), { mode: "surname" });
  assert.deepEqual(treeFilePrivacyOf("﻿0 HEAD\r\n1 _STROM_PRIVACY initials\r\n2 _LIVING 1\r\n0 TRLR\r\n"), { mode: "initials", living: 1 });
});
