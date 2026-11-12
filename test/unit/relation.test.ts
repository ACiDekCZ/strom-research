// How one person is related to another in words: the Strom app's kinship calculator over the research's families.
// The expected terms and paths below are what the app's findRelationship (strom src/kinship.ts) gives for the same
// family run through it — a relation the research names is the one the app's relationship finder names. The side of
// the family and the generation, which the app has not, are tested apart. Made-up data only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Event, Family, Person } from "../../src/core/model.ts";
import type { Tree } from "../../src/core/tree.ts";
import { relationBetween, relationsFrom, relationText, sideText } from "../../src/core/relation.ts";

// [id, sex, given, surname, retracted?]
const PEOPLE: [string, "M" | "F" | "U", string, string, boolean?][] = [
  ["P0001", "F", "Šárka", "Lhotáková"],
  ["P0002", "M", "Jan", "Lhoták"],
  ["P0003", "F", "Anna", "Lhotáková"],
  ["P0004", "M", "Petr", "Lhoták"],
  ["P0005", "M", "Josef", "Lhoták"],
  ["P0006", "F", "Marie", "Lhotáková"],
  ["P0007", "M", "Karel", "Lhoták"],
  ["P0008", "M", "Václav", "Lhota"],
  ["P0009", "F", "Ludmila", "Lhotová"],
  ["P0010", "F", "Věra", "Lhotová"],
  ["P0011", "M", "František", "Lhoták"],
  ["P0012", "F", "Rozálie", "Lhotáková"],
  ["P0013", "M", "Matěj", "Lhoták"],
  ["P0014", "M", "Vojtěch", "Lhoták"],
  ["P0015", "F", "Kateřina", "Lhotáková"],
  ["P0016", "M", "Jiří", "Lhoták"],
  ["P0017", "U", "Ignác", "Lhoták"],
  ["P0018", "M", "Tomáš", "Lhoták"],
  ["P0019", "M", "Řehoř", "Lhoták"],
  ["P0020", "U", "Kim", "Lhoták"],
  ["P0021", "M", "Ondřej", "Lhotský"],
  ["P0022", "F", "Žofie", "Lhotská"],
  ["P0023", "M", "Lukáš", "Lhotský"],
  ["P0024", "M", "Antonín", "Lhotský"],
  ["P0025", "F", "Božena", "Lhotská"],
  ["P0026", "M", "Zdeněk", "Lhotský"],
  ["P0027", "F", "Jitka", "Lhotská"],
  ["P0028", "F", "Hana", "Lhotáková"],
  ["P0029", "M", "Adam", "Lhoták"],
  ["P0030", "F", "Dana", "Lhotáková"],
  ["P0031", "M", "Bořek", "Lhoták"],
  ["P0032", "F", "Olga", "Lhotecká"],
  ["P0033", "F", "Ivana", "Lhotáková"],
  ["P0034", "M", "Filip", "Lhota"],
  ["P0035", "M", "Bohumil", "Lhotecký"],
  ["P0036", "M", "Emil", "Lhotecký"],
  ["P0037", "F", "Irena", "Lhotecká"],
  ["P0038", "F", "Lenka", "Lhotecká"],
  ["P0039", "M", "Pavel", "Lhoták"],
  ["P0040", "F", "Zora", "Lhotáková"],
  ["P0041", "M", "Ivo", "Lhoták", true],
  ["P0042", "F", "Klára", "Lhotáková"],
  ["P0043", "M", "Radek", "Lhoták", true],
  ["P0044", "M", "Igor", "Lhoták"],
  ["P0045", "F", "Nela", "Lhotská"],
  ["P0046", "M", "Roman", "Lhotecký"],
  ["P0047", "M", "Vít", "Lhoták"],
];

// [id, partners, children [person, relation, relations?], extra]
const FAMILIES: [string, string[], [string, string, Record<string, string>?][], { union?: string; events?: string[]; retracted?: boolean; noCouple?: boolean }?][] = [
  ["F0001", ["P0002", "P0003"], [["P0001", "birth"], ["P0004", "birth"], ["P0041", "birth"]], { union: "married" }],
  ["F0002", ["P0005", "P0006"], [["P0002", "birth"], ["P0007", "birth"]]],
  ["F0003", ["P0008", "P0009"], [["P0003", "birth"], ["P0010", "unknown"]]],
  ["F0004", ["P0011", "P0012"], [["P0005", "birth"], ["P0013", "birth"]]],
  ["F0005", ["P0014", "P0015"], [["P0011", "birth"]]],
  ["F0006", ["P0016", "P0017"], [["P0014", "birth"], ["P0018", "birth"]]],
  ["F0007", ["P0019"], [["P0016", "birth"]]],
  ["F0008", ["P0001", "P0021"], [["P0020", "birth"], ["P0022", "birth"]], { union: "married" }],
  ["F0009", ["P0022"], [["P0023", "birth"]]],
  ["F0010", ["P0024", "P0025"], [["P0021", "birth"], ["P0026", "birth"]]],
  ["F0011", ["P0026", "P0027"], [], { events: ["MARR 1990", "DIV 1995"] }],
  ["F0012", ["P0004", "P0028"], [["P0029", "birth"]]],
  ["F0013", ["P0007", "P0030"], [["P0031", "birth"]]],
  ["F0014", ["P0002", "P0032"], [["P0033", "birth"]], { union: "divorced" }],
  ["F0015", ["P0010"], [["P0034", "adopted"]]],
  ["F0016", ["P0036", "P0037"], [["P0030", "birth"], ["P0035", "birth"]]],
  ["F0017", ["P0035", "P0038"], []],
  ["F0018", ["P0018"], [["P0039", "birth"]]],
  ["F0019", ["P0039", "P0040"], []],
  ["F0020", ["P0002", "P0003"], [["P0042", "birth"]], { retracted: true }],
  ["F0021", ["P0007"], [["P0043", "birth"]]],
  ["F0022", ["P0043"], [["P0044", "birth"]]],
  ["F0023", ["P0020"], [["P0045", "birth"]]],
  ["F0024", ["P0001", "P0046"], [], { union: "divorced" }],
  ["F0025", ["P0013", "P0047"], [], { noCouple: true }],
];

/** A tree held in memory: the records of the families above, read as the research's are. */
function treeOf(people: typeof PEOPLE, families: typeof FAMILIES): Tree {
  const records = new Map<string, Person | Family>();
  for (const [id, sex, given, surname, retracted] of people)
    records.set(id, {
      id,
      type: "person",
      names: [{ given, surname }],
      sex,
      events: [],
      notes: [],
      ...(retracted ? { retracted: { at: "2026-01-01T00:00:00Z", reason: "a duplicate" } } : {}),
    } as unknown as Person);
  let e = 0;
  for (const [id, partners, children, extra = {}] of families) {
    const events: Event[] = (extra.events ?? []).map((s) => {
      const [kind, date] = s.split(" ");
      return { id: `E${String(++e).padStart(4, "0")}`, kind: kind!, date: date!, status: "proven", citations: [] };
    });
    records.set(id, {
      id,
      type: "family",
      partners,
      children: children.map(([person, relation, relations]) => ({ person, relation, ...(relations ? { relations } : {}) })),
      events,
      notes: [],
      ...(extra.union ? { union: extra.union } : {}),
      ...(extra.noCouple ? { noCouple: true } : {}),
      ...(extra.retracted ? { retracted: { at: "2026-01-01T00:00:00Z", reason: "wrong parents" } } : {}),
    } as unknown as Family);
  }
  return {
    version: 0,
    list: (type: string) => [...records.values()].filter((r) => r.type === type),
    get: (id: string) => records.get(id),
  } as unknown as Tree;
}

const tree = treeOf(PEOPLE, FAMILIES);

/** [from, to, the app's terms cs/en/de/pl, the app's path, affinity] — null: the app finds no relation. */
const APP: [string, string, string[] | null, string?, boolean?][] = [
  ["P0001", "P0002", ["otec","father","Vater","ojciec"], "P0001 P0002", false],
  ["P0001", "P0003", ["matka","mother","Mutter","matka"], "P0001 P0003", false],
  ["P0001", "P0005", ["děd","grandfather","Großvater","dziadek"], "P0001 P0002 P0005", false],
  ["P0001", "P0009", ["babička","grandmother","Großmutter","babcia"], "P0001 P0003 P0009", false],
  ["P0001", "P0011", ["praděd","great-grandfather","Urgroßvater","pradziadek"], "P0001 P0002 P0005 P0011", false],
  ["P0001", "P0014", ["prapraděd","great-great-grandfather","Ururgroßvater","prapradziadek"], "P0001 P0002 P0005 P0011 P0014", false],
  ["P0001", "P0016", ["praprapraděd","great-great-great-grandfather","Urururgroßvater","praprapradziadek"], "P0001 P0002 P0005 P0011 P0014 P0016", false],
  ["P0001", "P0019", ["prapraprapraděd","great-great-great-great-grandfather","Ururururgroßvater","prapraprapradziadek"], "P0001 P0002 P0005 P0011 P0014 P0016 P0019", false],
  ["P0001", "P0017", ["praprapraprarodič","great-great-great-grandparent","Urururgroßelternteil","praprapradziadek / prapraprababcia"], "P0001 P0002 P0005 P0011 P0014 P0017", false],
  ["P0001", "P0004", ["bratr","brother","Bruder","brat"], "P0001 P0002 P0004", false],
  ["P0001", "P0033", ["polorodá sestra","half-sister","Halbschwester","siostra przyrodnia"], "P0001 P0002 P0033", false],
  ["P0001", "P0007", ["strýc","uncle","Onkel","wujek"], "P0001 P0002 P0005 P0007", false],
  ["P0001", "P0010", ["teta","aunt","Tante","ciotka"], "P0001 P0003 P0008 P0010", false],
  ["P0001", "P0031", ["bratranec","first cousin","Cousin","kuzyn"], "P0001 P0002 P0005 P0007 P0031", false],
  ["P0001", "P0013", ["prastrýc","granduncle","Großonkel","brat dziadka / babci"], "P0001 P0002 P0005 P0011 P0013", false],
  ["P0001", "P0018", ["prapraprastrýc","great-great-granduncle","Ururgroßonkel","brat prapradziadka / praprababci"], "P0001 P0002 P0005 P0011 P0014 P0016 P0018", false],
  ["P0001", "P0029", ["synovec","nephew","Neffe","bratanek / siostrzeniec"], "P0001 P0002 P0004 P0029", false],
  ["P0001", "P0020", ["dítě","child","Kind","dziecko"], "P0001 P0020", false],
  ["P0001", "P0022", ["dcera","daughter","Tochter","córka"], "P0001 P0022", false],
  ["P0001", "P0023", ["vnuk","grandson","Enkel","wnuk"], "P0001 P0022 P0023", false],
  ["P0001", "P0045", ["vnučka","granddaughter","Enkelin","wnuczka"], "P0001 P0020 P0045", false],
  ["P0001", "P0021", ["manžel / partner","husband / partner","Ehemann / Partner","mąż / partner"], "P0001 P0021", true],
  ["P0001", "P0046", ["bývalý manžel / partner","ex-husband / ex-partner","Ex-Ehemann / Ex-Partner","były mąż / partner"], "P0001 P0046", true],
  ["P0001", "P0024", ["tchán","father-in-law","Schwiegervater","teść"], "P0001 P0021 P0024", true],
  ["P0001", "P0025", ["tchyně","mother-in-law","Schwiegermutter","teściowa"], "P0001 P0021 P0025", true],
  ["P0001", "P0026", ["švagr","brother-in-law","Schwager","szwagier"], "P0001 P0021 P0024 P0026", true],
  ["P0001", "P0027", ["švagrová","sister-in-law","Schwägerin","szwagierka"], "P0001 P0021 P0024 P0026 P0027", true],
  ["P0001", "P0028", ["švagrová","sister-in-law","Schwägerin","szwagierka"], "P0001 P0002 P0004 P0028", true],
  ["P0001", "P0030", ["teta (přivdaná)","aunt (by marriage)","Tante (angeheiratet)","ciotka (przez małżeństwo)"], "P0001 P0002 P0005 P0007 P0030", true],
  ["P0001", "P0032", ["nevlastní matka","stepmother","Stiefmutter","macocha"], "P0001 P0002 P0032", true],
  ["P0001", "P0034", ["bratranec (adoptivní linie)","first cousin (adoptive line)","Cousin (Adoptivlinie)","kuzyn (linia adopcyjna)"], "P0001 P0003 P0008 P0010 P0034", false],
  ["P0001", "P0039", ["bratranec (posunutí o 3 generace)","first cousin 3 times removed","Cousin (um 3 Generationen versetzt)","kuzyn (przesunięcie o 3 pokolenia)"], "P0001 P0002 P0005 P0011 P0014 P0016 P0018 P0039", false],
  ["P0001", "P0040", ["příbuzná sňatkem","related by marriage","verschwägert","spowinowacona"], "P0001 P0002 P0005 P0011 P0014 P0016 P0018 P0039 P0040", true],
  ["P0001", "P0035", null],
  ["P0001", "P0038", null],
  ["P0001", "P0042", null],
  ["P0001", "P0044", null],
  ["P0001", "P0047", null],
  ["P0001", "P0001", null],
  ["P0002", "P0001", ["dcera","daughter","Tochter","córka"], "P0002 P0001", false],
  ["P0014", "P0001", ["prapravnučka","great-great-granddaughter","Ururenkelin","praprawnuczka"], "P0014 P0011 P0005 P0002 P0001", false],
  ["P0007", "P0001", ["neteř","niece","Nichte","bratanica / siostrzenica"], "P0007 P0005 P0002 P0001", false],
  ["P0031", "P0001", ["sestřenice","first cousin","Cousine","kuzynka"], "P0031 P0007 P0005 P0002 P0001", false],
  ["P0021", "P0001", ["manželka / partnerka","wife / partner","Ehefrau / Partnerin","żona / partnerka"], "P0021 P0001", true],
  ["P0024", "P0001", ["snacha","daughter-in-law","Schwiegertochter","synowa"], "P0024 P0021 P0001", true],
  ["P0026", "P0027", ["bývalá manželka / partnerka","ex-wife / ex-partner","Ex-Ehefrau / Ex-Partnerin","była żona / partnerka"], "P0026 P0027", true],
  ["P0029", "P0001", ["teta","aunt","Tante","ciotka"], "P0029 P0004 P0002 P0001", false],
  ["P0045", "P0001", ["babička","grandmother","Großmutter","babcia"], "P0045 P0020 P0001", false],
  ["P0045", "P0002", ["praděd","great-grandfather","Urgroßvater","pradziadek"], "P0045 P0020 P0001 P0002", false],
  ["P0033", "P0001", ["polorodá sestra","half-sister","Halbschwester","siostra przyrodnia"], "P0033 P0002 P0001", false],
  ["P0018", "P0001", ["praprapraneteř","great-great-grandniece","Ururgroßnichte","praprawnuczka rodzeństwa"], "P0018 P0016 P0014 P0011 P0005 P0002 P0001", false],
  ["P0034", "P0001", ["sestřenice (adoptivní linie)","first cousin (adoptive line)","Cousine (Adoptivlinie)","kuzynka (linia adopcyjna)"], "P0034 P0010 P0008 P0003 P0001", false],
  ["P0040", "P0001", ["příbuzná sňatkem","related by marriage","verschwägert","spowinowacona"], "P0040 P0039 P0018 P0016 P0014 P0011 P0005 P0002 P0001", true],
  ["P0021", "P0028", ["švagrová","sister-in-law","Schwägerin","szwagierka"], "P0021 P0001 P0002 P0004 P0028", true],
];

test("every relation is named as the Strom app's relationship finder names it: terms, path, affinity", () => {
  for (const [from, to, terms, path, affinity] of APP) {
    const r = relationBetween(tree, from, to);
    if (!terms) {
      assert.equal(r, undefined, `${from} → ${to}: no relation`);
      continue;
    }
    assert.ok(r, `${from} → ${to}: a relation`);
    assert.deepEqual([r.term.cs, r.term.en, r.term.de, r.term.pl], terms, `${from} → ${to}`);
    assert.equal(r.path.join(" "), path, `${from} → ${to}: path`);
    assert.equal(r.affinity, affinity, `${from} → ${to}: affinity`);
  }
});

test("relationsFrom gives the same as relationBetween, person by person", () => {
  const of = relationsFrom(tree, "P0001");
  for (const [from, to] of APP.filter(([f]) => f === "P0001")) assert.deepEqual(of(to), relationBetween(tree, from, to));
});

test("a retracted person, family or parent on the way does not count", () => {
  assert.equal(relationBetween(tree, "P0001", "P0041"), undefined, "a retracted sibling");
  assert.equal(relationBetween(tree, "P0041", "P0001"), undefined, "from a retracted person");
  assert.equal(relationBetween(tree, "P0001", "P0042"), undefined, "a child of a retracted family");
  assert.equal(relationBetween(tree, "P0001", "P0044"), undefined, "through a retracted parent");
  assert.equal(relationBetween(tree, "P0001", "P0004")?.term.cs, "bratr", "the retracted sibling takes nothing from the others");
  assert.equal(relationBetween(tree, "P0001", "P0001"), undefined, "the same person");
  assert.equal(relationBetween(tree, "P0001", "P9999"), undefined, "no such person");
  assert.equal(relationBetween(tree, "P0001", "P0047"), undefined, "two parents who are no couple are not partners");
});

test("the side of the family: by the first step up, none for parents, descendants, partners and full siblings", () => {
  const of = relationsFrom(tree, "P0001");
  const sides: Record<string, string | undefined> = {
    P0002: undefined, P0003: undefined, P0005: "father", P0009: "mother", P0014: "father", P0019: "father", P0017: "father",
    P0004: undefined, P0033: "father", P0007: "father", P0010: "mother", P0031: "father", P0013: "father", P0018: "father",
    P0029: undefined, P0020: undefined, P0022: undefined, P0023: undefined, P0021: undefined, P0046: undefined,
    P0024: undefined, P0026: undefined, P0027: undefined, P0028: undefined, P0030: "father", P0032: undefined,
    P0034: "mother", P0039: "father", P0040: "father",
  };
  for (const [to, side] of Object.entries(sides)) assert.equal(of(to)?.side, side, `P0001 → ${to}`);
  // a half-sister is on the side of the one parent they share, from either of them
  assert.equal(relationBetween(tree, "P0033", "P0001")?.side, "father");
  // a niece through a full brother: no side; an aunt through the father: his side
  assert.equal(relationBetween(tree, "P0007", "P0001")?.side, undefined);
  assert.equal(relationBetween(tree, "P0029", "P0001")?.side, "father");
  // a parent of unknown sex: no side
  assert.equal(relationBetween(tree, "P0045", "P0001")?.side, undefined);
  assert.equal(relationBetween(tree, "P0045", "P0002")?.side, undefined);
});

test("an ancestor reached through both parents has no side (cousins married)", () => {
  const t = treeOf(
    [["P0001", "M", "Jan", "Lhoták"], ["P0002", "F", "Anna", "Lhotáková"], ["P0003", "M", "Josef", "Lhoták"], ["P0004", "F", "Marie", "Lhotáková"],
      ["P0005", "M", "Karel", "Lhoták"], ["P0006", "F", "Věra", "Lhotová"], ["P0007", "M", "Šimon", "Lhoták"]],
    [["F0001", ["P0001", "P0002"], [["P0003", "birth"], ["P0004", "birth"]]],
      ["F0002", ["P0003"], [["P0005", "birth"]]],
      ["F0003", ["P0004"], [["P0006", "birth"]]],
      ["F0004", ["P0005", "P0006"], [["P0007", "birth"]]]],
  );
  const r = relationBetween(t, "P0007", "P0001");
  assert.equal(r?.term.cs, "praděd");
  assert.equal(r?.side, undefined);
  assert.equal(r?.generation, 4);
  assert.equal(relationBetween(t, "P0007", "P0003")?.side, "father");
  assert.equal(relationBetween(t, "P0007", "P0004")?.side, "mother");
});

test("the generation: the person 1, parents 2, …, children 0; in-laws by their blood part", () => {
  const of = relationsFrom(tree, "P0001");
  const gens: Record<string, number> = {
    P0002: 2, P0005: 3, P0014: 5, P0019: 7, P0004: 1, P0033: 1, P0007: 2, P0031: 1, P0013: 3, P0018: 5, P0029: 0,
    P0020: 0, P0023: -1, P0021: 1, P0024: 2, P0026: 1, P0027: 1, P0028: 1, P0030: 2, P0032: 2, P0039: 4, P0040: 4, P0034: 1,
  };
  for (const [to, g] of Object.entries(gens)) assert.equal(of(to)?.generation, g, `P0001 → ${to}`);
});

test("blood, affinity and the adoptive line", () => {
  const of = relationsFrom(tree, "P0001");
  assert.deepEqual([of("P0031")?.blood, of("P0031")?.affinity, of("P0031")?.adoptive], [true, false, false]);
  assert.deepEqual([of("P0034")?.blood, of("P0034")?.affinity, of("P0034")?.adoptive], [false, false, true]);
  assert.deepEqual([of("P0026")?.blood, of("P0026")?.affinity], [false, true]);
  assert.deepEqual([of("P0021")?.blood, of("P0021")?.affinity], [false, true]);
});

test("a divorce standing ends a union; a marriage dated after it does not", () => {
  const t = treeOf(
    [["P0001", "M", "Jan", "Lhoták"], ["P0002", "F", "Anna", "Lhotáková"]],
    [["F0001", ["P0001", "P0002"], [], { events: ["MARR 1900", "DIV 1905", "MARR 1910"] }]],
  );
  assert.equal(relationBetween(t, "P0001", "P0002")?.term.cs, "manželka / partnerka");
  const s = treeOf([["P0001", "M", "Jan", "Lhoták"], ["P0002", "F", "Anna", "Lhotáková"]], [["F0001", ["P0001", "P0002"], [], { union: "separated" }]]);
  assert.equal(relationBetween(s, "P0001", "P0002")?.term.en, "ex-wife / ex-partner");
});

test("the relation in words of a language, with its side; any other language English", () => {
  const r = relationBetween(tree, "P0001", "P0014")!;
  assert.equal(relationText(r, "cs"), "prapraděd, z otcovy strany");
  assert.equal(relationText(r, "en"), "great-great-grandfather, father's side");
  assert.equal(relationText(r, "de"), "Ururgroßvater, väterlicherseits");
  assert.equal(relationText(r, "pl"), "prapradziadek, ze strony ojca");
  assert.equal(relationText(r, "fr"), "great-great-grandfather, father's side");
  assert.equal(relationText(relationBetween(tree, "P0001", "P0009")!, "cs-CZ"), "babička, z matčiny strany");
  assert.equal(relationText(relationBetween(tree, "P0001", "P0002")!, "cs"), "otec");
  assert.equal(sideText("mother", "de"), "mütterlicherseits");
});

test("many persons from one quickly: two thousand, two hundred asked", () => {
  const people: (typeof PEOPLE)[number][] = [];
  const families: (typeof FAMILIES)[number][] = [];
  // a pedigree of nine generations: every couple with a son and a daughter more, the son's son married
  let n = 0;
  const id = () => `P${String(++n).padStart(4, "0")}`;
  let f = 0;
  const fid = () => `F${String(++f).padStart(4, "0")}`;
  const root = id();
  people.push([root, "F", "Eva", "Lhotáková"]);
  let gen = [root];
  for (let g = 0; g < 9; g++) {
    const next: string[] = [];
    for (const child of gen) {
      const father = id();
      const mother = id();
      const aunt = id();
      const uncle = id();
      people.push([father, "M", "Jan", "Lhoták"], [mother, "F", "Anna", "Lhotová"], [aunt, "F", "Marie", "Lhotová"], [uncle, "M", "Karel", "Lhoták"]);
      families.push([fid(), [father, mother], [[child, "birth"], [aunt, "birth"], [uncle, "birth"]]]);
      const cousin = id();
      people.push([cousin, "M", "Petr", "Lhoták"]);
      const wife = id();
      people.push([wife, "F", "Ludmila", "Lhotská"]);
      families.push([fid(), [uncle], [[cousin, "birth"]]], [fid(), [cousin, wife], []]);
      next.push(father, mother);
    }
    gen = next;
  }
  const t = treeOf(people, families);
  assert.ok(people.length > 2000, `${people.length} persons`);
  const targets = people.filter((_, i) => i % Math.floor(people.length / 200) === 0).map((p) => p[0]);
  const started = performance.now();
  const of = relationsFrom(t, root);
  let named = 0;
  for (const to of targets) if (of(to)) named++;
  const ms = performance.now() - started;
  assert.ok(named > 150, `${named} named`);
  assert.ok(ms < 1000, `${Math.round(ms)} ms for ${targets.length} persons`);
});
