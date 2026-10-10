// What strom sets by itself in how scans are read (core/tune.ts): only towards accuracy or fewer requests to an archive
// — a book read worse shown bigger and in halves, smaller batches and fewer views a call for every agent (the texts of
// Claude Code's delegates and scan reader, the agents that read themselves, strom media view, strom read), whole images
// first at an archive whose limit was reached, no parts of a book whose portal has none sharper. Each change said with
// its reason (strom config, strom recent, strom media calibrate --report), logged in .strom/tune; a session goes by the
// values of its start; tune.auto off sets and uses nothing; an archive nothing at all.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { blank } from "../../src/image/image.ts";
import { emptyBook, type BookCounts, type Unit } from "../../src/core/readstats.ts";

const opts = { skip: !hasGit };
const DAY = 24 * 3600_000;
const KEY = "claude opus";
const HOST = "archiv.příklad.example";
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

function unit(id: string, daysAgo: number, books: Record<string, Partial<BookCounts>>, more: Partial<Unit> = {}): Unit {
  return { id, kind: "reader", at: ago(daysAgo), key: KEY, reported: "claude-opus-5-5", books: Object.fromEntries(Object.entries(books).map(([b, c]) => [b, { ...emptyBook(), ...c }])), hosts: {}, ...more };
}

/**
 * What strom measured of some weeks of reading, as its summary keeps it: B0003 read worse than the others (unsure and
 * enlarged), two parts of B0001 the portal gave no sharper, two of five readers without a result, an archive whose
 * limit was reached in two sessions.
 */
function measured(): Unit[] {
  const good = { scans: 16, views: 16, read: 16, unsure: 0 };
  const bad = { scans: 16, views: 16, enlarged: 16, read: 16, unsure: 12 };
  const host = (later: number) => ({ [HOST]: { requests: 10, images: 5, waitMs: 20 * 60_000, later, fetches: 1, fetched: 5, unread: 0, pending: 0 } });
  return [
    unit("read-1", 20, { B0001: { ...good, unsure: 1, noSharper: 1 }, B0002: good }, { outcome: "ok" }),
    unit("read-2", 17, { B0003: bad, B0002: good }, { outcome: "ok" }),
    unit("read-3", 14, { B0001: { ...good, noSharper: 1 } }, { outcome: "timeout", noResult: true }),
    unit("read-4", 11, { B0003: bad }, { outcome: "ok" }),
    unit("read-5", 8, { B0002: good }, { outcome: "timeout", noResult: true }),
    unit("N0901", 6, {}, { kind: "session", hosts: host(1) }),
    unit("N0902", 4, {}, { kind: "session", hosts: host(0) }),
  ];
}

function plant(root: string, units: Unit[]): void {
  const dir = path.join(root, ".strom", "metrics");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "rollup.json"), JSON.stringify({ version: 1, updated: new Date().toISOString(), backfilled: new Date().toISOString(), units }) + "\n");
}

/** A research with three books of scans (Czech, German, Cyrillic titles), eight double pages each — the second one big. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  for (const [i, title] of ["Křty Týnec 1784–1820", "Taufbuch Lidice 1820–1850", "Метрическая книга Луга 1850–1870"].entries()) {
    await w.ok(["recordset", "add", title, "--kinds", "baptism"]);
    const dir = path.join(w.dir, `knihy ${i + 1} ž`);
    fs.mkdirSync(dir);
    for (let n = 1; n <= 8; n++) fs.writeFileSync(path.join(dir, `s${String(n).padStart(4, "0")}.jpg`), encodeImage(n === 2 ? blank(2400, 1600, 1, 40 + i) : blank(600, 400, 1, 40 + i * 20 + n), "jpeg"));
    await w.ok(["media", "add", dir, "--recordset", `B000${i + 1}`]);
  }
  return w;
}

const config = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));

test("strom sets by itself only what adds accuracy or saves requests: each said with its reason, logged, in strom config and strom recent — and it reaches every agent", opts, async () => {
  const w = await world();
  const root = w.cwd;
  // a session at work before anything is set: it goes on by the values of its start
  await w.ok(["task", "add", "Křest Václava Dvořáka", "--level", "link", "--where", "B3", "--why", "a", "--done-when", "b"]);
  await w.ok(["session", "start", "T1"]);
  plant(root, measured());

  const j = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
  assert.deepEqual(new Set(j.tuned.map((x: { action: string }) => x.action)), new Set(["A1", "A2", "A4", "A5"]));
  assert.deepEqual(j.recommend, [], "what only a person decides: none here; what asks an archive for more: never");
  const t = config(w).tuning[KEY];
  assert.deepEqual([t.batch.value, t.batch.default, t.viewsPerCall.value, t.viewsPerCall.default, t.reported], [3, 6, 12, 24, "claude-opus-5-5"]);
  assert.match(t.batch.why, /readers without a result 2 of the last 5 → about 3 scans a batch instead of 6, at most 12 views a call instead of 24/);
  assert.equal(t.batch.source, "tuned");
  assert.ok(t.batch.id === t.viewsPerCall.id && /^T[0-9a-f]{6}$/.test(t.batch.id), "one change, one id");
  const state = readJsonFile(path.join(root, ".strom", "tune", "state.json"))[KEY];
  assert.deepEqual([state.books.B0003.find.from, state.books.B0003.find.value, state.books.B0003.halves.value, state.books.B0003.read], [1400, 2000, true, undefined], "read was as big as the model takes already");
  assert.match(state.books.B0003.find.why, /^B0003: unsure readings 75 % of 32 against \d+ % of the other books; enlarged views 100 % of 32 against 0 % → the whole image at reading size \(2000 px\), a double page in halves$/);
  assert.equal(state.books.B0001.noSharper.value, true);
  assert.equal(state.hosts[HOST].order.value, "whole-first");
  const log = fs.readFileSync(path.join(root, ".strom", "tune", "log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(new Set(log.map((e: { action: string }) => e.action)), new Set(["A1", "A2", "A4", "A5"]));
  assert.ok(log.every((e: { by: string; why: string; key: string }) => e.by === "selftune" && e.why && e.key === KEY));
  assert.deepEqual(log.find((e: { action: string }) => e.action === "A2").to, { batch: 3, viewsPerCall: 12 });
  // nothing in the research's data, no commit
  assert.equal((await w.ok(["status", "--json"])).code, 0);

  // decided again on the same figures: nothing new
  await w.ok(["media", "calibrate", "--report"]);
  assert.equal(fs.readFileSync(path.join(root, ".strom", "tune", "log.jsonl"), "utf8").trim().split("\n").length, log.length);

  // the session at work: still the numbers of its start — 7 double pages in halves (14 views) in one call
  const during = await w.run(["media", "view", "B0003:1-7", "--half", "both"]);
  assert.equal(during.code, 0, during.err);
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);
  // from now on: at most 12 views a call, and why
  const after = await w.run(["media", "view", "B0002:1-7", "--half", "both"]);
  assert.notEqual(after.code, 0);
  assert.match(after.err, /at most 12 images and 12 views in one call: every view stays in the context that opens it \(fewer than 24: strom tuned it for this agent and model — strom config get reading\.batch\)/);
  // the book read worse: its whole image at reading size, recorded as tuned
  const big = await w.ok(["media", "view", "B0003:2", "--json"]);
  assert.equal(Math.max(big.json.width, big.json.height), 2000);
  const views = fs.readFileSync(path.join(root, ".strom", "views", "views.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(views.at(-1).capFrom, `tuned:${state.books.B0003.find.id}`);
  const other = await w.ok(["media", "view", "B0001:2", "--json"]);
  assert.equal(Math.max(other.json.width, other.json.height), 1400, "another book: the default");
  // a double page of that book always in halves, even where its halves are no sharper than one view
  const both = await w.ok(["media", "view", "B0003:4", "--half", "both", "--json"]);
  assert.equal(both.json.views.length, 2);
  const one = await w.ok(["media", "view", "B0001:4", "--half", "both", "--json"]);
  assert.equal(one.json.views.length, 1, "another book: one view, its halves no sharper");

  // strom config: the value and where it comes from
  const batch = (await w.ok(["config", "get", "reading.batch", "--json"])).json;
  assert.equal(batch.value, "3 scans a batch · 12 views a call · 5 views a reader of strom read");
  assert.match(batch.source, /^tuned \(\d{4}-\d\d-\d\d: readers without a result 2 of the last 5 → /);
  assert.deepEqual((await w.ok(["config", "get", "reading.views", "--json"])).json, { key: "reading.views", value: "30 views before a reader stops", source: "default" });
  const size = (await w.ok(["config", "get", "views.size", "--recordset", "B3", "--json"])).json;
  assert.equal(size.value, "find 2000 · read 2000 px · a double page in halves");
  assert.match(size.source, /^tuned \(\d{4}-\d\d-\d\d: B0003: unsure readings/);
  assert.equal((await w.ok(["config", "get", "views.size", "--recordset", "B0002", "--json"])).json.source, "default");
  const where = (await w.ok(["config", "where", "--json"])).json.settings;
  assert.deepEqual(where.find((s: { key: string }) => s.key === "tune.auto").value, "on");

  // the agents: Claude Code's delegates and scan reader, and the agents that read themselves
  await w.ok(["agents", "sync"]);
  const claude = fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8");
  assert.match(claude, /About three scans \(images B…:n\) per delegate, four views each/);
  assert.match(claude, /strom media view B0001:57-59 --half both/);
  const reader = fs.readFileSync(path.join(root, ".claude", "agents", "strom-scan-reader.md"), "utf8");
  assert.match(reader, /at most 12 images and\n12 views a call: 12 whole images, or 3 with 4 views each/);
  assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), /in batches of about three: open a batch/);
  assert.match(JSON.stringify(readJsonFile(path.join(root, "opencode.json"))), /After about 30 views, stop and report/);

  // a new session's brief: the numbers of now, and what is set for its books
  await w.ok(["task", "add", "Křest Marie", "--level", "link", "--where", "B3", "--where", "B1", "--why", "a", "--done-when", "b"]);
  const brief = (await w.ok(["session", "start", "T2"])).out;
  assert.match(brief, /## Reading scans in this session \(strom tuned it from how the reading went: these numbers hold over the method's\)\n- about three scans a batch — a delegate's or your own; at most 12 views a call of strom media view/);
  assert.match(brief, /B0003 Метрическая книга Луга[\s\S]*read worse than the other books \(strom tuned it\): its views are as big as your model takes them \(2000 px\)/);
  assert.match(brief, /B0001 Křty Týnec[\s\S]*its portal has no part sharper than the whole image: ask no part of it/);
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);

  // strom recent: a line of the settings, in the research's language
  const recent = (await w.ok(["recent"])).out;
  assert.match(recent, /^Čtení snímků, nastavil strom sám:$/m, recent);
  assert.match(recent, /– menší dávky: skeny na čtenáře asi 3 místo 6/, recent);
  assert.match(recent, /– B0003: celý snímek ve velikosti čtení/, recent);

  // taken back by a person: the default again, not set again by the next look at the same figures
  await w.ok(["config", "unset", "reading.batch"]);
  assert.equal(config(w).tuning?.[KEY]?.batch, undefined);
  await w.ok(["media", "calibrate", "--report"]);
  assert.equal(config(w).tuning?.[KEY]?.batch, undefined, "held back after a person took it back");
  const reset = fs.readFileSync(path.join(root, ".strom", "tune", "log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((e: { by: string }) => e.by === "reset");
  assert.equal(reset.length, 1);
  assert.equal((await w.run(["config", "set", "reading.batch", "2"])).code === 0, false, "set by strom alone, never typed");
  w.cleanup();
});

test("tune.auto off: strom sets nothing by itself and what it set is not used; on again, it is", opts, async () => {
  const w = await world();
  plant(w.cwd, measured());
  await w.ok(["config", "set", "tune.auto", "off"]);
  const off = await w.ok(["media", "calibrate", "--report", "--json"]);
  assert.deepEqual(off.json.tuned, []);
  assert.deepEqual(new Set(off.json.recommend.map((x: { id: string }) => x.id)), new Set(["A1", "A2", "A4", "A5"]), "only suggested");
  assert.equal(config(w).tuning, undefined);
  assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "tune", "state.json")), false);
  assert.match((await w.ok(["media", "calibrate", "--report"])).out, /^strom tu sám nic nenastavuje: tune\.auto je vypnuté\.$/m);
  await w.ok(["config", "set", "tune.auto", "on"]);
  await w.ok(["media", "calibrate", "--report"]);
  assert.equal(config(w).tuning[KEY].batch.value, 3);
  // set, then off: not used
  await w.ok(["config", "set", "tune.auto", "off"]);
  assert.equal((await w.ok(["config", "get", "reading.batch", "--json"])).json.source, "default");
  assert.equal((await w.run(["media", "view", "B0002:1-7", "--half", "both"])).code, 0, "24 views a call again");
  w.cleanup();
});

test("an archive: nothing tuned and nothing of it said, a log left from before too", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  plant(w.cwd, measured());
  fs.mkdirSync(path.join(w.cwd, ".strom", "tune"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, ".strom", "tune", "log.jsonl"), JSON.stringify({ at: new Date().toISOString(), id: "T000000", action: "A2", key: KEY, scope: "key", what: "reading.batch", from: 6, to: 3, why: "x", by: "selftune" }) + "\n");
  await w.ok(["doctor"]);
  assert.equal(config(w).tuning, undefined);
  assert.equal(fs.existsSync(path.join(w.cwd, ".strom", "tune", "state.json")), false);
  const recent = await w.ok(["recent"]);
  assert.doesNotMatch(recent.out, /Čtení snímků|strom sám/, recent.out);
  w.cleanup();
});

test("A3: a key with nothing measured lists what is in force for it all the same: what strom set (its id, where it is kept) and the person's calibration", opts, async () => {
  const w = await world();
  const at = new Date(Date.now() - 2 * DAY).toISOString();
  const tuned = <T,>(id: string, action: string, what: string, scope: string, value: T, def: T) => ({ id, action, what, scope, value, default: def, from: def, at, why: `${what} for a test`, basis: {}, rev: 1, seen: at, source: "tuned" });
  // nothing measured here (no summary), yet values kept for the key: in the user config and in this research
  const cfg = config(w);
  cfg.tuning = { [KEY]: { batch: tuned("Taaaaa1", "A2", "reading.batch", "key", 3, 6), viewsPerCall: tuned("Taaaaa1", "A2", "reading.batch", "key", 12, 24) } };
  cfg.viewSizes = { [KEY]: { find: 1400, read: 2000, at: "2026-10-01", sample: 6, sizes: [1400, 1568, 2000], clear: { find: true, read: true } } };
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify(cfg));
  fs.mkdirSync(path.join(w.cwd, ".strom", "tune"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, ".strom", "tune", "state.json"), JSON.stringify({ [KEY]: { books: {}, hosts: { [HOST]: { fetch: tuned("Tbbbbb2", "A7", "fetch.only-needed", `host:${HOST}`, "only-needed", "as-asked") } } } }));
  const j = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
  assert.equal(j.measured, false);
  assert.deepEqual(
    j.tuned.map((x: { id: string; action: string; scope: string; source: string; where: string }) => [x.id, x.action, x.scope, x.source, x.where]),
    [
      ["Taaaaa1", "A2", "key", "tuned", "config"],
      ["Taaaaa1", "A2", "key", "tuned", "config"],
      ["Tbbbbb2", "A7", `host:${HOST}`, "tuned", "research"],
    ],
  );
  assert.deepEqual(j.calibration, { find: 1400, read: 2000, at: "2026-10-01", sample: 6, source: "calibrated" });
  const text = (await w.ok(["media", "calibrate", "--report"])).out;
  assert.match(text, /zatím nic naměřeno/, text);
  assert.match(text, /^Nastavil strom sám — jen k přesnosti nebo k menší zátěži archivu/m, text);
  assert.match(text, /^ {2}menší dávky: skeny na čtenáře asi 3 místo 6/m, text);
  assert.ok(text.includes(`  ${HOST}: `), text);
  assert.match(text, /^Velikosti zkalibrované na 6 známých záznamech \(2026-10-01\): hledání 1400 px, čtení 2000 px$/m, text);
  assert.match(text, /^Zpět na výchozí .*strom media calibrate --reset$/m, text);
  // tune.auto off: what strom set is not in force, said so; the person's calibration still is
  await w.ok(["config", "set", "tune.auto", "off"]);
  const off = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
  assert.deepEqual([off.tuned, off.calibration.find], [[], 1400]);
  assert.match((await w.ok(["media", "calibrate", "--report"])).out, /^strom tu sám nic nenastavuje: tune\.auto je vypnuté\.$/m);
  w.cleanup();
});
