// An archive, and a research waiting for its agent, put the material's tasks aside for research switched on — and say
// nothing of them: no "New task" in status, the history or the bridge's /log while the task list says none
// (found in an archive: "Nový úkol: Roztřídit dávku …" in status and history, "Žádné úkoly." in task list). Research
// switched on: the task said again, nothing lost.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { history } from "../../src/core/live.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

/** An agent installed: a fake Claude Code first on PATH. */
function installAgent(w: World): void {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  w.env.PATH = [bin, w.env.PATH].join(path.delimiter);
}

const TASK = /Nový úkol|[Úú]kol/;

test("an archive's material: its task put aside, never said in status, history or the bridge's /log; said again once research is on", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  await w.ok(["intake", "--text", "Děda Karel byl mlynář"]);
  const t = Tree.open(w.cwd, w.env).list<Task>("task");
  assert.ok(t.length && t.every((x) => x.heldBy === "archive"), JSON.stringify(t));
  for (const args of [["status"], ["history"]]) {
    const r = await w.ok(args);
    assert.doesNotMatch(r.out, TASK, `${args.join(" ")}:\n${r.out}`);
  }
  const tree = Tree.open(w.cwd, w.env);
  const log = history(w.cwd, tree).flatMap((e) => e.text);
  assert.ok(log.length, "the history says what came");
  assert.ok(!log.some((l) => TASK.test(l)), log.join("\n"));
  // research switched on (its agent here): the task the archive kept is said in the history again
  installAgent(w);
  await w.ok(["mode", "research"], { tty: true, answers: ["", "", "", ""] });
  const on = history(w.cwd, Tree.open(w.cwd, w.env)).flatMap((e) => e.text);
  assert.ok(on.some((l) => /Nový úkol/.test(l)), on.join("\n"));
  w.cleanup();
});

test("a research waiting for its agent: its open task not said in status or the history either", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.withTree("Čekající");
  await w.ok(["intake", "--text", "Teta Marie šila šaty"]);
  assert.ok(Tree.open(w.cwd, w.env).list<Task>("task").some((x) => x.state === "open" && !x.heldBy));
  for (const args of [["status"], ["history"]]) {
    const r = await w.ok(args);
    assert.doesNotMatch(r.out, TASK, `${args.join(" ")}:\n${r.out}`);
  }
  const log = history(w.cwd, Tree.open(w.cwd, w.env)).flatMap((e) => e.text);
  assert.ok(!log.some((l) => TASK.test(l)), log.join("\n"));
  w.cleanup();
});
