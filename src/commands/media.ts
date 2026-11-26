// media add · list · show · view — scans and photos of records.
//
// An image is registered once (its content hash is its identity), stored in
// the shared media store, and tied to its record set and image number. It is
// looked at only through views; only a registered image can be cited.

import fs from "node:fs";
import path from "node:path";
import { register, type Typed } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { counted, lines, moreLine, paginate, runs, runsArg, shellArg, table, truncate } from "../cli/format.ts";
import { notFound, UsageError } from "../core/errors.ts";
import type { Clip, Input, Media, RecordSet, Region, Repository, Source, Task } from "../core/model.ts";
import { makeNote, makeNotes } from "../core/actions.ts";
import { clipText, collectFiles, numberInName, coveringPart, inboxFolderFor, fileSha256, findImage, framedApart, imageNumbers, imageOfRef, imageRange, IMAGE_FILE_EXT, inboxFolders, inputPath, isWhole, mediaMime, mimeOfFile, onlyParts, otherCopies, parseImageList, regionText, screenshotNamed, sharperCover, storeExtOf, storeShared, wholeSizeOf, type SharperCover } from "../core/media.ts";
import { create, listOpt, normId, requireRecord, update } from "../core/records.ts";
import { exifOrientation, imageSizeOfFile } from "../image/index.ts";
import { fileToShown, shownToFile, turnsAcross } from "../image/image.ts";
import { imageOf, pageOf } from "../core/calibration.ts";
import { cropOf, describeView, ENLARGED_HINT, halves, makeView, mediaOrient, OVERVIEW_HINT, parseCrop, partRegion, partShown, readInHalves, REDUCED_HINT, SHARPER_SCAN, viewLine, viewRegion, viewSize, type View, type ViewMeta, type ViewSpec } from "../core/views.ts";
import { IMAGE_MAX, IMAGE_MAX_LARGE, OVERVIEW_MAX } from "../agents/images.ts";
import { viewSizesFor, type ViewSizes } from "../core/viewsizes.ts";
import { PROFILES } from "../agents/profiles.ts";
import { detectAgent } from "../core/which.ts";
import { waitKindOf } from "../core/waitkind.ts";
import { byHandOnly, listConnectors, missingConsents } from "../core/connector.ts";
import { now, type Tree } from "../core/tree.ts";
import { bookTuned, bookViewSizes, readingOf, treeTuning, tuningOn, type TuneState } from "../core/tune.ts";
import { READING_DEFAULTS } from "../core/readstats.ts";
import { currentSession } from "../core/session.ts";
import { knownOriginal, parseRegion, takeOriginal } from "../core/originals.ts";
import { workingCopyOf } from "../core/material.ts";
import { makeThumb, THUMB_SIZES } from "../core/thumbs.ts";
import { batchPath } from "../core/batches.ts";
import { fileBy, handFiles, taskForFile, taskPeople } from "../core/taskfiles.ts";
import { againPending, awaitedMissing, askedNow, bookFolders, bookTimes, folderFiles, handedImages, inboxState, inboxWaitOf, inboxWaits, numberBookFiles, numberFiles, numbersForTask, registeredImages, type Numbered, SETTLE_MS, unsettled, webWaitBook, DOWNLOADING, folderBusy, STALLED_MS, asideFiles, type AsideFile, type InboxWait } from "../core/inboxwait.ts";
import { formatOf } from "../image/index.ts";
import { pdfScans } from "../image/pdf.ts";
import { readableFile } from "../core/readable.ts";
import { countUnknownAfterSave, liveBook } from "../core/books.ts";
import { HELD_AFTER_MS, PLAN_TTL_MS, STOPS_FILE, TAKEN_KEEP_MS, findDownload, loadPlans, loadSaves, loadStops, noteSave, noteStop, parseRangeResult, rangeScript, saveScript, savePagesScript, SAVE_PAGES_MAX, storeSaves, storeStops, waitFileBase, type RangeItem, type RangeStop, type SaveRecord } from "../core/browser.ts";
import { bookOn, browserGate, hostBlocked, netDirOf, otherWay, type WebGate } from "../core/webgate.ts";
import { allows, browserRangeOf } from "../core/terms.ts";
import { browserStopped, clockUp, HUMAN_PACE, reserveSlots } from "../core/net.ts";
import { phrase } from "../core/phrases.ts";
import { browserKept, withoutBrowserReason } from "../core/browserhelp.ts";
import { goesAhead } from "../core/queue.ts";
import { localDayOf } from "../core/readers.ts";
import { scanLikeness } from "../core/samescan.ts";
import { backAfterQuiet, quietMinutes, settled, settlesAt } from "../core/inboxsettle.ts";
import { entriesOf, entriesText, fileName, sheetNamed } from "../core/scannames.ts";
import { partOf } from "../core/findpart.ts";
import { moveToTrash } from "../core/trash.ts";
import { recordsBySha } from "../core/shaindex.ts";
import { jobsOf, takeBatchFile, takeQueued } from "../core/mediaqueue.ts";
import { saveNeverOpened } from "../core/ownsave.ts";
import { pageShownSince } from "../core/chromehook.ts";

const IMAGE_EXT = IMAGE_FILE_EXT;

/** The first bytes of a file — enough for the image size, without reading a 20 MB scan. */
/** One image to register: the file, its number in the book, where it is from. */
export interface NewImage {
  file: string;
  image?: number | undefined;
  url?: string | undefined;
  from: string;
  /** A part of the image, fetched sharper: where it is in the whole image. */
  part?: Region | undefined;
  fetched?: { connector: string; book: string; via?: "browser" } | undefined;
}

/**
 * Register images of a record set: stored once by content, each with its number
 * and provenance. Tasks that waited for images of the book go back into the queue.
 */
export function registerImages(tree: Tree, shared: string, items: NewImage[], recordset: string | undefined, opts: { wake?: boolean; ahead?: string } = {}): { added: Media[]; again: string[]; restored: string[]; woken: string[]; clashes: string[]; copies: string[]; clashed: { file: string; same: string }[] } {
  // a withdrawn image is no longer known: its file can be registered again, where it belongs
  const known = new Map(tree.list<Media>("media").filter((m) => !m.retracted).map((m) => [m.sha, m]));
  const added: Media[] = [];
  const again: string[] = [];
  const restored: string[] = [];
  const clashes: string[] = [];
  // the files of those clashes, with the image each is the same file as
  const clashed: { file: string; same: string }[] = [];
  const copies: string[] = [];
  tree.withTreeLock(() => {
    for (const it of items) {
      const sha = fileSha256(it.file);
      const k = known.get(sha);
      if (k && !tree.dryRun && !fs.existsSync(path.join(shared, k.file))) {
        // its file is not here (a research handed over without its images): the same scan, put back where it was
        fs.mkdirSync(path.dirname(path.join(shared, k.file)), { recursive: true });
        fs.copyFileSync(it.file, path.join(shared, k.file));
        restored.push(k.id);
        continue;
      }
      if (k) {
        again.push(k.id);
        // the same scan as another image: a portal serving another book's images, or a file given the wrong number
        // compared as kept; said as the agent gives it (a part of a photo turned by its EXIF: of the picture upright)
        const as = (m: { recordset?: string | undefined; image?: number | undefined; part?: Region | undefined }, part = m.part) =>
          `${m.recordset ?? "no record set"}${m.image !== undefined ? `:${m.image}` : ""}${part ? ` part ${regionText(part)}` : ""}`;
        const said = (m: { recordset?: string | undefined; image?: number | undefined; part?: Region | undefined }) => as(m, partShown(shared, [...known.values()], m));
        // a portal whose sharpest part is the whole scan gives the image again: that is no clash
        const sameScan = k.recordset === recordset && k.image === it.image && isWhole(k.part) && isWhole(it.part);
        if (!sameScan && as(k) !== as({ recordset, image: it.image, part: it.part })) {
          clashes.push(`${said({ recordset, image: it.image, part: it.part })} is the same file as ${k.id} (${said(k)}) — not registered again: the portal may have given another book's image, or a number is wrong; check before citing either`);
          clashed.push({ file: it.file, same: k.id });
        }
        continue;
      }
      // a file set aside ("33.jpg.other-than-M0003", strom media aside --take): its type by its content or the name it
      // was saved under, kept under that type's extension (1124) — never "application/octet-stream" of a name that says none
      const mime = mimeOfFile(it.file, it.from);
      const stored = tree.dryRun ? it.file : storeShared(shared, it.file, sha, storeExtOf(it.file, mime));
      const size = imageSizeOfFile(it.file);
      const m = create<Media>(
        tree,
        "media",
        {
          sha,
          file: path.relative(shared, stored).split(path.sep).join("/"),
          mime,
          size: fs.statSync(it.file).size,
          ...(size ? { width: size.width, height: size.height } : {}),
          recordset,
          image: it.image,
          part: it.part,
          url: it.url,
          from: it.from,
          // a portal naming its scans by the entries on them (001-004.jpg, spec 141): what the name says, kept
          entries: entriesOf(it.file),
          fetched: it.fetched,
          accessed: new Date().toISOString().slice(0, 10),
        },
        (id) => `+${id} ${it.part ? `part ${regionText(partShown(shared, [...known.values()], { recordset, image: it.image, part: it.part })!)} of image` : "image"}${it.image !== undefined ? ` ${it.image}` : ""}${recordset ? ` of ${recordset}` : ""}`,
        recordset ? [recordset] : [],
      );
      known.set(sha, m);
      added.push(m);
      // another copy of an image already there (a reduced download, then the full one): the sharpest is the image
      const others = otherCopies([...known.values()], m);
      if (others.length && recordset && it.image !== undefined) {
        const best = findImage([...known.values()], recordset, it.image)!;
        const size = (x: Media) => (x.width ? ` ${x.width}×${x.height}` : "");
        const pixels = (x: Media) => (x.width ?? 0) * (x.height ?? 0);
        // the image ahead of a screenshot of more pixels (1124): said why
        const screens = [m, ...others].filter((x) => x.id !== best.id && pixels(x) > pixels(best) && framedApart(x, best));
        const why = screens.length ? ` (${screens.map((x) => x.id).join(", ")}: a screenshot of another frame, not a sharper scan)` : "";
        copies.push(
          `${recordset}:${it.image} has ${others.length + 1} copies — ${best.id === m.id ? `${m.id}${size(m)} is ${why ? "the image now" : "the sharpest: it is the image now"}` : `${best.id}${size(best)} is ${why ? "the image and stays it" : "sharper and stays the image"}`}${why}; views of the others use it (${others.map((x) => `${x.id}${size(x)}`).join(", ")})`,
        );
        // the new copy is the image, the one a source cites is another: the move offered, never made unasked
        if (best.id === m.id) copies.push(...citesOffer(tree, others, m));
      }
    }
  });
  // a fetch registering its images in batches wakes the tasks once, when it is over (wakeWaiting)
  const woken = recordset && opts.wake !== false ? wakeWaiting(tree, recordset, added.length, opts.ahead ? { ahead: opts.ahead } : {}) : [];
  return { added, again, restored, woken, clashes, copies, clashed };
}

/**
 * Tasks that waited for images of a book back in the queue, now that this many of them are registered. One that asked
 * for images by their numbers comes back once all of them are there (a part: it waits on — core/inboxwait.ts says
 * which are missing); a site the person looks at, by images of the book its words name or of the one book it works in.
 * `ahead` (the person's own images: saved into the inbox, sent from the Strom app — the time it is written with): a task
 * that waited for images of the book (its numbers, a site with the book) goes ahead in the queue as strom task order
 * next does, once (core/queue.ts goesAhead) — all woken at once with the one time, among them the queue's own order.
 */
export function wakeWaiting(tree: Tree, recordset: string, count: number, o: { except?: string; ahead?: string } = {}): string[] {
  const woken: string[] = [];
  let ahead: ((t: Task) => boolean) | undefined;
  // a task that waits for images of a book is woken by that book alone, whatever other books it names; the person's
  // check of a site never (only the person answers it, as an archive's decision leaves it: core/archivewait.ts);
  // somebody's answer (a letter, the family) only by the book it waits on, never by a book it merely works in; a site
  // the person looks at also by the book it is to be searched in, else the one book it works in (the images saved there
  // are what it waited for)
  const wakes = (t: Task, b: string) => {
    if (t.awaits) return t.awaits.recordset === b;
    const kind = waitKindOf(t);
    if (kind === "check" || t.awaitsCheck) return false;
    const named = (t.waitingOn ?? "").includes(b);
    if (kind === "web") return named || webWaitBook(tree, t)?.id === b;
    return kind === "letter" || kind === "family" ? named : named || t.where.includes(b);
  };
  if (count) {
    const have = registeredImages(tree, recordset);
    const pending = againPending(tree);
    for (const t of tree.list<Task>("task").filter((t) => t.state === "waiting" && t.id !== o.except && wakes(t, recordset))) {
      const want = t.awaits ? (parseImageList(t.awaits.images) ?? []) : [];
      // a part of the images asked for: it waits on for the rest (one saved once more: for its new copy)
      if (awaitedMissing(tree, t, want, { have, pending }).length) continue;
      // what it asked for, for the session that takes it up
      const note = `${counted(count, "image")} of ${recordset} registered${t.awaits ? ` (it waited for images ${t.awaits.images})` : ""}`;
      // the person's own images of a task that waited for them: ahead in the queue, once (a letter, the family: never)
      const next = !!o.ahead && (!!t.awaits || waitKindOf(t) === "web") && (ahead ??= goesAhead(tree))(t);
      update<Task>(tree, t.id, "task", (x) => {
        const { awaits: _, wait: _w, sent: _s, ...rest } = x;
        return { ...rest, state: "open", notes: [...x.notes, makeNote(tree, note)], ...(next ? { queueAt: { do: "next" as const, at: o.ahead! } } : {}) };
      }, {
        op: "task.wake",
        summary: `${t.id} wake: images of ${recordset} arrived${next ? " from the person — next in the queue, once" : ""}`,
      });
      woken.push(t.id);
    }
  }
  return woken;
}

/** What strom took of a folder of the shared inbox a task waits on. */
export interface TakenFolder {
  folder: string;
  recordset: string;
  /** The tasks waiting on it. */
  tasks: string[];
  /** Image numbers registered now. */
  added: number[];
  /** Numbered by their order (the names gave no number asked for). */
  byOrder?: boolean;
  /** Named not by the images' numbers (spec 141 K1.3): taken in the folder's order once it settles at this time (ms). */
  later?: number;
  /** Taken in the folder's order, the folder settled (K1.3): each file and the image it is now, with its entries. */
  byFolder?: string[];
  /** Files left lying, their names give no image's number (K1.1): each with why. */
  lying?: string[];
  /** The tasks back with a part of their images, the folder settled (K1.5). */
  back?: string[];
  /** Another sheet under a number (007a.jpg, spec 141 K1.4): what it was told to be by its content, one line each. */
  sheets?: string[];
  woken: string[];
  /** Of the images asked for, still missing after it. */
  missing: number[];
  /** Why nothing was taken (what the files need). */
  problem?: string;
  /** Files still being written: taken on the next look. */
  settling?: number;
  /** An image with several copies now (one saved once more): which one is the image. */
  copies?: string[];
  /** The folder of a book the tasks need, no task waiting on it (K1.4): its tasks read the images from disk now. */
  book?: true;
  /** Of a book's folder: files left lying, no image number in the name (taken once named by it). */
  left?: number;
  /** Files that are the same scan as another image registered already: set aside, never deleted (B0408) — what each is. */
  aside?: string[];
  /** The images withdrawn (kept) for a scan saved once more through the agent's browser (strom media save --again). */
  replaced?: string[];
}

/**
 * What the person saved into the folders of tasks that wait (core/inboxwait.ts): each folder with files that settled
 * taken whole — registered as images of its book, numbered by their names or their order, the files moved into the store
 * — and the tasks it completes back in the queue. A folder that is not there yet is made (an older wait). Then the
 * folders of the books tasks still need that no task waits on (spec 105 K1.4, core/inboxwait.ts bookFolders): taken by
 * the numbers in their names alone, never made. Never another folder, never the inbox as a whole. `folder`: that one alone.
 *
 * Under the tree's lock from the first look at the folders to the last file registered: another strom taking them at
 * the same moment (the bridge, the agent's own command) finds them taken — nothing to take, never a file gone under it.
 */
export function takeWaiting(tree: Tree, shared: string, o: { now?: number; folder?: string; downloads?: string } = {}): TakenFolder[] {
  return tree.dryRun ? takeWaitingNow(tree, shared, o) : tree.withTreeLock(() => takeWaitingNow(tree, shared, o));
}

function takeWaitingNow(tree: Tree, shared: string, o: { now?: number; folder?: string; downloads?: string }): TakenFolder[] {
  const out: TakenFolder[] = [];
  const byFolder = new Map<string, InboxWait[]>();
  // what the agent's browser saved (strom media save) is the agent's download, not the person's images
  const agents = o.downloads && !tree.dryRun ? fromDownloads(tree, shared, o.downloads, inboxWaits(tree)) : new Map<string, string>();
  // the tasks the person's images wake in this look go ahead in the queue, all with one time (core/queue.ts goesAhead)
  const at = new Date().toISOString();
  let saves: SaveRecord[] | undefined;
  /** A file the person saved by hand: not moved from the downloads now, no image a save of the agent's browser was for. */
  const persons = (ws: InboxWait[], files: string[], numbers: number[]) =>
    files.some((f, i) => !agents.has(path.resolve(f)) && !(saves ??= loadSaves(tree.root)).some((r) => r.recordset === ws[0]!.recordset && r.n === numbers[i] && ws.some((x) => x.task === r.task)));
  for (const w of inboxWaits(tree)) {
    const key = w.folder.normalize("NFC");
    if (o.folder && key !== o.folder.normalize("NFC")) continue;
    byFolder.set(key, [...(byFolder.get(key) ?? []), w]);
  }
  for (const ws of byFolder.values()) {
    const w = ws[0]!;
    const dir = path.join(shared, "inbox", w.folder);
    if (!fs.existsSync(dir)) {
      if (!tree.dryRun) fs.mkdirSync(dir, { recursive: true });
      continue;
    }
    const files = folderFiles(dir);
    const base = { folder: w.folder, recordset: w.recordset, tasks: ws.map((x) => x.task) };
    if (!files.length) {
      // nothing lying there: a task a part of whose images came goes back once the folder settled (spec 141 K1.5)
      const back = backWhenSettled(tree, dir, files, ws, o.now, at);
      if (back) out.push({ ...base, added: [], ...back });
      continue;
    }
    // the whole batch settled: no file still written, no download of the browser still running in it (B0408)
    const busy = folderBusy(dir, files, o.now);
    if (busy) {
      out.push({ ...base, added: [], woken: [], missing: [], settling: busy });
      continue;
    }
    // what the tasks of the folder asked for, together
    const asked = ws.some((x) => x.want?.length) ? [...new Set(ws.flatMap((x) => x.want ?? []))].sort((a, b) => a - b) : undefined;
    const before = registeredImages(tree, w.recordset);
    const numbered = numberFiles(files, asked, before, w.recordset, bookTimes(tree, w.recordset), { quiet: settled(tree, dir, files, ws, o.now) });
    // of what they asked for, what is missing: not registered, or saved once more and its new copy not here (awaitedMissing)
    const lacking = () => (asked ?? []).filter((n) => !before.has(n) || ws.some((x) => awaitedMissing(tree, x.task, [n], { have: before }).length));
    if ("problem" in numbered) {
      out.push({ ...base, added: [], woken: [], missing: lacking(), problem: numbered.problem });
      continue;
    }
    // named not by the images' numbers (entries, as many otherwise): in the folder's order once it settled (K1.3)
    if ("later" in numbered) {
      out.push({ ...base, added: [], woken: [], missing: lacking(), later: settlesAt(tree, dir, files, ws) ?? 0 });
      continue;
    }
    // what lies there unnumbered (000.jpg) stays, never holding back the rest (K1.1)
    if (numbered.files) files.splice(0, files.length, ...numbered.files);
    // another sheet under one number (007a.jpg beside 007.jpg): a copy, a zoomed-in part or a scan of its own (K1.4)
    const sheets = numbered.by === "names" ? takeSheets(tree, shared, w.recordset, files, numbered.numbers) : [];
    // a file the agent's browser saved keeps the name strom gave it as where it is from: a copy saved properly, never
    // taken for a screenshot beside another copy (core/media.ts savedProperly)
    const from = files.map((f) => agents.get(path.resolve(f)) ?? path.basename(f));
    const r = takeFiles(tree, shared, w, files, numbered.numbers, { otherScans: true, tasks: ws.map((x) => x.task), from, ...(persons(ws, files, numbered.numbers) ? { ahead: at } : {}) });
    const after = registeredImages(tree, w.recordset);
    const pending = againPending(tree);
    out.push({
      ...base,
      added: r.added.map((m) => m.image).filter((n): n is number => n !== undefined),
      ...(numbered.by === "order" ? { byOrder: true } : {}),
      woken: r.woken,
      missing: (asked ?? []).filter((n) => !after.has(n) || ws.some((x) => awaitedMissing(tree, x.task, [n], { have: after, pending }).length)),
      ...(r.copies.length ? { copies: r.copies } : {}),
      ...(r.aside.length ? { aside: r.aside.map((a) => asideLine(w, a, tree)) } : {}),
      ...(r.replaced.length ? { replaced: r.replaced } : {}),
    });
    afterTaken(tree, out.at(-1)!, { dir, ws, files, numbered, now: o.now, at, sheets });
  }
  // the folders of the books the tasks need (K1.4): what the person saved there by hand, by the numbers in the names
  for (const b of bookFolders(tree)) {
    if (o.folder && b.folder.normalize("NFC") !== o.folder.normalize("NFC")) continue;
    const files = folderFiles(path.join(shared, "inbox", b.folder));
    if (!files.length) continue;
    const base = { folder: b.folder, recordset: b.recordset, tasks: b.tasks, book: true as const };
    const busy = folderBusy(path.join(shared, "inbox", b.folder), files, o.now);
    if (busy) {
      out.push({ ...base, added: [], woken: [], missing: [], settling: busy });
      continue;
    }
    const numbered = numberBookFiles(files, b.recordset, b.times);
    // only files with no image's number lie there (000.jpg, left on purpose): nothing to take, nothing said again at
    // every look — never advice to rename them, never a task named that waits no more (spec 141 K1.1, K2.2; n1)
    if (!numbered.files.length) continue;
    // another sheet under an image's number (7a.jpg, saved after its task came back): told by its content, as in a
    // task's folder — never set aside nor hidden as a copy by its name alone (spec 141 K1.4; n1)
    const sheets = takeSheets(tree, shared, b.recordset, numbered.files, numbered.numbers);
    // the files with a number taken; one without a number stays lying, never holding back the rest
    const r = takeFiles(tree, shared, { task: "", recordset: b.recordset, folder: b.folder, by: "images" }, numbered.files, numbered.numbers, { ahead: at, otherScans: true });
    out.push({
      ...base,
      added: r.added.map((m) => m.image).filter((n): n is number => n !== undefined),
      woken: r.woken,
      missing: [],
      ...(sheets.length ? { sheets } : {}),
      ...(r.copies.length ? { copies: r.copies } : {}),
      ...(numbered.left ? { left: numbered.left } : {}),
      ...(r.aside.length ? { aside: r.aside.map((a) => asideLine(b, a, tree)) } : {}),
    });
  }
  return out;
}

/**
 * What the agent's browser saved for waiting tasks (strom media save: strom-3f2a9c1b-T0007-0040.jpg in the downloads
 * folder, this research's mark first): each file moved into its task's folder of the shared inbox, named by its image
 * number (40.jpg) — the folder is then taken as the person's own. A name given before the mark (strom-T0007-0040.jpg)
 * only where this research's record of the save gives it: the downloads folder is every research's, another one's file
 * never taken. A copy the browser saved twice (… (1).jpg): the newest kept, the rest gone. A download still running is
 * left for the next look. The files moved (their paths, each with the name the browser saved it under): the agent's
 * download, never the person's images (the queue).
 */
function fromDownloads(tree: Tree, shared: string, downloads: string, waits: InboxWait[]): Map<string, string> {
  const moved = new Map<string, string>();
  let names: string[];
  try {
    names = fs.readdirSync(downloads);
  } catch {
    return moved;
  }
  const esc = (x: string) => x.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const saves = loadSaves(tree.root);
  const got = new Map<string, string>();
  for (const w of waits) {
    const base = waitFileBase(tree.config.id, w.task, 0).slice(0, -4);
    const re = new RegExp(`^${esc(base)}(\\p{Nd}{4,})(?: \\(\\p{Nd}+\\))?\\.([\\p{L}\\p{N}]{2,5})$`, "u");
    // the names given before the research's mark, each of its image: only as this research's records give them
    const given = saves
      .filter((r) => r.task === w.task && !r.file.normalize("NFC").startsWith(base.normalize("NFC")))
      .map((r) => ({ n: r.n, re: new RegExp(`^${esc(r.file)}(?: \\(\\p{Nd}+\\))?\\.([\\p{L}\\p{N}]{2,5})$`, "u") }));
    const numberOf = (name: string): number | undefined => {
      const m = re.exec(name);
      if (m) return IMAGE_FILE_EXT.has(`.${m[2]!.toLowerCase()}`) ? Number(m[1]) : undefined;
      for (const g of given) {
        const o = g.re.exec(name);
        if (o) return IMAGE_FILE_EXT.has(`.${o[1]!.toLowerCase()}`) ? g.n : undefined;
      }
      return undefined;
    };
    const byNumber = new Map<number, string[]>();
    const still = new Set(unsettled(names.map((n) => path.join(downloads, n))));
    for (const name of names) {
      // a download still being written: the next look
      if (still.has(path.join(downloads, name))) continue;
      const n = numberOf(name.normalize("NFC"));
      if (n === undefined) continue;
      if (n < 1 || (w.want?.length && !w.want.includes(n))) continue;
      byNumber.set(n, [...(byNumber.get(n) ?? []), path.join(downloads, name)]);
    }
    if (!byNumber.size) continue;
    const dir = path.join(shared, "inbox", w.folder);
    fs.mkdirSync(dir, { recursive: true });
    // a file gone since the folder was read (the browser renaming its download, another strom taking it): not there —
    // never an error of the whole look
    const mtime = (f: string) => {
      try {
        return fs.statSync(f).mtimeMs;
      } catch {
        return undefined;
      }
    };
    for (const [n, all] of byNumber) {
      const files = all.filter((f) => mtime(f) !== undefined);
      if (!files.length) continue;
      const [newest, ...rest] = files.sort((a, b) => (mtime(b) ?? 0) - (mtime(a) ?? 0));
      const to = path.join(dir, `${n}${path.extname(newest!).toLowerCase()}`);
      try {
        fs.renameSync(newest!, to);
      } catch {
        // another disk: copied as it was saved, then gone
        try {
          const at = fs.statSync(newest!).mtime;
          fs.copyFileSync(newest!, to);
          fs.utimesSync(to, at, at);
          fs.rmSync(newest!, { force: true });
        } catch {
          continue; // gone meanwhile: the next look
        }
      }
      moved.set(path.resolve(to), path.basename(newest!).normalize("NFC"));
      for (const f of rest) fs.rmSync(f, { force: true });
      // a save once more of this image (strom media save --again): the file it came as, known by its content — taken as
      // the image at once (takeFiles), whatever other file lies there under its number
      if (saves.some((r) => r.again && r.taken === undefined && r.task === w.task && r.n === n)) got.set(`${w.task}:${n}`, fileSha256(to));
    }
  }
  if (got.size) storeSaves(tree.root, loadSaves(tree.root).map((r) => (r.again && r.taken === undefined && got.has(`${r.task}:${r.n}`) ? { ...r, got: got.get(`${r.task}:${r.n}`)! } : r)));
  return moved;
}

/** One of strom's own files of a waiting task's image in the downloads folder, still being written. */
export interface Downloading {
  task: string;
  n: number;
  name: string;
}

/**
 * strom's own files of the images waiting tasks wait for (strom media save's names, this research's mark first, or
 * the name a record of this research gives) that the browser is still writing: a download not finished (.crdownload,
 * .part, …) or a file written a moment ago (not settled). fromDownloads leaves them for the next look.
 */
export function downloadsBeingWritten(tree: Tree, downloads: string, now = Date.now()): Downloading[] {
  let names: string[];
  try {
    names = fs.readdirSync(downloads);
  } catch {
    return [];
  }
  const esc = (x: string) => x.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const tail = `(?: \\(\\p{Nd}+\\))?\\.[\\p{L}\\p{N}]{2,5}(?:\\.(?:crdownload|part|download|tmp))?$`;
  const saves = loadSaves(tree.root);
  const out: Downloading[] = [];
  // gone since the folder was read (renamed by the browser as it finished): not there
  const mtime = (name: string) => {
    try {
      return fs.statSync(path.join(downloads, name)).mtimeMs;
    } catch {
      return undefined;
    }
  };
  for (const w of inboxWaits(tree)) {
    if (w.by !== "images") continue;
    const base = waitFileBase(tree.config.id, w.task, 0).slice(0, -4);
    const re = new RegExp(`^${esc(base)}(\\p{Nd}{4,})${tail}`, "u");
    const given = saves.filter((r) => r.task === w.task && !r.file.normalize("NFC").startsWith(base.normalize("NFC"))).map((r) => ({ n: r.n, re: new RegExp(`^${esc(r.file)}${tail}`, "u") }));
    const byNumber = new Map<number, { name: string; at: number; partial: boolean }[]>();
    for (const name of names) {
      const nfc = name.normalize("NFC");
      const m = re.exec(nfc);
      const n = m ? Number(m[1]) : given.find((g) => g.re.test(nfc))?.n;
      if (n === undefined || (w.want?.length && !w.want.includes(n))) continue;
      const at = mtime(name);
      if (at === undefined) continue;
      byNumber.set(n, [...(byNumber.get(n) ?? []), { name, at, partial: DOWNLOADING.test(nfc) }]);
    }
    for (const [n, files] of byNumber) {
      // a finished file of it that settled: it is there — a partial one beside it is not waited for
      if (files.some((f) => !f.partial && now - f.at >= SETTLE_MS)) continue;
      // a download that has not grown for a long while: stopped, not being written
      const busy = files.filter((f) => (f.partial ? now - f.at < STALLED_MS : now - f.at < SETTLE_MS));
      if (busy.length) out.push({ task: w.task, n, name: busy[0]!.name });
    }
  }
  return out;
}

/**
 * Waits a moment (at most STROM_DOWNLOAD_WAIT_MS, else a few seconds: what a browser takes to finish a scan and the
 * file to settle) while strom's own files of waiting tasks are still being written in the downloads folder — only for
 * them, nothing else. Those still being written after it: said, for the next look.
 */
function waitForDownloads(tree: Tree, downloads: string, env: NodeJS.ProcessEnv): Downloading[] {
  const most = Number(env.STROM_DOWNLOAD_WAIT_MS ?? SETTLE_MS + 5_000);
  const until = Date.now() + (Number.isFinite(most) && most >= 0 ? most : SETTLE_MS + 5_000);
  for (;;) {
    const writing = downloadsBeingWritten(tree, downloads);
    if (!writing.length || Date.now() >= until) return writing;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(250, Math.max(1, until - Date.now())));
  }
}

/**
 * Files of a task's folder of the shared inbox, numbered: registered as images of its book (the tasks they complete back in
 * the queue, but `except`), the files moved into the store, the folder gone once nobody waits on it. What takes the
 * folder (takeWaiting) and what the Strom app sends for the task (takeForTask) both register so.
 */
function takeFiles(tree: Tree, shared: string, w: InboxWait, all: string[], allNumbers: number[], o: { except?: string; from?: string[]; ahead?: string; otherScans?: boolean; tasks?: string[] } = {}): ReturnType<typeof registerImages> & { aside: SetAside[]; replaced: string[] } {
  const book = tree.get<RecordSet>(w.recordset);
  // another scan under a number taken already (B0374: page 203 saved as 3.jpg): never a sharper copy of that image,
  // unsaid — set aside beside it, the user asked which one is the image (strom media aside); a sharper copy is taken
  // only when surely of the same scan (core/samescan.ts)
  const other = new Map<string, string>();
  const unsure = new Set<string>();
  // the files of saves once more (strom media save --again) of the agent's browser for these tasks, by their content
  // (core/browser.ts SaveRecord.got): the image of their number at once — the one there withdrawn and kept (one a
  // source cites stays beside it), as strom media aside --take does; never a file of the person's (1124)
  const retire = new Map<string, { n: number; task: string }>();
  if (o.otherScans && !tree.dryRun) {
    const media = tree.list<Media>("media").filter((m) => !m.retracted);
    const wholes = media.filter((m) => isWhole(m.part));
    const tasks = o.tasks ?? [w.task];
    let saves: SaveRecord[] | undefined;
    all.forEach((f, i) => {
      const kept = findImage(wholes, w.recordset, allNumbers[i]!);
      if (!kept) return;
      const sha = fileSha256(f);
      if (media.some((m) => m.sha === sha)) return; // the same file: registerImages says what it is
      const was = path.join(shared, kept.file);
      // taken as a sharper copy only when surely the same scan; unsure (nothing written to compare, a format strom does
      // not read itself) is set aside and asked as well
      if (!fs.existsSync(was)) return;
      const alike = scanLikeness(f, was);
      if (alike === "same") return;
      const again = (saves ??= loadSaves(tree.root)).find((r) => r.again && r.taken === undefined && r.got === sha && r.recordset === w.recordset && r.n === allNumbers[i] && tasks.includes(r.task));
      if (again) {
        retire.set(f, { n: allNumbers[i]!, task: again.task });
        return;
      }
      other.set(f, kept.id);
      if (alike === undefined) unsure.add(f);
    });
  }
  const replaced: string[] = [];
  for (const [f, { n, task }] of retire) {
    const sources = tree.list<Source>("source").filter((x) => !x.retracted);
    for (const m of tree.list<Media>("media").filter((x) => !x.retracted && x.recordset === w.recordset && x.image === n && isWhole(x.part))) {
      if (sources.some((x) => x.media?.includes(m.id) || x.clips?.some((c) => c.media === m.id))) continue; // what a source cites stays; the new scan beside it
      update<Media>(tree, m.id, "media", (x) => ({ ...x, retracted: { at: now(), reason: `the scan of image ${n} saved once more through the agent's browser for ${task} is the image (${path.basename(f)})` } }), {
        op: "media.retract",
        summary: `${m.id} retracted: the scan of image ${n} saved once more for ${task} is the image`,
      });
      replaced.push(m.id);
    }
  }
  const files = all.filter((f) => !other.has(f));
  const numbers = files.map((f) => allNumbers[all.indexOf(f)]!);
  const from = o.from ? files.map((f) => o.from![all.indexOf(f)]!) : undefined;
  const items: NewImage[] = files.map((file, i) => ({ file, image: numbers[i]!, url: book?.url, from: from?.[i] ?? path.basename(file) }));
  const r = { ...registerImages(tree, shared, items, w.recordset, { wake: false }), aside: [] as SetAside[], replaced };
  // an image saved once more (strom media save --again) came: its new copy, or the same scan again (nothing sharper
  // to have) — what its task waited for either way
  const settled = settleAgain(tree, w.recordset, numbers);
  r.woken.push(...wakeWaiting(tree, w.recordset, r.added.length || (settled ? r.again.length : 0), { ...(o.except ? { except: o.except } : {}), ...(o.ahead ? { ahead: o.ahead } : {}) }));
  if (!tree.dryRun) {
    // the same file as another image (another number, another book: B0408, "33.jpg" the same scan as image 2), another
    // scan than the image of its number (B0374): never deleted unsaid — set aside beside it (no image's name: never
    // taken again), what it is said (live.log, the output, strom media aside)
    const clash = new Map(r.clashed.map((c) => [c.file, c.same]));
    const setAside = (f: string, same: string, kind: "same" | "other") => {
      const to = `${f}.${kind === "same" ? "same-as" : "other-than"}-${same}`;
      const image = allNumbers[all.indexOf(f)]!;
      const said = kind === "other" ? { kind, ...(unsure.has(f) ? { unsure: true as const } : {}) } : {};
      try {
        fs.renameSync(f, to);
        r.aside.push({ file: path.basename(to), image, same, ...said });
      } catch {
        // left lying as it is: said all the same
        r.aside.push({ file: path.basename(f), image, same, ...said });
      }
    };
    for (const f of all) {
      const otherThan = other.get(f);
      if (otherThan !== undefined) {
        setAside(f, otherThan, "other");
        continue;
      }
      const same = clash.get(f);
      if (same === undefined) {
        fs.rmSync(f, { force: true }); // now in the store
        continue;
      }
      setAside(f, same, "same");
    }
    // the folder goes once nobody waits on it; one still waiting keeps it for the rest
    const dir = path.join(shared, "inbox", w.folder);
    const still = tree.list<Task>("task").some((t) => inboxWaitOf(tree, t)?.folder.normalize("NFC") === w.folder.normalize("NFC"));
    if (!still && collectFiles([dir]).length === 0) fs.rmSync(dir, { recursive: true, force: true });
  }
  return r;
}

/**
 * A file of the inbox not taken, set aside as `file`, kept: the same file as another image (`same`), taken under
 * `image` (B0408); or (kind other) another scan than the image `same`, registered as `image` already (B0374).
 */
export interface SetAside {
  file: string;
  image: number;
  same: string;
  kind?: "other";
  /** Of kind other: not told apart — nothing written to compare, a format strom does not read itself (never taken). */
  unsure?: true;
}

/** What a file set aside says (live.log, strom media add --inbox): which image it was taken for, which one it is. */
export function asideLine(t: { recordset: string }, a: SetAside, tree?: Tree): string {
  if (a.kind === "other")
    return `the file for image ${a.image} of ${t.recordset} is ${a.unsure ? "not surely the same scan as" : "another scan than"} ${a.same}, image ${a.image} registered already — not taken as a sharper copy of it, set aside as ${a.file}: which one is image ${a.image} is the user's to say (strom media aside)`;
  const m = tree?.get<Media>(a.same);
  const as = m ? `${m.recordset ?? "no record set"}${m.image !== undefined ? `:${m.image}` : ""}` : a.same;
  return `the file for image ${a.image} of ${t.recordset} is the same scan as ${a.same} (${as}), registered already — not taken, set aside as ${a.file}: one of the two numbers is wrong (the image of ${a.same} renumbered, or the file named by its own number)`;
}

/**
 * A task's awaits.again once it waits for `want` of `recordset`: what it had (of that book, among `want`) with `more`
 * saved once more now — "23–25" as `images` writes them; none: undefined.
 */
function againOf(t: Task, recordset: string, want: readonly number[], more: readonly number[]): string | undefined {
  const had = t.awaits?.recordset === recordset && t.awaits.again ? (parseImageList(t.awaits.again) ?? []) : [];
  const all = [...new Set([...had, ...more])].filter((n) => want.includes(n)).sort((x, y) => x - y);
  return all.length ? runs(all) : undefined;
}

/**
 * The saves once more (strom media save --again) of these images of a book: taken now — and out of the waits of the
 * tasks waiting for them (awaits.again): their new copy came, or the same scan again (nothing sharper to have). How
 * many saves.
 */
function settleAgain(tree: Tree, recordset: string, numbers: number[]): number {
  if (tree.dryRun) return 0;
  const saves = loadSaves(tree.root);
  const now = Date.now();
  let n = 0;
  const next = saves.map((r) => {
    if (!r.again || r.taken !== undefined || r.recordset !== recordset || !numbers.includes(r.n)) return r;
    n++;
    const { held: _h, ...was } = r;
    return { ...was, taken: now };
  });
  if (n) storeSaves(tree.root, next);
  clearAgain(tree, recordset, numbers);
  return n;
}

/** These images of a book out of awaits.again of the tasks waiting for them: their new copy is here. */
function clearAgain(tree: Tree, recordset: string, numbers: readonly number[]): void {
  if (tree.dryRun || !numbers.length) return;
  for (const t of tree.list<Task>("task")) {
    if (t.state !== "waiting" || !t.awaits?.again || liveBook(tree, t.awaits.recordset)?.id !== (liveBook(tree, recordset)?.id ?? recordset)) continue;
    const had = parseImageList(t.awaits.again) ?? [];
    const came = had.filter((n) => numbers.includes(n));
    if (!came.length) continue;
    update<Task>(tree, t.id, "task", (x) => {
      if (!x.awaits) return x;
      const rest = (parseImageList(x.awaits.again ?? "") ?? []).filter((n) => !numbers.includes(n));
      const { again: _a, ...awaits } = x.awaits;
      return { ...x, awaits: rest.length ? { ...awaits, again: runs(rest) } : awaits };
    }, { op: "task.wait", summary: `${t.id} wait: the new copy of image${came.length > 1 ? "s" : ""} ${runs(came)} of ${recordset} came` });
  }
}

/**
 * Another sheet saved under an image's number (spec 141 K1.4): of the files of one take, each but the first of a number
 * (the one named by the number alone first: 007.jpg before 007a.jpg), and one named by a number and a letter (007a.jpg)
 * whose number is registered already. Told by its content, never by its name: the same scan (reduced, saved again) is
 * a copy — left to the take, as before; a zoomed-in part of it is registered as a part of that image (never its whole
 * picture); anything else, or what cannot be told, is a scan of its own: registered to the book with no image number,
 * under its own name (`from`), citable by its M… — no number changes, nothing hidden, nothing asked of the person. A later
 * file under a number taken already with no letter (3.jpg again) stays as it was: set aside and asked (B0374). Those
 * registered here are taken out of `files` and `numbers` (in place); said, one line each. Taken from a folder of the
 * inbox (`remove`), each file goes once in the store; one given by its path stays where it is. The same for a task's
 * folder the bridge takes and for strom media add naming the folder, the task back or none waiting (n1).
 */
function takeSheets(tree: Tree, shared: string, recordset: string, files: string[], numbers: number[], o: { remove?: boolean; from?: (file: string) => string; url?: string } = {}): string[] {
  if (tree.dryRun) return [];
  const wholes = tree.list<Media>("media").filter((m) => !m.retracted && isWhole(m.part));
  const book = tree.get<RecordSet>(recordset);
  const remove = o.remove ?? true;
  const told: { file: string; image: number; to: string; part?: Region }[] = [];
  const firstOf = new Map<number, string>();
  // the first of each number: named by the number alone, else the first in the folder's order
  files.forEach((f, i) => {
    const n = numbers[i]!;
    const was = firstOf.get(n);
    if (was === undefined || (sheetNamed(was) && !sheetNamed(f))) firstOf.set(n, f);
  });
  files.forEach((f, i) => {
    const n = numbers[i]!;
    const first = firstOf.get(n)!;
    const kept = findImage(wholes, recordset, n);
    // the one compared with: the image registered already, else the first of the take
    const other = kept && sheetNamed(f) ? path.join(shared, kept.file) : first !== f ? first : undefined;
    if (other === undefined || !fs.existsSync(other)) return;
    if (fileSha256(f) === fileSha256(other)) return; // the same file: the take says what it is
    if (scanLikeness(f, other) === "same") return; // a copy: the sharpest is the image, as before
    const part = partOf(f, other);
    told.push({ file: f, image: n, to: other, ...(part ? { part } : {}) });
  });
  if (!told.length) return [];
  const lines: string[] = [];
  for (const x of told) {
    const r = registerImages(tree, shared, [{ file: x.file, image: x.part ? x.image : undefined, part: x.part, url: o.url ?? book?.url, from: o.from?.(x.file) ?? path.basename(x.file) }], recordset, { wake: false });
    const m = r.added[0];
    const i = files.indexOf(x.file);
    files.splice(i, 1);
    numbers.splice(i, 1);
    if (!m) continue; // the same file as an image registered: nothing new
    if (remove) fs.rmSync(x.file, { force: true }); // now in the store
    const name = fileName(x.file);
    lines.push(
      x.part
        ? `${name} is a zoomed-in part of image ${x.image} of ${recordset} — ${m.id}, part ${regionText(x.part)} of image ${x.image} (never its whole picture)`
        : `${name} is another scan than image ${x.image} of ${recordset} — ${m.id}, a scan of its own with no image number (cited and read as ${m.id}: strom media view ${m.id})`,
    );
  }
  return lines;
}

/** Why a file was left lying in a task's folder (spec 141 K1.1), for the agent. */
const LEFT_WHY = { zero: "its name gives 0, no image's number", two: "its name gives two of the images asked for", none: "no image's number in its name" } as const;

/**
 * Tasks of a folder back to their agent with a note of their own (spec 141): the person's images, so ahead in the queue
 * once, as wakeWaiting does them. Only those still waiting.
 */
function wakeBack(tree: Tree, back: { task: string; note: string; why: string }[], ahead: string): string[] {
  const woken: string[] = [];
  let goes: ((t: Task) => boolean) | undefined;
  for (const b of back) {
    const t = tree.get<Task>(b.task);
    if (!t || t.state !== "waiting") continue;
    const next = (goes ??= goesAhead(tree))(t);
    update<Task>(tree, t.id, "task", (x) => {
      const { awaits: _, wait: _w, sent: _s, ...rest } = x;
      return { ...rest, state: "open", notes: [...x.notes, ...makeNotes(tree, b.note)], ...(next ? { queueAt: { do: "next" as const, at: ahead } } : {}) };
    }, { op: "task.wake", summary: `${t.id} wake: ${b.why}${next ? " — next in the queue, once" : ""}` });
    woken.push(t.id);
  }
  return woken;
}

/**
 * The tasks of a task's folder that settled (core/inboxsettle.ts) a part of whose images came: back to their agent with
 * what came and what is missing (spec 141 K1.5) — whether that is all, the agent judges by the content. Undefined: none.
 */
function backWhenSettled(tree: Tree, dir: string, files: string[], ws: InboxWait[], now: number | undefined, at: string, lying: string[] = []): { woken: string[]; missing: number[]; back: string[] } | undefined {
  if (tree.dryRun || !settled(tree, dir, files, ws, now)) return undefined;
  const have = registeredImages(tree, ws[0]!.recordset);
  const back = backAfterQuiet(tree, ws, have);
  if (!back.length) return undefined;
  const rs = ws[0]!.recordset;
  const folder = ws[0]!.folder;
  const woken = wakeBack(
    tree,
    back.map((b) => ({
      task: b.task,
      why: `the folder of images of ${rs} settled, ${runs(b.missing)} missing`,
      note:
        `nothing more was saved into ${folder}/ for ${quietMinutes(tree.env)} minutes: of images ${runs(b.want)} of ${rs} ${b.came.length ? `${runs(b.came)} came` : "none came"}, ${runs(b.missing)} missing` +
        (lying.length ? `; left lying there: ${lying.join(", ")}` : "") +
        ` — whether that is all is judged by the content (a scan on the boundary of two years is one scan, counted once); what is still missing: strom task wait ${b.task} --images ${rs}:${runs(b.missing)} --on "…" again, or --kind web --book ${rs} with the years or entries in --on`,
    })),
    at,
  );
  return woken.length ? { woken, missing: back.flatMap((b) => b.missing), back: woken } : undefined;
}

/**
 * What a take of a task's folder leaves to say and do (spec 141): the files left lying and why (K1.1); files taken in
 * the folder's order (K1.3) — their tasks back at once, to tell each by its content; the folder settled, the tasks a
 * part of whose images came (K1.5).
 */
function afterTaken(tree: Tree, t: TakenFolder, o: { dir: string; ws: InboxWait[]; files: string[]; numbered: Extract<Numbered, { numbers: number[] }>; now: number | undefined; at: string; sheets?: string[] }): void {
  if (o.sheets?.length) {
    t.sheets = o.sheets;
    // said to the task too: a take by the bridge has nobody reading its output
    for (const w of o.ws) {
      const x = tree.get<Task>(w.task);
      if (x) update<Task>(tree, w.task, "task", (y) => ({ ...y, notes: [...y.notes, ...makeNotes(tree, `saved into ${w.folder}/ under an image's number, told by the content: ${o.sheets!.join("; ")}`)] }), { op: "task.note", summary: `${w.task} note: another sheet under an image's number` });
    }
  }
  const lying = (o.numbered.left ?? []).map((l) => `${fileName(l.file)} (${LEFT_WHY[l.why]})`);
  if (lying.length) t.lying = lying;
  const rs = o.ws[0]!.recordset;
  if (o.numbered.by === "folder" && o.numbered.numbers.length) {
    const entries = o.numbered.entries ?? [];
    t.byFolder = o.files.map((f, i) => `${fileName(f)} → image ${o.numbered.numbers[i]}${entries[i] ? ` (entries ${entriesText(entries[i]!)})` : ""}`);
    const woken = wakeBack(
      tree,
      o.ws.map((w) => ({
        task: w.task,
        why: `images of ${rs} named not by their numbers, taken in the folder's order`,
        note:
          `${counted(o.files.length, "file")} saved into ${w.folder}/ were named not by the images' numbers${entries.some(Boolean) ? " (by the entries on them)" : ""} — taken in the folder's order as images ${runs(o.numbered.numbers)} of ${rs}, the next numbers of the book: ${t.byFolder!.join("; ")}` +
          (lying.length ? `; left lying: ${lying.join(", ")}` : "") +
          `. Which scan each is (its years, its entries) is read off it: strom media view ${rs}:<n>; what is still missing: strom task wait ${w.task} --images ${rs}:<n> --on "…" again, or --kind web --book ${rs} with the years or entries in --on`,
      })),
      o.at,
    );
    t.woken.push(...woken);
  }
  const back = backWhenSettled(tree, o.dir, folderFiles(o.dir), o.ws, o.now, o.at, lying);
  if (back) {
    t.woken.push(...back.woken);
    t.back = back.back;
  }
  if (t.woken.length) t.missing = [];
}

/** What strom took of images the Strom app sent for a waiting task (PUT /media with X-Strom-Task). */
export interface TakenForTask {
  task: string;
  recordset: string;
  /** Their image numbers (a PDF's pages: one each). */
  images: number[];
  /** How the numbers were found: said by the app, the file's name, the order of the images missing. */
  by: "image" | "name" | "order";
  /** Registered now (M…). */
  added: string[];
  /** The same content was there at that number already: nothing changed. */
  same: boolean;
  /** The images it replaced (X-Strom-Replace): withdrawn, kept; one a source cites stays beside the new one. */
  replaced: string[];
  /** Files of the inbox it replaced: set aside under these names, never deleted. */
  aside: string[];
  /** The first of them (the app's one image). */
  image: number;
  /** The task is back in the queue now: all it asked for is there. */
  woken: boolean;
  /** Back in the queue now: the task, and others its book completes. */
  back: string[];
  /** How far the wait got: of the images asked for, how many are there (want: none when which ones is not known). */
  inbox: { have: number; want?: number; missing: number[]; next?: number };
  state: Task["state"];
}

/** The pictures of a file sent for a task: an image as it is, a PDF page by page (its scans as they are, else made). */
function picturesOf(tree: Tree, env: NodeJS.ProcessEnv, file: string, name: string, tmp: string): { file: string; ext: string }[] {
  const fd = fs.openSync(file, "r");
  const head = Buffer.alloc(64);
  const n = fs.readSync(fd, head, 0, 64, 0);
  fs.closeSync(fd);
  const format = formatOf(head.subarray(0, n));
  const EXT: Record<string, string> = { jpeg: ".jpg", png: ".png", tiff: ".tif", gif: ".gif", webp: ".webp", heic: ".heic" };
  if (EXT[format]) return [{ file, ext: EXT[format]! }];
  const named = path.extname(name).toLowerCase();
  if (format === "unknown" && IMAGE_EXT.has(named) && named !== ".pdf") return [{ file, ext: named }];
  if (format !== "pdf") throw new UsageError(`${name} is no image of a book (JPEG, PNG, TIFF, HEIC, PDF)`, { code: "media.type", params: { name } });
  const scans = pdfScans(fs.readFileSync(file));
  if (scans && scans.pages > 0 && scans.jpegs.every((j) => j !== undefined)) {
    return scans.jpegs.map((j, i) => {
      const out = path.join(tmp, `page-${i + 1}.jpg`);
      fs.writeFileSync(out, j!);
      return { file: out, ext: ".jpg" };
    });
  }
  // pages that are no single scan: made by the system (as a document to read is)
  try {
    const first = readableFile(tree.root, file, { env, page: 1 });
    const out: { file: string; ext: string }[] = [];
    for (let p = 1; p <= first.pages; p++) {
      const r = p === 1 ? first : readableFile(tree.root, file, { env, page: p });
      const copy = path.join(tmp, `page-${p}${path.extname(r.file).toLowerCase() || ".jpg"}`);
      fs.copyFileSync(r.file, copy);
      out.push({ file: copy, ext: path.extname(copy) });
    }
    return out;
  } catch (e) {
    throw new UsageError(`the pages of ${name} cannot be made into images here: ${(e as Error).message}`, { code: "waiting.pdf", params: { name } });
  }
}

/**
 * Images the Strom app sent for a task that waits for images of a book (its "Have the images"): numbered (said, by the
 * name, by the order of those missing — else refused with what is asked or missing), put into the task's folder of the
 * shared inbox as <number>.<ext> and registered from there as a folder's files are (takeFiles) — the task back in the
 * queue once all it asked for are there; one that does not know which (a site with a book) waits on for the person's
 * answer. An image at that number already: the same content only said; another refused unless `replace` (the old one
 * withdrawn and kept, a file lying there set aside).
 */
export function takeForTask(tree: Tree, shared: string, env: NodeJS.ProcessEnv, t: Task, file: string, o: { name: string; image?: number | undefined; replace?: boolean; by: string }): TakenForTask {
  const w = inboxWaitOf(tree, t);
  if (!w) throw new UsageError(`${t.id} waits for no images of a book`, { code: "task.no-images" });
  const dir = path.join(shared, "inbox", w.folder);
  fs.mkdirSync(path.join(shared, "media", ".incoming"), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(shared, "media", ".incoming", "task-"));
  try {
    const pics = picturesOf(tree, env, file, o.name, tmp);
    const shas = pics.map((p) => fileSha256(p.file));
    // numbered and taken under the tree's lock: two files sent at once never get the same next free number
    return tree.withTreeLock(() => takeNumbered(tree, shared, t, w, dir, pics, shas, o));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** takeForTask under the tree's lock: the pictures numbered, put into the task's folder and registered. */
function takeNumbered(tree: Tree, shared: string, t: Task, w0: InboxWait, dir: string, pics: { file: string; ext: string }[], shas: string[], o: { name: string; image?: number | undefined; replace?: boolean; by: string }): TakenForTask {
  const now0 = tree.get<Task>(t.id);
  const w = now0 ? inboxWaitOf(tree, now0) : undefined;
  if (!now0 || !w || w.recordset !== w0.recordset) throw new UsageError(`${t.id} waits for these images no more`, { code: "task.not-waiting", params: { id: t.id } });
  t = now0;
  const state = inboxState(tree, shared, t)!;
  const numbered = numbersForTask(pics.length, { image: o.image, name: o.name, want: w.want, missing: state.missing, next: state.next });
  if ("code" in numbered) {
    const list = numbered.code === "waiting.image-unwanted" ? numbered.want : numbered.missing;
    const said = numbered.code === "waiting.image-unwanted"
      ? `${t.id} asks for images ${runs(list)} of ${w.recordset}, not ${o.image}${pics.length > 1 ? `–${o.image! + pics.length - 1}` : ""}`
      : `it is not known which image of ${w.recordset} ${pics.length > 1 ? `these ${pics.length} pages are` : `${o.name} is`}${list.length ? ` — missing: ${runs(list)}` : ""}: say its number (X-Strom-Image)`;
    throw new UsageError(said, { code: numbered.code, params: { [numbered.code === "waiting.image-unwanted" ? "want" : "missing"]: runs(list), recordset: w.recordset } });
  }
  const media = tree.list<Media>("media").filter((m) => !m.retracted && m.recordset === w.recordset && m.image !== undefined && isWhole(m.part));
  // the next free numbers (a task that does not know which images, a name with none): a scan of the book sent again
  // keeps the number it has — the same, only said — and only the new ones go on from the next free number
  let numbers = numbered.numbers;
  if (numbered.by === "order" && !w.want?.length) {
    let k = 0;
    numbers = shas.map((sha) => media.find((m) => m.sha === sha)?.image ?? numbered.numbers[k++]!);
  }
  const lying = folderFiles(dir);
  const clash: number[] = [];
  const replaced: string[] = [];
  const aside: string[] = [];
  const take: number[] = [];
  numbers.forEach((n, i) => {
    const there = media.filter((m) => m.image === n);
    const files = lying.filter((f) => numberInName(path.basename(f).replace(/\.[^.]*$/u, "")) === n);
    if (there.some((m) => m.sha === shas[i]) || files.some((f) => fileSha256(f) === shas[i])) return;
    if ((there.length || files.length) && !o.replace) clash.push(n);
    take.push(i);
  });
  // the same file as another image already registered (another number, another book): never taken under this one —
  // said, with which it is, so the app can tell the person (else it vanished as a copy, nothing said)
  const known = tree.list<Media>("media").filter((m) => !m.retracted);
  numbers.forEach((n, i) => {
    const k = known.find((m) => m.sha === shas[i] && !(m.recordset === w.recordset && m.image === n && isWhole(m.part)));
    if (!k) return;
    const as = `${k.recordset ?? "no record set"}${k.image !== undefined ? `:${k.image}` : ""}${isWhole(k.part) ? "" : " (a part)"}`;
    throw new UsageError(`image ${n} of ${w.recordset}: this file is the same as ${k.id} (${as}), taken already — nothing taken; image ${n} is another scan`, {
      code: "waiting.image-same",
      params: { image: String(n), same: k.id, as, ...(k.recordset ? { sameRecordset: k.recordset } : {}), ...(k.image !== undefined ? { sameImage: String(k.image) } : {}), recordset: w.recordset },
    });
  });
  if (clash.length) throw new UsageError(`image ${runs(clash)} of ${w.recordset} is there already, another scan — send it again to replace it (X-Strom-Replace: 1)`, { code: "waiting.image-exists", params: { image: runs(clash), recordset: w.recordset } });
  const out = tree.withTreeLock(() => {
    const placed: string[] = [];
    for (const i of take) {
      const n = numbers[i]!;
      for (const m of media.filter((x) => x.image === n)) {
        const cited = tree.list<Source>("source").some((s) => !s.retracted && (s.media?.includes(m.id) || s.clips?.some((c) => c.media === m.id)));
        if (cited) continue; // what a source cites stays; the new scan is registered beside it
        update<Media>(tree, m.id, "media", (x) => ({ ...x, retracted: { at: now(), reason: "replaced by the person's scan from the Strom app" } }), { op: "media.retract", summary: `${m.id} retracted: replaced by the person's scan of image ${n}` });
        replaced.push(m.id);
      }
      if (!tree.dryRun) {
        fs.mkdirSync(dir, { recursive: true });
        for (const f of lying.filter((f) => numberInName(path.basename(f).replace(/\.[^.]*$/u, "")) === n)) {
          const to = `${f}.replaced-${new Date().toISOString().replace(/[:.]/g, "-")}`;
          fs.renameSync(f, to);
          aside.push(path.basename(to));
        }
        const target = path.join(dir, `${n}${pics[i]!.ext}`);
        fs.copyFileSync(pics[i]!.file, target);
        placed.push(target);
      }
    }
    // the task waits on for the person's answer when it does not know which images: never woken by these
    // sent by the person (the Strom app, their terminal): the tasks they complete go ahead in the queue, once — an agent's never
    const person = o.by === "app" || o.by === "user";
    const r = placed.length ? takeFiles(tree, shared, w, placed, take.map((i) => numbers[i]!), { except: w.want?.length ? "" : t.id, from: take.map(() => o.name), ...(person ? { ahead: new Date().toISOString() } : {}) }) : undefined;
    if (r?.added.length) {
      const asked = askedNow(t);
      const at = new Date().toISOString();
      const handed = r.added.map((m) => ({ input: m.id, by: o.by, asked, at }));
      update<Task>(tree, t.id, "task", (x) => ({ ...x, files: [...(x.files ?? []), ...handed] }), { op: "task.files", summary: `${t.id}: images ${runs(r.added.map((m) => m.image!))} of ${w.recordset} from ${o.by === "app" ? "the Strom app" : o.by}` });
    }
    return r;
  });
  const after = tree.get<Task>(t.id)!;
  const reg = registeredImages(tree, w.recordset);
  const want = w.want ?? [];
  const missing = awaitedMissing(tree, after, want, { have: reg });
  const have = want.length ? want.length - missing.length : handedImages(tree, after, w.recordset).length + folderFiles(dir).length;
  return {
    task: t.id,
    recordset: w.recordset,
    image: numbers[0]!,
    images: numbers,
    by: numbered.by,
    added: out?.added.map((m) => m.id) ?? [],
    same: !take.length,
    replaced,
    aside,
    woken: (out?.woken ?? []).includes(t.id),
    back: out?.woken ?? [],
    inbox: { have, ...(want.length ? { want: want.length } : { next: inboxState(tree, shared, after)?.next ?? numbers.at(-1)! + 1 }), missing: missing.slice(0, 50) },
    state: after.state,
  };
}

/** The tasks still waiting for images of a book by their numbers: which are missing. */
function stillWaiting(tree: Tree, recordset: string | undefined): string[] {
  if (!recordset) return [];
  const have = registeredImages(tree, recordset);
  const pending = againPending(tree);
  return tree
    .list<Task>("task")
    .filter((t) => t.state === "waiting" && t.awaits?.recordset === recordset)
    .map((t) => {
      const missing = awaitedMissing(tree, t, parseImageList(t.awaits!.images) ?? [], { have, pending });
      return `${t.id} still waits for images ${runs(missing)} of ${recordset} (it asked for ${t.awaits!.images}) — it comes back once they are there`;
    });
}

/**
 * The images strom media save gave the agent's tab a script for whose file never came — not in the downloads folder
 * (nor still downloading), not in the task's folder, not registered, a while after the script was given: Chrome saves
 * one file of a site by itself and holds the next back until the person allows the site to download several files.
 * The first time an image is found so, its task's wait says it to the person (in the research language). Records of
 * tasks that wait for them no more go; of images registered since, a while later (`taken`: a late copy is tidied).
 */
export function heldSaves(tree: Tree, shared: string, downloads: string, now = Date.now()): SaveRecord[] {
  const saves = loadSaves(tree.root);
  if (!saves.length) return [];
  const keep: SaveRecord[] = [];
  const held: SaveRecord[] = [];
  for (const r of saves) {
    if (r.taken !== undefined) {
      if (now - r.taken < TAKEN_KEEP_MS) keep.push(r);
      continue;
    }
    // registered (but one saved once more: its new copy is what is waited for)
    if (!r.again && registeredImages(tree, r.recordset).has(r.n)) {
      const { held: _h, ...was } = r;
      keep.push({ ...was, taken: now });
      continue;
    }
    const t = tree.get<Task>(r.task);
    const want = t?.state === "waiting" && t.awaits?.recordset === r.recordset ? (parseImageList(t.awaits.images) ?? []) : [];
    if (!want.includes(r.n)) continue;
    keep.push(r);
    const dl = findDownload(downloads, r.file);
    const dir = path.join(shared, "inbox", t!.awaits!.folder);
    const inFolder = fs.existsSync(dir) && folderFiles(dir).length > 0;
    if (dl.file || dl.unfinished || inFolder || now - r.at < HELD_AFTER_MS) continue;
    // one of several images given one script: its page not opened yet (or just now) — nothing held back (1124). Opened:
    // a tab of the agent's shows it (the hook let it go there), or an image after it in the list came already
    if (r.paged) {
      const shown = pageShownSince(tree.root, r.url, r.at);
      // (one saved once more came when its new copy did: the old one registered is no sign its page was opened)
      const later = saves.some((o) => o.paged && o.task === r.task && o.recordset === r.recordset && o.at === r.at && (o.order ?? 0) > (r.order ?? 0) && (o.taken !== undefined || (!o.again && registeredImages(tree, o.recordset).has(o.n)) || !!findDownload(downloads, o.file).file));
      if (!later && (shown === undefined || now - shown < HELD_AFTER_MS)) continue;
    }
    // its page refused by the hook and nothing of its site let through since: the script never ran — nothing held back
    // by the browser, nothing for the person to allow (core/ownsave.ts)
    if (saveNeverOpened(tree, r)) continue;
    held.push(r);
  }
  const fresh = held.filter((r) => !r.held);
  if (!tree.dryRun) {
    if (fresh.length)
      tree.withTreeLock(() => {
        for (const id of new Set(fresh.map((r) => r.task))) {
          const mine = held.filter((r) => r.task === id);
          const t = tree.get<Task>(id)!;
          const b = tree.get<RecordSet>(mine[0]!.recordset);
          const said = phrase(tree.lang, "browser.wait.held", { images: t.awaits!.images, book: b ? `${b.id} ${b.title}` : mine[0]!.recordset, url: mine[0]!.url, n: runs(mine.map((r) => r.n)), host: mine[0]!.host });
          if (t.waitingOn !== said) update<Task>(tree, id, "task", (x) => ({ ...x, waitingOn: said }), { op: "task.wait", summary: `${id} wait: image ${runs(mine.map((r) => r.n))} of ${mine[0]!.recordset} held back by the browser — ${mine[0]!.host} to be allowed to download several files` });
        }
      });
    storeSaves(tree.root, keep.map((r) => (held.includes(r) ? { ...r, held: true } : r)));
  }
  return held;
}

/**
 * strom's own files in the downloads folder (strom-3f2a9c1b-T0007-0040.jpg, "… (1).jpg"; given before the research's
 * mark, strom-T0007-0040.jpg: the name strom media save gave them, for this research — its records say so) whose image is registered already: a copy the browser saved late or twice,
 * after the one taken. Gone, as the copies of one image are when it is taken (fromDownloads); a file still being
 * written waits for the next look. Never a file strom did not name, never one of an image not registered.
 */
export function tidyDownloads(tree: Tree, downloads: string, now = Date.now()): string[] {
  // registered — but never the file of one saved once more and not taken yet (strom media save --again): its new copy
  const done = loadSaves(tree.root).filter((r) => !(r.again && r.taken === undefined) && registeredImages(tree, r.recordset).has(r.n));
  if (!done.length) return [];
  let names: string[];
  try {
    names = fs.readdirSync(downloads);
  } catch {
    return [];
  }
  const gone: string[] = [];
  for (const r of done) {
    const esc = r.file.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const re = new RegExp(`^${esc}(?: \\(\\p{Nd}+\\))?\\.([\\p{L}\\p{N}]{2,5})$`, "u");
    for (const name of names) {
      const m = re.exec(name.normalize("NFC"));
      if (!m || !IMAGE_FILE_EXT.has(`.${m[1]!.toLowerCase()}`)) continue;
      const f = path.join(downloads, name);
      if (unsettled([f], now).length) continue;
      if (!tree.dryRun)
        try {
          fs.rmSync(f, { force: true });
        } catch {
          continue; // held open at this moment (Windows): the next look
        }
      gone.push(name);
    }
  }
  return gone;
}

/** The archive's host of an address, bare (no www.), or undefined. */
function bareHost(url: string | undefined): string | undefined {
  return url && URL.canParse(url) ? new URL(url).hostname.toLowerCase().replace(/^www\./u, "") : undefined;
}

/**
 * The book an image saved through the agent's browser is of, when the agent names none: the one the task waits for
 * (its wait, while it waits), else among its books and those its earlier saves were of the one on the archive of `at`
 * (the host, or a site of it) — else, when several remain, those named for the agent to choose.
 */
export function saveBookOf(tree: Tree, t: Task, w: InboxWait | undefined, at: string): { book?: RecordSet; several?: RecordSet[] } {
  const live = (id: string | undefined) => {
    const b = id ? tree.get<RecordSet>(id) : undefined;
    return b && b.type === "recordset" && !b.retracted && !b.mergedInto ? b : undefined;
  };
  const waited = live(w?.recordset) ?? live(t.awaits?.recordset);
  if (waited) return { book: waited };
  const ids = [...new Set([...t.where.filter((x) => /^B\p{N}{4,}$/u.test(x)), ...loadSaves(tree.root).filter((r) => r.task === t.id).map((r) => r.recordset)])];
  const books = ids.map(live).filter((b): b is RecordSet => !!b);
  if (books.length <= 1) return books.length ? { book: books[0]! } : {};
  const host = bareHost(at);
  const on = (b: RecordSet) => {
    const repo = b.repository ? tree.get<Repository>(b.repository) : undefined;
    return [b.url, repo?.url].map(bareHost).some((h) => !!h && !!host && (h === host || h.endsWith(`.${host}`) || host.endsWith(`.${h}`)));
  };
  const there = host ? books.filter(on) : [];
  return there.length === 1 ? { book: there[0]! } : { several: there.length ? there : books };
}

/** What the agent is told of an image its browser held back. */
function heldLine(ctx: Context, h: SaveRecord, downloads: string): string {
  const since = new Date(h.at).toTimeString().slice(0, 8);
  const waits = ctx.tree().get<Task>(h.task)?.awaits?.images;
  return (
    `⚠ image ${h.n} of ${h.recordset} (${h.task}): nothing came into ${ctx.display(downloads)} since strom media save gave its script (${since}). ` +
    `The script answered "strom-result ${h.n}:200:…": the browser held the file back — Chrome saves one file of a site by itself and the next only once the person allows ${h.host} to download several files ` +
    `in the browser profile your browser tool works in — each profile of a browser (and each browser) has its own permission, one given in another does not count ` +
    `(once: the icon at the right end of the address bar, or the site's settings → Automatic downloads). Tell the user exactly that; it is the person's permission — never change the browser's settings yourself, never save the image another way. ` +
    `${h.task} waits for it meanwhile and what waits says it to the person. The images ${h.task} still needs that are not in its wait${waits ? ` (${waits})` : ""} yet: add them now — strom media save ${h.task} --image <them> --recordset ${h.recordset} --at <their pages> [--again] — and run no script of them until the person allowed the downloads; go on with other work. Once allowed: strom media save ${h.task} --image ${h.n} --at ${h.url}, its script in that tab again, then strom media add --inbox --waiting. ` +
    `The script answered anything else: tell the user what it said. The browser saves elsewhere: strom config set browser.downloads <folder>.`
  );
}

/** What was taken of the folders, a line each (strom media add --inbox --waiting, a session's start). */
export function takenLines(taken: TakenFolder[]): string[] {
  return taken.flatMap((t) => {
    const who = t.tasks.join(" ");
    if (t.settling) return `${t.folder}/: ${counted(t.settling, "file")} still being written — taken on the next look (${who})`;
    if (t.problem) return `${t.folder}/: nothing taken — ${t.problem} (${who})`;
    if (t.later !== undefined) return `${t.folder}/: named not by the images' numbers (the entries on them, or not as many as missing) — taken in the folder's order once nothing more is saved for ${quietMinutes()} minutes${t.later ? ` (about ${new Date(t.later).toTimeString().slice(0, 5)} local time)` : ""}; strom media add --inbox ${shellArg(t.folder)} takes them now (${who})`;
    if (!t.added.length && !t.aside?.length && (t.lying?.length || t.back?.length || t.sheets?.length))
      return [`${t.folder}/: ${t.back?.length ? `settled — back in the queue with a part of the images: ${t.back.join(" ")}` : t.book ? `another sheet under an image's number of ${t.recordset}, told by its content (${who})` : `${who} still waits${t.missing.length ? ` for images ${runs(t.missing)}` : ""}`}`, ...(t.sheets ?? []).map((l) => `  ${l}`), ...(t.lying ?? []).map((l) => `  left lying: ${l}`)];
    return [[
      `${t.folder}/: ${t.added.length ? `images ${runs(t.added)} of ${t.recordset} registered${t.byOrder ? " (numbered by their order: the names gave none of the numbers asked for)" : ""}` : t.aside?.length ? `nothing taken: ${counted(t.aside.length, "file")} set aside` : "nothing new (the same scans are registered)"}`,
      t.woken.length ? ` — back in the queue: ${t.woken.join(" ")}` : t.missing.length ? ` — ${who} still waits${t.missing.length ? ` for images ${runs(t.missing)}` : ""}` : "",
      t.book && t.added.length ? ` — the book's own folder: its tasks read them from disk (${who})` : "",
      t.left ? ` — ${counted(t.left, "file")} left lying: no image's number in the name (strom media add <file> --recordset ${t.recordset} --image <n>, once its content says which)` : "",
      t.replaced?.length ? ` — saved once more, the new scan is the image: ${t.replaced.join(" ")} withdrawn (kept)` : "",
    ].join("")].concat(
      (t.byFolder ?? []).map((c) => `  in the folder's order: ${c}`),
      (t.sheets ?? []).map((c) => `  ${c}`),
      (t.lying ?? []).map((c) => `  left lying: ${c}`),
      (t.copies ?? []).map((c) => `  ${c}`),
      (t.aside ?? []).map((c) => `  ⚠ ${c}`),
    );
  });
}

function sharedDir(ctx: Context): string {
  return ctx.settings.shared()!.value;
}

function pageLabel(tree: Tree, m: Media): string {
  if (m.page) return m.page;
  const b = m.recordset && m.image !== undefined ? tree.get<RecordSet>(m.recordset) : undefined;
  return (b && pageOf(b, m.image!)) ?? "";
}

/**
 * Image n of a book not registered, that a task waits for: said with how it comes and the exact next step — through the
 * agent's browser (strom media save gave its script: once the browser saved it, strom media add --inbox --waiting;
 * the script not run or over: strom media save again), through a connector's browser plan (its take), else the
 * person's hand. No task waits for it: undefined (said as not registered).
 */
export function notYetRegistered(tree: Tree, recordset: string, n: number): { message: string; hint: string } | undefined {
  const t = tree
    .list<Task>("task")
    .find((x) => x.state === "waiting" && x.awaits?.recordset === recordset && (parseImageList(x.awaits.images) ?? []).includes(n));
  const plan = loadPlans(tree.root).find((p) => p.recordset === recordset && p.items.some((i) => i.n === n));
  if (!t && !plan) return undefined;
  const then = "strom media add --inbox --waiting";
  const save = t ? loadSaves(tree.root).find((r) => r.task === t.id && r.recordset === recordset && r.n === n && r.taken === undefined) : undefined;
  if (t && save) {
    const since = new Date(save.at).toTimeString().slice(0, 8);
    const again = `strom media save ${t.id} --image ${n} --recordset ${recordset} --at ${save.url}`;
    return {
      message: `image ${n} of ${recordset} is not registered yet: ${t.id} waits for it through your browser (strom media save gave its script at ${since})${save.held ? ` — the browser held its file back: the person allows ${save.host} to download several files, in the browser profile your browser tool works in` : ""}`,
      hint: `once the browser saved it: ${then} takes it and says whether it came (never look into the downloads folder yourself); the script not run yet, or over: ${again}, its script in that tab, then ${then}`,
    };
  }
  if (plan)
    return {
      message: `image ${n} of ${recordset} is not registered yet: a browser plan of connector ${plan.connector} has it${t ? ` (${t.id} waits for it)` : ""}`,
      hint: `run the script of its plan in your browser's tab, then strom fetch ${plan.connector} --take --result "<the line it returned>"; the plan over: strom fetch ${plan.connector} ${plan.book} --images ${n} --recordset ${recordset}`,
    };
  return {
    message: `image ${n} of ${recordset} is not registered yet: ${t!.id} waits for it${t!.waitingOn ? ` (${truncate(t!.waitingOn, 160)})` : ""}`,
    hint: `${then} takes it once it is in the task's folder (strom task show ${t!.id} names it); meanwhile other work`,
  };
}

/**
 * Whether the agent's browser may save images of an archive's book for a task (strom media save): the archive's gate
 * of the browser, an agent whose browser strom keeps, its images through the browser as the person allowed, the host
 * not left alone now — else refused as each says. What the gate says, for the save.
 */
function saveGate(ctx: Context, tree: Tree, t: Task, b: RecordSet, w: InboxWait | undefined, u: URL, asked: number[]): WebGate {
  const shared = sharedDir(ctx);
  let g = browserGate({ env: ctx.env, tree, url: u.href, shared, task: t.id });
  const runner = detectAgent(ctx.env);
  // an agent whose browser strom does not keep: never at an archive only a person's browser goes to
  if (runner && !browserKept(runner, tree.root, ctx.env) && g.level?.browserOnly && (g.allow || g.why === "browser"))
    g = { ...g, allow: false, why: "browser", reason: withoutBrowserReason(g.level, g.level.title ?? g.host, t.id, bookOn(tree, t.id, g.host, u.href), otherWay(g.host, u.href, t.id)) };
  // what the script saves is an image of the archive: its images through the browser, as the person allowed
  const may = g.level ? allows(g.level, "images", "browser") : { ok: true as const };
  // its images by a person's hand only, and the task waits for images of this book already: nothing to tell it to
  // wait for — only that it waits (and the one image more it is to wait for, when this one is not among them yet)
  if (!g.allow && !may.ok && may.why === "manual" && w?.by === "images" && w.recordset === b.id) {
    const want = w.want ?? [];
    const missing = asked.filter((x) => !want.includes(x));
    const more = !missing.length ? "" : ` ${missing.length === 1 ? `Image ${missing[0]}` : `Images ${runs(missing)}`} too, only if the task needs ${missing.length === 1 ? "it" : "them"}: strom task wait ${t.id} --images ${b.id}:${runsArg([...want, ...missing])} --on "<the book, its link, which images — impersonal, in the research language>".`;
    throw new UsageError(`strom: ${g.level!.title ?? g.host} — its images by a person's hand only, not through your browser: ${t.id} waits for images of ${b.id} saved by hand already${want.length ? ` (${runs(want)})` : ""}.${more} Go on with other work.`, { code: `browser.${g.why ?? "manual"}` });
  }
  if (!g.allow) throw new UsageError(g.reason ?? `strom: not through the browser: ${u.href}`, { code: `browser.${g.why ?? "refused"}` });
  if (!may.ok)
    throw new UsageError(
      may.why === "permission"
        ? `strom: the person has not allowed ${g.host} "through the browser" for its images (strom allow archive ${g.level!.host} --way browser — the person's, never yours): ${t.id} stays for the person to save by hand`
        : `strom: ${g.level!.title ?? g.host} — no image of it through your browser (${may.why}): ${t.id} stays for the person to save by hand`,
      { code: `browser.${may.why}` },
    );
  if (g.blocked) throw new UsageError(`strom: ${g.host} is left alone now${g.blocked.reason ? ` — ${g.blocked.reason}` : ""}: nothing goes to it before then, through your browser either. Go on with other work.`);
  return g;
}

/** Two hosts of one site: the same, or one a subdomain of the other (no www.). */
function oneSite(a: string, b: string): boolean {
  const [x, y] = [a, b].map((h) => h.toLowerCase().replace(/^www\./u, ""));
  return x === y || x!.endsWith(`.${y}`) || y!.endsWith(`.${x}`);
}

/**
 * The stop of a range at this host whose task still waits for the images of its book (by the person's hand), if any:
 * no other range of that archive meanwhile. Stops whose task waits no more are forgotten.
 */
function rangeHeld(tree: Tree, host: string): { stop: RangeStop; task: Task } | undefined {
  const all = loadStops(tree.root);
  // which archive stopped cannot be told: every one taken as stopped (spec 132 K1.5, the careful way), until the person
  // looks at the file — one image at a time goes on as ever
  if (all === "broken")
    throw new UsageError(`strom: ${STOPS_FILE}, where strom keeps the ranges an archive stopped, cannot be read — which archive stopped one is not known, so no range through your browser at any archive until the person looks at it`, {
      hint: `tell the user: ${STOPS_FILE} in the research's folder is damaged; once the images a task waits for by hand (What waits) are saved, the person removes that file and ranges go on — meanwhile one image at a time: strom media save <task> --image <n> --at <the archive's page of that image>`,
      code: "browser.range.stops",
    });
  const live: { stop: RangeStop; task: Task }[] = [];
  for (const stop of all) {
    const task = tree.get<Task>(stop.task);
    if (task?.state === "waiting" && task.awaits?.recordset === stop.recordset) live.push({ stop, task });
  }
  if (live.length !== all.length && !tree.dryRun) storeStops(tree.root, live.map((x) => x.stop));
  return live.find((x) => oneSite(x.stop.host, host));
}

/**
 * strom media save --images a-b (spec 132): a range of a book's images through the archive's own viewer in the agent's
 * tab, one script — only where strom's list lets the archive have it (browserRange) and the person consented to it
 * for this archive (strom allow archive <host> --range), after every check one image has (saveGate). Only the images the
 * task waits for (all asked when it waits for none of the book yet), registered ones left out, at most browserRange a
 * call, at times the limiter reserves at a person's pace or slower — the rest: the same command again.
 */
function saveRange(ctx: Context, tree: Tree, t: Task, opts: Record<string, unknown>) {
  const asked = parseImageList(String(opts.images ?? ""));
  if (!asked) throw new UsageError(`--images ${String(opts.images ?? "")}: image numbers as the archive's viewer counts them, e.g. 40-52`, { hint: `strom media save ${t.id} --images 40-52 --at <the book's page>` });
  const w = inboxWaitOf(tree, t);
  const found = opts.recordset ? { book: requireRecord<RecordSet>(tree, normId(String(opts.recordset)), "recordset") } : saveBookOf(tree, t, w, String(opts.at ?? ""));
  const b = found.book;
  if (!b) {
    const several = found.several ?? [];
    throw new UsageError(
      several.length ? `which book images ${runs(asked)} are of: ${t.id} works in ${several.map((x) => `${x.id} ${truncate(x.title, 60)}`).join(", ")} — --recordset names it` : `which book images ${runs(asked)} are of: --recordset B…`,
      { hint: `strom media save ${t.id} --images ${runsArg(asked)} --recordset ${several.length ? several.map((x) => x.id).join("|") : "B…"} --at <the book's page>` },
    );
  }
  if (t.state === "done" || t.state === "parked" || (t.state === "waiting" && (!w || w.recordset !== b.id)))
    throw new UsageError(`${t.id} is ${t.state}${t.state === "waiting" ? ` — for ${waitKindOf(t) === "images" && w ? `images of ${w.recordset}` : "something else"}` : ""}: images of ${b.id} are saved for a task that works in it`, { hint: `strom task show ${t.id}` });
  let u: URL;
  try {
    u = new URL(String(opts.at ?? "").trim());
  } catch {
    throw new UsageError("--at <url>: the archive's page of the book, its viewer", { hint: `strom media save ${t.id} --images ${runsArg(asked)} --at https://…` });
  }
  if (!/^https?:$/u.test(u.protocol)) throw new UsageError(`--at takes an http(s) address: not "${u.href}"`);
  // the archive stopped a range of its images (its check, a login, a refusal): while the task it stopped waits for the
  // person's hand, no other range of that archive — for no task, its limiter's pause over or not (spec 132 K1.5)
  const held = rangeHeld(tree, u.hostname);
  if (held)
    throw new UsageError(
      `strom: ${held.stop.host} stopped a range of your browser at image ${held.stop.n} for ${held.task.id} — ${held.task.id} waits for the person to save images ${held.task.awaits!.images} of ${held.stop.recordset} by hand: no other range of ${held.stop.host} until then, for no task`,
      { hint: `tell the user which images wait for them (strom task show ${held.task.id}); strom media add --inbox --waiting takes them once saved and brings ${held.task.id} back — meanwhile other work`, code: "browser.range.stopped" },
    );
  // only what the task needs: the images it waits for of this book, when it waits for some already
  const waited = w?.by === "images" && w.recordset === b.id ? (w.want ?? []) : [];
  const registered = registeredImages(tree, b.id);
  const needed = asked.filter((n) => (!waited.length || waited.includes(n)) && !registered.has(n));
  const notWaited = waited.length ? asked.filter((n) => !waited.includes(n)) : [];
  const already = asked.filter((n) => registered.has(n));
  const g = saveGate(ctx, tree, t, b, w, u, needed.length ? needed : asked);
  const where = g.level?.title ?? g.host;
  const max = browserRangeOf(ctx.env, g.host);
  if (!max)
    throw new UsageError(`strom: ${where} — one image at a time through your browser, no range: strom's list gives it none`, {
      hint: `strom media save ${t.id} --image <n> --at <the archive's page of that one image>`,
      code: "browser.range",
    });
  if (!g.level?.range)
    throw new UsageError(`strom: the person has not consented to a range of ${where}'s images through the browser (strom allow archive ${g.level!.host} --range — the person's, never yours): one image at a time`, {
      hint: `strom media save ${t.id} --image <n> --at <the archive's page of that one image>; a range only once the user consented to it, for this archive`,
      code: "browser.range.permission",
    });
  if (!needed.length)
    throw new UsageError(`nothing to save of ${b.id}: ${already.length ? `images ${runs(already)} registered already` : ""}${already.length && notWaited.length ? ", " : ""}${notWaited.length ? `${t.id} waits for none of images ${runs(notWaited)}` : ""}`, { hint: `strom task show ${t.id}` });
  // at times the limiter reserves: never faster than a person's pace (10 s, 120 an hour) nor the host's own
  const shared = sharedDir(ctx);
  const netDir = netDirOf(shared, tree)!;
  const take = needed.slice(0, max);
  const times = tree.dryRun ? take.map((_, i) => Date.now() + (i + 1) * HUMAN_PACE.minIntervalMs) : reserveSlots(netDir, g.host, { ...HUMAN_PACE, source: "a person's pace (strom media save --images)" }, take.length, { human: HUMAN_PACE, leadMs: HUMAN_PACE.minIntervalMs });
  const items: RangeItem[] = times.map((at, i) => ({ n: take[i]!, file: waitFileBase(tree.config.id, t.id, take[i]!), at }));
  const rest = needed.slice(items.length);
  const gap = times.length > 1 ? times[1]! - times[0]! : HUMAN_PACE.minIntervalMs;
  // the task waits for them all — the rest over the cap too, which the same command gives once these came (with those it
  // waited for already): the files the browser saves bring it back
  const want = [...new Set([...waited, ...needed])].sort((x, y) => x - y);
  const images = runs(want);
  const lang = tree.lang;
  const wasHeld = loadSaves(tree.root).some((r) => r.task === t.id && r.held);
  const againNow = againOf(t, b.id, want, []);
  const was = t.state === "waiting" && t.awaits?.images === images && t.awaits.again === againNow && !wasHeld;
  if (!was && !tree.dryRun)
    update<Task>(tree, t.id, "task", (x) => {
      const again = againOf(x, b.id, want, []);
      const next: Task = { ...x, state: "waiting", waitingOn: phrase(lang, "browser.wait", { images, book: `${b.id} ${b.title}`, url: u.href }), awaits: { recordset: b.id, images, folder: inboxFolderFor(b), ...(again ? { again } : {}) }, ...(x.where.includes(b.id) ? {} : { where: [...x.where, b.id] }) };
      for (const k of ["awaitsCheck", "awaitsPermission", "wait", "sent", "parkedUntil", "parkedReason"] as const) delete next[k];
      return next;
    }, { op: "task.wait", summary: `${t.id} wait: images ${runs(items.map((i) => i.n))} of ${b.id} through the agent's browser` });
  if (!tree.dryRun) {
    fs.mkdirSync(path.join(shared, "inbox", inboxFolderFor(b)), { recursive: true });
    // each image's record from its slot: a file not there before its time is not held back by the browser
    for (const i of items) noteSave(tree.root, { task: t.id, n: i.n, recordset: b.id, host: u.hostname, url: u.href, file: i.file, at: i.at });
    if (wasHeld) storeSaves(tree.root, loadSaves(tree.root).map(({ held, ...r }) => (r.task === t.id || !held ? r : { ...r, held })));
  }
  const last = items.at(-1)!.at;
  const tileWait = ctx.settings.tileWaitMs();
  const script = rangeScript({ url: u.href, task: t.id, until: Math.max(last + 5 * 60_000, Date.now() + PLAN_TTL_MS), gap, items }, tileWait ? { tileWaitMs: tileWait } : {});
  const then = "strom media add --inbox --waiting";
  const ns = runs(items.map((i) => i.n));
  return {
    text: lines(
      ...tree.written.map((o) => o.summary),
      `${t.id} · images ${ns} of ${b.id} — saved from ${g.host} through your browser, a range (the person consented to it for this archive), one every ${Math.round(gap / 1000)} s, the last about ${clockUp(last)}:`,
      `1. Open ${u.href} in a tab of your own (once): the book's page with its viewer. The script pages through the viewer itself — never reload the page, never open another page of the book for it.`,
      `2. Run this script in that tab with your browser's JavaScript tool; it saves image after image at its time (files ${items[0]!.file}.jpg … in the downloads folder) and answers "strom-result ${items[0]!.n}:200:<bytes> …"; while it works it answers "strom-wait …": run await window.__stromResume() in the same tab, as often as it says so.`,
      script,
      `3. strom media save ${t.id} --result "<its last answer, strom-result …>" — strom keeps what came and what stopped it.`,
      `4. ${then} — moves them into the task's folder, takes them and says which came; never look into the downloads folder yourself.`,
      `It stops at the first image the archive does not give — its check whether a person is there, a login, a refusal, slow down: never pass it, never try another way; step 3 with its answer, then tell the user. Anything else it answers: tell the user.`,
      `Chrome saves one file of a page by itself; the others wait until the user allows ${u.hostname} to download several files (once, at the right end of the address bar), in the browser profile your browser tool works in — never change Chrome's settings yourself.`,
      already.length ? `left out, registered already: images ${runs(already)}` : undefined,
      notWaited.length ? `left out, ${t.id} does not wait for them: images ${runs(notWaited)}` : undefined,
      rest.length ? `the rest, images ${runs(rest)}: the same command again once these came (at most ${max} a call${items.length < take.length ? ", and the limiter's hour is planned" : ""}) — strom media save ${t.id} --images ${runsArg(rest)} --recordset ${b.id} --at ${u.href}` : undefined,
    ),
    data: { task: t.id, recordset: b.id, images: items.map((i) => ({ n: i.n, file: i.file, at: new Date(i.at).toISOString() })), waits: images, url: u.href, script, then, ...(rest.length ? { rest: runsArg(rest) } : {}), ...(already.length ? { registered: already } : {}), ...(notWaited.length ? { notWaited } : {}) },
  };
}

/**
 * strom media save T --image 40,41,45 --at <page>… (1124): several images, each on a page of its own, in one call — the
 * task waits for them all at once (never put to sleep and woken image by image), and one script saves whichever of them
 * the tab shows (core/browser.ts savePagesScript): the agent opens each page with its navigate, one after the other (the
 * tree's hook paces it at a person's pace, as for one image), and runs the same script there; strom media add --inbox
 * --waiting once after the last takes them all. Nothing else changes for the archive: one page, one image, the agent's
 * navigate — no range (core/terms.ts browserRange is the script paging through a viewer itself). --at: one each, in
 * their order, or one address with {n} where the number goes.
 */
function saveSeveral(ctx: Context, tree: Tree, t: Task, ns: number[], ats: string[], opts: Record<string, unknown>) {
  const list = runsArg(ns);
  if (ns.length > SAVE_PAGES_MAX)
    throw new UsageError(`at most ${SAVE_PAGES_MAX} images a call: ${ns.length} given`, { hint: `strom media save ${t.id} --image ${runsArg(ns.slice(0, SAVE_PAGES_MAX))} --at <their pages>; the rest by the same command after` });
  const pages = ats.length === 1 && ats[0]!.includes("{n}") ? ns.map((n) => ats[0]!.split("{n}").join(String(n))) : ats;
  if (pages.length !== ns.length)
    throw new UsageError(`--at: the page of each image (${ns.length}), one --at each in their order, or one address with {n} where the number goes — ${ats.length} given`, {
      hint: `strom media save ${t.id} --image ${list} --at "https://…?image={n}"`,
    });
  const urls: URL[] = [];
  for (const a of pages) {
    let u: URL;
    try {
      u = new URL(a.trim());
    } catch {
      throw new UsageError(`--at <url>: the archive's page of each image — not "${a}"`, { hint: `strom media save ${t.id} --image ${list} --at https://…` });
    }
    if (!/^https?:$/u.test(u.protocol)) throw new UsageError(`--at takes an http(s) address: not "${u.href}"`);
    urls.push(u);
  }
  if (new Set(urls.map((u) => u.hostname)).size > 1) throw new UsageError(`one archive a call: ${[...new Set(urls.map((u) => u.hostname))].join(", ")}`, { hint: `strom media save ${t.id} --image <its images> --at <their pages on one site>` });
  if (new Set(urls.map((u) => u.href)).size < urls.length) throw new UsageError("one page each: two images given the same address", { hint: `strom media save ${t.id} --image ${list} --at <the page of each image>` });
  const w = inboxWaitOf(tree, t);
  const found = opts.recordset ? { book: requireRecord<RecordSet>(tree, normId(String(opts.recordset)), "recordset") } : saveBookOf(tree, t, w, urls[0]!.href);
  const b = found.book;
  if (!b) {
    const several = found.several ?? [];
    throw new UsageError(
      several.length ? `which book images ${runs(ns)} are of: ${t.id} works in ${several.map((x) => `${x.id} ${truncate(x.title, 60)}`).join(", ")} — --recordset names it` : `which book images ${runs(ns)} are of: --recordset B…`,
      { hint: `strom media save ${t.id} --image ${list} --recordset ${several.length ? several.map((x) => x.id).join("|") : "B…"} --at <their pages>` },
    );
  }
  if (t.state === "done" || t.state === "parked" || (t.state === "waiting" && (!w || w.recordset !== b.id)))
    throw new UsageError(`${t.id} is ${t.state}${t.state === "waiting" ? ` — for ${waitKindOf(t) === "images" && w ? `images of ${w.recordset}` : "something else"}` : ""}: images of ${b.id} are saved for a task that works in it`, { hint: `strom task show ${t.id}` });
  const registered = registeredImages(tree, b.id);
  const already = ns.filter((n) => registered.has(n));
  if (already.length && !opts.again)
    throw new UsageError(`image ${runs(already)} of ${b.id} registered already`, {
      hint: `a sharper scan of ${already.length === 1 ? "it" : "them"} (the viewer zoomed in, its full resolution): the same command with --again — taken at once, the one there kept; else leave ${already.length === 1 ? "it" : "them"} out`,
    });
  // each page through the same gate as one image's (the archive's list, robots.txt, the person's permission)
  const shared = sharedDir(ctx);
  let g: WebGate | undefined;
  for (const u of urls) g = saveGate(ctx, tree, t, b, w, u, ns);
  const want = [...new Set([...(w?.by === "images" ? (w.want ?? []) : []), ...ns])].sort((x, y) => x - y);
  const images = runs(want);
  const lang = tree.lang;
  const wasHeld = loadSaves(tree.root).some((r) => r.task === t.id && r.held);
  // the images saved once more: what the task waits for is their new copy (awaits.again), never the one registered
  const againNow = againOf(t, b.id, want, already);
  const was = t.state === "waiting" && t.awaits?.images === images && t.awaits.again === againNow && !wasHeld;
  if (!was && !tree.dryRun)
    update<Task>(tree, t.id, "task", (x) => {
      const again = againOf(x, b.id, want, already);
      const next: Task = { ...x, state: "waiting", waitingOn: phrase(lang, "browser.wait", { images, book: `${b.id} ${b.title}`, url: urls[0]!.href }), awaits: { recordset: b.id, images, folder: inboxFolderFor(b), ...(again ? { again } : {}) }, ...(x.where.includes(b.id) ? {} : { where: [...x.where, b.id] }) };
      for (const k of ["awaitsCheck", "awaitsPermission", "wait", "sent", "parkedUntil", "parkedReason"] as const) delete next[k];
      return next;
    }, { op: "task.wait", summary: `${t.id} wait: images ${runs(ns)} of ${b.id} through the agent's browser, a page each` });
  const items = ns.map((n, i) => ({ n, url: urls[i]!.href, file: waitFileBase(tree.config.id, t.id, n), again: registered.has(n) }));
  if (!tree.dryRun) {
    fs.mkdirSync(path.join(shared, "inbox", inboxFolderFor(b)), { recursive: true });
    if (already.length) tidyDownloads(tree, ctx.settings.downloads());
    const at = Date.now();
    for (const [order, i] of items.entries()) noteSave(tree.root, { task: t.id, n: i.n, recordset: b.id, host: urls[0]!.hostname, url: i.url, file: i.file, at, paged: true, order, ...(i.again ? { again: true } : {}) });
    if (wasHeld) storeSaves(tree.root, loadSaves(tree.root).map(({ held, ...r }) => (r.task === t.id || !held ? r : { ...r, held })));
  }
  const tileWait = ctx.settings.tileWaitMs();
  // each page opened at a person's pace (the hook's): time enough for them all
  const until = Date.now() + PLAN_TTL_MS + ns.length * 2 * 60_000;
  const script = savePagesScript({ pages: items, until, task: t.id }, tileWait ? { tileWaitMs: tileWait } : {});
  const then = "strom media add --inbox --waiting";
  return {
    text: lines(
      ...tree.written.map((o) => o.summary),
      `${t.id} · images ${runs(ns)} of ${b.id} — saved from ${g!.host} through your browser, each on its own page, one after the other${already.length ? ` (${runs(already)} once more: taken at once — beside it when the same scan, sharper; as the image when another, the one there withdrawn and kept)` : ""}:`,
      ...items.map((i) => `   ${i.n}  ${i.url}`),
      `For each image in turn: 1. open its page in your tab (navigate to it as given — strom's hook paces it; never click through the viewer). 2. run the script below in that tab with your browser's JavaScript tool — the same script for every image of the list: it knows the image by the tab's address and answers "strom-result <n>:200:<bytes>"${tileWait ? ` (or "strom-wait …": the same script again in the same tab)` : ""}. Then the next image. Nothing between them: no strom command, no look at the page.`,
      script,
      `After the last: ${then} — once; it takes them all and says which came (never look into the downloads folder yourself). The script answers anything else, or the hook refuses a page: stop there, ${then}, and say at which image and why — never try another way.`,
      `Chrome saves one file of a page by itself; one held back waits until the user allows ${urls[0]!.hostname} to download several files (at the right end of the address bar), in the browser profile your browser tool works in — never change Chrome's settings yourself.`,
    ),
    data: { task: t.id, recordset: b.id, images: items.map((i) => ({ n: i.n, url: i.url, file: i.file, ...(i.again ? { again: true } : {}) })), waits: images, script, then },
  };
}

/**
 * strom media save T --result "<line>": the last answer of a range's script kept (spec 132 K1.5). What stopped it — the
 * archive's check whether a person is there, a login, a refusal, slow down, busy — counts as the archive's refusal in
 * the limiter (nothing goes to it meanwhile, through the agent's browser either), and the images not saved are the
 * person's: the task waits for them by hand. Never a way around it.
 */
function saveRangeResult(ctx: Context, tree: Tree, t: Task, line: string) {
  const got = parseRangeResult(line);
  if (!got.length) throw new UsageError(`--result takes the script's last answer: strom-result 40:200:412918 41:429 …`, { hint: `strom media save ${t.id} --result "<the script's last answer>"` });
  const saves = loadSaves(tree.root).filter((r) => r.task === t.id);
  const rec = saves.find((r) => got.some((g) => g.n === r.n));
  if (!rec) throw new UsageError(`no images of ${t.id} were given to your browser to save: ${runs(got.map((g) => g.n))}`, { hint: `strom task show ${t.id}` });
  const saved = got.filter((g) => g.status === 200);
  const stop = got.find((g) => g.status !== 200);
  if (!stop)
    return {
      text: lines(`${t.id} · images ${runs(saved.map((g) => g.n))} saved by your browser — strom media add --inbox --waiting takes them`, countUnknownAfterSave(tree, rec.recordset)),
      data: { task: t.id, saved: saved.map((g) => g.n), then: "strom media add --inbox --waiting" },
    };
  const host = rec.host;
  const what = stop.stop ?? stop.status;
  const said = what !== undefined && !tree.dryRun ? browserStopped(netDirOf(sharedDir(ctx), tree)!, host, what) : undefined;
  const until = hostBlocked(netDirOf(sharedDir(ctx), tree), host, Date.now())?.until ?? Date.now();
  // the images it did not save: the person's — none of them taken for held back by the browser; with them every image
  // the task waits for of the book that is not registered and was not given to the browser before the stop (the rest
  // over a call's cap too), as its wait says
  const savedNs = new Set(saved.map((g) => g.n));
  const before = new Set(saves.filter((r) => r.recordset === rec.recordset && r.taken === undefined && r.n < stop.n).map((r) => r.n));
  const now = tree.get<Task>(t.id);
  const waits = now?.state === "waiting" && now.awaits?.recordset === rec.recordset ? (parseImageList(now.awaits.images) ?? []) : [];
  const registered = waits.length ? registeredImages(tree, rec.recordset) : new Set<number>();
  const lost = [
    ...new Set([
      ...saves.filter((r) => r.taken === undefined && !savedNs.has(r.n) && r.n >= stop.n).map((r) => r.n),
      ...waits.filter((n) => !savedNs.has(n) && !registered.has(n) && !before.has(n)),
    ]),
  ].sort((x, y) => x - y);
  const b = tree.get<RecordSet>(rec.recordset);
  const lang = tree.lang;
  const why =
    what === "check" ? phrase(lang, "browser.range.why.check") : what === "login" ? phrase(lang, "browser.range.why.login") : what !== undefined ? phrase(lang, "browser.range.why.http", { status: String(what) }) : phrase(lang, "browser.range.why.failed");
  if (!tree.dryRun) {
    storeSaves(tree.root, loadSaves(tree.root).filter((r) => r.task !== t.id || !lost.includes(r.n)));
    if (now?.state === "waiting" && now.awaits?.recordset === rec.recordset) {
      // while it waits for the person, no other range of that archive (rangeHeld)
      noteStop(tree.root, { task: t.id, recordset: rec.recordset, host, n: stop.n, at: Date.now() });
      update<Task>(tree, t.id, "task", (x) => ({ ...x, waitingOn: phrase(lang, "browser.range.stopped", { images: x.awaits!.images, book: b ? `${b.id} ${b.title}` : rec.recordset, n: String(stop.n), why, url: rec.url, host, until: clockUp(until) }) }), {
        op: "task.wait",
        summary: `${t.id} wait: images ${runs(lost.length ? lost : [stop.n])} of ${rec.recordset} for the person — ${host} stopped the agent's browser at image ${stop.n}`,
      });
    }
  }
  return {
    text: lines(
      ...tree.written.map((o) => o.summary),
      `${t.id} · ${saved.length ? `images ${runs([...savedNs])} saved; ` : ""}image ${stop.n} not: ${what === "check" ? "the archive's check whether a person is there" : what === "login" ? "the archive asks for a login" : what !== undefined ? `the archive answered HTTP ${what}` : "the viewer did not give it"}`,
      said ? `${said}.` : undefined,
      `${lost.length ? `Images ${runs(lost)} are the person's to save by hand` : "The rest is the person's"} — the task waits for them. Tell the user; never pass the check, never try another way. ${saved.length ? "strom media add --inbox --waiting takes those that came; " : ""}go on with other work.`,
    ),
    data: { task: t.id, saved: [...savedNs], stopped: { n: stop.n, ...(what !== undefined ? { by: what } : {}) }, forPerson: lost, ...(said ? { until: new Date(until).toISOString() } : {}) },
  };
}

/** "M0012", "B0001:57", "I0002" — or a record set with --image / --page. */
function resolveTarget(tree: Tree, shared: string, ref: string, opts: Record<string, unknown>): { key: string; file: string; media?: Media; page?: number } {
  const at = /^([Bb]\d+):(\d+)$/.exec(ref.trim());
  if (at || /^[Bb]\d+$/.test(ref.trim())) {
    const b = requireRecord<RecordSet>(tree, at ? at[1]! : ref, "recordset");
    let image = at ? Number(at[2]) : opts.image !== undefined ? Number(opts.image) : undefined;
    if (image === undefined && opts.page !== undefined) {
      image = imageOf(b, Number.parseInt(String(opts.page), 10));
      if (image === undefined) throw new UsageError(`${b.id} has no consistent calibration to find page ${opts.page}`, { hint: `measure it: strom recordset calibrate ${b.id} --point <image>=<page>` });
    }
    if (image === undefined) throw new UsageError("which image?", { hint: `${b.id}:57, or --image 57, or --page 112` });
    const m = imageOfRef(tree.list<Media>("media"), b.id, image);
    if (!m) throw notRegistered(tree, b.id, image);
    return { key: m.id, file: path.join(shared, m.file), media: m };
  }
  // a page of a document the user gave: I0002:3
  const paged = /^([Ii]\d+):(\d+)$/.exec(ref.trim());
  const id = normId(paged ? paged[1]! : ref);
  if (id.startsWith("I")) {
    const i = requireRecord<Input>(tree, id, "input");
    const file = inputPath(tree, i);
    if (!file) throw new UsageError(`${i.id} has no file`);
    const page = paged ? Number(paged[2]) : undefined;
    if (page !== undefined && page < 1) throw new UsageError(`no page ${page}`, { hint: `${i.id}:1 is its first page` });
    return { key: i.id, file, ...(page !== undefined ? { page } : {}) };
  }
  const m = requireRecord<Media>(tree, id, "media");
  return { key: m.id, file: path.join(shared, m.file), media: m };
}

/**
 * The longest sides of the views for the agent that runs strom (its shell's marks, else the research's agent) and the
 * model it works with (model.lead, STROM_MODEL from strom run and chat; none: the agent's own): a whole image to find
 * an entry on (find), a part of it to read (read).
 */
export function agentViewSizes(ctx: Context, tree: Tree): ViewSizes {
  const seen = detectAgent(ctx.env);
  const agent = seen && PROFILES[seen] ? seen : ctx.settings.agent(tree.config).value;
  // calibrated for this agent and model (strom media calibrate), else the defaults
  return viewSizesFor(ctx.settings, agent, tree.config, undefined, tree.root);
}

function viewSpec(opts: Record<string, unknown>): ViewSpec {
  const num = (k: string) => {
    if (opts[k] === undefined) return undefined;
    const n = Number(opts[k]);
    if (!Number.isFinite(n) || n <= 0) throw new UsageError(`--${k} must be a positive number`);
    return n;
  };
  const half = opts.half as string | undefined;
  if (half && !["left", "right", "top", "bottom"].includes(half)) throw new UsageError(`invalid --half "${half}"`, { hint: "left, right, top or bottom" });
  const rot = opts.rotate === undefined ? undefined : Number(opts.rotate);
  if (rot !== undefined && ![90, 180, 270].includes(rot)) throw new UsageError("--rotate must be 90, 180 or 270");
  return {
    crop: opts.crop as string | undefined,
    half: half as ViewSpec["half"],
    scale: num("scale"),
    max: num("max"),
    contrast: Boolean(opts.contrast),
    grey: Boolean(opts.grey),
    grid: Boolean(opts.grid),
    rotate: rot as ViewSpec["rotate"],
    png: Boolean(opts.png),
  };
}

/**
 * Several views in one call, at most: about six scans of four views go to one reader, who writes down what each call
 * gave and stops at about 30 views (a context clears older views and they must not be opened again) — a call gives
 * the views of one scan or of a batch.
 */
export const VIEW_MAX_IMAGES = 12;
/** By default; smaller where strom tuned the reading of the agent and model (core/tune.ts, A2). */
export const VIEW_MAX_VIEWS = READING_DEFAULTS.viewsPerCall;
/** The parts of --split overlap by this share of the image (an entry on a border is whole in one of them). */
const SPLIT_OVERLAP = 0.06;

interface Target {
  key: string;
  file: string;
  media?: Media;
  /** As the agent names it: B0001:57, M0012, I0002, I0002:3 (page 3 of a document of pages). */
  ref: string;
  /** The page of a document of several (a PDF), from 1. */
  page?: number;
  /**
   * Named as an image of its record set (B0001:57) that is registered only in parts: a half or a crop is of the whole
   * image, shown from the part that covers it.
   */
  parts?: Media[];
}

/** One kind of view asked for of every image: a half, a crop, both pages of a spread, a grid of parts. */
interface ViewPart {
  half?: ViewSpec["half"];
  crop?: string;
  both?: boolean;
  split?: [number, number];
  label?: string;
}

/** A whole image, shown to find an entry on it (no half, crop or grid of parts): smaller than a view to read by. */
function isOverview(p: ViewPart): boolean {
  return !p.half && !p.both && !p.crop && !p.split;
}

function listOf(v: unknown): string[] {
  return (v === undefined || v === false ? [] : Array.isArray(v) ? v.map(String) : [String(v)]).map((x) => x.trim()).filter(Boolean);
}

function viewParts(opts: Record<string, unknown>): ViewPart[] {
  const halves = listOf(opts.half).flatMap((h) => h.split(",")).map((h) => h.trim()).filter(Boolean);
  for (const h of halves) if (!["left", "right", "top", "bottom", "both"].includes(h)) throw new UsageError(`invalid --half "${h}"`, { hint: "left, right, top, bottom or both" });
  const crops = listOf(opts.crop);
  for (const c of crops) parseCrop(c, 1_000_000, 1_000_000); // a mistake said before anything is made
  const split = opts.split === undefined ? undefined : parseSplit(String(opts.split));
  if (split && crops.some((c) => c.split(/[,\s]+/).filter(Boolean).map(Number).some((n) => n > 1)))
    throw new UsageError("--split takes a crop in fractions", { hint: "--crop 0.05,0.40,0.45,0.18 — x, y, width, height as parts of the image" });
  const out: ViewPart[] = [];
  for (const h of halves.length ? halves : [undefined])
    for (const c of crops.length ? crops : [undefined])
      out.push({
        ...(h === "both" ? { both: true } : h ? { half: h as ViewSpec["half"], label: `${h} half` } : {}),
        ...(c ? { crop: c } : {}),
        ...(split ? { split } : {}),
      });
  return out;
}

function parseSplit(s: string): [number, number] {
  const m = /^\s*([1-5])\s*[x×X*]\s*([1-5])\s*$/u.exec(s);
  if (!m || (m[1] === "1" && m[2] === "1")) throw new UsageError(`invalid --split "${s}"`, { hint: "columns x rows, e.g. 2x3 (at most 5x5)" });
  return [Number(m[1]), Number(m[2])];
}

/** The views one part gives of an image: a half and a crop as they are; both pages of a spread and a grid in pixels of it. */
function partSpecs(t: Target, p: ViewPart, max: number, inHalves = false): { half?: ViewSpec["half"]; crop?: string; label?: string; note?: string }[] {
  if (!p.both && !p.split) return [{ half: p.half, crop: p.crop, label: p.label }];
  // an image registered only in parts: the views are of the whole image, each shown from the part that covers it
  const ofParts = t.parts?.length ? wholeSizeOf(t.parts.find((x) => wholeSizeOf(x)) ?? t.parts[0]!) : undefined;
  const size = ofParts ?? (t.media?.width && t.media.height ? { width: t.media.width, height: t.media.height } : imageSizeOfFile(t.file));
  if (!size) return [{ half: p.half, crop: p.crop, label: p.label }]; // no image there: the view says why
  // the boxes are of the picture as the view shows it: a photo turned a quarter by its EXIF has its sides swapped
  const across = !ofParts && turnsAcross(exifOrientation(t.file));
  const W = across ? size.height : size.width;
  const H = across ? size.width : size.height;
  type Box = { x: number; y: number; w: number; h: number };
  let boxes: { box: Box; label?: string; note?: string }[];
  if (p.both) {
    // the halves rule: the two pages of a spread only where they are sharper than one view of it — a book read worse
    // than the others always in halves (core/tune.ts, A1)
    if (readInHalves(W, H, max) || (inHalves && W > H) || (ofParts && t.parts!.length > 1)) {
      const { left, right } = halves(W, H);
      boxes = [{ box: left, label: "left page" }, { box: right, label: "right page" }];
    } else boxes = [{ box: { x: 0, y: 0, w: W, h: H }, note: "one view: its halves would be no sharper" }];
  } else boxes = [{ box: viewRegion({ half: p.half }, W, H), label: p.label }];
  if (p.crop)
    boxes = boxes.map((b) => {
      const c = parseCrop(p.crop!, b.box.w, b.box.h);
      return { ...b, box: { x: b.box.x + c.x, y: b.box.y + c.y, w: c.w, h: c.h } };
    });
  if (p.split) {
    const [cols, rows] = p.split;
    boxes = boxes.flatMap((b) => {
      const tw = cols === 1 ? 1 : Math.min(1, 1 / cols + SPLIT_OVERLAP);
      const th = rows === 1 ? 1 : Math.min(1, 1 / rows + SPLIT_OVERLAP);
      const out: { box: Box; label?: string; note?: string }[] = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const where = [rows > 1 ? ["top", "middle", "bottom"][r === 0 ? 0 : r === rows - 1 ? 2 : 1] : "", cols > 1 ? ["left", "centre", "right"][c === 0 ? 0 : c === cols - 1 ? 2 : 1] : ""].filter(Boolean).join(" ");
          const x = cols === 1 ? 0 : (c * (1 - tw)) / (cols - 1);
          const y = rows === 1 ? 0 : (r * (1 - th)) / (rows - 1);
          out.push({
            box: { x: b.box.x + x * b.box.w, y: b.box.y + y * b.box.h, w: tw * b.box.w, h: th * b.box.h },
            label: [b.label, `part ${r * cols + c + 1} of ${rows * cols} (${where})`].filter(Boolean).join(", "),
            note: b.note,
          });
        }
      return out;
    });
  }
  return boxes.map((b) => {
    const r = { x: Math.round(b.box.x), y: Math.round(b.box.y), w: Math.max(2, Math.round(b.box.w)), h: Math.max(2, Math.round(b.box.h)) };
    const whole = r.x === 0 && r.y === 0 && r.w >= W && r.h >= H;
    return { ...(whole ? {} : { crop: cropOf(r) }), ...(b.label ? { label: b.label } : {}), ...(b.note ? { note: b.note } : {}) };
  });
}

/** "B0001:57-60,63" for the images of one record set, "B0001 --page 112-115", M…/I… as they are. */
function refsText(wants: { b?: RecordSet; image?: number; page?: number; ref: string }[]): string {
  const span = (ns: number[]) => runs(ns).replace(/–/g, "-").replace(/, /g, ",");
  const out: string[] = [];
  const books = new Map<string, { images: number[]; pages: number[] }>();
  for (const w of wants) {
    if (!w.b) out.push(w.ref);
    else {
      const g = books.get(w.b.id) ?? { images: [], pages: [] };
      if (w.page !== undefined) g.pages.push(w.page);
      else g.images.push(w.image!);
      books.set(w.b.id, g);
    }
  }
  for (const [b, g] of books) {
    if (g.images.length) out.push(`${b}:${span(g.images)}`);
    if (g.pages.length) out.push(`${b} --page ${span(g.pages)}`);
  }
  return out.join(" ");
}

/** A number of an image or page after a record set (B0001 --page 112 113): it belongs to the image named before it. */
const isNumberArg = (a: string) => /^\d+(?:\s*(?:[-–]|\.\.\.?)\s*\d+)?(?:\s*,\s*\d+(?:\s*(?:[-–]|\.\.\.?)\s*\d+)?)*$/u.test(a.trim());

/** The options that make the views of an image (its parts), and those that name more images of a record set. */
const PART_OPTS = new Set(["crop", "half", "split", "grid"]);
const NUMBER_OPTS = new Set(["image", "page"]);

/** The images a part of the line names and the views of them its own options ask. */
interface ImageGroup {
  args: string[];
  /** A record set named bare (B0001 --image 2, B0001 2): a number after its parts is another image of it. */
  book?: string;
  image: string[];
  page: string[];
  crop: string[];
  half: string[];
  split?: string;
  grid?: boolean;
  /** The options of its parts, as typed after it. */
  parts: { opt: string; value?: string }[];
  numbers: number;
}

const groupLabel = (g: ImageGroup) => [...g.args, ...g.image.map((n) => `--image ${n}`), ...g.page.map((n) => `--page ${n}`)].join(" ");

/**
 * The parts of views typed among several images (B0001:2 --crop A B0001:3 --half right; B0001 --image 1 --crop A B0001
 * --image 2 --crop B; B0001 1 --crop A 2 --crop B): each --crop, --half, --split and --grid is of the image named before
 * it — never every part of every image (N0275: 16 views where 4 were meant; a half after an image, an image named by
 * --image or by its number alike). Parts all after the last image, or of one image, are of every image as always
 * (undefined).
 */
function imageGroups(args: string[], seq: Typed[] | undefined): ImageGroup[] | undefined {
  if (!seq) return undefined;
  const groups: ImageGroup[] = [];
  const before: { opt: string; value?: string }[] = [];
  const open = (a: string[], book?: string): ImageGroup => {
    const g: ImageGroup = { args: a, ...(book ? { book } : {}), image: [], page: [], crop: [], half: [], parts: [], numbers: 0 };
    groups.push(g);
    return g;
  };
  // a number after the parts of a record set's image: the next image of that record set, with parts of its own
  const next = (): ImageGroup | undefined => {
    const g = groups.at(-1);
    if (g?.book && g.parts.length && g.numbers) return open([g.book], g.book);
    return g;
  };
  for (const t of seq) {
    if ("arg" in t) {
      const a = args[t.arg];
      if (a === undefined) continue;
      if (!isNumberArg(a)) {
        open([a], /^[Bb]\d+$/u.test(a.trim()) ? a.trim() : undefined);
        continue;
      }
      const prev = groups.at(-1);
      const g = next() ?? open([]);
      // a number after a record set's --page is a page, as resolveTargets reads it
      if (g !== prev && prev?.page.length) g.page.push(a);
      else g.args.push(a);
      g.numbers++;
    } else if (NUMBER_OPTS.has(t.opt)) {
      const g = next() ?? open([]);
      (t.opt === "image" ? g.image : g.page).push(t.value ?? "");
      g.numbers++;
    } else if (PART_OPTS.has(t.opt)) {
      const g = groups.at(-1);
      const part = { opt: t.opt, ...(t.value !== undefined ? { value: t.value } : {}) };
      if (!g) {
        before.push(part);
        continue;
      }
      g.parts.push(part);
      if (t.opt === "crop") g.crop.push(t.value ?? "");
      else if (t.opt === "half") g.half.push(t.value ?? "");
      else if (t.opt === "split") g.split = t.value;
      else g.grid = true;
    }
  }
  // each image its own parts only where an image before the last has some — or a crop stands before any (said below)
  if (groups.length < 2 || !(groups.slice(0, -1).some((g) => g.parts.length) || before.some((p) => p.opt === "crop"))) return undefined;
  const all = [...before, ...groups.flatMap((g) => g.parts)];
  const kind = all.find((p) => p.opt === "crop")?.opt ?? all[0]!.opt;
  const value = (p: { opt: string; value?: string } | undefined) => (p?.value !== undefined ? ` ${p.value}` : "");
  const form = `strom media view ${groupLabel(groups[0]!)} --${kind}${value(all.find((p) => p.opt === kind))} ${groupLabel(groups[1]!)} --${kind}${kind === "grid" ? "" : " …"}`;
  if (before.length)
    throw new UsageError(`a --${before[0]!.opt} before any image: each --${before[0]!.opt} is of the image named before it`, {
      hint: `${form} (the same parts of every image: all of them after the last image)`,
      code: "view.crop-first",
    });
  const bare = groups.find((g) => !g.parts.length);
  if (bare)
    throw new UsageError(`${groupLabel(bare)} has no --${kind} of its own: each --${kind} is of the image named before it`, {
      // a whole view of one image and a part of another (a live run's try, 2026-11-25): two calls, --whole is of all
      hint: `${form} (the same parts of every image: all of them after the last image) — the image whole: a call of its own, strom media view ${groupLabel(bare)}`,
      code: "view.crop-missing",
    });
  return groups;
}

/** The images a call names, at most VIEW_MAX_IMAGES and `maxViews` views of them; images not registered said. */
function resolveTargets(tree: Tree, shared: string, all: Media[], args: string[], opts: Record<string, unknown>, parts: ViewPart[], maxViews = VIEW_MAX_VIEWS, several = false): { targets: Target[]; missing: string[] } {
  const nums = args.filter(isNumberArg);
  const refs = args.filter((a) => !isNumberArg(a)).map((a) => a.trim());
  const pages = listOf(opts.page);
  const images = listOf(opts.image);
  if (pages.length && images.length) throw new UsageError("--page or --image, not both");
  if (nums.length && !refs.some((r) => /^[Bb]\d+$/.test(r)))
    throw new UsageError(`a number alone names no image: ${nums[0]}`, { hint: `with its record set: B0001:${nums[0]}, or B0001 --page ${nums[0]}` });
  // "--page 112 113": the numbers after it are more pages (else more images of --image)
  const pageList = pages.length ? [...pages, ...nums] : [];
  const imageList = pages.length ? [] : [...images, ...nums];
  const list = (s: string[], what: string): number[] => {
    // a range from the higher number, or of hundreds of images: said as such
    for (const p of s.join(",").split(",")) if (/^\s*\d+\s*(?:[-–]|\.\.\.?)\s*\d+\s*$/u.test(p)) imageRange(p.trim(), what === "images" ? "image" : what);
    const n = parseImageList(s.join(","));
    if (n) return n;
    // a page as it was always taken: "112", "12r"
    if (s.length === 1 && what === "--page" && Number.isFinite(Number.parseInt(s[0]!, 10))) return [Number.parseInt(s[0]!, 10)];
    throw new UsageError(`invalid ${what} "${s.join(" ")}"`, { hint: "numbers and ranges: 57, 57-60, 57,59" });
  };
  const wants: { ref: string; b?: RecordSet; image?: number; page?: number }[] = [];
  for (const ref of refs) {
    const at = /^([Bb]\d+):(.+)$/u.exec(ref);
    if (at) {
      const b = requireRecord<RecordSet>(tree, at[1]!, "recordset");
      for (const n of list([at[2]!], "images")) wants.push({ ref: `${b.id}:${n}`, b, image: n });
    } else if (/^[Bb]\d+$/.test(ref)) {
      const b = requireRecord<RecordSet>(tree, ref, "recordset");
      if (pageList.length) for (const p of list(pageList, "--page")) wants.push({ ref: `${b.id} --page ${p}`, b, page: p });
      else if (imageList.length) for (const n of list(imageList, "--image")) wants.push({ ref: `${b.id}:${n}`, b, image: n });
      else throw new UsageError("which image?", { hint: `${b.id}:57, ${b.id}:57-60, or --image 57, or --page 112` });
    } else wants.push({ ref });
  }
  // before anything is made: not more than one look can take in
  const per = parts.reduce((n, p) => n + (p.both ? 2 : 1) * (p.split ? p.split[0] * p.split[1] : 1), 0);
  if (wants.length > VIEW_MAX_IMAGES || wants.length * per > maxViews) {
    const k = Math.min(VIEW_MAX_IMAGES, Math.floor(maxViews / per));
    const same = [...listOf(opts.half).map((h) => `--half ${h}`), ...listOf(opts.crop).map((c) => `--crop ${c}`), ...(opts.split ? [`--split ${String(opts.split)}`] : [])].join(" ");
    throw new UsageError(
      `${counted(wants.length, "image")}${per > 1 ? ` × ${per} views` : ""} — at most ${VIEW_MAX_IMAGES} images and ${maxViews} views in one call: every view stays in the context that opens it${maxViews < VIEW_MAX_VIEWS ? ` (fewer than ${VIEW_MAX_VIEWS}: strom tuned it for this agent and model — strom config get reading.batch)` : ""}`,
      {
        hint: k < 1
          ? `fewer parts of each image (a --split of fewer parts, fewer --crop), at most ${maxViews} views`
          : `${counted(k, "image")} now — write down what they gave before the next call: strom media view ${refsText(wants.slice(0, k))}${same ? ` ${same}` : ""}`,
      },
    );
  }
  const targets: Target[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const w of wants) {
    let t: Target;
    if (w.b) {
      let image = w.image;
      if (w.page !== undefined) {
        image = imageOf(w.b, w.page);
        if (image === undefined) throw new UsageError(`${w.b.id} has no consistent calibration to find page ${w.page}`, { hint: `measure it: strom recordset calibrate ${w.b.id} --point <image>=<page>` });
      }
      // registered only in parts: a half or a crop of the whole image is shown from the part that covers it
      const parts = onlyParts(all, w.b.id, image!);
      const m = parts.length > 1 && (opts.crop !== undefined || opts.half !== undefined || opts.split !== undefined) ? findImage(all, w.b.id, image!) : imageOfRef(all, w.b.id, image!);
      if (!m) {
        if (wants.length === 1 && !several) throw notRegistered(tree, w.b.id, image!);
        missing.push(`${w.b.id}:${image}`);
        continue;
      }
      t = { key: m.id, file: path.join(shared, m.file), media: m, ref: `${w.b.id}:${image}`, ...(parts.length ? { parts } : {}) };
    } else {
      const r = resolveTarget(tree, shared, w.ref, {});
      t = { ...r, ref: r.media && !r.media.part && r.media.recordset && r.media.image !== undefined ? `${r.media.recordset}:${r.media.image}` : r.page ? `${r.key}:${r.page}` : r.key };
    }
    if (seen.has(`${t.key}:${t.page ?? 1}`)) continue;
    seen.add(`${t.key}:${t.page ?? 1}`);
    targets.push(t);
  }
  if (!targets.length && !several) {
    const b = missing[0]!.split(":")[0];
    throw new UsageError(`none of these images is registered: ${missing.join(", ")}`, { hint: waitedLines(tree, missing).join("\n") || `strom media list --recordset ${b} · strom media add <files> --recordset ${b}` });
  }
  return { targets, missing };
}

/** Image n of a book is not registered: why (a task waits for it: how it comes, the next step), else where to look. */
function notRegistered(tree: Tree, recordset: string, n: number): UsageError {
  const w = notYetRegistered(tree, recordset, n);
  if (w) return new UsageError(w.message, { hint: w.hint });
  return new UsageError(`image ${n} of ${recordset} is not registered`, { hint: `strom media list --recordset ${recordset} · strom media add <files> --recordset ${recordset}` });
}

/** Of images not registered ("B0001:64"), those a task waits for: a line each, with its next step. */
function waitedLines(tree: Tree, missing: string[]): string[] {
  return missing.flatMap((ref) => {
    const m = /^(B\p{N}+):(\p{N}+)$/u.exec(ref);
    const w = m ? notYetRegistered(tree, m[1]!, Number(m[2])) : undefined;
    return w ? [`${w.message} — ${w.hint}`] : [];
  });
}

interface OneView {
  v: View;
  /** The image is registered only in parts: the part the view is of (the one that covers the place asked). */
  part?: Media;
  sharper?: SharperCover;
  /** A sharper part that shows much of the place, not nearly all: not used, said (where it is, as the view shows the image). */
  near?: { part: Media; gain: number; shows: Region };
  page: string;
  fetchPart?: string;
  clip?: string;
}

/**
 * One view of one image: from a part fetched sharper where there is one; the clip of what it shows; the archive's
 * sharper part — never of a book whose portal gave none sharper (`noSharper`: core/tune.ts, A5).
 */
function oneView(ctx: Context, tree: Tree, shared: string, all: Media[], target: Target, asked: ViewSpec, meta: ViewMeta = {}, noSharper = false): OneView {
  const { t, spec } = inParts(target, asked, shared);
  // a part of the image fetched sharper (or a sharper copy of all of it) shows the same place with more detail: it is used by itself
  let shown = t.media;
  let v: View | undefined;
  let sharper: SharperCover | undefined;
  let near: OneView["near"];
  if (t.media?.width && t.media.height && !t.media.part) {
    // the place asked is of the picture shown (upright by its EXIF); parts are kept as the file lies
    const o = mediaOrient(shared, t.media);
    const [W, H] = turnsAcross(o) ? [t.media.height, t.media.width] : [t.media.width, t.media.height];
    const px = viewRegion(spec, W, H);
    // a crop drawn a little past a part fetched sharper is shown from it, cut to it (what it leaves out said)
    const cover = sharperCover(all, t.media, shownToFile({ x: px.x / W, y: px.y / H, w: px.w / W, h: px.h / H }, o));
    const s = cover.use && { ...cover.use, ...(cover.use.cut ? { cut: fileToShown(cover.use.cut, o), out: (cover.use.out ?? []).map((x) => fileToShown(x, o)) } : {}) };
    if (cover.near) near = { ...cover.near, shows: fileToShown(cover.near.shows, o) };
    if (s) {
      sharper = s;
      shown = s.part;
      const whole = !s.part.part && !spec.crop && !spec.half;
      v = makeView(tree, path.join(shared, s.part.file), s.part.id, { ...spec, half: undefined, crop: whole ? undefined : regionText(fileToShown(s.crop, mediaOrient(shared, s.part))) }, meta);
    }
  }
  v ??= makeView(tree, t.file, t.key, t.page ? { ...spec, page: t.page } : spec, meta);
  const page = t.media ? pageLabel(tree, t.media) : "";
  // still too little detail: a connector that fetched the image may fetch this part of it sharper
  const base = shown?.part ?? { x: 0, y: 0, w: 1, h: 1 };
  // what the view shows, as the picture lies in its file (a photo shown turned by its EXIF): where clips are kept
  const inFile = shownToFile({ x: v.region.x / v.original.width, y: v.region.y / v.original.height, w: v.region.w / v.original.width, h: v.region.h / v.original.height }, v.orient);
  const inWhole: Region = {
    x: base.x + inFile.x * base.w,
    y: base.y + inFile.y * base.h,
    w: inFile.w * base.w,
    h: inFile.h * base.h,
  };
  const image = t.media?.recordset !== undefined && t.media.image !== undefined ? findImage(all, t.media.recordset, t.media.image) : undefined;
  // a copy of another frame than the image (a screenshot of the screen around the scan, 1124): its clip is of itself
  const whole = image && t.media && !t.media.part && framedApart(t.media, image) ? t.media : image;
  const from = whole?.fetched ? listConnectors(shared).find((c) => c.name === whole.fetched!.connector) : undefined;
  const canPart = from && from.manifest.can.includes("part") && !byHandOnly(from) && !missingConsents(ctx.env, from).code;
  const fetchPart =
    canPart && !noSharper && (v.lifted ?? v.scale) > 1.25 && inWhole.w * inWhole.h < 0.9
      ? `strom fetch ${from.name} --recordset ${whole!.recordset} --images ${whole!.image} --crop ${regionText(inWhole)}`
      : undefined;
  // The same part as a clip of the source read in it: of the whole image where it is registered — as --clip takes it,
  // of the picture as its view shows it (source add keeps it as the file lies)
  const clip =
    !t.media || (!spec.crop && !spec.half)
      ? undefined
      : whole && !whole.part
        ? clipText({ media: whole.id, region: fileToShown(inWhole, mediaOrient(shared, whole)) })
        : clipText({ media: t.key, region: { x: v.region.x / v.original.width, y: v.region.y / v.original.height, w: v.region.w / v.original.width, h: v.region.h / v.original.height } });
  return { v, page, ...(t !== target ? { part: t.media! } : {}), ...(sharper ? { sharper } : {}), ...(near ? { near } : {}), ...(fetchPart ? { fetchPart } : {}), ...(clip ? { clip } : {}) };
}

/**
 * An image registered only in parts (no whole image of it), named as an image of its record set: a half or a crop of
 * the whole image comes from the part that covers it — the sharpest —, the place in that part's own fractions. None
 * covers it: said, with the parts there are; nothing is fetched (the whole image from the archive is the agent's
 * request to make). Anything else: the target as it is.
 */
function inParts(t: Target, spec: ViewSpec, shared: string): { t: Target; spec: ViewSpec } {
  if (!t.parts?.length || (!spec.crop && !spec.half)) return { t, spec };
  const size = wholeSizeOf(t.parts.find((p) => wholeSizeOf(p)) ?? t.parts[0]!);
  if (!size) return { t, spec };
  const px = viewRegion(spec, size.width, size.height);
  const r: Region = { x: px.x / size.width, y: px.y / size.height, w: px.w / size.width, h: px.h / size.height };
  const found = coveringPart(t.parts, r);
  if (!found) {
    const m = t.parts[0]!;
    const from = m.fetched ? `strom fetch ${m.fetched.connector} ${m.fetched.book} --recordset ${m.recordset} --images ${m.image}` : undefined;
    throw new UsageError(`image ${m.image} of ${m.recordset} is registered only in parts, and none of them covers ${regionText(r)}: ${t.parts.map((p) => `${p.id} (part ${regionText(p.part!)})`).join(", ")}`, {
      hint: `a crop within one of those parts (fractions of the whole image), or name the part: ${t.parts.map((p) => p.id).join(" or ")}${from ? ` — the whole image from the archive is one request: ${from}` : ""}`,
    });
  }
  const p = found.part;
  return { t: { key: p.id, file: path.join(shared, p.file), media: p, ref: t.ref }, spec: { ...spec, half: undefined, crop: regionText(found.crop) } };
}

/** Said of a view of an image registered only in parts. */
function partLine(p: Media): string {
  return `from ${p.id}, the part of the image that covers it (part ${regionText(p.part!)}; the image is registered only in parts)`;
}

function sharperLine(s: SharperCover, t: Target): string {
  const from = `from ${s.part.id}, ${s.part.part ? "a part of the image fetched sharper" : "a sharper copy of the image"} (${s.gain.toFixed(1)}× the detail of ${s.part.part ? "the whole image" : t.media!.id})`;
  if (!s.cut) return from;
  // a crop drawn a little past the part: the view is of what the part holds; the strips it leaves out from the whole image
  const out = (s.out ?? []).map((x) => `strom media view ${t.ref} --crop ${regionText(x)}`);
  return `${from}, cut to it: ${regionText(s.cut)} of the place asked${out.length ? ` — the rest (the whole image, less sharp): ${out.join(" · ")}` : ""}`;
}

/** A sharper part beside a view from the whole image: where it shows the place, and the view of that from it. */
function nearLine(n: NonNullable<OneView["near"]>, t: Target): string {
  return `${n.part.id}, a part of the image fetched sharper (${n.gain.toFixed(1)}× the detail), shows ${regionText(n.shows)} of this place, not all of it — this view is from the whole image; that place sharper: strom media view ${t.ref} --crop ${regionText(n.shows)}`;
}

/** A place as the text says it: to a thousandth. */
const rounded = (r: Region): Region => ({ x: Math.round(r.x * 1000) / 1000, y: Math.round(r.y * 1000) / 1000, w: Math.round(r.w * 1000) / 1000, h: Math.round(r.h * 1000) / 1000 });

function viewData(t: Target, r: OneView): Record<string, unknown> {
  const v = r.v;
  return { view: v.file, width: v.width, height: v.height, scale: v.scale, region: v.region, original: v.original, image: r.part?.id ?? t.key, ...(r.sharper ? { from: r.sharper.part.id, ...(r.sharper.cut ? { cut: rounded(r.sharper.cut), left: (r.sharper.out ?? []).map(rounded) } : {}) } : r.part ? { from: r.part.id } : {}), ...(r.near ? { sharper: { part: r.near.part.id, gain: Math.round(r.near.gain * 10) / 10, shows: rounded(r.near.shows) } } : {}), page: r.page || undefined, ...(r.clip ? { clip: r.clip } : {}) };
}

/** The sources that cite an image (its images, or a clip of it): what keeps it from being withdrawn. */
function citingSources(tree: Tree, id: string): Source[] {
  return tree.list<Source>("source").filter((s) => !s.retracted && (s.media?.includes(id) || s.clips?.some((c) => c.media === id)));
}

/** A source's citation of one copy of an image, as a move to another copy would make it (strom media cites --move-to, 1124). */
interface CiteMove {
  source: Source;
  /** Its clips of the old copy carried to the new one: the same place of the same scan. */
  carried: { from: string; to: string }[];
  /** Its clips of the old copy whose place cannot be told on the new one: left as they are, to be marked again. */
  left: { clip: string; n: number }[];
}

/**
 * What a move of the citations of `from` to `to` (two copies of one whole image) does to each source: the copy among
 * its images; a clip of the whole image goes along; a clip of a place goes only when the place is surely that place of
 * the new copy — both files here, strom tells them the same scan (core/samescan.ts: its shape and its writing), turned
 * alike, neither a screenshot beside a copy that is none. Else the clip stays on the old copy, said, to be marked again
 * on the new one (a screenshot shows the screen around the scan, or a cut of it: a place on it is elsewhere on the scan).
 */
function citeMoves(tree: Tree, shared: string, from: Media, to: Media): CiteMove[] {
  let same: boolean | undefined;
  const sameScan = () =>
    (same ??=
      screenshotNamed(from) === screenshotNamed(to) &&
      !framedApart(from, to) &&
      (mediaOrient(shared, from) ?? 1) === (mediaOrient(shared, to) ?? 1) &&
      fs.existsSync(path.join(shared, from.file)) &&
      fs.existsSync(path.join(shared, to.file)) &&
      scanLikeness(path.join(shared, from.file), path.join(shared, to.file)) === "same");
  return citingSources(tree, from.id).map((s) => {
    const move: CiteMove = { source: s, carried: [], left: [] };
    (s.clips ?? []).forEach((c, i) => {
      if (c.media !== from.id) return;
      if (isWhole(c.region) || sameScan()) move.carried.push({ from: clipText(c), to: clipText({ media: to.id, region: c.region }) });
      else move.left.push({ clip: clipText(c), n: i + 1 });
    });
    return move;
  });
}

/** One source's move said: what it cites now, what goes along, what is to be marked again. */
function citeMoveLine(mv: CiteMove, from: Media, to: Media): string {
  return [
    `${mv.source.id} ${truncate(mv.source.title, 60)}: ${to.id} among its images${mv.left.length ? ` (beside ${from.id})` : ` (for ${from.id})`}`,
    ...mv.carried.map((c) => `clip ${c.from} → ${c.to}`),
    ...mv.left.map((l) => `clip ${l.n} ${l.clip} stays: its place on ${to.id} is not told for sure — mark it again (strom media view ${to.id} --grid, then strom source edit ${mv.source.id} --clip ${to.id}@x,y,w,h --clip-remove ${l.n})`),
  ].join(" · ");
}

/**
 * The citations of other copies of an image offered for a move to `image`, the copy that is the image now (1124): each
 * cited copy with its sources and clips, and the one command that moves them — never moved unasked.
 */
function citesOffer(tree: Tree, copies: Media[], image: Media): string[] {
  return copies.flatMap((x) => {
    const by = citingSources(tree, x.id);
    if (!by.length) return [];
    const said = by.map((s) => {
      const clips = (s.clips ?? []).filter((c) => c.media === x.id).map(clipText);
      return `${s.id}${clips.length ? ` (clip ${clips.join(", ")})` : ""}`;
    });
    return [`${x.id} is cited by ${said.join(", ")} — to cite ${image.id}, the image, instead: strom media cites ${x.id} --move-to ${image.id} (it says what moves first with --dry-run; nothing moves unasked, ${x.id} stays)`];
  });
}

register(
  {
    path: ["media", "add"],
    summary: "Register scans or photos of records (a folder, files, or the shared inbox) — tied to a record set",
    group: "sources",
    tree: true,
    writes: true,
    lock: "sections",
    description:
      "Each image is stored once in the shared media store (by its content) and gets an ID (M…). The image number\n" +
      "is the last number in the file name (s0057.jpg → 57), or counted from --first. Look at them with strom media view.",
    args: [{ name: "paths", description: "image files or folders", variadic: true }],
    options: [
      { name: "recordset", type: "string", value: "<B…>", description: "the book or collection the images are of" },
      { name: "image", type: "string", value: "<n>", description: "image number (one file)" },
      { name: "first", type: "string", value: "<n>", description: "number the images in file order from n (instead of from their names)" },
      { name: "url", type: "string", value: "<url>", description: "where the images come from (portal, catalog entry)" },
      { name: "from", type: "string", value: "<text>", description: "who provided them or how they were obtained" },
      { name: "inbox", type: "boolean", description: "take the files the user put in the shared inbox (they are moved into the store); a folder there is named as the argument — one folder, one record set" },
      { name: "waiting", type: "boolean", description: "with --inbox: take the folders of the tasks that wait for images (strom task wait --images, a site with one book) — each folder whose files settled, numbered by their names, else by their order when as many as missing; the tasks they complete come back (the bridge does it as they are saved, a session's start too); then the folders of the books tasks need that no task waits on, numbered by their names alone — the book's tasks read them from disk" },
      { name: "half", type: "string", value: "<side>", description: "the file is a half of image n: left, right, top or bottom (a half page saved on its own)" },
      { name: "crop", type: "string", value: "<x,y,w,h>", description: "the file is this part of image n: fractions of it, or pixels of the registered image (a detail saved from the viewer)" },
      { name: "from-input", type: "string", multiple: true, value: "<I…>", description: "inputs that are the scans of a book (a batch from the Strom app): their files registered as its images, numbered by their names" },
    ],
    examples: [
      "strom media add ~/Downloads/tynec17 --recordset B0001 --url https://archive.example.org/register/17",
      "strom media add --inbox register-17 --recordset B0001",
      "strom media add --inbox --recordset B0001",
      "strom media add --inbox --waiting",
      "strom media add ~/Downloads/40-left.jpg --recordset B0001 --image 40 --half left",
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const shared = sharedDir(ctx);
      const inbox = path.join(shared, "inbox");
      if (opts.waiting) {
        if (!opts.inbox) throw new UsageError("--waiting goes with --inbox", { hint: "strom media add --inbox --waiting" });
        if (args.length || opts.recordset || opts.first !== undefined || opts.image !== undefined) throw new UsageError("--waiting takes the folders of the waiting tasks as they are: no folder, --recordset, --first or --image");
        // what the agent's browser saved for them (strom media save) first goes into their folders
        const downloads = ctx.settings.downloads();
        // a file the browser is still writing (a scan just saved): waited for a moment, then taken with the rest
        const writing = tree.dryRun ? [] : waitForDownloads(tree, downloads, ctx.env as NodeJS.ProcessEnv);
        const taken = takeWaiting(tree, shared, { downloads });
        const woken = taken.flatMap((t) => t.woken);
        // what the agent's browser was to save and never saved: held back by the browser — said, to the person too
        const held = heldSaves(tree, shared, downloads);
        // strom's own files of images registered already (a copy saved late or twice): never left in the downloads
        const tidied = tidyDownloads(tree, downloads);
        // what this session's task waits for first, the others in one line beside it
        const mine = currentSession(tree, ctx.env)?.task;
        const waits = inboxWaits(tree).filter((x) => x.by === "images");
        const saves = loadSaves(tree.root);
        const pending = againPending(tree);
        const missingOf = (x: InboxWait) => awaitedMissing(tree, x.task, x.want ?? [], { have: registeredImages(tree, x.recordset), pending });
        const own = waits.find((x) => x.task === mine);
        const ownLines: string[] = [];
        // still being written after the wait: said, never as "nothing came"
        const writingLines = writing.map((d) => `image ${d.n} (${d.task}): its download is still being written in the downloads folder (${d.name}) — this command again in a few seconds takes it`);
        const missingNow = own ? missingOf(own).filter((n) => !writing.some((d) => d.task === own.task && d.n === n)) : [];
        if (own && missingNow.length) {
          const missing = missingNow;
          const given = saves.filter((r) => r.task === own.task && r.taken === undefined && missing.includes(r.n) && !held.some((h) => h.task === r.task && h.n === r.n));
          const last = given.length ? new Date(Math.max(...given.map((r) => r.at))).toTimeString().slice(0, 8) : undefined;
          ownLines.push(
            `${own.task} (this session's task) still waits for image${missing.length > 1 ? "s" : ""} ${runs(missing)} of ${own.recordset}: nothing of ${missing.length > 1 ? "them" : "it"} came yet — not in the downloads folder, not in its folder ${ctx.display(path.join(shared, "inbox", own.folder))}${
              given.length ? ` (the script of ${runs(given.map((r) => r.n))} given at ${last}: the browser saves it within seconds — this command once more in a moment says whether it came)` : ""
            }. Never look into the downloads folder yourself.`,
          );
        }
        const heldMine = held.filter((h) => !mine || h.task === mine);
        const heldOthers = held.filter((h) => mine && h.task !== mine);
        const others = waits.filter((x) => x.task !== own?.task && missingOf(x).length);
        const side = others.length
          ? `${mine ? "other tasks wait as well (not this session's)" : "tasks waiting"}: ${others
              .map((x) => `${x.task} images ${runs(missingOf(x))} of ${x.recordset}${heldOthers.some((h) => h.task === x.task) ? ` (the browser held back ${runs(heldOthers.filter((h) => h.task === x.task).map((h) => h.n))})` : ""}`)
              .join(", ")}`
          : undefined;
        const nothing = !taken.length && !held.length && !ownLines.length && !side && !writing.length;
        // a book whose images came whole and whose count is not known: how its count is written (never the highest number)
        const counts = [...new Set(taken.filter((x) => x.added.length).map((x) => x.recordset))].map((b) => countUnknownAfterSave(tree, b));
        return {
          text: lines(
            nothing ? (waits.length ? "nothing came: no file in the downloads folder or the folders of the waiting tasks" : "no task waits for images saved into the inbox") : undefined,
            ...takenLines(taken),
            ...counts,
            ...writingLines,
            ...ownLines,
            ...heldMine.map((h) => heldLine(ctx, h, downloads)),
            side,
            tidied.length ? `${counted(tidied.length, "file")} of strom's own in the downloads folder removed: ${tidied.slice(0, 5).join(", ")}${tidied.length > 5 ? " …" : ""} — copies of images registered already` : undefined,
          ),
          data: {
            taken,
            woken,
            held: held.map((h) => ({ task: h.task, recordset: h.recordset, image: h.n, host: h.host, url: h.url, since: new Date(h.at).toISOString() })),
            waits: waits.map((x) => ({ task: x.task, recordset: x.recordset, missing: missingOf(x), ...(x.task === mine ? { current: true } : {}) })).filter((x) => x.missing.length),
            tidied,
            ...(writing.length ? { writing: writing.map((d) => ({ task: d.task, image: d.n, file: d.name })) } : {}),
          },
        };
      }
      let paths: string[];
      if (opts.inbox) {
        // Each folder in the inbox is one download: never two books into one record set.
        const folders = inboxFolders(inbox);
        if (args.length === 0 && folders.length > 1)
          throw new UsageError(`the inbox holds ${folders.length} downloads — one record set each`, {
            hint: folders.map((f) => `strom media add --inbox ${f.folder ? shellArg(f.folder) : "."} --recordset B…   (${f.files.length} file${f.files.length > 1 ? "s" : ""})`).join("\n"),
          });
        const only = folders.length === 1 && folders[0]!.folder ? path.join(inbox, folders[0]!.folder) : inbox;
        // a folder named in any Unicode form (NFD from a macOS shell, NFC on Linux)
        const inInbox = (a: string) => {
          const hit = folders.find((f) => f.folder && f.folder.normalize("NFC") === a.normalize("NFC").replace(/[\\/]+$/, ""));
          return hit ? path.join(inbox, hit.folder) : path.resolve(inbox, a);
        };
        paths = args.length ? args.map(inInbox) : [only];
        for (const p of paths)
          if (path.relative(inbox, p).startsWith("..")) throw new UsageError(`${ctx.display(p)} is not in the inbox`, { hint: "strom media add --inbox <folder in the inbox> --recordset B…" });
        // "." = the files lying in the inbox itself, not its folders
        paths = paths.flatMap((p) => (p === inbox ? (folders.find((f) => f.folder === "")?.files ?? []) : [p]));
      } else paths = args.map((a) => ctx.resolvePath(a));
      // scans of a book that came as material (a batch): their files, numbered by the names they came with
      const fromInputs = (Array.isArray(opts["from-input"]) ? opts["from-input"] : opts["from-input"] ? [opts["from-input"]] : []).flatMap((x) => String(x).split(",")).filter(Boolean);
      const names = new Map<string, string>();
      const taken: Input[] = [];
      if (fromInputs.length) {
        if (!opts.recordset) throw new UsageError("the scans of which book? --recordset B…", { hint: 'strom recordset add "<the book>" … first' });
        for (const a of fromInputs) {
          const i = requireRecord<Input>(tree, a, "input");
          const f = inputPath(tree, i);
          if (!f || !fs.existsSync(f)) throw new UsageError(`${i.id}: its file is not on this computer`);
          names.set(f, i.path ?? i.name);
          taken.push(i);
          paths.push(f);
        }
      }
      if (paths.length === 0) throw new UsageError("give files or folders, or --inbox");
      for (const p of paths) if (!fs.existsSync(p)) throw notFound(ctx.display(p));
      const nameOf = (f: string) => names.get(f) ?? f;
      const files = collectFiles(paths).filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()));
      // numbers are read per folder: one download names its files one way
      const numbers = new Map<string, number | undefined>();
      for (const dir of new Set(files.map((f) => path.dirname(nameOf(f))))) {
        const group = files.filter((f) => path.dirname(nameOf(f)) === dir);
        imageNumbers(group.map(nameOf)).forEach((n, i) => numbers.set(group[i]!, n));
      }
      if (files.length === 0) throw new UsageError("no images there", { hint: "JPEG, PNG, TIFF … files; documents go in with strom intake" });
      // a folder the user filled for a waiting task (strom task wait --images) says which book and which images
      const folderOf = (p: string) => (opts.inbox && !path.relative(inbox, p).startsWith("..") ? path.relative(inbox, p).split(path.sep)[0]?.normalize("NFC") : undefined);
      const folder = paths.length === 1 ? folderOf(paths[0]!) : undefined;
      const awaited = folder
        ? tree.list<Task>("task").find((t) => t.state === "waiting" && t.awaits && t.awaits.folder.normalize("NFC") === folder && (!opts.recordset || normId(String(opts.recordset), "recordset") === t.awaits.recordset))?.awaits
        : undefined;
      const named = folder ? /^([Bb]\d+)(?=\s|$)/.exec(folder)?.[1] : undefined;
      const recordset = opts.recordset
        ? requireRecord<RecordSet>(tree, String(opts.recordset), "recordset").id
        : (awaited?.recordset ?? (named && tree.get<RecordSet>(normId(named, "recordset")) ? normId(named, "recordset") : undefined));
      if (opts.image !== undefined && files.length > 1) throw new UsageError("--image is for one file; for many use --first or numbers in the file names");
      // a part of an image saved on its own: registered with its image, as a part fetched sharper is
      const wantsPart = opts.half !== undefined || opts.crop !== undefined;
      if (wantsPart && (files.length > 1 || !opts.recordset)) throw new UsageError("a part is one file of one image of a record set", { hint: "strom media add <file> --recordset B… --image <n> --half left" });
      const first = opts.first === undefined ? undefined : Number(opts.first);
      const items = files.map((file, i) => ({
        file,
        image: opts.image !== undefined ? Number(opts.image) : first !== undefined ? first + i : numbers.get(file),
        url: opts.url as string | undefined,
        // the original file name always stays: it is how the archive numbered the image
        from: opts.from ? `${opts.from} · ${path.basename(nameOf(file))}` : path.basename(nameOf(file)),
      }));
      if (wantsPart && recordset) {
        const it = items[0]!;
        if (it.image === undefined) throw new UsageError("which image is it a part of? --image <n>", { hint: "strom media add <file> --recordset B… --image <n> --half left" });
        const whole = findImage(tree.list<Media>("media").filter((m) => !m.part), recordset, it.image);
        // of the whole image as its view shows it (upright by its EXIF)
        (it as { part?: Region }).part = partRegion(opts, whole, mediaOrient(shared, whole));
      }
      // a folder of a waiting task: numbered by the names, else by their order when as many as the images missing
      let byOrder = false;
      let leftLying: string[] = [];
      let byFolder = false;
      if (awaited && recordset && !opts.first && opts.image === undefined && !wantsPart) {
        // asked now: what is named not by the images' numbers is taken in the folder's order at once (spec 141 K1.3)
        const numbered = numberFiles(items.map((it) => it.file), parseImageList(awaited.images), registeredImages(tree, recordset), recordset, bookTimes(tree, recordset), { quiet: true });
        if ("problem" in numbered) throw new UsageError(numbered.problem, { hint: "--image <n> for that file", code: numbered.code, params: numbered.params });
        if ("later" in numbered) throw new UsageError("not numbered"); // never: asked now
        // what gives no image's number (000.jpg) stays lying, never holding back the rest (K1.1)
        if (numbered.files) {
          const keep = new Set(numbered.files);
          items.splice(0, items.length, ...items.filter((it) => keep.has(it.file)));
          files.splice(0, files.length, ...files.filter((f) => keep.has(f)));
          leftLying = (numbered.left ?? []).map((l) => path.basename(l.file));
        }
        if (numbered.by === "order" || numbered.by === "folder") {
          if (numbered.by === "order") byOrder = true;
          else byFolder = true;
          // in the order of the folder (as a person sorts it), not as collected
          const order = folderFiles(path.join(inbox, awaited.folder));
          items.sort((a, b) => order.indexOf(a.file) - order.indexOf(b.file));
        }
        items.forEach((it, i) => (it.image = numbered.numbers[i]));
      }
      // another sheet under an image's number (7a.jpg beside 7.jpg, or 7.jpg registered already): told by its content —
      // a copy, a zoomed-in part or a scan of its own — as the bridge's take does it, never hidden as a copy by its name
      // alone (spec 141 K1.4; n1: the folder named, the task back or none waiting)
      let sheets: string[] = [];
      if (recordset && !opts.first && opts.image === undefined && !wantsPart && !byOrder && !byFolder) {
        const named = items.filter((it) => it.image !== undefined);
        const sf = named.map((it) => it.file);
        const sn = named.map((it) => it.image!);
        sheets = takeSheets(tree, shared, recordset, sf, sn, { remove: false, url: opts.url as string | undefined, from: (f) => items.find((it) => it.file === f)?.from ?? path.basename(f) });
        if (sheets.length) {
          const still = new Set(sf);
          items.splice(0, items.length, ...items.filter((it) => it.image === undefined || still.has(it.file)));
        }
      }
      if (recordset) {
        // an image of a book without its number cannot be cited — nor found again
        const bare = items.filter((it) => it.image === undefined);
        if (bare.length)
          throw new UsageError(`${counted(bare.length, "file")} without an image number in the name: ${bare.slice(0, 5).map((it) => path.basename(it.file)).join(", ")}${bare.length > 5 ? " …" : ""}`, {
            hint: `${bare.some((it) => entriesOf(it.file)) ? "a name by the entries on a scan (001-004.jpg) gives no image's number: " : ""}--first <n> for files in the folder's order (the entries in such names are kept), --image <n> for one file; or each named by its number as the portal's viewer counts it (9.jpg; the number in the name is enough, __0009.jpg)`,
          });
      }
      // what the person put into the shared inbox: the tasks it completes go ahead in the queue, once (core/queue.ts goesAhead)
      const { added, again, restored, woken, clashes, copies, clashed } = registerImages(tree, shared, items, recordset, opts.inbox ? { ahead: new Date().toISOString() } : {});
      // taken in the folder's order: the tasks waiting on the folder back at once, to tell each by its content (K1.3)
      if (byFolder && folder && recordset && !tree.dryRun) {
        const said = items.filter((it) => it.image !== undefined).map((it) => `${path.basename(nameOf(it.file))} → image ${it.image}`);
        const at = items.map((it) => it.image).filter((n): n is number => n !== undefined);
        woken.push(
          ...wakeBack(
            tree,
            tree
              .list<Task>("task")
              .filter((t) => t.state === "waiting" && t.awaits?.recordset === recordset && t.awaits.folder.normalize("NFC") === folder)
              .map((t) => ({
                task: t.id,
                why: `images of ${recordset} named not by their numbers, taken in the folder's order`,
                note: `${counted(said.length, "file")} saved into ${folder}/ were named not by the images' numbers — taken in the folder's order as images ${runs(at)} of ${recordset}, the next numbers of the book: ${said.join("; ")}${leftLying.length ? `; left lying: ${leftLying.join(", ")}` : ""}. Which scan each is (its years, its entries) is read off it: strom media view ${recordset}:<n>; what is still missing: strom task wait ${t.id} --images ${recordset}:<n> --on "…" again, or --kind web --book ${recordset} with the years or entries in --on`,
              })),
            new Date().toISOString(),
          ),
        );
      }
      // the material is the book's images now: sorted, done with
      for (const i of taken) {
        const m = i.sha ? recordsBySha<Media>(tree, "media", i.sha).find((x) => !x.retracted) : undefined;
        update<Input>(tree, i.id, "input", (x) => ({ ...x, state: "processed", sorted: { as: "source", reason: `${m ? `${m.id}, ` : ""}an image of ${recordset}`, at: new Date().toISOString(), by: tree.actor } }), {
          op: "input.sort",
          summary: `${i.id} an image of ${recordset}${m ? ` (${m.id})` : ""}`,
        });
      }
      const setAside: string[] = [];
      if (opts.inbox && !tree.dryRun) {
        // the same file as another image (B0408): never deleted unsaid — set aside beside it, kept
        const clash = new Map(clashed.map((c) => [c.file, c.same]));
        for (const f of files) {
          const same = clash.get(f);
          if (same === undefined) {
            fs.rmSync(f, { force: true }); // now in the store
            continue;
          }
          try {
            fs.renameSync(f, `${f}.same-as-${same}`);
            setAside.push(`${path.basename(f)} set aside as ${path.basename(f)}.same-as-${same} (the same scan as ${same}) — kept`);
          } catch {
            setAside.push(`${path.basename(f)} left lying (the same scan as ${same}) — kept`);
          }
        }
        for (const p of paths) if (p !== inbox && fs.existsSync(p) && fs.statSync(p).isDirectory() && collectFiles([p]).length === 0) fs.rmSync(p, { recursive: true, force: true });
      }
      const nums = added.map((m) => m.image).filter((n): n is number => n !== undefined);
      const text = lines(
        added.length
          ? `${counted(added.length, "image")} registered: ${added[0]!.id}${added.length > 1 ? `–${added.at(-1)!.id}` : ""}${recordset ? ` of ${recordset}` : ""}${nums.length ? ` (images ${runs(nums)}${byOrder ? ", numbered by their order: the names gave none of the numbers asked for" : ""})` : ""}`
          : restored.length || sheets.length ? undefined : "no new images",
        restored.length ? `${counted(restored.length, "image")} put back (their file was not here; the same scan): ${restored.slice(0, 5).join(" ")}${restored.length > 5 ? " …" : ""}` : undefined,
        again.length ? `${again.length} already registered (same content): ${again.slice(0, 5).join(" ")}${again.length > 5 ? " …" : ""}` : undefined,
        ...clashes.slice(0, 10).map((c) => `⚠ ${c}`),
        ...setAside.slice(0, 10).map((c) => `  ${c}`),
        ...copies.slice(0, 10),
        copies.length > 10 ? `… and ${copies.length - 10} more images with a sharper copy` : undefined,
        ...sheets,
        woken.length ? `back in the queue (they waited for these images): ${woken.join(" ")}` : undefined,
        byFolder ? `named not by the images' numbers: numbered in the folder's order from ${nums[0] ?? "—"}, the next numbers of the book — which scan each is (its years, its entries) is read off it` : undefined,
        ...added.filter((m) => m.entries).slice(0, 10).map((m) => `  ${m.id} image ${m.image ?? "—"}: entries ${entriesText(m.entries!)} by its name`),
        leftLying.length ? `left lying (no image's number in the name): ${leftLying.slice(0, 10).join(", ")}${leftLying.length > 10 ? " …" : ""} — --image <n> for one of them, once its content says which` : undefined,
        ...stillWaiting(tree, recordset),
        recordset && added.length ? countUnknownAfterSave(tree, recordset) : undefined,
        added[0] ? `\nlook at one: strom media view ${recordset && added[0].image !== undefined ? `${recordset}:${added[0].image}` : added[0].id} --grid` : undefined,
      );
      return { text, data: { added: added.map((m) => ({ id: m.id, image: m.image })), again, woken, clashes, copies, ...(sheets.length ? { sheets } : {}) } };
    },
  },
  {
    path: ["media", "save"],
    summary: "Save one image of a book from the archive's page in your browser — the script for your tab (an archive only a person's browser goes to, with the person's permission \"through the browser\")",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "For an archive with no connector that only a person's browser goes to, where the person allowed it \"through the\n" +
      "browser\": the task waits for image n of its book (set so here, or already by strom task wait --images), you open\n" +
      "the archive's page of that one image in a tab of your own (strom's hook paces it) and run the script this prints\n" +
      "there — it saves what the page shows (the archive's viewer as it shows it, else its largest image) into the\n" +
      "downloads folder as strom-<research>-T…-<n>.jpg. strom media add --inbox --waiting then moves it into the task's folder as\n" +
      "image n, takes it and says whether it came (never read the downloads folder yourself); the task comes back once all\n" +
      "it waits for are there; a copy saved late or twice is tidied once the image is registered. One image at a time,\n" +
      "never a book; nothing is asked of the archive but the page you open. Refused where strom's list or the archive's robots.txt keeps\n" +
      "automated tools off, without the person's permission, and for an agent whose browser strom does not keep — the\n" +
      "person saves it by hand then. An image registered already that reads too weak: --again saves it once more (the\n" +
      "viewer zoomed in, its full resolution) and strom media add --inbox --waiting takes it at once: the same scan,\n" +
      "sharper, goes beside it as a copy (the sharpest is the image); another scan of it is the image, the one there\n" +
      "withdrawn and kept (one a source cites stays beside it) — nothing to set aside or answer, no media aside --take.\n" +
      "\n" +
      `--image 40,41,45 (at most ${SAVE_PAGES_MAX}) with an --at each, in their order (or one address with {n} where the number\n` +
      "goes): one script for them all — open each page in turn and run the same script there (it knows the image by the\n" +
      "tab's address), nothing between them; one strom media add --inbox --waiting after the last. Give every image the\n" +
      `task needs in one call — more than ${SAVE_PAGES_MAX}: the next call right after it, before any page — so its wait holds them\n` +
      "all and it never looks done while one is still to come (one saved once more counts once its new copy came). Each image is still a\n" +
      "page of its own, opened by you at a person's pace (strom's hook paces it): no range. Claude Code: more than 3 images —\n" +
      "this tree's subagent strom-image-saver saves them (its context stays small).\n" +
      "\n" +
      "--images a-b: a range of the book's images in one script, paged through the archive's own viewer at a person's\n" +
      "pace — only at an archive strom's list lets have it, and only with the person's own consent for this archive\n" +
      "(strom allow archive <host> --range, besides \"through the browser\"); none of strom's list has it yet. At most 20 a\n" +
      "call; the script stops at the first image the archive does not give (its check whether a person is there, a login,\n" +
      "a refusal) and --result \"<its last answer>\" keeps that, all the images left to the person; while that task waits\n" +
      "for them, no other range of that archive is given.",
    args: [{ name: "task", description: "the task the image is for (T…)", required: true }],
    options: [
      { name: "image", type: "string", value: "<n>", description: `the image number, as the archive's viewer counts it; several (40,41,45-47, at most ${SAVE_PAGES_MAX}): one script for them all, each image still on a page of its own` },
      { name: "at", type: "string", multiple: true, value: "<url>", description: "the archive's page of that one image (as its viewer's address names it); several images: one --at each, in their order, or one address with {n} where the number goes" },
      { name: "recordset", type: "string", value: "<B…>", description: "the book (else the one the task waits for, or the one of its books on the archive of --at)" },
      { name: "again", type: "boolean", description: "an image registered already, saved once more (a sharper scan: the viewer zoomed in, its full resolution) — taken at once: the same scan, sharper, a copy beside it (the sharpest is the image); another scan of it the image, the one there withdrawn and kept (one a source cites stays beside it)" },
      { name: "images", type: "string", value: "<a-b>", description: "a range of the book's images in one script, through its viewer (--at: the book's page) — only where strom's list lets the archive have it and the person consented for it (strom allow archive <host> --range)" },
      { name: "result", type: "string", value: "<line>", description: "the last answer of the script of a range (strom-result …): what came, and what stopped it, kept" },
    ],
    examples: ["strom media save T0007 --image 40 --at https://archive.example.org/viewer/book-17?image=40", "strom media save T0007 --image 40 --recordset B0003 --at https://archive.example.org/viewer/book-17?image=40 --again", "strom media save T0007 --image 40-45 --recordset B0003 --at \"https://archive.example.org/viewer/book-17?image={n}\" --again", "strom media save T0007 --images 40-52 --at https://archive.example.org/viewer/book-17"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const t = requireRecord<Task>(tree, normId(args[0]!), "task");
      if (opts.result !== undefined) return saveRangeResult(ctx, tree, t, String(opts.result));
      if (opts.images !== undefined) {
        if (opts.image !== undefined || opts.again) throw new UsageError("--images or --image: a range, or one image (--again: one image only)", { hint: `strom media save ${t.id} --images <a-b> --at <the book's page>` });
        return saveRange(ctx, tree, t, opts);
      }
      // several images, each on a page of its own (1124): one call, one script for them all
      const several = parseImageList(String(opts.image ?? "").trim());
      const ats = listOpt(opts.at);
      if (several && several.length > 1) return saveSeveral(ctx, tree, t, several, ats, opts);
      if (ats.length > 1) throw new UsageError(`one --at for one image: ${ats.length} given`, { hint: `strom media save ${t.id} --image <n> --at <the archive's page of it>` });
      opts = { ...opts, ...(ats.length ? { at: ats[0] } : {}) };
      const n = Number(String(opts.image ?? "").trim());
      if (!Number.isInteger(n) || n < 1)
        throw new UsageError(`--image <n>: the image's number, as the archive's viewer counts it (several: --image 40,41,45 — at most ${SAVE_PAGES_MAX} a call)`, { hint: `strom media save ${t.id} --image <n> --at <the archive's page of it>` });
      const w = inboxWaitOf(tree, t);
      // the book: the one named, else the one the task waits for, else the one of its books on the archive of --at
      const found = opts.recordset ? { book: requireRecord<RecordSet>(tree, normId(String(opts.recordset)), "recordset") } : saveBookOf(tree, t, w, String(opts.at ?? ""));
      const b = found.book;
      if (!b) {
        const several = found.several ?? [];
        throw new UsageError(
          several.length
            ? `which book image ${n} is of: ${t.id} works in ${several.map((x) => `${x.id} ${truncate(x.title, 60)}`).join(", ")} — --recordset names it`
            : `which book image ${n} is of: --recordset B…`,
          { hint: `strom media save ${t.id} --image ${n} --recordset ${several.length ? several.map((x) => x.id).join("|") : "B…"} --at <the archive's page of it>` },
        );
      }
      if (t.state === "done" || t.state === "parked" || (t.state === "waiting" && (!w || w.recordset !== b.id)))
        throw new UsageError(`${t.id} is ${t.state}${t.state === "waiting" ? ` — for ${waitKindOf(t) === "images" && w ? `images of ${w.recordset}` : "something else"}` : ""}: an image of ${b.id} is saved for a task that works in it`, { hint: `strom task show ${t.id}` });
      const again = registeredImages(tree, b.id).has(n);
      if (again && !opts.again)
        throw new UsageError(`image ${n} of ${b.id} is registered already`, {
          hint: `strom media view ${b.id}:${n} shows it; a sharper scan of it (the viewer zoomed in, its full resolution): strom media save ${t.id} --image ${n} --recordset ${b.id} --at ${String(opts.at ?? "").trim() || "<the archive's page of it>"} --again — taken at once, the one there kept`,
        });
      let u: URL;
      try {
        u = new URL(String(opts.at ?? "").trim());
      } catch {
        throw new UsageError("--at <url>: the archive's page of the one image", { hint: `strom media save ${t.id} --image ${n} --at https://…` });
      }
      if (!/^https?:$/u.test(u.protocol)) throw new UsageError(`--at takes an http(s) address: not "${u.href}"`);
      const shared = sharedDir(ctx);
      const g = saveGate(ctx, tree, t, b, w, u, [n]);
      // the task waits for the image (with those it waited for already): the file the browser saves brings it back
      const want = [...new Set([...(w?.by === "images" ? (w.want ?? []) : []), n])].sort((x, y) => x - y);
      const images = runs(want);
      const lang = tree.lang;
      // said held back before (its wait asks the person to allow the downloads): the wait as it is again, the script given anew
      const wasHeld = loadSaves(tree.root).some((r) => r.task === t.id && r.held);
      // saved once more: what the task waits for is its new copy (awaits.again), never the one registered
      const againNow = againOf(t, b.id, want, again ? [n] : []);
      const was = t.state === "waiting" && t.awaits?.images === images && t.awaits.again === againNow && !wasHeld;
      if (!was && !tree.dryRun)
        update<Task>(tree, t.id, "task", (x) => {
          const more = againOf(x, b.id, want, again ? [n] : []);
          const next: Task = { ...x, state: "waiting", waitingOn: phrase(lang, "browser.wait", { images, book: `${b.id} ${b.title}`, url: u.href }), awaits: { recordset: b.id, images, folder: inboxFolderFor(b), ...(more ? { again: more } : {}) }, ...(x.where.includes(b.id) ? {} : { where: [...x.where, b.id] }) };
          for (const k of ["awaitsCheck", "awaitsPermission", "wait", "sent", "parkedUntil", "parkedReason"] as const) delete next[k];
          return next;
        }, { op: "task.wait", summary: `${t.id} wait: image ${n} of ${b.id} through the agent's browser` });
      const dir = path.join(shared, "inbox", inboxFolderFor(b));
      if (!tree.dryRun) fs.mkdirSync(dir, { recursive: true });
      const file = waitFileBase(tree.config.id, t.id, n);
      if (!tree.dryRun) {
        // saved once more: strom's late copies of the earlier save tidied first — never taken for the new one
        if (again) tidyDownloads(tree, ctx.settings.downloads());
        noteSave(tree.root, { task: t.id, n, recordset: b.id, host: u.hostname, url: u.href, file, at: Date.now(), ...(again ? { again: true } : {}) });
        // the task's other images held back before: asked of the person once more by this wait, so said anew
        if (wasHeld) storeSaves(tree.root, loadSaves(tree.root).map(({ held, ...r }) => (r.task === t.id || !held ? r : { ...r, held })));
      }
      // browser.tileWait: the viewer's tiles waited for while they come, the script run again while it answers strom-wait
      const tileWait = ctx.settings.tileWaitMs();
      const script = saveScript({ url: u.href, file, n, task: t.id, until: Date.now() + PLAN_TTL_MS, other: phrase(lang, "browser.save.other", { n: String(n), url: u.href }) }, tileWait ? { tileWaitMs: tileWait } : {});
      const then = "strom media add --inbox --waiting";
      return {
        text: lines(
          ...tree.written.map((o) => o.summary),
          `${t.id} · image ${n} of ${b.id} — saved from ${g.host} through your browser, this one image${again ? ` once more (registered already: step 3 takes the new scan at once — beside it when the same, sharper; as image ${n} when another, the one there withdrawn and kept — nothing to set aside or answer)` : ""}:`,
          `1. Open ${u.href} in a tab of your own (once; a tab of yours on it already: that one). Never another image or page of the book for it.`,
          `2. Run this script in that tab with your browser's JavaScript tool; it answers "strom-result ${n}:200:<bytes>" (the file ${file}.jpg in the downloads folder):`,
          script,
          ...(tileWait ? [`   It answers "strom-wait …" while the viewer's tiles still come (browser.tileWait): run the same script again in the same tab, as often as it says so — it goes on where it is.`] : []),
          `3. ${then} — moves it into the task's folder as image ${n}, takes it and says whether it came and where it is now (or that nothing came yet); never look into the downloads folder yourself. Anything else the script answers: tell the user, never try another way.`,
          `Chrome saves one file of a page by itself; one more from the same page waits until the user allows ${u.hostname} to download several files (once, at the right end of the address bar), in the browser profile your browser tool works in — a permission given in another profile does not count. The script said saved and nothing came: tell the user, never change Chrome's settings yourself.`,
        ),
        data: { task: t.id, recordset: b.id, image: n, waits: images, url: u.href, file, script, then, ...(again ? { again: true } : {}) },
      };
    },
  },
  {
    path: ["media", "list"],
    summary: "Registered images (of one record set, a range of images)",
    group: "sources",
    tree: true,
    args: [{ name: "recordset", description: "only this record set — the same as --recordset (B0001, or B0001:90-120 with the images)" }],
    options: [
      { name: "recordset", type: "string", value: "<B…>", description: "only this record set" },
      // --image 5: that one image (N1009's guess), as --images 5-5
      { name: "images", type: "string", value: "<from-to>", description: "only these image numbers, e.g. 90-120", readAs: ["image"], readAsValue: (v) => (/^\s*\d+\s*$/u.test(v) ? `${v.trim()}-${v.trim()}` : v) },
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      // the record set as agents type it: strom media list B0001 (or B0001:90-120)
      if (args[0]) {
        const m = /^([^:]+)(?::(.+))?$/u.exec(args[0].trim());
        if (opts.recordset && m && normId(m[1]!) !== normId(String(opts.recordset))) throw new UsageError("one record set: the argument or --recordset");
        opts = { ...opts, recordset: m?.[1] ?? args[0], ...(m?.[2] && !opts.images ? { images: m[2] } : {}) };
      }
      let all = tree.list<Media>("media");
      if (opts.recordset) {
        const b = requireRecord<RecordSet>(tree, String(opts.recordset), "recordset").id;
        all = all.filter((m) => m.recordset === b);
      }
      if (opts.images) {
        const m = /^(\d+)(?:-(\d+))?$/.exec(String(opts.images));
        if (!m) throw new UsageError("--images must be like 90-120");
        const lo = Number(m[1]);
        const hi = Number(m[2] ?? m[1]);
        all = all.filter((x) => x.image !== undefined && x.image >= lo && x.image <= hi);
      }
      all.sort((a, b) => (a.recordset ?? "").localeCompare(b.recordset ?? "") || (a.image ?? 0) - (b.image ?? 0) || Number(!!a.part) - Number(!!b.part));
      const page = paginate(all, ctx.limit, ctx.page);
      // a part as --crop takes it: of the whole image as its view shows it (kept as the file lies: --json, as a record)
      const shared = ctx.settings.shared()?.value;
      const every = tree.list<Media>("media");
      return {
        text: all.length
          ? lines(
              table(page.items.map((m) => [m.id, m.recordset ? `${m.recordset}:${m.image ?? "?"}` : "", m.part ? `part ${regionText(partShown(shared, every, m)!)}` : "", pageLabel(tree, m), m.width ? `${m.width}×${m.height}` : "", `${Math.round(m.size / 1024)} kB`])),
              moreLine(page, "strom media list"),
            )
          : "no images registered → strom media add <folder> --recordset B…",
        data: { total: all.length, media: page.items.map((m) => ({ id: m.id, recordset: m.recordset, image: m.image, part: m.part, page: pageLabel(tree, m) || undefined, width: m.width, height: m.height })) },
      };
    },
  },
  {
    path: ["media", "show"],
    summary: "One image: where it is from, its page, the sources on it",
    group: "sources",
    tree: true,
    args: [{ name: "image", description: "M0012 or B0001:57", required: true }],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const t = resolveTarget(tree, sharedDir(ctx), args[0]!, opts);
      const m = t.media;
      if (!m) throw new UsageError("not a registered image", { hint: "strom media list" });
      const sources = tree.list<Source>("source").filter((s) => s.media?.includes(m.id));
      const b = m.recordset ? tree.get<RecordSet>(m.recordset) : undefined;
      const all = tree.list<Media>("media");
      const parts = !m.part && m.recordset && m.image !== undefined ? all.filter((x) => x.part && !x.retracted && x.recordset === m.recordset && x.image === m.image) : [];
      const copies = otherCopies(all, m);
      const image = copies.length && m.recordset && m.image !== undefined ? findImage(all, m.recordset, m.image) : undefined;
      // copies of more pixels than the image, behind it as screenshots of another frame (1124)
      const pixels = (x: Media) => (x.width ?? 0) * (x.height ?? 0);
      const screened = image ? [m, ...copies].filter((x) => x.id !== image.id && pixels(x) > pixels(image) && framedApart(x, image)).map((x) => x.id) : [];
      return {
        text: lines(
          `${m.id} ${m.part ? `part ${regionText(partShown(sharedDir(ctx), all, m)!)} of ` : ""}${b ? `image ${m.image ?? "?"} of ${b.id} ${b.title}` : "image"}${pageLabel(tree, m) ? ` · page ${pageLabel(tree, m)}` : ""}`,
          `${m.width ? `${m.width}×${m.height} px · ` : ""}${Math.round(m.size / 1024)} kB · ${mediaMime(m, ctx.settings.shared()?.value)}${m.from ? ` · from ${m.from}` : ""}${m.url ? ` · ${m.url}` : ""}`,
          m.retracted ? `RETRACTED ${localDayOf(m.retracted.at)}: ${m.retracted.reason} — no view, part or excerpt uses it` : undefined,
          parts.length ? `parts of it, sharper (a view of the image uses them by itself): ${parts.map((p) => `${p.id} ${regionText(partShown(sharedDir(ctx), all, p)!)}${p.width ? ` ${p.width}×${p.height}` : ""}`).join(" · ")}` : undefined,
          copies.length
            ? `other copies of the image: ${copies.map((c) => `${c.id}${c.width ? ` ${c.width}×${c.height}` : ""}`).join(" · ")} — the image is ${screened.length ? `${image!.id} (${screened.join(", ")}: a screenshot of another frame, not a sharper scan)` : `the sharpest (${image!.id})`}; a view of any copy uses it`
            : undefined,
          ...(image && image.id !== m.id && sources.length ? citesOffer(tree, [m], image) : []),
          sources.length ? `sources on it: ${sources.map((s) => `${s.id} ${s.title}`).join(" · ")}` : "no source cites it yet",
          m.list ? `sent to the list "${m.list.name}" · ${m.list.count} ${m.list.count === 1 ? "person" : "people"}${m.list.missing ? ` (${m.list.missing} more not in the research)` : ""}${m.list.rule ? ` · rule: ${m.list.rule}` : ""} · ${path.join(tree.root, ...m.list.file.split("/"))}` : undefined,
          `view: strom media view ${m.id} [--half left|right] [--crop x,y,w,h] [--grid]`,
        ),
        data: { media: m, parts: parts.map((p) => p.id), copies: copies.map((c) => c.id), sources: sources.map((s) => s.id), page: pageLabel(tree, m) || undefined },
      };
    },
  },
  {
    path: ["media", "retract"],
    summary: "Withdraw an image registered wrongly — another book's, a wrong number, a part put in the wrong place (kept, marked retracted)",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "The image stays in the research with the reason, but no view, sharper part or excerpt uses it any more, and its\n" +
      "file can be registered again where it belongs. An image a source still cites is not withdrawn: move the\n" +
      "source to the right image first (strom source edit S… --clip …, --clip-remove).",
    args: [{ name: "image", description: "M0012", required: true }],
    examples: ['strom media retract M0001 --reason "a part of another book\'s image 340, not of this one"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.reason) throw new UsageError("--reason is required", { hint: 'say why: --reason "another book\'s image, same number"', code: "reason.missing" });
      const m = requireRecord<Media>(tree, normId(args[0]!), "media");
      if (m.retracted) return { text: `${m.id} is already retracted: ${m.retracted.reason}`, data: { media: m } };
      const citing = citingSources(tree, m.id);
      if (citing.length) {
        // another copy of the same image is the image: the one command that moves the citations to it (1124)
        const all = tree.list<Media>("media");
        const image = otherCopies(all, m).length && m.recordset !== undefined && m.image !== undefined ? findImage(all, m.recordset, m.image) : undefined;
        throw new UsageError(`${m.id} is cited by ${citing.map((s) => s.id).join(", ")}`, {
          hint: image && image.id !== m.id ? `move them to ${image.id}, the image, first: strom media cites ${m.id} --move-to ${image.id}` : `move them to the right image first: strom source show ${citing[0]!.id}`,
        });
      }
      const out = update<Media>(tree, m.id, "media", (x) => ({ ...x, retracted: { at: now(), reason: String(opts.reason) } }), { op: "media.retract", summary: `${m.id} retracted: ${truncate(String(opts.reason), 80)}` });
      return { text: lines(...tree.written.map((o) => o.summary)), data: { media: out } };
    },
  },
  {
    path: ["media", "cites"],
    summary: "The sources that cite an image — and their move to another copy of the same image (--move-to)",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "Without --move-to: the sources that cite the image (among their images, or a clip of it) and the other copies\n" +
      "of the same image. With --move-to <M…> (another copy of the same whole image, e.g. a scan saved properly beside\n" +
      "a screenshot): each of those sources cites that copy instead. A clip goes along only when its place is surely\n" +
      "that place of the new copy (both files here, the same scan, turned alike, no screenshot beside a scan); else it\n" +
      "stays on the old copy and is said, to be marked again on the new one. The old copy stays as it is (not\n" +
      "withdrawn); once nothing cites it, strom media retract can withdraw it. Nothing moves without --move-to;\n" +
      "--dry-run says what would.",
    args: [{ name: "image", description: "M0012 (the copy cited now)", required: true }],
    options: [{ name: "move-to", type: "string", value: "<M…>", description: "another copy of the same image: the sources cite it instead (the old copy stays)" }],
    examples: ["strom media cites M0003", "strom media cites M0003 --move-to M0004"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const shared = sharedDir(ctx);
      const from = requireRecord<Media>(tree, normId(args[0]!), "media");
      const all = tree.list<Media>("media");
      const copies = otherCopies(all, from);
      const image = copies.length && from.recordset !== undefined && from.image !== undefined ? findImage(all, from.recordset, from.image) : undefined;
      const what = (m: Media) => `${m.id}${m.width ? ` ${m.width}×${m.height}` : ""}${m.from ? ` (${truncate(m.from, 60)})` : ""}`;
      if (opts["move-to"] === undefined) {
        const by = citingSources(tree, from.id);
        const clipsOf = (s: Source) => (s.clips ?? []).filter((c) => c.media === from.id).map(clipText);
        return {
          text: lines(
            by.length ? `${from.id} is cited by ${counted(by.length, "source")}:` : `no source cites ${from.id}`,
            ...by.map((s) => `  ${s.id} ${truncate(s.title, 60)}${clipsOf(s).length ? ` · clip ${clipsOf(s).join(", ")}` : ""}`),
            copies.length ? `other copies of the image: ${copies.map(what).join(" · ")}${image ? ` — the image is ${image.id}` : ""}` : `no other copy of ${from.recordset !== undefined && from.image !== undefined ? `${from.recordset}:${from.image}` : "this image"} is registered`,
            by.length && image && image.id !== from.id ? `to cite ${image.id} instead: strom media cites ${from.id} --move-to ${image.id} (--dry-run first says what moves)` : undefined,
          ),
          data: { media: from.id, sources: by.map((s) => ({ id: s.id, clips: clipsOf(s) })), copies: copies.map((c) => c.id), image: image?.id },
        };
      }
      const to = requireRecord<Media>(tree, normId(String(opts["move-to"])), "media");
      if (to.id === from.id) throw new UsageError(`${from.id} is the copy cited now: --move-to names another copy`, { hint: `strom media cites ${from.id}` });
      if (!copies.some((c) => c.id === to.id))
        throw new UsageError(`${to.id} is no other copy of the same whole image as ${from.id}${to.retracted ? " (it is retracted)" : ""}`, {
          hint: copies.length ? `its copies: ${copies.map((c) => c.id).join(", ")}` : `strom media show ${from.id}`,
          code: "media.cites.not-a-copy",
        });
      const moves = citeMoves(tree, shared, from, to);
      if (!moves.length) return { text: `no source cites ${from.id}: nothing to move`, data: { media: from.id, to: to.id, moved: [] } };
      tree.withTreeLock(() => {
        for (const mv of moves) {
          const carried = new Set(mv.carried.map((c) => c.from));
          update<Source>(
            tree,
            mv.source.id,
            "source",
            (x) => {
              const clips: Clip[] = [];
              for (const c of x.clips ?? []) {
                const next = c.media === from.id && carried.has(clipText(c)) ? { media: to.id, region: c.region } : c;
                if (!clips.some((k) => clipText(k) === clipText(next))) clips.push(next);
              }
              const stays = clips.some((c) => c.media === from.id);
              const media = [...new Set((x.media ?? []).flatMap((id) => (id === from.id ? (stays ? [from.id, to.id] : [to.id]) : [id])))];
              if (!media.includes(to.id)) media.push(to.id);
              return { ...x, media, ...(x.clips ? { clips } : {}) };
            },
            {
              op: "source.edit",
              targets: [from.id, to.id],
              summary: `${mv.source.id} cites ${to.id}, another copy of ${from.recordset}:${from.image}, ${mv.left.length ? "beside" : "for"} ${from.id}${mv.carried.length ? ` · clip ${mv.carried.map((c) => `${c.from} → ${c.to}`).join(", ")}` : ""}${mv.left.length ? ` · to mark again on ${to.id}: ${mv.left.map((l) => l.clip).join(", ")}` : ""}`,
            },
          );
        }
      });
      const left = moves.some((mv) => mv.left.length);
      return {
        text: lines(
          ...moves.map((mv) => citeMoveLine(mv, from, to)),
          left ? `${from.id} stays cited by the clips to mark again; once they are, strom media retract ${from.id} can withdraw it` : `${from.id} stays as it is, cited by nothing now (strom media retract ${from.id} --reason "…" withdraws it, kept)`,
        ),
        data: { media: from.id, to: to.id, moved: moves.map((mv) => ({ source: mv.source.id, carried: mv.carried, left: mv.left })) },
      };
    },
  },
  {
    path: ["media", "aside"],
    summary: "Files of the inbox set aside, not taken — the same scan as another image, or another scan than the image of their number: list them, or say which one is the image",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "Images saved by hand into a book's folder of the inbox that strom did not take: the same file as an image\n" +
      "registered under another number (one of the two numbers is wrong), or another scan than the image registered\n" +
      "under its number already (never taken as a sharper copy of it, unasked). Without a file: the list. With one,\n" +
      "the answer: --discard (the image registered stays; the file into the system's trash), --take (another scan: it\n" +
      "is the image of its number — the one there withdrawn and kept, one a source cites stays beside it), --image <n>\n" +
      "(another scan: it is image n, a number not taken yet).",
    args: [{ name: "file", description: "the file's name as listed (or <folder>/<file>)" }],
    options: [
      { name: "discard", type: "boolean", description: "the image registered stays; the file goes into the system's trash" },
      { name: "take", type: "boolean", description: "another scan: it is the image of its number (the one there withdrawn, kept)" },
      { name: "image", type: "string", value: "<n>", description: "another scan: it is image n of the book (a number not taken yet)" },
    ],
    examples: ["strom media aside", "strom media aside 3.jpg.other-than-M0003 --take", "strom media aside 3.jpg.other-than-M0003 --image 203", "strom media aside 3.jpg.other-than-M0003 --discard"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const shared = sharedDir(ctx);
      const all = asideFiles(tree, shared);
      const said = (a: AsideFile) =>
        a.kind === "same"
          ? `${a.folder}/${a.file}: saved as image ${a.image ?? "?"} of ${a.recordset}, the same file as ${a.media} — one of the two numbers is wrong`
          : `${a.folder}/${a.file}: saved as image ${a.image ?? "?"} of ${a.recordset}, another scan than ${a.media} registered as that image — which one is it?`;
      const json = (a: AsideFile) => ({ folder: a.folder, file: a.file, name: a.name, recordset: a.recordset, image: a.image, kind: a.kind, media: a.media, at: a.at });
      const answers = [opts.discard, opts.take, opts.image !== undefined].filter(Boolean).length;
      if (!args[0]) {
        if (answers) throw new UsageError("which file? strom media aside <file> …", { hint: "strom media aside (the list)" });
        return {
          text: all.length ? lines(`${counted(all.length, "file")} of the inbox set aside, not taken:`, ...all.map((a) => `  ${said(a)}`), "answer: strom media aside <file> --discard | --take | --image <n>") : "no file of the inbox set aside",
          data: { aside: all.map(json) },
        };
      }
      const want = String(args[0]).normalize("NFC");
      const a = all.find((x) => x.file.normalize("NFC") === want || `${x.folder}/${x.file}`.normalize("NFC") === want);
      if (!a) throw new UsageError(`no file set aside named ${args[0]}`, { hint: "strom media aside (the list)", code: "aside.unknown" });
      if (answers !== 1) return { text: lines(said(a), "answer: --discard | --take | --image <n>"), data: { aside: json(a) } };
      if (opts.discard) {
        if (!tree.dryRun) moveToTrash(a.path, ctx.env, a.file);
        return { text: `${a.file} into the system's trash — ${a.media} stays${a.image !== undefined ? ` image ${a.image} of ${a.recordset}` : ""}`, data: { aside: json(a), done: "discard" } };
      }
      if (a.kind === "same") throw new UsageError(`${a.file} is the same file as ${a.media}, registered already: nothing to take`, { hint: `--discard; or renumber the image of ${a.media} (strom media retract ${a.media} --reason "…", then strom media add …)`, code: "aside.same" });
      const n = opts.take ? a.image : Number(opts.image);
      if (n === undefined || !Number.isInteger(n) || n < 1) throw new UsageError(opts.take ? `${a.file}: its name gives no image number` : `--image ${opts.image}: an image number`, { hint: "--image <n>" });
      const media = tree.list<Media>("media").filter((m) => !m.retracted && m.recordset === a.recordset && m.image === n && isWhole(m.part));
      if (opts.image !== undefined && media.length && media.every((m) => !fs.existsSync(path.join(shared, m.file)) || scanLikeness(a.path, path.join(shared, m.file)) !== "same"))
        throw new UsageError(`image ${n} of ${a.recordset} is there already (${media.map((m) => m.id).join(", ")}), another scan`, { hint: `--take for image ${a.image ?? "?"}, or another number`, code: "aside.taken" });
      const replaced: string[] = [];
      const out = tree.withTreeLock(() => {
        if (opts.take)
          for (const m of media) {
            const cited = tree.list<Source>("source").some((s) => !s.retracted && (s.media?.includes(m.id) || s.clips?.some((c) => c.media === m.id)));
            if (cited) continue; // what a source cites stays; the new scan is registered beside it
            update<Media>(tree, m.id, "media", (x) => ({ ...x, retracted: { at: now(), reason: `another scan of image ${n} is the image (${a.file})` } }), { op: "media.retract", summary: `${m.id} retracted: another scan of image ${n} is the image` });
            replaced.push(m.id);
          }
        const book = tree.get<RecordSet>(a.recordset);
        return registerImages(tree, shared, [{ file: a.path, image: n, url: book?.url, from: a.name }], a.recordset);
      });
      if (!tree.dryRun && out.added.length) fs.rmSync(a.path, { force: true });
      const kept = media.filter((m) => !replaced.includes(m.id));
      return {
        text: lines(
          out.added.length ? `${a.file} registered as image ${n} of ${a.recordset}: ${out.added[0]!.id}` : `${a.file} not registered`,
          replaced.length ? `withdrawn, kept: ${replaced.join(" ")}` : undefined,
          opts.take && kept.length ? `cited by a source, stays beside it: ${kept.map((m) => m.id).join(" ")}` : undefined,
          ...(opts.take && kept.length && out.added[0] ? citesOffer(tree, kept, out.added[0]) : []),
          ...out.clashes.map((c) => `⚠ ${c}`),
          ...out.copies,
          out.woken.length ? `back in the queue (they waited for these images): ${out.woken.join(" ")}` : undefined,
        ),
        data: { aside: json(a), done: opts.take ? "take" : "image", image: n, added: out.added.map((m) => m.id), replaced, woken: out.woken },
      };
    },
  },
  {
    path: ["media", "view"],
    summary: "Make views of images to look at: a crop, a half page, enlarged, more contrast, a grid — several in one call",
    group: "sources",
    sheet: `at most ${VIEW_MAX_IMAGES} images a call; several crops of an image: --crop … --crop … (no loop), of each image: IMG --crop … IMG --half …; a whole view finds, only a crop is read; a book read through: strom read`,
    tree: true,
    description:
      `Writes the views to .strom/views/ and prints their paths: open those files with your image reader. A whole image\n` +
      `is at most ${OVERVIEW_MAX} px on the long side, enough to find an entry; a half, a crop and the parts of --split at most\n` +
      `what your model takes in whole (${IMAGE_MAX_LARGE} px for the newer models, else ${IMAGE_MAX}) — unless --scale or --max says\n` +
      "otherwise, or the person calibrated the sizes for this agent and model (strom media calibrate; strom config get\n" +
      "views.size). Browse whole images; read an entry by cropping it — use --grid first to see where it is (the labels\n" +
      "are tenths of the image).\n" +
      "Several views in one call, then open all the files it lists together: several images (B0001:57 B0001:58, a range\n" +
      "B0001:57-60, B0001 --page 112 113), several parts of each (--half left --half right; --half both = the two pages\n" +
      "of a double page overlapping at the gutter, where they are sharper than one view of it, else the image whole;\n" +
      "--crop repeated; --split 2x3 = a grid of overlapping parts), each view with its image, page and --clip. A --crop,\n" +
      "--half, --split or --grid typed after an image among others is of that image alone (B0001:2 --crop … B0001:7\n" +
      "--half right; B0001 --image 2 --crop … B0001 --image 7 --crop …; B0001 2 --crop … 7 --crop …); parts after the\n" +
      "last image are of every image; an image whole beside parts of another: two calls (--whole is of every image).\n" +
      "An image registered only in parts (its two halves, M0005 and M0006, of B0001:60): the parts whole by their IDs\n" +
      "(strom media view M0005 M0006); a --half or a --crop of B0001:60 is of the whole image, in its fractions, shown from\n" +
      "the part that covers it (B0001:60 alone names no view: which part?). At most\n" +
      `${VIEW_MAX_IMAGES} images and ${VIEW_MAX_VIEWS} views in one call: every view stays in the context that opens it.`,
    args: [{ name: "image", description: "M0012, B0001:57 (record set:image), a range B0001:57-60, B0001 with --page, an input I0002, or a page of an input document I0002:3 (a PDF; HEIC and PDF are converted for reading, the original kept); several = several images", required: true, variadic: true }],
    options: [
      { name: "crop", type: "string", multiple: true, value: "<x,y,w,h>", description: "part of the image: fractions (0.1,0.35,0.4,0.2) or pixels; repeated = several parts; after one image of several: of that image alone (--half, --split, --grid too)" },
      { name: "half", type: "string", multiple: true, value: "<side>", description: "left or right page of a double page (top, bottom); both = the two pages, overlapping at the gutter" },
      { name: "split", type: "string", value: "<c>x<r>", description: "the image (or each half or crop) as a grid of overlapping parts, e.g. 2x3" },
      { name: "scale", type: "string", value: "<f>", description: "size of the result: 2 = twice the original pixels" },
      { name: "max", type: "string", value: "<px>", description: `longest side when not scaled (default: a whole image ${OVERVIEW_MAX}, a part what your model takes, ${IMAGE_MAX} or ${IMAGE_MAX_LARGE})` },
      { name: "contrast", type: "boolean", description: "stretch faded ink (on the part shown)" },
      { name: "grey", type: "boolean", description: "greyscale" },
      { name: "grid", type: "boolean", description: "overlay a grid of tenths with labels, to point at a place" },
      { name: "rotate", type: "string", value: "<deg>", description: "90, 180 or 270" },
      { name: "image", type: "string", multiple: true, value: "<n>", description: "image number(s) with a record set ID: 57, 57-60, 57..60" },
      { name: "page", type: "string", multiple: true, value: "<n>", description: "page(s) or folio(s), with a calibrated record set ID: 112, 112 113, 112-115" },
      { name: "png", type: "boolean", description: "lossless PNG instead of JPEG" },
      { name: "whole", type: "boolean", description: "the image whole — as without --crop, --half or --split (a view to find an entry on)" },
    ],
    examples: [
      "strom media view B0001:2 --grid",
      "strom media view B0001:2 --half left --contrast",
      "strom media view M0001 --crop 0.05,0.40,0.45,0.18",
      "strom media view B0001 --page 112",
      "strom media view B0001:1-3 --half both",
      "strom media view B0001:2 --crop 0.05,0.10,0.45,0.30 --crop 0.05,0.40,0.45,0.30",
      "strom media view B0001:2 --crop 0.05,0.10,0.45,0.30 B0001:3 --crop 0.50,0.60,0.45,0.20",
      "strom media view B0001 --page 112 113 --split 2x2",
      "strom media view I0005:2 --half top",
      "strom media view M0005 M0006",
      "strom media view B0001:60 --crop 0.55,0.30,0.40,0.20",
    ],
    run(ctx, { args, opts, seq }) {
      // the whole image is what a view is without a part of it (strom read --whole: each image in one view)
      if (opts.whole === true) {
        const part = ["crop", "half", "split"].find((o) => opts[o] !== undefined && listOf(opts[o]).length);
        if (part) throw new UsageError(`--whole is the image whole: no --${part} with it`, { hint: `the whole image: strom media view ${args.join(" ")}; a part of it: --${part} without --whole` });
      }
      const tree = ctx.tree();
      const shared = sharedDir(ctx);
      const all = tree.list<Media>("media");
      const parts = viewParts(opts);
      const groups = imageGroups(args, seq);
      // a whole image to find the entry on; a part of it (a half, a crop, a grid's part) as big as the model takes it
      const own = agentViewSizes(ctx, tree);
      // what strom tuned for this agent and model (core/tune.ts) — as at the start of the session at work: the numbers
      // hold for the whole of it
      const since = currentSession(tree, ctx.env)?.started;
      const tuned: TuneState = treeTuning(tree, ctx.settings);
      const reading = readingOf(ctx.settings.config, own.key, { since, on: tuningOn(ctx.settings), root: tree.root });
      // each image with its own parts (imageGroups), else every part of every image
      const partsOf = new Map<Target, ViewPart[]>();
      const gridOf = new Map<Target, boolean>();
      let targets: Target[] = [];
      let missing: string[] = [];
      if (!groups) ({ targets, missing } = resolveTargets(tree, shared, all, args, opts, parts, reading.viewsPerCall));
      else {
        for (const g of groups) {
          const some = (v: string[]) => (v.length ? v : undefined);
          const own = { ...opts, crop: some(g.crop), half: some(g.half), split: g.split, grid: g.grid, image: some(g.image), page: some(g.page) };
          const gp = viewParts(own);
          const r = resolveTargets(tree, shared, all, g.args, own, gp, reading.viewsPerCall, true);
          for (const t of r.targets) {
            partsOf.set(t, gp);
            gridOf.set(t, !!g.grid);
          }
          targets.push(...r.targets);
          missing.push(...r.missing);
        }
        if (!targets.length) {
          const b = missing[0]!.split(":")[0];
          throw new UsageError(`none of these images is registered: ${missing.join(", ")}`, { hint: `strom media list --recordset ${b} · strom media add <files> --recordset ${b}` });
        }
        const views = targets.reduce((n, t) => n + partsOf.get(t)!.reduce((m, p) => m + (p.both ? 2 : 1) * (p.split ? p.split[0] * p.split[1] : 1), 0), 0);
        if (targets.length > VIEW_MAX_IMAGES || views > reading.viewsPerCall)
          throw new UsageError(`${counted(targets.length, "image")}, ${counted(views, "view")} — at most ${VIEW_MAX_IMAGES} images and ${reading.viewsPerCall} views in one call: every view stays in the context that opens it`, {
            hint: "fewer images now — write down what they gave before the next call",
          });
      }
      const partsFor = (t: Target) => partsOf.get(t) ?? parts;
      const asked = viewSpec({ ...opts, half: undefined, crop: undefined });
      // a small crop enlarged as the model takes it, above a calibrated reading size (never above --max asked)
      const spec: ViewSpec = { min: own.min, ...(asked.max === undefined && asked.scale === undefined ? { liftMax: own.max } : {}), ...asked };
      // a book read worse than the others: its views bigger (never above what the model takes)
      const sizesOf = (t: Target) => bookViewSizes(own, tuned, t.media?.recordset, since);
      const capOf = (t: Target) => spec.max ?? sizesOf(t).read;
      const maxOf = (p: ViewPart, t: Target) => (spec.max === undefined && isOverview(p) ? sizesOf(t).find : capOf(t));
      const noSharperOf = (t: Target) => !!bookTuned(tuned, own.key, t.media?.recordset, since).noSharper;
      // where the size came from, for the record of the views (core/metrics.ts)
      const capFromOf = (t: Target): ViewMeta["capFrom"] => (spec.max !== undefined || spec.scale !== undefined ? "option" : sizesOf(t).tuned ? `tuned:${sizesOf(t).tuned}` : own.calibrated ? "calibrated" : "default");
      // the old call: one image, one view — said as it always was
      if (!groups && targets.length === 1 && !missing.length && parts.length === 1 && !parts[0]!.both && !parts[0]!.split) {
        const t = targets[0]!;
        const r = oneView(ctx, tree, shared, all, t, { ...spec, max: maxOf(parts[0]!, t), half: parts[0]!.half, crop: parts[0]!.crop }, { capFrom: capFromOf(t) }, noSharperOf(t));
        return {
          text: lines(
            describeView(r.v, (p) => ctx.display(p), r.fetchPart, isOverview(parts[0]!)),
            r.clip ? `the source of an entry read here: --clip ${r.clip}` : undefined,
            r.sharper ? sharperLine(r.sharper, t) : undefined,
            r.near ? nearLine(r.near, t) : undefined,
            r.part ? partLine(r.part) : undefined,
            r.page ? `page ${r.page}` : undefined,
          ),
          data: viewData(t, r),
        };
      }
      const made: { t: Target; label?: string; note?: string; overview: boolean; r: OneView }[] = [];
      // an image that cannot be shown (its file missing) is said; the others are made
      const failed: { ref: string; error: string; hint?: string }[] = [];
      let first: unknown;
      for (const t of targets)
        try {
          for (const p of partsFor(t))
            for (const s of partSpecs(t, p, capOf(t), !!sizesOf(t).halves))
              made.push({
                t,
                label: s.label,
                note: s.note,
                overview: isOverview(p),
                r: oneView(ctx, tree, shared, all, t, { ...spec, grid: gridOf.get(t) ?? spec.grid, max: maxOf(p, t), half: s.half, crop: s.crop }, { capFrom: capFromOf(t), ...(p.split ? { kind: "split" as const } : p.both && s.crop ? { kind: "half" as const } : {}) }, noSharperOf(t)),
              });
        } catch (e) {
          if (!(e instanceof UsageError)) throw e;
          first ??= e;
          failed.push({ ref: t.ref, error: e.message, ...(e.hint ? { hint: e.hint } : {}) });
        }
      if (!made.length) throw first;
      const sizes = new Set(made.map((m) => viewSize(m.r.v)));
      const text = lines(
        `${counted(made.length, "view")} of ${counted(targets.length - failed.length, "image")} — open them all at once:`,
        ...made.flatMap(({ t, label, note, r }) => [
          ctx.display(r.v.file),
          `  ${[`${t.ref}${t.ref !== t.key ? ` (${t.key}${r.page ? `, page ${r.page}` : ""})` : r.page ? ` (page ${r.page})` : ""}`, label, note, viewLine(r.v), viewSize(r.v), r.clip ? `--clip ${r.clip}` : undefined].filter(Boolean).join(" · ")}`,
          r.sharper ? `  ${sharperLine(r.sharper, t)}` : undefined,
          r.near ? `  ${nearLine(r.near, t)}` : undefined,
          r.part ? `  ${partLine(r.part)}` : undefined,
          r.fetchPart ? `  this part sharper from the archive (one request): ${r.fetchPart}` : undefined,
        ]),
        missing.length ? `not registered: ${missing.join(", ")} — strom media list --recordset ${missing[0]!.split(":")[0]}` : undefined,
        ...waitedLines(tree, missing).map((l) => `  ${l}`),
        ...failed.map((f) => `no view of ${f.ref}: ${f.error}${f.hint ? ` → ${f.hint}` : ""}`),
        sizes.has("reduced") ? `reduced: ${REDUCED_HINT}${made.some((m) => m.overview && viewSize(m.r.v) === "reduced") ? `; ${OVERVIEW_HINT}` : ""}` : undefined,
        sizes.has("enlarged") ? `enlarged: the scan has no more detail there. ${ENLARGED_HINT}; ${SHARPER_SCAN}` : undefined,
      );
      return {
        text,
        data: { views: made.map(({ t, label, note, r }) => ({ ...viewData(t, r), ref: t.ref, ...(label ? { part: label } : {}), ...(note ? { note } : {}) })), images: targets.length - failed.length, ...(missing.length ? { missing } : {}), ...(failed.length ? { failed } : {}) },
      };
    },
  },
);

register({
  path: ["media", "thumb"],
  summary: "A small preview of a file of the material for the Strom app (the bridge runs it): kept in .strom/thumbs",
  group: "inputs",
  tree: true,
  description:
    "The preview of the file of that content (its SHA-256, as GET <token>/material says it): a JPEG whose longer side is\n" +
    "at most --px (128, 256 or 512), turned as the picture is shown. Of a JPEG, a PNG, a HEIC photo or a PDF's first page\n" +
    "(HEIC and PDF where this computer converts them); anything else has none. The original is never changed.",
  args: [{ name: "sha", description: "the file's SHA-256", required: true }],
  options: [{ name: "px", type: "string", value: "<px>", description: `the longer side: ${THUMB_SIZES.join(", ")} (default 256)` }],
  examples: ["strom media thumb f8dd5239cb925b731939be569b5e2183717b55b919dabe24e6cdfb6cb8ac9d8d --px 128"],
  run(ctx, { args, opts }) {
    const tree = ctx.tree();
    const sha = args[0]!.trim().toLowerCase();
    const px = opts.px === undefined ? 256 : Number(opts.px);
    if (!(THUMB_SIZES as readonly number[]).includes(px)) throw new UsageError(`--px: ${THUMB_SIZES.join(", ")}`, { code: "thumb.size" });
    if (!/^[0-9a-f]{64}$/.test(sha)) throw new UsageError("the file's SHA-256 (64 hexadecimal digits)", { code: "thumb.sha" });
    // a file of the Strom app's tree whose original is not here yet: the preview of its working copy
    const known = knownOriginal(tree, ctx.settings.shared()?.value, sha) ?? workingCopyOf(tree, ctx.settings.shared()?.value, sha);
    if (!known) throw new UsageError(`the research has no file of the content ${sha.slice(0, 12)}…`, { code: "media.unknown", hint: "strom input list" });
    if (!known.file || !fs.existsSync(known.file)) throw new UsageError(`the file of ${known.id} is not on this computer`, { code: "media.gone", params: { known: known.id } });
    const file = makeThumb(tree.root, known.file, sha, px, ctx.env);
    return { text: file, data: { file, px, of: known.id } };
  },
});

register({
  path: ["media", "original"],
  summary: "Take an original the Strom app sent (the bridge runs it): kept unchanged outside git — an image of a source, or material for people",
  group: "inputs",
  tree: true,
  writes: true,
  description:
    "The bridge receives the file (PUT <token>/media/<sha256>), checks its SHA-256 and runs this. It is moved into the\n" +
    "shared media store by its content. With --source: an image of that source (the part the entry is on as its clip,\n" +
    "when it has none); else an input of the people, waiting in the material. A task for the agent only where the\n" +
    "person turned intake.auto on (strom config): to read the scan of a source the research has not read, or an intake\n" +
    "task for the input (what comes for them within a while shares one) — a file sent starts nothing of an agent by\n" +
    "itself. The same content again: only said. In an archive the tasks wait put aside.\n" +
    "--batch: one file of a batch (its path in it with --path): an input with no task of its own — the batch's tasks come\n" +
    "when it is closed (strom input batch done). --zip: a ZIP of a batch, unpacked file by file (a ZIP in it is only said).\n" +
    "--task: the file came for what that waiting task waits for (X-Strom-Task): an input of its people handed to it, the\n" +
    "task back in the queue, no intake task (strom intake --answers). A task waiting for images of a book takes them as\n" +
    "images: numbered by --image (X-Strom-Image), else the name, else the order of those missing when as many came\n" +
    "(else refused: waiting.image-unknown, a number it does not ask for waiting.image-unwanted), put into its folder of\n" +
    "the shared inbox and registered from there; back in the queue once all it asked for are there (a site with a book,\n" +
    "which images not known: it waits on for the person's answer). Another scan at a number taken: refused\n" +
    "(waiting.image-exists) unless --replace (X-Strom-Replace: 1). A PDF: page by page.\n" +
    "--read: the file came to be read at once (the app's \"Read a document\", X-Strom-Read): an input, no intake task —\n" +
    "the reading is what it is for (strom document read).\n" +
    "Material of the family on this computer goes in with strom intake.",
  args: [{ name: "file", description: "the received file (it is moved)", required: true }],
  options: [
    { name: "sha", type: "string", value: "<sha256>", description: "its SHA-256 (checked)" },
    { name: "name", type: "string", value: "<name>", description: "its name in the app" },
    { name: "person", type: "string", multiple: true, value: "<P…>", description: "a person it is of (repeatable)" },
    { name: "family", type: "string", multiple: true, value: "<F…>", description: "a couple it is of (repeatable): material of both partners" },
    { name: "source", type: "string", value: "<S…>", description: "the source it is an image of" },
    { name: "region", type: "string", value: "<x,y,w,h>", description: "where the entry is on it (fractions of the image)" },
    { name: "note", type: "string", value: "<text>", description: "what the user said of it" },
    { name: "batch", type: "string", value: "<id>", description: "the batch of the app it comes in" },
    { name: "path", type: "string", value: "<path>", description: "its path in the batch (Babička/Dopisy/1946.jpg)" },
    { name: "zip", type: "boolean", description: "a ZIP of the batch: unpacked, each file taken" },
    { name: "task", type: "string", value: "<T…>", description: "the waiting task it came for: handed to it, the task back in the queue (images of a book it waits for: into its folder of the inbox, registered)" },
    { name: "image", type: "string", value: "<n>", description: "with --task: the image's number in the book (a PDF: of its first page, the next pages after it)" },
    { name: "replace", type: "boolean", description: "with --task: another scan at that number replaces the one there (withdrawn and kept, never deleted)" },
    { name: "phone", type: "boolean", description: "sent from a paired phone (its server runs it): material of a phone's batch" },
    { name: "read", type: "boolean", description: "sent to be read at once (strom document read): an input with no intake task" },
    { name: "list", type: "string", value: "<id>", description: "the list of people the app sent it to (the bridge keeps it, PUT lists/<id>): kept on the input, up to 50 of its people its people too" },
  ],
  examples: ["strom media original ~/Downloads/dopis.png --name dopis.png --person P0001"],
  run(ctx, { args, opts }) {
    const tree = ctx.tree();
    const shared = sharedDir(ctx);
    const file = ctx.resolvePath(args[0]!);
    if (!fs.existsSync(file)) throw new UsageError(`no such file: ${args[0]}`);
    const sha = typeof opts.sha === "string" ? opts.sha.toLowerCase() : fileSha256(file);
    if (!/^[0-9a-f]{64}$/.test(sha) || fileSha256(file) !== sha) throw new UsageError("the file is not the one named: its SHA-256 differs", { hint: "send it again", code: "media.sha-differs", params: { sha: sha.slice(0, 64) } });
    const persons = (Array.isArray(opts.person) ? opts.person : opts.person ? [opts.person] : []).flatMap((p) => String(p).split(",")).map((p) => p.trim().toUpperCase()).filter(Boolean);
    const families = (Array.isArray(opts.family) ? opts.family : opts.family ? [opts.family] : []).flatMap((f) => String(f).split(",")).map((f) => f.trim().toUpperCase()).filter(Boolean);
    const name = typeof opts.name === "string" ? opts.name : path.basename(file);
    const batch = typeof opts.batch === "string" ? opts.batch : undefined;
    const where = batchPath(typeof opts.path === "string" ? opts.path : undefined) ?? batchPath(name) ?? name;
    if (opts.zip && !batch) throw new UsageError("a ZIP comes in a batch", { hint: "--batch <id>", code: "batch.zip-alone" });
    const forTask = typeof opts.task === "string" ? opts.task : undefined;
    if (forTask !== undefined && (batch || typeof opts.source === "string")) throw new UsageError("a file for a task is no image of a source and comes in no batch", { hint: "--task alone, with --person, --note" });
    if (opts.read && (batch || forTask !== undefined || typeof opts.source === "string")) throw new UsageError("a file to read is no image of a source, comes in no batch and for no task", { hint: "--read alone, with --person, --note" });
    const list = typeof opts.list === "string" ? opts.list : undefined;
    if (list !== undefined && (batch || forTask !== undefined || opts.read)) throw new UsageError("a file sent to a list is material of people or a scan of a source: in no batch, for no task, not to read at once", { hint: "--list with --person, --source, --note", code: "media.bad-header", params: { header: "X-Strom-List-Ref" } });
    const image = opts.image !== undefined ? Number(opts.image) : undefined;
    if (image !== undefined && (!Number.isInteger(image) || image < 1 || image > 999_999)) throw new UsageError("--image is the image's number in the book (1 or more)", { code: "media.bad-header", params: { header: "X-Strom-Image" } });
    if ((image !== undefined || opts.replace) && forTask === undefined) throw new UsageError("--image and --replace go with --task (images a task waits for)");
    if (forTask !== undefined) {
      const task = taskForFile(tree, forTask);
      // images of a book the task waits for: into its folder of the inbox, registered from there (never material)
      if (inboxWaitOf(tree, task)) {
        try {
          const got = takeForTask(tree, shared, ctx.env as NodeJS.ProcessEnv, task, file, { name, image, replace: !!opts.replace, by: fileBy(tree, ctx.env) });
          const said = got.same
            ? `${got.task}: image ${runs(got.images)} of ${got.recordset} is there already (the same scan)`
            : lines(...tree.written.map((o) => o.summary), got.woken ? undefined : `${got.task} still waits${got.inbox.missing.length ? ` for images ${runs(got.inbox.missing)}` : " — the person's answer brings it back"}`);
          return { text: said, data: got };
        } finally {
          fs.rmSync(file, { force: true });
        }
      }
      if (image !== undefined || opts.replace) throw new UsageError(`${task.id} waits for no images of a book: a file for it is no image`, { code: "task.no-images" });
      persons.push(...taskPeople(tree, task));
      const got = tree.withTreeLock(() => {
        const one = takeOriginal(tree, shared, file, sha, { name, persons: [...new Set(persons)], note: typeof opts.note === "string" ? opts.note : undefined, task: true });
        const t = handFiles(tree, task.id, [one.input ?? one.known!], fileBy(tree, ctx.env));
        return { ...one, task: t.id, handed: one.input ?? one.known!, state: t.state };
      });
      return { text: lines(...tree.written.map((o) => o.summary)), data: got };
    }
    const got = tree.withTreeLock(() => {
      if (!batch)
        return takeOriginal(tree, shared, file, sha, {
          name,
          persons,
          ...(families.length ? { families } : {}),
          source: typeof opts.source === "string" ? opts.source.toUpperCase() : undefined,
          region: parseRegion(typeof opts.region === "string" ? opts.region : undefined),
          note: typeof opts.note === "string" ? opts.note : undefined,
          ...(opts.read ? { read: true } : {}),
          ...(list ? { list } : {}),
          // a task for an agent only where the person turned intake.auto on (spec 130 K1.3)
          auto: ctx.settings.intakeAuto(tree.config),
        });
      return takeBatchFile(tree, shared, ctx.env, file, sha, { name, persons, batch, path: where, note: typeof opts.note === "string" ? opts.note : undefined, phone: !!opts.phone, zip: !!opts.zip });
    });
    const text = "known" in got && got.known ? `the research has it already: ${got.known}` : lines(...tree.written.map((o) => o.summary));
    return { text, data: got };
  },
});

register({
  path: ["media", "queued"],
  summary: "Take the originals the bridge queued (the bridge runs it): one hold of the lock, one commit",
  group: "inputs",
  tree: true,
  writes: true,
  hidden: true,
  description:
    "The bridge answers a file the app sends with Prefer: respond-async at once (202) and queues it (.strom/media-queue,\n" +
    "its bytes in the shared store's .incoming). This takes the files waiting — those of no batch, or with --batch those\n" +
    "of that batch — each as strom media original takes its file, until --max-ms passed or --max-files were taken; left\n" +
    "says how many wait on. A file refused is said with its code and why; the others go on. strom input batch done takes\n" +
    "the rest of a batch's.",
  options: [
    { name: "batch", type: "string", value: "<id>", description: "the files of this batch (else those of no batch)" },
    { name: "max-ms", type: "string", value: "<ms>", description: "take no more files once this long passed (default 1000)" },
    { name: "max-files", type: "string", value: "<n>", description: "take at most this many files (default 50)" },
  ],
  examples: ["strom media queued --max-files 50 --json"],
  run(ctx, { opts }) {
    const tree = ctx.tree();
    const batch = typeof opts.batch === "string" ? opts.batch : null;
    const num = (v: unknown, d: number) => (typeof v === "string" && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : d);
    const maxMs = num(opts["max-ms"], 1000);
    const maxFiles = num(opts["max-files"], 50);
    if (!jobsOf(tree.root, batch).length) return { text: "nothing queued", data: { files: [], left: 0 } };
    const got = tree.withTreeLock(() => takeQueued(tree, sharedDir(ctx), ctx.env, { batch, maxMs, maxFiles, auto: ctx.settings.intakeAuto(tree.config) }));
    const taken = got.files.filter((f) => !f.refused).length;
    return { text: lines(...tree.written.map((o) => o.summary), `${counted(taken, "file")} taken, ${got.files.length - taken} refused, ${got.left} waiting`), data: got };
  },
});

