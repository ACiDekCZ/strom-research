// Readers of strom read at the same time (found in a night's run: the default 3 and --parallel left out of the brief's
// commands — one read of 40 raised it): 5 by default, the setting read.parallel the tree's over the user's, --parallel
// over both, 1 to 10. The same readers and requests, only sooner.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

/** A reader that notes how many readers are at work as it starts, then takes a while. */
function reader(w: World): { file: string; most: () => number; reset: () => void } {
  const file = path.join(w.dir, "reader.mjs");
  const running = path.join(w.dir, "running");
  const log = path.join(w.dir, "at-once.txt");
  fs.mkdirSync(running, { recursive: true });
  fs.writeFileSync(
    file,
    `import fs from "node:fs";\nimport path from "node:path";\n` +
      `const me = path.join(${JSON.stringify(running)}, String(process.pid));\nfs.writeFileSync(me, "");\n` +
      `fs.appendFileSync(${JSON.stringify(log)}, fs.readdirSync(${JSON.stringify(running)}).length + "\\n");\n` +
      `await new Promise((r) => setTimeout(r, 600));\n` +
      `fs.appendFileSync(${JSON.stringify(log)}, fs.readdirSync(${JSON.stringify(running)}).length + "\\n");\n` +
      `fs.rmSync(me);\n` +
      `const p = process.env.STROM_PROMPT ?? "";\nfor (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\n`,
  );
  return {
    file,
    most: () => Math.max(...fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map(Number)),
    reset: () => fs.rmSync(log, { force: true }),
  };
}

test("read.parallel: 5 by default, the user's, the tree's over it, --parallel over both; 1 to 10", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Žďár N 1847–1868", "--kinds", "baptism", "--places", "Žďár", "--years", "1847-1868"]);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  ["base420.jpg", "base444.jpg", "cmyk.jpg", "grey.jpg"].forEach((f, i) => fs.copyFileSync(path.join(fixtures, f), path.join(scans, `s000${i + 1}.jpg`)));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  const r = reader(w);
  w.env.STROM_RUNNER_SCRIPT = r.file;
  const read = async (...more: string[]) => {
    r.reset();
    await w.ok(["read", "B1", "--images", "1-4", "--question", "Křty Nováků", "--agent", "script", "--batch", "1", ...more]);
    return r.most();
  };

  // shown where settings are looked for, with its default
  assert.equal((await w.ok(["config", "get", "read.parallel", "--json"])).json.value, 5);
  assert.match((await w.ok(["config", "where"])).out, /^read\.parallel\s+5\s+default/m);
  assert.match((await w.ok(["help", "read"])).out, /--parallel <n>\s+readers at the same time, 1 to 10 \(default 5, or the setting read\.parallel/);
  assert.equal(await read(), 4, "four images, five readers at most: all four at once");

  // the user's setting
  await w.ok(["config", "set", "read.parallel", "1"]);
  assert.equal(await read(), 1);
  // the tree's over the user's
  await w.ok(["config", "set", "read.parallel", "2", "--for-tree"]);
  assert.deepEqual((await w.ok(["config", "get", "read.parallel", "--json"])).json, { key: "read.parallel", value: 2, source: "tree" });
  assert.equal(await read(), 2);
  // the command's over both
  assert.equal(await read("--parallel", "3"), 3);

  // out of range: refused, nothing changed
  for (const bad of ["0", "11", "2.5", "many"]) {
    const set = await w.run(["config", "set", "read.parallel", bad]);
    assert.equal(set.code, 2, `${bad}: ${set.out}${set.err}`);
  }
  assert.match((await w.run(["config", "set", "read.parallel", "11"])).err, /read\.parallel is a whole number from 1 to 10/);
  const many = await w.run(["read", "B1", "--images", "1-4", "--question", "Křty", "--agent", "script", "--parallel", "11"]);
  assert.equal(many.code, 2);
  assert.match(many.err, /--parallel is a whole number from 1 to 10/);
  assert.equal((await w.ok(["config", "get", "read.parallel", "--json"])).json.value, 2);
  w.cleanup();
});
