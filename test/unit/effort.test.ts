// The reasoning effort of the sessions strom starts (agents/effort.ts): the person's model.effort as each agent's own
// switch, and — where strom sets none — what Codex's own config.toml says, read (never written) and said.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { agentSettingsSaid, effortArgs, hasEffort, offeredEfforts, readCodexConfig } from "../../src/agents/effort.ts";
import { agentSettingsLine } from "../../src/cli/model-choice.ts";
import { codexArgs, codexResumeArgs } from "../../src/runners/codex.ts";
import { claudeArgs } from "../../src/runners/claude.ts";
import { antigravityArgs } from "../../src/runners/antigravity.ts";
import { grokArgs } from "../../src/runners/grok.ts";
import { conversationArgs } from "../../src/agents/launch.ts";
import { Settings } from "../../src/core/config.ts";

function codexHome(toml: string | undefined): { env: Record<string, string>; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom codex ě "));
  if (toml !== undefined) fs.writeFileSync(path.join(dir, "config.toml"), toml);
  return { env: { CODEX_HOME: dir, HOME: dir }, dir };
}

test("Codex's config.toml: the top level, the profile it selects (which wins), quoted names, comments, no file", () => {
  const { env, dir } = codexHome(
    [
      "# the person's own",
      'model = "gpt-model-x" # a comment',
      "model_reasoning_effort = 'low'",
      'profile = "deep work"',
      "",
      "[sandbox_workspace_write]",
      'model_reasoning_effort = "none"',
      "",
      '[profiles."deep work"]',
      'model_reasoning_effort = "xhigh"',
      "",
      "[profiles.fast]",
      'model = "gpt-mini"',
      "model_reasoning_effort = minimal",
    ].join("\n"),
  );
  try {
    assert.deepEqual(readCodexConfig(env), { file: path.join(dir, "config.toml"), profile: "deep work", model: "gpt-model-x", modelFrom: "top", effort: "xhigh", effortFrom: "profile" });
    assert.deepEqual(readCodexConfig(env, "fast"), { file: path.join(dir, "config.toml"), profile: "fast", model: "gpt-mini", modelFrom: "profile", effort: "minimal", effortFrom: "profile" });
    assert.equal(readCodexConfig(env, "nonexistent").effort, "low", "a profile it does not have: the top level");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const none = codexHome(undefined);
  assert.deepEqual(readCodexConfig(none.env), { file: path.join(none.dir, "config.toml") });
  fs.rmSync(none.dir, { recursive: true, force: true });
});

test("what a Codex session runs with, said: strom's setting, the run's own switch, config.toml, Codex's own default", () => {
  const { env, dir } = codexHome('model_reasoning_effort = "low"\n');
  try {
    const shown = (p: string) => p.replace(dir, "~/.codex");
    const unset = agentSettingsSaid(env, "codex", {});
    assert.deepEqual([unset.effort, unset.effortFrom, unset.modelFrom], ["low", "config", "default"]);
    assert.equal(agentSettingsLine("en", unset, shown), "Codex: model Codex's own default, reasoning effort low — from ~/.codex/config.toml");
    assert.equal(agentSettingsLine("cs", unset, shown), "Codex: model výchozí nastavení agenta Codex, hloubka uvažování low – z ~/.codex/config.toml");
    const set = agentSettingsSaid(env, "codex", { model: "gpt-model-x", effort: "high" });
    assert.equal(agentSettingsLine("en", set, shown), "Codex: model gpt-model-x (strom's setting), reasoning effort high (strom's setting)");
    const args = agentSettingsSaid(env, "codex", { effort: "high", extraArgs: ["-c", "model_reasoning_effort=medium"] });
    assert.deepEqual([args.effort, args.effortFrom], ["medium", "args"]);
    // another agent: said only when strom sets its effort (its own settings are not read)
    assert.equal(agentSettingsLine("en", agentSettingsSaid(env, "claude", {}), shown), undefined);
    assert.equal(agentSettingsLine("en", agentSettingsSaid(env, "claude", { effort: "high" }), shown), "Claude Code: model Claude Code's own default, reasoning effort high (strom's setting)");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const none = codexHome(undefined);
  assert.equal(agentSettingsLine("en", agentSettingsSaid(none.env, "codex", {}), (p) => p), "Codex: model Codex's own default, reasoning effort Codex's own default");
  fs.rmSync(none.dir, { recursive: true, force: true });
});

test("the effort reaches each agent's command line as its own switch; none set, none passed", () => {
  const base = { cwd: "/t", permissions: "auto" as const, shared: undefined };
  const codex = codexArgs({ ...base, effort: "high" });
  assert.deepEqual(codex.slice(codex.indexOf("model_reasoning_effort=\"high\"") - 1, codex.indexOf("model_reasoning_effort=\"high\"") + 1), ["-c", 'model_reasoning_effort="high"']);
  assert.ok(codexResumeArgs("thread-1", { ...base, effort: "high" }).includes('model_reasoning_effort="high"'), "resumed for the wrap-up: the same effort");
  assert.ok(!codexArgs(base).some((a) => a.includes("model_reasoning_effort")), "unset: Codex's own config holds");
  const claude = claudeArgs({ interactive: false, kickoff: "k", effort: "high" });
  assert.deepEqual(claude.slice(claude.indexOf("--effort"), claude.indexOf("--effort") + 2), ["--effort", "high"]);
  assert.ok(!claudeArgs({ interactive: false, kickoff: "k" }).includes("--effort"));
  const agy = antigravityArgs({ effort: "xhigh" }, "first");
  assert.deepEqual(agy.slice(agy.indexOf("--effort"), agy.indexOf("--effort") + 2), ["--effort", "xhigh"]);
  const grok = grokArgs({ effort: "high" }, ["-p", "x"], []);
  assert.deepEqual(grok.slice(grok.indexOf("--reasoning-effort"), grok.indexOf("--reasoning-effort") + 2), ["--reasoning-effort", "high"]);
  // a conversation strom starts too
  const chat = conversationArgs("codex", { kickoff: "Ahoj", level: "auto", settingsFile: "/t/s.json", root: "/t", effort: "high" });
  assert.ok(chat.includes('model_reasoning_effort="high"'));
  assert.ok(conversationArgs("claude", { kickoff: "Ahoj", level: "auto", settingsFile: "/t/s.json", root: "/t", effort: "high" }).includes("--effort"));
  // an agent without a level of its own (OpenCode: its variant goes with the model), or a level it does not take: nothing
  assert.deepEqual(effortArgs("opencode", "high"), []);
  assert.deepEqual(effortArgs("claude", "minimal"), []);
  assert.ok(!hasEffort("opencode"));
});

test("offered: high first (recommended), then the others the agent takes", () => {
  assert.deepEqual(offeredEfforts("codex"), ["high", "xhigh", "medium", "low"]);
  assert.deepEqual(offeredEfforts("claude"), ["high", "xhigh", "medium", "low"]);
  assert.deepEqual(offeredEfforts("opencode"), []);
});

test("model.effort: per agent like the models, env over the user's, a level the agent does not take is none", () => {
  const s = new Settings({ STROM_CONFIG_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "strom cfg ")) }, {}, { models: { codex: { effort: "high" }, claude: { effort: "minimal" } } });
  assert.deepEqual(s.effort("codex"), { value: "high", source: "config" });
  assert.equal(s.effort("claude"), undefined, "minimal is no level of Claude Code's");
  assert.equal(s.effort("opencode"), undefined);
  const e = new Settings({ STROM_MODEL_EFFORT: "low" }, {}, { models: { codex: { effort: "high" } } });
  assert.deepEqual(e.effort("codex"), { value: "low", source: "env" });
  assert.deepEqual(s.models("codex"), {}, "no model tier from it");
});
