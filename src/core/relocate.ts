// Moving the research to another folder (the setting `home`). The trees and the
// shared folder (connectors, hooks, gates, the inbox, big images) live under it:
// changing the setting alone would leave them behind — the trees gone from the
// list, the plugins and images not found. So the whole folder moves with it:
// renamed where it can be (one disk), else copied and the old one left for the
// user to delete. Never while somebody works in a tree, never into a folder
// that holds something already, never into itself. A folder that is the home of a research already (a copy put
// back, another computer's folder) is taken as it is instead, on the person's yes: nothing moves, the old folder
// stays as it was, its trees out of the list (planUseExisting, useExistingHome).

import fs from "node:fs";
import path from "node:path";
import type { Settings } from "./config.ts";
import { loadConsents, saveConsents } from "./connector.ts";
import { liveHolder } from "./lock.ts";
import { liveRunning } from "./live.ts";
import type { Env } from "./paths.ts";
import { liveWorkers, runsAtWork } from "./workers.ts";
import { insideProgram } from "./self.ts";
import { knownTreesIn, TREE_FILE, type KnownTree } from "./tree.ts";
import { readJsonIfExists } from "./json.ts";

export type MoveProblem = "inside" | "notEmpty" | "busy" | "program";

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

/** Somebody at work in a tree: an agent present, a run, a command holding its lock, the live bridge (unless `bridge: false`: it only reads). */
export function atWork(root: string, opts: { bridge?: boolean } = {}): boolean {
  return liveWorkers(root).length > 0 || runsAtWork(root).length > 0 || Boolean(liveHolder(path.join(root, ".strom", "tree.lock"))) || (opts.bridge !== false && Boolean(liveRunning(root)));
}

/**
 * `trees`: the folders of the trees strom knows (those inside `from` move along). Never into strom's program folder
 * (an update replaces it, an uninstall takes it away; `settings`: the settings folder, which may lie in it).
 */
export function planMove(from: string, to: string, trees: string[], opts: { settings?: string } = {}): MovePlan {
  const names = entries(from);
  const inside = trees.filter((t) => within(t, from));
  const busy = inside.filter((t) => atWork(t)).map((t) => path.basename(t));
  // The top of a disk (its own hidden folders only): into a folder named like the old one there.
  const there = entries(to);
  const target = there.length && there.every((n) => DISK.has(n)) ? path.join(to, path.basename(from) || "Strom") : to;
  const plan: MovePlan = { from, to: target, content: names.length > 0, trees: inside.map((t) => path.basename(t)), busy };
  if (insideProgram(target, opts)) plan.problem = "program";
  if (!plan.content || plan.problem) return plan;
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
 * A folder that is the home of a research already (a copy put back, a restore, another computer's folder synced here):
 * a family tree in it (a folder with strom.json) or strom's shared folder (`shared` with its plugins or images).
 * Undefined for any other folder. `trees`: the trees in it.
 */
export function researchHome(dir: string): { trees: KnownTree[] } | undefined {
  const trees = knownTreesIn(dir);
  const shared = path.join(dir, "shared");
  const hasShared = ["plugins", "media"].some((d) => {
    try {
      return fs.statSync(path.join(shared, d)).isDirectory();
    } catch {
      return false;
    }
  });
  return trees.length || hasShared ? { trees } : undefined;
}

export type UseProblem = "inside" | "busy" | "program";

export interface UsePlan {
  from: string;
  to: string;
  /** The trees in the folder taken (their names). */
  trees: string[];
  /** The trees of the old folder with no copy (the same id) in the new one: they stay there, out of the list. */
  left: { name: string; root: string }[];
  /** Trees of the old folder somebody works in now (as planMove says it). */
  busy: string[];
  problem?: UseProblem;
}

/**
 * Taking a folder that is the home of a research already as the home (`researchHome`), nothing moved: what the old
 * folder keeps out of the list then, and whether it can be now — never while somebody works in a tree of the old
 * folder (its bridge would go on with the folder left), never a folder in the old one (or the other way round), never
 * strom's program folder. `known`: the trees strom knows (those in the old folder are its).
 */
export function planUseExisting(from: string, to: string, known: readonly KnownTree[], opts: { settings?: string } = {}): UsePlan {
  const there = researchHome(to)?.trees ?? [];
  const ids = new Set(there.map((t) => t.id).filter(Boolean));
  const inOld = known.filter((t) => within(t.root, from));
  const plan: UsePlan = {
    from,
    to,
    trees: there.map((t) => path.basename(t.root)),
    left: inOld.filter((t) => !t.id || !ids.has(t.id)).map((t) => ({ name: t.name, root: t.root })),
    busy: inOld.filter((t) => atWork(t.root)).map((t) => path.basename(t.root)),
  };
  if (insideProgram(to, opts)) plan.problem = "program";
  else if (within(to, from) || within(from, to)) plan.problem = "inside";
  else if (plan.busy.length) plan.problem = "busy";
  return plan;
}

/**
 * The settings point to the folder taken (planUseExisting), the old folder left as it is — nothing in it moved,
 * written or deleted: the folders set under the old one (trees, shared) back to their places under the new one, the
 * tree worked on its copy there (else none), the trees remembered from the old folder out of the list. A folder set
 * elsewhere (shared on another disk) stays. The consents to connectors stay with the old folder's connectors: those
 * of the new one are asked for again (a consent is the person's, for the code it was given to).
 */
export function useExistingHome(settings: Settings, from: string, to: string): void {
  const cfg = settings.config;
  const old = (p: string | undefined) => !!p && within(p, from);
  cfg.home = to;
  if (old(cfg.shared)) delete cfg.shared;
  if (old(cfg.trees)) delete cfg.trees;
  if (cfg.extraTrees) {
    const kept = cfg.extraTrees.filter((p) => !old(p));
    if (kept.length) cfg.extraTrees = kept;
    else delete cfg.extraTrees;
  }
  if (old(cfg.currentTree)) {
    const id = readJsonIfExists<{ id?: string }>(path.join(cfg.currentTree!, TREE_FILE))?.id;
    const twin = id ? knownTreesIn(settings.trees()?.value, cfg.extraTrees ?? []).find((t) => t.id === id) : undefined;
    if (twin) cfg.currentTree = twin.root;
    else delete cfg.currentTree;
  }
  settings.save();
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
