// The claude-usage gate reading `claude -p /usage`: the shapes Claude Code prints (no session line, a model's own week
// beside all models', a 24-hour clock, a time alone, an API key), an answer it cannot read asked again and then waited
// for — never a stop for one answer — with the first line it got in the reason, and a Claude Code not logged in said
// with how to log in (found 2026-11-03: CLAUDE_CONFIG_DIR=~/.claude, /usage a bare /cost, the run stopped at once).
// A stand-in `claude` of the test's own: never the real one.

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

/** A reset `inMs` from now, whole hours, as Claude Code prints it in UTC: 12-hour ("Nov 4 at 1pm") or 24-hour ("Nov 4 at 13:00"). */
function resetText(inMs: number, clock: 12 | 24 = 12): { at: number; text: string } {
  const at = Math.ceil((Date.now() + inMs) / H) * H;
  const d = new Date(at);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const h = d.getUTCHours();
  const time = clock === 24 ? `${String(h).padStart(2, "0")}:00` : `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  return { at, text: `${month} ${d.getUTCDate()} at ${time} (UTC)` };
}

/**
 * A stand-in `claude`: `-p /usage` prints the n-th of `answers` (the last one again after them; `exit:N` first line =
 * that exit status), `auth status` prints `auth` (exit 0) — or nothing; each asking noted.
 */
function standIn(answers: string[], auth?: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom gate čtení "));
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  answers.forEach((a, i) => fs.writeFileSync(path.join(dir, `a${i + 1}`), a));
  if (auth !== undefined) fs.writeFileSync(path.join(dir, "auth"), auth);
  fs.writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/sh
D="${dir}"
if [ "$1" = "auth" ]; then echo auth >> "$D/asked"; [ -f "$D/auth" ] && cat "$D/auth"; exit 0; fi
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
      env: { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`, HOME: dir, STROM_LANG: "en", STROM_AGENT: "claude", CLAUDE_USAGE_RETRY_MS: "10", ...env },
    });
    const said = JSON.parse(r.stdout.trim().split("\n").pop()!) as { reason: string; until?: string };
    return { code: r.status, reason: said.reason, until: said.until ? Date.parse(said.until) : undefined };
  };
  return { ask, asked, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test("claude-usage reads the shapes /usage prints: no session line, a model's week before all models', a 24-hour clock, a session's time alone", posix, () => {
  const week = resetText(3 * 24 * H);
  const late = resetText(3 * 24 * H, 24);
  const cases: [string, string, RegExp][] = [
    // as Claude Code 2.1 prints it now: a line of its own first, no session line, the model's week after all models'
    ["now", `You are currently using your subscription to power your Claude Code usage\n\nCurrent week (all models): 20% used · resets ${week.text}\nCurrent week (Fable): 0% used · resets ${week.text}\n\nWhat's contributing to your usage?\n`, /^week 20 % used, at most 4[67] % allowed by now \(5[67] % of the week gone, less 10\)/],
    // the model's own week before all models': all models' counts
    ["model first", `Current session: 5% used · resets ${week.text}\nCurrent week (Fable): 90% used · resets ${week.text}\nCurrent week (all models): 20% used · resets ${week.text}\n`, /^week 20 % used/],
    // a 24-hour clock
    ["24 h", `Current week (all models): 20% used · resets ${late.text}\n`, /^week 20 % used, at most 4[67] % allowed by now \(5[67] % of the week gone, less 10\); weekly reset in 3\.0 days$/],
    // only a model's week: it counts
    ["one model", `Current week (Fable): 30% used · resets ${week.text}\n`, /^week 30 % used/],
  ];
  for (const [name, text, said] of cases) {
    const s = standIn([text]);
    try {
      const r = s.ask();
      assert.equal(r.code, 0, `${name}: ${r.reason}`);
      assert.match(r.reason, said, name);
      assert.deepEqual(s.asked(), ["usage"], `${name}: asked once, no login asked`);
    } finally {
      s.done();
    }
  }
  // the session used up, its reset a time alone ("6pm (UTC)"): it waits until that time comes, within a day
  const d = new Date(Date.now() + 2 * H);
  const sessionAt = `${d.getUTCHours() % 12 || 12}${d.getUTCHours() < 12 ? "am" : "pm"} (UTC)`;
  const s = standIn([`Current session: 100% used · resets ${sessionAt}\nCurrent week (all models): 20% used · resets ${week.text}\n`]);
  try {
    const r = s.ask();
    assert.equal(r.code, 1, r.reason);
    assert.match(r.reason, /^the session is used up/);
    assert.ok(r.until! > Date.now() + H && r.until! < Date.now() + 3 * H, `${(r.until! - Date.now()) / H} h`);
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
    assert.match(r.reason, /^week 20 % used/);
    assert.deepEqual(once.asked(), ["usage", "auth", "usage"]);
  } finally {
    once.done();
  }
  // never read (an exit status with its words, an address of an account in them): three times, then a wait
  const never = standIn(["exit:1\n\nError: overloaded for lhotak@example.cz, try again later\n"], '{"loggedIn": true}');
  try {
    const before = Date.now();
    const r = never.ask();
    assert.equal(r.code, 1, r.reason);
    assert.equal(r.reason, 'cannot read `claude -p /usage` (3×): it ended with exit status 1; it said: "Error: overloaded for …@…, try again later" — asked again in 15 minutes');
    assert.ok(Math.abs(r.until! - (before + 15 * 60_000)) < 30_000, `${(r.until! - before) / 60_000} min`);
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
