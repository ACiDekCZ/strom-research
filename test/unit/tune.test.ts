// The decisions of what strom sets by itself in how scans are read (core/tune.ts): only towards accuracy or fewer
// requests (a batch, a call, a stop only smaller; a view only bigger), back to the default once its signal has been gone
// TUNING.backAfterDays with new readings since, begun again for a new model under the same alias, a session going by the
// values of its start — and the numbers in the texts every agent reads.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { emptyBook, TUNING, type BookCounts, type Rollup, type Unit } from "../../src/core/readstats.ts";
import { bookViewSizes, pinned, readingFor, readingOf, selfTune, type Tuned } from "../../src/core/tune.ts";
import { Settings } from "../../src/core/config.ts";
import { Tree } from "../../src/core/tree.ts";
import { DEFAULT_READING_NUMBERS, selfReading, SELF_READING, PROFILES } from "../../src/agents/profiles.ts";
import { scanReaderPrompt, SCAN_READER_PROMPT } from "../../src/agents/scanreader.ts";
import { viewSizes } from "../../src/core/viewsizes.ts";

const opts = { skip: !hasGit };
const DAY = 24 * 3600_000;
const KEY = "claude opus";
/** The key of the model the alias ran on (core/modelkey.ts): what is measured and set goes by it. */
const TUNED = "claude claude-opus-5-5";
const T0 = Date.parse("2026-11-02T10:00:00Z");

function unit(id: string, at: number, books: Record<string, Partial<BookCounts>>, more: Partial<Unit> = {}): Unit {
  return { id, kind: "reader", at: new Date(at).toISOString(), key: KEY, reported: "claude-opus-5-5", books: Object.fromEntries(Object.entries(books).map(([b, c]) => [b, { ...emptyBook(), ...c }])), hosts: {}, ...more };
}

/** Five readers before `at`: `bad` of them ended without a result (two or more: smaller batches wanted). */
function readers(at: number, bad: number, prefix: string, reported = "claude-opus-5-5"): Unit[] {
  return [0, 1, 2, 3, 4].map((i) => unit(`${prefix}-${i}`, at - (5 - i) * DAY, { B0001: { scans: 4, views: 4, read: 4 } }, { reported, outcome: i < bad ? "timeout" : "ok", ...(i < bad ? { noResult: true as const } : {}) }));
}

const rollup = (units: Unit[], at: number): Rollup => ({ version: 1, updated: new Date(at).toISOString(), backfilled: new Date(at).toISOString(), units });

async function research(): Promise<{ w: World; tree: Tree; settings: () => Settings }> {
  const w = new World();
  await w.withTree();
  return { w, tree: Tree.open(w.cwd, w.env), settings: () => new Settings(w.env, {}) };
}

test("smaller batches set, kept while their signal is there, back to the default only once it has been gone long enough with new readings", opts, async () => {
  const { w, tree, settings } = await research();
  const first = readers(T0, 2, "a");
  const r0 = selfTune(tree, { settings: settings(), rollup: rollup(first, T0), now: T0, others: [] });
  assert.deepEqual(r0.changes.map((c) => [c.action, c.to]), [["A2", { batch: 3, viewsPerCall: 12 }]]);
  assert.equal(settings().config.tuning![TUNED]!.batch!.value, 3);

  // a month on, the readers fine now: still smaller (its signal gone only 30 days)
  const fine = readers(T0 + 30 * DAY, 0, "b");
  const r1 = selfTune(tree, { settings: settings(), rollup: rollup([...first, ...fine], T0 + 30 * DAY), now: T0 + 30 * DAY, others: [] });
  assert.deepEqual(r1.changes, []);
  assert.equal(settings().config.tuning![TUNED]!.batch!.value, 3);

  // gone longer than TUNING.backAfterDays but nothing read since: kept (no new data says so)
  const quiet = selfTune(tree, { settings: settings(), rollup: rollup(first, T0 + (TUNING.backAfterDays + 1) * DAY), now: T0 + (TUNING.backAfterDays + 1) * DAY, others: [] });
  assert.deepEqual(quiet.changes, []);

  // gone longer, with new readings: back to the default, logged
  const later = T0 + (TUNING.backAfterDays + 5) * DAY;
  const r2 = selfTune(tree, { settings: settings(), rollup: rollup([...fine, ...readers(later, 0, "c")], later), now: later, others: [] });
  assert.deepEqual(r2.changes.map((c) => [c.action, c.from, c.to]), [["A6", { batch: 3, viewsPerCall: 12 }, { batch: 6, viewsPerCall: 24 }]]);
  assert.equal(settings().config.tuning, undefined);
  const log = fs.readFileSync(path.join(w.cwd, ".strom", "tune", "log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(log.map((e: { action: string }) => e.action), ["A2", "A6"]);
  w.cleanup();
});

test("an earlier stop from the context measured, by the tokens of a reader's view — not the key's average, which small crops pull down", opts, async () => {
  const { w, tree, settings } = await research();
  // five readers whose context cleared at about 150 000 tokens, their views halves of ~4 000 tokens (3 Mpx); and one
  // session of the main agent with many small crops (75 000 px, 100 tokens) that would make the average view small
  const px = 3_000_000;
  const cleared = [0, 1, 2, 3, 4].map((i) =>
    unit(`r-${i}`, T0 - (5 - i) * DAY, { B0001: { scans: 6, views: 10, px: 10 * px, read: 6 } }, { outcome: "ok", series: true, clears: i < 3 ? 1 : 0, ...(i < 3 ? { firstClearCtx: 150_000 } : {}) }),
  );
  const crops = unit("N0001", T0 - DAY, { B0002: { scans: 30, views: 300, px: 300 * 75_000 } }, { kind: "session" });
  const r = selfTune(tree, { settings: settings(), rollup: rollup([...cleared, crops], T0), now: T0, others: [] });
  const a3 = r.changes.find((c) => c.action === "A3");
  // 0.6 × 150 000 / 4 000 = 22 (with the average view, ~430 tokens, it would be 209: never lower than 30)
  assert.deepEqual(a3?.to, { viewsStop: 22, ctx: 150_000 });
  assert.match(a3!.why, /a reader's view about 4000 tokens → a reader stops after about 22 views instead of 30/);
  assert.deepEqual([settings().config.tuning![TUNED]!.viewsStop!.value, settings().config.tuning![TUNED]!.ctx!.value], [22, 150_000]);
  w.cleanup();
});

/**
 * Five sessions of a main agent whose context never cleared (a model of a big window): `long` of them past 150 000
 * tokens with `views` views each, the others small; its views wholes of ~4 000 tokens (3 Mpx).
 */
function stretches(long: number, o: { views?: number; peak?: number; ownClears?: number } = {}): Unit[] {
  const views = o.views ?? 40;
  const px = 3_000_000;
  return [0, 1, 2, 3, 4].map((i) =>
    unit(`N000${i + 1}`, T0 - (5 - i) * DAY, { B0001: { scans: 10, views: i < long ? views : 12, whole: i < long ? views : 12, px: (i < long ? views : 12) * px, pxWH: (i < long ? views : 12) * px } }, {
      kind: "session",
      series: true,
      clears: i < long ? (o.ownClears ?? 0) : 0,
      peakCtx: i < long ? (o.peak ?? 170_000) : 60_000,
    }),
  );
}

test("an earlier stop where the context never clears: the main agent's long stretches against the stop, by the context a clear would come at", opts, async () => {
  const { w, tree, settings } = await research();
  // two of the last five sessions past 150 000 tokens with 40 views each, no clear: 0.6 × 150 000 / 4 000 = 22
  const r = selfTune(tree, { settings: settings(), rollup: rollup(stretches(2), T0), now: T0, others: [] });
  const a3 = r.changes.find((c) => c.action === "A3");
  assert.deepEqual(a3?.to, { viewsStop: 22, ctx: 150_000 });
  assert.match(a3!.why, /^the context never cleared, yet it grew past 150000 tokens with more than 30 views in 2 of the last 5 sessions \(about 40 views, 170000 tokens\), a reader's view about 4000 tokens → a reader stops after about 22 views instead of 30 — the main agent writes down what it found before more$/);
  assert.deepEqual(a3!.basis, { M12: 2, "M12.of": 5, "M12.views": 40, "M12.peak": 170_000, ctx: 150_000, viewTokens: 4000 });
  assert.equal(readingOf(settings().config, TUNED).viewsStop, 22);
  assert.equal(r.changes.some((c) => c.action === "A2"), false, "no smaller batches from it");
  w.cleanup();
});

test("no earlier stop from a stretch that is not long: one session, the context under 150 000, the views within the stop, or a context that cleared", opts, async () => {
  for (const [why, units] of [
    ["one of five", stretches(1)],
    ["under 150 000 tokens", stretches(3, { peak: 140_000 })],
    ["30 views: within the stop", stretches(3, { views: 30 })],
  ] as const) {
    const { w, tree, settings } = await research();
    const r = selfTune(tree, { settings: settings(), rollup: rollup([...units], T0), now: T0, others: [] });
    assert.equal(r.changes.some((c) => c.action === "A3"), false, why);
    w.cleanup();
  }
  // its own context cleared: the stop by the clear measured (M4), never by M12
  const { w, tree, settings } = await research();
  const cleared = stretches(3, { ownClears: 1 }).map((u, i) => (i < 3 ? { ...u, firstClearCtx: 120_000 } : u));
  const r = selfTune(tree, { settings: settings(), rollup: rollup(cleared, T0), now: T0, others: [] });
  const a3 = r.changes.find((c) => c.action === "A3");
  assert.deepEqual(a3?.to, { viewsStop: 18, ctx: 120_000 });
  assert.match(a3!.why, /^the context cleared in 3 of the last 5 readers/);
  w.cleanup();
});

test("a signal seen again keeps a change: A6 counts from the last day its signal was there", opts, async () => {
  const { w, tree, settings } = await research();
  selfTune(tree, { settings: settings(), rollup: rollup(readers(T0, 2, "a"), T0), now: T0, others: [] });
  const again = T0 + 40 * DAY;
  selfTune(tree, { settings: settings(), rollup: rollup(readers(again, 3, "b"), again), now: again, others: [] });
  assert.equal(settings().config.tuning![TUNED]!.batch!.seen.slice(0, 10), new Date(again).toISOString().slice(0, 10));
  // 61 days after the first, 21 after it was seen last: kept
  const later = T0 + 61 * DAY;
  const r = selfTune(tree, { settings: settings(), rollup: rollup(readers(later, 0, "c"), later), now: later, others: [] });
  assert.deepEqual(r.changes, []);
  w.cleanup();
});

test("only towards accuracy or fewer requests: a batch smaller already is never made bigger", opts, async () => {
  const { w, tree, settings } = await research();
  const s = settings();
  const at = new Date(T0 - 2 * DAY).toISOString();
  const smaller: Tuned<number> = { id: "Tabcdef", action: "A2", what: "reading.batch", scope: "key", value: 2, default: 6, from: 6, at, why: "earlier", basis: {}, rev: 1, seen: at, reported: "claude-opus-5-5", source: "tuned" };
  s.config.tuning = { [KEY]: { reported: "claude-opus-5-5", batch: smaller } };
  s.save();
  const r = selfTune(tree, { settings: settings(), rollup: rollup(readers(T0, 2, "a"), T0), now: T0, others: [] });
  assert.deepEqual(r.changes.map((c) => [c.to]), [[12]], "only the views a call");
  assert.equal(settings().config.tuning![TUNED]!.batch!.value, 2);
  w.cleanup();
});

test("another version under the same alias is another key: what was set for the one before is not used for it, and stays its own", opts, async () => {
  const { w, tree, settings } = await research();
  selfTune(tree, { settings: settings(), rollup: rollup(readers(T0, 2, "a"), T0), now: T0, others: [] });
  assert.equal(settings().config.tuning![TUNED]!.reported, "claude-opus-5-5");
  assert.equal(readingFor(settings(), "claude", tree.config, { root: tree.root }).batch, 3, "the alias runs on 5.5: its values");
  const at = T0 + 3 * DAY;
  const r = selfTune(tree, { settings: settings(), rollup: rollup(readers(at, 0, "b", "claude-opus-5-6"), at), now: at, others: [] });
  assert.deepEqual(r.changes, []);
  // the alias runs on 5.6 now: the defaults for it; 5.5 keeps what was set for it
  assert.equal(readingFor(settings(), "claude", tree.config, { root: tree.root }).batch, 6);
  assert.equal(readingFor(settings(), "claude", tree.config, { root: tree.root }).key, "claude claude-opus-5-6");
  assert.equal(settings().config.tuning![TUNED]!.batch!.value, 3);
  w.cleanup();
});

test("an archive, or tune.auto off: nothing decided", opts, async () => {
  const { w, tree, settings } = await research();
  const off = new Settings({ ...w.env, STROM_TUNE_AUTO: "off" }, {});
  assert.deepEqual(selfTune(tree, { settings: off, rollup: rollup(readers(T0, 2, "a"), T0), now: T0, others: [] }).changes, []);
  assert.equal(settings().config.tuning, undefined);
  tree.config.mode = "archive";
  assert.deepEqual(selfTune(tree, { settings: settings(), rollup: rollup(readers(T0, 2, "a"), T0), now: T0, others: [] }).changes, []);
  assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "tune", "state.json")), false);
  w.cleanup();
});

test("strom tidy never touches what strom set by itself", opts, async () => {
  const { w } = await research();
  const dir = path.join(w.cwd, ".strom", "tune");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "log.jsonl"), "x".repeat(30 * 1024 * 1024));
  fs.writeFileSync(path.join(dir, "state.json"), "{}");
  const old = new Date(Date.now() - 400 * DAY);
  for (const f of ["log.jsonl", "state.json"]) fs.utimesSync(path.join(dir, f), old, old);
  const plan = (await w.ok(["tidy", "--json"])).json;
  assert.ok(!JSON.stringify(plan).includes(".strom/tune") && !JSON.stringify(plan).includes("tune/"), JSON.stringify(plan));
  assert.ok(fs.existsSync(path.join(dir, "log.jsonl")) && fs.existsSync(path.join(dir, "state.json")));
  w.cleanup();
});

test("a session goes by the values of its start; a book's views only bigger, never above what the model takes", () => {
  const t: Tuned<number> = { id: "T1", action: "A2", what: "reading.batch", scope: "key", value: 3, default: 6, from: 6, at: "2026-11-02T10:00:00.000Z", why: "", basis: {}, rev: 1, seen: "2026-11-02T10:00:00.000Z", source: "tuned" };
  assert.equal(pinned(t), 3);
  assert.equal(pinned(t, "2026-11-02T11:00:00.000Z"), 3, "a session begun after it");
  assert.equal(pinned(t, "2026-11-02T09:00:00.000Z"), undefined, "a session begun before it: the default");
  assert.equal(pinned({ ...t, value: 2, from: 3 }, "2026-11-02T09:00:00.000Z"), 3, "…or the value before it");
  const cfg = { tuning: { [KEY]: { batch: t, viewsPerCall: { ...t, what: "reading.batch", value: 12, default: 24, from: 24 } } } };
  assert.deepEqual(readingOf(cfg, KEY), { key: KEY, batch: 3, viewsStop: 30, viewsPerCall: 12, readerBatch: 5, tuned: ["T1"] });
  assert.deepEqual(readingOf(cfg, KEY, { on: false }).batch, 6, "tune.auto off: the defaults");
  assert.deepEqual(readingOf(cfg, "codex gpt-x").batch, 6, "another agent and model: its own");
  const base = viewSizes({}, "claude", "opus");
  const find: Tuned<number> = { ...t, id: "T2", action: "A1", what: "views.size", scope: "book:B0003", value: 9000, default: 1400, from: 1400 };
  const state = { [KEY]: { books: { B0003: { find, halves: { ...find, value: true, default: false, from: false } as unknown as Tuned<boolean> } }, hosts: {} } };
  const b = bookViewSizes(base, state, "B0003");
  assert.deepEqual([b.find, b.read, b.halves, b.tuned], [base.max, base.max, true, "T2"], "never above what the model takes");
  assert.equal(bookViewSizes(base, state, "B0001"), base);
  // a calibration bigger than a tuning: the bigger stays (a book's views only grow)
  assert.equal(bookViewSizes({ ...base, find: 2000 }, { [KEY]: { books: { B0003: { find: { ...find, value: 1600 } } }, hosts: {} } }, "B0003").find, 2000);
});

test("the numbers reach every agent's texts: the defaults as always, the tuned ones where strom set them", () => {
  assert.equal(selfReading(), SELF_READING);
  assert.equal(scanReaderPrompt(), SCAN_READER_PROMPT);
  assert.equal(PROFILES.codex!.instructions({}), SELF_READING);
  const n = { batch: 3, viewsStop: 18, viewsPerCall: 12 };
  const self = selfReading(n);
  assert.match(self, /in batches of about three: open a batch/);
  assert.match(self, /B0001:57-59 --half both/);
  assert.match(self, /After about 18 views, write down what you found/);
  // a sub-agent the agent starts itself (Codex delegates on its own) reads by the same numbers
  assert.match(self, /A batch handed to a sub-agent of your own \(Codex: spawn_agent\) gets the whole\nquestion and the same numbers: about three scans, at most 12 views a\ncall, a stop at about 18 views/);
  for (const id of ["codex", "antigravity", "opencode", "grok"]) assert.equal(PROFILES[id]!.instructions({}, n), self);
  const claude = PROFILES.claude!.instructions({}, n);
  assert.match(claude, /About three scans \(images B…:n\) per delegate/);
  assert.match(claude, /at about 18 views and return what it has/);
  assert.equal(PROFILES.claude!.instructions({}), PROFILES.claude!.instructions({}, DEFAULT_READING_NUMBERS));
  const reader = scanReaderPrompt(n);
  assert.match(reader, /at most 12 images and\n12 views a call: 12 whole images, or 3 with 4 views each/);
  assert.match(reader, /After about 18 views, stop and report what you have/);
  assert.match(scanReaderPrompt({ ...n, viewsPerCall: 8 }), /at most 8 images and\n8 views a call: 8 whole images, or 2 with 4 views each/);
});
