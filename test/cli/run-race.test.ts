// Runs side by side on one tree (the menu's "start another beside it", a conversation beside a run): a run reads the
// queue outside the tree's lock and starts its session under it. When another took that task meanwhile, the run takes
// the next free one — never the end of the whole run — and no task is taken by two. Real processes; a gate that holds
// each run until all of them chose their task makes them choose the same one.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
const AGENT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

function strom(w: World, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd: w.cwd, env: w.env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code: code ?? 1, out, err }));
  });
}

test("runs started together never end on a task another took: each the next free one, no task twice", { skip: !hasGit, timeout: 240_000 }, async () => {
  const runs = 3;
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "ABT 1885", "--born-place", "Lhota"]);
  for (const what of ["Křest Jana", "Oddavky rodičů", "Křest otce", "Úmrtí děda", "Sčítání 1900", "Pozemková kniha"])
    await w.ok(["task", "add", what, "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  // the gate: each run waits there until every run got there — all of them chose their task before any session began
  const gate = path.join(w.home, "shared", "plugins", "gates", "spolu");
  fs.mkdirSync(path.join(gate, "here"), { recursive: true });
  fs.writeFileSync(path.join(gate, "gate.json"), JSON.stringify({ interface: 1, title: "Spolu", command: ["node", "gate.ts"] }));
  fs.writeFileSync(
    path.join(gate, "gate.ts"),
    `import fs from "node:fs";
fs.mkdirSync("here/" + process.pid);
fs.appendFileSync("asked.txt", process.env.STROM_NEXT_TASK + "\\n");
const until = Date.now() + 60_000;
while (fs.readdirSync("here").length < ${runs} && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
process.exit(0);
`,
  );
  await w.ok(["config", "set", "run.gate", "spolu"], { tty: true, answers: ["y"] });
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "done" });

  const done = await Promise.all(Array.from({ length: runs }, () => strom(w, ["run", "--agent", "script", "--max", "2", "--json"])));
  for (const r of done) assert.equal(r.code, 0, `a run ended: ${r.err}\n${r.out}`);
  // they chose the same task at the gate: the race this is about happened
  const asked = fs.readFileSync(path.join(gate, "asked.txt"), "utf8").trim().split("\n");
  assert.equal(asked.length, runs, "the gate asked once per run, not again after a task was taken");
  assert.equal(new Set(asked).size, 1, `all chose one task: ${asked.join(" ")}`);
  const taken = done.flatMap((r) => (JSON.parse(r.out).sessions as { task: string }[]).map((s) => s.task));
  assert.equal(taken.length, runs * 2, "every run had its sessions");
  assert.equal(new Set(taken).size, taken.length, `no task twice: ${taken.join(" ")}`);
  // a task another took is said, never an error
  assert.ok(done.some((r) => /left out: another agent is working on it|vynechán: pracuje na něm jiný agent/u.test(r.err)), done.map((r) => r.err).join("\n"));
  assert.equal((await w.run(["check"])).code, 0);
  const v = await w.run(["verify"]);
  assert.equal(v.code, 0, v.out + v.err);
  w.cleanup();
});
