// A person's contact (spec 134 U11): an e-mail of another program's GEDCOM (MyHeritage's residence of nothing but it,
// "1 EMAIL") comes in as the person's contact, never a residence; the research gives it to the Strom app as 1 RESI /
// 2 EMAIL and reads it back the same — the app's older form (a residence noted "E-mail: …") too — so that a tree
// nobody changed brings no change; added in the app, it is added; taken off there, it is taken off (the user's word).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { validateGedcom, hasGedErrors } from "../../src/gedcom/validate.ts";
import { importStromJson } from "../../src/core/import.ts";
import { readStromJson } from "../../src/core/sync.ts";
import type { Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { CLAUDECODE: "1" } };
/** The person's own sync: the bridge writing what the app sent (forApp). */
const FROM_APP = { env: { STROM_FOR_APP: "1" } };

const MH = [
  "0 HEAD",
  "1 SOUR MYHERITAGE",
  "2 NAME MyHeritage Family Tree Builder",
  "1 GEDC",
  "2 VERS 5.5.1",
  "2 FORM LINEAGE-LINKED",
  "1 CHAR UTF-8",
  "0 @I1@ INDI",
  "1 NAME Hromoslav /Ozubec/",
  "1 SEX M",
  "1 BIRT",
  "2 DATE 1950",
  "2 PLAC Lhota",
  "1 RESI",
  "2 EMAIL hromoslav@example.org",
  "0 @I2@ INDI",
  "1 NAME Bohumila /Lhotáková/",
  "1 SEX F",
  "1 RESI",
  "2 ADDR",
  "3 ADR1 Email",
  "2 EMAIL bohumila@example.org",
  "1 RESI",
  "2 DATE 1980",
  "2 PLAC Horní Lhota",
  "2 ADDR",
  "3 ADR1 Email",
  "2 EMAIL bohumila.lhotakova@example.org",
  "2 PHON +420 123 456 789",
  "1 EMAIL Bohumila@Example.org",
  "0 TRLR",
  "",
].join("\n");

const open = (w: World) => Tree.open(w.cwd, w.env);
const person = (w: World, given: string): Person => open(w).list<Person>("person").find((p) => p.names[0]!.given === given)!;
const write = (w: World, name: string, text: string) => {
  const f = path.join(w.dir, name);
  fs.writeFileSync(f, text);
  return f;
};

test("MyHeritage's e-mails (a residence of EMAIL alone, an address of a label beside it, 1 EMAIL) come in as the contact, never a residence; a phone said", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const r = await w.ok(["intake", write(w, "lhotakovi.ged", MH), "--json"]);
    assert.match(JSON.stringify(r.json), /"contact":\{"PHON":1\}/u, "the phone not taken, said");
    const text = await w.ok(["intake", write(w, "jiny.ged", MH.replace("Horní Lhota", "Dolní Lhota")), "--lang", "en"]);
    assert.match(text.out, /PHON ×1/u);
    const h = person(w, "Hromoslav");
    assert.deepEqual(h.contact, { emails: ["hromoslav@example.org"] });
    assert.deepEqual(h.events.map((e) => e.kind), ["BIRT"], "no residence of the e-mail");
    const b = person(w, "Bohumila");
    assert.deepEqual(b.contact, { emails: ["Bohumila@Example.org", "bohumila.lhotakova@example.org"] }, "each once, letter case aside (1 EMAIL first)");
    const resi = b.events.filter((e) => e.kind === "RESI");
    assert.equal(resi.length, 1, "the residence of its own date and place stays one");
    assert.equal(resi[0]!.place, "Horní Lhota");
    assert.equal(resi[0]!.house, undefined, "the label Email is no house");
    assert.doesNotMatch(resi[0]!.note ?? "", /@/u, "its e-mail not in its note");
    // the research's own tree coming back with another e-mail: added to the contact, nothing taken off
    const out = path.join(w.dir, "back.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
    const back = fs.readFileSync(out, "utf8").replace(/(0 @[^@]+@ INDI\r?\n1 NAME Hromoslav[^\n]*\n)/u, "$11 EMAIL hromoslav.ozubec@example.org\n");
    await w.ok(["intake", write(w, "back2.ged", back)]);
    assert.deepEqual(person(w, "Hromoslav").contact, { emails: ["hromoslav@example.org", "hromoslav.ozubec@example.org"] });
  } finally {
    w.cleanup();
  }
});

/** A research of one man; given() = the file the app is given now. */
async function man(): Promise<{ w: World; given: () => Promise<string> }> {
  const w = new World();
  await w.withTree("Ozubcovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Hromoslav /Ozubec/", "--sex", "M", "--born", "1950"]);
  let n = 0;
  const given = async () => {
    const out = path.join(w.dir, `given-${++n}.ged`);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
    return fs.readFileSync(out, "utf8");
  };
  return { w, given };
}

type Change = { kind: string; action: string; text?: string };
const plan = async (w: World, file: string) => ((await w.ok(["sync", file, "--json"])).json.changes as Change[]).map((c) => [c.kind, c.action, c.text ?? ""]);
/** The person's record in a file, lines added at its end. */
const withLines = (text: string, lines: string[]) => text.replace(/(0 @[^@]+@ INDI\r?\n(?:[1-9] .*\r?\n)*)/u, (rec) => `${rec}${lines.join("\n")}\n`);
/** The Strom app up to 3.31: an e-mail of a residence kept as its note. */
const oldApp = (text: string) => text.replace(/1 RESI\r?\n((?:2 EMAIL .*\r?\n)+)/gu, (_, lines: string) => `1 RESI\n2 NOTE ${lines.trim().split(/\r?\n/u).map((l) => `E-mail: ${l.slice("2 EMAIL ".length)}`).join("\n3 CONT ")}\n`);
/** MyHeritage's and the app's 3.32 form: an address of a label beside it. */
const labelled = (text: string) => text.replace(/1 RESI\r?\n/gu, "1 RESI\n2 ADDR\n3 ADR1 Email\n");
const noResi = (text: string) => text.replace(/1 RESI\r?\n(?:[2-9] .*\r?\n)*/gu, "");

test("an e-mail added in the app: the contact — given back as 1 RESI / 2 EMAIL, read back by the new and the old app as no change; undone", opts, async () => {
  const { w, given } = await man();
  try {
    const file = write(w, "added.ged", withLines(await given(), ["1 RESI", "2 EMAIL hromoslav@example.org"]));
    assert.deepEqual(await plan(w, file), [["contact.email", "add", "hromoslav@example.org"]]);
    assert.match((await w.ok(["sync", file], { tty: true })).out, /e-mail — hromoslav@example\.org → přidá se do kontaktu/u);
    const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
    assert.deepEqual(person(w, "Hromoslav").contact, { emails: ["hromoslav@example.org"] });
    assert.deepEqual(person(w, "Hromoslav").events.map((e) => e.kind), ["BIRT"], "no residence");
    const text = await given();
    assert.match(text, /\n1 RESI\r?\n2 EMAIL hromoslav@@example\.org\r?\n[01] /u, "a residence of the e-mail alone: no date, no status, no mark");
    assert.deepEqual(await plan(w, write(w, "same.ged", text)), [], "the new app's copy: no change");
    assert.deepEqual(await plan(w, write(w, "old.ged", oldApp(text))), [], "the old app's copy (E-mail: in the note): no change");
    assert.deepEqual(await plan(w, write(w, "label.ged", labelled(text))), [], "with the label Email beside it: no change");
    await w.ok(["sync", "undo", input]);
    assert.equal(person(w, "Hromoslav").contact, undefined);
  } finally {
    w.cleanup();
  }
});

test("an e-mail taken off in the app is taken off (the old app's copy too); by an agent's sync kept; without the copy given only additions", opts, async () => {
  const { w, given } = await man();
  try {
    await w.ok(["sync", write(w, "added.ged", withLines(await given(), ["1 RESI", "2 EMAIL hromoslav@example.org", "2 EMAIL lhotak@example.org"])), "--apply"]);
    assert.deepEqual(person(w, "Hromoslav").contact, { emails: ["hromoslav@example.org", "lhotak@example.org"] });
    const text = await given();
    // one of the two taken off in the old app
    const fewer = write(w, "fewer.ged", oldApp(text.replace(/2 EMAIL lhotak@@example\.org\r?\n/u, "")));
    assert.deepEqual(await plan(w, fewer), [["contact.email", "remove", "lhotak@example.org"]]);
    // an agent's sync takes nothing of the user's off (said so)
    assert.match((await w.ok(["sync", fewer], AGENT)).out, /lhotak@example\.org → nezapíše se: e-mail z kontaktu odebírá jen uživatel/u);
    await w.ok(["sync", fewer, "--apply"], AGENT);
    assert.deepEqual(person(w, "Hromoslav").contact?.emails, ["hromoslav@example.org", "lhotak@example.org"]);
    // the person's: off, the contact gone whole when nothing is left
    const input = (await w.ok(["sync", write(w, "none.ged", noResi(text)), "--apply", "--json"], FROM_APP)).json.input as string;
    assert.equal(person(w, "Hromoslav").contact, undefined);
    await w.ok(["sync", "undo", input]);
    assert.deepEqual(person(w, "Hromoslav").contact?.emails, ["hromoslav@example.org", "lhotak@example.org"]);
    // no copy given (no _STROM_HEAD): nothing taken off, an e-mail added
    const headless = (await given()).replace(/^1 _STROM_HEAD .*\r?\n/mu, "");
    assert.deepEqual(await plan(w, write(w, "headless.ged", noResi(headless))), []);
    assert.deepEqual(await plan(w, write(w, "headless2.ged", withLines(noResi(headless), ["1 EMAIL ozubec@example.org"]))), [["contact.email", "add", "ozubec@example.org"]]);
  } finally {
    w.cleanup();
  }
});

test("more than three e-mails: another residence for each three; the file valid GEDCOM, the standard one too", opts, async () => {
  const { w, given } = await man();
  try {
    const four = ["a", "b", "c", "d"].map((x) => `2 EMAIL ${x}.ozubec@example.org`);
    await w.ok(["sync", write(w, "four.ged", withLines(await given(), ["1 RESI", ...four.slice(0, 2), "1 RESI", ...four.slice(2)])), "--apply"]);
    assert.equal(person(w, "Hromoslav").contact?.emails?.length, 4);
    const text = await given();
    assert.match(text, /1 RESI\r?\n2 EMAIL a\.ozubec@@example\.org\r?\n2 EMAIL b\.ozubec@@example\.org\r?\n2 EMAIL c\.ozubec@@example\.org\r?\n1 RESI\r?\n2 EMAIL d\.ozubec@@example\.org\r?\n/u);
    assert.deepEqual(await plan(w, write(w, "same.ged", text)), []);
    const out = path.join(w.dir, "standard.ged");
    await w.ok(["export", "gedcom", "--for", "standard", "--out", out]);
    const standard = fs.readFileSync(out, "utf8");
    assert.match(standard, /1 RESI\r?\n2 EMAIL a\.ozubec@@example\.org/u, "a literal @ written @@");
    assert.equal(hasGedErrors(validateGedcom(standard, { strict: true })), false, JSON.stringify(validateGedcom(standard, { strict: true }).filter((f) => f.level === "error")));
  } finally {
    w.cleanup();
  }
});

test("the app's JSON: its emails the contact, a residence of nothing but an e-mail none (its older note too), one with a date a residence", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const json = {
      version: 20,
      persons: {
        a1: { id: "a1", firstName: "Hromoslav", lastName: "Ozubec", gender: "male", emails: ["hromoslav@example.org"], events: [{ type: "residence", note: "E-mail: lhotak@example.org" }] },
        a2: { id: "a2", firstName: "Bohumila", lastName: "Lhotáková", gender: "female", events: [{ type: "residence", date: "1980", place: "Lhota", note: "E-mail: bohumila@example.org", gedcomEmails: ["bohumila@example.org"] }] },
      },
      partnerships: {},
    };
    importStromJson(open(w), json as unknown as Parameters<typeof importStromJson>[1], { input: "I0001", name: "lhotakovi.json" });
    const h = person(w, "Hromoslav");
    assert.deepEqual(h.contact, { emails: ["hromoslav@example.org", "lhotak@example.org"] });
    assert.deepEqual(h.events, [], "no residence of the e-mail");
    const b = person(w, "Bohumila");
    assert.deepEqual(b.contact, { emails: ["bohumila@example.org"] });
    assert.deepEqual(b.events.map((e) => [e.kind, e.date, e.place]), [["RESI", "1980", "Lhota"]]);
    // strom sync reads the app's JSON the same way
    const snap = readStromJson(json, "cs");
    const [sh, sb] = [...snap.persons.values()];
    assert.deepEqual([sh!.emails, sh!.facts.length], [["hromoslav@example.org", "lhotak@example.org"], 0]);
    assert.deepEqual([sb!.emails, sb!.facts.map((f) => f.kind)], [["bohumila@example.org"], ["RESI"]]);
  } finally {
    w.cleanup();
  }
});

test("a residence of the research noted only with an e-mail (an older import's): never duplicated, never taken off by a sync of a tree nobody changed", opts, async () => {
  const { w, given } = await man();
  try {
    await w.ok(["event", "add", "P0001", "RESI", "--note", "E-mail: hromoslav@example.org"]);
    const text = await given();
    assert.match(text, /\n1 RESI\r?\n(?:2 _STROM_EID .*\r?\n3 .*\r?\n)?2 NOTE .*\r?\n3 CONT E-mail: hromoslav@@example\.org\r?\n/u, "the research's fact as the app is given it");
    assert.deepEqual(await plan(w, write(w, "same.ged", text)), []);
    assert.deepEqual(await plan(w, write(w, "new.ged", text.replace(/2 NOTE .*\r?\n3 CONT E-mail: (.*)\r?\n/u, "2 EMAIL $1\n"))), [], "the new app's form of it");
    // the e-mail added in the app again: nothing twice
    assert.deepEqual(await plan(w, write(w, "twice.ged", withLines(text, ["1 EMAIL hromoslav@example.org"]))), []);
    assert.equal(person(w, "Hromoslav").events.filter((e) => e.kind === "RESI").length, 1, "the research's fact as it was");
  } finally {
    w.cleanup();
  }
});
