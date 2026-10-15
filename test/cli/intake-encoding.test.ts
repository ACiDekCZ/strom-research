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
