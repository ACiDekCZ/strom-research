// An archive asks the person nothing: the tasks that wait for the user are put aside too, and wait again when research
// is switched on. An archive an older strom made (rc.15/16 put aside open tasks only) catches up by itself — at the
// first run of a newer strom, when its bridge starts — logged with the reason; until then none of them is shown
// (found 2026-10-03: the Strom app said "4 wait for you" in an archive).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";

const opts = { skip: !hasGit };

/** A research with a task waiting for the user, made an archive the way an older strom did: its waiting task left. */
async function olderArchive(): Promise<World> {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "Týnec", "--why", "a", "--done-when", "b"]);
  await w.ok(["task", "wait", "T0001", "--on", "snímky 1–3 knihy oddaných"]);
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    tree.updateConfig((c) => void (c.mode = "archive"), { op: "config.set", summary: "the research is an archive" });
    tree.commit("The research is an archive");
  });
  return w;
}

const task = async (w: World) => (await w.ok(["task", "show", "T0001", "--json"])).json.task as { state: string; heldBy?: string; heldFrom?: string; waitingOn?: string };

test("an archive an older strom made: nothing waits for the person, its bridge puts the task aside (logged), research back: it waits again", opts, async () => {
  const w = await olderArchive();
  // before anything settles it: none shown — the menu, the orientation, the app
  assert.match((await w.run(["menu"], { tty: true, answers: ["3", "", "0"] })).out, /Nic nečeká/);
  assert.doesNotMatch((await w.run([])).out, /snímky 1–3/);
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as { waiting: unknown[] };
    assert.deepEqual(status.waiting, []);
  } finally {
    await w.ok(["live", "stop"]);
  }
  // the bridge's start put it aside, with the reason, in the history
  assert.deepEqual(await task(w), { ...(await task(w)), state: "parked", heldBy: "archive", heldFrom: "waiting" });
  const history = (await w.ok(["history", "--json"])).json;
  assert.match(JSON.stringify(history), /Tasks put aside: the research is an archive \(T0001\)/);
  // research switched on: it waits for the person again, what it waits for kept
  await w.ok(["mode", "research"], { tty: true });
  const back = await task(w);
  assert.deepEqual([back.state, back.heldBy, back.heldFrom, back.waitingOn], ["waiting", undefined, undefined, "snímky 1–3 knihy oddaných"]);
  // an archive again: put aside with the switch itself
  await w.ok(["mode", "archive"], { tty: true });
  assert.deepEqual([(await task(w)).state, (await task(w)).heldFrom], ["parked", "waiting"]);
  w.cleanup();
});

test("an archive an older strom made catches up at the first run of a newer strom", opts, async () => {
  const w = await olderArchive();
  const cfg = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  fs.writeFileSync(cfg, JSON.stringify({ ...readJsonFile(cfg), lastVersion: "1.0.0" }));
  await w.ok(["stats"]);
  assert.equal((await task(w)).state, "parked");
  assert.equal((await task(w)).heldFrom, "waiting");
  w.cleanup();
});
