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
// Without a number: 0 — no faster than the week goes.
//
// Early in the week the number grows with it: at least min(n, gone / 2) — right
// after the reset (0 % gone, 0 % used) a session may start, and until 2·n % of
// the week is gone usage may reach half of it; from there on the full number.
// So the first day never spends the week (at most half its share), and a new
// week is not idle for n % of it (a day and more at 15) for nothing.
// Late in the week what is left goes with the reset: in its last END_WINDOW a
// session starts when what is left (to 100 %, or to the cap) holds one session
// (SESSION_POINTS).
// Else it waits until the first of: the week has caught up, its last
// END_WINDOW (with room for a session), its reset (a new week starts at once) —
// never past the reset. A full session: until it resets.
//
// Once it waited for want of points in hand, it goes again only with RESERVE
// more (at 15: 17), and then goes until fewer than the number are in hand — so
// several sessions run in a row, not one after each wait. The reserve grows
// with the week as the number does. Run by strom (STROM_GATE), the gate keeps
// the week it waits in in its own folder (hold.json); a new week starts free.
//
// A cap (strom config set run.gate "claude-usage 15 --cap 95"): at 95 % of the
// week used no session starts — the user's own hard stop, asked before every
// session of every run, and no "start anyway" goes past it; a session at work
// is asked to finish when the week reaches 99 %. What the agent said of its
// limits in this run (STROM_AGENT_LIMITS, at most 15 minutes old) is read
// instead of asking `claude -p /usage`.
//
// What `claude -p /usage` says is not always read: an answer without the
// week's line, an exit status, no answer in time. It asks again (ATTEMPTS, a
// pause between), and then waits a while (UNREAD_WAIT) rather than stopping
// the run for good — what it got is in its reason (the first line, shortened).
// A Claude Code not logged in (`claude auth status`; its /usage is then a bare
// /cost) stops the run, saying how to log in.
//
// strom writes this file; a copy of your own goes into a folder of its own name.

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const DAY = 86_400_000;
/** What the agent said of its limits counts for this long; older: `claude -p /usage` is asked. */
const FRESH_MS = 15 * 60_000;
/** Under a cap, a session at work is asked to finish at this much of the week. */
const FINISH_AT = 0.99;
const WEEK = 7 * DAY;
/**
 * The last stretch of the week in which what is left is spent rather than kept: about one session of `strom run`
 * (60 minutes by default) with its wrap-up and the gate's next asking. What is not used by the reset is gone with
 * it; what a person keeps in hand for their own work is missed for this long at most.
 */
const END_WINDOW = 2 * 3_600_000;
/** What one session may take of the week, counted high (points of the week's %): the room it needs before the reset. */
const SESSION_POINTS = 10;
/** After the reset the gate asks again this much later, so the new week is what Claude Code says. */
const AFTER_RESET = 60_000;
/**
 * Once it waited for want of points in hand, this many more are needed before it goes again (with the full number;
 * early in the week its share, as the number's): a session takes about a point of the week, so the work goes on in
 * runs of a few sessions instead of one after every wait — each session reads its brief anew. With no number too.
 */
const RESERVE = 2;
/** The week it waits in for the reserve, in the gate's own folder — only when strom asks it (STROM_GATE). */
const HOLD = process.env.STROM_GATE ? "hold.json" : undefined;
const lang = (process.env.STROM_LANG ?? "en").slice(0, 2);
/**
 * How many times `claude -p /usage` is asked before the gate waits; each asking may take ASK_MS — it reads the
 * computer's own sessions for its advice too, which took over a minute on a busy computer (2026-11-03: 75 s).
 */
const ATTEMPTS = 3;
const ASK_MS = 180_000;
/** The pause between two askings (tests give a shorter one: CLAUDE_USAGE_RETRY_MS). */
const RETRY_MS = /^\d+$/.test(process.env.CLAUDE_USAGE_RETRY_MS ?? "") ? Number(process.env.CLAUDE_USAGE_RETRY_MS) : 30_000;
/** All the askings within this, inside the gate's timeout (gate.json: 660 s). */
const BUDGET_MS = 600_000;
/** Unread after every asking: asked again this much later — a run is not stopped for one answer it could not read. */
const UNREAD_WAIT = 15 * 60_000;

const T: Record<string, Record<string, string>> = {
  en: {
    other: "the agent is not Claude Code — nothing to check",
    api: "Claude Code runs on an API key, not a subscription — no plan limits",
    head: "week {used} % used, {gone} % gone, {behind} in hand (at least {min} needed{early})",
    early: " — half the week gone, early in the week",
    resetIn: "; weekly reset in {reset}",
    hold: " — until {target} in hand, then several sessions in a row; weekly reset in {reset}",
    last: " — until the last {window} before the weekly reset in {reset}",
    reset: " — until the weekly reset in {reset}",
    end: "week {used} % used, weekly reset in {reset} — the {room} % left is enough for a session",
    session: "the session is used up — until it resets; weekly reset in {reset}",
    hours: "{n} h",
    days: "{n} days",
    bad: "the number must be 0 to 99, not \"{arg}\"",
    badcap: "the cap must be 1 to 100 (\"--cap 95\"), not \"{arg}\"",
    cap: "week {used} % used — the cap of {cap} % reached; it resets {resets}",
    unread: "cannot read `claude -p /usage`: {detail}",
    unreadWait: "cannot read `claude -p /usage` ({tries}×): {detail} — asked again in {min} minutes",
    noweek: "no line \"Current week … resets …\"",
    said: "{detail}; it said: \"{line}\"",
    nothing: "{detail}; it said nothing",
    unused: "week 0 % used — nothing used yet",
    exit: "it ended with exit status {status}",
    timeout: "no answer in {s} s",
    login: "Claude Code is not logged in — to log in once: claude, then /login",
    loginDir: "Claude Code is not logged in with CLAUDE_CONFIG_DIR={dir} — to log in once with the same variable (CLAUDE_CONFIG_DIR={dir} claude, then /login), or to start strom without it",
  },
  cs: {
    other: "agent není Claude Code — není co hlídat",
    api: "Claude Code běží na API klíči, ne na předplatném — žádné limity plánu",
    head: "týden: využito {used} %, uplynulo {gone} %, náskok {behind} (potřeba aspoň {min}{early})",
    early: " – na začátku týdne polovina uplynulého",
    resetIn: "; týden se obnoví za {reset}",
    hold: " — čeká na náskok {target}, pak víc sezení za sebou; týden se obnoví za {reset}",
    last: " — do posledních {window} před obnovením týdne za {reset}",
    reset: " — do obnovení týdne za {reset}",
    end: "týden: využito {used} %, obnoví se za {reset} — zbylých {room} % stačí na sezení",
    session: "sezení je vyčerpané — do jeho obnovení; týden se obnoví za {reset}",
    hours: "{n} h",
    days: "{n} dne",
    bad: "číslo musí být 0 až 99, ne \"{arg}\"",
    badcap: "strop musí být 1 až 100 (\"--cap 95\"), ne \"{arg}\"",
    cap: "týden: využito {used} % – strop {cap} % dosažen; obnoví se {resets}",
    unread: "nelze přečíst `claude -p /usage`: {detail}",
    unreadWait: "nelze přečíst `claude -p /usage` ({tries}×): {detail} — znovu za {min} minut",
    noweek: "chybí řádek „Current week … resets …“",
    said: "{detail}; vypsalo: „{line}“",
    nothing: "{detail}; nevypsalo nic",
    unused: "týden: využito 0 % — zatím nic",
    exit: "skončilo s kódem {status}",
    timeout: "bez odpovědi do {s} s",
    login: "Claude Code není přihlášený — přihlásit jednou: claude, pak /login",
    loginDir: "Claude Code není přihlášený s CLAUDE_CONFIG_DIR={dir} — přihlásit jednou se stejnou proměnnou (CLAUDE_CONFIG_DIR={dir} claude, pak /login), nebo spustit strom bez ní",
  },
  de: {
    other: "der Agent ist nicht Claude Code — nichts zu prüfen",
    api: "Claude Code läuft mit einem API-Schlüssel, nicht im Abo — keine Planlimits",
    head: "Woche: {used} % genutzt, {gone} % vergangen, Vorsprung {behind} (mindestens {min} nötig{early})",
    early: " – am Wochenanfang die Hälfte des Vergangenen",
    resetIn: "; Wochen-Reset in {reset}",
    hold: " — wartet auf Vorsprung {target}, dann mehrere Sitzungen am Stück; Wochen-Reset in {reset}",
    last: " — bis zu den letzten {window} vor dem Wochen-Reset in {reset}",
    reset: " — bis zum Wochen-Reset in {reset}",
    end: "Woche: {used} % genutzt, Wochen-Reset in {reset} — die übrigen {room} % reichen für eine Sitzung",
    session: "die Sitzung ist aufgebraucht — bis sie zurückgesetzt wird; Wochen-Reset in {reset}",
    hours: "{n} h",
    days: "{n} Tagen",
    bad: "die Zahl muss 0 bis 99 sein, nicht \"{arg}\"",
    badcap: "die Obergrenze muss 1 bis 100 sein (\"--cap 95\"), nicht \"{arg}\"",
    cap: "Woche: {used} % genutzt – Obergrenze {cap} % erreicht; zurückgesetzt {resets}",
    unread: "`claude -p /usage` nicht lesbar: {detail}",
    unreadWait: "`claude -p /usage` nicht lesbar ({tries}×): {detail} — erneut in {min} Minuten",
    noweek: "keine Zeile „Current week … resets …“",
    said: "{detail}; Ausgabe: „{line}“",
    nothing: "{detail}; keine Ausgabe",
    unused: "Woche: 0 % genutzt — noch nichts",
    exit: "mit Exit-Status {status} beendet",
    timeout: "keine Antwort in {s} s",
    login: "Claude Code ist nicht angemeldet — einmal anmelden: claude, dann /login",
    loginDir: "Claude Code ist mit CLAUDE_CONFIG_DIR={dir} nicht angemeldet — einmal mit derselben Variable anmelden (CLAUDE_CONFIG_DIR={dir} claude, dann /login) oder strom ohne sie starten",
  },
  pl: {
    other: "agent to nie Claude Code — nie ma czego pilnować",
    api: "Claude Code działa na kluczu API, nie w subskrypcji — bez limitów planu",
    head: "tydzień: wykorzystano {used} %, upłynęło {gone} %, zapas {behind} (potrzeba co najmniej {min}{early})",
    early: " – na początku tygodnia połowa tego, co upłynęło",
    resetIn: "; tydzień odnowi się za {reset}",
    hold: " — czeka na zapas {target}, potem kilka sesji z rzędu; tydzień odnowi się za {reset}",
    last: " — do ostatnich {window} przed odnowieniem tygodnia za {reset}",
    reset: " — do odnowienia tygodnia za {reset}",
    end: "tydzień: wykorzystano {used} %, odnowi się za {reset} — pozostałe {room} % wystarczy na sesję",
    session: "sesja wyczerpana — do jej odnowienia; tydzień odnowi się za {reset}",
    hours: "{n} godz.",
    days: "{n} dni",
    bad: "liczba musi wynosić od 0 do 99, nie \"{arg}\"",
    badcap: "limit musi wynosić od 1 do 100 (\"--cap 95\"), nie \"{arg}\"",
    cap: "tydzień: wykorzystano {used} % – osiągnięto limit {cap} %; odnowi się {resets}",
    unread: "nie można odczytać `claude -p /usage`: {detail}",
    unreadWait: "nie można odczytać `claude -p /usage` ({tries}×): {detail} — ponownie za {min} minut",
    noweek: "brak wiersza „Current week … resets …”",
    said: "{detail}; wypisało: „{line}”",
    nothing: "{detail}; nic nie wypisało",
    unused: "tydzień: wykorzystano 0 % — jeszcze nic",
    exit: "zakończyło się kodem {status}",
    timeout: "brak odpowiedzi w ciągu {s} s",
    login: "Claude Code nie jest zalogowany — zalogować się raz: claude, potem /login",
    loginDir: "Claude Code nie jest zalogowany z CLAUDE_CONFIG_DIR={dir} — zalogować się raz z tą samą zmienną (CLAUDE_CONFIG_DIR={dir} claude, potem /login) albo uruchomić strom bez niej",
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
  // ── what Claude Code says: asked again when it cannot be read, then a wait — never a stop for one answer ─────
  const began = Date.now();
  let detail = "";
  let tries = 0;
  for (;;) {
    tries++;
    const read = askUsage(Math.min(ASK_MS, BUDGET_MS - (Date.now() - began)));
    if ("api" in read) {
      cap = undefined;
      answer(0, say("api"));
    }
    if ("week" in read) {
      ({ session, week } = read);
      break;
    }
    detail = read.detail;
    // not logged in (its /usage a bare /cost): no asking again makes it read — said with how to log in
    if (tries === 1 && loggedIn() === false) {
      cap = undefined;
      const dir = process.env.CLAUDE_CONFIG_DIR?.trim();
      answer(2, dir ? say("loginDir", { dir }) : say("login"));
    }
    if (tries >= ATTEMPTS || BUDGET_MS - (Date.now() - began) < RETRY_MS + ASK_MS / 2) break;
    sleep(RETRY_MS);
  }
  if (!week) answer(1, say("unreadWait", { tries, detail, min: UNREAD_WAIT / 60_000 }), new Date(Date.now() + UNREAD_WAIT));
}
if (!week) answer(2, say("unread", { detail: say("noweek") }));
// the week's line without its reset: nothing used yet goes (a new week), else what it says is not read
if (!week.resets) {
  if (week.used === 0) answer(0, say("unused"));
  answer(1, say("unreadWait", { tries: 1, detail: say("noweek"), min: UNREAD_WAIT / 60_000 }), new Date(Date.now() + UNREAD_WAIT));
}
// the cap first: the user's own hard stop, whatever the pace
if (cap !== undefined && week.used >= cap)
  answer(2, say("cap", { used: Math.floor(week.used), cap, resets: week.resets.toLocaleString(lang, { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) }), undefined, true);

const now = Date.now();
const resets = week.resets.getTime();
const start = resets - WEEK;
const gone = Math.max(0, Math.min(100, ((now - start) / WEEK) * 100));
const behind = gone - week.used;
// the number needed in hand: half the week gone early in the week, the full number from 2·n % gone on
const need = Math.min(min, gone / 2);
const early = need < min ? say("early") : "";
const reset = inTime(resets - now);
// shown rounded down: never "15 in hand (at least 15 needed)" for 14.6 — and gone − used stays what it says; the
// need early in the week is a fraction: rounded down when it goes, up when it waits, so the two never seem to disagree
const v = { used: Math.floor(week.used), gone: Math.floor(gone), behind: Math.floor(behind), early, reset };
// the reserve once it waited: grown with the week as the number is (its share of the need), whole with no number
const reserve = min > 0 ? (RESERVE * need) / min : RESERVE;
const held = holding(resets);
if (session && session.used >= 100) answer(1, say("session", { reset }), session.resets ? new Date(session.resets.getTime() + AFTER_RESET) : undefined);
if (behind >= need + (held ? reserve : 0)) {
  hold(undefined);
  answer(0, say("head", { ...v, min: Math.floor(need) }) + say("resetIn", { reset }));
}
// what is left before the reset: (to the cap, else to 100 %) enough for a session — in the week's last stretch it goes
const room = (cap ?? 100) - week.used;
const fits = room >= SESSION_POINTS;
if (fits && resets - now <= END_WINDOW) answer(0, say("end", { used: v.used, reset, room: Math.floor(room) }));
// it waits for want of points in hand: from now on it goes again only with the reserve too
if (!held) hold(resets);
// else it waits for the first of: the week caught up with the reserve (gone − used ≥ need + reserve = k·need,
// k = 1 + RESERVE/n: with the full number gone = used + n + RESERVE, early in the week gone·(1 − k/2) = used — never
// when k ≥ 2), the week's last stretch (with room for a session), the reset — a new week at 0 % goes at once, so
// never past it
const k = 1 + RESERVE / min;
const byHalf = min > 0 && k < 2 ? week.used / (1 - k / 2) : Infinity;
const caught = start + (Math.min(week.used + min + RESERVE, byHalf) / 100) * WEEK;
const last = fits ? resets - END_WINDOW : Infinity;
const after = resets + AFTER_RESET;
const at = Math.min(caught, last, after);
const tail =
  at === caught ? say("hold", { reset, target: Math.ceil(need + reserve) }) : at === last ? say("last", { reset, window: say("hours", { n: END_WINDOW / 3_600_000 }) }) : say("reset", { reset });
answer(1, say("head", { ...v, min: Math.ceil(need) }) + tail, new Date(Math.max(at, now + 5 * 60_000)));

/**
 * `claude -p /usage` once: the session's and the week's use, an API key's answer, or why it was not read — with the
 * first line it said (shortened, no e-mail address), so the gate's log says what Claude Code answered.
 */
function askUsage(timeout: number): { session?: Use; week: Use } | { api: true } | { detail: string } {
  const r = spawnSync("claude", ["-p", "/usage"], { encoding: "utf8", timeout: Math.max(5_000, timeout), shell: process.platform === "win32", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  // what Claude Code or the system said is said as it is; the gate's own words in the research language (STROM_LANG)
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const line = firstLine(r.status === 0 ? (r.stdout ?? "") : out);
  const why = (detail: string) => ({ detail: line ? say("said", { detail, line }) : say("nothing", { detail }) });
  if (r.error) return (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT" ? why(say("timeout", { s: Math.round(timeout / 1000) })) : { detail: r.error.message };
  if (r.status !== 0) return why(say("exit", { status: String(r.status) }));
  const text = r.stdout ?? "";
  if (/API key/i.test(text) && !/Current week/i.test(text)) return { api: true };
  let session: Use | undefined;
  let week: Use | undefined;
  const LINE = /^Current (session|week)(?: \(([^)]+)\))?:\s*(\d+(?:\.\d+)?)\s*%\s*used(?:\s*·\s*resets\s*(.+))?$/i;
  for (const raw of text.split(/\r?\n/)) {
    const m = LINE.exec(raw.trim());
    if (!m) continue;
    const at = m[4] ? resetAt(m[4]) : undefined;
    const item = { used: Number(m[3]), ...(at ? { resets: at } : {}) };
    if (m[1]!.toLowerCase() === "session") session = item;
    // the limit of all models is the one that stops the work; a model's own week only if there is no other
    else if (!week || /all models/i.test(m[2] ?? "")) week = item;
  }
  if (!week || (!week.resets && week.used !== 0)) return why(say("noweek"));
  return { week, ...(session ? { session } : {}) };
}

/** The first line said that is not empty, shortened, without an e-mail address (an account's name stays out of the log). */
function firstLine(text: string): string {
  const line = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  const clean = line.replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+/gu, "…@…");
  return clean.length > 80 ? `${clean.slice(0, 79)}…` : clean;
}

/** `claude auth status` says whether it is logged in; undefined when it cannot tell (an older Claude Code). */
function loggedIn(): boolean | undefined {
  try {
    const r = spawnSync("claude", ["auth", "status"], { encoding: "utf8", timeout: 20_000, shell: process.platform === "win32", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    const said = JSON.parse((r.stdout ?? "").trim()) as { loggedIn?: unknown };
    return typeof said?.loggedIn === "boolean" ? said.loggedIn : undefined;
  } catch {
    return undefined;
  }
}

/** Waits here (the gate is one short program: nothing else to do meanwhile). */
function sleep(ms: number): void {
  if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** It waits for the reserve in this week (the week it remembers ends within a day of this one's reset). */
function holding(resets: number): boolean {
  if (!HOLD) return false;
  try {
    const week = Date.parse((JSON.parse(fs.readFileSync(HOLD, "utf8")) as { week?: string }).week ?? "");
    return Math.abs(week - resets) < DAY;
  } catch {
    return false;
  }
}

/** The week it now waits in for the reserve, or none (gone). Never fails: without it the gate only forgets. */
function hold(resets: number | undefined): void {
  if (!HOLD) return;
  try {
    if (resets === undefined) fs.rmSync(HOLD, { force: true });
    else fs.writeFileSync(HOLD, JSON.stringify({ week: new Date(resets).toISOString(), since: new Date().toISOString() }) + "\n");
  } catch {
    // a folder it may not write here: it asks as if for the first time
  }
}

/** A stretch of time as a person reads it: hours to two days, then days — one decimal, in the research language. */
function inTime(ms: number): string {
  const h = Math.max(0, ms) / 3_600_000;
  const n = (x: number) => x.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return h < 48 ? say("hours", { n: n(h) }) : say("days", { n: n(h / 24) });
}

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

/**
 * "Sep 30 at 2pm (Europe/Prague)", "Oct 2 at 11:30am (UTC)", "Nov 4 at 13:00 (Europe/Prague)", "Nov 4, 1pm (UTC)" → the
 * moment; a time alone ("6pm (Europe/Prague)", a session's) → its next coming.
 */
function resetAt(s: string): Date | undefined {
  const m = /^(?:([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2})(?:\s+at|,)?\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*\(([^)]+)\)/i.exec(s.trim());
  if (!m) return undefined;
  const ampm = m[5]?.replace(/\./g, "").toLowerCase();
  const h = Number(m[3]);
  if (ampm ? h < 1 || h > 12 : h > 23) return undefined;
  const hour = ampm ? (h % 12) + (ampm === "pm" ? 12 : 0) : h;
  const minute = Number(m[4] ?? 0);
  const zone = m[6]!;
  if (!m[1]) {
    // a time alone: today's in the zone, else tomorrow's
    const [y, mo, d] = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-").map(Number) as [number, number, number];
    for (const add of [0, 1]) {
      const guess = Date.UTC(y, mo - 1, d + add, hour, minute);
      const at = guess - offsetMs(guess, zone);
      if (at > Date.now()) return new Date(at);
    }
    return undefined;
  }
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1].toLowerCase());
  if (month < 0) return undefined;
  for (const year of [new Date().getUTCFullYear(), new Date().getUTCFullYear() + 1]) {
    const guess = Date.UTC(year, month, Number(m[2]), hour, minute);
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
