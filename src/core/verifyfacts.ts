// The facts a task of verification (spec 065, core/verify.ts) is about, and whether the originals they cite are here to
// look at. Apart from core/verify.ts so that the queue (core/queue.ts) and the record sets of a task (core/frontier.ts)
// read them without the verification's own imports.

import type { Citation, Event, FactConfirmed, FactVerified, Family, Name, Person, RecordSet, Source, Status, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { provesIt } from "./evidence.ts";
import { familiesAsPartner, primaryName } from "./people.ts";
import { nameEid, parseNameEid } from "./namestatus.ts";

/** A task the sweep made: a fact with its original cited, not yet looked at (after the lines' work, now and then forward). */
export const VERIFY_AUTO = "verify:auto";
/**
 * A task a person's bulk verification made (strom verify bulk): queued as the sweep's. Of a family tree's leads (spec
 * 065 K6.7: no original read) its level is link: the record looked for first, as a search (searchesRecord).
 */
export const VERIFY_BULK = "verify:bulk";
/** A task a person asked for (strom verify facts P…, the Strom app's "verify"): the originals here to look at. */
export const VERIFY_ASKED = "verify:asked";
/** A task a person asked for of facts with no original read: the record the citation names looked for. */
export const VERIFY_SEARCH = "verify:search";

/** Sessions since the last one on a task of the sweep (or a bulk verification) after which one comes forward. */
export const VERIFY_EVERY = 5;

const ORIGINS = new Set([VERIFY_AUTO, VERIFY_BULK, VERIFY_ASKED, VERIFY_SEARCH]);

/** A task of verification against the originals (any kind). */
export const isVerifyTask = (t: Pick<Task, "origin">): boolean => ORIGINS.has(t.origin);
/** A task that waits for its turn after the lines' work (the sweep's, a bulk verification's). */
export const verifiesInTurn = (t: Pick<Task, "origin">): boolean => t.origin === VERIFY_AUTO || t.origin === VERIFY_BULK;
/** The priority of a try of a bulk verification's tasks (strom verify bulk --try): the person's "verify"'s; the rest of a scope low. */
export const TRY_PRIORITY = 3;
/**
 * A task of a bulk verification's try (strom verify bulk --try, spec 065 K7.1): first in the queue (queueAt next) at the
 * person's "verify"'s priority. Two tries in the order they were made — the older one's tasks first (core/queue.ts).
 */
export const isBulkTry = (t: Pick<Task, "origin" | "priority" | "queueAt">): boolean => t.origin === VERIFY_BULK && t.queueAt?.do === "next" && t.priority >= TRY_PRIORITY;
/** A task of verification that looks for the record first (no original of its facts read): asked for, or a bulk one's of a family tree's leads. */
export const searchesRecord = (t: Pick<Task, "origin" | "level">): boolean => t.origin === VERIFY_SEARCH || (t.origin === VERIFY_BULK && t.level === "link");
/** A task that looks at originals cited already (not a search for the record). */
export const readsOriginals = (t: Pick<Task, "origin" | "level">): boolean => (t.origin === VERIFY_AUTO || t.origin === VERIFY_BULK || t.origin === VERIFY_ASKED) && !searchesRecord(t);

const FACT_ID = /^E\p{N}{4,}$/u;
/** The id of the name of a person's identity as a task of verification holds it (core/namestatus.ts nameEid). */
const NAME_ID = /^P\p{N}{4,}\.N$/u;

/** An id a task of verification holds for what it verifies: a fact (E…) or the name of a person's identity (P….N). */
export const isCheckedId = (w: string): boolean => FACT_ID.test(w) || NAME_ID.test(w);
/** The id of the name of a person's identity (P0012.N), as a task holds it. */
export const isNameId = (w: string): boolean => NAME_ID.test(w);

/**
 * What a verification verifies, one view of both (spec 065; spec 066 P5): a fact (`event`), or the name of a person's
 * identity (`name`, primaryName — kind NAME, its id P0012.N). Its status, citations, the person's confirmation against
 * the scan and the last verification, as a fact has them; a name with no status: none.
 */
export interface Checked {
  id: string;
  /** The fact's kind; NAME for a name. */
  kind: string;
  date?: string;
  status?: Status;
  citations: Citation[];
  confirmed?: FactConfirmed;
  verified?: FactVerified;
  retracted?: unknown;
  /** The fact itself; none for a name. */
  event?: Event;
  /** The name itself; none for a fact. */
  name?: Name;
}

/** A fact as verified. */
export const factChecked = (e: Event): Checked => ({ ...e, event: e });

/** The name of a person's identity as verified (none: the person has no name). */
export function nameChecked(p: Person): Checked | undefined {
  const n = primaryName(p);
  if (!p.names.includes(n)) return undefined;
  return {
    id: nameEid(p),
    kind: "NAME",
    ...(n.status ? { status: n.status } : {}),
    citations: n.citations ?? [],
    ...(n.confirmed ? { confirmed: n.confirmed } : {}),
    ...(n.verified ? { verified: n.verified } : {}),
    name: n,
  };
}

/**
 * What a verification changes, written back where it is kept (a fact's event, the name of the person's identity): its
 * status, its last verification, the person's confirmation (null: taken off). The owner as it is then — a copy.
 */
export function withChecked(owner: Person | Family, id: string, change: { status?: Status; verified?: FactVerified; confirmed?: FactConfirmed | null }): Person | Family {
  const apply = <T extends { status?: Status; verified?: FactVerified; confirmed?: FactConfirmed }>(x: T): T => {
    const { confirmed: _c, ...rest } = x;
    const base = (change.confirmed === null ? rest : x) as T;
    return {
      ...base,
      ...(change.status ? { status: change.status } : {}),
      ...(change.verified ? { verified: change.verified } : {}),
      ...(change.confirmed ? { confirmed: change.confirmed } : {}),
    };
  };
  if (owner.type === "person" && isNameId(id)) {
    const n = primaryName(owner);
    return { ...structuredClone(owner), names: owner.names.map((x) => (x === n ? apply(structuredClone(x)) : structuredClone(x))) };
  }
  return { ...structuredClone(owner), events: owner.events.map((e) => (e.id === id ? apply(structuredClone(e)) : e)) } as Person | Family;
}

/**
 * What a task names in its where, each with its owner, found through its subject (a person and their marriages, a
 * family): its facts and the name of a person's identity (P….N, of a person of its subject) — in the order of where.
 */
export function taskItems(tree: Tree, t: Pick<Task, "where" | "subject">): { item: Checked; owner: Person | Family }[] {
  const wanted = new Set(t.where.filter(isCheckedId));
  if (!wanted.size) return [];
  const found = new Map<string, { item: Checked; owner: Person | Family }>();
  const seen = new Set<string>();
  const look = (owner: Person | Family) => {
    if (seen.has(owner.id)) return;
    seen.add(owner.id);
    for (const e of owner.events) if (wanted.has(e.id)) found.set(e.id, { item: factChecked(e), owner });
    if (owner.type === "person" && wanted.has(nameEid(owner))) {
      const item = nameChecked(owner);
      if (item) found.set(item.id, { item, owner });
    }
  };
  for (const id of t.subject) {
    const r = tree.get<Person | Family>(id);
    if (!r || (r.type !== "person" && r.type !== "family")) continue;
    look(r);
    if (r.type === "person") for (const f of familiesAsPartner(tree, r.id)) look(f);
  }
  // a name of a person the subject does not name (a family's partner): found by its id
  for (const w of wanted)
    if (isNameId(w) && !found.has(w)) {
      const p = tree.get<Person>(parseNameEid(w) ?? "");
      const item = p && p.type === "person" ? nameChecked(p) : undefined;
      if (p && item) found.set(w, { item, owner: p });
    }
  return t.where.flatMap((w) => (found.has(w) ? [found.get(w)!] : []));
}

/** The facts a task names in its where, each with its owner, found through its subject (a person and their marriages, a family). */
export function taskFacts(tree: Tree, t: Pick<Task, "where" | "subject">): { event: Event; owner: Person | Family }[] {
  return taskItems(tree, t).flatMap(({ item, owner }) => (item.event ? [{ event: item.event, owner }] : []));
}

/** The sources whose original the fact cites with primary information (core/evidence.ts provesIt), sorted. */
export function originalCites(tree: Tree, e: Pick<Event, "citations">): string[] {
  return [...new Set(e.citations.filter((c) => provesIt(tree, c)).map((c) => c.source))].sort();
}

/** An original of the fact is here to look at: an image of its own, a part cut out, the user's file, or its book's images. */
export function factHasImages(tree: Tree, e: Pick<Event, "citations">, withImages: Set<string | undefined>): boolean {
  return originalCites(tree, e).some((id) => {
    const s = tree.get<Source>(id);
    return !!s && (!!s.media?.length || !!s.clips?.length || !!s.input || (!!s.recordset && withImages.has(s.recordset)));
  });
}

/** A task that reads the originals with none of them here (it needs the person to download them). */
export function verifyLacksImages(tree: Tree, t: Task, withImages: Set<string | undefined>): boolean {
  const items = taskItems(tree, t).filter((f) => !f.item.retracted);
  return items.length > 0 && !items.some((f) => factHasImages(tree, f.item, withImages));
}

/** The record sets of the originals a task of verification looks at (those its facts cite). */
export function verifyRecordsets(tree: Tree, t: Task): RecordSet[] {
  const out = new Map<string, RecordSet>();
  for (const { item } of taskItems(tree, t))
    for (const id of originalCites(tree, item)) {
      const s = tree.get<Source>(id);
      const b = s?.recordset ? tree.get<RecordSet>(s.recordset) : undefined;
      if (b?.type === "recordset") out.set(b.id, b);
    }
  return [...out.values()];
}
