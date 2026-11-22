// An original received (PUT /media/<sha256> of the bridge, PUT /phone/media/<sha256> of the phone's server): only so
// large and while there is room, streamed to a file beside the shared store (never all in memory), its SHA-256 checked,
// then taken by a strom of its own (strom media original) as the person's — the same content again is only said. Both
// servers receive by these, each checking first who may send (the Strom app's pages; a paired phone).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import type { ChildProcess } from "node:child_process";
import type { Env } from "./paths.ts";
import { withoutAgentMarks } from "./which.ts";
import { Tree } from "./tree.ts";
import { readTree } from "./readtree.ts";
import { Settings } from "./config.ts";
import { ui } from "../cli/ui.ts";
import { DISK_FULL, EXIT, isDiskFull, StromError } from "./errors.ts";
import { freeBytes, knownOriginal, originalMax, originalProblem, originalType, ORIGINAL_RESERVE } from "./originals.ts";
import { batchPath, batchRoom, noteBatch, openBatch } from "./batches.ts";
import { spawnRun, type RunStrom } from "./warmwriter.ts";
import { enqueue, queueTag, type QueueJob } from "./mediaqueue.ts";
import { foldText } from "./text.ts";
import type { Input, Source } from "./model.ts";
import { parseImageList } from "./media.ts";

/**
 * The environment of a strom a server runs for the person (a send written, the app's tree taken in, an original, a
 * batch closed): what it writes is the person's in the app or on the phone — never logged as an agent's or a session's,
 * whatever the server was started from (an agent's shell, a session that revived it). No question asked.
 */
export function forApp(env: Env, root: string): NodeJS.ProcessEnv {
  const { STROM_SESSION: _s, STROM_WORKER: _w, ...rest } = withoutAgentMarks(env) as NodeJS.ProcessEnv;
  return { ...rest, STROM_TREE: root, STROM_NONINTERACTIVE: "1", STROM_FOR_APP: "1", STROM_SPAWNED: "1" };
}

/**
 * The research's head after a write of a strom of its own and before it (its --json `commit`, written under the tree's
 * lock from its first read to its commit): the app takes `head` as its version only when `parent` is the head it knew.
 * The command's data without it, for an answer that passes its data on.
 */
export function committed(data: Record<string, unknown>, now: () => string | undefined): { data: Record<string, unknown>; head: string; parent?: string } {
  const { commit, ...rest } = data;
  const c = commit && typeof commit === "object" ? (commit as { head?: unknown; parent?: unknown }) : undefined;
  const head = typeof c?.head === "string" && c.head ? c.head : (now() ?? "");
  return { data: rest, head, ...(typeof c?.parent === "string" ? { parent: c.parent } : {}) };
}

/** A refusal: the English sentence (`error`, `text`) and its stable `code` with `params` (the codes: live.ts). */
export function refusal(error: string, code: string, params: Record<string, string> = {}): { error: string; code: string; text: string; params?: Record<string, string> } {
  return { error, code, text: error, ...(Object.keys(params).length ? { params } : {}) };
}
/** What a strom of its own said as it failed (its --json: message, code, params): the code it gave, else `fallback`. */
export function refusalOf(why: string, data: { code?: unknown; params?: unknown }, fallback: string): ReturnType<typeof refusal> {
  const params = data.params && typeof data.params === "object" ? Object.fromEntries(Object.entries(data.params as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : {};
  return refusal(why, typeof data.code === "string" && data.code ? data.code : fallback, params);
}
/**
 * No room on the disk as a write met it (core/errors.ts diskFull): the sentence in the research's language (`error`),
 * English (`text`), its code disk.full and the folder (`params.where`) — answered 507.
 */
export function diskFullSaid(lang: string, where: string): { error: string; code: string; text: string; params: Record<string, string> } {
  return { error: ui(lang, "ui.error.disk.full", { where }), code: DISK_FULL, text: ui("en", "ui.error.disk.full", { where }), params: { where } };
}

/** The folder a strom of its own named as it met a full disk (its params.where), else the research's. */
export function fullWhere(data: { params?: unknown }, root: string): string {
  const where = (data.params as { where?: unknown } | undefined)?.where;
  return typeof where === "string" && where ? where : root;
}

/** The research's language, English where it cannot be read. */
export function langOf(root: string, env: Env): string {
  try {
    return Tree.open(root, env).lang;
  } catch {
    return "en";
  }
}

/** Too large, no room: the sentence in the research's language (`error`), English (`text`) and the code. */
function said(lang: string, key: "ui.media.large" | "ui.media.full", params: Record<string, string> = {}): { error: string; code: string; text: string; params?: Record<string, string> } {
  return { error: ui(lang, key, params), code: key === "ui.media.large" ? "media.large" : "media.full", text: ui("en", key, params), ...(Object.keys(params).length ? { params } : {}) };
}

function errorText(e: unknown): string {
  return e instanceof Error ? (e.stack ?? `${e.name}: ${e.message}`) : String(e);
}

/** The server that receives: the tree, where it notes what went wrong, its children, and how it answers a failure. */
export interface Receiver {
  root: string;
  env: Env;
  note(text: string): void;
  /** A strom it started that writes (never started again under it). */
  track(child: ChildProcess): void;
  /** The tree's last commit after a write (the bridge's answers; none: not said). */
  head?(): string;
  safely(req: http.IncomingMessage, res: http.ServerResponse, fn: () => void): void;
  /** How it runs a strom of its own (the bridge: its warm writer); none: a strom started for each. */
  run?: RunStrom;
  /** A file it queued (Prefer: respond-async): its job, for the writer of the queue (the bridge's). */
  queued?(job: QueueJob): void;
}

/** What came with a file, checked by the server already. */
export interface Incoming {
  sha: string;
  name: string;
  note?: string | undefined;
  persons: string[];
  /** The couples it is of (X-Strom-Family, spec 108 V9). */
  families?: string[] | undefined;
  source?: string | undefined;
  region?: string | undefined;
  batch?: string | undefined;
  /** Its path in the batch. */
  where?: string | undefined;
  zip?: boolean;
  /** The waiting task it came for. */
  task?: string | undefined;
  /** For a task waiting for images of a book: the image's number (X-Strom-Image), and another scan there replaced. */
  image?: number | undefined;
  replace?: boolean;
  /** From a paired phone. */
  phone?: boolean;
  /** To be read at once (X-Strom-Read): an input with no intake task. */
  read?: boolean;
  /**
   * Answered once it is checked and queued (Prefer: respond-async, a file of a batch or of people only): 202, written
   * later by the bridge's writer of the queue (Receiver.queued) — with who sent it.
   */
  async?: { origin?: string | undefined; app?: string | undefined };
}

/** Answered with JSON — 503 is only "busy, send it again": always with when (Retry-After). */
export function replyJson(res: http.ServerResponse, code: number, body: Record<string, unknown>, headers: Record<string, string> = {}): void {
  if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(code === 503 ? { "Retry-After": "30" } : {}), ...headers }).end(JSON.stringify(body));
}

/** Whether a file begins as a ZIP does (a batch's ZIP queued: checked as it comes, unpacked as it is written). */
function zipHead(file: string): boolean {
  const b = Buffer.alloc(4);
  const fd = fs.openSync(file, "r");
  try {
    fs.readSync(fd, b, 0, 4, 0);
  } finally {
    fs.closeSync(fd);
  }
  return b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05);
}

/** How a server runs a strom of its own as the person's: its warm writer (the bridge's), else a strom started for it. */
const runOf = (r: Receiver): RunStrom => r.run ?? spawnRun(r.root, forApp(r.env, r.root), (c) => r.track(c));

/** Receive a file whose sender and headers were checked (see the top of this file). */
export function receiveOriginal(r: Receiver, req: http.IncomingMessage, res: http.ServerResponse, f: Incoming): void {
  const reply = (code: number, body: Record<string, unknown>) => replyJson(res, code, body);
  // refused before it is read: answered at once, the rest of the body read and thrown away — a connection closed
  // under a browser still sending is an error of the network to it, not the answer
  const refuse = (code: number, body: Record<string, unknown>) => {
    reply(code, body);
    req.resume();
  };
  const { sha, name, note, region, batch, where } = f;
  const zip = !!f.zip;
  // a NUL never reaches a program's argument (the file would wait in .incoming for nothing): refused before it is read
  if ([name, note, region, batch, where, f.source, f.task, ...f.persons, ...(f.families ?? [])].some((v) => typeof v === "string" && v.includes("\0")))
    return refuse(400, refusal("a NUL in a header", "media.bad-header", { header: "X-Strom-Name" }));
  // only read here (what the research has of it): a strom of its own writes
  const tree = readTree(r.root, r.env);
  const settings = new Settings(r.env, {});
  const shared = settings.shared()?.value;
  // not set up (no shared folder): sending again does not help — /status says accepts.media null
  if (!shared) return refuse(500, refusal("the research has no shared folder for files (strom setup)", "media.no-shared"));
  // a batch: open, with room for it
  let open: ReturnType<typeof openBatch> | undefined;
  const length = Number((typeof req.headers["content-length"] === "string" ? req.headers["content-length"] : undefined) ?? NaN);
  if (batch) {
    try {
      open = openBatch(r.root, batch, f.phone ? "phone" : undefined);
    } catch (e) {
      return refuse(409, { ...refusalOf((e as Error).message, e instanceof StromError ? e : {}, "batch.closed"), batch });
    }
    const full = batchRoom(open, Number.isFinite(length) ? length : 0, r.env);
    if (full) return refuse(413, { ...refusal(full.text, full.code, full.params), batch });
  }
  // the same content: only said (an image of another source given again is taken as one more of that source)
  // (a file for a task comes whole even when the research has it: handed to the task as that content)
  const known = zip || f.task ? undefined : knownOriginal(tree, shared, sha);
  const onSource = !batch && !!f.source && known?.kind === "media" && !tree.get<Source>(f.source)?.media?.includes(known.id);
  if (known && !onSource) {
    // (queued files of the batch: said among what became of them as the batch is closed — its files)
    if (open) noteBatch(r.root, open, { known: known.id, ...(f.async && batch ? { taken: { sha, ...(where ? { path: where } : {}), batch, known: known.id } } : {}) });
    // an input of the people, said of again — people it lacks, a note it has not got: added by a strom of its own
    // (found live: the app said "Sent" while the research took nothing)
    const had = known.kind === "input" && !batch ? tree.get<Input>(known.id) : undefined;
    const more = had && (f.persons.some((p) => !(had.persons ?? []).includes(p)) || (f.families ?? []).some((x) => !(had.families ?? []).includes(x)) || (!!note?.trim() && !had.notes.some((n) => foldText(n.text) === foldText(note!.trim()))));
    // (a file to read: what it is of goes with its reading, never into an intake task)
    // nothing written (or what came again not added): the head as it is, which is its parent too (the bridge's answers)
    const unchanged = (): Record<string, unknown> => {
      const h = r.head?.();
      return h === undefined ? {} : { head: h, parent: h };
    };
    if (!more || f.read) return refuse(200, { known: known.id, kind: known.kind, ...(batch ? { batch } : {}), ...unchanged() });
    req.resume();
    runOf(r)(["input", "amend", known.id, ...f.persons.flatMap((p) => ["--person", p]), ...(f.families ?? []).flatMap((x) => ["--family", x]), ...(note ? [`--note=${note}`] : []), "--json"], ({ code, stdout, error }) => {
      if (error) return reply(200, { known: known.id, kind: known.kind, ...unchanged() });
      let data: { added?: unknown; task?: unknown } = {};
      try {
        data = JSON.parse(stdout) as typeof data;
      } catch {
        // said by the exit code
      }
      if (code !== 0) r.note(`what came again for ${known.id} was not added (exit ${code})`);
      if (code === EXIT.locked) return reply(503, { ...refusal("the research is busy — send it again in a while", "research.busy"), retry: 30 });
      const c = committed(data as Record<string, unknown>, () => r.head?.());
      reply(200, { known: known.id, kind: known.kind, ...(code === 0 && data.added ? { added: data.added } : {}), ...(code === 0 && data.task ? { task: data.task } : {}), ...(code === 0 ? { head: c.head, ...(c.parent !== undefined ? { parent: c.parent } : {}) } : unchanged()) });
    });
    return;
  }
  // a ZIP of a batch may be larger than one file (unpacked here, each of its files no larger than one): below 4 GB
  const max = zip ? 4 * 1024 ** 3 - 1 : originalMax(r.env);
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
    r.note(`an original from the app did not come whole: ${errorText(e)}`);
    out.destroy();
    drop();
  });
  out.on("error", (e) => {
    over = true;
    drop();
    reply(isDiskFull(e) ? 507 : 500, isDiskFull(e) ? said(tree.lang, "ui.media.full") : { error: errorText(e), code: "media.failed", text: errorText(e) });
    req.resume();
  });
  req.on("end", () => {
    if (over) return;
    out.end(() => r.safely(req, res, () => {
      if (hash.digest("hex") !== sha) {
        drop();
        reply(409, refusal("the file is not the one its address names (its SHA-256 differs) — send it again", "media.sha-differs", { sha }));
        return;
      }
      // queued (Prefer: respond-async): what can be told now is told now — a kind of file it does not take, a file cut
      // short — the rest written by the bridge's writer of the queue, as strom media original would
      if (f.async && r.queued) {
        const type = zip ? (zipHead(part) ? true : undefined) : originalType(part, batch ? path.basename(where ?? name) : name);
        if (!type) {
          drop();
          return reply(415, refusal(`${name}: not a kind of file the research takes`, "media.type", { name }));
        }
        const problem = type === true ? undefined : originalProblem(part, type.mime);
        if (problem) {
          drop();
          return reply(422, refusal(`${name}: ${problem.text} — not taken; send it again`, problem.code, { name, ...problem.params }));
        }
        let job: QueueJob;
        try {
          job = enqueue(r.root, part, {
            sha, name, persons: f.persons,
            ...(f.families?.length ? { families: f.families } : {}),
            ...(note ? { note } : {}),
            ...(batch ? { batch, path: where ?? batchPath(name) ?? name, ...(zip ? { zip: true } : {}) } : {}),
            client: { ...(f.async.origin ? { origin: f.async.origin } : {}), ...(f.async.app ? { app: f.async.app } : {}) },
            bytes: size,
          }, queueTag(tree.config.id)).job;
        } catch (e) {
          drop();
          r.note(`an original was not queued: ${errorText(e)}`);
          return isDiskFull(e) ? reply(507, said(tree.lang, "ui.media.full")) : reply(500, refusal(errorText(e), "media.failed"));
        }
        r.queued(job);
        return replyJson(res, 202, { sha, bytes: size, queued: true, ...(batch ? { batch } : {}) }, { "Preference-Applied": "respond-async" });
      }
      // taken by a strom of its own: its lock, its log and its commit
      const argv = [
        "media", "original", part, "--sha", sha, `--name=${name}`,
        ...f.persons.flatMap((p) => ["--person", p]),
        ...(f.families ?? []).flatMap((x) => ["--family", x]),
        ...(f.source ? ["--source", f.source] : []),
        ...(region ? ["--region", region] : []),
        ...(note ? [`--note=${note}`] : []),
        ...(batch ? ["--batch", batch, ...(where ? [`--path=${where}`] : []), ...(zip ? ["--zip"] : [])] : []),
        ...(f.phone ? ["--phone"] : []),
        ...(f.task ? ["--task", f.task] : []),
        ...(f.task && f.image !== undefined ? ["--image", String(f.image)] : []),
        ...(f.task && f.replace ? ["--replace"] : []),
        ...(f.read ? ["--read"] : []),
        "--json",
      ];
      runOf(r)(argv, ({ code, stdout, stderr, error }) => {
        if (error) {
          // not started at all (an argument it cannot take): the part goes at once, never left for the tidying
          drop();
          return reply(500, refusal(errorText(error), "media.failed"));
        }
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(stdout) as Record<string, unknown>;
        } catch {
          // said by the exit code
        }
        if (code === 0) {
          const c = committed(data, () => r.head?.());
          reply(200, { ...c.data, sha, bytes: size, ...(batch ? { batch } : {}), head: c.head, ...(c.parent !== undefined ? { parent: c.parent } : {}) });
          return;
        }
        drop();
        const why = String((data as { message?: unknown }).message ?? stderr.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? "the file was not taken");
        r.note(`an original was not taken (exit ${code}): ${why}`);
        // the research busy (another strom holding it longer than a writer waits): the app sends it again later
        if (code === EXIT.locked) return reply(503, { ...refusal(why, "research.busy"), retry: 30 });
        // no room on the disk: said in the research's language, never its inner path (found on Mac: "the disk is full: …")
        if (data.code === DISK_FULL || isDiskFull(why)) return reply(507, diskFullSaid(tree.lang, fullWhere(data, r.root)));
        // the task waits no more (answered meanwhile in the terminal)
        if (f.task && typeof data.code === "string" && ["task.none", "task.not-waiting", "task.no-file"].includes(data.code))
          return reply(409, refusal(why, data.code === "task.no-file" ? "waiting.no-file" : "waiting.none", { id: f.task }));
        // images for a task: which numbers it asks for, which are missing, which one is there already
        if (f.task && typeof data.code === "string" && data.code.startsWith("waiting.image-")) {
          const p = (data.params ?? {}) as Record<string, unknown>;
          const list = (k: string) => (typeof p[k] === "string" ? (parseImageList(p[k] as string) ?? []) : []);
          const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
          const extra = data.code === "waiting.image-unwanted" ? { want: list("want") } : data.code === "waiting.image-unknown" ? { missing: list("missing") }
            : data.code === "waiting.image-same" ? { image: list("image")[0], same: str("same"), as: str("as"), ...(str("sameRecordset") ? { sameRecordset: str("sameRecordset") } : {}), ...(list("sameImage").length ? { sameImage: list("sameImage")[0] } : {}) }
            : { image: list("image")[0] };
          return reply(409, { ...refusalOf(why, data, data.code), ...extra, task: f.task });
        }
        if (f.task && (data.code === "waiting.pdf" || data.code === "media.type")) return reply(415, { ...refusalOf(why, data, data.code), task: f.task });
        if (f.task && data.code === "task.no-images") return reply(409, refusalOf(why, data, "waiting.no-images"));
        reply(/not a kind of file/.test(why) ? 415 : /cut short|too small/.test(why) ? 422 : /the most one takes/.test(why) ? 413 : /closed already/.test(why) ? 409 : 400, refusalOf(why, data, "media.refused"));
      });
    }));
  });
}

/** Batches being closed now, by tree and mark (a bridge and a phone's server never close one twice at once in a process). */
const closing = new Set<string>();

/**
 * A strom command of the person's run by a server (the phone's page: a line moved, paused, resumed), --json: 200 with its
 * data and the research's head, 503 research.busy while another strom holds the research, 507 disk.full, else its
 * refusal (400, its code) — 409 for a research nobody researches (archive, agent.missing).
 */
export function stromBy(r: Receiver, argv: string[], reply: (code: number, body: Record<string, unknown>) => void): void {
  runOf(r)([...argv, "--json"], ({ code, stdout, stderr, error }) => {
    if (error) return reply(500, refusal(errorText(error), "phone.failed"));
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(stdout) as Record<string, unknown>;
    } catch {
      // said by the exit code
    }
    if (code === 0) {
      const c = committed(data, () => r.head?.());
      return reply(200, { ...c.data, head: c.head, ...(c.parent !== undefined ? { parent: c.parent } : {}) });
    }
    const why = String(data.message ?? stderr.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? `exit ${code}`);
    r.note(`${argv.slice(0, 2).join(" ")} was not written (exit ${code}): ${why}`);
    if (code === EXIT.locked) return reply(503, { ...refusal(why, "research.busy"), retry: 5 });
    if (data.code === DISK_FULL || isDiskFull(why)) return reply(507, diskFullSaid(langOf(r.root, r.env), fullWhere(data, r.root)));
    reply(data.code === "archive" || data.code === "agent.missing" ? 409 : 400, refusalOf(why, data, "phone.refused"));
  });
}

/** Close a batch by a strom of its own (strom input batch done): its files become sorting tasks. */
export function closeBatchBy(r: Receiver, id: string, extra: string[], reply: (code: number, body: Record<string, unknown>) => void): void {
  const key = `${r.root}\0${id}`;
  if (closing.has(key)) return reply(202, { pending: true, batch: id });
  closing.add(key);
  runOf(r)(["input", "batch", "done", id, ...extra, "--json"], ({ code, stdout, stderr, error }) => {
    closing.delete(key);
    if (error) return reply(500, { ...refusal(errorText(error), "media.failed"), batch: id });
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(stdout) as Record<string, unknown>;
    } catch {
      // said by the exit code
    }
    if (code === 0) {
      const c = committed(data, () => r.head?.());
      return reply(200, { ...c.data, head: c.head, ...(c.parent !== undefined ? { parent: c.parent } : {}) });
    }
    const why = String(data.message ?? stderr.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? "the batch was not closed");
    r.note(`the batch ${id} was not closed (exit ${code}): ${why}`);
    if (code === EXIT.locked) return reply(503, { ...refusal(why, "research.busy"), retry: 30, batch: id });
    if (data.code === DISK_FULL || isDiskFull(why)) return reply(507, { ...diskFullSaid(langOf(r.root, r.env), fullWhere(data, r.root)), batch: id });
    reply(/no batch/.test(why) ? 404 : 400, { ...refusalOf(why, data, /no batch/.test(why) ? "batch.none" : "media.refused"), batch: id });
  });
}
