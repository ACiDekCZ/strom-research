// Several strom processes on one tree at once — agents in their conversations,
// a run on its own: nothing written may be lost or written over, the IDs stay
// unique, the history stays sealed, and no two agents get the same task.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");

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

test("many writers at once: every write kept, IDs unique, the history sealed", { skip: !hasGit, timeout: 180_000 }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  const n = 8;
  // Each writer adds a person and a note on the same shared person — the classic lost update.
  const runs = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      Promise.all([strom(w, ["person", "add", `Syn${i} /Novák/`, "--sex", "M"]), strom(w, ["note", "add", "P0001", `poznámka číslo ${i}`])]),
    ),
  );
  for (const r of runs.flat()) assert.equal(r.code, 0, r.err);
  const persons = (await w.ok(["person", "list", "--json", "--limit", "100"])).json;
  const list = persons.persons ?? persons.items ?? persons;
  assert.equal(list.length, n + 1, "every person there");
  assert.equal(new Set(list.map((p: any) => p.id)).size, n + 1, "IDs unique");
  const shown = (await w.ok(["person", "show", "P0001"])).out;
  for (let i = 0; i < n; i++) assert.match(shown, new RegExp(`poznámka číslo ${i}\\b`), `note ${i} kept`);
  assert.equal((await w.run(["check"])).code, 0);
  const v = await w.run(["verify"]);
  assert.equal(v.code, 0, v.out + v.err);
  w.cleanup();
});

test("two agents side by side: each its own session, never the same task", { skip: !hasGit, timeout: 120_000 }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["task", "add", "První úkol", "--where", "farnost Sloup", "--why", "zkouška", "--done-when", "hotovo", "--level", "locate"]);
  await w.ok(["task", "add", "Druhý úkol", "--where", "farnost Sloup", "--why", "zkouška", "--done-when", "hotovo", "--level", "locate"]);
  // Two conversations (their names come from strom chat); nobody holds them alive here, so mark them present.
  const { enterWorker } = await import("../../src/core/workers.ts");
  const leaveA = enterWorker(w.cwd, "claude-a", "Claude Code conversation");
  const leaveB = enterWorker(w.cwd, "codex-b", "OpenAI Codex CLI conversation");
  const a = await strom(w, ["session", "start", "--json"], { STROM_WORKER: "claude-a", CLAUDECODE: "1" });
  const b = await strom(w, ["session", "start", "--json"], { STROM_WORKER: "codex-b", CODEX_SANDBOX: "seatbelt" });
  assert.equal(a.code, 0, a.err);
  assert.equal(b.code, 0, b.err);
  const sa = JSON.parse(a.out).session;
  const sb = JSON.parse(b.out).session;
  assert.notEqual(sa.task, sb.task, "never the same task");
  assert.deepEqual([sa.agent, sb.agent], ["claude", "codex"]);
  // B cannot take A's task by name either.
  const steal = await strom(w, ["session", "start", sa.task], { STROM_WORKER: "codex-b" });
  assert.notEqual(steal.code, 0);
  // Each one's current session is its own: a note of B goes to B's session.
  assert.equal((await strom(w, ["session", "note", "B píše"], { STROM_WORKER: "codex-b" })).code, 0);
  const shownB = (await w.ok(["session", "show", sb.id])).out;
  assert.match(shownB, /B píše/);
  assert.doesNotMatch((await w.ok(["session", "show", sa.id])).out, /B píše/);
  // The orientation shows the others at work.
  const o = await strom(w, ["--json"], { STROM_WORKER: "claude-a", CLAUDECODE: "1" });
  const working = JSON.parse(o.out).working;
  assert.equal(working.length, 1);
  assert.equal(working[0].who, "OpenAI Codex CLI conversation");
  assert.equal(working[0].task, sb.task);
  // A closes its own; B's stays open.
  assert.equal((await strom(w, ["session", "close", "--continue", "--summary", "nic", "--next", "dál"], { STROM_WORKER: "claude-a" })).code, 0);
  assert.equal((await w.ok(["session", "show", sb.id, "--json"])).json.session?.state ?? "open", "open");
  leaveA();
  leaveB();
  assert.equal((await w.run(["check"])).code, 0);
  w.cleanup();
});

test("a command that locks only while it writes checks its commit under the lock: another strom committing meanwhile is never taken as an edit outside strom", { skip: !hasGit || process.platform === "win32" ? "a git of the test's own between the two (POSIX shell; Windows: the same code)" : false, timeout: 120_000 }, async () => {
  const w = new World();
  await w.withTree();
  const real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  const d = path.join(w.dir, "flags");
  fs.mkdirSync(d);
  const lock = path.join(w.cwd, ".strom", "tree.lock");
  const wait = (flag: string) => `n=0; while [ ! -e "${d}/${flag}" ] && [ $n -lt 300 ]; do sleep 0.1; n=$((n+1)); done`;
  // A (intake: it locks only while it writes): the status of its commit's check, once its input is written — taken
  // again once B has staged its commit, and given back only when B has committed. Under its own lock it waits for nobody.
  const gitA = path.join(w.dir, "git-a.sh");
  fs.writeFileSync(gitA, `#!/bin/sh
if [ "$1" = "status" ] && [ ! -e "${d}/a-done" ]; then
  "${real}" "$@" > "${d}/status"; c=$?
  if grep -q "data/inputs/" "${d}/status"; then
    touch "${d}/a-done"
    if ! grep -q '"pid":'"$PPID"'[,}]' "${lock}" 2>/dev/null; then
      touch "${d}/a-wrote"
      ${wait("b-added")}
      "${real}" "$@" > "${d}/status"; c=$?
      touch "${d}/a-status"
      ${wait("b-committed")}
    fi
  fi
  cat "${d}/status"; exit $c
fi
exec "${real}" "$@"
`, { mode: 0o755 });
  // B (a person added, the whole command under the lock): its commit staged, then held until A has looked
  const gitB = path.join(w.dir, "git-b.sh");
  fs.writeFileSync(gitB, `#!/bin/sh
if [ "$1" = "write-tree" ] && [ -e "${d}/a-wrote" ]; then touch "${d}/b-added"; ${wait("a-status")}; fi
if [ "$1" = "update-ref" ]; then "${real}" "$@"; c=$?; touch "${d}/b-committed"; exit $c; fi
exec "${real}" "$@"
`, { mode: 0o755 });
  const a = strom(w, ["intake", "--text", "Děda Karel byl mlynář"], { STROM_GIT: gitA });
  let aDone = false;
  void a.then(() => (aDone = true));
  for (let i = 0; i < 600 && !aDone && !fs.existsSync(path.join(d, "a-wrote")); i++) await new Promise((r) => setTimeout(r, 50));
  const b = await strom(w, ["person", "add", "Josef /Novák/", "--sex", "M"], { STROM_GIT: gitB });
  const ra = await a;
  assert.equal(b.code, 0, b.out + b.err);
  assert.equal(ra.code, 0, ra.out + ra.err);
  assert.doesNotMatch(ra.out + ra.err, /NOT committed|outside strom/);
  assert.equal(spawnSync("git", ["status", "--porcelain", "--", "data"], { cwd: w.cwd, encoding: "utf8" }).stdout, "", "all committed");
  const v = await w.run(["verify"]);
  assert.equal(v.code, 0, v.out + v.err);
  w.cleanup();
});
