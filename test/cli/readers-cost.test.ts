// What the readers an agent starts cost (strom read, clips, transcripts) belongs to its session: added to it, kept
// apart as the readers' part — in session show, stats, recent, the month's spend the bridge gives, the run (P8).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Session } from "../../src/core/model.ts";
import { monthSpend, sessionCost, withReaders } from "../../src/core/session.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

/** A reader that reports nothing found and says what it cost, as an agent would. */
function reader(w: World): string {
  const file = path.join(w.dir, "reader.mjs");
  fs.writeFileSync(file, `const p = process.env.STROM_PROMPT ?? "";\nconst ids = [...p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)];\nfor (const m of ids) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\nconsole.log("cost: 0.40");\n`);
  return file;
}

test("readers' cost: added to the session that started them, apart from the agent's own, and counted everywhere", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["recordset", "add", "Žďár N 1847–1868", "--kinds", "baptism", "--places", "Žďár", "--years", "1847-1868"]);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  w.env.STROM_RUNNER_SCRIPT = reader(w);

  // the user's own reading, outside a session: nobody's session
  await w.ok(["read", "B1", "--images", "1-2", "--question", "Křty Nováků", "--agent", "script"]);
  assert.equal((await w.ok(["stats", "--json"])).json.sessions.readersUsd, undefined);

  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["session", "start", "T1"]);
  const read = await w.ok(["read", "B1", "--images", "1-2", "--question", "Křty Nováků", "--agent", "script"]);
  assert.match(read.out, /\$0\.40/);
  await w.ok(["read", "B1:1", "--question", "Ткач", "--agent", "script"]);
  const shown = (await w.ok(["session", "show", "--json"])).json.session;
  assert.deepEqual([shown.metrics.readersUsd, shown.metrics.readers], [0.8, 2]);
  // a conversation's agent never says what it cost: only the readers' part is known, never "agent $0.00"
  assert.match((await w.ok(["session", "show"])).out, /metrics .*\$0\.80\+ \(agent unknown \+ 2 reader\(s\) \$0\.80\)/);
  assert.equal((await w.ok(["session", "show", "--json"])).json.session.totalUsd, 0.8);
  assert.equal(git(w, ["status", "--porcelain", "--", "data"]), "", "committed");
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);

  const stats = (await w.ok(["stats", "--json"])).json.sessions;
  assert.deepEqual([stats.costUsd, stats.readersUsd], [0.8, 0.8]);
  assert.match((await w.ok(["stats"])).out, /0[.,]80.*0[.,]80/);
  // --json: the stored fields as they were (costUsd the agent's own), the session's whole cost beside them
  const listed = (await w.ok(["session", "list", "--json"])).json.sessions[0];
  assert.deepEqual([listed.metrics.costUsd, listed.metrics.readersUsd, listed.totalUsd], [undefined, 0.8, 0.8]);
  assert.match((await w.ok(["session", "list"])).out, /\$0\.80\+ \(agent unknown/);
  const recent = (await w.ok(["recent", "--json"])).json.sessions[0];
  assert.deepEqual([recent.costUsd, recent.readersUsd], [0.8, 0.8]);
  const tree = Tree.open(w.cwd, w.env);
  const month = tree.list<Session>("session")[0]!.started.slice(0, 7);
  assert.deepEqual(monthSpend(tree, month), { month, sessions: 1, amount: 0.8, readers: 0.8 });

  // the agent's own cost said at the end of a run never takes the readers' away
  const kept = withReaders({ costUsd: 2.2, turns: 40 }, { readersUsd: 22, readers: 28 });
  assert.deepEqual(kept, { costUsd: 2.2, turns: 40, readersUsd: 22, readers: 28 });
  assert.equal(sessionCost(kept), 24.2);
  assert.equal(sessionCost({ turns: 1 }), undefined);
  w.cleanup();
});

/** An agent working alone that starts readers (strom read, through the strom of its run) and says what it cost itself. */
function researcher(w: World): string {
  const file = path.join(w.dir, "researcher.mjs");
  fs.writeFileSync(
    file,
    `import { spawnSync } from "node:child_process";\nconst p = process.env.STROM_PROMPT ?? "";\nif (p.startsWith("You are the researcher")) {\n  const r = spawnSync("strom", ["read", "B1", "--images", "1-2", "--question", "Křty Nováků", "--agent", "script"], { encoding: "utf8", shell: process.platform === "win32" });\n  console.log(r.status === 0 ? "read" : "read failed: " + r.stderr);\n  console.log("cost: 1.50");\n} else {\n  for (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\n  console.log("cost: 0.40");\n}\n`,
  );
  return file;
}

test("a run's session: the agent's own and its readers' in one cost everywhere it is shown; the stored costUsd the agent's alone", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["recordset", "add", "Žďár N 1847–1868", "--kinds", "baptism", "--places", "Žďár", "--years", "1847-1868"]);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
  w.env.STROM_RUNNER_SCRIPT = researcher(w);
  const run = await w.ok(["run", "--agent", "script", "--json"]);
  const report = run.json.sessions[0];
  assert.deepEqual([report.costUsd, report.agentUsd, report.readersUsd], [1.9, 1.5, 0.4], run.out);
  const listed = (await w.ok(["session", "list", "--json"])).json.sessions[0];
  assert.deepEqual([listed.metrics.costUsd, listed.metrics.readersUsd, listed.totalUsd], [1.5, 0.4, 1.9], "stored as it was, the whole beside it");
  assert.match((await w.ok(["session", "list"])).out, /\$1\.90 \(agent \$1\.50 \+ 1 reader\(s\) \$0\.40\)/);
  assert.match((await w.ok(["session", "show"])).out, /\$1\.90 \(agent \$1\.50 \+ 1 reader\(s\) \$0\.40\)/);
  const stats = (await w.ok(["stats", "--json"])).json.sessions;
  assert.deepEqual([stats.costUsd, stats.readersUsd], [1.9, 0.4]);
  assert.equal((await w.ok(["recent", "--json"])).json.sessions[0].costUsd, 1.9);
  const tree = Tree.open(w.cwd, w.env);
  const month = tree.list<Session>("session")[0]!.started.slice(0, 7);
  assert.deepEqual(monthSpend(tree, month), { month, sessions: 1, amount: 1.9, readers: 0.4 });
  w.cleanup();
});

function git(w: World, args: string[]): string {
  return spawnSync("git", args, { cwd: w.cwd, encoding: "utf8" }).stdout;
}
