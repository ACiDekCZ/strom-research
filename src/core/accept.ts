// strom seal accept — the research as it is now taken as the new sealed base, by the person.
//
// What it is for: the records are as strom wrote them, but what sealed them is gone — the oldest logs of the history
// (data/ops) taken away by a cloud drive, the research's git history damaged so that strom repair has nothing to put
// back (found 2026-11-09: a research once in iCloud Drive, its .git missing objects, no other copy). strom verify then
// says every record whose last operation was in a lost log "created/edited outside strom", and strom repair would
// return an older state or nothing at all.
//
// What it does, nothing more: one signed operation (seal.accept) naming the hash of every file the full check finds
// not sealed as it is now — no record's content changed, nothing deleted — and a sealed commit of it. A git history
// that cannot be read is moved aside whole (.git-damaged-<when>, never deleted) and a new one begins with that commit.
// iCloud's copies of a file ("P0001 2.json") inside what strom seals are moved aside into .strom/accepted-<when>/,
// never sealed as records; copies elsewhere are only said.
//
// Never what the check finds of another kind (a log rewritten, an operation forged, another key, files only in the
// cloud, a record deleted): those are refused, said as the check says them. The person's own, in their terminal
// (cli: the gate as strom seal adopt); an agent never runs it.

import fs from "node:fs";
import path from "node:path";
import * as git from "./git.ts";
import type { Finding } from "./check.ts";
import { verifyFull } from "./integrity.ts";
import { RECORD_TYPES } from "./model.ts";
import { fileSha } from "./seal.ts";
import { typeOfId, type Tree } from "./tree.ts";
import { StromError } from "./errors.ts";

/** What the check finds that accepting settles: a file not sealed as it is now, a last commit strom did not seal. */
const SETTLED = new Set(["unsealed", "manual-edit", "history-edited", "quality-edited", "config-edited", "foreign-commit"]);

/** The folders of the research strom alone writes (what strom seals): iCloud's copies there are moved aside. */
const SEALED_DIRS = ["data", "history", "quality"];

/**
 * The way the check says for a file not sealed as it is, when strom repair has nothing to put back: the research's git
 * history cannot be read (or there is none). Never otherwise — a readable history puts the lost logs back (strom repair).
 */
export const ACCEPT_HINT = "the history (git) is damaged and strom repair cannot restore it — once the user looked the records over, the user runs in their terminal: strom seal accept   (an agent never runs it)";

/**
 * The check's findings with what the git history says: one that cannot be read (or none) is a finding of its own, and
 * those accepting settles are said with its way — strom repair has nothing to put back. A readable history says nothing
 * here: strom repair puts the lost logs back from it.
 */
export function acceptWay(tree: Tree, findings: Finding[]): Finding[] {
  const missing = !fs.existsSync(path.join(tree.root, ".git"));
  if (!missing && !git.damaged(tree.root)) return findings;
  for (const f of findings) if (f.level === "error" && SETTLED.has(f.code)) f.hint = ACCEPT_HINT;
  return [
    {
      level: "error",
      code: GIT_DAMAGED,
      file: ".git",
      message: missing ? "the research has no history (git)" : "the history (git) cannot be read — objects of it are missing",
      hint: ACCEPT_HINT,
    },
    ...findings,
  ];
}

export const GIT_DAMAGED = "git-damaged";

/** guard's findings, none when the git history cannot be read (acceptWay says that). */
export function guardOrDamaged(tree: Tree, guard: () => Finding[]): Finding[] {
  try {
    return guard();
  } catch (e) {
    if (!fs.existsSync(path.join(tree.root, ".git")) || git.damaged(tree.root)) return [];
    throw e;
  }
}

/** The state of the research's git history. */
export type GitState = "ok" | "unsealed" | "damaged" | "missing";

export interface AcceptPlan {
  /** What the operation seals: each file not sealed as it is now, with its hash now. */
  files: { path: string; sha: string }[];
  /** Records no operation left in the history wrote (their log gone). */
  unsealed: string[];
  /** Records whose content is not what the operations left in the history say (the later one's log gone). */
  edited: string[];
  /**
   * With a git history that can be read: records created or changed outside strom (strom repair returns them) — said
   * apart, so the person knows accepting makes such a change (an agent's, anyone's) the research's base.
   */
  outside: string[];
  /** Files of history/ and quality/, and strom.json, not sealed as they are. */
  other: string[];
  /** The logs of the history in the folder. */
  logs: number;
  git: GitState;
  /** iCloud's copies inside what strom seals (and of its lock): moved aside. */
  moveAside: string[];
  /** iCloud's copies elsewhere in the research: only said. */
  copies: string[];
  /** What accepting never settles: said as the check says it. */
  refused: Finding[];
}

/** An iCloud copy's name: "<name> 2.<ext>" (the number iCloud adds), never a name strom gives a file of its own. */
export function isCloudCopy(name: string): boolean {
  return /^.+ \d+(\.[^./ ]+)?$/u.test(name);
}

export function gitState(root: string, findings: Finding[]): GitState {
  if (!fs.existsSync(path.join(root, ".git"))) return "missing";
  if (git.damaged(root)) return "damaged";
  return findings.some((f) => f.code === "foreign-commit") ? "unsealed" : "ok";
}

/** A record file as strom writes one: JSON whose id is its name, in the folder of its type. */
function recordReadable(root: string, rel: string): boolean {
  const id = path.posix.basename(rel, ".json");
  const type = typeOfId(id);
  if (!type || path.posix.dirname(rel) !== `data/${RECORD_TYPES[type].dir}`) return false;
  try {
    const record = JSON.parse(fs.readFileSync(path.join(root, ...rel.split("/")), "utf8")) as { id?: unknown };
    return record.id === id;
  } catch {
    return false;
  }
}

/** iCloud's copies in the research (tree-relative, "/"): inside what strom seals, of its lock, and elsewhere. */
function cloudCopies(root: string): { moveAside: string[]; copies: string[] } {
  const moveAside: string[] = [];
  const copies: string[] = [];
  const walk = (dir: string, rel: string, into: string[], deep: boolean) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (deep) walk(path.join(dir, e.name), `${rel}${e.name}/`, into, deep);
      } else if (e.isFile() && isCloudCopy(e.name)) into.push(`${rel}${e.name}`);
    }
  };
  for (const d of SEALED_DIRS) walk(path.join(root, d), `${d}/`, moveAside, true);
  // the research's own files beside them (strom.json's copy), strom's state and what it writes for the app
  walk(root, "", copies, false);
  walk(path.join(root, ".strom"), ".strom/", copies, false);
  walk(path.join(root, "output"), "output/", copies, false);
  // a copy of a lock stands for a process that is not there: out of the way with the rest
  for (const c of copies.filter((p) => p.startsWith(".strom/") && p.endsWith(".lock"))) moveAside.push(c);
  return { moveAside: moveAside.sort(), copies: copies.filter((c) => !moveAside.includes(c)).sort() };
}

/** What accepting the research as it is would do — read only. */
export function planAccept(tree: Tree): AcceptPlan {
  const { findings } = verifyFull(tree);
  const { moveAside, copies } = cloudCopies(tree.root);
  const aside = new Set(moveAside);
  const plan: AcceptPlan = { files: [], unsealed: [], edited: [], outside: [], other: [], logs: 0, git: gitState(tree.root, findings), moveAside, copies, refused: [] };
  plan.logs = countLogs(tree.root);
  for (const f of findings) {
    if (f.level !== "error") continue;
    if (f.file && aside.has(f.file)) continue;
    if (!SETTLED.has(f.code)) {
      plan.refused.push(f);
      continue;
    }
    if (f.code === "foreign-commit") continue;
    const rel = f.file!;
    const abs = path.join(tree.root, ...rel.split("/"));
    const sha = fileSha(abs);
    const record = rel.startsWith("data/");
    if (sha === undefined || (record && !recordReadable(tree.root, rel))) {
      plan.refused.push({ ...f, message: `${f.message} — not a record strom can read, never sealed as one` });
      continue;
    }
    plan.files.push({ path: rel, sha });
    if (!record) plan.other.push(rel);
    else if (plan.git === "ok" || plan.git === "unsealed") plan.outside.push(rel);
    else (f.code === "unsealed" ? plan.unsealed : plan.edited).push(rel);
  }
  plan.files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return plan;
}

function countLogs(root: string): number {
  let n = 0;
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (e.name.endsWith(".jsonl") && !isCloudCopy(e.name)) n++;
    }
  };
  walk(path.join(root, "data", "ops"));
  return n;
}

/** Nothing to accept: every file sealed as it is, the last commit strom's and readable, no copy in the way. */
export function nothingToAccept(plan: AcceptPlan): boolean {
  return plan.files.length === 0 && plan.moveAside.length === 0 && plan.git === "ok";
}

export interface Accepted {
  /** The operation's files (sealed again). */
  sealed: number;
  /** The commit that holds it. */
  commit: string | undefined;
  /** Where the damaged git history was moved (tree-relative), when it was. */
  gitMoved?: string;
  /** Where iCloud's copies were moved (tree-relative), when any were. */
  copiesMoved?: string;
}

/** The plan as it decides what is done — the same files and hashes, the same state of git. */
function samePlan(a: AcceptPlan, b: AcceptPlan): boolean {
  const key = (p: AcceptPlan) => JSON.stringify([p.files, p.git, p.moveAside, p.refused.length]);
  return key(a) === key(b);
}

/**
 * Accept the research as it is (the plan the person said yes to). Under the tree's lock: the plan made again first —
 * anything changed since, nothing done. Throws when anything is refused.
 */
export function applyAccept(tree: Tree, agreed: AcceptPlan, at = new Date()): Accepted {
  return tree.withTreeLock(() => {
    const plan = planAccept(tree);
    if (!samePlan(plan, agreed))
      throw new StromError("the research changed since it was looked over — nothing accepted", { hint: "strom seal accept   (looks it over again)", code: "accept.changed" });
    if (plan.refused.length) throw new StromError("the check finds what accepting never settles — nothing accepted", { hint: "strom verify", code: "accept.refused" });
    if (nothingToAccept(plan)) return { sealed: 0, commit: undefined };
    const stamp = at.toISOString().replace(/\.\d+Z$/u, "Z").replace(/[:]/gu, "-");
    const out: Accepted = { sealed: plan.files.length, commit: undefined };
    if (plan.moveAside.length) {
      const into = `.strom/accepted-${stamp}`;
      for (const rel of plan.moveAside) {
        const dest = path.join(tree.root, ...into.split("/"), ...rel.split("/"));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.renameSync(path.join(tree.root, ...rel.split("/")), dest);
      }
      out.copiesMoved = into;
    }
    if (plan.git === "damaged" || plan.git === "missing") {
      if (plan.git === "damaged") {
        const moved = `.git-damaged-${stamp}`;
        fs.renameSync(path.join(tree.root, ".git"), path.join(tree.root, moved));
        out.gitMoved = moved;
      }
      git.initRepo(tree.root);
      // the history moved aside stays beside the research, never in the new one
      fs.mkdirSync(path.join(tree.root, ".git", "info"), { recursive: true });
      fs.appendFileSync(path.join(tree.root, ".git", "info", "exclude"), "/.git-damaged-*/\n");
      git.resetCache(tree.root);
    }
    const n = plan.files.length;
    tree.appendOp({
      op: "seal.accept",
      targets: [],
      files: plan.files,
      summary: `The research accepted as it is: ${n} ${n === 1 ? "file" : "files"} sealed again (their history missing)`,
    });
    const why = out.gitMoved ? `\n\nThe git history could not be read; it was moved aside to ${out.gitMoved}.` : "";
    out.commit = tree.commit(`Seal: the research accepted as it is (${n} ${n === 1 ? "file" : "files"} sealed again)${why}`, ["."], true);
    return out;
  });
}
