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
import type { Input } from "./model.ts";
import { inCloudOnly, snapshot, verifyFast, type Snapshot } from "./integrity.ts";

type Rec = Record<string, unknown> & { id?: string };

/** Array fields whose items must never disappear, with the key identifying an item. */
const KEPT_ARRAYS: Record<string, (item: unknown) => string> = {
  events: (i) => String((i as { id?: string }).id),
  notes: (i) => JSON.stringify(i),
  // a person's name is its words (its kind or a citation added is no change of it); a place's name is its words and
  // language (what it is — a form, another name — or its years filled in is no change of it)
  names: (i) => {
    const n = i as { given?: string; surname?: string; name?: string; lang?: string };
    if (n.given === undefined && n.surname === undefined) return typeof n.name === "string" ? `${n.name}${n.lang ? `@${n.lang}` : ""}` : JSON.stringify(i);
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

/**
 * The notes of the family's material a send of the Strom app took off with no reason (1.35.0: a file the app was
 * never given in its tree read as its note removed by the user — the write's commit refused, every write after it
 * too): what the last commit had and the record lacks now, to be given back before the commit (cli/commit.ts). Only
 * the app's own write of its files (input.media) since the last commit; one with a reason (the user's word since) none.
 */
export function notesTakenOffByApp(tree: Tree, snap: Snapshot): { id: string; notes: unknown[] }[] {
  if (!git.hasHead(tree.root)) return [];
  const ids = new Set<string>();
  const changes = snap.changes.filter((c) => c.path.startsWith("data/"));
  for (const c of changes) {
    if (!c.path.startsWith("data/ops/")) continue;
    const abs = path.join(tree.root, c.path);
    if (!fs.existsSync(abs)) continue;
    const old = snap.head.get(c.path) ?? "";
    const now = fs.readFileSync(abs, "utf8");
    if (!now.startsWith(old)) continue;
    for (const line of now.slice(old.length).split("\n")) {
      if (!line.trim()) continue;
      try {
        const op = JSON.parse(line) as Op;
        if (op.op === "input.media" && !op.reason) for (const t of op.targets) ids.add(t);
      } catch {
        // reported by verify
      }
    }
  }
  const out: { id: string; notes: unknown[] }[] = [];
  for (const id of ids) {
    const file = `data/inputs/${id}.json`;
    const prev = parse(snap.head.get(file));
    const abs = path.join(tree.root, file);
    if (!prev || !Array.isArray(prev.notes) || !fs.existsSync(abs)) continue;
    const cur = parse(fs.readFileSync(abs, "utf8"));
    if (!cur) continue;
    const key = KEPT_ARRAYS.notes!;
    const left = new Set(Array.isArray(cur.notes) ? cur.notes.map(key) : []);
    const lost = prev.notes.filter((n) => !left.has(key(n)));
    if (lost.length) out.push({ id, notes: lost });
  }
  return out;
}

/**
 * The notes notesTakenOffByApp finds given back, one logged operation each (under the tree's lock): the commit after it
 * goes through the check, nothing of anybody's work lost, the research writable again. How many records.
 */
export function giveNotesBack(tree: Tree, snap: Snapshot): number {
  const lost = notesTakenOffByApp(tree, snap);
  for (const l of lost) {
    const cur = tree.get<Input>(l.id);
    if (!cur) continue;
    tree.put({ ...cur, notes: [...(cur.notes ?? []), ...(l.notes as Input["notes"])], updated: new Date().toISOString() }, { op: "input.note", targets: [l.id], summary: `${l.id} its note given back: a send of the Strom app had taken it off` });
  }
  return lost.length;
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
    // only in iCloud (its placeholder here): not downloaded, nothing deleted — verify says so (not-downloaded)
    if (!fs.existsSync(abs) && inCloudOnly(abs)) continue;
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

  // a record as an operation the last commit holds already wrote it (its file left out of that commit): strom's own
  // write, its operation in the history — nothing lost since then (verifyFast sealedBefore); asked only when needed
  let sealedBefore: Set<string> | undefined;
  const writtenBefore = (p: string): boolean => (sealedBefore ??= new Set(verifyFast(tree, snap).sealedBefore ?? [])).has(p);

  for (const c of changes) {
    const dir = c.path.slice(0, c.path.lastIndexOf("/") + 1);
    if (!RECORD_DIRS.has(dir) || !c.path.endsWith(".json")) continue;
    const prev = parse(before.get(c.path));
    if (!prev) continue; // new record: nothing to lose
    const id = prev.id ?? path.basename(c.path, ".json");
    const abs = path.join(tree.root, c.path);
    if (!fs.existsSync(abs) && inCloudOnly(abs)) continue;
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
    const found = out.length;
    for (const [field, keyOf] of Object.entries(KEPT_ARRAYS)) {
      const a = prev[field];
      if (!Array.isArray(a)) continue;
      const b = cur[field];
      const remaining = new Set(Array.isArray(b) ? b.map(keyOf) : []);
      // a place's name of no language is kept by the same words with a language (a form become another name)
      if (field === "names" && Array.isArray(b)) for (const n of b as { name?: unknown; lang?: unknown }[]) if (typeof n.name === "string" && n.lang) remaining.add(n.name);
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
    if (out.length > found && writtenBefore(c.path)) out.length = found;
  }
  return out;
}
