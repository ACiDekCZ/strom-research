// Lines of a file read piece by piece (core/lines.ts): a log of hundreds of MB never held whole, a line longer than the
// limit skipped and counted — memory bounded by one piece and one line, whatever the file.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { eachFileLine, eachGzipLine, eachLineOf } from "../../src/core/lines.ts";

function source(text: string): (b: Buffer) => number {
  const data = Buffer.from(text, "utf8");
  let at = 0;
  return (b) => {
    const n = Math.min(b.length, data.length - at);
    data.copy(b, 0, at, at + n);
    at += n;
    return n;
  };
}

test("lines across the pieces, whole and in order; diacritics, Cyrillic and a character cut between pieces", () => {
  const text = "první řádek\nвторая строка\n\n{\"a\":\"Dvořák\"}\r\nposlední bez konce";
  for (const chunk of [1, 2, 3, 7, 64]) {
    const got: string[] = [];
    const st = eachLineOf(source(text), (l) => got.push(l), { chunk });
    assert.deepEqual(got, ["první řádek", "вторая строка", '{"a":"Dvořák"}', "poslední bez konce"], `chunk ${chunk}`);
    assert.equal(st.long, 0);
  }
});

test("a line longer than the limit is skipped and counted, never held: what is held stays within the limit", () => {
  const long = "x".repeat(10_000);
  const text = `a\n${long}\nb\n${long}`;
  const got: string[] = [];
  const st = eachLineOf(source(text), (l) => got.push(l), { chunk: 64, maxLine: 1000 });
  assert.deepEqual(got, ["a", "b"]);
  assert.equal(st.long, 2);
  assert.ok(st.held <= 1000, `held ${st.held}`);
  // a line just within the limit is kept
  const fits = eachLineOf(source(`${"y".repeat(1000)}\n`), (l) => got.push(l), { chunk: 64, maxLine: 1000 });
  assert.deepEqual([fits.long, got.at(-1)?.length], [0, 1000]);
});

test("a filter looks at a line before it becomes text", () => {
  const got: string[] = [];
  eachLineOf(source('{"type":"assistant"}\n{"type":"user","x":1}\n'), (l) => got.push(l), { chunk: 5, filter: (b) => b.includes('"assistant"') });
  assert.deepEqual(got, ['{"type":"assistant"}']);
});

test("a file and its compressed copy read the same; a file that is not there throws (said, never passed over)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-lines-"));
  try {
    const text = Array.from({ length: 500 }, (_, i) => `řádek ${i}`).join("\n") + "\n";
    fs.writeFileSync(path.join(dir, "a.log"), text);
    fs.writeFileSync(path.join(dir, "a.log.gz"), zlib.gzipSync(text));
    const plain: string[] = [];
    const packed: string[] = [];
    eachFileLine(path.join(dir, "a.log"), (l) => plain.push(l), { chunk: 100 });
    eachGzipLine(path.join(dir, "a.log.gz"), (l) => packed.push(l), { chunk: 100 });
    assert.equal(plain.length, 500);
    assert.deepEqual(packed, plain);
    assert.throws(() => eachFileLine(path.join(dir, "není.log"), () => {}));
    // unpacked bigger than allowed: not read (thrown), never held whole
    assert.throws(() => eachGzipLine(path.join(dir, "a.log.gz"), () => {}, { maxBytes: 100 }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
