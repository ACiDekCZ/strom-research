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

import fs from "node:fs";
import path from "node:path";
import * as git from "./git.ts";
import type { Finding } from "./check.ts";
import { RECORD_TYPES } from "./model.ts";
import { fileSha, fingerprint, verifyCommitSeal, verifyOp } from "./seal.ts";
import type { Op, Tree } from "./tree.ts";
import { StromError } from "./errors.ts";

/** What changed since HEAD, with the committed versions — shared by verify and guard. */
export interface Snapshot {
  changes: git.Change[];
  head: Map<string, string | undefined>;
}

export function snapshot(tree: Tree): Snapshot {
  if (!git.hasHead(tree.root)) return { changes: [], head: new Map() };
  const changes = git.changes(tree.root, ["data", "strom.json"]);
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

function checkRecordFile(tree: Tree, rel: string, expected: string | undefined, untracked: boolean, findings: Finding[], tampered: Set<string>): void {
  const id = path.basename(rel, ".json");
  const abs = path.join(tree.root, rel);
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
  for (const c of opsChanged) {
    const before = committed.get(c.path) ?? "";
    const abs = path.join(tree.root, c.path);
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
    if (c.path.startsWith("data/ops/") || c.path === "data/_counters.json") continue;
    if (c.path === "strom.json") {
      // strom changes its config through a logged operation (strom config set --for-tree).
      if (latest.get(c.path) !== undefined && latest.get(c.path) === fileSha(path.join(tree.root, c.path))) continue;
      findings.push({ level: "error", code: "config-edited", file: c.path, message: "strom.json was changed outside strom", hint: "strom repair" });
      tampered.add(c.path);
      continue;
    }
    if (!isRecordPath(c.path)) {
      findings.push({ level: "error", code: "unsealed", file: c.path, message: "unknown file in data/ (created outside strom)", hint: "strom repair" });
      tampered.add(c.path);
      continue;
    }
    checkRecordFile(tree, c.path, latest.get(c.path), c.code === "??", findings, tampered);
  }
  return { findings, tampered: [...tampered] };
}

/** Full check: every operation and every record. */
export function verifyFull(tree: Tree): Integrity {
  const findings: Finding[] = [];
  const tampered = new Set<string>();
  headSeal(tree, findings);
  const latest = new Map<string, string>();
  const opsDir = path.join(tree.dataDir, "ops");
  const all: Op[] = [];
  if (fs.existsSync(opsDir))
    for (const f of fs.readdirSync(opsDir).sort()) {
      if (!f.endsWith(".jsonl")) continue;
      const rel = `data/ops/${f}`;
      const ops = parseOps(fs.readFileSync(path.join(opsDir, f), "utf8"), rel, findings);
      checkOps(tree, ops, "", rel, findings);
      all.push(...ops);
    }
  // Logs are per session: the last word on a file is the newest operation across all of them.
  all.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (const op of all) for (const sf of op.files ?? []) latest.set(sf.path, sf.sha);
  const present = new Set<string>();
  for (const def of Object.values(RECORD_TYPES)) {
    const dir = path.join(tree.dataDir, def.dir);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const rel = `data/${def.dir}/${f}`;
      present.add(rel);
      checkRecordFile(tree, rel, latest.get(rel), true, findings, tampered);
    }
  }
  for (const rel of latest.keys()) if (!present.has(rel) && rel !== "strom.json") checkRecordFile(tree, rel, latest.get(rel), false, findings, tampered);
  const cfg = latest.get("strom.json");
  if (cfg && fileSha(path.join(tree.root, "strom.json")) !== cfg) {
    tampered.add("strom.json");
    findings.push({ level: "error", code: "config-edited", file: "strom.json", message: "strom.json was changed outside strom", hint: "strom repair" });
  }
  return { findings, tampered: [...tampered] };
}

/** Refuse to write on top of data that was changed outside strom. */
export function assertIntact(tree: Tree): void {
  const { findings } = verifyFast(tree);
  const errors = findings.filter((f) => f.level === "error");
  if (errors.length === 0) {
    tree.requireKey();
    return;
  }
  throw new StromError(`data was changed outside strom (${errors.length} problem(s)) — refusing to write`, {
    hint: "strom verify   (details)\nstrom repair   (restore the last sealed state)",
    details: errors,
  });
}
