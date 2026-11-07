// A link of the Strom app to a task in the queue (strom-research://task without do, a task open — the one a reading of
// a source again left, say): the task said (what, why, when done), then the person's choice — go through it with the
// agent now (said and asked first with what it takes), put it ahead in the queue (priority 5), or leave it (Enter, 0:
// nothing written). A task that waits: as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

test("a link to a task in the queue: shown with its why, then left (Enter, 0), put ahead (priority 5), or gone through with the agent now (asked first, its price not known yet)", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  const id = Tree.open(w.cwd, w.env).config.id;
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1822"]);
  await w.ok(["task", "add", "Porovnat nové čtení křtu s přepisem", "--level", "verify", "--where", "matrika Lhota", "--why", "přepis: Ludmilae; nové čtení: Annae".normalize("NFD"), "--done-when", "rozdíly rozhodnuté", "--about", "P1", "--priority", "2"]); // T1
  const open = (answers: string[]) => w.run(["link", "open", `strom-research://task?tree=${id}&task=T0001`], { tty: true, answers });
  const head = () => fs.readFileSync(path.join(w.cwd, ".git", "HEAD"), "utf8") + JSON.stringify(Tree.open(w.cwd, w.env).list<Task>("task").map((t) => [t.id, t.state, t.priority]));
  const before = head();

  // shown, Enter: left in the queue, nothing written — never "no longer waits"
  const left = await open(["", ""]);
  assert.match(left.out, /Porovnat nové čtení křtu s přepisem/u);
  assert.match(left.out, /Úkol T0001 je ve frontě/u);
  assert.match(left.out, /Proč: přepis: Ludmilae; nové čtení: Annae/u);
  assert.match(left.out, /Hotovo, když: rozdíly rozhodnuté/u);
  assert.match(left.out, / 1  Projít ho s agentem \(Claude Code\) teď, v rozhovoru/u);
  assert.match(left.out, / 2  Dát ho ve frontě dopředu \(nejvyšší priorita\)/u);
  assert.match(left.out, / 3  Nechat ho ve frontě, jak je/u);
  assert.match(left.out, /Úkol zůstává ve frontě, jak byl\. Nic se nestalo\./u);
  assert.doesNotMatch(left.out, /už nečeká/u);
  assert.equal(head(), before, "nothing written");
  // 0: back, nothing written
  assert.match((await open(["0", ""])).out, /Nic se nestalo/u);
  assert.equal(head(), before);

  // with the agent now: said and asked first (its price not known yet: too few sessions measured); a no starts nothing
  const no = await open(["1", "n", ""]);
  assert.match(no.out, /Aplikace Strom žádá: rozhovor s agentem \(Claude Code\) o úkolu, teď: Porovnat nové čtení křtu s přepisem/u);
  assert.match(no.out, /Kolik to stojí, zatím není známo/u);
  assert.match(no.out, /předplatné nebo kredit AI/u);
  assert.equal(head(), before, "a no writes nothing");
  // a yes: the conversation in the agent's desktop app, its first message takes the task up
  const apps = path.join(w.dir, "apps");
  fs.mkdirSync(path.join(apps, "Claude.app"), { recursive: true });
  w.env.STROM_APP_DIRS = apps;
  const yes = await open(["1", "a", ""]);
  assert.match(yes.out, /Pojďme teď projít úkol T0001/u);
  assert.equal(head(), before, "a conversation opened writes nothing");

  // ahead: the highest priority; again: said it has it already
  const ahead = await open(["2", ""]);
  assert.match(ahead.out, /✓ Dopředu ve frontě/u);
  assert.equal(Tree.open(w.cwd, w.env).get<Task>("T0001")!.priority, 5);
  assert.match((await open(["2", ""])).out, /už má nejvyšší prioritu \(5\)/u);

  // a task that waits: as before (its own question), never these choices
  await w.ok(["task", "wait", "T1", "--on", "Odpověď farního úřadu Lhota.", "--kind", "letter", "--to", "Farní úřad Lhota"]);
  const waits = await open(["0", ""]);
  assert.doesNotMatch(waits.out, /je ve frontě/u);
  w.cleanup();
});
