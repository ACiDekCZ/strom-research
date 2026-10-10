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
  // the closing of a run: words of the research for the record, nothing to the user, no advice, nothing after it
  assert.match(closing(run), /- the summary: plain words of the research for the record \(menu, Strom app\), never addressed to the user, no advice \(\/clear, starting anything\); after strom session close you are done: no closing message/);
  assert.doesNotMatch(closing(talk), /working alone|\/clear|for the record/);
  assert.match(closing(talk), /- the user reads the summary \(menu, Strom app\): plain words, never addressed to them/);
  // nobody answers a question in a run: what only the user can decide waits for them as the task (the menu, the app)
  assert.match(closing(run), /- a decision or a step only the user can take: strom task wait T0001 --on "<the question, impersonal, in the research language>" — they see it in the menu and the Strom app; a question in the summary gets no answer/);
  assert.doesNotMatch(closing(talk), /a question in the summary/);
  // its head: nobody reads it live — the user is not talked to (a conversation's brief talks to them)
  const head = (text: string) => text.slice(0, text.indexOf("\n\n"));
  assert.match(head(run), /\nResearch language: Czech — write notes, tasks and summaries in Czech; transcripts stay in the original language\.\nWorking alone \(strom run\): nobody reads this session live — nothing in it is said to the user, its last words neither\.\n/);
  assert.match(head(talk), /Research language: Czech — talk to the user and write notes/);
  assert.doesNotMatch(head(talk), /Working alone/);

  // the tree's instructions: the /clear advice is a conversation's only
  const agents = fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8");
  assert.match(agents, /one task, one fresh context — in a conversation: after a session closes\s+there, strom says how the user clears your context \(Claude Code: \/clear\)/);
  assert.match(agents, /Working alone \(strom run\) each task starts fresh by\s+itself and nobody reads a closing message: no such advice there;/);
  // what the tree's instructions say of talking with the user is a conversation's, never a run's
  assert.match(agents, /The user watches this conversation[^]*?\(Working alone — a session of strom run — nobody watches: this\s+section is a conversation's; nothing there is said to the user, and its brief\s+says how it ends\.\)/);
  // the guide: telling the user is a conversation's; working alone the summary is what they read
  const guide = (await w.ok(["guide"])).out;
  assert.match(guide, /then, in a conversation, tell the user what was found/);
  assert.match(guide, /working alone \(strom run\) nobody reads the session\s+live and the summary is what they read \(plain words of the research for the record, never addressed\s+to them\) — nothing more after it, no advice to clear the context \(\/clear\) or to start anything,\s+nothing said to the user/);
  assert.match(guide, /nobody answers a\s+question there: what only the user can decide waits for\s+them \(strom task wait T… --on "<the question, impersonal>":\s+the menu's What waits for you, the Strom\s+app/);
  // what the agent wrote there is what the person reads under What waits for you, and their answer goes back to the task
  await w.ok(["task", "wait", "T1", "--on", "Povolit prohlížeč pro mapy.example.org? — Ждарский"]);
  assert.match((await w.ok(["status"])).out, /T0001 {2}Povolit prohlížeč pro mapy\.example\.org\? — Ждарский/);
  await w.ok(["task", "wake", "T1", "--answer", "Ano, povolit."]);
  const shown = (await w.ok(["task", "show", "T1"])).out;
  assert.match(shown, /Povolit prohlížeč pro mapy\.example\.org\? — Ждарский/);
  assert.match(shown, /Ano, povolit\./);
  w.cleanup();
});

// What a task waits for (task wait --on) the user reads in the menu's waiting list and the Strom app's overview, where
// strom's own texts are impersonal: a live run wrote "Otevřete … a najděte …" and advised /clear in its summary.
test("the question a task waits for is asked impersonal in the research language — the brief's commands, the method, the help and the guide; a run's summary says nothing of /clear", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1802"]);
  await w.ok(["task", "add", "Křest Kryštofa", "--level", "link", "--where", "katalog", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  await w.ok(["session", "start", "T1"]);
  const tree = Tree.open(w.cwd, w.env);
  const task = tree.get<Task>("T0001")!;
  const session = tree.list<Session>("session")[0]!;
  const run = buildBrief(tree, { task, session: { ...session, runner: "claude" }, deadline: Date.now() + 60 * 60_000 }).text;
  const talk = buildBrief(tree, { task, session }).text;
  const closing = (text: string) => text.slice(text.indexOf("## Finishing"));
  for (const text of [run, talk]) {
    // the commands of the task: the placeholder of --on says how to write it
    assert.match(text, /strom task wait <task> --on <for the user: impersonal, research language>/);
    // the method's part of images saved by hand
    assert.match(text, /Write `--on` for the\s+user, impersonal \(never "you"\), in the research language/);
  }
  assert.match(closing(run), /the summary: plain words of the research for the record \(menu, Strom app\), never addressed to the user, no advice \(\/clear, starting anything\)/);
  assert.doesNotMatch(closing(talk), /\/clear/);
  // the help an agent asks for, and the guide
  const help = (await w.ok(["help", "task", "wait"])).out;
  assert.match(help, /impersonal \(what\s+is needed, never addressed to them/);
  assert.match(help, /in the research language/);
  const guide = (await w.ok(["guide"])).out;
  assert.match(guide, /What a task waits for \(strom task wait T… --on "…"\) the user reads in strom's menu and the Strom app:\s+write it in the research language, impersonal — what is needed, never addressed to them/);
  assert.match(guide, /nothing more after it, no advice to\s+clear the context \(\/clear\)/);
  w.cleanup();
});
