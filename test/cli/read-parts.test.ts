// strom read of images registered only in parts (a half, a detail fetched sharper): readers read whole images — a book
// with a connector is told the fetch of them through it, only a book without one is told to add them by hand (N0285:
// "strom media add <folder>" in a run nobody watches, the book's connector at hand).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { opts, scans, world } from "./connectors.helpers.ts";

test("strom read over images registered only in parts: the fetch through the book's connector, media add only for a book without one", opts, async () => {
  const { w, a } = await world();
  try {
    await w.ok(["recordset", "add", "Žďár N 1784–1820", "--kinds", "baptism"]); // B0001: images through the connector
    await w.ok(["recordset", "add", "Луга 1790", "--kinds", "baptism"]); // B0002: by hand
    await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
    for (const [book, f] of [["B1", "grey.jpg"], ["B2", "base444.jpg"]] as const) {
      const half = path.join(w.dir, `půlka ${book} ř.jpg`);
      fs.copyFileSync(path.join(scans, f), half);
      await w.ok(["media", "add", half, "--recordset", book, "--image", "5", "--half", "left"]);
    }
    const book = await w.run(["read", "B1", "--images", "4-6", "--question", "Křty Nováků"]);
    assert.equal(book.code, 2);
    assert.match(book.err, /no whole images 4–6 of B0001: registered only in parts \(images 5\): readers need whole images/);
    assert.match(book.err, /→ strom fetch zkusebni 5359 --images 4-6 --recordset B0001/);
    assert.doesNotMatch(book.err, /media add/);
    const byHand = await w.run(["read", "B2", "--images", "5", "--question", "Křty Nováků"]);
    assert.match(byHand.err, /no whole image 5 of B0002: registered only in parts \(images 5\)/);
    assert.match(byHand.err, /→ strom media add <folder> --recordset B0002/);
    // nothing of it registered at all: as before, the connector's fetch where the book has one
    assert.match((await w.run(["read", "B1", "--images", "7-9", "--question", "Křty Nováků"])).err, /no registered images 7–9 of B0001\n→ strom fetch zkusebni 5359 --images 7-9 --recordset B0001/);
    // some whole, some in parts: the parts said, the whole ones read
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, 'const p = process.env.STROM_PROMPT ?? "";\nfor (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\n');
    const mixed = await w.ok(["read", "B1", "--images", "1-5", "--whole", "--question", "Křty Nováků", "--agent", "script"]);
    assert.match(mixed.out, /^B0001: registered only in parts \(images 5\): readers need whole images, these are not read → strom fetch zkusebni 5359 --images 5 --recordset B0001$/m);
    assert.match(mixed.out, /▶ reader 1\/1: 2 images \(1–2\)/);
  } finally {
    w.cleanup();
    await a.close();
  }
});
