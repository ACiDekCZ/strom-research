// One tree to read from for a process that answers again and again (the bridge): what it read stays read while the
// research is as it was — the same commit, the same stamps of the records' folders and of strom.json — and a new one
// is opened when anything of it changed (a write renames a file into its folder: the folder's stamp changes). A
// folder changed a moment ago is trusted to no stamp: opened afresh each time until it has been still for a while.
// Only for reading: never locked, written, rolled back — a write opens its own (Tree.open) and takes the lock.

import fs from "node:fs";
import path from "node:path";
import { headCommit } from "./git.ts";
import { STABLE_MS } from "./mediaindex.ts";
import { Tree, TREE_FILE } from "./tree.ts";
import type { Env } from "./paths.ts";

interface Held {
  tree: Tree;
  env: Env;
  head: string;
  stamps: string;
}

const held = new Map<string, Held>();

/** The research's commit and the stamps of strom.json and each folder of data/; undefined when one changed a moment ago. */
function stampsOf(root: string): string | undefined {
  const parts: string[] = [];
  const now = Date.now();
  const add = (p: string, name: string) => {
    const st = fs.statSync(p, { bigint: true });
    if (now - Number(st.mtimeNs / 1_000_000n) < STABLE_MS) return false;
    parts.push(`${name}:${st.mtimeNs}`);
    return true;
  };
  try {
    if (!add(path.join(root, TREE_FILE), TREE_FILE)) return undefined;
    const data = path.join(root, "data");
    if (!add(data, "data")) return undefined;
    for (const d of fs.readdirSync(data, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name).sort())
      if (d !== "ops" && !add(path.join(data, d), d)) return undefined;
  } catch {
    return undefined;
  }
  return parts.join("\n");
}

/** A tree of the research to read from, the one opened before while nothing of it changed (see above). */
export function readTree(root: string, env: Env): Tree {
  const head = headCommit(root) ?? "";
  const stamps = stampsOf(root);
  const h = held.get(root);
  if (h && stamps !== undefined && h.env === env && h.head === head && h.stamps === stamps) return h.tree;
  const tree = Tree.open(root, env);
  if (stamps !== undefined) held.set(root, { tree, env, head, stamps });
  else held.delete(root);
  return tree;
}

/** Forget the trees held (a test; a bridge that stops). */
export function forgetReadTrees(): void {
  held.clear();
}
