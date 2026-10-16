// strom read --images takes a list of runs as strom fetch and strom readings take it, and as strom says it back
// ("5-19,21-39,41-43", "71, 77–88, 91–94", "35 .. 38"): exactly the images it names are read, never those between its
// runs; a list the shell split at its spaces is one list again; at most IMAGE_RANGE_MAX images in all. Readers get
// batches as even as they can be (never a reader for the one image left over).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { joinedImages, readImages } from "../../src/commands/read.ts";
import { runsArg } from "../../src/cli/format.ts";
import { UsageError } from "../../src/core/errors.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

test("the list of runs: dashes, two dots, spaces around commas and dashes, single numbers; the whole list at most 200", () => {
  assert.deepEqual(readImages("40-69"), Array.from({ length: 30 }, (_, i) => 40 + i));
  const holes = [5, 6, 7, 9, 10, 12];
  for (const v of ["5-7,9-10,12", "5–7, 9–10, 12", "5 - 7 , 9 .. 10 ,12", "5...7,9-10,12", "12,9-10,5-7", "5-7,6,9-10,12,"]) assert.deepEqual(readImages(v), holes, v);
  assert.deepEqual(readImages("71,77-88,91-94"), [71, ...Array.from({ length: 12 }, (_, i) => 77 + i), 91, 92, 93, 94]);
  for (const bad of ["", ",", "5-7;9", "five", "5-7 9", "B1:5"]) assert.throws(() => readImages(bad), UsageError, bad);
  assert.throws(() => readImages("9-5"), /--images 9-5: a range from the lower number/);
  // the limit holds for the sum of the list, said with the list split in two
  assert.throws(() => readImages("1-250"), (e: Error & { hint?: string }) => /250 images — at most 200 in one reading/.test(e.message) && e.hint === "--images 1-200, then --images 201-250 — recording what the first gave before the next");
  assert.throws(() => readImages("1-150,201-260"), (e: Error & { hint?: string }) => /--images 1-150,201-260: 210 images — at most 200 in one reading/.test(e.message) && e.hint!.startsWith("--images 1-150,201-250, then --images 251-260"));
  // one image left over is one number, never a range of one ("201", not "201-201")
  assert.throws(() => readImages("1-201"), (e: Error & { hint?: string }) => e.hint === "--images 1-200, then --images 201 — recording what the first gave before the next");
  assert.throws(() => readImages("1-150,201-251"), (e: Error & { hint?: string }) => e.hint!.startsWith("--images 1-150,201-250, then --images 251 "));
  assert.equal(readImages("1-100,101-200").length, 200, "200: within");
  // runs as a command takes them: one word of the shell, read back the same
  for (const ns of [[1], [1, 2, 3], [1, 2, 3, 5, 7, 8, 9], [71, 77, 78, 79, 91]]) {
    assert.doesNotMatch(runsArg(ns), /\s|–/u);
    assert.deepEqual(readImages(runsArg(ns)), ns);
  }
});

test("a list copied with its spaces: the shell's pieces taken back into it, nothing else", () => {
  assert.deepEqual(joinedImages(["B0007", "21–39,", "41–43"], "5–19,"), { args: ["B0007"], images: "5–19, 21–39, 41–43" });
  assert.deepEqual(readImages(joinedImages(["B0007", "21–39,", "41–43"], "5–19,").images as string).length, 15 + 19 + 3);
  // not a list's pieces: as typed (the command says what is wrong)
  assert.deepEqual(joinedImages(["B0007", "B0008"], "5,"), { args: ["B0007", "B0008"], images: "5," });
  assert.deepEqual(joinedImages(["B0007", "21-39"], "5-19"), { args: ["B0007", "21-39"], images: "5-19" }, "no comma: no list split");
  assert.deepEqual(joinedImages(["B0007:5", "9"], "5,"), { args: ["B0007:5", "9"], images: "5," });
  assert.deepEqual(joinedImages(["B0007"], "5-19"), { args: ["B0007"], images: "5-19" });
});

/** A reader that notes the images it got and answers each with nothing found. */
function reader(w: World): { file: string; got: () => number[][] } {
  const file = path.join(w.dir, "reader.mjs");
  const log = path.join(w.dir, "readers.jsonl");
  fs.writeFileSync(
    file,
    `import fs from "node:fs";\n` +
      `const p = process.env.STROM_PROMPT ?? "";\nconst got = [...p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)];\n` +
      `const report = /Write your report to (.+?) AS YOU GO/.exec(p)[1];\n` +
      `fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(got.map((m) => Number(m[2]))) + "\\n");\n` +
      `for (const m of got) fs.appendFileSync(report, "## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n\\n");\n`,
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
  ["base420.jpg", "base444.jpg", "cmyk.jpg", "grey.jpg", "prog420.jpg"].forEach((f, i) => fs.copyFileSync(path.join(fixtures, f), path.join(scans, `s000${i + 1}.jpg`)));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  return w;
}

const question = ["--question", "Every baptism of the surname Dvořák in 1820–1824", "--agent", "script", "--parallel", "1"];

test("strom read with a list: exactly its images read, the search over them; a list split by the shell read the same", opts, async () => {
  const w = await book();
  try {
    const r = reader(w);
    w.env.STROM_RUNNER_SCRIPT = r.file;
    const one = await w.ok(["read", "B1", "--images", "1, 3–4", ...question]);
    assert.deepEqual(r.got().flat(), [1, 3, 4], "image 2 is not in the list: not read");
    assert.match(one.out, /^read 3 images in 1 batch\(es\)/m);
    // the search to record names the images read, one word of the shell
    assert.match(one.out, /--pages 1,3-4 --method page-by-page --by reader --result negative/);
    // as the shell gives a list copied with its spaces: "--images 1," "3–4"
    const split = await w.ok(["read", "B1", "--images", "1,", "3–4", ...question, "--json"]);
    assert.equal(split.json.images, 3);
    assert.deepEqual(r.got().slice(1).flat(), [1, 3, 4]);
    // none of the list registered: said with the list, the fetch hint one word
    const none = await w.run(["read", "B1", "--images", "7,9-10", ...question]);
    assert.match(none.err, /no registered images 7, 9–10 of B0001\n→ strom media add <folder> --recordset B0001/);
  } finally {
    w.cleanup();
  }
});

test("readers' batches as even as they can be: never a reader for the one image left over", opts, async () => {
  const w = await book();
  try {
    const r = reader(w);
    w.env.STROM_RUNNER_SCRIPT = r.file;
    // five images by four: 3 and 2, not 4 and 1
    const out = await w.ok(["read", "B1", "--images", "1-5", ...question, "--batch", "4"]);
    assert.deepEqual(r.got(), [[1, 2, 3], [4, 5]]);
    assert.match(out.out, /▶ reader 1\/2: 3 images \(1–3\)/);
    assert.match(out.out, /▶ reader 2\/2: 2 images \(4–5\)/);
  } finally {
    w.cleanup();
  }
});

test("strom help read: the way to browse scans for every agent, also one with subagents of its own; a list taken", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    const help = (await w.ok(["help", "read"])).out;
    assert.match(help, /The way to browse scans for every agent — also one with subagents of its own \(use those for other work\): about\na third of what your own subagents cost on the same images, every reading kept \(strom readings\)/);
    assert.doesNotMatch(help, /without their own subagents/);
    assert.match(help, /--images <list>\s+image numbers of the record set, e\.g\. 40-69 or 5-19,21-39 \(at most 200 in all\)/);
    // the guide says the same
    assert.match((await w.ok(["guide"])).out, /Browsing a book\n {3}or a range of images goes to strom read, also for an agent with subagents\n {3}of its own/);
  } finally {
    w.cleanup();
  }
});
