// Small things that said nothing: a year that is no number, a find's excerpt beside its word, a retracted image
// counted as one there.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { foldText, unfoldIndex } from "../../src/core/text.ts";

const opts = { skip: !hasGit };

test("unfoldIndex: the place of a folded match in the text itself", () => {
  for (const [text, word] of [
    ["Straße  und   Křížová cesta čp. 12", "krizova"],
    ["  Jan Novák, sedlák", "sedlak"], // decomposed, leading spaces
    ["Іван   Шевчук з Полтави", "полтави"],
    ["Groß ß Weiß", "weiss"],
  ] as [string, string][]) {
    const at = unfoldIndex(text, foldText(text).indexOf(word));
    assert.equal(foldText(text.slice(at)).startsWith(word), true, `${text} → ${text.slice(at)}`);
  }
});

test("find shows the excerpt at its word; a jurisdiction's year must be a year", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["place", "add", "Lhota", "--unlocated", "test"]);
  await w.ok(["source", "add", "Zápis", "--kind", "baptism", "--transcript", `Groß  Weiß ${"ß ".repeat(40)}Šebestián Dvořák, čp. 12`]);
  const found = await w.ok(["find", "dvorak", "--json"]);
  assert.match(found.out, /Šebestián Dvořák/);
  const bad = await w.run(["place", "jurisdiction", "L1", "--kind", "parish", "--name", "Ves", "--from", "abc"]);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /invalid --from "abc"/);
  assert.match((await w.run(["place", "jurisdiction", "L1", "--kind", "parish", "--name", "Ves", "--from", "1850", "--to", "1784"])).err, /--from 1850 is after --to 1784/);
  w.cleanup();
});

test("an image taken back is no image of its book: the task still needs the scans, the brief says none are here", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "1905"]);
  await w.ok(["recordset", "add", "Lhota N 1900-1910", "--kinds", "baptism", "--places", "Lhota", "--years", "1900-1910"]);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  fs.copyFileSync(path.join(import.meta.dirname, "..", "fixtures", "images", "s0001.jpg"), path.join(scans, "s0001.jpg"));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  await w.ok(["media", "retract", "M1", "--reason", "obraz jiné knihy"]);
  const t = (await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "5", "--json"])).json;
  assert.equal(t.needsImages, true);
  assert.match((await w.ok(["brief", t.task.id])).out, /no images here yet/);
  w.cleanup();
});
