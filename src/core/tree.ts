// A tree = one folder = one git repository holding the evidence of one
// family (it matches one tree in the Strom app). Researches live inside it.
//
// Layout:
//   strom.json            tree config (name, research language, schema)
//   data/<dir>/<ID>.json  one record per file (canonical JSON)
//   data/_counters.json   ID counters (never reused)
//   data/ops/*.jsonl      append-only operation log
//   output/               generated files (tree.ged, ...)
//   notes/ inputs/        free prose, material from the family
//   .strom/               local state: locks, cache (git-ignored)

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readJson, readJsonIfExists, writeJson, appendJsonLine, writeFileAtomic } from "./json.ts";
import { acquireLock, withLock } from "./lock.ts";

/** How long a writer waits for the tree while another one works (a long intake, a batch). */
const LOCK_WAIT_MS = 120_000;
import { RECORD_TYPES, ALL_PREFIXES, SCHEMA_VERSION, type AnyRecord, type RecordType, type TreeConfig } from "./model.ts";
import { validateRecord } from "./validate.ts";
import { NeedsConsentError, StromError, UsageError } from "./errors.ts";
import * as git from "./git.ts";
import { commitSeal, createKey, fingerprint, loadKey, sha256, signOp, type SealedFile } from "./seal.ts";
import { stringifyCanonical } from "./json.ts";
import type { Env } from "./paths.ts";

export const TREE_FILE = "strom.json";
export const VERSION = "1.0.0";

export interface Op {
  at: string;
  op: string;
  targets: string[];
  summary: string;
  by: string;
  reason?: string;
  /** Files written by this operation with their SHA-256 (tamper evidence). */
  files: SealedFile[];
  /** Signature of the previous operation in the same log (hash chain). */
  prev: string;
  /** Fingerprint of the key that signed this operation. */
  k: string;
  /** HMAC signature with the tree's seal key. */
  sig: string;
}

const GITIGNORE = `# Strom Research — local state and large files are not versioned
.strom/
/media/
node_modules/
*.tmp
.DS_Store
`;

export function isTreeDir(dir: string): boolean {
  return fs.existsSync(path.join(dir, TREE_FILE));
}

/** Walk up from `start` to the first folder containing strom.json. */
export function findTreeUpwards(start: string): string | undefined {
  let dir = path.resolve(start);
  for (;;) {
    if (isTreeDir(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function now(): string {
  return new Date().toISOString();
}

export function formatId(prefix: string, n: number): string {
  return prefix + String(n).padStart(4, "0");
}

export function prefixOf(id: string): string | undefined {
  return /^([A-Z])\d+$/.exec(id)?.[1];
}

export function typeOfId(id: string): RecordType | undefined {
  const p = prefixOf(id);
  return p ? typeOfPrefix(p) : undefined;
}

export function typeOfPrefix(prefix: string): RecordType | undefined {
  for (const [type, def] of Object.entries(RECORD_TYPES)) if (def.prefix === prefix) return type as RecordType;
  return undefined;
}

export class Tree {
  readonly root: string;
  readonly config: TreeConfig;
  /** Who writes: a session ID, "agent" (an agent outside a session) or "user". */
  actor = "user";
  dryRun = false;
  private cache = new Map<RecordType, Map<string, AnyRecord>>();
  /** Records read one by one before their whole type was loaded. */
  private single = new Map<string, AnyRecord | null>();
  /** Last signature per operation log, so appending does not re-read the log. */
  private lastSigs = new Map<string, string>();
  /** Operation logs this process appended to (to commit them). */
  private touchedOps = new Set<string>();
  /** Original content of every file this command changed (null = did not exist): the undo log. */
  private undo = new Map<string, Buffer | null>();
  /** Ops written during this process (for the automatic commit message). */
  readonly written: Op[] = [];

  readonly env: Env;
  /** Bumped on every write; lets derived indexes know they are stale. */
  version = 0;
  private keyCache: Buffer | null | undefined;

  private constructor(root: string, config: TreeConfig, env: Env) {
    this.root = root;
    this.config = config;
    this.env = env;
  }

  static open(root: string, env: Env): Tree {
    const file = path.join(root, TREE_FILE);
    if (!fs.existsSync(file)) throw new StromError(`not a Strom tree: ${root}`, { hint: "strom trees" });
    const config = readJson<TreeConfig>(file);
    if (!config.id) throw new StromError(`tree config has no id: ${file}`);
    git.resetCache(root); // other processes (an agent) may have committed since
    if (config.schema > SCHEMA_VERSION)
      throw new StromError(`tree was written by a newer Strom (schema ${config.schema})`, { hint: "update strom" });
    return new Tree(root, config, env);
  }

  /** Create a new tree folder with a git repository and a first commit. */
  static create(root: string, name: string, lang: string, env: Env): Tree {
    if (fs.existsSync(root) && fs.readdirSync(root).length > 0)
      throw new UsageError(`folder is not empty: ${root}`, { hint: "choose a new folder name" });
    if (!git.gitVersion()) throw git.gitMissingError();
    fs.mkdirSync(root, { recursive: true });
    const config: TreeConfig = { schema: SCHEMA_VERSION, id: crypto.randomUUID(), name, lang, created: now(), createdWith: VERSION };
    writeJson(path.join(root, TREE_FILE), config);
    for (const d of ["data", "output", "notes", "inputs"]) fs.mkdirSync(path.join(root, d), { recursive: true });
    writeJson(path.join(root, "data", "_counters.json"), {});
    writeFileAtomic(path.join(root, ".gitignore"), GITIGNORE);
    for (const d of ["output", "notes", "inputs"]) writeFileAtomic(path.join(root, d, ".gitkeep"), "");
    git.initRepo(root);
    const tree = new Tree(root, config, env);
    createKey(env, config.id);
    tree.commit(`Create tree "${name}"`);
    return tree;
  }

  get dataDir(): string {
    return path.join(this.root, "data");
  }

  private lockFile(): string {
    return path.join(this.root, ".strom", "tree.lock");
  }

  private lockDepth = 0;
  private counters: Record<string, number> | undefined;

  /**
   * Run under the tree lock (re-entrant). ID counters are flushed on the way out.
   * Several strom processes write to one tree side by side (agents in their
   * conversations, a run on its own): whoever takes the lock reads the records
   * afresh, so nobody writes over what another one wrote meanwhile.
   */
  withTreeLock<T>(fn: () => T): T {
    if (this.lockDepth > 0) {
      this.lockDepth++;
      try {
        return fn();
      } finally {
        this.lockDepth--;
        // Back at a whole command's hold (holdTreeLock): its IDs are on disk before it commits.
        if (this.lockDepth === 1) this.flushCounters();
      }
    }
    return withLock(this.lockFile(), { owner: `strom ${this.actor}`, waitMs: LOCK_WAIT_MS, staleMs: 60_000 }, () => {
      this.lockDepth = 1;
      this.fresh();
      try {
        return fn();
      } finally {
        this.lockDepth = 0;
        this.flushCounters();
      }
    });
  }

  /**
   * Hold the tree lock over a whole command — what it reads, what it writes and
   * its commit — so another process never slips in between (the usual way for
   * a writing command; long ones lock only while they write).
   */
  async holdTreeLock<T>(fn: () => Promise<T>): Promise<T> {
    if (this.lockDepth > 0) return fn();
    const release = acquireLock(this.lockFile(), { owner: `strom ${this.actor}`, waitMs: LOCK_WAIT_MS, staleMs: 60_000 });
    this.lockDepth = 1;
    this.fresh();
    try {
      return await fn();
    } finally {
      this.lockDepth = 0;
      this.flushCounters();
      release();
    }
  }

  /** Forget what was read before the lock: another process may have written since. */
  private fresh(): void {
    git.resetCache(this.root); // and what git said: another process may have committed while this one waited
    if (this.dryRun) return; // a dry run's own writes live only in memory
    this.cache.clear();
    this.single.clear();
    this.lastSigs.clear();
    this.version++;
  }

  private flushCounters(): void {
    // A dry run keeps its counters in memory, so later steps get fresh IDs too.
    if (this.dryRun) return;
    if (this.counters) {
      this.remember(this.countersFile());
      writeJson(this.countersFile(), this.counters);
    }
    this.counters = undefined;
  }

  /** Record a file's current content before this command changes it. */
  remember(file: string): void {
    if (this.undo.has(file)) return;
    try {
      this.undo.set(file, fs.readFileSync(file));
    } catch {
      this.undo.set(file, null);
    }
  }

  /** Undo every change this command made — a failed command leaves nothing behind. */
  rollback(): string[] {
    const restored: string[] = [];
    for (const [file, content] of this.undo) {
      if (content === null) fs.rmSync(file, { force: true });
      else fs.writeFileSync(file, content);
      restored.push(this.relative(file));
    }
    this.undo.clear();
    this.cache.clear();
    this.single.clear();
    this.lastSigs.clear();
    this.touchedOps.clear();
    this.counters = undefined;
    this.written.length = 0;
    this.version++;
    return restored;
  }

  /** Forget the undo log once the changes are committed. */
  settle(): void {
    this.undo.clear();
  }

  recordPath(type: RecordType, id: string): string {
    return path.join(this.dataDir, RECORD_TYPES[type].dir, `${id}.json`);
  }

  relative(p: string): string {
    return path.relative(this.root, p).split(path.sep).join("/");
  }

  // ── reading ────────────────────────────────────────────────────────────

  list<T extends AnyRecord>(type: RecordType): T[] {
    let map = this.cache.get(type);
    if (!map) {
      map = new Map();
      const dir = path.join(this.dataDir, RECORD_TYPES[type].dir);
      if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir).sort()) {
          if (!f.endsWith(".json")) continue;
          let rec: AnyRecord;
          try {
            rec = readJson<AnyRecord>(path.join(dir, f));
          } catch {
            continue; // unreadable record: reported by `strom check`
          }
          map.set(rec.id, rec);
        }
      }
      // Records this process already holds win: after a dry-run write they exist only here.
      for (const [id, rec] of this.single) if (rec && rec.type === type) map.set(id, rec);
      this.cache.set(type, map);
    }
    return [...map.values()] as T[];
  }

  /** One record. Reads just its file unless the whole type is already loaded. */
  get<T extends AnyRecord>(id: string): T | undefined {
    const type = typeOfId(id);
    if (!type) return undefined;
    const loaded = this.cache.get(type);
    if (loaded) return loaded.get(id) as T | undefined;
    let one = this.single.get(id);
    if (one === undefined) {
      try {
        one = readJson<AnyRecord>(this.recordPath(type, id));
      } catch {
        one = null;
      }
      this.single.set(id, one);
    }
    return (one ?? undefined) as T | undefined;
  }

  /** Number of records of a type without reading them. */
  count(type: RecordType): number {
    const loaded = this.cache.get(type);
    if (loaded) return loaded.size;
    const dir = path.join(this.dataDir, RECORD_TYPES[type].dir);
    if (!fs.existsSync(dir)) return 0;
    let n = 0;
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".json")) n++;
    return n;
  }

  // ── IDs ────────────────────────────────────────────────────────────────

  private countersFile(): string {
    return path.join(this.dataDir, "_counters.json");
  }

  /** Highest ID number present on disk for a record type (guards counter drift). */
  private maxOnDisk(prefix: string): number {
    const type = Object.entries(RECORD_TYPES).find(([, d]) => d.prefix === prefix)?.[0] as RecordType | undefined;
    let max = 0;
    const ids: string[] = [];
    if (type) ids.push(...this.list(type).map((r) => r.id));
    else if (prefix === "E")
      for (const t of ["person", "family"] as const)
        for (const r of this.list(t)) for (const e of (r as { events?: { id: string }[] }).events ?? []) ids.push(e.id);
    for (const id of ids) {
      const n = Number(id.slice(1));
      if (id.startsWith(prefix) && n > max) max = n;
    }
    return max;
  }

  /** Allocate the next ID for a prefix. Call inside withTreeLock. */
  allocate(prefix: string): string {
    if (!Object.values(ALL_PREFIXES).includes(prefix)) throw new StromError(`unknown ID prefix ${prefix}`);
    if (this.lockDepth === 0) throw new StromError("internal: allocate() outside withTreeLock()");
    // Read once per lock, kept in memory, written when the lock is released.
    this.counters ??= readJsonIfExists<Record<string, number>>(this.countersFile()) ?? {};
    // Counters are authoritative; the disk is scanned only when one is missing.
    let next = (this.counters[prefix] ?? this.maxOnDisk(prefix)) + 1;
    // A counter edited by hand must never hand out an ID that is taken.
    const type = typeOfPrefix(prefix);
    if (type) while (fs.existsSync(this.recordPath(type, formatId(prefix, next)))) next++;
    this.counters[prefix] = next;
    return formatId(prefix, next);
  }

  /** Preview the next ID without allocating it. */
  peekId(prefix: string): string {
    const counters = this.counters ?? readJsonIfExists<Record<string, number>>(this.countersFile()) ?? {};
    return formatId(prefix, (counters[prefix] ?? this.maxOnDisk(prefix)) + 1);
  }

  // ── writing ────────────────────────────────────────────────────────────

  private opsFile(): string {
    const month = now().slice(0, 7);
    const name = this.actor === "user" || this.actor === "agent" ? `${this.actor}-${month}` : this.actor;
    return path.join(this.dataDir, "ops", `${name}.jsonl`);
  }

  private lastSig(file: string): string {
    const known = this.lastSigs.get(file);
    if (known !== undefined) return known;
    if (!fs.existsSync(file)) return "";
    const text = fs.readFileSync(file, "utf8").trimEnd();
    const last = text.slice(text.lastIndexOf("\n") + 1);
    if (!last) return "";
    try {
      return (JSON.parse(last) as Op).sig ?? "";
    } catch {
      return "";
    }
  }

  /** The tree's seal key on this computer, or undefined (tree moved here). */
  get key(): Buffer | undefined {
    if (this.keyCache === undefined) this.keyCache = loadKey(this.env, this.config.id) ?? null;
    return this.keyCache ?? undefined;
  }

  private lastStamp = 0;

  /** Strictly increasing timestamps: operations are ordered by time across logs. */
  private stamp(): string {
    this.lastStamp = Math.max(Date.now(), this.lastStamp + 1);
    return new Date(this.lastStamp).toISOString();
  }

  /** Operation logs appended to by this process (tree-relative). */
  opsFilesTouched(): string[] {
    return [...this.touchedOps].map((f) => this.relative(f));
  }

  /** Forget the cached key (after one was created on this computer). */
  reloadKey(): void {
    this.keyCache = undefined;
  }

  requireKey(): Buffer {
    const key = this.key;
    if (key) return key;
    throw new NeedsConsentError([
      {
        key: "seal",
        kind: "consent",
        question: "This tree was sealed on another computer. Take it over on this one?",
        set: "strom seal adopt",
      },
    ]);
  }

  /** Sealed commit of everything under pathspec. */
  commit(message: string, pathspec: string[] = ["."]): string | undefined {
    const key = this.requireKey();
    git.resetCache(this.root); // another process may have committed since this one last looked
    return git.commitAll(this.root, message, pathspec, (treeHash) => commitSeal(key, treeHash));
  }

  /** Append a signed operation to the current log (inside withTreeLock). */
  appendOp(op: Omit<Op, "at" | "by" | "prev" | "sig" | "k">): Op {
    const key = this.requireKey();
    const opsFile = this.opsFile();
    const entry: Op = { at: this.stamp(), by: this.actor, ...op, prev: this.lastSig(opsFile), k: fingerprint(key), sig: "" };
    entry.sig = signOp(entry as unknown as Record<string, unknown>, key);
    this.written.push(entry);
    if (!this.dryRun) {
      this.remember(opsFile);
      appendJsonLine(opsFile, entry);
      this.lastSigs.set(opsFile, entry.sig);
      this.touchedOps.add(opsFile);
    }
    return entry;
  }

  /** Validate and write a record, then log the sealed operation. Call inside withTreeLock. */
  put(input: AnyRecord, op: { op: string; targets: string[]; summary: string; reason?: string }): void {
    const record = composed(input) as AnyRecord;
    const problems = validateRecord(record);
    if (problems.length > 0) {
      throw new UsageError(`invalid ${record.type} ${record.id}: ${problems.map((p) => `${p.path} ${p.message}`).join("; ")}`, {
        details: problems,
      });
    }
    const file = this.recordPath(record.type, record.id);
    const content = stringifyCanonical(record);
    this.appendOp({ ...op, summary: op.summary.normalize("NFC"), ...(op.reason ? { reason: op.reason.normalize("NFC") } : {}), files: [{ path: this.relative(file), sha: sha256(content) }] });
    // A dry run keeps the change in memory only, so the next step of the same
    // command (a research on a person it just created) still sees it.
    if (!this.dryRun) {
      this.remember(file);
      writeFileAtomic(file, content);
    }
    this.version++;
    this.single.set(record.id, record);
    this.cache.get(record.type)?.set(record.id, record);
  }

  readOps(): Op[] {
    const dir = path.join(this.dataDir, "ops");
    if (!fs.existsSync(dir)) return [];
    const out: Op[] = [];
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".jsonl")) continue;
      for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          out.push(JSON.parse(line) as Op);
        } catch {
          // a damaged line is reported by `strom verify`
        }
      }
    }
    return out;
  }

  /** Research language for this invocation: an override from outside (--lang, STROM_LANG) or the tree's own. */
  langOverride: string | undefined;

  get lang(): string {
    return this.langOverride ?? this.config.lang;
  }

  /** Change strom.json as a logged, sealed operation. */
  updateConfig(change: (c: TreeConfig) => void, op: { op: string; summary: string }): void {
    this.withTreeLock(() => {
      change(this.config);
      const file = path.join(this.root, TREE_FILE);
      const content = stringifyCanonical(this.config);
      this.appendOp({ op: op.op, targets: [], summary: op.summary, files: [{ path: TREE_FILE, sha: sha256(content) }] });
      if (this.dryRun) return;
      this.remember(file);
      writeFileAtomic(file, content);
    });
  }
}

/**
 * Every text of a record in composed form (NFC): "č" is one letter whether it
 * came typed, copied or from a macOS file name. File paths stay as they are —
 * on Linux a decomposed name is another file.
 */
function composed(value: unknown, key = ""): unknown {
  if (typeof value === "string") return key === "file" ? value : value.normalize("NFC");
  if (Array.isArray(value)) return value.map((v) => composed(v));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, composed(v, k)]));
  return value;
}
