// The agent's plan limit counted for the computer (spec 126 U8): a run whose session the limit cut off marks it in the
// shared folder (<shared>/agents/limit-<agent>.json, until it resets); every other run of that agent here — of another
// research with the same shared folder too — begins no session before then: a run under a gate with --loop/--until
// waits (paused, the reason the limit), any other ends (limit). A session another run has at work goes on. Past its until
// the mark counts no more. Runs ask their gate one at a time, so that two never get "go" out of the same room.
// Real processes where runs work side by side; names with diacritics.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
const AGENT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

function strom(w: World, cwd: string, args: string[], env: Record<string, string> = {}): Promise<{ code: number; out: string; err: string; json?: any }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd, env: { ...w.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      let json: any;
      try {
        json = JSON.parse(out);
      } catch {
        json = undefined;
      }
      resolve({ code: code ?? 1, out, err, json });
    });
  });
}

async function until(what: () => boolean, ms = 60_000): Promise<void> {
  const end = Date.now() + ms;
  while (!what()) {
    if (Date.now() > end) throw new Error("waited in vain");
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Two researches with one shared folder, two tasks in each. */
async function twoTrees(): Promise<{ w: World; trees: string[]; dir: string; shared: string }> {
  const w = new World();
  const trees: string[] = [];
  await w.ok(["setup", "--yes"]);
  w.historyAsked();
  for (const [name, who] of [["Lhotákovi", "Jan /Lhoták/"], ["Lhotovi", "Мария /Лхотова/"]] as const) {
    await w.ok(["init", name]);
    w.cwd = w.treeDir(name);
    trees.push(w.cwd);
    await w.ok(["research", "new", `Předci ${name}`, "--new-person", who, "--sex", "M", "--born", "ABT 1885", "--born-place", "Lhota"]);
    for (const what of ["Křest", "Oddavky"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  }
  const dir = path.join(w.dir, "agent");
  fs.mkdirSync(dir, { recursive: true });
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: AGENT, AGENT_DIR: dir, STROM_TEST_LIMIT_RESERVE_MS: "0" });
  return { w, trees, dir, shared: path.join(w.home, "shared") };
}

/** A gate (user's setting, every research) that notes when it is asked and how long it answers, then lets go. */
function gate(w: World, shared: string, ms = 0): string {
  const g = path.join(shared, "plugins", "gates", "zkouska");
  fs.mkdirSync(g, { recursive: true });
  fs.writeFileSync(path.join(g, "gate.json"), JSON.stringify({ interface: 1, title: "Zkouška", command: ["node", "gate.ts"] }));
  fs.writeFileSync(
    path.join(g, "gate.ts"),
    `import fs from "node:fs";
const t0 = Date.now();
await new Promise((r) => setTimeout(r, ${ms}));
fs.appendFileSync("asked.txt", t0 + " " + Date.now() + "\\n");
process.exit(0);
`,
  );
  return g;
}

const took = (dir: string) => fs.readdirSync(dir).filter((f) => f.startsWith("took-"));

test("a limit one run meets holds every run of the agent on the computer, another research's too; a session at work goes on; the mark void after its time", opts, async () => {
  const { w, trees, dir, shared } = await twoTrees();
  const [lhotak, lhota] = trees as [string, string];
  // a run of the second research at work: its first session waits until the test lets it go
  const working = strom(w, lhota, ["run", "--agent", "script", "--max", "2", "--json"], { AGENT_MODE: "wait" });
  await until(() => took(dir).length === 1);
  // the first research's run meets the plan's limit: ends as before, the limit marked for the computer
  const met = await strom(w, lhotak, ["run", "--agent", "script", "--max", "3", "--json"], { AGENT_MODE: "limit-once", AGENT_LIMIT_IN: String(3600_000) });
  assert.equal(met.json?.stop, "limit", met.err);
  assert.equal(met.json.sessions.length, 1);
  const mark = readJsonFile(path.join(shared, "agents", "limit-script.json"));
  assert.ok(Math.abs(Date.parse(mark.until) - (Date.now() + 3600_000)) < 120_000, mark.until);
  assert.match(mark.by, /^run-/);
  assert.equal(mark.agent, "script");
  // the session at work is not interrupted; the run begins no second session — said who met the limit and when it resets
  fs.writeFileSync(path.join(dir, "go"), "");
  const r = await working;
  assert.equal(r.code, 0, r.err);
  assert.equal(r.json.sessions.length, 1, "no second session after the limit");
  assert.equal(r.json.sessions[0].outcome, "ok");
  assert.equal(r.json.stop, "limit");
  assert.match(r.json.stopped, /limit předplatného \(obnoví se .+\)/u);
  assert.match(r.err, new RegExp(`limit plánu agenta vyčerpal jiný běh na tomto počítači \\(${mark.by}\\): nové sezení nejdřív`, "u"));
  // a run started now: no session at all
  const later = await strom(w, lhota, ["run", "--agent", "script", "--json"], { AGENT_MODE: "echo" });
  assert.equal(later.json?.sessions.length, 0, later.err);
  assert.equal(later.json.stop, "limit");
  // the mark past its time: void — the run works again
  fs.writeFileSync(path.join(shared, "agents", "limit-script.json"), JSON.stringify({ ...mark, until: new Date(Date.now() - 1000).toISOString() }));
  const again = await strom(w, lhota, ["run", "--agent", "script", "--json"], { AGENT_MODE: "echo" });
  assert.equal(again.json?.sessions.length, 1, again.err);
  assert.equal(again.json.stop, "done");
  w.cleanup();
});

test("--loop under a gate: another run's limit is waited out (paused, its reason), then the gate and the session", opts, async () => {
  const { w, trees, shared } = await twoTrees();
  const g = gate(w, shared);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true, answers: ["y"] });
  // another run of this computer met the limit a moment ago: it resets in 3 s
  fs.mkdirSync(path.join(shared, "agents"), { recursive: true });
  const resets = Date.now() + 3000;
  fs.writeFileSync(path.join(shared, "agents", "limit-script.json"), JSON.stringify({ until: new Date(resets).toISOString(), since: new Date().toISOString(), by: "run-1-Lhoták", agent: "script" }));
  const child = strom(w, trees[1]!, ["run", "--agent", "script", "--loop", "--max", "1", "--json"], { AGENT_MODE: "echo" });
  // paused while it waits, the reason the limit (the Strom app hears it)
  const workers = path.join(trees[1]!, ".strom", "workers");
  const paused = () => (fs.existsSync(workers) ? fs.readdirSync(workers).filter((f) => f.endsWith(".paused")) : []);
  await until(() => paused().length === 1, 30_000);
  assert.equal(JSON.parse(fs.readFileSync(path.join(workers, paused()[0]!), "utf8")).reason, "limit plánu agenta se vyčerpal – práce pokračuje po jeho obnově");
  const r = await child;
  assert.equal(r.code, 0, r.err);
  assert.equal(r.json.sessions.length, 1);
  assert.equal(r.json.sessions[0].outcome, "ok");
  assert.match(r.err, /limit plánu agenta vyčerpal jiný běh na tomto počítači \(run-1-Lhoták\)/u);
  assert.match(r.err, /⏸ limit plánu agenta se vyčerpal – čekání do jeho obnovy/u);
  // the gate asked only after the limit reset, and the session began after it
  const asked = fs.readFileSync(path.join(g, "asked.txt"), "utf8").trim().split("\n").map((l) => Number(l.split(" ")[0]));
  assert.equal(asked.length, 1);
  assert.ok(asked[0]! >= resets - 50, `the gate asked ${resets - asked[0]!} ms before the reset`);
  const started = readJsonFile(path.join(trees[1]!, "data", "sessions", "N0001.json")).started;
  assert.ok(Date.parse(started) >= resets - 1000, started);
  assert.deepEqual(paused(), []);
  w.cleanup();
});

test("runs side by side ask their gate one at a time: never two answers at once", opts, async () => {
  const { w, trees, shared } = await twoTrees();
  const g = gate(w, shared, 1200);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true, answers: ["y"] });
  const runs = await Promise.all(trees.map((t) => strom(w, t, ["run", "--agent", "script", "--loop", "--max", "1", "--json"], { AGENT_MODE: "echo" })));
  for (const r of runs) {
    assert.equal(r.code, 0, r.err);
    assert.equal(r.json.sessions.length, 1);
  }
  const asked = fs
    .readFileSync(path.join(g, "asked.txt"), "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split(" ").map(Number) as [number, number])
    .sort((a, b) => a[0] - b[0]);
  assert.equal(asked.length, 2);
  assert.ok(asked[1]![0] >= asked[0]![1], `asked at once: ${JSON.stringify(asked)}`);
  // the turn let go
  assert.deepEqual(fs.readdirSync(path.join(shared, "agents")).filter((f) => f.endsWith(".lock")), []);
  w.cleanup();
});
