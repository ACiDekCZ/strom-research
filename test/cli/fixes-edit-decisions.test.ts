// strom fixes edit-decisions: a disagreement between the research and the user's own edit in the Strom app that an agent
// decided before strom refused it (an open conflict of the user's edit is the user's alone, unless the user left it to
// the agent) — found, opened again for the user by rules (the person's, one operation and one commit; what the agent
// decided kept in a note, no fact touched), and closed again exactly as it was by the undo; one whose user's value the
// agent took is left, and so is one changed since the fix. Never in an archive (an agent's work).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { changeLines } from "../../src/core/changelog.ts";
import type { Conflict, Event, Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const agent = { env: { AI_AGENT: "1" } };

const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());
const conflictOf = (w: World, id: string): Conflict => Tree.open(w.cwd, w.env).get<Conflict>(id)!;
const eventsOf = (w: World): string => JSON.stringify(Tree.open(w.cwd, w.env).list<Person>("person").flatMap((p) => p.events as Event[]));
const decision = (w: World) => JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).fixes?.["edit-decisions"]?.decision;

/**
 * The Lhotáks as an older strom left them: three baptisms from a register (E1–E3), each sent back a day later from the
 * Strom app (X1–X3, the user's own edits); the user left them to the agent, the agent decided — X1 and X3 for the
 * research, X2 taking the user's value — and the older strom kept no mark of the user's leaving it (written here as it
 * wrote them).
 */
async function lhotaci(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křty Lhota 1880–1890", "--kind", "baptism"]); // S1
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Lhota", "--cite", "S1"]); // E1
  await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]); // P2
  await w.ok(["event", "add", "P2", "CHR", "--date", "7 MAY 1887", "--place", "Lhota", "--cite", "S1"]); // E2
  await w.ok(["person", "add", "Ondřej /Lhoták/", "--sex", "M"]); // P3
  await w.ok(["event", "add", "P3", "CHR", "--date", "9 JUN 1889", "--place", "Lhota", "--cite", "S1"]); // E3
  const out = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  const sent = path.join(w.dir, "app.ged");
  fs.writeFileSync(sent, fs.readFileSync(out, "utf8").replace("2 DATE 3 MAR 1885", "2 DATE 4 MAR 1885").replace("2 DATE 7 MAY 1887", "2 DATE 8 MAY 1887").replace("2 DATE 9 JUN 1889", "2 DATE 10 JUN 1889"));
  await w.ok(["sync", sent, "--apply"]);
  for (const x of ["X1", "X2", "X3"]) await w.ok(["conflict", "leave", x]);
  await w.ok(["conflict", "resolve", "X1", "--take", "research", "--reasoning", "matrika je jasná"], agent);
  await w.ok(["conflict", "resolve", "X2", "--take", "user", "--reasoning", "uživatel to řekl v rozhovoru"], agent);
  await w.ok(["conflict", "resolve", "X3", "--take", "research", "--reasoning", "zápis je čitelný"], agent);
  // an older strom: no mark of the user leaving it to the agent
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    for (const c of tree.list<Conflict>("conflict")) {
      const { leftToAgent: _, ...rest } = c;
      tree.put(rest as Conflict, { op: "conflict.update", targets: [c.id], summary: `${c.id} as an older strom wrote it` });
    }
    tree.commit("The conflicts as an older strom wrote them");
  });
  return w;
}

test("strom fixes show edit-decisions: what an agent decided of the user's own edits, the user's value taken left; strom check warns", opts, async () => {
  const w = await lhotaci();
  try {
    const r = await w.ok(["fixes", "show", "edit-decisions", "--lang", "en"]);
    assert.match(r.out, /Found: 3 disagreements decided by an agent — 2 to be opened again, 1 to stay as they are/);
    assert.match(r.out, /X0001 · .* · P0001 · decided: /);
    assert.match(r.out, /X0003 · .* · P0003 · decided: /);
    assert.match(r.out, /X0002 · .*: the user's value taken, the fact holds it — stays as it is/);
    const j = await w.ok(["fixes", "show", "edit-decisions", "--json"]);
    assert.deepEqual([j.json.found.count, j.json.found.split, j.json.found.unsplit, j.json.paid, j.json.remedy], [3, 2, 1, false, "rewrite"]);
    assert.deepEqual(j.json.items.map((i: { conflict: string }) => i.conflict), ["X0001", "X0003"]);
    assert.deepEqual(j.json.left.map((i: { conflict: string; why: string }) => [i.conflict, i.why]), [["X0002", "user"]]);
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "edit-decisions").state, "pending");
    // said in the research's language, impersonally
    assert.match((await w.ok(["fixes", "show", "edit-decisions"])).out, /Nalezeno: 3 rozpory rozhodnuté agentem/);
    const found = (await w.run(["check", "--json"])).json.findings.filter((f: { code: string }) => f.code === "agent-decided-edit");
    assert.equal(found.length, 1);
    assert.deepEqual([found[0].level, found[0].count, found[0].id, found[0].hint], ["warn", 2, "X0001", "strom fixes show edit-decisions"]);
  } finally {
    w.cleanup();
  }
});

test("strom fixes run edit-decisions: the person's — opened again with the agent's decision in a note, no fact touched; undo closes them as they were", opts, async () => {
  const w = await lhotaci();
  try {
    const facts = eventsOf(w);
    const x1 = JSON.stringify(conflictOf(w, "X0001"));
    const x2 = JSON.stringify(conflictOf(w, "X0002"));
    // an agent, a run nobody watches, --yes: never
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "run", "edit-decisions"], { env })).code, 4, JSON.stringify(env));
    assert.notEqual((await w.run(["fixes", "run", "edit-decisions", "--yes"], { tty: true, answers: ["1"] })).code, 0);
    assert.equal(conflictOf(w, "X0001").state, "resolved");
    assert.match((await w.ok(["fixes", "undo", "edit-decisions", "--lang", "en"], { env: { STROM_NONINTERACTIVE: "1" } })).out, /Nothing to put back/);
    const n0 = commits(w);
    // (in the research's language: the note it leaves is written in it)
    const r = await w.ok(["fixes", "run", "edit-decisions"], { tty: true, answers: ["1"] });
    assert.match(r.out, /Znovu otevřeno: 2 rozpory v 2 záznamech\./);
    assert.equal(commits(w), n0 + 1, "one commit");
    const tree = Tree.open(w.cwd, w.env);
    const ops = tree.readOps().filter((o) => o.op === "editdecision.fix");
    assert.equal(ops.length, 1, "one operation");
    assert.deepEqual(ops[0]!.targets, ["X0001", "X0003"]);
    assert.ok(ops[0]!.files.some((f) => f.path.endsWith("edit-decisions.json")), "what the undo needs kept with the operation");
    assert.ok(ops[0]!.files.some((f) => f.path === "strom.json"), "the decision in the same operation");
    assert.equal(decision(w), "fixed");
    for (const id of ["X0001", "X0003"]) {
      const x = conflictOf(w, id);
      assert.deepEqual([x.state, x.resolution, x.reasoning, x.decidedBy, x.decidedAt, x.taken], ["open", undefined, undefined, undefined, undefined, undefined], id);
      assert.match(x.notes.at(-1)!.text, /^Rozhodl agent před strom 1\.26\.0, ačkoli rozhodnutí patřilo uživateli: .+Znovu otevřeno k rozhodnutí uživatele/u);
    }
    assert.match(conflictOf(w, "X0001").notes.at(-1)!.text, /matrika je jasná/);
    assert.equal(JSON.stringify(conflictOf(w, "X0002")), x2, "the user's value taken: left as it is");
    assert.equal(eventsOf(w), facts, "no fact touched");
    assert.equal((await w.run(["verify", "--json"])).code, 0, "sealed");
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "edit-decisions").state, "fixed");
    assert.equal((await w.run(["check", "--json"])).json.findings.find((f: { code: string }) => f.code === "agent-decided-edit"), undefined);
    // they wait for the user again: an agent still refused
    const refused = await w.run(["conflict", "resolve", "X1", "--take", "research", "--reasoning", "matrika", "--json"], agent);
    assert.equal(JSON.parse(refused.out).code, "conflict.users");
    // what the history says, in the research's language
    assert.deepEqual(changeLines(tree, ops, "", tree.lang).map((l) => l.text), ["Rozpory s vlastními úpravami uživatele znovu otevřeny k jeho rozhodnutí: 2"]);
    // the user decides X3 now: changed since, kept by the undo
    await w.ok(["conflict", "resolve", "X3", "--take", "research", "--reasoning", "zápis souhlasí"]);
    const x3 = JSON.stringify(conflictOf(w, "X0003"));
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "undo", "edit-decisions"], { env })).code, 4, JSON.stringify(env));
    assert.notEqual((await w.run(["fixes", "undo", "edit-decisions", "--yes"], { tty: true })).code, 0);
    const n1 = commits(w);
    const u = await w.ok(["fixes", "undo", "edit-decisions", "--lang", "en"], { tty: true });
    assert.match(u.out, /Closed again as they were: 1 disagreement · 1 changed since, left as it is/);
    assert.equal(commits(w), n1 + 1);
    assert.equal(Tree.open(w.cwd, w.env).readOps().filter((o) => o.op === "editdecision.unfix").length, 1);
    assert.equal(JSON.stringify(conflictOf(w, "X0001")), x1, "exactly as the agent left it");
    assert.equal(JSON.stringify(conflictOf(w, "X0003")), x3, "the user's decision since kept");
    assert.equal(decision(w), "declined");
    assert.equal((await w.run(["verify", "--json"])).code, 0, "sealed");
    assert.match((await w.ok(["fixes", "undo", "edit-decisions", "--lang", "en"], { tty: true })).out, /Nothing to put back/);
  } finally {
    w.cleanup();
  }
});

test("strom fixes edit-decisions in an archive: not offered, not run, not warned of — an agent's work", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    const list = await w.ok(["fixes", "--json"]);
    assert.equal(list.json.checks.find((c: { id: string }) => c.id === "edit-decisions"), undefined);
    assert.doesNotMatch((await w.ok(["fixes"])).out, /edit-decisions|agent/i);
    assert.deepEqual((await w.ok(["fixes", "show", "edit-decisions", "--json"])).json.checks, []);
    assert.notEqual((await w.run(["fixes", "run", "edit-decisions"], { tty: true, answers: ["1"] })).code, 0);
    assert.equal(conflictOf(w, "X0001").state, "resolved");
    assert.equal((await w.run(["check", "--json"])).json.findings.find((f: { code: string }) => f.code === "agent-decided-edit"), undefined);
  } finally {
    w.cleanup();
  }
});
