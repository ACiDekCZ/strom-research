// P3: the brief's token estimate follows what a real tokenizer gives — plain ASCII about 2.5 characters a token, a
// word with any other letter (diacritics, another script) about one — so a budget of n tokens is n tokens.

import { test } from "node:test";
import assert from "node:assert/strict";
import { tokens } from "../../src/brief/brief.ts";

test("tokens: plain English at about 2.5 characters a token", () => {
  const en = "Read the entry in the register itself and record the search with what it covered. ".repeat(10);
  assert.equal(tokens(en), Math.ceil(en.length / 2.5));
});

test("tokens: a word with a diacritic or of another script costs about a token a character", () => {
  const cs = "Křest Františka Kadeřábka, syn Jana, domkáře v Bříství čp. 3";
  // more than the old characters / 3.5, and more than the same letters without the accents
  assert.ok(tokens(cs) > Math.ceil(cs.length / 3.5) * 1.5, `${tokens(cs)}`);
  assert.ok(tokens(cs) > tokens(cs.normalize("NFD").replace(/\p{M}/gu, "")));
  // decomposed input counts at least as much as composed
  assert.ok(tokens(cs.normalize("NFD")) >= tokens(cs));
  // Cyrillic, Greek: every letter
  const ru = "Іван Шевчук, син Петра";
  assert.ok(tokens(ru) >= ru.replace(/\s/gu, "").length - 1, `${tokens(ru)}`);
  assert.equal(tokens(""), 0);
});
