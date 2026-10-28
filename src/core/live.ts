// The live bridge: the Strom app follows a research while it goes on. strom
// runs a small web server on this computer only (127.0.0.1, a random port, a
// secret token in every address) that only reads: the app, opened with
// ?live=<address>, takes the tree's GEDCOM from it and hears what changes —
// who is at work on what, what was recorded, what waits for the user. Nothing
// leaves the computer. The bridge ends by itself when nobody has asked it
// anything for a while (LIVE_IDLE_MS) and nobody works in the tree, or with
// strom live stop.
//
//   GET <token>/status     the tree, its researches, who is at work, what waits; what the research takes from
//                          the app (accepts). ?poll=1: the app asking now and then — the bridge's idle time goes on
//   GET <token>/tree.ged   the tree for the Strom app, as it is now, each entry with its image (the settings excerpts.*)
//   GET <token>/images.ged the same (the address an older strom gave)
//   GET <token>/log        what the research saved, newest first (each commit: when, what, for which task;
//                          text: its lines as the user reads them, kinds: what each is about, sources: the S… each
//                          names — only when one does)
//   GET <token>/whats-new  what is new in this strom (?lang=cs|en|de, else en): {version, lang, url, points} — the
//                          running version's section of the changelog shipped with it; asking keeps no bridge running
//   GET <token>/recent     what the research added in the last hours (?hours=1…168, 24 when not given): the people and
//                          sources added, the commits — the same as /status recent (core/recent.ts)
//   GET <token>/events     server-sent events: hello, change, working, history; end before the bridge ends ({reason: stopped |
//                          restart | idle | gone | signal, back: another bridge at this address at once — absent: not
//                          known, at}): strom live stop asks it through .strom/live-stop.json, the same on every system
//   POST <token>/sync      the Strom app sends the user's edited tree back (?send=, or on its own): kept in the
//                          inbox to be shown and written on the user's word (strom sync) — nothing of the
//                          research changes; /status says what waits there (inbox) and how each send went (sends)
//   POST <token>/cancel    …or says it sends nothing ({"reason": "unchanged" | "cancelled" | "no-tree"})
//   GET <token>/media/<sha256>   whether the research has a file of that content (an original the app would send);
//                          ?file=1: the file itself (the original, for the app's viewer)
//   GET <token>/excerpt/<S…>   a source's excerpts the file left out (_STROM_IMG_OMITTED), as the file would carry
//                          them (?clip=<mark> one, ?level=sharp|normal|small|smaller, another the research's): JPEGs as data URLs with where
//                          each is; what takes long is made over several asks (202 {later}, asked again)
//   GET <token>/excerpts?missing=1   what the file left out that the app could load: each source, its marks, about how
//                          large (nothing made to say it)
//   GET <token>/material   the family's files the research keeps (core/material.ts), ?person=P… / ?batch=<id>,
//                          ?files=0 (the batches only); each file's title, kind, date, hidden (hidden ones stay listed),
//                          `people`: the names of the people it names
//   POST <token>/material/assign   the people files are of ({files: [I…] | batch, add: [P…], remove: [P…]}): strom
//                          input assign, all or nothing; {files, people, kept, head}
//   POST <token>/material/hide     files hidden or shown again ({files: [I…], hidden: true|false, reason: unrelated |
//                          duplicate}): strom input hide | unskip; {files, people, head}. Both refused 400 material.body,
//                          404 material.file|person|batch, 403 material.readonly, 409 material.busy (+ Retry-After).
//                          Every write of the app's (these, PUT /media, /batch/<id>/done, /waiting, /group) answers
//                          `head` after it and `parent`, the head just before it (nothing written: parent = head) —
//                          the app takes head as its version only when parent is the head it knew
//   GET <token>/media/<sha256>?thumb=128|256|512   a small JPEG preview of a file (core/thumbs.ts, kept in
//                          .strom/thumbs): 400 thumb.size, 404, 410 media.gone, 415 thumb.type (none of this kind here)
//   PUT <token>/media/<sha256>   an original from the app, unchanged (the body; X-Strom-Name, -Person, -Source,
//                          -Region, -Note): streamed to disk, its hash checked, kept outside git
//                          (strom media original) — of a source an image, else material of people with an intake task;
//                          X-Strom-Batch, -Path (and -Zip: 1, a ZIP unpacked here): one file of a batch
//                          X-Strom-Task: T… — a file for what a waiting task waits for: an input of its people
//                          handed to it, the task back in the queue (strom media original --task)
//   POST <token>/batch/<id>/done   the batch is whole ({name, files, person, note}): its files become sorting tasks
//                          (a batch nobody closes is closed a day after its last file)
//   POST <token>/waiting/<T…>   a request of a waiting task sent ({"do": "sent" | "unsent"}): strom task sent [--undo],
//                          the user's — a fact the person gives, never an answer or a decision; the task still waits
//   POST <token>/group/<key>    the same for one place of What waits ({"do": "sent"}: each of its requests still to be
//                          sent; {"do": "unsent", "tasks": [T…]}: only those, when they are of it and sent)
//   GET <token>/group/<key>/note   the request texts of that place's tasks joined for one e-mail ({text, notes, tasks})
//   POST <token>/conflict/<X…>   refused (403 decide.link): a conflict is the person's to decide in the terminal, through
//                          the link conflict&do=decide — the bridge cannot tell the app from an agent on this computer
//   GET <token>/adopt      a new research waits for a tree of the app: its mark, name, until when; transfer: true when
//                          the tree comes from a browser the app cannot reach strom from; existing: true when it goes
//                          into a research made before, its tree never came (POST /adopt hands it over)
//   GET <token>/transfer   that tree's file as it came (strom-prenos-….json), only while the research waits for it
//   POST <token>/read      a document read at once ({files: [sha256], readers, lang, person, note, region}; its files sent
//                          first: PUT /media with X-Strom-Read: 1): queued, read one at a time (live-read.ts) — 202
//                          {read: D…}; /status reads and the event read follow it; never in an archive
//   GET <token>/read/<D…>  its result (what its readers wrote so far too); /read/<D…>/page/<n>.jpg each page's picture
//   POST <token>/read/<D…>/again {readers}, /read/<D…>/cancel; GET <token>/reads — the readings of the last 90 days
//   GET <token>/history    what the ancestors lived through (the experiment experiments.history, core/pastevents.ts):
//                          the events at the places of the tree's facts, the places with their state, what the person
//                          hid, the state of the search and its rev (an archive's too; what was found stays while off);
//                          at most 3000 events and 5000 places (those with events first): state.truncated; the regions
//                          of the tree's places (never limited): state, order, weight, events, hidden, gaps and fill;
//                          each place's regions, people, why, manual, redo + note, skip, its record (feature history.regions)
//   POST <token>/history/hide   an event hidden at a place, a person or in the whole tree ({event, place} | {event,
//                          person} | {event, tree: true}), or everything of a region ({region}); "do": "show" shows it
//                          again: strom history hide|show, the person's; {hidden, head, parent} — refused 400
//                          history.body, 404 history.event|history.person|history.region, 503 research.busy (+
//                          Retry-After); an archive's too (features history.hide, history.hide.all)
//   POST <token>/history/skip   {region} | {place}, "do": "undo" to look for it again: no history of a region or at a
//                          place in this research (strom history skip|unskip, the person's) — {skip: {regions, places},
//                          head, parent}; refused 400 history.body, 404 history.region|history.place, 503 research.busy
//                          (feature history.skip)
//   POST <token>/history/delete {event}, "do": "restore" to bring it back: an event deleted by the person (strom history
//                          delete|restore) — a region's from every tree on this computer, a local one from this tree;
//                          never written again by the research until restored. {event, scope, deleted, head, parent};
//                          GET /history `deleted` lists them with what their row needs. Refused 400 history.body, 404
//                          history.event, 409 history.retracted, 503 research.busy (features history.delete, history.delete.restore)
//   POST <token>/history/map    a place's regions as the person knows them ({place, regions: [{id, from?, to?}]}), the
//                          place determined again ({place, redo: true, note?}: at most 200 characters after NFC) or back
//                          to the research ({place, do: "auto"}): strom history assign, the person's; the research never
//                          maps a place so assigned — {place, map, head, parent}; refused 400 history.body, 404
//                          history.region|history.place, 503 research.busy (feature history.map)
//   POST <token>/history/first  {region}: that region's history first of the regions (the app's person card: its places'
//                          region with no catalog yet) — strom history first, the person's; still at history's next turn
//                          (the pace). {region, task?, first: [{region, at}]}; refused only while the history is on: 409
//                          history.off (+ link: turning it on is the person's, in the terminal), 409 history.archive |
//                          history.done | history.skipped, 404 history.region (no place of the tree in it yet), 400 history.body,
//                          503 research.busy
//   POST <token>/history/place  {place: "L…"}: the history of a place and its surroundings — never started here (it
//                          spends a session): always 403 history.link with the link strom-research://history?tree=…&place=
//                          L…&do=search (the estimate and the person's yes in the terminal; the task on top of the queue)
//                          and the estimate; refused 400 history.body, 404 history.place, 409 history.off (+ link) |
//                          history.archive (feature history.place). /status history.placeEstimate {minutes, usd?: three
//                          measured sessions}, history.placesAuto (read only); GET /history places[x].history|at|why|area,
//                          events scope "place" with place {key, id?, name}, suggest [L…]
//   POST <token>/stories   {"history": false|true}: the history of the places in the stories of this research
//                          (stories.history in its strom.json; the person's own config stays) — {stories, head, parent};
//                          refused 400 stories.body, 409 history.off (+ link: the history itself is turned on by the
//                          person, in the terminal), 503 research.busy (feature stories.history). /status: stories.history
//                          (on while the history is on, unless turned off); an approved story is never rewritten for it
//   POST <token>/experiments   {"history": false} | {"historyPlaces": false}: the experiment (or each place's history
//                          by itself) off for this research (its strom.json; the person's
//                          own config stays) — {experiments, head, parent}; true is refused (403
//                          experiments.link with the link strom-research://experiment…&do=on: only a person turns it on,
//                          in the terminal the link opens). /status: experiments.history, experiments.historyPace
//                          (how often: sometimes|rare|idle — read only: the person's own choice, in the terminal, the
//                          setup or the settings; a body with it is refused 400 experiments.body), history.rev; the event
//                          history {rev} when what GET /history answers changed without a new commit
//   GET <token>/surnames   the forms of a surname that are one family's (core/surnames.ts): {rev, groups, rejected,
//                          suggestions, state {truncated, persons, skipped}} — what the research suggests from its
//                          records and what the person decided (quality/surnames.json); read in an archive too, and in
//                          a research waiting for its agent; 503 research.busy (+ Retry-After) while the research is
//                          being written (features surnames.suggest, surnames.read). The person's groups and rejections
//                          come back by strom sync (the Strom file's header notes), never written here
//   POST <token>/duplicates  two people the app shows as a possible duplicate, judged by the research (core/duplicates.ts):
//                          {"pairs": [["P…", "P…"], …]} (at most 1000) → {rev, verdicts: [{pair, verdict?, reason,
//                          years?, into?, at?, by?}]} — read only, nothing written; 400 duplicates.body, 503 research.busy
//                          (+ Retry-After) while the research is being written (feature duplicates.judge)
//   POST <token>/quality/dismiss  a finding of the app's validation marked no error by the person ({kind, persons,
//                          subject?}, "do": "undo" to take it back): strom quality dismiss|undo, by "app" → {ok, rev};
//                          400 quality.body, 404 person.no-match {person}, 503 research.busy (feature quality.dismiss)
//   GET <token>/quality    what the person marked no error (quality/dismissed.json): {rev, dismissed}; read in an archive
//                          too (feature quality.read). /status: quality.rev; the event quality {rev} when the file changed
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
// newer strom bringing its bridges back, a start after it ended when idle (a new
// session too, when its secret is kept and the tree is no archive) — it
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
import { notDownloaded } from "./integrity.ts";
import fs from "node:fs";
import os from "node:os";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { configDir, userHome, type Env } from "./paths.ts";
import { newerTree, SEAL_FOREIGN, sealedHere, Tree, TREE_FILE, VERSION, type Op } from "./tree.ts";
import { readJsonIfExists } from "./json.ts";
import { changeLines, type ChangeKind } from "./changelog.ts";
import { directionOf, scopes, type Scope } from "./directions.ts";
import { ancestorGenerations } from "./people.ts";
import { phrase } from "./phrases.ts";
import { exportGedcom } from "../gedcom/export.ts";
import { dataUrl, excerptLevel, excerptMarks, excerptSettings, excerptSizes, INPUT_MARK, LEVELS, planExcerpts, sourceExcerpts, turned, type ExcerptOmitted } from "./excerpt.ts";
import { adoptedAt, adoptedEmpty, adoptionWait, noteAdoptAsked, markSentAgain, undoneSend, undoneSince, failReceived, inboxTrees, markAdopted, noteAdoptFailed, noteNothingSent, pendingAdoption, receiveAdopted, receivedAll, receivedPending, receiveTree, recentSends, stampAppVersion, syncConflicts, SYNC_INBOX, SYNC_MAX_BYTES, namesOf, type Change, type Skipped } from "./sync.ts";
import { isArchive, modeOf, settleArchive } from "./mode.ts";
import { actsAsArchive, kindOf, stateOf } from "./state.ts";
import { raiseHypothesisLinkTasks, settleHypothesisLinks } from "./hypolinks.ts";
import { PROFILES } from "../agents/profiles.ts";
import { ui } from "../cli/ui.ts";
import { DISK_FULL, EXIT, isDiskFull, StromError } from "./errors.ts";
import { acquireLock, liveHolder } from "./lock.ts";
import { checkAsked, material, MATERIAL_MOST_FILES, MATERIAL_MOST_PEOPLE, peopleOf } from "./material.ts";
import { cachedThumb, THUMB_SIZES } from "./thumbs.ts";
import { checkOriginalMeta, cleanIncoming, freeBytes, knownOriginal, materialWaiting, originalMax, ORIGINAL_RESERVE, ORIGINAL_TYPES, parseRegion } from "./originals.ts";
import { BATCH_ID, batchEstimate, batchLimits, batchPath, batchStatus, idleBatches, readBatch } from "./batches.ts";

/** New images for the app, made for at most so long when the tree changed (the rest the next time). */
const LIVE_IMAGES_MS = 20_000;
/** How long the bridge makes the excerpts of one source the app asks for (/excerpt/<S>): the rest the next ask makes. */
const EXCERPT_MS = 20_000;
/** A source with more excerpts than this is answered without the pictures: the app asks for each (?clip=). */
const EXCERPTS_AT_ONCE = 12;
import { anyoneAtWork, liveWorkers, type Paused } from "./workers.ts";
import { widgetWriter } from "./widget.ts";
import { monthSpend, openSessions } from "./session.ts";
import { rankTasks } from "./queue.ts";
import { humanTask } from "../cli/human.ts";
import { knownNewerVersion, updateChannel } from "./update.ts";
import { whatsNew } from "./whatsnew.ts";
import type { SyncInput } from "./sync.ts";
import { gitProgram, runGit } from "./git.ts";
import { RECENT_HOURS, recentChanges, recentNow, type Recent } from "./recent.ts";
import { appKnowsArchive, appKnowsNoCouple, appShowsHypothesisLinks, appShowsOmittedImages, appShowsReadings, appDecidesConflicts, appOpensLinks, appReadsTitles, appShowsCoupleEvents, appShowsEdges, appShowsFactStatus, appShowsSourceReads, appShowsStoryDrafts, appTurnsExcerpts, appReadsSurnameGroups, appUrlSetting, isAppVersion, isStromAppOrigin, stromAppState } from "./stromapp.ts";
import { suggestSurnames, surnamesForExport } from "./surnames.ts";
import { judgePairs, pairsOf, PAIRS_MAX } from "./duplicates.ts";
import { askOf, qualityRev, readDismissed } from "./quality.ts";
import { Settings } from "./config.ts";
import { LINK_SCHEME, linkActions, linkHandlerState, linkHandlerStateLater, linkScheme, linkText, type HandlerState } from "./links.ts";
import { autoTidy } from "./tidy.ts";
import { askPhoneOn, endPhoneLater, pairCode, pairUrl, phoneConfig, phoneProbe, phoneRunning, phoneState, phoneSummary, removePhone, restorePhone, revivePhone, stopPhone, type PairedPhone } from "./phone.ts";
import { qrSvg } from "./qr.ts";
import { diskVersion, stromLauncher } from "./self.ts";
import { closeBatchBy, committed, diskFullSaid, forApp, fullWhere, langOf, receiveOriginal, refusal, refusalOf, type Receiver } from "./receive.ts";
import { HIDE_REASONS, type Input, type Media, type Session, type Source, type Task, type TreeConfig } from "./model.ts";
import { normId } from "./records.ts";
import { requestTexts, waitingFor } from "./waiting.ts";
import { fileRefused } from "./taskfiles.ts";
import { SENDABLE, waitKindOf, waitPhaseOf, type WaitKind } from "./waitkind.ts";
import { agentsHere } from "./apps.ts";
import { counted } from "../cli/format.ts";
import { AppReadings, appReadSpend, readAccepts, statusReads, type ReadingsSeen } from "./live-read.ts";
import { checkNote, historyAnswer, historyOn, historyRev, MAX_EVENTS, MAX_PLACES } from "./pastevents.ts";
import { placeEstimate, placeRecord } from "./placehistory.ts";

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
  "ui.seal.bridge": SEAL_FOREIGN,
  "ui.error.tree.not-downloaded": "tree.not-downloaded",
  "ui.experiments.link": "experiments.link",
  "ui.history.place.link": "history.link",
} as const;
/** What the app sends that the research writes (the routes after the secret): refused while it is sealed elsewhere. */
/** A region's ID as the app sends it (core/pastevents.ts regionIdOk). */
const REGION_ID = /^[a-z0-9][a-z0-9-]{0,23}$/u;

/** A place as the app sends it: one line of text, at most 300 characters. */
function placeOk(v: unknown): v is string {
  return typeof v === "string" && !!v.trim() && v.length <= 300 && !/[\u0000-\u001f\u007f]/u.test(v);
}

const APP_WRITES = new Set(["sync", "adopt", "media", "batch", "waiting", "group", "material", "read", "history", "experiments", "quality"]);
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

/*
 * The refusals (receive.ts refusal()). An upload of the app refused (PUT /media/<sha256>, a batch's file, POST
 * /batch/<id>/done, GET /media/<sha256>): the English sentence (`error`, `text`) and its stable `code` with `params` for the app to say it in the person's
 * language (feature `media.codes`). Each code, its answer and its params:
 * - `app.only` 403 — not from the Strom app's pages
 * - `media.bad-sha` 400 — the address names no SHA-256
 * - `media.bad-header` 400 {header} — a header that is not what it should be (X-Strom-Person, -Source, -Batch, -Zip,
 *   -Path, -Name, -Note, -Task)
 * - `media.bad-region` 400 {region} — X-Strom-Region is no part of an image
 * - `media.no-person` 404 {person} — no such person in the research; `media.no-source` 404 {source} — no such source
 * - `media.no-shared` 500 — the research has no shared folder for files (strom setup)
 * - `media.large` 413 {mb} (and `max`) — larger than the research takes; `media.full` 507 (and `free`) — no room
 *   (these two: `error` in the research's language, `text` English — said() above)
 * - `disk.full` 507 {where} — no room left on the disk as a write met it (any write of the app: a send, an adoption, an
 *   original, a batch, the material, a waiting task): `error` in the research's language, `text` English, `where` the
 *   folder (feature `disk.full`); nothing was lost
 * - `tree.not-downloaded` 409 {n, first} — files of the research not downloaded from iCloud yet (only their placeholder
 *   here): nothing written until they are (/status `notDownloaded`, feature `tree.notDownloaded`)
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
 * - `waiting.none` 409 {id} — X-Strom-Task: the task waits no more; `waiting.no-file` 409 {id} — it waits for the
 *   person's check of a site or decision about an archive (the app offers the inbox folder then)
 *
 * A request marked sent (POST /waiting/<T…>, /group/<key>): 200 {sent | unsent: [the tasks it marked], head, task?,
 * phase?, group?}, else
 * - `app.only` 403; `waiting.bad-body` 400 — no JSON {"do": "sent" | "unsent"} (a group's unsent: with its "tasks")
 * - `waiting.none` 404 {id} — no task that waits; `group.none` 404 {group} — nothing waits at that place (also GET
 *   /group/<key>/note); `waiting.not-sendable` 409 {id, kind} — it waits for no request to send
 * - `research.busy` 503 (and Retry-After, `retry`); `locked` 423; `waiting.failed` 500
 *
 * A decision of a conflict (POST /conflict/<X…>): always `decide.link` 403 {id}, nothing read or written — the person
 * decides it in the terminal, through the link conflict&do=decide (the bridge cannot tell the app from an agent here).
 *
 * A document to read (POST /read, /read/<D…>/again, /read/<D…>/cancel; GET /read/<D…>, its pages, /reads — live-read.ts):
 * - `app.only` 403; `locked` 423; `read.none` 404 {id} — an archive, a research waiting for its agent, no reading of the
 *   app of that id; `read.not-ready` 503 {why} (and `resets`) — accepts.read.why
 * - `read.bad-body` 400; `read.lang` 400 {lang}; `read.region` 400; `read.no-person` 404 {person}
 * - `read.no-file` 404 / 410 {sha} — no such file in the research / not on this computer; `read.type` 415 {sha, mime};
 *   `read.large` 413 {sha, mb}; `read.pages` 413 {pages}
 * - `read.limit` 429 {per: queue | hour | day, most} (and Retry-After, `retry`); `read.busy` 409 {id} — again while read
 * - `read.no-page` 404, `read.page-gone` 410 {id, page}; `research.busy` 503 (`retry`); `read.failed` 500
 */
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
 * Where a process runs (its working folder): a bridge runs in its tree's folder (on Windows a newer one in the settings'
 * folder, never asked there). Undefined where it cannot be asked (Windows; lsof missing) — then a process is taken for
 * what its note says, as before.
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

/**
 * A bridge running in another tree's folder than this one's (an older strom's, whose note names no folder) — never
 * ended for this tree. Its folder, else undefined. A folder of no tree (a bridge run elsewhere) is not another tree's.
 */
function bridgeElsewhere(pid: number, root: string): string | undefined {
  const cwd = processCwd(pid);
  return cwd && sameFolder(cwd, realRoot(root)) === false && fs.existsSync(path.join(cwd, "strom.json")) ? cwd : undefined;
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
    // left where the person moved the research from) — nor its .strom, deleted by hand (it is made by what starts a
    // bridge: its lock, its log's folder)
    if (!fs.existsSync(path.join(root, "strom.json"))) return;
    const file = liveLogFile(root);
    if (!fs.existsSync(path.dirname(file))) return;
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

/** A folder as the system knows it (its disk and number): another folder made under the same name is another one. */
function folderId(dir: string): string | undefined {
  try {
    const st = fs.statSync(dir, { bigint: true });
    return st.isDirectory() ? `${st.dev}:${st.ino}` : undefined;
  } catch {
    return undefined;
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

/** How little room on the disk of a research means no bridge starts there (its lock, its notes, live.json). */
const BRIDGE_ROOM = 1024 * 1024;

/**
 * Why a bridge did not start (strom live start, strom app --live): no room on the disk of the research — tried by a
 * small file written, as the system may say room it does not give — else the last line its log got since `since`
 * (none: undefined). Never throws.
 */
export function notStartedWhy(root: string, since: number): { full: true } | { full: false; line?: string } {
  const free = freeBytes(root);
  let full = free !== undefined && free < BRIDGE_ROOM;
  if (!full) {
    const probe = path.join(root, ".strom", `.room-${process.pid}`);
    try {
      fs.mkdirSync(path.dirname(probe), { recursive: true });
      fs.writeFileSync(probe, Buffer.alloc(64 * 1024));
    } catch (e) {
      full = isDiskFull(e);
    } finally {
      try {
        fs.rmSync(probe, { force: true });
      } catch {
        // what is left goes with the next tidy
      }
    }
  }
  if (full) return { full: true };
  try {
    const lines = fs.readFileSync(liveLogFile(root), "utf8").split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = /^(\S+) \[\d+\] (.*)$/u.exec(lines[i]!);
      if (!m) continue;
      if (!(Date.parse(m[1]!) >= since - 1000)) break;
      // the first line of what it said (a stack's message, never the stack)
      return { full: false, line: m[2]!.slice(0, 300) };
    }
  } catch {
    // no log: nothing to say
  }
  return { full: false };
}

function startNow(root: string, env: Env, running: LiveInfo | undefined): LiveInfo | undefined {
  if (running) stopLive(root, `a bridge of strom ${VERSION} is wanted (this one: ${running.version ?? "older"})`, { back: true });
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

/**
 * A bridge started on its own (detached). Nothing of it holds the tree's folder, which Windows would then refuse to
 * delete (found on Windows: the folder of a research could not be deleted after the menu closed, its bridge running on
 * for hours): on Windows it runs in the settings' folder, as the phone's server does (the tree is named to it:
 * STROM_TREE; bridgeCwd), and its log is no open file of the process (stderr) — each line opened, appended and closed
 * (noteLive), errors nobody caught too; what Node says when the process cannot even start is what `strom live serve`
 * shows in the foreground.
 */
function spawnBridge(root: string, env: Env, extra: Record<string, string> = {}): ChildProcess {
  const { command, args } = stromLauncher();
  try {
    // its log's folder (a research handed over comes without its .strom)
    fs.mkdirSync(path.dirname(liveLogFile(root)), { recursive: true });
  } catch {
    // without a log
  }
  const child = spawn(command, [...args, "live", "serve"], {
    cwd: bridgeCwd(root, env),
    env: { ...(env as NodeJS.ProcessEnv), STROM_TREE: root, STROM_SPAWNED: "1", ...extra },
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return child;
}

/**
 * Where a bridge runs. On Windows the settings' folder (else the user's home), never its tree's: a folder a process runs
 * in cannot be deleted there. Elsewhere its tree's folder, which deleting or moving it never minds: an older strom (1.17
 * and before, on macOS and Linux) tells its tree's bridge by the folder it runs in, and one in another folder it never
 * ends — going back to it left the bridge running at the app's address, the older one's at another (found in the test
 * of a switch from the beta back to the release).
 */
export function bridgeCwd(root: string, env: Env, platform: NodeJS.Platform = process.platform): string {
  if (platform !== "win32" && fs.existsSync(root)) return root;
  const dir = configDir(env);
  try {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    return userHome(env);
  }
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
function isBridge(pid: number, platform: NodeJS.Platform = process.platform): boolean {
  if (!alive(pid)) return false;
  if (platform === "win32") return true;
  const r = spawnSync("ps", ["-o", "stat=,command=", "-p", String(pid)], { encoding: "utf8", timeout: 10_000 });
  // ps not to be asked: the bridge's own note is what there is
  if (r.error || r.status === null) return true;
  const out = (r.stdout ?? "").trim();
  return !out.startsWith("Z") && /\blive\s+serve\b/.test(out);
}

/** Where a bridge is asked to end: the same way on every system (a signal on Windows ends a process without a word). */
export function liveStopFile(root: string): string {
  return path.join(root, ".strom", "live-stop.json");
}

/** What a bridge is asked when it is to end: which bridge, why (into its log), whether another one comes at its address. */
interface StopAsk {
  pid: number;
  why: string;
  back?: boolean;
}

function readStopAsk(root: string): StopAsk | undefined {
  try {
    const ask = JSON.parse(fs.readFileSync(liveStopFile(root), "utf8")) as StopAsk;
    return Number.isInteger(ask.pid) && typeof ask.why === "string" ? ask : undefined;
  } catch {
    return undefined;
  }
}

/**
 * End a bridge's process: asked to through its stop file (it says the end to the app, closes its streams and ends — the
 * same on every system), else (a bridge of an older strom, or one stuck) by a signal: SIGTERM where a process hears it,
 * and when it does not end within a while ended for good (SIGKILL; on Windows a signal is that at once). How it ended:
 * "stopped" as it should, "killed" for good, "alive" when even that did not end it, "gone" when no bridge ran.
 */
export function endBridge(pid: number, root: string, opts: { waitMs?: number; askMs?: number; platform?: NodeJS.Platform; why?: string; back?: boolean } = {}): "stopped" | "killed" | "alive" | "gone" | "elsewhere" {
  const platform = opts.platform ?? process.platform;
  const waitMs = opts.waitMs ?? 3000;
  if (!isBridge(pid, platform)) return "gone";
  // a bridge of another folder (a note copied with the research) is never ended for this tree
  if (bridgeElsewhere(pid, root)) return "elsewhere";
  // ended: no such process, or one that only waits for its parent to hear it ended (a zombie)
  const ended = () => {
    if (!alive(pid)) return true;
    if (platform === "win32") return false;
    const r = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8", timeout: 5000 });
    return !r.error && (!(r.stdout ?? "").trim() || (r.stdout ?? "").trim().startsWith("Z"));
  };
  const gone = (ms: number, also: () => boolean = () => false) => {
    for (let t = 0; t < ms; t += 100) {
      if (ended() || also()) return true;
      sleep(100);
    }
    return ended() || also();
  };
  const file = liveStopFile(root);
  const taken = () => readStopAsk(root)?.pid !== pid;
  try {
    let asked = false;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.${process.pid}`, JSON.stringify({ pid, why: opts.why ?? "asked to end", ...(opts.back === undefined ? {} : { back: opts.back }) }));
      fs.renameSync(`${file}.${process.pid}`, file);
      asked = true;
    } catch {
      // its folder cannot be written: a signal is what there is
    }
    // heard: it takes the ask within a moment, then ends (its last streams closed)
    if (asked && gone(opts.askMs ?? 1000, taken)) {
      if (gone(waitMs + 1000)) return "stopped";
    } else {
      // not heard (a bridge of an older strom, one stuck): asked by a signal — on Windows that ends it at once, unheard
      const signal = platform === "win32" ? "SIGKILL" : "SIGTERM";
      try {
        process.kill(pid, signal);
      } catch (e) {
        return (e as NodeJS.ErrnoException).code === "ESRCH" ? "stopped" : "alive";
      }
      if (gone(platform === "win32" ? 2000 : waitMs)) return platform === "win32" ? "killed" : "stopped";
      if (platform === "win32") return "alive";
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch (e) {
      return (e as NodeJS.ErrnoException).code === "ESRCH" ? "stopped" : "alive";
    }
    return gone(2000) ? "killed" : "alive";
  } finally {
    // an ask nobody took is not left for a bridge that comes later with that number
    if (readStopAsk(root)?.pid === pid) fs.rmSync(file, { force: true });
  }
}

/**
 * Stop the bridge of a tree (why: into its log; back: another bridge comes at its address at once — the app following it
 * goes on): how it went — "none" when none ran, "alive" when it could not be ended.
 */
export function stopLive(root: string, why = "strom live stop", opts: { back?: boolean } = {}): "none" | "stopped" | "killed" | "alive" {
  const info = liveRunning(root);
  if (!info) return "none";
  noteLive(root, `stop asked: ${why}`);
  const last = readLast(root);
  if (last?.pid === info.pid) writeLast(root, { ...last, ended: { at: new Date().toISOString(), reason: why } });
  const how = endBridge(info.pid, root, { why, back: opts.back ?? false });
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
  // no bridge of that number ran (it ended meanwhile, the number another program's): none was stopped
  return how === "gone" ? "none" : how;
}

/**
 * Whether the Strom app has this tree: its bridge runs, or the last one kept its secret address (the app was given it;
 * never after strom live stop or uninstall) — and the person did not say there is no app. What is said of the app
 * (after intake: where the material is in it) only then.
 */
export function appHasTree(root: string, settings: Settings): boolean {
  if (stromAppState(settings) === "no") return false;
  return !!liveRunning(root) || !!readLast(root)?.token;
}

/** Whether a bridge's end was its idle time running out (the reason it wrote: "idle: …"). */
function endedIdle(last: LiveLast): boolean {
  return /^idle\b/.test(last.ended?.reason ?? "");
}

/**
 * The bridge of a tree that ended without a word (a crash, killed) is started again — on its address, so the
 * Strom app following it goes on by itself. One that ended as it should (idle, stopped) stays so — but new work in the
 * tree (work: a session starts) brings back one that ended idle, at its address, when the app was given it (its secret
 * kept: never after strom live stop or uninstall) and the tree is no archive: the app watching the tree without
 * following it (/status?poll=1) sees it at work again.
 */
export function reviveLive(root: string, env: Env, opts: { work?: boolean } = {}): LiveInfo | undefined {
  const last = readLast(root);
  if (!last || alive(last.pid) || liveRunning(root)) return undefined;
  if (last.ended) {
    if (!opts.work || !last.token || !endedIdle(last)) return undefined;
    try {
      if (isArchive({ config: readJsonIfExists<{ mode?: string }>(path.join(root, TREE_FILE)) ?? {} })) return undefined;
    } catch {
      return undefined;
    }
  }
  const why = last.ended
    ? `work in the tree again: the bridge ${last.pid} that ended idle started again at its address`
    : `the bridge ${last.pid} ended without a word: started again`;
  const info = startLive(root, env, { why });
  // one that does not come up is not tried at every session again (each try waits for it some seconds)
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
export const BRIDGE_FEATURES = ["sync.again", "sync.undoneSince", "sync.takenBack", "sync.conflictEdit", "sync.since", "sync.ids", "family.noCouple", "family.alone", "adopt.transfer", "adopt.empty", "material.list", "person.titles", "media.codes", "hypothesis.links", "status.recent", "spend.readers", "hypothesis.intree", "archive.permission", "task.check", "waiting.groups", "waiting.sent", "waiting.note", "batch.kept", "live.end", "whats.new", "terminal.choice", "person.marriedSurname", "phone", "read.now", "read.sync", "excerpt.get", "log.sources", "material.assign", "material.thumb", "seal.foreign", "tree.state", "disk.full", "tree.notDownloaded", "sync.removed", "tree.kind", "experiments", "experiments.off", "experiments.link", "history.events", "history.hide", "experiments.pace", "history.first", "history.regions", "history.hide.all", "history.skip", "history.map", "history.delete", "history.delete.restore", "stories.history", "history.place", "surnames.suggest", "surnames.read", "duplicates.judge", "quality.dismiss", "quality.read"] as const;

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

/**
 * A task as the app shows it (/log, a change's entries, who is at work): its ID first — the app groups the history by
 * it — then its text with the records it names by their names, as the queue says it. A task's own words stay as they
 * were written (an old task strom wrote in English is not written anew).
 */
function taskTitle(tree: Tree, task: Task): string {
  return `${task.id} ${humanTask(tree, task.what, tree.lang)}`;
}

/**
 * What a change not written is about besides a person or a family, for the app to put it to its line: a source (the
 * research's S…, or the file's @xref@ of one the research does not have) and a place (its name as the file has it).
 */
export function notWrittenOf(c: Change): { source?: string; place?: string } {
  const source = c.sourceId ?? (c.source ? (c.source.startsWith("x:") ? `@${c.source.slice(2)}@` : c.source) : undefined);
  return { ...(source && c.kind.startsWith("source.") ? { source } : {}), ...(c.kind === "place.coords" && c.place?.name ? { place: c.place.name } : {}) };
}

/** The commits as the app reads them — what depends on the research now (names, tasks, directions) worked out afresh. */
function rendered(tree: Tree, raws: RawCommit[]): HistoryEntry[] {
  const sessions = new Map(tree.list<Session>("session").map((s) => [s.id, s]));
  let all: Scope[] | undefined;
  const now = Date.now();
  const titles = new Map<string, string>();
  // an archive's history says nothing of tasks (asked once, not for each commit)
  const tasks = !actsAsArchive(tree);
  const taskOf = (s: Session | undefined): { task?: string } => {
    if (!s?.task) return {};
    const task = tree.get<Task>(s.task);
    if (task && !titles.has(task.id)) titles.set(task.id, taskTitle(tree, task));
    return { task: task ? titles.get(task.id)! : s.task };
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
    const lines = changeLines(tree, ops, subject.trim(), tree.lang, undefined, tasks);
    // the directions only when a session needs them (they cost)
    const research = s ? sessionResearch(tree, s, s.research ? [] : (all ??= scopes(tree))) : undefined;
    // the sources each line names, for the app to open them (only when one does)
    const sources = lines.some((l) => l.sources?.length) ? { sources: lines.map((l) => l.sources ?? []) } : {};
    return { head, at, what: saved(subject.trim(), body), text: lines.map((l) => l.text), kinds: lines.map((l) => l.kind), ...sources, ...taskOf(s), ...(research ? { research } : {}) };
  });
}

export interface HistoryEntry {
  head: string;
  at: string;
  what: string[];
  text: string[];
  kinds: ChangeKind[];
  /** The sources each line of `text` names (S…, as the research has them now): only when a line names one. */
  sources?: string[][];
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

/** Who works, as the user reads it: "Claude Code on its own", "Codex conversation" in the research language. */
export function whoAtWork(label: string, lang: string): string {
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
      ...(s ? { session: s.id, ...(s.task ? { task: task ? taskTitle(tree, task) : s.task } : {}), ...workedOn(root, tree, s, task) } : {}),
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
function accepts(tree: Tree, settings: Settings, env: Env, seen?: ReadingsSeen): Record<string, unknown> {
  const mode = modeOf(tree);
  // a document read at once (live-read.ts): none in an archive, nor where the research waits for its agent
  const read = readAccepts(tree, settings, env, seen);
  const state = stateOf(tree);
  const shared = settings.shared()?.value;
  const free = shared ? freeBytes(shared) : undefined;
  return {
    mode,
    // a research whose agent is not on this computer waits for it, kept as an archive meanwhile (its mode stays)
    ...(state === "waiting" ? { agentHere: false } : {}),
    sync: { auto: state !== "research" ? "mirror" : settings.syncReview(tree.config) ? "off" : "write" },
    sources: true,
    verified: true,
    media: shared
      ? {
          max: originalMax(env),
          ...(free !== undefined ? { free: Math.max(0, free - ORIGINAL_RESERVE) } : {}),
          types: ORIGINAL_TYPES.map((t) => ({ mime: t.mime, ext: t.ext })),
          region: true,
          tasks: mode === "archive" ? "parked" : "open",
          // a file to a task that waits for one (X-Strom-Task): an archive has none
          task: mode !== "archive",
          batch: { ...batchLimits(env), zip: true },
          estimate: batchEstimate(tree),
        }
      : null,
    ...(read ? { read } : {}),
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
function status(root: string, env: Env, version?: string, seen?: ReadingsSeen): Record<string, unknown> {
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
      phone: phoneSummaryNow(env),
    };
  }
  const tree = Tree.open(root, env);
  const settings = new Settings(env, {});
  const newer = knownNewerVersion(settings, env);
  const intake = lastIntake(root, tree);
  const last = tip(root);
  const all = scopes(tree);
  // an archive, or a research waiting for its agent (none on this computer): nobody works on it — no agent, no
  // directions, nobody at work, nothing waiting for the person, no queue, nothing spent (Milan's decisions,
  // 2026-10-03 and 2026-10-15); what waits for the agent says so (accepts.agentHere)
  const archive = actsAsArchive(tree);
  const next = archive ? [] : rankTasks(tree, tree.list<Task>("task"), settings.strategy(tree.config)).map((r) => r.task);
  const atWork = archive ? [] : working(root, tree, all);
  // where the research is on this computer, and the agent that works on it (an archive: none)
  const agent = archive ? undefined : settings.agent(tree.config).value;
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
    // what the research is (an archive, a research, one waiting for its agent) — the app says it beside the tree
    tree: { id: tree.config.id, name: tree.config.name, lang: tree.lang, state: stateOf(tree), kind: kindOf(tree) },
    path: root,
    // sealed on this computer (writing works), or on another (its folder brought here, strom's settings gone): the
    // app's writes are refused with seal.foreign until the person takes it over (strom seal adopt, the menu, the link seal)
    seal: tree.key ? "here" : "elsewhere",
    // files of the research only in iCloud (placeholders `.X.json.icloud`): the app's writes are refused with
    // tree.not-downloaded until they are downloaded; the tree is still served as it reads
    notDownloaded: notDownloaded(root).length,
    ...(agent && PROFILES[agent] ? { agent: { id: agent, name: PROFILES[agent]!.name, ...(where === "app" || where === "terminal" ? { where } : {}) } } : {}),
    head: last.head,
    ...(last.at ? { headAt: last.at } : {}),
    // what the last 24 hours added (the app's "last 24 h"; /log gives only the last 500 commits): worked out in the
    // background, its own head said — none until it is ready
    ...recentOf(root, env, last.head),
    persons: tree.countLive("person"),
    families: tree.count("family"),
    researches: archive ? [] : directions(tree, all, next, atWork.filter((w) => !w.paused).map((w) => w.research)),
    working: atWork,
    open: archive ? [] : openSessions(tree).map((s) => ({ id: s.id, task: s.task, started: s.started })),
    // what waits for the person, ordered and grouped by the place where it is dealt with (core/waiting.ts): the tasks,
    // a new version of an approved story (for an app that shows it: the _DRAFT gate), an archive's images that wait for
    // the person's decision and the connectors taken over (none in an archive) — the person decides in the terminal a
    // link opens (archive&host=, task&do=)
    waiting: archive ? [] : waitingFor(tree, {
      shared: settings.shared()?.value,
      claude: () => settings.agent(tree.config).value === "claude" && agentsHere(env).some((a) => a.id === "claude" && a.cli),
      stories: appShowsStoryDrafts(settings, version),
      scopes: all,
    }).map((w) => w.item),
    links: links(env),
    ...linkSchemeOf(env),
    // the experiments searched for this tree, and the fingerprint of what GET /history answers (only for a tree that has
    // anything of it, or with the experiment on: an older app reads nothing new)
    // (how often it takes a session: read only — a pace is the person's, chosen in the terminal)
    experiments: { history: historyOn(tree, settings), historyPace: settings.historyPace(tree.config) },
    // the history of the places in the stories (stories.history): on while the history is on, unless turned off
    stories: { history: settings.storyHistory(tree.config) },
    ...historyOfStatus(tree, settings, last.head, archive),
    // the fingerprint of what GET /quality answers (the person's "not an error")
    quality: { rev: qualityRev(tree, last.head) },
    // an archive: nobody works on it — its tasks put aside are no queue, nothing spent (Milan's decision, 2026-10-03)
    ...(archive ? { queue: [], queueMore: 0 } : queue(tree, next, all)),
    ...(newer ? { update: { version: newer } } : {}),
    ...(archive ? {} : { spend: spendOf(root, tree) }),
    ...(intake ? { lastIntake: intake } : {}),
    accepts: accepts(tree, settings, env, seen),
    // the documents the app asked to be read and the research's own readings: at work, and ended in the last week
    ...(archive || !seen ? {} : { reads: statusReads(seen, settings.agent(tree.config).value) }),
    inbox: { trees: inboxTrees(root, env), material: materialWaiting(tree) },
    sends: recentSends(root, tree),
    batches: batchStatus(tree),
    // the phone connection, this computer's (an archive's too: the person sends photos into it)
    phone: phoneSummaryNow(env),
  };
}

/**
 * The fingerprint of what GET /history answers (core/pastevents.ts historyRev), worked out again with a new commit or
 * after STROM_LIVE_HISTORY_MS (a minute): a catalog of the shared folder changes without the tree's commits.
 */
const historyRevs = new Map<string, { at: number; head: string; rev: string }>();
function historyRevNow(tree: Tree, settings: Settings, h: string, fresh?: string): string {
  const had = historyRevs.get(tree.root);
  if (fresh === undefined && had && had.head === h && Date.now() - had.at < Number(tree.env.STROM_LIVE_HISTORY_MS ?? 60_000)) return had.rev;
  const rev = fresh ?? historyRev(tree, settings.shared()?.value, settings);
  historyRevs.set(tree.root, { at: Date.now(), head: h, rev });
  return rev;
}

/** A tree the app is told the history of: with the experiment on, or one that has anything of it (its history/ folder). */
function historyShown(tree: Tree, settings: Settings): boolean {
  return historyOn(tree, settings) || fs.existsSync(path.join(tree.root, "history"));
}

/**
 * /status history {rev}: only for a tree whose history is shown (an older app reads nothing new). Where it is looked
 * for (no archive, the history on): how long a session on a place's history takes, what such sessions cost here (three
 * measured), and whether each place with coordinates is looked for by itself (read only: the person's, in the terminal).
 */
function historyOfStatus(tree: Tree, settings: Settings, h: string, archive: boolean): { history?: { rev: string; placeEstimate?: ReturnType<typeof placeEstimate>; placesAuto?: boolean } } {
  if (!historyShown(tree, settings)) return {};
  const searched = !archive && historyOn(tree, settings);
  return { history: { rev: historyRevNow(tree, settings, h), ...(searched ? { placeEstimate: placeEstimate(tree), placesAuto: settings.historyPlacesAuto(tree.config) } : {}) } };
}

/** The limits of GET /history (a test lowers them: STROM_LIVE_HISTORY_EVENTS, STROM_LIVE_HISTORY_PLACES). */
function historyLimits(env: Env): { events: number; places: number } {
  const n = (v: string | undefined, d: number) => (v && /^\d{1,6}$/.test(v) && Number(v) > 0 ? Math.min(Number(v), d) : d);
  return { events: n(env.STROM_LIVE_HISTORY_EVENTS, MAX_EVENTS), places: n(env.STROM_LIVE_HISTORY_PLACES, MAX_PLACES) };
}

/** What the month cost: the agent's sessions with their readers, and the readings the app asked (in no session). */
function spendOf(root: string, tree: Tree): Record<string, unknown> {
  const month = new Date().toISOString().slice(0, 7);
  const spent = monthSpend(tree, month);
  const reads = appReadSpend(root, month);
  if (!reads.count) return { ...spent, currency: "USD" };
  const cents = (n: number) => Math.round(n * 100) / 100;
  return { ...spent, amount: cents(spent.amount + reads.amount), readers: cents((spent.readers ?? 0) + reads.amount), reads, currency: "USD" };
}

/** The phone connection for /status, looked at again at most every ten seconds (the app asks every minute, each bridge). */
let phoneSummarySeen: { at: number; value: ReturnType<typeof phoneSummary> } | undefined;
function phoneSummaryNow(env: Env): ReturnType<typeof phoneSummary> {
  if (!phoneSummarySeen || Date.now() - phoneSummarySeen.at > 10_000) phoneSummarySeen = { at: Date.now(), value: phoneSummary(env) };
  return phoneSummarySeen.value;
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
    if (held.length) noteLive(root, `an archive: ${counted(held.length, "task")} put aside (${held.join(", ")})`);
  } catch (e) {
    noteLive(root, `an archive's tasks not put aside now: ${errorText(e)}`);
  }
  // the tasks an older strom made to say those links: first in the queue (once)
  try {
    const raised = raiseHypothesisLinkTasks(Tree.open(root, env));
    if (raised) noteLive(root, `hypotheses: ${counted(raised.length, "task")} to say their variants' links first in the queue (${raised.join(", ")})`);
  } catch (e) {
    noteLive(root, `the tasks to say the hypotheses' links not raised now: ${errorText(e)}`);
  }
  // older hypotheses: the links of their variants their claims say beyond doubt, the rest a task for the agent (once)
  try {
    const done = settleHypothesisLinks(Tree.open(root, env));
    if (done) noteLive(root, `hypotheses: ${counted(done.linked.length, "variant link")} filled in from their claims, ${counted(done.tasks.length, "task")} for the rest`);
  } catch (e) {
    noteLive(root, `the links of the hypotheses' variants not filled in now: ${errorText(e)}`);
  }
  // the phone connection on and its server gone (the computer started again): started again beside the bridge
  try {
    if (phoneConfig(env).on && !phoneRunning(env)) {
      revivePhone(env);
      noteLive(root, "the phone connection is on and its server was gone: started again");
    }
  } catch (e) {
    noteLive(root, `the phone's server not started again now: ${errorText(e)}`);
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
  /** The excerpts the tree's file of that head leaves out, though the research has them (the same for every app): /excerpts. */
  let left: { head: string; level: string; sources: { source: Source; omitted: ExcerptOmitted }[] } | undefined;
  let log: { head: string; text: string } | undefined;
  // what git said of each commit, kept: a new commit costs only itself (/log, the changes heard)
  const histories = new HistoryCache(root);

  /** A request that failed: said to the app, written into the log — the bridge goes on. */
  const failed = (req: http.IncomingMessage, res: http.ServerResponse, e: unknown) => {
    noteLive(root, `${req.method} ${masked(req.url)} failed: ${errorText(e)}`);
    try {
      // an answer begun (the events) is only ended
      if (res.headersSent) res.end();
      else {
        // a send or an adoption that went wrong on the way: its stable code too, for the app to say it in its words
        const what = req.method === "POST" ? (req.url ?? "").split("?")[0]!.split("/")[2] : undefined;
        if (isDiskFull(e)) {
          res.writeHead(507, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(diskFullSaid(langOf(root, env), root)));
          return;
        }
        const code = what === "sync" ? CODES["ui.sync.bridge.failed"] : what === "adopt" ? CODES["ui.sync.bridge.adopt"] : undefined;
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ error: (e as Error)?.message ?? String(e), ...(code ? { code } : {}) }));
      }
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
  // what receives an original or closes a batch (receive.ts, shared with the phone's server)
  const receiver: Receiver = { root, env, note: (text) => noteLive(root, text), track, head: () => head(root), safely };
  // the documents the app asks to be read (live-read.ts): their queue read one at a time, each by a strom of its own
  const reads = new AppReadings({ root, env, settings: () => new Settings(env, {}), note: (text) => noteLive(root, text), safely });

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
      const marks = ["code", "reasonCode", "decided", "take", "intake", "input", "changes", "applied", "pending", "keptAs", "known", "batch", "sha", "read", "state"]
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
    const h = makeGed(version);
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Strom-Head": h }).end(ged!.text);
  };
  /** The tree for the app made for its head and version, when it is not made yet; its head. */
  const makeGed = (version: string | undefined): string => {
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
      const readings = appShowsReadings(new Settings(env, {}), version);
      // …and why a source has no image though the research has one, for an app that says so and asks for it
      const omitted = !!images && appShowsOmittedImages(new Settings(env, {}), version);
      // …and the groups of surname forms and the suggestions rejected, for an app that reads them (strom sync takes them back)
      const surnameGroups = appReadsSurnameGroups(new Settings(env, {}), version) ? surnamesForExport(tree) : undefined;
      left = {
        head: h,
        level: set?.quality ?? LEVELS[1]!.name,
        sources: images ? tree.list<Source>("source").flatMap((s) => (s.retracted ? [] : [{ source: s, omitted: images.omitted(s) }])).filter((x): x is { source: Source; omitted: ExcerptOmitted } => !!x.omitted) : [],
      };
      const offered = opens ? links(env) : [];
      ged = {
        head: h,
        links: offered.join(" "),
        version: version ?? "",
        text: exportGedcom(tree, { for: "strom", ...(h ? { head: h } : {}), ...(surnameGroups ? { surnameGroups } : {}), ...(images ? { excerpts: images.of } : {}), ...(opens ? { clips: true, research: true } : {}), ...(edges ? { edges } : {}), ...(storyDrafts ? { storyDrafts } : {}), ...(coupleResi ? { coupleResi } : {}), ...(sourceReads ? { sourceReads } : {}), ...(factStatus ? { factStatus } : {}), ...(archive ? { archive } : {}), ...(turnsExcerpts ? { turnsExcerpts } : {}), ...(noCouple ? { noCouple } : {}), ...(titles ? { titles } : {}), ...(hypothesisLinks ? { hypothesisLinks } : {}), ...(conflictSides ? { conflictSides } : {}), ...(readings ? { readings } : {}), ...(omitted ? { omitted: images.omitted } : {}), ...(offered.length ? { links: offered, ...(linkScheme(env) !== LINK_SCHEME ? { linkScheme: linkScheme(env) } : {}) } : {}) }).text,
      };
    }
    return h;
  };

  /**
   * What the app would load to have every image of the research (/excerpts?missing=1): the sources whose excerpts the
   * file of the head now leaves out, though the research has them (not those whose image is not here), each with the
   * marks of its excerpts, how large they come (made ones exactly, the rest estimated) and whether all are made.
   */
  const giveLeft = (res: http.ServerResponse, version: string | undefined) => {
    const h = head(root);
    if (!left || left.head !== h) makeGed(version);
    const now = left!;
    const tree = Tree.open(root, env);
    const shared = new Settings(env, {}).shared()?.value;
    const level = excerptLevel(now.level) ?? LEVELS[1]!;
    const media = tree.list<Media>("media");
    const sources = !shared
      ? []
      : now.sources
          .filter((x) => x.omitted.why !== "missing")
          .map((x) => ({ x, size: excerptSizes(tree, shared, x.source, level, media) }))
          .filter(({ size }) => size.clips.length)
          .map(({ x, size }) => ({ source: x.source.id, why: x.omitted.why, clips: size.clips, bytes: size.bytes, ready: size.ready, ...(size.estimated ? { estimated: true } : {}) }));
    const body = {
      head: now.head,
      level: level.name,
      count: sources.length,
      clips: sources.reduce((n, x) => n + x.clips.length, 0),
      bytes: sources.reduce((n, x) => n + x.bytes, 0),
      estimated: sources.some((x) => x.estimated),
      sources,
    };
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Strom-Head": now.head }).end(JSON.stringify(body));
  };

  /**
   * One source's excerpts for the app (/excerpt/<S>[?clip=…&level=…]): as its file would carry them (turned for an app
   * that does not turn them), at the research's quality or the one asked for, never made smaller for a limit. Made for
   * EXCERPT_MS at most: the rest later (202, asked again — the made ones come from the cache).
   */
  const giveExcerpt = (req: http.IncomingMessage, res: http.ServerResponse, version: string | undefined, id: string) => {
    const json = (code: number, body: unknown) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    const q = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
    const clip = q.get("clip") ?? undefined;
    if (!/^S\d{1,9}$/.test(id)) return void json(400, refusal("/excerpt/S… (a source of the research)", "source.id", { source: id.slice(0, 32) }));
    if (clip !== undefined && clip !== INPUT_MARK && !/^c[0-9a-f]{10}$/.test(clip)) return void json(400, refusal("?clip=<the excerpt's mark, _STROM_CLIP>", "excerpt.mark", { clip: clip.slice(0, 32) }));
    const tree = Tree.open(root, env);
    const s = tree.get<Source>(id);
    if (!s || s.type !== "source") return void json(404, refusal(`the research has no source ${id}`, "source.unknown", { source: id }));
    if (s.retracted || s.mergedInto) {
      // merged into another: where it went (that one as it is now)
      let to = s.mergedInto ? tree.get<Source>(s.mergedInto) : undefined;
      for (let hops = 0; to?.mergedInto && hops < 10; hops++) to = tree.get<Source>(to.mergedInto) ?? to;
      return void json(410, { ...refusal(`the source ${id} was taken back`, "source.retracted", { source: id }), ...(to && !to.retracted ? { movedTo: to.id } : {}) });
    }
    const marks = excerptMarks(s);
    if (clip && !marks.includes(clip)) return void json(404, refusal(`the source ${id} has no excerpt ${clip}`, "excerpt.unknown", { source: id, clip }));
    const settings = new Settings(env, {});
    // a level this strom does not know (a newer app's) is no refusal: the research's quality, said in the answer
    const level = excerptLevel(q.get("level")) ?? excerptLevel(settings.excerpts(tree.config).quality) ?? LEVELS[1]!;
    const shared = settings.shared()?.value;
    const got = shared || !s.clips?.length ? sourceExcerpts(tree, shared ?? "", s, { level, clip, budgetMs: Number(env.STROM_LIVE_EXCERPT_MS ?? EXCERPT_MS) }) : { excerpts: [], missing: clip ? [clip] : marks, later: [] };
    if (got.later.length) return void json(202, { later: true, source: id, made: got.excerpts.length, left: got.later.length });
    const turns = appTurnsExcerpts(settings, version);
    const each = !clip && got.excerpts.length > EXCERPTS_AT_ONCE;
    const excerpts = got.excerpts.map(({ excerpt, region }) => {
      const e = turns ? excerpt : turned(excerpt);
      const original = tree.get<Media | Input>(e.media);
      return {
        clip: e.clip,
        ...(original?.sha ? { sha: original.sha } : {}),
        ...(region ? { region } : {}),
        ...(e.orient ? { orient: e.orient } : {}),
        width: e.width,
        height: e.height,
        mime: "image/jpeg",
        bytes: e.jpeg.length,
        ...(e.url ? { url: e.url } : {}),
        ...(each ? {} : { dataUrl: dataUrl(e) }),
      };
    });
    json(200, { source: id, level: level.name, excerpts, missing: got.missing, ...(each ? { each: true } : {}) });
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

  /** A write refused as the research is sealed on another computer: said in its language, the way in `params.set`. */
  const sealRefusal = () => {
    let lang = "en";
    let name = "";
    try {
      const config = readJsonIfExists<TreeConfig>(path.join(root, TREE_FILE));
      lang = config?.lang ?? lang;
      name = config?.name ?? name;
    } catch {
      // said in English
    }
    return { ...said(lang, "ui.seal.bridge", { name, set: "strom seal adopt" }), seal: "elsewhere" };
  };

  /** A write refused as files of the research are only in iCloud: said in its language, how many and the first. */
  const cloudRefusal = (files: string[]) => {
    let lang = "en";
    try {
      lang = readJsonIfExists<TreeConfig>(path.join(root, TREE_FILE))?.lang ?? lang;
    } catch {
      // said in English
    }
    return { ...said(lang, "ui.error.tree.not-downloaded", { n: String(files.length), first: files[0]! }), notDownloaded: files.length };
  };

  const answer = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const [, t, what, sub, act, rest] = (req.url ?? "").split("?")[0]!.split("/");
    // the app asking now and then (?poll=1) or by itself what is new keeps no bridge running; anything else does
    if (!(req.method === "GET" && ((what === "status" && /[?&]poll=1(?:&|$)/.test(req.url ?? "")) || what === "whats-new"))) lastAsked = Date.now();
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
    // sealed on another computer: nothing the app sends is written until the person takes it over here — said so (409
    // seal.foreign, in the research's language with the way), never "send again in a moment" (found in the audit)
    if ((req.method === "POST" || req.method === "PUT") && t === token && origin && APP_WRITES.has(what ?? "") && !newerTree(root, env) && !sealedHere(root, env)) {
      req.resume();
      res.writeHead(409, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(sealRefusal()));
      return;
    }
    // files of the research only in iCloud: nothing the app sends is written over them (409 tree.not-downloaded, the
    // way in the research's language), never "send again in a moment"
    const cloud = (req.method === "POST" || req.method === "PUT") && t === token && origin && APP_WRITES.has(what ?? "") ? notDownloaded(root) : [];
    if (cloud.length) {
      req.resume();
      res.writeHead(409, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(cloudRefusal(cloud)));
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
      // the bridge cannot tell the app from an agent on this computer (the secret is in the research's folder, an Origin
      // is a header any program sets): a conflict is the person's to decide, in the terminal its link opens — refused
      // before anything is read or opened
      req.resume();
      const id = decoded(sub).slice(0, 32);
      res
        .writeHead(403, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
        .end(JSON.stringify(refusal(`a conflict is decided in the terminal, through the link strom-research://conflict?…&id=${id}&do=decide — not through the bridge`, "decide.link", { id })));
      return;
    }
    if (req.method === "POST" && t === token && what === "waiting" && sub && !act) {
      writeFor(req, res, origin, waitingWrite(decoded(sub)));
      return;
    }
    if (req.method === "POST" && t === token && what === "group" && sub && !act) {
      writeFor(req, res, origin, groupWrite(decoded(sub)));
      return;
    }
    if (req.method === "POST" && t === token && what === "material" && (sub === "assign" || sub === "hide") && !act) {
      writeFor(req, res, origin, materialWrite(sub));
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "hide" && !act) {
      writeFor(req, res, origin, historyHide());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "place" && !act) {
      writeFor(req, res, origin, historyPlace());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "first" && !act) {
      writeFor(req, res, origin, historyFirst());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "delete" && !act) {
      writeFor(req, res, origin, historyDelete());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "skip" && !act) {
      writeFor(req, res, origin, historySkip());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "map" && !act) {
      writeFor(req, res, origin, historyMap());
      return;
    }
    if (req.method === "POST" && t === token && what === "stories" && !sub) {
      writeFor(req, res, origin, storiesWrite());
      return;
    }
    if (req.method === "POST" && t === token && what === "quality" && sub === "dismiss" && !act) {
      writeFor(req, res, origin, qualityDismiss());
      return;
    }
    if (req.method === "POST" && t === token && what === "duplicates" && !sub) {
      duplicates(req, res);
      return;
    }
    if (req.method === "POST" && t === token && what === "experiments" && !sub) {
      writeFor(req, res, origin, experimentsWrite());
      return;
    }
    if ((req.method === "GET" || req.method === "POST") && t === token && what === "phone") {
      phone(req, res, origin, sub, act);
      return;
    }
    if ((req.method === "GET" || req.method === "POST") && t === token && (what === "read" || what === "reads") && reads.answer(req, res, origin, what, sub === undefined ? undefined : decoded(sub), act, rest)) return;
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
        const thumb = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("thumb");
        if (thumb !== null && !(THUMB_SIZES as readonly number[]).includes(Number(thumb))) json(400, refusal(`?thumb=${THUMB_SIZES.join("|")} (the longer side in pixels)`, "thumb.size"));
        else if (!known) json(404, { known: null });
        else if (thumb !== null) giveThumb(req, res, known, sha, Number(thumb));
        else if (!/[?&]file=1(?:&|$)/.test(req.url ?? "")) json(200, { known: known.id, kind: known.kind, mime: known.mime, bytes: known.bytes, ...(known.name ? { name: known.name } : {}), here: !!known.file && fs.existsSync(known.file) });
        else if (!known.file || !fs.existsSync(known.file)) json(410, { known: known.id, ...refusal("its file is not on this computer", "media.gone", { known: known.id }) });
        else {
          const size = fs.statSync(known.file).size;
          res.writeHead(200, { "Content-Type": known.mime, "Content-Length": String(size), "Cache-Control": "no-store", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(known.name ?? path.basename(known.file))}` });
          fs.createReadStream(known.file).on("error", (e) => failed(req, res, e)).pipe(res);
        }
      } else if (what === "excerpt" && sub && !act) {
        giveExcerpt(req, res, version, decoded(sub).toUpperCase());
      } else if (what === "excerpts" && !sub) {
        if (new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("missing") !== "1") res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(refusal("/excerpts?missing=1: the excerpts the tree's file leaves out", "excerpts.missing")));
        // the plan of the file the tree's head has: made when the commits stop coming, as the tree is
        else afterQuiet(() => safely(req, res, () => giveLeft(res, version)));
      } else if (what === "material") {
        // the family's files the research keeps — an archive's too, which nobody sorts: the app shows them again
        const q = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
        const person = (q.get("person") ?? "").toUpperCase();
        const batch = q.get("batch") ?? "";
        const files = q.get("files");
        const json = (code: number, body: unknown) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
        if ((q.has("person") && !/^P\d{1,9}$/.test(person)) || (q.has("batch") && !BATCH_ID.test(batch)) || (files !== null && files !== "0" && files !== "1"))
          json(400, { ...refusal("?person=P… (a person of the research), ?batch=<the batch's mark>, ?files=0 (the batches only)", "material.query") });
        else json(200, material(Tree.open(root, env), new Settings(env, {}).shared()?.value, { ...(person ? { person } : {}), ...(batch ? { batch } : {}), ...(files === "0" ? { files: false } : {}) }));
      } else if (what === "history" && !sub) {
        // what the ancestors lived through: read in an archive too, and in a research waiting for its agent
        const tree = Tree.open(root, env);
        const settings = new Settings(env, {});
        const got = historyAnswer(tree, settings.shared()?.value, settings, historyLimits(env));
        historyRevNow(tree, settings, head(root), got.state.rev);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(got));
      } else if (what === "surnames" && !sub) {
        // the forms of a surname: suggested from the records, decided by the person — never while the research is written
        const json = (code: number, body: unknown, retry?: number) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname()))) json(503, { ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }, 5);
        else json(200, suggestSurnames(Tree.open(root, env)));
      } else if (what === "quality" && !sub) {
        // what the person marked no error: read in an archive too
        const tree = Tree.open(root, env);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ rev: qualityRev(tree), dismissed: readDismissed(tree).dismissed }));
      } else if (what === "group" && act === "note") {
        // the request texts of one place, for one e-mail: read only
        const got = groupNote(decoded(sub));
        res.writeHead(got.code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(got.body));
      } else if (what === "status") {
        // what is answered is made first: a read that fails can still answer 500
        const text = JSON.stringify(status(root, env, version, reads.seen));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(text);
      } else if (what === "whats-new") {
        // what is new in this strom, from the changelog shipped with it (the app's window "What's new")
        const lang = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("lang");
        const text = JSON.stringify(whatsNew(VERSION, lang, updateChannel(env)));
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
        const hello = JSON.stringify(status(root, env, version, reads.seen));
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
      return actsAsArchive(tree) || !new Settings(env, {}).syncReview(tree.config);
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
      else noteLive(root, `the send ${sent.intake} ${data.input && data.changes?.length ? `written: ${data.input}` : `brought nothing new${data.input ? ` (the same as ${data.input})` : ""}`}${data.skipped?.length ? `, ${counted(data.skipped.length, "change")} left out` : ""}`);
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
                    .map((c) => ({ kind: c.kind, ...(c.person ? { person: c.person } : {}), ...(c.family ? { family: c.family } : {}), ...notWrittenOf(c), ...(c.fact?.kind ?? c.was?.kind ? { fact: c.fact?.kind ?? c.was?.kind } : {}), why: c.takenBack ? "takenBack" : c.kept ? "kept" : c.kind === "person.removed" ? "removed" : c.action, ...(c.removedBy ? { removedBy: c.removedBy } : {}), ...(c.uncited?.length ? { cites: c.uncited.map((k) => (k.startsWith("x:") ? `@${k.slice(2)}@` : k)) } : {}) })),
                }
              : {}),
            // the changes the research could not write (the rest is written): what and why
            ...(data.skipped?.length ? { skipped: data.skipped } : {}),
            // the sources that said they are an entry of a reading of a document (_STROM_READING): taken as the
            // research's reading, or not (why: a stable code) and so the app's own source as any
            ...(changes.some((c) => c.reading)
              ? { readings: changes.filter((c) => c.reading).map((c) => ({ source: c.source!.startsWith("x:") ? `@${c.source!.slice(2)}@` : c.source!, read: c.reading!.id, ok: c.reading!.ok, ...(c.reading!.entry ? { entry: c.reading!.entry } : {}), ...(c.reading!.code ? { code: c.reading!.code } : {}), ...(c.reading!.edited ? { edited: true } : {}) })) }
              : {}),
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
          // sealed on another computer since it was asked (its key gone meanwhile): said as the bridge says it before
          if (data.code === SEAL_FOREIGN) reply(409, { ...sealRefusal(), intake: sent.intake });
          // no room on the disk: said as everywhere (507 disk.full), never the system's words with strom's inner path
          else if (data.code === DISK_FULL || isDiskFull(why)) reply(507, { ...diskFullSaid(lang, fullWhere(data, root)), reason: why, intake: sent.intake });
          else reply(500, { ...said(lang, "ui.sync.bridge.failed"), reason: why, ...(data.code ? { reasonCode: data.code } : {}), ...(data.params ? { reasonParams: data.params, reasonNames } : {}), intake: sent.intake });
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
    const failed = (why: string, full = false) => {
      noteLive(root, `the app's tree was not taken in: ${why}`);
      noteAdoptFailed(root, "other", why);
      if (!answered) reply(full ? 507 : 500, full ? { ...diskFullSaid(lang, root), reason: why } : { ...said(lang, "ui.sync.bridge.adopt"), reason: why });
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
      let data: { input?: string | null; message?: string; code?: string; applied?: { do: string; id: string; before?: string }[] } = {};
      try {
        data = JSON.parse(out) as typeof data;
      } catch {
        // said by the exit code
      }
      if (code !== 0) {
        const why = data.message ?? err.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? `exit ${code}`;
        return failed(why, data.code === DISK_FULL || isDiskFull(why));
      }
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
    if (actsAsArchive(tree) || !new Settings(env, {}).syncReview(tree.config)) {
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
    if (!origin) return reply(403, refusal("only the Strom app may send a tree here", "app.only"));
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
        if (isDiskFull(e)) return reply(507, diskFullSaid(lang, root));
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
      reply(403, refusal("only the Strom app may send a tree here", "app.only"));
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
        // no room on the disk (found on Mac: "ENOSPC: no space left on device, mkdir …/.strom/sync" as tree.refused)
        if (isDiskFull(e)) reply(507, { ...diskFullSaid(lang(), root), ...(keptAs ? { keptAs } : {}) });
        else reply(400, { ...(key ? said(lang(), key) : { error: m, code: "tree.refused", text: m }), ...(keptAs ? { keptAs } : {}) });
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
    let named: string | undefined;
    let note: string | undefined;
    let meta: { persons: string[]; source?: string };
    let region: string | undefined;
    let batch: string | undefined;
    let where: string | undefined;
    let forTask: string | undefined;
    let read = false;
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
      named = decodeURIComponent(header("x-strom-name") ?? "").trim() || undefined;
      name = named ?? sha.slice(0, 12);
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
      at = "X-Strom-Task";
      const task = header("x-strom-task")?.trim();
      if (task !== undefined && !/^[Tt]\d{1,9}$/.test(task)) throw new Error("X-Strom-Task: the ID of a task of the research that waits (T…)");
      if (task && (batch || source)) throw new Error("X-Strom-Task: a file for a task comes in no batch and is no image of a source");
      forTask = task ? normId(task, "task") : undefined;
      at = "X-Strom-Read";
      const toRead = header("x-strom-read")?.trim();
      if (toRead !== undefined && toRead !== "1") throw new Error("X-Strom-Read: 1 — the file is to be read at once (POST /read)");
      if (toRead && (batch || source || task)) throw new Error("X-Strom-Read: a file to read comes in no batch, for no task and is no image of a source");
      read = toRead === "1";
      meta = checkOriginalMeta(tree, { persons, source });
    } catch (e) {
      // a person or a source the research has not got: 404, its JSON body telling it from an address that is no bridge's
      const m = (e as Error).message;
      const coded = e instanceof StromError && e.code ? refusal(m, e.code, e.params ?? {}) : refusal(m, "media.bad-header", { header: at });
      return refuse(/^no (person|source)/.test(m) ? 404 : 400, coded);
    }
    // a file for a task (its "Add a file"): only for a task that waits for one — else refused before anything is kept
    // (the app offers the inbox folder then)
    if (forTask) {
      const no = fileRefused(tree.get<Task>(forTask), forTask);
      if (no) return refuse(409, refusal(no.message, no.code === "task.no-file" ? "waiting.no-file" : "waiting.none", { id: forTask }));
    }
    // a file to read: its reading shown under the name it came with now — also when the research had it already
    if (read) reads.named(sha, named);
    receiveOriginal(receiver, req, res, { sha, name, note, persons: meta.persons, source: meta.source, region, batch, where, zip, task: forTask, ...(read ? { read } : {}) });
  };

  const closeBatchNow = (id: string, extra: string[], reply: (code: number, body: Record<string, unknown>) => void) => closeBatchBy(receiver, id, extra, reply);

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
   * What the person writes from the app (POST /waiting/<T…>, /group/<key>: a request marked sent — a fact, never a
   * decision or a consent, which only the terminal takes): checked here, then written by a strom of its own as the
   * user's (forApp: the command the terminal runs, its lock, its log and commit), one at a time and never while a send or
   * an adoption is written — then busy (503 + Retry-After, research.busy: what the bridge says of an original or a batch
   * the research cannot take now). Its refusals by their codes; the research a newer strom wrote 423 `locked`, not from
   * the app's pages 403 `app.only`, a body that is no JSON object 400 `waiting.bad-body`.
   */
  let personWriting: string | undefined;
  const WRITE_RETRY_S = 5;
  interface AppWrite {
    /** What it is (said in live.log). */
    what: string;
    /** What the body asks, checked against the research as it is now: the command to run, else the answer. */
    ask(tree: Tree, body: Record<string, unknown>): { args: string[] } | { code: number; body: Record<string, unknown> };
    /** The answer once written (the command's --json data, the research's head after it). */
    done(tree: Tree, data: Record<string, unknown>, head: string): Record<string, unknown>;
    /** The command's refusal (its --json code) as the app is told it; none: 500 `waiting.failed`. */
    refused(tree: Tree, code: string, why: string): { code: number; body: Record<string, unknown> } | undefined;
    /** What goes to the command's stdin (a long list of IDs: never a command line too long for Windows). */
    stdin?: string;
    /** Its own codes: a body that is no JSON object, the research busy (409 + Retry-After instead of 503), a failure. */
    codes?: { badBody: string; busy: string; failed: string };
    /** The research busy with its own codes: answered so (503 + Retry-After, as research.busy everywhere) — default 409. */
    busyStatus?: 409 | 503;
    /** The largest body it takes (default 8 kB). */
    max?: number;
  }
  const writeFor = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, how: AppWrite) => {
    const reply = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(code === 503 || (code === 409 && body.retry !== undefined) ? { "Retry-After": String(body.retry ?? WRITE_RETRY_S) } : {}) }).end(JSON.stringify(body));
    };
    const codes = how.codes ?? { badBody: "waiting.bad-body", busy: "research.busy", failed: "waiting.failed" };
    const busy = (why: string) => reply(how.codes ? (how.busyStatus ?? 409) : 503, { ...refusal(why, codes.busy), retry: WRITE_RETRY_S });
    const max = how.max ?? 8192;
    if (!origin) {
      req.resume();
      return reply(403, refusal("only the Strom app may write here", "app.only"));
    }
    let text = "";
    let over = false;
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > max) over = true;
      else chunks.push(c);
    });
    req.on("end", () => safely(req, res, () => {
      text = Buffer.concat(chunks).toString("utf8");
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
      if (over) return reply(400, refusal(size > max ? `the body: at most ${max} bytes` : `the body: a JSON object {"do": …}`, codes.badBody));
      const asked = how.ask(Tree.open(root, env), body);
      if ("code" in asked) return reply(asked.code, asked.body);
      // a send or an adoption being written, another write of the person's: asked again in a moment
      if (writing || adopting || personWriting) return busy("the research is busy — ask again in a moment");
      personWriting = how.what;
      const { command, args } = stromLauncher();
      // --json before a bare "--" (what follows it is an argument as it is: a place may begin with a hyphen)
      const end = asked.args.indexOf("--");
      const words = end < 0 ? [...asked.args, "--json"] : [...asked.args.slice(0, end), "--json", ...asked.args.slice(end)];
      const child = spawn(command, [...args, ...words], { cwd: root, env: forApp(env, root), stdio: [how.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"], windowsHide: true });
      track(child);
      if (how.stdin !== undefined) {
        child.stdin!.on("error", () => {
          // the command ended before reading it: said by its exit
        });
        child.stdin!.end(how.stdin);
      }
      let out = "";
      let err = "";
      child.stdout!.on("data", (d: Buffer) => (out += d.toString("utf8")));
      child.stderr!.on("data", (d: Buffer) => (err += d.toString("utf8")));
      child.on("error", (e) => {
        personWriting = undefined;
        reply(500, refusal(errorText(e), codes.failed));
      });
      child.on("close", (code) => {
        personWriting = undefined;
        if (code === null) return;
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(out) as Record<string, unknown>;
        } catch {
          // said by the exit code
        }
        const now = Tree.open(root, env);
        if (code === 0) {
          const c = committed(data, () => head(root));
          return reply(200, { ...how.done(now, c.data, c.head), ...(c.parent !== undefined ? { parent: c.parent } : {}) });
        }
        const why = String(data.message ?? err.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? `exit ${code}`);
        noteLive(root, `${how.what} was not written (exit ${code}): ${why}`);
        // the research busy (another strom holding it longer than a writer waits)
        if (code === EXIT.locked) return busy(why);
        // no room on the disk: said as everywhere (507 disk.full)
        if (data.code === DISK_FULL || isDiskFull(why)) return reply(507, diskFullSaid(now.lang, fullWhere(data, root)));
        const known = typeof data.code === "string" ? how.refused(now, data.code, why) : undefined;
        reply(known?.code ?? 500, known?.body ?? { ...refusal(why, codes.failed), ...(typeof data.code === "string" ? { reasonCode: data.code } : {}) });
      });
    }));
  };

  /**
   * The people a file of the family's material is of, added and taken off (POST /material/assign {files: [I…] | batch,
   * add: [P…], remove: [P…]}: strom input assign), files hidden and shown again (POST /material/hide {files, hidden,
   * reason}: strom input hide | unskip) — the person's, as written in the app; all or nothing. Answered with the files'
   * records as GET /material gives them, the people's names, and the people a file keeps through its batch (`kept`).
   * Refused: 400 material.body, 404 material.file | material.person | material.batch {id | batch}, 403 material.readonly
   * (nothing can be written into the research here), 409 material.busy (and Retry-After: another write holds it).
   */
  const MATERIAL_CODES = { badBody: "material.body", busy: "material.busy", failed: "material.failed" };
  const materialWrite = (kind: "assign" | "hide"): AppWrite => {
    let ids: string[] = [];
    const shown = (tree: Tree, files: string[], kept: { person: string }[] = []) => {
      const got = material(tree, new Settings(env, {}).shared()?.value, { ids: files });
      return { files: got.files, people: { ...got.people, ...peopleOf(tree, kept.map((k) => k.person)) } };
    };
    const strings = (v: unknown, most: number): string[] | undefined => (v === undefined ? [] : Array.isArray(v) && v.length <= most && v.every((x) => typeof x === "string" && x.length <= 40) ? (v as string[]) : undefined);
    const bad = (why: string) => ({ code: 400, body: refusal(why, "material.body") });
    return {
      what: `the material: ${kind}`,
      codes: MATERIAL_CODES,
      max: 256 * 1024,
      ask(tree, body) {
        const files = body.files === undefined ? undefined : strings(body.files, MATERIAL_MOST_FILES);
        if (body.files !== undefined && (!files || !files.length)) return bad(`files: 1 to ${MATERIAL_MOST_FILES} IDs of the material (I…)`);
        let args: string[];
        if (kind === "assign") {
          const batch = typeof body.batch === "string" && BATCH_ID.test(body.batch) ? body.batch : undefined;
          const add = strings(body.add, MATERIAL_MOST_PEOPLE);
          const remove = strings(body.remove, MATERIAL_MOST_PEOPLE);
          if ((files === undefined) === (batch === undefined) || (body.batch !== undefined && !batch)) return bad(`files: [I…] or batch: "<the batch's mark>" — one of them`);
          if (!add || !remove || !(add.length + remove.length)) return bad(`add, remove: up to ${MATERIAL_MOST_PEOPLE} people (P…), one of them not empty`);
          try {
            checkAsked(tree, { ...(batch ? { batch } : { files: files! }), add, remove });
          } catch (e) {
            return refusedAsked(e);
          }
          ids = files ?? [];
          args = ["input", "assign", ...(batch ? ["--batch", batch] : ["--files-from", "-"]), ...add.flatMap((p) => ["--add", p]), ...remove.flatMap((p) => ["--remove", p])];
        } else {
          if (!files) return bad(`files: 1 to ${MATERIAL_MOST_FILES} IDs of the material (I…)`);
          if (typeof body.hidden !== "boolean") return bad(`hidden: true (hide) or false (show again)`);
          const reason = body.reason === undefined || body.reason === null ? undefined : body.reason;
          if (reason !== undefined && !(HIDE_REASONS as readonly unknown[]).includes(reason)) return bad(`reason: ${HIDE_REASONS.join(" or ")}, or none`);
          try {
            checkAsked(tree, { files });
          } catch (e) {
            return refusedAsked(e);
          }
          ids = files;
          args = body.hidden ? ["input", "hide", "--files-from", "-", ...(reason ? ["--why", String(reason)] : [])] : ["input", "unskip", "--files-from", "-"];
        }
        // nothing can be written into the research here (unpacked read only, a copy of someone else's)
        if (!writableHere()) return { code: 403, body: refusal("nothing can be written into the research on this computer", "material.readonly") };
        this.stdin = ids.join("\n");
        return { args };
      },
      done(tree, data, head) {
        const files = Array.isArray(data.files) ? data.files.map(String) : ids;
        const kept = Array.isArray(data.kept) ? (data.kept as { id: string; person: string; batch: string }[]) : [];
        return { ...shown(tree, files, kept), ...(kind === "assign" ? { kept } : {}), head };
      },
      refused(_tree, code, why) {
        if (code === "material.body") return { code: 400, body: refusal(why, code) };
        if (code === "material.file" || code === "material.person" || code === "material.batch") return { code: 404, body: refusal(why, code) };
        if (code === "fs.no-permission" || code === "fs.sandboxed" || code === "git.unwritable" || code === "needs-consent") return { code: 403, body: { ...refusal(why, "material.readonly"), reasonCode: code } };
        return undefined;
      },
    };
  };
  /**
   * An event of history hidden at a place, a person or in the whole tree, or everything of a region, or shown again
   * (POST /history/hide {event, place} | {event, person} | {event, tree: true} | {region}, "do": "show"): strom history
   * hide|show, the person's choice as written in the app — an archive's too. An unknown place is no error (the app may
   * name one the research has no fact at). Answered with what is hidden now ({hidden: [{event, place|person|tree, at} |
   * {region, at}]}). Refused: 400 history.body, 404 history.event | history.person | history.region, 503 research.busy
   * (+ Retry-After).
   */
  const historyHide = (): AppWrite => {
    const bad = (why: string) => ({ code: 400, body: refusal(why, "history.body") });
    const EVENT = /^[\p{L}\p{N}][\p{L}\p{N}-]{0,79}$/u;
    return {
      what: "an event of history hidden or shown",
      codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        const shape = `{"event": "<its id>", "place": "<a place>"}, {"event", "person": "P…"}, {"event", "tree": true} or {"region": "<its id>"}, and "do": "show" to show it again`;
        if (body.do !== undefined && body.do !== "show" && body.do !== "hide") return bad(shape);
        const verb = body.do === "show" ? "show" : "hide";
        if (body.region !== undefined) {
          const region = typeof body.region === "string" ? body.region.trim() : "";
          if (!REGION_ID.test(region) || ["event", "place", "person", "tree"].some((k) => body[k] !== undefined)) return bad(shape);
          return { args: ["history", verb, `--region=${region}`] };
        }
        const event = typeof body.event === "string" ? body.event.trim() : "";
        if (!EVENT.test(event)) return bad(shape);
        const wheres = [body.place !== undefined, body.person !== undefined, body.tree !== undefined].filter(Boolean).length;
        if (wheres !== 1) return bad(shape);
        let where: string;
        if (body.place !== undefined) {
          if (!placeOk(body.place)) return bad(shape);
          where = `--place=${body.place.trim()}`;
        } else if (body.person !== undefined) {
          if (typeof body.person !== "string" || !/^P\d{1,9}$/iu.test(body.person.trim())) return bad(shape);
          where = `--person=${body.person.trim().toUpperCase()}`;
        } else {
          if (body.tree !== true) return bad(shape);
          where = "--tree";
        }
        return { args: ["history", verb, event, where] };
      },
      done(_tree, data, head) {
        return { hidden: Array.isArray(data.hidden) ? data.hidden : [], head };
      },
      refused(_tree, code, why) {
        if (code === "history.body") return { code: 400, body: refusal(why, code) };
        if (code === "history.event" || code === "history.person" || code === "history.region") return { code: 404, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * An event of history deleted by the person, or restored (POST /history/delete {event}, "do": "restore"): strom history
   * delete|restore, the person's — a region's from its shared catalog (every tree on this computer), a local one (L…)
   * from this tree; never written again by the research until restored (R4; nothing spent, always undone). Answered
   * with the person's deletions now ({event, scope, deleted: [...]} as GET /history `deleted`). Refused: 400
   * history.body, 404 history.event, 409 history.retracted (taken back by the research), 503 research.busy (+ Retry-After).
   */
  const historyDelete = (): AppWrite => {
    const bad = () => ({ code: 400, body: refusal(`the body: {"event": "<its id>"}, and "do": "restore" to bring it back`, "history.body") });
    const EVENT = /^[\p{L}\p{N}][\p{L}\p{N}-]{0,79}$/u;
    return {
      what: "an event of history deleted or restored",
      codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        if (Object.keys(body).some((k) => k !== "event" && k !== "do")) return bad();
        if (body.do !== undefined && body.do !== "restore" && body.do !== "delete") return bad();
        const event = typeof body.event === "string" ? body.event.trim() : "";
        if (!EVENT.test(event)) return bad();
        return { args: ["history", body.do === "restore" ? "restore" : "delete", event] };
      },
      done(_tree, data, head) {
        return { event: data.event, scope: data.scope, deleted: Array.isArray(data.deleted) ? data.deleted : [], head };
      },
      refused(_tree, code, why) {
        if (code === "history.body") return { code: 400, body: refusal(why, code) };
        if (code === "history.event") return { code: 404, body: refusal(why, code) };
        if (code === "history.retracted") return { code: 409, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * A finding of the app's validation marked no error by the person, or taken back (POST /quality/dismiss {kind, persons,
   * subject?, do?: "undo"}): strom quality dismiss|undo, written by "app". Answered {ok, rev}. Refused: 400 quality.body,
   * 404 person.no-match {person}, 503 research.busy (+ Retry-After).
   */
  const qualityDismiss = (): AppWrite => {
    const bad = (why: string) => ({ code: 400, body: refusal(why, "quality.body") });
    return {
      what: "a finding marked no error",
      codes: { badBody: "quality.body", busy: "research.busy", failed: "quality.failed" },
      busyStatus: 503,
      ask(tree, body) {
        if (Object.keys(body).some((k) => !["kind", "persons", "subject", "do"].includes(k))) return bad(`the body: {"kind", "persons": ["P…"], "subject"?, "do"?: "undo"}`);
        if (body.do !== undefined && body.do !== "undo" && body.do !== "dismiss") return bad(`"do": "undo" takes a mark back`);
        let ask;
        try {
          ask = askOf(tree, body.kind, body.persons, body.subject);
        } catch (e) {
          const err = e as { code?: string; params?: Record<string, string>; message: string };
          if (err.code === "person.no-match") return { code: 404, body: refusal(err.message, err.code, err.params ?? {}) };
          return bad(err.message);
        }
        return { args: ["quality", body.do === "undo" ? "undo" : "dismiss", ...(ask.subject ? [`--subject=${ask.subject}`] : []), "--", ask.kind, ...ask.persons] };
      },
      done(tree) {
        return { ok: true, rev: qualityRev(tree) };
      },
      refused(_tree, code, why) {
        if (code === "quality.body") return bad(why);
        const person = /P\d{1,9}/u.exec(why)?.[0];
        if (code === "person.no-match") return { code: 404, body: refusal(why, code, person ? { person } : {}) };
        return undefined;
      },
    };
  };

  /**
   * Pairs the app shows as possible duplicates, judged (POST /duplicates {pairs}): read only — the Strom app's or not.
   * Answered {rev, verdicts}. Refused: 400 duplicates.body, 503 research.busy (+ Retry-After) while it is being written.
   */
  const duplicates = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const json = (code: number, body: unknown, retry?: number) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
    };
    const max = 128 * 1024;
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size <= max) chunks.push(c);
    });
    req.on("end", () =>
      safely(req, res, () => {
        const text = Buffer.concat(chunks).toString("utf8");
        // a JSON object {"pairs": …} only (the terminal's lines of two IDs are strom person compare's)
        const pairs = size > max || !text.trim().startsWith("{") ? undefined : pairsOf(text);
        if (!pairs) return json(400, refusal(`the body: {"pairs": [["P…", "P…"], …]}, at most ${PAIRS_MAX} pairs`, "duplicates.body"));
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname()))) return json(503, { ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }, 5);
        const tree = Tree.open(root, env);
        json(200, { rev: qualityRev(tree), verdicts: judgePairs(tree, pairs) });
      }),
    );
  };

  /**
   * No history of a region or at a place in this research, or looked for again (POST /history/skip {region} | {place},
   * "do": "undo"): strom history skip|unskip, the person's. Answered with the skips now ({skip: {regions: [id…], places:
   * [place…]}}). Refused: 400 history.body, 404 history.region (no place of the tree in it) | history.place (no fact
   * writes it), 503 research.busy (+ Retry-After).
   */
  const historySkip = (): AppWrite => {
    const bad = () => ({ code: 400, body: refusal(`the body: {"region": "<its id>"} or {"place": "<a place>"}, and "do": "undo" to look for it again`, "history.body") });
    return {
      what: "history skipped or looked for again",
      codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        if (Object.keys(body).some((k) => k !== "region" && k !== "place" && k !== "do")) return bad();
        if (body.do !== undefined && body.do !== "undo" && body.do !== "skip") return bad();
        if ((body.region === undefined) === (body.place === undefined)) return bad();
        const verb = body.do === "undo" ? "unskip" : "skip";
        if (body.region !== undefined) {
          const region = typeof body.region === "string" ? body.region.trim() : "";
          if (!REGION_ID.test(region)) return bad();
          return { args: ["history", verb, `--region=${region}`] };
        }
        if (!placeOk(body.place)) return bad();
        return { args: ["history", verb, `--place=${body.place.trim()}`] };
      },
      done(_tree, data, head) {
        const skip = (data.skip ?? {}) as { regions?: unknown; places?: unknown };
        return { skip: { regions: Array.isArray(skip.regions) ? skip.regions : [], places: Array.isArray(skip.places) ? skip.places : [] }, head };
      },
      refused(_tree, code, why) {
        if (code === "history.body") return { code: 400, body: refusal(why, code) };
        if (code === "history.region" || code === "history.place") return { code: 404, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * A place's regions as the person knows them (POST /history/map {place, regions: [{id, from?, to?}]}), the place
   * determined again by the research ({place, redo: true, note?}) or back to what it determined ({place, do: "auto"}):
   * strom history assign, the person's — the research never maps a place so assigned. The note: one line of at most 200
   * characters after NFC, no broken characters. Answered with the place's entry ({place, map} — map null while it waits).
   * Refused: 400 history.body, 404 history.region (no catalog) | history.place (no fact writes it), 503 research.busy.
   */
  const historyMap = (): AppWrite => {
    const bad = (why = `the body: {"place", "regions": [{"id", "from"?, "to"?}]}, {"place", "redo": true, "note"?} or {"place", "do": "auto"}`) => ({ code: 400, body: refusal(why, "history.body") });
    const year = (v: unknown) => v === undefined || (typeof v === "number" && Number.isInteger(v) && v >= 100 && v <= 9999);
    return {
      what: "a place's regions",
      codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        if (Object.keys(body).some((k) => !["place", "regions", "redo", "note", "do"].includes(k))) return bad();
        if (!placeOk(body.place)) return bad();
        const place = body.place.trim();
        const ways = [body.regions !== undefined, body.redo !== undefined, body.do !== undefined].filter(Boolean).length;
        if (ways !== 1 || (body.note !== undefined && body.redo === undefined)) return bad();
        if (body.do !== undefined) {
          if (body.do !== "auto") return bad();
          return { args: ["history", "assign", "--auto", "--", place] };
        }
        if (body.redo !== undefined) {
          if (body.redo !== true) return bad();
          if (body.note === undefined || body.note === null) return { args: ["history", "assign", "--redo", "--", place] };
          if (typeof body.note !== "string") return bad();
          let note: string;
          try {
            note = checkNote(body.note);
          } catch (e) {
            return bad(e instanceof Error ? e.message : String(e));
          }
          return { args: ["history", "assign", "--redo", ...(note ? [`--note=${note}`] : []), "--", place] };
        }
        const regions = body.regions;
        if (!Array.isArray(regions) || !regions.length || regions.length > 20) return bad();
        const specs: string[] = [];
        for (const g of regions as unknown[]) {
          if (!g || typeof g !== "object" || Array.isArray(g)) return bad();
          const { id, from, to, ...rest } = g as Record<string, unknown>;
          if (Object.keys(rest).length || typeof id !== "string" || !REGION_ID.test(id) || !year(from) || !year(to)) return bad();
          if (typeof from === "number" && typeof to === "number" && to < from) return bad(`${id}: the later year first`);
          specs.push(`--region=${id}${from !== undefined || to !== undefined ? `:${from ?? ""}-${to ?? ""}` : ""}`);
        }
        return { args: ["history", "assign", ...specs, "--", place] };
      },
      done(_tree, data, head) {
        return { place: data.place, map: data.map ?? null, head };
      },
      refused(_tree, code, why) {
        if (code === "history.body" || code === "history.region.years") return { code: 400, body: refusal(why, "history.body") };
        if (code === "history.region" || code === "history.place") return { code: 404, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * A region's history first of the regions (POST /history/first {region}): strom history first, the person's word from
   * the app's person card — still at history's next turn. Refused: 400 history.body; 409 history.off with the link that
   * turns it on (the person's alone, in the terminal), 409 history.archive | history.done | history.skipped (the person
   * skipped the region: their word stays until they take it back, POST /history/skip "do": "undo"); 404 history.region; 503
   * research.busy (+ Retry-After).
   */
  const historyFirst = (): AppWrite => {
    const REGION = REGION_ID;
    return {
      what: "a region's history first",
      codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        const keys = Object.keys(body);
        const region = typeof body.region === "string" ? body.region.trim() : "";
        if (keys.some((k) => k !== "region") || !REGION.test(region)) return { code: 400, body: refusal(`the body: {"region": "<its id>"}`, "history.body") };
        return { args: ["history", "first", region] };
      },
      done(_tree, data, head) {
        return { region: data.region, ...(data.task ? { task: data.task } : {}), first: Array.isArray(data.first) ? data.first : [], head };
      },
      refused(tree, code, why) {
        if (code === "history.off") {
          const link = linkText({ action: "experiment", tree: tree.config.id, name: "history", do: "on" }, linkScheme(env));
          return { code: 409, body: { ...refusal(why, code), link } };
        }
        if (code === "history.archive" || code === "history.done" || code === "history.skipped") return { code: 409, body: refusal(why, code) };
        if (code === "history.region") return { code: 404, body: refusal(why, code) };
        if (code === "history.body") return { code: 400, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * The history of a place and its surroundings asked for (POST /history/place {place: "L…"}): it spends the agent's
   * session and the bridge cannot tell the app from an agent, so it is never started here — always 403 history.link
   * with the link that asks the person in the terminal (strom-research://history?tree=…&place=L…&do=search: the
   * estimate, yes or no, the task on top of the queue). A place looked for already: the same (looked for again).
   * Refused before: 400 history.body (only the record's ID, never its name), 404 history.place (no such record), 409
   * history.off (+ the link that turns the history on), 409 history.archive (nobody researches here).
   */
  const historyPlace = (): AppWrite => ({
    what: "a place's history",
    codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
    busyStatus: 503,
    ask(tree, body) {
      const keys = Object.keys(body);
      const place = typeof body.place === "string" ? body.place.trim().toUpperCase() : "";
      if (keys.some((k) => k !== "place") || !/^L\d{1,9}$/u.test(place)) return { code: 400, body: refusal(`the body: {"place": "<L…>"}`, "history.body") };
      if (actsAsArchive(tree)) return { code: 409, body: refusal("nobody researches here: nothing of history is looked for", "history.archive") };
      const settings = new Settings(env, {});
      if (!historyOn(tree, settings)) {
        const link = linkText({ action: "experiment", tree: tree.config.id, name: "history", do: "on" }, linkScheme(env));
        return { code: 409, body: { ...said(tree.lang, "ui.experiments.link"), code: "history.off", link } };
      }
      if (!placeRecord(tree, place)) return { code: 404, body: refusal(`there is no place ${place} in this research`, "history.place") };
      const link = linkText({ action: "history", tree: tree.config.id, place, do: "search" }, linkScheme(env));
      return { code: 403, body: { ...said(tree.lang, "ui.history.place.link"), link, estimate: placeEstimate(tree) } };
    },
    done(_tree, data) {
      return data;
    },
    refused() {
      return undefined;
    },
  });

  /**
   * The experiments of this research as the app turns them (POST /experiments): {"history": false} turns the history of
   * the places off for this tree (strom config set experiments.history off --for-tree; the person's own config stays).
   * Turning it on is the person's alone, in the terminal: refused 403 experiments.link with the link that opens it
   * (strom-research://experiment?tree=…&name=history&do=on, in this installation's scheme). 400 experiments.body.
   */
  const experimentsWrite = (): AppWrite => {
    let before = "";
    let field = "history";
    return {
      what: "the experiments of the research",
      codes: { badBody: "experiments.body", busy: "research.busy", failed: "experiments.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        const name = keys.length === 1 && (keys[0] === "history" || keys[0] === "historyPlaces") ? keys[0] : undefined;
        if (!name || typeof body[name] !== "boolean") return { code: 400, body: refusal(`the body: {"history": false} or {"historyPlaces": false}`, "experiments.body") };
        field = name;
        if (body[name]) {
          const link = linkText({ action: "experiment", tree: tree.config.id, name: name === "history" ? "history" : "places", do: "on" }, linkScheme(env));
          return { code: 403, body: { ...said(tree.lang, "ui.experiments.link"), link } };
        }
        before = head(root);
        const key = name === "history" ? "experiments.history" : "experiments.historyPlaces";
        const off = name === "history" ? tree.config.experimentsHistory === "off" : tree.config.experimentsHistoryPlaces === "off" || !new Settings(env, {}).historyPlacesAuto(tree.config);
        if (off) return { code: 200, body: { experiments: { [name]: false }, head: before, parent: before } };
        return { args: ["config", "set", key, "off", "--for-tree"] };
      },
      done(_tree, _data, h) {
        return { experiments: { [field]: false }, head: h, parent: before };
      },
      refused() {
        return undefined;
      },
    };
  };

  /**
   * The history of the places in the stories as the app turns it (POST /stories {"history": false|true}): for this tree
   * (strom config set stories.history no|yes --for-tree; the person's own config stays) — both ways, nothing spent by
   * it (the stories are written anyway), an approved story never rewritten for it. On while the history of the places
   * is off: refused 409 history.off with the link that turns that on (the person's alone, in the terminal). 400 stories.body.
   */
  const storiesWrite = (): AppWrite => {
    let before = "";
    let on = false;
    return {
      what: "the stories of the research",
      codes: { badBody: "stories.body", busy: "research.busy", failed: "stories.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        if (!keys.length || keys.some((k) => k !== "history") || typeof body.history !== "boolean") return { code: 400, body: refusal(`the body: {"history": false} or {"history": true}`, "stories.body") };
        on = body.history;
        const settings = new Settings(env, {});
        if (on && !historyOn(tree, settings)) {
          const link = linkText({ action: "experiment", tree: tree.config.id, name: "history", do: "on" }, linkScheme(env));
          return { code: 409, body: { ...said(tree.lang, "ui.experiments.link"), code: "history.off", link } };
        }
        before = head(root);
        if (settings.storyHistory(tree.config) === on) return { code: 200, body: { stories: { history: on }, head: before, parent: before } };
        return { args: ["config", "set", "stories.history", on ? "yes" : "no", "--for-tree"] };
      },
      done(_tree, _data, h) {
        return { stories: { history: on }, head: h, parent: before };
      },
      refused() {
        return undefined;
      },
    };
  };

  /** A write of the app's the research cannot take as asked (checkAsked): its code, the HTTP status the app reads it by. */
  const refusedAsked = (e: unknown): { code: number; body: Record<string, unknown> } => {
    if (!(e instanceof StromError) || !e.code) throw e;
    return { code: e.code === "material.body" ? 400 : 404, body: refusal(e.message, e.code, e.params ?? {}) };
  };
  /** Whether the research can be written here at all: its history, its records, its locks. */
  const writableHere = (): boolean => {
    try {
      for (const d of [".git", "data", ".strom"]) fs.accessSync(path.join(root, d), fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * GET /media/<sha>?thumb=128|256|512: a small preview of a file of the material (core/thumbs.ts) — kept, else made by
   * a strom of its own (two at a time; the same one asked twice made once). 410 media.gone (the file not here), 415
   * thumb.type (no preview of this kind here: the app shows its icon), 503 thumb.busy (too many waiting), 500.
   */
  const THUMBS_AT_ONCE = 2;
  const THUMBS_WAITING = 400;
  const THUMB_MS = 90_000;
  let thumbsMaking = 0;
  const thumbsWaiting: (() => void)[] = [];
  const thumbsAsked = new Map<string, ((r: { code: number; file?: string; body?: Record<string, unknown> }) => void)[]>();
  const giveThumb = (req: http.IncomingMessage, res: http.ServerResponse, known: { id: string; file?: string }, sha: string, px: number) => {
    const json = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(code === 503 ? { "Retry-After": "5" } : {}) }).end(JSON.stringify(body));
    };
    const send = (file: string) => {
      let size: number;
      try {
        size = fs.statSync(file).size;
      } catch (e) {
        return failed(req, res, e);
      }
      res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": String(size), "Cache-Control": "private, max-age=86400" });
      fs.createReadStream(file).on("error", (e) => failed(req, res, e)).pipe(res);
    };
    if (!known.file || !fs.existsSync(known.file)) return json(410, { known: known.id, ...refusal("its file is not on this computer", "media.gone", { known: known.id }) });
    const have = cachedThumb(root, sha, px);
    if (have) return send(have);
    const key = `${sha}-${px}`;
    const answer = (r: { code: number; file?: string; body?: Record<string, unknown> }) => (r.file ? send(r.file) : json(r.code, r.body ?? {}));
    const asked = thumbsAsked.get(key);
    if (asked) return void asked.push(answer);
    if (thumbsWaiting.length >= THUMBS_WAITING) return json(503, { ...refusal("too many previews asked at once — ask again in a moment", "thumb.busy"), retry: 5 });
    thumbsAsked.set(key, [answer]);
    const done = (r: { code: number; file?: string; body?: Record<string, unknown> }) => {
      const all = thumbsAsked.get(key) ?? [];
      thumbsAsked.delete(key);
      thumbsMaking--;
      thumbsWaiting.shift()?.();
      for (const a of all) a(r);
    };
    const make = () => {
      thumbsMaking++;
      const { command, args } = stromLauncher();
      const child = spawn(command, [...args, "media", "thumb", sha, "--px", String(px), "--json"], { cwd: root, env: forApp(env, root), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      track(child);
      let out = "";
      child.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
      child.stderr.on("data", () => {
        // said by its --json
      });
      const timer = setTimeout(() => child.kill(), THUMB_MS);
      let ended = false;
      const end = (r: { code: number; file?: string; body?: Record<string, unknown> }) => {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        done(r);
      };
      child.on("error", (e) => end({ code: 500, body: refusal(errorText(e), "thumb.failed") }));
      child.on("close", (code) => {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(out) as Record<string, unknown>;
        } catch {
          // said by the exit code
        }
        const file = typeof data.file === "string" ? data.file : undefined;
        if (code === 0 && file) return end({ code: 200, file });
        const why = String(data.message ?? `exit ${code}`);
        if (data.code === "thumb.type") return end({ code: 415, body: refusal(why, "thumb.type") });
        if (data.code === "media.gone") return end({ code: 410, body: { known: known.id, ...refusal(why, "media.gone", { known: known.id }) } });
        noteLive(root, `the preview of ${known.id} was not made: ${why}`);
        end({ code: 500, body: refusal(why, "thumb.failed") });
      });
    };
    if (thumbsMaking < THUMBS_AT_ONCE) make();
    else thumbsWaiting.push(make);
  };

  /** A part of the address, decoded (one that is not URI-encoded: none). */
  const decoded = (part: string | undefined): string => {
    try {
      return decodeURIComponent(part ?? "");
    } catch {
      return "";
    }
  };
  /**
   * The phone connection (core/phone.ts): this computer's, said the same by every bridge of it. GET phone — its state
   * (its server started again when on and gone); GET phone/qr.svg — the code to pair a phone (409 `phone.off`). From the
   * app's pages only: POST phone/on {"lang"} — the person asked in a window of the system, not waited for (`confirm`;
   * none can be shown here: `off` with the error `no-dialog`); POST phone/off — by anyone, a window that waits closed;
   * POST phone/remove/<id> (404 `phone.unknown`) and, a moment after, phone/restore/<id> (404 `phone.gone`).
   */
  const PHONE_EXPOSE = "X-Strom-Pair-Expires, X-Strom-Pair-Url";
  const PHONE_RESTORE_MS = 15_000;
  const phonesTakenOff = new Map<string, { phone: PairedPhone; at: number }>();
  let phoneRevived = 0;
  const phoneJson = (res: http.ServerResponse, code: number, body: unknown) => {
    if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Expose-Headers": PHONE_EXPOSE }).end(JSON.stringify(body));
  };
  const phoneNow = async () => {
    // on, its server gone: started again (once in ten seconds), a moment given to say its addresses
    if (phoneConfig(env).on && !phoneRunning(env) && Date.now() - phoneRevived > 10_000) {
      phoneRevived = Date.now();
      revivePhone(env);
      for (let i = 0; i < 20 && !phoneRunning(env); i++) await new Promise((r) => setTimeout(r, 100));
    }
    return { ...phoneState(env), ...phoneProbe(env) };
  };
  const phone = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, sub: string | undefined, act: string | undefined) => {
    if (req.method === "GET") {
      req.resume();
      if (!sub) return void phoneNow().then((s) => phoneJson(res, 200, s), (e) => failed(req, res, e));
      if (sub === "qr.svg" && !act) {
        const s = phoneState(env);
        if (s.state !== "on") return phoneJson(res, 409, refusal("the phone connection is off", "phone.off"));
        if (!s.addresses.length) return phoneJson(res, 503, { ...refusal("the phone's server is starting: asked again in a moment", "phone.starting"), retry: 1 });
        const q = new URL(req.url ?? "/", "http://127.0.0.1").searchParams;
        // an address of the server now (a Wi-Fi's or a cable's), the first unless another is asked
        const asked = q.get("address");
        const address = asked ? s.addresses.find((a) => a.url === asked.replace(/\/+$/, ""))?.url : s.addresses[0]!.url;
        if (!address) return phoneJson(res, 404, refusal(`no address of the phone's server: ${asked} (GET phone says them)`, "phone.address", { addresses: s.addresses.map((a) => a.url).join(" ") }));
        const lang = q.get("lang")?.toLowerCase();
        const { code, expiresAt } = pairCode(env, { tree: readJsonIfExists<TreeConfig>(path.join(root, TREE_FILE))?.id });
        noteLive(root, `the phone connection: a QR code to pair a phone shown (${address}, until ${expiresAt})`);
        phoneSummarySeen = undefined;
        res
          .writeHead(200, {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
            "X-Strom-Pair-Expires": expiresAt,
            "X-Strom-Pair-Url": address,
            "Access-Control-Expose-Headers": PHONE_EXPOSE,
          })
          .end(qrSvg(pairUrl(address, code, lang && /^[a-z]{2,3}$/.test(lang) ? lang : undefined)));
        return;
      }
      return phoneJson(res, 404, refusal("no such address of the phone", "phone.not-found"));
    }
    if (!origin) {
      req.resume();
      return phoneJson(res, 403, refusal("only the Strom app may ask this here", "app.only"));
    }
    let text = "";
    req.on("data", (c: Buffer) => {
      if (text.length < 4096) text += c.toString("utf8");
    });
    req.on("end", () => safely(req, res, () => {
      phoneSummarySeen = undefined;
      if (sub === "on" && !act) {
        let lang: string | undefined;
        try {
          const said = (JSON.parse(text || "{}") as { lang?: unknown }).lang;
          if (typeof said === "string" && /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?$/.test(said)) lang = said.slice(0, 2).toLowerCase();
        } catch {
          // the research's language
        }
        const how = askPhoneOn(env, lang ?? Tree.open(root, env).lang);
        noteLive(root, `the phone connection: asked to turn it on — ${how === "confirm" ? "a window asks the person" : how === "on" ? "on already" : "no window can be shown here"}`);
        if (how === "no-dialog") return phoneJson(res, 200, { ...phoneState(env), state: "off", error: { code: "no-dialog", detail: "no window of the system can be shown on this computer: strom phone on in a terminal" } });
        return phoneJson(res, 200, phoneState(env));
      }
      if (sub === "off" && !act) {
        const run = phoneRunning(env);
        const how = stopPhone(env, "the Strom app", { waitMs: 0 });
        if (run && how !== "none") endPhoneLater(env, run.pid);
        noteLive(root, `the phone connection: turned off (${how === "none" ? "no server ran" : `its server ${run?.pid} ends`})`);
        return phoneJson(res, 200, { ...phoneState(env), state: "off" });
      }
      if ((sub === "remove" || sub === "restore") && act) {
        const id = decoded(act).slice(0, 40);
        const now = Date.now();
        for (const [k, v] of phonesTakenOff) if (now - v.at > PHONE_RESTORE_MS) phonesTakenOff.delete(k);
        if (sub === "remove") {
          const gone = removePhone(env, id);
          if (!gone) return phoneJson(res, 404, refusal(`no paired phone ${id}`, "phone.unknown", { id }));
          phonesTakenOff.set(id, { phone: gone, at: now });
          noteLive(root, `the phone ${id} taken off the paired ones`);
        } else {
          const taken = phonesTakenOff.get(id);
          if (!taken) return phoneJson(res, 404, refusal(`the phone ${id} cannot be put back now: pair it again`, "phone.gone", { id }));
          phonesTakenOff.delete(id);
          restorePhone(env, taken.phone);
          noteLive(root, `the phone ${id} put back`);
        }
        return phoneJson(res, 200, { phones: phoneState(env).phones });
      }
      phoneJson(res, 404, refusal("no such address of the phone", "phone.not-found"));
    }));
  };

  /** The items of one place of What waits (group.key), as /status says them. */
  const groupItems = (tree: Tree, key: string) => waitingFor(tree, { shared: new Settings(env, {}).shared()?.value, stories: false }).filter((w) => w.item.group.key === key);
  /** A sent or not sent from the app: "sent" or "unsent", else none. */
  const sentWord = (body: Record<string, unknown>): "sent" | "unsent" | undefined => (body.do === "sent" || body.do === "unsent" ? body.do : undefined);
  /** The command's refusal of a request marked sent, as the app is told it. */
  const sentRefused = (code: string, why: string, id: string): { code: number; body: Record<string, unknown> } | undefined =>
    code === "task.not-waiting" || code === "task.none"
      ? { code: 404, body: refusal(why, "waiting.none", { id }) }
      : code === "task.not-sendable"
        ? { code: 409, body: refusal(why, "waiting.not-sendable", { id }) }
        : undefined;

  /** POST /waiting/<T…> {"do": "sent" | "unsent"}: strom task sent T… [--undo], the user's — a fact, not a decision. */
  const waitingWrite = (raw: string): AppWrite => {
    const id = /^[Tt]\d{1,9}$/.test(raw) ? normId(raw, "task") : raw.slice(0, 32);
    let said: "sent" | "unsent" = "sent";
    return {
      what: `${id} sent`,
      ask(tree, body) {
        const word = sentWord(body);
        if (!word) return { code: 400, body: refusal(`the body: JSON {"do": "sent" | "unsent"}`, "waiting.bad-body") };
        said = word;
        const t = /^T\d+$/.test(id) ? tree.get<Task>(id) : undefined;
        if (!t || t.type !== "task" || t.retracted || t.state !== "waiting") return { code: 404, body: refusal(`${id} is no task that waits`, "waiting.none", { id }) };
        const kind = waitKindOf(t);
        if (!SENDABLE.includes(kind)) return { code: 409, body: refusal(`${id} waits for no request to send (kind ${kind})`, "waiting.not-sendable", { id, kind }) };
        return { args: ["task", "sent", id, ...(word === "unsent" ? ["--undo"] : [])] };
      },
      done(tree, data, head) {
        const t = tree.get<Task>(id);
        const marked = Array.isArray(data.marked) ? data.marked.map(String) : [];
        return { [said]: marked, task: id, ...(t ? { phase: waitPhaseOf(t) } : {}), head };
      },
      refused: (_tree, code, why) => sentRefused(code, why, id),
    };
  };

  /**
   * POST /group/<key> {"do": "sent"} — every item of the place still to be sent (a letter, the family, other) marked
   * sent: {sent: [those it marked], head}; {"do": "unsent", "tasks": [T…]} — only those of them that are of the place and
   * sent taken back (never "the last send" made out of the state: the app sends back the list the sent answered).
   */
  const groupWrite = (key: string): AppWrite => {
    let said: "sent" | "unsent" = "sent";
    return {
      what: `${key.slice(0, 60)} sent`,
      ask(tree, body) {
        const word = sentWord(body);
        const listed = Array.isArray(body.tasks) ? body.tasks.filter((x): x is string => typeof x === "string" && /^[Tt]\d{1,9}$/.test(x)).map((x) => normId(x, "task")) : [];
        if (!word || (word === "unsent" && !listed.length)) return { code: 400, body: refusal(`the body: JSON {"do": "sent"} or {"do": "unsent", "tasks": ["T…"]}`, "waiting.bad-body") };
        said = word;
        const items = groupItems(tree, key);
        if (!key || !items.length) return { code: 404, body: refusal(`nothing waits at ${key.slice(0, 80) || "that place"}`, "group.none", { group: key.slice(0, 80) }) };
        const ids = items
          .filter((w) => w.task && SENDABLE.includes(w.item.kind as WaitKind) && (word === "sent" ? w.item.phase === "todo" : w.item.phase === "sent" && listed.includes(w.task.id)))
          .map((w) => w.task!.id);
        if (!ids.length) {
          const h = head(root);
          return { code: 200, body: { [word]: [], group: key, head: h, parent: h } };
        }
        return { args: ["task", "sent", ...ids, ...(word === "unsent" ? ["--undo"] : [])] };
      },
      done(_tree, data, head) {
        const marked = Array.isArray(data.marked) ? data.marked.map(String) : [];
        return { [said]: marked, group: key, head };
      },
      refused: (_tree, code, why) => sentRefused(code, why, key.slice(0, 80)),
    };
  };

  /** GET /group/<key>/note: the request texts of the place's waiting tasks joined for one e-mail — each file once. */
  const groupNote = (key: string): { code: number; body: Record<string, unknown> } => {
    const tree = Tree.open(root, env);
    const items = key ? groupItems(tree, key) : [];
    if (!items.length) return { code: 404, body: refusal(`nothing waits at ${key.slice(0, 80) || "that place"}`, "group.none", { group: key.slice(0, 80) }) };
    return { code: 200, body: { ...requestTexts(tree, items.filter((w) => w.task).map((w) => w.task!)) } };
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
        const ended = before && tries === 0 ? endBridge(before, root, { why: `a new bridge (${process.pid}) takes port ${wanted}`, back: true }) : "gone";
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
      // its research gone: no strom.json there, or the .strom it was started with deleted (gone, or another one in its
      // place) — the bridge then ends and makes neither again (noteLive, writeLast make no folder)
      const dotStrom = folderId(path.join(root, ".strom"));
      const researchGone = () => !fs.existsSync(path.join(root, "strom.json")) || folderId(path.join(root, ".strom")) !== dotStrom;
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
      // the research on the desktop of a Mac (the Strom Widget): the tree's overview written while the bridge runs
      // (core/widget.ts; none off macOS) — the first a moment after the start, never in its way
      const widget = widgetWriter(root, env);
      if (widget) setTimeout(() => safe("the widget", () => widget.tick(true)), 1000).unref?.();
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
        send("end", { reason: "restart", back: true, at: new Date().toISOString() });
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
                  clearInterval(stopAsked);
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
      let incomingCleaned = 0;
      // what GET /history answers, looked at again at most once a minute while the app follows (its rev and the head)
      let historyChecked = 0;
      let historySeen: { rev: string; head: string } | undefined;
      // what GET /quality answered when the bridge began: a mark of the person while nobody followed is told at once
      let qualitySeen: string | undefined = qualityRev({ root }, "0000000");
      const HISTORY_MS = Number(env.STROM_LIVE_HISTORY_MS ?? 60_000);
      // the first a few minutes after it starts, then once a day
      let tidied = Date.now() - Number(env.STROM_TIDY_MS ?? 24 * 3600_000) + 5 * 60_000;
      const timer = setInterval(() => {
        // its research gone (taken off the computer, a test's folder, moved; its .strom deleted): nothing to follow —
        // even while handing over (found: bridges of a folder removed in the middle of it left running for hours)
        if (researchGone()) return stop("the research is no longer there", "gone", false);
        if (renewing) return;
        if (Date.now() - renewChecked > RENEW_MS) {
          renewChecked = Date.now();
          const disk = diskVersion(env);
          if (disk && disk.version !== runs && disk.version !== tried && !busy()) return renew(disk);
        }
        // a batch nobody said is whole: closed a day after its last file, a phone's an hour after (looked at once a minute)
        if (Date.now() - batchesChecked > Number(env.STROM_BATCH_CHECK_MS ?? 60_000)) {
          batchesChecked = Date.now();
          let idle: string[] = [];
          try {
            idle = idleBatches(root, Date.now(), env);
          } catch (e) {
            noteLive(root, `the batches could not be looked at: ${errorText(e)}`);
          }
          for (const id of idle) closeBatchNow(id, ["--idle"], (code) => noteLive(root, code === 200 ? `the batch ${id} closed: no file came for a while` : `the batch ${id} not closed now (${code})`));
        }
        // the files of uploads cut short a day ago (media/.incoming/*.part), once an hour
        if (Date.now() - incomingCleaned > 3600_000) {
          incomingCleaned = Date.now();
          const shared = new Settings(env, {}).shared()?.value;
          const gone = shared ? cleanIncoming(shared) : 0;
          if (gone) noteLive(root, `${counted(gone, "upload")} cut short a day ago removed (media/.incoming)`);
        }
        // what strom keeps beside the research in order, once a day (a tree tidied once; never while a send is written)
        if (Date.now() - tidied > Number(env.STROM_TIDY_MS ?? 24 * 3600_000) && !busy()) {
          tidied = Date.now();
          safe("keeping order", () => autoTidy(Tree.open(root, env)));
        }
        // the idle time runs only while nobody works in the tree (a run waiting for its gate works too): the app watching
        // the tree without following it (/status?poll=1) still finds the bridge while an agent is at work
        // the queue of the documents the app asked to be read (one at a time); what changed of the readings, for the event read
        const readsChanged = safe("the readings", () => reads.tick()) ?? [];
        if (streams.size || anyoneAtWork(root) || reads.active()) lastAsked = Date.now();
        if (Date.now() - lastAsked > idleMs) return stop("idle: nobody asked for a while", "idle", false);
        // its research gone (taken off the computer, a test's folder): nothing to follow
        if (researchGone()) return stop("the research is no longer there", "gone", false);
        safe("the widget", () => widget?.tick());
        if (!streams.size) return;
        safe("a tick", () => {
          const { head: h, at } = tip(root);
          if (h && h !== seen) {
            // when the commit was made: the same as in /log, so the app knows it has it; each new commit as /log gives it (its task)
            const entries = histories.since(Tree.open(root, env), seen ? [`-n${LOG_MAX}`, `${seen}..${h}`] : ["-1", h]);
            send("change", { head: h, what: subjects(root, seen, h), at: at ?? new Date().toISOString(), entries });
            seen = h;
          }
          for (const r of readsChanged) send("read", r);
          // what GET /history answers changed without a new commit (a catalog of the shared folder another tree's session
          // wrote): the event history {rev}; with a new commit the change said it already (the app reads /status again)
          if (Date.now() - historyChecked >= HISTORY_MS) {
            historyChecked = Date.now();
            const tree = Tree.open(root, env);
            const settings = new Settings(env, {});
            const rev = historyShown(tree, settings) ? historyRevNow(tree, settings, h, historyRev(tree, settings.shared()?.value, settings)) : undefined;
            if (rev && historySeen && historySeen.head === h && historySeen.rev !== rev) send("history", { rev });
            historySeen = rev ? { rev, head: h } : undefined;
          }
          // what GET /quality answers changed (the person marked a finding no error, or took it back): the event quality {rev}
          // (never while the research is being written: the file before its commit would be told with the head before it)
          if (!liveHolder(path.join(root, ".strom", "tree.lock"))) {
            const q = qualityRev({ root }, h || "0000000");
            if (qualitySeen !== undefined && q.slice(8) !== qualitySeen.slice(8)) send("quality", { rev: q });
            qualitySeen = q;
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
      // asked to end (strom live stop, a newer bridge wanted): the same on every system — a signal on Windows ends the
      // process unheard, and the app following it would learn the end only when it gives up asking
      const stopAsked = setInterval(() => {
        const ask = readStopAsk(root);
        if (ask?.pid !== process.pid) return;
        fs.rmSync(liveStopFile(root), { force: true });
        stop(ask.why, ask.back ? "restart" : "stopped", ask.back ?? false);
      }, Number(env.STROM_LIVE_STOP_MS ?? 200));
      // the end said to the app on its streams before they close: whether another bridge comes at this address (it goes
      // on following) or none (following ends now); a signal from outside: not known (the app asks /status)
      const stop = (why: string, reason: "stopped" | "restart" | "idle" | "gone" | "signal" = "stopped", back?: boolean) => {
        clearInterval(timer);
        clearInterval(keepAlive);
        clearInterval(stopAsked);
        safe("the widget", () => widget?.end(reason === "gone"));
        send("end", { reason, ...(back === undefined ? {} : { back }), at: new Date().toISOString() });
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
      process.once("SIGTERM", () => stop("SIGTERM", "signal"));
      process.once("SIGINT", () => stop("SIGINT", "signal"));
    });
  });
}
