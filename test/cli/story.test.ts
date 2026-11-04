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

test("a story's spaces come to the Strom file as written: two between words, a no-break and a narrow one, beside an emoji and a cut of a long line", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Matěj /Lhoták/", "--sex", "M"]);
  // decomposed letters, Cyrillic, an emoji of joined parts with two spaces after it, a no-break space in "čp. 7", a
  // narrow one in "1 850", long enough that cuts of its line fall among the double spaces
  const words = "Matěj  žil v Lhotě čp.\u00a07 —  Жовква,\u202f1\u202f850 👨‍👩‍👧  konec🏁".normalize("NFD");
  const text = `${Array.from({ length: 12 }, (_, i) => `${"x".repeat(i + 1)} ${words}`).join(" ")}\n\nDruhý  odstavec.`;
  fs.mkdirSync(path.join(w.cwd, "notes"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, "notes", "story-P0001.md"), text + "\n");
  await w.ok(["story", "set", "P1", "--text", "@notes/story-P0001.md"]);
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  for (const l of ged.split("\n")) assert.ok(Buffer.byteLength(l) <= 255, l);
  const indi = parseGedcomText(ged).records.find((x) => x.tag === "INDI")!;
  const said = indi.children.find((c) => c.tag === "_STORY")!.children.find((c) => c.tag === "TEXT")!.value;
  assert.equal(said, text.normalize("NFC"));
  assert.ok(said.includes("👨‍👩‍👧  konec🏁") && said.includes("čp.\u00a07") && said.includes("1\u202f850"));
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

test("approving a story is the user's own: an agent is refused story approve, story discard and story set --final", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["source", "add", "Křest Jana 1870", "--kind", "baptism", "--information", "primary"]); // S1
  await w.ok(["event", "add", "P1", "BIRT", "--date", "2 MAR 1870", "--place", "Lhota", "--cite", "S1", "--status", "proven"]); // E1
  const agent = { env: { AI_AGENT: "1" } };
  const status = async () => (await w.ok(["story", "show", "P1", "--json"])).json;
  // the agent writes a draft; --final from it refused, nothing written
  const final = await w.run(["story", "set", "P1", "--text", "Jan se narodil v Lhotě.", "--fact", "E1", "--final", "--json"], agent);
  assert.equal(JSON.parse(final.out).code, "story.final");
  await w.ok(["story", "set", "P1", "--text", "Jan se narodil v Lhotě.", "--fact", "E1"], agent);
  assert.equal(JSON.stringify(await status()).includes('"final"'), false);
  // nor does it approve the draft
  assert.notEqual((await w.run(["story", "approve", "P1", "--json"], agent)).code, 0);
  assert.equal(JSON.stringify(await status()).includes('"final"'), false);
  // the user approves it; a new version the agent writes waits — the agent neither approves nor discards it
  await w.ok(["story", "approve", "P1"]);
  const again = await w.ok(["story", "set", "P1", "--text", "Jan se narodil 2. března 1870 v Lhotě.", "--fact", "E1"], agent);
  assert.match(again.out, /they approve it or keep the old one themselves \(the Strom app, or strom → What waits\)/);
  assert.notEqual((await w.run(["story", "approve", "P1"], agent)).code, 0);
  assert.notEqual((await w.run(["story", "discard", "P1"], agent)).code, 0);
  assert.ok(JSON.stringify(await status()).includes("2. března"), "the new version still waits");
  await w.ok(["story", "discard", "P1"]);
  assert.ok(!JSON.stringify(await status()).includes("2. března"));
});
