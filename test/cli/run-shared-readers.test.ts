// Readers of scans counted for the computer (spec 126 U8): at most read.parallel readers of every reading here at once —
// two readings of two researches with one shared folder side by side never have more. A reader waits for a free slot
// (said once, what it waits for), at most a while: then it is not started and said so. A slot whose process is gone is
// free at once. Real processes; names with diacritics.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { acquireLock } from "../../src/core/lock.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

function strom(w: World, cwd: string, args: string[], env: Record<string, string> = {}): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd, env: { ...w.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code: code ?? 1, out, err }));
  });
}

/** A reader that notes how many readers (of every tree) are at work as it starts and as it ends, and takes a while. */
function reader(w: World, ms: number): { file: string; most: () => number } {
  const file = path.join(w.dir, "reader.mjs");
  const running = path.join(w.dir, "running");
  const log = path.join(w.dir, "at-once.txt");
  fs.mkdirSync(running, { recursive: true });
  fs.writeFileSync(
    file,
    `import fs from "node:fs";\nimport path from "node:path";\n` +
      `const me = path.join(${JSON.stringify(running)}, String(process.pid));\nfs.writeFileSync(me, "");\n` +
      `fs.appendFileSync(${JSON.stringify(log)}, fs.readdirSync(${JSON.stringify(running)}).length + "\\n");\n` +
      `await new Promise((r) => setTimeout(r, ${ms}));\n` +
      `fs.appendFileSync(${JSON.stringify(log)}, fs.readdirSync(${JSON.stringify(running)}).length + "\\n");\n` +
      `fs.rmSync(me);\n` +
      `const p = process.env.STROM_PROMPT ?? "";\nfor (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\n`,
  );
  return { file, most: () => Math.max(0, ...fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map(Number)) };
}

/** Two researches with one shared folder, four scans in each. */
async function twoTrees(): Promise<{ w: World; trees: string[] }> {
  const w = new World();
  const trees: string[] = [];
  await w.ok(["setup", "--yes"]);
  w.historyAsked();
  for (const name of ["Lhotákovi", "Lhotovi"]) {
    await w.ok(["init", name]);
    w.cwd = w.treeDir(name);
    trees.push(w.cwd);
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--places", "Lhota", "--years", "1784-1820"]);
    const scans = path.join(w.dir, `scany ${name}`);
    fs.mkdirSync(scans);
    ["base420.jpg", "base444.jpg", "cmyk.jpg", "grey.jpg"].forEach((f, i) => fs.copyFileSync(path.join(fixtures, f), path.join(scans, `s000${i + 1}.jpg`)));
    await w.ok(["media", "add", scans, "--recordset", "B1"]);
  }
  return { w, trees };
}

const slots = (w: World) => path.join(w.home, "shared", "readers");

test("two readings of two researches at once: at most read.parallel readers on the computer, each reading whole", opts, async () => {
  const { w, trees } = await twoTrees();
  await w.ok(["config", "set", "read.parallel", "2"]);
  const r = reader(w, 1500);
  w.env.STROM_RUNNER_SCRIPT = r.file;
  const read = (cwd: string) => strom(w, cwd, ["read", "B1", "--images", "1-4", "--question", "Křty Lhotáků", "--agent", "script", "--batch", "1"]);
  const [a, b] = (await Promise.all(trees.map(read))) as [Awaited<ReturnType<typeof read>>, Awaited<ReturnType<typeof read>>];
  for (const x of [a, b]) {
    assert.equal(x.code, 0, x.out + x.err);
    assert.match(x.out, /read 4 images in 4 batches/u);
    assert.doesNotMatch(x.out, /NOT reported|nespuštěn/u);
  }
  assert.equal(r.most(), 2, "two readers at once on the computer, never four");
  // at least one reading waited for a slot, and said so
  assert.match(a.out + a.err + b.out + b.err, /čeká na volného čtenáře: na tomto počítači teď čte 2 čtenářů skenů \(read\.parallel\)/u);
  // every slot free again
  const held = fs.existsSync(slots(w)) ? fs.readdirSync(slots(w)).filter((f) => /^slot-\d+\.lock$/.test(f)) : [];
  assert.deepEqual(held, []);
  w.cleanup();
});

test("a reader waits at most a while for its slot, then is not started and said so; a slot whose process is gone is free at once", opts, async () => {
  const { w, trees } = await twoTrees();
  await w.ok(["config", "set", "read.parallel", "1"]);
  const r = reader(w, 10);
  w.env.STROM_RUNNER_SCRIPT = r.file;
  fs.mkdirSync(slots(w), { recursive: true });
  // the one slot held by a live process (this one: another reading at work)
  const release = acquireLock(path.join(slots(w), "slot-0.lock"), { owner: "reader of another reading", waitMs: 0, machine: true });
  try {
    const busy = await strom(w, trees[0]!, ["read", "B1", "--images", "1-1", "--question", "Křest Lhotáka", "--agent", "script"], { STROM_TEST_READER_SLOT_WAIT_MS: "1500" });
    assert.match(busy.out + busy.err, /čeká na volného čtenáře/u);
    assert.match(busy.out + busy.err, /nespuštěn: na tomto počítači se do 1 min neuvolnil žádný čtenář, 1 jich četlo pro jiná čtení \(read\.parallel\)/u);
    assert.equal(fs.existsSync(path.join(w.dir, "at-once.txt")), false, "no reader started");
  } finally {
    release();
  }
  // a slot left by a process that ended without letting it go (killed): free at once
  const lockTs = path.join(import.meta.dirname, "..", "..", "src", "core", "lock.ts");
  const dead = spawnSync(process.execPath, ["--input-type=module", "-e", `const { acquireLock } = await import(${JSON.stringify(lockTs)}); acquireLock(${JSON.stringify(path.join(slots(w), "slot-0.lock"))}, { owner: "killed reader", waitMs: 0, machine: true }); process.exit(0);`], { encoding: "utf8" });
  assert.equal(dead.status, 0, dead.stderr);
  assert.ok(fs.existsSync(path.join(slots(w), "slot-0.lock")), "left behind");
  const ok = await strom(w, trees[1]!, ["read", "B1", "--images", "1-1", "--question", "Křest Lhotové", "--agent", "script"], { STROM_TEST_READER_SLOT_WAIT_MS: "1500" });
  assert.equal(ok.code, 0, ok.out + ok.err);
  assert.doesNotMatch(ok.out + ok.err, /čeká na volného čtenáře|nespuštěn/u);
  assert.match(ok.out, /read 1 image/u);
  w.cleanup();
});
