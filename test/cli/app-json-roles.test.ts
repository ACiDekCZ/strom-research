// The Strom app's JSON taken in and synced (spec 085 K2.2, the check of 13 Nov: N3, N6): a godparent's and a wedding
// witness's own event (the app's types "godparent", "weddingWitness" with roleAt), who else was at an event (godparents
// linked and by name, an officiant, a midwife the user called "porodní bába"), the witnesses of a wedding, an event
// shared among people with a long note — none of it left out, nothing cut short, and given back to the app (GEDCOM for
// the app) as it came: app → JSON → research → GEDCOM → research again the same.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { planSync, readStromJson } from "../../src/core/sync.ts";
import { participantRole, relaForApp } from "../../src/core/roles.ts";
import type { Event, Family, Participant, Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const open = (w: World) => Tree.open(w.cwd, w.env);

/** A note longer than any note strom writes itself: emoji, a combining mark (NFD), Cyrillic. */
const LONG = `Dlouhá poznámka – ${"Žluťoučký kůň úpěl ďábelské ódy 🐄, ".repeat(36)}Ло́хотка é konec.`;

/** The app's JSON (data version 20): Lhotákovi — a census of three, a baptism with its people, a godparent's own event. */
function appJson(): unknown {
  return {
    version: 20,
    persons: {
      a_prokop: {
        id: "a_prokop",
        firstName: "Prokop",
        lastName: "Lhoták",
        gender: "male",
        events: [{ id: "e1", type: "census", date: "1921-02-15", place: "Lhota pod Dubinou", address: "č. 14", age: "42 let", shareId: "LHCEN1", note: LONG }],
      },
      a_terezie: {
        id: "a_terezie",
        firstName: "Terezie",
        lastName: "Lhotáková",
        gender: "female",
        events: [{ id: "e2", type: "census", date: "1921-02-15", place: "Lhota pod Dubinou", address: "č. 14", age: "38 let", shareId: "LHCEN1", shareRole: "hospodyně", note: LONG }],
      },
      a_marie: {
        id: "a_marie",
        firstName: "Marie",
        lastName: "Lhotová",
        gender: "female",
        events: [
          { id: "e3", type: "census", date: "1921-02-15", place: "Lhota pod Dubinou", shareId: "LHCEN1", shareRole: "služka", note: LONG },
          {
            id: "e4",
            type: "baptism",
            date: "1910-03-14",
            place: "Lhota pod Dubinou",
            participants: [
              { id: "pp1", role: "godparent", personId: "a_ida" },
              { id: "pp2", role: "godparent", name: "Václav Lhoťan", note: "soused, kovář", linkRejected: ["a_prokop"] },
              { id: "pp3", role: "officiant", name: "P. Jan Lhotský, farář" },
              { id: "pp4", role: "other", name: "Anna Lhotecká", note: "porodní bába" },
            ],
          },
        ],
      },
      a_ida: {
        id: "a_ida",
        firstName: "Ida",
        lastName: "Lhotáková",
        gender: "female",
        events: [
          { id: "e5", type: "godparent", date: "1910-03-14", place: "Lhota pod Dubinou", roleAt: { role: "godparent", eventType: "baptism", personId: "a_marie", eventId: "e4" } },
          { id: "e6", type: "weddingWitness", date: "1905", place: "Lhota pod Dubinou", roleAt: { role: "witness", eventType: "marriage", partnershipId: "u1", eventId: "marriage" } },
        ],
      },
    },
    partnerships: {
      u1: {
        id: "u1",
        person1Id: "a_prokop",
        person2Id: "a_terezie",
        status: "married",
        startDate: "1905",
        startPlace: "Lhota pod Dubinou",
        participants: [
          { id: "pw1", role: "witness", name: "Josef Lhoťák" },
          { id: "pw2", role: "witness", personId: "a_ida", note: "sestra nevěsty" },
        ],
      },
    },
  };
}

const person = (t: Tree, given: string): Person => t.list<Person>("person").find((p) => p.names[0]!.given === given)!;
const parts = (t: Tree, ev: Event | undefined): string[] =>
  (ev?.participants ?? []).map((p: Participant) => [p.role, p.person ? t.get<Person>(p.person)?.names[0]?.given : p.name, p.note ?? ""].join("|"));

/** What a research holds of the app's tree, the same whatever way it came (the JSON, the GEDCOM given back). */
function holds(t: Tree): unknown {
  const marie = person(t, "Marie");
  const ida = person(t, "Ida");
  const couple = t.list<Family>("family").find((f) => f.partners.includes(person(t, "Prokop").id))!;
  const census = (given: string) => person(t, given).events.find((e) => e.kind === "CENS")!;
  return {
    census: ["Prokop", "Terezie", "Marie"].map((g) => [census(g).share?.id, census(g).share?.role ?? null, census(g).note]),
    baptism: parts(t, marie.events.find((e) => e.kind === "BAPM")),
    wedding: parts(t, couple.events.find((e) => e.kind === "MARR")),
    own: ida.events
      .filter((e) => e.kind === "EVEN")
      .map((e) => [e.label, e.date, e.roleAt?.role, e.roleAt?.at === marie.id ? "Marie" : e.roleAt?.at === couple.id ? "couple" : e.roleAt?.at, e.roleAt?.kind]),
  };
}

const EXPECTED = {
  census: [
    ["LHCEN1", null, LONG.normalize("NFC")],
    ["LHCEN1", "hospodyně", LONG.normalize("NFC")],
    ["LHCEN1", "služka", LONG.normalize("NFC")],
  ],
  baptism: ["godparent|Ida|", "godparent|Václav Lhoťan|soused, kovář", "officiant|P. Jan Lhotský, farář|", "midwife|Anna Lhotecká|porodní bába"],
  wedding: ["witness|Josef Lhoťák|", "witness|Ida|sestra nevěsty"],
  own: [
    ["Kmotrovství", "14 MAR 1910", "godparent", "Marie", "BAPM"],
    ["Svědek při sňatku", "1905", "witness", "couple", "MARR"],
  ],
};

test("intake of the app's JSON: a godparent's and a wedding witness's own event, every participant, a long note whole — given back to the app and read again the same", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  const w2 = new World();
  try {
    const file = path.join(w.dir, "lhotakovi.json");
    fs.writeFileSync(file, JSON.stringify(appJson()));
    await w.ok(["intake", file]);
    const t = open(w);
    assert.deepEqual(holds(t), EXPECTED);
    assert.match((await w.ok(["check"])).out, /^ok/u);

    // the GEDCOM for the app: the own events with whose (_STROM_ROLE, _STROM_AT, TYPE), the shared copies, the people
    // at the baptism — the midwife as the app keeps her ("Present" and the user's words), the note whole
    const ged = exportGedcom(t, { for: "strom" }).text;
    assert.match(ged, /^1 EVEN\r?\n2 TYPE Kmotrovství\r?\n(?:2 .*\r?\n)*?2 _STROM_ROLE godparent\r?\n3 _STROM_AT @[^@]+@\r?\n4 TYPE BAPM$/mu);
    assert.match(ged, /^1 EVEN\r?\n2 TYPE Svědek při sňatku\r?\n(?:2 .*\r?\n)*?2 _STROM_ROLE witness\r?\n3 _STROM_AT @F[^@]*@\r?\n4 TYPE MARR$/mu);
    assert.equal(ged.match(/^2 _STROM_SHARE LHCEN1$/gmu)?.length, 3);
    assert.match(ged, /^2 _WITN Anna Lhotecká\r?\n3 RELA Present\r?\n3 NOTE porodní bába$/mu);
    assert.match(ged, /^2 _WITN Václav Lhoťan\r?\n3 RELA Godparent\r?\n3 NOTE soused, kovář$/mu);
    assert.match(ged, /^2 _WITN P\. Jan Lhotský, farář\r?\n3 RELA Officiant$/mu);
    assert.match(ged, /^2 _WITN Josef Lhoťák\r?\n3 RELA Witness$/mu);
    assert.equal(ged.includes("Midwife"), false, "the user's words, not the research's");

    // …and the GEDCOM taken in again (as the app's coming back): the same events, people, roles and marks, the note
    // whole (a research's GEDCOM taken in as leads says where each came from in front of it, the order of the people
    // at an event the file's)
    await w2.withTree("Lhotákovi");
    await w2.ok(["lang", "cs"]);
    const back = path.join(w2.dir, "back.ged");
    fs.writeFileSync(back, ged.replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM"));
    await w2.ok(["intake", back]);
    const again = holds(open(w2)) as typeof EXPECTED;
    assert.deepEqual(
      again.census.map(([id, role, text]) => [id, role, (text as string).endsWith(LONG.normalize("NFC"))]),
      EXPECTED.census.map(([id, role]) => [id, role, true]),
    );
    assert.deepEqual([...again.baptism].sort(), [...EXPECTED.baptism].sort());
    assert.deepEqual([...again.wedding].sort(), [...EXPECTED.wedding].sort());
    assert.deepEqual(again.own, EXPECTED.own);
  } finally {
    w.cleanup();
    w2.cleanup();
  }
});

test("sync of the app's JSON: a godparent's own event is a fact of its own with whose, the people at an event with their own words", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  try {
    await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P0001
    await w.ok(["event", "add", "P0001", "BAPM", "--date", "14 MAR 1910", "--place", "Lhota pod Dubinou"]);
    const data = appJson() as { persons: Record<string, { refn?: string }> };
    data.persons.a_marie!.refn = "P0001";
    const snap = readStromJson(data, "cs");
    const ida = [...snap.persons.values()].find((p) => p.names[0]!.startsWith("Ida"))!;
    assert.deepEqual(
      ida.facts.map((f) => [f.kind, f.label, f.date, f.roleAt]),
      [
        ["EVEN", "Kmotrovství", "14 MAR 1910", { role: "godparent", at: "P0001", kind: "BAPM" }],
        ["EVEN", "Svědek při sňatku", "1905", { role: "witness", at: `fam:${[...snap.persons.keys()].find((k) => snap.persons.get(k)!.names[0]!.startsWith("Prokop"))}+${[...snap.persons.keys()].find((k) => snap.persons.get(k)!.names[0]!.startsWith("Terezie"))}`, kind: "MARR" }],
      ],
    );
    const baptism = snap.persons.get("P0001")!.facts.find((f) => f.kind === "BAPM")!;
    assert.deepEqual(
      baptism.parts!.map((p) => [p.role, p.name ?? (p.person === ida.key ? "Ida" : p.person), p.note ?? ""]),
      [
        ["godparent", "Ida", ""],
        ["godparent", "Václav Lhoťan", "soused, kovář"],
        ["officiant", "P. Jan Lhotský, farář", ""],
        ["midwife", "Anna Lhotecká", "porodní bába"],
      ],
    );
    // planned: Ida comes with her own events of a role at another's, never left out
    const plan = planSync(open(w), snap, "conflict", { force: true });
    const fresh = plan.changes.filter((c) => c.kind === "fact.new" && c.fact?.kind === "EVEN").map((c) => [c.fact!.label, c.fact!.roleAt?.role]);
    assert.deepEqual(fresh, [["Kmotrovství", "godparent"], ["Svědek při sňatku", "witness"]]);
    // a language the research has none of (an English one): the app's English word
    const en = readStromJson(appJson(), "en");
    assert.deepEqual([...en.persons.values()].find((p) => p.names[0]!.startsWith("Ida"))!.facts.map((f) => f.label), ["Godparent", "Wedding witness"]);
  } finally {
    w.cleanup();
  }
});

test("a participant's role and note: the role a note names, the user's words kept; only the research's own RELA word in front is not theirs", () => {
  // the app's "other" with the role in the user's words: the role, the words kept (N6: never "Midwife" instead)
  assert.deepEqual(participantRole("Present", "porodní bába", "other"), { role: "midwife", note: "porodní bába" });
  assert.deepEqual(participantRole("other", "porodní bába", "other"), { role: "midwife", note: "porodní bába" });
  assert.deepEqual(participantRole(undefined, "Hebamme aus Lhota", "witness"), { role: "midwife", note: "Hebamme aus Lhota" });
  // the app puts the research's word of a role it has none of in front of the note: only the rest is the user's
  assert.deepEqual(participantRole("Present", "Midwife — z Lhoty", "other"), { role: "midwife", note: "z Lhoty" });
  assert.deepEqual(participantRole("Present", "Midwife", "other"), { role: "midwife" });
  assert.deepEqual(participantRole("Present", "Porodní bába — z Lhoty", "other"), { role: "midwife", note: "Porodní bába — z Lhoty" });
  // a RELA naming the role: the note as it is
  assert.deepEqual(participantRole("Godparent", "soused, kovář", "other"), { role: "godparent", note: "soused, kovář" });
  assert.deepEqual(participantRole("Present", "соседка", "other"), { role: "other", note: "соседка" });
  assert.deepEqual(participantRole(undefined, undefined, "witness"), { role: "witness" });
  // written for the app: "Present" only where the note alone gives the role back as the user wrote it
  assert.equal(relaForApp("midwife", "porodní bába"), "Present");
  assert.equal(relaForApp("midwife", "z Lhoty"), "Midwife");
  assert.equal(relaForApp("midwife", undefined), "Midwife");
  assert.equal(relaForApp("informant", "oznamovatel, syn"), "Present");
  assert.equal(relaForApp("godparent", "kmotr"), "Godparent");
});

test("intake of a GEDCOM: an event's long note whole (no limit of a note strom writes), a midwife's note as written", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const long = `${"Ло́хотка 🐄 é ".repeat(120)}konec`;
    const ged = [
      "0 HEAD",
      "1 SOUR OTHER",
      "1 GEDC",
      "2 VERS 5.5.1",
      "1 CHAR UTF-8",
      "0 @I1@ INDI",
      "1 NAME Marie /Lhotová/",
      "1 BAPM",
      "2 DATE 14 MAR 1910",
      "2 _WITN Anna Lhotecká",
      "3 RELA Present",
      "3 NOTE porodní bába",
      `2 NOTE ${long.slice(0, 200)}`,
      ...long.slice(200).match(/[\s\S]{1,200}/gu)!.map((c) => `3 CONC ${c}`),
      "0 TRLR",
      "",
    ].join("\n");
    const f = path.join(w.dir, "other.ged");
    fs.writeFileSync(f, ged);
    await w.ok(["intake", f]);
    const ev = person(open(w), "Marie").events.find((e) => e.kind === "BAPM")!;
    assert.equal(ev.note, long.normalize("NFC"));
    assert.deepEqual(ev.participants, [{ role: "midwife", name: "Anna Lhotecká", note: "porodní bába" }]);
    assert.match((await w.ok(["check"])).out, /^ok/u);
  } finally {
    w.cleanup();
  }
});
