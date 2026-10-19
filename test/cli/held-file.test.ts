// A file of the research another program holds past strom's waits (Windows: an antivirus, a sync tool, an editor that
// has data/_counters.json open): the command fails as a whole — nothing it wrote stays in the folder, nothing staged,
// the counters as they were — and says the file is held, in the research's language, with no talk of rights; running
// it again once the file is free writes the record once. Found on Windows (1.17.0-beta.4): the person and its log
// stayed outside the history and a second run made a second person. Simulated here with EBUSY, the code a held file
// gives on every platform (strom waits on Windows alone: test/unit/atomic-write.test.ts).

import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";

const realRename = fs.renameSync;
const realRead = fs.readFileSync;

async function world(t: TestContext): Promise<World> {
  const w = new World();
  t.after(() => w.cleanup());
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  return w;
}

const busy = (what: string, file: string) => Object.assign(new Error(`EBUSY: resource busy or locked, ${what} '${file}'`), { code: "EBUSY", path: file });

/** fs.renameSync failing with EBUSY whenever the target is _counters.json (another program holding it). */
function counterHeldForRename(t: TestContext): void {
  t.mock.method(fs, "renameSync", (from: fs.PathLike, to: fs.PathLike) => {
    if (String(to).endsWith("_counters.json")) throw busy("rename", String(from));
    realRename(from, to);
  });
}

/** fs.readFileSync failing with EBUSY for _counters.json (held without letting it be read). */
function counterHeldForRead(t: TestContext): void {
  t.mock.method(fs, "readFileSync", (file: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
    if (String(file).endsWith("_counters.json")) throw busy("open", String(file));
    return (realRead as (...a: unknown[]) => unknown)(file, ...rest);
  });
}

function status(w: World): string {
  return spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "--", "data"], { cwd: w.cwd, encoding: "utf8" }).stdout;
}

const people = (w: World) => fs.readdirSync(path.join(w.cwd, "data", "persons")).sort();

test("a counter file held at the commit: the command leaves nothing behind, says the file is held, and the next run adds the person once", { skip: !hasGit }, async (t) => {
  const w = await world(t);
  const counters = fs.readFileSync(path.join(w.cwd, "data", "_counters.json"), "utf8");
  const before = people(w);
  counterHeldForRename(t);
  const r = await w.run(["person", "add", "Marie /Nováková/", "--sex", "F"]);
  t.mock.restoreAll();
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.err, /drží jiný program/, r.err);
  assert.match(r.err, /_counters\.json/);
  assert.doesNotMatch(r.err, /oprávnění|\.tmp/, r.err);
  assert.deepEqual(people(w), before, "no person left in the folder");
  assert.equal(status(w), "", "nothing written or staged outside the history");
  assert.equal(fs.readFileSync(path.join(w.cwd, "data", "_counters.json"), "utf8"), counters);
  await w.ok(["check"]);
  // the file free again: the same command adds her, once
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]);
  assert.equal(people(w).length, before.length + 1);
  assert.equal(status(w), "");
});

test("a counter file held so it cannot be read: said as held in the person's language, nothing written", { skip: !hasGit }, async (t) => {
  const w = await world(t);
  const before = people(w);
  counterHeldForRead(t);
  const r = await w.run(["person", "add", "Marie /Nováková/", "--sex", "F"]);
  t.mock.restoreAll();
  assert.notEqual(r.code, 0);
  assert.match(r.err, /^chyba: soubor .*_counters\.json drží jiný program/m, r.err);
  assert.match(r.err, /za chvíli spustit tentýž příkaz znovu/);
  assert.doesNotMatch(r.err, /EBUSY|resource busy|--debug/, r.err);
  assert.deepEqual(people(w), before);
  assert.equal(status(w), "");
});

test("an agent reads a held file in English", { skip: !hasGit }, async (t) => {
  const w = await world(t);
  counterHeldForRead(t);
  const r = await w.run(["person", "add", "Marie /Nováková/", "--sex", "F"], { env: { CLAUDECODE: "1" } });
  t.mock.restoreAll();
  assert.match(r.err, /^error: another program is holding .*_counters\.json/m, r.err);
  assert.match(r.err, /run the same command again in a moment/);
});

test("--json: the code fs.held with the file", { skip: !hasGit }, async (t) => {
  const w = await world(t);
  counterHeldForRead(t);
  const r = await w.run(["person", "add", "Marie /Nováková/", "--sex", "F", "--json"]);
  t.mock.restoreAll();
  assert.equal(r.json?.code, "fs.held");
  assert.match(r.json?.params?.file ?? "", /_counters\.json$/);
});

test("a command taken back after its git add (its commit not made): nothing of it stays staged", { skip: !hasGit }, async (t) => {
  const w = await world(t);
  const tree = Tree.open(w.cwd, w.env);
  const file = path.join(w.cwd, "data", "persons", "P0099.json");
  tree.withTreeLock(() => {
    tree.remember(file);
    fs.writeFileSync(file, '{"id":"P0099"}\n');
    spawnSync("git", ["add", "--", "data/persons/P0099.json"], { cwd: w.cwd });
    assert.match(status(w), /^A /m);
    tree.rollback();
  });
  assert.equal(fs.existsSync(file), false);
  assert.equal(status(w), "");
});
