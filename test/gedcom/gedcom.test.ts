// GEDCOM: line splitting, the validator, the exporter, and a round trip
// through the real Strom app importer (skipped when ../strom is not there).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { GedWriter, joinText, splitParagraph } from "../../src/gedcom/lines.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };

test("lines: CONC splits by bytes, never next to a space; CONT keeps line breaks", () => {
  const long = "Ženich veden jako honestus adolescens, svobodný mládenec ve třiceti letech, poddaný panství Novohradského. ".repeat(6).trim();
  const w = new GedWriter();
  w.text(1, "NOTE", `${long}\nDruhý řádek.\n\nPo prázdném řádku.`);
  for (const l of w.lines) {
    assert.ok(Buffer.byteLength(l) <= 255, l);
    const v = l.replace(/^\d+ [A-Z]+ ?/, "");
    if (l.includes(" CONC ")) assert.ok(!v.startsWith(" ") && !v.endsWith(" "), `space at a CONC edge: "${l}"`);
  }
  const [first, ...rest] = w.lines;
  const back = joinText(first!.replace(/^1 NOTE /, ""), rest.map((l) => ({ tag: l.split(" ")[1]!, value: l.split(" ").slice(2).join(" ") })));
  assert.equal(back, `${long}\nDruhý řádek.\n\nPo prázdném řádku.`);
  assert.deepEqual(splitParagraph("abc", 10), ["abc"]);
});

test("validator: catches structure, tags in the wrong place, bad dates, dangling pointers", () => {
  const bad = [
    "0 HEAD",
    "1 CHAR UTF-8",
    "0 @I1@ INDI",
    "1 NAME Jan /Novák",
    "1 SEX X",
    "1 MARR",
    "2 DATE 31 FEB 1800",
    "3 NOTE jump",
    "1 FAMC @F9@",
    "0 @I1@ INDI",
    "1 " + "x".repeat(260),
  ].join("\n");
  const msgs = validateGedcom(bad).map((f) => f.message).join("\n");
  for (const m of ["unbalanced surname slashes", "SEX must be", "MARR is not expected under INDI", "invalid date", "@F9@, which is not defined", "defined twice", "bytes (max 255)", "must end with 0 TRLR"])
    assert.ok(msgs.includes(m), `missing: ${m}\n${msgs}`);
  const good = "0 HEAD\n1 SOUR X\n1 SUBM @U1@\n1 CHAR UTF-8\n1 GEDC\n2 VERS 5.5.1\n0 @I1@ INDI\n1 NAME Jan /Novák/\n1 BIRT\n2 DATE ABT 1905\n0 @U1@ SUBM\n1 NAME X\n0 TRLR\n";
  assert.deepEqual(validateGedcom(good), []);
  assert.ok(validateGedcom("0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 BIRT\n2 _WITN Marie\n0 TRLR", { strict: true }).some((f) => f.level === "error"));
});

async function richTree(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905", "--born-place", "Týnec nad Labem"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M", "--born", "1870"]);
  await w.ok(["person", "add", "Marie /Svobodová/", "--sex", "F"]);
  await w.ok(["person", "add", "Karel /Dvořák/", "--sex", "M"]);
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1", "--married", "1898", "--married-place", "Týnec nad Labem"]);
  await w.ok(["family", "add", "--partner", "P4", "--child", "P1", "--relation", "adopted"]);
  await w.ok(["repo", "add", "SOA Praha", "--url", "https://ebadatelna.soapraha.cz", "--automation", "manual"]);
  await w.ok(["recordset", "add", "Týnec 17, N 1903-1920", "--repo", "R1", "--kinds", "baptism", "--places", "Týnec nad Labem", "--years", "1903-1920", "--access", "online-free"]);
  await w.ok(["source", "add", "Křest Jana Nováka 1905", "--kind", "baptism", "--recordset", "B1", "--information", "primary", "--transcript", "Joannes filius legitimus Josephi Novák molitoris in Tynec et Mariae natae Svoboda. ".repeat(5)]);
  await w.ok(["event", "add", "P1", "CHR", "--date", "25 JUN 1905", "--place", "Týnec nad Labem", "--cite", "S1", "--locator", "fol. 45, č. 12", "--status", "proven", "--with", "godparent:Marie Dvořáková", "--with", "witness:P4"]);
  await w.ok(["event", "add", "P2", "OCCU", "--value", "mlynář", "--note", "podle babičky"]);
  await w.ok(["event", "add", "P2", "EVEN", "--label", "Požár stavení", "--date", "NOV 1905"]);
  await w.ok(["event", "add", "P2", "MILI", "--date", "1890"]);
  await w.ok(["event", "add", "P2", "DEAT", "--date", "1931"]);
  await w.ok(["event", "retract", "E0008", "--reason", "zaměněn se jmenovcem"]); // the death
  await w.ok(["note", "add", "P1", "Dlouhá poznámka o mlýně a rodině, která se nevejde na jeden řádek GEDCOMu, protože česká diakritika zabírá v UTF-8 dva bajty a limit je 255 bajtů na fyzický řádek souboru."]);
  await w.ok(["place", "add", "Týnec nad Labem", "--lat", "50.042", "--lon", "15.358"]);
  // the newer shapes: ages, a quote, a call number, an engagement, a literal @
  await w.ok(["recordset", "add", "Týnec 12, O 1890-1910", "--repo", "R1", "--call-number", "Sig. 12/7", "--kinds", "marriage", "--places", "Týnec nad Labem", "--years", "1890-1910"]);
  await w.ok(["source", "add", "Sňatek Josefa Nováka 1898", "--kind", "marriage", "--recordset", "B2", "--information", "primary", "--locator", "fol. 3"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "12 FEB 1898", "--cite", "S2", "--age", "husband:28 let", "--age", "wife:22", "--quote", "Josephus Novák annorum 28"]);
  await w.ok(["event", "add", "F1", "ENGA", "--date", "1897"]);
  await w.ok(["event", "add", "P3", "DEAT", "--date", "1950", "--age", "annorum 74", "--cite", "S2", "--status", "possible"]);
  await w.ok(["note", "add", "P2", "Dopis od tety: marie@example.cz"]);
  return w;
}

test("export: two files from the same evidence — standard and for Strom; valid, complete; retracted facts left out", opts, async () => {
  const w = await richTree();
  const r = await w.ok(["export", "gedcom", "--json"]);
  assert.equal(r.json.ok, true);
  assert.deepEqual(r.json.files.map((f: any) => [f.for, path.basename(f.file)]), [["standard", "tree.ged"], ["strom", "tree-strom.ged"]]);
  assert.deepEqual(r.json.stats, { persons: 4, families: 2, sources: 2, repositories: 1, events: 10, skipped: 1 });
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  assert.match(ged, /1 REFN P0001/);
  assert.match(ged, /1 OCCU mlynář\n/); // the fact on the tag line
  assert.match(ged, /1 EVEN\n2 TYPE Požár stavení/);
  assert.match(ged, /1 EVEN\n2 TYPE Vojenská služba\n2 DATE 1890/); // MILI has no standard tag
  assert.match(ged, /2 SOUR @S0001@\n3 PAGE fol\. 45, č\. 12\n3 QUAY 3/);
  assert.match(ged, /2 _WITN Marie Dvořáková\n3 RELA Godparent/);
  assert.match(ged, /2 ASSO @P0004@\n3 RELA Witness/);
  assert.match(ged, /1 FAMC @F0002@\n2 PEDI adopted/);
  assert.match(ged, /4 LATI N50\.042\n4 LONG E15\.358/);
  assert.ok(!ged.includes("DATE 1931"), "retracted death must not be exported");
  // The best-supported fact of a kind comes first: readers take the first MARR.
  assert.ok(ged.indexOf("1 MARR\n2 DATE 12 FEB 1898") < ged.indexOf("1 MARR\n2 DATE 1898\n"), "the cited marriage before the lead");
  assert.match(ged, /2 HUSB\n3 AGE 28y\n2 WIFE\n3 AGE 22y/);
  assert.match(ged, /1 DEAT\n2 DATE 1950\n2 AGE 74y/);
  assert.match(ged, /Věk: Josef Novák 28 let, Marie Svobodová 22 let/, "ages also in the note until Strom reads AGE");
  assert.match(ged, /Zápis: „Josephus Novák annorum 28“/);
  assert.match(ged, /1 FAM[\s\S]*?1 ENGA\n2 DATE 1897/);
  assert.match(ged, /1 REPO @R0001@\n2 CALN Sig\. 12\/7/);
  assert.match(ged, /marie@@example\.cz/, "a literal @ is doubled");
  // QUAY is the quality of the evidence: an original with primary information is 3 even for a possible conclusion.
  assert.match(ged, /2 DATE 1950\n2 AGE 74y\n2 SOUR @S0002@\n3 PAGE fol\. 3\n3 QUAY 3/);
  // One note per source (the Strom importer keeps only the last one).
  const s1 = ged.slice(ged.indexOf("0 @S0001@ SOUR"), ged.indexOf("\n0 ", ged.indexOf("0 @S0001@ SOUR")));
  assert.equal(s1.match(/^1 NOTE/gm)?.length, 1, s1);
  assert.match(s1, /Doklad: původní záznam, primární informace/);
  assert.match(s1, /^1 TEXT Joannes/m, "the words of the record are the source's TEXT (agreed with Strom)");
  const strict = await w.ok(["export", "gedcom", "--for", "standard", "--out", path.join(w.dir, "strict.ged"), "--json"]);
  const plain = fs.readFileSync(strict.json.file, "utf8");
  assert.ok(!plain.includes("_WITN"));
  assert.match(plain, /1 ASSO @P0004@\n2 RELA Witness/, "5.5.1: associations on the individual");
  assert.doesNotMatch(plain, /^2 ASSO/m);
  assert.match(plain, /^1 TEXT Joannes/m, "the transcript as TEXT");
  assert.match(plain, /3 DATA\n4 TEXT Josephus Novák annorum 28/, "the words of the record as citation data");
  assert.deepEqual(validateGedcom(plain, { strict: true }).filter((f) => f.level === "error"), []);
  assert.equal((await w.ok(["gedcom", "validate", strict.json.file, "--for", "standard"])).code, 0);
  assert.equal(plain, fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8").replace(/^1 DATE .*$/m, plain.match(/^1 DATE .*$/m)![0]), "output/tree.ged is the standard one");
  assert.equal((await w.run(["export", "gedcom", "--out", path.join(w.dir, "x.ged")])).code, 2, "--out writes one file");
  w.cleanup();
});

test("export: only the people of one research", opts, async () => {
  const w = await richTree();
  await w.ok(["person", "add", "Cizí /Osoba/"]);
  const r = (await w.ok(["export", "gedcom", "--research", "G1", "--json"])).json;
  assert.equal(r.stats.persons, 4); // focus, both parents, adoptive father — not the stranger
  assert.ok(r.file.endsWith(path.join("output", "G0001.ged")));
  w.cleanup();
});

const stromRepo = path.resolve(import.meta.dirname, "..", "..", "..", "strom");
const tsx = path.join(stromRepo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");

test("round trip: the Strom app importer reads everything and drops nothing", { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
  const w = await richTree();
  await w.ok(["export", "gedcom"]);
  const ged = path.join(w.cwd, "output", "tree-strom.ged");
  const script = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "strom-rt-")), "rt.ts");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(stromRepo, "src", "ged-parser.ts"))};
const parsed = parseGedcom(fs.readFileSync(process.argv[2], "utf8"));
const conv = convertToStrom(parsed);
const persons = Object.values(conv.data.persons) as any[];
const jan = persons.find((p) => p.refn === "P0001");
console.log(JSON.stringify({
  dropped: [...parsed.droppedTags.entries()],
  stats: conv.stats,
  persons: persons.length,
  partnerships: Object.keys(conv.data.partnerships).length,
  sources: Object.keys(conv.data.sources ?? {}).length,
  refns: persons.map((p) => p.refn).sort(),
  jan: { first: jan?.firstName, last: jan?.lastName, birth: jan?.birthDate, events: (jan?.events ?? []).map((e: any) => ({ type: e.type, date: e.date, participants: e.participants })) },
  josef: persons.find((p) => p.refn === "P0002")?.events?.map((e: any) => ({ type: e.type, label: e.customLabel, value: e.note })),
}));
`,
  );
  const r = spawnSync(tsx, [script, ged], { cwd: stromRepo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim().split("\n").pop()!);
  assert.deepEqual(out.dropped, [], `Strom dropped tags: ${JSON.stringify(out.dropped)}`);
  assert.equal(out.stats.unsupportedTags, 0);
  assert.equal(out.persons, 4);
  assert.equal(out.sources, 2);
  assert.deepEqual(out.refns, ["P0001", "P0002", "P0003", "P0004"]);
  assert.deepEqual([out.jan.first, out.jan.last], ["Jan", "Novák"]);
  const chr = out.jan.events.find((e: any) => /christ|chr|bapt/i.test(e.type));
  assert.ok(chr, JSON.stringify(out.jan.events));
  assert.equal(chr.participants?.length, 2, JSON.stringify(chr));
  assert.ok(out.josef.some((e: any) => e.value === "mlynář"), JSON.stringify(out.josef));
  assert.ok(out.josef.some((e: any) => e.label === "Požár stavení"), JSON.stringify(out.josef));
  w.cleanup();
});

test("cause of death, the files the settings ask for, the Strom version that reads the tags", opts, async () => {
  const w = await richTree();
  await w.ok(["event", "add", "P4", "DEAT", "--date", "1901", "--place", "Týnec", "--house", "7", "--cause", "Lungensucht", "--age", "61"]);
  await w.ok(["export", "gedcom"]);
  const standard = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  const strom = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.match(standard, /1 DEAT\n2 DATE 1901\n2 PLAC Týnec\n2 ADDR (čp\.|House No\.) 7\n3 CITY Týnec\n2 CAUS Lungensucht\n2 AGE 61y\n/);
  assert.match(strom, /2 ADDR (čp\.|House No\.) 7\n2 CAUS Lungensucht\n2 AGE 61y\n/);
  assert.match(strom, /(Příčina|Cause): Lungensucht/, "said in the note too until Strom reads CAUS");
  assert.doesNotMatch(standard, /(Příčina|Cause): Lungensucht/);
  // only the Strom file, for this tree
  fs.rmSync(path.join(w.cwd, "output"), { recursive: true });
  await w.ok(["config", "set", "gedcom.for", "strom", "--for-tree"]);
  await w.ok(["export", "gedcom"]);
  assert.deepEqual(fs.readdirSync(path.join(w.cwd, "output")), ["tree-strom.ged"]);
  assert.equal((await w.run(["config", "set", "gedcom.for", "gramps"])).code, 2);
  assert.equal((await w.run(["config", "set", "strom.version", "one"])).code, 2);
  await w.ok(["config", "set", "strom.version", "1.4.0"]);
  w.cleanup();
});

test("the Strom version from which the notes repeating the tags are left out", async () => {
  const { stromReadsTags } = await import("../../src/gedcom/export.ts");
  assert.equal(stromReadsTags("1.4.0", undefined), false, "not released yet: keep the notes");
  assert.equal(stromReadsTags(undefined, "1.4.0"), false, "unknown Strom: keep them");
  assert.equal(stromReadsTags("1.3.9", "1.4.0"), false);
  assert.equal(stromReadsTags("1.4.0", "1.4.0"), true);
  assert.equal(stromReadsTags("2.0", "1.4.0"), true);
});

test("Strom's own export comes back: ages in words, cause and address from its notes, a midwife from RELA Present", opts, async () => {
  const w = new World();
  await w.withTree();
  // the shape the Strom app writes (its strings: "Úmrtí: Věk: 61 let", "Věk ženicha: 27 let" …)
  const ged = [
    "0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
    "0 @I1@ INDI", "1 NAME Jakub /Víšek/", "1 SEX M",
    "1 DEAT", "2 DATE 1838", "2 PLAC Vavřinec",
    "1 NOTE Úmrtí: Věk: 61 let", "2 CONT Úmrtí: Příčina: Lungensucht", "2 CONT Úmrtí: Adresa: čp. 10", "2 CONT Pohřben u kostela.",
    "0 @I2@ INDI", "1 NAME Jan /Víšek/", "1 SEX M",
    "1 BIRT", "2 DATE 1812", "2 PLAC Vavřinec", "2 ADDR čp. 12",
    "2 _WITN Anna Nová", "3 RELA Present", "3 NOTE porodní bába",
    "2 _WITN Franz Dvořáček", "3 RELA Godparent",
    "1 RESI", "2 DATE 1839", "2 PLAC Vavřinec", "2 NOTE Věk: 27 let 3 měsíce",
    "0 @I3@ INDI", "1 NAME Anna /Víšková/", "1 SEX F",
    "1 DEAT", "2 DATE 1840", "1 NOTE Úmrtí: Věk: kojenec",
    "0 @I4@ INDI", "1 NAME Markéta /Ševčíková/", "1 SEX F",
    "0 @F1@ FAM", "1 HUSB @I2@", "1 WIFE @I4@", "1 MARR", "2 DATE 28 MAY 1839", "2 PLAC Petrovice",
    "1 NOTE Věk ženicha: 27 let", "2 CONT Věk nevěsty: 17 let",
    "0 TRLR",
  ].join("\n");
  fs.writeFileSync(path.join(w.dir, "strom-export.ged"), ged + "\n");
  await w.ok(["intake", path.join(w.dir, "strom-export.ged")]);
  const people = fs.readdirSync(path.join(w.cwd, "data", "persons")).map((f) => readJsonFile(path.join(w.cwd, "data", "persons", f)));
  const byName = (g: string) => people.find((p) => p.names[0].given === g)!;
  const jakub = byName("Jakub");
  const deat = jakub.events.find((e: any) => e.kind === "DEAT");
  assert.deepEqual([deat.age, deat.cause, deat.house], ["61y", "Lungensucht", "10"]);
  assert.deepEqual(jakub.notes.map((n: any) => n.text), ["Pohřben u kostela."], "what became a field is not repeated in the note");
  const jan = byName("Jan");
  const birt = jan.events.find((e: any) => e.kind === "BIRT");
  assert.equal(birt.house, "12", "čp. is the word for it, not the house");
  assert.deepEqual(birt.participants.map((p: any) => `${p.role}:${p.name}`), ["midwife:Anna Nová", "godparent:Franz Dvořáček"]);
  assert.equal(jan.events.find((e: any) => e.kind === "RESI").age, "27y 3m");
  assert.equal(byName("Anna").events.find((e: any) => e.kind === "DEAT").age, "INFANT");
  const fam = readJsonFile(path.join(w.cwd, "data", "families", fs.readdirSync(path.join(w.cwd, "data", "families"))[0]!));
  assert.deepEqual(fam.events[0].ages, { [jan.id]: "27y", [byName("Markéta").id]: "17y" });
  assert.deepEqual(fam.notes, [], "the ages were the whole note");
  w.cleanup();
});
