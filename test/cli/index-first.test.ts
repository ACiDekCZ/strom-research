// An index first (D3): a book browsed image by image — strom read, strom fetch — where an index of its parish, years and
// kind is known and nobody searched it for this: the index named first with the command that reads it (a conversation
// goes on), a session of strom run refused unless --no-index; from the person's answer to index.first, else 30 images;
// the brief names the index books of a task's books (found live: 61 images of a marriage book read for 3.90 USD while
// the parish's index lay downloaded).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { opts as connectorOpts, world as connectorWorld } from "./connectors.helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { blank } from "../../src/image/image.ts";
import { Tree } from "../../src/core/tree.ts";
import { startSession } from "../../src/core/session.ts";
import { buildBrief } from "../../src/brief/brief.ts";
import { INDEX_FIRST_DEFAULT, indexFirst, indexFirstFrom, questionNames } from "../../src/core/indexfirst.ts";
import type { RecordSet, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

async function scans(w: World, book: string, n: number, shade: number): Promise<void> {
  const dir = path.join(w.dir, `snímky ${book}`);
  fs.mkdirSync(dir);
  for (let k = 1; k <= n; k++) fs.writeFileSync(path.join(dir, `s${String(k).padStart(4, "0")}.jpg`), encodeImage(blank(300, 200, 1, (shade + k * 7) % 250), "jpeg"));
  await w.ok(["media", "add", dir, "--recordset", book]);
}

/** The person's answer to index.first: from how many images an index comes first (for the research's agent, and the readers' script). */
function answer(w: World, choice: string): void {
  fs.mkdirSync(path.join(w.cwd, ".strom", "tune"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, ".strom", "tune", "answers.json"), JSON.stringify(Object.fromEntries(["claude opus", "script"].map((k) => [k, { "index.first": { choice, at: new Date().toISOString(), by: "person" } }]))));
}

async function research(w: World): Promise<void> {
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Anna /Šanielová/", "--sex", "F"]);
  await w.ok(["recordset", "add", "Rejstřík Žďár N O Z 1784–1808", "--kinds", "index,baptism,marriage,burial", "--places", "Žďár", "--years", "1784-1808"]); // B0001
  await w.ok(["recordset", "add", "Žďár O 1784–1820", "--kinds", "marriage", "--places", "Žďár", "--years", "1784-1820"]); // B0002
  await w.ok(["recordset", "add", "Метрическая книга Луга 1790", "--kinds", "marriage", "--places", "Луга", "--years", "1790-1800"]); // B0003
  await w.ok(["lesson", "add", "Řazen podle křestního jména, sloupec Loco dává ves", "--on", "B1"]);
  await scans(w, "B1", 3, 10);
  await scans(w, "B2", 5, 90);
  await scans(w, "B3", 5, 170);
  const script = path.join(w.dir, "reader.mjs");
  fs.writeFileSync(script, 'const p = process.env.STROM_PROMPT ?? "";\nfor (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n");\n');
  w.env.STROM_RUNNER_SCRIPT = script;
}

test("strom read of many images of a book whose parish has an index not searched for this: the index first — said in a conversation, refused in a run without --no-index", opts, async () => {
  const w = new World();
  try {
    await research(w);
    answer(w, "4");
    const q = "Sňatek Anny Šanielové, nevěsta z Žďáru";
    const read = (more: string[] = [], env?: Record<string, string>) => w.run(["read", "B2", "--images", "1-5", "--whole", "--question", q, "--agent", "script", ...more], env ? { env } : {});
    // a conversation: the line, then the readers as asked
    const said = await read();
    assert.equal(said.code, 0, said.err);
    assert.match(said.out, /^B0001 is an index of this parish and years \(3 images here: 1–3; arranged — K0001: Řazen podle křestního jména, sloupec Loco dává ves\) — read it first: strom read B0001 --images <its images for the name> --question "Sňatek Anny Šanielové, nevěsta z Žďáru"$/m);
    assert.match(said.out, /▶ reader 1\/1/);
    // a session of strom run: refused before any reader, with the way on
    await w.ok(["task", "add", "Sňatek Anny", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b", "--about", "P1"]);
    const tree = Tree.open(w.cwd, w.env);
    const s = tree.withTreeLock(() => {
      const s = startSession(tree, { task: tree.get<Task>("T0001")!, runner: "script" });
      tree.commit("session", ["data"]);
      return s;
    });
    const run = await read([], { STROM_SESSION: s.id });
    assert.equal(run.code, 2, run.err);
    assert.match(run.err, /5 images of B0002 to browse, while an index of its parish and years is known and nobody searched it for this/);
    assert.match(run.err, /B0001 is an index of this parish and years/);
    assert.match(run.err, /strom read B0002 --images 1-5 … --no-index/);
    assert.doesNotMatch(run.out, /▶ reader/);
    assert.equal((await read(["--no-index"], { STROM_SESSION: s.id })).code, 0);
    // below the person's number, another place: nothing said
    assert.doesNotMatch((await w.ok(["read", "B2", "--images", "1-3", "--whole", "--question", q, "--agent", "script"])).out, /is an index/);
    assert.doesNotMatch((await w.ok(["read", "B3", "--images", "1-5", "--whole", "--question", q, "--agent", "script"])).out, /is an index/);
    // the person said never: never said
    answer(w, "never");
    const never = await read([], { STROM_SESSION: s.id });
    assert.equal(never.code, 0, never.err);
    assert.doesNotMatch(never.out, /is an index/);
    answer(w, "4");
    // the index searched in this task: read as asked
    await w.ok(["search", "add", "Šanielová v rejstříku", "--recordset", "B1", "--method", "index", "--surname", "Šaniel", "--result", "negative"], { env: { STROM_SESSION: s.id } });
    const searched = await read([], { STROM_SESSION: s.id });
    assert.equal(searched.code, 0, searched.err);
    assert.doesNotMatch(searched.out, /is an index/);
  } finally {
    w.cleanup();
  }
});

test("index first: from 30 images without the person's answer, never when the person said so; names of a question in any script", opts, async () => {
  const w = new World();
  try {
    await research(w);
    const tree = Tree.open(w.cwd, w.env);
    const cfg = { tuneAnswers: {} } as never;
    assert.equal(INDEX_FIRST_DEFAULT, 30);
    assert.equal(indexFirstFrom(w.cwd, cfg, "claude opus"), 30);
    const book = tree.get<RecordSet>("B0002")!;
    assert.equal(indexFirst(tree, book, 29, { from: 30, question: "Sňatek Anny" }).length, 0);
    assert.deepEqual(indexFirst(tree, book, 30, { from: 30, question: "Sňatek Anny" }).map((x) => x.set.id), ["B0001"]);
    // searched for another name: still first; for this name (another form of it, decomposed): no more
    await w.ok(["search", "add", "Novák v rejstříku", "--recordset", "B1", "--method", "index", "--surname", "Novák", "--result", "negative"]);
    assert.equal(indexFirst(Tree.open(w.cwd, w.env), book, 30, { from: 30, question: "Sňatek Anny Šanielové" }).length, 1);
    await w.ok(["search", "add", "Rejstřík", "--recordset", "B1", "--method", "index", "--surname", "Šaniel".normalize("NFD"), "--result", "negative"]);
    assert.equal(indexFirst(Tree.open(w.cwd, w.env), book, 30, { from: 30, question: "Sňatek Anny Šanielové" }).length, 0);
    answer(w, "never");
    assert.equal(indexFirstFrom(w.cwd, cfg, "claude opus"), undefined);
    assert.equal(indexFirst(tree, book, 300, { from: undefined }).length, 0);
    // the index's own book, another kind of record: no index of it
    assert.equal(indexFirst(tree, tree.get<RecordSet>("B0001")!, 300, { from: 1 }).length, 0);
    assert.deepEqual(questionNames("Křest IVANA Петрова, syn Jana NFD: Šaniel".normalize("NFD")), ["ivana", "петрова", "jana", "nfd", "saniel"]);
  } finally {
    w.cleanup();
  }
});

test("the brief lists the index books of the parish next to the task's book: downloaded or not, how arranged", opts, async () => {
  const w = new World();
  try {
    await research(w);
    await w.ok(["recordset", "add", "Index Žďár Z 1790–1830", "--kinds", "index,burial,marriage", "--places", "Žďár", "--years", "1790-1830"]); // B0004
    await w.ok(["task", "add", "Sňatek Anny", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b", "--about", "P1"]);
    const tree = Tree.open(w.cwd, w.env);
    const text = buildBrief(tree, { task: tree.get<Task>("T0001")! }).text;
    assert.match(text, /^index books \(look the name up there before browsing a book\):$/m);
    assert.match(text, /^ {2}B0001 "Rejstřík Žďár N O Z 1784–1808" — an index of the parish of B0002 \(1784-1808\) · downloaded: 3 images · arranged — K0001: Řazen podle/m);
    assert.match(text, /^ {2}B0004 "Index Žďár Z 1790–1830" — an index of the parish of B0002 \(1790-1830\) · not downloaded$/m);
    const other = (await w.ok(["task", "add", "Sňatek v Luze", "--level", "link", "--where", "B3", "--why", "a", "--done-when", "b", "--about", "P1", "--json"])).json;
    assert.doesNotMatch(buildBrief(Tree.open(w.cwd, w.env), { task: Tree.open(w.cwd, w.env).get<Task>(other.task?.id ?? "T2")! }).text, /index books/);
  } finally {
    w.cleanup();
  }
});

test("strom fetch of many images of a book whose parish has an index: the index first — said, refused in a run without --no-index, nothing asked of the archive", connectorOpts, async () => {
  const { w, a } = await connectorWorld();
  try {
    await w.ok(["research", "new", "Předci", "--new-person", "Anna /Šanielová/", "--sex", "F"]);
    await w.ok(["recordset", "add", "Rejstřík Žďár 1784–1808", "--kinds", "index", "--places", "Žďár", "--years", "1784-1808"]); // B0001
    await w.ok(["recordset", "add", "Žďár O 1784–1820", "--kinds", "marriage", "--places", "Žďár", "--years", "1784-1820"]); // B0002
    answer(w, "2");
    await w.ok(["task", "add", "Sňatek Anny", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b", "--about", "P1"]);
    // a conversation: said, and fetched
    const said = await w.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B2", "--dry-run"]);
    assert.equal(said.code, 0, said.err);
    assert.match(said.err, /^B0001 is an index of this parish and years/m);
    // a session of strom run: refused before any request
    const tree = Tree.open(w.cwd, w.env);
    const s = tree.withTreeLock(() => {
      const s = startSession(tree, { task: tree.get<Task>("T0001")!, runner: "script" });
      tree.commit("session", ["data"]);
      return s;
    });
    a.hits.length = 0;
    const run = await w.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B2"], { env: { STROM_SESSION: s.id } });
    assert.equal(run.code, 2, run.err);
    assert.match(run.err, /3 images of B0002 to browse, while an index of its parish and years is known/);
    assert.match(run.err, /B0001 is an index of this parish and years \(no images here yet\) — its images first: strom recordset show B0001/);
    assert.match(run.err, /strom fetch zkusebni 5359 --images 1-3 --recordset B0002 --no-index/);
    assert.deepEqual(a.hits, [], "nothing asked of the archive");
    assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B2", "--no-index", "--dry-run"], { env: { STROM_SESSION: s.id } })).code, 0);
  } finally {
    w.cleanup();
    await a.close();
  }
});
