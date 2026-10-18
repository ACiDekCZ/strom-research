// strom read --until-found (spec 001, U3): off by default; once a reader reports a find no more readers begin —
// those at work finish, also a find seen in a report as its reader writes it — and the reading says exactly which
// images it read: the search it gives is partial over those, never a negative of the range.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, shellWords } from "../helpers.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

/**
 * A reader that notes the images it got. An image in `found` is a find: written into its report at once (as a reader
 * writes as it goes), then it takes `ms[image]` before it ends; the others are answered with nothing found.
 */
function reader(w: World, found: number[], ms: Record<number, number> = {}): { file: string; got: () => number[][] } {
  const file = path.join(w.dir, "reader.mjs");
  const log = path.join(w.dir, "readers.jsonl");
  fs.writeFileSync(
    file,
    `import fs from "node:fs";\n` +
      `const p = process.env.STROM_PROMPT ?? "";\nconst got = [...p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)];\n` +
      `const report = /Write your report to (.+?) AS YOU GO/.exec(p)[1];\n` +
      `fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(got.map((m) => Number(m[2]))) + "\\n");\n` +
      `const found = ${JSON.stringify(found)};\nconst ms = ${JSON.stringify(ms)};\n` +
      `for (const m of got) {\n` +
      `  const n = Number(m[2]);\n` +
      `  fs.appendFileSync(report, "## Image " + n + " · " + m[1] + "\\nresult: " + (found.includes(n) ? "found\\nentries: Jan Novák, born 3 May 1822, house 12, father Josef" : "nothing") + "\\n\\n");\n` +
      `  await new Promise((r) => setTimeout(r, ms[n] ?? 100));\n` +
      `}\n`,
  );
  return { file, got: () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []) };
}

async function book(): Promise<World> {
  const w = new World();
  await w.withTree();
  w.env.STROM_LANG = "en";
  await w.ok(["recordset", "add", "Žďár N 1820–1830", "--kinds", "baptism", "--places", "Žďár", "--years", "1820-1830"]);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  ["base420.jpg", "base444.jpg", "cmyk.jpg", "grey.jpg"].forEach((f, i) => fs.copyFileSync(path.join(fixtures, f), path.join(scans, `s000${i + 1}.jpg`)));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  return w;
}

const read = ["read", "B1", "--images", "1-4", "--question", "The baptism of Jan Novák, born about 1822, son of Josef", "--agent", "script", "--batch", "1"];

test("--until-found off by default: every image read, a found search over the range", opts, async () => {
  const w = await book();
  const r = reader(w, [2]);
  w.env.STROM_RUNNER_SCRIPT = r.file;
  const all = await w.ok([...read, "--parallel", "1", "--json"]);
  assert.equal(all.json.images, 4);
  assert.equal(all.json.stoppedAtFind, undefined);
  assert.deepEqual(r.got().flat(), [1, 2, 3, 4]);
  const text = await w.ok([...read, "--parallel", "1"]);
  assert.match(text.out, /--pages 1-4 --method page-by-page --by reader --result found/);
  assert.doesNotMatch(text.out, /until-found|NOT read/);
  // the help names it, for one entry only
  assert.match((await w.ok(["help", "read"])).out, /--until-found\s+no more readers once one reports a find \(those at work finish\) — only for ONE particular entry/);
  w.cleanup();
});

test("--until-found: no reader begins after the find; the images read said exactly, the search partial over them", opts, async () => {
  const w = await book();
  const r = reader(w, [2]);
  w.env.STROM_RUNNER_SCRIPT = r.file;
  const res = await w.ok([...read, "--parallel", "1", "--until-found"]);
  assert.deepEqual(r.got(), [[1], [2]], "the readers of images 3 and 4 never began");
  assert.match(res.out, /^read 2 images in 2 batches/m);
  assert.match(res.out, /^found on: 2$/m);
  assert.match(res.out, /^NOT read: images 3–4 — a reader found it, no more began \(--until-found\); read them if the find proves not to be the one: strom read B0001 --images 3-4 …; no negative of them$/m);
  const line = /^record the search: (strom search add .*)$/m.exec(res.out)?.[1];
  assert.ok(line, res.out);
  assert.match(line, / --recordset B0001 --pages 1-2 --method page-by-page --by reader --result partial --note "stopped at the find \(--until-found\): images 3–4 not read"$/);
  assert.doesNotMatch(res.out, /--result (negative|found)/);
  assert.match(res.out, /never a negative of the range/);
  assert.match(res.err + res.out, /★ reader 2 reported a find \(--until-found\): no more readers begin, those at work finish/);
  // the search as the reading gives it: partial, over the two images read
  // run as it is printed, its words as a shell splits them — no sh, which Windows has not
  assert.deepEqual(shellWords(`strom note add "Řekl \\"ano\\" za \\$5" 'a b' Žofie`), ["strom", "note", "add", 'Řekl "ano" za $5', "a b", "Žofie"]);
  const said = shellWords(line);
  assert.equal(said[0], "strom");
  assert.ok(said.includes("stopped at the find (--until-found): images 3–4 not read"), said.join(" | "));
  await w.ok(said.slice(1));
  const searches = (await w.ok(["search", "list", "--full", "--json"])).json.searches as { result: string; scope: { pages?: string }; note?: string }[];
  assert.equal(searches.length, 1);
  assert.equal(searches[0]!.result, "partial");
  assert.equal(searches[0]!.scope.pages, "1-2");
  // the commit names the images read; the reports only theirs
  const log = spawnSync("git", ["log", "--format=%s", "-3"], { cwd: w.cwd, encoding: "utf8" }).stdout;
  assert.match(log, /Reading B0001-1-4: 2 images by readers/);
  const json = await w.ok([...read, "--parallel", "1", "--until-found", "--json"]);
  assert.equal(json.json.images, 2);
  assert.deepEqual(json.json.stoppedAtFind, { batch: 2, notRead: [3, 4] });
  assert.deepEqual(json.json.reports.length, 2);
  await w.ok(["check"]);
  w.cleanup();
});

test("--until-found: a find seen in a report as it is written; the readers at work finish, no next begins", opts, async () => {
  const w = await book();
  // two at a time: image 1 is found at once, its reader takes a while yet; image 2's reader is still at work when the
  // find is seen and finishes — without a look into the reports as they are written, image 3 would begin after it
  const r = reader(w, [1], { 1: 3500, 2: 2200 });
  w.env.STROM_RUNNER_SCRIPT = r.file;
  const res = await w.ok([...read, "--parallel", "2", "--until-found", "--json"]);
  assert.deepEqual(r.got().flat().sort(), [1, 2]);
  assert.equal(res.json.images, 2, "both readers at work finished and count");
  assert.deepEqual(res.json.stoppedAtFind, { batch: 1, notRead: [3, 4] });
  assert.deepEqual(res.json.found, [{ image: 1, media: res.json.found[0].media }]);
  w.cleanup();
});

test("--until-found with the find in the last batch: nothing left, a found search over all", opts, async () => {
  const w = await book();
  const r = reader(w, [4]);
  w.env.STROM_RUNNER_SCRIPT = r.file;
  const res = await w.ok([...read, "--parallel", "1", "--until-found"]);
  assert.deepEqual(r.got().flat(), [1, 2, 3, 4]);
  assert.match(res.out, /--pages 1-4 --method page-by-page --by reader --result found/);
  assert.doesNotMatch(res.out, /NOT read/);
  w.cleanup();
});
