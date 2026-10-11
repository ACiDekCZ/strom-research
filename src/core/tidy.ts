// Order in .strom: what strom keeps beside a research for itself — logs of the agents' sessions, views of scans,
// excerpts, work folders of downloads, the Strom app's sends kept to look at — grows with every session and every
// send (found 2026-10-04: 8.4 GB in a tree whose research is 60 MB). What is a cache or a log is kept within limits;
// what a person or an agent made (data/, .git, inputs/, notes/, output/, the shared images) is never touched, nor a
// send taken back that the app may still send again (/again) or the research must recognize (takenBack).
//
// Old trees: nothing goes by itself. `strom tidy` shows what would go (what, how much, why) and the person says yes;
// from then on (and in a tree made by a strom that tidies) it is kept in order after each session and once a day
// by the bridge, logged in .strom/tidy.log. A tree with nothing to tidy is kept in order from the first look.
//
// Every path is checked before it goes: inside the tree's .strom, in a folder of its kind, of its kind of name,
// never a symbolic link — anything else stays.

import { compactSoon } from "./history.ts";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { Session } from "./model.ts";
import type { Tree } from "./tree.ts";
import { liveWorkers } from "./workers.ts";
import { receivedAll, resent, SYNC_INBOX } from "./sync.ts";
import { refreshRollup } from "./readstats.ts";
import { selfTune } from "./tune.ts";

const DAY = 24 * 3600_000;
const MB = 1024 * 1024;

/** The limits (each kind's): how long, how many, how much. */
export const LIMITS = {
  logs: { days: 30, count: 50, bytes: 300 * MB },
  views: { days: 14, bytes: 500 * MB, journal: 10 * MB },
  excerpts: { bytes: 200 * MB },
  fetch: { days: 1 },
  kept: { written: 5, days: 7, undoneDays: 30, refused: 5 },
  /** The measurements (core/metrics.ts): each journal and the use of the sessions together — never a summary. */
  metrics: { days: 90, bytes: 20 * MB },
  /** The record of the gates asked by runs (.strom/gate.log, core/gate.ts): its old lines go, its newest part stays. */
  gate: { days: 90, bytes: 2 * MB },
} as const;

/** The record of the gates' answers (core/gate.ts GATE_LOG), directly in .strom. */
const GATE_LOG = "gate.log";

/** So much to free is worth saying (status, the menu, the orientation). */
export const TIDY_SAID = 100 * MB;

/** A file (or a work folder) only touched this long ago is left: something may still write it. */
const QUIET_MS = 10 * 60_000;

export type TidyKind = "logs" | "briefs" | "views" | "excerpts" | "fetch" | "kept" | "inbox" | "pointers" | "metrics" | "gate";

export interface TidyItem {
  kind: TidyKind;
  /** Relative to the tree. */
  path: string;
  bytes: number;
  /** remove: goes; shrink: a log kept without the images in it, compressed. */
  do: "remove" | "shrink";
  why: string;
}

export interface TidyPlan {
  items: TidyItem[];
  /** .strom as it is now, and the research itself (data/, .git, inputs/). */
  size: { strom: number; research: number };
  /** What would go (a log shrunk: about nine tenths of it). */
  frees: number;
  /** What is kept beside it and never tidied: quarantined files of strom check (a person's to decide). */
  quarantine: number;
}

/** Whether this tree is kept in order by itself (`.strom/tidy.json`): after the first strom tidy, or made so. */
export function tidyOn(root: string): boolean {
  try {
    return (JSON.parse(fs.readFileSync(path.join(root, ".strom", "tidy.json"), "utf8")) as { auto?: unknown }).auto === true;
  } catch {
    return false;
  }
}

export function setTidyOn(root: string): void {
  const file = path.join(root, ".strom", "tidy.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ auto: true, since: new Date().toISOString() }) + "\n");
}

interface Entry {
  rel: string;
  abs: string;
  bytes: number;
  mtime: number;
  dir: boolean;
}

/** A file or folder of .strom/<kind>, only when it truly is one there: no link, nothing outside. */
function entries(root: string, sub: string, dirs = false): Entry[] {
  const base = path.join(root, ".strom", sub);
  let st: fs.Stats;
  try {
    st = fs.lstatSync(base);
  } catch {
    return [];
  }
  if (!st.isDirectory()) return [];
  const real = fs.realpathSync(path.join(root, ".strom"));
  if (path.relative(real, fs.realpathSync(base)).startsWith("..")) return [];
  const out: Entry[] = [];
  for (const name of fs.readdirSync(base)) {
    const abs = path.join(base, name);
    let s: fs.Stats;
    try {
      s = fs.lstatSync(abs);
    } catch {
      continue;
    }
    if (s.isSymbolicLink()) continue;
    if (dirs ? !s.isDirectory() : !s.isFile()) continue;
    out.push({ rel: path.join(".strom", sub, name), abs, bytes: dirs ? sizeOf(abs) : s.size, mtime: s.mtimeMs, dir: dirs });
  }
  return out;
}

/** A folder's size, links not followed. */
export function sizeOf(p: string): number {
  let s: fs.Stats;
  try {
    s = fs.lstatSync(p);
  } catch {
    return 0;
  }
  if (s.isSymbolicLink()) return 0;
  if (!s.isDirectory()) return s.size;
  let n = 0;
  for (const e of fs.readdirSync(p)) n += sizeOf(path.join(p, e));
  return n;
}

/** What would be tidied in this tree now (nothing is touched). */
export function tidyPlan(tree: Tree, at = Date.now()): TidyPlan {
  const root = tree.root;
  const items: TidyItem[] = [];
  const quiet = (e: Entry) => at - e.mtime > QUIET_MS;
  const open = new Set(tree.list<Session>("session").filter((s) => s.state === "open").map((s) => s.id));
  const atWork = liveWorkers(root).length > 0 || open.size > 0;

  // the logs of the agents' sessions and readers: the newest kept (a closed session's shrunk), the rest go
  const logs = entries(root, "runs").filter((e) => /\.(log|log\.gz|prompt\.md)$/.test(e.rel));
  const sessionOf = (e: Entry) => /^(N\d+)\./.exec(path.basename(e.rel))?.[1];
  const running = (e: Entry) => !quiet(e) || (sessionOf(e) !== undefined && open.has(sessionOf(e)!));
  const done = logs.filter((e) => !running(e)).sort((a, b) => b.mtime - a.mtime);
  let kept = 0;
  let keptBytes = 0;
  const goneSessions = new Set<string>();
  for (const e of done) {
    const old = at - e.mtime > LIMITS.logs.days * DAY;
    const plain = e.rel.endsWith(".log");
    const after = plain ? Math.round(e.bytes / 10) : e.bytes;
    if (old || kept >= LIMITS.logs.count || keptBytes + after > LIMITS.logs.bytes) {
      items.push({ kind: "logs", path: e.rel, bytes: e.bytes, do: "remove", why: old ? `older than ${LIMITS.logs.days} days` : `beyond the newest ${LIMITS.logs.count} logs (${LIMITS.logs.bytes / MB} MB)` });
      const s = sessionOf(e);
      if (s) goneSessions.add(s);
      continue;
    }
    if (!e.rel.endsWith(".prompt.md")) kept++;
    keptBytes += after;
    if (plain && e.bytes > 64 * 1024) items.push({ kind: "logs", path: e.rel, bytes: e.bytes, do: "shrink", why: "a closed session's log: the images in it left out, compressed" });
  }
  // the briefs: with their session's log, or as old
  for (const e of entries(root, "briefs").filter((x) => x.rel.endsWith(".md"))) {
    const s = /^(N\d+)\.md$/.exec(path.basename(e.rel))?.[1];
    if (s && open.has(s)) continue;
    if ((s && goneSessions.has(s)) || at - e.mtime > LIMITS.logs.days * DAY) items.push({ kind: "briefs", path: e.rel, bytes: e.bytes, do: "remove", why: "a closed session's brief" });
  }

  // views of the scans: made again whenever needed — never while somebody is at work (an agent may have one open)
  if (!atWork) {
    const views = entries(root, "views").filter((e) => /\.(jpe?g|png)$/i.test(e.rel)).sort((a, b) => b.mtime - a.mtime);
    let bytes = 0;
    for (const e of views) {
      const old = at - e.mtime > LIMITS.views.days * DAY;
      if (old || bytes + e.bytes > LIMITS.views.bytes) items.push({ kind: "views", path: e.rel, bytes: e.bytes, do: "remove", why: old ? `a view not looked at for ${LIMITS.views.days} days (made again when needed)` : `beyond ${LIMITS.views.bytes / MB} MB of views` });
      else bytes += e.bytes;
    }
    const journal = entries(root, "views").find((e) => path.basename(e.rel) === "views.jsonl");
    if (journal && journal.bytes > LIMITS.views.journal) items.push({ kind: "views", path: journal.rel, bytes: journal.bytes - LIMITS.views.journal / 2, do: "shrink", why: "the record of views looked at: its newest part kept" });

    // the measurements of the reading of scans and of the load on the archives: what is older than their days, or
    // beyond their size, goes (a journal keeps its newest lines) — never while somebody is at work (they append)
    for (const e of entries(root, "metrics").filter((x) => /\.jsonl$/.test(x.rel))) {
      const first = firstAt(e.abs);
      const cutoff = at - LIMITS.metrics.days * DAY;
      const old = first < cutoff;
      // how much of it is old: by the time its lines span (nothing read but its first line)
      const oldBytes = old && e.mtime > first ? Math.round((e.bytes * Math.min(1, (cutoff - first) / (e.mtime - first))) || 0) : old ? e.bytes : 0;
      if (e.bytes > LIMITS.metrics.bytes || old)
        items.push({ kind: "metrics", path: e.rel, bytes: Math.max(oldBytes, e.bytes > LIMITS.metrics.bytes ? e.bytes - LIMITS.metrics.bytes / 2 : 0), do: "shrink", why: old ? `measurements older than ${LIMITS.metrics.days} days left out` : `the measurements: their newest ${LIMITS.metrics.bytes / 2 / MB} MB kept` });
    }
    const usage = entries(root, path.join("metrics", "usage")).filter((e) => /\.jsonl$/.test(e.rel) && quiet(e)).sort((a, b) => b.mtime - a.mtime);
    let usageBytes = 0;
    for (const e of usage) {
      const old = at - e.mtime > LIMITS.metrics.days * DAY;
      if (old || usageBytes + e.bytes > LIMITS.metrics.bytes) items.push({ kind: "metrics", path: e.rel, bytes: e.bytes, do: "remove", why: old ? `the use of a session over ${LIMITS.metrics.days} days ago` : `beyond ${LIMITS.metrics.bytes / MB} MB of the use of sessions` });
      else usageBytes += e.bytes;
    }

    // the record of the gates' answers: its lines older than its days, or beyond its size, go (a run appends to it)
    const gateLog = entries(root, "").find((e) => path.basename(e.rel) === GATE_LOG);
    if (gateLog) {
      const first = firstAt(gateLog.abs);
      const cutoff = at - LIMITS.gate.days * DAY;
      const old = first < cutoff;
      const big = gateLog.bytes > LIMITS.gate.bytes;
      const oldBytes = old && gateLog.mtime > first ? Math.round(gateLog.bytes * Math.min(1, (cutoff - first) / (gateLog.mtime - first)) || 0) : old ? gateLog.bytes : 0;
      if (old || big) items.push({ kind: "gate", path: gateLog.rel, bytes: Math.max(oldBytes, big ? gateLog.bytes - LIMITS.gate.bytes / 2 : 0), do: "shrink", why: old ? `answers of the gate older than ${LIMITS.gate.days} days left out` : `the answers of the gate: their newest ${LIMITS.gate.bytes / 2 / MB} MB kept` });
    }
  }

  // excerpts: made again from the scans
  {
    const ex = entries(root, "excerpts").filter((e) => /\.(jpe?g|png)$/i.test(e.rel) && quiet(e)).sort((a, b) => b.mtime - a.mtime);
    let bytes = 0;
    for (const e of ex) {
      if (bytes + e.bytes > LIMITS.excerpts.bytes) items.push({ kind: "excerpts", path: e.rel, bytes: e.bytes, do: "remove", why: `beyond ${LIMITS.excerpts.bytes / MB} MB of excerpts (made again when needed)` });
      else bytes += e.bytes;
    }
  }

  // work folders of downloads left by one cut short
  for (const e of entries(root, "fetch", true)) {
    const stamp = Number(/-(\d{12,})$/.exec(path.basename(e.rel))?.[1] ?? NaN);
    const since = Number.isFinite(stamp) ? Math.max(stamp, e.mtime) : e.mtime;
    if (at - since > LIMITS.fetch.days * DAY) items.push({ kind: "fetch", path: e.rel, bytes: e.bytes, do: "remove", why: "the work folder of a download cut short" });
  }

  // the Strom app's sends kept: one taken back while it may be sent again; the last few others, to look at
  {
    const keptDir = path.join(SYNC_INBOX, "kept");
    const files = entries(root, path.relative(".strom", keptDir)).sort((a, b) => b.mtime - a.mtime);
    const all = receivedAll(root);
    const of = new Map(all.filter((r) => r.keptAs).map((r) => [path.basename(r.keptAs!), r]));
    let written = 0;
    let refused = 0;
    // the last send of each tree of the app the research wrote: what its next copy may stand on (_STROM_SINCE)
    const bases = new Set<string>();
    const seenTrees = new Set<string>();
    for (const r of [...all].sort((a, b) => Date.parse(b.decided ?? b.at) - Date.parse(a.decided ?? a.at)))
      if (r.keptAs && r.tree && (r.state === "written" || r.state === "undone") && !seenTrees.has(r.tree)) {
        seenTrees.add(r.tree);
        bases.add(path.basename(r.keptAs));
      }
    for (const e of files) {
      const name = path.basename(e.rel);
      if (bases.has(name)) continue;
      const r = of.get(name);
      if (r?.state === "undone" && !resent(all, r)) {
        if (at - Date.parse(r.decided ?? r.at) <= LIMITS.kept.undoneDays * DAY) continue;
        items.push({ kind: "kept", path: e.rel, bytes: e.bytes, do: "remove", why: `a send taken back over ${LIMITS.kept.undoneDays} days ago` });
        continue;
      }
      const isRefused = name.startsWith("refused-");
      const n = isRefused ? refused++ : written++;
      const old = at - e.mtime > LIMITS.kept.days * DAY;
      if (n >= (isRefused ? LIMITS.kept.refused : LIMITS.kept.written) || old)
        items.push({ kind: "kept", path: e.rel, bytes: e.bytes, do: "remove", why: isRefused ? "a send refused, older than the last few" : "a send written (its changes are in the research's history)" });
    }
  }

  // the inbox itself: a send no record waits on (an older strom kept every send there), notes of what came to nothing
  {
    const waiting = new Set(receivedAll(root).filter((r) => r.state === "pending").map((r) => r.file));
    for (const e of entries(root, "sync")) {
      const name = path.basename(e.rel);
      const old = at - e.mtime > LIMITS.kept.days * DAY;
      if (!old) continue;
      if (/^strom-app-.+\.(ged|json)$/.test(name) && !waiting.has(name)) items.push({ kind: "inbox", path: e.rel, bytes: e.bytes, do: "remove", why: "a send of an older strom left in the inbox (written or thrown away then)" });
      else if (/^(nothing|adopt-failed)-\d+\.json$/.test(name)) items.push({ kind: "inbox", path: e.rel, bytes: e.bytes, do: "remove", why: "a note of a send long ago" });
    }
  }

  // which session an agent was in, left by one that ended without closing it
  for (const e of entries(root, "")) {
    const m = /^session-(.+)\.json$/.exec(path.basename(e.rel));
    if (!m || !quiet(e)) continue;
    const alive = liveWorkers(root).some((w) => w.id === m[1]);
    let id: string | undefined;
    try {
      id = (JSON.parse(fs.readFileSync(e.abs, "utf8")) as { id?: string }).id;
    } catch {
      // unreadable: nobody's
    }
    if (!alive && !(id && open.has(id))) items.push({ kind: "pointers", path: e.rel, bytes: e.bytes, do: "remove", why: "an agent's pointer to a session that ended" });
  }

  // the pointer of an agent's session in one research, left when it ended without closing it
  for (const e of entries(root, "sessions")) {
    if (!/~.+\.json$/.test(path.basename(e.rel)) || !quiet(e)) continue;
    let id: string | undefined;
    try {
      id = (JSON.parse(fs.readFileSync(e.abs, "utf8")) as { id?: string }).id;
    } catch {
      // unreadable: nobody's
    }
    if (!(id && open.has(id))) items.push({ kind: "pointers", path: e.rel, bytes: e.bytes, do: "remove", why: "an agent's pointer to a session that ended" });
  }

  const frees = items.reduce((n, i) => n + (i.do === "remove" ? i.bytes : i.kind === "logs" ? Math.round(i.bytes * 0.9) : i.bytes), 0);
  return {
    items,
    size: { strom: sizeOf(path.join(root, ".strom")), research: ["data", ".git", "inputs", "notes", "output", "strom.json"].reduce((n, d) => n + sizeOf(path.join(root, d)), 0) },
    frees,
    quarantine: sizeOf(path.join(root, ".strom", "quarantine")),
  };
}

/** When the first line of a journal was written (its "at"); unknown: now (nothing is old). */
function firstAt(file: string): number {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, "r");
    const b = Buffer.alloc(512);
    const head = b.subarray(0, fs.readSync(fd, b, 0, b.length, 0)).toString("utf8");
    const t = Date.parse(/"at":"([^"]+)"/.exec(head)?.[1] ?? "");
    return Number.isFinite(t) ? t : Date.now();
  } catch {
    return Date.now();
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** A journal of measurements without its lines older than `since`, and at most its newest `keep` bytes. */
export function trimJournal(text: string, since: number, keep: number): string {
  let out = text;
  if (out.length > keep) out = out.slice(out.indexOf("\n", out.length - keep) + 1);
  const lines = out.split("\n");
  let i = 0;
  for (; i < lines.length; i++) {
    const t = Date.parse(/"at":"([^"]+)"/.exec(lines[i]!)?.[1] ?? "");
    if (!Number.isFinite(t) || t >= since) break;
  }
  return lines.slice(i).join("\n");
}

/** The image data in a log of an agent's session: left out, its size said. */
function withoutImages(text: string): string {
  return text.replace(/"data":"([A-Za-z0-9+/=]{2048,})"/g, (_, d: string) => `"data":"[image ${Math.round((d.length * 3) / 4 / 1024)} kB left out]"`);
}

/** The path checked again as it goes: in the tree's .strom, of its kind, no link. */
function safe(root: string, item: TidyItem): string | undefined {
  const dirs: Record<TidyKind, string> = { logs: "runs", briefs: "briefs", views: "views", excerpts: "excerpts", fetch: "fetch", kept: path.join("sync", "kept"), inbox: "sync", pointers: "", metrics: "metrics", gate: "" };
  const abs = path.resolve(root, item.path);
  const expected = path.resolve(root, ".strom", dirs[item.kind]);
  // the measurements: a journal in .strom/metrics, the use of a session in its usage folder — nothing else
  const fits =
    item.kind === "metrics"
      ? /\.jsonl$/.test(abs) && (path.dirname(abs) === expected || (item.do === "remove" && path.dirname(abs) === path.join(expected, "usage")))
      : item.kind === "gate"
        ? item.do === "shrink" && path.basename(abs) === GATE_LOG && path.dirname(abs) === expected
        : path.dirname(abs) === expected;
  if (!fits) return undefined;
  try {
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink() || (item.kind === "fetch" ? !st.isDirectory() : !st.isFile())) return undefined;
    const strom = fs.realpathSync(path.join(root, ".strom"));
    if (path.relative(strom, fs.realpathSync(abs)).startsWith("..")) return undefined;
  } catch {
    return undefined;
  }
  return abs;
}

/** The plan carried out; what went is logged in .strom/tidy.log. What fails is left as it is. */
export function tidy(tree: Tree, plan: TidyPlan, how: "person" | "auto"): { removed: number; shrunk: number; freed: number } {
  let removed = 0;
  let shrunk = 0;
  let freed = 0;
  // the measurements summed up before a journal is shortened or a log of a session goes (what older sessions left is
  // read from their logs while they are here): the figures outlive them (core/readstats.ts)
  if (plan.items.some((i) => i.kind === "metrics" || i.kind === "logs" || (i.kind === "views" && i.do === "shrink")))
    try {
      refreshRollup(tree);
    } catch {
      // a summary is no reason to keep everything
    }
  for (const item of plan.items) {
    const abs = safe(tree.root, item);
    if (!abs) continue;
    try {
      if (item.do === "remove") {
        fs.rmSync(abs, { recursive: item.kind === "fetch", force: true });
        removed++;
        freed += item.bytes;
      } else if (item.kind === "logs") {
        const before = fs.statSync(abs).size;
        // too big to read at once: left as it is (a person may delete it)
        if (before > 400 * MB) continue;
        const out = `${abs}.gz`;
        fs.writeFileSync(`${out}.${process.pid}`, zlib.gzipSync(withoutImages(fs.readFileSync(abs, "utf8"))));
        fs.renameSync(`${out}.${process.pid}`, out);
        fs.utimesSync(out, new Date(), fs.statSync(abs).mtime);
        fs.rmSync(abs, { force: true });
        shrunk++;
        freed += before - fs.statSync(out).size;
      } else if (item.kind === "views") {
        // the record of views: its newest half
        const text = fs.readFileSync(abs, "utf8");
        const from = text.indexOf("\n", text.length - LIMITS.views.journal / 2) + 1;
        fs.writeFileSync(abs, text.slice(from));
        shrunk++;
        freed += from;
      } else if (item.kind === "metrics" || item.kind === "gate") {
        // a journal of measurements, the record of the gates: its old lines out, its newest part kept
        const text = fs.readFileSync(abs, "utf8");
        const limit = LIMITS[item.kind];
        const kept = trimJournal(text, Date.now() - limit.days * DAY, limit.bytes / 2);
        if (kept.length < text.length) {
          fs.writeFileSync(abs, kept);
          shrunk++;
          freed += Buffer.byteLength(text) - Buffer.byteLength(kept);
        }
      }
    } catch {
      // left as it is: tried again next time
    }
  }
  if (removed || shrunk) {
    const line = `${new Date().toISOString()} ${how === "person" ? "strom tidy" : "kept in order"}: ${removed} removed, ${shrunk} shrunk, ${(freed / MB).toFixed(1)} MB freed\n`;
    try {
      fs.appendFileSync(path.join(tree.root, ".strom", "tidy.log"), line);
    } catch {
      // the log is no reason to fail
    }
  }
  return { removed, shrunk, freed };
}

/**
 * Kept in order by itself (after a session, by the bridge once a day): only a tree the person tidied once (or made by
 * a strom that tidies, or with nothing to tidy at its first look) — never what an older strom left, unasked. Never fails.
 */
export function autoTidy(tree: Tree): void {
  // the history too: packed in the background when it has grown (nothing of the research removed: core/history.ts)
  if (!tree.dryRun) compactSoon(tree.root, tree.env);
  try {
    if (tree.dryRun) return;
    // the reading of scans summed up after each session and once a day (core/readstats.ts): free, local — and what only
    // adds accuracy or saves requests to an archive set by itself from it (core/tune.ts; never .strom/tune tidied)
    try {
      const rollup = refreshRollup(tree);
      if (rollup) selfTune(tree, { rollup });
    } catch {
      // a summary is no reason to fail
    }
    if (!tidyOn(tree.root)) {
      // nothing gathered: in order from now on
      if (tidyPlan(tree).items.length === 0) setTidyOn(tree.root);
      return;
    }
    tidy(tree, tidyPlan(tree), "auto");
  } catch {
    // order is never a reason to fail
  }
}

/** How much, for a person in their language (1,2 MB). */
export function mb(bytes: number, lang = "en"): string {
  const n = (v: number, digits: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
  const m = bytes / MB;
  if (m >= 1024) return `${n(m / 1024, 1)} GB`;
  if (m >= 10) return `${n(m, 0)} MB`;
  if (m >= 1) return `${n(m, 1)} MB`;
  return `${n(bytes > 0 ? Math.max(1, Math.round(bytes / 1024)) : 0, 0)} kB`;
}

/**
 * The shared store of scans and material (media/ab/cd/<sha>.<ext>): each content once by its address, so a copy can
 * only be the same content under another extension; and files no research on this computer names (a material taken
 * back, a tree taken off). Only said — the store is the research's, nothing in it is tidied.
 */
export function sharedMedia(shared: string, named: Set<string>): { files: number; bytes: number; twice: { n: number; bytes: number }; unnamed: { n: number; bytes: number } } {
  const out = { files: 0, bytes: 0, twice: { n: 0, bytes: 0 }, unnamed: { n: 0, bytes: 0 } };
  const seen = new Set<string>();
  const walk = (dir: string, depth: number) => {
    let names: string[];
    try {
      names = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const p = path.join(dir, name);
      let st: fs.Stats;
      try {
        st = fs.lstatSync(p);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (depth < 2 && !name.startsWith(".")) walk(p, depth + 1);
        continue;
      }
      const sha = /^([0-9a-f]{64})(\.[^.]+)?$/i.exec(name)?.[1]?.toLowerCase();
      if (!st.isFile() || !sha) continue;
      out.files++;
      out.bytes += st.size;
      if (seen.has(sha)) {
        out.twice.n++;
        out.twice.bytes += st.size;
      }
      seen.add(sha);
      if (!named.has(sha)) {
        out.unnamed.n++;
        out.unnamed.bytes += st.size;
      }
    }
  };
  walk(path.join(shared, "media"), 0);
  return out;
}
