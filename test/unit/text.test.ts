// Matching text across spellings, diacritics and scripts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { foldText, readable, tokens } from "../../src/core/text.ts";
import { roleWord } from "../../src/core/roles.ts";

test("folding: diacritics go, letters that do not decompose are spelled out", () => {
  assert.deepEqual(
    ["Víšek", "Łódź", "Straße", "Đurić", "Æbelø", "Œuvre", "Þórr", "İstanbul", "Шевчук"].map(foldText),
    ["visek", "lodz", "strasse", "duric", "aebelo", "oeuvre", "thorr", "istanbul", "шевчук"],
  );
  assert.deepEqual(tokens("Іван  Шевчук, 1862"), ["іван", "шевчук", "1862"]);
  assert.deepEqual(tokens("Antonín /Víšek/"), ["antonin", "visek"]);
});

test("roles in the language of the record", () => {
  const words = ["kmotra", "Pate", "svědkyně", "Trauzeuge", "porodní bába", "Hebamme", "farář", "oddávající", "oznamovatel", "účastník", "godparent", "soused"];
  assert.deepEqual(words.map(roleWord), ["godparent", "godparent", "witness", "witness", "midwife", "midwife", "officiant", "officiant", "informant", "other", "godparent", undefined]);
  // a Latin register: the godparent lifts the child, the wedding has paranymphs, the parish priest wrote "copulavi"
  assert.deepEqual(
    ["Patrinus", "Patrina", "Levans", "Susceptor", "Paranymphus", "Paranympha", "Testes", "Parochus", "Capellanus", "copulavi", "Baptizans", "Baptizatus", "Parentes"].map(roleWord),
    ["godparent", "godparent", "godparent", "godparent", "witness", "witness", "witness", "officiant", "officiant", "officiant", "officiant", undefined, undefined],
  );
});

test("a page as it reads: character references and script escapes written out, each character traced to the page", () => {
  const page = String.raw`<p>st&aacute;hnout &Scaron;&uring;&odblac; tla&#269;&#xED;tko&nbsp;A&amp;B &Omega; &#1052;&#1086;&#1089;&#1082;&#1074;&#1072; &#128512;</p><script>v(["https:\/\/x.example\/f=Knížka", "\"q\"", "a\\u00e1"]);</script>`;
  const r = readable(page)!;
  assert.equal(r.text, '<p>stáhnout Šůő tlačítko A&B Ω Москва \u{1f600}</p><script>v(["https://x.example/f=Knížka", ""q"", "a\\u00e1"]);</script>');
  assert.equal(r.at.length, r.text.length + 1);
  assert.equal(r.at[r.text.length], page.length);
  const where = (t: string) => {
    const i = r.text.indexOf(t);
    return page.slice(r.at[i], r.at[i + t.length]);
  };
  assert.equal(where("stáhnout"), "st&aacute;hnout");
  assert.equal(where("tlačítko"), "tla&#269;&#xED;tko");
  assert.equal(where("Москва"), "&#1052;&#1086;&#1089;&#1082;&#1074;&#1072;");
  assert.equal(where("https://x.example/f=Knížka"), String.raw`https:\/\/x.example\/f=Knížka`);
  assert.equal(where("\u{1f600}"), "&#128512;", "a character outside the basic plane");
  // what is not a reference stays as it is: an unknown name, &odot; (not a letter), no semicolon, a bare ampersand
  assert.equal(readable("A &bogus; &odot; &amp B & C"), undefined);
  assert.equal(readable("plain text, nothing to write out"), undefined);
});
