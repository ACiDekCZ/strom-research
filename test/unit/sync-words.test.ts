// What a conflict of the user's edit says, in the research's language (found photographing the Polish app): a house that
// says it is a house already never gets the marker twice ("nr domu nr domu 12"), and the title's dash is the language's.

import { test } from "node:test";
import assert from "node:assert/strict";
import { houseWords } from "../../src/core/sync.ts";
import { ui } from "../../src/cli/ui.ts";

test("a house with its marker already: as it is; a number alone: the language's marker before it", () => {
  assert.equal(houseWords("pl", "nr domu 12"), "nr domu 12");
  assert.equal(houseWords("pl", "Nr domu 12"), "Nr domu 12");
  assert.equal(houseWords("pl", "12"), "nr domu 12");
  assert.equal(houseWords("cs", "čp. 12"), "čp. 12");
  assert.equal(houseWords("cs", "čp. 12".normalize("NFD")), "čp. 12".normalize("NFD"));
  assert.equal(houseWords("cs", "12"), "čp. 12");
  assert.equal(houseWords("de", "Nr. 3"), "Nr. 3");
  assert.equal(houseWords("de", "3"), "Haus Nr. 3");
  assert.equal(houseWords("en", "Dlouhá 12"), "house Dlouhá 12");
  assert.equal(houseWords("ru", "д. 5"), "д. 5");
});

test("a conflict's title: the dash of the language (en an em dash, cs/de/pl an en dash with spaces)", () => {
  const p = { who: "Jan Lhoták", what: "Narození", ours: "1904", theirs: "1905" };
  assert.equal(ui("en", "ui.conflict.title", p), "Jan Lhoták: Narození — 1904 × 1905");
  for (const lang of ["cs", "de", "pl"]) assert.equal(ui(lang, "ui.conflict.title", p), "Jan Lhoták: Narození – 1904 × 1905", lang);
});
