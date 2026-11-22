// A source deleted by the person (spec 117, K1.1–K1.7): in the research it is retracted — reversibly, with its history.
// Its citations are taken off the facts, names and families (the values stay, a status the citations left cannot carry
// is lowered) and kept in the source (Source.deleted), so that strom source restore puts back exactly what was there;
// a task working on it alone is given up, one with other places narrowed; a conflict standing on it is marked for review
// (its state stays). The text of a story never changes. One write, one operation of the history (source.retract /
// source.restore); the person's alone: strom source retract (consent or the bridge's confirm), never an agent's.

import { UsageError } from "./errors.ts";
import { checkStatus } from "./evidence.ts";
import { canonicalize } from "./json.ts";
import { settledClaim } from "./labels.ts";
import type { AnyRecord, Citation, Conflict, DeletedCitation, Event, Family, Input, Media, Name, Person, Session, Source, SourceDeletion, Status, Story, Task } from "./model.ts";
import { phrase } from "./phrases.ts";
import { sha256, signRecord, verifyRecord } from "./seal.ts";
import { sourcesNamed, storySources } from "./storykeep.ts";
import { now, type Tree } from "./tree.ts";

/** The bridge's feature of deleting a source (/status.features): retract, restore, conflict/keep, the marks of review. */
export const SOURCE_RETRACT_FEATURE = "source.retract";
/** The reason of a source deleted by the person (Source.retracted.reason). */
export const DELETED = "deleted";
/** How many sources one call takes. */
export const RETRACT_MOST = 50;
/** How many items a list of the impacts holds; the rest only counted (more). */
export const IMPACTS_MAX = 200;
/** How long the bridge's confirmation of a dry run holds. */
export const RETRACT_CONFIRM_MS = 15 * 60_000;
/** The mark of review of a conflict a deleted source stood on (2 _STROM_REVIEW). */
export const REVIEW_RETRACTED = "source.retracted";

const ACTIVE = new Set<Task["state"]>(["open", "doing", "parked", "waiting"]);

/** One citation line of the source: the fact (its tag, NAME for a name, FAM for a family itself), how many other sources it keeps. */
export interface ImpactCite {
  owner: string;
  fact: string;
  event?: string;
  others: number;
  locator?: string;
  main?: true;
}

export interface ImpactFact {
  owner: string;
  fact: string;
  event?: string;
}

/** What deleting one source takes with it, as the Strom app's dialog shows it (contract §1, J8). */
export interface SourceImpacts {
  id: string;
  title: string;
  input?: string;
  /** Citation lines as /tree.ged gives them: names, facts of people, families (their own and their facts'), stories. */
  counts: { persons: 0; names: number; events: number; families: number; stories: number };
  cites: ImpactCite[];
  stories: { owner: string; inText: boolean }[];
  /** Facts and names left with no citation. */
  bare: ImpactFact[];
  /** Facts whose status the citations left cannot carry (a bare one among them). */
  lowered: (ImpactFact & { from: Status; to: Status })[];
  conflicts: { id: string; status: Conflict["state"]; becomes: "review" | "unchanged" }[];
  tasks: { id: string; state: Task["state"]; becomes: "dropped" | "narrowed"; heldBy?: string }[];
  /** The files of the material it is of (I…): they stay in the material. */
  files: string[];
  /** Its images from an archive (M…): they stay with it. */
  images: number;
  more: { cites: number; stories: number; bare: number; lowered: number; conflicts: number; tasks: number; files: number };
}

/** What deleting sources wrote. */
export interface Retracted {
  sources: string[];
  retracted: string[];
  impacts: SourceImpacts[];
}

/** What restoring sources put back. */
export interface Restored {
  restored: string[];
  /** The citations put back. */
  citations: number;
  skipped: { source: string; owner: string; fact: string; event?: string; why: "gone" | "already" | "main" }[];
  /** The statuses put back, the tasks put back, the conflicts no longer marked. */
  raised: number;
  tasks: string[];
  conflicts: string[];
}

/** A source deleted by the person (strom source retract): retracted, and its citations kept to be put back. */
export function deletedSource(s: Source | undefined): boolean {
  return !!s && s.type === "source" && s.retracted?.reason === DELETED && !!s.deleted;
}

/** The sources asked: each the research's (source.unknown), at most RETRACT_MOST (source.body). */
function sourcesAsked(tree: Tree, ids: string[]): Source[] {
  const norm = [...new Set(ids.map((x) => x.trim().toUpperCase()).filter(Boolean))].map((x) => (/^S\d+$/u.test(x) ? `S${x.slice(1).padStart(4, "0")}` : x));
  if (!norm.length || norm.length > RETRACT_MOST) throw new UsageError(`sources: 1 to ${RETRACT_MOST} IDs (S…)`, { code: "source.body" });
  return norm.map((id) => {
    const s = tree.get<Source>(id);
    if (!s || s.type !== "source") throw new UsageError(`no source ${id} in the research`, { hint: "strom source list", code: "source.unknown", params: { id } });
    return s;
  });
}

const live = (r: { retracted?: unknown; mergedInto?: string }) => !r.retracted && !r.mergedInto;

/** The sources a citation list keeps that /tree.ged gives (not taken back), apart from those going. */
function othersIn(tree: Tree, list: Citation[], going: Set<string>): number {
  return new Set(list.map((c) => c.source).filter((s) => !going.has(s) && liveSource(tree, s))).size;
}

function liveSource(tree: Tree, id: string): boolean {
  const s = tree.get<Source>(id);
  return !!s && s.type === "source" && !s.retracted;
}

/** The highest status the citations left carry: the status as it is, else probable, else a lead (as sync's fact.uncite). */
export function carriedStatus(tree: Tree, status: Status, citations: Citation[]): Status {
  for (const s of [status, "probable", "lead"] as const) {
    try {
      checkStatus(tree, s, citations);
      return s;
    } catch {
      // less sure
    }
  }
  return "lead";
}

/** The story's versions (the approved one and the one waiting beside it). */
const versions = (st: Story | undefined) => (st ? [st, ...(st.draft ? [st.draft] : [])] : []);

/** A conflict stands on the source: a value of it, the citations of the user's edit or of a proposal, its decision. */
function standsOn(tree: Tree, c: Conflict, id: string): boolean {
  if (c.claims.some((cl) => settledClaim(tree, c, cl).source === id)) return true;
  if (c.edit?.cites?.some((x) => x.source === id) || c.proposal?.cites?.some((x) => x.source === id)) return true;
  return sourcesNamed(tree, `${c.resolution ?? ""}\n${c.reasoning ?? ""}`).includes(id);
}

/** The open session holding a task (its agent at work on it). */
function holderOf(tree: Tree, task: string): string | undefined {
  return tree.list<Session>("session").find((s) => s.task === task && s.state === "open")?.id;
}

interface Plan {
  impacts: SourceImpacts[];
  /** The records changed (persons, families, tasks, conflicts), as they are to be written. */
  changed: Map<string, AnyRecord>;
  deletions: Map<string, SourceDeletion>;
}

/**
 * What deleting the sources would do, worked out on copies: the impacts of each (as if alone: its own counts) and the
 * records as they would be written with all of them gone.
 */
function plan(tree: Tree, sources: Source[], at: string, how: { via?: "bridge" | "terminal"; reason?: string } = {}): Plan {
  const changed = new Map<string, AnyRecord>();
  const edit = <T extends AnyRecord>(r: T): T => {
    let got = changed.get(r.id) as T | undefined;
    if (!got) changed.set(r.id, (got = structuredClone(r)));
    return got;
  };
  const deletions = new Map<string, SourceDeletion>();
  const impacts: SourceImpacts[] = [];
  const persons = tree.list<Person>("person").filter(live);
  const families = tree.list<Family>("family").filter(live);
  const reason = how.reason?.trim().normalize("NFC");
  for (const s of sources) {
    const id = s.id;
    const alone = new Set([id]);
    const cites: ImpactCite[] = [];
    const bare: ImpactFact[] = [];
    const lowered: SourceImpacts["lowered"] = [];
    const counts = { persons: 0 as const, names: 0, events: 0, families: 0, stories: 0 };
    const kept: DeletedCitation[] = [];
    const statuses: NonNullable<SourceDeletion["lowered"]> = [];
    const owners = new Set<string>();
    // one list of citations (a name's, a fact's, a family's own): its lines of the source counted, taken off the copy
    const take = (owner: string, fact: string, list: Citation[] | undefined, where: { event?: string; name?: DeletedCitation["name"] }): Citation[] | undefined => {
      const all = list ?? [];
      if (!all.some((c) => c.source === id)) return undefined;
      owners.add(owner);
      const others = othersIn(tree, all, alone);
      all.forEach((c, i) => {
        if (c.source !== id) return;
        cites.push({ owner, fact, ...(where.event ? { event: where.event } : {}), others, ...(c.locator ? { locator: c.locator } : {}), ...(c.main ? { main: true as const } : {}) });
        kept.push({ owner, fact, ...(where.event ? { event: where.event } : {}), ...(where.name ? { name: where.name } : {}), at: i, citation: c });
      });
      if (fact !== "FAM" && !others) bare.push({ owner, fact, ...(where.event ? { event: where.event } : {}) });
      return all.filter((c) => c.source !== id);
    };
    const facts = (owner: string, events: Event[], copy: () => Event[]) => {
      events.forEach((e, i) => {
        if (e.retracted) return;
        const rest = take(owner, e.kind, e.citations, { event: e.id });
        if (!rest) return;
        if (owner.startsWith("F")) counts.families += e.citations.length - rest.length;
        else counts.events += e.citations.length - rest.length;
        // as sure as the citations left (of the sources that stay) carry it — with all the sources asked gone
        const target = copy()[i]!;
        const after = target.citations.filter((c) => c.source !== id);
        const to = carriedStatus(tree, target.status, after);
        const by = carriedStatus(tree, e.status, rest);
        if (by !== e.status) lowered.push({ owner, fact: e.kind, event: e.id, from: e.status, to: by });
        if (to !== target.status) statuses.push({ owner, event: e.id, from: target.status, to });
        target.citations = after;
        target.status = to;
      });
    };
    for (const p of persons) {
      p.names.forEach((n, i) => {
        const rest = take(p.id, "NAME", n.citations, { name: { index: i, given: n.given, surname: n.surname } });
        if (!rest) return;
        counts.names += (n.citations ?? []).length - rest.length;
        const name = edit(p).names[i]! as Name;
        const after = (name.citations ?? []).filter((c) => c.source !== id);
        if (after.length) name.citations = after;
        else delete name.citations;
      });
      facts(p.id, p.events, () => edit(p).events);
    }
    for (const f of families) {
      const rest = take(f.id, "FAM", f.citations, {});
      if (rest) {
        counts.families += (f.citations ?? []).length - rest.length;
        const copy = edit(f);
        const after = (copy.citations ?? []).filter((c) => c.source !== id);
        if (after.length) copy.citations = after;
        else delete copy.citations;
      }
      facts(f.id, f.events, () => edit(f).events);
    }
    // the stories it is a source of (2 SOUR: through their facts, their background, their text): the text never changes
    const stories: SourceImpacts["stories"] = [];
    for (const r of [...persons, ...families]) {
      const vs = versions(r.story);
      if (!vs.some((v) => storySources(tree, v).some((x) => x.id === id))) continue;
      stories.push({ owner: r.id, inText: vs.some((v) => sourcesNamed(tree, [v.title, v.text, v.note].filter(Boolean).join("\n")).includes(id)) });
    }
    counts.stories = stories.length;
    // the conflicts it is a source of: marked for review whatever their state; those of the same people stay
    const conflicts: SourceImpacts["conflicts"] = [];
    const marked: string[] = [];
    for (const c of tree.list<Conflict>("conflict")) {
      if (c.retracted) continue;
      if (standsOn(tree, c, id)) {
        conflicts.push({ id: c.id, status: c.state, becomes: "review" });
        marked.push(c.id);
        const copy = edit(c);
        copy.review = { why: REVIEW_RETRACTED, sources: [...new Set([...(copy.review?.sources ?? []), id])], at };
      } else if (c.subject.some((x) => owners.has(x))) conflicts.push({ id: c.id, status: c.state, becomes: "unchanged" });
    }
    // the tasks of it not ended: given up when it was their only place, else without it (one of a wording proposed to
    // the person stays: the proposal stays with the source)
    const tasks: SourceImpacts["tasks"] = [];
    const taskWas: NonNullable<SourceDeletion["tasks"]> = [];
    for (const t0 of tree.list<Task>("task")) {
      if (t0.retracted || !ACTIVE.has(t0.state) || t0.proposal) continue;
      const t = (changed.get(t0.id) as Task | undefined) ?? t0;
      if (!t.where.includes(id) && !t.subject.includes(id)) continue;
      const where = t.where.filter((w) => w !== id);
      const held = t.state === "doing" ? holderOf(tree, t.id) : undefined;
      const copy = edit(t0);
      taskWas.push({ was: structuredClone(t), after: at });
      if (!where.length) {
        tasks.push({ id: t.id, state: t.state, becomes: "dropped", ...(held ? { heldBy: held } : {}) });
        copy.state = "dropped";
        copy.result = phrase(tree.lang, "source.retracted.task", { id });
        for (const k of ["parkedFor", "parkedUntil", "parkedReason", "awaitsPermission", "waitingOn", "awaits", "awaitsCheck", "wait", "sent", "heldBy", "heldFrom"] as const) delete copy[k];
      } else {
        tasks.push({ id: t.id, state: t.state, becomes: "narrowed", ...(held ? { heldBy: held } : {}) });
        copy.where = where;
        copy.subject = copy.subject.filter((x) => x !== id);
      }
    }
    // its files of the material (they stay there), its images from an archive (they stay with it)
    const images = new Set([...(s.media ?? []), ...(s.clips ?? []).map((c) => c.media)].filter((m) => m.startsWith("M")));
    const shas = new Set([...images].map((m) => tree.get<Media>(m)?.sha).filter(Boolean));
    const files = tree
      .list<Input>("input")
      .filter((i) => !i.retracted && (i.id === s.input || i.source === id || i.sorted?.source === id || (s.clips ?? []).some((c) => c.media === i.id) || (!!i.sha && shas.has(i.sha)) || (!!i.working?.sha && shas.has(i.working.sha))))
      .map((i) => i.id);
    const cap = <T>(list: T[]) => list.slice(0, IMPACTS_MAX);
    const over = (list: unknown[]) => Math.max(0, list.length - IMPACTS_MAX);
    impacts.push({
      id,
      title: s.title,
      ...(s.input ? { input: s.input } : {}),
      counts,
      cites: cap(cites),
      stories: cap(stories),
      bare: cap(bare),
      lowered: cap(lowered),
      conflicts: cap(conflicts),
      tasks: cap(tasks),
      files: cap(files),
      images: images.size,
      more: { cites: over(cites), stories: over(stories), bare: over(bare), lowered: over(lowered), conflicts: over(conflicts), tasks: over(tasks), files: over(files) },
    });
    deletions.set(id, {
      at,
      by: "user",
      ...(how.via ? { via: how.via } : {}),
      ...(reason ? { reason } : {}),
      cites: kept,
      ...(statuses.length ? { lowered: statuses } : {}),
      ...(taskWas.length ? { tasks: taskWas } : {}),
      ...(marked.length ? { conflicts: marked } : {}),
    });
  }
  return { impacts, changed, deletions };
}

/** A source already retracted, refused (409 source.retracted). */
function refuseRetracted(s: Source): void {
  if (s.retracted)
    throw new UsageError(`${s.id} is retracted already${s.retracted.reason === DELETED ? " (deleted by the person)" : ""}`, {
      hint: deletedSource(s) ? `strom source restore ${s.id} puts it back` : "nothing to delete",
      code: "source.retracted",
      params: { id: s.id },
    });
}

/** What deleting the sources would take with it (strom source retract --dry-run, the bridge's dryRun): nothing written. */
export function retractImpacts(tree: Tree, ids: string[]): SourceImpacts[] {
  const sources = sourcesAsked(tree, ids);
  for (const s of sources) refuseRetracted(s);
  return plan(tree, sources, now()).impacts;
}

/**
 * The sources deleted by the person: retracted (reason "deleted"), their citations taken off and kept in each
 * (Source.deleted), statuses lowered to what is left, tasks given up or narrowed, conflicts marked — one operation
 * source.retract. All or nothing: a source unknown or retracted, and nothing is written. Holds the tree lock; the caller
 * commits (a command of strom).
 */
export function retractSources(tree: Tree, ids: string[], how: { via?: "bridge" | "terminal"; reason?: string } = {}): Retracted {
  return tree.withTreeLock(() => {
    const sources = sourcesAsked(tree, ids);
    for (const s of sources) refuseRetracted(s);
    const at = now();
    const { impacts, changed, deletions } = plan(tree, sources, at, how);
    const records: AnyRecord[] = [...changed.values()].map((r) => ({ ...r, updated: at }) as AnyRecord);
    for (const s of sources) records.push({ ...s, retracted: { at, reason: DELETED }, deleted: deletions.get(s.id)!, updated: at });
    const cites = impacts.reduce((n, i) => n + i.counts.names + i.counts.events + i.counts.families, 0);
    const stories = impacts.reduce((n, i) => n + i.counts.stories, 0);
    const tasks = impacts.reduce((n, i) => n + i.tasks.length + i.more.tasks, 0);
    const conflicts = impacts.reduce((n, i) => n + i.conflicts.filter((c) => c.becomes === "review").length, 0);
    const reason = how.reason?.trim().normalize("NFC");
    tree.putMany(records, [], {
      op: "source.retract",
      targets: [...sources.map((s) => s.id), ...changed.keys()],
      summary: `${sources.map((s) => s.id).join(", ")} deleted by the user${how.via === "bridge" ? " in the Strom app" : how.via === "terminal" ? " in the terminal" : ""}: ${cites} citation(s), ${stories} story(ies), ${tasks} task(s), ${conflicts} conflict(s)`,
      ...(reason ? { reason } : {}),
    });
    return { sources: sources.map((s) => s.id), retracted: sources.map((s) => s.id), impacts };
  });
}

/** The record a merged one went into, and on (undefined: none, or no longer there). */
function liveOwner<T extends Person | Family>(tree: Tree, id: string, get: (id: string) => T | undefined): T | undefined {
  let r = get(id);
  for (let i = 0; r && r.mergedInto && i < 20; i++) r = get(r.mergedInto);
  return r && live(r) ? r : undefined;
}

/**
 * The sources asked, each one the person deleted (the bridge checks them before it runs strom source restore). Refused:
 * none or more than RETRACT_MOST (source.body), unknown (source.unknown), not retracted (source.notRetracted), retracted
 * otherwise than deleted (source.notRestorable, why merged | other).
 */
export function restorable(tree: Tree, ids: string[]): Source[] {
  const sources = sourcesAsked(tree, ids);
  for (const s of sources) {
    if (!s.retracted) throw new UsageError(`${s.id} is not retracted`, { code: "source.notRetracted", params: { id: s.id } });
    if (!deletedSource(s))
      throw new UsageError(`${s.id} was retracted otherwise than deleted by the person (${s.mergedInto ? `merged into ${s.mergedInto}` : s.retracted.reason}): restoring does not bring it back`, {
        code: "source.notRestorable",
        params: { id: s.id, why: s.mergedInto ? "merged" : "other" },
      });
  }
  return sources;
}

/**
 * The deleted sources put back (strom source restore): the same IDs, each citation kept on the fact it was on — found
 * by its ID wherever it is now (a person merged since: under the one it went into) — unless gone (the fact taken back)
 * or there already; the main citation only where no other became main meanwhile; a status the deletion lowered only
 * where nobody changed it since and the citations carry it; the tasks it changed where unchanged since; the marks of
 * review gone. One operation source.restore. Refused: a source not retracted (source.notRetracted), one retracted
 * otherwise (source.notRestorable, why merged | other). Holds the tree lock; the caller commits.
 */
export function restoreSources(tree: Tree, ids: string[]): Restored {
  return tree.withTreeLock(() => {
    const sources = restorable(tree, ids);
    const asked = new Set(sources.map((s) => s.id));
    const at = now();
    const changed = new Map<string, AnyRecord>();
    const edit = <T extends AnyRecord>(r: T): T => {
      let got = changed.get(r.id) as T | undefined;
      if (!got) changed.set(r.id, (got = structuredClone(r)));
      return got;
    };
    const current = <T extends AnyRecord>(id: string): T | undefined => (changed.get(id) as T | undefined) ?? tree.get<T>(id);
    // where each fact is now: by its ID (a merge moves facts with their IDs)
    const owners = new Map<string, string>();
    for (const t of ["person", "family"] as const) for (const r of tree.list<Person | Family>(t)) if (live(r)) for (const e of r.events) owners.set(e.id, r.id);
    const out: Restored = { restored: [], citations: 0, skipped: [], raised: 0, tasks: [], conflicts: [] };
    const records: AnyRecord[] = [];
    for (const s of sources) {
      const d = s.deleted!;
      const skip = (c: DeletedCitation, fact: string, why: Restored["skipped"][number]["why"]) => out.skipped.push({ source: s.id, owner: c.owner, fact, ...(c.event ? { event: c.event } : {}), why });
      // the place it goes back into a list: where it was, the main citation first
      const put = (list: Citation[] | undefined, c: DeletedCitation, fact: string): Citation[] | undefined => {
        const all = list ?? [];
        if (all.some((x) => x.source === c.citation.source && (x.locator ?? "") === (c.citation.locator ?? ""))) {
          skip(c, fact, "already");
          return undefined;
        }
        let cite = c.citation;
        if (cite.main && all.some((x) => x.main)) {
          const { main: _main, ...plain } = cite;
          cite = plain;
          skip(c, fact, "main");
        }
        const i = cite.main ? 0 : Math.min(c.at, all.length);
        out.citations++;
        return [...all.slice(0, i), cite, ...all.slice(i)];
      };
      for (const c of d.cites) {
        if (c.event) {
          const ownerId = owners.get(c.event);
          const owner = ownerId ? current<Person | Family>(ownerId) : undefined;
          const e = owner?.events.find((x) => x.id === c.event);
          if (!owner || !e || e.retracted) {
            skip(c, c.fact, "gone");
            continue;
          }
          const next = put(e.citations, c, e.kind);
          if (next) edit(owner).events.find((x) => x.id === c.event)!.citations = next;
          continue;
        }
        if (c.name) {
          const p = liveOwner(tree, c.owner, (id) => current<Person>(id));
          const n = c.name;
          const same = (x: Name) => x.given === n.given && x.surname === n.surname;
          const i = p ? (p.names[n.index] && same(p.names[n.index]!) ? n.index : p.names.findIndex(same)) : -1;
          if (!p || i < 0) {
            skip(c, "NAME", "gone");
            continue;
          }
          const next = put(p.names[i]!.citations, c, "NAME");
          if (next) edit(p).names[i]!.citations = next;
          continue;
        }
        const f = liveOwner(tree, c.owner, (id) => current<Family>(id));
        if (!f) {
          skip(c, "FAM", "gone");
          continue;
        }
        const next = put(f.citations, c, "FAM");
        if (next) edit(f).citations = next;
      }
      // the statuses it lowered: back where nobody changed them since and the citations carry them
      for (const l of d.lowered ?? []) {
        const ownerId = owners.get(l.event);
        const owner = ownerId ? current<Person | Family>(ownerId) : undefined;
        const e = owner?.events.find((x) => x.id === l.event);
        if (!owner || !e || e.retracted || e.status !== l.to || carriedStatus(tree, l.from, e.citations) !== l.from) continue;
        edit(owner).events.find((x) => x.id === l.event)!.status = l.from;
        out.raised++;
      }
      // the tasks it changed, as they were — where nothing changed them since; never with a place another source still
      // deleted was (deleted with it, not restored now): a task left with no place stays given up
      for (const t of d.tasks ?? []) {
        const cur = current<Task>(t.was.id);
        if (!cur || cur.updated !== t.after) continue;
        const was = structuredClone(t.was);
        const gone = (x: string) => !asked.has(x) && deletedSource(tree.get<Source>(x));
        if (was.where.some(gone) || was.subject.some(gone)) {
          was.where = was.where.filter((x) => !gone(x));
          was.subject = was.subject.filter((x) => !gone(x));
          if (!was.where.length) continue;
        }
        changed.set(t.was.id, was);
        out.tasks.push(t.was.id);
      }
      // the marks of review it gave
      for (const x of d.conflicts ?? []) {
        const c = current<Conflict>(x);
        if (!c?.review?.sources.includes(s.id)) continue;
        const copy = edit(c);
        const left = copy.review!.sources.filter((y) => y !== s.id);
        if (left.length) copy.review = { ...copy.review!, sources: left };
        else delete copy.review;
        out.conflicts.push(x);
      }
      const back: Source = { ...s, updated: at };
      delete back.retracted;
      delete back.deleted;
      records.push(back);
      out.restored.push(s.id);
    }
    for (const r of changed.values()) records.push({ ...r, updated: at } as AnyRecord);
    tree.putMany(records, [], {
      op: "source.restore",
      targets: [...out.restored, ...changed.keys()],
      summary: `${out.restored.join(", ")} restored by the user: ${out.citations} citation(s) back, ${out.skipped.filter((x) => x.why !== "main").length} skipped`,
    });
    return out;
  });
}

/**
 * A conflict whose decision stands though a source it stood on is deleted (strom conflict keep): its mark of review
 * taken off. Refused: an open conflict or one with no mark (conflict.notMarked), none (conflict.unknown).
 */
export function keepConflict(tree: Tree, id: string): Conflict {
  return tree.withTreeLock(() => {
    const c = keepable(tree, id);
    const review = c.review!;
    const next: Conflict = { ...c, updated: now() };
    delete next.review;
    tree.put(next, { op: "conflict.keep", targets: [c.id, ...review.sources], summary: `${c.id} decided as it was, without ${review.sources.join(", ")} (the user)` });
    return next;
  });
}

/**
 * The conflict a decision is kept of (strom conflict keep; the bridge checks it before it runs the command): decided,
 * with a mark of review. Refused: none (conflict.unknown), open or with no mark (conflict.notMarked).
 */
export function keepable(tree: Tree, id: string): Conflict {
  const norm = /^X\d+$/iu.test(id.trim()) ? `X${id.trim().slice(1).padStart(4, "0")}` : id.trim();
  const c = tree.get<Conflict>(norm);
  if (!c || c.type !== "conflict" || c.retracted) throw new UsageError(`no conflict ${id} in the research`, { hint: "strom conflict list", code: "conflict.unknown", params: { id } });
  if (c.state !== "resolved" || !c.review)
    throw new UsageError(c.state !== "resolved" ? `${c.id} is open: deciding it takes its mark off` : `${c.id} has no mark of review`, { code: "conflict.notMarked", params: { id: c.id } });
  return c;
}

/** The mark of a list of impacts (what the person saw): its hash. */
const markOf = (impacts: SourceImpacts[]): string => sha256(JSON.stringify(canonicalize(impacts))).slice(0, 32);

/**
 * The bridge's confirmation of a dry run (POST /source/retract {dryRun: true}): signed with the research's seal key
 * over the sources, the impacts the person was shown and when — "<ms>.<mark>.<signature>".
 */
export function retractConfirm(key: Buffer, sources: string[], impacts: SourceImpacts[], at = Date.now()): string {
  const mark = markOf(impacts);
  return `${at}.${mark}.${signRecord(key, SOURCE_RETRACT_FEATURE, { sources, impacts: mark, at })}`;
}

/**
 * A confirmation checked against the impacts now: `ok`; `changed` — signed, but the research changed since the person
 * saw it (source.retract-changed); `invalid` — none, not signed here, or older than 15 minutes (source.body).
 */
export function checkRetractConfirm(key: Buffer | undefined, sources: string[], impacts: SourceImpacts[], token: unknown, at = Date.now()): "ok" | "changed" | "invalid" {
  if (!key || typeof token !== "string" || token.length > 200) return "invalid";
  const m = /^(\d{1,15})\.([0-9a-f]{32})\.([0-9a-f]{64})$/u.exec(token);
  if (!m) return "invalid";
  const signed = Number(m[1]);
  if (!(signed <= at + 60_000 && at - signed <= RETRACT_CONFIRM_MS)) return "invalid";
  if (!verifyRecord(key, SOURCE_RETRACT_FEATURE, { sources, impacts: m[2], at: signed }, m[3])) return "invalid";
  return m[2] === markOf(impacts) ? "ok" : "changed";
}
