// How the reading of scans went, from what strom recorded itself (core/metrics.ts, the views' record, the sessions,
// the readers' reports, the searches): free — no agent, no network, nothing fetched — and nothing changed by it. Per
// key of agent and model (calibrationKey, the model that reads the scans), split by the model the agent said it ran on
// (a new version under the same alias starts again), per book (record set) and per archive (host of a connector):
//
//   M1  cost per scan               USD where the agent says it, else the tokens per scan
//   M2  views per scan              and the share of whole views, halves, crops
//   M3  views opened again after a context clear  — an estimate here: the usage series and the views made before
//   M4  context clears              drops of the context in the usage series, the context at the first one
//   M5  unsure readings             a reader's image it could not read (result: unclear); what it marked illegible
//                                   and the transcripts with [?] are shown beside it, never a signal (nearly every
//                                   report says what it could not read)
//   M6  enlarged views              shown bigger than the scan has detail (scale > 1.25)
//   M7  no sharper                  a part the portal gave (or would give) no sharper than the whole image
//   M8  waits for an archive's limit  minutes waited, a limit used up, requests per image
//   M9  negatives on weak scans     a negative search whose views of the book were mostly enlarged — shown only
//   M10 readers without a result    a reader that did not finish or wrote nothing of its images — never one a login, a
//                                   plan's limit or a failure stopped (HALTED_OUTCOMES: counted apart, nothing of the
//                                   reading)
//   M11 load on the archive         requests per session, book and host; images fetched and never read (7 days on)
//                                   — only those fetched while the views were recorded, and none a source stands on
//                                   or a reader's report read
//
// Each session, reader or other agent's day is one unit; the units are kept in .strom/metrics/rollup.json (never tidied),
// so the figures outlive the journals strom tidy shortens. What older sessions left (their logs, the readers' notes, the
// images fetched) is read for the last 30 days, marked as recovered (backfill) — once per version of that reading
// (BACKFILL_VERSION: a newer one reads again what is still there). A log is read line by line, whatever its size. A
// signal is said only on enough data and clearly above the usual of the same key: the book's Wilson 90 % interval
// above that of the other books, and a multiple of their usual. What would be suggested is said, never done here.

import fs from "node:fs";
import path from "node:path";
import { metricsDir } from "./metrics.ts";
import { readJsonIfExists, writeFileAtomic } from "./json.ts";
import { BATCH, learnedReaderMinutes, parseReport, type ReaderTime } from "./reader.ts";
import { eachFileLine, eachGzipLine, type LineOptions } from "./lines.ts";
import { listConnectors } from "./connector.ts";
import { isArchive } from "./mode.ts";
import { calibrationKey, viewModel } from "./viewsizes.ts";
import { Settings } from "./config.ts";
import { claudeUsage } from "../runners/claude.ts";
import { claudeTranscript } from "./transcripts.ts";
import { DEFAULT_READING_NUMBERS } from "../agents/profiles.ts";
import type { Media, Search, Session, Source, TreeConfig } from "./model.ts";
import type { Tree } from "./tree.ts";

const DAY = 24 * 3600_000;
/** The window of the figures and of the usual they are held against (B). */
export const WINDOW_DAYS = 60;
/** How far back what older sessions left is read once. */
export const BACKFILL_DAYS = 30;
/** How long a unit is kept in the summary. */
export const KEEP_DAYS = 365;
/** A fetched image counts as never read only this long after its session. */
export const UNREAD_AFTER_DAYS = 7;
/** A drop of the context bigger than this between two requests is a clear (or a compaction). */
export const CLEAR_DROP = 15_000;
/** z of a two-sided 90 % interval. */
export const Z90 = 1.6449;

/**
 * The version of what is read from what older sessions left. A summary made by an older one is read again from what is
 * still there (2: logs line by line, only the readings of scans, a limit's older words, halves of older views, the
 * key kept, the reading's cost of a session with subagents, a message of Claude Code's own no clear, images fetched;
 * 3: an image fetched is read when the research shows it read, and never "never read" from before the views' record).
 */
export const BACKFILL_VERSION = 3;

/**
 * strom's reading sizes by default (agents/profiles.ts: about six scans per batch or delegate, a stop at about 30 views;
 * strom media view: at most 24 views a call; strom read: 10 views per reader) — what the tuning starts from.
 */
export const READING_DEFAULTS = { ...DEFAULT_READING_NUMBERS, readerBatch: BATCH } as const;

/**
 * What strom changes by itself (core/tune.ts), each only towards accuracy or fewer requests — kept here beside the
 * thresholds of the signals, so that the figures of real research can set them all in one place.
 */
export const TUNING = {
  /** A2: smaller batches, never below this share of the default. */
  smallest: 0.5,
  /** A3: the views before a context clears — this share of the context at the first clear, by the tokens of a view. */
  stopShare: 0.6,
  /** A3: never fewer views than this before a reader stops. */
  stopMin: 5,
  /** A6: back to the default once its signal has been gone this long (and new readings came meanwhile). */
  backAfterDays: 60,
  /** A reset holds the same change back this long (its data unchanged). */
  heldDays: 30,
} as const;

/**
 * The thresholds of the signals (relative, within one key) and the minimum samples — set on a research of 260 sessions
 * (check O5, 2026-10-10): a cost or views per scan differ between books by nature (the size of the scans, an index or
 * a register, one entry verified or pages gone through), so a book stands out only at a clear multiple.
 *
 *   M1  cost per scan: 2× the usual (median of the other books), 30 scans from at least 2 sessions (`units`)
 *   M2  views per scan: 3× the usual, 30 scans from at least 2 sessions — shown, never a ground of D1 alone
 *   M3  views opened again after a clear: ≥ 10 % in 2 of the last 5 readers
 *   M4  context clears: in 2 of the last 5 readers — counted per reader (a subagent, a reader of strom read, a session
 *       that reads itself), never a session with its readers as one
 *   M5  unsure readings: the share of the images a reader could not read (result: unclear) — 2× the usual and 10
 *       points more, 20 readings from 2 sessions, the Wilson intervals apart
 *   M6  enlarged views: 2× the pooled share of the other books (their views together, not a median that is mostly 0),
 *       30 views, the Wilson intervals apart
 *   M8  waits for an archive's limit: a limit used up or a wait over 10 min in 2 sessions of the host
 *   M11 fetched and never read: over 20 % or 1.5× the usual, 3 sessions
 */
export const THRESHOLDS = {
  M1: { ratio: 2, scans: 30, units: 2 },
  M2: { ratio: 3, scans: 30, units: 2 },
  M3: { share: 0.1, of: 5, hits: 2 },
  M4: { of: 5, hits: 2, per: "reader" },
  M5: { ratio: 2, plus: 0.1, read: 20, units: 2, unsure: "unclear" },
  M6: { ratio: 2, views: 30, base: "pooled" },
  M7: { n: 2 },
  M8: { waitMs: 10 * 60_000, sessions: 2 },
  M10: { of: 5, hits: 2 },
  M11: { share: 0.2, ratio: 1.5, sessions: 3 },
} as const;

/**
 * What a question of smaller views (D1, a calibration a person starts) rests on: a cost per scan clearly above the
 * usual (M1) on books that read well — never views per scan (M2) alone: they follow the kind of work.
 */
export const D1_BASIS: readonly Metric[] = ["M1"];
/** How many books a question of smaller views needs. */
export const D1_BOOKS = 3;

/**
 * How a reader ended that says nothing of the reading: a login, a plan's limit, a failure of the agent — counted apart
 * (`halted` in the report) and never among the readers without a result (M10), so a subscription's limit tunes nothing.
 */
export const HALTED_OUTCOMES: readonly string[] = ["auth", "limit", "error"];

/** A reader stopped by what is no reading (HALTED_OUTCOMES). */
export const isHalted = (u: Pick<Unit, "kind" | "outcome">): boolean => u.kind === "reader" && u.outcome !== undefined && HALTED_OUTCOMES.includes(u.outcome);

/** A reader whose end says something of the reading (M10): it ran, whatever it gave — never one halted. */
export const isReading = (u: Pick<Unit, "kind" | "outcome">): boolean => u.kind === "reader" && u.outcome !== undefined && !isHalted(u);

/**
 * A reader's stop by the context measured (A3, TUNING.stopShare): by the tokens of one view of a reader (its wholes and
 * halves, about 4 000 tokens — never the average view of the key, which the main agent's small crops pull down), taken
 * from the readers' own views when they made at least this many, else from the wholes and halves of the key.
 */
export const READER_VIEWS_MIN = 20;

/**
 * Claude Code's tokens weighed against each other (the same for each of its models: input 1, a cache write 1.25, a
 * cache read 0.1, output 5) — only to split one session's cost between its agent and its subagents, never a price.
 */
export const CLAUDE_TOKEN_WEIGHTS = { in: 1, cw: 1.25, cr: 0.1, out: 5 } as const;

/** In the human report: the books with a signal, then the biggest, up to this many; all of them in --json. */
export const BOOKS_SHOWN = 12;

// ── math ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Wilson score interval of k successes in n at confidence z (90 % by default). */
export function wilson(k: number, n: number, z = Z90): { p: number; lo: number; hi: number } {
  if (!(n > 0)) return { p: 0, lo: 0, hi: 1 };
  const p = k / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const mid = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { p, lo: Math.max(0, mid - half), hi: Math.min(1, mid + half) };
}

export function median(xs: number[]): number | undefined {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return undefined;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * A share clearly above the usual: enough sample, its interval's lower end above the upper end of the usual's (pooled),
 * and at least `ratio` × the usual's median (plus `plus` absolute, when given).
 */
export function shareSignal(
  k: number,
  n: number,
  base: { k: number; n: number; median: number } | undefined,
  rule: { ratio: number; plus?: number; min: number },
): { signal: boolean; p: number; lo: number; hi: number; base?: number; baseHi?: number; ratio?: number; enough: boolean } {
  const w = wilson(k, n);
  const enough = n >= rule.min;
  if (!base || !(base.n > 0)) return { signal: false, ...w, enough };
  const b = wilson(base.k, base.n);
  const ratio = base.median > 0 ? w.p / base.median : w.p > 0 ? Infinity : 1;
  const signal = enough && w.lo > b.hi && w.p >= rule.ratio * base.median && w.p >= base.median + (rule.plus ?? 0) && w.p > 0;
  return { signal, ...w, base: base.median, baseHi: b.hi, ratio, enough };
}

/** A rate (per scan) clearly above the usual: enough sample and at least `ratio` × the usual's median. */
export function rateSignal(value: number | undefined, base: number | undefined, n: number, rule: { ratio: number; min: number }): { signal: boolean; ratio?: number; enough: boolean } {
  const enough = n >= rule.min;
  if (value === undefined || base === undefined || !(base > 0)) return { signal: false, enough };
  const ratio = value / base;
  return { signal: enough && ratio >= rule.ratio, ratio, enough };
}

/** At least `hits` of the last `of` units say so (and at least `of` units there are). */
export function lastOf(flags: boolean[], rule: { of: number; hits: number }): { signal: boolean; hits: number; of: number; enough: boolean } {
  const last = flags.slice(-rule.of);
  const hits = last.filter(Boolean).length;
  const enough = flags.length >= rule.of;
  return { signal: enough && hits >= rule.hits, hits, of: last.length, enough };
}

// ── units ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** What one unit (a session, a reader…) did with one book. Counts only: they add up over units. */
export interface BookCounts {
  scans: number;
  views: number;
  whole: number;
  half: number;
  crop: number;
  split: number;
  grid: number;
  enlarged: number;
  cached: number;
  px: number;
  /** The px of the whole views and halves (what a reader reads; the main agent's small crops apart). */
  pxWH?: number;
  /** Readings: the images of a reader's report of scans (a block with its result); `unsure` of them unclear (M5). */
  read: number;
  unsure: number;
  /** Of the readings, those the reader marked something illegible in: shown, never a signal (nearly all do). */
  marked?: number;
  /** Transcripts written of the book, and those with [?]: shown, never a signal. */
  transcripts?: number;
  doubtful?: number;
  searches: number;
  uncertain: number;
  negatives: number;
  weakNegatives: number;
  fetched: number;
  unread: number;
  pending: number;
  /** Fetched before strom kept its views' record, and nothing of the research shows it read: whether read not known. */
  unjudged?: number;
  requests: number;
  noSharper: number;
}

export interface HostCounts {
  requests: number;
  images: number;
  waitMs: number;
  later: number;
  fetches: number;
  fetched: number;
  unread: number;
  pending: number;
  /** Fetched before strom kept its views' record, and nothing of the research shows it read: whether read not known. */
  unjudged?: number;
}

export interface Unit {
  /** N0012, a reader's name, other:<by>:<day>, backfill:<report>. */
  id: string;
  kind: "session" | "reader" | "other";
  at: string;
  key: string;
  /** The model the agent said it ran on. */
  reported?: string;
  /** The key was not recorded: taken from the settings of now. */
  guessed?: true;
  /** Some of it recovered from what older sessions left: less sure. */
  backfill?: true;
  /** A reader: the session that started it (its readers count with it for the minimum of sessions). */
  session?: string;
  books: Record<string, BookCounts>;
  hosts: Record<string, HostCounts>;
  /** The cost of its reading (the session's share of it: Claude Code by the tokens of the views, else whole). */
  usd?: number;
  tokens?: { new: number; out: number; cr: number };
  /** Its reading's share of the cost not known (its subagents read, their use not said): no cost, never the whole. */
  costUnknown?: true;
  /** Its usage came in a series (per request or turn): the context clears are known. */
  series?: true;
  clears?: number;
  firstClearCtx?: number;
  /** Each subagent (a reader the session delegated to) in the series, in order: its clears, the context at its first. */
  streams?: { clears: number; ctx?: number }[];
  viewsAfterClear?: number;
  reopenedAfterClear?: number;
  /** A reader: how it ended, and whether it gave no result (never set for one halted: HALTED_OUTCOMES). */
  outcome?: string;
  noResult?: true;
}

export interface Rollup {
  version: 1;
  updated: string;
  /** When what older sessions left was read (once per BACKFILL_VERSION). */
  backfilled?: string;
  /** The version of that reading (none: 1). */
  backfillVersion?: number;
  /** What of the logs could be read then. */
  backfillLogs?: BackfillLogs;
  units: Unit[];
}

/** The logs of the sessions of strom run in the window of the backfill: what could be read of them. */
export interface BackfillLogs {
  /** Logs read (whole or compressed). */
  read: number;
  /** Sessions of strom run whose log was gone (strom tidy took it) with nothing else of theirs recorded: partial. */
  gone: number;
  /** Logs that could not be read, and why. */
  skipped: number;
  reasons?: string[];
  /** Lines too long to hold (an image in a log): skipped. */
  long: number;
}

export function emptyBook(): BookCounts {
  return { scans: 0, views: 0, whole: 0, half: 0, crop: 0, split: 0, grid: 0, enlarged: 0, cached: 0, px: 0, pxWH: 0, read: 0, unsure: 0, marked: 0, transcripts: 0, doubtful: 0, searches: 0, uncertain: 0, negatives: 0, weakNegatives: 0, fetched: 0, unread: 0, pending: 0, requests: 0, noSharper: 0 };
}
export function emptyHost(): HostCounts {
  return { requests: 0, images: 0, waitMs: 0, later: 0, fetches: 0, fetched: 0, unread: 0, pending: 0 };
}
function addInto<T extends object>(into: T, from: T): T {
  for (const [k, v] of Object.entries(from)) if (typeof v === "number") (into as Record<string, number>)[k] = ((into as Record<string, number>)[k] ?? 0) + v;
  return into;
}

/**
 * The time limit of the next reader of so many views with this agent and model (`key`): the formula's, more where the
 * readers of the same key before it in this research needed more (learnedReaderMinutes) — "learned" then. An archive or
 * a research with no readers yet: the formula.
 */
export function readerLimit(root: string, key: string, views: number): { minutes: number; from: "default" | "learned" } {
  const earlier: ReaderTime[] = [];
  for (const r of readJournal(path.join(metricsDir(root), "readers.jsonl"))) {
    if (r.key !== key) continue;
    earlier.push({ outcome: str(r.outcome), views: num(r.views), ms: num(r.wallMs) ?? num(r.ms), minutes: num(r.minutes) });
  }
  const l = learnedReaderMinutes(views, earlier);
  return { minutes: l.minutes, from: l.learned ? "learned" : "default" };
}

/** One JSON line per record, read line by line (never the whole file at once); a line that is not one is left out. */
export function readJournal(file: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  try {
    eachFileLine(file, (line) => {
      try {
        const v = JSON.parse(line) as unknown;
        if (v && typeof v === "object" && !Array.isArray(v)) out.push(v as Record<string, unknown>);
      } catch {
        // a line cut short or written over: left out
      }
    });
  } catch {
    // no journal (or not readable): what was read stands
  }
  return out;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const time = (v: unknown): number => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : NaN;
};

/**
 * The key of the agent and model of a session strom did not record it for: the settings of now — unless the agent said
 * the model it ran on and that is another one than the settings name (a setting changed since): then the model said.
 */
export type KeyGuess = (agent: string | undefined, reported?: string) => string;

export function keyGuesser(settings: Settings, tree: TreeConfig): KeyGuess {
  return (agent, reported) => {
    const a = agent ?? settings.agent(tree).value;
    return keyOfReported(a, calibrationKey(a, viewModel(settings, a, tree)), reported);
  };
}

const fold = (s: string) => s.normalize("NFC").toLowerCase();

/**
 * The key of a session or reader by the model its agent said it ran on: the guess (from the settings of now) when the
 * model said is the guess's model or the guess names none (the agent's own); else the alias of the model said (Claude:
 * opus, sonnet, haiku…), else the model said itself.
 */
export function keyOfReported(agent: string, guess: string, reported: string | undefined): string {
  if (!reported || reported.startsWith("<")) return guess;
  const model = guess.startsWith(`${agent} `) ? guess.slice(agent.length + 1).trim() : "";
  if (!model || fold(reported).includes(fold(model))) return guess;
  const family = agent === "claude" ? /\b(?:claude-)?(opus|sonnet|haiku|fable)\b/iu.exec(reported)?.[1]?.toLowerCase() : undefined;
  return calibrationKey(agent, family ?? reported);
}

/** The key of what nothing says the agent and model of (an older view outside a session, a report of no session). */
export const UNKNOWN_KEY = "unknown";

/** The model of an agent as its key names it: Claude's alias of a model it said (claude-opus-5-5 → opus), else as said. */
function modelOfKey(agent: string, model: string | undefined, reported: string | undefined): string | undefined {
  if (model?.trim()) return model.trim();
  if (!reported || reported.startsWith("<")) return undefined;
  return (agent === "claude" ? /\b(?:claude-)?(opus|sonnet|haiku|fable)\b/iu.exec(reported)?.[1]?.toLowerCase() : undefined) ?? reported;
}

/**
 * The key of a session or reader strom did not record one for, from what its own record says: its agent and the model
 * strom started it with (else the model it said it ran on) — never the settings of now (another agent or model chosen
 * since would take its history). No agent said: UNKNOWN_KEY.
 */
export function recordKey(agent: string | undefined, model: string | undefined, reported: string | undefined): string {
  if (!agent) return UNKNOWN_KEY;
  return calibrationKey(agent, modelOfKey(agent, model, reported));
}

/** One request's use in a series: the context, and its tokens where said. */
export interface SeriesSample {
  t: number;
  ctx?: number;
  sub: string;
  total?: boolean;
  model?: string;
  in?: number;
  out?: number;
  cr?: number;
  cw?: number;
}

interface Usage {
  key?: string;
  reported?: string;
  /** The agent's own id of the session (Claude Code's: its transcript). */
  agentSession?: string;
  samples: SeriesSample[];
}

function readUsage(dir: string): Map<string, Usage> {
  const out = new Map<string, Usage>();
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return out;
  }
  for (const f of files) {
    const u: Usage = { samples: [] };
    for (const r of readJournal(path.join(dir, f))) {
      if (r.start) {
        u.key ??= str(r.key);
        continue;
      }
      if (r.agentSession) {
        if (!r.sub) {
          u.reported ??= str(r.model);
          u.agentSession ??= str(r.agentSession);
        }
        continue;
      }
      u.samples.push({ t: time(r.at), sub: str(r.sub) ?? "", ...(r.total ? { total: true } : {}), ...said(r) });
    }
    out.set(f.slice(0, -".jsonl".length), u);
  }
  return out;
}

/** What a sample of use says: the context, the tokens, the model — each only when said. */
function said(r: Record<string, unknown>): Partial<SeriesSample> {
  const out: Partial<SeriesSample> = {};
  for (const k of ["ctx", "in", "out", "cr", "cw"] as const) {
    const v = num(r[k]);
    if (v !== undefined) out[k] = v;
  }
  const model = str(r.model);
  if (model) out.model = model;
  return out;
}

/** A sample with a context of its own: none when nothing was given (0) or Claude Code said it itself ("<synthetic>"). */
const hasContext = (s: { ctx?: number; model?: string }): s is { ctx: number; model?: string } => s.ctx !== undefined && s.ctx > 0 && !s.model?.startsWith("<");

/** The context clears of a usage series: drops of the context, per stream (the agent's own, each subagent's). */
export function clearsOf(samples: { t: number; ctx?: number; sub: string; model?: string }[]): { clears: number; first?: { t: number; ctx: number } } {
  const last = new Map<string, number>();
  let clears = 0;
  let first: { t: number; ctx: number } | undefined;
  for (const s of samples) {
    if (!hasContext(s)) continue;
    const before = last.get(s.sub);
    if (before !== undefined && before - s.ctx > CLEAR_DROP) {
      clears++;
      if (!first || s.t < first.t) first = { t: s.t, ctx: before };
    }
    last.set(s.sub, s.ctx);
  }
  return { clears, ...(first ? { first } : {}) };
}

/** Each subagent's stream of a series (in the order they began): its clears and the context at its first. */
export function streamClears(samples: { t: number; ctx?: number; sub: string; model?: string }[]): { sub: string; clears: number; ctx?: number }[] {
  const by = new Map<string, { t: number; ctx?: number; sub: string; model?: string }[]>();
  for (const s of samples) if (s.sub) (by.get(s.sub) ?? by.set(s.sub, []).get(s.sub)!).push(s);
  return [...by].map(([sub, list]) => {
    const c = clearsOf(list);
    return { sub, clears: c.clears, ...(c.first ? { ctx: c.first.ctx } : {}) };
  });
}

/**
 * The kind of a view an older line did not say: by its region against the scan — whole (≥ 95 % both ways), a half
 * (≥ 95 % one way, 40–62 % the other: a page of a double page), else a crop.
 */
export function kindOfRegion(W: number | undefined, H: number | undefined, w: number | undefined, h: number | undefined): "whole" | "half" | "crop" {
  if (!W || !H || w === undefined || h === undefined) return "crop";
  const fw = w / W;
  const fh = h / H;
  if (fw >= 0.95 && fh >= 0.95) return "whole";
  if ((fh >= 0.95 && fw >= 0.4 && fw <= 0.62) || (fw >= 0.95 && fh >= 0.4 && fh <= 0.62)) return "half";
  return "crop";
}

interface ViewRec {
  t: number;
  key: string;
  by: string;
  scan: string;
  book: string;
  kind: "whole" | "half" | "crop" | "split" | "grid";
  enlarged: boolean;
  cached: boolean;
  px: number;
  reader: boolean;
  derived: boolean;
}

/** The views' record, each line with what P1 records — an older line's taken from the image's record (derived). */
function readViews(root: string, media: Map<string, Media>): ViewRec[] {
  const out: ViewRec[] = [];
  for (const v of readJournal(path.join(root, ".strom", "views", "views.jsonl"))) {
    const key = str(v.key);
    const t = time(v.at);
    if (!key || !Number.isFinite(t)) continue;
    const m = media.get(key);
    const derived = num(v.W) === undefined;
    const W = num(v.W) ?? m?.width;
    const H = num(v.H) ?? m?.height;
    const region = (v.region ?? {}) as { w?: unknown; h?: unknown };
    const scale = num(v.scale) ?? 1;
    const rs = str(v.rs) ?? m?.recordset;
    const img = num(v.img) ?? m?.image;
    const kindSaid = str(v.kind);
    const kind = (["whole", "half", "crop", "split", "grid"].includes(kindSaid ?? "") ? kindSaid : kindOfRegion(W, H, num(region.w), num(region.h))) as ViewRec["kind"];
    const w = num(v.w) ?? (num(region.w) !== undefined ? Math.round(num(region.w)! * scale) : 0);
    const h = num(v.h) ?? (num(region.h) !== undefined ? Math.round(num(region.h)! * scale) : 0);
    out.push({
      t,
      key,
      by: str(v.by) ?? "",
      scan: rs && img !== undefined ? `${rs}:${img}` : key,
      book: rs ?? "-",
      kind,
      enlarged: scale > 1.25,
      cached: v.cached === true,
      px: w * h,
      reader: v.reader === 1 || v.reader === true,
      derived,
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** The fetched images whose reading is decided: neither its 7 days still running nor fetched before views were recorded. */
function decidedOf(c: { fetched: number; pending: number; unjudged?: number } | undefined): number {
  return c ? c.fetched - c.pending - (c.unjudged ?? 0) : 0;
}

/** An image's scan as the views count it: its book and number, else its own ID. */
const scanOf = (m: Media | undefined, id: string) => (m?.recordset && m.image !== undefined ? `${m.recordset}:${m.image}` : id);

/**
 * The scans the research itself shows read, whatever strom's views' record says (it lives in .strom, which a copy, an
 * unpacked tree or an older strom does not have): a source standing on the image or cutting its entry out of it, a
 * reader's report in notes/readings giving a result for it.
 */
export function researchReadScans(tree: Tree, media: Map<string, Media>): Set<string> {
  const out = new Set<string>();
  const add = (id: string) => out.add(scanOf(media.get(id), id));
  for (const s of tree.list<Source>("source")) {
    if (s.retracted) continue;
    for (const id of s.media ?? []) add(id);
    for (const c of s.clips ?? []) if (c.media) add(c.media);
  }
  const dir = path.join(tree.root, "notes", "readings");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return out;
  }
  for (const f of files) {
    if (NOT_SCAN_READING.test(f)) continue;
    let text: string;
    try {
      text = fs.readFileSync(path.join(dir, f), "utf8");
    } catch {
      continue;
    }
    const head = /^# Reading ([Bb]\d+)-/m.exec(text)?.[1]?.toUpperCase();
    for (const r of parseReport(text)) {
      if (!RESULT_LINE.test(r.text)) continue;
      if (r.media) add(r.media);
      else if (head && r.number !== undefined) out.add(`${head}:${r.number}`);
    }
  }
  return out;
}

/** Since when the views were recorded: the start of the session that made the first line, else that line's time. */
function viewsKeptFrom(views: ViewRec[], sessions: Map<string, Session>): number {
  const first = views[0];
  if (!first) return Infinity;
  const started = time(sessions.get(first.by)?.started);
  return Number.isFinite(started) ? Math.min(started, first.t) : first.t;
}

function unitOf(units: Map<string, Unit>, id: string, init: () => Omit<Unit, "id" | "books" | "hosts">): Unit {
  let u = units.get(id);
  if (!u) units.set(id, (u = { id, ...init(), books: {}, hosts: {} }));
  return u;
}
const bookOf = (u: Unit, b: string) => (u.books[b] ??= emptyBook());
const hostOf = (u: Unit, h: string) => (u.hosts[h] ??= emptyHost());
const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

export interface ComputeOptions {
  guess: KeyGuess;
  /** The shared folder (the connectors' hosts, for what older logs say of fetches). */
  shared?: string | undefined;
  /** Read what older sessions left (their logs, the readers' notes, the images fetched) for the last BACKFILL_DAYS. */
  backfill?: boolean;
  now?: number;
  /** Filled in: what of the logs could be read for the backfill. */
  logs?: BackfillLogs;
  /**
   * The use of a Claude Code session's agent and of each of its subagents from its transcript (core/transcripts.ts) —
   * asked only when the session delegated and its stream did not say the subagents' use.
   */
  transcript?: (agentSession: string) => StreamTokens | undefined;
  /** How a log is read (tests: small pieces). */
  lines?: LineOptions;
}

/** The tokens of one stream of a session: the agent's own (""), a subagent's (its tool call's id). */
export interface Tokens {
  in: number;
  out: number;
  cr: number;
  cw: number;
}
export type StreamTokens = Map<string, Tokens>;

const zeroTokens = (): Tokens => ({ in: 0, out: 0, cr: 0, cw: 0 });

/** The tokens of each stream of a series (only where its samples said tokens). */
export function streamTokens(samples: SeriesSample[]): StreamTokens | undefined {
  const out: StreamTokens = new Map();
  for (const s of samples) {
    if (s.total || (s.in === undefined && s.out === undefined && s.cr === undefined && s.cw === undefined)) continue;
    const t = out.get(s.sub) ?? out.set(s.sub, zeroTokens()).get(s.sub)!;
    t.in += s.in ?? 0;
    t.out += s.out ?? 0;
    t.cr += s.cr ?? 0;
    t.cw += s.cw ?? 0;
  }
  return out.size ? out : undefined;
}

/**
 * The reading's share of a Claude Code session's cost and its tokens. Its subagents (scan readers it delegated to) are
 * reading whole; of the agent's own new tokens, the share its views took (a view of w×h px ≈ w·h/750 tokens, less what
 * the subagents took in). The cost split between them by Claude's token weights (CLAUDE_TOKEN_WEIGHTS). Unknown
 * (undefined): the session delegated but its subagents' use is not known, or its views took more tokens than its own
 * agent took in (subagents read them) — never the whole session's cost for its reading.
 */
export function readingShare(
  px: number,
  m: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number },
  streams: StreamTokens | undefined,
  delegated: boolean,
): { share: number; tokens: { new: number; out: number; cr: number } } | undefined {
  const W = CLAUDE_TOKEN_WEIGHTS;
  const weigh = (t: Tokens) => t.in * W.in + t.cw * W.cw + t.cr * W.cr + t.out * W.out;
  const img = px / 750;
  const subs = streams ? [...streams].filter(([k]) => k !== "").map(([, t]) => t) : [];
  if (streams && subs.length) {
    const main = streams.get("") ?? zeroTokens();
    const sub = subs.reduce((a, t) => ({ in: a.in + t.in, out: a.out + t.out, cr: a.cr + t.cr, cw: a.cw + t.cw }), zeroTokens());
    const all = weigh(main) + weigh(sub);
    if (!(all > 0)) return undefined;
    const mainNew = main.in + main.cw;
    const subNew = sub.in + sub.cw;
    const own = mainNew > 0 ? Math.min(1, Math.max(0, img - subNew) / mainNew) : 0;
    return { share: Math.min(1, (weigh(sub) + weigh(main) * own) / all), tokens: { new: subNew + mainNew * own, out: sub.out + main.out * own, cr: sub.cr + main.cr * own } };
  }
  if (delegated) return undefined;
  const main = streams?.get("");
  const t = main ?? { in: m.inputTokens ?? 0, out: m.outputTokens ?? 0, cr: m.cacheReadTokens ?? 0, cw: m.cacheWriteTokens ?? 0 };
  const newTok = t.in + t.cw;
  if (!(newTok > 0)) return undefined;
  const raw = img / newTok;
  // nothing said of its streams: views of more tokens than the agent's own took in were read by subagents
  if (!main && raw > 1) return undefined;
  const share = Math.min(1, raw);
  return { share, tokens: { new: newTok * share, out: t.out * share, cr: t.cr * share } };
}

/** What a session's log said beyond its series: its subagents' streams, whether it delegated, its agent's own id. */
interface LogInfo {
  streams?: StreamTokens;
  delegated: number;
  agentSession?: string;
}

/** Every unit the journals and the research's records hold now. */
export function computeUnits(tree: Tree, o: ComputeOptions): Unit[] {
  const now = o.now ?? Date.now();
  const root = tree.root;
  const media = new Map(tree.list<Media>("media").map((m) => [m.id, m]));
  const sessions = new Map(tree.list<Session>("session").map((s) => [s.id, s]));
  const usage = readUsage(path.join(metricsDir(root), "usage"));
  const views = readViews(root, media);
  const units = new Map<string, Unit>();
  const clearAt = new Map<string, number | undefined>();

  const sessionUnit = (id: string, t: number): Unit =>
    unitOf(units, id, () => {
      const s = sessions.get(id);
      const u = usage.get(id);
      const reported = u?.reported ?? s?.metrics?.model ?? s?.model;
      return {
        kind: "session",
        at: s?.started ?? new Date(t).toISOString(),
        // not recorded: what its own record says (never the settings of now)
        key: u?.key ?? recordKey(s?.agent, s?.model, reported),
        ...(reported ? { reported } : {}),
        ...(u?.key ? {} : { guessed: true as const }),
      };
    });
  // outside a session: what strom recorded now goes by the settings of now (kept once stored); an older record (a view
  // line of before, an image fetched before) by nothing — UNKNOWN_KEY, never the settings of now
  const otherUnit = (by: string, t: number, older = false): Unit => unitOf(units, `other:${by}:${dayOf(t)}`, () => ({ kind: "other", at: new Date(t).toISOString(), key: older ? UNKNOWN_KEY : o.guess(undefined), guessed: true }));
  const unitForBy = (by: string, t: number, older = false): Unit | undefined => (/^N\d+$/.test(by) ? sessionUnit(by, t) : by === "user" || !by ? undefined : otherUnit(by, t, older));

  // readers: each its own unit; the views made for it are its own
  const readers = readJournal(path.join(metricsDir(root), "readers.jsonl"));
  const readerUnits: { u: Unit; by: string; t: number; from: number; ids: Set<string> }[] = [];
  const reports = new Set<string>();
  for (const r of readers) {
    const name = str(r.reader);
    const t = time(r.at);
    if (!name || !Number.isFinite(t)) continue;
    const use = usage.get(name);
    const reported = str(r.reported) ?? use?.reported;
    let id = name;
    for (let i = 2; units.has(id); i++) id = `${name}#${i}`;
    const outcome = str(r.outcome);
    const images = num(r.images);
    const missing = num(r.missing);
    const by = str(r.by) ?? "";
    const session = str(r.session) ?? (/^N\d+$/.test(by) ? by : undefined);
    const u = unitOf(units, id, () => ({
      kind: "reader",
      at: new Date(t).toISOString(),
      key: str(r.key) ?? recordKey(str(r.agent), str(r.model), reported),
      ...(reported ? { reported } : {}),
      ...(str(r.key) ? {} : { guessed: true as const }),
      ...(outcome ? { outcome } : {}),
      ...(session ? { session } : {}),
    }));
    // a login, a plan's limit or a failure stopped it: nothing of the reading (counted apart)
    if (!isHalted(u) && (outcome !== "ok" || (images !== undefined && missing !== undefined && images > 0 && missing >= images))) u.noResult = true;
    const usd = r.usdPartial ? undefined : num(r.usd);
    if (usd !== undefined) u.usd = usd;
    const tok = (r.tokens ?? {}) as Record<string, unknown>;
    if (num(tok.in) !== undefined || num(tok.out) !== undefined) u.tokens = { new: (num(tok.in) ?? 0) + (num(tok.cw) ?? 0), out: num(tok.out) ?? 0, cr: num(tok.cr) ?? 0 };
    const report = str(r.report);
    if (report) {
      reports.add(report.split(path.sep).join("/"));
      // only a reading of scans counts its images (a check of clips, transcripts, a calibration read no scan for it)
      const kind = str(r.kind);
      if (!kind || kind === "read") readReport(u, path.join(root, report), media);
    }
    readerUnits.push({ u, by, t, from: t - (num(r.ms) ?? 0) - 15 * 60_000, ids: new Set(Array.isArray(r.imageIds) ? r.imageIds.map(String) : []) });
    if (use) clearAt.set(u.id, applySeries(u, use));
  }

  // the views: a reader's to its reader, the rest to the session (or the agent's day) that made them
  const viewsOf = new Map<string, ViewRec[]>();
  for (const v of views) {
    let u: Unit | undefined;
    if (v.reader) {
      const cands = readerUnits.filter((r) => r.by === v.by && v.t <= r.t && v.t >= r.from);
      u = (cands.find((r) => r.ids.has(v.key)) ?? cands[0])?.u;
    }
    u ??= unitForBy(v.by, v.t, v.derived);
    if (!u) continue;
    const b = bookOf(u, v.book);
    b.views++;
    b[v.kind]++;
    if (v.enlarged) b.enlarged++;
    if (v.cached) b.cached++;
    b.px += v.px;
    if (v.kind === "whole" || v.kind === "half") b.pxWH = (b.pxWH ?? 0) + v.px;
    if (v.derived) u.backfill = true;
    (viewsOf.get(u.id) ?? viewsOf.set(u.id, []).get(u.id)!).push(v);
  }
  for (const [id, vs] of viewsOf) {
    const u = units.get(id)!;
    const scans = new Map<string, Set<string>>();
    for (const v of vs) (scans.get(v.book) ?? scans.set(v.book, new Set()).get(v.book)!).add(v.scan);
    for (const [b, s] of scans) bookOf(u, b).scans += s.size;
  }

  // the sessions' usage series (their cost once the logs are read too, below)
  for (const u of units.values()) {
    if (u.kind !== "session") continue;
    const use = usage.get(u.id);
    if (use) clearAt.set(u.id, applySeries(u, use));
  }

  // views after the first context clear, and how many of them were made before (opened again) — an estimate of M3
  for (const [id, at] of clearAt) {
    if (at === undefined || !Number.isFinite(at)) continue;
    const after = (viewsOf.get(id) ?? []).filter((v) => v.t > at);
    const u = units.get(id)!;
    u.viewsAfterClear = after.length;
    u.reopenedAfterClear = after.filter((v) => v.cached).length;
  }

  // fetches: requests by host and book, waits, a limit used up, no sharper, what was fetched and never read
  const seen = new Map<string, number[]>();
  for (const v of views) (seen.get(v.scan) ?? seen.set(v.scan, []).get(v.scan)!).push(v.t);
  // read for the research whatever the views' record says: a source stands on it, a reader's report read it
  const readInResearch = researchReadScans(tree, media);
  // the views' record kept since the session that made its first line (or that line itself); an image fetched before
  // it, or with no record at all (a copy of the tree, one unpacked, an older strom), is no sign of "never read"
  const viewsFrom = viewsKeptFrom(views, sessions);
  const endOf = (t: number, s: Session | undefined) => {
    const e = time(s?.ended);
    return Number.isFinite(e) ? Math.max(t, e) : t;
  };
  const fetchJournal = readJournal(path.join(metricsDir(root), "fetch.jsonl"));
  for (const f of fetchJournal) {
    const t = time(f.at);
    if (!Number.isFinite(t)) continue;
    const by = str(f.session) ?? str(f.by) ?? "";
    const u = /^N\d+$/.test(by) ? sessionUnit(by, t) : otherUnit(by || "agent", t);
    const rs = str(f.rs);
    const got = Array.isArray(f.got) ? f.got.filter((n): n is number => typeof n === "number") : [];
    const later = f.result === "later" || Boolean(f.later);
    const hosts = (f.hosts ?? {}) as Record<string, { requests?: unknown; waits?: { ms?: unknown }[] }>;
    const end = endOf(t, sessions.get(by));
    let unread = 0;
    let pending = 0;
    let unjudged = 0;
    if (rs && f.cmd !== "part")
      for (const n of got) {
        const read = readInResearch.has(`${rs}:${n}`) || (seen.get(`${rs}:${n}`) ?? []).some((x) => x >= t - 60_000 && x <= end + UNREAD_AFTER_DAYS * DAY);
        if (read) continue;
        if (t < viewsFrom - 60_000) unjudged++;
        else if (now < end + UNREAD_AFTER_DAYS * DAY) pending++;
        else unread++;
      }
    const fetched = f.cmd === "part" ? 0 : got.length;
    const names = Object.keys(hosts);
    for (const [i, h] of names.entries()) {
      const hc = hostOf(u, h);
      hc.requests += num(hosts[h]!.requests) ?? 0;
      hc.waitMs += (Array.isArray(hosts[h]!.waits) ? hosts[h]!.waits! : []).reduce((n, w) => n + (num(w.ms) ?? 0), 0);
      if (i === 0) {
        hc.fetches++;
        hc.images += got.length;
        hc.fetched += fetched;
        hc.unread += unread;
        hc.pending += pending;
        if (unjudged) hc.unjudged = (hc.unjudged ?? 0) + unjudged;
        if (later) hc.later++;
      }
    }
    if (!names.length && later) hostOf(u, str(f.connector) ?? "-").later++;
    if (rs) {
      const b = bookOf(u, rs);
      b.requests += num(f.requests) ?? 0;
      b.fetched += fetched;
      b.unread += unread;
      b.pending += pending;
      if (unjudged) b.unjudged = (b.unjudged ?? 0) + unjudged;
      if (f.noSharper) b.noSharper++;
    }
  }

  // searches and transcripts of a session: the uncertain ones, the negatives, those on weak scans
  const within = (s: Session, created: string, task?: string) => {
    const t = time(created);
    return t >= time(s.started) && t <= (s.ended ? time(s.ended) : now) && (!task || !s.task || task === s.task);
  };
  const sessionAt = (created: string, task?: string): Unit | undefined => {
    for (const s of sessions.values()) if (within(s, created, task)) return sessionUnit(s.id, time(created));
    return undefined;
  };
  for (const q of tree.list<Search>("search")) {
    if (q.retracted) continue;
    const u = sessionAt(q.created, q.task);
    if (!u) continue;
    for (const rs of q.recordsets ?? []) {
      const b = bookOf(u, rs);
      b.searches++;
      if (q.result === "inconclusive" || q.result === "partial") b.uncertain++;
      if (q.result === "negative") {
        b.negatives++;
        // weak: the views of the book in that session mostly enlarged (more than the scan has to show)
        if (b.views > 0 && b.enlarged / b.views > 0.5) b.weakNegatives++;
      }
    }
  }
  // the transcripts written: shown beside the readings (a [?] is a word unsure, not an image unread) — never M5
  for (const src of tree.list<Source>("source")) {
    if (src.retracted || !src.transcript || !src.recordset) continue;
    const u = sessionAt(src.created);
    if (!u) continue;
    const b = bookOf(u, src.recordset);
    b.transcripts = (b.transcripts ?? 0) + 1;
    if (src.transcript.includes("[?]")) b.doubtful = (b.doubtful ?? 0) + 1;
  }

  const logInfo = new Map<string, LogInfo>();
  if (o.backfill) {
    const fetchFrom = fetchJournal.reduce((m, f) => Math.min(m, time(f.at) || Infinity), Infinity);
    backfill(tree, units, {
      sessions,
      usage,
      reports,
      media,
      now,
      shared: o.shared,
      hasFetch: new Set(fetchJournal.map((f) => str(f.session) ?? "")),
      fetchFrom,
      seen,
      readInResearch,
      viewsFrom,
      endOf,
      sessionAt: (created) => sessionAt(created),
      otherUnit,
      logs: o.logs ?? { read: 0, gone: 0, skipped: 0, long: 0 },
      logInfo,
      ...(o.lines ? { lines: o.lines } : {}),
    });
  }

  // the sessions' cost and tokens: the reading's share
  for (const u of units.values()) {
    if (u.kind !== "session") continue;
    const s = sessions.get(u.id);
    const m = s?.metrics;
    if (!m) continue;
    const claude = s?.agent ? s.agent === "claude" : u.key.startsWith("claude");
    if (!claude) {
      // another agent: the whole session (its formula of a view's tokens is not known), held only against the same key
      if (m.costUsd !== undefined && !m.costPartial) u.usd = m.costUsd;
      if (m.inputTokens !== undefined || m.outputTokens !== undefined) u.tokens = { new: (m.inputTokens ?? 0) + (m.cacheWriteTokens ?? 0), out: m.outputTokens ?? 0, cr: m.cacheReadTokens ?? 0 };
      continue;
    }
    const px = Object.values(u.books).reduce((n, b) => n + b.px, 0);
    const use = usage.get(u.id);
    const log = logInfo.get(u.id);
    let streams = (use ? streamTokens(use.samples) : undefined) ?? log?.streams;
    const delegated = (log?.delegated ?? 0) > 0;
    const subs = streams ? [...streams.keys()].filter(Boolean).length : 0;
    const newTok = (m.inputTokens ?? 0) + (m.cacheWriteTokens ?? 0);
    const agentSession = use?.agentSession ?? log?.agentSession;
    // an older Claude Code did not stream its subagents: their use from its transcript
    if (!subs && (delegated || px / 750 > newTok) && agentSession && o.transcript) streams = o.transcript(agentSession) ?? streams;
    const r = readingShare(px, m, streams, delegated);
    if (!r) {
      if (m.costUsd !== undefined || m.inputTokens !== undefined) u.costUnknown = true;
      continue;
    }
    if (m.costUsd !== undefined && !m.costPartial) u.usd = m.costUsd * r.share;
    if (m.inputTokens !== undefined || m.outputTokens !== undefined || streams) u.tokens = r.tokens;
  }
  return [...units.values()];
}

/** The usage series of a unit: its clears and the context at the first, each subagent's apart; when that was. */
function applySeries(u: Unit, use: { samples: SeriesSample[] }): number | undefined {
  const series = use.samples.filter((s) => !s.total && hasContext(s));
  if (series.length < 2) return undefined;
  const c = clearsOf(series);
  u.series = true;
  u.clears = c.clears;
  const streams = streamClears(series);
  if (streams.length) u.streams = streams.map(({ clears, ctx }) => ({ clears, ...(ctx !== undefined ? { ctx } : {}) }));
  if (!c.first) return undefined;
  u.firstClearCtx = c.first.ctx;
  return c.first.t;
}

/** A line of a report's block that says its result. */
const RESULT_LINE = /^\s*(?:[-*]\s+)?\**result\**\s*:/imu;

/**
 * A reader's report of scans: each image whose block says its result is one reading; unsure (M5) when the reader could
 * not read it (unclear); what it marked illegible counted apart. A block without a result line is no reading. With
 * `scansOnly` (a report nobody recorded): only a reading of scans ("# Reading B…" or "-B…-", "-M…-" in its name).
 */
function readReport(u: Unit, file: string, media: Map<string, Media>, scansOnly = false): number {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return 0;
  }
  if (scansOnly && !(/^# Reading /m.test(text) && (/^# Reading [BbMm]\d+/m.test(text) || /-[BM]\d+(?![\p{L}\p{N}])/u.test(path.basename(file))))) return 0;
  const head = /^# Reading ([Bb]\d+)-/m.exec(text)?.[1]?.toUpperCase();
  let n = 0;
  for (const f of parseReport(text)) {
    if (!RESULT_LINE.test(f.text)) continue;
    const m = f.media ? media.get(f.media) : undefined;
    const b = bookOf(u, m?.recordset ?? head ?? "-");
    b.read++;
    n++;
    if (f.result === "unclear") b.unsure++;
    if (f.illegible?.length) b.marked = (b.marked ?? 0) + 1;
  }
  return n;
}

interface BackfillCtx {
  sessions: Map<string, Session>;
  usage: Map<string, Usage>;
  reports: Set<string>;
  media: Map<string, Media>;
  now: number;
  shared: string | undefined;
  hasFetch: Set<string>;
  /** When strom began recording its fetches (fetch.jsonl): an image fetched since is counted there. */
  fetchFrom: number;
  seen: Map<string, number[]>;
  /** The images the research shows read (a source on them, a reader's report). */
  readInResearch: Set<string>;
  /** Since when the views' record was kept (Infinity: never). */
  viewsFrom: number;
  endOf: (t: number, s: Session | undefined) => number;
  sessionAt: (created: string) => Unit | undefined;
  otherUnit: (by: string, t: number, older?: boolean) => Unit;
  logs: BackfillLogs;
  logInfo: Map<string, LogInfo>;
  lines?: LineOptions;
}

/** The reports of other kinds of readers (clips checked or found, transcripts, a calibration): no reading of scans. */
const NOT_SCAN_READING = /^\d{4}-\d\d-\d\d-(?:clips|transcripts|calibrate)(?:-|$)/;

/**
 * What older sessions left, for the last BACKFILL_DAYS: a session's log of Claude Code's stream (its use per request,
 * what strom fetch said of its requests and waits) where nothing of it was recorded, the readers' reports of scans
 * nobody recorded, and the images fetched before strom recorded its fetches (read or never read). Marked as recovered.
 * A log that cannot be read is counted and its reason kept, never passed over in silence.
 */
function backfill(tree: Tree, units: Map<string, Unit>, c: BackfillCtx): void {
  const since = c.now - BACKFILL_DAYS * DAY;
  const hostOfConnector = new Map<string, string>();
  try {
    for (const k of listConnectors(c.shared)) if (k.manifest.hosts[0]) hostOfConnector.set(k.name, k.manifest.hosts[0].replace(/^\*\./, ""));
  } catch {
    // no connectors here
  }
  const runs = path.join(tree.root, ".strom", "runs");
  for (const s of c.sessions.values()) {
    if (!(time(s.started) >= since)) continue;
    const needSeries = !c.usage.has(s.id);
    const needFetch = !c.hasFetch.has(s.id);
    if (!needSeries && !needFetch) continue;
    const plain = path.join(runs, `${s.id}.log`);
    const file = [plain, `${plain}.gz`].find((f) => fs.existsSync(f));
    if (!file) {
      // a session of strom run had its log: gone, strom tidy took it — what it held is not known
      if (s.runner && needSeries) c.logs.gone++;
      continue;
    }
    let got: LogRead;
    try {
      got = fromLog(file, hostOfConnector, c.lines);
    } catch (e) {
      c.logs.skipped++;
      const reasons = (c.logs.reasons ??= []);
      if (reasons.length < 10) reasons.push(`${path.basename(file)}: ${(e as Error)?.message ?? String(e)}`.slice(0, 200));
      continue;
    }
    c.logs.read++;
    c.logs.long += got.long;
    const reported = s.metrics?.model ?? s.model;
    const u = units.get(s.id) ?? unitOf(units, s.id, () => ({ kind: "session", at: s.started, key: recordKey(s.agent, s.model, reported), guessed: true, ...(reported ? { reported } : {}) }));
    const streams = streamTokens(got.samples);
    c.logInfo.set(s.id, { ...(streams ? { streams } : {}), delegated: got.delegated, ...(got.agentSession ? { agentSession: got.agentSession } : {}) });
    let used = false;
    if (needSeries && got.samples.length >= 2) {
      // the log's order, not its times: the clears are known, the views after them not
      applySeries(u, { samples: got.samples });
      used = true;
    }
    if (needFetch && got.fetches.length) {
      for (const f of got.fetches) {
        const h = hostOf(u, f.host);
        h.fetches++;
        h.requests += f.requests;
        h.waitMs += f.waitMs;
        if (f.later) h.later++;
        if (f.rs) bookOf(u, f.rs).requests += f.requests;
      }
      used = true;
    }
    if (used) u.backfill = true;
  }
  // the images fetched before strom recorded its fetches: fetched, and read or never read (M11)
  for (const m of c.media.values()) {
    if (!m.fetched || m.part || !m.recordset || m.image === undefined) continue;
    const t = time(m.created);
    if (!(t >= since) || t >= c.fetchFrom - 60_000) continue;
    const su = c.sessionAt(m.created);
    const u = su ?? c.otherUnit("agent", t, true);
    const end = c.endOf(t, su ? c.sessions.get(su.id) : undefined);
    const scan = `${m.recordset}:${m.image}`;
    const read = c.readInResearch.has(scan) || (c.seen.get(scan) ?? []).some((x) => x >= t - 60_000 && x <= end + UNREAD_AFTER_DAYS * DAY);
    const unjudged = !read && t < c.viewsFrom - 60_000;
    const pending = !read && !unjudged && c.now < end + UNREAD_AFTER_DAYS * DAY;
    const b = bookOf(u, m.recordset);
    const h = hostOf(u, hostOfConnector.get(m.fetched.connector) ?? m.fetched.connector);
    b.fetched++;
    h.fetched++;
    h.images++;
    if (unjudged) {
      b.unjudged = (b.unjudged ?? 0) + 1;
      h.unjudged = (h.unjudged ?? 0) + 1;
    } else if (pending) {
      b.pending++;
      h.pending++;
    } else if (!read) {
      b.unread++;
      h.unread++;
    }
    u.backfill = true;
  }
  // the readers' reports of scans of the last days nobody recorded (before strom recorded its readers)
  const dir = path.join(tree.root, "notes", "readings");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return;
  }
  for (const f of files) {
    const rel = `notes/readings/${f}`;
    if (c.reports.has(rel) || NOT_SCAN_READING.test(f)) continue;
    const full = path.join(dir, f);
    let mtime: number;
    try {
      mtime = fs.statSync(full).mtimeMs;
    } catch {
      continue;
    }
    if (mtime < since) continue;
    // its key: the session it was written in (strom read runs within one), else not known — never the settings of now
    const s = sessionAround(c.sessions, mtime);
    const reported = s?.metrics?.model;
    const u: Unit = { id: `backfill:${rel}`, kind: "reader", at: new Date(mtime).toISOString(), key: s ? recordKey(s.agent, s.model, reported) : UNKNOWN_KEY, guessed: true, backfill: true, ...(s ? { session: s.id } : {}), ...(reported ? { reported } : {}), books: {}, hosts: {} };
    // its readings only: the scans are those its views show (counted with the session that made them)
    if (!readReport(u, full, c.media, true)) continue;
    units.set(u.id, u);
  }
}

/** The session open at a moment (or ended within 5 minutes before it: a report written as it closed). */
function sessionAround(sessions: Map<string, Session>, t: number): Session | undefined {
  for (const s of sessions.values()) {
    const from = time(s.started);
    const to = s.ended ? time(s.ended) : Infinity;
    if (t >= from && t <= to + 5 * 60_000) return s;
  }
  return undefined;
}

/** What a session's log gave: the use per request, each strom fetch's requests and waits, its subagents. */
export interface LogRead {
  samples: SeriesSample[];
  fetches: { host: string; rs?: string; requests: number; waitMs: number; later: boolean }[];
  /** Subagents it started (Task / Agent). */
  delegated: number;
  /** Claude Code's own id of the session. */
  agentSession?: string;
  /** Lines too long to hold (an image): skipped. */
  long: number;
}

/** strom fetch's words of a limit used up (now and before), the host its older words name. */
const LATER = /the archive's limit is used up: try again|its hourly cap; (?:resumes|try again) at/;
const STOPPED_AT = /stopped: \d+ requests to (\S+) in the last hour/;

/**
 * Claude Code's stream in a session's log (or its compressed copy strom tidy left), read line by line — any size, a
 * line too long to hold (an image) skipped and counted: the use per request, each strom fetch's requests and waits (an
 * agent's own sleep after a limit used up too), the subagents it started. Throws when the log cannot be read.
 */
export function fromLog(file: string, hostOfConnector: Map<string, string> = new Map(), lines: LineOptions = {}): LogRead {
  const samples: SeriesSample[] = [];
  const last = new Map<string, { id?: string; index: number }>();
  const fetchCalls = new Map<string, { connector: string; rs?: string }>();
  const fetches: LogRead["fetches"] = [];
  let i = 0;
  let delegated = 0;
  let agentSession: string | undefined;
  /** the fetch a limit stopped, until the next one: an agent's sleep after it is a wait for that host */
  let stopped: number | undefined;
  const handle = (line: string) => {
    if (!line.startsWith("{")) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }
    i++;
    if (msg.type === "system" && typeof msg.session_id === "string" && msg.session_id) agentSession ??= msg.session_id;
    const use = claudeUsage(msg);
    if (use) {
      const sub = use.sample.sub ?? "";
      const had = last.get(sub);
      const sample: SeriesSample = { t: i, sub, ...said(use.sample as Record<string, unknown>) };
      // one request comes in several lines with its id: its last usage is the request's
      if (had && use.id !== undefined && had.id === use.id) samples[had.index] = sample;
      else {
        samples.push(sample);
        last.set(sub, { ...(use.id !== undefined ? { id: use.id } : {}), index: samples.length - 1 });
      }
    }
    const content = ((msg.message as { content?: unknown } | undefined)?.content ?? []) as { type?: string; id?: string; name?: string; input?: { command?: unknown }; tool_use_id?: string; content?: unknown }[];
    if (!Array.isArray(content)) return;
    const own = !(typeof msg.parent_tool_use_id === "string" && msg.parent_tool_use_id);
    for (const b of content) {
      if (b.type === "tool_use" && own && (b.name === "Task" || b.name === "Agent")) delegated++;
      if (b.type === "tool_use" && b.id && typeof b.input?.command === "string") {
        const command = b.input.command;
        const m = /(?:^|[\s;&|(])strom\s+fetch\s+([\p{L}\p{N}._-]+)/u.exec(command);
        if (m) {
          const rs = /--recordset\s+(B\d+)/.exec(command)?.[1];
          fetchCalls.set(b.id, { connector: m[1]!, ...(rs ? { rs: normalBook(rs) } : {}) });
          stopped = undefined;
        } else if (stopped !== undefined) {
          const sleep = /(?:^|[\s;&|(])sleep\s+(\d+)(?![\p{L}\p{N}])/u.exec(command);
          if (sleep) fetches[stopped]!.waitMs += Number(sleep[1]) * 1000;
        }
      }
      if (b.type === "tool_result" && b.tool_use_id && fetchCalls.has(b.tool_use_id)) {
        const call = fetchCalls.get(b.tool_use_id)!;
        fetchCalls.delete(b.tool_use_id);
        const out = typeof b.content === "string" ? b.content : Array.isArray(b.content) ? (b.content as { text?: unknown }[]).map((x) => (typeof x.text === "string" ? x.text : "")).join("\n") : "";
        const requests = [...out.matchAll(/(\d+) request\(s\)/g)].reduce((n, m) => n + Number(m[1]), 0);
        let host = hostOfConnector.get(call.connector) ?? call.connector;
        let waitMs = 0;
        for (const m of out.matchAll(/·\s+([^\s:]+): (?:its hourly cap is used up|it says its limit is used up)[^(]*\((\d+) min\)/g)) {
          host = m[1]!;
          waitMs += Number(m[2]) * 60_000;
        }
        const later = LATER.test(out);
        const named = STOPPED_AT.exec(out)?.[1];
        if (named) host = named;
        if (requests || waitMs || later) {
          fetches.push({ host, ...(call.rs ? { rs: call.rs } : {}), requests, waitMs, later });
          if (later) stopped = fetches.length - 1;
        }
      }
    }
  };
  // only what is read here is even made text: the model's responses, the start, a pending fetch's result
  const filter = (b: Buffer) => b[0] === 0x7b && (b.includes('"assistant"') || b.includes('"system"') || (fetchCalls.size > 0 && b.includes('"tool_result"')));
  const st = (file.endsWith(".gz") ? eachGzipLine : eachFileLine)(file, handle, { ...lines, filter });
  return { samples, fetches, delegated, ...(agentSession ? { agentSession } : {}), long: st.long };
}

/** "B1" → "B0001", as strom names its record sets. */
function normalBook(id: string): string {
  const n = /^B(\d+)$/.exec(id)?.[1];
  return n && n.length < 4 ? `B${n.padStart(4, "0")}` : id;
}

// ── the summary kept beside the research ───────────────────────────────────────────────────────────────────────────

export function rollupFile(root: string): string {
  return path.join(metricsDir(root), "rollup.json");
}

export function loadRollup(root: string): Rollup | undefined {
  try {
    const r = readJsonIfExists<Rollup>(rollupFile(root));
    return r && r.version === 1 && Array.isArray(r.units) ? r : undefined;
  } catch {
    return undefined;
  }
}

/** How much a unit holds (a count a summary lacks — written by another version — is none). */
function weight(u: Unit): number {
  const n = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return Object.values(u.books).reduce((s, b) => s + n(b.views) + n(b.read) + n(b.searches) + n(b.fetched) + n(b.requests) + n(b.noSharper), 0) + Object.values(u.hosts).reduce((s, h) => s + n(h.fetches) + n(h.requests) + n(h.later), 0);
}

/** The newer reading of a unit, with what only the older one knew (recovered parts, a journal shortened since). */
export function mergeUnit(older: Unit | undefined, newer: Unit): Unit {
  if (!older) return newer;
  // a journal shortened by strom tidy: the summary knew more
  const [main, rest] = weight(older) > weight(newer) ? [older, newer] : [newer, older];
  const out: Unit = { ...rest, ...main };
  if (!Object.keys(main.books).length) out.books = rest.books;
  if (!Object.keys(main.hosts).length) out.hosts = rest.hosts;
  if (!main.series && rest.series) for (const k of SERIES_FIELDS) if (rest[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = rest[k];
  if (older.backfill || newer.backfill) out.backfill = true;
  keepKey(out, older, newer);
  if (out.usd !== undefined) delete out.costUnknown;
  return out;
}

const SERIES_FIELDS = ["series", "clears", "firstClearCtx", "streams", "viewsAfterClear", "reopenedAfterClear"] as const;

/** A unit's key once kept is its key: a setting changed since never moves it (only a key recorded replaces a guess). */
function keepKey(out: Unit, older: Unit, newer: Unit): void {
  if (older.guessed && !newer.guessed) {
    out.key = newer.key;
    delete out.guessed;
    return;
  }
  out.key = older.key;
  if (older.guessed) out.guessed = true;
  else delete out.guessed;
}

/**
 * A unit recovered by an older version of the backfill, read again: the new reading wins; what it no longer finds (a
 * log strom tidy took since, views of a journal shortened) stays as the older one knew it. Its key: what its own record
 * says now (an older version took the settings of its day for it).
 */
function rebuilt(older: Unit, fresh: Unit): Unit {
  const views = (u: Unit) => Object.values(u.books).reduce((n, b) => n + b.views, 0);
  const out: Unit = { ...fresh };
  if (views(older) > views(fresh)) out.books = older.books;
  if (!Object.keys(fresh.hosts).length) out.hosts = older.hosts;
  if (!fresh.series && older.series) for (const k of SERIES_FIELDS) if (older[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = older[k];
  out.backfill = true;
  return out;
}

export interface RefreshOptions {
  settings?: Settings;
  now?: number;
  /** How a log is read (tests: small pieces). */
  lines?: LineOptions;
}

/** A Claude Code session's agent and subagents from its transcript (core/transcripts.ts): their tokens. */
function transcriptStreams(tree: Tree, settings: Settings): (agentSession: string) => StreamTokens | undefined {
  return (agentSession) => {
    const t = claudeTranscript(agentSession, { cwd: tree.root, env: tree.env, settings });
    if (t.status !== "ok" || t.main === "unknown" || t.subagents === "unknown" || !t.subagents.length) return undefined;
    const tok = (u: { input: number; output: number; cacheRead: number; cacheWrite: number }): Tokens => ({ in: u.input, out: u.output, cr: u.cacheRead, cw: u.cacheWrite });
    const out: StreamTokens = new Map([["", tok(t.main.usage)]]);
    for (const s of t.subagents) out.set(`agent:${s.id}`, tok(s.usage));
    return out;
  };
}

/**
 * The summary made again from the journals of now, keeping what they no longer hold (strom tidy shortened them) and,
 * once per BACKFILL_VERSION, what older sessions left for the last 30 days — a summary an older version recovered is
 * read again from what is still there. Nothing in an archive (nobody reads there).
 */
export function refreshRollup(tree: Tree, o: RefreshOptions = {}): Rollup | undefined {
  if (isArchive(tree)) return undefined;
  const now = o.now ?? Date.now();
  const settings = o.settings ?? new Settings(tree.env, {});
  const stored = loadRollup(tree.root);
  const rebuild = Boolean(stored?.backfilled) && (stored?.backfillVersion ?? 1) < BACKFILL_VERSION;
  const backfill = !stored?.backfilled || rebuild;
  const logs: BackfillLogs = { read: 0, gone: 0, skipped: 0, long: 0 };
  const fresh = computeUnits(tree, {
    guess: keyGuesser(settings, tree.config),
    shared: settings.shared()?.value,
    backfill,
    now,
    logs,
    transcript: transcriptStreams(tree, settings),
    ...(o.lines ? { lines: o.lines } : {}),
  });
  const units = new Map((stored?.units ?? []).map((u) => [u.id, u]));
  if (rebuild) {
    // a reader's report an older version took for a reading (a check of clips…): gone unless read so again
    const ids = new Set(fresh.map((u) => u.id));
    for (const [id, u] of units) if (u.backfill && id.startsWith("backfill:") && !ids.has(id)) units.delete(id);
  }
  for (const u of fresh) {
    const old = units.get(u.id);
    units.set(u.id, rebuild && old?.backfill ? rebuilt(old, u) : mergeUnit(old, u));
  }
  const keepFrom = now - KEEP_DAYS * DAY;
  const kept = [...units.values()].filter((u) => time(u.at) >= keepFrom && weight(u) + (u.series ? 1 : 0) + (u.outcome ? 1 : 0) > 0).sort((a, b) => time(a.at) - time(b.at) || a.id.localeCompare(b.id));
  const rollup: Rollup = {
    version: 1,
    updated: new Date(now).toISOString(),
    backfilled: backfill || !stored?.backfilled ? new Date(now).toISOString() : stored.backfilled,
    backfillVersion: BACKFILL_VERSION,
    ...(backfill ? { backfillLogs: logs } : stored?.backfillLogs ? { backfillLogs: stored.backfillLogs } : {}),
    units: kept,
  };
  // nothing measured and nothing kept: no file (the older sessions are looked at again next time)
  if (!stored && !kept.length) return rollup;
  try {
    fs.mkdirSync(metricsDir(tree.root), { recursive: true });
    writeFileAtomic(rollupFile(tree.root), JSON.stringify(rollup) + "\n");
  } catch {
    // the figures are said all the same
  }
  return rollup;
}

// ── the summary of one key ─────────────────────────────────────────────────────────────────────────────────────────

export type Metric = "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7" | "M8" | "M9" | "M10" | "M11";

export interface Signal {
  metric: Metric;
  /** book:B…, host:<host>, key */
  scope: string;
  value: number;
  base?: number;
  n: number;
  of?: number;
  ratio?: number;
  lo?: number;
  hi?: number;
  baseHi?: number;
  extra?: Record<string, number>;
}

export interface Recommendation {
  /** What P4 would do (A1–A7), or what only a person decides (D1, D4). */
  id: "A1" | "A2" | "A3" | "A4" | "A5" | "A7" | "D1" | "D4";
  what: string;
  scope: string;
  /** Done by strom itself in a later version (only towards accuracy or fewer requests); else a person's question. */
  auto: boolean;
  /** Requests to the archive it would add: never more by itself. */
  requestsMore: number;
  because: Metric[];
  from?: number;
  to?: number;
}

export interface BookSummary {
  id: string;
  title?: string;
  scans: number;
  views: number;
  units: number;
  /** The sessions its units belong to (a reader with the session that started it): the minimum of M1, M2, M5. */
  sessions?: number;
  viewsPerScan?: number;
  perScan?: number;
  read: number;
  unsure: number;
  /** The share of the readings unsure (result: unclear) — M5. */
  illegible?: number;
  /** Readings the reader marked something illegible in, transcripts written and those with [?]: shown only. */
  marked?: number;
  transcripts?: number;
  doubtful?: number;
  base?: number;
  enlarged?: number;
  enlargedBase?: number;
  searches: number;
  uncertain: number;
  negatives: number;
  weakNegatives: number;
  noSharper: number;
  requests: number;
  fetched: number;
  unread: number;
  unreadShare?: number;
  signals: Metric[];
}

export interface HostSummary {
  host: string;
  sessions: number;
  requests: number;
  requestsPerSession?: number;
  requestsPerImage?: number;
  waitMin: number;
  later: number;
  waitedSessions: number;
  fetched: number;
  unread: number;
  unreadShare?: number;
  signals: Metric[];
}

export interface KeyReport {
  key: string;
  model?: string;
  since?: string;
  backfill: boolean;
  guessed: boolean;
  window: { days: number };
  samples: { sessions: number; readers: number; others: number; scans: number; views: number; recovered: number };
  /** `unknownSessions`: sessions whose reading's share of the cost is not known (subagents read, their use not said). */
  cost: { unit: "usd" | "tokens" | "unknown"; perScan?: number; perView?: number; known: number; tokens?: { new: number; out: number; cr: number }; unknownSessions?: number };
  views: { perScan?: number; whole: number; half: number; crop: number; split: number; grid: number; enlarged: number; cached: number };
  /**
   * Per reader (a subagent of a session, a reader of strom read, a session that reads itself): those with a series
   * (`withSeries`), their clears, those that cleared, the context at the first (median). The tokens of one view
   * (Claude Code's w·h/750): `viewTokens` of all views of the key, `readerViewTokens` of a reader's (A3), from
   * `readerViewBasis`: the readers' own views, else the wholes and halves of the key, else all.
   */
  context: {
    units: number;
    withSeries: number;
    clears: number;
    withClears: number;
    ctxAtFirstClear?: number;
    reopened?: number;
    estimate: true;
    known: boolean;
    per?: "reader";
    viewTokens?: number;
    readerViewTokens?: number;
    readerViewBasis?: "readers" | "whole-half" | "all";
  };
  /**
   * The readers whose end says something of the reading, those of them without a result (M10), and apart those a
   * login, a plan's limit or a failure stopped (HALTED_OUTCOMES) — by how they ended.
   */
  readers: { n: number; noResult: number; halted: number; haltedBy?: Record<string, number> };
  books: BookSummary[];
  hosts: HostSummary[];
  signals: Signal[];
  /** Measures below their minimum sample: not compared yet. */
  short: Metric[];
  recommend: Recommendation[];
  /** What strom set by itself for this key (core/tune.ts), each with its reason. */
  tuned: TunedItem[];
  questions: never[];
}

/** One change strom made by itself, as the summary and a later reset list it (core/tune.ts). */
export interface TunedItem {
  id: string;
  /** A1–A7 */
  action: string;
  /** views.find, reading.batch, fetch.order… */
  what: string;
  /** book:B…, host:<host>, key */
  scope: string;
  from: number | boolean | string;
  to: number | boolean | string;
  at: string;
  why: string;
  source: "tuned";
  /** Where it is kept: the user config (the model in every research) or this research's .strom/tune. */
  where?: "config" | "research";
}

interface Group {
  key: string;
  reported?: string;
  units: Unit[];
}

/** The units of the window by key and the model the agent said (an older model under the same alias apart). */
export function groups(units: Unit[], now = Date.now()): Group[] {
  const from = now - WINDOW_DAYS * DAY;
  const inWindow = units.filter((u) => time(u.at) >= from);
  const byKey = new Map<string, Unit[]>();
  for (const u of inWindow) (byKey.get(u.key) ?? byKey.set(u.key, []).get(u.key)!).push(u);
  const out: Group[] = [];
  for (const [key, us] of byKey) {
    const sorted = [...us].sort((a, b) => time(a.at) - time(b.at));
    // the newest model said under the key; the units that said none go with it
    const latest = [...sorted].reverse().find((u) => u.reported)?.reported;
    const by = new Map<string, Unit[]>();
    for (const u of sorted) {
      const r = u.reported ?? latest ?? "";
      (by.get(r) ?? by.set(r, []).get(r)!).push(u);
    }
    for (const [r, list] of by) out.push({ key, ...(r ? { reported: r } : {}), units: list });
  }
  return out.sort((a, b) => time(b.units.at(-1)!.at) - time(a.units.at(-1)!.at));
}

/** The session a unit counts with: a session itself, a reader with the session that started it, else its own. */
const sessionOfUnit = (u: Unit) => (u.kind === "session" ? u.id : (u.session ?? u.id));

function bookTotals(units: Unit[]): Map<string, { c: BookCounts; units: Set<string>; sessions: Set<string>; usd: number; usdScans: number }> {
  const out = new Map<string, { c: BookCounts; units: Set<string>; sessions: Set<string>; usd: number; usdScans: number }>();
  for (const u of units) {
    const px = Object.values(u.books).reduce((n, b) => n + b.px, 0);
    const scans = Object.values(u.books).reduce((n, b) => n + b.scans, 0);
    for (const [id, b] of Object.entries(u.books)) {
      const t = out.get(id) ?? { c: emptyBook(), units: new Set<string>(), sessions: new Set<string>(), usd: 0, usdScans: 0 };
      addInto(t.c, b);
      if (b.scans || b.read) {
        t.units.add(u.id);
        t.sessions.add(sessionOfUnit(u));
      }
      if (u.usd !== undefined && b.scans) {
        // the unit's cost by the book's share of what it looked at
        t.usd += u.usd * (px > 0 ? b.px / px : scans > 0 ? b.scans / scans : 0);
        t.usdScans += b.scans;
      }
      out.set(id, t);
    }
  }
  return out;
}

/**
 * The usual of the other books: their pooled counts, and their median share — or, `pooled`, the share of them all
 * together (k/n: a median of shares mostly 0 would make any share look high), in the place of the median. The books of
 * other researches of the key when too few here.
 */
function baseOf(id: string, all: Map<string, { k: number; n: number }>, others: { k: number; n: number }[], min = 1, pooled = false): { k: number; n: number; median: number } | undefined {
  let pool = [...all].filter(([b, v]) => b !== id && b !== "-" && v.n >= min).map(([, v]) => v);
  if (pool.length < 2) pool = [...pool, ...others.filter((v) => v.n >= min)];
  if (!pool.length) return undefined;
  const k = pool.reduce((s, v) => s + v.k, 0);
  const n = pool.reduce((s, v) => s + v.n, 0);
  return { k, n, median: pooled ? (n > 0 ? k / n : 0) : (median(pool.map((v) => v.k / v.n)) ?? 0) };
}

export interface SummaryOptions {
  now?: number;
  /** The units of the other researches on this computer (their rollup.json): the usual when this one has too few books. */
  others?: Unit[];
  /** Book titles. */
  title?: (id: string) => string | undefined;
  /** The default sizes of reading (for what A2/A3 would set). */
  defaults?: { batch: number; viewsStop: number };
}

/** The figures, signals and what would be suggested for one key (and the model it said). */
export function summarize(group: Group, o: SummaryOptions = {}): KeyReport {
  const units = group.units;
  const books = bookTotals(units);
  const otherBooks = bookTotals((o.others ?? []).filter((u) => u.key === group.key));
  const ratesOf = (f: (c: BookCounts) => { k: number; n: number }, m: Map<string, { c: BookCounts }>) => new Map([...m].map(([id, v]) => [id, f(v.c)] as const));
  const unsureOf = (c: BookCounts) => ({ k: c.unsure, n: c.read });
  const enlargedOf = (c: BookCounts) => ({ k: c.enlarged, n: c.views });
  const unsureAll = ratesOf(unsureOf, books);
  const enlargedAll = ratesOf(enlargedOf, books);
  const unsureOthers = [...ratesOf(unsureOf, otherBooks).values()];
  const enlargedOthers = [...ratesOf(enlargedOf, otherBooks).values()];
  const perScanAll = new Map([...books].filter(([, v]) => v.usdScans > 0).map(([id, v]) => [id, v.usd / v.usdScans] as const));
  const vpsAll = new Map([...books].filter(([, v]) => v.c.scans > 0).map(([id, v]) => [id, v.c.views / v.c.scans] as const));
  const otherPerScan = [...otherBooks.values()].filter((v) => v.usdScans > 0).map((v) => v.usd / v.usdScans);
  const otherVps = [...otherBooks.values()].filter((v) => v.c.scans > 0).map((v) => v.c.views / v.c.scans);
  const rateBase = (id: string, all: Map<string, number>, others: number[]) => {
    let pool = [...all].filter(([b]) => b !== id && b !== "-").map(([, v]) => v);
    if (pool.length < 2) pool = [...pool, ...others];
    return median(pool);
  };
  const unread = new Map([...books].filter(([, v]) => decidedOf(v.c) > 0).map(([id, v]) => [id, v.c.unread / decidedOf(v.c)] as const));
  const unreadMedian = median([...unread.values()]);

  const signals: Signal[] = [];
  // a measure is short when nothing (no book, archive or key) has its minimum sample yet
  const tried = new Set<Metric>();
  const enough = new Set<Metric>();
  const met = (m: Metric) => (tried.add(m), enough.add(m));
  const bookList: BookSummary[] = [];
  for (const [id, v] of [...books].sort((a, b) => b[1].c.scans - a[1].c.scans || a[0].localeCompare(b[0]))) {
    if (id === "-") continue;
    const c = v.c;
    const sig: Metric[] = [];
    const scope = `book:${id}`;
    // M1 cost per scan
    const perScan = perScanAll.get(id);
    if (perScan !== undefined) {
      const base = rateBase(id, perScanAll, otherPerScan);
      const s = rateSignal(perScan, base, v.usdScans, { ratio: THRESHOLDS.M1.ratio, min: THRESHOLDS.M1.scans });
      if (s.enough && v.sessions.size >= THRESHOLDS.M1.units) met("M1");
      if (s.signal && v.sessions.size >= THRESHOLDS.M1.units) {
        sig.push("M1");
        signals.push({ metric: "M1", scope, value: perScan, ...(base !== undefined ? { base } : {}), n: v.usdScans, ...(s.ratio !== undefined ? { ratio: s.ratio } : {}) });
      } else if (!s.enough || v.sessions.size < THRESHOLDS.M1.units) tried.add("M1");
    }
    // M2 views per scan
    const vps = vpsAll.get(id);
    if (vps !== undefined) {
      const base = rateBase(id, vpsAll, otherVps);
      const s = rateSignal(vps, base, c.scans, { ratio: THRESHOLDS.M2.ratio, min: THRESHOLDS.M2.scans });
      if (s.enough && v.sessions.size >= THRESHOLDS.M2.units) met("M2");
      if (s.signal && v.sessions.size >= THRESHOLDS.M2.units) {
        sig.push("M2");
        signals.push({ metric: "M2", scope, value: vps, ...(base !== undefined ? { base } : {}), n: c.scans, ...(s.ratio !== undefined ? { ratio: s.ratio } : {}) });
      } else if (!s.enough || v.sessions.size < THRESHOLDS.M2.units) tried.add("M2");
    }
    // M5 unsure readings
    let unsureBase: number | undefined;
    if (c.read > 0) {
      const base = baseOf(id, unsureAll, unsureOthers);
      unsureBase = base?.median;
      const s = shareSignal(c.unsure, c.read, base, { ratio: THRESHOLDS.M5.ratio, plus: THRESHOLDS.M5.plus, min: THRESHOLDS.M5.read });
      if (s.enough && v.sessions.size >= THRESHOLDS.M5.units) met("M5");
      if (s.signal && v.sessions.size >= THRESHOLDS.M5.units) {
        sig.push("M5");
        signals.push({ metric: "M5", scope, value: s.p, ...(s.base !== undefined ? { base: s.base } : {}), n: c.read, ...(s.ratio !== undefined ? { ratio: s.ratio } : {}), lo: s.lo, hi: s.hi, ...(s.baseHi !== undefined ? { baseHi: s.baseHi } : {}) });
      } else if (!s.enough || v.sessions.size < THRESHOLDS.M5.units) tried.add("M5");
    }
    // M6 enlarged views
    let enlargedBase: number | undefined;
    if (c.views > 0) {
      // against the share of all the other books together (THRESHOLDS.M6.base)
      const base = baseOf(id, enlargedAll, enlargedOthers, 1, true);
      enlargedBase = base?.median;
      const s = shareSignal(c.enlarged, c.views, base, { ratio: THRESHOLDS.M6.ratio, min: THRESHOLDS.M6.views });
      if (s.enough) met("M6");
      if (s.signal) {
        sig.push("M6");
        signals.push({ metric: "M6", scope, value: s.p, ...(s.base !== undefined ? { base: s.base } : {}), n: c.views, ...(s.ratio !== undefined ? { ratio: s.ratio } : {}), lo: s.lo, hi: s.hi, ...(s.baseHi !== undefined ? { baseHi: s.baseHi } : {}) });
      } else if (!s.enough) tried.add("M6");
    }
    // M7 no sharper
    if (c.noSharper >= THRESHOLDS.M7.n) {
      sig.push("M7");
      signals.push({ metric: "M7", scope, value: c.noSharper, n: c.noSharper });
    }
    // M9 negatives on weak scans: shown only
    if (c.weakNegatives > 0) signals.push({ metric: "M9", scope, value: c.weakNegatives, n: c.negatives });
    // M11 fetched and never read
    const decided = decidedOf(c);
    const share = unread.get(id);
    if (share !== undefined) {
      // the sessions whose fetches of it say read or never read (not those fetched before the views were recorded)
      const fetchUnits = units.filter((u) => decidedOf(u.books[id]) > 0).length;
      if (fetchUnits >= THRESHOLDS.M11.sessions) met("M11");
      if (fetchUnits >= THRESHOLDS.M11.sessions && c.unread > 0 && (share > THRESHOLDS.M11.share || (unreadMedian !== undefined && unreadMedian > 0 && share >= THRESHOLDS.M11.ratio * unreadMedian && unread.size > 1))) {
        sig.push("M11");
        signals.push({ metric: "M11", scope, value: share, n: c.unread, of: decided, ...(unreadMedian !== undefined ? { base: unreadMedian } : {}) });
      } else if (fetchUnits < THRESHOLDS.M11.sessions) tried.add("M11");
    }
    bookList.push({
      id,
      ...(o.title?.(id) ? { title: o.title(id)! } : {}),
      scans: c.scans,
      views: c.views,
      units: v.units.size,
      sessions: v.sessions.size,
      ...(vps !== undefined ? { viewsPerScan: round(vps, 2) } : {}),
      ...(perScan !== undefined ? { perScan: round(perScan, 4) } : {}),
      read: c.read,
      unsure: c.unsure,
      ...(c.read ? { illegible: round(c.unsure / c.read, 3) } : {}),
      ...(c.marked ? { marked: c.marked } : {}),
      ...(c.transcripts ? { transcripts: c.transcripts, doubtful: c.doubtful ?? 0 } : {}),
      ...(unsureBase !== undefined ? { base: round(unsureBase, 3) } : {}),
      ...(c.views ? { enlarged: round(c.enlarged / c.views, 3) } : {}),
      ...(enlargedBase !== undefined ? { enlargedBase: round(enlargedBase, 3) } : {}),
      searches: c.searches,
      uncertain: c.uncertain,
      negatives: c.negatives,
      weakNegatives: c.weakNegatives,
      noSharper: c.noSharper,
      requests: c.requests,
      fetched: c.fetched,
      unread: c.unread,
      ...(share !== undefined ? { unreadShare: round(share, 3) } : {}),
      signals: sig,
    });
  }

  // archives
  const hostTotals = new Map<string, { c: HostCounts; sessions: Set<string>; waited: Set<string> }>();
  for (const u of units)
    for (const [h, hc] of Object.entries(u.hosts)) {
      const t = hostTotals.get(h) ?? { c: emptyHost(), sessions: new Set<string>(), waited: new Set<string>() };
      addInto(t.c, hc);
      t.sessions.add(u.id);
      if (hc.later > 0 || hc.waitMs > THRESHOLDS.M8.waitMs) t.waited.add(u.id);
      hostTotals.set(h, t);
    }
  const hostShares = [...hostTotals.values()].filter((v) => decidedOf(v.c) > 0).map((v) => v.c.unread / decidedOf(v.c));
  const hostList: HostSummary[] = [];
  for (const [h, v] of [...hostTotals].sort((a, b) => b[1].c.requests - a[1].c.requests || a[0].localeCompare(b[0]))) {
    const c = v.c;
    const sig: Metric[] = [];
    const scope = `host:${h}`;
    if (v.sessions.size >= THRESHOLDS.M8.sessions) met("M8");
    if (v.waited.size >= THRESHOLDS.M8.sessions) {
      sig.push("M8");
      signals.push({ metric: "M8", scope, value: v.waited.size, n: v.sessions.size, extra: { waitMin: Math.round(c.waitMs / 60_000), later: c.later } });
    } else if (v.sessions.size < THRESHOLDS.M8.sessions) tried.add("M8");
    const decided = decidedOf(c);
    const share = decided > 0 ? c.unread / decided : undefined;
    const med = median(hostShares);
    const fetchUnits = units.filter((u) => decidedOf(u.hosts[h]) > 0).length;
    if (share !== undefined && fetchUnits >= THRESHOLDS.M11.sessions) met("M11");
    if (share !== undefined && fetchUnits >= THRESHOLDS.M11.sessions && c.unread > 0 && (share > THRESHOLDS.M11.share || (med !== undefined && med > 0 && hostShares.length > 1 && share >= THRESHOLDS.M11.ratio * med))) {
      sig.push("M11");
      signals.push({ metric: "M11", scope, value: share, n: c.unread, of: decided });
    }
    hostList.push({
      host: h,
      sessions: v.sessions.size,
      requests: c.requests,
      ...(v.sessions.size ? { requestsPerSession: round(c.requests / v.sessions.size, 1) } : {}),
      ...(c.images ? { requestsPerImage: round(c.requests / c.images, 2) } : {}),
      waitMin: Math.round(c.waitMs / 60_000),
      later: c.later,
      waitedSessions: v.waited.size,
      fetched: c.fetched,
      unread: c.unread,
      ...(share !== undefined ? { unreadShare: round(share, 3) } : {}),
      signals: sig,
    });
  }

  // the key: context, readers
  const ordered = [...units].sort((a, b) => time(a.at) - time(b.at));
  const withSeries = ordered.filter((u) => u.series && Object.values(u.books).some((b) => b.views > 0));
  // per reader (THRESHOLDS.M4.per): each subagent of a session that delegated, else the session or reader itself
  const readerSeries: { clears: number; ctx?: number }[] = [];
  for (const u of withSeries)
    if (u.kind === "session" && u.streams?.length) readerSeries.push(...u.streams);
    else readerSeries.push({ clears: u.clears ?? 0, ...(u.firstClearCtx !== undefined ? { ctx: u.firstClearCtx } : {}) });
  const clears = readerSeries.reduce((n, r) => n + r.clears, 0);
  const withClears = readerSeries.filter((r) => r.clears > 0);
  const ctxFirst = median(withClears.map((r) => r.ctx ?? NaN));
  const after = withSeries.reduce((n, u) => n + (u.viewsAfterClear ?? 0), 0);
  const reopened = withSeries.reduce((n, u) => n + (u.reopenedAfterClear ?? 0), 0);
  const m3 = lastOf(withSeries.map((u) => (u.viewsAfterClear ?? 0) > 0 && (u.reopenedAfterClear ?? 0) / u.viewsAfterClear! >= THRESHOLDS.M3.share), THRESHOLDS.M3);
  if (m3.enough) met("M3");
  if (m3.signal) signals.push({ metric: "M3", scope: "key", value: m3.hits, n: m3.hits, of: m3.of, ...(after ? { extra: { reopened: round(reopened / after, 3) } } : {}) });
  else if (!m3.enough && withSeries.length) tried.add("M3");
  const m4 = lastOf(readerSeries.map((r) => r.clears > 0), THRESHOLDS.M4);
  if (m4.enough) met("M4");
  if (m4.signal) signals.push({ metric: "M4", scope: "key", value: m4.hits, n: m4.hits, of: m4.of, ...(ctxFirst !== undefined ? { extra: { ctx: Math.round(ctxFirst) } } : {}) });
  else if (!m4.enough && readerSeries.length) tried.add("M4");
  // M10 on the readers that read (a unit kept from before may carry noResult for one halted: its outcome decides)
  const readers = ordered.filter(isReading);
  const halted = ordered.filter(isHalted);
  const haltedBy: Record<string, number> = {};
  for (const u of halted) haltedBy[u.outcome!] = (haltedBy[u.outcome!] ?? 0) + 1;
  const m10 = lastOf(readers.map((u) => Boolean(u.noResult)), THRESHOLDS.M10);
  if (m10.enough) met("M10");
  if (m10.signal) signals.push({ metric: "M10", scope: "key", value: m10.hits, n: m10.hits, of: m10.of });
  else if (!m10.enough && readers.length) tried.add("M10");

  // the key's totals
  const all = emptyBook();
  for (const v of books.values()) addInto(all, v.c);
  let usd = 0;
  let usdScans = 0;
  let usdViews = 0;
  const tok = { new: 0, out: 0, cr: 0 };
  let tokScans = 0;
  for (const u of units) {
    const s = Object.values(u.books).reduce((n, b) => n + b.scans, 0);
    const vw = Object.values(u.books).reduce((n, b) => n + b.views, 0);
    if (!s) continue;
    if (u.usd !== undefined) {
      usd += u.usd;
      usdScans += s;
      usdViews += vw;
    }
    if (u.tokens) {
      tok.new += u.tokens.new;
      tok.out += u.tokens.out;
      tok.cr += u.tokens.cr;
      tokScans += s;
    }
  }
  const cost: KeyReport["cost"] =
    usdScans > 0
      ? { unit: "usd", perScan: round(usd / usdScans, 4), ...(usdViews ? { perView: round(usd / usdViews, 4) } : {}), known: round(all.scans ? usdScans / all.scans : 0, 3) }
      : tokScans > 0
        ? { unit: "tokens", known: round(all.scans ? tokScans / all.scans : 0, 3), tokens: { new: Math.round(tok.new / tokScans), out: Math.round(tok.out / tokScans), cr: Math.round(tok.cr / tokScans) } }
        : { unit: "unknown", known: 0 };
  const unknownSessions = units.filter((u) => u.costUnknown && Object.values(u.books).some((b) => b.scans > 0)).length;
  if (unknownSessions) cost.unknownSessions = unknownSessions;

  // the tokens of one view (Claude Code: w·h/750; another agent: not known) — of a reader (A3) apart from the key's
  const tokensOfViews = (px: number, n: number) => (n > 0 && px > 0 ? round(px / n / 750, 0) : undefined);
  let viewTokens: number | undefined;
  let readerView: { tokens: number; basis: "readers" | "whole-half" | "all" } | undefined;
  if (group.key.startsWith("claude")) {
    viewTokens = tokensOfViews(all.px, all.views);
    const readerUnits = units.filter((u) => u.kind === "reader");
    const rViews = readerUnits.reduce((n, u) => n + Object.values(u.books).reduce((m, b) => m + b.views, 0), 0);
    const rPx = readerUnits.reduce((n, u) => n + Object.values(u.books).reduce((m, b) => m + b.px, 0), 0);
    const wh = all.whole + all.half;
    const own = rViews >= READER_VIEWS_MIN ? tokensOfViews(rPx, rViews) : undefined;
    const whole = wh >= READER_VIEWS_MIN ? tokensOfViews(all.pxWH ?? 0, wh) : undefined;
    readerView = own ? { tokens: own, basis: "readers" } : whole ? { tokens: whole, basis: "whole-half" } : viewTokens ? { tokens: viewTokens, basis: "all" } : undefined;
  }

  const report: KeyReport = {
    key: group.key,
    ...(group.reported ? { model: group.reported } : {}),
    ...(ordered.length ? { since: ordered[0]!.at.slice(0, 10) } : {}),
    backfill: units.some((u) => u.backfill),
    guessed: units.some((u) => u.guessed),
    window: { days: WINDOW_DAYS },
    samples: {
      sessions: units.filter((u) => u.kind === "session").length,
      readers: units.filter((u) => u.kind === "reader").length,
      others: units.filter((u) => u.kind === "other").length,
      scans: all.scans,
      views: all.views,
      recovered: units.filter((u) => u.backfill).length,
    },
    cost,
    views: {
      ...(all.scans ? { perScan: round(all.views / all.scans, 2) } : {}),
      whole: part(all.whole, all.views),
      half: part(all.half, all.views),
      crop: part(all.crop, all.views),
      split: part(all.split, all.views),
      grid: part(all.grid, all.views),
      enlarged: part(all.enlarged, all.views),
      cached: part(all.cached, all.views),
    },
    context: {
      units: ordered.filter((u) => Object.values(u.books).some((b) => b.views > 0)).length,
      withSeries: readerSeries.length,
      clears,
      withClears: withClears.length,
      ...(ctxFirst !== undefined ? { ctxAtFirstClear: Math.round(ctxFirst) } : {}),
      ...(after ? { reopened: round(reopened / after, 3) } : {}),
      estimate: true,
      known: readerSeries.length > 0,
      per: "reader",
      ...(viewTokens !== undefined ? { viewTokens } : {}),
      ...(readerView ? { readerViewTokens: readerView.tokens, readerViewBasis: readerView.basis } : {}),
    },
    readers: { n: readers.length, noResult: readers.filter((u) => u.noResult).length, halted: halted.length, ...(halted.length ? { haltedBy } : {}) },
    books: bookList,
    hosts: hostList,
    signals,
    short: [...tried].filter((m) => !enough.has(m)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))),
    recommend: [],
    tuned: [],
    questions: [],
  };
  report.recommend = recommendations(report, o.defaults ?? READING_DEFAULTS, units);
  return report;
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const part = (k: number, n: number) => (n > 0 ? round(k / n, 3) : 0);

/**
 * What the signals would lead to — suggested only (a later version does what goes only towards accuracy or fewer
 * requests by itself; the rest is a person's question). Never fewer details, a cheaper model, nor a higher cap of an
 * archive; nothing that asks an archive for more.
 */
export function recommendations(r: KeyReport, defaults: { batch: number; viewsStop: number }, units: Unit[] = []): Recommendation[] {
  const out: Recommendation[] = [];
  const by = (m: Metric) => r.signals.filter((s) => s.metric === m);
  for (const b of r.books) {
    const scope = `book:${b.id}`;
    const because = b.signals.filter((m) => m === "M5" || m === "M6");
    if (because.length) out.push({ id: "A1", what: "views.reading-size", scope, auto: true, requestsMore: 0, because });
    if (b.signals.includes("M7")) out.push({ id: "A5", what: "parts.none", scope, auto: true, requestsMore: 0, because: ["M7"] });
    if (b.signals.includes("M11")) out.push({ id: "A7", what: "fetch.only-needed", scope, auto: true, requestsMore: 0, because: ["M11"] });
    if (b.weakNegatives > 0) out.push({ id: "D4", what: "negatives.weak", scope, auto: false, requestsMore: 0, because: ["M9"] });
  }
  for (const h of r.hosts) {
    const scope = `host:${h.host}`;
    if (h.signals.includes("M8")) out.push({ id: "A4", what: "fetch.whole-first", scope, auto: true, requestsMore: 0, because: ["M8"] });
    if (h.signals.includes("M11")) out.push({ id: "A7", what: "fetch.only-needed", scope, auto: true, requestsMore: 0, because: ["M11"] });
  }
  const key: Metric[] = (["M3", "M4", "M10"] as const).filter((m) => by(m).length);
  if (key.length) out.push({ id: "A2", what: "reading.batch", scope: "key", auto: true, requestsMore: 0, because: [...key], from: defaults.batch, to: Math.max(1, Math.ceil(defaults.batch * TUNING.smallest)) });
  // the views a reader takes before its context clears: TUNING.stopShare × the context at the first clear / the tokens of
  // one view of a reader (w·h/750: Claude Code's; another agent's is not known — nothing)
  if (by("M4").length && r.context.ctxAtFirstClear && r.key.startsWith("claude")) {
    const px = units.reduce((n, u) => n + Object.values(u.books).reduce((m, b) => m + b.px, 0), 0);
    const views = units.reduce((n, u) => n + Object.values(u.books).reduce((m, b) => m + b.views, 0), 0);
    const perView = r.context.readerViewTokens ?? (views ? px / views / 750 : 0);
    if (perView > 0) {
      const stop = Math.floor((TUNING.stopShare * r.context.ctxAtFirstClear) / perView);
      if (stop < defaults.viewsStop) out.push({ id: "A3", what: "reading.views", scope: "key", auto: true, requestsMore: 0, because: ["M4"], from: defaults.viewsStop, to: Math.max(TUNING.stopMin, stop) });
    }
  }
  // cheaper only through a calibration a person starts: a high cost per scan (D1_BASIS — never views per scan alone) on
  // D1_BOOKS books that read well
  const costly = r.books.filter((b) => D1_BASIS.some((m) => b.signals.includes(m)) && !b.signals.includes("M5"));
  if (costly.length >= D1_BOOKS) out.push({ id: "D1", what: "views.smaller", scope: "key", auto: false, requestsMore: 0, because: [...D1_BASIS] });
  return out;
}

/** The units of the other researches on this computer (their summaries only, read as they are). */
export function otherUnits(roots: string[], self: string): Unit[] {
  const out: Unit[] = [];
  for (const root of roots) {
    if (path.resolve(root) === path.resolve(self)) continue;
    const r = loadRollup(root);
    if (r) out.push(...r.units.map((u) => ({ ...u, id: `${path.basename(root)}/${u.id}` })));
  }
  return out;
}
