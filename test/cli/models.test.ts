// The model of the research for every agent: the strong ones of the agent's own list offered (the setup wizard, the
// menu's settings), a built-in list when the agent's cannot be had, kept per agent (model.lead) — and that model given
// to every run, reader and conversation of that agent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { BUILTIN_MODELS, modelChoices, parseAntigravity, parseCodex, parseGrok, parseOpencode, strongModels } from "../../src/agents/models.ts";

const unix = { skip: !hasGit || process.platform === "win32" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

/** What the agents printed when asked for their models (2026-10-09). */
const AGY = `Fetching available models...
gemini-3.8-flash-high\tGemini 3.8 Flash (High)
gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)
gemini-3.8-flash-low\tGemini 3.8 Flash (Low)
gemini-3.7-flash-high\tGemini 3.7 Flash (High)
gemini-3.1-pro-high\tGemini 3.1 Pro (High)
gemini-3.1-pro-low\tGemini 3.1 Pro (Low)
claude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)
claude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)
gpt-oss-120b-medium\tGPT-OSS 120B (Medium)
`;
const OPENCODE = [
  "openai/gpt-5.3-codex-spark", "openai/gpt-5.5", "openai/gpt-5.5-fast", "openai/gpt-5.6-luna", "openai/gpt-5.6-sol", "openai/gpt-5.6-sol-fast",
  "openai/gpt-5.6-terra", "openai/gpt-6-astra", "openai/gpt-6-astra-fast", "openai/gpt-6-astra-ultrafast", "openai/gpt-6-luna", "openai/gpt-6-sol",
  "openai/gpt-6-sol-fast", "openai/gpt-6.1-sol", "openai/gpt-6.1-sol-fast", "opencode/big-pickle", "opencode/exo-free", "opencode/ling-3.1-flash-free",
].join("\n");
const GROK = "You are logged in with grok.com.\n\nDefault model: grok-4.7\n\nAvailable models:\n  * grok-4.7 (default)\n  - grok-4.7-build-fast\n  - grok-4.6\n  - grok-4.5\n";
const CODEX = JSON.stringify({
  models: [
    { slug: "gpt-6-astra", display_name: "GPT-6-Astra", description: "Frontier intelligence for the most demanding work.", visibility: "list", priority: 2 },
    { slug: "gpt-6-sol", display_name: "GPT-6-Sol", description: "Previous generation workhorse model.", visibility: "list", priority: 3 },
    { slug: "gpt-6-luna", display_name: "GPT-6-Luna", description: "Fast and affordable model for easier tasks.", visibility: "list", priority: 4 },
    { slug: "gpt-reserve", display_name: "GPT-Reserve", description: "Fast and affordable agentic coding model.", visibility: "hide", priority: 4 },
    { slug: "gpt-5.6-sol", display_name: "GPT-5.6-Sol", description: "Older generation workhorse model.", visibility: "list", priority: 5 },
    { slug: "codex-auto-review", display_name: "Codex Auto Review", description: "Automatic approval review model for Codex.", visibility: "hide", priority: 43 },
  ],
});

test("the strong models of each agent's own list: never a flash, mini, fast or cheap one; the strongest line first, the agent's own maker first", () => {
  const ids = (l: { id: string }[]) => l.map((m) => m.id);
  assert.deepEqual(ids(strongModels(parseAntigravity(AGY))), ["gemini-3.1-pro-high", "claude-opus-4-6-thinking", "claude-sonnet-4-6"]);
  assert.equal(strongModels(parseAntigravity(AGY))[0]!.label, "Gemini 3.1 Pro (High)");
  assert.deepEqual(ids(strongModels(parseOpencode(OPENCODE))), ["openai/gpt-6-astra", "openai/gpt-6.1-sol", "openai/gpt-6-sol"]);
  assert.deepEqual(parseGrok(GROK).agentDefault, "grok-4.7");
  assert.deepEqual(ids(strongModels(parseGrok(GROK).models)), ["grok-4.7", "grok-4.6"]);
  assert.deepEqual(ids(strongModels(parseCodex(CODEX))), ["gpt-6-astra", "gpt-6-sol"], "hidden ones and those its maker calls fast, affordable or older left out");
  // nothing strong in a list: nothing (the built-in one is offered instead)
  assert.deepEqual(strongModels([{ id: "x-flash" }, { id: "y-mini" }, { id: "z-nano" }, { id: "claude-haiku-4-5" }]), []);
  assert.deepEqual(parseCodex("not json"), []);
  // a name in another script, decomposed: words split on letters of any script, never [a-z]
  assert.deepEqual(ids(strongModels([{ id: "модель-pro-2", label: "Модель Pro".normalize("NFD") }, { id: "модель-lite-3" }])), ["модель-pro-2"]);
  // strom's own lists hold strong ones only
  for (const list of Object.values(BUILTIN_MODELS)) assert.deepEqual(ids(strongModels(list, 9)), ids(list));
});

/** A PATH with git and fake agents; each prints `out` for its list command and notes every start. */
function fakes(w: World, agents: Record<string, string>): void {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git && !fs.existsSync(path.join(bin, "git"))) fs.symlinkSync(git, path.join(bin, "git"));
  for (const [name, script] of Object.entries(agents)) fs.writeFileSync(path.join(bin, name), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  w.env.PATH = `${bin}${path.delimiter}/bin${path.delimiter}/usr/bin`;
}

function listing(w: World, name: string, out: string, argsOfList: string): string {
  const file = path.join(w.dir, `${name}.list`);
  fs.writeFileSync(file, out);
  return `if [ "$*" = "${argsOfList}" ]; then cat "${file}"; exit 0; fi\necho "$*" >> "${path.join(w.dir, `${name}.calls`)}"\nexit 0`;
}

const config = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));

test("the setup wizard: Antigravity's own list — the strong ones offered (Gemini Pro suggested, no Flash), kept for Antigravity; again: the one kept suggested, 0 keeps it", unix, async () => {
  const w = new World();
  fakes(w, { agy: listing(w, "agy", AGY, "models") });
  // language, folder, model (Enter: the suggested one), its effort (Enter: high, recommended), stories, level, no shortcut
  const r = await w.ok(["setup"], { answers: ["en", "", "", "", "", "", "n"] });
  assert.match(r.out, /How deeply should Antigravity CLI reason before it answers \(its reasoning effort\)\?\n {3}1 {2}high — recommended: old handwriting read with the best setting; the plan's limit runs out sooner \(in a test it ran out after 18 minutes even on low\)\n {3}2 {2}xhigh[^\n]*\n {3}3 {2}medium\n {3}4 {2}low[^\n]*\n {3}5 {2}Leave it to Antigravity CLI's own setting\nChoose \[1\]/);
  assert.match(r.out, /Which model should do the research in Antigravity CLI\? The strongest read old handwriting best — they use up a subscription sooner or cost more\.\n {3}1 {2}Gemini 3\.1 Pro \(High\) · gemini-3\.1-pro-high \(recommended\)\n {3}2 {2}Claude Opus 4\.6 \(Thinking\) · claude-opus-4-6-thinking\n {3}3 {2}Claude Sonnet 4\.6 \(Thinking\) · claude-sonnet-4-6\n {3}4 {2}Leave it to the agent\nChoose \[1\]/);
  assert.doesNotMatch(r.out, /Flash|GPT-OSS/);
  assert.doesNotMatch(r.out, /choose its best model, not a fast or mini one/, "a model chosen: no word to choose one in the agent");
  assert.deepEqual(config(w).models, { antigravity: { lead: "gemini-3.1-pro-high", effort: "high" } });
  // again: Opus picked; then 0 keeps it
  await w.ok(["setup"], { answers: ["", "", "2", "0", "", "", "n"] });
  assert.equal(config(w).models.antigravity.lead, "claude-opus-4-6-thinking");
  const again = await w.ok(["setup"], { answers: ["", "", "0", "0", "", "", "n"] });
  assert.match(again.out, /Leave it to the agent\n {3}0 {2}Keep it as it is\nChoose \[2\]/);
  assert.equal(config(w).models.antigravity.lead, "claude-opus-4-6-thinking");
  // the agent's own, its own effort too: nothing kept, the word to choose a strong one in the agent
  const own = await w.ok(["setup"], { answers: ["", "", "4", "5", "", "", "n"] });
  assert.match(own.out, /choose its best model, not a fast or mini one/);
  assert.equal(config(w).models, undefined);
  w.cleanup();
});

test("the setup wizard: an agent that gives no list (a failure, or one that hangs) — strom's own list, the wizard never waits long; Codex's own default named", unix, async () => {
  const w = new World();
  fakes(w, { codex: "exit 1" });
  fs.mkdirSync(path.join(w.env.HOME!, ".codex"), { recursive: true });
  fs.writeFileSync(path.join(w.env.HOME!, ".codex", "config.toml"), 'model = "gpt-6.1-sol"\nmodel_reasoning_effort = "low"\n\n[features]\nmodel = "no"\n');
  const r = await w.ok(["setup"], { answers: ["en", "", "2", "", "", "", "", "n"] });
  // its effort: what its config.toml says now named beside the agent's own
  assert.match(r.out, / 5 {2}Leave it to Codex's own setting \(now low — from [^\n]*config\.toml\)\n/);
  assert.match(r.out, /Which model should do the research in OpenAI Codex CLI\?[^\n]*\n {3}1 {2}gpt-6-astra \(recommended\)\n {3}2 {2}gpt-6-sol\n {3}3 {2}Leave it to the agent \(now gpt-6\.1-sol\)\n/);
  assert.equal(config(w).models.codex.lead, "gpt-6-sol");
  w.cleanup();

  const h = new World();
  fakes(h, { opencode: "sleep 30" });
  h.env.STROM_MODELS_TIMEOUT_MS = "300";
  const started = Date.now();
  const o = await h.ok(["setup"], { answers: ["en", "", "", "", "", "n"] });
  assert.ok(Date.now() - started < 15_000, "not held by the agent");
  assert.match(o.out, / 1 {2}openai\/gpt-6-astra \(recommended\)/);
  assert.equal(config(h).models.opencode.lead, "openai/gpt-6-astra");
  h.cleanup();
});

test("Claude Code's choice as it was: Opus, Sonnet or the agent's own — no list asked for", unix, async () => {
  const w = new World();
  fakes(w, { claude: `echo "$*" >> "${path.join(w.dir, "claude.calls")}"\nexit 0` });
  const r = await w.ok(["setup"], { answers: ["en", "", "2", "", "", "", "", "n"] });
  assert.match(r.out, /Which model should do the research\?\n {3}1 {2}Opus — best at reading old handwriting \(recommended\)\n {3}2 {2}Sonnet — faster; printed documents and everyday work\n {3}3 {2}Leave it to the agent\n/);
  assert.deepEqual(config(w).models, { claude: { lead: "sonnet", effort: "high" } });
  assert.ok(!fs.existsSync(path.join(w.dir, "claude.calls")), "Claude Code not started to list anything");
  w.cleanup();
});

test("the menu's settings: the research's model — the agent's strong ones, the one kept suggested, 0 changes nothing; a tree's own model changed in the tree; nothing in an archive", unix, async () => {
  const w = new World();
  fakes(w, { grok: listing(w, "grok", GROK, "models") });
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  w.cwd = w.treeDir("Novákovi");
  // 8 settings · 7 the model: 2 grok-4.6 · 0 · 0
  const r = await w.ok([], { tty: true, answers: ["8", "7", "2", "0", "0"] });
  assert.match(r.out, / 6 {2}Výzkum, nebo jen archiv[^\n]*\n {3}7 {2}Model výzkumu \(Grok Build\): vlastní model agenta\n/);
  assert.match(r.out, /Který model má v Grok Build dělat výzkum\?[^\n]*\n {3}1 {2}grok-4\.7 \(doporučeno\)\n {3}2 {2}grok-4\.6\n {3}3 {2}Nechat na agentovi \(teď grok-4\.7\)\n {3}0 {2}Zpět\nVybrat \[3\]/);
  assert.equal(config(w).models.grok.lead, "grok-4.6");
  // 0: nothing changed
  const back = await w.ok([], { tty: true, answers: ["8", "7", "0", "0", "0"] });
  assert.match(back.out, /Model výzkumu \(Grok Build\): grok-4\.6/);
  assert.match(back.out, /Vybrat \[2\]/);
  assert.equal(config(w).models.grok.lead, "grok-4.6");
  // the tree's own model: changed there, this computer's stays
  await w.ok(["config", "set", "model.lead", "grok-4.5", "--for-tree"]);
  await w.ok([], { tty: true, answers: ["8", "7", "1", "0", "0"] });
  assert.equal(readJsonFile(path.join(w.cwd, "strom.json")).models.grok.lead, "grok-4.7");
  assert.equal(config(w).models.grok.lead, "grok-4.6");
  // an archive: nothing of a model
  await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  const a = await w.ok([], { tty: true, answers: ["8", "0", "0"] });
  assert.doesNotMatch(a.out, /Model výzkumu|Který model/);
  w.cleanup();
});

/** Fake headless agents: each notes its arguments and STROM_MODEL, reads its stdin, ends. */
function headless(w: World, names: string[]): void {
  const bin = path.join(w.dir, "bin");
  for (const n of names)
    fs.writeFileSync(path.join(bin, n), `#!/bin/sh\nprintf 'ARGS %s STROM_MODEL=%s\\n' "$*" "$STROM_MODEL" >> "${path.join(w.dir, `${n}.calls`)}"\ncat > /dev/null\nexit 0\n`, { mode: 0o755 });
}

/** The agent was given this model: "--model <model>" among its arguments. */
function hasModel(call: string, model: string): boolean {
  const args = call.replace(/^ARGS /, "").replace(/ STROM_MODEL=\S*$/, "").split(" ");
  return args.some((a, i) => a === "--model" && args[i + 1] === model);
}

function lastCall(w: World, name: string): string {
  const file = path.join(w.dir, `${name}.calls`);
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n") : [];
  fs.rmSync(file, { force: true });
  return lines.at(-1) ?? "";
}

test("the model kept for an agent reaches every run, reader and conversation of it — Antigravity, Codex, OpenCode and Grok; a tree's own wins", unix, async () => {
  const w = new World();
  fakes(w, {});
  headless(w, ["codex", "agy", "opencode", "grok"]);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  w.cwd = w.treeDir("Novákovi");
  const kept: [string, string, string][] = [
    ["antigravity", "agy", "gemini-3.1-pro-high"],
    ["codex", "codex", "gpt-6-sol"],
    ["opencode", "opencode", "openai/gpt-6-astra"],
    ["grok", "grok", "grok-4.6"],
  ];
  for (const [agent, , model] of kept) {
    const set = await w.ok(["config", "set", "model.lead", model, "--agent", agent, "--json"]);
    assert.deepEqual([set.json.agent, set.json.value], [agent, model]);
  }
  assert.match((await w.ok(["config", "set", "model.lead", "grok-4.6", "--agent", "grok"])).out, /model\.lead = grok-4\.6 \(agent grok\)/);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["recordset", "add", "Kniha N 1847-1868", "--kinds", "baptism", "--places", "Kamenice", "--years", "1847-1868"]);
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  for (const [agent, command, model] of kept) {
    // working alone
    await w.ok(["task", "add", `Křest (${agent})`, "--level", "locate", "--where", "farnost Sloup", "--why", "zkouška", "--done-when", "hotovo"]);
    await w.run(["run", "--agent", agent]);
    const run = lastCall(w, command);
    assert.ok(hasModel(run, model), `${agent} run: ${run}`);
    assert.ok(run.endsWith(` STROM_MODEL=${model}`), `${agent} run: the model for what strom does inside the session — ${run}`);
    // a reader: model.vision, never weaker than the research's — the agent's own default never in its place
    await w.run(["read", "B1", "--images", "1", "--question", "Křty Nováků", "--agent", agent]);
    const read = lastCall(w, command);
    assert.ok(hasModel(read, model), `${agent} reader: ${read}`);
    // a conversation in the terminal (OpenCode's takes the model from the tree's opencode.json)
    const chat = (await w.ok(["chat", "--print", "--agent", agent, "--where", "terminal", "--json"])).json;
    if (agent === "opencode") assert.equal(readJsonFile(path.join(w.cwd, "opencode.json")).model, model);
    else assert.ok(chat.args.join(" ").includes(`--model ${model}`), `${agent} chat: ${chat.args.join(" ")}`);
  }
  // the tree's own model for Antigravity wins over this computer's
  await w.ok(["config", "set", "model.lead", "claude-opus-4-6-thinking", "--agent", "antigravity", "--for-tree"]);
  await w.ok(["task", "add", "Oddavky", "--level", "locate", "--where", "farnost Sloup", "--why", "zkouška", "--done-when", "hotovo"]);
  await w.run(["run", "--agent", "antigravity"]);
  assert.ok(hasModel(lastCall(w, "agy"), "claude-opus-4-6-thinking"));
  // Codex's desktop app takes no model from outside: the one chosen is named for the person to pick there
  const apps = path.join(w.dir, "apps");
  fs.mkdirSync(path.join(apps, "Codex.app"), { recursive: true });
  w.env.STROM_APP_DIRS = apps;
  assert.match((await w.ok(["chat", "--agent", "codex", "--where", "app"])).out, /V aplikaci ChatGPT \(Codex\) zvolit pro výzkum model gpt-6-sol \(zvolený v nastavení\)\./);
  w.cleanup();
});

test("modelChoices: no agent here — strom's list; an agent without a list command (Claude Code) — its aliases", async () => {
  const env = { HOME: "/nonexistent", PATH: "" };
  assert.deepEqual(await modelChoices("antigravity", env), { models: BUILTIN_MODELS.antigravity, source: "builtin" });
  assert.deepEqual((await modelChoices("claude", env)).models.map((m) => m.id), ["opus", "sonnet"]);
});
