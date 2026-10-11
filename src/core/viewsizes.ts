// How big the views of a scan are for an agent and its model: the defaults (agents/images.ts — a whole image to find
// an entry at most OVERVIEW_MAX, a half, a crop, a part or a reader's view as big as the model takes it), or what a
// calibration of this computer found for that agent and model (strom media calibrate, started by a person): the
// cheapest sizes that read the research's own known records as well as the largest. Kept in the user config per
// agent and model, with its date; strom media view, strom read and the readers go by it.

import { imageMax, OVERVIEW_MAX } from "../agents/images.ts";
import { PROFILES } from "../agents/profiles.ts";
import type { Settings, UserConfig } from "./config.ts";
import type { TreeConfig } from "./model.ts";
import { calibrationKey, keysFor, loadAliases, resolveKey, type Aliases } from "./modelkey.ts";

export { calibrationKey } from "./modelkey.ts";

export interface ViewCalibration {
  /** The long side of a whole image shown to find an entry on it. */
  find: number;
  /** The long side of a half, a crop, a part of --split and a reader's view. */
  read: number;
  /** The day it was measured (YYYY-MM-DD). */
  at: string;
  /** How many images of the research's own known records it read. */
  sample: number;
  /** The sizes it compared. */
  sizes: number[];
  /** Whether each size was decided on a clear result (else the default stands for it). */
  clear: { find: boolean; read: boolean };
  /** What the readings cost, when the agent said. */
  usd?: number;
}

/** The calibration of an agent and model (core/modelkey.ts: its own key, else one an older strom kept it under). */
export function storedCalibration(cfg: UserConfig, agent: string, model: string | undefined, aliases?: Aliases): ViewCalibration | undefined {
  return calibrationOf(cfg, resolveKey(calibrationKey(agent, model), aliases), aliases);
}

/** The calibration kept for a key: its own, else the newest one an older strom kept under an alias of it. */
export function calibrationOf(cfg: UserConfig, key: string, aliases?: Aliases): ViewCalibration | undefined {
  const all = cfg.viewSizes;
  if (all?.[key]) return all[key];
  const names = keysFor(all, key, aliases);
  return names.map((k) => all![k]!).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0];
}

export interface ViewSizes {
  find: number;
  read: number;
  /** What the model takes in whole: no view is bigger. */
  max: number;
  /** The key of the agent and the model it runs on (core/modelkey.ts): what is measured and tuned goes by it. */
  key: string;
  /** The key as asked (an alias: "claude opus"), when it is another: kept beside a reader's record. */
  asked?: string;
  calibrated?: ViewCalibration;
}

/** The defaults of an agent and model, without a calibration. */
export function defaultViewSizes(agent: string | undefined, model: string | undefined): { find: number; read: number; max: number } {
  const max = imageMax(agent, model);
  return { find: Math.min(OVERVIEW_MAX, max), read: max, max };
}

/**
 * The sizes for an agent and model: calibrated, never bigger than the model takes; else the defaults. Its key: the
 * model the alias runs on (the research's aliases, core/modelkey.ts), what is tuned and measured goes by it.
 */
export function viewSizes(cfg: UserConfig, agent: string, model: string | undefined, aliases?: Aliases): ViewSizes {
  const d = defaultViewSizes(agent, model);
  const asked = calibrationKey(agent, model);
  const key = resolveKey(asked, aliases);
  const named = key !== asked ? { key, asked } : { key };
  const c = calibrationOf(cfg, key, aliases);
  if (!c) return { ...d, ...named };
  return { find: Math.min(c.find, d.max), read: Math.min(c.read, d.max), max: d.max, ...named, calibrated: c };
}

/**
 * The model the views are for: the one named (a reader's --model), else the research's (model.lead) — and where the
 * agent works with its own model (no model.lead), the model it reads scans with (model.vision: Claude Code's readers
 * read with Opus), which is what a calibration started with no --model measures.
 */
export function viewModel(settings: Settings, agent: string, tree?: TreeConfig, model?: string): string | undefined {
  if (model?.trim()) return model.trim();
  const m = settings.models(agent, tree);
  return m.lead ?? m.vision;
}

/** The sizes of the agent and model a research works with (`root`: the research, whose aliases name its model). */
export function viewSizesFor(settings: Settings, agent: string, tree?: TreeConfig, model?: string, root?: string): ViewSizes {
  return viewSizes(settings.config, agent, viewModel(settings, agent, tree, model), loadAliases(root));
}

/** The key of the agent and model a research works with now: the model its alias runs on (core/modelkey.ts). */
export function researchKey(settings: Settings, agent: string, tree?: TreeConfig, root?: string, model?: string): string {
  return resolveKey(calibrationKey(agent, viewModel(settings, agent, tree, model)), loadAliases(root));
}

/**
 * Calibrated before, but not for the agent and model the research works with now (another agent, another model): the
 * calibration is offered again — never run unasked. The keys calibrated, newest first.
 */
export function calibrationOffer(settings: Settings, agent: string, tree?: TreeConfig, root?: string): { now: string; before: string[] } | undefined {
  const all = settings.config.viewSizes ?? {};
  const keys = Object.keys(all);
  if (!keys.length) return undefined;
  const aliases = loadAliases(root);
  const now = resolveKey(calibrationKey(agent, viewModel(settings, agent, tree)), aliases);
  if (calibrationOf(settings.config, now, aliases)) return undefined;
  return { now, before: keys.sort((a, b) => (all[b]!.at ?? "").localeCompare(all[a]!.at ?? "")) };
}

/**
 * Forget the calibration of an agent and model (strom media calibrate --reset, config unset views.size) — and those an
 * older strom kept for it under an alias.
 */
export function forgetCalibration(cfg: UserConfig, key: string, aliases?: Aliases): boolean {
  const names = keysFor(cfg.viewSizes, key, aliases);
  if (!names.length) return false;
  const rest = { ...cfg.viewSizes };
  for (const k of names) delete rest[k];
  if (Object.keys(rest).length) cfg.viewSizes = rest;
  else delete cfg.viewSizes;
  return true;
}

/** "find 1400 · read 2000 px" — as the settings show it. */
export function sizesText(s: { find: number; read: number }): string {
  return `find ${s.find} · read ${s.read} px`;
}

/** "claude opus" as a person reads it: "Claude Code · opus" (the agent alone: its name). */
export function calibrationLabel(key: string, own = "its own model"): string {
  const [agent = "", ...model] = key.split(" ");
  return `${PROFILES[agent]?.name ?? agent} · ${model.join(" ") || own}`;
}
