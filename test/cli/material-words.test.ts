// What strom input assign | hide | unskip say, in the research language (the person reads it — the changelog names them
// as the terminal's): each file, each task let go of or made, each person by name; nothing changed said so; German too.
// The history keeps its own words.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

/** A research in the language given, with Žofie (P1) and two files of the material in one intake task. */
async function world(lang: string): Promise<{ w: World; a: string; b: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", lang]);
  await w.ok(["person", "add", "Žofie /Dvořáková/".normalize("NFD"), "--sex", "F"]); // P1
  const dir = path.join(w.cwd, "inputs-in", "Krabice");
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(fixtures, "s0001.jpg"), path.join(dir, "dopis.jpg"));
  fs.copyFileSync(path.join(fixtures, "s0002.jpg"), path.join(dir, "svatba.jpg"));
  const got = (await w.ok(["intake", dir, "--json"])).json;
  const [a, b] = got.inputs.map((i: { id: string }) => i.id);
  return { w, a, b };
}

/** No word of the agent's English data lines. */
const english = /\b(?:hidden|dropped|shown again|of P\d|task|nothing|stays)\b/u;

test("strom input assign | hide | unskip in Czech: each file, each task, the person by name — nothing in English", opts, async () => {
  const { w, a, b } = await world("cs");
  const task = Tree.open(w.cwd, w.env).list<Task>("task").find((t) => t.where.includes(a))!.id;

  const hid = (await w.ok(["input", "hide", a, "--why", "unrelated"])).out;
  assert.match(hid, new RegExp(`^${a} skryto \\(nic z rodiny\\)$`, "mu"));
  assert.match(hid, new RegExp(`^úkol ${task} – bez ${a} \\(skryto\\)$`, "mu"));
  assert.match(hid, new RegExp(`^zobrazit znovu: strom input unskip ${a}$`, "mu"));
  const both = (await w.ok(["input", "hide", b, "--why", "duplicate"])).out;
  assert.match(both, new RegExp(`^${b} skryto \\(totéž jako jiný soubor\\)$`, "mu"));
  assert.match(both, new RegExp(`^úkol ${task} zrušen – jeho soubory jsou skryté \\(${b}\\)$`, "mu"));
  assert.match((await w.ok(["input", "hide", b, "--why", "duplicate"])).out, /^Už skryto – nic se nezměnilo\.$/mu);

  const back = (await w.ok(["input", "unskip", a])).out;
  assert.match(back, new RegExp(`^${a} znovu zobrazeno \\(čeká na roztřídění\\)$`, "mu"));
  assert.match(back, /^úkol T\d{4}: \S.*$/mu);
  assert.match((await w.ok(["input", "unskip", a])).out, /^Nic skrytého – nic se nezměnilo\.$/mu);

  const assigned = (await w.ok(["input", "assign", a, "--add", "P1"])).out;
  assert.match(assigned, new RegExp(`^${a} – nově patří k: Žofie Dvořáková \\[P0001\\]$`, "mu"), "the name in NFC");
  assert.match(assigned, /^úkol T\d{4} – nově se týká i: Žofie Dvořáková \[P0001\]$/mu);
  assert.match((await w.ok(["input", "assign", a, "--add", "P1"])).out, /^Nic ke změně\.$/mu);
  assert.match((await w.ok(["input", "assign", a, "--remove", "P1"])).out, new RegExp(`^${a} – už nepatří k: Žofie Dvořáková \\[P0001\\]$`, "mu"));

  for (const out of [hid, both, back, assigned]) assert.doesNotMatch(out, english);
  // the data stay as they were
  assert.deepEqual((await w.ok(["input", "hide", a, "--json"])).json.changed, [a]);
  w.cleanup();
});

test("strom input hide | unskip in German", opts, async () => {
  const { w, a } = await world("de");
  const hid = (await w.ok(["input", "hide", a, "--why", "unrelated"])).out;
  assert.match(hid, new RegExp(`^${a} ausgeblendet \\(nichts von der Familie\\)$`, "mu"));
  assert.match(hid, new RegExp(`^wieder zeigen: strom input unskip ${a}$`, "mu"));
  assert.match((await w.ok(["input", "unskip", a])).out, new RegExp(`^${a} wieder sichtbar \\(wartet auf Sortierung\\)$`, "mu"));
  assert.match((await w.ok(["input", "assign", a, "--add", "P1"])).out, new RegExp(`^${a} – gehört jetzt auch zu: Žofie Dvořáková \\[P0001\\]$`, "mu"));
  w.cleanup();
});
