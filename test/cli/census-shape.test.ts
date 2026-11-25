// A census written as an event of its own ("Sčítání lidu") goes to the Strom app as the census it is, `1 CENS` (K052:
// the app makes such an event a census when it saves the tree, so the research's version never paired with the person's
// tree and every load showed the censuses as taken away); the record keeps what was written. strom check says one
// person's two censuses of one date; a record cited twice says its words once in the fact's note.
// Made-up people (Lhoták, Lhota), a label in NFD as typed on a Mac, labels in Cyrillic and with a year.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { quotesOnce } from "../../src/gedcom/export.ts";

const opts = { skip: !hasGit };

/** The fact of this ID in the file: its lines from its level-1 line up to the next one. */
function factLines(text: string, id: string): string[] {
  const lines = text.split(/\r?\n/);
  const at = lines.indexOf(`2 _STROM_EID ${id}`);
  assert.ok(at > 0, `${id} in the file`);
  let start = at - 1;
  while (start > 0 && !lines[start]!.startsWith("1 ")) start--;
  let end = start + 1;
  while (end < lines.length && !/^[01] /.test(lines[end]!)) end++;
  return lines.slice(start, end);
}

async function exported(w: World, name: string): Promise<string> {
  const out = path.join(w.dir, name);
  // the facts' IDs in it, as the app of today is given them
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out], { env: { STROM_APP_URL: "https://beta.stromapp.info/run/", STROM_APP_VERSION: "3.31.0" } });
  return fs.readFileSync(out, "utf8").replace(/\r\n?/g, "\n");
}

async function lhotak() {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  const add = async (who: string, kind: string, ...more: string[]) => (await w.ok(["event", "add", who, kind, ...more, "--json"])).json.event.id as string;
  return { w, add };
}

test("a person's event of its own named a census (any accent, NFD, another language) goes as 1 CENS; the record stays as written; another label stays an event of its own", opts, async () => {
  const { w, add } = await lhotak();
  try {
    const cs = await add("P1", "EVEN", "--label", "Sčítání lidu", "--date", "31 DEC 1890", "--place", "Lhota", "--note", "Přečteno ve výřezu.");
    const nfd = await add("P1", "EVEN", "--label", "Sčítání lidu".normalize("NFD"), "--date", "31 DEC 1900", "--place", "Lhota");
    const de = await add("P1", "EVEN", "--label", "Volkszählung", "--date", "1910");
    const year = await add("P1", "EVEN", "--label", "Sčítání lidu 1921", "--date", "1921");
    const cyr = await add("P1", "EVEN", "--label", "Перепись населения", "--date", "1897");
    const couple = await add("F1", "EVEN", "--label", "Sčítání lidu", "--date", "1880");
    const text = await exported(w, "strom.ged");
    for (const id of [cs, nfd, de]) {
      const fact = factLines(text, id);
      assert.equal(fact[0], "1 CENS", `${id} as a census`);
      assert.ok(!fact.some((l) => l.startsWith("2 TYPE ")), `${id} with no TYPE`);
    }
    assert.ok(factLines(text, cs).includes("2 DATE 31 DEC 1890") && factLines(text, cs).includes("2 PLAC Lhota"));
    assert.ok(factLines(text, cs).some((l) => l.includes("Přečteno ve výřezu.")), "its note goes with it");
    assert.deepEqual(factLines(text, year).slice(0, 1), ["1 EVEN"]);
    assert.ok(factLines(text, year).includes("2 TYPE Sčítání lidu 1921"), "a label with more than the kind stays its own");
    assert.ok(factLines(text, cyr).includes("2 TYPE Перепись населения"));
    assert.equal(factLines(text, couple)[0], "1 EVEN");
    assert.ok(factLines(text, couple).includes("2 TYPE Sčítání lidu"), "a couple's event as before (the app turns only a person's)");
    // the record is what was written: nothing rewritten
    const events = (await w.ok(["person", "show", "P1", "--json"])).json.person.events as { id: string; kind: string; label?: string }[];
    const mine = events.find((e) => e.id === cs)!;
    assert.equal(mine.kind, "EVEN");
    assert.equal(mine.label, "Sčítání lidu");
  } finally {
    w.cleanup();
  }
});

test("the census sent as 1 CENS comes back from the app as nothing new; a date changed there is the user's edit of the same fact, which keeps its shape", opts, async () => {
  const { w, add } = await lhotak();
  try {
    const cs = await add("P1", "EVEN", "--label", "Sčítání lidu", "--date", "31 DEC 1890", "--place", "Lhota");
    const text = await exported(w, "strom.ged");
    const same = path.join(w.dir, "same.ged");
    fs.writeFileSync(same, text);
    const plan = (await w.ok(["sync", same, "--json"])).json;
    assert.deepEqual(plan.changes, [], "nothing is an edit");
    const edited = path.join(w.dir, "edited.ged");
    assert.match(text, /1 CENS\n(?:[2-9] .*\n)*?2 DATE 31 DEC 1890\n/);
    fs.writeFileSync(edited, text.replace(/(1 CENS\n(?:[2-9] .*\n)*?)2 DATE 31 DEC 1890\n/, "$12 DATE 1 DEC 1890\n"));
    const changes = (await w.ok(["sync", edited, "--json"])).json.changes as { kind: string; action: string }[];
    assert.ok(changes.length > 0, "the date is an edit");
    await w.ok(["sync", edited, "--apply"]);
    const events = (await w.ok(["person", "show", "P1", "--json"])).json.person.events as { id: string; kind: string; label?: string; date?: string; retracted?: unknown }[];
    const live = events.filter((e) => !e.retracted);
    assert.equal(live.length, 1, "one census, none beside it");
    assert.equal(live[0]!.id, cs);
    assert.equal(live[0]!.kind, "EVEN", "the shape the research has");
    assert.equal(live[0]!.label, "Sčítání lidu");
  } finally {
    w.cleanup();
  }
});

test("strom check: one person's two censuses of one date (an event of its own beside CENS) is a warning; other dates, a retracted one, another person not", opts, async () => {
  const { w, add } = await lhotak();
  try {
    const even = await add("P1", "EVEN", "--label", "Sčítání lidu", "--date", "31 DEC 1890", "--place", "Lhota");
    const cens = await add("P1", "CENS", "--date", "31 DEC 1890", "--place", "Lhota".normalize("NFD"));
    await add("P1", "CENS", "--date", "1900");
    await add("P1", "EVEN", "--label", "Sčítání lidu 1900", "--date", "1900");
    await add("P2", "CENS", "--date", "31 DEC 1890");
    const r = await w.run(["check", "--json"]);
    const found = (r.json.findings as { code: string; id?: string; level: string; message: string; hint?: string }[]).filter((f) => f.code === "two-censuses");
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.equal(found[0]!.id, "P0001");
    assert.equal(found[0]!.level, "warn", "never blocking");
    assert.match(found[0]!.message, new RegExp(`${even}, ${cens}`));
    assert.ok(found[0]!.hint!.includes(`strom event retract <${even}|${cens}>`), found[0]!.hint);
    await w.ok(["event", "retract", cens, "--reason", "the census twice"]);
    const after = (await w.run(["check", "--json"])).json.findings as { code: string }[];
    assert.ok(!after.some((f) => f.code === "two-censuses"));
  } finally {
    w.cleanup();
  }
});

test("a record cited twice with the same words says them once in the fact's note; other words each", opts, async () => {
  const { w, add } = await lhotak();
  try {
    await w.ok(["source", "add", "Sčítání lidu 1890, Lhota", "--kind", "census"]); // S1
    await w.ok(["source", "add", "Sčítání lidu 1890, Lhota (opis)", "--kind", "census"]); // S2
    const words = "Jan Lhoták, rolník, čp. 12";
    const cs = await add("P1", "CENS", "--date", "31 DEC 1890", "--place", "Lhota", "--cite", "S1", "--quote", words);
    await w.ok(["cite", cs, "S2", "--quote", words.normalize("NFD")]);
    await w.ok(["cite", cs, "S1", "--locator", "list 3", "--quote", "Anna, manželka"]);
    const text = await exported(w, "strom.ged");
    const note = factLines(text, cs).filter((l) => /^[23] (NOTE|CONT|CONC) /.test(l) && !/^3 /.test(l) || /^3 CON[TC] /.test(l));
    const said = note.join("\n");
    assert.equal(said.split("Zápis: „Jan Lhoták").length - 1, 1, said);
    assert.equal(said.split("Zápis: „Anna, manželka“").length - 1, 1, said);
  } finally {
    w.cleanup();
  }
});

test("quotesOnce: the same words once, as they read (spaces, NFC/NFD), in their order; empty ones out; Cyrillic", () => {
  assert.deepEqual(quotesOnce(["Jan  Lhoták", undefined, "Jan Lhoták".normalize("NFD"), "", "Иван", "Иван ", "Anna"]), ["Jan  Lhoták", "Иван", "Anna"]);
});
