// strom media calibrate — the size of scan views tuned for the research's agent and model, on the research's own
// known records: a person starts it (paid model work: the cost said first, their yes in the terminal or a window of the
// system), the readers read a sample at a few sizes, and the cheapest sizes that read as well as the largest are kept
// in the user config for that agent and model (core/viewsizes.ts) — only on a clear result; else the defaults stay.

import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, truncate } from "../cli/format.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { StromError, UsageError } from "../core/errors.ts";
import { which } from "../core/which.ts";
import { isArchive, refuseInArchive } from "../core/mode.ts";
import { RUNNERS } from "../runners/index.ts";
import { batches, BATCH, READER_MINUTES_HELP } from "../core/reader.ts";
import { cropOf, halves, makeView, readInHalves } from "../core/views.ts";
import {
  calibrationPrompt,
  decide,
  DEFAULT_SIZES,
  estimateUsd,
  parseCalibration,
  pickSample,
  SAMPLE_MIN,
  scoreFind,
  scoreRead,
  type CalAnswer,
  type CalCase,
  type CalJob,
  type CalNegative,
  type SizeScore,
} from "../core/viewsample.ts";
import { calibrationKey, calibrationLabel, defaultViewSizes, viewModel, type ViewCalibration } from "../core/viewsizes.ts";
import { bookId, hostName, RESET_PARTS, type ResetPart } from "../core/tunereset.ts";
import { resetReading, type ResetRequest } from "../cli/tunereset.ts";
import { BOOKS_SHOWN, groups, otherUnits, READING_DEFAULTS, refreshRollup, summarize, UNKNOWN_KEY, type BookSummary, type TunedItem } from "../core/readstats.ts";
import { selfTune, tunedFor, tunedSaid, tuningOn, withTuning } from "../core/tune.ts";
import { keepAnswer, tuneQuestions, weakNegativeTasks, type Question, type TuneAnswer } from "../core/tuneask.ts";
import { writeStored } from "../core/config.ts";
import { create } from "../core/records.ts";
import { assertIntact } from "../core/integrity.ts";
import { isAgent } from "../core/which.ts";
import { PROFILES } from "../agents/profiles.ts";
import { autoCommit } from "../cli/commit.ts";
import type { CommandDef } from "../cli/registry.ts";
import type { RecordSet, Task } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import { pool } from "./read.ts";
import { readers } from "./readers.ts";

type Item = { id: string; target: string; file: string; mediaId: string; width: number; height: number };

/** The long side of an image of W×H shown at most `max` px — no bigger than it is. */
function shown(W: number, H: number, max: number): number {
  const s = Math.min(1, max / Math.max(W, H));
  return Math.round(W * s) * Math.round(H * s);
}

/** What a reader opens for one case at a size: find — the whole image; read — its halves where a spread reads sharper so, else the whole. */
function viewsOf(kind: "find" | "read", it: Item, size: number): { label?: string; crop?: string; px: number }[] {
  if (kind === "read" && readInHalves(it.width, it.height, size)) {
    const { left, right } = halves(it.width, it.height);
    return [
      { label: "left half", crop: cropOf(left), px: shown(left.w, left.h, size) },
      { label: "right half", crop: cropOf(right), px: shown(right.w, right.h, size) },
    ];
  }
  return [{ px: shown(it.width, it.height, size) }];
}

interface Planned {
  kind: "find" | "read";
  size: number;
  items: Item[];
  views: number[];
}

/** The readers of a calibration: per size, the entries to find (and the images without them, apart), the entries to read. */
function plan(cases: CalCase[], negatives: CalNegative[], sizes: number[]): Planned[] {
  const item = (c: CalCase | CalNegative): Item => ({ id: c.id, target: c.target, file: c.file, mediaId: c.media.id, width: c.width, height: c.height });
  const out: Planned[] = [];
  for (const size of sizes)
    for (const [kind, list] of [
      ["find", cases.map(item)],
      ["find", negatives.map(item)],
      ["read", cases.map(item)],
    ] as const) {
      if (!list.length) continue;
      for (const group of batches(list, BATCH, (it) => viewsOf(kind, it, size).length))
        out.push({ kind, size, items: group, views: group.flatMap((it) => viewsOf(kind, it, size).map((v) => v.px)) });
    }
  return out;
}

function sizesOption(raw: unknown, max: number): number[] {
  const asked = typeof raw === "string" ? raw.split(/[,\s]+/).filter(Boolean).map(Number) : DEFAULT_SIZES;
  if (asked.some((n) => !Number.isInteger(n) || n < 600 || n > 6000)) throw new UsageError(`invalid --sizes "${String(raw)}"`, { hint: "long sides in px, e.g. 1400,1568,2000" });
  const sizes = [...new Set(asked.filter((n) => n <= max))].sort((a, b) => a - b);
  if (sizes.length < 2) throw new UsageError(`at least two sizes up to ${max} px are compared (what the model takes in whole)`, { hint: `e.g. --sizes 1400,${max}` });
  return sizes;
}

/** The signals said one by one in the human report (all of them in --json). */
const SIGNALS_SHOWN = 20;

/** A number as a language writes it; a language Intl does not know: English. */
function numberIn(lang: string, n: number, o: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(lang, o).format(n);
  } catch {
    return new Intl.NumberFormat("en", o).format(n);
  }
}

/**
 * strom media calibrate --report: how the reading of scans went for this agent and model, from what strom recorded —
 * free, no agent, no network; the summary kept in .strom/metrics/rollup.json made again, and what only adds accuracy or
 * saves requests set by itself from it (core/tune.ts) — nothing else changed.
 */
function report(ctx: Context, tree: Tree, key: string, who: string): { text: string; data: unknown } {
  const lang = tree.lang;
  const t = (k: UIKey, values: Record<string, string | number> = {}) => ui(lang, k, values);
  // the summary made again, and what only adds accuracy or saves requests set by itself from it (core/tune.ts)
  const otherResearch = otherUnits(ctx.knownTrees().map((k) => k.root), tree.root);
  const rollup = selfTune(tree, { settings: ctx.settings, others: otherResearch }).rollup;
  const units = rollup?.units ?? [];
  const all = groups(units);
  const mine = all.filter((g) => g.key === key);
  const own = t("ui.settings.model.own");
  // what nothing said the agent and model of: said so, never under the agent and model of now
  const label = (g: { key: string; reported?: string }) => `${g.key === UNKNOWN_KEY ? t("ui.tune.unknownKey") : calibrationLabel(g.key, own)}${g.reported ? ` (${g.reported})` : ""}`;
  const others = all.filter((g) => g !== mine[0]).map((g) => ({ key: g.key, ...(g.reported ? { model: g.reported } : {}), units: g.units.length, scans: g.units.reduce((n, u) => n + Object.values(u.books).reduce((m, b) => m + b.scans, 0), 0) }));
  const othersLine = others.length ? t("ui.tune.others", { list: others.map((o) => `${label(o.model ? { key: o.key, reported: o.model } : { key: o.key })} (${o.scans})`).join(", ") }) : undefined;
  const group = mine[0];
  // what is in force for the key, measured or not: what strom set (each with its id, where it is kept) and the
  // person's own calibration of the sizes
  const cal = ctx.settings.config.viewSizes?.[key];
  const calibration = cal ? { find: cal.find, read: cal.read, at: cal.at, sample: cal.sample, source: "calibrated" as const } : undefined;
  const inForce = (tuned: TunedItem[]) => {
    const said = tunedSaid(tuned).map((x) => t(`ui.tune.rec.${x.action}` as UIKey, { scope: x.scope.replace(/^(book|host):/, ""), from: String(x.from), to: String(x.to) }));
    return {
      text: lines(said.length ? lines(t("ui.tune.tuned"), ...said) : tuningOn(ctx.settings) ? undefined : t("ui.tune.off"), cal ? t("ui.tune.calibrated", { find: cal.find, read: cal.read, at: cal.at, n: cal.sample }) : undefined) || undefined,
      // the way back, last (core/tunereset.ts)
      reset: said.length || cal ? t("ui.tune.reset.last") : undefined,
    };
  };
  if (!group) {
    const tuned = tunedFor(ctx.settings, tree, key);
    const f = inForce(tuned);
    return { text: lines(t("ui.tune.none", { agent: who }), f.text, othersLine, f.reset), data: { key, measured: false, tuned, ...(calibration ? { calibration } : {}), others, updated: rollup?.updated } };
  }
  const titles = new Map(tree.list<RecordSet>("recordset").map((b) => [b.id, b.title]));
  const r = withTuning(summarize(group, { others: otherResearch, title: (id) => titles.get(id), defaults: READING_DEFAULTS }), ctx.settings, tree);
  // what only a person decides (core/tuneask.ts): the summary is fresh already
  const asked = tuneQuestions(tree, ctx.settings, { others: otherResearch, write: true }).due;
  const data = { ...r, ...(calibration ? { calibration } : {}), questions: asked, others, updated: rollup?.updated, ...(rollup?.backfillLogs ? { backfillLogs: rollup.backfillLogs } : {}) };
  const f = inForce(r.tuned);
  if (!r.samples.scans) return { text: lines(t("ui.tune.noscans", { agent: label(group), sessions: r.samples.sessions }), f.text, othersLine, f.reset), data };

  // numbers as the research language writes them (1,4 · 0,158 $ in Czech; 1.4 · $0.158 in English)
  const nf = (n: number, digits = 1) => numberIn(lang, n, { maximumFractionDigits: digits });
  const pct = (n: number | undefined) => (n === undefined ? "–" : `${nf(Math.round(n * 100), 0)} %`);
  const money = (n: number | undefined) => {
    if (n === undefined) return "–";
    const digits = n < 1 ? 3 : 2;
    return numberIn(lang, n, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: digits, maximumFractionDigits: digits });
  };
  // a base of 0 (none of the other books) said as such, never "against 0 %"
  const hasBase = (b: number | undefined) => b !== undefined && b > 0;
  const scopeOf = (s: string) => s.replace(/^(book|host):/, "");
  const cost =
    r.cost.unit === "usd"
      ? t("ui.tune.cost.usd", { scan: money(r.cost.perScan), view: money(r.cost.perView), known: pct(r.cost.known) })
      : r.cost.unit === "tokens"
        ? t("ui.tune.cost.tokens", { new: nf(r.cost.tokens!.new, 0), out: nf(r.cost.tokens!.out, 0), cr: nf(r.cost.tokens!.cr, 0), known: pct(r.cost.known) })
        : t("ui.tune.cost.unknown");
  const context = !r.context.known
    ? t("ui.tune.context.unknown")
    : r.context.clears
      ? t("ui.tune.context", { clears: r.context.clears, with: r.context.withClears, of: r.context.withSeries, ctx: nf(r.context.ctxAtFirstClear ?? 0, 0), reopened: pct(r.context.reopened) })
      : t("ui.tune.context.none", { of: r.context.withSeries });
  // the books with a signal first, then the biggest — a few (all of them in --json)
  const shown: BookSummary[] = [...r.books.filter((b) => b.signals.length).sort((a, b) => b.signals.length - a.signals.length || b.scans - a.scans), ...r.books.filter((b) => !b.signals.length)].slice(0, BOOKS_SHOWN);
  const bookLines = shown.map((b) =>
    [
      t("ui.tune.book", { id: b.id, title: b.title ? truncate(b.title, 40) : "", scans: b.scans, vps: b.viewsPerScan === undefined ? "–" : nf(b.viewsPerScan) }),
      b.read ? t(hasBase(b.base) ? "ui.tune.book.unsure" : "ui.tune.book.unsure.nobase", { value: pct(b.illegible), n: b.read, base: pct(b.base) }) : undefined,
      b.marked ? t("ui.tune.book.marked", { n: b.marked, of: b.read }) : undefined,
      b.transcripts && b.doubtful ? t("ui.tune.book.doubtful", { n: b.doubtful, of: b.transcripts }) : undefined,
      b.views ? t("ui.tune.book.enlarged", { value: pct(b.enlarged) }) : undefined,
      b.noSharper ? t("ui.tune.book.nosharper", { n: b.noSharper }) : undefined,
      b.weakNegatives ? t("ui.tune.book.weak", { n: b.weakNegatives, of: b.negatives }) : undefined,
      b.requests ? t("ui.tune.book.requests", { n: b.requests }) : undefined,
      b.unread ? t("ui.tune.book.unread", { n: b.unread, of: b.fetched }) : undefined,
    ]
      .filter(Boolean)
      .join(" · "),
  );
  const hostLines = r.hosts.map((h) => t("ui.tune.host", { host: h.host, sessions: h.sessions, requests: h.requests, perSession: h.requestsPerSession === undefined ? "–" : nf(h.requestsPerSession), perImage: h.requestsPerImage === undefined ? "–" : nf(h.requestsPerImage), wait: h.waitMin, later: h.later }));
  const sigLines = r.signals.map((s) => {
    const scope = scopeOf(s.scope);
    const ratio = s.ratio === undefined || !Number.isFinite(s.ratio) ? "–" : nf(s.ratio);
    switch (s.metric) {
      case "M1":
        return t("ui.tune.sig.M1", { scope, value: money(s.value), ratio, base: money(s.base) });
      case "M2":
        return t("ui.tune.sig.M2", { scope, value: nf(s.value), ratio, base: s.base === undefined ? "–" : nf(s.base) });
      case "M3":
        return t("ui.tune.sig.M3", { n: s.n, of: s.of ?? 0 });
      case "M4":
        return t("ui.tune.sig.M4", { n: s.n, of: s.of ?? 0, ctx: nf(s.extra?.ctx ?? 0, 0) });
      case "M5":
        return t(hasBase(s.base) ? "ui.tune.sig.M5" : "ui.tune.sig.M5.nobase", { scope, value: pct(s.value), base: pct(s.base), n: s.n });
      case "M6":
        return t(hasBase(s.base) ? "ui.tune.sig.M6" : "ui.tune.sig.M6.nobase", { scope, value: pct(s.value), base: pct(s.base), n: s.n });
      case "M7":
        return t("ui.tune.sig.M7", { scope, n: s.n });
      case "M8":
        return t("ui.tune.sig.M8", { scope, n: s.value, of: s.n, wait: s.extra?.waitMin ?? 0, later: s.extra?.later ?? 0 });
      case "M9":
        return t("ui.tune.sig.M9", { scope, value: s.value, n: s.n });
      case "M10":
        return t("ui.tune.sig.M10", { n: s.n, of: s.of ?? 0 });
      case "M11":
        return t("ui.tune.sig.M11", { scope, value: pct(s.value), n: s.n, of: s.of ?? 0 });
    }
  });
  const recLines = r.recommend.map((x) => t(`ui.tune.rec.${x.id}` as UIKey, { scope: scopeOf(x.scope), from: x.from ?? 0, to: x.to ?? 0 }));
  const text = lines(
    t("ui.tune.title", { agent: label(group), days: r.window.days, since: r.since ?? "–" }),
    t("ui.tune.samples", { sessions: r.samples.sessions, readers: r.samples.readers, scans: r.samples.scans, views: r.samples.views }) + (r.samples.recovered ? ` · ${t("ui.tune.recovered", { n: r.samples.recovered })}` : ""),
    cost + (r.cost.unknownSessions ? ` · ${t("ui.tune.cost.unknownSessions", { n: r.cost.unknownSessions })}` : ""),
    t("ui.tune.views", { perScan: r.views.perScan === undefined ? "–" : nf(r.views.perScan), whole: pct(r.views.whole), half: pct(r.views.half), crop: pct(r.views.crop), split: pct(r.views.split), enlarged: pct(r.views.enlarged) }),
    context,
    r.readers.n ? t("ui.tune.readers", { bad: r.readers.noResult, n: r.readers.n }) : undefined,
    r.readers.halted ? t("ui.tune.readers.halted", { n: r.readers.halted }) : undefined,
    rollup?.backfillLogs && (rollup.backfillLogs.gone || rollup.backfillLogs.skipped) ? t("ui.tune.backfill.partial", { gone: rollup.backfillLogs.gone, skipped: rollup.backfillLogs.skipped }) : undefined,
    bookLines.length ? lines(t("ui.tune.books"), ...bookLines, r.books.length > shown.length ? t("ui.tune.more", { n: r.books.length - shown.length }) : undefined) : undefined,
    hostLines.length ? lines(t("ui.tune.hosts"), ...hostLines) : undefined,
    sigLines.length ? lines(t("ui.tune.signals"), ...sigLines.slice(0, SIGNALS_SHOWN), sigLines.length > SIGNALS_SHOWN ? t("ui.tune.more", { n: sigLines.length - SIGNALS_SHOWN }) : undefined) : t("ui.tune.signals.none"),
    r.short.length ? t("ui.tune.short", { list: r.short.map((m) => t(`ui.tune.m.${m}` as UIKey)).join(", ") }) : undefined,
    f.text,
    recLines.length ? lines(t("ui.tune.recommend"), ...recLines) : undefined,
    r.signals.some((s) => s.metric === "M8") ? t("ui.tune.cap") : undefined,
    asked.length ? t("ui.tune.q.waiting", { n: asked.length }) : undefined,
    othersLine,
    f.reset,
  );
  return { text, data };
}

/** One question as a person reads it: what, why, the choices (the recommended first) and how to answer it. */
function questionLines(lang: string, q: Question, k: number, withCommand = true): string {
  const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
  return lines(
    ` ${k}. ${q.text}`,
    `    ${q.why}`,
    ...q.choices.map((c) => `    ${c.id}: ${c.label}${c.id === q.recommended ? ` ${t("ui.tune.q.recommended")}` : ""}`),
    withCommand ? `    ${q.answer}` : undefined,
  );
}

/**
 * strom media calibrate --questions: what only a person decides about the reading of scans. At a person's terminal each
 * is asked in turn (Enter: the recommended, 0: back with nothing changed); else listed with the command that answers it
 * — an agent never answers, it tells the person.
 */
async function questions(ctx: Context, tree: Tree, who: string): Promise<{ text: string; data: unknown }> {
  const lang = tree.lang;
  const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
  const set = tuneQuestions(tree, ctx.settings, { refresh: true, write: true, others: otherUnits(ctx.knownTrees().map((k) => k.root), tree.root) });
  const held = set.all.filter((q) => !q.due);
  const data = { key: set.key, ...(set.label.reported ? { model: set.label.reported } : {}), questions: set.due, held };
  const heldLine = held.length ? t("ui.tune.q.held", { n: held.length }) : undefined;
  if (!set.due.length) return { text: lines(t("ui.tune.q.none", { agent: who }), heldLine), data };
  if (ctx.interactive && !isAgent(ctx.env)) {
    const said: string[] = [];
    for (const [i, q] of set.due.entries()) {
      ctx.io.stdout(`\n${i === 0 ? `${t("ui.tune.q.title", { agent: who })}\n` : ""}${questionLines(lang, q, i + 1, false)}\n`);
      const pick = await ctx.choose("", q.choices.map((c) => ({ label: `${c.label}${c.id === q.recommended ? ` ${t("ui.tune.q.recommended")}` : ""}` })), q.choices.findIndex((c) => c.id === q.recommended), { back: t("ui.browse.back") });
      // back: nothing changed, the questions after it wait too
      if (pick === undefined) break;
      said.push((await answerWith(ctx, tree, set.key, q, q.choices[pick]!.id, "terminal")).text);
    }
    return { text: lines(...said), data };
  }
  return {
    text: lines(t("ui.tune.q.title", { agent: who }), ...set.due.map((q, i) => questionLines(lang, q, i + 1)), heldLine, t("ui.tune.q.person")),
    data,
  };
}

/** strom media calibrate --answer <id>=<choice>: a person's answer — in their terminal, else in a window of the system. */
async function answer(ctx: Context, tree: Tree, raw: string): Promise<{ text: string; data: unknown; exitCode?: number }> {
  const m = /^\s*(Q[0-9a-f]{6})\s*=\s*([\p{L}\p{N}._-]+)\s*$/iu.exec(raw);
  if (!m) throw new UsageError(`invalid --answer "${raw}"`, { hint: "--answer <question>=<choice>, e.g. --answer Q1a2b3c=later — the questions: strom media calibrate --questions" });
  const id = `Q${m[1]!.slice(1).toLowerCase()}`;
  const set = tuneQuestions(tree, ctx.settings, { refresh: true, write: true, others: otherUnits(ctx.knownTrees().map((k) => k.root), tree.root) });
  const q = set.all.find((x) => x.id === id);
  if (!q) throw new UsageError(`no question ${id} about the reading of scans now`, { hint: "strom media calibrate --questions" });
  const choice = q.choices.find((c) => c.id.toLowerCase() === m[2]!.toLowerCase());
  if (!choice) throw new UsageError(`${id} has no choice "${m[2]}"`, { hint: `one of: ${q.choices.map((c) => c.id).join(", ")}` });
  // the person's decision: in their own terminal they gave it by running the command; from anywhere else a window asks
  const where = ctx.requireHuman(`Answer ${id} (${q.kind}) with "${choice.id}": ${choice.label}?`, `strom media calibrate --answer ${id}=${choice.id}`, "tune.answer", ui(tree.lang, "ui.tune.q.window", { text: q.text, label: choice.label }));
  return answerWith(ctx, tree, set.key, q, choice.id, where);
}

/** What an answer does — tasks, a setting, a command said — and the answer kept. */
async function answerWith(ctx: Context, tree: Tree, key: string, q: Question, choice: string, by: TuneAnswer["by"]): Promise<{ text: string; data: unknown; exitCode?: number }> {
  const lang = tree.lang;
  const t = (k: UIKey, values: Record<string, string | number> = {}) => ui(lang, k, values);
  const label = q.choices.find((c) => c.id === choice)!.label;
  const out: (string | undefined)[] = [];
  const data: Record<string, unknown> = { id: q.id, kind: q.kind, scope: q.scope, choice, by };
  let exitCode: number | undefined;
  if (q.kind === "negatives.weak" && choice === "edge") {
    // at once, at most one per person, with the priority of the task the search was of (O7)
    const planned = weakNegativeTasks(tree, q);
    if (planned.length) {
      assertIntact(tree);
      const made = tree.atomically(() => planned.map((p) => create<Task>(tree, "task", p.fields, (id) => `+${id} task "${truncate(p.fields.what, 60)}" (${q.kind} ${q.id})`)));
      const blocked = autoCommit(ctx, { path: ["media", "calibrate"] } as unknown as CommandDef);
      if (blocked) {
        out.push(blocked.message);
        exitCode = 1;
      }
      data.tasks = made.map((x) => x.id);
      out.push(t("ui.tune.q.kept.tasks", { tasks: made.map((x) => x.id).join(", ") }));
    } else out.push(t("ui.tune.q.kept.notasks"));
  }
  if (q.kind === "vision.best" && choice === "lead") {
    const lead = String(q.basis.extra?.lead ?? "");
    const agent = ctx.settings.agent(tree.config).value;
    if (ctx.settings.resolve("model.vision", tree.config, agent)?.source === "tree") out.push(t("ui.tune.q.kept.vision.tree", { model: lead }));
    else if (lead) {
      // the settings as they are now: the agent's own default again when the research's model is it
      ctx.settings.reload();
      writeStored(ctx.settings.config, "model.vision", agent, lead === PROFILES[agent]?.models.vision ? undefined : lead);
      ctx.settings.save();
      data.model = lead;
      out.push(t("ui.tune.q.kept.vision", { model: lead }));
    }
  }
  if (q.kind === "views.smaller" && choice === "calibrate") out.push(t("ui.tune.q.kept.calibrate"));
  if (q.kind === "reset.after" && choice === "reset") {
    // returning the tuning is the next part of strom: said with its command
    const command = `strom media calibrate --reset${q.key.recordset ? ` --recordset ${q.key.recordset}` : ""}`;
    data.command = command;
    out.push(t("ui.tune.q.kept.reset", { command }));
  }
  const kept = keepAnswer(tree, ctx.settings, key, q, choice, by);
  data.at = kept.at;
  return { text: lines(t("ui.tune.q.kept", { label }), ...out), data, ...(exitCode !== undefined ? { exitCode } : {}) };
}

/** --all, --only, --recordset, --host and --dry-run of a reset, checked. */
function resetOptions(opts: Record<string, unknown>): Omit<ResetRequest, "key" | "model"> {
  const only = typeof opts.only === "string" ? [...new Set(opts.only.split(/[,\s]+/u).filter(Boolean).map((p) => p.toLowerCase()))] : undefined;
  const bad = only?.filter((p) => !(RESET_PARTS as readonly string[]).includes(p)) ?? [];
  if (bad.length || (only && !only.length)) throw new UsageError(`invalid --only "${String(opts.only)}"`, { hint: `one or more of ${RESET_PARTS.join(",")}, e.g. --only sizes,batches` });
  const rs = typeof opts.recordset === "string" ? bookId(opts.recordset) : undefined;
  if (rs !== undefined && !/^B\d+$/u.test(rs)) throw new UsageError(`invalid --recordset "${String(opts.recordset)}"`, { hint: "a book's ID, e.g. --recordset B0003" });
  const host = typeof opts.host === "string" ? hostName(opts.host) : undefined;
  if (host !== undefined && !host) throw new UsageError("--host needs an archive's host", { hint: "e.g. --host archive.example" });
  return {
    ...(opts.all ? { all: true } : {}),
    ...(only ? { only: only as ResetPart[] } : {}),
    ...(rs ? { recordset: rs } : {}),
    ...(host ? { host } : {}),
    ...(opts["dry-run"] ? { dryRun: true } : {}),
  };
}

const usd = (n: number | undefined, lang: string) => (n === undefined ? ui(lang, "ui.views.cost.unknown") : `$${n.toFixed(2)}`);

register({
  path: ["media", "calibrate"],
  summary: "Tune the size of scan views for the research's agent and model on the research's own known records — started by a person (paid)",
  group: "setup",
  tree: true,
  description:
    "The agent's readers read a sample of this research's own known records — 5 to 8 images already on this computer of\n" +
    "sources a proven fact cites, with their words (a transcript or a quote), from as many books as there are — at a few\n" +
    "sizes (1400, 1568, 2000 px: those the model takes). Each is held against what the research knows: is the entry found\n" +
    "on a whole image, in its place (and not on a neighbouring image without it), and how much of it — names, dates,\n" +
    "house numbers — is read from a half or a page. The cheapest size that loses nothing against the largest is kept for\n" +
    "this agent and model (strom config get views.size), only on a clear result; else the defaults stay. strom media view\n" +
    "and strom read go by it. Paid model work (a few dollars): the cost is said first and only a person says yes — in their\n" +
    "terminal, or in a window of the system when an agent asks; nothing runs by itself. Too few known records: nothing\n" +
    "runs, it says how many more are needed. --estimate: the sample and the cost only.\n" +
    "--report is free: how the reading of scans went, from what strom recorded of the sessions, the\n" +
    "readers, the views and the fetches (.strom/metrics, summed up in rollup.json) — cost and views per scan, unsure\n" +
    "readings, enlarged views, context clears, readers without a result, per book and per archive the requests, the waits\n" +
    "for its limit and the images fetched and never read; what is clearly above the usual of the same agent and model and\n" +
    "what would be suggested. No agent, no network. What only adds accuracy or saves requests to an archive strom sets by\n" +
    "itself and says so, with its reason (tune.auto: on by default) — never a smaller view, a cheaper model or more requests.\n" +
    "--questions: what only a person decides about it — smaller views (only through the paid calibration), weak scans\n" +
    "searched again, sharper parts from an archive (with the requests it adds per host and the time at its pace), an\n" +
    "index first from how many scans, the research's model reading handwriting again, a change of the tuning returned.\n" +
    "Each with what is recommended and why, in numbers; asked again only when the data change. A person answers: at their\n" +
    "terminal one by one (Enter: the recommended, 0: back), or --answer <question>=<choice> — from an agent's session a\n" +
    "window of the system asks; nobody to ask: exit 4. An agent never answers: it tells the person. Nothing in an archive.\n" +
    "--reset returns the reading of scans to the defaults: the calibrated sizes, what strom set by itself and the answers to\n" +
    "its questions — listed first (what, scope, now → default, source, date, why), returned only on a person's yes (their\n" +
    "terminal, Enter says no; a window of the system when an agent asks); --dry-run and --json only list. The research\n" +
    "itself is never touched: tasks an answer added stay, the measurements stay. What was returned strom does not set again\n" +
    "by itself for 30 days or until new readings come. strom doctor says when the reading got worse after a change of strom's.",
  options: [
    { name: "model", type: "string", value: "<model>", description: "the model to tune for (default: the research's model, else the one it reads scans with)" },
    { name: "sizes", type: "string", value: "<px,px,…>", description: "the long sides compared (default 1400,1568,2000 — those the model takes)" },
    { name: "estimate", type: "boolean", description: "the sample and the estimated cost; nothing run" },
    {
      name: "reset",
      type: "boolean",
      description:
        "back to the defaults for this agent and model: the calibrated sizes, what strom set by itself (in the user config and this research) and the answers to its questions — listed first, returned on a person's yes",
    },
    { name: "all", type: "boolean", description: "with --reset: every agent and model of the user config and of this research (other researches keep their books' values: said, with the command)" },
    { name: "only", type: "string", value: "<parts>", description: "with --reset: only sizes, batches, fetch or answers (several separated by commas)" },
    { name: "recordset", type: "string", value: "<B…>", description: "with --reset: only what is set for this book" },
    { name: "host", type: "string", value: "<host>", description: "with --reset: only what is set for this archive" },
    { name: "dry-run", type: "boolean", description: "with --reset: only list what would be returned" },
    {
      name: "report",
      type: "boolean",
      description: "free: how the reading of scans went, from this research's own records (no agent, no network) — per book and archive, what is above the usual, what strom set by itself and what would be suggested",
    },
    {
      name: "questions",
      type: "boolean",
      description: "what only a person decides about the reading of scans, each with what is recommended and why (free; asked one by one at a person's terminal)",
    },
    { name: "answer", type: "string", value: "<question>=<choice>", description: "a person's answer to one, e.g. Q1a2b3c=later (from an agent's session: a window of the system asks the person)" },
    { name: "parallel", type: "string", value: "<n>", description: "readers at the same time (default 3)" },
    { name: "minutes", type: "string", value: "<n>", description: READER_MINUTES_HELP },
  ],
  examples: [
    "strom media calibrate --report",
    "strom media calibrate --questions",
    "strom media calibrate --estimate",
    "strom media calibrate",
    "strom media calibrate --reset --dry-run",
    "strom media calibrate --reset",
    "strom media calibrate --reset --only sizes --recordset B0003",
    "strom media calibrate --reset --only fetch --host archive.example",
    "strom media calibrate --reset --all",
  ],
  run: async (ctx: Context, { opts }) => {
    const tree = ctx.tree();
    const lang = tree.lang;
    const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
    // an archive: nobody reads scans there, nothing is asked about it (and nothing of an agent said)
    if (isArchive(tree) && (opts.questions || typeof opts.answer === "string")) return { text: t("ui.waiting.none"), data: { questions: [] } };
    refuseInArchive(tree, "strom media calibrate");
    const agent = ctx.settings.agent(tree.config).value;
    const model = viewModel(ctx.settings, agent, tree.config, typeof opts.model === "string" ? opts.model : undefined);
    const key = calibrationKey(agent, model);
    const who = calibrationLabel(key, t("ui.settings.model.own"));
    const defaults = defaultViewSizes(agent, model);

    if (opts.report) return report(ctx, tree, key, who);
    if (typeof opts.answer === "string") return answer(ctx, tree, opts.answer);
    if (opts.questions) return questions(ctx, tree, who);

    if (opts.reset) return resetReading(ctx, tree, { key, ...resetOptions(opts), ...(typeof opts.model === "string" ? { model: opts.model } : {}) });
    for (const o of ["all", "only", "recordset", "host", "dry-run"]) if (opts[o] !== undefined && opts[o] !== false) throw new UsageError(`--${o} goes with --reset`, { hint: "strom media calibrate --reset --dry-run" });

    const runner = RUNNERS[agent];
    if (!runner) throw new UsageError(`no reader for agent "${agent}"`, { hint: "strom agents use claude (or codex, opencode, grok, antigravity)" });
    if (agent !== "script" && !which(runner.command, ctx.env)) throw new StromError(`${runner.command} is not installed: its readers read the sample`, { hint: "strom doctor" });
    const shared = ctx.settings.shared()?.value;
    if (!shared) throw new UsageError("no shared folder with the images is set", { hint: "strom setup" });
    const sizes = sizesOption(opts.sizes, defaults.max);
    const { cases, negatives, eligible } = pickSample(tree, shared);
    const books = new Set(cases.map((c) => c.book)).size;
    if (cases.length < SAMPLE_MIN)
      return {
        text: t("ui.views.few", { have: eligible, need: SAMPLE_MIN, more: SAMPLE_MIN - eligible }),
        data: { ran: false, eligible, needed: SAMPLE_MIN, key, find: defaults.find, read: defaults.read },
      };

    const planned = plan(cases, negatives, sizes);
    const estimate = estimateUsd(planned.map((p) => ({ views: p.views, cases: p.items.length, kind: p.kind })));
    const sample = {
      key,
      sizes,
      readers: planned.length,
      estimateUsd: Math.round(estimate * 100) / 100,
      cases: cases.map((c) => ({ id: c.id, source: c.source, media: c.media.id, book: c.book, keys: c.keys.length, ...(c.band ? { band: c.band } : {}) })),
      negatives: negatives.map((n) => ({ id: n.id, of: n.of, media: n.media.id })),
    };
    const sizesSaid = sizes.join(" / ");
    const est = { agent: who, readers: planned.length, n: cases.length, sizes: sizesSaid, cost: `$${Math.max(0.5, Math.round(estimate * 2) / 2).toFixed(2)}` };
    if (opts.estimate) return { text: t("ui.views.estimate", { ...est, books }), data: { ran: false, ...sample } };

    // paid work: the person's yes — in their terminal (Enter says no), else a window of the system; nobody to ask: exit 4
    const says = t("ui.views.ask", est);
    const where = ctx.requireHuman(`Tune the reading of scans for ${key}: ${planned.length} paid readings, about ${est.cost}?`, `strom media calibrate${typeof opts.model === "string" ? ` --model ${opts.model}` : ""}`, "media.calibrate", says);
    if (where === "terminal" && !(await ctx.confirm(says, false))) return { text: t("ui.views.no"), data: { ran: false, ...sample } };

    const day = new Date().toISOString().slice(0, 10);
    const reportsDir = path.join(tree.root, ".strom", "calibrate", `${day}-${Date.now().toString(36)}`);
    const r0 = readers(ctx, tree, shared, "calibrate", "find", { ...opts, ...(model ? { model } : {}) }, reportsDir);
    const answers = new Map<string, CalAnswer[]>();
    const failed = new Map<string, number>();
    const cost = new Map<string, { usd: number; partial: boolean }>();
    const at = (p: Planned) => `${p.kind} ${p.size}`;
    let n = 0;
    await pool(planned, r0.parallel, async (p) => {
      const k = ++n;
      const jobs: CalJob[] = p.items.map((it) => ({
        id: it.id,
        target: it.target,
        views: viewsOf(p.kind, it, p.size).map((v) => ({ ...(v.label ? { label: v.label } : {}), view: makeView(tree, it.file, it.mediaId, { max: p.size, ...(v.crop ? { crop: v.crop } : {}) }, { reader: true }).file })),
      }));
      r0.progress(t("ui.views.progress", { what: t(p.kind === "find" ? "ui.views.what.find" : "ui.views.what.read"), size: p.size, n: p.items.length }));
      const r = await r0.read(`${p.kind}${p.size}-${k}`, jobs.flatMap((j) => j.views.map((v) => v.view)), `Calibration · ${p.kind} at ${p.size} px`, (report) => calibrationPrompt(p.kind, jobs, report));
      const ids = new Set(p.items.map((it) => it.id));
      answers.set(at(p), [...(answers.get(at(p)) ?? []), ...parseCalibration(r.text).filter((a) => ids.has(a.id))]);
      if (r.outcome !== "ok") failed.set(at(p), (failed.get(at(p)) ?? 0) + 1);
      const c = cost.get(at(p)) ?? { usd: 0, partial: false };
      cost.set(at(p), { usd: c.usd + (r.costUsd ?? 0), partial: c.partial || r.costUsd === undefined });
    });

    const scores: SizeScore[] = [];
    for (const size of sizes)
      for (const kind of ["find", "read"] as const) {
        const a = answers.get(`${kind} ${size}`) ?? [];
        const f = failed.get(`${kind} ${size}`) ?? 0;
        const s = kind === "find" ? scoreFind(size, cases, negatives, a, f) : scoreRead(size, cases, a, f);
        const c = cost.get(`${kind} ${size}`);
        scores.push({ ...s, ...(c && !c.partial ? { usd: Math.round(c.usd * 100) / 100 } : {}), partial: c?.partial ?? true });
      }
    const find = decide(scores.filter((s) => s.kind === "find"), defaults.find);
    const read = decide(scores.filter((s) => s.kind === "read"), defaults.read);
    const spent = r0.cost();
    let stored: ViewCalibration | undefined;
    if (find.clear || read.clear) {
      stored = { find: find.size, read: read.size, at: day, sample: cases.length, sizes, clear: { find: find.clear, read: read.clear }, ...(spent ? { usd: Math.round(spent * 100) / 100 } : {}) };
      // the settings as they are now (another strom may have saved meanwhile): this agent and model's alone
      ctx.settings.reload();
      ctx.settings.config.viewSizes = { ...(ctx.settings.config.viewSizes ?? {}), [key]: stored };
      ctx.settings.save();
    }

    const rows = (kind: "find" | "read") =>
      scores
        .filter((s) => s.kind === kind)
        .map((s) =>
          kind === "find"
            ? t("ui.views.find.row", { size: s.size, located: s.located, n: s.cases - s.negatives, wrong: s.falseFinds, neg: s.negatives, cost: usd(s.usd, lang) })
            : t("ui.views.read.row", { size: s.size, keys: s.keys, total: s.keysTotal, unsure: s.unsure, cost: usd(s.usd, lang) }),
        );
    const failedAll = [...failed.values()].reduce((a, b) => a + b, 0);
    const text = lines(
      t("ui.views.title", { agent: who, n: cases.length, books, sizes: sizesSaid }),
      t("ui.views.find"),
      ...rows("find"),
      t("ui.views.read"),
      ...rows("read"),
      t("ui.views.rule"),
      failedAll ? t("ui.views.failed", { failed: failedAll }) : undefined,
      stored && !find.clear ? t("ui.views.unclear.find", { size: find.size }) : undefined,
      stored && !read.clear ? t("ui.views.unclear.read", { size: read.size }) : undefined,
      stored ? t("ui.views.stored", { agent: who, date: day, find: stored.find, read: stored.read }) : failedAll ? undefined : t("ui.views.kept"),
      spent ? t("ui.views.spent", { cost: `${usd(spent, lang)}${r0.partial() ? "+" : ""}` }) : undefined,
    );
    return {
      text,
      data: {
        ran: true,
        ...sample,
        scores,
        decision: { find, read },
        ...(stored ? { stored } : {}),
        costUsd: spent || undefined,
        reports: ctx.display(reportsDir),
        failed: r0.failed,
      },
      exitCode: stored ? 0 : 1,
    };
  },
});
