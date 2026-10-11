// A batch's labels are references, never text: "@anna" as a word, a role's or an option's value, a list item — an
// e-mail address in a note or a file given as "@file" stays as written. A dry run is the whole batch's.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { withLabels } from "../../src/commands/batch.ts";

const opts = { skip: !hasGit };

test("labels: only whole references are replaced", () => {
  const labels = new Map([["anna", "P0005"], ["šimon", "P0006"]]);
  const unknown: string[] = [];
  assert.deepEqual(
    withLabels(["family", "add", "--partner", "@anna", "--partner=@šimon", "--with", "godparent:@anna", "--age", "@anna:22", "--found", "S0001,@anna", "--note", "e-mail petr@anna.cz", "--transcript", "@anna", "--url", "https://x.example/@anna", "petr@anna.cz"], labels, unknown),
    ["family", "add", "--partner", "P0005", "--partner=P0006", "--with", "godparent:P0005", "--age", "P0005:22", "--found", "S0001,P0005", "--note", "e-mail petr@anna.cz", "--transcript", "@anna", "--url", "https://x.example/@anna", "petr@anna.cz"],
  );
  assert.deepEqual(unknown, []);
  withLabels(["--partner", "@marie"], labels, unknown);
  assert.deepEqual(unknown, ["marie"]);
});

test("batch: a note with an e-mail keeps it; a file given as @file is read; a dry run inside a line is refused", opts, async () => {
  const w = new World();
  await w.withTree();
  fs.writeFileSync(path.join(w.cwd, "anna"), "Anna, dcera Jana");
  const b = await w.ok([
    "batch",
    'person add "Anna /Svobodová/" --sex F #anna',
    'note add @anna "dopis od petr@anna.cz"',
    'source add "Křest Anny" --kind baptism --transcript @anna #zapis',
  ]);
  assert.match(b.out, /3 command\(s\) as one change/);
  const p = readJsonFile(path.join(w.cwd, "data", "persons", "P0001.json"));
  assert.equal(p.notes[0].text, "dopis od petr@anna.cz");
  const s = readJsonFile(path.join(w.cwd, "data", "sources", "S0001.json"));
  assert.equal(s.transcript, "Anna, dcera Jana");

  const dry = await w.run(["batch", 'person add "Jan /Novák/" --sex M --dry-run']);
  assert.equal(dry.code, 2);
  assert.match(dry.err, /--dry-run applies to the whole batch: strom batch --dry-run/);
  assert.equal(fs.existsSync(path.join(w.cwd, "data", "persons", "P0002.json")), false);
  w.cleanup();
});
