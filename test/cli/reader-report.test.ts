// A reader adds each image block at one fixed line of strom's at the end of its report, never at the question (N0292:
// four readers anchored their first edit on a question of 768 characters written from memory — a word "corrected", its
// end made up — and the edit failed; one wrote the whole file again). The line stays last while the reader writes and
// is gone from the report once it ended; a report with the line still in it reads the same.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { NEXT_BLOCK, parseReport, readerPrompt, withoutNextBlock } from "../../src/core/reader.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

test("the reader is told to add each block at strom's last line, never to retype the question or write the whole file", () => {
  const p = readerPrompt({ question: "Křest Jana Nováka — oba rodiče zapiš", report: "/r.md", lang: "cs", images: [{ id: "M0001", image: 1, view: "/v.jpg" }] });
  assert.ok(p.includes(`the last of them this line:\n${NEXT_BLOCK}\n`));
  assert.match(p, /replace that line with your block followed by the same\s+line, so that it stays the last one/);
  assert.match(p, /Never type out the question or any other line of strom's/);
  assert.match(p, /never write the whole file again/);
});

test("a report with the line still in it reads the same: the line is no part of a block", () => {
  const blocks = ["## Image 1 · M0001", "result: found", "entries: Jan Novák, Žďár č. 5", "", "## Image 2 · M0002", "result: nothing", "illegible: okraj vpravo"];
  const head = ["# Reading M0001-M0002 · batch 1 of 1", "Question: Křest Jana Nováka", ""];
  const plain = parseReport([...head, ...blocks, ""].join("\n"));
  const marked = parseReport([...head, ...blocks, NEXT_BLOCK, ""].join("\n"));
  assert.deepEqual(marked, plain);
  assert.deepEqual(marked[1]!.illegible, ["okraj vpravo"]);
  assert.equal(withoutNextBlock(`a\n  ${NEXT_BLOCK}\nb`), "a\nb");
});

test("strom read: the head ends with the line, the reader's blocks go in its place, and the report it leaves has the head whole and no line", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]);
    await w.ok(["recordset", "add", "Žďár N 1847–1868", "--kinds", "baptism", "--places", "Žďár", "--years", "1847-1868"]);
    const scans = path.join(w.dir, "scans");
    fs.mkdirSync(scans);
    for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
    await w.ok(["media", "add", scans, "--recordset", "B1"]);
    // a reader that does as it is told: each block in place of the line, the line after it; what it saw kept aside
    const seen = path.join(w.dir, "seen.txt");
    const script = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(
      script,
      [
        'import fs from "node:fs";',
        'const p = process.env.STROM_PROMPT ?? "";',
        "const report = /Write your report to (.+?) AS YOU GO/.exec(p)[1];",
        `const mark = ${JSON.stringify(NEXT_BLOCK)};`,
        `fs.writeFileSync(${JSON.stringify(seen)}, fs.readFileSync(report, "utf8"));`,
        "for (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) {",
        '  const text = fs.readFileSync(report, "utf8");',
        "  if (text.split(mark).length !== 2) throw new Error('the line is not there once');",
        '  fs.writeFileSync(report, text.replace(mark, "## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\nillegible: nic\\n\\n" + mark));',
        "}",
        'console.log("done");',
      ].join("\n"),
    );
    w.env.STROM_RUNNER_SCRIPT = script;
    const question = "Křest Jana Nováka; oba rodiče zapiš, jinak nic nepřepisuj. Uveď místa nečitelná nebo nejistá (kde na snímku).";
    await w.ok(["read", "B1", "--images", "1-2", "--question", question, "--agent", "script"]);
    // what the reader found: the head, the question on one line, then the line last
    const before = fs.readFileSync(seen, "utf8");
    assert.ok(before.endsWith(`\n\n${NEXT_BLOCK}\n`), before);
    assert.ok(before.includes(`Question: ${question}\n`));
    // what it left: the head as strom wrote it, both blocks, no line
    const dir = path.join(w.cwd, "notes", "readings");
    const [file] = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    const report = fs.readFileSync(path.join(dir, file!), "utf8");
    assert.ok(!report.includes(NEXT_BLOCK), report);
    assert.ok(report.startsWith(before.slice(0, before.indexOf(NEXT_BLOCK)).trimEnd()), report);
    assert.deepEqual(parseReport(report).map((f) => [f.number, f.result]), [[1, "nothing"], [2, "nothing"]]);
    assert.match((await w.ok(["readings", "B1"])).out, /nothing/);
  } finally {
    w.cleanup();
  }
});
