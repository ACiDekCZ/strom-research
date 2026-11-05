// strom run with OpenCode that ends with exit code 1 after it closed its session itself, its last step ended normally
// and nothing else said wrong: the session counts as done, the run goes on to the next task, the exit code kept in the
// session's log. The same exit code beside an error event, error text, a signal, or with the session left open stays
// an error that stops the run.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readJsonFile } from "../helpers.ts";
import { opts, world } from "./session.helpers.ts";

const unix = { skip: opts.skip || process.platform === "win32" };

/** A stand-in OpenCode: closes the strom session (unless OC_MODE=open), says its steps, ends with exit code 1. */
function fakeOpencode(dir: string): string {
  const bin = path.join(dir, "oc-bin");
  fs.mkdirSync(bin, { recursive: true });
  const script = path.join(bin, "opencode.mjs");
  fs.writeFileSync(
    script,
    [
      'import { spawnSync } from "node:child_process";',
      "const mode = process.env.OC_MODE ?? 'clean';",
      "for await (const _ of process.stdin);",
      'const sid = "ses_" + process.env.STROM_SESSION;',
      'const ev = (o) => process.stdout.write(JSON.stringify({ sessionID: sid, ...o }) + "\\n");',
      'ev({ type: "step_start", part: { type: "step-start" } });',
      'if (mode !== "open") spawnSync("strom", ["session", "close", "--continue", "--summary", "Lhota prošlá", "--next", "další kniha", "--reason", "nothing more to do in this session"], { env: process.env, encoding: "utf8" });',
      'ev({ type: "tool_use", part: { type: "tool", tool: "bash", state: { status: "completed", input: { command: "strom session close" } } } });',
      'ev({ type: "step_finish", part: { type: "step-finish", reason: "tool-calls", cost: 0, tokens: { input: 100, output: 10, reasoning: 0, cache: { read: 0, write: 0 } } } });',
      'ev({ type: "text", part: { type: "text", text: "Hotovo." } });',
      'ev({ type: "step_finish", part: { type: "step-finish", reason: "stop", cost: 0, tokens: { input: 50, output: 5, reasoning: 0, cache: { read: 0, write: 0 } } } });',
      'if (mode === "error-event") ev({ type: "error", error: { name: "UnknownError", data: { message: "Lhoták: the stream broke" } } });',
      'if (mode === "stderr") process.stderr.write("Error: the stream broke\\n");',
      'if (mode === "signal") process.kill(process.pid, "SIGTERM");',
      "else process.exitCode = 1;",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(path.join(bin, "opencode"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
  return bin;
}

async function twoTasks(mode: string) {
  const w = await world();
  await w.ok(["task", "add", "Křest Lhotáka", "--level", "locate", "--where", "farnost Lhota", "--why", "zkouška", "--done-when", "hotovo"]);
  await w.ok(["task", "add", "Sňatek Lhotáka", "--level", "locate", "--where", "farnost Lhota", "--why", "zkouška", "--done-when", "hotovo"]);
  w.env.PATH = `${fakeOpencode(w.dir)}${path.delimiter}${w.env.PATH}`;
  w.env.OC_MODE = mode;
  const r = await w.run(["run", "--agent", "opencode", "--max", "2", "--json"]);
  return { w, r };
}

test("OpenCode's exit code 1 after the session it closed itself: done, the run goes on, the exit code in the log", unix, async () => {
  const { w, r } = await twoTasks("clean");
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.json.sessions.length, 2, "on to the next session");
  for (const s of r.json.sessions) {
    assert.equal(s.outcome, "ok");
    assert.equal(s.agentExit, 1);
  }
  assert.notEqual(r.json.stop, "failed");
  assert.match(r.err, /N0001: agent sezení uzavřel a pak skončil s kódem 1 — bráno jako hotové, běh pokračuje/);
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, "closed");
  assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0002.json")).state, "closed");
  assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "runs", "N0001.log"), "utf8"), /\[strom\] the agent's process ended with exit code 1 after it closed the session/);
  w.cleanup();
});

for (const [mode, why] of [
  ["open", "the session left open"],
  ["error-event", "an error event"],
  ["stderr", "error text on stderr"],
  ["signal", "a signal"],
] as const)
  test(`OpenCode's exit code 1 with ${why}: an error, the run stops`, unix, async () => {
    const { w, r } = await twoTasks(mode);
    assert.equal(r.code, 1, r.out + r.err);
    assert.equal(r.json.stop, "failed");
    assert.equal(r.json.sessions.length, 1);
    assert.equal(r.json.sessions[0].outcome, "error");
    assert.equal(r.json.sessions[0].agentExit, undefined);
    assert.equal(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).state, mode === "open" ? "interrupted" : "closed");
    w.cleanup();
  });
