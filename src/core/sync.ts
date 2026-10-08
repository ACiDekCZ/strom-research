// strom sync: a family tree coming back — from the Strom app, or another
// program's file — compared with the research, and what the user changed taken
// in without ever losing what the research rests on.
//
// Three states are compared, each read the same way (a GEDCOM snapshot):
//   base      what the research gave the app — its export at the commit the
//             file names (_STROM_HEAD), rebuilt from the tree's history;
//   incoming  the file;
//   ours      the research now.
// The user's edits are where incoming differs from base; what the research did
// since is never taken for the user undoing it. Without a base (another
// program, an older export) only additions are taken, differences are shown.
//
// Nothing is overwritten or deleted without a trace: additions go in as leads
// citing one source ("edits in the Strom app"), a lead is corrected with the
// reason, a fact a record proves is either kept with a conflict to decide or —
// the user's choice (sync.edits user) — withdrawn with the reason and replaced
// by the user's word. What the app no longer has is only reported. One sync is
// one input, one source and one commit, and can be undone (strom sync undo).

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CHILD_RELATIONS, UNIONS, eventKind, type ChildLink, type ChildRelation, type Citation, type Conflict, type Event, type Family, type Input, type Name, type Participant, type ParticipantRole, type Person, type Place, type RecordSet, type Repository, type Session, type Source, type Task, type Union } from "./model.ts";
import { isWeak } from "./evidence.ts";
import { phrase } from "./phrases.ts";
import { addChild, addEvent, addFamily, addName, addNote, editEvent, editPerson, retractEvent, retractPerson } from "./actions.ts";
import { exportGedcom, REFN_TYPE } from "../gedcom/export.ts";
import { children, parseGedcomText, val, type GedNode } from "../gedcom/parse.ts";
import { fromFlexDate, houseOf, importDate, readGedName, stromAppFile } from "./import.ts";
import { humanAge, normalizeAge } from "./age.ts";
import { dateYears } from "./gdate.ts";
import { create, update } from "./records.ts";
import { foldText, safeFolderName } from "./text.ts";
import { roleWord } from "./roles.ts";
import { labels, type LabelKey } from "../gedcom/labels.ts";
import { eventName, humanDate } from "../cli/human.ts";
import { ui } from "../cli/ui.ts";
import { StromError, UsageError } from "./errors.ts";
import * as git from "./git.ts";
import { now, Tree, typeOfId } from "./tree.ts";
import { isArchive } from "./mode.ts";
import { isAppVersion } from "./stromapp.ts";
import { cleanTitle, formatName, foundTitles, gedcomTitledName, primaryName, titledName } from "./people.ts";

// ── snapshots ────────────────────────────────────────────────────────────────

export interface SFact {
  kind: string;
  date?: string;
  place?: string;
  value?: string;
  label?: string;
  /** What the record says of it besides (the Strom app's fields from 3.7): the cause, the age (GEDCOM form), the house. */
  cause?: string;
  age?: string;
  house?: string;
  /** A couple's fact: each partner's age (the person's key → GEDCOM form). */
  ages?: Record<string, string>;
  /** The sources it cites (keys of the snapshot's sources), with where in them. */
  cites?: SCite[];
  /** Who else the record names at it: godparents, witnesses, the officiant … */
  parts?: SPart[];
  /** Ours and base only: the fact's ID in the research. */
  id?: string;
}

/** Someone the record names at a fact: a person of the file (its key), or a name as written; their role. */
export interface SPart {
  role: ParticipantRole;
  person?: string;
  name?: string;
  note?: string;
}

/** A citation of a fact: the source (its key in the snapshot), the page, when the entry was written, its QUAY. */
export interface SCite {
  source: string;
  page?: string;
  date?: string;
  quay?: number;
}

/** A source as a file has it: one entry of a register (the Strom app's way), or a book of older trees. */
export interface SSource {
  /** Our ID (REFN S…) — or "x:<xref>" for one the file brought. */
  key: string;
  title: string;
  /** The archive's name. */
  repo?: string;
  /** Where in the book: the source's page, else its first citation's. */
  page?: string;
  /** The words of the entry. */
  text?: string;
  /** When the entry was written (its citations' DATA DATE). */
  date?: string;
  url?: string;
  note?: string;
  /** The quality the file gives its citations (GEDCOM QUAY 0–3), the first one. */
  quay?: number;
  /** The user ticked "transcript verified" in the app (_STROM_VERIFIED Y). */
  verified?: boolean;
}

export interface SPerson {
  /** Our ID (REFN) — or "x:<xref>" for someone the file brought. */
  key: string;
  names: string[];
  sex?: string;
  facts: SFact[];
  notes: string[];
  /** Every note under them, their facts' too: what the research has said of them (a note coming back folded is known by it). */
  said: string;
  /** The sources of the person themselves (the Strom app's sources of a person; the research's citations of their names). */
  cites?: SCite[];
  /** A husband (HUSB) in a family of the file: the sex the Strom app gives someone of none (male, else female). */
  husb?: true;
  /**
   * The titles of the name they are shown by (NPFX / NSFX, the app's titleBefore / titleAfter): never part of
   * `names[0]`, which is the name without them.
   */
  titles?: Titles;
}

/** The titles of a name: before it ("Ing.") and after it ("ml."). */
export interface Titles {
  before?: string;
  after?: string;
}

export interface SFamily {
  partners: string[];
  children: string[];
  facts: SFact[];
  /** The sources of the family itself (the couple, a child's parents) where no fact of it carries them. */
  cites?: SCite[];
  /** The couple's notes (1 NOTE under FAM; the Strom app's one note of a partnership). */
  notes?: string[];
  /** Every note under it, its facts' too (the app joins a marriage's note into the couple's). */
  said?: string;
  /** Ours and base only. */
  id?: string;
  /** The family's mark in the file (ours and base: the research's ID). */
  xref?: string;
  /** A child who is not the partners' own (the child's PEDI, _FREL/_MREL alike): adopted, foster, step — by the child's key. */
  relations?: Record<string, string>;
  /** A child related otherwise to each parent (_FREL/_MREL, the app's parentRelTypes): by the child's key, each parent's key → birth, adopted, step, foster. */
  relationsBy?: Record<string, Record<string, string>>;
  /** What the file says of a child's tie to a parent that the research has no word for: by the child's key, the words. */
  relationsUnknown?: Record<string, string[]>;
  /** Parents of a child who are no couple (the Strom app's 1 _STROM_NO_COUPLE Y, its beta.39). */
  noCouple?: true;
  /** How the couple is bound where its facts cannot say it (Family.union). */
  union?: Union;
}

/** The words of a _STAT (the Strom app's own, also Legacy's and FTM's) as a union, or nothing it names. */
function unionOfStat(value: string | undefined): Union | undefined {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "married" || v === "divorced" || v === "separated") return v;
  if (["partners", "partner", "unmarried", "unmarried couple", "never married", "cohabiting", "living together", "domestic partnership"].includes(v)) return "partners";
  return undefined;
}

/**
 * A family's union as the research keeps it: a couple's only what its facts cannot say (partners, separated); a family
 * of one partner (married to somebody unknown — the Strom app's beta.55 with no child, its beta.56 with their children
 * too) any, from its bare MARR or DIV too: none said, the one parent's children, no couple.
 */
function unionOf(stat: Union | undefined, alone: boolean, married: boolean, divorced: boolean): Union | undefined {
  if (alone) return stat ?? (divorced ? "divorced" : married ? "married" : undefined);
  return stat === "partners" || stat === "separated" ? stat : undefined;
}

/** Where a place is on the map, as a file has it (the Strom app keeps it for the place's name). */
export interface SPlace {
  name: string;
  lat: number;
  lon: number;
}

export interface Snapshot {
  format: "gedcom" | "strom-json";
  /** The research the file is of (_STROM_TREE), and the state of it (_STROM_HEAD). */
  treeId?: string;
  head?: string;
  persons: Map<string, SPerson>;
  families: SFamily[];
  /** The places with coordinates, by placeKey. */
  places?: Map<string, SPlace>;
  /** The sources, by key. */
  sources?: Map<string, SSource>;
  /** How the user's transcripts count (the Strom app's setting, _STROM_TRANSCRIPTS): lead unless evidence. */
  transcripts?: "lead" | "evidence";
  /**
   * The file writes SEX U where the research's unknown stands (the Strom app's `_STROM_SEX_U Y`, its JSON's
   * `research.sexU`): a sex it gives there is the user's — no guess of the app's to tell from it.
   */
  sexU?: true;
  /** The tree of the Strom app it is (_STROM_APP_TREE): its own browser, profile or computer. */
  appTree?: string;
  /** The send this copy is a copy of, with the user's edits since (_STROM_SINCE R…): their edits are counted against it. */
  since?: string;
  /** A send taken back, sent again (strom's own mark, _STROM_AGAIN R…): against the research as the undo left it. */
  again?: string;
  problems: string[];
}

const OUR_ID = /^P\d{4,}$/;
const OUR_SOURCE = /^S\d{4,}$/;

const fold = (s: string | undefined) => (s ? foldText(s).replace(/\s+/g, " ").trim() : "");
/** Lower case, accents kept: "Dvořak" is not "Dvořák" — a corrected accent is an edit. */
const exact = (s: string | undefined) => (s ? s.normalize("NFC").toLocaleLowerCase().replace(/\s+/g, " ").trim() : "");
/** Christening and baptism are one fact here, as in the import. */
const kindOf = (k: string) => (k === "CHR" ? "BAPM" : k);
/** A fact for a comparison. An event's label only where nothing else tells it apart: it is in the language of whoever wrote it. */
export const factKey = (f: SFact) => [kindOf(f.kind), f.date ?? "", exact(f.place), exact(f.value), f.date || f.place ? "" : fold(f.label)].join("|");
/** A name for a comparison: "? /Novák/", "Jan //" and "Jan /?/" are the names the research has. */
const nameKey = (n: string) => exact(n.replace(/[/?]/g, " "));

/** Titles as a snapshot keeps them: none when neither is said. */
function titlesFrom(before: unknown, after: unknown): Titles | undefined {
  const [b, a] = [cleanTitle(before), cleanTitle(after)];
  return b || a ? { ...(b ? { before: b } : {}), ...(a ? { after: a } : {}) } : undefined;
}

/**
 * A person of the file whose name says no titles (no NPFX / NSFX, no titleBefore / titleAfter) where the research's
 * name has them: an app that reads no titles (the Strom app before 3.10) keeps them in the name — the research gives
 * them in the NAME line ("Ing. Jan /Novák/ ml." comes back "Ing. Jan /Novák ml./"). Found there, they are the person's
 * titles still, taken off the name: never a new name, never a title taken away. Where the name has them no more, the
 * user took them off (an app of titles or not: what it shows them as).
 */
function titlesInName(p: SPerson, known: (Titles | undefined)[]): void {
  if (p.titles || !p.names[0]) return;
  let line = p.names[0];
  const got: Titles = {};
  for (const t of known) {
    if (!t) continue;
    const found = foundTitles(line, { before: got.before ? undefined : t.before, after: got.after ? undefined : t.after });
    if (!found.before && !found.after) continue;
    line = found.line;
    if (found.before) got.before = found.before;
    if (found.after) got.after = found.after;
  }
  if (!got.before && !got.after) return;
  p.names[0] = line;
  p.titles = got;
}

/** The conflict tag of a title: GEDCOM's own (NPFX before the name, NSFX after it). */
const titleTag = (part: "before" | "after") => (part === "before" ? "NPFX" : "NSFX");

/** A conflict of a title the user edited in the Strom app, open with this word of theirs ("" none): asked already. */
function openTitleConflict(tree: Tree, id: string, part: "before" | "after", theirs: string): boolean {
  return tree
    .list<Conflict>("conflict")
    .some((x) => x.state === "open" && x.fact === titleTag(part) && x.subject[0] === id && x.claims[1]?.note === "the user's edit" && exact(x.claims[1].value) === exact(theirs));
}

/**
 * A title of the name a person is shown by set ("" taken off) — the name citing where it came from (once) — and what
 * an undo needs: the title before, the citation it added.
 */
export function setTitle(tree: Tree, owner: string, part: "before" | "after", value: string, citation: Citation | undefined, reason: string): Applied {
  const key = part === "before" ? "prefix" : "suffix";
  const shown = primaryName(tree.get<Person>(owner)!);
  const was = shown[key] ?? "";
  const cites = !!citation && !(shown.citations ?? []).some((c) => c.source === citation.source && c.locator === citation.locator);
  update<Person>(
    tree,
    owner,
    "person",
    (x) => {
      const at = x.names.indexOf(primaryName(x));
      return { ...x, names: x.names.map((n, i) => (i !== at ? n : titled({ ...n, ...(cites ? { citations: [...(n.citations ?? []), citation!] } : {}) }, key, value))) };
    },
    { op: "person.edit", summary: `${owner} title ${part} the name ${value ? `"${value}"` : "taken off"}${was ? ` (was "${was}")` : ""}`, reason },
  );
  return { do: "name.title", id: owner, before: JSON.stringify({ part, was, ...(cites ? { cited: citation } : {}) }) };
}

/** A name with this title set ("" none). */
function titled(n: Name, key: "prefix" | "suffix", value: string): Name {
  const { [key]: _gone, ...rest } = n;
  const v = cleanTitle(value);
  return v ? { ...rest, [key]: v } : rest;
}

/** A place's name as the Strom app keys its coordinates (placeKey of its places.ts): no accents, case, stops or commas. */
export const placeKey = (s: string) => foldText(s.replace(/[.,;]/g, " ")).replace(/\s+/g, " ").trim();

/** The Strom app's own key of a place's coordinates in its JSON (places.ts). */
const appPlaceKey = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** GEDCOM's N50.042 / E15.358 (also a bare or negative number): degrees, the south and west negative. */
function degrees(v: string | undefined, neg: string, max: number): number | undefined {
  const m = /^\s*([NSEW])?\s*(-?\d{1,3}(?:\.\d+)?)\s*$/i.exec(v ?? "");
  if (!m) return undefined;
  const n = Number(m[2]) * (m[1]?.toUpperCase() === neg ? -1 : 1);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : undefined;
}

/** The places of a GEDCOM with their MAP > LATI/LONG, wherever a PLAC is. */
function gedPlaces(records: GedNode[]): Map<string, SPlace> {
  const out = new Map<string, SPlace>();
  const walk = (n: GedNode) => {
    for (const c of n.children) {
      const map = c.tag === "PLAC" ? c.children.find((x) => x.tag === "MAP") : undefined;
      const lat = map ? degrees(val(map, "LATI"), "S", 90) : undefined;
      const lon = map ? degrees(val(map, "LONG"), "W", 180) : undefined;
      const name = c.value.replace(/\s+/g, " ").trim();
      if (lat !== undefined && lon !== undefined && name && !out.has(placeKey(name))) out.set(placeKey(name), { name, lat, lon });
      walk(c);
    }
  };
  for (const r of records) if (r.tag === "INDI" || r.tag === "FAM") walk(r);
  return out;
}

/** The same point: the Strom app keeps six decimals. */
const samePoint = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => Math.abs(a.lat - b.lat) < 5e-7 && Math.abs(a.lon - b.lon) < 5e-7;

/** The Strom app's "Birth (alternative record)": a second birth or death of ours coming back as an event of its own. */
const ALTERNATIVE: Record<string, string> = {
  "birth (alternative record)": "BIRT", "death (alternative record)": "DEAT",
  "narozeni (alternativni zaznam)": "BIRT", "umrti (alternativni zaznam)": "DEAT",
  "geburt (alternativer eintrag)": "BIRT", "tod (alternativer eintrag)": "DEAT",
};

/** The Strom app's entry of a birth, a death (its gedcomNotes.birthRecord, deathRecord) → the fact it is of. */
const ENTRY: Record<string, string> = {
  "birth record": "BIRT", "death record": "DEAT",
  "zapis o narozeni": "BIRT", "zapis o umrti": "DEAT",
  geburtseintrag: "BIRT", sterbeeintrag: "DEAT",
};

/** Facts there is one of: an edit of one is a change, not a second fact. */
const ONE = new Set(["BIRT", "BAPM", "DEAT", "BURI", "CREM", "MARR", "DIV"]);

type GedReaders = { cite?: (n: GedNode) => SCite | undefined; parts?: (n: GedNode) => SPart[] };

function gedFacts(node: GedNode, couple?: { HUSB?: string | undefined; WIFE?: string | undefined }, read: GedReaders = {}): SFact[] {
  return cleanFacts(rawFacts(node, couple, read));
}

/** What the Strom app adds of its own: an alternative birth or death as an event, a "Birth record" beside a birth, every couple married. */
function cleanFacts(facts: SFact[]): SFact[] {
  for (const f of facts) {
    const alt = f.kind === "EVEN" && f.label ? ALTERNATIVE[fold(f.label)] : undefined;
    if (alt) {
      f.kind = alt;
      if (f.value === f.label) delete f.value;
      delete f.label;
    }
  }
  // the Strom app's entry of a birth or death (an event only to carry the people of the entry where it has no
  // baptism or burial): theirs are the birth's, the death's — or it is that birth, that death
  let out = facts;
  for (const f of facts) {
    const of = f.kind === "EVEN" && f.label ? ENTRY[fold(f.label)] : undefined;
    if (!of) continue;
    const host = facts.find((o) => o !== f && o.kind !== "EVEN" && (o.kind === of || kindOf(o.kind) === (of === "BIRT" ? "BAPM" : "BURI")));
    if (host) {
      host.parts = mergeParts(host.parts, f.parts ?? []);
      if (!host.parts.length) delete host.parts;
      out = out.filter((x) => x !== f);
    } else {
      f.kind = of;
      delete f.label;
    }
  }
  // the Strom app's "Birth record" (an event only to carry a birth's godparents): the same date and place as a fact —
  // the people it names are that fact's
  const at = (f: SFact) => `${f.date ?? ""}|${fold(f.place)}`;
  return out.filter((f) => {
    const host = f.kind === "EVEN" && (f.date || f.place) ? out.find((o) => o !== f && o.kind !== "EVEN" && at(o) === at(f)) : undefined;
    if (host) {
      if (f.parts?.length) host.parts = mergeParts(host.parts, f.parts);
      return false;
    }
    // a marriage with nothing known of it: every couple of the Strom app is "married" (its witnesses are something)
    return !(f.kind === "MARR" && !f.date && !f.place && !f.value && !f.parts?.length);
  });
}

/** Participants of two lists, each once (the same person or name in the same role). */
function mergeParts(a: SPart[] | undefined, b: SPart[]): SPart[] {
  const out = [...(a ?? [])];
  for (const p of b) if (!out.some((x) => x.role === p.role && (p.person ? x.person === p.person : fold(x.name) === fold(p.name)))) out.push(p);
  return out;
}

/**
 * The people a file's facts name, read before all its people were: "@<ref>" → their key; one the file does not have
 * (cut out of it) is named by nobody, as the Strom app leaves them out.
 */
function resolveParts(facts: SFact[], key: (ref: string) => string | undefined): void {
  for (const f of facts) {
    if (!f.parts) continue;
    const out: SPart[] = [];
    for (const p of f.parts) {
      if (!p.person?.startsWith("@")) {
        out.push(p);
        continue;
      }
      const k = key(p.person.slice(1));
      if (k) out.push({ ...p, person: k });
      else if (p.name) out.push({ role: p.role, name: p.name, ...(p.note ? { note: p.note } : {}) });
    }
    if (out.length) f.parts = mergeParts([], out);
    else delete f.parts;
  }
}

/** Words that only say someone was there (the Strom app's RELA for a role it has no name for). */
const PRESENT = new Set(["present", "other", "participant"]);

/**
 * A participant's role and note as a file gives them: its RELA, else — a role the Strom app has no name for
 * (informant, midwife: "RELA Present") — the word it puts in front of the note ("Midwife — z Kamenice").
 */
function partRole(rela: string | undefined, note: string | undefined, fallback: ParticipantRole): { role: ParticipantRole; note?: string } {
  const r = rela?.trim();
  const named = r && !PRESENT.has(foldText(r)) ? roleWord(r) : undefined;
  const text = note?.replace(/\s+/g, " ").trim();
  if (named && named !== "other") return { role: named, ...(text ? { note: text } : {}) };
  const m = text ? /^([^—–]{1,40}?)\s*(?:[—–]\s*(.*))?$/.exec(text) : null;
  const fromNote = m && m[1]!.trim().split(/\s+/).length <= 3 ? roleWord(m[1]) : undefined;
  if (fromNote) return { role: fromNote, ...(m![2]?.trim() ? { note: m![2].trim() } : {}) };
  return { role: named ?? (r && PRESENT.has(foldText(r)) ? "other" : fallback), ...(text ? { note: text } : {}) };
}

function rawFacts(node: GedNode, couple?: { HUSB?: string | undefined; WIFE?: string | undefined }, { cite, parts }: GedReaders = {}): SFact[] {
  const out: SFact[] = [];
  for (const c of node.children) {
    if (["NAME", "SEX", "REFN", "NOTE", "FAMC", "FAMS", "HUSB", "WIFE", "CHIL", "SOUR", "OBJE", "ASSO", "_STORY"].includes(c.tag)) continue;
    const kind = eventKind(c.tag);
    if (!kind) continue;
    const f: SFact = { kind };
    const date = importDate(val(c, "DATE"));
    if (date) f.date = date;
    const place = val(c, "PLAC");
    if (place) f.place = place.replace(/\s+/g, " ");
    const value = c.value.trim();
    if (value && value !== "Y") f.value = value.replace(/\s+/g, " ");
    if (kind === "EVEN") f.label = val(c, "TYPE") ?? f.value ?? "EVEN";
    // a couple's residence written as an event named so (for a Strom app before its couple's events): their residence
    if (couple && kind === "EVEN" && COUPLE_RESIDENCE.has(fold(f.label))) {
      f.kind = "RESI";
      delete f.label;
    }
    details(f, val(c, "CAUS"), couple ? undefined : val(c, "AGE"), val(c, "ADDR"));
    if (couple)
      for (const role of ["HUSB", "WIFE"] as const) {
        const who = couple[role];
        const age = val(c.children.find((x) => x.tag === role), "AGE");
        const a = who && age?.trim() ? normalizeAge(age) : undefined;
        if (a) f.ages = { ...f.ages, [who!]: a };
      }
    const id = val(c, "_EID");
    if (id) f.id = id;
    const cites = cite ? children(c, "SOUR").map(cite).filter((x): x is SCite => !!x) : [];
    if (cites.length) f.cites = cites;
    const named = parts ? parts(c) : [];
    if (named.length) f.parts = named;
    out.push(f);
  }
  return out;
}

/** A fact's cause, age and house as the file has them, in the research's form (an age it cannot read: none). */
function details(f: SFact, cause: string | undefined, age: string | undefined, house: string | undefined): void {
  const c = cause?.replace(/\s+/g, " ").trim();
  if (c) f.cause = c;
  const a = age?.trim() ? normalizeAge(age) : undefined;
  if (a) f.age = a;
  const h = house?.trim() ? houseOf(house) : "";
  if (h) f.house = h;
}

/** The details of a fact the research compares, besides the partners' ages. */
const DETAILS = ["cause", "age", "house"] as const;

/** A couple's residence as an event of that name (the export's label in any language). */
const COUPLE_RESIDENCE = new Set(["en", "cs", "de", "pl", "sk"].map((l) => fold(labels(l)("RESI"))));

/** What a fact says besides, one entry each: cause, age, house, and "ages:<key>" for a partner's age. */
function detailsOf(f: { cause?: string | undefined; age?: string | undefined; house?: string | undefined; ages?: Record<string, string> | undefined }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of DETAILS) if (f[d]) out[d] = f[d]!;
  for (const [who, a] of Object.entries(f.ages ?? {})) if (a) out[`ages:${who}`] = a;
  return out;
}

/** Every note under a record, its facts' and citations' too, as one text. */
function allNotes(n: GedNode, noteText: (n: GedNode) => string): string {
  const out: string[] = [];
  const walk = (x: GedNode) => {
    for (const c of x.children) {
      if (c.tag === "NOTE" || c.tag === "TEXT" || c.tag === "PAGE" || c.tag === "PLAC" || c.tag === "ADDR") out.push(c.tag === "NOTE" ? noteText(c) : c.value);
      walk(c);
    }
  };
  walk(n);
  return out.join("\n");
}

/** Words of a text, folded; numbers too (house numbers, years). */
const wordsOf = (t: string) => foldText(t).match(/[\p{L}\p{M}\p{N}]{2,}/gu) ?? [];

/**
 * A note the research has said already, folded into another shape by the app ("Birth: Address: čp. 35 …" of a
 * fact's notes): hardly a word of it that the research has not.
 */
function knownNote(text: string, said: Set<string>): boolean {
  const w = new Set(wordsOf(text));
  const unknown = [...w].filter((x) => !said.has(x));
  // a word or two of the app's own ("Birth:", "Address:") around what the research said — never a short note all new
  return unknown.length <= w.size * 0.2 || (unknown.length < 3 && unknown.length * 2 <= w.size);
}

/**
 * A tree the Strom app sent the bridge, with the version the app said with it (X-Strom-App-Version, ?app=) as its HEAD's
 * 2 VERS under 1 SOUR STROM, where the file names no version of the app (the app writes "1.0" there): the file is read
 * as the app that wrote it means it ("? /Unknown/" before 3.10.0-beta.7: no surname; T08b). A version of the app the
 * file says, another program's file, or no version said: as it came.
 */
export function stampAppVersion(text: string, version: string | undefined): string {
  if (!version || !isAppVersion(version)) return text;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const next = lines.findIndex((l, i) => i > 0 && /^\s*0\s/.test(l));
  const end = next < 0 ? lines.length : next;
  const sour = lines.findIndex((l, i) => i < end && /^\s*1\s+SOUR\s+STROM\s*$/.test(l));
  if (sour < 0) return text;
  for (let i = sour + 1; i < end && /^\s*(?:[2-9]|\d{2,})\s/.test(lines[i]!); i++) {
    const vers = /^\s*2\s+VERS(?:\s+(.*))?$/.exec(lines[i]!);
    if (!vers) continue;
    if (isAppVersion((vers[1] ?? "").trim())) return text;
    lines[i] = `2 VERS ${version}`;
    return lines.join(eol);
  }
  lines.splice(sour + 1, 0, `2 VERS ${version}`);
  return lines.join(eol);
}

/** A GEDCOM file (or one of ours, in memory) as a snapshot; an unreadable one throws. */
export function readGedcom(text: string): Snapshot {
  const { records, problems } = parseGedcomText(text);
  const head = records.find((r) => r.tag === "HEAD");
  /** A file of the Strom app (its HEAD: 1 SOUR STROM): its own ways of writing are read as it means them. */
  const fromApp = stromAppFile(head);
  const notes = new Map(records.filter((r) => r.tag === "NOTE" && r.xref).map((r) => [r.xref!, r.value]));
  const noteText = (n: GedNode) => (/^@[^@]+@$/.test(n.value.trim()) ? (notes.get(n.value.trim()) ?? "") : n.value);
  // the sources: ours by their REFN, the file's own by their xref
  const sources = new Map<string, SSource>();
  const sourceKeys = new Map<string, string>();
  const repoNames = new Map(records.filter((r) => r.tag === "REPO" && r.xref).map((r) => [r.xref!, val(r, "NAME")?.trim() ?? ""]));
  for (const r of records.filter((x) => x.tag === "SOUR" && x.xref)) {
    const refn = val(r, "REFN")?.trim();
    const key = refn && OUR_SOURCE.test(refn) && !sources.has(refn) ? refn : `x:${r.xref!.replace(/@/g, "")}`;
    sourceKeys.set(r.xref!, key);
    const repo = r.children.find((c) => c.tag === "REPO");
    const repoName = repo ? (/^@[^@]+@$/.test(repo.value.trim()) ? repoNames.get(repo.value.trim()) : repo.value.trim()) || val(repo, "NAME") : undefined;
    const text = r.children.find((c) => c.tag === "TEXT");
    const page = val(r, "PAGE")?.trim();
    const url = val(r, "WWW")?.trim();
    const note = children(r, "NOTE").map(noteText).map((t) => t.trim()).filter(Boolean).join("\n\n");
    sources.set(key, {
      key,
      title: (val(r, "TITL") ?? "").replace(/\s+/g, " ").trim(),
      ...(repoName?.trim() ? { repo: repoName.trim() } : {}),
      ...(page ? { page } : {}),
      ...(text?.value.trim() ? { text: text.value.trim() } : {}),
      ...(url ? { url } : {}),
      ...(note ? { note } : {}),
      ...(/^y(es)?$/i.test(val(r, "_STROM_VERIFIED")?.trim() ?? "") ? { verified: true } : {}),
    });
  }
  const cite = (n: GedNode): SCite | undefined => {
    const key = sourceKeys.get(n.value.trim());
    if (!key) return undefined;
    const page = val(n, "PAGE")?.trim();
    const date = importDate(val(n.children.find((c) => c.tag === "DATA"), "DATE"));
    const q = Number.parseInt(val(n, "QUAY") ?? "", 10);
    return { source: key, ...(page ? { page } : {}), ...(date ? { date } : {}), ...(q >= 0 && q <= 3 ? { quay: q } : {}) };
  };
  // who else a record names at a fact: a person of the file (resolved to their key once all are read), or a name
  const partsOf = (c: GedNode): SPart[] => {
    const out: SPart[] = [];
    for (const n of c.children) {
      if (n.tag !== "ASSO" && n.tag !== "_WITN" && n.tag !== "WITN") continue;
      const v = n.value.replace(/\s+/g, " ").trim();
      if (!v) continue;
      const { role, note } = partRole(val(n, "RELA"), children(n, "NOTE").map(noteText).join(" "), n.tag === "ASSO" ? "other" : "witness");
      out.push({ role, ...(n.tag === "ASSO" ? { person: `@${v.replace(/@/g, "")}` } : { name: v }), ...(note ? { note } : {}) });
    }
    return out;
  };
  const read = { cite, parts: partsOf };
  const keys = new Map<string, string>();
  const persons = new Map<string, SPerson>();
  for (const r of records.filter((x) => x.tag === "INDI" && x.xref)) {
    const refn = r.children.find((c) => c.tag === "REFN");
    const type = refn ? val(refn, "TYPE") : undefined;
    const ours = refn && OUR_ID.test(refn.value.trim()) && (!type || type === REFN_TYPE) ? refn.value.trim() : undefined;
    const key = ours && !persons.has(ours) ? ours : `x:${r.xref!.replace(/@/g, "")}`;
    keys.set(r.xref!, key);
    const sex = val(r, "SEX");
    // each NAME read as strom intake reads it (readGedName): its parts (GIVN, SURN) first, the line's surname after the
    // given name where it has no slashes (N11), the titles apart; a person of no name and no surname the Strom app
    // writes "? //" (its stand-in for an unknown parent: "//", nobody) — and "? /Unknown/" before its 3.10.0-beta.7 (or
    // a file that says no version of it): a person, of no surname; from it on "? /Unknown/" is the surname Unknown (T08b)
    const named = children(r, "NAME")
      .map((n) => ({ n, ...readGedName(n, fromApp) }))
      .filter(({ n, nameless }) => nameless || [n.value, val(n, "GIVN") ?? "", val(n, "SURN") ?? ""].join("").replace(/[/?\s]/g, ""));
    // the titles of the name they are shown by (NPFX / NSFX) apart from it: the line says them too, taken off it (the
    // other names keep theirs in the line, as the Strom app keeps them)
    const titles = named[0] ? titlesFrom(named[0].name.prefix, named[0].name.suffix) : undefined;
    // (the research's own person: no name at all, as the research writes it — never another name, never a rename);
    // what stands for no name ("N/A /Chrpa/", "N.N.") is the research's "?" (T08)
    const names = named
      .filter(({ nameless }) => !(ours && nameless))
      .map(({ name, nameless }, i) => (nameless ? "? //" : gedcomTitledName(i === 0 && titles ? { given: name.given, surname: name.surname } : name)));
    // a placeholder of the Strom app (an unknown parent drawn in the tree): nobody
    if (!ours && !names.length) continue;
    const facts = gedFacts(r, undefined, read);
    // a godparent other programs give the person (1 ASSO): theirs at the baptism, else the birth
    const host = facts.find((f) => kindOf(f.kind) === "BAPM") ?? facts.find((f) => f.kind === "BIRT");
    for (const a of children(r, "ASSO")) {
      const { role, note } = partRole(val(a, "RELA"), children(a, "NOTE").map(noteText).join(" "), "other");
      if (role === "godparent" && host && a.value.trim()) host.parts = mergeParts(host.parts, [{ role, person: `@${a.value.trim().replace(/@/g, "")}`, ...(note ? { note } : {}) }]);
    }
    // the sources of the person: the Strom app's (1 SOUR), the research's of their names
    const cites = [...children(r, "SOUR"), ...children(r, "NAME").flatMap((n) => children(n, "SOUR"))].map(cite).filter((x): x is SCite => !!x);
    persons.set(key, {
      key,
      names,
      ...(sex === "M" || sex === "F" ? { sex } : {}),
      facts,
      notes: children(r, "NOTE").map(noteText).map((t) => t.trim()).filter(Boolean),
      said: allNotes(r, noteText),
      ...(cites.length ? { cites } : {}),
      ...(titles ? { titles } : {}),
    });
  }
  // how a child belongs to a family (the child's FAMC + PEDI: adopted, foster, step): none said is birth
  const pedi = new Map<string, string>();
  for (const r of records.filter((x) => x.tag === "INDI" && x.xref && keys.has(x.xref)))
    for (const l of children(r, "FAMC")) {
      const rel = val(l, "PEDI")?.trim().toLowerCase();
      if (rel === "adopted" || rel === "foster" || rel === "step") pedi.set(`${l.value.trim()}|${keys.get(r.xref!)}`, rel);
    }
  const families: SFamily[] = [];
  for (const r of records.filter((x) => x.tag === "FAM")) {
    const who = (tag: string) => children(r, tag).map((c) => keys.get(c.value.trim())).filter((k): k is string => !!k && persons.has(k));
    const cites = children(r, "SOUR").map(cite).filter((x): x is SCite => !!x);
    const notes = children(r, "NOTE").map(noteText).map((t) => t.trim()).filter(Boolean);
    const [husb, wife] = [who("HUSB")[0], who("WIFE")[0]];
    const ties: Ties = {};
    // the child's tie to each parent: _FREL (the husband), _MREL (the wife) — Legacy, RootsMagic, FTM, the Strom app (a
    // stepchild: PEDI has no word for it) — over the PEDI that speaks for both
    for (const c of children(r, "CHIL")) {
      const k = keys.get(c.value.trim());
      if (!k || !persons.has(k)) continue;
      const both = pedi.get(`${r.xref}|${k}`) ?? "birth";
      const by: Record<string, string> = {};
      for (const [parent, tag] of [[husb, "_FREL"], [wife, "_MREL"]] as const) {
        if (!parent) continue;
        const said = val(c, tag)?.trim();
        const rel = childRelation(said);
        if (said && !rel) (ties.relationsUnknown ??= {})[k] = [...(ties.relationsUnknown[k] ?? []), said];
        by[parent] = rel ?? both;
      }
      settleTie(ties, k, by, both);
    }
    const partners = [...who("HUSB"), ...who("WIFE")];
    for (const k of who("HUSB")) persons.get(k)!.husb = true;
    const union = unionOf(unionOfStat(val(r, "_STAT")), partners.length === 1, children(r, "MARR").length > 0, children(r, "DIV").length > 0);
    families.push({
      ...(r.xref ? { xref: r.xref.replace(/@/g, "") } : {}),
      partners,
      children: who("CHIL"),
      ...ties,
      ...(val(r, "_STROM_NO_COUPLE")?.trim().toUpperCase() === "Y" ? { noCouple: true as const } : {}),
      ...(union ? { union } : {}),
      facts: gedFacts(r, { HUSB: who("HUSB")[0], WIFE: who("WIFE")[0] }, read),
      ...(cites.length ? { cites } : {}),
      ...(notes.length ? { notes } : {}),
      said: allNotes(r, noteText),
    });
  }
  resolveParts([...persons.values()].flatMap((p) => p.facts).concat(families.flatMap((f) => f.facts)), (ref) => {
    const k = keys.get(`@${ref}@`);
    return k && persons.has(k) ? k : undefined;
  });
  citedDetails(sources, [...persons.values()].flatMap((p) => p.facts).concat(families.flatMap((f) => f.facts)));
  const treeId = val(head, "_STROM_TREE");
  const at = val(head, "_STROM_HEAD");
  const transcripts = val(head, "_STROM_TRANSCRIPTS")?.trim().toLowerCase() === "evidence" ? "evidence" : "lead";
  const sexU = val(head, "_STROM_SEX_U")?.trim().toUpperCase() === "Y";
  const appTree = val(head, "_STROM_APP_TREE")?.trim();
  const since = val(head, "_STROM_SINCE")?.trim();
  const again = val(head, "_STROM_AGAIN")?.trim();
  return {
    format: "gedcom",
    ...(treeId ? { treeId } : {}),
    ...(at ? { head: at } : {}),
    persons,
    families,
    places: gedPlaces(records),
    sources,
    transcripts,
    ...(sexU ? { sexU: true as const } : {}),
    ...(appTree && SEND_MARK.test(appTree) ? { appTree } : {}),
    ...(since && /^R\d{17}-[0-9a-f]{4}$/.test(since) ? { since } : {}),
    ...(again && /^R\d{17}-[0-9a-f]{4}$/.test(again) ? { again } : {}),
    problems,
  };
}

/** A source's page where it has none of its own (the research's export: its citations'), when written, its quality: from the first citation. */
function citedDetails(sources: Map<string, SSource>, facts: SFact[]): void {
  for (const f of facts)
    for (const c of f.cites ?? []) {
      const s = sources.get(c.source);
      if (!s) continue;
      if (!s.page && c.page) s.page = c.page;
      if (!s.date && c.date) s.date = c.date;
      if (s.quay === undefined && c.quay !== undefined) s.quay = c.quay;
    }
}

/** The Strom app's life events → our kinds. */
const APP_EVENTS: Record<string, string> = {
  birth: "BIRT", death: "DEAT", baptism: "BAPM", burial: "BURI", occupation: "OCCU", residence: "RESI", military: "MILI",
  emigration: "EMIG", immigration: "IMMI", education: "EDUC", religion: "RELI", custom: "EVEN", confirmation: "CONF",
  firstCommunion: "FCOM", barMitzvah: "BARM", batMitzvah: "BASM", ordination: "ORDN", adoption: "ADOP", naturalization: "NATU",
  will: "WILL", probate: "PROB", title: "TITL", nationality: "NATI", cremation: "CREM",
};

/** The Strom app's events of a couple (its 3.8) → GEDCOM tags. */
const APP_COUPLE_EVENTS: Record<string, string> = {
  engagement: "ENGA", banns: "MARB", marriageLicence: "MARL", marriageContract: "MARC", marriageSettlement: "MARS",
  residence: "RESI", census: "CENS", divorceFiled: "DIVF", annulment: "ANUL", custom: "EVEN",
};

/** Facts whose value is what they are (the GEDCOM tag's value). */
const VALUE_KINDS = new Set(["OCCU", "RELI", "TITL", "NATI"]);

interface AppPerson {
  id: string;
  /** The person's parents (both of a couple's child; one where the other is not known — the app's beta.39 sends it). */
  parentIds?: string[];
  /** The child's tie to a parent who is not their own: the parent's id → adoptive, step, foster. */
  parentRelTypes?: Record<string, string>;
  firstName?: string;
  lastName?: string;
  gender?: string;
  /** The research's unknown sex standing (with `research.sexU`): its `gender` only the app's stand-in. */
  sexUnknown?: boolean;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  notes?: string;
  refn?: string;
  refnType?: string;
  isPlaceholder?: boolean;
  nameVariants?: string[];
  birthAddress?: string;
  deathCause?: string;
  deathAge?: string;
  deathAddress?: string;
  birthSourceIds?: string[];
  deathSourceIds?: string[];
  /** The sources of the person themselves. */
  sourceIds?: string[];
  /** The titles of the name (the app's 3.10): "Ing.", "ml.". */
  titleBefore?: string;
  titleAfter?: string;
  events?: { type: string; customLabel?: string; date?: string; place?: string; note?: string; cause?: string; age?: string; address?: string; sourceIds?: string[]; participants?: AppParticipant[] }[];
}
/** Someone at an event of the Strom app: a person of its tree, or a name as the register writes it. */
interface AppParticipant {
  role?: string;
  personId?: string;
  name?: string;
  note?: string;
}
/** A source of the Strom app (one entry of a register; a whole book in older trees). */
interface AppSource {
  id?: string;
  title?: string;
  repository?: string;
  reference?: string;
  url?: string;
  note?: string;
  quality?: number;
  transcript?: string;
  recordDate?: string;
  refn?: string;
  transcriptVerified?: boolean;
}
interface AppPartnership {
  person1Id?: string;
  person2Id?: string;
  childIds?: string[];
  status?: string;
  startDate?: string;
  startPlace?: string;
  endDate?: string;
  endPlace?: string;
  address?: string;
  /** The partners' ages at the wedding: the app's person id → age (3.7). */
  ages?: Record<string, string>;
  /** The couple's other events (the app's 3.8, data version 10). */
  events?: { type: string; customLabel?: string; date?: string; place?: string; note?: string; cause?: string; address?: string; ages?: Record<string, string>; sourceIds?: string[]; participants?: AppParticipant[] }[];
  /** The witnesses at the wedding (the app's data version 6). */
  participants?: AppParticipant[];
  /** The sources of the union (its marriage record and the like; the app's 3.9 writes them under MARR). */
  sourceIds?: string[];
  /** The couple's one note (its GEDCOM: 1 NOTE under FAM). */
  note?: string;
}

/** A tree of the Strom app (its JSON) as a snapshot. */
export function readStromJson(data: unknown): Snapshot {
  const d = data as { persons?: Record<string, AppPerson>; partnerships?: Record<string, AppPartnership>; places?: Record<string, { lat?: unknown; lon?: unknown }>; sources?: Record<string, AppSource>; research?: { id?: string; head?: string; transcripts?: string; sexU?: unknown } };
  if (!d || typeof d !== "object" || !d.persons || typeof d.persons !== "object") throw new UsageError("not a family tree of the Strom app: no persons in it", { code: "tree.unreadable" });
  // the sources: ours by their REFN, the app's own by its ID; a citation takes the entry's page, date and quality
  const sources = new Map<string, SSource>();
  const sourceKeys = new Map<string, string>();
  for (const [id, a] of Object.entries(d.sources && typeof d.sources === "object" ? d.sources : {})) {
    if (!a || typeof a !== "object") continue;
    const refn = typeof a.refn === "string" ? a.refn.trim() : "";
    const key = OUR_SOURCE.test(refn) && !sources.has(refn) ? refn : `x:${a.id ?? id}`;
    sourceKeys.set(a.id ?? id, key);
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const date = fromFlexDate(str(a.recordDate));
    const q = typeof a.quality === "number" && a.quality >= 0 && a.quality <= 3 ? Math.round(a.quality) : undefined;
    sources.set(key, {
      key,
      title: (str(a.title) ?? "").replace(/\s+/g, " "),
      ...(str(a.repository) ? { repo: str(a.repository)! } : {}),
      ...(str(a.reference) ? { page: str(a.reference)! } : {}),
      ...(str(a.transcript) ? { text: str(a.transcript)! } : {}),
      ...(date ? { date } : {}),
      ...(str(a.url) ? { url: str(a.url)! } : {}),
      ...(str(a.note) ? { note: str(a.note)! } : {}),
      ...(q !== undefined ? { quay: q } : {}),
      ...(a.transcriptVerified === true ? { verified: true } : {}),
    });
  }
  const citesOf = (ids: unknown): SCite[] | undefined => {
    const out = (Array.isArray(ids) ? ids : [])
      .map((x) => (typeof x === "string" ? sourceKeys.get(x) : undefined))
      .filter((k): k is string => !!k)
      .map((k) => {
        const s = sources.get(k)!;
        return { source: k, ...(s.page ? { page: s.page } : {}), ...(s.date ? { date: s.date } : {}), ...(s.quay !== undefined ? { quay: s.quay } : {}) };
      });
    return out.length ? out : undefined;
  };
  // who else is at an event: a person of the app's tree (resolved to their key once all are read), or a name
  const partsOf = (list: unknown): SPart[] | undefined => {
    const out: SPart[] = [];
    for (const x of Array.isArray(list) ? (list as AppParticipant[]) : []) {
      if (!x || typeof x !== "object") continue;
      const name = typeof x.name === "string" ? x.name.replace(/\s+/g, " ").trim() : "";
      const id = typeof x.personId === "string" ? x.personId : "";
      if (!id && !name) continue;
      const { role, note } = partRole(typeof x.role === "string" ? x.role : undefined, typeof x.note === "string" ? x.note : undefined, "other");
      out.push({ role, ...(id ? { person: `@${id}` } : {}), ...(name ? { name } : {}), ...(note ? { note } : {}) });
    }
    return out.length ? out : undefined;
  };
  const keys = new Map<string, string>();
  const persons = new Map<string, SPerson>();
  for (const p of Object.values(d.persons)) {
    // a placeholder of the Strom app (an unknown parent drawn in the tree): nobody
    if (!p?.id || p.isPlaceholder) continue;
    const refn = p.refn?.trim();
    const key = refn && OUR_ID.test(refn) && (!p.refnType || p.refnType === REFN_TYPE) && !persons.has(refn) ? refn : `x:${p.id}`;
    keys.set(p.id, key);
    const facts: SFact[] = [];
    const fact = (kind: string, date?: string, place?: string, label?: string, value?: string, more: { cause?: string | undefined; age?: string | undefined; house?: string | undefined; sourceIds?: unknown; participants?: unknown } = {}) => {
      const f: SFact = { kind };
      const cites = citesOf(more.sourceIds);
      if (cites) f.cites = cites;
      const parts = partsOf(more.participants);
      if (parts) f.parts = parts;
      const g = fromFlexDate(date);
      if (g) f.date = g;
      if (place?.trim()) f.place = place.trim().replace(/\s+/g, " ");
      if (label) f.label = label;
      if (value?.trim()) f.value = value.trim().replace(/\s+/g, " ");
      details(f, more.cause, more.age, more.house);
      if (f.date || f.place || label || kind !== "EVEN") facts.push(f);
    };
    if (p.birthDate || p.birthPlace || p.birthAddress) fact("BIRT", p.birthDate, p.birthPlace, undefined, undefined, { house: p.birthAddress, sourceIds: p.birthSourceIds });
    if (p.deathDate || p.deathPlace || p.deathCause || p.deathAge || p.deathAddress)
      fact("DEAT", p.deathDate, p.deathPlace, undefined, undefined, { cause: p.deathCause, age: p.deathAge, house: p.deathAddress, sourceIds: p.deathSourceIds });
    for (const e of p.events ?? []) {
      const kind = APP_EVENTS[e.type];
      if (!kind || ((kind === "BIRT" || kind === "DEAT") && facts.some((f) => f.kind === kind))) continue;
      // an occupation, a religion, a title: the app keeps what it is as the event's note (its first line)
      const value = VALUE_KINDS.has(kind) ? e.note?.split("\n")[0] : undefined;
      fact(kind === "MILI" ? "EVEN" : kind, e.date, e.place, kind === "EVEN" ? e.customLabel || "EVEN" : undefined, value, { cause: e.cause, age: e.age, house: e.address, sourceIds: e.sourceIds, participants: e.participants });
    }
    const name = `${p.firstName ?? ""} /${p.lastName ?? ""}/`.trim();
    if (!key.startsWith("P") && !`${p.firstName ?? ""}${p.lastName ?? ""}`.replace(/[?\s]/g, "")) {
      keys.delete(p.id);
      continue;
    }
    const cites = citesOf(p.sourceIds);
    const titles = titlesFrom(p.titleBefore, p.titleAfter);
    persons.set(key, {
      key,
      ...(titles ? { titles } : {}),
      names: [name, ...(p.nameVariants ?? [])].filter((n) => n.replace(/[/?\s]/g, "")),
      ...(d.research?.sexU === true && p.sexUnknown ? {} : p.gender === "male" ? { sex: "M" } : p.gender === "female" ? { sex: "F" } : {}),
      facts: cleanFacts(facts),
      notes: p.notes?.trim() ? [p.notes.trim()] : [],
      said: p.notes ?? "",
      ...(cites ? { cites } : {}),
    });
  }
  // a partner's age by the app's person id → by the person's key
  const partnersAges = (ages: Record<string, string> | undefined): Record<string, string> | undefined => {
    const out: Record<string, string> = {};
    for (const [id, raw] of Object.entries(ages ?? {})) {
      const key = keys.get(id);
      const a = key && typeof raw === "string" && raw.trim() ? normalizeAge(raw) : undefined;
      if (key && a) out[key] = a;
    }
    return Object.keys(out).length ? out : undefined;
  };
  /** The children's ties to each of their parents, as the app keeps them on the child (parentRelTypes). */
  const appTies = (kids: string[], parents: (string | undefined)[]): Ties => {
    const ties: Ties = {};
    for (const c of kids) {
      const p = d.persons?.[c];
      const k = keys.get(c);
      if (!p || !k) continue;
      const by: Record<string, string> = {};
      for (const parent of parents) {
        const pk = parent ? keys.get(parent) : undefined;
        if (!parent || !pk) continue;
        const said = p.parentRelTypes?.[parent];
        const rel = childRelation(said);
        if (said && !rel) (ties.relationsUnknown ??= {})[k] = [...(ties.relationsUnknown[k] ?? []), said];
        by[pk] = rel ?? "birth";
      }
      settleTie(ties, k, by, "birth");
    }
    return ties;
  };
  const families: SFamily[] = [];
  for (const u of Object.values(d.partnerships ?? {})) {
    const partners = [u.person1Id, u.person2Id].map((x) => (x ? keys.get(x) : undefined)).filter((k): k is string => !!k);
    const facts: SFact[] = [];
    if ((u.status === "married" || u.status === "divorced") && (u.startDate || u.startPlace || u.participants?.length)) {
      const f: SFact = { kind: "MARR" };
      const g = fromFlexDate(u.startDate);
      if (g) f.date = g;
      if (u.startPlace?.trim()) f.place = u.startPlace.trim();
      details(f, undefined, undefined, u.address);
      const ages = partnersAges(u.ages);
      if (ages) f.ages = ages;
      // the union's sources: the app gives them under its marriage (what the family itself cites is no news, newCites)
      const cites = citesOf(u.sourceIds);
      if (cites) f.cites = cites;
      const parts = partsOf(u.participants);
      if (parts) f.parts = parts;
      facts.push(f);
    }
    // the couple's other events (the app's 3.8)
    for (const e of u.events ?? []) {
      const kind = APP_COUPLE_EVENTS[e.type];
      if (!kind) continue;
      const f: SFact = { kind };
      const g = fromFlexDate(e.date);
      if (g) f.date = g;
      if (e.place?.trim()) f.place = e.place.trim().replace(/\s+/g, " ");
      if (kind === "EVEN") f.label = e.customLabel || "EVEN";
      details(f, e.cause, undefined, e.address);
      const ages = partnersAges(e.ages);
      if (ages) f.ages = ages;
      const cites = citesOf(e.sourceIds);
      if (cites) f.cites = cites;
      const parts = partsOf(e.participants);
      if (parts) f.parts = parts;
      if (f.date || f.place || f.label || kind !== "EVEN") facts.push(f);
    }
    // the divorce (the app's 3.7 keeps its place too)
    if (u.status === "divorced" && (u.endDate || u.endPlace)) {
      const f: SFact = { kind: "DIV" };
      const g = fromFlexDate(u.endDate);
      if (g) f.date = g;
      if (u.endPlace?.trim()) f.place = u.endPlace.trim();
      facts.push(f);
    }
    // without a marriage the union's sources are the family's own (a child's parents)
    const cites = facts.some((f) => f.kind === "MARR") ? undefined : citesOf(u.sourceIds);
    const note = typeof u.note === "string" && u.note.trim() ? u.note.trim() : undefined;
    const kids = (u.childIds ?? []).filter((c) => keys.has(c));
    // the app's "?" is nobody: one partner alone — married to somebody unknown
    const said = UNIONS.includes(u.status as Union) ? (u.status as Union) : undefined;
    // the app's every partnership is married unless said otherwise: one child's "?" so is only the child's one parent
    // known (its GEDCOM gives it no MARR either), the "?" of brothers and sisters or one with no child the partner's union
    const union = partners.length === 1 && kids.length === 1 && said === "married" ? undefined : unionOf(said, partners.length === 1, said === "married", said === "divorced");
    families.push({ partners, children: kids.map((c) => keys.get(c)!), ...appTies(kids, [u.person1Id, u.person2Id]), facts, ...(cites ? { cites } : {}), ...(note ? { notes: [note] } : {}), said: note ?? "", ...(union ? { union } : {}) });
  }
  // a child of one parent (no couple of the app holds the tie): a family of that parent
  const held = new Set(Object.values(d.partnerships ?? {}).flatMap((u) => (u.childIds ?? []).flatMap((c) => [u.person1Id, u.person2Id].filter(Boolean).map((p) => `${p}|${c}`))));
  const alone = new Map<string, SFamily>();
  for (const p of Object.values(d.persons)) {
    const child = keys.get(p.id);
    const parents = (p.parentIds ?? []).filter((x) => !held.has(`${x}|${p.id}`)).map((x) => keys.get(x)).filter((k): k is string => !!k && persons.has(k));
    if (!child || !persons.has(child) || !parents.length) continue;
    const k = famKey(parents);
    const f = alone.get(k) ?? alone.set(k, { partners: parents, children: [], facts: [], said: "" }).get(k)!;
    f.children.push(child);
    const ties = appTies([p.id], (p.parentIds ?? []).filter((x) => !held.has(`${x}|${p.id}`)));
    if (ties.relations) f.relations = { ...f.relations, ...ties.relations };
    if (ties.relationsBy) f.relationsBy = { ...f.relationsBy, ...ties.relationsBy };
  }
  families.push(...alone.values());
  resolveParts([...persons.values()].flatMap((p) => p.facts).concat(families.flatMap((f) => f.facts)), (ref) => {
    const k = keys.get(ref);
    return k && persons.has(k) ? k : undefined;
  });
  // the app's coordinates are kept for the place's name (its placeKey): the names are its facts'
  const places = new Map<string, SPlace>();
  const geo = d.places && typeof d.places === "object" ? d.places : {};
  for (const f of [...persons.values()].flatMap((p) => p.facts).concat(families.flatMap((x) => x.facts))) {
    const k = f.place ? placeKey(f.place) : "";
    const g = f.place ? geo[appPlaceKey(f.place)] : undefined;
    if (!g || places.has(k) || typeof g.lat !== "number" || typeof g.lon !== "number") continue;
    if (Math.abs(g.lat) <= 90 && Math.abs(g.lon) <= 180) places.set(k, { name: f.place!, lat: g.lat, lon: g.lon });
  }
  const r = d.research;
  const transcripts = r?.transcripts === "evidence" ? "evidence" : "lead";
  return { format: "strom-json", ...(r?.id ? { treeId: r.id } : {}), ...(r?.head ? { head: r.head } : {}), persons, families, places, sources, transcripts, ...(r?.sexU === true ? { sexU: true as const } : {}), problems: [] };
}

/** A file coming back: GEDCOM or the Strom app's JSON; empty or unreadable throws. */
export function readTreeFile(file: string): Snapshot {
  const text = fs.readFileSync(file, "utf8");
  if (!text.trim()) throw new UsageError(`${path.basename(file)} is empty`, { code: "tree.empty", params: { file: path.basename(file) } });
  let snap: Snapshot;
  if (/^﻿?\s*[{[]/.test(text)) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new UsageError(`${path.basename(file)} is not readable JSON: ${(e as Error).message}`, { code: "tree.unreadable", params: { file: path.basename(file) } });
    }
    snap = readStromJson(data);
  } else if (/^﻿?\s*0\s+HEAD/m.test(text)) snap = readGedcom(text);
  else throw new UsageError(`${path.basename(file)} is neither a GEDCOM file nor a family tree of the Strom app`, { code: "tree.unreadable", params: { file: path.basename(file) } });
  if (!snap.persons.size) throw new UsageError(`${path.basename(file)} has no people in it`, { hint: "a file exported from the Strom app or another family-tree program", code: "tree.empty", params: { file: path.basename(file) } });
  return snap;
}

/** How a family's children are tied to its parents, as a snapshot keeps it. */
type Ties = Pick<SFamily, "relations" | "relationsBy" | "relationsUnknown">;

/** A child's tie to a parent in the research's words (_FREL/_MREL, PEDI, the app's parentRelTypes); a word it has none for: undefined. */
function childRelation(said: string | undefined): string | undefined {
  switch ((said ?? "").trim().toLowerCase()) {
    case "natural": case "birth": case "biological":
      return "birth";
    case "adopted": case "adoptive":
      return "adopted";
    case "step":
      return "step";
    case "foster":
      return "foster";
    case "unknown":
      return "unknown";
    default:
      return undefined;
  }
}

/** A child's ties to each parent: one for both (none said: birth), else each its own. */
function settleTie(ties: Ties, child: string, by: Record<string, string>, both: string): void {
  const all = [...new Set(Object.values(by))];
  const one = all.length ? (all.length === 1 ? all[0] : undefined) : both;
  if (one) {
    if (one !== "birth") (ties.relations ??= {})[child] = one;
  } else (ties.relationsBy ??= {})[child] = by;
}

/** A child's tie to one parent of a family as a snapshot has it (none said: birth). */
const tieOf = (f: SFamily, child: string, parent: string) => f.relationsBy?.[child]?.[parent] ?? f.relations?.[child] ?? "birth";

/** Our records as the app is given them: the export for it, read like any file — with the facts' IDs. */
export function snapshotOfTree(tree: Tree): Snapshot {
  return readGedcom(exportGedcom(tree, { for: "strom", ids: true, titles: true }).text);
}

/** The folders of data/ the export for the app reads. */
const EXPORTED = ["persons", "families", "sources", "repositories", "places", "recordsets"];

/** The research at a commit, as it was given the app — undefined when the history does not have it. */
export function snapshotAt(tree: Tree, head: string): Snapshot | undefined {
  if (!/^[0-9a-f]{7,64}$/i.test(head)) return undefined;
  if (git.runGit(tree.root, ["cat-file", "-e", `${head}^{commit}`]).status !== 0) return undefined;
  // the research as it is now, when that is the state the app was given (most sends): read as it is, not rebuilt from
  // the history (a tree of 2 200 people: 4 s of a send's 7)
  const now = git.head(tree.root);
  if (now && now.startsWith(head.toLowerCase()) && git.changes(tree.root, [...EXPORTED.map((d) => `data/${d}`), "strom.json"]).length === 0) return snapshotOfTree(tree);
  // a commit never changes: made once a process (a send with sends taken back since compares each of them too)
  const key = `${tree.root}\u0000${head.toLowerCase()}`;
  const known = AT.get(key);
  if (known) return structuredClone(known);
  const made = rebuiltAt(tree, head);
  if (made) {
    AT.set(key, structuredClone(made));
    if (AT.size > 4) AT.delete(AT.keys().next().value!);
  }
  return made;
}

/** The research at commits of its history, rebuilt (the last few). */
const AT = new Map<string, Snapshot>();

function rebuiltAt(tree: Tree, head: string, only?: Set<string>): Snapshot | undefined {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-sync-"));
  try {
    const config = git.showFile(tree.root, head, "strom.json");
    if (!config) return undefined;
    fs.writeFileSync(path.join(dir, "strom.json"), config);
    // what the export reads: not the images, tasks, sessions … of the research; `only`: these people's own facts (no families)
    const files = (only ? EXPORTED.filter((d) => d !== "persons" && d !== "families") : EXPORTED)
      .flatMap((d) => git.listFiles(tree.root, head, `data/${d}`))
      .concat(only ? [...only].map((id) => `data/persons/${id}.json`) : [], "data/_counters.json");
    for (const [file, text] of git.showFiles(tree.root, head, files)) {
      if (text === undefined) continue;
      fs.mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), text);
    }
    return snapshotOfTree(Tree.open(dir, tree.env));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── from the Strom app, through the bridge ──────────────────────────────────

/** Where the trees the Strom app sends wait, in the tree folder but outside its data (never committed). */
export const SYNC_INBOX = path.join(".strom", "sync");

/** At most so large a tree the bridge takes (a GEDCOM with images of every entry is tens of MB). */
export const SYNC_MAX_BYTES = 200 * 1024 * 1024;

/**
 * One tree the Strom app sent (POST <bridge>/sync, asked for or not): what the app said of it and what became of it,
 * kept beside it in the inbox (`received-<intake>.json`) — the app follows its send by `intake` (the bridge's /status).
 */
export interface Received {
  /** Its mark: "R" + when it came + a few random letters. */
  intake: string;
  at: string;
  /** The file in the inbox (its name); once decided moved aside (`keptAs`). */
  file: string;
  /** Where the file is kept once decided (`kept/<its name>`, the last KEPT_SENDS): what the app sent, to look at later. */
  keptAs?: string;
  /** The app's own tree it is (`_STROM_APP_TREE`): a newer send of the same tree replaces it. */
  tree?: string;
  /** The app's mark of the state it sent (`_STROM_SENT`). */
  sent?: string;
  /** How the user's transcripts count (`_STROM_TRANSCRIPTS`): lead unless the app says evidence. */
  transcripts: "lead" | "evidence";
  /** Changes it brings against the research at `counted` (its head then). */
  changes: number;
  counted: string;
  /**
   * Waits; written into the research; thrown away by the person; replaced by a newer send; brought nothing new; written
   * and taken back (strom sync undo); could not be written (why: `reason` — the app may send it again).
   */
  state: "pending" | "written" | "discarded" | "replaced" | "nothing" | "undone" | "failed";
  /** When it was written, thrown away, replaced or taken back. */
  decided?: string;
  /** Written: the sync's input. */
  input?: string;
  /** Taken back, then sent again by the app (POST /sync/<R…>/again): the send it came again as. */
  again?: string;
  /** Thrown away: why, in the person's words; failed: what went wrong. */
  reason?: string;
  /** Failed: what went wrong as a program reads it (the app says it in its language), with its IDs. */
  reasonCode?: string;
  reasonParams?: Record<string, string>;
  /** Tried to write and found the research busy (another strom at work): so many times so far. */
  tries?: number;
  /** Written or brought nothing: what an archive did not take away — the window that sent it never had it. */
  kept?: number;
  /** People and sources it named by the app's own marks, given their IDs when it came (the app's xref → P…, S…). */
  known?: { persons: Record<string, string>; sources: Record<string, string> };
}

/** What the app may say of a send in the file's HEAD: only these shapes are taken, anything else is ignored. */
const SEND_MARK = /^[A-Za-z0-9._:-]{1,64}$/;

/** The app's words on a send (HEAD of its GEDCOM): its tree, its mark of the state, how its transcripts count. */
export function sendMarks(text: string): { tree?: string; sent?: string; transcripts: "lead" | "evidence" } {
  const head = /^﻿?\s*0\s+HEAD[^\n]*\n((?:[1-9][^\n]*\n)*)/.exec(text.replace(/\r\n?/g, "\n"))?.[1] ?? "";
  const tag = (t: string) => new RegExp(`^1 ${t} +(.+?) *$`, "m").exec(head)?.[1];
  const tree = tag("_STROM_APP_TREE");
  const sent = tag("_STROM_SENT");
  return {
    ...(tree && SEND_MARK.test(tree) ? { tree } : {}),
    ...(sent && SEND_MARK.test(sent) ? { sent } : {}),
    transcripts: tag("_STROM_TRANSCRIPTS")?.toLowerCase() === "evidence" ? "evidence" : "lead",
  };
}

const receivedFile = (root: string, intake: string) => path.join(root, SYNC_INBOX, `received-${intake}.json`);

function writeReceived(root: string, r: Received): void {
  const file = receivedFile(root, r.intake);
  fs.writeFileSync(`${file}.${process.pid}`, JSON.stringify(r, null, 2));
  fs.renameSync(`${file}.${process.pid}`, file);
}

/** Every send the inbox remembers, the newest first. */
export function receivedAll(root: string): Received[] {
  const dir = path.join(root, SYNC_INBOX);
  if (!fs.existsSync(dir)) return [];
  const out: Received[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/^received-R[0-9A-Za-z-]+\.json$/.test(f)) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Received);
    } catch {
      // one being written
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at) || b.intake.localeCompare(a.intake));
}

/** The sends that wait for the person's word (written or thrown away), the newest first. */
export function receivedPending(root: string): Received[] {
  return receivedAll(root).filter((r) => r.state === "pending" && fs.existsSync(path.join(root, SYNC_INBOX, r.file)));
}

/** The send kept as this file of the inbox, if it is one. */
export function receivedOf(root: string, file: string): Received | undefined {
  if (path.resolve(path.dirname(file)) !== path.resolve(root, SYNC_INBOX)) return undefined;
  return receivedAll(root).find((r) => r.file === path.basename(file));
}

/** A send decided: its file goes (the research keeps what it wrote as the sync's input). */
/** How many sends of the app are kept once decided or refused (`.strom/sync/kept/`). */
const KEPT_SENDS = 30;

/** A send's file moved aside (`kept/`, the newest KEPT_SENDS), its name there; none: gone. */
function keepSent(root: string, from: string, prefix = ""): string | undefined {
  try {
    if (!fs.existsSync(from)) return undefined;
    const dir = path.join(root, SYNC_INBOX, "kept");
    fs.mkdirSync(dir, { recursive: true });
    const name = `${prefix}${path.basename(from)}`;
    fs.renameSync(from, path.join(dir, name));
    const all = fs.readdirSync(dir).map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const old of all.slice(KEPT_SENDS)) fs.rmSync(path.join(dir, old.f), { force: true });
    return `kept/${name}`;
  } catch {
    fs.rmSync(from, { force: true });
    return undefined;
  }
}

function decide(root: string, r: Received, to: Partial<Received> & { state: Received["state"] }): Received {
  // what the app sent is kept aside, the last ones (found on Windows: what a send carried could not be found out once it
  // was written): a failed one to be written by hand (strom sync <file> --apply), any one to be looked at
  const keptAs = keepSent(root, path.join(root, SYNC_INBOX, r.file));
  const done: Received = { ...r, ...to, ...(keptAs ? { keptAs } : {}), decided: new Date().toISOString() };
  writeReceived(root, done);
  return done;
}

/** The send of this file was written into the research (as this sync's input), or it brought nothing it had not. */
export function settleReceived(root: string, file: string, to: ({ state: "written"; input: string } | { state: "nothing" }) & { kept?: number }, applied: Applied[] = []): void {
  const r = receivedOf(root, file);
  if (r?.state !== "pending") return;
  // what this tree of the app had, for the next send of it (an archive takes away only what it had) — the people it
  // brought new by the IDs the research gave them
  try {
    const ids = new Map(applied.filter((a) => a.do === "person.add" && typeof a.before === "string").map((a) => [a.before as string, a.id]));
    if (r.tree) noteSeen(root, r.tree, r.intake, readTreeFile(file), ids);
  } catch {
    // its next send takes away as before
  }
  const { kept, ...rest } = to;
  decide(root, r, { ...rest, ...(kept ? { kept } : {}) });
}

/** A send the bridge could not write: so said (the app may send it again); `retry`: the research was busy, tried again later. */
export function failReceived(root: string, intake: string, reason: string, retry: boolean, code?: { code?: string | undefined; params?: Record<string, string> | undefined }): Received | undefined {
  const r = receivedAll(root).find((x) => x.intake === intake && x.state === "pending");
  if (!r) return undefined;
  if (retry) {
    const next = { ...r, tries: (r.tries ?? 0) + 1 };
    writeReceived(root, next);
    return next;
  }
  return decide(root, r, { state: "failed", reason: reason.slice(0, 300), ...(code?.code ? { reasonCode: code.code } : {}), ...(code?.params ? { reasonParams: code.params } : {}) });
}

/**
 * What one tree of the app had when it last sent (its people, facts, children) — an archive takes away only what the
 * window that sends had: one whose data are older than the research it was given (two windows of one browser, one of
 * them stale) takes nothing away that it never had.
 */
export interface Seen {
  intake: string;
  persons: string[];
  facts: string[];
  children: string[];
}

const seenFile = (root: string, appTree: string) => path.join(root, SYNC_INBOX, `seen-${appTree.replace(/[^A-Za-z0-9._-]/g, "_")}.json`);

export function readSeen(root: string, appTree: string): Seen | undefined {
  try {
    return JSON.parse(fs.readFileSync(seenFile(root, appTree), "utf8")) as Seen;
  } catch {
    return undefined;
  }
}

/** The facts of a person or family as an archive compares them: its key, the fact's key. */
const seenFact = (owner: string, f: SFact) => `${owner}|${factKey(f)}`;

function noteSeen(root: string, appTree: string, intake: string, snap: Snapshot, ids: Map<string, string> = new Map()): void {
  // a person new to the research by the ID it gave them; one it did not take: nobody to take away
  const id = (k: string) => (k.startsWith("x:") ? ids.get(k) : k);
  const persons = [...snap.persons.keys()].map(id).filter((k): k is string => !!k);
  const facts = [...snap.persons.entries()].flatMap(([k, p]) => (id(k) ? p.facts.map((f) => seenFact(id(k)!, f)) : []));
  const children: string[] = [];
  for (const f of snap.families) {
    if (f.partners.some((p) => !id(p))) continue;
    const key = famKey(f.partners.map((p) => id(p)!));
    facts.push(...f.facts.map((x) => seenFact(key, x)));
    children.push(...f.children.map(id).filter((c): c is string => !!c).map((c) => `${key}|${c}`));
  }
  const file = seenFile(root, appTree);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.${process.pid}`, JSON.stringify({ intake, persons, facts, children } satisfies Seen));
  fs.renameSync(`${file}.${process.pid}`, file);
}

/** The sync of this input was taken back: the send it wrote says so (the app learns its edits are no longer the research's). */
export function undoReceived(root: string, input: string): void {
  const r = receivedAll(root).find((x) => x.input === input && x.state === "written");
  if (r) writeReceived(root, { ...r, state: "undone", decided: new Date().toISOString() });
}

/**
 * Sends of the app taken back (strom sync undo) after the state a copy of the app was made from (its _STROM_HEAD, the
 * JSON's research.head): the copy still carries what they brought.
 */
export function undoneSince(root: string, text: string): string[] {
  const head = /^1 _STROM_HEAD (\S+)/m.exec(text)?.[1] ?? /"head"\s*:\s*"([0-9a-f]{7,64})"/.exec(text)?.[1];
  if (!head || !/^[0-9a-f]{7,64}$/.test(head)) return [];
  const r = git.runGit(root, ["show", "-s", "--format=%cI", head]);
  const at = r.status === 0 ? Date.parse(r.stdout.trim()) : NaN;
  if (!Number.isFinite(at)) return [];
  // the commit's time is in whole seconds, an undo's to the millisecond: one in the same second as it is not after it;
  // one sent again and written is the research's again (found on Mac: "send again" offered for it, the one still taken
  // back never)
  const all = receivedAll(root);
  return all.filter((x) => x.state === "undone" && !resent(all, x) && x.decided && Date.parse(x.decided) >= at + 1000).map((x) => x.intake);
}

/** A send taken back that the app sent again and the research wrote (or found nothing new in): back in the research. */
export function resent(all: Received[], r: Received): boolean {
  const again = r.again ? all.find((x) => x.intake === r.again) : undefined;
  return again?.state === "written" || again?.state === "nothing";
}

/** A send taken back, sent again as another (its mark): said on it. */
export function markSentAgain(root: string, intake: string, as: string): void {
  const r = receivedAll(root).find((x) => x.intake === intake);
  if (r && r.state === "undone") writeReceived(root, { ...r, again: as });
}

/**
 * A send taken back, as it came (its kept file), to be sent again: against the research as its undo left it — its
 * _STROM_HEAD that state, marked _STROM_AGAIN — so what was written since is never set back unasked.
 */
export function undoneSend(root: string, intake: string): string | undefined {
  const r = receivedAll(root).find((x) => x.intake === intake);
  if (!r || r.state !== "undone" || !r.keptAs) return undefined;
  const file = path.join(root, SYNC_INBOX, r.keptAs);
  if (!fs.existsSync(file)) return undefined;
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  // the undo: the last commit of its input (the undo marks it undone)
  const undo = r.input && /^I\d+$/.test(r.input) ? git.runGit(root, ["log", "-1", "--format=%H", "--", `data/inputs/${r.input}.json`]).stdout?.trim() : undefined;
  if (!undo) return text;
  const marked = text.replace(/^1 _STROM_(HEAD|SINCE|AGAIN) [^\n]*\n/gm, "");
  return marked.replace(/^(0 HEAD[^\n]*\n)/, `$11 _STROM_HEAD ${undo}\n1 _STROM_AGAIN ${intake}\n`);
}

/** A conflict a sync opened, for the app: whose (a couple's: the family and its first partner), which fact. */
export interface SyncConflict {
  id: string;
  person?: string;
  family?: string;
  fact?: string;
}

/** The conflicts the sync of this input opened that still wait for the user's decision. */
export function syncConflicts(tree: Tree, input: string): SyncConflict[] {
  const sync = tree.list<SyncInput>("input").find((i) => i.id === input)?.sync;
  if (!sync || sync.undone) return [];
  const opened = new Set(sync.applied.filter((a) => a.do === "conflict.add" || a.do === "conflict.edit").map((a) => a.id));
  if (!opened.size) return [];
  const out: SyncConflict[] = [];
  for (const x of tree.list<Conflict>("conflict")) {
    if (!opened.has(x.id) || x.state !== "open") continue;
    const person = x.subject.find((s) => s.startsWith("P"));
    const family = x.subject.find((s) => s.startsWith("F"));
    const partner = person ?? (family ? tree.list<Family>("family").find((f) => f.id === family)?.partners[0] : undefined);
    out.push({ id: x.id, ...(partner ? { person: partner } : {}), ...(family ? { family } : {}), ...(x.fact ? { fact: x.fact } : {}) });
  }
  return out;
}

/** Sends thrown away by the person (the named ones, else all that wait): what the app sent stays in the app. */
export function discardReceived(root: string, intakes: string[], reason?: string): Received[] {
  const pending = receivedPending(root);
  const pick = intakes.length ? pending.filter((r) => intakes.includes(r.intake)) : pending;
  return pick.map((r) => decide(root, r, { state: "discarded", ...(reason?.trim() ? { reason: reason.trim().slice(0, 200) } : {}) }));
}

/** Sends decided this long ago are forgotten (their marks only: the files went when they were decided). */
const RECEIVED_KEEP_MS = 30 * 24 * 60 * 60_000;
const RECEIVED_KEEP = 100;

/**
 * A tree the Strom app sent (POST <bridge>/sync): checked as any file, kept in the inbox to be shown and written on
 * the user's word — nothing of the research changes here. A send of the same tree of the app that still waits is
 * replaced by it (each carries the whole tree). Returns the file, how many changes it brings, and its mark.
 */
export function receiveTree(root: string, env: Tree["env"], text: string, opts: { keep?: string; again?: string } = {}): { file: string; changes: number; intake: string } {
  if (!/^﻿?\s*0\s+HEAD/.test(text)) throw new UsageError("not a GEDCOM file", { code: "tree.unreadable" });
  const dir = path.join(root, SYNC_INBOX);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString();
  // two sends within one millisecond (two browsers): each its own file
  const file = path.join(dir, `strom-app-${stamp.replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}.ged`);
  const given = withKnownIds(root, env, text);
  fs.writeFileSync(file, given.text);
  const mark = { intake: `R${stamp.replace(/[^0-9]/g, "").slice(0, 17)}-${crypto.randomBytes(2).toString("hex")}`, at: stamp };
  // a send taken back, sent again by the user: what it brings is theirs again (never left out as taken back)
  if (opts.again) markSentAgain(root, opts.again, mark.intake);
  let changes: number;
  try {
    changes = planSync(Tree.open(root, env), readTreeFile(file), "conflict").changes.length;
  } catch (e) {
    // refused (another research's, one without the research's IDs…): kept aside too, to see what came (said with it)
    const kept = keepSent(root, file, "refused-");
    if (kept && e instanceof StromError && e.details === undefined) throw new UsageError(e.message, { ...(e.hint ? { hint: e.hint } : {}), ...(e.code ? { code: e.code } : {}), ...(e.params ? { params: e.params } : {}), details: { kept } });
    throw e;
  }
  const marks = sendMarks(text);
  // the one being written now (opts.keep) is not replaced under the writer's hands
  for (const r of receivedPending(root)) if ((r.tree ?? "") === (marks.tree ?? "") && r.intake !== opts.keep) decide(root, r, { state: "replaced" });
  // the app may send every few minutes: what was decided is kept a while, and only so many
  const decided = receivedAll(root).filter((r) => r.state !== "pending");
  for (const [i, r] of decided.entries())
    if (i >= RECEIVED_KEEP || Date.parse(r.decided ?? r.at) < Date.now() - RECEIVED_KEEP_MS) fs.rmSync(receivedFile(root, r.intake), { force: true });
  const known = Object.keys(given.known.persons).length || Object.keys(given.known.sources).length ? { known: given.known } : {};
  const r: Received = { ...mark, file: path.basename(file), ...marks, changes, counted: headOf(root), state: "pending", ...known };
  // nothing the research has not: nothing waits (the app hears it from the answer)
  if (!changes) {
    if (r.tree) noteSeen(root, r.tree, r.intake, readTreeFile(file));
    decide(root, r, { state: "nothing" });
  } else writeReceived(root, r);
  return { file, changes, intake: r.intake };
}

/**
 * The people and sources earlier sends of this tree of the app brought, under the IDs the research gave them: the app
 * that does not load the research again keeps its own marks for them (found on Mac: a son added in the app, his birth
 * changed in it, came as another son). Only those the research still has, and only where the name the file gives is
 * theirs (an app that gave the same mark to someone else keeps it).
 */
function withKnownIds(root: string, env: Tree["env"], text: string): { text: string; known: { persons: Record<string, string>; sources: Record<string, string> } } {
  const known = { persons: {} as Record<string, string>, sources: {} as Record<string, string> };
  const as = (t: string) => ({ text: t, known });
  const appTree = sendMarks(text).tree;
  if (!appTree) return as(text);
  const sends = receivedAll(root)
    .filter((r) => r.tree === appTree && r.state === "written" && r.input)
    .sort((a, b) => Date.parse(a.decided ?? a.at) - Date.parse(b.decided ?? b.at));
  if (!sends.length) return as(text);
  let tree: Tree;
  try {
    tree = Tree.open(root, env);
  } catch {
    return as(text);
  }
  const named = new Map<string, string>();
  for (const r of sends)
    for (const a of tree.get<SyncInput>(r.input!)?.sync?.applied ?? [])
      if ((a.do === "person.add" || a.do === "source.add") && typeof a.before === "string" && a.before.startsWith("x:")) named.set(`@${a.before.slice(2)}@`, a.id);
  if (!named.size) return as(text);
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    out.push(line);
    const m = /^0 (@[^@\s]+@) (INDI|SOUR)\b/.exec(line);
    const id = m ? named.get(m[1]!) : undefined;
    if (!m || !id) continue;
    let end = i + 1;
    while (end < lines.length && !lines[end]!.startsWith("0 ")) end++;
    const body = lines.slice(i + 1, end);
    if (body.some((l) => /^1 REFN /.test(l))) continue;
    if (m[2] === "INDI") {
      // the app's own mark of the person it sent: theirs while the file still describes them — a name of theirs, or
      // renamed whole (Jan → Petr) the same sex and birth year
      const p = tree.get<Person>(id);
      const name = body.find((l) => l.startsWith("1 NAME "))?.slice(7) ?? "";
      const sex = body.find((l) => l.startsWith("1 SEX "))?.slice(6).trim();
      const born = /^1 (?:BIRT|CHR|BAPM)\n2 DATE [^\n]*?(\d{3,4})\s*$/m.exec(body.join("\n"))?.[1];
      const theirBirth = (p?.events ?? []).filter((e) => !e.retracted && ["BIRT", "CHR", "BAPM"].includes(e.kind)).map((e) => /(\d{3,4})\s*$/.exec(e.date ?? "")?.[1]);
      const same = !!p && (p.names.some((n) => sharesWord(gedcomName(n), name)) || (!!sex && sex === p.sex && !!born && theirBirth.includes(born)));
      if (!p || p.retracted || !same) continue;
      out.push(`1 REFN ${id}`, `2 TYPE ${REFN_TYPE}`);
      known.persons[m[1]!] = id;
    } else {
      const src = tree.get<Source>(id);
      if (!src || src.retracted) continue;
      out.push(`1 REFN ${id}`);
      known.sources[m[1]!] = id;
    }
  }
  return as(out.join("\n"));
}

/** The research's last commit (empty in a tree with none). */
function headOf(root: string): string {
  const r = git.runGit(root, ["rev-parse", "HEAD"]);
  return r.status === 0 ? String(r.stdout).trim() : "";
}

/** One send for the app (/status): its tree of the app (else the research's), its mark, and what it brings. */
export interface InboxTree {
  tree: string;
  intake: string;
  at: string;
  changes: number;
  sent?: string;
}

/**
 * What waits in the inbox, for the app (/status): each send that waits, its changes counted again once the research
 * changed since (and kept, so asking each minute counts nothing).
 */
export function inboxTrees(root: string, env: Tree["env"]): InboxTree[] {
  const out: InboxTree[] = [];
  const pending = receivedPending(root);
  if (!pending.length) return out;
  const head = headOf(root);
  let tree: Tree | undefined;
  for (const r of pending) {
    let changes = r.changes;
    if (head && r.counted !== head) {
      try {
        tree ??= Tree.open(root, env);
        changes = planSync(tree, readTreeFile(path.join(root, SYNC_INBOX, r.file)), "conflict").changes.length;
        // the research took all it brings meanwhile (another send of it): nothing waits
        if (!changes) {
          decide(root, r, { state: "nothing", changes, counted: head });
          continue;
        }
        writeReceived(root, { ...r, changes, counted: head });
      } catch {
        // counted the next time
      }
    }
    tree ??= Tree.open(root, env);
    out.push({ tree: r.tree ?? tree.config.id, intake: r.intake, at: r.at, changes, ...(r.sent ? { sent: r.sent } : {}) });
  }
  return out;
}

/** How the app's last sends went (/status `sends`): those of the last days, the newest first. */
export function recentSends(root: string, tree?: Tree, days = 7, max = 20): Record<string, unknown>[] {
  const since = Date.now() - days * 24 * 60 * 60_000;
  const all = receivedAll(root);
  return all
    .filter((r) => Date.parse(r.decided ?? r.at) >= since)
    .slice(0, max)
    .map((r) => ({
      intake: r.intake,
      at: r.at,
      state: r.state,
      changes: r.changes,
      ...(r.tree ? { tree: r.tree } : {}),
      ...(r.sent ? { sent: r.sent } : {}),
      ...(r.input ? { input: r.input } : {}),
      ...(r.again ? { again: r.again } : {}),
      // taken back, then sent again and written: the research's again — nothing to send again
      ...(r.state === "undone" && resent(all, r) ? { resent: true } : {}),
      // written: the conflicts it opened that still wait for the user (none: an empty list)
      ...(r.state === "written" && r.input && tree ? { conflicts: syncConflicts(tree, r.input) } : {}),
      ...(r.decided && r.state !== "pending" ? { decidedAt: r.decided } : {}),
      ...(r.reason ? { reason: r.reason } : {}),
      ...(r.reasonCode ? { reasonCode: r.reasonCode } : {}),
      ...(r.reasonParams ? { reasonParams: r.reasonParams, ...(tree ? { reasonNames: namesOf(tree, r.reasonParams) } : {}) } : {}),
      // an archive: what it did not take away (the window that sent it never had it)
      ...(r.kept ? { kept: r.kept } : {}),
      // pending, tried while the research was busy: so many times so far (it is tried again)
      ...(r.state === "pending" && r.tries ? { tries: r.tries } : {}),
    }));
}

/** Why the Strom app sends nothing: the tree unchanged since the research gave it, the user said no, no tree of this research in it. */
export const SEND_REASONS = ["unchanged", "cancelled", "no-tree"] as const;
export type SendReason = (typeof SEND_REASONS)[number];

/** The Strom app says it sends nothing (POST <bridge>/cancel): noted for strom sync --app, which stops waiting. */
export function noteNothingSent(root: string, reason: string): SendReason {
  const why = (SEND_REASONS as readonly string[]).includes(reason) ? (reason as SendReason) : "cancelled";
  const dir = path.join(root, SYNC_INBOX);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `nothing-${Date.now()}.json`), JSON.stringify({ reason: why, at: new Date().toISOString() }));
  return why;
}

/** The app said it sends nothing since `since` (ms): why. */
export function nothingSince(root: string, since: number): SendReason | undefined {
  const dir = path.join(root, SYNC_INBOX);
  if (!fs.existsSync(dir)) return undefined;
  const last = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("nothing-") && f.endsWith(".json"))
    .map((f) => path.join(dir, f))
    .filter((f) => fs.statSync(f).mtimeMs >= since)
    .sort()
    .pop();
  if (!last) return undefined;
  try {
    return (JSON.parse(fs.readFileSync(last, "utf8")) as { reason: SendReason }).reason;
  } catch {
    return "cancelled";
  }
}

/** The newest tree the app sent since `since` (ms), if any. */
export function receivedSince(root: string, since: number): string | undefined {
  const dir = path.join(root, SYNC_INBOX);
  if (!fs.existsSync(dir)) return undefined;
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ged") && !f.startsWith("adopt-"))
    .map((f) => path.join(dir, f))
    .filter((f) => fs.statSync(f).mtimeMs >= since)
    .sort()
    .pop();
}

// ── a tree of the Strom app becomes a research (strom-research://new, ?adopt=) ──

/** Where a new research waits for the tree of the app it was started for: the app's mark, since when. */
const ADOPT_FILE = path.join(".strom", "adopt.json");
/** How long the app's mark is good (the app keeps it an hour too). */
export const ADOPT_FOR_MS = 60 * 60_000;

/**
 * This research waits for the app's tree with this mark (the link's app=…). `transfer`: the file the app's tree came
 * in from a browser the app cannot reach strom from (Safari: strom-prenos-….json) — the bridge gives it to the app in
 * the browser it moves to (GET /transfer) while the research waits.
 */
export function awaitAdoption(root: string, token: string, transfer?: string, existing = false): void {
  fs.mkdirSync(path.join(root, ".strom"), { recursive: true });
  fs.writeFileSync(path.join(root, ADOPT_FILE), JSON.stringify({ token, at: new Date().toISOString(), ...(transfer ? { transfer } : {}), ...(existing ? { existing } : {}) }));
}

/**
 * What this research waits for: the mark, until when, the file of a transfer (while it is there), and whether the tree
 * goes into a research made before (`existing`: one whose tree never came, D4) — none when it waits for none.
 */
export function adoptionWait(root: string): { token: string; until: string; transfer?: string; existing?: true } | undefined {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(root, ADOPT_FILE), "utf8")) as { token?: string; at?: string; done?: string; transfer?: string; existing?: boolean };
    const at = Date.parse(a.at ?? "");
    if (!a.token || a.done || !(Date.now() - at < ADOPT_FOR_MS)) return undefined;
    const transfer = a.transfer && fs.existsSync(a.transfer) ? a.transfer : undefined;
    return { token: a.token, until: new Date(at + ADOPT_FOR_MS).toISOString(), ...(transfer ? { transfer } : {}), ...(a.existing ? { existing: true as const } : {}) };
  } catch {
    return undefined;
  }
}

/** The mark of the tree this research waits for — none when it waits for none, got it already, or waited too long. */
export function pendingAdoption(root: string): string | undefined {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(root, ADOPT_FILE), "utf8")) as { token?: string; at?: string; done?: string };
    return a.token && !a.done && Date.now() - Date.parse(a.at ?? "") < ADOPT_FOR_MS ? a.token : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The app's tree for a new research (POST <bridge>/adopt): a GEDCOM, kept in the inbox as it came (adopt-<when>.ged)
 * and, without the images written into it, as the research's own document of it (<the research's name>.ged) — the
 * one the bridge takes in. Nothing of the research changes here; it is adopted once taken in (markAdopted).
 */
export function receiveAdopted(root: string, text: string, from?: string): string {
  if (!pendingAdoption(root)) throw new UsageError("this research waits for no tree", { code: "adopt.none" });
  if (!/^\uFEFF?\s*0\s+HEAD/.test(text)) throw new UsageError("not a GEDCOM file", { code: "tree.unreadable" });
  // a tree with no people yet (installed from the app's start screen, C1) is handed over too: the research stays empty,
  // linked to the app, and its first people come by a send (adoptedEmpty)
  const dir = path.join(root, SYNC_INBOX);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `adopt-${new Date().toISOString().replace(/[:.]/g, "-")}.ged`), text);
  let name = "tree";
  try {
    name = JSON.parse(fs.readFileSync(path.join(root, "strom.json"), "utf8")).name || name;
  } catch {
    // the tree's own name then
  }
  const kept = path.join(dir, `${safeFolderName(name)}.ged`);
  fs.writeFileSync(kept, withoutImages(text));
  // which copy of the app handed it over (its page's origin): said where it went
  const a = JSON.parse(fs.readFileSync(path.join(root, ADOPT_FILE), "utf8")) as Record<string, string>;
  fs.writeFileSync(path.join(root, ADOPT_FILE), JSON.stringify({ ...a, received: new Date().toISOString(), ...(from ? { from } : {}) }));
  return kept;
}

/**
 * A research made for a tree of the app that never came (its handover did not happen — the tree stayed in a browser
 * the app could not reach strom from): since when. Waiting still, or waited out; never one that got its tree.
 */
export function adoptionNeverCame(root: string): { at: string } | undefined {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(root, ADOPT_FILE), "utf8")) as { token?: string; at?: string; done?: string };
    return a.token && !a.done && a.at ? { at: a.at } : undefined;
  } catch {
    return undefined;
  }
}

/** The app asked what this research waits for (GET /adopt): noted once — a terminal still waiting knows the app got here. */
export function noteAdoptAsked(root: string): void {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(root, ADOPT_FILE), "utf8")) as Record<string, string>;
    if (a.asked && Date.parse(a.asked) >= Date.parse(a.at ?? "")) return;
    fs.writeFileSync(path.join(root, ADOPT_FILE), JSON.stringify({ ...a, asked: new Date().toISOString() }));
  } catch {
    // nothing waits
  }
}

/** Whether the app has asked this research since `since` (ms) what it waits for. */
export function adoptAskedSince(root: string, since: number): boolean {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(root, ADOPT_FILE), "utf8")) as { asked?: string };
    return Boolean(a.asked && Date.parse(a.asked) >= since);
  } catch {
    return false;
  }
}

/** A GEDCOM of the app's with no people in it (a tree just made, C1): handed over, nothing to take in. */
export function adoptedEmpty(text: string): boolean {
  return !/^1 INDI\b|^0 @[^@]+@ INDI\b/m.test(text);
}

/** The app's tree taken in (its input; `app`: the version of the app that handed it over): the research waits for no tree any more. */
export function markAdopted(root: string, input: string | undefined, app?: string): void {
  const a = JSON.parse(fs.readFileSync(path.join(root, ADOPT_FILE), "utf8")) as Record<string, string>;
  fs.writeFileSync(path.join(root, ADOPT_FILE), JSON.stringify({ ...a, done: new Date().toISOString(), ...(input ? { input } : {}), ...(app ? { app } : {}) }));
}

/** The app's tree taken in since `since` (ms): its input (empty when it brought nothing to write), the app's version. */
export function adoptedAt(root: string, since: number): { input?: string; app?: string } | undefined {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(root, ADOPT_FILE), "utf8")) as { done?: string; input?: string; app?: string };
    return a.done && Date.parse(a.done) >= since ? { ...(a.input ? { input: a.input } : {}), ...(a.app ? { app: a.app } : {}) } : undefined;
  } catch {
    return undefined;
  }
}

/** Why the app's tree was not taken (POST <bridge>/adopt refused, or it could not be taken in): noted for the research in the terminal, which stops waiting. */
export function noteAdoptFailed(root: string, why: "empty" | "other", reason?: string): void {
  const dir = path.join(root, SYNC_INBOX);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `adopt-failed-${Date.now()}.json`), JSON.stringify({ why, at: new Date().toISOString(), ...(reason ? { reason } : {}) }));
}

/** A family tree file without the images written into it (data: URLs): a GEDCOM's FILE with its CONC lines, a JSON's strings. */
export function withoutImages(text: string): string {
  const left = (bytes: number) => `[image left out, ${Math.round(bytes / 1024)} kB]`;
  // GEDCOM: n FILE data:… and the n+1 CONC/CONT lines that go on with it
  const ged = text.replace(/^(\d+) FILE data:[^\r\n]*(?:\r?\n(?:\d+) CON[CT] [^\r\n]*)*/gm, (m, level: string) => `${level} FILE ${left(m.length)}`);
  // JSON: "data:image/…;base64,…"
  return ged.replace(/"data:image\/[^"]*"/g, (m) => `"${left(m.length)}"`);
}

/** The app's tree was refused, or could not be taken in, since `since` (ms): why (and what went wrong). */
export function adoptFailedSince(root: string, since: number): { why: "empty" | "other"; reason?: string } | undefined {
  const dir = path.join(root, SYNC_INBOX);
  if (!fs.existsSync(dir)) return undefined;
  const last = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("adopt-failed-"))
    .map((f) => path.join(dir, f))
    .filter((f) => fs.statSync(f).mtimeMs >= since)
    .sort()
    .pop();
  if (!last) return undefined;
  try {
    const f = JSON.parse(fs.readFileSync(last, "utf8")) as { why: "empty" | "other"; reason?: string };
    return { why: f.why === "empty" ? "empty" : "other", ...(f.reason ? { reason: f.reason } : {}) };
  } catch {
    return { why: "other" };
  }
}

/** The tree the app handed over since `since` (ms), if any. */
export function adoptedSince(root: string, since: number): string | undefined {
  const dir = path.join(root, SYNC_INBOX);
  if (!fs.existsSync(dir)) return undefined;
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("adopt-") && f.endsWith(".ged"))
    .map((f) => path.join(dir, f))
    .filter((f) => fs.statSync(f).mtimeMs >= since)
    .sort()
    .pop();
}

// ── is it ours? ──────────────────────────────────────────────────────────────

export interface Identity {
  /** How many of the file's people are ours by their ID (and a name alike). */
  matched: number;
  /** Our IDs whose name in the file is someone else's: taken as new people. */
  strangers: string[];
}

/**
 * Refuse a file that is not this research: another research's (its tree ID), or one where few people are ours.
 * A file of this research (its tree ID) is ours by the IDs it carries, whatever the names — a person renamed in the app
 * is a change of the name (found on Windows: people named "1", "2", "3", one renamed, all taken for strangers). Without
 * the tree ID our IDs with another person's name are not matched (another research's IDs, a file edited by hand).
 */
export function checkIdentity(tree: Tree, incoming: Snapshot, force = false): Identity {
  if (incoming.treeId && incoming.treeId !== tree.config.id)
    throw new UsageError(`this file is of another research (${incoming.treeId}), not of "${tree.config.name}"`, {
      hint: "open that research, or add the file as leads: strom intake <file>",
      code: "tree.other-research",
      params: { id: incoming.treeId, name: tree.config.name },
    });
  const strangers: string[] = [];
  let matched = 0;
  for (const [key, p] of incoming.persons) {
    if (key.startsWith("x:")) continue;
    const ours = resolve(tree, key);
    const alike = ours && (incoming.treeId === tree.config.id || ours.names.some((n) => p.names.some((m) => sameName(`${n.given} ${n.surname}`, m) || sharesWord(`${n.given} ${n.surname}`, m))));
    if (ours && alike) matched++;
    else strangers.push(key);
  }
  for (const key of strangers) {
    const p = incoming.persons.get(key)!;
    incoming.persons.delete(key);
    const other = `x:${key}`;
    incoming.persons.set(other, { ...p, key: other });
    for (const f of incoming.families) {
      f.partners = f.partners.map((k) => (k === key ? other : k));
      f.children = f.children.map((k) => (k === key ? other : k));
    }
  }
  // a research with nobody in it yet has nothing to compare with: its first tree is taken (found in an archive: the
  // first send from the app refused as "0 of 3 people")
  if (!force && !incoming.treeId && tree.countLive("person") > 0 && matched < Math.max(1, incoming.persons.size / 2))
    throw new UsageError(
      `this does not look like the family tree of "${tree.config.name}": ${matched} of its ${incoming.persons.size} people are the research's`,
      {
        hint: "another family tree goes in as leads: strom intake <file> — it is yours after all: strom sync <file> --force",
        code: "tree.foreign",
        params: { matched: String(matched), people: String(incoming.persons.size), name: tree.config.name },
      },
    );
  return { matched, strangers };
}

/** The same name, folded: one of a single letter or digit too ("1", "J."), which shares no word. */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => fold(s.replace(/\//g, " ")).split(" ").filter(Boolean).join(" ");
  return !!norm(a) && norm(a) === norm(b);
}

function sharesWord(a: string, b: string): boolean {
  const words = (s: string) => new Set(fold(s.replace(/\//g, " ")).split(" ").filter((w) => w.length > 1));
  const x = words(a);
  return [...words(b)].some((w) => x.has(w));
}

/** Our person by ID, through merges. */
function resolve(tree: Tree, id: string): Person | undefined {
  let p = tree.get<Person>(id);
  for (let hops = 0; p?.mergedInto && hops < 10; hops++) p = tree.get<Person>(p.mergedInto);
  return p && p.type === "person" && !p.retracted ? p : undefined;
}

// ── the changes ──────────────────────────────────────────────────────────────

export type ChangeKind =
  | "person.new"
  | "fact.new"
  | "fact.changed"
  | "fact.differs"
  | "fact.gone"
  | "fact.detail"
  | "name.new"
  | "name.changed"
  | "name.title"
  | "sex.changed"
  | "note.new"
  | "family.new"
  | "child.new"
  | "child.gone"
  | "child.parents"
  | "child.relation"
  | "child.moved"
  | "partner.new"
  | "partner.gone"
  | "family.union"
  | "person.gone"
  | "place.coords"
  | "source.new"
  | "source.changed"
  | "source.reading"
  | "source.verified"
  | "fact.cite"
  | "fact.part"
  | "person.cite"
  | "family.cite";

/** What strom does with a change: adds it, corrects a lead, a conflict, the user's edit wins, the place's position set, only when picked, nothing, withdrawn, what a record's fact lacks added to it. */
export type ChangeAction = "add" | "correct" | "conflict" | "user" | "set" | "pick" | "report" | "remove" | "refine";

export interface Change {
  n: number;
  kind: ChangeKind;
  action: ChangeAction;
  /** The person: our ID, or the file's key of a new one. */
  person?: string;
  /** Their name as the file has it. */
  name?: string;
  /** A family: our ID when it exists. */
  family?: string;
  /** The partners (keys) of a family change. */
  partners?: string[];
  child?: string;
  /** place.coords: the place as the file has it, the research's place and where the research has it now. */
  place?: SPlace & { id?: string; was?: { lat: number; lon: number } };
  fact?: SFact;
  /** What the research has (ours) — for a change or a difference. */
  was?: SFact;
  /** name.changed: the name the person is shown by in the research (the file's new one is `text`). */
  wasName?: string;
  /** name.title: which title of the name the person is shown by, and the research's (the file's is `text`, "" none). */
  title?: { part: "before" | "after"; was: string };
  text?: string;
  /** A source: its key in the file, and the research's source it is (a change of one the research has). */
  source?: string;
  sourceId?: string;
  /** A fact taken with its sources: it stands on the user's reading of a record (their transcript counts as one). */
  reads?: boolean;
  /** fact.part: who the file names at the fact (`was` the research's fact), and the research's entry of them (its role). */
  part?: SPart;
  wasPart?: SPart;
  /** person.cite, family.cite: the sources the file gives the person or the family themselves. */
  cites?: SCite[];
  /** An archive keeps what the window that sent never had (its data older than the research it was given): only said. */
  kept?: true;
  /** What a send taken back since the copy was made brought (its mark, R…): only said, never written again. */
  takenBack?: string;
  /** family.new, partner.new: the two parents are no couple (the Strom app's _STROM_NO_COUPLE). */
  noCouple?: true;
  /** family.new, family.union: how the couple is bound (Family.union); family.union: the research's before ("" none). */
  union?: Union;
  wasUnion?: Union | "";
  /** family.new, child.new, child.relation: a child's tie to each parent (the child's key → the parent's key → birth, adopted, step, foster). */
  ties?: Record<string, Record<string, string>>;
  /** fact.changed, a conflict of a value a later send of the app changed: set back to an earlier send's, or cited by the user since. */
  asked?: "setBack" | "cited";
  /** A change only said or left to pick: the file's sources it gave the fact that the research's fact does not cite — not written with it. */
  uncited?: string[];
}

export interface Plan {
  changes: Change[];
  /** The file's sources that are the research's (its REFN, or the same entry): the file's key → the research's ID. */
  sources: Map<string, string>;
  /** Compared with what the research gave (base) — or only with the research now. */
  base: boolean;
  head?: string;
  /** The file has far fewer people than it was given: nothing is taken as removed. */
  partial: boolean;
  identity: Identity;
}

/** Does a record prove it: proven or probable, from a record — not a family tree, not someone's word. */
function recordBacked(tree: Tree, e: Event | undefined): boolean {
  if (!e || (e.status !== "proven" && e.status !== "probable")) return false;
  return e.citations.some((c) => {
    const s = tree.get<Source>(c.source);
    return !!s && s.kind !== "family-tree" && s.kind !== "family-memory" && s.form !== "authored";
  });
}

/** A name as GEDCOM writes it (Given /Surname/). */
function gedcomName(n: Name): string {
  return `${n.given} /${n.surname}/`.trim();
}

/** A note of a record, by its time: its first words (for the line of the history that says it was taken off). */
function noteText(tree: Tree, id: string, at: unknown): string {
  const rec = tree.get<Person | Family | Source>(id) as { notes?: { at: string; text: string }[] } | undefined;
  const t = rec?.notes?.find((n) => n.at === at)?.text ?? "";
  const one = t.replace(/\s+/g, " ").trim();
  return (one.length > 60 ? `${one.slice(0, 59)}…` : one).replace(/"/g, "'");
}

/** Does a record give the name: one of its sources is not a family tree, nor someone's word. */
function nameBacked(tree: Tree, n: Name): boolean {
  return (n.citations ?? []).some((c) => {
    const s = tree.get<Source>(c.source);
    return !!s && !s.retracted && s.kind !== "family-tree" && s.kind !== "family-memory" && s.form !== "authored";
  });
}

function eventById(tree: Tree, id: string | undefined): Event | undefined {
  if (!id) return undefined;
  for (const o of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
    const e = o.events.find((x) => x.id === id);
    if (e) return e;
  }
  return undefined;
}

const famKey = (partners: string[]) => [...partners].sort().join("+");

/**
 * The changes a file brings, in the order they are applied. `edits`: what a change of a fact a record proves
 * becomes. Without a base only additions are taken; differences wait to be picked.
 */
export function planSync(tree: Tree, incoming: Snapshot, edits: "conflict" | "user", opts: { force?: boolean; takenBack?: false; sent?: boolean } = {}): Plan {
  // an archive mirrors the app: the user's word wins, what the app no longer has is withdrawn (with the reason)
  const mirror = isArchive(tree);
  if (mirror) edits = "user";
  // what this tree of the app had when it last sent: an archive takes away only that (none sent yet: what it was given)
  const seen = mirror && incoming.appTree ? readSeen(tree.root, incoming.appTree) : undefined;
  const had = (list: "persons" | "facts" | "children", key: string) => !seen || seen[list].includes(key);
  const identity = checkIdentity(tree, incoming, opts.force);
  const ours = snapshotOfTree(tree);
  knownNewcomers(incoming, ours);
  renamedInPlace(incoming, ours);
  // the user's edits against the send this copy is a copy of (_STROM_SINCE) — else the research after the last send of
  // this tree of the app it wrote, else what the app was given
  // a send taken back, sent again: against the research as the undo left it (_STROM_HEAD is that, said by strom) — what
  // changed since is the research's, the user decides (found on Mac: a birth written since set back by the old send)
  const sentAgain = !!incoming.again && receivedAll(tree.root).some((r) => r.intake === incoming.again && r.state === "undone");
  // _STROM_SINCE stands on its own: a copy the app set back to its state before a load says no _STROM_HEAD (found on
  // Mac: an occupation edited after it added as a second one, two edits left "to pick" with nothing to pick)
  const since = !sentAgain ? sinceBase(tree, incoming) : undefined;
  const after = incoming.head && !sentAgain && !since ? afterSends(tree, incoming) : undefined;
  const base = sentAgain && incoming.head ? snapshotAt(tree, incoming.head) : (since ?? after?.base);
  // the titles an app that reads none keeps in the name (the research gives them in the NAME line): found there, the
  // person's titles still — in a copy of the app it stands on too (a send it kept: _STROM_SINCE)
  for (const [key, b] of base?.persons ?? []) if (!key.startsWith("x:")) titlesInName(b, [ours.persons.get(resolve(tree, key)?.id ?? key)?.titles]);
  for (const [key, p] of incoming.persons) if (!key.startsWith("x:")) titlesInName(p, [base?.persons.get(key)?.titles, ours.persons.get(resolve(tree, key)?.id ?? key)?.titles]);
  // what later sends of this tree of the app wrote, which this copy may never have had: set back in it, a conflict
  const sentSince = after?.sentSince;
  // what earlier sends of it wrote that later ones changed, the copy has as the earlier ones left it
  const sentBefore = after?.sentBefore;
  // a copy of the app linked to the research that carries few of its people — most of the research's gone, people
  // without its IDs in their place (found on Windows: the app's own copy of a tree it handed over, a person renamed —
  // the whole tree written again beside itself): refused, never taken as new people (the person may, --force). Against
  // what the app was given; a copy that does not say which state it had (no _STROM_HEAD — the research never hands
  // over a tree without it) against the research now
  const given = base ?? ours;
  if (incoming.treeId && !opts.force) {
    const kept = [...given.persons.keys()].filter((k) => incoming.persons.has(k)).length;
    const strangers = [...incoming.persons.keys()].filter((k) => k.startsWith("x:")).length;
    const missing = given.persons.size - kept;
    if (given.persons.size && kept < given.persons.size / 2 && strangers > 0 && strangers >= missing / 2)
      throw new UsageError(`the Strom app's copy carries ${kept} of the research's ${given.persons.size} people by their IDs — it would come in as another family tree beside them`, {
        hint: "load the research in the app again (its tree.ged), then send — or, if it is meant: strom sync <file> --force",
        code: "tree.no-ids",
        params: { kept: String(kept), people: String(given.persons.size) },
      });
  }
  const partial = !!base && incoming.persons.size < base.persons.size / 2;
  const changes: Change[] = [];
  const push = (c: Omit<Change, "n">) => changes.push({ ...c, n: changes.length + 1 });
  /** What the file no longer has: an archive takes it away — unless the window that sends never had it (kept, said). */
  const gone = (itHad: boolean): { action: ChangeAction; kept?: true } => (!mirror ? { action: "report" } : itHad ? { action: "remove" } : { action: "report", kept: true });
  // the kinds of facts the file carries at all, of people and of families apart: one it never has is not "gone" (the
  // app does not keep it — the Strom app keeps a family's other events in the couple's note, though its people have them)
  const carried = new Set([...incoming.persons.values()].flatMap((p) => p.facts.map((f) => kindOf(f.kind))));
  const carriedFam = new Set(incoming.families.flatMap((f) => f.facts.map((x) => kindOf(x.kind))));
  // the sources first: what the file's citations are the research has, or what comes with them
  const sources = planSources(tree, incoming, ours, base, push);
  const reads = readsFor(tree, incoming, sources, changes);
  const idOf = (key: string) => (key.startsWith("x:") ? key : (resolve(tree, key)?.id ?? key));
  // who the records name at a fact: the same person by their key or a name of theirs; the role "other" is any role
  // (the Strom app has no name for an informant or a midwife)
  const partIds = (p: SPart, snap: Snapshot) =>
    new Set([...(p.person ? [`p:${idOf(p.person)}`, ...(snap.persons.get(p.person)?.names ?? []).map((n) => `n:${nameKey(n)}`)] : []), ...(p.name ? [`n:${nameKey(p.name)}`] : [])]);
  const sameWho = (a: SPart, sa: Snapshot, b: SPart, sb: Snapshot) => {
    const x = partIds(b, sb);
    return [...partIds(a, sa)].some((k) => x.has(k));
  };
  const sameRole = (a: SPart, b: SPart) => a.role === b.role || a.role === "other" || b.role === "other";

  const factsDiff = (owner: { person?: string; family?: string; partners?: string[]; name?: string }, inc: SFact[], our: SFact[], was: SFact[] | undefined, isOurs: boolean) => {
    const ourKeys = new Set(our.map(factKey));
    const baseKeys = new Set((was ?? []).map(factKey));
    const incKeys = new Set(inc.map(factKey));
    const used = new Set<string>();
    const partsOf = (facts: SFact[] | undefined) => (facts ?? []).flatMap((fact) => (fact.parts ?? []).map((part) => ({ fact, part })));
    const [ourParts, baseParts, incParts] = [partsOf(our), partsOf(was), partsOf(inc)];
    /** Who the file names at a fact the research has (`o`): one more is added, another role a change, as a fact's. */
    const partsDiff = (f: SFact, o: SFact | undefined) => {
      for (const p of f.parts ?? []) {
        const known = ourParts.find((x) => sameWho(p, incoming, x.part, ours) && sameRole(p, x.part));
        if (known) {
          // a name of the research's the user linked to a person of the tree
          const linked = was && baseParts.some((x) => sameWho(p, incoming, x.part, base!) && x.part.person);
          if (p.person && !known.part.person && known.fact.id && !linked) push({ kind: "fact.part", action: "add", ...owner, fact: f, was: known.fact, part: p, wasPart: known.part });
          continue;
        }
        if (was && baseParts.some((x) => sameWho(p, incoming, x.part, base!) && sameRole(p, x.part))) continue; // as given: the research changed it since
        if (!o?.id) continue;
        const other = ourParts.find((x) => x.fact.id === o.id && sameWho(p, incoming, x.part, ours));
        if (other) {
          // the same person in another role: the user's edit when the research gave it so
          const given = was?.length && baseParts.some((x) => sameWho(x.part, base!, other.part, ours) && x.part.role === other.part.role);
          const action = !given ? "pick" : recordBacked(tree, eventById(tree, o.id)) ? edits : "correct";
          if (action !== "conflict" || !openClaim(tree, owner.person ?? owner.family, partText(p, incoming)))
            push({ kind: "fact.part", action, ...owner, fact: f, was: o, part: p, wasPart: other.part });
          continue;
        }
        push({ kind: "fact.part", action: "add", ...owner, fact: f, was: o, part: p });
      }
    };
    for (const f of inc) {
      const k = factKey(f);
      if (ourKeys.has(k)) {
        // the research has it: what the file says of it besides (its cause, age, house) may be the user's — paired
        // with the same details first (one lived in several houses of a place: each its own fact)
        const sameDetails = (a: SFact, b: SFact) => {
          const [x, y] = [detailsOf(a), detailsOf(b)];
          return Object.keys(x).every((d) => exact(x[d]) === exact(y[d]));
        };
        const mates = our.filter((x) => factKey(x) === k);
        // the sources the user gave it in the app that it does not cite yet (nor did it when given)
        const paired = mates.find((x) => sameDetails(f, x)) ?? mates[0]!;
        partsDiff(f, paired);
        // facts alike (two events of a year, told apart by their names only) pair loosely: a source any of them cites is no news
        const fresh = newCites(tree, f, mates, was?.filter((x) => factKey(x) === k) ?? [], sources, owner.family);
        if (fresh.length) push({ kind: "fact.cite", action: "add", ...owner, fact: { ...f, cites: fresh }, was: paired, reads: fresh.some((c) => reads(c.source)) });
        if (mates.some((x) => sameDetails(f, x)) || was?.some((x) => factKey(x) === k && sameDetails(f, x))) continue;
        const o = mates.find((x) => !inc.some((i) => factKey(i) === k && sameDetails(i, x))) ?? mates[0]!;
        const b = was?.find((x) => factKey(x) === k && (!x.id || x.id === o.id));
        const [fd, od, bd] = [detailsOf(f), detailsOf(o), b ? detailsOf(b) : undefined];
        const changed = Object.keys(fd).filter((d) => exact(fd[d]) !== exact(od[d]) && !(bd && exact(fd[d]) === exact(bd[d])));
        if (changed.length) {
          const added = changed.every((d) => !od[d]);
          const action = added ? "add" : !was ? "pick" : recordBacked(tree, eventById(tree, o.id)) ? (mirror ? "user" : "conflict") : "correct";
          if (action !== "conflict" || !openConflict(tree, owner.person ?? owner.family, f)) push({ kind: "fact.detail", action, ...owner, fact: f, was: o });
        }
        continue;
      }
      const less = our.find((o) => knowsMore(o, f));
      if (less) {
        // the file knows less of it (the date lost on the way)
        partsDiff(f, less);
        continue;
      }
      if (was && baseKeys.has(k)) {
        // as it was given: the research changed it since — a later send of this tree of the app too, one this copy never
        // had (or the user set it back): kept, said
        const owned = owner.person ?? owner.family;
        const sent = sentSince && owned ? our.find((o) => kindOf(o.kind) === kindOf(f.kind) && !incKeys.has(factKey(o)) && !used.has(factKey(o)) && sentSince.has(`${owned}|${factKey(o)}`)) : undefined;
        if (sent) {
          used.add(factKey(sent));
          // set back to what an earlier send wrote (a copy kept from before, or the user's word: the same file), or
          // given a source of the user's since (found on Mac: a citation lost with the value kept): the user decides
          const asked = sentBefore?.has(`${owned}|${k}`) ? "setBack" : newCites(tree, f, [sent], was.filter((b) => factKey(b) === k), sources, owner.family).length ? "cited" : undefined;
          if (!asked) push({ kind: "fact.changed", action: "report", kept: true, ...owner, fact: f, was: sent });
          else if (!openConflict(tree, owned, f)) push({ kind: "fact.changed", action: "conflict", asked, ...owner, fact: f, was: sent });
          continue;
        }
        const given = was.find((b) => factKey(b) === k);
        const now = our.find((o) => !!o.id && o.id === given?.id);
        // the research changed it since, the user gave it a source of theirs meanwhile: never lost with it, the user decides
        if (now && newCites(tree, f, [now], [given!], sources, owner.family).length) {
          if (owned && !openConflict(tree, owned, f)) push({ kind: "fact.changed", action: "conflict", asked: "cited", ...owner, fact: f, was: now });
          continue;
        }
        partsDiff(f, now);
        continue;
      }
      const kind = kindOf(f.kind);
      // an edit of a fact there is one of: what it was; of a fact there may be more of (an occupation, a residence):
      // the one of its kind the file no longer has, as it was given — the only one, else the one it shares most with
      const before = ONE.has(kind) ? (was ?? our).find((b) => kindOf(b.kind) === kind && !incKeys.has(factKey(b)) && !used.has(factKey(b))) : was ? editOf(f, was, inc, our) : undefined;
      if (before) used.add(factKey(before));
      const mine = before ? our.find((o) => kindOf(o.kind) === kind && (was ? factKey(o) === factKey(before) : true)) : undefined;
      // an edit of a fact of a kind there may be more of, whose value the research changed since it was given (a send
      // taken back put its own back): the one the research has in its place, the user's to decide — never a fact beside
      // it (found on Mac: two occupations after an undo, the app showing one)
      if (isOurs && !before && was) {
        const lost = was.some((b) => kindOf(b.kind) === kind && !incKeys.has(factKey(b)) && !our.some((o) => factKey(o) === factKey(b)));
        const instead = our.filter((o) => kindOf(o.kind) === kind && !incKeys.has(factKey(o)) && !used.has(factKey(o)));
        if (lost && instead.length === 1) {
          used.add(factKey(instead[0]!));
          if (!openConflict(tree, owner.person ?? owner.family, f)) push({ kind: "fact.changed", action: "conflict", ...owner, fact: f, was: instead[0]! });
          continue;
        }
      }
      if (!isOurs || !before) {
        push({ kind: "fact.new", action: "add", ...owner, fact: f, ...((f.cites ?? []).some((c) => reads(c.source)) ? { reads: true } : {}) });
        continue;
      }
      if (!was) {
        push({ kind: "fact.differs", action: "pick", ...owner, fact: f, ...(mine ? { was: mine } : {}) });
        partsDiff(f, mine);
        continue;
      }
      if (!mine) {
        // the research changed or withdrew it since it was given: the user decides
        const now = our.find((o) => kindOf(o.kind) === kind);
        push({ kind: "fact.changed", action: now ? "conflict" : "add", ...owner, fact: f, ...(now ? { was: now } : {}) });
        continue;
      }
      const e = eventById(tree, mine.id);
      // what only adds to a record's fact (a place where it has none, a day of its year): added to it, citing the
      // user — no conflict where nothing disagrees
      if (recordBacked(tree, e) && addsTo(mine, f)) {
        push({ kind: "fact.changed", action: "refine", ...owner, fact: f, was: mine });
        partsDiff(f, mine);
        continue;
      }
      const action = recordBacked(tree, e) ? edits : "correct";
      // the user's edit in place of the record's fact takes the people the file names with it
      if (action !== "user") partsDiff(f, mine);
      // asked already: the conflict of this very edit is open
      if (action === "conflict" && openConflict(tree, owner.person ?? owner.family, f)) continue;
      push({ kind: "fact.changed", action, ...owner, fact: f, was: mine });
    }
    // who the research gave at a fact the file still has, no longer named at it (in no role)
    if (was?.length && !partial) {
      const said = new Set<SPart>();
      for (const b of baseParts) {
        if (incParts.some((x) => sameWho(x.part, incoming, b.part, base!))) continue;
        const mine = ourParts.find((x) => x.fact.id && sameWho(x.part, ours, b.part, base!) && sameRole(x.part, b.part));
        if (!mine || said.has(mine.part) || !inc.some((x) => kindOf(x.kind) === kindOf(mine.fact.kind))) continue;
        said.add(mine.part);
        push({ kind: "fact.part", action: mirror ? "remove" : "report", ...owner, was: mine.fact, wasPart: mine.part });
      }
    }
    if (was && !partial)
      for (const b of was)
        if (!incKeys.has(factKey(b)) && !used.has(factKey(b)) && (owner.family ? carriedFam : carried).has(kindOf(b.kind)) && ourKeys.has(factKey(b)) && !keptOnce(owner, b, inc))
          push({ kind: "fact.gone", ...gone(had("facts", seenFact(owner.family ? famKey(owner.partners ?? []) : (owner.person ?? ""), b))), ...owner, was: b });
  };

  /** The sources the file gives a person or a family themselves that the research's record cites nowhere, nor did it when given. */
  const citesDiff = (owner: { person?: string; family?: string; partners?: string[]; name?: string }, inc: SCite[] | undefined, rec: Person | Family | undefined, given: SCite[] | undefined) => {
    const has = rec ? citedIn(rec) : new Set<string>();
    for (const c of given ?? []) has.add(c.source);
    const fresh = (inc ?? []).filter((c, i, all) => !has.has(sources.get(c.source) ?? c.source) && all.findIndex((x) => x.source === c.source) === i);
    if (fresh.length) push({ kind: owner.family || owner.partners ? "family.cite" : "person.cite", action: "add", ...owner, cites: fresh, ...(fresh.some((c) => reads(c.source)) ? { reads: true } : {}) });
  };

  /** A note coming back holds the research's too (the app joins them): only its lines the research has not said. */
  const notesDiff = (owner: { person?: string; family?: string; partners?: string[]; name?: string }, inc: string[] | undefined, said: string[], facts: SFact[]) => {
    const words = new Set(wordsOf([...said, ...facts.map((f) => [f.place, f.value, f.label].join(" "))].join("\n")));
    for (const t of inc ?? []) {
      const fresh = t.split(/\n+/).filter((line) => line.trim() && !knownNote(line, words));
      if (fresh.length && !knownNote(fresh.join("\n"), words)) push({ kind: "note.new", action: "add", ...owner, text: fresh.join("\n") });
    }
  };

  // people
  for (const [key, p] of incoming.persons) {
    const name = p.names[0] ?? "?";
    if (key.startsWith("x:")) {
      push({ kind: "person.new", action: "add", person: key, name });
      factsDiff({ person: key, name }, p.facts, [], undefined, false);
      citesDiff({ person: key, name }, p.cites, undefined, undefined);
      for (const n of p.names.slice(1)) push({ kind: "name.new", action: "add", person: key, name, text: n });
      for (const t of p.notes) push({ kind: "note.new", action: "add", person: key, name, text: t });
      continue;
    }
    const id = resolve(tree, key)!.id;
    const o = ours.persons.get(id);
    const b = base?.persons.get(key);
    if (!o) continue;
    factsDiff({ person: id, name }, p.facts, o.facts, b?.facts, true);
    citesDiff({ person: id, name }, p.cites, tree.get<Person>(id), b?.cites);
    const ourNames = new Set(o.names.map(nameKey));
    const baseNames = new Set((b?.names ?? []).map(nameKey));
    // the name the person is shown by, renamed in the app (the one it was given gone from the file, the research's
    // still that one): a name no record gives is corrected; a record's — the user's edit wins (sync.edits user, an
    // archive: the new one shown, the record's kept beside it), else a conflict for the user (found on Windows: a
    // rename added as another name, the app showing the old one again)
    const [given, now, mine] = [b?.names[0], p.names[0], o.names[0]];
    const userRenamed = !!given && !!now && !!mine && !ourNames.has(nameKey(now)) && !p.names.some((n) => nameKey(n) === nameKey(given));
    const renamed = userRenamed && nameKey(mine!) === nameKey(given!);
    // renamed in the app and by the research since the copy was given: the user's to decide, never only another name
    // beside the research's (found on Mac: "Jonas Berg" added, "Johannes Bergh" shown, the app and the research apart)
    const both = userRenamed && !renamed;
    if (renamed || both) {
      const shown = primaryName(tree.get<Person>(id)!);
      push({ kind: "name.changed", action: renamed && !nameBacked(tree, shown) ? "correct" : edits === "user" ? "user" : "conflict", person: id, name, text: now, wasName: mine });
    }
    for (const n of p.names) if (!((renamed || both) && n === now) && !ourNames.has(nameKey(n)) && !baseNames.has(nameKey(n))) push({ kind: "name.new", action: "add", person: id, name, text: n });
    // the titles of the name they are shown by (T07), each apart and never as a change of the name itself: the user's
    // edit where the file's differs from what the app was given — one the name lacks added, a lead's corrected, a
    // record's name the user's to decide (or their word: sync.edits user, an archive); the research's changed since
    // too: the user's to decide. Without the state it was given only a title the name lacks is taken, another one
    // waits to be picked; a title the file lacks takes nothing away. Asked once: a conflict open with the user's word.
    for (const part of ["before", "after"] as const) {
      const [theirs, mine, given] = [p.titles?.[part] ?? "", o.titles?.[part] ?? "", b?.titles?.[part] ?? ""];
      if (exact(theirs) === exact(mine) || openTitleConflict(tree, id, part, theirs)) continue;
      let action: ChangeAction;
      if (b) {
        if (exact(theirs) === exact(given)) continue;
        const since = exact(mine) !== exact(given);
        action = !mine && !since ? "add" : since || nameBacked(tree, primaryName(tree.get<Person>(id)!)) ? (edits === "user" ? "user" : "conflict") : "correct";
      } else {
        if (!theirs) continue;
        action = mine ? "pick" : "add";
      }
      push({ kind: "name.title", action, person: id, name, text: theirs, title: { part, was: mine } });
    }
    // the sex the user set: written where no record gives the person's facts, the user's to decide where one does
    // (found on Mac: only said, the app told "written", the app and the research apart); the research's unknown (U, which
    // the app cannot keep: it guesses one) counts — the user's edit of a sex given known, the research's U since, is the
    // user's to decide (found on Mac: Erik M → F in the app, U in the research, nothing written, nothing said); a sex
    // given unknown the app only guessed: nothing to tell from it — but a file that writes U where the unknown stands
    // (_STROM_SEX_U, the app's beta.61) gives a sex there only as the user's edit, and an older app's guess is known (a
    // husband male, anyone else female: its reading of SEX U), so another sex is the user's edit (found on Mac: Petr U,
    // guessed male, set female in the app, "changes 0" and the edit lost)
    const [mySex, givenSex] = [o.sex ?? "U", b ? (b.sex ?? "U") : undefined];
    const guessed = givenSex === "U" ? (incoming.sexU ? "U" : b!.husb ? "M" : "F") : undefined;
    if (p.sex && p.sex !== mySex && givenSex !== p.sex && (mySex !== "U" || (givenSex !== undefined && givenSex !== "U") || (guessed !== undefined && p.sex !== guessed))) {
      const backed = (tree.get<Person>(id)?.events ?? []).some((e) => !e.retracted && recordBacked(tree, e));
      const since = givenSex !== undefined && mySex !== givenSex;
      // set otherwise than the app guessed for the research's unknown: the user's to decide, record or none (Milan,
      // 2026-10-04: never lost in silence, a conflict; the app keeps "unknown" only after its 3.9)
      const overGuess = mySex === "U" && guessed !== undefined;
      push({ kind: "sex.changed", action: b ? (edits === "user" ? "user" : backed || since || overGuess ? "conflict" : "correct") : "report", person: id, name, text: p.sex });
    }
    notesDiff({ person: id, name }, p.notes, [o.said, b?.said ?? "", ...o.names], o.facts);
  }
  if (base && !partial)
    for (const [key, b] of base.persons)
      if (!incoming.persons.has(key) && ours.persons.has(key)) push({ kind: "person.gone", ...gone(had("persons", key)), person: key, name: b.names[0] ?? key });

  // families: by their partners — a family of one parent by its children too (the Strom app's beta.39 sends them: one
  // father of two families, each with the children of another mother); one the app gave the other parent since, or
  // took one from, is the same family (its partners one more or one fewer, a child shared): never a second one
  const ourFamilies = new Map(tree.list<Family>("family").filter((f) => !f.retracted).map((f) => [f.id, f]));
  const ourFams = ours.families.filter((o) => o.xref && ourFamilies.has(o.xref));
  // the family as the app was given it: by its ID (the research's export), else — the app's own send (_STROM_SINCE) —
  // by its partners and children
  const baseOf = (id: string, o: SFamily) =>
    base?.families.find((b) => b.xref === id) ??
    base?.families.find((b) => famKey(b.partners) === famKey(o.partners) && (shares(b.children, o.children) || !o.children.length || !b.children.length));
  const taken = new Set<string>();
  const shares = (a: string[], b: string[]) => a.some((c) => b.includes(c));
  const sameKey = (k: string) => incoming.families.filter((f) => famKey(f.partners.map(idOf)) === k).length;
  const fileKids = new Set(incoming.families.flatMap((f) => f.children.map(idOf)));
  // a child of a parent alone here whom the file gives that parent and a partner: moved to them (the other parent
  // added in the app to this child only), never a conflict of parents
  const moved = new Set<string>();
  const movable = (child: string, family: string | undefined, relation: string | undefined, partners: string[]) => {
    const x = bornElsewhere(child, family, relation);
    return x && x.partners.length === 1 && partners.length === 2 && partners.includes(x.partners[0]!) ? x : undefined;
  };
  const matchOf = (partners: string[], kids: string[], union?: Union): SFamily | undefined => {
    const free = ourFams.filter((o) => !taken.has(o.xref!));
    const k = famKey(partners);
    const same = free.filter((o) => famKey(o.partners) === k);
    if (partners.length === 2 && same.length) return same.find((o) => shares(o.children, kids)) ?? same[0];
    // one partner married to somebody unknown: the family of that partner with no child, the same union first
    if (partners.length === 1 && !kids.length) {
      const empty = same.filter((o) => !o.children.length);
      return empty.find((o) => (o.union ?? "") === (union ?? "")) ?? empty[0];
    }
    if (same.length) {
      const by = same.find((o) => shares(o.children, kids));
      if (by) return by;
      // one family of this parent here and one in the file: the same, its children added in the app
      if (same.length === 1 && sameKey(k) === 1) return same[0];
    }
    // the other parent added in the app, or taken from the family: one partner more or fewer, a child shared — never one
    // whose other children the file gives elsewhere (found on Mac: a father added to one child of a mother alone, her
    // other child given him too)
    // the unknown one named in the app: a family of one of them alone with no child, none in the file either
    if (partners.length === 2 && !kids.length) {
      // never while the file still has that one alone (a second marriage beside the first)
      const stillAlone = (k: string) => incoming.families.some((x) => x.partners.length === 1 && !x.children.length && idOf(x.partners[0]!) === k);
      const was = free.filter((o) => o.partners.length === 1 && partners.includes(o.partners[0]!) && !o.children.length && !stillAlone(o.partners[0]!));
      if (was.length === 1) return was[0];
    }
    return free.find((o) => shares(o.children, kids) && !o.children.some((c) => !kids.includes(c) && fileKids.has(c)) && Math.abs(o.partners.length - partners.length) === 1 && (o.partners.every((p) => partners.includes(p)) || partners.every((p) => o.partners.includes(p))) && (o.partners.length || partners.length < 2));
  };
  // a child the research knows as born to other parents: whose parents they are is the user's to decide against the
  // research's, never a second birth family (the parents written so far stay)
  const bornElsewhere = (child: string, family: string | undefined, relation: string | undefined) => {
    if (relation || child.startsWith("x:")) return undefined;
    return [...ourFamilies.values()].find((x) => x.id !== family && x.children.some((c) => c.person === child && c.relation === "birth" && !c.relations));
  };
  const parentsConflict = (child: string, partners: string[], family: string | undefined) => {
    // asked once: the same parents in a conflict still open are nothing new
    const theirs = parentsText(tree, incoming, partners);
    if (tree.list<Conflict>("conflict").some((x) => x.state === "open" && x.fact === "FAMC" && x.subject[0] === child && x.claims[1]?.value === theirs)) return;
    push({ kind: "child.parents", action: "conflict", person: child, name: incoming.persons.get(child)?.names[0] ?? child, partners, ...(family ? { family } : {}), child });
  };
  // the children the file gives the same parents, in however many families (the Strom app draws a "?" per child of one
  // parent and sends a family each — found on Mac: "Marta × Marta" conflicts, her other children said to be gone)
  const kidsOfParents = new Map<string, Set<string>>();
  for (const f of incoming.families) {
    const k = famKey(f.partners.map(idOf));
    const set = kidsOfParents.get(k) ?? kidsOfParents.set(k, new Set()).get(k)!;
    for (const c of f.children) set.add(idOf(c));
  }
  /** The research's birth family of a child whose parents are these: the same family, split in the file. */
  const sameParents = (child: string, partners: string[]) =>
    partners.length > 0 && [...ourFamilies.values()].some((x) => famKey(x.partners) === famKey(partners) && x.children.some((c) => c.person === child && c.relation === "birth"));
  for (const f of incoming.families) {
    const partners = f.partners.map(idOf);
    const kids = f.children.map(idOf);
    const fileKey = (c: string) => f.children[kids.indexOf(c)] ?? c;
    // a child tied otherwise to each parent: "split" where one word for both is wanted, each parent's tie beside it
    const rel = (c: string) => f.relations?.[fileKey(c)] ?? (f.relationsBy?.[fileKey(c)] ? "split" : undefined);
    const tiesOf = (cs: string[]) => {
      const out: Record<string, Record<string, string>> = {};
      for (const c of cs) {
        const by = f.relationsBy?.[fileKey(c)];
        if (by) out[c] = Object.fromEntries(Object.entries(by).map(([p, r]) => [idOf(p), r]));
      }
      return Object.keys(out).length ? { ties: out } : {};
    };
    const o = matchOf(partners, kids, f.union);
    const fam = o ? ourFamilies.get(o.xref!) : undefined;
    if (!o || !fam) {
      if (!partners.length && !kids.length) continue;
      // a child already the research's with these very parents: nothing new of them, nothing to decide
      const home = kids.filter((c) => !rel(c) && sameParents(c, partners));
      const moves = kids.filter((c) => !home.includes(c)).map((c) => [c, movable(c, undefined, rel(c), partners)] as const).filter((m): m is readonly [string, Family] => !!m[1]);
      const elsewhere = kids.filter((c) => !home.includes(c) && bornElsewhere(c, undefined, rel(c)) && !moves.some(([m]) => m === c));
      for (const c of elsewhere) parentsConflict(c, partners, undefined);
      const rest = kids.filter((c) => !home.includes(c) && !elsewhere.includes(c) && !moves.some(([m]) => m === c));
      const move = () => {
        for (const [c, x] of moves) {
          moved.add(`${x.id}|${c}`);
          push({ kind: "child.moved", action: "add", family: x.id, partners, child: c, person: c, name: incoming.persons.get(fileKey(c))?.names[0] ?? c });
        }
      };
      // one parent and none of their children left: nothing of a family to write — unless it is one partner married to
      // somebody unknown (the Strom app's beta.55: a "?" with no child), something of a couple said of it
      const alone = partners.length === 1 && !kids.length && !!(f.union || f.facts.length || f.cites?.length || f.notes?.length);
      if ((partners.length < 2 || home.length) && !rest.length && !alone) continue;
      // the family made first, the children moved to it after
      // a new family with its facts, their sources and the people they name
      push({ kind: "family.new", action: "add", partners, text: rest.map((c) => (rel(c) && rel(c) !== "split" ? `${c}:${rel(c)}` : c)).join(" "), ...tiesOf(rest), ...(f.noCouple ? { noCouple: true as const } : {}), ...(f.union ? { union: f.union } : {}) });
      if (partners.length) {
        for (const x of f.facts) push({ kind: "fact.new", action: "add", partners, fact: x, ...((x.cites ?? []).some((c) => reads(c.source)) ? { reads: true } : {}) });
        citesDiff({ partners }, f.cites, undefined, undefined);
        for (const t of f.notes ?? []) push({ kind: "note.new", action: "add", partners, text: t });
      }
      move();
      continue;
    }
    taken.add(fam.id);
    const b = baseOf(fam.id, o);
    // its partners as the research has them, the one the app added next to them
    for (const p of partners) if (!o.partners.includes(p)) push({ kind: "partner.new", action: "add", family: fam.id, partners: o.partners, person: p, name: incoming.persons.get(p)?.names[0] ?? p, ...(f.noCouple ? { noCouple: true as const } : {}) });
    for (const p of o.partners)
      if (!partners.includes(p) && b?.partners.includes(p) && !partial && incoming.persons.has(p)) push({ kind: "partner.gone", ...gone(had("persons", p)), family: fam.id, partners, person: p, name: ours.persons.get(p)?.names[0] ?? p });
    const known = new Set([...o.children, ...(b?.children ?? [])]);
    for (const c of kids)
      if (!known.has(c)) {
        const x = movable(c, fam.id, rel(c), partners);
        if (x) {
          moved.add(`${x.id}|${c}`);
          push({ kind: "child.moved", action: "add", family: x.id, partners, child: c, person: c, name: incoming.persons.get(fileKey(c))?.names[0] ?? c, text: fam.id });
        } else if (bornElsewhere(c, fam.id, rel(c))) parentsConflict(c, partners, fam.id);
        else push({ kind: "child.new", action: "add", family: fam.id, partners, child: c, ...(rel(c) && rel(c) !== "split" ? { text: rel(c) } : {}), ...tiesOf([c]) });
      }
    // how a child the research has here is tied to each parent (the app's step-, adoptive or foster child): the file's
    // word added where the research says birth, the user's edit since it was given taken — else only said; a word the
    // research has none for, said (found on Mac: a stepchild lost both ways, nothing said)
    for (const c of kids) {
      if (!o.children.includes(c) || c.startsWith("x:")) continue;
      for (const said of f.relationsUnknown?.[fileKey(c)] ?? []) push({ kind: "child.relation", action: "report", family: fam.id, partners, child: c, person: c, name: incoming.persons.get(fileKey(c))?.names[0] ?? c, text: said });
      const shared = o.partners.filter((p) => partners.includes(p));
      if (!shared.length) continue;
      const theirs = Object.fromEntries(shared.map((p) => [p, tieOf(f, fileKey(c), f.partners[partners.indexOf(p)] ?? p)]));
      const mine = Object.fromEntries(shared.map((p) => [p, tieOf(o, c, p)]));
      const given = b?.children.includes(c) ? Object.fromEntries(shared.map((p) => [p, tieOf(b, c, p)])) : undefined;
      const same = (x: Record<string, string>, y: Record<string, string>) => shared.every((p) => x[p] === y[p]);
      if (same(theirs, mine) || (given && same(theirs, given))) continue;
      // only more said where the research says birth: the file's word; the user's edit of what was given: theirs; a tie
      // the file no longer names (a copy of the app from an export that did not give it: PEDI step it never read) only said
      const less = shared.some((p) => theirs[p] === "birth" && mine[p] !== "birth");
      const adds = shared.every((p) => theirs[p] === mine[p] || mine[p] === "birth");
      const action = less ? "report" : adds ? "add" : given && same(given, mine) ? "correct" : "report";
      push({ kind: "child.relation", action, family: fam.id, partners, child: c, person: c, name: incoming.persons.get(fileKey(c))?.names[0] ?? c, ties: { [c]: theirs }, text: shared.map((p) => `${p}:${theirs[p]}`).join(" ") });
    }
    const both = [...new Set([...o.partners, ...partners])];
    factsDiff({ family: fam.id, partners: both }, f.facts, o.facts, b?.facts, true);
    citesDiff({ family: fam.id, partners: both }, f.cites, fam, b?.cites);
    notesDiff({ family: fam.id, partners: both }, f.notes, [o.said ?? "", b?.said ?? "", ...both.map((k) => ours.persons.get(k)?.names.join(" ") ?? "")], o.facts);
    // how the couple is bound (no record proves it): the user's word where it changed since given, or where the research
    // has none; another word with nothing to stand on only said; none in the file takes nothing away (an older app)
    // (the one partner's married or divorced is the couple's facts' to say once the unknown one is named)
    const said = (u: Union | undefined) => (partners.length === 2 && (u === "married" || u === "divorced") ? "" : (u ?? ""));
    // a "?" of one child: the Strom app never writes its union (married is its every family's, "to itself"; it has no
    // "none" to set) — nothing in the file is nothing taken away (found on Mac: F0001 lost married at each send)
    const mute = partners.length === 1 && kids.length === 1 && !f.union;
    if (!mute && (f.union ?? "") !== said(o.union) && (!b || said(b.union) !== (f.union ?? "")) && (f.union || b)) {
      const action = mirror || b || !o.union ? "correct" : "report";
      push({ kind: "family.union", action, family: fam.id, partners: both, ...(f.union ? { union: f.union } : {}), wasUnion: o.union ?? "" });
    }
    if (b && !partial) {
      const now = new Set([...kids, ...(kidsOfParents.get(famKey(partners)) ?? [])]);
      for (const c of b.children) if (!now.has(c) && o.children.includes(c) && incoming.persons.has(c)) push({ kind: "child.gone", ...gone(had("children", `${famKey(f.partners)}|${c}`)), family: fam.id, partners, child: c, person: c, name: ours.persons.get(c)?.names[0] ?? incoming.persons.get(c)?.names[0] ?? c });
    }
  }

  // a child moved to the other parent added in the app: no longer in the family of the one, nothing gone
  if (moved.size) {
    for (let i = changes.length - 1; i >= 0; i--) if (changes[i]!.kind === "child.gone" && moved.has(`${changes[i]!.family}|${changes[i]!.child}`)) changes.splice(i, 1);
    changes.forEach((c, i) => (c.n = i + 1));
  }

  // places on the map: no record proves a position, so the user's is taken — set where the research has none,
  // or changed in the app since it was given (the research's as it was given); anything else only when picked
  const ourPlaces = researchPlaces(tree);
  for (const [k, p] of incoming.places ?? []) {
    const mine = ourPlaces.get(k);
    const here = mine?.coords;
    if (here && samePoint(here, p)) continue;
    const given = base?.places?.get(k);
    if (given && samePoint(given, p)) continue; // as it was given: the research moved it since
    const action = !here || (given && samePoint(given, here)) || mirror ? "set" : "pick";
    push({ kind: "place.coords", action, place: { ...p, ...(mine ? { id: mine.id } : {}), ...(here ? { was: here } : {}) } });
  }
  if (incoming.head && opts.takenBack !== false && !sentAgain) takenBack(tree, incoming, edits, changes);
  // a send of the app (`sent`: it came through the bridge) with nothing to stand on (no _STROM_HEAD, no _STROM_SINCE the research still has —
  // found on Mac after the app set itself back to its state before a load): nobody picks from a send the bridge wrote,
  // so nothing waits "to pick" with nothing to pick — a value it has otherwise than the research is the user's to decide
  // (a conflict; the user's word in an archive or with sync.edits user), the one other value of a kind there may be
  // more of (an occupation) that value edited, never a second fact beside it; anything else only said
  if (!base && opts.sent) {
    const decide = edits === "user" || mirror ? "user" : "conflict";
    const fresh = new Map<string, Change[]>();
    for (const c of changes)
      if (c.kind === "fact.new" && c.person && c.fact && !c.person.startsWith("x:") && !ONE.has(kindOf(c.fact.kind)))
        (fresh.get(`${c.person}|${kindOf(c.fact.kind)}`) ?? fresh.set(`${c.person}|${kindOf(c.fact.kind)}`, []).get(`${c.person}|${kindOf(c.fact.kind)}`)!).push(c);
    for (const [k, news] of fresh) {
      const [person, kind] = k.split("|") as [string, string];
      const theirs = new Set((incoming.persons.get(person)?.facts ?? []).map(factKey));
      const gone = (ours.persons.get(person)?.facts ?? []).filter((o) => kindOf(o.kind) === kind && o.id && !theirs.has(factKey(o)));
      if (news.length !== 1 || gone.length !== 1) continue;
      const c = news[0]!;
      if (openConflict(tree, person, c.fact!)) Object.assign(c, { action: "report" as const });
      else Object.assign(c, { kind: "fact.changed" as const, action: decide, was: gone[0] });
    }
    for (const c of changes) {
      if (c.action !== "pick") continue;
      if ((c.kind === "fact.differs" || c.kind === "fact.detail") && c.was?.id && c.fact)
        Object.assign(c, { action: openConflict(tree, c.person ?? c.family, c.fact) ? "report" : decide });
      else Object.assign(c, { action: "report" as const });
    }
  }
  // a change not written leaves out the sources the user gave its fact too: said with it, never lost in silence
  for (const c of changes) {
    if ((c.action !== "report" && c.action !== "pick") || !c.fact?.cites?.length) continue;
    const mine = c.was?.id ? eventById(tree, c.was.id) : undefined;
    const has = new Set(mine?.citations.map((x) => x.source) ?? []);
    const left = c.fact.cites.filter((x) => !has.has(sources.get(x.source) ?? x.source)).map((x) => x.source);
    if (left.length) c.uncited = [...new Set(left)];
  }
  return { changes, sources, base: !!base, ...(incoming.head ? { head: incoming.head } : {}), partial, identity };
}

/**
 * The send a copy of the app says it is a copy of (_STROM_SINCE R…, the app's beta.34): that send as it came, kept, its
 * new people and sources under the IDs the research gave them — the user's edits since are what differs from it (what
 * the research wrote after _STROM_HEAD the app lacks: never taken for removed). Its copy gone (tidied): undefined, the
 * rule before it holds.
 */
function sinceBase(tree: Tree, incoming: Snapshot): Snapshot | undefined {
  if (!incoming.since) return undefined;
  const r = receivedAll(tree.root).find((x) => x.intake === incoming.since);
  // a send written, taken back — or one that brought nothing new (its copy is what the app had then all the same)
  if (!r?.keptAs || !["written", "undone", "nothing"].includes(r.state) || (r.state !== "nothing" && !r.input)) return undefined;
  if (incoming.appTree && r.tree && r.tree !== incoming.appTree) return undefined;
  const file = path.join(tree.root, SYNC_INBOX, r.keptAs);
  const input = r.input ? tree.get<SyncInput>(r.input) : undefined;
  if (!fs.existsSync(file) || (r.input && !input?.sync)) return undefined;
  try {
    // the people and sources it brought, as the research named them: what the app's copy now calls them
    const named = new Map<string, string>();
    for (const a of input?.sync?.applied ?? []) if ((a.do === "person.add" || a.do === "source.add") && typeof a.before === "string" && a.before.startsWith("x:")) named.set(`@${a.before.slice(2)}@`, a.id);
    const text = fs
      .readFileSync(file, "utf8")
      .replace(/\r\n?/g, "\n")
      .replace(/^0 (@[^@\s]+@) (INDI|SOUR)[^\n]*$/gm, (line, xref: string, tag: string) => {
        const id = named.get(xref);
        return !id ? line : tag === "INDI" ? `${line}\n1 REFN ${id}\n2 TYPE ${REFN_TYPE}` : `${line}\n1 REFN ${id}`;
      });
    return readGedcom(text);
  } catch {
    return undefined;
  }
}

/**
 * The state a copy without _STROM_SINCE stands on: the research after the last send of its tree of the app written since
 * its _STROM_HEAD whose values it carries — it is the copy that sent them (or one that had them). A copy that carries
 * the values of an earlier one only (a copy kept from before: another device, a file taken in again) stands there,
 * never on the later ones (found on Mac: a place set back by such a copy, the user's newer word gone). A copy that
 * carries none of them, moved on from all of them where they wrote: the copy that sent them, edited further. Else
 * another copy of the same tree (another window, another device: found on Mac, ten newer occupations set back in
 * silence by one edit) — or the user set every one of them back: its _STROM_HEAD, and each fact those sends wrote that
 * the copy has otherwise is kept, said (`sentSince`: the owner's ID | the fact's key) — never written back in silence.
 * A value an earlier send wrote that a later one changed (`sentBefore`): a copy kept from before, or the user set it
 * back — the same file either way: the user decides.
 */
function afterSends(tree: Tree, incoming: Snapshot): { base: Snapshot | undefined; sentSince?: Set<string>; sentBefore?: Set<string> } {
  const head = incoming.head!;
  const commits = sendsSince(tree, incoming, 30);
  if (!commits.length) return { base: snapshotAt(tree, head) };
  const last = commits.length - 1;
  // the people each send wrote of (its own commit) that the copy has: only theirs are compared send by send — a state of
  // the whole research is rebuilt once or twice (a tree of 2 200 people: more than a second each)
  const of = commits.map((c) => {
    const r = git.runGit(tree.root, ["diff-tree", "--no-commit-id", "--name-only", "-r", `${c}^`, c, "--", "data/persons"]);
    return (r.status === 0 ? r.stdout.split("\n") : []).map((f) => /^data\/persons\/(.+)\.json$/.exec(f.trim())?.[1]).filter((id): id is string => !!id && incoming.persons.has(id));
  });
  const only = new Set(of.flat());
  const part = new Map<string, Snapshot | undefined>();
  const partAt = (rev: string) => {
    if (!part.has(rev)) part.set(rev, rebuiltAt(tree, rev, only));
    return part.get(rev);
  };
  const keysOf = (facts: SFact[] | undefined, kind: string) => (facts ?? []).filter((f) => kindOf(f.kind) === kind).map(factKey).sort().join("\n");
  /** What a state has of a person's facts that the one before lacks (the owner's ID | the fact's key), and where (ID | kind). */
  const wrote = (before: Snapshot, after: Snapshot) => {
    const out: { id: string; kind: string; key?: string; family?: true }[] = [];
    for (const [id, p] of after.persons) {
      const was = before.persons.get(id);
      if (!was) {
        out.push({ id, kind: "" });
        continue;
      }
      const known = new Set(was.facts.map(factKey));
      for (const f of p.facts) if (!known.has(factKey(f))) out.push({ id, kind: kindOf(f.kind), key: factKey(f) });
    }
    for (const f of after.families) {
      const was = before.families.find((x) => x.xref === f.xref);
      if (!was || !f.xref) continue;
      const known = new Set(was.facts.map(factKey));
      for (const x of f.facts) if (!known.has(factKey(x))) out.push({ id: f.xref, kind: kindOf(x.kind), key: factKey(x), family: true });
    }
    return out;
  };
  const keys = (ws: ReturnType<typeof wrote>) => new Set(ws.filter((w) => w.key).map((w) => `${w.id}|${w.key}`));
  // from the newest send back: the last one whose values the copy has where it wrote (a person it brought, by its ID) —
  // a value it was given as well is no sign (a send that set one back: found on Mac, an occupation)
  const start = partAt(head);
  for (let i = last; i >= 0; i--) {
    if (!of[i]!.length) continue;
    const [before, after] = [partAt(`${commits[i]}^`), partAt(commits[i]!)];
    if (!before || !after || !start) break;
    const carries = wrote(before, after).some((w) => {
      if (!w.kind) return incoming.persons.has(w.id);
      const theirs = keysOf(incoming.persons.get(w.id)?.facts, w.kind);
      return theirs === keysOf(after.persons.get(w.id)?.facts, w.kind) && theirs !== keysOf(start.persons.get(w.id)?.facts, w.kind);
    });
    if (!carries) continue;
    const base = snapshotAt(tree, commits[i]!);
    if (i === last || !base) return { base };
    const [given, now] = [snapshotAt(tree, head), snapshotAt(tree, commits[last]!)];
    return { base, ...(now ? { sentSince: keys(wrote(base, now)) } : {}), ...(given ? { sentBefore: keys(wrote(given, base)) } : {}) };
  }
  const [given, sent] = [snapshotAt(tree, head), snapshotAt(tree, commits[last]!)];
  if (!given || !sent) return { base: sent ?? given };
  const brought = wrote(given, sent).filter((w) => w.key);
  // none of their values, nor what it was given, where they wrote: the copy that sent them, its edits since
  const states = [head, ...commits].map(partAt);
  const moved = brought.some((w) => {
    if (w.family || !only.has(w.id)) return false;
    const theirs = keysOf(incoming.persons.get(w.id)?.facts, w.kind);
    return states.every((s) => !s?.persons.has(w.id) || keysOf(s.persons.get(w.id)!.facts, w.kind) !== theirs);
  });
  if (moved || !brought.length) return { base: sent };
  return { base: given, sentSince: keys(brought) };
}

/**
 * The commits of the newest sends of this tree of the app the research wrote since its copy's _STROM_HEAD, the oldest
 * first (an app that does not load the research after a send: what it sent is what it has — found on Mac: a value set
 * back to what the app was given counted as "no edit", the research's own kept, and an edit of a value written by an
 * earlier send added as a fact beside it).
 */
function sendsSince(tree: Tree, incoming: Snapshot, max: number): string[] {
  const head = incoming.head!;
  if (!incoming.appTree) return [];
  const written = new Set(receivedAll(tree.root).filter((r) => r.tree === incoming.appTree && r.state === "written" && r.input).map((r) => r.input!));
  if (!written.size) return [];
  // the commits since it that brought each input (one send, one commit), the newest first
  const r = git.runGit(tree.root, ["log", "--diff-filter=A", "--name-only", "--format=%x1e%H", `${head}..HEAD`, "--", "data/inputs"]);
  if (r.status !== 0) return [];
  const out: string[] = [];
  for (const entry of r.stdout.split("\x1e").slice(1)) {
    const [commit, ...files] = entry.trim().split("\n");
    if (files.some((f) => written.has(/^data\/inputs\/(I\d+)\.json$/.exec(f.trim())?.[1] ?? "")) && commit) out.unshift(commit);
    if (out.length >= max) break;
  }
  return out;
}

/** What a change brings, whatever the research does with it: the same edit sent twice is one. */
const changeKey = (c: Change) =>
  JSON.stringify([
    c.kind,
    c.person?.startsWith("x:") ? c.name : c.person,
    c.family,
    [...(c.partners ?? [])].sort(),
    c.child,
    c.text,
    c.fact ? factKey(c.fact) : "",
    c.fact ? detailsOf(c.fact) : "",
    c.part ? [c.part.role, c.part.person, c.part.name] : "",
    c.source,
    c.place ? [c.place.name, c.place.lat, c.place.lon] : "",
    (c.cites ?? []).map((x) => [x.source, x.page]),
  ]);

/**
 * The sends of this tree of the app taken back (strom sync undo) after the state its copy was made from: the copy still
 * carries what they brought — left out, said (`takenBack`), never written again silently (found on Windows: the app
 * that does not load the research after a send brought an undone birth back with its next edit). Sent again by the
 * user (POST /sync/<R…>/again): theirs.
 */
function takenBack(tree: Tree, incoming: Snapshot, edits: "conflict" | "user", changes: Change[]): void {
  const all = receivedAll(tree.root).filter((r) => r.state === "undone" && !r.again && r.keptAs && r.decided && (!incoming.appTree || !r.tree || r.tree === incoming.appTree));
  if (!all.length) return;
  const at = Date.parse(git.runGit(tree.root, ["show", "-s", "--format=%cI", incoming.head!]).stdout?.trim() ?? "");
  if (!Number.isFinite(at)) return;
  // the commit's time is in whole seconds, an undo's to the millisecond: one in the same second as it is not after it
  const undone = all.filter((r) => Date.parse(r.decided!) >= at + 1000);
  for (const r of undone) {
    const file = path.join(tree.root, SYNC_INBOX, r.keptAs!);
    let theirs: Change[];
    try {
      theirs = planSync(tree, readTreeFile(file), edits, { force: true, takenBack: false }).changes;
    } catch {
      continue;
    }
    const keys = new Set(theirs.map(changeKey));
    for (const c of changes) if (!c.takenBack && c.action !== "report" && keys.has(changeKey(c))) Object.assign(c, { action: "report", takenBack: r.intake });
  }
}

/** The words of an entry for a comparison: the marks of a text (<u>…</u>) the Strom app leaves out, spaces and case aside. */
const entryWords = (s: string | undefined) => exact(s?.replace(/<\/?[a-z][^<>]*>/gi, ""));

/** Every source a record cites anywhere in it (its own citations, its facts', its children's). */
function citedIn(rec: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (x: unknown) => {
    if (Array.isArray(x)) for (const y of x) walk(y);
    else if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      if (typeof o.source === "string" && /^S\d+$/.test(o.source)) out.add(o.source);
      for (const v of Object.values(o)) walk(v);
    }
  };
  walk(rec);
  return out;
}

/** Folded for matching an entry: no accents, case, stops or doubled spaces. */
const entryKey = (s: string | undefined) => fold((s ?? "").replace(/[.,;:]/g, " "));

/** The research's source of the same entry as the file's: the same title, page and archive, and the same words (or one has none). */
function sameEntry(tree: Tree, ours: Source, page: string | undefined, theirs: SSource): boolean {
  const repoOf = (s: Source) => {
    const id = s.repository ?? (s.recordset ? tree.get<RecordSet>(s.recordset)?.repository : undefined);
    return id ? tree.get<Repository>(id)?.name : undefined;
  };
  // a whole book (no page, no words): its exact title and archive
  if (!page && !ours.transcript && !theirs.page && !theirs.text) return exact(ours.title) === exact(theirs.title) && exact(repoOf(ours)) === exact(theirs.repo);
  if (entryKey(ours.title) !== entryKey(theirs.title) || entryKey(page) !== entryKey(theirs.page) || entryKey(repoOf(ours)) !== entryKey(theirs.repo)) return false;
  return !ours.transcript || !theirs.text || exact(ours.transcript) === exact(theirs.text);
}

/** Whether the research itself read the source: its own (not the app's), or an agent edited the app's. */
export function researchRead(tree: Tree, s: Source, read: Set<string> = readByResearch(tree)): boolean {
  return !s.app || read.has(s.id);
}

/**
 * The sources an agent's session edited — read once for a whole sync (found with a tree of 2 200 people: every fact's
 * sources asked of every operation, 60 % of an adoption's time).
 */
export function readByResearch(tree: Tree): Set<string> {
  const sessions = new Set(tree.list<Session>("session").map((x) => x.id));
  const out = new Set<string>();
  for (const op of tree.readOps()) if (op.op === "source.edit" && sessions.has(op.by)) for (const t of op.targets ?? []) out.add(t);
  return out;
}

/**
 * The file's sources against the research's: each of the research (its REFN, or the same entry a sync took in
 * before), or new. Of the research's, what the user changed in the app since it was given — the app's own source
 * corrected, a record the research read a second reading beside it — and "transcript verified" ticked.
 */
function planSources(tree: Tree, incoming: Snapshot, ours: Snapshot, base: Snapshot | undefined, push: (c: Omit<Change, "n">) => void): Map<string, string> {
  const map = new Map<string, string>();
  let readSet: Set<string> | undefined;
  if (!incoming.sources?.size) return map;
  const live = tree.list<Source>("source").filter((s) => !s.retracted);
  const pageOf = (s: Source) => s.locator ?? ours.sources?.get(s.id)?.page;
  for (const [key, inc] of incoming.sources) {
    let mine = key.startsWith("x:") ? undefined : tree.get<Source>(key);
    for (let hops = 0; mine?.mergedInto && hops < 10; hops++) mine = tree.get<Source>(mine.mergedInto);
    if (mine && (mine.type !== "source" || mine.retracted)) mine = undefined;
    // one the research has: the same entry (a send the app has not had back yet)
    mine ??= live.find((s) => sameEntry(tree, s, pageOf(s), inc));
    if (!mine) {
      if (inc.title || inc.text) push({ kind: "source.new", action: "add", source: key, text: inc.title || inc.text!.slice(0, 60) });
      continue;
    }
    map.set(key, mine.id);
    if (key.startsWith("x:")) continue;
    // what the user changed in the app since it was given: a word or page they wrote (none taken away)
    const b = base?.sources?.get(key);
    const o = ours.sources?.get(mine.id);
    if (b) {
      const was = { text: [b.text, o?.text, mine.transcript], page: [b.page, o?.page, mine.locator] };
      const edited = (["text", "page"] as const).filter((f) => inc[f] && was[f].every((x) => entryWords(inc[f]) !== entryWords(x)));
      const read = researchRead(tree, mine, (readSet ??= readByResearch(tree)));
      // a reading of the user's kept beside the research's already (an earlier send of the same): nothing again
      const kept = read && mine.notes.some((n) => edited.every((f) => exact(n.text).includes(entryWords(inc[f]))));
      if (edited.length && !kept) {
        push({ kind: read ? "source.reading" : "source.changed", action: read ? "add" : "correct", source: key, sourceId: mine.id, text: mine.title, ...(!read && (incoming.transcripts === "evidence" || mine.app?.read) ? { reads: true } : {}) });
      }
    }
    if (inc.verified && mine.app && !mine.app.verified) push({ kind: "source.verified", action: "add", source: key, sourceId: mine.id, text: mine.title });
  }
  return map;
}

/**
 * Whether a fact citing the file's source will stand on the user's reading of a record: a record (not a family tree,
 * not authored) whose transcript counts — the app's own source when the send says evidence, or verified (now or
 * before); the research's own one cited by the user when the send says evidence.
 */
function readsFor(tree: Tree, incoming: Snapshot, sources: Map<string, string>, changes: Change[]): (key: string) => boolean {
  const evidence = incoming.transcripts === "evidence";
  return (key: string) => {
    const inc = incoming.sources?.get(key);
    const id = sources.get(key);
    if (!id) {
      // new: the app's quality 0 is someone's word, no record
      return !!inc && inc.quay !== 0 && (evidence || !!inc.verified);
    }
    const s = tree.get<Source>(id)!;
    if (isWeak(s)) return false;
    if (!s.app) return evidence;
    const now = changes.some((c) => c.sourceId === id && (c.kind === "source.verified" || (c.kind === "source.changed" && evidence)));
    return s.app.read || now;
  };
}

/** The sources a fact of the file cites that the research's fact does not, nor did it when given. */
function newCites(tree: Tree, f: SFact, ours: SFact[], given: SFact[], sources: Map<string, string>, family?: string): SCite[] {
  const events = ours.map((o) => (o.id ? eventById(tree, o.id) : undefined)).filter((e): e is Event => !!e);
  if (!events.length) return [];
  const has = new Set([...events.flatMap((e) => e.citations.map((c) => c.source)), ...given.flatMap((g) => (g.cites ?? []).map((c) => c.source))]);
  // a couple: the Strom app keeps one list of the union's sources and gives them back under its marriage (its 3.9) —
  // what the family itself cites (the couple, a child's parents) is no news there
  if (family) for (const id of citedIn(tree.get<Family>(family))) has.add(id);
  return (f.cites ?? []).filter((c) => !has.has(sources.get(c.source) ?? c.source));
}

/** The research's places by placeKey of each of their names — one with coordinates first, as the export gives them. */
function researchPlaces(tree: Tree): Map<string, Place> {
  const out = new Map<string, Place>();
  for (const p of tree.list<Place>("place"))
    if (!p.retracted) for (const n of p.names) if (!out.has(placeKey(n.name)) || (p.coords && !out.get(placeKey(n.name))!.coords)) out.set(placeKey(n.name), p);
  return out;
}

/** Does the research's fact say all the file's fact says, and more: the same kind, and each of its date, place, value the same or missing in the file. */
/**
 * The Strom app keeps a couple's marriages and divorces as the course of one union: two marriages with no divorce
 * between are one marriage to it, the first (found live, 2026-09-27: a marriage from the register and a later
 * record's other date). A further one of these missing while the file has one of that kind is its shape, not an edit.
 */
const UNION_KINDS = new Set(["MARR", "DIV"]);

function keptOnce(owner: { family?: string }, gone: SFact, file: SFact[]): boolean {
  const kind = kindOf(gone.kind);
  return !!owner.family && UNION_KINDS.has(kind) && file.some((f) => kindOf(f.kind) === kind);
}

/**
 * The fact a file's new fact of a kind there may be more of was, edited in the app (the occupation "seamstress" now
 * "washerwoman"): of the facts of that kind the research gave, one the file no longer has — the only one gone where
 * only this one is new, else the one that shares its day, place or value with it (just one such). None: an addition.
 */
function editOf(f: SFact, given: SFact[], inc: SFact[], our: SFact[]): SFact | undefined {
  const kind = kindOf(f.kind);
  const incKeys = new Set(inc.map(factKey));
  const gone = given.filter((b) => kindOf(b.kind) === kind && !incKeys.has(factKey(b)) && our.some((o) => factKey(o) === factKey(b)));
  if (!gone.length) return undefined;
  const known = new Set([...given, ...our].map(factKey));
  const fresh = inc.filter((x) => kindOf(x.kind) === kind && !known.has(factKey(x)) && !our.some((o) => knowsMore(o, x)));
  if (gone.length === 1 && fresh.length === 1) return gone[0];
  const shares = (a: SFact, b: SFact) => (["date", "place", "value"] as const).filter((k) => a[k] && b[k] && exact(a[k]) === exact(b[k])).length;
  const best = Math.max(...gone.map((b) => shares(f, b)));
  const alike = gone.filter((b) => shares(f, b) === best);
  return best > 0 && alike.length === 1 ? alike[0] : undefined;
}

function knowsMore(ours: SFact, file: SFact): boolean {
  if (kindOf(ours.kind) !== kindOf(file.kind)) return false;
  const same = (a: string | undefined, b: string | undefined) => !b || exact(a) === exact(b);
  return same(ours.date, file.date) && same(ours.place, file.place) && same(ours.value, file.value) && (!file.date || !!ours.date) && !(file.kind === "EVEN" && file.label && ours.label && !file.date && !file.place && fold(ours.label) !== fold(file.label));
}

/** A date of a day, a month or a year, with nothing about it (no ABT, BEF, BET…). */
const PLAIN_DATE = /^(?:(?:\d{1,2} )?(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC) )?\d{3,4}$/;

/** Does a plain date of the file lie in the research's date: the same, a day of its month or year, or in its range. */
function dateWithin(ours: string, file: string): boolean {
  if (ours === file) return true;
  if (!PLAIN_DATE.test(file)) return false;
  if (PLAIN_DATE.test(ours)) return file.endsWith(` ${ours}`);
  const year = Number(/\d{3,4}$/.exec(file)![0]);
  const q = /^(ABT|CAL|EST) (.+)$/.exec(ours);
  if (q && PLAIN_DATE.test(q[2]!)) return dateWithin(q[2]!, file);
  const bet = /^BET (.+) AND (.+)$/.exec(ours);
  if (bet && PLAIN_DATE.test(bet[1]!) && PLAIN_DATE.test(bet[2]!)) return year >= dateYears(bet[1]!)[0]! && year <= dateYears(bet[2]!)[0]!;
  const side = /^(BEF|AFT) (\d{3,4})$/.exec(ours);
  if (side) return side[1] === "BEF" ? year < Number(side[2]) : year > Number(side[2]);
  return false;
}

/**
 * Does the file's fact only add to the research's: the same kind, each of its date, place, value either the
 * research's, or where the research has none, or more exact within it (a day of its year, the place with more after
 * a comma) — and something more. Nothing of it disagrees with what a record says.
 */
function addsTo(ours: SFact, file: SFact): boolean {
  if (kindOf(ours.kind) !== kindOf(file.kind)) return false;
  if (file.kind === "EVEN" && ours.label && file.label && fold(ours.label) !== fold(file.label)) return false;
  const date = !ours.date || (!!file.date && dateWithin(ours.date, file.date));
  const [op, fp] = [exact(ours.place), exact(file.place)];
  const place = !op || fp === op || fp.startsWith(`${op},`);
  const value = !exact(ours.value) || exact(file.value) === exact(ours.value);
  return date && place && value && factKey(ours) !== factKey(file);
}

/** An open conflict whose claims hold this value for the person or family already. */
function openConflict(tree: Tree, owner: string | undefined, f: SFact): boolean {
  return openClaim(tree, owner, describe(f));
}

function openClaim(tree: Tree, owner: string | undefined, value: string): boolean {
  if (!owner) return false;
  return tree.list<Conflict>("conflict").some((x) => x.state === "open" && x.subject.includes(owner) && x.claims.some((c) => c.value === value));
}

/** A participant's name as a snapshot has it: theirs, or the name of the person of it. */
function partName(p: SPart, snap: Snapshot): string {
  return (p.name ?? (p.person ? snap.persons.get(p.person)?.names[0] : undefined) ?? p.person ?? "?").replace(/\//g, "").replace(/\s+/g, " ").trim();
}

/** A participant for a conflict's claim: their role and name ("godparent Jan Novák"). */
function partText(p: SPart, snap: Snapshot): string {
  return `${p.role} ${partName(p, snap)}`;
}

/**
 * People the file brings without our ID whom the research has already — a sync took them in before the app got
 * them back with their ID: the same name and the same birth, or the same name and the same parents (or partner, neither
 * born when). They are ours.
 */
function knownNewcomers(incoming: Snapshot, ours: Snapshot): void {
  const birth = (p: SPerson) => p.facts.find((f) => kindOf(f.kind) === "BIRT" || kindOf(f.kind) === "BAPM");
  const parents = (snap: Snapshot, key: string) => new Set(snap.families.filter((f) => f.children.includes(key)).flatMap((f) => f.partners));
  const partners = (snap: Snapshot, key: string) => new Set(snap.families.filter((f) => f.partners.includes(key)).flatMap((f) => f.partners.filter((x) => x !== key)));
  for (const [key, p] of [...incoming.persons]) {
    if (!key.startsWith("x:")) continue;
    const names = new Set(p.names.map(nameKey));
    const b = birth(p);
    const theirParents = parents(incoming, key);
    const theirPartners = [...partners(incoming, key)].filter((x) => !x.startsWith("x:"));
    const hit = [...ours.persons.values()].find((o) => {
      if (!o.names.some((n) => names.has(nameKey(n)))) return false;
      const ob = birth(o);
      if (b && ob) return factKey(b) === factKey(ob);
      const op = parents(ours, o.key);
      if (theirParents.size > 0 && [...theirParents].every((x) => op.has(x))) return true;
      // or the wife or husband of the same one of ours (a spouse the user added, sent again before the app had them back)
      const os = partners(ours, o.key);
      return !b && !ob && theirPartners.length > 0 && theirPartners.every((x) => os.has(x));
    });
    if (!hit || incoming.persons.has(hit.key)) continue;
    incoming.persons.delete(key);
    incoming.persons.set(hit.key, { ...p, key: hit.key });
    for (const f of incoming.families) {
      f.partners = f.partners.map((k) => (k === key ? hit.key : k));
      f.children = f.children.map((k) => (k === key ? hit.key : k));
    }
  }
}

/**
 * People the file brings without our ID and no name of ours — renamed in the app before it had them back with their ID
 * (found on Windows: the app keeps its own copy of the tree it handed over, without the research's IDs; a person renamed
 * there came as a new one, with a "new family" of a child that has its parents): the one of ours whose place they take.
 * In a family of the file whose other partner (or whose parents) are ours in a family of ours, the one of ours there the
 * file no longer names — of the same sex, born the same year when both say; only one such. They are ours.
 */
function renamedInPlace(incoming: Snapshot, ours: Snapshot): void {
  const year = (p: SPerson) => /\b(\d{4})\b/.exec(p.facts.find((f) => kindOf(f.kind) === "BIRT" || kindOf(f.kind) === "BAPM")?.date ?? "")?.[1];
  const fits = (x: SPerson, o: SPerson) => (!x.sex || !o.sex || x.sex === "U" || o.sex === "U" || x.sex === o.sex) && (!year(x) || !year(o) || year(x) === year(o));
  for (const [key, p] of [...incoming.persons]) {
    if (!key.startsWith("x:")) continue;
    const found = new Set<string>();
    for (const f of incoming.families) {
      const gone = (k: string) => !incoming.persons.has(k) && ours.persons.has(k);
      if (f.partners.includes(key)) {
        const others = f.partners.filter((k) => k !== key);
        if (!others.length || others.some((k) => k.startsWith("x:"))) continue;
        for (const o of ours.families) {
          if (o.partners.length !== f.partners.length || !others.every((k) => o.partners.includes(k))) continue;
          const shared = f.children.some((c) => o.children.includes(c));
          if (f.children.length && o.children.length && !shared) continue;
          for (const c of o.partners.filter((k) => !others.includes(k) && gone(k))) found.add(c);
        }
      }
      if (f.children.includes(key) && f.partners.length && f.partners.every((k) => !k.startsWith("x:"))) {
        const o = ours.families.find((x) => famKey(x.partners) === famKey(f.partners));
        for (const c of o?.children.filter((k) => !f.children.includes(k) && gone(k)) ?? []) found.add(c);
      }
    }
    const hits = [...found].filter((k) => fits(p, ours.persons.get(k)!));
    if (hits.length !== 1) continue;
    const hit = hits[0]!;
    incoming.persons.delete(key);
    incoming.persons.set(hit, { ...p, key: hit });
    for (const f of incoming.families) {
      f.partners = f.partners.map((k) => (k === key ? hit : k));
      f.children = f.children.map((k) => (k === key ? hit : k));
    }
  }
}

// ── applying and undoing ─────────────────────────────────────────────────────

/** What one sync wrote, to undo it: kept on its input. */
export interface Applied {
  do:
    | "event.add"
    | "event.edit"
    | "event.detail"
    | "event.retract"
    | "event.cite"
    | "event.status"
    | "conflict.add"
    | "conflict.edit"
    | "name.add"
    | "name.edit"
    | "name.title"
    | "name.primary"
    | "name.drop"
    | "note.add"
    | "person.add"
    | "family.add"
    | "family.union"
    | "child.add"
    | "child.relation"
    | "child.move"
    | "partner.add"
    | "partner.remove"
    | "event.uncite"
    | "sex.edit"
    | "place.add"
    | "place.edit"
    | "source.add"
    | "source.edit"
    | "repo.add"
    | "task.add"
    | "person.retract"
    | "child.remove"
    | "event.parts"
    | "name.cite"
    | "family.cite";
  id: string;
  /**
   * event.edit: the fact before; event.detail: its cause, age and house before (JSON); event.retract, event.status:
   * its status; event.cite: its status and the sources it was given (JSON); sex.edit: the sex before; note.add: the
   * note's time; child.add: the child; place.edit: its position before (JSON); source.edit: its words, page and the
   * app's mark before (JSON); event.parts: its participants before (JSON); name.cite, family.cite: the sources it was
   * given (JSON); name.edit: the name the person was shown by and the corrected one's spelling (JSON); name.primary:
   * the name added in front and the one shown before (JSON); name.drop: the user's name an edit of theirs replaced, and
   * where it stood (JSON); child.relation: the child's link before (JSON); child.move: the child, the family it left,
   * its link and place there, whether that family was retracted (JSON).
   */
  before?: SFact | string;
}

export interface SyncInput extends Input {
  sync?: { head?: string; edits: "conflict" | "user"; applied: Applied[]; undone?: string };
}

/**
 * A change of a send the research could not write: its number in the plan, its kind, why — in English (`why`), and as
 * a program reads it (`code`, `params` with IDs, `names` of those people and families as the research has them): the
 * Strom app says it in its own language.
 */
export interface Skipped {
  n: number;
  kind: string;
  why: string;
  code?: string;
  params?: Record<string, string>;
  names?: Record<string, string>;
}

/** The research's names of the people and families an error names (P… → "Marie Dvořáková", F… → "Karel Dvořák & Marie Dvořáková"). */
export function namesOf(tree: Tree, params: Record<string, string>): Record<string, string> {
  const person = (id: string) => {
    const p = resolve(tree, id);
    return p ? `${p.names[0]?.given ?? ""} ${p.names[0]?.surname ?? ""}`.trim() || p.id : undefined;
  };
  const out: Record<string, string> = {};
  for (const id of Object.values(params)) {
    if (/^P\d+$/.test(id)) {
      const n = person(id);
      if (n) out[id] = n;
    } else if (/^F\d+$/.test(id)) {
      const f = tree.get<Family>(id);
      if (f) out[id] = f.partners.map((x) => person(x) ?? x).join(" & ") || id;
    }
  }
  return out;
}

/**
 * Write the changes (all but those only reported; with `only`, those numbers — differences only when picked).
 * Returns what was written. The caller holds the tree lock and commits.
 */
/**
 * A child moved from a family of the research to another one (the other parent added in the app to this child only;
 * the user's parents taken in a conflict): its link with it; the family it leaves, one parent alone with nothing more of
 * its own, retracted with the reason — what an undo puts back.
 */
function moveChild(tree: Tree, child: string, from: string, to: string, reason: string): { link: ChildLink; at: number; retracted: boolean } | undefined {
  const [old, fam] = [tree.get<Family>(from), tree.get<Family>(to)];
  const at = old?.children.findIndex((c) => c.person === child) ?? -1;
  if (!old || !fam || old.retracted || fam.retracted || at < 0 || fam.children.some((c) => c.person === child) || fam.partners.includes(child)) return undefined;
  const link = old.children[at]!;
  const empty = old.children.length === 1 && old.partners.length <= 1 && !old.events.some((e) => !e.retracted) && !old.notes.length && !old.story;
  update<Family>(tree, from, "family", (f) => ({ ...f, children: f.children.filter((c) => c.person !== child), ...(empty ? { retracted: { at: now(), reason: `its child moved to ${to}: ${reason}` } } : {}) }), {
    op: "family.edit",
    summary: `${from} child ${child} moved to ${to}${empty ? ", the family of one parent left with nothing retracted" : ""}: ${reason}`,
    reason,
  });
  update<Family>(tree, to, "family", (f) => ({ ...f, children: [...f.children, link] }), { op: "family.child", summary: `${to} +child ${child} (from ${from})` });
  return { link, at, retracted: empty };
}

/**
 * A child's link tied to each parent as the file gives it (a parent's ID → tie; one not given keeps theirs): one tie for
 * both where they agree, else birth (or the first) for both and the other one's own beside it.
 */
function tiedLink(partners: string[], link: ChildLink, by: Record<string, string>): ChildLink {
  const tie = (p: string): ChildRelation => {
    const r = by[p] as ChildRelation | undefined;
    return r && CHILD_RELATIONS.includes(r) ? r : (link.relations?.[p] ?? link.relation);
  };
  const each = partners.map(tie);
  if (!each.length) return link;
  const relation = each.includes("birth") ? "birth" : each[0]!;
  const relations = Object.fromEntries(partners.filter((p, i) => each[i] !== relation).map((p) => [p, tie(p)]));
  return { person: link.person, relation, ...(Object.keys(relations).length ? { relations } : {}) };
}

export function applySync(tree: Tree, plan: Plan, incoming: Snapshot, source: Source, only?: Set<number>): { applied: Applied[]; changes: number; skipped: Skipped[] } {
  const applied: Applied[] = [];
  const skipped: Skipped[] = [];
  const cite = (locator: string) => ({ source: source.id, locator });
  const reason = `${source.title} (${source.id})`;
  const taken = (c: Change) => (only ? only.has(c.n) : c.action !== "pick") && c.action !== "report";
  const changes = plan.changes.filter(taken).length;
  const ids = new Map<string, string>(); // a new person's key → their ID
  const who = (key: string | undefined) => (key ? (ids.get(key) ?? (key.startsWith("x:") ? undefined : key)) : undefined);
  const families = new Map<string, string>(); // a new family's partners (famKey) → its ID
  /** A child's link tied to each parent as the file gives it (the parents by the file's keys): whether it changed. */
  const tieChild = (family: string, child: string | undefined, by: Record<string, string>): boolean => {
    const fam = tree.get<Family>(family);
    const link = fam?.children.find((x) => x.person === child);
    if (!fam || !link || !child) return false;
    const next = tiedLink(fam.partners, link, Object.fromEntries(Object.entries(by).flatMap(([k, r]) => (who(k) ? [[who(k)!, r]] : []))));
    if (JSON.stringify(next) === JSON.stringify(link)) return false;
    const said = fam.partners.map((p) => `${(next.relations?.[p] ?? next.relation)} of ${p}`).join(", ");
    update<Family>(tree, fam.id, "family", (f) => ({ ...f, children: f.children.map((x) => (x.person === child ? next : x)) }), {
      op: "family.edit",
      summary: `${fam.id} ${child} ${said} (${reason})`,
    });
    return true;
  };
  /** Someone the file names at a fact, as the research keeps them: a person of the tree, else the name as written. */
  const participant = (p: SPart): Participant | undefined => {
    const person = p.person ? (p.person.startsWith("x:") ? ids.get(p.person) : resolve(tree, p.person)?.id) : undefined;
    const name = person ? undefined : p.person ? partName(p, incoming) : p.name;
    if (!person && !name) return undefined;
    return { role: p.role, ...(person ? { person } : { name: name! }), ...(p.note ? { note: p.note } : {}) };
  };
  const participants = (f: SFact) => (f.parts ?? []).map(participant).filter((x): x is Participant => !!x);
  const fields = (f: SFact) => ({ kind: f.kind, date: f.date, place: f.place, value: f.value, label: f.label, cause: f.cause, age: f.age, house: f.house, participants: participants(f) });
  const evidence = incoming.transcripts === "evidence";

  // the app's sources first: the facts cite them
  const made = new Map<string, string>(); // a new source's key → its ID
  const srcId = (key: string) => plan.sources.get(key) ?? made.get(key);
  for (const c of plan.changes.filter((x) => x.kind === "source.new" && taken(x))) {
    const inc = incoming.sources?.get(c.source!);
    if (!inc) continue;
    const repository = inc.repo ? repositoryFor(tree, inc.repo, applied) : undefined;
    const [form, information] = QUAY_EVIDENCE[inc.quay ?? -1] ?? (["original", "unknown"] as const);
    const title = inc.title || inc.text!.slice(0, 60);
    const made1 = create<Source>(
      tree,
      "source",
      {
        kind: sourceKind(incoming, c.source!),
        title,
        ...(repository ? { repository } : {}),
        ...(inc.page ? { locator: inc.page } : {}),
        ...(inc.date ? { date: inc.date } : {}),
        ...(inc.text ? { transcript: inc.text } : {}),
        ...(inc.url ? { url: inc.url } : {}),
        information,
        form,
        // the user's transcript: their reading of the record when the app says so (or they ticked it verified)
        app: { read: form !== "authored" && (evidence || !!inc.verified), ...(inc.verified ? { verified: true } : {}) },
        ...(inc.note ? { note: inc.note } : {}),
      } as never,
      (id) => `+${id} source "${truncateText(title, 50)}" (the Strom app, ${source.id})`,
    );
    made.set(c.source!, made1.id);
    applied.push({ do: "source.add", id: made1.id, before: c.source! });
  }
  /** Whether a citation of this source stands on a reading of a record: the user's, when it counts. */
  const reading = (id: string) => {
    const s = tree.get<Source>(id);
    return !!s && !isWeak(s) && (s.app ? s.app.read : evidence);
  };
  /** The citations of a fact from the file: its sources (where in them), else the sync. */
  const citesOf = (f: SFact | undefined): Citation[] => {
    const out: Citation[] = [];
    for (const c of f?.cites ?? []) {
      const id = srcId(c.source);
      if (id && !out.some((x) => x.source === id)) out.push({ source: id, ...(c.page ? { locator: c.page } : {}) });
    }
    return out;
  };
  // the people whose facts now stand on a transcript the research has not read: one task to read them, per person
  const verify = new Map<string, Set<string>>();
  // what the research's sessions read: the same all through the sync (it writes none of it)
  let read: Set<string> | undefined;
  const toVerify = (owner: string, cits: Citation[]) => {
    const unread = cits.filter((c) => {
      const s = tree.get<Source>(c.source);
      // a reading of the user's that counts is the first reading: read again only by the usual rules
      return !!s?.app && !s.app.read && !isWeak(s) && !researchRead(tree, s, (read ??= readByResearch(tree)));
    });
    if (!unread.length) return;
    const people = owner.startsWith("F") ? (tree.get<Family>(owner)?.partners ?? []) : [owner];
    for (const p of people) for (const c of unread) (verify.get(p) ?? verify.set(p, new Set()).get(p)!).add(c.source);
  };
  /** The leads that cite a source the user's reading of which now counts: probable on it. */
  const raise = (id: string) => {
    if (!reading(id)) return;
    for (const o of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
      const up = o.events.filter((e) => !e.retracted && e.status === "lead" && e.citations.some((c) => c.source === id));
      if (!up.length) continue;
      update<Person | Family>(tree, o.id, o.type, (x) => ({ ...x, events: x.events.map((e) => (up.some((u) => u.id === e.id) ? { ...e, status: "probable" } : e)) }), {
        op: "event.status",
        summary: `${up.map((e) => e.id).join(", ")} probable: the user's reading of ${id} counts (${reason})`,
      });
      for (const e of up) applied.push({ do: "event.status", id: e.id, before: "lead" });
    }
  };

  // new people first: facts and families point at them
  for (const c of plan.changes.filter((x) => x.kind === "person.new" && taken(x))) {
    const p = incoming.persons.get(c.person!)!;
    const primary = p.names[0] && p.names[0].replace(/\//g, "").trim() ? p.names[0] : "? /?/";
    const person = create<Person>(
      tree,
      "person",
      { names: [{ ...nameOf(primary), ...(p.titles?.before ? { prefix: p.titles.before } : {}), ...(p.titles?.after ? { suffix: p.titles.after } : {}), citations: [cite(`name`)] }], sex: (p.sex as Person["sex"]) ?? "U", events: [], notes: [] } as never,
      (id) => `+${id} person "${primary.replace(/\//g, "").trim()}" (from ${source.id})`,
    );
    ids.set(c.person!, person.id);
    // the file's key of them: what the app had is known by it after (an archive's next send of that window)
    applied.push({ do: "person.add", id: person.id, before: c.person! });
  }
  for (const c of plan.changes) {
    if (!taken(c) || c.kind === "person.new") continue;
    // a new family's facts: of the family made of those partners
    const owner = c.family ?? who(c.person) ?? (c.partners && c.kind !== "family.new" ? families.get(famKey(c.partners.map((k) => who(k) ?? k))) : undefined);
    // one change the research cannot write (found on Windows: a child given parents it has) is left out, said — the
    // rest of the send is written
    try {
      switch (c.kind) {
        case "fact.new":
        case "fact.differs":
        case "fact.changed": {
          if (!owner || !c.fact) break;
          const mine = c.was?.id ? eventById(tree, c.was.id) : undefined;
          const theirs = citesOf(c.fact);
          if (c.kind === "fact.new" || !mine || (c.action === "add" && !mine)) {
            const citations = theirs.length ? theirs : [cite(c.fact.kind)];
            const { event } = addEvent(tree, owner, { ...fields(c.fact), status: citations.some((x) => reading(x.source)) ? "probable" : "lead", citations });
            applied.push({ do: "event.add", id: event.id });
            toVerify(owner, citations);
          } else if (c.action === "refine") {
            // the record's fact stays as it is proven; what the user added to it cites their tree (or the sources they gave)
            const parts = [c.fact.date !== mine.date ? "DATE" : "", exact(c.fact.place) !== exact(mine.place) ? "PLAC" : "", exact(c.fact.value) !== exact(mine.value) ? "value" : ""].filter(Boolean);
            editEvent(tree, mine.id, { date: c.fact.date ?? mine.date ?? "", place: c.fact.place ?? mine.place ?? "", ...(c.fact.value ? { value: c.fact.value } : {}) }, `added from ${reason}`);
            applied.push({ do: "event.edit", id: mine.id, before: { kind: mine.kind, ...(mine.date ? { date: mine.date } : {}), ...(mine.place ? { place: mine.place } : {}), ...(mine.value ? { value: mine.value } : {}) } });
            // the research's own citations come back with it: only a source the user gave it more speaks for the addition
            const given = theirs.filter((x) => !mine.citations.some((y) => y.source === x.source));
            const more = given.length ? given : [cite(`${c.fact.kind} ${parts.join(" ")}`)];
            if (!mine.citations.some((y) => more.some((x) => x.source === y.source && x.locator === y.locator))) {
              update<Person | Family>(tree, owner, owner.startsWith("F") ? "family" : "person", (o) => ({ ...o, events: o.events.map((e) => (e.id === mine.id ? { ...e, citations: [...e.citations, ...more] } : e)) }), {
                op: "event.cite",
                summary: `${mine.id} cites ${more.map((x) => x.source).join(", ")}`,
              });
              applied.push({ do: "event.cite", id: mine.id, before: JSON.stringify({ sources: more.map((x) => x.source) }) });
            }
            toVerify(owner, given);
          } else if (c.action === "correct" || (c.kind === "fact.differs" && c.action === "pick" && !recordBacked(tree, mine))) {
            editEvent(tree, mine.id, { date: c.fact.date ?? "", place: c.fact.place ?? "", ...(c.fact.value !== undefined ? { value: c.fact.value } : {}) }, `corrected in ${reason}`);
            // cited: the sources the user gave it in the app, else the sync — a family tree that gave the old value (a file
            // taken in, an earlier send) says it no more: its citation goes, kept for an undo (found on Mac: "S0001:
            // kovář" in a conflict, the file saying mlynář)
            const more = (theirs.length ? theirs : [cite(c.fact.kind)]).filter((x) => !mine.citations.some((y) => y.source === x.source));
            const stale = mine.citations.filter((x) => x.source !== source.id && !theirs.some((y) => y.source === x.source) && tree.get<Source>(x.source)?.kind === "family-tree");
            update<Person | Family>(tree, owner, owner.startsWith("F") ? "family" : "person", (o) => ({ ...o, events: o.events.map((e) => (e.id === mine.id ? { ...e, citations: [...e.citations.filter((x) => !stale.some((y) => y.source === x.source && y.locator === x.locator)), ...more] } : e)) }), {
              op: "event.cite",
              summary: `${mine.id} cites ${more.map((x) => x.source).join(", ") || source.id}${stale.length ? `, no more ${stale.map((x) => x.source).join(", ")} (it gave the value before)` : ""}`,
            });
            if (stale.length) applied.push({ do: "event.uncite", id: mine.id, before: JSON.stringify(stale) });
            toVerify(owner, theirs);
            applied.push({ do: "event.edit", id: mine.id, before: { kind: mine.kind, ...(mine.date ? { date: mine.date } : {}), ...(mine.place ? { place: mine.place } : {}), ...(mine.value ? { value: mine.value } : {}) } });
          } else if (c.action === "user") {
            retractEvent(tree, mine.id, `the user's edit wins: ${reason}`);
            applied.push({ do: "event.retract", id: mine.id, before: mine.status });
            // the user's word: no record makes it probable — unless it is their reading of one, which counts
            const citations = theirs.length ? theirs : [cite(c.fact.kind)];
            const { event } = addEvent(tree, owner, { ...fields(c.fact), status: citations.some((x) => reading(x.source)) ? "probable" : "possible", citations });
            applied.push({ do: "event.add", id: event.id });
            toVerify(owner, citations);
          } else {
            const title = editTitle(c.name ?? owner, eventName(c.fact.kind, tree.lang, c.fact.label), factWords(tree, incoming, mine), factWords(tree, incoming, c.fact));
            conflictOfEdit(tree, applied, owner, c.fact.kind, title, [
              { ...(mine.citations[0] ? { source: mine.citations[0].source } : {}), value: describe(mine), note: `the research: ${mine.id}`, text: factWords(tree, incoming, mine) },
              { source: source.id, value: describe(c.fact), note: "the user's edit", text: factWords(tree, incoming, c.fact) },
            ], { event: mine.id, ...(c.fact.date ? { date: c.fact.date } : {}), ...(c.fact.place ? { place: c.fact.place } : {}), ...(c.fact.value ? { value: c.fact.value } : {}), ...(theirs.length ? { cites: theirs } : {}) });
          }
          break;
        }
        case "fact.detail": {
          const mine = c.was?.id ? eventById(tree, c.was.id) : undefined;
          if (!owner || !c.fact || !mine) break;
          // picked without the state it was given: a record's fact is not overwritten
          if (c.action === "conflict" || (c.action === "pick" && recordBacked(tree, mine))) {
            const title = editTitle(c.name ?? owner, eventName(c.fact.kind, tree.lang, c.fact.label), factWords(tree, incoming, mine), factWords(tree, incoming, c.fact));
            conflictOfEdit(tree, applied, owner, c.fact.kind, title, [
              { ...(mine.citations[0] ? { source: mine.citations[0].source } : {}), value: describe(mine), note: `the research: ${mine.id}`, text: factWords(tree, incoming, mine) },
              { source: source.id, value: describe(c.fact), note: "the user's edit", text: factWords(tree, incoming, c.fact) },
            ]);
            break;
          }
          const [fd, md] = [detailsOf(c.fact), detailsOf(mine)];
          const changed = Object.keys(fd).filter((d) => fd[d] !== md[d] && (!d.startsWith("ages:") || !!who(d.slice(5))));
          if (!changed.length) break;
          editEvent(tree, mine.id, detailEdit(Object.fromEntries(changed.map((d) => [d.startsWith("ages:") ? `ages:${who(d.slice(5))}` : d, fd[d]!]))), `${c.action === "add" ? "added from" : "corrected in"} ${reason}`);
          const set = Object.fromEntries(changed.map((d) => [d, fd[d]]));
          update<Person | Family>(tree, owner, owner.startsWith("F") ? "family" : "person", (o) => ({ ...o, events: o.events.map((e) => (e.id === mine.id && !e.citations.some((x) => x.source === source.id) ? { ...e, citations: [...e.citations, cite(`${c.fact!.kind} ${Object.keys(set).join(" ")}`)] } : e)) }), {
            op: "event.cite",
            summary: `${mine.id} cites ${source.id}`,
          });
          applied.push({ do: "event.detail", id: mine.id, before: JSON.stringify(Object.fromEntries(changed.map((d) => [d.startsWith("ages:") ? `ages:${who(d.slice(5))}` : d, md[d] ?? ""]))) });
          break;
        }
        case "fact.cite": {
          // the research's fact cites the sources the user gave it in the app; their reading of a record makes a lead probable
          const mine = c.was?.id ? eventById(tree, c.was.id) : undefined;
          if (!owner || !mine || mine.retracted) break;
          const add = citesOf(c.fact).filter((x) => !mine.citations.some((y) => y.source === x.source));
          if (!add.length) break;
          const up = (mine.status === "lead" || mine.status === "possible") && add.some((x) => reading(x.source));
          update<Person | Family>(tree, owner, owner.startsWith("F") ? "family" : "person", (o) => ({ ...o, events: o.events.map((e) => (e.id === mine.id ? { ...e, citations: [...e.citations, ...add], ...(up ? { status: "probable" as const } : {}) } : e)) }), {
            op: "event.cite",
            summary: `${mine.id} cites ${add.map((x) => x.source).join(", ")}${up ? " — probable on the user's reading" : ""} (${reason})`,
          });
          applied.push({ do: "event.cite", id: mine.id, before: JSON.stringify({ status: mine.status, sources: add.map((x) => x.source) }) });
          toVerify(owner, add);
          break;
        }
        case "fact.part": {
          // who the record names at the research's fact: one more added, a role corrected, a record's word a conflict
          const mine = c.was?.id ? eventById(tree, c.was.id) : undefined;
          if (!owner || !mine || mine.retracted) break;
          const before = mine.participants ?? [];
          const at = c.wasPart ? before.findIndex((x) => x.role === c.wasPart!.role && (c.wasPart!.person ? x.person === c.wasPart!.person : !x.person && nameKey(x.name ?? "") === nameKey(c.wasPart!.name ?? ""))) : -1;
          const kindOfRec = owner.startsWith("F") ? "family" : "person";
          if (c.action === "conflict") {
            const title = editTitle(c.name ?? owner, eventName(mine.kind, tree.lang, mine.label), partWords(c.wasPart!, incoming, tree.lang), partWords(c.part!, incoming, tree.lang));
            conflictOfEdit(tree, applied, owner, mine.kind, title, [
              { ...(mine.citations[0] ? { source: mine.citations[0].source } : {}), value: `${c.wasPart!.role} ${c.wasPart!.name ?? c.wasPart!.person ?? "?"}`, note: `the research: ${mine.id}`, text: partWords(c.wasPart!, incoming, tree.lang) },
              { source: source.id, value: partText(c.part!, incoming), note: "the user's edit", text: partWords(c.part!, incoming, tree.lang) },
            ]);
            break;
          }
          let next: Participant[];
          if (c.action === "remove") next = at < 0 ? before : before.filter((_, i) => i !== at);
          else if (c.action === "add") {
            const p = c.part ? participant(c.part) : undefined;
            if (!p) break;
            // a name the user linked to a person of the tree: that participant is the person now
            if (at >= 0 && p.person) next = before.map((x, i) => (i === at ? { ...x, person: p.person! } : x));
            else if (before.some((x) => x.role === p.role && (p.person ? x.person === p.person : !x.person && nameKey(x.name ?? "") === nameKey(p.name ?? "")))) break;
            else next = [...before, p];
          } else next = at < 0 ? before : before.map((x, i) => (i === at ? { ...x, role: c.part!.role, ...(c.part!.note ? { note: c.part!.note } : {}) } : x));
          if (JSON.stringify(next) === JSON.stringify(before)) break;
          const why = c.action === "remove" ? `${phrase(tree.lang, "archive.removed")}: ${reason}` : `${c.action === "add" ? "added from" : "corrected in"} ${reason}`;
          // where it came from: the sync, cited at the fact (a removal cites nothing)
          const cites = c.action !== "remove" && !mine.citations.some((x) => x.source === source.id);
          update<Person | Family>(
            tree,
            owner,
            kindOfRec,
            (o) => ({
              ...o,
              events: o.events.map((e) => {
                if (e.id !== mine.id) return e;
                const { participants: _p, ...rest } = e;
                return { ...rest, ...(next.length ? { participants: next } : {}), ...(cites ? { citations: [...e.citations, cite(`${mine.kind} ${(c.part ?? c.wasPart)!.role}`)] } : {}) } as Event;
              }),
            }),
            { op: "event.edit", summary: `${mine.id} ${mine.kind} participants: ${c.action === "remove" ? "−" : c.action === "add" ? "+" : "~"}${partText((c.part ?? c.wasPart)!, incoming)}`, reason: why },
          );
          applied.push({ do: "event.parts", id: mine.id, before: JSON.stringify(before) });
          if (cites) applied.push({ do: "event.cite", id: mine.id, before: JSON.stringify({ sources: [source.id] }) });
          break;
        }
        case "person.cite":
        case "family.cite": {
          // the sources of a person (their names cite them) or of a family (its marriage, else the family itself)
          if (!owner || !c.cites?.length) break;
          const add = citesOf({ kind: "", cites: c.cites });
          if (!add.length) break;
          if (c.kind === "person.cite") {
            update<Person>(tree, owner, "person", (p) => ({ ...p, names: p.names.map((n, i) => (i === 0 ? { ...n, citations: [...(n.citations ?? []), ...add.filter((x) => !(n.citations ?? []).some((y) => y.source === x.source))] } : n)) }), {
              op: "name.cite",
              summary: `${owner} cites ${add.map((x) => x.source).join(", ")} (${reason})`,
            });
            applied.push({ do: "name.cite", id: owner, before: JSON.stringify({ sources: add.map((x) => x.source) }) });
          } else {
            const fam = tree.get<Family>(owner);
            if (!fam) break;
            const marr = fam.events.find((e) => !e.retracted && e.kind === "MARR");
            if (marr) {
              const more = add.filter((x) => !marr.citations.some((y) => y.source === x.source));
              if (!more.length) break;
              const up = (marr.status === "lead" || marr.status === "possible") && more.some((x) => reading(x.source));
              update<Family>(tree, fam.id, "family", (f) => ({ ...f, events: f.events.map((e) => (e.id === marr.id ? { ...e, citations: [...e.citations, ...more], ...(up ? { status: "probable" as const } : {}) } : e)) }), {
                op: "event.cite",
                summary: `${marr.id} cites ${more.map((x) => x.source).join(", ")}${up ? " — probable on the user's reading" : ""} (${reason})`,
              });
              applied.push({ do: "event.cite", id: marr.id, before: JSON.stringify({ status: marr.status, sources: more.map((x) => x.source) }) });
            } else {
              update<Family>(tree, fam.id, "family", (f) => ({ ...f, citations: [...(f.citations ?? []), ...add.filter((x) => !(f.citations ?? []).some((y) => y.source === x.source))] }), {
                op: "family.cite",
                summary: `${fam.id} cites ${add.map((x) => x.source).join(", ")} (${reason})`,
              });
              applied.push({ do: "family.cite", id: fam.id, before: JSON.stringify({ sources: add.map((x) => x.source) }) });
            }
          }
          toVerify(owner, add);
          break;
        }
        case "source.changed":
        case "source.verified": {
          // the app's own source: the user corrects their reading, or says it is verified — a reading that counts
          const s = c.sourceId ? tree.get<Source>(c.sourceId) : undefined;
          const inc = c.source ? incoming.sources?.get(c.source) : undefined;
          if (!s || !inc) break;
          const before = JSON.stringify({ transcript: s.transcript ?? null, locator: s.locator ?? null, app: s.app ?? null });
          const read = c.kind === "source.verified" || evidence || !!s.app?.read;
          update<Source>(
            tree,
            s.id,
            "source",
            (x) => ({
              ...x,
              ...(c.kind === "source.changed" && inc.text ? { transcript: inc.text } : {}),
              ...(c.kind === "source.changed" && inc.page ? { locator: inc.page } : {}),
              app: { ...x.app, read, ...(c.kind === "source.verified" || x.app?.verified ? { verified: true } : {}) },
            }),
            { op: "source.sync", summary: `${s.id} ${c.kind === "source.verified" ? "transcript verified by the user" : "the user's reading corrected"} (${reason})` },
          );
          applied.push({ do: "source.edit", id: s.id, before });
          raise(s.id);
          break;
        }
        case "source.reading": {
          // a record the research read: the user's reading is kept beside it, the research reads it again
          const s = c.sourceId ? tree.get<Source>(c.sourceId) : undefined;
          const inc = c.source ? incoming.sources?.get(c.source) : undefined;
          if (!s || !inc) break;
          const lang = tree.lang;
          const n = addNote(
            tree,
            s.id,
            [phrase(lang, "sync.reading.note", { source: source.id }), inc.page ? `${phrase(lang, "sync.reading.page")}: ${inc.page}` : "", inc.text ? `${phrase(lang, "sync.reading.text")}:\n${inc.text}` : ""].filter(Boolean).join("\n"),
          );
          applied.push({ do: "note.add", id: s.id, before: n.at });
          for (const o of [...tree.list<Person>("person"), ...tree.list<Family>("family")])
            if (!o.retracted && (o.events.some((e) => !e.retracted && e.citations.some((x) => x.source === s.id)) || (o.type === "person" && o.names.some((m) => m.citations?.some((x) => x.source === s.id)))))
              for (const p of o.type === "family" ? o.partners : [o.id]) (verify.get(p) ?? verify.set(p, new Set()).get(p)!).add(s.id);
          break;
        }
        case "fact.gone": {
          // an archive: the fact the app no longer has is withdrawn with the reason
          const mine = c.was?.id ? eventById(tree, c.was.id) : undefined;
          if (c.action !== "remove" || !mine || mine.retracted) break;
          retractEvent(tree, mine.id, `${phrase(tree.lang, "archive.removed")}: ${reason}`);
          applied.push({ do: "event.retract", id: mine.id, before: mine.status });
          break;
        }
        case "person.gone": {
          const p = c.action === "remove" && c.person ? resolve(tree, c.person) : undefined;
          if (!p) break;
          try {
            retractPerson(tree, p.id, `${phrase(tree.lang, "archive.removed")}: ${reason}`);
            applied.push({ do: "person.retract", id: p.id });
          } catch {
            // the focus of a research stays (it is reported)
          }
          break;
        }
        case "child.gone": {
          const fam = c.action === "remove" && c.family ? tree.get<Family>(c.family) : undefined;
          const link = fam?.children.find((x) => x.person === c.child);
          if (!fam || !link) break;
          update<Family>(tree, fam.id, "family", (f) => ({ ...f, children: f.children.filter((x) => x.person !== link.person) }), {
            op: "family.edit",
            summary: `${fam.id} child ${link.person} removed: ${phrase(tree.lang, "archive.removed")}`,
            reason: `${phrase(tree.lang, "archive.removed")}: ${reason}`,
          });
          applied.push({ do: "child.remove", id: fam.id, before: JSON.stringify(link) });
          break;
        }
        case "name.new": {
          if (!owner || !c.text) break;
          // beside the name the person is shown by, always last: what the app shows does not move
          const { name } = addName(tree, owner, { name: c.text, citation: cite("name"), other: true });
          applied.push({ do: "name.add", id: owner, before: exact(`${name.given}|${name.surname}`) });
          break;
        }
        case "name.changed": {
          if (!owner || !c.text) break;
          const p = tree.get<Person>(owner)!;
          const shown = primaryName(p);
          if (c.action === "correct") {
            // no record gives it: corrected in place, citing the sync (undo puts the name back as it was)
            editPerson(tree, owner, { name: c.text }, `corrected in ${reason}`);
            const now1 = primaryName(tree.get<Person>(owner)!);
            applied.push({ do: "name.edit", id: owner, before: JSON.stringify({ name: shown, now: exact(`${now1.given}|${now1.surname}`) }) });
            // corrected again the same day: it cites the day's source already (found on Windows: written, said to be
            // left out, and an undo that did not put it back)
            if (!now1.citations?.some((x) => x.source === source.id && x.locator === "name")) addName(tree, owner, { name: c.text, citation: cite("name") });
          } else if (c.action === "user") {
            // the user's word wins: shown by the new name, the record's kept beside it
            const { name } = addName(tree, owner, { name: c.text, citation: cite("name"), primary: true });
            applied.push({ do: "name.primary", id: owner, before: JSON.stringify({ added: exact(`${name.given}|${name.surname}`), shown: exact(`${shown.given}|${shown.surname}`) }) });
          } else {
            // a record gives the name: the user decides; their name kept as another form meanwhile (sent again, it
            // asks nothing new)
            const title = editTitle(c.wasName ?? owner, ui(tree.lang, "ui.conflict.name"), (c.wasName ?? "").replace(/\//g, "").replace(/\s+/g, " ").trim() || "—", c.text.replace(/\//g, "").replace(/\s+/g, " ").trim());
            const { was } = conflictOfEdit(tree, applied, owner, "NAME", title, [
              { ...(shown.citations?.[0] ? { source: shown.citations[0].source } : {}), value: c.wasName ?? "", note: "the research: the name the person is shown by", text: (c.wasName ?? "").replace(/\//g, "").replace(/\s+/g, " ").trim() || "—" },
              { source: source.id, value: c.text, note: "the user's edit", text: c.text.replace(/\//g, "").replace(/\s+/g, " ").trim() },
            ]);
            // the user's name of the earlier send it replaces goes (found on Mac: "Anna Marie" stayed beside "Anna Marta")
            if (was) dropUsersName(tree, applied, owner, was, reason);
            const { name } = addName(tree, owner, { name: c.text, citation: cite("name"), other: true });
            applied.push({ do: "name.add", id: owner, before: exact(`${name.given}|${name.surname}`) });
          }
          break;
        }
        case "name.title": {
          if (!owner || !c.title) break;
          const shown = primaryName(tree.get<Person>(owner)!);
          const now = c.text ?? "";
          if (c.action === "conflict" || (c.action === "pick" && nameBacked(tree, shown))) {
            // a record gives the name: the user decides (strom conflict resolve --take user|research)
            const said = (v: string) => v || "—";
            const what = ui(tree.lang, c.title.part === "before" ? "ui.conflict.titleBefore" : "ui.conflict.titleAfter");
            conflictOfEdit(tree, applied, owner, titleTag(c.title.part), editTitle(formatName(shown), what, said(c.title.was), said(now)), [
              { ...(shown.citations?.[0] ? { source: shown.citations[0].source } : {}), value: c.title.was, note: "the research: the title of the name the person is shown by", text: said(c.title.was) },
              { source: source.id, value: now, note: "the user's edit", text: said(now) },
            ]);
            break;
          }
          applied.push(setTitle(tree, owner, c.title.part, now, cite("title"), `${c.action === "user" ? "the user's edit wins" : "corrected in"}: ${reason}`));
          break;
        }
        case "note.new": {
          if (!owner || !c.text) break;
          const n = addNote(tree, owner, c.text);
          applied.push({ do: "note.add", id: owner, before: n.at });
          break;
        }
        case "sex.changed": {
          if (!owner || !c.text) break;
          const p = tree.get<Person>(owner)!;
          if (c.action === "conflict") {
            const who = gedcomName(primaryName(p)).replace(/\//g, "").replace(/\s+/g, " ").trim();
            conflictOfEdit(tree, applied, owner, "SEX", editTitle(who, ui(tree.lang, "ui.conflict.sex"), sexWord(p.sex, tree.lang), sexWord(c.text, tree.lang)), [
              { value: p.sex, note: "the research: the sex its records give", text: sexWord(p.sex, tree.lang) },
              { source: source.id, value: c.text, note: "the user's edit", text: sexWord(c.text, tree.lang) },
            ]);
            break;
          }
          editPerson(tree, owner, { sex: c.text }, `the user's edit: ${reason}`);
          applied.push({ do: "sex.edit", id: owner, before: p.sex });
          break;
        }
        case "family.new": {
          const partners = (c.partners ?? []).map(who).filter((x): x is string => !!x);
          // its children, each "key" or "key:relation" (adopted, foster, step: the child's PEDI)
          const kids = (c.text ?? "")
            .split(" ")
            .filter(Boolean)
            .map((t) => /^(.+):(adopted|foster|step)$/.exec(t) ?? [t, t, undefined])
            .map(([, k, relation]) => ({ person: who(k!), relation }))
            .filter((k): k is { person: string; relation: string | undefined } => !!k.person);
          const born = kids.filter((k) => !k.relation).map((k) => k.person);
          if (!partners.length && !kids.length) break;
          // its facts come after it, each with its own sources
          const first = born.length || partners.length ? undefined : kids[0]!;
          const f = addFamily(tree, { partners, children: first ? [first.person] : born, ...(first ? { relation: first.relation } : {}), citation: cite("family"), noCouple: !!c.noCouple, ...(c.union ? { union: c.union } : {}) });
          for (const k of kids) if (k.relation && k !== first) addChild(tree, f.id, k.person, k.relation, cite("child"));
          families.set(famKey(partners), f.id);
          applied.push({ do: "family.add", id: f.id });
          // a child tied otherwise to each parent (a stepchild of one, the other's own)
          for (const [k, by] of Object.entries(c.ties ?? {})) tieChild(f.id, who(k), by);
          break;
        }
        case "family.union": {
          const fam = c.family ? tree.get<Family>(c.family) : undefined;
          if (!fam || fam.retracted || (fam.union ?? "") === (c.union ?? "")) break;
          update<Family>(tree, fam.id, "family", ({ union: _u, ...f }) => ({ ...f, ...(c.union ? { union: c.union } : {}) }) as Family, {
            op: "family.edit",
            summary: `${fam.id} union ${c.union ?? "none"}: ${reason}`,
            reason,
          });
          applied.push({ do: "family.union", id: fam.id, before: fam.union ?? "" });
          break;
        }
        case "child.new": {
          const child = who(c.child);
          if (!c.family || !child) break;
          const split = c.child ? c.ties?.[c.child] : undefined;
          addChild(tree, c.family, child, split ? Object.values(split).includes("birth") ? "birth" : Object.values(split)[0] : c.text, cite("child"));
          applied.push({ do: "child.add", id: c.family, before: child });
          if (split) tieChild(c.family, child, split);
          break;
        }
        case "child.moved": {
          // to the family of the parent and the partner the app added: made by this send, or the research's
          const child = who(c.child);
          const to = c.text ?? families.get(famKey((c.partners ?? []).map((k) => who(k) ?? k)));
          const done = c.family && child && to ? moveChild(tree, child, c.family, to, reason) : undefined;
          if (done) applied.push({ do: "child.move", id: to!, before: JSON.stringify({ child, from: c.family, ...done }) });
          break;
        }
        case "child.relation": {
          // the file's tie of a child the research has here to each parent: the link set so, kept for an undo
          const child = who(c.child);
          const by = c.child ? c.ties?.[c.child] : undefined;
          const before = c.family && child ? tree.get<Family>(c.family)?.children.find((x) => x.person === child) : undefined;
          if (!c.family || !child || !by || !before) break;
          if (tieChild(c.family, child, by)) applied.push({ do: "child.relation", id: c.family, before: JSON.stringify(before) });
          break;
        }
        case "partner.new": {
          const partner = who(c.person);
          const fam = c.family ? tree.get<Family>(c.family) : undefined;
          if (!fam || !partner) break;
          if (fam.partners.length >= 2 || fam.partners.includes(partner) || fam.children.some((x) => x.person === partner))
            throw new UsageError(`${partner} cannot join ${fam.id} (${fam.partners.join(" & ") || "no partner"})`, { code: "family.partner", params: { person: partner, family: fam.id } });
          const citation = cite("family");
          update<Family>(tree, fam.id, "family", (f) => ({ ...f, partners: [...f.partners, partner], ...(c.noCouple && !f.events.some((e) => !e.retracted) ? { noCouple: true as const } : {}), ...(citation && !(f.citations ?? []).some((x) => x.source === citation.source && x.locator === citation.locator) ? { citations: [...(f.citations ?? []), citation] } : {}) }), {
            op: "family.edit",
            summary: `${fam.id} +partner ${partner}${citation ? ` ← ${citation.source}` : ""}`,
          });
          applied.push({ do: "partner.add", id: fam.id, before: partner });
          break;
        }
        case "partner.gone": {
          const fam = c.action === "remove" && c.family ? tree.get<Family>(c.family) : undefined;
          const partner = c.person;
          if (!fam || !partner || !fam.partners.includes(partner)) break;
          update<Family>(tree, fam.id, "family", (f) => ({ ...f, partners: f.partners.filter((x) => x !== partner) }), {
            op: "family.edit",
            summary: `${fam.id} partner ${partner} removed: ${phrase(tree.lang, "archive.removed")}`,
            reason: `${phrase(tree.lang, "archive.removed")}: ${reason}`,
          });
          applied.push({ do: "partner.remove", id: fam.id, before: JSON.stringify({ partner, at: fam.partners.indexOf(partner) }) });
          break;
        }
        case "child.parents": {
          const child = who(c.child);
          const p = child ? tree.get<Person>(child) : undefined;
          if (!child || !p) break;
          const born = tree.list<Family>("family").find((f) => !f.retracted && f.children.some((x) => x.person === child && x.relation === "birth" && !x.relations));
          if (!born) {
            // the research has no parents for them any longer: the app's are written as any family
            break;
          }
          const theirs = parentsText(tree, incoming, (c.partners ?? []).map((k) => who(k) ?? k));
          const ours = parentsText(tree, incoming, born.partners);
          const name = gedcomName(primaryName(p)).replace(/\//g, "").replace(/\s+/g, " ").trim();
          const partners = (c.partners ?? []).map((k) => who(k)).filter((k): k is string => !!k);
          // the family of the user's parents: the research's the file named, or the one this send made — else made when taken
          const to = c.family ?? families.get(famKey(partners));
          conflictOfEdit(tree, applied, child, "FAMC", editTitle(name, ui(tree.lang, "ui.conflict.parents"), ours, theirs), [
            { value: `${born.id}: ${ours}`, note: "the research: the parents it gives", text: ours },
            { source: source.id, value: theirs, note: "the user's edit", text: theirs },
          ], undefined, partners.length ? { child, from: born.id, partners, ...(to ? { to } : {}) } : undefined);
          break;
        }
        case "place.coords": {
          const p = c.place;
          if (!p) break;
          const coords = { lat: p.lat, lon: p.lon };
          const mine = p.id ? tree.get<Place>(p.id) : undefined;
          if (mine && !mine.retracted) {
            update<Place>(tree, mine.id, "place", ({ unlocated: _found, ...rest }) => ({ ...rest, coords }), {
              op: "place.edit",
              summary: `${mine.id} at ${p.lat}, ${p.lon}: ${reason}`,
            });
            applied.push({ do: "place.edit", id: mine.id, before: JSON.stringify({ coords: mine.coords, unlocated: mine.unlocated }) });
          } else {
            const made = create<Place>(tree, "place", { names: [{ name: p.name }], coords, jurisdictions: [], note: `the position from ${reason}` } as never, (id) => `+${id} place "${p.name}" (from ${source.id})`);
            applied.push({ do: "place.add", id: made.id });
          }
          break;
        }
        default:
          break;
      }
    } catch (e) {
      if (!(e instanceof UsageError)) throw e;
      skipped.push({ n: c.n, kind: c.kind, why: e.message, ...(e.code ? { code: e.code } : {}), ...(e.params ? { params: e.params, names: namesOf(tree, e.params) } : {}) });
    }
  }
  // one task per person to read for themselves what the user transcribed or read again — none in an archive: nobody
  // reads there (switched to research, its reviews propose what to read)
  const open = tree.list<Task>("task").filter((t) => t.origin === VERIFY_ORIGIN && ["open", "doing", "parked", "waiting"].includes(t.state));
  for (const [person, srcs] of isArchive(tree) ? [] : verify) {
    const p = tree.get<Person>(person);
    if (!p || p.retracted || open.some((t) => t.subject.includes(person))) continue;
    // the person and the records by their IDs: shown, they are named (twice found on Windows: "Karel Dvořák [Karel Dvořák
    // [P0001]] … Křestní matrika Týnec Křestní matrika Týnec"); a task's what is at most 200 characters
    const what = truncateText(phrase(tree.lang, "sync.verify.what", { name: person, list: [...srcs].join(", ") }), 200);
    const t = create<Task>(
      tree,
      "task",
      {
        level: "verify",
        priority: 3,
        what,
        where: [...srcs],
        why: phrase(tree.lang, "sync.verify.why", { source: source.id }),
        doneWhen: phrase(tree.lang, "sync.verify.done"),
        subject: [person, ...srcs],
        state: "open",
        origin: VERIFY_ORIGIN,
      } as never,
      (id) => `+${id} task "read for itself what the user wrote of ${person}"`,
    );
    applied.push({ do: "task.add", id: t.id });
  }
  return { applied, changes: changes - skipped.length, skipped };
}

/** Where a task to read the user's transcripts again comes from (one per person at a time). */
export const VERIFY_ORIGIN = "sync:verify";

/** The Strom app's quality of a citation (GEDCOM QUAY) → what kind of record it is and its information. */
const QUAY_EVIDENCE: Record<number, readonly [Source["form"], Source["information"]]> = {
  3: ["original", "primary"],
  2: ["original", "secondary"],
  1: ["derivative", "unknown"],
  0: ["authored", "unknown"],
};

/** What kind of record a source of the app is, by the first fact citing it: a baptism, marriage or death entry, else other. */
function sourceKind(incoming: Snapshot, key: string): Source["kind"] {
  const facts = [...incoming.persons.values()].flatMap((p) => p.facts).concat(incoming.families.flatMap((f) => f.facts));
  const first = facts.find((f) => f.cites?.some((c) => c.source === key));
  const k = first ? kindOf(first.kind) : "";
  if (k === "BIRT" || k === "BAPM") return "baptism";
  if (["MARR", "MARB", "MARC", "MARL", "MARS", "ENGA"].includes(k)) return "marriage";
  if (k === "DEAT" || k === "BURI" || k === "CREM") return "death";
  return "other";
}

/** The archive of that name the research has, else a new one (whether tools may download from it: unknown). */
function repositoryFor(tree: Tree, name: string, applied: Applied[]): string {
  const known = tree.list<Repository>("repository").find((r) => !r.retracted && entryKey(r.name) === entryKey(name));
  if (known) return known.id;
  const r = create<Repository>(tree, "repository", { name: name.trim(), automation: "unknown", notes: [] } as never, (id) => `+${id} repository "${truncateText(name, 50)}" (the Strom app)`);
  applied.push({ do: "repo.add", id: r.id });
  return r.id;
}

const truncateText = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

function nameOf(gedName: string): { given: string; surname: string } {
  const m = /^(.*?)\/(.*?)\/(.*)$/.exec(gedName);
  if (!m) return { given: gedName.trim(), surname: "" };
  return { given: `${m[1]!.trim()} ${m[3]!.trim()}`.trim(), surname: m[2]!.trim() };
}

/** Details ("ages:P0001" among them) as an edit of the fact; an empty one takes it away. */
function detailEdit(d: Record<string, string>): { cause?: string; age?: string; house?: string; ages?: Record<string, string> } {
  const out: { cause?: string; age?: string; house?: string; ages?: Record<string, string> } = {};
  for (const [k, v] of Object.entries(d)) {
    if (k.startsWith("ages:")) out.ages = { ...out.ages, [k.slice(5)]: v };
    else if (k === "cause" || k === "age" || k === "house") out[k] = v;
  }
  return out;
}

function describe(f: { date?: string | undefined; place?: string | undefined; value?: string | undefined; cause?: string | undefined; age?: string | undefined; house?: string | undefined; ages?: Record<string, string> | undefined }): string {
  const ages = Object.entries(f.ages ?? {}).map(([who, a]) => `${who} aged ${a}`);
  return [f.value, f.date, f.place, f.house && `house ${f.house}`, f.age && `aged ${f.age}`, ...ages, f.cause && `cause ${f.cause}`].filter(Boolean).join(", ") || "—";
}

/**
 * The title of a conflict of the user's edit, in the research's language — the Strom app shows it in what the research
 * knows (found on Mac: "Petr Svoboda: SEX — U × F" in a Czech research): "Petr Svoboda: Pohlaví — neznámé × žena".
 */
function editTitle(who: string, what: string, ours: string, theirs: string): string {
  return `${who.replace(/\//g, "").replace(/\s+/g, " ").trim()}: ${what.charAt(0).toUpperCase()}${what.slice(1)} — ${ours} × ${theirs}`;
}

/** A fact as a conflict's title says it, in the research's language: "1904, Praha, čp. 12, věk 45 let". */
function factWords(tree: Tree, incoming: Snapshot, f: Parameters<typeof describe>[0]): string {
  const lang = tree.lang;
  const given = (k: string) => (k.startsWith("x:") ? undefined : tree.get<Person>(k)?.names[0]?.given) ?? (incoming.persons.get(k)?.names[0]?.split("/")[0]?.trim() || k);
  const ages = Object.entries(f.ages ?? {}).map(([who, a]) => `${given(who)} ${humanAge(a, lang)}`);
  return [f.value, humanDate(f.date, lang), f.place, f.house && ui(lang, "ui.sync.house", { x: f.house }), f.age && humanAge(f.age, lang), ...ages, f.cause && ui(lang, "ui.sync.cause", { x: f.cause })].filter(Boolean).join(", ") || "—";
}

/** Who the record names, as a conflict's title says it: "kmotr Jan Novák". */
function partWords(p: SPart, snap: Snapshot, lang: string): string {
  return `${labels(lang)(p.role as LabelKey)} ${partName(p, snap)}`;
}

/** A sex as a conflict's title says it: "muž", "žena", "neznámé". */
function sexWord(sex: string, lang: string): string {
  return ui(lang, sex === "M" ? "ui.show.sex.M" : sex === "F" ? "ui.show.sex.F" : "ui.conflict.sex.U");
}

/** Undo one sync: what it added withdrawn, what it corrected put back, its conflicts closed — each with the reason. */
/**
 * A conflict of the user's edit with what the research holds — or, one of the same fact still open (a sync made it:
 * the research's claim the same), the user's newer word in it (found on Windows: each rename again a conflict of its
 * own, X0003, X0004, X0005). Undo puts the conflict back as it was.
 */
/** The user's edit in a conflict: a new conflict, or the open one of an earlier send updated (its value before said). */
/**
 * The side taken in a conflict of the user's edit in the Strom app (`strom conflict resolve --take`): the user's — a
 * lead corrected in place, citing what the user's edit came from (the family tree that gave the old value no more); a
 * record's fact withdrawn with the reason and the user's a possible fact beside it (as sync.edits user) — or the
 * research's, the fact as it is. What it did, for the person; undefined: nothing to write (no edit kept).
 */
export function takeSide(tree: Tree, x: Conflict, side: "user" | "research", reason: string): string | undefined {
  if (side === "user" && x.parents) {
    // the user's parents: the child moved to their family (made when the research has none of them)
    const { child, from, partners } = x.parents;
    const named = x.parents.to ? tree.get<Family>(x.parents.to) : undefined;
    const to = named && !named.retracted ? named : addFamily(tree, { partners, children: [] });
    const done = moveChild(tree, child, from, to.id, `the user's parents (${x.id}): ${reason}`);
    if (!done) throw new UsageError(`${child} is no longer a child of ${from}, or already of ${to.id}`, { hint: `strom family show ${from}` });
    return `${child} a child of ${to.id} (${partners.join(" & ")}), no longer of ${from}${done.retracted ? ` — ${from} retracted, nothing left in it` : ""}`;
  }
  if (side === "research") return undefined;
  // a title of the name the user gave in the Strom app ("" taken off): on the name the person is shown by
  if (!x.edit && (x.fact === "NPFX" || x.fact === "NSFX")) {
    const user = x.claims.find((c) => c.note === "the user's edit");
    const p = x.subject[0] ? tree.get<Person>(x.subject[0]) : undefined;
    if (!p || p.retracted || !user) throw new UsageError(`the person of ${x.id} is no longer in the research`, { hint: `strom conflict show ${x.id}` });
    const part = x.fact === "NPFX" ? "before" : "after";
    const from = user.source && tree.get(user.source)?.type === "source" ? { source: user.source, locator: "title" } : undefined;
    setTitle(tree, p.id, part, user.value, from, `the user's edit (${x.id}): ${reason}`);
    return `${p.id}: ${titledName(primaryName(tree.get<Person>(p.id)!))}`;
  }
  // a name or a sex the user gave in the Strom app (found on Mac: --take refused for them, only for facts and parents)
  if (!x.edit && (x.fact === "NAME" || x.fact === "SEX")) {
    const owner = x.subject[0];
    const user = x.claims.find((c) => c.note === "the user's edit");
    const p = owner ? tree.get<Person>(owner) : undefined;
    if (!p || p.retracted || !user?.value) throw new UsageError(`the person of ${x.id} is no longer in the research`, { hint: `strom conflict show ${x.id}` });
    if (x.fact === "SEX") {
      editPerson(tree, p.id, { sex: user.value }, `the user's edit (${x.id}): ${reason}`);
      return `${p.id}: ${user.value}`;
    }
    // shown by the user's name from now on, the record's kept beside it (the user's was kept as another form meanwhile)
    const words = (v: string) => foldText(v.replace(/\//g, " ")).replace(/\s+/g, " ").trim();
    const kept = p.names.find((n) => words(`${n.given} ${n.surname}`) === words(user.value));
    const from = user.source && tree.get(user.source)?.type === "source" && !kept?.citations?.some((c) => c.source === user.source) ? { source: user.source, locator: "name" } : undefined;
    const { name } = addName(tree, p.id, { name: user.value, primary: true, ...(from ? { citation: from } : {}) });
    return `${p.id} shown as ${gedcomName(name)}`;
  }
  if (!x.edit) return undefined;
  const mine = eventById(tree, x.edit.event);
  const owner = x.subject[0];
  if (!mine || mine.retracted || !owner) throw new UsageError(`the fact of ${x.id} (${x.edit.event}) is no longer in the research`, { hint: `strom conflict show ${x.id}` });
  const user = x.claims.find((c) => c.note === "the user's edit");
  // where the user's value came from: the sources they gave it in the app (where in them), and their edits' source
  const cited = [...(x.edit.cites ?? []), ...(user?.source && tree.get(user.source)?.type === "source" ? [{ source: user.source, locator: mine.kind }] : [])].filter((c, i, all) => !!tree.get<Source>(c.source) && all.findIndex((y) => y.source === c.source) === i);
  if (recordBacked(tree, mine)) {
    retractEvent(tree, mine.id, `the user's edit wins (${x.id}): ${reason}`);
    const { event } = addEvent(tree, owner, { kind: mine.kind, ...(x.edit.date ? { date: x.edit.date } : {}), ...(x.edit.place ? { place: x.edit.place } : {}), ...(x.edit.value ? { value: x.edit.value } : {}), ...(mine.label ? { label: mine.label } : {}), status: "possible", citations: cited });
    return `${mine.id} withdrawn, ${event.id} the user's: ${describe(event)}`;
  }
  editEvent(tree, mine.id, { date: x.edit.date ?? "", place: x.edit.place ?? "", ...(x.edit.value !== undefined ? { value: x.edit.value } : {}) }, `the user's edit (${x.id}): ${reason}`);
  update<Person | Family>(tree, owner, owner.startsWith("F") ? "family" : "person", (o) => ({
    ...o,
    events: o.events.map((e) => (e.id === mine.id ? { ...e, citations: [...e.citations.filter((c) => !cited.length || tree.get<Source>(c.source)?.kind !== "family-tree" || cited.some((y) => y.source === c.source)), ...cited.filter((y) => !e.citations.some((c) => c.source === y.source))] } : e)),
  }), { op: "event.cite", summary: `${mine.id} cites what the user's edit came from (${x.id})` });
  return `${mine.id}: ${describe({ ...mine, ...x.edit })}`;
}

/** A child's parents as a conflict names them: "Jan Novák & Marie Nováková" (one unknown: the one known). */
function parentsText(tree: Tree, incoming: Snapshot, keys: string[]): string {
  const shown = (k: string) => {
    const x = k.startsWith("x:") ? undefined : tree.get<Person>(k);
    return (x ? gedcomName(primaryName(x)) : (incoming.persons.get(k)?.names[0] ?? k)).replace(/\//g, "").replace(/\s+/g, " ").trim();
  };
  return keys.map(shown).join(" & ") || "?";
}

function conflictOfEdit(tree: Tree, applied: Applied[], owner: string, fact: string, title: string, claims: Conflict["claims"], edit?: Conflict["edit"], parents?: Conflict["parents"]): { was?: string } {
  const [ours, theirs] = claims;
  const open = tree
    .list<Conflict>("conflict")
    .find((x) => x.state === "open" && x.fact === fact && x.subject[0] === owner && x.claims.length === 2 && x.claims[0]!.note === ours!.note && x.claims[0]!.value === ours!.value && x.claims[1]!.note === theirs!.note);
  if (open) {
    if (open.claims[1]!.value === theirs!.value) return {};
    update<Conflict>(tree, open.id, "conflict", (x) => ({ ...x, title: title.slice(0, 200), claims: [x.claims[0]!, theirs!], ...(edit ? { edit } : {}), ...(parents ? { parents } : {}) }), {
      op: "conflict.edit",
      summary: `${open.id} the user's edit now: ${theirs!.value.slice(0, 80)}`,
    });
    applied.push({ do: "conflict.edit", id: open.id, before: JSON.stringify({ title: open.title, claims: open.claims }) });
    return { was: open.claims[1]!.value };
  }
  const x = create<Conflict>(tree, "conflict", { title: title.slice(0, 200), fact, subject: [owner], claims, ...(edit ? { edit } : {}), ...(parents ? { parents } : {}), state: "open" } as never, (id) => `+${id} conflict "${title.slice(0, 60)}"`, [owner]);
  applied.push({ do: "conflict.add", id: x.id });
  return {};
}

/**
 * A name only the user's edits in the Strom app gave (every citation an app's edits source), never the one shown: taken
 * off with the reason, where it stood kept for an undo.
 */
function dropUsersName(tree: Tree, applied: Applied[], owner: string, value: string, reason: string): void {
  const p = tree.get<Person>(owner);
  if (!p) return;
  const fromApp = (n: Name) => !!n.citations?.length && n.citations.every((c) => tree.get<Source>(c.source)?.kind === "family-tree");
  const at = p.names.findIndex((n, i) => i > 0 && fromApp(n) && nameKey(gedcomName(n)) === nameKey(value));
  if (at < 0) return;
  const gone = p.names[at]!;
  update<Person>(tree, owner, "person", (x) => ({ ...x, names: x.names.filter((_, i) => i !== at) }), {
    op: "name.remove",
    summary: `${owner} name ${gedcomName(gone)} removed: the user's edit is another now (${reason})`,
    reason: `the user's edit is another now: ${reason}`,
  });
  applied.push({ do: "name.drop", id: owner, before: JSON.stringify({ name: gone, at }) });
}

export function undoSync(tree: Tree, input: SyncInput): number {
  const done = input.sync?.applied ?? [];
  const reason = `sync ${input.id} undone`;
  let n = 0;
  for (const a of [...done].reverse()) {
    switch (a.do) {
      case "event.add":
        if (!eventById(tree, a.id)?.retracted) retractEvent(tree, a.id, reason);
        break;
      case "event.edit": {
        const b = a.before as SFact;
        editEvent(tree, a.id, { date: b.date ?? "", place: b.place ?? "", ...(b.value !== undefined ? { value: b.value } : {}) }, reason);
        break;
      }
      case "event.detail": {
        // what it was put back: a detail it had, and none where it had none
        const e = eventById(tree, a.id);
        const before = JSON.parse(String(a.before ?? "{}")) as Record<string, string>;
        const now = e ? detailsOf(e) : {};
        const back = Object.fromEntries(Object.entries(before).filter(([d, v]) => v !== (now[d] ?? "")));
        if (e && Object.keys(back).length) editEvent(tree, a.id, detailEdit(back), reason);
        break;
      }
      case "event.retract":
        restoreEvent(tree, a.id, String(a.before ?? "lead"), reason);
        break;
      case "conflict.add":
        update<Conflict>(tree, a.id, "conflict", (x) => ({ ...x, state: "resolved", resolution: reason }), { op: "conflict.resolve", summary: `${a.id} resolved: ${reason}` });
        break;
      case "conflict.edit": {
        // the user's edit it brought taken out: the conflict as the send before left it
        const before = JSON.parse(String(a.before)) as Pick<Conflict, "title" | "claims">;
        update<Conflict>(tree, a.id, "conflict", (x) => ({ ...x, title: before.title, claims: before.claims }), { op: "conflict.edit", summary: `${a.id} the user's edit as before: ${reason}`, reason });
        break;
      }
      case "name.add": {
        // the name it added: the last of that spelling — the one shown too (an older strom put a name with a surname
        // in front of one without: found on Windows, the undo said it took it off and kept it); never a person's only name
        const p = tree.get<Person>(a.id);
        const at = p ? p.names.map((m) => exact(`${m.given}|${m.surname}`)).lastIndexOf(String(a.before)) : -1;
        if (p && at >= 0 && p.names.length > 1)
          update<Person>(tree, a.id, "person", (x) => ({ ...x, names: x.names.filter((_, i) => i !== at) }), { op: "name.remove", summary: `${a.id} name ${gedcomName(p.names[at]!)} removed: ${reason}`, reason });
        break;
      }
      case "name.drop": {
        // the user's name an edit replaced: back where it stood
        const b = JSON.parse(String(a.before ?? "{}")) as { name?: Name; at?: number };
        const p = tree.get<Person>(a.id);
        if (b.name && p && !p.names.some((n) => exact(`${n.given}|${n.surname}`) === exact(`${b.name!.given}|${b.name!.surname}`)))
          update<Person>(tree, a.id, "person", (x) => ({ ...x, names: [...x.names.slice(0, b.at ?? x.names.length), b.name!, ...x.names.slice(b.at ?? x.names.length)] }), {
            op: "person.name",
            summary: `${a.id} name ${gedcomName(b.name)}`,
            reason,
          });
        break;
      }
      case "name.edit": {
        // the corrected name as it was, citations and all
        const b = JSON.parse(String(a.before ?? "{}")) as { name?: Name; now?: string };
        if (b.name)
          update<Person>(tree, a.id, "person", (p) => ({ ...p, names: p.names.map((n) => (exact(`${n.given}|${n.surname}`) === b.now ? b.name! : n)) }), {
            op: "person.edit",
            summary: `${a.id} name ${b.name.given} /${b.name.surname}/ again: ${reason}`,
            reason,
          });
        break;
      }
      case "name.title": {
        // the title as it was, and the citation of the sync it added taken off
        const b = JSON.parse(String(a.before ?? "{}")) as { part?: "before" | "after"; was?: string; cited?: Citation };
        const p = tree.get<Person>(a.id);
        if (!p || (b.part !== "before" && b.part !== "after")) break;
        const key = b.part === "before" ? "prefix" : "suffix";
        update<Person>(
          tree,
          a.id,
          "person",
          (x) => {
            const at = x.names.indexOf(primaryName(x));
            const drop = (n: Name): Name => {
              if (!b.cited) return n;
              const left = (n.citations ?? []).filter((c) => !(c.source === b.cited!.source && c.locator === b.cited!.locator));
              const { citations: _c, ...rest } = n;
              return left.length ? { ...rest, citations: left } : rest;
            };
            return { ...x, names: x.names.map((n, i) => (i !== at ? n : titled(drop(n), key, b.was ?? ""))) };
          },
          { op: "person.edit", summary: `${a.id} title ${b.part} the name ${b.was ? `"${b.was}"` : "taken off"} again: ${reason}`, reason },
        );
        break;
      }
      case "name.primary": {
        // the name added taken off, the one shown before in front again
        const b = JSON.parse(String(a.before ?? "{}")) as { added?: string; shown?: string };
        const keyOf = (n: Name) => exact(`${n.given}|${n.surname}`);
        const p0 = tree.get<Person>(a.id);
        if (!p0) break;
        const gone = p0.names.findLast((n) => keyOf(n) === b.added && keyOf(n) !== b.shown);
        const at = gone ? p0.names.lastIndexOf(gone) : -1;
        const left = at >= 0 ? p0.names.filter((_, i) => i !== at) : p0.names;
        const shown = left.find((n) => keyOf(n) === b.shown);
        const names = shown ? [shown, ...left.filter((n) => n !== shown)] : left;
        // the name it added changed since (found on Windows: "Removed name: ?"): only the one shown before in front again
        if (names.length === p0.names.length && names.every((n, i) => n === p0.names[i])) break;
        update<Person>(
          tree,
          a.id,
          "person",
          (p) => ({ ...p, names }),
          gone
            ? { op: "name.remove", summary: `${a.id} name ${gedcomName(gone)} removed, shown by its name before again: ${reason}`, reason }
            : { op: "person.edit", summary: `${a.id} shown by its name before again: ${reason}`, reason },
        );
        break;
      }
      case "note.add":
        update<Person | Family | Source>(tree, a.id, typeOfId(a.id) ?? "person", (o) => ({ ...o, notes: o.notes.filter((x) => x.at !== a.before) }), { op: "note.remove", summary: `${a.id} note "${noteText(tree, a.id, a.before)}" removed: ${reason}`, reason });
        break;
      case "event.uncite": {
        // the citations of the family tree that gave the value before, back with it
        const back = JSON.parse(String(a.before ?? "[]")) as Citation[];
        const owner = ownerOf(tree, a.id);
        if (owner && back.length)
          update<Person | Family>(tree, owner.id, owner.type, (o) => ({ ...o, events: o.events.map((e) => (e.id === a.id ? { ...e, citations: [...back.filter((c) => !e.citations.some((x) => x.source === c.source && x.locator === c.locator)), ...e.citations] } : e)) }), {
            op: "event.cite",
            summary: `${a.id} cites ${back.map((c) => c.source).join(", ")} again: ${reason}`,
            reason,
          });
        break;
      }
      case "event.cite": {
        const b = JSON.parse(String(a.before ?? "{}")) as { status?: Event["status"]; sources?: string[] };
        const owner = ownerOf(tree, a.id);
        if (owner)
          update<Person | Family>(tree, owner.id, owner.type, (o) => ({ ...o, events: o.events.map((e) => (e.id === a.id ? { ...e, citations: e.citations.filter((c) => !b.sources?.includes(c.source)), ...(b.status ? { status: b.status } : {}) } : e)) }), {
            op: "event.cite",
            summary: `${a.id} cites no more ${(b.sources ?? []).join(", ")}: ${reason}`,
            reason,
          });
        break;
      }
      case "event.parts": {
        const before = JSON.parse(String(a.before ?? "[]")) as Participant[];
        const owner = ownerOf(tree, a.id);
        if (owner)
          update<Person | Family>(
            tree,
            owner.id,
            owner.type,
            (o) => ({
              ...o,
              events: o.events.map((e) => {
                if (e.id !== a.id) return e;
                const { participants: _p, ...rest } = e;
                return { ...rest, ...(before.length ? { participants: before } : {}) } as Event;
              }),
            }),
            { op: "event.edit", summary: `${a.id} participants as they were: ${reason}`, reason },
          );
        break;
      }
      case "name.cite": {
        const b = JSON.parse(String(a.before ?? "{}")) as { sources?: string[] };
        update<Person>(tree, a.id, "person", (p) => ({ ...p, names: p.names.map((n) => (n.citations ? { ...n, citations: n.citations.filter((c) => !b.sources?.includes(c.source)) } : n)) }), {
          op: "name.cite",
          summary: `${a.id} cites no more ${(b.sources ?? []).join(", ")}: ${reason}`,
          reason,
        });
        break;
      }
      case "family.cite": {
        const b = JSON.parse(String(a.before ?? "{}")) as { sources?: string[] };
        update<Family>(
          tree,
          a.id,
          "family",
          ({ citations, ...f }) => {
            const left = (citations ?? []).filter((c) => !b.sources?.includes(c.source));
            return { ...f, ...(left.length ? { citations: left } : {}) } as Family;
          },
          { op: "family.cite", summary: `${a.id} cites no more ${(b.sources ?? []).join(", ")}: ${reason}`, reason },
        );
        break;
      }
      case "event.status": {
        const owner = ownerOf(tree, a.id);
        if (owner)
          update<Person | Family>(tree, owner.id, owner.type, (o) => ({ ...o, events: o.events.map((e) => (e.id === a.id && !e.retracted ? { ...e, status: String(a.before ?? "lead") as Event["status"] } : e)) }), {
            op: "event.status",
            summary: `${a.id} ${String(a.before ?? "lead")} again: ${reason}`,
            reason,
          });
        break;
      }
      case "source.edit": {
        const b = JSON.parse(String(a.before ?? "{}")) as { transcript?: string | null; locator?: string | null; app?: Source["app"] | null };
        update<Source>(
          tree,
          a.id,
          "source",
          ({ transcript: _t, locator: _l, app: _a, ...x }) => ({ ...x, ...(b.transcript ? { transcript: b.transcript } : {}), ...(b.locator ? { locator: b.locator } : {}), ...(b.app ? { app: b.app } : {}) }) as Source,
          { op: "source.sync", summary: `${a.id} as it was: ${reason}` },
        );
        break;
      }
      case "person.retract":
        update<Person>(tree, a.id, "person", ({ retracted: _r, ...p }) => p as Person, { op: "person.restore", summary: `${a.id} restored: ${reason}`, reason });
        break;
      case "child.remove": {
        const link = JSON.parse(String(a.before ?? "{}")) as Family["children"][number];
        if (link.person)
          update<Family>(tree, a.id, "family", (f) => (f.children.some((x) => x.person === link.person) ? f : { ...f, children: [...f.children, link] }), { op: "family.edit", summary: `${a.id} child ${link.person} back: ${reason}`, reason });
        break;
      }
      case "source.add":
        update<Source>(tree, a.id, "source", (x) => ({ ...x, retracted: { at: now(), reason } }), { op: "source.retract", summary: `${a.id} retracted: ${reason}` });
        break;
      case "repo.add":
        update<Repository>(tree, a.id, "repository", (x) => ({ ...x, retracted: { at: now(), reason } }), { op: "repo.retract", summary: `${a.id} retracted: ${reason}`, reason });
        break;
      case "task.add":
        update<Task>(tree, a.id, "task", (t) => (t.state === "open" || t.state === "parked" ? { ...t, state: "dropped", result: reason } : t), { op: "task.drop", summary: `${a.id} dropped: ${reason}` });
        break;
      case "sex.edit":
        editPerson(tree, a.id, { sex: String(a.before ?? "U") }, reason);
        break;
      case "child.add":
        update<Family>(tree, a.id, "family", (f) => ({ ...f, children: f.children.filter((c) => c.person !== a.before) }), { op: "family.edit", summary: `${a.id} child ${String(a.before)} removed: ${reason}`, reason });
        break;
      case "child.move": {
        const b = JSON.parse(String(a.before ?? "{}")) as { child?: string; from?: string; link?: ChildLink; at?: number; retracted?: boolean };
        if (!b.child || !b.from || !b.link) break;
        update<Family>(tree, a.id, "family", (f) => ({ ...f, children: f.children.filter((c) => c.person !== b.child) }), { op: "family.edit", summary: `${a.id} child ${b.child} back to ${b.from}: ${reason}`, reason });
        update<Family>(tree, b.from, "family", ({ retracted: _r, ...f }) => ({ ...f, ...(b.retracted ? {} : _r ? { retracted: _r } : {}), children: f.children.some((c) => c.person === b.child) ? f.children : f.children.toSpliced(b.at ?? f.children.length, 0, b.link!) }), { op: "family.edit", summary: `${b.from} child ${b.child} back${b.retracted ? ", the family back" : ""}: ${reason}`, reason });
        break;
      }
      case "child.relation": {
        const was = JSON.parse(String(a.before ?? "{}")) as ChildLink;
        if (was.person)
          update<Family>(tree, a.id, "family", (f) => ({ ...f, children: f.children.map((x) => (x.person === was.person ? was : x)) }), { op: "family.edit", summary: `${a.id} ${was.person} tied as before: ${reason}`, reason });
        break;
      }
      case "partner.add":
        update<Family>(tree, a.id, "family", ({ noCouple: _n, ...f }) => ({ ...f, partners: f.partners.filter((p) => p !== a.before) }), { op: "family.edit", summary: `${a.id} partner ${String(a.before)} removed: ${reason}`, reason });
        break;
      case "partner.remove": {
        const b = JSON.parse(String(a.before ?? "{}")) as { partner?: string; at?: number };
        if (b.partner)
          update<Family>(tree, a.id, "family", (f) => (f.partners.includes(b.partner!) || f.partners.length >= 2 ? f : { ...f, partners: f.partners.toSpliced(b.at ?? f.partners.length, 0, b.partner!) }), { op: "family.edit", summary: `${a.id} partner ${b.partner} back: ${reason}`, reason });
        break;
      }
      case "family.add":
        update<Family>(tree, a.id, "family", (f) => ({ ...f, retracted: { at: now(), reason } }), { op: "family.retract", summary: `${a.id} retracted: ${reason}` });
        break;
      case "family.union": {
        const was = UNIONS.includes(a.before as Union) ? (a.before as Union) : undefined;
        update<Family>(tree, a.id, "family", ({ union: _u, ...f }) => ({ ...f, ...(was ? { union: was } : {}) }) as Family, { op: "family.edit", summary: `${a.id} union ${was ?? "none"} again: ${reason}`, reason });
        break;
      }
      case "person.add":
        if (!tree.get<Person>(a.id)?.retracted) retractPerson(tree, a.id, reason);
        break;
      case "place.edit": {
        const b = JSON.parse(String(a.before ?? "{}")) as Pick<Place, "coords" | "unlocated">;
        update<Place>(tree, a.id, "place", ({ coords: _now, unlocated: _u, ...p }) => ({ ...p, ...(b.coords ? { coords: b.coords } : {}), ...(b.unlocated ? { unlocated: b.unlocated } : {}) }), {
          op: "place.edit",
          summary: `${a.id} position back: ${reason}`,
          reason,
        });
        break;
      }
      case "place.add":
        update<Place>(tree, a.id, "place", (p) => ({ ...p, retracted: { at: now(), reason } }), { op: "place.retract", summary: `${a.id} retracted: ${reason}`, reason });
        break;
    }
    n++;
  }
  return n;
}

/** The person or family a fact is of. */
function ownerOf(tree: Tree, eventId: string): Person | Family | undefined {
  return [...tree.list<Person>("person"), ...tree.list<Family>("family")].find((o) => o.events.some((e) => e.id === eventId));
}

/** A fact withdrawn by a sync, back as it was. */
function restoreEvent(tree: Tree, id: string, status: string, reason: string): void {
  for (const o of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
    const e = o.events.find((x) => x.id === id);
    if (!e?.retracted) continue;
    const { retracted: _gone, ...rest } = e;
    update<Person | Family>(tree, o.id, o.type, (x) => ({ ...x, events: x.events.map((y) => (y.id === id ? ({ ...rest, status } as Event) : y)) }), { op: "event.restore", summary: `${id} restored: ${reason}` });
    return;
  }
}
