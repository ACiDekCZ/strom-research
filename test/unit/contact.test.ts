// A person's contact (spec 134 U11): the rule that tells a residence of nothing but an e-mail from a residence, one
// for strom intake, strom sync and the checks of a research (core/contact.ts).

import { test } from "node:test";
import assert from "node:assert/strict";
import { addressText, appResidenceContact, emailOf, gedcomPersonContact, joinEmails, noteEmails, residenceContact } from "../../src/core/contact.ts";
import { parseGedcomText, type GedNode } from "../../src/gedcom/parse.ts";
import { validateRecord } from "../../src/core/validate.ts";
import type { Person } from "../../src/core/model.ts";

/** The first person of a few lines of GEDCOM (level 1 and below of one INDI). */
function indi(lines: string[]): GedNode {
  return parseGedcomText(["0 @I1@ INDI", "1 NAME Hromoslav /Ozubec/", ...lines].join("\n")).records[0]!;
}
const resi = (lines: string[]): GedNode => indi(["1 RESI", ...lines]).children.find((c) => c.tag === "RESI")!;

test("MyHeritage's two forms of an e-mail: a residence of nothing but it is no event — the e-mail the contact", () => {
  assert.deepEqual(residenceContact(resi(["2 EMAIL hromoslav@example.org"])), { emails: ["hromoslav@example.org"], onlyContact: true, notTaken: [] });
  // its address of a label alone ("Email") beside it: no address, never a house
  const labelled = resi(["2 ADDR", "3 ADR1 Email", "2 EMAIL hromoslav@example.org"]);
  assert.deepEqual(residenceContact(labelled), { emails: ["hromoslav@example.org"], onlyContact: true, notTaken: [] });
  assert.equal(addressText(labelled.children.find((c) => c.tag === "ADDR")), undefined);
  // the label alone (the app's test of MyHeritage: no EMAIL) is no event either, nothing of a contact taken
  assert.deepEqual(residenceContact(resi(["2 ADDR", "3 ADR1 E-mail"])), { emails: [], onlyContact: true, notTaken: [] });
  assert.deepEqual(residenceContact(resi(["2 ADDR Telefon:"])), { emails: [], onlyContact: true, notTaken: [] });
});

test("a residence with anything of its own stays one: its EMAIL the contact, never its note; a label never a house", () => {
  const r = resi(["2 DATE 1930", "2 PLAC Lhota", "2 ADDR", "3 ADR1 Email", "2 EMAIL hromoslav@example.org"]);
  assert.deepEqual(residenceContact(r), { emails: ["hromoslav@example.org"], onlyContact: false, notTaken: [] });
  assert.equal(addressText(r.children.find((c) => c.tag === "ADDR")), undefined, "the ADR1 label is no house");
  // a real address: the house
  const house = resi(["2 ADDR", "3 ADR1 čp. 13", "2 EMAIL hromoslav@example.org"]);
  assert.equal(residenceContact(house).onlyContact, false);
  assert.equal(addressText(house.children.find((c) => c.tag === "ADDR")), "čp. 13");
  // each of what makes a residence one
  for (const extra of [["2 SOUR @S1@"], ["2 OBJE @O1@"], ["2 AGE 40y"], ["2 CAUS x"], ["2 ASSO @I2@", "3 RELA Witness"], ["2 _SHAR @I2@"], ["2 NOTE Bydlel u mlýna."], ["2 TYPE Pobyt"]])
    assert.equal(residenceContact(resi(["2 EMAIL hromoslav@example.org", ...extra])).onlyContact, false, extra.join(" "));
  // the line's value: a residence written on it
  const valued = indi(["1 RESI Lhota 13", "2 EMAIL hromoslav@example.org"]).children.find((c) => c.tag === "RESI")!;
  assert.equal(residenceContact(valued).onlyContact, false);
  // strom's own marks say nothing of it
  assert.equal(residenceContact(resi(["2 _STROM_EID E0007", "2 _EID E0007", "2 _STROM_STATUS lead", "2 EMAIL hromoslav@example.org"])).onlyContact, true);
});

test("the Strom app up to 3.31: a residence whose note is the e-mail (cs, en, de, pl), with the export's status word — decomposed text too", () => {
  for (const label of ["E-mail", "Email", "E-Mail", "e-mail"])
    assert.deepEqual(residenceContact(resi([`2 NOTE ${label}: hromoslav@example.org`])), { emails: ["hromoslav@example.org"], onlyContact: true, notTaken: [] }, label);
  // the status word of strom's export beside it (in any language), the text decomposed as some systems send it
  const nfd = resi([`2 NOTE ${"Vodítko — nedoloženo záznamem.".normalize("NFD")}`, "3 CONT E-mail: lhotak@example.org", "3 CONT E-Mail: hromoslav@example.org"]);
  assert.deepEqual(residenceContact(nfd), { emails: ["lhotak@example.org", "hromoslav@example.org"], onlyContact: true, notTaken: [] });
  assert.deepEqual(residenceContact(resi(["2 NOTE Wskazówka — niepotwierdzone aktem.", "3 CONT E-mail: hromoslav@example.org"])).emails, ["hromoslav@example.org"]);
  // a line of other words: the user's note, the residence stays (its e-mail line in the note, not taken)
  const other = resi(["2 NOTE E-mail: hromoslav@example.org", "3 CONT Bydlel u mlýna."]);
  assert.deepEqual(residenceContact(other), { emails: [], onlyContact: false, notTaken: [] });
  // a note of a label and something no address: no e-mail, the residence stays
  assert.equal(residenceContact(resi(["2 NOTE E-mail: nikdo"])).onlyContact, false);
  assert.equal(noteEmails("E-mail: hromoslav@example.org\nVodítko — nedoloženo záznamem.\nMožné — slabý doklad."), undefined, "one status word at most");
  // a note record pointed at, read through the reader given
  const pointed = resi(["2 NOTE @N1@"]);
  assert.equal(residenceContact(pointed).onlyContact, false, "unread: a note of the user's");
  assert.deepEqual(residenceContact(pointed, () => "E-mail: hromoslav@example.org").emails, ["hromoslav@example.org"]);
});

test("a phone, a fax, a web page: not kept, said — a residence of them alone no event", () => {
  assert.deepEqual(residenceContact(resi(["2 PHON +420 123 456 789"])), { emails: [], onlyContact: true, notTaken: ["PHON"] });
  assert.deepEqual(residenceContact(resi(["2 PHON 123", "2 WWW https://example.org", "2 EMAIL hromoslav@example.org"])), { emails: ["hromoslav@example.org"], onlyContact: true, notTaken: ["PHON", "WWW"] });
  assert.deepEqual(residenceContact(resi(["2 DATE 1930", "2 FAX 123"])), { emails: [], onlyContact: false, notTaken: ["FAX"] });
  // an EMAIL of no address: said, nothing guessed
  assert.deepEqual(residenceContact(resi(["2 EMAIL hromoslav na example"])), { emails: [], onlyContact: true, notTaken: ["EMAIL"] });
  // an empty residence stays as it was (no contact in it)
  assert.equal(residenceContact(resi([])).onlyContact, false);
});

test("1 EMAIL right under the person is the contact; all of a person's e-mails each once (letter case aside), NFC", () => {
  const p = indi(["1 EMAIL  hromoslav@example.org ", "1 PHON 123", "1 RESI", "2 EMAIL Hromoslav@Example.org", "1 RESI", "2 NOTE E-mail: lhotak@example.org"]);
  assert.deepEqual(gedcomPersonContact(p), { emails: ["hromoslav@example.org", "lhotak@example.org"], onlyContact: false, notTaken: ["PHON"] });
  assert.equal(emailOf(`${"Ozubeč".normalize("NFD")}@example.org`), "Ozubeč@example.org".normalize("NFC"));
  assert.equal(emailOf("Озубец@пример.рф"), "Озубец@пример.рф");
  assert.equal(emailOf("no address"), undefined);
  assert.deepEqual(joinEmails(["a@example.org"], ["A@EXAMPLE.ORG", "b@example.org"]), ["a@example.org", "b@example.org"]);
});

test("the app's JSON: a residence of nothing but its e-mail (note, gedcomEmails) none; one with anything keeps it", () => {
  assert.deepEqual(appResidenceContact({ note: "E-mail: hromoslav@example.org" }), { emails: ["hromoslav@example.org"], onlyContact: true, notTaken: [] });
  assert.deepEqual(appResidenceContact({ note: "E-mail: hromoslav@example.org", gedcomEmails: ["hromoslav@example.org"], address: "Email" }), { emails: ["hromoslav@example.org"], onlyContact: true, notTaken: [] });
  assert.deepEqual(appResidenceContact({ date: "1930", note: "E-mail: hromoslav@example.org", gedcomEmails: ["hromoslav@example.org"] }), { emails: ["hromoslav@example.org"], onlyContact: false, notTaken: [] });
  assert.deepEqual(appResidenceContact({ place: "Lhota", note: "E-mail: hromoslav@example.org" }), { emails: [], onlyContact: false, notTaken: [] });
  assert.equal(appResidenceContact({}).onlyContact, false);
});

test("a person's contact: e-mail strings each once, never an empty list or object", () => {
  const p = (contact: unknown) => ({ id: "P0001", type: "person", names: [{ given: "Hromoslav", surname: "Ozubec" }], sex: "M", events: [], notes: [], created: "2026-11-22T10:00:00Z", updated: "2026-11-22T10:00:00Z", contact }) as unknown as Person;
  assert.deepEqual(validateRecord(p({ emails: ["hromoslav@example.org"] })), []);
  assert.deepEqual(validateRecord(p(undefined)), []);
  for (const bad of [{}, { emails: [] }, { emails: [""] }, { emails: [1] }, { emails: ["no address"] }, { emails: ["a@example.org", "A@example.org"] }, "x"])
    assert.ok(validateRecord(p(bad)).some((x) => x.path.startsWith("contact")), JSON.stringify(bad));
});
