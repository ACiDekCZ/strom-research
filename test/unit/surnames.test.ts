// The forms of a surname (core/surnames.ts): the ID of a group, the sound of a form, a quote cut between characters
// only, the Strom app's header notes read, and what a sync of them changes in three states.

import { test } from "node:test";
import assert from "node:assert/strict";
import { badForm, byCodePoint, damagedText, isWomansForm, phoneticKey, planSurnames, quoteOf, readMarkLines, surnameGroupId, type SurnameEntry, type SurnameMarks, type SurnamesFile } from "../../src/core/surnames.ts";
import { parseGedcomText } from "../../src/gedcom/parse.ts";

test("the ID of a group: folded, a woman's form the man's, each once, by code point — whatever order or normal form", () => {
  assert.equal(surnameGroupId(["Lhoták", "Lhotaa"]), "lhotaa|lhotak");
  assert.equal(surnameGroupId(["Lhotaa", "Lhoták"]), "lhotaa|lhotak", "the order given says nothing");
  assert.equal(surnameGroupId(["Lhoták".normalize("NFD"), "Lhotaa"]), "lhotaa|lhotak");
  assert.equal(surnameGroupId(["Lhoták", "Lhotaa"]), "lhotaa|lhotak", "decomposed input");
  assert.equal(surnameGroupId(["Lhotáková", "Lhotaa"]), "lhotaa|lhotak", "a woman's form is the man's");
  assert.equal(surnameGroupId(["Lhotáková", "Lhoták"]), "lhotak", "one form already");
  assert.equal(surnameGroupId(["Lhotná", "Lhotný", "Lhotaa"]), "lhotaa|lhotny");
  assert.equal(surnameGroupId(["Lhotska", "Lhotski"]), "lhotski");
  assert.equal(surnameGroupId(["Лхотакова", "Лхотаков", "Лгота"]), "лгота|лхотаков");
  assert.equal(surnameGroupId(["Lhoß", "Lhoss"]), "lhoss");
  assert.equal(surnameGroupId(["Łhota", "Lhota", "Lhotaa"]), "lhota|lhotaa");
  assert.equal(surnameGroupId(["  Lhota ", "Lhotaa", ""]), "lhota|lhotaa");
  // a form of no woman's ending a language tells apart is its own: Lhotinka stays Lhotinka
  assert.equal(surnameGroupId(["Lhotinka", "Lhota"]), "lhota|lhotinka");
  assert.equal(isWomansForm("Lhotinka"), false);
  assert.equal(isWomansForm("Lhotinková"), true);
  // by code point, never UTF-16 units: a letter beyond the BMP sorts after U+FFxx
  assert.ok(byCodePoint("\u{1D400}", "Ａ") > 0);
});

test("the sound of a form: the spellings of one sound as one, a doubled letter single", () => {
  assert.equal(phoneticKey("lhotaa"), phoneticKey("lhota"));
  assert.equal(phoneticKey("lhotha"), phoneticKey("lhota"));
  assert.equal(phoneticKey("wlhota"), phoneticKey("vlhota"));
  assert.equal(phoneticKey("lhotschka"), phoneticKey("lhotska"));
  assert.notEqual(phoneticKey("lhotinka"), phoneticKey("lhota"));
});

test("a quote: at most 200 code points after NFC, never a character cut (emoji, combining marks, CJK)", () => {
  const pieces = ["a", "é", "é", "👨‍👩‍👧", "🇨🇿", "東", "Ж", "ẍ́", "ß", "\u{1D400}"];
  let seed = 7;
  for (let round = 0; round < 300; round++) {
    let text = "";
    const n = 150 + (round % 120);
    for (let i = 0; i < n; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      text += pieces[seed % pieces.length];
    }
    const q = quoteOf(text);
    assert.ok(Array.from(q).length <= 200, "at most 200 code points");
    assert.equal(q, q.normalize("NFC"));
    // the cut: what is left is whole characters of the text (the next character continues it exactly)
    const all = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text.normalize("NFC"))].map((s) => s.segment);
    let joined = "";
    for (const g of all) {
      if (joined === q) break;
      joined += g;
    }
    assert.equal(joined, q, "cut between characters only");
    assert.ok(!damagedText(q));
  }
  assert.equal(quoteOf("  krátký   text "), "krátký text");
});

test("forms refused: empty, with the separator, damaged characters", () => {
  assert.equal(badForm(""), "empty");
  assert.equal(badForm("Lho|ta"), "separator");
  assert.equal(badForm("Lho�ta"), "damaged");
  assert.equal(badForm("Lho\uD83Dta"), "damaged", "half of a surrogate pair");
  assert.equal(badForm("Lhota"), "");
});

test("the header's notes: CONT a group, CONC under it the same line, \" | \" apart; one form, empty form, damaged text", () => {
  const text = [
    "0 HEAD",
    "1 SOUR STROM",
    "2 VERS 3.17.0",
    "1 NOTE Strom surname-variant groups",
    "2 CONT Lhota | Lhot",
    "3 CONC aa | Lhotha",
    "2 CONT Lhotinka",
    "2 CONT Lhoták |  | Lhotak",
    "1 NOTE Strom surname-variant rejections",
    "0 TRLR",
  ].join("\n");
  const head = parseGedcomText(text).records.find((r) => r.tag === "HEAD")!;
  const notes = head.children.filter((c) => c.tag === "NOTE").map((n) => n.value.split("\n"));
  const marks: SurnameMarks = { warnings: [] };
  readMarkLines("groups", notes[0]!.slice(1), marks);
  readMarkLines("rejected", notes[1]!.slice(1), marks);
  assert.deepEqual(marks.groups, [["Lhota", "Lhotaa", "Lhotha"]], "the CONC line goes on; a group of one form dropped; an empty form refused");
  assert.deepEqual(marks.rejected, [], "an empty note: the app has none");
  assert.deepEqual(marks.partial, ["groups"]);
  assert.equal(marks.warnings[0]!.why, "empty");
  const damaged: SurnameMarks = { warnings: [] };
  readMarkLines("groups", ["Lhota | Lho�ta"], damaged);
  assert.equal(damaged.groups, undefined, "damaged text: the list as if not there");
  assert.equal(damaged.warnings[0]!.why, "damaged");
});

test("the parser: a line continued below its CONT (CONC at the level under it) goes on, never lost", () => {
  const { records } = parseGedcomText(["0 @N1@ NOTE first", "1 CONT sec", "2 CONC ond", "1 CONC !", "1 CONT third", "0 TRLR"].join("\n"));
  assert.equal(records[0]!.value, "first\nsecond!\nthird");
});

const entry = (forms: string[], at = "2026-10-01T10:00:00.000Z", by: SurnameEntry["by"] = "research"): SurnameEntry => ({ id: surnameGroupId(forms), forms, at, by });
const file = (groups: SurnameEntry[], rejected: SurnameEntry[] = []): SurnamesFile => ({ groups, rejected });
const marks = (groups?: string[][], rejected?: string[][], day = "2026-10-20"): SurnameMarks => ({ ...(groups ? { groups } : {}), ...(rejected ? { rejected } : {}), warnings: [], day });

test("a sync of the groups: a marker missing changes nothing; added; removed; changed; three states", () => {
  const a = entry(["Lhota", "Lhotaa"]);
  const b = entry(["Lhotinka", "Lhottinka"]);
  const now = file([a, b], [entry(["Lhoták", "Lhotinka"])]);
  // no marker at all: nothing, not even a removal
  assert.deepEqual(planSurnames(now, undefined, file([a, b])), []);
  assert.deepEqual(planSurnames(now, marks(undefined, undefined), file([a, b])), []);
  // the same as given: nothing
  assert.deepEqual(planSurnames(now, marks([a.forms, b.forms], [["Lhoták", "Lhotinka"]]), now), []);
  // an empty marker: the app has none — what the research gave and kept as it was is taken away
  const gone = planSurnames(now, marks([], []), now);
  assert.deepEqual(gone.map((c) => [c.list, c.how, c.replaces]), [["groups", "remove", [a.id]], ["groups", "remove", [b.id]], ["rejected", "remove", ["lhotak|lhotinka"]]]);
  // added in the app
  const added = planSurnames(now, marks([a.forms, b.forms, ["Lhotecký", "Lhoteckí"]]), now);
  assert.deepEqual(added.map((c) => [c.how, c.forms]), [["add", ["Lhotecký", "Lhoteckí"]]]);
  // changed in the app (a form more): the file's forms
  const changed = planSurnames(now, marks([[...a.forms, "Lhotha"], b.forms]), now);
  assert.deepEqual(changed.map((c) => [c.how, c.forms, c.replaces]), [["set", ["Lhota", "Lhotaa", "Lhotha"], [a.id]]]);
  // the research took a group away since it gave it: the app's copy does not bring it back
  assert.deepEqual(planSurnames(file([b]), marks([a.forms, b.forms]), now), []);
  // changed in both: the newer — the research's decided after the file was written stays (said)
  const later = file([entry(["Lhota", "Lhotaa", "Lhotah"], "2026-10-25T08:00:00.000Z"), b]);
  const both = planSurnames(later, marks([[...a.forms, "Lhotha"], b.forms], undefined, "2026-10-20"), now);
  assert.deepEqual(both.map((c) => c.how), ["kept"]);
  const earlier = file([entry(["Lhota", "Lhotaa", "Lhotah"], "2026-10-10T08:00:00.000Z"), b]);
  assert.deepEqual(planSurnames(earlier, marks([[...a.forms, "Lhotha"], b.forms], undefined, "2026-10-20"), now).map((c) => c.how), ["set"], "the app's newer");
  // removed in the app, changed by the research since: the research's newer stays
  assert.deepEqual(planSurnames(later, marks([b.forms]), now).map((c) => c.how), ["kept"]);
  // a marker with a line refused: nothing of that list taken away
  assert.deepEqual(planSurnames(now, { ...marks([b.forms]), partial: ["groups"] }, now), []);
});

test("a sync of the groups without what the research gave: additions only, a group of the research grown", () => {
  const a = entry(["Lhota", "Lhotaa"]);
  const now = file([a]);
  assert.deepEqual(planSurnames(now, marks([]), undefined), [], "nothing taken away");
  assert.deepEqual(planSurnames(now, marks([["Lhotinka", "Lhottinka"]]), undefined).map((c) => c.how), ["add"]);
  assert.deepEqual(planSurnames(now, marks([["Lhota", "Lhotaa", "Lhotha"]]), undefined).map((c) => c.how), ["set"], "a superset of one group");
  assert.deepEqual(planSurnames(now, marks([["Lhota", "Lhotha"]]), undefined).map((c) => c.how), ["kept"], "overlapping otherwise: only said");
  assert.deepEqual(planSurnames(now, marks(undefined, [["Lhoták", "Lhotinka"]]), undefined).map((c) => [c.list, c.how]), [["rejected", "add"]]);
});
