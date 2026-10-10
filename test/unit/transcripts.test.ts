// Claude Code's transcripts of the sessions strom started, read for the tuning of scan reading (core/transcripts.ts):
// the tokens of each request, the tools, the files read — the context cleared and files opened again after it (M3),
// each subagent's cost — and nothing of the conversation. Fixtures in the shape of today's transcripts, in a home of
// the test's own (never the person's ~/.claude).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claudeTranscript, projectSlug, transcriptFile } from "../../src/core/transcripts.ts";
import { Settings } from "../../src/core/config.ts";

const UUID = "0b3f9a52-6c1e-4d7a-9f20-5e8c1a2b3c4d";
const SECRET = "Johann Dvořák, born 1849 — conversation text";

let n = 0;
/** One response of the model as Claude Code writes it: one line per content block, the usage repeated on each. */
function response(ctx: number, opts: { tools?: { name: string; input?: Record<string, unknown> }[]; out?: number; sidechain?: boolean; agentId?: string; model?: string } = {}): string[] {
  const id = `msg_${++n}`;
  const usage = {
    input_tokens: 3,
    cache_creation_input_tokens: 1000,
    cache_read_input_tokens: ctx - 1003,
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 1000 },
    output_tokens: opts.out ?? 50,
    service_tier: "standard",
  };
  const base = { parentUuid: null, isSidechain: opts.sidechain ?? false, ...(opts.agentId ? { agentId: opts.agentId } : {}), userType: "external", cwd: "/x", sessionId: UUID, version: "2.1.0", type: "assistant", requestId: `req_${n}`, timestamp: "2026-10-10T10:00:00.000Z" };
  const blocks: unknown[] = [{ type: "text", text: SECRET }, ...(opts.tools ?? []).map((t, i) => ({ type: "tool_use", id: `toolu_${n}_${i}`, name: t.name, input: t.input ?? {} }))];
  return blocks.map((b, i) => JSON.stringify({ ...base, uuid: `u${n}-${i}`, message: { id, type: "message", role: "assistant", model: opts.model ?? "claude-opus-5-5", content: [b], stop_reason: null, usage: { ...usage, output_tokens: i === blocks.length - 1 ? usage.output_tokens : 1 } } }));
}
const user = (text = SECRET) => JSON.stringify({ type: "user", isSidechain: false, sessionId: UUID, message: { role: "user", content: text }, uuid: `uu${++n}` });
const read = (p: string) => ({ name: "Read", input: { file_path: p } });

function home(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "strom-transcripts-"));
}
function write(h: string, cwd: string, lines: string[], file = `${UUID}.jsonl`): string {
  const f = path.join(h, ".claude", "projects", projectSlug(cwd), file);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, lines.join("\n") + "\n");
  return f;
}

test("Claude Code's slug of a folder: every character but an ASCII letter or digit a dash", () => {
  assert.equal(projectSlug("/Users/x/Projects/my-tree"), "-Users-x-Projects-my-tree");
  assert.equal(projectSlug("C:\\Users\\x\\Strom\\Tree"), "C--Users-x-Strom-Tree");
  assert.equal(projectSlug("/home/x/Víškovi"), "-home-x-V--kovi");
  assert.equal(projectSlug("/home/x/Víškovi".normalize("NFD")), "-home-x-Vi-s-kovi");
});

test("a clear of the context and a file read again after it: M3; usage per request, not per line; tools counted", () => {
  const h = home();
  const cwd = "/Users/x/Strom/Tree";
  const scan = "/Users/x/Strom/Tree/.strom/views/M0001-a.jpg";
  write(h, cwd, [
    user(),
    ...response(20_000, { tools: [read(scan), { name: "Bash", input: { command: "strom media view M0001" } }] }),
    user(),
    ...response(60_000, { tools: [read("/Users/x/Strom/Tree/AGENTS.md")] }),
    ...response(90_000, { tools: [read("/Users/x/Strom/Tree/.strom/views/M0002-a.jpg")] }),
    JSON.stringify({ type: "system", subtype: "compact_boundary", content: "Conversation compacted" }),
    // cleared: 90k → 30k
    ...response(30_000, { tools: [read(scan), read("/Users/x/Strom/Tree/notes/new.md")] }),
    ...response(40_000, { tools: [read("/Users/x/Strom/Tree/.strom/views/M0002-a.jpg"), read("/Users/x/Strom/Tree/notes/new.md")] }),
  ]);
  const t = claudeTranscript(UUID, { cwd, home: h, env: {} });
  assert.equal(t.status, "ok");
  assert.ok(t.main !== "unknown");
  const m = t.main;
  assert.equal(m.requests, 5, "the lines of one response are one request");
  assert.deepEqual(m.context, [20_000, 60_000, 90_000, 30_000, 40_000]);
  assert.deepEqual(m.clears, [{ request: 3, before: 90_000, after: 30_000 }]);
  assert.deepEqual(m.tools, { Read: 7, Bash: 1 });
  assert.equal(m.usage.output, 250, "the final output count of each response, once");
  assert.equal(m.usage.cacheWrite, 5000);
  assert.equal(m.usage.cacheWrite1h, 5000);
  assert.equal(m.usage.cacheWrite5m, 0);
  assert.equal(m.model, "claude-opus-5-5");
  // after the clear: 4 Reads; the scan and M0002 had been read before it, new.md once before (after the clear) — not a reopening
  assert.deepEqual(m.reopen, { reads: 7, afterClear: 4, reopened: 2, share: 0.5 });
  const s = m.reads.find((r) => r.path === scan)!;
  assert.deepEqual(s, { path: scan, count: 2, first: 0, afterClear: 1, reopened: 1 });
  assert.equal(m.reads.find((r) => r.path.endsWith("new.md"))!.reopened, 0);
  assert.deepEqual(t.subagents, []);
  assert.equal(t.skipped, 0);
  // never a word of the conversation, nor a command's text
  const json = JSON.stringify(t);
  assert.ok(!json.includes("Dvořák") && !json.includes("strom media view"), json);
});

test("no clear: nothing after it, share 0; two clears: a file read between them, opened again after the second", () => {
  const h = home();
  const cwd = "/t/a";
  write(h, cwd, [...response(20_000, { tools: [read("/t/a/x")] }), ...response(25_000, { tools: [read("/t/a/x")] })]);
  const one = claudeTranscript(UUID, { cwd, home: h, env: {} });
  assert.ok(one.main !== "unknown");
  assert.deepEqual(one.main.reopen, { reads: 2, afterClear: 0, reopened: 0, share: 0 });

  const h2 = home();
  write(h2, cwd, [
    ...response(50_000),
    ...response(20_000, { tools: [read("/t/a/y")] }), // clear 1
    ...response(60_000),
    ...response(25_000, { tools: [read("/t/a/y")] }), // clear 2: y was read before it
  ]);
  const two = claudeTranscript(UUID, { cwd, home: h2, env: {} });
  assert.ok(two.main !== "unknown");
  assert.equal(two.main.clears.length, 2);
  assert.deepEqual(two.main.reopen, { reads: 2, afterClear: 2, reopened: 1, share: 0.5 });
});

test("subagents: each from its own file with its usage, tools, clears and Reads; the total of all", () => {
  const h = home();
  const cwd = "/Users/x/Strom/Tree";
  const main = write(h, cwd, [...response(20_000, { tools: [{ name: "Agent", input: { subagent_type: "strom-scan-reader", prompt: SECRET } }] }), ...response(22_000)]);
  const sub = path.join(path.dirname(main), UUID, "subagents");
  fs.mkdirSync(sub, { recursive: true });
  const view = "/Users/x/Strom/Tree/.strom/views/M0007.jpg";
  fs.writeFileSync(
    path.join(sub, "agent-a1b2c3.jsonl"),
    [
      ...response(10_000, { sidechain: true, agentId: "a1b2c3", model: "claude-sonnet-5", tools: [read(view)] }),
      ...response(40_000, { sidechain: true, agentId: "a1b2c3", model: "claude-sonnet-5" }),
      ...response(12_000, { sidechain: true, agentId: "a1b2c3", model: "claude-sonnet-5", tools: [read(view)] }),
    ].join("\n"),
  );
  fs.writeFileSync(path.join(sub, "agent-d4e5f6.jsonl"), response(9_000, { sidechain: true, agentId: "d4e5f6" }).join("\n"));
  fs.writeFileSync(path.join(sub, "agent-d4e5f6.meta.json"), "{}");
  const t = claudeTranscript(UUID, { cwd, home: h, env: {} });
  assert.ok(t.subagents !== "unknown" && t.main !== "unknown" && t.total !== "unknown");
  assert.deepEqual(t.subagents.map((s) => s.id), ["a1b2c3", "d4e5f6"]);
  const r = t.subagents[0]!;
  assert.equal(r.model, "claude-sonnet-5");
  assert.equal(r.requests, 3);
  assert.deepEqual(r.clears, [{ request: 2, before: 40_000, after: 12_000 }]);
  assert.deepEqual(r.reopen, { reads: 2, afterClear: 1, reopened: 1, share: 1 });
  assert.equal(r.usage.input, 9);
  assert.equal(t.main.tools.Agent, 1);
  assert.equal(t.total.output, 50 * 6);
  assert.equal(t.total.cacheRead, t.main.usage.cacheRead + r.usage.cacheRead + t.subagents[1]!.usage.cacheRead);
});

test("an older transcript: the subagents' lines in the main file (isSidechain) are theirs, not the main agent's", () => {
  const h = home();
  const cwd = "/t/old";
  write(h, cwd, [...response(20_000), ...response(5_000, { sidechain: true, agentId: "s1", tools: [read("/t/old/v.jpg")] }), ...response(21_000)]);
  const t = claudeTranscript(UUID, { cwd, home: h, env: {} });
  assert.ok(t.main !== "unknown" && t.subagents !== "unknown");
  assert.deepEqual(t.main.context, [20_000, 21_000], "no clear from a subagent's smaller context");
  assert.equal(t.main.clears.length, 0);
  assert.deepEqual(t.subagents.map((s) => [s.id, s.requests, s.tools.Read]), [["s1", 1, 1]]);
});

test("malformed lines, unknown fields, missing usage: skipped or unknown, never an error", () => {
  const h = home();
  const cwd = "/t/bad";
  write(h, cwd, [
    ...response(20_000, { tools: [read("/t/bad/a")] }),
    '{"type":"assistant","message":{"id":"cut', // cut short
    '"assistant"', // JSON, not an object
    "[1,2,\"assistant\"]",
    JSON.stringify({ type: "assistant", message: { id: "m-x", content: "not a list", usage: { input_tokens: "many" } } }),
    JSON.stringify({ type: "assistant", message: { id: "m-y", content: [{ type: "tool_use", name: "Read", input: { file_path: 42 } }, { type: "tool_use" }], usage: { output_tokens: 7 } } }),
    JSON.stringify({ type: "assistant", message: null }),
    JSON.stringify({ type: "assistant", message: { id: "m-z", usage: { input_tokens: 4, cache_read_input_tokens: 25_000, cache_creation_input_tokens: 0, output_tokens: 5, new_field: { x: 1 } } } }),
  ]);
  const t = claudeTranscript(UUID, { cwd, home: h, env: {} });
  assert.equal(t.status, "ok");
  assert.equal(t.skipped, 3);
  assert.ok(t.main !== "unknown");
  assert.deepEqual(t.main.context, [20_000, null, null, 25_004]);
  assert.deepEqual(t.main.tools, { Read: 2 }, "a Read without a path is still a Read; a block without a name is nothing");
  assert.equal(t.main.reads.length, 1);
  assert.equal(t.main.usage.output, 50 + 7 + 5);
  assert.equal(t.main.usage.cacheWrite1h, 1000, "known where a request said it");

  // no usage anywhere: M3 unknown, the lifetimes of cache writes unknown
  const h2 = home();
  write(h2, cwd, [JSON.stringify({ type: "assistant", message: { id: "m1", content: [{ type: "tool_use", id: "t1", name: "Read", input: { file_path: "/t/bad/a" } }] } })]);
  const u = claudeTranscript(UUID, { cwd, home: h2, env: {} });
  assert.ok(u.main !== "unknown");
  assert.equal(u.main.reopen, "unknown");
  assert.equal(u.main.usage.cacheWrite1h, "unknown");
  assert.equal(u.main.model, "unknown");
});

test("no transcript, no Claude Code folder, not a session id: missing, all unknown", () => {
  const h = home();
  const none = claudeTranscript(UUID, { cwd: "/t/none", home: h, env: {} });
  assert.deepEqual(none, { status: "missing", main: "unknown", subagents: "unknown", total: "unknown", skipped: 0 });
  write(h, "/t/elsewhere", response(1000));
  assert.equal(claudeTranscript("../../etc/passwd", { cwd: "/t/elsewhere", home: h, env: {} }).status, "missing");
  assert.equal(claudeTranscript("not-a-uuid", { cwd: "/t/elsewhere", home: h, env: {} }).status, "missing");
});

test("tune.transcripts off: nothing read — not even a folder looked at", (t) => {
  const h = home();
  write(h, "/t/off", response(1000));
  const looked = [t.mock.method(fs, "statSync"), t.mock.method(fs, "readdirSync"), t.mock.method(fs, "openSync"), t.mock.method(fs, "existsSync")];
  const off = claudeTranscript(UUID, { cwd: "/t/off", home: h, env: {}, enabled: false });
  assert.deepEqual(off, { status: "off", main: "unknown", subagents: "unknown", total: "unknown", skipped: 0 });
  assert.deepEqual(looked.map((m) => m.mock.callCount()), [0, 0, 0, 0]);
  // on, the same spies see it look (they do watch what the adapter calls)
  assert.equal(claudeTranscript(UUID, { cwd: "/t/off", home: h, env: {} }).status, "ok");
  assert.ok(looked[0]!.mock.callCount() > 0 && looked[2]!.mock.callCount() > 0);
  t.mock.restoreAll();
  // from the settings: the user config, or STROM_TUNE_TRANSCRIPTS
  const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-transcripts-cfg-"));
  const env = { STROM_CONFIG_DIR: cfgDir, HOME: h };
  assert.equal(claudeTranscript(UUID, { cwd: "/t/off", home: h, env: {}, settings: new Settings(env, {}) }).status, "ok", "on by default");
  assert.equal(claudeTranscript(UUID, { cwd: "/t/off", home: h, env: {}, settings: new Settings(env, {}, { tuneTranscripts: "off" }) }).status, "off");
  assert.equal(claudeTranscript(UUID, { cwd: "/t/off", home: h, env: {}, settings: new Settings({ ...env, STROM_TUNE_TRANSCRIPTS: "off" }, {}) }).status, "off");
});

test("a folder with diacritics, written NFC or NFD; another spelling of the folder found by the session id; CLAUDE_CONFIG_DIR", () => {
  const h = home();
  const cwd = "/Users/x/Strom/Dvořákovi – Žďár";
  const f = write(h, cwd.normalize("NFD"), [...response(30_000, { tools: [read(`${cwd}/.strom/views/M0001.jpg`)] }), ...response(10_000, { tools: [read(`${cwd}/.strom/views/M0001.jpg`.normalize("NFD"))] })]);
  for (const c of [cwd.normalize("NFC"), cwd.normalize("NFD")]) {
    const t = claudeTranscript(UUID, { cwd: c, home: h, env: {} });
    assert.equal(t.file, f);
    assert.ok(t.main !== "unknown");
    assert.deepEqual(t.main.reopen, { reads: 2, afterClear: 1, reopened: 1, share: 1 }, "the same file however it was spelled");
    assert.equal(t.main.reads.length, 1);
    assert.equal(t.main.reads[0]!.path, `${cwd}/.strom/views/M0001.jpg`, "as the agent gave it first");
  }
  // the session ran in /private/tmp/… while strom knows /tmp/…: found by its id
  assert.equal(transcriptFile(UUID, { cwd: "/elsewhere/entirely", home: h, env: {} }), f);
  // Claude Code's folder elsewhere
  const cfg = path.join(home(), "claude-config");
  const g = path.join(cfg, "projects", projectSlug("/w"), `${UUID}.jsonl`);
  fs.mkdirSync(path.dirname(g), { recursive: true });
  fs.writeFileSync(g, response(5000).join("\n"));
  assert.equal(claudeTranscript(UUID, { cwd: "/w", home: h, env: { CLAUDE_CONFIG_DIR: cfg } }).file, g);
});

test("a transcript larger than one piece read: every line whole across the pieces", () => {
  const h = home();
  const lines: string[] = [];
  for (let i = 0; i < 3000; i++) lines.push(...response(20_000 + i, { tools: [read(`/t/big/${i % 7}.jpg`)] }));
  const f = write(h, "/t/big", lines);
  assert.ok(fs.statSync(f).size > 2 * (1 << 20));
  const t = claudeTranscript(UUID, { cwd: "/t/big", home: h, env: {} });
  assert.equal(t.skipped, 0);
  assert.ok(t.main !== "unknown");
  assert.equal(t.main.requests, 3000);
  assert.equal(t.main.tools.Read, 3000);
  assert.equal(t.main.reads.length, 7);
});

test("a Windows folder: its slug, and the transcript found under it", () => {
  const h = home();
  const cwd = "C:\\Users\\Jiří\\Documents\\Strom\\Strom";
  const f = write(h, cwd, response(1000, { tools: [read("C:\\Users\\Jiří\\Documents\\Strom\\Strom\\AGENTS.md")] }));
  assert.equal(path.basename(path.dirname(f)), "C--Users-Ji---Documents-Strom-Strom");
  const t = claudeTranscript(UUID, { cwd, home: h, env: {} });
  assert.equal(t.status, "ok");
  assert.ok(t.main !== "unknown");
  assert.equal(t.main.tools.Read, 1);
});

test("strom config: tune.transcripts on by default, off and back", async () => {
  const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-transcripts-cfg-"));
  const env = { STROM_CONFIG_DIR: cfgDir, HOME: cfgDir };
  assert.equal(new Settings(env, {}).tuneTranscripts(), true);
  assert.equal(new Settings(env, {}, { tuneTranscripts: "off" }).tuneTranscripts(), false);
  assert.equal(new Settings({ ...env, STROM_TUNE_TRANSCRIPTS: "on" }, {}, { tuneTranscripts: "off" }).tuneTranscripts(), true);
  assert.throws(() => new Settings({ ...env, STROM_TUNE_TRANSCRIPTS: "maybe" }, {}).tuneTranscripts(), /invalid tune.transcripts/);
});

test("Claude Code's own message at the end (a limit of the subscription: <synthetic>, nothing used) is no clear of the context", () => {
  const h = home();
  const cwd = "/t/limit";
  write(h, cwd, [
    ...response(60_000),
    ...response(128_000, { tools: [read("/t/limit/a.jpg")] }),
    JSON.stringify({ type: "assistant", message: { id: "m-end", model: "<synthetic>", content: [{ type: "text", text: "limit reached" }], usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }),
    // a response saying nothing was given to it (0): no clear either
    JSON.stringify({ type: "assistant", message: { id: "m-zero", model: "claude-opus-5-5", content: [], usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }),
  ]);
  const t = claudeTranscript(UUID, { cwd, home: h, env: {} });
  assert.ok(t.main !== "unknown");
  assert.deepEqual(t.main.clears, []);
  assert.deepEqual(t.main.context, [60_000, 128_000, null, null]);
  assert.equal(t.main.model, "claude-opus-5-5");
});
