// Work off the lines (spec 036, spec 038 K7): a task of a research with several lines (directions) that belongs to none
// of them — no research of its own, none of its people in any line (core/directions.ts directionOf): a side branch (an
// ancestor's sister and her husband), people linked to the tree only through others. When it comes is the person's
// choice on three floors, the lower winning: the tree (queue.offLine: occasional, the default — now and then one, the
// nearest to a line first; last — once the lines have nothing to do; normal — as the lines' work; never — not taken), the
// branch (strom offline set: the same, or added to a line), the task (strom task order: next, last). Unless it helps a
// line. Judged afresh each time from the tree as it is (nothing written but the person's choices: a research that updates
// is ordered so at once, a link recorded later moves the task by itself):
//   a) it serves a hypothesis or a conflict of a line — named on the task (--about H…/X…) or in its words — whose
//      people (those its variants would connect too) are in a line: that line;
//   b) it would join people to the tree — some of its people (or of the hypothesis it names) are kin of the tree, some
//      are not: the line it joins them to, the nearest by family links from the people of the tree it names;
//   p) it is about the partner of a person in a line (every marriage of that person; in a line of descendants the
//      partners of the descendants): that line's work (helps "partner") — the partner of a partner is not;
//   c) the agent said how it helps (strom task add|edit --helps "<how>"): the line named there by its ID (G…), else the
//      nearest line by family links from its people — an ancestor's sibling is one link from that ancestor's line;
//   d) its branch was added to a line by the person (strom offline set B-… --line G…): that line (helps "branch").
// A task about nobody (an archive, places, the history of a region) has its own rules and is never off the lines; nor
// is anything in a research with one line or none (everything is its).
//
// A branch: the person off the lines nearest to a line through whom a task hangs on the tree (an ancestor's sister),
// with everyone reached from the lines only through them (her husband, her children) — found from the people of the
// lines and their partners (the lines' work, no branch of their own) over family links, at most NEAREST_STEPS of them. Its key B-<P…> is that person's (merged: the one merged into).
// A task with people in two branches belongs to the one nearer a line, then the smaller key. The person's choices —
// each branch's, and the answers to a line proposed for a branch that grows (core/waiting.ts) — are kept in
// <tree>/quality/offline.json, written whole as a sealed operation of the tree like quality/lineages.json: a change
// outside strom is an error of strom guard; the history and strom sync undo take it back.

import path from "node:path";
import type { Conflict, Hypothesis, OffLine, Person, Research, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { aboutPeople, directionOf, hypothesisPeople, scopes as scopesOf, type Scope } from "./directions.ts";
import { kinship } from "./kin.ts";
import { descendantGenerations, familiesAsChild, familiesAsPartner } from "./people.ts";
import { personNow } from "./quality.ts";
import { readJsonIfExists, stringifyCanonical } from "./json.ts";
import type { Settings } from "./config.ts";

export { OFF_LINE_CHOICES, type OffLine } from "./model.ts";

/** How a task helps a line: a hypothesis or conflict of the line, joining people to the tree, the agent's word, a partner of the line's person, its branch added to the line. */
export type HelpsBy = "question" | "joins" | "agent" | "partner" | "branch";

/** How a branch hangs on a line: a sibling of a person of the line, their partner, child, parent, or further. */
export type BranchRel = "sibling" | "partner" | "child" | "parent" | "other";

/** How a branch is taken: as the tree says (occasional, last, normal, never), or added to a line. */
export const BRANCH_MODES = ["occasional", "last", "normal", "never", "line"] as const;
export type BranchMode = (typeof BRANCH_MODES)[number];

/** The person's answer to a line proposed for a branch that grows. */
export const BRANCH_ANSWERS = ["line", "keep", "never", "create"] as const;
export type BranchAnswer = (typeof BRANCH_ANSWERS)[number];

export const OFFLINE_FILE = "quality/offline.json";

export interface OfflineFile {
  /** Each branch's own choice, by the person of the branch (P…). */
  branches: Record<string, { mode: BranchMode; line?: string; at: string }>;
  /** The answers to a line proposed for a branch that grows: what, and how big the branch was then. */
  answers: Record<string, { do: BranchAnswer; tasks: number; persons: number; at: string }>;
}

export interface Placed {
  /** The line it belongs to: its own (directionOf), else the one it helps — undefined when none is known. */
  research?: string;
  /** It belongs to no line, but helps one (b: the line may be unknown). */
  helps?: HelpsBy;
  /** Off the lines and helping none: when it comes is the person's choice (queue.offLine, its branch's). */
  off?: true;
  /** Its branch (B-P…): off the lines, or added to a line (helps "branch"). */
  branch?: string;
  /** Off the lines: the family links between its nearest person and a line. */
  dist?: number;
}

/** A branch off the lines as the research finds it now. */
export interface Branch {
  id: string;
  person: string;
  /** The person of a line it hangs on, and how. */
  via: { person: string; rel: BranchRel };
  /** The line nearest to it (the narrowest of its person of a line). */
  nearest?: string;
  /** Everyone of it, its person first. */
  persons: string[];
}

/** How far family links are followed to find the line nearest to a task's people. */
export const NEAREST_STEPS = 6;

/** Hypotheses and conflicts named in a task's words (what, why, done-when, the agent's word). */
const RECORD_ID = /(?<![\p{L}\p{M}\p{N}])[HX]\d{4,}(?![\p{L}\p{M}\p{N}])/gu;

/** Research IDs named in a text. */
const RESEARCH_ID = /(?<![\p{L}\p{M}\p{N}])G\d{4,}(?![\p{L}\p{M}\p{N}])/gu;

const PERSON_ID = /^P\d{1,9}$/u;

/** A branch's key: B- and the ID of its person as the research writes it (b-p12 → B-P0012); undefined when it is none. */
export function branchKey(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const m = /^B-(P\d{1,9})$/iu.exec(raw.trim());
  if (!m) return undefined;
  const id = m[1]!.toUpperCase();
  return `B-${id.length < 5 ? `P${id.slice(1).padStart(4, "0")}` : id}`;
}

const idNumber = (id: string) => Number(id.replace(/^\D+/u, "")) || 0;
const byId = (a: string, b: string) => idNumber(a) - idNumber(b) || a.localeCompare(b);

/** The people of each line, the narrowest line of each (its own people; a line of descendants: the descendants of its person). */
function linePeople(tree: Tree, lines: Scope[]): Map<string, string> {
  const out = new Map<string, string>();
  const sized = lines.map((s) => ({ s, people: s.research.direction === "descendants" ? descendantsOf(tree, s.research) : new Set(s.people.keys()) }));
  sized.sort((a, b) => a.people.size - b.people.size || byId(a.s.research.id, b.s.research.id));
  for (const { s, people } of sized) for (const p of people) if (!out.has(p)) out.set(p, s.research.id);
  return out;
}

/** The person of a line of descendants and their descendants, within its generations. */
function descendantsOf(tree: Tree, r: Research): Set<string> {
  return new Set(descendantGenerations(tree, r.focus, r.limits?.generations ?? 50).keys());
}

/** The people one family link away: partners, children, parents. */
function neighbours(tree: Tree, p: string): string[] {
  return [...familiesAsPartner(tree, p).flatMap((f) => [...f.partners, ...f.children.map((c) => c.person)]), ...familiesAsChild(tree, p).flatMap((f) => f.partners)];
}

/** The partners of the people of the lines (every marriage) who are in no line themselves: the line of their partner, the narrowest. */
function partnersOf(tree: Tree, line: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [p, at] of line)
    for (const f of familiesAsPartner(tree, p))
      for (const x of f.partners) if (x !== p && !line.has(x) && !out.has(x)) out.set(x, at);
  return out;
}

/** The lines that count: those not taken back. */
const counted = (all: Scope[]) => all.filter((s) => !s.research.retracted);

/**
 * The branches off the lines: from the people of the lines over family links (at most NEAREST_STEPS), each person
 * reached belongs to the branch of the first person off the lines on the way — at the same distance the smaller key.
 */
export function findBranches(tree: Tree, all: Scope[], line: Map<string, string> = linePeople(tree, counted(all))): { branches: Map<string, Branch>; of: Map<string, { branch: string; dist: number }> } {
  const branches = new Map<string, Branch>();
  const of = new Map<string, { branch: string; dist: number }>();
  if (counted(all).length < 2) return { branches, of };
  // the partners of the people of the lines are the lines' work, no branch of their own: the search starts from them too
  line = new Map(line);
  for (const [p, at] of partnersOf(tree, line)) line.set(p, at);
  const seen = new Set(line.keys());
  let ring = [...line.keys()].sort(byId);
  const rootOf = new Map<string, string>();
  const viaOf = new Map<string, string>();
  for (let step = 1; step <= NEAREST_STEPS && ring.length; step++) {
    const found = new Map<string, { root: string; via?: string }>();
    for (const p of ring)
      for (const n of neighbours(tree, p)) {
        if (seen.has(n)) continue;
        const person = tree.get<Person>(n);
        if (!person || person.retracted) continue;
        const root = line.has(p) ? n : rootOf.get(p)!;
        const via = line.has(p) ? p : undefined;
        const had = found.get(n);
        if (!had || byId(root, had.root) < 0 || (root === had.root && via && had.via && byId(via, had.via) < 0)) found.set(n, { root, ...(via ? { via } : {}) });
      }
    for (const [n, x] of found) {
      seen.add(n);
      rootOf.set(n, x.root);
      if (x.via) viaOf.set(n, x.via);
      of.set(n, { branch: `B-${x.root}`, dist: step });
    }
    ring = [...found.keys()].sort(byId);
  }
  for (const [p, root] of [...rootOf].sort((a, b) => (of.get(a[0])!.dist - of.get(b[0])!.dist) || byId(a[0], b[0]))) {
    const id = `B-${root}`;
    if (!branches.has(id)) {
      const via = branchVia(tree, root, viaOf.get(root)!, line);
      branches.set(id, { id, person: root, via, ...(line.get(via.person) ? { nearest: line.get(via.person) } : {}), persons: [] });
    }
    branches.get(id)!.persons.push(p);
  }
  return { branches, of };
}

/** How a branch's person hangs on a line: a child of a family with a child in a line is that child's sibling. */
function branchVia(tree: Tree, root: string, via: string, line: Map<string, string>): Branch["via"] {
  const sibling = familiesAsChild(tree, root)
    .flatMap((f) => f.children.map((c) => c.person))
    .filter((c) => c !== root && line.has(c))
    .sort(byId)[0];
  if (sibling) return { person: sibling, rel: "sibling" };
  if (familiesAsPartner(tree, via).some((f) => f.partners.includes(root))) return { person: via, rel: "partner" };
  if (familiesAsPartner(tree, via).some((f) => f.children.some((c) => c.person === root))) return { person: via, rel: "child" };
  if (familiesAsChild(tree, via).some((f) => f.partners.includes(root))) return { person: via, rel: "parent" };
  return { person: via, rel: "other" };
}

/** The person's choices off the lines (quality/offline.json): each branch's by who its person is now. */
export function readOffline(tree: Tree): OfflineFile {
  let raw: Partial<OfflineFile> | undefined;
  try {
    raw = readJsonIfExists<Partial<OfflineFile>>(path.join(tree.root, ...OFFLINE_FILE.split("/")));
  } catch {
    raw = undefined;
  }
  const out: OfflineFile = { branches: {}, answers: {} };
  const keyOf = (k: string) => (PERSON_ID.test(k) ? personNow(tree, k) : undefined);
  for (const [k, v] of Object.entries(raw?.branches ?? {})) {
    const p = keyOf(k);
    if (!p || !v || !(BRANCH_MODES as readonly string[]).includes(v.mode) || (v.mode === "line" && typeof v.line !== "string")) continue;
    // the newest of a person merged with another
    if (!out.branches[p] || String(v.at) > out.branches[p]!.at) out.branches[p] = { mode: v.mode, ...(v.mode === "line" ? { line: v.line } : {}), at: String(v.at ?? "") };
  }
  for (const [k, v] of Object.entries(raw?.answers ?? {})) {
    const p = keyOf(k);
    if (!p || !v || !(BRANCH_ANSWERS as readonly string[]).includes(v.do)) continue;
    if (!out.answers[p] || String(v.at) > out.answers[p]!.at) out.answers[p] = { do: v.do, tasks: Number(v.tasks) || 0, persons: Number(v.persons) || 0, at: String(v.at ?? "") };
  }
  return out;
}

/** Written whole as a sealed operation of the tree, inside its lock. */
export function writeOffline(tree: Tree, next: OfflineFile, op: { op: string; targets: string[]; summary: string }): void {
  const sorted = <T>(r: Record<string, T>) => Object.fromEntries(Object.keys(r).sort(byId).map((k) => [k, r[k]!]));
  tree.withTreeLock(() => tree.putFile(OFFLINE_FILE, stringifyCanonical({ branches: sorted(next.branches), answers: sorted(next.answers) }), { ...op, summary: op.summary.normalize("NFC") }));
}

/**
 * Where each task stands among the lines (computed once per call of the queue or an overview: the kin of the tree, the
 * lines' people and the branches are worked out once). `all`: the scopes of the research (core/directions.ts scopes);
 * `file`: the person's choices (read when not given).
 */
export function placer(tree: Tree, all: Scope[], file?: OfflineFile): (t: Pick<Task, "subject" | "what" | "why" | "doneWhen"> & { research?: string; helps?: string }) => Placed {
  const lines = counted(all);
  let kin: ReturnType<typeof kinship> | undefined;
  let line: Map<string, string> | undefined;
  let found: ReturnType<typeof findBranches> | undefined;
  let partners: Map<string, string> | undefined;
  let choices: OfflineFile | undefined = file;
  const people = () => (line ??= linePeople(tree, lines));
  const narrowest = (ps: Iterable<string>): string | undefined => {
    const set = new Set(ps);
    return lines
      .filter((s) => [...set].some((p) => s.people.has(p)))
      .sort((a, b) => a.people.size - b.people.size || a.research.id.localeCompare(b.research.id))[0]?.research.id;
  };
  /** The line nearest to these people by family links (partners, children, parents), the narrowest at the same step. */
  const nearest = (from: string[]): string | undefined => {
    const seen = new Set(from);
    let ring = [...from];
    for (let step = 0; step <= NEAREST_STEPS && ring.length; step++) {
      const at = narrowest(ring);
      if (at) return at;
      const next: string[] = [];
      for (const p of ring)
        for (const n of neighbours(tree, p))
          if (!seen.has(n)) {
            seen.add(n);
            next.push(n);
          }
      ring = next;
    }
    return undefined;
  };
  const partnerLines = () => (partners ??= partnersOf(tree, people()));
  return (t) => {
    const own = directionOf(tree, t, all);
    if (own) return { research: own };
    const about = aboutPeople(tree, t.subject);
    // nobody: an archive, places, history — their own rules; one line or none: everything is its
    if (!about.length || lines.length < 2) return {};
    // a person of a line of descendants (none of whose people are its scope): that line
    const inLine = about.map((p) => people().get(p)).find((x) => x);
    if (inLine) return { research: inLine };
    // a) the hypotheses and conflicts it names, on the task or in its words
    const named = [...new Set([...t.subject, ...[t.what, t.why, t.doneWhen, t.helps ?? ""].flatMap((text) => text.match(RECORD_ID) ?? [])])];
    const questionPeople: string[] = [];
    for (const id of named) {
      const r = tree.get<Hypothesis | Conflict>(id);
      if (!r || r.retracted) continue;
      if (r.type === "hypothesis") questionPeople.push(...hypothesisPeople(tree, r));
      else if (r.type === "conflict") questionPeople.push(...aboutPeople(tree, r.subject));
    }
    const ofQuestion = narrowest(questionPeople);
    if (ofQuestion) return { research: ofQuestion, helps: "question" };
    // b) joining people to the tree: some of them kin of the tree, some not
    kin ??= kinship(tree);
    const all2 = [...new Set([...about, ...questionPeople])];
    const inTree = all2.filter((p) => kin!.has(p));
    if (inTree.length && inTree.length < all2.length) {
      const to = nearest(inTree);
      return { ...(to ? { research: to } : {}), helps: "joins" };
    }
    // p) the partner of a person of a line: that line's work
    const partnerOf = about.map((p) => partnerLines().get(p)).find((x) => x);
    if (partnerOf) return { research: partnerOf, helps: "partner" };
    // c) the agent's word: the line named there, else the nearest one
    if (t.helps?.trim()) {
      const ids: string[] = t.helps.match(RESEARCH_ID) ?? [];
      const said = lines.find((s) => ids.includes(s.research.id));
      const to = said?.research.id ?? nearest(about);
      return { ...(to ? { research: to } : {}), helps: "agent" };
    }
    // d) its branch: the one of its person nearest a line (then the smaller key) — added to a line by the person, or off
    found ??= findBranches(tree, all, people());
    const at = about
      .map((p) => found!.of.get(p))
      .filter((x): x is { branch: string; dist: number } => !!x)
      .sort((a, b) => a.dist - b.dist || byId(a.branch.slice(2), b.branch.slice(2)))[0];
    if (at) {
      choices ??= readOffline(tree);
      const c = choices.branches[at.branch.slice(2)];
      if (c?.mode === "line" && c.line && lines.some((s) => s.research.id === c.line)) return { research: c.line, helps: "branch", branch: at.branch };
      return { off: true, branch: at.branch, dist: at.dist };
    }
    return { off: true, dist: NEAREST_STEPS + 1 };
  };
}

/** The line a task belongs to or helps (the menu's and the app's count of a line's tasks). */
export function lineOf(tree: Tree, all: Scope[]): (t: Task) => string | undefined {
  const place = placer(tree, all);
  return (t) => place(t).research;
}

/** How a task off the lines is taken: its branch's own choice (not "line": its tasks help that line), else the tree's. */
export function branchModeOf(file: OfflineFile, tree: OffLine, branch: string | undefined): { mode: OffLine; own: boolean } {
  const c = branch ? file.branches[branch.slice(2)] : undefined;
  return c && c.mode !== "line" ? { mode: c.mode, own: true } : { mode: tree, own: false };
}

/** The research's lines as the branches go by them: none taken back. */
export function researchLines(tree: Tree): Research[] {
  return tree.list<Research>("research").filter((r) => !r.retracted);
}

/** How many open tasks off the lines are not taken: the tree's setting never, or their branch's (a task the person put in the queue is). */
export function notTaken(tree: Tree, offLine: OffLine, all: Scope[] = scopesOf(tree)): number {
  const n = notTakenBy(tree, offLine, all);
  return n.tree + n.branch;
}

/** The same, by why: the tree's setting queue.offLine never, or the person's choice for their branch (strom offline set). */
export function notTakenBy(tree: Tree, offLine: OffLine, all: Scope[] = scopesOf(tree)): { tree: number; branch: number } {
  const place = placer(tree, all);
  const file = readOffline(tree);
  const out = { tree: 0, branch: 0 };
  for (const t of tree.list<Task>("task")) {
    if (t.state !== "open" || t.queueAt) continue;
    const p = place(t);
    if (!p.off) continue;
    const m = branchModeOf(file, offLine, p.branch);
    if (m.mode === "never") out[m.own ? "branch" : "tree"]++;
  }
  return out;
}

/** How many open tasks off the lines the tree's choice decides: no choice of their branch, no turn of their own (the menu's count). */
export function byTree(tree: Tree, all: Scope[] = scopesOf(tree)): number {
  const file = readOffline(tree);
  const place = placer(tree, all, file);
  return tree.list<Task>("task").filter((t) => {
    if (t.state !== "open" || t.queueAt) return false;
    const p = place(t);
    return !!p.off && !(p.branch && file.branches[p.branch.slice(2)]);
  }).length;
}

/** A branch as the overviews tell it (strom offline list, the bridge's /status.offLine): its size, its choice, a few of its tasks. */
export interface BranchView extends Branch {
  /** Its open tasks (also those taken by the line it was added to). */
  tasks: Task[];
  /** How it is taken: its own choice, else the tree's. */
  mode: BranchMode;
  line?: string;
  /** The person chose for it (strom offline set). */
  own: boolean;
  /** It grows: a line is proposed for it (What waits, core/waiting.ts). */
  grows?: true;
}

/** The research's work off the lines as a whole (undefined: fewer than two lines). */
export interface OffLineView {
  mode: OffLine;
  /** The tree's mode is the person's (strom.json or this computer's config), not the default. */
  own: boolean;
  share: number;
  suggest: boolean;
  /** Open tasks off the lines. */
  tasks: number;
  /** Of them taken by the queue (not never). */
  queued: number;
  /** Open tasks with the person's own turn (strom task order). */
  ownTasks: number;
  branches: BranchView[];
}

/** The open (and at work) tasks. */
const openTasks = (tree: Tree) => tree.list<Task>("task").filter((t) => t.state === "open" || t.state === "doing");

/**
 * The work off the lines of a research with several (undefined with fewer): the tree's choice, the branches with a task
 * or a choice of their own — the nearest to a line first —, and which of them grow.
 */
export function offLineView(tree: Tree, settings: Settings, all: Scope[] = scopesOf(tree)): OffLineView | undefined {
  if (counted(all).length < 2) return undefined;
  const mode = settings.offLine(tree.config);
  const suggest = settings.suggestLines(tree.config);
  const file = readOffline(tree);
  const place = placer(tree, all, file);
  const found = findBranches(tree, all);
  const tasks = openTasks(tree);
  const byBranch = new Map<string, Task[]>();
  let off = 0;
  let queued = 0;
  for (const t of tasks) {
    const p = place(t);
    if (p.off) {
      off++;
      if (t.queueAt || branchModeOf(file, mode, p.branch).mode !== "never") queued++;
    }
    if (p.branch && (p.off || p.helps === "branch")) byBranch.set(p.branch, [...(byBranch.get(p.branch) ?? []), t]);
  }
  const views: BranchView[] = [];
  const known = new Set<string>();
  for (const b of found.branches.values()) {
    const own = file.branches[b.person];
    const ts = byBranch.get(b.id) ?? [];
    if (!ts.length && !own) continue;
    known.add(b.person);
    const v: BranchView = { ...b, tasks: ts, mode: own?.mode ?? mode, ...(own?.mode === "line" && own.line ? { line: own.line } : {}), own: !!own };
    if (grows(v, file, mode, suggest)) v.grows = true;
    views.push(v);
  }
  const dist = (b: BranchView) => found.of.get(b.person)?.dist ?? NEAREST_STEPS + 1;
  views.sort((a, b) => dist(a) - dist(b) || byId(a.person, b.person));
  return { mode, own: settings.resolve("queue.offLine", tree.config) !== undefined, share: settings.offLineShare(tree.config), suggest: suggest.on, tasks: off, queued, ownTasks: tasks.filter((t) => t.queueAt).length, branches: views };
}

/**
 * Whether a line is proposed for a branch (K7.0 d): its choice is the tree's, the person wants lines proposed, the tree
 * takes work off the lines, and it reached queue.suggestTasks tasks or queue.suggestPersons people — after an answer
 * only twice as many as then. Computed when read: nothing is written until the person answers.
 */
function grows(b: BranchView, file: OfflineFile, mode: OffLine, s: { on: boolean; tasks: number; persons: number }): boolean {
  if (b.own || !s.on || mode === "never") return false;
  const a = file.answers[b.person];
  const tasks = b.tasks.length;
  const persons = b.persons.length;
  return tasks >= Math.max(s.tasks, a ? 2 * a.tasks : 0) || persons >= Math.max(s.persons, a ? 2 * a.persons : 0);
}

/** One branch of the research by its key (undefined: none, or no branch now). */
export function branchOf(tree: Tree, settings: Settings, key: string): BranchView | undefined {
  const id = branchKey(key);
  if (!id) return undefined;
  const person = personNow(tree, id.slice(2)) ?? id.slice(2);
  return offLineView(tree, settings)?.branches.find((b) => b.person === person) ?? branchFound(tree, settings, person);
}

/** A branch that has no task and no choice yet (the overview leaves it out): found all the same. */
function branchFound(tree: Tree, settings: Settings, person: string): BranchView | undefined {
  const all = scopesOf(tree);
  if (counted(all).length < 2) return undefined;
  const b = findBranches(tree, all).branches.get(`B-${person}`);
  return b ? { ...b, tasks: [], mode: settings.offLine(tree.config), own: false } : undefined;
}

/** The person's choice for a branch: a mode, added to a line, or back to the tree's ("default"). */
export function setBranch(tree: Tree, person: string, choice: { mode: Exclude<BranchMode, "line"> | "default" } | { mode: "line"; line: string }, by = "set"): void {
  tree.withTreeLock(() => {
    const file = readOffline(tree);
    if (choice.mode === "default") delete file.branches[person];
    else file.branches[person] = { mode: choice.mode, ...(choice.mode === "line" ? { line: choice.line } : {}), at: new Date().toISOString() };
    writeOffline(tree, file, { op: `offline.${by}`, targets: [person, ...(choice.mode === "line" ? [choice.line] : [])], summary: `B-${person} ${choice.mode === "line" ? `added to ${choice.line}` : choice.mode}` });
  });
}

/** The person's answer to the line proposed for a branch: kept with the branch's size then; line and never also its choice. */
export function answerBranch(tree: Tree, b: BranchView, answer: BranchAnswer, line?: string): void {
  tree.withTreeLock(() => {
    const file = readOffline(tree);
    const at = new Date().toISOString();
    file.answers[b.person] = { do: answer, tasks: b.tasks.length, persons: b.persons.length, at };
    if (answer === "never") file.branches[b.person] = { mode: "never", at };
    else if ((answer === "line" || answer === "create") && line) file.branches[b.person] = { mode: "line", line, at };
    writeOffline(tree, file, { op: "offline.answer", targets: [b.person, ...(line ? [line] : [])], summary: `B-${b.person} answered: ${answer}${line ? ` ${line}` : ""}` });
  });
}

/** The people of the branches the person chose not to research (strom offline set … --mode never): no new work proposed for them. */
export function neverPeople(tree: Tree, all: Scope[] = scopesOf(tree)): { people: Set<string>; branches: string[] } {
  const file = readOffline(tree);
  const never = Object.entries(file.branches).filter(([, c]) => c.mode === "never").map(([p]) => `B-${p}`);
  if (!never.length || counted(all).length < 2) return { people: new Set(), branches: [] };
  const found = findBranches(tree, all);
  const people = new Set<string>();
  const branches: string[] = [];
  for (const id of never) {
    const b = found.branches.get(id);
    if (!b) continue;
    branches.push(id);
    for (const p of b.persons) people.add(p);
  }
  return { people, branches };
}

/** How many tasks of a branch an overview shows as samples. */
export const BRANCH_SAMPLES = 3;

/** A branch for a program (strom offline list --json, the bridge's /status.offLine): its tasks counted, a few as samples. */
export function branchJson(b: BranchView, text: (t: Task) => string): Record<string, unknown> {
  return {
    id: b.id,
    person: b.person,
    via: b.via,
    ...(b.nearest ? { nearest: b.nearest } : {}),
    tasks: b.tasks.length,
    persons: b.persons.length,
    samples: b.tasks.slice(0, BRANCH_SAMPLES).map((t) => ({ id: t.id, text: text(t) })),
    mode: b.mode,
    ...(b.line ? { line: b.line } : {}),
    own: b.own,
    ...(b.grows ? { grows: true } : {}),
  };
}

/** The work off the lines for a program; `branches: false` leaves them out (the answer to POST /offline). */
export function offLineJson(v: OffLineView, text: (t: Task) => string, branches = true): Record<string, unknown> {
  const { branches: list, ...rest } = v;
  return { ...rest, ...(branches ? { branches: list.map((b) => branchJson(b, text)) } : {}) };
}
