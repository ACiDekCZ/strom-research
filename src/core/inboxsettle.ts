// A task's folder of the inbox that settled (spec 141, K1.3, K1.5): the person saved nothing more for a long while.
// Files whose names are no images' numbers (a portal's entries "001-004.jpg", screenshots not as many as missing) are
// taken then in the folder's order, and a task a part of whose images came goes back to its agent with what came and
// what is missing — never while the person still saves (a slow download, a pause between two batches), never while the
// agent's own browser still saves for it, never a task nothing came for.

import fs from "node:fs";
import path from "node:path";
import type { Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { loadSaves } from "./browser.ts";
import { imagesIndex } from "./mediaindex.ts";
import { parseImageList } from "./media.ts";
import { againPending, awaitedMissing, bookTimes, folderBusy, folderFiles, inboxWaits, numberFiles, registeredImages, type InboxWait } from "./inboxwait.ts";

/**
 * How long a folder lies untouched before it counts as settled: far longer than a slow scan saved by hand (half a
 * minute to three) or a pause between two of them. STROM_INBOX_QUIET_MS only for tests.
 */
export const QUIET_MS = 20 * 60_000;

export function quietMs(env: Record<string, string | undefined> = process.env): number {
  const v = Number(env.STROM_INBOX_QUIET_MS);
  return Number.isFinite(v) && v >= 0 && env.STROM_INBOX_QUIET_MS !== undefined && env.STROM_INBOX_QUIET_MS !== "" ? v : QUIET_MS;
}

/** QUIET_MS in whole minutes, as said. */
export function quietMinutes(env: Record<string, string | undefined> = process.env): number {
  return Math.max(1, Math.round(quietMs(env) / 60_000));
}

/** When the tasks of a folder began to wait (`awaits.since`; one set waiting before it was written: its last change). */
function waitedSince(tree: Tree, ws: InboxWait[]): number {
  let since = 0;
  for (const w of ws) {
    const t = tree.get<Task>(w.task);
    const at = Date.parse(t?.awaits?.since ?? t?.updated ?? "");
    if (Number.isFinite(at) && at > since) since = at;
  }
  return since;
}

/** The time of a file or folder last changed (its content or its place: a file copied keeps its old time, not its ctime). */
function touched(p: string): number {
  try {
    const st = fs.statSync(p);
    return Math.max(st.mtimeMs, st.ctimeMs);
  } catch {
    return 0;
  }
}

/** The agent's own browser still saves for one of these tasks (strom media save, not taken yet): its saves' last time. */
function agentSaving(tree: Tree, ws: InboxWait[]): number | undefined {
  const tasks = new Set(ws.map((w) => w.task));
  const open = loadSaves(tree.root).filter((r) => tasks.has(r.task) && r.taken === undefined);
  return open.length ? Math.max(...open.map((r) => r.at)) : undefined;
}

/**
 * When the folder of these tasks counts as settled (ms): QUIET_MS after the last thing that happened for them — the
 * folder changed (a file saved, taken, moved), a file lying there written, an image of the book registered, the wait
 * begun. Undefined while the agent's browser still saves for them (its own downloads: taken as they come, B0408).
 */
export function settlesAt(tree: Tree, dir: string, files: string[], ws: InboxWait[], env: Record<string, string | undefined> = tree.env): number | undefined {
  if (agentSaving(tree, ws) !== undefined) return undefined;
  const last = Date.parse(imagesIndex(tree).sets.get(ws[0]!.recordset)?.last ?? "");
  let at = Math.max(touched(dir), waitedSince(tree, ws), Number.isFinite(last) ? last : 0);
  for (const f of files) at = Math.max(at, touched(f));
  return at + quietMs(env);
}

/** Whether the folder settled by `now`. */
export function settled(tree: Tree, dir: string, files: string[], ws: InboxWait[], now = Date.now(), env: Record<string, string | undefined> = tree.env): boolean {
  const at = settlesAt(tree, dir, files, ws, env);
  return at !== undefined && now >= at;
}

/**
 * The tasks of a settled folder that go back to their agent (K1.5): each waiting for images by their numbers, some of
 * which are missing, with an image of the book registered since it began to wait — a task nothing came for waits on.
 * With what came and what is missing, for its note.
 */
export function backAfterQuiet(tree: Tree, ws: InboxWait[], have: ReadonlySet<number>): { task: string; want: number[]; came: number[]; missing: number[] }[] {
  const last = Date.parse(imagesIndex(tree).sets.get(ws[0]!.recordset)?.last ?? "");
  const out: { task: string; want: number[]; came: number[]; missing: number[] }[] = [];
  let pending: Set<string> | undefined;
  for (const w of ws) {
    const t = tree.get<Task>(w.task);
    if (!t || t.state !== "waiting" || !t.awaits) continue;
    const want = parseImageList(t.awaits.images) ?? [];
    // an image saved once more is missing till its new copy came (awaitedMissing)
    const missing = awaitedMissing(tree, t, want, { have, pending: (pending ??= againPending(tree)) });
    if (!want.length || !missing.length) continue;
    const since = Date.parse(t.awaits.since ?? t.updated);
    if (!Number.isFinite(last) || !(last >= since)) continue;
    out.push({ task: t.id, want, came: want.filter((n) => !missing.includes(n)), missing });
  }
  return out;
}

/**
 * The folders of the shared inbox whose waiting tasks have something to do now that they settled (the bridge looks at
 * them once more though nothing in them changed): files named not by the images' numbers lying there to be taken in
 * the folder's order, or a task a part of whose images came to go back. The same tests the take makes (commands/media.ts
 * takeWaiting): once done, never due again.
 */
export function dueAfterQuiet(tree: Tree, shared: string, now = Date.now(), env: Record<string, string | undefined> = tree.env): Set<string> {
  const by = new Map<string, InboxWait[]>();
  for (const w of inboxWaits(tree)) by.set(w.folder.normalize("NFC"), [...(by.get(w.folder.normalize("NFC")) ?? []), w]);
  const due = new Set<string>();
  for (const ws of by.values()) {
    const w = ws[0]!;
    const dir = path.join(shared, "inbox", w.folder);
    if (!fs.existsSync(dir)) continue;
    const files = folderFiles(dir);
    if (files.length && folderBusy(dir, files, now)) continue;
    if (!settled(tree, dir, files, ws, now, env)) continue;
    const have = registeredImages(tree, w.recordset);
    const asked = ws.some((x) => x.want?.length) ? [...new Set(ws.flatMap((x) => x.want ?? []))] : undefined;
    const later = files.length > 0 && "later" in numberFiles(files, asked, have, w.recordset, bookTimes(tree, w.recordset));
    if (later || backAfterQuiet(tree, ws, have).length) due.add(dir);
  }
  return due;
}
