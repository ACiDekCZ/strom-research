// A batch that fails says every line that fails at once — never only the first — and writes nothing (K7): the
// lines after a failing one are still checked (in memory), a line using the label of a failed one is skipped.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { parseBatch } from "../../src/commands/batch.ts";

const opts = { skip: !hasGit };

function status(w: World): string {
  return spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout;
}

test("batch: every failing line said at once, nothing written, the lines between checked", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).stdout;
  const r = await w.run([
    "batch",
    'person add "Анна /Петрова/" --sex F #anna',
    "event add P0099 BIRT --date 1900",
    'person add "Šimon /Ševčík/" --sex X #šimon',
    "family add --partner P0001 --partner @šimon",
    "event add P0001 BIRT --date 1880 --place Týnec",
    "event add @anna DEAT --date nonsense",
  ]);
  assert.equal(r.code, 2);
  assert.match(r.err, /4 of 6 lines failed — the batch wrote nothing/);
  assert.match(r.err, /line 2 \(event add\): no person P0099/);
  assert.match(r.err, /line 3 \(person add\):/);
  assert.match(r.err, /line 4 \(family add\): skipped: it uses @šimon, which line 3 should have created/);
  assert.match(r.err, /line 6 \(event add\): invalid date "nonsense"/);
  assert.doesNotMatch(r.err, /line 1 |line 5 /);
  // nothing of the good lines either: all or nothing
  assert.equal(fs.existsSync(path.join(w.cwd, "data", "persons", "P0002.json")), false);
  assert.equal(status(w), "");
  assert.equal(spawnSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).stdout, head);

  // the same as JSON: each line's error with its hint
  const j = await w.run(["batch", "--json", "event add P0099 BIRT --date 1900", "event add P0001 BIRT --date nonsense"]);
  assert.equal(j.json.details.errors.length, 2);
  assert.match(j.json.details.errors[1].message, /^line 2 \(event add\)/);
  assert.ok(j.json.details.errors[1].hint);

  // a dry run says them all too
  const dry = await w.run(["batch", "--dry-run", "event add P0099 BIRT --date 1900", "person add \"Eva /Nová/\" --sex F #eva", "event add @eva BIRT --date nonsense"]);
  assert.match(dry.err, /2 of 3 lines failed/);
  assert.equal(status(w), "");

  // one failing line: said as before
  const one = await w.run(["batch", 'person add "Karel /Novák/"', "event add P0099 BIRT --date 1900"]);
  assert.match(one.err, /^error: line 2 \(event add\): no person P0099/m);
  assert.equal(status(w), "");

  // the batch fixed: written whole, one commit
  const ok = await w.ok(["batch", 'person add "Анна /Петрова/" --sex F #anna', "family add --partner P0001 --partner @anna"]);
  assert.match(ok.out, /2 command\(s\) as one change/);
  assert.equal(fs.existsSync(path.join(w.cwd, "data", "persons", "P0002.json")), true);
  w.cleanup();
});

test("batch: a line failing after it wrote is undone alone, the lines before it stay for the lines after", opts, async () => {
  const w = new World();
  await w.withTree();
  // line 2 writes a person, then its label fails (family child creates no record of its own… it does: use a note)
  const r = await w.run([
    "batch",
    'person add "Jan /Novák/" --sex M #jan',
    'note add @jan "poznámka" #nic',
    "event add @jan BIRT --date 1880",
    "event add @jan DEAT --date nonsense",
  ]);
  assert.match(r.err, /2 of 4 lines failed/);
  assert.match(r.err, /line 2 \(note add\): #nic: this line creates no record to label/);
  // line 3 saw the person of line 1 (it did not fail)
  assert.doesNotMatch(r.err, /line 3/);
  assert.equal(status(w), "");
  w.cleanup();
});

test("batch lines: every line that cannot be read is said at once", () => {
  assert.throws(() => parseBatch('person add "Jan\nperson add X #1x\nperson add Y'), (e: Error) => /2 of 3 lines failed/.test(e.message) && /line 1: unclosed double quote/.test(e.message) && /line 2: invalid label "#1x"/.test(e.message));
});
