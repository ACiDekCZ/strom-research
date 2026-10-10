// How big the views of a scan are for an agent and its model: the defaults (agents/images.ts — a whole image to find
// an entry at most OVERVIEW_MAX, a half, a crop, a part or a reader's view as big as the model takes it), or what a
// calibration of this computer found for that agent and model (strom media calibrate, started by a person): the
// cheapest sizes that read the research's own known records as well as the largest. Kept in the user config per
// agent and model, with its date; strom media view, strom read and the readers go by it.

import { imageMax, OVERVIEW_MAX } from "../agents/images.ts";
import { PROFILES } from "../agents/profiles.ts";
import type { Settings, UserConfig } from "./config.ts";
import type { TreeConfig } from "./model.ts";

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

/** The key of an agent and its model in the user config ("claude opus"; the agent alone: its own default model). */
export function calibrationKey(agent: string, model: string | undefined): string {
  const m = model?.trim();
  return m ? `${agent} ${m}` : agent;
}

export function storedCalibration(cfg: UserConfig, agent: string, model: string | undefined): ViewCalibration | undefined {
  return cfg.viewSizes?.[calibrationKey(agent, model)];
}

export interface ViewSizes {
  find: number;
  read: number;
  /** What the model takes in whole: no view is bigger. */
  max: number;
  key: string;
  calibrated?: ViewCalibration;
}

/** The defaults of an agent and model, without a calibration. */
export function defaultViewSizes(agent: string | undefined, model: string | undefined): { find: number; read: number; max: number } {
  const max = imageMax(agent, model);
  return { find: Math.min(OVERVIEW_MAX, max), read: max, max };
}

/** The sizes for an agent and model: calibrated, never bigger than the model takes; else the defaults. */
export function viewSizes(cfg: UserConfig, agent: string, model: string | undefined): ViewSizes {
  const d = defaultViewSizes(agent, model);
  const key = calibrationKey(agent, model);
  const c = cfg.viewSizes?.[key];
  if (!c) return { ...d, key };
  return { find: Math.min(c.find, d.max), read: Math.min(c.read, d.max), max: d.max, key, calibrated: c };
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

export function viewSizesFor(settings: Settings, agent: string, tree?: TreeConfig, model?: string): ViewSizes {
  return viewSizes(settings.config, agent, viewModel(settings, agent, tree, model));
}

/**
 * Calibrated before, but not for the agent and model the research works with now (another agent, another model): the
 * calibration is offered again — never run unasked. The keys calibrated, newest first.
 */
export function calibrationOffer(settings: Settings, agent: string, tree?: TreeConfig): { now: string; before: string[] } | undefined {
  const all = settings.config.viewSizes ?? {};
  const keys = Object.keys(all);
  if (!keys.length) return undefined;
  const now = calibrationKey(agent, viewModel(settings, agent, tree));
  if (all[now]) return undefined;
  return { now, before: keys.sort((a, b) => (all[b]!.at ?? "").localeCompare(all[a]!.at ?? "")) };
}

/** Forget the calibration of an agent and model (strom media calibrate --reset, config unset views.size). */
export function forgetCalibration(cfg: UserConfig, key: string): boolean {
  if (!cfg.viewSizes?.[key]) return false;
  const rest = { ...cfg.viewSizes };
  delete rest[key];
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
