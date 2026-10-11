// strom lesson edit: a lesson found wrong or out of date is corrected — its rule, its detail, its scope, what it is on —
// with the reason, logged as an operation like every edit; filling in a detail it lacks or adding a note needs none.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { changeLines } from "../../src/core/changelog.ts";
import type { Lesson } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

test("strom lesson edit corrects a lesson with the reason, logged as lesson.edit", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["repo", "add", "Státní oblastní archiv"]); // R0001
  await w.ok(["recordset", "add", "Týnec 17", "--repo", "R0001"]); // B0001
  await w.ok(["lesson", "add", "Folio = 2 × image + 1", "--on", "B0001"]); // K0001
  // what the next session goes by: changed only with a reason
  const bare = await w.run(["lesson", "edit", "K0001", "--rule", "Folio = 2 × image + 3"]);
  assert.notEqual(bare.code, 0);
  assert.match(bare.err, /u K0001 se mění --rule — chybí --reason/, "in the research language");
  // decomposed input is stored composed (NFC)
  const rule = "Fólio = 2 × obraz + 3 od snímku 120".normalize("NFD");
  const r = await w.ok(["lesson", "edit", "k1", "--rule", rule, "--reason", "číslování skáče u snímku 120", "--json"]);
  assert.equal(r.json.lesson.rule.normalize("NFC"), rule.normalize("NFC"));
  assert.equal(Tree.open(w.cwd, { ...process.env, ...w.env }).get<Lesson>("K0001")!.rule, rule.normalize("NFC"), "stored composed");
  assert.equal(r.json.lesson.scope, "recordset");
  assert.equal(r.json.lesson.target, "B0001");
  // a detail it lacks: filling in, no reason; a note: none either
  await w.ok(["lesson", "edit", "K0001", "--detail", "Ověřeno u snímků 10, 60, 118, 121."]);
  await w.ok(["lesson", "edit", "K0001", "--note", "Нумерация проверена"]);
  // the detail it has, changed: the reason again
  assert.notEqual((await w.run(["lesson", "edit", "K0001", "--detail", "Jinak."])).code, 0);
  // on the archive instead of the book: its scope from it
  const moved = await w.ok(["lesson", "edit", "K0001", "--on", "R0001", "--reason", "platí pro všechny knihy archivu", "--json"]);
  assert.equal(moved.json.lesson.target, "R0001");
  assert.equal(moved.json.lesson.scope, "repository");
  assert.equal(moved.json.lesson.detail, "Ověřeno u snímků 10, 60, 118, 121.");
  assert.equal(moved.json.lesson.notes.length, 1);
  // nothing given, or nothing different: said
  assert.match((await w.run(["lesson", "edit", "K0001"])).err, /nothing to change/);
  assert.match((await w.run(["lesson", "edit", "K0001", "--on", "R0001"])).err, /nothing to change/);
  assert.match((await w.run(["lesson", "edit", "K0001", "--on", "P0001"])).err, /--on must be an existing record set, repository or place/);
  // a rule too long: its start is the rule, the rest goes before its detail — never cut short
  const long = `${"Slovo ".repeat(40)}konec.`;
  const split = await w.ok(["lesson", "edit", "K0001", "--rule", long, "--reason", "podrobněji", "--json"]);
  assert.ok([...split.json.lesson.rule].length <= 200);
  assert.match(split.json.lesson.detail, /konec\.\nOvěřeno u snímků/);
  // the operations: lesson.edit with the reason, on the lesson and what it is on
  const ops = Tree.open(w.cwd, { ...process.env, ...w.env })
    .readOps()
    .filter((o) => o.op === "lesson.edit");
  assert.equal(ops.length, 5);
  assert.equal(ops[0]!.reason, "číslování skáče u snímku 120");
  assert.deepEqual(ops[0]!.targets, ["K0001"]);
  assert.deepEqual(ops[3]!.targets, ["K0001", "R0001"]);
  // the history says it in the research language
  const tree = Tree.open(w.cwd, { ...process.env, ...w.env });
  assert.match(changeLines(tree, [ops[0]!], "", "cs")[0]!.text, /^Opravený poznatek: Slovo/);
  assert.equal((await w.ok(["check"])).code, 0);
  w.cleanup();
});
