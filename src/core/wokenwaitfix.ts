// strom fixes woken-waits: a task waiting for somebody's answer that a strom before 1.26.0 put back in the queue when
// images of a book were registered (commands/media.ts wakeWaiting) — the person's check of a site (only the person
// answers it), or a letter, the family, a site that waited on another book than the one registered. Found in the
// history (its last operation that wake) and set right by rules: each waiting again as it waited — what it waits on and
// the site to check kept by the wake, the request sent put back from the history (strom task sent before the wake); the
// wake's note stays. Free, one operation, kept for its undo (WOKEN_WAITS_FILE).
// Left as they are (said): one taken up since — any operation of it after the wake, or worked on.

import fs from "node:fs";
import path from "node:path";
import type { Task, TreeConfig } from "./model.ts";
import { now, type Op, type Tree } from "./tree.ts";
import { waitKindOf } from "./waitkind.ts";

/** Where the fix keeps what it changed, for its undo (sealed like the rest of quality/; travels with the research). */
export const WOKEN_WAITS_FILE = "quality/woken-waits.json";

/** Why the wake was wrong: the person's check of a site, or somebody's answer on another book. */
export type WokenWhy = "check" | "letter" | "family" | "web";

/** One task set waiting again: what it is, the book whose images woke it and when, the request sent put back. */
export interface WokenWaitFix {
  task: string;
  what: string;
  /** The people it is of. */
  subject: string[];
  recordset: string;
  woken: string;
  why: WokenWhy;
  sent?: { at: string; by: string };
  /** The task's `updated` before the fix (the undo puts it back as it was). */
  updated: string;
}

/** One left as it is: taken up since the wake. */
export interface WokenWaitLeft {
  task: string;
  what: string;
  subject: string[];
  recordset: string;
  why: WokenWhy;
}

export interface WokenWaitFindings {
  fixes: WokenWaitFix[];
  left: WokenWaitLeft[];
}

interface WokenFile {
  v: 1;
  /** Each time the fix set things right, newest last. */
  runs: { at: string; version: string; items: WokenWaitFix[] }[];
}

/** The wake by images registered, as commands/media.ts writes it. */
const IMAGE_WAKE = /^(T\p{N}+) wake: images of (B\p{N}+) arrived$/u;
/** The wake's note of a task that waited for images (awaits): woken by its own book — right then and now. */
const WAITED_FOR_IMAGES = /^\p{N}+ images? of (B\p{N}+) registered \(it waited for images /u;

/** Why images of `book` should not have woken the task as it is now, or nothing when they should. */
function wrongWake(t: Task, book: string): WokenWhy | undefined {
  if (t.awaitsCheck) return "check";
  const kind = waitKindOf(t);
  return (kind === "letter" || kind === "family" || kind === "web") && !(t.waitingOn ?? "").includes(book) ? kind : undefined;
}

/** Tasks the registered images of a book woke though they waited for somebody's answer. */
export function wokenWaitFixes(tree: Tree): WokenWaitFindings {
  const out: WokenWaitFindings = { fixes: [], left: [] };
  // only a wake by images keeps what it waited on (any other change takes it away): nothing else needs the history read
  const candidates = tree.list<Task>("task").filter((t) => (t.state === "open" || t.state === "doing") && !t.retracted && (t.awaitsCheck || t.waitingOn));
  if (!candidates.length) return out;
  const ids = new Set(candidates.map((t) => t.id));
  const opsOf = new Map<string, Op[]>();
  for (const o of tree.readOps())
    for (const id of o.targets)
      if (ids.has(id)) {
        const list = opsOf.get(id) ?? [];
        list.push(o);
        opsOf.set(id, list);
      }
  for (const t of candidates.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))) {
    const ops = (opsOf.get(t.id) ?? []).sort((a, b) => a.at.localeCompare(b.at));
    const wakeAt = ops.findLastIndex((o) => o.op === "task.wake" && IMAGE_WAKE.exec(o.summary)?.[1] === t.id);
    if (wakeAt < 0) continue;
    const wake = ops[wakeAt]!;
    const book = IMAGE_WAKE.exec(wake.summary)![2]!;
    // a task that waited for images of that book: woken by it, right
    if (t.notes.some((n) => WAITED_FOR_IMAGES.exec(n.text)?.[1] === book)) continue;
    const why = wrongWake(t, book);
    if (!why) continue;
    if (wakeAt < ops.length - 1 || t.state !== "open") {
      out.left.push({ task: t.id, what: t.what, subject: [...t.subject], recordset: book, why });
      continue;
    }
    // the request sent, as the history last said it before the wake (strom task sent, not taken back, not waiting anew)
    const before = ops.slice(0, wakeAt).findLast((o) => o.op === "task.sent" || o.op === "task.unsent" || o.op === "task.wait");
    out.fixes.push({
      task: t.id,
      what: t.what,
      subject: [...t.subject],
      recordset: book,
      woken: wake.at,
      why,
      ...(before?.op === "task.sent" ? { sent: { at: before.at, by: before.by } } : {}),
      updated: t.updated,
    });
  }
  return out;
}

/** Tasks woken by images though they waited for somebody's answer (strom check: woken-wait). */
export function wokenWaits(tree: Tree): { count: number; first?: string } {
  const f = wokenWaitFixes(tree).fixes;
  return { count: f.length, ...(f.length ? { first: f[0]!.task } : {}) };
}

function readFile(tree: Tree): WokenFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...WOKEN_WAITS_FILE.split("/")), "utf8")) as Partial<WokenFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const fileContent = (f: WokenFile) => JSON.stringify(f, null, 2) + "\n";

/**
 * The fix: each task found waiting again as it waited (what it waits on and the site to check as the wake kept them,
 * the request sent put back) — one operation, what it changed kept for its undo. One changed since it was found is left
 * and counted. Inside withTreeLock.
 */
export function applyWokenWaits(tree: Tree, items: WokenWaitFix[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; left: number } {
  const at = now();
  const records: Task[] = [];
  const done: WokenWaitFix[] = [];
  let left = 0;
  for (const it of items) {
    const was = tree.get<Task>(it.task);
    if (!was || was.state !== "open" || was.updated !== it.updated) {
      left++;
      continue;
    }
    const x: Task = { ...structuredClone(was), state: "waiting", ...(it.sent ? { sent: { ...it.sent } } : {}), updated: at };
    records.push(x);
    done.push(it);
  }
  if (!done.length) return { changed: 0, records: 0, left };
  const file = readFile(tree);
  file.runs.push({ at, version, items: done });
  tree.putMany(
    records,
    [{ rel: WOKEN_WAITS_FILE, content: fileContent(file) }],
    { op: "wokenwait.fix", targets: records.map((r) => r.id).sort(), summary: `tasks images woke though they waited for somebody's answer set waiting again: ${done.length} in ${records.length} records (fix woken-waits)` },
    config,
  );
  return { changed: done.length, records: records.length, left };
}

/** What the fix set waiting again and is not undone yet. */
export function wokenWaitsDone(tree: Tree): WokenWaitFix[] {
  return readFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each task back in the queue as the wake left it — where still as the fix left it (waiting, nothing
 * changed since); one changed since is left and counted. One operation; what the fix kept is emptied.
 */
export function undoWokenWaits(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const file = readFile(tree);
  if (!file.runs.some((r) => r.items.length)) return { restored: 0, records: 0, left: 0 };
  const records: Task[] = [];
  let left = 0;
  for (const run of [...file.runs].reverse())
    for (const it of run.items) {
      const was = tree.get<Task>(it.task);
      if (!was || was.state !== "waiting" || was.updated !== run.at || records.some((r) => r.id === it.task)) {
        left++;
        continue;
      }
      const x = structuredClone(was);
      x.state = "open";
      if (it.sent) delete x.sent;
      x.updated = it.updated;
      records.push(x);
    }
  tree.putMany(
    records,
    [{ rel: WOKEN_WAITS_FILE, content: fileContent({ v: 1, runs: [] }) }],
    { op: "wokenwait.unfix", targets: records.map((r) => r.id).sort(), summary: `tasks set waiting again back in the queue as images woke them: ${records.length} in ${records.length} records${left ? `, ${left} changed since left` : ""} (fix woken-waits undone)` },
    config,
  );
  return { restored: records.length, records: records.length, left };
}
