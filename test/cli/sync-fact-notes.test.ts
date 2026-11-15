// strom sync: the note of a fact and the note of someone a fact names, as the user wrote them in the Strom app,
// come back into the research — a note added where none was, the research's corrected with the earlier one kept;
// strom's own words of a note (a fact's status, the research's detail lines) are none of the user's; a note taken away
// takes nothing away; an event the app shares among people is one note there, never an edit per copy; an agent's sync
// changes no note of the user's; undone back. The app's JSON as its GEDCOM.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { applySync, planSync, readGedcom, readStromJson, type Snapshot, type SyncInput } from "../../src/core/sync.ts";
import { create, update } from "../../src/core/records.ts";
import { APP_DATA_PART_NOTES, APP_SENDS_PART_NOTES, appDataPartNotes, appSendsPartNotes } from "../../src/core/stromapp.ts";
import type { Event, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const PERSON = { tty: true };
const AGENT = { env: { CLAUDECODE: "1" } };
/** As the Strom app's bridge writes a send: the person's. */
const FROM_APP = { env: { STROM_FOR_APP: "1" } };

const open = (w: World) => Tree.open(w.cwd, w.env);
const fact = (w: World, who: string, kind: string): Event => open(w).get<Person>(who)!.events.find((e) => e.kind === kind && !e.retracted)!;
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const noteKinds = (changes: { kind: string; action?: string }[]) => changes.filter((c) => c.kind === "fact.note" || c.kind === "fact.part.note");

/** What the research gives the Strom app (with the state it is of), as the app sends it back. */
const appFile = (w: World) => exportGedcom(open(w), { for: "strom", head: gitHead(w) }).text.replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM");

/**
 * Lhotákovi: Václav's baptism with the research's note and a godmother with hers, Ludmila's birth with no note and a
 * midwife — everything at the person's terminal (the user's).
 */
async function setUp(as: { tty?: boolean } = PERSON): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"], as); // P0001
  await w.ok(["event", "add", "P0001", "CHR", "--date", "3 MAR 1871", "--place", "Lhota", "--note", "Kmotr z Lhoty.", "--with", "godparent:Marie Lhotáková (selka z Lhoty)"], as);
  await w.ok(["person", "add", "Ludmila /Lhotáková/", "--sex", "F"], as); // P0002
  await w.ok(["event", "add", "P0002", "BIRT", "--date", "1874", "--place", "Lhota", "--with", "midwife:Anna Lhotová"], as);
  return w;
}

/** A sync written straight (the gate of participants' notes open as the test needs it), with its input and the day's source as `strom sync` makes them, committed. */
function apply(w: World, incoming: Snapshot, gates: { partNotes?: boolean }) {
  const tree = open(w);
  tree.personWrites = true;
  return tree.withTreeLock(() => {
    const plan = planSync(tree, incoming, "conflict", gates);
    const made = create<SyncInput>(tree, "input", { name: "app.ged", sha: "0", size: 1, mime: "text/plain", from: "app.ged", kind: "tree", state: "processed" } as never, (i) => `+${i} input tree "app.ged" (sync)`);
    const source = create<Source>(tree, "source", { kind: "family-tree", title: "Strom", input: made.id, information: "secondary", form: "authored" } as never, (s) => `+${s} source "app.ged" (sync)`);
    const r = applySync(tree, plan, incoming, source, undefined, { decidePerson: false, input: made.id });
    update<SyncInput>(tree, made.id, "input", (i) => ({ ...i, source: source.id, sync: { ...(incoming.head ? { head: incoming.head } : {}), edits: "conflict", applied: r.applied } }), { op: "input.sync", summary: `${made.id} synced` });
    tree.commit(`sync ${made.id}`);
    return { plan, input: made.id, source: source.id, ...r };
  });
}

function send(w: World, name: string, text: string): string {
  const file = path.join(w.dir, name);
  fs.writeFileSync(file, text);
  return file;
}

test("an unedited tree from the app changes no note of a fact nor of someone it names", opts, async () => {
  const w = await setUp();
  try {
    const r = await w.ok(["sync", send(w, "same.ged", appFile(w)), "--json"]);
    assert.deepEqual(noteKinds(r.json.changes), [], JSON.stringify(r.json.changes));
    // the app's own shape of the status line and the note: one line apart, still nobody's edit
    const t = appFile(w).replace("2 NOTE Vodítko — nedoloženo záznamem.\n3 CONT Kmotr z Lhoty.", "2 NOTE Vodítko — nedoloženo záznamem.\n3 CONT \n3 CONT Kmotr z Lhoty.");
    const again = await w.ok(["sync", send(w, "blank.ged", t), "--json"]);
    assert.deepEqual(noteKinds(again.json.changes), [], JSON.stringify(again.json.changes));
    // the copy an older strom gave the app, its status line in English: nobody's edit either
    const older = appFile(w).replaceAll("Vodítko — nedoloženo záznamem.", "Lead — not proven by a record.");
    assert.ok(older.includes("Lead — not proven"));
    const english = await w.ok(["sync", send(w, "older.ged", older), "--json"]);
    assert.deepEqual(noteKinds(english.json.changes), [], JSON.stringify(english.json.changes));
  } finally {
    w.cleanup();
  }
});

test("the user's note of a fact comes back: corrected (the earlier kept), added where none was; undone back", opts, async () => {
  const w = await setUp();
  try {
    const t = appFile(w)
      // the research's note corrected in the app — typed decomposed (NFD)
      .replace("3 CONT Kmotr z Lhoty.", `3 CONT ${"Kmotr byl z Horní Lhoty.".normalize("NFD")}`)
      // a note where the research has none: in another script too
      .replace(/(2 _WITN Anna Lhotová\r?\n3 RELA Midwife\r?\n2 NOTE Vodítko — nedoloženo záznamem\.\r?\n)/u, "$13 CONT Narozena v noci — Записано в книге.\n");
    const file = send(w, "edited.ged", t);
    const plan = await w.ok(["sync", file], PERSON);
    assert.match(plan.out, /Václav Lhoták \[P0001\]: křest .*— poznámka „Kmotr z Lhoty\.“ → „Kmotr byl z Horní Lhoty\.“ → poznámka se opraví \(verze výzkumu zůstane v historii\)/u);
    assert.match(plan.out, /Ludmila Lhotáková \[P0002\]: narození .*— poznámka „—“ → „Narozena v noci — Записано в книге\.“ → poznámka se doplní k údaji/u);
    const before = { chr: fact(w, "P0001", "CHR"), birt: fact(w, "P0002", "BIRT") };
    const r = await w.ok(["sync", file, "--apply", "--json"], FROM_APP);
    const chr = fact(w, "P0001", "CHR");
    assert.equal(chr.note, "Kmotr byl z Horní Lhoty.");
    assert.ok(chr.note!.normalize("NFC") === chr.note, "stored in NFC");
    assert.deepEqual(chr.noteEdits?.map((x) => x.text), ["Kmotr z Lhoty."], "the earlier note kept in its history");
    assert.equal(fact(w, "P0002", "BIRT").note, "Narozena v noci — Записано в книге.", "nothing of strom's status line taken");
    assert.equal(chr.date, "3 MAR 1871", "nothing else of the fact changed");
    // the next send of the same tree: nothing more
    const next = await w.ok(["sync", send(w, "next.ged", appFile(w)), "--json"]);
    assert.deepEqual(noteKinds(next.json.changes), [], JSON.stringify(next.json.changes));
    // undone: the notes as they were
    await w.ok(["sync", "undo", r.json.input as string], PERSON);
    const back = fact(w, "P0001", "CHR");
    assert.equal(back.note, before.chr.note);
    assert.equal(back.noteEdits, undefined);
    assert.deepEqual(back.participants, before.chr.participants);
    assert.equal(fact(w, "P0002", "BIRT").note, undefined);
  } finally {
    w.cleanup();
  }
});

test("a godmother's note comes back only of an app that gives it whole (APP_SENDS_PART_NOTES): corrected, undone back; cut short by an older one: nothing", opts, async () => {
  const w = await setUp();
  try {
    assert.equal(APP_SENDS_PART_NOTES, undefined, "not set until the release says the app's version");
    assert.equal(APP_DATA_PART_NOTES, undefined);
    assert.equal(appSendsPartNotes("3.29.0", "3.29.0"), true);
    assert.equal(appSendsPartNotes("3.28.0", "3.29.0"), false, "the 3.28.0 sends a longer note cut short");
    assert.equal(appSendsPartNotes(undefined, "3.29.0"), false, "no version said: no");
    assert.equal(appDataPartNotes(30, 30), true);
    assert.equal(appDataPartNotes(29, 30), false);
    const long = "selka z Lhoty, " + "vdova po sedlákovi z Horní Lhoty, matka šesti dětí, kmotra mnoha dětí celé obce. ".repeat(4).trim();
    await w.ok(["event", "edit", fact(w, "P0001", "CHR").id, "--with", `godparent:Marie Lhotáková (${long})`, "--without", "godparent:Marie Lhotáková", "--reason", "slovo záznamu"], PERSON);
    const version = (t: string, v: string) => t.replace(/^1 SOUR STROM\r?\n2 VERS [^\n]*\n/mu, `1 SOUR STROM\n2 VERS ${v}\n`);
    const given = appFile(w);
    assert.ok(given.includes(long.slice(0, 40)));
    // the 3.28.0 gives a longer note cut short: no edit of the user's, whatever the gate
    const cut = version(given, "3.28.0").replace(/^(3 NOTE selka z Lhoty, [^\n]{0,60})[^\n]*(\r?\n(?:4 CON[CT] [^\n]*\r?\n)*)/mu, "$1\n");
    assert.notEqual(cut, version(given, "3.28.0"));
    const old = readGedcom(cut);
    assert.equal(old.appVersion, "3.28.0");
    assert.equal(noteKinds(planSync(open(w), old, "conflict", { partNotes: true }).changes).length, 1, "taken unasked, the cut note would correct the research's");
    assert.deepEqual(noteKinds(planSync(open(w), old, "conflict", { partNotes: appSendsPartNotes(old.appVersion, "3.29.0") }).changes), [], "of the 3.28.0 never");
    assert.deepEqual(noteKinds(planSync(open(w), old, "conflict").changes), []);
    // the user's edit of it, of an app that gives it whole
    const edited = version(given, "3.29.0").replace(/^3 NOTE selka z Lhoty, [^\n]*(\r?\n(?:4 CON[CT] [^\n]*\r?\n)*)/mu, "3 NOTE selka z Horní Lhoty, vdova\n");
    const before = fact(w, "P0001", "CHR");
    const r = apply(w, readGedcom(edited), { partNotes: true });
    assert.deepEqual(noteKinds(r.plan.changes).map((c) => `${c.kind} ${c.action}`), ["fact.part.note correct"], JSON.stringify(r.plan.changes));
    assert.equal(fact(w, "P0001", "CHR").participants?.find((p) => p.role === "godparent")?.note, "selka z Horní Lhoty, vdova");
    assert.equal(fact(w, "P0001", "CHR").note, before.note, "nothing else of the fact changed");
    await w.ok(["sync", "undo", r.input], PERSON);
    assert.deepEqual(fact(w, "P0001", "CHR").participants, before.participants);
  } finally {
    w.cleanup();
  }
});

test("a note taken away in the app takes nothing away; a midwife's note naming her role is no note edit", opts, async () => {
  const w = await setUp();
  try {
    await w.ok(["event", "edit", fact(w, "P0002", "BIRT").id, "--with", "midwife:Anna Lhotová (porodní bába)", "--without", "midwife:Anna Lhotová", "--reason", "slovo záznamu"], PERSON);
    const gone = appFile(w).replace("3 CONT Kmotr z Lhoty.\n", "").replace(/3 NOTE selka z Lhoty\r?\n/u, "");
    const r = await w.ok(["sync", send(w, "gone.ged", gone), "--json"]);
    assert.deepEqual(noteKinds(r.json.changes), [], JSON.stringify(r.json.changes));
    // the midwife's note says her role: changed into another role's word it is no note of hers changed
    const t = appFile(w);
    assert.match(t, /3 RELA Present\r?\n3 NOTE porodní bába/u, "the app is given her role in the note");
    const other = await w.ok(["sync", send(w, "role.ged", t.replace(/(3 RELA Present\r?\n3 NOTE )porodní bába/u, "$1kmotra")), "--json"]);
    assert.deepEqual(noteKinds(other.json.changes), [], JSON.stringify(other.json.changes));
  } finally {
    w.cleanup();
  }
});

test("the research's line of a note (a date as written) stays beside the user's edit; both sides changed: picked, never written unasked", opts, async () => {
  const w = await setUp();
  try {
    const chr = fact(w, "P0001", "CHR").id;
    await w.ok(["note", "edit", chr, "1", "Kmotr z Lhoty.\ndate as written: 3. března 1871", "--reason", "datum ze záznamu"], PERSON);
    const head = appFile(w);
    // the user's line corrected, the research's own line of the date dropped in the app
    const t = head.replace(/Kmotr z Lhoty\./u, "Kmotr z Dolní Lhoty.").replace(/3 CONT date as written: 3\. března 1871\r?\n/u, "");
    assert.equal(t.includes("date as written"), false);
    const r = await w.ok(["sync", send(w, "line.ged", t), "--apply", "--json"], FROM_APP);
    assert.ok(r.json, "applied");
    assert.equal(fact(w, "P0001", "CHR").note, "date as written: 3. března 1871\nKmotr z Dolní Lhoty.");
    // the research changes the note after the app was given it, the app too: the user picks
    const given = appFile(w);
    await w.ok(["note", "edit", chr, "1", "date as written: 3. března 1871\nKmotr z Dolní Lhoty u lesa.", "--reason", "upřesněno"], PERSON);
    const both = given.replace(/Kmotr z Dolní Lhoty\./u, "Kmotr ze Lhoty u Prahy.");
    const p = await w.ok(["sync", send(w, "both.ged", both), "--json"]);
    assert.deepEqual(noteKinds(p.json.changes).map((c) => c.action), ["pick"], JSON.stringify(p.json.changes));
    await w.ok(["sync", send(w, "both2.ged", both), "--apply"], PERSON);
    assert.equal(fact(w, "P0001", "CHR").note, "date as written: 3. března 1871\nKmotr z Dolní Lhoty u lesa.", "not written unpicked");
  } finally {
    w.cleanup();
  }
});

test("an agent's sync changes no note of the user's fact; a note added where none was is taken", opts, async () => {
  const w = await setUp();
  try {
    const t = appFile(w)
      .replace("3 CONT Kmotr z Lhoty.", "3 CONT Kmotr byl z Horní Lhoty.")
      .replace(/(2 _WITN Anna Lhotová\r?\n3 RELA Midwife\r?\n2 NOTE Vodítko — nedoloženo záznamem\.\r?\n)/u, "$13 CONT Narozena v noci.\n");
    const file = send(w, "agent.ged", t);
    const plan = await w.ok(["sync", file], AGENT);
    assert.match(plan.out, /poznámka „Kmotr z Lhoty\.“ → „Kmotr byl z Horní Lhoty\.“ → /u);
    await w.ok(["sync", file, "--apply"], AGENT);
    assert.equal(fact(w, "P0001", "CHR").note, "Kmotr z Lhoty.", "the user's note: changed by nobody but the user");
    assert.equal(fact(w, "P0002", "BIRT").note, "Narozena v noci.");
  } finally {
    w.cleanup();
  }
});

test("an event the app shares among people has one note there: a copy's note given to the others is no edit; the user's edit comes to each copy", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    await w.ok(["lang", "cs"]);
    await w.ok(["person", "add", "Prokop /Lhoták/", "--sex", "M"], PERSON);
    await w.ok(["person", "add", "Terezie /Lhotáková/", "--sex", "F"], PERSON);
    await w.ok(["event", "add", "P0001", "CENS", "--date", "15 FEB 1921", "--place", "Lhota", "--note", "Dům č. 12, hospodář."], PERSON);
    await w.ok(["event", "add", "P0002", "CENS", "--date", "15 FEB 1921", "--place", "Lhota"], PERSON);
    // the app marks the census one event of both
    const mark = (t: string) => t.replace(/(1 CENS\r?\n2 DATE 15 FEB 1921\r?\n2 PLAC Lhota\r?\n)/gu, "$12 _STROM_SHARE SH7K2QX\n");
    await w.ok(["sync", send(w, "share.ged", mark(appFile(w))), "--apply"], FROM_APP);
    assert.equal(fact(w, "P0002", "CENS").share?.id, "SH7K2QX");
    // the app gives the one note it has to both copies
    const t = appFile(w);
    const one = t.replace(/(1 REFN P0002\r?\n2 TYPE strom-research\r?\n1 CENS\r?\n(?:[2-9] .*\r?\n)*?2 NOTE Vodítko — nedoloženo záznamem\.\r?\n)/u, "$13 CONT Dům č. 12, hospodář.\n");
    assert.notEqual(one, t);
    const r = await w.ok(["sync", send(w, "one.ged", one), "--json"]);
    assert.deepEqual(noteKinds(r.json.changes), [], JSON.stringify(r.json.changes));
    // the user's edit of the shared event's note: each copy of the research has it
    const edited = one.replace(/Dům č\. 12, hospodář\./gu, "Dům č. 12, hospodář se služkou.");
    await w.ok(["sync", send(w, "edited.ged", edited), "--apply"], PERSON);
    assert.equal(fact(w, "P0001", "CENS").note, "Dům č. 12, hospodář se služkou.");
    assert.equal(fact(w, "P0002", "CENS").note, "Dům č. 12, hospodář se služkou.");
  } finally {
    w.cleanup();
  }
});

test("the app's JSON brings a fact's note and a godmother's note as its GEDCOM does", opts, async () => {
  const w = await setUp();
  try {
    const tree = open(w);
    const json = {
      version: 25,
      research: { id: tree.config.id, head: gitHead(w) },
      persons: {
        p1: {
          id: "p1", firstName: "Václav", lastName: "Lhoták", gender: "male", refn: "P0001",
          events: [{ id: "ev1", type: "baptism", date: "1871-03-03", place: "Lhota", note: "Vodítko — nedoloženo záznamem.\nKmotr byl z Horní Lhoty.".normalize("NFD"), participants: [{ role: "godparent", name: "Marie Lhotáková", note: "selka z Horní Lhoty" }] }],
        },
        p2: {
          id: "p2", firstName: "Ludmila", lastName: "Lhotáková", gender: "female", refn: "P0002",
          events: [{ id: "ev2", type: "birth", date: "1874", place: "Lhota", note: "Narozena v noci.", participants: [{ role: "other", name: "Anna Lhotová", note: "Midwife" }] }],
        },
      },
      partnerships: {},
    };
    const plan = planSync(tree, readStromJson(json), "conflict", { partNotes: true });
    assert.deepEqual(
      noteKinds(plan.changes).map((c) => {
        const x = c as { kind: string; action: string; person?: string; text?: string; part?: { note?: string } };
        return [x.kind, x.action, x.person, x.kind === "fact.note" ? x.text : x.part?.note];
      }),
      [
        ["fact.part.note", "correct", "P0001", "selka z Horní Lhoty"],
        ["fact.note", "correct", "P0001", "Kmotr byl z Horní Lhoty."],
        ["fact.note", "add", "P0002", "Narozena v noci."],
      ],
      JSON.stringify(plan.changes),
    );
  } finally {
    w.cleanup();
  }
});
