// strom media calibrate --report: how the reading of scans went, from what strom recorded itself (views, readers,
// fetches, the use of the sessions) — free, no agent, no network, nothing changed but the summary beside the research
// (.strom/metrics/rollup.json, which outlives the journals strom tidy shortens). Per book and archive: what is clearly
// above the usual of the same agent and model, and what would be suggested; a bad line of a journal is left out; what
// older sessions left (a session's log, a reader's notes) is read once, marked as recovered; nothing of it in an archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { blank } from "../../src/image/image.ts";

const opts = { skip: !hasGit };
const DAY = 24 * 3600_000;
const KEY = "claude opus";
/** The key of the model the alias ran on (core/modelkey.ts): the units are kept under it. */
const TUNED = "claude claude-opus-5-5";
const ago = (days: number, min = 0) => new Date(Date.now() - days * DAY + min * 60_000).toISOString();

function put(file: string, lines: (Record<string, unknown> | string)[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") + "\n");
}

/** A report of a reader as strom read writes it: a block per image. */
function report(media: string[], unclear: number): string {
  return ["# Reading B0001-test", "Question: křty Dvořáků", "", ...media.map((m, i) => `## Image ${i + 1} · ${m}\nresult: ${i < unclear ? "unclear" : "nothing"}\n${i < unclear ? "illegible: příjmení otce\n" : ""}`)].join("\n");
}

/** A research with three books of scans (Czech, German, Cyrillic titles) and the journals of some weeks of reading. */
async function world(): Promise<{ w: World; media: Record<string, string[]> }> {
  const w = new World();
  await w.withTree();
  const books = ["Křty Týnec 1784–1820", "Taufbuch Lidice 1820–1850", "Метрическая книга Луга 1850–1870"];
  const media: Record<string, string[]> = {};
  for (const [i, title] of books.entries()) {
    await w.ok(["recordset", "add", title, "--kinds", "baptism"]);
    const id = `B000${i + 1}`;
    const dir = path.join(w.dir, `knihy ${i + 1} ž`);
    fs.mkdirSync(dir);
    for (let n = 1; n <= 16; n++) fs.writeFileSync(path.join(dir, `s${String(n).padStart(4, "0")}.jpg`), encodeImage(blank(300, 200, 1, 40 + i * 20 + n), "jpeg"));
    await w.ok(["media", "add", dir, "--recordset", id]);
    media[id] = (await w.ok(["media", "list", "--recordset", id, "--json"])).json.media.map((m: { id: string }) => m.id);
  }
  return { w, media };
}

test("the reading of scans summed up from the research's own records: per book and archive, above the usual, what strom set by itself — free, nothing that asks an archive for more", opts, async () => {
  const { w, media } = await world();
  const root = w.cwd;
  const views: (Record<string, unknown> | string)[] = [];
  const readers: Record<string, unknown>[] = [];
  // five readers over three weeks: two of B0001 that read well, two of B0003 that read badly (enlarged views), one
  // that ended without a result; each its usage per request — two with a clear of their context
  const plan: { book: string; scale: number; unclear: number; outcome: string; clear: boolean }[] = [
    { book: "B0001", scale: 0.8, unclear: 0, outcome: "ok", clear: false },
    { book: "B0003", scale: 2, unclear: 12, outcome: "ok", clear: true },
    { book: "B0001", scale: 0.8, unclear: 1, outcome: "ok", clear: false },
    { book: "B0003", scale: 2, unclear: 13, outcome: "timeout", clear: true },
    { book: "B0002", scale: 0.8, unclear: 0, outcome: "timeout", clear: false },
  ];
  for (const [k, p] of plan.entries()) {
    const day = 20 - k * 3;
    const name = `read-2026-zkouška-${k + 1}`;
    const ids = media[p.book]!;
    for (const [i, m] of ids.entries())
      views.push({ at: ago(day, i), key: m, by: "agent", view: `${m}-x${k}.jpg`, region: { x: 0, y: 0, w: 300, h: 200 }, scale: p.scale, w: Math.round(300 * p.scale), h: Math.round(200 * p.scale), W: 300, H: 200, kind: "whole", rs: p.book, img: i + 1, cached: p.clear && i >= 8, reader: 1 });
    const rel = `notes/readings/${name}.md`;
    fs.mkdirSync(path.join(root, "notes", "readings"), { recursive: true });
    fs.writeFileSync(path.join(root, rel), report(ids, p.unclear));
    readers.push({ at: ago(day, 30), by: "agent", reader: name, kind: "read", agent: "claude", key: KEY, model: "opus", reported: "claude-opus-5-5", images: ids.length, imageIds: ids, views: ids.length, outcome: p.outcome, missing: p.outcome === "ok" ? 0 : ids.length, usd: 0.6, tokens: { in: 100, out: 2000, cr: 50000, cw: 30000 }, ms: 25 * 60_000, report: rel });
    put(path.join(root, ".strom", "metrics", "usage", `${name}.jsonl`), [
      { at: ago(day, 1), start: true, agent: "claude", key: KEY, reader: "read" },
      { at: ago(day, 1), agentSession: `s-${k}`, model: "claude-opus-5-5" },
      { at: ago(day, 2), in: 5, out: 10, cr: 20000, cw: 30000, ctx: 50000 },
      { at: ago(day, 6), in: 5, out: 10, cr: 80000, cw: 40000, ctx: 120000 },
      { at: ago(day, 7), in: 5, out: 10, cr: p.clear ? 20000 : 120000, cw: 5000, ctx: p.clear ? 25000 : 125000 },
      { at: ago(day, 20), in: 5, out: 10, cr: 30000, cw: 5000, ctx: p.clear ? 35000 : 130000 },
    ]);
  }
  // an older line (before strom recorded the views' size and kind), and a line cut short
  views.push({ at: ago(2), key: media.B0002![0], by: "agent", view: "old.jpg", region: { x: 0, y: 0, w: 300, h: 200 }, scale: 1 });
  views.push('{"at":"2026-10-0');
  put(path.join(root, ".strom", "views", "views.jsonl"), views);
  put(path.join(root, ".strom", "metrics", "readers.jsonl"), [...readers, "not json at all"]);
  // three days of fetches from one archive: waits for its hourly cap, its limit used up, images never looked at, and
  // two parts of B0001 the portal gave no sharper
  const host = "archiv.příklad.example";
  const fetches: (Record<string, unknown> | string)[] = [];
  for (const [i, day] of [14, 12, 10].entries())
    fetches.push({ at: ago(day), by: "agent", connector: "zkusebni", via: "direct", cmd: "fetch", book: "5359", rs: "B0002", asked: [17, 18, 19, 20], requests: 8, got: [17, 18, 19, 20], result: i === 2 ? "later" : "ok", hosts: { [host]: { requests: 8, paceMs: 16000, waits: i < 2 ? [{ ms: 15 * 60_000, why: "cap" }] : [] } }, ms: 1000 });
  for (const day of [9, 8]) fetches.push({ at: ago(day), by: "agent", connector: "zkusebni", cmd: "part", rs: "B0001", img: 3, requests: 0, result: "no-sharper", noSharper: { gain: 1.1 } });
  fetches.push("{broken");
  put(path.join(root, ".strom", "metrics", "fetch.jsonl"), fetches);

  const r = await w.ok(["media", "calibrate", "--report"]);
  const text = r.out;
  // in the research's language — its numbers too (a decimal comma, the dollar after) — impersonal
  assert.match(text, /^Čtení snímků · Claude Code · claude-opus-5-5 · 60 dní od \d{4}-\d\d-\d\d — z vlastních záznamů výzkumu, zdarma$/m, text);
  assert.match(text, /^Sezení 0 · čtenáři 5 · skeny 80 · pohledy 80$/m, text);
  assert.match(text, /^Cena za sken 0,038\s\$ · za pohled 0,038\s\$ \(známá u 100 % skenů\)$/m, text);
  // the older view line outside a session: nothing says its agent and model — apart, never under those of now
  assert.match(text, /^Naměřeno také pro: agent a model nezaznamenány \(starší záznamy\) \(1\)$/m, text);
  assert.match(text, /^Pohledy na sken: 1 · celé 100 % · půlky 0 %/m, text);
  assert.match(text, /^Kontext vyčištěn: 2× \(čtenáři s vyčištěním: 2 z 5\), poprvé zhruba při 120\s000 tokenech; pohledy po něm znovu otevřené 100 % \(odhad\)$/mu, text);
  assert.match(text, /^ {2}B0003 Метрическая книга Луга 1850–1870: skeny 32 · pohledy na sken 1 · nejisté 78 % z 32 čtení \(ostatní knihy 2 %\) · s nečitelným místem 25 z 32 · zvětšené pohledy 100 %$/m, text);
  assert.match(text, /^ {2}B0001 Křty Týnec 1784–1820: .*ostřejší výřez nebyl 2×/m, text);
  assert.match(text, /^ {2}archiv\.příklad\.example: sezení 3 · požadavky 24 \(8 na sezení, 2 na snímek\) · čekání 30 min · limit vyčerpán 1×$/m, text);
  assert.match(text, /^ {2}B0003: čte se hůř než ostatní knihy — nejisté 78 % proti 2 % \(n=32\)$/m, text);
  // the other books have no enlarged view: said so, never "against 0 %"
  assert.match(text, /^ {2}B0003: zvětšené pohledy 100 %, ostatní knihy žádné \(n=32\)/m, text);
  assert.doesNotMatch(text, /proti 0 %/, text);
  assert.match(text, /^ {2}B0001: portál ostřejší výřez nedal 2×$/m, text);
  assert.match(text, /^ {2}archiv\.příklad\.example: sezení s čekáním na limit archivu: 3 z 3 \(30 min, vyčerpán 1×\)$/m, text);
  assert.match(text, /^ {2}čtenáři bez výsledku: 2 z posledních 5$/m, text);
  assert.match(text, /^ {2}kontext se vyčistil: 2 z posledních 5 čtenářů, poprvé zhruba při 120\s000 tokenech$/mu, text);
  assert.match(text, /^ {2}B0002: staženo a nepřečteno 100 % \(12 z 12 snímků\)$/m, text);
  assert.doesNotMatch(text, /^Zatím málo/m, "every measure has its minimum here");
  // what only adds accuracy or saves requests is set by strom itself (core/tune.ts): said, nothing left to suggest
  assert.match(text, /^Nastavil strom sám — jen k přesnosti nebo k menší zátěži archivu/m, text);
  assert.doesNotMatch(text, /^Doporučení/m, text);
  assert.match(text, /^ {2}B0003: celý snímek ve velikosti čtení/m, text);
  assert.match(text, /^ {2}B0001: další výřezy této knihy se nenabízejí/m, text);
  assert.match(text, /^ {2}archiv\.příklad\.example: napřed celé snímky/m, text);
  assert.match(text, /^ {2}menší dávky: skeny na čtenáře asi 3 místo 6/m, text);
  assert.match(text, /^Vyšší hodinový strop archivu se nikdy nedoporučuje/m, text);

  // the same as JSON for an agent
  const j = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
  assert.equal(j.key, TUNED);
  assert.equal(j.model, "claude-opus-5-5");
  assert.deepEqual(j.samples, { sessions: 0, readers: 5, others: 5, scans: 80, views: 80, recovered: 0 });
  assert.deepEqual(j.others.map((o: { key: string; scans: number }) => [o.key, o.scans]), [["unknown", 1]]);
  assert.equal(j.cost.unit, "usd");
  assert.ok(Math.abs(j.cost.perScan - 3 / 80) < 1e-6, String(j.cost.perScan));
  // per reader; a reader's view of 240 000 px is about 320 tokens (Claude Code's w·h/750): 0.6 × 120 000 / 320 views
  // would be more than 30 — no stop lower
  assert.equal(j.context.per, "reader");
  assert.equal(j.context.readerViewBasis, "readers");
  assert.ok(j.context.readerViewTokens > 0 && j.context.viewTokens > 0);
  assert.equal(j.recommend.some((x: { id: string }) => x.id === "A3"), false);
  const b3 = j.books.find((b: { id: string }) => b.id === "B0003");
  assert.deepEqual(b3.signals, ["M5", "M6"]);
  assert.deepEqual([b3.read, b3.unsure, b3.marked, b3.sessions], [32, 25, 25, 2]);
  assert.equal(b3.enlargedBase, 0, "the pooled share of the other books");
  assert.equal(b3.title, "Метрическая книга Луга 1850–1870");
  const b2 = j.books.find((b: { id: string }) => b.id === "B0002");
  assert.deepEqual([b2.fetched, b2.unread, b2.requests], [12, 12, 24], "fetched three times, never looked at");
  assert.deepEqual(j.hosts.map((h: { host: string; signals: string[] }) => [h.host, h.signals]), [[host, ["M8", "M11"]]]);
  assert.deepEqual(new Set(j.signals.map((s: { metric: string }) => s.metric)), new Set(["M3", "M4", "M5", "M6", "M7", "M8", "M10", "M11"]));
  assert.deepEqual(new Set(j.tuned.map((x: { action: string }) => x.action)), new Set(["A1", "A2", "A4", "A5", "A7"]));
  assert.ok(j.tuned.every((x: { source: string; why: string }) => x.source === "tuned" && x.why), "each with its reason");
  assert.deepEqual([j.recommend, j.questions], [[], []], "nothing left to suggest: what asks an archive for more is never among them");


  // the summary is kept and outlives the journals strom tidy shortens; nothing else written
  const rollupFile = path.join(root, ".strom", "metrics", "rollup.json");
  const rollup = readJsonFile(rollupFile);
  assert.equal(rollup.version, 1);
  assert.ok(rollup.backfilled);
  fs.rmSync(path.join(root, ".strom", "views", "views.jsonl"));
  fs.writeFileSync(path.join(root, ".strom", "metrics", "fetch.jsonl"), "");
  const again = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
  assert.deepEqual([again.samples.scans, again.books.find((b: { id: string }) => b.id === "B0002").requests], [80, 24]);
  const status = await w.ok(["status", "--json"]);
  assert.equal(status.code, 0);
  w.cleanup();
});

/** A line of Claude Code's stream: one request of the agent (or of a subagent, under its tool call). */
const usage = (id: string, ctx: number, parent: string | null = null, model = "claude-opus-5-5") =>
  JSON.stringify({ type: "assistant", message: { id, model, content: [], usage: { input_tokens: 5, cache_read_input_tokens: ctx - 5, cache_creation_input_tokens: 0, output_tokens: 10 } }, parent_tool_use_id: parent });

/** A session of Claude Code with opus (as strom run starts one), closed. */
async function session(w: World): Promise<void> {
  await w.ok(["task", "add", "Křest Václava", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
  await w.ok(["session", "start", "T1"], { env: { CLAUDECODE: "1", STROM_MODEL: "opus" } });
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
}

/** The log of that session: requests, two fetches stopped by an archive's limit (in its words of now and of before). */
function sessionLog(root: string): void {
  fs.mkdirSync(path.join(root, ".strom", "runs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".strom", "runs", "N0001.log"),
    [
      JSON.stringify({ type: "system", subtype: "init", session_id: "u-1", model: "claude-opus-5-5" }),
      usage("m1", 40000),
      usage("m2", 140000),
      usage("m2", 140100),
      JSON.stringify({ type: "assistant", message: { id: "m3", content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "strom fetch zkusebni 5359 --images 1-4 --recordset B1" } }], usage: { input_tokens: 5, cache_read_input_tokens: 30000, output_tokens: 3 } } }),
      JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "  · archiv.example: its hourly cap is used up — strom waits until 14:05 (12 min), then goes on by itself\nfetch: 4 request(s)" }] } }),
      // an image the agent looked at: a long line, never needed
      JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "r1", content: [{ type: "image", source: { data: "A".repeat(300_000) } }] }] } }),
      JSON.stringify({ type: "assistant", message: { id: "m5", content: [{ type: "tool_use", id: "t2", name: "Bash", input: { command: "strom fetch zkusebni 5359 --images 5-9 --recordset B1" } }], usage: { input_tokens: 5, cache_read_input_tokens: 31000, output_tokens: 3 } } }),
      // the older words of a limit used up (before strom said "the archive's limit is used up")
      JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t2", content: "stopped: 120 requests to archiv.example in the last hour — its hourly cap; resumes at 15:10" }] } }),
      // the agent waits for it on its own
      JSON.stringify({ type: "assistant", message: { id: "m6", content: [{ type: "tool_use", id: "t3", name: "Bash", input: { command: "sleep 600" } }], usage: { input_tokens: 5, cache_read_input_tokens: 32000, output_tokens: 3 } } }),
      "[strom] a line of strom's own",
      usage("m4", 50000),
      // the session's end at a limit of the subscription: Claude Code's own message, nothing used — no clear
      JSON.stringify({ type: "assistant", message: { id: "m9", model: "<synthetic>", content: [{ type: "text", text: "limit" }], usage: { input_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, output_tokens: 0 } }, parent_tool_use_id: null }),
    ].join("\n"),
  );
}

test("what older sessions left is read once, marked as recovered: a session's log line by line (a limit in its older words, an agent's own wait, Claude Code's own message no clear), a reader's notes of scans — never a check of clips", opts, async () => {
  const { w, media } = await world();
  const root = w.cwd;
  await session(w);
  sessionLog(root);
  // a reader's report nobody recorded (before strom recorded its readers), its name in Czech; one block without its result
  fs.mkdirSync(path.join(root, "notes", "readings"), { recursive: true });
  fs.writeFileSync(path.join(root, "notes", "readings", "2026-10-01-křty-1.md"), report(media.B0001!.slice(0, 4), 1) + `\n## Image 9 · ${media.B0001![8]}\nillegible: celý zápis\n`);
  // a check of clips: its blocks say a verdict, they are no readings of scans
  fs.writeFileSync(path.join(root, "notes", "readings", "2026-10-01-clips-check-1.md"), `# Clips check\n\n## Image 1 · ${media.B0001![0]}\nverdict: ok\n\n## Image 2 · ${media.B0001![1]}\nverdict: wrong\n`);
  // older lines of the views (before strom recorded their kind): a whole page, a page of a double page, a crop
  const start = Date.parse(readJsonFile(path.join(root, "data", "sessions", "N0001.json")).started);
  const at = (s: number) => new Date(start + s * 1000).toISOString();
  put(path.join(root, ".strom", "views", "views.jsonl"), [
    { at: at(1), key: media.B0001![0], by: "N0001", view: "a.jpg", region: { x: 0, y: 0, w: 300, h: 200 }, scale: 1 },
    { at: at(2), key: media.B0001![1], by: "N0001", view: "b.jpg", region: { x: 150, y: 0, w: 150, h: 200 }, scale: 1 },
    { at: at(3), key: media.B0001![2], by: "N0001", view: "c.jpg", region: { x: 10, y: 10, w: 100, h: 50 }, scale: 2 },
  ]);
  const j = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
  assert.equal(j.key, KEY);
  assert.equal(j.backfill, true);
  assert.equal(j.samples.recovered, 2);
  assert.deepEqual([j.views.whole, j.views.half, j.views.crop], [0.333, 0.333, 0.333], "a half of an older line is a half");
  assert.deepEqual(j.backfillLogs, { read: 1, gone: 0, skipped: 0, long: 0 });
  const rollup = readJsonFile(path.join(root, ".strom", "metrics", "rollup.json"));
  assert.equal(rollup.backfillVersion, 3);
  const n1 = rollup.units.find((u: { id: string }) => u.id === "N0001");
  assert.equal(n1.key, KEY, "its key from its own record");
  // one clear (140 100 → 30 005): the end at the subscription's limit (0) is none
  assert.deepEqual([n1.backfill, n1.series, n1.clears, n1.firstClearCtx], [true, true, 1, 140100]);
  const h = n1.hosts["archiv.example"];
  assert.deepEqual([h.requests, h.waitMs, h.later, h.fetches, n1.books.B0001.requests], [4, 12 * 60_000 + 600_000, 1, 2, 4], "the older words of a limit and the agent's own wait after it");
  const notes = rollup.units.find((u: { id: string }) => u.id === "backfill:notes/readings/2026-10-01-křty-1.md");
  assert.deepEqual([notes.backfill, notes.key, notes.session, notes.books.B0001.read, notes.books.B0001.unsure, notes.books.B0001.scans], [true, KEY, "N0001", 4, 1, 0], "the block without a result is no reading; its scans are those its views show");
  assert.equal(rollup.units.some((u: { id: string }) => u.id.includes("clips-check")), false);
  // once: a log left later is not read again
  fs.appendFileSync(path.join(root, ".strom", "runs", "N0001.log"), "\n" + usage("m7", 160000) + "\n" + usage("m8", 20000) + "\n");
  await w.ok(["media", "calibrate", "--report"]);
  assert.equal(readJsonFile(path.join(root, ".strom", "metrics", "rollup.json")).units.find((u: { id: string }) => u.id === "N0001").clears, 1);
  w.cleanup();
});

test("a log that cannot be read is said, never passed over in silence; the figures recovered then partial", opts, async () => {
  const { w } = await world();
  const root = w.cwd;
  await session(w);
  // not a file one can read: a folder in its place
  fs.mkdirSync(path.join(root, ".strom", "runs", "N0001.log"), { recursive: true });
  put(path.join(root, ".strom", "views", "views.jsonl"), [{ at: new Date().toISOString(), key: "M0001", by: "N0001", view: "a.jpg", region: { x: 0, y: 0, w: 300, h: 200 }, scale: 1 }]);
  const r = await w.ok(["media", "calibrate", "--report"]);
  assert.match(r.out, /^Starší sezení dopočtena jen zčásti: záznamy smazané úklidem 0, nečitelné 1 — dopočtené údaje jsou neúplné$/m, r.out);
  const j = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
  assert.equal(j.backfillLogs.skipped, 1);
  assert.match(j.backfillLogs.reasons[0], /^N0001\.log: /);
  w.cleanup();
});

test("a unit's key once kept is its own: another agent or model chosen since moves nothing; an older summary read again, a check of clips no reading", opts, async () => {
  const { w, media } = await world();
  const root = w.cwd;
  await session(w);
  sessionLog(root);
  // a summary of an older version: everything under the agent and model of its day, a check of clips taken for readings
  const planted = {
    version: 1,
    updated: new Date().toISOString(),
    backfilled: new Date().toISOString(),
    units: [
      { id: "N0001", kind: "session", at: new Date().toISOString(), key: "codex gpt-x", guessed: true, backfill: true, books: {}, hosts: { "archiv.example": { requests: 1, images: 0, waitMs: 0, later: 0, fetches: 1, fetched: 0, unread: 0, pending: 0 } } },
      { id: "backfill:notes/readings/2026-10-01-clips-check-1.md", kind: "reader", at: new Date().toISOString(), key: "codex gpt-x", guessed: true, backfill: true, books: { B0001: { read: 30, unsure: 30, scans: 30 } }, hosts: {} },
      { id: "read-older", kind: "reader", at: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(), key: KEY, reported: "claude-opus-5-5", books: { B0002: { scans: 5, views: 5, read: 5, unsure: 0 } }, hosts: {} },
    ],
  };
  put(path.join(root, ".strom", "metrics", "rollup.json"), [planted]);
  const j = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
  const rollup = readJsonFile(path.join(root, ".strom", "metrics", "rollup.json"));
  assert.equal(rollup.backfillVersion, 3);
  assert.equal(rollup.units.some((u: { id: string }) => u.id.includes("clips-check")), false, "taken for readings by an older version: gone");
  const n1 = rollup.units.find((u: { id: string }) => u.id === "N0001");
  assert.deepEqual([n1.key, n1.hosts["archiv.example"].requests, n1.hosts["archiv.example"].later], [TUNED, 4, 1], "read again from its log, its key from its own record");
  assert.equal(j.key, TUNED);

  // another agent chosen: the history stays where it was — nothing measured for the new one yet
  await w.ok(["agents", "use", "codex"]);
  await w.ok(["config", "set", "model.lead", "gpt-x"]);
  put(path.join(root, ".strom", "views", "views.jsonl"), [{ at: new Date().toISOString(), key: media.B0001![0], by: "N0001", view: "a.jpg", region: { x: 0, y: 0, w: 300, h: 200 }, scale: 1 }]);
  const after = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
  assert.equal(after.measured, false, JSON.stringify(after).slice(0, 300));
  assert.ok(after.others.some((o: { key: string }) => o.key === TUNED));
  const kept = readJsonFile(path.join(root, ".strom", "metrics", "rollup.json"));
  assert.deepEqual(new Set(kept.units.map((u: { key: string }) => u.key)), new Set([TUNED]), "no unit moved to the agent of now");
  w.cleanup();
});

test("readers a login, a plan's limit or a failure stopped: said apart, in the research's language, never readers without a result", opts, async () => {
  const { w, media } = await world();
  const ids = media.B0001!.slice(0, 6);
  const rel = "notes/readings/read-ok.md";
  fs.mkdirSync(path.join(w.cwd, "notes", "readings"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, rel), report(ids, 0));
  const line = (name: string, day: number, outcome: string, more: Record<string, unknown> = {}) => ({ at: ago(day), by: "agent", reader: name, kind: "read", agent: "claude", key: KEY, model: "opus", images: ids.length, imageIds: ids, views: 0, outcome, missing: outcome === "ok" ? 0 : ids.length, ms: 60_000, ...more });
  put(path.join(w.cwd, ".strom", "views", "views.jsonl"), ids.map((m, i) => ({ at: ago(6, -2), key: m, by: "agent", view: `${m}-ok.jpg`, region: { x: 0, y: 0, w: 300, h: 200 }, scale: 1, w: 300, h: 200, W: 300, H: 200, kind: "whole", rs: "B0001", img: i + 1, reader: 1 })));
  put(path.join(w.cwd, ".strom", "metrics", "readers.jsonl"), [line("read-ok", 6, "ok", { report: rel, views: ids.length }), ...["limit", "auth", "limit", "error", "limit"].map((o, i) => line(`read-${o}-${i}`, 5 - i, o))]);
  const text = (await w.ok(["media", "calibrate", "--report"])).out;
  assert.match(text, /^Čtenáři bez výsledku: 0 z 1$/m, text);
  assert.match(text, /^Čtenáři zastavení přihlášením, limitem plánu nebo chybou: 5 – nepočítají se, o čtení neříkají nic$/m, text);
  const j = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
  assert.deepEqual(j.readers, { n: 1, noResult: 0, halted: 5, haltedBy: { limit: 3, auth: 1, error: 1 } });
  assert.equal(j.signals.some((s: { metric: string }) => s.metric === "M10"), false);
  assert.equal(j.tuned.some((x: { action: string }) => x.action === "A2"), false, "no smaller batches for a subscription's limit");
  w.cleanup();
});

test("many books: those with a signal first, a few in the text, all of them in --json", opts, async () => {
  const w = new World();
  await w.withTree();
  const root = w.cwd;
  const books = (from: number, n: number, c: Record<string, number>) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`B${String(from + i).padStart(4, "0")}`, { scans: 20, views: 20, read: 0, unsure: 0, ...c }]));
  const units = ["r1", "r2"].map((id, k) => ({ id, kind: "reader", at: new Date(Date.now() - (k + 2) * 24 * 3600_000).toISOString(), key: KEY, reported: "claude-opus-5-5", books: { ...books(1, 15, {}), B0099: { scans: 20, views: 20, enlarged: 20, read: 0, unsure: 0 } }, hosts: {} }));
  put(path.join(root, ".strom", "metrics", "rollup.json"), [{ version: 1, updated: new Date().toISOString(), backfilled: new Date().toISOString(), backfillVersion: 3, units }]);
  const r = await w.ok(["media", "calibrate", "--report"]);
  const lines = r.out.split("\n");
  const first = lines.indexOf("Knihy:");
  assert.match(lines[first + 1]!, /^ {2}B0099 /, "the book with a signal first");
  assert.match(r.out, /^ {2}… další: 4 \(všechny: --json\)$/m, r.out);
  assert.equal((await w.ok(["media", "calibrate", "--report", "--json"])).json.books.length, 16);
  w.cleanup();
});

test("nothing measured yet: said so; an archive says nothing of it and keeps nothing", opts, async () => {
  const w = new World();
  await w.withTree();
  const none = await w.ok(["media", "calibrate", "--report"]);
  assert.match(none.out, /^Čtení snímků · Claude Code · opus: zatím nic naměřeno/m, none.out);
  assert.equal((await w.ok(["media", "calibrate", "--report", "--json"])).json.measured, false);
  assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "metrics", "rollup.json")), false, "nothing measured, nothing kept");
  await w.ok(["mode", "archive"], { tty: true });
  put(path.join(w.cwd, ".strom", "views", "views.jsonl"), [{ at: ago(1), key: "M0001", by: "user", view: "a.jpg", scale: 1 }]);
  const r = await w.run(["media", "calibrate", "--report"]);
  assert.notEqual(r.code, 0);
  assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "metrics", "rollup.json")), false);
  w.cleanup();
});
