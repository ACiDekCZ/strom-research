// Gates: the user's condition on the agent working alone (strom run --loop).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { opts, agent, world } from "./gates.helpers.ts";

test("--loop without a gate works while there is work; --no-gate goes round it", opts, async () => {
  const w = await world([{ code: 2, say: { reason: "ne" } }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true });
  const r = await w.ok(["run", "--agent", "script", "--loop", "--no-gate", "--json"]);
  assert.equal(r.json.stop, "empty", "on until the queue is empty");
  assert.ok(r.json.sessions.length >= 3);
  assert.equal(r.json.gate, undefined);
  assert.ok(!fs.existsSync(path.join(w.gate, "asked.txt")), "never asked");
  w.cleanup();
});

test("the gate is the user's: an agent neither sets, removes nor goes round it; a gate that is not there is said at once", opts, async () => {
  const w = await world([]);
  const bad = await w.run(["config", "set", "run.gate", "nikde"], { tty: true });
  assert.notEqual(bad.code, 0);
  assert.match(bad.err, /no gate "nikde"/);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true });
  w.env.CLAUDECODE = "1";
  for (const args of [["config", "unset", "run.gate"], ["config", "set", "run.gate", "claude-usage"], ["run", "--agent", "script", "--no-gate"], ["config", "set", "agent.remote", "on"]]) {
    const r = await w.run(args);
    assert.equal(r.code, 4, args.join(" "));
    assert.match(r.err + r.out, /an agent cannot answer this/);
  }
  delete w.env.CLAUDECODE;
  assert.equal((await w.ok(["config", "get", "run.gate"])).out.trim(), "zkouska");
  // strom's own gates and the interface are there to use
  const list = await w.ok(["gate", "list", "--json"]);
  assert.deepEqual(list.json.gates.map((g: { name: string }) => g.name), ["claude-usage", "zkouska"]);
  assert.equal(list.json.gate, "zkouska");
  assert.ok(fs.existsSync(path.join(w.home, "shared", "plugins", "gates", "README.md")));
  w.cleanup();
});

test("the menu offers working on while the gate allows it — only with a gate set", opts, async () => {
  const w = await world([{ code: 0 }, { code: 2, say: { reason: "stačí" } }]);
  Object.assign(w.env, { STROM_AGENT: "script" });
  const without = await w.ok([], { tty: true, answers: ["2", "0", "0"] });
  assert.doesNotMatch(without.out, /dovolí to podmínka/);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true });
  const r = await w.ok([], { tty: true, answers: ["2", "3", "", "0"] });
  assert.match(r.out, /3 {2}Nechat ho pracovat, dokud je co dělat a dovolí to podmínka „Zkouška“/);
  assert.match(r.out, /podmínka „Zkouška“ řekla dost — stačí/);
  assert.ok(fs.existsSync(path.join(w.cwd, "data", "sessions", "N0001.json")));
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0002.json")));
  w.cleanup();
});

test("claude-usage <n>: the daily ration — a session starts only while the week's usage is n points behind the week gone", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await world([]);
  await w.ok(["gate", "list"]); // strom puts its gates there
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const reset = (d: Date) => `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()} at ${d.getUTCHours() % 12 || 12}${d.getUTCHours() < 12 ? "am" : "pm"} (UTC)`;
  const hour = (h: number) => new Date(Math.ceil((Date.now() + h * 3_600_000) / 3_600_000) * 3_600_000);
  const soon = hour(2);
  const week = hour(4 * 24); // 3 of 7 days gone: ~42 %
  const start = week.getTime() - 7 * 86_400_000;
  const usage = (session: number, used: number) =>
    fs.writeFileSync(
      path.join(bin, "claude"),
      `#!/bin/sh\n[ "$*" = "-p /usage" ] || exit 9\ncat <<'X'\nYou are currently using your subscription to power your Claude Code usage\n\nCurrent session: ${session}% used · resets ${reset(soon)}\nCurrent week (all models): ${used}% used · resets ${reset(week)}\nCurrent week (Fable): 0% used · resets ${reset(week)}\nX\n`,
      { mode: 0o755 },
    );
  w.env.PATH = `${bin}${path.delimiter}${w.env.PATH}`;
  const ask = async (spec: string) => (await w.ok(["gate", "test", spec, "--json"])).json;
  usage(10, 30);
  const go = await ask("claude-usage 10");
  assert.equal(go.verdict, "go");
  assert.match(go.reason, /^týden: využito 30 %, uplynulo 4\d %, náskok 1\d \(potřeba aspoň 10\)$/);
  assert.equal((await ask("claude-usage")).verdict, "go", "0 without a number: no faster than the week");
  // 20 in hand needed, ~12 there: wait until the week gone reaches 30 + 20 = 50 %
  const ahead = await ask("claude-usage 20");
  assert.equal(ahead.verdict, "wait");
  assert.match(ahead.reason, /náskok 1\d \(potřeba aspoň 20\) — dokud čas nedožene/);
  assert.ok(Math.abs(Date.parse(ahead.until) - (start + 0.5 * 7 * 86_400_000)) < 1000);
  // used past the week gone: it waits, with no number too
  usage(10, 60);
  assert.equal((await ask("claude-usage")).verdict, "wait");
  // near the end of the week's budget: past the reset, the new week's share
  usage(10, 95);
  const next = await ask("claude-usage 14");
  // (to the millisecond: a share of a week is not a whole number of them)
  assert.ok(Math.abs(Date.parse(next.until) - (week.getTime() + 0.14 * 7 * 86_400_000)) <= 1);
  // a used-up session: until it resets
  usage(100, 10);
  const full = await ask("claude-usage 10");
  assert.equal(full.verdict, "wait");
  // (to the millisecond: the reset is read back from a time in seconds and fractions)
  assert.ok(Math.abs(Date.parse(full.until) - (soon.getTime() + 60_000)) <= 1, full.until);
  // the number reaches it from run.gate
  usage(10, 30);
  await w.ok(["config", "set", "run.gate", "claude-usage   20"], { tty: true });
  assert.equal((await w.ok(["config", "get", "run.gate"])).out.trim(), "claude-usage 20");
  assert.equal((await w.ok(["gate", "test", "--json"])).json.verdict, "wait");
  assert.equal((await ask("claude-usage x")).verdict, "stop", "not a number");
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\necho 'something else'\n", { mode: 0o755 });
  const unread = await ask("claude-usage 10");
  assert.equal(unread.verdict, "stop", "a form it cannot read: stop, never spend blind");
  // why, in the research language — the gate's own words too, never an English detail in a Czech research
  assert.equal(unread.reason, "nelze přečíst `claude -p /usage`: chybí řádek „Current week … resets …“");
  // what the program itself said is data: said as it is; nothing said, the gate says how it ended
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\necho 'Error: not logged in' >&2\nexit 3\n", { mode: 0o755 });
  assert.equal((await ask("claude-usage 10")).reason, "nelze přečíst `claude -p /usage`: Error: not logged in");
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 3\n", { mode: 0o755 });
  assert.equal((await ask("claude-usage 10")).reason, "nelze přečíst `claude -p /usage`: skončilo s kódem 3");
  w.cleanup();
});

test("a run waiting for its gate is paused, not at work: the Strom app hears until when and why", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await world([{ code: 1, say: { reason: "týden je z 92 % pryč", wait: 7200 } }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true });
  // a real run (a signal reaches it, not the test runner), waiting for the gate
  const child = spawn(process.execPath, [path.join(import.meta.dirname, "..", "..", "src", "cli.ts"), "run", "--agent", "script", "--loop"], { cwd: w.cwd, env: w.env, stdio: "ignore" });
  const exited = new Promise((resolve) => child.on("exit", resolve));
  const workers = path.join(w.cwd, ".strom", "workers");
  const paused = () => (fs.existsSync(workers) ? fs.readdirSync(workers).filter((f) => f.endsWith(".paused")) : []);
  for (const t0 = Date.now(); !paused().length; ) {
    assert.ok(Date.now() - t0 < 20_000, "the run never waited");
    await new Promise((r) => setTimeout(r, 100));
  }
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await (await fetch(`${info.url}/status`)).json()) as { working: { who: string; task?: string; paused?: { until: string; reason?: string } }[] };
    const run = status.working.find((x) => x.paused);
    assert.ok(run, JSON.stringify(status.working));
    assert.equal(run.paused!.reason, "týden je z 92 % pryč");
    assert.ok(Math.abs(Date.parse(run.paused!.until) - (Date.now() + 7200_000)) < 60_000, run.paused!.until);
    assert.equal(run.task, undefined, "no session while it waits");
    assert.match(run.who, / – samostatná práce$/, "who works: in the research language");
  } finally {
    await w.ok(["live", "stop"]);
  }
  // stopped while it waits: it is no longer paused
  child.kill("SIGTERM");
  await exited;
  assert.deepEqual(paused(), []);
  w.cleanup();
});

test("the Strom app follows a run from its first session on — never while the gate holds it back", opts, async () => {
  const w = await world([{ code: 2, say: { reason: "týden je pryč" } }]);
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true });
  const held = await w.ok(["run", "--agent", "script", "--loop", "--follow"]);
  assert.match(held.out + held.err, /podmínka „Zkouška“ řekla dost/);
  assert.doesNotMatch(held.out + held.err, /Aplikace Strom/, "no session: the app not opened");
  // sessions: the app opened once, as the first began (a test opens nothing for real)
  const r = await w.ok(["run", "--agent", "script", "--max", "2", "--no-gate", "--follow"], { tty: true });
  const said = r.out + r.err;
  assert.equal(said.match(/Aplikace Strom se otevřela/g)?.length, 1, said);
  assert.ok(said.indexOf("Aplikace Strom se otevřela") < said.indexOf("▶ N0001"), said);
  w.cleanup();
});
