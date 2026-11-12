// strom error --note masks what the research knows in any of its forms: a name or a place declined (z Brna, v Praze,
// Lhotákovi, Lhotas) as well as written — by a common stem with short endings, no list of one language's endings — while
// the person's other words stay readable. Made-up people (Lhoták, Žofie, Lhota), Brno and Praha as any city; NFD as typed
// on a Mac; Cyrillic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { MASK_CODE, Masker } from "../../src/core/redact.ts";
import { stromVocabulary } from "../../src/cli/vocab.ts";

const masker = () => new Masker({ key: Buffer.alloc(32, 7), vocabulary: stromVocabulary(), terms: ["Jan /Lhoták/", "Žofie /Lhotáková/", "Brno", "Praha", "Lhota", "Лхота"] });

/** The words of a note left as written (the codes dropped). */
const left = (m: Masker, note: string): string[] => m.note(note).replace(MASK_CODE, " ").split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);

test("a note: the forms of a known place or name masked — a changed ending (z Brna, v Praze), a longer one (Lhotákovi, Lhotas), NFD and Cyrillic", () => {
  const m = masker();
  for (const word of ["Brna", "Brnem", "Praze", "Prahy", "Prahou", "Lhoty", "Lhotě", "Lhotákovi", "Lhotákové", "Lhotas", "Lhotakowie", "Žofii", "Jana", "Лхоты", "Лхоте"]) {
    for (const form of [word, word.normalize("NFD"), word.toUpperCase()]) assert.deepEqual(left(m, `z ${form} dál`), ["z", "dál"], form);
  }
  // a code is the word's own, the same whatever its form of writing
  assert.equal(m.note("v Praze"), m.note("v Praze".normalize("NFD")));
  assert.equal(m.note("z Brna").normalize("NFC"), m.note("Z BRNA".toLowerCase()));
});

test("a note: a word that only begins as a known one stays readable — a short stem takes a short ending only; a known word of 3 letters one letter more", () => {
  const m = masker();
  const note = "pravda je, že stahování brněnský problém nevyřešilo, leden Janovice письмо Ярослав";
  assert.deepEqual(left(m, note), ["pravda", "je", "že", "stahování", "brněnský", "problém", "nevyřešilo", "leden", "Janovice", "письмо", "Ярослав"]);
  // nothing else of the note changed
  assert.match(m.note(note.normalize("NFD")), /^pravda je, že stahování brněnský problém nevyřešilo, leden Janovice письмо Ярослав$/u);
});
