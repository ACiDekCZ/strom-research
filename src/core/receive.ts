// An original received (PUT /media/<sha256> of the bridge, PUT /phone/media/<sha256> of the phone's server): only so
// large and while there is room, streamed to a file beside the shared store (never all in memory), its SHA-256 checked,
// then taken by a strom of its own (strom media original) as the person's — the same content again is only said. Both
// servers receive by these, each checking first who may send (the Strom app's pages; a paired phone).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import type { Env } from "./paths.ts";
import { withoutAgentMarks } from "./which.ts";
import { Tree } from "./tree.ts";
import { Settings } from "./config.ts";
import { ui } from "../cli/ui.ts";
import { DISK_FULL, EXIT, isDiskFull, StromError } from "./errors.ts";
import { freeBytes, knownOriginal, originalMax, ORIGINAL_RESERVE } from "./originals.ts";
import { batchRoom, noteBatch, openBatch } from "./batches.ts";
import { stromLauncher } from "./self.ts";
import { foldText } from "./text.ts";
import type { Input, Source } from "./model.ts";

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
}

/** What came with a file, checked by the server already. */
export interface Incoming {
  sha: string;
  name: string;
  note?: string | undefined;
  persons: string[];
  source?: string | undefined;
  region?: string | undefined;
  batch?: string | undefined;
  /** Its path in the batch. */
  where?: string | undefined;
  zip?: boolean;
  /** The waiting task it came for. */
  task?: string | undefined;
  /** From a paired phone. */
  phone?: boolean;
  /** To be read at once (X-Strom-Read): an input with no intake task. */
  read?: boolean;
}

/** Answered with JSON — 503 is only "busy, send it again": always with when (Retry-After). */
export function replyJson(res: http.ServerResponse, code: number, body: Record<string, unknown>): void {
  if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(code === 503 ? { "Retry-After": "30" } : {}) }).end(JSON.stringify(body));
}

/** A strom of its own, its output read. */
const spawnPiped = (command: string, argv: string[], cwd: string, env: Env) => spawn(command, argv, { cwd, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

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
  if ([name, note, region, batch, where, f.source, f.task, ...f.persons].some((v) => typeof v === "string" && v.includes("\0")))
    return refuse(400, refusal("a NUL in a header", "media.bad-header", { header: "X-Strom-Name" }));
  const tree = Tree.open(r.root, r.env);
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
    if (open) noteBatch(r.root, open, { known: known.id });
    // an input of the people, said of again — people it lacks, a note it has not got: added by a strom of its own
    // (found live: the app said "Sent" while the research took nothing)
    const had = known.kind === "input" && !batch ? tree.get<Input>(known.id) : undefined;
    const more = had && (f.persons.some((p) => !(had.persons ?? []).includes(p)) || (!!note?.trim() && !had.notes.some((n) => foldText(n.text) === foldText(note!.trim()))));
    // (a file to read: what it is of goes with its reading, never into an intake task)
    // nothing written (or what came again not added): the head as it is, which is its parent too (the bridge's answers)
    const unchanged = (): Record<string, unknown> => {
      const h = r.head?.();
      return h === undefined ? {} : { head: h, parent: h };
    };
    if (!more || f.read) return refuse(200, { known: known.id, kind: known.kind, ...(batch ? { batch } : {}), ...unchanged() });
    req.resume();
    const { command, args } = stromLauncher();
    const child = spawn(command, [...args, "input", "amend", known.id, ...f.persons.flatMap((p) => ["--person", p]), ...(note ? [`--note=${note}`] : []), "--json"], {
      cwd: r.root,
      env: forApp(r.env, r.root),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    r.track(child);
    let stdout = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
    child.stderr.resume();
    child.on("error", () => reply(200, { known: known.id, kind: known.kind, ...unchanged() }));
    child.on("close", (code) => {
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
      // taken by a strom of its own: its lock, its log and its commit
      const { command, args } = stromLauncher();
      const argv = [
        ...args, "media", "original", part, "--sha", sha, `--name=${name}`,
        ...f.persons.flatMap((p) => ["--person", p]),
        ...(f.source ? ["--source", f.source] : []),
        ...(region ? ["--region", region] : []),
        ...(note ? [`--note=${note}`] : []),
        ...(batch ? ["--batch", batch, ...(where ? [`--path=${where}`] : []), ...(zip ? ["--zip"] : [])] : []),
        ...(f.phone ? ["--phone"] : []),
        ...(f.task ? ["--task", f.task] : []),
        ...(f.read ? ["--read"] : []),
        "--json",
      ];
      let child: ReturnType<typeof spawnPiped>;
      try {
        child = spawnPiped(command, argv, r.root, forApp(r.env, r.root));
      } catch (e) {
        // not started at all (an argument it cannot take): the part goes at once, never left for the tidying
        drop();
        return reply(500, refusal(errorText(e), "media.failed"));
      }
      r.track(child);
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
        reply(/not a kind of file/.test(why) ? 415 : /cut short|too small/.test(why) ? 422 : /the most one takes/.test(why) ? 413 : /closed already/.test(why) ? 409 : 400, refusalOf(why, data, "media.refused"));
      });
    }));
  });
}

/** Batches being closed now, by tree and mark (a bridge and a phone's server never close one twice at once in a process). */
const closing = new Set<string>();

/** Close a batch by a strom of its own (strom input batch done): its files become sorting tasks. */
export function closeBatchBy(r: Receiver, id: string, extra: string[], reply: (code: number, body: Record<string, unknown>) => void): void {
  const key = `${r.root}\0${id}`;
  if (closing.has(key)) return reply(202, { pending: true, batch: id });
  closing.add(key);
  const { command, args } = stromLauncher();
  const child = spawn(command, [...args, "input", "batch", "done", id, ...extra, "--json"], {
    cwd: r.root,
    env: forApp(r.env, r.root),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  r.track(child);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
  child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
  child.on("error", (e) => {
    closing.delete(key);
    reply(500, { ...refusal(errorText(e), "media.failed"), batch: id });
  });
  child.on("close", (code) => {
    closing.delete(key);
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
