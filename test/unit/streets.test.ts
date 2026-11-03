// A street is no place: what a place holds of a street or a house number, told by the words of a street, a house
// number's marker, or a street the research's own houses name — in any script, decomposed input the same; a second part
// that is none of these (a part of the village, a parish, a district, a saint) stays.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bareNumber, houseWith, numberedTown, numbersOnly, splitStreet, streetOfHouse } from "../../src/core/streets.ts";
import { ui } from "../../src/cli/ui.ts";
import { foldText } from "../../src/core/text.ts";

const known = (streets: Record<string, string[]>) => (town: string) => (streets[town] ? new Set(streets[town]) : undefined);

test("splitStreet: a street's word, a house number's marker, numbers alone — any language and script, NFD the same", () => {
  assert.deepEqual(splitStreet("Lhota, nám. Míru"), { town: "Lhota", house: "nám. Míru", by: "word" });
  assert.deepEqual(splitStreet("Lhota, Dlouhá ulice 12"), { town: "Lhota", house: "Dlouhá ulice 12", by: "word" });
  assert.deepEqual(splitStreet("Lhotau, Hauptstraße 3"), { town: "Lhotau", house: "Hauptstraße 3", by: "word" });
  assert.deepEqual(splitStreet("Lhotau, Hauptstr. 3"), { town: "Lhotau", house: "Hauptstr. 3", by: "word" });
  assert.deepEqual(splitStreet("Лхота, ул. Ленина 5"), { town: "Лхота", house: "ул. Ленина 5", by: "word" });
  assert.deepEqual(splitStreet("Лхота, вулиця Шевченка 5"), { town: "Лхота", house: "вулиця Шевченка 5", by: "word" });
  assert.deepEqual(splitStreet("Lhota, okres Horní, náměstí Míru 4"), { town: "Lhota, okres Horní", house: "náměstí Míru 4", by: "word" });
  // decomposed input: the same, written composed
  assert.deepEqual(splitStreet("Lhota, nám. Míru".normalize("NFD")), { town: "Lhota", house: "nám. Míru", by: "word" });
  // a house number with its marker, or numbers alone after the municipality
  assert.deepEqual(splitStreet("Lhota č. p. 12"), { town: "Lhota", house: "12", by: "word" });
  assert.deepEqual(splitStreet("Lhota, čp. 12"), { town: "Lhota", house: "12", by: "word" });
  assert.deepEqual(splitStreet("Lhota, 12"), { town: "Lhota", house: "12", by: "word" });
  assert.deepEqual(splitStreet("Lhotau Nr. 3"), { town: "Lhotau", house: "3", by: "word" });
  assert.deepEqual(splitStreet("Лхота, д. 5"), { town: "Лхота", house: "5", by: "word" });
});

test("splitStreet: a part after the municipality of words and a house number is a street with its number — NFD, any script", () => {
  for (const [place, town, house] of [
    ["Lhota, Dlouhá 12", "Lhota", "Dlouhá 12"],
    ["Lhota, Polní 5", "Lhota", "Polní 5"],
    ["Lhotín, Horní 3", "Lhotín", "Horní 3"],
    ["Lhota, Polní 5/3", "Lhota", "Polní 5/3"],
    ["Lhota, Polní 3a", "Lhota", "Polní 3a"],
    ["Lhota, U Lhoty 7", "Lhota", "U Lhoty 7"],
    ["Lhota 2, Dlouhá 12", "Lhota 2", "Dlouhá 12"],
    ["Lhota, okres Horní, Dlouhá 12", "Lhota, okres Horní", "Dlouhá 12"],
    ["Лхота, Ленина 5", "Лхота", "Ленина 5"],
  ] as const) {
    assert.deepEqual(splitStreet(place), { town, house, by: "word" }, place);
    assert.deepEqual(splitStreet(place.normalize("NFD")), { town, house, by: "word" }, `${place} (NFD: written composed)`);
  }
  // no number of a house, the number before the words, the number in the municipality alone, the municipality's own
  // name with a number (a district of it): no street
  for (const place of ["Lhota, Horní Lhotín", "Lhota u Lhotína", "Lhota 5", "Lhotín 2", "Lhota, 3. díl", "Lhotín, Lhotín 5", "Lhota, Dlouhá"])
    assert.equal(splitStreet(place), undefined, place);
});

test("splitStreet: the example strom gives of a street in the place (strom fixes show street-places) is one, every language", () => {
  for (const lang of ["en", "cs", "de"]) {
    const example = /[„"]([^“"]+)[“"]/u.exec(ui(lang, "ui.fixes.street-places.what", { since: "1.22.0" }))?.[1];
    assert.ok(example, lang);
    assert.ok(splitStreet(example), `${lang}: ${example}`);
  }
  // and the changelogs' examples
  for (const example of ["Lhota, Lhotákova 12", "Lhota, Lhotak Street 12", "Lhota, Lhotákweg 12"]) assert.ok(splitStreet(example), example);
});

test("splitStreet: a street of the research's own houses at the same municipality (any accent), not elsewhere", () => {
  const streets = known({ lhota: ["dlouha"] });
  assert.deepEqual(splitStreet("Lhota, Dlouhá", streets), { town: "Lhota", house: "Dlouhá", by: "known" });
  assert.deepEqual(splitStreet("Lhota, Dlouhá 12", streets), { town: "Lhota", house: "Dlouhá 12", by: "known" });
  assert.deepEqual(splitStreet("Lhota, DLOUHA".normalize("NFD"), streets), { town: "Lhota", house: "DLOUHA", by: "known" });
  assert.equal(splitStreet("Lhotinka, Dlouhá", streets), undefined, "a street of another municipality's houses");
  assert.equal(splitStreet("Lhota, Dlouhá"), undefined, "without the houses: unclear");
});

test("splitStreet: an unclear second part stays — a part of the village, a parish, a district, a saint, a town's number", () => {
  for (const place of [
    "Lhota",
    "Lhota, okres Horní",
    "Lhota, Horní Lhota",
    "Lhota, farnost Lhotinka",
    "Lhota, St. Martin",
    "Lhota, Ostr.",
    "Lhota, Lhotecká",
    "Praha 2",
    "Lhotau, 3. Teil",
    "Bergweg, okres Horní",
    "Лхота, Московская область",
    "",
  ])
    assert.equal(splitStreet(place), undefined, place);
  // a part of the village with its number: the number alone goes
  assert.deepEqual(splitStreet("Lhota, Horní Lhota Nr. 3"), { town: "Lhota, Horní Lhota", house: "3", by: "word" });
});

test("streetOfHouse, numbersOnly: the street a house names, a house of numbers alone", () => {
  assert.equal(streetOfHouse("Dlouhá 88"), "dlouha");
  assert.equal(streetOfHouse("Dlouhá 88".normalize("NFD")), "dlouha");
  assert.equal(streetOfHouse("ул. Ленина 5"), "ул. ленина");
  assert.equal(streetOfHouse("13"), "");
  assert.equal(streetOfHouse("č. p. 13"), "");
  assert.equal(numbersOnly("13"), true);
  assert.equal(numbersOnly("13/2"), true);
  assert.equal(numbersOnly("12a"), true);
  assert.equal(numbersOnly("Dlouhá 12"), false);
  assert.equal(numbersOnly(""), false);
});

test("houseWith: the street where no house is, before a number alone, the house that names it kept; another one: none", () => {
  assert.equal(houseWith("Dlouhá 12", undefined), "Dlouhá 12");
  assert.equal(houseWith("nám. Míru", "5"), "nám. Míru 5");
  assert.equal(houseWith("Dlouhá", "Dlouhá 88"), "Dlouhá 88");
  assert.equal(houseWith("Dlouhá", "dlouhá 88".normalize("NFD")), "dlouhá 88".normalize("NFD"));
  assert.equal(houseWith("Dlouhá 12", "dlouhá 12"), "dlouhá 12");
  assert.equal(houseWith("nám. Míru 9", "Horní 4"), undefined);
  assert.equal(houseWith("Dlouhá 12", "7"), undefined, "two numbers: unclear");
  assert.equal(houseWith("Dlouhá", "Horní 4"), undefined);
});

test("bareNumber: a number alone after the municipality's name — never split by rules (a house or a part of it), any script, NFD the same", () => {
  assert.deepEqual(bareNumber("Lhota 16"), { name: "Lhota", town: "Lhota", house: "16" });
  assert.deepEqual(bareNumber("Lhota 16, okres Horní"), { name: "Lhota", town: "Lhota, okres Horní", house: "16" });
  assert.deepEqual(bareNumber("Лхота 5"), { name: "Лхота", town: "Лхота", house: "5" });
  assert.deepEqual(bareNumber("Lhotín 3a".normalize("NFD")), { name: "Lhotín", town: "Lhotín", house: "3a" }, "written composed");
  for (const place of ["Lhota", "Lhota č. p. 16", "16 Lhota", "16", "Lhota, 16", ""]) assert.equal(bareNumber(place), undefined, place);
  assert.equal(splitStreet("Lhota 16"), undefined, "rules alone never take it");
  assert.equal(numberedTown("Praha"), true, "a municipality numbered by its parts (assets/terms/streets.json)");
  assert.equal(numberedTown("Lhota"), false);
});

// the shared cases: the Strom app ports the same rules and runs its port over this file (test/fixtures/streets/cases.json,
// written by make-cases.ts) — the file must say what the code does, each input decomposed (NFD) the same
interface Cases {
  split: { place: string; known?: Record<string, string[]>; expect: unknown }[];
  bare: { place: string; expect: unknown }[];
  numbered: { name: string; expect: boolean }[];
  houseWith: { street: string; had?: string; expect: string | null }[];
  fold: { text: string; expect: string }[];
}

test("the shared cases of the street rules (test/fixtures/streets/cases.json) are what the code does, NFD the same", () => {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "streets", "cases.json");
  const c = JSON.parse(fs.readFileSync(file, "utf8")) as Cases;
  assert.ok(c.split.length > 30 && c.bare.length > 5 && c.numbered.length && c.houseWith.length);
  for (const x of c.split) {
    const k = x.known ? known(x.known) : undefined;
    assert.deepEqual(splitStreet(x.place, k) ?? null, x.expect, x.place);
    assert.deepEqual(splitStreet(x.place.normalize("NFD"), k) ?? null, x.expect, `${x.place} (NFD)`);
  }
  for (const x of c.bare) {
    assert.deepEqual(bareNumber(x.place) ?? null, x.expect, x.place);
    assert.deepEqual(bareNumber(x.place.normalize("NFD")) ?? null, x.expect, `${x.place} (NFD)`);
  }
  for (const x of c.numbered) assert.equal(numberedTown(x.name), x.expect, x.name);
  for (const x of c.houseWith) assert.equal(houseWith(x.street, x.had) ?? null, x.expect, `${x.street} + ${x.had}`);
  for (const x of c.fold) assert.equal(foldText(x.text), x.expect, x.text);
  // every case also a non-Latin script, and the numbers alone never a street by the rules
  assert.ok(c.split.some((x) => /\p{Script=Cyrillic}/u.test(x.place)));
  for (const x of c.bare) if (x.expect) assert.equal(splitStreet(x.place), undefined, x.place);
});
