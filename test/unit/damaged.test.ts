// Characters a file damaged on its way (U+FFFD where an emoji was split on a line), put back from the research's texts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mendAll, mendText } from "../../src/core/damaged.ts";

const X = "�";

test("a text damaged only where its emoji stood is the research's text again", () => {
  const ours = ["Sňatky fary Zálesí 1823, ženich 🟣 Ověřit znovu.", "Dům č. 14 na návsi (sčítání 1857). 💬 Zatím jen odhad."];
  assert.equal(mendText(`Sňatky fary Zálesí 1823, ženich ${X}${X} Ověřit znovu.`, [ours]), ours[0]);
  assert.equal(mendText(`Dům č. 14 na návsi (sčítání 1857). ${X}${X} Zatím jen odhad.`, [ours]), ours[1]);
  // a decomposed file (NFD) is the same text
  assert.equal(mendText(`Sňatky fary Zálesí 1823, ženich ${X}${X} Ověřit znovu.`.normalize("NFD"), [ours]), ours[0]);
  // another script
  assert.equal(mendText(`Іван Шевчук ${X}${X} народився 1862`, [["Іван Шевчук 🔁 народився 1862"]]), "Іван Шевчук 🔁 народився 1862");
});

test("an edit beside the damage: the edit kept, the emoji put back by the text around it", () => {
  const ours = ["Sňatky fary Zálesí 1823, ženich 🟣 Ověřit znovu."];
  assert.equal(mendText(`Sňatky fary Zálesí 1823, oddaní, ženich ${X}${X} Ověřit znovu ve svazku 41.`, [ours]), "Sňatky fary Zálesí 1823, oddaní, ženich 🟣 Ověřit znovu ve svazku 41.");
});

test("what nothing tells stays as it came: no reference, references that disagree, too little around it", () => {
  assert.equal(mendText(`Svatba ${X}${X} Hledat dál.`, [[]]), `Svatba ${X}${X} Hledat dál.`);
  assert.equal(mendText(`Svatba ${X}${X} Hledat dál.`, [["Svatba 🔴 Hledat dál.", "Svatba 🔵 Hledat dál."]]), `Svatba ${X}${X} Hledat dál.`);
  assert.equal(mendText(`${X}${X}`, [["🔴"]]), `${X}${X}`);
  // a damaged reference gives nothing
  assert.equal(mendText(`Svatba ${X}${X} Hledat dál.`, [[`Svatba ${X}${X} Hledat dál.`]]), `Svatba ${X}${X} Hledat dál.`);
  // the first group that tells wins (what the app was given, before the research now)
  assert.equal(mendText(`Svatba ${X}${X} Hledat dál.`, [["Svatba 🔴 Hledat dál."], ["Svatba 🔵 Hledat dál."]]), "Svatba 🔴 Hledat dál.");
});

test("every string of a snapshot mended in place, maps and their keys too, from the same field of the same record", () => {
  const snap = { persons: new Map([["P0001", { names: ["Jan /Novák/"], notes: [`Poznámka ${X}${X} konec.`] }]]), sources: new Map([[`Sňatky ${X}${X} Zálesí`, { title: "x" }]]) };
  const ref = { persons: new Map([["P0001", { names: ["Jan /Novák/"], notes: ["Jiná věc.", "Poznámka 🔁 konec."] }]]), sources: new Map([["Sňatky 🟣 Zálesí", { title: "x" }]]) };
  assert.equal(mendAll(snap, () => [ref]), 2);
  assert.deepEqual(snap.persons.get("P0001")!.notes, ["Poznámka 🔁 konec."]);
  assert.deepEqual([...snap.sources.keys()], ["Sňatky 🟣 Zálesí"]);
  assert.equal(mendAll({ a: "nic" }, () => assert.fail("asked only when something is damaged")), 0);
  // a family of a list by its id, else by its partners
  const fams = { families: [{ partners: ["P2", "P1"], notes: [`Dům č. 14 ${X}${X} na návsi.`] }, { id: "F0002", partners: ["P3"], notes: [`Dům č. 14 ${X}${X} na návsi.`] }] };
  const ours = { families: [{ id: "F0002", partners: ["P3"], notes: ["Dům č. 14 🏠 na návsi."] }, { partners: ["P1", "P2"], notes: ["Dům č. 14 💬 na návsi."] }] };
  assert.equal(mendAll(fams, () => [ours]), 2);
  assert.deepEqual(fams.families.map((f) => f.notes[0]), ["Dům č. 14 💬 na návsi.", "Dům č. 14 🏠 na návsi."]);
});

test("nothing is taken from another record or another field, nor from text alike on one side only (found 2026-10-21)", () => {
  // a new note of P2 with a damaged emoji: P1's note with the same words around it tells nothing of it
  const incoming = { persons: new Map([["P2", { notes: [`Nová poznámka ${X}${X} Číslo domu sedí.`] }]]) };
  const ours = { persons: new Map([["P1", { notes: ["Stará poznámka 🔴 Číslo domu sedí."] }], ["P2", { notes: [] as string[] }]]) };
  assert.equal(mendAll(incoming, () => [ours]), 0);
  assert.deepEqual(incoming.persons.get("P2")!.notes, [`Nová poznámka ${X}${X} Číslo domu sedí.`]);
  // the same record, another field: nothing either
  const titled = { sources: new Map([["S1", { title: `Kniha ${X}${X} oddaných`, note: "" }]]) };
  assert.equal(mendAll(titled, () => [{ sources: new Map([["S1", { title: "Jiná", note: "Kniha 🔴 oddaných" }]]) }]), 0);
  // one side alike only: a sign before or after the same words is no witness of what stood there
  assert.equal(mendText(`Narozen ${X}${X} 1850`, [["Narozen (1850) v Lhotě"]]), `Narozen ${X}${X} 1850`);
  assert.equal(mendText(`Cizí program ${X} tady`, [["Konec 🔴 tady"]]), `Cizí program ${X} tady`);
  assert.equal(mendText(`Nová věta. ${X}${X}`, [["Stará věta. 🔴"]]), `Nová věta. ${X}${X}`);
  // an edit right beside the damage leaves one side alike only: stays; the same words on both sides: mended
  assert.equal(mendText(`Nová poznámka, ${X}${X} Číslo domu sedí.`, [["Nová poznámka 🔴 Číslo domu sedí."]]), `Nová poznámka, ${X}${X} Číslo domu sedí.`);
  assert.equal(mendText(`Nová poznámka ${X}${X} Číslo domu sedí, ověřeno.`, [["Nová poznámka 🔴 Číslo domu sedí."]]), "Nová poznámka 🔴 Číslo domu sedí, ověřeno.");
});
