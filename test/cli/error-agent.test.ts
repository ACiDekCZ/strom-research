// What an agent and a person learn of strom error (spec 070 K3.1, K3.2): the guide, AGENTS.md and a conversation's
// brief tell the agent to ask where the problem happened and never to send or copy the report; the help names the
// command for each kind of problem, an archive's help with nothing of an agent; the maintenance menu reports one.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

test("the guide, AGENTS.md and a conversation's brief: ask where, strom error --where, never send or copy the ZIP (K3.1)", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]);
  const guide = (await w.ok(["guide"])).out;
  assert.match(guide, /A PROBLEM WITH STROM/);
  assert.match(guide, /strom error --where\s+chat\|terminal\|app/);
  assert.match(guide, /Never send or open the ZIP, never copy its content into the chat/);
  assert.match(guide, /--with-data\s+--person P… \(--family F…, --book B…\) --yes-data/);
  const agents = fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8");
  assert.match(agents, /\*\*A problem with strom\*\*/);
  assert.match(agents, /`strom error --where\s+chat\|terminal\|app`/);
  assert.match(agents, /never send or open it, never copy its content\s+into the chat/);
  const brief = (await w.ok(["brief"])).out;
  assert.match(brief, /- a problem with strom reported: ask where it happened, strom error --where chat\|terminal\|app, tell the ZIP's path; never send, open or copy it/);
  w.cleanup();
});

test("strom error --help: the command for each kind of problem, neutral examples (K3.2)", opts, async () => {
  const w = new World();
  const help = (await w.ok(["error", "--help"])).out;
  assert.match(help, /What to run for which problem:/);
  for (const about of ["fetch", "sync", "agent", "install", "windows"]) assert.match(help, new RegExp(`strom error --about ${about}\\b`));
  assert.match(help, /--with-data/);
  assert.match(help, /--yes-data/);
  assert.doesNotMatch(help, /repeatable\)?[^\n]*repeatable/, "said once a line");
  // the person's help names it too
  assert.match((await w.ok(["help", "--human"])).out, /\berror\b/);
  w.cleanup();
});

test("an archive's help of strom error: the table and the options without an agent (K3.2)", opts, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  for (const args of [["help", "error"], ["error", "--help"]]) {
    const out = (await w.ok(args)).out;
    assert.match(out, /^strom error/m, out);
    assert.match(out, /What to run for which problem:/, out);
    assert.match(out, /strom error --about fetch/, out);
    assert.doesNotMatch(out, /agent|\bAI\b|Claude|\bsessions?\b|chat/i, out);
  }
  assert.match((await w.ok(["help"])).out, /\berror\b/, "listed in an archive's help");
  w.cleanup();
});
