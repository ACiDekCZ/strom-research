// strom fixes woken-waits: a task waiting for somebody's answer that a strom before 1.26.0 put back in the queue when
// images of a book were registered — the person's check of a site, a letter on another book — found in the history
// (its last operation that wake), set waiting again by rules as it waited (the person's, one operation and one commit;
// the request sent put back from the history, the wake's note kept), and put back in the queue by the undo; one taken
// up since, and one woken by the book it waited on, are left. Never in an archive (an agent's work).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { now, Tree } from "../../src/core/tree.ts";
import { changeLines } from "../../src/core/changelog.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());
const taskOf = (w: World, id: string): Task => Tree.open(w.cwd, w.env).get<Task>(id)!;
const decision = (w: World) => JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).fixes?.["woken-waits"]?.decision;

/** The wake of a strom before 1.26.0 (commands/media.ts wakeWaiting): images of the book registered, the task back in the queue. */
function oldWake(w: World, id: string, book: string): void {
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    const t = tree.get<Task>(id)!;
    const { awaits: _, wait: _w, sent: _s, ...rest } = t;
    const at = now();
    tree.put({ ...rest, state: "open", notes: [...t.notes, { text: `3 images of ${book} registered`, at, by: tree.actor }], updated: at } as Task, {
      op: "task.wake",
      targets: [id],
      summary: `${id} wake: images of ${book} arrived`,
    });
    tree.commit(`${id} woken by images of ${book}`);
  });
}

const task = (what: string, book: string) => ["task", "add", what, "--level", "request", "--where", book, "--why", "doloží otce Vojtěcha", "--done-when", "odpověď přišla", "--about", "P1"];

/**
 * The Lhotáks with four tasks waiting for somebody's answer, each woken by an older strom when images of a book came:
 * T1 a letter to the registry office (sent), woken by B1 it only works in; T2 the person's check of a site, woken by B1;
 * T3 a letter on B2, woken by B2 (right); T4 a letter, woken by B1, then taken up (a note since).
 */
async function lhotaci(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["recordset", "add", "Matrika Lhota N 1850–1870", "--kinds", "baptism", "--places", "Lhota", "--years", "1850-1870"]); // B1
  await w.ok(["recordset", "add", "Matrika Lhota O 1850–1870", "--kinds", "marriage", "--places", "Lhota", "--years", "1850-1870"]); // B2
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
  await w.ok(task("Žádost o opis křtu Vojtěcha Lhotáka", "B1")); // T1
  await w.ok(["task", "wait", "T1", "--kind", "letter", "--to", "matriční úřad Lhota", "--on", "odpověď matričního úřadu Lhota na žádost o opis"]);
  await w.ok(["task", "sent", "T1"]);
  await w.ok(task("Kniha křtů Lhota na stránkách archivu", "B1")); // T2
  await w.ok(["search", "add", "Kniha křtů Lhota", "--method", "web", "--result", "inconclusive", "--task", "T2", "--note", "closed.example.org refused automated access"]);
  await w.ok(["task", "wait", "T2", "--check", "https://closed.example.org/book/1", "--on", "Je kniha vidět i se snímky?"]);
  await w.ok(task("Opis sňatku rodičů Vojtěcha Lhotáka", "B2")); // T3
  await w.ok(["task", "wait", "T3", "--kind", "letter", "--to", "archiv", "--on", "odpověď archivu se snímky knihy B0002"]);
  await w.ok(task("Dotaz na rodinu Lhotákových", "B1")); // T4
  await w.ok(["task", "wait", "T4", "--kind", "letter", "--to", "farní úřad Lhota", "--on", "odpověď farního úřadu Lhota"]);
  oldWake(w, "T0001", "B0001");
  oldWake(w, "T0002", "B0001");
  oldWake(w, "T0003", "B0002");
  oldWake(w, "T0004", "B0001");
  await w.ok(["note", "add", "T4", "Farní úřad odpověděl telefonicky, opis pošle."]);
  return w;
}

test("strom fixes show woken-waits: the tasks images woke though they waited for somebody's answer; strom check warns", opts, async () => {
  const w = await lhotaci();
  try {
    const r = await w.ok(["fixes", "show", "woken-waits", "--lang", "en"]);
    assert.match(r.out, /Found: 3 tasks woken so — 2 to wait again, 1 to stay as they are \(taken up since\)/);
    assert.match(r.out, /T0001 · Žádost o opis křtu Vojtěcha Lhotáka · woken by images of B0001 \(\d{4}-\d\d-\d\d\) — it waits for a letter, not for B0001/);
    assert.match(r.out, /T0002 · .* — it waits for a person's check of a site/);
    assert.match(r.out, /T0004 · .*: taken up since — stays as it is/);
    assert.doesNotMatch(r.out, /T0003/, "woken by the book it waited on: right");
    const j = await w.ok(["fixes", "show", "woken-waits", "--json"]);
    assert.deepEqual([j.json.found.count, j.json.found.split, j.json.found.unsplit, j.json.paid, j.json.remedy], [3, 2, 1, false, "rewrite"]);
    assert.deepEqual(j.json.items.map((i: { task: string; why: string; sent?: unknown }) => [i.task, i.why, !!i.sent]), [["T0001", "letter", true], ["T0002", "check", false]]);
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "woken-waits").state, "pending");
    assert.match((await w.ok(["fixes", "show", "woken-waits"])).out, /Nalezeno: 3 úkoly probuzené takto – 2 bude znovu čekat/);
    const found = (await w.run(["check", "--json"])).json.findings.filter((f: { code: string }) => f.code === "woken-wait");
    assert.equal(found.length, 1);
    assert.deepEqual([found[0].level, found[0].count, found[0].id, found[0].hint], ["warn", 2, "T0001", "strom fixes show woken-waits"]);
  } finally {
    w.cleanup();
  }
});

test("strom fixes run woken-waits: the person's — waiting again as they waited, the request sent back; undo puts them in the queue", opts, async () => {
  const w = await lhotaci();
  try {
    const t1 = JSON.stringify(taskOf(w, "T0001"));
    const t3 = JSON.stringify(taskOf(w, "T0003"));
    const t4 = JSON.stringify(taskOf(w, "T0004"));
    const sentOp = Tree.open(w.cwd, w.env).readOps().find((o) => o.op === "task.sent" && o.targets.includes("T0001"))!;
    // an agent, a run nobody watches, --yes: never
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "run", "woken-waits"], { env })).code, 4, JSON.stringify(env));
    assert.notEqual((await w.run(["fixes", "run", "woken-waits", "--yes"], { tty: true, answers: ["1"] })).code, 0);
    assert.equal(taskOf(w, "T0001").state, "open");
    const n0 = commits(w);
    const r = await w.ok(["fixes", "run", "woken-waits", "--lang", "en"], { tty: true, answers: ["1"] });
    assert.match(r.out, /Waiting again: 2 tasks in 2 records\./);
    assert.equal(commits(w), n0 + 1, "one commit");
    const tree = Tree.open(w.cwd, w.env);
    const ops = tree.readOps().filter((o) => o.op === "wokenwait.fix");
    assert.equal(ops.length, 1, "one operation");
    assert.deepEqual(ops[0]!.targets, ["T0001", "T0002"]);
    assert.ok(ops[0]!.files.some((f) => f.path.endsWith("woken-waits.json")), "what the undo needs kept with the operation");
    assert.ok(ops[0]!.files.some((f) => f.path === "strom.json"), "the decision in the same operation");
    assert.equal(decision(w), "fixed");
    const a = taskOf(w, "T0001");
    assert.deepEqual([a.state, a.waitingOn, a.sent], ["waiting", "odpověď matričního úřadu Lhota na žádost o opis", { at: sentOp.at, by: sentOp.by }]);
    assert.match(a.notes.at(-1)!.text, /^3 images of B0001 registered$/, "the wake's note stays");
    const b = taskOf(w, "T0002");
    assert.deepEqual([b.state, b.awaitsCheck, b.sent], ["waiting", { url: "https://closed.example.org/book/1", ask: "Je kniha vidět i se snímky?" }, undefined]);
    assert.equal(JSON.stringify(taskOf(w, "T0003")), t3, "woken by its own book: untouched");
    assert.equal(JSON.stringify(taskOf(w, "T0004")), t4, "taken up since: untouched");
    assert.equal((await w.run(["verify", "--json"])).code, 0, "sealed");
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "woken-waits").state, "fixed");
    assert.equal((await w.run(["check", "--json"])).json.findings.find((f: { code: string }) => f.code === "woken-wait"), undefined);
    assert.deepEqual(changeLines(tree, ops, "", tree.lang).map((l) => l.text), ["Úkoly čekající na odpověď, vrácené do fronty snímky jiné knihy, znovu čekají: 2"]);
    // a note on T2 since: changed, kept by the undo
    await w.ok(["note", "add", "T2", "Stránka se mezitím otevřela."]);
    const t2 = JSON.stringify(taskOf(w, "T0002"));
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "undo", "woken-waits"], { env })).code, 4, JSON.stringify(env));
    assert.notEqual((await w.run(["fixes", "undo", "woken-waits", "--yes"], { tty: true })).code, 0);
    const n1 = commits(w);
    const u = await w.ok(["fixes", "undo", "woken-waits", "--lang", "en"], { tty: true });
    assert.match(u.out, /Back in the queue: 1 task · 1 changed since, left as it is/);
    assert.equal(commits(w), n1 + 1);
    assert.equal(Tree.open(w.cwd, w.env).readOps().filter((o) => o.op === "wokenwait.unfix").length, 1);
    assert.equal(JSON.stringify(taskOf(w, "T0001")), t1, "back exactly as the wake left it");
    assert.equal(JSON.stringify(taskOf(w, "T0002")), t2, "the change since kept");
    assert.equal(decision(w), "declined");
    assert.equal((await w.run(["verify", "--json"])).code, 0, "sealed");
    assert.match((await w.ok(["fixes", "undo", "woken-waits", "--lang", "en"], { tty: true })).out, /Nothing to put back/);
  } finally {
    w.cleanup();
  }
});

test("strom fixes woken-waits in an archive: not offered, not run, not warned of — an agent's work", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "woken-waits"), undefined);
    assert.deepEqual((await w.ok(["fixes", "show", "woken-waits", "--json"])).json.checks, []);
    assert.notEqual((await w.run(["fixes", "run", "woken-waits"], { tty: true, answers: ["1"] })).code, 0);
    assert.notEqual((await w.run(["fixes", "undo", "woken-waits"], { tty: true })).code, 0);
    assert.equal((await w.run(["check", "--json"])).json.findings.find((f: { code: string }) => f.code === "woken-wait"), undefined);
  } finally {
    w.cleanup();
  }
});
