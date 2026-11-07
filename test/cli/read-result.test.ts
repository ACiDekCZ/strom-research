// A reading's result for the Strom app, said plainly (spec 059 P7, K7.1, K7.3; the app's ZADANI_VYZKUM_cteni-vysledek.md):
// each place two readings differ says its kind — a matter of fact or a trifle (feature read.variantKind); each reader
// where it is — queued, reading, done in so many seconds, failed (feature read.readerState), the same in /status reads;
// a blind reader that wrote nothing is no reading held against the first one. Where a difference stands on the scan
// (read.variantRegion) is not sent: the readers' places are bands of a line or a column, not the word.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { opts, world } from "./excerpts.helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { buildResult, loadState, resultForApp, saveState, type ReadResult } from "../../src/core/document.ts";
import { ReadingsSeen } from "../../src/core/live-read.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { TRIFLES, VARIANT_KINDS, variantKind } from "../../src/core/variantkind.ts";
import { compareWithSource } from "../../src/core/sourceread.ts";

// the reader: the first one's report and the blind one's from files; the blind one fails where DOC_BLIND_FAILS says
const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const blind = p.includes("This is a BLIND reading");
if (blind && process.env.DOC_BLIND_FAILS) process.exit(1);
const body = fs.readFileSync(blind ? process.env.DOC_BLIND : process.env.DOC_FIRST, "utf8");
fs.writeFileSync(report, fs.readFileSync(report, "utf8").replace("<!-- next block -->", body.trim() + "\\n<!-- next block -->"));
console.log("cost: 0.10");
`;

const entry = (transcript: string, given: string) => `## Document
kind: register.baptism
language: cs
legible: yes

## Entry e1 · page 1
region: 0.1,0.1,0.8,0.3
transcript: ${transcript}
person: p1 | child | dítě | written=${given} Lhoták | given=${given} | surname=Lhoták | sex=M | region=0.2,0.15,0.3,0.05
event: BAPM | date=3. 5. 1850 | place=Lhota | persons=p1:principal

done: 1 entries`;

async function setUp(first: string, blind: string) {
  const w = await world();
  const dir = path.join(w.dir, "čtenáři ř");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  fs.writeFileSync(path.join(dir, "first.md"), first);
  fs.writeFileSync(path.join(dir, "blind.md"), blind);
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"), DOC_FIRST: path.join(dir, "first.md"), DOC_BLIND: path.join(dir, "blind.md"), STROM_NO_CONVERT: "1" });
  return w;
}

test("K7.1: the kind of each difference — a matter of fact or a trifle, sure trifles only; any script, decomposed input", () => {
  const cases: [string, string, string | undefined, string][] = [
    ["Nro. 14", "N. 4", undefined, "number"],
    ["Wlk", "Vlk", undefined, "spelling"],
    ["Testes", "Testes:", undefined, "punctuation"],
    ["Lhotak", "Lhoták".normalize("NFD"), "transcript", "spelling"],
    ["Jan", "Jakub", "p2.given", "name"],
    ["Hrom", "Hron", "p1.surname", "name"],
    ["Josephus", "Josefus", undefined, "spelling"],
    ["Jos.", "Josephus", undefined, "abbr"],
    ["No.", "Nro.", undefined, "abbr"],
    ["Mense", "Mens.", undefined, "abbr"],
    // a stop alone does not make an abbreviation of another word
    ["Jos.", "Joannes", undefined, "other"],
    ["Parroch.", "Parrod.", undefined, "other"],
    ["Lhota", "Lhoda[?]", undefined, "illegible"],
    ["Vítka", "Vít [...]", undefined, "illegible"],
    ["", "[…]", undefined, "illegible"],
    ["Dies:", "", undefined, "label"],
    ["Otec: Jan", "Jan", undefined, "label"],
    ["ANNA", "Anna", undefined, "case"],
    ["Anno 1851", "Anno 1852", undefined, "date"],
    ["3. 5. 1850", "5. 3. 1850", "BAPM.date", "date"],
    ["Lhoták", "Brod", undefined, "name"],
    ["syn", "dcera", undefined, "other"],
    ["", "Jan Lhoták", "person", "person"],
    ["Jan Lhoták", "", "p3", "person"],
    ["e1", "", "entry", "other"],
    ["Новак", "Новакъ", undefined, "name"],
    ["Иванъ", "Иван", undefined, "name"],
  ];
  for (const [a, b, field, kind] of cases) assert.equal(variantKind(a, b, field), kind, JSON.stringify([a, b, field]));
  assert.ok(TRIFLES.every((k) => (VARIANT_KINDS as readonly string[]).includes(k)));
});

test("K7.1: the result for the app says each variant's kind — of the readers', of a source read again; the result kept has none", () => {
  const r = {
    id: "D20261107120000-0a1b",
    entries: [{ id: "e1", page: 1, transcript: "x", persons: [], events: [], relations: [], agree: "differ", variants: [{ field: "transcript", at: "Wlk", other: "Vlk" }, { field: "p1.given", at: "Jan", other: "Jakub" }, { field: "p1.role", at: "child", other: "other" }] }],
    source: { id: "S0001", agree: "differ", variants: [{ at: "Nro. 14", other: "N. 4" }, { at: "Testes", other: "Testes:" }] },
  } as unknown as ReadResult;
  const app = resultForApp(r);
  assert.deepEqual(app.entries[0]!.variants, [
    { field: "transcript", at: "Wlk", other: "Vlk", kind: "spelling" },
    { field: "p1.given", at: "Jan", other: "Jakub", kind: "name" },
  ]);
  assert.deepEqual(app.source!.variants, [
    { at: "Nro. 14", other: "N. 4", kind: "number" },
    { at: "Testes", other: "Testes:", kind: "punctuation" },
  ]);
  // worked out for the app alone: what is kept stays as it was
  assert.equal((r.entries[0]!.variants![0] as { kind?: string }).kind, undefined);
  assert.equal((r.source!.variants![0] as { kind?: string }).kind, undefined);
  // a source's transcript held against a new reading: the kinds of its places
  const c = compareWithSource({ transcript: "Křest Jana Lhotáka, Nro. 14" }, { entries: [{ id: "e1", transcript: "Křest Jakuba Lhotáka, N. 4" }] } as unknown as ReadResult);
  assert.deepEqual(resultForApp({ ...r, entries: [], source: { id: "S0001", ...c } } as unknown as ReadResult).source!.variants!.map((v) => v.kind), ["name", "number"]);
});

test("K7.3: each reader's state and seconds in the result, /status reads and the reading kept; a blind reader that failed: the first one's text, no differences", opts, async () => {
  const w = await setUp(entry("Křest Jana Lhotáka", "Jan"), entry("Křest Jakuba Lhotáka", "Jakub"));
  try {
    const page = path.join(w.dir, "kniha", "s0004.jpg");
    // both read: done, each in so many seconds
    const both = (await w.ok(["document", "read", page, "--readers", "2", "--agent", "script", "--json"])).json;
    assert.equal(both.state, "done", JSON.stringify(loadState(w.cwd, both.id)?.why));
    assert.equal(both.readers.who.length, 2);
    for (const r of both.readers.who) {
      assert.equal(r.state, "done", JSON.stringify(both.readers.who));
      assert.ok(Number.isInteger(r.secs) && r.secs >= 0, JSON.stringify(r));
    }
    assert.equal(both.readers.agree, "differ");
    const state = loadState(w.cwd, both.id)!;
    assert.ok(state.reports.every((r) => r.began && r.ended && Date.parse(r.ended) >= Date.parse(r.began)), JSON.stringify(state.reports));
    // the result kept says it too; /status reads (and the event read) as well, done agreeing with the states
    const kept = JSON.parse(fs.readFileSync(path.join(w.cwd, "notes", "readings", `${both.id}.json`), "utf8")) as ReadResult;
    assert.deepEqual(kept.readers.who, both.readers.who);
    const seen = new ReadingsSeen(w.cwd, w.env).all().find((r) => r.read.id === both.id)!.read;
    assert.equal(seen.done, 2);
    assert.deepEqual(seen.who!.map((r) => [r.state, typeof r.secs]), [["done", "number"], ["done", "number"]]);

    // the blind reader fails: the reading done with the first one's text — never every entry said to differ
    w.env.DOC_BLIND_FAILS = "1";
    const one = (await w.ok(["document", "read", page, "--readers", "2", "--agent", "script", "--json"])).json;
    assert.equal(one.state, "done");
    assert.deepEqual(one.readers.who.map((r: { state: string; ran?: boolean }) => [r.state, r.ran]), [["done", undefined], ["failed", false]]);
    assert.equal(one.readers.who[1].secs, undefined, "seconds of a reader done alone");
    assert.equal(one.readers.ran, 1);
    assert.equal(one.readers.agree, null);
    assert.equal(one.blind, undefined);
    assert.equal(one.entries[0].variants, undefined, JSON.stringify(one.entries[0].variants));
    const seenOne = new ReadingsSeen(w.cwd, w.env).all().find((r) => r.read.id === one.id)!.read;
    assert.equal(seenOne.done, 1);

    // while it is read: queued, then reading — the reader not begun queued, the one at work reading
    const s = loadState(w.cwd, both.id)!;
    const tree = Tree.open(w.cwd, w.env);
    const at = (x: typeof s) => buildResult(tree, x).readers.who!.map((r) => r.state);
    assert.deepEqual(at({ ...s, state: "queued", reports: [] }), ["queued", "queued"]);
    const begun = { ...s.reports[0]!, outcome: undefined, ended: undefined };
    assert.deepEqual(at({ ...s, state: "reading", reports: [begun] }), [begun.blind ? "queued" : "reading", begun.blind ? "reading" : "queued"]);
    // cancelled before a reader ended: strom cannot tell where it was
    assert.deepEqual(at({ ...s, state: "cancelled", reports: [begun] }).filter(Boolean).length, 0);
    // a reading kept before strom said when its readers read: done, no seconds
    saveState(w.cwd, { ...s, reports: s.reports.map(({ began: _b, ended: _e, ...r }) => r) });
    assert.deepEqual(buildResult(tree, loadState(w.cwd, both.id)!).readers.who!.map((r) => [r.state, r.secs]), [["done", undefined], ["done", undefined]]);
  } finally {
    w.cleanup();
  }
});

test("the features: read.variantKind and read.readerState sent, read.variantRegion not", () => {
  const f = BRIDGE_FEATURES as readonly string[];
  assert.ok(f.includes("read.variantKind") && f.includes("read.readerState"));
  assert.ok(!f.includes("read.variantRegion"));
});
