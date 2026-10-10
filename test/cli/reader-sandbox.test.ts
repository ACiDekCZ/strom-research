// A reader is an agent of its own: inside Codex's sandbox none can start (found live with codex-cli 0.155: "failed to
// initialize in-process app-server client: Operation not permitted"). strom read says so at once and what the agent
// does instead; the brief of a session in that sandbox does not send the agent to strom read; the readers go with the
// agent the session was started with.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { startSession } from "../../src/core/session.ts";
import { refusedBySandbox, sandboxOf, sandboxOfRun } from "../../src/core/sandbox.ts";
import { buildBrief } from "../../src/brief/brief.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

/** A reader that counts its starts in a file, and reports nothing found — or fails as Codex's nested exec does. */
function reader(w: World, refused: boolean): { file: string; starts: string } {
  const file = path.join(w.dir, `reader-${refused ? "refused" : "ok"}.mjs`);
  const starts = path.join(w.dir, `starts-${refused ? "refused" : "ok"}.txt`);
  fs.writeFileSync(
    file,
    `import fs from "node:fs";\nfs.appendFileSync(${JSON.stringify(starts)}, "x");\n` +
      (refused
        ? `console.error("Error: failed to initialize in-process app-server client: Operation not permitted (os error 1)");\nprocess.exit(1);\n`
        : `const p = process.env.STROM_PROMPT ?? "";\nfor (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\n`),
  );
  return { file, starts };
}

async function treeWithScans(w: World): Promise<void> {
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["recordset", "add", "Žďár N 1847–1868", "--kinds", "baptism", "--places", "Žďár", "--years", "1847-1868"]);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
}

test("sandbox: Codex's marks, a run's agent and level, a refused reader's words", () => {
  assert.equal(sandboxOf({ CODEX_SANDBOX: "seatbelt" })?.agent, "codex");
  assert.equal(sandboxOf({ CODEX_SANDBOX_NETWORK_DISABLED: "1" })?.agent, "codex");
  assert.equal(sandboxOf({ CODEX_THREAD_ID: "x", CODEX_HOME: "/h" }), undefined, "inside Codex without its sandbox (the level full): readers start");
  assert.equal(sandboxOfRun("codex", "auto")?.agent, "codex");
  assert.equal(sandboxOfRun("codex", "ask")?.agent, "codex");
  assert.equal(sandboxOfRun("codex", "full"), undefined);
  assert.equal(sandboxOfRun("claude", "auto"), undefined);
  assert.ok(refusedBySandbox("Error: failed to initialize in-process app-server client: Operation not permitted"));
  assert.ok(!refusedBySandbox("the model is not supported"));
});

test("strom read inside Codex's sandbox: said at once with what to do instead, no reader started", opts, async () => {
  const w = new World();
  await treeWithScans(w);
  const r = reader(w, false);
  w.env.STROM_RUNNER_SCRIPT = r.file;
  const env = { CODEX_SANDBOX: "seatbelt" };
  const said = await w.run(["read", "B1", "--images", "1-2", "--question", "Křty Nováků", "--agent", "script"], { env });
  assert.equal(said.code, 1);
  assert.match(said.err, /no reader can start here: Codex's sandbox lets no other agent start/);
  assert.match(said.err, /strom media view B…:<n> --half both/);
  assert.match(said.err, /--level verify/);
  assert.ok(!fs.existsSync(r.starts), "no reader started");
  const json = await w.run(["read", "B1:1", "--question", "Ткач", "--agent", "script", "--json"], { env });
  assert.equal(json.json.code, "reader.sandboxed");
  // outside the sandbox the same reading goes on
  await w.ok(["read", "B1", "--images", "1-2", "--question", "Křty Nováků", "--agent", "script"]);
  assert.equal(fs.readFileSync(r.starts, "utf8"), "x");
  w.cleanup();
});

test("strom read: a reader refused by a sandbox that does not say so — no more started, the same plain words", opts, async () => {
  const w = new World();
  await treeWithScans(w);
  const r = reader(w, true);
  w.env.STROM_RUNNER_SCRIPT = r.file;
  const said = await w.run(["read", "B1", "--images", "1-2", "--question", "Křty Nováků", "--agent", "script", "--batch", "1", "--parallel", "1"]);
  assert.equal(said.code, 1);
  assert.match(said.err, /no reader can start here: the sandbox this agent works in/);
  assert.equal(fs.readFileSync(r.starts, "utf8"), "x", "the second reader not started");
  const readings = path.join(w.cwd, "notes", "readings");
  assert.deepEqual(fs.existsSync(readings) ? fs.readdirSync(readings) : [], [], "no empty reports left");
  w.cleanup();
});

test("the brief of a session in Codex's sandbox: no readers, strom read not among its commands", opts, async () => {
  const w = new World();
  await treeWithScans(w);
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
  const inside = (await w.ok(["brief", "T1"], { env: { CODEX_SANDBOX: "seatbelt" } })).out;
  assert.match(inside, /## No readers in this session \(Codex's sandbox/);
  assert.doesNotMatch(inside, /^ {2}strom read /m);
  const outside = (await w.ok(["brief", "T1"])).out;
  assert.doesNotMatch(outside, /No readers in this session/);
  assert.match(outside, /^ {2}strom read /m);
  // strom run writes the brief before the agent starts, outside the sandbox: it knows it from the agent and the level
  const tree = Tree.open(w.cwd, w.env);
  const task = tree.get<Task>("T1")!;
  assert.match(buildBrief(tree, { task, sandbox: sandboxOfRun("codex", "auto") }).text, /No readers in this session/);
  assert.doesNotMatch(buildBrief(tree, { task, sandbox: sandboxOfRun("codex", "full") }).text, /No readers in this session/);
  w.cleanup();
});

test("the readers go with the agent the session was started with, not the tree's", opts, async () => {
  const w = new World();
  await treeWithScans(w);
  const r = reader(w, false);
  w.env.STROM_RUNNER_SCRIPT = r.file;
  await w.ok(["config", "set", "agent", "claude", "--for-tree"]);
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
  const tree = Tree.open(w.cwd, w.env);
  const s = tree.withTreeLock(() => {
    const s = startSession(tree, { task: tree.get<Task>("T1")!, runner: "script" });
    tree.commit("session", ["data"]);
    return s;
  });
  // no --agent: the tree says claude (not installed here), the session's agent reads
  const read = await w.run(["read", "B1:1", "--question", "Křty Nováků"], { env: { STROM_SESSION: s.id } });
  assert.equal(read.code, 0, read.err);
  assert.equal(fs.readFileSync(r.starts, "utf8"), "x");
  w.cleanup();
});
