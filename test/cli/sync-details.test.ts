// strom sync: a family tree coming back from the Strom app (or another
// program), compared with what the research gave it — the user's edits taken
// in without losing what the research rests on; a wrong file refused; a sync
// undone.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Conflict, Family, Person } from "../../src/core/model.ts";
import { opts, world, edited, post, get, marked, withSources } from "./sync.helpers.ts";

test("a couple's second marriage the app folds into the first is not the user's edit; both taken away is said", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Antonín /Dvořák/", "--sex", "M"]);
  await w.ok(["person", "add", "Božena /Nová/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "9 MAY 1885"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "19 MAY 1885", "--place", "Kněževes"]);
  // another couple, its marriage kept by the user
  await w.ok(["person", "add", "Jan /Dvořák/", "--sex", "M"]);
  await w.ok(["person", "add", "Marie /Malá/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P3", "--partner", "P4"]);
  await w.ok(["event", "add", "F2", "MARR", "--date", "1910"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const t = fs.readFileSync(ged, "utf8");
  assert.equal((t.match(/^1 MARR$/gm) ?? []).length, 3);
  // the app keeps the first marriage of the union only
  const first = t.replace(/(1 MARR\r?\n(?:[2-9].*\r?\n)*)1 MARR\r?\n(?:[2-9].*\r?\n)*/, "$1");
  assert.equal((first.match(/^1 MARR$/gm) ?? []).length, 2);
  fs.writeFileSync(path.join(w.dir, "z-aplikace.ged"), first);
  const r = await w.ok(["sync", path.join(w.dir, "z-aplikace.ged"), "--json"]);
  assert.deepEqual(r.json.changes, [], JSON.stringify(r.json.changes));
  // the user took the first couple's marriage away (the app has none of it): said
  const none = t.replace(/1 MARR\r?\n(?:[2-9].*\r?\n)*1 MARR\r?\n(?:[2-9].*\r?\n)*/, "");
  assert.equal((none.match(/^1 MARR$/gm) ?? []).length, 1);
  fs.writeFileSync(path.join(w.dir, "bez-snatku.ged"), none);
  const gone = await w.ok(["sync", path.join(w.dir, "bez-snatku.ged"), "--json"]);
  assert.deepEqual(gone.json.changes.map((c: { kind: string }) => c.kind), ["fact.gone", "fact.gone"]);
  w.cleanup();
});

test("what the user added to a fact in the app — its cause, age, house — is taken: added to the research's fact, a lead corrected, a record's word a conflict; undone back", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Úmrtí v Týnci", "--kind", "death"]);
  await w.ok(["person", "add", "Antonín /Dvořák/", "--sex", "M"]);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1901", "--place", "Týnec", "--cite", "S1"]);
  await w.ok(["person", "add", "Božena /Nová/", "--sex", "F"]);
  await w.ok(["event", "add", "P2", "DEAT", "--date", "1903", "--place", "Týnec", "--age", "54"]);
  await w.ok(["person", "add", "Karel /Malý/", "--sex", "M"]);
  await w.ok(["event", "add", "P3", "DEAT", "--date", "1905", "--place", "Týnec", "--cause", "tuberkulóza", "--cite", "S1"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const t = fs.readFileSync(ged, "utf8");
  // in the app: a cause where the research has none, another age, another cause than the record's — and the same house again
  const edited = t
    .replace(/(2 DATE 1901\n2 PLAC Týnec\n)/, "$12 CAUS souchotiny\n")
    .replace("2 AGE 54y", "2 AGE 60y")
    .replace("2 CAUS tuberkulóza", "2 CAUS zápal plic");
  assert.equal((edited.match(/souchotiny|60y|zápal plic/g) ?? []).length, 3);
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, edited);
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /Antonín Dvořák \[P0001\]: úmrtí 1901, Týnec — — → příčina souchotiny → doplní se k údaji s odkazem na strom z aplikace/);
  assert.match(r.out, /Božena Nová \[P0002\]: úmrtí 1903, Týnec — 54 let → 60 let → opraví vodítko výzkumu/);
  assert.match(r.out, /Karel Malý \[P0003\]: úmrtí 1905, Týnec — příčina tuberkulóza → příčina zápal plic → rozpor k rozhodnutí/);
  await w.ok(["sync", file, "--apply"]);
  const death = (p: string) => (Tree.open(w.cwd, w.env).get<Person>(p)!.events.find((e) => e.kind === "DEAT"))!;
  assert.equal(death("P0001").cause, "souchotiny");
  assert.equal(death("P0001").status, "probable", "the record's fact stays as it was");
  assert.ok(death("P0001").citations.some((c) => c.source === "S0002"), "the cause cites the user's tree");
  assert.equal(death("P0002").age, "60y");
  assert.equal(death("P0003").cause, "tuberkulóza", "a record's word is not overwritten");
  assert.equal((await w.ok(["conflict", "list", "--json"])).json.conflicts.length, 1);
  // taken in already: nothing new
  assert.match((await w.ok(["sync", file, "--again"])).out, /nic nového/);
  await w.ok(["sync", "undo", "I1"]);
  assert.equal(death("P0001").cause, undefined);
  assert.equal(death("P0002").age, "54y");
  // the app's JSON says the same of a death
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  const app = {
    version: 9,
    research: { id },
    persons: { a: { id: "a", firstName: "Antonín", lastName: "Dvořák", gender: "male", refn: "P0001", deathDate: "1901", deathPlace: "Týnec", deathCause: "souchotiny", deathAge: "61 let", deathAddress: "čp. 7" } },
    partnerships: {},
  };
  const json = path.join(w.dir, "strom.json");
  fs.writeFileSync(json, JSON.stringify(app));
  assert.match((await w.ok(["sync", json])).out, /Antonín Dvořák \[P0001\]: úmrtí 1901, Týnec — — → čp\. 7, 61 let, příčina souchotiny → doplní se k údaji s odkazem na strom z aplikace/, "an addition: taken also without the state");
  w.cleanup();
});

test("a conflict of the user's edit as the Strom app shows it: both values in the research's language — its dialog, conflict show, the decision taken", opts, async () => {
  // found on Mac (the app's beta.72): "14 JAN 1931, Dolní Lhota, house 12" in the dialog of a Czech research
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Narození v Dolní Lhotě", "--kind", "baptism"]);
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["event", "add", "P1", "BIRT", "--date", "14 JAN 1931", "--place", "Dolní Lhota", "--house", "12", "--cite", "S1", "--status", "probable"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, fs.readFileSync(ged, "utf8").replace("2 DATE 14 JAN 1931", "2 DATE 15 JAN 1931"));
  await w.ok(["sync", file, "--apply"]);
  await w.ok(["export", "gedcom"]);
  const out = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.match(out, /1 _STROM_CONFLICT X0001\n2 TYPE BIRT\n2 TITL Jan Novák: Narození — 14\. 1\. 1931, Dolní Lhota, čp\. 12 × 15\. 1\. 1931, Dolní Lhota, čp\. 12\n2 STAT open\n2 VAL 14\. 1\. 1931, Dolní Lhota, čp\. 12\n3 SOUR @S0001@\n2 VAL 15\. 1\. 1931, Dolní Lhota, čp\. 12\n/);
  assert.doesNotMatch(out, /JAN 1931,|house 12/);
  const show = (await w.ok(["conflict", "show", "X1"])).out;
  assert.match(show, /tvrzení {2}S0001: 14\. 1\. 1931, Dolní Lhota, čp\. 12\ntvrzení {2}S0002: 15\. 1\. 1931, Dolní Lhota, čp\. 12/);
  // the side named in words is that side; the decision the app shows in words too
  await w.ok(["conflict", "resolve", "X1", "--resolution", "14. 1. 1931, Dolní Lhota, čp. 12", "--reasoning", "matrika"]);
  await w.ok(["export", "gedcom"]);
  assert.match(fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8"), /2 STAT decided\n(?:.*\n)*?2 DECI 14\. 1\. 1931, Dolní Lhota, čp\. 12\n/);
  const stored = Tree.open(w.cwd, w.env).get<Conflict>("X0001")!;
  assert.equal(stored.claims[0]!.value, "14 JAN 1931, Dolní Lhota, house 12", "as strom compares it: as before");
  w.cleanup();
});

test("a German research says its words in the Strom file in German — a house, a lead, a record's words; the app's copy with the English words of an older strom comes back as nothing new", opts, async () => {
  // found on the app's screenshots: "House No. 12" under a fact of a German research
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "de"]);
  await w.ok(["source", "add", "Taufbuch Dorf 1880", "--kind", "baptism"]);
  await w.ok(["person", "add", "Hans /Müller/", "--sex", "M"]);
  await w.ok(["event", "add", "P1", "BIRT", "--date", "3 MAR 1880", "--place", "Dorf", "--house", "12", "--cite", "S1", "--quote", "natus est"]);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1940", "--place", "Dorf", "--house", "7", "--status", "lead"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const t = fs.readFileSync(ged, "utf8");
  assert.match(t, /2 ADDR Haus Nr\. 12\n/);
  assert.match(t, /2 NOTE Eintrag: „natus est“/);
  assert.match(t, /2 NOTE Hinweis — nicht durch einen Eintrag belegt\./);
  assert.doesNotMatch(t, /House No\.|Lead —|Record:/);
  assert.match((await w.ok(["sync", ged])).out, /nichts Neues/);
  // the copy an older strom gave the app (its English words) changes nothing either
  const older = path.join(w.dir, "aelter.ged");
  fs.writeFileSync(older, t.replaceAll("Haus Nr.", "House No.").replace("Hinweis — nicht durch einen Eintrag belegt.", "Lead — not proven by a record.").replace("Eintrag: „", "Record: „"));
  assert.match((await w.ok(["sync", older])).out, /nichts Neues/);
  w.cleanup();
});

test("a couple's events from the Strom app 3.8: their residence as RESI for it, the partners' ages and the couple's events taken from its GEDCOM and its JSON (data version 10); undone back", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Oddací kniha", "--kind", "marriage"]);
  await w.ok(["person", "add", "Antonín /Dvořák/", "--sex", "M"]);
  await w.ok(["person", "add", "Božena /Nová/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "9 MAY 1885", "--place", "Týnec", "--cite", "S1"]);
  await w.ok(["event", "add", "F1", "RESI", "--place", "Lhota", "--house", "12"]);
  // the residence of a couple: RESI for an app that keeps a couple's events, else an event named so
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const t = fs.readFileSync(ged, "utf8");
  assert.match(t, /0 @F0001@ FAM[\s\S]*\n1 RESI\n2 PLAC Lhota\n2 ADDR čp\. 12\n/);
  await w.ok(["config", "unset", "strom.app.url"]);
  await w.ok(["config", "set", "strom.version", "3.7.0"]);
  const older = path.join(w.dir, "older.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", older]);
  assert.match(fs.readFileSync(older, "utf8"), /\n1 EVEN\n2 TYPE Bydliště\n2 PLAC Lhota/);
  // either comes back as the same residence
  fs.writeFileSync(path.join(w.dir, "z-aplikace.ged"), t);
  assert.deepEqual((await w.ok(["sync", path.join(w.dir, "z-aplikace.ged"), "--json"])).json.changes, []);
  // in the app: the partners' ages at the wedding added (a record's fact: added to it), banns added
  const edited = t.replace(/(1 MARR\n2 DATE 9 MAY 1885\n2 PLAC Týnec\n)/, "$12 HUSB\n3 AGE 28y\n2 WIFE\n3 AGE 22y\n").replace(/(0 @F0001@ FAM\n)/, "$11 MARB\n2 DATE 19 APR 1885\n2 PLAC Týnec\n");
  const file = path.join(w.dir, "vek.ged");
  fs.writeFileSync(file, edited);
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /Antonín Dvořák \[P0001\] & Božena Nová \[P0002\]: sňatek 9\. 5\. 1885, Týnec — — → Antonín 28 let, Božena 22 let → doplní se k údaji/);
  assert.match(r.out, /nové — ohlášky 19\. 4\. 1885, Týnec → přidá se jako vodítko/);
  await w.ok(["sync", file, "--apply"]);
  const marr = () => Tree.open(w.cwd, w.env).get<Family>("F0001")!.events.find((e) => e.kind === "MARR")!;
  assert.deepEqual(marr().ages, { P0001: "28y", P0002: "22y" });
  await w.ok(["sync", "undo", "I1"]);
  assert.equal(marr().ages, undefined);
  // the app's JSON of data version 10: the couple's events and the partners' ages by its own ids
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  const app = {
    version: 10,
    research: { id },
    persons: {
      a: { id: "a", firstName: "Antonín", lastName: "Dvořák", gender: "male", refn: "P0001" },
      b: { id: "b", firstName: "Božena", lastName: "Nová", gender: "female", refn: "P0002" },
    },
    partnerships: {
      u: {
        person1Id: "a", person2Id: "b", childIds: [], status: "married", startDate: "1885-05-09", startPlace: "Týnec", ages: { a: "28 let" },
        events: [{ type: "residence", place: "Lhota", address: "čp. 12" }, { type: "banns", date: "1885-04-19", place: "Týnec" }, { type: "custom", customLabel: "Smlouva o výměnku", date: "1890" }],
      },
    },
  };
  const json = path.join(w.dir, "strom.json");
  fs.writeFileSync(json, JSON.stringify(app));
  const j = (await w.ok(["sync", json, "--json"])).json.changes.map((c: { kind: string; fact?: { kind: string; label?: string; ages?: Record<string, string> } }) => [c.kind, c.fact?.kind, c.fact?.label ?? c.fact?.ages?.P0001 ?? ""]);
  assert.deepEqual(j, [["fact.detail", "MARR", "28y"], ["fact.new", "MARB", ""], ["fact.new", "EVEN", "Smlouva o výměnku"]], JSON.stringify(j));
  w.cleanup();
});

test("a couple's other event the Strom app keeps in their note (its families have none) is not taken away", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Antonín /Dvořák/", "--sex", "M"]);
  await w.ok(["person", "add", "Božena /Nová/", "--sex", "F"]);
  await w.ok(["event", "add", "P1", "EVEN", "--label", "Požár stavení", "--date", "1890"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "9 MAY 1885"]);
  await w.ok(["event", "add", "F1", "EVEN", "--label", "Smlouva o výměnku"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const t = fs.readFileSync(ged, "utf8");
  // the app: the couple's event a line of their note
  const app = t.replace(/1 EVEN\r?\n2 TYPE Smlouva o výměnku\r?\n(?:[2-9].*\r?\n)*/, "1 NOTE Event: Smlouva o výměnku\n");
  assert.notEqual(app, t);
  fs.writeFileSync(path.join(w.dir, "z-aplikace.ged"), app);
  const r = await w.ok(["sync", path.join(w.dir, "z-aplikace.ged"), "--json"]);
  assert.deepEqual(r.json.changes, [], JSON.stringify(r.json.changes));
  w.cleanup();
});

test("a couple's note from the app (1 NOTE under FAM, the research's joined with it) is taken, and goes back where it came: the round trip brings nothing; the app's JSON too; a short note is a note", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "1885", "--place", "Kamenice"]);
  await w.ok(["note", "add", "F1", "Sňatek po trojích ohláškách."]);
  const ged = path.join(w.dir, "strom.ged");
  const fresh = async () => {
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
    return fs.readFileSync(ged, "utf8");
  };
  const t = await fresh();
  assert.match(t, /0 @F\d+@ FAM\r?\n(?:[1-9].*\r?\n)*1 NOTE Sňatek po trojích ohláškách\./);
  // the app joins what the couple has (the marriage's note too) into its one note and writes it under FAM, after MARR
  const joined = (s: string) => s.replace(/2 NOTE Vodítko — nedoloženo záznamem\.\r?\n(1 NOTE Sňatek po trojích ohláškách\.)/, "$1\n2 CONT Vodítko — nedoloženo záznamem.");
  const app = joined(t).replace("1 NOTE Sňatek po trojích ohláškách.\n2 CONT Vodítko — nedoloženo záznamem.", "1 NOTE Sňatek po trojích ohláškách.\n2 CONT Vodítko — nedoloženo záznamem.\n2 CONT Okno A beta.8").replace(/(1 REFN P0001\r?\n2 TYPE strom-research\r?\n)/, "$11 NOTE Okno B\n");
  fs.writeFileSync(path.join(w.dir, "z-aplikace.ged"), app);
  const r = (await w.ok(["sync", path.join(w.dir, "z-aplikace.ged"), "--apply", "--json"])).json;
  const notes = r.changes.filter((c: { kind: string }) => c.kind === "note.new").map((c: { family?: string; person?: string; text: string }) => [c.family ?? c.person, c.text]);
  assert.deepEqual(notes, [["P0001", "Okno B"], ["F0001", "Okno A beta.8"]], JSON.stringify(r.changes));
  const tree = Tree.open(w.cwd, w.env);
  assert.deepEqual(tree.get<Family>("F0001")!.notes.map((n) => n.text), ["Sňatek po trojích ohláškách.", "Okno A beta.8"]);
  // back in the tree for the app: under FAM, as it came — and nothing new when it is sent again
  const back = await fresh();
  assert.match(back, /0 @F\d+@ FAM\r?\n(?:[1-9].*\r?\n)*1 NOTE Okno A beta\.8\r?\n/);
  const again = joined(back).replace("Vodítko — nedoloženo záznamem.\n1 NOTE Okno A beta.8", "Vodítko — nedoloženo záznamem.\n2 CONT Okno A beta.8");
  assert.notEqual(again, back);
  for (const file of [back, again]) {
    fs.writeFileSync(path.join(w.dir, "znovu.ged"), file);
    assert.deepEqual((await w.ok(["sync", path.join(w.dir, "znovu.ged"), "--json"])).json.changes, []);
  }
  // the app's JSON: a partnership's note
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  const json = {
    version: 10,
    research: { id },
    persons: {
      a: { id: "a", firstName: "Josef", lastName: "Novák", gender: "male", refn: "P0001", refnType: "strom-research" },
      b: { id: "b", firstName: "Anna", lastName: "Dvořáková", gender: "female", refn: "P0002", refnType: "strom-research" },
    },
    partnerships: { u: { person1Id: "a", person2Id: "b", childIds: [], status: "married", startDate: "1885", startPlace: "Kamenice", note: "Sňatek po trojích ohláškách.\n\nOkno A beta.8\n\nOkno C — svatba v zimě" } },
  };
  fs.writeFileSync(path.join(w.dir, "strom.json"), JSON.stringify(json));
  const j = (await w.ok(["sync", path.join(w.dir, "strom.json"), "--json"])).json.changes.filter((c: { kind: string }) => c.kind === "note.new");
  assert.deepEqual(j.map((c: { family?: string; text: string }) => [c.family, c.text]), [["F0001", "Okno C — svatba v zimě"]]);
  w.cleanup();
});

test("the tree kept as the sync's document leaves out the images written into it (the research's own excerpts)", async () => {
  const { withoutImages } = await import("../../src/commands/sync.ts");
  const ged = "0 @S1@ SOUR\n1 OBJE\n2 FORM jpg\n2 FILE data:image/jpeg;base64,AAAA\n3 CONC BBBB\n3 CONC CCCC\n2 _URL https://archiv.example.org/1\n1 NOTE Přepis\n2 CONC dál\n";
  assert.equal(withoutImages(ged), "0 @S1@ SOUR\n1 OBJE\n2 FORM jpg\n2 FILE [image left out, 0 kB]\n2 _URL https://archiv.example.org/1\n1 NOTE Přepis\n2 CONC dál\n");
  assert.equal(withoutImages('{"excerpts":[{"dataUrl":"data:image/png;base64,QUJD","caption":"Křest"}]}'), '{"excerpts":[{"dataUrl":"[image left out, 0 kB]","caption":"Křest"}]}');
  assert.equal(withoutImages("1 FILE https://example.org/a.jpg\n"), "1 FILE https://example.org/a.jpg\n", "a file named by address stays");
});

test("places on the map: a position the user corrected or set in the app is taken (no record proves one), undone back; the Strom app's JSON too; without the state a difference only when picked", opts, async () => {
  const { w } = await world();
  await w.ok(["place", "add", "Kamenice", "--kind", "village", "--lat", "49.1", "--lon", "15.2"]); // L1
  await w.ok(["event", "add", "P3", "BIRT", "--date", "1890", "--place", "Týnec"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const given = fs.readFileSync(ged, "utf8");
  assert.match(given, /2 PLAC Kamenice\n3 MAP\n4 LATI N49\.1\n4 LONG E15\.2\n/);
  // in the app: Kamenice moved, Týnec found on the map (as the app writes them: six decimals)
  const moved = given.replace("4 LATI N49.1\n4 LONG E15.2", "4 LATI N49.366571\n4 LONG E15.041234").replace("2 PLAC Týnec\n", "2 PLAC Týnec\n3 MAP\n4 LATI N50.042\n4 LONG E15.358\n");
  const file = path.join(w.dir, "mapa.ged");
  fs.writeFileSync(file, moved);
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /1\. Kamenice: poloha na mapě 49\.1, 15\.2 → 49\.366571, 15\.041234 → výzkum převezme polohu z aplikace \(žádný zápis ji nedokládá\)/);
  assert.match(r.out, /2\. Týnec: poloha na mapě 50\.042, 15\.358 → výzkum převezme polohu z aplikace/);
  const done = await w.ok(["sync", file, "--apply"]);
  assert.match(done.out, /Zapsáno změn z mapa\.ged: 2 \(I0001\)/);
  const places = (await w.ok(["place", "list", "--json"])).json;
  const at = (name: string) => places.places.find((p: { names: { name: string }[] }) => p.names[0]!.name === name)?.coords;
  assert.deepEqual(at("Kamenice"), { lat: 49.366571, lon: 15.041234 });
  assert.deepEqual(at("Týnec"), { lat: 50.042, lon: 15.358 });
  assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, [], "the same file again: nothing");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  assert.match(fs.readFileSync(ged, "utf8"), /2 PLAC Týnec\n3 MAP\n4 LATI N50\.042\n4 LONG E15\.358\n/);
  assert.equal((await w.ok(["check"])).code, 0);
  // taken back: Kamenice where it was, Týnec withdrawn — off the map again
  await w.ok(["sync", "undo", "I1"]);
  const back = (await w.ok(["place", "list", "--json"])).json.places;
  assert.deepEqual(back.find((p: { id: string }) => p.id === "L0001").coords, { lat: 49.1, lon: 15.2 });
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  assert.doesNotMatch(fs.readFileSync(ged, "utf8"), /2 PLAC Týnec\n3 MAP/);
  // the Strom app's JSON: its coordinates by its own key of the place's name
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  const app = {
    research: { id },
    persons: { a: { id: "a", firstName: "Josef", lastName: "Novák", gender: "male", refn: "P0001", refnType: "strom-research", events: [{ type: "baptism", date: "1885-03-03", place: "Kamenice" }] } },
    partnerships: {},
    places: { kamenice: { lat: 49.2, lon: 15.1, label: "Kamenice, okres Jihlava" } },
  };
  fs.writeFileSync(path.join(w.dir, "strom.json"), JSON.stringify(app));
  const j = (await w.ok(["sync", path.join(w.dir, "strom.json"), "--json"])).json.changes.filter((c: { kind: string }) => c.kind === "place.coords");
  assert.deepEqual(j.map((c: { action: string; place: { name: string; lat: number } }) => [c.action, c.place.name, c.place.lat]), [["pick", "Kamenice", 49.2]], "no state of the research: a difference only when picked");
  w.cleanup();
});

test("the app's sources come in: an entry the user transcribed is a source of the research, its facts cite it — a lead until the research reads the record; a record the research read, read otherwise, kept beside it; undone back", opts, async () => {
  const { w, ged } = await world();
  const file = withSources(ged, path.join(w.dir, "z-aplikace.ged"));
  const shown = (await w.ok(["sync", file])).out;
  assert.match(shown, /pramen: „Křestní matrika Týnec 1905–1915“ → pramen výzkumu; přepis z aplikace je vodítko, dokud záznam nepřečte výzkum/);
  assert.match(shown, /Anna Dvořáková \[P0002\]: narození 1888 — pramen z aplikace k údaji → údaj výzkumu ho bude citovat \(vodítko/);
  assert.match(shown, /pramen výzkumu „Křest Josefa Nováka 1885“: v aplikaci přečtený jinak → uloží se vedle čtení výzkumu/);
  const done = (await w.ok(["sync", file, "--apply", "--json"])).json;
  const tree = Tree.open(w.cwd, w.env);
  const sources = tree.list<import("../../src/core/model.ts").Source>("source");
  const tyn = sources.find((s) => s.title === "Křestní matrika Týnec 1905–1915")!;
  assert.deepEqual(
    { kind: tyn.kind, locator: tyn.locator, date: tyn.date, transcript: tyn.transcript, form: tyn.form, information: tyn.information, app: tyn.app },
    { kind: "baptism", locator: "fol. 12", date: "7 MAY 1910", transcript: "Marie, dcera Josefa Nováka, rolníka v Týnci č. 5.", form: "original", information: "primary", app: { read: false } },
  );
  assert.equal(tree.get<import("../../src/core/model.ts").Repository>(tyn.repository!)?.name, "Státní oblastní archiv");
  const marie = tree.list<Person>("person").find((p) => p.names[0]?.given === "Marie")!;
  assert.deepEqual(marie.events.map((e) => [e.kind, e.status, e.citations.map((c) => [c.source, c.locator])]), [["BIRT", "lead", [[tyn.id, "fol. 12"]]]]);
  const anna = tree.get<Person>("P0002")!;
  const kam = sources.find((s) => s.title.startsWith("Křestní matrika Kamenice"))!;
  assert.deepEqual(anna.events.find((e) => e.kind === "BIRT")!.citations.map((c) => c.source), [kam.id]);
  assert.equal(anna.events.find((e) => e.kind === "BIRT")!.status, "lead");
  const s1 = tree.get<import("../../src/core/model.ts").Source>("S0001")!;
  assert.equal(s1.transcript, "Josef, syn Jana Nováka.", "the research's reading stays");
  assert.match(s1.notes.at(-1)!.text, /Uživatel přečetl tento záznam v aplikaci Strom jinak[\s\S]*Josef, syn Jana Nováka a Anny\./);
  // one task per person to read for the research what the user wrote
  const tasks = tree.list<import("../../src/core/model.ts").Task>("task").filter((t) => t.origin === "sync:verify");
  assert.deepEqual(tasks.map((t) => t.subject[0]).sort(), ["P0001", "P0002", marie.id].sort());
  assert.match(tasks.find((t) => t.subject[0] === "P0001")!.what, /Přečíst pro výzkum, co uživatel zapsal o osobě P0001 v aplikaci Strom: S0001/);
  assert.match((await w.ok(["check"])).out, /^ok/);

  // sent again before the app had the research's tree back: the same entries are the same sources, nothing twice
  const again = withSources(ged, path.join(w.dir, "z-aplikace-2.ged"), "1 _STROM_SENT v2-2\n");
  const second = (await w.ok(["sync", again])).out;
  assert.doesNotMatch(second, /pramen: „|v aplikaci přečtený jinak|pramen z aplikace k údaji/);

  // the sync's own source ("edits in the Strom app") stays the research's, but the app does not get it back: its own
  // tree cited at it, one more each send; other programs get it
  const syncSource = tree.get<import("../../src/core/model.ts").Input>(done.input)!.source!;
  const forApp = path.join(w.dir, "back.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", forApp]);
  assert.doesNotMatch(fs.readFileSync(forApp, "utf8"), new RegExp(`@${syncSource}@|Úpravy v aplikaci Strom`));
  assert.match(fs.readFileSync(forApp, "utf8"), new RegExp(`1 REFN ${tyn.id}`));
  const standard = path.join(w.dir, "standard.ged");
  await w.ok(["export", "gedcom", "--for", "standard", "--out", standard]);
  assert.match(fs.readFileSync(standard, "utf8"), new RegExp(`0 @${syncSource}@ SOUR`));
  // and what the app sends back without it is still nothing new
  assert.match((await w.ok(["sync", forApp])).out, /nic nového/);

  // undone: the sources, the archive, the tasks, the note — all withdrawn
  await w.ok(["sync", "undo", done.input]);
  assert.ok(Tree.open(w.cwd, w.env).get<import("../../src/core/model.ts").Source>(syncSource)!.retracted, "the sync's source cites nothing any more: withdrawn");
  const after = Tree.open(w.cwd, w.env);
  assert.ok(after.get<import("../../src/core/model.ts").Source>(tyn.id)!.retracted);
  assert.ok(after.get<import("../../src/core/model.ts").Repository>(tyn.repository!)!.retracted);
  assert.deepEqual(after.get<Person>("P0002")!.events.find((e) => e.kind === "BIRT")!.citations, []);
  assert.equal(after.get<import("../../src/core/model.ts").Source>("S0001")!.notes.length, s1.notes.length - 1);
  assert.ok(after.list<import("../../src/core/model.ts").Task>("task").filter((t) => t.origin === "sync:verify").every((t) => t.state === "dropped"));
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("the user's transcripts as evidence: a fact on a new entry is probable on their reading, a lead given their source becomes probable — no task to read it again; a transcript verified later raises its leads; who read it goes to the app", opts, async () => {
  const { w, ged } = await world();
  // evidence: the user's reading of the record counts
  const file = withSources(ged, path.join(w.dir, "z-aplikace.ged"), "1 _STROM_TRANSCRIPTS evidence\n");
  const shown = (await w.ok(["sync", file])).out;
  assert.match(shown, /pramen: „Křestní matrika Týnec 1905–1915“ → pramen výzkumu; přepis z aplikace platí jako čtení záznamu/);
  assert.match(shown, /nové — narození 5\. 5\. 1910, Týnec → přidá se na čtení záznamu z aplikace/);
  await w.ok(["sync", file, "--apply"]);
  let tree = Tree.open(w.cwd, w.env);
  const marie = tree.list<Person>("person").find((p) => p.names[0]?.given === "Marie")!;
  assert.equal(marie.events[0]!.status, "probable");
  assert.equal(tree.get<Person>("P0002")!.events.find((e) => e.kind === "BIRT")!.status, "probable", "the lead stands on the user's reading now");
  assert.deepEqual(tree.list<import("../../src/core/model.ts").Task>("task").filter((t) => t.origin === "sync:verify").map((t) => t.subject[0]), ["P0001"], "only the record the research read, read otherwise");

  // lead again, an entry of the app's: verified later, its leads become probable (the switch itself is never backwards)
  const { w: w2, ged: ged2 } = await world();
  const lead = withSources(ged2, path.join(w2.dir, "a.ged"));
  await w2.ok(["sync", lead, "--apply"]);
  // the app has the tree back (REFN of its sources) and ticks "transcript verified" on one
  const back = path.join(w2.dir, "back.ged");
  await w2.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", back]);
  tree = Tree.open(w2.cwd, w2.env);
  const tyn = tree.list<import("../../src/core/model.ts").Source>("source").find((s) => s.title === "Křestní matrika Týnec 1905–1915")!;
  const evidenceLater = path.join(w2.dir, "b.ged");
  fs.writeFileSync(evidenceLater, fs.readFileSync(back, "utf8").replace(new RegExp(`(1 REFN ${tyn.id}\\r?\\n)`), "$11 _STROM_VERIFIED Y\n").replace(/^(1 _STROM_HEAD .*\r?\n)/m, "$11 _STROM_TRANSCRIPTS evidence\n"));
  const v = (await w2.ok(["sync", evidenceLater])).out;
  assert.match(v, /pramen z aplikace „Křestní matrika Týnec 1905–1915“: přepis ověřen → čtení z aplikace platí/);
  assert.doesNotMatch(v, /Kamenice 1880–1890“: /, "the switch to evidence is not backwards: the other entry stays as it was");
  await w2.ok(["sync", evidenceLater, "--apply"]);
  tree = Tree.open(w2.cwd, w2.env);
  assert.equal(tree.list<Person>("person").find((p) => p.names[0]?.given === "Marie")!.events[0]!.status, "probable");
  assert.equal(tree.get<Person>("P0002")!.events.find((e) => e.kind === "BIRT")!.status, "lead", "its own entry was never verified");
  // who read it, to an app that shows it (its beta: at once)
  await w2.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  const out = path.join(w2.dir, "reads.ged");
  await w2.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  const text = fs.readFileSync(out, "utf8");
  assert.match(text, new RegExp(`1 REFN ${tyn.id}\\r?\\n1 _STROM_READ user\\r?\\n1 _STROM_VERIFIED Y`));
  const kam = tree.list<import("../../src/core/model.ts").Source>("source").find((s) => s.title.startsWith("Křestní matrika Kamenice"))!;
  assert.doesNotMatch(text, new RegExp(`1 REFN ${kam.id}\\r?\\n1 _STROM_READ`), "nobody read it: no mark");
  // stromapp.info: not until the app that reads it is out
  await w2.ok(["config", "unset", "strom.app.url"]);
  await w2.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  assert.doesNotMatch(fs.readFileSync(out, "utf8"), /_STROM_READ|_STROM_VERIFIED/);
  w.cleanup();
  w2.cleanup();
});

test("the Strom app's JSON brings its sources too: an entry with its transcript, cited by a birth", opts, async () => {
  const { w } = await world();
  const json = {
    persons: {
      a: { id: "a", firstName: "Josef", lastName: "Novák", gender: "male", refn: "P0001", refnType: "strom-research", partnerships: [], parentIds: [] },
      b: { id: "b", firstName: "Eva", lastName: "Nováková", gender: "female", birthDate: "1912-02-03", birthPlace: "Týnec", birthSourceIds: ["s1"], partnerships: [], parentIds: [] },
    },
    partnerships: {},
    sources: { s1: { id: "s1", title: "Křestní matrika Týnec 1905–1915", reference: "fol. 30", transcript: "Eva, dcera Josefa.", quality: 2, recordDate: "1912-02-05", transcriptVerified: true } },
  };
  const file = path.join(w.dir, "strom.json");
  fs.writeFileSync(file, JSON.stringify(json));
  await w.ok(["sync", file, "--apply"]);
  const tree = Tree.open(w.cwd, w.env);
  const s = tree.list<import("../../src/core/model.ts").Source>("source").find((x) => x.title.startsWith("Křestní matrika Týnec"))!;
  assert.deepEqual({ locator: s.locator, transcript: s.transcript, information: s.information, date: s.date, app: s.app }, { locator: "fol. 30", transcript: "Eva, dcera Josefa.", information: "secondary", date: "5 FEB 1912", app: { read: true, verified: true } });
  const eva = tree.list<Person>("person").find((p) => p.names[0]?.given === "Eva")!;
  assert.deepEqual(eva.events.map((e) => [e.kind, e.status, e.citations.map((c) => c.source)]), [["BIRT", "probable", [s.id]]]);
  w.cleanup();
});

test("a person the user wrote of from many sources of the app: one task to read them, its what short enough (the records by their IDs)", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  const title = (k: number) => `Záznam číslo ${k} – velmi dlouhý název pramene z aplikace Strom, Ministerialbok`;
  const ged = [
    "0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
    "0 @I1@ INDI", "1 NAME Johan /Berg/", "1 SEX M",
    ...["BIRT", "BAPM", "DEAT", "BURI", "EMIG"].flatMap((tag, k) => [`1 ${tag}`, `2 DATE ${1825 + k}`, `2 SOUR @S${k + 1}@`, "3 QUAY 3"]),
    ...[1, 2, 3, 4, 5].flatMap((k) => [`0 @S${k}@ SOUR`, `1 TITL ${title(k)}`, `1 PAGE s. ${k}`, `1 TEXT Johannes Bergh, přepis ${k}`]),
    "0 TRLR", "",
  ].join("\n");
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, ged);
  await w.ok(["sync", file, "--apply", "--force"]);
  const tasks = Tree.open(w.cwd, w.env).list<import("../../src/core/model.ts").Task>("task").filter((t) => t.origin === "sync:verify");
  assert.equal(tasks.length, 1);
  assert.ok(tasks[0]!.what.length <= 200, tasks[0]!.what);
  assert.equal(tasks[0]!.where.length, 5);
  assert.match(tasks[0]!.what, /o osobě P\d+ v aplikaci Strom: S\d+, S\d+, S\d+, S\d+, S\d+$/);
  w.cleanup();
});

test("a fact there may be more of, edited in the app (an occupation, a residence): an edit of the one given, paired by what it shares — never one more beside it; unclear: additions", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F"]);
  await w.ok(["event", "add", "P1", "OCCU", "--value", "švadlena"]);
  await w.ok(["event", "add", "P1", "RESI", "--date", "1880", "--place", "Kamenice"]);
  await w.ok(["event", "add", "P1", "RESI", "--date", "1890", "--place", "Týnec"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const t = fs.readFileSync(ged, "utf8");
  const send = async (text: string) => {
    fs.writeFileSync(path.join(w.dir, "z-aplikace.ged"), text);
    return ((await w.ok(["sync", path.join(w.dir, "z-aplikace.ged"), "--json"])).json.changes as { kind: string; action: string; fact?: { kind: string; value?: string; place?: string }; was?: { value?: string; place?: string } }[]).map((c) => [c.kind, c.action, c.fact?.value ?? c.fact?.place ?? "", c.was?.value ?? c.was?.place ?? ""]);
  };
  // the occupation rewritten; the residence of 1890 moved to another place (its year the same)
  assert.deepEqual(await send(t.replace("1 OCCU švadlena", "1 OCCU pradlena").replace("2 PLAC Týnec", "2 PLAC Lhota")), [
    ["fact.changed", "correct", "pradlena", "švadlena"],
    ["fact.changed", "correct", "Lhota", "Týnec"],
  ]);
  // one occupation gone, two new: which one it was is not clear — both added, the one given said gone
  assert.deepEqual(await send(t.replace("1 OCCU švadlena", "1 OCCU pradlena\n1 OCCU kuchařka")), [
    ["fact.new", "add", "pradlena", ""],
    ["fact.new", "add", "kuchařka", ""],
    ["fact.gone", "report", "", "švadlena"],
  ]);
  w.cleanup();
});

test("a line of a note the user edited in the app (a year changed) comes in: the user's own note corrected, a session's kept with the user's line beside it, a like line added beside its own; a copy older than the edit sets nothing back; undone back (N38)", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F"]); // P1
  await w.ok(["person", "add", "Иван /Петров/", "--sex", "M"]); // P2
  await w.ok(["note", "add", "P1", "Pokřtěna v Týnci roku 1875, kmotr Jan Malý.\nkontrola 09:02:19"]);
  await w.ok(["session", "start"]);
  await w.ok(["note", "add", "P2", "Крещён в 1871 году, крёстный Пётр."]);
  await w.ok(["session", "close", "--summary", "Poznámka", "--next", "nic"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const given = fs.readFileSync(ged, "utf8");
  // in the app: the year corrected (the app sends it decomposed), a like line written under the other, the session's year corrected
  const app = given
    .replace("Pokřtěna v Týnci roku 1875, kmotr Jan Malý.", "Pokřtěna v Týnci roku 1876, kmotr Jan Malý.".normalize("NFD"))
    .replace("2 CONT kontrola 09:02:19", "2 CONT kontrola 09:02:19\n2 CONT kontrola 09:02:37")
    .replace("в 1871 году", "в 1872 году");
  assert.notEqual(app, given);
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, app);
  const shown = await w.ok(["sync", file]);
  assert.match(shown.out, /Anna Dvořáková \[P0001\]: poznámka — „Pokřtěna v Týnci roku 1875, kmotr Jan Malý\.“ → „Pokřtěna v Týnci roku 1876, kmotr Jan Malý\.“ → ten řádek poznámky výzkumu se opraví/, shown.out);
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(
    r.changes.map((c: { kind: string; action: string; person?: string; text: string }) => [c.kind, c.action, c.person, c.text]),
    [
      ["note.changed", "correct", "P0001", "Pokřtěna v Týnci roku 1876, kmotr Jan Malý."],
      ["note.new", "add", "P0001", "kontrola 09:02:37"],
      ["note.new", "add", "P0002", "Крещён в 1872 году, крёстный Пётр."],
    ],
    JSON.stringify(r.changes),
  );
  const notes = (id: string) => Tree.open(w.cwd, w.env).get<Person>(id)!.notes.map((n) => n.text);
  assert.deepEqual(notes("P0001"), ["Pokřtěna v Týnci roku 1876, kmotr Jan Malý.\nkontrola 09:02:19", "kontrola 09:02:37"]);
  assert.deepEqual(notes("P0002"), ["Крещён в 1871 году, крёстный Пётр.", "Крещён в 1872 году, крёстный Пётр."], "the session's note stays as the research wrote it");
  // sent again, and a copy of the app made before the edit: nothing — the year is not set back
  fs.writeFileSync(path.join(w.dir, "znovu.ged"), app);
  assert.deepEqual((await w.ok(["sync", path.join(w.dir, "znovu.ged"), "--json"])).json.changes, []);
  fs.writeFileSync(path.join(w.dir, "stara.ged"), given);
  assert.deepEqual((await w.ok(["sync", path.join(w.dir, "stara.ged"), "--json"])).json.changes, []);
  // the history says it in the research's language
  const { history } = await import("../../src/core/live.ts");
  const tree = Tree.open(w.cwd, w.env);
  const said = history(tree.root, tree)[0]!;
  assert.ok(said.text.includes("Opravená poznámka: Anna Dvořáková [P0001]"), JSON.stringify(said));
  await w.ok(["sync", "undo", r.input]);
  assert.deepEqual(notes("P0001"), ["Pokřtěna v Týnci roku 1875, kmotr Jan Malý.\nkontrola 09:02:19"]);
  assert.deepEqual(notes("P0002"), ["Крещён в 1871 году, крёстный Пётр."]);
  w.cleanup();
});

test("a copy of the family tree that names no commit (an older export, another program's) sets no line of a note back: an edit of a line only shown, taken with --only (N39)", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F"]); // P1
  await w.ok(["person", "add", "Иван /Петров/", "--sex", "M"]); // P2
  await w.ok(["note", "add", "P1", "Pokřtěna v Týnci roku 1876, kmotr Jan Malý."]);
  await w.ok(["session", "start"]);
  await w.ok(["note", "add", "P2", "Крещён в 1872 году, крёстный Пётр."]);
  await w.ok(["session", "close", "--summary", "Poznámka", "--next", "nic"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  // the copy as it was before the user's corrections, with no commit it stands on
  const old = fs
    .readFileSync(ged, "utf8")
    .replace(/^1 _STROM_(HEAD|SINCE) .*\r?\n/gm, "")
    .replace("roku 1876", "roku 1875".normalize("NFD"))
    .replace("в 1872 году", "в 1871 году");
  assert.doesNotMatch(old, /_STROM_HEAD/);
  const file = path.join(w.dir, "stara-kopie.ged");
  fs.writeFileSync(file, old);
  const notes = (id: string) => Tree.open(w.cwd, w.env).get<Person>(id)!.notes.map((n) => n.text);
  const shown = await w.ok(["sync", file]);
  assert.match(shown.out, /Anna Dvořáková \[P0001\]: poznámka — „Pokřtěna v Týnci roku 1876, kmotr Jan Malý\.“ → „Pokřtěna v Týnci roku 1875, kmotr Jan Malý\.“ → jen po výběru \(--only\)/, shown.out);
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(
    r.changes.map((c: { kind: string; action: string; person?: string }) => [c.kind, c.action, c.person]),
    [
      ["note.changed", "pick", "P0001"],
      ["note.changed", "pick", "P0002"],
    ],
    JSON.stringify(r.changes),
  );
  assert.deepEqual(notes("P0001"), ["Pokřtěna v Týnci roku 1876, kmotr Jan Malý."], "the user's correction stays");
  assert.deepEqual(notes("P0002"), ["Крещён в 1872 году, крёстный Пётр."], "nothing added beside the session's note");
  // picked by the user: taken
  const n = r.changes[0].n;
  await w.ok(["sync", file, "--apply", "--only", String(n)]);
  assert.deepEqual(notes("P0001"), ["Pokřtěna v Týnci roku 1875, kmotr Jan Malý."]);
  w.cleanup();
});

test("a short note the user adds in the app comes in though it names the person or repeats a word the research has (B-2); the app's own shape of what the research said still does not", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Vojtěch /Novák/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Kim /Nováková/", "--sex", "F"]); // P2
  await w.ok(["event", "add", "P2", "CHR", "--date", "1932", "--place", "Týnec"]);
  await w.ok(["note", "add", "P2", "Kim, zapsána 1932."]);
  await w.ok(["person", "add", "Иван /Петров/", "--sex", "M"]); // P3
  await w.ok(["person", "add", "Marie /Malá/", "--sex", "F"]); // P4
  await w.ok(["family", "add", "--partner", "P3", "--partner", "P4"]); // F1
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const given = fs.readFileSync(ged, "utf8");
  // in the app: a note naming the person (sent decomposed), a line beside the research's note with the app's own
  // shape of its place, a note in another script, a couple's note naming both partners
  const app = given
    .replace(/(1 REFN P0001\r?\n2 TYPE strom-research\r?\n)/, `$11 NOTE ${"Vojtěch CLI".normalize("NFD")}\n`)
    .replace("1 NOTE Kim, zapsána 1932.", "1 NOTE Kim, zapsána 1932.\n2 CONT Kim z matriky\n2 CONT Narození: Týnec")
    .replace(/(1 REFN P0003\r?\n2 TYPE strom-research\r?\n)/, "$11 NOTE Иван звонил\n")
    .replace(/(0 @[^@]+@ FAM\r?\n)/, "$11 NOTE Иван a Marie 1900\n");
  assert.notEqual(app, given);
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, app);
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(
    r.changes.map((c: { kind: string; person?: string; family?: string; text: string }) => [c.kind, c.person ?? c.family, c.text.normalize("NFC")]),
    [
      ["note.new", "P0001", "Vojtěch CLI"],
      ["note.new", "P0002", "Kim z matriky"],
      ["note.new", "P0003", "Иван звонил"],
      ["note.new", "F0001", "Иван a Marie 1900"],
    ],
    JSON.stringify(r.changes),
  );
  const tree = Tree.open(w.cwd, w.env);
  assert.deepEqual(tree.get<Person>("P0001")!.notes.map((n) => n.text), ["Vojtěch CLI"]);
  assert.deepEqual(tree.get<Person>("P0002")!.notes.map((n) => n.text), ["Kim, zapsána 1932.", "Kim z matriky"]);
  assert.deepEqual(tree.get<Family>("F0001")!.notes.map((n) => n.text), ["Иван a Marie 1900"]);
  // sent again, and the copy as the app was given it: nothing
  fs.writeFileSync(path.join(w.dir, "znovu.ged"), app);
  assert.deepEqual((await w.ok(["sync", path.join(w.dir, "znovu.ged"), "--json"])).json.changes, []);
  fs.writeFileSync(path.join(w.dir, "puvodni.ged"), given);
  assert.deepEqual((await w.ok(["sync", path.join(w.dir, "puvodni.ged"), "--json"])).json.changes, []);
  w.cleanup();
});
