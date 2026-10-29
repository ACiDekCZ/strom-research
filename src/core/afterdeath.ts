// A person named alive after their death (spec 021 K4.3): an event of the person (but the burial, the cremation, the
// probate and the will) or a marriage of theirs dated certainly after their death — the dates read as loosely as each
// is written (core/gdate.ts dateMonths: "ABT 1857" against "1858" is none), as the Strom app reads them. strom check
// warns of each (after-death, never blocking a commit); the plan of a research raises a task to look into it. What the
// person marked "not an error" (quality/dismissed.json: eventAfterDeath / weddingAfterDeath with the event's year) is
// neither warned of nor looked into, and a task of it waiting is done.

import { certainlyBefore, dateMonths, dateYears } from "./gdate.ts";
import { displayName } from "./people.ts";
import { dismissedLookup, EVENT_AFTER_DEATH, MARR_AFTER_DEATH } from "./quality.ts";
import { phrase } from "./phrases.ts";
import { update } from "./records.ts";
import { researchPeople } from "./frontier.ts";
import type { Citation, Event, Family, Person, Research, Task } from "./model.ts";
import type { Tree } from "./tree.ts";

/** Events that come after a death by their nature (as the Strom app leaves them out too). */
const AFTER_BY_NATURE = new Set(["DEAT", "BURI", "CREM", "PROB", "WILL"]);

export const AFTER_DEATH_ORIGIN = "after-death";

export interface AfterDeath {
  kind: typeof EVENT_AFTER_DEATH | typeof MARR_AFTER_DEATH;
  /** The one who died (the finding's person). */
  person: string;
  /** The event dated after the death: the person's, or the family's marriage. */
  event: Event;
  /** The family of the marriage. */
  family?: string;
  death: Event;
  /** The earliest year the event's date may mean, four digits: the subject of the person's mark. */
  year: string;
}

const written = (e: Event) => !(e.retracted || e.status === "retracted" || e.status === "disproven");

/** The year a date begins with, four digits ("ABT 861" → "0861"); undefined without one. */
export function earliestYear(date: string | undefined): string | undefined {
  const years = date ? dateYears(date) : [];
  return years.length ? String(Math.min(...years)).padStart(4, "0") : undefined;
}

/** The death a person's later events are measured by: of their deaths written, the one that may be latest. */
function deathOf(p: Person): Event | undefined {
  let best: { e: Event; max: number } | undefined;
  for (const e of p.events) {
    if (e.kind !== "DEAT" || !written(e)) continue;
    const m = dateMonths(e.date);
    if (m && (!best || m.max > best.max)) best = { e, max: m.max };
  }
  return best?.e;
}

/** Every person of the tree named alive after their death; `marked`: also those the person marked "not an error". */
export function afterDeath(tree: Tree, marked = false): AfterDeath[] {
  const out: AfterDeath[] = [];
  const lookup = marked ? undefined : dismissedLookup(tree);
  const deaths = new Map<string, Event>();
  for (const p of tree.list<Person>("person")) {
    if (p.retracted || p.mergedInto) continue;
    const death = deathOf(p);
    if (!death) continue;
    deaths.set(p.id, death);
    for (const e of p.events) {
      if (AFTER_BY_NATURE.has(e.kind) || !written(e) || !certainlyBefore(death.date, e.date)) continue;
      const year = earliestYear(e.date)!;
      if (lookup?.(EVENT_AFTER_DEATH, [p.id], year)) continue;
      out.push({ kind: EVENT_AFTER_DEATH, person: p.id, event: e, death, year });
    }
  }
  for (const f of tree.list<Family>("family")) {
    if (f.retracted) continue;
    for (const e of f.events) {
      if (e.kind !== "MARR" || !written(e)) continue;
      for (const pid of f.partners) {
        const death = deaths.get(pid);
        if (!death || !certainlyBefore(death.date, e.date)) continue;
        const year = earliestYear(e.date)!;
        if (lookup?.(MARR_AFTER_DEATH, [pid], year)) continue;
        out.push({ kind: MARR_AFTER_DEATH, person: pid, event: e, family: f.id, death, year });
      }
    }
  }
  return out;
}

/** What strom check says of one (English, for the agent: what to do, and that the person may mark it). */
export function afterDeathMessage(a: AfterDeath): string {
  const what = a.family ? `the marriage ${a.event.id} of ${a.family} (${a.event.date})` : `${a.event.kind} ${a.event.id} (${a.event.date})`;
  return `${a.person} died ${a.death.date} (${a.death.id}), but ${what} is dated certainly after it — check both records (strom person show ${a.person}); a wrong date or a wrong person is corrected with its record, two people are told apart (strom person add); the person may mark it no error: strom quality dismiss ${a.kind} ${a.person} --subject ${a.year}`;
}

const citationSaid = (cs: Citation[]) => cs.map((c) => (c.locator ? `${c.source} (${c.locator})` : c.source)).join(", ");

function factSaid(lang: string, e: Event): string {
  const cites = citationSaid(e.citations ?? []);
  return phrase(lang, cites ? "afterdeath.fact" : "afterdeath.fact.uncited", { kind: e.kind, id: e.id, date: e.date ?? "", place: e.place ? `, ${e.place}` : "", cites });
}

type Proposal = Omit<Task, "id" | "type" | "created" | "updated" | "notes" | "state">;

/**
 * The tasks the plan of a research raises: one for each person of it named alive after their death — both facts with
 * their citations, in the research's language. Never for an event a task of this kind had already (whatever became of
 * it), never in an archive (the caller: researchProposals raises nothing there).
 */
export function afterDeathProposals(tree: Tree, research: Research): Proposal[] {
  const found = afterDeath(tree);
  if (!found.length) return [];
  const taken = new Set(tree.list<Task>("task").filter((t) => t.origin === AFTER_DEATH_ORIGIN).flatMap((t) => t.where));
  const scope = researchPeople(tree, research);
  const lang = tree.lang;
  const out: Proposal[] = [];
  for (const a of found) {
    if (scope.size && !scope.has(a.person)) continue;
    if (taken.has(a.event.id)) continue;
    taken.add(a.event.id);
    const p = tree.get<Person>(a.person)!;
    const v = { name: `${displayName(p)} (${a.person})`, death: factSaid(lang, a.death), event: factSaid(lang, a.event), year: a.year, research: research.name };
    out.push({
      level: "verify",
      priority: 3,
      what: phrase(lang, a.family ? "afterdeath.wedding.what" : "afterdeath.what", v),
      where: [a.event.id, a.death.id],
      why: phrase(lang, "afterdeath.why", v),
      doneWhen: phrase(lang, "afterdeath.done", v),
      subject: a.family ? [a.person, a.family] : [a.person],
      research: research.id,
      origin: AFTER_DEATH_ORIGIN,
    });
  }
  return out;
}

/**
 * The tasks of this kind still waiting whose reason went: the person marked it no error, or the dates no longer say so
 * (corrected, taken back) — done, with why. Returns their IDs.
 */
export function settleAfterDeath(tree: Tree): string[] {
  const tasks = tree.list<Task>("task").filter((t) => t.origin === AFTER_DEATH_ORIGIN && (t.state === "open" || t.state === "parked"));
  if (!tasks.length) return [];
  const still = new Set(afterDeath(tree).map((a) => a.event.id));
  const marked = new Set(afterDeath(tree, true).map((a) => a.event.id));
  const out: string[] = [];
  for (const t of tasks) {
    const event = t.where[0];
    if (!event || still.has(event)) continue;
    const why = marked.has(event) ? "afterdeath.result.dismissed" : "afterdeath.result.gone";
    update<Task>(tree, t.id, "task", (x) => ({ ...x, state: "done", result: phrase(tree.lang, why, { event }) }), { op: "task.done", summary: `${t.id} done: ${marked.has(event) ? `the person marked ${event} no error` : `${event} is no longer after the death`}` });
    out.push(t.id);
  }
  return out;
}
