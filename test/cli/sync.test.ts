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
import type { Family, Person } from "../../src/core/model.ts";
import { opts, world, edited, post, get, marked, withSources } from "./sync.helpers.ts";

test("the export for the Strom app names the research and its state; persons carry whose IDs they are", opts, async () => {
  const { w, ged } = await world();
  const t = fs.readFileSync(ged, "utf8");
  const head = (await w.ok(["history", "--json"])).json;
  assert.match(t, /^1 _STROM_TREE [0-9a-f-]{36}$/m);
  assert.match(t, /^1 _STROM_HEAD [0-9a-f]{40}$/m);
  assert.match(t, /^1 REFN P0001\r?\n2 TYPE strom-research$/m);
  assert.ok(head);
  w.cleanup();
});

test("sync: shown first; the user's edits against what the research gave — a conflict for a record's fact, a lead corrected, additions as leads, a removal only said", opts, async () => {
  const { w, ged } = await world();
  // the research goes on after the export: a fact the app never saw is not the user removing it
  await w.ok(["event", "add", "P1", "OCCU", "--value", "mlynář"]);
  const file = edited(ged, path.join(w.dir, "z-aplikace.ged"));
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /^z-aplikace\.ged: změn proti výzkumu: 8\nPorovnáno s tím, co výzkum dal aplikaci Strom/);
  assert.match(r.out, /Josef Novák \[P0001\]: křest změněno — 3\. 3\. 1885, Kamenice → 4\. 3\. 1885, Kamenice → rozpor k rozhodnutí/);
  assert.match(r.out, /Anna Dvořáková \[P0002\]: narození změněno — 1888 → 1889 → opraví vodítko výzkumu/);
  assert.match(r.out, /Anna Dvořáková \[P0002\]: nové — úmrtí 1960, Týnec → přidá se jako vodítko/);
  assert.match(r.out, /Anna Dvořáková \[P0002\]: poznámka — „Babička pekla buchty\.“/);
  assert.match(r.out, /nová osoba: Marie \/Nováková\/|nová osoba: Marie Nováková/);
  assert.match(r.out, /Josef Novák \[P0001\] & Anna Dvořáková \[P0002\]: dítě — Marie Nováková/);
  assert.match(r.out, /už v něm není: Karel \/Novák\/ → nic se nemění|už v něm není: Karel Novák/);
  assert.doesNotMatch(r.out, /mlynář/, "what the research added since is not taken for a removal");
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3, "only shown");

  const done = await w.ok(["sync", file, "--apply"]);
  assert.match(done.out, /Zapsáno změn z z-aplikace\.ged: 7 \(I0001\) — vrátit: strom sync undo I0001/);
  const p1 = (await w.ok(["person", "show", "P1"])).out;
  assert.match(p1, /CHR\s+3 MAR 1885\s+Kamenice\s+\[probable\]/, "the record's fact stays");
  assert.match((await w.ok(["conflict", "list"])).out, /X0001\s+otevřený\s+Josef Novák: Křest — 3\. 3\. 1885, Kamenice × 4\. 3\. 1885, Kam/);
  const p2 = (await w.ok(["person", "show", "P2"])).out;
  assert.match(p2, /BIRT\s+1889\s+\[lead\]/);
  assert.match(p2, /DEAT\s+1960\s+Týnec\s+\[lead\]/);
  assert.match(p2, /Babička pekla buchty\./);
  assert.match((await w.ok(["family", "show", "F1"])).out, /P0004 Marie Nováková/);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 4, "Karel is not deleted");
  assert.match((await w.ok(["check"])).out, /^ok/);

  // the same file again: said, nothing twice even with --again
  assert.match((await w.ok(["sync", file])).out, /Tento soubor výzkum už načetl \(I0001\)/);
  const again = await w.ok(["sync", file, "--again"]);
  assert.doesNotMatch(again.out, /\d\. .*(nová osoba|→ rozpor k rozhodnutí|nové —|poznámka)/);

  // undone: as before, each step with its reason
  const undo = await w.ok(["sync", "undo", "I1"]);
  assert.match(undo.out, /Synchronizace I0001 vrácena/);
  assert.match((await w.ok(["person", "show", "P2"])).out, /BIRT\s+1888\s+\[lead\]/);
  assert.match((await w.ok(["person", "show", "P2"])).out, /DEAT\s+1960\s+Týnec\s+\[retracted\]/);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3, "the new person withdrawn");
  assert.match((await w.ok(["conflict", "list", "--all", "--json"])).out, /"resolved"/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  assert.match((await w.ok(["sync", "undo", "I1"])).out, /už vrácená/);
  w.cleanup();
});

test("sync.edits user: the user's edit wins — the record's fact withdrawn with the reason, the edit a possible fact; undone back", opts, async () => {
  const { w, ged } = await world();
  const file = edited(ged, path.join(w.dir, "z-aplikace.ged"));
  await w.ok(["config", "set", "sync.edits", "user"], { tty: true });
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /křest změněno — .* → platí úprava z aplikace/);
  await w.ok(["sync", file, "--apply", "--only", "1"]);
  const p1 = (await w.ok(["person", "show", "P1"])).out;
  assert.match(p1, /CHR\s+3 MAR 1885\s+Kamenice\s+\[retracted\].*the user's edit wins/);
  assert.match(p1, /(CHR|BAPM)\s+4 MAR 1885\s+Kamenice\s+\[possible\]/);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3, "--only 1: nothing else");
  await w.ok(["sync", "undo", "I1"]);
  assert.match((await w.ok(["person", "show", "P1"])).out, /CHR\s+3 MAR 1885\s+Kamenice\s+\[probable\]/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a wrong file is refused before anything: empty, unreadable, another research, a tree of few of our people; without the state only additions", opts, async () => {
  const { w, ged } = await world();
  const f = (name: string, text: string) => {
    const p = path.join(w.dir, name);
    fs.writeFileSync(p, text);
    return p;
  };
  const t = fs.readFileSync(edited(ged, path.join(w.dir, "e.ged")), "utf8");
  // the person reads it in the research's language (Czech here), a program the English and its code
  const refused = async (file: string, why: RegExp, said: RegExp, code: string) => {
    const r = await w.run(["sync", file]);
    assert.equal(r.code, 2, file);
    assert.match(r.err, said);
    const j = await w.run(["sync", file, "--json"]);
    assert.match(j.json.message, why);
    assert.equal(j.json.code, code);
  };
  await refused(f("empty.ged", ""), /empty\.ged is empty/, /soubor je prázdný/, "tree.empty");
  await refused(f("broken.json", '{"persons": '), /not readable JSON/, /není soubor GEDCOM ani rodokmen z aplikace Strom/, "tree.unreadable");
  await refused(f("nic.json", '{"persons": {}, "partnerships": {}}'), /has no people in it/, /nejsou v něm žádné osoby\n→ soubor vyexportovaný z aplikace Strom/, "tree.empty");
  await refused(f("text.txt", "hello"), /neither a GEDCOM file nor a family tree/, /není soubor GEDCOM/, "tree.unreadable");
  await refused(f("other.ged", t.replace(/^1 _STROM_TREE .*$/m, "1 _STROM_TREE 11111111-2222-3333-4444-555555555555")), /of another research/, /patří jinému výzkumu \(11111111-2222-3333-4444-555555555555\)/, "tree.other-research");
  await refused(f("cizi.ged", t.replace(/^1 _STROM_(TREE|HEAD) .*\r?\n/gm, "").replace(/1 REFN P0/g, "1 REFN X0")), /does not look like the family tree of/, /nevypadá jako rodokmen výzkumu/, "tree.foreign");
  assert.equal((await w.ok(["input", "list", "--json"])).json.total ?? 0, 0, "nothing registered");
  // without the state it came from: additions taken, differences only shown
  const bare = await w.ok(["sync", f("bez.ged", t.replace(/^1 _STROM_HEAD .*\r?\n/m, ""))]);
  assert.match(bare.out, /Soubor neříká, ze které verze výzkumu je/);
  assert.match(bare.out, /křest se liší — výzkum 3\. 3\. 1885, Kamenice, soubor 4\. 3\. 1885, Kamenice → jen po výběru \(--only\)/);
  assert.doesNotMatch(bare.out, /už v něm není/, "no removal without the state it was given");
  await w.ok(["sync", path.join(w.dir, "bez.ged"), "--apply"]);
  assert.match((await w.ok(["person", "show", "P1"])).out, /CHR\s+3 MAR 1885/);
  assert.equal((await w.ok(["conflict", "list", "--json"])).json.total ?? 0, 0);
  w.cleanup();
});

test("the Strom app's JSON: its people by their REFN, its placeholders nobody, occupations from the note", opts, async () => {
  const { w } = await world();
  const tree = (await w.ok(["status", "--json"])).json;
  const id = tree.tree?.id ?? JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  const app = {
    version: 7,
    research: { id },
    persons: {
      a: { id: "a", firstName: "Josef", lastName: "Novák", gender: "male", refn: "P0001", refnType: "strom-research", events: [{ type: "baptism", date: "1885-03-03", place: "Kamenice" }, { type: "occupation", note: "mlynář\nvíc o tom" }] },
      b: { id: "b", firstName: "Anna", lastName: "Dvořáková", gender: "female", refn: "P0002", birthDate: "1888" },
      c: { id: "c", firstName: "Karel", lastName: "Novák", gender: "male", refn: "P0003" },
      d: { id: "d", firstName: "", lastName: "", gender: "male", isPlaceholder: true },
    },
    partnerships: { u: { person1Id: "a", person2Id: "b", childIds: [], status: "married" }, v: { person1Id: "d", person2Id: "b", childIds: ["c"], status: "married" } },
  };
  const file = path.join(w.dir, "strom.json");
  fs.writeFileSync(file, JSON.stringify(app));
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /Josef Novák \[P0001\]: nové — povolání mlynář → přidá se jako vodítko/);
  assert.doesNotMatch(r.out, /nová osoba|křest/, "the placeholder is nobody; the baptism is known");
  w.cleanup();
});

test("the menu: take in the edits from a file — shown, then written on the person's word", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ged } = await world();
  const file = edited(ged, path.join(w.dir, "z-aplikace.ged"));
  // 4 add to the research · 4 edits from the Strom app · 2 from a file · the file · 1 all · Enter · 0 · 0
  const menu = await w.run(["menu"], { tty: true, answers: ["4", "4", "2", file, "1", "", "0", "0"] });
  assert.match(menu.out, /Odkud\?\n   1  Přímo z aplikace Strom \(pošle strom sama\)\n   2  Ze souboru \(\.ged, \.json\)/);
  assert.match(menu.out, /Načíst úpravy z aplikace Strom nebo z jiného rodokmenu \(\.ged, \.json\)/);
  assert.match(menu.out, /z-aplikace\.ged: změn proti výzkumu: 8/);
  assert.match(menu.out, /Zapsáno změn z z-aplikace\.ged: 7/);
  assert.match(menu.out, /Otevřít výzkum znovu v aplikaci Strom/);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 4);
  w.cleanup();
});

test("sync: what only adds to a record's fact (a place it lacks, a day of its year) is added to it citing the user's tree — a conflict only where the record says otherwise; undone, it is put back", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křest Josefa Nováka 1885", "--kind", "baptism", "--transcript", "Josef, syn Jana Nováka."]); // S1
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P1
  await w.ok(["event", "add", "P1", "BIRT", "--date", "1885", "--cite", "S1"]); // E1: a year, no place
  await w.ok(["event", "add", "P1", "CHR", "--date", "MAR 1885", "--place", "Kamenice", "--cite", "S1"]); // E2
  await w.ok(["event", "add", "P1", "DEAT", "--date", "ABT 1950", "--cite", "S1"]); // E3
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  let t = fs.readFileSync(ged, "utf8");
  t = t.replace(/(1 BIRT\r?\n2 DATE )1885\r?\n/, "$12 MAR 1885\n2 PLAC Kamenice\n"); // a day of the year, and the place
  t = t.replace(/(1 CHR\r?\n2 DATE )MAR 1885(\r?\n2 PLAC )Kamenice/, "$13 MAR 1885$2Kamenice, Čechy"); // more exact, both
  t = t.replace(/(1 DEAT\r?\n2 DATE )ABT 1950/, "$112 MAY 1950"); // a day of the year it was about
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, t);
  const shown = await w.ok(["sync", file]);
  assert.match(shown.out, /narození změněno — 1885 → 2\. 3\. 1885, Kamenice → doplní se k údaji s odkazem na strom z aplikace \(záznamu nic neodporuje\)/);
  assert.doesNotMatch(shown.out, /→ rozpor k rozhodnutí/);
  const done = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(done.conflicts, []);
  assert.match((await w.ok(["conflict", "list"])).out, /^(?!.*X0001)/s);
  const card = (await w.ok(["person", "show", "P1", "--json"])).json.person;
  const birth = card.events.find((e: { kind: string }) => e.kind === "BIRT");
  assert.equal(birth.date, "2 MAR 1885");
  assert.equal(birth.place, "Kamenice");
  assert.equal(birth.status, "probable", "still the record's");
  assert.ok(birth.citations.some((c: { source: string; locator?: string }) => c.source !== "S0001" && /BIRT DATE PLAC/.test(c.locator ?? "")), JSON.stringify(birth.citations));
  assert.equal(card.events.find((e: { kind: string }) => e.kind === "CHR").place, "Kamenice, Čechy");
  assert.equal(card.events.find((e: { kind: string }) => e.kind === "DEAT").date, "12 MAY 1950");
  // another year is not an addition: a conflict
  const again = path.join(w.dir, "z-aplikace-2.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  fs.writeFileSync(again, fs.readFileSync(ged, "utf8").replace(/(1 BIRT\r?\n2 DATE )2 MAR 1885/, "$12 MAR 1886"));
  assert.match((await w.ok(["sync", again])).out, /narození změněno — 2\. 3\. 1885, Kamenice → 2\. 3\. 1886, Kamenice → rozpor k rozhodnutí/);
  // undone: put back as the record had it
  await w.ok(["sync", "undo", done.input]);
  const back = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.find((e: { kind: string }) => e.kind === "BIRT");
  assert.equal(back.date, "1885");
  assert.ok(!back.place);
  assert.deepEqual(back.citations.map((c: { source: string }) => c.source), ["S0001"]);
  assert.equal((await w.ok(["check"])).code, 0);
  w.cleanup();
});

test("godparents and witnesses come and go both ways: one more added to the record's fact citing the user's tree, a role changed a conflict for a record's fact and corrected for a lead, the app's own shapes no edit; the person's and a new couple's sources taken; undone back", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křest Josefa Nováka 1885", "--kind", "baptism", "--transcript", "Josef, syn Jana Nováka."]); // S1
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P1
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Kamenice", "--cite", "S1", "--with", "godparent:Marie Dvořáková", "--with", "midwife:Ludmila Králová"]); // E1, probable
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F", "--born", "1888"]); // P2
  await w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]); // P3
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  await w.ok(["event", "add", "F1", "MARR", "--date", "1909", "--place", "Týnec", "--with", "witness:Jan Kos"]); // a lead
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  let t = fs.readFileSync(ged, "utf8");
  assert.match(t, /2 _WITN Marie Dvořáková\r?\n3 RELA Godparent/, "the research's go to the app");
  assert.match((await w.ok(["sync", ged])).out, /nic nového/, "as it was given: nothing");
  // what the app does with them: a role it has no name for is "Present" with the word in the note
  t = t.replace("3 RELA Midwife", "3 RELA Present\n3 NOTE Midwife");
  // the user: one more godparent, Marie a witness, at the wedding the officiant and Karel a witness
  t = t.replace("3 RELA Godparent", "3 RELA Witness\n2 _WITN Josef Kos\n3 RELA Godparent\n3 NOTE soused");
  t = t.replace(/(2 _WITN Jan Kos\r?\n3 RELA )Witness/, "$1Officiant\n2 ASSO @P0003@\n3 RELA Witness");
  // a census entry the user transcribed, cited by Anna herself; Karel married in the app, with its witness and source
  t = t.replace(/(1 REFN P0002\r?\n2 TYPE strom-research\r?\n)/, "$11 SOUR @X9@\n2 PAGE fol. 12\n");
  t = t.replace(/(1 REFN P0003\r?\n2 TYPE strom-research\r?\n)/, "$11 FAMS @X8@\n");
  t = t.replace(/(0 @S0001@ SOUR)/, "0 @X2@ INDI\n1 NAME Božena /Malá/\n1 SEX F\n1 FAMS @X8@\n0 @X8@ FAM\n1 HUSB @P0003@\n1 WIFE @X2@\n1 MARR\n2 DATE 1935\n2 PLAC Praha\n2 _WITN Petr Malý\n3 RELA Witness\n2 SOUR @X9@\n3 PAGE fol. 40\n0 @X9@ SOUR\n1 TITL Sčítání lidu 1921, Týnec\n1 TEXT Anna Dvořáková, nar. 1888.\n$1");
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, t);
  const shown = (await w.ok(["sync", file])).out;
  assert.doesNotMatch(shown, /Ludmila/, "the app's way of keeping a midwife is no edit");
  assert.match(shown, /Josef Novák \[P0001\]: křest 3\. 3\. 1885, Kamenice — kmotr\/kmotra: Josef Kos → doplní se k údaji s odkazem na strom z aplikace/);
  assert.match(shown, /Josef Novák \[P0001\]: křest 3\. 3\. 1885, Kamenice — Marie Dvořáková: kmotr\/kmotra → svědek → rozpor k rozhodnutí/);
  assert.match(shown, /sňatek 1909, Týnec — Jan Kos: svědek → oddávající\/křtící → opraví vodítko výzkumu/);
  assert.match(shown, /sňatek 1909, Týnec — svědek: Karel Novák \[P0003\] → doplní se k údaji/);
  assert.match(shown, /Anna Dvořáková \[P0002\]: pramen z aplikace k osobě — „Sčítání lidu 1921, Týnec“/);
  assert.match(shown, /nová rodina: Karel Novák \[P0003\] & Božena/);
  assert.match(shown, /Karel Novák \[P0003\] & Božena Malá: nové — sňatek 1935, Praha/);

  const done = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.equal(done.conflicts.length, 1, JSON.stringify(done.conflicts));
  assert.equal(done.conflicts[0].person, "P0001");
  const chr = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.find((e: { kind: string }) => e.kind === "CHR");
  assert.equal(chr.status, "probable", "the record's fact stays");
  assert.deepEqual(
    chr.participants.map((p: { role: string; name?: string; person?: string }) => `${p.role}:${p.name ?? p.person}`),
    ["godparent:Marie Dvořáková", "midwife:Ludmila Králová", "godparent:Josef Kos"],
  );
  assert.equal(chr.participants[2].note, "soused");
  assert.ok(chr.citations.some((c: { source: string; locator?: string }) => c.source !== "S0001" && /CHR godparent/.test(c.locator ?? "")), JSON.stringify(chr.citations));
  const fam = (await w.ok(["family", "show", "F1", "--json"])).json.family;
  const marr = fam.events.find((e: { kind: string }) => e.kind === "MARR");
  assert.deepEqual(
    marr.participants.map((p: { role: string; name?: string; person?: string }) => `${p.role}:${p.name ?? p.person}`),
    ["officiant:Jan Kos", "witness:P0003"],
  );
  const anna = (await w.ok(["person", "show", "P2", "--json"])).json.person;
  const census = anna.names[0].citations.find((c: { source: string }) => c.source !== done.source);
  assert.ok(census, JSON.stringify(anna.names[0]));
  assert.equal(census.locator, "fol. 12");
  const kf = (await w.ok(["family", "show", "F2", "--json"])).json.family;
  assert.ok(kf.partners.includes("P0003"));
  const km = kf.events.find((e: { kind: string }) => e.kind === "MARR");
  assert.equal(km.date, "1935");
  assert.deepEqual(km.participants, [{ role: "witness", name: "Petr Malý" }]);
  assert.deepEqual(km.citations.map((c: { source: string; locator?: string }) => c.source), [census.source], "the couple's marriage cites the user's source, not the sync");
  // the same again: nothing new
  assert.match((await w.ok(["sync", file, "--again"])).out, /nic nového/);
  assert.equal((await w.ok(["check"])).code, 0);

  // undone: as it was
  await w.ok(["sync", "undo", done.input]);
  const back = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.find((e: { kind: string }) => e.kind === "CHR");
  assert.deepEqual(back.participants.map((p: { name: string }) => p.name), ["Marie Dvořáková", "Ludmila Králová"]);
  assert.deepEqual(back.citations.map((c: { source: string }) => c.source), ["S0001"]);
  const fam2 = (await w.ok(["family", "show", "F1", "--json"])).json.family;
  assert.deepEqual(fam2.events.find((e: { kind: string }) => e.kind === "MARR").participants, [{ role: "witness", name: "Jan Kos" }]);
  assert.ok(!(await w.ok(["person", "show", "P2", "--json"])).json.person.names[0].citations?.some((c: { source: string }) => c.source === census.source));
  assert.equal((await w.ok(["check"])).code, 0);
  w.cleanup();
});

test("the Strom app's JSON brings who is at an event too: the godparents of its entry of a birth are the birth's, a wedding's witnesses the marriage's", opts, async () => {
  const { w } = await world();
  await w.ok(["event", "edit", "E1", "--with", "godparent:Marie Dvořáková"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  const app = {
    version: 10,
    research: { id },
    persons: {
      a: {
        id: "a", firstName: "Josef", lastName: "Novák", gender: "male", refn: "P0001", refnType: "strom-research",
        events: [{ type: "baptism", date: "1885-03-03", place: "Kamenice", participants: [{ id: "q1", role: "godparent", name: "Marie Dvořáková" }, { id: "q2", role: "godparent", personId: "c" }] }],
      },
      b: {
        id: "b", firstName: "Anna", lastName: "Dvořáková", gender: "female", refn: "P0002", birthDate: "1888",
        events: [{ type: "custom", customLabel: "Zápis o narození", date: "1888", participants: [{ id: "q3", role: "other", name: "Ludmila Králová", note: "Midwife — z Týnce" }] }],
      },
      c: { id: "c", firstName: "Karel", lastName: "Novák", gender: "male", refn: "P0003" },
    },
    partnerships: { u: { person1Id: "a", person2Id: "b", childIds: [], status: "married", participants: [{ id: "q4", role: "witness", name: "Jan Kos" }] } },
  };
  const file = path.join(w.dir, "strom.json");
  fs.writeFileSync(file, JSON.stringify(app));
  const r = (await w.ok(["sync", file])).out;
  assert.doesNotMatch(r, /Marie/, "the research has her");
  assert.match(r, /Josef Novák \[P0001\]: křest 3\. 3\. 1885, Kamenice — kmotr\/kmotra: Karel Novák \[P0003\]/);
  assert.match(r, /Anna Dvořáková \[P0002\]: narození 1888 — porodní bába: Ludmila Králová/);
  assert.match(r, /nové — sňatek/);
  assert.doesNotMatch(r, /Zápis o narození/, "the app's entry of a birth is the birth");
  await w.ok(["sync", file, "--apply"]);
  const anna = (await w.ok(["person", "show", "P2", "--json"])).json.person.events.find((e: { kind: string }) => e.kind === "BIRT");
  assert.deepEqual(anna.participants, [{ role: "midwife", name: "Ludmila Králová", note: "z Týnce" }]);
  const marr = (await w.ok(["family", "show", "F1", "--json"])).json.family.events.find((e: { kind: string }) => e.kind === "MARR");
  assert.deepEqual(marr?.participants, [{ role: "witness", name: "Jan Kos" }]);
  w.cleanup();
});
