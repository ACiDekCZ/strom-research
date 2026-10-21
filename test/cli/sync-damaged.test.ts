// Characters the Strom app's file damaged (an emoji split on a GEDCOM CONC line comes back as U+FFFD U+FFFD) are not
// the user's edit: a source's title, a person's or a couple's note stays as the research has it, and a real edit beside
// the damage is taken with the emoji put back.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Tree } from "../../src/core/tree.ts";
import type { Family, Person, Source } from "../../src/core/model.ts";
import { World } from "../helpers.ts";
import { opts } from "./sync.helpers.ts";

const TITLE = "Sňatky fary Zálesí 1823, ženich z Horní Vsi → ověřeno. 🟣 Úkol 7.";
const PERSON_NOTE = "Ke křtu: kmotr souhlasí ✅ s farním listem. 📌 Opsáno z pořadače u fary.";
const FAMILY_NOTE = "Dům č. 14 na návsi (podle sčítání 1857). 💬 Zatím jen odhad.";

/** Every character outside the Basic Multilingual Plane split in two, as the app's line split leaves it. */
const damaged = (t: string) => t.replace(/[\u{10000}-\u{10FFFF}]/gu, "��");

async function world(): Promise<{ w: World; ged: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", TITLE, "--kind", "marriage"]); // S1
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M", "--note", PERSON_NOTE]); // P1
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2", "--note", FAMILY_NOTE]); // F1
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  return { w, ged };
}

const research = (w: World) => {
  const tree = Tree.open(w.cwd, w.env);
  return { title: tree.get<Source>("S0001")!.title, person: tree.get<Person>("P0001")!.notes.map((n) => n.text), family: tree.get<Family>("F0001")!.notes.map((n) => n.text) };
};

test("a file whose emoji came back damaged brings nothing: the title and the notes stay as the research has them", opts, async () => {
  const { w, ged } = await world();
  const before = research(w);
  assert.ok(fs.readFileSync(ged, "utf8").includes("🟣"));
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, damaged(fs.readFileSync(ged, "utf8")));
  assert.ok(fs.readFileSync(file, "utf8").includes("��"));
  assert.match((await w.ok(["sync", file])).out, /nic nového/);
  const shown = (await w.ok(["sync", file, "--json"])).json;
  assert.deepEqual(shown.changes, []);
  assert.ok(shown.mended >= 3, `mended ${shown.mended}`);
  await w.ok(["sync", file, "--apply"]);
  assert.deepEqual(research(w), before);
  w.cleanup();
});

test("a real edit with damaged emoji: the edit taken, the emoji put back where the text around it tells", opts, async () => {
  const { w, ged } = await world();
  const file = path.join(w.dir, "z-aplikace.ged");
  const text = fs.readFileSync(ged, "utf8").replace("1 TITL Sňatky fary Zálesí 1823,", "1 TITL Sňatky fary Zálesí 1823 (svazek 41),");
  fs.writeFileSync(file, damaged(text));
  assert.match((await w.ok(["sync", file])).out, /přejmenovaný/);
  await w.ok(["sync", file, "--apply"]);
  const now = research(w);
  assert.equal(now.title, TITLE.replace("1823,", "1823 (svazek 41),"));
  assert.deepEqual(now.person, [PERSON_NOTE]);
  assert.deepEqual(now.family, [FAMILY_NOTE]);
  assert.ok(!JSON.stringify(now).includes("�"));
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a copy of the app from before the damage was mended in the research brings it back no more", opts, async () => {
  const { w } = await world();
  // an earlier send wrote the damage into the research, the app was given that state
  await w.ok(["note", "edit", "P0001", "1", damaged(PERSON_NOTE), "--reason", "the app's send"]);
  await w.ok(["source", "edit", "S0001", "--title", damaged(TITLE), "--reason", "the app's send"]);
  const ged = path.join(w.dir, "damaged-state.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  // mended in the research since
  await w.ok(["note", "edit", "P0001", "1", PERSON_NOTE, "--reason", "restore characters damaged by the app's GEDCOM line split"]);
  await w.ok(["source", "edit", "S0001", "--title", TITLE, "--reason", "restore characters damaged by the app's GEDCOM line split"]);
  const before = research(w);
  // the app still has the damaged state and sends it (damaged again on its way)
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, damaged(fs.readFileSync(ged, "utf8")));
  assert.match((await w.ok(["sync", file])).out, /nic nového/);
  await w.ok(["sync", file, "--apply"]);
  assert.deepEqual(research(w), before);
  w.cleanup();
});

test("a new note with a damaged emoji takes none from another person's note with the same words around it: it stays as it came", opts, async () => {
  const { w, ged } = await world();
  const file = path.join(w.dir, "z-aplikace.ged");
  const added = "Jiná věc. 🙏 Opsáno z pořadače u fary.";
  const text = fs.readFileSync(ged, "utf8").replace(/^1 REFN P0002$/m, `1 NOTE ${added}\n1 REFN P0002`);
  assert.notEqual(text, fs.readFileSync(ged, "utf8"));
  fs.writeFileSync(file, damaged(text));
  await w.ok(["sync", file, "--apply"]);
  const tree = Tree.open(w.cwd, w.env);
  const notes = tree.get<Person>("P0002")!.notes.map((n) => n.text);
  assert.ok(!notes.some((n) => n.includes("📌")), JSON.stringify(notes));
  assert.deepEqual(research(w).person, [PERSON_NOTE]);
  w.cleanup();
});
