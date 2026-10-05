// The children of one parent the Strom app sends split, one family each (its "?" drawn per child): the same family of
// the research, its parents the same — no conflict "Marta × Marta", nothing gone, nothing new (found on Mac).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const head0 = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
const people = [
  "0 @I1@ INDI", "1 NAME Marta /Svobodová/", "1 SEX F",
  "0 @I2@ INDI", "1 NAME Eva /Svobodová/", "1 SEX F", "1 BIRT", "2 DATE 1901",
  "0 @I3@ INDI", "1 NAME Petr /Svoboda/", "1 SEX M", "1 BIRT", "2 DATE 1903",
  "0 @I4@ INDI", "1 NAME Pavla /Svobodová/", "1 SEX F", "1 BIRT", "2 DATE 1905",
];
const refn = (lines: string[]) => lines.flatMap((l) => {
  const m = /^0 @I(\d+)@ INDI$/.exec(l);
  return m ? [l, `1 REFN P${m[1]!.padStart(4, "0")}`, "2 TYPE strom-research"] : [l];
});

test("the children of one parent sent split, a family each: the research's one family, no conflict of the same parents, nothing gone", opts, async () => {
  const w = new World();
  await w.withTree("Svobodovi");
  const adopt = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(adopt, ged([...head0, ...people, "0 @F1@ FAM", "1 WIFE @I1@", "1 CHIL @I2@", "1 CHIL @I3@", "1 CHIL @I4@"]));
  await w.ok(["sync", adopt, "--apply", "--force"]);
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  const split = path.join(w.dir, "split.ged");
  fs.writeFileSync(split, ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${head}`, ...refn(people),
    "0 @F1@ FAM", "1 WIFE @I1@", "1 CHIL @I2@", "0 @F2@ FAM", "1 WIFE @I1@", "1 CHIL @I3@", "0 @F3@ FAM", "1 WIFE @I1@", "1 CHIL @I4@"]));
  const r = (await w.ok(["sync", split, "--json"])).json;
  assert.deepEqual(r.changes, [], JSON.stringify(r.changes));
  // a child no family of hers names any more: said with the child's name (the app showed "?")
  fs.writeFileSync(split, ged([...head0, `1 _STROM_TREE ${id}`, `1 _STROM_HEAD ${head}`, ...refn(people),
    "0 @F1@ FAM", "1 WIFE @I1@", "1 CHIL @I2@", "0 @F2@ FAM", "1 WIFE @I1@", "1 CHIL @I3@"]));
  const gone = (await w.ok(["sync", split, "--json"])).json.changes;
  assert.deepEqual(gone.map((c: { kind: string; name?: string }) => `${c.kind} ${c.name}`), ["child.gone Pavla /Svobodová/"], JSON.stringify(gone));
  w.cleanup();
});

test("strom init says what it made in the research's language (found on Mac: English with STROM_LANG=cs)", async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const cs = (await w.ok(["init", "Svobodovi"], { env: { STROM_LANG: "cs" } })).out;
  assert.match(cs, /^Rodokmen „Svobodovi“ založen v /, cs);
  assert.match(cs, /jazyk výzkumu: čeština \(cs\)/, cs);
  assert.doesNotMatch(cs, /Created tree|research language/, cs);
  w.cleanup();
});
