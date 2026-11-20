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
import { applySync, cutShort, planSync, readGedcom, readStromJson, type Snapshot, type SyncInput } from "../../src/core/sync.ts";
import { create, update } from "../../src/core/records.ts";
import { APP_DATA_PART_NOTES, APP_SENDS_PART_NOTES, appDataPartNotes, appSendsPartNotes } from "../../src/core/stromapp.ts";
import type { Event, Person, Source, Task } from "../../src/core/model.ts";
import { SHORTER_ORIGIN } from "../../src/core/shorternote.ts";
import { answersInApp, inApp, waitingFor } from "../../src/core/waiting.ts";

const opts = { skip: !hasGit };
const PERSON = { tty: true };
const AGENT = { env: { CLAUDECODE: "1" } };
/** As the Strom app's bridge writes a send: the person's. */
const FROM_APP = { env: { STROM_FOR_APP: "1" } };

const open = (w: World) => Tree.open(w.cwd, w.env);
const fact = (w: World, who: string, kind: string): Event => open(w).get<Person>(who)!.events.find((e) => e.kind === kind && !e.retracted)!;
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const noteKinds = (changes: { kind: string; action?: string; code?: string }[]) => changes.filter((c) => c.kind === "fact.note" || c.kind === "fact.part.note");
/** The changes of a note that write it (not a question to the person). */
const edits = (changes: { kind: string; action?: string; code?: string }[]) => noteKinds(changes).filter((c) => c.action !== "report");

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
    assert.equal(APP_SENDS_PART_NOTES, "3.29.0", "the first app that gives it whole");
    assert.equal(APP_DATA_PART_NOTES, 21, "its JSON: never cut it (the app's answer, 16. 11.)");
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
    assert.deepEqual(edits(planSync(open(w), old, "conflict", { partNotes: true }).changes), [], "the beginning alone of the research's: never an edit, the gate open or not");
    assert.deepEqual(noteKinds(planSync(open(w), old, "conflict", { partNotes: appSendsPartNotes(old.appVersion, "3.29.0") }).changes), [], "of the 3.28.0 never");
    assert.deepEqual(noteKinds(planSync(open(w), old, "conflict").changes), []);
    // a tree the app kept since 3.28.0 sends it cut short under 3.29.0 too: no edit (the gate as released) — the person
    // asked whether the shorter note is taken (core/shorternote.ts)
    const kept = noteKinds(planSync(open(w), readGedcom(version(cut, "3.29.0")), "conflict").changes);
    assert.deepEqual(kept.map((c) => `${c.action} ${c.code}`), ["report note.shorter"], "3.29.0, cut short: no edit, a question");
    // the user's edit of it, of an app that gives it whole
    const edited = version(given, "3.29.0").replace(/^3 NOTE selka z Lhoty, [^\n]*(\r?\n(?:4 CON[CT] [^\n]*\r?\n)*)/mu, "3 NOTE selka z Horní Lhoty, vdova\n");
    assert.deepEqual(noteKinds(planSync(open(w), readGedcom(version(edited, "3.28.0")), "conflict").changes), [], "the same edit of the 3.28.0: nothing");
    const before = fact(w, "P0001", "CHR");
    const r = apply(w, readGedcom(edited), {});
    assert.deepEqual(noteKinds(r.plan.changes).map((c) => `${c.kind} ${c.action}`), ["fact.part.note correct"], JSON.stringify(r.plan.changes));
    assert.equal(fact(w, "P0001", "CHR").participants?.find((p) => p.role === "godparent")?.note, "selka z Horní Lhoty, vdova");
    assert.equal(fact(w, "P0001", "CHR").note, before.note, "nothing else of the fact changed");
    await w.ok(["sync", "undo", r.input], PERSON);
    assert.deepEqual(fact(w, "P0001", "CHR").participants, before.participants);
  } finally {
    w.cleanup();
  }
});

test("a note cut short is the beginning alone of the longer one: any script, decomposed, a character broken at the cut", () => {
  const whole = "selka z Lhoty, Lhotáková — Записано 👩‍👧 a 🌾 dál\nkmotra mnoha dětí";
  assert.equal(cutShort("selka z Lhoty, Lhotáková — Записано 👩‍👧 a 🌾 dál", whole), true, "its first line");
  assert.equal(cutShort("selka z Lhoty, Lhotáková".normalize("NFD"), whole), true, "typed decomposed");
  assert.equal(cutShort("selka z Lhoty, Lhotáková — Записано 👩‍👧 a \uD83C", whole), true, "half of a pair at the cut");
  assert.equal(cutShort("selka z Lhoty, Lhotáková — Записано 👩‍👧 a �", whole), true, "a byte sequence broken at the cut");
  assert.equal(cutShort(whole.replace("\n", " "), whole), false, "the whole note: not cut");
  assert.equal(cutShort("selka z Horní Lhoty", whole), false, "another note");
  assert.equal(cutShort("", whole), false);
  assert.equal(cutShort("selka", undefined), false, "nothing to be cut of");
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
    // the app gives the one note it has to both copies (a shared event's note says nothing of one copy: no status word
    // of a lead in it, spec 106)
    const t = appFile(w);
    assert.doesNotMatch(t, /Vodítko — nedoloženo záznamem/u);
    const one = t.replace(/(1 REFN P0002\r?\n2 TYPE strom-research\r?\n1 CENS\r?\n(?:[2-9] .*\r?\n)*)/u, "$12 NOTE Dům č. 12, hospodář.\n");
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

test("the app's JSON of data 21 brings a godmother's note as its GEDCOM 3.29.0: an edit taken, one cut short not (asked), of older data nothing (APP_DATA_PART_NOTES)", opts, async () => {
  const w = await setUp();
  try {
    const tree = open(w);
    /** The app's JSON of this data version, its godmother's note as given. */
    const json = (version: number, note: string) => ({
      version,
      research: { id: tree.config.id, head: gitHead(w) },
      persons: {
        p1: {
          id: "p1", firstName: "Václav", lastName: "Lhoták", gender: "male", refn: "P0001",
          events: [{ id: "ev1", type: "baptism", date: "1871-03-03", place: "Lhota", note: "Kmotr z Lhoty.", participants: [{ role: "godparent", name: "Marie Lhotáková", note }] }],
        },
        p2: {
          id: "p2", firstName: "Ludmila", lastName: "Lhotáková", gender: "female", refn: "P0002",
          events: [{ id: "ev2", type: "birth", date: "1874", place: "Lhota", participants: [{ role: "other", name: "Anna Lhotová", note: "Midwife" }] }],
        },
      },
      partnerships: {},
    });
    const plan = (version: number, note: string) => noteKinds(planSync(open(w), readStromJson(json(version, note)), "conflict").changes);
    // the user's edit (decomposed as typed, another script beside): taken of data 21 and newer, the gate as released
    const edit = "selka z Horní Lhoty, кума".normalize("NFD");
    assert.deepEqual(plan(21, edit).map((c) => `${c.kind} ${c.action}`), ["fact.part.note correct"]);
    assert.deepEqual(plan(25, edit).map((c) => `${c.kind} ${c.action}`), ["fact.part.note correct"]);
    // a tree the app read from a GEDCOM in its 3.28 keeps the note cut short in its JSON too: never an edit, the person asked
    assert.deepEqual(plan(21, "selka z").map((c) => `${c.action} ${c.code}`), ["report note.shorter"], "cut short: no edit, a question");
    // of data before 21: nothing of a participant's note
    assert.deepEqual(plan(20, edit), []);
    assert.deepEqual(plan(20, "selka z"), []);
    // written: the godmother's note corrected, nothing else of the fact
    const before = fact(w, "P0001", "CHR");
    const r = apply(w, readStromJson(json(21, edit)), {});
    assert.deepEqual(noteKinds(r.plan.changes).map((c) => `${c.kind} ${c.action}`), ["fact.part.note correct"]);
    assert.equal(fact(w, "P0001", "CHR").participants?.find((p) => p.role === "godparent")?.note, edit.normalize("NFC"));
    assert.equal(fact(w, "P0001", "CHR").note, before.note);
  } finally {
    w.cleanup();
  }
});

test("a cut between a letter and its accent is a beginning too (NFD): never an edit (1116, nález 2)", opts, async () => {
  const whole = "selka z Lhoty, vdova po sedlákovi";
  assert.equal(cutShort("selka z Lhoty, vdova po sedla", whole), true, "the accent of á cut off (decomposed: a + U+0301)");
  assert.equal(cutShort("selka z Lhoty, vdova po sedla".normalize("NFD"), whole.normalize("NFD")), true);
  assert.equal(cutShort("selka z Lhoty, vdova po sedlá", whole), true, "cut after the accent");
  assert.equal(cutShort("selka z Lhoty, vdova po sedlo", whole), false, "another letter");
  const w = await setUp();
  try {
    await w.ok(["event", "edit", fact(w, "P0001", "CHR").id, "--with", `godparent:Marie Lhotáková (${whole})`, "--without", "godparent:Marie Lhotáková", "--reason", "slovo záznamu"], PERSON);
    const t = appFile(w).replace(/^1 SOUR STROM\r?\n2 VERS [^\n]*\n/mu, "1 SOUR STROM\n2 VERS 3.29.0\n").replace(`3 NOTE ${whole}`, `3 NOTE ${whole.normalize("NFD").slice(0, whole.normalize("NFD").indexOf("́"))}`);
    assert.ok(t.includes("vdova po sedla\n"), "the file cut between a and its accent");
    const plan = planSync(open(w), readGedcom(t), "conflict");
    assert.deepEqual(edits(plan.changes), [], JSON.stringify(plan.changes));
  } finally {
    w.cleanup();
  }
});

/** A godmother's longer note in the research, and the Strom app 3.29.0's file of it with only its beginning (`cut` its length). */
async function shorterWorld(): Promise<{ w: World; whole: string; short: string; text: string; file: (name: string) => string }> {
  const w = await setUp();
  const whole = "selka z Lhoty, vdova po sedlákovi, matka šesti dětí 😀 a kmotra — Записано";
  const short = "selka z Lhoty, vdova po sedlákovi, matka šesti dětí";
  await w.ok(["event", "edit", fact(w, "P0001", "CHR").id, "--with", `godparent:Marie Lhotáková (${whole})`, "--without", "godparent:Marie Lhotáková", "--reason", "slovo záznamu"], PERSON);
  const t = appFile(w).replace(/^1 SOUR STROM\r?\n2 VERS [^\n]*\n/mu, "1 SOUR STROM\n2 VERS 3.29.0\n").replace(`3 NOTE ${whole}`, `3 NOTE ${short}`);
  assert.ok(t.includes(`3 NOTE ${short}\n`));
  return { w, whole, short, text: t, file: (name) => send(w, name, t) };
}

// (one a sync's undo dropped is asked no more)
const shorterTasks = (w: World) => open(w).list<Task>("task").filter((t) => t.origin === SHORTER_ORIGIN && t.state !== "dropped");
const godmother = (w: World) => fact(w, "P0001", "CHR").participants?.find((p) => p.role === "godparent")?.note;

test("a participant's note sent shorter than the research's: not taken, said in one line, the person asked once — kept, never asked again (1116, nález 1)", opts, async () => {
  const { w, whole, short, text, file } = await shorterWorld();
  try {
    const f = file("short.ged");
    const plan = await w.ok(["sync", f], PERSON);
    assert.doesNotMatch(plan.out, /nic nového/u);
    // a question to the person is no change of the research: counted as what it is (1116, poznámka 1)
    assert.match(plan.out, /short\.ged: 1 otázka k rozhodnutí, jinak nic proti výzkumu/u);
    assert.doesNotMatch(plan.out, /1 změna/u);
    assert.match(plan.out, /kmotr\S* Marie Lhotáková, poznámka „selka z Lhoty, .*“ → „selka z Lhoty, vdova po sedlákovi, matka šesti dětí“ → nepřevezme se: je kratší než ve výzkumu — zda ji převzít, čeká v Čeká/u);
    const said = await w.ok(["sync", f, "--apply"], PERSON);
    assert.match(said.out, /Z short\.ged se ve výzkumu nic nezměnilo: 1 otázka čeká v Čeká \(I\d+\)/u);
    assert.doesNotMatch(said.out, /Zapsána 1 změna/u);
    await w.ok(["sync", "undo", /\((I\d+)\)/u.exec(said.out)![1]!], PERSON);
    const r = await w.ok(["sync", file("short-again.ged"), "--apply", "--json"], FROM_APP);
    assert.equal(godmother(w), whole, "nothing taken");
    const [t, ...more] = shorterTasks(w);
    assert.ok(t && !more.length, "one task");
    assert.equal(t.state, "waiting");
    assert.deepEqual(t.shorterNote, { event: fact(w, "P0001", "CHR").id, role: "godparent", name: "Marie Lhotáková", sent: short, whole });
    assert.match(t.what, /^Poznámka z aplikace Strom u E\d+ \(Václav Lhoták\), Marie Lhotáková, je kratší než ve výzkumu – převzít, nebo ponechat\?$/u);
    assert.ok(t.why.includes(`„${short}“`) && t.why.includes(`„${whole}“`), t.why);
    assert.ok((r.json.applied as { do: string; id: string }[]).some((a) => a.do === "task.add" && a.id === t.id));
    const item = waitingFor(open(w)).find((i) => i.task?.id === t.id);
    assert.ok(item && inApp(item) && answersInApp(t), "in What waits, the Strom app's too, answered there");
    // the same tree sent again (another send of it, the file not the one synced): nothing more — no change, no second task
    assert.deepEqual(noteKinds(planSync(open(w), readGedcom(text), "conflict").changes), [], "asked already: no change");
    // …said while it waits (1116, poznámka 2)
    // (another file of the same tree: not the very file synced last, which is said as such)
    const other = send(w, "short2.ged", `${text}\n`);
    const again = await w.ok(["sync", other], PERSON);
    assert.match(again.out, /short2\.ged: nic nového .*\n.*Otázka z dřívějšího poslání dál čeká v Čeká \(T\d+\)/u);
    assert.ok(again.out.includes(`(${t.id})`), again.out);
    assert.deepEqual((await w.ok(["sync", other, "--json"], PERSON)).json.waiting, [t.id]);
    await w.ok(["sync", file("again.ged"), "--apply"], FROM_APP);
    assert.equal(shorterTasks(w).length, 1, "asked once");
    // an agent decides nothing without the person's answer
    const agent = await w.run(["sync", "note", t.id, "keep"], AGENT);
    assert.equal(agent.code, 4, agent.out + agent.err);
    assert.equal(shorterTasks(w)[0]!.state, "waiting");
    // the person keeps the research's: done, the note as it was, never asked again
    await w.ok(["sync", "note", t.id, "keep"], PERSON);
    const done = shorterTasks(w)[0]!;
    assert.equal(done.state, "done");
    assert.match(done.result ?? "", /ponechaná/u);
    assert.equal(godmother(w), whole);
    assert.deepEqual(noteKinds(planSync(open(w), readGedcom(text), "conflict").changes), [], "decided: not asked again");
    assert.equal(planSync(open(w), readGedcom(text), "conflict").waiting, undefined, "decided: waits no more");
    assert.equal(shorterTasks(w).length, 1);
    const twice = await w.run(["sync", "note", t.id, "take"], PERSON);
    assert.notEqual(twice.code, 0, "decided already");
    assert.equal(godmother(w), whole);
  } finally {
    w.cleanup();
  }
});

test("a note sent shorter taken on the person's word — by an agent carrying out their answer; a sync undone drops its question", opts, async () => {
  const { w, short, whole, file } = await shorterWorld();
  try {
    const r = await w.ok(["sync", file("short.ged"), "--apply", "--json"], FROM_APP);
    let t = shorterTasks(w)[0]!;
    // the sync undone: its question dropped, asked again by the next send
    await w.ok(["sync", "undo", r.json.input as string], PERSON);
    assert.equal(open(w).get<Task>(t.id)!.state, "dropped");
    await w.ok(["sync", file("again.ged"), "--apply"], FROM_APP);
    const waiting = shorterTasks(w).filter((x) => x.state === "waiting");
    assert.equal(waiting.length, 1, "asked again");
    t = waiting[0]!;
    // the person answers it (as in the Strom app); the agent carries the answer out
    await w.ok(["task", "wake", t.id, "--answer", "převzít kratší"], PERSON);
    await w.ok(["sync", "note", t.id, "take"], AGENT);
    assert.equal(godmother(w), short, "the shorter note taken");
    assert.equal(open(w).get<Task>(t.id)!.state, "done");
    assert.ok(whole.startsWith(short));
    // the research has the app's note now: nothing more
    const next = await w.ok(["sync", file("next.ged"), "--json"], PERSON);
    assert.deepEqual(noteKinds(next.json.changes), []);
  } finally {
    w.cleanup();
  }
});
