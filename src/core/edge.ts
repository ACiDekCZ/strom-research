// The edge of the tree: the people above whom it does not go on — no parents, one of them, or parents no record
// proves — and what the research knows there. Why it ends (what the records say so far: the known books of the
// birth, the years searched in vain, the records that begin later or are lost), what comes next (the work on it and
// where it stands in the queue, or that the user decides), and the hypotheses that would join a family nothing
// links to the tree yet. Read only, computed from the research: what the Strom app shows on the card where the
// tree ends (_STROM_EDGE, _STROM_ISLAND) and what `strom edge` says.

import type { Conflict, Hypothesis, Person, RecordSet, Research, Search, Session, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { now } from "./tree.ts";
import { Settings } from "./config.ts";
import { aboutPeople, directionOf, hypothesisPeople, namesId, scopes, type Scope } from "./directions.ts";
import { birthEstimate, birthRecordProven, birthWindow, frontier, FRONTIER_LEVELS, RECORD_KINDS, recordsetsCovering, type FrontierItem } from "./frontier.ts";
import { kinship, offTree } from "./kin.ts";
import { familiesAsChild, familiesAsPartner, parentsOf, primaryName } from "./people.ts";
import { livingBorn } from "./review.ts";
import { effectiveState, rankTasks } from "./queue.ts";
import { subjectPeople } from "./records.ts";
import { foldText } from "./text.ts";

/** What is missing above the person: both parents, one of them, or a record that proves the parents recorded. */
export const EDGE_MISSING = ["parents", "father", "mother", "proof"] as const;
/**
 * Whether the research reaches them: a direction of it does (in), would but stops at its limit (limit), is paused
 * or ended (paused, done); none does — they are most likely alive (living), family of the tree no direction goes
 * through (outside), or a family nothing links to the tree yet (off-tree).
 */
export const EDGE_SCOPES = ["in", "limit", "paused", "done", "living", "outside", "off-tree"] as const;
/**
 * What the records say so far, from the most final: the baptism names no father (born out of wedlock); every year of the
 * birth is searched in vain or has no records — lost, before the known records begin, a gap in them; searched in
 * vain everywhere strom knew to look; the books left are only in the archive; searched in part; not searched yet;
 * no book of the birthplace known; the birthplace unknown; nothing to go on (no year, no place).
 */
export const EDGE_ENDS = ["unnamed", "lost", "before-records", "gap", "not-found", "offline", "partly", "unsearched", "no-books", "no-place", "no-clue"] as const;
/**
 * What comes next: an agent works on it now, it waits for the user, it is in the queue, it waits out of the queue
 * (a direction paused, people off the tree, put aside), strom proposes it with the next session, everything strom
 * could propose was tried (the user decides), nothing.
 */
export const EDGE_NEXT = ["working", "waiting", "queued", "held", "proposed", "decide", "none"] as const;

export interface EdgeTask {
  id: string;
  level: Task["level"];
  state: Task["state"];
  what: string;
  /** Its place in the agent's queue (1: the next one). */
  position?: number;
  /** Why it waits out of the queue: its direction paused or ended, about people off the tree, put aside. */
  held?: "paused" | "done" | "off-tree" | "parked";
  /** Put aside until. */
  until?: string;
  /** What it waits for from the user, or why it was put aside. */
  on?: string;
}

export interface EdgeHypothesis {
  id: string;
  question: string;
  /**
   * It names people on the tree and off it — it would join a family nothing links to the tree: the people it names
   * on the other side (of the tree, the people off it; off it, the people of the tree it would join them to).
   */
  joins: string[];
  /** The family off the tree it would join (an edge on the tree): how many people, how many tasks about them wait for it. */
  island?: { people: number; held: number };
  /** The open tasks that test it. */
  tests: string[];
}

export interface Edge {
  person: string;
  missing: (typeof EDGE_MISSING)[number];
  scope: (typeof EDGE_SCOPES)[number];
  /** The direction that reaches them (the narrowest), and their generation in it. */
  research?: string;
  generation?: number;
  end: (typeof EDGE_ENDS)[number];
  next: (typeof EDGE_NEXT)[number];
  /** When and where they were born, if only roughly: estimated from their marriage or eldest child (basis). */
  estimate?: { year?: number; place?: string; basis?: { kind: "MARR" | "child"; year: number } };
  /** The years their baptism is sought in. */
  window?: { from: number; to: number };
  /** The known birth records of the place begin (before-records). */
  recordsFrom?: number;
  /** The known books of the birth in those years. */
  books: { id: string; title: string; years?: string; access: RecordSet["access"] }[];
  /** Years of the window searched in vain in every known book of them. */
  covered: { from: number; to: number }[];
  /** Years of the window no book is known for (before the records begin, a gap). */
  noRecords: { from: number; to: number }[];
  /** The work on the parents not finished yet. */
  tasks: EdgeTask[];
  /** …and finished (done, dropped). */
  tried: string[];
  hypotheses: EdgeHypothesis[];
  /** Open conflicts about their birth or parents. */
  conflicts: string[];
  /** Searches for the parents recorded. */
  searches: number;
  /** Sessions spent on the parents, what they cost (partial: some did not say), the last day of work on it. */
  sessions: number;
  cost?: number;
  costPartial?: boolean;
  last?: string;
}

/** A family nothing links to the tree: its people, the hypotheses that would join it (with the tree's people they name), tasks waiting for it. */
export interface Island {
  people: string[];
  hypotheses: { id: string; joins: string[] }[];
  held: number;
}

const BIRTH_KINDS = RECORD_KINDS.BIRT!;
const LIVE = new Set<Task["state"]>(["open", "doing", "waiting", "parked"]);
const FINISHED = new Set<Task["state"]>(["done", "dropped"]);
const EDGE_FACTS = new Set(["BIRT", "CHR", "BAPM", "FAMC"]);

type Years = { from: number; to: number };

function yearsOf(text: string | undefined): Years | undefined {
  const m = /^\s*(\d{3,4})(?:\s*[-–]\s*(\d{3,4}))?\s*$/.exec(text ?? "");
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

/** Single years as ranges ([1780, 1781, 1782, 1790] → 1780–1782, 1790). */
function ranges(years: number[]): Years[] {
  const out: Years[] = [];
  for (const y of [...years].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && y === last.to + 1) last.to = y;
    else out.push({ from: y, to: y });
  }
  return out;
}

const within = (y: number, r: Years | undefined) => !r || (y >= r.from && y <= r.to);

/** The families nothing links to the tree, person by person (none when the tree has nobody it is for). */
function islands(tree: Tree, kin: Map<string, unknown>, tasks: Task[], hypotheses: Hypothesis[]): Map<string, Island> {
  const out = new Map<string, Island>();
  if (!kin.size) return out;
  const off = offTree(tree);
  for (const p of tree.list<Person>("person")) {
    if (p.retracted || kin.has(p.id) || out.has(p.id)) continue;
    const people = new Set<string>();
    const queue = [p.id];
    while (queue.length) {
      const id = queue.shift()!;
      if (people.has(id) || kin.has(id)) continue;
      people.add(id);
      queue.push(...familiesAsPartner(tree, id).flatMap((f) => [...f.partners, ...f.children.map((c) => c.person)]), ...familiesAsChild(tree, id).flatMap((f) => f.partners));
    }
    const island: Island = {
      people: [...people],
      hypotheses: hypotheses
        .map((h) => ({ h, about: hypothesisPeople(tree, h) }))
        .filter(({ about }) => about.some((x) => people.has(x)) && about.some((x) => kin.has(x)))
        .map(({ h, about }) => ({ id: h.id, joins: about.filter((x) => kin.has(x)) })),
      held: tasks.filter((t) => LIVE.has(t.state) && off(t) && aboutPeople(tree, t.subject).some((x) => people.has(x))).length,
    };
    for (const id of people) out.set(id, island);
  }
  return out;
}

/** Every edge of the tree with something the research knows of it, and the families nothing links to the tree. */
export function treeEdges(tree: Tree): { edges: Map<string, Edge>; islands: Map<string, Island> } {
  const lang = tree.lang;
  const today = now().slice(0, 10);
  const kin = kinship(tree);
  const all = scopes(tree).filter((s) => !s.research.retracted);
  const tasks = tree.list<Task>("task").filter((t) => !t.retracted);
  const hypotheses = tree.list<Hypothesis>("hypothesis").filter((h) => !h.retracted && h.state === "open");
  const conflicts = tree.list<Conflict>("conflict").filter((c) => !c.retracted && c.state === "open");
  const searches = tree.list<Search>("search").filter((q) => !q.retracted);
  const sessions = tree.list<Session>("session");
  const researches = new Map(tree.list<Research>("research").map((r) => [r.id, r]));
  const ranked = rankTasks(tree, tasks, new Settings(tree.env, {}).strategy(tree.config)).map((r) => r.task.id);
  const position = new Map(ranked.map((id, i) => [id, i + 1]));
  const off = offTree(tree);
  const isles = islands(tree, kin, tasks, hypotheses);
  const frontiers = new Map<string, Map<string, FrontierItem>>();
  const frontierOf = (r: Research) => {
    if (!frontiers.has(r.id)) frontiers.set(r.id, new Map(frontier(tree, r).map((i) => [i.person.id, i])));
    return frontiers.get(r.id)!;
  };
  const hypAbout = hypotheses.map((h) => ({ h, about: hypothesisPeople(tree, h) }));

  const edges = new Map<string, Edge>();
  for (const p of tree.list<Person>("person")) {
    if (p.retracted) continue;
    const parents = parentsOf(tree, p.id);
    const proven = birthRecordProven(p);
    let missing: Edge["missing"];
    if (parents.length === 0) missing = "parents";
    else if (parents.length === 1) missing = parents[0]!.sex === "F" ? "father" : parents[0]!.sex === "M" ? "mother" : "parents";
    else if (!proven) missing = "proof";
    else continue;

    // ── whether the research reaches them ──
    const est = birthEstimate(tree, p, lang);
    const window = birthWindow(est);
    const reach = all.filter((s) => (s.people.get(p.id) ?? 0) >= 1).sort((a, b) => a.people.size - b.people.size || a.research.id.localeCompare(b.research.id));
    const limited = (s: Scope) => {
      const l = s.research.limits;
      return !!((l?.generations && s.people.get(p.id)! >= l.generations) || (l?.before && est.year && est.year < l.before));
    };
    const active = reach.filter((s) => s.research.state === "active");
    const through = active.find((s) => !limited(s)) ?? active[0] ?? reach.find((s) => s.research.state === "paused") ?? reach[0];
    const scope: Edge["scope"] = active.some((s) => !limited(s))
      ? "in"
      : active.length
        ? "limit"
        : through
          ? (through.research.state as "paused" | "done")
          : livingBorn(tree, p) !== undefined
            ? "living"
            : kin.size && !kin.has(p.id)
              ? "off-tree"
              : "outside";

    // ── the books of the birth, and the work on the parents ──
    const placeBooks = est.place ? recordsetsCovering(tree, est.place, undefined, BIRTH_KINDS).filter((b) => !b.retracted) : [];
    const books = placeBooks.filter((b) => !window || !b.years || (() => {
      const y = yearsOf(b.years);
      return !y || (y.from <= window.to && y.to >= window.from);
    })());
    const bookIds = new Set(books.map((b) => b.id));
    const hyps = hypAbout.filter(({ about }) => about.includes(p.id)).map(({ h, about }) => ({ h, about }));
    const hypIds = new Set(hyps.map(({ h }) => h.id));
    const onParents = (t: Task) =>
      (t.subject.includes(p.id) && (FRONTIER_LEVELS.has(t.level) || ((t.level === "verify" || t.level === "enrich") && t.where.some((w) => bookIds.has(w))))) ||
      t.subject.some((s) => hypIds.has(s));
    const mine = tasks.filter(onParents);
    const mineIds = new Set(mine.map((t) => t.id));
    const surname = foldText(primaryName(p).surname);
    const sought = searches.filter((q) => (q.task ? mineIds.has(q.task) : !!surname && (q.scope.surnames ?? []).some((s) => foldText(s) === surname) && q.recordsets.some((b) => bookIds.has(b))));

    const edgeTasks: EdgeTask[] = mine
      .filter((t) => LIVE.has(effectiveState(t, today)))
      .map((t) => {
        const state = effectiveState(t, today);
        const at = position.get(t.id);
        const dir = directionOf(tree, t, all);
        const dirState = dir ? researches.get(dir)?.state : undefined;
        const held: EdgeTask["held"] =
          state === "parked" ? "parked" : state !== "open" || at ? undefined : dirState === "paused" || dirState === "done" ? dirState : off(t) ? "off-tree" : undefined;
        const on = state === "waiting" ? t.waitingOn : state === "parked" ? t.parkedReason : undefined;
        return {
          id: t.id,
          level: t.level,
          state,
          what: t.what,
          ...(at && state === "open" ? { position: at } : {}),
          ...(held ? { held } : {}),
          ...(state === "parked" && t.parkedUntil ? { until: t.parkedUntil } : {}),
          ...(on ? { on } : {}),
        };
      })
      .sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.id.localeCompare(b.id));
    const tried = mine.filter((t) => FINISHED.has(t.state)).map((t) => t.id);
    const item = through && through.research.state === "active" ? frontierOf(through.research).get(p.id) : undefined;

    const next: Edge["next"] = edgeTasks.some((t) => t.state === "doing")
      ? "working"
      : edgeTasks.some((t) => t.state === "waiting")
        ? "waiting"
        : edgeTasks.some((t) => t.position)
          ? "queued"
          : edgeTasks.length
            ? "held"
            : scope === "in" && item?.proposal
              ? "proposed"
              : tried.length || item?.exhausted
                ? "decide"
                : "none";

    // ── what the records say so far: each year of the window searched in vain, without records, or open ──
    const covered: number[] = [];
    const noRecords: number[] = [];
    const lostYears: number[] = [];
    const open: { year: number; online: boolean }[] = [];
    if (window && placeBooks.length)
      for (let y = window.from; y <= window.to; y++) {
        const of = books.filter((b) => within(y, yearsOf(b.years)));
        const kept = of.filter((b) => b.access !== "lost");
        if (!of.length) noRecords.push(y);
        else if (!kept.length) lostYears.push(y);
        else if (
          kept.every((b) =>
            sought.some((q) => q.result === "negative" && q.recordsets.includes(b.id) && within(y, yearsOf(q.scope.years) ?? (q.scope.pages ? { from: 0, to: -1 } : yearsOf(b.years)))),
          )
        )
          covered.push(y);
        else open.push({ year: y, online: kept.some((b) => b.access === "online-free" || b.access === "online-login") });
      }
    const earliest = Math.min(...placeBooks.map((b) => yearsOf(b.years)?.from ?? Infinity));
    let end: Edge["end"];
    // the baptism is read and names the mother alone (a child born out of wedlock); a mother missing is one not recorded yet
    if (missing === "father" && proven) end = "unnamed";
    else if (!est.place) end = est.year ? "no-place" : "no-clue";
    else if (!placeBooks.length) end = "no-books";
    else if (window && !open.length)
      end = lostYears.length
        ? "lost"
        : noRecords.length === window.to - window.from + 1 && earliest > window.to
          ? "before-records"
          : noRecords.length
            ? noRecords.every((y) => y < earliest)
              ? "before-records"
              : "gap"
            : "not-found";
    else if (item?.exhausted) end = "not-found";
    else if (window && open.every((o) => !o.online)) end = "offline";
    else end = sought.length || tried.length ? "partly" : "unsearched";

    // ── the hypotheses, conflicts, and what the work cost ──
    // a hypothesis that names people on and off the tree would join them: the people on the other side of it
    const onTree = kin.has(p.id);
    const edgeHyps: EdgeHypothesis[] = hyps.map(({ h, about }) => {
      const joining = kin.size > 0 && about.some((x) => kin.has(x)) && about.some((x) => !kin.has(x));
      const joins = joining ? about.filter((x) => kin.has(x) !== onTree) : [];
      const isle = joins.length && onTree ? isles.get(joins[0]!) : undefined;
      return {
        id: h.id,
        question: h.question,
        joins,
        ...(isle ? { island: { people: isle.people.length, held: isle.held } } : {}),
        // a task about it, or one whose words name it ("the baptism … (H0007 B)")
        tests: tasks.filter((t) => LIVE.has(t.state) && (t.subject.includes(h.id) || namesId(t.what, h.id))).map((t) => t.id),
      };
    });
    const edgeConflicts = conflicts
      .filter((c) => subjectPeople(tree, c.subject).includes(p.id) && (!c.fact || EDGE_FACTS.has(c.fact)))
      .map((c) => c.id);
    const spent = sessions.filter((s) => s.task && mineIds.has(s.task));
    const cost = spent.reduce((n, s) => n + (s.metrics?.costUsd ?? 0), 0);
    const partial = spent.some((s) => s.state !== "open" && (s.metrics?.costPartial || s.metrics?.costUsd === undefined));
    const last = [...spent.map((s) => s.ended ?? s.started), ...sought.map((q) => q.created)].sort().pop()?.slice(0, 10);

    const known = scope === "in" || scope === "limit" || scope === "paused" || scope === "done" || edgeTasks.length || tried.length || edgeHyps.length || sought.length || edgeConflicts.length;
    if (!known) continue;
    edges.set(p.id, {
      person: p.id,
      missing,
      scope,
      ...(through ? { research: through.research.id, generation: through.people.get(p.id)! } : {}),
      end,
      next,
      ...(est.year || est.place ? { estimate: { ...(est.year ? { year: est.year } : {}), ...(est.place ? { place: est.place } : {}), ...(est.basis ? { basis: est.basis } : {}) } } : {}),
      ...(window ? { window } : {}),
      ...(Number.isFinite(earliest) && (end === "before-records" || noRecords.some((y) => y < earliest)) ? { recordsFrom: earliest } : {}),
      books: books.map((b) => ({ id: b.id, title: b.title, ...(b.years ? { years: b.years } : {}), access: b.access })),
      covered: ranges(covered),
      noRecords: ranges(noRecords),
      tasks: edgeTasks,
      tried,
      hypotheses: edgeHyps,
      conflicts: edgeConflicts,
      searches: sought.length,
      sessions: spent.length,
      ...(spent.length ? { cost: Math.round(cost * 100) / 100, ...(partial ? { costPartial: true } : {}) } : {}),
      ...(last ? { last } : {}),
    });
  }
  return { edges, islands: isles };
}
