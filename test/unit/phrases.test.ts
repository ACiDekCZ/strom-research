// Texts strom writes into a research come in its language: every catalog has
// only known keys, each with the same {values} as the English text.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PHRASES, catalog, fill, phrase, placeholdersOf, pluralsOf, wordsOf } from "../../src/core/phrases.ts";
import { assetPath } from "../../src/core/assets.ts";
import { UI, ui } from "../../src/cli/ui.ts";
import { LABELS, labels, type LabelKey } from "../../src/gedcom/labels.ts";
import { addressesPerson } from "../../src/core/impersonal.ts";

const ENGLISH: Record<string, string> = { ...PHRASES, ...UI };

/** The values a text takes: its {values} and the numbers its plurals count — a language may say a count with a plural where English does not. */
const values = (t: string) => placeholdersOf(t);

test("the Czech and German catalogs cover everything a person reads", () => {
  for (const lang of ["cs", "de"]) {
    const c = catalog(lang);
    for (const key of Object.keys(ENGLISH)) assert.ok(c[key], `${lang}: missing ${key}`);
  }
  assert.equal(phrase("de", "link.what", { name: "Jan Novák", place: "", about: "" }), "Taufe: Jan Novák");
});

test("every language catalog has known keys with the same values as English", () => {
  const langs = fs.readdirSync(assetPath("lang")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  assert.ok(langs.includes("cs"));
  for (const lang of langs) {
    const c = catalog(lang);
    for (const [key, text] of Object.entries(c)) {
      assert.ok(key in ENGLISH, `${lang}: unknown key ${key}`);
      assert.deepEqual(values(text!), values(ENGLISH[key]!), `${lang}: ${key}`);
      assert.equal(text, text!.normalize("NFC"), `${lang}: ${key} is NFC`);
    }
  }
});

test("every plural of every catalog has its other form, and only the forms its language knows", () => {
  const langs = ["en", ...fs.readdirSync(assetPath("lang")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5))];
  const found: string[] = [];
  for (const lang of langs) {
    const texts = lang === "en" ? ENGLISH : catalog(lang);
    const known = new Set(new Intl.PluralRules(lang).resolvedOptions().pluralCategories as string[]);
    for (const [key, text] of Object.entries(texts)) {
      for (const p of pluralsOf(text ?? "")) {
        if (!p.selectors.includes("other")) found.push(`${lang} ${key}: {${p.name}} has no other`);
        for (const s of p.selectors) if (!s.startsWith("=") && !known.has(s)) found.push(`${lang} ${key}: {${p.name}} has ${s}, unknown in ${lang}`);
      }
      // a plural half written stays as it is, braces and all: never in a catalog
      if (/\{\w+\s*,\s*plural/.test(text ?? "") && !pluralsOf(text ?? "").length) found.push(`${lang} ${key}: a plural that does not parse`);
    }
  }
  assert.deepEqual(found, []);
});

test("fill: a plural takes the form its language says for the number", () => {
  const cs = "{n, plural, one {# úkol} few {# úkoly} many {# úkolu} other {# úkolů}}";
  assert.deepEqual([1, 2, 4, 5, 0, 21, 22, 25, 1.5].map((n) => fill(cs, { n }, "cs")), ["1 úkol", "2 úkoly", "4 úkoly", "5 úkolů", "0 úkolů", "21 úkolů", "22 úkolů", "25 úkolů", "1.5 úkolu"]);
  const en = "{n, plural, one {# task} other {# tasks}} in the queue";
  assert.deepEqual([1, 2, 0, 21, 1.5].map((n) => fill(en, { n })), ["1 task in the queue", "2 tasks in the queue", "0 tasks in the queue", "21 tasks in the queue", "1.5 tasks in the queue"]);
  const de = "{n, plural, one {# Änderung} other {# Änderungen}}";
  assert.deepEqual([1, 2, 0].map((n) => fill(de, { n }, "de")), ["1 Änderung", "2 Änderungen", "0 Änderungen"]);
  // =0 first; a category the text leaves out: other
  const zero = "{n, plural, =0 {nic} one {# soubor} other {# souborů}}";
  assert.deepEqual([0, 1, 3].map((n) => fill(zero, { n }, "cs")), ["nic", "1 soubor", "3 souborů"]);
  // values inside a branch, and a plural inside a branch
  assert.equal(fill("{name}: {n, plural, one {# chyba v {file}} few {# chyby v {file}} other {# chyb v {file}}}", { name: "Strom", n: 3, file: "a.ged" }, "cs"), "Strom: 3 chyby v a.ged");
  assert.equal(fill("{a, plural, one {# kniha a {b, plural, one {# snímek} other {# snímků}}} other {# knih}}", { a: 1, b: 7 }, "cs"), "1 kniha a 7 snímků");
  // a number as a string counts; anything else is other, said as it is
  assert.equal(fill(cs, { n: "3" }, "cs"), "3 úkoly");
  assert.equal(fill(cs, { n: "mnoho" }, "cs"), "mnoho úkolů");
  assert.equal(fill(cs, { n: "1 234" }, "cs"), "1 234 úkolů");
  // a value not given: the plural stays as it is, like an unknown {name}
  assert.equal(fill(`x ${cs} {y}`, {}, "cs"), `x ${cs} {y}`);
  // not a language tag: English rules; # outside a plural, braces that are no template: as they are
  assert.equal(fill(en, { n: 1 }, "../cs"), "1 task in the queue");
  assert.equal(fill("#1 {\"a\": {n}} {n, plural}", { n: 2 }), '#1 {"a": 2} {n, plural}');
  assert.equal(fill("{n, plural, one {# a} other {# b}", { n: 1 }), "{n, plural, one {# a} other {# b}", "unclosed: no plural, as it is");
  // what the checks read: the values a text takes, its plurals, the words of every branch
  const t = "{name}: {n, plural, one {# vaše kniha v {place}} other {# knih}}";
  assert.deepEqual(placeholdersOf(t), ["n", "name", "place"]);
  assert.deepEqual(pluralsOf(t), [{ name: "n", selectors: ["one", "other"] }]);
  assert.equal(wordsOf(t), ":  vaše kniha v  /  knih");
  assert.ok(addressesPerson(wordsOf(t), "cs", { thorough: true }), "a branch that addresses the person is found");
});

test("localized: a catalog's plural in its language, English's in English", () => {
  assert.equal(phrase("cs", "app.media.what", { count: 2, who: "x", first: "I1", last: "I2" }).startsWith("Rozebrat 2 soubory"), true);
  assert.equal(phrase("cs", "app.media.what", { count: 5, who: "x", first: "I1", last: "I5" }).startsWith("Rozebrat 5 souborů"), true);
  assert.equal(phrase("en", "app.media.what", { count: 1, who: "x", first: "I1", last: "I1" }).startsWith("Analyse 1 file the user"), true);
  assert.equal(phrase("xx", "app.media.what", { count: 2, who: "x", first: "I1", last: "I2" }).startsWith("Analyse 2 files the user"), true, "no catalog: English, by English rules");
  // what a person reads: no "task(s)", no "úkolů: 1"
  assert.deepEqual([1, 2, 5].map((n) => ui("en", "ui.why.session", { n })), ["1 task in the queue", "2 tasks in the queue", "5 tasks in the queue"]);
  assert.deepEqual([1, 2, 5].map((n) => ui("cs", "ui.why.session", { n })), ["ve frontě je 1 úkol", "ve frontě jsou 2 úkoly", "ve frontě je 5 úkolů"]);
  assert.deepEqual([1, 2].map((n) => ui("de", "ui.why.session", { n })), ["1 Aufgabe in der Warteschlange", "2 Aufgaben in der Warteschlange"]);
  assert.equal(ui("en", "ui.check.found", { errors: 1, warnings: 0 }), "1 error, 0 warnings");
  assert.equal(ui("cs", "ui.check.found", { errors: 3, warnings: 1 }), "3 chyby, 1 varování");
  assert.equal(ui("de", "ui.check.found", { errors: 1, warnings: 1 }), "1 Fehler, 1 Warnung");
  // a count with its noun: 1 image, not 1 images — in English too
  assert.deepEqual([1, 3].map((n) => ui("en", "ui.pack.left", { n, mb: "1.0" }).trim().slice(0, 18)), ["left out: 1 image ", "left out: 3 images"]);
  assert.deepEqual([1, 3, 5].map((n) => ui("cs", "ui.fetch.progress", { n: 1, total: n })), ["1/1 snímek", "1/3 snímky", "1/5 snímků"]);
  assert.deepEqual([1, 2].map((n) => ui("de", "ui.archive.cap.short", { n })), ["höchstens 1 Anfrage pro Stunde, den Katalog mitgezählt", "höchstens 2 Anfragen pro Stunde, den Katalog mitgezählt"]);
  assert.match(ui("en", "ui.doc.media.unnamed", { n: 1, size: "1 MB" }), /1 file \(1 MB\) no research here names \(left as it is\)/);
  assert.match(ui("cs", "ui.intake.scans", { n: 2, folder: "x" }), /^Ve složce x jsou 2 obrázky\. Jsou to/);
  assert.match(ui("en", "ui.views.ask", { agent: "a", readers: 1, n: 1, sizes: "800", cost: "$1" }), /: 1 paid reading of 1 image of this research/);
  assert.match(ui("en", "ui.review.unproven.left.human", { n: 1 }), /^1 more person waits/);
  assert.match(ui("cs", "ui.review.unproven.left.human", { n: 3 }), /^Další 3 osoby čekají/);
  // no English text of a person's or of a research left with (s)
  assert.deepEqual(Object.entries(ENGLISH).filter(([, t]) => /\p{L}\((?:s|es)\)/u.test(t)).map(([k]) => k), []);
});

test("phrase: the research language, English where a language has no text", () => {
  assert.equal(phrase("cs", "link.what", { name: "Jan Novák", place: "", about: "" }), "Křest: Jan Novák");
  assert.equal(phrase("en", "link.what", { name: "Jan Novák", place: "", about: "" }), "Baptism of Jan Novák");
  assert.equal(phrase("xx", "reason.unknown"), "parents unknown", "no catalog: English");
  assert.equal(phrase("../cs", "reason.unknown"), "parents unknown", "not a path");
});

// Milan, 2026-10-04: "otázky a hlášky pro člověka nemají oslovovat uživatele, mají být neosobní" — "Spustit ve vlastním
// terminálu: strom tidy", "Nic nečeká". Texts for the agent are not these; nor the person's own first message to it.
const SPOKEN_BY_THE_PERSON = new Set(["ui.chat.first", "ui.chat.continue"]); // and every "….say"
/** What strom tells the agent to say (the orientation's notes for it), not the person: "you" is the agent there. */
const FOR_THE_AGENT = new Set(["ui.o.ask.tell", "ui.o.results.installed.live", "ui.o.stories.tell"]);
/** A word that only looks like addressing ("lang:key"). */
const IMPERSONAL_EXCEPTIONS = new Set<string>([]);

test("what a person reads never addresses them: impersonal, in every language (texts for the agent aside)", () => {
  const found: string[] = [];
  for (const lang of ["en", "cs", "de"]) {
    const texts = lang === "en" ? ENGLISH : catalog(lang);
    for (const [key, text] of Object.entries(texts)) {
      if (!/^(ui|log)\./.test(key) || SPOKEN_BY_THE_PERSON.has(key) || key.endsWith(".say") || FOR_THE_AGENT.has(key) || IMPERSONAL_EXCEPTIONS.has(`${lang}:${key}`)) continue;
      const m = addressesPerson(wordsOf(text ?? ""), lang, { thorough: true }); // every branch of its plurals
      if (m) found.push(`${lang} ${key}: „${m}“ in ${text}`);
    }
    // the words strom writes into the GEDCOM a person opens (the header's note, how sure a fact is…)
    for (const key of Object.keys(LABELS.en) as LabelKey[]) {
      const text = labels(lang)(key);
      const m = addressesPerson(text, lang, { thorough: true });
      if (m) found.push(`${lang} GEDCOM ${key}: „${m}“ in ${text}`);
    }
  }
  assert.deepEqual(found, []);
});
