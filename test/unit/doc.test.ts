// "How Strom works" as strom carries it (core/doc.ts, assets/strom-doc): the pin, the same numbers in every language,
// every number the research points to there, the web's addresses, the numbers as typed, the search in any script.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { foldText } from "../../src/core/text.ts";
import { DOC_LANGS, DOC_NUMBER, docBook, docLangOf, docNear, docNumber, docPin, docSearch, docUnder, docUrl, plainLine } from "../../src/core/doc.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOC = path.join(ROOT, "assets", "strom-doc");
/** The web's address of the contents, a chapter, a rule. */
const URL_SHAPE = new RegExp(`^https://stromapp\\.info/doc/(cs|en|de|pl)/(?:([ARS][0-9]+[a-z]?)/(?:#(${DOC_NUMBER}))?)?$`, "u");

/** Every file of the research's own (not the documentation itself, not the tests): its code, texts, method, README. */
function researchFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) {
        if (p !== DOC) walk(p);
      } else if (/\.(ts|json|md|txt)$/u.test(d.name)) out.push(p);
    }
  };
  walk(path.join(ROOT, "src"));
  walk(path.join(ROOT, "assets"));
  out.push(path.join(ROOT, "README.md"));
  return out;
}

test("the documentation carried is the commit package.json pins, under CC BY 4.0", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as { stromDoc?: string; files: string[] };
  assert.match(pkg.stromDoc ?? "", /^[0-9a-f]{40}$/u, "package.json stromDoc: a full commit");
  assert.equal(fs.readFileSync(path.join(DOC, "PIN"), "utf8").trim(), pkg.stromDoc);
  assert.equal(docPin(), pkg.stromDoc);
  assert.ok(pkg.files.includes("assets"), "in the npm package");
  assert.match(fs.readFileSync(path.join(DOC, "LICENSE"), "utf8"), /Creative Commons Attribution 4\.0/u);
  for (const f of ["REJSTRIK.md", "CISLA.md"]) assert.ok(fs.existsSync(path.join(DOC, f)), f);
});

test("every language has the same numbers, each with a title, in the same order", () => {
  const en = docBook("en");
  assert.ok(en.order.length > 100, `${en.order.length} numbers`);
  assert.deepEqual(
    en.parts.map((p) => p.id),
    ["R", "A", "S"],
  );
  for (const lang of DOC_LANGS) {
    const book = docBook(lang);
    assert.equal(book.lang, lang);
    assert.deepEqual(book.order, en.order, lang);
    for (const n of book.order) {
      const e = book.entries.get(n)!;
      assert.ok(e.title.trim(), `${lang} ${n}: a title`);
      assert.doesNotMatch(`${e.title}\n${e.text}`, /<a\b|<!--|\]\(/u, `${lang} ${n}: plain text`);
      assert.match(docUrl(lang, n), URL_SHAPE, `${lang} ${n}`);
    }
    assert.ok(book.terms.length > 50, `${lang}: the register`);
    assert.ok(book.terms.every((t) => t.numbers.every((n) => book.entries.has(n))), `${lang}: the register's numbers exist`);
  }
});

test("every number and address the research points to exists in the pin, in all four languages", () => {
  const books = DOC_LANGS.map((l) => docBook(l));
  const refs: string[] = [];
  const addresses = new RegExp(`https://stromapp\\.info/doc/[^\\s"'\`)>]*`, "gu");
  const asCommand = new RegExp(`strom doc (${DOC_NUMBER})(?![\\p{L}\\p{N}])`, "gu");
  const seeAlso = new RegExp(`\\b(?:see|viz|siehe|zob\\.) (${DOC_NUMBER})(?![\\p{L}\\p{N}])`, "gu");
  for (const file of researchFiles()) {
    const text = fs.readFileSync(file, "utf8");
    const where = path.relative(ROOT, file);
    for (const m of text.matchAll(asCommand)) refs.push(`${where}: ${m[1]}`);
    for (const m of text.matchAll(seeAlso)) refs.push(`${where}: ${m[1]}`);
    for (const m of text.matchAll(addresses)) {
      const url = m[0].replace(/[.,;:]+$/u, "");
      // a template the code fills (${lang}, <chapter>) is checked by its shape where it is made: docUrl
      if (/[${<]/u.test(url)) continue;
      const shape = URL_SHAPE.exec(url);
      assert.ok(shape, `${where}: ${url} — https://stromapp.info/doc/<lang>/<chapter>/#<number>`);
      if (shape[3]) refs.push(`${where}: ${shape[3]}`);
      else if (shape[2]) refs.push(`${where}: ${shape[2]}`);
    }
  }
  assert.ok(refs.length >= 2, `the research points to the documentation: ${refs.join(", ")}`);
  for (const ref of refs) {
    const n = ref.split(": ")[1]!;
    for (const book of books) assert.ok(book.entries.has(n), `${ref} — not in the ${book.lang} documentation`);
  }
});

test("the web's addresses: the contents, a chapter, a rule — its chapter in the pin", () => {
  assert.equal(docUrl("cs"), "https://stromapp.info/doc/cs/");
  assert.equal(docUrl("de", "R2"), "https://stromapp.info/doc/de/R2/");
  assert.equal(docUrl("pl", "R2.3.1"), "https://stromapp.info/doc/pl/R2/#R2.3.1");
  for (const lang of DOC_LANGS) {
    const book = docBook(lang);
    for (const n of book.order) {
      const shape = URL_SHAPE.exec(docUrl(lang, n))!;
      assert.ok(book.entries.get(shape[2]!)?.depth === 1, `${lang} ${n}: its chapter ${shape[2]}`);
    }
  }
});

test("a number reads as the web's short links read it", () => {
  for (const [typed, number] of [
    ["R10.1", "R10.1"],
    ["r4.3", "R4.3"],
    ["R4-3", "R4.3"],
    ["R4.3.", "R4.3"],
    ["#R4.3", "R4.3"],
    ["a6.5.1", "A6.5.1"],
    [" S2 ", "S2"],
    ["R2.3a", "R2.3a"],
  ] as const)
    assert.equal(docNumber(typed), number, typed);
  for (const words of ["hypothesis", "R", "X2", "R2.x", "Ř2", "R2.3.4.5.6"]) assert.equal(docNumber(words), undefined, words);
});

test("the language: one it is written in, else English with the one asked for", () => {
  assert.deepEqual(docLangOf("cs"), { lang: "cs" });
  assert.deepEqual(docLangOf("de-AT"), { lang: "de" });
  assert.deepEqual(docLangOf("pl_PL.UTF-8"), { lang: "pl" });
  assert.deepEqual(docLangOf("sk"), { lang: "en", fallback: "sk" });
  assert.deepEqual(docLangOf(undefined), { lang: "en" });
});

test("a search finds by the title first, any accent, any case, NFC or NFD; another script finds nothing, never fails", () => {
  const cs = docBook("cs");
  const title = cs.entries.get("R2.1.4")!.title; // "Pořadí linií …"
  const word = title.split(" ").find((w) => /[^\p{ASCII}]/u.test(w))!;
  assert.ok(word, `a word with an accent in "${title}"`);
  const nfc = docSearch(cs, word.normalize("NFC"));
  assert.ok(nfc.some((r) => r.entry.number === "R2.1.4" && r.score === 3), word);
  assert.deepEqual(docSearch(cs, word.normalize("NFD")), nfc, "NFD");
  assert.deepEqual(docSearch(cs, word.toUpperCase()), nfc, "upper case");
  assert.deepEqual(docSearch(cs, foldText(word)), nfc, "no accents");
  const scores = nfc.map((r) => r.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), "best first");
  assert.deepEqual(docSearch(cs, "Ярослав Грузинский"), []);
  assert.deepEqual(docSearch(cs, "   "), []);
});

test("the rules under a number and the nearest to one there is not", () => {
  const en = docBook("en");
  const under = docUnder(en, "R2").map((e) => e.number);
  assert.ok(under.includes("R2.1") && under.includes("R2.1.1"), under.join(" "));
  assert.ok(under.every((n) => n.startsWith("R2.")));
  assert.deepEqual(docNear(en, "R2.9").slice(0, 2), ["R2", "R2.1"]);
  assert.ok(docNear(en, "R99").every((n) => n.startsWith("R") && !n.includes(".")));
});

test("Markdown read as plain text: links as their text, marks gone, code kept", () => {
  assert.equal(plainLine("See [the queue](R2-queue.md#R2.2) and **only** *this*."), "See the queue and only this.");
  assert.equal(plainLine('<a id="R2.3"></a>A rule'), "A rule");
  assert.equal(plainLine("`strom doc` \\*not italic\\*"), "`strom doc` *not italic*");
});
