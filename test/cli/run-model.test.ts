// An agent that does not take the model strom started it with (Codex: HTTP 400 "model is not supported", OpenCode:
// 410 "no longer available") stops the run with a sentence of what to do — never only the agent's raw error.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { looksLikeModelRejected } from "../../src/runners/runner.ts";
import { opts, world } from "./session.helpers.ts";

test("a model the agent refuses: said, with the setting to change", opts, async () => {
  const w = await world();
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  const script = path.join(w.dir, "agent-model.mjs");
  fs.writeFileSync(script, `process.stderr.write('ERROR: unexpected status 400 Bad Request: {"detail":"The \\'gpt-old\\' model is not supported when using Codex with a ChatGPT account."}\\n'); process.exit(1);\n`);
  w.env.STROM_RUNNER_SCRIPT = script;
  const r = await w.run(["run", "--agent", "script", "--model", "gpt-old", "--json"]);
  assert.equal(r.code, 1);
  assert.equal(r.json.stop, "model");
  assert.match(r.json.stopped, /script nepřijímá model gpt-old – zvolit jiný: strom config set model\.lead <model>/);
  // the task waits for the next run, nothing lost
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "tasks", "T0001.json"), "utf8")).state, "open");
  w.cleanup();
});

test("what an agent says of a model it refuses — and what is no such thing", () => {
  for (const said of [
    "The 'gpt-old' model is not supported when using Codex with a ChatGPT account.",
    "410 Gone: model openai/gpt-4-turbo is no longer available",
    'Error: {"code":"model_not_found","message":"The model `x` does not exist"}',
    "API Error: 404 unknown model: claude-old",
  ])
    assert.ok(looksLikeModelRejected(said), said);
  for (const said of ["Error: network timeout", "the agent failed: exit 1", "permission denied for strom"]) assert.ok(!looksLikeModelRejected(said), said);
});
