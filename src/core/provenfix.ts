// strom fixes proven-originals: before strom PROVEN_SINCE a fact could be proven on any record with primary
// information — a copy, an index's line, a transcript of another hand's, or a source the Strom app alone called an
// original (its QUAY). Since then proven needs the original record itself (core/evidence.ts isOriginalHere). Set right
// once by rules: a fact proven without a citation of the original that an agent made proven — or a run of many writes
// (an import, the conversion of an old research, a batch: core/readers.ts bulkWrites) — becomes probable (possible where
// no record backs it), with the reason in the history; one a person made proven stays as it is and waits for their
// review as one item with a count (What waits, the bridge's `waiting`), until they keep or lower it. One with the
// original cited stays. Free, one operation, kept for its undo (PROVEN_FIX_FILE).

import fs from "node:fs";
import path from "node:path";
import type { Event, Family, Person, Source, TreeConfig } from "./model.ts";
import { now, VERSION, type Op, type Tree } from "./tree.ts";
import { isWeak, provesIt } from "./evidence.ts";
import { bulkWrites, fixedDecision } from "./readers.ts";
import { freshConfig, quiet } from "./hypolinks.ts";
import { writableUnasked } from "./integrity.ts";
import { skipFile } from "./verify.ts";

/** The strom version from which proven needs the original record. */
export const PROVEN_SINCE = "1.29.0";
/** The marker in strom.json: the facts proven without the original set right once. */
export const PROVEN_SETTLED = "proven-originals-1";
/** Where the fix keeps what it changed and what waits for the person's review (sealed; travels with the research). */
export const PROVEN_FIX_FILE = "quality/proven.json";
/** The reason each fact made probable carries in the history. */
const REASON = "proven needs the original record itself: none of its citations is one (a copy, an index, a transcript or the Strom app's word for a source)";

/** One fact proven without the original that an agent (or a run of many writes) made proven: made probable. */
export interface ProvenFix {
  event: string;
  owner: string;
  kind: string;
  date?: string;
  /** The status it gets: probable, possible where no record backs it. */
  to: "probable" | "possible";
}

/** One a person made proven: stays, for their review. */
export interface ProvenLeft {
  event: string;
  owner: string;
  kind: string;
  date?: string;
}

export interface ProvenFindings {
  fixes: ProvenFix[];
  left: ProvenLeft[];
}

interface ProvenFile {
  v: 1;
  /** Each time the fix set things right, newest last. */
  runs: { at: string; version: string; items: ProvenFix[] }[];
  /** The facts a person made proven without the original: wait for their review. */
  review: string[];
  /** Of them, those the person kept proven after looking (never asked again). */
  kept: string[];
  /** When the facts began to wait for the person's review (What waits says since when). */
  since?: string;
}

const EVENT_ID = /(?<![\p{L}\p{M}\p{N}])E\p{N}{4,}(?![\p{L}\p{M}\p{N}])/gu;
const byId = (a: { event: string }, b: { event: string }) => a.event.localeCompare(b.event, undefined, { numeric: true });

/** The facts proven with no citation of the original record, each with its owner. */
function unbacked(tree: Tree): { e: Event; owner: Person | Family }[] {
  const out: { e: Event; owner: Person | Family }[] = [];
  for (const owner of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
    if (owner.retracted || owner.mergedInto) continue;
    for (const e of owner.events) if (!e.retracted && e.status === "proven" && !e.citations.some((c) => provesIt(tree, c))) out.push({ e, owner });
  }
  return out;
}

/** What the fix finds: nothing once it ran here (the marker in strom.json). */
export function provenFixes(tree: Tree): ProvenFindings {
  const out: ProvenFindings = { fixes: [], left: [] };
  if (tree.config.settled?.includes(PROVEN_SETTLED)) return out;
  const found = unbacked(tree);
  if (!found.length) return out;
  const ids = new Set(found.map((f) => f.e.id));
  // who last wrote each fact: the history's last operation naming it
  const last = new Map<string, Op>();
  for (const o of tree.readOps())
    for (const id of new Set([...o.targets, ...(o.summary.match(EVENT_ID) ?? [])]))
      if (ids.has(id) && (!last.has(id) || last.get(id)!.at <= o.at)) last.set(id, o);
  const bulk = bulkWrites(tree);
  for (const { e, owner } of found) {
    const o = last.get(e.id);
    const base = { event: e.id, owner: owner.id, kind: e.kind, ...(e.date ? { date: e.date } : {}) };
    // a person's own write (none found: theirs too — a person's word is never lowered unasked)
    if (!o || (o.by === "user" && !bulk.has(o.sig))) out.left.push(base);
    else out.fixes.push({ ...base, to: e.citations.some((c) => !isWeak(tree.get<Source>(c.source))) ? "probable" : "possible" });
  }
  out.fixes.sort(byId);
  out.left.sort(byId);
  return out;
}

function readFile(tree: Tree): ProvenFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...PROVEN_FIX_FILE.split("/")), "utf8")) as Partial<ProvenFile>;
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [], review: list(f.review), kept: list(f.kept), ...(typeof f.since === "string" ? { since: f.since } : {}) };
  } catch {
    return { v: 1, runs: [], review: [], kept: [] };
  }
}

const fileContent = (f: ProvenFile) => JSON.stringify(f, null, 2) + "\n";

const settledWith = (config?: (c: TreeConfig) => void) => (c: TreeConfig) => {
  c.settled = [...new Set([...(c.settled ?? []), PROVEN_SETTLED])];
  config?.(c);
};

/** The owners of the facts with each fact's status set, as they are now. */
function withStatus(tree: Tree, items: { event: string; owner: string }[], status: (id: string) => Event["status"] | undefined, at: string): (Person | Family)[] {
  const owners = new Map<string, Person | Family>();
  for (const it of items) {
    const was = owners.get(it.owner) ?? tree.get<Person | Family>(it.owner);
    if (!was) continue;
    const to = status(it.event);
    if (!to) continue;
    owners.set(it.owner, { ...structuredClone(was), events: was.events.map((e) => (e.id === it.event ? { ...e, status: to } : e)), updated: at });
  }
  return [...owners.values()];
}

/**
 * The fix: each fact found made probable (possible), the reason in the history; the facts a person made proven kept
 * for their review — the marker in strom.json, one operation (the marker alone when nothing is found). Inside withTreeLock.
 */
export function applyProven(tree: Tree, items: ProvenFix[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; left: number } {
  const at = now();
  const found = provenFixes(tree);
  const done = items.filter((it) => found.fixes.some((f) => f.event === it.event));
  const file = readFile(tree);
  const review = [...new Set([...file.review, ...found.left.map((l) => l.event)])];
  if (!done.length && !found.left.length) {
    tree.updateConfig(settledWith(config), { op: "tree.settle", summary: "the facts proven without the original record: none here" });
    return { changed: 0, records: 0, left: 0 };
  }
  const records = withStatus(tree, done, (id) => done.find((d) => d.event === id)?.to, at);
  if (done.length) file.runs.push({ at, version, items: done });
  if (found.left.length && !file.since) file.since = at;
  file.review = review;
  tree.putMany(
    records,
    [{ rel: PROVEN_FIX_FILE, content: fileContent(file) }],
    {
      op: "proven.fix",
      targets: [...records.map((r) => r.id), ...done.map((d) => d.event)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      summary: `facts proven without the original record made probable: ${done.length} in ${records.length} records, ${found.left.length} a person made proven waiting for their review (fix proven-originals)`,
      reason: REASON,
    },
    settledWith(config),
  );
  return { changed: done.length, records: records.length, left: found.left.length };
}

/** What the fix made probable and is not undone yet. */
export function provenDone(tree: Tree): ProvenFix[] {
  return readFile(tree).runs.flatMap((r) => r.items);
}

/**
 * The fix undone: each fact proven again where it is still as the fix left it (its status the fix gave it). One
 * operation; what the fix kept is emptied (what waits for the person's review stays).
 */
export function undoProven(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const file = readFile(tree);
  const items = file.runs.flatMap((r) => r.items);
  if (!items.length) return { restored: 0, records: 0, left: 0 };
  const at = now();
  const still = items.filter((it) => {
    const o = tree.get<Person | Family>(it.owner);
    return o?.events.some((e) => e.id === it.event && !e.retracted && e.status === it.to);
  });
  const records = withStatus(tree, still, () => "proven", at);
  const left = items.length - still.length;
  tree.putMany(
    records,
    [{ rel: PROVEN_FIX_FILE, content: fileContent({ ...file, runs: [] }) }],
    {
      op: "proven.unfix",
      targets: [...records.map((r) => r.id), ...still.map((s) => s.event)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      summary: `facts made probable for want of the original record proven again: ${still.length} in ${records.length} records${left ? `, ${left} changed since left` : ""} (fix proven-originals undone)`,
    },
    config,
  );
  return { restored: still.length, records: records.length, left };
}

/** The facts a person made proven without the original that wait for their review: still so, not kept by them. */
export function provenToReview(tree: Tree): ProvenLeft[] {
  const file = readFile(tree);
  if (!file.review.length) return [];
  const kept = new Set(file.kept);
  const asked = new Set(file.review.filter((id) => !kept.has(id)));
  return unbacked(tree)
    .filter(({ e }) => asked.has(e.id))
    .map(({ e, owner }) => ({ event: e.id, owner: owner.id, kind: e.kind, ...(e.date ? { date: e.date } : {}) }))
    .sort(byId);
}

/** Since when the facts a person made proven without the original wait for their review ("" when it is not known). */
export function provenReviewSince(tree: Tree): string {
  const file = readFile(tree);
  return file.since ?? file.runs.at(-1)?.at ?? "";
}

/**
 * The person's answer to the review: kept proven as they are (asked no more), or made probable (possible where no
 * record backs it) — theirs, one operation. Inside withTreeLock. How many it touched.
 */
export function answerProven(tree: Tree, ids: string[], answer: "keep" | "lower"): number {
  const asked = provenToReview(tree).filter((l) => ids.includes(l.event));
  if (!asked.length) return 0;
  const file = readFile(tree);
  if (answer === "keep") {
    file.kept = [...new Set([...file.kept, ...asked.map((a) => a.event)])];
    tree.putMany([], [{ rel: PROVEN_FIX_FILE, content: fileContent(file) }], {
      op: "proven.keep",
      targets: asked.map((a) => a.event),
      summary: `facts proven without the original record kept proven by the person: ${asked.length}`,
    });
    return asked.length;
  }
  const at = now();
  const to = (id: string): Event["status"] | undefined => {
    const a = asked.find((x) => x.event === id);
    const o = a ? tree.get<Person | Family>(a.owner) : undefined;
    const e = o?.events.find((x) => x.id === id);
    return e ? (e.citations.some((c) => !isWeak(tree.get<Source>(c.source))) ? "probable" : "possible") : undefined;
  };
  const records = withStatus(tree, asked, to, at);
  file.review = file.review.filter((id) => !asked.some((a) => a.event === id));
  // lowered by the person: the verification against the originals leaves them (core/verify.ts)
  tree.putMany(records, [{ rel: PROVEN_FIX_FILE, content: fileContent(file) }, skipFile(tree, asked.map((a) => a.event))], {
    op: "proven.lower",
    targets: [...records.map((r) => r.id), ...asked.map((a) => a.event)],
    summary: `facts proven without the original record made probable by the person: ${asked.length} in ${records.length} records`,
    reason: REASON,
  });
  return asked.length;
}

/**
 * Once per research, at the first start of this strom (after its backup) and at a bridge's start: the fix applied by
 * itself, its decision kept as the person's fixes are (`decision`: strom fixes undo proven-originals puts it back) — in
 * one commit. Skipped as settleReaders is (somebody at work, another computer's seal, data changed outside strom, a dry run).
 */
export function settleProven(tree: Tree, decision: (c: TreeConfig) => void = fixedDecision("proven-originals", VERSION)): { changed: number; left: number } | undefined {
  if (tree.dryRun || tree.config.settled?.includes(PROVEN_SETTLED) || !quiet(tree)) return undefined;
  let out: { changed: number; left: number } | undefined;
  tree.atomically(() => {
    if (!freshConfig(tree) || tree.config.settled?.includes(PROVEN_SETTLED) || !writableUnasked(tree)) return;
    const found = provenFixes(tree);
    const r = applyProven(tree, found.fixes, PROVEN_SINCE, found.fixes.length || found.left.length ? decision : undefined);
    tree.commit(r.changed || r.left ? `Facts proven without the original record set right: ${r.changed} made probable, ${r.left} a person made proven waiting for their review` : "Facts proven without the original record: none here");
    out = { changed: r.changed, left: r.left };
  });
  return out;
}
