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
// A cap (strom config set run.gate "claude-usage 15 --cap 95"): at 95 % of the
// week used no session starts — the user's own hard stop, asked before every
// session of every run, and no "start anyway" goes past it; a session at work
// is asked to finish when the week reaches 99 %. What the agent said of its
// limits in this run (STROM_AGENT_LIMITS, at most 15 minutes old) is read
// instead of asking `claude -p /usage`.
//
// strom writes this file; a copy of your own goes into a folder of its own name.

import { spawnSync } from "node:child_process";

const DAY = 86_400_000;
/** What the agent said of its limits counts for this long; older: `claude -p /usage` is asked. */
const FRESH_MS = 15 * 60_000;
/** Under a cap, a session at work is asked to finish at this much of the week. */
const FINISH_AT = 0.99;
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
    badcap: "the cap must be 1 to 100 (\"--cap 95\"), not \"{arg}\"",
    cap: "week {used} % used — the cap of {cap} % reached; it resets {resets}",
    unread: "cannot read `claude -p /usage`: {detail}",
    noweek: "no line \"Current week … resets …\"",
    exit: "it ended with exit status {status}",
  },
  cs: {
    other: "agent není Claude Code — není co hlídat",
    api: "Claude Code běží na API klíči, ne na předplatném — žádné limity plánu",
    go: "týden: využito {used} %, uplynulo {gone} %, náskok {behind} (potřeba aspoň {min})",
    session: "sezení je vyčerpané — do jeho obnovení",
    week: "týden: využito {used} %, uplynulo {gone} %, náskok {behind} (potřeba aspoň {min}) — dokud čas nedožene",
    bad: "číslo musí být 0 až 99, ne \"{arg}\"",
    badcap: "strop musí být 1 až 100 (\"--cap 95\"), ne \"{arg}\"",
    cap: "týden: využito {used} % – strop {cap} % dosažen; obnoví se {resets}",
    unread: "nelze přečíst `claude -p /usage`: {detail}",
    noweek: "chybí řádek „Current week … resets …“",
    exit: "skončilo s kódem {status}",
  },
  de: {
    other: "der Agent ist nicht Claude Code — nichts zu prüfen",
    api: "Claude Code läuft mit einem API-Schlüssel, nicht im Abo — keine Planlimits",
    go: "Woche: {used} % genutzt, {gone} % vergangen, Vorsprung {behind} (mindestens {min} nötig)",
    session: "die Sitzung ist aufgebraucht — bis sie zurückgesetzt wird",
    week: "Woche: {used} % genutzt, {gone} % vergangen, Vorsprung {behind} (mindestens {min} nötig) — bis die Zeit aufholt",
    bad: "die Zahl muss 0 bis 99 sein, nicht \"{arg}\"",
    badcap: "die Obergrenze muss 1 bis 100 sein (\"--cap 95\"), nicht \"{arg}\"",
    cap: "Woche: {used} % genutzt – Obergrenze {cap} % erreicht; zurückgesetzt {resets}",
    unread: "`claude -p /usage` nicht lesbar: {detail}",
    noweek: "keine Zeile „Current week … resets …“",
    exit: "mit Exit-Status {status} beendet",
  },
};
function say(key: string, v: Record<string, string | number> = {}): string {
  const s = (T[lang] ?? T.en!)[key] ?? T.en![key]!;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
}
function answer(code: 0 | 1 | 2, reason: string, until?: Date, hard?: boolean): never {
  // under a cap: strom asks before every session and asks a session at work to finish near the week's end
  const watch = cap !== undefined ? { kind: "seven_day", finish: FINISH_AT } : undefined;
  console.log(JSON.stringify({ reason, ...(until ? { until: until.toISOString() } : {}), ...(hard ? { hard: true } : {}), ...(watch ? { watch } : {}) }));
  process.exit(code);
}

// ── your number: how many points usage must be behind the week gone; --cap: the week's hard stop ─
const argv = process.argv.slice(2);
let cap: number | undefined;
let arg = "0";
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]!;
  if (a === "--cap" || a.startsWith("--cap=")) {
    const v = a === "--cap" ? (argv[++i] ?? "") : a.slice(6);
    if (!/^\d{1,3}$/.test(v) || Number(v) < 1 || Number(v) > 100) answer(2, say("badcap", { arg: v }));
    cap = Number(v);
  } else arg = a;
}
const min = Number(arg);
if (!/^\d{1,2}$/.test(arg)) answer(2, say("bad", { arg }));

if ((process.env.STROM_AGENT ?? "claude") !== "claude") {
  cap = undefined; // another agent: no limits of Claude's to hold
  answer(0, say("other"));
}

type Use = { used: number; resets?: Date };
let session: Use | undefined;
let week: Use | undefined;

// ── what the agent said in this run, when it is fresh ───────────────────────
const said = fromAgent(process.env.STROM_AGENT_LIMITS);
if (said) ({ session, week } = said);
else {
  // ── what Claude Code says ─────────────────────────────────────────────────
  const r = spawnSync("claude", ["-p", "/usage"], { encoding: "utf8", timeout: 90_000, shell: process.platform === "win32", windowsHide: true });
  // what Claude Code or the system said is said as it is; the gate's own words in the research language (STROM_LANG)
  if (r.error || r.status !== 0) answer(2, say("unread", { detail: r.error?.message ?? ((r.stderr || r.stdout || "").trim().split("\n")[0] || say("exit", { status: String(r.status) })) }));
  const text = r.stdout;
  if (/API key/i.test(text) && !/Current week/i.test(text)) {
    cap = undefined;
    answer(0, say("api"));
  }
  const LINE = /^Current (session|week)(?: \(([^)]+)\))?:\s*(\d+)%\s*used(?:\s*·\s*resets\s*(.+))?$/i;
  for (const raw of text.split(/\r?\n/)) {
    const m = LINE.exec(raw.trim());
    if (!m) continue;
    const item = { used: Number(m[3]), ...(m[4] ? { resets: resetAt(m[4]) } : {}) };
    if (m[1]!.toLowerCase() === "session") session = item;
    // the limit of all models is the one that stops the work; a model's own week only if there is no other
    else if (!week || /all models/i.test(m[2] ?? "")) week = item;
  }
}
if (!week?.resets) answer(2, say("unread", { detail: say("noweek") }));
// the cap first: the user's own hard stop, whatever the pace
if (cap !== undefined && week.used >= cap)
  answer(2, say("cap", { used: Math.floor(week.used), cap, resets: week.resets.toLocaleString(lang, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) }), undefined, true);

const now = Date.now();
const start = week.resets.getTime() - WEEK;
const gone = Math.max(0, Math.min(100, ((now - start) / WEEK) * 100));
const behind = gone - week.used;
// shown rounded down: never "15 in hand (at least 15 needed)" for 14.6 — and gone − used stays what it says
const v = { used: Math.floor(week.used), gone: Math.floor(gone), behind: Math.floor(behind), min };
if (session && session.used >= 100) answer(1, say("session"), session.resets ? new Date(session.resets.getTime() + 60_000) : undefined);
if (behind < min) {
  // when the week gone reaches usage + the number; past the reset, the new week's number
  let at = start + ((week.used + min) / 100) * WEEK;
  if (at >= week.resets.getTime()) at = week.resets.getTime() + (min / 100) * WEEK;
  answer(1, say("week", v), new Date(Math.max(at, now + 5 * 60_000)));
}
answer(0, say("go", v));

/**
 * The limits Claude Code said in this run (strom passes them: [{kind, used 0–1, resetsAt, at}]), when the week's is
 * at most FRESH_MS old and not past its reset; else nothing — `claude -p /usage` is asked.
 */
function fromAgent(json: string | undefined): { session?: Use; week: Use } | undefined {
  if (!json) return undefined;
  let list: unknown;
  try {
    list = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!Array.isArray(list)) return undefined;
  const of = (kind: string): Use | undefined => {
    const l = list.find((x) => x && typeof x === "object" && (x as { kind?: unknown }).kind === kind) as { used?: unknown; resetsAt?: unknown; at?: unknown } | undefined;
    if (!l || typeof l.used !== "number" || !Number.isFinite(l.used) || typeof l.at !== "string") return undefined;
    const at = Date.parse(l.at);
    const resets = typeof l.resetsAt === "string" ? new Date(l.resetsAt) : undefined;
    if (Number.isNaN(at) || Date.now() - at > FRESH_MS || !resets || Number.isNaN(resets.getTime()) || resets.getTime() <= Date.now()) return undefined;
    return { used: l.used * 100, resets };
  };
  const week = of("seven_day");
  if (!week) return undefined;
  const session = of("five_hour");
  return { week, ...(session ? { session } : {}) };
}

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
