// A family tree saved by another program keeps its encoding: UTF-8 with a BOM (Notepad, Windows PowerShell 5's
// `-Encoding UTF8`), UTF-16 LE or BE (`-Encoding Unicode`), CRLF lines — intake and sync read it as the same tree.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { decodeText } from "../../src/core/text.ts";
import { opts as syncOpts, world, edited } from "./sync.helpers.ts";

const opts = { skip: !hasGit };

const crlf = (s: string) => s.replace(/\r?\n/g, "\r\n");
const ENCODINGS: Record<string, (s: string) => Buffer> = {
  "utf8-bom": (s) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(s, "utf8")]),
  "utf8-bom-crlf": (s) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(crlf(s), "utf8")]),
  "utf16le-bom": (s) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(crlf(s), "utf16le")]),
  "utf16be-bom": (s) => Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(crlf(s), "utf16le").swap16()]),
  "utf16le": (s) => Buffer.from(s, "utf16le"),
};

const ged = (given: string) => `0 HEAD
1 CHAR UTF-8
0 @I1@ INDI
1 NAME ${given} /Dvořák/
1 SEX M
1 BIRT
2 DATE 1870
2 PLAC Týnec
0 @I2@ INDI
1 NAME Мария /Иванова/
1 SEX F
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
0 TRLR
`;

const appJson = (given: string) =>
  JSON.stringify({
    version: 12,
    persons: {
      p_a: { id: "p_a", firstName: given, lastName: "Nováková", gender: "female", birthDate: "1872", birthPlace: "Týnec" },
      p_b: { id: "p_b", firstName: "Jiří", lastName: "Novák", gender: "male" },
    },
    partnerships: { u_1: { id: "u_1", person1Id: "p_a", person2Id: "p_b" } },
  });

test("decodeText: a BOM is never text; UTF-16 LE/BE by its BOM or by its zero bytes; decomposed letters stay as written", () => {
  const s = "0 HEAD\nŽofie Dvořáková Мария Zémla\n";
  for (const [name, enc] of Object.entries(ENCODINGS)) assert.equal(decodeText(enc(s)).replace(/\r\n/g, "\n"), s, name);
  assert.equal(decodeText(Buffer.from(s, "utf8")), s);
  assert.equal(decodeText(Buffer.from("0 HEAD", "utf16le").swap16()), "0 HEAD");
  assert.equal(decodeText(Buffer.alloc(0)), "");
});

test("intake: a family tree with a BOM, in UTF-16 or with CRLF is a family tree — its people taken in", opts, async () => {
  const w = new World();
  await w.withTree();
  let n = 0;
  for (const [name, enc] of Object.entries(ENCODINGS)) {
    for (const [ext, text] of [
      [".ged", ged(`Jan${name}`)],
      [".json", appJson(`Anna${name}`)],
    ] as const) {
      const f = path.join(w.dir, `rodokmen-${name}${ext}`);
      fs.writeFileSync(f, enc(text));
      const r = (await w.ok(["intake", f, "--json"])).json;
      assert.equal(r.inputs.length, 1, `${name}${ext}`);
      assert.equal(r.inputs[0].kind, "tree", `${name}${ext}: a family tree, not "other"`);
      const input = readJsonFile(path.join(w.cwd, "data", "inputs", `${r.inputs[0].id}.json`));
      assert.equal(input.imported?.persons, 2, `${name}${ext}: its people taken in`);
      n += 2;
    }
  }
  const people = (await w.ok(["person", "list", "--json", "--full"])).json.persons;
  assert.equal(people.length, n);
  assert.ok(people.some((p: any) => p.names[0].given === "Мария"), "Cyrillic read whole from UTF-16");
  assert.ok(people.every((p: any) => !/[﻿\u0000]/.test(JSON.stringify(p.names))), "no BOM or zero byte in a name");
  assert.ok(people.some((p: any) => p.names[0].given === "Janutf16be-bom"));
  w.cleanup();
});

test("sync: the app's file saved again with a BOM, in UTF-16 or with CRLF shows the same changes; written, the input kept as UTF-8", syncOpts, async () => {
  const { w, ged: file } = await world();
  const plain = edited(file, path.join(w.dir, "z-aplikace.ged"));
  const text = fs.readFileSync(plain, "utf8");
  const want = (await w.ok(["sync", plain, "--json"])).json.changes.length;
  assert.ok(want > 0);
  for (const [name, enc] of Object.entries(ENCODINGS)) {
    const f = path.join(w.dir, `z-aplikace-${name}.ged`);
    fs.writeFileSync(f, enc(text));
    const r = await w.run(["sync", f, "--json"]);
    assert.equal(r.code, 0, `${name}: ${r.err}`);
    assert.equal(r.json.changes.length, want, name);
  }
  const f = path.join(w.dir, "z-aplikace-utf16le-bom.ged");
  const done = (await w.ok(["sync", f, "--apply", "--json"])).json;
  const input = readJsonFile(path.join(w.cwd, "data", "inputs", `${done.input}.json`));
  assert.match(fs.readFileSync(path.join(w.cwd, input.file), "utf8"), /^0 HEAD\r?\n/, "kept as UTF-8, no BOM");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

const FIXTURES = path.join(import.meta.dirname, "..", "fixtures", "gedcom-encoding");

test("intake: a family tree of a Windows program in its code page (CHAR ANSI, CP1250) — its letters whole, the code page said", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "en"]);
  const ansi = path.join(w.dir, "rodokmen-ansi.ged");
  fs.copyFileSync(path.join(FIXTURES, "ansi-czech.ged"), ansi);
  const r = await w.ok(["intake", ansi]);
  assert.match(r.out, /I\d+: read in the encoding Windows-1250/);
  assert.doesNotMatch(r.out, /could not be read/);
  const people = (await w.ok(["person", "list", "--json", "--full"])).json.persons;
  const named = people.map((p: any) => `${p.names[0].given} ${p.names[0].surname}`);
  for (const n of ["Vojtěch Lhoták", "Zdeňka Lhotáková", "Řehoř Lhoták", "Ludmila Lhotáková", "Matěj Lhoták"]) assert.ok(named.includes(n), `${n} in ${named.join(", ")}`);
  assert.ok(!named.some((n: string) => /[øìèò]/u.test(n)), "no Windows-1252 look-alikes");
  // in the research's language, and in --json
  await w.ok(["lang", "cs"]);
  const cp = path.join(w.dir, "rodokmen-cp1250.ged");
  fs.copyFileSync(path.join(FIXTURES, "cp1250-czech.ged"), cp);
  assert.match((await w.ok(["intake", cp])).out, /přečteno v kódování Windows-1250/);
  const polish = path.join(w.dir, "rodokmen-pl.ged");
  fs.copyFileSync(path.join(FIXTURES, "ansi-polish.ged"), polish);
  const j = (await w.ok(["intake", polish, "--json"])).json;
  assert.equal(j.inputs[0].encoding, "windows-1250");
  assert.equal(j.inputs[0].unreadable, undefined);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("intake: characters that could not be read are said with their line, never replaced in silence; UTF-8 says nothing", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "en"]);
  const bad = path.join(w.dir, "rodokmen-poskozeny.ged");
  fs.copyFileSync(path.join(FIXTURES, "utf8-stray-byte.ged"), bad);
  const r = await w.ok(["intake", bad, "--json"]);
  assert.equal(r.json.inputs[0].unreadable, 1);
  assert.equal(r.json.inputs[0].unreadableLines.length, 1);
  assert.equal(r.json.inputs[0].encoding, undefined, "UTF-8: no code page to say");
  const again = path.join(w.dir, "rodokmen-ansel.ged");
  fs.copyFileSync(path.join(FIXTURES, "ansel-unknown-byte.ged"), again);
  const t = (await w.ok(["intake", again])).out;
  assert.match(t, /I\d+: read in the encoding ANSEL/);
  assert.match(t, /I\d+: 1 character could not be read \(line 7\) – the names and places there need checking/);
  const plain = path.join(w.dir, "rodokmen-utf8.ged");
  fs.copyFileSync(path.join(FIXTURES, "ansi-utf8-czech.ged"), plain);
  const u = await w.ok(["intake", plain]);
  assert.doesNotMatch(u.out, /encoding|could not be read/, "valid UTF-8 labelled ANSI: nothing to say");
  w.cleanup();
});

test("sync: a GEDCOM of another program in Windows-1250 — its people with their letters, the code page said; kept as UTF-8", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "en"]);
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
  const file = path.join(w.dir, "lhotakovi-ansi.ged");
  fs.copyFileSync(path.join(FIXTURES, "ansi-czech.ged"), file);
  const shown = await w.ok(["sync", file, "--force"]);
  assert.match(shown.out, /lhotakovi-ansi\.ged: read in the encoding Windows-1250/);
  assert.match(shown.out, /Řehoř/);
  assert.equal((await w.ok(["sync", file, "--force", "--json"])).json.encoding, "windows-1250");
  const done = (await w.ok(["sync", file, "--force", "--apply", "--json"])).json;
  assert.equal(done.encoding, "windows-1250");
  const input = readJsonFile(path.join(w.cwd, "data", "inputs", `${done.input}.json`));
  const kept = fs.readFileSync(path.join(w.cwd, input.file), "utf8");
  assert.match(kept, /^1 CHAR UTF-8\r?$/m, "its header says what it is now");
  assert.match(kept, /Řehoř \/Lhoták\//);
  const people = (await w.ok(["person", "list", "--json", "--full"])).json.persons;
  assert.ok(people.some((p: any) => p.names[0].given === "Řehoř"));
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});
