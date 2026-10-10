// Back to the defaults of the reading of scans (strom media calibrate --reset, core/tunereset.ts): listed first — what,
// scope, now → default, source, date, why — and returned only on a person's yes (Enter says no; nobody to ask: exit 4;
// --dry-run and --json only list); --only, --recordset, --host narrow it, --all takes every model and names the other
// researches with their command; tasks an answer added stay, the measurements stay; logged, and the same change held back
// until the data change. strom doctor says when the reading got worse after a change of strom's — a reset recommended
// only where the readings got less sure — and an archive says nothing of it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { emptyBook, TUNING, type BookCounts, type Unit } from "../../src/core/readstats.ts";
import { heldBack, RESET_HOLD } from "../../src/core/tune.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const DAY = 24 * 3600_000;
const KEY = "claude opus";
const HOST = "archiv.příklad.example";
const REPORTED = "claude-opus-5-5";
/** The key of the model the alias ran on (core/modelkey.ts): what was kept under the alias is listed and returned by it. */
const TUNED = "claude claude-opus-5-5";
const iso = (t: number) => new Date(t).toISOString();

function unit(id: string, at: number, books: Record<string, Partial<BookCounts>>, more: Partial<Unit> = {}): Unit {
  return { id, kind: "reader", at: iso(at), key: KEY, reported: REPORTED, books: Object.fromEntries(Object.entries(books).map(([b, c]) => [b, { ...emptyBook(), ...c }])), hosts: {}, ...more };
}

function plant(root: string, units: Unit[]): void {
  const dir = path.join(root, ".strom", "metrics");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "rollup.json"), JSON.stringify({ version: 1, updated: iso(Date.now()), backfilled: iso(Date.now()), units }) + "\n");
}

const cfgFile = (w: World) => path.join(w.env.STROM_CONFIG_DIR!, "config.json");
const config = (w: World) => readJsonFile(cfgFile(w));
const writeConfig = (w: World, c: unknown) => fs.writeFileSync(cfgFile(w), JSON.stringify(c, null, 2));
const tuneFile = (root: string, f: string) => path.join(root, ".strom", "tune", f);
const resets = (root: string) =>
  fs.existsSync(tuneFile(root, "log.jsonl"))
    ? fs.readFileSync(tuneFile(root, "log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((e: { by: string }) => e.by === "reset")
    : [];

function tuned(id: string, action: string, what: string, scope: string, value: unknown, def: unknown, at: string, why: string, basis: Record<string, number> = {}) {
  return { id, action, what, scope, value, default: def, from: def, at, why, basis, rev: 1, seen: at, reported: REPORTED, source: "tuned" };
}

/** What a research and its computer keep for the reading of scans: a calibration, changes of strom's, answers. */
function planted(w: World, root: string): void {
  const at = iso(Date.now() - 3 * DAY);
  const c = config(w);
  c.viewSizes = { [KEY]: { find: 1000, read: 1400, at: at.slice(0, 10), sample: 6, sizes: [1000, 1400, 2000], clear: { find: true, read: true } } };
  c.tuning = {
    [KEY]: {
      reported: REPORTED,
      batch: tuned("Taaaaa1", "A2", "reading.batch", "key", 3, 6, at, "readers without a result 2 of the last 5", { M10: 0.4, "M10.n": 2, "M10.of": 5 }),
      viewsPerCall: tuned("Taaaaa1", "A2", "reading.batch", "key", 12, 24, at, "readers without a result 2 of the last 5", { M10: 0.4, "M10.n": 2, "M10.of": 5 }),
    },
    "claude sonnet": { reported: "claude-sonnet-5", batch: tuned("Tbbbbb1", "A2", "reading.batch", "key", 4, 6, at, "readers without a result") },
  };
  c.tuneAnswers = { [KEY]: { "views.smaller": { choice: "later", at, fingerprint: "sha1:x", by: "terminal", strom: "1" } } };
  writeConfig(w, c);
  fs.mkdirSync(path.join(root, ".strom", "tune"), { recursive: true });
  fs.writeFileSync(
    tuneFile(root, "state.json"),
    JSON.stringify({
      [KEY]: {
        reported: REPORTED,
        books: {
          B0003: {
            find: tuned("Tccccc1", "A1", "views.size", "book:B0003", 2000, 1400, at, "B0003: unsure readings 75 % of 24 against 5 % of the other books", { M5: 0.75, "M5.n": 24, "M5.base": 0.05 }),
            halves: tuned("Tccccc1", "A1", "views.size", "book:B0003", true, false, at, "B0003: unsure readings 75 % of 24 against 5 % of the other books", { M5: 0.75, "M5.n": 24, "M5.base": 0.05 }),
          },
          B0001: { noSharper: tuned("Tddddd1", "A5", "parts.none", "book:B0001", true, false, at, "B0001: 2 parts the portal gave no sharper") },
        },
        hosts: { [HOST]: { order: tuned("Teeeee1", "A4", "fetch.order", `host:${HOST}`, "whole-first", "as-asked", at, "waited for its limit in 2 of 2 sessions", { M8: 2, "M8.n": 2, "M8.wait": 12, "M8.later": 1 }) } },
      },
    }),
  );
  fs.writeFileSync(
    tuneFile(root, "answers.json"),
    JSON.stringify({ [KEY]: { "negatives.weak:B0003": { choice: "edge", at, fingerprint: "sha1:y", by: "window", strom: "1" }, "index.first": { choice: "30", at, fingerprint: "sha1:z", by: "terminal", strom: "1" } } }),
  );
}

test("listed first, returned only on a person's yes; --only, --recordset, --host narrow it; tasks and measurements stay; logged", opts, async () => {
  const w = new World();
  const root = await w.withTree();
  // a task an answer added (to search weak scans again): the research's, it stays
  await w.ok(["task", "add", "Znovu prohledat B0003", "--level", "link", "--where", "matrika Týnec 1850–1870", "--why", "a", "--done-when", "b"]);
  const tree = Tree.open(root, w.env);
  const file = tree.recordPath("task", "T0001");
  fs.writeFileSync(file, JSON.stringify({ ...(JSON.parse(fs.readFileSync(file, "utf8")) as Task), origin: "tune:negatives" }, null, 2) + "\n");
  planted(w, root);
  plant(root, [unit("r-1", Date.now() - 2 * DAY, { B0003: { scans: 20, views: 20, read: 20 } }, { outcome: "ok" })]);
  const before = { cfg: fs.readFileSync(cfgFile(w), "utf8"), state: fs.readFileSync(tuneFile(root, "state.json"), "utf8"), answers: fs.readFileSync(tuneFile(root, "answers.json"), "utf8") };
  const unchanged = () => {
    assert.equal(fs.readFileSync(cfgFile(w), "utf8"), before.cfg);
    assert.equal(fs.readFileSync(tuneFile(root, "state.json"), "utf8"), before.state);
    assert.equal(fs.readFileSync(tuneFile(root, "answers.json"), "utf8"), before.answers);
  };

  // --dry-run: the table, nothing returned, no question
  const dry = await w.ok(["media", "calibrate", "--reset", "--dry-run"]);
  assert.match(dry.out, /^Nastaveno pro čtení snímků · Claude Code · claude-opus-5-5:$/m);
  assert.match(dry.out, /co +rozsah +teď → výchozí +zdroj +datum +proč/);
  assert.match(dry.out, /kalibrované velikosti +model +find 1000 · read 1400 → find 1400 · read 2000 +kalibrace/);
  assert.match(dry.out, /menší dávky +model +batch 3 · viewsPerCall 12 → batch 6 · viewsPerCall 24 +nastavil strom +\d{4}-\d\d-\d\d +čtenáři bez výsledku: 2 z posledních 5$/m);
  // every reason in the research language: a calibration, a change of strom's by its figures, an answer by its place
  assert.match(dry.out, /kalibrace +\d{4}-\d\d-\d\d +změřeno na 6 známých záznamech$/m);
  assert.match(dry.out, /větší pohledy +B0003 +find 2000 · halves → find 1400 +nastavil strom +\d{4}-\d\d-\d\d +nejisté 75 % proti 5 % u ostatních knih \(n=24\)$/m);
  assert.match(dry.out, /žádné výřezy +B0001 +noSharper → – +nastavil strom +\d{4}-\d\d-\d\d +z naměřených čtení$/m, "one kept before its figures were");
  assert.match(dry.out, /napřed celé snímky +archiv\.příklad\.example +.* +sezení s čekáním na limit archivu: 2 z 2 \(12 min, vyčerpán 1×\)$/m);
  assert.match(dry.out, /odpověď na negatives\.weak +B0003 +edge → – +odpověď +\d{4}-\d\d-\d\d +zodpovězeno v okně systému$/m);
  assert.match(dry.out, /odpověď na index\.first +tento výzkum +30 → – +odpověď +\d{4}-\d\d-\d\d +zodpovězeno v terminálu$/m);
  assert.doesNotMatch(dry.out, /measured on|readers without|unsure readings|waited for|answered \(/u, "no English reason in a Czech research");
  assert.match(dry.out, /Úkoly T0001 zůstávají: patří k výzkumu\./);
  assert.match(dry.out, /Jen výpis, nic se nevrátilo\. Vrací se se souhlasem člověka: strom media calibrate --reset\n?$/);
  assert.doesNotMatch(dry.out, /sonnet/, "another model only with --all");
  unchanged();
  // --json: the same list, nothing returned either
  const j = (await w.ok(["media", "calibrate", "--reset", "--json"])).json;
  assert.deepEqual([j.reset, j.dryRun, j.tasks], [false, true, ["T0001"]]);
  assert.deepEqual(j.items.map((i: { id: string }) => i.id), ["calibration", "Taaaaa1", "answer:views.smaller", "answer:index.first", "Tddddd1", "Tccccc1", "answer:negatives.weak:B0003", "Teeeee1"]);
  assert.deepEqual(j.items.find((i: { id: string }) => i.id === "Tccccc1"), {
    id: "Tccccc1", part: "sizes", what: "views.size", action: "A1", key: TUNED, scope: "book:B0003", where: "research", now: { find: 2000, halves: true }, default: { find: 1400, halves: false }, source: "tuned", at: j.items.find((i: { id: string }) => i.id === "Tccccc1").at, why: "B0003: unsure readings 75 % of 24 against 5 % of the other books", reported: REPORTED,
  });
  unchanged();

  // nobody to ask (no terminal, no window): needs input, nothing returned
  const none = await w.run(["media", "calibrate", "--reset"]);
  assert.equal(none.code, 4, none.out + none.err);
  assert.match(none.out + none.err, /strom media calibrate --reset/);
  unchanged();
  // the person's terminal, Enter: no
  const enter = await w.run(["media", "calibrate", "--reset", "--only", "fetch"], { tty: true, answers: [""] });
  assert.equal(enter.code, 0, enter.err);
  assert.match(enter.out, /Vrátit výchozí nastavení čtení snímků\? Vrátí se: žádné výřezy \(B0001\), napřed celé snímky \(archiv\.příklad\.example\) \(a\/n\) \[n\]/);
  assert.match(enter.out, /Nic se nevrátilo; nastavení zůstává, jak bylo\./);
  unchanged();

  // --recordset (written short) and --only: that book's part alone
  const rs = (await w.ok(["media", "calibrate", "--reset", "--only", "fetch", "--recordset", "b1", "--dry-run", "--json"])).json;
  assert.deepEqual(rs.items.map((i: { id: string }) => i.id), ["Tddddd1"]);
  assert.equal(rs.command, "strom media calibrate --reset --only fetch --recordset B0001");
  // --host, written decomposed and with its scheme: that archive alone
  const host = (await w.ok(["media", "calibrate", "--reset", "--host", `https://${HOST.normalize("NFD").toUpperCase()}/`, "--json"])).json;
  assert.deepEqual(host.items.map((i: { id: string }) => i.id), ["Teeeee1"]);
  assert.equal((await w.run(["media", "calibrate", "--reset", "--only", "everything"])).code, 2);
  assert.notEqual((await w.run(["media", "calibrate", "--only", "sizes"])).code, 0, "--only goes with --reset");

  // yes: sizes and batches of this model returned — the calibration, the smaller batches, the book's bigger views
  const yes = await w.ok(["media", "calibrate", "--reset", "--only", "sizes,batches"], { tty: true, answers: ["a"] });
  assert.match(yes.out, /Vráceno na výchozí: 3\. strom nic z toho sám znovu nenastaví 30 dní nebo do nových čtení; měření zůstávají\./);
  const c = config(w);
  assert.equal(c.viewSizes, undefined);
  assert.deepEqual(Object.keys(c.tuning), ["claude sonnet"], "another model's stays");
  assert.ok(c.tuneAnswers[KEY]["views.smaller"], "answers only with answers");
  const state = readJsonFile(tuneFile(root, "state.json"))[TUNED];
  assert.deepEqual([Object.keys(state.books), Object.keys(state.hosts)], [["B0001"], [HOST]]);
  const log = resets(root);
  assert.equal(log.length, 1);
  assert.equal(log[0].key, TUNED);
  assert.deepEqual(log[0].items.map((i: { id: string; source: string; from: unknown; to: unknown }) => [i.id, i.source, i.from, i.to]), [
    ["calibration", "calibrated", { find: 1000, read: 1400 }, { find: 1400, read: 2000 }],
    ["Taaaaa1", "tuned", { batch: 3, viewsPerCall: 12 }, { batch: 6, viewsPerCall: 24 }],
    ["Tccccc1", "tuned", { find: 2000, halves: true }, { find: 1400, halves: false }],
  ]);
  assert.equal(log[0].items[2].scans, 20, "the book's scans at the reset: the hold is let go once enough come since");

  // the answers: returned; the task it added stays, the measurements stay, nothing of the research changed
  await w.ok(["media", "calibrate", "--reset", "--only", "answers"], { tty: true, answers: ["a"] });
  assert.equal(config(w).tuneAnswers, undefined);
  assert.deepEqual(readJsonFile(tuneFile(root, "answers.json")), {});
  assert.ok(Tree.open(root, w.env).get<Task>("T0001"));
  assert.ok(fs.existsSync(path.join(root, ".strom", "metrics", "rollup.json")));
  assert.equal(spawnSync("git", ["status", "--porcelain", "--", "data"], { cwd: root, encoding: "utf8" }).stdout.split("\n").filter((l) => l && !l.includes("T0001")).join("\n"), "");
  assert.match((await w.ok(["media", "calibrate", "--reset", "--only", "answers"])).out, /Pro čtení snímků není nic nastaveno, co by se vracelo \(Claude Code · claude-opus-5-5\): platí výchozí hodnoty\./);
  w.cleanup();
});

test("--all: every model of the user config and this research; other researches only named, with their command", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Dvořákovi"]);
  const other = w.treeDir("Dvořákovi");
  await w.ok(["init", "Novákovi"]);
  const root = w.treeDir("Novákovi");
  w.cwd = root;
  planted(w, root);
  const at = iso(Date.now() - DAY);
  fs.mkdirSync(path.join(other, ".strom", "tune"), { recursive: true });
  const otherState = JSON.stringify({ [KEY]: { books: { B0002: { noSharper: tuned("Tfffff1", "A5", "parts.none", "book:B0002", true, false, at, "x") } }, hosts: {} } });
  fs.writeFileSync(tuneFile(other, "state.json"), otherState);
  const dry = await w.ok(["media", "calibrate", "--reset", "--all", "--dry-run"]);
  assert.match(dry.out, /^Nastaveno pro čtení snímků · Claude Code · claude-sonnet-5:$/m);
  assert.match(dry.out, /Jiné výzkumy na tomto počítači si drží vlastní hodnoty knih a archivů: Dvořákovi \(1\)\. Vrací se v každém zvlášť: strom media calibrate --reset --all --tree Dvořákovi/);
  const j = (await w.ok(["media", "calibrate", "--reset", "--all", "--json"])).json;
  assert.deepEqual(j.others.map((o: { name: string; items: number }) => [o.name, o.items]), [["Dvořákovi", 1]]);
  assert.ok(j.items.some((i: { key: string }) => i.key === "claude claude-sonnet-5"));
  await w.ok(["media", "calibrate", "--reset", "--all"], { tty: true, answers: ["a"] });
  const c = config(w);
  assert.deepEqual([c.viewSizes, c.tuning, c.tuneAnswers], [undefined, undefined, undefined]);
  assert.deepEqual(readJsonFile(tuneFile(root, "state.json")), {});
  assert.equal(fs.readFileSync(tuneFile(other, "state.json"), "utf8"), otherState, "another research untouched");
  assert.equal(resets(root)[0].key, undefined, "every key");
  w.cleanup();
});

test("an agent asks: a window; what was returned is held back until the data change", opts, async () => {
  const w = new World();
  const root = await w.withTree();
  // five readers, two of them without a result: smaller batches set by strom itself
  const now = Date.now();
  const readers = [0, 1, 2, 3, 4].map((i) => unit(`r-${i}`, now - (10 - i) * DAY, { B0001: { scans: 12, views: 12, read: 12 } }, { outcome: i < 2 ? "timeout" : "ok", ...(i < 2 ? { noResult: true as const } : {}) }));
  plant(root, readers);
  await w.ok(["media", "calibrate", "--report"]);
  assert.equal(config(w).tuning[TUNED].batch.value, 3);
  // an agent asks: no in the window — nothing; yes — returned
  const no = await w.run(["media", "calibrate", "--reset"], { dialog: false, env: { CLAUDECODE: "1" } });
  assert.notEqual(no.code, 0);
  assert.equal(config(w).tuning[TUNED].batch.value, 3);
  const yes = await w.run(["media", "calibrate", "--reset", "--only", "batches"], { dialog: true, env: { CLAUDECODE: "1" } });
  assert.equal(yes.code, 0, yes.out + yes.err);
  assert.match(yes.out, /menší dávky +model +batch 3 · viewsPerCall 12 → batch 6 · viewsPerCall 24/, "the window's answer, the table in the output");
  assert.equal(config(w).tuning, undefined);
  assert.equal(resets(root)[0].items[0].scans, 60);
  // the same figures looked at again: not set again
  await w.ok(["media", "calibrate", "--report"]);
  assert.equal(config(w).tuning, undefined, "held back");
  // a few readings more (fewer than half of those at the reset): still held
  const after = (n: number, scans: number, from: number) => [...Array(n).keys()].map((i) => unit(`a-${from + i}`, Date.now() + (from + i + 1) * 1000, { B0001: { scans, views: scans, read: scans } }, { outcome: "timeout", noResult: true }));
  plant(root, [...readers, ...after(2, 10, 0)]);
  await w.ok(["media", "calibrate", "--report"]);
  assert.equal(config(w).tuning, undefined, "20 scans since, 60 at the reset: held");
  // the data changed (half again as many scans): its signal still there — set again
  plant(root, [...readers, ...after(4, 10, 0)]);
  await w.ok(["media", "calibrate", "--report"]);
  assert.equal(config(w).tuning?.[TUNED]?.batch?.value, 3, "40 scans since: free again");
  w.cleanup();
});

test("the hold of a reset: its days, the data changed since, another model said; an older reset by its days alone", () => {
  const now = Date.parse("2026-11-02T10:00:00Z");
  const t = { id: "Tabc123", key: KEY, scope: "book:B0003", reported: REPORTED };
  const entry = (daysAgo: number, item: object) => ({ at: iso(now - daysAgo * DAY), by: "reset", items: [{ id: "Tabc123", key: KEY, scope: "book:B0003", what: "views.size", part: "sizes", source: "tuned", from: 2000, to: 1400, reported: REPORTED, ...item }] });
  const since = (scans: number, daysAgo = 1) => [unit("x", now - daysAgo * DAY, { B0003: { scans } })];
  assert.ok(heldBack([entry(5, { scans: 40 })], t, [], now));
  assert.ok(!heldBack([entry(TUNING.heldDays + 1, { scans: 40 })], t, [], now), "its days gone");
  assert.ok(heldBack([entry(5, { scans: 40 })], t, since(19), now), "fewer than half again");
  assert.ok(!heldBack([entry(5, { scans: 40 })], t, since(20), now), "half again: the data changed");
  assert.ok(heldBack([entry(5, { scans: 4 })], t, since(9), now), "and at least RESET_HOLD.growUnits");
  assert.ok(heldBack([entry(5, { scans: 40 })], t, since(30, 6), now), "readings before the reset count not");
  assert.ok(!heldBack([entry(5, { scans: 40 })], { ...t, reported: "claude-opus-5-6" }, [], now), "another model under the alias");
  assert.ok(!heldBack([entry(5, { scans: 40, id: "Tother1" })], t, [], now), "another change");
  // what strom config unset wrote before: the change itself, no count
  assert.ok(heldBack([{ at: iso(now - 5 * DAY), id: "Tabc123", by: "reset" }], t, since(500), now));
  assert.equal(RESET_HOLD.growUnits, 10);
});

/** A change strom made for the key `days` ago, and readings before and after it. */
function worse(w: World, root: string, o: { scope: "key" | "book"; afterUnsure: number; usdBefore?: number; usdAfter?: number }): void {
  const at = Date.now() - 10 * DAY;
  const c = config(w);
  if (o.scope === "key") {
    c.tuning = { [KEY]: { reported: REPORTED, batch: tuned("Tggggg1", "A2", "reading.batch", "key", 3, 6, iso(at), "readers without a result 2 of the last 5") } };
    writeConfig(w, c);
  } else {
    fs.mkdirSync(path.join(root, ".strom", "tune"), { recursive: true });
    fs.writeFileSync(tuneFile(root, "state.json"), JSON.stringify({ [KEY]: { reported: REPORTED, books: { B0003: { find: tuned("Thhhhh1", "A1", "views.size", "book:B0003", 2000, 1400, iso(at), "B0003: unsure readings") } }, hosts: {} } }));
  }
  const usd = (v: number | undefined, scans: number) => (v === undefined ? {} : { usd: v * scans });
  const units = [
    ...[0, 1, 2, 3].map((i) => unit(`b-${i}`, at - (8 - i) * DAY, { B0003: { scans: 15, views: 15, read: 15, unsure: i === 0 ? 1 : 0 } }, { outcome: "ok", ...usd(o.usdBefore, 15) })),
    ...[0, 1, 2].map((i) => unit(`a-${i}`, at + (i + 1) * DAY, { B0003: { scans: 12, views: 12, read: 12, unsure: Math.round(o.afterUnsure / 3) } }, { outcome: "ok", ...usd(o.usdAfter, 12) })),
  ];
  plant(root, units);
}

test("strom doctor: worse after a change of strom's — a reset recommended where the readings got less sure, kept where only dearer; --fix on a yes; an archive says nothing", opts, async () => {
  const w = new World();
  const root = await w.withTree();
  // (a) the readings less sure since smaller batches: 1 of 60 unsure before, 12 of 36 after
  worse(w, root, { scope: "key", afterUnsure: 12 });
  const a = await w.run(["doctor"]);
  assert.match(a.out, /! +po samoladění +model: čte se hůř od změny stromu z \d{4}-\d\d-\d\d \(menší dávky\) — nejistá čtení 2 % → 33 % \(60 skenů před, 36 po\); doporučeno ji vrátit {2}→ strom media calibrate --reset --only batches/);
  const json = (await w.run(["doctor", "--json"])).json;
  assert.equal(json.checks.find((c: { name: string }) => c.name === "tuneworse").status, "warn");
  assert.equal(config(w).tuning[TUNED].batch.value, 3, "doctor runs nothing");
  // --fix: only on the person's yes (an agent asks: a window)
  await w.run(["doctor", "--fix"], { dialog: false, env: { CLAUDECODE: "1" } });
  assert.equal(config(w).tuning[TUNED].batch.value, 3, "no in the window: kept");
  await w.run(["doctor", "--fix"], { dialog: true, env: { CLAUDECODE: "1" } });
  assert.equal(config(w).tuning, undefined, "returned on the yes");
  assert.equal(resets(root).length, 1);
  assert.doesNotMatch((await w.run(["doctor"])).out, /po samoladění/);

  // (b) a book's bigger views: dearer, the readings no surer — keeping it recommended, no repair
  worse(w, root, { scope: "book", afterUnsure: 0, usdBefore: 0.1, usdAfter: 0.2 });
  const b = await w.run(["doctor"]);
  assert.match(b.out, /✓ +po samoladění +B0003: dražší od změny stromu z \d{4}-\d\d-\d\d \(větší pohledy\) — \$0[.,]100 → \$0[.,]200 na sken \(60 skenů před, 36 po\), čtení o nic jistější; doporučeno ji ponechat \(šla k přesnosti\), vrátit ji jde {2}→ strom media calibrate --reset --only sizes --recordset B0003/);

  // too few readings since a change: nothing said
  const few = Date.now() - 10 * DAY;
  plant(root, [unit("b-0", few - DAY, { B0003: { scans: 60, views: 60, read: 60 } }, { outcome: "ok" }), unit("a-0", few + DAY, { B0003: { scans: 10, views: 10, read: 10, unsure: 9 } }, { outcome: "ok" })]);
  assert.doesNotMatch((await w.run(["doctor"])).out, /po samoladění/);

  // an archive: nothing of it, and no reset
  worse(w, root, { scope: "key", afterUnsure: 12 });
  await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  assert.doesNotMatch((await w.run(["doctor"])).out, /po samoladění|calibrate/);
  assert.match((await w.run(["media", "calibrate", "--reset", "--dry-run"])).err, /archive/);
  w.cleanup();
});

test("the reason a person reads: the research language, its numbers as the language writes them, the English why the agent's", async () => {
  const { reasonText } = await import("../../src/cli/tunereset.ts");
  const item = (o: Record<string, unknown>) => ({ id: "T1", part: "batches", what: "reading.views", key: KEY, scope: "key", where: "config", now: {}, default: {}, source: "tuned", fields: [], why: "English", ...o }) as never;
  const a3 = item({ action: "A3", basis: { M4: 3, "M4.of": 10, ctx: 118500, viewTokens: 4200.5 } });
  assert.equal(reasonText("cs", a3), "kontext se vyčistil: 3 z posledních 10 čtenářů, poprvé zhruba při 118 500 tokenech, pohled čtenáře zhruba 4 200,5 tokenů");
  assert.equal(reasonText("en", a3), "the context cleared: 3 of the last 10 readers, the first at about 118,500 tokens, a reader's view about 4,200.5 tokens");
  assert.equal(reasonText("de", a3), "der Kontext wurde geleert: 3 der letzten 10 Leser, das erste Mal bei etwa 118.500 Tokens, eine Ansicht eines Lesers etwa 4.200,5 Tokens");
  // the stop where the context never cleared: the main agent's long stretches (M12)
  const long = item({ action: "A3", basis: { M12: 2, "M12.of": 5, "M12.views": 40, "M12.peak": 170000, ctx: 150000, viewTokens: 4000 } });
  assert.equal(reasonText("en", long), "the context never cleared, yet grew past 150,000 tokens: 2 of the last 5 sessions, a reader's view about 4,000 tokens");
  assert.equal(reasonText("cs", long), "kontext se nevyčistil, a přesto přerostl 150 000 tokenů: 2 z posledních 5 sezení, pohled čtenáře zhruba 4 000 tokenů");
  assert.equal(reasonText("de", long), "der Kontext wurde nie geleert und wuchs doch über 150.000 Tokens: 2 der letzten 5 Sitzungen, eine Ansicht eines Lesers etwa 4.000 Tokens");
  // several figures of one change, one kept before its whole (M11.of) was
  const two = item({ action: "A7", basis: { M11: 0.625, "M11.n": 5, "M4": 0.3, "M4.n": 3, "M4.of": 10, "M4.ctx": 90000 } });
  assert.equal(reasonText("cs", two), "staženo a nepřečteno 63 % (5 snímků); kontext se vyčistil: 3 z posledních 10 čtenářů, poprvé zhruba při 90 000 tokenech");
  assert.equal(reasonText("cs", item({ action: "A2", basis: {} })), "z naměřených čtení");
  assert.equal(reasonText("de", item({ source: "calibrated", sample: 6 })), "gemessen an 6 bekannten Einträgen");
  assert.equal(reasonText("cs", item({ source: "answered", by: "app" })), "zodpovězeno v aplikaci Strom");
  // a language without a catalog reads English
  assert.equal(reasonText("pl", item({ source: "calibrated", sample: 6 })), "measured on 6 known records");
});
