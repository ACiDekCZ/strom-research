// What kind each family tree is (strom trees, the bridge's /status), and a family tree moved out of strom's folder by
// hand: said where it was (moved?) and how its new folder is added — never another tree opened in its place; one taken
// away with strom trees remove is not said to be missing.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

test("strom trees and /status say what each tree is: a research, one waiting for its agent, a Strom archive", opts, async () => {
  const w = new World();
  // the stand-in Claude Code only: no agent of this computer
  w.env.PATH = [path.join(w.dir, "agents"), path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  await w.ok(["init", "Svobodovi"]);
  // its agent is not on this computer: the research waits for it
  await w.ok(["config", "set", "agent", "grok", "--for-tree"], { cwd: w.treeDir("Svobodovi") });
  const json = (await w.ok(["trees", "--json"])).json as { trees: { name: string; state: string; kind: string }[] };
  assert.deepEqual(Object.fromEntries(json.trees.map((t) => [t.name, t.state])), { Archiv: "archive", Novákovi: "research", Svobodovi: "waiting" });
  // the kind the Strom app shows: a research waiting for its agent is an archive until an agent starts on it
  assert.deepEqual(Object.fromEntries(json.trees.map((t) => [t.name, t.kind])),{ Archiv: "archive", Novákovi: "research", Svobodovi: "archive" });
  const text = (await w.ok(["trees"])).out;
  const line = (name: string) => text.split("\n").find((l) => l.startsWith(name)) ?? "";
  assert.match(line("Archiv"), /Archiv Stromu/, text);
  // an archive: nothing of an agent, nor of research directions
  assert.doesNotMatch(line("Archiv"), /agent|AI|linií výzkumu/, text);
  assert.match(line("Svobodovi"), /výzkum čeká na AI agenta/, text);
  assert.match(line("Novákovi"), /^Novákovi +cs +výzkum +osob: 0/, text);
  // the bridge says it beside the tree, for the app
  const archive = w.treeDir("Archiv");
  const info = (await w.ok(["live", "start", "--json"], { cwd: archive })).json;
  try {
    const status = (await (await fetch(`${info.url}/status`)).json()) as { tree: { state: string; kind: string }; features: string[]; seal: string };
    assert.equal(status.tree.state, "archive");
    assert.equal(status.tree.kind, "archive");
    assert.ok(status.features.includes("tree.state"));
    assert.ok(status.features.includes("tree.kind"));
    assert.equal(status.seal, "here");
  } finally {
    await w.ok(["live", "stop"], { cwd: archive });
  }
  // a research waiting for its agent: its state says so, its kind is an archive; a research with its agent here: research
  for (const [name, state, kind] of [["Svobodovi", "waiting", "archive"], ["Novákovi", "research", "research"]] as const) {
    const dir = w.treeDir(name);
    const live = (await w.ok(["live", "start", "--json"], { cwd: dir })).json;
    try {
      const status = (await (await fetch(`${live.url}/status`)).json()) as { tree: { state: string; kind: string } };
      assert.deepEqual([status.tree.state, status.tree.kind], [state, kind], name);
    } finally {
      await w.ok(["live", "stop"], { cwd: dir });
    }
  }
  w.cleanup();
});

test("a tree moved out of strom's folder: said where it was, never another opened in its place; its new folder added", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  await w.ok(["init", "Dvořákovi"]);
  await w.ok(["trees", "use", "Novákovi"]);
  // moved by hand, out of strom's folder
  const moved = path.join(w.dir, "jinde", "Novákovi");
  fs.mkdirSync(path.dirname(moved), { recursive: true });
  fs.renameSync(w.treeDir("Novákovi"), moved);
  // the list says it, and how to add the new folder
  const trees = await w.ok(["trees"]);
  assert.match(trees.out, /^rodokmen „Novákovi“ už není v .+Novákovi \(přesunutý\?\) – přidat novou cestu: strom trees use "<složka>" · už nechtěný: strom trees forget "Novákovi"$/m, trees.out);
  assert.deepEqual((await w.ok(["trees", "--json"])).json.missing.map((m: { name: string }) => m.name), ["Novákovi"]);
  // the overview too
  assert.match((await w.ok([])).out, /rodokmen „Novákovi“ už není v/);
  // the bridge, a command: refused, the trees there are listed — never Dvořákovi in its place
  for (const args of [["app"], ["live", "start"], ["person", "list"]]) {
    const r = await w.run(args);
    assert.notEqual(r.code, 0, `${args.join(" ")}: ${r.out}`);
    assert.match(r.err, /^chyba: rodokmen „Novákovi“ už není v .+ \(přesunutý\?\) – jiný se místo něj neotevře$/m, r.err);
    assert.match(r.err, /^ {2}Dvořákovi {2}\(/m, r.err);
    assert.match(r.err, /^→ přidat novou cestu: strom trees use "<složka>"/m, r.err);
  }
  assert.ok(!fs.existsSync(path.join(w.treeDir("Dvořákovi"), ".strom", "live.json")), "no bridge for another tree");
  // its new folder: remembered (outside strom's folder), worked on again, said missing no more
  await w.ok(["trees", "use", moved]);
  assert.ok((readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).extraTrees as string[]).includes(moved));
  const after = (await w.ok(["trees", "--json"])).json;
  assert.equal(after.missing, undefined);
  assert.deepEqual(after.trees.map((t: { name: string }) => t.name).sort(), ["Dvořákovi", "Novákovi"]);
  assert.equal((await w.ok(["--json"])).json.tree.root, moved);
  w.cleanup();
});

test("a moved tree with no tree chosen: the only one left is not opened in its place; forgotten, or taken away with trees remove, never said", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  await w.ok(["init", "Dvořákovi"]);
  await w.ok(["trees"]);
  fs.renameSync(w.treeDir("Novákovi"), path.join(w.dir, "Novákovi"));
  const r = await w.run(["person", "list"]);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /rodokmen „Novákovi“ už není v/, r.err);
  // only the person forgets it — nothing deleted
  assert.notEqual((await w.run(["trees", "forget", "Novákovi"], { env: { CLAUDECODE: "1" } })).code, 0);
  assert.match((await w.ok(["trees", "forget", "novakovi"], { tty: true })).out, /„Novákovi“ je na tomto počítači zapomenutý – nic se nesmazalo/);
  assert.ok(fs.existsSync(path.join(w.dir, "Novákovi", "strom.json")));
  assert.doesNotMatch((await w.ok(["trees"])).out, /už není v/);
  await w.ok(["person", "list"]);
  // a tree taken away with strom trees remove: gone on purpose, never "moved?"
  await w.ok(["init", "Svobodovi"]);
  await w.ok(["trees"]);
  const removed = await w.ok(["trees", "remove", "Dvořákovi"], { answers: ["n", "Dvořákovi"] });
  assert.ok(!fs.existsSync(w.treeDir("Dvořákovi")), removed.out + removed.err);
  const left = await w.ok(["trees", "--json"]);
  assert.equal(left.json.missing, undefined, JSON.stringify(left.json));
  assert.doesNotMatch((await w.ok(["trees"])).out, /už není v/);
  w.cleanup();
});
