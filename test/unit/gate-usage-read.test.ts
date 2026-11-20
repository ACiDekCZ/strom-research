// The claude-usage gate reading `claude -p /usage`: the shapes Claude Code prints (no session line, a model's own week
// beside all models', a 24-hour clock, a time alone, an API key), an answer it cannot read asked again and then waited
// for — never a stop for one answer — with the first line it got in the reason, and a Claude Code not logged in said
// with how to log in (found 2026-11-03: CLAUDE_CONFIG_DIR=~/.claude, /usage a bare /cost, the run stopped at once).
// A stand-in `claude` of the test's own: never the real one. The gate's clock fixed (STROM_GATE_NOW): the week gone and
// every wait it answers exact, whatever the time the test runs at.

import "../helpers.ts"; // run alone too: never the person's home and settings
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const GATE = path.join(import.meta.dirname, "..", "..", "assets", "plugins", "gates", "claude-usage", "gate.ts");
const posix = { skip: process.platform === "win32" };
const H = 3_600_000;
/** The gate's "now" in every test: away from midnight and from the full hour (a reset is a whole hour after it). */
const NOW = Date.parse("2026-11-18T14:37:00Z");

/**
 * How long this computer takes now to start a Node process and let it end — the budget of a check that would otherwise
 * be fixed milliseconds (a busy computer outruns them). The longest of three.
 */
function nodeStartMs(): number {
  let most = 0;
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    spawnSync(process.execPath, ["-e", ""], { stdio: "ignore" });
    most = Math.max(most, Date.now() - t);
  }
  return most;
}

/** A reset `inMs` from NOW, whole hours, as Claude Code prints it in UTC: 12-hour ("Nov 4 at 1pm") or 24-hour ("Nov 4 at 13:00"). */
function resetText(inMs: number, clock: 12 | 24 = 12): { at: number; text: string } {
  const at = Math.ceil((NOW + inMs) / H) * H;
  const d = new Date(at);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const h = d.getUTCHours();
  const time = clock === 24 ? `${String(h).padStart(2, "0")}:00` : `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  return { at, text: `${month} ${d.getUTCDate()} at ${time} (UTC)` };
}

/**
 * A stand-in `claude`: `-p /usage` prints the n-th of `answers` (the last one again after them; `exit:N` first line =
 * that exit status), `auth status` prints `auth` (exit 0) — or nothing; each asking noted. The control request
 * get_usage (`--input-format stream-json`) is answered with `get` (`exit:N` first line = that exit status, `sleep:N` =
 * no answer for N seconds); without it as an older Claude Code that does not know the option — noted apart (got()),
 * with the line it was given.
 */
function standIn(answers: string[], auth?: string, get?: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom gate čtení "));
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  answers.forEach((a, i) => fs.writeFileSync(path.join(dir, `a${i + 1}`), a));
  if (auth !== undefined) fs.writeFileSync(path.join(dir, "auth"), auth);
  fs.writeFileSync(path.join(dir, "get"), get ?? "exit:1\nerror: unknown option '--input-format'\n");
  fs.writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/sh
D="${dir}"
if [ "$1" = "auth" ]; then echo auth >> "$D/asked"; [ -f "$D/auth" ] && cat "$D/auth"; exit 0; fi
if [ "$2" = "--input-format" ]; then
  IFS= read -r line; printf '%s\n' "$line" >> "$D/got"
  first=$(head -n 1 "$D/get")
  case "$first" in exit:*) tail -n +2 "$D/get"; exit "\${first#exit:}";; sleep:*) exec sleep "\${first#sleep:}";; esac
  cat "$D/get"; exit 0
fi
echo usage >> "$D/asked"
n=$(grep -c usage "$D/asked")
f="$D/a$n"; [ -f "$f" ] || f="$D/a${answers.length}"
first=$(head -n 1 "$f")
case "$first" in exit:*) tail -n +2 "$f"; exit "\${first#exit:}";; esac
cat "$f"
`,
    { mode: 0o755 },
  );
  const asked = () => (fs.existsSync(path.join(dir, "asked")) ? fs.readFileSync(path.join(dir, "asked"), "utf8").trim().split("\n") : []);
  const ask = (args: string[] = ["10"], env: Record<string, string> = {}) => {
    const r = spawnSync(process.execPath, [GATE, ...args], {
      encoding: "utf8",
      env: { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, HOME: dir, STROM_LANG: "en", STROM_AGENT: "claude", CLAUDE_USAGE_RETRY_MS: "10", STROM_GATE_NOW: new Date(NOW).toISOString(), ...env },
    });
    const said = JSON.parse(r.stdout.trim().split("\n").pop()!) as { reason: string; until?: string };
    return { code: r.status, reason: said.reason, until: said.until ? Date.parse(said.until) : undefined };
  };
  const got = () => (fs.existsSync(path.join(dir, "got")) ? fs.readFileSync(path.join(dir, "got"), "utf8").trim().split("\n") : []);
  return { ask, asked, got, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** What the gate says at NOW of a week `used` % used that resets at `at`, with the number 10: the week gone exact. */
function goes(used: number, at: number): string {
  const gone = ((NOW - (at - 7 * 24 * H)) / (7 * 24 * H)) * 100;
  return `week ${used} % used, at most ${Math.floor(gone - 10)} % allowed by now (${Math.floor(gone)} % of the week gone, less 10); weekly reset in ${((at - NOW) / (24 * H)).toFixed(1)} days`;
}

test("the test's clock: the reset of the week 3 days on, 56.9 % of the week gone", () => {
  const week = resetText(3 * 24 * H);
  assert.deepEqual([new Date(week.at).toISOString(), week.text, resetText(3 * 24 * H, 24).text], ["2026-11-21T15:00:00.000Z", "Nov 21 at 3pm (UTC)", "Nov 21 at 15:00 (UTC)"]);
  assert.equal(goes(20, week.at), "week 20 % used, at most 46 % allowed by now (56 % of the week gone, less 10); weekly reset in 3.0 days");
});

test("claude-usage reads the shapes /usage prints: no session line, a model's week before all models', a 24-hour clock, a session's time alone", posix, () => {
  const week = resetText(3 * 24 * H);
  const late = resetText(3 * 24 * H, 24);
  const cases: [string, string, string][] = [
    // as Claude Code 2.1 prints it now: a line of its own first, no session line, the model's week after all models'
    ["now", `You are currently using your subscription to power your Claude Code usage\n\nCurrent week (all models): 20% used · resets ${week.text}\nCurrent week (Fable): 0% used · resets ${week.text}\n\nWhat's contributing to your usage?\n`, goes(20, week.at)],
    // the model's own week before all models': all models' counts
    ["model first", `Current session: 5% used · resets ${week.text}\nCurrent week (Fable): 90% used · resets ${week.text}\nCurrent week (all models): 20% used · resets ${week.text}\n`, goes(20, week.at)],
    // a 24-hour clock
    ["24 h", `Current week (all models): 20% used · resets ${late.text}\n`, goes(20, late.at)],
    // only a model's week: it counts
    ["one model", `Current week (Fable): 30% used · resets ${week.text}\n`, goes(30, week.at)],
  ];
  for (const [name, text, said] of cases) {
    const s = standIn([text]);
    try {
      const r = s.ask();
      assert.equal(r.code, 0, `${name}: ${r.reason}`);
      assert.equal(r.reason, said, name);
      assert.deepEqual(s.asked(), ["usage"], `${name}: asked once, no login asked`);
    } finally {
      s.done();
    }
  }
  // the session used up, its reset a time alone ("4pm (UTC)" at 14:37): it waits until that time comes, and a minute
  const d = new Date(NOW + 2 * H);
  const sessionAt = `${d.getUTCHours() % 12 || 12}${d.getUTCHours() < 12 ? "am" : "pm"} (UTC)`;
  const s = standIn([`Current session: 100% used · resets ${sessionAt}\nCurrent week (all models): 20% used · resets ${week.text}\n`]);
  try {
    const r = s.ask();
    assert.equal(r.code, 1, r.reason);
    assert.match(r.reason, /^the session is used up/);
    assert.equal(new Date(r.until!).toISOString(), "2026-11-18T16:01:00.000Z");
  } finally {
    s.done();
  }
  // the week's line without a reset: nothing used goes, else unread
  const fresh = standIn(["Current week (all models): 0% used\n"]);
  try {
    assert.deepEqual([fresh.ask().code, fresh.ask().reason], [0, "week 0 % used — nothing used yet"]);
  } finally {
    fresh.done();
  }
  // an API key: no plan limits — it goes
  const api = standIn(["Claude Code is using an API key — no plan limits apply\n"]);
  try {
    const r = api.ask(["10", "--cap", "95"]);
    assert.equal(r.code, 0);
    assert.match(r.reason, /API key/);
  } finally {
    api.done();
  }
});

test("claude-usage: an answer it cannot read is asked again — a later one read goes on; never read: a wait of 15 minutes with what it said, not a stop", posix, () => {
  const week = resetText(3 * 24 * H);
  // the first answer without the week's line, the second read
  const once = standIn(["Loading…\n", `Current week (all models): 20% used · resets ${week.text}\n`], '{"loggedIn": true}');
  try {
    const r = once.ask();
    assert.equal(r.code, 0, r.reason);
    assert.equal(r.reason, goes(20, week.at));
    assert.deepEqual(once.asked(), ["usage", "auth", "usage"]);
  } finally {
    once.done();
  }
  // never read (an exit status with its words, an address of an account in them): three times, then a wait
  const never = standIn(["exit:1\n\nError: overloaded for lhotak@example.cz, try again later\n"], '{"loggedIn": true}');
  try {
    const r = never.ask();
    assert.equal(r.code, 1, r.reason);
    assert.equal(r.reason, 'cannot read `claude -p /usage` (3×): it ended with exit status 1; it said: "Error: overloaded for …@…, try again later" — asked again in 15 minutes');
    assert.equal(r.until, NOW + 15 * 60_000);
    assert.deepEqual(never.asked(), ["usage", "auth", "usage", "usage"]);
  } finally {
    never.done();
  }
  // a Claude Code that cannot say whether it is logged in (an older one, auth status not JSON): asked again, then a wait
  const older = standIn(["Total cost: $0.0000\n"], "Logged in.\n");
  try {
    const r = older.ask(["10"], { STROM_LANG: "cs" });
    assert.equal(r.code, 1);
    assert.equal(r.reason, "nelze přečíst `claude -p /usage` (3×): chybí řádek „Current week … resets …“; vypsalo: „Total cost: $0.0000“ — znovu za 15 minut");
  } finally {
    older.done();
  }
  // a long first line is shortened; nothing printed is said so
  const long = standIn([`${"Ř".repeat(200)}\n`, ""], '{"loggedIn": true}');
  try {
    const r = long.ask(["10"], { STROM_LANG: "pl" });
    assert.equal(r.code, 1);
    assert.match(r.reason, /^nie można odczytać `claude -p \/usage` \(3×\): brak wiersza „Current week … resets …”; nic nie wypisało — ponownie za 15 minut$/);
  } finally {
    long.done();
  }
});

test("claude-usage: Claude Code not logged in (its /usage a bare /cost) stops the run, saying how to log in — with the folder said", posix, () => {
  const cost = "Total cost:            $0.0000\nTotal duration (API):  0s\n";
  const auth = '{"loggedIn": false, "authMethod": "none", "configDirectory": "/x"}';
  const s = standIn([cost], auth);
  try {
    const plain = s.ask(["10", "--cap", "95"]);
    assert.equal(plain.code, 2);
    assert.equal(plain.reason, "Claude Code is not logged in — to log in once: claude, then /login");
    assert.deepEqual(s.asked(), ["usage", "auth"], "not asked again: no asking makes it read");
    const dir = "/home/lhotak/.claude-druhý";
    const said = s.ask(["10"], { CLAUDE_CONFIG_DIR: dir, STROM_LANG: "cs" });
    assert.equal(said.code, 2);
    assert.equal(said.reason, `Claude Code není přihlášený s CLAUDE_CONFIG_DIR=${dir} — přihlásit jednou se stejnou proměnnou (CLAUDE_CONFIG_DIR=${dir} claude, pak /login), nebo spustit strom bez ní`);
    for (const [lang, re] of [["de", /^Claude Code ist mit CLAUDE_CONFIG_DIR=.* nicht angemeldet/], ["pl", /^Claude Code nie jest zalogowany z CLAUDE_CONFIG_DIR=/]] as const)
      assert.match(s.ask(["10"], { CLAUDE_CONFIG_DIR: dir, STROM_LANG: lang }).reason, re);
  } finally {
    s.done();
  }
});

/** Claude Code's answer to get_usage (stream-json, a hook's line before it): the week's and the session's utilization 0–100. */
function limitsSaid(week: { used: number; at?: number } | null, session: { used: number; at: number } | null = null, o: { id?: string; available?: boolean } = {}): string {
  const lim = (l: { used: number; at?: number } | null) => (l ? { utilization: l.used, resets_at: l.at === undefined ? null : new Date(l.at).toISOString().replace("Z", "+00:00"), limit_dollars: null } : null);
  const available = o.available ?? true;
  const response = {
    session: { total_cost_usd: 0, model_usage: {} },
    subscription_type: available ? "max" : null,
    rate_limits_available: available,
    rate_limits: available ? { five_hour: lim(session), seven_day: lim(week), seven_day_opus: null, limits: [] } : null,
  };
  return [
    JSON.stringify({ type: "system", subtype: "hook_started", hook_name: "SessionStart:startup" }),
    JSON.stringify({ type: "control_response", response: { subtype: "success", request_id: o.id ?? "strom-gate-usage", response } }),
    "",
  ].join("\n");
}

test("claude-usage asks get_usage first — the limits alone, in a second — and `claude -p /usage` only when that is not read", posix, () => {
  const week = resetText(3 * 24 * H);
  const usage = `Current week (all models): 30% used · resets ${week.text}\n`;
  const request = '{"type":"control_request","request_id":"strom-gate-usage","request":{"subtype":"get_usage","skip_behaviors":true}}';
  // the week and the session from get_usage: /usage never asked, the request one line of JSON on stdin
  const ok = standIn([usage], '{"loggedIn": true}', limitsSaid({ used: 20, at: week.at }, { used: 5, at: NOW + 2 * H }));
  try {
    const r = ok.ask();
    assert.equal(r.code, 0, r.reason);
    assert.equal(r.reason, goes(20, week.at));
    assert.deepEqual(ok.got(), [request]);
    assert.deepEqual(ok.asked(), [], "no /usage, no login asked");
    assert.equal(ok.ask(["10"], { STROM_LANG: "cs" }).reason.slice(0, 21), "týden: využito 20 %, ");
  } finally {
    ok.done();
  }
  // the session used up: until it resets (and a minute)
  const sessionAt = NOW + 2 * H;
  const full = standIn([usage], undefined, limitsSaid({ used: 20, at: week.at }, { used: 100, at: sessionAt }));
  try {
    const r = full.ask();
    assert.equal(r.code, 1, r.reason);
    assert.match(r.reason, /^the session is used up/);
    assert.equal(r.until, sessionAt + 60_000);
    assert.deepEqual(full.asked(), []);
  } finally {
    full.done();
  }
  // no session window open (five_hour null), and the week far ahead: read as it is
  const ahead = standIn([usage], undefined, limitsSaid({ used: 74.5, at: week.at }));
  try {
    const r = ahead.ask();
    assert.equal(r.code, 1, r.reason);
    assert.match(r.reason, /^week 74 % used/);
    assert.deepEqual(ahead.asked(), []);
  } finally {
    ahead.done();
  }
  // not read — /usage as before (30 %): an older Claude Code (unknown option, or the request unknown), an error, not
  // JSON, another request's answer, no week in it, its week used with no reset
  const unread: [string, string][] = [
    ["older: unknown option", "exit:1\nerror: unknown option '--input-format'\n"],
    ["older: request unknown", '{"type":"control_response","response":{"subtype":"error","request_id":"strom-gate-usage","error":"Unsupported control request subtype: get_usage","error_code":"unsupported_request"}}\n'],
    ["exit status", "exit:3\n"],
    ["not JSON", "{\"type\":\"control_response\",\"response\":{\"subtype\":\"success\",\"request_id\":\"strom-gate-usage\"\n"],
    ["another request", limitsSaid({ used: 20, at: week.at }, null, { id: "jiný" })],
    ["no week", limitsSaid(null, { used: 5, at: NOW + H })],
    ["no reset", limitsSaid({ used: 20 })],
  ];
  for (const [name, get] of unread) {
    const s = standIn([usage], undefined, get);
    try {
      const r = s.ask();
      assert.equal(r.code, 0, `${name}: ${r.reason}`);
      assert.equal(r.reason, goes(30, week.at), name);
      assert.deepEqual([s.got().length, s.asked()], [1, ["usage"]], name);
    } finally {
      s.done();
    }
  }
  // no answer in time (a minute of silence): given up at the gate's own GET_MS, then /usage within the rest of the budget
  // — the time taken that GET_MS and the gate's Node processes on this computer now, twice and more, never the minute
  const getMs = 300;
  const budget = 2 * getMs + 10 * nodeStartMs();
  const slow = standIn([usage], undefined, "sleep:60\n");
  try {
    const before = Date.now();
    const r = slow.ask(["10"], { CLAUDE_USAGE_GET_MS: String(getMs) });
    const took = Date.now() - before;
    assert.equal(r.code, 0, r.reason);
    assert.equal(r.reason, goes(30, week.at));
    assert.ok(took < budget, `${took} ms, the budget ${budget} ms`);
    assert.deepEqual(slow.asked(), ["usage"]);
  } finally {
    slow.done();
  }
});

test("claude-usage: get_usage with no limits (an API key, no login) — /usage says which, as before", posix, () => {
  const none = limitsSaid(null, null, { available: false });
  const api = standIn(["Claude Code is using an API key — no plan limits apply\n"], undefined, none);
  try {
    const r = api.ask(["10", "--cap", "95"]);
    assert.equal(r.code, 0);
    assert.match(r.reason, /API key/);
    assert.deepEqual([api.got().length, api.asked()], [1, ["usage"]]);
  } finally {
    api.done();
  }
  const out = standIn(["Total cost:            $0.0000\n"], '{"loggedIn": false, "authMethod": "none"}', none);
  try {
    const r = out.ask(["10"], { STROM_LANG: "cs" });
    assert.equal(r.code, 2);
    assert.equal(r.reason, "Claude Code není přihlášený — přihlásit jednou: claude, pak /login");
    assert.deepEqual(out.asked(), ["usage", "auth"]);
  } finally {
    out.done();
  }
});
