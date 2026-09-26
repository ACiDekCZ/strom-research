// Gates: the user's condition on the agent working alone (strom run --loop).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const agent = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

/** A tree with three tasks and a gate "zkouška" that answers from a list, one answer each time it is asked. */
async function world(answers: { code: number; say?: unknown }[]): Promise<World & { gate: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Josefa", "--new-person", "Josef /Novák/", "--sex", "M", "--born", "ABT 1885", "--born-place", "Kamenice nad Lipou"]);
  for (const what of ["Křest", "Oddavky", "Úmrtí"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  const gate = path.join(w.home, "shared", "plugins", "gates", "zkouska");
  fs.mkdirSync(gate, { recursive: true });
  fs.writeFileSync(path.join(gate, "gate.json"), JSON.stringify({ interface: 1, title: "Zkouška", command: ["node", "gate.ts"] }));
  fs.writeFileSync(path.join(gate, "answers.json"), JSON.stringify(answers));
  fs.writeFileSync(
    path.join(gate, "gate.ts"),
    `import fs from "node:fs";
const answers = JSON.parse(fs.readFileSync("answers.json", "utf8"));
const next = answers.shift() ?? { code: 0 };
fs.writeFileSync("answers.json", JSON.stringify(answers));
fs.appendFileSync("asked.txt", [process.env.STROM_SESSIONS, process.env.STROM_NEXT_TASK, process.env.STROM_LANG, process.env.STROM_AGENT].join(" ") + "\\n");
if (next.say !== undefined) console.log(typeof next.say === "string" ? next.say : JSON.stringify(next.say));
process.exit(next.code);
`,
  );
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "echo" });
  return Object.assign(w, { gate });
}

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
  assert.match(failed.json.stopped, /neodpověděla, jak má — exit status 7/);
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
  assert.match(no.out, /podmínka: Zkouška — tyto úkoly spouštíte vy/);
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
  assert.equal(Date.parse(full.until), soon.getTime() + 60_000);
  // the number reaches it from run.gate
  usage(10, 30);
  await w.ok(["config", "set", "run.gate", "claude-usage   20"], { tty: true });
  assert.equal((await w.ok(["config", "get", "run.gate"])).out.trim(), "claude-usage 20");
  assert.equal((await w.ok(["gate", "test", "--json"])).json.verdict, "wait");
  assert.equal((await ask("claude-usage x")).verdict, "stop", "not a number");
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\necho 'something else'\n", { mode: 0o755 });
  assert.equal((await ask("claude-usage 10")).verdict, "stop", "a form it cannot read: stop, never spend blind");
  w.cleanup();
});
