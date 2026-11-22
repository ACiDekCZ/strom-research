// The queue of originals the app sends to be written later (PUT /media/<sha256> with Prefer: respond-async, feature
// media.queued): the bridge checks a file as it comes — its hash, its kind and that it is whole — keeps its bytes beside
// the shared store (media/.incoming/<sha>-<tag>-<rand>.queued) and a job for it in .strom/media-queue/, and answers at
// once (202). A strom of the bridge's (strom media queued, strom input batch done) takes the jobs under one hold of the
// tree's lock and one commit — a batch's files once the app says the batch is whole: one commit, one change, one tree
// made again for the app instead of one for each file. The jobs outlive the bridge (the next one takes them over); a job
// is removed only as its file is taken, and put back when the command that took it fails (its commit not made).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { UsageError } from "./errors.ts";
import type { Env } from "./paths.ts";
import type { Tree } from "./tree.ts";
import { fileSha256, sharedMediaPath } from "./media.ts";
import { knownOriginal, originalMax, ORIGINAL_TYPES, takeOriginal, type TakenOriginal } from "./originals.ts";
import { batchFileOf, batchFull, batchPath, batchRoom, noteBatch, openBatch, readBatch, type Batch, type BatchTaken } from "./batches.ts";
import { readEntry, readZip, type ZipEntry } from "./zip.ts";

/** One file waiting to be written. */
export interface QueueJob {
  v: 1;
  sha: string;
  /** Its bytes (media/.incoming/<sha>-<tag>-<rand>.queued). */
  file: string;
  /** Its name in the app. */
  name: string;
  persons: string[];
  families?: string[];
  note?: string;
  /** The batch it came in, its path there; a ZIP of the batch. */
  batch?: string;
  path?: string;
  zip?: boolean;
  /** Who sent it: the app's page and version. */
  client: { origin?: string; app?: string };
  /** When it came. */
  at: string;
  bytes: number;
}

/** A job and its file. */
export interface Queued {
  /** The job's file in .strom/media-queue. */
  at: string;
  job: QueueJob;
}

/** What became of one file taken from the queue (the answer of strom media queued and of the batch's close). */
export type TakenFile = BatchTaken;

export const queueDir = (root: string): string => path.join(root, ".strom", "media-queue");

/** The mark of a research in the names of its queued files (the shared store is many researches'). */
export function queueTag(treeId: string): string {
  return crypto.createHash("sha256").update(treeId).digest("hex").slice(0, 8);
}

/** The jobs waiting, the oldest first; none when the folder is not there. */
export function listJobs(root: string): Queued[] {
  const dir = queueDir(root);
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith(".json") && !n.startsWith("."));
  } catch {
    return [];
  }
  const out: Queued[] = [];
  for (const n of names.sort()) {
    try {
      const job = JSON.parse(fs.readFileSync(path.join(dir, n), "utf8")) as QueueJob;
      if (job && job.v === 1 && /^[0-9a-f]{64}$/.test(job.sha) && typeof job.file === "string") out.push({ at: path.join(dir, n), job });
    } catch {
      // being written (never: written whole), or gone meanwhile
    }
  }
  return out;
}

/** The jobs of a batch (null: those of no batch). */
export function jobsOf(root: string, batch: string | null): Queued[] {
  return listJobs(root).filter((q) => (batch === null ? !q.job.batch : q.job.batch === batch));
}

/** The files the queue holds by their hashes (GET /media, POST /media/known: queued, not the research's yet). */
export function queuedShas(root: string): Set<string> {
  return new Set(listJobs(root).map((q) => q.job.sha));
}

/** Whether a batch has files in the queue. */
export function batchQueued(root: string, batch: string): boolean {
  return jobsOf(root, batch).length > 0;
}

/** The same file of the same batch at the same path (a batch's), or the same file said of the same (else): one job. */
function sameJob(a: QueueJob, b: QueueJob): boolean {
  if (a.sha !== b.sha || (a.batch ?? "") !== (b.batch ?? "")) return false;
  if (a.batch) return (a.path ?? "") === (b.path ?? "");
  const set = (x: string[] | undefined) => [...new Set(x ?? [])].sort().join(",");
  return set(a.persons) === set(b.persons) && set(a.families) === set(b.families) && (a.note ?? "") === (b.note ?? "");
}

/**
 * A file checked whole (`part`, its hash, kind and end) put into the queue: its bytes renamed beside it as queued, its
 * job written whole. The same job waiting already: that one, the bytes not kept twice (`again`).
 */
export function enqueue(root: string, part: string, job: Omit<QueueJob, "v" | "file" | "at">, tag: string): { job: QueueJob; again: boolean } {
  const want: QueueJob = { v: 1, ...job, file: "", at: new Date().toISOString() };
  const had = listJobs(root).find((q) => sameJob(q.job, want) && fs.existsSync(q.job.file));
  if (had) {
    fs.rmSync(part, { force: true });
    return { job: had.job, again: true };
  }
  const rand = crypto.randomBytes(4).toString("hex");
  const file = path.join(path.dirname(part), `${job.sha}-${tag}-${rand}.queued`);
  fs.renameSync(part, file);
  const full: QueueJob = { ...want, file };
  const dir = queueDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const at = path.join(dir, `${Date.now()}-${job.sha.slice(0, 8)}-${rand}.json`);
  const tmp = path.join(dir, `.${path.basename(at)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, JSON.stringify(full));
    fs.renameSync(tmp, at);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    // never bytes without their job: back where they came from, the caller says what failed
    try {
      fs.renameSync(file, part);
    } catch {
      fs.rmSync(file, { force: true });
    }
    throw e;
  }
  return { job: full, again: false };
}

/** Bytes of the queue left without a job (a job taken and its bytes not, a bridge ended between): so old, removed. */
export const QUEUED_KEEP_MS = 24 * 60 * 60_000;

/**
 * The queued files of this research (its tag) no job names, a day old: removed. Never another research's (the shared
 * store is many researches'), never a link, never what is younger. Never fails; how many went.
 */
export function cleanQueued(shared: string, root: string, tag: string, now = Date.now()): number {
  const dir = path.join(shared, "media", ".incoming");
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith(`.queued`) && n.includes(`-${tag}-`));
  } catch {
    return 0;
  }
  if (!names.length) return 0;
  const named = new Set(listJobs(root).map((q) => path.basename(q.job.file)));
  let gone = 0;
  for (const n of names) {
    if (named.has(n)) continue;
    const f = path.join(dir, n);
    try {
      const s = fs.lstatSync(f);
      if (!s.isFile() || now - s.mtimeMs < QUEUED_KEEP_MS) continue;
      fs.rmSync(f, { force: true });
      gone++;
    } catch {
      // gone meanwhile
    }
  }
  return gone;
}

/** What one file of a batch became (strom media original --batch, a job of the queue). The caller holds the tree lock. */
export function takeBatchFile(tree: Tree, shared: string, env: Env, file: string, sha: string, o: { name: string; persons: string[]; batch: string; path: string; note?: string | undefined; phone?: boolean; zip?: boolean }): (TakenOriginal & { batch: string }) | { batch: string; zip: ZipTaken } {
  let b = openBatch(tree.root, o.batch, o.phone ? "phone" : undefined);
  if (!b.persons?.length && o.persons.length) b = { ...b, persons: o.persons };
  if (o.zip) return { batch: o.batch, zip: takeZip(env, tree, shared, file, o.path, b, o.persons) };
  const size = fs.statSync(file).size;
  const full = batchRoom(b, size, env);
  if (full) throw new UsageError(full.text, { code: full.code, params: full.params });
  try {
    const one = takeOriginal(tree, shared, file, sha, { name: path.basename(o.path), persons: o.persons, batch: o.batch, path: o.path, note: o.note, phone: !!o.phone });
    noteBatch(tree.root, b, one.known ? { known: one.known } : { input: one.input!, bytes: size });
    return { ...one, batch: o.batch };
  } catch (e) {
    if (e instanceof UsageError) noteBatch(tree.root, b, { refused: { path: o.path, why: e.message } });
    throw e;
  }
}

export interface ZipTaken {
  name: string;
  files: number;
  inputs: string[];
  known: string[];
  refused: { path: string; why: string }[];
  nested: string[];
}

/** A ZIP of a batch: each file in it taken as one of the batch (its path: the ZIP's name and its own); the ZIP not kept. */
export function takeZip(env: Env, tree: Tree, shared: string, file: string, zipPath: string, start: Batch, persons: string[]): ZipTaken {
  let entries: ZipEntry[];
  try {
    entries = readZip(file);
  } catch (e) {
    fs.rmSync(file, { force: true });
    throw new UsageError(`${path.basename(zipPath)}: ${(e as Error).message}`, { hint: "unpack it in the system and send the folder", code: "batch.zip-unreadable", params: { name: path.basename(zipPath) } });
  }
  const max = originalMax(env);
  let b = start;
  const out: ZipTaken = { name: zipPath, files: 0, inputs: [], known: [], refused: [], nested: [] };
  entries.forEach((e, n) => {
    const base = e.name.split("/").filter(Boolean).at(-1) ?? "";
    if (e.dir || e.link || e.name.startsWith("__MACOSX/") || base.startsWith(".") || base === "Thumbs.db" || base === "desktop.ini") return;
    const where = batchPath(`${zipPath}/${e.name}`)!;
    out.files++;
    const refuse = (why: string) => {
      out.refused.push({ path: where, why });
      b = noteBatch(tree.root, b, { refused: { path: where, why } });
    };
    if (/\.zip$/i.test(base)) {
      out.nested.push(where);
      b = noteBatch(tree.root, b, { nested: where });
      return;
    }
    if (e.size > max) return refuse(`larger than ${Math.round(max / 1024 / 1024)} MB`);
    const full = batchFull(b, e.size, env);
    if (full) return refuse(full);
    const tmp = `${file}.${n}`;
    try {
      fs.writeFileSync(tmp, readEntry(file, e));
      const one = takeOriginal(tree, shared, tmp, fileSha256(tmp), { name: base, persons, batch: b.id, path: where });
      if (one.known) {
        out.known.push(one.known);
        b = noteBatch(tree.root, b, { known: one.known });
      } else {
        out.inputs.push(one.input!);
        b = noteBatch(tree.root, b, { input: one.input!, bytes: e.size });
      }
    } catch (err) {
      refuse((err as Error).message);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
  fs.rmSync(file, { force: true });
  return out;
}

/**
 * The bytes of a job whose file is gone: a command that took it failed after its file went into the store (its commit
 * not made, the job put back) — the store's copy, copied back to be taken again; none: undefined.
 */
function bytesBack(shared: string, job: QueueJob): boolean {
  for (const t of ORIGINAL_TYPES) {
    for (const ext of [...t.ext, ".zip"]) {
      const kept = sharedMediaPath(shared, job.sha, ext);
      if (fs.existsSync(kept)) {
        fs.copyFileSync(kept, job.file);
        return true;
      }
    }
  }
  return false;
}

/**
 * Take the jobs waiting (a batch's, or with `batch` null those of no batch) — each as strom media original takes its file —
 * until `maxMs` passed or `maxFiles` were taken (one at least). A file refused is said (its code and why) and its bytes go;
 * the others go on. A file of no batch gets its intake task only with auto (intake.auto on, spec 130 K1.3). The caller
 * holds the tree lock and commits; a job is put back when the command fails.
 */
export function takeQueued(tree: Tree, shared: string, env: Env, o: { batch: string | null; maxMs?: number; maxFiles?: number; auto?: boolean }): { files: TakenFile[]; left: number } {
  const started = Date.now();
  const jobs = jobsOf(tree.root, o.batch);
  const files: TakenFile[] = [];
  const maxFiles = o.maxFiles ?? Infinity;
  const maxMs = o.maxMs ?? Infinity;
  let n = 0;
  for (const q of jobs) {
    if (n >= maxFiles || (n > 0 && Date.now() - started >= maxMs)) break;
    n++;
    const j = q.job;
    // put back as it is when the command fails (its commit not made): taken again by the next one — its batch's record too
    tree.remember(q.at);
    if (j.batch) tree.remember(batchFileOf(tree.root, j.batch));
    const said: TakenFile = { sha: j.sha, ...(j.path ? { path: j.path } : {}), ...(j.batch ? { batch: j.batch } : {}) };
    try {
      if (!fs.existsSync(j.file) && !bytesBack(shared, j)) {
        const k = knownOriginal(tree, shared, j.sha);
        if (!k) throw new UsageError(`${j.name}: its bytes are no longer here — send it again`, { code: "media.gone", params: { name: j.name } });
        said.known = k.id;
        if (j.batch) noteBatch(tree.root, openBatch(tree.root, j.batch), { known: k.id });
      } else if (j.batch) {
        const got = takeBatchFile(tree, shared, env, j.file, j.sha, { name: j.name, persons: j.persons, batch: j.batch, path: j.path ?? j.name, note: j.note, zip: !!j.zip });
        if ("zip" in got) said.zip = got.zip;
        else if (got.known) said.known = got.known;
        else said.input = got.input!;
      } else {
        const got = takeOriginal(tree, shared, j.file, j.sha, { name: j.name, persons: j.persons, ...(j.families?.length ? { families: j.families } : {}), note: j.note, auto: !!o.auto });
        if (got.known) said.known = got.known;
        else said.input = got.input!;
        if (got.added) said.added = got.added;
        if (got.task) said.task = got.task;
      }
    } catch (e) {
      if (!(e instanceof UsageError)) throw e;
      if (!tree.dryRun) fs.rmSync(j.file, { force: true });
      said.refused = { code: e.code ?? "media.refused", why: e.message };
    }
    if (!tree.dryRun) {
      fs.rmSync(q.at, { force: true });
      if (j.batch) noteBatch(tree.root, openBatchQuietly(tree.root, j.batch), { taken: said });
    }
    files.push(said);
  }
  return { files, left: jobs.length - n };
}

/** The batch to note what became of a file in: one closed meanwhile too (its record of what was taken). */
function openBatchQuietly(root: string, id: string): Batch {
  const t = new Date().toISOString();
  return readBatch(root, id) ?? { id, created: t, updated: t, inputs: [], known: [], bytes: 0, refused: [], nested: [] };
}
