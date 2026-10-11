// The other questions about the reading of scans (core/tuneask.ts): smaller views only through the paid calibration,
// an index first from how many scans, the research's own model reading handwriting again, a change of the tuning that
// made the reading worse returned — each from what strom recorded, kept for the key (the user config) or the research
// (.strom/tune), asked again only when the data change; "later" after 30 days.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { blank } from "../../src/image/image.ts";

const opts = { skip: !hasGit };
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function append(file: string, lines: Record<string, unknown>[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
}

/** A research with books of `n` scans each (titles in Czech, German, Cyrillic): their media IDs. */
async function books(titles: [string, string][], n: number): Promise<{ w: World; media: string[][] }> {
  const w = new World();
  await w.withTree();
  const media: string[][] = [];
  for (const [i, [title, extra]] of titles.entries()) {
    await w.ok(["recordset", "add", title, ...extra.split(" ").filter(Boolean)]);
    const dir = path.join(w.dir, `kniha ${i + 1} ř`);
    fs.mkdirSync(dir);
    for (let k = 1; k <= n; k++) fs.writeFileSync(path.join(dir, `s${String(k).padStart(4, "0")}.jpg`), encodeImage(blank(300, 200, 1, (i * 37 + k * 3) % 250), "jpeg"));
    await w.ok(["media", "add", dir, "--recordset", `B${String(i + 1).padStart(4, "0")}`]);
    media.push((await w.ok(["media", "list", "--recordset", `B${i + 1}`, "--json", "--limit", "500"])).json.media.map((m: { id: string }) => m.id));
  }
  return { w, media };
}

/** Views of a book by the agent outside a session (its day's unit): `per` views of each scan. */
function viewsOf(w: World, book: string, ids: string[], per: number, min: number): void {
  append(
    path.join(w.cwd, ".strom", "views", "views.jsonl"),
    ids.flatMap((m, i) => Array.from({ length: per }, (_, k) => ({ at: ago(min - k), key: m, by: "agent", view: `${m}-${k}.jpg`, region: { x: 0, y: 0, w: 300, h: 200 }, scale: 1, w: 300, h: 200, W: 300, H: 200, kind: "whole", rs: book, img: i + 1 }))),
  );
}

/** A reader of a book with its views and report: the first `unclear` images unclear; its cost when given. */
function reader(w: World, name: string, book: string, ids: string[], unclear: number, min: number, key: string, usd?: number): void {
  const rel = `notes/readings/${name}.md`;
  fs.mkdirSync(path.join(w.cwd, "notes", "readings"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, rel), [`# Reading ${book}-x`, "", ...ids.map((m, i) => `## Image ${i + 1} · ${m}\nresult: ${i < unclear ? "unclear" : "nothing"}\n`)].join("\n"));
  append(
    path.join(w.cwd, ".strom", "views", "views.jsonl"),
    ids.map((m, i) => ({ at: ago(min + 2), key: m, by: "agent", view: `${name}-${m}.jpg`, region: { x: 0, y: 0, w: 300, h: 200 }, scale: 1, w: 300, h: 200, W: 300, H: 200, kind: "whole", rs: book, img: i + 1, reader: 1 })),
  );
  append(path.join(w.cwd, ".strom", "metrics", "readers.jsonl"), [{ at: ago(min), by: "agent", reader: name, kind: "read", agent: "claude", key, model: key.split(" ")[1], images: ids.length, imageIds: ids, views: ids.length, outcome: "ok", missing: 0, ms: 5 * 60_000, report: rel, ...(usd !== undefined ? { usd } : {}) }]);
}

const config = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
const due = async (w: World) => (await w.ok(["media", "calibrate", "--questions", "--json"])).json;

test("views.smaller: books that read well and cost more — only the paid calibration offered; later asks again after 30 days, kept for the key", opts, async () => {
  const titles: [string, string][] = [
    ["Křty Týnec 1784–1820", "--kinds baptism"],
    ["Taufbuch Lidice 1820–1850", "--kinds baptism"],
    ["Метрическая книга Луга", "--kinds baptism"],
    ["Oddací Žďár 1800–1830", "--kinds marriage"],
    ["Zemřelí Úvaly 1800–1830", "--kinds burial"],
    ["Křty Úvaly 1830–1860", "--kinds baptism"],
  ];
  const { w, media } = await books(titles, 16);
  // each book read by two readers (32 scans): three books cost 0.10 USD a scan, three 0.04 — the three 2.5× the usual
  // (never views per scan: they follow the kind of work), none reads worse
  for (const [i, ids] of media.entries()) for (const k of [0, 1]) reader(w, `r${i + 1}-${k}`, `B000${i + 1}`, ids, 0, 900 - i * 100 - k * 40, "claude opus", i < 3 ? 1.6 : 0.64);
  const list = await due(w);
  const q = list.questions.find((x: { kind: string }) => x.kind === "views.smaller");
  assert.ok(q, JSON.stringify(list));
  assert.deepEqual(q.choices.map((c: { id: string }) => c.id), ["calibrate", "later", "never"]);
  assert.equal(q.recommended, "calibrate");
  assert.equal(q.scope, "key");
  assert.match(q.why, /^B0001, B0002, B0003: 2,5× obvyklá cena za sken/, q.why);
  // nothing suggests smaller views by itself: the answer says the command, the calibration asks its own yes
  const r = await w.ok(["media", "calibrate", "--answer", `${q.id}=calibrate`], { tty: true });
  assert.match(r.out, /Kalibraci spouští člověk: strom media calibrate/, r.out);
  assert.equal(config(w).viewSizes, undefined, "no size changed");
  assert.equal(config(w).tuneAnswers["claude opus"]["views.smaller"].choice, "calibrate");
  assert.equal((await due(w)).questions.length, 0);
  // later: asked again once 30 days passed — not before
  await w.ok(["media", "calibrate", "--answer", `${q.id}=later`], { tty: true });
  assert.equal((await due(w)).questions.length, 0);
  const cfg = config(w);
  cfg.tuneAnswers["claude opus"]["views.smaller"].at = new Date(Date.now() - 31 * 24 * 3600_000).toISOString();
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify(cfg));
  assert.deepEqual((await due(w)).questions.map((x: { id: string }) => x.id), [q.id], "the same question, the same ID");
  // never: not again for time or more data
  await w.ok(["media", "calibrate", "--answer", `${q.id}=never`], { tty: true });
  const c2 = config(w);
  c2.tuneAnswers["claude opus"]["views.smaller"].at = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify(c2));
  for (const k of [2, 3]) reader(w, `r1-${k}`, "B0001", media[0]!, 0, 40 - k * 5, "claude opus", 1.6);
  assert.equal((await due(w)).questions.length, 0);
  w.cleanup();
});

test("index.first: books browsed page by page where an index of the place is known — the threshold kept for the research", opts, async () => {
  const { w, media } = await books(
    [
      ["Křty Týnec 1784–1820", "--kinds baptism --places Týnec"],
      ["Křty Žďár 1784–1820", "--kinds baptism --places Žďár"],
      ["Rejstřík Týnec a Žďár", "--kinds index --places Týnec,Žďár"],
    ],
    22,
  );
  for (const [i, ids] of media.slice(0, 2).entries()) {
    viewsOf(w, `B000${i + 1}`, ids, 1, 300 - i * 60);
    await w.ok(["search", "add", "Křty Nováků", "--recordset", `B000${i + 1}`, "--pages", "1-22", "--method", "page-by-page", "--result", "negative"]);
  }
  const q = (await due(w)).questions.find((x: { kind: string }) => x.kind === "index.first");
  assert.ok(q);
  assert.deepEqual(q.choices.map((c: { id: string }) => c.id), ["30", "20", "40", "never"]);
  assert.equal(q.scope, "research");
  assert.match(q.why, /^B0001, B0002: prošlo se skenů 44; rejstřík místa \(B0003\)/, q.why);
  await w.ok(["media", "calibrate", "--answer", `${q.id}=20`], { tty: true });
  const kept = readJsonFile(path.join(w.cwd, ".strom", "tune", "answers.json"));
  assert.equal(kept["claude opus"]["index.first"].choice, "20");
  // a getter for what goes by it
  const { indexFirstThreshold } = await import("../../src/core/tuneask.ts");
  assert.equal(indexFirstThreshold(w.cwd, config(w), "claude opus"), 20);
  // a new index of the place is new material — but not within 30 days
  await w.ok(["recordset", "add", "Index Týnec", "--kinds", "index", "--places", "Týnec"]);
  assert.equal((await due(w)).questions.length, 0);
  w.cleanup();
});

test("vision.best: handwriting read by a model the person chose, less surely than by the research's — the research's model offered back, never a cheaper one", opts, async () => {
  const { w, media } = await books([["Křty Týnec 1784–1820", "--kinds baptism"], ["Taufbuch Lidice", "--kinds baptism"]], 12);
  // read well with Opus before
  reader(w, "opus-1", "B0001", media[0]!, 0, 900, "claude opus");
  reader(w, "opus-2", "B0002", media[1]!, 1, 800, "claude opus");
  // the person set Sonnet for scans; since then unsure
  await w.ok(["config", "set", "model.vision", "sonnet"]);
  reader(w, "sonnet-1", "B0001", media[0]!, 9, 300, "claude sonnet");
  reader(w, "sonnet-2", "B0002", media[1]!, 8, 200, "claude sonnet");
  const list = await due(w);
  assert.equal(list.key, "claude sonnet");
  const q = list.questions.find((x: { kind: string }) => x.kind === "vision.best");
  assert.ok(q, JSON.stringify(list.questions));
  assert.deepEqual(q.choices.map((c: { id: string }) => c.id), ["lead", "keep"]);
  assert.match(q.text, /^Rukopis čte sonnet, výzkum opus/, q.text);
  assert.match(q.why, /^Nejisté s sonnet: 71 % z 24 čtení; s opus: 4 % z 24\.$/, q.why);
  // an agent cannot answer it: nobody at the screen (no window here) — exit 4
  assert.equal((await w.run(["media", "calibrate", "--answer", `${q.id}=lead`], { env: { CLAUDECODE: "1" } })).code, 4);
  assert.equal(config(w).models.claude.vision, "sonnet");
  // the person: back to the research's model (the agent's default for scans: the setting gone)
  const r = await w.ok(["media", "calibrate", "--answer", `${q.id}=lead`], { tty: true });
  assert.match(r.out, /Skeny se odteď čtou modelem opus/, r.out);
  assert.equal(config(w).models, undefined);
  assert.equal(config(w).tuneAnswers["claude sonnet"]["vision.best"].choice, "lead");
  // reading with Opus again: no question of Sonnet now
  assert.equal((await due(w)).key, "claude opus");
  w.cleanup();
});

test("reset.after: the reading clearly worse after a change of the tuning — returning it recommended, the command said; nothing returned by itself", opts, async () => {
  const { w, media } = await books([["Křty Týnec 1784–1820", "--kinds baptism"]], 12);
  reader(w, "before-1", "B0001", media[0]!, 0, 600, "claude opus");
  reader(w, "before-2", "B0001", media[0]!, 1, 500, "claude opus");
  // the tuning's log (a later part of strom writes it): smaller batches, between the readers before and after
  append(path.join(w.cwd, ".strom", "tune", "log.jsonl"), [{ at: ago(400), id: "T1", key: "claude opus", scope: "key", what: "reading.batch", from: 6, to: 3, why: "…", by: "selftune" }]);
  fs.appendFileSync(path.join(w.cwd, ".strom", "tune", "log.jsonl"), "{cut short\n");
  for (const [k, min] of [300, 200, 100].entries()) reader(w, `after-${k}`, "B0001", media[0]!, 8, min, "claude opus");
  const q = (await due(w)).questions.find((x: { kind: string }) => x.kind === "reset.after");
  assert.ok(q);
  assert.deepEqual([q.recommended, q.choices.map((c: { id: string }) => c.id)], ["reset", ["reset", "keep"]]);
  assert.match(q.text, /^Čtení snímků: čtení se zhoršilo po samočinné změně reading\.batch/, q.text);
  assert.match(q.why, /^Nejistá čtení 4 % před změnou, 67 % po ní \(skeny 24 → 36\)\.$/, q.why);
  const r = await w.ok(["media", "calibrate", "--answer", `${q.id}=reset`], { tty: true });
  assert.match(r.out, /^Vrátí se příkazem: strom media calibrate --reset$/m, r.out);
  assert.equal(config(w).tuneAnswers["claude opus"]["reset.after"].choice, "reset");
  // a reset in the log (the later part): the change is gone, nothing to ask
  append(path.join(w.cwd, ".strom", "tune", "log.jsonl"), [{ at: ago(10), by: "reset", key: "claude opus", items: [{ id: "T1" }] }]);
  assert.equal((await due(w)).held.length, 0);
  w.cleanup();
});
