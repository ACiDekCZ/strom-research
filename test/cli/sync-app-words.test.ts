// strom sync: what the Strom app adds of its own comes back in the language it ran in — a second birth or death of ours
// as "Urodzenie (alternatywny zapis)", its entry of a birth as "Akt urodzenia" — and is no edit in any of its languages
// (en, cs, de, pl): an unedited tree gives no change, no lead of an event of its own.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World } from "../helpers.ts";
import { opts } from "./sync.helpers.ts";

/** The app's words in each language it runs in: a second birth, a second death, its entry of a birth, of a death. */
const WORDS: Record<string, { altBirth: string; altDeath: string; birthRecord: string; deathRecord: string }> = {
  en: { altBirth: "Birth (alternative record)", altDeath: "Death (alternative record)", birthRecord: "Birth record", deathRecord: "Death record" },
  cs: { altBirth: "Narození (alternativní záznam)", altDeath: "Úmrtí (alternativní záznam)", birthRecord: "Zápis o narození", deathRecord: "Zápis o úmrtí" },
  de: { altBirth: "Geburt (alternativer Eintrag)", altDeath: "Tod (alternativer Eintrag)", birthRecord: "Geburtseintrag", deathRecord: "Sterbeeintrag" },
  pl: { altBirth: "Urodzenie (alternatywny zapis)", altDeath: "Zgon (alternatywny zapis)", birthRecord: "Akt urodzenia", deathRecord: "Akt zgonu" },
};

/** A research of the Lhotáks in Polish: a man of two births and two deaths the records give. */
async function lhotak(): Promise<{ w: World; ged: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "pl"]);
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["event", "add", "P1", "BIRT", "--date", "3 MAR 1850", "--place", "Lhota"]);
  await w.ok(["event", "add", "P1", "BIRT", "--date", "1851", "--place", "Lhotka"]);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "9 SEP 1910", "--place", "Lhota"]);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1911"]);
  await w.ok(["person", "add", "Ludmila /Lhotáková/", "--sex", "F", "--born", "1888"]); // P2
  await w.ok(["event", "add", "P2", "DEAT", "--date", "1960", "--place", "Lhota"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  return { w, ged };
}

test("a second birth and death the app sends back as an event of its own, in each of its languages, is no edit: nothing to write, no lead", opts, async () => {
  const { w, ged } = await lhotak();
  const t = fs.readFileSync(ged, "utf8");
  for (const [lang, words] of Object.entries(WORDS)) {
    // as the app gives it back: the second BIRT, DEAT an EVEN named in the language it ran in
    const back = t
      .replace(/^1 BIRT\r?\n2 DATE 1851$/m, `1 EVEN\n2 TYPE ${words.altBirth}\n2 DATE 1851`)
      .replace(/^1 DEAT\r?\n2 DATE 1911$/m, `1 EVEN\n2 TYPE ${words.altDeath}\n2 DATE 1911`);
    assert.notEqual(back, t, lang);
    // decomposed (NFD) as another program may write it: the same words
    const file = path.join(w.dir, `z-aplikace-${lang}.ged`);
    fs.writeFileSync(file, lang === "cs" ? back.normalize("NFD") : back);
    const r = await w.ok(["sync", file, "--json"]);
    assert.deepEqual(r.json.changes, [], `${lang}: ${JSON.stringify(r.json.changes)}`);
  }
  w.cleanup();
});

test("the app's entry of a birth, a death in each of its languages carries the people of the entry to that birth, that death: no event of its own", opts, async () => {
  const { w } = await lhotak();
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  for (const [lang, words] of Object.entries(WORDS)) {
    // the user moved Ludmila's birth in the app: its entry keeps the date it had, the midwife and who reported the death on it
    const app = {
      version: 10,
      research: { id },
      persons: {
        b: {
          id: "b", firstName: "Ludmila", lastName: "Lhotáková", gender: "female", refn: "P0002", birthDate: "1889", deathDate: "1960", deathPlace: "Lhota",
          events: [
            { type: "custom", customLabel: words.birthRecord, date: "1888", participants: [{ id: "q1", role: "other", name: "Marta Lhotová", note: "Midwife" }] },
            { type: "custom", customLabel: words.deathRecord, participants: [{ id: "q2", role: "informant", name: "Jan Lhoták" }] },
          ],
        },
      },
      partnerships: {},
    };
    const file = path.join(w.dir, `z-aplikace-${lang}.json`);
    fs.writeFileSync(file, JSON.stringify(app));
    const changes = (await w.ok(["sync", file, "--json"])).json.changes as { fact?: { kind: string; label?: string } }[];
    const labels = changes.map((c) => `${c.fact?.kind ?? ""} ${c.fact?.label ?? ""}`.trim());
    assert.ok(!changes.some((c) => c.fact?.kind === "EVEN"), `${lang}: ${labels.join("; ")}`);
    assert.ok(!labels.some((l) => l.includes(words.birthRecord) || l.includes(words.deathRecord)), `${lang}: ${labels.join("; ")}`);
  }
  w.cleanup();
});
