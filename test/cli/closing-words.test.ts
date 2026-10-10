// How a session ends, as strom tells the agent. Working alone (strom run) every task starts in a fresh session by
// itself and nobody reads a closing message: no advice to clear the context (/clear) there — that is a conversation's.
// What the user reads of a session is its summary (the menu, the Strom app): strom asks for it in plain words of the
// research, never addressed to them.

import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { buildBrief } from "../../src/brief/brief.ts";
import type { Session, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

test("working alone the brief says to end after strom session close, without /clear; a conversation's brief does not; the summary is asked for impersonal in both", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1802"]);
  await w.ok(["task", "add", "Křest Kryštofa — Ждарский", "--level", "link", "--where", "katalog", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  await w.ok(["session", "start", "T1"]);
  const tree = Tree.open(w.cwd, w.env);
  const task = tree.get<Task>("T0001")!;
  const session = tree.list<Session>("session")[0]!;

  const run = buildBrief(tree, { task, session: { ...session, runner: "claude" }, deadline: Date.now() + 60 * 60_000 }).text;
  const talk = buildBrief(tree, { task, session }).text;
  const closing = (text: string) => text.slice(text.indexOf("## Finishing"));
  assert.match(closing(run), /working alone \(strom run\): after strom session close you are done — no closing message to the user and no advice to clear the context \(\/clear, a new conversation\)/);
  assert.doesNotMatch(closing(talk), /working alone|\/clear/);
  for (const text of [run, talk]) assert.match(closing(text), /the user reads the summary \(menu, Strom app\): plain words, never addressed to them/);

  // the tree's instructions: the /clear advice is a conversation's only
  const agents = fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8");
  assert.match(agents, /one task, one fresh context — in a conversation: after a session closes\s+there, strom says how the user clears your context \(Claude Code: \/clear\)/);
  assert.match(agents, /Working alone \(strom run\) each task starts fresh by\s+itself and nobody reads a closing message: no such advice there;/);
  // the guide: telling the user is a conversation's; working alone the summary is what they read
  const guide = (await w.ok(["guide"])).out;
  assert.match(guide, /then, in a conversation, tell the user what was found/);
  assert.match(guide, /working alone \(strom run\) the summary is what they\s+read \(plain words of the research, never addressed to them\)/);
  w.cleanup();
});
