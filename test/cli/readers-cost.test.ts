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
  assert.match((await w.ok(["session", "show"])).out, /metrics .*\$0\.80 \(agent \$0\.00 \+ 2 reader\(s\) \$0\.80\)/);
  assert.equal(git(w, ["status", "--porcelain", "--", "data"]), "", "committed");
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);

  const stats = (await w.ok(["stats", "--json"])).json.sessions;
  assert.deepEqual([stats.costUsd, stats.readersUsd], [0.8, 0.8]);
  assert.match((await w.ok(["stats"])).out, /0[.,]80.*0[.,]80/);
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

function git(w: World, args: string[]): string {
  return spawnSync("git", args, { cwd: w.cwd, encoding: "utf8" }).stdout;
}
