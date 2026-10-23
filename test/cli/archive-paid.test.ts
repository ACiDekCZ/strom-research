// An archive pays for nothing (spec 017, M13): the commands that start readers — paid model work — are refused where
// nobody researches, as session start and document read were: one sentence in the research's language, the same exit
// code, nothing read, nothing written. A research waiting for its agent refuses them as long as the agent is not here.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

/** No agent on this computer: only Node, git and the system's own programs. */
function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

const commits = (root: string) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: root, encoding: "utf8" }).trim());

/** Every command that starts readers, as an agent would run it. */
const PAID: string[][] = [
  ["read", "B0001", "--images", "1-2", "--question", "Křest Nováka"],
  ["read", "M0001", "--question", "Křest Nováka"],
  ["clips"],
  ["clips", "--dry-run"],
  ["transcripts"],
  ["transcripts", "--dry-run"],
  ["document", "read", "I0001"],
  ["media", "calibrate"],
];

test("M13 an archive refuses every command that starts readers: one sentence, the exit code of the other refusals, nothing written", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  // the refusal every other command of an agent gets here
  const known = await w.run(["session", "start", "--json"]);
  assert.notEqual(known.code, 0);
  assert.equal(known.json?.code, "archive", JSON.stringify(known.json));
  const before = commits(w.cwd);
  for (const argv of PAID) {
    const r = await w.run([...argv, "--json"]);
    assert.equal(r.code, known.code, `${argv.join(" ")}: ${r.out}${r.err}`);
    assert.equal(r.json?.code, "archive", `${argv.join(" ")}: ${r.out}`);
    // a person reads it in the research's language, nothing of an agent or a cost
    const t = await w.run(argv);
    assert.equal(t.code, known.code);
    assert.match(t.out + t.err, /Tento výzkum je Archiv Stromu: data přicházejí z aplikace Strom a nic se nezkoumá\./, `${argv.join(" ")}: ${t.out}${t.err}`);
    assert.doesNotMatch(t.out + t.err, /agent|\bAI\b|Claude|\$|cena|platí/i, `${argv.join(" ")}: ${t.out}${t.err}`);
  }
  assert.equal(commits(w.cwd), before, "nothing written");
  w.cleanup();
});

test("M13 a research waiting for its agent refuses the readers while the agent is not here", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.withTree("Čekající");
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  const before = commits(w.cwd);
  for (const argv of PAID) {
    const r = await w.run([...argv, "--json"]);
    assert.notEqual(r.code, 0, argv.join(" "));
    assert.equal(r.json?.code, "agent.missing", `${argv.join(" ")}: ${r.out}`);
  }
  assert.equal(commits(w.cwd), before, "nothing written");
  w.cleanup();
});
