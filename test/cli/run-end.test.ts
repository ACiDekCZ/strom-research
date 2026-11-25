// A run's end stays in the research (.strom/runs/<run>.end.json): why it ended as the Strom app is told it (runsEnded[]
// why, the same mapping from strom run's stop code), the code and its words, its sessions and what they cost, the task
// last worked on and the one it would have started next; a record that cannot be written never fails the run; strom
// tidy keeps the newest of them and lets the old ones go.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";
import { endedRuns, runEndOf, RUN_ENDS_KEPT, RUN_ID, type RunEndRecord } from "../../src/core/runstate.ts";
import { tidyPlan } from "../../src/core/tidy.ts";
import { opts, world } from "./gates.helpers.ts";

const DAY = 24 * 3600_000;

const ends = (root: string): RunEndRecord[] => {
  const dir = path.join(root, ".strom", "runs");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".end.json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as RunEndRecord)
    .sort((a, b) => a.at.localeCompare(b.at));
};

test("a run's end in .strom/runs/<run>.end.json: why as runsEnded[] says it, the stop code and its words, sessions, cost, the last task and the next", opts, async () => {
  const w = await world([{ code: 0 }, { code: 0 }, { code: 2, say: { reason: "týden je z 90 % pryč" } }]);
  try {
    await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true, answers: ["y"] });
    // the gate stops it before its third session: the task it would have started is said
    const r = (await w.ok(["run", "--agent", "script", "--loop", "--json"])).json;
    assert.equal(r.stop, "gate");
    let [end] = ends(w.cwd);
    assert.match(end!.run, RUN_ID);
    assert.deepEqual(
      { why: end!.why, stopCode: end!.stopCode, reason: end!.reason, sessions: end!.sessions, lastTask: end!.lastTask, research: end!.research, agent: end!.agent },
      { why: "gate", stopCode: "gate", reason: r.stopped, sessions: 2, lastTask: r.sessions[1].task, research: null, agent: "script" },
    );
    const next = Tree.open(w.cwd, w.env).list<Task>("task").filter((t) => t.state === "open").map((t) => t.id);
    assert.ok(end!.nextTask && next.includes(end!.nextTask), `${end!.nextTask} of ${next}`);
    assert.equal(typeof end!.costUsd, "number");
    assert.ok(end!.since <= end!.at);
    // the same why as the bridge tells the app
    assert.deepEqual(endedRuns(w.cwd).map((e) => [e.id, e.why]), [[end!.run, "gate"]]);

    // the queue worked through: done (empty), nothing next
    const more = (await w.ok(["run", "--agent", "script", "--loop", "--json"])).json;
    assert.equal(more.stop, "empty");
    end = ends(w.cwd)[1];
    assert.deepEqual([end!.why, end!.stopCode, end!.sessions, end!.nextTask], ["done", "empty", more.sessions.length, undefined]);
    assert.equal(end!.lastTask, more.sessions.at(-1).task);
    assert.equal(end!.why, runEndOf(end!.stopCode, false));

    // a record that cannot be written: the run ends as ever (nothing to do: no session needs .strom/runs)
    if (process.platform !== "win32" && process.getuid?.() !== 0) {
      const runs = path.join(w.cwd, ".strom", "runs");
      fs.chmodSync(runs, 0o555);
      try {
        const again = await w.run(["run", "--agent", "script", "--json"]);
        assert.equal(again.code, 0, again.err);
        assert.equal(again.json.stop, "empty");
      } finally {
        fs.chmodSync(runs, 0o755);
      }
      assert.equal(ends(w.cwd).length, 2, "not written, the run unharmed");
      assert.equal(endedRuns(w.cwd).length, 3, "the app is told of it still");
    }
  } finally {
    w.cleanup();
  }
});

test("each stop code of strom run has its why, the same for .end.json and the bridge's runsEnded[] (runEndOf); asked to stop: stopped", () => {
  const whys: Record<string, string> = {
    done: "done", tasks: "done", sessions: "done", empty: "done", asleep: "done", web: "done",
    user: "stopped",
    limit: "limit",
    gate: "gate", "gate.cap": "gate", "gate.declined": "gate",
    time: "time",
    archive: "archive",
    problems: "error", denied: "error", "denied.codex": "error", auth: "error", model: "error", failed: "error", "gate.error": "error",
  };
  for (const [stop, why] of Object.entries(whys)) {
    assert.equal(runEndOf(stop, false), why, stop);
    assert.equal(runEndOf(stop, true), "stopped", `${stop}, asked to stop`);
  }
  assert.equal(runEndOf("something new", false), "error", "a code it does not know: error");
});

test("strom tidy keeps the newest ends of runs and lets the old ones beyond them go", opts, async () => {
  const w = await world([]);
  try {
    const dir = path.join(w.cwd, ".strom", "runs");
    fs.mkdirSync(dir, { recursive: true });
    const now = Date.now();
    const n = RUN_ENDS_KEPT + 3;
    for (let i = 0; i < n; i++) {
      const file = path.join(dir, `run-1-${i.toString(36)}.end.json`);
      fs.writeFileSync(file, "{}");
      const t = new Date(now - (i + 1) * 40 * DAY); // all of them older than the logs' days, the first newest
      fs.utimesSync(file, t, t);
    }
    fs.writeFileSync(path.join(dir, "run-2-a.end.json"), "{}"); // a new one: kept whatever is kept beside it
    const gone = tidyPlan(Tree.open(w.cwd, w.env), now).items.filter((i) => i.path.endsWith(".end.json")).map((i) => path.basename(i.path)).sort();
    const oldest = Array.from({ length: n }, (_, i) => `run-1-${i.toString(36)}.end.json`).slice(RUN_ENDS_KEPT - 1);
    assert.deepEqual(gone, oldest.sort());
  } finally {
    w.cleanup();
  }
});
