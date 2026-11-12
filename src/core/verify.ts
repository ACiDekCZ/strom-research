// Verification of facts against their originals (spec 065). A fact of a birth, a baptism, a marriage, a death or a
// burial that stays probable or possible though the research cites its original record with primary information
// (core/evidence.ts provesIt) waits for an agent to look at that original: proven with the image looked at (strom verify
// done --proven --image), or kept with the reason (--kept --reason). Nothing is raised without a look at the original,
// and a value is never overwritten here: what differs is a conflict.
//
// - The sweep (queueVerify): after every session's planning (applyFrontier), after strom sync and once as the fix
//   verify-originals (settleVerify, at the first start of this strom and a bridge's start): one task per person (a
//   marriage per family), at most REVIEW_BATCH facts each, low priority, after the lines' work (core/queue.ts). Only
//   people linked to the tree, off no side branch, not living; never in an archive. What it queued, a verification
//   done (kept or proven), a person's confirmation or lowering (strom fixes review proven-originals lower) is not queued
//   again — only with a new citation of an original, or by hand.
// - By hand (verifyAsk: strom verify facts P…|E…, the Strom app): any fact not confirmed by the person, anywhere, before all
//   else in the queue; a fact with no original read is looked for (verify:search).
// - In bulk (verifyBulk: strom verify bulk, the app): a line, a lineage, the tree — the person's start alone; a family
//   tree's leads too (K6.7: no original read), their record looked for (a bulk search, dearer).
// - The person's confirmation against the scan (verifyConfirm: strom verify confirm, the app's bridge): a mark of its own.
//
// What it keeps is in VERIFY_FILE (sealed, travels with the research): the runs of the fix, what was queued with which
// citations, the facts the person lowered, and the fix's own count for the app.

import fs from "node:fs";
import path from "node:path";
import type { Citation, Event, Family, Person, Session, Source, Task, TreeConfig } from "./model.ts";
import { now, VERSION, type Tree } from "./tree.ts";
import { checkStatus, provesIt } from "./evidence.ts";
import { factMark, fixedDecision } from "./readers.ts";
import { freshConfig, quiet } from "./hypolinks.ts";
import { writableUnasked } from "./integrity.ts";
import { kinship, mainPerson } from "./kin.ts";
import { placer } from "./offline.ts";
import { directionOf, scopes } from "./directions.ts";
import { livingBorn, readersOf, REVIEW_BATCH, sameModel } from "./review.ts";
import { actsAsArchive, stateOf } from "./state.ts";
import { ancestorGenerations, displayName, familiesAsPartner, lifespan } from "./people.ts";
import { phrase } from "./phrases.ts";
import { costPartial, sessionCost } from "./session.ts";
import { UsageError } from "./errors.ts";
import { lineMarks } from "./lineages.ts";
import { lacksImages, ownTurn, runOrder, waitsForDecision } from "./queue.ts";
import { setsWithImages } from "./mediaindex.ts";
import { permissionQuestions } from "./archivewait.ts";
import { isVerifyTask, originalCites, searchesRecord, taskFacts, VERIFY_ASKED, VERIFY_AUTO, VERIFY_BULK, VERIFY_SEARCH, verifiesInTurn } from "./verifyfacts.ts";

export { VERIFY_ASKED, VERIFY_AUTO, VERIFY_BULK, VERIFY_SEARCH } from "./verifyfacts.ts";

/** The kinds of facts the sweep verifies: a life's events a register records. */
export const VERIFY_KINDS: ReadonlySet<string> = new Set(["BIRT", "CHR", "BAPM", "MARR", "DEAT", "BURI"]);
/** The strom version from which facts with their original cited are verified against it. */
export const VERIFY_SINCE = "1.30.0";
/** The marker in strom.json: the fix verify-originals ran here. */
export const VERIFY_SETTLED = "verify-originals-1";
/** The id of the fix (strom fixes show|undo verify-originals). */
export const VERIFY_FIX = "verify-originals";
/** What the verification keeps (sealed; travels with the research). */
export const VERIFY_FILE = "quality/verify.json";

/** A fact's ID. */
const FACT_ID = /^E\p{N}{4,}$/u;

/** The states of a task that still holds its facts. */
const HOLDING = new Set(["open", "doing", "parked", "waiting"]);

interface VerifyFile {
  v: 1;
  /** Each run of the fix, newest last: the tasks it made, how many facts. */
  runs: { at: string; version: string; tasks: string[]; facts: number }[];
  /** Each fact queued: the task, and the originals it cited then (a new one queues it again). */
  queued: Record<string, { task: string; cites: string[] }>;
  /**
   * Facts the person lowered (proven-originals), each with the originals it cited then: not queued by the sweep again
   * until it cites an original it did not then (spec 065 K6.8). An older file's list: none cited then.
   */
  skip: Record<string, string[]>;
  /** The fix's count for the app (/status verify fix): when, how many facts of how many people. */
  fix?: { at: string; facts: number; people: number };
}

/** A fact the sweep would queue. */
export interface VerifyItem {
  event: string;
  owner: string;
  kind: string;
  date?: string;
  /** The sources whose original it cites. */
  cites: string[];
}

/** How many facts each filter of the sweep left (the measurement of a research: strom verify status --json). */
export interface VerifyFunnel {
  /** Facts probable or possible, every kind. */
  weak: number;
  /** Of them, with the original cited with primary information. */
  withOriginal: number;
  /** Of them, of the kinds the sweep verifies. */
  kinds: number;
  confirmed: number;
  verified: number;
  queued: number;
  skipped: number;
  offTree: number;
  sideBranch: number;
  living: number;
  candidates: number;
}

function readFile(tree: Tree): VerifyFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...VERIFY_FILE.split("/")), "utf8")) as Partial<VerifyFile>;
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    const queued: VerifyFile["queued"] = {};
    if (f.queued && typeof f.queued === "object")
      for (const [k, v] of Object.entries(f.queued)) if (v && typeof v.task === "string") queued[k] = { task: v.task, cites: list(v.cites) };
    const skip: VerifyFile["skip"] = {};
    if (Array.isArray(f.skip)) for (const id of list(f.skip)) skip[id] = [];
    else if (f.skip && typeof f.skip === "object") for (const [k, v] of Object.entries(f.skip)) skip[k] = list(v);
    return {
      v: 1,
      runs: Array.isArray(f.runs) ? f.runs : [],
      queued,
      skip,
      ...(f.fix && typeof f.fix.at === "string" ? { fix: f.fix } : {}),
    };
  } catch {
    return { v: 1, runs: [], queued: {}, skip: {} };
  }
}

const byId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

function fileContent(f: VerifyFile): string {
  const sorted = <T>(r: Record<string, T>) => Object.fromEntries(Object.keys(r).sort(byId).map((k) => [k, r[k]!]));
  return JSON.stringify({ ...f, queued: sorted(f.queued), skip: sorted(f.skip) }, null, 2) + "\n";
}

const fileOf = (f: VerifyFile) => ({ rel: VERIFY_FILE, content: fileContent(f) });

/** Every set holds the other's every item. */
const covers = (have: string[] | undefined, want: string[]) => !!have && want.every((x) => have.includes(x));

/** The persons a fact is judged by: the person, or a family's partners. */
function peopleOf(tree: Tree, owner: Person | Family): Person[] {
  if (owner.type === "person") return [owner];
  return owner.partners.map((id) => tree.get<Person>(id)).filter((p): p is Person => !!p && p.type === "person" && !p.retracted);
}

const liveOwners = (tree: Tree): (Person | Family)[] => [...tree.list<Person>("person"), ...tree.list<Family>("family")].filter((o) => !o.retracted && !o.mergedInto);

/**
 * The facts the person lowered in the review of proven-originals (its history): the sweep leaves them until they cite
 * an original — none did then (proven-originals finds the proven ones citing none).
 */
function loweredFacts(tree: Tree): string[] {
  const out = new Set<string>();
  for (const o of tree.readOps()) if (o.op === "proven.lower") for (const id of o.targets) if (/^E\p{N}{4,}$/u.test(id)) out.add(id);
  return [...out];
}

/** The facts with the originals each cites now: what the skip list keeps of them. */
function citedNow(tree: Tree, ids: string[]): Record<string, string[]> {
  const want = new Set(ids);
  const out: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, []]));
  for (const owner of liveOwners(tree)) for (const e of owner.events) if (want.has(e.id)) out[e.id] = originalCites(tree, e);
  return out;
}

/**
 * The facts the sweep would queue now: probable or possible, of VERIFY_KINDS, the original cited (provesIt), not
 * confirmed by the person, not verified or queued with these originals already, not lowered by the person; of people
 * linked to the tree, off no side branch, not living. None in an archive (or a research waiting for its agent).
 */
export function verifyCandidates(tree: Tree, funnel?: VerifyFunnel, file: VerifyFile = readFile(tree)): VerifyItem[] {
  if (actsAsArchive(tree)) return [];
  const kin = kinship(tree);
  let place: ReturnType<typeof placer> | undefined;
  const out: VerifyItem[] = [];
  const judged = new Map<string, "offTree" | "sideBranch" | "living" | undefined>();
  const judge = (owner: Person | Family) => {
    if (judged.has(owner.id)) return judged.get(owner.id);
    const people = peopleOf(tree, owner);
    let why: "offTree" | "sideBranch" | "living" | undefined;
    if (kin.size && !people.some((p) => kin.has(p.id))) why = "offTree";
    else if ((place ??= placer(tree, scopes(tree)))({ subject: [owner.id], what: "", why: "", doneWhen: "" }).off) why = "sideBranch";
    else if (!people.length || people.some((p) => livingBorn(tree, p) !== undefined)) why = "living";
    judged.set(owner.id, why);
    return why;
  };
  for (const owner of liveOwners(tree))
    for (const e of owner.events) {
      if (e.retracted || (e.status !== "probable" && e.status !== "possible")) continue;
      if (funnel) funnel.weak++;
      const cites = originalCites(tree, e);
      if (!cites.length) continue;
      if (funnel) funnel.withOriginal++;
      if (!VERIFY_KINDS.has(e.kind) || (e.kind === "MARR") !== (owner.type === "family")) continue;
      if (funnel) funnel.kinds++;
      if (e.confirmed) {
        if (funnel) funnel.confirmed++;
        continue;
      }
      if (e.verified && covers(e.verified.cites, cites)) {
        if (funnel) funnel.verified++;
        continue;
      }
      if (covers(file.queued[e.id]?.cites, cites)) {
        if (funnel) funnel.queued++;
        continue;
      }
      if (covers(file.skip[e.id], cites)) {
        if (funnel) funnel.skipped++;
        continue;
      }
      const why = judge(owner);
      if (why) {
        if (funnel) funnel[why]++;
        continue;
      }
      if (funnel) funnel.candidates++;
      out.push({ event: e.id, owner: owner.id, kind: e.kind, ...(e.date ? { date: e.date } : {}), cites });
    }
  return out;
}

/** An empty funnel to count into. */
export const emptyFunnel = (): VerifyFunnel => ({ weak: 0, withOriginal: 0, kinds: 0, confirmed: 0, verified: 0, queued: 0, skipped: 0, offTree: 0, sideBranch: 0, living: 0, candidates: 0 });

/** The facts held by a task still to be done (any task: a review's too). */
function heldFacts(tree: Tree): Map<string, Task> {
  const out = new Map<string, Task>();
  for (const t of tree.list<Task>("task")) if (HOLDING.has(t.state) && !t.retracted) for (const w of t.where) if (w.startsWith("E") && !out.has(w)) out.set(w, t);
  return out;
}

/** A fact as a task lists it: "E0001 BIRT 1820". */
const factLabel = (e: Pick<Event, "id" | "kind" | "date">) => `${e.id} ${e.kind}${e.date ? ` ${e.date}` : ""}`;

/** Whose facts: a person's name and years, a couple's names. */
function ownerName(tree: Tree, owner: Person | Family): string {
  const named = (p: Person) => `${displayName(p)}${lifespan(p) ? ` (${lifespan(p)})` : ""}`;
  if (owner.type === "person") return named(owner);
  const ps = peopleOf(tree, owner);
  return ps.length ? ps.map(named).join(" & ") : owner.id;
}

type Kind = "read" | "search";

/** A task's `what` holds at most this many characters (core/schema.ts). */
const WHAT_MAX = 200;

const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" });

/** At most `max` code points (as the schema counts them), cut between characters only (a letter with its marks, an emoji); "…" where cut. */
function fitText(text: string, max: number): string {
  if (Array.from(text).length <= max) return text;
  let out = "";
  let n = 0;
  for (const { segment } of graphemes.segment(text)) {
    const len = Array.from(segment).length;
    if (n + len > max - 1) break;
    out += segment;
    n += len;
  }
  return `${out.trimEnd()}…`;
}

/**
 * A task's `what` naming its facts: as many of them as fit WHAT_MAX, the rest counted ("… (+5)"); the facts themselves
 * are its `where`, all of them. Never longer than the schema allows (found 2026-11-08: a person with 16 residences).
 */
function whatOf(make: (list: string) => string, labels: string[]): string {
  for (let shown = labels.length; shown >= 0; shown--) {
    const rest = labels.length - shown;
    const list = labels.slice(0, shown).join(", ") + (rest ? `${shown ? ", " : ""}… (+${rest})` : "");
    const what = make(list).normalize("NFC");
    if (Array.from(what).length <= WHAT_MAX) return what;
  }
  return fitText(make(`… (+${labels.length})`).normalize("NFC"), WHAT_MAX);
}

/** The texts of a task of verification for these facts (rewritten whole when facts join it); a search of a bulk one's not asked for one by one. */
function texts(tree: Tree, owner: Person | Family, facts: Event[], kind: Kind, asked: boolean): Pick<Task, "what" | "why" | "doneWhen"> {
  const lang = tree.lang;
  const v = { name: ownerName(tree, owner), id: owner.id, list: facts.map(factLabel).join(", "), count: facts.length };
  const what = whatOf((list) => phrase(lang, kind === "search" ? "verify.search.what" : "verify.what", { ...v, list }), facts.map(factLabel));
  if (kind === "search") return { what, why: phrase(lang, asked ? "verify.search.why" : "verify.bulk.search.why", v), doneWhen: phrase(lang, "verify.search.done", v) };
  return { what, why: phrase(lang, asked ? "verify.asked.why" : "verify.why", v), doneWhen: phrase(lang, "verify.done", v) };
}

/** A new task of verification (not written: the caller writes it in its one operation); a search: its record looked for first. */
function newTask(tree: Tree, owner: Person | Family, facts: Event[], origin: string, fields: Partial<Task>, research?: string, kind: Kind = origin === VERIFY_SEARCH ? "search" : "read"): Task {
  const at = now();
  return {
    id: tree.allocate("T"),
    type: "task",
    level: kind === "search" ? "link" : "verify",
    priority: 1,
    ...texts(tree, owner, facts, kind, origin === VERIFY_ASKED || origin === VERIFY_SEARCH),
    where: facts.map((e) => e.id),
    subject: [owner.id],
    ...(research ? { research } : {}),
    state: "open",
    origin,
    notes: [],
    created: at,
    updated: at,
    ...fields,
  } as Task;
}

/** The line a fact's owner belongs to (none: the queue works it out). */
function lineOf(tree: Tree, owner: Person | Family, all: ReturnType<typeof scopes>): string | undefined {
  return directionOf(tree, { subject: [owner.id], what: "", why: "", doneWhen: "" } as Task, all);
}

/** Is a fact of a task resolved: verified by it (or since it was made), confirmed by the person, proven, taken back, gone. */
function resolved(e: Event | undefined, t: Task): boolean {
  if (!e || e.retracted || e.confirmed) return true;
  if (e.verified && (e.verified.task === t.id || e.verified.at >= t.created)) return true;
  // a bulk verification is of proven facts too: proven alone resolves the others (and a bulk search: its record read)
  return (t.origin !== VERIFY_BULK || searchesRecord(t)) && e.status === "proven";
}

export interface QueueResult {
  /** Tasks made or that took facts. */
  tasks: string[];
  facts: number;
  people: number;
  /** Tasks of the sweep dropped: every fact of theirs resolved before anyone took them. */
  dropped: string[];
}

/**
 * The sweep: the facts verifyCandidates finds queued, one task per person (a marriage per family) of at most
 * REVIEW_BATCH facts — an open task of the sweep for the same owner takes more first —, low priority, after the lines'
 * work. A fact a task still holds (any task) is left. Tasks of the sweep whose facts are all resolved go (dropped). One
 * operation (`verify.queue`), nothing when there is nothing to do; inside the tree's lock. Never in an archive.
 */
export function queueVerify(tree: Tree, opts: { items?: VerifyItem[]; op?: string; summary?: string; config?: (c: TreeConfig) => void; file?: (f: VerifyFile, r: QueueResult) => void } = {}): QueueResult {
  return tree.withTreeLock(() => {
    const out: QueueResult = { tasks: [], facts: 0, people: 0, dropped: [] };
    if (actsAsArchive(tree)) return out;
    const file = readFile(tree);
    const held = heldFacts(tree);
    const items = (opts.items ?? verifyCandidates(tree, undefined, file)).filter((i) => !held.has(i.event));
    const records: Task[] = [];
    const at = now();
    // the sweep's tasks whose facts are all resolved before anyone took them: dropped
    for (const t of tree.list<Task>("task")) {
      if (t.state !== "open" || t.retracted || !verifiesInTurn(t) || t.queueAt) continue;
      const facts = new Map(taskFacts(tree, t).map((f) => [f.event.id, f.event]));
      if (t.where.every((id) => resolved(facts.get(id), t))) {
        records.push({ ...t, state: "dropped", result: phrase(tree.lang, "verify.dropped.resolved"), updated: at });
        out.dropped.push(t.id);
      }
    }
    const all = scopes(tree);
    const byOwner = new Map<string, VerifyItem[]>();
    for (const i of items) (byOwner.get(i.owner) ?? byOwner.set(i.owner, []).get(i.owner)!).push(i);
    const open = tree.list<Task>("task").filter((t) => t.state === "open" && !t.retracted && t.origin === VERIFY_AUTO && !out.dropped.includes(t.id));
    const people = new Set<string>();
    for (const [ownerId, list] of byOwner) {
      const owner = tree.get<Person | Family>(ownerId)!;
      const events = list.map((i) => owner.events.find((e) => e.id === i.event)!).filter(Boolean);
      let rest = events;
      // an open task of the sweep for this owner takes more first, up to REVIEW_BATCH
      const mine = open.find((t) => t.subject[0] === ownerId && t.where.length < REVIEW_BATCH);
      if (mine) {
        const room = REVIEW_BATCH - mine.where.length;
        const take = rest.slice(0, room);
        rest = rest.slice(room);
        const facts = [...taskFacts(tree, mine).map((f) => f.event), ...take];
        records.push({ ...mine, ...texts(tree, owner, facts, "read", false), where: [...mine.where, ...take.map((e) => e.id)], updated: at });
        for (const e of take) file.queued[e.id] = { task: mine.id, cites: list.find((i) => i.event === e.id)!.cites };
        out.tasks.push(mine.id);
      }
      const research = lineOf(tree, owner, all);
      for (let i = 0; i < rest.length; i += REVIEW_BATCH) {
        const batch = rest.slice(i, i + REVIEW_BATCH);
        const t = newTask(tree, owner, batch, VERIFY_AUTO, {}, research);
        records.push(t);
        for (const e of batch) file.queued[e.id] = { task: t.id, cites: list.find((x) => x.event === e.id)!.cites };
        out.tasks.push(t.id);
      }
      out.facts += events.length;
      for (const p of peopleOf(tree, owner)) people.add(p.id);
    }
    out.people = people.size;
    opts.file?.(file, out);
    if (!records.length && !opts.config) return out;
    tree.putMany(
      records,
      [fileOf(file)],
      {
        op: opts.op ?? "verify.queue",
        targets: [...new Set([...records.map((r) => r.id), ...items.map((i) => i.event)])].sort(byId),
        summary:
          opts.summary ??
          `facts with the original cited queued to be verified against it: ${out.facts} of ${out.people} people in ${out.tasks.length} tasks${out.dropped.length ? `, ${out.dropped.length} tasks with every fact resolved dropped` : ""}`,
      },
      opts.config,
    );
    return out;
  });
}

const settledWith = (config?: (c: TreeConfig) => void) => (c: TreeConfig) => {
  c.settled = [...new Set([...(c.settled ?? []), VERIFY_SETTLED])];
  config?.(c);
};

/**
 * The fix: the facts the person lowered kept out, the sweep run, what it made recorded for the undo and for the app —
 * the marker in strom.json, one operation (`verify.fix`). Inside the tree's lock. An archive: the marker alone.
 */
export function applyVerify(tree: Tree, items: VerifyItem[] | undefined, version: string, config?: (c: TreeConfig) => void): { changed: number; records: number; people: number } {
  return tree.withTreeLock(() => {
    if (actsAsArchive(tree)) {
      tree.updateConfig(settledWith(config), { op: "tree.settle", summary: "facts to verify against their originals: an archive, none queued" });
      return { changed: 0, records: 0, people: 0 };
    }
    const at = now();
    const before = readFile(tree);
    // lowered by the person in an older strom's review (its history): none cited an original then
    const skip = { ...Object.fromEntries(loweredFacts(tree).map((id) => [id, [] as string[]])), ...before.skip };
    const file0: VerifyFile = { ...before, skip };
    const found = items ?? verifyCandidates(tree, undefined, file0);
    const chosen = found.filter((i) => !covers(skip[i.event], i.cites));
    const r = queueVerify(tree, {
      items: chosen,
      op: "verify.fix",
      config: settledWith(config),
      file: (f, res) => {
        f.skip = skip;
        if (res.tasks.length) {
          f.runs.push({ at, version, tasks: res.tasks, facts: res.facts });
          f.fix = { at, facts: res.facts, people: res.people };
        }
      },
      summary: `facts with the original cited queued once to be verified against it: ${chosen.length} (fix ${VERIFY_FIX})`,
    });
    return { changed: r.facts, records: r.tasks.length, people: r.people };
  });
}

/** What the fix queued and is not undone yet: its facts. */
export function verifyDone(tree: Tree): number {
  return readFile(tree).runs.reduce((n, r) => n + r.facts, 0);
}

/**
 * The fix undone: its tasks still open that no session worked on dropped, with the reason; what they queued stays
 * queued (they come again only with a new original cited, or by hand). The marker stays. One operation.
 */
export function undoVerify(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  return tree.withTreeLock(() => {
    const file = readFile(tree);
    const made = file.runs.flatMap((r) => r.tasks);
    if (!made.length) return { restored: 0, records: 0, left: 0 };
    const worked = new Set(tree.list<Session>("session").map((s) => s.task).filter((x): x is string => !!x));
    const at = now();
    const records: Task[] = [];
    let facts = 0;
    let left = 0;
    for (const id of made) {
      const t = tree.get<Task>(id);
      if (!t || t.state !== "open" || worked.has(id)) {
        left++;
        continue;
      }
      records.push({ ...t, state: "dropped", result: phrase(tree.lang, "verify.dropped.undo"), updated: at });
      facts += t.where.length;
    }
    const { fix: _fix, ...rest } = file;
    tree.putMany(
      records,
      [fileOf({ ...rest, runs: [] })],
      {
        op: "verify.unfix",
        targets: records.map((r) => r.id).sort(byId),
        summary: `tasks of the fix ${VERIFY_FIX} dropped: ${records.length} (${facts} facts)${left ? `, ${left} at work or done left` : ""}`,
        reason: `the person undid the fix ${VERIFY_FIX}`,
      },
      config,
    );
    return { restored: records.length, records: records.length, left };
  });
}

/** The candidates the fix would queue (strom fixes show verify-originals): nothing once it ran here. */
export function verifyFixes(tree: Tree): VerifyItem[] {
  if (tree.config.settled?.includes(VERIFY_SETTLED)) return [];
  const file = readFile(tree);
  return verifyCandidates(tree, undefined, file);
}

/** What the fix queued here and is not undone: how many facts of how many people in which tasks, and the facts. */
export interface VerifyQueued {
  facts: number;
  people: number;
  tasks: string[];
  at?: string;
  /** The facts its tasks took (as they are now; one withdrawn since left out). */
  items: VerifyItem[];
}

/**
 * What the fix queued and is not undone (strom fixes show verify-originals once it ran here): its runs' count, its tasks
 * and the facts they took. Nothing when it queued nothing (or was undone).
 */
export function verifyQueued(tree: Tree): VerifyQueued | undefined {
  const file = readFile(tree);
  const facts = file.runs.reduce((n, r) => n + r.facts, 0);
  if (!facts) return undefined;
  const tasks = [...new Set(file.runs.flatMap((r) => r.tasks))];
  const mine = new Set(tasks);
  const events = new Map<string, { owner: Person | Family; e: Event }>();
  for (const owner of liveOwners(tree)) for (const e of owner.events) if (!e.retracted && mine.has(file.queued[e.id]?.task ?? "")) events.set(e.id, { owner, e });
  const items = Object.keys(file.queued)
    .sort(byId)
    .flatMap((id): VerifyItem[] => {
      const f = events.get(id);
      return f ? [{ event: id, owner: f.owner.id, kind: f.e.kind, ...(f.e.date ? { date: f.e.date } : {}), cites: file.queued[id]!.cites }] : [];
    });
  return { facts, people: file.fix?.people ?? 0, tasks, ...(file.fix?.at ? { at: file.fix.at } : {}), items };
}

/**
 * Once per research, at the first start of this strom (after its backup) and at a bridge's start: the fix applied by
 * itself, its decision kept as the person's fixes are — in one commit. A research waiting for its agent: nothing yet
 * (the fix runs once the agent is here); an archive: the marker alone. Skipped as settleProven is.
 */
export function settleVerify(tree: Tree, decision: (c: TreeConfig) => void = fixedDecision(VERIFY_FIX, VERSION)): { facts: number; people: number } | undefined {
  if (tree.dryRun || tree.config.settled?.includes(VERIFY_SETTLED) || !quiet(tree)) return undefined;
  if (stateOf(tree) === "waiting") return undefined;
  let out: { facts: number; people: number } | undefined;
  tree.atomically(() => {
    if (!freshConfig(tree) || tree.config.settled?.includes(VERIFY_SETTLED) || !writableUnasked(tree)) return;
    const r = applyVerify(tree, undefined, VERIFY_SINCE, actsAsArchive(tree) ? undefined : decision);
    tree.commit(r.changed ? `Facts with the original cited queued to be verified against it: ${r.changed} of ${r.people} people in ${r.records} tasks` : "Facts with the original cited to verify against it: none here");
    out = { facts: r.changed, people: r.people };
  });
  return out;
}

/**
 * The facts the person lowered, added to what the sweep keeps out (proven-originals' review) with the originals they
 * cite now — a new one queues them again (K6.8): the file to write with it.
 */
export function skipFile(tree: Tree, ids: string[]): { rel: string; content: string } {
  const f = readFile(tree);
  f.skip = { ...f.skip, ...citedNow(tree, ids) };
  return fileOf(f);
}

// ——— by hand ———

export type VerifyTarget = { person: string } | { family: string } | { fact: string };

export interface Estimate {
  sessions: number;
  usd?: number;
}

/** What a session of verification costs here: the sessions ended so far, those on verification first (none: undefined). */
export function verifyCost(tree: Tree): number | undefined {
  const tasks = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  const ended = tree.list<Session>("session").filter((s) => s.state !== "open" && !costPartial(s.metrics) && sessionCost(s.metrics) !== undefined);
  const onVerify = ended.filter((s) => s.task && tasks.get(s.task)?.level === "verify");
  const of = onVerify.length ? onVerify : ended;
  if (!of.length) return undefined;
  return of.reduce((n, s) => n + sessionCost(s.metrics)!, 0) / of.length;
}

const estimate = (sessions: number, avg: number | undefined): Estimate => ({ sessions, ...(avg !== undefined ? { usd: Math.round(avg * sessions * 100) / 100 } : {}) });

const err = (message: string, code: string, hint?: string) => new UsageError(message, { code, ...(hint ? { hint } : {}) });

/** The owner and facts a target names (person: theirs and their marriages'), or why not. */
function targetFacts(tree: Tree, target: VerifyTarget): { owners: (Person | Family)[]; facts: { event: Event; owner: Person | Family }[]; person?: Person } {
  if ("fact" in target) {
    const id = String(target.fact).trim().toUpperCase();
    if (!/^E\p{N}{4,}$/u.test(id)) throw err(`not a fact ID: ${target.fact}`, "verify.invalid", "a fact's ID: E0001 (strom person show <who>)");
    for (const owner of liveOwners(tree)) {
      const e = owner.events.find((x) => x.id === id);
      if (!e) continue;
      if (e.retracted) throw err(`${id} was taken back`, "verify.retracted");
      return { owners: [owner], facts: [{ event: e, owner }] };
    }
    throw err(`no fact ${id}`, "verify.unknown", "fact IDs are listed in strom person show <who>");
  }
  const id = String("person" in target ? target.person : target.family).trim().toUpperCase();
  const type = "person" in target ? "person" : "family";
  if (!new RegExp(`^${type === "person" ? "P" : "F"}\\p{N}{4,}$`, "u").test(id)) throw err(`not a ${type} ID: ${id}`, "verify.invalid");
  const r = tree.get<Person | Family>(id);
  if (!r || r.type !== type) throw err(`no ${type} ${id}`, "verify.unknown");
  if (r.retracted || r.mergedInto) throw err(`${id} was taken back${r.mergedInto ? ` (merged into ${r.mergedInto})` : ""}`, "verify.retracted");
  const owners: (Person | Family)[] = [r];
  if (r.type === "person") owners.push(...familiesAsPartner(tree, r.id).filter((f) => !f.retracted && !f.mergedInto));
  return { owners, facts: owners.flatMap((owner) => owner.events.filter((e) => !e.retracted).map((event) => ({ event, owner }))), ...(r.type === "person" ? { person: r } : {}) };
}

/** The record a fact is verified by: the original cited (read), the citation looked for by (search). */
export interface VerifyRecord {
  source: string;
  title: string;
  page?: string;
}

export interface AskResult {
  task: string | null;
  tasks: string[];
  facts: { fact: string; kind: string; how: Kind; record?: VerifyRecord }[];
  estimate: Estimate;
}

/** The record of a citation: its source's ID and title, the page (the citation's, else the source's). */
function recordOf(tree: Tree, c: Citation | undefined): VerifyRecord | undefined {
  if (!c) return undefined;
  const s = tree.get<Source>(c.source);
  if (!s || s.type !== "source") return undefined;
  const page = c.locator?.trim() || s.locator?.trim();
  return { source: s.id, title: s.title, ...(page ? { page } : {}) };
}

/**
 * The person's "verify" of a person (their facts and marriages), a family or one fact: every fact not confirmed by the
 * person and not disproven — read against its original where the research cites one (verify:asked), else the record
 * its citation names looked for (verify:search, a dearer search) — before all else in the queue. A fact a task of
 * verification holds already: that task comes first, nothing doubled (first already: nothing written, the same
 * answer — a double click). A fact asked for later joins the person's open task of its kind for the same owner that
 * nobody has worked on yet, its place in the queue kept (up to REVIEW_BATCH facts); one at work or worked on is not
 * changed: a new task. Anywhere (off the tree, a side branch); the living only with `living`. `dry`: what it would
 * queue and the estimate, nothing written.
 */
export function verifyAsk(tree: Tree, target: VerifyTarget, opts: { dry?: boolean; living?: boolean } = {}): AskResult {
  if (actsAsArchive(tree)) throw err("nobody researches here: an archive, or a research waiting for its agent", "verify.archive");
  return tree.withTreeLock(() => {
    const { facts: all } = targetFacts(tree, target);
    const facts = all.filter(({ event }) => !event.confirmed && event.status !== "disproven");
    if (!facts.length) throw err("nothing to verify: no fact, or the person confirmed each one", "verify.nothing");
    if (!opts.living) {
      const alive = [...new Set(facts.flatMap((f) => peopleOf(tree, f.owner)))].filter((p) => livingBorn(tree, p) !== undefined);
      if (alive.length)
        throw new UsageError(`most likely alive (born less than 100 years ago, no death recorded): ${alive.map((p) => p.id).join(", ")}`, {
          code: "verify.living",
          hint: "ask the user whether to verify them all the same; if yes: the same command with --living",
        });
    }
    const how = (e: Event): Kind => (e.citations.some((c) => provesIt(tree, c)) ? "read" : "search");
    // the record each is verified by: the original read, else the citation it is looked for by (the first)
    const listed = facts.map(({ event }) => {
      const h = how(event);
      const record = recordOf(tree, h === "read" ? event.citations.find((c) => provesIt(tree, c)) : event.citations[0]);
      return { fact: event.id, kind: event.kind, how: h, ...(record ? { record } : {}) };
    });
    const held = new Map<string, Task>();
    for (const t of tree.list<Task>("task")) if (HOLDING.has(t.state) && !t.retracted && isVerifyTask(t)) for (const w of t.where) held.set(w, t);
    const at = now();
    const records = new Map<string, Task>();
    const order: string[] = [];
    // a fact a task of verification holds: that task first (once; one at work goes on; one first already stays as it
    // is — asked for again, a double click, writes nothing and keeps its place)
    const ended = tree.list<Session>("session").filter((s) => s.state !== "open" && s.task);
    for (const { event } of facts) {
      const t = held.get(event.id);
      if (!t || order.includes(t.id)) continue;
      order.push(t.id);
      if (t.state === "doing" || (t.state !== "parked" && ownTurn(t, ended) === "next")) continue;
      records.set(t.id, { ...t, queueAt: { do: "next", at }, ...(t.state === "parked" ? { state: "open" as const } : {}), updated: at });
    }
    const fresh = facts.filter(({ event }) => !held.has(event.id));
    const file = readFile(tree);
    const all2 = scopes(tree);
    const groups = new Map<string, { owner: Person | Family; read: Event[]; search: Event[] }>();
    for (const { event, owner } of fresh) {
      const g = groups.get(owner.id) ?? groups.set(owner.id, { owner, read: [], search: [] }).get(owner.id)!;
      g[how(event)].push(event);
    }
    let sessions = 0;
    const heldIds = new Set(facts.map(({ event }) => held.get(event.id)?.id).filter((x): x is string => !!x));
    // the person's open task of the same kind for the owner, nobody at it yet, still first (its place kept): it takes
    // the facts asked for later, up to REVIEW_BATCH — one task a person, not one a fact asked for one by one (spec 065)
    const worked = new Set(tree.list<Session>("session").map((s) => s.task).filter((x): x is string => !!x));
    const joinable = (owner: string, kind: Kind): Task | undefined =>
      tree
        .list<Task>("task")
        .map((t) => records.get(t.id) ?? t)
        .filter((t) => t.state === "open" && !t.retracted && t.origin === (kind === "search" ? VERIFY_SEARCH : VERIFY_ASKED) && t.subject[0] === owner && t.where.length < REVIEW_BATCH && t.queueAt?.do === "next" && !worked.has(t.id))
        .sort((a, b) => a.queueAt!.at.localeCompare(b.queueAt!.at) || byId(a.id, b.id))[0];
    for (const g of groups.values()) {
      const research = lineOf(tree, g.owner, all2);
      for (const [kind, asked] of [["read", g.read], ["search", g.search]] as const) {
        let list = asked;
        const join = list.length ? joinable(g.owner.id, kind) : undefined;
        if (join) {
          const take = list.slice(0, REVIEW_BATCH - join.where.length);
          list = list.slice(take.length);
          if (!heldIds.has(join.id)) sessions += kind === "search" ? 2 : 1;
          if (!opts.dry) {
            const all = [...taskFacts(tree, join).map((f) => f.event), ...take];
            records.set(join.id, { ...join, ...texts(tree, g.owner, all, kind, true), where: [...join.where, ...take.map((e) => e.id)], updated: at });
            if (!order.includes(join.id)) order.push(join.id);
            if (kind === "read") for (const e of take) file.queued[e.id] = { task: join.id, cites: originalCites(tree, e) };
          }
        }
        for (let i = 0; i < list.length; i += REVIEW_BATCH) {
          const batch = list.slice(i, i + REVIEW_BATCH);
          sessions += kind === "search" ? 2 : 1;
          if (opts.dry) continue;
          const t = newTask(tree, g.owner, batch, kind === "search" ? VERIFY_SEARCH : VERIFY_ASKED, { priority: 3, queueAt: { do: "next", at } }, research);
          records.set(t.id, t);
          order.push(t.id);
          if (kind === "read") for (const e of batch) file.queued[e.id] = { task: t.id, cites: originalCites(tree, e) };
        }
      }
    }
    // a task held already counts once
    sessions += heldIds.size;
    const est = estimate(sessions, verifyCost(tree));
    if (!opts.dry && records.size)
      tree.putMany([...records.values()], [fileOf(file)], {
        op: "verify.ask",
        targets: [...records.keys(), ...facts.map((f) => f.event.id)].sort(byId),
        summary: `the person asked to verify ${facts.length} facts against their originals: ${[...records.keys()].join(", ")} first in the queue`,
      });
    if (opts.dry) return { task: null, tasks: [], facts: listed, estimate: est };
    return { task: order[0] ?? null, tasks: order, facts: listed, estimate: est };
  });
}

// ——— in bulk ———

export const BULK_SCOPES = ["line", "lineage", "tree"] as const;
export const BULK_ORDERS = ["ancestors", "weakest", "oldest"] as const;

export interface BulkOptions {
  scope: (typeof BULK_SCOPES)[number];
  of?: string;
  order?: (typeof BULK_ORDERS)[number];
  try?: number;
  budget?: number;
  dry?: boolean;
  /** The model that reads now (model.vision): a fact it verified already is left. */
  model?: string;
}

export interface BulkResult {
  people: number;
  facts: number;
  /** Of the facts: read against the original cited, a family tree's lead whose record is looked for (dearer). */
  how: { read: number; search: number };
  tasks: string[];
  left: number;
  estimate: Estimate;
}

/** A lineage: its founder and who carries it on — children of its carriers, on through the sons (a mark NOCARRY or another FOUNDER ends it). */
function lineagePeople(tree: Tree, founder: string): Set<string> {
  const marks = lineMarks(tree);
  const out = new Set<string>([founder]);
  const queue = [founder];
  while (queue.length) {
    const id = queue.shift()!;
    const p = tree.get<Person>(id);
    if (!p || (id !== founder && p.sex !== "M")) continue;
    for (const f of familiesAsPartner(tree, id))
      for (const c of f.children) {
        if (out.has(c.person) || marks.get(c.person)) continue;
        out.add(c.person);
        queue.push(c.person);
      }
  }
  return out;
}

const RANK: Record<string, number> = { lead: -1, possible: 0, probable: 1, proven: 2 };

/**
 * The person's bulk verification of a line, a lineage or the tree: every fact of VERIFY_KINDS not confirmed by the
 * person with its original cited — proven ones too (verified by another reader) — but those verified already by the
 * model reading now; and a family tree's leads (spec 065 K6.7: a fact of an import, no original read, not disproven —
 * as the person's "verify" takes them, how: search): the record its citation names looked for, dearer (two sessions a
 * task, as verifyAsk counts it). No living people, none a task holds. People in `order`; `try` the first n of them,
 * `budget` as many as the estimate fits (none measured: the budget is not used). Low priority, after the lines' work:
 * one task per person (a marriage per family) for what is read, another for what is looked for (verify:bulk, level
 * link — the brief's search). verify.nothing only with nothing to read nor to look for.
 */
export function verifyBulk(tree: Tree, o: BulkOptions): BulkResult {
  if (actsAsArchive(tree)) throw err("nobody researches here: an archive, or a research waiting for its agent", "verify.archive");
  if (!(BULK_SCOPES as readonly string[]).includes(o.scope)) throw err(`scope must be one of ${BULK_SCOPES.join(", ")}`, "verify.invalid");
  const order = o.order ?? "ancestors";
  if (!(BULK_ORDERS as readonly string[]).includes(order)) throw err(`order must be one of ${BULK_ORDERS.join(", ")}`, "verify.invalid");
  if (o.try !== undefined && (!Number.isInteger(o.try) || o.try < 1)) throw err("try must be a whole number, 1 or more", "verify.invalid");
  if (o.budget !== undefined && !(o.budget > 0)) throw err("budget must be an amount above 0 (USD)", "verify.invalid");
  return tree.withTreeLock(() => {
    let people: Set<string>;
    if (o.scope === "line") {
      if (!o.of) throw err("which line? --of G…", "verify.invalid", "strom research list");
      const id = o.of.trim().toUpperCase();
      const s = scopes(tree).find((x) => x.research.id === id && !x.research.retracted);
      if (!s) throw err(`no line ${id}`, "verify.unknown", "strom research list");
      people = new Set(s.people.keys());
    } else if (o.scope === "lineage") {
      if (!o.of) throw err("which lineage? --of P… (its founder)", "verify.invalid");
      const id = o.of.trim().toUpperCase();
      const p = tree.get<Person>(id);
      if (!p || p.type !== "person" || p.retracted) throw err(`no person ${id}`, "verify.unknown");
      people = lineagePeople(tree, id);
    } else {
      const kin = kinship(tree);
      people = new Set(tree.list<Person>("person").filter((p) => !kin.size || kin.has(p.id)).map((p) => p.id));
    }
    const held = heldFacts(tree);
    const model = o.model;
    // per person: their facts and their marriages' (a family once, with its first partner in the order)
    const rows: { person: Person; facts: { event: Event; owner: Person | Family; how: Kind }[] }[] = [];
    const families = new Set<string>();
    for (const id of people) {
      const p = tree.get<Person>(id);
      if (!p || p.type !== "person" || p.retracted || p.mergedInto || livingBorn(tree, p) !== undefined) continue;
      const owners: (Person | Family)[] = [p, ...familiesAsPartner(tree, id).filter((f) => !f.retracted && !f.mergedInto && !families.has(f.id))];
      const facts: { event: Event; owner: Person | Family; how: Kind }[] = [];
      for (const owner of owners)
        for (const e of owner.events) {
          if (e.retracted || e.confirmed || !VERIFY_KINDS.has(e.kind) || RANK[e.status] === undefined || held.has(e.id)) continue;
          if ((e.kind === "MARR") !== (owner.type === "family")) continue;
          if (owner.type === "family" && peopleOf(tree, owner).some((x) => livingBorn(tree, x) !== undefined)) continue;
          const cites = originalCites(tree, e);
          if (model && e.verified?.model && sameModel(e.verified.model, model) && covers(e.verified.cites, cites)) continue;
          if (cites.length) {
            if (e.status !== "lead") facts.push({ event: e, owner, how: "read" });
          } else if (e.origin?.by === "import" || e.origin?.tree) facts.push({ event: e, owner, how: "search" }); // a family tree's lead (another program's, the user's own unchanged): its record looked for
        }
      if (!facts.length) continue;
      for (const f of facts) if (f.owner.type === "family") families.add(f.owner.id);
      rows.push({ person: p, facts });
    }
    if (!rows.length) throw err("nothing to verify in this scope: no fact citing its original, no family tree's lead to look for", "verify.nothing");
    const focus = mainPerson(tree);
    const gens = focus ? ancestorGenerations(tree, focus) : new Map<string, number>();
    const weakest = (r: (typeof rows)[number]) => Math.min(...r.facts.map((f) => RANK[f.event.status]!));
    const oldest = (r: (typeof rows)[number]) =>
      r.facts.map((f) => f.event.verified?.at ?? f.event.citations.map((c) => tree.get<Source>(c.source)?.created ?? "").sort()[0] ?? "").sort()[0] ?? "";
    rows.sort(
      (a, b) =>
        (order === "weakest" ? weakest(a) - weakest(b) : order === "oldest" ? oldest(a).localeCompare(oldest(b)) : (gens.get(a.person.id) ?? 999) - (gens.get(b.person.id) ?? 999)) ||
        (gens.get(a.person.id) ?? 999) - (gens.get(b.person.id) ?? 999) ||
        byId(a.person.id, b.person.id),
    );
    const avg = verifyCost(tree);
    // a task per owner and how, REVIEW_BATCH facts each; a search two sessions (as verifyAsk counts it)
    const sessionsOf = (r: (typeof rows)[number]) => {
      const per = new Map<string, { n: number; how: Kind }>();
      for (const f of r.facts) {
        const k = `${f.owner.id} ${f.how}`;
        per.set(k, { n: (per.get(k)?.n ?? 0) + 1, how: f.how });
      }
      return [...per.values()].reduce((n, c) => n + Math.ceil(c.n / REVIEW_BATCH) * (c.how === "search" ? 2 : 1), 0);
    };
    let taken = o.try !== undefined ? rows.slice(0, o.try) : rows;
    if (o.budget !== undefined && avg !== undefined) {
      const fit: typeof rows = [];
      let spent = 0;
      for (const r of taken) {
        const cost = sessionsOf(r) * avg;
        if (spent + cost > o.budget) break;
        spent += cost;
        fit.push(r);
      }
      taken = fit;
    }
    const sessions = taken.reduce((n, r) => n + sessionsOf(r), 0);
    const facts = taken.reduce((n, r) => n + r.facts.length, 0);
    const search = taken.reduce((n, r) => n + r.facts.filter((f) => f.how === "search").length, 0);
    const out: BulkResult = { people: taken.length, facts, how: { read: facts - search, search }, tasks: [], left: rows.length - taken.length, estimate: estimate(sessions, avg) };
    if (o.dry || !taken.length) return out;
    const file = readFile(tree);
    const all = scopes(tree);
    const records: Task[] = [];
    for (const r of taken) {
      const per = new Map<string, { owner: Person | Family; how: Kind; events: Event[] }>();
      for (const f of r.facts) {
        const k = `${f.owner.id} ${f.how}`;
        (per.get(k) ?? per.set(k, { owner: f.owner, how: f.how, events: [] }).get(k)!).events.push(f.event);
      }
      for (const { owner, how, events } of per.values())
        for (let i = 0; i < events.length; i += REVIEW_BATCH) {
          const batch = events.slice(i, i + REVIEW_BATCH);
          const t = newTask(tree, owner, batch, VERIFY_BULK, {}, lineOf(tree, owner, all), how);
          records.push(t);
          if (how === "read") for (const e of batch) file.queued[e.id] = { task: t.id, cites: originalCites(tree, e) };
        }
    }
    out.tasks = records.map((t) => t.id);
    tree.putMany(records, [fileOf(file)], {
      op: "verify.bulk",
      targets: [...out.tasks, ...taken.flatMap((r) => r.facts.map((f) => f.event.id))].sort(byId),
      summary: `the person's bulk verification against the originals (${o.scope}${o.of ? ` ${o.of}` : ""}, ${order}): ${facts} facts of ${taken.length} people in ${records.length} tasks${search ? ` (${search} of a family tree looked for)` : ""}${out.left ? `, ${out.left} people left` : ""}`,
    });
    return out;
  });
}

export interface StopResult {
  /** The tasks dropped. */
  dropped: string[];
  /** The facts they held. */
  facts: number;
}

/**
 * The person's "stop" of the verification: every task of verification nobody has started (open, parked, waiting) is
 * dropped — `bulk`: only the bulk verification's; one at work in a session goes on. What was queued stays queued
 * (quality/verify.json), so the sweep does not queue those facts again until one cites a new original or the person
 * asks again. Nothing to stop: nothing written. Never in an archive.
 */
export function verifyStop(tree: Tree, o: { bulk?: boolean } = {}): StopResult {
  if (actsAsArchive(tree)) throw err("nobody researches here: an archive, or a research waiting for its agent", "verify.archive");
  return tree.withTreeLock(() => {
    const at = now();
    const result = phrase(tree.lang, "verify.dropped.stopped");
    const records: Task[] = [];
    const facts = new Set<string>();
    for (const t of tree.list<Task>("task")) {
      if (t.state === "doing" || !HOLDING.has(t.state) || t.retracted || !isVerifyTask(t) || (o.bulk && t.origin !== VERIFY_BULK)) continue;
      records.push({ ...t, state: "dropped", result, updated: at });
      for (const w of t.where) if (w.startsWith("E")) facts.add(w);
    }
    if (!records.length) return { dropped: [], facts: 0 };
    const dropped = records.map((t) => t.id);
    tree.putMany(records, [], {
      op: "verify.stop",
      targets: [...dropped, ...facts].sort(byId),
      summary: `the person stopped the ${o.bulk ? "bulk " : ""}verification against the originals: ${dropped.length} tasks not started dropped (${facts.size} facts)`,
    });
    return { dropped, facts: facts.size };
  });
}

// ——— the agent's result, the person's confirmation ———

/** Where a fact is, with its owner (taken back or merged: said). */
function factOf(tree: Tree, ref: string, prefix: string): { event: Event; owner: Person | Family } {
  const id = String(ref).trim().toUpperCase();
  if (!/^E\p{N}{4,}$/u.test(id)) throw err(`not a fact ID: ${ref}`, `${prefix}.invalid`, "a fact's ID: E0001 (strom person show <who>)");
  for (const owner of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
    const event = owner.events.find((e) => e.id === id);
    if (!event) continue;
    if (owner.mergedInto) throw err(`${id} belongs to ${owner.id}, merged into ${owner.mergedInto}`, `${prefix}.merged`, `strom person show ${owner.mergedInto}`);
    if (event.retracted || owner.retracted) throw err(`${id} was taken back`, `${prefix}.retracted`);
    return { event, owner };
  }
  throw err(`no fact ${id}`, `${prefix}.unknown`, "fact IDs are listed in strom person show <who>");
}

/** Is an image (M…, B…:n, I…[:n]) one of a source's: its own, a part cut out, its book's, the user's file. */
function imageOf(tree: Tree, sourceId: string, ref: string): boolean {
  const s = tree.get<Source>(sourceId);
  if (!s) return false;
  const r = ref.trim().toUpperCase();
  if (/^M\p{N}{4,}$/u.test(r)) return !!s.media?.includes(r) || !!s.clips?.some((c) => c.media === r);
  const at = /^([BI]\p{N}{4,})(?::(\p{N}+))?$/u.exec(r);
  if (!at) return false;
  return at[1]!.startsWith("B") ? s.recordset === at[1] && at[2] !== undefined : s.input === at[1];
}

export interface DoneResult {
  fact: string;
  owner: string;
  result: "proven" | "kept";
  status: Event["status"];
  task?: string;
  /** The task it ended (every fact of it resolved). */
  ended?: string;
  readers?: 2;
}

/**
 * The agent's result of a fact's verification against the original: proven (the image of a cited original looked at:
 * the status raised as checkStatus allows), or kept with the reason. Inside a session alone; a fact the person
 * confirmed is theirs. The value is never changed. The task whose facts are all resolved then is done. One operation.
 */
export function verifyFactDone(tree: Tree, ref: string, o: { result: "proven" | "kept"; image?: string; reason?: string; session: Session }): DoneResult {
  return tree.withTreeLock(() => {
    const { event, owner } = factOf(tree, ref, "verify");
    if (event.confirmed) throw err(`${event.id} was confirmed by the person against the scan: it is theirs, not verified again`, "verify.confirmed");
    const cites = originalCites(tree, event);
    let status = event.status;
    if (o.result === "proven") {
      if (!o.image) throw err("--proven needs the image of the original looked at: --image M… (or B…:n)", "verify.image");
      if (!cites.length) throw err(`${event.id} cites no original record with primary information: it cannot be proven by a look`, "verify.original", "cite the original first (strom cite E… S… --information primary), or --kept --reason \"…\"");
      if (!cites.some((s) => imageOf(tree, s, o.image!)))
        throw err(`${o.image} is no image of the original ${event.id} cites (${cites.join(", ")})`, "verify.image", `the image of ${cites[0]}: strom source show ${cites[0]}`);
      checkStatus(tree, "proven", event.citations);
      status = "proven";
    } else if (!o.reason?.trim()) throw err("--kept needs the reason it stays as it is: --reason \"…\"", "verify.reason");
    const task = tree
      .list<Task>("task")
      .find((t) => HOLDING.has(t.state) && !t.retracted && isVerifyTask(t) && t.where.includes(event.id));
    const at = now();
    let readers: 2 | undefined;
    if (o.result === "proven" && o.session.model) {
      const read = readersOf(tree);
      const sets = cites.map((s) => read.get(s));
      if (sets.length && sets.every((r) => !!r?.size && !r.has("unknown") && ![...r].some((m) => m !== "user" && sameModel(m, o.session.model!)))) readers = 2;
    }
    const verified = {
      at,
      by: o.session.id,
      ...(o.session.model ? { model: o.session.model } : {}),
      result: o.result,
      ...(o.result === "kept" ? { reason: o.reason!.trim().normalize("NFC") } : {}),
      ...(task ? { task: task.id } : {}),
      cites,
      ...(readers ? { readers } : {}),
    };
    const next = { ...structuredClone(owner), events: owner.events.map((e) => (e.id === event.id ? { ...e, status, verified } : e)), updated: at } as Person | Family;
    const records: (Person | Family | Task)[] = [next];
    let ended: string | undefined;
    if (task) {
      const facts = new Map(taskFacts(tree, task).map((f) => [f.event.id, f.event.id === event.id ? { ...f.event, status, verified } : f.event]));
      if (task.where.every((id) => resolved(facts.get(id), task))) {
        records.push({ ...task, state: "done", result: phrase(tree.lang, "verify.task.done", { count: task.where.length }), updated: at });
        ended = task.id;
      }
    }
    tree.putMany(records, [], {
      op: "verify.done",
      targets: [owner.id, event.id, ...(ended ? [ended] : [])],
      summary: `${event.id} verified against the original${o.image ? ` (${o.image})` : ""}: ${o.result === "proven" ? `proven${readers ? ", two readers agree" : ""}` : `stays ${status}`}${ended ? ` · ${ended} done` : ""}`,
      ...(o.result === "kept" ? { reason: o.reason!.trim() } : {}),
    });
    return { fact: event.id, owner: owner.id, result: o.result, status, ...(task ? { task: task.id } : {}), ...(ended ? { ended } : {}), ...(readers ? { readers } : {}) };
  });
}

export interface ConfirmResult {
  fact: string;
  owner: string;
  confirmed?: string;
  /** Nothing to change: it was so already. */
  same?: true;
  /** Tasks the fact left; those left with no fact dropped. */
  left: string[];
  dropped: string[];
}

/** A fact by its ID, none when the research has no such fact (or it, or its owner, is taken back or merged). */
export function factIn(tree: Tree, id: string): Event | undefined {
  try {
    return factOf(tree, id, "factconfirm").event;
  } catch {
    return undefined;
  }
}

/** What a fact says now, for the app to show again (confirm.changed): its date, place and value, those it has. */
export function factNow(e: Event): Record<string, string> {
  return { ...(e.date ? { date: e.date } : {}), ...(e.place ? { place: e.place } : {}), ...(e.value ? { value: e.value } : {}) };
}

/**
 * A confirmation is of the value the person saw (the Strom file's `3 _TXT` under `2 _STROM_EID`, core/readers.ts
 * factMark): the fact changed since — the app showing an older file — refused, confirm.changed with the mark now.
 */
export function factUnchanged(event: Event, txt: string): void {
  const mark = factMark(event);
  if (txt.trim().toLowerCase() !== mark)
    throw new UsageError(`${event.id} changed since the app showed it: confirm what it says now`, { code: "confirm.changed", hint: "load the tree again and confirm the fact as it is now", params: { fact: event.id, txt: mark, ...factNow(event) } });
}

/**
 * The person's confirmation of a fact against the scan (or its taking back): a mark of its own, the status as it is. A
 * fact confirmed leaves the open tasks of verification (one at work goes on); one left with none is dropped. The same
 * state again: nothing written. One operation; the caller has checked it is the person. `day`: the day the person
 * confirmed it (a send of the Strom app, YYYY-MM-DD) — a day before today kept, else now; `reason`: what the history says;
 * `txt`: the mark of the value the person saw (factUnchanged), checked under the lock before anything.
 */
export function verifyConfirm(tree: Tree, ref: string, confirm: boolean, opts: { day?: string; reason?: string; txt?: string } = {}): ConfirmResult {
  return tree.withTreeLock(() => {
    const { event, owner } = factOf(tree, ref, "factconfirm");
    if (opts.txt !== undefined) factUnchanged(event, opts.txt);
    if (!!event.confirmed === confirm) return { fact: event.id, owner: owner.id, ...(event.confirmed ? { confirmed: event.confirmed.at.slice(0, 10) } : {}), same: true as const, left: [], dropped: [] };
    const at = now();
    const day = opts.day && /^\d{4}-\d{2}-\d{2}$/.test(opts.day) && opts.day < at.slice(0, 10) && !Number.isNaN(Date.parse(`${opts.day}T12:00:00.000Z`)) ? `${opts.day}T12:00:00.000Z` : at;
    const next = {
      ...structuredClone(owner),
      events: owner.events.map((e) => {
        if (e.id !== event.id) return e;
        const { confirmed: _c, ...rest } = e;
        return confirm ? { ...e, confirmed: { at: day, by: "user" as const } } : rest;
      }),
      updated: at,
    } as Person | Family;
    const records: (Person | Family | Task)[] = [next];
    const left: string[] = [];
    const dropped: string[] = [];
    if (confirm)
      for (const t of tree.list<Task>("task")) {
        if (t.state === "doing" || !HOLDING.has(t.state) || t.retracted || !isVerifyTask(t) || !t.where.includes(event.id)) continue;
        const where = t.where.filter((w) => w !== event.id);
        if (where.length) {
          const facts = taskFacts(tree, { ...t, where }).map((f) => f.event);
          const o = tree.get<Person | Family>(t.subject[0]!);
          records.push({ ...t, where, ...(o ? texts(tree, o, facts, t.origin === VERIFY_SEARCH ? "search" : "read", t.origin === VERIFY_ASKED) : {}), updated: at });
          left.push(t.id);
        } else {
          // dropped as it was: a task names what it was about (where needs one)
          records.push({ ...t, state: "dropped", result: phrase(tree.lang, "verify.dropped.confirmed"), updated: at });
          dropped.push(t.id);
        }
      }
    tree.putMany(records, [], {
      op: confirm ? "fact.confirm" : "fact.unconfirm",
      targets: [owner.id, event.id, ...left, ...dropped],
      summary: confirm ? `${event.id} confirmed by the person against the scan${dropped.length ? ` · ${dropped.join(", ")} dropped` : ""}` : `${event.id} the person's confirmation taken back`,
      ...(opts.reason ? { reason: opts.reason } : {}),
    });
    return { fact: event.id, owner: owner.id, ...(confirm ? { confirmed: day.slice(0, 10) } : {}), left, dropped };
  });
}

/**
 * The person's confirmation of several facts (or its taking back), each with the mark of the value the person saw
 * (`txts`, one for each fact, or none: as before): all checked under one lock before anything is written — one fact
 * changed since and none is confirmed (confirm.changed).
 */
export function verifyConfirmAll(tree: Tree, refs: string[], confirm: boolean, txts?: string[]): ConfirmResult[] {
  if (txts && txts.length !== refs.length) throw new UsageError(`${txts.length} marks for ${refs.length} facts`, { code: "factconfirm.invalid", hint: "one mark for each fact, in their order: --txt <mark>,<mark>" });
  return tree.withTreeLock(() => {
    if (txts) refs.forEach((ref, i) => factUnchanged(factOf(tree, ref, "factconfirm").event, txts[i]!));
    return refs.map((ref, i) => verifyConfirm(tree, ref, confirm, txts ? { txt: txts[i]! } : {}));
  });
}

// ——— what is seen ———

export interface VerifyCounts {
  /** Facts waiting in an open task of verification (the sweep's, bulk, asked). */
  waiting: number;
  /** Of them, asked for by the person. */
  asked: number;
  /** Of them, waiting for the person to download the images. */
  images: number;
  /** Of them, waiting for the person's permission for an archive. */
  permission: number;
  /** Verified, kept as they were with the reason. */
  kept: number;
  /** Confirmed by the person against the scan. */
  confirmed: number;
  fix?: { at: string; facts: number; people: number };
}

/** How a fact waits for its verification: in the queue (the sweep's or bulk, asked for by the person), for the scans, for an archive's permission. */
export type VerifyWait = "wait" | "asked" | "images" | "permission";

/**
 * A task of verification the person asked for: their own (verify:asked, verify:search), or the sweep's or a bulk one
 * the person put first — their "verify" of a fact it holds, strom task order next — until a session on it ends (the
 * person's "next" is used once). The Strom app shows it as asked and does not offer to put it first again.
 */
function askedFor(tree: Tree): (t: Task) => boolean {
  let ended: Session[] | undefined;
  return (t) => {
    if (t.origin === VERIFY_ASKED || t.origin === VERIFY_SEARCH) return true;
    if (!verifiesInTurn(t) || t.queueAt?.do !== "next") return false;
    ended ??= tree.list<Session>("session").filter((s) => s.state !== "open" && s.task);
    return ownTurn(t, ended) === "next";
  };
}

/** How a task of verification waits: for an archive's permission, for the scans, asked for by the person, its turn. */
function waitOf(tree: Tree): (t: Task) => VerifyWait {
  const withImages = setsWithImages(tree);
  const decision = waitsForDecision(tree, permissionQuestions(tree.env), withImages);
  const asked = askedFor(tree);
  return (t) => (decision(t) ? "permission" : lacksImages(tree, t, withImages) ? "images" : asked(t) ? "asked" : "wait");
}

/** How each fact of an open task of verification waits, and the task holding it. */
function waiting(tree: Tree): Map<string, { how: VerifyWait; task: Task }> {
  const out = new Map<string, { how: VerifyWait; task: Task }>();
  const tasks = tree.list<Task>("task").filter((t) => HOLDING.has(t.state) && !t.retracted && isVerifyTask(t));
  if (!tasks.length) return out;
  const how = waitOf(tree);
  for (const t of tasks) {
    const h = how(t);
    for (const w of t.where) if (w.startsWith("E") && !out.has(w)) out.set(w, { how: h, task: t });
  }
  return out;
}

/** A task of verification as the person's "verify" answers it: how it waits, its place in the queue (wait, asked), its facts. */
export interface TaskPlace {
  task: string;
  state: VerifyWait;
  /** The place in the queue now (1: the next session takes it) — only of a task in the queue (wait, asked), as 3 _POS. */
  position?: number;
  facts: string[];
}

/**
 * The tasks of verification named (the person's "verify": a person's and their marriages' — Dotazy 2 of the app), each
 * with how it waits and, in the queue (wait, asked), its place there now; nearest to its turn first, as the queue ranks
 * them (one it does not rank last). The queue is ranked once.
 */
export function taskPlaces(tree: Tree, ids: string[]): TaskPlace[] {
  const tasks = [...new Set(ids)].map((id) => tree.get<Task>(id)).filter((t): t is Task => !!t && t.type === "task");
  if (!tasks.length) return [];
  const rank = new Map(runOrder(tree).map((r, i) => [r.task.id, i + 1]));
  const how = waitOf(tree);
  return tasks
    .map((t, i) => ({ t, i, state: how(t), at: rank.get(t.id) }))
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.i - b.i)
    .map(({ t, state, at }) => ({
      task: t.id,
      state,
      ...((state === "wait" || state === "asked") && at !== undefined ? { position: at } : {}),
      facts: t.where.filter((w) => FACT_ID.test(w)),
    }));
}

/** How each fact of an open task of verification waits (/status verify, the counts). */
export function verifyState(tree: Tree): Map<string, VerifyWait> {
  return new Map([...waiting(tree)].map(([id, w]) => [id, w.how]));
}

/**
 * The Strom file's marks of the facts waiting for their verification (2 _STROM_VERIFY, 3 _POS): how each waits and, for
 * one in the queue (wait, asked), the place of its task in the queue now — the task the next session would take is 1;
 * every fact of a task the same. The queue is ranked once, only when a fact waits in it. None in an archive (nobody
 * researches there: its tasks are put aside).
 */
export function verifyMarks(tree: Tree): Map<string, { state: VerifyWait; pos?: number }> {
  const out = new Map<string, { state: VerifyWait; pos?: number }>();
  if (actsAsArchive(tree)) return out;
  let place: Map<string, number> | undefined;
  for (const [id, { how, task }] of waiting(tree)) {
    if (how !== "wait" && how !== "asked") {
      out.set(id, { state: how });
      continue;
    }
    place ??= new Map(runOrder(tree).map((r, i) => [r.task.id, i + 1]));
    const pos = place.get(task.id);
    out.set(id, { state: how, ...(pos !== undefined ? { pos } : {}) });
  }
  return out;
}

/** The counts of verification (strom verify status, /status verify, check, doctor, the overview): cheap. */
export function verifyCounts(tree: Tree): VerifyCounts {
  const state = verifyState(tree);
  let images = 0;
  let permission = 0;
  for (const s of state.values()) {
    if (s === "images") images++;
    else if (s === "permission") permission++;
  }
  // the person's own, whatever it waits for
  const askedBy = askedFor(tree);
  const askedTasks = tree.list<Task>("task").filter((t) => HOLDING.has(t.state) && !t.retracted && isVerifyTask(t) && askedBy(t));
  const asked = new Set(askedTasks.flatMap((t) => t.where.filter((w) => w.startsWith("E")))).size;
  let kept = 0;
  let confirmed = 0;
  for (const owner of liveOwners(tree))
    for (const e of owner.events) {
      if (e.retracted) continue;
      if (e.confirmed) confirmed++;
      else if (e.verified?.result === "kept" && e.status !== "proven") kept++;
    }
  const fix = readFile(tree).fix;
  return { waiting: state.size, asked, images, permission, kept, confirmed, ...(fix ? { fix } : {}) };
}
