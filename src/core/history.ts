// The research's history kept small (Milan, 2026-10-04: "ať jim zůstanou data a ideálně se zmenší automaticky"): git
// keeps each commit's new objects loose, a directory of many records stored whole at each change (a tree of 2 200
// people: ~100 kB a send of the Strom app); packed, the same history is a few kB a send. Packed when the loose objects
// pass COMPACT_MB and nobody is at work: by `strom compact`, started in the background after a session, a run, a send
// of the app, and once a day by the bridge. Git's own `gc` — nothing of the research removed, git's own grace for
// what nothing names (never --prune=now: a write cut short keeps its objects), checked by git fsck before and after;
// what it finds wrong is only said (strom doctor), never put right here.

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import * as git from "./git.ts";
import type { Env } from "./paths.ts";
import { stromLauncher } from "./self.ts";
import { liveWorkers, runsAtWork } from "./workers.ts";
import type { Tree } from "./tree.ts";

const MB = 1024 * 1024;
/** A size for the log: MB, below one kB. */
const size_ = (bytes: number) => (bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.round(bytes / 1024)} kB`);

/** Loose objects past this pack the history (STROM_COMPACT_MB for tests). */
export const COMPACT_MB = 50;

const threshold = (env: Env) => {
  const n = Number(env.STROM_COMPACT_MB);
  return (Number.isFinite(n) && env.STROM_COMPACT_MB !== undefined && env.STROM_COMPACT_MB !== "" ? n : COMPACT_MB) * MB;
};

/** How much the history takes: its loose objects and its packs (bytes). */
export function gitSize(root: string): { loose: number; packed: number } | undefined {
  try {
    const r = git.runGit(root, ["count-objects", "-v"]);
    if (r.status !== 0) return undefined;
    const kib = (k: string) => Number(new RegExp(`^${k}: (\\d+)$`, "m").exec(r.stdout)?.[1] ?? 0) * 1024;
    return { loose: kib("size"), packed: kib("size-pack") + kib("size-garbage") };
  } catch {
    return undefined;
  }
}

/** The last packing of a tree and how it went (.strom/compact.json): a check that failed is said by strom doctor. */
export interface Compacted {
  at: string;
  ok: boolean;
  before: number;
  after?: number;
  /** What git fsck said, before packing (nothing packed) or after. */
  error?: string;
  stage?: "before" | "after" | "gc";
}

const stateFile = (root: string) => path.join(root, ".strom", "compact.json");

export function lastCompacted(root: string): Compacted | undefined {
  try {
    return JSON.parse(fs.readFileSync(stateFile(root), "utf8")) as Compacted;
  } catch {
    return undefined;
  }
}

const atWork = (root: string) => liveWorkers(root).length > 0 || runsAtWork(root).length > 0;

/**
 * The history packed in the background when it has grown (loose objects past COMPACT_MB) and nobody is at work: a
 * strom of its own (`strom compact`), so nothing waits for it. Whether it was started.
 */
export function compactSoon(root: string, env: Env): boolean {
  try {
    if (env.STROM_COMPACT === "off") return false;
    const size = gitSize(root);
    if (!size || size.loose < threshold(env) || atWork(root)) return false;
    const { command, args } = stromLauncher();
    const child = spawn(command, [...args, "compact"], {
      cwd: root,
      env: { ...(env as NodeJS.ProcessEnv), STROM_TREE: root, STROM_SPAWNED: "1" },
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export type CompactResult = { done: true; before: number; after: number } | { done: false; why: "small" | "busy" | "fsck" | "gc"; size?: number; error?: string };

/**
 * Pack the history now (`now`: whatever its size) — under the tree's lock (nothing written meanwhile), never while
 * somebody is at work, git fsck before (anything wrong: nothing packed) and after. Logged in .strom/tidy.log with the
 * size of .git before and after.
 */
export function compactHistory(tree: Tree, env: Env, opts: { now?: boolean } = {}): CompactResult {
  const root = tree.root;
  if (atWork(root)) return { done: false, why: "busy" };
  return tree.withTreeLock((): CompactResult => {
    const size = gitSize(root);
    const total = size ? size.loose + size.packed : 0;
    if (!size || (!opts.now && size.loose < threshold(env))) return { done: false, why: "small", size: total };
    if (atWork(root)) return { done: false, why: "busy" };
    const fsck = () => {
      const r = git.runGit(root, ["fsck", "--no-progress", "--no-dangling"]);
      return r.status === 0 ? undefined : (r.stderr || r.stdout).trim().split("\n").slice(0, 3).join(" · ") || `git fsck: ${r.status}`;
    };
    const say = (state: Compacted, line: string) => {
      try {
        fs.mkdirSync(path.join(root, ".strom"), { recursive: true });
        fs.writeFileSync(stateFile(root), JSON.stringify(state, null, 2));
        fs.appendFileSync(path.join(root, ".strom", "tidy.log"), `${state.at} ${line}\n`);
      } catch {
        // the log is no reason to fail
      }
    };
    const at = new Date().toISOString();
    const wrong = fsck();
    if (wrong) {
      say({ at, ok: false, before: total, error: wrong, stage: "before" }, `history not packed: git fsck found something wrong (${wrong}) — nothing changed`);
      return { done: false, why: "fsck", error: wrong };
    }
    // git's own grace for what nothing names (gc.pruneExpire, two weeks): never --prune=now
    const gc = git.runGit(root, ["gc", "--quiet"]);
    const now = gitSize(root);
    const after = now ? now.loose + now.packed : total;
    if (gc.status !== 0) {
      const error = (gc.stderr || gc.stdout).trim().split("\n").slice(0, 3).join(" · ") || `git gc: ${gc.status}`;
      say({ at, ok: false, before: total, after, error, stage: "gc" }, `history not packed: ${error}`);
      return { done: false, why: "gc", error };
    }
    const wrongAfter = fsck();
    if (wrongAfter) {
      say({ at, ok: false, before: total, after, error: wrongAfter, stage: "after" }, `history packed, then git fsck found something wrong (${wrongAfter}) — nothing put right`);
      return { done: false, why: "fsck", error: wrongAfter };
    }
    say({ at, ok: true, before: total, after }, `history packed: .git ${size_(total)} → ${size_(after)} (loose ${size_(size.loose)}), git fsck ok before and after`);
    return { done: true, before: total, after };
  });
}
