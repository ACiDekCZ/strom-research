// No negative past a reader's "unclear": a range a reader of strom read found unclear on is searched in vain only once
// that image was looked at closer (a half, a crop, a part of it) or read again to a result — else the search is
// recorded as it stands (inconclusive, partial). Found live: a reader saw a marginal note with an unclear name and
// recommended a closer look; the agent recorded the range as searched in vain without it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

test("a negative search over an image a reader found unclear waits for a closer look at it; inconclusive, another range and a later look are fine", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1850"]);
  await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism", "--years", "1840-1860"]); // B0001
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg", "s0003.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]); // M0001–M0003
  await w.ok(["task", "add", "Křest Kryštofa", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  await w.ok(["session", "start", "T1"]);
  // what a reader of strom read wrote: image 2 unclear — a note in the margin, the name not read
  const dir = path.join(w.cwd, "notes", "readings");
  fs.mkdirSync(dir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(
    path.join(dir, `${day}-B0001-1-3-1.md`),
    [
      "# Reading B0001-1-3 · batch 1 of 1",
      "Question: Každý křest Žďárský (Ждарский) 1848–1852",
      "",
      "## Image 1 · M0001",
      "result: nothing",
      "entries: žádný zápis Žďárský",
      "",
      "## Image 2 · M0002",
      "result: unclear",
      "entries: pravý okraj, poznámka jinou rukou: „…ský“, jméno nečitelné — přiblížit",
      "",
      "## Image 3 · M0003",
      "result: nothing",
      "",
      "done: 3 images, found on none",
    ].join("\n"),
  );
  const add = (result: string, pages: string) => w.run(["search", "add", "Křty Žďárský 1848–1852", "--recordset", "B1", "--pages", pages, "--method", "page-by-page", "--by", "reader", "--result", result]);
  const refused = await add("negative", "1-3");
  assert.equal(refused.code, 2, refused.out + refused.err);
  assert.match(refused.err, /a reader found image 2 of B0001 unclear \(strom readings B0001 --image 2: "pravý okraj, poznámka jinou rukou: „…ský“, jméno nečitelné — přiblížit"\) and nobody looked closer since — a negative search of the range waits for that look/);
  assert.match(refused.err, /strom media view B0001:2 --half right \(or --grid, then --crop x,y,w,h on the entry\)/);
  assert.match(refused.err, /--result inconclusive --note "image 2 unclear: <what>"/);
  assert.equal((await w.ok(["search", "list", "--json"])).json.total, 0, "nothing written");
  // the range as it stands, and a range without that image: written
  await w.ok(["search", "add", "Křty Žďárský 1848–1852", "--recordset", "B1", "--pages", "1-3", "--method", "page-by-page", "--by", "reader", "--result", "inconclusive", "--note", "image 2 unclear"]); // Q0001
  assert.equal((await add("negative", "3")).code, 0, "another range");
  // made negative later: the same — a whole view of it is no closer look
  await w.ok(["media", "view", "B1:2"]);
  const edit = await w.run(["search", "edit", "Q1", "--result", "negative", "--reason", "all read"]);
  assert.equal(edit.code, 2);
  assert.match(edit.err, /a reader found image 2 of B0001 unclear/);
  // looked at closer: the negative is written
  await w.ok(["media", "view", "B1:2", "--crop", "0.6,0,0.4,0.5"]);
  await w.ok(["search", "edit", "Q1", "--result", "negative", "--reason", "image 2 looked at closer: no Žďárský"]);
  assert.equal((await add("negative", "1-3")).code, 0);
  w.cleanup();
});

test("a closer look counts only at full size and on the page the reader named: a reduced view, the other page are said and refused", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "1850"]);
  await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism"]); // B0001
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  // 400×300 px: a double page
  for (const f of ["s0001.jpg", "s0002.jpg", "s0003.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]); // M0001–M0003
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["session", "start", "T1"]);
  const dir = path.join(w.cwd, "notes", "readings");
  fs.mkdirSync(dir, { recursive: true });
  // the reader names the page (in NFD, as some editors write it); image 3 says no page
  fs.writeFileSync(
    path.join(dir, `${new Date().toISOString().slice(0, 10)}-B0001-2-3-1.md`),
    [
      "# Reading B0001-2-3 · batch 1 of 1",
      "Question: Křty Novák",
      "",
      "## Image 2 · M0002",
      "result: unclear",
      "entries: pravá strana, 5. zápis: „Nov…“, příjmení nečitelné".normalize("NFD"),
      "",
      "## Image 3 · M0003",
      "result: unclear",
      "illegible: příjmení otce u třetího zápisu",
      "",
      "done: 2 images, found on none",
    ].join("\n"),
  );
  await new Promise((r) => setTimeout(r, 20));
  const add = (pages: string) => w.run(["search", "add", "Křty Novák", "--recordset", "B1", "--pages", pages, "--method", "page-by-page", "--by", "reader", "--result", "negative"]);
  const none = await add("2");
  assert.equal(none.code, 2);
  assert.match(none.err, /nobody looked closer since/);
  assert.match(none.err, /look at that place closer: strom media view B0001:2 --half right \(or --grid/);
  // the other page, at full size: not there
  await w.ok(["media", "view", "B1:2", "--half", "left"]);
  const other = await add("2");
  assert.equal(other.code, 2);
  assert.match(other.err, /and the view of image 2 since showed the left page; the unclear entry is on the right page — a negative search of the range waits for a look there/);
  assert.match(other.err, /look at that place closer: strom media view B0001:2 --half right \(or --grid/);
  // the right page, reduced: not at full size — the parts that come at full size at the size this view got
  await w.ok(["media", "view", "B1:2", "--half", "right", "--max", "100"]);
  const small = await add("2");
  assert.equal(small.code, 2);
  assert.match(small.err, /and the view of image 2 since was reduced \(33 %\) — a negative search of the range waits for a look at full size/);
  assert.match(small.err, /open the unclear place at full size: strom media view B0001:2 --half right --split 3x4 \(or --grid, then --crop x,y,w,h on the entry\); then record the search/);
  // a crop of the right page at full size: the look
  await w.ok(["media", "view", "B1:2", "--crop", "0.55,0.3,0.4,0.3"]);
  assert.equal((await add("2")).code, 0, "looked at closely");
  // no page said: any part counts, only not reduced — the hint repeats the part the reduced view showed
  await w.ok(["media", "view", "B1:3", "--crop", "0.1,0.1,0.5,0.8", "--max", "100"]);
  const part = await add("3");
  assert.equal(part.code, 2);
  assert.match(part.err, /the view of image 3 since was reduced \(42 %\)/);
  assert.match(part.err, /strom media view B0001:3 --crop 0\.10,0\.10,0\.50,0\.80 --split 3x3/);
  await w.ok(["media", "view", "B1:3", "--half", "left"]);
  assert.equal((await add("3")).code, 0, "the left page at full size");
  w.cleanup();
});

test("a closer view recorded by an older strom without its scale and part counts as it always did", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "1850"]);
  await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism"]); // B0001
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["session", "start", "T1"]);
  const dir = path.join(w.cwd, "notes", "readings");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${new Date().toISOString().slice(0, 10)}-B0001-4-4-1.md`), "# Reading B0001-4-4 · batch 1 of 1\nQuestion: x\n\n## Image 4\nresult: unclear\nentries: right page, third entry: surname illegible\n");
  await new Promise((r) => setTimeout(r, 20));
  const add = () => w.run(["search", "add", "Křty Novák", "--recordset", "B1", "--pages", "4", "--method", "page-by-page", "--result", "negative"]);
  assert.equal((await add()).code, 2);
  const views = path.join(w.cwd, ".strom", "views");
  fs.mkdirSync(views, { recursive: true });
  fs.appendFileSync(path.join(views, "views.jsonl"), JSON.stringify({ at: new Date().toISOString(), key: "M0004", rs: "B0001", img: 4, kind: "half" }) + "\n");
  assert.equal((await add()).code, 0, "an old record of a closer view");
  w.cleanup();
});

test("the page an unclear entry stands on, from what the reader wrote — only for sure, in any language", async () => {
  const { sideOf } = await import("../../src/commands/readings.ts");
  const side = (...entries: string[]) => sideOf({ entries });
  assert.equal(side("pravá strana, 5. zápis"), "right");
  assert.equal(side("pravá strana, 5. zápis".normalize("NFD")), "right");
  assert.equal(side("na levé stránce nahoře"), "left");
  assert.equal(side("PRAVÝ OKRAJ, poznámka"), "right");
  assert.equal(side("linke Seite, zweiter Eintrag"), "left");
  assert.equal(side("rechts, 3. Eintrag"), "right");
  assert.equal(side("prawa strona, wpis 2"), "right");
  assert.equal(side("left-hand page, entry 4"), "left");
  assert.equal(sideOf({ illegible: ["the right margin: a note"] }), "right");
  // not for sure: both pages, no page, a word that only starts like one, another script strom does not read for it
  assert.equal(side("left page entry 2", "right page entry 1"), undefined);
  assert.equal(side("vpravo dole"), undefined);
  assert.equal(side("pravděpodobně strana 12"), undefined);
  assert.equal(side("the right name is unclear"), undefined);
  assert.equal(side("правая страница"), undefined);
  assert.equal(side(), undefined);
});

test("an image read again to a result is no longer unclear; a reading from before the task's sessions does not hold its negative back", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "1850"]);
  await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism"]); // B0001
  const dir = path.join(w.cwd, "notes", "readings");
  fs.mkdirSync(dir, { recursive: true });
  const block = (n: number, result: string) => `## Image ${n}\nresult: ${result}\nentries: zápis ${n}\n`;
  // an old reading, before the task: left as it is
  const old = path.join(dir, "2026-01-02-B0001-5-6-1.md");
  fs.writeFileSync(old, `# Reading B0001-5-6 · batch 1 of 1\nQuestion: x\n\n${block(5, "unclear")}`);
  fs.utimesSync(old, new Date("2026-01-02T10:00:00Z"), new Date("2026-01-02T10:00:00Z"));
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["session", "start", "T1"]);
  const add = (pages: string) => w.run(["search", "add", "Křty Novák", "--recordset", "B1", "--pages", pages, "--method", "page-by-page", "--result", "negative"]);
  assert.equal((await add("5")).code, 0, "a reading from before the task's sessions");
  // in this session: unclear, then read again closer to a result
  fs.writeFileSync(path.join(dir, `${new Date().toISOString().slice(0, 10)}-B0001-7-7-1.md`), `# Reading B0001-7-7 · batch 1 of 1\nQuestion: x\n\n${block(7, "unclear")}`);
  assert.equal((await add("7")).code, 2);
  await new Promise((r) => setTimeout(r, 20));
  fs.writeFileSync(path.join(dir, `${new Date().toISOString().slice(0, 10)}-B0001-7-7-run2-1.md`), `# Reading B0001-7-7 · batch 1 of 1\nQuestion: x\n\n${block(7, "nothing")}`);
  assert.equal((await add("7")).code, 0, "read again: nothing there");
  w.cleanup();
});

test("strom read with an unclear image: it says to look there closer and offers the search as inconclusive; a negative waits for the look", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "1850"]);
  await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism"]); // B0001
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg", "s0003.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["session", "start", "T1"]);
  w.env.STROM_RUNNER_SCRIPT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
  w.env.AGENT_MODE = "reader-unclear";
  const r = await w.run(["read", "B1", "--images", "1-3", "--question", "Křty Novák", "--agent", "script"]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /unclear on: 2 — look at that place closer yourself \(strom media view B0001:2 --half both, --crop\) or read again \(a double page then comes in halves\): no negative of the range before/);
  assert.match(r.out, /record the search: strom search add "Křty Novák" --recordset B0001 --pages 1-3 --method page-by-page --by reader --result inconclusive/);
  const negative = await w.run(["search", "add", "Křty Novák", "--recordset", "B1", "--pages", "1-3", "--method", "page-by-page", "--by", "reader", "--result", "negative"]);
  assert.equal(negative.code, 2);
  assert.match(negative.err, /a reader found image 2 of B0001 unclear \(strom readings B0001 --image 2: "pravý okraj, poznámka: „…ský“, jméno nečitelné"\)/);
  await w.ok(["media", "view", "B1:2", "--half", "right"]);
  await w.ok(["search", "add", "Křty Novák", "--recordset", "B1", "--pages", "1-3", "--method", "page-by-page", "--by", "reader", "--result", "negative"]);
  w.cleanup();
});

test("what readers and delegates are told: an unclear place said where it is, and looked at closer before a negative", async () => {
  const { readerPrompt } = await import("../../src/core/reader.ts");
  const { scanReaderPrompt } = await import("../../src/agents/scanreader.ts");
  const { PROFILES, selfReading } = await import("../../src/agents/profiles.ts");
  const prompt = readerPrompt({ question: "x", images: [{ id: "M0001", image: 1, view: "/v/1.jpg" }], report: "/r.md", lang: "cs" });
  assert.match(prompt, /never hide it inside a "nothing" block: the\nresearcher looks at that place closer before the range counts as searched in vain\./);
  assert.match(scanReaderPrompt(), /A possible match you could not read: one line\n"unclear: B…:<image> <where on it: page, entry from the top, or x,y,w,h> — <what>" \(the agent looks\nthere closer before it calls the range searched in vain\)/);
  // every agent: Claude Code's delegates, and those that read themselves or hand a batch to their own scan reader
  assert.match(PROFILES.claude!.instructions({}), /- A delegate's "unclear" on an image of the range: look at that place closer\n {2}\(`--crop`\) before you record the range as searched in vain — else record\n {2}it inconclusive, with the place in its note\./);
  assert.match(selfReading(), /its "unclear":\s+look there closer\s+first, else the search is inconclusive\)/);
});
