// What strom changes by itself in how scans are read, from what it measured of the reading (core/readstats.ts): only
// towards accuracy or towards fewer requests to an archive — never a smaller view, a cheaper model, a pass that could
// miss an entry, nor anything that asks an archive for more (that is a person's question, with the requests it takes).
//
//   A1  a book read worse than the others (M5) or shown enlarged (M6): its whole image at reading size, a double page
//       in halves, read up to what the model takes — from the scans already here, no request more
//   A2  context clears, views opened again, readers without a result (M3, M4, M10): smaller batches — fewer scans per
//       reader or batch, fewer views a call, never below half the default
//   A3  the context measured (M4): a reader stops after the views it holds — only fewer than the default
//   A4  an archive whose limit was reached (M8): whole images first, halves and parts only of the candidates
//   A5  a book whose portal gave no sharper part (M7): no more parts of it offered
//   A7  images fetched and never read (M11): only what a task reads fetched, the next batch once the last is read
//   A6  any of these back to the default once its signal has been gone TUNING.backAfterDays and new readings came
//
// Decided after each session (with the summary, core/tidy.ts autoTidy), at strom media calibrate --report and at strom
// doctor — never within a session: a session goes by the values of its start (each change keeps the value before it,
// `from`, and its time). Per key of agent and model (core/modelkey.ts: the model the agent said it ran on — an alias
// asked goes by the model it runs on, another version is another key and starts again). What holds for the model everywhere is kept in the user
// config (`tuning`), what is of a book or an archive of this research in .strom/tune/state.json; every change logged in
// .strom/tune/log.jsonl. Nothing in data/, no commit; strom tidy never touches .strom/tune. Each change carries its id,
// key, scope, value, default, time, reason and source, so a reset can list and undo it. An archive: nothing at all.
// The setting tune.auto off: nothing changed by itself and what was changed not used.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { configFile, Settings, type UserConfig } from "./config.ts";
import { readJsonIfExists, writeFileAtomic } from "./json.ts";
import { acquireLock } from "./lock.ts";
import { isArchive } from "./mode.ts";
import { defaultViewSizes, researchKey, viewSizes, type ViewSizes } from "./viewsizes.ts";
import { aliasPairsOf, canonicalUnits, groups, keepBeforeKeys, otherUnits, READING_DEFAULTS, readJournal, refreshRollup, stopContext, summarize, THRESHOLDS, TUNING, UNKNOWN_KEY, type KeyReport, type Recommendation, type Rollup, type Signal, type TunedItem, type Unit } from "./readstats.ts";
import { keyed, keyOf, keysFor, loadAliases, modelId, noteAliases, resolveKey, splitKey, type Aliases } from "./modelkey.ts";
import type { TreeConfig } from "./model.ts";
import type { Tree } from "./tree.ts";

const DAY = 24 * 3600_000;
/** The revision of the rules below: a change of what they do starts again where a reset held them back. */
export const TUNE_REV = 1;

/** One value strom set by itself. */
export interface Tuned<T extends number | boolean | string = number | boolean | string> {
  /** T + a short hash of the key, the action and the scope: the same for every value of one change. */
  id: string;
  action: string;
  what: string;
  scope: string;
  value: T;
  default: T;
  /** The value before this change: what a session that began before it goes by. */
  from: T;
  at: string;
  why: string;
  basis: Record<string, number | string>;
  rev: number;
  /** The last time its signal was there (A6 counts from it). */
  seen: string;
  /** The model the agent said when it was set. */
  reported?: string;
  source: "tuned";
}

/** What holds for an agent and model in every research (the user config's `tuning`). */
export interface KeyTuning {
  reported?: string;
  batch?: Tuned<number>;
  viewsPerCall?: Tuned<number>;
  viewsStop?: Tuned<number>;
  /** The context at the first clear, as measured: the basis of viewsStop. */
  ctx?: Tuned<number>;
}

export interface BookTuning {
  find?: Tuned<number>;
  read?: Tuned<number>;
  halves?: Tuned<boolean>;
  noSharper?: Tuned<boolean>;
  fetch?: Tuned<string>;
}

export interface HostTuning {
  order?: Tuned<string>;
  fetch?: Tuned<string>;
}

/** What holds for a key in this research only: its books and archives. */
export interface TreeTuning {
  reported?: string;
  books: Record<string, BookTuning>;
  hosts: Record<string, HostTuning>;
}

export type TuneState = Record<string, TreeTuning>;

export interface TuneLogEntry {
  at: string;
  id: string;
  action: string;
  key: string;
  scope: string;
  what: string;
  from: unknown;
  to: unknown;
  why: string;
  basis?: Record<string, number | string>;
  by: "selftune" | "reset";
}

/** One value a person returned to the default (strom media calibrate --reset, core/tunereset.ts). */
export interface ResetLogItem {
  id: string;
  key: string;
  scope: string;
  what: string;
  part: string;
  source: string;
  from: unknown;
  to: unknown;
  at?: string;
  why?: string;
  reported?: string;
  /** The scans of its scope when it was returned: enough readings since set it free again (RESET_HOLD). */
  scans?: number;
}

/** A reset by a person: everything it returned, in one line of the log. */
export interface TuneResetEntry {
  at: string;
  by: "reset";
  key?: string;
  items: ResetLogItem[];
}

/**
 * What a person returned to the default is not set again by itself for TUNING.heldDays — or until the data changed:
 * the readings of its scope since grew by growShare of those at the reset and by at least growUnits scans, or the agent
 * says another model under the same alias.
 */
export const RESET_HOLD = { growShare: 0.5, growUnits: 10 } as const;

// ── where it lies ──────────────────────────────────────────────────────────────────────────────────────────────────

export function tuneDir(root: string): string {
  return path.join(root, ".strom", "tune");
}
const stateFile = (root: string) => path.join(tuneDir(root), "state.json");
/** The lock of what is decided about the tuning of a research (its state.json and the user config's tuning). */
export const tuneLockFile = (root: string): string => `${stateFile(root)}.lock`;
const logFile = (root: string) => path.join(tuneDir(root), "log.jsonl");

function rawTuneState(root: string): TuneState {
  try {
    const s = readJsonIfExists<TuneState>(stateFile(root));
    return s && typeof s === "object" && !Array.isArray(s) ? s : {};
  } catch {
    return {};
  }
}

/** What strom set for this research's books and archives, by the key of the model (whatever version kept it). */
export function loadTuneState(root: string, aliases: Aliases = loadAliases(root)): TuneState {
  return canonicalState(rawTuneState(root), aliases).state;
}

/** The newer of two values set for one field (by when each was set). */
const newer = <T extends Tuned | undefined>(a: T, b: T): T => (!a ? b : !b ? a : b.at > a.at ? b : a);

/** Two stores of one key joined: each field's newer value (the model said kept apart). */
function joinSlots(into: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [f, v] of Object.entries(from)) {
    if (f === "reported") continue;
    into[f] = newer(into[f] as Tuned | undefined, v as Tuned | undefined);
  }
}

/** When the newest value of a store was set ("" none). */
function lastAt(store: object): string {
  return allTuned(store).reduce((m, t) => (t.at > m ? t.at : m), "");
}

/**
 * The state under the key of the model each part of it was set for (core/modelkey.ts): the model said it kept with it,
 * else its key resolved; two names of one key joined (each value the newer). Whether anything was named otherwise.
 */
export function canonicalState(raw: TuneState, aliases: Aliases): { state: TuneState; changed: boolean } {
  const out: TuneState = {};
  let changed = false;
  const names = Object.keys(raw).sort((a, b) => lastAt(raw[a] ?? {}).localeCompare(lastAt(raw[b] ?? {})));
  for (const k of names) {
    const tt = raw[k];
    if (!tt || typeof tt !== "object") continue;
    const key = keyOf(k, tt.reported, aliases, lastAt(tt) || undefined);
    if (key !== k) changed = true;
    const into = out[key];
    if (!into) {
      out[key] = { ...tt, books: { ...(tt.books ?? {}) }, hosts: { ...(tt.hosts ?? {}) } };
      continue;
    }
    changed = true;
    for (const part of ["books", "hosts"] as const)
      for (const [name, slot] of Object.entries(tt[part] ?? {})) {
        const mine = ((into[part] as Record<string, Record<string, unknown>>)[name] = { ...((into[part] as Record<string, Record<string, unknown>>)[name] ?? {}) });
        joinSlots(mine, slot as Record<string, unknown>);
      }
    if (tt.reported) into.reported = tt.reported;
  }
  return { state: out, changed };
}

/**
 * The state and the answers of this research written under the keys of the models (core/modelkey.ts), each once with a
 * copy of it as it was beside it (<name>.before-keys, never written over). Under the lock of the tuning (the caller's);
 * the same again changes nothing; the journals (log.jsonl, .strom/metrics) are never rewritten — read under the keys.
 */
export function migrateTuneKeys(root: string, aliases: Aliases = loadAliases(root)): { state: boolean; answers: boolean } {
  const done = { state: false, answers: false };
  try {
    const s = canonicalState(rawTuneState(root), aliases);
    if (s.changed) {
      keepBeforeKeys(stateFile(root));
      saveTuneState(root, s.state);
      done.state = true;
    }
  } catch {
    // read under the keys next time all the same
  }
  try {
    const file = path.join(tuneDir(root), "answers.json");
    const raw = readJsonIfExists<Record<string, Record<string, unknown>>>(file);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const a = canonicalAnswers(raw, aliases);
      if (a.changed) {
        keepBeforeKeys(file);
        writeFileAtomic(file, JSON.stringify(a.answers, null, 2) + "\n");
        done.answers = true;
      }
    }
  } catch {
    // read under the keys next time all the same
  }
  return done;
}

/** The model the answers of a key were given for, as their basis keeps it. */
const answerModel = (v: unknown): string | undefined => {
  for (const a of Object.values((v ?? {}) as Record<string, { basis?: { reported?: unknown } } | undefined>)) if (typeof a?.basis?.reported === "string") return a.basis.reported;
  return undefined;
};

/** Answers kept by key under the keys of the models: two names of one key joined (each answer the newer). */
export function canonicalAnswers<T>(raw: Record<string, Record<string, T>>, aliases: Aliases): { answers: Record<string, Record<string, T>>; changed: boolean } {
  const out: Record<string, Record<string, T>> = {};
  let changed = false;
  for (const [k, slots] of Object.entries(raw)) {
    if (!slots || typeof slots !== "object") continue;
    const key = keyOf(k, answerModel(slots), aliases);
    if (key !== k) changed = true;
    const into = (out[key] ??= {});
    for (const [slot, a] of Object.entries(slots)) {
      const cur = into[slot] as { at?: unknown } | undefined;
      if (cur) changed = true;
      if (!cur || String((a as { at?: unknown } | undefined)?.at ?? "") > String(cur.at ?? "")) into[slot] = a;
    }
  }
  return { answers: out, changed };
}

export function saveTuneState(root: string, s: TuneState): void {
  fs.mkdirSync(tuneDir(root), { recursive: true });
  writeFileAtomic(stateFile(root), JSON.stringify(s, null, 1) + "\n");
}

/** The log of the tuning, each line's key that of the model it was for (core/modelkey.ts) — the file never rewritten. */
export function readTuneLog(root: string, aliases: Aliases = loadAliases(root)): TuneLogEntry[] {
  const log = readJournal(logFile(root)) as unknown as (TuneLogEntry & { items?: { key?: unknown; reported?: unknown }[] })[];
  for (const e of log) {
    const at = typeof e.at === "string" ? e.at : undefined;
    if (typeof e.key === "string") e.key = resolveKey(e.key, aliases, at);
    if (Array.isArray(e.items)) for (const i of e.items) if (i && typeof i.key === "string") i.key = keyOf(i.key, typeof i.reported === "string" ? i.reported : undefined, aliases, at);
  }
  return log;
}

export function appendTuneLog(root: string, entries: (TuneLogEntry | TuneResetEntry)[]): void {
  if (!entries.length) return;
  fs.mkdirSync(tuneDir(root), { recursive: true });
  fs.appendFileSync(logFile(root), entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

export { splitKey } from "./modelkey.ts";

export function tuneId(key: string, action: string, scope: string): string {
  return `T${crypto.createHash("sha1").update(`${key}|${action}|${scope}`).digest("hex").slice(0, 6)}`;
}

/** Whether what strom set by itself is used (tune.auto, on unless a person said off). */
export function tuningOn(settings: Settings): boolean {
  return settings.tuneAuto();
}

/** The value a session goes by: the one set before it began, else the one before the change. */
export function pinned<T extends number | boolean | string>(t: Tuned<T> | undefined, since?: string): T | undefined {
  if (!t) return undefined;
  if (since && t.at > since) return t.from === t.default ? undefined : t.from;
  return t.value;
}

// ── what the agents and strom go by ─────────────────────────────────────────────────────────────────────────────────

/** How the scans are read by an agent and model: the defaults, or what strom set by itself for it. */
export interface Reading {
  key: string;
  /** Scans per batch or per delegate. */
  batch: number;
  /** Views before a reader stops and reports (or writes down and goes on). */
  viewsStop: number;
  /** Views in one call of strom media view. */
  viewsPerCall: number;
  /** Views per reader of strom read. */
  readerBatch: number;
  /** The changes in force (their ids), none: the defaults. */
  tuned: string[];
}

/**
 * The reading of a key from the user config (tuning off: the defaults); `since` a session's start; `root` the research
 * whose aliases name what an older strom kept it under.
 */
export function readingOf(cfg: UserConfig, key: string, o: { since?: string | undefined; on?: boolean; root?: string | undefined } = {}): Reading {
  const t = o.on === false ? undefined : keyTuningOf(cfg, key, loadAliases(o.root));
  const batch = pinned(t?.batch, o.since) ?? READING_DEFAULTS.batch;
  const viewsStop = pinned(t?.viewsStop, o.since) ?? READING_DEFAULTS.viewsStop;
  const viewsPerCall = pinned(t?.viewsPerCall, o.since) ?? READING_DEFAULTS.viewsPerCall;
  // a reader of strom read as much smaller as a batch is, never more views than a reader stops at
  const readerBatch = Math.max(2, Math.min(viewsStop, Math.round((READING_DEFAULTS.readerBatch * batch) / READING_DEFAULTS.batch)));
  const tuned = [...new Set([t?.batch, t?.viewsStop, t?.viewsPerCall].filter((x): x is Tuned<number> => !!x && pinned(x, o.since) !== undefined).map((x) => x.id))];
  return { key, batch, viewsStop, viewsPerCall, readerBatch, tuned };
}

/** The reading of an agent and its model (model.lead, else model.vision — as the views are sized). */
export function readingFor(settings: Settings, agent: string, tree?: TreeConfig, o: { model?: string | undefined; since?: string | undefined; root?: string | undefined } = {}): Reading {
  const key = researchKey(settings, agent, tree, o.root, o.model);
  return readingOf(settings.config, key, { since: o.since, on: tuningOn(settings), root: o.root });
}

/** What the user config keeps for a key: its own, else what an older strom kept under an alias of it. */
export function keyTuningOf(cfg: UserConfig, key: string, aliases?: Aliases): KeyTuning | undefined {
  return keyed(cfg.tuning, key, aliases, (v) => v?.reported);
}

/** What holds for one book of this research (tuning off: nothing). */
export function bookTuned(state: TuneState, key: string, book: string | undefined, since?: string): { find?: number; read?: number; halves?: boolean; noSharper?: boolean; onlyNeeded?: boolean; ids: string[]; why?: string; at?: string } {
  const b = book ? state[key]?.books?.[book] : undefined;
  if (!b) return { ids: [] };
  const find = pinned(b.find, since);
  const read = pinned(b.read, since);
  const halves = pinned(b.halves, since);
  const noSharper = pinned(b.noSharper, since);
  const onlyNeeded = pinned(b.fetch, since) === "only-needed";
  const used = ([b.find, b.read, b.halves, b.noSharper, b.fetch] as (Tuned | undefined)[]).filter((x): x is Tuned => !!x && pinned(x, since) !== undefined);
  return {
    ...(find !== undefined ? { find } : {}),
    ...(read !== undefined ? { read } : {}),
    ...(halves ? { halves } : {}),
    ...(noSharper ? { noSharper } : {}),
    ...(onlyNeeded ? { onlyNeeded } : {}),
    ids: [...new Set(used.map((x) => x.id))],
    ...(used[0] ? { why: used[0].why, at: used[0].at } : {}),
  };
}

/** What holds for one archive (host) of this research. */
export function hostTuned(state: TuneState, key: string, host: string | undefined, since?: string): { wholeFirst?: boolean; onlyNeeded?: boolean; ids: string[] } {
  const h = host ? state[key]?.hosts?.[host] : undefined;
  if (!h) return { ids: [] };
  const wholeFirst = pinned(h.order, since) === "whole-first";
  const onlyNeeded = pinned(h.fetch, since) === "only-needed";
  const used = ([h.order, h.fetch] as (Tuned | undefined)[]).filter((x): x is Tuned => !!x && pinned(x, since) !== undefined);
  return { ...(wholeFirst ? { wholeFirst } : {}), ...(onlyNeeded ? { onlyNeeded } : {}), ids: [...new Set(used.map((x) => x.id))] };
}

/**
 * The view sizes of a book: what strom set for it (only bigger: a book read worse) before a calibration before the
 * defaults — never more than the model takes. `tuned` names the change, for the record of the views.
 */
export function bookViewSizes(base: ViewSizes, state: TuneState, book: string | undefined, since?: string): ViewSizes & { tuned?: string; halves?: boolean } {
  const b = bookTuned(state, base.key, book, since);
  if (!b.ids.length || (b.find === undefined && b.read === undefined && !b.halves)) return base;
  return {
    ...base,
    find: Math.min(base.max, Math.max(base.find, b.find ?? 0)),
    read: Math.min(base.max, Math.max(base.read, b.read ?? 0)),
    ...(b.halves ? { halves: true } : {}),
    tuned: b.ids[0]!,
  };
}

/** The state of this research for its views and fetches, empty when tuning is off or in an archive. */
export function treeTuning(tree: Tree, settings: Settings): TuneState {
  if (isArchive(tree) || !tuningOn(settings)) return {};
  return loadTuneState(tree.root);
}

// ── deciding ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** One change wanted now: its values by field, with its reason. */
interface Want {
  action: string;
  what: string;
  scope: string;
  values: Record<string, number | boolean | string>;
  defaults: Record<string, number | boolean | string>;
  why: string;
  basis: Record<string, number | string>;
}

const pct = (n: number | undefined) => (n === undefined ? "–" : `${Math.round(n * 100)} %`);

/**
 * The reason of a change in a sentence with its figures (English: an agent and strom config read it) and the figures
 * themselves (basis: a person reads the reason from them in the research language, cli/tunereset.ts).
 */
function reasonOf(rec: Recommendation, r: KeyReport): { why: string; basis: Record<string, number | string> } {
  const sig = (m: string) => r.signals.find((s) => s.metric === m && (s.scope === rec.scope || s.scope === "key")) as Signal | undefined;
  const scope = rec.scope.replace(/^(book|host):/, "");
  const parts: string[] = [];
  const basis: Record<string, number | string> = {};
  for (const m of rec.because) {
    const s = sig(m);
    if (!s) continue;
    basis[m] = Math.round(s.value * 1000) / 1000;
    basis[`${m}.n`] = s.n;
    if (s.base !== undefined) basis[`${m}.base`] = Math.round(s.base * 1000) / 1000;
    // the rest of its figures, for the reason in the person's language (the reset's listing)
    if (s.of !== undefined) basis[`${m}.of`] = s.of;
    if (m === "M8") Object.assign(basis, { "M8.wait": s.extra?.waitMin ?? 0, "M8.later": s.extra?.later ?? 0 });
    if (m === "M4" && s.extra?.ctx) basis["M4.ctx"] = s.extra.ctx;
    switch (m) {
      case "M5":
        parts.push(`unsure readings ${pct(s.value)} of ${s.n} against ${pct(s.base)} of the other books`);
        break;
      case "M6":
        parts.push(`enlarged views ${pct(s.value)} of ${s.n} against ${pct(s.base)}`);
        break;
      case "M7":
        parts.push(`${s.n} parts the portal gave no sharper than the whole image`);
        break;
      case "M8":
        parts.push(`waited for its limit in ${s.value} of ${s.n} sessions (${s.extra?.waitMin ?? 0} min, used up ${s.extra?.later ?? 0}×)`);
        break;
      case "M11":
        parts.push(`${pct(s.value)} of the images fetched never read (${s.n} of ${s.of ?? 0})`);
        break;
      case "M3":
        parts.push(`views opened again after a context clear in ${s.n} of the last ${s.of ?? 0} readers`);
        break;
      case "M4":
        parts.push(`the context cleared in ${s.n} of the last ${s.of ?? 0} readers${s.extra?.ctx ? `, the first at about ${s.extra.ctx} tokens` : ""}`);
        break;
      case "M10":
        parts.push(`readers without a result ${s.n} of the last ${s.of ?? 0}`);
        break;
    }
  }
  const said = parts.join("; ") || rec.because.join(", ");
  return { why: rec.scope === "key" ? said : `${scope}: ${said}`, basis };
}

/** The changes the summary of a key asks for: only those towards accuracy or fewer requests (auto). */
function wanted(r: KeyReport, units: Unit[] = []): Want[] {
  const { agent, model } = splitKey(r.key);
  const d = defaultViewSizes(agent, model);
  const out: Want[] = [];
  for (const rec of r.recommend) {
    if (!rec.auto || rec.requestsMore > 0) continue;
    const { why, basis } = reasonOf(rec, r);
    switch (rec.id) {
      case "A1":
        out.push({ action: "A1", what: "views.size", scope: rec.scope, values: { find: d.max, read: d.max, halves: true }, defaults: { find: d.find, read: d.read, halves: false }, why: `${why} → the whole image at reading size (${d.max} px), a double page in halves`, basis });
        break;
      case "A2": {
        const batch = rec.to ?? Math.ceil(READING_DEFAULTS.batch * TUNING.smallest);
        const call = Math.max(1, Math.ceil(READING_DEFAULTS.viewsPerCall * TUNING.smallest));
        out.push({ action: "A2", what: "reading.batch", scope: "key", values: { batch, viewsPerCall: call }, defaults: { batch: READING_DEFAULTS.batch, viewsPerCall: READING_DEFAULTS.viewsPerCall }, why: `${why} → about ${batch} scans a batch instead of ${READING_DEFAULTS.batch}, at most ${call} views a call instead of ${READING_DEFAULTS.viewsPerCall}`, basis });
        break;
      }
      case "A3":
        // decided below, by the tokens of a reader's view
        break;
      case "A4":
        out.push({ action: "A4", what: "fetch.order", scope: rec.scope, values: { order: "whole-first" }, defaults: { order: "as-asked" }, why: `${why} → whole images first, halves and parts only of the candidates`, basis });
        break;
      case "A5":
        out.push({ action: "A5", what: "parts.none", scope: rec.scope, values: { noSharper: true }, defaults: { noSharper: false }, why: `${why} → no more parts of this book offered`, basis });
        break;
      case "A7":
        out.push({ action: "A7", what: "fetch.only-needed", scope: rec.scope, values: { fetch: "only-needed" }, defaults: { fetch: "as-asked" }, why: `${why} → only what a task reads fetched, the next batch once the last is read`, basis });
        break;
    }
  }
  const stop = readerStop(r, units);
  if (stop) {
    const sig = r.signals.find((s) => s.metric === stop.metric);
    const after = `a reader's view about ${stop.perView} tokens → a reader stops after about ${stop.views} views instead of ${READING_DEFAULTS.viewsStop}`;
    out.push({
      action: "A3",
      what: "reading.views",
      scope: "key",
      values: { viewsStop: stop.views, ctx: stop.ctx },
      defaults: { viewsStop: READING_DEFAULTS.viewsStop, ctx: 0 },
      why:
        stop.metric === "M4"
          ? `the context cleared in ${sig?.n ?? 0} of the last ${sig?.of ?? 0} readers, the first at about ${stop.ctx} tokens, ${after}`
          : `the context never cleared, yet it grew past ${stop.ctx} tokens with more than ${READING_DEFAULTS.viewsStop} views in ${sig?.n ?? 0} of the last ${sig?.of ?? 0} sessions (about ${sig?.extra?.views ?? 0} views, ${sig?.extra?.peak ?? 0} tokens), ${after} — the main agent writes down what it found before more`,
      basis:
        stop.metric === "M4"
          ? { M4: sig?.n ?? 0, "M4.of": sig?.of ?? 0, ctx: stop.ctx, viewTokens: stop.perView }
          : { M12: sig?.n ?? 0, "M12.of": sig?.of ?? 0, "M12.views": sig?.extra?.views ?? 0, "M12.peak": sig?.extra?.peak ?? 0, ctx: stop.ctx, viewTokens: stop.perView },
    });
  }
  return out;
}

/**
 * The tokens of one view a reader holds: the summary's own figure where it gives one, else from the units whose
 * context cleared (the readers' halves and pages, ~4k tokens — not the key's average, which the main agent's small
 * crops pull down: found on real data, 1,695 tokens gave a stop of 52, never lower), else from the readers. A view of
 * w×h px is about w·h/750 tokens for Claude Code; another agent's is not known — nothing.
 */
export function readerViewTokens(r: KeyReport, units: Unit[]): number | undefined {
  const said = r.context as { readerViewTokens?: unknown; viewTokens?: unknown };
  for (const v of [said.readerViewTokens, said.viewTokens]) if (typeof v === "number" && v > 0) return v;
  if (!r.key.startsWith("claude")) return undefined;
  const per = (us: Unit[]) => {
    const px = us.reduce((n, u) => n + Object.values(u.books).reduce((m, b) => m + b.px, 0), 0);
    const views = us.reduce((n, u) => n + Object.values(u.books).reduce((m, b) => m + b.views, 0), 0);
    return views > 0 && px > 0 ? px / views / 750 : undefined;
  };
  return per(units.filter((u) => (u.clears ?? 0) > 0)) ?? per(units.filter((u) => u.kind === "reader"));
}

/**
 * A3: the views a reader (and the main agent, between two write-downs) holds — only fewer than the default: on the
 * clears measured (M4), else, where the context never clears, on the long stretches of the main agent (M12) with the
 * context a clear would come at (THRESHOLDS.M12.ctx). Never below TUNING.stopMin.
 */
function readerStop(r: KeyReport, units: Unit[]): { views: number; ctx: number; perView: number; metric: "M4" | "M12" } | undefined {
  const basis = stopContext(r);
  if (!basis) return undefined;
  const perView = readerViewTokens(r, units);
  if (!perView) return undefined;
  const views = Math.max(TUNING.stopMin, Math.floor((TUNING.stopShare * basis.ctx) / perView));
  return views < READING_DEFAULTS.viewsStop ? { views, ctx: Math.round(basis.ctx), perView: Math.round(perView), metric: basis.metric } : undefined;
}

/** Only towards accuracy or fewer requests: a size only up, a batch, a call and a stop only down. */
function better(field: string, now: number | boolean | string, next: number | boolean | string): boolean {
  if (typeof now === "number" && typeof next === "number") return ["find", "read", "ctx"].includes(field) ? next > now : next < now;
  return now !== next;
}

/** The fields of a store a change of a scope lives in. */
type Slots = Record<string, Tuned | undefined>;

function slotsOf(scope: string, cfgKey: KeyTuning, tt: TreeTuning): Slots {
  if (scope === "key") return cfgKey as Slots;
  const [kind, name] = [scope.slice(0, scope.indexOf(":")), scope.slice(scope.indexOf(":") + 1)];
  if (kind === "book") return (tt.books[name] ??= {}) as Slots;
  return (tt.hosts[name] ??= {}) as Slots;
}

/** The field a value of an action is kept in. */
const FIELD: Record<string, string> = { find: "find", read: "read", halves: "halves", noSharper: "noSharper", fetch: "fetch", order: "order", batch: "batch", viewsPerCall: "viewsPerCall", viewsStop: "viewsStop", ctx: "ctx" };

/** New readings of a scope since a time: the reason to go back to the default once its signal is gone. */
function newData(units: Unit[], key: string, scope: string, since: string): boolean {
  const t = Date.parse(since);
  const after = units.filter((u) => u.key === key && Date.parse(u.at) > t);
  if (scope === "key") return after.some((u) => Object.values(u.books).some((b) => b.views > 0 || b.read > 0));
  const name = scope.slice(scope.indexOf(":") + 1);
  if (scope.startsWith("book:")) return after.some((u) => (u.books[name]?.views ?? 0) + (u.books[name]?.read ?? 0) + (u.books[name]?.fetched ?? 0) > 0);
  return after.some((u) => (u.hosts[name]?.requests ?? 0) + (u.hosts[name]?.fetches ?? 0) > 0);
}

export interface TuneOptions {
  settings?: Settings;
  /** The summary just made (autoTidy), else made here. */
  rollup?: Rollup;
  /** The units of the other researches on this computer: the usual when this one has too few books. */
  others?: Unit[];
  now?: number;
}

export interface TuneResult {
  rollup?: Rollup;
  /** What changed now (also in .strom/tune/log.jsonl). */
  changes: TuneLogEntry[];
}

/** The other researches beside this one (the trees' folder), for the usual of the key. */
function siblingRoots(root: string): string[] {
  const dir = path.dirname(root);
  try {
    return fs
      .readdirSync(dir)
      .map((n) => path.join(dir, n))
      .filter((p) => p !== root && fs.existsSync(path.join(p, ".strom", "metrics", "rollup.json")));
  } catch {
    return [];
  }
}

/**
 * Decide what strom sets by itself now, from the summary of the reading (made again unless given): for every agent and
 * model measured in the window, its newest model. Never fails: what cannot be decided now is decided next time.
 */
export function selfTune(tree: Tree, o: TuneOptions = {}): TuneResult {
  if (isArchive(tree) || tree.dryRun) return { changes: [] };
  const settings = o.settings ?? new Settings(tree.env, {});
  const rollup = o.rollup ?? refreshRollup(tree, { settings });
  if (!rollup || !tuningOn(settings)) return { ...(rollup ? { rollup } : {}), changes: [] };
  const now = o.now ?? Date.now();
  const at = new Date(now).toISOString();
  const day = at.slice(0, 10);
  let release: (() => void) | undefined;
  try {
    release = acquireLock(tuneLockFile(tree.root), { owner: "strom tune", waitMs: 2000, staleMs: 60_000 });
  } catch {
    // another strom decides this moment: next time
    return { rollup, changes: [] };
  }
  try {
    settings.reload();
    // what an older strom kept under an alias or another name of a model: under the key of the model, once with a copy
    const aliases = noteAliases(tree.root, aliasPairsOf(rollup.units));
    canonicalUnits(rollup.units, aliases);
    migrateTuneKeys(tree.root, aliases);
    let cfgChanged = canonicalConfigTuning(settings, aliases);
    const state = loadTuneState(tree.root, aliases);
    const log = readTuneLog(tree.root, aliases);
    const others = o.others ?? otherUnits(siblingRoots(tree.root), tree.root);
    const changes: TuneLogEntry[] = [];
    let stateChanged = false;
    const seenKeys = new Set<string>();
    const held = (id: string, key: string, scope: string, what: string, reported?: string) => heldBack(log, { id, key, scope, what, ...(reported ? { reported } : {}) }, rollup.units, now);

    for (const group of groups(rollup.units, now)) {
      // the newest model said under each key (groups come newest first)
      // what nothing says the agent and model of (older records) tunes no agent and model
      if (seenKeys.has(group.key) || group.key === UNKNOWN_KEY) continue;
      seenKeys.add(group.key);
      const key = group.key;
      const tuning = (settings.config.tuning ??= {});
      const kt: KeyTuning = (tuning[key] ??= {});
      const tt: TreeTuning = (state[key] ??= { books: {}, hosts: {} });
      tt.books ??= {};
      tt.hosts ??= {};
      // a new model under the same alias: what was set for the one before is not used for it — begun again
      for (const [store, mark] of [
        [kt, () => (cfgChanged = true)],
        [tt, () => (stateChanged = true)],
      ] as const) {
        if (group.reported && store.reported && modelId(splitKey(key).agent, store.reported) !== group.reported && allTuned(store).length) {
          const said = new Set<string>();
          for (const t of allTuned(store)) {
            if (said.has(t.id)) continue;
            said.add(t.id);
            changes.push({ ...entry(t, key, at, t.value, t.default, `the model said is ${group.reported} now, not ${store.reported}: begun again`, "selftune", "restart"), basis: { model: group.reported } });
          }
          clearTuned(store);
          mark();
        }
      }
      const r = summarize(group, { others, now, defaults: READING_DEFAULTS });
      const wants = wanted(r, group.units);
      const touched = new Set<string>();
      for (const w of wants) {
        const id = tuneId(key, w.action, w.scope);
        const slots = slotsOf(w.scope, kt, tt);
        const from: Record<string, unknown> = {};
        const to: Record<string, unknown> = {};
        for (const [field, value] of Object.entries(w.values)) {
          const f = FIELD[field]!;
          touched.add(`${w.scope}|${f}`);
          const cur = slots[f];
          // the effective value now: a calibration of the sizes counts as where a book starts from
          const start = cur?.value ?? startOf(field, w, settings.config, key, aliases);
          if (cur && !better(field, cur.value, value)) {
            // still wanted: its signal seen today (A6 counts from the last day it was)
            if (cur.seen.slice(0, 10) !== day) {
              cur.seen = at;
              if (w.scope === "key") cfgChanged = true;
              else stateChanged = true;
            }
            continue;
          }
          // the context measured goes only with the stop it sets
          if (field === "ctx" && !("viewsStop" in to)) continue;
          if (!better(field, start, value) || held(id, key, w.scope, w.what, group.reported)) continue;
          slots[f] = { id, action: w.action, what: w.what, scope: w.scope, value, default: w.defaults[field]!, from: start, at, why: w.why, basis: w.basis, rev: TUNE_REV, seen: at, ...(group.reported ? { reported: group.reported } : {}), source: "tuned" };
          from[field] = start;
          to[field] = value;
          if (w.scope === "key") cfgChanged = true;
          else stateChanged = true;
        }
        if (Object.keys(to).length) changes.push({ at, id, action: w.action, key, scope: w.scope, what: w.what, from: single(from), to: single(to), why: w.why, basis: w.basis, by: "selftune" });
      }
      // A6: back to the default what is no longer wanted, its signal gone long enough and new readings since
      const back = (store: KeyTuning | BookTuning | HostTuning, scope: string, onKey: boolean) => {
        const gone = new Map<string, { t: Tuned; from: Record<string, unknown>; to: Record<string, unknown> }>();
        for (const [f, t] of Object.entries(store as Slots)) {
          if (!t || typeof t !== "object" || !("id" in t) || touched.has(`${scope}|${f}`)) continue;
          if (now - Date.parse(t.seen) < TUNING.backAfterDays * DAY || !newData(rollup.units, key, scope, t.seen)) continue;
          const g = gone.get(t.id) ?? { t, from: {}, to: {} };
          g.from[f] = t.value;
          g.to[f] = t.default;
          gone.set(t.id, g);
          delete (store as Slots)[f];
          if (onKey) cfgChanged = true;
          else stateChanged = true;
        }
        for (const g of gone.values())
          changes.push(entry(g.t, key, at, single(g.from), single(g.to), `${scope === "key" ? "" : `${scope.replace(/^(book|host):/, "")}: `}no sign of it for ${TUNING.backAfterDays} days of new readings → back to the default`, "selftune", "A6"));
      };
      back(kt, "key", true);
      for (const [b, bt] of Object.entries(tt.books)) {
        back(bt, `book:${b}`, false);
        if (!Object.keys(bt).length) delete tt.books[b];
      }
      for (const [h, ht] of Object.entries(tt.hosts)) {
        back(ht, `host:${h}`, false);
        if (!Object.keys(ht).length) delete tt.hosts[h];
      }
      // the model said kept beside what was set for it (a new one under the same alias begins again); nothing set: nothing kept
      for (const [store, mark] of [
        [kt, () => (cfgChanged = true)],
        [tt, () => (stateChanged = true)],
      ] as const)
        if (allTuned(store).length && group.reported && modelId(splitKey(key).agent, store.reported) !== group.reported) {
          store.reported = group.reported;
          mark();
        }
      if (!allTuned(kt).length) {
        if (kt.reported) cfgChanged = true;
        delete tuning[key];
      }
      if (!Object.keys(tt.books).length && !Object.keys(tt.hosts).length) {
        if (tt.reported) stateChanged = true;
        delete state[key];
      }
      if (!Object.keys(tuning).length) delete settings.config.tuning;
    }
    if (cfgChanged) settings.save();
    if (stateChanged) saveTuneState(tree.root, state);
    appendTuneLog(tree.root, changes);
    return { rollup, changes };
  } catch {
    // tuning is never a reason to fail
    return { rollup, changes: [] };
  } finally {
    release?.();
  }
}

/** The scans of a scope of a key in the units (after a time): a book's, an archive's images, all of the key's. */
export function scopeScans(units: Unit[], key: string, scope: string, after?: number): number {
  let n = 0;
  for (const u of units) {
    if (u.key !== key || (after !== undefined && !(Date.parse(u.at) > after))) continue;
    if (scope.startsWith("book:")) n += u.books[scope.slice(5)]?.scans ?? 0;
    else if (scope.startsWith("host:")) n += u.hosts[scope.slice(5)]?.images ?? 0;
    else n += Object.values(u.books).reduce((m, b) => m + b.scans, 0);
  }
  return n;
}

/**
 * Whether a change a person took back is held back now: within TUNING.heldDays of the reset, its data unchanged since
 * (RESET_HOLD; an older reset that kept no count: by the days alone), the same model said.
 */
export function heldBack(log: readonly unknown[], t: { id: string; key: string; scope: string; reported?: string; what?: string }, units: Unit[], now: number): boolean {
  for (const raw of log) {
    const e = raw as Partial<TuneLogEntry> & { items?: unknown };
    if (e.by !== "reset" || typeof e.at !== "string") continue;
    const at = Date.parse(e.at);
    if (!(now - at < TUNING.heldDays * DAY)) continue;
    const items = (Array.isArray(e.items) ? e.items : [e]) as Partial<ResetLogItem>[];
    for (const i of items) {
      // the same change by its ID — or, kept under another name of the key by an older strom, by its key, scope and what
      if (!i || (i.id !== t.id && !(i.key === t.key && i.scope === t.scope && i.what !== undefined && i.what === t.what))) continue;
      // another model under the same alias since: begun again all the same
      if (t.reported && i.reported && modelId(splitKey(t.key).agent, i.reported) !== modelId(splitKey(t.key).agent, t.reported)) continue;
      if (typeof i.scans === "number") {
        const since = scopeScans(units, t.key, t.scope, at);
        if (since >= RESET_HOLD.growUnits && since >= RESET_HOLD.growShare * i.scans) continue;
      }
      return true;
    }
  }
  return false;
}

/** Where a value starts from before strom changes it: a book's sizes from the calibration (else the defaults). */
function startOf(field: string, w: Want, cfg: UserConfig, key: string, aliases?: Aliases): number | boolean | string {
  if (field === "find" || field === "read") {
    const { agent, model } = splitKey(key);
    return viewSizes(cfg, agent, model, aliases)[field];
  }
  return w.defaults[field]!;
}

/**
 * The user config's `tuning` under the keys of the models (core/modelkey.ts): what an older strom kept under an alias
 * joined into the key of the model it was set for (each value the newer) — once with a copy of the config beside it.
 * Whether anything moved (the caller saves).
 */
export function canonicalConfigTuning(settings: Settings, aliases: Aliases): boolean {
  const all = settings.config.tuning;
  if (!all) return false;
  let moved = false;
  for (const k of Object.keys(all)) {
    const kt = all[k];
    if (!kt || typeof kt !== "object") continue;
    const key = keyOf(k, kt.reported, aliases, lastAt(kt) || undefined);
    if (key === k) continue;
    if (!moved) keepBeforeKeys(configFile(settings.env));
    moved = true;
    const into = (all[key] ??= {});
    joinSlots(into as Record<string, unknown>, kt as Record<string, unknown>);
    if (kt.reported && (!into.reported || lastAt(kt) >= lastAt(into))) into.reported = kt.reported;
    delete all[k];
  }
  return moved;
}

const single = (o: Record<string, unknown>): unknown => {
  const vals = Object.values(o);
  return vals.length === 1 ? vals[0] : o;
};

function entry(t: Tuned, key: string, at: string, from: unknown, to: unknown, why: string, by: TuneLogEntry["by"], action = t.action): TuneLogEntry {
  return { at, id: t.id, action, key, scope: t.scope, what: t.what, from, to, why, by };
}

export function allTuned(store: object): Tuned[] {
  const out: Tuned[] = [];
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if ("id" in o && "source" in o) out.push(o as Tuned);
    else for (const v of Object.values(o)) walk(v);
  };
  for (const [k, v] of Object.entries(store)) if (k !== "reported") walk(v);
  return out;
}

function clearTuned(store: KeyTuning | TreeTuning): void {
  if ("books" in store) {
    store.books = {};
    store.hosts = {};
  } else for (const k of ["batch", "viewsPerCall", "viewsStop", "ctx"] as const) delete store[k];
}

/** Every change in force for a key (the user config's and this research's), as the summary and a reset list it. */
export function tunedItems(cfg: UserConfig, state: TuneState, key: string, aliases?: Aliases): TunedItem[] {
  const out: TunedItem[] = [];
  const add = (t: Tuned, where: TunedItem["where"]) => out.push({ id: t.id, action: t.action, what: t.what, scope: t.scope, from: t.default, to: t.value, at: t.at.slice(0, 10), why: t.why, source: "tuned", where });
  for (const t of allTuned(keyTuningOf(cfg, key, aliases) ?? {})) add(t, "config");
  for (const t of allTuned(state[key] ?? {})) add(t, "research");
  return out;
}

/** The changes in force for a key here, measured or not (tuning off or an archive: none). */
export function tunedFor(settings: Settings, tree: Tree, key: string): TunedItem[] {
  if (!tuningOn(settings) || isArchive(tree)) return [];
  const aliases = loadAliases(tree.root);
  return tunedItems(settings.config, loadTuneState(tree.root, aliases), key, aliases);
}

/** A change taken back by a person (strom config unset reading.*): its values gone, logged, held back a while. */
export function forgetTuning(settings: Settings, root: string | undefined, key: string, fields: (keyof KeyTuning)[]): TuneLogEntry[] {
  settings.reload();
  // kept under the key of the model, or by an older strom under an alias of it
  const name = keysFor(settings.config.tuning, key, loadAliases(root), (v) => v?.reported)[0];
  const kt = name === undefined ? undefined : settings.config.tuning![name];
  if (!kt || name === undefined) return [];
  const at = new Date().toISOString();
  const out: TuneLogEntry[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    const t = kt[f] as Tuned | undefined;
    if (!t || typeof t !== "object") continue;
    if (!seen.has(t.id)) out.push(entry(t, key, at, t.value, t.default, "taken back by a person", "reset"));
    seen.add(t.id);
    delete kt[f];
  }
  if (!out.length) return [];
  if (!allTuned(kt).length && !kt.reported) delete settings.config.tuning![name];
  if (settings.config.tuning && !Object.keys(settings.config.tuning).length) delete settings.config.tuning;
  settings.save();
  if (root) appendTuneLog(root, out);
  return out;
}

/**
 * The summary of a key with what strom set by itself for it: its changes in force (tuning on), and only the rest
 * suggested — what a person decides, or everything while tune.auto is off.
 */
export function withTuning(r: KeyReport, settings: Settings, tree: Tree): KeyReport {
  if (!tuningOn(settings) || isArchive(tree)) return r;
  r.tuned = tunedFor(settings, tree, r.key);
  r.recommend = r.recommend.filter((x) => !r.tuned.some((t) => t.action === x.id && t.scope === x.scope));
  return r;
}

/** One line per change (a change of several values said by its first): as a person reads them. */
export function tunedSaid(items: TunedItem[]): TunedItem[] {
  const seen = new Set<string>();
  return items.filter((x) => !seen.has(x.id) && seen.add(x.id));
}
