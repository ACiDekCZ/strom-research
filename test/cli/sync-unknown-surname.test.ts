// A person of no given name with the surname Unknown (the tester's T08b-a): the Strom app from 3.10.0-beta.7 reads
// "? /Unknown/" in the research's file as a person of no surname unless its SURN says the surname — so the research
// spells that name out (2 GIVN ?, 2 SURN Unknown) in the file for the app and in the standard one, whatever the
// titles. Its own person of no name and no surname stays "? //". Research → app (its own parser and exporter) →
// research: the surname Unknown kept, the person of no surname without one, nothing changed.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const plan = async (w: World, file: string) => (await w.ok(["sync", file, "--json"])).json.changes as unknown[];
const shown = async (w: World, id: string) => ((await w.ok(["person", "show", id, "--json"])).json.person.names as { given: string; surname: string }[]).map(({ given, surname }) => ({ given, surname }));

/** A research of Jan Novák (P0001), "?" with the surname Unknown (P0002), "?" of no surname (P0003), "?" with the surname unknown (P0004). */
async function research(): Promise<{ w: World; given: (standard?: boolean) => Promise<string> }> {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M", "--born", "1901"]);
  const ged = ["0 HEAD", "1 SOUR OTHER_PROGRAM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
  for (const [i, name] of ["? /Unknown/", "? //", "? /unknown/"].entries()) ged.push(`0 @I${i + 1}@ INDI`, `1 NAME ${name}`, "1 SEX F", "1 BIRT", `2 DATE ${1930 + i}`);
  ged.push("0 TRLR");
  fs.writeFileSync(path.join(w.dir, "people.ged"), ged.join("\n") + "\n");
  await w.ok(["intake", path.join(w.dir, "people.ged")]);
  let n = 0;
  const given = async (standard = false) => {
    const out = path.join(w.dir, `given-${++n}.ged`);
    await w.ok(["export", "gedcom", ...(standard ? ["--for", "standard"] : ["--for", "strom", "--images-for", "none"]), "--out", out]);
    return out;
  };
  return { w, given };
}

/** The NAME block of a person (its REFN) in a file. */
const nameBlock = (text: string, id: string) => {
  const rec = text.split(/\r?\n(?=0 )/).find((r) => new RegExp(`\\n1 REFN ${id}\\r?\\n`).test(r))!;
  return rec.split(/\r?\n/).filter((l, i, all) => /^1 NAME /.test(l) || (/^2 (GIVN|SURN|NPFX|NSFX) /.test(l) && all.slice(0, i).reverse().find((x) => /^1 /.test(x))?.startsWith("1 NAME")));
};

test("T08b-a: \"?\" with the surname Unknown is written 1 NAME ? /Unknown/ + 2 GIVN ? + 2 SURN Unknown (the Strom file and the standard one); \"? //\" and the other names as before", { skip: !hasGit }, async () => {
  const { w, given } = await research();
  assert.deepEqual(await shown(w, "P0002"), [{ given: "?", surname: "Unknown" }]);
  assert.deepEqual(await shown(w, "P0003"), [{ given: "?", surname: "" }]);
  for (const standard of [false, true]) {
    const text = fs.readFileSync(await given(standard), "utf8");
    assert.deepEqual(nameBlock(text, "P0002"), ["1 NAME ? /Unknown/", "2 GIVN ?", "2 SURN Unknown"], `standard: ${standard}`);
    assert.deepEqual(nameBlock(text, "P0004"), ["1 NAME ? /unknown/", "2 GIVN ?", "2 SURN unknown"], `standard: ${standard}`);
    assert.deepEqual(nameBlock(text, "P0003"), ["1 NAME ? //"], `standard: ${standard}`);
    assert.deepEqual(nameBlock(text, "P0001"), ["1 NAME Jan /Novák/"], `standard: ${standard}`);
  }
  // the research's own file back: nothing
  assert.deepEqual(await plan(w, await given()), []);
  w.cleanup();
});

// The Strom app's own parser and exporter (../strom: the app released, ../strom-beta: the one coming).
for (const dir of ["strom", "strom-beta"]) {
  const repo = path.resolve(import.meta.dirname, "..", "..", "..", dir);
  const tsx = path.join(repo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const version = fs.existsSync(path.join(repo, "package.json")) ? (JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).version as string) : "";
  test(`T08b-a: the Strom app ${version || dir} (its own parser and exporter) keeps "?" with the surname Unknown, the person of no surname without one; research → app → research: no change`, { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
    const { w, given } = await research();
    const script = path.join(w.dir, "app.ts");
    fs.writeFileSync(
      script,
      `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(repo, "src", "ged-parser.ts"))};
import { exportToGedcom } from ${JSON.stringify(path.join(repo, "src", "ged-exporter.ts"))};
const text = fs.readFileSync(process.argv[2]!, "utf8");
const [tree, head] = [/^1 _STROM_TREE (.+)$/m.exec(text)![1]!, /^1 _STROM_HEAD (.+)$/m.exec(text)![1]!];
const data = convertToStrom(parseGedcom(text)).data;
fs.writeFileSync(process.argv[3]!, exportToGedcom(data, "Novákovi", { research: { id: tree, head } }).content);
console.log(JSON.stringify((Object.values(data.persons) as any[]).filter((p) => p.birthDate).map((p) => [p.firstName, p.lastName, p.birthDate])));
`,
    );
    const out = path.join(w.dir, "back.ged");
    const r = spawnSync(tsx, [script, await given(), out], { cwd: repo, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const read = (JSON.parse(r.stdout.trim().split("\n").pop()!) as [string, string, string][]).sort((a, b) => a[2].localeCompare(b[2]));
    assert.deepEqual(
      read.map(([f, l]) => [f, l]),
      [["Jan", "Novák"], ["?", "Unknown"], ["?", ""], ["?", "unknown"]],
      "the app reads them as the research has them",
    );
    assert.deepEqual(await plan(w, out), [], "unedited: nothing");
    await w.ok(["sync", out, "--apply"]);
    assert.deepEqual(await shown(w, "P0002"), [{ given: "?", surname: "Unknown" }]);
    assert.deepEqual(await shown(w, "P0003"), [{ given: "?", surname: "" }]);
    assert.deepEqual(await shown(w, "P0004"), [{ given: "?", surname: "unknown" }]);
    w.cleanup();
  });
}
