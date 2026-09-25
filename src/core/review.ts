// A review of a person (strom review): the research goes straight to one
// person, and strom works out what is worth doing about them — what the tree
// already says of them outside their data, entries whose images are there but
// were not read whole, facts that rest on a single reading, a second reading
// by the model the user now reads with, conflicts left open. Birth, parents
// and the story come from the frontier and the stories, as in any research.
// Each kind is at most one task per person at a time, and what a task of that
// kind took up is never proposed again.

import type { Conflict, Event, Family, Hypothesis, Lesson, Person, RecordSet, Research, Search, Session, Source, Task } from "./model.ts";
import { dateYears } from "./gdate.ts";
import { RECORD_KINDS, recordsetsCovering, researchPeople } from "./frontier.ts";
import { birthEvent, displayName, familiesAsPartner, lifespan } from "./people.ts";
import { phrase, type PhraseKey } from "./phrases.ts";
import { foldText } from "./text.ts";
import type { Tree } from "./tree.ts";

export type ReviewProposal = Omit<Task, "id" | "type" | "created" | "updated" | "notes" | "state">;

export const REVIEW_KINDS = ["mentions", "entries", "verify", "reread", "conflicts", "marriage", "death"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

/** At most so many records, entries or facts in one task: a session's worth. */
export const REVIEW_BATCH = 8;

const OPEN = new Set(["open", "doing", "parked", "waiting"]);
const BIRTHS_AND_MARRIAGES = new Set(["BIRT", "CHR", "BAPM", "MARR"]);

export const reviewOrigin = (kind: ReviewKind) => `review:${kind}`;

/** The words of a text, folded: any script, any accent. */
function words(text: string): string[] {
  return foldText(text).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

/** Does the text name the person: a given name next to the surname, in either order? */
function names(p: Person): string[][] {
  const out: string[][] = [];
  for (const n of p.names) {
    const given = words(n.given)[0];
    const surname = words(n.surname);
    if (!given || !surname.length) continue;
    out.push([given, ...surname], [...surname, given]);
  }
  return out;
}

function mentions(text: string | undefined, phrases: string[][]): boolean {
  if (!text) return false;
  const w = words(text);
  return phrases.some((ph) => w.some((_, i) => ph.every((x, j) => w[i + j] === x)));
}

/** The facts that are a person's: their own and those of their marriages. */
function factsOf(tree: Tree, p: Person): { event: Event; family?: Family }[] {
  return [...p.events.map((event) => ({ event })), ...familiesAsPartner(tree, p.id).flatMap((family) => family.events.map((event) => ({ event, family })))].filter((x) => !x.event.retracted);
}

/** Every source the person's data already rests on: their facts, names, families, and the facts they took part in. */
function citedFor(tree: Tree, p: Person): Set<string> {
  const out = new Set<string>();
  for (const { event, family } of factsOf(tree, p)) {
    for (const c of event.citations) out.add(c.source);
    for (const c of family?.citations ?? []) out.add(c.source);
  }
  for (const n of p.names) for (const c of n.citations ?? []) out.add(c.source);
  for (const other of tree.list<Person>("person"))
    for (const e of other.events) if (e.participants?.some((x) => x.person === p.id)) for (const c of e.citations) out.add(c.source);
  for (const f of tree.list<Family>("family"))
    for (const e of f.events) if (e.participants?.some((x) => x.person === p.id)) for (const c of e.citations) out.add(c.source);
  return out;
}

/** The models that read each source: the sessions that recorded or corrected it (the user's hand counts as "user"). */
export function readersOf(tree: Tree): Map<string, Set<string>> {
  const model = new Map(tree.list<Session>("session").map((s) => [s.id, s.model ?? "unknown"]));
  const out = new Map<string, Set<string>>();
  for (const op of tree.readOps()) {
    if (op.op !== "source.add" && op.op !== "source.edit") continue;
    const who = op.by === "user" ? "user" : (model.get(op.by) ?? "unknown");
    for (const id of op.targets) if (id.startsWith("S")) (out.get(id) ?? out.set(id, new Set()).get(id)!).add(who);
  }
  return out;
}

/**
 * A second reading by `model` is worth it: every reading of the source was by
 * another model, none by the user. A reading by a model nobody recorded counts
 * only when asked (`unknown`): the sessions before strom kept the model.
 */
export function readByOthers(readers: Set<string> | undefined, model: string, unknown = true): boolean {
  if (!readers?.size || readers.has("user")) return false;
  if (!unknown && readers.has("unknown")) return false;
  return ![...readers].some((m) => m !== "unknown" && sameModel(m, model));
}

/** "claude-opus-5-5" is the model "opus" named: an alias and a full name are the same model when one holds the other. */
export function sameModel(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || x.includes(y) || y.includes(x);
}

/** What the tree says of the person outside their data: sources not cited for them, notes, the diary, searches, lessons. */
function mentionsOf(tree: Tree, p: Person, cited: Set<string>): string[] {
  const phrases = names(p);
  if (!phrases.length) return [];
  const noted = (notes: { text: string }[] | undefined) => (notes ?? []).some((n) => mentions(n.text, phrases));
  const hits: string[] = [];
  for (const s of tree.list<Source>("source"))
    if (!s.retracted && !cited.has(s.id) && (mentions(s.transcript, phrases) || mentions(s.translation, phrases) || mentions(s.title, phrases) || noted(s.notes))) hits.push(s.id);
  for (const o of tree.list<Person>("person")) if (o.id !== p.id && !o.retracted && noted(o.notes)) hits.push(o.id);
  for (const f of tree.list<Family>("family")) if (!f.retracted && !f.partners.includes(p.id) && noted(f.notes)) hits.push(f.id);
  // work on the person themselves is recorded where it belongs; a find made while looking for someone else often is not
  const ownTasks = new Set(tree.list<Task>("task").filter((t) => t.subject.includes(p.id)).map((t) => t.id));
  const elsewhere = (task: string | undefined) => !task || !ownTasks.has(task);
  for (const s of tree.list<Search>("search"))
    if (!s.retracted && elsewhere(s.task) && (s.findings.some((x) => mentions(x, phrases)) || noted(s.notes))) hits.push(s.id);
  for (const s of tree.list<Session>("session")) if (elsewhere(s.task) && (noted(s.notes) || mentions(s.summary, phrases))) hits.push(s.id);
  for (const l of tree.list<Lesson>("lesson")) if (!l.retracted && (mentions(l.rule, phrases) || mentions(l.detail, phrases))) hits.push(l.id);
  return hits;
}

/** Entries of the person's facts whose images are there but were not read whole: no transcript, or a baptism or marriage without its godparents or witnesses. */
function entriesOf(tree: Tree, p: Person): string[] {
  const out = new Set<string>();
  for (const { event } of factsOf(tree, p))
    for (const c of event.citations) {
      const s = tree.get<Source>(c.source);
      if (!s || s.type !== "source" || s.retracted || !s.media?.length) continue;
      if (!s.transcript?.trim() || (BIRTHS_AND_MARRIAGES.has(event.kind) && !event.participants?.length)) out.add(s.id);
    }
  return [...out];
}

/** Facts that rest on one reading of an image: probable, from a record strom has the image of. */
function singleReadings(tree: Tree, p: Person): string[] {
  return factsOf(tree, p)
    .filter(({ event }) => event.status === "probable" && event.citations.some((c) => tree.get<Source>(c.source)?.media?.length))
    .map(({ event }) => event.id);
}

/** Facts from records whose every reading was by another model than `model`. */
function rereads(tree: Tree, p: Person, model: string, readers: Map<string, Set<string>>): string[] {
  return factsOf(tree, p)
    .filter(({ event }) => {
      if (event.status !== "proven" && event.status !== "probable") return false;
      const read = event.citations.filter((c) => tree.get<Source>(c.source)?.media?.length);
      return read.length > 0 && read.every((c) => readByOthers(readers.get(c.source), model));
    })
    .map(({ event }) => event.id);
}

function openConflicts(tree: Tree, p: Person): string[] {
  const families = new Set(familiesAsPartner(tree, p.id).map((f) => f.id));
  const about = (subject: string[]) => subject.includes(p.id) || subject.some((s) => families.has(s));
  return [
    ...tree.list<Conflict>("conflict").filter((c) => c.state === "open" && about(c.subject)),
    ...tree.list<Hypothesis>("hypothesis").filter((h) => h.state === "open" && about(h.subject)),
  ].map((x) => x.id);
}

/** The tasks strom proposes for the people of a person research (strom review). */
export function reviewProposals(tree: Tree, research: Research): ReviewProposal[] {
  if (research.direction !== "person") return [];
  const lang = tree.lang;
  const tasks = tree.list<Task>("task").filter((t) => t.origin.startsWith("review:"));
  const reread = research.review?.reread;
  const readers = reread ? readersOf(tree) : undefined;
  const out: ReviewProposal[] = [];
  for (const [id] of researchPeople(tree, research)) {
    const p = tree.get<Person>(id);
    if (!p || p.type !== "person" || p.retracted) continue;
    const name = `${displayName(p)}${lifespan(p) ? ` (${lifespan(p)})` : ""}`;
    const propose = (kind: ReviewKind, level: Task["level"], found: string[], values: Record<string, string | number> = {}) => {
      const kindOf = tasks.filter((t) => t.origin === reviewOrigin(kind));
      // one at a time; what a task of this kind took up — for anyone: a marriage is the couple's — is not proposed again
      if (kindOf.some((t) => t.subject.includes(id) && OPEN.has(t.state))) return;
      const taken = new Set([...kindOf.flatMap((t) => t.where), ...out.filter((o) => o.origin === reviewOrigin(kind)).flatMap((o) => o.where)]);
      const fresh = found.filter((x) => !taken.has(x));
      if (!fresh.length) return;
      const batch = fresh.slice(0, REVIEW_BATCH);
      const more = fresh.length - batch.length;
      const v = { name, id, list: batch.join(", "), count: batch.length, more: more ? phrase(lang, "review.more", { count: more }) : "", research: research.name, ...values };
      out.push({
        level,
        priority: 3,
        what: phrase(lang, `review.${kind}.what` as PhraseKey, v),
        where: batch,
        why: phrase(lang, `review.${kind}.why` as PhraseKey, v),
        doneWhen: phrase(lang, `review.${kind}.done` as PhraseKey, v),
        subject: [id],
        research: research.id,
        origin: reviewOrigin(kind),
      });
    };
    propose("mentions", "enrich", mentionsOf(tree, p, citedFor(tree, p)));
    propose("entries", "enrich", entriesOf(tree, p));
    const single = singleReadings(tree, p);
    propose("verify", "verify", single);
    if (reread && readers) propose("reread", "verify", rereads(tree, p, reread, readers).filter((e) => !single.includes(e)), { model: reread });
    propose("conflicts", "verify", openConflicts(tree, p));
    out.push(...gaps(tree, research, p, name, tasks));
  }
  return out;
}

/** Someone born this many years ago or earlier has died: a death is looked for. */
export const DEATH_AFTER_YEARS = 100;

const MARRIAGES = new Set(["MARR", "MARB"]);
const DEATHS = new Set(["DEAT", "BURI"]);

const childBirth = (tree: Tree, id: string) => {
  const c = tree.get<Person>(id);
  return c?.type === "person" ? birthEvent(c) : undefined;
};

const firstYear = (e: Event | undefined) => (e?.date ? dateYears(e.date)[0] : undefined);

/**
 * The marriage of a couple with children and none recorded, and the death of
 * someone born long enough ago: where the books are known, search them (link);
 * where not, find them first (locate). A book searched for it is not proposed
 * again, nor a locate done; after both, the user decides.
 */
function gaps(tree: Tree, research: Research, p: Person, name: string, tasks: Task[]): ReviewProposal[] {
  const lang = tree.lang;
  const out: ReviewProposal[] = [];
  const gap = (kind: "marriage" | "death", about: string, place: string | undefined, books: RecordSet[], values: Record<string, string | number>) => {
    const mine = tasks.filter((t) => t.origin === reviewOrigin(kind) && t.subject.includes(about));
    if (mine.some((t) => OPEN.has(t.state))) return;
    const tried = new Set(mine.filter((t) => t.level === "link").flatMap((t) => t.where));
    const fresh = books.filter((b) => !tried.has(b.id));
    const v = { name, research: research.name, place: place ?? "", at: place ? phrase(lang, "link.place", { place }) : "", ...values };
    const base = { priority: 3, subject: [p.id, ...(about !== p.id ? [about] : [])], research: research.id, origin: reviewOrigin(kind) };
    if (fresh.length)
      out.push({ ...base, level: "link", what: phrase(lang, `review.${kind}.what`, v), where: fresh.map((b) => b.id), why: phrase(lang, `review.${kind}.why`, v), doneWhen: phrase(lang, `review.${kind}.done`, v) });
    else if (place && !mine.some((t) => t.level === "locate"))
      out.push({ ...base, level: "locate", what: phrase(lang, `review.${kind}.locate.what`, v), where: [phrase(lang, "locate.where", { place })], why: phrase(lang, "review.locate.why", v), doneWhen: phrase(lang, "locate.done") });
  };
  // a marriage: a couple with children, no marriage recorded — before the eldest child, where it was born
  for (const f of familiesAsPartner(tree, p.id)) {
    if (f.retracted || f.partners.length < 2 || f.events.some((e) => MARRIAGES.has(e.kind) && !e.retracted)) continue;
    // the couple's marriage once: whoever of them is reviewed first
    if (out.some((o) => o.subject.includes(f.id)) || tasks.some((t) => t.origin === reviewOrigin("marriage") && t.subject.includes(f.id) && !t.subject.includes(p.id))) continue;
    const kids = f.children
      .map((c) => childBirth(tree, c.person))
      .map((e) => ({ year: firstYear(e), place: e?.place }))
      .filter((k): k is { year: number; place: string | undefined } => k.year !== undefined)
      .sort((a, b) => a.year - b.year);
    const eldest = kids[0];
    if (!eldest) continue;
    const partner = tree.get<Person>(f.partners.find((x) => x !== p.id)!);
    const books = recordsetsCovering(tree, eldest.place, eldest.year - 3, RECORD_KINDS.MARR!);
    gap("marriage", f.id, eldest.place, books, { partner: partner ? displayName(partner) : "?", year: eldest.year, years: `${eldest.year - 8}–${eldest.year}` });
  }
  // a death: none recorded, born long ago — after the last record of them, where they lived then
  if (!p.events.some((e) => DEATHS.has(e.kind) && !e.retracted)) {
    const born = firstYear(birthEvent(p));
    const dated = [
      ...factsOf(tree, p).map(({ event }) => event),
      ...familiesAsPartner(tree, p.id).flatMap((f) => f.children.map((c) => childBirth(tree, c.person))),
    ]
      .filter((e): e is Event => !!e && !e.retracted && firstYear(e) !== undefined)
      .sort((a, b) => firstYear(b)! - firstYear(a)!);
    const last = dated[0];
    const lastYear = firstYear(last);
    const old = born ?? (lastYear !== undefined ? lastYear - 20 : undefined);
    if (last && lastYear !== undefined && old !== undefined && old <= new Date().getFullYear() - DEATH_AFTER_YEARS) {
      const place = dated.find((e) => e.place)?.place;
      // the books of the place from the last record on
      const books = recordsetsCovering(tree, place, undefined, RECORD_KINDS.DEAT!).filter((b) => {
        const to = b.years ? Number(b.years.split("-").pop()) : undefined;
        return to === undefined || to >= lastYear;
      });
      gap("death", p.id, place, books, { year: lastYear });
    }
  }
  return out;
}

/** How many facts of the tree rest only on readings by another model than `model` — for a hint, never a task by itself. */
export function readByOtherModels(tree: Tree, model: string): { facts: number; models: string[] } {
  const readers = readersOf(tree);
  const models = new Set<string>();
  let facts = 0;
  for (const p of tree.list<Person>("person")) {
    if (p.retracted) continue;
    for (const e of p.events) {
      if (e.retracted || (e.status !== "proven" && e.status !== "probable")) continue;
      const read = e.citations.filter((c) => tree.get<Source>(c.source)?.media?.length);
      if (!read.length || !read.every((c) => readByOthers(readers.get(c.source), model, false))) continue;
      facts++;
      for (const c of read) for (const m of readers.get(c.source) ?? []) models.add(m);
    }
  }
  return { facts, models: [...models] };
}

/** The line of a text that names the person, as the text has it — a long one cut round the name (≤ 200 characters). */
function lineNaming(text: string | undefined, phrases: string[][], surnames: string[] = []): string | undefined {
  const line = text?.split("\n").find((l) => mentions(l, phrases))?.trim();
  if (!line || line.length <= 200) return line;
  const lower = line.toLocaleLowerCase();
  const at = Math.max(0, ...surnames.map((x) => lower.indexOf(x.toLocaleLowerCase())).filter((i) => i >= 0).slice(0, 1));
  const from = Math.max(0, Math.min(at - 80, line.length - 198));
  return `${from ? "…" : ""}${line.slice(from, from + 198).trim()}…`;
}

/** What a review task is about, one line each, so the session needs no extra command: the line naming the person, a fact with its records and images. */
export function reviewItems(tree: Tree, task: Task): string[] {
  const p = task.subject.map((id) => tree.get<Person>(id)).find((x): x is Person => x?.type === "person");
  const phrases = p ? names(p) : [];
  const surnames = p ? p.names.map((n) => n.surname).filter(Boolean) : [];
  const said = (text: string | undefined) => lineNaming(text, phrases, surnames);
  const notesLine = (notes: { text: string }[] | undefined) => (notes ?? []).map((n) => said(n.text)).find(Boolean);
  return task.where.map((id) => {
    const r = tree.get(id) as (Source | Person | Family | Search | Session | Lesson | Conflict | Hypothesis | undefined);
    if (/^E\d+$/.test(id)) {
      const hit = [...tree.list<Person>("person"), ...tree.list<Family>("family")].flatMap((o) => o.events).find((e) => e.id === id);
      if (!hit) return `  ${id} (no longer there)`;
      const records = hit.citations.map((c) => {
        const s = tree.get<Source>(c.source);
        return `${c.source}${s?.media?.length ? ` (${s.media.join(" ")})` : ""}`;
      });
      return `  ${id} ${hit.kind}${hit.date ? ` ${hit.date}` : ""}${hit.place ? `, ${hit.place}` : ""}${hit.value ? ` "${hit.value}"` : ""} [${hit.status}] — ${records.join(", ") || "no record"}`;
    }
    if (!r) return `  ${id} (no longer there)`;
    switch (r.type) {
      case "source": {
        const line = said(r.transcript) ?? said(r.translation) ?? notesLine(r.notes);
        return `  ${r.id} ${r.title}${r.locator ? ` · ${r.locator}` : ""}${r.media?.length ? ` · images ${r.media.join(" ")}` : " · no image"}${r.transcript ? "" : " · no transcript"}${line ? `\n      “${line}”` : ""}`;
      }
      case "person":
        return `  ${r.id} ${displayName(r)}, a note: “${notesLine(r.notes) ?? ""}”`;
      case "family":
        return `  ${r.id} family ${r.partners.join(" & ")}, a note: “${notesLine(r.notes) ?? ""}”`;
      case "search":
        return `  ${r.id} search "${r.question}": “${r.findings.map((f) => said(f)).find(Boolean) ?? notesLine(r.notes) ?? ""}”`;
      case "session":
        return `  ${r.id} session diary${r.task ? ` (${r.task})` : ""}: “${notesLine(r.notes) ?? said(r.summary) ?? ""}”`;
      case "lesson":
        return `  ${r.id} lesson: “${said(r.rule) ?? said(r.detail) ?? r.rule}”`;
      case "conflict":
        return `  ${r.id} conflict: ${r.title}`;
      case "hypothesis":
        return `  ${r.id} hypothesis: ${r.question}`;
      default:
        return `  ${id}`;
    }
  });
}
