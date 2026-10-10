// strom media calibrate --reset as a person sees it (and strom doctor --fix): a table of what would be returned to the
// defaults — what, scope, now → default, source, date, why — then the person's yes (Enter says no): in their terminal,
// in a window of the system when an agent asks, nobody to ask: needs-input (exit 4). --dry-run and --json only list.
// The values themselves: core/tunereset.ts.

import path from "node:path";
import fs from "node:fs";
import type { Context } from "./context.ts";
import { lines, numberIn, table, truncate } from "./format.ts";
import { ui, type UIKey } from "./ui.ts";
import { loadRollup, TUNING } from "../core/readstats.ts";
import { applyReset, researchHeld, resetItems, RESET_PARTS, type ResetItem, type ResetPart } from "../core/tunereset.ts";
import { calibrationLabel, defaultViewSizes } from "../core/viewsizes.ts";
import { splitKey } from "../core/tune.ts";
import { readJsonIfExists } from "../core/json.ts";
import type { Task, TreeConfig } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";

export interface ResetRequest {
  /** The key of the research's agent and model now. */
  key: string;
  /** Every key of the user config and of this research. */
  all?: boolean;
  only?: ResetPart[];
  recordset?: string;
  host?: string;
  dryRun?: boolean;
  /** The model named (--model), said again in the command. */
  model?: string;
}

/** The command that does what a request asks (the window's, the needs-input's, the listing's). */
export function resetCommand(r: Omit<ResetRequest, "key">): string {
  const q = (s: string) => (/^[\p{L}\p{M}\p{N}._:/-]+$/u.test(s) ? s : `"${s.replace(/"/g, '\\"')}"`);
  return [
    "strom media calibrate --reset",
    r.all ? "--all" : "",
    r.only?.length && r.only.length < RESET_PARTS.length ? `--only ${r.only.join(",")}` : "",
    r.recordset ? `--recordset ${q(r.recordset)}` : "",
    r.host ? `--host ${q(r.host)}` : "",
    r.model ? `--model ${q(r.model)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** A value as the table shows it: "find 2000 · read 2000 · halves", a choice, "–" for none. */
function valueText(v: unknown): string {
  if (v === null || v === undefined || v === false) return "–";
  if (typeof v !== "object") return String(v);
  const parts = Object.entries(v as Record<string, unknown>)
    .filter(([, x]) => x !== false && x !== null && x !== undefined)
    .map(([k, x]) => (x === true ? k : `${k} ${String(x)}`));
  return parts.length ? parts.join(" · ") : "–";
}

/**
 * The reason of a value as a person reads it — in the research language, its numbers as the language writes them:
 * a calibration by the known records it read, an answer by where it was given, a change of strom's by its figures
 * (core/tune.ts reasonOf; one kept before they were: from the readings measured). The English `why` stays the agent's.
 */
export function reasonText(lang: string, i: ResetItem): string | undefined {
  const t = (k: UIKey, values: Record<string, string | number> = {}) => ui(lang, k, values);
  const nf = (n: number) => numberIn(lang, n, { maximumFractionDigits: 1 });
  if (i.source === "calibrated") return i.sample !== undefined ? t("ui.tune.why.calibrated", { n: nf(i.sample) }) : undefined;
  if (i.source === "answered") {
    if (!i.by) return undefined;
    return ["terminal", "window", "app"].includes(i.by) ? t(`ui.tune.why.answered.${i.by}` as UIKey) : t("ui.tune.why.answered");
  }
  const b = i.basis ?? {};
  const num = (k: string) => (typeof b[k] === "number" && Number.isFinite(b[k]) ? (b[k] as number) : undefined);
  const pct = (v: number | undefined) => (v === undefined ? "–" : `${nf(Math.round(v * 100))} %`);
  // "3 of the last 10" (readers), "3 of 10" (sessions, images); without its whole (kept before it was): the count
  const count = (n: number, of: number | undefined, last: boolean) => (of === undefined ? nf(n) : t(last ? "ui.tune.why.last" : "ui.tune.why.of", { n: nf(n), of: nf(of) }));
  if (i.action === "A3") {
    const n = num("M4");
    const ctx = num("ctx");
    const view = num("viewTokens");
    if (n !== undefined && ctx !== undefined && view !== undefined) return t("ui.tune.why.A3", { count: count(n, num("M4.of"), true), ctx: nf(ctx), view: nf(view) });
    // where the context never cleared: the main agent's long stretches (M12)
    const long = num("M12");
    if (long !== undefined && ctx !== undefined && view !== undefined) return t("ui.tune.why.A3.long", { count: count(long, num("M12.of"), true), ctx: nf(ctx), view: nf(view) });
    return t("ui.tune.why.measured");
  }
  const parts: string[] = [];
  for (const m of Object.keys(b).filter((k) => /^M\d+$/u.test(k))) {
    const value = num(m);
    const n = num(`${m}.n`) ?? 0;
    const of = num(`${m}.of`);
    if (value === undefined) continue;
    switch (m) {
      case "M5":
      case "M6":
        parts.push(t(`ui.tune.why.${m}` as UIKey, { value: pct(value), base: pct(num(`${m}.base`)), n: nf(n) }));
        break;
      case "M7":
        parts.push(t("ui.tune.why.M7", { n: nf(n) }));
        break;
      case "M8": {
        const wait = num("M8.wait");
        const c = count(value, n, false);
        parts.push(wait === undefined ? t("ui.tune.why.M8", { count: c }) : t("ui.tune.why.M8.wait", { count: c, wait: nf(wait), later: nf(num("M8.later") ?? 0) }));
        break;
      }
      case "M11":
        parts.push(t("ui.tune.why.M11", { value: pct(value), count: count(n, of, false) }));
        break;
      case "M3":
      case "M10":
        parts.push(t(`ui.tune.why.${m}` as UIKey, { count: count(n, of, true) }));
        break;
      case "M4": {
        const ctx = num("M4.ctx");
        parts.push(ctx === undefined ? t("ui.tune.why.M4", { count: count(n, of, true) }) : t("ui.tune.why.M4.ctx", { count: count(n, of, true), ctx: nf(ctx) }));
        break;
      }
    }
  }
  return parts.length ? parts.join("; ") : t("ui.tune.why.measured");
}

/** The tasks an answer added that stay: those it names, and the open ones of an answer to search weak scans again. */
function tasksStaying(tree: Tree, items: ResetItem[]): string[] {
  const out = new Set(items.flatMap((i) => i.tasks ?? []));
  if (items.some((i) => i.what === "answer:negatives.weak"))
    for (const t of tree.list<Task>("task")) if (t.origin?.startsWith("tune:") && t.state !== "done" && t.state !== "dropped") out.add(t.id);
  return [...out].sort();
}

/** The other researches on this computer that keep values of their own (books, archives, answers): said, never touched. */
function otherResearches(ctx: Context, tree: Tree): { name: string; root: string; items: number; command: string }[] {
  const out: { name: string; root: string; items: number; command: string }[] = [];
  for (const k of ctx.knownTrees()) {
    if (path.resolve(k.root) === path.resolve(tree.root)) continue;
    const cfg = readJsonIfExists<TreeConfig>(path.join(k.root, "strom.json"));
    if (!cfg || cfg.mode === "archive" || !fs.existsSync(path.join(k.root, ".strom", "tune"))) continue;
    const n = researchHeld(k.root);
    if (n) out.push({ name: k.name, root: ctx.display(k.root), items: n, command: `strom media calibrate --reset --all --tree ${/^[\p{L}\p{M}\p{N}._-]+$/u.test(k.name) ? k.name : `"${k.name}"`}` });
  }
  return out;
}

/**
 * List what a reset would return and, on a person's yes, return it. A person at their terminal sees the table and is
 * asked (Enter: no); an agent's request is asked in a window of the system; nobody to ask: needs-input (exit 4).
 */
export async function resetReading(ctx: Context, tree: Tree, r: ResetRequest): Promise<{ text: string; data: unknown; exitCode?: number }> {
  const lang = tree.lang;
  const t = (k: UIKey, values: Record<string, string | number> = {}) => ui(lang, k, values);
  const own = t("ui.settings.model.own");
  const parts = new Set<ResetPart>(r.only?.length ? r.only : RESET_PARTS);
  ctx.settings.reload();
  const items = resetItems(tree.root, ctx.settings.config, { keys: r.all ? "all" : [r.key], parts, ...(r.recordset ? { recordset: r.recordset } : {}), ...(r.host ? { host: r.host } : {}) });
  const others = r.all ? otherResearches(ctx, tree) : [];
  const command = resetCommand(r);
  const { agent, model } = splitKey(r.key);
  const d = defaultViewSizes(agent, model);
  const base = { key: r.key, all: !!r.all, only: [...parts], ...(r.recordset ? { recordset: r.recordset } : {}), ...(r.host ? { host: r.host } : {}), find: d.find, read: d.read };
  const othersLine = others.length ? t("ui.tune.reset.others", { list: others.map((o) => `${o.name} (${o.items})`).join(", "), command: others[0]!.command }) : undefined;

  const scopeLabel = (s: string) => (s === "key" ? t("ui.tune.reset.scope.key") : s === "research" ? t("ui.tune.reset.scope.research") : s.replace(/^(book|host):/u, ""));
  const whatLabel = (i: ResetItem) =>
    i.source === "calibrated" ? t("ui.tune.what.calibration") : i.source === "answered" ? t("ui.tune.what.answer", { kind: i.what.slice("answer:".length) }) : ui(lang, `ui.tune.what.${i.what}` as UIKey) || i.what;
  if (!items.length) {
    const scope = [r.all ? t("ui.tune.reset.scope.all") : calibrationLabel(r.key, own), r.recordset, r.host].filter(Boolean).join(" · ");
    return { text: lines(t("ui.tune.reset.none", { scope }), othersLine), data: { ...base, reset: false, items: [], others } };
  }
  const header = t("ui.tune.reset.cols").split("|");
  const blocks: string[] = [];
  for (const key of [...new Set(items.map((i) => i.key))]) {
    const rows = items
      .filter((i) => i.key === key)
      .map((i) => [whatLabel(i), scopeLabel(i.scope), `${valueText(i.now)} → ${valueText(i.default)}`, t(`ui.tune.reset.src.${i.source}` as UIKey), (i.at ?? "").slice(0, 10) || "–", truncate(reasonText(lang, i) ?? "–", 70)]);
    blocks.push(lines(t("ui.tune.reset.title", { agent: calibrationLabel(key, own) }), table(rows, { header }).replace(/^/gmu, "  ")));
  }
  const listing = blocks.join("\n");
  const tasks = tasksStaying(tree, items);
  const tasksLine = tasks.length ? t("ui.tune.reset.tasks", { tasks: tasks.join(", ") }) : undefined;
  // (the figures of a reason are the listing's; --json keeps the English reason as before)
  const data = { ...base, items: items.map(({ fields: _f, basis: _b, sample: _s, by: _by, ...i }) => i), ...(tasks.length ? { tasks } : {}), others, command };
  if (r.dryRun || ctx.json) return { text: lines(listing, tasksLine, othersLine, t("ui.tune.reset.dry", { command })), data: { ...data, reset: false, dryRun: true } };

  // a person's yes: in their terminal (Enter says no), a window of the system when an agent asks; nobody: exit 4
  const list = truncate([...new Set(items.map((i) => (i.scope === "key" ? whatLabel(i) : `${whatLabel(i)} (${scopeLabel(i.scope)})`)))].join(", "), 400);
  const says = t("ui.tune.reset.ask", { list });
  const where = ctx.requireHuman(`Return the reading of scans to the defaults (${items.length} values: ${items.map((i) => `${i.what} ${i.scope}`).join(", ")})?`, command, "tune.reset", says);
  if (where === "terminal") {
    ctx.io.stdout(`${listing}\n\n`);
    if (!(await ctx.confirm(says, false))) return { text: t("ui.tune.reset.no"), data: { ...data, reset: false } };
  }
  const entry = applyReset(tree.root, ctx.settings, items, { units: loadRollup(tree.root)?.units ?? [], ...(r.all ? {} : { key: r.key }) });
  return {
    text: lines(where === "window" ? listing : undefined, t("ui.tune.reset.done", { n: items.length, days: TUNING.heldDays }), tasksLine, othersLine),
    data: { ...data, reset: true, at: entry?.at },
  };
}
