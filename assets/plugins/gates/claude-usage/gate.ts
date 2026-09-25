// A strom gate (interface 1): let the research work alone while the Claude
// subscription has room. It asks Claude Code itself (`claude -p /usage`, the
// plan's limits as the server reports them) and answers strom:
//   exit 0  go on           exit 1  wait (JSON "until": when to ask again)
//   exit 2  stop the run    — one line of JSON on stdout says why.
//
// The rule, the pace of the week: the share of the week gone since its reset
// (a day is about 14.3 %) against the week's usage. With the number you give
// it (strom config set run.gate "claude-usage 10") a session starts only while
// usage is at least that many points behind the week gone: gone − used ≥ 10.
// Without a number: 0 — no faster than the week goes. Else it waits until the
// week has caught up (or past the reset); a full session: until it resets.
//
// strom writes this file; a copy of your own goes into a folder of its own name.

import { spawnSync } from "node:child_process";

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const lang = (process.env.STROM_LANG ?? "en").slice(0, 2);

const T: Record<string, Record<string, string>> = {
  en: {
    other: "the agent is not Claude Code — nothing to check",
    api: "Claude Code runs on an API key, not a subscription — no plan limits",
    go: "week {used} % used, {gone} % gone, {behind} in hand (at least {min} needed)",
    session: "the session is used up — until it resets",
    week: "week {used} % used, {gone} % gone, {behind} in hand (at least {min} needed) — until the week catches up",
    bad: "the number must be 0 to 99, not \"{arg}\"",
    unread: "cannot read `claude -p /usage`: {detail}",
  },
  cs: {
    other: "agent není Claude Code — není co hlídat",
    api: "Claude Code běží na API klíči, ne na předplatném — žádné limity plánu",
    go: "týden: využito {used} %, uplynulo {gone} %, náskok {behind} (potřeba aspoň {min})",
    session: "sezení je vyčerpané — do jeho obnovení",
    week: "týden: využito {used} %, uplynulo {gone} %, náskok {behind} (potřeba aspoň {min}) — dokud čas nedožene",
    bad: "číslo musí být 0 až 99, ne \"{arg}\"",
    unread: "nelze přečíst `claude -p /usage`: {detail}",
  },
  de: {
    other: "der Agent ist nicht Claude Code — nichts zu prüfen",
    api: "Claude Code läuft mit einem API-Schlüssel, nicht im Abo — keine Planlimits",
    go: "Woche: {used} % genutzt, {gone} % vergangen, Vorsprung {behind} (mindestens {min} nötig)",
    session: "die Sitzung ist aufgebraucht — bis sie zurückgesetzt wird",
    week: "Woche: {used} % genutzt, {gone} % vergangen, Vorsprung {behind} (mindestens {min} nötig) — bis die Zeit aufholt",
    bad: "die Zahl muss 0 bis 99 sein, nicht \"{arg}\"",
    unread: "`claude -p /usage` nicht lesbar: {detail}",
  },
};
function say(key: string, v: Record<string, string | number> = {}): string {
  const s = (T[lang] ?? T.en!)[key] ?? T.en![key]!;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
}
function answer(code: 0 | 1 | 2, reason: string, until?: Date): never {
  console.log(JSON.stringify({ reason, ...(until ? { until: until.toISOString() } : {}) }));
  process.exit(code);
}

// ── your number: how many points usage must be behind the week gone ─────────
const arg = process.argv[2] ?? "0";
const min = Number(arg);
if (!/^\d{1,2}$/.test(arg)) answer(2, say("bad", { arg }));

if ((process.env.STROM_AGENT ?? "claude") !== "claude") answer(0, say("other"));

// ── what Claude Code says ───────────────────────────────────────────────────
const r = spawnSync("claude", ["-p", "/usage"], { encoding: "utf8", timeout: 90_000, shell: process.platform === "win32", windowsHide: true });
if (r.error || r.status !== 0) answer(2, say("unread", { detail: r.error?.message ?? (r.stderr || r.stdout || `exit ${r.status}`).trim().split("\n")[0] ?? "" }));
const text = r.stdout;
if (/API key/i.test(text) && !/Current week/i.test(text)) answer(0, say("api"));

const LINE = /^Current (session|week)(?: \(([^)]+)\))?:\s*(\d+)%\s*used(?:\s*·\s*resets\s*(.+))?$/i;
let session: { used: number; resets?: Date } | undefined;
let week: { used: number; resets?: Date } | undefined;
for (const raw of text.split(/\r?\n/)) {
  const m = LINE.exec(raw.trim());
  if (!m) continue;
  const item = { used: Number(m[3]), ...(m[4] ? { resets: resetAt(m[4]) } : {}) };
  if (m[1]!.toLowerCase() === "session") session = item;
  // the limit of all models is the one that stops the work; a model's own week only if there is no other
  else if (!week || /all models/i.test(m[2] ?? "")) week = item;
}
if (!week?.resets) answer(2, say("unread", { detail: "no line \"Current week … resets …\"" }));

const now = Date.now();
const start = week.resets.getTime() - WEEK;
const gone = Math.max(0, Math.min(100, ((now - start) / WEEK) * 100));
const behind = gone - week.used;
const v = { used: week.used, gone: Math.round(gone), behind: Math.round(behind), min };
if (session && session.used >= 100) answer(1, say("session"), session.resets ? new Date(session.resets.getTime() + 60_000) : undefined);
if (behind < min) {
  // when the week gone reaches usage + the number; past the reset, the new week's number
  let at = start + ((week.used + min) / 100) * WEEK;
  if (at >= week.resets.getTime()) at = week.resets.getTime() + (min / 100) * WEEK;
  answer(1, say("week", v), new Date(Math.max(at, now + 5 * 60_000)));
}
answer(0, say("go", v));

/** "Sep 30 at 2pm (Europe/Prague)", "Oct 2 at 11:30am (UTC)" → the moment. */
function resetAt(s: string): Date | undefined {
  const m = /^(\w{3})\w*\s+(\d{1,2})\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(([^)]+)\)/i.exec(s.trim());
  if (!m) return undefined;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1]!.toLowerCase());
  if (month < 0) return undefined;
  const hour = (Number(m[3]) % 12) + (m[5]!.toLowerCase() === "pm" ? 12 : 0);
  const zone = m[6]!;
  for (const year of [new Date().getUTCFullYear(), new Date().getUTCFullYear() + 1]) {
    const guess = Date.UTC(year, month, Number(m[2]), hour, Number(m[4] ?? 0));
    const at = guess - offsetMs(guess, zone);
    if (at > Date.now() - DAY) return new Date(at);
  }
  return undefined;
}

/** The zone's offset from UTC at that moment ("Europe/Prague" in summer: +2 h). */
function offsetMs(at: number, zone: string): number {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(new Date(at)).find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) * 60_000 : 0;
  } catch {
    return 0;
  }
}
