// The arithmetic of the reading of scans summed up (core/readstats.ts): Wilson 90 % intervals, the relative thresholds
// against the usual of the same key, the minimum samples, the clears of a usage series, the keys apart by the model
// the agent said, what is suggested — never more requests to an archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CLAUDE_TOKEN_WEIGHTS,
  clearsOf,
  computeUnits,
  D1_BASIS,
  emptyBook,
  fromLog,
  groups,
  keyOfReported,
  kindOfRegion,
  lastOf,
  manyWeb,
  median,
  mergeUnit,
  rateSignal,
  readingShare,
  recordKey,
  shareSignal,
  streamClears,
  streamTokens,
  summarize,
  THRESHOLDS,
  UNKNOWN_KEY,
  wilson,
  type BookCounts,
  type Unit,
} from "../../src/core/readstats.ts";
import type { Tree } from "../../src/core/tree.ts";

const close = (a: number, b: number, eps = 5e-4) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const DAY = 24 * 3600_000;

test("Wilson 90 %: known values, empty, all and none", () => {
  const w = wilson(5, 10);
  close(w.p, 0.5);
  close(w.lo, 0.2693);
  close(w.hi, 0.7307);
  const none = wilson(0, 20);
  assert.equal(none.lo, 0);
  close(none.hi, 0.1192);
  const all = wilson(20, 20);
  assert.equal(all.hi, 1);
  close(all.lo, 0.8808);
  assert.deepEqual(wilson(0, 0), { p: 0, lo: 0, hi: 1 }, "nothing measured: anything");
  // a 95 % interval is wider
  assert.ok(wilson(5, 10, 1.96).lo < w.lo);
});

test("median: odd, even, empty, not a number left out", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), undefined);
  assert.equal(median([NaN, 5]), 5);
});

test("a share signals only above the usual's interval, at its multiple and with its minimum sample", () => {
  const rule = { ratio: THRESHOLDS.M5.ratio, plus: THRESHOLDS.M5.plus, min: THRESHOLDS.M5.read };
  const base = { k: 12, n: 100, median: 0.12 };
  // 41 % of 24 against 12 %: above
  const yes = shareSignal(10, 24, base, rule);
  assert.equal(yes.signal, true);
  assert.ok(yes.lo > wilson(12, 100).hi);
  close(yes.ratio!, 0.4167 / 0.12, 1e-3);
  // the same share on 10 readings: below the minimum
  const few = shareSignal(4, 10, base, rule);
  assert.deepEqual([few.signal, few.enough], [false, false]);
  // twice the usual but within its interval: no
  assert.equal(shareSignal(6, 24, { k: 3, n: 30, median: 0.1 }, rule).signal, false);
  // far above in the interval but less than 2×: no
  assert.equal(shareSignal(150, 200, { k: 400, n: 1000, median: 0.4 }, rule).signal, false);
  // 2× but not 10 points more: no
  assert.equal(shareSignal(200, 2000, { k: 50, n: 1000, median: 0.05 }, rule).signal, false);
  // no usual to hold it against: no signal
  assert.equal(shareSignal(20, 24, undefined, rule).signal, false);
});

test("a rate signals at its multiple with its minimum sample; the last units' flags", () => {
  assert.equal(rateSignal(0.3, 0.1, 20, { ratio: 1.5, min: 15 }).signal, true);
  assert.equal(rateSignal(0.3, 0.1, 10, { ratio: 1.5, min: 15 }).signal, false);
  assert.equal(rateSignal(0.14, 0.1, 20, { ratio: 1.5, min: 15 }).signal, false);
  assert.equal(rateSignal(0.3, undefined, 20, { ratio: 1.5, min: 15 }).signal, false);
  assert.deepEqual(lastOf([true, true, false, false], THRESHOLDS.M10), { signal: false, hits: 2, of: 4, enough: false });
  assert.deepEqual(lastOf([true, true, false, false, false, false, true], THRESHOLDS.M10), { signal: false, hits: 1, of: 5, enough: true }, "only the last five");
  assert.equal(lastOf([false, false, true, false, true], THRESHOLDS.M10).signal, true);
});

test("context clears per stream: a subagent's drop is its own, a small dip is no clear", () => {
  const c = clearsOf([
    { t: 1, ctx: 50_000, sub: "" },
    { t: 2, ctx: 20_000, sub: "a" },
    { t: 3, ctx: 120_000, sub: "" },
    { t: 4, ctx: 110_000, sub: "" }, // 10k: no
    { t: 5, ctx: 90_000, sub: "a" },
    { t: 6, ctx: 30_000, sub: "a" },
    { t: 7, ctx: 25_000, sub: "" },
  ]);
  assert.deepEqual(c, { clears: 2, first: { t: 6, ctx: 90_000 } });
  assert.deepEqual(clearsOf([{ t: 1, sub: "" }]), { clears: 0 });
});

function unit(id: string, daysAgo: number, books: Record<string, Partial<BookCounts>>, more: Partial<Unit> = {}): Unit {
  return { id, kind: "reader", at: new Date(Date.now() - daysAgo * DAY).toISOString(), key: "codex gpt-x", books: Object.fromEntries(Object.entries(books).map(([b, c]) => [b, { ...emptyBook(), ...c }])), hosts: {}, ...more };
}

test("keys apart by the model the agent said; units older than the window left out; the units that said none go with the newest", () => {
  const g = groups([
    unit("a", 70, { B1: { scans: 1 } }, { reported: "gpt-x-1" }),
    unit("b", 20, { B1: { scans: 1 } }, { reported: "gpt-x-1" }),
    unit("c", 10, { B1: { scans: 1 } }, { reported: "gpt-x-2" }),
    unit("d", 5, { B1: { scans: 1 } }),
    unit("e", 5, { B1: { scans: 1 } }, { key: "claude opus" }),
  ]);
  assert.deepEqual(
    g.map((x) => [x.key, x.reported ?? null, x.units.map((u) => u.id)]),
    [
      ["codex gpt-x", "gpt-x-2", ["c", "d"]],
      ["claude opus", null, ["e"]],
      ["codex gpt-x", "gpt-x-1", ["b"]],
    ],
  );
});

test("a book signals only against the other books of the key, with its minimum from two units; what is suggested asks no archive for more", () => {
  const good = { scans: 16, views: 16, read: 16, unsure: 1 };
  const bad = { scans: 16, views: 16, enlarged: 16, read: 16, unsure: 12 };
  const units = [unit("r1", 9, { B1: good, B2: { ...good, unsure: 0 } }), unit("r2", 6, { B1: good, B3: bad, B2: good }), unit("r3", 3, { B3: bad })];
  const r = summarize(groups(units)[0]!);
  const b3 = r.books.find((b) => b.id === "B3")!;
  assert.deepEqual(b3.signals, ["M5", "M6"]);
  assert.deepEqual(r.books.find((b) => b.id === "B1")!.signals, []);
  assert.deepEqual(r.recommend.map((x) => [x.id, x.scope, x.auto, x.requestsMore]), [["A1", "book:B3", true, 0]]);
  // the same bad book from one unit only: too little for unsure readings (M5), enlarged views (M6) count per view
  const one = summarize(groups([unit("r1", 9, { B1: { ...good, scans: 32, read: 32, views: 32 }, B2: { ...good, scans: 32, read: 32, views: 32 } }), unit("r2", 3, { B3: { ...bad, scans: 32, views: 32, enlarged: 32, read: 32, unsure: 24 } })])[0]!);
  assert.deepEqual(one.books.find((b) => b.id === "B3")!.signals, ["M6"]);
  // too few scans everywhere: said as short, nothing signalled
  const few = summarize(groups([unit("r1", 9, { B1: { scans: 3, views: 3, read: 3 } }), unit("r2", 3, { B2: { scans: 3, views: 3, enlarged: 3, read: 3, unsure: 3 } })])[0]!);
  assert.deepEqual(few.signals, []);
  assert.deepEqual(few.short, ["M2", "M5", "M6"]);
});

test("the usual of other researches on this computer when this one has too few books of the key", () => {
  const bad = { scans: 24, views: 24, read: 24, unsure: 20 };
  const alone = summarize(groups([unit("r1", 9, { B9: bad }), unit("r2", 3, { B9: bad })])[0]!);
  assert.deepEqual(alone.books[0]!.signals, [], "nothing to hold it against");
  const others = [unit("x/r1", 9, { B1: { scans: 30, read: 30, unsure: 2 } }), unit("x/r2", 9, { B2: { scans: 30, read: 30, unsure: 3 } }), unit("y/r1", 9, { B1: { read: 30, unsure: 30 } }, { key: "claude opus" })];
  const held = summarize(groups([unit("r1", 9, { B9: bad }), unit("r2", 3, { B9: bad })])[0]!, { others });
  assert.deepEqual(held.books[0]!.signals, ["M5"]);
  close(held.books[0]!.base!, 0.0833, 1e-3);
});

test("a journal shortened since: the summary keeps what it knew, a recovered series stays", () => {
  const before = unit("N1", 5, { B1: { scans: 10, views: 30 } }, { kind: "session", series: true, clears: 2, firstClearCtx: 140_000, backfill: true });
  const now = unit("N1", 5, { B1: { scans: 2, views: 4 } }, { kind: "session" });
  const m = mergeUnit(before, now);
  assert.deepEqual([m.books.B1!.views, m.clears, m.backfill], [30, 2, true]);
  const grown = unit("N1", 5, { B1: { scans: 12, views: 40 } }, { kind: "session" });
  const g = mergeUnit(before, grown);
  assert.deepEqual([g.books.B1!.views, g.series, g.clears, g.firstClearCtx], [40, true, 2, 140_000]);
});

// ── the check on a research of 260 sessions (O5): what it found wrong, each kept right ─────────────────────────────

/** A research's records as computeUnits reads them: a folder and its lists (nothing else of a tree is used). */
function fakeTree(records: Record<string, unknown[]>): { tree: Tree; root: string; done: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-readstats-"));
  const tree = { root, list: (type: string) => records[type] ?? [] } as unknown as Tree;
  return { tree, root, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}
const iso = (t: number) => new Date(t).toISOString();
const assistant = (id: string, ctx: number, o: { sub?: string; model?: string; out?: number; cw?: number; tools?: unknown[] } = {}) =>
  JSON.stringify({ type: "assistant", message: { id, model: o.model ?? "claude-opus-5-5", content: o.tools ?? [], usage: { input_tokens: 5, cache_read_input_tokens: ctx - 5 - (o.cw ?? 0), cache_creation_input_tokens: o.cw ?? 0, output_tokens: o.out ?? 10 } }, parent_tool_use_id: o.sub ?? null });

test("a log read line by line in small pieces: a line too long to hold skipped and counted, the requests around it read", () => {
  const { root, done } = fakeTree({});
  try {
    const file = path.join(root, "N0001.log");
    fs.writeFileSync(
      file,
      [
        JSON.stringify({ type: "system", subtype: "init", session_id: "11111111-2222-3333-4444-555555555555" }),
        assistant("m1", 40_000),
        // an image the agent looked at, longer than a line may be: never held whole
        JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "x", content: [{ type: "image", source: { data: "Q".repeat(50_000) } }] }] } }),
        // an assistant's line too long as well (its text): skipped and counted
        JSON.stringify({ type: "assistant", message: { id: "m2", content: [{ type: "text", text: "ž".repeat(30_000) }], usage: { input_tokens: 1 } } }),
        assistant("m3", 140_000),
        assistant("m4", 30_000),
        assistant("m5", 0, { model: "<synthetic>" }).replace(/"cache_read_input_tokens":-5/, '"cache_read_input_tokens":0').replace(/"input_tokens":5/, '"input_tokens":0').replace(/"output_tokens":10/, '"output_tokens":0'),
      ].join("\n"),
    );
    const got = fromLog(file, new Map(), { chunk: 256, maxLine: 4096 });
    assert.equal(got.long, 2);
    assert.equal(got.agentSession, "11111111-2222-3333-4444-555555555555");
    assert.deepEqual(got.samples.map((s) => s.ctx), [40_000, 140_000, 30_000, 0]);
    // the synthetic end with nothing used is no clear: one clear only
    assert.deepEqual(clearsOf(got.samples), { clears: 1, first: { t: got.samples[2]!.t, ctx: 140_000 } });
    // a log that is not there: thrown (counted by the summary), never an empty reading
    assert.throws(() => fromLog(path.join(root, "N0002.log")));
  } finally {
    done();
  }
});

test("a session's subagents from its log: each a reader of its own (its clears apart), the delegations counted", () => {
  const { root, done } = fakeTree({});
  try {
    const file = path.join(root, "N0001.log");
    const task = (id: string) => ({ type: "tool_use", id, name: "Task", input: { prompt: "read" } });
    fs.writeFileSync(
      file,
      [
        assistant("m1", 30_000, { tools: [task("ta"), task("tb")] }),
        assistant("a1", 20_000, { sub: "ta", cw: 19_000 }),
        assistant("a2", 160_000, { sub: "ta", cw: 100_000 }),
        assistant("a3", 25_000, { sub: "ta", cw: 5_000 }),
        assistant("b1", 20_000, { sub: "tb", cw: 19_000 }),
        assistant("b2", 60_000, { sub: "tb", cw: 40_000 }),
        assistant("m2", 32_000),
      ].join("\n"),
    );
    const got = fromLog(file);
    assert.equal(got.delegated, 2);
    assert.deepEqual(streamClears(got.samples), [
      { sub: "ta", clears: 1, ctx: 160_000 },
      { sub: "tb", clears: 0 },
    ]);
    const tokens = streamTokens(got.samples)!;
    assert.deepEqual([...tokens.keys()], ["", "ta", "tb"]);
    assert.equal(tokens.get("ta")!.cw, 124_000);
  } finally {
    done();
  }
});

test("the reading's share of a session's cost: its subagents read whole, never the whole session where they are not known", () => {
  const m = { inputTokens: 100, cacheWriteTokens: 9_900, outputTokens: 2_000, cacheReadTokens: 500_000 };
  // known streams: the agent's own 10 000 new tokens, its subagents' 200 000; views of 150 000 tokens (all theirs)
  const streams = new Map([
    ["", { in: 100, cw: 9_900, cr: 500_000, out: 2_000 }],
    ["t1", { in: 50, cw: 199_950, cr: 1_000_000, out: 8_000 }],
  ]);
  const r = readingShare(150_000 * 750, m, streams, true)!;
  const W = CLAUDE_TOKEN_WEIGHTS;
  const w = (t: { in: number; cw: number; cr: number; out: number }) => t.in * W.in + t.cw * W.cw + t.cr * W.cr + t.out * W.out;
  close(r.share, w(streams.get("t1")!) / (w(streams.get("t1")!) + w(streams.get("")!)), 1e-9);
  assert.deepEqual([Math.round(r.tokens.new), r.tokens.out], [200_000, 8_000]);
  // the views took more than the subagents took in: the rest from the agent's own
  const more = readingShare(205_000 * 750, m, streams, true)!;
  assert.ok(more.share > r.share && more.share < 1);
  // it delegated, its subagents' use not known: unknown — never the session's whole cost
  assert.equal(readingShare(150_000 * 750, m, undefined, true), undefined);
  // nothing said of its streams and views of more tokens than its own agent took in: unknown
  assert.equal(readingShare(150_000 * 750, m, undefined, false), undefined);
  // the agent read itself: the views' share of its own new tokens
  close(readingShare(5_000 * 750, m, undefined, false)!.share, 0.5);
});

test("an older line of the views: its kind by its region — a page of a double page is a half", () => {
  assert.equal(kindOfRegion(3000, 2000, 3000, 2000), "whole");
  assert.equal(kindOfRegion(3000, 2000, 2900, 1960), "whole");
  assert.equal(kindOfRegion(3000, 2000, 1500, 2000), "half");
  assert.equal(kindOfRegion(3000, 2000, 3000, 1000), "half");
  assert.equal(kindOfRegion(3000, 2000, 900, 2000), "crop");
  assert.equal(kindOfRegion(undefined, 2000, 900, 2000), "crop");
});

test("a key from what the record says, never the settings of now; once kept, never moved", () => {
  assert.equal(recordKey("claude", "opus", "claude-sonnet-4-6"), "claude opus", "the model strom started it with");
  assert.equal(recordKey("claude", undefined, "claude-opus-5-5[1m]"), "claude claude-opus-5-5", "the model it said, as one key names it");
  assert.equal(recordKey("codex", undefined, "gpt-x-1"), "codex gpt-x-1");
  assert.equal(recordKey("claude", undefined, undefined), "claude");
  assert.equal(recordKey(undefined, "opus", "claude-opus-5-5"), UNKNOWN_KEY, "no agent said: not known");
  assert.equal(keyOfReported("claude", "claude sonnet", "claude-opus-5-5"), "claude claude-opus-5-5");
  assert.equal(keyOfReported("claude", "claude opus", "claude-opus-5-5"), "claude claude-opus-5-5");
  assert.equal(keyOfReported("claude", "claude opus", undefined), "claude opus");
  // a stored unit keeps its key whatever a later reading guesses (another agent or model chosen since)
  const stored = unit("N1", 5, { B1: { scans: 10, views: 30 } }, { kind: "session", key: "claude opus", guessed: true });
  const later = unit("N1", 5, { B1: { scans: 12, views: 40 } }, { kind: "session", key: "codex gpt-x", guessed: true });
  assert.equal(mergeUnit(stored, later).key, "claude opus");
  // only a key strom recorded replaces a guess
  assert.equal(mergeUnit(stored, { ...later, guessed: undefined, key: "claude sonnet" }).key, "claude sonnet");
});

test("what older sessions left, read: images fetched and never read (M11), logs gone or not readable said, keys from the records", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  const day = 24 * 3600_000;
  const session = (id: string, daysAgo: number, more: Record<string, unknown> = {}) => ({ id, type: "session", state: "closed", started: iso(now - daysAgo * day), ended: iso(now - daysAgo * day + 3600_000), created: iso(now - daysAgo * day), agent: "claude", model: "opus", runner: "claude", ...more });
  const image = (id: string, n: number, daysAgo: number) => ({ id, type: "media", recordset: "B0007", image: n, width: 3000, height: 2000, created: iso(now - daysAgo * day + 600_000), fetched: { connector: "zkusebni", book: "1" } });
  const { tree, root, done } = fakeTree({
    session: [session("N0001", 20), session("N0002", 15), session("N0003", 12, { runner: undefined }), session("N0004", 10)],
    media: [image("M0001", 1, 20), image("M0002", 2, 20), image("M0003", 3, 15), image("M0004", 4, 12)],
  });
  try {
    // M0001 looked at in its session; the others never
    fs.mkdirSync(path.join(root, ".strom", "views"), { recursive: true });
    fs.writeFileSync(path.join(root, ".strom", "views", "views.jsonl"), JSON.stringify({ at: iso(now - 20 * day + 1200_000), key: "M0001", by: "N0001", region: { x: 0, y: 0, w: 1500, h: 2000 }, scale: 0.5 }) + "\n");
    // N0001 and N0002 had logs (one a folder: not readable), N0004 had one strom tidy took
    fs.mkdirSync(path.join(root, ".strom", "runs", "N0002.log"), { recursive: true });
    fs.writeFileSync(path.join(root, ".strom", "runs", "N0001.log"), [assistant("m1", 30_000), assistant("m2", 40_000)].join("\n"));
    const logs = { read: 0, gone: 0, skipped: 0, long: 0 };
    const units = computeUnits(tree, { guess: () => "codex now", backfill: true, now, logs });
    assert.deepEqual([logs.read, logs.gone, logs.skipped], [1, 1, 1]);
    const n1 = units.find((u) => u.id === "N0001")!;
    assert.equal(n1.key, "claude opus", "its own record, not the settings of now");
    assert.deepEqual([n1.books.B0007!.fetched, n1.books.B0007!.unread, n1.books.B0007!.half], [2, 1, 1]);
    assert.equal(n1.hosts.zkusebni!.unread, 1);
    const fetched = units.reduce((n, u) => n + (u.books.B0007?.fetched ?? 0), 0);
    const unread = units.reduce((n, u) => n + (u.books.B0007?.unread ?? 0), 0);
    assert.deepEqual([fetched, unread], [4, 3]);
    assert.ok(units.every((u) => u.key !== "codex now"));
  } finally {
    done();
  }
});

test("a book signals only clearly above the usual: M1 at 2× on 30 scans from two sessions, M2 at 3×, M6 against the other books' views together", () => {
  const plain = { scans: 16, views: 32, read: 0, unsure: 0 };
  const costly = { scans: 16, views: 32 };
  const units = [
    unit("N1", 9, { B1: plain, B2: plain, B3: costly }, { kind: "session", usd: 3 }),
    unit("N2", 6, { B1: plain, B2: plain, B3: costly }, { kind: "session", usd: 3 }),
  ];
  // the cost split by what each book looked at: the same here — no M1
  assert.deepEqual(summarize(groups(units)[0]!).signals.filter((s) => s.metric === "M1"), []);
  // views per scan 2× the usual: no M2 any more (3×)
  const views = [unit("N1", 9, { B1: plain, B2: plain, B3: { scans: 16, views: 64 } }, { kind: "session" }), unit("N2", 6, { B1: plain, B2: plain, B3: { scans: 16, views: 64 } }, { kind: "session" })];
  assert.deepEqual(summarize(groups(views)[0]!).books.find((b) => b.id === "B3")!.signals, []);
  const many = [unit("N1", 9, { B1: plain, B2: plain, B3: { scans: 16, views: 112 } }, { kind: "session" }), unit("N2", 6, { B1: plain, B2: plain, B3: { scans: 16, views: 112 } }, { kind: "session" })];
  assert.deepEqual(summarize(groups(many)[0]!).books.find((b) => b.id === "B3")!.signals, ["M2"]);
  // M6: most books none enlarged (a median of 0), the others together 15 %: 25 % is no signal, 60 % is
  const book = (enlarged: number) => ({ scans: 20, views: 40, enlarged });
  const m6 = (e: number) => summarize(groups([unit("r1", 9, { B1: book(0), B2: book(0), B3: book(18), B4: book(e) }), unit("r2", 6, { B1: book(0), B2: book(0), B3: book(18), B4: book(e) })])[0]!).books.find((b) => b.id === "B4")!;
  assert.deepEqual(m6(10).signals, []);
  assert.equal(m6(10).enlargedBase, 0.15);
  assert.deepEqual(m6(24).signals, ["M6"]);
  // D1 (smaller views, a person's question) rests on the cost per scan only
  assert.deepEqual(D1_BASIS, ["M1"]);
});

test("M10 counts only readers that read: a login, a plan's limit or a failure stopped are counted apart, never a reader without a result", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  const { tree, root, done } = fakeTree({});
  try {
    // five readers a subscription's limit or a login stopped (nothing of their images written), one that timed out
    const line = (name: string, min: number, outcome: string) => ({ at: iso(now - min * 60_000), by: "agent", reader: name, kind: "read", agent: "claude", key: "claude opus", model: "opus", images: 6, imageIds: [], views: 0, outcome, missing: 6, ms: 60_000 });
    const plan: [string, string][] = [["limit", "limit"], ["auth", "auth"], ["limit-2", "limit"], ["error", "error"], ["limit-3", "limit"], ["slow", "timeout"]];
    fs.mkdirSync(path.join(root, ".strom", "metrics"), { recursive: true });
    fs.writeFileSync(path.join(root, ".strom", "metrics", "readers.jsonl"), plan.map(([n, o], i) => JSON.stringify(line(n, 600 - i * 60, o))).join("\n") + "\n");
    const units = computeUnits(tree, { guess: () => "claude opus", now });
    assert.deepEqual(units.filter((u) => u.noResult).map((u) => u.id), ["slow"], "only the reader that read and gave nothing");
    const r = summarize(groups(units, now)[0]!, { now });
    assert.deepEqual(r.signals.filter((s) => s.metric === "M10"), []);
    assert.deepEqual(r.readers, { n: 1, noResult: 1, halted: 5, haltedBy: { limit: 3, auth: 1, error: 1 } });
    // a unit kept from before with noResult on a limit: its outcome decides, not the flag
    const kept = [0, 1, 2, 3, 4].map((i) => unit(`k${i}`, 5 - i, {}, { key: "claude opus", outcome: "limit", noResult: true }));
    const r2 = summarize(groups(kept)[0]!);
    assert.deepEqual(r2.signals.filter((s) => s.metric === "M10"), []);
    assert.deepEqual(r2.readers, { n: 0, noResult: 0, halted: 5, haltedBy: { limit: 5 } });
    // readers that read and gave nothing still signal
    const read = [0, 1, 2, 3, 4].map((i) => unit(`t${i}`, 5 - i, {}, { key: "claude opus", outcome: i < 2 ? "timeout" : "ok", ...(i < 2 ? { noResult: true as const } : {}) }));
    assert.equal(summarize(groups([...read, ...kept])[0]!).signals.filter((s) => s.metric === "M10").length, 1);
  } finally {
    done();
  }
});

// G3: "fetched, never read" (M11) only where it is true — the views' record lives in .strom, which a copy of the tree,
// an unpacked one or a tree of an older strom does not have; what the research itself shows read is read
function fetchedTree(o: { views?: Record<string, unknown>[]; cited?: number[]; reported?: number[]; web?: Record<string, unknown>[] }) {
  const now = Date.parse("2026-10-10T12:00:00Z");
  const iso2 = (t: number) => new Date(t).toISOString();
  const session = (id: string, daysAgo: number) => ({ id, type: "session", state: "closed", started: iso2(now - daysAgo * DAY), ended: iso2(now - daysAgo * DAY + 3600_000), created: iso2(now - daysAgo * DAY), agent: "claude", model: "opus" });
  const images = [17, 18, 19, 20].map((n) => ({ id: `M00${n}`, type: "media", recordset: "B0002", image: n, width: 3000, height: 2000, created: iso2(now - 14 * DAY), fetched: { connector: "zkusebni", book: "1" } }));
  const sources = (o.cited ?? []).map((n, i) => ({ id: `S000${i + 1}`, type: "source", kind: "baptism", title: "Křest Dvořák", recordset: "B0002", created: iso2(now - 13 * DAY), ...(i % 2 ? { clips: [{ media: `M00${n}`, region: { x: 0, y: 0, w: 1, h: 0.5 } }] } : { media: [`M00${n}`] }) }));
  const { tree, root, done } = fakeTree({ session: [session("N0001", 14), session("N0002", 12), session("N0003", 10), session("N0009", 30)], media: images, source: sources });
  const put = (file: string, lines: unknown[]) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  };
  // three sessions fetched the same four images of a book from one archive
  put(
    path.join(root, ".strom", "metrics", "fetch.jsonl"),
    [
      // (an agent's own web tools: lines of their own, from before strom's first fetch too)
      ...(o.web ?? []),
      ...[["N0001", 14], ["N0002", 12], ["N0003", 10]].map(([s, d]) => ({ at: iso2(now - (d as number) * DAY + 600_000), session: s, connector: "zkusebni", cmd: "fetch", rs: "B0002", got: [17, 18, 19, 20], requests: 4, hosts: { "archiv.příklad.example": { requests: 4 } } })),
    ],
  );
  if (o.views) put(path.join(root, ".strom", "views", "views.jsonl"), o.views);
  if (o.reported?.length) {
    fs.mkdirSync(path.join(root, "notes", "readings"), { recursive: true });
    fs.writeFileSync(path.join(root, "notes", "readings", "2026-09-28-křty-dvořák.md"), ["# Reading B0002-test", "Question: křty Dvořáků", "", ...o.reported.map((n) => `## Image ${n} · M00${n}\nresult: nothing\n`)].join("\n"));
  }
  const units = computeUnits(tree, { guess: () => "claude opus", now });
  const report = summarize(groups(units, now).find((g) => g.key === "claude opus")!);
  return { units, report, done };
}
const sum = (units: Unit[], f: (u: Unit) => number | undefined) => units.reduce((n, u) => n + (f(u) ?? 0), 0);
const m11 = (r: ReturnType<typeof summarize>) => r.signals.filter((s) => s.metric === "M11").map((s) => s.scope);
const a7 = (r: ReturnType<typeof summarize>) => r.recommend.filter((x) => x.id === "A7").map((x) => x.scope);
// a view of another image a month ago: the record was kept since then
const olderView = { at: "2026-09-10T12:10:00.000Z", key: "M0099", by: "N0009", region: { x: 0, y: 0, w: 300, h: 200 }, scale: 1 };

test("G3: images fetched while no views were recorded (no record at all, a copy, an unpacked tree) are no sign of never read: no M11, no A7", () => {
  const { units, report, done } = fetchedTree({});
  try {
    assert.equal(sum(units, (u) => u.books.B0002?.fetched), 12);
    assert.equal(sum(units, (u) => u.books.B0002?.unread), 0);
    assert.equal(sum(units, (u) => u.books.B0002?.unjudged), 12);
    assert.equal(sum(units, (u) => u.hosts["archiv.příklad.example"]?.unread), 0);
    assert.deepEqual([m11(report), a7(report)], [[], []]);
    // the views recorded only from after these fetches: the same
    const later = fetchedTree({ views: [{ ...olderView, at: "2026-10-05T12:00:00.000Z", by: "agent" }] });
    try {
      assert.equal(sum(later.units, (u) => u.books.B0002?.unread), 0);
      assert.deepEqual([m11(later.report), a7(later.report)], [[], []]);
    } finally {
      later.done();
    }
  } finally {
    done();
  }
});

test("G3: images a source stands on, cuts its entry from or a reader's report read are read, though no view of them was recorded", () => {
  const { units, report, done } = fetchedTree({ views: [olderView], cited: [17, 18, 19], reported: [20] });
  try {
    assert.equal(sum(units, (u) => u.books.B0002?.fetched), 12);
    assert.equal(sum(units, (u) => u.books.B0002?.unread), 0);
    assert.deepEqual([m11(report), a7(report)], [[], []]);
  } finally {
    done();
  }
});

test("G3: fetched while the views were recorded, never viewed nor cited, in three sessions: M11 and A7 as before", () => {
  const { units, report, done } = fetchedTree({ views: [olderView], cited: [17] });
  try {
    assert.equal(sum(units, (u) => u.books.B0002?.unread), 9);
    assert.equal(sum(units, (u) => u.books.B0002?.unjudged), 0);
    assert.deepEqual(m11(report).sort(), ["book:B0002", "host:archiv.příklad.example"]);
    assert.deepEqual(a7(report).sort(), ["book:B0002", "host:archiv.příklad.example"]);
  } finally {
    done();
  }
});

// The pages and searches of an agent's own web tools (fetch.jsonl via web|search): counted apart per key and host,
// never an image, never an archive's request, never in M11 or A7 — whatever the host
const webAt = (session: string, daysAgo: number, host?: string, via: "web" | "search" = "web") => ({
  at: new Date(Date.parse("2026-10-10T12:00:00Z") - daysAgo * DAY + 900_000).toISOString(),
  via,
  ...(host ? { host } : {}),
  session,
  key: "claude opus",
  agent: "grok",
  from: "stream",
});
const webLines = [
  // before strom's first fetch of the archive (12 days before now: 2 days before the first)
  ...Array.from({ length: 3 }, () => webAt("N0009", 30, "obec.example")),
  ...Array.from({ length: 14 }, () => webAt("N0002", 12, "obec.example")),
  ...Array.from({ length: 2 }, () => webAt("N0003", 10, "obec.example")),
  // the archive's own host through the agent's web tools: still not a fetch of its connector
  ...Array.from({ length: 5 }, () => webAt("N0001", 14, "archiv.příklad.example")),
  ...Array.from({ length: 3 }, () => webAt("N0002", 12, undefined, "search")),
];

test("web: an agent's own web requests and searches counted apart per host and key; the fetches, M11 and A7 as before", () => {
  const plain = fetchedTree({ views: [olderView], cited: [17] });
  const withWeb = fetchedTree({ views: [olderView], cited: [17], web: webLines });
  try {
    for (const { units, report } of [plain, withWeb]) {
      assert.equal(sum(units, (u) => u.books.B0002?.fetched), 12);
      assert.equal(sum(units, (u) => u.books.B0002?.unread), 9);
      assert.equal(sum(units, (u) => u.hosts["archiv.příklad.example"]?.requests), 12);
      assert.equal(sum(units, (u) => u.hosts["archiv.příklad.example"]?.images), 12);
      assert.equal(sum(units, (u) => u.hosts["obec.example"]?.requests), 0);
      assert.deepEqual(m11(report).sort(), ["book:B0002", "host:archiv.příklad.example"]);
      assert.deepEqual(a7(report).sort(), ["book:B0002", "host:archiv.příklad.example"]);
      assert.deepEqual(report.hosts.map((h) => [h.host, h.requests, h.fetched, h.unread]), [["archiv.příklad.example", 12, 12, 9]]);
    }
    assert.deepEqual(plain.report.web, { requests: 0, searches: 0, hosts: [] });
    const w = withWeb.report.web;
    assert.deepEqual([w.requests, w.searches], [24, 3]);
    assert.deepEqual(
      w.hosts.map((h) => [h.host, h.requests, h.sessions, h.most, h.mostIn]),
      [
        ["obec.example", 19, 3, 14, "N0002"],
        ["archiv.příklad.example", 5, 1, 5, "N0001"],
      ],
    );
    assert.equal(withWeb.units.find((u) => u.id === "N0002")?.webSearches, 3);
    // the sites asked more than WEB_PER_HOST pages in one session lately (doctor): within its days only
    const now = Date.parse("2026-10-10T12:00:00Z");
    assert.deepEqual(manyWeb(withWeb.units, now), []);
    assert.deepEqual(manyWeb(withWeb.units, now - 8 * DAY).map((h) => [h.host, h.most]), [["obec.example", 14]]);
  } finally {
    plain.done();
    withWeb.done();
  }
});

test("web: lines of the agents' web tools make no image fetched before the views were recorded (G3 stays: no M11, no A7)", () => {
  const { units, report, done } = fetchedTree({ web: webLines });
  try {
    assert.equal(sum(units, (u) => u.books.B0002?.unread), 0);
    assert.equal(sum(units, (u) => u.books.B0002?.unjudged), 12);
    assert.deepEqual([m11(report), a7(report)], [[], []]);
    // a unit of web requests only is kept (it holds something), with nothing of a book or an archive
    const only = units.find((u) => u.id === "N0009")!;
    assert.deepEqual([only.books, only.hosts, only.web], [{}, {}, { "obec.example": 3 }]);
    assert.deepEqual(mergeUnit(undefined, only).web, { "obec.example": 3 });
  } finally {
    done();
  }
});

test("web: each request counted once, the tree's hook's and the stream's alike — none refused, a call once, a session's stream lines after its hook's first left out", () => {
  const hookAt = (session: string, host: string | undefined, toolUse: string, decision: "allow" | "ask" | "deny", agent = "grok", via: "web" | "search" = "web") => ({
    ...webAt(session, 12, host, via),
    agent,
    from: "hook",
    toolUse,
    decision,
  });
  const streamAt = (session: string, toolUse: string) => ({ ...webAt(session, 12, "obec.example"), toolUse });
  const web = [
    // N0004 (Grok): a page its stream told before the hook ran, then the hook and the stream both for c1–c3, and one the
    // stream told by another id (the ids not matching): the hook's three and the one before
    streamAt("N0004", "s0"),
    hookAt("N0004", "obec.example", "c1", "allow"),
    streamAt("N0004", "c1"),
    hookAt("N0004", "obec.example", "c2", "allow"),
    hookAt("N0004", "obec.example", "c3", "allow"),
    streamAt("N0004", "c2"),
    streamAt("N0004", "x3"),
    // N0005 (Grok, no hook ran): the stream's two
    streamAt("N0005", "a1"),
    streamAt("N0005", "a2"),
    // N0006 (Claude Code): allowed ones count, an asked one once it went out (the hook's line after it), refused and
    // asked-but-said-no never; a search; one call recorded twice once
    hookAt("N0006", "obec.example", "d1", "allow", "claude"),
    hookAt("N0006", "obec.example", "d1", "allow", "claude"),
    hookAt("N0006", "obec.example", "d2", "ask", "claude"),
    hookAt("N0006", "obec.example", "d4", "ask", "claude"),
    { ...hookAt("N0006", "obec.example", "d2", "allow", "claude"), why: "asked" },
    hookAt("N0006", "obec.example", "d3", "deny", "claude"),
    hookAt("N0006", undefined, "q1", "allow", "claude", "search"),
  ];
  const { units, report, done } = fetchedTree({ web });
  try {
    const by = (id: string) => units.find((u) => u.id === id)?.web?.["obec.example"];
    assert.deepEqual([by("N0004"), by("N0005"), by("N0006")], [4, 2, 2]);
    assert.equal(units.find((u) => u.id === "N0006")?.webSearches, 1);
    const host = report.web.hosts.find((h) => h.host === "obec.example")!;
    assert.deepEqual([host.requests, host.sessions, report.web.searches], [8, 3, 1]);
  } finally {
    done();
  }
});
