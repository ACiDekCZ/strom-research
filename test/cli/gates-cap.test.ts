// A cap on the agent's plan (run.gate "claude-usage 15 --cap 95"): what Claude Code says of its limits while it works
// (rate_limit_event) is kept for the gate; a gate with a cap is asked before every session of every run, its hard stop
// ends the run with no "start anyway"; a session at work is asked to finish near the cap's window's end. No cap: as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readJsonFile } from "../helpers.ts";
import { opts, world } from "./gates.helpers.ts";
import { limitsOf } from "../../src/runners/claude.ts";
import { mergeLimits } from "../../src/runners/runner.ts";
import { askFinish } from "../../src/core/clock.ts";

const unix = { skip: opts.skip || process.platform === "win32" };
const WATCH = { kind: "seven_day", finish: 0.99 };

test("the limits in Claude Code's stream: each window of unifiedWindows, a rejected one full, anything else nothing", () => {
  const at = new Date("2026-10-10T03:00:00Z");
  const reset = 1791979200;
  const allowed = { type: "rate_limit_event", rate_limit_info: { status: "allowed", rateLimitType: "five_hour", resetsAt: 1791609000, unifiedWindows: { five_hour: { utilization: 0.02, resetsAt: 1791609000 }, seven_day: { utilization: 0.07, resetsAt: reset } } } };
  assert.deepEqual(limitsOf(allowed, at), [
    { kind: "five_hour", used: 0.02, resetsAt: new Date(1791609000_000).toISOString(), at: at.toISOString() },
    { kind: "seven_day", used: 0.07, resetsAt: new Date(reset * 1000).toISOString(), at: at.toISOString() },
  ]);
  // only the event's own limit, without the windows
  assert.deepEqual(limitsOf({ type: "rate_limit_event", rate_limit_info: { status: "allowed_warning", rateLimitType: "seven_day", utilization: 0.97, resetsAt: reset } }, at), [
    { kind: "seven_day", used: 0.97, resetsAt: new Date(reset * 1000).toISOString(), at: at.toISOString() },
  ]);
  // rejected: that window is full whatever number it carries
  const rejected = limitsOf({ type: "rate_limit_event", rate_limit_info: { status: "rejected", rateLimitType: "seven_day", resetsAt: reset, unifiedWindows: { seven_day: { utilization: 0.98, resetsAt: reset } } } }, at);
  assert.equal(rejected?.[0]?.used, 1);
  // unknown shapes, kinds and other events: nothing made up
  for (const msg of [
    { type: "rate_limit_event" },
    { type: "rate_limit_event", rate_limit_info: "full" },
    { type: "rate_limit_event", rate_limit_info: { unifiedWindows: { monthly: { utilization: 0.5 } }, rateLimitType: "opus_weekly", utilization: 0.4 } },
    { type: "rate_limit_event", rate_limit_info: { unifiedWindows: { seven_day: { utilization: "97 %" } } } },
    { type: "result", rate_limit_info: { unifiedWindows: { seven_day: { utilization: 0.5 } } } },
  ])
    assert.equal(limitsOf(msg as Record<string, unknown>, at), undefined, JSON.stringify(msg));
  // the latest of each kind
  const a = limitsOf(allowed, at)!;
  const b = [{ kind: "seven_day" as const, used: 0.5, at: at.toISOString() }];
  assert.deepEqual(mergeLimits(a, b)!.map((l) => [l.kind, l.used]), [["five_hour", 0.02], ["seven_day", 0.5]]);
  assert.equal(mergeLimits(a, undefined), a);
});

/** The gates' world with Claude Code as a fake that says its limits: FAKE_WEEK, then FAKE_WEEK_LATE; and what it heard. */
async function capWorld(answers: { code: number; say?: unknown }[]) {
  const w = await world(answers);
  // the test gate notes what strom told it of the agent's limits too
  const gateTs = path.join(w.gate, "gate.ts");
  fs.writeFileSync(gateTs, fs.readFileSync(gateTs, "utf8").replace("process.env.STROM_AGENT].join", 'process.env.STROM_AGENT, process.env.STROM_AGENT_LIMITS ?? "-"].join'));
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const heard = path.join(w.dir, "claude.heard");
  const reset = Math.floor(Date.now() / 1000) + 3 * 86_400;
  fs.writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/sh
cat > /dev/null
event() { echo '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed_warning","rateLimitType":"seven_day","utilization":'"$1"',"resetsAt":${reset},"unifiedWindows":{"five_hour":{"utilization":0.2,"resetsAt":${reset}},"seven_day":{"utilization":'"$1"',"resetsAt":${reset}}}}}'; }
echo '{"type":"system","subtype":"init","model":"m","tools":["Task","Bash","Read","Edit","Write","WebFetch","WebSearch","ToolSearch","SendMessage"]}'
event "\${FAKE_WEEK:-0.5}"
[ -n "\${FAKE_WEEK_LATE:-}" ] && event "$FAKE_WEEK_LATE"
sleep 1
cat "$PWD/.strom/finish/$STROM_SESSION.json" >> "${heard}" 2>/dev/null || echo "no finish" >> "${heard}"
echo '{"type":"result","result":"done","total_cost_usd":0.01,"num_turns":1}'
`,
    { mode: 0o755 },
  );
  w.env.PATH = `${bin}${path.delimiter}${w.env.PATH}`;
  await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true });
  const asked = () => fs.readFileSync(path.join(w.gate, "asked.txt"), "utf8").trim().split("\n");
  const said = () => (fs.existsSync(heard) ? fs.readFileSync(heard, "utf8") : "");
  return Object.assign(w, { asked, said });
}

test("a cap: asked before every session of a run the user started (--max), its hard stop ends the run saying why; near the cap's end the session is asked to finish", unix, async () => {
  const w = await capWorld([
    { code: 0, say: { reason: "týden 80 %", watch: WATCH } },
    { code: 2, say: { reason: "týden 99 % – strop 95 %", hard: true, watch: WATCH } },
  ]);
  const r = await w.ok(["run", "--agent", "claude", "--max", "3", "--json"], { env: { FAKE_WEEK: "0.8", FAKE_WEEK_LATE: "0.995" } });
  assert.equal(r.json.stop, "gate.cap", r.err);
  assert.equal(r.json.sessions.length, 1, "no session past the cap");
  assert.match(r.json.stopped, /strop podmínky „Zkouška“ – týden 99 % – strop 95 % \(pevná hranice z run\.gate; „přesto začít“ ji nepřekročí\)/);
  assert.match(r.err, /Zkouška: nastavený strop – kontroluje se před každým sezením/);
  assert.match(r.err, /⏳ N0001: limit agenta na 99 % \(týden\) – sezení dostalo žádost zapsat, co našlo, a skončit/);
  // the agent heard it from its next strom command: asked by the limit, which one and how much
  assert.match(w.said(), /"by":"limit","why":"week 99 % used"/);
  // the gate: nothing known before the first session, then what the agent said last
  const [first, second] = w.asked();
  assert.match(first!, / -$/);
  const limits = JSON.parse(second!.slice(second!.indexOf("[")));
  assert.deepEqual(limits.map((l: { kind: string; used: number }) => [l.kind, l.used]), [["five_hour", 0.2], ["seven_day", 0.995]]);
  // the session the limit asked to finish is no user's ending
  assert.notEqual(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).endedBy, "user");
  w.cleanup();
});

test("a cap's hard stop: no “start anyway” before the first session either, and --task runs keep to it", unix, async () => {
  const w = await capWorld([
    { code: 2, say: { reason: "týden 97 % – strop 95 %", hard: true, watch: WATCH } },
    { code: 0, say: { reason: "týden 50 %", watch: WATCH } },
    { code: 1, say: { reason: "týden 96 % – strop 95 %", hard: true, watch: WATCH, wait: 3600 } },
  ]);
  const first = await w.ok(["run", "--agent", "claude", "--max", "2"], { tty: true, answers: ["a"] });
  assert.doesNotMatch(first.out, /Spustit přesto/);
  assert.match(first.out, /strop podmínky „Zkouška“ – týden 97 % – strop 95 %/);
  assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0001.json")));
  // tasks picked by hand: asked again before the second; a hard "wait" ends it too
  const picked = await w.ok(["run", "--agent", "claude", "--task", "T1,T2", "--json"], { env: { FAKE_WEEK: "0.5" } });
  assert.equal(picked.json.stop, "gate.cap");
  assert.equal(picked.json.sessions.length, 1);
  assert.equal(w.asked().length, 3);
  assert.match(w.said(), /^no finish$/m, "below 99 %: the session went on as always");
  w.cleanup();
});

test("no cap: the gate of a run the user started is asked once and a nearly full week asks no session to finish", unix, async () => {
  const w = await capWorld([{ code: 1, say: { reason: "týden 96 %", wait: 3600 } }]);
  const r = await w.ok(["run", "--agent", "claude", "--max", "2"], { tty: true, answers: ["a"], env: { FAKE_WEEK_LATE: "0.995" } });
  assert.match(r.out, /Spustit přesto\? \(a\/n\)/);
  assert.match(r.out, /■ N0002 /);
  assert.equal(w.asked().length, 1, "asked once per run");
  assert.doesNotMatch(r.out, /strop|limit agenta/);
  assert.equal(w.said().trim().split("\n").filter((l) => l === "no finish").length, 2);
  w.cleanup();
});

test("claude-usage --cap: reads what the agent said when fresh (no /usage), stops at the cap as a hard stop and says watch; without a cap as before", unix, async () => {
  const w = await world([]);
  await w.ok(["gate", "list"]); // strom puts its gates there
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const asked = path.join(w.dir, "usage.asked");
  // /usage: the week at 30 % — only when asked
  const reset = new Date(Math.ceil((Date.now() + 4 * 86_400_000) / 3_600_000) * 3_600_000);
  const resetText = `${reset.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${reset.getUTCDate()} at ${reset.getUTCHours() % 12 || 12}${reset.getUTCHours() < 12 ? "am" : "pm"} (UTC)`;
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\necho asked >> "${asked}"\ncat <<'X'\nCurrent session: 10% used · resets ${resetText}\nCurrent week (all models): 30% used · resets ${resetText}\nX\n`, { mode: 0o755 });
  const gate = path.join(w.home, "shared", "plugins", "gates", "claude-usage", "gate.ts");
  const run = (args: string[], limits?: unknown) => {
    const r = spawnSync(process.execPath, [gate, ...args], {
      encoding: "utf8",
      env: { ...w.env, PATH: `${bin}${path.delimiter}${w.env.PATH}`, STROM_LANG: "cs", STROM_AGENT: "claude", ...(limits ? { STROM_AGENT_LIMITS: JSON.stringify(limits) } : {}) },
    });
    return { code: r.status, said: JSON.parse(r.stdout.trim().split("\n").pop()!) };
  };
  const usageAsked = () => (fs.existsSync(asked) ? fs.readFileSync(asked, "utf8").trim().split("\n").length : 0);
  const fresh = (used: number, minutesAgo = 1) => [
    { kind: "five_hour", used: 0.1, resetsAt: reset.toISOString(), at: new Date(Date.now() - minutesAgo * 60_000).toISOString() },
    { kind: "seven_day", used, resetsAt: reset.toISOString(), at: new Date(Date.now() - minutesAgo * 60_000).toISOString() },
  ];
  // over the cap, from what the agent said: a hard stop with the use and the reset; /usage not asked
  const over = run(["15", "--cap", "95"], fresh(0.97));
  assert.equal(over.code, 2);
  assert.equal(over.said.hard, true);
  assert.deepEqual(over.said.watch, WATCH);
  assert.match(over.said.reason, /^týden: využito 97 % – strop 95 % dosažen; obnoví se /);
  assert.equal(usageAsked(), 0);
  // under it: the pace as before, the watch said
  const under = run(["0", "--cap=95"], fresh(0.2));
  assert.equal(under.code, 0);
  assert.deepEqual(under.said.watch, WATCH);
  assert.equal(under.said.hard, undefined);
  // what the agent said 20 minutes ago is stale: /usage is asked (30 %)
  const stale = run(["--cap", "95"], fresh(0.97, 20));
  assert.equal(stale.code, 0);
  assert.equal(usageAsked(), 1);
  // without a cap: no watch, no hard — as before
  const plain = run(["10"], fresh(0.97));
  assert.equal(plain.said.watch, undefined);
  assert.equal(plain.said.hard, undefined);
  assert.equal(plain.code, 1, "the pace still holds it");
  // a cap it cannot read: stop, said
  const bad = run(["10", "--cap", "dost"]);
  assert.equal(bad.code, 2);
  assert.match(bad.said.reason, /strop musí být 1 až 100/);
  // strom gate test says the cap — in the research's language (this tree's Czech), never an English line in it
  const test = await w.ok(["gate", "test", "claude-usage --cap 95"], { env: { PATH: `${bin}${path.delimiter}${w.env.PATH}`, STROM_AGENT: "claude" } });
  assert.match(test.out, /strop nastaven: ptá se před každým sezením každého běhu; sezení v práci je požádáno o dokončení při 99 % týdne/);
  assert.doesNotMatch(test.out, /cap set/);
  for (const [lang, said] of [["en", /cap set: asked before every session of every run; a session at work is asked to finish at 99 % of the week/], ["de", /Obergrenze gesetzt: vor jeder Sitzung jedes Laufs gefragt; eine laufende Sitzung wird bei 99 % der Woche um den Abschluss gebeten/]] as const)
    assert.match((await w.ok(["gate", "test", "claude-usage --cap 95", "--lang", lang], { env: { PATH: `${bin}${path.delimiter}${w.env.PATH}`, STROM_AGENT: "claude" } })).out, said);
  w.cleanup();
});

test("a session asked to finish by the limit: every strom command its agent runs says so, and no new reader starts", unix, async () => {
  const w = await capWorld([]);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  fs.copyFileSync(path.join(import.meta.dirname, "..", "fixtures", "images", "s0001.jpg"), path.join(scans, "s0001.jpg"));
  await w.ok(["recordset", "add", "Kniha Ř 1850–1860 / Книга", "--kinds", "baptism"]);
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  await w.ok(["session", "start", "T1"]);
  askFinish(w.cwd, "N0001", "limit", "week 99 % used");
  const agent = { env: { STROM_SESSION: "N0001", CLAUDECODE: "1" } };
  const said = await w.ok(["task", "list"], agent);
  assert.match(said.err, /⏳ the agent's usage limit is almost reached \(week 99 % used\): start nothing new — no reader, nothing delegated/);
  const read = await w.run(["read", "B1", "--images", "1", "--question", "Křty Nováků", "--agent", "claude"], agent);
  assert.notEqual(read.code, 0);
  assert.match(read.err, /session N0001 is asked to finish \(the agent's usage limit: week 99 % used\): no new reader starts/);
  // closed by its agent: the finish is done, and it was no user's ending
  await w.ok(["session", "close", "--continue", "--summary", "zapsáno", "--next", "dál"], agent);
  assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "finish", "N0001.json")));
  assert.notEqual(readJsonFile(path.join(w.cwd, "data", "sessions", "N0001.json")).endedBy, "user");
  w.cleanup();
});

test("a cap in run.gate is checked when it is set: a whole number 1 to 100, else said at once and nothing saved", opts, async () => {
  const w = await world([]);
  for (const spec of ["claude-usage 15 --cap 0", "claude-usage 15 --cap 101", "claude-usage 15 --cap", "claude-usage --cap=dost", "claude-usage --cap --x", "claude-usage --cap 9.5"]) {
    const r = await w.run(["config", "set", "run.gate", spec], { tty: true });
    assert.equal(r.code, 2, spec);
    assert.match(r.err, /--cap[^\n]*: the cap is a whole number from 1 to 100 — the % of the week a run never goes past/, spec);
    assert.match(r.err, /strom config set run\.gate "claude-usage 15 --cap 95"/, spec);
    assert.equal((await w.ok(["config", "get", "run.gate"])).out.trim(), "", `${spec}: nothing saved`);
  }
  // an agent hears it too, before any window is asked
  const asAgent = await w.run(["config", "set", "run.gate", "claude-usage 15 --cap 0"], { env: { CLAUDECODE: "1" } });
  assert.equal(asAgent.code, 2);
  // a gate test and a run say it the same
  assert.equal((await w.run(["gate", "test", "claude-usage --cap 0"])).code, 2);
  // right: saved
  await w.ok(["config", "set", "run.gate", "claude-usage 15 --cap 95"], { tty: true });
  assert.equal((await w.ok(["config", "get", "run.gate"])).out.trim(), "claude-usage 15 --cap 95");
  await w.ok(["config", "set", "run.gate", "claude-usage --cap=100"], { tty: true });
  w.cleanup();
});
