// The brief: everything an agent needs for one task, and nothing more.
//
// In the old workflow the agent read the whole protocol at the start of a
// session and its context was summarised within minutes (median ~11 min).
// The brief has a hard token budget; sections come in priority order and
// what does not fit is cut to a pointer: the command that shows the rest.

import type { Citation, Conflict, Family, Hypothesis, HypothesisVariant, Input, Lesson, Media, Name, Person, Place, RecordSet, Repository, Research, Search, Session, Task } from "../core/model.ts";
import fs from "node:fs";
import path from "node:path";
import { inboxFolders, inputPath } from "../core/media.ts";
import { displayName, familiesAsChild, familiesAsPartner, formatName, label, lifespan, likelyDuplicates, parentsOf, primaryName, sameFamilyName, surnameForms } from "../core/people.ts";
import { parseYears } from "../core/years.ts";
import { langName } from "../core/lang.ts";
import { dateYears } from "../core/gdate.ts";
import { methodFor, METHOD_LINKS } from "../core/assets.ts";
import { recentSessions } from "../core/session.ts";
import { briefClock } from "../core/clock.ts";
import { calibrationLine } from "../core/calibration.ts";
import { taskRecordsets } from "../core/frontier.ts";
import { reviewItems } from "../core/review.ts";
import { listConnectors, missingConsents, readyConnectors, routeOf, type Connector } from "../core/connector.ts";
import { hostAllowed } from "../core/net.ts";
import { runs, shellArg } from "../cli/format.ts";
import { commandSheet } from "./sheet.ts";
import { foldText } from "../core/text.ts";
import { subjectPeople } from "../core/records.ts";
import { searchedAs } from "../core/evidence.ts";
import { hypothesisPeople } from "../core/directions.ts";
import type { Tree } from "../core/tree.ts";
import { imagesIndex, weakScans } from "../core/mediaindex.ts";
import { SHARPER_SCAN } from "../core/views.ts";
import { HYPOTHESIS_LINKS_ORIGIN, recordedLinks, recordedText } from "../core/hypolinks.ts";

export { DEFAULT_BUDGET } from "../core/config.ts";
import { DEFAULT_BUDGET } from "../core/config.ts";

/**
 * Estimated tokens, on the safe side. A word of plain ASCII (English, IDs, numbers) takes about 2.5 characters a
 * token; a word with any other letter — a diacritic, another script — about one, the whole word (measured on the
 * briefs and outputs of real sessions: a Czech research's brief is 1.7–1.8 characters a token, not 3.5).
 */
export function tokens(text: string): number {
  return Math.ceil(rawTokens(text));
}

/** The estimate not rounded: adds up exactly over a text split at whitespace. */
function rawTokens(text: string): number {
  let other = 0;
  for (const m of text.matchAll(/\S+/gu)) if (/[^\x00-\x7F]/u.test(m[0])) other += m[0].length;
  return (text.length - other) / 2.5 + other;
}

export interface Section {
  name: string;
  text: string;
  /** Shown instead when the section does not fit. */
  pointer: string;
  required?: boolean;
  /** Given its room right after the required ones (still cut when even that does not fit). */
  first?: boolean;
  /** Given its room after all the others (in parts: its short after theirs). */
  last?: boolean;
  /**
   * A section in parts that may be given in short: its heading, its tail and each part in short get their room with
   * the other sections; each part is given whole after them all, in the order of `UPGRADES`, while it fits. `text` is
   * the whole of it.
   */
  layers?: Layers;
}

/** A part of a section: in short (empty: left out) before the lesser parts of the others, whole when there is room. */
export interface Part {
  short: string;
  whole: string;
}

export interface Layers {
  head: string[];
  parts: Part[];
  tail: string[];
  /** Where the parts given in short or left out are, said where they stand. */
  more: string;
}

/** A section given in parts: the whole text, and the parts that may stand in short. */
function layered(name: string, pointer: string, layers: Layers): Section {
  return { name, pointer, layers, text: [...layers.head, ...layers.parts.map((p) => p.whole).filter(Boolean), ...layers.tail].join("\n") };
}

/** The sections whose parts are given whole once all the others have their room, in this order. */
const UPGRADES = ["premise", "open questions", "people"];

export interface Brief {
  text: string;
  sections: { name: string; tokens: number; cut: boolean }[];
  total: number;
  budget: number;
}

function eventLine(e: Person["events"][number]): string {
  const cites = citesOf(e.citations);
  return `    ${e.id} ${e.kind}${e.label ? ` ${e.label}` : ""}${e.date ? ` ${e.date}` : ""}${e.place ? ` ${e.place}` : ""}${e.house ? `, house ${e.house}` : ""}${e.value ? ` "${e.value}"` : ""} [${e.status}]${cites ? ` ← ${cites}` : ""}`;
}

function citesOf(citations: Citation[] | undefined): string {
  return (citations ?? []).map((c) => `${c.source}${c.locator ? ` ${c.locator}` : ""}`).join(", ");
}

/** The notes of a person in short: the start of the last one, the others counted — what tells namesakes apart. */
function notesShort(p: Person): string[] {
  const last = p.notes.at(-1);
  if (!last) return [];
  return [`    note: ${noteStart(last.text, NOTE_LINE)}${p.notes.length > 1 ? ` (${p.notes.length} notes: strom person show ${p.id})` : [...last.text.replace(/\s+/gu, " ").trim()].length > NOTE_LINE ? ` (strom person show ${p.id})` : ""}`];
}

/** Whom the task is about: every fact with its sources, other names, parents, families, the story — and the last notes (in short: the start of the last one). */
function personBlock(tree: Tree, p: Person, depth: number, short = false): string[] {
  const out = [`  ${label(p)} ${p.sex}`];
  // other names, and where any name comes from
  if (p.names.length > 1 || p.names.some((n) => n.citations?.length))
    out.push(`    names: ${p.names.map((n) => `${formatName(n)}${n.kind ? ` (${n.kind})` : ""}${n.citations?.length ? ` ← ${citesOf(n.citations)}` : ""}`).join("; ")}`);
  for (const e of p.events.filter((x) => !x.retracted)) out.push(eventLine(e));
  const parents = parentsOf(tree, p.id);
  const birthFamily = familiesAsChild(tree, p.id)[0];
  out.push(`    parents: ${parents.length ? parents.map(label).join(" & ") : "unknown"}${birthFamily?.citations?.length ? ` (${birthFamily.id} ← ${citesOf(birthFamily.citations)})` : ""}`);
  if (depth > 0)
    for (const f of familiesAsPartner(tree, p.id)) {
      const partner = f.partners.filter((x) => x !== p.id).map((x) => tree.get<Person>(x)).filter(Boolean).map((x) => label(x!));
      const kids = f.children.map((c) => tree.get<Person>(c.person)).filter(Boolean).map((x) => `${displayName(x!)}${lifespan(x!) ? ` ${lifespan(x!)}` : ""}`);
      out.push(`    ${f.id} with ${partner.join(", ") || "?"}${kids.length ? ` · children: ${kids.join(", ")}` : ""}`);
    }
  if (p.story) out.push(`    story: ${p.story.status}${p.story.title ? ` "${p.story.title}"` : ""}, ${p.story.text.split(/\s+/).length} words (strom story show ${p.id})`);
  if (short) return [...out, ...notesShort(p)];
  for (const n of p.notes.slice(-3)) out.push(`    note: ${n.text}`);
  if (p.notes.length > 3) out.push(`    (${p.notes.length - 3} older note${p.notes.length > 4 ? "s" : ""}: strom person show ${p.id})`);
  return out;
}

const VITAL_ORDER = ["BIRT", "CHR", "BAPM", "DEAT", "BURI", "CREM"];
const VITAL = new Set(VITAL_ORDER);
const NOTE_SHOWN = 300;

/** Where a person lived and what they did, the years with each: what tells namesakes apart. */
function identifying(p: Person, vitalToo: boolean): { houses: string[]; work: string[]; more: number } {
  const facts = p.events.filter((e) => !e.retracted && !VITAL.has(e.kind));
  const grouped = (list: [string, string | undefined][]) => {
    const by = new Map<string, Set<number>>();
    for (const [what, date] of list) {
      const years = by.get(what) ?? new Set<number>();
      for (const y of dateYears(date ?? "")) years.add(y);
      by.set(what, years);
    }
    // the years as a span: when, not every record of it
    return [...by].map(([what, years]) => {
      const y = [...years].sort((a, b) => a - b);
      return `${what}${y.length ? ` ${y.length > 1 ? `${y[0]}–${y.at(-1)}` : y[0]}` : ""}`;
    });
  };
  // where they lived: a house in a place, or the place of a residence
  const lived = (e: Person["events"][number]) => !!e.house || (e.kind === "RESI" && !!e.place);
  const houses = grouped((vitalToo ? p.events.filter((e) => !e.retracted) : facts).filter(lived).map((e) => [[e.place, e.house].filter(Boolean).join(" "), e.date]));
  const work = grouped(facts.filter((e) => e.kind === "OCCU" && e.value).map((e) => [e.value!, e.date]));
  const more = facts.filter((e) => !lived(e) && !(e.kind === "OCCU" && e.value)).length;
  return { houses, work, more };
}

/** The other forms of a person's name (a spelling, a woman's form, a married name): what the records may call them — an accent of its own is another form. */
function otherNames(p: Person): Name[] {
  const shown = new Set([displayName(p).normalize("NFC")]);
  return p.names.filter((n) => {
    const f = formatName(n).normalize("NFC");
    if (shown.has(f)) return false;
    shown.add(f);
    return true;
  });
}

const MONTH = /(?:^|\s)(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:\s|$)/u;

/** The vital facts that say more than the years of the label — the day, the place, the house: two namesakes told apart. */
function vitalShort(p: Person): string[] {
  const out: string[] = [];
  let before = "";
  // in the order of a life: birth, baptism, death, burial
  const rank = (k: string) => VITAL_ORDER.indexOf(k);
  for (const e of p.events.filter((x) => !x.retracted && VITAL.has(x.kind)).sort((a, b) => rank(a.kind) - rank(b.kind))) {
    const where = [e.place, e.house].filter(Boolean).join(" ");
    const day = !!e.date && MONTH.test(e.date);
    if (!day && !where) continue;
    // the place said once: a baptism where the birth was
    const place = where && !before.startsWith(where) ? where : "";
    const text = [e.kind, e.date, place].filter(Boolean).join(" ");
    if (!out.includes(text)) out.push(text);
    if (where) before = where;
  }
  return out;
}

/** The start of a note, cut where it is long. */
function noteStart(text: string, max: number): string {
  const chars = [...text.replace(/\s+/gu, " ").trim()];
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : chars.join("");
}

/** A parent of the task's person: the vital facts (sources by ID), the other forms of the name, where they lived and what they did, the parents, the last notes cut short. */
function relativeBlock(tree: Tree, p: Person, role: string, short = false): string[] {
  const out = [`  ${label(p)} ${p.sex} — ${role}`];
  const others = otherNames(p);
  if (others.length)
    out.push(`    names: ${[primaryName(p), ...others].map((n) => `${formatName(n)}${n.kind ? ` (${n.kind})` : ""}${n.citations?.length ? ` ← ${[...new Set(n.citations.map((c) => c.source))].join(", ")}` : ""}`).join("; ")}`);
  for (const e of p.events.filter((x) => !x.retracted && VITAL.has(x.kind)))
    out.push(`    ${e.id} ${e.kind}${e.date ? ` ${e.date}` : ""}${e.place ? ` ${e.place}` : ""}${e.house ? `, house ${e.house}` : ""} [${e.status}]${e.citations?.length ? ` ← ${[...new Set(e.citations.map((c) => c.source))].join(", ")}` : ""}`);
  const { houses, work, more } = identifying(p, false);
  if (houses.length || work.length || more)
    out.push(`    ${[houses.length ? `lived: ${houses.join("; ")}` : "", work.length ? `occupation: ${work.join("; ")}` : "", more ? `${more} more fact${more > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ")}`);
  const parents = parentsOf(tree, p.id);
  out.push(`    parents: ${parents.length ? parents.map(label).join(" & ") : "unknown"}`);
  if (short) return [...out, ...notesShort(p)];
  for (const n of p.notes.slice(-2)) out.push(`    note: ${[...n.text].length > NOTE_SHOWN ? `${[...n.text].slice(0, NOTE_SHOWN).join("")}…` : n.text}`);
  if (p.notes.length > 2) out.push(`    (${p.notes.length - 2} older note${p.notes.length > 3 ? "s" : ""}: strom person show ${p.id})`);
  return out;
}

const NOTE_LINE = 100;
/** An open question the task is not about, in short: its start. */
const QUESTION_SHORT = 120;

/** A variant saying what the tree records already, marked: no link to make (strom hypothesis link refuses it). */
function variantRecorded(tree: Tree, h: Hypothesis, v: HypothesisVariant): string {
  const recorded = recordedLinks(tree, h, v);
  return recorded.length ? ` [${recordedText(recorded)}]` : "";
}

/**
 * Anyone else concerned, in one line: who they are to the task's people, their birth, baptism and death with the day and
 * the place, the other forms of the name, where they lived, what they did, their parents, the start of the last note —
 * what tells two namesakes apart (K5).
 */
function relativeLine(tree: Tree, p: Person, role: string, withParents: boolean): string {
  const { houses, work } = identifying(p, false);
  const parents = withParents ? parentsOf(tree, p.id) : [];
  const others = otherNames(p);
  const note = p.notes.at(-1);
  return `  · ${label(p)} ${p.sex} — ${[
    role,
    ...vitalShort(p),
    others.length ? `also: ${others.map((n) => `${formatName(n)}${n.kind ? ` (${n.kind})` : ""}`).join("; ")}` : "",
    houses.length ? `lived: ${houses.join("; ")}` : "",
    work.length ? `occupation: ${work.join("; ")}` : "",
    parents.length ? `parents: ${parents.map((x) => x.id).join(" & ")}` : "",
    note ? `note: ${noteStart(note.text, NOTE_LINE)}` : "",
  ].filter(Boolean).join(" · ")}`;
}

/**
 * A person of a task that links hypotheses to the tree (it reads no records): who they are — what tells namesakes apart
 * (other names, the day and place of birth, baptism and death, where they lived, what they did, the start of the last
 * note) — and the families a link would join them by: the one they were born in, those they founded, with every ID.
 */
function identityBlock(tree: Tree, p: Person, role: string): string[] {
  const { houses, work } = identifying(p, false);
  const others = otherNames(p);
  const note = p.notes.at(-1);
  const facts = [
    ...vitalShort(p),
    others.length ? `also: ${others.map((n) => `${formatName(n)}${n.kind ? ` (${n.kind})` : ""}`).join("; ")}` : "",
    houses.length ? `lived: ${houses.join("; ")}` : "",
    work.length ? `occupation: ${work.join("; ")}` : "",
  ].filter(Boolean);
  const out = [`  ${label(p)} ${p.sex}${role ? ` — ${role}` : ""}`];
  if (facts.length) out.push(`    ${facts.join(" · ")}`);
  const parents = parentsOf(tree, p.id);
  const born = familiesAsChild(tree, p.id)[0];
  out.push(`    parents: ${parents.length ? parents.map(label).join(" & ") : "unknown"}${born ? ` (${born.id})` : ""}`);
  for (const f of familiesAsPartner(tree, p.id)) {
    const partner = f.partners.filter((x) => x !== p.id).map((x) => tree.get<Person>(x)).filter(Boolean).map((x) => label(x!));
    const kids = f.children.map((c) => tree.get<Person>(c.person)).filter(Boolean).map((x) => label(x!));
    out.push(`    ${f.id} with ${partner.join(", ") || "?"}${kids.length ? ` · children: ${kids.join(", ")}` : ""}`);
  }
  if (note) out.push(`    note: ${noteStart(note.text, NOTE_LINE)}`);
  return out;
}

/** A family the task is about: its partners, its own facts, the records that show it, its notes (in short: the start of the last one). */
function familyBlock(tree: Tree, f: Family, short = false): string[] {
  const partners = f.partners.map((x) => tree.get<Person>(x)).filter((x): x is Person => !!x).map(label);
  const out = [`  ${f.id} family of ${partners.join(" & ") || "?"}${f.union ? ` [${f.union}]` : ""}${f.children.length ? ` · ${f.children.length} child${f.children.length > 1 ? "ren" : ""}` : ""}`];
  for (const e of f.events.filter((x) => !x.retracted)) out.push(eventLine(e));
  if (f.citations?.length) out.push(`    sources: ${citesOf(f.citations)}`);
  for (const n of f.notes.slice(short ? -1 : -3)) out.push(`    note: ${noteStart(n.text, short ? NOTE_LINE : NOTE_SHOWN)}`);
  return out;
}

/** A small text file of an input, as strom input show gives it; unreadable: nothing. */
function readSmall(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return undefined;
  }
}

/** Words of a text, folded (any script; NFC or NFD alike). */
function foldedWords(text: string): string[] {
  return foldText(text.normalize("NFC")).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}

/** The part of a name its forms share ("Lhoty" → lhot, "Dvořák" → dvorak), long enough to mean it, else none. */
function stem(name: string): string | undefined {
  const s = foldText(name.normalize("NFC")).replace(/[aeiouyаеёиоуыэюяієї]+$/u, "");
  return [...s].length >= 4 ? s : undefined;
}

/** A word that may be a name: written with a capital, or in a script without capitals. */
const NAME_START = /^[\p{Lu}\p{Lt}\p{Lo}]/u;

/**
 * The names a text gives, folded: its words written with a capital (or in a script without capitals) — with
 * `inner`, not those that start a sentence ("Stará kniha…" names nothing).
 */
function textNames(text: string, inner = false): string[] {
  const out: string[] = [];
  const t = text.normalize("NFC");
  for (const m of t.matchAll(/[\p{L}\p{M}\p{N}]+/gu)) {
    if (!NAME_START.test(m[0])) continue;
    if (inner) {
      // what stands before it, past spaces, quotes and brackets: nothing or the end of a sentence
      const before = t.slice(Math.max(0, m.index - 12), m.index).replace(/[\s\p{Pi}\p{Pf}\p{Ps}"'„“”‚‘’«»]+$/u, "");
      if (!before || /[.!?:;\n]$/u.test(before)) continue;
    }
    out.push(foldText(m[0]));
  }
  return out;
}

/** Two folded names that may be one read otherwise: at most one letter apart (six letters and more), two (eight). */
function lookAlike(a: string, b: string): boolean {
  if (a === b) return true;
  const x = [...a];
  const y = [...b];
  const max = Math.min(x.length, y.length) >= 8 ? 2 : Math.min(x.length, y.length) >= 6 ? 1 : 0;
  if (!max || Math.abs(x.length - y.length) > max) return false;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    if (Math.min(...row) > max) return false;
    prev = row;
  }
  return prev[y.length]! <= max;
}

/** What the material of an intake task says, for the lessons it needs: its words, or unknown (an image, a document). */
interface MaterialText {
  texts: string[];
  /** Some of it strom cannot read: every lesson of the project goes with it. */
  unknown: boolean;
}

/** The largest file of the material read for its names alone (not shown). */
const MATERIAL_READ = 5_000_000;

function materialText(tree: Tree, inputs: Input[]): MaterialText {
  const texts: string[] = [];
  let unknown = false;
  for (const i of inputs) {
    texts.push(i.name, ...i.notes.map((n) => n.text));
    for (const id of i.persons ?? []) {
      const p = tree.get<Person>(id);
      if (p?.type === "person") texts.push(...p.names.map((n) => n.surname ?? ""));
    }
    if (i.text) {
      texts.push(i.text);
      continue;
    }
    const file = inputPath(tree, i);
    const readable = (i.kind === "text" || i.kind === "tree") && file && (i.size ?? 0) <= MATERIAL_READ;
    const text = readable ? readSmall(file) : undefined;
    if (text !== undefined) texts.push(text);
    else unknown = true;
  }
  return { texts, unknown };
}

/**
 * Which lessons of the whole project (no record set, archive or place of their own) go with a task: one naming a
 * family or a place of this tree goes with a task of that family or place (its text, its people, their facts, its
 * books, the material it takes in); one naming none of them is general and goes with every task. A name told in a
 * lesson's own words ("Dvořákovi", "u Lhoty") is known by its stem; one not recognised keeps the lesson in — never a
 * lesson lost. A lesson that names a family goes with a task besides when its rule or detail names — beyond the first
 * word of a sentence — a name the task's text gives, a look-alike of a task's person's surname (one or two letters
 * apart: a reading of the same name), or one of the task's books ("Lhota 03", B0001).
 */
function projectLessonFit(tree: Tree, task: Task | undefined, persons: Person[], where: string[], material?: MaterialText): (l: Lesson) => boolean {
  if (material?.unknown) return () => true;
  const known = new Set<string>();
  const add = (n: string | undefined) => {
    if (!n) return;
    const first = n.trim().split(/[\s,]+/u)[0] ?? "";
    for (const f of [first, ...surnameForms(first)]) {
      const s = stem(f);
      if (s) known.add(s);
    }
  };
  for (const p of tree.list<Person>("person")) if (!p.retracted) for (const n of p.names) add(n.surname);
  for (const pl of tree.list<Place>("place")) for (const n of pl.names) add(n.name);
  for (const b of tree.list<RecordSet>("recordset")) for (const n of b.places ?? []) add(n);
  // given names say no family: "Anna" in a task and in a lesson is no reason to join them
  const given = new Set(tree.list<Person>("person").flatMap((p) => p.names.flatMap((n) => foldedWords(n.given ?? ""))));
  const books = where.map((w) => tree.get<RecordSet>(w)).filter((b): b is RecordSet => !!b && b.type === "recordset");
  const taskTexts = task ? [task.what, task.why, task.doneWhen, ...task.where, ...task.notes.map((n) => n.text)] : [];
  const context = [...new Set(foldedWords([
    ...taskTexts,
    ...(material?.texts ?? []),
    ...books.flatMap((b) => [b.title, ...(b.places ?? [])]),
    ...persons.flatMap((p) => [...p.names.map((n) => `${n.given} ${n.surname}`), ...p.events.map((e) => e.place ?? "")]),
    ...persons.flatMap((p) => parentsOf(tree, p.id).flatMap((x) => x.names.map((n) => n.surname))),
  ].join(" ")))];
  const knownList = [...known];
  // the names the task gives in its own words, and the surnames of its people in their forms
  const names = new Set([...taskTexts, ...(material?.texts ?? [])].flatMap((t) => textNames(t, true)).filter((w) => [...w].length >= 4 && !given.has(w)));
  const surnames = [...new Set(persons.flatMap((p) => p.names.flatMap((n) => (n.surname ? [...surnameForms(n.surname)] : []))))];
  // a book as a lesson names it: the start of its title ("Lhota 03, N 1700–1750" → "lhota 03"), or its ID
  const bookNames = books.flatMap((b) => {
    const head = foldedWords(b.title.split(",")[0] ?? "").join(" ");
    return [b.id.toLowerCase(), ...(head.includes(" ") || /\p{N}/u.test(head) ? [head] : [])];
  });
  return (l) => {
    // the names it gives: words written with a capital that are a family or a place of this tree
    const rule = textNames(l.rule);
    if (!knownList.some((k) => rule.some((w) => w.startsWith(k)))) return true;
    // and those of its detail, past the first word of a sentence ("Stará kniha…")
    const text = [l.rule, l.detail ?? ""].join("\n");
    const inner = textNames(text, true).filter((w) => !given.has(w));
    const all = [...rule, ...inner];
    if (knownList.some((k) => all.some((w) => w.startsWith(k)) && context.some((w) => w.startsWith(k)))) return true;
    if (inner.some((w) => names.has(w) || surnames.some((s) => lookAlike(w, s)))) return true;
    const words = ` ${foldedWords(text).join(" ")} `;
    return bookNames.some((b) => words.includes(` ${b} `));
  };
}

/** The connectors of an address: those that get its images now, or every one installed for it. */
type Ready = (url: string | undefined) => Connector[];

/** Its images come through the user's browser: strom plans the requests from where the connector says they are. */
function viaBrowser(tree: Tree, c: Connector): boolean {
  return routeOf(tree.env, c).via === "browser" && c.manifest.can.includes("locate");
}

/**
 * The connectors that get an address's images now — fetched by strom, or planned through the user's browser — asked
 * once per host in a brief.
 */
function readyFor(tree: Tree, shared: string | undefined, installed: Ready): Ready {
  const byHost = new Map<string, Connector[]>();
  return (url) => {
    const host = url && URL.canParse(url) ? new URL(url).hostname : undefined;
    if (!host) return [];
    if (!byHost.has(host)) {
      const direct = readyConnectors(tree.env, shared, url!);
      const browser = installed(url).filter((c) => !direct.some((d) => d.name === c.name) && viaBrowser(tree, c) && c.manifest.policy.automation !== "manual" && !missingConsents(tree.env, c).code && !missingConsents(tree.env, c).hosts.length);
      byHost.set(host, [...direct, ...browser]);
    }
    return byHost.get(host)!;
  };
}

/** Every connector installed for an address's host, whatever it can — those that fetch first. */
function installedFor(shared: string | undefined): Ready {
  let all: Connector[] | undefined;
  return (url) => {
    const host = url && URL.canParse(url) ? new URL(url).hostname : undefined;
    if (!host) return [];
    all ??= listConnectors(shared);
    const mine = all.filter((c) => hostAllowed(host, c.manifest.hosts));
    return [...mine.filter((c) => c.manifest.can.includes("fetch")), ...mine.filter((c) => !c.manifest.can.includes("fetch"))];
  };
}

/**
 * The connector of a record set's archive that gets none of its images now — said as what it is, never as none (an
 * agent told "no connector" builds a second one): it only finds books (`search`), the archive's terms allow no
 * automation (`manual`), or it gets them once the user allows it (`consent`: strom fetch asks them).
 */
interface Finder {
  connector: string;
  why: "search" | "manual" | "consent";
}

function bookFinder(tree: Tree, b: RecordSet, installed: Ready): Finder | undefined {
  const all = installed(b.url);
  const c = all.find((x) => x.manifest.can.includes("fetch") || viaBrowser(tree, x)) ?? all[0];
  if (!c) return undefined;
  const why = c.manifest.policy.automation === "manual" ? "manual" : c.manifest.can.includes("fetch") || viaBrowser(tree, c) ? "consent" : "search";
  return { connector: c.name, why };
}

/** The user saves a record set's images by hand: the command that asks them (the whole of it once in a brief). */
function byHandAsk(b: RecordSet, whole: boolean): string {
  return `strom task wait <T…> --images ${b.id}:<numbers> --on "${whole ? "<for the user, in their language: the book, its link, which images as its viewer counts them>" : "…"}"`;
}

/** What a finder of a record set means for its images. */
function finderText(f: Finder, b: RecordSet): string {
  if (f.why === "consent") return `its connector ${f.connector} fetches them once the user allows it — strom fetch ${f.connector} <book> --images <from-to> --recordset ${b.id} asks them`;
  const what = f.why === "manual" ? `the archive's terms allow no automation: its connector ${f.connector} finds books and gives their links` : `its connector ${f.connector} only finds books and fetches no images`;
  return `${what} — the user saves the images by hand`;
}

/** A record set's images come through a connector: which one, and its ID of the book where the research knows it. */
interface BookRoute {
  connector: string;
  book?: string;
  /** It fetches a part of an image sharper. */
  part: boolean;
  /** Through the user's browser: strom plans it, an agent's browser tools get them. */
  browser: boolean;
}

/**
 * The connector of a record set (none where its archive allows no automation), and the book as the connector knows it:
 * from the images it fetched for the record set before, else from the record set's address — where the books the
 * research fetched through it stand in their own record sets' addresses: the same site, the same path before it
 * ("/d/<book>/…"); never guessed from an address of another shape.
 */
function bookRoute(tree: Tree, b: RecordSet, ready: Ready): BookRoute | undefined {
  const repo = b.repository ? tree.get<Repository>(b.repository) : undefined;
  if (repo?.automation === "forbidden" || repo?.automation === "manual") return undefined;
  const c = ready(b.url)[0];
  if (!c) return undefined;
  const part = c.manifest.can.includes("part");
  const browser = routeOf(tree.env, c).via === "browser";
  const media = tree.list<Media>("media").filter((m) => m.fetched?.connector === c.name && m.recordset);
  const own = media.find((m) => m.recordset === b.id)?.fetched?.book;
  if (own) return { connector: c.name, book: own, part, browser };
  const parts = (url: string | undefined) => (url && URL.canParse(url) ? { host: new URL(url).host, path: new URL(url).pathname.split("/").filter(Boolean).map((x) => decodeURIComponent(x)) } : undefined);
  const mine = parts(b.url);
  const found = new Set<string>();
  const seen = new Set<string>();
  for (const m of media) {
    if (seen.has(m.recordset!) || !mine) continue;
    seen.add(m.recordset!);
    const its = parts(tree.get<RecordSet>(m.recordset!)?.url);
    if (!its || its.host !== mine.host) continue;
    const at = its.path.indexOf(m.fetched!.book);
    // the book is one part of its address, after the same path as this one's
    if (at < 0 || its.path.lastIndexOf(m.fetched!.book) !== at || mine.path.length <= at) continue;
    if (its.path.slice(0, at).join("/") === mine.path.slice(0, at).join("/")) found.add(mine.path[at]!);
  }
  return { connector: c.name, ...(found.size === 1 ? { book: [...found][0]! } : {}), part, browser };
}

/** How many images of a record set are registered, how to look at them, and how the others come. */
function imagesLines(tree: Tree, b: RecordSet, route: BookRoute | undefined, shape: boolean, finder?: Finder): string[] {
  // each image once: its parts and other copies are the same image
  const nums = imagesIndex(tree).sets.get(b.id)?.images ?? [];
  const repo = b.repository ? tree.get<Repository>(b.repository) : undefined;
  const byHand = repo?.automation === "forbidden" || repo?.automation === "manual";
  // the connector and its book, in the form strom fetch takes them; the whole command once in a brief
  const fetch = route
    ? `    fetch: ${route.connector} ${route.book ?? `<book: its ID on the portal — strom fetch ${route.connector} --find "<place>" lists them>`}${shape ? ` — strom fetch ${route.connector} ${route.book ?? "<book>"} --images <from-to> --recordset ${b.id}` : ""}${
        route.browser ? `\n    through the user's browser: strom plans the requests, an agent's browser tools get the images (without them the user saves them by hand: ${byHandAsk(b, false)})` : ""
      }`
    : undefined;
  if (nums.length === 0) {
    if (route) return [`    no images here yet — the connector fetches the ones you need`, fetch!];
    if (finder && !byHand) return [`    no images here yet — ${finderText(finder, b)}${finder.why === "consent" ? "" : `: ${byHandAsk(b, true)}, then take the next task`}`];
    if (b.url && !byHand)
      return [`    no images here yet, and no connector for this archive — build one now (strom connector new <name> --url <portal>, then its DISCOVERY.md; tell the user in a sentence), then strom fetch; the user saves them by hand only where the archive does not allow automation`];
    return [`    no images here yet — the user saves them by hand (never scrape an archive): ${byHandAsk(b, true)}, then take the next task`];
  }
  // Which ones exist, when there are gaps (a few runs), or just the span.
  const list = runs(nums);
  const which = list.split(", ").length <= 12 ? list : `${nums[0]}–${nums.at(-1)} with gaps (strom media list --recordset ${b.id})`;
  // scans with little detail (core/mediaindex.ts WEAK_SCAN_PX): what is not found on them may be there
  const weak = weakScans(tree, b.id);
  return [
    `    images registered (${nums.length}): ${which} · strom media view ${b.id}:<image>[-<image>] [--half left|right|both] [--grid] [--crop x,y,w,h]…`,
    weak
      ? `    weak scans (long side ${weak} px): a negative on them is weak — ${route?.part ? `a part sharper: strom fetch ${route.connector} --recordset ${b.id} --images <n> --crop x,y,w,h` : SHARPER_SCAN}`
      : "",
    // the others: through the connector, else as the archive allows
    fetch ??
      (byHand
        ? `    more: by the user's hand — ${byHandAsk(b, false)}`
        : finder
          ? `    more: ${finderText(finder, b)}${finder.why === "consent" ? "" : `: ${byHandAsk(b, false)}`}`
          : b.url
            ? "    more: no connector for this archive yet — build one (strom connector new <name> --url <portal>)"
            : ""),
  ].filter(Boolean);
}

/** What the user put in the shared inbox, waiting to be registered — by folder (one download each). */
function inboxLines(shared: string | undefined): { files: number; lines: string[] } {
  if (!shared) return { files: 0, lines: [] };
  try {
    const folders = inboxFolders(path.join(shared, "inbox"));
    const name = (f: string) => path.basename(f);
    return {
      files: folders.reduce((n, f) => n + f.files.length, 0),
      lines: folders.slice(0, 8).map(({ folder, files }) => {
        const shown = files.length > 3 ? `${name(files[0]!)} … ${name(files.at(-1)!)}` : files.map(name).join(", ");
        // a folder strom made for a waiting task names its record set
        const mine = folder && /^[Bb]\d+(?=\s|$)/.test(folder) ? `  → strom media add --inbox ${shellArg(folder)}` : "";
        return folder ? `  ${folder}/ (${files.length} file${files.length > 1 ? "s" : ""}): ${shown}${mine}` : `  ${shown}`;
      }),
    };
  } catch {
    return { files: 0, lines: [] };
  }
}

/** The archives already known, so registering a download needs no lookup. */
function repoHint(tree: Tree): string {
  const repos = tree.list<Repository>("repository");
  if (!repos.length) return 'the archive first: strom repo add "<archive>" --country <CC> --url <its website>';
  const shown = repos.slice(0, 4).map((r) => `${r.id} ${r.name}`).join(" · ");
  return `archives: ${shown}${repos.length > 4 ? " …" : ""} (another: strom repo add "<archive>" --url …)`;
}

/**
 * The connectors that serve the task's places — fetching their images, or finding their books: those of its record
 * sets, of the other record sets of those places and of the archives the places' jurisdictions name — each with its
 * archive; the others installed by name only.
 */
function placeConnectors(tree: Tree, sets: RecordSet[], places: Set<string>, keys: (x: string) => string[], ready: Ready, installed: Ready, all: Connector[]): { name: string; archive?: string; serves: boolean }[] {
  const urls: { url: string | undefined; archive?: string }[] = [];
  const repoOf = (id: string | undefined) => (id ? tree.get<Repository>(id) : undefined);
  const books = [...sets, ...tree.list<RecordSet>("recordset").filter((b) => !sets.includes(b) && (b.places ?? []).flatMap(keys).some((k) => places.has(k)))];
  for (const b of books) {
    const repo = repoOf(b.repository);
    if (repo?.automation === "forbidden" || repo?.automation === "manual") continue;
    urls.push({ url: b.url, ...(repo ? { archive: repo.name } : {}) }, { url: repo?.url, ...(repo ? { archive: repo.name } : {}) });
  }
  for (const pl of tree.list<Place>("place"))
    if (pl.names.some((n) => keys(n.name).some((k) => places.has(k))))
      for (const j of pl.jurisdictions) {
        const repo = repoOf(j.repository);
        if (repo && repo.automation !== "forbidden" && repo.automation !== "manual") urls.push({ url: repo.url, archive: repo.name });
      }
  const serving = new Map<string, string | undefined>();
  for (const u of urls) for (const c of [...ready(u.url), ...installed(u.url).filter((x) => x.manifest.can.includes("find"))].slice(0, 1)) if (!serving.has(c.name) || !serving.get(c.name)) serving.set(c.name, u.archive);
  // the others that find or fetch, by name: an archive of another place is a command away
  const others = all.filter((c) => !serving.has(c.name) && (c.manifest.can.includes("find") || c.manifest.can.includes("fetch"))).map((c) => ({ name: c.name, serves: false }));
  return [...[...serving].map(([name, archive]) => ({ name, ...(archive ? { archive } : {}), serves: true })), ...others];
}

export function buildBrief(tree: Tree, opts: { task?: Task; session?: Session; budget?: number; shared?: string | undefined; deadline?: number | undefined }): Brief {
  const budget = opts.budget ?? DEFAULT_BUDGET;
  const task = opts.task;
  const research = (task?.research ? tree.get<Research>(task.research) : undefined) ?? tree.list<Research>("research").find((r) => r.state === "active");
  const lang = tree.lang;
  const sections: Section[] = [];
  const focus = research ? tree.get<Person>(research.focus) : undefined;

  // 1. who, where, rules — and what the research is for
  sections.push({
    name: "header",
    required: true,
    pointer: "",
    text: [
      `# Strom research session${opts.session ? ` ${opts.session.id}` : ""}`,
      `Tree "${tree.config.name}"${research ? ` · research ${research.id} "${research.name}" (${research.direction} of ${focus ? label(focus) : research.focus})` : ""}.`,
      research?.question ? `Research question: ${research.question}` : "",
      ...(research?.notes ?? []).slice(-3).map((n) => `From the user: ${n.text}`),
      `Research language: ${langName(lang)} — talk to the user and write notes, tasks and summaries in ${langName(lang)}; transcripts stay in the original language.`,
      "Work ONLY through `strom` commands; never edit files in data/ (it is detected and blocks all writing). Record findings as you go.",
      opts.deadline !== undefined ? briefClock(opts.deadline) : "",
    ].filter(Boolean).join("\n"),
  });

  // the material of an intake task: shown with it, and what it names brings the lessons of its families
  const inputs = [...new Set([...(task?.subject ?? []), ...(task?.where ?? [])])]
    .map((id) => (/^I\d{4,}$/.test(id) ? tree.get<Input>(id) : undefined))
    .filter((i): i is Input => !!i && i.type === "input");

  // 2. the task
  if (task) {
    const where = task.where.map((w) => {
      const b = /^B\d{4,}$/.test(w) ? tree.get<RecordSet>(w) : undefined;
      return b ? `${b.id} ${b.title}` : w;
    });
    sections.push({
      name: "task",
      required: true,
      pointer: `strom task show ${task.id}`,
      text: [
        `## Task ${task.id} (${task.level}, priority ${task.priority})`,
        `what:  ${task.what}`,
        `where: ${where.join("; ")}`,
        `why:   ${task.why}`,
        `done:  ${task.doneWhen}`,
        task.subject.length ? `about: ${task.subject.join(" ")}` : "",
        ...task.notes.slice(-3).map((n) => `note:  ${n.text}`),
        task.notes.length > 3 ? `(notes: the last 3 of ${task.notes.length} — all: strom task show ${task.id})` : "",
      ].filter(Boolean).join("\n"),
    });

  // 2. a review: what each item of the task is, as the tree has it
  if (task.origin.startsWith("review:") && task.where.length)
    sections.push({ name: "review", required: true, pointer: `strom task show ${task.id}`, text: ["## To review", ...reviewItems(tree, task)].join("\n") });

  // 2a. an imported tree: who in it is probably already in the tree
  const treeInputs = [...new Set([...(task?.subject ?? []), ...(task?.where ?? [])])]
    .map((id) => (/^I\d{4,}$/.test(id) ? tree.get<Input>(id) : undefined))
    .filter((i): i is Input => !!i && i.type === "input" && i.kind === "tree" && !!i.sha);
  for (const input of treeInputs) {
    const system = `gedcom:${input.sha!.slice(0, 12)}`;
    const ids = tree.list<Person>("person").filter((p) => !p.retracted && p.refs?.some((r) => r.system === system)).map((p) => p.id);
    const dupes = likelyDuplicates(tree, ids);
    if (dupes.length)
      sections.push({
        name: "duplicates",
        pointer: "strom person list",
        text: [
          `## Probably already in the tree (${input.id}) — look, then merge into the researched person`,
          ...dupes.map((d) => `  ${label(d.person)} ≈ ${label(d.same)} → strom person merge ${d.same.id} ${d.person.id} --reason "…"`),
        ].join("\n"),
      });
  }

  // 2b. the material of an intake task, so it needs no extra command
  if (inputs.length)
    sections.push({
      name: "input",
      pointer: `strom input show ${inputs[0]!.id}`,
      text: [
        "## The material",
        ...inputs.map((i) => {
          const file = inputPath(tree, i);
          // all that strom input show says of it, so it needs no extra command (K6)
          const small = !i.text && i.kind === "text" && file && (i.size ?? 0) < 20_000 && /\.(txt|md|csv)$/i.test(file) ? readSmall(file) : undefined;
          return [
            `${i.id} ${i.name} [${i.kind} · ${i.state}]${i.from ? ` from ${i.from}` : ""}${i.mime ? ` · ${i.mime}${i.size !== undefined ? ` ${Math.round(i.size / 1024)} kB` : ""}` : ""}`,
            file ? `file: ${file}${i.kind === "document" || i.kind === "photo" ? " — open it and read it yourself" : ""}` : "",
            i.batch ? `batch: ${i.batch}${i.path ? ` · ${i.path}` : ""}` : "",
            i.persons?.length ? `of: ${i.persons.join(", ")}` : "",
            i.sorted ? `sorted: ${i.sorted.as}${i.sorted.source ? ` → ${i.sorted.source}` : ""}${i.sorted.reason ? ` (${i.sorted.reason})` : ""}` : "",
            i.imported ? `imported: ${i.imported.persons} persons, ${i.imported.families} families as leads, cited as ${i.source}` : "",
            ...i.notes.map((n) => `note: ${n.text}`),
            i.text ? `text:\n${i.text}` : small ? `text:\n${small}` : "",
          ].filter(Boolean).join("\n");
        }),
      ].join("\n"),
    });
  } else
    sections.push({
      name: "task",
      required: true,
      pointer: "strom task next",
      text: "## No task\nThe queue is empty: look at the research (`strom research show`, `strom frontier`) and add tasks.",
    });

  // 3. premise: what was already searched there, and lessons for those places
  const located = task ? taskRecordsets(tree, task) : { sets: [], guessed: false };
  const where = new Set([...(task?.where ?? []), ...located.sets.map((b) => b.id)]);
  // A task about a conflict or a hypothesis is about its people too; one about a family, about its partners (its
  // children come a line each below).
  const families = (task?.subject ?? []).map((id) => (/^F\d{4,}$/u.test(id) ? tree.get<Family>(id) : undefined)).filter((f): f is Family => !!f && f.type === "family");
  const subjects = new Set([...(task?.subject ?? []), ...subjectPeople(tree, task?.subject ?? []), ...families.flatMap((f) => f.partners)]);
  const persons = [...subjects].map((id) => tree.get<Person>(id)).filter((p): p is Person => !!p && p.type === "person");
  const theirs = persons.flatMap((p) => p.names.map((n) => n.surname).filter(Boolean));
  const surnames = new Set(theirs.map((n) => foldText(n)));
  const repos = new Set([...where].map((w) => tree.get<RecordSet>(w)?.repository).filter(Boolean) as string[]);
  // a lesson on a place (L…) goes with the books of that place — or of the parish it belonged to
  const bookPlaces = new Set([...where].flatMap((w) => tree.get<RecordSet>(w)?.places ?? []).map((x) => foldText(x)));
  // Where and when the task is: its books' places and years, its people's places and years (±30) — a search of their
  // surname in other places and other times is only counted (K11).
  // A place a record set names by its ID (L…) is its names; a place of the task is its parish too: a search in the same
  // parish is kept whatever its years (K11).
  const placeKeys = (x: string): string[] => {
    const pl = /^L\d{4,}$/u.test(x.trim()) ? tree.get<Place>(x.trim()) : undefined;
    return pl?.type === "place" ? pl.names.map((n) => foldText(n.name.split(",")[0]!.trim())) : [foldText(x.split(",")[0]!.trim())];
  };
  const taskPlaces = new Set([...where].flatMap((w) => tree.get<RecordSet>(w)?.places ?? []).flatMap(placeKeys));
  for (const p of persons) for (const e of p.events) if (!e.retracted && e.place) for (const k of placeKeys(e.place)) taskPlaces.add(k);
  const ownPlaces = new Set(taskPlaces);
  for (const pl of tree.list<Place>("place"))
    if (pl.names.some((n) => ownPlaces.has(foldText(n.name.split(",")[0]!.trim()))))
      for (const j of pl.jurisdictions) if (j.kind === "parish") taskPlaces.add(foldText(j.name.split(",")[0]!.trim()));
  const taskYears = [
    ...[...where].flatMap((w) => { const y = parseYears(tree.get<RecordSet>(w)?.years); return y ? [y.from, y.to] : []; }),
    ...persons.flatMap((p) => p.events.filter((e) => !e.retracted).flatMap((e) => dateYears(e.date ?? ""))),
  ];
  const span = taskYears.length ? { from: Math.min(...taskYears) - 30, to: Math.max(...taskYears) + 30 } : undefined;
  const nearby = (s: Search): boolean => {
    const books = s.recordsets.map((b) => tree.get<RecordSet>(b)).filter((b): b is RecordSet => !!b);
    const spans = [s.scope.years, ...(s.scope.years ? [] : books.map((b) => b.years))].map((y) => parseYears(y)).filter((y) => !!y);
    const places = [...(s.scope.places ?? []), ...books.flatMap((b) => b.places)].flatMap(placeKeys);
    if (places.some((x) => taskPlaces.has(x))) return true;
    if (span && spans.length) return spans.some((y) => y.from <= span.to && span.from <= y.to);
    // nothing to tell it by: kept
    return !places.length || (!span && !taskPlaces.size);
  };
  const named = (s: Search) => (s.scope.surnames ?? []).some((x) => theirs.some((y) => sameFamilyName(x, y)));
  const premise = tree.list<Search>("search").filter((s) => s.recordsets.some((b) => where.has(b)) || (s.task && s.task === task?.id) || named(s));
  const searches = premise.filter((s) => s.recordsets.some((b) => where.has(b)) || (s.task && s.task === task?.id) || nearby(s));
  const elsewhere = premise.filter((s) => !searches.includes(s));
  const elsewhereNames = [...new Set(elsewhere.flatMap((s) => theirs.filter((y) => (s.scope.surnames ?? []).some((x) => sameFamilyName(x, y)))))];
  const ofPlace = (id: string) => {
    const pl = tree.get<Place>(id);
    return pl?.type === "place" && [...pl.names.map((n) => n.name), ...pl.jurisdictions.map((j) => j.name)].some((n) => [...bookPlaces].some((b) => b === foldText(n) || b.startsWith(`${foldText(n)},`)));
  };
  const all = tree.list<Lesson>("lesson").filter((l) => !l.retracted);
  // a lesson of the whole project goes with the task whose families or places it names — or names none of the tree's
  const project = all.filter((l) => l.scope === "project" && !l.target);
  const fits = project.length ? projectLessonFit(tree, task, persons, [...where], inputs.length ? materialText(tree, inputs) : undefined) : () => true;
  const lessons = all.filter((l) => (l.target && (where.has(l.target) || repos.has(l.target) || ofPlace(l.target))) || (l.scope === "project" && (l.target || fits(l))));
  const otherProject = project.filter((l) => !lessons.includes(l)).length;
  const method = all.filter((l) => l.scope === "method").length;
  // Shown before the people, given its room after the others: first the lessons that go with the task — after whom the
  // task is about, the last sessions and its own open questions (a long list never pushes out whom the task is about,
  // P3) —, then its searches, before the people's notes and the other open questions are given whole.
  const searched = `strom searched ${[...where].find((w) => w.startsWith("B")) ?? [...surnames][0] ?? "<where>"}`;
  sections.push({
    last: true,
    ...layered("premise", `${searched}${lessons.length ? " · lessons: strom lesson list" : ""}`, {
      head: ["## Already known (check the premise before searching)"],
      parts: searches.map((s) => ({ short: "", whole: `  ${s.id} [${searchedAs(s)}] ${s.question}${s.scope.years ? ` · ${s.scope.years}` : ""}${s.scope.pages ? ` · pages ${s.scope.pages}` : ""} · ${s.recordsets.join(" ")}${s.by !== "main" ? ` (by ${s.by})` : ""}` })),
      tail: [
        ...(searches.length ? [] : ["  nothing searched yet for this task's record sets and surnames"]),
        ...(elsewhere.length ? [`  +${elsewhere.length} search${elsewhere.length > 1 ? "es" : ""} of ${elsewhereNames.join(", ")} in other places and years: ${elsewhereNames.map((n) => `strom searched ${shellArg(n)}`).join(" · ")}`] : []),
        ...(lessons.length ? ["lessons:", ...lessons.map((l) => `  ${l.id}${l.target ? ` (${l.target})` : ""}: ${l.rule}`)] : []),
        ...(otherProject ? [`lessons about other families and places: ${otherProject} — strom lesson list --scope project`] : []),
        ...(method ? [`method lessons of this research: ${method} — strom lesson list --scope method`] : []),
      ],
      more: searched,
    }),
  });

  // 4. handover from the previous sessions
  const recent = recentSessions(tree, research?.id);
  if (recent.length)
    sections.push({
      name: "handover",
      pointer: "strom session list",
      text: ["## Last sessions", ...recent.map((s) => `  ${s.id} ${s.state}${s.task ? ` on ${s.task}` : ""}: ${s.summary ?? "(no summary)"}${s.next ? `\n    next: ${s.next}` : ""}`)].join("\n"),
    });

  // 5. the people concerned: whom the task is about in full, their parents with what identifies them (facts, houses,
  // occupations, parents), grandparents and brothers and sisters one line each — the rest is a command away
  const people = new Map<string, { how: "full" | "parent" | "line"; role: string }>();
  const personSubjects = [...subjects].filter((id) => tree.get(id)?.type === "person");
  // no person named: the research's focus, to know whose tree it is
  const about = personSubjects.length ? personSubjects : research ? [research.focus] : [];
  for (const id of about) people.set(id, { how: "full", role: "" });
  // A task that links hypotheses to the tree reads no records: its people by who they are and the families a link
  // would join, nothing more — never their every fact and note; besides whom they are about, those their variants name.
  const linking = task?.origin === HYPOTHESIS_LINKS_ORIGIN;
  if (linking)
    for (const h of (task?.subject ?? []).map((id) => tree.get<Hypothesis>(id)).filter((x): x is Hypothesis => x?.type === "hypothesis"))
      for (const id of hypothesisPeople(tree, h)) if (!people.has(id) && tree.get(id)?.type === "person") people.set(id, { how: "full", role: `named in ${h.id}` });
  for (const f of families) for (const c of f.children) if (!people.has(c.person)) people.set(c.person, { how: "line", role: `child of ${f.id}` });
  for (const id of about) {
    for (const p of parentsOf(tree, id)) {
      if (!people.has(p.id)) people.set(p.id, { how: personSubjects.length ? "parent" : "line", role: `${p.sex === "F" ? "mother" : p.sex === "M" ? "father" : "parent"} of ${id}` });
      for (const gp of parentsOf(tree, p.id)) if (!people.has(gp.id)) people.set(gp.id, { how: "line", role: `${gp.sex === "F" ? "mother" : gp.sex === "M" ? "father" : "parent"} of ${p.id}` });
    }
    for (const f of familiesAsChild(tree, id)) for (const s of f.children) if (!people.has(s.person) && s.person !== id) people.set(s.person, { how: "line", role: `sibling of ${id}` });
  }
  if (people.size || families.length) {
    // each block whole, and in short — its notes cut to the start of the last one, what tells namesakes apart
    const blocks: Part[] = [
      ...families.map((f) => ({ short: familyBlock(tree, f, true).join("\n"), whole: familyBlock(tree, f).join("\n") })),
      ...[...people.entries()].flatMap(([id, { how, role }]) => {
        const p = tree.get<Person>(id);
        if (!p) return [];
        const line = () => relativeLine(tree, p, role, !role.startsWith("sibling") && !role.startsWith("child of"));
        if (linking) {
          const text = how === "full" ? identityBlock(tree, p, role).join("\n") : line();
          return [{ short: text, whole: text }];
        }
        if (how === "full") return [{ short: personBlock(tree, p, 1, true).join("\n"), whole: personBlock(tree, p, 1).join("\n") }];
        if (how === "parent") return [{ short: relativeBlock(tree, p, role, true).join("\n"), whole: relativeBlock(tree, p, role).join("\n") }];
        return [{ short: line(), whole: line() }];
      }),
    ];
    const short = linking || [...people.values()].some((x) => x.how !== "full");
    const whom = [...people.keys()][0] ?? "P…";
    sections.push(
      layered("people", `strom person show ${whom}`, {
        head: ["## People concerned"],
        parts: blocks,
        tail: short ? [`  (${linking ? "in short" : "others in short"} — all facts, sources and notes: strom person show P… · their life with its records: strom person card P…)`] : [],
        more: `strom person show ${whom}`,
      }),
    );
  }

  // 6. open conflicts and hypotheses about them
  const ids = new Set(people.keys());
  // the task's own conflicts and hypotheses come first, whatever their state
  const own = (id: string) => subjects.has(id);
  const conflicts = tree.list<Conflict>("conflict").filter((c) => own(c.id) || (c.state === "open" && c.subject.some((s) => ids.has(s))));
  const hyps = tree.list<Hypothesis>("hypothesis").filter((h) => own(h.id) || (h.state === "open" && hypothesisPeople(tree, h).some((s) => ids.has(s))));
  const first = <T extends { id: string }>(list: T[]) => [...list.filter((x) => own(x.id)), ...list.filter((x) => !own(x.id))];
  const mark = (id: string, state: string) => `${own(id) ? "→ " : "  "}${id}${state === "open" ? "" : ` [${state}]`}`;
  // the task's own whole always; the others in short (the start of each) until there is room for them whole
  const question = (id: string, whole: string): Part => ({ short: own(id) ? whole : noteStart(whole, QUESTION_SHORT), whole });
  if (conflicts.length || hyps.length)
    sections.push(
      layered("open questions", "strom conflict list · strom hypothesis list", {
        head: ["## Open conflicts and hypotheses" + (conflicts.some((c) => own(c.id)) || hyps.some((h) => own(h.id)) ? " (→ this task is about it)" : "")],
        parts: [
          ...first(conflicts).map((c) => question(c.id, `${mark(c.id, c.state)} ${c.title}: ${c.claims.map((x) => `${x.source ? `${x.source} ` : ""}${x.value}`).join(" | ")}${c.resolution ? ` — resolved: ${c.resolution}` : ""}`)),
          ...first(hyps).map((h) => question(h.id, `${mark(h.id, h.state)} ${h.question}: ${h.variants.map((v) => `${v.label}) ${v.claim}${variantRecorded(tree, h, v)}`).join("; ")}${h.decision ? ` — ${h.state}: ${h.decision}` : ""}`)),
        ],
        tail: [],
        more: "strom conflict show X… · strom hypothesis show H…",
      }),
    );

  // 7. the record sets to work in, each with the connector that fetches its images and its ID of the book
  const sets = located.sets;
  const installed = installedFor(opts.shared);
  const ready = readyFor(tree, opts.shared, installed);
  const routes = new Map(sets.map((b) => [b.id, bookRoute(tree, b, ready)]));
  const finders = new Map(sets.map((b) => [b.id, routes.get(b.id) ? undefined : bookFinder(tree, b, installed)]));
  const shapeFor = sets.find((b) => routes.get(b.id))?.id;
  if (sets.length)
    sections.push({
      name: "record sets",
      // the books to work in, their images and calibration: kept before the long lists when the brief is full
      first: true,
      pointer: `strom recordset show ${sets[0]!.id}`,
      text: [
        located.guessed
          ? `## Record sets (the task names none; these cover it — point it at the right one: strom task edit ${task!.id} --where ${sets[0]!.id})`
          : "## Record sets",
        ...sets.map((b) => {
          const repo = b.repository ? tree.get<Repository>(b.repository) : undefined;
          return [
            `  ${b.id} ${b.title}`,
            `    ${[b.kinds.join(", "), b.places.join(", "), b.years].filter(Boolean).join(" · ")} · access ${b.access}${b.url ? ` · ${b.url}` : ""}`,
            repo ? `    ${repo.name} · automated download: ${repo.automation}${repo.terms ? ` · terms: ${repo.terms}` : ""}` : "",
            b.layout ? `    layout: ${b.layout}` : "",
            calibrationLine(b) ? `    ${calibrationLine(b)}` : "",
            ...imagesLines(tree, b, routes.get(b.id), b.id === shapeFor, finders.get(b.id)),
          ].filter(Boolean).join("\n");
        }),
      ].join("\n"),
    });

  // 7b. what the user put in the shared inbox — scans or documents nobody registered yet
  const inbox = inboxLines(opts.shared);
  if (inbox.files)
    sections.push({
      name: "inbox",
      pointer: "strom media add --inbox <folder> --recordset B…",
      text: [
        `## Waiting in the inbox (${inbox.files} file${inbox.files > 1 ? "s" : ""} from the user)`,
        ...inbox.lines,
        "  one folder = one download = one record set. Register the book, then its scans:",
        `  ${repoHint(tree)}`,
        '  strom recordset add "<title>" --repo R… --call-number <sig> --kinds baptism --places <places> --years <from-to>',
        '  strom media add --inbox "<folder>" --recordset B…   · a document (certificate, letter): strom intake <file>',
      ].join("\n"),
    });

  // 8. method for this kind of task
  // (budgeted first, with the record sets and the commands: when the brief is long, the lists are cut before how to work)
  // only the parts the level uses — of getting images, those of how this task's record sets get them (none named:
  // every way)
  // (a connector that fetches none of a book's images is no reason to build one: its images come by hand)
  const repoByHand = (b: RecordSet) => ["forbidden", "manual"].includes((b.repository ? tree.get<Repository>(b.repository) : undefined)?.automation ?? "");
  const noRoute = (b: RecordSet) => !routes.get(b.id) && finders.get(b.id)?.why !== "consent";
  const conditions = [
    ...(sets.some((b) => !noRoute(b)) || !sets.length ? ["connector"] : []),
    ...(sets.some((b) => routes.get(b.id)?.part) || !sets.length ? ["part"] : []),
    ...(sets.some((b) => noRoute(b) && !repoByHand(b) && !finders.get(b.id)) || !sets.length ? ["no-connector"] : []),
    ...(sets.some((b) => (noRoute(b) && (repoByHand(b) || !!finders.get(b.id) || !b.url)) || routes.get(b.id)?.browser) || !sets.length ? ["by-hand"] : []),
  ];
  // a task that links hypotheses reads no records: the parts of the method and the commands it uses, whatever its level
  const kind = linking ? METHOD_LINKS : task?.level;
  sections.push({ name: "method", first: true, pointer: "strom guide", text: methodFor(kind, conditions) });

  // 8b. the commands this kind of task uses, with every option and limit (K2): asking for them costs a turn each —
  // and the connectors of the task's places, so that fetching needs no lookup
  // (the others installed only where none serves them, or the task is to find where the records are)
  const connectors = placeConnectors(tree, sets, taskPlaces, placeKeys, ready, installed, listConnectors(opts.shared));
  const sheet = commandSheet(kind, { connectors: task?.level === "locate" || !connectors.some((c) => c.serves) ? connectors : connectors.filter((c) => c.serves) });
  if (sheet) sections.push({ name: "commands", first: true, pointer: "strom help <command>", text: sheet });

  // 9. how to finish
  sections.push({
    name: "closing",
    required: true,
    pointer: "",
    text: [
      "## Finishing",
      "- new questions → strom task add … (what, where, why, done-when)",
      task
        ? '- done: strom session close --done "what was proven, what was searched in vain" --next "the next cheapest step" (the task and the session in one call; a complete negative search is a result)'
        : '- then: strom session close --summary "what was proven, what was searched in vain" --next "the next cheapest step"',
      task ? `- put aside: strom task park|wait ${task.id} …, then strom session close --summary "…" --next "…"` : "",
      `- if the task is not finished: strom session close --continue --summary "…" --next "exactly where you stopped"`,
      // what the user reads of a session is its summary (strom's run output, the menu, the Strom app): strom's own words
      // there are impersonal, so is what it shows of the agent's
      "- the user reads the summary (menu, Strom app): plain words, never addressed to them",
      // working alone: every task starts in a fresh session by itself; nobody reads a closing message
      opts.session?.runner
        ? "- working alone (strom run): after strom session close you are done — no closing message to the user and no advice to clear the context (/clear, a new conversation): each task starts fresh by itself"
        : "",
      "- a command you need: strom help <command> (short, with examples) — the full guide: strom guide",
    ].filter(Boolean).join("\n"),
  });

  // Assemble within the budget: required sections always, then the first ones whole when they fit, then the others in
  // order — those in parts in short —, a first one that did not fit whole cut after them, and last the parts given in
  // short made whole while they fit (UPGRADES); each written where it stands. Everything written counts: the blank line
  // between sections, the pointer of a section cut.
  const SEP = tokens("\n\n");
  let used = sections.filter((s) => s.required).reduce((n, s) => n + tokens(s.text) + SEP, 0);
  const shown = new Map<Section, { text: string; cut: boolean }>();
  for (const s of sections.filter((x) => x.first && !x.required))
    if (used + tokens(s.text) + SEP <= budget) {
      used += tokens(s.text) + SEP;
      shown.set(s, { text: s.text, cut: false });
    }
  // Its heading always (the agent knows what it was not given), as many whole lines as fit, then the pointer.
  const cutLines = (s: Section, text: string) => {
    const [head = "", ...rest] = text.split("\n");
    const pointer = `  … cut to fit the brief — see: ${s.pointer}`;
    const kept: string[] = [head];
    // each line with the line break before it: what it adds to the text written
    let raw = rawTokens(head) + rawTokens(`\n${pointer}`);
    for (const l of rest) {
      const r = rawTokens(`\n${l}`);
      if (used + Math.ceil(raw + r) + SEP > budget) break;
      kept.push(l);
      raw += r;
    }
    used += Math.ceil(raw) + SEP;
    shown.set(s, { text: [...kept, pointer].join("\n"), cut: true });
  };
  // A section in parts: which of them are given whole. Parts left out are said where they would stand (they come in
  // order); parts in short after them all.
  const wholeParts = new Map<Section, boolean[]>();
  const render = (s: Section, whole: boolean[]) => {
    const { head, parts, tail, more } = s.layers!;
    const lines = [...head];
    let out = false;
    let short = false;
    parts.forEach((p, i) => {
      if (whole[i]) return void lines.push(p.whole);
      if (p.short) {
        short = true;
        return void lines.push(p.short);
      }
      if (!out) lines.push(`  … cut to fit the brief — see: ${more}`);
      out = true;
    });
    if (short) lines.push(`  … in short to fit the brief — all: ${more}`);
    return { text: [...lines, ...tail].join("\n"), cut: out || short };
  };
  const fit = (s: Section) => {
    if (s.layers) {
      const whole = s.layers.parts.map((p) => p.short === p.whole);
      const r = render(s, whole);
      const t = tokens(r.text);
      if (used + t + SEP <= budget) {
        used += t + SEP;
        shown.set(s, r);
        wholeParts.set(s, whole);
      } else cutLines(s, [...s.layers.head, ...s.layers.parts.map((p, i) => (whole[i] ? p.whole : p.short)).filter(Boolean), ...s.layers.tail].join("\n"));
      return;
    }
    const t = tokens(s.text);
    if (!s.first && used + t + SEP <= budget) {
      used += t + SEP;
      shown.set(s, { text: s.text, cut: false });
      return;
    }
    cutLines(s, s.text);
  };
  // the others in order, a first one that did not fit whole cut after them, the last ones after all
  const pending = sections.filter((s) => !s.required && !shown.has(s));
  for (const s of [...pending.filter((x) => !x.first && !x.last), ...pending.filter((x) => x.first), ...pending.filter((x) => x.last && !x.first)]) fit(s);
  // then the parts given in short made whole, section by section, each while it fits
  for (const name of UPGRADES)
    for (const s of sections.filter((x) => x.name === name && wholeParts.has(x))) {
      const whole = wholeParts.get(s)!;
      const parts = s.layers!.parts;
      let now = shown.get(s)!;
      for (let i = 0; i < parts.length; i++) {
        if (whole[i]) continue;
        whole[i] = true;
        const next = render(s, whole);
        const more = tokens(next.text) - tokens(now.text);
        if (used + more <= budget) {
          used += more;
          now = next;
          continue;
        }
        whole[i] = false;
        // a part left out ends it (the list stays in its order); one in short is passed over for those after it
        if (!parts[i]!.short) break;
      }
      shown.set(s, now);
    }
  const report: Brief["sections"] = [];
  const parts: string[] = [];
  for (const s of sections) {
    const r = s.required ? { text: s.text, cut: false } : shown.get(s)!;
    parts.push(r.text);
    report.push({ name: s.name, tokens: tokens(r.text), cut: r.cut });
  }
  const text = parts.join("\n\n") + "\n";
  return { text, sections: report, total: tokens(text), budget };
}

