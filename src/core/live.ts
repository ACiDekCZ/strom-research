// The live bridge: the Strom app follows a research while it goes on. strom
// runs a small web server on this computer only (127.0.0.1, a random port, a
// secret token in every address) that only reads: the app, opened with
// ?live=<address>, takes the tree's GEDCOM from it and hears what changes —
// who is at work on what, what was recorded, what waits for the user. Nothing
// leaves the computer. The bridge ends by itself when nobody has asked it
// anything for a while (LIVE_IDLE_MS), or with strom live stop.
//
//   GET <token>/status     the tree, its researches, who is at work, what waits; what the research takes from
//                          the app (accepts). ?poll=1: the app asking now and then — the bridge's idle time goes on
//   GET <token>/tree.ged   the tree for the Strom app, as it is now, each entry with its image (the settings excerpts.*)
//   GET <token>/images.ged the same (the address an older strom gave)
//   GET <token>/log        what the research saved, newest first (each commit: when, what, for which task;
//                          text: its lines as the user reads them, kinds: what each is about)
//   GET <token>/recent     what the research added in the last hours (?hours=1…168, 24 when not given): the people and
//                          sources added, the commits — the same as /status recent (core/recent.ts)
//   GET <token>/events     server-sent events: hello, change, working
//   POST <token>/sync      the Strom app sends the user's edited tree back (?send=, or on its own): kept in the
//                          inbox to be shown and written on the user's word (strom sync) — nothing of the
//                          research changes; /status says what waits there (inbox) and how each send went (sends)
//   POST <token>/cancel    …or says it sends nothing ({"reason": "unchanged" | "cancelled" | "no-tree"})
//   GET <token>/media/<sha256>   whether the research has a file of that content (an original the app would send);
//                          ?file=1: the file itself (the original, for the app's viewer)
//   GET <token>/material   the family's files the research keeps (core/material.ts), ?person=P… / ?batch=<id>
//   PUT <token>/media/<sha256>   an original from the app, unchanged (the body; X-Strom-Name, -Person, -Source,
//                          -Region, -Note): streamed to disk, its hash checked, kept outside git
//                          (strom media original) — of a source an image, else material of people with an intake task;
//                          X-Strom-Batch, -Path (and -Zip: 1, a ZIP unpacked here): one file of a batch
//   POST <token>/batch/<id>/done   the batch is whole ({name, files, person, note}): its files become sorting tasks
//                          (a batch nobody closes is closed a day after its last file)
//   POST <token>/conflict/<X…>   the person decides a conflict of their edit in the app by side ({"do": "decide",
//                          "take": "user" | "research", "note"?}): strom conflict resolve --take, written as the user's
//   GET <token>/adopt      a new research waits for a tree of the app: its mark, name, until when; transfer: true when
//                          the tree comes from a browser the app cannot reach strom from; existing: true when it goes
//                          into a research made before, its tree never came (POST /adopt hands it over)
//   GET <token>/transfer   that tree's file as it came (strom-prenos-….json), only while the research waits for it
//
// Only pages of the Strom app may read it (CORS: https://stromapp.info, its beta, and a
// local copy on localhost for its development), and a browser asks first
// whether a public page may talk to this computer (Private Network Access).
//
// It never ends because of one error: a read that fails while another strom
// writes is tried again at the next tick, a request that fails answers 500.
// What it did and what went wrong is in .strom/live.log (start, end and why,
// errors with their stack).
//
// The secret: started again by itself — a newer strom on disk (live start
// --current), one that ended without a word (reviveLive), the first run of a
// newer strom bringing its bridges back, a start after it ended when idle — it
// takes the address it had (.strom/live-last.json: its port while free, its
// token), so the app following it goes on by itself. Ended for good (strom live
// stop, strom uninstall) its secret is dropped: the next bridge gets a new one
// (its port kept), the address the app kept no longer works, and the app gets
// the new one when the research is opened in it again (strom app, ?live=). A
// request with the secret from a page that is no Strom app (an Origin the
// bridge does not let in; never "null", none at all, or a copy of the app on
// this computer) means the address got out: the secret is replaced at once,
// written where the next strom app reads it, the app's open event streams
// ended, and that request answered as one without the secret. What is being
// written then (a send, an original) is finished; only new requests need the
// new secret. Nothing is replaced on a timer.

import { opsLogsOf } from "./opslog.ts";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import type { Env } from "./paths.ts";
import { withoutAgentMarks } from "./which.ts";
import { newerTree, Tree, TREE_FILE, typeOfId, VERSION, type Op } from "./tree.ts";
import { readJsonIfExists } from "./json.ts";
import { changeLines, type ChangeKind } from "./changelog.ts";
import { directionOf, scopes, type Scope } from "./directions.ts";
import { ancestorGenerations, displayName } from "./people.ts";
import { phrase } from "./phrases.ts";
import { exportGedcom } from "../gedcom/export.ts";
import { excerptSettings, planExcerpts } from "./excerpt.ts";
import { adoptedAt, adoptedEmpty, adoptionWait, noteAdoptAsked, markSentAgain, undoneSend, undoneSince, failReceived, inboxTrees, markAdopted, noteAdoptFailed, noteNothingSent, pendingAdoption, receiveAdopted, receivedAll, receivedPending, receiveTree, recentSends, stampAppVersion, syncConflicts, SYNC_INBOX, SYNC_MAX_BYTES, namesOf, type Change, type Skipped } from "./sync.ts";
import { isArchive, modeOf, settleArchive } from "./mode.ts";
import { settleHypothesisLinks } from "./hypolinks.ts";
import { PROFILES } from "../agents/profiles.ts";
import { ui } from "../cli/ui.ts";
import { EXIT, StromError } from "./errors.ts";
import { acquireLock } from "./lock.ts";
import { material } from "./material.ts";
import { checkOriginalMeta, freeBytes, knownOriginal, materialWaiting, originalMax, ORIGINAL_RESERVE, ORIGINAL_TYPES, parseRegion } from "./originals.ts";
import { BATCH_ID, batchEstimate, batchLimits, batchRoom, batchPath, batchStatus, idleBatches, noteBatch, openBatch, readBatch } from "./batches.ts";

/** New images for the app, made for at most so long when the tree changed (the rest the next time). */
const LIVE_IMAGES_MS = 20_000;
import { liveWorkers, type Paused } from "./workers.ts";
import { monthSpend, openSessions } from "./session.ts";
import { rankTasks } from "./queue.ts";
import { humanTask } from "../cli/human.ts";
import { knownNewerVersion, updateChannel } from "./update.ts";
import type { SyncInput } from "./sync.ts";
import { gitProgram, runGit } from "./git.ts";
import { RECENT_HOURS, recentChanges, recentNow, type Recent } from "./recent.ts";
import { appKnowsArchive, appKnowsNoCouple, appShowsHypothesisLinks, appDecidesConflicts, appOpensLinks, appReadsTitles, appShowsCoupleEvents, appShowsEdges, appShowsFactStatus, appShowsSourceReads, appShowsStoryDrafts, appTurnsExcerpts, appUrlSetting, isAppVersion, isStromAppOrigin } from "./stromapp.ts";
import { Settings } from "./config.ts";
import { LINK_SCHEME, linkActions, linkHandlerState, linkHandlerStateLater, linkScheme, type HandlerState } from "./links.ts";
import { autoTidy } from "./tidy.ts";
import { diskVersion, stromLauncher } from "./self.ts";
import type { AnyRecord, Conflict, Family, Input, Person, Session, Source, Task, TreeConfig } from "./model.ts";
import { sidesOf } from "./conflicts.ts";
import { normId } from "./records.ts";
import { foldText } from "./text.ts";
import { storiesToApprove } from "./stories.ts";

export interface LiveInfo {
  port: number;
  token: string;
  pid: number;
  /** The address the app is given (?live=…). */
  url: string;
  started: string;
  /** The strom version that serves it (a bridge of an older strom has none). */
  version?: string;
  /** Started now on another address than the bridge before had (its port was taken, or its secret dropped by strom live stop): the app needs the new one. */
  moved?: boolean;
}

/**
 * What the bridge says to the app: the sentence in the research's language (`error`, what an app before 3.9 shows), and
 * as a program reads it — a stable `code` with its `params`, and `text` in English — for the app to say it in its own
 * language (found on Windows: a Czech sentence inside the English app).
 */
const CODES = {
  "ui.sync.bridge.failed": "send.failed",
  "ui.sync.bridge.adopt": "adopt.failed",
  "ui.sync.bridge.large": "tree.large",
  "ui.sync.bridge.adopting": "adopt.busy",
  "ui.sync.bridge.other": "tree.other-research",
  "ui.sync.bridge.foreign": "tree.foreign",
  "ui.sync.bridge.empty": "tree.empty",
  "ui.sync.bridge.noids": "tree.no-ids",
  "ui.media.large": "media.large",
  "ui.media.full": "media.full",
} as const;
/** A file refused (its error's code): what the bridge says of it. */
const REFUSED: Record<string, keyof typeof CODES> = {
  "tree.other-research": "ui.sync.bridge.other",
  "tree.foreign": "ui.sync.bridge.foreign",
  "tree.no-ids": "ui.sync.bridge.noids",
  "tree.empty": "ui.sync.bridge.empty",
  "tree.unreadable": "ui.sync.bridge.empty",
};
function said(lang: string, key: keyof typeof CODES, params: Record<string, string> = {}): { error: string; code: string; text: string; params?: Record<string, string> } {
  return { error: ui(lang, key, params), code: CODES[key], text: ui("en", key, params), ...(Object.keys(params).length ? { params } : {}) };
}

/**
 * An upload of the app refused (PUT /media/<sha256>, a batch's file, POST /batch/<id>/done, GET /media/<sha256>): the
 * English sentence (`error`, `text`) and its stable `code` with `params` for the app to say it in the person's
 * language (feature `media.codes`). Each code, its answer and its params:
 * - `app.only` 403 — not from the Strom app's pages
 * - `media.bad-sha` 400 — the address names no SHA-256
 * - `media.bad-header` 400 {header} — a header that is not what it should be (X-Strom-Person, -Source, -Batch, -Zip,
 *   -Path, -Name, -Note)
 * - `media.bad-region` 400 {region} — X-Strom-Region is no part of an image
 * - `media.no-person` 404 {person} — no such person in the research; `media.no-source` 404 {source} — no such source
 * - `media.no-shared` 500 — the research has no shared folder for files (strom setup)
 * - `media.large` 413 {mb} (and `max`) — larger than the research takes; `media.full` 507 (and `free`) — no room
 *   (these two: `error` in the research's language, `text` English — said() above)
 * - `media.sha-differs` 409 {sha} — the file is not the one its address names
 * - `media.type` 415 {name} — not a kind of file the research takes
 * - `media.cut-short` 422 {name, kind: JPEG|PNG|PDF}; `media.too-small` 422 {name, bytes} — the file is not whole
 * - `media.refused` 400 — refused for another reason (the English sentence says why); `media.failed` 500 — went wrong
 * - `media.gone` 410 {known} — GET …?file=1: the research knows it, its file is not on this computer
 * - `research.busy` 503 (and Retry-After, `retry`) — another strom holds the research: send it again in a while
 * - `batch.bad-id` 400 {batch}; `batch.zip-alone` 400 — a ZIP outside a batch; `batch.zip-unreadable` 400 {name}
 * - `batch.closed` 409 {batch} — the batch is closed already: send the rest as a new batch
 * - `batch.full-files` 413 {batch, files}; `batch.full-bytes` 413 {batch, gb} — the most a batch takes
 * - `batch.none` 404 {batch} — POST /batch/<id>/done: no such batch here; `batch.bad-body` 400 — its body no JSON
 *
 * A decision of the person (POST /conflict/<X…>): 200 {decided, take, head, written, person?, family?}, else
 * - `app.only` 403; `decide.bad-body` 400 — no JSON {"do": "decide", …}; `conflict.bad-take` 400 — take not user|research
 * - `conflict.none` 404 {id} — no such conflict; `conflict.no-edit` 422 {id} — not one the app decides by side
 * - `conflict.decided` 409 {id} (and resolution, take, at, by, in) — decided already (a terminal, an agent, the app)
 * - `research.busy` 503 (and Retry-After, `retry`) — a send or an adoption is being written, another decision, another
 *   strom holding the research: ask again in a moment
 * - `locked` 423 (and reasonCode, reasonParams) — a newer strom wrote the research: this one never writes it
 * - `decide.failed` 500 — went wrong (the English sentence says why)
 */
function refusal(error: string, code: string, params: Record<string, string> = {}): { error: string; code: string; text: string; params?: Record<string, string> } {
  return { error, code, text: error, ...(Object.keys(params).length ? { params } : {}) };
}
/** What a strom of its own said as it failed (its --json: message, code, params): the code it gave, else `fallback`. */
function refusalOf(why: string, data: { code?: unknown; params?: unknown }, fallback: string): ReturnType<typeof refusal> {
  const params = data.params && typeof data.params === "object" ? Object.fromEntries(Object.entries(data.params as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : {};
  return refusal(why, typeof data.code === "string" && data.code ? data.code : fallback, params);
}

/**
 * The environment of a strom the bridge runs for the Strom app (a send written, the app's tree taken in, an original, a
 * batch closed): what it writes is the person's in the app — never logged as an agent's or a session's, whatever the
 * bridge was started from (an agent's shell, a session that revived it). No question asked.
 */
export function forApp(env: Env, root: string): NodeJS.ProcessEnv {
  const { STROM_SESSION: _s, STROM_WORKER: _w, ...rest } = withoutAgentMarks(env) as NodeJS.ProcessEnv;
  return { ...rest, STROM_TREE: root, STROM_NONINTERACTIVE: "1", STROM_FOR_APP: "1", STROM_SPAWNED: "1" };
}
/** Where a running bridge of a tree is noted. */
export function liveFile(root: string): string {
  return path.join(root, ".strom", "live.json");
}

/** What the bridge did and what went wrong: plain text, the newest LIVE_LOG_BYTES at most. */
export function liveLogFile(root: string): string {
  return path.join(root, ".strom", "live.log");
}

const LIVE_LOG_BYTES = 200 * 1024;

/** The last bridge of a tree, kept after it ended: its address to take again, whether it ended as it should. */
interface LiveLast {
  port: number;
  /** None once the bridge was ended for good (strom live stop): the next one gets a new secret, at this port. */
  token?: string;
  pid: number;
  started: string;
  /** How it ended (idle, stopped, a signal); none while it runs — or when it ended without a word. */
  ended?: { at: string; reason: string };
  /** The tree's folder (its real path) the bridge was of: a copy of the research with its .strom is another folder. None: an older strom's. */
  root?: string;
}

/** The tree's folder as the system names it (its links followed: /tmp is /private/tmp on a Mac) — never normalized. */
function realRoot(root: string): string {
  try {
    return fs.realpathSync(root);
  } catch {
    return path.resolve(root);
  }
}

/** Whether two paths are one folder: the same name, else the same folder of the same disk; undefined when one is not there. */
function sameFolder(a: string, b: string): boolean | undefined {
  if (a === b) return true;
  try {
    const x = fs.statSync(a, { bigint: true });
    const y = fs.statSync(b, { bigint: true });
    return x.dev === y.dev && x.ino === y.ino;
  } catch {
    return undefined;
  }
}

/**
 * Where a process runs (its working folder): a bridge runs in its tree's folder. Undefined where it cannot be asked
 * (Windows; lsof missing) — then a process is taken for what its note says, as before.
 */
function processCwd(pid: number): string | undefined {
  if (process.platform === "linux") {
    try {
      return fs.readlinkSync(`/proc/${pid}/cwd`);
    } catch {
      return undefined;
    }
  }
  if (process.platform !== "darwin") return undefined;
  const r = spawnSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8", timeout: 10_000 });
  if (r.error || r.status !== 0) return undefined;
  const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("n"));
  return line ? line.slice(1) : undefined;
}

/** A bridge running in another folder than this tree's — never ended for this tree. Its folder, else undefined. */
function bridgeElsewhere(pid: number, root: string): string | undefined {
  const cwd = processCwd(pid);
  return cwd && sameFolder(cwd, realRoot(root)) === false ? cwd : undefined;
}

/**
 * The folder a bridge's note (live.json, live-last.json) belongs to when it is not this tree's: a research copied with
 * its .strom (by hand, Finder) carries the original's notes — its bridge never taken for the copy's own, never ended by
 * it, its address never taken over (found on Mac: the copy's strom ended the original's bridge and served the Strom app
 * following the original at its address). A note of an older strom names no folder: its process, while it is a bridge,
 * is asked where it runs. A folder named that is no longer there is not another one: the research was moved.
 */
function foreignNote(root: string, note: { root?: unknown; pid?: unknown }): string | undefined {
  if (typeof note.root === "string") return sameFolder(note.root, realRoot(root)) === false ? note.root : undefined;
  if (typeof note.pid === "number" && note.pid !== process.pid && isBridge(note.pid)) return bridgeElsewhere(note.pid, root);
  return undefined;
}

function lastFile(root: string): string {
  return path.join(root, ".strom", "live-last.json");
}

/** The last bridge of this tree — and, when the note there is another folder's (a research copied with its .strom), that folder. */
function readLastOf(root: string): { last?: LiveLast; foreign?: string } {
  try {
    const last = JSON.parse(fs.readFileSync(lastFile(root), "utf8")) as LiveLast;
    if (!Number.isInteger(last.port) || !(last.token === undefined || /^[0-9a-f]{32}$/.test(last.token))) return {};
    const foreign = foreignNote(root, last);
    return foreign ? { foreign } : { last };
  } catch {
    return {};
  }
}

function readLast(root: string): LiveLast | undefined {
  return readLastOf(root).last;
}

function writeLast(root: string, last: LiveLast): void {
  try {
    const file = lastFile(root);
    fs.writeFileSync(`${file}.${process.pid}`, JSON.stringify({ ...last, root: realRoot(root) }, null, 2));
    fs.renameSync(`${file}.${process.pid}`, file);
  } catch {
    // the next start takes a new address
  }
}

/** One line (or an error with its stack) into the bridge's log; never fails, never grows past its size. */
export function noteLive(root: string, text: string): void {
  try {
    // the research moved or taken off: its folder never made again for a line of the log (found on Mac: a folder
    // left where the person moved the research from)
    if (!fs.existsSync(path.join(root, "strom.json"))) return;
    const file = liveLogFile(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${new Date().toISOString()} [${process.pid}] ${text}\n`);
    const size = fs.statSync(file).size;
    if (size > LIVE_LOG_BYTES) {
      const kept = fs.readFileSync(file).subarray(size - LIVE_LOG_BYTES / 2);
      const from = kept.indexOf(10) + 1;
      fs.writeFileSync(file, kept.subarray(from));
    }
  } catch {
    // a log that cannot be written stops nothing
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? (e.stack ?? `${e.name}: ${e.message}`) : String(e);
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The bridge of this tree when it runs (never another folder's whose note came with a copy of the research). */
export function liveRunning(root: string): LiveInfo | undefined {
  try {
    const { root: of, ...info } = JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as LiveInfo & { root?: string };
    if (info.pid && alive(info.pid) && !foreignNote(root, { root: of, pid: info.pid })) return info;
  } catch {
    // none
  }
  return undefined;
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Start the bridge of a tree in the background (or find it running); undefined when it did not come up.
 * `current`: what is asked for is new (a copy with images): a bridge of an older strom is started again.
 */
export function startLive(root: string, env: Env, opts: { current?: boolean; why?: string } = {}): LiveInfo | undefined {
  const running = liveRunning(root);
  if (running && (!opts.current || running.version === VERSION)) return running;
  // no research there (moved, taken off): nothing to start, its folder never made again
  if (!fs.existsSync(path.join(root, "strom.json"))) return undefined;
  // one strom at a time starts a tree's bridge: another that wants it now finds it (found on Mac: an update starting a
  // bridge hundreds of times over)
  let release: () => void;
  try {
    release = acquireLock(path.join(root, ".strom", "live-start.lock"), { owner: "starting the bridge", waitMs: 15_000, staleMs: 60_000 });
  } catch {
    return liveRunning(root);
  }
  try {
    const now = liveRunning(root);
    if (now && (!opts.current || now.version === VERSION)) return now;
    // said by the one that starts it (two strom at once: one line, found on Mac)
    if (opts.why) noteLive(root, opts.why);
    return startNow(root, env, now);
  } finally {
    release();
  }
}

function startNow(root: string, env: Env, running: LiveInfo | undefined): LiveInfo | undefined {
  if (running) stopLive(root, `a bridge of strom ${VERSION} is wanted (this one: ${running.version ?? "older"})`);
  fs.rmSync(liveFile(root), { force: true });
  const before = readLast(root);
  spawnBridge(root, env);
  // (a stuck bridge before it is ended first: up to some seconds)
  for (let i = 0; i < 200; i++) {
    const info = liveRunning(root);
    if (info) return before && (before.port !== info.port || before.token !== info.token) ? { ...info, moved: true } : info;
    sleep(50);
  }
  return undefined;
}

/** The bridge asking the one that takes over from it whether it answers: as the app's own pages ask. */
const STATUS_PROBE_ORIGIN = "https://stromapp.info";

/** A bridge started on its own (detached), what it says itself into its log — also what Node says when it dies. */
function spawnBridge(root: string, env: Env, extra: Record<string, string> = {}): ChildProcess {
  const { command, args } = stromLauncher();
  let log: number | "ignore" = "ignore";
  try {
    fs.mkdirSync(path.dirname(liveLogFile(root)), { recursive: true });
    log = fs.openSync(liveLogFile(root), "a");
  } catch {
    // without a log
  }
  const child = spawn(command, [...args, "live", "serve"], {
    cwd: root,
    env: { ...(env as NodeJS.ProcessEnv), STROM_TREE: root, STROM_SPAWNED: "1", ...extra },
    detached: true,
    stdio: ["ignore", "ignore", log],
    windowsHide: true,
  });
  child.unref();
  if (typeof log === "number") fs.closeSync(log);
  return child;
}

/**
 * The bridge ended for good (strom live stop, strom uninstall): its secret dropped, its port kept — the next bridge gets a
 * new secret, the address the app kept is dead (the app gets the new one when the research is opened in it again). Whether
 * there was one to drop.
 */
export function dropLiveSecret(root: string, why: string): boolean {
  const last = readLast(root);
  if (!last?.token) return false;
  const { token: _dropped, ...rest } = last;
  writeLast(root, { ...rest, ended: last.ended ?? { at: new Date().toISOString(), reason: why } });
  noteLive(root, `its secret dropped (${why}): the next bridge gets a new one, at port ${last.port} while free — the Strom app gets it when the research is opened in it again (strom app)`);
  return true;
}

/** The bridge's last address forgotten: the next one gets a new secret (and port) — the address the app kept is dead. */
export function forgetLive(root: string): void {
  fs.rmSync(lastFile(root), { force: true });
  noteLive(root, "its address forgotten (strom live stop --forget): the next bridge gets a new one");
}

/** Whether a process is a bridge of strom (its command says "live serve"): a number taken by another program is never stopped. */
function isBridge(pid: number): boolean {
  if (!alive(pid)) return false;
  if (process.platform === "win32") return true;
  const r = spawnSync("ps", ["-o", "stat=,command=", "-p", String(pid)], { encoding: "utf8", timeout: 10_000 });
  // ps not to be asked: the bridge's own note is what there is
  if (r.error || r.status === null) return true;
  const out = (r.stdout ?? "").trim();
  return !out.startsWith("Z") && /\blive\s+serve\b/.test(out);
}

/**
 * End a bridge's process: asked to (SIGTERM — it closes as it should), and when it does not end within a while
 * (a bridge stuck on something) ended for good (SIGKILL). How it ended; "alive" when even that did not end it.
 */
function endBridge(pid: number, root: string, waitMs = 3000): "stopped" | "killed" | "alive" | "gone" | "elsewhere" {
  if (!isBridge(pid)) return "gone";
  // a bridge of another folder (a note copied with the research) is never ended for this tree
  if (bridgeElsewhere(pid, root)) return "elsewhere";
  // ended: no such process, or one that only waits for its parent to hear it ended (a zombie)
  const ended = () => {
    if (!alive(pid)) return true;
    if (process.platform === "win32") return false;
    const r = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8", timeout: 5000 });
    return !r.error && (!(r.stdout ?? "").trim() || (r.stdout ?? "").trim().startsWith("Z"));
  };
  const gone = (ms: number) => {
    for (let t = 0; t < ms; t += 100) {
      if (ended()) return true;
      sleep(100);
    }
    return ended();
  };
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return "gone";
  }
  if (gone(waitMs)) return "stopped";
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    return "stopped";
  }
  return gone(2000) ? "killed" : "alive";
}

/** Stop the bridge of a tree (why: into its log): how it went — "none" when none ran, "alive" when it could not be ended. */
export function stopLive(root: string, why = "strom live stop"): "none" | "stopped" | "killed" | "alive" {
  const info = liveRunning(root);
  if (!info) return "none";
  noteLive(root, `stop asked: ${why}`);
  const last = readLast(root);
  if (last?.pid === info.pid) writeLast(root, { ...last, ended: { at: new Date().toISOString(), reason: why } });
  const how = endBridge(info.pid, root);
  if (how === "elsewhere") {
    noteLive(root, `a bridge of another folder (${info.pid}) is named in live.json: not ended, not this tree's`);
    fs.rmSync(liveFile(root), { force: true });
    return "none";
  }
  if (how === "killed") noteLive(root, `the bridge ${info.pid} did not end when asked: ended for good (SIGKILL)`);
  if (how === "alive") {
    noteLive(root, `the bridge ${info.pid} could not be ended`);
    return "alive";
  }
  fs.rmSync(liveFile(root), { force: true });
  return how === "gone" ? "stopped" : how;
}

/**
 * The bridge of a tree that ended without a word (a crash, killed) is started again — on its address, so the
 * Strom app following it goes on by itself. One that ended as it should (idle, stopped) stays so.
 */
export function reviveLive(root: string, env: Env): LiveInfo | undefined {
  const last = readLast(root);
  if (!last || last.ended || alive(last.pid) || liveRunning(root)) return undefined;
  const info = startLive(root, env, { why: `the bridge ${last.pid} ended without a word: started again` });
  // one that does not come up is not tried at every session again
  if (!info) writeLast(root, { ...last, ended: { at: new Date().toISOString(), reason: "did not start again" } });
  return info;
}

/** The pages that may read the bridge: the Strom app, and a local copy of it for its development. */
function allowedOrigin(origin: string | undefined): string | undefined {
  return origin && isStromAppOrigin(origin) ? origin : undefined;
}

/**
 * A request with the secret from a page that is no Strom app: the address got out. Not one without an Origin (curl, a
 * process of this computer, the app's EventSource), "null" (the app opened as a file), a page the bridge lets in, nor the
 * copy of the app the person set (strom.app.url).
 */
function foreignOrigin(origin: string | undefined, env: Env): boolean {
  if (origin === undefined || origin === "null" || allowedOrigin(origin)) return false;
  try {
    const said = appUrlSetting(new Settings(env, {}));
    if (!said.invalid && new URL(said.url).origin === origin) return false;
  } catch {
    // no setting to read: the pages the bridge lets in are what there is
  }
  return true;
}

/** An address as the log says it: never its secret (one replaced meanwhile neither). */
function masked(url: string | undefined): string {
  return String(url ?? "").replace(/\/[0-9a-f]{32}(?=[/?]|$)/, "/…");
}

/** live.json written whole: a strom reading it meanwhile never takes a half for no bridge. */
function writeLive(root: string, info: LiveInfo): void {
  const file = liveFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.${process.pid}`, JSON.stringify({ ...info, root: realRoot(root) }, null, 2));
  fs.renameSync(`${file}.${process.pid}`, file);
}

function head(root: string): string {
  const r = spawnSync(gitProgram() ?? "git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : "";
}

/** The last commit and when it was made (the app: "changed 5 min ago"). */
function tip(root: string): { head: string; at?: string } {
  const r = spawnSync(gitProgram() ?? "git", ["log", "-1", "--format=%H%x1f%cI"], { cwd: root, encoding: "utf8", windowsHide: true });
  const [head = "", at = ""] = r.status === 0 ? r.stdout.trim().split("\x1f") : [];
  return { head, ...(at ? { at } : {}) };
}

/** What one commit saved, as lines: each change a command listed, else its subject. */
function saved(subject: string, body: string): string[] {
  const listed = body.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  return listed.length ? listed : [subject];
}

function subjects(root: string, from: string, to: string): string[] {
  const r = spawnSync(gitProgram() ?? "git", ["log", "--format=%x1e%s%x1f%b", from ? `${from}..${to}` : "-1", to], { cwd: root, encoding: "utf8", windowsHide: true });
  if (r.status !== 0) return [];
  const commits = r.stdout.split("\x1e").slice(1).reverse();
  return commits.flatMap((c) => {
    const [subject = "", body = ""] = c.split("\x1f");
    return saved(subject.trim(), body);
  });
}

/** At most so many commits /log gives (the app takes no more). */
const LOG_MAX = 500;

/**
 * What the research saved, newest first: each commit, when, what, and the task
 * it was saved for — the session whose operation log (data/ops/N….jsonl) or
 * record the commit wrote, else the one session open at that time.
 */
/** The operations each commit logged (data/ops/*.jsonl only grow: its added lines), in the order they were made. */
function opsByCommit(root: string, range: string[]): Map<string, Op[]> {
  const out = new Map<string, Op[]>();
  const r = runGit(root, ["log", ...range, "--format=%x1e%H", "-p", "--unified=0", "--no-color", "--no-ext-diff", "--", "data/ops/"]);
  if (r.status !== 0) return out;
  for (const c of r.stdout.split("\x1e").slice(1)) {
    const [hash = "", ...rest] = c.split("\n");
    const ops: Op[] = [];
    for (const line of rest)
      if (line.startsWith("+{"))
        try {
          ops.push(JSON.parse(line.slice(1)) as Op);
        } catch {
          // a line cut short: its commit is said by its subject
        }
    out.set(hash.trim(), ops.sort((a, b) => a.at.localeCompare(b.at)));
  }
  return out;
}

/**
 * The people and sources of a send under the IDs the research gave them, by the app's xref (@…@): those it brought
 * (person.add, source.add) and those it named by the app's own marks, given their IDs when it came. None: nothing.
 */
function idsOf(applied: { do: string; id: string; before?: unknown }[], known?: { persons: Record<string, string>; sources: Record<string, string> }): { ids?: { persons: Record<string, string>; sources: Record<string, string> } } {
  const brought = (kind: string) =>
    Object.fromEntries(applied.filter((a) => a.do === kind && typeof a.before === "string" && a.before.startsWith("x:")).map((a) => [`@${String(a.before).slice(2)}@`, a.id]));
  const ids = { persons: { ...(known?.persons ?? {}), ...brought("person.add") }, sources: { ...(known?.sources ?? {}), ...brought("source.add") } };
  return Object.keys(ids.persons).length || Object.keys(ids.sources).length ? { ids } : {};
}

/** What the bridge does that an app may ask about (each added once, never taken away). */
export const BRIDGE_FEATURES = ["sync.again", "sync.undoneSince", "sync.takenBack", "sync.conflictEdit", "sync.since", "sync.ids", "family.noCouple", "family.alone", "adopt.transfer", "adopt.empty", "material.list", "person.titles", "media.codes", "hypothesis.links", "conflict.decide", "status.recent", "spend.readers"] as const;

/** /status recent, when it is ready. */
function recentOf(root: string, env: Env, head: string): { recent?: Recent } {
  const recent = head ? recentNow(root, env, head) : undefined;
  return recent ? { recent } : {};
}

/** What git says of one commit (its time, message, files and the operations it logged): never changes for its hash. */
interface RawCommit {
  head: string;
  at: string;
  subject: string;
  body: string;
  files: string;
  ops: Op[];
}

function rawCommits(root: string, range: string[]): RawCommit[] {
  const r = runGit(root, ["log", ...range, "--format=%x1e%H%x1f%cI%x1f%s%x1f%b%x1f", "--name-only"]);
  if (r.status !== 0) return [];
  const ops = opsByCommit(root, range);
  return r.stdout
    .split("\x1e")
    .slice(1)
    .map((c) => {
      const [head = "", at = "", subject = "", body = "", files = ""] = c.split("\x1f");
      return { head, at, subject, body, files, ops: ops.get(head) ?? [] };
    });
}

/** The commits as the app reads them — what depends on the research now (names, tasks, directions) worked out afresh. */
function rendered(tree: Tree, raws: RawCommit[]): HistoryEntry[] {
  const sessions = new Map(tree.list<Session>("session").map((s) => [s.id, s]));
  let all: Scope[] | undefined;
  const now = Date.now();
  const taskOf = (s: Session | undefined): { task?: string } => {
    if (!s?.task) return {};
    const task = tree.get<Task>(s.task);
    return { task: task ? `${task.id} ${task.what}` : s.task };
  };
  return raws.map(({ head, at, subject, body, files, ops }) => {
    const named = new Set<string>();
    for (const f of files.split("\n")) {
      const m = /^data\/(?:ops\/(?:[^/]+\/)*(N\d+)(?:\.[^/]*)?\.jsonl|sessions\/(N\d+)\.json)$/.exec(f.trim());
      if (m) named.add((m[1] ?? m[2])!);
    }
    const when = Date.parse(at);
    const open = named.size ? [] : [...sessions.values()].filter((s) => Date.parse(s.started) <= when && when <= (s.ended ? Date.parse(s.ended) : now));
    const s = named.size === 1 ? sessions.get([...named][0]!) : open.length === 1 ? open[0] : undefined;
    const lines = changeLines(tree, ops, subject.trim(), tree.lang);
    // the directions only when a session needs them (they cost)
    const research = s ? sessionResearch(tree, s, s.research ? [] : (all ??= scopes(tree))) : undefined;
    return { head, at, what: saved(subject.trim(), body), text: lines.map((l) => l.text), kinds: lines.map((l) => l.kind), ...taskOf(s), ...(research ? { research } : {}) };
  });
}

export interface HistoryEntry {
  head: string;
  at: string;
  what: string[];
  text: string[];
  kinds: ChangeKind[];
  task?: string;
  research?: string;
}

export function history(root: string, tree: Tree, range: string[] = [`-n${LOG_MAX}`]): HistoryEntry[] {
  return rendered(tree, rawCommits(root, range));
}

/**
 * The history a bridge gives again and again (/log, each change): what git says of a commit is kept by its hash, so
 * after a new commit git is asked about the new ones only — the same entries, in the same order, as history() gives.
 */
export class HistoryCache {
  private known = new Map<string, RawCommit>();
  /** How many commits the last log() asked git about (the new ones only, once it knows the rest). */
  read = 0;
  private readonly root: string;
  constructor(root: string) {
    this.root = root;
  }

  /** The last LOG_MAX commits up to `h`, newest first (as history(root, tree) at h). */
  log(tree: Tree, h: string): HistoryEntry[] {
    if (!h) return [];
    const listed = runGit(this.root, ["rev-list", `-n${LOG_MAX}`, h]);
    if (listed.status !== 0) return history(this.root, tree, [`-n${LOG_MAX}`, h]);
    const order = listed.stdout.split("\n").filter(Boolean);
    // the newest ones it has not seen; anything else unknown (a history written anew): all of it again
    let k = 0;
    while (k < order.length && !this.known.has(order[k]!)) k++;
    if (order.slice(k).some((x) => !this.known.has(x))) k = order.length;
    const fresh = k ? rawCommits(this.root, [`-n${k}`, h]) : [];
    this.read = k;
    if (fresh.length !== k || fresh.some((c, i) => c.head !== order[i])) {
      this.read = order.length;
      return this.keep(tree, rawCommits(this.root, [`-n${LOG_MAX}`, h]));
    }
    return this.keep(tree, order.map((x, i) => (i < k ? fresh[i]! : this.known.get(x)!)));
  }

  /** The commits after `from` up to `to` (a change the app hears), newest first; kept for the next /log. */
  since(tree: Tree, range: string[]): HistoryEntry[] {
    const raws = rawCommits(this.root, range);
    for (const c of raws) this.known.set(c.head, c);
    // never more than a few hundred kept: the oldest go first (a /log after it asks git about them again)
    for (const old of this.known.keys()) {
      if (this.known.size <= 2 * LOG_MAX) break;
      this.known.delete(old);
    }
    return rendered(tree, raws);
  }

  private keep(tree: Tree, raws: RawCommit[]): HistoryEntry[] {
    // oldest first, as since() adds the newer ones after them
    this.known = new Map([...raws].reverse().map((c) => [c.head, c]));
    return rendered(tree, raws);
  }
}

/** The direction a task belongs to, for the app's names of directions on tasks and its filter. */
function researchOf(tree: Tree, t: Task, all: Scope[]): { research?: string } {
  const research = directionOf(tree, t, all);
  return research ? { research } : {};
}

/** The one person a task is about (its subject names exactly one), for the app's badge on that person. */
function personOf(t: Task | undefined): { person?: string } {
  const people = (t?.subject ?? []).filter((id) => /^P\d{1,7}$/.test(id));
  return people.length === 1 ? { person: people[0]! } : {};
}

/** The new versions of approved stories, as items of `waiting`: whose (a couple's: person and partner), since when. */
function storiesWaiting(tree: Tree): Record<string, unknown>[] {
  return storiesToApprove(tree).flatMap((s) => {
    const rec = tree.get<Person | Family>(s.id);
    if (!rec) return [];
    const people = rec.type === "family" ? rec.partners : [rec.id];
    const name = (id: string) => {
      const p = tree.get<Person>(id);
      return p ? displayName(p) : id;
    };
    return [
      {
        kind: "story",
        id: rec.id,
        what: ui(tree.lang, "ui.waiting.story", { who: people.map(name).join(" & ") }),
        on: "",
        at: s.at,
        ...(people[0] ? { person: people[0] } : {}),
        ...(people[1] ? { partner: people[1] } : {}),
      },
    ];
  });
}

/** Who works, as the user reads it: "Claude Code on its own", "Codex conversation" in the research language. */
function whoAtWork(label: string, lang: string): string {
  const run = /^(.+) on its own$/.exec(label);
  if (run) return phrase(lang, "who.run", { agent: run[1]! });
  const chat = /^(.+) conversation$/.exec(label);
  return chat ? phrase(lang, "who.chat", { agent: chat[1]! }) : label;
}

/**
 * The person an agent works on, for the app to follow it in the tree: the first person its task is about (a marriage
 * names both, the one it asks about first), else the last one its session wrote about.
 */
function workedOn(root: string, tree: Tree, s: Session, task: Task | undefined): { person?: string } {
  const known = (id: string) => /^P\d{1,7}$/.test(id) && tree.get(id) !== undefined;
  const first = (task?.subject ?? []).find(known);
  if (first) return { person: first };
  let lines: string[] = [];
  try {
    lines = opsLogsOf(path.join(root, "data"), s.id).flatMap((file) => fs.readFileSync(file, "utf8").split("\n"));
  } catch {
    return {};
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    let op: Op;
    try {
      op = JSON.parse(lines[i]!) as Op;
    } catch {
      continue; // empty, or a line being written
    }
    const person = (op.targets ?? []).findLast(known);
    if (person) return { person };
  }
  return {};
}

/** Who is at work now, on which task (an agent strom started, and its open session). */
function working(root: string, tree: Tree, all: Scope[]): { who: string; since: string; session?: string; task?: string; person?: string; research?: string; paused?: Paused }[] {
  const open = openSessions(tree);
  return liveWorkers(root).map((w) => {
    const s = open.find((x) => x.worker === w.id);
    const task = s?.task ? tree.get<Task>(s.task) : undefined;
    const research = s ? sessionResearch(tree, s, all) : undefined;
    return {
      who: whoAtWork(w.label, tree.lang),
      since: w.since,
      ...(w.paused ? { paused: w.paused } : {}),
      ...(s ? { session: s.id, ...(s.task ? { task: task ? `${task.id} ${task.what}` : s.task } : {}), ...workedOn(root, tree, s, task) } : {}),
      ...(research ? { research } : {}),
    };
  });
}

/** The direction a session worked on: its own, else its task's. */
function sessionResearch(tree: Tree, s: Session, all: Scope[]): string | undefined {
  if (s.research) return s.research;
  const task = s.task ? tree.get<Task>(s.task) : undefined;
  return task ? directionOf(tree, task, all) : undefined;
}

/** At most so many characters of a reason or a summary the app is sent. */
const SHORT = 140;
const short = (text: string) => (text.length > SHORT ? `${text.slice(0, SHORT - 1).trimEnd()}…` : text);

/** Generations the app is told of a direction of ancestors: parents first. */
const DIRECTION_GENERATIONS = 12;

/**
 * The directions of the research for the app: how each goes, its tasks (each task counted in the one
 * direction it belongs to), whether an agent is at work on it, why it was paused or ended and since when,
 * the ancestors known in each generation, and what its last session did.
 */
function directions(tree: Tree, all: Scope[], queued: Task[], workingOn: (string | undefined)[]): Record<string, unknown>[] {
  const tasks = tree.list<Task>("task");
  const of = new Map(tasks.map((t) => [t.id, directionOf(tree, t, all)]));
  const ended = tree
    .list<Session>("session")
    .filter((s) => s.state !== "open" && s.ended && s.summary)
    .sort((a, b) => b.ended!.localeCompare(a.ended!));
  return all.map(({ research: r }) => {
    // a paused or ended one: what would come back to the queue
    const inQueue = r.state === "active" ? queued.filter((t) => of.get(t.id) === r.id).length : tasks.filter((t) => ["open", "doing"].includes(t.state) && of.get(t.id) === r.id).length;
    const reason = r.state === "active" ? undefined : [...r.notes].reverse().find((n) => n.text.startsWith(`${r.state}: `))?.text.slice(r.state.length + 2).trim();
    const last = ended.find((s) => sessionResearch(tree, s, all) === r.id);
    let generations: number[] | undefined;
    if (r.direction === "ancestors" && tree.get(r.focus)) {
      const gens = ancestorGenerations(tree, r.focus, DIRECTION_GENERATIONS + 1);
      const deepest = Math.min(Math.max(2, ...gens.values()), DIRECTION_GENERATIONS + 1);
      generations = [];
      for (let g = 2; g <= deepest; g++) generations.push([...gens.values()].filter((n) => n === g).length);
    }
    return {
      id: r.id,
      name: r.name,
      state: r.state,
      direction: r.direction,
      focus: r.focus,
      tasks: inQueue,
      waiting: tasks.filter((t) => t.state === "waiting" && of.get(t.id) === r.id).length,
      working: workingOn.includes(r.id),
      ...(reason ? { reason: short(reason) } : {}),
      since: r.stateSince ?? (r.state === "active" ? r.created : r.updated),
      ...(generations ? { generations } : {}),
      ...(last ? { last: { at: last.ended, text: short(last.summary!.replace(/\s+/g, " ").trim()) } } : {}),
    };
  });
}

/** How long what the system says of the links is taken as true (asking it costs a program started). */
const LINKS_FRESH_MS = 60_000;
/** No links after links that worked: asked again so soon, and taken only when said again. */
const LINKS_AGAIN_MS = 5_000;

/**
 * What the bridge says of the links, asked of the system now and then: the first time at once, then in the background
 * (the bridge never waits for it) — until it answers, what it said last. The system that does not answer (a failed or
 * slow query: unknown) changes nothing. No links after links that worked are taken only when the system says so twice
 * in a row: an applet being made again, a moment of LaunchServices — and the Strom app forgot the links (found on Mac).
 */
export function linksWatch(
  read: { now: () => HandlerState; later: () => Promise<HandlerState> },
  opts: { freshMs?: number; againMs?: number; clock?: () => number } = {},
): () => string[] {
  const freshMs = opts.freshMs ?? LINKS_FRESH_MS;
  const againMs = opts.againMs ?? LINKS_AGAIN_MS;
  const clock = opts.clock ?? Date.now;
  let seen: { at: number; actions: string[] } | undefined;
  let asking = false;
  // none said once after links that worked: not taken yet
  let doubt = false;
  // asked again in a few seconds rather than in a minute
  const soon = () => clock() - freshMs + againMs;
  return () => {
    if (!seen) {
      const state = read.now();
      seen = { at: state === "unknown" ? soon() : clock(), actions: linkActions(state) };
    } else if (clock() - seen.at > freshMs && !asking) {
      asking = true;
      read.later().then(
        (state) => {
          asking = false;
          const was = seen?.actions ?? [];
          if (state === "unknown") {
            seen = { at: was.length ? clock() : soon(), actions: was };
            return;
          }
          const actions = linkActions(state);
          if (!actions.length && was.length && !doubt) {
            doubt = true;
            seen = { at: soon(), actions: was };
            return;
          }
          doubt = false;
          seen = { at: clock(), actions };
        },
        () => {
          asking = false;
          seen = { at: clock(), actions: seen?.actions ?? [] };
        },
      );
    }
    return seen.actions;
  };
}

let linksOf: (() => string[]) | undefined;

/** The strom-research:// links this computer takes: said to the app only while the scheme leads to this strom. */
function links(env: Env): string[] {
  linksOf ??= linksWatch({ now: () => linkHandlerState(env), later: () => linkHandlerStateLater(env) });
  return linksOf();
}

/**
 * A second installation's own scheme (strom-research-beta), for the app to build its links with — said whenever it is
 * not the person's strom-research (whether they lead here says `links`).
 */
function linkSchemeOf(env: Env): { linkScheme?: string } {
  const scheme = linkScheme(env);
  return scheme !== LINK_SCHEME ? { linkScheme: scheme } : {};
}

/** The beta channel this bridge's strom runs on, for the app to say so; the releases: nothing said. */
function channelOf(env: Env): { channel?: "beta" } {
  return updateChannel(env) === "beta" ? { channel: "beta" } : {};
}

/** At most so many tasks of the queue the app is told (the rest counted): what comes next, then what was put aside. */
const QUEUE_NEXT = 14;
const QUEUE_PARKED = 6;

/** The agent's queue in its order, for the user (records by their names), and how many more there are. */
function queue(tree: Tree, next: Task[], all: Scope[]): { queue: { id: string; text: string; state: "next" | "parked"; person?: string; research?: string }[]; queueMore: number } {
  const lang = tree.lang;
  const parked = tree.list<Task>("task").filter((t) => t.state === "parked");
  const item = (state: "next" | "parked") => (t: Task) => ({ id: t.id, text: humanTask(tree, t.what, lang), state, ...personOf(t), ...researchOf(tree, t, all) });
  const shown = [...next.slice(0, QUEUE_NEXT).map(item("next")), ...parked.slice(0, QUEUE_PARKED).map(item("parked"))];
  return { queue: shown, queueMore: next.length + parked.length - shown.length };
}

/** The last tree the Strom app sent (through the bridge) that the research took and has not taken back — and which send it was. */
function lastIntake(root: string, tree: Tree): { id: string; at: string; state: "written"; received?: string } | undefined {
  const last = tree
    .list<SyncInput>("input")
    .filter((i) => i.sync && !i.sync.undone && i.sync.applied.length && i.name.startsWith("strom-app-"))
    .sort((a, b) => a.created.localeCompare(b.created))
    .pop();
  if (!last) return undefined;
  const sent = receivedAll(root).find((r) => r.input === last.id);
  return { id: last.id, at: last.created, state: "written", ...(sent ? { received: sent.intake } : {}) };
}

/**
 * What the research takes from the app (a gate the other way: the app shows what it can do by it). mode: an archive
 * (no agent; the app's data written as they come) or a research. sync.auto: what becomes of a send — "write" (at once:
 * additions, leads corrected, a record's fact changed a conflict for the user), "mirror" (an archive: the user's word
 * wins, what the app no longer has withdrawn), "off" (it waits for the user's word: sync.review on); sources: the app's
 * sources and citations are taken; verified: its transcripts weigh as the app says (_STROM_TRANSCRIPTS,
 * _STROM_VERIFIED); media: originals through PUT /media/<sha256> — how large one may be, what room is left, which kinds.
 */
function accepts(tree: Tree, settings: Settings, env: Env): Record<string, unknown> {
  const mode = modeOf(tree);
  const shared = settings.shared()?.value;
  const free = shared ? freeBytes(shared) : undefined;
  return {
    mode,
    sync: { auto: mode === "archive" ? "mirror" : settings.syncReview(tree.config) ? "off" : "write" },
    sources: true,
    verified: true,
    media: shared
      ? {
          max: originalMax(env),
          ...(free !== undefined ? { free: Math.max(0, free - ORIGINAL_RESERVE) } : {}),
          types: ORIGINAL_TYPES.map((t) => ({ mime: t.mime, ext: t.ext })),
          region: true,
          tasks: mode === "archive" ? "parked" : "open",
          batch: { ...batchLimits(env), zip: true },
          estimate: batchEstimate(tree),
        }
      : null,
  };
}

/**
 * The version of the Strom app that asks (the app's spec docs/ZADANI_VYZKUM_app-vstup-dat.md, "Verze aplikace pro
 * most"): its header X-Strom-App-Version, else ?app=<version> (an EventSource sends no header of its own) — so what the
 * bridge writes goes by the app that reads it, two windows of two versions each their own. None: the app's version
 * strom was given (STROM_APP_VERSION, strom.version), else unknown.
 */
export function appVersionOf(req: { url?: string | undefined; headers: http.IncomingHttpHeaders }, settings: Settings): string | undefined {
  return saidAppVersion(req) ?? settings.stromVersion();
}

/** The version the request itself says the app is (X-Strom-App-Version, else ?app=), only a version of the app; else none. */
export function saidAppVersion(req: { url?: string | undefined; headers: http.IncomingHttpHeaders }): string | undefined {
  const header = req.headers["x-strom-app-version"];
  const query = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("app");
  const said = (Array.isArray(header) ? header[0] : header)?.trim() || query?.trim();
  return said && isAppVersion(said) ? said : undefined;
}

/** What the app shows beside the tree. */
function status(root: string, env: Env, version?: string): Record<string, unknown> {
  // a research a newer strom wrote (a beta's, this strom back on the releases): said, never opened
  const refused = newerTree(root, env);
  if (refused) {
    const config = readJsonIfExists<TreeConfig>(path.join(root, TREE_FILE));
    return {
      strom: VERSION,
      features: BRIDGE_FEATURES,
      ...channelOf(env),
      tree: { id: config?.id, name: config?.name, lang: config?.lang },
      path: root,
      locked: { code: refused.code, reason: refused.message, way: refused.hint, ...(refused.params ?? {}) },
      links: links(env),
      ...linkSchemeOf(env),
    };
  }
  const tree = Tree.open(root, env);
  const settings = new Settings(env, {});
  // an archive asks the person nothing: none waits (put aside at its next write, settleArchive)
  const waiting = isArchive(tree) ? [] : tree.list<Task>("task").filter((t) => t.state === "waiting");
  const newer = knownNewerVersion(settings, env);
  const intake = lastIntake(root, tree);
  const last = tip(root);
  const all = scopes(tree);
  const next = rankTasks(tree, tree.list<Task>("task"), settings.strategy(tree.config)).map((r) => r.task);
  const atWork = working(root, tree, all);
  // where the research is on this computer, and the agent that works on it (an archive: none)
  const agent = isArchive(tree) ? undefined : settings.agent(tree.config).value;
  const where = settings.agentWhere();
  // a newer strom on disk than this bridge runs (it starts again with it in a moment): for the app to say so
  const disk = diskVersion(env);
  return {
    strom: VERSION,
    // what this bridge does, for an app to go by rather than the version (a bridge run from the sources says the
    // candidate it is, found on Mac: an app took 1.11.0 for an old research)
    features: BRIDGE_FEATURES,
    ...channelOf(env),
    ...(disk && disk.version !== (env.STROM_LIVE_RENEWED ?? VERSION) ? { installed: disk.version } : {}),
    tree: { id: tree.config.id, name: tree.config.name, lang: tree.lang },
    path: root,
    ...(agent && PROFILES[agent] ? { agent: { id: agent, name: PROFILES[agent]!.name, ...(where === "app" || where === "terminal" ? { where } : {}) } } : {}),
    head: last.head,
    ...(last.at ? { headAt: last.at } : {}),
    // what the last 24 hours added (the app's "last 24 h"; /log gives only the last 500 commits): worked out in the
    // background, its own head said — none until it is ready
    ...recentOf(root, env, last.head),
    persons: tree.countLive("person"),
    families: tree.count("family"),
    researches: directions(tree, all, next, atWork.filter((w) => !w.paused).map((w) => w.research)),
    working: atWork,
    open: openSessions(tree).map((s) => ({ id: s.id, task: s.task, started: s.started })),
    // since when it waits: its last change is the one that made it wait
    waiting: [
      ...waiting.map((t) => ({ id: t.id, what: t.what, on: t.waitingOn ?? "", at: t.updated, ...personOf(t), ...researchOf(tree, t, all) })),
      // a new version of an approved story, as the menu counts it — for an app that shows it (the _DRAFT gate)
      ...(appShowsStoryDrafts(settings, version) ? storiesWaiting(tree) : []),
    ],
    links: links(env),
    ...linkSchemeOf(env),
    // an archive: nobody works on it — its tasks put aside are no queue, nothing spent (Milan's decision, 2026-10-03)
    ...(isArchive(tree) ? { queue: [], queueMore: 0 } : queue(tree, next, all)),
    ...(newer ? { update: { version: newer } } : {}),
    ...(isArchive(tree) ? {} : { spend: { ...monthSpend(tree, new Date().toISOString().slice(0, 7)), currency: "USD" } }),
    ...(intake ? { lastIntake: intake } : {}),
    accepts: accepts(tree, settings, env),
    inbox: { trees: inboxTrees(root, env), material: materialWaiting(tree) },
    sends: recentSends(root, tree),
    batches: batchStatus(tree),
  };
}

/** Run the bridge of the tree here, until idle or stopped. */
export function serveLive(root: string, env: Env): Promise<void> {
  // the stroms it started that write (a send, an adoption, an original, a batch): never started again under them
  const kids = new Set<ChildProcess>();
  const track = (child: ChildProcess) => {
    kids.add(child);
    child.once("exit", () => kids.delete(child));
  };
  // an archive switched by an older strom: its tasks that wait put aside before the app asks (logged, with the reason)
  try {
    const held = settleArchive(Tree.open(root, env));
    if (held.length) noteLive(root, `an archive: ${held.length} task(s) put aside (${held.join(", ")})`);
  } catch (e) {
    noteLive(root, `an archive's tasks not put aside now: ${errorText(e)}`);
  }
  // older hypotheses: the links of their variants their claims say beyond doubt, the rest a task for the agent (once)
  try {
    const done = settleHypothesisLinks(Tree.open(root, env));
    if (done) noteLive(root, `hypotheses: ${done.linked.length} variant link(s) filled in from their claims, ${done.tasks.length} task(s) for the rest`);
  } catch (e) {
    noteLive(root, `the links of the hypotheses' variants not filled in now: ${errorText(e)}`);
  }
  // the address of the last bridge, so the app that followed it finds this one (its secret: none once it was ended for
  // good — a new one); replaced while it runs when a page that is no Strom app comes with it (leaked)
  const { last, foreign } = readLastOf(root);
  // the notes of another folder's bridge (the research copied with its .strom): a new address of its own — a port the
  // system picks and a new secret, so the app following the original never comes here
  if (foreign) noteLive(root, `the bridge's notes came from another folder (${foreign}): a new address`);
  let token = last?.token ?? crypto.randomBytes(16).toString("hex");
  // what this bridge says of itself (live.json), once it listens
  let live: LiveInfo | undefined;
  const idleMs = Number(env.STROM_LIVE_IDLE_MS ?? 2 * 60 * 60_000);
  const pollMs = Number(env.STROM_LIVE_POLL_MS ?? 2000);
  const streams = new Set<http.ServerResponse>();
  let lastAsked = Date.now();
  let ged: { head: string; links: string; version: string; text: string } | undefined;
  let log: { head: string; text: string } | undefined;
  // what git said of each commit, kept: a new commit costs only itself (/log, the changes heard)
  const histories = new HistoryCache(root);

  /** A request that failed: said to the app, written into the log — the bridge goes on. */
  const failed = (req: http.IncomingMessage, res: http.ServerResponse, e: unknown) => {
    noteLive(root, `${req.method} ${masked(req.url)} failed: ${errorText(e)}`);
    try {
      // an answer begun (the events) is only ended
      if (res.headersSent) res.end();
      else res.writeHead(500, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ error: (e as Error)?.message ?? String(e) }));
    } catch {
      res.destroy();
    }
  };

  const safely = (req: http.IncomingMessage, res: http.ServerResponse, fn: () => void) => {
    try {
      fn();
    } catch (e) {
      failed(req, res, e);
    }
  };

  /**
   * What changes something (a send, an adoption, an original, a batch, the app saying nothing came): one line in the
   * log of how it went — its answer's code, marks and why, so the research keeps a trace of each (found on Windows: a
   * refused send and a material taken in left none).
   */
  const told = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const started = Date.now();
    let body = "";
    const end = res.end.bind(res) as (...a: unknown[]) => http.ServerResponse;
    res.end = ((...a: unknown[]) => {
      if (typeof a[0] === "string" && a[0].length < 65536) body = a[0];
      return end(...a);
    }) as typeof res.end;
    res.on("finish", () => {
      let said: Record<string, unknown> = {};
      try {
        said = body ? (JSON.parse(body) as Record<string, unknown>) : {};
      } catch {
        // not JSON: the status alone
      }
      const marks = ["code", "reasonCode", "decided", "take", "intake", "input", "changes", "applied", "pending", "keptAs", "known", "batch", "sha"]
        .filter((k) => said[k] !== undefined && said[k] !== null && typeof said[k] !== "object")
        .map((k) => `${k} ${String(said[k]).slice(0, 80)}`);
      if (Array.isArray(said.conflicts) && said.conflicts.length) marks.push(`conflicts ${said.conflicts.length}`);
      if (Array.isArray(said.skipped) && said.skipped.length) marks.push(`skipped ${said.skipped.length}`);
      const why = res.statusCode >= 400 ? String(said.text ?? said.reason ?? said.error ?? "").replace(/\s+/g, " ").slice(0, 300) : "";
      const route = masked(req.url).replace(/\?.*$/, "");
      noteLive(root, `${req.method} ${route} → ${res.statusCode}${marks.length ? ` · ${marks.join(", ")}` : ""}${why ? ` · ${why}` : ""} (${Date.now() - started} ms)`);
    });
  };

  const server = http.createServer((req, res) => {
    if (req.method === "POST" || req.method === "PUT") told(req, res);
    safely(req, res, () => answer(req, res));
  });
  // an original of hundreds of MB takes its time to come
  server.requestTimeout = 30 * 60_000;
  // a connection the app keeps open is not closed under a request it sends again a moment later (a busy computer:
  // the client's own wait runs out after Node's 5 s, the request comes as the connection closes — "reset")
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  /**
   * The secret came from a page that is no Strom app: replaced at once — written where strom app reads it (live.json,
   * live-last.json), the event streams on the old one ended (the app notices), said in the log. What is being written
   * meanwhile finishes; every new request needs the new secret.
   */
  const leaked = (req: http.IncomingMessage, from: string, what: string | undefined) => {
    token = crypto.randomBytes(16).toString("hex");
    for (const s of streams) s.end();
    streams.clear();
    if (live) {
      live = { ...live, token, url: `http://127.0.0.1:${live.port}/${token}` };
      try {
        const now = liveRunning(root);
        if (!now || now.pid === process.pid) writeLive(root, live);
        const was = readLast(root);
        if (!was || was.pid === process.pid) writeLast(root, { port: live.port, token, pid: process.pid, started: live.started });
      } catch (e) {
        noteLive(root, `the new secret not written: ${errorText(e)}`);
      }
    }
    const page = from.replace(/[\u0000-\u001f\u007f]/g, "?").slice(0, 200);
    noteLive(root, `${req.method} /…/${String(what ?? "").slice(0, 40)} came with the secret from ${page}, a page that is no Strom app: the address got out — a new secret, the old one no longer works (the Strom app gets the new one when the research is opened in it again: strom app)`);
  };

  /** The tree for the app as it is now (at its head; made again for another head, version of the app or links). */
  const giveGed = (res: http.ServerResponse, version: string | undefined) => {
    const h = head(root);
    // made again for another version of the app (two windows, two versions: each gets what it reads)
    if (!ged || ged.head !== h || ged.version !== (version ?? "") || ged.links !== (appOpensLinks(new Settings(env, {}), version) ? links(env).join(" ") : "")) {
      const tree = Tree.open(root, env);
      // the images from the cache; new ones made for a while at most (the rest the next time the tree changes)
      const set = excerptSettings(tree);
      const images = set ? planExcerpts(tree, set.shared, { quality: set.quality, for: set.for, maxBytes: set.mb * 1024 * 1024, budgetMs: LIVE_IMAGES_MS }) : undefined;
      // an app that opens strom-research:// links: each excerpt's mark, and the links this computer takes
      const opens = appOpensLinks(new Settings(env, {}), version);
      // …and where the tree ends, for an app that shows it
      const edges = appShowsEdges(new Settings(env, {}), version);
      const storyDrafts = appShowsStoryDrafts(new Settings(env, {}), version);
      const coupleResi = appShowsCoupleEvents(new Settings(env, {}), version);
      const sourceReads = appShowsSourceReads(new Settings(env, {}), version);
      const factStatus = appShowsFactStatus(new Settings(env, {}), version);
      const archive = appKnowsArchive(new Settings(env, {}), version);
      const turnsExcerpts = appTurnsExcerpts(new Settings(env, {}), version);
      const noCouple = appKnowsNoCouple(new Settings(env, {}), version);
      const titles = appReadsTitles(new Settings(env, {}), version);
      const hypothesisLinks = appShowsHypothesisLinks(new Settings(env, {}), version);
      const conflictSides = appDecidesConflicts(new Settings(env, {}), version);
      const offered = opens ? links(env) : [];
      ged = {
        head: h,
        links: offered.join(" "),
        version: version ?? "",
        text: exportGedcom(tree, { for: "strom", ...(h ? { head: h } : {}), ...(images ? { excerpts: images.of } : {}), ...(opens ? { clips: true, research: true } : {}), ...(edges ? { edges } : {}), ...(storyDrafts ? { storyDrafts } : {}), ...(coupleResi ? { coupleResi } : {}), ...(sourceReads ? { sourceReads } : {}), ...(factStatus ? { factStatus } : {}), ...(archive ? { archive } : {}), ...(turnsExcerpts ? { turnsExcerpts } : {}), ...(noCouple ? { noCouple } : {}), ...(titles ? { titles } : {}), ...(hypothesisLinks ? { hypothesisLinks } : {}), ...(conflictSides ? { conflictSides } : {}), ...(offered.length ? { links: offered, ...(linkScheme(env) !== LINK_SCHEME ? { linkScheme: linkScheme(env) } : {}) } : {}) }).text,
      };
    }
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Strom-Head": h }).end(ged.text);
  };

  // A commit a moment ago: another may follow at once — the tree is made once none came for quietMs (at most
  // quietMaxMs after it was asked for), and then from the newest; a tree already made for the head now: at once.
  const quietMs = Number(env.STROM_LIVE_QUIET_MS ?? 2000);
  const quietMaxMs = Number(env.STROM_LIVE_QUIET_MAX_MS ?? 6000);
  const afterQuiet = (fn: () => void) => {
    const asked = Date.now();
    const look = () => {
      let since = Infinity;
      try {
        const { head: h, at } = tip(root);
        if (!ged || ged.head !== h) since = at ? Date.now() - Date.parse(at) : Infinity;
      } catch {
        // git not answering: the tree is made now (it says why)
      }
      const left = asked + quietMaxMs - Date.now();
      if (!(since < quietMs) || left <= 0) return fn();
      setTimeout(look, Math.max(100, Math.min(quietMs - since, left)));
    };
    look();
  };

  const answer = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const [, t, what, sub, act] = (req.url ?? "").split("?")[0]!.split("/");
    // the app asking now and then (?poll=1) keeps no bridge running; anything else does
    if (!(req.method === "GET" && what === "status" && /[?&]poll=1(?:&|$)/.test(req.url ?? ""))) lastAsked = Date.now();
    // the secret from a page that is no Strom app: replaced, this request answered as one without it (no data, no CORS)
    if (t === token && foreignOrigin(req.headers.origin, env)) {
      leaked(req, String(req.headers.origin), what);
      res.writeHead(404).end();
      return;
    }
    const origin = allowedOrigin(req.headers.origin);
    const version = appVersionOf(req, new Settings(env, {}));
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      if (origin) {
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT");
        res.setHeader("Access-Control-Allow-Headers", String(req.headers["access-control-request-headers"] ?? ""));
        if (req.headers["access-control-request-private-network"]) res.setHeader("Access-Control-Allow-Private-Network", "true");
        // the app asks every minute: its browser asks first only every ten
        res.setHeader("Access-Control-Max-Age", "600");
      }
      res.writeHead(origin ? 204 : 403).end();
      return;
    }
    if (req.method === "POST" && t === token && what === "sync" && sub && act === "again") {
      again(req, res, origin, decodeURIComponent(sub));
      return;
    }
    if (req.method === "POST" && t === token && what === "sync") {
      receive(req, res, origin);
      return;
    }
    if (req.method === "POST" && t === token && what === "cancel") {
      nothing(req, res, origin);
      return;
    }
    if (req.method === "POST" && t === token && what === "adopt") {
      receive(req, res, origin, "adopt");
      return;
    }
    if (req.method === "PUT" && t === token && what === "media") {
      original(req, res, origin, sub ?? "");
      return;
    }
    if (req.method === "POST" && t === token && what === "batch" && act === "done") {
      batchDone(req, res, origin, decodeURIComponent(sub ?? ""));
      return;
    }
    if (req.method === "POST" && t === token && what === "conflict" && sub && !act) {
      decideFor(req, res, origin, "conflict", decodeURIComponent(sub), conflictDecision);
      return;
    }
    if (req.method !== "GET" || t !== token) {
      res.writeHead(404).end();
      return;
    }
    try {
      if (what === "adopt") {
        // the new research started from the app's link: which tree of the app it waits for (its mark), its name
        // until when it waits (the app says so in its window), and whether the tree comes from another browser
        // (transfer: the app takes it from GET /transfer first)
        const wait = adoptionWait(root);
        const mark = wait?.token;
        // the app got here: a terminal still waiting says no more that it may be kept from it (D7)
        if (wait) noteAdoptAsked(root);
        const tree = Tree.open(root, env);
        // handed over already (its link opened again): said so — gone, not a tree the research never waited for
        const taken = mark ? undefined : adoptedAt(root, 0);
        const body = wait
          ? { token: wait.token, name: tree.config.name, tree: tree.config.id, until: wait.until, ...(wait.transfer ? { transfer: true } : {}), ...(wait.existing ? { existing: true } : {}) }
          : taken
            ? { adopted: true, name: tree.config.name, tree: tree.config.id, error: "the tree was handed over to this research already" }
            : { error: "this research waits for no tree" };
        const text = JSON.stringify(body);
        res.writeHead(mark ? 200 : taken ? 410 : 404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(text);
      } else if (what === "transfer") {
        // the app's tree from a browser the app cannot reach strom from, as it came — only while the research waits
        // for it (the app in the browser it moved to checks its mark, then hands it over as POST /adopt)
        const file = adoptionWait(root)?.transfer;
        if (!file) {
          res.writeHead(404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ error: "this research waits for no tree moving here" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": String(fs.statSync(file).size) });
        fs.createReadStream(file)
          .on("error", () => res.destroy())
          .pipe(res);
      } else if (what === "media") {
        // what the research has of this content: said — or, asked for, the file itself
        const sha = (sub ?? "").toLowerCase();
        const shared = new Settings(env, {}).shared()?.value;
        const known = /^[0-9a-f]{64}$/.test(sha) ? knownOriginal(Tree.open(root, env), shared, sha) : undefined;
        const json = (code: number, body: Record<string, unknown>) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
        if (!known) json(404, { known: null });
        else if (!/[?&]file=1(?:&|$)/.test(req.url ?? "")) json(200, { known: known.id, kind: known.kind, mime: known.mime, bytes: known.bytes, ...(known.name ? { name: known.name } : {}), here: !!known.file && fs.existsSync(known.file) });
        else if (!known.file || !fs.existsSync(known.file)) json(410, { known: known.id, ...refusal("its file is not on this computer", "media.gone", { known: known.id }) });
        else {
          const size = fs.statSync(known.file).size;
          res.writeHead(200, { "Content-Type": known.mime, "Content-Length": String(size), "Cache-Control": "no-store", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(known.name ?? path.basename(known.file))}` });
          fs.createReadStream(known.file).on("error", (e) => failed(req, res, e)).pipe(res);
        }
      } else if (what === "material") {
        // the family's files the research keeps — an archive's too, which nobody sorts: the app shows them again
        const q = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
        const person = (q.get("person") ?? "").toUpperCase();
        const batch = q.get("batch") ?? "";
        const json = (code: number, body: unknown) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
        if ((q.has("person") && !/^P\d{1,9}$/.test(person)) || (q.has("batch") && !BATCH_ID.test(batch))) json(400, { error: "?person=P… (a person of the research), ?batch=<the batch's mark>" });
        else json(200, material(Tree.open(root, env), new Settings(env, {}).shared()?.value, { ...(person ? { person } : {}), ...(batch ? { batch } : {}) }));
      } else if (what === "status") {
        // what is answered is made first: a read that fails can still answer 500
        const text = JSON.stringify(status(root, env, version));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(text);
      } else if (what === "recent") {
        // what another window of hours added (the same as /status recent); worked out now, the bridge answers others meanwhile
        const said = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("hours");
        const hours = said === null ? RECENT_HOURS : /^\d{1,3}$/.test(said) ? Number(said) : NaN;
        const json = (code: number, body: unknown) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
        if (!(hours >= 1 && hours <= 168)) json(400, { error: "?hours=1…168 (24 when not given)" });
        else
          recentChanges(root, env, hours).then(
            (r) => (r ? json(200, r) : json(404, { error: "the research has no commit yet" })),
            (e) => failed(req, res, e),
          );
      } else if (what === "log") {
        const h = head(root);
        if (!log || log.head !== h) log = { head: h, text: JSON.stringify({ entries: histories.log(Tree.open(root, env), h) }) };
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(log.text);
      } else if (what === "tree.ged" || what === "images.ged") {
        // made when the commits stop coming (an agent's commands one after another): once for them all
        afterQuiet(() => safely(req, res, () => giveGed(res, version)));
      } else if (what === "events") {
        const hello = JSON.stringify(status(root, env, version));
        res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write(`event: hello\ndata: ${hello}\n\n`);
        streams.add(res);
        req.on("close", () => streams.delete(res));
        res.on("error", () => streams.delete(res));
      } else res.writeHead(404).end();
    } catch (e) {
      failed(req, res, e);
    }
  };

  // What the app sends is written at once (an archive; a research unless the user reviews each send, sync.review on):
  // by a strom of its own (strom sync <file> --apply), so the bridge answers meanwhile; one at a time — a send that
  // comes while one is written waits in the inbox, and every one that waits is written in its turn, the oldest first
  // (one of each tree of the app: a newer send of the same tree replaces the one that waits). The research busy (another
  // strom holding it longer than a writer waits): the send is tried again a while later, not left waiting for ever.
  let writing: string | undefined;
  let retryAt: ReturnType<typeof setTimeout> | undefined;
  const WRITE_ANSWER_MS = Number(env.STROM_SYNC_ANSWER_MS ?? 20_000);
  const RETRY_MS = Number(env.STROM_SYNC_RETRY_MS ?? 30_000);
  const RETRIES = 5;
  const writesAtOnce = () => {
    try {
      const tree = Tree.open(root, env);
      return isArchive(tree) || !new Settings(env, {}).syncReview(tree.config);
    } catch {
      return false;
    }
  };
  /** The next send that waits to be written: the oldest. */
  const writeNext = () => {
    if (writing || !writesAtOnce()) return;
    const next = receivedPending(root).at(-1);
    if (next) write({ file: path.join(root, SYNC_INBOX, next.file), changes: next.changes, intake: next.intake }, () => {});
  };
  const write = (sent: { file: string; changes: number; intake: string }, reply: (code: number, body: Record<string, unknown>) => void) => {
    if (writing) {
      reply(202, { ok: true, inbox: false, pending: true, changes: sent.changes, intake: sent.intake });
      return;
    }
    writing = sent.intake;
    const { command, args } = stromLauncher();
    const child = spawn(command, [...args, "sync", sent.file, "--apply", "--json"], {
      cwd: root,
      env: forApp(env, root),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    track(child);
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (err += d.toString("utf8")));
    let answered = false;
    const timer = setTimeout(() => {
      answered = true;
      reply(202, { ok: true, inbox: false, pending: true, changes: sent.changes, intake: sent.intake });
    }, WRITE_ANSWER_MS);
    child.on("error", (e) => noteLive(root, `a send could not be written: ${errorText(e)}`));
    child.on("close", (code) => {
      clearTimeout(timer);
      let data: { input?: string | null; changes?: Change[]; message?: string; code?: string; params?: Record<string, string>; skipped?: Skipped[]; applied?: { do: string; id: string; before?: unknown }[] } = {};
      try {
        data = JSON.parse(out) as typeof data;
      } catch {
        // said by the exit code
      }
      const why = data.message ?? err.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? "the send was not written";
      // the research busy: tried again a while later (the app keeps following it as pending)
      const busy = code === EXIT.locked;
      if (code !== 0) noteLive(root, `the send ${sent.intake} was not written (exit ${code}${busy ? ", the research busy: tried again later" : ""}): ${why}`);
      // the same file as a sync before (sent again unchanged): nothing new, the input it was then only named
      else noteLive(root, `the send ${sent.intake} ${data.input && data.changes?.length ? `written: ${data.input}` : `brought nothing new${data.input ? ` (the same as ${data.input})` : ""}`}${data.skipped?.length ? `, ${data.skipped.length} change(s) left out` : ""}`);
      if (code !== 0) {
        const r = failReceived(root, sent.intake, why, busy, { code: data.code, params: data.params });
        if (busy && r && (r.tries ?? 0) >= RETRIES) failReceived(root, sent.intake, `the research was busy ${RETRIES} times: ${why}`, false);
      }
      if (!answered) {
        if (code === 0) {
          // the conflicts it opened: the app says the user has something to decide, and whose
          let conflicts: ReturnType<typeof syncConflicts> = [];
          try {
            if (data.input) conflicts = syncConflicts(Tree.open(root, env), data.input);
          } catch {
            // the app finds them in /status.sends
          }
          const changes = data.changes ?? [];
          reply(200, {
            ok: true,
            inbox: false,
            changes: sent.changes,
            applied: changes.filter((c) => c.action !== "pick" && c.action !== "report").length - (data.skipped?.length ?? 0),
            // the people and sources it brought, under the IDs the research gave them (the app's xref → P…, S…): the app
            // keeps them as their REFN, its next send names them so (as an adoption's answer does)
            ...idsOf(data.applied ?? [], receivedAll(root).find((r) => r.intake === sent.intake)?.known),
            ...(changes.some((c) => c.kept) ? { kept: changes.filter((c) => c.kept).length } : {}),
            // what sends taken back since the copy was made brought: left out, not written again
            ...(changes.some((c) => c.takenBack) ? { takenBack: changes.filter((c) => c.takenBack).length } : {}),
            // every change not written, and why (never a silent nothing): taken back since, kept for a window that never
            // had it, only said (no longer in the file: the research never deletes), the user to pick (no state given) —
            // with the sources the user gave it that went unwritten with it (`cites`: the file's own keys, as `ids` has them)
            ...(changes.some((c) => c.action === "report" || c.action === "pick")
              ? {
                  notWritten: changes
                    .filter((c) => c.action === "report" || c.action === "pick")
                    .map((c) => ({ kind: c.kind, ...(c.person ? { person: c.person } : {}), ...(c.family ? { family: c.family } : {}), ...(c.fact?.kind ?? c.was?.kind ? { fact: c.fact?.kind ?? c.was?.kind } : {}), why: c.takenBack ? "takenBack" : c.kept ? "kept" : c.action, ...(c.uncited?.length ? { cites: c.uncited.map((k) => (k.startsWith("x:") ? `@${k.slice(2)}@` : k)) } : {}) })),
                }
              : {}),
            // the changes the research could not write (the rest is written): what and why
            ...(data.skipped?.length ? { skipped: data.skipped } : {}),
            head: head(root),
            ...(data.input ? { input: data.input } : {}),
            conflicts,
            intake: sent.intake,
          });
        } else if (busy) reply(202, { ok: true, inbox: false, pending: true, retry: Math.round(RETRY_MS / 1000), changes: sent.changes, intake: sent.intake });
        // a sentence the app shows as it is (3.8 shows "error" of a refusal), what went wrong beside it
        else {
          let lang = "en";
          try {
            lang = Tree.open(root, env).lang;
          } catch {
            // said in English
          }
          // why, as a program reads it too (a change the research cannot write: its people and families by name)
          let reasonNames: Record<string, string> | undefined;
          try {
            if (data.params) reasonNames = namesOf(Tree.open(root, env), data.params);
          } catch {
            // the IDs only
          }
          reply(500, { ...said(lang, "ui.sync.bridge.failed"), reason: why, ...(data.code ? { reasonCode: data.code } : {}), ...(data.params ? { reasonParams: data.params, reasonNames } : {}), intake: sent.intake });
        }
      }
      writing = undefined;
      // the next that waits; the research busy: a while later
      if (busy) {
        clearTimeout(retryAt);
        retryAt = setTimeout(writeNext, RETRY_MS);
        retryAt.unref?.();
      } else writeNext();
    });
  };

  /**
   * The app's tree for a new research (POST /adopt), taken in here — by a strom of its own (strom sync --apply
   * --force: as the app's trees are, its sources the research's), whether or not the research in the terminal still
   * waits: adopted only once it is in. The app hears the head with it, or why not (a sentence; what went wrong in the
   * log and for the terminal); longer than the app waits: 202, adopted when it is in.
   */
  let adopting = false;
  const ADOPT_ANSWER_MS = Number(env.STROM_ADOPT_ANSWER_MS ?? 90_000);
  const adopt = (file: string, reply: (code: number, body: Record<string, unknown>) => void, lang: string, app: string | undefined) => {
    const tree = Tree.open(root, env).config.id;
    // no people yet (C1: installed from the app's start screen): handed over with nothing to take in — the research
    // stays empty, linked to the app, and the people the app adds later come by its sends (adopt.empty)
    if (adoptedEmpty(fs.readFileSync(file, "utf8"))) {
      try {
        markAdopted(root, undefined, app);
      } catch (e) {
        noteLive(root, `the app's tree was not taken in: ${errorText(e)}`);
        reply(500, { ...said(lang, "ui.sync.bridge.adopt"), reason: errorText(e) });
        return;
      }
      noteLive(root, "the app's tree taken in: no people in it yet");
      reply(200, { tree, head: head(root) ?? "", empty: true, ids: { persons: {}, sources: {} } });
      return;
    }
    adopting = true;
    const { command, args } = stromLauncher();
    const child = spawn(command, [...args, "sync", file, "--apply", "--force", "--json"], {
      cwd: root,
      env: forApp(env, root),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    track(child);
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (err += d.toString("utf8")));
    let answered = false;
    const timer = setTimeout(() => {
      answered = true;
      reply(202, { tree, pending: true });
    }, ADOPT_ANSWER_MS);
    const failed = (why: string) => {
      noteLive(root, `the app's tree was not taken in: ${why}`);
      noteAdoptFailed(root, "other", why);
      if (!answered) reply(500, { ...said(lang, "ui.sync.bridge.adopt"), reason: why });
    };
    child.on("error", (e) => {
      clearTimeout(timer);
      adopting = false;
      failed(errorText(e));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      adopting = false;
      if (code === null) return; // the error said it
      let data: { input?: string | null; message?: string; applied?: { do: string; id: string; before?: string }[] } = {};
      try {
        data = JSON.parse(out) as typeof data;
      } catch {
        // said by the exit code
      }
      if (code !== 0) return failed(data.message ?? err.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? `exit ${code}`);
      try {
        markAdopted(root, data.input ?? undefined, app);
      } catch (e) {
        return failed(errorText(e));
      }
      noteLive(root, `the app's tree taken in${data.input ? ` (${data.input})` : ""}`);
      // what each of the app's people and sources is in the research (its xref → P…, S…): the app keeps them as their
      // REFN, so its next send is the research's people by their IDs (found on Windows: one renamed came as a new one)
      const ids = (kind: string) =>
        Object.fromEntries((data.applied ?? []).filter((a) => a.do === kind && a.before?.startsWith("x:")).map((a) => [`@${a.before!.slice(2)}@`, a.id]));
      if (!answered) reply(200, { tree, head: head(root) ?? "", ...(data.input ? { input: data.input } : {}), ids: { persons: ids("person.add"), sources: ids("source.add") } });
    });
  };

  /**
   * A tree of the app taken: written at once (or waiting in the inbox, sync.review on). Sends taken back after the state
   * it was sent from are said (`undoneSince`): the copy still carries what the research took back — the app loads the
   * research, or sends one of them again (POST /sync/<R…>/again; found on Windows: sent again after an undo, nothing
   * new, the app and the research apart without a word).
   */
  const take = (text: string, reply: (code: number, body: Record<string, unknown>) => void, again?: string) => {
    const since = undoneSince(root, text);
    const told = (code: number, body: Record<string, unknown>) => reply(code, since.length && code < 400 ? { ...body, undoneSince: since } : body);
    const got = receiveTree(root, env, text, { ...(writing ? { keep: writing } : {}), ...(again ? { again } : {}) });
    const tree = Tree.open(root, env);
    // nothing new: nothing waits, nothing written
    if (!got.changes) {
      told(200, { ok: true, changes: 0, file: path.basename(got.file), inbox: false, head: head(root), conflicts: [], intake: got.intake });
      return;
    }
    if (isArchive(tree) || !new Settings(env, {}).syncReview(tree.config)) {
      write(got, told);
      return;
    }
    told(200, { ok: true, changes: got.changes, file: path.basename(got.file), inbox: true, intake: got.intake });
  };

  /** A send taken back (strom sync undo), sent again by the app: its file as it came, from the state it was sent from. */
  const again = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, intake: string) => {
    const reply = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    };
    req.resume();
    if (!origin) return reply(403, { error: "only the Strom app may send a tree here" });
    const text = undoneSend(root, intake);
    if (!text) return reply(404, { error: `no send ${intake.slice(0, 64)} taken back is kept here`, code: "send.none", intake });
    safely(req, res, () => {
      try {
        take(
          text,
          (code, body) => {
            if (code < 400 && typeof body.intake === "string") markSentAgain(root, intake, body.intake);
            reply(code, body);
          },
          intake,
        );
      } catch (e) {
        const m = (e as Error).message;
        const code = e instanceof StromError ? e.code : undefined;
        const key = code ? REFUSED[code] : undefined;
        let lang = "en";
        try {
          lang = Tree.open(root, env).lang;
        } catch {
          // said in English
        }
        reply(400, key ? said(lang, key) : { error: m, code: "tree.refused", text: m });
      }
    });
  };

  /** The user's tree from the app: only from its pages, only so large; the answer in the research's language. */
  const receive = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, as: "sync" | "adopt" = "sync") => {
    const reply = (code: number, body: Record<string, unknown>) =>
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    const lang = () => {
      try {
        return Tree.open(root, env).lang;
      } catch {
        return "en";
      }
    };
    if (!origin) {
      reply(403, { error: "only the Strom app may send a tree here" });
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let over = false;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > SYNC_MAX_BYTES) over = true;
      else chunks.push(c);
    });
    req.on("error", (e) => noteLive(root, `a tree from the app did not come whole: ${errorText(e)}`));
    req.on("end", () => safely(req, res, () => {
      if (over) {
        reply(413, said(lang(), "ui.sync.bridge.large"));
        return;
      }
      try {
        // the version the app says with it (its file writes none of its own): the tree is read as that app means it
        const text = stampAppVersion(Buffer.concat(chunks).toString("utf8"), saidAppVersion(req));
        if (as === "adopt") {
          if (adopting) {
            reply(409, said(lang(), "ui.sync.bridge.adopting"));
            return;
          }
          adopt(receiveAdopted(root, text, origin), reply, lang(), appVersionOf(req, new Settings(env, {})));
          return;
        }
        take(text, reply);
      } catch (e) {
        const m = (e as Error).message;
        const code = e instanceof StromError ? e.code : undefined;
        // the new research in the terminal waits for it: told, it stops waiting
        if (as === "adopt" && pendingAdoption(root)) noteAdoptFailed(root, code === "tree.empty" ? "empty" : "other");
        const key = code ? REFUSED[code] : undefined;
        // what came, kept aside to be looked at (.strom/sync/kept/)
        const keptAs = e instanceof StromError ? (e.details as { kept?: string } | undefined)?.kept : undefined;
        reply(400, { ...(key ? said(lang(), key) : { error: m, code: "tree.refused", text: m }), ...(keptAs ? { keptAs } : {}) });
      }
    }));
  };

  /**
   * An original from the app: only from its pages, only so large and while there is room; streamed to a file beside
   * the shared store (never all in memory), its SHA-256 checked, then taken by a strom of its own (strom media original),
   * which keeps it — the same content again is only said.
   */
  const original = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, rawSha: string) => {
    // 503 is only "busy, send it again": always with when (Retry-After)
    const reply = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(code === 503 ? { "Retry-After": "30" } : {}) }).end(JSON.stringify(body));
    };
    // refused before it is read: answered at once, the rest of the body read and thrown away — a connection closed
    // under a browser still sending is an error of the network to it, not the answer
    const refuse = (code: number, body: Record<string, unknown>) => {
      reply(code, body);
      req.resume();
    };
    if (!origin) return refuse(403, refusal("only the Strom app may send a file here", "app.only"));
    const sha = rawSha.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha)) return refuse(400, refusal("the address names no SHA-256", "media.bad-sha"));
    const header = (n: string) => {
      const v = req.headers[n];
      return typeof v === "string" ? v : undefined;
    };
    let name: string;
    let note: string | undefined;
    let meta: { persons: string[]; source?: string };
    let region: string | undefined;
    let batch: string | undefined;
    let where: string | undefined;
    const zip = header("x-strom-zip") === "1";
    const tree = Tree.open(root, env);
    // the header read when it failed (its value not URI-encoded too): said by its name
    let at = "X-Strom-Batch";
    try {
      batch = header("x-strom-batch")?.trim();
      if (batch !== undefined && !BATCH_ID.test(batch)) throw new Error("X-Strom-Batch: the batch's mark (letters, digits, -)");
      at = "X-Strom-Zip";
      if (zip && !batch) throw new Error("X-Strom-Zip: a ZIP comes in a batch (X-Strom-Batch)");
      at = "X-Strom-Path";
      where = header("x-strom-path") ? batchPath(decodeURIComponent(header("x-strom-path")!)) : undefined;
      at = "X-Strom-Name";
      name = decodeURIComponent(header("x-strom-name") ?? "") || sha.slice(0, 12);
      at = "X-Strom-Note";
      note = header("x-strom-note") ? decodeURIComponent(header("x-strom-note")!).slice(0, 500) : undefined;
      at = "X-Strom-Person";
      const persons = (header("x-strom-person") ?? "").split(",").map((p) => p.trim().toUpperCase()).filter(Boolean);
      if (persons.some((p) => !/^P\d{1,9}$/.test(p))) throw new Error("X-Strom-Person: IDs of the research's people (P…), with commas");
      at = "X-Strom-Source";
      const source = header("x-strom-source")?.trim().toUpperCase();
      if (source && !/^S\d{1,9}$/.test(source)) throw new Error("X-Strom-Source: the ID of a source of the research (S…)");
      at = "X-Strom-Region";
      region = header("x-strom-region")?.trim();
      parseRegion(region);
      meta = checkOriginalMeta(tree, { persons, source });
    } catch (e) {
      // a person or a source the research has not got: 404, its JSON body telling it from an address that is no bridge's
      const m = (e as Error).message;
      const coded = e instanceof StromError && e.code ? refusal(m, e.code, e.params ?? {}) : refusal(m, "media.bad-header", { header: at });
      return refuse(/^no (person|source)/.test(m) ? 404 : 400, coded);
    }
    const settings = new Settings(env, {});
    const shared = settings.shared()?.value;
    // not set up (no shared folder): sending again does not help — /status says accepts.media null
    if (!shared) return refuse(500, refusal("the research has no shared folder for files (strom setup)", "media.no-shared"));
    // a batch: open, with room for it
    let open: ReturnType<typeof openBatch> | undefined;
    const length = Number(header("content-length") ?? NaN);
    if (batch) {
      try {
        open = openBatch(root, batch);
      } catch (e) {
        return refuse(409, { ...refusalOf((e as Error).message, e instanceof StromError ? e : {}, "batch.closed"), batch });
      }
      const full = batchRoom(open, Number.isFinite(length) ? length : 0, env);
      if (full) return refuse(413, { ...refusal(full.text, full.code, full.params), batch });
    }
    // the same content: only said (an image of another source given again is taken as one more of that source)
    const known = zip ? undefined : knownOriginal(tree, shared, sha);
    const onSource = !batch && !!meta.source && known?.kind === "media" && !tree.get<Source>(meta.source)?.media?.includes(known.id);
    if (known && !onSource) {
      if (open) noteBatch(root, open, { known: known.id });
      // an input of the people, said of again — people it lacks, a note it has not got: added by a strom of its own
      // (found live: the app said "Sent" while the research took nothing)
      const had = known.kind === "input" && !batch ? tree.get<Input>(known.id) : undefined;
      const more = had && (meta.persons.some((p) => !(had.persons ?? []).includes(p)) || (!!note?.trim() && !had.notes.some((n) => foldText(n.text) === foldText(note!.trim()))));
      if (!more) return refuse(200, { known: known.id, kind: known.kind, ...(batch ? { batch } : {}) });
      req.resume();
      const { command, args } = stromLauncher();
      const child = spawn(command, [...args, "input", "amend", known.id, ...meta.persons.flatMap((p) => ["--person", p]), ...(note ? [`--note=${note}`] : []), "--json"], {
        cwd: root,
        env: forApp(env, root),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      track(child);
      let stdout = "";
      child.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
      child.stderr.resume();
      child.on("error", () => reply(200, { known: known.id, kind: known.kind }));
      child.on("close", (code) => {
        let data: { added?: unknown; task?: unknown } = {};
        try {
          data = JSON.parse(stdout) as typeof data;
        } catch {
          // said by the exit code
        }
        if (code !== 0) noteLive(root, `what came again for ${known.id} was not added (exit ${code})`);
        if (code === EXIT.locked) return reply(503, { ...refusal("the research is busy — send it again in a while", "research.busy"), retry: 30 });
        reply(200, { known: known.id, kind: known.kind, ...(code === 0 && data.added ? { added: data.added } : {}), ...(code === 0 && data.task ? { task: data.task } : {}), ...(code === 0 ? { head: head(root) } : {}) });
      });
      return;
    }
    // a ZIP of a batch may be larger than one file (unpacked here, each of its files no larger than one): below 4 GB
    const max = zip ? 4 * 1024 ** 3 - 1 : originalMax(env);
    if (length > max) return refuse(413, { ...said(tree.lang, "ui.media.large", { mb: String(Math.round(max / 1024 / 1024)) }), max });
    const free = freeBytes(shared);
    if (free !== undefined && free - ORIGINAL_RESERVE < (Number.isFinite(length) ? length : max)) return refuse(507, { ...said(tree.lang, "ui.media.full"), free: Math.max(0, free - ORIGINAL_RESERVE) });
    // beside the store, on its disk: moved into it whole
    const dir = path.join(shared, "media", ".incoming");
    fs.mkdirSync(dir, { recursive: true });
    const part = path.join(dir, `${sha}-${crypto.randomBytes(4).toString("hex")}.part`);
    const out = fs.createWriteStream(part);
    const hash = crypto.createHash("sha256");
    let size = 0;
    let over = false;
    const drop = () => fs.rmSync(part, { force: true });
    req.on("data", (c: Buffer) => {
      if (over) return;
      size += c.length;
      if (size > max) {
        // larger than it said: answered, the rest thrown away as it comes
        over = true;
        out.destroy();
        drop();
        reply(413, { ...said(tree.lang, "ui.media.large", { mb: String(Math.round(max / 1024 / 1024)) }), max });
        req.resume();
        return;
      }
      hash.update(c);
      if (!out.write(c)) {
        req.pause();
        out.once("drain", () => req.resume());
      }
    });
    req.on("aborted", () => {
      out.destroy();
      drop();
    });
    req.on("error", (e) => {
      noteLive(root, `an original from the app did not come whole: ${errorText(e)}`);
      out.destroy();
      drop();
    });
    out.on("error", (e) => {
      over = true;
      drop();
      reply(/ENOSPC/.test(String(e)) ? 507 : 500, /ENOSPC/.test(String(e)) ? said(tree.lang, "ui.media.full") : { error: errorText(e), code: "media.failed", text: errorText(e) });
      req.resume();
    });
    req.on("end", () => {
      if (over) return;
      out.end(() => safely(req, res, () => {
        if (hash.digest("hex") !== sha) {
          drop();
          reply(409, refusal("the file is not the one its address names (its SHA-256 differs) — send it again", "media.sha-differs", { sha }));
          return;
        }
        // taken by a strom of its own: its lock, its log and its commit
        const { command, args } = stromLauncher();
        const child = spawn(
          command,
          [
            ...args, "media", "original", part, "--sha", sha, `--name=${name}`,
            ...meta.persons.flatMap((p) => ["--person", p]),
            ...(meta.source ? ["--source", meta.source] : []),
            ...(region ? ["--region", region] : []),
            ...(note ? [`--note=${note}`] : []),
            ...(batch ? ["--batch", batch, ...(where ? [`--path=${where}`] : []), ...(zip ? ["--zip"] : [])] : []),
            "--json",
          ],
          { cwd: root, env: forApp(env, root), stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
        );
        track(child);
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
        child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
        child.on("error", (e) => {
          drop();
          reply(500, refusal(errorText(e), "media.failed"));
        });
        child.on("close", (code) => {
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(stdout) as Record<string, unknown>;
          } catch {
            // said by the exit code
          }
          if (code === 0) {
            reply(200, { ...data, sha, bytes: size, head: head(root) });
            return;
          }
          drop();
          const why = String((data as { message?: unknown }).message ?? stderr.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? "the file was not taken");
          noteLive(root, `an original was not taken (exit ${code}): ${why}`);
          // the research busy (another strom holding it longer than a writer waits): the app sends it again later
          if (code === EXIT.locked) return reply(503, { ...refusal(why, "research.busy"), retry: 30 });
          reply(/not a kind of file/.test(why) ? 415 : /cut short|too small/.test(why) ? 422 : /the most one takes/.test(why) ? 413 : /closed already/.test(why) ? 409 : 400, refusalOf(why, data, "media.refused"));
        });
      }));
    });
  };

  /** Close a batch by a strom of its own (strom input batch done): its files become sorting tasks. */
  const closing = new Set<string>();
  const closeBatchNow = (id: string, extra: string[], reply: (code: number, body: Record<string, unknown>) => void) => {
    if (closing.has(id)) return reply(202, { pending: true, batch: id });
    closing.add(id);
    const { command, args } = stromLauncher();
    const child = spawn(command, [...args, "input", "batch", "done", id, ...extra, "--json"], {
      cwd: root,
      env: forApp(env, root),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    track(child);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    child.on("error", (e) => {
      closing.delete(id);
      reply(500, { ...refusal(errorText(e), "media.failed"), batch: id });
    });
    child.on("close", (code) => {
      closing.delete(id);
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(stdout) as Record<string, unknown>;
      } catch {
        // said by the exit code
      }
      if (code === 0) return reply(200, { ...data, head: head(root) });
      const why = String(data.message ?? stderr.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? "the batch was not closed");
      noteLive(root, `the batch ${id} was not closed (exit ${code}): ${why}`);
      if (code === EXIT.locked) return reply(503, { ...refusal(why, "research.busy"), retry: 30, batch: id });
      reply(/no batch/.test(why) ? 404 : 400, { ...refusalOf(why, data, /no batch/.test(why) ? "batch.none" : "media.refused"), batch: id });
    });
  };

  /** The app says a batch is whole: {name, files, person, note} — its files become sorting tasks (the note told in them). */
  const batchDone = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, id: string) => {
    const reply = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(code === 503 ? { "Retry-After": "30" } : {}) }).end(JSON.stringify(body));
    };
    if (!origin) return reply(403, refusal("only the Strom app may close a batch", "app.only"));
    if (!BATCH_ID.test(id) || !readBatch(root, id)) {
      req.resume();
      return reply(404, { ...refusal(`no batch ${id.slice(0, 64)} here`, "batch.none", { batch: id.slice(0, 64) }), batch: id });
    }
    let body = "";
    req.on("data", (c: Buffer) => {
      if (body.length < 8192) body += c.toString("utf8");
    });
    req.on("end", () => safely(req, res, () => {
      let said: { name?: unknown; files?: unknown; person?: unknown; note?: unknown } = {};
      try {
        said = body.trim() ? (JSON.parse(body) as typeof said) : {};
      } catch {
        return reply(400, { ...refusal("the body: JSON {name, files, person}", "batch.bad-body"), batch: id });
      }
      const persons = (Array.isArray(said.person) ? said.person : said.person ? [said.person] : []).map((p) => String(p).trim().toUpperCase()).filter((p) => /^P\d{1,9}$/.test(p));
      const extra = [
        ...(typeof said.name === "string" && said.name.trim() ? [`--name=${said.name.trim().slice(0, 120)}`] : []),
        ...persons.flatMap((p) => ["--person", p]),
        ...(Number.isInteger(said.files) && (said.files as number) > 0 ? ["--expected", String(said.files)] : []),
        ...(typeof said.note === "string" && said.note.trim() ? [`--note=${said.note.trim().slice(0, 500)}`] : []),
      ];
      closeBatchNow(id, extra, reply);
    }));
  };

  /**
   * A decision of the person in the app (POST /conflict/<X…>; one route of each kind — a hypothesis's later shares
   * this): checked here, then written by a strom of its own as the user's (forApp: the command the terminal runs, its
   * lock, its log and commit), one at a time and never while a send or an adoption is written — then busy (503 +
   * Retry-After, research.busy: what the bridge says of an original or a batch the research cannot take now). Every
   * kind answers alike: 200 {decided, head, written, …}; its refusals by their codes (`<kind>.none` 404, `<kind>.decided`
   * 409, …), the research a newer strom wrote 423 `locked`, not from the app's pages 403 `app.only`.
   */
  let deciding: string | undefined;
  const DECIDE_RETRY_S = 5;
  interface Decision {
    /** What the body asks, checked against the record as it is now: the command to run, else the refusal. */
    ask(tree: Tree, rec: AnyRecord, body: Record<string, unknown>): { args: string[] } | { code: number; body: Record<string, unknown> };
    /** The answer once written (the command's --json data, the research's head after it). */
    done(tree: Tree, id: string, data: Record<string, unknown>, head: string): Record<string, unknown>;
    /** The command's refusal (its --json code) as the app is told it; none: 500 decide.failed. */
    refused(tree: Tree, id: string, code: string, why: string): { code: number; body: Record<string, unknown> } | undefined;
  }
  const decideFor = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, kind: "conflict", raw: string, how: Decision) => {
    const reply = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(code === 503 ? { "Retry-After": String(body.retry ?? DECIDE_RETRY_S) } : {}) }).end(JSON.stringify(body));
    };
    if (!origin) {
      req.resume();
      return reply(403, refusal("only the Strom app may decide here", "app.only"));
    }
    let text = "";
    let over = false;
    req.on("data", (c: Buffer) => {
      if (text.length + c.length > 8192) over = true;
      else text += c.toString("utf8");
    });
    req.on("end", () => safely(req, res, () => {
      // a research a newer strom wrote: never opened, never written (as /status says it: locked)
      const newer = newerTree(root, env);
      if (newer) return reply(423, { ...refusal(newer.message, "locked"), reasonCode: newer.code, ...(newer.params ? { reasonParams: newer.params } : {}) });
      let body: Record<string, unknown> = {};
      try {
        const parsed: unknown = text.trim() ? JSON.parse(text) : {};
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
        body = parsed as Record<string, unknown>;
      } catch {
        over = true;
      }
      if (over || body.do !== "decide") return reply(400, refusal(`the body: JSON {"do": "decide", …}`, "decide.bad-body"));
      const id = /^[A-Za-z]\d{1,9}$/.test(raw) ? normId(raw) : "";
      const tree = Tree.open(root, env);
      const rec = id && typeOfId(id) === kind ? tree.get<AnyRecord>(id) : undefined;
      if (!rec || rec.type !== kind) return reply(404, refusal(`no ${kind} ${raw.slice(0, 32)} in this research`, `${kind}.none`, { id: raw.slice(0, 32) }));
      const asked = how.ask(tree, rec, body);
      if ("code" in asked) return reply(asked.code, asked.body);
      // a send or an adoption being written, another decision: asked again in a moment
      if (writing || adopting || deciding) return reply(503, { ...refusal("the research is busy — ask again in a moment", "research.busy"), retry: DECIDE_RETRY_S });
      deciding = id;
      const { command, args } = stromLauncher();
      const child = spawn(command, [...args, ...asked.args, "--json"], { cwd: root, env: forApp(env, root), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      track(child);
      let out = "";
      let err = "";
      child.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
      child.stderr.on("data", (d: Buffer) => (err += d.toString("utf8")));
      child.on("error", (e) => {
        deciding = undefined;
        reply(500, refusal(errorText(e), "decide.failed"));
      });
      child.on("close", (code) => {
        deciding = undefined;
        if (code === null) return;
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(out) as Record<string, unknown>;
        } catch {
          // said by the exit code
        }
        const now = Tree.open(root, env);
        if (code === 0) return reply(200, how.done(now, id, data, head(root)));
        const why = String(data.message ?? err.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? `exit ${code}`);
        noteLive(root, `${id} was not decided (exit ${code}): ${why}`);
        // the research busy (another strom holding it longer than a writer waits)
        if (code === EXIT.locked) return reply(503, { ...refusal(why, "research.busy"), retry: DECIDE_RETRY_S });
        const known = typeof data.code === "string" ? how.refused(now, id, data.code, why) : undefined;
        reply(known?.code ?? 500, known?.body ?? { ...refusal(why, "decide.failed"), ...(typeof data.code === "string" ? { reasonCode: data.code } : {}) });
      });
    }));
  };

  /** Whose a conflict is, as the app finds it: its person (a couple's: its first partner) and its family. */
  const conflictOwners = (tree: Tree, c: Conflict): { person?: string; family?: string } => {
    const person = c.subject.find((s) => s.startsWith("P"));
    const family = c.subject.find((s) => s.startsWith("F"));
    const partner = person ?? (family ? tree.get<Family>(family)?.partners[0] : undefined);
    return { ...(partner ? { person: partner } : {}), ...(family ? { family } : {}) };
  };
  /** A conflict decided already: what was decided, which side, when and by whom. */
  const decidedAnswer = (c: Conflict) => ({
    ...refusal(`${c.id} is decided already: ${c.resolution ?? ""}`, "conflict.decided", { id: c.id }),
    resolution: c.resolution ?? "",
    ...(c.taken ? { take: c.taken } : {}),
    ...(c.decidedAt ? { at: c.decidedAt } : {}),
    ...(c.decidedBy ? { by: c.decidedBy } : {}),
    ...(c.decidedIn ? { in: c.decidedIn } : {}),
  });
  /** POST /conflict/<X…> {"do": "decide", "take": "user" | "research", "note"?}: strom conflict resolve --take, the user's. */
  const conflictDecision: Decision = {
    ask(tree, rec, body) {
      const c = rec as Conflict;
      if (c.state !== "open") return { code: 409, body: decidedAnswer(c) };
      if (!sidesOf(c)) return { code: 422, body: refusal(`${c.id} is no conflict of an edit in the Strom app the app decides by side`, "conflict.no-edit", { id: c.id }) };
      if (body.take !== "user" && body.take !== "research") return { code: 400, body: refusal(`"take" is "user" or "research"`, "conflict.bad-take") };
      if (body.note !== undefined && typeof body.note !== "string") return { code: 400, body: refusal(`"note" is text`, "decide.bad-body") };
      // the person's note: one line of text, 200 characters at most (the rest cut)
      const note = [...String(body.note ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim()].slice(0, 200).join("").trim();
      const decided = phrase(tree.lang, "conflict.app.decided");
      const reasoning = note ? phrase(tree.lang, "conflict.app.noted", { decided, note }) : decided;
      return { args: ["conflict", "resolve", c.id, `--take=${body.take}`, `--reasoning=${reasoning}`] };
    },
    done(tree, id, data) {
      const c = tree.get<Conflict>(id)!;
      return {
        decided: id,
        take: c.taken ?? data.taken,
        head: head(root),
        written: typeof data.written === "string" ? data.written : `${id} decided: the research's value kept`,
        ...conflictOwners(tree, c),
      };
    },
    refused(tree, id, code, why) {
      const c = tree.get<Conflict>(id);
      if (c && ["conflict.decided", "conflict.taken", "conflict.user-decided"].includes(code)) return { code: 409, body: decidedAnswer(c) };
      if (code === "conflict.no-edit") return { code: 422, body: refusal(why, "conflict.no-edit", { id }) };
      return undefined;
    },
  };

  /** The app sends nothing (unchanged, the user said no, no tree of this research): strom sync --app stops waiting. */
  const nothing = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined) => {
    const reply = (code: number, body: Record<string, unknown>) =>
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    if (!origin) {
      reply(403, { error: "only the Strom app may say so" });
      return;
    }
    let body = "";
    req.on("data", (c: Buffer) => {
      if (body.length < 4096) body += c.toString("utf8");
    });
    req.on("end", () => safely(req, res, () => {
      let reason = "cancelled";
      try {
        reason = String((JSON.parse(body) as { reason?: unknown }).reason ?? reason);
      } catch {
        reason = body.trim() || reason;
      }
      reply(200, { ok: true, reason: noteNothingSent(root, reason) });
    }));
  };

  // What breaks where nobody catches it is written down; the bridge only reads, so it goes on.
  process.on("uncaughtException", (e) => noteLive(root, `uncaught: ${errorText(e)}`));
  process.on("unhandledRejection", (e) => noteLive(root, `unhandled: ${errorText(e)}`));

  return new Promise((resolve) => {
    let up = false;
    let wanted = last?.port ?? 0;
    let tries = 0;
    server.on("error", (e: NodeJS.ErrnoException) => {
      if (!up && wanted && e.code === "EADDRINUSE") {
        // the bridge before this one still holds it (stuck, or ending just now): ended, its port taken again — the
        // app following the address goes on; a port another program holds: another one (the app needs ?live= again)
        const before = last && last.pid !== process.pid ? last.pid : undefined;
        const ended = before && tries === 0 ? endBridge(before, root) : "gone";
        if (ended === "elsewhere") {
          // a bridge of another folder (its note copied with the research): never ended, never its address — a new one
          noteLive(root, `a bridge of another folder (${before}) holds port ${wanted}: not ended`);
          token = crypto.randomBytes(16).toString("hex");
          tries = 20;
        } else if (ended !== "gone") {
          noteLive(root, `the bridge before (${before}) still held port ${wanted}: ended`);
          tries = 1;
        }
        if (tries > 0 && tries++ < 20) {
          setTimeout(() => server.listen(wanted, "127.0.0.1"), 250);
          return;
        }
        noteLive(root, `port ${wanted} is taken: another one — the Strom app needs the new address (strom app --live)`);
        wanted = 0;
        server.listen(0, "127.0.0.1");
        return;
      }
      noteLive(root, `the server: ${errorText(e)}`);
      if (!up) resolve();
    });
    server.listen(wanted, "127.0.0.1");
    server.once("listening", () => {
      up = true;
      const port = (server.address() as { port: number }).port;
      live = { port, token, pid: process.pid, url: `http://127.0.0.1:${port}/${token}`, started: new Date().toISOString(), version: VERSION };
      writeLive(root, live);
      writeLast(root, { port, token, pid: process.pid, started: live.started });
      const how = !last ? "a new address" : last.port === port ? (last.token ? "the address of the last bridge" : "the port of the last bridge, a new secret (it was ended for good)") : last.token ? "the token of the last bridge, another port" : "a new address";
      noteLive(root, `started: strom ${VERSION}, port ${port}, ${how}`);

      // A read that fails (another strom writing that moment) is tried again at the next tick; written down once.
      let trouble: { text: string; times: number } | undefined;
      const safe = <T>(what: string, fn: () => T): T | undefined => {
        try {
          const got = fn();
          if (trouble) noteLive(root, `works again (${trouble.times}× failed)`);
          trouble = undefined;
          return got;
        } catch (e) {
          const text = errorText(e);
          if (trouble?.text === text) trouble.times++;
          else {
            trouble = { text, times: 1 };
            noteLive(root, `${what} failed (tried again): ${text}`);
          }
          return undefined;
        }
      };

      // What changed: strom commits every change, so a new commit is news.
      let seen = safe("the start", () => head(root)) ?? "";
      // what the last 24 hours added, worked out before the app asks (/status never waits for it)
      if (seen) recentNow(root, env, seen);
      // who is at work changes only with the workers present (.strom/workers: who, since, paused, alive) or a commit:
      // worked out again only then — nobody at work, nothing to read
      let atWorkKey: string | undefined;
      let atWorkNow: ReturnType<typeof working> = [];
      const atWork = (h: string) => {
        const present = liveWorkers(root);
        const key = `${h}\n${JSON.stringify(present)}`;
        if (key !== atWorkKey) {
          if (!present.length) atWorkNow = [];
          else {
            const tree = Tree.open(root, env);
            atWorkNow = working(root, tree, scopes(tree));
          }
          atWorkKey = key;
        }
        return atWorkNow;
      };
      let workers = safe("the start", () => JSON.stringify(atWork(seen))) ?? "";
      const send = (event: string, data: unknown) => {
        for (const s of streams) s.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      // sends left waiting when the bridge before ended (written at once): written now, one after another
      setTimeout(() => {
        try {
          writeNext();
        } catch (e) {
          noteLive(root, `the sends that wait were not written: ${errorText(e)}`);
        }
      }, 500).unref?.();
      // A newer strom on disk (an update, the installer run again, npm): the bridge starts again with it — at its port
      // with its token (the app goes on by itself), only once the new one starts, only while nothing is written; a new
      // one that does not start: this one goes on, said in the log (Milan's wish, 2026-10-03). Run from the sources:
      // never (each edit would count).
      const RENEW_MS = Number(env.STROM_LIVE_RENEW_MS ?? 60_000);
      const runs = env.STROM_LIVE_RENEWED ?? VERSION;
      let renewChecked = Date.now();
      let tried: string | undefined;
      let renewing = false;
      const busy = () => writing !== undefined || adopting || kids.size > 0 || retryAt !== undefined;
      const renew = (disk: { version: string; probe?: "fail" }) => {
        renewing = true;
        tried = disk.version;
        const { command, args } = stromLauncher();
        const probe = spawnSync(command, disk.probe === "fail" ? ["-e", "process.exit(7)"] : [...args, "--version"], { env: env as NodeJS.ProcessEnv, encoding: "utf8", timeout: 60_000, windowsHide: true });
        if (probe.status !== 0) {
          renewing = false;
          return noteLive(root, `strom ${disk.version} is on disk but does not start (exit ${probe.status ?? probe.signal ?? "?"}${probe.stderr ? `: ${String(probe.stderr).trim().split("\n").pop()?.slice(0, 200)}` : ""}): this bridge (${runs}) goes on`);
        }
        noteLive(root, `strom ${disk.version} on disk: the bridge starts again with it (port ${port}, its token kept)`);
        for (const st of streams) st.end();
        streams.clear();
        server.close();
        server.closeAllConnections?.();
        const back = (why: string) => {
          noteLive(root, `the bridge of strom ${disk.version} did not take over (${why}): this one (${runs}) goes on`);
          server.listen(port, "127.0.0.1", () => {
            renewing = false;
            try {
              if (live) writeLive(root, live);
              writeLast(root, { port, token, pid: process.pid, started: live?.started ?? new Date().toISOString() });
            } catch {
              // its research gone meanwhile: the next tick ends it
            }
          });
        };
        setTimeout(() => {
          let child: ChildProcess;
          try {
            child = spawnBridge(root, env, { STROM_LIVE_RENEWED: disk.version });
          } catch (e) {
            return back(errorText(e));
          }
          const until = Date.now() + Number(env.STROM_LIVE_RENEW_WAIT_MS ?? 30_000);
          const look = () => {
            fetch(`http://127.0.0.1:${port}/${token}/status?poll=1`, { headers: { Origin: STATUS_PROBE_ORIGIN } })
              .then((r) => (r.ok ? (r.json() as Promise<{ strom?: string }>) : undefined))
              .catch(() => undefined)
              .then((got) => {
                let mine: LiveInfo | undefined;
                try {
                  mine = JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as LiveInfo;
                } catch {
                  // not written yet
                }
                if (got?.strom && mine?.pid === child.pid) {
                  noteLive(root, `handed over to the bridge of strom ${disk.version} (${child.pid})`);
                  clearInterval(timer);
                  clearInterval(keepAlive);
                  return resolve();
                }
                if (Date.now() < until && child.exitCode === null) return void setTimeout(look, 250);
                try {
                  if (child.exitCode === null) child.kill("SIGKILL");
                } catch {
                  // gone
                }
                back(child.exitCode !== null ? `it ended at once (exit ${child.exitCode})` : "it did not answer in time");
              });
          };
          look();
        }, 100);
      };
      let batchesChecked = 0;
      // the first a few minutes after it starts, then once a day
      let tidied = Date.now() - Number(env.STROM_TIDY_MS ?? 24 * 3600_000) + 5 * 60_000;
      const timer = setInterval(() => {
        // its research gone (taken off the computer, a test's folder): nothing to follow — even while handing over
        // (found: bridges of a folder removed in the middle of it left running for hours)
        if (!fs.existsSync(path.join(root, "strom.json"))) return stop("the research is no longer there");
        if (renewing) return;
        if (Date.now() - renewChecked > RENEW_MS) {
          renewChecked = Date.now();
          const disk = diskVersion(env);
          if (disk && disk.version !== runs && disk.version !== tried && !busy()) return renew(disk);
        }
        // a batch nobody said is whole: closed a day after its last file (looked at once a minute)
        if (Date.now() - batchesChecked > Number(env.STROM_BATCH_CHECK_MS ?? 60_000)) {
          batchesChecked = Date.now();
          let idle: string[] = [];
          try {
            idle = idleBatches(root);
          } catch (e) {
            noteLive(root, `the batches could not be looked at: ${errorText(e)}`);
          }
          for (const id of idle) closeBatchNow(id, ["--idle"], () => noteLive(root, `the batch ${id} closed: no file came for a day`));
        }
        // what strom keeps beside the research in order, once a day (a tree tidied once; never while a send is written)
        if (Date.now() - tidied > Number(env.STROM_TIDY_MS ?? 24 * 3600_000) && !busy()) {
          tidied = Date.now();
          safe("keeping order", () => autoTidy(Tree.open(root, env)));
        }
        if (streams.size) lastAsked = Date.now();
        if (Date.now() - lastAsked > idleMs) return stop("idle: nobody asked for a while");
        // its research gone (taken off the computer, a test's folder): nothing to follow
        if (!fs.existsSync(path.join(root, "strom.json"))) return stop("the research is no longer there");
        if (!streams.size) return;
        safe("a tick", () => {
          const { head: h, at } = tip(root);
          if (h && h !== seen) {
            // when the commit was made: the same as in /log, so the app knows it has it; each new commit as /log gives it (its task)
            const entries = histories.since(Tree.open(root, env), seen ? [`-n${LOG_MAX}`, `${seen}..${h}`] : ["-1", h]);
            send("change", { head: h, what: subjects(root, seen, h), at: at ?? new Date().toISOString(), entries });
            seen = h;
          }
          const now = atWork(h);
          const w = JSON.stringify(now);
          if (w !== workers) {
            workers = w;
            send("working", now);
          }
        });
      }, pollMs);
      const keepAlive = setInterval(() => {
        for (const s of streams) s.write(": still here\n\n");
      }, 20_000);
      const stop = (why: string) => {
        clearInterval(timer);
        clearInterval(keepAlive);
        for (const s of streams) s.end();
        server.close();
        try {
          const now = JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as LiveInfo;
          if (now.pid === process.pid) fs.rmSync(liveFile(root), { force: true });
        } catch {
          // gone already
        }
        const was = readLast(root);
        if (was?.pid === process.pid && !was.ended) writeLast(root, { ...was, ended: { at: new Date().toISOString(), reason: why } });
        noteLive(root, `ended: ${why}`);
        resolve();
      };
      process.once("SIGTERM", () => stop("SIGTERM"));
      process.once("SIGINT", () => stop("SIGINT"));
    });
  });
}
