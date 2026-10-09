// What strom writes unasked — the settles at a bridge's start and at the first run of a newer strom (the links of older
// hypotheses, an archive's tasks put aside) — writes nothing where it may not: a tree sealed on another computer (a
// copy, a research brought here) waits for the person's adoption, and nothing is left in data/ uncommitted (found
// before a beta: the ID counters raised, the settle failing at the seal, the change left for strom guard to find). A
// failure on the way puts back everything it wrote. Once adopted, it settles.

import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { HYPOTHESIS_LINKS_ORIGIN, settleHypothesisLinks } from "../../src/core/hypolinks.ts";
import { settleArchive } from "../../src/core/mode.ts";
import type { Hypothesis, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

const status = (w: World) => spawnSync("git", ["-C", w.cwd, "status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).stdout;
const head = (w: World) => spawnSync("git", ["-C", w.cwd, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const counters = (w: World) => fs.readFileSync(path.join(w.cwd, "data", "_counters.json"), "utf8");
const ourTasks = (w: World) => Tree.open(w.cwd, w.env).list<Task>("task").filter((t) => t.origin === HYPOTHESIS_LINKS_ORIGIN);

/** The tree's seal key away (the tree as on another computer) and back (adopted). */
function keyOf(w: World): { away: () => void; back: () => void } {
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
  const key = path.join(w.env.STROM_CONFIG_DIR!, "keys", `${id}.key`);
  return { away: () => fs.renameSync(key, `${key}.elsewhere`), back: () => fs.renameSync(`${key}.elsewhere`, key) };
}

/** Two parents and a child; older hypotheses whose claims leave doubt — the settle would add a task (a new T…). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Ondřej /Kubát/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Řehoř /Šimek/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Ludmila /Šimková/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3"]); // F1
  await w.ok(["hypothesis", "add", "Odkud Ondřej?", "--about", "P1", "--variant", "A: nic", "--variant", "B: syn P0002 nebo P0003"]); // H1
  await w.ok(["hypothesis", "add", "Чей сын?", "--about", "P1", "--variant", "A: nic", "--variant", "B: syn P0002 a jeho ženy P0003"]); // H2
  return w;
}

test("hypotheses' links: another computer's seal — nothing written, nothing thrown, at the bridge's start and the first run of a newer strom; adopted — settled", opts, async () => {
  const w = await world();
  const key = keyOf(w);
  key.away();
  const at = head(w);
  const ids = counters(w);
  assert.equal(status(w), "");

  assert.equal(settleHypothesisLinks(Tree.open(w.cwd, w.env)), undefined);
  assert.equal(status(w), "", "nothing left in the tree");
  assert.equal(counters(w), ids, "no ID taken");
  // the first run of a newer strom, and the bridge's start: the same
  const cfg = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  fs.writeFileSync(cfg, JSON.stringify({ ...readJsonFile(cfg), lastVersion: "1.0.0" }));
  await w.ok(["stats"]);
  const info = await w.run(["live", "start", "--json"]);
  if (info.code === 0) await w.ok(["live", "stop"]);
  assert.equal(status(w), "");
  assert.equal(counters(w), ids);
  assert.equal(head(w), at);
  assert.doesNotMatch(fs.existsSync(path.join(w.cwd, ".strom", "live.log")) ? fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8") : "", /not filled in now/);

  // adopted: the next time settles it, in one commit
  key.back();
  const done = settleHypothesisLinks(Tree.open(w.cwd, w.env));
  assert.ok(done);
  assert.deepEqual(ourTasks(w).map((t) => t.subject), [["H0001", "H0002"]]);
  assert.notEqual(head(w), at);
  assert.equal(status(w), "");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("hypotheses' links: a failure on the way leaves nothing behind — the links, the task, its ID, the marker, the log", opts, async () => {
  const w = await world();
  // and one the claim says beyond doubt: a link written before the task
  await w.ok(["hypothesis", "add", "Whose son?", "--about", "P1", "--variant", "A: nobody", "--variant", "B: son of P0002 and P0003"]); // H3
  const at = head(w);
  const ids = counters(w);
  const config = fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8");
  const tree = Tree.open(w.cwd, w.env);
  tree.commit = () => {
    throw new Error("git failed");
  };
  assert.throws(() => settleHypothesisLinks(tree), /git failed/);
  assert.equal(status(w), "", "nothing left in the tree");
  assert.equal(counters(w), ids);
  assert.equal(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8"), config);
  assert.equal(head(w), at);
  assert.equal(Tree.open(w.cwd, w.env).get<Hypothesis>("H0003")!.variants[1]!.links, undefined);
  // next time: settled
  assert.ok(settleHypothesisLinks(Tree.open(w.cwd, w.env)));
  assert.deepEqual(Tree.open(w.cwd, w.env).get<Hypothesis>("H0003")!.variants[1]!.links, [{ kind: "child", person: "P0001", family: "F0001" }]);
  assert.equal(status(w), "");
  w.cleanup();
});

/** An archive an older strom made: two open tasks left (not put aside). */
async function olderArchive(): Promise<World> {
  const w = new World();
  await w.withTree("Dvořákovi");
  for (const what of ["Křest Jana", "Sňatek Marie"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "Týnec", "--why", "a", "--done-when", "b"]);
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    tree.updateConfig((c) => void (c.mode = "archive"), { op: "config.set", summary: "the research is an archive" });
    tree.commit("The research is an archive");
  });
  return w;
}

const states = (w: World) => Tree.open(w.cwd, w.env).list<Task>("task").map((t) => t.state);

test("an archive's tasks: another computer's seal — nothing written; a failure on the way — nothing left; adopted — put aside", opts, async () => {
  const w = await olderArchive();
  const key = keyOf(w);
  const at = head(w);
  key.away();
  assert.deepEqual(settleArchive(Tree.open(w.cwd, w.env)), []);
  assert.equal(status(w), "");
  assert.deepEqual(states(w), ["open", "open"]);
  key.back();

  const tree = Tree.open(w.cwd, w.env);
  tree.commit = () => {
    throw new Error("git failed");
  };
  assert.throws(() => settleArchive(tree), /git failed/);
  assert.equal(status(w), "", "nothing left in the tree");
  assert.deepEqual(states(w), ["open", "open"]);
  assert.equal(head(w), at);

  assert.deepEqual(settleArchive(Tree.open(w.cwd, w.env)), ["T0001", "T0002"]);
  assert.deepEqual(states(w), ["parked", "parked"]);
  assert.equal(status(w), "");
  w.cleanup();
});
