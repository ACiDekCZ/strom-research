// One key of the agent and its model in real use (core/modelkey.ts): strom asks Claude Code for "opus", Claude Code says
// it runs on claude-opus-5-5 — what strom measured of the history kept under the model's id, what it set by itself from
// it, and every lookup by the alias (strom media view, strom read, the brief) are one key. Codex with no model asked and
// Grok's setting run as its build the same; another version is another key.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { blank } from "../../src/image/image.ts";
import { emptyBook, type BookCounts, type Unit } from "../../src/core/readstats.ts";

const unix = { skip: !hasGit || process.platform === "win32" };
const opts = { skip: !hasGit };
const DAY = 24 * 3600_000;
const HOST = "archiv.příklad.example";
const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const journal = (file: string): Record<string, any>[] => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

/**
 * Some weeks of reading under a key as an older strom kept it: B0003 read worse than the others (unsure and enlarged),
 * two of five readers without a result, an archive whose limit was reached in two sessions.
 */
function measured(key: string, reported: string | undefined): Unit[] {
  const good = { scans: 16, views: 16, read: 16, unsure: 0 };
  const bad = { scans: 16, views: 16, enlarged: 16, read: 16, unsure: 12 };
  const host = (later: number) => ({ [HOST]: { requests: 10, images: 5, waitMs: 20 * 60_000, later, fetches: 1, fetched: 5, unread: 0, pending: 0 } });
  const unit = (id: string, daysAgo: number, books: Record<string, Partial<BookCounts>>, more: Partial<Unit> = {}): Unit => ({
    id,
    kind: "reader",
    at: ago(daysAgo),
    key,
    ...(reported ? { reported } : {}),
    books: Object.fromEntries(Object.entries(books).map(([b, c]) => [b, { ...emptyBook(), ...c }])),
    hosts: {},
    ...more,
  });
  return [
    unit("read-1", 20, { B0001: { ...good, unsure: 1 }, B0002: good }, { outcome: "ok" }),
    unit("read-2", 17, { B0003: bad, B0002: good }, { outcome: "ok" }),
    unit("read-3", 14, { B0001: good }, { outcome: "timeout", noResult: true }),
    unit("read-4", 11, { B0003: bad }, { outcome: "ok" }),
    unit("read-5", 8, { B0002: good }, { outcome: "timeout", noResult: true }),
    unit("N0901", 6, {}, { kind: "session", hosts: host(1) }),
    unit("N0902", 4, {}, { kind: "session", hosts: host(0) }),
  ];
}

function plant(root: string, units: Unit[]): void {
  const dir = path.join(root, ".strom", "metrics");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "rollup.json"), JSON.stringify({ version: 1, updated: new Date().toISOString(), backfilled: new Date().toISOString(), backfillVersion: 3, units }) + "\n");
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

/**
 * Claude Code as a fake: its init says the model it runs on as Claude Code says it (with the mark of its context
 * window); the brief it is given kept; it looks at a scan of B0001, with FAKE_READ at one of B0003 and hands one to
 * strom read, as an agent at work does. As a reader (STROM_READER) it only says its model.
 */
function fakeClaude(w: World): string {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const heard = path.join(w.dir, "heard");
  fs.mkdirSync(heard, { recursive: true });
  fs.writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/sh
cat > "${heard}/\${STROM_SESSION:-reader}-\$\$.txt"
echo '{"type":"system","subtype":"init","session_id":"s-'\$\$'","model":"claude-opus-5-5[1m]","tools":["Bash","Read"]}'
echo '{"type":"assistant","message":{"id":"m-'\$\$'","model":"claude-opus-5-5[1m]","content":[],"usage":{"input_tokens":5,"cache_read_input_tokens":40000,"cache_creation_input_tokens":0,"output_tokens":10}},"parent_tool_use_id":null}'
echo '{"type":"assistant","message":{"id":"n-'\$\$'","model":"claude-opus-5-5[1m]","content":[],"usage":{"input_tokens":5,"cache_read_input_tokens":45000,"cache_creation_input_tokens":0,"output_tokens":10}},"parent_tool_use_id":null}'
[ -z "\${STROM_READER:-}" ] && node "${CLI}" media view B0001:1 > /dev/null 2>&1
if [ -z "\${STROM_READER:-}" ] && [ -n "\${FAKE_READ:-}" ]; then
  node "${CLI}" media view B0003:2 --json > "${heard}/view.json" 2>&1
  node "${CLI}" read B0003:4 --parallel 1 --question "Křest Marie Dvořákové, 1852" > "${heard}/read.txt" 2>&1
fi
echo '{"type":"result","result":"done","total_cost_usd":0.01,"num_turns":1}'
`,
    { mode: 0o755 },
  );
  w.env.PATH = `${bin}${path.delimiter}${w.env.PATH}`;
  return heard;
}

test("Claude Code: strom asks for opus, its init says claude-opus-5-5 — the history joined, a change set from it used by the next session's views, strom read and brief", unix, async () => {
  const w = await world();
  const root = w.cwd;
  const heard = fakeClaude(w);
  await w.ok(["config", "set", "model.lead", "opus"]);
  // the history as an older strom kept it: under the model's id (its sessions' records), nothing of the alias said
  plant(root, measured("claude claude-opus-5-5", "claude-opus-5-5"));
  for (const what of ["Křest Václava Dvořáka", "Křest Marie Dvořákové"]) await w.ok(["task", "add", what, "--level", "link", "--where", "B3", "--why", "a", "--done-when", "b"]);

  // a session: the start of its use says the alias asked and the model it runs on
  await w.ok(["run", "--agent", "claude", "--max", "1"]);
  const models = readJsonFile(path.join(root, ".strom", "metrics", "models.json"));
  assert.deepEqual(models.aliases["claude opus"].map((e: { key: string }) => e.key), ["claude claude-opus-5-5"]);
  const usage = journal(path.join(root, ".strom", "metrics", "usage", "N0001.jsonl"));
  assert.equal(usage[0]!.key, "claude opus", "the key asked as recorded");
  assert.equal(usage.find((u) => u.agentSession)?.model, "claude-opus-5-5[1m]");

  // the history joined under one key: the older units and the session just made
  const rollup = readJsonFile(path.join(root, ".strom", "metrics", "rollup.json"));
  const keys = new Map<string, number>();
  for (const u of rollup.units) keys.set(u.key, (keys.get(u.key) ?? 0) + 1);
  assert.deepEqual([...keys], [["claude claude-opus-5-5", 8]], JSON.stringify([...keys]));
  assert.equal(rollup.units.find((u: { id: string }) => u.id === "N0001").asked, "claude opus");

  // what strom set by itself after it, under the key of the model
  const state = readJsonFile(path.join(root, ".strom", "tune", "state.json"));
  assert.deepEqual(Object.keys(state), ["claude claude-opus-5-5"]);
  const a1 = state["claude claude-opus-5-5"].books.B0003.find.id;
  const config = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  assert.equal(config.tuning["claude claude-opus-5-5"].batch.value, 3);

  // the next session asks for opus again: its views, its reader and its brief go by what was set
  await w.ok(["run", "--agent", "claude", "--max", "1"], { env: { FAKE_READ: "1" } });
  const views = journal(path.join(root, ".strom", "views", "views.jsonl"));
  const mine = views.filter((v) => v.by === "N0002" && v.rs === "B0003");
  assert.ok(mine.length >= 2, fs.readFileSync(path.join(heard, "view.json"), "utf8") + fs.readFileSync(path.join(heard, "read.txt"), "utf8"));
  assert.ok(mine.every((v) => v.capFrom === `tuned:${a1}`), JSON.stringify(mine.map((v) => v.capFrom)));
  assert.ok(mine.some((v) => !v.reader) && mine.some((v) => v.reader), "strom media view's and strom read's");
  assert.equal(JSON.parse(fs.readFileSync(path.join(heard, "view.json"), "utf8")).width, 2000, "the whole image at reading size");
  const readers = journal(path.join(root, ".strom", "metrics", "readers.jsonl"));
  assert.equal(readers.at(-1)!.capFrom, `tuned:${a1}`);
  const brief = fs.readdirSync(heard).filter((f) => f.startsWith("N0002-")).map((f) => fs.readFileSync(path.join(heard, f), "utf8")).join("\n");
  assert.match(brief, /## Reading scans in this session \(strom tuned it from how the reading went: these numbers hold over the method's\)\n- about three scans a batch/);
  assert.match(brief, /read worse than the other books \(strom tuned it\): its views are as big as your model takes them \(2000 px\)/);
  // the settings say it under the model too
  assert.match((await w.ok(["config", "get", "reading.batch", "--json"])).json.source, /^tuned /);
  w.cleanup();
});

test("Codex with no model asked and Grok's setting run as its build: what was set by the model said is found by what is asked", opts, async () => {
  for (const c of [
    { agent: "codex", lead: undefined, asked: "codex", reported: "gpt-6-astra", key: "codex gpt-6-astra" },
    { agent: "grok", lead: "grok-4.7", asked: "grok grok-4.7", reported: "grok-4.7-build", key: "grok grok-4.7-build" },
    // an agent that says no model: its key as asked
    { agent: "antigravity", lead: undefined, asked: "antigravity", reported: undefined, key: "antigravity" },
  ]) {
    const w = await world();
    await w.ok(["config", "set", "agent", c.agent]);
    if (c.lead) await w.ok(["config", "set", "model.lead", c.lead]);
    plant(w.cwd, measured(c.asked, c.reported));
    const j = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
    assert.equal(j.key, c.key, c.agent);
    const state = readJsonFile(path.join(w.cwd, ".strom", "tune", "state.json"));
    assert.deepEqual(Object.keys(state), [c.key], c.agent);
    const id = state[c.key].books.B0003.find.id;
    await w.ok(["media", "view", "B0003:2", "--json"]);
    const v = journal(path.join(w.cwd, ".strom", "views", "views.jsonl")).at(-1)!;
    assert.equal(v.capFrom, `tuned:${id}`, c.agent);
    w.cleanup();
  }
});
