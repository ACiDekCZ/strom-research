// Where an entry stands in its book, field by field (spec 075; core/sourcefields.ts): the folio and the image a
// locator names (a proposal only), the readable PAGE composed of the fields given, the image of the registered scans.

import { test } from "node:test";
import assert from "node:assert/strict";
import { composedPage, imageNumbers, locatorOverlap, recognizeLocation, sourceCallNumber, sourceImage } from "../../src/core/sourcefields.ts";
import { splitOf } from "../../src/core/sourcesplit.ts";
import type { Media, Source } from "../../src/core/model.ts";
import fs from "node:fs";

/**
 * The cases of recognising an older locator, shared with the Strom app (its ZADANI_VYZKUM_citace-pole.md, request C):
 * each locator's folio, image and the rest proposed with them (null: nothing recognised, or nothing left).
 */
const CASES = JSON.parse(fs.readFileSync(new URL("../fixtures/source-locations.json", import.meta.url), "utf8")) as { locator: string; lang: string; folio: string | null; image: string | null; rest: string | null; why?: string }[];

test("recognised in a locator: the folio with its word as it stands, the image's number — in any language, NFD, with a side and a range", () => {
  assert.deepEqual(recognizeLocation("fol. 12v, snímek 34"), { folio: "fol. 12v", image: "34" });
  assert.deepEqual(recognizeLocation("pag. 112, č. 3"), { folio: "pag. 112" });
  assert.deepEqual(recognizeLocation("S. 15, Bild 7"), { folio: "S. 15", image: "7" });
  assert.deepEqual(recognizeLocation("strona 40–41, skan nr 57–58"), { folio: "strona 40–41", image: "57–58" });
  assert.deepEqual(recognizeLocation("f. 3r - 4v"), { folio: "f. 3r - 4v" });
  assert.deepEqual(recognizeLocation("folio 7 r"), { folio: "folio 7 r" });
  // decomposed input (NFD) reads as composed
  assert.deepEqual(recognizeLocation("Snímek č. 12".normalize("NFD")), { image: "12" });
  // another script: a Cyrillic word is no folio, a Polish/Russian "kadr" an image
  assert.deepEqual(recognizeLocation("лист 12, kadr 9"), { image: "9" });
  // a word inside another word is none ("Spf. 3" no folio, "ascan 4" no image), a number of a word no number
  assert.deepEqual(recognizeLocation("Spf. 3, ascan 4"), {});
  assert.deepEqual(recognizeLocation("č. 3, řádek 2"), {});
  assert.deepEqual(recognizeLocation(""), {});
  assert.deepEqual(recognizeLocation(undefined), {});
});

test("the PAGE composed: the folio, the rest of the location, the image in the research's language — the locator alone exactly when neither is given; nothing said twice", () => {
  assert.equal(composedPage({ locator: "fol. 12, č. 3" }, "cs"), "fol. 12, č. 3", "an existing source: its locator as it is");
  assert.equal(composedPage({}, "cs"), undefined);
  assert.equal(composedPage({ folio: "pag. 112", locator: "č. 3", image: "57" }, "cs"), "pag. 112, č. 3, snímek 57");
  assert.equal(composedPage({ folio: "fol. 12v", image: "34" }, "en"), "fol. 12v, image 34");
  assert.equal(composedPage({ image: "7" }, "de"), "Bild 7");
  assert.equal(composedPage({ folio: "strona 40" }, "pl"), "strona 40");
  // a locator that says the folio or the image already
  assert.equal(composedPage({ folio: "pag. 112", locator: "pag. 112, č. 3" }, "cs"), "pag. 112, č. 3");
  assert.equal(composedPage({ image: "57", locator: "Snímek 57, č. 3".normalize("NFD") }, "cs"), "Snímek 57, č. 3".normalize("NFD"));
});

test("N1: a locator that names the image or folio a field gives too — the PAGE says one number: the same once as the locator says it (any word, any language), another the field's; the locator itself unchanged", () => {
  // the reproduction: an older source's locator, an image given after its link moved
  assert.equal(composedPage({ locator: "fol. 12, snímek 3", image: "4" }, "cs"), "fol. 12, snímek 4");
  assert.equal(composedPage({ locator: "fol. 12, snímek 3", image: "3" }, "cs"), "fol. 12, snímek 3");
  // another word for the image than the research's
  assert.equal(composedPage({ locator: "f. 9, scan 101", image: "101" }, "cs"), "f. 9, scan 101");
  assert.equal(composedPage({ locator: "f. 9, scan 101", image: "102" }, "cs"), "f. 9, snímek 102");
  assert.equal(composedPage({ locator: "Taufe Nr. 5, snímek 34", image: "34" }, "de"), "Taufe Nr. 5, snímek 34");
  assert.equal(composedPage({ locator: "Taufe Nr. 5, snímek 34", image: "35" }, "de"), "Taufe Nr. 5, Bild 35");
  assert.equal(composedPage({ locator: "entry 4, Bild 7–8", image: "7-8" }, "en"), "entry 4, Bild 7–8", "a range, another dash");
  assert.equal(composedPage({ locator: "entry 4 (img. 7)", image: "9" }, "en"), "entry 4, image 9", "in brackets: the brackets go with it");
  assert.equal(composedPage({ locator: "Snímek č. 3".normalize("NFD"), image: "4" }, "cs"), "snímek 4", "decomposed, the image alone");
  // the folio: the same number by another word once, another the field's, a whole number only ("fol. 1" is not "fol. 12")
  assert.equal(composedPage({ locator: "fol. 12, č. 5", folio: "f. 12" }, "cs"), "fol. 12, č. 5");
  assert.equal(composedPage({ locator: "fol. 12, č. 5", folio: "fol. 13" }, "cs"), "fol. 13, č. 5");
  assert.equal(composedPage({ locator: "fol. 12, č. 5", folio: "fol. 1" }, "cs"), "fol. 1, č. 5");
  assert.equal(composedPage({ locator: "S. 15, Eintrag 3", folio: "Seite 16", image: "40" }, "de"), "Seite 16, Eintrag 3, Bild 40");
  assert.equal(composedPage({ locator: "strona 40, skan 57", folio: "strona 40", image: "58" }, "pl"), "strona 40, skan 58");
  assert.equal(composedPage({ locator: "č. 12", folio: "12" }, "cs"), "12, č. 12", "a bare folio is no word the locator says");
  assert.equal(composedPage({ locator: "лист 3, kadr 9", image: "10" }, "cs"), "лист 3, snímek 10", "another script beside it");
});

test("what of the locator the fields say too: the folio and image it names, the same or not, and its rest", () => {
  assert.deepEqual(locatorOverlap({ locator: "fol. 12, snímek 3", image: "4" }), { image: { named: "3", same: false }, rest: "fol. 12" });
  assert.deepEqual(locatorOverlap({ locator: "fol. 12, č. 5, scan 101", folio: "f. 12", image: "101" }), { folio: { named: "fol. 12", same: true }, image: { named: "101", same: true }, rest: "č. 5" });
  assert.deepEqual(locatorOverlap({ locator: "snímek 3", image: "4" }), { image: { named: "3", same: false }, rest: "" });
  assert.equal(locatorOverlap({ locator: "č. 5", image: "4" }), undefined, "names neither");
  assert.equal(locatorOverlap({ locator: "fol. 12, snímek 3" }), undefined, "no field: nothing said twice");
});

test("the forms older locators are written in: a side said in full, two folios or images (which one?) none, a number going on with a letter none, the separators around a part taken out tidied", () => {
  assert.deepEqual(recognizeLocation("folio 31 recto, 3. Eintrag"), { folio: "folio 31 recto" });
  assert.deepEqual(recognizeLocation("fol. 9 verso"), { folio: "fol. 9 verso" });
  assert.deepEqual(recognizeLocation("S. 12 der Ausgabe (PDF S. 14), fol. 3r"), {}, "two folios: neither proposed");
  assert.deepEqual(recognizeLocation("fol. 1, snímek 3, snímek 4"), { folio: "fol. 1" }, "two images: no image");
  assert.deepEqual(recognizeLocation("Pag. 1ma, Abschnitt A"), {}, "an ordinal is no page");
  assert.deepEqual(recognizeLocation("fol. 12a"), {});
  assert.deepEqual(recognizeLocation("obr. 16, str. 9"), { folio: "str. 9", image: "16" });
  const split = (s: Partial<Source>) => splitOf({ id: "S0001", type: "source", title: "t", ...s } as Source, () => undefined);
  assert.deepEqual(split({ locator: "scan 19 = fol. 7" }), { folio: "fol. 7", image: "19" });
  assert.deepEqual(split({ locator: "entry 4 = p. 9" }), { locator: "entry 4", folio: "p. 9" });
  assert.deepEqual(split({ locator: "018 = folio 5 recto — read in ink, top right", image: "18" }), { locator: "018, read in ink, top right", folio: "folio 5 recto", image: "18" });
  assert.deepEqual(split({ locator: "zápis č. 7 — fol. 3" }), { locator: "zápis č. 7", folio: "fol. 3" });
  assert.equal(split({ locator: "S. 12 der Ausgabe (PDF S. 14), fol. 3r" }), undefined, "nothing taken from what is not clear");
  assert.equal(split({ locator: "č. 8" }), undefined);
});

test("the image of a source: its own, else the numbers of its registered images and clips, sorted, a run or a list; the call number its own, else its book's", () => {
  const media = new Map<string, Partial<Media>>([
    ["M1", { image: 58 }],
    ["M2", { image: 57 }],
    ["M3", { image: 60 }],
    ["M4", {}],
  ]);
  const of = (id: string) => media.get(id) as Media | undefined;
  assert.deepEqual(sourceImage({ image: "12" , media: ["M1"] }, of), { value: "12", derived: false });
  assert.deepEqual(sourceImage({ media: ["M1"], clips: [{ media: "M2" } as never] }, of), { value: "57–58", derived: true });
  assert.deepEqual(sourceImage({ media: ["M1", "M3", "M2"] }, of), { value: "57, 58, 60", derived: true });
  assert.equal(sourceImage({ media: ["M4", "M9"] }, of), undefined);
  assert.equal(sourceImage({}, of), undefined);
  assert.equal(imageNumbers([5]), "5");
  assert.equal(sourceCallNumber({ callNumber: "Lhota 7" }, { callNumber: "Lhota 8" }), "Lhota 7");
  assert.equal(sourceCallNumber({}, { callNumber: "Lhota 8" }), "Lhota 8");
  assert.equal(sourceCallNumber({ callNumber: " " }, undefined), undefined);
});

test("the cases shared with the Strom app (test/fixtures/source-locations.json): every one recognised as the table says — cs, en, de, pl, another script, NFD, the unclear ones none", () => {
  assert.ok(CASES.length >= 30);
  for (const lang of ["cs", "en", "de", "pl"]) assert.ok(CASES.some((c) => c.lang === lang), lang);
  assert.ok(CASES.some((c) => c.locator !== c.locator.normalize("NFC")), "a decomposed one");
  assert.ok(CASES.some((c) => c.locator.startsWith("S. 12 der Ausgabe (PDF S. 14)")), "the edition's two pages");
  for (const c of CASES) {
    const found = recognizeLocation(c.locator);
    assert.deepEqual([found.folio ?? null, found.image ?? null], [c.folio, c.image], c.locator);
    const rest = found.folio || found.image ? locatorOverlap({ locator: c.locator, ...found })?.rest || null : null;
    assert.equal(rest, c.rest, c.locator);
    if (rest) assert.equal(rest, rest.normalize("NFC"), "the rest in NFC");
    // the same as the split proposes for a source without fields
    const split = splitOf({ id: "S0001", type: "source", title: "t", locator: c.locator } as Source, () => undefined);
    assert.deepEqual(split ?? null, c.folio || c.image ? { ...(c.rest ? { locator: c.rest } : {}), ...(c.folio ? { folio: c.folio } : {}), ...(c.image ? { image: c.image } : {}) } : null, c.locator);
  }
});
