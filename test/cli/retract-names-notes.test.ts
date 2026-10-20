// A wrong name or note taken back, a note corrected (spec 016): nothing deleted — the name or note kept apart with when,
// by whom and why, shown nowhere (person show, the brief, the GEDCOM, matching), seen in the history, put back on a
// word; a corrected note keeps the text it had. A sync or an import of an older copy never brings it back.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Anna /Horká/", "--sex", "F", "--born", "1850"]); // P1, misread
  await w.ok(["name", "add", "P1", "Anna /Horáková/", "--kind", "birth"]);
  await w.ok(["name", "add", "P1", "Анна /Горакова/", "--kind", "alias"]);
  await w.ok(["recordset", "add", "Ves N 1840-1860", "--places", "Ves", "--years", "1840-1860", "--access", "online-free"]); // B1
  await w.ok(["task", "add", "Křest Anny", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]); // T1
  return w;
}

const exported = async (w: World, name: string, ...more: string[]) => {
  const out = path.join(w.dir, name);
  await w.ok(["export", "gedcom", "--out", out, ...more, ...(more.includes("strom") ? ["--images-for", "none"] : [])]);
  return fs.readFileSync(out, "utf8");
};

test("name retract: needs a reason, keeps the only name; taken back it is shown, briefed, exported and found nowhere — the history has it, restore puts it back", opts, async () => {
  const w = await world();
  const ret = (await w.run(["name", "retract", "P1", "Anna /Horká/"])).code;
  assert.equal(ret, 2, "no reason, nothing taken back");
  // decomposed (NFD) input names the same name
  const r = await w.ok(["name", "retract", "P1", "Anna /Horká/".normalize("NFD"), "--reason", "misread: the register has Horáková"]);
  assert.match(r.out, /P0001 name Anna \/Horká\/ retracted/);
  const p = (await w.ok(["person", "show", "P1", "--json"])).json.person;
  assert.deepEqual(p.names.map((n: any) => n.surname), ["Horáková", "Горакова"]);
  assert.equal(p.retractedNames.length, 1);
  assert.equal(p.retractedNames[0].surname, "Horká");
  assert.equal(p.retractedNames[0].retracted.reason, "misread: the register has Horáková");
  assert.match(p.retractedNames[0].retracted.at, /^\d{4}-\d\d-\d\dT/);
  assert.ok(p.retractedNames[0].retracted.by);
  const show = (await w.ok(["person", "show", "P1"])).out;
  assert.match(show, /^P0001 Anna Horáková/);
  assert.doesNotMatch(show, /Horká/);
  assert.match(show, /retracted or corrected: 1 — strom person show P0001 --history/);
  assert.match((await w.ok(["person", "show", "P1", "--history"])).out, /history\n {2}name Anna Horká retracted \d{4}-\d\d-\d\d \([^)]+\): misread: the register has Horáková/);
  assert.notEqual((await w.run(["person", "show", "Anna Horká"])).code, 0, "a retracted name finds nobody");
  assert.doesNotMatch((await w.ok(["brief", "T1"])).out, /Horká/);
  assert.doesNotMatch(await exported(w, "plain.ged", "--for", "standard"), /Horká/);
  assert.doesNotMatch(await exported(w, "app.ged", "--for", "strom"), /Horká/, "the Strom app no longer shows it once it loads the tree");
  // added again by mistake: refused, the way back said
  const again = await w.run(["name", "add", "P1", "Anna /Horká/"]);
  assert.equal(again.code, 2);
  assert.match(again.err, /strom name restore P0001 "Anna \/Horká\/"/);
  assert.match((await w.ok(["history"])).out, /Odvolané jméno: Anna Horká/);
  assert.match((await w.ok(["check"])).out, /^ok/);

  // a non-Latin name, the one she is shown by: the next one shows
  await w.ok(["name", "retract", "P1", "Анна /Горакова/", "--reason", "транслитерация ошибочна"]);
  const only = await w.run(["name", "retract", "P1", "Anna /Horáková/", "--reason", "x"]);
  assert.equal(only.code, 2, "the only name stays");
  assert.match(only.err, /the only name of P0001/);
  assert.match(only.err, /strom person edit P0001 --name/);

  await w.ok(["name", "restore", "P1", "Anna /Horká/", "--reason", "a second record gives it"]);
  const back = (await w.ok(["person", "show", "P1", "--json"])).json.person;
  assert.deepEqual(back.names.map((n: any) => n.surname), ["Horáková", "Horká"]);
  assert.deepEqual(back.retractedNames.map((n: any) => n.surname), ["Горакова"]);
  assert.match((await w.ok(["history"])).out, /Vrácené jméno: Anna Horká/);
  assert.equal((await w.run(["name", "restore", "P1", "Anna /Horká/"])).code, 2, "nothing retracted by that name");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("note edit, retract, restore — a person's, a task's, a fact's: the old text in the history, the retracted one nowhere", opts, async () => {
  const w = await world();
  await w.ok(["note", "add", "P1", "Žila v čp. 37 (jmenovkyně)"]);
  await w.ok(["note", "add", "P1", "Kmotra Marie z Vsi"]);
  await w.ok(["task", "edit", "T1", "--note", "Kniha 12 prohledána 1801–1830"]);
  await w.ok(["event", "add", "P1", "OCCU", "--value", "služka", "--note", "u sedláka v čp. 5"]);
  const fact = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.find((e: any) => e.kind === "OCCU").id;

  const list = (await w.ok(["note", "list", "P1"])).out;
  assert.match(list, /\n {2}1 {2}\S+ \S+ {2}Žila v čp\. 37 \(jmenovkyně\)\n {2}2 {2}\S+ \S+ {2}Kmotra Marie z Vsi/);
  assert.equal((await w.run(["note", "retract", "P1", "1"])).code, 2, "no reason");
  assert.equal((await w.run(["note", "edit", "P1", "2", "x"])).code, 2, "no reason");
  assert.equal((await w.run(["note", "retract", "P1", "3", "--reason", "x"])).code, 2, "no note 3");

  await w.ok(["note", "retract", "P1", "1", "--reason", "o jmenovkyni z čp. 37"]);
  await w.ok(["note", "edit", "P1", "1", "Kmotra Marie Dvořáková z Vsi", "--reason", "příjmení doplněno"]);
  await w.ok(["note", "edit", "T1", "1", "Kniha 12 prohledána 1801–1820", "--reason", "roky špatně"]);
  await w.ok(["note", "edit", fact, "1", "u sedláka v čp. 6", "--reason", "čp. přečteno špatně"]);

  const p = (await w.ok(["person", "show", "P1", "--json"])).json.person;
  assert.deepEqual(p.notes.map((n: any) => n.text), ["Kmotra Marie Dvořáková z Vsi"]);
  assert.deepEqual(p.notes[0].edits.map((e: any) => [e.text, e.reason]), [["Kmotra Marie z Vsi", "příjmení doplněno"]]);
  assert.equal(p.retractedNotes[0].text, "Žila v čp. 37 (jmenovkyně)");
  assert.equal(p.retractedNotes[0].retracted.reason, "o jmenovkyni z čp. 37");
  const e = p.events.find((x: any) => x.id === fact);
  assert.equal(e.note, "u sedláka v čp. 6");
  assert.deepEqual(e.noteEdits.map((x: any) => x.text), ["u sedláka v čp. 5"]);
  const task = (await w.ok(["task", "show", "T1", "--json"])).json.task;
  assert.deepEqual(task.notes.map((n: any) => n.text), ["Kniha 12 prohledána 1801–1820"]);

  const show = (await w.ok(["person", "show", "P1"])).out;
  assert.doesNotMatch(show, /jmenovkyně|Kmotra Marie z Vsi|čp\. 5/);
  const history = (await w.ok(["person", "show", "P1", "--history"])).out;
  assert.match(history, /note retracted \S+ \([^)]+\): o jmenovkyni z čp\. 37 — Žila v čp\. 37 \(jmenovkyně\)/);
  assert.match(history, /note corrected \S+ \([^)]+\): příjmení doplněno — before: Kmotra Marie z Vsi/);
  assert.match(history, new RegExp(`${fact} note corrected \\S+ \\([^)]+\\): čp\\. přečteno špatně — before: u sedláka v čp\\. 5`));
  assert.match((await w.ok(["note", "list", "T1", "--history"])).out, /1 {2}.*Kniha 12 prohledána 1801–1820\n {5}before \S+ \([^)]+\): roky špatně — Kniha 12 prohledána 1801–1830/);
  const brief = (await w.ok(["brief", "T1"])).out;
  assert.doesNotMatch(brief, /jmenovkyně|Kmotra Marie z Vsi|1801–1830/, "the agent is given only what holds");
  assert.match(brief, /1801–1820/);
  const ged = await exported(w, "plain.ged", "--for", "standard");
  assert.doesNotMatch(ged, /jmenovkyně|Kmotra Marie z Vsi|čp\. 5\b/);
  assert.match(ged, /Kmotra Marie Dvořáková z Vsi/);
  assert.match((await w.ok(["history"])).out, /Odvolaná poznámka: Anna Horká/);

  // the fact's note taken back, then put back; the person's note back in its time (first again)
  await w.ok(["note", "retract", fact, "1", "--reason", "jiná Anna"]);
  assert.equal((await w.ok(["person", "show", "P1", "--json"])).json.person.events.find((x: any) => x.id === fact).note, undefined);
  await w.ok(["note", "restore", fact, "1"]);
  await w.ok(["note", "restore", "P1", "1", "--reason", "byla to naše Anna"]);
  const after = (await w.ok(["person", "show", "P1", "--json"])).json.person;
  assert.deepEqual(after.notes.map((n: any) => n.text), ["Žila v čp. 37 (jmenovkyně)", "Kmotra Marie Dvořáková z Vsi"]);
  assert.equal(after.retractedNotes, undefined);
  const ev = after.events.find((x: any) => x.id === fact);
  assert.equal(ev.note, "u sedláka v čp. 6");
  assert.deepEqual(ev.noteEdits.map((x: any) => x.text), ["u sedláka v čp. 5"], "the correction it had comes back with it");
  assert.equal((await w.run(["note", "restore", "P1", "1"])).code, 2, "nothing retracted");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a sync of the app's older copy, with its head or without, brings neither a retracted name nor a retracted or corrected note back", opts, async () => {
  const w = await world();
  await w.ok(["note", "add", "P1", "Žila v čp. 37 (jmenovkyně)"]);
  await w.ok(["note", "add", "P1", "Kmotra Marie z Vsi"]);
  const older = await exported(w, "older.ged", "--for", "strom");
  assert.match(older, /Horká/);
  await w.ok(["name", "retract", "P1", "Anna /Horká/", "--reason", "misread"]);
  await w.ok(["note", "retract", "P1", "1", "--reason", "jmenovkyně"]);
  await w.ok(["note", "edit", "P1", "1", "Kmotra Marie Dvořáková z Vsi", "--reason", "příjmení"]);
  const plan = async (text: string, name: string) => {
    const file = path.join(w.dir, name);
    fs.writeFileSync(file, text);
    return ((await w.ok(["sync", file, "--json"])).json.changes as { kind: string; text?: string }[]).map((c) => `${c.kind} ${c.text ?? ""}`);
  };
  assert.deepEqual(await plan(older, "with-head.ged"), []);
  const headless = older.replace(/^1 _STROM_HEAD .*\r?\n/m, "");
  assert.notEqual(headless, older);
  assert.deepEqual(await plan(headless, "no-head.ged"), [], "without the head only additions — and these are no additions");
  w.cleanup();
});

test("find: a retracted name, a retracted note of a person or a family and the old text of a corrected note are found nowhere; what stands is found", opts, async () => {
  const w = await world();
  await w.ok(["person", "add", "Jan /Horák/", "--sex", "M"]); // P2
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P1"]); // F1
  await w.ok(["note", "add", "P1", "Žila v čp. 37 (jmenovkyně)"]);
  await w.ok(["note", "add", "P1", "Kmotra Marie Dvořáčková z Vsi"]);
  await w.ok(["note", "add", "F1", "Sňatek v Lhotě Чернова"]);
  await w.ok(["event", "add", "P1", "OCCU", "--value", "služka", "--note", "u sedláka Křížka"]);
  const fact = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.find((e: any) => e.kind === "OCCU").id;
  await w.ok(["name", "retract", "P1", "Anna /Horká/", "--reason", "misread"]);
  await w.ok(["note", "retract", "P1", "1", "--reason", "o jmenovkyni"]);
  await w.ok(["note", "edit", "P1", "1", "Kmotra Marie Dvořáková z Vsi", "--reason", "příjmení přečteno znovu"]);
  await w.ok(["note", "retract", "F1", "1", "--reason", "jiný pár"]);
  await w.ok(["note", "edit", fact, "1", "u sedláka Novotného", "--reason", "jméno přečteno špatně"]);

  const found = async (q: string) => (await w.ok(["find", q, "--json"])).json.hits.map((h: any) => h.id);
  // decomposed input and without diacritics find the same — and none of what was taken back or replaced
  for (const q of ["Horká", "Horka", "Horká".normalize("NFD"), "jmenovkyne", "misread", "Dvořáčková", "Dvorackova", "Чернова", "jiný pár", "Křížka", "přečteno špatně"])
    assert.deepEqual(await found(q), [], q);
  assert.deepEqual(await found("Dvořáková"), ["P0001"]);
  assert.deepEqual(await found("Novotneho"), ["P0001"]);
  assert.deepEqual(await found("Горакова"), ["P0001"]);
  assert.match((await w.ok(["find", "Horká"])).out, /^nothing found/);
  w.cleanup();
});
