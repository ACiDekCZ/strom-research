// A NAME's parts in a file that comes back (the tester's N11-a): strom sync reads a NAME the way strom intake does —
// one reading of the line, its GIVN / SURN / NPFX / NSFX and the Strom app's "? /Unknown/" — so a line without slashes
// with a GIVN and no SURN ("Hans Weber" + GIVN Johann) keeps its surname in a sync too, as the Strom app 3.10.0-beta.7
// reads it. Any accent, NFD, any script; the names written in NFC.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const shown = async (w: World, id: string) => ((await w.ok(["person", "show", id, "--json"])).json.person.names as { given: string; surname: string }[]).map(({ given, surname }) => ({ given, surname }));

/** The people a file adds: their NAME line and parts — what each must come in as. */
const added: [string, string[], { given: string; surname: string }][] = [
  ["1 NAME Hans Weber", ["2 GIVN Johann"], { given: "Johann", surname: "Weber" }],
  ["1 NAME Petr Novotný", ["2 GIVN Petr"], { given: "Petr", surname: "Novotný" }],
  ["1 NAME Petra Nováková", ["2 GIVN Petra"], { given: "Petra", surname: "Nováková" }],
  ["1 NAME Šimon Kovář".normalize("NFD"), ["2 GIVN Šimon"], { given: "Šimon", surname: "Kovář" }],
  ["1 NAME Пётр Иванов", ["2 GIVN Пётр"], { given: "Пётр", surname: "Иванов" }],
  ["1 NAME Tomáš /Veselý/", [], { given: "Tomáš", surname: "Veselý" }],
];

/** The research's file for the app with the people above added, under the HEAD's 1 SOUR (and its version). */
const withPeople = (text: string, head: string, vers?: string) =>
  text
    .replace(/^1 SOUR .*\r?\n(?:2 (?:VERS|NAME) .*\r?\n)*/m, `1 SOUR ${head}\n${vers ? `2 VERS ${vers}\n` : ""}`)
    .replace(/^0 TRLR/m, `${added.map(([name, parts], i) => [`0 @I${90 + i}@ INDI`, name, ...parts, "1 SEX M", "1 BIRT", `2 DATE ${1850 + i}`].join("\n")).join("\n")}\n0 TRLR`);

for (const [head, vers] of [["STROM", "1.0"], ["STROM", "3.10.0-beta.7"], ["OTHER_PROGRAM", undefined]] as const)
  test(`N11-a: strom sync keeps the surname of a NAME line without slashes that has a GIVN and no SURN (${head}${vers ? ` ${vers}` : ""}) — plan and --apply`, { skip: !hasGit }, async () => {
    const w = new World();
    await w.withTree();
    await w.ok(["person", "add", "Jan /Novák/", "--sex", "M", "--born", "1801"]); // P0001
    const given = path.join(w.dir, "given.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
    const file = path.join(w.dir, "back.ged");
    fs.writeFileSync(file, withPeople(fs.readFileSync(given, "utf8"), head, vers));
    const changes = (await w.ok(["sync", file, "--json"])).json.changes as { kind: string; name?: string }[];
    const named = changes.filter((c) => c.kind === "person.new").map((c) => (c.name ?? "").replace(/\//g, "").replace(/\s+/g, " ").trim());
    assert.deepEqual(named, added.map(([, , n]) => `${n.given} ${n.surname}`), JSON.stringify(changes));
    await w.ok(["sync", file, "--apply"]);
    for (const [i, [, , n]] of added.entries()) {
      const names = await shown(w, `P${String(i + 2).padStart(4, "0")}`);
      assert.deepEqual(names, [n]);
      assert.equal(names[0]!.surname, names[0]!.surname.normalize("NFC"), "kept in NFC");
    }
    // the same file again: nothing new
    assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, []);
    w.cleanup();
  });
