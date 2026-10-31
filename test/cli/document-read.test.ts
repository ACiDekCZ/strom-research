// strom document read · again · cancel · show · list with a made-up reader (the script runner) on made-up documents: the
// transcript, translation, terms and people come back checked (nothing filled in), matched with the tree; no text or a
// photo too small is said with why, never a transcript; two readers compared; a reading again and cancelled.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { until, World } from "../helpers.ts";
import { halves, jpegWithOrientation, makePdf } from "../image-samples.ts";
import { encodeImage } from "../../src/image/index.ts";
import { readingResult } from "../../src/core/readsync.ts";
import { Tree } from "../../src/core/tree.ts";

const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const blind = p.includes("This is a BLIND reading");
const body = fs.readFileSync(blind ? process.env.DOC_BLIND : process.env.DOC_FIRST, "utf8");
const was = fs.readFileSync(report, "utf8");
fs.writeFileSync(report, was.replace("<!-- next block -->", body.trim() + "\\n<!-- next block -->"));
// marked once the report holds the reading: a test waiting on the mark reads it whole
if (process.env.DOC_MARK) fs.appendFileSync(process.env.DOC_MARK, (blind ? "blind" : "first") + "\\n");
if (process.env.DOC_WAIT) await new Promise((r) => setTimeout(r, Number(process.env.DOC_WAIT)));
console.log("cost: 0.25");
`;

const entry = (surname: string, transcriptSurname = surname) => `## Entry e1 · page 1
region: 0.05,0.30,0.90,0.20
transcript: 3. Aprilis 1846 | Joannes filius | Josephi ${transcriptSurname} agricolae | et Mariae Dvořák | levans Wenceslaus [...] | in Lhota
translation: 3. dubna 1846 Jan, syn Josefa ${surname}a, rolníka, a Marie Dvořákové; kmotr Václav [...]
term: agricola = rolník (occupation)
person: p1 | child | dítě | written=Joannes | given=Jan | sex=M
person: p2 | father | otec | written=Josephi ${transcriptSurname} | given=Josef | surname=${surname} | sex=M | occupation=agricola
person: p3 | mother | matka | written=Mariae Dvořák | given=Marie | surname=Dvořáková | sex=F
person: p4 | godparent | kmotr | written=Wenceslaus [...] | given=Václav | surname=Horák | sex=M
person: p5 | witness | svědek | written=Thomas Kral | given=Tomáš | surname=Král
event: BAPM | date=3.4.1846 | place=Lhota | persons=p1:principal,p2:father,p3:mother,p4:godparent
relation: parent p2 p1
relation: parent p3 p1
relation: spouse p2 p3`;

const FIRST = `## Document
kind: register.baptism
language: la
script: kurrent
date: 1846
legible: yes

${entry("Novák", "Novák[?]")}

## Context
context: Zápis křtu z latinské matriky: datum, dítě, rodiče, kmotr.

done: 1 entries`;

async function setUp(): Promise<{ w: World; dir: string; photo: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M", "--born", "1815"]); // P0001
  await w.ok(["person", "add", "Josefa /Nováková/", "--sex", "F", "--born", "1816"]); // P0002: another sex
  await w.ok(["place", "add", "Lhota", "--kind", "village", "--unlocated", "test"]); // L0001
  const dir = path.join(w.dir, "doklady ř");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  fs.writeFileSync(path.join(dir, "first.md"), FIRST);
  fs.writeFileSync(path.join(dir, "blind-same.md"), entry("Novak", "Novak"));
  fs.writeFileSync(path.join(dir, "blind-other.md"), entry("Nowak"));
  // a phone photo on its side (EXIF 6): read upright
  const photo = path.join(dir, "křest fotka.jpg");
  fs.writeFileSync(photo, jpegWithOrientation(halves(1600, 1200), 6));
  Object.assign(w.env, {
    STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"),
    DOC_FIRST: path.join(dir, "first.md"),
    DOC_BLIND: path.join(dir, "blind-same.md"),
    DOC_MARK: path.join(dir, "readers.log"),
    STROM_NO_CONVERT: "1",
  });
  return { w, dir, photo };
}

const readers = (dir: string) => (fs.existsSync(path.join(dir, "readers.log")) ? fs.readFileSync(path.join(dir, "readers.log"), "utf8").trim().split("\n") : []);

test("strom document read: transcript, translation, terms, people checked and matched with the tree; again with a blind reader", async () => {
  const { w, dir, photo } = await setUp();
  try {
    const r = await w.ok(["document", "read", photo, "--note", "list z matriky", "--agent", "script", "--json"]);
    const d = r.json;
    assert.match(d.id, /^D\d{14}-[0-9a-f]{4}$/);
    assert.equal(d.state, "done");
    assert.equal(d.lang, "cs");
    assert.deepEqual(d.readers, { asked: 1, ran: 1, agree: null });
    assert.equal(d.doc.kind, "register.baptism");
    // the photo became an input, read upright
    assert.equal(d.pages.length, 1);
    assert.equal(d.pages[0].file, "I0001");
    assert.deepEqual([d.pages[0].w, d.pages[0].h], [1200, 1600]);
    const input = (await w.ok(["input", "show", "I0001", "--json"])).json;
    assert.deepEqual((input.input ?? input).read, [d.id]);
    const e = d.entries[0];
    assert.match(e.transcript, /Josephi Novák\[\?\]/);
    assert.match(e.translation, /^3\. dubna 1846/);
    assert.deepEqual(e.glossary, [{ term: "agricola", meaning: "rolník", kind: "occupation" }]);
    assert.deepEqual(e.region, [0.05, 0.3, 0.9, 0.2]);
    // a reader that says nowhere where a name stands (a strom before): no region of a person or an event
    assert.ok([...e.persons, ...e.events].every((x: { region?: unknown }) => x.region === undefined));
    // nothing filled in: the witness the transcript has not is left out, the godparent's unread surname too
    assert.deepEqual(e.persons.map((p: { ref: string }) => p.ref), ["p1", "p2", "p3", "p4"]);
    assert.equal(e.persons[3].surname, undefined);
    assert.deepEqual(d.checks.map((c: { ref: string; why: string }) => `${c.ref}:${c.why}`), ["p4:illegible", "p4:not-of-its-letters", "p5:not-in-transcript"]);
    // the father: uncertain surname, matched with the tree's Josef Novák (not with Josefa: another sex)
    const father = e.persons[1];
    assert.deepEqual(father.uncertain, ["surname"]);
    assert.equal(father.match.length, 1);
    assert.equal(father.match[0].person, "P0001");
    assert.deepEqual(father.match[0].why, ["given", "surname", "sex", "years"]);
    assert.deepEqual(e.events[0].date, { text: "3.4.1846", gedcom: "3 APR 1846" });
    assert.deepEqual(e.events[0].place, { text: "Lhota", known: "L0001" });
    assert.match(d.context, /Zápis křtu/);
    assert.deepEqual(d.cost, { amount: 0.25, currency: "USD" });
    // kept: the report and the result, in git; the state on this computer
    const notes = path.join(w.cwd, "notes", "readings");
    assert.ok(fs.existsSync(path.join(notes, `${d.id}-1.md`)));
    assert.doesNotMatch(fs.readFileSync(path.join(notes, `${d.id}-1.md`), "utf8"), /next block/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(notes, `${d.id}.json`), "utf8")).state, "done");
    assert.equal(execFileSync("git", ["log", "-1", "--format=%s"], { cwd: w.cwd, encoding: "utf8" }).trim(), `Reading of a document ${d.id}: done, 1 entry`);
    assert.match(execFileSync("git", ["log", "-2", "--format=%s"], { cwd: w.cwd, encoding: "utf8" }), new RegExp(`Document ${d.id} to read: I0001 \\(I0001 added\\)`));
    // the agent's text: compact, with what to do next
    const shown = await w.ok(["document", "show", d.id]);
    assert.match(shown.out, /p2 father: Josef Novák \[written: Josephi Novák\[\?\]\] · M, agricola · uncertain: surname → P0001/);
    assert.match(shown.out, /left out by strom \(nothing filled in\): e1 p4 surname "Horák" \(illegible\); e1 p4 given "Václav" for "Wenceslaus" \(not-of-its-letters\); e1 p5 Thomas Kral \(not-in-transcript\)/);
    assert.match(shown.out, /next: tell the person .*strom media view I0001 --crop 0\.05,0\.3,0\.9,0\.2\)/);
    assert.match(shown.out, /strom document again D\S+ --readers 2/);
    assert.deepEqual(readers(dir), ["first"]);

    // again with two: only the blind reader reads, against the first; they agree
    const again = (await w.ok(["document", "again", d.id, "--readers", "2", "--agent", "script", "--json"])).json;
    assert.deepEqual(readers(dir), ["first", "blind"]);
    assert.equal(again.version, 2);
    assert.deepEqual(again.readers, { asked: 2, ran: 2, agree: "same" });
    assert.equal(again.entries[0].agree, "same");
    assert.ok(fs.existsSync(path.join(notes, `${d.id}-2.md`)));
    assert.equal(again.cost.amount, 0.5);
    // its commit says it is another reading than the first
    assert.equal(execFileSync("git", ["log", "-1", "--format=%s"], { cwd: w.cwd, encoding: "utf8" }).trim(), `Reading of a document ${d.id}, version 2: done, 1 entry`);
    // the blind reader read otherwise: said where
    w.env.DOC_BLIND = path.join(dir, "blind-other.md");
    const other = (await w.ok(["document", "read", "I0001", "--readers", "2", "--agent", "script", "--json"])).json;
    assert.notEqual(other.id, d.id);
    assert.equal(other.readers.agree, "differ");
    assert.deepEqual(other.entries[0].variants, [
      { field: "transcript", at: "Novák[?]", other: "Nowak" },
      { field: "p2.surname", at: "Novák", other: "Nowak" },
    ]);
    // the same file given again: no second input
    const byFile = (await w.ok(["document", "read", photo, "--agent", "script", "--json"])).json;
    assert.equal(byFile.pages[0].file, "I0001");
    const list = (await w.ok(["document", "list", "--json"])).json;
    assert.equal(list.length, 3);
    assert.ok(list.every((x: { state: string }) => x.state === "done"));
    assert.deepEqual(list.map((x: { ran: number; readers: number }) => `${x.ran}/${x.readers}`), ["1/1", "2/2", "2/2"]);
    // the list's time is the clock's here (UTC+14 all year), its readers those that read
    const tz = process.env.TZ;
    process.env.TZ = "Pacific/Kiritimati";
    try {
      const local = await w.ok(["document", "list"]);
      const at = new Date(Date.parse(list[1].since) + 14 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
      assert.match(local.out, new RegExp(`${list[1].id} +done .* 2 of 2 +${at}`));
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  } finally {
    w.cleanup();
  }
});

test("strom document read: no text on it, or too small a photo, is said with why — never a transcript", async () => {
  const { w, dir, photo } = await setUp();
  try {
    fs.writeFileSync(path.join(dir, "house.md"), "## Document\nkind: other\nlegible: no\nwhy: not-text\n\ndone: 0 entries");
    w.env.DOC_FIRST = path.join(dir, "house.md");
    const house = await w.run(["document", "read", photo, "--agent", "script", "--json"]);
    assert.equal(house.code, 0);
    assert.equal(house.json.state, "unreadable");
    assert.equal(house.json.doc.why, "not-text");
    assert.deepEqual(house.json.entries, []);
    assert.match((await w.ok(["document", "show", house.json.id])).out, /there is no text on it/);
    // too small: no reader at all
    const small = path.join(dir, "malá.png");
    fs.writeFileSync(small, encodeImage(halves(700, 500), "png"));
    const before = readers(dir).length;
    const s = (await w.ok(["document", "read", small, "--agent", "script", "--json"])).json;
    assert.equal(s.state, "unreadable");
    assert.equal(s.doc.why, "small");
    assert.equal(s.readers.ran, 0);
    assert.equal(readers(dir).length, before);
    assert.match((await w.ok(["document", "list"])).out, new RegExp(`${s.id} +unreadable .* 0 of 1 `));
    // a photo the reader says cannot be read: said why, never the transcript it wrote anyway
    fs.writeFileSync(path.join(dir, "blur.md"), `## Document\nkind: register.baptism\nlegible: no\nwhy: blur\n\n${entry("Novák")}\n\n## Context\ncontext: Zápis křtu.\n\ndone: 1 entries`);
    w.env.DOC_FIRST = path.join(dir, "blur.md");
    const blur = (await w.ok(["document", "read", photo, "--agent", "script", "--json"])).json;
    assert.equal(blur.state, "unreadable");
    assert.equal(blur.doc.why, "blur");
    assert.deepEqual(blur.entries, []);
    assert.equal(blur.context, undefined);
    assert.deepEqual(blur.checks, [{ entry: "page 1", what: "an entry of pages the reader says cannot be read (blur)", why: "illegible" }]);
    const blurShown = (await w.ok(["document", "show", blur.id])).out;
    assert.doesNotMatch(blurShown, /transcript:|tell the person what it says/);
    // no reader can start (its agent not installed): failed, said why — never left queued
    const none = await w.run(["document", "read", photo, "--agent", "codex", "--json"], { env: { PATH: path.join(w.dir, "agents") } });
    assert.notEqual(none.code, 0);
    const failed = (await w.ok(["document", "list", "--json"])).json[0];
    assert.equal(failed.state, "failed");
        // no photo at all
    const text = path.join(dir, "notes.txt");
    fs.writeFileSync(text, "x");
    assert.match((await w.run(["document", "read", text, "--agent", "script"])).err, /is no photo, scan or PDF/);
  } finally {
    w.cleanup();
  }
});

test("strom document read: a given name of other letters than written is kept as written, the reader's form a lead the tree is matched by", async () => {
  const { w, dir, photo } = await setUp();
  try {
    fs.writeFileSync(
      path.join(dir, "lead.md"),
      "## Document\nkind: register.baptism\nlegible: yes\n\n## Entry e1 · page 1\ntranscript: 3. Aprilis 1846 | Joannes filius Giuseppe Novák | levans Wenceslaus\n" +
        "person: p1 | child | written=Joannes | given=Jan | surname=Novák | sex=M\nperson: p2 | father | written=Giuseppe Novák | given=Josef | surname=Novák | sex=M\n" +
        "person: p3 | godparent | written=Wenceslaus | given=Václav | surname=Horák | sex=M\nevent: BAPM | date=3.4.1846 | persons=p1:principal,p2:father\n\ndone: 1 entries",
    );
    w.env.DOC_FIRST = path.join(dir, "lead.md");
    const d = (await w.ok(["document", "read", photo, "--agent", "script", "--json"])).json;
    const [child, father, godparent] = d.entries[0].persons;
    assert.deepEqual([child.given, child.surname], ["Jan", undefined]);
    assert.deepEqual([father.given, father.today, father.surname], ["Giuseppe", "Josef", "Novák"]);
    assert.deepEqual(father.match.map((m: { person: string; why: string[] }) => [m.person, m.why.join("+")]), [["P0001", "given-today+surname+sex+years"]]);
    assert.deepEqual([godparent.given, godparent.today, godparent.surname], ["Wenceslaus", "Václav", undefined]);
    const shown = (await w.ok(["document", "show", d.id])).out;
    assert.match(shown, /p2 father: Giuseppe Novák \[written: Giuseppe Novák\] · today's form by the reader, not of its letters \(a lead\): Josef · M · uncertain: given → P0001/);
    assert.match(shown, /p3 godparent: Wenceslaus \[written: Wenceslaus\] · today's form by the reader, not of its letters \(a lead\): Václav/);
    assert.match(shown, /e1 p1 surname "Novák" \(not-in-transcript\); e1 p2 given "Josef" for "Giuseppe" \(not-of-its-letters\); e1 p3 surname "Horák" \(not-in-transcript\)/);
  } finally {
    w.cleanup();
  }
});

test("strom document read of a certificate by two readers: a name held in the form's fields apart is read, its people, events and relations kept; a role read otherwise is a variant", async () => {
  const { w, dir, photo } = await setUp();
  try {
    // a made-up birth certificate on a printed form: the surnames in one field, the given names in another
    const form = (blind: boolean) => `## Document
kind: certificate
language: de
script: print
date: 12.05.2020
legible: yes

## Entry e1 · page 1
region: 0.10,0.05,0.80,0.60
transcript: Standesamt Lhota | Geburtsurkunde | Tag der Geburt 03-04-1950 | Ort der Geburt Lhota | Familienname LÖFFLER | Vornamen HANS JÜRGEN | Geschlecht M | Vater | Mutter | Familienname LÖFFLER | LÖFFLER | Vornamen WALTER | ERIKA MARIA | Ausgestellt am 12-05-2020 | Dr. Petra Zimmer${blind ? "" : " [?]"} | Standesbeamtin
person: p1 | child | ${blind ? "" : "dítě | "}written=LÖFFLER HANS JÜRGEN | given=Hans Jürgen | surname=Löffler | sex=M | region=${blind ? "0.30,0.25,0.40,0.06" : "0.30,0.24,0.42,0.06"}
person: p2 | father | ${blind ? "" : "otec | "}written=LÖFFLER WALTER | given=Walter | surname=Löffler | sex=M | region=${blind ? "0.12,0.40,0.35,0.06" : "0,0,1,0.9"}
person: p3 | mother | ${blind ? "" : "matka | "}written=LÖFFLER ERIKA MARIA | given=Erika Maria | surname=Löffler | sex=F${blind ? "" : " | region=0.10,0.90,0.30,0.05"}
${blind ? "person: p4 | writer | written=Dr. Petra Zimmer | given=Petra | surname=Zimmer | sex=F" : "person: p4 | other | úřednice | written=Dr. Petra Zimmer [?] | given=Petra | sex=F | occupation=Standesbeamtin"}
event: BIRT | date=3.4.1950 | place=Lhota | persons=p1:principal,p2:father,p3:mother${blind ? " | region=0.12,0.15,0.50,0.05" : ""}
relation: parent p2 p1
relation: parent p3 p1

done: 1 entries`;
    fs.writeFileSync(path.join(dir, "form-first.md"), form(false));
    fs.writeFileSync(path.join(dir, "form-blind.md"), form(true));
    Object.assign(w.env, { DOC_FIRST: path.join(dir, "form-first.md"), DOC_BLIND: path.join(dir, "form-blind.md") });
    const d = (await w.ok(["document", "read", photo, "--readers", "2", "--agent", "script", "--json"])).json;
    assert.equal(d.doc.kind, "certificate");
    assert.deepEqual(d.readers, { asked: 2, ran: 2, agree: "differ" });
    const e = d.entries[0];
    assert.deepEqual(
      e.persons.map((p: { ref: string; role: string; given?: string; surname?: string }) => `${p.ref} ${p.role} ${p.given} ${p.surname}`),
      ["p1 child Hans Jürgen Löffler", "p2 father Walter Löffler", "p3 mother Erika Maria Löffler", "p4 other Petra undefined"],
    );
    assert.deepEqual(e.events[0].type, "BIRT");
    assert.deepEqual(e.events[0].persons, [{ ref: "p1", role: "principal" }, { ref: "p2", role: "father" }, { ref: "p3", role: "mother" }]);
    assert.deepEqual(e.relations, [{ type: "parent", parent: "p2", child: "p1" }, { type: "parent", parent: "p3", child: "p1" }]);
    assert.deepEqual(d.checks, []);
    // where each name and the birth stand (K2.1): the first reader's; one of half the page, or out of the entry, is
    // none — the blind reader's of the same person then, else none (the app shows the entry's region)
    assert.deepEqual(e.persons.map((p: { region?: number[] }) => p.region), [[0.3, 0.24, 0.42, 0.06], [0.12, 0.4, 0.35, 0.06], undefined, undefined]);
    assert.deepEqual(e.events[0].region, [0.12, 0.15, 0.5, 0.05]);
    // the readers agree on the people of the form; the clerk's role and the surname only the blind one read are variants
    assert.deepEqual(e.variants, [
      { field: "p4.role", at: "other", other: "writer" },
      { field: "p4.surname", at: "", other: "Zimmer" },
    ]);
    // a result written by a strom before (its people left out): what the app is written into the tree by is read
    // from the readers' reports here, as the app is shown it
    const file = path.join(w.cwd, "notes", "readings", `${d.id}.json`);
    const before = JSON.parse(fs.readFileSync(file, "utf8"));
    before.entries[0].persons = [];
    fs.writeFileSync(file, JSON.stringify(before));
    assert.equal(readingResult(Tree.open(w.cwd, w.env), d.id)!.entries[0]!.persons.length, 4);
  } finally {
    w.cleanup();
  }
});

test("strom document read by two readers: a first reader that answers in prose only (its report not written) is no reader that ran, the blind one's reading never held against itself", async () => {
  const { w, dir, photo } = await setUp();
  try {
    // found live 2026-10-21: the first reader could not edit its report and only told what it would have written
    fs.writeFileSync(path.join(dir, "prose.md"), "I've read the page, but I couldn't write anything to the report file.\n\nThe writer, Josef Novák, tells of a baptism.");
    w.env.DOC_FIRST = path.join(dir, "prose.md");
    const d = (await w.ok(["document", "read", photo, "--readers", "2", "--agent", "script", "--json"])).json;
    assert.deepEqual(readers(dir).sort(), ["blind", "first"]);
    assert.deepEqual(d.readers, { asked: 2, ran: 1, agree: null });
    // the blind reader's entry, with no variants of itself
    const e = d.entries[0];
    assert.match(e.transcript, /Josephi Novak/u);
    assert.equal(e.agree, undefined);
    assert.equal(e.variants, undefined);
    const shown = await w.ok(["document", "show", d.id]);
    assert.match(shown.out, /1 reader of 2/u);
    assert.doesNotMatch(shown.out, /they agree/u);
  } finally {
    w.cleanup();
  }
});

test("strom document read of a typewritten certificate: a surname in letter-spaced type and a birth name after roz. are kept, the mother matched by the year she was born, her mother by it; a result written before is read again from the report", async () => {
  const { w, dir, photo } = await setUp();
  try {
    // two of one name in the tree, born 1907 and 1925 (both fit a mother of 1942): the document says 1907
    await w.ok(["person", "add", "Hana /Kratochvílová/", "--sex", "F", "--born", "1907"]); // P0003
    await w.ok(["person", "add", "Hana /Kratochvílová/", "--sex", "F", "--born", "1925"]); // P0004
    // her mother: one of a fitting year, one a century before
    await w.ok(["person", "add", "Jana /Dvořáková/", "--sex", "F", "--born", "1880"]); // P0005
    await w.ok(["person", "add", "Jana /Dvořáková/", "--sex", "F", "--born", "1790"]); // P0006
    fs.writeFileSync(
      path.join(dir, "typewriter.md"),
      `## Document
kind: certificate
language: cs
script: print
legible: yes

## Entry e1 · page 1
region: 0.10,0.05,0.80,0.60
transcript: Den, měsíc a rok narození | 3.6.1942 | Místo narození | Lhota | Jméno a příjmení dítěte | Petr K o v á ř | Matka | Jméno a příjmení | Hana K o v á ř o v á roz.Kratochvílová | den, měsíc, rok, místo narození | 29.8.1907, Lhota | Jméno a příjmení jejích rodičů | Jana roz.Dvořáková
person: p1 | child | dítě | written=Petr K o v á ř | given=Petr | surname=Kovář | sex=M
person: p2 | mother | matka | written=Hana K o v á ř o v á roz.Kratochvílová | given=Hana | surname=Kratochvílová | sex=F
person: p3 | other | matka matky | written=Jana roz.Dvořáková | given=Jana | surname=Dvořáková | sex=F
event: BIRT | date=3.6.1942 | place=Lhota | persons=p1:principal,p2:mother
event: BIRT | date=29.8.1907 | place=Lhota | persons=p2:principal,p3:mother
relation: parent p2 p1
relation: parent p3 p2

done: 1 entries`,
    );
    w.env.DOC_FIRST = path.join(dir, "typewriter.md");
    const d = (await w.ok(["document", "read", photo, "--agent", "script", "--json"])).json;
    assert.deepEqual(d.checks, []);
    const e = d.entries[0];
    assert.deepEqual(
      e.persons.map((p: { given?: string; surname?: string; written: string }) => `${p.given} ${p.surname} | ${p.written}`),
      ["Petr Kovář | Petr K o v á ř", "Hana Kratochvílová | Hana K o v á ř o v á roz.Kratochvílová", "Jana Dvořáková | Jana roz.Dvořáková"],
    );
    assert.deepEqual(e.persons[1].match.map((m: { person: string }) => m.person), ["P0003"]);
    assert.ok(e.persons[1].match[0].why.includes("years"));
    // the grandmother: a parent of one born 1907
    assert.deepEqual(e.persons[2].match.map((m: { person: string }) => m.person), ["P0005"]);
    // a result written by a strom before (the surnames left out): read again from the reader's report here
    const file = path.join(w.cwd, "notes", "readings", `${d.id}.json`);
    const before = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const p of before.entries[0].persons) delete p.surname;
    fs.writeFileSync(file, JSON.stringify(before));
    assert.deepEqual(readingResult(Tree.open(w.cwd, w.env), d.id)!.entries[0]!.persons.map((p) => p.surname), ["Kovář", "Kratochvílová", "Dvořáková"]);
  } finally {
    w.cleanup();
  }
});

test("strom document read of a PDF: its pages; a part of a page asked is said of the page", async () => {
  const { w, dir } = await setUp();
  try {
    const page = encodeImage(halves(1200, 1600), "jpeg", 90);
    const pdf = path.join(dir, "dopis.pdf");
    fs.writeFileSync(pdf, makePdf([{ jpeg: { bytes: page, width: 1200, height: 1600 } }, { jpeg: { bytes: page, width: 1200, height: 1600 } }]));
    fs.writeFileSync(path.join(dir, "letter.md"), "## Document\nkind: letter\nlegible: yes\n\n## Entry e1 · page 2\nregion: 0,0,1,0.5\ntranscript: Liebe Anna\nperson: p1 | addressee | written=Anna | given=Anna | sex=F | region=0.30,0.10,0.20,0.10\n\ndone: 1 entries");
    w.env.DOC_FIRST = path.join(dir, "letter.md");
    const d = (await w.ok(["document", "read", pdf, "--region", "2:0,0.5,1,0.5", "--into", "en", "--agent", "script", "--json"])).json;
    assert.equal(d.lang, "en");
    assert.deepEqual(d.pages.map((p: { n: number; page: number }) => [p.n, p.page]), [[1, 1], [2, 2]]);
    assert.deepEqual(d.pages[1].region, [0, 0.5, 1, 0.5]);
    // the reader's region of the part, as a region of the page
    assert.deepEqual(d.entries[0].region, [0, 0.5, 1, 0.25]);
    assert.deepEqual(d.entries[0].persons[0].region, [0.3, 0.55, 0.2, 0.05]);
    assert.match((await w.ok(["document", "show", d.id])).out, /strom media view I0001:2 --crop 0,0\.5,1,0\.25/);
  } finally {
    w.cleanup();
  }
});

test("strom document cancel: the reader stops, the reading is cancelled, what it wrote stays", async () => {
  const { w, dir, photo } = await setUp();
  try {
    w.env.DOC_WAIT = "60000";
    const reading = w.run(["document", "read", photo, "--agent", "script", "--json"]);
    const reads = path.join(w.cwd, ".strom", "reads");
    let id = "";
    await until("the reader at work", () => {
      const f = fs.existsSync(reads) ? fs.readdirSync(reads).find((x) => /^D.*\.json$/.test(x)) : undefined;
      if (!f) return false;
      id = f.replace(/\.json$/, "");
      return readers(dir).length === 1 && JSON.parse(fs.readFileSync(path.join(reads, f), "utf8")).state === "reading";
    }, { ms: 30_000 });
    const during = (await w.ok(["document", "show", id, "--json"])).json;
    assert.equal(during.state, "reading");
    assert.equal(during.entries.length, 1);
    const c = await w.ok(["document", "cancel", id, "--json"]);
    assert.equal(c.json.cancelled, true);
    const r = await reading;
    assert.equal(r.code, 1);
    assert.equal(r.json.state, "cancelled");
    assert.match((await w.ok(["document", "show", id])).out, /strom document again/);
    assert.match((await w.ok(["document", "cancel", id])).out, /is not being read \(cancelled\)/);
    // read again: anew
    delete w.env.DOC_WAIT;
    const again = (await w.ok(["document", "again", id, "--agent", "script", "--json"])).json;
    assert.equal(again.state, "done");
    assert.equal(again.version, 2);
  } finally {
    w.cleanup();
  }
});
