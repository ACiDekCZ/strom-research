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

  await w.ok(["config", "set", "model.effort", "high", "--agent", "codex"], { tty: true });
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

test("model.effort is raised by the person alone (a higher effort uses up the plan's limits sooner); lowering it is anyone's, no variable sets it", { ...opts, skip: opts.skip || process.platform === "win32" }, async () => {
  const w = await world();
  const codex = fakeCodex(w, 'model_reasoning_effort = "medium"\n');
  const effort = async (agent = "codex") => (await w.ok(["config", "get", "model.effort", "--agent", agent, "--json"])).json.value;
  // an agent: higher than Codex's own medium — refused, the command for the person said
  w.env.CLAUDECODE = "1";
  const refused = await w.run(["config", "set", "model.effort", "xhigh", "--agent", "codex"]);
  assert.equal(refused.code, 4, refused.out + refused.err);
  assert.match(refused.out + refused.err, /an agent cannot answer this/);
  assert.match(refused.out + refused.err, /strom config set model\.effort xhigh --agent codex/);
  assert.equal((await w.run(["config", "set", "model.effort", "high", "--agent", "codex", "--for-tree"])).code, 4, "nor for the tree");
  assert.equal((await w.run(["config", "set", "model.effort", "high", "--agent", "claude"])).code, 4, "nor above the agents' usual default");
  // lowering: anyone's
  await w.ok(["config", "set", "model.effort", "low", "--agent", "codex"]);
  assert.equal(await effort(), "low");
  // back to Codex's own (medium) from low: higher again, the person's
  assert.equal((await w.run(["config", "unset", "model.effort", "--agent", "codex"])).code, 4);
  delete w.env.CLAUDECODE;

  // the person at the terminal: no extra question, as the menu's settings and the wizard
  await w.ok(["config", "set", "model.effort", "xhigh", "--agent", "codex"], { tty: true });
  assert.equal(await effort(), "xhigh");
  // a person's script without a terminal or a window: needs the person too
  assert.equal((await w.run(["config", "set", "model.effort", "max", "--agent", "codex"])).code, 4);
  w.env.CLAUDECODE = "1";
  await w.ok(["config", "set", "model.effort", "high", "--agent", "codex", "--for-tree"]);
  assert.equal(await effort(), "high", "the tree's, lower than the user's: anyone's");
  // removing the tree's lower value lets the user's higher one hold again: the person's
  assert.equal((await w.run(["config", "unset", "model.effort", "--agent", "codex", "--for-tree"])).code, 4);
  // no variable raises it
  w.env.STROM_MODEL_EFFORT = "max";
  assert.equal(await effort(), "high");
  delete w.env.STROM_MODEL_EFFORT;

  // a run of an agent with a higher effort by the agent's own switch: the person's; the same or lower runs
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  const up = await w.run(["run", "--agent", "codex", "--", "-c", "model_reasoning_effort=xhigh"]);
  assert.equal(up.code, 4, up.out + up.err);
  assert.match(up.out + up.err, /strom run -- -c "?model_reasoning_effort=xhigh/);
  assert.ok(!fs.existsSync(codex.argv), "nothing started");
  const same = await w.run(["run", "--agent", "codex", "--", "-c", "model_reasoning_effort=low"]);
  assert.ok(fs.existsSync(codex.argv), same.out + same.err);
  delete w.env.CLAUDECODE;
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
