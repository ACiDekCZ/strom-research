// The people no record of their own proves: strom lists them (strom person
// list --unproven, a note in strom check, the menu) and proposes the work for
// them — all of them a batch at a time, the ones picked, or one — never the
// same task twice; the living are left to the family.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "en"]);
  await w.ok(["recordset", "add", "Kamenice 12, N 1880-1890", "--kinds", "baptism", "--places", "Kamenice nad Lipou", "--years", "1880-1890"]); // B1
  await w.ok(["source", "add", "Křest Josefa Nováka 1885", "--kind", "baptism", "--recordset", "B1", "--transcript", "Josef, syn Jana Nováka a Marie."]); // S1
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P1, proved
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Kamenice nad Lipou", "--cite", "S1"]);
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]); // P2, named in his son's baptism
  await w.ok(["family", "add", "--partner", "P2", "--child", "P1", "--cite", "S1"]);
  await w.ok(["person", "add", "Marie /Horáková/", "--sex", "F", "--born", "1910", "--note", "Grandmother's sister (family memory)"]); // P3, no record
  await w.ok(["person", "add", "Petr /Malý/", "--sex", "M", "--born", "1990"]); // P4, living
  await w.ok(["person", "add", "Karel /Dvořák/", "--sex", "M"]); // P5, a lead with a record
  await w.ok(["event", "add", "P5", "BIRT", "--date", "ABT 1850", "--place", "Kamenice nad Lipou", "--cite", "S1", "--status", "lead"]);
  return w;
}

test("person list --unproven: how each stands, the living apart; strom check says how many", opts, async () => {
  const w = await world();
  const list = await w.ok(["person", "list", "--unproven"]);
  assert.match(list.out, /^3 without a record of their own — named in a record: 1 · leads only: 1 · no record: 1\n/);
  assert.match(list.out, /P0002 +Jan Novák +named in a record: S0001/);
  assert.match(list.out, /P0003 +Marie Horáková +\*1910 +no record\n/, "a note says where she comes from");
  assert.match(list.out, /P0005 +Karel Dvořák +.*leads only: S0001/);
  assert.doesNotMatch(list.out, /P0001/, "a record proves him");
  assert.match(list.out, /living, most likely \(born less than 100 years ago, no death recorded\) — not counted, no tasks: P0004 Petr Malý/);
  assert.match(list.out, /tasks for them: strom review --unproven/);
  const json = (await w.ok(["person", "list", "--unproven", "--json"])).json;
  assert.deepEqual(json.counts, { named: 1, leads: 1, none: 1 });
  assert.deepEqual(json.living, ["P0004"]);
  const check = await w.ok(["check"]);
  assert.match(check.out, /^ok — data consistent, sealed, nothing lost\nnote: 3 people rest on no record of their own → strom person list --unproven/);
  assert.equal(check.code, 0, "research to do, not an error");
  w.cleanup();
});

test("review --unproven: a batch at a time, nothing twice, who is proved leaves; several people named: one review", opts, async () => {
  const w = await world();
  const first = await w.ok(["review", "--unproven", "--max", "2"]);
  assert.match(first.out, /\+G0001 research "People without a record of their own"/);
  assert.match(first.out, /1 more without a record of their own: strom review --unproven again takes the next ones/);
  const research = (await w.ok(["research", "show", "G1", "--json"])).json.research;
  assert.equal(research.review.unproven, true);
  assert.equal(research.review.people.length, 2);
  assert.ok(!research.review.people.includes("P0004"), "the living get no tasks");
  const tasks = (await w.ok(["task", "list", "--json"])).json.tasks.length;
  assert.ok(tasks > 0);
  // again while those are open: nothing twice
  const again = await w.ok(["review", "--unproven", "--max", "2"]);
  assert.match(again.out, /nothing new to review/);
  assert.equal((await w.ok(["task", "list", "--json"])).json.tasks.length, tasks);
  // the first one is proved and their work done: the next one comes into the batch
  const [a] = research.review.people as string[];
  await w.ok(["event", "add", a!, "BIRT", "--date", "1850", "--cite", "S1"]);
  for (const t of (await w.ok(["task", "list", "--json"])).json.tasks) if (t.subject.includes(a)) await w.ok(["task", "done", t.id, "--result", "recorded"]);
  await w.ok(["review", "--unproven", "--max", "2"]);
  const next = (await w.ok(["research", "show", "G1", "--json"])).json.research.review.people as string[];
  assert.ok(!next.includes(a!), "who is proved leaves the review");
  assert.equal(next.length, 2);
  assert.doesNotMatch((await w.ok(["research", "list"])).out, /G0002/, "the same review goes on");

  // several people named: one review for them, the same one again later
  const two = await w.ok(["review", "P3", "P5", "--dry-run"]);
  assert.match(two.out, /Marie Horáková, Karel Dvořák — /);
  assert.equal((await w.run(["review", "--unproven", "P3"])).code, 2);
  assert.equal((await w.run(["review", "P3", "--max", "2"])).code, 2);
  assert.equal((await w.run(["review", "P3", "P5", "--scope", "family"])).code, 2);
  assert.equal((await w.run(["review"])).code, 2);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("the menu lists the people without a record and takes the ones picked by number", opts, async () => {
  const w = await world();
  await w.ok(["lang", "cs"]);
  // 4 add to the research · 5 the people without a record · 2 pick · a number not in the list · an ID · not now · Enter · 0 · 0
  const menu = await w.run(["menu"], { tty: true, answers: ["4", "5", "2", "1 9", "p0005", "n", "", "0", "0"] });
  assert.match(menu.out, /Osoby bez vlastního záznamu \(3\)/);
  assert.match(menu.out, /Tyto osoby zatím nedokládá žádný jejich vlastní záznam:\n +1\. P0002 Jan Novák — jmenuje je jiný záznam\n +2\. P0003 Marie Horáková \(\*1910\) — bez záznamu\n +3\. P0005 Karel Dvořák/);
  assert.match(menu.out, /Nejspíš žijící \(narození před méně než 100 lety\) — to ví rodina, bez úkolů: P0004 Petr Malý/);
  assert.match(menu.out, /V seznamu není: 9/);
  const research = (await w.ok(["research", "list", "--json"])).json.researches[0];
  // one picked: the review of one person, as from "Review one person"
  assert.equal(research.focus, "P0005");
  assert.equal(research.review.people, undefined);
  w.cleanup();
});

test("someone most likely alive is reviewed only when the person says so: a question at the terminal, --living for an agent", opts, async () => {
  const w = await world();
  await w.ok(["lang", "cs"]);
  const agent = await w.run(["review", "P4"]);
  assert.equal(agent.code, 2);
  assert.match(agent.err, /most likely alive \(born less than 100 years ago, no death recorded\): P0004 Petr Malý \(\*1990\)/);
  assert.match(agent.err, /strom review P4 --living/);
  // at the terminal: asked, no suggested — nothing added
  const no = await w.run(["review", "P4"], { tty: true, answers: [""] });
  assert.match(no.out, /P0004 Petr Malý \(\*1990\): nejspíš žijící \(narození před méně než 100 lety, úmrtí nezapsané\)\. .* Přesto revidovat\?/);
  assert.match(no.out, /Nic se nepřidalo\./);
  assert.equal((await w.ok(["research", "list", "--json"])).json.researches.length, 0);
  // yes at the terminal, or --living: as for anyone
  assert.match((await w.run(["review", "P4"], { tty: true, answers: ["a"] })).out, /P0004 Petr Malý \(\*1990\) — nových úkolů: 1/);
  assert.equal((await w.run(["review", "P4", "P3", "--living", "--dry-run"])).code, 0);
  w.cleanup();
});
