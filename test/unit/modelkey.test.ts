// One key of an agent and its model (core/modelkey.ts): the model the agent said it ran on, one model written otherwise
// one key, another version another key, an alias asked going with the model it ran on (of its day) — for every agent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { aliasPair, calibrationKey, keyOf, keysFor, loadAliases, mergeAliases, modelId, normalKey, noteAliases, resolveKey, UNKNOWN_KEY, type Aliases } from "../../src/core/modelkey.ts";
import { aliasPairsOf, canonicalUnits, emptyBook, groups, type Unit } from "../../src/core/readstats.ts";

test("one model written otherwise is one key: Claude Code's context mark, a snapshot's date, capitals, NFD", () => {
  assert.equal(modelId("claude", "claude-opus-5-5[1m]"), "claude-opus-5-5");
  assert.equal(modelId("claude", " Claude-Opus-5-5 "), "claude-opus-5-5");
  assert.equal(modelId("claude", "claude-opus-4-1-20250805"), "claude-opus-4-1");
  assert.equal(modelId("claude", "<synthetic>"), undefined);
  assert.equal(modelId("codex", "gpt-6-astra"), "gpt-6-astra");
  // a model's name in another script, decomposed: NFC
  assert.equal(modelId("opencode", "místní/módel"), "místní/módel".normalize("NFC"));
  assert.equal(calibrationKey("claude", "claude-opus-5-5[1m]"), "claude claude-opus-5-5");
  assert.equal(calibrationKey("antigravity", undefined), "antigravity");
  assert.equal(normalKey("claude Claude-Opus-5-5[1m]"), "claude claude-opus-5-5");
  assert.equal(normalKey("unknown"), UNKNOWN_KEY);
});

test("an alias goes with the model it ran on, for every agent; another version is another key", () => {
  const at = "2026-10-10T10:00:00.000Z";
  // Claude Code: the alias of strom's setting, the model id of its init
  assert.deepEqual(aliasPair("claude opus", "claude-opus-5-5[1m]", at), { asked: "claude opus", key: "claude claude-opus-5-5", at });
  // a model the agent fell back to is none of the alias
  assert.equal(aliasPair("claude opus", "claude-sonnet-5", at), undefined);
  assert.deepEqual(aliasPair("claude default", "claude-sonnet-5", at)?.key, "claude claude-sonnet-5");
  // Codex with no model asked: the one its config gives; Grok's setting and the build it runs as
  assert.deepEqual(aliasPair("codex", "gpt-6-astra", at)?.key, "codex gpt-6-astra");
  assert.equal(aliasPair("codex gpt-6-astra", "gpt-6-astra", at), undefined, "the key itself: no alias");
  assert.deepEqual(aliasPair("grok grok-4.7", "grok-4.7-build", at)?.key, "grok grok-4.7-build");
  // OpenCode's provider/model, said without its provider
  assert.deepEqual(aliasPair("opencode anthropic/claude-opus-5-5", "claude-opus-5-5", at)?.key, "opencode claude-opus-5-5");
  // Antigravity says no model: its key stays the agent alone
  assert.equal(keyOf("antigravity", undefined, {}), "antigravity");
  // opus 5 and opus 5.5 never one key
  assert.notEqual(keyOf("claude opus", "claude-opus-5", {}), keyOf("claude opus", "claude-opus-5-5", {}));
});

test("an alias resolved by the model of its day; a lookup without a time by the one it runs on now", () => {
  const a: Aliases = {};
  assert.ok(mergeAliases(a, [{ asked: "claude opus", key: "claude claude-opus-5", at: "2026-06-01T00:00:00.000Z" }, { asked: "claude opus", key: "claude claude-opus-5-5", at: "2026-09-01T00:00:00.000Z" }]));
  assert.equal(mergeAliases(a, [{ asked: "claude opus", key: "claude claude-opus-5-5", at: "2026-09-05T00:00:00.000Z" }]), false, "seen again later: nothing new");
  assert.equal(resolveKey("claude opus", a), "claude claude-opus-5-5");
  assert.equal(resolveKey("claude opus", a, "2026-07-01T00:00:00.000Z"), "claude claude-opus-5");
  assert.equal(resolveKey("claude opus", a, "2026-01-01T00:00:00.000Z"), "claude claude-opus-5", "before any seen: the first");
  assert.equal(resolveKey("claude sonnet", a), "claude sonnet", "an alias nobody saw run: its own key");
  // the key a record keeps for a key: its own, and the names an older strom kept it under
  const rec = { "claude opus": { reported: "claude-opus-5-5" }, "claude claude-opus-5-5": {}, "codex gpt-x": {} };
  assert.deepEqual(keysFor(rec, "claude claude-opus-5-5", a, (v) => (v as { reported?: string }).reported), ["claude claude-opus-5-5", "claude opus"]);
});

test("the history joined: units of one model under one key whatever key they were kept under — the same again changes nothing", () => {
  const unit = (id: string, key: string, reported?: string, at = "2026-10-01T00:00:00.000Z"): Unit => ({ id, kind: "reader", at, key, ...(reported ? { reported } : {}), books: { B0001: { ...emptyBook(), scans: 2, views: 3 } }, hosts: {} });
  const units = [
    unit("old-1", "claude claude-opus-5-5", "claude-opus-5-5"),
    unit("new-1", "claude opus", "claude-opus-5-5[1m]"),
    // a conversation that said no model: its alias, by the model of its day
    { ...unit("chat-1", "claude opus"), kind: "session" as const },
    unit("grok-1", "grok grok-4.7", "grok-4.7-build"),
    unit("codex-1", "codex", "gpt-6-astra"),
  ];
  const a: Aliases = {};
  mergeAliases(a, aliasPairsOf(units));
  canonicalUnits(units, a);
  assert.deepEqual(units.map((u) => [u.id, u.key, u.asked]), [
    ["old-1", "claude claude-opus-5-5", undefined],
    ["new-1", "claude claude-opus-5-5", "claude opus"],
    ["chat-1", "claude claude-opus-5-5", "claude opus"],
    ["grok-1", "grok grok-4.7-build", "grok grok-4.7"],
    ["codex-1", "codex gpt-6-astra", "codex"],
  ]);
  const before = JSON.stringify(units);
  canonicalUnits(units, a);
  assert.equal(JSON.stringify(units), before, "idempotent");
  const g = groups(units, Date.parse("2026-10-10T00:00:00.000Z")).find((x) => x.key === "claude claude-opus-5-5")!;
  assert.equal(g.units.length, 3, "one group, the model said written otherwise no split");
  assert.equal(g.reported, "claude-opus-5-5");
});

test("the aliases of a research: kept whole, found also in what an older strom kept beside an alias", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom klíče ž "));
  try {
    assert.deepEqual(loadAliases(root), {});
    // a state of before: kept under the alias with the model it was set for
    fs.mkdirSync(path.join(root, ".strom", "tune"), { recursive: true });
    fs.writeFileSync(path.join(root, ".strom", "tune", "state.json"), JSON.stringify({ "claude opus": { reported: "claude-opus-5-5", books: { B0001: { find: { id: "T1", at: "2026-10-01T00:00:00.000Z" } } }, hosts: {} } }));
    assert.equal(resolveKey("claude opus", loadAliases(root)), "claude claude-opus-5-5");
    noteAliases(root, [{ asked: "grok grok-4.7", key: "grok grok-4.7-build", at: "2026-10-02T00:00:00.000Z" }]);
    const file = JSON.parse(fs.readFileSync(path.join(root, ".strom", "metrics", "models.json"), "utf8"));
    assert.equal(file.version, 1);
    assert.deepEqual(file.aliases["grok grok-4.7"], [{ key: "grok grok-4.7-build", at: "2026-10-02T00:00:00.000Z" }]);
    assert.deepEqual(fs.readdirSync(path.join(root, ".strom", "metrics")), ["models.json"], "written whole: nothing left beside it");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
