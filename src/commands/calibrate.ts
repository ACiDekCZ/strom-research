// strom media calibrate — the size of scan views tuned for the research's agent and model, on the research's own
// known records: a person starts it (paid model work: the cost said first, their yes in the terminal or a window of the
// system), the readers read a sample at a few sizes, and the cheapest sizes that read as well as the largest are kept
// in the user config for that agent and model (core/viewsizes.ts) — only on a clear result; else the defaults stay.

import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines } from "../cli/format.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import { StromError, UsageError } from "../core/errors.ts";
import { which } from "../core/which.ts";
import { refuseInArchive } from "../core/mode.ts";
import { RUNNERS } from "../runners/index.ts";
import { batches, BATCH } from "../core/reader.ts";
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
import { calibrationKey, calibrationLabel, defaultViewSizes, forgetCalibration, viewModel, type ViewCalibration } from "../core/viewsizes.ts";
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
    "runs, it says how many more are needed. --estimate: the sample and the cost only.",
  options: [
    { name: "model", type: "string", value: "<model>", description: "the model to tune for (default: the research's model, else the one it reads scans with)" },
    { name: "sizes", type: "string", value: "<px,px,…>", description: "the long sides compared (default 1400,1568,2000 — those the model takes)" },
    { name: "estimate", type: "boolean", description: "the sample and the estimated cost; nothing run" },
    { name: "reset", type: "boolean", description: "forget the tuning of this agent and model: the default sizes again" },
    { name: "parallel", type: "string", value: "<n>", description: "readers at the same time (default 3)" },
    { name: "minutes", type: "string", value: "<n>", description: "time limit of one reader (default 15)" },
  ],
  examples: ["strom media calibrate --estimate", "strom media calibrate", "strom media calibrate --reset"],
  run: async (ctx: Context, { opts }) => {
    const tree = ctx.tree();
    refuseInArchive(tree, "strom media calibrate");
    const lang = tree.lang;
    const t = (key: UIKey, values: Record<string, string | number> = {}) => ui(lang, key, values);
    const agent = ctx.settings.agent(tree.config).value;
    const model = viewModel(ctx.settings, agent, tree.config, typeof opts.model === "string" ? opts.model : undefined);
    const key = calibrationKey(agent, model);
    const who = calibrationLabel(key, t("ui.settings.model.own"));
    const defaults = defaultViewSizes(agent, model);

    if (opts.reset) {
      ctx.settings.reload();
      const had = forgetCalibration(ctx.settings.config, key);
      if (had) ctx.settings.save();
      return { text: t(had ? "ui.views.reset" : "ui.views.reset.none", { agent: who, find: defaults.find, read: defaults.read }), data: { key, reset: had, find: defaults.find, read: defaults.read } };
    }

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
        views: viewsOf(p.kind, it, p.size).map((v) => ({ ...(v.label ? { label: v.label } : {}), view: makeView(tree, it.file, it.mediaId, { max: p.size, ...(v.crop ? { crop: v.crop } : {}) }).file })),
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
