// Texts strom writes into a research come in its language: every catalog has
// only known keys, each with the same {values} as the English text.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PHRASES, catalog, phrase } from "../../src/core/phrases.ts";
import { assetPath } from "../../src/core/assets.ts";
import { UI } from "../../src/cli/ui.ts";
import { LABELS, labels, type LabelKey } from "../../src/gedcom/labels.ts";

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

// Milan, 2026-10-04: "otázky a hlášky pro člověka nemají oslovovat uživatele, mají být neosobní" — "Spustit ve vlastním
// terminálu: strom tidy", "Nic nečeká". Texts for the agent are not these; nor the person's own first message to it.
const SPOKEN_BY_THE_PERSON = new Set(["ui.chat.first", "ui.chat.continue"]); // and every "….say"
/** What strom tells the agent to say (the orientation's notes for it), not the person: "you" is the agent there. */
const FOR_THE_AGENT = new Set(["ui.o.ask.tell", "ui.o.results.installed.live", "ui.o.stories.tell"]);
/** A word that only looks like addressing ("lang:key"). */
const IMPERSONAL_EXCEPTIONS = new Set<string>([]);
const ADDRESSING: Record<string, RegExp> = {
  en: /\b(you|your|yours|yourself)\b/i,
  cs: /(?<![\p{L}])(vy|vás|vám|vámi|váš|vaš\p{L}*|ty|tě|tebe|tobě|tebou|tvůj|tvoj\p{L}*|tvé\p{L}*|tvým\p{L}*|tvou|tvá|tví|jste|jsi|máte|máš|chcete|chceš|můžete|můžeš|budete|budeš|\p{L}{2,}(?:ejte|ete|íte|ěte|ujte|ňte|ďte|ťte|řte|žte|šte))(?![\p{L}])/iu,
  de: /(?<![\p{L}])(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres|Ihnen|du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure|euren|eurem|eurer|eures)(?![\p{L}])/u,
};

test("what a person reads never addresses them: impersonal, in every language (texts for the agent aside)", () => {
  const found: string[] = [];
  for (const [lang, re] of Object.entries(ADDRESSING)) {
    const texts = lang === "en" ? ENGLISH : catalog(lang);
    for (const [key, text] of Object.entries(texts)) {
      if (!/^(ui|log)\./.test(key) || SPOKEN_BY_THE_PERSON.has(key) || key.endsWith(".say") || FOR_THE_AGENT.has(key) || IMPERSONAL_EXCEPTIONS.has(`${lang}:${key}`)) continue;
      const m = re.exec((text ?? "").replace(/\{\w+\}/g, ""));
      if (m) found.push(`${lang} ${key}: „${m[0]}“ in ${text}`);
    }
    // the words strom writes into the GEDCOM a person opens (the header's note, how sure a fact is…)
    for (const key of Object.keys(LABELS.en) as LabelKey[]) {
      const text = labels(lang)(key);
      const m = re.exec(text);
      if (m) found.push(`${lang} GEDCOM ${key}: „${m[0]}“ in ${text}`);
    }
  }
  assert.deepEqual(found, []);
});
