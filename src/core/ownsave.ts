// An image of a task the agent's own browser was to save (strom media save: the task waits for it, the browser's file
// brings it back) and that never came: found in a live run — the page of the image was refused by the hook (the site's
// pages used up), the script never ran, the session ended and the task stayed waiting for ever, out of the queue, its
// wait woken by nothing (no file comes). So a session closing (its agent's close, an interruption, a takeover) puts
// such a task back in the queue with a note of the images left — never handed to the person; and such a save is never
// said held back by the browser (the person asked to allow downloads of a page that never opened).

import fs from "node:fs";
import path from "node:path";
import type { Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { findDownload, loadSaves, type SaveRecord } from "./browser.ts";
import { folderFiles, registeredImages } from "./inboxwait.ts";
import { parseImageList } from "./media.ts";
import { siteRefusedSince, webDomain } from "./metrics.ts";

/**
 * The saves through the agent's browser a waiting task still waits for, when they are all it waits for and none of them
 * came or is on its way: no file in the downloads folder (nor one being written), none in the task's folder, none said
 * held back by the browser (that one is the person's: allowing the downloads). Else undefined: the wait stays.
 */
export function unsavedOwnWait(tree: Tree, t: Task, o: { shared: string | undefined; downloads: string | undefined }): SaveRecord[] | undefined {
  if (t.state !== "waiting" || !t.awaits?.recordset) return undefined;
  const b = t.awaits.recordset;
  const saves = loadSaves(tree.root).filter((r) => r.task === t.id && r.recordset === b && r.taken === undefined);
  if (!saves.length) return undefined;
  const have = registeredImages(tree, b);
  const missing = (parseImageList(t.awaits.images) ?? []).filter((n) => !have.has(n) || saves.some((r) => r.n === n && r.again));
  const mine = saves.filter((r) => missing.includes(r.n));
  // an image it waits for that no save of the agent's browser is for (the person's hand): the wait is theirs
  if (!missing.length || missing.some((n) => !mine.some((r) => r.n === n))) return undefined;
  if (mine.some((r) => r.held)) return undefined;
  if (o.downloads && mine.some((r) => { const d = findDownload(o.downloads!, r.file); return !!d.file || !!d.unfinished; })) return undefined;
  const dir = o.shared && t.awaits.folder ? path.join(o.shared, "inbox", t.awaits.folder) : undefined;
  if (dir && fs.existsSync(dir) && folderFiles(dir).length > 0) return undefined;
  return mine;
}

/** A save whose page the hook refused since it was given, with none of its site let through since: its script never ran. */
export function saveNeverOpened(tree: Tree, r: SaveRecord): boolean {
  return siteRefusedSince(tree.root, webDomain(r.host), r.at);
}

/**
 * A waiting task whose every image still missing is one its agent's browser was given a script for (strom media save)
 * and that was not taken yet — the agent's own work, not the person's: which images are missing (in order), the saves of
 * them, and those the browser held back (the person's: allowing the downloads). Else undefined (an image the person is
 * to save, a range the archive stopped — its saves gone —, nothing missing).
 */
export interface AgentSaveWait {
  recordset: string;
  missing: number[];
  saves: SaveRecord[];
  held: SaveRecord[];
}

export function agentSaveWait(tree: Tree, t: Task, all?: SaveRecord[]): AgentSaveWait | undefined {
  if (t.state !== "waiting" || !t.awaits?.recordset || t.proposal) return undefined;
  const b = t.awaits.recordset;
  const saves = (all ?? loadSaves(tree.root)).filter((r) => r.task === t.id && r.recordset === b && r.taken === undefined);
  if (!saves.length) return undefined;
  const have = registeredImages(tree, b);
  const missing = (parseImageList(t.awaits.images) ?? []).filter((n) => !have.has(n) || saves.some((r) => r.n === n && r.again));
  if (!missing.length || missing.some((n) => !saves.some((r) => r.n === n))) return undefined;
  const mine = saves.filter((r) => missing.includes(r.n));
  return { recordset: b, missing: [...new Set(missing)].sort((x, y) => x - y), saves: mine, held: mine.filter((r) => r.held) };
}

/** Between two images the agent saves one by one its task is back at work a while: still saving (minutes). */
const SAVING_GAP_MS = 10 * 60_000;

/** What the agent's browser saves for a session's task now, as the Strom app is told it (working[].saving). */
export interface SavingView {
  recordset: string;
  /** The images given to the browser in this session and taken. */
  saved: number;
  /** All the images given to the browser in this session. */
  of: number;
}

/**
 * What the agent's browser saves for its session's task now (feature working.saving): the book, of the images given to
 * it since the session started how many came (saved of of) — while the task waits for them (none held back by the
 * browser: that one waits for the person), or is back at work between two of them a while. Else undefined.
 */
export function savingView(tree: Tree, s: { started: string }, t: Task | undefined, all?: SaveRecord[], now = Date.now()): SavingView | undefined {
  if (!t || (t.state !== "waiting" && t.state !== "open" && t.state !== "doing")) return undefined;
  const since = Date.parse(s.started);
  const saves = (all ?? loadSaves(tree.root)).filter((r) => r.task === t.id && (!Number.isFinite(since) || r.at >= since));
  if (!saves.length) return undefined;
  if (t.state === "waiting") {
    const own = agentSaveWait(tree, t, all);
    if (!own || own.held.length) return undefined;
  } else if (now - Math.max(...saves.map((r) => Math.min(r.at, now))) > SAVING_GAP_MS) return undefined;
  const latest = saves.reduce((a, b) => (b.at > a.at ? b : a));
  const book = saves.filter((r) => r.recordset === latest.recordset);
  return { recordset: latest.recordset, saved: new Set(book.filter((r) => r.taken !== undefined).map((r) => r.n)).size, of: new Set(book.map((r) => r.n)).size };
}
