// The journal of commands (spec 070 K1.2, K3.3): a command that ended with an error is noted, under an agent every
// command — its arguments and its message masked, never a name; a hook's quick answer never; it keeps itself small.
// It lies in strom's settings folder, never in a research; each line carries the research's key, never its name.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { COMMAND_LOG_BYTES, noteCommand, readCommands, treeKey } from "../../src/core/cmdlog.ts";
import { commandsArea } from "../../src/core/report.ts";
import { Masker } from "../../src/core/redact.ts";
import { stromVocabulary } from "../../src/cli/vocab.ts";

const opts = { skip: !hasGit };

test("a failed command is noted with its arguments masked; under an agent every command, its session", opts, async () => {
  const w = new World();
  const root = await w.withTree("Lhotákovi");
  const file = path.join(w.env.STROM_CONFIG_DIR!, "commands.jsonl");
  const before = readCommands(file).length;
  // a person's command that worked: not noted
  await w.ok(["person", "list"]);
  assert.equal(readCommands(file).length, before);
  // one that failed: noted, the name in it masked (NFD too)
  const r = await w.run(["person", "show", "Lhoták Vojtěch"]);
  assert.notEqual(r.code, 0);
  const failed = readCommands(file).at(-1)!;
  assert.equal(failed.cmd, "person show");
  assert.equal(failed.tree, treeKey(root));
  assert.notEqual(failed.exit, 0);
  const text = fs.readFileSync(file, "utf8");
  for (const name of ["Lhoták", "Lhoták", "Vojtěch", "Vojtěch", "lhotak"]) assert.ok(!text.normalize("NFC").toLowerCase().includes(name.normalize("NFC").toLowerCase()), `${name} in ${text}`);
  // under an agent every command, with its agent and session
  await w.ok(["person", "list", "--limit", "5"], { env: { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s-1" } });
  const last = readCommands(file).at(-1)!;
  assert.equal(last.cmd, "person list");
  assert.deepEqual(last.args, ["--limit", "5"]);
  assert.equal(last.exit, 0);
  assert.equal(last.agent, "claude");
  assert.equal(last.session, "s-1");
  // strom error itself is never noted
  const n = readCommands(file).length;
  await w.run(["error", "--yes"], { env: { CLAUDECODE: "1" } });
  assert.equal(readCommands(file).length, n);
  w.cleanup();
});

test("the journal is never in a research: the settings folder's, each line with the research's key; a --dry-run never noted", opts, async () => {
  const w = new World();
  const a = await w.withTree("Lhotákovi");
  const b = await w.withTree("Lhotovi");
  const file = path.join(w.env.STROM_CONFIG_DIR!, "commands.jsonl");
  await w.run(["person", "show", "P9998"], { cwd: a });
  await w.run(["person", "show", "P9999"], { cwd: b });
  await w.run(["person", "show", "P9997"], { cwd: w.dir });
  for (const root of [a, b]) assert.ok(!fs.existsSync(path.join(root, ".strom", "commands.jsonl")), root);
  const text = fs.readFileSync(file, "utf8");
  for (const word of ["Lhot", w.dir]) assert.ok(!text.includes(word), `${word} in ${text}`);
  // the key: stable, the same for another spelling of the folder; another research, another key
  assert.equal(treeKey(a), treeKey(a + path.sep));
  assert.notEqual(treeKey(a), treeKey(b));
  assert.match(treeKey(a), /^[0-9a-f]{16}$/);
  // a research's own; outside one every one
  const masker = new Masker({ key: Buffer.alloc(32, 1), vocabulary: stromVocabulary() });
  assert.deepEqual(commandsArea(w.env, a, 0, masker).commands.map((c) => c.args[0]), ["P9998"]);
  assert.deepEqual(commandsArea(w.env, b, 0, masker).commands.map((c) => c.args[0]), ["P9999"]);
  assert.deepEqual(commandsArea(w.env, undefined, 0, masker).commands.map((c) => c.args[0]), ["P9998", "P9999", "P9997"]);
  // the key of a research (a hash of its path) never in the report: R1, R2… only
  assert.ok(commandsArea(w.env, undefined, 0, masker).commands.every((c) => c.tree === undefined || /^R\p{N}+$/u.test(c.tree)));
  // a --dry-run writes nothing anywhere: not noted, even under an agent or when it fails
  const n = readCommands(file).length;
  await w.run(["person", "add", "Vojtěch /Lhoták/", "--sex", "M", "--dry-run"], { cwd: a, env: { CLAUDECODE: "1" } });
  await w.run(["person", "add", "--dry-run"], { cwd: a });
  assert.equal(readCommands(file).length, n);
  w.cleanup();
});

test("masking keeps strom's words, IDs, numbers and options; any name, path part or e-mail becomes a stable code", () => {
  const m = new Masker({ key: Buffer.alloc(32, 1), home: "/Users/lhotak", vocabulary: stromVocabulary(), terms: ["Лотаков"] });
  const args = m.args(["P0012", "--place", "Lhota", "--name=Jan Lhoták", "B0003:12-40", "--result", "inconclusive", "lhota", "https://archive.example.org/search?q=Lhota"]);
  assert.equal(args[0], "P0012");
  assert.equal(args[1], "--place");
  assert.match(args[2]!, /^‹[0-9a-f]{5}›$/);
  assert.match(args[3]!, /^--name=‹[0-9a-f]{5}›$/);
  assert.equal(args[4], "B0003:12-40");
  assert.equal(args[6], "inconclusive");
  // the same word in another case or form of its letters: the same code
  assert.equal(args[7], args[2]);
  assert.equal(m.args(["Lhota"])[0], args[2]);
  assert.equal(args[8], "https://archive.example.org/‹…›");
  const said = m.text(`person not found: "Jan Lhoták" in /Users/lhotak/Documents/Strom/Lhotákovi/data/P0012.json; mail lhotak@example.org; Лотаков; Lhotákovi; 2.3.1850 at 2026-11-09T02:36:00Z`);
  for (const bad of ["Lhoták", "lhotak", "Лотаков", "1850", "Lhoták"]) assert.ok(!said.includes(bad), `${bad} in ${said}`);
  assert.match(said, /^person not found: "‹[0-9a-f]{5}›" in ~\/Documents\/Strom\/‹[0-9a-f]{5}›\/data\/P0012\.json; mail ‹e›;/);
  assert.ok(said.includes("2026-11-09T02:36:00Z"));
  // the sweep finds a word of the research wherever it stands
  assert.ok(!m.sweep("Лотакова and others").includes("Лотаков"));
  // a section of strom's own documentation stays (strom doctor's fix: strom doc R12.5)
  assert.equal(m.text("Codex does not trust the folder → strom doc R12.5"), "Codex does not trust the folder → strom doc R12.5");
  // a code once made is never masked again by a word of the research its letters spell (a place "Bad Ischl")
  const bad = new Masker({ key: Buffer.alloc(32, 1), vocabulary: stromVocabulary(), terms: ["Bad Ischl"] });
  assert.equal(bad.sweep("from ‹bad12› at Bad"), `from ‹bad12› at ${bad.code("Bad")}`);
});

test("the journal keeps itself small: its newest half past its size", () => {
  const w = new World();
  const env = { ...w.env };
  for (let i = 0; i < 3000; i++) noteCommand(env, undefined, { at: new Date().toISOString(), cmd: "fetch", args: ["B0001", String(i)], exit: 1, error: "x".repeat(80) });
  const file = path.join(env.STROM_CONFIG_DIR!, "commands.jsonl");
  assert.ok(fs.statSync(file).size <= COMMAND_LOG_BYTES);
  const all = readCommands(file);
  assert.equal(all.at(-1)!.args[1], "2999");
  w.cleanup();
});
