// A sync is no way round the origin guard (spec 066 U3, N1): a file an agent brings in with `strom sync <file> --apply`
// changes a value of the user's, or of an imported family tree not on a record, only by a proposal the user decides —
// nothing of it changed, nothing of the agent's stamped as the user's. The research's own values and what is new are
// written as before; the person's own sync (their terminal, the Strom app's bridge) writes the user's values as theirs;
// taking the sync back withdraws its proposals.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Conflict, Event, Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { CLAUDECODE: "1" } };
const PERSON = { tty: true };

const GED = [
  "0 HEAD",
  "1 SOUR MyHeritage",
  "2 NAME MyHeritage Family Tree Builder",
  "2 VERS 8.0",
  "1 CHAR UTF-8",
  "0 @I1@ INDI",
  "1 NAME Jan /Lhoták/",
  "1 SEX M",
  "1 BIRT",
  "2 DATE 12 MAR 1841",
  "2 PLAC Lhota",
  "0 @I2@ INDI",
  "1 NAME Anna /Lhotáková/",
  "1 SEX F",
  "1 BIRT",
  "2 DATE 1845",
  "2 PLAC Horní Lhota",
  "0 @F1@ FAM",
  "1 HUSB @I1@",
  "1 WIFE @I2@",
  "0 TRLR",
  "",
].join("\n");

const open = (w: World) => Tree.open(w.cwd, w.env);
const person = (w: World, id: string) => open(w).get<Person>(id)!;
const factOf = (w: World, who: string, kind: string): Event => person(w, who).events.find((e) => e.kind === kind && !e.retracted)!;
const conflicts = (w: World) => open(w).list<Conflict>("conflict");

/**
 * Lhotákovi imported from another program's family tree (P0001 Jan, P0002 Anna: the import's values), Jan's birth
 * then dated by the person at their terminal (the user's), his death added by an agent (the research's) — and the
 * file the Strom app was given.
 */
async function setUp(): Promise<{ w: World; ged: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "lhotakovi.ged");
  fs.writeFileSync(file, GED);
  await w.ok(["intake", file], AGENT);
  await w.ok(["event", "edit", factOf(w, "P0001", "BIRT").id, "--date", "13 MAR 1841", "--reason", "rodinná bible"], PERSON);
  assert.deepEqual(factOf(w, "P0001", "BIRT").origin, { by: "user" });
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1900", "--place", "Lhota"], AGENT);
  assert.equal(factOf(w, "P0001", "DEAT").origin, undefined);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  return { w, ged };
}

/** The file edited as in the app: each person's record (by its REFN) changed by `edit`. */
function edited(ged: string, out: string, edit: Record<string, (rec: string) => string>, extra = ""): string {
  const recs = fs.readFileSync(ged, "utf8").split(/(?=^0 )/m);
  const next = recs.map((r) => {
    const id = /^1 REFN (P\d+)\r?$/m.exec(r)?.[1];
    return id && edit[id] ? edit[id]!(r) : r;
  });
  const t = next.join("").replace(/^0 TRLR/m, `${extra}0 TRLR`);
  fs.writeFileSync(out, t);
  return out;
}

test("an agent's sync proposes changes of the user's and an imported tree's values; the research's own and new ones written; undone, its proposals withdrawn", opts, async () => {
  const { w, ged } = await setUp();
  try {
    const file = edited(
      ged,
      path.join(w.dir, "edited.ged"),
      {
        P0001: (r) => r.replace("2 DATE 13 MAR 1841", "2 DATE 14 MAR 1841").replace("2 DATE 1900", "2 DATE 1901").replace("1 NAME Jan /Lhoták/", "1 NAME Johann /Lhoták/"),
        P0002: (r) => r.replace("2 DATE 1845", "2 DATE 1846").replace("1 SEX F", "1 SEX M"),
      },
      ["0 @X9@ INDI", "1 NAME Marie /Lhotová/", "1 SEX F", "1 BIRT", "2 DATE 1870", "2 PLAC Lhota", ""].join("\n"),
    );
    const r = await w.ok(["sync", file, "--apply", "--json"], AGENT);
    const proposed = (r.json.proposed ?? []) as { conflict: string; line: string }[];
    const kinds = proposed.map((x) => conflicts(w).find((c) => c.id === x.conflict)?.proposal?.kind).sort();
    // the user's birth date, the import's birth date, name and sex: four proposals, nothing of them changed
    assert.deepEqual(kinds, ["import", "import", "import", "user"], JSON.stringify(r.json.proposed));
    const birt = factOf(w, "P0001", "BIRT");
    assert.equal(birt.date, "13 MAR 1841");
    assert.deepEqual(birt.origin, { by: "user" }, "still the user's");
    const anna = factOf(w, "P0002", "BIRT");
    assert.equal(anna.date, "1845");
    assert.equal(anna.origin?.by, "import");
    assert.equal(person(w, "P0001").names[0]!.given, "Jan");
    assert.ok(!person(w, "P0001").names.some((n) => n.given === "Johann"), "no name of the file's added");
    assert.equal(person(w, "P0002").sex, "F");
    // the research's own fact: written, nobody's but the research's
    const deat = factOf(w, "P0001", "DEAT");
    assert.equal(deat.date, "1901");
    assert.equal(deat.origin, undefined);
    // the new person: added, nothing of it the user's
    const marie = open(w).list<Person>("person").find((p) => p.names.some((n) => n.given === "Marie" && n.surname === "Lhotová"))!;
    assert.ok(marie, "the new person added");
    assert.equal(marie.sexOrigin, undefined);
    assert.ok(marie.names.every((n) => n.origin === undefined));
    assert.ok(marie.events.every((e) => e.origin === undefined));
    // undone by the person: its proposals withdrawn
    await w.ok(["sync", "undo", r.json.input as string], PERSON);
    for (const x of proposed) assert.notEqual(conflicts(w).find((c) => c.id === x.conflict)?.state, "open", x.conflict);
    assert.equal(factOf(w, "P0001", "DEAT").date, "1900");
  } finally {
    w.cleanup();
  }
});

test("an agent's sync says what became a proposal (the user decides)", opts, async () => {
  const { w, ged } = await setUp();
  try {
    const file = edited(ged, path.join(w.dir, "edited.ged"), { P0001: (r) => r.replace("2 DATE 13 MAR 1841", "2 DATE 14 MAR 1841") });
    const r = await w.ok(["sync", file, "--apply"], AGENT);
    assert.match(r.out, /1 change\(s\) of the user's or an imported family tree's values proposed, not written — the user decides/);
    assert.match(r.out, /is the user's value: proposed \(X\d+\), not changed — the user decides/);
    assert.equal(factOf(w, "P0001", "BIRT").date, "13 MAR 1841");
  } finally {
    w.cleanup();
  }
});

test("the person's own sync writes the user's values (theirs)", opts, async () => {
  const { w, ged } = await setUp();
  try {
    const file = edited(ged, path.join(w.dir, "edited.ged"), {
      P0001: (r) => r.replace("2 DATE 13 MAR 1841", "2 DATE 14 MAR 1841"),
      P0002: (r) => r.replace("2 DATE 1845", "2 DATE 1846"),
    });
    // (a person's terminal without --json: a strom answering in JSON is taken for a program's)
    const r = await w.ok(["sync", file, "--apply"], PERSON);
    assert.doesNotMatch(r.out, /proposed/);
    assert.equal(conflicts(w).length, 0);
    assert.equal(factOf(w, "P0001", "BIRT").date, "14 MAR 1841");
    assert.deepEqual(factOf(w, "P0001", "BIRT").origin, { by: "user" });
    assert.equal(factOf(w, "P0002", "BIRT").date, "1846");
    assert.deepEqual(factOf(w, "P0002", "BIRT").origin, { by: "user" });
  } finally {
    w.cleanup();
  }
});
