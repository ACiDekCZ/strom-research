// Back to the defaults (strom media calibrate --reset, strom doctor --fix): what was set for the reading of scans —
// the calibrated sizes (viewSizes, a person's paid calibration), what strom set by itself (core/tune.ts: the user
// config's `tuning`, a book's or an archive's in .strom/tune/state.json) and the answers a person gave to its questions
// (the user config's `tuneAnswers`, .strom/tune/answers.json) — listed first from what they carry (id, key, scope,
// value, default, time, reason, source), never guessed, and returned only on a person's yes. Nothing of the research
// itself: the tasks an answer added stay (they are said), the measurements (.strom/metrics) stay, nothing in data/, no
// commit. Every reset is one line of .strom/tune/log.jsonl ({by: "reset", items}); what it returned strom does not set
// again by itself for TUNING.heldDays or until the data change (tune.ts heldBack).
//
// And the other way (8.4 of the method): a change strom made by itself after which the reading got clearly worse —
// readings less sure or readers without a result (a reset recommended), or only dearer with the readings no surer
// (kept recommended: the change went towards accuracy) — said by strom doctor with the command that returns it.

import fs from "node:fs";
import path from "node:path";
import { readJsonIfExists, writeFileAtomic } from "./json.ts";
import { acquireLock } from "./lock.ts";
import { isReading, wilson, type Unit } from "./readstats.ts";
import { allTuned, appendTuneLog, canonicalAnswers, keyTuningOf, loadTuneState, migrateTuneKeys, saveTuneState, scopeScans, splitKey, tuneDir, tuneLockFile, type ResetLogItem, type TuneResetEntry, type TuneState, type Tuned } from "./tune.ts";
import { calibrationOf, defaultViewSizes, forgetCalibration, type ViewCalibration } from "./viewsizes.ts";
import { keyOf, keysFor, loadAliases, type Aliases } from "./modelkey.ts";
import type { Settings, UserConfig } from "./config.ts";

/** What a reset can be narrowed to (--only). */
export const RESET_PARTS = ["sizes", "batches", "fetch", "answers"] as const;
export type ResetPart = (typeof RESET_PARTS)[number];

/**
 * When the reading after a change strom made by itself counts as worse than before it (8.4): the windows before and
 * after the change, and the multiples. Beside TUNING (core/readstats.ts) in spirit: one place to set them from real data.
 */
export const WORSENING = {
  /** Before: the last readings of the key (or the book) before the change, up to about this many scans. */
  beforeScans: 60,
  /** After: at least this many scans from at least this many sessions or readers since the change. */
  after: { key: { scans: 30, units: 3 }, book: { scans: 15, units: 2 } },
  /** (a) unsure readings (M5) or readers without a result (M10) this many times those before, the Wilson 90 % intervals apart. */
  accuracy: 1.5,
  /** (b) the cost per scan (M1; the new tokens where no cost is said) this many times that before, the readings no surer. */
  cost: 1.3,
} as const;

/** One value set for the reading of scans, as a reset lists it. */
export interface ResetItem {
  /** T… of a change strom made; calibration; answer:<kind>[:<book|host>] */
  id: string;
  part: ResetPart;
  /** views.size, reading.batch, fetch.order…; calibration; answer:<kind> */
  what: string;
  /** A1–A7 of a change strom made. */
  action?: string;
  key: string;
  /** key, research, book:B…, host:<host> */
  scope: string;
  where: "config" | "research";
  now: unknown;
  default: unknown;
  source: "calibrated" | "tuned" | "answered";
  at?: string;
  /** The reason in English (an agent, --json, the log); a person reads it from what follows (cli/tunereset.ts). */
  why?: string;
  /** The figures of a change of strom's (core/tune.ts reasonOf). */
  basis?: Record<string, number | string>;
  /** How many known records a calibration read. */
  sample?: number;
  /** Where an answer was given: terminal, window, app. */
  by?: string;
  reported?: string;
  /** The fields it is kept in (a change of several values), or the name of an answer. */
  fields: string[];
  /** Tasks an answer added: they stay. */
  tasks?: string[];
}

export interface ResetFilter {
  /** The keys of agent and model: these, or every one there is. */
  keys: string[] | "all";
  parts: ReadonlySet<ResetPart>;
  /** Only one book or one archive (either named: those). */
  recordset?: string;
  host?: string;
}

const answersFile = (root: string) => path.join(tuneDir(root), "answers.json");

type AnswerRecord = { choice?: unknown; at?: unknown; by?: unknown; tasks?: unknown };
type Answers = Record<string, Record<string, AnswerRecord>>;

/** The answers kept beside a research (core/tuneask.ts), under the keys of the models — none when not there or not one. */
function researchAnswers(root: string, aliases: Aliases = loadAliases(root)): Answers {
  try {
    const a = readJsonIfExists<Answers>(answersFile(root));
    return a && typeof a === "object" && !Array.isArray(a) ? canonicalAnswers(a, aliases).answers : {};
  } catch {
    return {};
  }
}

/** The answers of the user config, under the keys of the models (as read: the config's names stay as they are). */
function configAnswers(cfg: UserConfig, aliases: Aliases = {}): Answers {
  const a = (cfg as unknown as { tuneAnswers?: unknown }).tuneAnswers;
  return a && typeof a === "object" && !Array.isArray(a) ? canonicalAnswers(a as Answers, aliases).answers : {};
}

/** The names the user config keeps a key's answers under (its own, an alias an older strom kept them under). */
function configAnswerNames(cfg: UserConfig, key: string, aliases: Aliases): string[] {
  const a = (cfg as unknown as { tuneAnswers?: Answers }).tuneAnswers;
  return keysFor(a, key, aliases);
}

/** "B3", "b0003" → "B0003"; anything else as written. */
export function bookId(raw: string): string {
  return raw.trim().toUpperCase().replace(/^B(\d{1,3})$/u, (_m, n: string) => `B${n.padStart(4, "0")}`);
}

/** An archive as a host: no scheme, no path, small letters. */
export function hostName(raw: string): string {
  return raw
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/^[\p{L}\p{N}+.-]+:\/\//u, "")
    .replace(/[/?#].*$/u, "");
}

/** The part of a reset a change of strom's belongs to. */
export function partOf(action: string | undefined, what: string): ResetPart {
  if (action === "A1" || what.startsWith("views.")) return "sizes";
  if (action === "A2" || action === "A3" || what.startsWith("reading.")) return "batches";
  return "fetch";
}

const single = (o: Record<string, unknown>): unknown => {
  const vals = Object.values(o);
  return vals.length === 1 ? vals[0] : o;
};

/** The changes strom made in one store (a key's, a book's, an archive's), one per change with all its fields. */
function changesIn(store: object | undefined, key: string, where: ResetItem["where"]): ResetItem[] {
  const by = new Map<string, ResetItem>();
  for (const [field, t] of Object.entries(store ?? {}) as [string, Tuned | undefined][]) {
    if (!t || typeof t !== "object" || !("id" in t) || t.source !== "tuned") continue;
    const item = by.get(t.id) ?? {
      id: t.id,
      part: partOf(t.action, t.what),
      what: t.what,
      action: t.action,
      key,
      scope: t.scope,
      where,
      now: {},
      default: {},
      source: "tuned" as const,
      at: t.at,
      why: t.why,
      ...(t.basis && typeof t.basis === "object" ? { basis: t.basis } : {}),
      ...(t.reported ? { reported: t.reported } : {}),
      fields: [],
    };
    (item.now as Record<string, unknown>)[field] = t.value;
    (item.default as Record<string, unknown>)[field] = t.default;
    item.fields.push(field);
    by.set(t.id, item);
  }
  return [...by.values()];
}

/** The scope of an answer by its name in answers.json: "kind" (the research), "kind:B0003" (a book), "kind:<host>". */
function answerScope(slot: string): { kind: string; scope: string } {
  const i = slot.indexOf(":");
  if (i < 0) return { kind: slot, scope: "research" };
  const sub = slot.slice(i + 1);
  return { kind: slot.slice(0, i), scope: /^B\d+$/u.test(sub) ? `book:${sub}` : `host:${sub}` };
}

function answerItem(key: string, slot: string, a: AnswerRecord, scope: string, kind: string, where: ResetItem["where"]): ResetItem {
  const tasks = Array.isArray(a.tasks) ? a.tasks.filter((t): t is string => typeof t === "string") : [];
  return {
    id: `answer:${slot}`,
    part: "answers",
    what: `answer:${kind}`,
    key,
    scope,
    where,
    now: typeof a.choice === "string" ? a.choice : null,
    default: null,
    source: "answered",
    ...(typeof a.at === "string" ? { at: a.at } : {}),
    ...(typeof a.by === "string" ? { why: `answered (${a.by})`, by: a.by } : {}),
    fields: [slot],
    ...(tasks.length ? { tasks } : {}),
  };
}

/** Every key something is kept for: calibrations, changes, answers — of the user config and of this research. */
function allKeys(root: string, cfg: UserConfig, aliases: Aliases): string[] {
  const of = (rec: Record<string, { reported?: string } | unknown> | undefined) => Object.entries(rec ?? {}).map(([k, v]) => keyOf(k, (v as { reported?: string } | undefined)?.reported, aliases));
  return [...new Set([...of(cfg.viewSizes), ...of(cfg.tuning), ...Object.keys(configAnswers(cfg, aliases)), ...Object.keys(loadTuneState(root, aliases)), ...Object.keys(researchAnswers(root, aliases))])].sort();
}

/**
 * What a reset of these keys and parts would return: the user config's and this research's, read as they are — the
 * calibration and the key's own values only when no book or archive is named.
 */
export function resetItems(root: string, cfg: UserConfig, f: ResetFilter): ResetItem[] {
  const aliases = loadAliases(root);
  const keys = f.keys === "all" ? allKeys(root, cfg, aliases) : f.keys;
  const state = loadTuneState(root, aliases);
  const answers = researchAnswers(root, aliases);
  const fromCfg = configAnswers(cfg, aliases);
  const narrowed = f.recordset !== undefined || f.host !== undefined;
  const wanted = (scope: string) => !narrowed || (f.recordset !== undefined && scope === `book:${f.recordset}`) || (f.host !== undefined && scope === `host:${f.host}`);
  const out: ResetItem[] = [];
  for (const key of keys) {
    const { agent, model } = splitKey(key);
    const cal: ViewCalibration | undefined = calibrationOf(cfg, key, aliases);
    if (cal && !narrowed) {
      const d = defaultViewSizes(agent, model);
      out.push({ id: "calibration", part: "sizes", what: "calibration", key, scope: "key", where: "config", now: { find: cal.find, read: cal.read }, default: { find: d.find, read: d.read }, source: "calibrated", at: cal.at, why: `measured on ${cal.sample} known records`, sample: cal.sample, fields: ["viewSizes"] });
    }
    out.push(...changesIn(keyTuningOf(cfg, key, aliases), key, "config"));
    const tt = state[key];
    for (const b of Object.values(tt?.books ?? {})) out.push(...changesIn(b, key, "research"));
    for (const h of Object.values(tt?.hosts ?? {})) out.push(...changesIn(h, key, "research"));
    if (!narrowed) for (const [kind, a] of Object.entries(fromCfg[key] ?? {})) if (a && typeof a === "object") out.push(answerItem(key, kind, a, "key", kind, "config"));
    for (const [slot, a] of Object.entries(answers[key] ?? {})) {
      if (!a || typeof a !== "object") continue;
      const { kind, scope } = answerScope(slot);
      out.push(answerItem(key, slot, a, scope, kind, "research"));
    }
  }
  const order = (s: string) => (s === "key" ? 0 : s === "research" ? 1 : s.startsWith("book:") ? 2 : 3);
  return out
    .filter((i) => f.parts.has(i.part) && wanted(i.scope))
    .sort((a, b) => a.key.localeCompare(b.key) || order(a.scope) - order(b.scope) || a.scope.localeCompare(b.scope) || RESET_PARTS.indexOf(a.part) - RESET_PARTS.indexOf(b.part) || a.what.localeCompare(b.what));
}

/** How many values another research keeps for itself (its books, archives and answers): said, never returned from here. */
export function researchHeld(root: string): number {
  const state = loadTuneState(root);
  let n = 0;
  for (const tt of Object.values(state)) {
    for (const b of Object.values(tt?.books ?? {})) n += new Set(allTuned(b).map((t) => t.id)).size;
    for (const h of Object.values(tt?.hosts ?? {})) n += new Set(allTuned(h).map((t) => t.id)).size;
  }
  for (const a of Object.values(researchAnswers(root))) n += Object.keys(a ?? {}).length;
  return n;
}

function emptyObject(o: unknown): boolean {
  return !o || (typeof o === "object" && !Object.keys(o).length);
}

/**
 * Return the items to their defaults — the user config as it is now (another strom may have saved meanwhile), this
 * research's state and answers — and log it. The units: the scans of each scope now, for the hold (tune.ts heldBack).
 */
export function applyReset(root: string, settings: Settings, items: ResetItem[], o: { units?: Unit[]; key?: string; now?: number } = {}): TuneResetEntry | undefined {
  if (!items.length) return undefined;
  const at = new Date(o.now ?? Date.now()).toISOString();
  const release = acquireLock(tuneLockFile(root), { owner: "strom tune reset", waitMs: 10_000, staleMs: 60_000 });
  try {
    settings.reload();
    const cfg = settings.config;
    let cfgChanged = false;
    // this research's own under the keys of the models first (once, with a copy of each file as it was)
    const aliases = loadAliases(root);
    migrateTuneKeys(root, aliases);
    const state: TuneState = loadTuneState(root, aliases);
    let stateChanged = false;
    const answers = researchAnswers(root, aliases);
    let answersChanged = false;
    for (const i of items) {
      if (i.source === "calibrated") cfgChanged = forgetCalibration(cfg, i.key, aliases) || cfgChanged;
      else if (i.source === "tuned" && i.where === "config") {
        // the key's own, and what an older strom kept under an alias of it
        const names = keysFor(cfg.tuning, i.key, aliases, (v) => v?.reported);
        if (!names.length) continue;
        for (const name of names) {
          const kt = cfg.tuning![name] as Record<string, unknown>;
          for (const f of i.fields) if (f in kt) delete kt[f];
          if (!allTuned(kt).length) delete cfg.tuning![name];
        }
        if (emptyObject(cfg.tuning)) delete cfg.tuning;
        cfgChanged = true;
      } else if (i.source === "tuned") {
        const tt = state[i.key];
        const name = i.scope.slice(i.scope.indexOf(":") + 1);
        const group = i.scope.startsWith("book:") ? tt?.books : tt?.hosts;
        const slot = group?.[name] as Record<string, unknown> | undefined;
        if (!tt || !group || !slot) continue;
        for (const f of i.fields) delete slot[f];
        if (emptyObject(slot)) delete group[name];
        if (emptyObject(tt.books) && emptyObject(tt.hosts)) delete state[i.key];
        stateChanged = true;
      } else if (i.where === "config") {
        const all = (cfg as unknown as { tuneAnswers?: Answers }).tuneAnswers;
        const names = configAnswerNames(cfg, i.key, aliases);
        if (!all || !names.length) continue;
        for (const name of names) {
          for (const f of i.fields) delete all[name]![f];
          if (emptyObject(all[name])) delete all[name];
        }
        if (emptyObject(all)) delete (cfg as unknown as { tuneAnswers?: unknown }).tuneAnswers;
        cfgChanged = true;
      } else {
        if (!answers[i.key]) continue;
        for (const f of i.fields) delete answers[i.key]![f];
        if (emptyObject(answers[i.key])) delete answers[i.key];
        answersChanged = true;
      }
    }
    if (cfgChanged) settings.save();
    if (stateChanged) saveTuneState(root, state);
    if (answersChanged) {
      fs.mkdirSync(tuneDir(root), { recursive: true });
      writeFileAtomic(answersFile(root), JSON.stringify(answers, null, 2) + "\n");
    }
    const units = o.units ?? [];
    const logged: ResetLogItem[] = items.map((i) => ({
      id: i.id,
      key: i.key,
      scope: i.scope,
      what: i.what,
      part: i.part,
      source: i.source,
      from: i.now && typeof i.now === "object" ? single(i.now as Record<string, unknown>) : i.now,
      to: i.default && typeof i.default === "object" ? single(i.default as Record<string, unknown>) : i.default,
      ...(i.at ? { at: i.at } : {}),
      ...(i.why ? { why: i.why } : {}),
      ...(i.reported ? { reported: i.reported } : {}),
      ...(i.source === "tuned" ? { scans: scopeScans(units, i.key, i.scope) } : {}),
    }));
    const entry: TuneResetEntry = { at, by: "reset", ...(o.key ? { key: o.key } : {}), items: logged };
    appendTuneLog(root, [entry]);
    return entry;
  } finally {
    release();
  }
}

// ── worse after a change (8.4) ───────────────────────────────────────────────────────────────────────────────────────

export interface Worsening {
  id: string;
  key: string;
  scope: string;
  what: string;
  action?: string;
  part: ResetPart;
  at: string;
  /** (a) the readings less sure or readers without a result; (b) only dearer, the readings no surer. */
  kind: "accuracy" | "cost";
  metric: "M5" | "M10" | "M1";
  before: number;
  after: number;
  ratio?: number;
  /** The scans before and after. */
  nb: number;
  na: number;
  /** The cost: in dollars, else the new tokens per scan. */
  unit?: "usd" | "tokens";
  recommend: "reset" | "keep";
  command: string;
}

/**
 * The changes strom made by itself for a key (the user config's and this research's books) after which the reading got
 * clearly worse: compared over the readings just before the change and those since — only once enough came since.
 */
export function worsenings(root: string, cfg: UserConfig, key: string, units: Unit[], state: TuneState = loadTuneState(root)): Worsening[] {
  const changes = [...changesIn(keyTuningOf(cfg, key, loadAliases(root)), key, "config"), ...Object.values(state[key]?.books ?? {}).flatMap((b) => changesIn(b, key, "research"))].filter((c) => c.scope === "key" || c.scope.startsWith("book:"));
  const mine = units.filter((u) => u.key === key).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const out: Worsening[] = [];
  for (const ch of changes) {
    const at = Date.parse(ch.at ?? "");
    if (!Number.isFinite(at)) continue;
    const book = ch.scope.startsWith("book:") ? ch.scope.slice(5) : undefined;
    const counts = (u: Unit) => {
      const bs = book ? (u.books[book] ? [u.books[book]!] : []) : Object.values(u.books);
      return { scans: bs.reduce((n, b) => n + b.scans, 0), read: bs.reduce((n, b) => n + b.read, 0), unsure: bs.reduce((n, b) => n + b.unsure, 0) };
    };
    const after = mine.filter((u) => Date.parse(u.at) >= at && counts(u).scans > 0);
    const before: Unit[] = [];
    let total = 0;
    for (const u of mine.filter((u) => Date.parse(u.at) < at && counts(u).scans > 0).reverse()) {
      if (total >= WORSENING.beforeScans) break;
      before.push(u);
      total += counts(u).scans;
    }
    const sum = (us: Unit[]) => us.reduce((s, u) => ({ scans: s.scans + counts(u).scans, read: s.read + counts(u).read, unsure: s.unsure + counts(u).unsure }), { scans: 0, read: 0, unsure: 0 });
    const a = sum(after);
    const b = sum(before);
    const need = book ? WORSENING.after.book : WORSENING.after.key;
    if (a.scans < need.scans || after.length < need.units || !b.scans) continue;
    // (a) accuracy: clearly more unsure readings, or readers without a result (of the key's readers)
    const worse = (k1: number, n1: number, k0: number, n0: number) => {
      if (!n1 || !n0) return undefined;
      const w1 = wilson(k1, n1);
      const w0 = wilson(k0, n0);
      return w1.p > 0 && w1.p >= WORSENING.accuracy * w0.p && w1.lo > w0.hi ? { before: w0.p, after: w1.p, ratio: w0.p > 0 ? w1.p / w0.p : undefined } : undefined;
    };
    // the readers that read (never one a login, a plan's limit or a failure stopped)
    const readers = (us: Unit[]) => us.filter(isReading);
    const m5 = worse(a.unsure, a.read, b.unsure, b.read);
    const m10 = book ? undefined : worse(readers(after).filter((u) => u.noResult).length, readers(after).length, readers(before).filter((u) => u.noResult).length, readers(before).length);
    // (b) cost: per scan clearly more, the readings no surer (the lower end of their improvement not above nothing)
    const cost = (us: Unit[]): { v: number; unit: "usd" | "tokens" } | undefined => {
      const share = (u: Unit) => (book ? counts(u).scans / Math.max(1, Object.values(u.books).reduce((m, x) => m + x.scans, 0)) : 1);
      const priced = us.filter((u) => u.usd !== undefined);
      const s = priced.reduce((n, u) => n + counts(u).scans, 0);
      if (s) return { v: priced.reduce((n, u) => n + u.usd! * share(u), 0) / s, unit: "usd" };
      const tok = us.filter((u) => u.tokens);
      const t = tok.reduce((n, u) => n + counts(u).scans, 0);
      return t ? { v: tok.reduce((n, u) => n + u.tokens!.new * share(u), 0) / t, unit: "tokens" } : undefined;
    };
    const c0 = cost(before);
    const c1 = cost(after);
    const improved = b.read && a.read ? wilson(b.unsure, b.read).lo - wilson(a.unsure, a.read).hi > 0 : false;
    const dearer = c0 && c1 && c0.unit === c1.unit && c0.v > 0 && c1.v >= WORSENING.cost * c0.v && !improved ? { before: c0.v, after: c1.v, ratio: c1.v / c0.v, unit: c1.unit } : undefined;
    const hit = m5 ? { metric: "M5" as const, kind: "accuracy" as const, ...m5 } : m10 ? { metric: "M10" as const, kind: "accuracy" as const, ...m10 } : dearer ? { metric: "M1" as const, kind: "cost" as const, ...dearer } : undefined;
    if (!hit) continue;
    out.push({
      id: ch.id,
      key,
      scope: ch.scope,
      what: ch.what,
      ...(ch.action ? { action: ch.action } : {}),
      part: ch.part,
      at: ch.at!,
      kind: hit.kind,
      metric: hit.metric,
      before: hit.before,
      after: hit.after,
      ...(hit.ratio !== undefined && Number.isFinite(hit.ratio) ? { ratio: Math.round(hit.ratio * 100) / 100 } : {}),
      nb: b.scans,
      na: a.scans,
      ...("unit" in hit ? { unit: hit.unit } : {}),
      // a change towards accuracy that made only the cost higher is kept: returning it stays the person's option
      recommend: hit.kind === "accuracy" ? "reset" : "keep",
      command: `strom media calibrate --reset --only ${ch.part}${book ? ` --recordset ${book}` : ""}`,
    });
  }
  return out.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === "accuracy" ? -1 : 1));
}
