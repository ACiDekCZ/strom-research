// Holds of tasks beside an older strom (spec 127, design chapter 6): an older strom writes no hold, so its open sessions
// are judged as before — a live worker holds, a live run.lock of a strom before 1.25 holds its run's sessions, and a
// session with neither lapses task.hold after the last write to its own operation logs (else after its start). The
// older strom is its data: sessions written as it wrote them (no hold, its worker or run.lock held by this process).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Session, Task } from "../../src/core/model.ts";
import { enterWorker } from "../../src/core/workers.ts";
import { acquireLock } from "../../src/core/lock.ts";
import { opsLogsOf } from "../../src/core/opslog.ts";
import { makeNote } from "../../src/core/actions.ts";

const MIN = 60_000;
const B = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "lhotak-b" };
const C = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "lhotak-c" };

async function fourTasks(w: World): Promise<string[]> {
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "ABT 1885", "--born-place", "Lhota"]);
  for (const t of (await w.ok(["task", "list", "--state", "all", "--json"])).json.tasks as { id: string }[]) await w.ok(["task", "drop", t.id, "--reason", "test"]);
  const ids: string[] = [];
  for (const [i, what] of ["Křest Jana", "Oddavky rodičů", "Křest otce", "Úmrtí děda"].entries())
    ids.push((await w.ok(["task", "add", what, "--level", "locate", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", String(5 - i), "--json"])).json.task.id);
  return ids;
}

/** One task more (the four of fourTasks taken or held). */
async function oneMore(w: World): Promise<string> {
  return (await w.ok(["task", "add", "Sčítání 1900", "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", "1", "--json"])).json.task.id;
}

/** What git has not committed of the research's data. */
function uncommitted(w: World): string[] {
  return spawnSync("git", ["status", "--porcelain", "--", "data"], { cwd: w.cwd, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
}

/** An open session on `task` as an older strom left it: no hold; its worker or its run's mark; started `ago` ms back. */
function olderSession(w: World, task: string, o: { ago: number; worker?: string; runner?: string }): string {
  const tree = Tree.open(w.cwd, w.env);
  let id = "";
  tree.withTreeLock(() => {
    const t = tree.get<Task>(task)!;
    const at = new Date(Date.now() - o.ago).toISOString();
    id = tree.allocate("N");
    tree.actor = "agent";
    const s: Session = { id, type: "session", state: "open", started: at, notes: [], created: at, updated: at, task, ...(t.research ? { research: t.research } : {}), ...(o.runner ? { runner: o.runner } : {}), ...(o.worker ? { worker: o.worker } : {}), strom: "1.34.2" };
    tree.put(s, { op: "session.start", targets: [id, task], summary: `${id} session started on ${task}` });
    tree.put({ ...t, state: "doing", updated: at }, { op: "task.start", targets: [task, id], summary: `${task} start` });
  });
  tree.commit(`${id} started by an older strom`);
  return id;
}

/** A note written in an older strom's session (into its own operation log), its log's time `ago` ms back. */
function olderNote(w: World, id: string, text: string, ago: number): void {
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    const s = tree.get<Session>(id)!;
    tree.actor = id;
    tree.put({ ...s, notes: [...s.notes, makeNote(tree, text)], updated: new Date().toISOString() }, { op: "session.note", targets: [id], summary: `${id} note` });
  });
  tree.commit(`${id} note`);
  ageLogs(w, id, ago);
}

function ageLogs(w: World, id: string, ago: number): void {
  const logs = opsLogsOf(path.join(w.cwd, "data"), id);
  assert.ok(logs.length > 0, "the session's own operation log");
  const t = new Date(Date.now() - ago);
  for (const f of logs) fs.utimesSync(f, t, t);
}

function session(w: World, id: string): any {
  return readJsonFile(path.join(w.cwd, "data", "sessions", `${id}.json`));
}

test("an older strom's session whose worker lives is never taken over, however long ago it began; once its worker is gone, at once", { skip: !hasGit, timeout: 120_000 }, async () => {
  const w = new World();
  let leave: (() => void) | undefined;
  try {
    const [first, second] = (await fourTasks(w)) as [string, string];
    // a conversation of strom 1.34.2, at work for three hours (its worker: this process, alive)
    const worker = "claude-4711-lhotak";
    leave = enterWorker(w.cwd, worker, "Claude Code conversation", "1.34.2");
    const old = olderSession(w, first, { ago: 180 * MIN, worker });
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "holds", `${old}.json`)));
    const held = await w.run(["session", "start", first], { env: B });
    assert.equal(held.code, 2, held.out + held.err);
    assert.match(held.err, new RegExp(`${first} is being worked on in session ${old} \\(.*free when it ends\\)`, "u"));
    const b = await w.ok(["session", "start"], { env: B });
    assert.match(b.out, /strom 1\.34\.2 works beside this one, without holds of tasks: its sessions are not taken over while it runs/u);
    assert.match(b.out, new RegExp(`## Task ${second}`, "u"));
    assert.equal(session(w, old).state, "open");
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "taken", `${old}.json`)));
    // its process gone: taken over by the next who wants work, not waited for
    leave();
    leave = undefined;
    const took = (await w.ok(["session", "start", first, "--json"], { env: C })).json;
    assert.equal(took.session.task, first);
    assert.equal(session(w, old).state, "interrupted");
    assert.equal(readJsonFile(path.join(w.cwd, ".strom", "taken", `${old}.json`)).reason, "dead");
  } finally {
    leave?.();
    w.cleanup();
  }
});

test("a run of a strom before 1.25 (its run.lock) alive: its sessions are never taken over; once it ended, at once", { skip: !hasGit, timeout: 120_000 }, async () => {
  const w = new World();
  let release: (() => void) | undefined;
  try {
    const first = (await fourTasks(w))[0]!;
    release = acquireLock(path.join(w.cwd, ".strom", "run.lock"), { owner: "strom run", waitMs: 0 });
    const old = olderSession(w, first, { ago: 180 * MIN, runner: "claude" });
    const held = await w.run(["session", "start", first], { env: B });
    assert.equal(held.code, 2, held.out + held.err);
    assert.match(held.err, new RegExp(`is being worked on in session ${old}`, "u"));
    assert.equal(session(w, old).state, "open");
    release();
    release = undefined;
    const took = (await w.ok(["session", "start", first, "--json"], { env: C })).json;
    assert.equal(took.session.task, first);
    assert.equal(session(w, old).state, "interrupted");
  } finally {
    release?.();
    w.cleanup();
  }
});

test("an older strom's session with no worker and no hold lapses task.hold after the last write to its operation logs, else after its start", { skip: !hasGit, timeout: 120_000 }, async () => {
  const w = new World();
  try {
    const [first, second] = (await fourTasks(w)) as [string, string];
    // begun 45 minutes ago, its last note 10 minutes ago: it holds
    const written = olderSession(w, first, { ago: 45 * MIN });
    olderNote(w, written, "obrazy 1–5 v matrice Lhota", 10 * MIN);
    // begun 10 minutes ago, nothing written since: it holds
    const begun = olderSession(w, second, { ago: 10 * MIN });
    const fresh = await w.run(["session", "start", first], { env: B });
    assert.equal(fresh.code, 2, fresh.out + fresh.err);
    assert.match(fresh.err, /free by (?:\d{4}-\d\d-\d\d )?\d{1,2}:\d{2} at the latest/u);
    assert.equal((await w.run(["session", "start", second], { env: B })).code, 2);
    assert.deepEqual([session(w, written).state, session(w, begun).state], ["open", "open"]);
    // its last write 31 minutes ago: lapsed, taken over by the one asking for its task
    ageLogs(w, written, 31 * MIN);
    const took = (await w.ok(["session", "start", first, "--json"], { env: B })).json;
    assert.equal(took.session.task, first);
    assert.deepEqual(took.tookOver.map((t: { session: string; reason: string; minutes: number }) => [t.session, t.reason, t.minutes]), [[written, "expired", 31]]);
    assert.equal(session(w, written).state, "interrupted");
    assert.equal(session(w, begun).state, "open", "the one begun 10 minutes ago still holds");
    // begun 45 minutes ago, nothing written in it: lapsed by its start — never taken over by one refused its own ask
    // (a refused command writes nothing), taken over by the next who takes work, and committed with its session
    const third = await oneMore(w);
    const idle = olderSession(w, third, { ago: 45 * MIN });
    const refused = await w.run(["session", "start", second], { env: C });
    assert.equal(refused.code, 2, refused.out + refused.err);
    assert.equal(session(w, idle).state, "open");
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "taken", `${idle}.json`)));
    const next = (await w.ok(["session", "start", "--json"], { env: C })).json;
    assert.deepEqual(next.tookOver.map((t: { session: string; reason: string; minutes: number }) => [t.session, t.reason, t.minutes]), [[idle, "expired", 45]]);
    assert.ok(![first, second].includes(next.session.task), `the next free task, never one held: ${next.session.task}`);
    assert.equal(session(w, idle).state, "interrupted");
    assert.equal(session(w, begun).state, "open");
    assert.deepEqual(uncommitted(w), [], "the takeover committed");
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    w.cleanup();
  }
});
