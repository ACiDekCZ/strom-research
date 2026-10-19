// One document read at once (core/document.ts): what a reader is asked, its report read back, nothing filled in
// (K1.2), two readers held against each other — made-up documents only, in any script, NFC or NFD.

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEntry, sameNameWord, compareReadings, docPrompt, gedcomDate, newReadId, parseDocReport, parseRegion, READ_ID, within, wordDiff, words, DOC_NEXT } from "../../src/core/document.ts";

const REPORT = `# Document D20260101120000-ab12 · reader 1

## Document
kind: register.baptism
language: la, de
script: kurrent
legible: partly
why: glare

## Entry e1 · page 1
region: 0.05,0.30,0.90,0.20
transcript: 3. Aprilis 1846 | Joannes filius
  Josephi Novák[?] agricolae | et Mariae Dvořák
translation: 3. dubna 1846 Jan, syn Josefa Nováka[?]
term: agricola = rolník (occupation)
term: lev. = levans, kmotr (abbr)
person: p1 | child | dítě | written=Joannes | given=Jan | sex=M
person: p2 | father | otec | written=Josephi Novák[?] | given=Josef | surname=Novák | sex=M | occupation=agricola
person: p3 | mother | matka | written=Mariae Dvořák | given=Marie | surname=Dvořáková | sex=F
event: BAPM | date=3.4.1846 | place=Lhota | persons=p1:principal,p2:father,p3:mother
relation: parent p2 p1
relation: spouse p2 p3

## Entry e2 · page 2
region: 10,50,80,20
transcript: Anna [...]

## Context
context: Zápis křtu.
${DOC_NEXT}
done: 2 entries
`;

test("a reading's id: D, the time it began, four hex", () => {
  const id = newReadId(new Date("2026-10-19T15:30:12Z"));
  assert.match(id, /^D20261019153012-[0-9a-f]{4}$/);
  assert.ok(READ_ID.test(id));
  assert.ok(!READ_ID.test("D2026-ab12"));
});

test("the report read back: the document, each entry with its lines, the context", () => {
  const r = parseDocReport(REPORT);
  assert.equal(r.done, true);
  assert.deepEqual(r.doc, { kind: "register.baptism", language: ["la", "de"], script: "kurrent", legible: "partly", why: "glare" });
  assert.equal(r.entries.length, 2);
  const [e1, e2] = r.entries;
  assert.equal(e1!.page, 1);
  assert.deepEqual(e1!.region, [0.05, 0.3, 0.9, 0.2]);
  assert.equal(e1!.transcript, "3. Aprilis 1846 | Joannes filius\nJosephi Novák[?] agricolae | et Mariae Dvořák");
  assert.deepEqual(e1!.terms, [
    { term: "agricola", meaning: "rolník", kind: "occupation" },
    { term: "lev.", meaning: "levans, kmotr", kind: "abbr" },
  ]);
  assert.equal(e1!.persons.length, 3);
  assert.deepEqual(e1!.persons[1], { ref: "p2", role: "father", roleText: "otec", fields: { written: "Josephi Novák[?]", given: "Josef", surname: "Novák", sex: "M", occupation: "agricola" } });
  assert.deepEqual(e1!.events[0], { type: "BAPM", fields: { date: "3.4.1846", place: "Lhota", persons: "p1:principal,p2:father,p3:mother" } });
  assert.deepEqual(e1!.relations, [["parent", "p2", "p1"], ["spouse", "p2", "p3"]]);
  // percentages for fractions
  assert.deepEqual(e2!.region, [0.1, 0.5, 0.8, 0.2]);
  assert.equal(r.context, "Zápis křtu.");
});

test("a kind in the reader's own words: the nearest of the list; a region off the page is cut to it", () => {
  assert.equal(parseDocReport("## Document\nkind: Taufbuch\n").doc.kind, "register.baptism");
  assert.equal(parseDocReport("## Document\nkind: náhrobek\n").doc.kind, "gravestone");
  assert.deepEqual(parseRegion("0.5,0.5,0.9,0.9"), [0.5, 0.5, 0.5, 0.5]);
  assert.equal(parseRegion("0.1,0.2"), undefined);
});

test("nothing filled in: a name not in the transcript goes, [?] is uncertain, [...] all through is left out", () => {
  const raw = parseDocReport(`## Entry e1 · page 1
transcript: Joannes filius Josephi Novák[?] | levans Wenceslaus [...] | Mariae Dvořák
person: p1 | child | written=Joannes | given=Jan
person: p2 | father | written=Josephi Novák[?] | given=Josef | surname=Novák
person: p3 | godparent | written=Wenceslaus [...] | given=Václav | surname=Horák
person: p4 | witness | written=Thomas Kral | given=Tomáš | surname=Král
person: p5 | mother | given=Marie
event: BAPM | date=[...].4.1846 | place=Lhota | persons=p1:principal,p4:witness
relation: parent p2 p1
relation: parent p4 p1
`).entries[0]!;
  const { entry, checks } = checkEntry(raw, "e1");
  assert.deepEqual(entry.persons.map((p) => p.ref), ["p1", "p2", "p3"]);
  const [p1, p2, p3] = entry.persons;
  assert.equal(p1!.given, "Jan");
  assert.equal(p1!.uncertain, undefined);
  assert.equal(p2!.written, "Josephi Novák[?]");
  assert.deepEqual(p2!.uncertain, ["surname"]);
  // the surname a reader cannot have read: left out; the given name of other letters: as written, today's a lead
  assert.equal(p3!.given, "Wenceslaus");
  assert.equal(p3!.today, "Václav");
  assert.deepEqual(p3!.uncertain, ["given"]);
  assert.equal(p3!.surname, undefined);
  assert.deepEqual(checks, [
    { entry: "e1", ref: "p3", what: 'surname "Horák"', why: "illegible" },
    { entry: "e1", ref: "p3", what: 'given "Václav" for "Wenceslaus"', why: "not-of-its-letters" },
    { entry: "e1", ref: "p4", what: "Thomas Kral", why: "not-in-transcript" },
    { entry: "e1", ref: "p5", what: "Marie", why: "no-name" },
  ]);
  // a date of [...]: no GEDCOM, uncertain; a place not in the transcript: kept, uncertain
  assert.deepEqual(entry.events[0]!.date, { text: "[...].4.1846" });
  assert.deepEqual(entry.events[0]!.uncertain, ["date", "place"]);
  // references to a person left out go too
  assert.deepEqual(entry.events[0]!.persons, [{ ref: "p1", role: "principal" }]);
  assert.deepEqual(entry.relations, [{ type: "parent", parent: "p2", child: "p1" }]);
});

test("nothing filled in: a name must come of the words written — a surname of none is left out, a given name of other letters is a lead", () => {
  const raw = parseDocReport(`## Entry e1 · page 1
transcript: Joannes filius | Josephi Novák agricolae | et Mariae Nováková | levans Wenceslaus | testis Nowak Thomas
person: p1 | child | written=Joannes | given=Jan | surname=Novák
person: p2 | father | written=Josephi Novák | given=Josef | surname=Svoboda
person: p3 | mother | written=Mariae Nováková | given=Marie | surname=Nováková
person: p4 | godparent | written=Wenceslaus | given=Václav | surname=Horák
person: p5 | father | written=Josephi Novák | given=Karel | surname=Novák
person: p6 | witness | written=Nowak Thomas | given=Tomáš | surname=Novák
`).entries[0]!;
  const { entry, checks } = checkEntry(raw, "e1");
  const [p1, p2, p3, p4, p5, p6] = entry.persons;
  // the child's surname the entry does not write (its father's): left out, never taken for read
  assert.equal(p1!.given, "Jan");
  assert.equal(p1!.surname, undefined);
  // a surname of another family than the one written: left out
  assert.equal(p2!.given, "Josef");
  assert.equal(p2!.surname, undefined);
  assert.equal(p3!.surname, "Nováková");
  // a surname with no word written for it: left out; Václav is no reading of Wenceslaus's letters: a lead
  assert.equal(p4!.surname, undefined);
  assert.deepEqual([p4!.given, p4!.today], ["Wenceslaus", "Václav"]);
  // a given name of other letters: the name as written, the reader's a lead, uncertain
  assert.deepEqual([p5!.given, p5!.today, p5!.surname, p5!.uncertain], ["Josephi", "Karel", "Novák", ["given"]]);
  // the surname written first, in its old spelling: still of the words written
  assert.deepEqual([p6!.given, p6!.surname, p6!.today], ["Tomáš", "Novák", undefined]);
  assert.deepEqual(checks, [
    { entry: "e1", ref: "p1", what: 'surname "Novák"', why: "not-in-transcript" },
    { entry: "e1", ref: "p2", what: 'surname "Svoboda"', why: "not-in-transcript" },
    { entry: "e1", ref: "p4", what: 'surname "Horák"', why: "not-in-transcript" },
    { entry: "e1", ref: "p4", what: 'given "Václav" for "Wenceslaus"', why: "not-of-its-letters" },
    { entry: "e1", ref: "p5", what: 'given "Karel" for "Josephi"', why: "not-of-its-letters" },
  ]);
});

test("nothing filled in: a surname of the other sex's form than the word written is left out, as of another family", () => {
  const raw = parseDocReport(`## Entry e1 · page 1
transcript: Josephi Novák | Thomae Novotný | Josefa Kaliny | Petra Sovy | Mariae Dvořák | Anna Svobodové | Anny Svobodové | Пётр Иванов
person: p1 | father | written=Josephi Novák | given=Josef | surname=Nováková | sex=M
person: p2 | father | written=Thomae Novotný | given=Tomáš | surname=Novotná | sex=M
person: p3 | father | written=Josefa Kaliny | given=Josef | surname=Kalina | sex=M
person: p4 | godparent | written=Petra Sovy | given=Petr | surname=Sova | sex=M
person: p5 | mother | written=Mariae Dvořák | given=Marie | surname=Dvořáková | sex=F
person: p6 | witness | written=Anna Svobodové | given=Anna | surname=Svoboda | sex=F
person: p7 | witness | written=Anny Svobodové | given=Anna | surname=Svobodová | sex=F
person: p8 | father | written=Пётр Иванов | given=Пётр | surname=Иванова | sex=M
`).entries[0]!;
  const { entry, checks } = checkEntry(raw, "e1");
  // a woman's form for a man written in a man's (and in Cyrillic): no reading of the record; the word stays the
  // surname's, so the given name is the others
  assert.deepEqual(entry.persons.map((p) => [p.ref, p.given, p.surname]), [
    ["p1", "Josef", undefined],
    ["p2", "Tomáš", undefined],
    ["p3", "Josef", "Kalina"],
    ["p4", "Petr", "Sova"],
    ["p5", "Marie", "Dvořáková"],
    ["p6", "Anna", undefined],
    ["p7", "Anna", "Svobodová"],
    ["p8", "Пётр", undefined],
  ]);
  assert.deepEqual(checks, [
    { entry: "e1", ref: "p1", what: 'surname "Nováková"', why: "not-in-transcript" },
    { entry: "e1", ref: "p2", what: 'surname "Novotná"', why: "not-in-transcript" },
    { entry: "e1", ref: "p6", what: 'surname "Svoboda"', why: "not-in-transcript" },
    { entry: "e1", ref: "p8", what: 'surname "Иванова"', why: "not-in-transcript" },
  ]);
  // decomposed input: the same
  const nfd = parseDocReport(`## Entry e1 · page 1\ntranscript: ${"Josephi Novák".normalize("NFD")}\nperson: p1 | father | written=Josephi Novák | given=Josef | surname=${"Nováková".normalize("NFD")} | sex=M\n`).entries[0]!;
  assert.equal(checkEntry(nfd, "e1").entry.persons[0]!.surname, undefined);
  // without a sex, nothing to tell apart: as before
  const none = parseDocReport(`## Entry e1 · page 1\ntranscript: Josephi Novák\nperson: p1 | father | written=Josephi Novák | given=Josef | surname=Nováková\n`).entries[0]!;
  assert.equal(checkEntry(none, "e1").entry.persons[0]!.surname, "Nováková");
});

test("a word of today's form of the written one: Latin and old spellings, any accent, any script", () => {
  const k = (s: string) => words(s)[0]!.key;
  for (const [today, written] of [["Josef", "Josephi"], ["Jan", "Joannes"], ["Marie", "Mariae"], ["Jakub", "Jacobus"], ["Kateřina", "Catharina"], ["Anna", "Annae"], ["Tomáš", "Thomas"], ["Johann", "Johannes"], ["Václav", "Václava"], ["Пётр", "Петра"]] as const)
    assert.ok(sameNameWord(k(today), k(written)), `${today} of ${written}`);
  for (const [today, written] of [["Karel", "Josephi"], ["Václav", "Wenceslaus"], ["Svoboda", "Novák"], ["Horák", "Wenceslaus"], ["Иван", "Пётр"]] as const)
    assert.ok(!sameNameWord(k(today), k(written)), `${today} not of ${written}`);
  // decomposed input is the same word
  assert.ok(sameNameWord(k("Kateřina".normalize("NFD")), k("Catharina")));
});

test("nothing filled in, in any script and any normal form: NFD, Cyrillic", () => {
  const nfd = "Mariae Dvořák".normalize("NFD");
  const raw = parseDocReport(`## Entry e1 · page 1\ntranscript: et Mariae Dvořák\nperson: p1 | mother | written=${nfd} | given=Marie | surname=Dvořáková\n`).entries[0]!;
  assert.equal(checkEntry(raw, "e1").entry.persons.length, 1);
  const cyr = parseDocReport(`## Entry e1 · page 1
transcript: Крещён младенец Иван | отец Пётр Иванов[?]
person: p1 | child | written=Иван | given=Иван
person: p2 | father | written=Пётр Иванов[?] | given=Пётр | surname=Иванов
person: p3 | mother | written=Анна Петрова | given=Анна | surname=Петрова
`).entries[0]!;
  const c = checkEntry(cyr, "e1");
  assert.deepEqual(c.entry.persons.map((p) => p.ref), ["p1", "p2"]);
  assert.deepEqual(c.entry.persons[1]!.uncertain, ["surname"]);
  assert.deepEqual(c.checks.map((x) => x.why), ["not-in-transcript"]);
  // the words: folded, marks attached to their word, illegible as one token
  assert.deepEqual(words("Novák [?] | [ ... ] Dvořák,").map((w) => [w.key, w.unsure, w.illegible]), [["novak", true, false], ["[...]", false, true], ["dvorak", false, false]]);
});

test("a blind reader's entry: no translation, no terms", () => {
  const raw = parseDocReport("## Entry e1 · page 1\ntranscript: Anna\ntranslation: Anna\nterm: x = y\n").entries[0]!;
  const { entry } = checkEntry(raw, "e1", true);
  assert.equal(entry.translation, undefined);
  assert.equal(entry.glossary, undefined);
});

test("dates as the record has them, in GEDCOM", () => {
  assert.equal(gedcomDate("3.4.1846"), "3 APR 1846");
  assert.equal(gedcomDate("3. 4. 1846"), "3 APR 1846");
  assert.equal(gedcomDate("1846"), "1846");
  assert.equal(gedcomDate("4.1846"), "APR 1846");
  assert.equal(gedcomDate("3.4.1846[?]"), "3 APR 1846");
  assert.equal(gedcomDate("[...].4.1846"), undefined);
});

test("two readers: alike after folding; where they differ, the words and the fields", () => {
  const e = (t: string, surname: string) =>
    checkEntry(parseDocReport(`## Entry e1 · page 1\ntranscript: ${t}\nperson: p1 | father | written=Josephi ${surname} | given=Josef | surname=${surname}\nevent: BAPM | date=3.4.1846\n`).entries[0]!, "e1").entry;
  // the same words, other accents, case, punctuation and [?]: alike
  const same = compareReadings([e("Joannes, filius Josephi Novák[?]", "Novák")], [e("joannes filius josephi novak", "Novak")]);
  assert.equal(same.agree, "same");
  assert.equal(same.entries[0]!.agree, "same");
  const differ = compareReadings([e("Joannes filius Josephi Novák", "Novák")], [e("Joannes filius Josephi Nowak", "Nowak")]);
  assert.equal(differ.agree, "differ");
  assert.deepEqual(differ.entries[0]!.variants, [
    { field: "transcript", at: "Novák", other: "Nowak" },
    { field: "p1.surname", at: "Novák", other: "Nowak" },
  ]);
  // an entry only the blind reader has: they differ
  assert.equal(compareReadings([e("Anna", "X")], [e("Anna", "X"), { ...e("Petr", "Y"), id: "e2" }]).agree, "differ");
  assert.deepEqual(wordDiff("a b c", "a x c d"), [{ at: "b", other: "x" }, { at: "", other: "d" }]);
});

test("the reader's task: the pages, the report's line, the language; a blind one without translation or context", () => {
  const pages = [{ n: 1, view: "/v/1.jpg", parts: [{ label: "top half", view: "/v/1a.jpg" }] }];
  const first = docPrompt({ pages, report: "/r/D-1.md", lang: "cs", note: "rub fotky\nz alba" });
  assert.match(first, /Write your report to \/r\/D-1\.md AS YOU GO/);
  assert.ok(first.includes(DOC_NEXT));
  assert.match(first, /- page 1: \/v\/1\.jpg\n.*\n    top half: \/v\/1a\.jpg/);
  assert.match(first, /translation: the transcript in (Czech|čeština|Čeština)/);
  assert.match(first, /## Context/);
  assert.match(first, /rub fotky z alba/);
  assert.match(first, /not-text/);
  const blind = docPrompt({ pages, report: "/r/D-2.md", lang: "cs", blind: true });
  assert.match(blind, /BLIND reading/);
  assert.doesNotMatch(blind, /translation:|## Context|^term:/m);
});

test("a region of a part asked, as a region of its page", () => {
  assert.deepEqual(within([0.5, 0.5, 0.5, 0.5], [0, 0, 1, 1]), [0.5, 0.5, 0.5, 0.5]);
  assert.deepEqual(within([0.2, 0.4, 0.5, 0.5], [0.5, 0.5, 0.2, 0.2]), [0.45, 0.65, 0.1, 0.1]);
});
