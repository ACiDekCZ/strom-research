// Verification of facts against their originals (spec 065): the sweep and the fix verify-originals (K6.1, K6.2, K6.6,
// K6.8), the queue (K6.3, K3.2), the person's "verify" of a person or a fact (K6.4, K2.1, K6.7), the bulk verification
// (K3.1), the agent's result (K6.2, K2.2: nothing proven without a look at the original), the person's confirmation
// against the scan (K4.1, K4.2, K2.3: the person's word never overwritten), the counts (K6.9) and an archive (K6.10).
// Made-up people (Lhoták, Lhota), diacritics in NFD as typed on a Mac, a place in Cyrillic.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { now, Tree } from "../../src/core/tree.ts";
import { emptyFunnel, queueVerify, settleVerify, VERIFY_FILE, VERIFY_SETTLED, verifyCandidates, verifyCounts, verifyFixes } from "../../src/core/verify.ts";
import { VERIFY_EVERY } from "../../src/core/verifyfacts.ts";
import { PROVEN_SETTLED, settleProven } from "../../src/core/provenfix.ts";
import type { Event, Family, Person, Session, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

const AGENT = { CLAUDECODE: "1" };
const APP = { STROM_FOR_APP: "1" };

const open = (w: World) => Tree.open(w.cwd, w.env);
const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());
const tasks = (w: World, origin?: string) => open(w).list<Task>("task").filter((t) => !origin || t.origin === origin);
const openTasks = (w: World, origin: string) => tasks(w, origin).filter((t) => t.state === "open" || t.state === "doing");
const fact = (w: World, id: string): Event => {
  const tree = open(w);
  for (const o of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
    const e = o.events.find((x) => x.id === id);
    if (e) return e;
  }
  throw new Error(`no fact ${id}`);
};
const verifyFile = (w: World) => JSON.parse(fs.readFileSync(path.join(w.cwd, ...VERIFY_FILE.split("/")), "utf8"));

/** A fact added; its ID. */
async function add(w: World, owner: string, kind: string, ...more: string[]): Promise<string> {
  return (await w.ok(["event", "add", owner, kind, ...more, "--json"])).json.event.id as string;
}

/**
 * Two lines: the ancestors of Jan Lhoták (G0001: Jan P1, his parents Josef P2 and Marie P3, Josef's father Václav P5)
 * and the ancestors of Eva (G0002), Jan's daughter born 1990: most likely alive. Josef's sister Anna (P4) and her
 * husband Karel (P6): a side branch of no line. Vojtěch Lhotecký (P7), a godfather nothing links to the tree.
 * Registers of Lhota (B0001, no images here), originals with primary information S1–S6, an index S7 (no original).
 */
async function lhotaci(o: { older?: boolean } = {}) {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1880"]); // P1
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"]); // P4
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P5
  await w.ok(["person", "add", "Karel /Lhotský/", "--sex", "M"]); // P6
  await w.ok(["person", "add", "Vojtěch /Lhotecký/", "--sex", "M"]); // P7
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", "1990"]); // P8
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]); // F1
  await w.ok(["family", "add", "--partner", "P5", "--child", "P2", "--child", "P4"]); // F2
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P6"]); // F3
  await w.ok(["family", "add", "--partner", "P1", "--child", "P8"]); // F4
  await w.ok(["research", "new", "Předci Evy", "--person", "P8"]); // G0002: Eva, alive, on a line
  await w.ok(["repo", "add", "Archiv Lhota", "--automation", "manual"]);
  await w.ok(["recordset", "add", "Lhota 1, N O Z 1840-1995", "--repo", "R1", "--kinds", "baptism,marriage,death", "--places", "Lhota", "--years", "1840-1995", "--access", "online-free"]); // B1
  const original = (title: string, kind: string) => ["source", "add", title, "--kind", kind, "--recordset", "B0001", "--locator", "fol. 1", "--information", "primary"];
  await w.ok(original("Křest Josefa Lhotáka 1850", "baptism")); // S1
  await w.ok(original("Úmrtí Josefa Lhotáka 1910", "death")); // S2
  await w.ok(original("Oddavky Josefa a Marie 1875", "marriage")); // S3
  await w.ok(original("Křest Anny Lhotákové 1852", "baptism")); // S4
  await w.ok(original("Křest Vojtěcha Lhoteckého 1840", "baptism")); // S5
  await w.ok(original("Křest Evy Lhotákové 1990", "baptism")); // S6
  await w.ok(["source", "add", "Index křtů Lhota", "--kind", "index", "--information", "primary"]); // S7, no original
  const cite = (s: string) => ["--cite", s, "--locator", "fol. 1"];
  const f = {
    josefBirth: await add(w, "P2", "BIRT", "--date", "1850", "--place", "Lhota", ...cite("S0001")),
    josefDeath: await add(w, "P2", "DEAT", "--date", "1910", "--place", "Лхота", ...cite("S0002")), // a place in Cyrillic
    marriage: await add(w, "F1", "MARR", "--date", "1875", "--place", "Lhota", ...cite("S0003")),
    annaBirth: await add(w, "P4", "BIRT", "--date", "1852", "--place", "Lhota", ...cite("S0004")), // a side branch
    godfatherBirth: await add(w, "P7", "BIRT", "--date", "1840", "--place", "Lhota", ...cite("S0005")), // off the tree
    evaBirth: await add(w, "P8", "CHR", "--date", "1990", "--place", "Lhota", ...cite("S0006")), // alive
    vaclavJob: await add(w, "P5", "OCCU", "--value", "sedlák", ...cite("S0001")), // no kind the sweep verifies
    vaclavBirth: await add(w, "P5", "BIRT", "--date", "1820", "--place", "Lhota", "--cite", "S0007"), // an index: no original
  };
  if (o.older) {
    // as an older strom left it: the fix not run here
    const tree = open(w);
    tree.withTreeLock(() => {
      tree.updateConfig((c) => void (c.settled = (c.settled ?? []).filter((x) => x !== VERIFY_SETTLED)), { op: "tree.settle", summary: "as an older strom left it" });
      tree.commit("As an older strom left it");
    });
  }
  return { w, f };
}

/** Sessions of the agent ended on a task, written as strom writes them (the queue counts them; the estimate reads their cost). */
function ended(w: World, task: string, n: number, costUsd?: number): void {
  const tree = open(w);
  tree.withTreeLock(() => {
    for (let i = 0; i < n; i++) {
      const id = tree.allocate("N");
      const at = now();
      tree.put({ id, type: "session", task, state: "closed", started: at, ended: at, created: at, updated: at, notes: [], ...(costUsd !== undefined ? { metrics: { costUsd } } : {}) } as Session, {
        op: "session.close",
        targets: [id],
        summary: `${id} closed`,
      });
    }
    tree.commit("Sessions ended");
  });
}

test("K6.1, K6.6, K6.8: the fix verify-originals — one task per person, a marriage one per family; off the tree, a side branch, the living, no original, other kinds left; undo; a second run queues nothing", opts, async () => {
  const { w, f } = await lhotaci({ older: true });
  try {
    // what the fix would do, before it runs: the three facts of linked people with their original cited
    assert.deepEqual(
      verifyFixes(open(w)).map((i) => i.event).sort(),
      [f.josefBirth, f.josefDeath, f.marriage].sort(),
    );
    const funnel = emptyFunnel();
    verifyCandidates(open(w), funnel);
    assert.deepEqual(
      { offTree: funnel.offTree, sideBranch: funnel.sideBranch, living: funnel.living, candidates: funnel.candidates },
      { offTree: 1, sideBranch: 1, living: 1, candidates: 3 },
      "the godfather off the tree, Anna's side branch, Eva alive",
    );
    const show = await w.ok(["fixes", "show", "verify-originals", "--json"]);
    assert.ok(JSON.stringify(show.json).includes(f.marriage), "strom fixes show lists the facts");
    // the fix, as at the first start of this strom: one commit, the marker
    const n = commits(w);
    assert.deepEqual(settleVerify(open(w)), { facts: 3, people: 2 }, "Josef's two facts, the marriage of Josef and Marie");
    assert.equal(commits(w), n + 1, "one commit");
    assert.ok(open(w).config.settled?.includes(VERIFY_SETTLED));
    const made = openTasks(w, "verify:auto");
    assert.equal(made.length, 2, "one task for Josef, one for the family — not one per partner");
    const josef = made.find((t) => t.subject[0] === "P0002")!;
    const family = made.find((t) => t.subject[0] === "F0001")!;
    assert.deepEqual(josef.where.sort(), [f.josefBirth, f.josefDeath].sort());
    assert.deepEqual(family.where, [f.marriage]);
    assert.equal(josef.level, "verify");
    assert.equal(josef.priority, 1);
    assert.match(josef.what, /Josef Lhoták/);
    assert.deepEqual(verifyFile(w).fix.facts, 3);
    // strom fixes show once it ran by itself: what it queued, its examples — not "nothing found"
    const shown = await w.ok(["fixes", "show", "verify-originals", "--json"]);
    assert.equal(shown.json.state, "fixed");
    assert.equal(shown.json.found.count, 3);
    assert.deepEqual(shown.json.done, { facts: 3, people: 2, tasks: 2, at: verifyFile(w).fix.at });
    assert.deepEqual(shown.json.items.map((i: { event: string }) => i.event).sort(), [f.josefBirth, f.josefDeath, f.marriage].sort());
    const said = await w.ok(["fixes", "show", "verify-originals"]);
    assert.match(said.out, /Nalezeno: 3 údaje s citací originálu/u);
    assert.ok(said.out.includes(f.marriage), "an example");
    assert.match(said.out, /Zařazeno: 3 údaje ve? 2 úkolech/u);
    assert.doesNotMatch(said.out, /Nalezeno: nic/u);
    const listed = (await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "verify-originals");
    assert.equal(listed.state, "fixed", "nothing of it waits");
    // nothing for the rest, whatever runs again
    for (const t of openTasks(w, "verify:auto")) for (const e of [f.annaBirth, f.godfatherBirth, f.evaBirth, f.vaclavJob, f.vaclavBirth]) assert.ok(!t.where.includes(e));
    // a second run: nothing new (the marker), and the sweep finds every fact queued
    assert.equal(settleVerify(open(w)), undefined);
    assert.deepEqual(queueVerify(open(w)).tasks, []);
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    assert.equal(tasks(w, "verify:auto").length, 2, "no duplicate after the planning of a session");
    // undo: the person's alone; the tasks nobody started dropped, the facts as they were
    assert.equal((await w.run(["fixes", "undo", "verify-originals"], { env: AGENT })).code, 4);
    const before = fact(w, f.josefBirth);
    await w.ok(["fixes", "undo", "verify-originals"], { tty: true });
    assert.equal(openTasks(w, "verify:auto").length, 0, "no open task of the fix");
    assert.ok(tasks(w, "verify:auto").every((t) => t.state === "dropped"));
    assert.deepEqual(fact(w, f.josefBirth), before);
    assert.equal(verifyFile(w).fix, undefined);
    // …and not queued again by itself after the undo (by hand still)
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    assert.equal(openTasks(w, "verify:auto").length, 0);
  } finally {
    w.cleanup();
  }
});

test("K6.1, K6.8, K6.10: an archive and a research waiting for its agent get no task — the marker alone; the person's confirmation goes on there", opts, async () => {
  const { w, f } = await lhotaci({ older: true });
  try {
    // a research waiting for its agent (no agent on this computer): nothing, not even the marker
    const noAgent = { ...w.env, PATH: path.dirname(process.execPath) };
    assert.equal(settleVerify(Tree.open(w.cwd, noAgent)), undefined);
    assert.ok(!open(w).config.settled?.includes(VERIFY_SETTLED));
    assert.deepEqual(queueVerify(Tree.open(w.cwd, noAgent)).tasks, []);
    // an archive: the marker alone
    await w.ok(["mode", "archive"], { tty: true });
    assert.deepEqual(settleVerify(open(w)), { facts: 0, people: 0 });
    assert.ok(open(w).config.settled?.includes(VERIFY_SETTLED));
    assert.equal(tasks(w).filter((t) => t.origin?.startsWith("verify:")).length, 0);
    assert.deepEqual(verifyCandidates(open(w)), []);
    // the agent's verify refused there (K6.10: no promise of what does not run here)
    const asked = await w.run(["verify", "facts", "P0002"]);
    assert.notEqual(asked.code, 0);
    assert.equal((await w.run(["verify", "bulk", "--scope", "tree", "--dry-run"])).code === 0, false);
    // the person's confirmation against the scan is theirs, also in an archive
    await w.ok(["verify", "confirm", f.josefBirth], { env: APP });
    assert.equal(fact(w, f.josefBirth).confirmed?.by, "user");
    const status = await w.ok(["verify", "status"]);
    assert.doesNotMatch(status.out, /agent|AI|ověří|čeká/iu, "an archive says nothing of an agent");
    assert.deepEqual((await w.ok(["verify", "status", "--json"])).json, { confirmed: 1, kept: 0 });
  } finally {
    w.cleanup();
  }
});

test("K6.2, K6.8: a new fact with its original cited gets the same verification after the planning; kept with the reason it is not queued again until a new original is cited; a task closed with no result neither", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    // a new research: settled from the start; the planning of a session queues the facts (once)
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    const first = openTasks(w, "verify:auto");
    assert.equal(first.length, 2);
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    assert.equal(tasks(w, "verify:auto").length, 2, "no duplicate");
    // the agent's result: kept, with the reason (typed on a Mac: NFD) — stored in NFC
    const josef = first.find((t) => t.subject[0] === "P0002")!;
    const s = (await w.ok(["session", "start", josef.id, "--json"])).json.session.id as string;
    const inSession = { STROM_SESSION: s };
    const reason = "Čtení data nejisté, zápis poškozený".normalize("NFD");
    await w.ok(["verify", "done", f.josefBirth, "--kept", "--reason", reason], { env: inSession });
    const kept = fact(w, f.josefBirth);
    assert.equal(kept.status, "probable", "kept: the status as it was");
    assert.equal(kept.verified?.result, "kept");
    assert.equal(kept.verified?.reason, reason.normalize("NFC"));
    assert.equal(kept.verified?.task, josef.id);
    assert.equal(kept.verified?.by, s);
    assert.deepEqual(kept.verified?.cites, ["S0001"]);
    assert.equal(open(w).get<Task>(josef.id)!.state, "doing", "one fact of two: the task goes on");
    await w.ok(["verify", "done", f.josefDeath, "--kept", "--reason", "Не читается"], { env: inSession }); // another script
    assert.equal(open(w).get<Task>(josef.id)!.state, "done", "every fact with its result: done");
    await w.ok(["session", "close", "--summary", "ověřeno", "--next", "nic"], { env: inSession });
    // not again by itself (no loop)
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    assert.ok(!openTasks(w, "verify:auto").some((t) => t.where.includes(f.josefBirth)));
    // a task dropped with no result: not again by itself either
    const family = first.find((t) => t.subject[0] === "F0001")!;
    await w.ok(["task", "drop", family.id, "--reason", "kniha nedostupná"]);
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    assert.ok(!openTasks(w, "verify:auto").some((t) => t.where.includes(f.marriage)));
    // a new citation of an original: queued again
    await w.ok(["source", "add", "Křest Josefa Lhotáka, druhý zápis", "--kind", "baptism", "--recordset", "B0001", "--locator", "fol. 9", "--information", "primary"]); // S8
    await w.ok(["cite", f.josefBirth, "S0008", "--locator", "fol. 9"]);
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    const again = openTasks(w, "verify:auto").filter((t) => t.where.includes(f.josefBirth));
    assert.equal(again.length, 1, "a new original: verified again");
    assert.ok(!again[0]!.where.includes(f.josefDeath), "the other fact kept stays out");
    // …and the value of a fact changed: its verification goes with the value (A1b)
    await w.ok(["event", "edit", f.josefDeath, "--date", "1911", "--cite", "S0002", "--locator", "fol. 1", "--reason", "zápis uvádí 1911"]);
    assert.equal(fact(w, f.josefDeath).verified, undefined, "a new value is not verified");
  } finally {
    w.cleanup();
  }
});

test("K6.8: a fact the person lowered in the review of proven-originals is not queued — until it cites an original", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]); // P1
    await w.ok(["source", "add", "Opis křtu Jana Lhotáka", "--kind", "baptism", "--form", "derivative", "--information", "primary"]); // S1
    // the user's proven on a copy, as an older strom let it
    const tree = open(w);
    tree.actor = "user";
    let id = "";
    tree.withTreeLock(() => {
      const p = tree.get<Person>("P0001")!;
      id = tree.allocate("E");
      tree.put({ ...p, events: [...p.events, { id, kind: "BIRT", date: "1850", status: "proven", citations: [{ source: "S0001" }] } as Event], updated: now() }, { op: "event.add", targets: [id, "P0001"], summary: `${id} proven` });
      tree.updateConfig((c) => void (c.settled = (c.settled ?? []).filter((x) => x !== PROVEN_SETTLED)), { op: "tree.settle", summary: "older" });
      tree.commit("older");
    });
    settleProven(open(w));
    await w.ok(["fixes", "review", "proven-originals", "lower", id], { tty: true });
    assert.equal(fact(w, id).status, "probable");
    assert.deepEqual(verifyFile(w).skip, { [id]: [] }, "kept out with the originals it cited then: none");
    await w.ok(["frontier", "--apply"]);
    assert.equal(tasks(w, "verify:auto").length, 0);
    // an original cited since: verified as any other
    await w.ok(["recordset", "add", "Lhota 1", "--kinds", "baptism", "--places", "Lhota", "--years", "1840-1900"]);
    await w.ok(["source", "add", "Křest Jana Lhotáka 1850", "--kind", "baptism", "--recordset", "B0001", "--locator", "fol. 3", "--information", "primary"]); // S2
    await w.ok(["cite", id, "S0002", "--locator", "fol. 3"]);
    await w.ok(["frontier", "--apply"]);
    assert.deepEqual(openTasks(w, "verify:auto").map((t) => t.where), [[id]]);
  } finally {
    w.cleanup();
  }
});

test("K6.3, K3.2: the sweep's tasks come after the lines' work, one in VERIFY_EVERY sessions forward — the nearest ancestor first", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    const line = (await w.ok(["task", "add", "Křest Marie", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "zápis", "--about", "P3", "--priority", "1", "--json"])).json.task.id as string;
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    const verify = openTasks(w, "verify:auto");
    assert.equal(verify.length, 2);
    const order = async () => ((await w.ok(["task", "list", "--json"])).json.tasks as { id: string; why: string }[]);
    const before = await order();
    const at = (id: string, list: { id: string }[]) => list.findIndex((t) => t.id === id);
    for (const t of verify) assert.ok(at(t.id, before) > at(line, before), `${t.id} after the lines' work: ${before.map((x) => x.id)}`);
    assert.match(before.find((t) => t.id === verify[0]!.id)!.why, /after the lines' work, one in 5 sessions/);
    // VERIFY_EVERY sessions on the lines' work: one comes forward — Josef (generation 1) before the couple's? both gen 1: the older
    ended(w, line, VERIFY_EVERY);
    const after = await order();
    const first = after[0]!;
    assert.ok(verify.some((t) => t.id === first.id), `a verification first now: ${after.map((x) => x.id)}`);
    assert.match(first.why, /its turn, 5 sessions since the last one on it/);
    // one session on it: back after the lines' work
    ended(w, first.id, 1);
    const later = await order();
    assert.ok(at(line, later) < at(verify.find((t) => t.id !== first.id)!.id, later));
    assert.ok(f.josefBirth);
  } finally {
    w.cleanup();
  }
});

test("K6.4, K2.1, K6.7, K6.6: the person's verify of a person or a fact — first in the queue with the estimate, nothing doubled; a fact of a family tree looked for; off the tree too; the living only when asked", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    // a fact from another program's family tree: a lead, looked for by its citation (dearer)
    await w.ok(["source", "add", "Rodokmen od tety", "--kind", "family-tree", "--form", "authored"]); // S8
    const residence = await add(w, "P2", "RESI", "--place", "Lhota", "--cite", "S0008", "--locator", "str. 12");
    assert.equal(fact(w, residence).status, "lead");
    // a measured session for the estimate
    const any = (await w.ok(["task", "add", "Křest Marie", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "zápis", "--about", "P3", "--json"])).json.task.id as string;
    ended(w, any, 1, 2);
    // dry: what it would queue and the estimate, nothing written
    const n = commits(w);
    const dry = (await w.ok(["verify", "facts", "P0002", "--dry-run", "--json"])).json;
    assert.equal(commits(w), n);
    assert.deepEqual(dry.tasks, []);
    const how = Object.fromEntries((dry.facts as { fact: string; how: string }[]).map((x) => [x.fact, x.how]));
    assert.equal(how[f.josefBirth], "read");
    assert.equal(how[f.marriage], "read", "his marriage too");
    assert.equal(how[residence], "search", "no original read: looked for");
    assert.equal(dry.estimate.sessions, 4, "P2's reads, the family's read, the search twice");
    assert.equal(dry.estimate.usd, 8);
    // asked: first in the queue
    const asked = (await w.ok(["verify", "facts", "P0002", "--json"])).json;
    const next = (await w.ok(["task", "next", "--json"])).json.task.id;
    const ids = (asked.tasks as { task: string }[]).map((t) => t.task);
    assert.ok(ids.includes(next), `${next} first: one of ${ids}`);
    // a research with no scans of its registers here (Dotazy 2 of the app, 1): every task waits for them — its state said,
    // no place in the queue, the first one's on top
    assert.deepEqual(
      (asked.tasks as { state: string; position?: number }[]).map((t) => [t.state, t.position]),
      ids.map(() => ["images", undefined]),
      JSON.stringify(asked.tasks),
    );
    assert.deepEqual([asked.task, asked.state, asked.position], [ids[0], "images", undefined]);
    const made = ids.map((id) => open(w).get<Task>(id)!);
    assert.deepEqual(made.map((t) => t.origin).sort(), ["verify:asked", "verify:asked", "verify:search"]);
    const search = made.find((t) => t.origin === "verify:search")!;
    assert.equal(search.level, "link");
    assert.deepEqual(search.where, [residence]);
    // again: the same tasks first, nothing doubled
    const twice = (await w.ok(["verify", "facts", "--fact", f.josefBirth, "--json"])).json;
    assert.ok(ids.includes(twice.task));
    assert.deepEqual(twice.tasks.map((t: { task: string; facts: string[] }) => [t.task, t.facts.includes(f.josefBirth)]), [[twice.task, true]]);
    assert.equal(tasks(w).filter((t) => t.origin?.startsWith("verify:")).length, 3);
    // the sweep leaves what a task of the person holds
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    assert.ok(!tasks(w, "verify:auto").some((t) => t.where.includes(f.josefBirth)));
    // off the tree and on a side branch: by hand all the same (K6.6)
    assert.equal((await w.ok(["verify", "facts", "P0007", "--json"])).json.facts[0].fact, f.godfatherBirth);
    assert.equal((await w.ok(["verify", "facts", "--fact", f.annaBirth, "--json"])).json.facts.length, 1);
    // the living: the family's to tell — an agent gets the hint, --living when the user said yes
    const alive = await w.run(["verify", "facts", "P0008"], { env: AGENT });
    assert.notEqual(alive.code, 0);
    assert.match(alive.err, /--living/);
    const living = (await w.ok(["verify", "facts", "P0008", "--living", "--json"], { env: AGENT })).json;
    assert.ok((living.facts as { fact: string }[]).some((x) => x.fact === f.evaBirth));
    // a name typed on a Mac (NFD) finds the person
    const byName = (await w.ok(["verify", "facts", "Josef Lhoták".normalize("NFD"), "--dry-run", "--json"])).json;
    assert.ok((byName.facts as { fact: string }[]).some((x) => x.fact === f.josefBirth));
    // K6.7: a birth from another program's family tree is a lead — the sweep leaves it to the lines' work
    const leadBirth = await add(w, "P3", "BIRT", "--date", "1855", "--place", "Лхота", "--cite", "S0008", "--locator", "str. 3");
    assert.equal(fact(w, leadBirth).status, "lead");
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    assert.ok(!tasks(w).some((t) => t.where.includes(leadBirth)), "no task of the sweep for a lead");
    // what waits, for the overview and the app (K6.9)
    const c = verifyCounts(open(w));
    assert.ok(c.asked >= 5, `asked ${c.asked}`);
  } finally {
    w.cleanup();
  }
});

test("K3.1–K3.3: the bulk verification — the person's (an agent only a dry run), a line, a lineage, the tree; a try first; nobody living; low priority", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    const n = commits(w);
    const agentDry = (await w.ok(["verify", "bulk", "--scope", "tree", "--dry-run", "--json"], { env: AGENT })).json;
    assert.equal(commits(w), n, "a dry run writes nothing");
    assert.deepEqual([agentDry.people, agentDry.facts, agentDry.tasks], [2, 4, []], `Josef with the marriage, Anna — the godfather off the tree, Eva alive left: ${JSON.stringify(agentDry)}`);
    assert.deepEqual(agentDry.how, { read: 4, search: 0 }, "Václav's birth cites an index of the research's own, no family tree's: not looked for in bulk");
    const refused = await w.run(["verify", "bulk", "--scope", "tree"], { env: AGENT });
    assert.notEqual(refused.code, 0, "an agent does not start the bulk verification");
    assert.equal(tasks(w, "verify:bulk").length, 0);
    // the line of Jan: Josef and the family of Josef and Marie (Anna's side branch is no ancestor of Jan)
    const line = (await w.ok(["verify", "bulk", "--scope", "line", "--of", "G0001", "--dry-run", "--json"], { tty: true })).json;
    assert.deepEqual([line.people, line.facts], [1, 3], JSON.stringify(line));
    // a lineage: Václav and who carries it on through the sons — Josef, Anna, Jan, not Eva (alive)
    const lineage = (await w.ok(["verify", "bulk", "--scope", "lineage", "--of", "P0005", "--dry-run", "--json"], { tty: true })).json;
    assert.deepEqual([lineage.people, lineage.facts], [2, 4], `Josef with the marriage, Anna: ${JSON.stringify(lineage)}`);
    // a try on one person, then the rest; the nearest ancestor first (Josef with his marriage, then his sister)
    const first = (await w.ok(["verify", "bulk", "--scope", "tree", "--try", "1", "--json"], { tty: true })).json;
    assert.deepEqual([first.people, first.tasks.length, first.left], [1, 2, 1], JSON.stringify(first));
    const made = first.tasks.map((id: string) => open(w).get<Task>(id)!);
    assert.deepEqual(made.map((t: Task) => t.subject[0]).sort(), ["F0001", "P0002"]);
    assert.ok(made.every((t: Task) => t.origin === "verify:bulk" && (t.priority ?? 0) <= 1), "low priority, in turn after the lines' work");
    const rest = (await w.ok(["verify", "bulk", "--scope", "tree", "--json"], { tty: true })).json;
    assert.deepEqual([rest.people, rest.tasks.length], [1, 1], "what the try took is not doubled");
    assert.equal(open(w).get<Task>(rest.tasks[0])!.subject[0], "P0004");
    assert.ok(!tasks(w, "verify:bulk").some((t) => t.where.includes(f.evaBirth)));
    assert.equal(tasks(w, "verify:bulk").flatMap((t) => t.where).length, 4);
  } finally {
    w.cleanup();
  }
});

/**
 * A family tree of another program: Jan Lhoták (I1, born 1841, died in a place written in Cyrillic) and Anna (I2, her
 * name in NFD as typed on a Mac) married 1865, an occupation of Jan's, their daughter Eva (I3) born 1990: most likely alive.
 */
const FAMILY_TREE = [
  "0 HEAD", "1 SOUR MyHeritage", "2 NAME MyHeritage Family Tree Builder", "2 VERS 8.0", "1 CHAR UTF-8",
  "0 @I1@ INDI", "1 NAME Jan /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 12 MAR 1841", "2 PLAC Lhota", "1 DEAT", "2 DATE 1900", "2 PLAC Лхота", "1 OCCU rolník", "1 FAMS @F1@",
  "0 @I2@ INDI", "1 NAME Anna /Lhotáková/".normalize("NFD"), "1 SEX F", "1 BIRT", "2 DATE 1845", "2 PLAC Horní Lhota", "1 FAMS @F1@",
  "0 @I3@ INDI", "1 NAME Eva /Lhotáková/", "1 SEX F", "1 BIRT", "2 DATE 1990", "2 PLAC Lhota", "1 FAMC @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@", "1 MARR", "2 DATE 1865", "2 PLAC Lhota",
  "0 TRLR", "",
].join("\n");

test("K6.7, K4.1 (Dotazy 2 of the app, 3): a fresh research of an imported family tree — the bulk verification looks for the records of its leads (how: search, dearer), after the lines' work; a dry run counts them; nobody living, nothing doubled; the brief says the search", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    const file = path.join(w.dir, "lhotakovi.ged");
    fs.writeFileSync(file, FAMILY_TREE);
    await w.ok(["intake", file], { env: AGENT });
    const people = Object.fromEntries(open(w).list<Person>("person").map((p) => [p.names[0]!.given, p]));
    const leads = [...open(w).list<Person>("person"), ...open(w).list<Family>("family")].flatMap((o) => o.events).filter((e) => ["BIRT", "DEAT", "MARR"].includes(e.kind));
    assert.ok(leads.length >= 5 && leads.every((e) => e.origin?.by === "import"), "the family tree's facts are the import's");
    // a dry run (an agent's too): the counts, the search dearer, nothing written
    const n = commits(w);
    const dry = (await w.ok(["verify", "bulk", "--scope", "tree", "--dry-run", "--json"], { env: AGENT })).json;
    assert.equal(commits(w), n, "a dry run writes nothing");
    assert.deepEqual([dry.people, dry.facts, dry.how, dry.left], [2, 4, { read: 0, search: 4 }, 0], `Jan with the marriage, Anna — Eva alive, the occupation no kind verified: ${JSON.stringify(dry)}`);
    assert.equal(dry.estimate.sessions, 6, "three searches of two sessions each: Jan's, the couple's, Anna's");
    const shown = (await w.ok(["verify", "bulk", "--scope", "tree", "--dry-run"], { env: AGENT })).out;
    assert.match(shown, /z toho 4 údaje z importovaného rodokmenu bez přečteného originálu/u);
    // the person starts it: a task per person and the couple, of the bulk, its record looked for — low priority
    await w.ok(["repo", "add", "Archiv Lhota", "--automation", "manual"], { env: AGENT });
    await w.ok(["recordset", "add", "Lhota 1, N O Z 1840-1910", "--repo", "R0001", "--kinds", "baptism,marriage,death", "--places", "Lhota", "--years", "1840-1910", "--access", "online-free"], { env: AGENT });
    const line = (await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "zápis", "--about", people.Jan!.id, "--priority", "1", "--json"], { env: AGENT })).json.task.id as string;
    const r = (await w.ok(["verify", "bulk", "--scope", "tree", "--json"], { tty: true })).json;
    assert.deepEqual([r.people, r.facts, r.how, r.tasks.length], [2, 4, { read: 0, search: 4 }, 3], JSON.stringify(r));
    const made = (r.tasks as string[]).map((id) => open(w).get<Task>(id)!);
    assert.ok(made.every((t) => t.origin === "verify:bulk" && t.level === "link" && t.priority <= 1 && !t.queueAt), "the bulk's: low priority, in turn");
    assert.ok(!made.some((t) => t.where.some((id) => people.Eva!.events.some((e) => e.id === id))), "nobody living");
    assert.match(made[0]!.why, /hromadné ověření: údaje pocházejí z importovaného rodokmenu/u);
    // after the lines' work
    const order = ((await w.ok(["task", "list", "--json"])).json.tasks as { id: string }[]).map((t) => t.id);
    for (const t of made) assert.ok(order.indexOf(t.id) > order.indexOf(line), `${t.id} after the lines' work: ${order}`);
    // the brief: the search for the record the citation names, not a look at an original
    const brief = (await w.ok(["brief", made[0]!.id], { env: AGENT })).out;
    assert.match(brief, /How \(no original of these facts was read/, brief);
    // again: nothing doubled — nothing left to verify
    const again = await w.run(["verify", "bulk", "--scope", "tree", "--dry-run", "--json"], { env: AGENT });
    assert.notEqual(again.code, 0);
    assert.match(again.out + again.err, /verify\.nothing|nothing to verify/u);
  } finally {
    w.cleanup();
  }
});

test("K6.2, K2.2: the agent's result — proven only with an image of the original looked at, inside a session; two readers; a confirmed fact is the person's", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    const josef = openTasks(w, "verify:auto").find((t) => t.subject[0] === "P0002")!;
    // the transcript of Josef's baptism made in an earlier session by another model
    const other = (await w.ok(["task", "add", "Křest Josefa", "--level", "link", "--where", "B0001", "--why", "přepis", "--done-when", "zápis", "--about", "P2", "--json"])).json.task.id as string;
    const earlier = (await w.ok(["session", "start", other, "--json"], { env: { STROM_MODEL: "claude-sonnet-x" } })).json.session.id as string;
    await w.ok(["source", "edit", "S0001", "--transcript", "Josef, syn Václava Lhotáka"], { env: { STROM_SESSION: earlier, STROM_MODEL: "claude-sonnet-x" } });
    await w.ok(["session", "close", "--summary", "přepsáno", "--next", "nic", "--continue"], { env: { STROM_SESSION: earlier } });
    // outside a session: refused
    const outside = await w.run(["verify", "done", f.josefBirth, "--proven", "--image", "B0001:3"]);
    assert.notEqual(outside.code, 0);
    assert.match(outside.err, /session/u);
    const s = (await w.ok(["session", "start", josef.id, "--json"], { env: { STROM_MODEL: "claude-opus-x" } })).json.session.id as string;
    const inSession = { STROM_SESSION: s, STROM_MODEL: "claude-opus-x" };
    const refuse = async (args: string[], code: string) => {
      const r = await w.run(["verify", "done", ...args, "--json"], { env: inSession });
      assert.notEqual(r.code, 0, args.join(" "));
      assert.match(r.out + r.err, new RegExp(code.replace(".", "\\."), "u"), `${args.join(" ")}: ${r.out}${r.err}`);
    };
    await refuse([f.josefBirth, "--proven"], "verify.image"); // no look, no proof
    await refuse([f.josefBirth, "--proven", "--image", "B0002:3"], "verify.image"); // another book's image
    await refuse([f.josefBirth, "--proven", "--image", "B0001"], "verify.image"); // no page
    await refuse([f.josefBirth, "--kept"], "verify.reason");
    await refuse([f.vaclavBirth, "--proven", "--image", "B0001:3"], "verify.original"); // an index: no original
    assert.equal(fact(w, f.josefBirth).status, "probable", "nothing raised");
    // the original's page looked at: proven; the source read by the person, the session's model another reader
    const done = (await w.ok(["verify", "done", f.josefBirth, "--proven", "--image", "B0001:3", "--json"], { env: inSession })).json.results[0];
    assert.equal(done.status, "proven");
    assert.equal(done.readers, 2);
    const e = fact(w, f.josefBirth);
    assert.equal(e.status, "proven");
    assert.deepEqual([e.verified?.result, e.verified?.model, e.verified?.task], ["proven", "claude-opus-x", josef.id]);
    assert.equal(e.date, "1850", "the value never changed");
    // an original nobody else read: proven, one reader
    const marriage = (await w.ok(["verify", "done", f.marriage, "--proven", "--image", "B0001:5", "--json"], { env: inSession })).json.results[0];
    assert.equal(marriage.status, "proven");
    assert.equal(marriage.readers, undefined);
    // a fact the person confirmed is theirs: not verified by an agent
    await w.ok(["verify", "confirm", f.josefDeath], { env: APP });
    await refuse([f.josefDeath, "--kept", "--reason", "nejisté"], "verify.confirmed");
    // the confirmation took the fact out of the task: with Josef's birth done, the task is done
    assert.equal(open(w).get<Task>(josef.id)!.state, "doing", "one at work goes on");
  } finally {
    w.cleanup();
  }
});

test("K4.1, K4.2, K2.3: the person's confirmation against the scan — never an agent's; undone; the agent's change of a confirmed fact a proposal; its status the person's", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    const family = openTasks(w, "verify:auto").find((t) => t.subject[0] === "F0001")!;
    // an agent never confirms
    const agent = await w.run(["verify", "confirm", f.marriage], { env: AGENT });
    assert.notEqual(agent.code, 0);
    assert.equal(fact(w, f.marriage).confirmed, undefined);
    // the person (through the app): confirmed, the status as it was, the task with no fact left dropped
    const yes = (await w.ok(["verify", "confirm", f.marriage, "--json"], { env: APP })).json.results[0];
    assert.deepEqual(yes.dropped, [family.id]);
    const e = fact(w, f.marriage);
    assert.equal(e.confirmed?.by, "user");
    assert.equal(e.status, "probable");
    assert.equal(open(w).get<Task>(family.id)!.state, "dropped");
    assert.equal((await w.ok(["verify", "confirm", f.marriage, "--json"], { env: APP })).json.results[0].same, true, "the same again: nothing written");
    // not queued again by the sweep
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    assert.ok(!openTasks(w, "verify:auto").some((t) => t.where.includes(f.marriage)));
    // the agent's change of its value: a proposal, the value kept
    const edit = (await w.ok(["event", "edit", f.marriage, "--date", "1876", "--reason", "zápis uvádí 1876", "--json"], { env: AGENT })).json;
    assert.ok(edit.proposed, "proposed");
    assert.equal(fact(w, f.marriage).date, "1875");
    assert.ok(fact(w, f.marriage).confirmed);
    // …its status: refused
    const status = await w.run(["event", "edit", f.marriage, "--status", "possible", "--json"], { env: AGENT });
    assert.notEqual(status.code, 0);
    assert.match(status.out + status.err, /event\.confirmed/u);
    const cite = await w.run(["cite", f.marriage, "S0003", "--locator", "fol. 2", "--status", "proven", "--json"], { env: AGENT });
    assert.notEqual(cite.code, 0);
    assert.match(cite.out + cite.err, /event\.confirmed/u);
    // …taking it back: a proposal
    const retract = (await w.ok(["event", "retract", f.marriage, "--reason", "jiný pár", "--json"], { env: AGENT })).json;
    assert.ok(retract.proposed);
    assert.ok(!fact(w, f.marriage).retracted);
    // a lead the person confirmed: an agent's new citation of a record does not raise it (only the person changes it)
    await w.ok(["source", "add", "Rodokmen Lhotáků", "--kind", "family-tree", "--form", "authored"]); // S8
    const lead = await add(w, "P2", "RESI", "--place", "Лхота", "--cite", "S0008", "--locator", "str. 4");
    assert.equal(fact(w, lead).status, "lead");
    await w.ok(["verify", "confirm", lead], { env: APP });
    await w.ok(["cite", lead, "S0001", "--locator", "fol. 1"], { env: AGENT });
    assert.equal(fact(w, lead).status, "lead", "the person's confirmed status kept");
    await w.ok(["cite", lead, "S0002", "--locator", "fol. 1"], { env: APP });
    assert.equal(fact(w, lead).status, "probable", "the person's own citation raises it");
    // the person changes the value: the confirmation goes with the old value
    await w.ok(["event", "edit", f.marriage, "--date", "1874", "--reason", "oprava podle skenu"], { env: APP });
    assert.equal(fact(w, f.marriage).confirmed, undefined);
    // undo of a confirmation
    await w.ok(["verify", "confirm", f.josefBirth], { env: APP });
    await w.ok(["verify", "confirm", f.josefBirth, "--undo"], { env: APP });
    assert.equal(fact(w, f.josefBirth).confirmed, undefined);
    assert.equal((await w.ok(["verify", "confirm", f.josefBirth, "--undo", "--json"], { env: APP })).json.results[0].same, true);
  } finally {
    w.cleanup();
  }
});

test("K6.9: strom verify status counts what waits (asked, images), what was kept and what the person confirmed", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    await w.ok(["verify", "facts", "P0007", "--json"]);
    await w.ok(["verify", "confirm", f.marriage], { env: APP });
    const s = (await w.ok(["verify", "status", "--json"])).json;
    assert.equal(s.waiting, 3, "Josef's two facts, the godfather's (the marriage confirmed)");
    assert.equal(s.asked, 1);
    assert.equal(s.confirmed, 1);
    assert.equal(s.kept, 0);
    assert.ok(s.images <= s.waiting && s.permission <= s.waiting);
    const text = (await w.ok(["verify", "status"])).out;
    assert.match(text, /3/u);
  } finally {
    w.cleanup();
  }
});

/** Someone with a birth, a death and 16 residences, each dated and placed (as a family tree from another program has it). */
const MANY_FACTS = (name: string) =>
  [
    "0 HEAD", "1 SOUR MyHeritage", "1 CHAR UTF-8",
    "0 @I1@ INDI", `1 NAME ${name}`, "1 SEX M", "1 BIRT", "2 DATE 12 MAR 1841", "2 PLAC Lhota u Kutné Hory", "1 DEAT", "2 DATE 28 NOV 1919", "2 PLAC Лхота",
    ...Array.from({ length: 16 }, (_, i) => ["1 RESI", `2 DATE ${i + 1} SEP ${1860 + i * 3}`, `2 PLAC ${["Dolní Lhota", "Lhotka nad Labem".normalize("NFD"), "Лхота", "Horní Lhota"][i % 4]}`]).flat(),
    "0 TRLR", "",
  ].join("\n");

test("N1: the person's verify of someone with many facts — every task made, its what within 200 characters, cut between characters only; a dry run promises what is made", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    const file = path.join(w.dir, "lhotak.ged");
    fs.writeFileSync(file, MANY_FACTS("Jan Křtitel /Lhoták/".normalize("NFD")));
    await w.ok(["intake", file], { env: AGENT });
    const p = open(w).list<Person>("person")[0]!;
    assert.equal(p.events.length, 18);
    const dry = (await w.ok(["verify", "facts", p.id, "--dry-run", "--json"])).json;
    assert.equal(dry.facts.length, 18);
    const asked = await w.run(["verify", "facts", p.id, "--json"]);
    assert.equal(asked.code, 0, asked.out + asked.err);
    const made = (asked.json.tasks as { task: string }[]).map((t) => open(w).get<Task>(t.task)!);
    assert.equal(asked.json.estimate.sessions, dry.estimate.sessions, "the dry run promised these");
    assert.deepEqual(made.flatMap((t) => t.where).sort(), p.events.map((e) => e.id).sort(), "every fact in a task");
    for (const t of made) {
      assert.ok([...t.what].length <= 200, `${[...t.what].length}: ${t.what}`);
      assert.match(t.what, /^Najít a přečíst zápisy k údajům: Jan Křtitel Lhoták \(1841–1919\) – E\p{N}{4} /u, t.what);
      const rest = /… \(\+(\p{N}+)\)$/u.exec(t.what);
      assert.equal((t.what.match(/E\p{N}{4}/gu) ?? []).length + Number(rest?.[1] ?? 0), t.where.length, `the rest counted: ${t.what}`);
      assert.equal(t.what, t.what.normalize("NFC"));
    }
    assert.ok(made.some((t) => t.what.endsWith(")") && t.what.includes("… (+")), "a task of 8 facts names some, counts the rest");
    // a name longer than the what holds: cut between characters (a letter with its marks, an emoji), never inside one
    const long = new World();
    try {
      await long.withTree("Lhotákovi");
      const name = `${"Jaq̌ 👨‍👩‍👧 ".repeat(40)}/Lhoták/`;
      fs.writeFileSync(path.join(long.dir, "dlouhy.ged"), MANY_FACTS(name));
      await long.ok(["intake", path.join(long.dir, "dlouhy.ged")], { env: AGENT });
      const r = (await long.ok(["verify", "facts", "P0001", "--json"])).json;
      for (const { task } of r.tasks as { task: string }[]) {
        const what = open(long).get<Task>(task)!.what;
        assert.ok([...what].length <= 200, what);
        assert.match(what, /(?:👨‍👩‍👧|q̌|\p{L})…$/u, what);
      }
    } finally {
      long.cleanup();
    }
  } finally {
    w.cleanup();
  }
});

test("P1: facts of one person asked for one by one join the person's open task (its place in the queue kept, its what within 200 characters); one at work or worked on is not changed", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    fs.writeFileSync(path.join(w.dir, "lhotak.ged"), MANY_FACTS("Jan Křtitel /Lhoták/"));
    await w.ok(["intake", path.join(w.dir, "lhotak.ged")], { env: AGENT });
    const ids = open(w).list<Person>("person")[0]!.events.map((e) => e.id);
    const ask = async (id: string) => (await w.ok(["verify", "facts", "--fact", id, "--json"])).json;
    // another task asked for before: first in the queue
    await w.ok(["person", "add", "Vojtěch /Lhotecký/", "--sex", "M"], { env: AGENT });
    const other = await add(w, "P0002", "BIRT", "--date", "1840", "--place", "Lhota");
    const before = (await ask(other)).task as string;
    const first = (await ask(ids[0]!)).task as string;
    const at = open(w).get<Task>(first)!.queueAt;
    // the person's own "next": the last asked for first (spec 052 K5.3) — the one asked for before after it
    const queued = ((await w.ok(["task", "list", "--json"])).json.tasks as { id: string }[]).map((x) => x.id);
    assert.ok(queued.indexOf(first) < queued.indexOf(before), `the last asked for first: ${queued}`);
    for (const id of ids.slice(1, 8)) assert.equal((await ask(id)).task, first, `${id} joins ${first}`);
    const t = open(w).get<Task>(first)!;
    assert.deepEqual(t.where, ids.slice(0, 8), "one task of the person's eight facts");
    assert.deepEqual(t.queueAt, at, "its place in the queue kept");
    assert.ok([...t.what].length <= 200, t.what);
    assert.match(t.what, /Jan Křtitel Lhoták/u);
    const queue = ((await w.ok(["task", "list", "--json"])).json.tasks as { id: string }[]).map((x) => x.id);
    assert.deepEqual(queue.filter((x) => x === first || x === before), queued.filter((x) => x === first || x === before), "the facts joined: its place kept");
    // full: a new task, the next fact joins it
    const second = (await ask(ids[8]!)).task as string;
    assert.notEqual(second, first);
    assert.equal((await ask(ids[9]!)).task, second);
    assert.deepEqual(open(w).get<Task>(second)!.where, ids.slice(8, 10));
    // at work: not changed, a new task
    const tree = open(w);
    tree.withTreeLock(() => {
      tree.put({ ...tree.get<Task>(second)!, state: "doing" }, { op: "task.start", targets: [second], summary: "at work" });
      tree.commit("At work");
    });
    const third = (await ask(ids[10]!)).task as string;
    assert.ok(![first, second].includes(third));
    assert.deepEqual(open(w).get<Task>(second)!.where, ids.slice(8, 10));
    // worked on (a session ended on it), open again: not changed either
    ended(w, third, 1);
    const fourth = (await ask(ids[11]!)).task as string;
    assert.ok(![first, second, third].includes(fourth));
    assert.deepEqual(open(w).get<Task>(third)!.where, [ids[10]]);
    assert.equal(tasks(w, "verify:search").length, 5, "the four of the person, the one asked for before");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("P2: the person's verify asked for again with nothing new (a double click) writes nothing, answers the same — a parked task asked for again comes first", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    const first = (await w.ok(["verify", "facts", "P0002", "--json"])).json;
    const n = commits(w);
    const again = (await w.ok(["verify", "facts", "P0002", "--json"])).json;
    assert.equal(commits(w), n, "no commit for nothing new");
    assert.deepEqual([again.task, again.state, again.position, again.tasks], [first.task, first.state, first.position, first.tasks]);
    const fact1 = (await w.ok(["verify", "facts", "--fact", f.josefBirth, "--json"])).json;
    assert.equal(commits(w), n, "one fact of it neither");
    assert.ok((first.tasks as { task: string }[]).some((t) => t.task === fact1.task));
    // a task of it parked: asked for again, it comes first again (written)
    const tree = open(w);
    tree.withTreeLock(() => {
      tree.put({ ...tree.get<Task>(first.task)!, state: "parked" }, { op: "task.park", targets: [first.task], summary: "parked" });
      tree.commit("Parked");
    });
    const m = commits(w);
    await w.ok(["verify", "facts", "P0002", "--json"]);
    assert.equal(commits(w), m + 1);
    assert.equal(open(w).get<Task>(first.task)!.state, "open");
  } finally {
    w.cleanup();
  }
});
