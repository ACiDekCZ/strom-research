// The reasoning effort of the sessions strom starts: the person's choice (model.effort, high recommended when the
// model is chosen), passed as the agent's own switch; unset, Codex's own config.toml holds and strom says so — in
// strom run, the session's log, doctor; recorded on the session and in the usage header. A stand-in codex on PATH
// prints a recorded stream and keeps its command line: nothing real is started.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { opts, world } from "./session.helpers.ts";

const stream = path.join(import.meta.dirname, "..", "fixtures", "agents", "codex-stream.jsonl");

/** A stand-in codex first on PATH, and Codex's own folder with its config.toml. */
function fakeCodex(w: World, toml: string): { argv: string; home: string } {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const argv = path.join(w.dir, "codex-argv.json");
  const script = path.join(bin, "codex.mjs");
  fs.writeFileSync(script, `import fs from "node:fs";\nfs.appendFileSync(${JSON.stringify(argv)}, JSON.stringify(process.argv.slice(2)) + "\\n");\nprocess.stdout.write(fs.readFileSync(${JSON.stringify(stream)}, "utf8"));\n`);
  fs.writeFileSync(path.join(bin, "codex"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "codex.cmd"), `@"${process.execPath}" "${script}" %*\r\n`);
  const home = path.join(w.dir, "codex home");
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, "config.toml"), toml);
  w.env.PATH = `${bin}${path.delimiter}${w.env.PATH}`;
  w.env.CODEX_HOME = home;
  return { argv, home };
}

const lastArgv = (file: string): string[] => JSON.parse(fs.readFileSync(file, "utf8").trim().split("\n").at(-1)!);

test("strom run with Codex: unset, its config.toml's effort said and recorded; set, passed as its own switch", { ...opts, skip: opts.skip || process.platform === "win32" }, async () => {
  const w = await world();
  const codex = fakeCodex(w, 'model_reasoning_effort = "low"\n');
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);

  const first = await w.run(["run", "--agent", "codex"]);
  assert.match(first.out, /Codex: model výchozí nastavení agenta Codex, hloubka uvažování low – z .*config\.toml/);
  assert.ok(!lastArgv(codex.argv).some((a) => a.includes("model_reasoning_effort")), "strom sets none: Codex's own config holds");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).effort, "low");
  assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "runs", "N0001.log"), "utf8"), /^strom: Codex: model Codex's own default, reasoning effort low — from .*config\.toml\n/);
  const head = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "usage", "N0001.jsonl"), "utf8").split("\n")[0]!);
  assert.deepEqual([head.effort, head.effortFrom], ["low", "config"]);

  await w.ok(["config", "set", "model.effort", "high", "--agent", "codex"]);
  await w.ok(["task", "add", "Křest Josefa", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  const second = await w.run(["run", "--agent", "codex", "--task", "T2"]);
  assert.match(second.out, /hloubka uvažování high \(nastavení strom\)/);
  const argv = lastArgv(codex.argv);
  assert.deepEqual(argv.slice(argv.indexOf('model_reasoning_effort="high"') - 1, argv.indexOf('model_reasoning_effort="high"') + 1), ["-c", 'model_reasoning_effort="high"']);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0002.json")).effort, "high");
  assert.equal(fs.readFileSync(path.join(codex.home, "config.toml"), "utf8"), 'model_reasoning_effort = "low"\n', "Codex's config never written");

  // doctor says it on Codex's line
  await w.ok(["config", "unset", "model.effort", "--agent", "codex"]);
  assert.match((await w.run(["doctor"])).out, /Codex: model výchozí nastavení agenta Codex, hloubka uvažování low – z /);
  w.cleanup();
});

test("model.effort: a level the agent does not take is refused with its own; OpenCode has none", opts, async () => {
  const w = new World();
  await w.withTree();
  const bad = await w.run(["config", "set", "model.effort", "minimal", "--agent", "claude"]);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /low, medium, high, xhigh, max/);
  const none = await w.run(["config", "set", "model.effort", "high", "--agent", "opencode"]);
  assert.equal(none.code, 2);
  assert.match(none.err, /provider\/model#high/);
  assert.equal((await w.run(["config", "set", "model.effort", "huge", "--agent", "codex"])).code, 2);
  w.cleanup();
});

test("the model chosen in a terminal: its effort offered with high first, Enter takes it; 0 changes nothing; anybody else told how", opts, async () => {
  const w = new World();
  await w.withTree();
  const asked = await w.run(["config", "set", "model.lead", "gpt-model-x", "--agent", "codex"], { tty: true, answers: [""] });
  assert.equal(asked.code, 0, asked.err);
  assert.match(asked.out, /Jak hluboce má Codex uvažovat, než odpoví/);
  assert.match(asked.out, /^ {3}1 {2}high – doporučeno: staré rukopisy se čtou s nejlepším nastavením; limit předplatného dojde dřív \(v testu došel po 18 minutách i na low\)$/m);
  assert.match(asked.out, /Nechat na vlastním nastavení agenta Codex/);
  assert.equal((await w.ok(["config", "get", "model.effort", "--agent", "codex", "--json"])).json.value, "high");
  // 0: what is stays
  await w.ok(["config", "set", "model.lead", "gpt-model-y", "--agent", "codex"], { tty: true, answers: ["0"] });
  assert.equal((await w.ok(["config", "get", "model.effort", "--agent", "codex", "--json"])).json.value, "high");
  // an agent sets the model: no question, the way said
  await w.ok(["config", "unset", "model.effort", "--agent", "claude"]);
  const told = await w.ok(["config", "set", "model.lead", "opus", "--agent", "claude"]);
  assert.match(told.out, /reasoning effort: the agent's own — strom config set model\.effort high/);
  w.cleanup();
});
