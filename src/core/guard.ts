// `strom guard` — did anything get LOST since the last commit?
//
// Nothing in Strom is deleted: records and facts are retracted with a
// reason. So a record file that disappeared, or an event, note, name,
// partner or child that vanished from a record, is a loss — unless an
// operation logged since the last commit names it with a reason.
// Only files changed since HEAD are examined (one git status + one batched
// read), so the cost does not grow with the size of the tree.

import fs from "node:fs";
import path from "node:path";
import * as git from "./git.ts";
import { RECORD_TYPES } from "./model.ts";
import type { Finding } from "./check.ts";
import type { Tree, Op } from "./tree.ts";
import { snapshot, type Snapshot } from "./integrity.ts";

type Rec = Record<string, unknown> & { id?: string };

/** Array fields whose items must never disappear, with the key identifying an item. */
const KEPT_ARRAYS: Record<string, (item: unknown) => string> = {
  events: (i) => String((i as { id?: string }).id),
  notes: (i) => JSON.stringify(i),
  // a person's name is its words (its kind or a citation added is no change of it); a place's name is all of it
  names: (i) => {
    const n = i as { given?: string; surname?: string; name?: string };
    if (n.given === undefined && n.surname === undefined) return JSON.stringify(i);
    return `${n.given ?? ""} /${n.surname ?? ""}/`;
  },
  partners: (i) => String(i),
  children: (i) => String((i as { person?: string }).person),
};

const RECORD_DIRS = new Set(Object.values(RECORD_TYPES).map((d) => `data/${d.dir}/`));

function parse(text: string | undefined): Rec | undefined {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as Rec;
  } catch {
    return undefined;
  }
}

export function guard(tree: Tree, snap: Snapshot = snapshot(tree)): Finding[] {
  const out: Finding[] = [];
  if (!git.hasHead(tree.root)) return out;
  const changes = snap.changes.filter((c) => c.path.startsWith("data/"));
  if (changes.length === 0) return out;
  const before = snap.head;

  // Operations logged since HEAD (the new tail of each changed log).
  const justified = new Set<string>();
  for (const c of changes) {
    if (!c.path.startsWith("data/ops/")) continue;
    const abs = path.join(tree.root, c.path);
    const old = before.get(c.path) ?? "";
    if (!fs.existsSync(abs)) {
      if (old) out.push({ level: "error", code: "ops-deleted", file: c.path, message: "operation log was deleted" });
      continue;
    }
    const now = fs.readFileSync(abs, "utf8");
    if (!now.startsWith(old)) {
      out.push({ level: "error", code: "ops-rewritten", file: c.path, message: "operation log was rewritten (it is append-only)" });
      continue;
    }
    for (const line of now.slice(old.length).split("\n")) {
      if (!line.trim()) continue;
      try {
        const op = JSON.parse(line) as Op;
        if (op.reason) for (const t of op.targets) justified.add(t);
      } catch {
        // reported by verify
      }
    }
  }

  for (const c of changes) {
    const dir = c.path.slice(0, c.path.lastIndexOf("/") + 1);
    if (!RECORD_DIRS.has(dir) || !c.path.endsWith(".json")) continue;
    const prev = parse(before.get(c.path));
    if (!prev) continue; // new record: nothing to lose
    const id = prev.id ?? path.basename(c.path, ".json");
    const abs = path.join(tree.root, c.path);
    if (!fs.existsSync(abs)) {
      if (!justified.has(id))
        out.push({
          level: "error",
          code: "record-deleted",
          id,
          file: c.path,
          message: "record was deleted",
          hint: "records are never deleted — strom repair, then retract it with --reason",
        });
      continue;
    }
    const cur = parse(fs.readFileSync(abs, "utf8"));
    if (!cur) continue;
    for (const [field, keyOf] of Object.entries(KEPT_ARRAYS)) {
      const a = prev[field];
      if (!Array.isArray(a)) continue;
      const b = cur[field];
      const remaining = new Set(Array.isArray(b) ? b.map(keyOf) : []);
      for (const item of a) {
        const key = keyOf(item);
        if (remaining.has(key) || justified.has(id) || justified.has(key)) continue;
        out.push({
          level: "error",
          code: "item-removed",
          id,
          file: c.path,
          message: `${field} item removed: ${key.slice(0, 80)}`,
          hint: "retract instead of deleting, or give --reason",
        });
      }
    }
  }
  return out;
}
