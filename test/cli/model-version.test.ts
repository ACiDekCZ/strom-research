// Claude Code's aliases (opus, sonnet, the agent's own) offered with the model each last ran on, where a research here
// saw it run (.strom/metrics/models.json): the setup's model step, the menu's settings, strom doctor and the Strom app's
// choice of readers (/status accepts.read.choices, feature read.choices.now). Unknown: as before, nothing guessed. What
// is kept stays the alias — a newer Opus is taken by itself — and a model typed by hand stays that model.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { aliasNow, modelTitle } from "../../src/agents/models.ts";
import { aliasesOfTrees, loadAliases, type Aliases } from "../../src/core/modelkey.ts";
import { readChoices } from "../../src/core/readchoice.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";

const unix = { skip: !hasGit || process.platform === "win32" };

test("a Claude model's name as a person reads it; any other as it is", () => {
  assert.equal(modelTitle("claude", "claude-opus-5-5"), "Opus 5.5");
  assert.equal(modelTitle("claude", "claude-opus-5"), "Opus 5");
  assert.equal(modelTitle("claude", "claude-sonnet-4-6-20260801"), "Sonnet 4.6");
  assert.equal(modelTitle("claude", "claude-opus-5-5[1m]"), "Opus 5.5");
  assert.equal(modelTitle("claude", "claude-3-5-sonnet"), "Sonnet 3.5");
  assert.equal(modelTitle("claude", "claude-fable-5-1"), "Fable 5.1");
  assert.equal(modelTitle("claude", "opus"), "opus");
  assert.equal(modelTitle("grok", "grok-4.7-build"), "grok-4.7-build");
});

test("what an alias last ran on: the newest model seen, none when unknown or a model of its own", () => {
  const aliases: Aliases = { "claude opus": [{ key: "claude claude-opus-5", at: "2026-09-01T00:00:00Z" }, { key: "claude claude-opus-5-5", at: "2026-10-01T00:00:00Z" }] };
  assert.equal(aliasNow("claude", "opus", aliases), "claude-opus-5-5");
  assert.equal(aliasNow("claude", "Opus", aliases), "claude-opus-5-5");
  assert.equal(aliasNow("claude", "sonnet", aliases), undefined, "never seen: unknown");
  assert.equal(aliasNow("claude", undefined, aliases), undefined, "the agent's own never seen");
  assert.equal(aliasNow("claude", "claude-opus-5", aliases), undefined, "a model of its own: itself");
  assert.equal(aliasNow("claude", "opus", undefined), undefined);
  // two researches: the newest any of them saw
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "strom-alias-ř-"));
  try {
    const a = path.join(dir, "a");
    const b = path.join(dir, "b");
    seen(a, { "claude opus": [["claude claude-opus-5", "2026-09-01T00:00:00Z"]] });
    seen(b, { "claude opus": [["claude claude-opus-5-5", "2026-10-01T00:00:00Z"]], claude: [["claude claude-sonnet-5", "2026-10-02T00:00:00Z"]] });
    const all = aliasesOfTrees([a, b, a]);
    assert.equal(aliasNow("claude", "opus", all), "claude-opus-5-5");
    assert.equal(aliasNow("claude", undefined, all), "claude-sonnet-5");
    assert.equal(aliasNow("claude", "opus", aliasesOfTrees([a])), "claude-opus-5");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** What a research saw its aliases run on (.strom/metrics/models.json, as strom keeps it). */
function seen(root: string, aliases: Record<string, [string, string][]>): void {
  const dir = path.join(root, ".strom", "metrics");
  fs.mkdirSync(dir, { recursive: true });
  const out = Object.fromEntries(Object.entries(aliases).map(([k, list]) => [k, list.map(([key, at]) => ({ key, at }))]));
  fs.writeFileSync(path.join(dir, "models.json"), JSON.stringify({ version: 1, aliases: out }, null, 1) + "\n");
}

function fakeClaude(w: World): void {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git && !fs.existsSync(path.join(bin, "git"))) fs.symlinkSync(git, path.join(bin, "git"));
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\necho "$*" >> "${path.join(w.dir, "claude.calls")}"\nexit 0\n`, { mode: 0o755 });
  w.env.PATH = `${bin}${path.delimiter}/bin${path.delimiter}/usr/bin`;
}

const config = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));

/** The setup's model question as it was printed: its lines up to "Choose [n]". */
function modelQuestion(out: string): string {
  const m = /Which model should do the research\?\n(?:[^\n]*\n)*?(?:Choose|Vybrat) \[\d\]/.exec(out);
  assert.ok(m, out);
  return m[0];
}

test("the setup's model step: Opus and the agent's own with the model they last ran on; Sonnet unknown as before; the alias kept, never its model", unix, async () => {
  const w = new World();
  try {
    fakeClaude(w);
    await w.ok(["setup", "--yes"]);
    w.historyAsked();
    await w.ok(["init", "Lhotákovi"]);
    const root = w.treeDir("Lhotákovi");
    // nothing seen yet: the choice as it was
    const before = await w.ok(["setup"], { answers: ["en", "", "", "1"] });
    assert.match(modelQuestion(before.out), /\n {3}1 {2}Opus — best at reading old handwriting \(recommended\)\n {3}2 {2}Sonnet — faster; printed documents and everyday work\n {3}3 {2}Leave it to the agent\n/);
    seen(root, { "claude opus": [["claude claude-opus-5-5", "2026-10-01T00:00:00Z"]], claude: [["claude claude-opus-5-5", "2026-10-02T00:00:00Z"]] });
    const r = await w.ok(["setup"], { answers: ["en", "", "", "1"] });
    assert.match(modelQuestion(r.out), /\n {3}1 {2}Opus \(now Opus 5\.5\) — best at reading old handwriting \(recommended\)\n {3}2 {2}Sonnet — faster; printed documents and everyday work\n {3}3 {2}Leave it to the agent \(now Opus 5\.5\)\n/);
    assert.equal(config(w).models.claude.lead, "opus", "the alias kept: a newer Opus is taken by itself");
    // Opus seen on a newer model since: the name follows it, what is kept does not change
    seen(root, { "claude opus": [["claude claude-opus-5-5", "2026-10-01T00:00:00Z"], ["claude claude-opus-5-6", "2026-11-01T00:00:00Z"]] });
    const newer = await w.ok(["setup"], { answers: ["en", "", "", ""] });
    assert.match(modelQuestion(newer.out), /\n {3}1 {2}Opus \(now Opus 5\.6\) — [^\n]*\n {3}2 {2}Sonnet — [^\n]*\n {3}3 {2}Leave it to the agent\n(?: {3}0 [^\n]*\n)?(?:Choose|Vybrat) \[1\]/);
    assert.equal(config(w).models.claude.lead, "opus");
    // in Czech
    const cs = await w.ok(["setup"], { answers: ["cs", "", "", ""] });
    assert.match(cs.out, /\n {3}1 {2}Opus \(teď Opus 5\.6\) – nejlépe čte staré rukopisy \(doporučeno\)\n/);
    // nothing written into the research by looking
    assert.deepEqual(loadAliases(root)["claude opus"]!.map((e) => e.key), ["claude claude-opus-5-5", "claude claude-opus-5-6"]);
  } finally {
    w.cleanup();
  }
});

test("a model typed by hand stays that model: offered as chosen now, Enter keeps it — never put back to the alias", unix, async () => {
  const w = new World();
  try {
    fakeClaude(w);
    await w.ok(["setup", "--yes"]);
    w.historyAsked();
    await w.ok(["config", "set", "model.lead", "claude-opus-5", "--agent", "claude", "--yes"]);
    assert.equal(config(w).models.claude.lead, "claude-opus-5");
    const r = await w.ok(["setup"], { answers: ["en", "", "", ""] });
    assert.match(modelQuestion(r.out), /\n {3}2 {2}Sonnet — [^\n]*\n {3}3 {2}Opus 5 · claude-opus-5 \(chosen now\)\n {3}4 {2}Leave it to the agent\n(?: {3}0 [^\n]*\n)?(?:Choose|Vybrat) \[3\]/);
    assert.equal(config(w).models.claude.lead, "claude-opus-5", "Enter keeps the model typed by hand");
    // the alias chosen again: the alias kept
    await w.ok(["setup"], { answers: ["en", "", "", "1"] });
    assert.equal(config(w).models.claude.lead, "opus");
  } finally {
    w.cleanup();
  }
});

test("the menu's settings and strom doctor name the model an alias last ran on; unknown: the alias alone", unix, async () => {
  const w = new World();
  try {
    fakeClaude(w);
    await w.ok(["setup", "--yes"]);
    w.historyAsked();
    await w.ok(["init", "Lhotákovi"]);
    w.cwd = w.treeDir("Lhotákovi");
    await w.ok(["config", "set", "model.lead", "opus", "--agent", "claude", "--yes"]);
    const plain = await w.ok(["doctor"]);
    assert.match(plain.out, /\bopus\b/);
    assert.match(plain.out, /model +opus\n/, "unknown: nothing guessed");
    seen(w.cwd, { "claude opus": [["claude claude-opus-5-5", "2026-10-01T00:00:00Z"]] });
    const doc = await w.ok(["doctor"]);
    assert.match(doc.out, /model +opus \(teď Opus 5\.5\)\n/);
    // the menu (the research's language): 8 settings · 1 the setup · 0 · 0
    const menu = await w.ok([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.match(menu.out, /Jen model výzkumu \(Claude Code\): opus \(teď Opus 5\.5\)/);
  } finally {
    w.cleanup();
  }
});

test("the Strom app's choice of readers: each alias of Claude with the model it last ran on here (read.choices.now); unknown: none", unix, async () => {
  const w = new World();
  try {
    fakeClaude(w);
    await w.ok(["setup", "--yes"]);
    w.historyAsked();
    await w.ok(["init", "Lhotákovi"]);
    const root = w.treeDir("Lhotákovi");
    const claude = () => readChoices(Tree.open(root, w.env), new Settings(w.env, {}), w.env, "claude").agents.find((a) => a.id === "claude")!;
    const none = claude();
    assert.ok(none.models.length >= 3);
    assert.ok(none.models.every((m) => m.now === undefined && m.nowName === undefined), "nothing seen: nothing said");
    seen(root, { "claude opus": [["claude claude-opus-5-5", "2026-10-01T00:00:00Z"]], claude: [["claude claude-sonnet-5", "2026-10-02T00:00:00Z"]] });
    const c = claude();
    assert.deepEqual(c.models.find((m) => m.id === "opus"), { id: "opus", name: "Opus", now: "claude-opus-5-5", nowName: "Opus 5.5" });
    assert.deepEqual(c.models.find((m) => m.id === "sonnet"), { id: "sonnet", name: "Sonnet" });
    assert.deepEqual(c.models.find((m) => m.id === ""), { id: "", name: "", now: "claude-sonnet-5", nowName: "Sonnet 5" });
    assert.equal(c.default.model, "opus", "read with by default: the alias as kept, never the model it ran on");
    assert.ok((BRIDGE_FEATURES as readonly string[]).includes("read.choices.now"));
  } finally {
    w.cleanup();
  }
});
