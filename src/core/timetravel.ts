// Returning in time (strom history back): the family tree and its evidence as they were after one change of the
// history, written as a new change — nothing deleted, the history kept whole, so a return is taken back the same way.
//
// What returns: the records of the tree and its evidence (RETURNED_TYPES), the person's decisions on its quality
// (quality/), and of strom.json what belongs to that state (the decisions on strom's fixes, the steps a newer strom
// did once in the data). A record added since is retracted with the return as its reason, never deleted: the seal
// knows no deletion (strom verify would call it one made outside strom), and a later return brings it back.
//
// What stays as it is: the operation logs (the history), the counters of IDs (an ID is never given twice), the
// agent's work and its plan (sessions, tasks, directions, lessons), the person's settings in strom.json, the history
// of the regions and places (history/: what strom found of the places, no part of the tree), and every file in the
// shared folder (nothing of strom removes one: the records returned name their images by their hashes).
//
// Data of an older schema are brought forward by the same steps of core/migrate.ts, in the same operation.

import { MIGRATIONS } from "./migrate.ts";
import { RECORD_TYPES, SCHEMA_VERSION, type AnyRecord, type Family, type Person, type RecordType, type TreeConfig } from "./model.ts";
import * as git from "./git.ts";
import { StromError, UsageError } from "./errors.ts";
import { now, TREE_FILE, type Tree } from "./tree.ts";

/** The records a return takes back to their state then: the tree and its evidence. */
export const RETURNED_TYPES: RecordType[] = ["person", "family", "source", "repository", "recordset", "place", "search", "conflict", "hypothesis", "input", "media"];

/** The folder of the person's decisions on the tree's quality, written whole by strom (core/integrity.ts). */
const QUALITY_DIR = "quality";

/** What of strom.json belongs to the state of the data, returned with it; the rest is the person's settings. */
const CONFIG_WITH_DATA = ["fixes", "settled"] as const;

/** A quality file that did not exist then: what its readers take for "nothing decided". */
const QUALITY_NONE = "{}\n";

/** The op of a return in the history (core/changelog.ts says it as "Return to the state of …"). */
export const RETURN_OP = "tree.return";

/** The commit a return goes back to: the state right after it. */
export interface ReturnTarget {
  hash: string;
  /** When it was committed (ISO, the committer's date: what strom history shows). */
  at: string;
  subject: string;
}

export interface ReturnCount {
  /** Changed since: written as they were then. */
  back: number;
  /** Added since: retracted. */
  out: number;
}

export interface ReturnPlan {
  target: ReturnTarget;
  /** The commit the plan was made against (the research now). */
  head: string;
  counts: Partial<Record<RecordType, ReturnCount>>;
  /** Facts of people and families that differ between then and now (changed, gone with a record, back with one). */
  facts: number;
  /** Files of quality/ that differ, and whether strom.json's decisions do (each one decision of the person's). */
  quality: number;
  /** The data then were of an older schema: brought forward by its migrations. */
  schemaThen: number;
  /** Nothing differs: the research is as it was then. */
  same: boolean;
  records: { id: string; type: RecordType; then?: string }[];
  qualityFiles: { rel: string; then?: string }[];
  config?: Partial<Pick<TreeConfig, (typeof CONFIG_WITH_DATA)[number]>>;
}

const DIR_TYPE = new Map<string, RecordType>(RETURNED_TYPES.map((t) => [`data/${RECORD_TYPES[t].dir}/`, t]));

const pathspec = (): string[] => [...RETURNED_TYPES.map((t) => `data/${RECORD_TYPES[t].dir}/`), `${QUALITY_DIR}/`];

/** The type and ID of a record file of the returned types (data/persons/P0001.json), else undefined. */
function recordOf(rel: string): { type: RecordType; id: string } | undefined {
  const at = rel.lastIndexOf("/");
  const type = DIR_TYPE.get(rel.slice(0, at + 1));
  if (!type || !rel.endsWith(".json")) return undefined;
  return { type, id: rel.slice(at + 1, -".json".length) };
}

/**
 * The change named: a commit of the history (its hash as strom history shows it, or longer), or a day (YYYY-MM-DD: the
 * state at its end, the last change on or before it). Only a change of this research's own line of history.
 */
export function resolveTarget(tree: Tree, spec: string): ReturnTarget {
  const said = spec.trim();
  const info = (rev: string): ReturnTarget | undefined => {
    const r = git.runGit(tree.root, ["log", "-1", "--format=%H%x1f%cI%x1f%s", rev, "--"]);
    if (r.status !== 0 || !r.stdout.trim()) return undefined;
    const [hash = "", at = "", subject = ""] = r.stdout.trim().split("\x1f");
    return { hash, at, subject };
  };
  if (/^\d{4}-\d{2}-\d{2}$/u.test(said)) {
    const r = git.runGit(tree.root, ["log", "-1", "--format=%H", `--before=${said}T23:59:59`, "HEAD", "--"]);
    const hash = r.status === 0 ? r.stdout.trim() : "";
    if (!hash)
      throw new UsageError(`no change of the research on or before ${said}`, { hint: "strom history (the changes, with their days)", code: "back.noday", params: { day: said } });
    return info(hash)!;
  }
  if (!/^[0-9a-f]{4,40}$/iu.test(said))
    throw new UsageError(`"${said}" names no change: a change as strom history shows it (8 letters and digits), or a day as YYYY-MM-DD`, {
      hint: "strom history",
      code: "back.unknown",
      params: { change: said },
    });
  const r = git.runGit(tree.root, ["rev-parse", "--verify", "--quiet", `${said.toLowerCase()}^{commit}`]);
  const hash = r.status === 0 ? r.stdout.trim() : "";
  // only a change of this research's own history (an ancestor of the state now)
  if (!hash || git.runGit(tree.root, ["merge-base", "--is-ancestor", hash, "HEAD"]).status !== 0)
    throw new UsageError(`no change ${said} in the history of this research`, { hint: "strom history", code: "back.unknown", params: { change: said } });
  return info(hash)!;
}

/** The events of a person or a family by their IDs, each as its JSON (to tell which differ). */
function factsOf(text: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (text === undefined) return out;
  try {
    const r = JSON.parse(text) as Partial<Person | Family>;
    for (const e of r.events ?? []) if (e && typeof e.id === "string") out.set(e.id, JSON.stringify(e));
  } catch {
    // a record git cannot give whole is counted as a record only
  }
  return out;
}

function differing(a: Map<string, string>, b: Map<string, string>): number {
  let n = 0;
  for (const [id, v] of a) if (b.get(id) !== v) n++;
  for (const id of b.keys()) if (!a.has(id)) n++;
  return n;
}

/**
 * What a return to the state after `target` changes: only what differs between then and now (a diff of the two
 * states, never all of the research read), the people's and families' facts counted from their two versions.
 */
export function planReturn(tree: Tree, target: ReturnTarget): ReturnPlan {
  const head = git.runGit(tree.root, ["rev-parse", "HEAD"]).stdout.trim();
  // something written and not yet in the history: never returned over (a change in the middle of being saved)
  if (git.changes(tree.root, [...pathspec(), TREE_FILE]).length)
    throw new StromError("the research holds changes not saved in its history yet: nothing returned", { hint: "strom check", code: "back.unsaved" });
  const listed = git.runGit(tree.root, ["diff", "--name-status", "--no-renames", "-z", target.hash, "HEAD", "--", ...pathspec()]);
  if (listed.status !== 0) throw new StromError(`git could not compare the research with change ${target.hash.slice(0, 8)}: ${listed.stderr.trim()}`);
  const parts = listed.stdout.split("\0").filter(Boolean);
  const changed: { status: string; rel: string }[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) changed.push({ status: parts[i]!.charAt(0), rel: parts[i + 1]! });

  // what each file was then (one git process for all of them); a file added since was not there
  const then = git.showFiles(tree.root, target.hash, changed.filter((c) => c.status !== "A").map((c) => c.rel));
  const records: ReturnPlan["records"] = [];
  const qualityFiles: ReturnPlan["qualityFiles"] = [];
  const counts: ReturnPlan["counts"] = {};
  let facts = 0;
  for (const c of changed) {
    const rec = recordOf(c.rel);
    const was = c.status === "A" ? undefined : then.get(c.rel);
    if (!rec) {
      if (c.rel.startsWith(`${QUALITY_DIR}/`)) qualityFiles.push({ rel: c.rel, ...(was !== undefined ? { then: was } : {}) });
      continue;
    }
    const nowRec = tree.get<AnyRecord>(rec.id);
    // added since and taken back already: nothing to do with it
    if (was === undefined && (!nowRec || (nowRec as { retracted?: unknown }).retracted)) continue;
    const count = (counts[rec.type] ??= { back: 0, out: 0 });
    if (was === undefined) count.out++;
    else count.back++;
    if (rec.type === "person" || rec.type === "family") {
      const nowFacts = nowRec && !(nowRec as { retracted?: unknown }).retracted ? factsOf(JSON.stringify(nowRec)) : new Map<string, string>();
      facts += differing(factsOf(was), nowFacts);
    }
    records.push({ id: rec.id, type: rec.type, ...(was !== undefined ? { then: was } : {}) });
  }

  // strom.json then: its schema, and the decisions that go with the data
  let schemaThen = tree.config.schema ?? 1;
  let config: ReturnPlan["config"];
  const cfgText = git.showFile(tree.root, target.hash, TREE_FILE);
  if (cfgText !== undefined) {
    try {
      const cfg = JSON.parse(cfgText) as Partial<TreeConfig>;
      schemaThen = typeof cfg.schema === "number" ? cfg.schema : 1;
      const differs = CONFIG_WITH_DATA.some((k) => JSON.stringify(cfg[k] ?? null) !== JSON.stringify(tree.config[k] ?? null));
      if (differs) config = Object.fromEntries(CONFIG_WITH_DATA.map((k) => [k, cfg[k]])) as ReturnPlan["config"];
    } catch {
      // strom.json of then unreadable: the decisions stay as they are now
    }
  }
  const quality = qualityFiles.length + (config ? 1 : 0);
  return { target, head, counts, facts, quality, schemaThen, same: records.length === 0 && quality === 0, records, qualityFiles, ...(config ? { config } : {}) };
}

/** The reason written into each record a return retracts (it was added after the state returned to). */
export function returnReason(target: ReturnTarget): string {
  return `return to the state of ${target.at} (${target.hash.slice(0, 8)})`;
}

/** The summary of a return's operation (core/changelog.ts reads the time from it). */
export function returnSummary(plan: ReturnPlan): string {
  const back = Object.values(plan.counts).reduce((n, c) => n + (c?.back ?? 0), 0);
  const out = Object.values(plan.counts).reduce((n, c) => n + (c?.out ?? 0), 0);
  return `Return to the state of ${plan.target.at} (${plan.target.hash.slice(0, 8)}): ${back} record(s) as they were, ${out} added later retracted, ${plan.quality} decision(s) on quality`;
}

/**
 * Write the return as one logged, sealed operation (call inside withTreeLock): each record as it was then, each added
 * since retracted, quality/ as it was, strom.json's decisions of then; data of an older schema brought forward after.
 */
export function applyReturn(tree: Tree, plan: ReturnPlan): void {
  const head = git.runGit(tree.root, ["rev-parse", "HEAD"]).stdout.trim();
  if (head !== plan.head) throw new StromError("the research changed since the preview: nothing returned", { hint: "strom history back (the preview again)", code: "back.moved" });
  const at = now();
  const reason = returnReason(plan.target);
  const inputs: AnyRecord[] = [];
  for (const r of plan.records) {
    if (r.then !== undefined) {
      inputs.push(JSON.parse(r.then) as AnyRecord);
      continue;
    }
    const rec = tree.get<AnyRecord>(r.id);
    if (!rec || (rec as { retracted?: unknown }).retracted) continue;
    inputs.push({ ...rec, retracted: { at, reason } } as AnyRecord);
  }
  const files = plan.qualityFiles.map((f) => ({ rel: f.rel, content: f.then ?? QUALITY_NONE }));
  const config = plan.config
    ? (c: TreeConfig) => {
        for (const k of CONFIG_WITH_DATA) {
          const v = plan.config![k];
          if (v === undefined) delete c[k];
          else (c as unknown as Record<string, unknown>)[k] = v;
        }
      }
    : undefined;
  tree.putMany(inputs, files, { op: RETURN_OP, targets: plan.records.map((r) => r.id), summary: returnSummary(plan), reason }, config);
  // the data then of an older schema: the same steps as when this strom first opened them
  for (const m of MIGRATIONS.filter((x) => x.to > plan.schemaThen && x.to <= SCHEMA_VERSION).sort((a, b) => a.to - b.to)) m.run(tree);
}
