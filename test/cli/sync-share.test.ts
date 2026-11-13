// strom sync and the Strom app's shared events (spec 085, U4): its mark of one event shared among people
// (2 _STROM_SHARE, the JSON's shareId + shareRole) and a godparent's own event of a role at another's (2 _STROM_ROLE,
// 3 _STROM_AT, 4 TYPE; the JSON's roleAt) come with a send — a mark the research's fact lacks is added, a new fact
// brings its own; a mark changed or taken off in the app is the user's only of an app that decides who shares an event
// (APP_DECIDES_SHARES, open here through planSync's decidesShares), never of an older one, never without what the app
// was given. A census of a person in the app's JSON is a CENS. GEDCOM 7's ROLE under an ASSO in another program's file
// reads as the intake reads it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { applySync, planSync, readGedcom, readStromJson, undoSync, type Snapshot } from "../../src/core/sync.ts";
import { APP_DATA_EVENT_SHARES, APP_DECIDES_SHARES, APP_DECIDES_SHARES_BETA, appDataDecidesShares, appDecidesShares } from "../../src/core/stromapp.ts";
import { Settings } from "../../src/core/config.ts";
import type { Event, Family, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
/** As the Strom app's bridge writes a send: the person's. */
const FROM_APP = { env: { STROM_FOR_APP: "1" } };

const open = (w: World) => Tree.open(w.cwd, w.env);
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const fact = (w: World, id: string, kind: string): Event => open(w).get<Person>(id)!.events.find((e) => e.kind === kind && !e.retracted)!;
const shown = (plan: { changes: { kind: string; action: string; person?: string; shared?: string }[] }) => plan.changes.map((c) => `${c.kind} ${c.action} ${c.person ?? ""} ${c.shared ?? ""}`.trim());

/** Lhotákovi: three people at the census of 1921 (Prokop and Terezie a couple, Marie their maid), none of it marked. */
async function research(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Prokop /Lhoták/", "--sex", "M"]); // P0001
  await w.ok(["person", "add", "Terezie /Lhotáková/", "--sex", "F"]); // P0002
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P0003
  for (const p of ["P0001", "P0002", "P0003"]) await w.ok(["event", "add", p, "CENS", "--date", "15 FEB 1921", "--place", "Lhota pod Dubinou"]);
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002"]); // F0001
  return w;
}

/** What the research gives the Strom app (with the state it is of, unless `head` is false), as the app sends it back. */
function appFile(w: World, head = true): string {
  return exportGedcom(open(w), { for: "strom", ...(head ? { head: gitHead(w) } : {}) }).text.replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM");
}

const records = (t: string) => t.split(/(?=^0 )/mu);
const isOf = (r: string, refn: string) => /^0 @[^@]+@ INDI/u.test(r) && new RegExp(`^1 REFN ${refn}\\r?$`, "mu").test(r);
/** The file's xref of the research's person. */
const xrefOf = (t: string, refn: string) => /^0 (@[^@]+@)/u.exec(records(t).find((r) => isOf(r, refn))!)![1]!;
/** The file's xref of the family of the two partners. */
const famXref = (t: string, a: string, b: string) => /^0 (@[^@]+@)/u.exec(records(t).find((r) => /^0 @[^@]+@ FAM/u.test(r) && r.includes(`1 HUSB ${xrefOf(t, a)}`) && r.includes(`1 WIFE ${xrefOf(t, b)}`))!)![1]!;
/** Lines put under the person's first fact of the tag, after its date and place (where the research writes its marks). */
function under(t: string, refn: string, tag: string, lines: string[]): string {
  return records(t)
    .map((r) => (isOf(r, refn) ? r.replace(new RegExp(`^1 ${tag}\\r?\\n(?:2 (?:DATE|PLAC) .*\\r?\\n)*`, "mu"), (m) => m + lines.map((l) => `${l}\n`).join("")) : r))
    .join("");
}
/** The person's record without the lines the pattern finds. */
function without(t: string, refn: string, re: RegExp): string {
  return records(t)
    .map((r) => (isOf(r, refn) ? r.replace(re, "") : r))
    .join("");
}
/** The lines of the person's first fact of the tag, as a file has them. */
function block(t: string, refn: string, tag: string): string {
  const r = records(t).find((x) => isOf(x, refn))!;
  return new RegExp(`^1 ${tag}\\r?\\n(?:[2-9] .*\\r?\\n)*`, "mu").exec(r)![0];
}

/** The census shared in the app by the three of them, Marie's role in it written decomposed (NFD). */
function shared(t: string): string {
  for (const id of ["P0001", "P0002"]) t = under(t, id, "CENS", ["2 _STROM_SHARE SH7K2QX"]);
  return under(t, "P0003", "CENS", ["2 _STROM_SHARE SH7K2QX", `3 _ROLE ${"služka".normalize("NFD")}`]);
}

/** A sync written as the person's, straight (the gate open as the test needs it): its source made first. */
function apply(w: World, incoming: Snapshot, decidesShares: boolean, person = true): { applied: unknown[]; changes: number; skipped: unknown[] } {
  const tree = open(w);
  tree.personWrites = person;
  return tree.withTreeLock(() => {
    const plan = planSync(tree, incoming, "conflict", { decidesShares });
    const source = tree.list<Source>("source").find((s) => s.kind === "family-tree") ?? (tree.get<Source>("S0001") as Source);
    const r = applySync(tree, plan, incoming, source, undefined, { decidePerson: false });
    return { applied: r.applied, changes: r.changes, skipped: r.skipped };
  });
}

test("the gates of the app deciding who shares an event: open from the app's 3.28.0 (another copy from 3.28.0-beta.7), its JSON from data version 20", () => {
  assert.equal(APP_DECIDES_SHARES, "3.28.0");
  assert.equal(APP_DECIDES_SHARES_BETA, "3.28.0-beta.7");
  assert.equal(APP_DATA_EVENT_SHARES, 20);
  const production = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  for (const v of ["3.28.0", "3.29.0", "9.0.0"]) assert.equal(appDecidesShares(production, v), true, v);
  for (const v of ["3.27.0", "3.28.0-beta.7", "3.27.9", undefined]) assert.equal(appDecidesShares(production, v), false, String(v));
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  for (const v of ["3.28.0-beta.7", "3.28.0", "3.29.0-beta.1"]) assert.equal(appDecidesShares(beta, v), true, v);
  for (const v of ["3.28.0-beta.6", "3.27.0", undefined]) assert.equal(appDecidesShares(beta, v), false, String(v));
  for (const v of [20, 25, 99]) assert.equal(appDataDecidesShares(v), true, String(v));
  for (const v of [18, 19, undefined]) assert.equal(appDataDecidesShares(v), false, String(v));
});

test("sync GED: the app's mark is added to each copy the research has, given back line for line, undone with the sync", opts, async () => {
  const w = await research();
  try {
    const t = shared(appFile(w));
    const plan = planSync(open(w), readGedcom(t), "conflict");
    assert.deepEqual(shown(plan), ["fact.share add P0001 share", "fact.share add P0002 share", "fact.share add P0003 share"]);
    const file = path.join(w.dir, "app.ged");
    fs.writeFileSync(file, t);
    const said = await w.ok(["sync", file]);
    assert.match(said.out, /sdílená s dalšími v aplikaci Strom/u, "said in the research's language");
    const r = (await w.ok(["sync", file, "--apply", "--json"], FROM_APP)).json;
    assert.equal(r.changes.length, 3);
    assert.deepEqual(fact(w, "P0001", "CENS").share, { id: "SH7K2QX" });
    assert.deepEqual(fact(w, "P0003", "CENS").share, { id: "SH7K2QX", role: "služka" }, "stored NFC");
    assert.ok(fact(w, "P0003", "CENS").share!.role!.normalize("NFC") === fact(w, "P0003", "CENS").share!.role);
    // given back in the Strom GEDCOM under the same fact, as the app wrote it (NFC)
    const back = appFile(w);
    for (const id of ["P0001", "P0002", "P0003"]) assert.equal(block(back, id, "CENS"), block(t, id, "CENS").normalize("NFC"), id);
    assert.doesNotMatch(exportGedcom(open(w), { for: "standard" }).text, /_STROM_SHARE/u, "never the standard file");
    // an unedited tree round-trips with no change: the marks are no part of what a fact is
    assert.deepEqual(shown(planSync(open(w), readGedcom(back), "conflict")), []);
    assert.deepEqual(shown(planSync(open(w), readGedcom(back), "conflict", { decidesShares: true })), []);
    // the history says it, the undo takes it back
    const ops = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? ops(path.join(dir, d.name)) : [fs.readFileSync(path.join(dir, d.name), "utf8")]));
    assert.equal(ops(path.join(w.cwd, "data", "ops")).join("").match(/"event\.edit"[^\n]*shared event: SH7K2QX/gu)?.length, 3, "each logged");
    await w.ok(["sync", "undo", r.input]);
    for (const id of ["P0001", "P0002", "P0003"]) assert.equal(fact(w, id, "CENS").share, undefined, id);
  } finally {
    w.cleanup();
  }
});

test("sync GED: a new person's copy of the shared event and a godparent's own event come with their marks", opts, async () => {
  const w = await research();
  try {
    let t = shared(appFile(w));
    const marie = xrefOf(t, "P0003");
    const couple = famXref(t, "P0001", "P0002");
    // Josef, new in the app: at the census as a lodger (a role in Cyrillic), godfather of Marie, witness at the couple's wedding
    t = t.replace(
      /^0 @[^@]+@ SUBM/mu,
      (m) =>
        [
          "0 @X1@ INDI",
          "1 NAME Josef /Lhoták/",
          "1 SEX M",
          "1 CENS",
          "2 DATE 15 FEB 1921",
          "2 PLAC Lhota pod Dubinou",
          "2 _STROM_SHARE SH7K2QX",
          "3 _ROLE подна́ймач",
          "1 EVEN",
          "2 TYPE Kmotrovství",
          "2 DATE 1901",
          "2 _STROM_ROLE godparent",
          `3 _STROM_AT ${marie}`,
          "4 TYPE BAPM",
          "1 EVEN",
          "2 TYPE Svědectví",
          "2 DATE 1900",
          "2 _STROM_ROLE witness",
          `3 _STROM_AT ${couple}`,
          "4 TYPE MARR",
          "",
        ].join("\n") + m,
    );
    const plan = planSync(open(w), readGedcom(t), "conflict");
    const news = plan.changes.filter((c) => c.kind === "fact.new");
    assert.deepEqual(
      news.map((c) => [c.fact!.kind, c.fact!.share ?? null, c.fact!.roleAt ?? null]),
      [
        ["CENS", { id: "SH7K2QX", role: "подна́ймач".normalize("NFC") }, null],
        ["EVEN", null, { role: "godparent", at: "P0003", kind: "BAPM" }],
        ["EVEN", null, { role: "witness", at: "fam:P0001+P0002", kind: "MARR" }],
      ],
    );
    const file = path.join(w.dir, "app.ged");
    fs.writeFileSync(file, t);
    const r = (await w.ok(["sync", file, "--apply", "--json"], FROM_APP)).json;
    const josef = open(w).list<Person>("person").find((p) => p.names[0]!.given === "Josef")!;
    const own = josef.events.filter((e) => e.kind === "EVEN" && !e.retracted);
    assert.deepEqual(josef.events.find((e) => e.kind === "CENS")!.share, { id: "SH7K2QX", role: "подна́ймач".normalize("NFC") });
    assert.deepEqual(own.map((e) => e.roleAt), [
      { role: "godparent", at: "P0003", kind: "BAPM" },
      { role: "witness", at: "F0001", kind: "MARR" },
    ]);
    // the marks of the others added too, and all given back as the app wrote them
    assert.deepEqual(fact(w, "P0002", "CENS").share, { id: "SH7K2QX" });
    const back = exportGedcom(open(w), { for: "strom" }).text;
    const j = records(back).find((x) => x.includes("1 NAME Josef /Lhoták/"))!;
    assert.match(j, new RegExp(`\\n1 EVEN\\n2 TYPE Kmotrovství\\n2 DATE 1901\\n(?:2 .*\\n)*?2 _STROM_ROLE godparent\\n3 _STROM_AT ${xrefOf(back, "P0003")}\\n4 TYPE BAPM\\n`, "u"));
    assert.match(j, new RegExp(`\\n2 _STROM_ROLE witness\\n3 _STROM_AT ${famXref(back, "P0001", "P0002")}\\n4 TYPE MARR\\n`, "u"));
    assert.match(j, /\n1 CENS\n2 DATE 15 FEB 1921\n2 PLAC Lhota pod Dubinou\n(?:2 .*\n)*?2 _STROM_SHARE SH7K2QX\n3 _ROLE подна́ймач\n/u);
    // nothing new of the same file again (the research's as the app has it now)
    assert.deepEqual(shown(planSync(open(w), readGedcom(appFile(w)), "conflict")), []);
    // the undo takes Josef and his facts back
    await w.ok(["sync", "undo", r.input]);
    assert.ok(open(w).get<Person>(josef.id)!.retracted);
  } finally {
    w.cleanup();
  }
});

test("sync GED: a person separated from the shared event in the app — the mark taken off only of an app that decides, against what it was given", opts, async () => {
  const w = await research();
  try {
    const file = path.join(w.dir, "app.ged");
    fs.writeFileSync(file, shared(appFile(w)));
    await w.ok(["sync", file, "--apply"], FROM_APP);
    // the app's next send: Marie's copy on its own now, Terezie's of another shared event
    const t = appFile(w);
    const sent = under(without(without(t, "P0003", /^2 _STROM_SHARE .*\n(?:3 .*\n)*/mu), "P0002", /^2 _STROM_SHARE .*\n/mu), "P0002", "CENS", ["2 _STROM_SHARE SH9QQ"]);
    assert.match(block(sent, "P0002", "CENS"), /_STROM_SHARE SH9QQ/u);
    assert.doesNotMatch(block(sent, "P0003", "CENS"), /_STROM_SHARE/u);
    // an older app (the gate closed): the research's marks as they are
    assert.deepEqual(shown(planSync(open(w), readGedcom(sent), "conflict")), []);
    // an app that decides: the user's
    assert.deepEqual(shown(planSync(open(w), readGedcom(sent), "conflict", { decidesShares: true })), ["fact.share user P0002 share", "fact.share user P0003 share"]);
    // without what the app was given (no _STROM_HEAD): nothing taken off or changed
    assert.deepEqual(shown(planSync(open(w), readGedcom(sent.replace(/^1 _STROM_HEAD .*\n/mu, "")), "conflict", { decidesShares: true })), []);
    // an agent's sync: kept, said — never the person's word
    const agent = apply(w, readGedcom(sent), true, false);
    assert.equal(agent.changes, 0);
    assert.deepEqual(fact(w, "P0003", "CENS").share, { id: "SH7K2QX", role: "služka" });
    // the person's: written, logged, undone
    const r = apply(w, readGedcom(sent), true);
    assert.equal(r.changes, 2);
    assert.equal(fact(w, "P0003", "CENS").share, undefined);
    assert.deepEqual(fact(w, "P0002", "CENS").share, { id: "SH9QQ" });
    assert.deepEqual(fact(w, "P0001", "CENS").share, { id: "SH7K2QX" }, "the others stay together");
    const tree = open(w);
    tree.withTreeLock(() => undoSync(tree, { id: "I9999", sync: { applied: r.applied } } as never));
    assert.deepEqual(fact(w, "P0003", "CENS").share, { id: "SH7K2QX", role: "služka" });
    assert.deepEqual(fact(w, "P0002", "CENS").share, { id: "SH7K2QX" });
  } finally {
    w.cleanup();
  }
});

/** The app's JSON of Lhotákovi (its data version 25): the census shared by three, a godparent's own event, Josef new. */
function appJson(more: Record<string, unknown> = {}): unknown {
  const census = (extra: Record<string, unknown> = {}) => ({ id: `ev_${Math.random().toString(36).slice(2, 8)}`, type: "census", date: "1921-02-15", place: "Lhota pod Dubinou", ...extra });
  return {
    version: 25,
    persons: {
      p1: { id: "p1", firstName: "Prokop", lastName: "Lhoták", gender: "male", refn: "P0001", events: [census({ shareId: "SH7K2QX" })] },
      p2: { id: "p2", firstName: "Terezie", lastName: "Lhotáková", gender: "female", refn: "P0002", events: [census({ shareId: "SH7K2QX" })] },
      p3: { id: "p3", firstName: "Marie", lastName: "Lhotová", gender: "female", refn: "P0003", events: [census({ shareId: "SH7K2QX", shareRole: "služka".normalize("NFD") })] },
      p4: {
        id: "p4",
        firstName: "Josef",
        lastName: "Lhoták",
        gender: "male",
        events: [
          census({ shareId: "SH7K2QX", shareRole: "подна́ймач" }),
          { id: "ev_k", type: "custom", customLabel: "Kmotrovství", date: "1901", roleAt: { role: "godparent", personId: "p3", eventType: "baptism" } },
          { id: "ev_s", type: "custom", customLabel: "Svědectví", date: "1900", roleAt: { role: "witness", partnershipId: "u1", eventType: "marriage" } },
          { id: "ev_x", type: "census", date: "1910", shareId: "ne platné!" },
        ],
      },
      ...more,
    },
    partnerships: { u1: { id: "u1", person1Id: "p1", person2Id: "p2", status: "married" } },
  };
}

test("sync JSON: a census of a person is a CENS, shareId, shareRole and roleAt read and added as the GEDCOM's", opts, async () => {
  const w = await research();
  try {
    const snap = readStromJson(appJson());
    assert.equal(snap.dataVersion, 25);
    const facts = (k: string) => snap.persons.get(k)!.facts;
    // the ticket: the app's census of a person (its JSON) is a CENS, never left out
    assert.deepEqual(facts("P0001").map((f) => [f.kind, f.date, f.place]), [["CENS", "15 FEB 1921", "Lhota pod Dubinou"]]);
    assert.deepEqual(facts("P0003")[0]!.share, { id: "SH7K2QX", role: "služka" });
    const josef = [...snap.persons.values()].find((p) => p.names[0]!.startsWith("Josef"))!;
    assert.deepEqual(
      josef.facts.map((f) => [f.kind, f.share ?? null, f.roleAt ?? null]),
      [
        ["CENS", { id: "SH7K2QX", role: "подна́ймач".normalize("NFC") }, null],
        ["EVEN", null, { role: "godparent", at: "P0003", kind: "BAPM" }],
        ["EVEN", null, { role: "witness", at: "fam:P0001+P0002", kind: "MARR" }],
        ["CENS", null, null],
      ],
    );
    assert.ok(snap.problems.some((p) => p.includes("ne platné!")), "an ID that is none: said, the fact taken without it");
    // planned as the GEDCOM's: the marks added to the research's copies, the new ones with theirs
    const plan = planSync(open(w), snap, "conflict");
    assert.deepEqual(
      plan.changes.filter((c) => c.kind === "fact.share").map((c) => `${c.person} ${c.action}`),
      ["P0001 add", "P0002 add", "P0003 add"],
    );
    assert.deepEqual(
      plan.changes.filter((c) => c.kind === "fact.new").map((c) => [c.fact!.kind, c.fact!.date, c.fact!.share?.id ?? null, c.fact!.roleAt?.at ?? null]),
      [
        ["CENS", "15 FEB 1921", "SH7K2QX", null],
        ["EVEN", "1901", null, "P0003"],
        ["EVEN", "1900", null, "fam:P0001+P0002"],
        ["CENS", "1910", null, null],
      ],
    );
    // the data version decides the gate (closed): a mark the app took off stays
    const apart = appJson({ p3: { id: "p3", firstName: "Marie", lastName: "Lhotová", gender: "female", refn: "P0003", events: [{ id: "ev_m", type: "census", date: "1921-02-15", place: "Lhota pod Dubinou" }] } });
    const file = path.join(w.dir, "app.json");
    fs.writeFileSync(file, JSON.stringify(appJson()));
    await w.ok(["sync", file, "--apply"], FROM_APP);
    assert.deepEqual(fact(w, "P0003", "CENS").share, { id: "SH7K2QX", role: "služka" });
    assert.deepEqual(shown(planSync(open(w), readStromJson(apart), "conflict")).filter((c) => c.startsWith("fact.share")), []);
  } finally {
    w.cleanup();
  }
});

test("intake of the app's JSON: a person's census and other events with the marks of a shared event and a role at another's", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const file = path.join(w.dir, "lhotakovi.json");
    fs.writeFileSync(file, JSON.stringify(appJson()));
    const r = (await w.ok(["intake", file, "--json"])).json;
    assert.ok(r, "taken");
    const people = open(w).list<Person>("person");
    const by = (given: string) => people.find((p) => p.names[0]!.given === given)!;
    const cens = (p: Person) => p.events.filter((e) => e.kind === "CENS");
    for (const g of ["Prokop", "Terezie", "Marie"]) assert.deepEqual(cens(by(g)).map((e) => [e.date, e.place, e.share?.id]), [["15 FEB 1921", "Lhota pod Dubinou", "SH7K2QX"]], g);
    assert.equal(cens(by("Marie"))[0]!.share!.role, "služka");
    const josef = by("Josef");
    const couple = open(w).list<Family>("family").find((f) => f.partners.includes(by("Prokop").id))!;
    assert.deepEqual(
      josef.events.filter((e) => e.kind === "EVEN").map((e) => [e.label, e.roleAt]),
      [
        ["Kmotrovství", { role: "godparent", at: by("Marie").id, kind: "BAPM" }],
        ["Svědectví", { role: "witness", at: couple.id, kind: "MARR" }],
      ],
    );
    assert.deepEqual(cens(josef).map((e) => [e.date, e.share ?? null]), [["15 FEB 1921", { id: "SH7K2QX", role: "подна́ймач".normalize("NFC") }], ["1910", null]]);
    assert.match((await w.ok(["check"])).out, /^ok/u);
  } finally {
    w.cleanup();
  }
});

test("sync from another program's GEDCOM 7: an ASSO's ROLE (and its PHRASE) before its RELA, as the intake reads it", () => {
  const snap = readGedcom(
    [
      "0 HEAD",
      "1 SOUR OTHER_PROGRAM",
      "1 GEDC",
      "2 VERS 7.0",
      "0 @I1@ INDI",
      "1 NAME Václav /Lhoták/",
      "1 BAPM",
      "2 DATE 3 MAR 1885",
      "2 PLAC Lhota",
      "2 ASSO @I2@",
      "3 ROLE GODP",
      "3 RELA witness",
      "2 ASSO @I3@",
      "3 ROLE OTHER",
      "4 PHRASE Hebamme",
      "2 ASSO @I4@",
      "3 RELA witness",
      "0 @I2@ INDI",
      "1 NAME Ondřej /Lhoták/",
      "0 @I3@ INDI",
      "1 NAME Ludmila /Lhotáková/",
      "0 @I4@ INDI",
      "1 NAME Jan /Лготак/",
      "0 TRLR",
      "",
    ].join("\n"),
  );
  const bapm = snap.persons.get("x:I1")!.facts.find((f) => f.kind === "BAPM")!;
  assert.deepEqual(
    bapm.parts!.map((p) => [p.person, p.role]),
    [
      ["x:I2", "godparent"],
      ["x:I3", "midwife"],
      ["x:I4", "witness"],
    ],
  );
});
