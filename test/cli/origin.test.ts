// Where a value came from (spec 066 U3, K2.1–K2.3): a family tree of another program imported marks its facts, names
// and sexes as the import's (a lead), the Strom app's file and the person's own writes as the user's. An agent changes an
// import's value only on a record it cites (the family tree's value kept to put back), never where the person decides
// (hypotheses.decide person), and the user's value never — it proposes (an open conflict the user decides). Putting a
// family tree's value back is the person's alone. A research an older strom wrote is marked once by rules (origins-1):
// only marks, every value as it was; strom fixes undo origins takes them off.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { now, Tree } from "../../src/core/tree.ts";
import { ORIGINS_SETTLED, ORIGINS_TREE_SETTLED, settleOrigins } from "../../src/core/originfix.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import type { Conflict, Event, Family, Input, Person, Place, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { CLAUDECODE: "1" } };
const PERSON = { tty: true };

const GED = [
  "0 HEAD",
  "1 SOUR MyHeritage",
  "2 NAME MyHeritage Family Tree Builder",
  "2 VERS 8.0",
  "1 DATE 3 MAR 2020",
  "1 CHAR UTF-8",
  "0 @I1@ INDI",
  "1 NAME Jan /Lhoták/",
  "1 SEX M",
  "1 BIRT",
  "2 DATE 12 MAR 1841",
  "2 PLAC Lhota",
  "1 OCCU rolník",
  "0 @I2@ INDI",
  "1 NAME Anna /Lhotáková/",
  "1 SEX F",
  "1 BIRT",
  "2 DATE 1845",
  "2 PLAC Horní Lhota",
  "0 @F1@ FAM",
  "1 HUSB @I1@",
  "1 WIFE @I2@",
  "1 MARR",
  "2 DATE 1865",
  "2 PLAC Lhota",
  "0 TRLR",
  "",
].join("\n");

/** The Strom app's own file: its values are the user's. */
const APP_GED = ["0 HEAD", "1 SOUR STROM", "2 VERS 3.25.0", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Marie /Lhotáková/", "1 SEX F", "1 BIRT", "2 DATE 1870", "2 PLAC Lhota", "0 TRLR", ""].join("\n");

const open = (w: World) => Tree.open(w.cwd, w.env);
const person = (w: World, id: string) => open(w).get<Person>(id)!;
const eventOf = (w: World, id: string): Event => {
  for (const o of [...open(w).list<Person>("person"), ...open(w).list<Family>("family")]) {
    const e = o.events.find((x) => x.id === id);
    if (e) return e;
  }
  throw new Error(`no ${id}`);
};
const factOf = (w: World, who: string, kind: string) => person(w, who).events.find((e) => e.kind === kind)!;
const conflict = (w: World, id: string) => open(w).get<Conflict>(id)!;
const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());

/** Lhotákovi with the family tree of another program imported (S0001: P0001 Jan, P0002 Anna) and a register (S0002). */
async function imported(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "lhotakovi.ged");
  fs.writeFileSync(file, GED);
  await w.ok(["intake", file], AGENT);
  await w.ok(["source", "add", "Křest Jana Lhotáka 1841", "--kind", "baptism"], AGENT); // S0002
  return w;
}

test("an import of another program's family tree marks its values as the import's; the source gets its key", opts, async () => {
  const w = await imported();
  try {
    const s = open(w).get<Source>("S0001")!;
    assert.equal(s.imported?.key, "R1");
    assert.equal(s.imported?.program, "MyHeritage Family Tree Builder");
    assert.equal(s.imported?.version, "8.0");
    assert.equal(s.imported?.date, "3 MAR 2020");
    assert.equal(s.imported?.file, "lhotakovi.ged");
    const jan = person(w, "P0001");
    assert.deepEqual(factOf(w, "P0001", "BIRT").origin, { by: "import", source: "S0001" });
    assert.deepEqual(jan.names[0]!.origin, { by: "import", source: "S0001" });
    assert.deepEqual(jan.sexOrigin, { by: "import", source: "S0001" });
    const marr = open(w).list<Family>("family")[0]!.events[0]!;
    assert.deepEqual(marr.origin, { by: "import", source: "S0001" });
    // a second import: the next key
    const two = path.join(w.dir, "druhy.ged");
    fs.writeFileSync(two, GED.replace("Jan /Lhoták/", "Josef /Lhoták/").replace("Anna /Lhotáková/", "Marie /Lhotáková/"));
    await w.ok(["intake", two], AGENT);
    const keys = open(w).list<Source>("source").map((x) => x.imported?.key).filter(Boolean);
    assert.deepEqual(keys, ["R1", "R2"]);
    // the Strom app's file: the user's family tree (theirs to guard, nothing the person changed: tree), no import's key
    const app = path.join(w.dir, "strom.ged");
    fs.writeFileSync(app, APP_GED);
    await w.ok(["intake", app], AGENT);
    const marie = open(w).list<Person>("person").find((p) => p.names.some((n) => n.given === "Marie" && p.refs?.some((r) => r.system.startsWith("gedcom:") && r.id === "@I1@")) && p.events.some((e) => e.date === "1870"))!;
    assert.deepEqual(marie.events[0]!.origin, { by: "user", tree: true });
    assert.deepEqual(marie.names[0]!.origin, { by: "user", tree: true });
    assert.deepEqual(marie.sexOrigin, { by: "user", tree: true });
    assert.equal(open(w).get<Source>(marie.events[0]!.citations[0]!.source)!.imported, undefined);
  } finally {
    w.cleanup();
  }
});

test("an agent changes an imported value only on a record it cites: else proposed; the family tree's value kept, a second change keeps the first", opts, async () => {
  const w = await imported();
  try {
    const birt = factOf(w, "P0001", "BIRT").id;
    // no record: a proposal, nothing changed
    const p = await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--reason", "jiný den", "--json"], AGENT);
    assert.match(p.json.proposed, /^X\d+$/);
    assert.equal(eventOf(w, birt).date, "12 MAR 1841");
    const x = conflict(w, p.json.proposed);
    assert.equal(x.state, "open");
    assert.equal(x.proposal?.kind, "import");
    const text = await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--reason", "jiný den"], AGENT);
    assert.match(text.out, /imported family tree.*proposed \(X\d+, proposed already\).*--cite/s);
    // the batch goes through the same command: no way round
    await w.ok(["batch", `event edit ${birt} --date "15 MAR 1841" --reason "jiný den"`], AGENT);
    assert.equal(eventOf(w, birt).date, "12 MAR 1841");
    // on the register: changed, the family tree's value kept, its citation gives way to the record's
    await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--cite", "S0002", "--locator", "fol. 3", "--reason", "matrika: 14. března"], AGENT);
    let e = eventOf(w, birt);
    assert.equal(e.date, "14 MAR 1841");
    assert.equal(e.origin, undefined, "the research's now");
    assert.equal(e.was?.date, "12 MAR 1841");
    assert.equal(e.was?.source, "S0001");
    assert.deepEqual(e.was?.parts, ["date"]);
    assert.deepEqual(e.was?.because, ["S0002"]);
    assert.ok(!e.citations.some((c) => c.source === "S0001"), "the import's citation gone");
    assert.ok(e.citations.some((c) => c.source === "S0002" && c.locator === "fol. 3"));
    // the research's own fact now: changed freely, the first was kept
    await w.ok(["event", "edit", birt, "--date", "15 MAR 1841", "--reason", "přečteno znovu"], AGENT);
    e = eventOf(w, birt);
    assert.equal(e.date, "15 MAR 1841");
    assert.equal(e.was?.date, "12 MAR 1841", "only the import's value, never a step between");
    // a fact already citing a record: allowed without a new --cite; a second part changed keeps the first was
    const anna = factOf(w, "P0002", "BIRT").id;
    await w.ok(["cite", anna, "S0002", "--locator", "fol. 9"], AGENT);
    await w.ok(["event", "edit", anna, "--date", "1846", "--reason", "matrika"], AGENT);
    await w.ok(["event", "edit", anna, "--place", "Lhota", "--reason", "matrika"], AGENT);
    const a = eventOf(w, anna);
    assert.equal(a.date, "1846");
    assert.equal(a.place, "Lhota");
    // the fact is the research's since the first change: the family tree's date kept, nothing more taken over
    assert.equal(a.was?.date, "1845");
    assert.deepEqual(a.was?.parts, ["date"]);
  } finally {
    w.cleanup();
  }
});

test("where the person decides, every change of an imported value is a proposal — the citation goes into it", opts, async () => {
  const w = await imported();
  try {
    await w.ok(["config", "set", "hypotheses.decide", "person"]);
    const birt = factOf(w, "P0001", "BIRT").id;
    const r = await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--cite", "S0002", "--locator", "fol. 3", "--reason", "matrika", "--json"], AGENT);
    assert.match(r.json.proposed, /^X\d+$/);
    assert.equal(eventOf(w, birt).date, "12 MAR 1841");
    const x = conflict(w, r.json.proposed);
    assert.equal(x.proposal?.cites?.[0]?.source, "S0002");
    assert.equal(x.claims[1]?.source, "S0002");
  } finally {
    w.cleanup();
  }
});

test("the user's own values: the person writes them freely (theirs), an agent only proposes — edit, retract, name, sex, name shown, place", opts, async () => {
  const w = await imported();
  try {
    // the person at their terminal changes an imported fact: theirs, the family tree's value kept
    const birt = factOf(w, "P0001", "BIRT").id;
    await w.ok(["event", "edit", birt, "--date", "13 MAR 1841", "--reason", "rodinná bible"], PERSON);
    let e = eventOf(w, birt);
    assert.equal(e.date, "13 MAR 1841");
    assert.deepEqual(e.origin, { by: "user" });
    assert.equal(e.was?.date, "12 MAR 1841");
    // the Strom app's bridge writes as the person too
    const anna = factOf(w, "P0002", "BIRT").id;
    await w.ok(["event", "edit", anna, "--date", "1846", "--reason", "z aplikace"], { env: { STROM_FOR_APP: "1" } });
    assert.deepEqual(eventOf(w, anna).origin, { by: "user" });
    // a fact the person added: theirs
    // (a person's terminal without --json: a strom answering in JSON is taken for a program's, as with transcripts)
    await w.ok(["event", "add", "P0001", "DEAT", "--date", "1900", "--place", "Lhota"], PERSON);
    const added = factOf(w, "P0001", "DEAT").id;
    assert.deepEqual(eventOf(w, added).origin, { by: "user" });
    // an agent: proposed, never changed — even with a record cited
    const r = await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--cite", "S0002", "--reason", "matrika", "--json"], AGENT);
    assert.equal(conflict(w, r.json.proposed).proposal?.kind, "user");
    assert.equal(eventOf(w, birt).date, "13 MAR 1841");
    const t = await w.ok(["event", "edit", added, "--date", "1901", "--reason", "matrika"], AGENT);
    assert.match(t.out, /the user's value: proposed \(X\d+\), not changed — the user decides/);
    assert.equal(eventOf(w, added).date, "1900");
    // retracting the user's fact: proposed
    const q = await w.ok(["event", "retract", added, "--reason", "jmenovec", "--json"], AGENT);
    assert.equal(conflict(w, q.json.proposed).proposal?.retract?.event, added);
    assert.equal(eventOf(w, added).retracted, undefined);
    // the user's name and sex
    await w.ok(["person", "edit", "P0001", "--name", "Jan /Lhotak/", "--reason", "pravopis"], PERSON);
    assert.deepEqual(person(w, "P0001").names[0]!.origin, { by: "user" });
    assert.equal(person(w, "P0001").names[0]!.was?.surname, "Lhoták");
    const n = await w.ok(["person", "edit", "P0001", "--name", "Jan /Lhoták/", "--reason", "matrika", "--json"], AGENT);
    assert.match(n.json.proposed, /^X\d+$/);
    assert.equal(person(w, "P0001").names[0]!.surname, "Lhotak");
    // the name shown: an agent proposes it on a family tree's or the user's names
    await w.ok(["name", "add", "P0002", "Anna /Lhotákova/", "--cite", "S0002"], AGENT);
    const m = await w.ok(["name", "primary", "P0002", "Anna /Lhotákova/", "--json"], AGENT);
    assert.match(m.json.proposed, /^X\d+$/);
    assert.ok(!person(w, "P0002").names.some((x) => x.primary), "nothing marked");
    // a place the user gave: never rewritten by an agent — the person asked instead
    await w.ok(["place", "identify", "Horní Lhota", "--lat", "49.61", "--lon", "15.23", "--why", "fara Lhotov"], AGENT); // L0001
    const pr = await w.ok(["place", "rewrite", "Lhota", "--to", "L0001", "--reason", "jedna obec", "--json"], AGENT);
    assert.equal(pr.json.changed, 0);
    assert.equal(pr.json.whose, "user");
    assert.equal(pr.json.asked, true);
    assert.equal(open(w).get<Place>("L0001")!.locating?.question?.kind, "form");
    assert.equal(eventOf(w, added).place, "Lhota");
    assert.equal(factOf(w, "P0001", "BIRT").place, "Lhota");
  } finally {
    w.cleanup();
  }
});

test("a proposal taken by the person is written as theirs; putting the family tree's value back is the person's alone", opts, async () => {
  const w = await imported();
  try {
    const birt = factOf(w, "P0001", "BIRT").id;
    const r = await w.ok(["event", "edit", birt, "--date", "14 MAR 1841", "--cite", "S0002", "--reason", "matrika", "--json"], { env: { CLAUDECODE: "1" } });
    void r;
    // allowed on the record: changed; now a proposal of the agent on the import's place without a record cited elsewhere
    const anna = factOf(w, "P0002", "BIRT").id;
    const p = await w.ok(["event", "edit", anna, "--date", "1846", "--reason", "věk při sňatku", "--json"], AGENT);
    // an agent never decides it
    const refused = await w.run(["conflict", "resolve", p.json.proposed, "--take", "research", "--reasoning", "ano"], AGENT);
    assert.notEqual(refused.code, 0);
    assert.equal(eventOf(w, anna).date, "1845");
    // the person takes it: written as theirs, the family tree's value kept to put back
    await w.ok(["conflict", "resolve", p.json.proposed, "--take", "research", "--reasoning", "souhlasím"], PERSON);
    let a = eventOf(w, anna);
    assert.equal(a.date, "1846");
    assert.deepEqual(a.origin, { by: "user" });
    assert.equal(a.was?.date, "1845");
    assert.equal(conflict(w, p.json.proposed).state, "resolved");
    // putting back: never an agent
    assert.equal((await w.run(["event", "revert", anna], AGENT)).code, 4);
    assert.notEqual((await w.run(["event", "revert", anna])).code, 0, "nor a strom with no terminal");
    assert.equal(eventOf(w, anna).date, "1846");
    // the person: the family tree's value again, with its citation; theirs from then on
    await w.ok(["event", "revert", anna], PERSON);
    a = eventOf(w, anna);
    assert.equal(a.date, "1845");
    assert.equal(a.was, undefined);
    assert.deepEqual(a.origin, { by: "user" });
    assert.ok(a.citations.some((c) => c.source === "S0001"));
    await w.ok(["event", "revert", birt, "--part", "date"], PERSON);
    const b = eventOf(w, birt);
    assert.equal(b.date, "12 MAR 1841");
    assert.ok(b.citations.some((c) => c.source === "S0001"), "the import's citation back");
    // nothing more to put back
    const again = await w.run(["event", "revert", birt], PERSON);
    assert.notEqual(again.code, 0);
    assert.match(again.err + again.out, /nothing to put back/);
    // a name the person corrected: back as the family tree gave it
    await w.ok(["person", "edit", "P0001", "--name", "Jan /Lhotak/", "--reason", "pravopis"], PERSON);
    await w.ok(["person", "revert", "P0001", "--name", "1"], PERSON);
    assert.equal(person(w, "P0001").names[0]!.surname, "Lhoták");
  } finally {
    w.cleanup();
  }
});

// ── the migration of an older research ───────────────────────────────────────────────────────────────────────────

/** Everything of the records but the marks the fix adds (origin, sexOrigin, imported). */
function values(w: World): string {
  const tree = open(w);
  const strip = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(strip)
      : x && typeof x === "object"
        ? Object.fromEntries(Object.entries(x).filter(([k]) => !["origin", "sexOrigin", "imported"].includes(k)).map(([k, v]) => [k, strip(v)]))
        : x;
  return JSON.stringify(strip([...tree.list("person"), ...tree.list("family"), ...tree.list("source")]));
}

/** The research as an older strom left it: no marks, no marker. */
function older(w: World): void {
  const tree = open(w);
  tree.withTreeLock(() => {
    const clean = <T extends object>(r: T): T => {
      const c = structuredClone(r) as Record<string, unknown>;
      delete c.origin;
      delete c.sexOrigin;
      delete c.imported;
      if (Array.isArray(c.events)) c.events = (c.events as Record<string, unknown>[]).map(({ origin: _o, ...e }) => e);
      if (Array.isArray(c.names)) c.names = (c.names as Record<string, unknown>[]).map(({ origin: _o, ...n }) => n);
      return c as T;
    };
    const all = [...tree.list<Person>("person"), ...tree.list<Family>("family"), ...tree.list<Source>("source")];
    tree.putMany(all.map(clean), [], { op: "tree.settle", targets: all.map((r) => r.id), summary: "as an older strom left it" }, (c) => {
      c.settled = (c.settled ?? []).filter((x) => x !== ORIGINS_SETTLED && x !== ORIGINS_TREE_SETTLED);
    });
    tree.commit("As an older strom left it");
  });
}

/** A send of the Strom app as an older sync took it in: its input, its source, a fact of the user's citing it. */
function synced(w: World): string {
  const tree = open(w);
  let id = "";
  tree.withTreeLock(() => {
    const at = now();
    const input = tree.allocate("I");
    tree.put({ id: input, type: "input", name: "strom.ged", kind: "tree", state: "processed", sync: { edits: "conflict", applied: [] }, notes: [], created: at, updated: at } as unknown as Input, { op: "input.add", targets: [input], summary: `+${input} sync` });
    const s = tree.allocate("S");
    tree.put({ id: s, type: "source", kind: "family-tree", title: "Úpravy v aplikaci Strom", input, information: "secondary", form: "authored", notes: [], created: at, updated: at } as unknown as Source, { op: "source.add", targets: [s, input], summary: `+${s}` });
    const p = tree.get<Person>("P0002")!;
    id = tree.allocate("E");
    tree.put({ ...p, events: [...p.events, { id, kind: "DEAT", date: "1920", place: "Lhota", status: "lead", citations: [{ source: s }] }], updated: at }, { op: "event.add", targets: [id, "P0002"], summary: `${id} DEAT` });
    tree.commit("A send of the app");
  });
  return id;
}

test("origins-1: an older research marked once — only marks, every value as it was; undone by strom fixes undo origins", opts, async () => {
  const w = await imported();
  try {
    // the Strom app's file taken in, a send of the app, a fact of the research's own
    const app = path.join(w.dir, "strom.ged");
    fs.writeFileSync(app, APP_GED);
    await w.ok(["intake", app], AGENT);
    const deat = synced(w);
    const own = (await w.ok(["event", "add", "P0001", "BURI", "--date", "1900", "--place", "Lhota", "--cite", "S0002", "--json"], AGENT)).json.event.id as string;
    // a fact citing the import and the app (the user's wins), one citing the import and a record (the import's)
    const marr = open(w).list<Family>("family")[0]!.events[0]!.id;
    const appSource = open(w).list<Source>("source").find((s) => s.title.includes("strom.ged"))!.id;
    await w.ok(["cite", marr, appSource], AGENT);
    const birt = factOf(w, "P0001", "BIRT").id;
    await w.ok(["cite", birt, "S0002", "--locator", "fol. 3"], AGENT);
    older(w);
    assert.equal(eventOf(w, birt).origin, undefined);
    assert.equal(open(w).get<Source>("S0001")!.imported, undefined);
    const before = values(w);
    const n = commits(w);
    const done = settleOrigins(open(w));
    assert.ok(done && done.changed > 0);
    assert.equal(commits(w), n + 1, "one commit");
    assert.equal(values(w), before, "every value as it was: only marks");
    // the import's
    assert.deepEqual(eventOf(w, birt).origin, { by: "import", source: "S0001" }, "an import's fact citing a record too stays the import's");
    assert.deepEqual(factOf(w, "P0001", "OCCU").origin, { by: "import", source: "S0001" });
    assert.deepEqual(person(w, "P0001").names[0]!.origin, { by: "import", source: "S0001" });
    assert.deepEqual(person(w, "P0001").sexOrigin, { by: "import", source: "S0001" });
    assert.equal(open(w).get<Source>("S0001")!.imported?.key, "R1");
    assert.equal(open(w).get<Source>("S0001")!.imported?.program, "MyHeritage Family Tree Builder");
    // the user's: a send of the app, the user's wins over the import (the fact was there before the app's file came)
    assert.deepEqual(eventOf(w, marr).origin, { by: "user" });
    assert.deepEqual(eventOf(w, deat).origin, { by: "user" });
    // the app's file, unchanged since it was taken in: the user's family tree's
    const marie = open(w).list<Person>("person").find((p) => p.names[0]!.given === "Marie")!;
    assert.deepEqual(marie.events[0]!.origin, { by: "user", tree: true });
    assert.deepEqual(marie.names[0]!.origin, { by: "user", tree: true });
    assert.deepEqual(marie.sexOrigin, { by: "user", tree: true });
    // the research's own: no mark
    assert.equal(eventOf(w, own).origin, undefined);
    // once
    assert.equal(settleOrigins(open(w)), undefined);
    assert.equal(commits(w), n + 1);
    // an agent's change of the marked import's value: now under the guard
    const p = await w.ok(["event", "edit", factOf(w, "P0001", "OCCU").id, "--value", "chalupník", "--reason", "jinak", "--json"], AGENT);
    assert.match(p.json.proposed, /^X\d+$/);
    // undo: the marks off, nothing else
    assert.equal((await w.run(["fixes", "undo", "origins"], AGENT)).code, 4);
    await w.ok(["fixes", "undo", "origins", "--lang", "en"], PERSON);
    assert.equal(eventOf(w, birt).origin, undefined);
    assert.equal(person(w, "P0001").sexOrigin, undefined);
    assert.equal(open(w).get<Source>("S0001")!.imported, undefined);
    assert.equal(values(w), before);
    // an import after the fix: marked as it comes
    const two = path.join(w.dir, "druhy.ged");
    fs.writeFileSync(two, GED.replace("Jan /Lhoták/", "Josef /Lhoták/"));
    await w.ok(["intake", two], AGENT);
    const josef = open(w).list<Person>("person").find((p) => p.names[0]!.given === "Josef")!;
    assert.equal(josef.events[0]!.origin?.by, "import");
  } finally {
    w.cleanup();
  }
});

test("origins-1: a file no more readable is never taken for an import's — the user's family tree's (unchanged since)", opts, async () => {
  const w = await imported();
  try {
    older(w);
    const input = open(w).get<Input>(open(w).get<Source>("S0001")!.input!)!;
    fs.rmSync(path.join(w.cwd, input.file!));
    settleOrigins(open(w));
    assert.deepEqual(factOf(w, "P0001", "BIRT").origin, { by: "user", tree: true });
    assert.deepEqual(person(w, "P0001").names[0]!.origin, { by: "user", tree: true });
    assert.deepEqual(person(w, "P0001").sexOrigin, { by: "user", tree: true });
    assert.equal(open(w).get<Source>("S0001")!.imported, undefined);
  } finally {
    w.cleanup();
  }
});

test("origins-1, then a send of the Strom app: no origin flips — the import's stays the import's, the user's the user's; what the send adds the user's", opts, async () => {
  const w = await imported();
  try {
    const app = path.join(w.dir, "strom.ged");
    fs.writeFileSync(app, APP_GED);
    await w.ok(["intake", app], AGENT);
    older(w);
    settleOrigins(open(w));
    const origins = () => {
      const tree = open(w);
      return JSON.stringify([...tree.list<Person>("person"), ...tree.list<Family>("family")].map((r) => [r.id, r.events.map((e) => [e.id, e.origin]), "names" in r ? r.names.map((n) => n.origin) : [], "sexOrigin" in r ? r.sexOrigin : undefined]));
    };
    const before = origins();
    assert.match(before, /"by":"import"/u);
    assert.match(before, /"by":"user"/u);
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    // the app (of a version without marks, and one with them) sends back what it was given and a person added
    for (const origins_ of [false, true]) {
      const t = exportGedcom(open(w), { for: "strom", head, origins: origins_ }).text;
      const sent = t
        .replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM")
        .replace(/^(\d) _STROM_ORIGIN import (.*)$/gmu, "$1 _STROM_IMPORT $2")
        .replace("0 TRLR", `0 @I900@ INDI\n1 NAME ${origins_ ? "Jiří" : "Josef"} /Lhoták/\n1 SEX M\n1 BIRT\n2 DATE 1868\n2 PLAC Lhota\n0 TRLR`);
      const file = path.join(w.dir, `send-${origins_}.ged`);
      fs.writeFileSync(file, sent);
      await w.ok(["sync", file, "--apply"], { env: { STROM_FOR_APP: "1" } }); // as the app's bridge writes it: the person's
    }
    const after = JSON.parse(origins()) as [string, [string, unknown][], unknown[], unknown][];
    for (const [id, events, names, sex] of JSON.parse(before) as typeof after) {
      const now_ = after.find((r) => r[0] === id)!;
      assert.deepEqual([now_[1].filter(([e]) => events.some(([x]) => x === e)), now_[2].slice(0, names.length), now_[3]], [events, names, sex], id);
    }
    for (const given of ["Josef", "Jiří"]) {
      const p = open(w).list<Person>("person").find((x) => x.names[0]!.given === given)!;
      assert.deepEqual([p.names[0]!.origin, p.sexOrigin, p.events[0]!.origin], [{ by: "user" }, { by: "user" }, { by: "user" }], given);
    }
  } finally {
    w.cleanup();
  }
});
