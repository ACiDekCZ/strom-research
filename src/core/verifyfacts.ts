// The facts a task of verification (spec 065, core/verify.ts) is about, and whether the originals they cite are here to
// look at. Apart from core/verify.ts so that the queue (core/queue.ts) and the record sets of a task (core/frontier.ts)
// read them without the verification's own imports.

import type { Event, Family, Person, RecordSet, Source, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { provesIt } from "./evidence.ts";
import { familiesAsPartner } from "./people.ts";

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
/** A task of verification that looks for the record first (no original of its facts read): asked for, or a bulk one's of a family tree's leads. */
export const searchesRecord = (t: Pick<Task, "origin" | "level">): boolean => t.origin === VERIFY_SEARCH || (t.origin === VERIFY_BULK && t.level === "link");
/** A task that looks at originals cited already (not a search for the record). */
export const readsOriginals = (t: Pick<Task, "origin" | "level">): boolean => (t.origin === VERIFY_AUTO || t.origin === VERIFY_BULK || t.origin === VERIFY_ASKED) && !searchesRecord(t);

const FACT_ID = /^E\p{N}{4,}$/u;

/** The facts a task names in its where, each with its owner, found through its subject (a person and their marriages, a family). */
export function taskFacts(tree: Tree, t: Pick<Task, "where" | "subject">): { event: Event; owner: Person | Family }[] {
  const wanted = new Set(t.where.filter((w) => FACT_ID.test(w)));
  if (!wanted.size) return [];
  const out: { event: Event; owner: Person | Family }[] = [];
  const seen = new Set<string>();
  const look = (owner: Person | Family) => {
    if (seen.has(owner.id)) return;
    seen.add(owner.id);
    for (const e of owner.events) if (wanted.has(e.id)) out.push({ event: e, owner });
  };
  for (const id of t.subject) {
    const r = tree.get<Person | Family>(id);
    if (!r || (r.type !== "person" && r.type !== "family")) continue;
    look(r);
    if (r.type === "person") for (const f of familiesAsPartner(tree, r.id)) look(f);
  }
  return out;
}

/** The sources whose original the fact cites with primary information (core/evidence.ts provesIt), sorted. */
export function originalCites(tree: Tree, e: Event): string[] {
  return [...new Set(e.citations.filter((c) => provesIt(tree, c)).map((c) => c.source))].sort();
}

/** An original of the fact is here to look at: an image of its own, a part cut out, the user's file, or its book's images. */
export function factHasImages(tree: Tree, e: Event, withImages: Set<string | undefined>): boolean {
  return originalCites(tree, e).some((id) => {
    const s = tree.get<Source>(id);
    return !!s && (!!s.media?.length || !!s.clips?.length || !!s.input || (!!s.recordset && withImages.has(s.recordset)));
  });
}

/** A task that reads the originals with none of them here (it needs the person to download them). */
export function verifyLacksImages(tree: Tree, t: Task, withImages: Set<string | undefined>): boolean {
  const facts = taskFacts(tree, t).filter((f) => !f.event.retracted);
  return facts.length > 0 && !facts.some((f) => factHasImages(tree, f.event, withImages));
}

/** The record sets of the originals a task of verification looks at (those its facts cite). */
export function verifyRecordsets(tree: Tree, t: Task): RecordSet[] {
  const out = new Map<string, RecordSet>();
  for (const { event } of taskFacts(tree, t))
    for (const id of originalCites(tree, event)) {
      const s = tree.get<Source>(id);
      const b = s?.recordset ? tree.get<RecordSet>(s.recordset) : undefined;
      if (b?.type === "recordset") out.set(b.id, b);
    }
  return [...out.values()];
}
