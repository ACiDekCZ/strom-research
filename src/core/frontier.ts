// The frontier of a research: the people in scope whose parents are not yet
// proven. For searching ancestors the next step is derivable, so strom
// proposes the tasks itself instead of hoping an agent remembers to.

import { dateYears } from "./gdate.ts";
import type { Person, Place, RecordSet, Research, Task } from "./model.ts";
import { ancestorGenerations, birthEvent, displayName, familiesAsChild, familiesAsPartner, isBirthFamily, lifespan } from "./people.ts";
import { foldText } from "./text.ts";
import { phrase } from "./phrases.ts";
import type { Tree } from "./tree.ts";

export interface FrontierItem {
  person: Person;
  generation: number;
  reason: string;
  /** Proposed task, or undefined when there is not enough to go on. */
  proposal?: Omit<Task, "id" | "type" | "created" | "updated" | "notes" | "state" | "origin">;
  /** An open task already covers it. */
  coveredBy?: string;
  /** Everything strom can propose was tried (these tasks): the user decides what next. */
  exhausted?: string[];
}

const OPEN_STATES = new Set(["open", "doing", "parked", "waiting"]);
const FINISHED_STATES = new Set(["done", "dropped"]);
const FRONTIER_LEVELS = new Set(["locate", "link", "request"]);

function birthRecordProven(p: Person): boolean {
  return p.events.some((e) => ["BIRT", "CHR", "BAPM"].includes(e.kind) && (e.status === "proven" || e.status === "probable") && !e.retracted);
}

/** The kinds of record set in which an event of this kind is written down. */
export const RECORD_KINDS: Record<string, string[]> = {
  BIRT: ["baptism", "birth"],
  CHR: ["baptism", "birth"],
  BAPM: ["baptism", "birth"],
  MARR: ["marriage"],
  MARB: ["marriage"],
  ENGA: ["marriage"],
  DEAT: ["burial", "death"],
  BURI: ["burial", "death"],
};
const GENERAL_KINDS = ["church", "civil"];

/** Is `name` the place `place` names? "Vavřinec čp. 13" and "Vavřinec, Blansko" are in Vavřinec. */
function inPlace(place: string, name: string): boolean {
  const n = foldText(name);
  return !!n && (place === n || place.startsWith(n + " ") || place.startsWith(n + ","));
}

/** Record sets that could hold an event of these kinds at `place` around `year`. */
export function recordsetsCovering(tree: Tree, place: string | undefined, year: number | undefined, kinds: string[]): RecordSet[] {
  if (!place) return [];
  const key = foldText(place);
  // Names of the place and of the parishes it belonged to.
  const names = [key];
  for (const pl of tree.list<Place>("place"))
    if (pl.names.some((n) => inPlace(key, n.name)))
      for (const j of pl.jurisdictions) if (!year || ((!j.from || j.from <= year) && (!j.to || j.to >= year))) names.push(foldText(j.name));
  return tree.list<RecordSet>("recordset").filter((b) => {
    if (b.kinds.length && !b.kinds.some((k) => kinds.includes(k) || GENERAL_KINDS.includes(k))) return false;
    if (!b.places.some((pl) => names.some((n) => inPlace(n, pl)))) return false;
    if (!year || !b.years) return true;
    const [from, to] = b.years.split("-").map(Number);
    return year >= from! - 2 && year <= (to ?? from!) + 2;
  });
}

/** Record sets that could hold the birth/baptism of someone born at `place` around `year`. */
function candidateRecordsets(tree: Tree, place: string | undefined, year: number | undefined): RecordSet[] {
  return recordsetsCovering(tree, place, year, RECORD_KINDS.BIRT!);
}

/**
 * The record sets a task works in: those in its `where`. A task written before
 * the books were known names none; then the ones its text mentions (B…), else
 * the ones covering an event of its people in a year the task mentions
 * ("Baptism of František 18 Oct 1862" → the baptisms of his birthplace in 1862).
 */
export function taskRecordsets(tree: Tree, task: Task): { sets: RecordSet[]; guessed: boolean } {
  const get = (id: string) => {
    const b = tree.get<RecordSet>(id);
    return b?.type === "recordset" ? b : undefined;
  };
  const named = task.where.map(get).filter((b): b is RecordSet => !!b);
  if (named.length) return { sets: named, guessed: false };
  const text = [task.what, ...task.where, task.why, task.doneWhen, ...task.notes.map((n) => n.text)].join(" ");
  const mentioned = [...new Set(text.match(/\bB\d{4,}\b/g) ?? [])].map(get).filter((b): b is RecordSet => !!b);
  if (mentioned.length) return { sets: mentioned, guessed: true };
  const years = dateYears(text);
  const found = new Map<string, RecordSet>();
  for (const id of task.subject) {
    const p = tree.get<Person>(id);
    if (p?.type !== "person") continue;
    for (const e of [...p.events, ...familiesAsPartner(tree, id).flatMap((f) => f.events)]) {
      const kinds = RECORD_KINDS[e.kind];
      if (!kinds || e.retracted || !e.date) continue;
      const span = dateYears(e.date);
      if (!span.length) continue;
      const lo = Math.min(...span);
      const hi = Math.max(...span);
      const year = years.find((y) => y >= lo && y <= hi);
      if (year === undefined) continue;
      for (const b of recordsetsCovering(tree, e.place, year, kinds)) found.set(b.id, b);
    }
  }
  return { sets: [...found.values()], guessed: true };
}

/**
 * When and where a person was born, if only roughly: their own birth, else about
 * 25 years before their marriage, else about 28 before their eldest known child —
 * where that happened. An estimate widens the years a search has to cover.
 */
function birthEstimate(tree: Tree, p: Person, lang: string): { year?: number; place?: string; from?: string } {
  const own = birthEvent(p);
  const ownYear = own?.date ? dateYears(own.date)[0] : undefined;
  if (ownYear && own?.place) return { year: ownYear, place: own.place };
  const fams = familiesAsPartner(tree, p.id);
  const marr = fams.flatMap((f) => f.events).find((e) => e.kind === "MARR" && !e.retracted && e.date);
  const marrYear = marr?.date ? dateYears(marr.date)[0] : undefined;
  const kids = fams
    .flatMap((f) => f.children.map((c) => tree.get<Person>(c.person)))
    .map((k) => ({ k, b: k ? birthEvent(k) : undefined }))
    .map(({ k, b }) => ({ k, b, year: b?.date ? dateYears(b.date)[0] : undefined }))
    .filter((x) => x.year)
    .sort((a, z) => a.year! - z.year!);
  const eldest = kids[0];
  const year = ownYear ?? (marrYear ? marrYear - 25 : eldest ? eldest.year! - 28 : undefined);
  const place = own?.place ?? marr?.place ?? eldest?.b?.place;
  const from = ownYear ? undefined : marrYear ? phrase(lang, "estimate.marriage", { year: marrYear }) : eldest ? phrase(lang, "estimate.child", { year: eldest.year! }) : undefined;
  return { ...(year ? { year } : {}), ...(place ? { place } : {}), ...(from ? { from } : {}) };
}

/**
 * The people a research is about, each with their generation from its focus:
 * the ancestors of an ancestors research; the person (with their family, or
 * their line) of a person research. Other kinds propose nothing by themselves.
 */
export function researchPeople(tree: Tree, research: Research): Map<string, number> {
  if (research.direction === "ancestors") return ancestorGenerations(tree, research.focus, research.limits?.generations ?? 50);
  if (research.direction !== "person") return new Map();
  const scope = research.review?.scope ?? "person";
  if (scope === "line") return ancestorGenerations(tree, research.focus, research.limits?.generations ?? 50);
  // generation 1 as in a line of ancestors; the children of a family are generation 0
  const out = new Map<string, number>([[research.focus, 1]]);
  if (scope === "family")
    for (const f of familiesAsPartner(tree, research.focus)) {
      for (const partner of f.partners) if (!out.has(partner)) out.set(partner, 1);
      for (const c of f.children) if (!out.has(c.person)) out.set(c.person, 0);
    }
  return out;
}

export function frontier(tree: Tree, research: Research): FrontierItem[] {
  // their parents are what the frontier looks for: the children of a family have theirs
  const gens = [...researchPeople(tree, research)].filter(([, g]) => g >= 1);
  const all = tree.list<Task>("task");
  const tasks = all.filter((t) => FRONTIER_LEVELS.has(t.level));
  const lang = tree.lang;
  const out: FrontierItem[] = [];
  for (const [id, generation] of gens) {
    const p = tree.get<Person>(id);
    if (!p || p.retracted) continue;
    const est = birthEstimate(tree, p, lang);
    const year = est.year;
    if (research.limits?.generations && generation >= research.limits.generations) continue;
    if (research.limits?.before && year && year < research.limits.before) continue;
    const birthFamilies = familiesAsChild(tree, id).filter((f) => isBirthFamily(f, id));
    const hasBirthFamily = birthFamilies.some((f) => f.partners.length === 2);
    const proven = birthRecordProven(p);
    if (hasBirthFamily && proven) continue;
    // The birth record is read and names one parent (a child born out of wedlock):
    // another search for the same baptism will not name the other.
    if (proven && birthFamilies.some((f) => f.partners.length === 1)) continue;
    const mine = tasks.filter((t) => t.subject.includes(id));
    // Covered also by other work in the books of the baptism: a task that records or checks it there.
    const births = candidateRecordsets(tree, est.place, year).map((b) => b.id);
    const covered =
      mine.find((t) => OPEN_STATES.has(t.state)) ??
      all.find((t) => (t.level === "enrich" || t.level === "verify") && OPEN_STATES.has(t.state) && t.subject.includes(id) && t.where.some((w) => births.includes(w)));
    const finished = mine.filter((t) => FINISHED_STATES.has(t.state));
    const name = `${displayName(p)}${lifespan(p) ? ` (${lifespan(p)})` : ""}`;
    const item: FrontierItem = {
      person: p,
      generation,
      reason: !hasBirthFamily ? "parents unknown" : "parents not proven by a record",
      ...(covered ? { coveredBy: covered.id } : {}),
    };
    if (!covered) {
      // What was already tried is never proposed again: a finished link task
      // used up its record sets, a finished locate task its search for them.
      const tried = new Set(finished.filter((t) => t.level === "link").flatMap((t) => t.where));
      const place = est.place;
      // an estimate needs a wider search than a known year
      const span = est.from ? 10 : 3;
      const about = est.from && year ? phrase(lang, "born.about", { year, from: est.from }) : "";
      const reason = phrase(lang, hasBirthFamily ? "reason.unproven" : "reason.unknown");
      const sets = candidateRecordsets(tree, place, year).filter((b) => !tried.has(b.id));
      const located = finished.some((t) => t.level === "locate");
      const requested = finished.some((t) => t.level === "request");
      if (sets.length)
        item.proposal = {
          level: "link",
          priority: 3, // the queue puts nearer generations first
          what: phrase(lang, "link.what", { name, place: place ? phrase(lang, "link.place", { place }) : "", about }),
          where: sets.map((b) => b.id),
          why: phrase(lang, "link.why", { reason, generation, research: research.name }),
          doneWhen: phrase(lang, "link.done", { years: year ? `${year - span}–${year + span}` : phrase(lang, "whole.book") }),
          subject: [id],
          research: research.id,
        };
      else if ((place || year) && !located)
        item.proposal = {
          level: "locate",
          priority: 3, // the queue puts nearer generations first
          what: phrase(lang, "locate.what", { place: place ?? phrase(lang, "the.birthplace"), around: year ? phrase(lang, "locate.around", { year }) : "", name, about }),
          where: [
            (place ? phrase(lang, "locate.where", { place }) : phrase(lang, "locate.where.unknown")) +
              (year ? phrase(lang, "locate.years", { from: year - span - 2, to: year + span + 2 }) : ""),
          ],
          why: phrase(lang, "locate.why", { reason }),
          doneWhen: phrase(lang, "locate.done"),
          subject: [id],
          research: research.id,
        };
      else if (finished.length && !requested)
        item.proposal = {
          level: "request",
          priority: 2,
          what: phrase(lang, "request.what", { name, tasks: finished.map((t) => t.id).join(", ") }),
          where: [phrase(lang, "request.where", { place: place ?? phrase(lang, "the.birthplace") })],
          why: phrase(lang, "request.why", { reason }),
          doneWhen: phrase(lang, "request.done"),
          subject: [id],
          research: research.id,
        };
      else if (finished.length) item.exhausted = finished.map((t) => t.id);
    }
    out.push(item);
  }
  return out.sort((a, b) => a.generation - b.generation);
}
