// The occupations a word asked for finds (assets/terms/occupations.json): its forms in Czech, German, Latin and
// Polish, folded (accents, case, ß, ł; a decomposed input), each by the start of a word of a value; a word not in the
// list only itself; `exact` the word alone as a whole word. Made-up values only.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { occupationMatcher } from "../../src/core/occupations.ts";
import { assetPath } from "../../src/core/assets.ts";

test("a miller in any language of the list, by the start of a word, with or without accents", () => {
  const m = occupationMatcher("mlynar");
  assert.equal(m.known, true);
  for (const v of ["mlynář", "Müller", "Mueller", "molitor", "molinarius", "młynarz"]) assert.ok(m.variants.includes(v), v);
  for (const text of ["mlynář", "mlynáře v Lhotě", "MLYNÁŘSKÝ mistr", "Müllermeister", "molitoris", "molinarii", "młynarza", "Mühlner zu Lhota", "Mueller"])
    assert.ok(m.matches(text), text);
  for (const text of ["sedlák", "kovář", "mlýn", "Lhota č. 12", "", undefined]) assert.equal(m.matches(text), false, String(text));
});

test("the word asked for may be any form of the group, with accents, in capitals, decomposed (NFD) or inflected", () => {
  for (const asked of ["mlynář", "MLYNÁŘ", "mlynář", "Müller", "MUELLER", "molitor", "młynarz", "MŁYNARZ", "mlynáře"]) {
    const m = occupationMatcher(asked);
    assert.equal(m.known, true, asked);
    assert.ok(m.matches("molitor"), `${asked} finds molitor`);
    assert.ok(m.matches("Mlynářka"), `${asked} finds Mlynářka`);
  }
  assert.equal(occupationMatcher("mlynář").word, "mlynář", "the word kept in NFC");
});

test("forms by their stem: a feminine, a Latin -us, a Czech word that changes inside", () => {
  assert.ok(occupationMatcher("děvečka").matches("děvečky u sedláka"));
  assert.ok(occupationMatcher("sedlák").matches("coloni filius"));
  assert.ok(occupationMatcher("švec").matches("ševcovský tovaryš"));
  assert.ok(occupationMatcher("ševce").matches("Schuhmacher"));
  assert.ok(occupationMatcher("řezník").matches("řeznický mistr"));
  assert.ok(occupationMatcher("kovář").matches("fabri ferrarii"));
});

test("German ü, ö and ß, Polish ł", () => {
  assert.ok(occupationMatcher("Töpfer").matches("hrnčíř"));
  assert.ok(occupationMatcher("hrnčíř").matches("TOEPFER") === false, "no ue read as ü that the list does not give");
  assert.ok(occupationMatcher("zámečník").matches("Schloßermeister"), "ß folded to ss");
  assert.ok(occupationMatcher("Schlosser").matches("zámečnický"));
  assert.ok(occupationMatcher("kołodziej").matches("kolář"));
  assert.ok(occupationMatcher("kolodziej").matches("Kołodziej"));
  assert.ok(occupationMatcher("Tagelöhner").matches("nádenice"));
});

test("a word that only begins like the occupation is found: the caller looks in occupations, not in names", () => {
  const m = occupationMatcher("mlynar");
  assert.ok(m.matches("Mlynařík"), "by the start of a word");
  assert.ok(m.matches("hostinský, mlynářův syn"));
  assert.equal(m.matches("Lhoták Mlynarovič"), true);
  // the asked word inflected joins its group; one that only begins like it does not
  assert.equal(occupationMatcher("mlynarik").known, false);
  assert.deepEqual(occupationMatcher("mlynarik").variants, ["mlynarik"]);
  assert.equal(occupationMatcher("mlynarik").matches("Müller"), false);
});

test("a word not in the list finds only itself, by the start of a word", () => {
  const m = occupationMatcher("Lhoták");
  assert.equal(m.known, false);
  assert.deepEqual(m.variants, ["Lhoták"]);
  assert.ok(m.matches("lhotákův statek"));
  assert.ok(m.matches("LHOTAK"));
  assert.equal(m.matches("Lhota"), false);
  assert.equal(m.matches("Velký Lhoták"), true, "any word of the value");
  const cyr = occupationMatcher("мельник");
  assert.ok(cyr.matches("Мельник в селе"), "another script, case folded");
  assert.equal(cyr.matches("мель"), false);
});

test("exact: the word alone, as a whole word, without its group", () => {
  const m = occupationMatcher("mlynář", { exact: true });
  assert.equal(m.known, true);
  assert.deepEqual(m.variants, ["mlynář"]);
  assert.ok(m.matches("Mlynář"));
  assert.ok(m.matches("mlynář v Lhotě"), "a decomposed value");
  assert.equal(m.matches("mlynáře"), false);
  assert.equal(m.matches("Müller"), false);
  assert.equal(m.matches("Mlynařík"), false);
});

test("nothing asked finds nothing", () => {
  assert.equal(occupationMatcher("  ").matches("mlynář"), false);
  assert.deepEqual(occupationMatcher("").variants, []);
  assert.equal(occupationMatcher("—").matches("—"), false);
});

test("the list: about, groups of one word per form, no form in two groups, every group findable from each form", () => {
  const file = JSON.parse(fs.readFileSync(assetPath("terms", "occupations.json"), "utf8")) as { about: string; groups: Record<string, string[]>[] };
  assert.ok(file.about.length > 20);
  assert.ok(file.groups.length >= 40, `${file.groups.length} groups`);
  const seen = new Map<string, number>();
  file.groups.forEach((g, i) => {
    for (const [lang, forms] of Object.entries(g)) {
      assert.ok(["cs", "de", "la", "pl"].includes(lang), lang);
      for (const f of forms) {
        assert.equal(f, f.normalize("NFC"), f);
        assert.ok(/^[\p{L}\p{M}]+$/u.test(f), `one word: ${f}`);
        const had = seen.get(f.toLowerCase());
        assert.ok(had === undefined || had === i, `${f} in two groups`);
        seen.set(f.toLowerCase(), i);
        const m = occupationMatcher(f);
        assert.ok(m.known, f);
        for (const other of Object.values(g).flat()) assert.ok(m.matches(other), `${f} finds ${other}`);
      }
    }
  });
});
