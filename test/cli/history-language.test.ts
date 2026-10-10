// What the Strom app shows of a research while it happens is in the research's language: every line of its history
// (a commit strom wrote with no operation to say, an operation with no line of its own — never the English subject or
// summary; the upkeep says nothing), the task of each commit and of who is at work with its records by their names, and
// a send refused with a stable code the app says in its own words.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { hasGit } from "../helpers.ts";
import { Tree, type Op } from "../../src/core/tree.ts";
import { changeLines } from "../../src/core/changelog.ts";
import { history } from "../../src/core/live.ts";
import { world } from "./links.helpers.ts";
import { world as syncWorld, post } from "./sync.helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const op = (o: Partial<Op> & { op: string; summary: string }): Op => ({ at: new Date().toISOString(), targets: [], by: "user", files: [], prev: "", k: "", sig: "", ...o });
/** What strom writes in English for itself: never a line a person reads in a Czech research. */
const ENGLISH = /Agent instructions|Reading|Clips|Transcripts|Export|out of the history|retracted|skipped|BIRT|frobbed|tree setting|images by readers|entries/;

test("the history in a Czech research: strom's own commits and operations said in Czech, its upkeep and what it does not know said not at all", opts, async () => {
  const { w } = await world(); // Kniha N 1850-1870 (B0001) with image 1 (M0001), Jan Novák (P0001)
  const tree = Tree.open(w.cwd, w.env);
  assert.equal(tree.lang, "cs");
  const said = (subject: string, ops: Op[] = []) => changeLines(tree, ops, subject, tree.lang);

  // commits with no operation, by the subjects strom writes
  assert.deepEqual(said("Agent instructions: AGENTS.md, CLAUDE.md, .claude/agents/strom-scan-reader.md, opencode.json"), [], "upkeep: nothing");
  assert.deepEqual(said("Reading M0001: 1 images by readers"), [{ text: "Pročteno: Kniha N 1850-1870 (obr. 1)", kind: "source" }]);
  assert.deepEqual(said("Reading B0001-1-1: 1 images by readers"), [{ text: "Pročteno: Kniha N 1850-1870 (obr. 1)", kind: "source" }]);
  assert.deepEqual(said("Clips: 6 of 6 entries marked on their scans"), [{ text: "Zápisy vyznačené na snímcích: 6 z 6", kind: "source" }]);
  assert.deepEqual(said("Transcripts: 1 of 1 entries written from their cut-outs"), [{ text: "Zápisy přepsané z výřezů: 1 z 1", kind: "source" }]);
  assert.deepEqual(said("Export tree.ged, tree-strom.ged: 2 persons, 1 families"), []);
  assert.deepEqual(said("Exports with images stay out of the history"), []);
  assert.deepEqual(said("The file for the Strom app (with the images of the entries) stays out of the history"), []);
  assert.deepEqual(said('Create tree "Novákovi"'), [{ text: "Výzkum založen: Novákovi", kind: "other" }]);
  assert.deepEqual(said("Something strom never wrote before"), [], "a subject not known: nothing, never English");

  // operations with no line of their own
  const lines = said("strom x: 6 changes", [
    op({ op: "media.retract", targets: ["M0001"], summary: "M0001 retracted: kontrola doplňku" }),
    op({ op: "input.skip", targets: ["I0070"], summary: "I0070 skipped" }),
    op({ op: "event.add", targets: ["P0001", "E0274"], summary: "+E0274 BIRT P0001 MAR 1776 [probable]" }),
    op({ op: "widget.frob", targets: ["P0001"], summary: "P0001 frobbed" }),
    op({ op: "widget.frob", targets: [], summary: "something frobbed" }),
    op({ op: "config.set", targets: [], summary: "tree setting stories = no" }),
  ]).map((l) => l.text);
  assert.deepEqual(lines.slice(0, 2), ["Odvolaný snímek: Kniha N 1850-1870, obr. 1", "Materiál odložen jako nepoužitelný: I0070"]);
  assert.match(lines[2]!, /^Jan Novák \(\*1865\) \[P0001\] – narození: .*1776$/, "a fact gone since: as its summary names it");
  assert.equal(lines[3], "Upraveno: Jan Novák (*1865) [P0001]", "an operation strom does not know: by the kind of its record");
  assert.equal(lines[4], "Změněno nastavení výzkumu: stories");
  assert.equal(lines.length, 5, "an operation about no record: nothing");
  for (const l of lines) assert.doesNotMatch(l, ENGLISH, l);

  // a commit of its upkeep made for real: the app's history has nothing to say of it
  fs.writeFileSync(path.join(w.cwd, "notes", "x.md"), "x\n");
  tree.withTreeLock(() => tree.commit("Agent instructions: AGENTS.md", ["notes"]));
  const [last] = history(w.cwd, Tree.open(w.cwd, w.env));
  assert.match(last!.what.join("\n") + last!.text.join("\n"), /^Agent instructions: AGENTS\.md$/m);
  assert.deepEqual(last!.text, []);
  for (const e of history(w.cwd, Tree.open(w.cwd, w.env))) for (const l of e.text) assert.doesNotMatch(l, ENGLISH, l);
  w.cleanup();
});

test("the task of a commit and of who is at work: its ID first, then its records by their names — as the queue says it", opts, async () => {
  const { w } = await world();
  await w.ok(["task", "add", "Rodiče P0001 v knize B0001", "--level", "locate", "--where", "matriky", "--why", "rodiče", "--done-when", "zápis", "--about", "P0001"]);
  const { enterWorker } = await import("../../src/core/workers.ts");
  const leave = enterWorker(w.cwd, "run-t", "Claude Code on its own");
  w.env.STROM_WORKER = "run-t";
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    await w.ok(["session", "start", "T0001"]);
    await w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]);
    const title = "T0001 Rodiče Jan Novák [P0001] v knize Kniha N 1850-1870";
    const status = (await (await fetch(`${info.url}/status`)).json()) as { working: { task?: string }[]; queue: { id: string; text: string }[] };
    assert.equal(status.working[0]?.task, title);
    const { entries } = (await (await fetch(`${info.url}/log`)).json()) as { entries: { what: string[]; task?: string }[] };
    assert.equal(entries.find((e) => e.what.some((l) => l.startsWith("+P0002")))?.task, title);
    assert.equal(history(w.cwd, Tree.open(w.cwd, w.env))[0]!.task, title);
  } finally {
    delete w.env.STROM_WORKER;
    leave();
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a send refused says why by a stable code beside its sentence: not from the app's pages, empty, another family tree", opts, async () => {
  const { w, ged } = await syncWorld();
  const text = fs.readFileSync(ged, "utf8");
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const app = { Origin: "https://beta.stromapp.info" };
    for (const what of ["sync", "adopt"]) {
      const r = await post(`${info.url}/${what}`, text);
      assert.equal(r.status, 403);
      assert.equal(JSON.parse(r.body).code, "app.only", what);
      assert.match(JSON.parse(r.body).error, /only the Strom app/, "the sentence as before");
    }
    const empty = await post(`${info.url}/sync`, "hello", app);
    assert.equal(empty.status, 400);
    assert.equal(JSON.parse(empty.body).code, "tree.empty");
    const foreign = await post(`${info.url}/sync`, text.replace(/^1 _STROM_(TREE|HEAD) .*\r?\n/gm, "").replace(/1 REFN P0/g, "1 REFN X0"), app);
    assert.equal(foreign.status, 400);
    assert.equal(JSON.parse(foreign.body).code, "tree.foreign");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
