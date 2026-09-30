// The story of a person or a couple: written from the facts, a draft until the
// user approves it, and in the GEDCOM exactly as the Strom app sets it in the
// family book.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { parseGedcomText } from "../../src/gedcom/parse.ts";

const opts = { skip: !hasGit };

test("story set / show: the facts it rests on, draft or final, _STORY in the GEDCOM", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "František /Víšek/", "--sex", "M"]); // P1
  await w.ok(["source", "add", "Křest Františka 1862", "--kind", "baptism", "--information", "primary"]); // S1
  await w.ok(["event", "add", "P1", "BIRT", "--date", "18 OCT 1862", "--place", "Vavřinec", "--house", "13", "--cite", "S1", "--status", "proven"]); // E1
  fs.mkdirSync(path.join(w.cwd, "notes"), { recursive: true });
  const text = "František se narodil **18. října 1862** ve Vavřinci v domě čp. 13.\n\nJeho otec Antonín byl podruh — neměl vlastní dům.";
  fs.writeFileSync(path.join(w.cwd, "notes", "story-P0001.md"), text + "\n");
  const r = await w.ok(["story", "set", "P1", "--text", "@notes/story-P0001.md", "--title", "Syn podruha", "--fact", "E1", "--note", "Povolání otce je z jednoho zápisu."]);
  assert.match(r.out, /P0001 story: \d+ words, draft/);
  const show = (await w.ok(["story", "show", "František Víšek"])).out;
  assert.match(show, /^P0001 story · draft · \d{4}-\d\d-\d\d · Syn podruha\n\nFrantišek se narodil/);
  assert.match(show, /rests on\n  E0001 P0001 BIRT 18 OCT 1862 Vavřinec \[proven\]/);
  assert.equal((await w.run(["story", "set", "P1", "--text", "x", "--fact", "E9"])).code, 2, "the facts must exist");
  assert.match((await w.ok(["brief"])).out, /story: draft "Syn podruha", \d+ words \(strom story show P0001\)/);

  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.match(ged, /1 _STORY\n2 TYPE vypraveni\n2 TITL Syn podruha\n2 STAT navrh\n2 TEXT František se narodil \*\*18. října 1862\*\* ve Vavřinci v domě čp. 13.\n3 CONT\n3 CONT Jeho otec Antonín byl podruh — neměl vlastní dům.\n2 DATA BIRT 18 OCT 1862 Vavřinec \[S0001\]\n2 NOTE Povolání otce je z jednoho zápisu.\n/);
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  // the text survives a round trip through the parser, paragraphs and all
  const indi = parseGedcomText(ged).records.find((x) => x.tag === "INDI")!;
  assert.ok(indi.children.some((c) => c.tag === "_STORY"));

  await w.ok(["story", "set", "P1", "--text", text, "--fact", "E1", "--final"]);
  await w.ok(["export", "gedcom"]);
  assert.match(fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8"), /2 STAT hotovo/);
  const strict = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.ok(!strict.includes("_STORY"));
  assert.match(strict, /1 NOTE František se narodil/);
  assert.deepEqual(validateGedcom(strict, { strict: true }).filter((f) => f.level === "error"), []);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("the story's format: its title from a first \"# \" line (or dropped when it repeats --title); what the Strom app shows as plain text is said, never refused", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "František /Víšek/", "--sex", "M"]);
  const story = async (args: string[]) => {
    const r = await w.ok(["story", "set", "P1", ...args, "--json"]);
    return { out: (await w.ok(["story", "set", "P1", ...args])).out, story: r.json.story as { title?: string; text: string } };
  };
  let r = await story(["--text", "# Syn podruha\n\nFrantišek se narodil ve Vavřinci.\n\n## Dětství\n\n- **Antonín**, otec\n- *podruh*: bez vlastního domu"]);
  assert.equal(r.story.title, "Syn podruha");
  assert.match(r.story.text, /^František se narodil/);
  assert.doesNotMatch(r.out, /plain text/, "all of it in the app's set");
  r = await story(["--text", "#  SYN PODRUHA \n\nFrantišek.", "--title", "Syn podruha"]);
  assert.equal(r.story.text, "František.", "the same title: once");
  r = await story(["--text", "# Mládí\n\nFrantišek.", "--title", "Syn podruha"]);
  assert.equal(r.story.title, "Syn podruha");
  assert.match(r.story.text, /^# Mládí/, "another heading stays");
  // a date may start a line: one "1. ledna" is no list
  assert.doesNotMatch((await story(["--text", "1. ledna 1831 se narodil.\n\n* 1831 Vavřinec\n\nPak žil."])).out, /plain text/, "nor is \"* 1831\" a bullet: the sign of a birth");
  const outside = await story(["--text", "Viz [matrika](https://example.org).\n\n> citace\n\n| a | b |\n| - | - |\n\n1. první\n2. druhý\n\n* Antonín"]);
  assert.match(outside.out, /note: the Strom app shows links, tables, quotes \(> \), numbered lists, bullets other than "- " as plain text/);
  w.cleanup();
});
