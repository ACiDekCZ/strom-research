// The task and its session closed in one call (K13): strom session close --done "<result>" --next "…" — the task done
// with its result (the summary unless one is given), the session closed, one commit; the two commands as before too.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  w.env.STROM_LANG = "en";
  w.env.STROM_NONINTERACTIVE = "1";
  await w.ok(["person", "add", "Šimon /Ševčík/", "--sex", "M"]);
  await w.ok(["task", "add", "Křest Šimona", "--level", "link", "--where", "matrika Týnec", "--why", "rodiče", "--done-when", "nalezen", "--about", "P0001"]);
  await w.ok(["task", "add", "Sňatek Šimona", "--level", "link", "--where", "matrika Týnec", "--why", "manželka", "--done-when", "nalezen", "--about", "P0001"]);
  return w;
}

const commits = (w: World) => Number(spawnSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).stdout.trim());

test("session close --done: the task done and the session closed in one call", opts, async () => {
  const w = await world();
  await w.ok(["session", "start", "T0001"]);
  // what a close needs is checked before anything is written
  const noNext = await w.run(["session", "close", "--done", "nenalezeno, ročníky 1880–1890 prohledány celé"]);
  assert.equal(noNext.code, 2);
  assert.match(noNext.err, /closing needs --next/);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json")).state, "doing");
  assert.match((await w.run(["session", "close", "--done", "x", "--continue", "--next", "y"])).err, /not with --continue/);

  const before = commits(w);
  const r = await w.ok(["session", "close", "--done", "nenalezeno, ročníky 1880–1890 prohledány celé", "--next", "hledat v sousední farnosti", "--json"]);
  assert.equal(r.json.task.state, "done");
  const t = readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json"));
  assert.equal(t.state, "done");
  assert.equal(t.result, "nenalezeno, ročníky 1880–1890 prohledány celé");
  const s = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.equal(s.state, "closed");
  assert.equal(s.summary, t.result);
  assert.equal(s.next, "hledat v sousední farnosti");
  assert.equal(commits(w), before + 1, "one commit for both");

  // with its own summary, the produced records, and what task done says (no search recorded)
  await w.ok(["session", "start", "T0002"]);
  const text = await w.ok(["session", "close", "--done", "nenalezeno", "--summary", "kniha 1880–1890 prohledána", "--next", "jiná fara", "--produced", "P0001"]);
  assert.match(text.out, /T0002 done: nenalezeno/);
  assert.match(text.out, /note: no search is recorded for T0002/);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0002.json")).summary, "kniha 1880–1890 prohledána");
  assert.deepEqual(readJsonFile(path.join(w.cwd, "data", "tasks", "T0002.json")).produced, ["P0001"]);
  w.cleanup();
});

test("session close without --done: the task closed first, as ever", opts, async () => {
  const w = await world();
  await w.ok(["session", "start", "T0001"]);
  assert.match((await w.run(["session", "close", "--summary", "s", "--next", "n"])).err, /task T0001 is still in progress/);
  await w.ok(["task", "done", "T0001", "--result", "nalezen"]);
  await w.ok(["session", "close", "--summary", "s", "--next", "n"]);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "closed");
  w.cleanup();
});
