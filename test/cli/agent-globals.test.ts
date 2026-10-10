// The agents' own files of the person's home: an isolated installation never writes any of them — neither strom
// itself (strom agents install) nor an agent because strom started it so (Grok's --trust records the folder in
// ~/.grok/trusted_folders.toml, Codex records a folder it works in as trusted in ~/.codex/config.toml): Grok reads the
// tree's files with its folder trust off for that process, Codex gets the folder trusted for the run. A regular
// installation trusts the tree once, in its own folder; readers work in one folder outside the tree, all of them, and
// never with Grok's --trust.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, agentGlobals, plantAgentGlobals } from "../helpers.ts";

const unix = { skip: !hasGit || process.platform === "win32" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const AGENTS: [string, string][] = [
  ["claude", "claude"],
  ["codex", "codex"],
  ["antigravity", "agy"],
  ["opencode", "opencode"],
  ["grok", "grok"],
];

interface Call {
  args: string[];
  cwd: string;
  trust: string | null;
  /** Grok's switches for what it takes in of the other agents (Claude Code's skills, MCP servers) and its memory. */
  claudeSkills: string | null;
  claudeMcps: string | null;
  memory: string | null;
}

/** Fake agents on a PATH of their own: each notes how it was started (its arguments, folder, Grok's trust switch) and ends. */
function fakeAgents(w: World): void {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git) fs.symlinkSync(git, path.join(bin, "git"));
  const script = path.join(w.dir, "agent.mjs");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";\nconst [name, ...args] = process.argv.slice(2);\n` +
      `fs.appendFileSync(${JSON.stringify(w.dir)} + "/" + name + ".calls", JSON.stringify({ args, cwd: process.cwd(), trust: process.env.GROK_FOLDER_TRUST ?? null, claudeSkills: process.env.GROK_CLAUDE_SKILLS_ENABLED ?? null, claudeMcps: process.env.GROK_CLAUDE_MCPS_ENABLED ?? null, memory: process.env.GROK_MEMORY ?? null }) + "\\n");\n` +
      // as the real ones do: Grok records a folder --trust names, Codex one it runs in that its config does not trust
      `const home = process.env.HOME;\n` +
      `if (name === "grok" && args.includes("--trust")) fs.appendFileSync(home + "/.grok/trusted_folders.toml", "[folders." + JSON.stringify(process.cwd()) + "]\\ntrusted = true\\n");\n` +
      `if (name === "codex" && args[0] === "exec" && !args.some((a) => a.startsWith("projects="))) fs.appendFileSync(home + "/.codex/config.toml", "[projects." + JSON.stringify(process.cwd()) + "]\\ntrust_level = \\"trusted\\"\\n");\n` +
      `if (args[0] === "--version") console.log("9.9.9");\n` +
      `else console.log(JSON.stringify(name === "grok" ? { type: "end", sessionId: "s", stopReason: "end_turn", num_turns: 1, usage: {} } : { type: "turn.completed", usage: {} }));\n`,
  );
  for (const [, command] of AGENTS) fs.writeFileSync(path.join(bin, command), `#!/bin/sh\nexec "${process.execPath}" "${script}" ${command} "$@"\n`, { mode: 0o755 });
  w.env.PATH = `${bin}:/bin:/usr/bin`;
}

function calls(w: World, command: string): Call[] {
  const file = path.join(w.dir, `${command}.calls`);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Call) : [];
}

/** A tree with two scans of a book, cwd inside it. */
async function treeWithScans(w: World, root: string): Promise<void> {
  w.cwd = root;
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["recordset", "add", "Žďár N 1847–1868", "--kinds", "baptism", "--places", "Žďár", "--years", "1847-1868"]);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
}

test("an isolated strom writes none of the agents' files: setup, a run of each agent, a reader, a conversation — Grok without --trust, its folder trust off for the process; Codex's folder trusted for the run", unix, async () => {
  const w = new World();
  fakeAgents(w);
  Object.assign(w.env, { STROM_ISOLATED: "1", STROM_INSTALL_DIR: path.join(w.dir, "install") });
  const home = w.env.HOME!;
  plantAgentGlobals(home);
  const before = agentGlobals(home);
  assert.ok(before.size >= 11, "the agents' files are there");

  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  const root = path.join(w.env.STROM_CONFIG_DIR!, "Strom research", "Novákovi");
  assert.ok(fs.existsSync(path.join(root, "strom.json")), "the tree in the isolated installation's own folder");
  await treeWithScans(w, root);
  for (const [agent] of AGENTS) {
    await w.ok(["task", "add", `Křest (${agent})`, "--level", "locate", "--where", "farnost Sloup", "--why", "zkouška", "--done-when", "hotovo"]);
    await w.run(["run", "--agent", agent, "--json"]);
  }
  await w.run(["read", "B1", "--images", "1-2", "--batch", "1", "--question", "Křty Nováků", "--agent", "grok"]);
  const chat = await w.ok(["chat", "--agent", "grok", "--where", "terminal", "--print", "--json"]);
  const codexChat = await w.ok(["chat", "--agent", "codex", "--where", "terminal", "--print", "--json"]);

  assert.deepEqual(agentGlobals(home), before, "not one of the agents' files written or added");
  // Grok: no --trust anywhere; the tree's run and the conversation with the folder trust off, the readers without it
  const grok = calls(w, "grok").filter((c) => c.args[0] !== "--version");
  assert.ok(grok.length >= 3, `a run and two readers: ${grok.length}`);
  assert.ok(grok.every((c) => !c.args.includes("--trust")), "no persisting trust switch");
  const run = grok.find((c) => c.args.includes("--prompt-file"))!;
  assert.equal(run.cwd, fs.realpathSync(root));
  assert.equal(run.trust, "0", "the tree's own files read all the same, nothing recorded");
  // working alone without the add-ons (the default): nothing of the other agents', no memory; in a conversation too,
  // never the skill another installation taught Claude Code
  assert.ok(grok.every((c) => c.claudeSkills === "0" && c.claudeMcps === "0" && c.memory === "0"), JSON.stringify(grok));
  assert.ok(!chat.json.args.includes("--trust"));
  assert.deepEqual(chat.json.env, { GROK_FOLDER_TRUST: "0", GROK_CLAUDE_SKILLS_ENABLED: "0" });
  // Codex: the folder trusted for this run alone (as written and as the system resolves it)
  const codex = calls(w, "codex").find((c) => c.args[0] === "exec")!;
  const trusted = codex.args[codex.args.indexOf(codex.args.find((a) => a.startsWith("projects="))!)];
  assert.ok(trusted, `codex: ${codex.args.join(" ")}`);
  assert.ok(trusted.includes(JSON.stringify(fs.realpathSync(root))) && trusted.endsWith('={trust_level="trusted"}}'), trusted);
  assert.ok(codexChat.json.args.some((a: string) => a.startsWith("projects={") && a.includes(JSON.stringify(fs.realpathSync(root)))));
  w.cleanup();
});

test("a regular strom: Grok trusts the tree in the tree's folder; its readers, without --trust, all in one folder outside the tree", unix, async () => {
  const w = new World();
  fakeAgents(w);
  plantAgentGlobals(w.env.HOME!);
  await w.ok(["setup", "--yes"]);
  // (the regular installation teaches the agents: the list above is what it writes)
  assert.ok(fs.existsSync(path.join(w.env.HOME!, ".grok", "skills", "strom", "SKILL.md")));
  const root = await w.withTree();
  await treeWithScans(w, root);
  await w.ok(["task", "add", "Křest Jana", "--level", "locate", "--where", "farnost Sloup", "--why", "zkouška", "--done-when", "hotovo"]);
  await w.run(["run", "--agent", "grok", "--json"]);
  await w.run(["read", "B1", "--images", "1-2", "--batch", "1", "--question", "Křty Nováků", "--agent", "grok"]);
  await w.run(["read", "B1", "--images", "1-2", "--batch", "1", "--question", "Ткач", "--agent", "codex"]);
  const grok = calls(w, "grok").filter((c) => c.args[0] !== "--version");
  const [run, ...readers] = grok;
  assert.ok(run!.args[0] === "--trust" && run!.cwd === fs.realpathSync(root), "the tree trusted, in its own folder");
  assert.equal(readers.length, 2);
  assert.ok(readers.every((c) => !c.args.includes("--trust") && c.trust === null), "a reader needs no folder's files");
  // without the add-ons (the default): what Grok would take in of the other agents off, its memory off
  assert.ok(grok.every((c) => c.claudeSkills === "0" && c.claudeMcps === "0" && c.memory === "0"), JSON.stringify(grok));
  const chat = await w.ok(["chat", "--agent", "grok", "--where", "terminal", "--print", "--json"]);
  assert.deepEqual(chat.json.env ?? {}, {}, "a regular conversation keeps the person's add-ons");
  await w.ok(["config", "set", "agent.addons", "on"], { tty: true });
  await w.run(["read", "B1", "--images", "1-2", "--batch", "1", "--question", "Křty", "--agent", "grok"]);
  const withAddons = calls(w, "grok").filter((c) => c.args[0] !== "--version").at(-1)!;
  assert.deepEqual([withAddons.claudeSkills, withAddons.claudeMcps, withAddons.memory], [null, null, null], "agent.addons on: as in a conversation");
  const codexReaders = calls(w, "codex").filter((c) => c.args[0] === "exec");
  assert.equal(codexReaders.length, 2);
  assert.ok(codexReaders.every((c) => !c.args.some((a) => a.startsWith("projects="))), "a regular Codex as always");
  // what the agents recorded: the tree once (Grok), the readers' one folder (Codex) — never a folder per reader
  const recorded = (file: string) => new Set([...fs.readFileSync(path.join(w.env.HOME!, file), "utf8").matchAll(/^\[\w+\.("[^"]*")\]$/gm)].map((m) => JSON.parse(m[1]!) as string));
  assert.deepEqual([...recorded(path.join(".grok", "trusted_folders.toml"))], [fs.realpathSync(root)]);
  assert.equal(recorded(path.join(".codex", "config.toml")).size, 1);
  const desks = new Set([...readers, ...codexReaders].map((c) => c.cwd));
  assert.equal(desks.size, 1, `one folder for every reader: ${[...desks].join(", ")}`);
  const desk = [...desks][0]!;
  assert.ok(!desk.startsWith(fs.realpathSync(root) + path.sep), "outside the tree: no researcher's instructions");
  assert.deepEqual(fs.readdirSync(desk), [], "nothing of a reader's in it");
  w.cleanup();
});
