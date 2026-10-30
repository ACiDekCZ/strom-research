// strom sync: what a Strom app before 3.17.0-beta.9 makes of a period and an age it cannot keep as they are — FROM x TO y sent
// back as BET x AND y (FROM x as AFT x, TO y as BEF y), an age without its units of nothing ("0y 2m 26d" as "2m 26d")
// — is not the user's edit: an unedited tree comes back with no change, also where a person has many facts of a kind.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World } from "../helpers.ts";
import { opts } from "./sync.helpers.ts";

/** A research of the Lhotáks: periods of a residence and an occupation, a child's death at an age of no years. */
async function lhotaci(): Promise<{ w: World; ged: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Soupis obyvatel Lhoty 1871", "--kind", "census"]); // S1
  await w.ok(["source", "add", "Úmrtí ve Lhotě 1866", "--kind", "death"]); // S2
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["event", "add", "P1", "RESI", "--date", "FROM 22 MAR 1871 TO 22 MAR 1882", "--place", "Lhota", "--house", "6", "--cite", "S1"]);
  await w.ok(["event", "add", "P1", "RESI", "--date", "FROM 2 SEP 1888 TO 8 AUG 1893", "--place", "Lhota", "--house", "13", "--cite", "S1"]);
  await w.ok(["event", "add", "P1", "RESI", "--date", "19 FEB 1855", "--place", "Lhota", "--house", "3", "--cite", "S1"]);
  await w.ok(["event", "add", "P1", "RESI", "--date", "FROM 1895", "--place", "Lhota", "--house", "21"]); // a lead
  await w.ok(["event", "add", "P1", "OCCU", "--value", "nádeník", "--date", "FROM 22 MAR 1871 TO 22 MAR 1882", "--place", "Lhota", "--cite", "S1"]);
  await w.ok(["event", "add", "P1", "OCCU", "--value", "dělník", "--date", "TO 8 AUG 1893", "--place", "Lhota"]); // a lead
  await w.ok(["person", "add", "Ludmila /Lhotáková/", "--sex", "F"]); // P2
  await w.ok(["event", "add", "P2", "DEAT", "--date", "9 SEP 1866", "--place", "Lhota", "--house", "16", "--age", "0y 2m 26d", "--cause", "psotník", "--cite", "S2"]);
  await w.ok(["person", "add", "Ondřej /Lhoták/", "--sex", "M"]); // P3
  await w.ok(["event", "add", "P3", "DEAT", "--date", "1901", "--place", "Lhota", "--age", "54y 0m 3d"]); // a lead
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  return { w, ged };
}

/** The file as a Strom app before 3.17 gives it back: every period a range, every age without its units of nothing. */
function asOldApp(t: string): string {
  return t
    .replace(/^2 DATE FROM (.+?) TO (.+)$/gm, "2 DATE BET $1 AND $2")
    .replace(/^2 DATE FROM (.+)$/gm, "2 DATE AFT $1")
    .replace(/^2 DATE TO (.+)$/gm, "2 DATE BEF $1")
    .replace(/^2 AGE (.+)$/gm, (_, a: string) => `2 AGE ${a.split(" ").filter((u) => !/^0[ymd]$/.test(u)).join(" ")}`);
}

test("a period sent back as a range and an age without its units of nothing are no edit: an unedited tree of the old app gives no change", opts, async () => {
  const { w, ged } = await lhotaci();
  const t = fs.readFileSync(ged, "utf8");
  const old = asOldApp(t);
  assert.equal((old.match(/^2 DATE (BET .+ AND|AFT|BEF) /gm) ?? []).length, 5, "every period as the old app sends it");
  assert.match(old, /^2 AGE 2m 26d$/m);
  assert.match(old, /^2 AGE 54y 3d$/m);
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, old);
  const r = await w.ok(["sync", file, "--json"]);
  assert.deepEqual(r.json.changes, [], JSON.stringify(r.json.changes));
  // the same where the user's word wins (sync.edits user; an archive the same)
  await w.ok(["config", "set", "sync.edits", "user"], { tty: true });
  assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, []);
  w.cleanup();
});

test("an edit of the old app beside the period is still the user's: another end of the range, another age, a residence added", opts, async () => {
  const { w, ged } = await lhotaci();
  const old = asOldApp(fs.readFileSync(ged, "utf8"))
    .replace("2 DATE BET 22 MAR 1871 AND 22 MAR 1882\n2 PLAC Lhota\n2 ADDR čp. 6", "2 DATE BET 22 MAR 1871 AND 22 MAR 1883\n2 PLAC Lhota\n2 ADDR čp. 6")
    .replace("2 AGE 2m 26d", "2 AGE 3m 26d");
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, old);
  const r = await w.ok(["sync", file, "--json"]);
  const kinds = r.json.changes.map((c: { kind: string; fact?: { kind: string; date?: string; age?: string } }) => `${c.kind} ${c.fact?.kind} ${c.fact?.date ?? ""} ${c.fact?.age ?? ""}`.trim());
  assert.ok(kinds.some((k: string) => /RESI BET 22 MAR 1871 AND 22 MAR 1883/.test(k)), kinds.join("; "));
  assert.ok(kinds.some((k: string) => /DEAT 9 SEP 1866 3m 26d/.test(k)), kinds.join("; "));
  assert.ok(!kinds.some((k: string) => /FROM|1882|1888|1893|1895|54y/.test(k)), kinds.join("; "));
  w.cleanup();
});

/** The file as the Strom app of this version names itself in its HEAD (1 SOUR STROM, 2 VERS); no version: none said. */
function fromApp(t: string, version?: string): string {
  const head = /^1 SOUR STROM_RESEARCH\r?\n2 VERS .*\r?\n2 NAME .*\r?\n/m;
  assert.match(t, head);
  return t.replace(head, `1 SOUR STROM\n${version ? `2 VERS ${version}\n` : ""}2 NAME Strom\n`);
}

/** The user's own edits of the shapes in the app: a period made a range, FROM made AFT, an age's zero units left out. */
function edited(t: string): string {
  const out = t
    .replace("2 DATE FROM 22 MAR 1871 TO 22 MAR 1882\n2 PLAC Lhota\n2 ADDR čp. 6", "2 DATE BET 22 MAR 1871 AND 22 MAR 1882\n2 PLAC Lhota\n2 ADDR čp. 6")
    .replace("2 DATE FROM 1895", "2 DATE AFT 1895")
    .replace("2 AGE 0y 2m 26d", "2 AGE 2m 26d");
  assert.equal((out.match(/BET 22 MAR 1871 AND 22 MAR 1882|AFT 1895|AGE 2m 26d/g) ?? []).length, 3, "each edit made");
  return out;
}

const said = (r: { json: { changes: { kind: string; fact?: { kind: string; date?: string; age?: string } }[] } }) =>
  r.json.changes.map((c) => `${c.kind} ${c.fact?.kind ?? ""} ${c.fact?.date ?? ""} ${c.fact?.age ?? ""}`.trim());

test("an app that cannot keep a period (before 3.17.0-beta.9) or names no version: such a change is still its shape, no edit", opts, async () => {
  const { w, ged } = await lhotaci();
  try {
    const t = fs.readFileSync(ged, "utf8");
    const file = path.join(w.dir, "z-aplikace.ged");
    for (const v of ["3.17.0-beta.8", "3.16.2", "1.0", undefined]) {
      fs.writeFileSync(file, fromApp(edited(t), v));
      assert.deepEqual(said(await w.ok(["sync", file, "--json"])), [], String(v));
      fs.writeFileSync(file, fromApp(asOldApp(t), v));
      assert.deepEqual(said(await w.ok(["sync", file, "--json"])), [], `${v}: the old app's whole file`);
    }
  } finally {
    w.cleanup();
  }
});

test("an app that keeps a period (3.17.0-beta.9 on): a period made a range, FROM made AFT, an age's zero units left out are the user's edits", opts, async () => {
  const { w, ged } = await lhotaci();
  try {
    const t = fs.readFileSync(ged, "utf8");
    const file = path.join(w.dir, "z-aplikace.ged");
    for (const v of ["3.17.0-beta.9", "3.17.0-beta.10", "3.17.0"]) {
      // unedited, as the app gives it back: nothing
      fs.writeFileSync(file, fromApp(t, v));
      assert.deepEqual(said(await w.ok(["sync", file, "--json"])), [], `${v}: unedited`);
      fs.writeFileSync(file, fromApp(edited(t), v));
      const kinds = said(await w.ok(["sync", file, "--json"]));
      assert.ok(kinds.some((k) => /RESI BET 22 MAR 1871 AND 22 MAR 1882/.test(k)), `${v}: ${kinds.join("; ")}`);
      assert.ok(kinds.some((k) => /RESI AFT 1895/.test(k)), `${v}: ${kinds.join("; ")}`);
      assert.ok(kinds.some((k) => /DEAT 9 SEP 1866 2m 26d/.test(k)), `${v}: ${kinds.join("; ")}`);
      assert.ok(!kinds.some((k) => /1888|1893|54y/.test(k)), `${v}: nothing else — ${kinds.join("; ")}`);
    }
  } finally {
    w.cleanup();
  }
});

test("a new residence with a range in an app that keeps periods stays a range beside the research's period of another place", opts, async () => {
  const { w, ged } = await lhotaci();
  try {
    const t = fs.readFileSync(ged, "utf8");
    const add = (x: string) => x.replace(/(1 RESI\n2 DATE FROM 22 MAR 1871 TO 22 MAR 1882\n)/, "1 RESI\n2 DATE BET 22 MAR 1871 AND 22 MAR 1882\n2 PLAC Praha\n$1");
    assert.notEqual(add(t), t);
    const file = path.join(w.dir, "z-aplikace.ged");
    fs.writeFileSync(file, fromApp(add(t), "3.17.0-beta.9"));
    const kinds = said(await w.ok(["sync", file, "--json"]));
    assert.ok(kinds.some((k) => /^fact\.new RESI BET 22 MAR 1871 AND 22 MAR 1882$/.test(k)), kinds.join("; "));
    assert.ok(!kinds.some((k) => /FROM/.test(k)), kinds.join("; "));
  } finally {
    w.cleanup();
  }
});

test("an age of nothing at all in any of its units sent back as the old app's 0y is no edit", opts, async () => {
  const w = new World();
  await w.withTree();
  try {
    await w.ok(["person", "add", "Vendula /Lhotáková/", "--sex", "F"]); // P1
    await w.ok(["event", "add", "P1", "DEAT", "--date", "2 JAN 1868", "--place", "Lhota", "--age", "0y 0m 0d"]);
    await w.ok(["person", "add", "Мария /Лоткова/", "--sex", "F"]); // P2
    await w.ok(["event", "add", "P2", "DEAT", "--date", "3 JAN 1868", "--place", "Lhota", "--age", "0d"]);
    await w.ok(["person", "add", "Zbyňka /Lhotáková/", "--sex", "F"]); // P3
    await w.ok(["event", "add", "P3", "DEAT", "--date", "4 JAN 1868", "--place", "Lhota", "--age", "0m"]);
    const ged = path.join(w.dir, "strom.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
    const t = fs.readFileSync(ged, "utf8");
    assert.equal((t.match(/^2 AGE (0y 0m 0d|0d|0m)$/gm) ?? []).length, 3, "each as the research wrote it");
    const file = path.join(w.dir, "z-aplikace.ged");
    fs.writeFileSync(file, fromApp(t.replace(/^2 AGE (0y 0m 0d|0d|0m)$/gm, "2 AGE 0y"), "3.17.0-beta.8"));
    assert.deepEqual(said(await w.ok(["sync", file, "--json"])), []);
    // another age is the user's still
    fs.writeFileSync(file, fromApp(t.replace("2 AGE 0y 0m 0d", "2 AGE 1d"), "3.17.0-beta.8"));
    assert.deepEqual(said(await w.ok(["sync", file, "--json"])), ["fact.detail DEAT 2 JAN 1868 1d"]);
  } finally {
    w.cleanup();
  }
});

test("an age the research wrote with a leading zero (05y) comes back from the app as 5y: no edit, also from an app that keeps every shape", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
    await w.ok(["event", "add", "P1", "DEAT", "--date", "1866", "--place", "Lhota", "--age", "05y"]);
    const ged = path.join(w.dir, "strom.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
    const t = fs.readFileSync(ged, "utf8");
    assert.match(t, /^2 AGE 5y$/m, "written without the zero");
    const file = path.join(w.dir, "z-aplikace.ged");
    for (const version of ["3.18.0", undefined]) {
      fs.writeFileSync(file, fromApp(t, version));
      assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, [], String(version));
    }
    // another age is still the user's edit
    fs.writeFileSync(file, fromApp(t, "3.18.0").replace("2 AGE 5y", "2 AGE 6y"));
    assert.ok(said(await w.ok(["sync", file, "--json"])).some((k) => /DEAT 1866 6y/.test(k)));
  } finally {
    w.cleanup();
  }
});
