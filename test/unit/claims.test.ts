// A claim of a conflict as a person reads it: its words in the research's language; a conflict of the user's edit an
// older strom opened (no words kept) read from its title, which said both sides in words already.

import { test } from "node:test";
import assert from "node:assert/strict";
import { claimText } from "../../src/core/people.ts";
import type { Conflict } from "../../src/core/model.ts";
import type { Tree } from "../../src/core/tree.ts";

const tree = { lang: "cs", get: () => undefined } as unknown as Tree;
const conflict = (claims: Conflict["claims"], title = "Jan Novák: Narození — 14. 1. 1931, Dolní Lhota, čp. 12 × 15. 1. 1931, Dolní Lhota, čp. 12"): Conflict =>
  ({ id: "X0001", type: "conflict", title, fact: "BIRT", subject: ["P0001"], claims, state: "open" }) as unknown as Conflict;

test("a claim in words: its own, else its side of an older conflict's title, else as written", () => {
  const words = conflict([
    { value: "14 JAN 1931, Dolní Lhota, house 12", note: "the research: E0001", text: "14. 1. 1931, Dolní Lhota, čp. 12" },
    { value: "15 JAN 1931, Dolní Lhota, house 12", note: "the user's edit", text: "15. 1. 1931, Dolní Lhota, čp. 12" },
  ]);
  assert.equal(claimText(tree, words, words.claims[1]!), "15. 1. 1931, Dolní Lhota, čp. 12");
  // an older strom kept no words: the title's sides
  const older = conflict([
    { value: "14 JAN 1931, Dolní Lhota, house 12", note: "the research: E0001" },
    { value: "15 JAN 1931, Dolní Lhota, house 12", note: "the user's edit" },
  ]);
  assert.equal(claimText(tree, older, older.claims[0]!), "14. 1. 1931, Dolní Lhota, čp. 12");
  assert.equal(claimText(tree, older, older.claims[1]!), "15. 1. 1931, Dolní Lhota, čp. 12");
  // a sex an older strom wrote as a letter: in words through its title
  const sex = conflict([{ value: "U", note: "the research: the sex its records give" }, { value: "F", note: "the user's edit" }], "Petr Svoboda: SEX — U × F");
  assert.equal(claimText(tree, sex, sex.claims[1]!), "žena");
  // a conflict of the research (an agent's) or a title cut short: as written
  const agents = conflict([{ source: "S0001", value: "12 MAR 1865" }, { source: "S0002", value: "1866" }], "Rok narození Jana");
  assert.equal(claimText(tree, agents, agents.claims[0]!), "12 MAR 1865");
  const cut = conflict(older.claims, `Jan Novák: Narození — ${"x".repeat(180)} × y`.slice(0, 200));
  assert.equal(claimText(tree, cut, cut.claims[1]!), "15 JAN 1931, Dolní Lhota, house 12");
});
