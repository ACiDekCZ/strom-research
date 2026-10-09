// strom run exports the GEDCOM once a session ends: the agent's own `session close` inside a run that is at work
// leaves it to the run (V6) — a session of a run no longer at work, or a conversation's, exports as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { opts, agent, world } from "./session.helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { startSession } from "../../src/core/session.ts";
import { enterWorker } from "../../src/core/workers.ts";

test("session close inside a run at work leaves the export to the run; the run exports once", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  const ged = path.join(w.cwd, "output", "tree.ged");

  // the run is at work: its session closed by the agent exports nothing yet
  const leave = enterWorker(w.cwd, "run-1", "Script on its own");
  const env = { ...w.env, STROM_WORKER: "run-1" };
  const t1 = Tree.open(w.cwd, env);
  const s = startSession(t1, { runner: "script" });
  t1.commit(`${s.id} session started`);
  const closed = await w.ok(["session", "close", s.id, "--continue", "--summary", "nic", "--next", "dál", "--json"], { env: { STROM_WORKER: "run-1" } });
  assert.equal(fs.existsSync(ged), false, "not exported by the agent's close");
  assert.equal(closed.json.ged, undefined);
  assert.match((await w.ok(["session", "show", s.id])).out, /closed/);
  leave();

  // a run's session whose run is gone: its close exports (nobody else will)
  const leave2 = enterWorker(w.cwd, "run-2", "Script on its own");
  const t2 = Tree.open(w.cwd, { ...w.env, STROM_WORKER: "run-2" });
  const s2 = startSession(t2, { runner: "script" });
  t2.commit(`${s2.id} session started`);
  leave2();
  const text = (await w.ok(["session", "close", s2.id, "--continue", "--summary", "nic", "--next", "dál"])).out;
  assert.match(text, /GEDCOM .*tree\.ged/);
  assert.ok(fs.existsSync(ged));
  fs.rmSync(ged);

  // the whole run: the agent closes its session, the run exports
  w.env.STROM_RUNNER_SCRIPT = agent;
  const r = await w.run(["run", "--agent", "script", "--json"]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(fs.readFileSync(ged, "utf8"), /2 DATE 25 JUN 1905/);
  w.cleanup();
});
