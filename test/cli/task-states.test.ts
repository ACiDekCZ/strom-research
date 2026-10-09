// What an agent may take up and write on: never a task another agent works on, one session of its own in each research,
// only a task put aside woken, a parked task's reason gone once taken up; nothing written on a fact or a record that
// was taken back or merged into another.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };
const A = { STROM_WORKER: "agent-a" };
const B = { STROM_WORKER: "agent-b" };

async function twoTasks(w: World): Promise<void> {
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "1905"]); // G1, P1
  await w.ok(["research", "new", "Potomci", "--new-person", "Josef /Dvořák/", "--sex", "M", "--born", "1880"]); // G2, P2
  const tasks = (await w.ok(["task", "list", "--state", "all", "--json"])).json.tasks as { id: string }[];
  for (const t of tasks) await w.ok(["task", "drop", t.id, "--reason", "test"]);
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "matrika Lhota", "--why", "a", "--done-when", "b", "--about", "P1", "--research", "G1", "--priority", "5"]);
  await w.ok(["task", "add", "Křest Josefa", "--level", "link", "--where", "matrika Ves", "--why", "a", "--done-when", "b", "--about", "P2", "--research", "G2", "--priority", "4"]);
}

/** Who wrote each operation (its session, "agent", "user"), with its op and targets. */
function ops(w: World): { by: string; op: string; targets: string[] }[] {
  const out: { by: string; op: string; targets: string[] }[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl")) for (const l of fs.readFileSync(p, "utf8").split("\n").filter(Boolean)) out.push(JSON.parse(l));
    }
  };
  walk(path.join(w.cwd, "data", "ops"));
  return out;
}

test("C9: task next, task start and brief never offer a task another agent holds", opts, async () => {
  const w = new World();
  await twoTasks(w);
  const [first, second] = (await w.ok(["task", "list", "--json"])).json.tasks.map((t: { id: string }) => t.id);
  await w.ok(["session", "start", first], { env: A });
  assert.equal((await w.ok(["task", "next", "--json"], { env: B })).json.task.id, second);
  assert.match((await w.ok(["brief"], { env: B })).out, /Křest Josefa/);
  const held = await w.run(["task", "start", first], { env: B });
  assert.equal(held.code, 2);
  assert.match(held.err, new RegExp(`${first} is being worked on in session N0001`));
  w.cleanup();
});

test("C11: one agent, a session in each of two researches (two desktop conversations): each command finds its own; never two in one research", opts, async () => {
  const w = new World();
  await twoTasks(w);
  const [first, second] = (await w.ok(["task", "list", "--json"])).json.tasks.map((t: { id: string }) => t.id);
  // no STROM_WORKER: conversations of the desktop app, which strom did not start
  await w.ok(["session", "start", first]); // N1 in G1
  await w.ok(["session", "start", second]); // N2 in G2
  assert.ok(fs.existsSync(path.join(w.cwd, ".strom", "sessions", "~G0001.json")) && fs.existsSync(path.join(w.cwd, ".strom", "sessions", "~G0002.json")));
  // a second session in the same research is still refused
  await w.ok(["task", "add", "Sňatek Jana", "--level", "link", "--where", "matrika Lhota", "--why", "a", "--done-when", "b", "--about", "P1", "--research", "G1"]);
  const same = await w.run(["session", "start", "--research", "G1"]);
  assert.equal(same.code, 2);
  assert.match(same.err, /session N0001 is still open on T/);

  // each command goes to the session of what it names
  await w.ok(["search", "add", "Křty Novák", "--method", "index", "--result", "negative", "--task", first]);
  await w.ok(["task", "done", first, "--result", "nalezen"]);
  await w.ok(["task", "park", second, "--reason", "čeká na archiv"]);
  const by = (op: string, target: string) => ops(w).find((o) => o.op === op && o.targets.includes(target))?.by;
  assert.equal(by("search.add", "Q0001") ?? ops(w).find((o) => o.op === "search.add")?.by, "N0001");
  assert.equal(by("task.done", first), "N0001");
  assert.equal(by("task.park", second), "N0002");
  // without a name strom does not guess which one to close or note in
  const which = await w.run(["session", "close", "--summary", "x", "--next", "y"]);
  assert.equal(which.code, 2);
  assert.match(which.err, /you hold 2 sessions: N0001 on T\d+ \(G0001\), N0002 on T\d+ \(G0002\)/);
  await w.ok(["session", "note", "jen do druhé", "--session", "N2"]);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0002.json")).notes[0].text, "jen do druhé");
  await w.ok(["session", "close", "N1", "--summary", "křest nalezen", "--next", "sňatek"]);
  assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "sessions", "~G0001.json")), false);
  // one left: no name needed any more
  await w.ok(["session", "close", "--summary", "čeká", "--next", "archiv"]);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0002.json")).state, "closed");
  w.cleanup();
});

test("C11: the one pointer an older strom wrote is still read", opts, async () => {
  const w = new World();
  await twoTasks(w);
  const [first] = (await w.ok(["task", "list", "--json"])).json.tasks.map((t: { id: string }) => t.id);
  await w.ok(["session", "start", first]);
  // as an older strom left it: .strom/session.json alone
  fs.rmSync(path.join(w.cwd, ".strom", "sessions"), { recursive: true, force: true });
  await w.ok(["session", "note", "pořád v N1"]);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).notes[0].text, "pořád v N1");
  await w.ok(["session", "close", "--summary", "x", "--next", "y", "--continue"]);
  assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "session.json")), false);
  w.cleanup();
});

test("C12 C16: task wake only brings back what was put aside; a parked task taken up loses its parking", opts, async () => {
  const w = new World();
  await twoTasks(w);
  const [first, second] = (await w.ok(["task", "list", "--json"])).json.tasks.map((t: { id: string }) => t.id);
  await w.ok(["task", "park", second, "--reason", "čeká na archiv", "--until", "2099-01-01"]);
  await w.ok(["session", "start", first]);
  const doing = await w.run(["task", "wake", first]);
  assert.equal(doing.code, 2);
  assert.match(doing.err, /is being worked on — it comes back to the queue when its session closes/);
  await w.ok(["task", "done", first, "--result", "nalezen"]);
  await w.ok(["session", "close", "--summary", "hotovo", "--next", "nic"]);
  assert.match((await w.run(["task", "wake", first])).err, /is done \(nalezen\) — what is left is a new task/);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", `${first}.json`)).state, "done");

  await w.ok(["session", "start", second]);
  const t = readJsonFile(path.join(w.cwd, "data", "tasks", `${second}.json`));
  assert.equal(t.state, "doing");
  assert.equal(t.parkedUntil, undefined);
  assert.equal(t.parkedReason, undefined);
  w.cleanup();
});

test("C6 C7: a retracted fact and a merged person take no citation and no edit", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M", "--born", "1905"]); // P1, E1
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]); // P2
  await w.ok(["source", "add", "Křest Jana", "--kind", "baptism"]); // S1
  await w.ok(["event", "retract", "E1", "--reason", "špatně přečteno"]);
  const cite = await w.run(["cite", "E1", "S1", "--locator", "fol. 1"]);
  assert.equal(cite.code, 2);
  assert.match(cite.err, /E0001 is retracted: špatně přečteno\n→ nothing to cite there: add the fact anew/);
  assert.match((await w.run(["event", "edit", "E1", "--date", "1906", "--reason", "x"])).err, /E0001 is retracted/);

  await w.ok(["person", "merge", "P1", "P2", "--reason", "týž Jan"]);
  const merged = await w.run(["cite", "P2", "S1", "--locator", "fol. 1"]);
  assert.equal(merged.code, 2);
  assert.match(merged.err, /P0002 (was merged into|je sloučené do) P0001\n→ strom cite P0001 S0001/);
  const about = await w.run(["task", "add", "Úmrtí Jana", "--level", "link", "--where", "matrika Lhota", "--why", "a", "--done-when", "b", "--about", "P2"]);
  assert.equal(about.code, 2);
  assert.match(about.err, /P0002 (was merged into|je sloučené do) P0001\n→ use P0001/);
  w.cleanup();
});
