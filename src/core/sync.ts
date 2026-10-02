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

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eventKind, type Conflict, type Event, type Family, type Input, type Person, type Place, type Source } from "./model.ts";
import { addChild, addEvent, addFamily, addName, addNote, editEvent, editPerson, retractEvent, retractPerson } from "./actions.ts";
import { exportGedcom, REFN_TYPE } from "../gedcom/export.ts";
import { children, parseGedcomText, val, type GedNode } from "../gedcom/parse.ts";
import { fromFlexDate, houseOf, importDate } from "./import.ts";
import { normalizeAge } from "./age.ts";
import { create, update } from "./records.ts";
import { foldText } from "./text.ts";
import { UsageError } from "./errors.ts";
import * as git from "./git.ts";
import { now, Tree } from "./tree.ts";

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
  /** Ours and base only: the fact's ID in the research. */
  id?: string;
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
}

export interface SFamily {
  partners: string[];
  children: string[];
  facts: SFact[];
  /** Ours and base only. */
  id?: string;
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
  problems: string[];
}

const OUR_ID = /^P\d{4,}$/;

const fold = (s: string | undefined) => (s ? foldText(s).replace(/\s+/g, " ").trim() : "");
/** Lower case, accents kept: "Dvořak" is not "Dvořák" — a corrected accent is an edit. */
const exact = (s: string | undefined) => (s ? s.normalize("NFC").toLocaleLowerCase().replace(/\s+/g, " ").trim() : "");
/** Christening and baptism are one fact here, as in the import. */
const kindOf = (k: string) => (k === "CHR" ? "BAPM" : k);
/** A fact for a comparison. An event's label only where nothing else tells it apart: it is in the language of whoever wrote it. */
export const factKey = (f: SFact) => [kindOf(f.kind), f.date ?? "", exact(f.place), exact(f.value), f.date || f.place ? "" : fold(f.label)].join("|");
/** A name for a comparison: "? /Novák/", "Jan //" and "Jan /?/" are the names the research has. */
const nameKey = (n: string) => exact(n.replace(/[/?]/g, " "));

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

/** Facts there is one of: an edit of one is a change, not a second fact. */
const ONE = new Set(["BIRT", "BAPM", "DEAT", "BURI", "CREM", "MARR", "DIV"]);

function gedFacts(node: GedNode): SFact[] {
  return cleanFacts(rawFacts(node));
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
  const out = facts;
  // the Strom app's "Birth record" (an event only to carry a birth's godparents): the same date and place as a fact
  const at = (f: SFact) => `${f.date ?? ""}|${fold(f.place)}`;
  return out.filter(
    (f) =>
      (f.kind !== "EVEN" || !(f.date || f.place) || !out.some((o) => o !== f && o.kind !== "EVEN" && at(o) === at(f))) &&
      // a marriage with nothing known of it: every couple of the Strom app is "married"
      !(f.kind === "MARR" && !f.date && !f.place && !f.value),
  );
}

function rawFacts(node: GedNode): SFact[] {
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
    details(f, val(c, "CAUS"), val(c, "AGE"), val(c, "ADDR"));
    const id = val(c, "_EID");
    if (id) f.id = id;
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

/** The details of a fact the research compares (DETAILS of SFact). */
const DETAILS = ["cause", "age", "house"] as const;

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
  return unknown.length < 3 || unknown.length <= w.size * 0.2;
}

/** A GEDCOM file (or one of ours, in memory) as a snapshot; an unreadable one throws. */
export function readGedcom(text: string): Snapshot {
  const { records, problems } = parseGedcomText(text);
  const head = records.find((r) => r.tag === "HEAD");
  const notes = new Map(records.filter((r) => r.tag === "NOTE" && r.xref).map((r) => [r.xref!, r.value]));
  const noteText = (n: GedNode) => (/^@[^@]+@$/.test(n.value.trim()) ? (notes.get(n.value.trim()) ?? "") : n.value);
  const keys = new Map<string, string>();
  const persons = new Map<string, SPerson>();
  for (const r of records.filter((x) => x.tag === "INDI" && x.xref)) {
    const refn = r.children.find((c) => c.tag === "REFN");
    const type = refn ? val(refn, "TYPE") : undefined;
    const ours = refn && OUR_ID.test(refn.value.trim()) && (!type || type === REFN_TYPE) ? refn.value.trim() : undefined;
    const key = ours && !persons.has(ours) ? ours : `x:${r.xref!.replace(/@/g, "")}`;
    keys.set(r.xref!, key);
    const sex = val(r, "SEX");
    const names = children(r, "NAME").map((n) => n.value.trim()).filter((n) => n.replace(/[/?\s]/g, ""));
    // a placeholder of the Strom app (an unknown parent drawn in the tree): nobody
    if (!ours && !names.length) continue;
    persons.set(key, {
      key,
      names,
      ...(sex === "M" || sex === "F" ? { sex } : {}),
      facts: gedFacts(r),
      notes: children(r, "NOTE").map(noteText).map((t) => t.trim()).filter(Boolean),
      said: allNotes(r, noteText),
    });
  }
  const families: SFamily[] = [];
  for (const r of records.filter((x) => x.tag === "FAM")) {
    const who = (tag: string) => children(r, tag).map((c) => keys.get(c.value.trim())).filter((k): k is string => !!k && persons.has(k));
    families.push({ partners: [...who("HUSB"), ...who("WIFE")], children: who("CHIL"), facts: gedFacts(r) });
  }
  const treeId = val(head, "_STROM_TREE");
  const at = val(head, "_STROM_HEAD");
  return { format: "gedcom", ...(treeId ? { treeId } : {}), ...(at ? { head: at } : {}), persons, families, places: gedPlaces(records), problems };
}

/** The Strom app's life events → our kinds. */
const APP_EVENTS: Record<string, string> = {
  birth: "BIRT", death: "DEAT", baptism: "BAPM", burial: "BURI", occupation: "OCCU", residence: "RESI", military: "MILI",
  emigration: "EMIG", immigration: "IMMI", education: "EDUC", religion: "RELI", custom: "EVEN", confirmation: "CONF",
  firstCommunion: "FCOM", barMitzvah: "BARM", batMitzvah: "BASM", ordination: "ORDN", adoption: "ADOP", naturalization: "NATU",
  will: "WILL", probate: "PROB", title: "TITL", nationality: "NATI", cremation: "CREM",
};

/** Facts whose value is what they are (the GEDCOM tag's value). */
const VALUE_KINDS = new Set(["OCCU", "RELI", "TITL", "NATI"]);

interface AppPerson {
  id: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
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
  events?: { type: string; customLabel?: string; date?: string; place?: string; note?: string; cause?: string; age?: string; address?: string }[];
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
}

/** A tree of the Strom app (its JSON) as a snapshot. */
export function readStromJson(data: unknown): Snapshot {
  const d = data as { persons?: Record<string, AppPerson>; partnerships?: Record<string, AppPartnership>; places?: Record<string, { lat?: unknown; lon?: unknown }>; research?: { id?: string; head?: string } };
  if (!d || typeof d !== "object" || !d.persons || typeof d.persons !== "object") throw new UsageError("not a family tree of the Strom app: no persons in it");
  const keys = new Map<string, string>();
  const persons = new Map<string, SPerson>();
  for (const p of Object.values(d.persons)) {
    // a placeholder of the Strom app (an unknown parent drawn in the tree): nobody
    if (!p?.id || p.isPlaceholder) continue;
    const refn = p.refn?.trim();
    const key = refn && OUR_ID.test(refn) && (!p.refnType || p.refnType === REFN_TYPE) && !persons.has(refn) ? refn : `x:${p.id}`;
    keys.set(p.id, key);
    const facts: SFact[] = [];
    const fact = (kind: string, date?: string, place?: string, label?: string, value?: string, more: { cause?: string | undefined; age?: string | undefined; house?: string | undefined } = {}) => {
      const f: SFact = { kind };
      const g = fromFlexDate(date);
      if (g) f.date = g;
      if (place?.trim()) f.place = place.trim().replace(/\s+/g, " ");
      if (label) f.label = label;
      if (value?.trim()) f.value = value.trim().replace(/\s+/g, " ");
      details(f, more.cause, more.age, more.house);
      if (f.date || f.place || label || kind !== "EVEN") facts.push(f);
    };
    if (p.birthDate || p.birthPlace || p.birthAddress) fact("BIRT", p.birthDate, p.birthPlace, undefined, undefined, { house: p.birthAddress });
    if (p.deathDate || p.deathPlace || p.deathCause || p.deathAge || p.deathAddress)
      fact("DEAT", p.deathDate, p.deathPlace, undefined, undefined, { cause: p.deathCause, age: p.deathAge, house: p.deathAddress });
    for (const e of p.events ?? []) {
      const kind = APP_EVENTS[e.type];
      if (!kind || ((kind === "BIRT" || kind === "DEAT") && facts.some((f) => f.kind === kind))) continue;
      // an occupation, a religion, a title: the app keeps what it is as the event's note (its first line)
      const value = VALUE_KINDS.has(kind) ? e.note?.split("\n")[0] : undefined;
      fact(kind === "MILI" ? "EVEN" : kind, e.date, e.place, kind === "EVEN" ? e.customLabel || "EVEN" : undefined, value, { cause: e.cause, age: e.age, house: e.address });
    }
    const name = `${p.firstName ?? ""} /${p.lastName ?? ""}/`.trim();
    if (!key.startsWith("P") && !`${p.firstName ?? ""}${p.lastName ?? ""}`.replace(/[?\s]/g, "")) {
      keys.delete(p.id);
      continue;
    }
    persons.set(key, {
      key,
      names: [name, ...(p.nameVariants ?? [])].filter((n) => n.replace(/[/?\s]/g, "")),
      ...(p.gender === "male" ? { sex: "M" } : p.gender === "female" ? { sex: "F" } : {}),
      facts: cleanFacts(facts),
      notes: p.notes?.trim() ? [p.notes.trim()] : [],
      said: p.notes ?? "",
    });
  }
  const families: SFamily[] = [];
  for (const u of Object.values(d.partnerships ?? {})) {
    const partners = [u.person1Id, u.person2Id].map((x) => (x ? keys.get(x) : undefined)).filter((k): k is string => !!k);
    const facts: SFact[] = [];
    if ((u.status === "married" || u.status === "divorced") && (u.startDate || u.startPlace)) {
      const f: SFact = { kind: "MARR" };
      const g = fromFlexDate(u.startDate);
      if (g) f.date = g;
      if (u.startPlace?.trim()) f.place = u.startPlace.trim();
      details(f, undefined, undefined, u.address);
      facts.push(f);
    }
    // the divorce (the app's 3.7 keeps its place too)
    if (u.status === "divorced" && (u.endDate || u.endPlace)) {
      const f: SFact = { kind: "DIV" };
      const g = fromFlexDate(u.endDate);
      if (g) f.date = g;
      if (u.endPlace?.trim()) f.place = u.endPlace.trim();
      facts.push(f);
    }
    families.push({ partners, children: (u.childIds ?? []).map((c) => keys.get(c)).filter((k): k is string => !!k), facts });
  }
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
  return { format: "strom-json", ...(r?.id ? { treeId: r.id } : {}), ...(r?.head ? { head: r.head } : {}), persons, families, places, problems: [] };
}

/** A file coming back: GEDCOM or the Strom app's JSON; empty or unreadable throws. */
export function readTreeFile(file: string): Snapshot {
  const text = fs.readFileSync(file, "utf8");
  if (!text.trim()) throw new UsageError(`${path.basename(file)} is empty`);
  let snap: Snapshot;
  if (/^﻿?\s*[{[]/.test(text)) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new UsageError(`${path.basename(file)} is not readable JSON: ${(e as Error).message}`);
    }
    snap = readStromJson(data);
  } else if (/^﻿?\s*0\s+HEAD/m.test(text)) snap = readGedcom(text);
  else throw new UsageError(`${path.basename(file)} is neither a GEDCOM file nor a family tree of the Strom app`);
  if (!snap.persons.size) throw new UsageError(`${path.basename(file)} has no people in it`, { hint: "a file exported from the Strom app or another family-tree program" });
  return snap;
}

/** Our records as the app is given them: the export for it, read like any file — with the facts' IDs. */
export function snapshotOfTree(tree: Tree): Snapshot {
  return readGedcom(exportGedcom(tree, { for: "strom", ids: true }).text);
}

/** The folders of data/ the export for the app reads. */
const EXPORTED = ["persons", "families", "sources", "repositories", "places", "recordsets"];

/** The research at a commit, as it was given the app — undefined when the history does not have it. */
export function snapshotAt(tree: Tree, head: string): Snapshot | undefined {
  if (!/^[0-9a-f]{7,64}$/i.test(head)) return undefined;
  if (git.runGit(tree.root, ["cat-file", "-e", `${head}^{commit}`]).status !== 0) return undefined;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-sync-"));
  try {
    const config = git.showFile(tree.root, head, "strom.json");
    if (!config) return undefined;
    fs.writeFileSync(path.join(dir, "strom.json"), config);
    // what the export reads: not the images, tasks, sessions … of the research
    const files = EXPORTED.flatMap((d) => git.listFiles(tree.root, head, `data/${d}`)).concat("data/_counters.json");
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
 * A tree the Strom app sent (POST <bridge>/sync): checked as any file, kept in the inbox to be shown and written on
 * the user's word — nothing of the research changes here. Returns the file and how many changes it brings.
 */
export function receiveTree(root: string, env: Tree["env"], text: string): { file: string; changes: number } {
  if (!/^\uFEFF?\s*0\s+HEAD/.test(text)) throw new UsageError("not a GEDCOM file");
  const dir = path.join(root, SYNC_INBOX);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `strom-app-${new Date().toISOString().replace(/[:.]/g, "-")}.ged`);
  fs.writeFileSync(file, text);
  try {
    const tree = Tree.open(root, env);
    return { file, changes: planSync(tree, readTreeFile(file), "conflict").changes.length };
  } catch (e) {
    fs.rmSync(file, { force: true });
    throw e;
  }
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

/** This research waits for the app's tree with this mark (the link's app=…). */
export function awaitAdoption(root: string, token: string): void {
  fs.mkdirSync(path.join(root, ".strom"), { recursive: true });
  fs.writeFileSync(path.join(root, ADOPT_FILE), JSON.stringify({ token, at: new Date().toISOString() }));
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
 * The app's tree for a new research (POST <bridge>/adopt): a GEDCOM, kept in the inbox for the research in the
 * terminal to take in — nothing of the research changes here. Taken once; the file it was kept as.
 */
export function receiveAdopted(root: string, text: string): string {
  if (!pendingAdoption(root)) throw new UsageError("this research waits for no tree");
  if (!/^\uFEFF?\s*0\s+HEAD/.test(text)) throw new UsageError("not a GEDCOM file");
  if (!/^1 INDI\b|^0 @[^@]+@ INDI\b/m.test(text)) throw new UsageError("empty: no people in it");
  const dir = path.join(root, SYNC_INBOX);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `adopt-${new Date().toISOString().replace(/[:.]/g, "-")}.ged`);
  fs.writeFileSync(file, text);
  const a = JSON.parse(fs.readFileSync(path.join(root, ADOPT_FILE), "utf8")) as Record<string, string>;
  fs.writeFileSync(path.join(root, ADOPT_FILE), JSON.stringify({ ...a, done: new Date().toISOString() }));
  return file;
}

/** Why the app's tree was not taken (POST <bridge>/adopt refused): noted for the research in the terminal, which stops waiting. */
export function noteAdoptFailed(root: string, why: "empty" | "other"): void {
  const dir = path.join(root, SYNC_INBOX);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `adopt-failed-${Date.now()}.json`), JSON.stringify({ why, at: new Date().toISOString() }));
}

/** The app's tree was refused since `since` (ms): why. */
export function adoptFailedSince(root: string, since: number): "empty" | "other" | undefined {
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
    return (JSON.parse(fs.readFileSync(last, "utf8")) as { why: "empty" | "other" }).why;
  } catch {
    return "other";
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
 * Our IDs with another person's name are not matched (another research's IDs, a file edited by hand).
 */
export function checkIdentity(tree: Tree, incoming: Snapshot, force = false): Identity {
  if (incoming.treeId && incoming.treeId !== tree.config.id)
    throw new UsageError(`this file is of another research (${incoming.treeId}), not of "${tree.config.name}"`, { hint: "open that research, or add the file as leads: strom intake <file>" });
  const strangers: string[] = [];
  let matched = 0;
  for (const [key, p] of incoming.persons) {
    if (key.startsWith("x:")) continue;
    const ours = resolve(tree, key);
    const alike = ours && ours.names.some((n) => p.names.some((m) => sharesWord(`${n.given} ${n.surname}`, m)));
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
  if (!force && !incoming.treeId && matched < Math.max(1, incoming.persons.size / 2))
    throw new UsageError(
      `this does not look like the family tree of "${tree.config.name}": ${matched} of its ${incoming.persons.size} people are the research's`,
      { hint: "another family tree goes in as leads: strom intake <file> — it is yours after all: strom sync <file> --force" },
    );
  return { matched, strangers };
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
  | "sex.changed"
  | "note.new"
  | "family.new"
  | "child.new"
  | "child.gone"
  | "person.gone"
  | "place.coords";

/** What strom does with a change: adds it, corrects a lead, a conflict, the user's edit wins, the place's position set, only when picked, nothing. */
export type ChangeAction = "add" | "correct" | "conflict" | "user" | "set" | "pick" | "report";

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
  text?: string;
}

export interface Plan {
  changes: Change[];
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
export function planSync(tree: Tree, incoming: Snapshot, edits: "conflict" | "user", opts: { force?: boolean } = {}): Plan {
  const identity = checkIdentity(tree, incoming, opts.force);
  const ours = snapshotOfTree(tree);
  knownNewcomers(incoming, ours);
  const base = incoming.head ? snapshotAt(tree, incoming.head) : undefined;
  const partial = !!base && incoming.persons.size < base.persons.size / 2;
  const changes: Change[] = [];
  const push = (c: Omit<Change, "n">) => changes.push({ ...c, n: changes.length + 1 });
  // the kinds of facts the file carries at all, of people and of families apart: one it never has is not "gone" (the
  // app does not keep it — the Strom app keeps a family's other events in the couple's note, though its people have them)
  const carried = new Set([...incoming.persons.values()].flatMap((p) => p.facts.map((f) => kindOf(f.kind))));
  const carriedFam = new Set(incoming.families.flatMap((f) => f.facts.map((x) => kindOf(x.kind))));

  const factsDiff = (owner: { person?: string; family?: string; partners?: string[]; name?: string }, inc: SFact[], our: SFact[], was: SFact[] | undefined, isOurs: boolean) => {
    const ourKeys = new Set(our.map(factKey));
    const baseKeys = new Set((was ?? []).map(factKey));
    const incKeys = new Set(inc.map(factKey));
    const used = new Set<string>();
    for (const f of inc) {
      const k = factKey(f);
      if (ourKeys.has(k)) {
        // the research has it: what the file says of it besides (its cause, age, house) may be the user's — paired
        // with the same details first (one lived in several houses of a place: each its own fact)
        const sameDetails = (a: SFact, b: SFact) => DETAILS.every((d) => !a[d] || exact(a[d]) === exact(b[d]));
        const mates = our.filter((x) => factKey(x) === k);
        if (mates.some((x) => sameDetails(f, x)) || was?.some((x) => factKey(x) === k && sameDetails(f, x))) continue;
        const o = mates.find((x) => !inc.some((i) => factKey(i) === k && sameDetails(i, x))) ?? mates[0]!;
        const b = was?.find((x) => factKey(x) === k && (!x.id || x.id === o.id));
        const changed = DETAILS.filter((d) => f[d] && exact(f[d]) !== exact(o[d]) && !(b && exact(f[d]) === exact(b[d])));
        if (changed.length) {
          const added = changed.every((d) => !o[d]);
          const action = added ? "add" : !was ? "pick" : recordBacked(tree, eventById(tree, o.id)) ? "conflict" : "correct";
          if (action !== "conflict" || !openConflict(tree, owner.person ?? owner.family, f)) push({ kind: "fact.detail", action, ...owner, fact: f, was: o });
        }
        continue;
      }
      if (our.some((o) => knowsMore(o, f))) continue; // the file knows less of it (the date lost on the way)
      if (was && baseKeys.has(k)) continue; // as it was given: the research changed it since
      const kind = kindOf(f.kind);
      // an edit of a fact there is one of: what it was
      const before = ONE.has(kind) ? (was ?? our).find((b) => kindOf(b.kind) === kind && !incKeys.has(factKey(b)) && !used.has(factKey(b))) : undefined;
      if (before) used.add(factKey(before));
      const mine = before ? our.find((o) => kindOf(o.kind) === kind && (was ? factKey(o) === factKey(before) : true)) : undefined;
      if (!isOurs || !before) {
        push({ kind: "fact.new", action: "add", ...owner, fact: f });
        continue;
      }
      if (!was) {
        push({ kind: "fact.differs", action: "pick", ...owner, fact: f, ...(mine ? { was: mine } : {}) });
        continue;
      }
      if (!mine) {
        // the research changed or withdrew it since it was given: the user decides
        const now = our.find((o) => kindOf(o.kind) === kind);
        push({ kind: "fact.changed", action: now ? "conflict" : "add", ...owner, fact: f, ...(now ? { was: now } : {}) });
        continue;
      }
      const e = eventById(tree, mine.id);
      const action = recordBacked(tree, e) ? edits : "correct";
      // asked already: the conflict of this very edit is open
      if (action === "conflict" && openConflict(tree, owner.person ?? owner.family, f)) continue;
      push({ kind: "fact.changed", action, ...owner, fact: f, was: mine });
    }
    if (was && !partial)
      for (const b of was)
        if (!incKeys.has(factKey(b)) && !used.has(factKey(b)) && (owner.family ? carriedFam : carried).has(kindOf(b.kind)) && ourKeys.has(factKey(b)) && !keptOnce(owner, b, inc))
          push({ kind: "fact.gone", action: "report", ...owner, was: b });
  };

  // people
  for (const [key, p] of incoming.persons) {
    const name = p.names[0] ?? "?";
    if (key.startsWith("x:")) {
      push({ kind: "person.new", action: "add", person: key, name });
      factsDiff({ person: key, name }, p.facts, [], undefined, false);
      for (const n of p.names.slice(1)) push({ kind: "name.new", action: "add", person: key, name, text: n });
      for (const t of p.notes) push({ kind: "note.new", action: "add", person: key, name, text: t });
      continue;
    }
    const id = resolve(tree, key)!.id;
    const o = ours.persons.get(id);
    const b = base?.persons.get(key);
    if (!o) continue;
    factsDiff({ person: id, name }, p.facts, o.facts, b?.facts, true);
    const ourNames = new Set(o.names.map(nameKey));
    const baseNames = new Set((b?.names ?? []).map(nameKey));
    for (const n of p.names) if (!ourNames.has(nameKey(n)) && !baseNames.has(nameKey(n))) push({ kind: "name.new", action: "add", person: id, name, text: n });
    if (p.sex && o.sex && p.sex !== o.sex && (!b || b.sex !== p.sex)) push({ kind: "sex.changed", action: b ? (edits === "user" ? "user" : "report") : "report", person: id, name, text: p.sex });
    const said = new Set(wordsOf([o.said, b?.said ?? "", ...o.names, ...o.facts.map((f) => [f.place, f.value, f.label].join(" "))].join("\n")));
    // a note coming back holds the research's too (the app joins them): only its lines the research has not
    for (const t of p.notes) {
      const fresh = t.split(/\n+/).filter((line) => line.trim() && !knownNote(line, said));
      if (fresh.length && !knownNote(t, said)) push({ kind: "note.new", action: "add", person: id, name, text: fresh.join("\n") });
    }
  }
  if (base && !partial)
    for (const [key, b] of base.persons)
      if (!incoming.persons.has(key) && ours.persons.has(key)) push({ kind: "person.gone", action: "report", person: key, name: b.names[0] ?? key });

  // families: by their partners; a family of one parent by its children
  const ourFam = new Map(ours.families.map((f) => [famKey(f.partners), f]));
  const baseFam = new Map((base?.families ?? []).map((f) => [famKey(f.partners), f]));
  const ourFamilies = tree.list<Family>("family").filter((f) => !f.retracted);
  const idOf = (key: string) => (key.startsWith("x:") ? key : (resolve(tree, key)?.id ?? key));
  for (const f of incoming.families) {
    const partners = f.partners.map(idOf);
    const k = famKey(partners);
    const o = ourFam.get(k);
    const b = baseFam.get(famKey(f.partners));
    const fam = o ? ourFamilies.find((x) => famKey(x.partners) === k) : undefined;
    if (!o || !fam) {
      if (partners.length || f.children.length) push({ kind: "family.new", action: "add", partners, fact: f.facts[0], text: f.children.map(idOf).join(" ") });
      continue;
    }
    const known = new Set([...o.children, ...(b?.children ?? [])]);
    for (const c of f.children.map(idOf)) if (!known.has(c)) push({ kind: "child.new", action: "add", family: fam.id, partners, child: c });
    factsDiff({ family: fam.id, partners }, f.facts, o.facts, b?.facts, true);
    if (b && !partial) {
      const now = new Set(f.children.map(idOf));
      for (const c of b.children) if (!now.has(c) && o.children.includes(c) && incoming.persons.has(c)) push({ kind: "child.gone", action: "report", family: fam.id, partners, child: c });
    }
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
    const action = !here || (given && samePoint(given, here)) ? "set" : "pick";
    push({ kind: "place.coords", action, place: { ...p, ...(mine ? { id: mine.id } : {}), ...(here ? { was: here } : {}) } });
  }
  return { changes, base: !!base, ...(incoming.head ? { head: incoming.head } : {}), partial, identity };
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

function knowsMore(ours: SFact, file: SFact): boolean {
  if (kindOf(ours.kind) !== kindOf(file.kind)) return false;
  const same = (a: string | undefined, b: string | undefined) => !b || exact(a) === exact(b);
  return same(ours.date, file.date) && same(ours.place, file.place) && same(ours.value, file.value) && (!file.date || !!ours.date) && !(file.kind === "EVEN" && file.label && ours.label && !file.date && !file.place && fold(ours.label) !== fold(file.label));
}

/** An open conflict whose claims hold this value for the person or family already. */
function openConflict(tree: Tree, owner: string | undefined, f: SFact): boolean {
  if (!owner) return false;
  return tree.list<Conflict>("conflict").some((x) => x.state === "open" && x.subject.includes(owner) && x.claims.some((c) => c.value === describe(f)));
}

/**
 * People the file brings without our ID whom the research has already — a sync took them in before the app got
 * them back with their ID: the same name and the same birth, or the same name and the same parents. They are ours.
 */
function knownNewcomers(incoming: Snapshot, ours: Snapshot): void {
  const birth = (p: SPerson) => p.facts.find((f) => kindOf(f.kind) === "BIRT" || kindOf(f.kind) === "BAPM");
  const parents = (snap: Snapshot, key: string) => new Set(snap.families.filter((f) => f.children.includes(key)).flatMap((f) => f.partners));
  for (const [key, p] of [...incoming.persons]) {
    if (!key.startsWith("x:")) continue;
    const names = new Set(p.names.map(nameKey));
    const b = birth(p);
    const theirParents = parents(incoming, key);
    const hit = [...ours.persons.values()].find((o) => {
      if (!o.names.some((n) => names.has(nameKey(n)))) return false;
      const ob = birth(o);
      if (b && ob) return factKey(b) === factKey(ob);
      const op = parents(ours, o.key);
      return theirParents.size > 0 && [...theirParents].every((x) => op.has(x));
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

// ── applying and undoing ─────────────────────────────────────────────────────

/** What one sync wrote, to undo it: kept on its input. */
export interface Applied {
  do: "event.add" | "event.edit" | "event.detail" | "event.retract" | "conflict.add" | "name.add" | "note.add" | "person.add" | "family.add" | "child.add" | "sex.edit" | "place.add" | "place.edit";
  id: string;
  /** event.edit: the fact before; event.detail: its cause, age and house before (JSON); event.retract: its status; sex.edit: the sex before; note.add: the note's time; child.add: the child; place.edit: its position before (JSON). */
  before?: SFact | string;
}

export interface SyncInput extends Input {
  sync?: { head?: string; edits: "conflict" | "user"; applied: Applied[]; undone?: string };
}

/**
 * Write the changes (all but those only reported; with `only`, those numbers — differences only when picked).
 * Returns what was written. The caller holds the tree lock and commits.
 */
export function applySync(tree: Tree, plan: Plan, incoming: Snapshot, source: Source, only?: Set<number>): { applied: Applied[]; changes: number } {
  const applied: Applied[] = [];
  const cite = (locator: string) => ({ source: source.id, locator });
  const reason = `${source.title} (${source.id})`;
  const taken = (c: Change) => (only ? only.has(c.n) : c.action !== "pick") && c.action !== "report";
  const changes = plan.changes.filter(taken).length;
  const ids = new Map<string, string>(); // a new person's key → their ID
  const who = (key: string | undefined) => (key ? (ids.get(key) ?? (key.startsWith("x:") ? undefined : key)) : undefined);
  const fields = (f: SFact) => ({ kind: f.kind, date: f.date, place: f.place, value: f.value, label: f.label, cause: f.cause, age: f.age, house: f.house });

  // new people first: facts and families point at them
  for (const c of plan.changes.filter((x) => x.kind === "person.new" && taken(x))) {
    const p = incoming.persons.get(c.person!)!;
    const primary = p.names[0] && p.names[0].replace(/\//g, "").trim() ? p.names[0] : "? /?/";
    const person = create<Person>(
      tree,
      "person",
      { names: [{ ...nameOf(primary), citations: [cite(`name`)] }], sex: (p.sex as Person["sex"]) ?? "U", events: [], notes: [] } as never,
      (id) => `+${id} person "${primary.replace(/\//g, "").trim()}" (from ${source.id})`,
    );
    ids.set(c.person!, person.id);
    applied.push({ do: "person.add", id: person.id });
  }
  for (const c of plan.changes) {
    if (!taken(c) || c.kind === "person.new") continue;
    const owner = c.family ?? who(c.person);
    switch (c.kind) {
      case "fact.new":
      case "fact.differs":
      case "fact.changed": {
        if (!owner || !c.fact) break;
        const mine = c.was?.id ? eventById(tree, c.was.id) : undefined;
        if (c.kind === "fact.new" || !mine || (c.action === "add" && !mine)) {
          const { event } = addEvent(tree, owner, { ...fields(c.fact), status: "lead", citations: [cite(c.fact.kind)] });
          applied.push({ do: "event.add", id: event.id });
        } else if (c.action === "correct" || (c.kind === "fact.differs" && !recordBacked(tree, mine))) {
          editEvent(tree, mine.id, { date: c.fact.date ?? "", place: c.fact.place ?? "", ...(c.fact.value !== undefined ? { value: c.fact.value } : {}) }, `corrected in ${reason}`);
          update<Person | Family>(tree, owner, owner.startsWith("F") ? "family" : "person", (o) => ({ ...o, events: o.events.map((e) => (e.id === mine.id && !e.citations.some((x) => x.source === source.id) ? { ...e, citations: [...e.citations, cite(c.fact!.kind)] } : e)) }), {
            op: "event.cite",
            summary: `${mine.id} cites ${source.id}`,
          });
          applied.push({ do: "event.edit", id: mine.id, before: { kind: mine.kind, ...(mine.date ? { date: mine.date } : {}), ...(mine.place ? { place: mine.place } : {}), ...(mine.value ? { value: mine.value } : {}) } });
        } else if (c.action === "user") {
          retractEvent(tree, mine.id, `the user's edit wins: ${reason}`);
          applied.push({ do: "event.retract", id: mine.id, before: mine.status });
          // the user's word: no record makes it probable
          const { event } = addEvent(tree, owner, { ...fields(c.fact), status: "possible", citations: [cite(c.fact.kind)] });
          applied.push({ do: "event.add", id: event.id });
        } else {
          const title = `${(c.name ?? owner).replace(/\//g, "").replace(/\s+/g, " ").trim()}: ${c.fact.kind} — ${describe(mine)} × ${describe(c.fact)}`;
          const x = create<Conflict>(
            tree,
            "conflict",
            {
              title: title.slice(0, 200),
              fact: c.fact.kind,
              subject: [owner],
              claims: [
                { ...(mine.citations[0] ? { source: mine.citations[0].source } : {}), value: describe(mine), note: `the research: ${mine.id}` },
                { source: source.id, value: describe(c.fact), note: "the user's edit" },
              ],
              state: "open",
            } as never,
            (id) => `+${id} conflict "${title.slice(0, 60)}"`,
            [owner],
          );
          applied.push({ do: "conflict.add", id: x.id });
        }
        break;
      }
      case "fact.detail": {
        const mine = c.was?.id ? eventById(tree, c.was.id) : undefined;
        if (!owner || !c.fact || !mine) break;
        // picked without the state it was given: a record's fact is not overwritten
        if (c.action === "conflict" || (c.action === "pick" && recordBacked(tree, mine))) {
          const title = `${(c.name ?? owner).replace(/\//g, "").replace(/\s+/g, " ").trim()}: ${c.fact.kind} — ${describe(mine)} × ${describe(c.fact)}`;
          const x = create<Conflict>(
            tree,
            "conflict",
            {
              title: title.slice(0, 200),
              fact: c.fact.kind,
              subject: [owner],
              claims: [
                { ...(mine.citations[0] ? { source: mine.citations[0].source } : {}), value: describe(mine), note: `the research: ${mine.id}` },
                { source: source.id, value: describe(c.fact), note: "the user's edit" },
              ],
              state: "open",
            } as never,
            (id) => `+${id} conflict "${title.slice(0, 60)}"`,
            [owner],
          );
          applied.push({ do: "conflict.add", id: x.id });
          break;
        }
        const set = Object.fromEntries(DETAILS.filter((d) => c.fact![d] && c.fact![d] !== mine[d]).map((d) => [d, c.fact![d]!]));
        editEvent(tree, mine.id, set, `${c.action === "add" ? "added from" : "corrected in"} ${reason}`);
        update<Person | Family>(tree, owner, owner.startsWith("F") ? "family" : "person", (o) => ({ ...o, events: o.events.map((e) => (e.id === mine.id && !e.citations.some((x) => x.source === source.id) ? { ...e, citations: [...e.citations, cite(`${c.fact!.kind} ${Object.keys(set).join(" ")}`)] } : e)) }), {
          op: "event.cite",
          summary: `${mine.id} cites ${source.id}`,
        });
        applied.push({ do: "event.detail", id: mine.id, before: JSON.stringify(Object.fromEntries(DETAILS.map((d) => [d, mine[d] ?? ""]))) });
        break;
      }
      case "name.new": {
        if (!owner || !c.text) break;
        const { name } = addName(tree, owner, { name: c.text, citation: cite("name") });
        applied.push({ do: "name.add", id: owner, before: exact(`${name.given}|${name.surname}`) });
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
        editPerson(tree, owner, { sex: c.text }, `the user's edit: ${reason}`);
        applied.push({ do: "sex.edit", id: owner, before: p.sex });
        break;
      }
      case "family.new": {
        const partners = (c.partners ?? []).map(who).filter((x): x is string => !!x);
        const kids = (c.text ?? "").split(" ").filter(Boolean).map(who).filter((x): x is string => !!x);
        if (!partners.length && !kids.length) break;
        const f = addFamily(tree, { partners, children: kids, citation: cite("family"), ...(c.fact?.date ? { married: c.fact.date } : {}), ...(c.fact?.place ? { marriedPlace: c.fact.place } : {}), ...(c.fact ? { status: "lead" } : {}) });
        applied.push({ do: "family.add", id: f.id });
        break;
      }
      case "child.new": {
        const child = who(c.child);
        if (!c.family || !child) break;
        addChild(tree, c.family, child, undefined, cite("child"));
        applied.push({ do: "child.add", id: c.family, before: child });
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
  }
  return { applied, changes };
}

function nameOf(gedName: string): { given: string; surname: string } {
  const m = /^(.*?)\/(.*?)\/(.*)$/.exec(gedName);
  if (!m) return { given: gedName.trim(), surname: "" };
  return { given: `${m[1]!.trim()} ${m[3]!.trim()}`.trim(), surname: m[2]!.trim() };
}

function describe(f: { date?: string | undefined; place?: string | undefined; value?: string | undefined; cause?: string | undefined; age?: string | undefined; house?: string | undefined }): string {
  return [f.value, f.date, f.place, f.house && `house ${f.house}`, f.age && `aged ${f.age}`, f.cause && `cause ${f.cause}`].filter(Boolean).join(", ") || "—";
}

/** Undo one sync: what it added withdrawn, what it corrected put back, its conflicts closed — each with the reason. */
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
        const before = JSON.parse(String(a.before ?? "{}")) as Record<(typeof DETAILS)[number], string>;
        const edit = Object.fromEntries(DETAILS.filter((d) => (before[d] ?? "") !== (e?.[d] ?? "")).map((d) => [d, before[d] ?? ""]));
        if (e && Object.keys(edit).length) editEvent(tree, a.id, edit, reason);
        break;
      }
      case "event.retract":
        restoreEvent(tree, a.id, String(a.before ?? "lead"), reason);
        break;
      case "conflict.add":
        update<Conflict>(tree, a.id, "conflict", (x) => ({ ...x, state: "resolved", resolution: reason }), { op: "conflict.resolve", summary: `${a.id} resolved: ${reason}` });
        break;
      case "name.add":
        update<Person>(
          tree,
          a.id,
          "person",
          (p) => {
            // the name it added: the last of that spelling
            const at = p.names.map((m) => exact(`${m.given}|${m.surname}`)).lastIndexOf(String(a.before));
            return at > 0 ? { ...p, names: p.names.filter((_, i) => i !== at) } : p;
          },
          { op: "name.remove", summary: `${a.id} name removed: ${reason}` },
        );
        break;
      case "note.add":
        update<Person | Family>(tree, a.id, a.id.startsWith("F") ? "family" : "person", (o) => ({ ...o, notes: o.notes.filter((x) => x.at !== a.before) }), { op: "note.remove", summary: `${a.id} note removed: ${reason}` });
        break;
      case "sex.edit":
        editPerson(tree, a.id, { sex: String(a.before ?? "U") }, reason);
        break;
      case "child.add":
        update<Family>(tree, a.id, "family", (f) => ({ ...f, children: f.children.filter((c) => c.person !== a.before) }), { op: "family.edit", summary: `${a.id} child ${String(a.before)} removed: ${reason}` });
        break;
      case "family.add":
        update<Family>(tree, a.id, "family", (f) => ({ ...f, retracted: { at: now(), reason } }), { op: "family.retract", summary: `${a.id} retracted: ${reason}` });
        break;
      case "person.add":
        if (!tree.get<Person>(a.id)?.retracted) retractPerson(tree, a.id, reason);
        break;
      case "place.edit": {
        const b = JSON.parse(String(a.before ?? "{}")) as Pick<Place, "coords" | "unlocated">;
        update<Place>(tree, a.id, "place", ({ coords: _now, unlocated: _u, ...p }) => ({ ...p, ...(b.coords ? { coords: b.coords } : {}), ...(b.unlocated ? { unlocated: b.unlocated } : {}) }), {
          op: "place.edit",
          summary: `${a.id} position back: ${reason}`,
        });
        break;
      }
      case "place.add":
        update<Place>(tree, a.id, "place", (p) => ({ ...p, retracted: { at: now(), reason } }), { op: "place.retract", summary: `${a.id} retracted: ${reason}` });
        break;
    }
    n++;
  }
  return n;
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
