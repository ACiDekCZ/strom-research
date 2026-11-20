// The names after a marriage in order, the one now last (spec 010 K4.1, K4.2): the latest marriage by date, else the
// last in order; a wife's form of the husband's surname in any script; a name of no spouse before them; the user's
// choice (Name.marriedNow) and the name shown (Name.primary) over the rule.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dateOrderKey, marriagesOf, marriedInOrder, type MarriageOf } from "../../src/core/married.ts";
import type { Family, Name, Person } from "../../src/core/model.ts";

const married = (surname: string, given = "Anna"): Name => ({ given, surname, kind: "married" });
const said = (names: Name[]) => names.map((n) => n.surname);
const m = (surname: string, index: number, wedding?: number, key = wedding ?? Infinity): MarriageOf => ({ surname, index, ...(wedding !== undefined ? { wedding } : {}), key });

test("dateOrderKey: year, month, day of the first date; BEF just before; nothing read: undefined", () => {
  assert.equal(dateOrderKey("12 MAR 1905"), 19050312);
  assert.equal(dateOrderKey("1905"), 19050000);
  assert.equal(dateOrderKey("ABT 1905"), 19050000);
  assert.equal(dateOrderKey("BEF 1905"), 19050000 - 0.5);
  assert.equal(dateOrderKey("BET 1905 AND 1907"), 19050000);
  assert.equal(dateOrderKey("bef  mar 1905"), 19050300 - 0.5);
  assert.equal(dateOrderKey("(the spring of the great flood)"), undefined);
  assert.equal(dateOrderKey(undefined), undefined);
  assert.equal(dateOrderKey("12 XYZ 1905"), undefined);
});

test("the latest wedding by date is the one now, written in any order; the older one before it", () => {
  const names = [married("Lhotecká"), married("Lhotáková")];
  const marriages = [m("Lhoták", 0, 19050000), m("Lhotecký", 1, 19200000)];
  assert.deepEqual(said(marriedInOrder(names, marriages)), ["Lhotáková", "Lhotecká"]);
  // the order of the families says nothing where the dates do
  assert.deepEqual(said(marriedInOrder(names, [m("Lhotecký", 0, 19200000), m("Lhoták", 1, 19050000)])), ["Lhotáková", "Lhotecká"]);
});

test("no dates: the last marriage in order; one with a date only: that one", () => {
  const names = [married("Lhotecká"), married("Lhotáková")];
  assert.deepEqual(said(marriedInOrder(names, [m("Lhotecký", 0), m("Lhoták", 1)])), ["Lhotecká", "Lhotáková"]);
  assert.deepEqual(said(marriedInOrder(names, [m("Lhotecký", 0, 19200000), m("Lhoták", 1)])), ["Lhotáková", "Lhotecká"]);
  // a marriage of no date is put in time by its divorce or its first child (just before it)
  assert.deepEqual(said(marriedInOrder(names, [m("Lhotecký", 0, undefined, 19300000 - 0.5), m("Lhoták", 1, undefined, 19100000 - 0.5)])), ["Lhotáková", "Lhotecká"]);
});

test("a wife's form of the husband's surname in any script, decomposed or not; the same surname; a name of no spouse before them all", () => {
  const nfd = (s: string) => s.normalize("NFD");
  assert.deepEqual(said(marriedInOrder([married("Jaworska"), married(nfd("Lhotáková"))], [m("Lhoták", 0, 19000000), m("Jaworski", 1, 19100000)])), [nfd("Lhotáková"), "Jaworska"]);
  assert.deepEqual(said(marriedInOrder([married("Иванова", "Анна"), married("Петрова", "Анна")], [m("Петров", 0, 19000000), m("Иванов", 1, 19100000)])), ["Петрова", "Иванова"]);
  assert.deepEqual(said(marriedInOrder([married("Smith"), married("Brown")], [m("Smith", 0, 19000000), m("Brown", 1, 19100000)])), ["Smith", "Brown"]);
  // a name no spouse carries goes before, written last or not; among themselves the order written
  assert.deepEqual(said(marriedInOrder([married("Lhotecká"), married("Brkoslavová"), married("Lhotáková"), married("Jaworska")], [m("Lhoták", 0, 19050000), m("Lhotecký", 1, 19200000)])), ["Brkoslavová", "Jaworska", "Lhotáková", "Lhotecká"]);
  // nobody's: the order written, the last one now
  assert.deepEqual(said(marriedInOrder([married("Brkoslavová"), married("Jaworska")], [])), ["Brkoslavová", "Jaworska"]);
});

test("the user's choice (marriedNow) and the name shown (primary) are the one now over the rule", () => {
  const names = [married("Lhotecká"), { ...married("Lhotáková"), marriedNow: true as const }];
  const marriages = [m("Lhotecký", 0, 19050000), m("Lhoták", 1, 19200000)];
  assert.deepEqual(said(marriedInOrder([{ ...married("Lhotecká"), marriedNow: true as const }, married("Lhotáková")], marriages)), ["Lhotáková", "Lhotecká"]);
  assert.deepEqual(said(marriedInOrder(names, [m("Lhoták", 0, 19050000), m("Lhotecký", 1, 19200000)])), ["Lhotecká", "Lhotáková"]);
  assert.deepEqual(said(marriedInOrder([married("Lhotáková"), { ...married("Lhotecká"), primary: true as const }], [m("Lhotecký", 0, 19050000), m("Lhoták", 1, 19200000)])), ["Lhotáková", "Lhotecká"]);
});

test("marriagesOf: a marriage of two partners — never partners or separated, never one alone; the dates read from its events and children", () => {
  const person = (id: string, surname: string, born?: string): Person =>
    ({ id, type: "person", names: [{ given: "X", surname }], sex: "M", events: born ? [{ id: `E${id}`, kind: "BIRT", date: born }] : [], notes: [], created: "", updated: "" }) as unknown as Person;
  const people = new Map([["P1", person("P1", "Pěnkavová")], ["P2", person("P2", "Lhoták")], ["P3", person("P3", "Lhotecký")], ["P4", person("P4", "Jaworski")], ["P5", person("P5", "Lhoták", "1931")]]);
  const fam = (id: string, partners: string[], extra: Partial<Family> = {}): Family => ({ id, type: "family", partners, children: [], events: [], notes: [], created: "", updated: "", ...extra }) as unknown as Family;
  const out = marriagesOf(
    "P1",
    [
      fam("F1", ["P2", "P1"], { events: [{ id: "E1", kind: "MARR", date: "1905" }] } as unknown as Partial<Family>),
      fam("F2", ["P3", "P1"], { children: [{ person: "P5", relation: "birth" }] as Family["children"] }),
      fam("F3", ["P4", "P1"], { union: "partners" }),
      fam("F4", ["P1"]),
    ],
    (id) => people.get(id),
  );
  assert.deepEqual(out, [
    { surname: "Lhoták", wedding: 19050000, key: 19050000, index: 0 },
    { surname: "Lhotecký", key: 19310000 - 0.5, index: 1 },
  ]);
});
