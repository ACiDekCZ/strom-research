// A subagent of its own kind for reading scans (strom-scan-reader): Claude Code gets it as a file of the tree
// (.claude/agents/, for a conversation) and on the command line of a run (--agents), OpenCode as an agent of mode
// subagent in the tree's opencode.json — the shell for strom and the file reader only, its model the user's
// model.vision or the starting agent's; refreshed with the agents' files, none in an archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { claudeArgs, RUN_TOOLS } from "../../src/runners/claude.ts";
import { scanReaderTools } from "../../src/agents/scanreader.ts";

const opts = { skip: !hasGit };
const unix = { skip: !hasGit || process.platform === "win32" };
const READER_MD = path.join(".claude", "agents", "strom-scan-reader.md");

test("Claude Code's run is given the scan reader (--agents), its --tools still let it start one; a conversation and a reader not", () => {
  const run = claudeArgs({ kickoff: "k", clean: true, settingsFile: "/t/.claude/settings.json", agentsFile: "/t/.strom/claude-agents.json" });
  assert.deepEqual(run.slice(run.indexOf("--agents"), run.indexOf("--agents") + 2), ["--agents", "/t/.strom/claude-agents.json"]);
  assert.ok(run[run.indexOf("--tools") + 1]!.split(",").includes("Agent"), "the subagent tool stays in a clean run");
  for (const t of ["Bash", "Read"]) assert.ok(RUN_TOOLS.includes(t as never), t);
  assert.deepEqual(scanReaderTools("darwin"), ["Bash", "Read"]);
  assert.deepEqual(scanReaderTools("win32"), ["Bash", "PowerShell", "Read"], "Windows: its PowerShell too, as a clean run has");
  assert.ok(!claudeArgs({ interactive: true, kickoff: "k", agentsFile: "/t/a.json" }).includes("--agents"), "a conversation reads the tree's file");
  assert.ok(!claudeArgs({ kickoff: "k", reader: true, clean: true, agentsFile: "/t/a.json" }).includes("--agents"), "a reader has no subagents");
});

test("the tree's scan reader: Bash and Read only, the user's model.vision else inherit, refreshed; OpenCode's the same rules; none in an archive", opts, async () => {
  const w = new World();
  await w.withTree("Novákovi");
  const md = () => fs.readFileSync(path.join(w.cwd, READER_MD), "utf8");
  let text = md();
  assert.match(text, new RegExp(`^---\nname: strom-scan-reader\ndescription: "Reads scans[^\n]*"\ntools: ${scanReaderTools().join(", ")}\nmodel: "inherit"\n---\n`));
  assert.match(text, /Open ALL the views a call lists in ONE message/);
  // a call within the cap: 6 images with halves and crops, not ten (every subagent lost a turn on it)
  assert.match(text, /24 views a call: 12 whole images, or 6 with 4 views each/);
  // views cleared from a reader's context to make room were opened again and again, nothing written down (a run's
  // readers re-read half their views and returned nothing): notes after each call, a view gone never reopened, ~30 views
  assert.match(text, /then read them and write down at once, image by image,\s+what they gave/);
  assert.match(text, /Never open a view again because it is gone — your\s+notes hold what it gave/);
  assert.match(text, /After about 30 views, stop and report what you have/);
  assert.doesNotMatch(text, /Every view stays\s+in your context|about 80 views/);
  assert.match(text, /your last message is all that comes back: it repeats every note/);
  // a run's readers fetched halves of every image themselves and one slept 36 min on an archive's hourly cap
  assert.match(text, /you never fetch them \(no `strom fetch`\) and never wait or sleep for an archive/);
  assert.match(text, /say which in your report — the agent who sent you fetches them/);
  assert.match(text, /\[\?\] for each uncertain letter/);
  assert.match(text, /never report an image you did not read as\s+searched/);
  assert.doesNotMatch(text, /Agent|WebSearch|SendMessage|ToolSearch/);
  // it is in git with the other agents' files
  assert.equal(spawnSync("git", ["ls-files", READER_MD.split(path.sep).join("/")], { cwd: w.cwd, encoding: "utf8" }).stdout.trim(), READER_MD.split(path.sep).join("/"));
  let oc = readJsonFile(path.join(w.cwd, "opencode.json")).agent["strom-scan-reader"];
  assert.equal(oc.mode, "subagent");
  assert.equal(oc.model, undefined, "the starting agent's model");
  assert.equal(oc.permission.bash["*"], "deny");
  assert.equal(oc.permission.bash["strom *"], "allow");
  assert.equal(oc.permission.bash["strom fetch *"], "deny", "it never fetches");
  assert.equal(Object.keys(oc.permission.bash).at(-1), "strom fetch *", "after strom *: the last matching rule counts");
  assert.equal(Object.keys(oc.permission.bash)[0], "*", "the general rule first: the last matching one counts");
  for (const k of ["edit", "webfetch", "websearch", "task", "question", "skill"]) assert.equal(oc.permission[k], "deny", k);
  assert.equal(oc.permission.read["data/*"], "deny", "the tree's rules hold");
  assert.doesNotMatch(JSON.stringify(oc.permission), /"ask"/, "nothing that would ask (a run nobody watches ends at a question)");

  // the user's model for handwriting, per tree: written when the agents' files are refreshed
  await w.ok(["config", "set", "model.vision", "opus-x", "--for-tree"]);
  await w.ok(["agents", "sync"]);
  text = md();
  assert.match(text, /\nmodel: "opus-x"\n/);
  assert.equal(readJsonFile(path.join(w.cwd, "opencode.json")).agent["strom-scan-reader"].model, undefined, "a model is the agent's own");
  await w.ok(["config", "unset", "model.vision", "--for-tree"]);
  await w.ok(["agents", "sync"]);
  assert.match(md(), /\nmodel: "inherit"\n/);
  // OpenCode's, set while it is the tree's agent
  await w.ok(["config", "set", "agent", "opencode", "--for-tree"]);
  await w.ok(["config", "set", "model.vision", "anthropic/vision-x", "--for-tree"]);
  await w.ok(["agents", "sync"]);
  oc = readJsonFile(path.join(w.cwd, "opencode.json")).agent["strom-scan-reader"];
  assert.equal(oc.model, "anthropic/vision-x");
  assert.match(md(), /\nmodel: "inherit"\n/);

  // CLAUDE.md names it; AGENTS.md tells OpenCode
  assert.match(fs.readFileSync(path.join(w.cwd, "CLAUDE.md"), "utf8"), /subagent type `strom-scan-reader`/);
  assert.match(fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8"), /OpenCode: this tree's subagent strom-scan-reader/);

  // an archive: none (strom's own files of the agents go)
  await w.ok(["mode", "archive"], { tty: true });
  assert.ok(!fs.existsSync(path.join(w.cwd, ".claude")), "the folder goes with it");
  await w.ok(["mode", "research"], { tty: true });
  assert.ok(fs.existsSync(path.join(w.cwd, READER_MD)));
  w.cleanup();
});

test("strom run gives Claude Code the scan reader of the tree on its command line", unix, async () => {
  const w = new World();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git) fs.symlinkSync(git, path.join(bin, "git"));
  const calls = path.join(w.dir, "claude.calls");
  fs.writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/sh
{ printf 'ARGS'; for a in "$@"; do printf ' [%s]' "$a"; done; printf '\\n'; } >> "${calls}"
cat > /dev/null
echo '{"type":"system","subtype":"init","model":"m","tools":["Task","Bash","Read","Edit","Write","WebFetch","WebSearch","ToolSearch","SendMessage"]}'
echo '{"type":"result","result":"done","total_cost_usd":0,"num_turns":1}'
`,
    { mode: 0o755 },
  );
  w.env.PATH = `${bin}${path.delimiter}${path.dirname(process.execPath)}`;
  await w.withTree();
  await w.ok(["config", "set", "model.vision", "opus-x"]);
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/"]);
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  const run = await w.run(["run", "--agent", "claude"]);
  const args = fs.readFileSync(calls, "utf8");
  const file = path.join(fs.realpathSync(w.cwd), ".strom", "claude-agents.json");
  assert.ok(args.includes(`[--agents] [${file}]`) || args.includes(`[--agents] [${path.join(w.cwd, ".strom", "claude-agents.json")}]`), args + run.out + run.err);
  const def = readJsonFile(path.join(w.cwd, ".strom", "claude-agents.json"))["strom-scan-reader"];
  assert.deepEqual(def.tools, scanReaderTools());
  assert.equal(def.model, "opus-x");
  assert.match(def.prompt, /Open ALL the views a call lists in ONE message/);
  w.cleanup();
});
