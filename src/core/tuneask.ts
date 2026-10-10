// The questions about the reading of scans that only a person answers (strom media calibrate --questions, --answer,
// the menu's What waits for you): what strom must not do by itself — smaller views (only through the paid calibration
// the person starts), searching weak scans again, sharper parts from an archive, an index first from how many scans,
// the model handwriting is read with, a change of the tuning that made the reading worse. Each comes with what strom
// recommends (first) and why, in numbers, from what strom recorded (core/readstats.ts): free, nothing fetched. Nothing
// is decided for the person: without an answer the default holds, and an agent never answers (it tells the person).
//
// Anything that would ask an archive for more says how many requests more, per host, and how long at the host's pace
// and hourly cap; a host's cap is never raised nor suggested raised. Nothing suggests a cheaper model or fewer details:
// the best model reads handwriting (vision.best only offers the research's own model back).
//
// Per key of agent and model (calibrationKey: an agent or model that read no scans is asked nothing), its answers kept
//   - of the key in the user config: tuneAnswers[key][kind]
//   - of a book, an archive or the research in .strom/tune/answers.json: [key]["kind:B…|host"] (never data/, never git)
// each {choice, at, fingerprint, by, strom, basis}. Asked again only when the data changed (DUE below), never for time
// alone, at most once in ASK.againDays per kind and scope; "never" only for another model or a new method.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readJsonIfExists, writeFileAtomic } from "./json.ts";
import { isArchive } from "./mode.ts";
import { metricsDir } from "./metrics.ts";
import { calibrationKey, viewModel } from "./viewsizes.ts";
import { D1_BASIS, D1_BOOKS, groups, isReading, loadRollup, readJournal, refreshRollup, summarize, THRESHOLDS, wilson, WINDOW_DAYS, READING_DEFAULTS, type BookSummary, type KeyReport, type Unit } from "./readstats.ts";
import { findImage } from "./media.ts";
import { bareHost, listConnectors, type Connector } from "./connector.ts";
import { hostPace, hostState, paceOf } from "./net.ts";
import { PROFILES } from "../agents/profiles.ts";
import { aboutPeople, scopes } from "./directions.ts";
import { treeEdges } from "./edge.ts";
import { displayName, lifespan } from "./people.ts";
import { phrase } from "./phrases.ts";
import { VERSION } from "./tree.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import type { Settings, UserConfig } from "./config.ts";
import type { Media, Person, RecordSet, Search, Task } from "./model.ts";
import type { Tree } from "./tree.ts";

const DAY = 24 * 3600_000;

export const QUESTION_KINDS = ["views.smaller", "negatives.weak", "views.sharper", "index.first", "vision.best", "reset.after"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

/**
 * The method of each kind of question: raised when strom changes what the question is about (condition 5 — asked
 * again, a "never" too).
 */
export const QUESTION_REV: Record<QuestionKind, number> = {
  "views.smaller": 1,
  "negatives.weak": 1,
  "views.sharper": 1,
  "index.first": 1,
  "vision.best": 1,
  "reset.after": 1,
};

/** When a question is asked, and again: every threshold in one place (to be checked again on more data). */
export const ASK = {
  /** At most one question of a kind and scope in this many days (and "later" asks again after them). */
  againDays: 30,
  /** The sample grew by half and by at least this many units since the answer. */
  growShare: 0.5,
  growUnits: 10,
  /** The ratio to the usual moved by a quarter. */
  ratioChange: 0.25,
  /** A copy of a scan (a part, a new scan) is sharper from this much more detail on. */
  sharperGain: 1.25,
  /** views.sharper: "no" recommended when the requests more pass this share of the day's at the host. */
  sharperShare: 0.1,
  /** views.smaller: books that read well but cost clearly more (D1, readstats: its D1_BOOKS). */
  smallerBooks: D1_BOOKS,
  /** index.first: books browsed page by page where an index of the place is known; at least this many scans each. */
  indexBooks: 2,
  indexScans: 20,
  /** vision.best: the readings of the vision model this many times less sure than the research's model. */
  visionRatio: 1.5,
  /** reset.after (8.4): the windows before and after a change of the tuning, and what counts as worse. */
  reset: {
    beforeScans: 60,
    after: { key: { scans: 30, units: 3 }, book: { scans: 15, units: 2 } },
    worse: 1.5,
    costlier: 1.3,
  },
} as const;

/** The origin of the tasks an answer "edge" of negatives.weak adds. */
export const TUNE_NEGATIVES_ORIGIN = "tune:negatives";

export interface Choice {
  id: string;
  label: string;
  /** What the answer does: nothing but keep it, tasks added, a setting changed, a command for the person to run. */
  effect: "none" | "tasks" | "setting" | "command";
  /** Requests more to archives (an estimate, at the host's pace and hourly cap). */
  requests?: { host: string; n: number; minutes: number }[];
  tasks?: number;
}

export interface Basis {
  metric: string;
  value: number;
  samples: number;
  ratio?: number;
  /** New material in the question's scope: sharper copies, indexes of the place, the change of the tuning. */
  material?: string[];
  reported?: string;
  rev: number;
  extra?: Record<string, number | string>;
}

export interface Question {
  id: string;
  kind: QuestionKind;
  key: { agent: string; model: string | null; reported: string | null; recordset: string | null; host: string | null };
  /** key, research, book:B…, host:<host> */
  scope: string;
  text: string;
  choices: Choice[];
  recommended: string;
  why: string;
  basis: Basis;
  fingerprint: string;
  /** The command a person answers it with (the recommended choice). */
  answer: string;
  asked: string;
  /** Asked now; else answered before and not asked again until the data change. */
  due: boolean;
  answered?: { choice: string; at: string; by: string };
}

/** An answer kept: what the person chose, when, on what data. */
export interface TuneAnswer {
  choice: string;
  at: string;
  fingerprint: string;
  by: "terminal" | "window" | "app";
  strom: string;
  basis?: Basis;
}

type Answers = Record<string, Record<string, TuneAnswer>>;

export function tuneDir(root: string): string {
  return path.join(root, ".strom", "tune");
}
const answersFile = (root: string) => path.join(tuneDir(root), "answers.json");
const askedFile = (root: string) => path.join(tuneDir(root), "asked.json");

/** Where an answer of a kind is kept: the key's in the user config, the rest beside the research. */
export function keptInConfig(kind: QuestionKind, scope: string): boolean {
  return kind === "views.smaller" || kind === "vision.best" || (kind === "reset.after" && scope === "key");
}

/** The name of an answer in answers.json: the kind, and the book or archive it is about. */
function slot(kind: QuestionKind, scope: string): string {
  const sub = scope.replace(/^(book|host):/, "");
  return scope === "key" || scope === "research" ? kind : `${kind}:${sub}`;
}

/** A short ID, the same for the same question (kind, key, scope) every time; never one of the search's (Q + digits). */
export function questionId(kind: QuestionKind, key: string, scope: string): string {
  const h = crypto.createHash("sha1").update(`${kind}\n${key}\n${scope}`).digest("hex").slice(0, 6);
  return `Q${/[a-f]/.test(h) ? h : "abcdef"[Number(h[0]) % 6] + h.slice(1)}`;
}

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])]));
  return v;
}

export function fingerprintOf(basis: Basis): string {
  return `sha1:${crypto.createHash("sha1").update(JSON.stringify(canonical(basis))).digest("hex")}`;
}

/** The answers kept for a key: the user config's, and this research's. */
export function storedAnswers(root: string, cfg: UserConfig, key: string): { config: Record<string, TuneAnswer>; research: Record<string, TuneAnswer> } {
  let research: Record<string, TuneAnswer> = {};
  try {
    research = readJsonIfExists<Answers>(answersFile(root))?.[key] ?? {};
  } catch {
    // a file written over: as if nothing was answered
  }
  return { config: cfg.tuneAnswers?.[key] ?? {}, research };
}

/**
 * The answer a person gave to a kind of question for a key (and a book, an archive): for what goes by it (the brief,
 * the tuning) — e.g. the threshold of index.first, "brief" of negatives.weak.
 */
export function tuneAnswer(root: string, cfg: UserConfig, key: string, kind: QuestionKind, scope = "key"): TuneAnswer | undefined {
  const s = storedAnswers(root, cfg, key);
  return keptInConfig(kind, scope) ? s.config[kind] : s.research[slot(kind, scope)];
}

/** The scans from how many on an index is looked at first, as the person answered (none: as the method says). */
export function indexFirstThreshold(root: string, cfg: UserConfig, key: string): number | "never" | undefined {
  const a = tuneAnswer(root, cfg, key, "index.first", "research");
  if (!a) return undefined;
  return a.choice === "never" ? "never" : Number.isInteger(Number(a.choice)) ? Number(a.choice) : undefined;
}

// ── when it is asked again ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Whether a question answered before is asked again (chapter 7): another model said under the key (1), the sample
 * grown by half and by ASK.growUnits (2), the ratio to the usual moved by a quarter or the signal gone and back (3),
 * new material in its scope (4), a new method of the kind (5). Never for time alone, never within ASK.againDays of the
 * answer; "never" only for 1 or 5; "later" asks again once ASK.againDays passed.
 */
export function dueAgain(q: { basis: Basis }, a: TuneAnswer, now: number, goneSince?: string): boolean {
  const b = a.basis;
  const at = Date.parse(a.at);
  if (Number.isFinite(at) && now - at < ASK.againDays * DAY) return false;
  if (!b) return a.choice === "later";
  const model = (q.basis.reported ?? "") !== (b.reported ?? "");
  const method = q.basis.rev !== b.rev;
  if (model || method) return true;
  if (a.choice === "never") return false;
  if (a.choice === "later") return true;
  const grown = q.basis.samples >= b.samples * (1 + ASK.growShare) && q.basis.samples >= b.samples + ASK.growUnits;
  const moved = q.basis.ratio !== undefined && b.ratio !== undefined && b.ratio > 0 && Number.isFinite(q.basis.ratio) && Math.abs(q.basis.ratio / b.ratio - 1) >= ASK.ratioChange;
  const back = goneSince !== undefined && goneSince > a.at;
  const fresh = (q.basis.material ?? []).some((m) => !(b.material ?? []).includes(m));
  return grown || moved || back || fresh;
}

// ── what the questions stand on ────────────────────────────────────────────────────────────────────────────────────

interface Draft {
  kind: QuestionKind;
  scope: string;
  recordset?: string;
  host?: string;
  text: string;
  why: string;
  choices: Choice[];
  recommended: string;
  basis: Basis;
}

interface Ctx {
  tree: Tree;
  settings: Settings;
  t: (k: UIKey, v?: Record<string, string | number>) => string;
  nf: (n: number, digits?: number) => string;
  pct: (n: number | undefined) => string;
  key: string;
  agent: string;
  reported?: string;
  report: KeyReport;
  units: Unit[];
  now: number;
  shared?: string;
  media: Media[];
  fetches: Record<string, unknown>[];
  connectors: Connector[];
}

/** "1-30, 45" → the numbers; undefined when it is no such list. */
function numbers(v: string | undefined): Set<number> | undefined {
  if (!v) return undefined;
  const out = new Set<number>();
  for (const part of v.split(/[,;\s]+/u).filter(Boolean)) {
    const m = /^(\d+)(?:[-–](\d+))?$/u.exec(part);
    if (!m) return undefined;
    const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])];
    if (b < a || b - a > 5000) return undefined;
    for (let n = a; n <= b; n++) out.add(n);
  }
  return out.size ? out : undefined;
}

/** How much more detail a copy of a scan has than the scan it is of (a part, a new scan of the same image). */
function gainOf(m: Media, all: Media[]): number | undefined {
  if (m.retracted || !m.width || m.recordset === undefined || m.image === undefined) return undefined;
  if (m.part) {
    const whole = findImage(all.filter((x) => !x.part), m.recordset, m.image);
    return whole?.width && m.part.w > 0 ? m.width / m.part.w / whole.width : undefined;
  }
  const before = all.filter((x) => x.id !== m.id && !x.part && !x.retracted && x.recordset === m.recordset && x.image === m.image && x.width && x.created < m.created);
  const w = Math.max(0, ...before.map((x) => x.width!));
  return w > 0 ? m.width / w : undefined;
}

/** The sharper copies of a book (part or new scan, ≥ ASK.sharperGain), with their gain. */
function sharperCopies(media: Media[], rs: string): { m: Media; gain: number }[] {
  const out: { m: Media; gain: number }[] = [];
  for (const m of media) {
    if (m.recordset !== rs) continue;
    const gain = gainOf(m, media);
    if (gain !== undefined && gain >= ASK.sharperGain) out.push({ m, gain });
  }
  return out;
}

/** The archive a book's images came from: the host of the connector that fetched them. */
function hostOfBook(c: Ctx, rs: string): { host: string; connector?: Connector } | undefined {
  const name = c.media.find((m) => m.recordset === rs && m.fetched?.connector)?.fetched?.connector;
  if (!name) return undefined;
  const connector = c.connectors.find((k) => k.name === name);
  const host = connector?.manifest.hosts[0] ? bareHost(connector.manifest.hosts[0]) : undefined;
  return host ? { host, ...(connector ? { connector } : {}) } : undefined;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Requests one part of an image takes at a host (what strom fetch measured; else one). */
function perPart(c: Ctx, host: string): number {
  const parts = c.fetches.filter((f) => f.cmd === "part" && num((f.hosts as Record<string, { requests?: unknown }> | undefined)?.[host]?.requests) > 0);
  if (!parts.length) return 1;
  return parts.reduce((n, f) => n + num((f.hosts as Record<string, { requests?: unknown }>)[host]!.requests), 0) / parts.length;
}

/** The requests to a host today; nothing today: its usual day of the window (the median of its days). */
function dayRequests(c: Ctx, host: string): number {
  const byDay = new Map<string, number>();
  const from = c.now - WINDOW_DAYS * DAY;
  for (const f of c.fetches) {
    const t = typeof f.at === "string" ? Date.parse(f.at) : NaN;
    if (!(t >= from)) continue;
    const n = num((f.hosts as Record<string, { requests?: unknown }> | undefined)?.[host]?.requests);
    if (!n) continue;
    const day = new Date(t).toDateString();
    byDay.set(day, (byDay.get(day) ?? 0) + n);
  }
  const today = byDay.get(new Date(c.now).toDateString());
  if (today) return today;
  const days = [...byDay.values()].sort((a, b) => a - b);
  return days.length ? days[Math.floor(days.length / 2)]! : 0;
}

/** How long n requests take at a host: its pace, and its hourly cap when it has one — never more than it allows. */
function minutesFor(c: Ctx, host: string, connector: Connector | undefined, n: number): number {
  const pace = c.shared ? hostPace(hostState(path.join(c.shared, "net"), host), connector?.manifest.policy.pace) : paceOf(connector?.manifest.policy.pace);
  const byPace = (n * pace.minIntervalMs) / 60_000;
  const byCap = Number.isFinite(pace.perHour) && n > pace.perHour ? Math.floor((n - 1) / pace.perHour) * 60 : 0;
  return Math.max(1, Math.ceil(Math.max(byPace, byCap)));
}

function requestsText(c: Ctx, r: { host: string; n: number; minutes: number }[]): string {
  return r.map((x) => c.t("ui.tune.q.requests", { n: x.n, host: x.host, minutes: x.minutes })).join("; ");
}

const short = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);
const name = (p: Person) => `${displayName(p)}${lifespan(p) ? ` (${lifespan(p)})` : ""}`;

// ── the kinds ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * views.smaller (D1): books that read well cost clearly more per scan (D1_BASIS — never views per scan alone: they follow
 * the kind of work) — smaller views only through the paid calibration.
 */
function viewsSmaller(c: Ctx): Draft[] {
  if (!c.report.recommend.some((r) => r.id === "D1")) return [];
  // calibrated already: the sizes were measured on the research's own records
  if (c.settings.config.viewSizes?.[c.key]) return [];
  const costly = c.report.books.filter((b) => D1_BASIS.some((m) => b.signals.includes(m)) && !b.signals.includes("M5"));
  if (costly.length < ASK.smallerBooks) return [];
  const ratios = c.report.signals.filter((s) => D1_BASIS.includes(s.metric) && costly.some((b) => s.scope === `book:${b.id}`) && s.ratio !== undefined && Number.isFinite(s.ratio)).map((s) => s.ratio!);
  const ratio = ratios.length ? ratios.sort((a, b) => a - b)[Math.floor(ratios.length / 2)]! : 0;
  const scans = costly.reduce((n, b) => n + b.scans, 0);
  return [
    {
      kind: "views.smaller",
      scope: "key",
      text: c.t("ui.tune.q.smaller", { n: costly.length }),
      why: c.t("ui.tune.q.smaller.why", { n: costly.length, books: costly.map((b) => b.id).join(", "), ratio: c.nf(ratio), scans }),
      choices: [
        { id: "calibrate", label: c.t("ui.tune.q.c.calibrate"), effect: "command" },
        { id: "later", label: c.t("ui.tune.q.c.later"), effect: "none" },
        { id: "never", label: c.t("ui.tune.q.c.never"), effect: "none" },
      ],
      recommended: "calibrate",
      basis: { metric: "costlyBooks", value: costly.length, samples: scans, ...(ratio ? { ratio: Math.round(ratio * 100) / 100 } : {}), rev: QUESTION_REV["views.smaller"] },
    },
  ];
}

/** The people the tasks of some searches were about, on the tree's edge or in a direction at work, each with the task. */
function peopleToSearch(tree: Tree, searches: Search[]): { person: Person; task: Task }[] {
  const tasks = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  let edges: Set<string> | undefined;
  const active = scopes(tree).filter((s) => !s.research.retracted && s.research.state === "active");
  const reached = (p: string) => active.some((s) => s.people.has(p)) || (edges ??= new Set(treeEdges(tree).edges.keys())).has(p);
  // one task per person, never one more where a re-reading of weak scans is open for them already
  const open = new Set(
    [...tasks.values()]
      .filter((t) => t.origin === TUNE_NEGATIVES_ORIGIN && ["open", "doing", "parked", "waiting"].includes(t.state))
      .flatMap((t) => t.subject),
  );
  const out = new Map<string, { person: Person; task: Task }>();
  for (const s of searches) {
    const task = s.task ? tasks.get(s.task) : undefined;
    if (!task || task.retracted) continue;
    for (const id of aboutPeople(tree, task.subject)) {
      const p = tree.get<Person>(id);
      if (!p || p.retracted || open.has(id) || !reached(id)) continue;
      const had = out.get(id);
      if (!had || task.priority > had.task.priority) out.set(id, { person: p, task });
    }
  }
  return [...out.values()].sort((a, b) => a.person.id.localeCompare(b.person.id));
}

/** negatives.weak (D4): negatives found on weak scans, and a sharper copy of them is here now — search them again? */
function negativesWeak(c: Ctx): Draft[] {
  const out: Draft[] = [];
  for (const b of c.report.books) {
    if (!(b.weakNegatives > 0)) continue;
    const copies = sharperCopies(c.media, b.id);
    if (!copies.length) continue;
    const negatives = c.tree.list<Search>("search").filter((s) => !s.retracted && s.result === "negative" && s.recordsets.includes(b.id));
    // the negatives a sharper copy came after, of the images they covered (all of the book when they do not say)
    const weak = negatives.filter((s) => {
      const pages = numbers(s.scope.pages);
      return copies.some((x) => x.m.created > s.created && (!pages || (x.m.image !== undefined && pages.has(x.m.image))));
    });
    if (!weak.length) continue;
    const later = copies.filter((x) => weak.some((s) => x.m.created > s.created));
    const gain = Math.max(...later.map((x) => x.gain));
    // the images searched with no sharper copy yet: a part each, at most, if the search goes over them
    const covered = new Set(copies.map((x) => x.m.image));
    const bare = new Set<number>();
    for (const s of weak) for (const n of numbers(s.scope.pages) ?? []) if (!covered.has(n)) bare.add(n);
    const at = hostOfBook(c, b.id);
    const requests = at && bare.size ? [{ host: at.host, n: Math.ceil(bare.size * perPart(c, at.host)), minutes: minutesFor(c, at.host, at.connector, Math.ceil(bare.size * perPart(c, at.host))) }] : [];
    const people = peopleToSearch(c.tree, weak);
    const title = b.title ?? c.tree.get<RecordSet>(b.id)?.title ?? b.id;
    const more = requests.length ? ` — ${requestsText(c, requests)}` : "";
    const choices: Choice[] = [
      ...(people.length ? [{ id: "edge", label: c.t("ui.tune.q.c.edge", { tasks: people.length }) + more, effect: "tasks" as const, tasks: people.length, ...(requests.length ? { requests } : {}) }] : []),
      { id: "brief", label: c.t("ui.tune.q.c.brief"), effect: "none" },
      { id: "no", label: c.t("ui.tune.q.c.no"), effect: "none" },
    ];
    out.push({
      kind: "negatives.weak",
      scope: `book:${b.id}`,
      recordset: b.id,
      ...(at ? { host: at.host } : {}),
      text: c.t("ui.tune.q.weak", { book: b.id, title, n: b.weakNegatives }),
      why: c.t("ui.tune.q.weak.why", { n: b.weakNegatives, of: b.negatives, gain: c.nf(gain), copies: later.length }),
      choices,
      recommended: choices[0]!.id,
      basis: {
        metric: "weakNegatives",
        value: b.weakNegatives,
        samples: b.negatives,
        material: later.map((x) => x.m.id).sort(),
        rev: QUESTION_REV["negatives.weak"],
        extra: { gain: Math.round(gain * 100) / 100, searches: weak.length, people: people.length },
      },
    });
  }
  return out;
}

/** views.sharper (A1's part from the archive): a book that reads worse, and its portal gives sharper parts. */
function viewsSharper(c: Ctx): Draft[] {
  const out: Draft[] = [];
  for (const b of c.report.books) {
    if (!(b.signals.includes("M5") || b.signals.includes("M6")) || b.signals.includes("M7")) continue;
    const at = hostOfBook(c, b.id);
    if (!at) continue;
    // the portal gives sharper parts of this book: one fetched before shows it
    const parts = sharperCopies(c.media, b.id).filter((x) => x.m.part && x.m.fetched?.connector);
    if (!parts.length) continue;
    const covered = new Set(sharperCopies(c.media, b.id).map((x) => x.m.image));
    const candidates = Math.max(0, b.unsure - covered.size);
    if (!candidates) continue;
    const n = Math.ceil(candidates * perPart(c, at.host));
    const requests = [{ host: at.host, n, minutes: minutesFor(c, at.host, at.connector, n) }];
    const day = dayRequests(c, at.host);
    const tooMany = n > ASK.sharperShare * day;
    const gain = Math.max(...parts.map((x) => x.gain));
    const yes: Choice = { id: "yes", label: c.t("ui.tune.q.c.sharper", { n: candidates }) + ` — ${requestsText(c, requests)}`, effect: "none", requests };
    const no: Choice = { id: "no", label: c.t("ui.tune.q.c.no"), effect: "none" };
    const title = b.title ?? c.tree.get<RecordSet>(b.id)?.title ?? b.id;
    const metric = b.signals.includes("M5") ? "M5" : "M6";
    const sig = c.report.signals.find((s) => s.metric === metric && s.scope === `book:${b.id}`);
    out.push({
      kind: "views.sharper",
      scope: `book:${b.id}`,
      recordset: b.id,
      host: at.host,
      text: c.t("ui.tune.q.sharper", { book: b.id, title }),
      why: c.t(tooMany ? "ui.tune.q.sharper.why.many" : "ui.tune.q.sharper.why", {
        value: c.pct(metric === "M5" ? b.illegible : b.enlarged),
        base: c.pct(metric === "M5" ? b.base : b.enlargedBase),
        gain: c.nf(gain),
        n,
        day,
        host: at.host,
      }),
      choices: [...(tooMany ? [no, yes] : [yes, no]), { id: "later", label: c.t("ui.tune.q.c.later"), effect: "none" }],
      recommended: tooMany ? "no" : "yes",
      basis: {
        metric,
        value: sig?.value ?? 0,
        samples: metric === "M5" ? b.read : b.views,
        ...(sig?.ratio !== undefined && Number.isFinite(sig.ratio) ? { ratio: Math.round(sig.ratio * 100) / 100 } : {}),
        material: parts.map((x) => x.m.id).sort(),
        rev: QUESTION_REV["views.sharper"],
        extra: { candidates, requests: n, day },
      },
    });
  }
  return out;
}

/** index.first (D3): books browsed page by page where an index of the place is known — from how many scans the index first? */
function indexFirst(c: Ctx): Draft[] {
  const sets = c.tree.list<RecordSet>("recordset").filter((r) => !r.retracted);
  const indexes = sets.filter((r) => r.kinds.includes("index"));
  if (!indexes.length) return [];
  const browsed = c.tree.list<Search>("search").filter((s) => !s.retracted && s.method === "page-by-page");
  const books: { b: BookSummary; indexes: string[] }[] = [];
  for (const b of c.report.books) {
    if (b.scans < ASK.indexScans) continue;
    const set = sets.find((r) => r.id === b.id);
    if (!set || !browsed.some((s) => s.recordsets.includes(b.id))) continue;
    // its own index (a book that has one), or an index of a place it covers
    const of = indexes.filter((r) => r.id === set.id || r.places.some((p) => set.places.includes(p))).map((r) => r.id);
    if (of.length) books.push({ b, indexes: of });
  }
  if (books.length < ASK.indexBooks) return [];
  const scans = books.reduce((n, x) => n + x.b.scans, 0);
  return [
    {
      kind: "index.first",
      scope: "research",
      text: c.t("ui.tune.q.index", { n: books.length }),
      why: c.t("ui.tune.q.index.why", { n: books.length, scans, books: books.map((x) => x.b.id).join(", "), indexes: [...new Set(books.flatMap((x) => x.indexes))].join(", ") }),
      choices: [
        { id: "30", label: c.t("ui.tune.q.c.from", { n: 30 }), effect: "none" },
        { id: "20", label: c.t("ui.tune.q.c.from", { n: 20 }), effect: "none" },
        { id: "40", label: c.t("ui.tune.q.c.from", { n: 40 }), effect: "none" },
        { id: "never", label: c.t("ui.tune.q.c.never.index"), effect: "none" },
      ],
      recommended: "30",
      basis: { metric: "browsedBooks", value: books.length, samples: scans, material: [...new Set(books.flatMap((x) => x.indexes))].sort(), rev: QUESTION_REV["index.first"] },
    },
  ];
}

/** The readings of a key: how many, how many unsure. */
function readingsOf(units: Unit[], key: string): { read: number; unsure: number } {
  let read = 0;
  let unsure = 0;
  for (const u of units) {
    if (u.key !== key) continue;
    for (const b of Object.values(u.books)) {
      read += b.read;
      unsure += b.unsure;
    }
  }
  return { read, unsure };
}

/**
 * vision.best (D5): handwriting read by another model than the research's (the person chose it) and less surely —
 * read by the research's model again? Never the other way: nothing suggests a cheaper model.
 */
function visionBest(c: Ctx, all: Unit[]): Draft[] {
  const m = c.settings.models(c.agent, c.tree.config);
  const vision = m.vision;
  const lead = m.lead ?? PROFILES[c.agent]?.models.vision;
  if (!vision || !lead || vision === lead) return [];
  const vk = calibrationKey(c.agent, vision);
  const lk = calibrationKey(c.agent, lead);
  if (vk === lk) return [];
  const from = c.now - WINDOW_DAYS * DAY;
  const v = readingsOf(all.filter((u) => Date.parse(u.at) >= from), vk);
  const l = readingsOf(all, lk);
  if (v.read < THRESHOLDS.M5.read || l.read < THRESHOLDS.M5.read) return [];
  const wv = wilson(v.unsure, v.read);
  const wl = wilson(l.unsure, l.read);
  const ratio = wl.p > 0 ? wv.p / wl.p : wv.p > 0 ? Infinity : 1;
  if (!(ratio >= ASK.visionRatio && wv.lo > wl.hi)) return [];
  return [
    {
      kind: "vision.best",
      scope: "key",
      text: c.t("ui.tune.q.vision", { vision, lead }),
      why: c.t("ui.tune.q.vision.why", { vision, lead, pv: c.pct(wv.p), nv: v.read, pl: c.pct(wl.p), nl: l.read }),
      choices: [
        { id: "lead", label: c.t("ui.tune.q.c.lead", { lead }), effect: "setting" },
        { id: "keep", label: c.t("ui.tune.q.c.keep.model", { vision }), effect: "none" },
      ],
      recommended: "lead",
      basis: { metric: "M5", value: Math.round(wv.p * 1000) / 1000, samples: v.read, ...(Number.isFinite(ratio) ? { ratio: Math.round(ratio * 100) / 100 } : {}), rev: QUESTION_REV["vision.best"], extra: { lead, vision, leadRead: l.read } },
    },
  ];
}

/** What P4's tuning changed (.strom/tune/log.jsonl), as far as it can be read: the changes not returned since. */
export function tuneChanges(root: string): { at: string; id: string; key: string; scope: string; what: string }[] {
  const log = readJournal(path.join(tuneDir(root), "log.jsonl"));
  const out = new Map<string, { at: string; id: string; key: string; scope: string; what: string }>();
  for (const e of log.sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const at = typeof e.at === "string" && Number.isFinite(Date.parse(e.at)) ? e.at : undefined;
    if (!at) continue;
    if (e.by === "reset") {
      // what a reset returned: its items, by ID or scope (else everything of its key)
      const items = Array.isArray(e.items) ? (e.items as Record<string, unknown>[]) : [];
      for (const [k, v] of out) if (!items.length ? !e.key || e.key === v.key : items.some((i) => i.id === v.id || (i.scope === v.scope && (!i.key || i.key === v.key)))) out.delete(k);
      continue;
    }
    const key = typeof e.key === "string" ? e.key : undefined;
    const scope = typeof e.scope === "string" ? e.scope : "key";
    if (!key) continue;
    const id = typeof e.id === "string" ? e.id : `${scope}@${at}`;
    const what = typeof e.what === "string" ? e.what : id;
    out.set(`${key}\n${scope}`, { at, id, key, scope, what });
  }
  return [...out.values()];
}

/** reset.after (8.4): the reading after a change of the tuning clearly worse than before it — return the change? */
function resetAfter(c: Ctx, all: Unit[]): Draft[] {
  const out: Draft[] = [];
  for (const ch of tuneChanges(c.tree.root)) {
    if (ch.key !== c.key || ch.scope.startsWith("host:")) continue;
    const book = ch.scope.startsWith("book:") ? ch.scope.slice(5) : undefined;
    const at = Date.parse(ch.at);
    const mine = all.filter((u) => u.key === c.key).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const counts = (u: Unit) => {
      const bs = book ? (u.books[book] ? [u.books[book]!] : []) : Object.values(u.books);
      return { scans: bs.reduce((n, b) => n + b.scans, 0), read: bs.reduce((n, b) => n + b.read, 0), unsure: bs.reduce((n, b) => n + b.unsure, 0) };
    };
    const after = mine.filter((u) => Date.parse(u.at) >= at && counts(u).scans > 0);
    const before: Unit[] = [];
    let total = 0;
    for (const u of mine.filter((u) => Date.parse(u.at) < at && counts(u).scans > 0).reverse()) {
      if (total >= ASK.reset.beforeScans) break;
      before.push(u);
      total += counts(u).scans;
    }
    const need = book ? ASK.reset.after.book : ASK.reset.after.key;
    const sum = (us: Unit[]) => us.reduce((s, u) => ({ scans: s.scans + counts(u).scans, read: s.read + counts(u).read, unsure: s.unsure + counts(u).unsure }), { scans: 0, read: 0, unsure: 0 });
    const a = sum(after);
    const b = sum(before);
    if (a.scans < need.scans || after.length < need.units || !b.scans) continue;
    // (a) accuracy: unsure readings, readers without a result — clearly worse
    const worse = (k1: number, n1: number, k0: number, n0: number) => {
      if (!n1 || !n0) return undefined;
      const w1 = wilson(k1, n1);
      const w0 = wilson(k0, n0);
      return w1.p >= ASK.reset.worse * w0.p && w1.lo > w0.hi && w1.p > 0 ? { before: w0.p, after: w1.p, ratio: w0.p > 0 ? w1.p / w0.p : Infinity } : undefined;
    };
    // the readers that read (never one a login, a plan's limit or a failure stopped)
    const readers = (us: Unit[]) => us.filter(isReading);
    const m5 = worse(a.unsure, a.read, b.unsure, b.read);
    const m10 = book ? undefined : worse(readers(after).filter((u) => u.noResult).length, readers(after).length, readers(before).filter((u) => u.noResult).length, readers(before).length);
    // (b) cost: per scan clearly more, the readings no surer
    const cost = (us: Unit[]) => {
      const priced = us.filter((u) => u.usd !== undefined);
      const s = priced.reduce((n, u) => n + counts(u).scans, 0);
      if (s) return priced.reduce((n, u) => n + u.usd! * (book ? counts(u).scans / Math.max(1, Object.values(u.books).reduce((m, x) => m + x.scans, 0)) : 1), 0) / s;
      const tok = us.filter((u) => u.tokens);
      const t = tok.reduce((n, u) => n + counts(u).scans, 0);
      return t ? tok.reduce((n, u) => n + u.tokens!.new, 0) / t : undefined;
    };
    const c0 = cost(before);
    const c1 = cost(after);
    const improved = b.read && a.read ? wilson(b.unsure, b.read).lo - wilson(a.unsure, a.read).hi > 0 : false;
    const costlier = c0 && c1 && c1 >= ASK.reset.costlier * c0 && !improved ? { before: c0, after: c1, ratio: c1 / c0 } : undefined;
    const hit = m5 ? { metric: "M5", ...m5 } : m10 ? { metric: "M10", ...m10 } : costlier ? { metric: "M1", ...costlier } : undefined;
    if (!hit) continue;
    const command = `strom media calibrate --reset${book ? ` --recordset ${book}` : ""}`;
    const accuracy = hit.metric !== "M1";
    const reset: Choice = { id: "reset", label: c.t("ui.tune.q.c.reset", { command }), effect: "command" };
    const keep: Choice = { id: "keep", label: c.t("ui.tune.q.c.keep"), effect: "none" };
    const shown = (v: number) => (hit.metric === "M1" ? c.nf(v, v < 1 ? 3 : 0) : c.pct(v));
    out.push({
      kind: "reset.after",
      scope: book ? `book:${book}` : "key",
      ...(book ? { recordset: book } : {}),
      text: c.t("ui.tune.q.reset", { scope: book ?? c.t("ui.tune.q.scope.key"), what: ch.what, at: ch.at.slice(0, 10) }),
      why: c.t(`ui.tune.q.reset.why.${hit.metric}` as UIKey, { before: shown(hit.before), after: shown(hit.after), nb: b.scans, na: a.scans }),
      choices: accuracy ? [reset, keep] : [keep, reset],
      recommended: accuracy ? "reset" : "keep",
      basis: {
        metric: hit.metric,
        value: Math.round(hit.after * 1000) / 1000,
        samples: a.scans,
        ...(Number.isFinite(hit.ratio) ? { ratio: Math.round(hit.ratio * 100) / 100 } : {}),
        material: [ch.id],
        rev: QUESTION_REV["reset.after"],
        extra: { before: Math.round(hit.before * 1000) / 1000, beforeScans: b.scans },
      },
    });
  }
  return out;
}

// ── all of them ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface QuestionsOptions {
  /** Make the summary again from the journals (the command); else the one kept (the menu, the orientation). */
  refresh?: boolean;
  /** Keep when each was first asked and which answered ones lost their ground (the command does; a look does not). */
  write?: boolean;
  /** The units of the other researches on this computer (the usual of the books when this one has too few). */
  others?: Unit[];
  now?: number;
}

export interface QuestionSet {
  key: string;
  label: { agent: string; model?: string; reported?: string };
  /** Every question the data raise now: asked (due) or answered before (not due). */
  all: Question[];
  due: Question[];
}

/** The questions of the research's agent and model now. Nothing in an archive (nobody reads there). */
export function tuneQuestions(tree: Tree, settings: Settings, o: QuestionsOptions = {}): QuestionSet {
  const agent = settings.agent(tree.config).value;
  const model = viewModel(settings, agent, tree.config);
  const key = calibrationKey(agent, model);
  const none: QuestionSet = { key, label: { agent, ...(model ? { model } : {}) }, all: [], due: [] };
  if (isArchive(tree)) return none;
  const now = o.now ?? Date.now();
  const rollup = o.refresh ? refreshRollup(tree, { settings, now }) : loadRollup(tree.root);
  const units = rollup?.units ?? [];
  const group = groups(units, now).find((g) => g.key === key);
  if (!group) return none;
  const titles = new Map(tree.list<RecordSet>("recordset").map((b) => [b.id, b.title]));
  const report = summarize(group, { ...(o.others ? { others: o.others } : {}), title: (id) => titles.get(id), defaults: READING_DEFAULTS });
  // an agent or model that read no scans here: nothing to ask
  if (!report.samples.scans) return { ...none, label: { ...none.label, ...(group.reported ? { reported: group.reported } : {}) } };
  const lang = tree.lang;
  const nf = (n: number, digits = 1) => new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(n);
  const shared = settings.shared()?.value;
  let connectors: Connector[] = [];
  try {
    connectors = listConnectors(shared);
  } catch {
    // no plugins folder
  }
  const c: Ctx = {
    tree,
    settings,
    t: (k, v = {}) => ui(lang, k, v),
    nf,
    pct: (n) => (n === undefined ? "–" : `${nf(Math.round(n * 100), 0)} %`),
    key,
    agent,
    ...(group.reported ? { reported: group.reported } : {}),
    report,
    units: group.units,
    now,
    ...(shared ? { shared } : {}),
    media: tree.list<Media>("media").filter((m) => !m.retracted),
    fetches: readJournal(path.join(metricsDir(tree.root), "fetch.jsonl")),
    connectors,
  };
  const drafts = [...viewsSmaller(c), ...negativesWeak(c), ...viewsSharper(c), ...indexFirst(c), ...visionBest(c, units), ...resetAfter(c, units)];

  const stored = storedAnswers(tree.root, settings.config, key);
  let asked: { asked?: Record<string, string>; gone?: Record<string, string> } = {};
  try {
    asked = readJsonIfExists<typeof asked>(askedFile(tree.root)) ?? {};
  } catch {
    // written over: asked again from today
  }
  const today = new Date(now).toISOString().slice(0, 10);
  const nowIso = new Date(now).toISOString();
  let changed = false;
  const all: Question[] = drafts.map((d) => {
    const id = questionId(d.kind, key, d.scope);
    const basis: Basis = { ...d.basis, ...(group.reported ? { reported: group.reported } : {}) };
    const answer = keptInConfig(d.kind, d.scope) ? stored.config[d.kind] : stored.research[slot(d.kind, d.scope)];
    const gone = asked.gone?.[`${key}\n${d.kind}:${d.scope}`];
    const due = !answer || dueAgain({ basis }, answer, now, gone);
    // asked since: the first time it was due (again after an answer)
    let since = asked.asked?.[id];
    if (due && (!since || (answer && since < answer.at.slice(0, 10)))) {
      since = today;
      (asked.asked ??= {})[id] = today;
      changed = true;
    }
    const [agentId = agent, ...rest] = key.split(" ");
    return {
      id,
      kind: d.kind,
      key: { agent: agentId, model: rest.join(" ") || null, reported: group.reported ?? null, recordset: d.recordset ?? null, host: d.host ?? null },
      scope: d.scope,
      text: d.text,
      choices: d.choices,
      recommended: d.recommended,
      why: d.why,
      basis,
      fingerprint: fingerprintOf(basis),
      answer: `strom media calibrate --answer ${id}=${d.recommended}`,
      asked: since ?? today,
      due,
      ...(answer ? { answered: { choice: answer.choice, at: answer.at, by: answer.by } } : {}),
    };
  });
  // the answered ones whose ground is gone now: kept, so that its coming back asks again (condition 3)
  const raised = new Set(drafts.map((d) => `${d.kind}:${d.scope}`));
  const answered: [QuestionKind, string][] = [
    ...Object.keys(stored.config).filter((k): k is QuestionKind => (QUESTION_KINDS as readonly string[]).includes(k)).map((k) => [k, "key"] as [QuestionKind, string]),
    ...Object.keys(stored.research).map((s): [QuestionKind, string] | undefined => {
      const [kind, sub] = s.split(":") as [QuestionKind, string | undefined];
      if (!(QUESTION_KINDS as readonly string[]).includes(kind)) return undefined;
      return [kind, sub === undefined ? (kind === "index.first" ? "research" : "key") : kind === "views.sharper" || kind === "negatives.weak" || kind === "reset.after" ? `book:${sub}` : `host:${sub}`];
    }).filter((x): x is [QuestionKind, string] => !!x),
  ];
  for (const [kind, scope] of answered) {
    const k = `${key}\n${kind}:${scope}`;
    if (raised.has(`${kind}:${scope}`) || asked.gone?.[k]) continue;
    (asked.gone ??= {})[k] = nowIso;
    changed = true;
  }
  if (changed && o.write) {
    try {
      fs.mkdirSync(tuneDir(tree.root), { recursive: true });
      writeFileAtomic(askedFile(tree.root), JSON.stringify(asked, null, 2) + "\n");
    } catch {
      // asked again from today next time
    }
  }
  return { ...none, label: { ...none.label, ...(group.reported ? { reported: group.reported } : {}) }, all, due: all.filter((q) => q.due) };
}

/** How many questions wait for a person — what the menu and the orientation say (the summary kept; nothing written). */
export function questionsWaiting(tree: Tree, settings: Settings, others?: Unit[]): number {
  try {
    return tuneQuestions(tree, settings, { ...(others ? { others } : {}) }).due.length;
  } catch {
    return 0;
  }
}

/**
 * Keep a person's answer: of the key in the user config (as it is now: another strom may have saved meanwhile), of a
 * book, an archive or the research beside it. A "gone" mark of the same question is cleared (its ground is back).
 */
export function keepAnswer(tree: Tree, settings: Settings, key: string, q: Question, choice: string, by: TuneAnswer["by"], now = Date.now()): TuneAnswer {
  const answer: TuneAnswer = { choice, at: new Date(now).toISOString(), fingerprint: q.fingerprint, by, strom: VERSION, basis: q.basis };
  if (keptInConfig(q.kind, q.scope)) {
    settings.reload();
    const all = settings.config.tuneAnswers ?? {};
    settings.config.tuneAnswers = { ...all, [key]: { ...(all[key] ?? {}), [q.kind]: answer } };
    settings.save();
  } else {
    fs.mkdirSync(tuneDir(tree.root), { recursive: true });
    let all: Answers = {};
    try {
      all = readJsonIfExists<Answers>(answersFile(tree.root)) ?? {};
    } catch {
      // written over: this answer starts it again
    }
    all[key] = { ...(all[key] ?? {}), [slot(q.kind, q.scope)]: answer };
    writeFileAtomic(answersFile(tree.root), JSON.stringify(all, null, 2) + "\n");
  }
  try {
    const asked = readJsonIfExists<{ asked?: Record<string, string>; gone?: Record<string, string> }>(askedFile(tree.root));
    const k = `${key}\n${q.kind}:${q.scope}`;
    if (asked?.gone?.[k]) {
      delete asked.gone[k];
      writeFileAtomic(askedFile(tree.root), JSON.stringify(asked, null, 2) + "\n");
    }
  } catch {
    // nothing kept of it
  }
  return answer;
}

/** The tasks an answer "edge" of negatives.weak adds: one per person on the tree's edge or in a direction at work. */
export function weakNegativeTasks(tree: Tree, q: Question): { person: Person; task: Task; fields: Omit<Task, "id" | "type" | "created" | "updated" | "notes"> & { note?: string } }[] {
  const rs = q.key.recordset;
  if (!rs) return [];
  const copies = sharperCopies(tree.list<Media>("media").filter((m) => !m.retracted), rs);
  const searches = tree.list<Search>("search").filter((s) => {
    if (s.retracted || s.result !== "negative" || !s.recordsets.includes(rs)) return false;
    const pages = numbers(s.scope.pages);
    return copies.some((x) => x.m.created > s.created && (!pages || (x.m.image !== undefined && pages.has(x.m.image))));
  });
  const lang = tree.lang;
  const book = tree.get<RecordSet>(rs);
  return peopleToSearch(tree, searches).map(({ person, task }) => {
    const mine = searches.filter((s) => s.task === task.id);
    const pages = mine.map((s) => s.scope.pages).filter(Boolean).join(", ");
    return {
      person,
      task,
      fields: {
        level: (["link", "verify", "enrich", "locate"].includes(task.level) ? task.level : "verify") as Task["level"],
        priority: task.priority,
        what: short(phrase(lang, "tune.negatives.what", { name: name(person), book: book?.title ?? rs }), 200),
        where: [rs],
        why: phrase(lang, "tune.negatives.why", { searches: mine.map((s) => s.id).join(", "), gain: q.basis.extra?.gain ?? "" }),
        doneWhen: phrase(lang, "tune.negatives.done", { pages: pages || phrase(lang, "whole.book") }),
        subject: [person.id],
        ...(task.research ? { research: task.research } : {}),
        state: "open",
        origin: TUNE_NEGATIVES_ORIGIN,
      },
    };
  });
}
