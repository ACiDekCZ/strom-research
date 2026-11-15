// strom sync: two facts of one person alike — the same kind, day and source, told apart by their names or by their IDs
// alone — each keep their own note and the notes of those they name. The tree the bridge gave the Strom app, sent back
// unedited, changes no note; the user's note of one of them is written to that one alone; facts nothing tells apart but
// the ID the app was given, sent without it, take no note at all (never guessed). (1115 B1: the note of one corrected
// its twin's.)

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { buildGed } from "../../src/core/liveged.ts";
import { head as headOf } from "../../src/core/git.ts";
import { planSync, readGedcom } from "../../src/core/sync.ts";
import type { Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const PERSON = { tty: true };
const FROM_APP = { env: { STROM_FOR_APP: "1" } };
const APPS = ["3.28.0", "3.29.0"];

const events = (w: World) => Tree.open(w.cwd, w.env).get<Person>("P0001")!.events.filter((e) => !e.retracted);
const noteOf = (w: World, id: string) => events(w).find((e) => e.id === id)?.note;
const partNote = (w: World, id: string) => events(w).find((e) => e.id === id)?.participants?.find((p) => p.role === "witness")?.note;
const noteKinds = (changes: { kind: string }[]) => changes.filter((c) => c.kind === "fact.note" || c.kind === "fact.part.note");

/** The bridge's /tree.ged for a version of the app, as the app sends it back. */
const appFile = (w: World, version: string) =>
  buildGed({ root: w.cwd, env: w.env, head: headOf(w.cwd) ?? "", version, links: [], budgetMs: 0 })
    .bytes.toString("utf8")
    .replace(/^1 SOUR STROM_RESEARCH\r?\n2 VERS [^\n]*\n2 NAME [^\n]*\n/mu, `1 SOUR STROM\n2 VERS ${version}\n2 NAME Strom Family Tree\n`);

function send(w: World, name: string, text: string): string {
  const file = path.join(w.dir, name);
  fs.writeFileSync(file, text);
  return file;
}

/** Václav with two events of one day, cited at one page of one source, each with its note and its witness's note. */
async function setUp(labels: [string, string]): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"], PERSON); // P0001
  await w.ok(["source", "add", "Kniha usedlíků", "--kind", "other", "--date", "1900"], PERSON); // S0001
  await w.ok(["event", "add", "P0001", "EVEN", "--label", labels[0], "--date", "23 DEC 1900", "--cite", "S0001", "--locator", "fol. 5", "--with", "witness:Jan Lhota (soused)"], PERSON); // E0001
  await w.ok(["event", "add", "P0001", "EVEN", "--label", labels[1], "--date", "23 DEC 1900", "--cite", "S0001", "--locator", "fol. 5", "--with", "witness:Jan Lhota (kovář z Lhoty)"], PERSON); // E0002
  await w.ok(["event", "edit", "E0001", "--note", "Poznámka A k odvodu"], PERSON);
  await w.ok(["event", "edit", "E0002", "--note", "Poznámka B — Записано в книге"], PERSON);
  return w;
}

for (const labels of [["Odvod k vojsku", "Prodej pole"], ["Zápis do knihy", "Zápis do knihy"]] as [string, string][]) {
  const alike = labels[0] === labels[1] ? "of one name" : "of two names";
  test(`twin facts ${alike}: an unedited tree from the app (3.28.0, 3.29.0) changes no note`, opts, async () => {
    const w = await setUp(labels);
    try {
      for (const app of APPS) {
        const t = appFile(w, app);
        assert.match(t, /2 _STROM_EID E0002/u, "the app is given each fact's ID");
        const r = await w.ok(["sync", send(w, `same-${app}.ged`, t), "--json"]);
        assert.deepEqual(noteKinds(planSync(Tree.open(w.cwd, w.env), readGedcom(t), "conflict", { partNotes: true }).changes), [], `${app}, the participants' notes taken`);
        assert.deepEqual(noteKinds(r.json.changes), [], `${app}: ${JSON.stringify(noteKinds(r.json.changes))}`);
        await w.ok(["sync", send(w, `apply-${app}.ged`, t), "--apply", "--json"], FROM_APP);
        assert.equal(noteOf(w, "E0001"), "Poznámka A k odvodu");
        assert.equal(noteOf(w, "E0002"), "Poznámka B — Записано в книге");
        assert.equal(partNote(w, "E0001"), "soused");
        assert.equal(partNote(w, "E0002"), "kovář z Lhoty");
      }
    } finally {
      w.cleanup();
    }
  });

  test(`twin facts ${alike}: the user's note of one, and of its witness, is written to that one alone`, opts, async () => {
    const w = await setUp(labels);
    try {
      // the second fact's note and its witness's, edited in the app (decomposed, as typed on a Mac)
      const t = appFile(w, "3.29.0");
      const at = t.indexOf("2 _STROM_EID E0002");
      const edited =
        t.slice(0, at) +
        t
          .slice(at)
          .replace("Poznámka B — Записано в книге", "Poznámka B — opravená".normalize("NFD"))
          .replace("3 NOTE kovář z Lhoty", "3 NOTE kovář z Horní Lhoty");
      assert.notEqual(edited, t);
      const which = (changes: { kind: string; was?: { id?: string } }[]) => noteKinds(changes).map((c) => `${c.kind} ${(c as { was?: { id?: string } }).was?.id}`).sort();
      // the witness's note, of an app that gives it whole (APP_SENDS_PART_NOTES, open here): to that fact alone
      assert.deepEqual(which(planSync(Tree.open(w.cwd, w.env), readGedcom(edited), "conflict", { partNotes: true }).changes), ["fact.note E0002", "fact.part.note E0002"]);
      const r = await w.ok(["sync", send(w, "edited.ged", edited), "--apply", "--json"], FROM_APP);
      assert.deepEqual(which(r.json.changes), ["fact.note E0002"], JSON.stringify(r.json.changes));
      assert.equal(noteOf(w, "E0001"), "Poznámka A k odvodu", "its twin's note untouched");
      assert.equal(noteOf(w, "E0002"), "Poznámka B — opravená");
      assert.equal(partNote(w, "E0001"), "soused");
    } finally {
      w.cleanup();
    }
  });
}

test("twin facts nothing tells apart but their IDs, sent without them: no note taken, none guessed", opts, async () => {
  const w = await setUp(["Zápis do knihy", "Zápis do knihy"]);
  try {
    const t = appFile(w, "3.29.0").replace(/^2 _STROM_EID E\d+\r?\n(?:3 _TXT [^\n]*\n)?/gmu, "");
    assert.doesNotMatch(t, /_STROM_EID/u);
    const same = await w.ok(["sync", send(w, "no-ids.ged", t), "--json"]);
    assert.deepEqual(noteKinds(planSync(Tree.open(w.cwd, w.env), readGedcom(t.replace("3 NOTE kovář z Lhoty", "3 NOTE kovář z Horní Lhoty")), "conflict", { partNotes: true }).changes), [], "nor a witness's");
    assert.deepEqual(noteKinds(same.json.changes), [], JSON.stringify(noteKinds(same.json.changes)));
    const edited = t.replace("Poznámka B — Записано в книге", "Poznámka B — opravená");
    const r = await w.ok(["sync", send(w, "no-ids-edited.ged", edited), "--apply", "--json"], FROM_APP);
    assert.deepEqual(noteKinds(r.json.changes), [], JSON.stringify(noteKinds(r.json.changes)));
    assert.equal(noteOf(w, "E0001"), "Poznámka A k odvodu");
    assert.equal(noteOf(w, "E0002"), "Poznámka B — Записано в книге");
  } finally {
    w.cleanup();
  }
});
