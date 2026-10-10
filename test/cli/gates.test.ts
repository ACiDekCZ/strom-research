// Gates: the user's condition on the agent working alone (strom run --loop).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { opts, agent, world } from "./gates.helpers.ts";

test("a gate is asked before each session: go on, then stop — the run ends and says why", opts, async () => {
  const w = await world([{ code: 0 }, { code: 0, say: { reason: "dost místa" } }, { code: 2, say: { reason: "týden je z 90 % pryč" } }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true });
  const r = await w.ok(["run", "--agent", "script", "--loop", "--json"]);
  assert.equal(r.json.sessions.length, 2);
  assert.equal(r.json.stop, "gate");
  assert.match(r.json.stopped, /podmínka „Zkouška“ řekla dost — týden je z 90 % pryč/);
  assert.deepEqual(r.json.gate.answers.map((a: { verdict: string }) => a.verdict), ["go", "go", "stop"]);
  assert.equal(r.json.gate.answers[1].reason, "dost místa");
  assert.match(r.err, /· podmínka: Zkouška — ptá se před každým sezením/);
  // what strom told the gate: sessions so far, the next task, the research language, the agent
  const asked = fs.readFileSync(path.join(w.gate, "asked.txt"), "utf8").trim().split("\n");
  assert.deepEqual(asked.map((l) => l.split(" ")[0]), ["0", "1", "2"]);
  assert.match(asked[0]!, /^0 T000\d cs script$/);
  w.cleanup();
});

test("a gate that says wait past --until ends the run; one that fails stops it — never spending blind", opts, async () => {
  const w = await world([{ code: 1, say: { reason: "sezení je plné", wait: 7200 } }, { code: 7 }, { code: 0, say: "not JSON, just words" }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true });
  const soon = new Date(Date.now() + 60 * 60_000);
  const until = `${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`;
  const waited = await w.ok(["run", "--agent", "script", "--loop", "--until", until, "--json"]);
  assert.equal(waited.json.sessions.length, 0);
  assert.equal(waited.json.stop, "time");
  const failed = await w.run(["run", "--agent", "script", "--loop", "--json"]);
  assert.equal(failed.code, 1);
  assert.equal(failed.json.stop, "gate.error");
  assert.match(failed.json.stopped, /neodpověděla, jak má — skončila s kódem 7/, "strom's own words in the research language");
  // words instead of JSON are the reason
  const said = await w.ok(["gate", "test", "--json"]);
  assert.deepEqual(said.json, { gate: "zkouska", verdict: "go", reason: "not JSON, just words" });
  w.cleanup();
});

test("tasks the user starts themselves: the gate is asked once, and when it would not start, the user decides", opts, async () => {
  const w = await world([{ code: 1, say: { reason: "sezení je plné", wait: 7200 } }, { code: 1, say: { reason: "sezení je plné", wait: 7200 } }, { code: 2 }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true });
  // no: nothing starts, and the run says why
  const no = await w.ok(["run", "--agent", "script", "--max", "2"], { tty: true, answers: ["n"] });
  assert.match(no.out, /podmínka: Zkouška — tyto úkoly jsou spuštěné ručně/);
  assert.match(no.out, /Podmínka „Zkouška“ by teď nespouštěla — sezení je plné\. Spustit přesto\? \(a\/n\)/);
  assert.match(no.out, /nespuštěno — podmínka „Zkouška“: sezení je plné/);
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0001.json")));
  // yes: both sessions run, the gate is not asked again
  const yes = await w.ok(["run", "--agent", "script", "--max", "2"], { tty: true, answers: ["a"] });
  assert.match(yes.out, /■ N0002 closed/);
  assert.ok(fs.existsSync(path.join(w.cwd, "data", "sessions", "N0002.json")));
  assert.equal(fs.readFileSync(path.join(w.gate, "asked.txt"), "utf8").trim().split("\n").length, 2, "asked once per run");
  // a gate that says stop: the same question, no says no
  const stop = await w.ok(["run", "--agent", "script"], { tty: true, answers: [""] });
  assert.match(stop.out, /Spustit přesto\? \(a\/n\) \[n\]/, "no is suggested");
  assert.match(stop.out, /nespuštěno — podmínka „Zkouška“: ne/);
  w.cleanup();
});

test("tasks started by an agent or a script: nobody to ask there — an agent needs the user's yes, a script keeps to the gate", opts, async () => {
  const w = await world([{ code: 1, say: { reason: "sezení je plné" } }, { code: 1, say: { reason: "sezení je plné" } }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true });
  const script = await w.ok(["run", "--agent", "script", "--json"]);
  assert.equal(script.json.stop, "gate.declined");
  w.env.CLAUDECODE = "1";
  const agent = await w.run(["run", "--agent", "script"]);
  assert.equal(agent.code, 4);
  assert.match(agent.err + agent.out, /an agent cannot answer this/);
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0001.json")));
  w.cleanup();
});

test("strom gate test says its answer in the research's language: go on, wait until, stop with its cap, an error — no English line in a Czech tree", opts, async () => {
  const w = await world([
    { code: 0 },
    { code: 1, say: { reason: "týden je plný", wait: 7200 } },
    { code: 2, say: { reason: "strop dosažen", hard: true } },
    { code: 7 },
    { code: 2, say: { reason: "Woche voll", hard: true } },
  ]);
  const said = async (...more: string[]) => {
    const r = await w.run(["gate", "test", "zkouska", ...more]);
    return r.out;
  };
  assert.match(await said(), /^zkouska: pokračovat\n$/);
  assert.match(await said(), /^zkouska: počkat do .+ — týden je plný\n$/);
  assert.match(await said(), /^zkouska: zastavit — strop dosažen \(strop: pevné zastavení, žádné „přesto začít“\)\n$/);
  const error = await said();
  assert.match(error, /^zkouska: chyba – běh by se zastavil/);
  for (const out of [error]) assert.doesNotMatch(out, /go on|wait until|a run would stop|hard stop/);
  // the same in German
  assert.match(await said("--lang", "de"), /^zkouska: anhalten — Woche voll \(Obergrenze: ein fester Halt, kein „trotzdem starten“\)\n$/);
  w.cleanup();
});
