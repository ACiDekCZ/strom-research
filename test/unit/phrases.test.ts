// Texts strom writes into a research come in its language: every catalog has
// only known keys, each with the same {values} as the English text.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PHRASES, catalog, phrase } from "../../src/core/phrases.ts";
import { assetPath } from "../../src/core/assets.ts";
import { UI } from "../../src/cli/ui.ts";

const ENGLISH: Record<string, string> = { ...PHRASES, ...UI };

const values = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

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

test("phrase: the research language, English where a language has no text", () => {
  assert.equal(phrase("cs", "link.what", { name: "Jan Novák", place: "", about: "" }), "Křest: Jan Novák");
  assert.equal(phrase("en", "link.what", { name: "Jan Novák", place: "", about: "" }), "Baptism of Jan Novák");
  assert.equal(phrase("xx", "reason.unknown"), "parents unknown", "no catalog: English");
  assert.equal(phrase("../cs", "reason.unknown"), "parents unknown", "not a path");
});
