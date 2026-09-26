// strom review: the research goes straight to one person. strom proposes the
// work from what is recorded — what the tree says of them elsewhere, entries
// to read whole, facts on one reading, a second reading by another model —
// at most one task of each kind at a time, never the same items twice.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "en"]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F"]); // P2
  await w.ok(["recordset", "add", "Kamenice 12, N 1880-1890", "--kinds", "baptism", "--places", "Kamenice nad Lipou", "--years", "1880-1890"]); // B1
  const scans = path.join(w.dir, "kamenice12");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]); // M1, M2
  // his baptism: the image is here, nothing of the entry transcribed, one reading
  await w.ok(["source", "add", "Křest Josefa Nováka 1885", "--kind", "baptism", "--recordset", "B1", "--media", "B1:1", "--information", "primary"]); // S1
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Kamenice nad Lipou", "--cite", "S1"]); // E1, probable
  // another child's baptism names him as godfather — not in his data
  await w.ok(["source", "add", "Křest Anny Dvořákové 1888", "--kind", "baptism", "--recordset", "B1", "--media", "B1:2", "--transcript", "Anna, dcera Jana Dvořáka.\nKmotr: Josef Novák, sedlák z čp. 5 v Kamenici."]); // S2
  await w.ok(["event", "add", "P2", "CHR", "--date", "1888", "--cite", "S2"]);
  return w;
}

test("review: what the tree says of the person elsewhere, entries to read whole, facts on one reading — as tasks with their items in the brief", opts, async () => {
  const w = await world();
  const dry = await w.ok(["review", "P1", "--dry-run"]);
  assert.match(dry.out, /would add: enrich · What the tree already says of Josef Novák \(\*1885\) outside their data: S0002/);
  assert.equal((await w.ok(["task", "list", "--json"])).json.tasks.length, 0, "a dry run adds nothing");

  const r = await w.ok(["review", "P1"]);
  assert.match(r.out, /\+G0001 research "Review of Josef Novák"/);
  assert.match(r.out, /link · Baptism of Josef Novák/, "his parents, as in any research");
  assert.match(r.out, /T0002 enrich · What the tree already says of Josef Novák \(\*1885\) outside their data: S0002/);
  assert.match(r.out, /T0003 enrich · Read whole the entries of Josef Novák \(\*1885\): S0001/);
  assert.match(r.out, /T0004 verify · Check the facts of Josef Novák \(\*1885\) that rest on one reading: E0001/);
  assert.match(r.out, /next: strom run --research G0001/);
  const t1 = readJsonFile(path.join(w.cwd, "data", "tasks", "T0002.json"));
  assert.equal(t1.origin, "review:mentions");
  assert.deepEqual(t1.where, ["S0002"]);
  // the brief shows each item as the tree has it: the line that names him
  const brief = (await w.ok(["brief", "T2"])).out;
  assert.match(brief, /## To review\n  S0002 Křest Anny Dvořákové 1888 · images M0002\n      “Kmotr: Josef Novák, sedlák z čp\. 5 v Kamenici\.”/);
  assert.match((await w.ok(["brief", "T4"])).out, /## To review\n  E0001 CHR 3 MAR 1885, Kamenice nad Lipou \[probable\] — S0001 \(M0001\)/);

  // again: nothing twice while the tasks are open
  assert.match((await w.ok(["review", "P1"])).out, /nothing new to review\n[\s\S]*5 task\(s\) open in G0001/);
  // done — and a new record names him: only that one comes
  await w.ok(["task", "done", "T2", "--result", "S0002: godfather, farmer at no. 5 — recorded"]);
  await w.ok(["source", "add", "Pozemková kniha Kamenice", "--kind", "land", "--transcript", "Novák Josef koupil dům čp. 5 roku 1912."]); // S3
  const again = await w.ok(["review", "Josef Novák"]);
  assert.match(again.out, /T0006 enrich · What the tree already says of Josef Novák \(\*1885\) outside their data: S0003\n/);
  assert.doesNotMatch(again.out, /\+G0002/, "the same review research goes on");
  // not a mention: a name that only looks alike
  await w.ok(["source", "add", "Jiný zápis", "--transcript", "Josefa Nováková, vdova."]);
  await w.ok(["task", "done", "T6", "--result", "recorded"]);
  assert.match((await w.ok(["review", "P1"])).out, /nothing new to review/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("review with nothing new: no research made for it, and it says why — the work that covers the person already, how to go on with it", opts, async () => {
  const w = await world();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Marie /Horáková/", "--sex", "F", "--born", "1910"]); // P3, a lead only
  await w.ok(["task", "add", "Sňatek Karla a Marie", "--level", "locate", "--where", "Týnec", "--why", "a", "--done-when", "b", "--about", "P3"]); // T1
  await w.ok(["task", "park", "T1", "--reason", "matrika ještě není online"]);
  const r = await w.ok(["review", "P3"]);
  assert.match(r.out, /^P0003 Marie Horáková \(\*1910\) — nic nového k revizi\n  P0003 Marie Horáková \(\*1910\): už to pokrývá T0001 \(odložený: matrika ještě není online\) — Sňatek Karla a Marie\n    pokračovat v něm: strom task wake T0001/);
  assert.doesNotMatch(r.out, /research|review/, "nothing written, nothing in English");
  assert.equal((await w.ok(["research", "list", "--json"])).json.researches.length, 0, "no empty review research");
  assert.equal((await w.ok(["review", "P3", "--json"])).json.research, null);
  // the task says why it waits, and how to go on
  assert.match((await w.ok(["task", "show", "T1"])).out, /\nparked matrika ještě není online — strom task wake T0001 to go on\n/);
  await w.ok(["task", "wake", "T1"]);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json")).parkedReason, undefined, "awake: the reason goes with the parking");
  w.cleanup();
});

test("review --reread: a second reading of what only another model read; sessions keep their model; strom offers it, never starts it", opts, async () => {
  const w = await world();
  // an agent's session read an entry with an older model (what the user entered by hand is theirs: never read again)
  await w.ok(["task", "add", "Povolání Josefa", "--level", "enrich", "--where", "B1", "--why", "chybí", "--done-when", "zapsáno", "--about", "P1"]); // T1
  w.env.STROM_MODEL = "claude-sonnet-4-5";
  await w.ok(["session", "start", "T1"]); // N1
  await w.ok(["source", "add", "Soupis domů 1912", "--kind", "census", "--recordset", "B1", "--media", "B1:2", "--information", "primary", "--transcript", "čp. 5 Josef Novák, sedlák"]); // S3
  await w.ok(["event", "add", "P1", "OCCU", "--value", "sedlák", "--date", "1912", "--cite", "S3", "--status", "proven"]); // E3
  await w.ok(["task", "done", "T1", "--result", "zapsáno"]);
  await w.ok(["session", "close", "--summary", "přepsán křest", "--next", "nic"]);
  delete w.env.STROM_MODEL;
  const n1 = readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json"));
  assert.equal(n1.model, "claude-sonnet-4-5");
  assert.match(n1.strom, /^\d+\.\d+\.\d+$/);
  assert.match((await w.ok(["session", "show", "N1"])).out, /N0001 closed · task T0001 · claude-sonnet-4-5/);

  // the user reads with another model now: strom says so, and does nothing by itself
  await w.ok(["config", "set", "model.vision", "claude-opus-5-5"]);
  const o = await w.ok(["--lang", "en"]);
  assert.match(o.out, /second reading\s+1 facts rest only on readings by another model \(claude-sonnet-4-5\); the user reads with claude-opus-5-5 now/);
  assert.equal((await w.ok(["task", "list", "--json"])).json.tasks.length, 0, "nothing queued by itself");

  // without --reread no second reading; with it, the proven fact (the probable one is checked anyway)
  assert.doesNotMatch((await w.ok(["review", "P1"])).out, /Read again with/);
  const r = await w.ok(["review", "P1", "--reread"]);
  assert.match(r.out, /verify · Read again with claude-opus-5-5 what the facts of Josef Novák \(\*1885\) rest on: E0003\n/);
  assert.equal((await w.run(["review", "P1", "--model", "x"])).code, 2, "--model goes with --reread");
  // read by the model the user reads with: nothing to read again
  await w.ok(["config", "set", "model.vision", "sonnet"]);
  assert.doesNotMatch((await w.ok(["--lang", "en"])).out, /second reading/);
  w.cleanup();
});

test("review of a family and in the research language; the menu offers it", opts, async () => {
  const w = await world();
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2", "--married", "1910", "--cite", "S2"]); // F1, E3 — the couple's
  await w.ok(["lang", "cs"]);
  const r = await w.ok(["review", "P1", "--scope", "family"]);
  assert.match(r.out, /\+G0001 research "Revize: Josef Novák"/);
  // the godfather's entry is their marriage's record now: no longer a mention, an entry to read whole — once
  assert.match(r.out, /Přečíst celé zápisy osoby Josef Novák \(\*1885\): S0001, S0002\n/);
  assert.doesNotMatch(r.out, /Co už rodokmen říká/);
  assert.match(r.out, /Ověřit údaje osoby Josef Novák \(\*1885\), které stojí na jednom čtení: E0001, E0003\n/);
  assert.match(r.out, /Ověřit údaje osoby Anna Dvořáková \(\*1888\), které stojí na jednom čtení: E0002\n/, "the wife too — their marriage once");
  assert.equal((await w.run(["review", "P1", "--scope", "všichni"])).code, 2);
  // 4 add to the research · 3 review one person · Josef · not the family · not now · Enter · 0 back · 0 quit
  const menu = await w.run(["menu"], { tty: true, answers: ["4", "3", "Josef", "n", "n", "", "0", "0"] });
  assert.match(menu.out, /Revize osoby: prověřit a doplnit, co o ní víme/);
  w.cleanup();
});

test("review: a marriage of a couple with children and a death of someone born long ago — in the books that cover them, else find the books", opts, async () => {
  const w = await world();
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1, no marriage recorded
  await w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]); // P3
  await w.ok(["family", "child", "F1", "P3"]);
  await w.ok(["event", "add", "P3", "BIRT", "--date", "1912", "--place", "Kamenice nad Lipou"]);
  await w.ok(["recordset", "add", "Kamenice 20, O 1900-1920", "--kinds", "marriage", "--places", "Kamenice nad Lipou", "--years", "1900-1920"]); // B2
  await w.ok(["recordset", "add", "Kamenice 30, Z 1890-1910", "--kinds", "burial", "--places", "Kamenice nad Lipou", "--years", "1890-1910"]); // B3 — before his last record
  await w.ok(["recordset", "add", "Kamenice 31, Z 1911-1950", "--kinds", "burial", "--places", "Kamenice nad Lipou", "--years", "1911-1950"]); // B4
  const r = await w.ok(["review", "P1"]);
  assert.match(r.out, /(T\d+) link · Marriage of Josef Novák \(\*1885\) and Anna Dvořáková, Kamenice nad Lipou \(before their first child, 1912\)\n/);
  assert.match(r.out, /(T\d+) link · Death of Josef Novák \(\*1885\), Kamenice nad Lipou \(after 1912, the last record of them\)\n/);
  const dir = path.join(w.cwd, "data", "tasks");
  const tasks = fs.readdirSync(dir).map((f) => readJsonFile(path.join(dir, f)) as { id: string; what: string; where: string[] });
  const marriage = tasks.find((t) => t.what.startsWith("Marriage of"))!;
  const death = tasks.find((t) => t.what.startsWith("Death of"))!;
  assert.deepEqual(marriage.where, ["B0002"]);
  assert.deepEqual(death.where, ["B0004"], "the books from his last record on");
  assert.match((await w.ok(["brief", marriage.id])).out, /## People concerned[\s\S]*P0001 Josef Novák/);
  // searched without it: the books are used up — find others; after that the user decides
  await w.ok(["task", "done", marriage.id, "--result", "1904–1912 searched, no entry"]);
  const next = await w.ok(["review", "P1"]);
  assert.match(next.out, /locate · Where are the marriages of Kamenice nad Lipou around 1912\? \(for Josef Novák \(\*1885\) and Anna Dvořáková\)/);
  const locate = (await w.ok(["task", "list", "--json"])).json.tasks.find((t: { what: string }) => t.what.startsWith("Where are the marriages"));
  await w.ok(["task", "done", locate.id, "--result", "no other books"]);
  assert.doesNotMatch((await w.ok(["review", "P1"])).out, /marriages|Marriage of/);
  // the couple's marriage once: the wife's review does not propose it again
  assert.doesNotMatch((await w.ok(["review", "P2"])).out, /Marriage of|marriages of/);
  // the living: no death looked for
  await w.ok(["person", "add", "Eva /Nováková/", "--sex", "F"]); // P4
  await w.ok(["event", "add", "P4", "BIRT", "--date", "1990", "--place", "Kamenice nad Lipou"]);
  assert.doesNotMatch((await w.ok(["review", "P4"])).out, /Death of|deaths of/);
  w.cleanup();
});
