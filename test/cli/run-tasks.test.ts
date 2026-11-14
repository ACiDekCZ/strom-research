// strom run --tasks N (spec 052, the app's ZADANI_VYZKUM_hledani-ve-fronte.md, section 5): the run ends after N tasks
// settled — done, waiting, parked (by the run as stuck too) or dropped after their session, each counted once; a task
// given back to the queue does not count; at most 2×N sessions (stop: sessions); an empty queue ends it as ever.
// A scripted agent only (the script runner), told per task what to do. Made-up names only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit, timeout: 240_000 };

/**
 * The agent: AGENT_PLAN says per task what each of its sessions does, in turn (the last one repeats) — done, wait,
 * drop, park (closed by the agent), back (a note written, given back to the queue), idle (nothing written, given back).
 */
const AGENT = `
import { spawnSync } from "node:child_process";
import fs from "node:fs";
const strom = (...a) => spawnSync("strom", a, { encoding: "utf8", env: process.env, shell: process.platform === "win32" });
const task = /## Task (T\\d{4})/.exec(process.env.STROM_PROMPT ?? "")?.[1];
const plan = JSON.parse(process.env.AGENT_PLAN ?? "{}");
const seen = process.env.AGENT_SEEN;
const n = fs.existsSync(seen) ? fs.readFileSync(seen, "utf8").split("\\n").filter((l) => l === task).length : 0;
fs.appendFileSync(seen, task + "\\n");
const steps = plan[task] ?? ["done"];
const what = steps[Math.min(n, steps.length - 1)];
if (what === "idle") strom("session", "close", "--continue", "--summary", "nic", "--next", "znovu", "--reason", "nothing more to do in this session");
else {
  strom("note", "add", "P1", "Lhoták z Lhoty " + task + " " + n);
  if (what === "done") strom("task", "done", task, "--result", "nalezeno");
  if (what === "wait") strom("task", "wait", task, "--on", "odpověď archivu v Lhotě", "--kind", "letter");
  if (what === "drop") strom("task", "drop", task, "--reason", "kniha shořela");
  if (what === "park") strom("task", "park", task, "--reason", "později");
  if (what === "back") strom("session", "close", "--continue", "--summary", "část", "--next", "dál");
  else strom("session", "close", "--summary", what, "--next", "další");
}
`;

/** Jan Lhoták (P1) and `tasks` tasks of his line, T1 first; the agent as AGENT_PLAN says. */
async function world(tasks: number, plan: Record<string, string[]>): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  for (let i = 0; i < tasks; i++)
    await w.ok(["task", "add", `Zápis ${i + 1} v Lhotě`, "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", String(5 - i)]);
  const agent = path.join(w.home, "agent-plan.mjs");
  fs.writeFileSync(agent, AGENT);
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_PLAN: JSON.stringify(plan), AGENT_SEEN: path.join(w.home, "agent-seen.txt") });
  return w;
}

const run = async (w: World, n: string) => (await w.ok(["run", "--agent", "script", "--tasks", n, "--json"])).json;
const tasksOf = (r: any) => r.sessions.map((s: { task: string }) => s.task);

test("run --tasks: done, waiting, dropped and parked tasks count once each; one given back does not; it ends at n", opts, async () => {
  const w = await world(5, { T0001: ["back", "done"], T0002: ["wait"], T0003: ["drop"], T0004: ["park"], T0005: ["done"] });
  try {
    const r = await run(w, "3");
    // T1 given back (a note written: not stuck) → not counted, taken again; T2 waiting, T3 dropped → 3 settled with T1 done
    assert.equal(r.stop, "tasks", JSON.stringify(r));
    assert.deepEqual([...r.settled].sort(), ["T0001", "T0002", "T0003"], JSON.stringify(r));
    assert.equal(r.sessions.length, 4, JSON.stringify(tasksOf(r)));
    assert.equal(tasksOf(r).filter((t: string) => t === "T0001").length, 2, "given back, then taken again and done");
    assert.equal((await w.ok(["task", "show", "T4", "--json"])).json.task.state, "open", "nothing more started after n");
    // parked by the agent counts too
    const more = await run(w, "1");
    assert.equal(more.stop, "tasks");
    assert.deepEqual(more.settled, ["T0004"]);
  } finally {
    w.cleanup();
  }
});

test("run --tasks: a task the run parks as stuck counts; at most 2×n sessions, then it stops (sessions)", opts, async () => {
  // T1 stuck (nothing written twice) → parked by the run → settled
  const stuck = await world(2, { T0001: ["idle"], T0002: ["back"] });
  try {
    const r = await run(stuck, "1");
    assert.equal(r.stop, "tasks", JSON.stringify(r));
    assert.deepEqual(r.settled, ["T0001"]);
    assert.equal((await stuck.ok(["task", "show", "T1", "--json"])).json.task.state, "parked");
    assert.deepEqual(tasksOf(r), ["T0001", "T0001"]);
    // only given back: 2×n sessions and no more, said so
    const capped = await stuck.run(["run", "--agent", "script", "--tasks", "2", "--json"]);
    const c = JSON.parse(capped.out);
    assert.equal(c.stop, "sessions", capped.out);
    assert.equal(c.sessions.length, 4);
    assert.deepEqual(c.settled, []);
    assert.match((await stuck.run(["run", "--agent", "script", "--tasks", "1"])).out + "", /sezení: 2 \(nejvíc pro žádaný počet úkolů\) – vyřízené úkoly: 0/u);
  } finally {
    stuck.cleanup();
  }
});

test("run --tasks: an empty queue ends the run before n; the stop said in the research language", opts, async () => {
  const w = await world(2, {});
  try {
    // the research's own tasks and the two: fewer than 5, each done once — the queue empty, the run ends (empty)
    const r = await run(w, "5");
    assert.equal(r.stop, "empty", JSON.stringify(r));
    assert.ok(r.settled.length >= 2 && r.settled.length < 5, JSON.stringify(r));
    assert.deepEqual([...r.settled].sort(), [...new Set(tasksOf(r))].sort());
    assert.equal(r.sessions.length, r.settled.length);
    await w.ok(["task", "add", "Zápis 3 v Lhotě", "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
    assert.match((await w.ok(["run", "--agent", "script", "--tasks", "1"])).out, /vyřízené úkoly: 1/u);
  } finally {
    w.cleanup();
  }
});

test("run --tasks: 1–100 only, never with --max, --loop, --task, --until, --places or --history", { skip: !hasGit }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    for (const bad of ["0", "101", "2.5", "x5", "5x", "1000"]) {
      const r = await w.run(["run", "--agent", "script", "--tasks", bad, "--json"]);
      assert.notEqual(r.code, 0, bad);
      assert.equal(JSON.parse(r.out).code, "run.tasks", `${bad}: ${r.out}`);
    }
    for (const other of [["--max", "2"], ["--loop"], ["--task", "T1"], ["--until", "12:00"], ["--places"], ["--history"]]) {
      const r = await w.run(["run", "--agent", "script", "--tasks", "3", ...other, "--json"]);
      assert.notEqual(r.code, 0, other.join(" "));
      const j = JSON.parse(r.out);
      assert.equal(j.code, "run.tasks", r.out);
      assert.match(j.error ?? j.message ?? r.out, new RegExp(other[0]!), r.out);
    }
    // the help says every option it refuses: the ones a person sees by name, the hidden ones (--places, --history)
    // as another choice of the tasks, never by name
    const help = (await w.ok(["help", "run"])).out;
    assert.match(help, /not with --max, --loop, --task, --until or another choice of the tasks/);
    assert.doesNotMatch(help, /--places|--history/);
  } finally {
    w.cleanup();
  }
});
