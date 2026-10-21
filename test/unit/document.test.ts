// One document read at once (core/document.ts): what a reader is asked, its report read back, nothing filled in
// (K1.2), two readers held against each other — made-up documents only, in any script, NFC or NFD.

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEntry, sameNameWord, compareReadings, docPrompt, gedcomDate, newReadId, parseDocReport, parseRegion, READ_ID, resultForApp, within, wordDiff, words, DOC_NEXT, type ReadResult } from "../../src/core/document.ts";

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
  // a certificate is no register: rodný list, Geburtsurkunde, odpis skrócony aktu urodzenia
  for (const k of ["rodný list", "Geburtsurkunde", "Odpis skrócony aktu urodzenia", "birth certificate"]) assert.equal(parseDocReport(`## Document\nkind: ${k}\n`).doc.kind, "certificate", k);
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

test("a form holds a name in its fields apart: each word written there is the name; a register's name stands in a row", () => {
  // a made-up certificate: the surnames in one field, the given names in another, the parents' side by side
  const form = (written: string) =>
    parseDocReport(`## Entry e1 · page 1
transcript: Familienname LÖFFLER | Vornamen HANS JÜRGEN | Vater | Mutter | Familienname LÖFFLER | LÖFFLER | Vornamen WALTER | ERIKA [...]
person: p1 | child | written=${written} | given=Hans Jürgen | surname=Löffler | sex=M
person: p2 | father | written=LÖFFLER WALTER | given=Walter | surname=Löffler | sex=M
person: p3 | mother | written=LÖFFLER ERIKA [...] | given=Erika | surname=Löffler | sex=F
person: p4 | witness | written=LÖFFLER KARL | given=Karl | surname=Löffler
event: BIRT | date=3.4.1950 | persons=p1:principal,p2:father,p3:mother
relation: parent p2 p1
relation: parent p3 p1
`).entries[0]!;
  const c = checkEntry(form("LÖFFLER HANS JÜRGEN".normalize("NFD")), "e1", false, true);
  // a word not read is never found apart; a name of a word nowhere written is left out as before
  assert.deepEqual(c.entry.persons.map((p) => `${p.ref} ${p.given} ${p.surname} ${p.written}`), ["p1 Hans Jürgen Löffler LÖFFLER HANS JÜRGEN", "p2 Walter Löffler LÖFFLER WALTER"]);
  assert.deepEqual(c.checks.map((x) => `${x.ref}:${x.why}`), ["p3:not-in-transcript", "p4:not-in-transcript"]);
  assert.deepEqual(c.entry.events[0]!.persons, [{ ref: "p1", role: "principal" }, { ref: "p2", role: "father" }]);
  assert.deepEqual(c.entry.relations, [{ type: "parent", parent: "p2", child: "p1" }]);
  // not a form: a name stands in a row as written — the child's surname is never its father's taken
  assert.deepEqual(checkEntry(form("LÖFFLER HANS JÜRGEN"), "e1").entry.persons.map((p) => p.ref), []);
  // any script
  const cyr = parseDocReport(`## Entry e1 · page 1
transcript: Фамилия ИВАНОВ | Имя ПЁТР
person: p1 | child | written=ИВАНОВ ПЁТР | given=Пётр | surname=Иванов
`).entries[0]!;
  assert.equal(checkEntry(cyr, "e1", false, true).entry.persons[0]!.given, "Пётр");
});

test("a name in letter-spaced type is one word, a birth name after roz./geb./урожд. is the surname; written stays as it stands", () => {
  // a made-up typewritten certificate: the child's and the mother's surnames spaced out, the mothers' birth names glued
  const entry = (t: string) =>
    parseDocReport(`## Entry e1 · page 1
transcript: ${t}
person: p1 | child | written=Petr K o v á ř | given=Petr | surname=Kovář | sex=M
person: p2 | mother | written=Hana K o v á ř o v á roz.Kratochvílová | given=Hana | surname=Kratochvílová | sex=F
person: p3 | other | written=Jana roz. Dvořáková | given=Jana | surname=Dvořáková | sex=F
person: p4 | other | written=Erika Lang geb.Zimmer | given=Erika | surname=Zimmer | sex=F
`).entries[0]!;
  const t = "Jméno a příjmení dítěte | Petr K o v á ř | Matka | Hana K o v á ř o v á roz.Kratochvílová | Jana roz. Dvořáková | Erika Lang geb.Zimmer | Předseda: v z.";
  for (const x of [t, t.normalize("NFD")]) {
    const c = checkEntry(entry(x), "e1", false, true);
    assert.deepEqual(c.checks, []);
    assert.deepEqual(
      c.entry.persons.map((p) => `${p.given}/${p.surname}/${p.written.normalize("NFC")}`),
      ["Petr/Kovář/Petr K o v á ř", "Hana/Kratochvílová/Hana K o v á ř o v á roz.Kratochvílová", "Jana/Dvořáková/Jana roz. Dvořáková", "Erika/Zimmer/Erika Lang geb.Zimmer"],
    );
  }
  // the reader's surname written spaced or not is the same word; two letters alone stay apart (v z.)
  assert.deepEqual(words("Petr K o v á ř, v z. n.Labem").map((w) => w.key), ["petr", "kovar", "v", "z", "n", "labem"]);
  // the married surname is no given name: a given name of other letters falls back to the words before the mark
  const other = checkEntry(parseDocReport("## Entry e1 · page 1\ntranscript: Hana K o v á ř o v á roz.Kratochvílová\nperson: p1 | mother | written=Hana K o v á ř o v á roz.Kratochvílová | given=Johanna | surname=Kratochvílová\n").entries[0]!, "e1");
  assert.equal(other.entry.persons[0]!.given, "Hana Kovářová");
  // any script: урожд. (урождённая)
  const cyr = checkEntry(parseDocReport("## Entry e1 · page 1\ntranscript: Мать | Анна П е т р о в а урожд.Иванова\nperson: p1 | mother | written=Анна П е т р о в а урожд.Иванова | given=Анна | surname=Иванова | sex=F\n").entries[0]!, "e1");
  assert.deepEqual(cyr.entry.persons.map((p) => `${p.given}/${p.surname}`), ["Анна/Иванова"]);
  assert.deepEqual(cyr.checks, []);
});

test("a whole name letter-spaced: a gap of two spaces parts its words, the reader's names part them where one space does; Ur is a name, letters of running text stay apart", () => {
  const one = (t: string, written: string, given: string, surname: string, sex = "F") =>
    checkEntry(parseDocReport(`## Entry e1 · page 1\ntranscript: ${t}\nperson: p1 | mother | written=${written} | given=${given} | surname=${surname} | sex=${sex}\n`).entries[0]!, "e1", false, true);
  for (const nf of ["NFC", "NFD"] as const) {
    const n = (s: string) => s.normalize(nf);
    // a typewriter's two spaces between the words, the reader's one: Marie Nováková, nothing left out
    for (const [t, written] of [
      ["Matka | M a r i e  N o v á k o v á", "M a r i e N o v á k o v á"],
      ["Matka | M a r i e N o v á k o v á", "M a r i e N o v á k o v á"],
      ["Matka | M A R I E  N O V Á K O V Á", "M A R I E  N O V Á K O V Á"],
    ]) {
      const c = one(n(t!), n(written!), n("Marie"), n("Nováková"));
      assert.deepEqual(c.checks, [], t);
      assert.deepEqual(c.entry.persons.map((p) => `${p.given}/${p.surname?.normalize("NFC")}`), ["Marie/Nováková"], t);
    }
    // a given name of other letters: the surname still parted from the rest
    const other = one(n("Matka | H a n a K o v á ř o v á"), n("H a n a K o v á ř o v á"), "Johanna", n("Kovářová"));
    assert.deepEqual(other.entry.persons.map((p) => `${p.given}/${p.today}/${p.surname?.normalize("NFC")}`), ["Hana/Johanna/Kovářová"]);
    // Ur without a stop is a name; ur. before the surname is the birth name's mark
    const ur = one(n("Otec | Jan Ur Novák"), n("Jan Ur Novák"), n("Jan Ur"), n("Novák"), "M");
    assert.deepEqual([ur.entry.persons[0]!.given, ur.entry.persons[0]!.surname?.normalize("NFC"), ur.checks], ["Jan Ur", "Novák", []]);
    const marked = one(n("Matka | Hana ur. Nováková"), n("Hana ur. Nováková"), "Johanna", n("Nováková"));
    assert.equal(marked.entry.persons[0]!.given, "Hana");
    // single letters of running text are words of their own, so two readers differ only where they do
    assert.deepEqual(words(n("šel a v k domu")).map((w) => w.text), ["šel", "a", "v", "k", "domu"].map(n));
    assert.deepEqual(wordDiff(n("šel a v k domu"), n("šel k domu")), [{ at: "a v", other: "" }]);
    assert.deepEqual(wordDiff(n("Jan M a r i e N o v á k o v á"), n("Jan Marie Nováková")), []);
  }
  // any script
  const cyr = one("Мать | А н н а  П е т р о в а", "А н н а П е т р о в а", "Анна", "Петрова");
  assert.deepEqual([cyr.entry.persons.map((p) => `${p.given}/${p.surname}`), cyr.checks], [["Анна/Петрова"], []]);
});

test("two readers: a person the blind one gave another role is the same one, the role and a field only one read are variants", () => {
  const e = (role: string, fields: string) =>
    checkEntry(parseDocReport(`## Entry e1 · page 1\ntranscript: Ausgestellt Dr. Petra Zimmer\nperson: p1 | ${role} | written=Dr. Petra Zimmer | given=Petra${fields}\n`).entries[0]!, "e1").entry;
  const c = compareReadings([e("other", "")], [e("writer", " | surname=Zimmer")]);
  assert.deepEqual(c.entries[0]!.variants, [
    { field: "p1.role", at: "other", other: "writer" },
    { field: "p1.surname", at: "", other: "Zimmer" },
  ]);
  assert.deepEqual(c.entries[0]!.persons.map((p) => p.ref), ["p1"]);
});

test("two readers: the people of another role paired by the best match of the name, a tie paired with none", () => {
  const e = (transcript: string, persons: string[]) =>
    checkEntry(parseDocReport(`## Entry e1 · page 1\ntranscript: ${transcript}\n${persons.map((p, i) => `person: p${i + 1} | ${p}`).join("\n")}\n`).entries[0]!, "e1").entry;
  const person = (role: string, given: string, surname?: string) => `${role} | written=${[given, surname].filter(Boolean).join(" ")} | given=${given}${surname ? ` | surname=${surname}` : ""}`;
  // a father and a godparent of one given name: each with the blind reader's one of his whole name, never by "Jan" alone
  const t = "Josef Novák syn Jan Novák otec Jan Dvořák kmotr";
  const a = compareReadings(
    [e(t, [person("child", "Josef", "Novák"), person("father", "Jan", "Novák"), person("godparent", "Jan", "Dvořák")])],
    [e(t, [person("child", "Josef", "Novák"), person("witness", "Jan", "Dvořák"), person("other", "Jan", "Novák")])],
  );
  assert.deepEqual(a.entries[0]!.variants, [
    { field: "p2.role", at: "father", other: "other" },
    { field: "p3.role", at: "godparent", other: "witness" },
  ]);
  // a father and his son of one name: the father is the one the blind reader read whole; the son missing there,
  // never given his father's surname
  const u = "Jan syn Jan Novák otec";
  const b = compareReadings([e(u, [person("child", "Jan"), person("father", "Jan", "Novák")])], [e(u, [person("other", "Jan", "Novák")])]);
  assert.deepEqual(b.entries[0]!.variants, [
    { field: "p1", at: "Jan", other: "" },
    { field: "p2.role", at: "father", other: "other" },
  ]);
  // decomposed accents (NFD) are the same name; two the same name equally well: neither paired
  const nfd = "Jan Dvořák kmotr Jan Dvořák svědek".normalize("NFD");
  const tie = compareReadings([e(nfd, [person("godparent", "Jan", "Dvořák".normalize("NFD"))])], [e(nfd, [person("witness", "Jan", "Dvořák"), person("other", "Jan", "Dvořák")])]);
  assert.deepEqual(tie.entries[0]!.variants, [
    { field: "p1", at: "Jan Dvořák".normalize("NFD"), other: "" },
    { field: "person", at: "", other: "Jan Dvořák" },
    { field: "person", at: "", other: "Jan Dvořák" },
  ]);
  // another script: the surname shared weighs more than the given name
  const cyr = "Пётр Иванов Иван Иванов Пётр Сидоров";
  const c = compareReadings(
    [e(cyr, [person("father", "Иван", "Иванов")])],
    [e(cyr, [person("witness", "Пётр", "Сидоров"), person("other", "Пётр", "Иванов")])],
  );
  assert.deepEqual(c.entries[0]!.variants, [
    { field: "p1.role", at: "father", other: "other" },
    { field: "p1.given", at: "Иван", other: "Пётр" },
    { field: "person", at: "", other: "Пётр Сидоров" },
  ]);
});

test("the Strom app is given the role the blind reader gave at the person, never as a variant of the transcript", () => {
  const e = (role: string) =>
    checkEntry(parseDocReport(`## Entry e1 · page 1\ntranscript: Mutter Löffler Erika Maria\nperson: p1 | ${role} | written=Löffler Erika Maria | given=Erika Maria | surname=Löffler\n`).entries[0]!, "e1").entry;
  const c = compareReadings([e("mother")], [e("other")]);
  assert.deepEqual(c.entries[0]!.variants, [{ field: "p1.role", at: "mother", other: "other" }]);
  const r = { id: "D1", state: "done", version: 1, lang: "cs", at: "", since: "", doc: {}, readers: { asked: 2, ran: 2, agree: c.agree }, pages: [], entries: c.entries, checks: [] } as ReadResult;
  const app = resultForApp(r);
  assert.equal(app.entries[0]!.variants, undefined);
  assert.equal(app.entries[0]!.persons[0]!.blindRole, "other");
  assert.equal(app.readers.agree, "differ");
  // the result itself keeps the variant (strom document show, the agents)
  assert.deepEqual(r.entries[0]!.variants, [{ field: "p1.role", at: "mother", other: "other" }]);
  // the other variants stay as they are
  const d = compareReadings([e("mother")], [{ ...e("other"), transcript: "Mutter Löfler Erika Maria" }]);
  assert.deepEqual(resultForApp({ ...r, entries: d.entries }).entries[0]!.variants, [{ field: "transcript", at: "Löffler", other: "Löfler" }]);
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
  assert.deepEqual(wordDiff("Anna Bára Cyril", "Anna Xaver Cyril Dan"), [{ at: "Bára", other: "Xaver" }, { at: "", other: "Dan" }]);
  // a name one reader wrote in letter-spaced type as it stands, the other as one word: no difference
  assert.deepEqual(wordDiff("Petr K o v á ř", "Petr Kovář"), []);
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

test("a written name ends where the name does: no comma, semicolon or colon of the transcript after it", () => {
  const raw = parseDocReport(`## Entry e1 · page 1
transcript: Joannes Novák, filius Josephi Novák; mater: Mariae Dvořáková: levans Wenceslaus Horák[?], Лука Петров,
person: p1 | child | written=Joannes Novák, | given=Jan | surname=Novák | sex=M
person: p2 | father | written=Josephi Novák | given=Josef | surname=Novák | sex=M
person: p3 | mother | written=Mariae Dvořáková | given=Marie | surname=Dvořáková | sex=F
person: p4 | godparent | written=Wenceslaus Horák[?] | given=Václav | surname=Horák | sex=M
person: p5 | witness | written=Лука Петров, | given=Лука | surname=Петров | sex=M
`).entries[0]!;
  const { entry } = checkEntry(raw, "e1");
  assert.deepEqual(
    entry.persons.map((p) => p.written),
    ["Joannes Novák", "Josephi Novák", "Mariae Dvořáková", "Wenceslaus Horák[?]", "Лука Петров"],
  );
  // a stop stays: it may be the name's own (ml., st.)
  const short = parseDocReport(`## Entry e1 · page 1
transcript: Jan Novák ml., syn
person: p1 | child | written=Jan Novák ml. | given=Jan | surname=Novák | sex=M
`).entries[0]!;
  assert.equal(checkEntry(short, "e1").entry.persons[0]!.written, "Jan Novák ml.");
});
