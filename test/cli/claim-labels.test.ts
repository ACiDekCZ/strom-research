// A conflict's claim never keeps a batch's label as text (found by the Strom app's tester: "@s: …" in the app's dialog
// and in the GEDCOM, its source not cited): in a batch the label before a claim's colon is the source's ID (also with
// spaces around it, in any script); outside a batch a claim beginning with a label is refused with the way; and what an
// older strom wrote so is read as the claim of the source its batch created — the label taken off, a SOUR under it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { withLabels } from "../../src/commands/batch.ts";
import { leadingLabel } from "../../src/core/labels.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";

const opts = { skip: !hasGit };

const conflictOf = (ged: string, id: string) => new RegExp(`\\n1 _STROM_CONFLICT ${id}\\n((?:[2-9] .*\\n)*)`, "u").exec(ged)?.[1] ?? "";

test("labels: a label before a claim's colon is read in words with spaces, nothing else in them", () => {
  const labels = new Map([["s", "S0004"], ["křest", "S0005"]]);
  const unknown: string[] = [];
  assert.deepEqual(
    withLabels(
      ["conflict", "add", "Rok narození", "--claim", "@s: 27 let při sňatku", "--claim", "@s : 70 let", "--claim=@s: 1839", "--claim", "@ křest:1885", "--claim", "@křest: 1886", "--claim", "S0001: ve 27 letech @s", "--note", "@s: poznámka"],
      labels,
      unknown,
    ),
    ["conflict", "add", "Rok narození", "--claim", "S0004: 27 let při sňatku", "--claim", "S0004 : 70 let", "--claim=S0004: 1839", "--claim", "S0005:1885", "--claim", "S0005: 1886", "--claim", "S0001: ve 27 letech @s", "--note", "@s: poznámka"],
  );
  assert.deepEqual(unknown, []);
  withLabels(["--claim", "@марія: 1885"], labels, unknown);
  assert.deepEqual(unknown, ["марія"]);
  assert.deepEqual(leadingLabel("  @ s :1885"), { label: "s", rest: "1885" });
  assert.equal(leadingLabel("S0001: 1885"), undefined);
  assert.equal(leadingLabel("jan@s: 1885"), undefined);
});

test("batch: a claim's label with a space after it cites the source the batch created; one never defined is said", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["source", "add", "Sňatek Jana Lhotáka 1839", "--kind", "marriage"]); // S1
  const b = await w.ok(["batch", 'source add "Úmrtí Jana Lhotáka 1883" --kind burial #úmrtí', 'conflict add "Rok narození Jana" --about P1 --fact BIRT --claim "S1: 27 let při sňatku 1839" --claim "@úmrtí : 70 let při úmrtí 1883"']);
  assert.match(b.out, /2 commands as one change/);
  const x = readJsonFile(path.join(w.cwd, "data", "conflicts", "X0001.json"));
  assert.deepEqual(x.claims, [
    { source: "S0001", value: "27 let při sňatku 1839" },
    { source: "S0002", value: "70 let při úmrtí 1883" },
  ]);

  const missing = await w.run(["batch", 'conflict add "Rok narození Jana" --about P1 --claim "S1: 1812" --claim "@s: 1813"']);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /@s is not defined/);
  assert.equal(fs.existsSync(path.join(w.cwd, "data", "conflicts", "X0002.json")), false);
  w.cleanup();
});

test("conflict add: a claim beginning with a label is refused with the way, nothing written; @S… names the source", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
  await w.ok(["source", "add", "Sňatek Jana Lhotáka 1839", "--kind", "marriage"]);
  for (const claim of ["@s: 70 let", "@ s :70 let", "@lhotá: 70 let"]) {
    const r = await w.run(["conflict", "add", "Rok narození Jana", "--about", "P1", "--claim", "S1: 27 let", "--claim", claim, "--json"]);
    assert.equal(r.code, 2, claim);
    const e = JSON.parse(r.out);
    assert.equal(e.code, "conflict.claim-label");
    assert.match(e.message, /is no source/);
    assert.match(e.hint, /--claim "S…: 70 let"/);
  }
  assert.equal(fs.existsSync(path.join(w.cwd, "data", "conflicts", "X0001.json")), false);
  await w.ok(["conflict", "add", "Rok narození Jana", "--about", "P1", "--claim", "S1: 27 let", "--claim", "@S0001: 70 let"]);
  assert.deepEqual(readJsonFile(path.join(w.cwd, "data", "conflicts", "X0001.json")).claims, [
    { source: "S0001", value: "27 let" },
    { source: "S0001", value: "70 let" },
  ]);
  w.cleanup();
});

test("old data: a claim an older strom kept as '@s: …' is read as the claim of its batch's source — no raw label in the GEDCOM or in conflict show", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["source", "add", "Sňatek Jana Lhotáka 1839", "--kind", "marriage"]); // S1
  // X1: its batch created one source (S2); X2: its batch two (S3, S4) — which one the label named is not guessed;
  // X3: a conflict on its own, no source created with it
  await w.ok(["batch", 'source add "Úmrtí Jana Lhotáka 1883" --kind burial #s', 'conflict add "Rok narození Jana" --about P1 --fact BIRT --claim "S1: 27 let" --claim "S2: 70 let"']);
  await w.ok(["batch", 'source add "Křest v Lhotě" --kind baptism #a', 'source add "Pohřeb v Lhotě" --kind burial #b', 'conflict add "Místo narození Jana" --about P1 --fact BIRT --claim "S1: Lhota" --claim "S4: Lhotka"']);
  await w.ok(["conflict", "add", "Rok úmrtí Jana", "--about", "P1", "--fact", "DEAT", "--claim", "S1: 1883", "--claim", "S2: 1884"]);
  // what a strom before the fix wrote: the label kept in the value, no source (the history as it was: the same ops)
  const old = (id: string, i: number, value: string) => {
    const file = path.join(w.cwd, "data", "conflicts", `${id}.json`);
    const x = readJsonFile(file);
    x.claims[i] = { value };
    fs.writeFileSync(file, JSON.stringify(x, null, 2) + "\n");
  };
  old("X0001", 1, "@s: 70 let");
  old("X0002", 1, "@b:Lhotka");
  old("X0003", 1, "@ s : 1884");

  const tree = Tree.open(w.cwd, w.env);
  const ged = exportGedcom(tree, { for: "strom", research: true }).text;
  assert.equal(conflictOf(ged, "X0001"), "2 TYPE BIRT\n2 TITL Rok narození Jana\n2 STAT open\n2 VAL 27 let\n3 SOUR @S0001@\n2 VAL 70 let\n3 SOUR @S0002@\n");
  assert.equal(conflictOf(ged, "X0002"), "2 TYPE BIRT\n2 TITL Místo narození Jana\n2 STAT open\n2 VAL Lhota\n3 SOUR @S0001@\n2 VAL Lhotka\n");
  assert.equal(conflictOf(ged, "X0003"), "2 TYPE DEAT\n2 TITL Rok úmrtí Jana\n2 STAT open\n2 VAL 1883\n3 SOUR @S0001@\n2 VAL 1884\n");
  assert.doesNotMatch(ged, /@\s*[\p{L}_][\p{L}\p{M}\p{N}_-]*\s*:/u, "no raw label anywhere in the file");
  // its source in the file too (cited by the conflict)
  assert.match(ged, /\n0 @S0002@ SOUR\n/);

  const shown = (await w.ok(["conflict", "show", "X0001"])).out;
  assert.match(shown, /S0002: 70 let/);
  assert.doesNotMatch(shown, /@s/);
  // nothing rewritten in the record: read so, kept as it was
  assert.deepEqual(readJsonFile(path.join(w.cwd, "data", "conflicts", "X0001.json")).claims[1], { value: "@s: 70 let" });
  w.cleanup();
});
