// A person removed in the Strom app is said so where the research shows them: person show starts with "removed in the
// Strom app (day) — to put back: strom sync undo I…" (the sync it came in), a person retracted another way with the day
// and why, and the relatives' listings (person show, family show) mark them — found: a person the app removed shown as
// any other, "child P0003 …" on the parent without a mark.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

/** No agent on this computer: the research waits for it and mirrors what the app sends. */
function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

/** Jan and Marie, their son Karel (P3) and Jiří (P4, retracted by hand); the app then sends the tree without Karel. */
async function world(): Promise<{ w: World; sync: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M", "--born", "1850"]); // P1
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]); // P2
  await w.ok(["person", "add", "Karel /Novák/", "--sex", "M", "--born", "1880"]); // P3
  await w.ok(["person", "add", "Jiří /Novák/", "--sex", "M"]); // P4
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2", "--child", "P3", "--child", "P4"]); // F1
  await w.ok(["person", "retract", "P4", "--reason", "Špatně přečtený zápis"]);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  let t = fs.readFileSync(given, "utf8");
  const xref = /0 @([^@]+)@ INDI\r?\n1 NAME Karel \/Novák\/\r?\n/.exec(t)![1]!;
  t = t.replace(/0 @[^@]+@ INDI\r?\n1 NAME Karel \/Novák\/\r?\n(?:[1-9].*\r?\n)*/, "").replace(new RegExp(`1 CHIL @${xref}@\\r?\\n`), "");
  const sent = path.join(w.dir, "app.ged");
  fs.writeFileSync(sent, t);
  noAgent(w);
  const sync = (await w.ok(["sync", sent, "--apply", "--json"])).json.input as string;
  return { w, sync };
}

test("person show of a person removed in the Strom app starts with it and the sync to undo; relatives marked; --json too", opts, async () => {
  const { w, sync } = await world();
  // a person reads it in the research's language
  const k = await w.ok(["person", "show", "P3"], { tty: true });
  const day = /^odebráno v aplikaci Strom \(([^)]+)\) – vrátit: strom sync undo (I\d+)$/.exec(k.out.split("\n")[0]!);
  assert.ok(day, k.out);
  assert.equal(day[2], sync);
  assert.match(k.out, /^P0003 Karel Novák/m, k.out);
  // the agent reads the English line, the same sync
  const en = await w.ok(["person", "show", "P3"]);
  assert.equal(en.out.split("\n")[0], `removed in the Strom app (${new Date().toISOString().slice(0, 10)}) — to put back: strom sync undo ${sync}`, en.out);
  const j = (await w.ok(["person", "show", "P3", "--json"])).json;
  assert.equal(j.removal.sync, sync);
  assert.equal(j.removal.undo, `strom sync undo ${sync}`);
  assert.match(j.removal.reason, /odebráno v aplikaci Strom/);
  // the parent: the children marked
  const jan = await w.ok(["person", "show", "P1"], { tty: true });
  assert.doesNotMatch(jan.out, /^odebráno/m, jan.out);
  assert.match(jan.out, /^ {4}dítě {2}P0003 Karel Novák \(\*1880\) \(odebráno\)$/m, jan.out);
  assert.match(jan.out, /^ {4}dítě {2}P0004 Jiří Novák \(odebráno\)$/m, jan.out);
  assert.match((await w.ok(["person", "show", "P1"])).out, /^ {4}child {2}P0003 Karel Novák \(\*1880\) \(retracted\)$/m);
  assert.deepEqual((await w.ok(["person", "show", "P1", "--json"])).json.retractedRelatives.sort(), ["P0003", "P0004"]);
  // the child: the parents unmarked; the family: its children marked
  assert.deepEqual((await w.ok(["person", "show", "P3", "--json"])).json.retractedRelatives, []);
  const f = await w.ok(["family", "show", "F1"], { tty: true });
  assert.match(f.out, /^ {2}P0003 Karel Novák \(\*1880\) \(odebráno\)$/m, f.out);
  assert.match(f.out, /^ {2}P0004 Jiří Novák \(odebráno\)$/m, f.out);
  assert.doesNotMatch(f.out, /P0001 Jan Novák \(\*1850\) \(odebráno\)/, f.out);
  assert.deepEqual((await w.ok(["family", "show", "F1", "--json"])).json.retractedPeople.sort(), ["P0003", "P0004"]);
  // the line's command puts Karel back: then shown as any other, no mark
  await w.ok(["sync", "undo", sync]);
  const back = await w.ok(["person", "show", "P3"], { tty: true });
  assert.doesNotMatch(back.out, /odebráno/, back.out);
  assert.equal((await w.ok(["person", "show", "P3", "--json"])).json.removal, undefined);
  assert.doesNotMatch((await w.ok(["person", "show", "P1"], { tty: true })).out, /P0003 Karel Novák \(\*1880\) \(odebráno\)/);
  w.cleanup();
});

test("person show of a person retracted another way: the day and why, no sync to undo", opts, async () => {
  const { w } = await world();
  const j = await w.ok(["person", "show", "P4"], { tty: true });
  assert.match(j.out.split("\n")[0]!, /^odebráno \([^,]+, Špatně přečtený zápis\)$/, j.out);
  assert.doesNotMatch(j.out, /sync undo/, j.out);
  const data = (await w.ok(["person", "show", "P4", "--json"])).json.removal;
  assert.equal(data.reason, "Špatně přečtený zápis");
  assert.equal(data.sync, undefined);
  w.cleanup();
});
