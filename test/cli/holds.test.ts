// A task's hold (spec 127) with real processes: a run killed or stopped, agents working directly, another computer's
// hold, a clock gone wrong. The time a hold lasts is never set lower for a test: a hold is made older instead (its beat
// and its file's time moved back past task.hold, 30 minutes).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { World, hasGit, readJsonFile, until } from "../helpers.ts";

const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
const AGENT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
const MIN = 60_000;
/** Past task.hold (30 minutes unless set). */
const LAPSED = 31 * MIN;

/** Two agents working directly, each in a conversation of its own (no worker of strom's). */
const A = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "lhotak-a" };
const B = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "lhotak-b" };

interface Proc {
  child: ChildProcess;
  done: Promise<{ code: number; out: string; err: string }>;
}

function start(w: World, args: string[], env: Record<string, string> = {}): Proc {
  const child = spawn(process.execPath, [CLI, ...args], { cwd: w.cwd, env: { ...w.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  let err = "";
  child.stdout!.on("data", (d) => (out += d));
  child.stderr!.on("data", (d) => (err += d));
  const done = new Promise<{ code: number; out: string; err: string }>((resolve) => child.on("close", (code) => resolve({ code: code ?? 1, out, err })));
  return { child, done };
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Ends what a test that failed left running (a run, its agent; stopped ones go on first). */
function endAll(pids: (number | undefined)[]): void {
  for (const pid of pids) {
    if (!pid || !alive(pid)) continue;
    try {
      if (process.platform !== "win32") process.kill(pid, "SIGCONT");
      process.kill(pid, "SIGKILL");
    } catch {
      // gone meanwhile
    }
  }
}

/** A tree with one research and four tasks of its own, T0005 first in the queue, then T0006, T0007, T0008. */
async function fourTasks(w: World): Promise<string[]> {
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "ABT 1885", "--born-place", "Lhota"]);
  for (const t of (await w.ok(["task", "list", "--state", "all", "--json"])).json.tasks as { id: string }[]) await w.ok(["task", "drop", t.id, "--reason", "test"]);
  const ids: string[] = [];
  for (const [i, what] of ["Křest Jana", "Oddavky rodičů", "Křest otce", "Úmrtí děda"].entries()) {
    const r = await w.ok(["task", "add", what, "--level", "locate", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", String(5 - i), "--json"]);
    ids.push(r.json.task.id);
  }
  return ids;
}

/** A hold made older: its beat and its file's time moved back by `ms` (as if nothing gave a sign of life since). */
function age(root: string, session: string, ms: number, change: Record<string, unknown> = {}): void {
  const file = path.join(root, ".strom", "holds", `${session}.json`);
  const h = readJsonFile(file);
  const t = new Date(Date.now() - ms);
  fs.writeFileSync(file, JSON.stringify({ ...h, beat: t.toISOString(), ...change }, null, 2) + "\n");
  fs.utimesSync(file, t, t);
}

function session(w: World, id: string): any {
  return readJsonFile(path.join(w.cwd, "data", "sessions", `${id}.json`));
}

function task(w: World, id: string): any {
  return readJsonFile(path.join(w.cwd, "data", "tasks", `${id}.json`));
}

test("kill -9 of a run and its agent: the next run takes the task at once, the old session interrupted with a note of the takeover", { skip: !hasGit, timeout: 240_000 }, async () => {
  const w = new World();
  const pids: (number | undefined)[] = [];
  try {
    const first = (await fourTasks(w))[0]!;
    const dir = fs.mkdtempSync(path.join(w.dir, "agent-"));
    const run = start(w, ["run", "--agent", "script", "--max", "1", "--json"], { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "hold", AGENT_DIR: dir });
    pids.push(run.child.pid);
    await until("the run's agent at work on its task", () => fs.existsSync(path.join(dir, "agent.json")), { state: () => fs.readdirSync(dir) });
    const agent = readJsonFile(path.join(dir, "agent.json"));
    pids.push(agent.pid);
    assert.equal(agent.task, first);
    const hold = readJsonFile(path.join(w.cwd, ".strom", "holds", `${agent.session}.json`));
    assert.deepEqual([hold.by, hold.pid, hold.task, hold.host], ["run", run.child.pid, first, os.hostname()]);

    process.kill(run.child.pid!, "SIGKILL");
    process.kill(agent.pid, "SIGKILL");
    await run.done;
    await until("the agent gone", () => !alive(agent.pid));
    assert.equal(session(w, agent.session).state, "open", "nobody closed it: its run was killed");

    // the next run: the session of a process gone is taken over at once (its hold's time not waited for)
    const next = await start(w, ["run", "--agent", "script", "--max", "1", "--json"], { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "done" }).done;
    assert.equal(next.code, 0, next.err + next.out);
    const sessions = JSON.parse(next.out).sessions as { session: string; task: string }[];
    assert.deepEqual(sessions.map((s) => s.task), [first], "the task of the run killed, at once");
    const old = session(w, agent.session);
    assert.equal(old.state, "interrupted");
    // its run's words (the run stopped), the takeover in its handover and its task's note
    assert.match(old.summary, /běh se zastavil/u);
    // its process gone: taken at once, said so — never "po 0 minutách"
    assert.match(old.next, /^převzato, jeho proces skončil; rozdělaná práce v N\d{4}$/u);
    assert.ok(task(w, first).notes.some((n: { text: string }) => n.text.includes(`interrupted in ${agent.session}`) && /převzato/u.test(n.text)), JSON.stringify(task(w, first).notes));
    const taken = readJsonFile(path.join(w.cwd, ".strom", "taken", `${agent.session}.json`));
    assert.deepEqual([taken.reason, taken.task, taken.by], ["dead", first, sessions[0]!.session]);
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "holds", `${agent.session}.json`)), "the hold of the session taken over is gone");
    assert.equal(task(w, first).state, "done");
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    endAll(pids);
    w.cleanup();
  }
});

test("kill -9 of a run alone: its agent, living on, may read but writes nothing more once the session was taken over (session.taken)", { skip: !hasGit, timeout: 240_000 }, async () => {
  const w = new World();
  const pids: (number | undefined)[] = [];
  try {
    const first = (await fourTasks(w))[0]!;
    const dir = fs.mkdtempSync(path.join(w.dir, "agent-"));
    const run = start(w, ["run", "--agent", "script", "--max", "1", "--json"], { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "hold", AGENT_DIR: dir });
    pids.push(run.child.pid);
    await until("the run's agent at work on its task", () => fs.existsSync(path.join(dir, "agent.json")), { state: () => fs.readdirSync(dir) });
    const agent = readJsonFile(path.join(dir, "agent.json"));
    pids.push(agent.pid);
    process.kill(run.child.pid!, "SIGKILL");
    await run.done;

    const next = await start(w, ["run", "--agent", "script", "--max", "1", "--json"], { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "done" }).done;
    assert.equal(next.code, 0, next.err + next.out);
    const took = JSON.parse(next.out).sessions[0];
    assert.equal(took.task, first);
    assert.equal(readJsonFile(path.join(w.cwd, ".strom", "taken", `${agent.session}.json`)).by, took.session);

    // the agent of the run killed goes on: it reads, its writes are refused with exit 3 and what happened
    fs.writeFileSync(path.join(dir, "go"), "");
    await until("the agent tried its writes", () => fs.existsSync(path.join(dir, "after.json")));
    const after = readJsonFile(path.join(dir, "after.json"));
    assert.equal(after.read.code, 0, after.read.err);
    for (const write of [after.note, after.done]) {
      assert.equal(write.code, 3, write.err);
      assert.match(write.err, new RegExp(`task ${first} was taken over by session ${took.session} at \\d{1,2}:\\d{2} as its process had ended; your session ${agent.session} is closed as interrupted, what you wrote stays\\. Do not write to ${first}\\.`, "u"));
      assert.match(write.err, /strom task next/);
    }
    await until("the agent gone", () => !alive(agent.pid));
    assert.equal(session(w, agent.session).notes.length, 0, "its note was never written");
    assert.match(task(w, first).result, /^done by run-/u, "the task's result is the one of the session that took it over");
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    endAll(pids);
    w.cleanup();
  }
});

test("SIGSTOP of a run and its agent: taken over once its hold lapsed; woken, the agent's writes are refused (session.taken) and its run goes on with the next free task", { skip: !hasGit || process.platform === "win32", timeout: 240_000 }, async () => {
  const w = new World();
  const pids: (number | undefined)[] = [];
  try {
    const [first, second] = (await fourTasks(w)) as [string, string];
    const dir = fs.mkdtempSync(path.join(w.dir, "agent-"));
    const run = start(w, ["run", "--agent", "script", "--max", "2", "--json"], { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "hold", AGENT_DIR: dir });
    pids.push(run.child.pid);
    await until("the run's agent at work on its task", () => fs.existsSync(path.join(dir, "agent.json")), { state: () => fs.readdirSync(dir) });
    const agent = readJsonFile(path.join(dir, "agent.json"));
    pids.push(agent.pid);
    assert.equal(agent.task, first);

    // the computer asleep: both stopped, no sign of life; another run meanwhile finds the hold fresh — its task left
    // alone — until the hold is past task.hold
    process.kill(run.child.pid!, "SIGSTOP");
    process.kill(agent.pid, "SIGSTOP");
    const beside = await start(w, ["run", "--agent", "script", "--max", "1", "--json"], { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "done" }).done;
    assert.equal(beside.code, 0, beside.err + beside.out);
    assert.deepEqual(JSON.parse(beside.out).sessions.map((s: { task: string }) => s.task), [second], "a hold stopped but fresh holds");
    assert.equal(session(w, agent.session).state, "open");
    age(w.cwd, agent.session, LAPSED);
    const next = await start(w, ["run", "--agent", "script", "--max", "1", "--json"], { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "done" }).done;
    assert.equal(next.code, 0, next.err + next.out);
    const took = JSON.parse(next.out).sessions[0];
    assert.equal(took.task, first, "the task of the run stopped, its hold lapsed");
    assert.match(next.err, new RegExp(`sezení ${agent.session} převzato \\(bez známky života 3[01] minut\\); jeho úkol ${first} je zpět ve frontě`, "u"));
    const taken = readJsonFile(path.join(w.cwd, ".strom", "taken", `${agent.session}.json`));
    assert.deepEqual([taken.reason, taken.by, taken.worker], ["expired", took.session, readJsonFile(path.join(w.cwd, "data", "sessions", `${agent.session}.json`)).worker]);
    assert.equal(session(w, agent.session).state, "interrupted");

    // woken: the agent reads, its writes are refused; its run goes on with the next free task
    process.kill(agent.pid, "SIGCONT");
    process.kill(run.child.pid!, "SIGCONT");
    fs.writeFileSync(path.join(dir, "go"), "");
    const woken = await run.done;
    assert.equal(woken.code, 0, woken.err + woken.out);
    const after = readJsonFile(path.join(dir, "after.json"));
    assert.equal(after.read.code, 0, after.read.err);
    for (const write of [after.note, after.done]) {
      assert.equal(write.code, 3, write.err);
      assert.match(write.err, /was taken over by session N\d{4} at \d{1,2}:\d{2} after 3[01] min without a sign of life/u);
    }
    assert.match(woken.err, new RegExp(`sezení ${agent.session} převzalo sezení ${took.session}; dál další volný úkol`, "u"));
    const own = JSON.parse(woken.out).sessions as { session: string; task: string }[];
    assert.equal(own.length, 2, woken.out);
    assert.equal(own[0]!.session, agent.session);
    assert.ok(![first, second].includes(own[1]!.task), `the next free task, never one another took: ${own[1]!.task}`);
    // no task twice among the sessions that finished one
    const done = [second, first, own[1]!.task];
    assert.equal(new Set(done).size, 3);
    for (const t of done) assert.equal(task(w, t).state, "done", t);
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    endAll(pids);
    w.cleanup();
  }
});

test("two agents working directly, each in its own conversation: a session each, the task of the other's refused with who holds it and until when", { skip: !hasGit, timeout: 120_000 }, async () => {
  const w = new World();
  try {
    const [first, second] = (await fourTasks(w)) as [string, string];
    const a = (await w.ok(["session", "start", first, "--json"], { env: A })).json.session.id;
    const hold = readJsonFile(path.join(w.cwd, ".strom", "holds", `${a}.json`));
    assert.deepEqual([hold.by, hold.agentSession, hold.task, hold.pid], ["agent", "lhotak-a", first, undefined]);
    // the other agent: never the first one's session, its task refused (K1.5) with the next free one to take
    const held = await w.run(["session", "start", first], { env: B });
    assert.equal(held.code, 2, held.out + held.err);
    assert.match(held.err, new RegExp(`${first} is being worked on in session ${a} \\(Claude Code, since (?:\\d{4}-\\d\\d-\\d\\d )?\\d{1,2}:\\d{2}, last sign (?:\\d{4}-\\d\\d-\\d\\d )?\\d{1,2}:\\d{2}, free by (?:\\d{4}-\\d\\d-\\d\\d )?\\d{1,2}:\\d{2} at the latest\\)`, "u"));
    assert.match(held.err, new RegExp(`strom session start ${second} \\(the next free one\\)`, "u"));
    const b = (await w.ok(["session", "start", "--json"], { env: B })).json.session;
    assert.notEqual(b.id, a);
    assert.equal(b.task, second);
    // each writes into its own session
    await w.ok(["session", "note", "Lhota: matrika 1880–1890 prošlá"], { env: A });
    await w.ok(["session", "note", "Лгота: obraz 12"], { env: B });
    assert.deepEqual(session(w, a).notes.map((n: { text: string }) => n.text), ["Lhota: matrika 1880–1890 prošlá"]);
    assert.deepEqual(session(w, b.id).notes.map((n: { text: string }) => n.text), ["Лгота: obraz 12"]);
    assert.equal(session(w, a).state, "open");
    // a person (no agent) reads it in the research's language
    const person = await w.run(["task", "start", first]);
    assert.equal(person.code, 2);
    assert.match(person.err, new RegExp(`${first} drží Claude Code \\(sezení ${a}\\) od (?:\\d{4}-\\d\\d-\\d\\d )?\\d{1,2}:\\d{2}, naposledy (?:\\d{4}-\\d\\d-\\d\\d )?\\d{1,2}:\\d{2}; uvolní se nejpozději v (?:\\d{4}-\\d\\d-\\d\\d )?\\d{1,2}:\\d{2}`, "u"));
  } finally {
    w.cleanup();
  }
});

test("an agent working directly whose session was taken over: its task done refused (task.held), reads pass, its other writes refused (session.taken), a new session of its own works", { skip: !hasGit, timeout: 120_000 }, async () => {
  const w = new World();
  try {
    const [first, second] = (await fourTasks(w)) as [string, string];
    const a = (await w.ok(["session", "start", first, "--json"], { env: A })).json.session.id;
    // half an hour and more without a command of strom: the next one who wants work takes it over
    age(w.cwd, a, LAPSED);
    const took = await w.ok(["session", "start", "--json"], { env: B });
    assert.equal(took.json.session.task, first);
    assert.deepEqual(took.json.tookOver.map((t: { session: string; task: string; reason: string }) => [t.session, t.task, t.reason]), [[a, first, "expired"]]);
    const b = took.json.session.id;
    assert.equal(session(w, a).state, "interrupted");
    assert.equal(session(w, a).endedBy, "agent");

    const done = await w.run(["task", "done", first, "--result", "křest nalezen"], { env: A });
    assert.equal(done.code, 2, done.out + done.err);
    assert.match(done.err, new RegExp(`${first} is being worked on in session ${b} \\(Claude Code, since`, "u"));
    assert.equal(task(w, first).state, "doing");
    assert.equal((await w.run(["task", "list"], { env: A })).code, 0);
    assert.equal((await w.run(["task", "show", first], { env: A })).code, 0);
    for (const write of [["session", "note", "obrazy 1–5"], ["note", "add", "P1", "Lhoták z Lhoty"]]) {
      const r = await w.run(write, { env: A });
      assert.equal(r.code, 3, `${write.join(" ")}: ${r.out}${r.err}`);
      assert.match(r.err, new RegExp(`task ${first} was taken over by session ${b} at \\d{1,2}:\\d{2} after 3[01] min without a sign of life; your session ${a} is closed as interrupted`, "u"));
    }
    // taking work again: a session of its own, on the next free task, and its writes go through
    const again = (await w.ok(["session", "start", "--json"], { env: A })).json.session;
    assert.equal(again.task, second);
    await w.ok(["session", "note", "znovu: obrazy 6–9"], { env: A });
    assert.deepEqual(session(w, again.id).notes.map((n: { text: string }) => n.text), ["znovu: obrazy 6–9"]);
  } finally {
    w.cleanup();
  }
});

test("another computer's hold (a research on a shared disk): its pid never asked — it holds while its beat is fresh, lapses after task.hold", { skip: !hasGit, timeout: 120_000 }, async () => {
  const w = new World();
  try {
    const [first, second] = (await fourTasks(w)) as [string, string];
    const a = (await w.ok(["session", "start", first, "--json"], { env: A })).json.session.id;
    // a run on another computer: its process is no process of this one (a pid here that is gone)
    const elsewhere = { by: "run", pid: 2 ** 22 + 17, host: "jiný-počítač", machine: "cizí-stroj-1" };
    age(w.cwd, a, 5 * MIN, elsewhere);
    const fresh = await w.run(["session", "start", first], { env: B });
    assert.equal(fresh.code, 2, fresh.out + fresh.err);
    assert.match(fresh.err, /free by (?:\d{4}-\d\d-\d\d )?\d{1,2}:\d{2} at the latest/u);
    assert.equal((await w.ok(["session", "start", "--json"], { env: B })).json.session.task, second, "nothing taken over");
    assert.equal(session(w, a).state, "open");
    age(w.cwd, a, LAPSED, elsewhere);
    const C = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "lhotak-c" };
    const took = (await w.ok(["session", "start", first, "--json"], { env: C })).json;
    assert.equal(took.session.task, first);
    assert.equal(readJsonFile(path.join(w.cwd, ".strom", "taken", `${a}.json`)).reason, "expired");
  } finally {
    w.cleanup();
  }
});

test("a clock gone wrong only keeps a hold longer: a beat two hours behind with its file fresh, or two hours ahead, holds", { skip: !hasGit, timeout: 120_000 }, async () => {
  const w = new World();
  try {
    const first = (await fourTasks(w))[0]!;
    const a = (await w.ok(["session", "start", first, "--json"], { env: A })).json.session.id;
    const file = path.join(w.cwd, ".strom", "holds", `${a}.json`);
    const write = (beat: number, mtime: number) => {
      fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), beat: new Date(beat).toISOString() }, null, 2) + "\n");
      fs.utimesSync(file, new Date(mtime), new Date(mtime));
    };
    // written by a computer whose clock is two hours behind: the disk's time says it is fresh
    write(Date.now() - 120 * MIN, Date.now());
    assert.equal((await w.run(["session", "start", first], { env: B })).code, 2);
    // two hours ahead, its file's time too: taken as now
    write(Date.now() + 120 * MIN, Date.now() + 120 * MIN);
    assert.equal((await w.run(["session", "start", first], { env: B })).code, 2);
    assert.equal(session(w, a).state, "open");
    // both behind: lapsed
    write(Date.now() - 120 * MIN, Date.now() - 120 * MIN);
    assert.equal((await w.ok(["session", "start", first, "--json"], { env: B })).json.session.task, first);
    assert.equal(session(w, a).state, "interrupted");
  } finally {
    w.cleanup();
  }
});

test("a takeover a failed command took back leaves nothing behind: the session's holder works on and closes it, then writes as anyone", { skip: !hasGit, timeout: 120_000 }, async () => {
  const w = new World();
  try {
    const [first, second, third] = (await fourTasks(w)) as [string, string, string];
    const b = (await w.ok(["session", "start", second, "--json"], { env: B })).json.session.id;
    const a = (await w.ok(["session", "start", first, "--json"], { env: A })).json.session.id;
    age(w.cwd, a, LAPSED);
    // the other agent asks for a second session in the same research: refused after it took the lapsed one over — the
    // takeover goes with the refused command
    const busy = await w.run(["session", "start", third], { env: B });
    assert.equal(busy.code, 2, busy.out + busy.err);
    assert.match(busy.err, new RegExp(`session ${b} is still open`, "u"));
    assert.equal(session(w, a).state, "open");
    // its holder back: it writes, finishes its task, closes, and writes on outside any session
    await w.ok(["session", "note", "obrazy 1–5 v matrice Lhota"], { env: A });
    assert.ok(fs.existsSync(path.join(w.cwd, ".strom", "holds", `${a}.json`)), "its hold again with its next command");
    await w.ok(["task", "done", first, "--result", "křest nalezen"], { env: A });
    await w.ok(["session", "close", "--summary", "křest nalezen", "--next", "oddavky rodičů"], { env: A });
    assert.equal(session(w, a).state, "closed");
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "taken", `${a}.json`)), "no record of a takeover that did not happen");
    const note = await w.run(["note", "add", "P1", "Lhoták z Lhoty"], { env: A });
    assert.equal(note.code, 0, note.out + note.err);
  } finally {
    w.cleanup();
  }
});
