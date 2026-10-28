// A participant of an event (a godparent, a witness): the name alone, what the record says of them in closing
// parentheses as the note; a name holding more refused with what to write, a priest named as a witness told to be the
// officiant; the rules that set apart the names written so before (strom fixes participant-names).

import { test } from "node:test";
import assert from "node:assert/strict";
import { addedNote, checkParticipant, longName, mixedName, splitName, trailingNote } from "../../src/core/participants.ts";
import type { Participant } from "../../src/core/model.ts";

const refused = (p: Participant): { code?: string; hint?: string } => {
  try {
    checkParticipant(p);
  } catch (e) {
    return e as { code?: string; hint?: string };
  }
  return {};
};

test("trailingNote: the closing parentheses are the note, a parenthesis inside the name stays; NFC, any script", () => {
  assert.deepEqual(trailingNote("Jan Lhoták (sedlák, Lhota č. 12)"), { text: "Jan Lhoták", note: "sedlák, Lhota č. 12" });
  assert.deepEqual(trailingNote("Jan (Johann) Lhoták"), { text: "Jan (Johann) Lhoták" });
  assert.deepEqual(trailingNote("Jan Lhoták (sedlák (Lhota)) (strýc)"), { text: "Jan Lhoták", note: "sedlák (Lhota); strýc" });
  assert.deepEqual(trailingNote("P0003 (strýc)"), { text: "P0003", note: "strýc" });
  assert.deepEqual(trailingNote("Jan Lhoták ()"), { text: "Jan Lhoták" });
  assert.deepEqual(trailingNote("(sedlák)"), { text: "(sedlák)" }, "nothing before it: no name to take a note");
  const nfd = trailingNote("Jan Lhoták (sedlák, Lhota č. 12)".normalize("NFD"));
  assert.equal(nfd.text, "Jan Lhoták");
  assert.equal(nfd.note, "sedlák, Lhota č. 12");
  assert.deepEqual(trailingNote("Иван Лхотак (крестьянин)".normalize("NFD")), { text: "Иван Лхотак", note: "крестьянин" });
});

test("longName: more than four words or a number; titles not counted", () => {
  assert.equal(longName("Jan Lhoták"), false);
  assert.equal(longName("Jan Josef Karel Lhoták"), false);
  assert.equal(longName("MUDr. Jan Josef Karel Lhoták"), false, "a title is no word of the name");
  assert.equal(longName("Jan Josef Karel Václav Lhoták"), true);
  assert.equal(longName("Jan Lhoták sedlák z Lhoty"), true);
  assert.equal(longName("Jan Lhoták 12"), true);
  assert.equal(longName("Иван Петрович Лхотак"), false);
  assert.equal(longName("Иван Петрович Лхотак из Лхоты".normalize("NFD")), true);
});

test("checkParticipant: a long name or one with a number refused with its hint; a priest as a witness or other told to be the officiant", () => {
  const long = refused({ role: "godparent", name: "Jan Lhoták sedlák z Lhoty č. 12" });
  assert.equal(long.code, "participant.long-name");
  assert.match(long.hint!, /--with "godparent:Jan Lhoták \(sedlák z Lhoty č\. 12\)"/);
  const five = refused({ role: "witness", name: "Jan Josef Karel Václav Lhoták" });
  assert.equal(five.code, "participant.long-name");
  assert.match(five.hint!, /--with "witness:<name> \(<what the record says>\)"/);
  assert.equal(refused({ role: "godparent", name: "MUDr. Jan Josef Karel Lhoták" }).code, undefined);
  for (const [role, name] of [
    ["witness", "farář Jan Lhoták"],
    ["other", "Pater Johann Lhotak"],
    ["witness", "parochus Joannes Lhotak"],
    ["witness", "kaplan Josef Lhoták".normalize("NFD")],
    ["other", "Děkan Josef Lhoták".normalize("NFD")],
    ["witness", "P. Josef Lhoták"],
  ] as const) {
    const r = refused({ role, name });
    assert.equal(r.code, "participant.officiant", name);
    assert.match(r.hint!, /^--with "officiant:/);
  }
  // the priest in the note
  assert.equal(refused({ role: "witness", name: "Josef Lhoták", note: "farář v Lhotě" }).code, "participant.officiant");
  // as the officiant, a godparent or a witness who is none: as written
  assert.equal(refused({ role: "officiant", name: "P. Josef Lhoták" }).code, undefined);
  assert.equal(refused({ role: "witness", name: "Josef Lhoták", note: "sedlák" }).code, undefined);
  assert.equal(refused({ role: "witness", person: "P0003" }).code, undefined);
});

test("splitName: the name with its titles alone, the rest to the note; what cannot be told for sure left", () => {
  assert.deepEqual(splitName("Jan Lhoták, sedlák z Lhoty č. 12"), { name: "Jan Lhoták", note: "sedlák z Lhoty č. 12" });
  assert.deepEqual(splitName("Jan Lhoták sedlák z Lhoty č. 12".normalize("NFD")), { name: "Jan Lhoták", note: "sedlák z Lhoty č. 12" });
  assert.deepEqual(splitName("Johann Lhotak Häusler aus Lhota Nr. 12"), { name: "Johann Lhotak", note: "Häusler aus Lhota Nr. 12" });
  assert.deepEqual(splitName("Иван Лхотак, крестьянин"), { name: "Иван Лхотак", note: "крестьянин" });
  assert.deepEqual(splitName("Jan Lhoták z Lhoty 12 (strýc)"), { name: "Jan Lhoták", note: "z Lhoty 12; strýc" });
  assert.equal(splitName("Jan Lhoták Lhota 12"), undefined, "the last capital word may be the place");
  assert.equal(splitName("Jan Josef Karel Václav Lhoták"), undefined);
  assert.equal(mixedName("Jan Lhoták"), false);
  assert.equal(mixedName("Jan Lhoták, sedlák"), true);
  assert.equal(addedNote("strýc", "sedlák"), "strýc; sedlák");
  assert.equal(addedNote("sedlák z Lhoty", "sedlák"), "sedlák z Lhoty", "nothing twice");
  assert.equal(addedNote(undefined, "sedlák"), "sedlák");
});

test("a reading not sure of a word of the name stays in the name: [?], [ou?], (?)", () => {
  assert.deepEqual(trailingNote("Jan Lhoták(?)"), { text: "Jan Lhoták(?)" });
  assert.deepEqual(trailingNote("Jan Lhoták (?)"), { text: "Jan Lhoták (?)" });
  assert.deepEqual(splitName("Jan Lhot[?]ák, sedlák"), { name: "Jan Lhot[?]ák", note: "sedlák" });
  assert.deepEqual(splitName("Jan [Lhoták?] ex Lhota"), { name: "Jan [Lhoták?]", note: "ex Lhota" });
  assert.deepEqual(splitName("Jan Lhoták(?) z Lhoty"), { name: "Jan Lhoták(?)", note: "z Lhoty" });
  assert.deepEqual(splitName("P. Jan [?], kaplan z Lhoty č. 2"), { name: "P. Jan [?]", note: "kaplan z Lhoty č. 2" });
  assert.equal(longName("Jan Lhot[?]ák"), false);
  assert.equal(mixedName("Jan Lhoták(?)"), false);
});
