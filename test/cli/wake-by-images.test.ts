// Images of a book registered wake the tasks that wait for them — never the person's check of a site, and somebody's
// answer (a letter, the family) only when it waits on that book, not because it works in it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

test("images registered wake what waits for the book: never a site check, a letter only when it waits on the book", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["recordset", "add", "Lhota 3, N 1860-1880", "--kinds", "baptism", "--places", "Lhota", "--years", "1860-1880"]); // B1
  const add = (what: string) => w.ok(["task", "add", what, "--level", "link", "--where", "B0001", "--why", "otec Jana", "--done-when", "zápis nalezen", "--about", "P0001"]);
  await add("Křest Jana Lhotáka"); // T1
  await add("Opis křtu z matriky"); // T2
  await add("Křest Jana podle webu farnosti"); // T3
  await add("Snímky z archivu"); // T4
  await w.ok(["task", "wait", "T0001", "--on", "Snímky knihy, až budou."]);
  await w.ok(["task", "wait", "T0002", "--on", "Odpověď matriky na žádost o opis křtu.", "--kind", "letter", "--to", "matrika Lhota"]);
  await w.ok(["search", "add", "Křty Lhota 1860–1880", "--method", "web", "--result", "inconclusive", "--task", "T0003", "--note", "archive.example.org refused automated access; tried instead: the parish's index"]);
  await w.ok(["task", "wait", "T0003", "--check", "https://archive.example.org/book/5359", "--on", "zda jsou tam křty 1860–1880 se snímky"]);
  await w.ok(["task", "wait", "T0004", "--on", "Snímky B0001 od archivu na žádost.", "--kind", "letter", "--to", "archiv"]);
  const scans = path.join(w.dir, "lhota3");
  fs.mkdirSync(scans);
  fs.copyFileSync(path.join(fixtures, "s0001.jpg"), path.join(scans, "s0001.jpg"));
  await w.ok(["media", "add", scans, "--recordset", "B0001"]);
  const state = async (id: string) => (await w.ok(["task", "show", id, "--json"])).json.task.state;
  assert.equal(await state("T0001"), "open", "it waited for the book's images");
  assert.equal(await state("T0002"), "waiting", "a letter about the entry: the reply still awaited");
  assert.equal(await state("T0003"), "waiting", "the person's check of a site: only the person answers it");
  assert.equal(await state("T0004"), "open", "a letter for the book's images: they came");
});
