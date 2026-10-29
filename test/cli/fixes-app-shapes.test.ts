// strom fixes app-shapes: what a strom before 1.22.0 wrote of a send of the Strom app that only gave a period as a range
// (FROM x TO y as BET x AND y) or an age without its units of nothing — a conflict of the user's edit, a fact added
// beside the research's same one, a lead's date or age changed — found, set right by rules (the person's, one operation
// and one commit) and put back; an edit beside it is never touched.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World } from "../helpers.ts";
import { opts } from "./sync.helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { changeLines } from "../../src/core/changelog.ts";
import type { Conflict, Event, Person } from "../../src/core/model.ts";
import type { SyncInput } from "../../src/core/sync.ts";

const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());
const eventOf = (w: World, id: string): Event => Tree.open(w.cwd, w.env).list<Person>("person").flatMap((p) => p.events).find((e) => e.id === id)!;
const conflictOf = (w: World, id: string): Conflict => Tree.open(w.cwd, w.env).get<Conflict>(id)!;
const decision = (w: World) => JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).fixes?.["app-shapes"]?.decision;

/**
 * The Lhotáks as an older strom left them after a send of the Strom app: the research said a fact roughly (ABT), the app
 * sent a range, the sync took it for the user's edit — then the research read the record and wrote the period it says.
 * E1 RESI (beside it E5, the send's own), E2 OCCU (conflict X1), E3 a lead's date, E4 a lead's age, E6 OCCU an edit of
 * another end (conflict X2: the user's own, never touched).
 */
async function lhotaci(app?: string): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Soupis obyvatel Lhoty 1871", "--kind", "census"]); // S1
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["event", "add", "P1", "RESI", "--date", "ABT 1871", "--place", "Lhota", "--house", "6", "--cite", "S1"]); // E1
  await w.ok(["event", "add", "P1", "OCCU", "--value", "nádeník", "--date", "ABT 1875", "--place", "Lhota", "--cite", "S1"]); // E2
  await w.ok(["event", "add", "P1", "OCCU", "--value", "dělník", "--date", "TO 8 AUG 1893", "--place", "Lhota"]); // E3, a lead
  await w.ok(["person", "add", "Ondřej /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["event", "add", "P2", "DEAT", "--date", "1901", "--place", "Lhota", "--age", "54y 0m 3d"]); // E4, a lead
  await w.ok(["event", "add", "P2", "OCCU", "--value", "chalupník", "--date", "ABT 1885", "--place", "Lhota", "--cite", "S1"]); // E5
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const sent = fs
    .readFileSync(ged, "utf8")
    .replace("2 DATE ABT 1875", "2 DATE BET 22 MAR 1871 AND 22 MAR 1882")
    .replace("2 DATE ABT 1885", "2 DATE BET 1 JAN 1880 AND 1 JAN 1890")
    .replace("2 DATE TO 8 AUG 1893", "2 DATE BEF 9 AUG 1893")
    .replace("2 AGE 54y 0m 3d", "2 AGE 54y 4d")
    .replace(/(1 RESI\n2 DATE ABT 1871\n(?:[2-9] .*\n)*)/, "$11 RESI\n2 DATE BET 22 MAR 1871 AND 22 MAR 1882\n2 PLAC Lhota\n2 ADDR čp. 6\n");
  const file = path.join(w.dir, "z-aplikace.ged");
  // the Strom app of this version, as its HEAD names it (1 SOUR STROM, 2 VERS)
  fs.writeFileSync(file, app ? sent.replace(/^1 SOUR STROM_RESEARCH\n2 VERS .*\n2 NAME .*\n/m, `1 SOUR STROM\n2 VERS ${app}\n2 NAME Strom\n`) : sent);
  // what the app sends now is the research's own (strom sync since 1.22.0): written here as an older strom took it
  await w.ok(["sync", file, "--apply"]);
  await w.ok(["event", "edit", "E1", "--date", "FROM 22 MAR 1871 TO 22 MAR 1882", "--reason", "the census"]);
  await w.ok(["event", "edit", "E2", "--date", "FROM 22 MAR 1871 TO 22 MAR 1882", "--reason", "the census"]);
  await w.ok(["event", "edit", "E3", "--date", "BEF 8 AUG 1893", "--reason", "the record"]);
  await w.ok(["event", "edit", "E4", "--age", "54y 3d", "--reason", "the record"]);
  await w.ok(["event", "edit", "E5", "--date", "FROM 1 JAN 1880 TO 1 JAN 1891", "--reason", "the census"]);
  return w;
}

test("strom fixes show app-shapes: the conflicts, facts and leads a sync took for edits — never an edit beside them", opts, async () => {
  const w = await lhotaci();
  try {
    const r = await w.ok(["fixes", "show", "app-shapes", "--lang", "en"]);
    assert.match(r.out, /Found: 4 things a sync wrote that differ from the research only so/);
    assert.match(r.out, /I0001 · E0006 added · P0001 · BET 22 MAR 1871 AND 22 MAR 1882, Lhota, house 6 = FROM 22 MAR 1871 TO 22 MAR 1882, Lhota, house 6/);
    assert.match(r.out, /I0001 · X0001 disagreement · P0001 · nádeník, FROM 22 MAR 1871 TO 22 MAR 1882, Lhota ↔ nádeník, BET 22 MAR 1871 AND 22 MAR 1882, Lhota/);
    assert.match(r.out, /I0001 · E0003 changed · P0001 · dělník, BEF 8 AUG 1893, Lhota → dělník, TO 8 AUG 1893, Lhota/);
    assert.match(r.out, /I0001 · E0004 changed · P0002 · 1901, Lhota, aged 54y 3d → 1901, Lhota, aged 54y 0m 3d/);
    assert.doesNotMatch(r.out, /chalupník|X0002/, "an edit of another end is the user's");
    const j = await w.ok(["fixes", "show", "app-shapes", "--json"]);
    assert.equal(j.json.found.count, 4);
    assert.equal(j.json.paid, false);
    assert.equal(j.json.remedy, "rewrite");
    assert.deepEqual(j.json.items.map((i: { kind: string }) => i.kind).sort(), ["added", "conflict", "corrected", "corrected"]);
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "app-shapes").state, "pending");
    // said in the research's language too
    assert.match((await w.ok(["fixes", "show", "app-shapes"])).out, /Nalezeno: 4 věci ze synchronizací/);
  } finally {
    w.cleanup();
  }
});

test("strom fixes run app-shapes: the person's — one operation and one commit; undo puts back exactly what the syncs left", opts, async () => {
  const w = await lhotaci();
  try {
    const before = ["E0001", "E0002", "E0003", "E0004", "E0005", "E0006"].map((id) => JSON.stringify(eventOf(w, id)));
    // an agent, a run nobody watches, --yes: never
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "run", "app-shapes"], { env })).code, 4, JSON.stringify(env));
    assert.notEqual((await w.run(["fixes", "run", "app-shapes", "--yes"], { tty: true, answers: ["1"] })).code, 0);
    assert.match((await w.ok(["fixes", "undo", "app-shapes", "--lang", "en"], { env: { STROM_NONINTERACTIVE: "1" } })).out, /Nothing to put back/);
    // later: nothing changed
    const n0 = commits(w);
    await w.ok(["fixes", "run", "app-shapes"], { tty: true, answers: [""] });
    assert.equal(commits(w), n0);
    const r = await w.ok(["fixes", "run", "app-shapes", "--lang", "en"], { tty: true, answers: ["1"] });
    assert.match(r.out, /Set right: 4 things in 3 records\./);
    assert.equal(commits(w), n0 + 1, "one commit");
    const tree = Tree.open(w.cwd, w.env);
    const ops = tree.readOps().filter((o) => o.op === "appshape.fix");
    assert.equal(ops.length, 1, "one operation");
    assert.ok(ops[0]!.files.some((f) => f.path.endsWith("app-shapes.json")), "what it changed kept with the operation");
    assert.ok(ops[0]!.files.some((f) => f.path === "strom.json"), "the decision in the same operation");
    assert.equal(decision(w), "fixed");
    const x1 = conflictOf(w, "X0001");
    assert.equal(x1.state, "resolved");
    assert.equal(x1.taken, "research");
    assert.match(x1.resolution!, /FROM 22 MAR 1871 TO 22 MAR 1882/);
    assert.equal(conflictOf(w, "X0002").state, "open", "the user's own edit stays");
    assert.equal(eventOf(w, "E0006").status, "retracted");
    assert.match(eventOf(w, "E0006").retracted!.reason, /E0001/);
    assert.equal(eventOf(w, "E0001").retracted, undefined);
    assert.equal(eventOf(w, "E0003").date, "TO 8 AUG 1893");
    assert.equal(eventOf(w, "E0004").age, "54y 0m 3d");
    assert.equal(JSON.stringify(eventOf(w, "E0005")), before[4], "the user's other end untouched");
    assert.equal((await w.run(["verify", "--json"])).code, 0, "sealed");
    const after = await w.ok(["fixes", "--json"]);
    assert.equal(after.json.checks.find((c: { id: string }) => c.id === "app-shapes").state, "fixed");
    // what the history says, in the research's language
    assert.deepEqual(changeLines(tree, ops, "", tree.lang).map((l) => l.text), ["Období a věky vrácené aplikací Strom vzaty tak, jak je má výzkum: 4"]);
    // a later change of one of them: kept by the undo
    await w.ok(["event", "edit", "E3", "--date", "TO 9 AUG 1893", "--reason", "read again"]);
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "undo", "app-shapes"], { env })).code, 4, JSON.stringify(env));
    const n1 = commits(w);
    const u = await w.ok(["fixes", "undo", "app-shapes", "--lang", "en"], { tty: true });
    assert.match(u.out, /Put back as the syncs left it: 3 things · 1 changed since, left as it is/);
    assert.equal(commits(w), n1 + 1);
    assert.equal(Tree.open(w.cwd, w.env).readOps().filter((o) => o.op === "appshape.unfix").length, 1);
    assert.equal(conflictOf(w, "X0001").state, "open");
    assert.equal(conflictOf(w, "X0001").resolution, undefined);
    for (const [i, id] of [[0, "E0001"], [3, "E0004"], [5, "E0006"]] as const) {
      const e = eventOf(w, id);
      assert.equal(JSON.stringify(e), before[i], `${id} exactly as the syncs left it`);
    }
    assert.equal(eventOf(w, "E0003").date, "TO 9 AUG 1893", "the change since kept");
    assert.equal(decision(w), "declined");
    assert.match((await w.ok(["fixes", "undo", "app-shapes", "--lang", "en"], { tty: true })).out, /Nothing to put back/);
  } finally {
    w.cleanup();
  }
});

test("strom fixes app-shapes in an archive: shown and set right by rules, nothing of an agent", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    const show = await w.ok(["fixes", "show", "app-shapes"]);
    assert.doesNotMatch(show.out, /agent|\bAI\b|umělá inteligence|Claude|Codex|\bmodel/i);
    const r = await w.ok(["fixes", "run"], { tty: true, answers: ["1"] });
    assert.doesNotMatch(r.out, /agent|\bAI\b|umělá inteligence|Claude|Codex|\bmodel/i);
    assert.equal(conflictOf(w, "X0001").state, "resolved");
    await w.ok(["fixes", "undo", "app-shapes"], { tty: true });
    assert.equal(conflictOf(w, "X0001").state, "open");
  } finally {
    w.cleanup();
  }
});

test("the research's fact a send withdrew for its own same one (sync.edits user) comes back, and goes again with the undo", opts, async () => {
  const w = new World();
  await w.withTree();
  try {
    await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
    await w.ok(["event", "add", "P1", "RESI", "--date", "FROM 22 MAR 1871 TO 22 MAR 1882", "--place", "Lhota", "--house", "6"]); // E1, a lead
    await w.ok(["event", "add", "P1", "BIRT", "--date", "1840", "--place", "Lhota"]); // E2
    const ged = path.join(w.dir, "strom.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
    const file = path.join(w.dir, "z-aplikace.ged");
    fs.writeFileSync(file, fs.readFileSync(ged, "utf8").replace("2 DATE 1840", "2 DATE 1841"));
    await w.ok(["config", "set", "sync.edits", "user"], { tty: true });
    await w.ok(["sync", file, "--apply"]);
    // the residence sent as a range and taken by an older strom for the user's word: the research's withdrawn, the
    // app's added — written here as that strom wrote it (its input's applied list)
    await w.ok(["event", "add", "P1", "RESI", "--date", "BET 22 MAR 1871 AND 22 MAR 1882", "--place", "Lhota", "--house", "6"]); // E3
    await w.ok(["event", "retract", "E1", "--reason", "the user's edit in the Strom app"]);
    const tree = Tree.open(w.cwd, w.env);
    tree.withTreeLock(() => {
      const input = structuredClone(tree.list<SyncInput>("input")[0]!);
      input.sync!.applied.push({ do: "event.retract", id: "E0001", before: "lead" }, { do: "event.add", id: "E0003" });
      tree.put(input, { op: "input.update", targets: [input.id], summary: "the send as an older strom wrote it" });
      tree.commit("The send as an older strom wrote it");
    });
    const e1 = JSON.stringify(eventOf(w, "E0001"));
    const e3 = JSON.stringify(eventOf(w, "E0003"));
    const j = await w.ok(["fixes", "show", "app-shapes", "--json"]);
    assert.deepEqual(j.json.items.map((i: { kind: string; event: string; beside?: string; restore?: boolean }) => [i.kind, i.event, i.beside, i.restore]), [["added", "E0003", "E0001", true]]);
    await w.ok(["fixes", "run", "app-shapes"], { tty: true, answers: ["1"] });
    assert.equal(eventOf(w, "E0003").status, "retracted");
    assert.equal(eventOf(w, "E0001").status, "lead", "the research's own back, as it was before the send");
    assert.equal(eventOf(w, "E0001").retracted, undefined);
    assert.equal(eventOf(w, "E0002").date, "1841", "the user's edit of another fact untouched");
    await w.ok(["fixes", "undo", "app-shapes"], { tty: true });
    assert.equal(JSON.stringify(eventOf(w, "E0003")), e3, "the app's back as the sync left it");
    assert.equal(eventOf(w, "E0001").status, "retracted", "the research's withdrawn again");
    assert.notEqual(JSON.stringify(eventOf(w, "E0001")), e1, "withdrawn by the undo, said so");
  } finally {
    w.cleanup();
  }
});

test("a send of an app that keeps a period and an age (3.17.0-beta.9 on) is never taken for the app's shape; an older app's is", opts, async () => {
  for (const [app, count] of [["3.17.0-beta.9", 0], ["3.17.0", 0], ["3.17.0-beta.8", 4]] as const) {
    const w = await lhotaci(app);
    try {
      const input = Tree.open(w.cwd, w.env).list<SyncInput>("input")[0]!;
      assert.ok(input.sync?.applied.length, `${app}: the send written`);
      assert.equal((await w.ok(["fixes", "show", "app-shapes", "--json"])).json.found.count, count, app);
    } finally {
      w.cleanup();
    }
  }
});

test("an age of nothing at all in any of its units that a sync changed to the app's 0y is put back", opts, async () => {
  const w = new World();
  await w.withTree();
  try {
    await w.ok(["person", "add", "Vendula /Lhotáková/", "--sex", "F"]); // P1
    await w.ok(["event", "add", "P1", "DEAT", "--date", "2 JAN 1868", "--place", "Lhota", "--age", "0y 0m 0d"]); // E1, a lead
    const ged = path.join(w.dir, "strom.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
    const file = path.join(w.dir, "z-aplikace.ged");
    fs.writeFileSync(file, fs.readFileSync(ged, "utf8").replace("2 AGE 0y 0m 0d", "2 AGE 1d"));
    await w.ok(["sync", file, "--apply"]);
    // an older strom took the app's 0y for the user's edit: written here as it left it
    await w.ok(["event", "edit", "E1", "--age", "0y", "--reason", "the record"]);
    const j = await w.ok(["fixes", "show", "app-shapes", "--json"]);
    assert.deepEqual(j.json.items.map((i: { kind: string; event: string }) => [i.kind, i.event]), [["corrected", "E0001"]]);
    await w.ok(["fixes", "run", "app-shapes"], { tty: true, answers: ["1"] });
    assert.equal(eventOf(w, "E0001").age, "0y 0m 0d");
  } finally {
    w.cleanup();
  }
});
