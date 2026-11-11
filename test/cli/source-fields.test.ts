// Where an entry stands in its book, field by field (spec 075): the folio or page as the book numbers it, the image's
// number, the book's call number — given by source add/edit, shown by source show (with what its locator names, as a
// proposal only), composed into one readable PAGE for every program and, for a Strom app that reads them
// (APP_READS_SOURCE_FIELDS), written as 1 _STROM_FOLIO/_STROM_IMAGE/_STROM_LOCATOR; edits of them in the app come back
// by sync, an older app's PAGE edited whole replaces the location.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { APP_READS_SOURCE_FIELDS, APP_READS_SOURCE_FIELDS_BETA, appReadsSourceFields } from "../../src/core/stromapp.ts";
import { readStromJson } from "../../src/core/sync.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { blank } from "../../src/image/image.ts";
import type { Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const source = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Source>(id)!;
const record = (text: string, id: string) => text.match(new RegExp(`^0 @${id}@ SOUR\\r?\\n(?:[1-9].*\\r?\\n)*`, "m"))![0];

/** A tree of Lhota: an archive, its book of marriages with its call number, an entry given field by field (S1), one with its location in the locator only (S2), Jan's birth citing it (P1). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["repo", "add", "Zemský archiv"]); // R1
  await w.ok(["recordset", "add", "Matrika Lhota O 1880–1900", "--repo", "R0001", "--call-number", "Lhota 7", "--kinds", "marriage"]); // B1
  await w.ok(["source", "add", "Oddavky Jana Lhotáka 1890", "--kind", "marriage", "--recordset", "B0001", "--folio", "pag. 112", "--image", "57", "--locator", "č. 3"]); // S1
  await w.ok(["source", "add", "Křest Anny Lhotákové 1885", "--kind", "baptism", "--locator", "fol. 12v, snímek 34"]); // S2
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["event", "add", "P0001", "BIRT", "--date", "1865", "--cite", "S0002"]);
  return w;
}

test("source add/edit/show/list: folio, image and call number given, shown with the archive and the book's call number; changing one needs a reason; a locator's folio and image only proposed", opts, async () => {
  const w = await world();
  try {
    const s1 = source(w, "S0001");
    assert.deepEqual([s1.folio, s1.image, s1.locator, s1.callNumber], ["pag. 112", "57", "č. 3", undefined]);
    assert.match((await w.ok(["source", "show", "S0001"])).out, /^find {3}R0001 Zemský archiv · call number Lhota 7 \(its book's\) · pag\. 112 · image 57$/m);
    // the location in the locator alone: proposed, never written
    const shown = (await w.ok(["source", "show", "S0002"])).out;
    assert.match(shown, /^from its locator: --folio "fol\. 12v" --image 34 --locator "" --reason "the folio and image are in their own fields" \(strom source edit S0002 to take them\)$/m);
    const j = (await w.ok(["source", "show", "S0002", "--json"])).json;
    assert.deepEqual(j.proposed, { folio: "fol. 12v", image: "34", locator: "" });
    assert.equal(j.source.folio, undefined);
    assert.equal(source(w, "S0002").locator, "fol. 12v, snímek 34", "the existing locator as it was");
    // filling one in needs no reason, changing one does
    const refused = await w.run(["source", "edit", "S0001", "--image", "58"]);
    assert.notEqual(refused.code, 0);
    assert.match(refused.out + refused.err, /--image[^\n]*--reason/);
    await w.ok(["source", "edit", "S0001", "--image", "58", "--reason", "přečíslované snímky archivu"]);
    await w.ok(["source", "edit", "S0002", "--folio", "fol. 12v", "--call-number", "Lhota 3"]);
    assert.deepEqual([source(w, "S0002").folio, source(w, "S0002").callNumber], ["fol. 12v", "Lhota 3"]);
    assert.doesNotMatch((await w.ok(["source", "show", "S0002"])).out, /from its locator: --folio/, "the folio taken: proposed no more");
    const own = (await w.ok(["source", "show", "S0002", "--json"])).json;
    assert.equal(own.callNumber, "Lhota 3");
    // found by them
    assert.match((await w.ok(["source", "list", "112"])).out, /S0001/);
    w.cleanup();
  } catch (e) {
    w.cleanup();
    throw e;
  }
});

test("the GEDCOM: PAGE composed of the fields given, an existing locator as it was; CALN its own or its book's (a REPO with no pointer for its own alone); the fields for an app that reads them only, the image of its scans too; the standard file none", opts, async () => {
  const w = await world();
  try {
    // an entry with no archive, a call number of its own; one in the book with a scan of image 60 registered, no image given
    await w.ok(["source", "add", "Pohřeb Václava Lhotského 1899", "--kind", "burial", "--call-number", "Lhota 9", "--folio", "S. 15"]); // S3
    const dir = fs.mkdtempSync(path.join(w.dir, "snímky-"));
    fs.writeFileSync(path.join(dir, "obr-060.jpg"), encodeJpeg(blank(60, 40, 1, 120), 85));
    await w.ok(["media", "add", dir, "--recordset", "B0001"]); // M1, image 60
    await w.ok(["source", "add", "Oddavky Karla Lhotského 1891", "--kind", "marriage", "--recordset", "B0001", "--clip", "M0001@0.05,0.40,0.45,0.18", "--locator", "č. 9"]); // S4
    const tree = Tree.open(w.cwd, w.env);
    const strom = exportGedcom(tree, { for: "strom", research: true }).text;
    assert.match(record(strom, "S0001"), /^1 REPO @R0001@\r?\n2 CALN Lhota 7\r?\n1 PAGE pag\. 112, č\. 3, snímek 57\r?\n1 NOTE/m);
    assert.match(record(strom, "S0002"), /^1 TITL Křest Anny Lhotákové 1885\r?\n1 PAGE fol\. 12v, snímek 34\r?\n1 NOTE/m, "an existing source: its PAGE as it was");
    assert.match(record(strom, "S0003"), /^1 REPO\r?\n2 CALN Lhota 9\r?\n1 PAGE S\. 15\r?\n/m);
    assert.match(record(strom, "S0004"), /^1 PAGE č\. 9\r?\n/m, "an image of its scans only: not in its PAGE");
    assert.doesNotMatch(strom, /_STROM_(FOLIO|IMAGE|LOCATOR)/, "an app that does not read them gets none");
    assert.deepEqual(validateGedcom(strom).filter((f) => f.level === "error"), []);
    // an app that reads them: the fields after the PAGE
    const fields = exportGedcom(tree, { for: "strom", research: true, sourceFields: true }).text;
    assert.match(record(fields, "S0001"), /^1 PAGE pag\. 112, č\. 3, snímek 57\r?\n1 _STROM_FOLIO pag\. 112\r?\n1 _STROM_IMAGE 57\r?\n1 _STROM_LOCATOR č\. 3\r?\n/m);
    assert.match(record(fields, "S0002"), /^1 PAGE fol\. 12v, snímek 34\r?\n1 _STROM_LOCATOR fol\. 12v, snímek 34\r?\n/m);
    assert.match(record(fields, "S0004"), /^1 PAGE č\. 9\r?\n1 _STROM_IMAGE 60\r?\n1 _STROM_LOCATOR č\. 9\r?\n/m);
    assert.equal(fields.replace(/^1 _STROM_(FOLIO|IMAGE|LOCATOR) .*\r?\n/gm, "").replace(/^1 _STROM_ASOF .*$/m, ""), strom.replace(/^1 _STROM_ASOF .*$/m, ""), "nothing else of the file differs");
    assert.deepEqual(validateGedcom(fields).filter((f) => f.level === "error" || f.level === "warn"), []);
    // the standard file: the composed location on the citation's PAGE and in the note, no tag of Strom's
    const standard = exportGedcom(tree, { for: "standard" }).text;
    assert.doesNotMatch(standard, /_STROM_(FOLIO|IMAGE|LOCATOR)/);
    assert.match(record(standard, "S0001"), /pag\. 112, č\. 3, snímek 57/);
    assert.deepEqual(validateGedcom(standard, { strict: true }).filter((f) => f.level === "error"), []);
    w.cleanup();
  } catch (e) {
    w.cleanup();
    throw e;
  }
});

test("N1: an image given to an older source whose locator names one — the PAGE says one image number, the locator kept as it was, the edit with its rest proposed (source edit, show, add)", opts, async () => {
  const w = await world();
  try {
    await w.ok(["source", "add", "Křest Marie Lhotákové 1888", "--kind", "baptism", "--recordset", "B0001", "--locator", "fol. 12, snímek 3"]); // S3
    const before = exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true }).text;
    // the method's way when the link is dead: the new page, the image found again
    const edited = await w.ok(["source", "edit", "S0003", "--url", "https://archive.example.org/new/4", "--image", "4", "--reason", "archiv přesunul prohlížeč"]);
    assert.match(edited.out, /^its locator names image 3, the field 4 — the PAGE says the field's, the locator is kept as it is · the locator to its rest: strom source edit S0003 --locator "fol\. 12" --reason "the folio and image are in their own fields"$/m);
    assert.deepEqual([source(w, "S0003").locator, source(w, "S0003").image], ["fol. 12, snímek 3", "4"], "nothing rewritten by itself");
    const tree = Tree.open(w.cwd, w.env);
    const strom = exportGedcom(tree, { for: "strom", research: true }).text;
    assert.match(record(strom, "S0003"), /^1 PAGE fol\. 12, snímek 4\r?\n/m);
    assert.doesNotMatch(strom, /snímek 3, snímek 4/);
    const fields = exportGedcom(tree, { for: "strom", research: true, sourceFields: true }).text;
    assert.match(record(fields, "S0003"), /^1 PAGE fol\. 12, snímek 4\r?\n1 _STROM_IMAGE 4\r?\n1 _STROM_LOCATOR fol\. 12, snímek 3\r?\n/m, "the locator's whole text for the app");
    const standard = record(exportGedcom(tree, { for: "standard" }).text, "S0003");
    assert.match(standard, /fol\. 12, snímek 4/);
    assert.doesNotMatch(standard, /snímek 3(?![\p{N}])/u);
    // the sources without the fields: byte for byte as before
    for (const id of ["S0002"]) assert.equal(record(strom, id), record(before, id));
    // show: the same, with the edit that keeps the locator to its rest; and an older source's proposal its rest too
    const shown = await w.ok(["source", "show", "S0003", "--json"]);
    assert.deepEqual(shown.json.locatorOverlap, { image: { named: "3", same: false }, rest: "fol. 12" });
    await w.ok(["source", "add", "Křest Josefa Lhotáka 1889", "--kind", "baptism", "--locator", "fol. 14v, č. 5, snímek 36"]); // S4
    const proposal = await w.ok(["source", "show", "S0004"]);
    assert.match(proposal.out, /^from its locator: --folio "fol\. 14v" --image 36 --locator "č\. 5" --reason "the folio and image are in their own fields" \(strom source edit S0004 to take them\)$/m);
    assert.deepEqual((await w.ok(["source", "show", "S0004", "--json"])).json.proposed, { folio: "fol. 14v", image: "36", locator: "č. 5" });
    // the proposal taken whole: nothing said twice, nothing more proposed
    await w.ok(["source", "edit", "S0004", "--folio", "fol. 14v", "--image", "36", "--locator", "č. 5", "--reason", "the folio and image are in their own fields"]);
    const taken = (await w.ok(["source", "show", "S0004"])).out;
    assert.doesNotMatch(taken, /from its locator|its locator names/);
    // the same number by another word: said once, said so
    const same = await w.ok(["source", "add", "Křest Pavla Lhotáka 1890", "--kind", "baptism", "--locator", "č. 2, scan 40", "--image", "40"]); // S5
    assert.match(same.out, /^its locator names the image \(40\) too — the PAGE says it once, the locator is kept as it is · the locator to its rest: strom source edit S0005 --locator "č\. 2"/m);
    assert.match(record(exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true }).text, "S0005"), /^1 PAGE č\. 2, scan 40\r?\n/m);
    w.cleanup();
  } catch (e) {
    w.cleanup();
    throw e;
  }
});

test("N1-a: show proposes what the edit does — the locator emptied when nothing else is in it; --locator \"\" empties it, with a reason", opts, async () => {
  const w = await world();
  try {
    await w.ok(["source", "add", "Křest Marie Lhotákové 1888", "--kind", "baptism", "--recordset", "B0001", "--locator", "fol. 12, snímek 3"]); // S3
    await w.ok(["source", "edit", "S0003", "--image", "4", "--reason", "archiv přesunul prohlížeč"]);
    // the folio still in the locator: proposed with the locator emptied (both are fields then)
    const shown = await w.ok(["source", "show", "S0003"]);
    assert.match(shown.out, /^from its locator: --folio "fol\. 12" --locator "" --reason "the folio and image are in their own fields" \(strom source edit S0003 to take them\)$/m);
    assert.deepEqual((await w.ok(["source", "show", "S0003", "--json"])).json.proposed, { folio: "fol. 12", locator: "" });
    // only the folio taken: the locator says nothing else, emptying it proposed
    await w.ok(["source", "edit", "S0003", "--folio", "fol. 12"]);
    const after = await w.ok(["source", "show", "S0003"]);
    assert.match(after.out, /the locator emptied, nothing else in it: strom source edit S0003 --locator "" --reason "the folio and image are in their own fields"$/m);
    // emptying a locator overwrites what it said: a reason asked
    const bare = await w.run(["source", "edit", "S0003", "--locator", ""]);
    assert.equal(bare.code, 2);
    assert.match(bare.err, /--locator.*--reason/);
    await w.ok(["source", "edit", "S0003", "--locator", "", "--reason", "the folio and image are in their own fields"]);
    const s = source(w, "S0003");
    assert.deepEqual([s.locator, s.folio, s.image], [undefined, "fol. 12", "4"]);
    assert.doesNotMatch((await w.ok(["source", "show", "S0003"])).out, /from its locator|its locator names/);
    assert.match(record(exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true }).text, "S0003"), /^1 PAGE fol\. 12, snímek 4\r?\n/m);
    // a locator with a rest keeps proposing its rest, never emptied
    await w.ok(["source", "add", "Křest Pavla Lhotáka 1890", "--kind", "baptism", "--locator", "č. 2, scan 40", "--image", "40"]); // S4
    assert.match((await w.ok(["source", "show", "S0004"])).out, /the locator to its rest: strom source edit S0004 --locator "č\. 2"/);
    w.cleanup();
  } catch (e) {
    w.cleanup();
    throw e;
  }
});

test("the gate: production from its version once set (none yet), a copy of the app from 3.27.0-beta.5, an unknown version never — an older beta's file as before", () => {
  const prod = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  assert.equal(APP_READS_SOURCE_FIELDS, undefined);
  assert.equal(APP_READS_SOURCE_FIELDS_BETA, "3.27.0-beta.5");
  assert.equal(appReadsSourceFields(beta, "3.27.0-beta.4"), false, "the beta before: the file as before");
  assert.equal(appReadsSourceFields(beta, "3.27.0-beta.5"), true);
  assert.equal(appReadsSourceFields(beta, "3.27.0"), true);
  assert.equal(appReadsSourceFields(prod, "3.27.0"), false, "production: not before its own gate");
  assert.equal(appReadsSourceFields(prod, "9.0.0"), false);
  assert.equal(appReadsSourceFields(prod, undefined), false);
  assert.equal(appReadsSourceFields(prod, "3.28.0", "3.28.0"), true);
  assert.equal(appReadsSourceFields(prod, "3.27.9", "3.28.0"), false);
  assert.equal(appReadsSourceFields(beta, undefined), false, "a copy of unknown version: nothing");
  assert.equal(appReadsSourceFields(beta, "3.28.0-beta.1", undefined, "3.28.0-beta.2"), false);
  assert.equal(appReadsSourceFields(beta, "3.28.0-beta.2", undefined, "3.28.0-beta.2"), true);
});

/** The Strom file of the research now (an older app's shape) at `out`. */
async function stromFile(w: World, out: string): Promise<string> {
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  return fs.readFileSync(out, "utf8");
}

/** The file as an app that reads the fields gives it back: each source's fields after its PAGE (`fields` by its REFN). */
function withFields(text: string, fields: Record<string, string[]>): string {
  return text.replace(/^0 @([^@]+)@ SOUR\r?\n(?:[1-9].*\r?\n)*/gm, (rec) => {
    const refn = rec.match(/^1 REFN (S\d+)/m)?.[1];
    const lines = refn ? fields[refn] : undefined;
    return lines ? rec.replace(/^(1 PAGE .*\r?\n)/m, `$1${lines.join("\n")}\n`) : rec;
  });
}

test("sync from an app that reads the fields: unchanged nothing; the research's source edited — the user's folio, image and call number kept beside its own", opts, async () => {
  const w = await world();
  try {
    const ged = await stromFile(w, path.join(w.dir, "strom.ged"));
    // the fields as the research has them: nothing new
    const same = path.join(w.dir, "same.ged");
    fs.writeFileSync(same, withFields(ged, { S0001: ["1 _STROM_FOLIO pag. 112", "1 _STROM_IMAGE 57", "1 _STROM_LOCATOR č. 3"], S0002: ["1 _STROM_LOCATOR fol. 12v, snímek 34"] }));
    assert.match((await w.ok(["sync", same])).out, /nic nového/);
    // the older app's file unchanged: nothing new either
    assert.match((await w.ok(["sync", path.join(w.dir, "strom.ged")])).out, /nic nového/);
    // the user corrects the image and the call number of the research's source: kept beside it, the research's stays
    const file = path.join(w.dir, "z-aplikace.ged");
    fs.writeFileSync(file, withFields(ged.replace("2 CALN Lhota 7", "2 CALN Lhota 7a"), { S0001: ["1 _STROM_FOLIO pag. 112", "1 _STROM_IMAGE 59", "1 _STROM_LOCATOR č. 3"] }));
    assert.match((await w.ok(["sync", file])).out, /pramen výzkumu „Oddavky Jana Lhotáka 1890“: v aplikaci přečtený jinak/);
    await w.ok(["sync", file, "--apply"]);
    const s1 = source(w, "S0001");
    assert.deepEqual([s1.folio, s1.image, s1.locator, s1.callNumber], ["pag. 112", "57", "č. 3", undefined]);
    const note = s1.notes.at(-1)!.text;
    assert.match(note, /^snímek: 59$/m);
    assert.match(note, /^signatura: Lhota 7a$/m);
    assert.doesNotMatch(note, /folio\/strana:/, "the folio not edited: not said");
    w.cleanup();
  } catch (e) {
    w.cleanup();
    throw e;
  }
});

test("sync: a source of the app's comes with its fields; its image edited where the app reads them corrected, undone back; its PAGE edited whole by an older app the location replaced, the folio and image in it, undone back", opts, async () => {
  const w = await world();
  try {
    const ged = await stromFile(w, path.join(w.dir, "strom.ged"));
    // a new person born on an entry the user found, given field by field
    const added = ged.replace(
      /^0 @U1@ SUBM/m,
      [
        "0 @X1@ INDI",
        "1 NAME Marie /Lhotáková/",
        "1 SEX F",
        "1 BIRT",
        "2 DATE 5 MAY 1910",
        "2 PLAC Lhota",
        "2 SOUR @X9@",
        "3 PAGE fol. 12, č. 5, snímek 34",
        "3 QUAY 3",
        "0 @X9@ SOUR",
        "1 TITL Křestní matrika Lhota 1905–1915",
        "1 REPO @XR1@",
        "2 CALN Lhota 12",
        "1 PAGE fol. 12, č. 5, snímek 34",
        "1 _STROM_FOLIO fol. 12",
        "1 _STROM_IMAGE 34",
        "1 _STROM_LOCATOR č. 5",
        "1 TEXT Marie, dcera Josefa Lhotáka.",
        "0 @XR1@ REPO",
        "1 NAME Okresní archiv Lhota",
        "0 @U1@ SUBM",
      ].join("\n"),
    );
    const file = path.join(w.dir, "nový.ged");
    fs.writeFileSync(file, added);
    await w.ok(["sync", file, "--apply"]);
    const made = Tree.open(w.cwd, w.env).list<Source>("source").find((s) => s.title === "Křestní matrika Lhota 1905–1915")!;
    assert.deepEqual([made.folio, made.image, made.locator, made.callNumber], ["fol. 12", "34", "č. 5", "Lhota 12"]);
    // given back (an older app's shape) and sent unchanged: nothing new
    const back = await stromFile(w, path.join(w.dir, "back.ged"));
    assert.match(record(back, made.id), /^1 REPO @R\d+@\r?\n2 CALN Lhota 12\r?\n1 PAGE fol\. 12, č\. 5, snímek 34\r?\n/m);
    assert.match((await w.ok(["sync", path.join(w.dir, "back.ged")])).out, /nic nového/);
    // the app reads the fields: the user corrects the image alone
    const image = path.join(w.dir, "snímek.ged");
    fs.writeFileSync(image, withFields(back, { [made.id]: ["1 _STROM_FOLIO fol. 12", "1 _STROM_IMAGE 35", "1 _STROM_LOCATOR č. 5"] }));
    assert.match((await w.ok(["sync", image])).out, /pramen z aplikace „Křestní matrika Lhota 1905–1915“/);
    const done = (await w.ok(["sync", image, "--apply", "--json"])).json;
    let s = source(w, made.id);
    assert.deepEqual([s.folio, s.image, s.locator, s.callNumber], ["fol. 12", "35", "č. 5", "Lhota 12"]);
    await w.ok(["sync", "undo", done.input]);
    s = source(w, made.id);
    assert.deepEqual([s.folio, s.image, s.locator, s.callNumber], ["fol. 12", "34", "č. 5", "Lhota 12"]);
    // an older app: the user edits the PAGE whole — it is the location now, the folio and image in it
    const whole = path.join(w.dir, "celé.ged");
    fs.writeFileSync(whole, back.replace(/^(0 @[^@]+@ SOUR\r?\n(?:[1-9].*\r?\n)*?)1 PAGE fol\. 12, č\. 5, snímek 34$/m, "$11 PAGE fol. 13, č. 5, snímek 36"));
    const applied = (await w.ok(["sync", whole, "--apply", "--json"])).json;
    s = source(w, made.id);
    assert.deepEqual([s.folio, s.image, s.locator, s.callNumber], [undefined, undefined, "fol. 13, č. 5, snímek 36", "Lhota 12"]);
    assert.match((await w.ok(["check"])).out, /^ok/);
    await w.ok(["sync", "undo", applied.input]);
    s = source(w, made.id);
    assert.deepEqual([s.folio, s.image, s.locator, s.callNumber], ["fol. 12", "34", "č. 5", "Lhota 12"]);
    w.cleanup();
  } catch (e) {
    w.cleanup();
    throw e;
  }
});

test("the Strom app's JSON brings a source's folio, image and call number", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    const json = {
      persons: { b: { id: "b", firstName: "Eva", lastName: "Lhotáková", gender: "female", birthDate: "1912-02-03", birthPlace: "Lhota", birthSourceIds: ["s1"], partnerships: [], parentIds: [] } },
      partnerships: {},
      sources: { s1: { id: "s1", title: "Křestní matrika Lhota 1905–1915", reference: "č. 8", folio: "pag. 30", image: "41", callNumber: "Lhota 12", transcript: "Eva, dcera Josefa.", quality: 2 } },
    };
    const file = path.join(w.dir, "strom.json");
    fs.writeFileSync(file, JSON.stringify(json));
    await w.ok(["sync", file, "--apply"], { env: { STROM_FOR_APP: "1" } });
    const s = Tree.open(w.cwd, w.env).list<Source>("source").find((x) => x.title.startsWith("Křestní matrika Lhota"))!;
    assert.deepEqual([s.folio, s.image, s.locator, s.callNumber], ["pag. 30", "41", "č. 8", "Lhota 12"]);
    w.cleanup();
  } catch (e) {
    w.cleanup();
    throw e;
  }
});

/** The file as the Strom app of `version` writes it (its HEAD: 1 SOUR STROM, 2 VERS). */
const fromApp = (text: string, version: string) => text.replace(/^1 SOUR STROM_RESEARCH\r?\n2 VERS .*\r?\n(?:2 NAME .*\r?\n)?/m, `1 SOUR STROM\n2 VERS ${version}\n2 NAME Strom\n`);

test("B: a field removed in an app that keeps them is removed here, undone back; the research's read source keeps it, said beside; an older app, the PAGE naming it, a field it was not given remove nothing", opts, async () => {
  const w = await world();
  try {
    const ged = await stromFile(w, path.join(w.dir, "strom.ged"));
    assert.match(ged, /^1 SOUR STROM_RESEARCH$/m);
    // an app's own source, given field by field
    const added = ged.replace(
      /^0 @U1@ SUBM/m,
      ["0 @X1@ INDI", "1 NAME Marie /Lhotáková/", "1 SEX F", "1 BIRT", "2 DATE 5 MAY 1910", "2 SOUR @X9@", "3 PAGE fol. 12, č. 5, snímek 34", "0 @X9@ SOUR", "1 TITL Křestní matrika Lhota 1905–1915", "1 REPO", "2 CALN Lhota 12", "1 PAGE fol. 12, č. 5, snímek 34", "1 _STROM_FOLIO fol. 12", "1 _STROM_IMAGE 34", "1 _STROM_LOCATOR č. 5", "0 @U1@ SUBM"].join("\n"),
    );
    fs.writeFileSync(path.join(w.dir, "nový.ged"), added);
    await w.ok(["sync", path.join(w.dir, "nový.ged"), "--apply"]);
    const made = Tree.open(w.cwd, w.env).list<Source>("source").find((s) => s.title === "Křestní matrika Lhota 1905–1915")!;
    assert.deepEqual([made.folio, made.image, made.callNumber], ["fol. 12", "34", "Lhota 12"]);
    const back = await stromFile(w, path.join(w.dir, "back.ged"));
    // the app keeps the fields: the user removes the image and the call number of its own source
    const removedFile = (version: string) =>
      fromApp(
        withFields(back, { [made.id]: ["1 _STROM_FOLIO fol. 12", "1 _STROM_LOCATOR č. 5"] })
          .replace(/^(0 @[^@]+@ SOUR\r?\n(?:[1-9].*\r?\n)*?)1 PAGE fol\. 12, č\. 5, snímek 34$/m, "$11 PAGE fol. 12, č. 5")
          .replace(/^1 REPO\r?\n2 CALN Lhota 12\r?\n/m, ""),
        version,
      );
    // an older app's file of the same: nothing removed (it never sends them)
    const older = path.join(w.dir, "starší.ged");
    fs.writeFileSync(older, removedFile("3.27.0-beta.4"));
    assert.match((await w.ok(["sync", older])).out, /nic nového/);
    const file = path.join(w.dir, "smazáno.ged");
    fs.writeFileSync(file, removedFile("3.27.0-beta.5"));
    assert.match((await w.ok(["sync", file])).out, /pramen z aplikace „Křestní matrika Lhota 1905–1915“/);
    const done = (await w.ok(["sync", file, "--apply", "--json"])).json;
    let s = source(w, made.id);
    assert.deepEqual([s.folio, s.image, s.locator, s.callNumber], ["fol. 12", undefined, "č. 5", undefined]);
    assert.match((await w.ok(["check"])).out, /^ok/);
    // sent again as it is now: nothing new, nothing comes back
    const again = await stromFile(w, path.join(w.dir, "again.ged"));
    assert.doesNotMatch(record(again, made.id), /snímek 34|CALN/);
    await w.ok(["sync", "undo", done.input]);
    s = source(w, made.id);
    assert.deepEqual([s.folio, s.image, s.locator, s.callNumber], ["fol. 12", "34", "č. 5", "Lhota 12"]);
    // the PAGE still naming the image (an app given the PAGE alone): not removed
    const named = path.join(w.dir, "jmenuje.ged");
    fs.writeFileSync(named, fromApp(withFields(back, { [made.id]: ["1 _STROM_FOLIO fol. 12", "1 _STROM_LOCATOR č. 5, snímek 34"] }), "3.27.0-beta.5"));
    await w.ok(["sync", named, "--apply"]);
    assert.equal(source(w, made.id).image, "34");
    // the research's source it read: the removed image said beside it, its own stays
    const read = path.join(w.dir, "přečtený.ged");
    fs.writeFileSync(
      read,
      fromApp(withFields(back, { S0001: ["1 _STROM_FOLIO pag. 112", "1 _STROM_LOCATOR č. 3"] }).replace(/^1 PAGE pag\. 112, č\. 3, snímek 57$/m, "1 PAGE pag. 112, č. 3"), "3.27.0-beta.5"),
    );
    assert.match((await w.ok(["sync", read])).out, /pramen výzkumu „Oddavky Jana Lhotáka 1890“: v aplikaci přečtený jinak/);
    await w.ok(["sync", read, "--apply"]);
    const s1 = source(w, "S0001");
    assert.equal(s1.image, "57");
    assert.match(s1.notes.at(-1)!.text, /^snímek: odstraněno v aplikaci Strom \(bylo 57\)$/m);
    const twice = path.join(w.dir, "přečtený-znovu.ged");
    fs.writeFileSync(twice, fs.readFileSync(read, "utf8").replace(/^1 NOTE /m, "1 NOTE  "));
    assert.doesNotMatch((await w.ok(["sync", twice])).out, /přečtený jinak/, "said beside once");
    // S0002 has no field of its own: an app that keeps them sends none, nothing is removed
    assert.equal(source(w, "S0002").locator, "fol. 12v, snímek 34");
    w.cleanup();
  } catch (e) {
    w.cleanup();
    throw e;
  }
});

test("B (N1): an app given the file before it kept the fields, updated since, sends the same tree back: nothing removed — the call number its note still names (any accent, NFD), the folio and image its location names; removed in it after, removed here", opts, async () => {
  const w = await world();
  try {
    const ged = await stromFile(w, path.join(w.dir, "strom.ged"));
    // an app's own source with its own call number, given field by field
    const added = ged.replace(
      /^0 @U1@ SUBM/m,
      ["0 @X1@ INDI", "1 NAME Marie /Lhotáková/", "1 SEX F", "1 BIRT", "2 DATE 5 MAY 1910", "2 SOUR @X9@", "3 PAGE fol. 12, č. 5, snímek 34", "0 @X9@ SOUR", "1 TITL Křestní matrika Lhota 1905–1915", "1 REPO", "2 CALN Lhotská 12", "1 PAGE fol. 12, č. 5, snímek 34", "1 _STROM_FOLIO fol. 12", "1 _STROM_IMAGE 34", "1 _STROM_LOCATOR č. 5", "0 @U1@ SUBM"].join("\n"),
    );
    fs.writeFileSync(path.join(w.dir, "nový.ged"), added);
    await w.ok(["sync", path.join(w.dir, "nový.ged"), "--apply"]);
    const made = Tree.open(w.cwd, w.env).list<Source>("source").find((s) => s.title === "Křestní matrika Lhota 1905–1915")!;
    assert.deepEqual([made.folio, made.image, made.callNumber], ["fol. 12", "34", "Lhotská 12"]);
    // what an app before 3.27.0-beta.5 is given: the composed PAGE, CALN under REPO — its importer reads CALN into the
    // source's note ("Signatura: …") and its exporter writes no CALN
    const old = await stromFile(w, path.join(w.dir, "old.ged"));
    assert.doesNotMatch(record(old, made.id), /_STROM_/);
    assert.match(record(old, made.id), /^2 CALN Lhotská 12$/m);
    const asNote = (text: string, note: string) => text.replace(/^1 REPO\r?\n2 CALN Lhotská 12\r?\n/m, `1 NOTE ${note}\n`);
    // updated to 3.27.0-beta.5, the same stored tree sent back: without fields, or its reference given as _STROM_LOCATOR
    const sends = {
      "bez polí.ged": asNote(fromApp(old, "3.27.0-beta.5"), "Signatura: Lhotská 12"),
      "umístění.ged": asNote(fromApp(withFields(old, { [made.id]: ["1 _STROM_LOCATOR fol. 12, č. 5, snímek 34"] }), "3.27.0-beta.5"), "Signatura: Lhotská 12"),
      "nfd.ged": asNote(fromApp(old, "3.27.0-beta.5"), "Signatura: Lhotská 12".normalize("NFD")),
    };
    for (const [name, text] of Object.entries(sends)) {
      const file = path.join(w.dir, name);
      fs.writeFileSync(file, text);
      assert.match((await w.ok(["sync", file])).out, /nic nového/, name);
      await w.ok(["sync", file, "--apply"]);
      const s = source(w, made.id);
      assert.deepEqual([s.folio, s.image, s.locator, s.callNumber], ["fol. 12", "34", "č. 5", "Lhotská 12"], name);
    }
    // loaded again into the updated app (the fields kept now, no note line), the user removes the call number: removed, undone back
    const back = await stromFile(w, path.join(w.dir, "back.ged"));
    const removed = path.join(w.dir, "smazáno.ged");
    fs.writeFileSync(removed, fromApp(withFields(back, { [made.id]: ["1 _STROM_FOLIO fol. 12", "1 _STROM_IMAGE 34", "1 _STROM_LOCATOR č. 5"] }).replace(/^1 REPO\r?\n2 CALN Lhotská 12\r?\n/m, ""), "3.27.0-beta.5"));
    assert.match((await w.ok(["sync", removed])).out, /pramen z aplikace „Křestní matrika Lhota 1905–1915“/);
    const done = (await w.ok(["sync", removed, "--apply", "--json"])).json;
    assert.equal(source(w, made.id).callNumber, undefined);
    await w.ok(["sync", "undo", done.input]);
    assert.equal(source(w, made.id).callNumber, "Lhotská 12");
    assert.match((await w.ok(["check"])).out, /^ok/);
    w.cleanup();
  } catch (e) {
    w.cleanup();
    throw e;
  }
});

test("B: the app's JSON keeps the fields from its data version 18 (a field not given back is removed), before it not", () => {
  const tree = (version?: number) => ({ ...(version !== undefined ? { version } : {}), persons: {}, partnerships: {}, sources: {} });
  assert.equal(readStromJson(tree(18)).fieldsKept, true);
  assert.equal(readStromJson(tree(17)).fieldsKept, undefined);
  assert.equal(readStromJson(tree()).fieldsKept, undefined);
});
