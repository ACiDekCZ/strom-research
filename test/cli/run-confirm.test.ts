// The question before the agent starts from a link of the Strom app (run.confirm, spec 123): asked by default, as it
// always was; with the person's run.confirm no what only starts the agent on the subscription or AI credit starts at
// once, one line saying so and where the question is turned on again. Still asked: a price in money, an agent's own
// command, a request sent, consents, deletions; nothing starts beside work at it already. Only the person sets it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Session, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

async function world() {
  const w = new World();
  await w.withTree("Lhotákovi");
  const id = Tree.open(w.cwd, w.env).config.id;
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1822"]);
  // the task in decomposed text (NFD), as a person's input may come
  await w.ok(["task", "add", "Porovnat čtení křtu".normalize("NFD"), "--level", "verify", "--where", "matrika Lhota", "--why", "dvě čtení", "--done-when", "rozdíly rozhodnuté", "--about", "P1"]); // T1
  // the conversation in the agent's desktop app: opened, nothing written
  const apps = path.join(w.dir, "apps");
  fs.mkdirSync(path.join(apps, "Claude.app"), { recursive: true });
  w.env.STROM_APP_DIRS = apps;
  const link = (what: string, answers: string[] = [], more: { tty?: boolean } = { tty: true }) => w.run(["link", "open", `strom-research://${what}${what.includes("?") ? "&" : "?"}tree=${id}`], { ...more, answers });
  const config = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  return { w, link, config };
}

test("run.confirm: asked by default (K1.1); no — the agent from the app's links started at once with one line (K1.2); only the person sets it (K1.4)", opts, async () => {
  const { w, link, config } = await world();

  // K1.1 the default: asked as before — Enter is no, nothing started
  assert.equal(config().runConfirm, undefined);
  const asked = await link("task?task=T0001", ["1", ""]);
  assert.match(asked.out, /Aplikace Strom žádá: rozhovor s agentem \(Claude Code\) o úkolu, teď: Porovnat čtení křtu/u);
  assert.match(asked.out, /předplatné nebo kredit AI\.[\s\S]*Pokračovat\? \(a\/n\) \[n\]/u);
  assert.doesNotMatch(asked.out, /Pojďme teď projít úkol/u);
  assert.doesNotMatch(asked.out, /bez potvrzení/u);

  // K1.4 never an agent's, nor a command without the person's terminal (the bridge, a script): refused, nothing written
  w.env.CLAUDECODE = "1";
  const agent = await w.run(["config", "set", "run.confirm", "no"]);
  assert.equal(agent.code, 4);
  assert.match(agent.err + agent.out, /an agent cannot answer this/);
  assert.match(agent.err + agent.out, /strom config set run\.confirm no/);
  delete w.env.CLAUDECODE;
  const script = await w.run(["config", "set", "run.confirm", "no"], { env: { STROM_FOR_APP: "1" } });
  assert.equal(script.code, 4);
  assert.equal(config().runConfirm, undefined, "nothing turned off");
  // the person: their own yes in the terminal too — Enter is no
  const enter = await w.run(["config", "set", "run.confirm", "no"], { tty: true, answers: [""] });
  assert.match(enter.out, /Povolit\? \(a\/n\) \[n\][\s\S]*Nic se nezměnilo/u);
  assert.equal(config().runConfirm, undefined);
  const yes = await w.ok(["config", "set", "run.confirm", "no"], { tty: true, answers: ["a"] });
  assert.match(yes.out, /Spouštět agenta z odkazů aplikace Strom bez dotazu\?/u);
  assert.equal(config().runConfirm, "no");
  // anything but ask|no refused
  assert.notEqual((await w.run(["config", "set", "run.confirm", "yes"], { tty: true, answers: ["a"] })).code, 0);

  // K1.2 the task's conversation: one line, no question, started
  const started = await link("task?task=T0001", ["1"]);
  assert.match(started.out, /▶ Spouští se bez potvrzení \(výzkum Lhotákovi\): rozhovor s agentem \(Claude Code\) o úkolu, teď: Porovnat čtení křtu\. Dotaz před spuštěním agenta se zapíná v Nastavení → 1 → „Spouštění agenta z aplikace Strom“, nebo strom config unset run\.confirm\./u);
  assert.doesNotMatch(started.out, /Pokračovat\?/u);
  assert.match(started.out, /Pojďme teď projít úkol T0001/u);
  // a conversation about a person and about the research: the same
  const person = await link("chat?person=P0001", []);
  assert.match(person.out, /▶ Spouští se bez potvrzení \(výzkum Lhotákovi\): rozhovor s agentem \(Claude Code\) o osobě Vojtěch Lhoták/u);
  assert.doesNotMatch(person.out, /Pokračovat\?/u);
  // in German: the research's language decides the line
  await w.ok(["config", "set", "lang", "de", "--for-tree"]);
  assert.match((await link("chat", [])).out, /▶ Startet ohne Rückfrage \(Forschung Lhotákovi\): /u);
  await w.ok(["config", "set", "lang", "cs", "--for-tree"]);

  // K1.4 an agent's own command is never let through: asked as before
  w.env.CLAUDECODE = "1";
  const byAgent = await link("task?task=T0001", ["1", "n"]);
  assert.match(byAgent.out, /Pokračovat\? \(a\/n\) \[n\]/u);
  assert.doesNotMatch(byAgent.out, /bez potvrzení|Pojďme teď/u);
  delete w.env.CLAUDECODE;

  // asked again: anyone's, at once
  await w.ok(["config", "unset", "run.confirm"]);
  assert.equal(config().runConfirm, undefined);
  assert.match((await link("chat", ["n"])).out, /Pokračovat\? \(a\/n\)/u);
  w.cleanup();
});

test("run.confirm no: still asked — a price in money said, a request sent, a consent, a deletion; nothing beside a session at work (K1.3)", opts, async () => {
  const { w, link } = await world();
  await w.ok(["config", "set", "run.confirm", "no"], { tty: true, answers: ["a"] });
  // three sessions on tasks like T1 measured here: the price in money is said, and asked whatever run.confirm says
  await w.ok(["task", "add", "Jiné čtení", "--level", "verify", "--where", "matrika Lhota", "--why", "a", "--done-when", "b", "--about", "P1"]); // T2
  for (let i = 0; i < 3; i++) {
    await w.ok(["session", "start", "T2"]);
    await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  }
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    tree.list<Session>("session").forEach((s, i) => tree.put({ ...s, metrics: { ...s.metrics, costUsd: [0.4, 0.6, 0.8][i] } }, { op: "session.update", targets: [s.id], summary: `${s.id} measured` }));
    tree.commit("Sessions measured");
  });
  const priced = await link("task?task=T0001", ["1", ""]);
  assert.match(priced.out, /Dřívější sezení nad podobnými úkoly tady stála asi/u);
  assert.match(priced.out, /Pokračovat\? \(a\/n\) \[n\]/u);
  assert.doesNotMatch(priced.out, /bez potvrzení|Pojďme teď/u);

  // a request marked sent: the person's word, asked
  await w.ok(["task", "wait", "T2", "--on", "Odpověď farního úřadu Lhota.", "--kind", "letter", "--to", "Farní úřad Lhota"]);
  const sent = await link("task?task=T0002&do=sent", [""]);
  assert.match(sent.out, /Pokračovat\? \(a\/n\) \[n\]/u);
  assert.equal(Tree.open(w.cwd, w.env).get<Task>("T0002")!.state, "waiting", "Enter: not marked sent");
  // …while a conversation about it starts at once (only the agent on the subscription)
  assert.match((await link("task?task=T0002&do=chat", [])).out, /▶ Spouští se bez potvrzení/u);

  // nothing started beside a session at work
  await w.ok(["session", "start", "T1"]);
  const busy = await link("work?do=tasks&n=1", []);
  assert.match(busy.out, /Na tomto výzkumu se už pracuje \(běhy: 0, sezení: 1\)\. Nic dalšího se nespustilo\./u);
  assert.doesNotMatch(busy.out, /bez potvrzení/u);
  assert.equal(Tree.open(w.cwd, w.env).list<Session>("session").filter((s) => s.state === "open").length, 1, "no other session");
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);

  // a consent and a deletion: the person's own, as before (no terminal: refused)
  const allow = await w.run(["allow", "host", "archiv.example.org"]);
  assert.equal(allow.code, 4);
  assert.match(allow.err, /potřeba souhlas – Povolit automatické stahování z archiv\.example\.org\?/u);
  const remove = await w.run(["trees", "remove", "Lhotákovi"]);
  assert.equal(remove.code, 4);
  assert.match(remove.err, /potřeba souhlas – rodokmen z počítače odebírá jen člověk/u);
  assert.ok(fs.existsSync(w.cwd), "nothing removed");
  w.cleanup();
});

test("the menu's settings: the question before the agent starts from the app, turned off with the person's yes and on again (K1.5)", opts, async () => {
  const { w, config } = await world();
  // 8 settings · 1 what to set · the step · 2 without the question · the person's yes · 0 back — the step's number as
  // shown: the parts of the setup differ by the system (the terminal's part on macOS and Windows alone)
  const look = await w.ok([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
  const n = look.out.split("\n").find((l) => /Spouštění agenta z aplikace Strom/u.test(l))?.match(/^\s*(\d+)/u)?.[1];
  assert.ok(n, look.out);
  const off = await w.ok([], { tty: true, answers: ["8", "1", n, "2", "a", "0", "0"] });
  assert.match(off.out, /Spouštění agenta z aplikace Strom: s potvrzením/u);
  assert.match(off.out, /Ptá se dál: dotaz s cenou v penězích/u);
  assert.equal(config().runConfirm, "no");
  const on = await w.ok([], { tty: true, answers: ["8", "1", n, "1", "0", "0"] });
  assert.match(on.out, /Spouštění agenta z aplikace Strom: bez potvrzení/u);
  assert.equal(config().runConfirm, undefined);
  // strom config says it, with what it is
  assert.match((await w.ok(["config", "--help"])).out + (await w.ok(["config", "set", "--help"])).out, /run\.confirm\s+ask \| no/);
  w.cleanup();
});
