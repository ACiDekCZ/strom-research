// What an older strom kept under an alias of a model ("claude opus") brought under the key of the model it ran on
// (core/modelkey.ts): the small state files rewritten once — whole or not at all, a copy of each as it was beside it,
// never written over — the journals never rewritten (read under the keys), nothing measured lost, the same again
// changing nothing, a strom appending meanwhile losing no line; and what was set then found by the alias.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { blank } from "../../src/image/image.ts";
import { emptyBook, type BookCounts, type Unit } from "../../src/core/readstats.ts";

const opts = { skip: !hasGit };
const DAY = 24 * 3600_000;
const ALIAS = "claude opus";
const MODEL = "claude-opus-5-5";
const KEY = "claude claude-opus-5-5";
const HOST = "archiv.příklad.example";
const iso = (t: number) => new Date(t).toISOString();

function tuned(id: string, action: string, what: string, scope: string, value: unknown, def: unknown, at: string) {
  return { id, action, what, scope, value, default: def, from: def, at, why: `${what} for a test`, basis: {}, rev: 1, seen: at, reported: MODEL, source: "tuned" };
}

function unit(id: string, daysAgo: number, key: string, books: Record<string, Partial<BookCounts>>, more: Partial<Unit> = {}): Unit {
  return { id, kind: "reader", at: iso(Date.now() - daysAgo * DAY), key, reported: MODEL, books: Object.fromEntries(Object.entries(books).map(([b, c]) => [b, { ...emptyBook(), ...c }])), hosts: {}, ...more };
}

const lines = (file: string) => fs.readFileSync(file, "utf8").split("\n").filter(Boolean);

/** Every file under a folder with its bytes (the copies kept and temporary files show here too). */
function files(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(path.relative(dir, p), fs.readFileSync(p, "utf8"));
    }
  };
  walk(dir);
  return out;
}

/** A research as beta.7 left it: tuning, answers and a summary under the alias and under the model's id, journals beside. */
async function legacy(): Promise<{ w: World; root: string; cfgFile: string; journals: string[] }> {
  const w = new World();
  const root = await w.withTree();
  for (const [i, title] of ["Křty Týnec 1784–1820", "Taufbuch Lidice 1820–1850", "Метрическая книга Луга 1850–1870"].entries()) {
    await w.ok(["recordset", "add", title, "--kinds", "baptism"]);
    const dir = path.join(w.dir, `knihy ${i + 1} ž`);
    fs.mkdirSync(dir);
    for (let n = 1; n <= 3; n++) fs.writeFileSync(path.join(dir, `s${n}.jpg`), encodeImage(n === 2 ? blank(2400, 1600, 1, 40 + i) : blank(600, 400, 1, 40 + i * 20 + n), "jpeg"));
    await w.ok(["media", "add", dir, "--recordset", `B000${i + 1}`]);
  }
  await w.ok(["config", "set", "model.lead", "opus"]);
  const at = iso(Date.now() - 2 * DAY);
  const cfgFile = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  const cfg = readJsonFile(cfgFile);
  cfg.tuning = { [ALIAS]: { reported: MODEL, batch: tuned("Taaaaa1", "A2", "reading.batch", "key", 3, 6, at), viewsPerCall: tuned("Taaaaa1", "A2", "reading.batch", "key", 12, 24, at) } };
  cfg.viewSizes = { [ALIAS]: { find: 1400, read: 1600, at: at.slice(0, 10), sample: 6, sizes: [1400, 1600, 2000], clear: { find: true, read: true } } };
  fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2));
  const tune = path.join(root, ".strom", "tune");
  fs.mkdirSync(tune, { recursive: true });
  fs.writeFileSync(
    path.join(tune, "state.json"),
    JSON.stringify({
      // the alias and the model's id: two names of one key, each with a book of its own
      [ALIAS]: { reported: MODEL, books: { B0003: { find: tuned("Tccccc1", "A1", "views.size", "book:B0003", 2000, 1400, at), halves: tuned("Tccccc1", "A1", "views.size", "book:B0003", true, false, at) } }, hosts: { [HOST]: { order: tuned("Teeeee1", "A4", "fetch.order", `host:${HOST}`, "whole-first", "as-asked", at) } } },
      [KEY]: { reported: MODEL, books: { B0001: { noSharper: tuned("Tddddd1", "A5", "parts.none", "book:B0001", true, false, at) } }, hosts: {} },
    }),
  );
  fs.writeFileSync(path.join(tune, "answers.json"), JSON.stringify({ [ALIAS]: { "index.first": { choice: "30", at, fingerprint: "sha1:z", by: "terminal", strom: "1", basis: { metric: "x", value: 1, samples: 1, rev: 1, reported: MODEL } } } }));
  fs.writeFileSync(path.join(tune, "log.jsonl"), [{ at, id: "Tccccc1", action: "A1", key: ALIAS, scope: "book:B0003", what: "views.size", from: 1400, to: 2000, why: "x", by: "selftune" }, { at, id: "Tddddd1", action: "A5", key: KEY, scope: "book:B0001", what: "parts.none", from: false, to: true, why: "y", by: "selftune" }].map((e) => JSON.stringify(e)).join("\n") + "\n");
  // the summary: units of one model under both names
  const metrics = path.join(root, ".strom", "metrics");
  fs.mkdirSync(path.join(metrics, "usage"), { recursive: true });
  const units = [
    unit("read-1", 9, KEY, { B0001: { scans: 6, views: 8, read: 6 } }, { outcome: "ok" }),
    unit("read-2", 7, ALIAS, { B0002: { scans: 4, views: 5, read: 4 } }, { outcome: "ok" }),
    unit("N0901", 5, ALIAS, { B0003: { scans: 3, views: 7 } }, { kind: "session" }),
  ];
  fs.writeFileSync(path.join(metrics, "rollup.json"), JSON.stringify({ version: 1, updated: iso(Date.now()), backfilled: iso(Date.now()), backfillVersion: 3, units }) + "\n");
  // the journals: each line a measurement
  fs.writeFileSync(path.join(metrics, "readers.jsonl"), [1, 2, 3].map((n) => JSON.stringify({ at: iso(Date.now() - n * DAY), reader: `read-x-${n}`, kind: "read", agent: "claude", key: ALIAS, reported: MODEL, views: n, outcome: "ok", wallMs: 60_000 })).join("\n") + "\n");
  fs.writeFileSync(path.join(metrics, "usage", "N0901.jsonl"), [{ start: true, agent: "claude", key: ALIAS, session: "N0901" }, { agentSession: "u-1", model: `${MODEL}[1m]` }, { ctx: 40000, in: 5 }].map((r) => JSON.stringify({ at: iso(Date.now() - 5 * DAY), ...r })).join("\n") + "\n");
  fs.writeFileSync(path.join(metrics, "fetch.jsonl"), JSON.stringify({ at: iso(Date.now() - 4 * DAY), by: "N0901", connector: "zkusebni", cmd: "fetch", rs: "B0003", got: [1], hosts: { [HOST]: { requests: 2 } } }) + "\n");
  fs.mkdirSync(path.join(root, ".strom", "views"), { recursive: true });
  fs.writeFileSync(path.join(root, ".strom", "views", "views.jsonl"), JSON.stringify({ at: iso(Date.now() - 5 * DAY), key: "M0001", by: "N0901", kind: "whole", W: 600, H: 400, w: 600, h: 400, rs: "B0001", img: 1, capFrom: "default" }) + "\n");
  const journals = ["metrics/readers.jsonl", "metrics/usage/N0901.jsonl", "metrics/fetch.jsonl", "views/views.jsonl"].map((f) => path.join(root, ".strom", f));
  return { w, root, cfgFile, journals };
}

const sum = (units: Unit[], f: keyof BookCounts) => units.reduce((n, u) => n + Object.values(u.books).reduce((m, b) => m + (Number(b[f]) || 0), 0), 0);

test("brought under the key of the model once: whole, a copy of each file as it was, journals never rewritten, nothing measured lost; the same again changes nothing", opts, async () => {
  const { w, root, cfgFile, journals } = await legacy();
  const tune = path.join(root, ".strom", "tune");
  const metrics = path.join(root, ".strom", "metrics");
  const before = { tune: files(tune), metrics: files(metrics), journals: journals.map((f) => fs.readFileSync(f, "utf8")), cfg: fs.readFileSync(cfgFile, "utf8") };
  const rollupBefore = readJsonFile(path.join(metrics, "rollup.json")).units as Unit[];

  await w.ok(["media", "calibrate", "--report", "--json"]);
  // the state: one key, both names' books joined; the answers, the user config's tuning the same
  const state = readJsonFile(path.join(tune, "state.json"));
  assert.deepEqual(Object.keys(state), [KEY]);
  assert.deepEqual(Object.keys(state[KEY].books).sort(), ["B0001", "B0003"]);
  assert.equal(state[KEY].hosts[HOST].order.id, "Teeeee1");
  assert.deepEqual(Object.keys(readJsonFile(path.join(tune, "answers.json"))), [KEY]);
  const cfg = readJsonFile(cfgFile);
  assert.deepEqual(Object.keys(cfg.tuning), [KEY]);
  assert.equal(cfg.tuning[KEY].batch.id, "Taaaaa1", "the change kept, its ID too");
  // a copy of each file rewritten, as it was
  assert.equal(fs.readFileSync(path.join(tune, "state.json.before-keys"), "utf8"), before.tune.get("state.json"));
  assert.equal(fs.readFileSync(path.join(tune, "answers.json.before-keys"), "utf8"), before.tune.get("answers.json"));
  assert.equal(fs.readFileSync(path.join(metrics, "rollup.json.before-keys"), "utf8"), before.metrics.get("rollup.json"));
  assert.equal(fs.readFileSync(`${cfgFile}.before-keys`, "utf8"), before.cfg);
  // the journals never rewritten; the log of the tuning only appended to
  journals.forEach((f, i) => assert.equal(fs.readFileSync(f, "utf8"), before.journals[i], f));
  assert.ok(fs.readFileSync(path.join(tune, "log.jsonl"), "utf8").startsWith(before.tune.get("log.jsonl")!));
  // nothing measured lost: every unit, every view and scan, under one key
  const units = readJsonFile(path.join(metrics, "rollup.json")).units as Unit[];
  for (const u of rollupBefore) assert.ok(units.some((x) => x.id === u.id), u.id);
  assert.deepEqual([sum(units, "views"), sum(units, "scans"), sum(units, "read")], [sum(rollupBefore, "views"), sum(rollupBefore, "scans"), sum(rollupBefore, "read")]);
  assert.deepEqual([...new Set(units.filter((u) => rollupBefore.some((b) => b.id === u.id)).map((u) => u.key))], [KEY]);
  // whole or not at all: nothing left half-written beside them
  for (const dir of [tune, metrics, path.dirname(cfgFile)]) assert.deepEqual([...files(dir).keys()].filter((f) => /\.tmp$|\.lock$/u.test(f)), [], dir);

  // the same again: nothing changes, the copies stay as they were
  const after = { tune: files(tune), cfg: fs.readFileSync(cfgFile, "utf8"), units: JSON.stringify(units) };
  await w.ok(["media", "calibrate", "--report", "--json"]);
  assert.deepEqual(files(tune), after.tune);
  assert.equal(fs.readFileSync(cfgFile, "utf8"), after.cfg);
  assert.equal(JSON.stringify(readJsonFile(path.join(metrics, "rollup.json")).units), after.units);
  assert.equal(fs.readFileSync(`${cfgFile}.before-keys`, "utf8"), before.cfg);

  // what was set under the alias is found by it: a book's bigger views, the calibration of the alias kept as it is
  const view = (await w.ok(["media", "view", "B0003:2", "--json"])).json;
  assert.equal(Math.max(view.width, view.height), 2000);
  const v = lines(path.join(root, ".strom", "views", "views.jsonl")).map((l) => JSON.parse(l)).at(-1);
  assert.equal(v.capFrom, "tuned:Tccccc1");
  assert.deepEqual(Object.keys(readJsonFile(cfgFile).viewSizes), [ALIAS], "the person's calibration never renamed");
  assert.equal((await w.ok(["config", "get", "views.size", "--json"])).json.value, "find 1400 · read 1600 px", "found by the alias");
  w.cleanup();
});

test("a strom appending to the journals meanwhile loses no line", opts, async () => {
  const { w, root } = await legacy();
  const metrics = path.join(root, ".strom", "metrics");
  const targets = [path.join(metrics, "readers.jsonl"), path.join(metrics, "usage", "N0901.jsonl"), path.join(root, ".strom", "tune", "log.jsonl"), path.join(metrics, "fetch.jsonl")];
  const counts = targets.map((f) => lines(f).length);
  const N = 400;
  // another process, appending whole lines as strom does while the keys are brought under the models
  const child = spawn(process.execPath, [
    "-e",
    `const fs = require("node:fs"); const files = JSON.parse(process.argv[1]); let i = 0;
     const t = setInterval(() => { for (const f of files) fs.appendFileSync(f, JSON.stringify({ at: new Date().toISOString(), probe: i, key: "claude opus", reported: "claude-opus-5-5" }) + "\\n"); if (++i >= ${N}) { clearInterval(t); } }, 2);`,
    JSON.stringify(targets),
  ]);
  const done = new Promise<void>((resolve) => child.on("exit", () => resolve()));
  for (let k = 0; k < 3; k++) await w.ok(["media", "calibrate", "--report", "--json"]);
  await done;
  targets.forEach((f, i) => {
    const all = lines(f);
    // every line whole: the child's all there, nothing of before lost
    assert.ok(all.every((l) => JSON.parse(l)), f);
    assert.equal(all.filter((l) => l.includes('"probe"')).length, N, f);
    assert.ok(all.length >= counts[i]! + N, f);
  });
  assert.deepEqual(Object.keys(readJsonFile(path.join(root, ".strom", "tune", "state.json"))), [KEY]);
  w.cleanup();
});
