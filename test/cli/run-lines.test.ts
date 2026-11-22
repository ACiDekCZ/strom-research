// Runs of lines (spec 126, B): `strom run --research G…` holds its line while it lives — two lines' runs work at once,
// a second run of one line is refused in one sentence, a run of the whole queue beside them leaves their tasks alone,
// at most run.parallel runs at once (3), a run of a line never starts beside a run of a strom before 1.25 (.strom/run.lock)
// and warns of a run of a strom that knows no lines. A task of two lines (a common ancestor) goes to one run: its main
// line's. Real processes; the script agent waits in each session until the test lets it go.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
const AGENT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

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

async function until(what: () => boolean, ms = 60_000): Promise<void> {
  const end = Date.now() + ms;
  while (!what()) {
    if (Date.now() > end) throw new Error("waited in vain");
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Two lines of two people of no kin (G0001 Jan, G0002 Мария), a task of each and one about nobody. */
async function twoLines(): Promise<{ w: World; dir: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "ABT 1885", "--born-place", "Lhota"]);
  await w.ok(["research", "new", "Предки Марии", "--new-person", "Мария /Лхотакова/", "--sex", "F", "--born", "ABT 1890", "--born-place", "Лхота"]);
  await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P0001"]);
  await w.ok(["task", "add", "Крещение Марии", "--level", "locate", "--where", "Лхота", "--why", "родители", "--done-when", "запись", "--about", "P0002"]);
  const dir = path.join(w.home, "agent");
  fs.mkdirSync(dir, { recursive: true });
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: AGENT, AGENT_MODE: "wait", AGENT_DIR: dir });
  return { w, dir };
}

const took = (dir: string) => fs.readdirSync(dir).filter((f) => f.startsWith("took-"));

test("two lines' runs at once, a second run of a line refused, the whole queue beside them, at most run.parallel", { skip: !hasGit, timeout: 240_000 }, async () => {
  const { w, dir } = await twoLines();
  const a = strom(w, ["run", "--agent", "script", "--research", "G0001", "--max", "1", "--json"]);
  const b = strom(w, ["run", "--agent", "script", "--research", "G0002", "--max", "1", "--json"]);
  await until(() => took(dir).length === 2);
  // each line's run took its own line's task
  const byTask = Object.fromEntries(took(dir).map((f) => [f.slice(-5), f]));
  assert.ok(byTask.T0001 && byTask.T0002, took(dir).join(" "));
  // a second run of a line: one sentence, at once, nothing taken
  const again = await strom(w, ["run", "--agent", "script", "--research", "G0001", "--max", "1"]);
  assert.notEqual(again.code, 0);
  assert.match(again.err, /line G0001 has a run already: run-[^\s]+ \(since [^)]+\) — one run per line/u);
  // the whole queue beside them: the line runs hold every task it has, so it finds nothing of theirs
  await w.ok(["task", "add", "Kronika obce", "--level", "locate", "--where", "Lhota", "--why", "obec", "--done-when", "zápis"]);
  const g = strom(w, ["run", "--agent", "script", "--max", "1", "--json"]);
  await until(() => took(dir).length === 3);
  assert.ok(took(dir).some((f) => f.endsWith("-T0003")), `the whole queue took the task of no line: ${took(dir).join(" ")}`);
  // three runs at work (run.parallel 3): a fourth is refused, saying which work and how to stop them
  const fourth = await strom(w, ["run", "--agent", "script", "--max", "1"]);
  assert.notEqual(fourth.code, 0);
  assert.match(fourth.err, /3 runs work in this tree already \(run\.parallel 3\)/u);
  assert.match(fourth.err, /\(G0001\)/u);
  assert.match(fourth.err, /strom session finish/u);
  fs.writeFileSync(path.join(dir, "go"), "");
  for (const r of await Promise.all([a, b, g])) assert.equal(r.code, 0, r.err);
  // the lines are let go with their runs
  const { lineHolds } = await import("../../src/core/linerun.ts");
  assert.equal(lineHolds(w.cwd).size, 0);
  assert.equal((await w.run(["check"])).code, 0);
  const v = await w.run(["verify"]);
  assert.equal(v.code, 0, v.out + v.err);
  w.cleanup();
});

test("a run of a line never beside a run of a strom before 1.25; a run of a strom that knows no lines is said", { skip: !hasGit, timeout: 120_000 }, async () => {
  const { w } = await twoLines();
  Object.assign(w.env, { AGENT_MODE: "done" });
  // a run of strom 1.24 alive (this process): its lock knows no version and no lines
  const { acquireLock } = await import("../../src/core/lock.ts");
  const leaveOld = acquireLock(path.join(w.cwd, ".strom", "run.lock"), { owner: "strom run", waitMs: 0, machine: true });
  const refused = await strom(w, ["run", "--agent", "script", "--research", "G0001", "--max", "1"]);
  assert.notEqual(refused.code, 0);
  assert.match(refused.err, /a run of an older strom \(before 1\.25\) works in this tree since .+?: it knows no lines/u);
  assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "lines", "G0001.json")), false, "the line not taken");
  leaveOld();
  // a run of strom 1.35 (reservations of tasks, no lines): it says no agent of its own — the run of a line starts, warned
  const { enterWorker } = await import("../../src/core/workers.ts");
  const leave135 = enterWorker(w.cwd, "run-old", "Claude Code on its own", "1.35.0");
  const warned = await strom(w, ["run", "--agent", "script", "--research", "G0001", "--max", "1"]);
  assert.equal(warned.code, 0, warned.err);
  assert.match(warned.out + warned.err, /(a run of strom|běh stromu) 1\.35\.0(: it knows no lines| works beside this one: it knows no lines|: linie nezná)/u);
  leave135();
  w.cleanup();
});

test("a task of two lines goes to one run — its main line's; the whole queue leaves it to them", { skip: !hasGit, timeout: 120_000 }, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1885"]); // P0001
  await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M", "--born", "1888"]); // P0002
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1855"]); // P0003
  await w.ok(["person", "add", "Žofie /Lhotáková/", "--sex", "F", "--born", "1860"]); // P0004
  await w.ok(["family", "add", "--partner", "P0003", "--partner", "P0004", "--child", "P0001", "--child", "P0002"]);
  await w.ok(["research", "new", "Předci Jana", "--person", "P0001"]); // G0001
  await w.ok(["research", "new", "Předci Petra", "--person", "P0002"]); // G0002
  await w.ok(["task", "add", "Oddavky Václava", "--level", "locate", "--where", "Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P0003"]); // T0001
  const { Tree } = await import("../../src/core/tree.ts");
  const { linesOfTasks, lineRunFilter, lineFile } = await import("../../src/core/linerun.ts");
  const { acquireLock } = await import("../../src/core/lock.ts");
  const tree = Tree.open(w.cwd, w.env as any);
  const task = tree.get<any>("T0001");
  const { lines, main } = linesOfTasks(tree)(task);
  assert.deepEqual([...lines].sort(), ["G0001", "G0002"], "the common ancestor is in both lines");
  assert.ok(main === "G0001" || main === "G0002");
  const other = main === "G0001" ? "G0002" : "G0001";
  // nobody holds a line: each line's run may take it, as the whole queue
  assert.equal(lineRunFilter(tree, main, "run-a")(task), true);
  assert.equal(lineRunFilter(tree, other, "run-b")(task), true, "the main line has no run: a line it helps takes it");
  assert.equal(lineRunFilter(tree, undefined, "run-g")(task), true);
  // the main line held: the other line's run and the whole queue leave it
  fs.mkdirSync(path.dirname(lineFile(w.cwd, main!)), { recursive: true });
  const leave = acquireLock(lineFile(w.cwd, main!), { owner: "run-a", waitMs: 0, machine: true });
  assert.equal(lineRunFilter(tree, main, "run-a")(task), true, "its own run takes it");
  assert.equal(lineRunFilter(tree, other, "run-b")(task), false, "never a task whose main line another run holds");
  assert.equal(lineRunFilter(tree, undefined, "run-g")(task), false, "the whole queue leaves a line's task to its run");
  leave();
  // only the other line held: the main line has no run — its own run (none) or the whole queue leaves it, the other takes it
  const leaveOther = acquireLock(lineFile(w.cwd, other), { owner: "run-b", waitMs: 0, machine: true });
  assert.equal(lineRunFilter(tree, other, "run-b")(task), true);
  assert.equal(lineRunFilter(tree, undefined, "run-g")(task), false, "a task of a line with a run is that run's");
  leaveOther();
  w.cleanup();
});

test("the menu: the whole queue or one line — a line's run in a window of its own, named after its line", { skip: !hasGit, timeout: 180_000 }, async () => {
  const { w } = await twoLines();
  Object.assign(w.env, { AGENT_MODE: "done" });
  // no window here (STROM_NO_OPEN): the run goes on in this terminal, as a run of the line
  const menu = await w.ok([], { tty: true, env: { STROM_AGENT: "script", STROM_NO_OPEN: "1" }, answers: ["2", "2", "1", "1", "", "0"] });
  assert.match(menu.out, /Na čem pracovat\?/u, menu.out);
  assert.match(menu.out, /linie Předci Jana \(G0001\) – ve vlastním okně/u);
  assert.match(menu.out, /linie Предки Марии \(G0002\)/u);
  assert.match(menu.out, /Běh linie Předci Jana \(G0001\): jen její úkoly/u, menu.out);
  assert.match(menu.out, /T0001/u);
  assert.doesNotMatch(menu.out, /▶ N\d+ · T0002/u, "never the other line's task");
  // a window: the script carries the run of the line and the window's title
  const { openInNewTerminal } = await import("../../src/core/shortcut.ts");
  const env = { ...w.env, STROM_NO_OPEN: "" } as any;
  const opened = openInNewTerminal(["run", "--max", "1", "--research", "G0002"], w.cwd, env, "linux", { title: "Strom · Lhotákovi · Предки Марии (G0002) $`'", key: "G0002" });
  assert.equal(opened, false, "no terminal on a Linux without a display");
  const script = fs.readdirSync(path.join(w.cwd, ".strom", "open")).find((f) => f.startsWith("strom-G0002-"));
  assert.ok(script);
  const body = fs.readFileSync(path.join(w.cwd, ".strom", "open", script!), "utf8");
  assert.match(body, /printf '\\033\]0;%s\\007' 'Strom · Lhotákovi · Предки Марии \(G0002\) '/u, body);
  assert.match(body, /'run' '--max' '1' '--research' 'G0002'/u);
  // a moment later: another line's window opens, the same line's does not
  assert.equal(openInNewTerminal(["run", "--research", "G0002"], w.cwd, env, "linux", { key: "G0002" }), "recent");
  assert.equal(openInNewTerminal(["run", "--research", "G0001"], w.cwd, env, "linux", { key: "G0001" }), false);
  w.cleanup();
});
