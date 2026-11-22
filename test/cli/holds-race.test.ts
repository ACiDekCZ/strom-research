// Three who want work at once, a lapsed hold between them (spec 127): the session whose holder gave no sign of life is
// taken over by exactly one of them, each starts exactly one session, and no task is taken twice. Real processes.
//
// Runs of one agent and account ask their gate one at a time (spec 126 U8: the turn is held until the session the gate
// let go has begun), so a gate is a meeting point only for runs whose turns are their own — another agent or account.
// The first test gives each run its own turn (its own shared folder, where the turn's lock lives) and keeps the gate
// as the meeting point: all three choose while the hold holds, the hold lapses, and all three claim at the same moment.
// The second keeps one turn for all three: the hold lapses while the others wait for theirs, and it ends the same way.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit, readJsonFile, until } from "../helpers.ts";

const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
const AGENT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
const RUNS = 3;

function strom(w: World, args: string[], env: Record<string, string> = {}): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd: w.cwd, env: { ...w.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code: code ?? 1, out, err }));
  });
}

/** A tree with five tasks, the first held by an agent working directly: the tasks' ids and the held session. */
async function treeWithHold(w: World): Promise<{ ids: string[]; held: string }> {
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "ABT 1885", "--born-place", "Lhota"]);
  for (const t of (await w.ok(["task", "list", "--state", "all", "--json"])).json.tasks as { id: string }[]) await w.ok(["task", "drop", t.id, "--reason", "test"]);
  const ids: string[] = [];
  for (const [i, what] of ["Křest Jana", "Oddavky rodičů", "Křest otce", "Úmrtí děda", "Sčítání 1900"].entries())
    ids.push((await w.ok(["task", "add", what, "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", String(5 - i), "--json"])).json.task.id);
  // an agent working directly holds the first task, then gives no sign of life
  const held = (await w.ok(["session", "start", ids[0]!, "--json"], { env: { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "lhotak-a" } })).json.session.id as string;
  return { ids, held };
}

/** The gate "spolu" in a shared folder; its program (the same for every folder) meets the others in `meet`. */
function gateIn(shared: string, program: string): void {
  const dir = path.join(shared, "plugins", "gates", "spolu");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "gate.json"), JSON.stringify({ interface: 1, title: "Spolu", command: ["node", "gate.ts"], timeout: 180 }));
  fs.writeFileSync(path.join(dir, "gate.ts"), program);
}

/** The hold lapses now: its beat and its file past task.hold. */
function lapse(w: World, held: string): void {
  const file = path.join(w.cwd, ".strom", "holds", `${held}.json`);
  const then = new Date(Date.now() - 31 * 60_000);
  fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), beat: then.toISOString() }, null, 2) + "\n");
  fs.utimesSync(file, then, then);
}

/** What every run must have done: one session each, no task twice, the lapsed session taken over exactly once. */
async function tookWorkOnce(w: World, ended: { code: number; out: string; err: string }[], ids: string[], held: string): Promise<void> {
  for (const r of ended) assert.equal(r.code, 0, `a run ended: ${r.err}\n${r.out}`);
  const sessions = ended.flatMap((r) => JSON.parse(r.out).sessions as { session: string; task: string }[]);
  assert.equal(sessions.length, RUNS, "each run exactly one session");
  const tasks = sessions.map((s) => s.task);
  assert.equal(new Set(tasks).size, RUNS, `no task twice: ${tasks.join(" ")}`);
  assert.deepEqual([...tasks].sort(), ids.slice(0, RUNS), "the lapsed session's task taken again, beside the next free ones");
  // taken over exactly once: one run says so, the record names its session
  const said = ended.filter((r) => new RegExp(`sezení ${held} převzato`, "u").test(r.err));
  assert.equal(said.length, 1, ended.map((r) => r.err).join("\n----\n"));
  const taken = readJsonFile(path.join(w.cwd, ".strom", "taken", `${held}.json`));
  assert.equal(taken.reason, "expired");
  assert.ok(sessions.some((s) => s.session === taken.by), `the record names a session that took work: ${taken.by}`);
  const old = readJsonFile(path.join(w.cwd, "data", "sessions", `${held}.json`));
  assert.equal(old.state, "interrupted");
  const closes = fs
    .readdirSync(path.join(w.cwd, "data", "ops"), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
    .flatMap((e) => fs.readFileSync(path.join(e.parentPath, e.name), "utf8").split("\n").filter(Boolean))
    .map((l) => JSON.parse(l))
    .filter((o) => o.op === "session.close" && o.targets?.includes(held));
  assert.equal(closes.length, 1, "the lapsed session closed once");
  for (const t of ids.slice(0, RUNS)) assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", `${t}.json`)).state, "done", t);
  assert.equal((await w.run(["check"])).code, 0);
}

test("three runs take work at once while a hold lapses: one takes the lapsed session over, each its own task, none twice", { skip: !hasGit, timeout: 240_000 }, async () => {
  const w = new World();
  try {
    const { ids, held } = await treeWithHold(w);
    // the gate: each run waits there until every run got there and the test says go
    const meet = path.join(w.home, "spolu");
    fs.mkdirSync(path.join(meet, "here"), { recursive: true });
    const program = `import fs from "node:fs";
import path from "node:path";
const meet = ${JSON.stringify(meet)};
fs.mkdirSync(path.join(meet, "here", String(process.pid)));
fs.appendFileSync(path.join(meet, "asked.txt"), process.env.STROM_NEXT_TASK + "\\n");
const until = Date.now() + 120_000;
while ((fs.readdirSync(path.join(meet, "here")).length < ${RUNS} || !fs.existsSync(path.join(meet, "go"))) && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
process.exit(0);
`;
    // each run its own turn at the gate (as runs of other agents or accounts): its own shared folder, the same gate
    const shared = Array.from({ length: RUNS }, (_, k) => (k === 0 ? path.join(w.home, "shared") : path.join(w.home, `shared-${k + 1}`)));
    for (const s of shared) gateIn(s, program);
    await w.ok(["config", "set", "run.gate", "spolu"], { tty: true, answers: ["y"] });
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "done" });

    const done = Promise.all(shared.map((s) => strom(w, ["run", "--agent", "script", "--max", "1", "--json"], { STROM_SHARED: s })));
    await until("every run at its gate", () => fs.readdirSync(path.join(meet, "here")).length === RUNS);
    // all of them chose while the hold held: the task after the held one
    const asked = fs.readFileSync(path.join(meet, "asked.txt"), "utf8").trim().split("\n");
    assert.deepEqual(asked, Array(RUNS).fill(ids[1]), "all chose the task after the one held");
    // the hold lapses now, and the gate lets them all go together
    lapse(w, held);
    fs.writeFileSync(path.join(meet, "go"), "");

    const ended = await done;
    for (const s of shared) {
      const agents = path.join(s, "agents");
      assert.ok(fs.existsSync(agents), `the run of ${s} took its turn there`);
      assert.deepEqual(fs.readdirSync(agents).filter((f) => f.startsWith("gate-")), [], `the turn let go in ${s}`);
    }
    await tookWorkOnce(w, ended, ids, held);
  } finally {
    w.cleanup();
  }
});

test("three runs of one agent ask their gate one at a time while a hold lapses: still one takes it over, each its own task, none twice", { skip: !hasGit, timeout: 240_000 }, async () => {
  const w = new World();
  try {
    const { ids, held } = await treeWithHold(w);
    // the gate: the first run waits there until the test says go, the others go at once; never two in it at once
    const meet = path.join(w.home, "spolu");
    fs.mkdirSync(path.join(meet, "in"), { recursive: true });
    const program = `import fs from "node:fs";
import path from "node:path";
const meet = ${JSON.stringify(meet)};
const me = path.join(meet, "in", String(process.pid));
fs.mkdirSync(me);
if (fs.readdirSync(path.join(meet, "in")).length > 1) fs.appendFileSync(path.join(meet, "overlap.txt"), process.pid + "\\n");
fs.appendFileSync(path.join(meet, "asked.txt"), process.env.STROM_NEXT_TASK + "\\n");
let first = false;
try {
  fs.mkdirSync(path.join(meet, "first"));
  first = true;
} catch {}
const until = Date.now() + 120_000;
while (first && !fs.existsSync(path.join(meet, "go")) && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
fs.rmdirSync(me);
process.exit(0);
`;
    gateIn(path.join(w.home, "shared"), program);
    await w.ok(["config", "set", "run.gate", "spolu"], { tty: true, answers: ["y"] });
    Object.assign(w.env, { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "done" });

    const done = Promise.all(Array.from({ length: RUNS }, () => strom(w, ["run", "--agent", "script", "--max", "1", "--json"])));
    await until("the first run in its gate", () => fs.existsSync(path.join(meet, "first")));
    // the first chose while the hold held; the others wait for their turn meanwhile
    assert.deepEqual(fs.readFileSync(path.join(meet, "asked.txt"), "utf8").trim().split("\n"), [ids[1]], "only the first asks, the task after the one held");
    lapse(w, held);
    fs.writeFileSync(path.join(meet, "go"), "");

    const ended = await done;
    assert.ok(!fs.existsSync(path.join(meet, "overlap.txt")), "never two runs in the gate at once");
    assert.equal(fs.readFileSync(path.join(meet, "asked.txt"), "utf8").trim().split("\n").length, RUNS, "each run asked its gate once");
    await tookWorkOnce(w, ended, ids, held);
  } finally {
    w.cleanup();
  }
});
