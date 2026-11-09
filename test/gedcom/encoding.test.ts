// GEDCOM files of Czech and Polish Windows programs: "1 CHAR ANSI" means the code page of the computer that wrote the
// file (Windows-1250 there), and some programs name it outright (CP1250, WINDOWS-1250). Read as the Strom app reads them
// (its decodeGedcomBytes): fixtures in test/fixtures/gedcom-encoding/ (made-up people, make.ts).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { decodeAnsel, decodeGedcom, decodingNote, guessSingleByteEncoding, looksLikeGedcom, unreadableChars, unreadableLines } from "../../src/gedcom/encoding.ts";
import { parseGedcomText, val } from "../../src/gedcom/parse.ts";
import { CZECH, encode, ged } from "../fixtures/gedcom-encoding/make.ts";

const FIXTURES = path.join(import.meta.dirname, "..", "fixtures", "gedcom-encoding");
const fixture = (name: string) => decodeGedcom(fs.readFileSync(path.join(FIXTURES, name)));
const people = (text: string) =>
  parseGedcomText(text)
    .records.filter((r) => r.tag === "INDI")
    .map((r) => ({ name: val(r, "NAME")!.replace(/\//g, "").trim(), place: r.children.find((c) => c.tag === "BIRT")?.children.find((c) => c.tag === "PLAC")?.value ?? "" }));
const names = (text: string) => people(text).map((p) => p.name);
const places = (text: string) => people(text).map((p) => p.place);
const czech = CZECH.map(([g, s]) => `${g} ${s}`);

test("CHAR ANSI with Czech letters is Windows-1250", () => {
  const d = fixture("ansi-czech.ged");
  assert.deepEqual([d.encoding, d.how, d.declared, d.unreadable], ["windows-1250", "content", "ANSI", 0]);
  assert.deepEqual(names(d.text), czech);
  assert.ok(places(d.text).includes("Lhota u Žďáru"));
  assert.ok(places(d.text).includes("Šťastná Lhota"));
  assert.deepEqual(decodingNote(d), { encoding: "windows-1250" });
});

test("CHAR CP1250 and CHAR windows-1250 (any case) as declared", () => {
  const cp = fixture("cp1250-czech.ged");
  assert.deepEqual([cp.encoding, cp.how], ["windows-1250", "declared"]);
  assert.deepEqual(names(cp.text), czech.slice(0, 2));
  const win = fixture("windows-1250-czech.ged");
  assert.deepEqual([win.encoding, win.how, win.declared], ["windows-1250", "declared", "windows-1250"]);
  assert.deepEqual(names(win.text), czech.slice(2));
});

test("Polish ANSI (ł ą ż ś) is Windows-1250", () => {
  const d = fixture("ansi-polish.ged");
  assert.equal(d.encoding, "windows-1250");
  assert.deepEqual(names(d.text), ["Łucja Lhotowska", "Żaneta Lhocka"]);
  assert.deepEqual(places(d.text), ["Lhota Łąkowa", "Lhota Śląska"]);
});

test("Western ANSI (French, Italian, German) stays Windows-1252", () => {
  const d = fixture("ansi-western.ged");
  assert.equal(d.encoding, "windows-1252");
  assert.deepEqual(names(d.text), ["Thérèse Lhotière", "Niccolò Lhotini", "Jürgen Lhoteiß", "François Lhotier"]);
  assert.deepEqual(places(d.text), ["Besançon", "Forlì", "Köln", "Genève"]);
});

test("no CHAR, and a wrong UTF-8 label on Windows-1250 bytes: told from the bytes", () => {
  for (const name of ["no-char-czech.ged", "utf8-label-cp1250-czech.ged"]) {
    const d = fixture(name);
    assert.deepEqual([d.encoding, d.how], ["windows-1250", "content"], name);
    assert.deepEqual(names(d.text), czech, name);
    assert.equal(d.unreadable, 0, name);
  }
});

test("valid UTF-8 stays UTF-8 whatever CHAR says (ANSI, CP1250)", () => {
  for (const name of ["ansi-utf8-czech.ged", "cp1250-label-utf8-czech.ged"]) {
    const d = fixture(name);
    assert.equal(d.encoding, "utf-8", name);
    assert.deepEqual(names(d.text), czech, name);
    assert.deepEqual(decodingNote(d), {}, `${name}: nothing to say`);
  }
  // a BOM too, never part of the text
  const bom = decodeGedcom(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(ged("CP1250", CZECH), "utf8")]));
  assert.deepEqual([bom.encoding, bom.how], ["utf-8", "bom"]);
  assert.ok(bom.text.startsWith("0 HEAD"));
});

test("UTF-16 by its BOM or its zero bytes, CHAR UNICODE without a BOM", () => {
  const text = ged("UNICODE", CZECH);
  const le = Buffer.from(text, "utf16le");
  assert.deepEqual(names(decodeGedcom(Buffer.concat([Buffer.from([0xff, 0xfe]), le])).text), czech);
  assert.deepEqual(names(decodeGedcom(Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(le).swap16()])).text), czech);
  assert.equal(decodeGedcom(le).encoding, "utf-16le");
  assert.equal(decodeGedcom(Buffer.from(le).swap16()).encoding, "utf-16be");
  assert.deepEqual(decodingNote(decodeGedcom(le)), {}, "Unicode: nothing to say");
});

test("ANSEL: the mark before its letter, NFC", () => {
  const d = fixture("ansel-czech.ged");
  assert.deepEqual([d.encoding, d.how], ["ansel", "declared"]);
  assert.deepEqual(names(d.text), czech.slice(0, 3));
  assert.equal(d.text, d.text.normalize("NFC"));
  assert.equal(decodeAnsel(Buffer.from([0xe9, 0x72])), "ř");
});

test("decomposed (NFD) UTF-8 is read as written; a Cyrillic name too", () => {
  const nfd = ged("UTF-8", CZECH).normalize("NFD").replace("Matěj Lhoták".normalize("NFD"), "Мария Лхотакова");
  const d = decodeGedcom(Buffer.from(nfd, "utf8"));
  assert.equal(d.encoding, "utf-8");
  assert.equal(d.text, nfd);
  assert.equal(d.unreadable, 0, "combining marks are letters, not unreadable");
  assert.ok(names(d.text).some((n) => n.normalize("NFC") === "Vojtěch Lhoták"));
});

test("a UTF-8 file with a stray byte stays UTF-8; the byte is unreadable, said with its line", () => {
  const d = fixture("utf8-stray-byte.ged");
  assert.deepEqual([d.encoding, d.unreadable], ["utf-8", 1]);
  assert.ok(names(d.text).includes("Vojtěch Lhoták"), "the rest read whole");
  const note = decodingNote(d);
  assert.equal(note.unreadable, 1);
  assert.deepEqual(note.unreadableLines, [d.text.split(/\r\n|\n/).findIndex((l) => l.includes("�")) + 1]);
  assert.equal(note.encoding, undefined);
});

test("a byte ANSEL has no character for is unreadable, never dropped in silence", () => {
  const d = fixture("ansel-unknown-byte.ged");
  assert.equal(d.encoding, "ansel");
  assert.equal(d.unreadable, 1);
  assert.deepEqual(decodingNote(d), { encoding: "ansel", unreadable: 1, unreadableLines: [7] });
});

test("unreadable: U+FFFD, a C1 control, a lone surrogate — never a letter of any script", () => {
  assert.equal(unreadableChars("Lhoták Łucja Мария ř"), 0);
  assert.equal(unreadableChars("a�b\u0081c\uD800d\uDC00"), 4);
  assert.equal(unreadableChars("😀"), 0, "a surrogate pair is a character");
  assert.deepEqual(unreadableLines("ok\nbad�\nok\n�"), [2, 4]);
});

test("looksLikeGedcom: 0 HEAD after a BOM, blank space or in UTF-16; JSON is not", () => {
  assert.ok(looksLikeGedcom(Buffer.from("0 HEAD\n")));
  assert.ok(looksLikeGedcom(Buffer.from("﻿\r\n0 HEAD\n", "utf8")));
  assert.ok(looksLikeGedcom(Buffer.from("0 HEAD\n", "utf16le")));
  assert.ok(!looksLikeGedcom(Buffer.from('{"persons":{}}')));
});

test("word votes: Central letters vote 1250, Western companions 1252, undecided words keep ANSI's 1252", () => {
  const guess = (text: string, page: string) => guessSingleByteEncoding(encode(text, page));
  assert.equal(guess("Řehoř z Lhoty pod Řípem", "windows-1250"), "windows-1250");
  assert.equal(guess("Lhotáčková", "windows-1250"), "windows-1250");
  for (const word of ["Šťěpán", "Ľubica", "Łucja", "Łąka", "żona", "Źródło"]) assert.equal(guess(word, "windows-1250"), "windows-1250", word);
  assert.equal(guess("Hélène, Thérèse, Agnès, Niccolò", "windows-1252"), "windows-1252");
  assert.equal(guess("¿Quién? Muñoz", "windows-1252"), "windows-1252", "a Spanish ¿ is no Polish ż");
  assert.equal(guess("Jürgen Weiß, Bjørn", "windows-1252"), "windows-1252");
  assert.equal(guess("Matěj", "windows-1250"), "windows-1252");
});
