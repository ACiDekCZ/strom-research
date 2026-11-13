// The Strom app's JSON taken in as fully as its GEDCOM (1113-vyzkum-json-intake-uplny): a death's cause, age and house, a
// birth's house, the wedding's house and the partners' ages, a child's tie to each parent, a divorce, the couple's note —
// the same research from the JSON as from the app's GEDCOM of the same tree. And the user's own long notes (a person's, a
// family's) whole: a note keeps its beginning in `text` (≤ 500, what an older strom reads) and the whole in `whole`, given
// back to the app whole; the app's long note synced is written whole; a note an older strom's intake cut is given whole
// again by the next sync of a file that has it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { GedWriter } from "../../src/gedcom/lines.ts";
import { parseGedcomText } from "../../src/gedcom/parse.ts";
import { validateRecord } from "../../src/core/validate.ts";
import { makeNote } from "../../src/core/actions.ts";
import { update } from "../../src/core/records.ts";
import { importStromJson } from "../../src/core/import.ts";
import { readGedcom, readStromJson, type Snapshot } from "../../src/core/sync.ts";
import { NOTE_MAX, noteWhole, treeNoteText } from "../../src/core/model.ts";
import type { Family, Note, Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const open = (w: World) => Tree.open(w.cwd, w.env);

/** Long notes of the user's own: emoji (a ZWJ family too), a combining mark (NFD), Cyrillic, CJK, lines of their own. */
const PERSON_NOTE = `Prokop byl kovář v Lhotě.\n${"Žluťoučký kůň úpěl ďábelské ódy 🐄 a e\u0301 i q\u0308, ".repeat(12).trimEnd()}\nЛо\u0301хотка 漢字 👨‍👩‍👧 konec poznámky osoby.`;
const FAMILY_NOTE = `Sňatek po trojích ohláškách.\n${"Ve Lhotě pod Dubinou se slavilo tři dny 🎻, ".repeat(14).trimEnd()}\nРазвод 1930 v Praze — konec poznámky rodiny.`;
const EVENT_NOTE = `Dům čp. 14 postaven.\n${"Trámy z lesa nad Lhotou, šindel ze mlýna 🪵, ".repeat(13)}konec poznámky události.`;
for (const n of [PERSON_NOTE, FAMILY_NOTE, EVENT_NOTE]) assert.ok(n.length > NOTE_MAX && [...n].length > NOTE_MAX);
const nfc = (s: string) => s.normalize("NFC");
/** A text with no character outside the BMP (no emoji). */
const bmp = (s: string) => s.replace(/[\u{10000}-\u{10FFFF}]/gu, "");

/** The app's JSON (data version 20) of Lhotákovi. */
function appJson(): Record<string, unknown> {
  return {
    version: 20,
    persons: {
      a_prokop: {
        id: "a_prokop",
        firstName: "Prokop",
        lastName: "Lhoták",
        gender: "male",
        birthDate: "1880-03-02",
        birthPlace: "Lhota pod Dubinou",
        birthAddress: "čp. 12",
        deathDate: "1941-04-04",
        deathPlace: "Lhota pod Dubinou",
        deathCause: "zápal plic",
        deathAge: "61 let",
        deathAddress: "čp. 14",
        notes: PERSON_NOTE,
        events: [{ id: "e1", type: "custom", customLabel: "Stavba domu", date: "1904", place: "Lhota pod Dubinou", note: EVENT_NOTE }],
      },
      a_terezie: { id: "a_terezie", firstName: "Terezie", lastName: "Lhotáková", gender: "female", birthDate: "1883", birthPlace: "Lhota pod Dubinou" },
      // adopted by the father only, by both, a stepchild of both
      a_vaclav: { id: "a_vaclav", firstName: "Václav", lastName: "Lhoták", gender: "male", parentRelTypes: { a_prokop: "adoptive" } },
      a_anna: { id: "a_anna", firstName: "Anna", lastName: "Lhotáková", gender: "female", parentRelTypes: { a_prokop: "adoptive", a_terezie: "adoptive" } },
      a_jan: { id: "a_jan", firstName: "Jan", lastName: "Lhoták", gender: "male", parentRelTypes: { a_prokop: "step", a_terezie: "step" } },
    },
    partnerships: {
      u1: {
        id: "u1",
        person1Id: "a_prokop",
        person2Id: "a_terezie",
        childIds: ["a_vaclav", "a_anna", "a_jan"],
        status: "divorced",
        startDate: "1905-05-06",
        startPlace: "Lhota pod Dubinou",
        address: "čp. 14",
        ages: { a_prokop: "25 let", a_terezie: "22 let" },
        endDate: "1930",
        endPlace: "Praha",
        note: FAMILY_NOTE,
      },
    },
  };
}

/** A text as the app writes it into its GEDCOM: a CONT per line, CONC lines of ~60 characters, never cut next to a space. */
function appText(level: number, tag: string, text: string): string {
  const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const out: string[] = [];
  nfc(text).split("\n").forEach((line, i) => {
    const g = Array.from(seg.segment(line), (s) => s.segment);
    const chunks: string[] = [];
    let at = 0;
    while (at < g.length) {
      let cut = Math.min(at + 60, g.length);
      while (cut < g.length && cut > at + 1 && (g[cut - 1] === " " || g[cut] === " ")) cut--;
      chunks.push(g.slice(at, cut).join(""));
      at = cut;
    }
    out.push(i === 0 ? `${level} ${tag} ${chunks[0] ?? ""}` : `${level + 1} CONT ${chunks[0] ?? ""}`);
    for (const c of chunks.slice(1)) out.push(`${level + 1} CONC ${c}`);
  });
  return out.join("\n");
}

/** The app's GEDCOM of the same tree, as its exporter writes it (HEAD SOUR STROM, PEDI, _FREL/_MREL, AGE, CAUS, ADDR). */
function appGed(): string {
  return [
    "0 HEAD",
    "1 SOUR STROM",
    "1 GEDC",
    "2 VERS 5.5.1",
    "1 CHAR UTF-8",
    "0 @I1@ INDI",
    "1 NAME Prokop /Lhoták/",
    "1 SEX M",
    "1 BIRT",
    "2 DATE 2 MAR 1880",
    "2 PLAC Lhota pod Dubinou",
    "2 ADDR čp. 12",
    "1 DEAT",
    "2 DATE 4 APR 1941",
    "2 PLAC Lhota pod Dubinou",
    "2 CAUS zápal plic",
    "2 AGE 61y",
    "2 ADDR čp. 14",
    "1 EVEN",
    "2 TYPE Stavba domu",
    "2 DATE 1904",
    "2 PLAC Lhota pod Dubinou",
    appText(2, "NOTE", EVENT_NOTE),
    appText(1, "NOTE", PERSON_NOTE),
    "1 FAMS @F1@",
    "0 @I2@ INDI",
    "1 NAME Terezie /Lhotáková/",
    "1 SEX F",
    "1 BIRT",
    "2 DATE 1883",
    "2 PLAC Lhota pod Dubinou",
    "1 FAMS @F1@",
    "0 @I3@ INDI",
    "1 NAME Václav /Lhoták/",
    "1 SEX M",
    "1 FAMC @F1@",
    "2 PEDI adopted",
    "0 @I4@ INDI",
    "1 NAME Anna /Lhotáková/",
    "1 SEX F",
    "1 FAMC @F1@",
    "2 PEDI adopted",
    "0 @I5@ INDI",
    "1 NAME Jan /Lhoták/",
    "1 SEX M",
    "1 FAMC @F1@",
    "0 @F1@ FAM",
    "1 HUSB @I1@",
    "1 WIFE @I2@",
    "1 CHIL @I3@",
    "2 _FREL Adopted",
    "2 _MREL Natural",
    "1 CHIL @I4@",
    "1 CHIL @I5@",
    "2 _FREL Step",
    "2 _MREL Step",
    "1 MARR",
    "2 DATE 6 MAY 1905",
    "2 PLAC Lhota pod Dubinou",
    "2 ADDR čp. 14",
    "2 HUSB",
    "3 AGE 25y",
    "2 WIFE",
    "3 AGE 22y",
    "1 DIV",
    "2 DATE 1930",
    "2 PLAC Praha",
    appText(1, "NOTE", FAMILY_NOTE),
    "0 TRLR",
    "",
  ].join("\n");
}

/** What a research holds of Lhotákovi, by given names (the IDs of the two intakes differ). */
function holds(t: Tree): unknown {
  const people = t.list<Person>("person");
  const given = new Map(people.map((p) => [p.id, p.names[0]!.given ?? ""]));
  const events = (es: { kind: string; date?: string; place?: string; cause?: string; age?: string; house?: string; label?: string; note?: string; ages?: Record<string, string>; share?: unknown }[]) =>
    es
      .map((e) => ({
        kind: e.kind,
        share: e.share,
        date: e.date,
        place: e.place,
        cause: e.cause,
        age: e.age,
        house: e.house,
        label: e.label,
        note: e.note,
        ages: e.ages && Object.fromEntries(Object.entries(e.ages).map(([id, a]) => [given.get(id), a])),
      }))
      .sort((a, b) => a.kind.localeCompare(b.kind));
  return {
    people: Object.fromEntries(
      people.map((p) => [
        given.get(p.id),
        { names: p.names.map((n) => ({ given: n.given, surname: n.surname, kind: n.kind, primary: n.primary })), events: events(p.events), notes: p.notes.map(noteWhole) },
      ]),
    ),
    families: t.list<Family>("family").map((f) => ({
      partners: f.partners.map((id) => given.get(id)),
      noCouple: f.noCouple,
      events: events(f.events),
      notes: f.notes.map(noteWhole),
      children: f.children
        .map((c) => ({ child: given.get(c.person), relation: c.relation, relations: c.relations && Object.fromEntries(Object.entries(c.relations).map(([id, r]) => [given.get(id), r])) }))
        .sort((a, b) => String(a.child).localeCompare(String(b.child))),
    }))
      .sort((a, b) => JSON.stringify([a.partners, a.children]).localeCompare(JSON.stringify([b.partners, b.children]))),
  };
}

test("the app's JSON taken in as its GEDCOM of the same tree: cause, age and house of a death, the wedding's house and ages, each child's tie, the divorce, long notes whole", opts, async () => {
  const w = new World();
  const g = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    const file = path.join(w.dir, "lhotakovi.json");
    fs.writeFileSync(file, JSON.stringify(appJson()));
    await w.ok(["intake", file]);
    await g.withTree("Lhotákovi");
    await g.ok(["lang", "cs"]);
    const ged = path.join(g.dir, "lhotakovi.ged");
    fs.writeFileSync(ged, appGed());
    await g.ok(["intake", ged]);

    const fromJson = holds(open(w)) as { people: Record<string, { events: { kind: string; cause?: string; age?: string; house?: string; note?: string }[]; notes: string[] }>; families: { events: { kind: string; house?: string; ages?: Record<string, string> }[]; notes: string[]; children: unknown[] }[] };
    assert.deepEqual(fromJson, holds(open(g)));
    // and what it holds: nothing of it left out
    const prokop = fromJson.people.Prokop!;
    const death = prokop.events.find((e) => e.kind === "DEAT")!;
    // the house by its number, as the research keeps one ("čp. 14" → "14")
    assert.deepEqual([death.cause, death.age, death.house], ["zápal plic", "61y", "14"]);
    assert.equal(prokop.events.find((e) => e.kind === "BIRT")!.house, "12");
    assert.equal(prokop.events.find((e) => e.kind === "EVEN")!.note, nfc(EVENT_NOTE));
    assert.deepEqual(prokop.notes, [nfc(PERSON_NOTE)]);
    const fam = fromJson.families[0]!;
    assert.deepEqual(fam.notes, [nfc(FAMILY_NOTE)]);
    const marr = fam.events.find((e) => e.kind === "MARR")!;
    assert.deepEqual([marr.house, marr.ages], ["14", { Prokop: "25y", Terezie: "22y" }]);
    assert.ok(fam.events.some((e) => e.kind === "DIV"));
    assert.deepEqual(fam.children, [
      { child: "Anna", relation: "adopted", relations: undefined },
      { child: "Jan", relation: "step", relations: undefined },
      { child: "Václav", relation: "adopted", relations: { Terezie: "birth" } },
    ]);
    assert.match((await w.ok(["check"])).out, /^ok/u);

    // the note keeps its beginning for an older strom (≤ 500) and the whole beside it
    const t = open(w);
    const note = t.list<Person>("person").find((p) => p.names[0]!.given === "Prokop")!.notes[0]!;
    assert.ok(note.text.length <= NOTE_MAX && note.text.endsWith("…") && note.whole === nfc(PERSON_NOTE));
    assert.ok(nfc(PERSON_NOTE).startsWith(note.text.slice(0, -1)));

    // given back to the app whole (GEDCOM for the app), read again the same, nothing broken (no U+FFFD)
    const back = exportGedcom(t, { for: "strom" }).text;
    assert.equal(back.includes("�"), false);
    const notes = parseGedcomText(back).records.flatMap((r) => r.children.filter((c) => c.tag === "NOTE").map((c) => c.value));
    for (const n of [PERSON_NOTE, FAMILY_NOTE]) assert.ok(notes.includes(nfc(n)), `whole in the GEDCOM: ${n.slice(0, 30)}`);
  } finally {
    w.cleanup();
    g.cleanup();
  }
});

test("a relation word of the app the research does not know is said among the intake's problems, the child taken as born", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const json = appJson();
    (json.persons as Record<string, { parentRelTypes?: Record<string, string> }>).a_jan!.parentRelTypes = { a_prokop: "guardianship" };
    const r = importStromJson(open(w), json as unknown as Parameters<typeof importStromJson>[1], { input: "I0001", name: "lhotakovi.json" });
    assert.deepEqual(r.problems.filter((p) => p.includes("guardianship")).length, 1, JSON.stringify(r.problems));
    const fam = open(w).list<Family>("family")[0]!;
    const jan = open(w).list<Person>("person").find((p) => p.names[0]!.given === "Jan")!;
    assert.equal(fam.children.find((c) => c.person === jan.id)!.relation, "birth");
  } finally {
    w.cleanup();
  }
});

/** A smaller tree of the app's, the JSON (data version 20) of what its GEDCOM below has: a census shared by a household, a
 * couple separated, a "?" partner (a placeholder), a child of one parent, a child of two who are no couple, married names,
 * a couple married with nothing known of it and one divorced with no date. Names decomposed (NFD) and in Cyrillic. */
function lhotaJson(): Record<string, unknown> {
  const nfd = (s: string) => s.normalize("NFD");
  const P = (id: string, firstName: string, lastName: string, gender: string, more: Record<string, unknown> = {}) => ({
    id,
    firstName,
    lastName,
    gender,
    isPlaceholder: false,
    partnerships: [],
    parentIds: [],
    childIds: [],
    ...more,
  });
  const census = (id: string, age: string, more: Record<string, unknown> = {}) => [{ id, type: "census", date: "1921-02-15", place: "Lhota pod Dubinou", age, shareId: "LHCEN1921", ...more }];
  return {
    version: 20,
    persons: {
      c_bohumil: P("c_bohumil", "Bohumil", "Lhota", "male", { partnerships: ["u_main"], childIds: ["c_kaja"], events: census("ce1", "42") }),
      c_ruzena: P("c_ruzena", nfd("Růžena"), nfd("Lhotecká"), "female", { marriedSurname: nfd("Lhotová"), primaryName: "married", partnerships: ["u_main"], childIds: ["c_kaja"], events: census("ce2", "38 let") }),
      c_kaja: P("c_kaja", "Кая", "Lhota", "female", { parentIds: ["c_bohumil", "c_ruzena"], events: census("ce3", "11 let", { shareRole: "dcera" }) }),
      c_vilem: P("c_vilem", "Vilém", "Lhota", "male", { partnerships: ["u_q"], childIds: ["c_ota", "c_eliska"] }),
      c_q: P("c_q", "?", "", "female", { isPlaceholder: true, partnerships: ["u_q"], childIds: ["c_ota"] }),
      c_ota: P("c_ota", "Ota", "Lhota", "male", { parentIds: ["c_vilem", "c_q"] }),
      c_eliska: P("c_eliska", "Eliška", "Lhotová", "female", { parentIds: ["c_vilem"] }),
      c_karel: P("c_karel", "Karel", "Lhoták", "male", { childIds: ["c_jiri"] }),
      c_zdena: P("c_zdena", "Zdena", "Lhotáková", "female", { childIds: ["c_jiri"] }),
      c_jiri: P("c_jiri", "Jiří", "Lhoták", "male", { parentIds: ["c_karel", "c_zdena"], parentRelTypes: { c_karel: "step" } }),
      c_frantisek: P("c_frantisek", "František", "Lhotský", "male", { partnerships: ["u_bare"] }),
      c_marta: P("c_marta", "Marta", "Lhotecká", "female", { marriedSurname: "Lhotská", marriedFirstName: "Marta Anna", primaryName: "birth", partnerships: ["u_bare"] }),
      c_josef: P("c_josef", "Josef", "Lhotecký", "male", { partnerships: ["u_div"] }),
      c_anezka: P("c_anezka", "Anežka", "Lhotecká", "female", { partnerships: ["u_div"] }),
    },
    partnerships: {
      u_main: { id: "u_main", person1Id: "c_bohumil", person2Id: "c_ruzena", childIds: ["c_kaja"], status: "separated", startDate: "1908", startPlace: "Lhota pod Dubinou", endDate: "1925" },
      u_q: { id: "u_q", person1Id: "c_vilem", person2Id: "c_q", childIds: ["c_ota"], status: "married" },
      u_bare: { id: "u_bare", person1Id: "c_frantisek", person2Id: "c_marta", childIds: [], status: "married" },
      u_div: { id: "u_div", person1Id: "c_josef", person2Id: "c_anezka", childIds: [], status: "divorced" },
    },
    sources: {},
    places: {},
  };
}

/** The app's GEDCOM of the same tree, as its exporter (3.28) writes it. */
function lhotaGed(): string {
  const person = (x: string, names: string[], sex: string, more: string[] = []) => [`0 @${x}@ INDI`, ...names, `1 SEX ${sex}`, ...more];
  const census = (age: string, more: string[] = []) => ["1 CENS", "2 DATE 15 FEB 1921", "2 PLAC Lhota pod Dubinou", `2 AGE ${age}`, "2 _STROM_SHARE LHCEN1921", ...more];
  return [
    "0 HEAD",
    "1 SOUR STROM",
    "2 VERS 3.28.0",
    "1 GEDC",
    "2 VERS 5.5.1",
    "1 CHAR UTF-8",
    "1 _STROM_SEX_U Y",
    ...person("I1", ["1 NAME Bohumil /Lhota/"], "M", [...census("42y"), "1 FAMS @F1@"]),
    ...person("I2", ["1 NAME Růžena /Lhotecká/", "1 NAME Růžena /Lhotová/", "2 TYPE married", "2 _STROM_PRIMARY Y"], "F", [...census("38y"), "1 FAMS @F1@"]),
    ...person("I3", ["1 NAME Кая /Lhota/"], "F", [...census("11y", ["3 _ROLE dcera"]), "1 FAMC @F1@"]),
    ...person("I4", ["1 NAME Vilém /Lhota/"], "M", ["1 FAMS @F2@", "1 FAMS @F5@"]),
    ...person("I5", ["1 NAME Ota /Lhota/"], "M", ["1 FAMC @F2@"]),
    ...person("I6", ["1 NAME Eliška /Lhotová/"], "F", ["1 FAMC @F5@"]),
    ...person("I7", ["1 NAME Karel /Lhoták/"], "M", ["1 FAMS @F6@"]),
    ...person("I8", ["1 NAME Zdena /Lhotáková/"], "F", ["1 FAMS @F6@"]),
    ...person("I9", ["1 NAME Jiří /Lhoták/"], "M", ["1 FAMC @F6@"]),
    ...person("I10", ["1 NAME František /Lhotský/"], "M", ["1 FAMS @F3@"]),
    ...person("I11", ["1 NAME Marta /Lhotecká/", "2 _STROM_PRIMARY Y", "1 NAME Marta Anna /Lhotská/", "2 TYPE married"], "F", ["1 FAMS @F3@"]),
    ...person("I12", ["1 NAME Josef /Lhotecký/"], "M", ["1 FAMS @F4@"]),
    ...person("I13", ["1 NAME Anežka /Lhotecká/"], "F", ["1 FAMS @F4@"]),
    ...["0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "1 MARR", "2 DATE 1908", "2 PLAC Lhota pod Dubinou", "1 DIV", "2 DATE 1925", "1 _STAT Separated"],
    ...["0 @F2@ FAM", "1 HUSB @I4@", "1 CHIL @I5@"],
    ...["0 @F3@ FAM", "1 HUSB @I10@", "1 WIFE @I11@", "1 MARR"],
    ...["0 @F4@ FAM", "1 HUSB @I12@", "1 WIFE @I13@", "1 MARR", "1 DIV"],
    ...["0 @F5@ FAM", "1 HUSB @I4@", "1 CHIL @I6@"],
    ...["0 @F6@ FAM", "1 HUSB @I7@", "1 WIFE @I8@", "1 CHIL @I9@", "2 _FREL Step", "2 _MREL Natural", "1 _STROM_NO_COUPLE Y"],
    "0 TRLR",
    "",
  ].join("\n");
}

test("the app's JSON taken in as its GEDCOM: a shared census's ages, a separation's date, no placeholder, a one-parent family, married names, a bare wedding and divorce", opts, async () => {
  const w = new World();
  const g = new World();
  try {
    await w.withTree("Lhotovi");
    await w.ok(["lang", "cs"]);
    const file = path.join(w.dir, "lhotovi.json");
    fs.writeFileSync(file, JSON.stringify(lhotaJson()));
    await w.ok(["intake", file]);
    await g.withTree("Lhotovi");
    await g.ok(["lang", "cs"]);
    const ged = path.join(g.dir, "lhotovi.ged");
    fs.writeFileSync(ged, lhotaGed());
    await g.ok(["intake", ged]);

    type Held = {
      people: Record<string, { names: { given?: string; surname?: string; kind?: string; primary?: true }[]; events: { kind: string; date?: string; age?: string; share?: { id: string; role?: string } }[] }>;
      families: { partners: string[]; events: { kind: string; date?: string; place?: string }[]; children: { child: string; relation?: string; relations?: Record<string, string> }[] }[];
    };
    const fromJson = holds(open(w)) as Held;
    assert.deepEqual(fromJson, holds(open(g)));
    // and what it holds, point by point
    // (c) the app's "?" is nobody: thirteen people, no "?"
    assert.deepEqual(Object.keys(fromJson.people).sort(), ["Anežka", "Bohumil", "Eliška", "František", "Jiří", "Josef", "Karel", "Marta", "Ota", "Růžena", "Vilém", "Zdena", "Кая"].map(nfc).sort());
    // (a) each one's age at the census they share
    assert.deepEqual(
      ["Bohumil", "Růžena", "Кая"].map((n) => fromJson.people[nfc(n)]!.events.map((e) => [e.kind, e.age, e.share?.id, e.share?.role])),
      [[["CENS", "42y", "LHCEN1921", undefined]], [["CENS", "38y", "LHCEN1921", undefined]], [["CENS", "11y", "LHCEN1921", "dcera"]]],
    );
    // (e) the name after the marriage, primary as the app says (NFD given as NFC)
    assert.deepEqual(fromJson.people[nfc("Růžena")]!.names, [
      { given: nfc("Růžena"), surname: nfc("Lhotecká"), kind: undefined, primary: undefined },
      { given: nfc("Růžena"), surname: nfc("Lhotová"), kind: "married", primary: true },
    ]);
    assert.deepEqual(fromJson.people.Marta!.names, [
      { given: "Marta", surname: nfc("Lhotecká"), kind: undefined, primary: true },
      { given: "Marta Anna", surname: nfc("Lhotská"), kind: "married", primary: undefined },
    ]);
    const family = (a: string) => fromJson.families.find((f) => f.partners[0] === nfc(a))!;
    // (b) separated: the wedding and the parting with its date
    assert.deepEqual(family("Bohumil").events.map((e) => [e.kind, e.date, e.place]), [["DIV", "1925", undefined], ["MARR", "1908", "Lhota pod Dubinou"]]);
    // (d) the father alone with both his children (the "?" mother is nobody, Eliška's other parent unknown)
    assert.deepEqual(family("Vilém").partners, [nfc("Vilém")]);
    assert.deepEqual(family("Vilém").children.map((c) => c.child), ["Eliška", "Ota"].map(nfc));
    // (d) two parents who are no couple: a family of their own with no wedding, the stepfather's tie kept
    assert.deepEqual(family("Karel").events, []);
    assert.deepEqual(family("Karel").children.map((c) => [c.child, c.relation, c.relations]), [[nfc("Jiří"), "birth", { Karel: "step" }]]);
    // (f, g) married with nothing known: a bare wedding; divorced with no date: a bare divorce
    assert.deepEqual(family("František").events.map((e) => [e.kind, e.date]), [["MARR", undefined]]);
    assert.deepEqual(family("Josef").events.map((e) => [e.kind, e.date]), [["DIV", undefined], ["MARR", undefined]]);
    assert.equal(fromJson.families.length, 5);
    assert.match((await w.ok(["check"])).out, /^ok/u);
  } finally {
    w.cleanup();
    g.cleanup();
  }
});

test("strom sync reads the app's JSON as its GEDCOM of the same tree: the same people, names after a marriage, families and their facts", () => {
  // names as the research compares them (the JSON's decomposed letters as they come, the GEDCOM's composed)
  const seen = (snap: Snapshot) => {
    const name = new Map([...snap.persons.values()].map((p) => [p.key, nfc(p.names[0]!)]));
    const facts = (fs: Snapshot["families"][number]["facts"]) => fs.map((f) => [f.kind, f.date, f.place, f.age, f.share]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return {
      people: [...snap.persons.values()].map((p) => ({ names: p.names.map(nfc), married: p.married?.map(nfc), primary: p.primary?.split("|")[0], facts: facts(p.facts) })).sort((a, b) => a.names[0]!.localeCompare(b.names[0]!)),
      families: snap.families
        .map((f) => ({ partners: f.partners.map((k) => name.get(k)), children: f.children.map((k) => name.get(k)).sort(), facts: facts(f.facts) }))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    };
  };
  const json = seen(readStromJson(lhotaJson(), "cs"));
  assert.deepEqual(json, seen(readGedcom(lhotaGed(), "cs")));
  assert.deepEqual(json.people.find((p) => p.names[0] === "Marta /Lhotecká/")!.married, ["Marta Anna /Lhotská/"]);
  assert.equal(json.people.some((p) => p.names[0]!.startsWith("?")), false);
});

test("a note's whole: valid only longer than its beginning; a note strom makes itself still at most 500", () => {
  const whole = nfc(PERSON_NOTE);
  const t = treeNoteText(PERSON_NOTE);
  assert.equal(t.whole, whole);
  assert.ok(t.text.length <= NOTE_MAX && t.text.endsWith("…"));
  // never a half of a surrogate pair: an emoji right at the cut
  for (let i = 0; i < 4; i++) {
    const cut = treeNoteText(`${"a".repeat(NOTE_MAX - 2 - i)}${"🐄".repeat(10)}`).text;
    assert.ok(cut.length <= NOTE_MAX && !/[\uD800-\uDBFF]…$/u.test(cut) && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(cut));
  }
  assert.deepEqual(treeNoteText(" krátká \n poznámka "), { text: "krátká\n poznámka" });
  const person = (notes: Note[]) =>
    ({ id: "P0001", type: "person", names: [{ given: "Prokop", surname: "Lhoták" }], sex: "M", events: [], notes, created: "2026-11-13T10:00:00.000Z", updated: "2026-11-13T10:00:00.000Z" }) as unknown as Person;
  const at = { at: "2026-11-13T10:00:00.000Z", by: "user" };
  const problems = (n: Note) => validateRecord(person([n])).filter((p) => p.path.includes("notes"));
  assert.deepEqual(problems({ ...t, ...at } as Note), []);
  assert.notDeepEqual(problems({ text: t.text, whole: t.text, ...at }), [], "a whole no longer than its beginning");
  assert.notDeepEqual(problems({ text: whole, ...at }), [], "a text over 500");
  assert.throws(() => makeNote({ actor: "user" } as unknown as Tree, whole), /max 500/u);
});

test("GEDCOM text cut into CONC lines and joined again is the same text: emoji (ZWJ), combining marks, CJK, Cyrillic", () => {
  // a fixed sequence (no Math.random): the same cases every run
  let seed = 1113;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pieces = ["🐄", "👨‍👩‍👧", "🇨🇿", "q̈", "é", "á̱", "漢", "字", "Ло́", "х", "ž", " ", "  ", "–", "@", "x", "Lhota", " "];
  for (let run = 0; run < 200; run++) {
    const lines: string[] = [];
    const count = 1 + Math.floor(next() * 3);
    for (let l = 0; l < count; l++) {
      let s = "";
      const len = Math.floor(next() * 400);
      for (let i = 0; i < len; i++) s += pieces[Math.floor(next() * pieces.length)];
      lines.push(s.trim() || "x");
    }
    const text = lines.join("\n");
    const out = new GedWriter();
    out.record("@N1@", "INDI");
    out.text(1, "NOTE", text);
    for (const line of out.lines) assert.ok(Buffer.byteLength(line, "utf8") <= 255, line);
    const read = parseGedcomText(out.toString()).records[0]!.children.find((c) => c.tag === "NOTE")!.value;
    assert.equal(read, nfc(text).split("\n").map((l) => l.trim()).join("\n"), `run ${run}`);
    assert.equal(read.includes("�"), false);
  }
});

/** The research's ID, its persons' IDs by given name, its commit now. */
function ours(w: World): { id: string; ids: Map<string, string>; head: string } {
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const ids = new Map(open(w).list<Person>("person").map((p) => [p.names[0]!.given ?? "", p.id]));
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).stdout.trim();
  return { id, ids, head };
}

/** The app's JSON as it comes back to the research: its persons with the research's IDs (REFN), the research named. */
function syncJson(w: World, json: Record<string, unknown>, head?: string): string {
  const { id, ids } = ours(w);
  const persons = json.persons as Record<string, { firstName: string }>;
  for (const p of Object.values(persons)) Object.assign(p, { refn: ids.get(p.firstName), refnType: "strom-research" });
  const file = path.join(w.dir, `zpet-${Math.floor(Math.random() * 1e9)}.json`);
  fs.writeFileSync(file, JSON.stringify({ ...json, research: { id, ...(head ? { head } : {}) } }));
  return file;
}

test("sync: the app's long note new to the research is written whole (it was refused over 500 before)", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    const json = appJson();
    const persons = json.persons as Record<string, { notes?: string }>;
    delete persons.a_prokop!.notes;
    const file = path.join(w.dir, "lhotakovi.json");
    fs.writeFileSync(file, JSON.stringify(json));
    await w.ok(["intake", file]);
    persons.a_prokop!.notes = PERSON_NOTE;
    const back = syncJson(w, json);
    const r = (await w.ok(["sync", back, "--apply", "--json"])).json;
    assert.deepEqual(r.changes.filter((c: { kind: string }) => c.kind.startsWith("note.")).map((c: { kind: string; text: string }) => [c.kind, nfc(c.text)]), [["note.new", nfc(PERSON_NOTE)]]);
    const prokop = open(w).list<Person>("person").find((p) => p.names[0]!.given === "Prokop")!;
    assert.deepEqual(prokop.notes.map(noteWhole), [nfc(PERSON_NOTE)]);
    assert.deepEqual((await w.ok(["sync", back, "--json"])).json.changes, [], "the same file again: nothing");
    assert.match((await w.ok(["check"])).out, /^ok/u);
  } finally {
    w.cleanup();
  }
});

test("sync: a note an older strom's intake cut at 500 characters is given whole again by a file that has it, and taken back cut again", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    // notes an older strom could keep cut: no emoji (cut by code points, one would make it over 500 in UTF-16 — such a
    // person an older strom's intake could not write at all)
    const PERSON = bmp(PERSON_NOTE);
    const FAMILY = bmp(FAMILY_NOTE);
    const app = () => {
      const json = appJson();
      (json.persons as Record<string, { notes?: string }>).a_prokop!.notes = PERSON;
      (json.partnerships as Record<string, { note?: string }>).u1!.note = FAMILY;
      return json;
    };
    const file = path.join(w.dir, "lhotakovi.json");
    fs.writeFileSync(file, JSON.stringify(app()));
    await w.ok(["intake", file]);
    // the person's and the family's notes as an older strom's intake left them: 499 characters (code points) and "…"
    const cut = (s: string) => [...nfc(s)].slice(0, NOTE_MAX - 1).join("") + "…";
    const tree = open(w);
    const prokop = tree.list<Person>("person").find((p) => p.names[0]!.given === "Prokop")!;
    const fam = tree.list<Family>("family")[0]!;
    const older = (n: Note): Note => {
      const { whole: _w, ...rest } = n;
      return { ...rest, text: cut(noteWhole(n)) };
    };
    tree.withTreeLock(() => {
      update<Person>(tree, prokop.id, "person", (p) => ({ ...p, notes: p.notes.map(older) }), { op: "note.edit", summary: `${prokop.id} note as an older strom cut it` });
      update<Family>(tree, fam.id, "family", (f) => ({ ...f, notes: f.notes.map(older) }), { op: "note.edit", summary: `${fam.id} note as an older strom cut it` });
      tree.commit("Notes as an older strom cut them");
    });
    const before = open(w);
    const cutNote = before.get<Person>(prokop.id)!.notes[0]!;
    assert.equal(cutNote.whole, undefined);
    assert.equal(cutNote.text.length, NOTE_MAX);

    // a file that names no state (the user's own tree's JSON again): only the notes, given whole again
    const plain = syncJson(w, app());
    const shown = (await w.ok(["sync", plain, "--json"])).json.changes;
    assert.deepEqual(
      shown.map((c: { kind: string; action: string; text: string; note?: { whole?: boolean } }) => [c.kind, c.action, c.text, c.note?.whole]),
      [
        ["note.changed", "correct", nfc(PERSON), true],
        ["note.changed", "correct", nfc(FAMILY), true],
      ],
    );
    const { head } = ours(w);
    const done = (await w.ok(["sync", syncJson(w, app(), head), "--apply", "--json"])).json;
    assert.equal(done.changes.length, 2, JSON.stringify(done.changes));
    const after = open(w);
    for (const [id, text] of [[prokop.id, PERSON], [fam.id, FAMILY]] as const) {
      const n = after.get<Person | Family>(id)!.notes;
      assert.equal(n.length, 1);
      assert.equal(noteWhole(n[0]!), nfc(text));
      assert.ok(n[0]!.text.length <= NOTE_MAX);
    }
    assert.match((await w.ok(["check"])).out, /^ok/u);
    assert.deepEqual((await w.ok(["sync", plain, "--json"])).json.changes, [], "whole now: nothing more");
    assert.ok(exportGedcom(after, { for: "strom" }).text.includes("konec poznámky osoby"));

    // taken back: cut as it was
    await w.ok(["sync", "undo", done.input]);
    assert.equal(open(w).get<Person>(prokop.id)!.notes[0]!.text, cutNote.text);
    assert.equal(open(w).get<Person>(prokop.id)!.notes[0]!.whole, undefined);
  } finally {
    w.cleanup();
  }
});

test("sync: a note an older strom's intake cut from decomposed text (NFD) is known as cut and given whole; a short note ending in \"…\" is the user's own", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    // the app gave the note decomposed (pasted text): every "ů", "é" a letter and its mark; Cyrillic with a stress mark too
    const NOTE = bmp(PERSON_NOTE).normalize("NFD");
    const SHORT = "Prokop odešel do Lhoty…";
    const app = (note: string) => {
      const json = appJson();
      (json.persons as Record<string, { notes?: string }>).a_prokop!.notes = note;
      (json.persons as Record<string, { notes?: string }>).a_terezie!.notes = `${SHORT} a vrátil se 1912.`;
      return json;
    };
    const file = path.join(w.dir, "lhotakovi.json");
    fs.writeFileSync(file, JSON.stringify(app(NOTE)));
    await w.ok(["intake", file]);
    // as an older strom's intake left it: the first 499 code points of the text as the file gave it (NFD) and "…",
    // kept in NFC — fewer than 499 characters now
    const cut = nfc([...NOTE].slice(0, NOTE_MAX - 1).join("") + "…");
    assert.ok([...cut].length < NOTE_MAX - 1, "fewer now than it was cut at");
    const tree = open(w);
    const prokop = tree.list<Person>("person").find((p) => p.names[0]!.given === "Prokop")!;
    const terezie = tree.list<Person>("person").find((p) => p.names[0]!.given === "Terezie")!;
    const at = { at: "2026-11-13T10:00:00.000Z", by: "user" };
    tree.withTreeLock(() => {
      update<Person>(tree, prokop.id, "person", (p) => ({ ...p, notes: [{ ...at, text: cut }] }), { op: "note.edit", summary: `${prokop.id} note as an older strom cut it` });
      update<Person>(tree, terezie.id, "person", (p) => ({ ...p, notes: [{ ...at, text: SHORT }] }), { op: "note.edit", summary: `${terezie.id} a short note of the user's` });
      tree.commit("A note as an older strom cut it, a short one of the user's");
    });
    const changes = (await w.ok(["sync", syncJson(w, app(NOTE)), "--json"])).json.changes as { kind: string; action: string; person?: string; text: string; note?: { whole?: boolean } }[];
    const notes = changes.filter((c) => c.kind.startsWith("note."));
    // the cut one: given whole, a correction — not a pick of its lines and a note of its own
    assert.deepEqual(
      notes.filter((c) => c.person === prokop.id).map((c) => [c.kind, c.action, nfc(c.text), c.note?.whole]),
      [["note.changed", "correct", nfc(NOTE), true]],
    );
    // the user's short note that ends in "…": never taken as cut, the app's longer text no correction of it
    assert.equal(notes.some((c) => c.person === terezie.id && c.kind === "note.changed" && c.action === "correct"), false, JSON.stringify(notes));
  } finally {
    w.cleanup();
  }
});

test("a note's whole only while its text is still the whole's beginning: an older strom's correction of the text is the note now", opts, async () => {
  const whole = nfc(PERSON_NOTE);
  const { text } = treeNoteText(PERSON_NOTE);
  assert.equal(noteWhole({ text, whole }), whole);
  // the beginning decomposed (NFD), with a space before "…": still the whole's beginning
  assert.equal(noteWhole({ text: `${text.slice(0, -1).normalize("NFD")} …`, whole }), whole);
  // corrected: no longer "…" at its end, or a beginning the whole has not (Cyrillic, a combining mark)
  assert.equal(noteWhole({ text: "Prokop byl kovář ve Lhotě.", whole }), "Prokop byl kovář ve Lhotě.");
  assert.equal(noteWhole({ text: "Ло́хотка, opraveno…", whole }), "Ло́хотка, opraveno…");
  assert.equal(noteWhole({ text: "jen text" }), "jen text");

  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    const file = path.join(w.dir, "lhotakovi.json");
    fs.writeFileSync(file, JSON.stringify(appJson()));
    await w.ok(["intake", file]);
    const tree = open(w);
    const prokop = tree.list<Person>("person").find((p) => p.names[0]!.given === "Prokop")!;
    assert.equal(prokop.notes[0]!.whole, whole);
    // an older strom's strom note edit: the text corrected, the `whole` it does not know of kept as it was
    const fixed = "Prokop byl kovář ve Lhotě pod Dubinou, ne v Praze (opraveno).";
    tree.withTreeLock(() => {
      update<Person>(tree, prokop.id, "person", (p) => ({ ...p, notes: p.notes.map((n) => ({ ...n, text: fixed })) }), { op: "note.edit", summary: `${prokop.id} note corrected by an older strom` });
      tree.commit("A note corrected by an older strom");
    });
    const shown = (await w.ok(["person", "show", prokop.id])).out;
    assert.ok(shown.includes(fixed), shown);
    assert.equal(shown.includes("konec poznámky osoby"), false, "the stale whole not shown");
    const back = exportGedcom(open(w), { for: "strom" }).text;
    assert.ok(back.includes(fixed));
    assert.equal(back.includes("konec poznámky osoby"), false, "the stale whole not given to the app");
  } finally {
    w.cleanup();
  }
});
