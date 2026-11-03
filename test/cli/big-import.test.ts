// A family tree of 1 500 people taken in: its commit names every file it wrote, and Windows starts a program with a
// command line of at most 32 767 characters (found on Windows: `spawnSync git.exe ENAMETOOLONG` in commitAll, nothing
// of the tree kept). The paths reach git in parts, each command line well within that. Here a git of its own refuses a
// command line longer than 9 000 characters, as Windows would refuse one four times as long.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { gitProgram, pathParts } from "../../src/core/git.ts";

const PEOPLE = 1500;
const LIMIT = 9000;

/** A GEDCOM of made-up people: couples with a child each, names in Czech, Polish and Cyrillic. */
function bigGedcom(): string {
  const lines = ["0 HEAD", "1 SOUR Test", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
  const given = ["Václav", "Žofie", "Łucja", "Ёлка", "Jiří", "Anežka"];
  for (let i = 1; i <= PEOPLE; i++) {
    lines.push(`0 @I${i}@ INDI`, `1 NAME ${given[i % given.length]} /Lhoták${i}/`, `1 SEX ${i % 2 ? "M" : "F"}`, "1 BIRT", `2 DATE ${1700 + (i % 200)}`, "2 PLAC Lhota");
  }
  for (let i = 1; i + 2 <= PEOPLE; i += 3) lines.push(`0 @F${i}@ FAM`, `1 HUSB @I${i}@`, `1 WIFE @I${i + 1}@`, `1 CHIL @I${i + 2}@`);
  lines.push("0 TRLR");
  return lines.join("\n") + "\n";
}

test("a family tree of 1 500 people taken in: committed whole, no git command line over the limit", { skip: !hasGit }, async () => {
  const w = new World();
  const real = gitProgram();
  assert.ok(real);
  const log = path.join(w.dir, "git-lines.txt");
  const was = process.env.STROM_GIT;
  // Windows has the limit itself: its real git; elsewhere a git that refuses what Windows would
  if (process.platform !== "win32") {
    const wrapper = path.join(w.dir, "git");
    fs.writeFileSync(
      wrapper,
      `#!/bin/sh\nn=0\nfor a in "$@"; do n=$((n + \${#a} + 3)); done\necho "$n $1" >> ${JSON.stringify(log)}\nif [ $n -gt ${LIMIT} ]; then echo "command line of $n characters" >&2; exit 98; fi\nexec ${JSON.stringify(real)} "$@"\n`,
      { mode: 0o755 },
    );
    process.env.STROM_GIT = wrapper;
  }
  try {
    await w.withTree("Lhotákovi");
    const ged = path.join(w.dir, "velký strom.ged");
    fs.writeFileSync(ged, bigGedcom());
    const r = await w.run(["intake", ged]);
    assert.equal(r.code, 0, `${r.out}\n${r.err}`);
    const files = execFileSync(real!, ["ls-files", "-z", "--", "data/persons"], { cwd: w.cwd, encoding: "utf8" }).split("\0").filter(Boolean);
    assert.equal(files.length, PEOPLE, "every person in the commit");
    assert.equal(execFileSync(real!, ["status", "--porcelain", "--untracked-files=all"], { cwd: w.cwd, encoding: "utf8" }), "", "nothing left out of it");
    await w.ok(["check"]);
    if (process.platform !== "win32") {
      const lines = fs.readFileSync(log, "utf8").trim().split("\n").map((l) => Number(l.split(" ")[0]));
      assert.ok(Math.max(...lines) <= LIMIT, `longest git command line: ${Math.max(...lines)}`);
    }
  } finally {
    if (was === undefined) delete process.env.STROM_GIT;
    else process.env.STROM_GIT = was;
    w.cleanup();
  }
});

test("paths in parts: each within the room, none lost, the order kept, one too long for any part alone in its own", () => {
  const paths = Array.from({ length: 1000 }, (_, i) => `data/persons/P${String(i).padStart(4, "0")}.json`);
  const parts = pathParts(paths, 1000);
  assert.ok(parts.length > 1);
  assert.deepEqual(parts.flat(), paths);
  for (const p of parts) assert.ok(p.reduce((n, s) => n + s.length + 3, 0) <= 1000);
  assert.deepEqual(pathParts(["a", "x".repeat(2000), "b"], 1000), [["a"], ["x".repeat(2000)], ["b"]]);
  assert.deepEqual(pathParts([]), []);
});
