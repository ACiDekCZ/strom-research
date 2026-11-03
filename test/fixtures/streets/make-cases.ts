// Writes cases.json: the shared cases of the rules telling a street and a house number in a place (core/streets.ts),
// each with what strom makes of it now. The Strom app ports the same rules (a copy of assets/terms/streets.json) and
// runs its port over this file; strom's own test (test/unit/streets.test.ts) holds the file to the code. Run after a
// change of the rules or the words: node test/fixtures/streets/make-cases.ts — then read the diff, every line is a rule.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bareNumber, houseWith, numberedTown, splitStreet } from "../../../src/core/streets.ts";
import { foldText } from "../../../src/core/text.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const known = (streets: Record<string, string[]>) => (town: string) => (streets[town] ? new Set(streets[town]) : undefined);

const split: { place: string; known?: Record<string, string[]>; note?: string }[] = [
  // a street's word, any language and script
  { place: "Lhota, nám. Míru" },
  { place: "Lhota, Dlouhá ulice 12" },
  { place: "Lhotau, Hauptstraße 3" },
  { place: "Lhotau, Hauptstr. 3" },
  { place: "Лхота, ул. Ленина 5" },
  { place: "Лхота, вулиця Шевченка 5" },
  { place: "Lhota, okres Horní, náměstí Míru 4" },
  { place: "Hauptstraße 3, Lhotau", note: "a street before the municipality only with its number" },
  // a house number's marker, numbers alone after the municipality
  { place: "Lhota č. p. 12" },
  { place: "Lhota čp. 12" },
  { place: "Lhota, čp. 12" },
  { place: "Lhota, 12" },
  { place: "Lhota, 13/2" },
  { place: "Lhotau Nr. 3" },
  { place: "Лхота, д. 5" },
  { place: "Lhota, Horní Lhota Nr. 3", note: "a part of the village with its number: the number alone goes" },
  // a part after the municipality of words and a house number
  { place: "Lhota, Dlouhá 12" },
  { place: "Lhota, Polní 5/3" },
  { place: "Lhota, Polní 3a" },
  { place: "Lhota, U Lhoty 7" },
  { place: "Lhota 2, Dlouhá 12", note: "the municipality keeps its number: a part of it" },
  { place: "Lhota, okres Horní, Dlouhá 12" },
  { place: "Лхота, Ленина 5" },
  // a street the research's (or the tree's) own houses name at the same municipality
  { place: "Lhota, Dlouhá", known: { lhota: ["dlouha"] } },
  { place: "Lhota, DLOUHA", known: { lhota: ["dlouha"] } },
  { place: "Lhotinka, Dlouhá", known: { lhota: ["dlouha"] }, note: "a street of another municipality's houses" },
  // never split: a part of the village, a parish, a district, a saint, a number alone after the name
  { place: "Lhota" },
  { place: "Lhota, okres Horní" },
  { place: "Lhota, Horní Lhota" },
  { place: "Lhota, farnost Lhotinka" },
  { place: "Lhota, St. Martin" },
  { place: "Lhota, Ostr." },
  { place: "Lhota, Lhotecká" },
  { place: "Lhota, Dlouhá", note: "without the houses: unclear" },
  { place: "Lhota u Lhotína" },
  { place: "Lhota, 3. díl" },
  { place: "Lhotau, 3. Teil" },
  { place: "Lhotín, Lhotín 5", note: "the municipality's own name with a number: a part of it" },
  { place: "Bergweg, okres Horní" },
  { place: "Лхота, Московская область" },
  { place: "Lhota 16", note: "a number alone after the name: see bare" },
  { place: "Praha 5" },
  { place: "Brno 2" },
];

const bare = [
  "Lhota 16",
  "Lhota 16a",
  "Lhota 13/2",
  "Horní Lhota 3",
  "Lhota 16, okres Horní",
  "Лхота 5",
  "Praha 5",
  "Lhota",
  "Lhota č. p. 16",
  "16 Lhota",
  "16",
  "Lhota, 16",
];

const numbered = ["Praha", "praha", "Wien", "Brno", "Lhota", "Lhota 5"];

const houses: [string, string | undefined][] = [
  ["Dlouhá 12", undefined],
  ["nám. Míru", "5"],
  ["Dlouhá", "Dlouhá 88"],
  ["Dlouhá 12", "dlouhá 12"],
  ["16", "16"],
  ["16", undefined],
  ["nám. Míru 9", "Horní 4"],
  ["Dlouhá 12", "7"],
  ["Dlouhá", "Horní 4"],
  ["16", "Dlouhá 3"],
];

const folds = ["Dlouhá", "NÁMĚSTÍ  Míru", "Hauptstraße", "Łódź", "Øster Allé", "Й улица", "Lhotín 3a".normalize("NFD"), " Ленина "];

const out = {
  about:
    "Shared cases of the rules telling a street and a house number in the place of a fact (strom-research src/core/streets.ts, " +
    "words in assets/terms/streets.json). Each input is also run decomposed (NFD): the result is the same, written composed (NFC). " +
    "split: splitStreet(place, known) — town (the place without them), house (as written), by: word | known; null: the place stays. " +
    "known: the streets the houses of facts name at a municipality, by its first part folded (no accents, lower case). " +
    "bare: bareNumber(place) — a number alone after the name (name, town, house); never split by rules, a house only on a person's word " +
    "for the whole municipality; null: no such number. numbered: whether the terms say the municipality's numbers are its parts. " +
    "houseWith: the house of a fact whose place held `street` beside the house it had; null: the house says another thing (left). " +
    "fold: foldText — how every word is compared (NFD, marks dropped, ß ss, ł l, đ d, ø o, æ ae, œ oe, þ th, lower case, spaces one). " +
    "Written by test/fixtures/streets/make-cases.ts.",
  split: split.map((c) => ({ ...c, expect: splitStreet(c.place, c.known ? known(c.known) : undefined) ?? null })),
  bare: bare.map((place) => ({ place, expect: bareNumber(place) ?? null })),
  numbered: numbered.map((name) => ({ name, expect: numberedTown(name) })),
  fold: folds.map((text) => ({ text, expect: foldText(text) })),
  houseWith: houses.map(([street, had]) => ({ street, ...(had !== undefined ? { had } : {}), expect: houseWith(street, had) ?? null })),
};
fs.writeFileSync(path.join(here, "cases.json"), JSON.stringify(out, null, 2) + "\n");
