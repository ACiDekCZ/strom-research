// The images of a research in short (core/mediaindex.ts): the queue, the brief
// and the overview read it instead of every image record — and it gives exactly
// what the records give, is made again whenever the images' folder changed, and
// is never kept for a folder that changed a moment ago.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree, now } from "../../src/core/tree.ts";
import { rankTasks } from "../../src/core/queue.ts";
import { imagesIndex, indexFile } from "../../src/core/mediaindex.ts";
import { treeStats } from "../../src/core/overview.ts";
import type { Media, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

/** A research with ancestors, six books, tasks that read them and images in some of them (some taken back). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  await w.ok(["person", "add", "Marie /Dvořáková/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]);
  for (let b = 1; b <= 6; b++) await w.ok(["recordset", "add", `Kniha ${b} Žďár`, "--kinds", "baptism", "--places", "Žďár", "--years", "1850-1870"]);
  let n = 0;
  for (const level of ["link", "verify", "locate"])
    for (let b = 1; b <= 6; b++)
      await w.ok(["task", "add", `Úkol ${++n} 東京`, "--level", level, "--where", `B${b}`, "--why", "a", "--done-when", "b", "--about", `P${1 + (n % 3)}`, "--priority", String(1 + (n % 5))]);
  // images: many in B1, B3 and B5, one in B6 taken back below; B2 and B4 none
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    const at = now();
    const add = (recordset: string, image: number) => {
      const id = tree.allocate("M");
      const m: Media = { id, type: "media", created: at, updated: at, sha: id.padEnd(64, "0"), file: `media/${id}.jpg`, mime: "image/jpeg", size: 1, recordset, image, notes: [] };
      tree.put(m, { op: "media.add", targets: [id], summary: `image ${id}` });
    };
    for (let i = 1; i <= 60; i++) add(["B0001", "B0003", "B0005"][i % 3]!, i);
    add("B0006", 1);
    add("B0005", 7); // the same image again: counted once among the numbers
  });
  tree.commit("images");
  await w.ok(["media", "retract", "M0061", "--reason", "obraz jiné knihy"]);
  return w;
}

/** The order of the queue with the image records read whole (the way before the index). */
function plainOrder(dir: string, env: Record<string, string>): string[] {
  const tree = Tree.open(dir, env);
  tree.list<Media>("media");
  assert.equal(tree.loaded("media"), true);
  return rankTasks(tree, tree.list<Task>("task")).map((r) => `${r.task.id} ${r.why}`);
}

/** The order through the index, and whether the image records were read for it. */
function indexedOrder(dir: string, env: Record<string, string>): { order: string[]; read: boolean } {
  const tree = Tree.open(dir, env);
  const order = rankTasks(tree, tree.list<Task>("task")).map((r) => `${r.task.id} ${r.why}`);
  return { order, read: tree.loaded("media") };
}

/** The images' folder as if it changed a while ago (a folder changed a moment ago never gets an index). */
const PAST = new Date(Date.now() - 60_000);
function settle(dir: string): void {
  fs.utimesSync(path.join(dir, "data", "images"), PAST, PAST);
}

test("images index: the queue keeps exactly its order with and without the index, and the index is used", opts, async () => {
  const w = await world();
  const file = indexFile(Tree.open(w.cwd, w.env));
  const plain = plainOrder(w.cwd, w.env);
  assert.ok(plain.some((x) => /needs images/.test(x)), "some tasks wait for images");

  // a folder changed a moment ago: the records are read and no index is kept
  fs.rmSync(file, { force: true });
  const fresh = indexedOrder(w.cwd, w.env);
  assert.deepEqual(fresh.order, plain);
  assert.equal(fs.existsSync(file), false, "no index for a folder that just changed");

  settle(w.cwd);
  const first = indexedOrder(w.cwd, w.env);
  assert.deepEqual(first.order, plain);
  assert.equal(fs.existsSync(file), true, "kept once the folder is settled");
  const second = indexedOrder(w.cwd, w.env);
  assert.deepEqual(second.order, plain);
  assert.equal(second.read, false, "the image records are not read again");

  // what the index says equals the records, number by number
  const tree = Tree.open(w.cwd, w.env);
  const viaIndex = imagesIndex(tree);
  assert.equal(tree.loaded("media"), false);
  assert.equal(viaIndex.alive, 61);
  assert.deepEqual(viaIndex.sets.get("B0005")?.images.slice(0, 3), [2, 5, 7]);
  assert.equal(viaIndex.sets.get("B0006"), undefined, "the one image of B6 was taken back");
  assert.equal(treeStats(Tree.open(w.cwd, w.env)).images, 61);
  w.cleanup();
});

test("images index: a change of the images makes it again — an image taken back, one added, an index of another stamp", opts, async () => {
  const w = await world();
  settle(w.cwd);
  indexedOrder(w.cwd, w.env); // the index kept
  const file = indexFile(Tree.open(w.cwd, w.env));
  assert.equal(fs.existsSync(file), true);

  // every image of B3 taken back: its tasks now wait for images
  for (let i = 3; i <= 60; i += 3) await w.ok(["media", "retract", `M${String(i).padStart(4, "0")}`, "--reason", "jiná kniha"]);
  const after = indexedOrder(w.cwd, w.env);
  assert.equal(after.read, true, "the folder changed: the records are read");
  assert.deepEqual(after.order, plainOrder(w.cwd, w.env));
  assert.ok(after.order.some((x) => /needs images/.test(x)));

  // an index that names another stamp is not believed, whatever it says
  settle(w.cwd);
  indexedOrder(w.cwd, w.env);
  const stored = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ ...stored, stamp: { ...stored.stamp, count: stored.stamp.count + 1 }, sets: {}, alive: 0 }));
  const lied = Tree.open(w.cwd, w.env);
  assert.equal(imagesIndex(lied).alive, 41);
  assert.deepEqual(rankTasks(lied, lied.list<Task>("task")).map((r) => `${r.task.id} ${r.why}`), plainOrder(w.cwd, w.env));
  // nor a damaged one
  fs.writeFileSync(file, "{");
  assert.equal(imagesIndex(Tree.open(w.cwd, w.env)).alive, 41);
  w.cleanup();
});

test("images index: a command that fails puts the images back so the folder's stamp changes too", opts, async () => {
  const w = await world();
  const tree = Tree.open(w.cwd, w.env);
  const dir = path.join(w.cwd, "data", "images");
  settle(w.cwd);
  const before = fs.statSync(dir, { bigint: true }).mtimeNs;
  tree.withTreeLock(() => {
    const m = tree.get<Media>("M0001")!;
    tree.put({ ...m, retracted: { at: now(), reason: "x" } }, { op: "media.retract", targets: [m.id], summary: "x" });
  });
  settle(w.cwd);
  tree.rollback();
  assert.notEqual(fs.statSync(dir, { bigint: true }).mtimeNs, before, "the image put back by renaming");
  assert.equal(imagesIndex(Tree.open(w.cwd, w.env)).alive, 61);
  w.cleanup();
});
