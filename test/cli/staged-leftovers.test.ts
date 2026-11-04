// A write that failed after its `git add` (its commit not made) put its files back, but git's index kept them: the
// process ended before it could take them out, or git could not write its index then (found on Windows, 1.26.0: an
// interrupted `strom recordset add` — every write after it refused with "data was changed outside strom", the new
// operation log and the new book said deleted, while strom verify and strom repair found nothing). Nothing of it was
// ever in the history and nothing on the disk differs from the history: no change outside strom. The next write takes
// it out of the index by itself, strom repair always does; a sealed file truly deleted or edited is still said.

import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

async function world(t: TestContext): Promise<World> {
  const w = new World();
  t.after(() => w.cleanup());
  await w.withTree();
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
  return w;
}

const git = (w: World, ...args: string[]) => spawnSync("git", args, { cwd: w.cwd, encoding: "utf8" });
const status = (w: World, ...paths: string[]) => git(w, "status", "--porcelain", "--untracked-files=all", "--", ...(paths.length ? paths : ["data", "strom.json", "history", "quality"])).stdout;
const books = (w: World) => (fs.existsSync(path.join(w.cwd, "data", "recordsets")) ? fs.readdirSync(path.join(w.cwd, "data", "recordsets")).sort() : []);

/**
 * The commit of the next write fails after its git add (git's input for commit-tree cannot be made), and git's index is
 * held by another program from then on (its lock there): the command takes back its files, but not what it staged.
 * Once the command ended, the other program lets go of the index.
 */
async function interruptedAfterAdd(t: TestContext, w: World, args: string[]): Promise<void> {
  const lock = path.join(w.cwd, ".git", "index.lock");
  const real = fs.mkdtempSync;
  let done = false;
  t.mock.method(fs, "mkdtempSync", (prefix: string, ...rest: unknown[]) => {
    if (!done && String(prefix).includes("strom-git-") && git(w, "diff", "--cached", "--quiet").status === 1) {
      done = true;
      fs.writeFileSync(lock, "");
      throw Object.assign(new Error("EPERM: operation not permitted, mkdtemp"), { code: "EPERM" });
    }
    return (real as (...a: unknown[]) => string)(prefix, ...rest);
  });
  const r = await w.run(args);
  t.mock.restoreAll();
  fs.rmSync(lock, { force: true });
  assert.notEqual(r.code, 0, `${r.out}\n${r.err}`);
  assert.ok(done, "the commit failed after its git add");
}

const BOOK = ["recordset", "add", "Lhota 3, N 1801-1830", "--kinds", "baptism", "--places", "Lhota", "--years", "1801-1830"];

test("a write taken back after its git add, the index left as it was: the next write takes it out by itself and goes on", { skip: !hasGit }, async (t) => {
  const w = await world(t);
  const before = books(w);
  await interruptedAfterAdd(t, w, BOOK);
  // the state found on Windows: the new log and the new book staged, gone from the folder
  assert.deepEqual(books(w), before, "nothing of it left in the folder");
  const left = status(w);
  assert.match(left, /^AD data\/ops\/.+\.jsonl$/m, left);
  assert.match(left, /^AD data\/recordsets\/B\d+\.json$/m, left);
  const lost = /^AD data\/recordsets\/(B\d+)\.json$/m.exec(left)![1];
  // the counter as on Windows: its next number staged, the file put back as the history has it
  assert.match(left, /^MM data\/_counters\.json$/m, left);
  assert.equal(git(w, "diff", "HEAD", "--quiet", "--", "data/_counters.json").status, 0, "the counter on the disk as in the history");
  // nothing changed outside strom: the check says so, the write goes on
  const fast = await w.run(["verify", "--fast"]);
  assert.equal(fast.code, 0, `${fast.out}\n${fast.err}`);
  await w.ok(BOOK);
  assert.equal(books(w).length, before.length + 1);
  // the number of the book never written is given again: no gap, nothing given twice
  assert.ok(books(w).includes(`${lost}.json`), `${lost} ${books(w).join(" ")}`);
  assert.equal(status(w), "", "the folder and the index as the history has them");
  await w.ok(["check"]);
  await w.ok(["verify"]);
});

test("strom repair takes what an interrupted write left out of git's index (the tree in the state found on Windows)", { skip: !hasGit }, async (t) => {
  const w = await world(t);
  await interruptedAfterAdd(t, w, BOOK);
  assert.match(status(w), /^AD /m);
  const r = await w.ok(["repair", "--json"]);
  assert.ok(r.json.unstaged >= 2, JSON.stringify(r.json));
  assert.equal(r.json.ok, true);
  assert.equal(status(w), "");
  assert.deepEqual(r.json.restored, []);
  assert.deepEqual(r.json.quarantined, []);
  // said to a person in the research's language
  await interruptedAfterAdd(t, w, BOOK);
  const said = await w.ok(["repair"]);
  assert.match(said.out, /index/u, said.out);
  assert.doesNotMatch(said.out, /není co opravit/u, said.out);
  assert.equal(status(w), "");
  await w.ok(BOOK);
  await w.ok(["check"]);
});

test("an edit of a record taken back after its git add: still said by the check (a file of the history), strom repair puts the index back", { skip: !hasGit }, async (t) => {
  const w = await world(t);
  await interruptedAfterAdd(t, w, ["person", "edit", "P0001", "--prefix", "Ing."]);
  const left = status(w);
  assert.match(left, /^MM data\/persons\/P0001\.json$/m, left);
  // only a path of no commit and no folder is taken out by itself: a file of the history is the person's to repair
  const fast = await w.run(["verify", "--fast"]);
  assert.notEqual(fast.code, 0, `${fast.out}\n${fast.err}`);
  assert.match(fast.out + fast.err, /P0001/u);
  const r = await w.ok(["repair", "--json"]);
  assert.ok(r.json.unstaged >= 1, JSON.stringify(r.json));
  assert.equal(status(w), "");
  await w.ok(["person", "edit", "P0001", "--prefix", "Ing."]);
  assert.equal(status(w), "");
  assert.match(fs.readFileSync(path.join(w.cwd, "data", "persons", "P0001.json"), "utf8"), /Ing\./u);
  await w.ok(["verify"]);
});

test("a record created outside strom and staged is still said — only what is in no folder is taken out", { skip: !hasGit }, async (t) => {
  const w = await world(t);
  const rec = path.join(w.cwd, "data", "persons", "P0077.json");
  fs.writeFileSync(rec, fs.readFileSync(path.join(w.cwd, "data", "persons", "P0001.json"), "utf8").replace(/P0001/gu, "P0077"));
  git(w, "add", "--", "data/persons/P0077.json");
  const r = await w.run(["verify", "--fast"]);
  assert.notEqual(r.code, 0);
  assert.match(r.out + r.err, /P0077/u);
  const write = await w.run(["person", "add", "Marie /Lhotáková/", "--sex", "F"]);
  assert.notEqual(write.code, 0);
  assert.match(write.err, /mimo strom/u, write.err);
  await w.ok(["repair"]);
  assert.equal(fs.existsSync(rec), false);
  assert.equal(status(w), "");
});

test("a sealed record truly deleted is still said, staged or not — never taken for what a write left", { skip: !hasGit }, async (t) => {
  const w = await world(t);
  const rec = path.join(w.cwd, "data", "persons", "P0001.json");
  // deleted, the deletion not staged
  fs.rmSync(rec);
  let gone = await w.run(["verify", "--fast"]);
  assert.notEqual(gone.code, 0);
  assert.match(gone.out + gone.err, /P0001/u);
  await w.ok(["repair"]);
  assert.ok(fs.existsSync(rec));
  // deleted, and the deletion staged (git rm)
  git(w, "rm", "-q", "--", "data/persons/P0001.json");
  assert.equal(fs.existsSync(rec), false);
  let r = await w.run(["verify", "--fast"]);
  assert.notEqual(r.code, 0);
  assert.match(r.out + r.err, /P0001/u);
  r = await w.run(["person", "add", "Marie /Lhotáková/", "--sex", "F"]);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /mimo strom/u, r.err);
  await w.ok(["repair"]);
  assert.ok(fs.existsSync(rec));
  assert.equal(status(w), "");
  // edited by hand and staged: still an edit outside strom
  fs.writeFileSync(rec, fs.readFileSync(rec, "utf8").replace("Jan", "Jiří"));
  git(w, "add", "--", "data/persons/P0001.json");
  r = await w.run(["verify", "--fast"]);
  assert.notEqual(r.code, 0);
  await w.ok(["repair"]);
  assert.equal(status(w), "");
  assert.match(fs.readFileSync(rec, "utf8"), /Jan/u);
});

test("a git that ended mid-way left its index.lock: strom repair takes a stale one away, a fresh one stays", { skip: !hasGit }, async (t) => {
  const w = await world(t);
  const lock = path.join(w.cwd, ".git", "index.lock");
  fs.writeFileSync(lock, "");
  // a moment old: some git may be at work — left where it is
  let r = await w.run(["repair", "--json"]);
  assert.ok(fs.existsSync(lock));
  assert.notEqual(r.json?.lock, true);
  // an hour old: no git holds its index that long
  const old = new Date(Date.now() - 60 * 60_000);
  fs.utimesSync(lock, old, old);
  const write = await w.run(["person", "add", "Marie /Lhotáková/", "--sex", "F"]);
  assert.notEqual(write.code, 0);
  assert.match(write.err, /strom repair/u, write.err);
  r = await w.ok(["repair", "--json"]);
  assert.equal(r.json.lock, true);
  assert.equal(fs.existsSync(lock), false);
  await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]);
  assert.equal(status(w), "");
});
