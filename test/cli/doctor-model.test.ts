// strom doctor and the model of the research: none chosen, the agent works with its own — said as a warning when strom
// knows that one is weak (a fast or small one) or refused (not in Codex's catalog for the account), with the command
// that chooses one. Never set by strom: the model is the person's choice.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { ownModel, weakModel } from "../../src/agents/models.ts";

const opts = { skip: !hasGit };

/** A stand-in codex on PATH (never started by doctor) and Codex's own folder with its config.toml and catalog. */
function codex(w: World, toml: string, catalog?: string[]): string {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "codex"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "codex.cmd"), "@exit /b 0\r\n");
  const home = path.join(w.dir, "codex home");
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, "config.toml"), toml);
  if (catalog) fs.writeFileSync(path.join(home, "models_cache.json"), JSON.stringify({ models: catalog.map((slug, i) => ({ slug, priority: i })) }));
  w.env.PATH = `${bin}${path.delimiter}${w.env.PATH}`;
  w.env.CODEX_HOME = home;
  return home;
}

const modelCheck = (json: { checks: { name: string; status: string; detail: string; fix?: string; code?: string }[] }) => json.checks.find((c) => c.name === "model");

test("weak and refused own models: by name and description, by Codex's catalog; nothing known, nothing said", () => {
  for (const id of ["gpt-6-mini", "gemini-3.1-flash", "claude-haiku-4-5", "grok-4.7-fast"]) assert.ok(weakModel({ id }), id);
  for (const id of ["gpt-6-astra", "claude-opus-5-5", "claude-sonnet-4-6", "gemini-3.1-pro-high"]) assert.ok(!weakModel({ id }), id);
  assert.ok(weakModel({ id: "gpt-x", about: "A cheap model for simple work" }));
  const w = new World();
  const env = { ...w.env, CODEX_HOME: path.join(w.dir, "codex") };
  fs.mkdirSync(env.CODEX_HOME);
  assert.equal(ownModel("codex", env), undefined, "no config.toml, nothing seen: nothing known");
  fs.writeFileSync(path.join(env.CODEX_HOME, "config.toml"), 'model = "gpt-6.1-sol"\n');
  assert.deepEqual(ownModel("codex", env), { model: "gpt-6.1-sol", from: "config", weak: false, refused: false }, "no catalog: never said refused");
  fs.writeFileSync(path.join(env.CODEX_HOME, "models_cache.json"), JSON.stringify({ models: [{ slug: "gpt-6-astra" }, { slug: "gpt-6-sol" }, { slug: "gpt-6-terra", visibility: "hide" }] }));
  assert.equal(ownModel("codex", env)?.refused, true);
  fs.writeFileSync(path.join(env.CODEX_HOME, "config.toml"), 'model = "gpt-6-terra"\n');
  assert.deepEqual(ownModel("codex", env), { model: "gpt-6-terra", from: "config", weak: true, refused: false }, "hidden in its list, still its own: weak, not refused");
  // another agent: what the research saw it run on alone; Antigravity names none, its own is a Flash one
  assert.deepEqual(ownModel("claude", env, { claude: [{ key: "claude claude-haiku-4-5", at: "2026-10-01T00:00:00Z" }] }), { model: "claude-haiku-4-5", from: "seen", weak: true, refused: false });
  assert.equal(ownModel("claude", env, {}), undefined);
  assert.equal(ownModel("antigravity", env)?.weak, true);
  w.cleanup();
});

test("strom doctor: the agent's own model weak or refused, none chosen — a warning with the command; chosen, said as it is", opts, async () => {
  const w = new World();
  await w.withTree();
  const home = codex(w, 'model = "gpt-6-mini"\n', ["gpt-6-astra", "gpt-6-sol", "gpt-6-mini"]);
  await w.ok(["config", "set", "agent", "codex"]);
  const weak = await w.run(["doctor"]);
  assert.match(weak.out, /model pro výzkum není zvolen: OpenAI Codex CLI pracuje se svým, gpt-6-mini – rychlým či malým, na staré rukopisy slabým {2}→ strom config set model\.lead <model>/);
  const json = modelCheck((await w.run(["doctor", "--json"])).json);
  assert.deepEqual([json?.status, json?.code, json?.fix], ["warn", "model.own.weak", "strom config set model.lead <model>"]);

  fs.writeFileSync(path.join(home, "config.toml"), 'model = "gpt-6.1-sol"\n');
  assert.match((await w.run(["doctor"])).out, /OpenAI Codex CLI pracuje se svým, gpt-6\.1-sol, který v jeho seznamu pro tento účet není – odmítl by ho/);
  assert.equal(modelCheck((await w.run(["doctor", "--json"])).json)?.code, "model.own.refused");

  // its own a strong one: nothing said of the model
  fs.writeFileSync(path.join(home, "config.toml"), 'model = "gpt-6-astra"\n');
  assert.equal(modelCheck((await w.run(["doctor", "--json"])).json), undefined);

  // chosen for the research: said as it is, never a warning; nothing of Codex's written
  fs.writeFileSync(path.join(home, "config.toml"), 'model = "gpt-6-mini"\n');
  await w.ok(["config", "set", "model.lead", "gpt-6-astra", "--agent", "codex"]);
  assert.deepEqual(modelCheck((await w.run(["doctor", "--json"])).json), { name: "model", label: "model", status: "ok", detail: "gpt-6-astra" });
  assert.equal(fs.readFileSync(path.join(home, "config.toml"), "utf8"), 'model = "gpt-6-mini"\n');

  // another research language: the person's words in it
  await w.ok(["config", "unset", "model.lead", "--agent", "codex"]);
  const de = await w.run(["doctor"], { env: { STROM_LANG: "de" } });
  assert.match(de.out, /für die Forschung ist kein Modell gewählt: OpenAI Codex CLI arbeitet mit dem eigenen, gpt-6-mini/);
  w.cleanup();
});
