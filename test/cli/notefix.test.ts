// The notes a send of the Strom app wrote wrong before strom 1.34.0 (1115 B1), set right once by themselves
// (core/notefix.ts settleNotes): a fact's note and a witness's note its twin had (the same kind, day and source) that
// the file did not give that fact — or, no file kept, that its twin has; a witness's longer note the 3.28.0 cut short.
// The note before put back, the wrong one in the note's history; one changed since left as it is; the user's own edit
// (the file gave that fact those words) never touched; once.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree, VERSION } from "../../src/core/tree.ts";
import { create, update } from "../../src/core/records.ts";
import { buildGed } from "../../src/core/liveged.ts";
import { head as headOf } from "../../src/core/git.ts";
import { applySync, planSync, readGedcom, type Change, type SyncInput } from "../../src/core/sync.ts";
import { NOTES_LEFT_ORIGIN, NOTES_SETTLED, noteFixes, settleNotes } from "../../src/core/notefix.ts";
import { backupsMade } from "../../src/core/backup.ts";
import { answersInApp, inApp, waitingFor } from "../../src/core/waiting.ts";
import fs from "node:fs";
import path from "node:path";
import type { Person, Source, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const PERSON = { tty: true };

const open = (w: World) => Tree.open(w.cwd, w.env);
const ev = (w: World, id: string) => open(w).get<Person>("P0001")!.events.find((e) => e.id === id)!;
const witness = (w: World, id: string) => ev(w, id).participants?.find((p) => p.role === "witness")?.note;

const A = "Poznámka A k odvodu";
const B = "Poznámka B — Записано в книге";

/** The bridge's /tree.ged for a version of the app, as the app sends it back. */
const appFile = (w: World, version: string) =>
  buildGed({ root: w.cwd, env: w.env, head: headOf(w.cwd) ?? "", version, links: [], budgetMs: 0 })
    .bytes.toString("utf8")
    .replace(/^1 SOUR STROM_RESEARCH\r?\n2 VERS [^\n]*\n2 NAME [^\n]*\n/mu, `1 SOUR STROM\n2 VERS ${version}\n2 NAME Strom Family Tree\n`);

async function setUp(witnessNote = "kovář z Lhoty"): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"], PERSON);
  await w.ok(["source", "add", "Kniha usedlíků", "--kind", "other", "--date", "1900"], PERSON);
  await w.ok(["event", "add", "P0001", "EVEN", "--label", "Odvod k vojsku", "--date", "23 DEC 1900", "--cite", "S0001", "--locator", "fol. 5", "--with", "witness:Jan Lhota (soused)"], PERSON); // E0001
  await w.ok(["event", "add", "P0001", "EVEN", "--label", "Prodej pole", "--date", "23 DEC 1900", "--cite", "S0001", "--locator", "fol. 5", "--with", `witness:Jan Lhota (${witnessNote})`], PERSON); // E0002
  await w.ok(["event", "edit", "E0001", "--note", A], PERSON);
  await w.ok(["event", "edit", "E0002", "--note", B], PERSON);
  return w;
}

/**
 * What a sync before 1.34.0 wrote: E0001's note and witness's note "corrected" with E0002's (`wrote`: the file it
 * planned from), its input keeping the file the app really sent (`sent`; none: no file kept).
 */
function wrongSync(w: World, wrote: string, sent: string | undefined, partNotes = true, as?: (c: Change) => Change) {
  const tree = open(w);
  tree.personWrites = true;
  return tree.withTreeLock(() => {
    const incoming = readGedcom(wrote);
    const planned = planSync(tree, incoming, "conflict", { partNotes });
    const plan = as ? { ...planned, changes: planned.changes.map(as) } : planned;
    const made = create<SyncInput>(tree, "input", { name: "app.ged", sha: "0", size: 1, mime: "text/plain", from: "app.ged", kind: "tree", state: "processed", ...(sent !== undefined ? { text: sent } : {}) } as never, (i) => `+${i} input tree "app.ged" (sync)`);
    const source = create<Source>(tree, "source", { kind: "family-tree", title: "Strom", input: made.id, information: "secondary", form: "authored" } as never, (s) => `+${s} source "app.ged" (sync)`);
    const r = applySync(tree, plan, incoming, source, undefined, { decidePerson: false, input: made.id });
    update<SyncInput>(tree, made.id, "input", (i) => ({ ...i, source: source.id, sync: { edits: "conflict", applied: r.applied } }), { op: "input.sync", summary: `${made.id} synced` });
    tree.commit(`sync ${made.id}`);
    return { plan, input: made.id };
  });
}

/** The app's file with E0001's note and witness's note as E0002's — as the sync before 1.34.0 took it. */
const twinned = (t: string) => {
  const at = t.indexOf("2 _STROM_EID E0001");
  const end = t.indexOf("2 _STROM_EID E0002");
  return t.slice(0, at) + t.slice(at, end).replace(A, B).replace("3 NOTE soused", "3 NOTE kovář z Lhoty") + t.slice(end);
};

for (const kept of ["the file kept", "no file kept"]) {
  test(`a note and a witness's note a send wrote of a fact alike are set right once (${kept}); the wrong one in the history`, opts, async () => {
    const w = await setUp();
    try {
      const sent = appFile(w, "3.29.0");
      const r = wrongSync(w, twinned(sent), kept === "the file kept" ? sent : undefined);
      assert.ok(r.plan.changes.some((c) => c.kind === "fact.note" && c.was?.id === "E0001"));
      assert.equal(ev(w, "E0001").note, B, "as the sync before 1.34.0 left it");
      assert.equal(witness(w, "E0001"), "kovář z Lhoty");
      const { backup: _b, ...done } = settleNotes(open(w)) ?? {};
      assert.deepEqual(done, { facts: 1, notes: 2, left: [], asked: [] });
      const e = ev(w, "E0001");
      assert.equal(e.note, A, "the note before put back");
      assert.equal(e.noteEdits?.at(-1)?.text, B, "the wrong one kept in the note's history");
      assert.equal(witness(w, "E0001"), "soused");
      assert.equal(ev(w, "E0002").note, B, "its twin untouched");
      assert.equal(witness(w, "E0002"), "kovář z Lhoty");
      assert.ok(open(w).config.settled?.includes(NOTES_SETTLED));
      assert.equal(settleNotes(open(w)), undefined, "once");
    } finally {
      w.cleanup();
    }
  });
}

test("the user's own edit (the file gave that fact those words) is never set right; one changed since is left and asked of the person", opts, async () => {
  const w = await setUp();
  try {
    // the user really gave the first fact its twin's words in the app: the file says so under its ID
    const sent = twinned(appFile(w, "3.29.0"));
    wrongSync(w, sent, sent);
    assert.equal(ev(w, "E0001").note, B);
    assert.deepEqual(noteFixes(open(w)), { fixes: [], left: [] });
    assert.equal(settleNotes(open(w)), undefined, "nothing found: nothing written");
    assert.equal(ev(w, "E0001").note, B);
    assert.deepEqual(backupsMade(w.env), [], "nothing to set right: no backup");
  } finally {
    w.cleanup();
  }
  const v = await setUp();
  try {
    wrongSync(v, twinned(appFile(v, "3.29.0")), undefined);
    // the person wrote the note again since: left as it is, said
    await v.ok(["note", "edit", "E0001", "1", "Poznámka A, opravená", "--reason", "upřesněno"], PERSON);
    const done = settleNotes(open(v));
    assert.deepEqual(done && { facts: done.facts, left: done.left }, { facts: 1, left: ["E0001"] }, "only the witness's set right");
    assert.equal(ev(v, "E0001").note, "Poznámka A, opravená");
    assert.equal(witness(v, "E0001"), "soused");
    // …and asked of the person: one task waiting for them, in the research's language, its notes in its words
    assert.equal(done?.asked.length, 1);
    const t = open(v).get<Task>(done!.asked[0]!)!;
    assert.equal(t.state, "waiting");
    assert.equal(t.origin, NOTES_LEFT_ORIGIN);
    assert.deepEqual([t.where, t.subject], [["E0001"], ["P0001"]]);
    assert.match(t.what, /^Zkontrolovat poznámku E0001 \(Václav Lhoták\)/u);
    assert.match(t.waitingOn ?? "", /E0001/u);
    for (const said of [A, B, "Poznámka A, opravená"]) assert.ok(t.why.includes(`„${said}“`), `${said} in ${t.why}`);
    const item = waitingFor(open(v)).find((i) => i.task?.id === t.id);
    assert.ok(item && inApp(item) && answersInApp(t), "in What waits, the Strom app's too, answered there");
    assert.equal(settleNotes(open(v)), undefined, "once: asked once");
    assert.equal(open(v).list<Task>("task").filter((x) => x.origin === NOTES_LEFT_ORIGIN).length, 1);
  } finally {
    v.cleanup();
  }
});

test("a witness's longer note the 3.28.0 sent cut short is set right; of an app that sends it whole it stays", opts, async () => {
  const long = "kovář z Horní Lhoty, " + "vdovec po Anně, otec čtyř dětí, kmotr mnoha dětí celé obce a soused z čísla dvanáct. ".repeat(3).trim();
  for (const app of ["3.28.0", "3.29.0"]) {
    const w = await setUp(long);
    try {
      const sent = appFile(w, app);
      const cut = sent.replace(/^(3 NOTE kovář z Horní Lhoty, [^\n]{0,60})[^\n]*(\r?\n(?:4 CON[CT] [^\n]*\r?\n)*)/mu, "$1\n");
      assert.notEqual(cut, sent);
      // as a strom before 1.35.0 planned it (it took the beginning alone for an edit; core/sync.ts cutShort now never)
      const short = /^3 NOTE (kovář z Horní Lhoty, [^\n]*)$/mu.exec(cut)![1]!;
      const marked = cut.replace(`3 NOTE ${short}`, "3 NOTE MARKER");
      wrongSync(w, marked, cut, true, (c) => (c.kind === "fact.part.note" && c.part?.note === "MARKER" ? { ...c, part: { ...c.part, note: short } } : c));
      assert.notEqual(witness(w, "E0002"), long, "as the sync before 1.34.0 left it");
      const done = settleNotes(open(w));
      if (app === "3.28.0") {
        assert.deepEqual(done && { facts: done.facts, notes: done.notes, left: done.left }, { facts: 1, notes: 1, left: [] });
        assert.equal(witness(w, "E0002"), long);
      } else {
        assert.equal(done, undefined, "the user's own shortening, of an app that sends it whole");
        assert.notEqual(witness(w, "E0002"), long);
      }
    } finally {
      w.cleanup();
    }
  }
});

test("the research is backed up before its notes are set right (a beta after a beta: no backup of a change of channel); once", opts, async () => {
  const w = await setUp();
  try {
    const sent = appFile(w, "3.29.0");
    wrongSync(w, twinned(sent), sent);
    assert.deepEqual(backupsMade(w.env), [], "no backup before");
    const done = settleNotes(open(w), { from: "1.34.0-beta.3" });
    assert.ok(done?.backup, "a backup made");
    assert.equal(done.backup.from, "1.34.0-beta.3");
    assert.deepEqual(backupsMade(w.env).map((b) => b.path), [done.backup.path], "kept in the user config");
    // the research as it was before the fix: the wrong note, its history whole
    const copy = path.join(done.backup.path, "trees", path.basename(w.cwd));
    assert.ok(fs.existsSync(path.join(copy, ".git")), "with its history");
    const before = JSON.parse(fs.readFileSync(path.join(copy, "data", "persons", "P0001.json"), "utf8")) as Person;
    assert.equal(before.events.find((e) => e.id === "E0001")!.note, B);
    assert.ok(fs.existsSync(path.join(done.backup.path, "settings")), "and the settings");
    assert.match(fs.readFileSync(path.join(done.backup.path, "README.txt"), "utf8"), /Lhotákovi/u);
    assert.equal(ev(w, "E0001").note, A, "then set right");
    assert.equal(settleNotes(open(w)), undefined);
    assert.equal(backupsMade(w.env).length, 1, "once");
  } finally {
    w.cleanup();
  }
});

test("no second backup when the change of channel's backup of the last day holds the research already", opts, async () => {
  const w = await setUp();
  try {
    const sent = appFile(w, "3.29.0");
    wrongSync(w, twinned(sent), sent);
    const t = open(w);
    // the backup a change of channel made a moment ago for this version (core/backup.ts), the research in it
    const dir = path.join(w.home, "backups", "switch");
    fs.mkdirSync(path.join(dir, "trees", "jiný název"), { recursive: true });
    fs.copyFileSync(path.join(t.root, "strom.json"), path.join(dir, "trees", "jiný název", "strom.json"));
    const config = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
    const record = { at: new Date().toISOString(), from: "1.33.0", to: VERSION, fromChannel: "stable", toChannel: "beta", path: dir, bytes: 1 };
    fs.writeFileSync(config, JSON.stringify({ ...JSON.parse(fs.readFileSync(config, "utf8")), backups: [record] }, null, 2));
    const done = settleNotes(open(w));
    assert.equal(done?.notes, 2, "set right");
    assert.equal(done?.backup, undefined, "no backup made again");
    assert.equal(backupsMade(w.env).length, 1);
  } finally {
    w.cleanup();
  }
});
