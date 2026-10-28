// `strom verify` — was anything changed outside strom?
//
// Two levels, both built on the same facts:
//
// fast (before every write, in the commit gate, in orientation)
//   1. HEAD carries a valid commit seal → everything committed is trusted,
//      because strom only commits behind its own gate.
//   2. Only what changed since HEAD is examined: new operations must continue
//      the chain and be signed, every changed record must match the hash its
//      operation recorded. Cost: two git calls when nothing changed.
//
// full (`strom verify`, `strom check`)
//   Every operation of every log and every record file, plus the commit seal.

import { opsLogs } from "./opslog.ts";
import fs from "node:fs";
import path from "node:path";
import * as git from "./git.ts";
import type { Finding } from "./check.ts";
import { RECORD_TYPES } from "./model.ts";
import { fileSha, fingerprint, verifyCommitSeal, verifyOp } from "./seal.ts";
import type { Op, Tree } from "./tree.ts";
import { StromError } from "./errors.ts";
import { counted } from "../cli/format.ts";

/** What changed since HEAD, with the committed versions — shared by verify and guard. */
export interface Snapshot {
  changes: git.Change[];
  head: Map<string, string | undefined>;
}

/**
 * What strom alone writes in a tree, each change through a sealed operation: the records and their history (data/), the
 * tree's settings (strom.json) and the history at the places of the tree (history/: core/pastevents.ts).
 */
export const SEALED_PATHS = ["data", "strom.json", "history"];

/** A file of the history at the places of the tree (history/…): strom writes it whole, as a record. */
export function isHistoryPath(p: string): boolean {
  return p.startsWith("history/");
}

export function snapshot(tree: Tree): Snapshot {
  if (!git.hasHead(tree.root)) return { changes: [], head: new Map() };
  const changes = git.changes(tree.root, SEALED_PATHS);
  return { changes, head: git.showFiles(tree.root, "HEAD", changes.map((c) => c.path)) };
}

export interface Integrity {
  findings: Finding[];
  /** Tree-relative paths whose content is not what strom sealed. */
  tampered: string[];
}

const RECORD_DIRS = new Set(Object.values(RECORD_TYPES).map((d) => `data/${d.dir}/`));

function isRecordPath(p: string): boolean {
  const dir = p.slice(0, p.lastIndexOf("/") + 1);
  return RECORD_DIRS.has(dir) && p.endsWith(".json");
}

function parseOps(text: string, file: string, findings: Finding[], startLine = 0): Op[] {
  const out: Op[] = [];
  text.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    try {
      out.push(JSON.parse(line) as Op);
    } catch {
      findings.push({ level: "error", code: "ops-corrupt", file, message: `line ${startLine + i + 1} is not valid JSON` });
    }
  });
  return out;
}

/** Check chain and signatures of a run of operations. */
function checkOps(tree: Tree, ops: Op[], prevSig: string, file: string, findings: Finding[]): void {
  const key = tree.key;
  const fp = key ? fingerprint(key) : undefined;
  let prev = prevSig;
  let adopted = false;
  for (const op of ops) {
    if (op.prev !== prev) findings.push({ level: "error", code: "chain-broken", file, message: `operation ${op.op} at ${op.at}: chain broken (log rewritten or edited)` });
    prev = op.sig ?? "";
    if (op.op === "seal.adopt") adopted = true;
    if (!key) continue;
    if (op.k === fp) {
      if (!verifyOp(op as unknown as Record<string, unknown>, key))
        findings.push({ level: "error", code: "forged-op", file, message: `operation ${op.op} at ${op.at} has an invalid signature (written outside strom)` });
    } else if (adopted) {
      findings.push({ level: "error", code: "forged-op", file, message: `operation ${op.op} at ${op.at} is signed with an unknown key after the tree was adopted` });
    }
  }
}

function headSeal(tree: Tree, findings: Finding[]): void {
  const head = git.headInfo(tree.root);
  if (!head) return;
  const key = tree.key;
  if (!key) {
    findings.push({
      level: "warn",
      code: "foreign-seal",
      message: "this tree was sealed on another computer — reading works, writing needs the user's consent",
      hint: "the user runs in their terminal: strom seal adopt",
    });
    return;
  }
  if (!verifyCommitSeal(key, head.tree, head.message))
    findings.push({
      level: "error",
      code: "foreign-commit",
      message: "the last commit was not made by strom (git used directly)",
      hint: "strom repair   (return to the last sealed state)",
    });
}

/**
 * iCloud's placeholder of a file it keeps only in the cloud ("optimise storage"): `.<name>.icloud` where the file was —
 * the name of the file it stands for, else undefined.
 */
export function placeholderOf(name: string): string | undefined {
  return /^\.(.+)\.icloud$/su.exec(name)?.[1];
}

/** Is a file not there only because iCloud keeps it in the cloud (its placeholder beside where it was)? */
export function inCloudOnly(abs: string): boolean {
  return !fs.existsSync(abs) && fs.existsSync(path.join(path.dirname(abs), `.${path.basename(abs)}.icloud`));
}

/**
 * The files of a research iCloud has not downloaded (only their placeholders here: the research's folder in iCloud
 * Drive, its storage optimised), tree-relative with "/" — its records and history (data/) and strom.json. Reads the
 * folders' names only, never a file.
 */
export function notDownloaded(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        walk(path.join(dir, e.name), `${rel}${e.name}/`);
        continue;
      }
      const name = placeholderOf(e.name);
      if (name && !fs.existsSync(path.join(dir, name))) out.push(`${rel}${name}`);
    }
  };
  walk(path.join(root, "data"), "data/");
  if (inCloudOnly(path.join(root, "strom.json"))) out.push("strom.json");
  return out.sort();
}

export const NOT_DOWNLOADED = "not-downloaded";

/**
 * Files only in iCloud, as one finding (never "deleted outside strom → strom repair": repair would write the sealed
 * version over the one in the cloud, and remove its placeholder): how many, the first, and the way — download them.
 */
function notDownloadedFinding(files: string[]): Finding {
  const first = files[0]!;
  const id = isRecordPath(first) ? path.basename(first, ".json") : undefined;
  return {
    level: "error",
    code: NOT_DOWNLOADED,
    ...(id ? { id } : {}),
    file: first,
    count: files.length,
    message: files.length === 1 ? "not downloaded from iCloud yet — only its placeholder is here" : `${files.length} files not downloaded from iCloud yet (the first: ${first}) — only their placeholders are here`,
    hint: "open the research's folder in Finder and download it (or take the folder out of iCloud Drive), then check again — never strom repair",
  };
}

function checkRecordFile(tree: Tree, rel: string, expected: string | undefined, untracked: boolean, findings: Finding[], tampered: Set<string>, cloud?: Set<string>): void {
  const id = path.basename(rel, ".json");
  const abs = path.join(tree.root, rel);
  // only in iCloud: not downloaded yet, no change of anybody's (said once for all of them)
  if (cloud && inCloudOnly(abs)) {
    cloud.add(rel);
    return;
  }
  if (!fs.existsSync(abs)) {
    tampered.add(rel);
    findings.push({ level: "error", code: "manual-delete", id, file: rel, message: "record was deleted outside strom", hint: "strom repair" });
    return;
  }
  if (expected === undefined) {
    // No operation wrote this content: a new file is unsealed, a changed one was edited by hand.
    tampered.add(rel);
    findings.push(
      untracked
        ? { level: "error", code: "unsealed", id, file: rel, message: "record was created outside strom", hint: "strom repair" }
        : { level: "error", code: "manual-edit", id, file: rel, message: "record was edited outside strom", hint: "strom repair" },
    );
    return;
  }
  if (fileSha(abs) !== expected) {
    tampered.add(rel);
    findings.push({ level: "error", code: "manual-edit", id, file: rel, message: "record was edited outside strom", hint: "strom repair" });
  }
}

/** A file of history/ not as strom sealed it. */
function historyFinding(rel: string, how: "edited" | "deleted" | "unsealed"): Finding {
  return {
    level: "error",
    code: how === "unsealed" ? "unsealed" : how === "deleted" ? "manual-delete" : "history-edited",
    file: rel,
    message: how === "unsealed" ? `${rel} was created outside strom` : how === "deleted" ? `${rel} was deleted outside strom` : `${rel} was changed outside strom`,
    hint: "strom repair",
  };
}

/** The files under history/ of a tree (tree-relative, "/"), a placeholder of iCloud and .DS_Store aside. */
function historyFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === ".DS_Store" || placeholderOf(e.name) !== undefined) continue;
      if (e.isDirectory()) walk(path.join(dir, e.name), `${rel}${e.name}/`);
      else if (e.isFile()) out.push(`${rel}${e.name}`);
    }
  };
  walk(path.join(root, "history"), "history/");
  return out;
}

/** Fast check: HEAD seal + everything changed since HEAD. */
export function verifyFast(tree: Tree, snap: Snapshot = snapshot(tree)): Integrity {
  const findings: Finding[] = [];
  const tampered = new Set<string>();
  if (!git.hasHead(tree.root)) return { findings, tampered: [] };
  headSeal(tree, findings);
  const { changes, head: committed } = snap;
  if (changes.length === 0) return { findings, tampered: [] };

  const opsChanged = changes.filter((c) => c.path.startsWith("data/ops/") && c.path.endsWith(".jsonl"));
  const latest = new Map<string, string>();
  const cloud = new Set<string>();
  for (const c of opsChanged) {
    const before = committed.get(c.path) ?? "";
    const abs = path.join(tree.root, c.path);
    if (inCloudOnly(abs)) {
      cloud.add(c.path);
      continue;
    }
    if (!fs.existsSync(abs)) {
      findings.push({ level: "error", code: "ops-deleted", file: c.path, message: "operation log was deleted" });
      continue;
    }
    const now = fs.readFileSync(abs, "utf8");
    if (!now.startsWith(before)) {
      findings.push({ level: "error", code: "ops-rewritten", file: c.path, message: "operation log was rewritten (it is append-only)" });
      continue;
    }
    const prior = parseOps(before, c.path, findings);
    const added = parseOps(now.slice(before.length), c.path, findings, prior.length);
    checkOps(tree, added, prior.at(-1)?.sig ?? "", c.path, findings);
    for (const op of added) for (const f of op.files ?? []) latest.set(f.path, f.sha);
  }

  for (const c of changes) {
    // iCloud's placeholder of a file: the file it stands for says it (a record, a log of the history)
    const stands = placeholderOf(path.posix.basename(c.path));
    if (stands !== undefined) {
      const rel = path.posix.join(path.posix.dirname(c.path), stands);
      if (inCloudOnly(path.join(tree.root, rel))) cloud.add(rel);
      continue;
    }
    if (c.path.startsWith("data/ops/") || c.path === "data/_counters.json") continue;
    if (c.path === "strom.json") {
      // strom changes its config through a logged operation (strom config set --for-tree).
      if (latest.get(c.path) !== undefined && latest.get(c.path) === fileSha(path.join(tree.root, c.path))) continue;
      findings.push({ level: "error", code: "config-edited", file: c.path, message: "strom.json was changed outside strom", hint: "strom repair" });
      tampered.add(c.path);
      continue;
    }
    if (isHistoryPath(c.path)) {
      // written whole by strom through a sealed operation (strom history …), as a record
      const abs = path.join(tree.root, c.path);
      if (latest.get(c.path) !== undefined && fs.existsSync(abs) && latest.get(c.path) === fileSha(abs)) continue;
      findings.push(historyFinding(c.path, fs.existsSync(abs) ? (c.code === "??" && latest.get(c.path) === undefined ? "unsealed" : "edited") : "deleted"));
      tampered.add(c.path);
      continue;
    }
    if (!isRecordPath(c.path)) {
      findings.push({ level: "error", code: "unsealed", file: c.path, message: "unknown file in data/ (created outside strom)", hint: "strom repair" });
      tampered.add(c.path);
      continue;
    }
    checkRecordFile(tree, c.path, latest.get(c.path), c.code === "??", findings, tampered, cloud);
  }
  if (cloud.size) findings.unshift(notDownloadedFinding([...cloud].sort()));
  return { findings, tampered: [...tampered] };
}

/** Full check: every operation and every record. */
export function verifyFull(tree: Tree): Integrity {
  const findings: Finding[] = [];
  const tampered = new Set<string>();
  headSeal(tree, findings);
  const latest = new Map<string, string>();
  const all: Op[] = [];
  for (const file of opsLogs(tree.dataDir)) {
      const rel = path.relative(tree.root, file).split(path.sep).join("/");
      const ops = parseOps(fs.readFileSync(file, "utf8"), rel, findings);
      checkOps(tree, ops, "", rel, findings);
      all.push(...ops);
    }
  // Logs are per session: the last word on a file is the newest operation across all of them.
  all.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (const op of all) for (const sf of op.files ?? []) latest.set(sf.path, sf.sha);
  const present = new Set<string>();
  // what iCloud keeps in the cloud only (records, logs of the history): said once, first — what it holds cannot be judged
  const cloud = new Set(notDownloaded(tree.root));
  for (const def of Object.values(RECORD_TYPES)) {
    const dir = path.join(tree.dataDir, def.dir);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const rel = `data/${def.dir}/${f}`;
      present.add(rel);
      checkRecordFile(tree, rel, latest.get(rel), true, findings, tampered, cloud);
    }
  }
  for (const rel of latest.keys()) if (!present.has(rel) && rel !== "strom.json" && !isHistoryPath(rel)) checkRecordFile(tree, rel, latest.get(rel), false, findings, tampered, cloud);
  // the history at the places of the tree: each file as its last operation sealed it, none that no operation wrote
  const history = new Set([...latest.keys()].filter(isHistoryPath));
  for (const rel of historyFiles(tree.root)) history.add(rel);
  for (const rel of [...history].sort()) {
    const abs = path.join(tree.root, ...rel.split("/"));
    if (inCloudOnly(abs)) {
      cloud.add(rel);
      continue;
    }
    const sealed = latest.get(rel);
    const there = fs.existsSync(abs);
    if (sealed !== undefined && there && fileSha(abs) === sealed) continue;
    tampered.add(rel);
    findings.push(historyFinding(rel, !there ? "deleted" : sealed === undefined ? "unsealed" : "edited"));
  }
  if (cloud.size) findings.unshift(notDownloadedFinding([...cloud].sort()));
  // a log of the history only in the cloud: what it sealed cannot be told here — no record said edited for it
  if ([...cloud].some((p) => p.startsWith("data/ops/"))) {
    const unjudged = findings.filter((f) => (f.code === "unsealed" || f.code === "manual-edit") && f.file);
    for (const f of unjudged) tampered.delete(f.file!);
    findings.splice(0, findings.length, ...findings.filter((f) => !unjudged.includes(f)));
  }
  const cfg = latest.get("strom.json");
  if (cfg && fileSha(path.join(tree.root, "strom.json")) !== cfg) {
    tampered.add("strom.json");
    findings.push({ level: "error", code: "config-edited", file: "strom.json", message: "strom.json was changed outside strom", hint: "strom repair" });
  }
  return { findings, tampered: [...tampered] };
}

/**
 * Whether strom may write here unasked (a settle: nobody asked, nobody to ask): the tree sealed on this computer (not
 * another computer's seal waiting for the person's adoption) and nothing changed outside strom. Never throws: no is
 * "next time".
 */
export function writableUnasked(tree: Tree): boolean {
  if (!tree.key) return false;
  try {
    return !verifyFast(tree).findings.some((f) => f.level === "error");
  } catch {
    return false;
  }
}

/** Refuse to write on top of data that was changed outside strom. */
export function assertIntact(tree: Tree): void {
  const { findings } = verifyFast(tree);
  const errors = findings.filter((f) => f.level === "error");
  if (errors.length === 0) {
    tree.requireKey();
    return;
  }
  // files only in iCloud: downloaded first — what else is wrong is judged then
  if (errors.some((f) => f.code === NOT_DOWNLOADED)) throw notDownloadedError(notDownloaded(tree.root));
  throw new StromError(`data was changed outside strom (${counted(errors.length, "problem")}) — refusing to write`, {
    hint: "strom verify   (details)\nstrom repair   (restore the last sealed state)",
    details: errors,
  });
}

/**
 * Writing refused while files of the research are only in iCloud (a write would commit them as deleted): how many, the
 * first, and the way — never strom repair. Its code for a program (tree.not-downloaded), the person's words in their
 * language (ui.error.tree.not-downloaded).
 */
export function notDownloadedError(files: string[]): StromError {
  const first = files[0] ?? "data/";
  const n = String(Math.max(1, files.length));
  return new StromError(`${counted(Math.max(1, files.length), "file")} of the research not downloaded from iCloud yet (the first: ${first}) — nothing written`, {
    hint: "open the research's folder in Finder and download them (or take the folder out of iCloud Drive), then run it again — never strom repair",
    code: "tree.not-downloaded",
    params: { n, first },
    details: files.slice(0, 50),
  });
}
