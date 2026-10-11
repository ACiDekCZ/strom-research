// A run's gate leaves a trace: each time it is asked — when, which gate with what it was given, its exit status and
// verdict, why, how long to wait, the plan's limits it was given, what the run did — in .strom/gate.log, at the head of
// the next session's log, and in one line of the run's output; the record is kept within limits by strom tidy.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Tree } from "../../src/core/tree.ts";
import { gateRecord, type Gate } from "../../src/core/gate.ts";
import { tidy, tidyPlan } from "../../src/core/tidy.ts";
import { opts, world } from "./gates.helpers.ts";

const DAY = 24 * 3600_000;

test("each answer of the gate is recorded: .strom/gate.log, the next session's log, one line of the run's output", opts, async () => {
  const w = await world([{ code: 0, say: { reason: "dost místa" } }, { code: 0 }, { code: 2, say: { reason: "týden je z 90 % pryč" } }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true });
  const r = await w.ok(["run", "--agent", "script", "--loop", "--json"]);
  assert.equal(r.json.sessions.length, 2);
  const log = fs.readFileSync(path.join(w.cwd, ".strom", "gate.log"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(log.length, 3);
  assert.deepEqual(log.map((l) => [l.gate, l.status, l.verdict, l.then, l.sessions]), [
    ["zkouska", 0, "go", "go", 0],
    ["zkouska", 0, "go", "go", 1],
    ["zkouska", 2, "stop", "stop", 2],
  ]);
  assert.equal(log[0].reason, "dost místa");
  assert.equal(log[2].reason, "týden je z 90 % pryč");
  assert.match(log[0].run, /^run-/);
  assert.equal(new Set(log.map((l) => l.run)).size, 1, "one run");
  assert.match(log[0].task, /^T000\d$/);
  assert.deepEqual(log[0].args, []);
  assert.ok(!Number.isNaN(Date.parse(log[0].at)));
  // the session it let begin: its answer at the head of its log
  const session = fs.readFileSync(path.join(w.cwd, ".strom", "runs", `${r.json.sessions[0].session}.log`), "utf8");
  assert.match(session, /^\[strom\] gate \{.*"verdict":"go".*"then":"go"/);
  // the --json answers carry the exit status
  assert.deepEqual(r.json.gate.answers.map((a: { status: number }) => a.status), [0, 0, 2]);
  // one line each, in the research language
  assert.match(r.err, /· podmínka Zkouška: pokračovat — dost místa \(kód 0; \.strom\/gate\.log\)/);
  assert.match(r.err, /· podmínka Zkouška: zastavit — týden je z 90 % pryč \(kód 2; \.strom\/gate\.log\)/);
  w.cleanup();
});

test("a wait past --until and a gate that fails are recorded with what the run did; a user's 'start anyway' too", opts, async () => {
  const w = await world([{ code: 1, say: { reason: "sezení je plné", wait: 7200 } }, { code: 7 }, { code: 1, say: { reason: "sezení je plné", wait: 7200 } }]);
  await w.ok(["config", "set", "run.gate", "zkouska 10"], { tty: true });
  const soon = new Date(Date.now() + 60 * 60_000);
  const until = `${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`;
  await w.ok(["run", "--agent", "script", "--loop", "--until", until, "--json"]);
  await w.run(["run", "--agent", "script", "--loop", "--json"]);
  const yes = await w.ok(["run", "--agent", "script"], { tty: true, answers: ["a"] });
  assert.match(yes.out, /· podmínka Zkouška: počkat do .+ — sezení je plné \(kód 1; \.strom\/gate\.log\)/);
  const log = fs.readFileSync(path.join(w.cwd, ".strom", "gate.log"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(log.map((l) => [l.status, l.verdict, l.then]), [
    [1, "wait", "stop"],
    [7, "error", "stop"],
    [1, "wait", "anyway"],
  ]);
  assert.deepEqual(log[0].args, ["10"], "what the gate was given");
  assert.equal(log[0].waitMs, 7_200_000);
  assert.ok(Math.abs(Date.parse(log[0].until) - Date.parse(log[0].at) - 7_200_000) < 1000, "until: when it said to ask again");
  assert.match(log[1].reason, /kódem 7/);
  w.cleanup();
});

test("the record carries the plan's limits the gate was given; strom tidy keeps it within its days", opts, async () => {
  const gate: Gate = { name: "zkouska", dir: "/x", manifest: { interface: 1, command: ["node", "gate.ts"] }, args: ["10"] };
  const limits = [{ kind: "seven_day" as const, used: 0.42, at: "2026-10-01T10:00:00.000Z" }];
  const rec = gateRecord(gate, { verdict: "go", status: 0 }, { tree: "/t", lang: "cs", agent: "claude", sessions: 1, costUsd: 0.123, limits, run: "run-1" });
  assert.deepEqual(rec.limits, limits);
  assert.equal(rec.costUsd, 0.12);
  // the record kept in order: its lines older than 90 days go, the newer stay
  const w = await world([]);
  const file = path.join(w.cwd, ".strom", "gate.log");
  const old = JSON.stringify({ ...rec, at: new Date(Date.now() - 100 * DAY).toISOString(), reason: "stará" });
  const fresh = JSON.stringify({ ...rec, at: new Date().toISOString(), reason: "nová" });
  fs.writeFileSync(file, `${old}\n${fresh}\n`);
  const tree = Tree.open(w.cwd, { ...process.env, ...w.env });
  const plan = tidyPlan(tree);
  assert.ok(plan.items.some((i) => i.kind === "gate" && i.path === path.join(".strom", "gate.log") && i.do === "shrink"));
  tidy(tree, plan, "person");
  const left = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(left, /stará/);
  assert.match(left, /nová/);
  w.cleanup();
});
