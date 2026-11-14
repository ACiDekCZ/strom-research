// strom query: the facts of the tree as rows for questions over the data — who (how related to the main person, the
// side, the generation), what, where, when, how sure, on what source; counted and grouped; read only. Made-up data
// only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { globalText } from "../../src/agents/global.ts";

interface Family {
  w: World;
  /** The fact IDs by name. */
  e: Record<string, string>;
}

/**
 * Eva (P0001, the main person); her father Jan (P0002) and mother Marie (P0003); the father's father Josef (P0004), a
 * miller; the mother's father Karel (P0005), a Müller; Josef's father Václav (P0006), a molitor; Václav's other son
 * Antonín (P0007), a mill hand ("mlynářský tovaryš"), his wife Ludmila (P0008), a "mlynářka", and their son Petr
 * Mlynář (P0009) — the word only in his surname; Eva's brother Tomáš (P0010), retracted; Ondřej (P0011), nobody's
 * relative; Karel's son Иван Лхотак (P0012), a мельник; Václav's son Jiří Lhottak (P0013), a form made one family.
 */
async function family(): Promise<Family> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const e: Record<string, string> = {};
  const person = async (name: string, sex: string, born: string) => (await w.ok(["person", "add", name, "--sex", sex, "--born", born, "--json"])).json.person.id as string;
  const fact = async (key: string, args: string[]) => (e[key] = (await w.ok(["event", "add", ...args, "--json"])).json.event.id as string);
  assert.equal(await person("Eva /Lhotáková/", "F", "1990"), "P0001");
  await person("Jan /Lhoták/", "M", "1960");
  await person("Marie /Lhotáková/", "F", "1962");
  await person("Josef /Lhoták/", "M", "1930");
  await person("Karel /Lhoták/", "M", "1925");
  await person("Václav /Lhoták/", "M", "1900");
  await person("Antonín /Lhoták/", "M", "1905");
  await person("Ludmila /Lhotáková/", "F", "1908");
  await person("Petr /Mlynář/", "M", "1935");
  await person("Tomáš /Lhoták/", "M", "1992");
  await person("Ondřej /Lhoták/", "M", "1780");
  await person("Иван /Лхотак/", "M", "1952");
  assert.equal(await person("Jiří /Lhottak/", "M", "1910"), "P0013");
  await w.ok(["source", "add", "Křty Lhota 1955", "--kind", "baptism"]);
  await w.ok(["source", "add", "Sčítání Horní Lhota 1950", "--kind", "census"]);
  await w.ok(["family", "add", "--partner", "P0002", "--partner", "P0003", "--child", "P0001", "--child", "P0010", "--married", "1985"]);
  await w.ok(["family", "add", "--partner", "P0004", "--child", "P0002"]);
  await w.ok(["family", "add", "--partner", "P0005", "--child", "P0003", "--child", "P0012"]);
  await w.ok(["family", "add", "--partner", "P0006", "--child", "P0004", "--child", "P0007", "--child", "P0013"]);
  await w.ok(["family", "add", "--partner", "P0007", "--partner", "P0008", "--child", "P0009"]);
  await fact("josef", ["P0004", "OCCU", "--value", "mlynář", "--date", "1955", "--place", "Lhota", "--house", "12", "--cite", "S0001", "--status", "proven", "--information", "primary"]);
  await fact("karel", ["P0005", "OCCU", "--value", "Müller", "--date", "1950", "--place", "Horní Lhota", "--cite", "S0002"]);
  await fact("karelNo", ["P0005", "OCCU", "--value", "mlynář", "--date", "1960", "--status", "disproven", "--cite", "S0002"]);
  await fact("vaclav", ["P0006", "OCCU", "--value", "molitor", "--date", "1925", "--place", "Lhota"]);
  await fact("antonin", ["P0007", "OCCU", "--value", "mlynářský tovaryš", "--date", "1930"]);
  await fact("ludmila", ["P0008", "OCCU", "--value", "mlynářka", "--date", "1931"]);
  await fact("jan", ["P0002", "OCCU", "--value", "mlynář", "--date", "1980"]);
  await fact("tomas", ["P0010", "OCCU", "--value", "mlynář", "--date", "2015"]);
  await fact("ondrej", ["P0011", "OCCU", "--value", "mlynář", "--date", "1800"]);
  await fact("ivan", ["P0012", "OCCU", "--value", "мельник", "--date", "1975"]);
  await fact("home", ["F0001", "RESI", "--place", "Lhota", "--house", "č. p. 12", "--date", "1990"]);
  await w.ok(["event", "retract", e.jan!, "--reason", "misread"]);
  await w.ok(["person", "retract", "P0010", "--reason", "misread"]);
  await w.ok(["config", "set", "main.person", "P0001"]);
  return { w, e };
}

const ids = (rows: { person: { id: string } }[]) => [...new Set(rows.map((r) => r.person.id))].sort();

test("an occupation in any language among the blood relatives: the forms said, the relation with its side and generation, the word only in a surname apart", { skip: !hasGit }, async () => {
  const { w, e } = await family();
  try {
    const r = await w.ok(["query", "--occupation", "mlynar"]);
    const [head, ...rest] = r.out.trim().split("\n");
    assert.match(head!, /^OCCU mlynar \(= mlynář, mlynářka, mlynářský, Müller, .*molitor.*\) · blood relatives of P0001 Eva Lhotáková \(\*1990\): 4 people, 4 facts$/u);
    // the line first, by generation; then the side branches
    assert.match(rest[0]!, new RegExp(`^P0004 Josef Lhoták \\(\\*1930\\) · děd, z otcovy strany \\(G3\\) · ${e.josef} OCCU mlynář · Lhota, house 12 · 1955 · proven · S0001 Křty Lhota 1955$`, "u"));
    assert.match(rest[1]!, /^P0005 Karel Lhoták \(\*1925\) · děd, z matčiny strany \(G3\) · E\d+ OCCU Müller · Horní Lhota · 1950 · probable · S0002 /u);
    assert.match(rest[2]!, /^P0006 Václav Lhoták \(\*1900\) · praděd, z otcovy strany \(G4\) · E\d+ OCCU molitor/u);
    assert.match(rest[3]!, /^P0007 Antonín Lhoták \(\*1905\) · prastrýc, z otcovy strany \(G3\) · E\d+ OCCU mlynářský tovaryš/u);
    // Petr Mlynář has the word only in his name: no fact, said apart with the search that finds him
    assert.match(r.out, /^\+1 person with the word only elsewhere \(a name, a note, …\): strom find mlynar$/mu);
    assert.doesNotMatch(r.out, /P0009|P0010|P0011|P0008/u, "no surname as a fact, no one retracted, nobody outside the set");
    assert.doesNotMatch(r.out, new RegExp(`${e.jan}|${e.karelNo}`, "u"), "no fact retracted, none disproven");
    const j = (await w.ok(["query", "--occupation", "mlynar", "--json"])).json;
    assert.deepEqual(j.elsewhere, { people: 1, ids: ["P0009"], command: "strom find mlynar" });
    const josef = j.rows[0];
    assert.deepEqual(josef.person, { id: "P0004", name: "Josef Lhoták", lifespan: "*1930" });
    assert.deepEqual(josef.relation, { term: "děd", termEn: "grandfather", side: "father", generation: 3, path: ["P0001", "P0002", "P0004"] });
    assert.deepEqual(josef.fact, { id: e.josef, kind: "OCCU", value: "mlynář", date: "1955", place: "Lhota", house: "12", status: "proven", sources: [{ id: "S0001", title: "Křty Lhota 1955" }] });
    assert.match(josef.open, /[?&]tree=lhotakovi&research=[0-9a-f-]{36}&person=P0004$/u, "the person in the Strom app");
    assert.equal(j.rows[1].relation.side, "mother");
    assert.deepEqual(j.total, { people: 4, facts: 4 });
    assert.ok(j.variants.includes("Müller") && j.variants.includes("młynarz"));
    // --exact: the word itself, a whole word
    const exact = (await w.ok(["query", "--occupation", "mlynar", "--exact", "--json"])).json;
    assert.deepEqual(ids(exact.rows), ["P0004"]);
    // the same typed decomposed (NFD), with its accents, or as the German form
    for (const word of ["mlynář".normalize("NFD"), "Mlynář", "MÜLLER", "Mueller"]) assert.deepEqual(ids((await w.ok(["query", "--occupation", word, "--json"])).json.rows), ["P0004", "P0005", "P0006", "P0007"], word);
    // a value in another script: itself
    const ivan = (await w.ok(["query", "--value", "мельник", "--json"])).json;
    assert.deepEqual(ids(ivan.rows), ["P0012"]);
    assert.equal(ivan.rows[0].relation.side, "mother");
  } finally {
    w.cleanup();
  }
});

test("whose facts: ancestors, blood (the default), family with the partners, all; --of another person", { skip: !hasGit }, async () => {
  const { w } = await family();
  try {
    const of = async (...more: string[]) => ids((await w.ok(["query", "--occupation", "mlynar", "--json", ...more])).json.rows);
    assert.deepEqual(await of("--kin", "ancestors"), ["P0004", "P0005", "P0006"]);
    assert.deepEqual(await of(), ["P0004", "P0005", "P0006", "P0007"]);
    assert.deepEqual(await of("--kin", "family"), ["P0004", "P0005", "P0006", "P0007", "P0008"]);
    const all = (await w.ok(["query", "--occupation", "mlynar", "--kin", "all", "--json"])).json;
    assert.deepEqual(ids(all.rows), ["P0004", "P0005", "P0006", "P0007", "P0008", "P0011"], "never the retracted Tomáš");
    assert.equal(all.rows.find((r: { person: { id: string } }) => r.person.id === "P0011").relation, null, "nobody's relative");
    assert.match((await w.ok(["query", "--occupation", "mlynar", "--kin", "all"])).out, /^P0011 Ondřej Lhoták \(\*1780\) · not related · /mu);
    // the relations to another person: Josef is Jan's father
    const jan = (await w.ok(["query", "--occupation", "mlynar", "--of", "P0002", "--kin", "ancestors", "--json"])).json;
    assert.deepEqual(ids(jan.rows), ["P0004", "P0006"]);
    assert.equal(jan.rows[0].relation.term, "otec");
    assert.equal(jan.rows[0].relation.generation, 2);
    await assert.rejects(w.ok(["query", "--of", "P0010"], { env: { CLAUDECODE: "1" } }), /P0010 is retracted/u);
    await assert.rejects(w.ok(["query", "--of", "P0010"]), /P0010 je odvolaná: žádné údaje se k ní nevztahují/u);
    await assert.rejects(w.ok(["query", "--kin", "cousins"]), /--kin takes ancestors, blood, family, all/u);
  } finally {
    w.cleanup();
  }
});

test("counted and grouped: by generation, kin, place, decade, surname; rows under the groups; a page at a time", { skip: !hasGit }, async () => {
  const { w } = await family();
  try {
    const gen = await w.ok(["query", "--occupation", "mlynar", "--count", "--by", "generation"]);
    assert.equal(gen.out.trim().split("\n").slice(1).join("\n"), "  G3: 2 people, 2 facts\n  G4: 1 person, 1 fact\n  side branches: 1 person, 1 fact\n+1 person with the word only elsewhere (a name, a note, …): strom find mlynar");
    const groups = async (by: string, ...more: string[]) => (await w.ok(["query", "--occupation", "mlynar", "--count", "--by", by, "--json", ...more])).json.groups.map((g: { key: string; label: string; facts: number }) => `${g.label}=${g.facts}`);
    assert.deepEqual(await groups("kin"), ["děd, z matčiny strany=1", "děd, z otcovy strany=1", "prastrýc, z otcovy strany=1", "praděd, z otcovy strany=1"], "by the generation (G3 before G4), never by the count or the words");
    assert.deepEqual(await groups("place"), ["Lhota=2", "Horní Lhota=1", "unknown=1"], "the most facts first, unknown last");
    assert.deepEqual(await groups("decade"), ["1920–1929=1", "1930–1939=1", "1950–1959=2"]);
    assert.deepEqual(await groups("surname", "--kin", "family"), ["Lhoták=5"], "Lhotáková is a form of Lhoták");
    // no --count: the rows under their groups
    const rows = (await w.ok(["query", "--occupation", "mlynar", "--by", "generation"])).out;
    assert.match(rows, /\nG3: 2 people, 2 facts\n {2}P0004 [^\n]+\n {2}P0005 [^\n]+\nG4: 1 person, 1 fact\n {2}P0006 [^\n]+\nside branches: 1 person, 1 fact\n {2}P0007 /u);
    // a page at a time, the next page's command as typed
    const p1 = await w.ok(["query", "--occupation", "mlynar", "--limit", "2"]);
    assert.match(p1.out, /… 2 more: strom query --occupation mlynar --limit 2 --page 2$/mu);
    const p2 = (await w.ok(["query", "--occupation", "mlynar", "--limit", "2", "--page", "2", "--json"])).json;
    assert.deepEqual(ids(p2.rows), ["P0006", "P0007"]);
    assert.deepEqual([p2.page, p2.pages, p2.total.facts], [2, 2, 4]);
    await assert.rejects(w.ok(["query", "--by", "colour"]), /--by takes generation, kin, place, decade, surname/u);
  } finally {
    w.cleanup();
  }
});

test("filters: years, house as written, place by any of its words, surname with its forms, source by ID or title, status", { skip: !hasGit }, async () => {
  const { w, e } = await family();
  try {
    const rows = async (...args: string[]) => (await w.ok(["query", ...args, "--json"])).json.rows as { person: { id: string }; fact: { id: string; kind: string } }[];
    assert.deepEqual(ids(await rows("--occupation", "mlynar", "--years", "1920-1940")), ["P0006", "P0007"]);
    assert.deepEqual(ids(await rows("--occupation", "mlynar", "--years", "1950")), ["P0005"], "a single year");
    assert.deepEqual(ids(await rows("--occupation", "mlynar", "--years", "1920–1940")), ["P0006", "P0007"], "an en dash too");
    await assert.rejects(w.ok(["query", "--years", "soon"]), /--years takes 1750-1850/u);
    // house 12, as "č. 12", "12" or "č. p. 12": Josef's occupation and the parents' home (a family's fact: each partner)
    for (const h of ["12", "č. 12", "c. p. 12"]) {
      const found = await rows("--house", h);
      assert.deepEqual(found.map((r) => `${r.person.id} ${r.fact.id}`).sort(), [`P0002 ${e.home}`, `P0003 ${e.home}`, `P0004 ${e.josef}`].sort(), h);
    }
    const kin = (await w.ok(["query", "--place", "Lhota", "--house", "12", "--by", "kin"])).out;
    assert.match(kin, /^otec: 1 person, 1 fact\n {2}P0002 Jan Lhoták \(\*1960\) · otec \(G2\) · E\d+ F0001 RESI · Lhota, house č\. p\. 12 · 1990 · lead$/mu);
    assert.deepEqual(ids(await rows("--place", "horni".normalize("NFD"))), ["P0005"], "the start of any word of the place, any accent");
    assert.deepEqual(ids(await rows("--place", "Lhot", "--kind", "occu")), ["P0004", "P0005", "P0006"], "a kind in small letters");
    // a surname with its forms: Lhotáková is Lhoták's; Lhottak only once the person made it one family
    assert.deepEqual(ids(await rows("--surname", "Lhotak", "--kind", "BIRT", "--kin", "all")), ["P0001", "P0002", "P0003", "P0004", "P0005", "P0006", "P0007", "P0008", "P0011"]);
    await w.ok(["surname", "group", "Lhoták", "Lhottak"], { tty: true });
    assert.deepEqual(ids(await rows("--surname", "Lhotak", "--kind", "BIRT", "--years", "1910")), ["P0013"]);
    assert.deepEqual(ids(await rows("--surname", "Лхотак", "--kind", "BIRT")), ["P0012"]);
    // a source by its ID or the words of its title
    assert.deepEqual((await rows("--source", "S0001")).map((r) => r.fact.id), [e.josef]);
    assert.deepEqual((await rows("--source", "s1")).map((r) => r.fact.id), [e.josef]);
    assert.deepEqual((await rows("--source", "horni lhota")).map((r) => r.fact.id), [e.karel]);
    // disproven only when asked for
    assert.deepEqual((await rows("--source", "S0002", "--status", "disproven")).map((r) => r.fact.id), [e.karelNo]);
    assert.deepEqual((await rows("--occupation", "mlynar", "--status", "proven")).map((r) => r.fact.id), [e.josef]);
    await assert.rejects(w.ok(["query", "--status", "retracted"]), /--status takes proven, probable, possible, lead, disproven/u);
    // an unknown kind is a mistake of the command, never "nothing found" with a wider set to try
    const foo = await w.run(["query", "--kind", "FOO"]);
    assert.notEqual(foo.code, 0);
    assert.match(foo.err, /unknown --kind "FOO": --kind takes BIRT, CHR, .*OCCU, RESI, .*\n→ strom query --kind OCCU/u);
    assert.doesNotMatch(foo.out + foo.err, /nothing found|--kin family/u);
    await assert.rejects(w.ok(["query", "--kind", "BIRT,FOO"]), /unknown --kind "FOO"/u);
    assert.deepEqual(ids(await rows("--kind", "occupation", "--place", "Lhota", "--house", "12")), ["P0004"], "the English name of a kind");
  } finally {
    w.cleanup();
  }
});

test("nothing found says what and where to look further; no main person: how to set one; a person reads it in the research's language", { skip: !hasGit }, async () => {
  const { w } = await family();
  try {
    const none = await w.ok(["query", "--occupation", "kovar"]);
    assert.equal(none.out.trim(), "nothing found: OCCU kovar (= kovář, kovářský, Schmied, Schmid, Hufschmied, faber, fabri, ferrarius, kowal) · blood relatives of P0001 Eva Lhotáková (*1990)\ntry: strom find kovar · strom query --occupation kovar --kin family");
    assert.deepEqual((await w.ok(["query", "--occupation", "kovar", "--json"])).json.rows, []);
    // a person at the terminal: the research's language, the relation and the counts in it
    const cs = (await w.ok(["query", "--occupation", "mlynar", "--count", "--by", "generation"], { tty: true })).out;
    assert.match(cs, /^povolání mlynar \(= mlynář, .*\) · pokrevní příbuzní osoby P0001 Eva Lhotáková \(\*1990\): 4 osoby, 4 údaje\n {2}G3: 2 osoby, 2 údaje\n {2}G4: 1 osoba, 1 údaj\n {2}boční větve: 1 osoba, 1 údaj\n\+1 osoba se slovem jen jinde/u);
    const csRows = (await w.ok(["query", "--occupation", "mlynar"], { tty: true })).out;
    assert.match(csRows, /\nP0004 Josef Lhoták \(\*1930\) · děd, z otcovy strany \(G3\) · E\d+ povolání mlynář · Lhota č\. 12 · 1955 · doložené · S0001 Křty Lhota 1955\n/u);
    assert.match(csRows, /\n\+1 osoba se slovem jen jinde \(jméno, poznámka…\): strom find mlynar$/mu);
    // a house written with its own word: never that word twice, in any language
    const own = (await w.ok(["query", "--house", "č. p. 12", "--kind", "RESI"], { tty: true })).out;
    assert.match(own, /^bydliště · č\. p\. 12 · pokrevní příbuzní/u, "the head: the house as written");
    assert.match(own, /\nP0002 [^\n]* · Lhota č\. p\. 12 · /u, "the row: the house as written");
    assert.doesNotMatch(own, /č\. č\.|čp\. č\./u);
    assert.match((await w.ok(["query", "--house", "12", "--kind", "OCCU"], { tty: true })).out, /^[^\n]* · čp\. 12 · [^\n]*\n[^\n]* · Lhota č\. 12 · /u, "a bare number: the language's word");
    for (const [lang, word] of [["de", "Nr\\."], ["pl", "nr"], ["en", ","]] as const) {
      const out = (await w.ok(["query", "--house", "12", "--kind", "RESI"], { tty: true, env: { STROM_LANG: lang } })).out;
      assert.match(out, /Lhota č\. p\. 12 · /u, lang);
      assert.doesNotMatch(out, new RegExp(`${word} č\\.`, "u"), lang);
    }
    await w.ok(["config", "unset", "main.person"]);
    // an agent reads it in English
    const missing = await w.run(["query"], { env: { CLAUDECODE: "1" } });
    assert.notEqual(missing.code, 0);
    assert.match(missing.err, /no main person to relate the facts to\n→ strom config set main\.person P0001 \(the person the tree is for\), or strom query --of P0001/u);
    // a person reads it in the research's language
    const missingCs = await w.run(["query", "--occupation", "mlynar"], { tty: true });
    assert.notEqual(missingCs.code, 0);
    assert.match(missingCs.err, /chybí hlavní osoba, ke které se údaje vztahují\n→ strom config set main\.person P0001 \(osoba, pro kterou je rodokmen\), nebo strom query --of P0001/u);
    assert.doesNotMatch(missingCs.err, /no main person/u);
    assert.equal((await w.ok(["query", "--of", "P0004", "--occupation", "mlynar", "--kin", "ancestors", "--json"])).json.rows[0].relation.term, "výchozí osoba");
  } finally {
    w.cleanup();
  }
});

test("--story: the stories holding a word, with the sentence and the sources it rests on; the other filters choose the people; a note only: strom find", { skip: !hasGit }, async () => {
  const { w, e } = await family();
  try {
    // Josef's story names the year of his fact: the sentence rests on that fact's source; approved by the user
    await w.ok(["story", "set", "P0004", "--text", "Josef se narodil v Lhotě.\n\nRoku 1955 převzal **mlýn** v čp. 12 po otci.", "--fact", e.josef!]);
    await w.ok(["story", "approve", "P0004"]);
    // Václav's long story, typed decomposed: the sentence cut around the word; no year of a fact, so the story's sources
    const long = `${"Dlouho se o něm nevědělo nic, jen to, co si lidé v Lhotě vyprávěli při práci na polích a v lese, ".repeat(2)}až se ukázalo, že vedl Mlýn u potoka a živil celou rodinu.`;
    await w.ok(["story", "set", "P0006", "--text", long.normalize("NFD"), "--fact", e.vaclav!, "--source", "S0002"]);
    // the couple's story (Antonín and Ludmila): a row for each partner among the people asked about
    await w.ok(["story", "set", "F0005", "--text", "Žili spolu ve mlýnici u Lhoty, jak píše S0001."]);
    // Karel's son Ivan: a story in another script
    await w.ok(["story", "set", "P0012", "--text", "Иван работал на мельнице."]);
    // Marie has the word only in a note
    await w.ok(["note", "add", "P0003", "Prý žila u mlýna."]);

    const j = (await w.ok(["query", "--story", "mlyn", "--json"])).json;
    assert.deepEqual(j.total, { people: 3, stories: 3 });
    const rows = j.rows as { person: { id: string }; relation: { term: string } | null; story: { of: string; draft: boolean; snippet: string; sources: { id: string }[]; basis: string } }[];
    assert.deepEqual(rows.map((r) => `${r.person.id} ${r.story.of}`), ["P0004 P0004", "P0006 P0006", "P0007 F0005"]);
    const [josef, vaclav, antonin] = rows;
    assert.deepEqual([josef!.story.snippet, josef!.story.draft, josef!.story.basis, josef!.story.sources.map((x) => x.id)], ["Roku 1955 převzal mlýn v čp. 12 po otci.", false, "sentence", ["S0001"]]);
    assert.equal(josef!.relation!.term, "děd");
    assert.match(vaclav!.story.snippet, /^…[^\n]{0,160}vedl Mlýn u potoka a živil celou rodinu\.$/u);
    assert.ok(vaclav!.story.snippet.length <= 162 && vaclav!.story.snippet === vaclav!.story.snippet.normalize("NFC"), vaclav!.story.snippet);
    assert.deepEqual([vaclav!.story.draft, vaclav!.story.basis, vaclav!.story.sources.map((x) => x.id)], [true, "story", ["S0002"]]);
    assert.deepEqual([antonin!.story.basis, antonin!.story.sources.map((x) => x.id)], ["sentence", ["S0001"]], "a sentence naming a source rests on it");
    assert.deepEqual(j.elsewhere, { people: 3, ids: ["P0003", "P0005", "P0009"], command: "strom find mlyn" }, "a note, a fact, a surname: elsewhere");
    // the partner too with --kin family; any script; a word with an accent or without
    assert.deepEqual(ids((await w.ok(["query", "--story", "mlýn", "--kin", "family", "--json"])).json.rows), ["P0004", "P0006", "P0007", "P0008"]);
    assert.deepEqual(ids((await w.ok(["query", "--story", "мельниц", "--json"])).json.rows), ["P0012"]);
    // the other filters choose the people: a fact in the years, a surname
    assert.deepEqual(ids((await w.ok(["query", "--story", "mlyn", "--years", "1950-1960", "--json"])).json.rows), ["P0004"]);
    assert.deepEqual(ids((await w.ok(["query", "--story", "mlyn", "--surname", "Lhotak", "--value", "molitor", "--exact", "--json"])).json.rows), ["P0006"]);

    // the agent's text: the row, the draft, the story's sources said as such, the note pointed to strom find
    const out = (await w.ok(["query", "--story", "mlyn"])).out;
    assert.match(out, /^story mlyn · blood relatives of P0001 Eva Lhotáková \(\*1990\): 3 people, 3 stories\n/u);
    assert.match(out, /\nP0004 Josef Lhoták \(\*1930\) · děd, z otcovy strany \(G3\) · story: “Roku 1955 převzal mlýn v čp\. 12 po otci\.” · S0001 Křty Lhota 1955\n/u);
    assert.match(out, /\nP0006 [^\n]* · story: “…[^\n]*” · draft · the story's sources: S0002 Sčítání Horní Lhota 1950\n/u);
    assert.match(out, /\nP0007 [^\n]* · F0005 story: “Žili spolu ve mlýnici u Lhoty, jak píše S0001\.” · draft · S0001 /u);
    assert.match(out, /\n\+3 people with the word only elsewhere \(a name, a note, …\): strom find mlyn$/mu);
    // counted and grouped; a fact's place or decade is no group of stories
    assert.match((await w.ok(["query", "--story", "mlyn", "--count", "--by", "generation"])).out, /: 3 people, 3 stories\n {2}G3: 1 person, 1 story\n {2}G4: 1 person, 1 story\n {2}side branches: 1 person, 1 story\n/u);
    assert.deepEqual((await w.ok(["query", "--story", "mlyn", "--count", "--by", "generation", "--json"])).json.groups.map((g: { key: string; stories: number }) => `${g.key}=${g.stories}`), ["G3=1", "G4=1", "side=1"]);
    await assert.rejects(w.ok(["query", "--story", "mlyn", "--by", "place"]), /--by place groups facts: with --story, --by takes generation, kin, surname/u);
    // nothing: where to look further; a person reads it in the research's language
    assert.match((await w.ok(["query", "--story", "kovar"])).out, /^nothing found: story kovar \(= kovář, [^\n]*\) · blood relatives of [^\n]*\ntry: strom find kovar · strom query --story kovar --kin family$/mu);
    const cs = (await w.ok(["query", "--story", "mlyn"], { tty: true })).out;
    assert.match(cs, /^vyprávění mlyn · pokrevní příbuzní osoby P0001 Eva Lhotáková \(\*1990\): 3 osoby, 3 vyprávění\n/u);
    assert.match(cs, /· vyprávění: „…[^\n]*“ · koncept · prameny celého vyprávění: S0002 /u);
  } finally {
    w.cleanup();
  }
});

test("strom app --person opens the app on a person of the tree; one retracted or unknown is refused with a hint", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w } = await family();
  try {
    w.env.STROM_APP_URL = "http://127.0.0.1:8080/";
    // no Chromium browser: the tree's page on the person
    const plain = (await w.ok(["app", "--person", "P0004", "--json"])).json;
    assert.equal(plain.person, "P0004");
    assert.match(plain.url, /^http:\/\/127\.0\.0\.1:8080\/\?tree=lhotakovi&research=[0-9a-f-]{36}&person=P0004$/u);
    await assert.rejects(w.ok(["app", "--person", "P0010"]), /P0010 is retracted/u);
    await assert.rejects(w.ok(["app", "--person", "P0999"]), /P0999[^\n]*\n→ strom person list/u);
    // a Chromium browser here: the research through the bridge, the app on the person of this tree
    const apps = path.join(w.dir, "Applications");
    fs.mkdirSync(path.join(apps, "Google Chrome.app"), { recursive: true });
    fs.writeFileSync(path.join(apps, "google-chrome"), "#!/bin/sh\n", { mode: 0o755 });
    w.env.STROM_APP_DIRS = apps;
    const bridge = (await w.ok(["app", "--person", "P0004", "--json"])).json;
    assert.equal(bridge.person, "P0004");
    assert.match(bridge.url, /^http:\/\/127\.0\.0\.1:8080\/\?import-url=[^&]+&tree=lhotakovi&research=[0-9a-f-]{36}&person=P0004$/u);
    const live = (await w.ok(["app", "--live", "--person", "P0004", "--json"])).json;
    assert.match(live.url, /\?live=[^&]+&tree=lhotakovi&research=[0-9a-f-]{36}&person=P0004$/u);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("the guide, AGENTS.md and the global rules: an answer over the data says how sure each fact is, a lead or a probable one never as a fact", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const flat = (t: string) => t.replace(/\s+/gu, " ");
    const guide = flat((await w.ok(["guide"])).out);
    assert.match(guide, /strom query --source S0001\. .*say how sure each fact is \(its status\): only a proven one is told as a fact; probable, possible and a lead are not proven .* never as a fact/u);
    const agents = flat(fs.readFileSync(path.join(w.treeDir("Lhotákovi"), "AGENTS.md"), "utf8"));
    assert.match(agents, /one `strom query` call .* how sure each fact is: only a proven one is told as a fact; probable, possible and a lead are not proven — say so, never as a fact\./u);
    assert.match(flat(globalText("the Strom app")), /`strom query` with filters; .* only a proven fact is told as a fact, probable, possible and a lead are said to be unproven/u);
    // where it stops: it answers and shows where to look; deciding and writing go as ever; a story only shows where to look
    assert.match(guide, /strom query --story mlyn — a story retells the facts: answer from the facts and their sources, a story only shows where to look\. query answers the user and shows where to look; whose a record is, who a person is, verifying and writing facts go as ever \(strom person show, the sources, the method\) — a row of query is not enough for it/u);
    assert.match(agents, /- \*\*Questions over the data\*\* .*`--story mlyn`.* never `find` and `show` person by person for such a question; .* whose a record is, who a person is, verifying and writing facts go as ever \(`strom person show`, the sources, the method\)/u);
    // only where the user asks: not among the rules of the work, never in a brief
    const rules = agents.slice(0, agents.indexOf("## Working with the user"));
    assert.doesNotMatch(rules, /strom query|strom facts/u);
    assert.match(flat(globalText("the Strom app")), /a story \(`--story <word>`\) retells the facts, only shows where to look .* whose a record is, verifying and writing facts go as ever/u);
    const help = flat((await w.ok(["help", "query"])).out);
    assert.match(help, /a row of strom query is not enough for it/u);
    assert.doesNotMatch((await w.run(["facts"])).out + (await w.run(["facts"])).err, /^OCCU|blood relatives/u, "the old name is gone");
    // one way to name people in an answer over the data: the name, its ID in brackets after it, the relation whole, the
    // source by its title with its S… — never "the people's IDs" against "not record IDs"
    for (const [where, text] of [["guide", guide], ["AGENTS.md", agents], ["global", flat(globalText("the Strom app"))], ["help", help]] as const) {
      assert.match(text, /each person's name (and|with) their ID in brackets after it.* the relation in words whole as (`strom query`|strom query|query) gives it, never shortened, the source by its title with its S… in brackets/u, where);
      assert.doesNotMatch(text, /the people's IDs/u, where);
    }
    assert.match(agents, /not record IDs, unless they ask, or ask a question over the data \(below: the ID in brackets after each name\)/u);
  } finally {
    w.cleanup();
  }
});

test("strom facts, the old name: the same call as strom query to run, nothing run; a person reads it in their language", { skip: !hasGit }, async () => {
  const { w } = await family();
  try {
    const before = (await w.ok(["history", "--json"])).out;
    // an agent (its rules older than the update): English, the call to run
    const r = await w.run(["facts", "--occupation", "mlynar", "--place", "Horní Lhota", "--count"], { env: { CLAUDECODE: "1" } });
    assert.equal(r.code, 2);
    assert.match(r.err, /"strom facts" is now "strom query" \(the same options\)\n→ strom query --occupation mlynar --place "Horní Lhota" --count/u);
    assert.doesNotMatch(r.out + r.err, /unknown command|OCCU|Josef/u);
    const j = JSON.parse((await w.run(["facts", "--source", "S0001", "--json"], { env: { CLAUDECODE: "1" } })).out);
    assert.equal(j.code, "command.renamed");
    assert.equal(j.hint, "strom query --source S0001 --json");
    assert.deepEqual([j.params.old, j.params.now], ["facts", "query"]);
    assert.equal((await w.ok(["history", "--json"])).out, before, "nothing written");
    // the hint runs as it is
    assert.match((await w.ok(["query", "--occupation", "mlynar", "--place", "Horní Lhota", "--count"], { env: { CLAUDECODE: "1" } })).out, /: 1 person, 1 fact/u);
    // a person: the research's language (this tree's is Czech), the same call
    const person = await w.run(["facts", "--count"], { tty: true });
    assert.match(person.err + person.out, /„strom facts“ je teď „strom query“ \(stejné přepínače\)\n→ strom query --count/u);
  } finally {
    w.cleanup();
  }
});

test("strom help facts, the old name: the rename said as running it says it, then the help of strom query — never an unknown command", async () => {
  const w = new World();
  try {
    for (const args of [["help", "facts"], ["facts", "--help"]]) {
      const r = await w.run(args, { env: { CLAUDECODE: "1" } });
      const said = r.out + r.err;
      assert.match(said, /"strom facts" is now "strom query" \(the same options\)/u, args.join(" "));
      assert.doesNotMatch(said, /unknown command/u, args.join(" "));
    }
    const help = (await w.ok(["help", "facts"], { env: { CLAUDECODE: "1" } })).out;
    assert.match(help, /→ strom help query\n\nstrom query \[options\]/u);
    assert.match(JSON.parse((await w.ok(["help", "facts", "--json"], { env: { CLAUDECODE: "1" } })).out).help, /^"strom facts" is now "strom query"/u);
    // a person's help: in their language
    const human = (await w.ok(["help", "facts", "--human", "--lang", "cs"])).out;
    assert.match(human, /„strom facts“ je teď „strom query“ \(stejné přepínače\)\n→ strom help query --human/u);
    // another unknown name: as before
    assert.match((await w.ok(["help", "factz"], { env: { CLAUDECODE: "1" } })).out, /unknown command "factz"/u);
  } finally {
    w.cleanup();
  }
});
