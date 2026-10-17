// The married names (_MARNM) of a family tree imported before strom read them (MyHeritage, Legacy, PAF): strom input
// names reads the file the research was started from again, finds the people imported from it by the IDs the import
// kept, and adds only the names of the married kind, citing the import — shown first, --apply, again nothing, --undo.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit || spawnSync("tar", ["--version"]).status !== 0 };



type Name = { given: string; surname: string; kind?: string; citations?: { source: string; locator?: string }[] };
type Row = { person: string; xref: string; name: string };

const fixture = path.join(import.meta.dirname, "..", "fixtures", "marnm", "1.15.0.tar.gz");

/**
 * A research started from a MyHeritage file by strom 1.15.0, which read no _MARNM (test/fixtures/marnm/make-tree.ts):
 * P1 Eva of the research, the file's @I1@…@I6@ as P2…P7; Anna's married name added since, the file's Eva merged into
 * P1, Jana withdrawn.
 */
function oldResearch(): { w: World; file: string } {
  const w = new World();
  const r = spawnSync("tar", ["-xzf", fixture, "-C", w.dir]);
  assert.equal(r.status, 0, String(r.stderr));
  const home = path.join(w.dir, "home");
  Object.assign(w.env, { HOME: home, USERPROFILE: home, STROM_CONFIG_DIR: path.join(w.dir, "config") });
  const config = path.join(w.dir, "config", "config.json");
  fs.writeFileSync(config, JSON.stringify({ ...readJsonFile(config), home: w.home }, null, 2));
  w.cwd = w.treeDir("Novákovi");
  return { w, file: path.join(w.cwd, "inputs", "I0001-rodokmen.ged") };
}

const people = (w: World): Record<string, { id: string; names: Name[] }> =>
  Object.fromEntries(fs.readdirSync(path.join(w.cwd, "data", "persons")).map((f) => [f.replace(/\.json$/, ""), readJsonFile(path.join(w.cwd, "data", "persons", f))]));

test("strom input names: shown first, --apply adds only the married names citing the import, again nothing, --undo as it was", opts, async () => {
  const { w, file } = oldResearch();
  const before = JSON.stringify(people(w));

  const shown = (await w.ok(["input", "names", "I0001", "--json"])).json;
  const rows = (r: Row[]) => r.map((x) => `${x.person} ${x.name}`).sort();
  assert.deepEqual(rows(shown.add), ["P0001 Eva /Šťastná/", "P0002 Marie /Nováková/", "P0004 Ольга /Иванова/"]);
  assert.deepEqual(rows(shown.have), ["P0003 Anna /Černá/"]);
  assert.deepEqual(shown.unpaired.map((u: { xref: string }) => u.xref), ["@I4@"], "the withdrawn one is only listed");
  assert.equal(shown.applied, false);
  assert.equal(JSON.stringify(people(w)), before, "nothing written without --apply");

  // the file taken in again: known already, and said how its married names come in
  assert.match((await w.ok(["intake", file])).out, /I0001: 3 married name\(s\) it gives were left out when it was imported → strom input names I0001/);
  // the same file names the same input
  assert.deepEqual(rows((await w.ok(["input", "names", file, "--json"])).json.add), rows(shown.add));

  const applied = await w.ok(["input", "names", "I0001", "--apply"]);
  assert.match(applied.out, /3 married name\(s\) added, 1 already there, 1 person\(s\) of the file not in the research/);
  const after = people(w);
  const married = after.P0002!.names.at(-1)!;
  assert.deepEqual([married.given, married.surname, married.kind], ["Marie", "Nováková".normalize("NFC"), "married"], "NFC as every record");
  assert.deepEqual(married.citations, [{ source: shown.source, locator: "I1 _MARNM" }]);
  assert.equal(after.P0002!.names[0]!.surname, "Dvořáková", "shown by the birth name still");
  assert.deepEqual(after.P0004!.names.map((n) => n.surname), ["Петрова", "Иванова"]);
  assert.deepEqual(after.P0001!.names.map((n) => [n.surname, n.kind]), [["Horáková", undefined], ["Šťastná", "married"]], "the merged person's name goes to the one kept");
  for (const id of ["P0003", "P0005", "P0006", "P0007"]) assert.deepEqual(after[id], JSON.parse(before)[id], `${id} as it was`);
  assert.match((await w.ok(["check"])).out, /^ok|chyby: 0,/);

  assert.doesNotMatch((await w.ok(["intake", file])).out, /married name/, "nothing left out: nothing said");
  const again = (await w.ok(["input", "names", "I0001", "--apply", "--json"])).json;
  assert.equal(again.add.length, 0, "again: nothing added");
  assert.equal(again.have.length, 4);

  const undone = (await w.ok(["input", "names", "I0001", "--undo", "--json"])).json;
  assert.equal(undone.undone.length, 3);
  for (const [id, p] of Object.entries(people(w))) assert.deepEqual(p.names, JSON.parse(before)[id].names, `${id}: its names as before`);
  assert.match((await w.ok(["check"])).out, /^ok|chyby: 0,/);
  w.cleanup();
});

test("strom input names: another file than the one imported is refused, so is an input that is no imported tree", opts, async () => {
  const { w, file } = oldResearch();
  const other = path.join(w.dir, "export2.ged");
  fs.writeFileSync(other, fs.readFileSync(file, "utf8").replace("1 BIRT", "1 DEAT"));
  const refused = await w.run(["input", "names", other]);
  assert.notEqual(refused.code, 0);
  assert.match(refused.out + refused.err, /not a family tree this research was started from/);
  await w.ok(["intake", "--text", "Babička vyprávěla o Marii."]);
  const text = await w.run(["input", "names", "I0002"]);
  assert.notEqual(text.code, 0);
  assert.match(text.out + text.err, /not a GEDCOM family tree/);
  const none = await w.run(["input", "names", "I0099"]);
  assert.notEqual(none.code, 0);
  assert.match(none.out + none.err, /no input I0099 in this research/);
  assert.match(none.out + none.err, /strom input list/);
  w.cleanup();
});
