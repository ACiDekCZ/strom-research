// A reader's record carries the size its views were made for and where it came from, as the views' own record says
// (found live: readers.jsonl said capFrom "default" while the same reader's views said "tuned:T…", their book's size
// tuned by strom).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const journal = (file: string): Record<string, any>[] => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

test("strom read in a book strom tuned: the reader's record the cap and capFrom of its views", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["recordset", "add", "Žďár N 1847–1868", "--kinds", "baptism", "--places", "Žďár", "--years", "1847-1868"]);
    await w.ok(["recordset", "add", "Метрическая книга Луга", "--kinds", "baptism"]);
    for (const [book, f] of [["B1", "s0001.jpg"], ["B2", "s0002.jpg"]] as const) {
      const scans = path.join(w.dir, `scans ${book}`);
      fs.mkdirSync(scans);
      fs.copyFileSync(path.join(fixtures, f), path.join(scans, "s0001.jpg"));
      await w.ok(["media", "add", scans, "--recordset", book]);
    }
    const script = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(script, 'const p = process.env.STROM_PROMPT ?? "";\nfor (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\n');
    w.env.STROM_RUNNER_SCRIPT = script;
    const readers = () => journal(path.join(w.cwd, ".strom", "metrics", "readers.jsonl"));
    const views = () => journal(path.join(w.cwd, ".strom", "views", "views.jsonl"));
    await w.ok(["read", "B1:1", "--whole", "--question", "Křest Jana Nováka", "--agent", "script"]);
    const first = readers().at(-1)!;
    assert.equal(first.capFrom, "default");
    assert.equal(first.cap, views().at(-1)!.cap);
    // strom tuned the first book for the readers' agent and model: its views bigger, said so
    const key = first.key as string;
    const at = new Date(Date.now() - 3600_000).toISOString();
    const tuned = { id: "T0a1b2c", action: "A1", what: "read", scope: "B0001", value: 4000, default: first.cap, from: first.cap, at, why: "B0001: unsure readings", basis: {} };
    fs.mkdirSync(path.join(w.cwd, ".strom", "tune"), { recursive: true });
    fs.writeFileSync(path.join(w.cwd, ".strom", "tune", "state.json"), JSON.stringify({ [key]: { books: { B0001: { read: tuned } }, hosts: {} } }));
    await w.ok(["read", "B1:1", "--whole", "--question", "Křest Jana Nováka", "--agent", "script"]);
    const r = readers().at(-1)!;
    const v = views().filter((x) => x.reader === 1).at(-1)!;
    assert.equal(v.capFrom, "tuned:T0a1b2c");
    assert.deepEqual([r.cap, r.capFrom], [v.cap, v.capFrom], "the reader's record as its views");
    // two books in one reader, one tuned: the largest, said as mixed
    await w.ok(["read", "B1:1", "B2:1", "--whole", "--question", "Křest Jana Nováka", "--agent", "script"]);
    const both = readers().at(-1)!;
    const two = views().filter((x) => x.reader === 1).slice(-2);
    assert.deepEqual(new Set(two.map((x) => x.capFrom)), new Set(["tuned:T0a1b2c", "default"]));
    assert.deepEqual([both.cap, both.capFrom], [Math.max(...two.map((x) => x.cap)), "mixed"]);
    // --max: the option, for the reader and its views alike
    await w.ok(["read", "B1:1", "--whole", "--max", "300", "--question", "Křest Jana Nováka", "--agent", "script"]);
    assert.deepEqual([readers().at(-1)!.cap, readers().at(-1)!.capFrom], [300, "option"]);
  } finally {
    w.cleanup();
  }
});
