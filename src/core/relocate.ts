// Moving the research to another folder (the setting `home`). The trees and the
// shared folder (connectors, hooks, gates, the inbox, big images) live under it:
// changing the setting alone would leave them behind — the trees gone from the
// list, the plugins and images not found. So the whole folder moves with it:
// renamed where it can be (one disk), else copied and the old one left for the
// user to delete. Never while somebody works in a tree, never into a folder
// that holds something already, never into itself.

import fs from "node:fs";
import path from "node:path";
import type { Settings } from "./config.ts";
import { loadConsents, saveConsents } from "./connector.ts";
import { liveHolder } from "./lock.ts";
import { liveRunning } from "./live.ts";
import type { Env } from "./paths.ts";
import { liveWorkers, runsAtWork } from "./workers.ts";

export type MoveProblem = "inside" | "notEmpty" | "busy";

export interface MovePlan {
  from: string;
  /** Where the folder goes: the folder asked for, or a folder in it when that is the top of a disk. */
  to: string;
  /** Anything to move: the old folder exists and holds something. */
  content: boolean;
  /** The trees in it (their names). */
  trees: string[];
  /** Trees somebody works in now (an agent, a run, a command writing, the Strom app following it live). */
  busy: string[];
  problem?: MoveProblem;
}

/** Files a system leaves in any folder: a folder with only these is empty. */
const LITTER = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
/** What the top of a disk holds of the system's own: the research goes into a folder of its own there. */
const DISK = new Set([".Spotlight-V100", ".fseventsd", ".Trashes", ".TemporaryItems", ".DocumentRevisions-V100", "System Volume Information", "$RECYCLE.BIN"]);

function entries(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((n) => !LITTER.has(n));
  } catch {
    return [];
  }
}

/** Is `inner` the folder `outer` or somewhere in it? (Windows: letters of any case are the same.) */
export function within(inner: string, outer: string, platform: NodeJS.Platform = process.platform): boolean {
  const [a, b] = platform === "win32" ? [inner.toLowerCase(), outer.toLowerCase()] : [inner, outer];
  const rel = path.relative(b, a);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** The same folder? (Windows: letters of any case are the same.) */
export function sameFolder(a: string, b: string, platform: NodeJS.Platform = process.platform): boolean {
  return within(path.resolve(a), path.resolve(b), platform) && within(path.resolve(b), path.resolve(a), platform);
}

/** Somebody at work in a tree: an agent present, a run, a command holding its lock, the live bridge. */
function atWork(root: string): boolean {
  return liveWorkers(root).length > 0 || runsAtWork(root).length > 0 || Boolean(liveHolder(path.join(root, ".strom", "tree.lock"))) || Boolean(liveRunning(root));
}

/** `trees`: the folders of the trees strom knows (those inside `from` move along). */
export function planMove(from: string, to: string, trees: string[]): MovePlan {
  const names = entries(from);
  const inside = trees.filter((t) => within(t, from));
  const busy = inside.filter(atWork).map((t) => path.basename(t));
  // The top of a disk (its own hidden folders only): into a folder named like the old one there.
  const there = entries(to);
  const target = there.length && there.every((n) => DISK.has(n)) ? path.join(to, path.basename(from) || "Strom") : to;
  const plan: MovePlan = { from, to: target, content: names.length > 0, trees: inside.map((t) => path.basename(t)), busy };
  if (!plan.content) return plan;
  if (within(target, from) || within(from, target)) plan.problem = "inside";
  else if (entries(target).length) plan.problem = "notEmpty";
  else if (busy.length) plan.problem = "busy";
  return plan;
}

/** Move the folder; "copied" when it had to be copied to another disk (the old one stays). */
export function moveHome(plan: MovePlan): "moved" | "copied" {
  fs.mkdirSync(path.dirname(plan.to), { recursive: true });
  if (fs.existsSync(plan.to)) {
    // empty but for what a system leaves (planMove said so)
    for (const n of LITTER) fs.rmSync(path.join(plan.to, n), { force: true });
    fs.rmdirSync(plan.to);
  }
  try {
    fs.renameSync(plan.from, plan.to);
    return "moved";
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EXDEV") throw err;
  }
  try {
    fs.cpSync(plan.from, plan.to, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true, verbatimSymlinks: true });
  } catch (err) {
    fs.rmSync(plan.to, { recursive: true, force: true }); // half a copy is no copy
    throw err;
  }
  return "copied";
}

/**
 * What pointed into the old folder points into the new one: the settings (the folders under it, the tree worked on) and
 * the consents to connectors, which know a connector by its folder.
 */
export function repointSettings(settings: Settings, env: Env, from: string, to: string): void {
  const cfg = settings.config;
  const move = (p: string | undefined) => (p && within(p, from) ? path.join(to, path.relative(from, p)) : p);
  cfg.home = to;
  if (cfg.shared) cfg.shared = move(cfg.shared);
  if (cfg.trees) cfg.trees = move(cfg.trees);
  if (cfg.currentTree) cfg.currentTree = move(cfg.currentTree);
  if (cfg.extraTrees) cfg.extraTrees = cfg.extraTrees.map((p) => move(p)!);
  settings.save();
  const consents = loadConsents(env);
  let changed = false;
  for (const c of Object.values(consents.connectors))
    if (c.dir && within(c.dir, from)) {
      c.dir = move(c.dir)!;
      changed = true;
    }
  if (changed) saveConsents(env, consents);
}
