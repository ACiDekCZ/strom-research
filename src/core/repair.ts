// strom repair — what it would do, known before it is done; what it removed, put back by the person.
//
// strom repair returns data/, strom.json, history/ and quality/ to the newest sealed commit: what differs is written
// back from it, what that commit does not hold is removed (a copy kept in .strom/quarantine/<stamp>/). Right for a
// record an agent wrote by hand; wrong where the history (git) is older than the research (found 2026-11-09: a research
// in iCloud Drive, its .git an older copy with "index 2", "HEAD 2" beside it, its oldest logs gone — strom verify said
// "unsealed" for P0001 and strom repair would have removed the records of years). So:
//
// - planRepair says what strom repair would do, read only: the files written back, those removed, and the signs of a
//   history older than the research — a removed record an intact signed operation wrote, one other records refer to,
//   one numbered below what the sealed state keeps, iCloud's copies inside .git;
// - repairWay: strom verify and strom check say then not strom repair but the way that loses nothing (the whole folder
//   backed up, .git put back from a backup or Time Machine, or the research accepted as it is by the person);
// - strom repair removing more than a few records, or with any such sign, is the person's decision in their terminal;
// - what strom repair removed or replaced the person puts back (strom repair undo <stamp>): one sealed operation names
//   each record put back, nothing in the folder is deleted.

import fs from "node:fs";
import path from "node:path";
import * as git from "./git.ts";
import type { Finding } from "./check.ts";
import { lastSealed, notDownloaded, notDownloadedError, REPAIR_IN_TERMINAL_HINT, SEALED_PATHS, verifyFast, verifyFull, type Integrity } from "./integrity.ts";
import { GIT_DAMAGED, isCloudCopy } from "./accept.ts";
import { RECORD_TYPES } from "./model.ts";
import { fileSha, sha256 } from "./seal.ts";
import type { Tree } from "./tree.ts";
import { StromError } from "./errors.ts";

/** strom repair removing more records than this is the person's decision (and any record with a sign of lost history). */
export const REPAIR_ASKS_ABOVE = 3;

/** What strom repair keeps of a repair beside its copies: what it removed and what it wrote back. */
const MANIFEST = "repair.json";

const RECORD_DIRS = new Set(Object.values(RECORD_TYPES).map((d) => `data/${d.dir}/`));

/** A record's file: data/<the folder of its type>/<id>.json. */
export function isRecordFile(rel: string): boolean {
  return RECORD_DIRS.has(rel.slice(0, rel.lastIndexOf("/") + 1)) && rel.endsWith(".json");
}

const isLog = (rel: string) => rel.startsWith("data/ops/") && rel.endsWith(".jsonl");
const idOf = (rel: string) => path.posix.basename(rel, ".json");

export interface RepairPlan {
  /** The newest sealed commit: what the folder is returned to. */
  from: string;
  /** The last commit is that one (else commits made outside strom are on top, sealed again). */
  headSealed: boolean;
  /** Paths git's index holds otherwise than the last commit. */
  staged: string[];
  /** Files written back as the sealed commit holds them. */
  restore: string[];
  /** Files the sealed commit does not hold: removed. */
  remove: string[];
  /** Of those removed, the records. */
  records: string[];
  /** Removed records and logs an intact signed operation of the history in the folder wrote: work, not a change outside strom. */
  sealedWork: string[];
  /** Removed records other records (as they stay) refer to. */
  referenced: string[];
  /** Removed records numbered below the highest of their type the sealed commit holds: the oldest history lost. */
  older: string[];
  /** iCloud's copies inside .git ("index 2", "HEAD 2"): the history (git) was synchronised by a cloud drive. */
  cloudCopies: string[];
  /** The sealed commit's content of each file to write back. */
  content: Map<string, string | undefined>;
}

/** iCloud's copies inside .git: its own files and its refs (never its objects, many and named by hash). */
export function gitCloudCopies(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string, deep: boolean) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (isCloudCopy(e.name)) out.push(`${rel}${e.name}`);
      else if (e.isDirectory() && (deep || e.name === "refs")) walk(path.join(dir, e.name), `${rel}${e.name}/`, true);
    }
  };
  walk(path.join(root, ".git"), ".git/", false);
  return out.sort();
}

/**
 * What strom repair would do, read only. Throws what strom repair throws before it does anything (files only in
 * iCloud, no seal key, no sealed commit, the terminal's key out of sight). `integrity`: strom verify's full check when
 * it was made already (what an intact signed operation wrote is told by it).
 */
export function planRepair(tree: Tree, integrity?: Integrity): RepairPlan {
  // files only in iCloud: never written over from the history (the cloud may hold a newer one), their placeholders
  // never taken away — downloaded first, then whatever else is wrong is repaired
  const cloud = notDownloaded(tree.root);
  if (cloud.length) throw notDownloadedError(cloud);
  const key = tree.requireKey();
  const head = git.headInfo(tree.root);
  // the newest commit any key of this computer sealed: only what was done outside strom undone, the other key's work
  // kept — strom seal adopt unites them after
  const { sealed, inTerminal } = lastSealed(tree, key);
  if (!sealed) throw new StromError("no sealed commit found — nothing to restore from", { hint: "ask the user; the history may have been rewritten" });
  if (inTerminal)
    throw new StromError(`"${tree.config.name}" holds work sealed with the key of the terminal's strom, which this strom (started by an app packaged for Windows) does not see — nothing repaired`, {
      hint: REPAIR_IN_TERMINAL_HINT,
      code: "seal.repair-in-terminal",
      params: { name: tree.config.name },
    });
  const headSealed = head !== undefined && head.hash === sealed;
  // Paths to compare: whatever differs between the sealed commit and the working tree…
  const candidates = new Set<string>();
  // …and what git's index holds otherwise than the last commit (a write taken back after its git add): back to it
  const staged: string[] = [];
  for (const c of git.changes(tree.root, SEALED_PATHS)) {
    candidates.add(c.path);
    if (!" ?!".includes(c.code[0] ?? " ")) staged.push(c.path);
  }
  if (!headSealed) {
    const r = git.runGit(tree.root, ["diff", "--name-only", "-z", sealed, "HEAD", "--", ...SEALED_PATHS]);
    for (const p of r.stdout.split("\0").filter(Boolean)) candidates.add(p);
  }
  const content = git.showFiles(tree.root, sealed, [...candidates]);
  const restore: string[] = [];
  const remove: string[] = [];
  for (const rel of [...candidates].sort()) {
    const abs = path.join(tree.root, rel);
    const want = content.get(rel);
    const have = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : undefined;
    if (want === have) continue;
    if (want === undefined) remove.push(rel);
    else restore.push(rel);
  }
  const plan: RepairPlan = { from: sealed, headSealed, staged, restore, remove, records: remove.filter(isRecordFile), sealedWork: [], referenced: [], older: [], cloudCopies: [], content };
  if (plan.remove.length === 0) return plan;
  plan.cloudCopies = gitCloudCopies(tree.root);
  // removed, though an intact signed operation of the history in the folder wrote it as it is: the history (git) is
  // older than the research — never a change outside strom
  const removedLogs = remove.filter(isLog);
  if (plan.records.length || removedLogs.length) {
    const full = integrity ?? verifyFull(tree);
    const tampered = new Set(full.tampered);
    const flagged = new Set(full.findings.filter((f) => f.level === "error" && f.file).map((f) => f.file!));
    plan.sealedWork = [...plan.records.filter((r) => !tampered.has(r) && !flagged.has(r)), ...removedLogs.filter((l) => !flagged.has(l))];
  }
  if (plan.records.length) {
    plan.older = olderThanSealed(tree.root, sealed, plan.records);
    plan.referenced = referencedByOthers(tree.root, plan);
  }
  return plan;
}

/** The records the sealed commit holds numbered above a removed one of the same type: its history lost, not a new one. */
function olderThanSealed(root: string, sealed: string, records: string[]): string[] {
  const r = git.runGit(root, ["ls-tree", "-r", "--name-only", "-z", sealed, "--", "data"]);
  const highest = new Map<string, number>();
  for (const rel of r.stdout.split("\0").filter(isRecordFile)) {
    const m = /^(\D+)(\d+)$/u.exec(idOf(rel));
    if (!m) continue;
    const dir = path.posix.dirname(rel);
    highest.set(dir, Math.max(highest.get(dir) ?? 0, Number(m[2])));
  }
  return records.filter((rel) => {
    const m = /^(\D+)(\d+)$/u.exec(idOf(rel));
    return !!m && Number(m[2]) < (highest.get(path.posix.dirname(rel)) ?? 0);
  });
}

/** Removed records another record refers to, as the records stay after strom repair (those written back as sealed). */
function referencedByOthers(root: string, plan: RepairPlan): string[] {
  const removed = new Set(plan.remove);
  const wanted = new Map(plan.records.map((rel) => [`"${idOf(rel)}"`, rel]));
  const found = new Set<string>();
  for (const def of Object.values(RECORD_TYPES)) {
    const dir = path.join(root, "data", def.dir);
    let names: string[];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const rel = `data/${def.dir}/${name}`;
      if (!name.endsWith(".json") || removed.has(rel)) continue;
      let text: string | undefined;
      try {
        text = plan.restore.includes(rel) ? plan.content.get(rel) : fs.readFileSync(path.join(dir, name), "utf8");
      } catch {
        text = undefined;
      }
      if (!text) continue;
      for (const [quoted, target] of wanted) if (!found.has(target) && text.includes(quoted)) found.add(target);
      if (found.size === wanted.size) return [...found].sort();
    }
  }
  return [...found].sort();
}

/** The signs of a history (git) older than the research: strom repair would remove work, not a change outside strom. */
export function historyLost(plan: RepairPlan): boolean {
  return plan.sealedWork.length > 0 || plan.referenced.length > 0 || plan.older.length > 0 || (plan.cloudCopies.length > 0 && plan.remove.length > 0);
}

/** strom repair asks the person first: more than a few records removed, or any sign of a history lost. */
export function repairAsks(plan: RepairPlan): boolean {
  return plan.records.length > REPAIR_ASKS_ABOVE || historyLost(plan);
}

export const HISTORY_REVERTED = "history-reverted";

/**
 * The way the check says where strom repair would remove work: nothing removed, the whole folder backed up first, the
 * history (git) put back — or the research accepted as it is, by the person.
 */
export const LOST_HINT =
  "back up the whole research folder first; then .git put back from a backup or Time Machine — or, once the user looked the records over, the user runs in their terminal: strom seal accept   (never strom repair: it would remove that work; an agent runs neither)";

/**
 * The check's findings with what strom repair would do: where it would remove work (historyLost), a finding of its
 * own with the count, and every "strom repair" said with the way that loses nothing. A damaged history (acceptWay)
 * and a research strom repair cannot plan for are left as they are.
 */
export function repairWay(tree: Tree, findings: Finding[], integrity?: Integrity): Finding[] {
  const repairs = (f: Finding) => f.level === "error" && (f.hint?.startsWith("strom repair") ?? false);
  if (!findings.some(repairs) || findings.some((f) => f.code === GIT_DAMAGED) || !tree.key) return findings;
  let plan: RepairPlan;
  try {
    plan = planRepair(tree, integrity);
  } catch {
    return findings;
  }
  if (!historyLost(plan)) return findings;
  for (const f of findings) if (repairs(f)) f.hint = LOST_HINT;
  return [lostFinding(plan), ...findings];
}

function lostFinding(plan: RepairPlan): Finding {
  const n = plan.records.length;
  return {
    level: "error",
    code: HISTORY_REVERTED,
    file: ".git",
    count: n,
    message:
      `the history (git) is older than the research: strom repair would remove ${n} ${n === 1 ? "record" : "records"}` +
      (plan.sealedWork.length ? ` (written by operations sealed in their logs: ${plan.sealedWork.length})` : "") +
      (plan.cloudCopies.length ? ` — iCloud's copies inside .git: ${plan.cloudCopies.slice(0, 3).join(", ")}` : ""),
    hint: LOST_HINT,
  };
}

/** Writing refused where strom repair would remove work: the way that loses nothing (repairWay), never strom repair. */
export function historyLostError(plan: RepairPlan): StromError {
  const n = plan.records.length;
  return new StromError(`the history (git) is older than the research — strom repair would remove ${n} ${n === 1 ? "record" : "records"}; nothing written`, {
    hint: `strom verify   (details)\n${LOST_HINT}`,
    code: "tree.history-reverted",
    params: { n: String(n) },
  });
}

/** Writing refused for changes outside strom: is strom repair's way one that would remove work? (never throws) */
export function lostOnRepair(tree: Tree): RepairPlan | undefined {
  try {
    if (!tree.key) return undefined;
    const plan = planRepair(tree);
    return historyLost(plan) ? plan : undefined;
  } catch {
    return undefined;
  }
}

export interface Repaired {
  restored: string[];
  quarantined: string[];
  from: string;
  /** Commits made outside strom on top: sealed again, whether or not they changed a record. */
  resealed: boolean;
  /** Paths git's index held otherwise than the sealed state (what an interrupted write staged), put back to it. */
  unstaged: number;
  /** A lock of git's index a git that ended mid-way left (stale), taken away. */
  lock: boolean;
  /** The folder of .strom/quarantine/ its copies are in (strom repair undo <stamp>), when any were kept. */
  stamp?: string;
}

interface Manifest {
  from: string;
  at: string;
  /** Removed: the hash of the copy. */
  removed: { path: string; sha: string }[];
  /** Written back: the hash of the copy (what was there) and of what strom repair wrote. */
  restored: { path: string; sha: string; now: string }[];
}

/** Return data/, strom.json, history/ and quality/ to the newest sealed commit (the plan as it is under the lock). */
export function applyRepair(tree: Tree, plan: RepairPlan, at = new Date()): Repaired {
  // a lock of git's index a git that ended mid-way left (killed with the command that ran it): no git holds it any
  // more — taken away, else nothing could be written again (a fresh one may be a git at work: left)
  const stale = git.staleIndexLock(tree.root);
  if (stale) fs.rmSync(stale, { force: true });
  const stamp = at.toISOString().replace(/[:.]/g, "-");
  const into = path.join(tree.root, ".strom", "quarantine", stamp);
  const manifest: Manifest = { from: plan.from, at: at.toISOString(), removed: [], restored: [] };
  const restored: string[] = [];
  const quarantined: string[] = [];
  for (const rel of [...plan.restore, ...plan.remove].sort()) {
    const abs = path.join(tree.root, rel);
    const want = plan.content.get(rel);
    let sha: string | undefined;
    if (fs.existsSync(abs)) {
      const dest = path.join(into, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(abs, dest);
      sha = fileSha(dest);
    }
    if (want === undefined) {
      fs.rmSync(abs, { force: true });
      quarantined.push(rel);
      if (sha) manifest.removed.push({ path: rel, sha });
    } else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, want);
      restored.push(rel);
      if (sha) manifest.restored.push({ path: rel, sha, now: sha256(Buffer.from(want, "utf8")) });
    }
  }
  const kept = manifest.removed.length + manifest.restored.length > 0;
  if (kept) fs.writeFileSync(path.join(into, MANIFEST), JSON.stringify(manifest, null, 2) + "\n");
  // sealed again even when the commits outside strom changed nothing of it (an empty one, notes only): else the last
  // commit stays unsealed and every write refused, with nothing left to repair
  if (!plan.headSealed) tree.commit(`Repair: restore the sealed state of ${plan.from.slice(0, 8)}\n\nCommits made outside strom were undone for data/, strom.json, history/ and quality/.`, SEALED_PATHS, true);
  // the folder as the sealed commit, HEAD: git's index as HEAD too (a commit above put it so already)
  else if (plan.staged.length) {
    const said = git.unstage(tree.root, plan.staged);
    if (said !== undefined)
      throw new StromError(`git could not put its index back to the sealed state: ${said}`, {
        hint: "programs that may hold the research's folder closed (a sync tool, an antivirus scan, another git), then strom repair again",
        code: "repair.index",
        details: plan.staged.slice(0, 50),
      });
  }
  return { restored, quarantined, from: plan.from, resealed: !plan.headSealed, unstaged: plan.headSealed ? plan.staged.length : 0, lock: !!stale, ...(kept ? { stamp } : {}) };
}

/** The plan as it decides what is done. */
export function sameRepair(a: RepairPlan, b: RepairPlan): boolean {
  const key = (p: RepairPlan) => JSON.stringify([p.from, p.restore, p.remove, p.staged]);
  return key(a) === key(b);
}

// ── strom repair undo ───────────────────────────────────────────────────────

/** The quarantine's folder: .strom/quarantine/. */
function quarantineDir(root: string): string {
  return path.join(root, ".strom", "quarantine");
}

/** The files of a quarantine (tree-relative, "/"), its manifest left out. */
function filesOf(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string, rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(d, e.name), `${rel}${e.name}/`);
      else if (e.isFile() && !(rel === "" && e.name === MANIFEST)) out.push(`${rel}${e.name}`);
    }
  };
  walk(dir, "");
  return out.sort();
}

export interface Quarantine {
  stamp: string;
  files: number;
  records: number;
}

/** The copies strom repair kept, the newest first. */
export function quarantines(root: string): Quarantine[] {
  let names: fs.Dirent[];
  try {
    names = fs.readdirSync(quarantineDir(root), { withFileTypes: true });
  } catch {
    return [];
  }
  return names
    .filter((d) => d.isDirectory())
    .map((d) => {
      const files = filesOf(path.join(quarantineDir(root), d.name));
      return { stamp: d.name, files: files.length, records: files.filter(isRecordFile).length };
    })
    .filter((q) => q.files > 0)
    .sort((a, b) => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0));
}

/** What strom seals and strom repair undo puts back: records, logs of the history, the counters, strom.json, history/, quality/. */
function puttable(rel: string): boolean {
  if (isCloudCopy(path.posix.basename(rel))) return false;
  return isRecordFile(rel) || isLog(rel) || rel === "data/_counters.json" || rel === "strom.json" || /^(history|quality)\/./u.test(rel);
}

/** Named in the operation that puts them back: what verify checks against operations (records, strom.json, history/, quality/). */
const sealable = (rel: string) => !isLog(rel) && rel !== "data/_counters.json";

export interface UndoPlan {
  stamp: string;
  /** Put back, with the hash of the copy. */
  back: { path: string; sha: string }[];
  /** Changed since strom repair (or no word of what strom repair wrote): left as they are now. */
  kept: string[];
  /** As its copy already. */
  same: string[];
  /** Not files of the research strom seals (iCloud's copies, an unknown file): left in the quarantine. */
  left: string[];
}

/** What strom repair undo <stamp> would put back, read only. */
export function planUndo(tree: Tree, stamp: string): UndoPlan {
  const dir = path.join(quarantineDir(tree.root), stamp);
  if (stamp.includes("/") || stamp.includes("\\") || stamp.startsWith(".") || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory())
    throw new StromError(`no copies of strom repair named ${stamp} in .strom/quarantine/`, { hint: "strom repair undo   (lists them)", code: "repair.undo-unknown", params: { stamp } });
  let manifest: Manifest | undefined;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), "utf8")) as Manifest;
  } catch {
    manifest = undefined;
  }
  const wrote = new Map((manifest?.restored ?? []).map((r) => [r.path, r.now]));
  const plan: UndoPlan = { stamp, back: [], kept: [], same: [], left: [] };
  for (const rel of filesOf(dir)) {
    if (!puttable(rel)) {
      plan.left.push(rel);
      continue;
    }
    const sha = fileSha(path.join(dir, ...rel.split("/")))!;
    const now = fileSha(path.join(tree.root, ...rel.split("/")));
    if (now === sha) plan.same.push(rel);
    // removed by strom repair and not there since, or written back by it and not changed since: put back
    else if (now === undefined || (wrote.get(rel) !== undefined && wrote.get(rel) === now)) plan.back.push({ path: rel, sha });
    else plan.kept.push(rel);
  }
  return plan;
}

export interface Undone {
  back: number;
  records: number;
  commit: string | undefined;
}

/**
 * Put back what strom repair kept (the plan the person said yes to), under the tree's lock: the plan made again first;
 * the research as strom sealed it first (else a change outside strom would be sealed with it). One signed operation
 * names each record put back as it is; a sealed commit of only what was put back.
 */
export function applyUndo(tree: Tree, agreed: UndoPlan): Undone {
  return tree.withTreeLock(() => {
    const plan = planUndo(tree, agreed.stamp);
    if (JSON.stringify(plan) !== JSON.stringify(agreed))
      throw new StromError("the research changed since it was looked over — nothing put back", { hint: `strom repair undo ${agreed.stamp}   (looks it over again)`, code: "repair.undo-changed" });
    if (verifyFast(tree).findings.some((f) => f.level === "error"))
      throw new StromError("the research holds changes strom did not seal — nothing put back", { hint: "strom verify   (details; strom repair undo puts back only onto a research as strom sealed it)", code: "repair.undo-unsealed" });
    if (plan.back.length === 0) return { back: 0, records: 0, commit: undefined };
    const dir = path.join(quarantineDir(tree.root), plan.stamp);
    for (const f of plan.back) {
      const dest = path.join(tree.root, ...f.path.split("/"));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(dir, ...f.path.split("/")), dest);
    }
    const files = plan.back.filter((f) => sealable(f.path));
    const records = plan.back.filter((f) => isRecordFile(f.path)).length;
    const n = plan.back.length;
    tree.appendOp({
      op: "repair.undo",
      targets: plan.back.filter((f) => isRecordFile(f.path)).map((f) => idOf(f.path)),
      files,
      summary: `What strom repair removed or replaced on ${plan.stamp} put back: ${n} ${n === 1 ? "file" : "files"}`,
    });
    const commit = tree.commit(`Repair undone: ${n} ${n === 1 ? "file" : "files"} of ${plan.stamp} put back`, SEALED_PATHS, true);
    return { back: n, records, commit };
  });
}
