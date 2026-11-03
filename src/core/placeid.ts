// Identifying the places of the facts (spec 034): which of the villages of one name a place of the facts is, where it
// lies, what it was called and whose it was — written into the research's place record with who determined it, why and
// from what. The person queues places (one, several, all off the map; or the coordinates to be checked), the research
// works through the queue in sessions of one area at a time (task places:identify), from the cheap steps up: what the
// tree and the other researches on this computer know, the rules of how places are written, then reference works. Sure:
// written as the research's (one operation, undone like any). Probable: a question for the person (What waits). Not
// determined: the one state "not located" of the place record, with what would decide it — back in the queue by itself
// once something new is known of the place. The person's hand wins: coordinates the person gave are never changed by the
// research, it only asks when its records say otherwise.
//
// What is kept: the place records (data/places, with `locating`), the queue and the last step to undo in
// quality/places.json (sealed, written whole). Nothing here raises SCHEMA_VERSION: only optional fields.

import { UsageError } from "./errors.ts";
import type { Event, Family, Jurisdiction, Person, Place, PlaceBy, PlaceCandidate, PlaceLocating, PlaceName, PlaceNameKind, PlaceQuestion, Session, Source, Task } from "./model.ts";
import { JURISDICTIONS } from "./model.ts";
import { readJsonIfExists, stringifyCanonical } from "./json.ts";
import { splitStreet } from "./streets.ts";
import { foldText } from "./text.ts";
import { actsAsArchive } from "./state.ts";
import { readPlaces } from "./pastevents.ts";
import { phrase } from "./phrases.ts";
import { now, type Tree } from "./tree.ts";
import path from "node:path";
import fs from "node:fs";
import { opsLogsOf } from "./opslog.ts";

export const PLACES_IDENTIFY_ORIGIN = "places:identify";
export const PLACE_QUEUE_FILE = "quality/places.json";
/** At most so many places in one session (one area). */
export const BATCH_MAX = 15;
/** At most so many places in one request of the app. */
export const REQUEST_MAX = 5000;
/** A session of identification, before three were measured: minutes. */
export const BATCH_MINUTES: [number, number] = [8, 15];
const MEASURED_MIN = 3;
/** The marks of the app's own check (K6.1) a place may be queued with: taken first, shown to the agent as data. */
export const PLACE_FLAGS = ["far", "district", "label", "choices"] as const;
export type PlaceFlag = (typeof PLACE_FLAGS)[number];
export const PLACE_STATES = ["queued", "running", "proposed", "unlocated", "identified", "conflict"] as const;
export type PlaceState = (typeof PLACE_STATES)[number];

/** One place of the facts waiting in the queue. */
export interface QueueEntry {
  /** The place as the facts write it. */
  form: string;
  at: string;
  /** The coordinates to be checked (K6.6), not looked for. */
  check?: boolean;
  /** What the app's check noticed (K6.1). */
  flag?: PlaceFlag;
  /** Who queued it: the person (the app, a link, the terminal), or the research itself (K2.3: something new of it). */
  by: "person" | "research";
  /** Put back by the person's undo of the queue's tidying: never taken out by it again. */
  back?: true;
}

/** A fact's place set right (K3), as it was and as it is made. */
export interface FormChange {
  owner: string;
  event: string;
  before: { place: string; house?: string };
  after: { place: string; house?: string };
}

/** The last step of the person's on places, to be undone: the place records as they were, the facts' places as they were. */
export interface PlacesUndo {
  id: string;
  at: string;
  /** Each place record before the step (null: made by it) and its `updated` after. */
  places: Record<string, { before: Place | null; after: string }>;
  facts?: FormChange[];
  /** Queue entries the step took out (settleQueue): put back. */
  queue?: Record<string, QueueEntry>;
}

export interface PlacesFile {
  queue: Record<string, QueueEntry>;
  /** The newest step on places to be undone. */
  undo?: PlacesUndo;
  /** The steps before it still to be undone, oldest first (UNDO_KEPT in all): each one undone by its own ID. */
  undos?: PlacesUndo[];
  /** When the places not located in history/places.json were taken into the place records (once). */
  converted?: string;
  /** The repairs of the place records done (repairPlaces, PLACES_REPAIR). */
  repaired?: number;
}

export function readPlacesFile(tree: Tree): PlacesFile {
  try {
    const f = readJsonIfExists<Partial<PlacesFile>>(path.join(tree.root, ...PLACE_QUEUE_FILE.split("/")));
    const queue: Record<string, QueueEntry> = {};
    for (const [k, v] of Object.entries(f?.queue ?? {})) if (v && typeof v.form === "string" && v.form.trim()) queue[k] = v;
    const undos = Array.isArray(f?.undos) ? f.undos.filter((u) => u && typeof u.id === "string") : [];
    return { queue, ...(f?.undo ? { undo: f.undo } : {}), ...(undos.length ? { undos } : {}), ...(f?.converted ? { converted: f.converted } : {}), ...(typeof f?.repaired === "number" ? { repaired: f.repaired } : {}) };
  } catch {
    return { queue: {} };
  }
}

/** How many steps on places can be undone, each by its own ID (the oldest go first). */
export const UNDO_KEPT = 20;

/** A step to be undone kept: the newest; the one before it waits among the others, never lost to it. */
function keepUndo(file: PlacesFile, u: PlacesUndo): string {
  if (file.undo) file.undos = [...(file.undos ?? []), file.undo].slice(-(UNDO_KEPT - 1));
  file.undo = u;
  return u.id;
}

/** A new step's undo ID: never one waiting already (two steps in one millisecond). */
function undoId(file: PlacesFile): string {
  const taken = new Set([file.undo?.id, ...(file.undos ?? []).map((u) => u.id)]);
  let t = Date.now();
  while (taken.has(`u${t.toString(36)}`)) t++;
  return `u${t.toString(36)}`;
}

function fileContent(f: PlacesFile): string {
  return stringifyCanonical(f);
}

/** Records and the file written as one sealed operation (inside the tree's lock). */
function write(tree: Tree, records: (Place | Person | Family)[], file: PlacesFile | undefined, op: { op: string; targets: string[]; summary: string; reason?: string }): void {
  tree.putMany(records, file ? [{ rel: PLACE_QUEUE_FILE, content: fileContent(file) }] : [], op);
}

// ── the places of the facts ─────────────────────────────────────────────────────────────────────────────────────

/** A place as the facts write it: how many facts, whose, which years, the archives of their sources. */
export interface FactForm {
  form: string;
  key: string;
  facts: number;
  persons: Set<string>;
  years: number[];
  /** The archive (or record set) of the sources cited, how many times: the area its session goes with. */
  areas: Map<string, number>;
  /** The facts: owner and event. */
  events: { owner: Person | Family; event: Event }[];
}

const liveOwners = (tree: Tree): (Person | Family)[] =>
  [...tree.list<Person>("person"), ...tree.list<Family>("family")].filter((o) => !o.retracted && !(o as Person).mergedInto);

function yearOf(date: string | undefined): number | undefined {
  const m = date ? /(\d{3,4})(?!.*\d{3,4})/u.exec(date) : null;
  return m ? Number(m[1]) : undefined;
}

/** Every place of the tree's facts, by its folded text. */
export function factForms(tree: Tree): Map<string, FactForm> {
  const sources = new Map(tree.list<Source>("source").map((s) => [s.id, s]));
  const out = new Map<string, FactForm>();
  for (const o of liveOwners(tree)) {
    const who = o.type === "person" ? [o.id] : (o as Family).partners;
    for (const e of o.events) {
      if (e.retracted || e.status === "retracted" || !e.place?.trim()) continue;
      const form = e.place.normalize("NFC").trim();
      const key = foldText(form);
      let f = out.get(key);
      if (!f) out.set(key, (f = { form, key, facts: 0, persons: new Set(), years: [], areas: new Map(), events: [] }));
      f.facts++;
      for (const p of who) f.persons.add(p);
      const y = yearOf(e.date);
      if (y !== undefined) f.years.push(y);
      for (const c of e.citations ?? []) {
        const s = sources.get(c.source);
        const area = s?.repository ?? s?.recordset;
        if (area) f.areas.set(area, (f.areas.get(area) ?? 0) + 1);
      }
      f.events.push({ owner: o, event: e });
    }
  }
  return out;
}

/**
 * The research's place record of a place of the facts: the one record that bears its name (any of its names, any
 * accent), else the one bearing its municipality (a place with a street or a number), else its first part ("Lhota,
 * okres Horní"); none when two do — a place two records could be belongs to none until its writing is set right.
 */
export function recordIndex(tree: Tree): (form: string) => Place | undefined {
  return recordIndexOf(tree.list<Place>("place"));
}

/** recordIndex over the given records (the records as a step leaves them). */
function recordIndexOf(places: Place[]): (form: string) => Place | undefined {
  const byName = new Map<string, Place[]>();
  for (const p of places) {
    if (p.retracted) continue;
    for (const k of new Set(p.names.map((n) => foldText(n.name)))) byName.set(k, [...(byName.get(k) ?? []), p]);
  }
  return (form) => {
    const tries = [form, splitStreet(form)?.town, form.split(",")[0]!.trim()].filter((x): x is string => !!x);
    for (const t of tries) {
      const found = byName.get(foldText(t));
      if (found?.length === 1) return found[0];
      if (found && found.length > 1) return undefined;
    }
    return undefined;
  };
}

/** The ID of a place record, normalized ("l12" → "L0012"), or undefined when it is not one. */
export function placeIdOf(ref: string): string | undefined {
  const m = /^[Ll](\d+)$/u.exec(ref.trim());
  return m ? `L${m[1]!.padStart(4, "0")}` : undefined;
}

/** Where a place is now, for the person and the app. */
export function placeState(p: Place | undefined, entry: QueueEntry | undefined, running: boolean): PlaceState | undefined {
  if (running) return "running";
  if (entry) return "queued";
  const q = p?.locating?.question;
  if (q) return q.kind === "conflict" ? "conflict" : "proposed";
  if (p?.coords) return "identified";
  if (p?.unlocated) return "unlocated";
  return undefined;
}

// ── the queue ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The queue in its order: what the app's check marked first, then as it was asked. */
export function queueOrder(file: PlacesFile): [string, QueueEntry][] {
  return Object.entries(file.queue).sort(([, a], [, b]) => Number(!!b.flag) - Number(!!a.flag) || a.at.localeCompare(b.at) || a.form.localeCompare(b.form));
}

/** The area a place of the facts belongs to: the archive most of its sources are from, else none. */
function areaOf(f: FactForm | undefined): string {
  if (!f || !f.areas.size) return "other";
  return [...f.areas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
}

/**
 * The queue cut into sessions: the places of one area together, at most BATCH_MAX in each, in the queue's order — the
 * small areas packed into one session as long as it has room (a session's start is the same price for one place as
 * for fifteen; 1.25 ran most sessions on one or two places), an area never split where it fits whole.
 */
export function queueBatches(tree: Tree, file: PlacesFile = readPlacesFile(tree), forms: Map<string, FactForm> = factForms(tree)): [string, QueueEntry][][] {
  const byArea = new Map<string, [string, QueueEntry][]>();
  for (const row of queueOrder(file)) {
    const area = areaOf(forms.get(row[0]));
    byArea.set(area, [...(byArea.get(area) ?? []), row]);
  }
  const out: [string, QueueEntry][][] = [];
  let open: [string, QueueEntry][] = [];
  for (const rows of byArea.values()) {
    let i = 0;
    for (; i + BATCH_MAX <= rows.length; i += BATCH_MAX) out.push(rows.slice(i, i + BATCH_MAX));
    if (i < rows.length) open = pack(out, open, rows.slice(i));
  }
  if (open.length) out.push(open);
  return out;
}

/** An area's places into the open session when they fit, else the open one closed and a new one begun with them. */
function pack(out: [string, QueueEntry][][], open: [string, QueueEntry][], rows: [string, QueueEntry][]): [string, QueueEntry][] {
  if (open.length + rows.length <= BATCH_MAX) return [...open, ...rows];
  if (open.length) out.push(open);
  return [...rows];
}

/** Places in the queue the person asked for (the app, a link, the terminal): their task comes first (core/queue.ts). */
export function personQueued(tree: Tree): boolean {
  return Object.values(readPlacesFile(tree).queue).some((e) => e.by === "person");
}

/** The task of identification first in the research's queue: strom's priority, places the person asked for queued. */
export function placesFirst(t: Pick<Task, "origin" | "priority">, asked: () => boolean): boolean {
  return t.origin === PLACES_IDENTIFY_ORIGIN && t.priority >= 5 && asked();
}

/** A session on the task of identification open now. */
export function identifyingNow(tree: Tree): boolean {
  const tasks = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  return tree.list<Session>("session").some((s) => s.state === "open" && !!s.task && tasks.get(s.task)?.origin === PLACES_IDENTIFY_ORIGIN);
}

/** What one session of identification takes, and the whole queue: minutes; the price only from three sessions measured. */
export function identifyEstimate(tree: Tree, batches: number): { session: { minutes: [number, number]; usd?: [number, number] }; queue?: { minutes: [number, number]; usd?: [number, number] } } {
  const tasks = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  const costs = tree
    .list<Session>("session")
    .filter((s) => s.state !== "open" && !s.metrics?.costPartial && (s.metrics?.costUsd ?? 0) > 0 && !!s.task && tasks.get(s.task)?.origin === PLACES_IDENTIFY_ORIGIN)
    .map((s) => s.metrics!.costUsd! + (s.metrics!.readersUsd ?? 0))
    .sort((a, b) => a - b);
  const q = (f: number) => costs[Math.min(costs.length - 1, Math.max(0, Math.round((costs.length - 1) * f)))]!;
  const round = (x: number) => Math.max(0.1, Math.round(x * 10) / 10);
  const usd: [number, number] | undefined = costs.length >= MEASURED_MIN ? [round(q(0.25)), round(Math.max(q(0.75), q(0.25)))] : undefined;
  const session = { minutes: BATCH_MINUTES, ...(usd ? { usd } : {}) };
  if (batches < 1) return { session };
  const times = (r: [number, number]): [number, number] => [Math.round(r[0] * batches * 10) / 10, Math.round(r[1] * batches * 10) / 10];
  return { session, queue: { minutes: times(BATCH_MINUTES), ...(usd ? { usd: times(usd) } : {}) } };
}

export type QueueSkip = "manual" | "identified" | "queued" | "running" | "unknown" | "unlocated";

/** What the person asks to be queued or taken out. */
export interface QueueRequest {
  forms?: string[];
  places?: string[];
  all?: "offmap" | "placed" | "queued";
  check?: boolean;
  flags?: Record<string, PlaceFlag>;
}

/** The places of the facts by their record: which forms belong to a record. */
function formsOfRecords(forms: Map<string, FactForm>, recordOf: (form: string) => Place | undefined): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [key, f] of forms) {
    const p = recordOf(f.form);
    if (p) out.set(p.id, [...(out.get(p.id) ?? []), key]);
  }
  return out;
}

/** The places of the facts off the map (no coordinates in their record), not in the queue nor not located. */
export function offMapForms(tree: Tree, file: PlacesFile = readPlacesFile(tree)): FactForm[] {
  const recordOf = recordIndex(tree);
  return [...factForms(tree).values()].filter((f) => {
    const p = recordOf(f.form);
    return !p?.coords && !p?.unlocated && !p?.locating?.question && !file.queue[f.key];
  });
}

/** The places of the facts on the map (their record has coordinates), not in the queue. */
export function placedForms(tree: Tree, file: PlacesFile = readPlacesFile(tree)): FactForm[] {
  const recordOf = recordIndex(tree);
  const seen = new Set<string>();
  return [...factForms(tree).values()].filter((f) => {
    const p = recordOf(f.form);
    if (!p?.coords || file.queue[f.key] || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/**
 * Places queued (the person's word: the app, a link, the terminal) — nothing written of the places themselves, nothing
 * spent. A place the person put on the map is looked for again only to be checked; one identified already is checked,
 * never looked for again. Inside the tree's lock.
 */
export function queuePlaces(tree: Tree, req: QueueRequest, by: QueueEntry["by"] = "person"): { queued: string[]; skipped: { form: string; why: QueueSkip }[] } {
  return tree.withTreeLock(() => {
    const file = readPlacesFile(tree);
    const forms = factForms(tree);
    const recordOf = recordIndex(tree);
    const ofRecord = formsOfRecords(forms, recordOf);
    const running = identifyingNow(tree) ? new Set((queueBatches(tree, file, forms)[0] ?? []).map(([k]) => k)) : new Set<string>();
    const wanted: { form: string; key?: string; place?: Place }[] = [];
    for (const f of req.forms ?? []) {
      const form = f.normalize("NFC").trim();
      if (!form) continue;
      const key = foldText(form);
      wanted.push({ form: forms.get(key)?.form ?? form, key: forms.has(key) ? key : undefined, place: recordOf(form) });
    }
    for (const ref of req.places ?? []) {
      const id = placeIdOf(ref);
      const p = id ? tree.get<Place>(id) : undefined;
      if (!p || p.type !== "place" || p.retracted) {
        wanted.push({ form: ref });
        continue;
      }
      const keys = ofRecord.get(p.id) ?? [];
      // a record no fact names yet: queued by its own name
      if (!keys.length) wanted.push({ form: p.names[0]!.name, key: foldText(p.names[0]!.name), place: p });
      for (const k of keys.slice(0, 1)) wanted.push({ form: forms.get(k)!.form, key: k, place: p });
    }
    if (req.all === "offmap") for (const f of offMapForms(tree, file)) wanted.push({ form: f.form, key: f.key, place: recordOf(f.form) });
    if (req.all === "placed") for (const f of placedForms(tree, file)) wanted.push({ form: f.form, key: f.key, place: recordOf(f.form) });
    const queued: string[] = [];
    const skipped: { form: string; why: QueueSkip }[] = [];
    const at = now();
    const seen = new Set<string>();
    for (const w of wanted) {
      if (!w.key) {
        skipped.push({ form: w.form, why: "unknown" });
        continue;
      }
      // one place once: its record's other forms are the same place
      const one = w.place ? `record:${w.place.id}` : w.key;
      if (seen.has(one)) continue;
      seen.add(one);
      const others = w.place ? (ofRecord.get(w.place.id) ?? []) : [w.key];
      if ([w.key, ...others].some((k) => running.has(k))) {
        skipped.push({ form: w.form, why: "running" });
        continue;
      }
      const had = [w.key, ...others].find((k) => file.queue[k]);
      if (had) {
        const e = file.queue[had]!;
        // queued to be looked for, and on the map since: the check asked now takes its place (the tidying would take
        // the old entry out as identified, and the person's check with it)
        if (req.check && w.place?.coords && !e.check) {
          const { back: _b, ...rest } = e;
          file.queue[had] = { ...rest, at, by, check: true };
          queued.push(e.form);
          continue;
        }
        skipped.push({ form: w.form, why: "queued" });
        continue;
      }
      if (!req.check && w.place?.coords) {
        skipped.push({ form: w.form, why: w.place.locating?.by === "person" ? "manual" : "identified" });
        continue;
      }
      const flag = req.flags?.[w.form] ?? req.flags?.[w.key];
      file.queue[w.key] = { form: w.form, at, by, ...(req.check && w.place?.coords ? { check: true } : {}), ...(flag && (PLACE_FLAGS as readonly string[]).includes(flag) ? { flag } : {}) };
      queued.push(w.form);
    }
    if (queued.length)
      write(tree, [], file, {
        op: "place.queue",
        targets: [],
        summary: `${queued.length === 1 ? `place "${queued[0]}"` : `${queued.length} places`} ${req.check ? "to be checked" : "to be identified"}${by === "research" ? " (something new of it)" : ""}`,
      });
    return { queued, skipped };
  });
}

/** Places taken out of the queue (the person's word). Inside the tree's lock. */
export function cancelPlaces(tree: Tree, req: QueueRequest): { cancelled: string[]; skipped: { form: string; why: QueueSkip }[] } {
  return tree.withTreeLock(() => {
    const file = readPlacesFile(tree);
    const forms = factForms(tree);
    const ofRecord = formsOfRecords(forms, recordIndex(tree));
    const running = identifyingNow(tree) ? new Set((queueBatches(tree, file, forms)[0] ?? []).map(([k]) => k)) : new Set<string>();
    const keys = new Set<string>();
    for (const f of req.forms ?? []) keys.add(foldText(f.normalize("NFC").trim()));
    for (const ref of req.places ?? []) for (const k of ofRecord.get(placeIdOf(ref) ?? "") ?? []) keys.add(k);
    if (req.all === "queued") for (const k of Object.keys(file.queue)) keys.add(k);
    const cancelled: string[] = [];
    const skipped: { form: string; why: QueueSkip }[] = [];
    for (const k of keys) {
      const e = file.queue[k];
      if (!e) continue;
      if (running.has(k)) {
        skipped.push({ form: e.form, why: "running" });
        continue;
      }
      delete file.queue[k];
      cancelled.push(e.form);
    }
    if (cancelled.length) write(tree, [], file, { op: "place.unqueue", targets: [], summary: `${cancelled.length === 1 ? `place "${cancelled[0]}"` : `${cancelled.length} places`} taken out of the queue` });
    return { cancelled, skipped };
  });
}

// ── what the research writes ────────────────────────────────────────────────────────────────────────────────────

/** A place to write to: its record, or a new one of the form (not written yet), and every form of the facts that is it. */
interface Target {
  place: Place;
  made: boolean;
  /** The folded forms of the facts that are this place. */
  keys: string[];
}

/** The record of a place given as an ID or as the facts write it (a new one made of the form when there is none). */
function target(tree: Tree, ref: string, forms: Map<string, FactForm>): Target {
  const id = placeIdOf(ref);
  const recordOf = recordIndex(tree);
  if (id) {
    const p = tree.get<Place>(id);
    if (!p || p.type !== "place" || p.retracted) throw new UsageError(`no place ${id}`, { code: "place.unknown", hint: "strom place list" });
    return { place: structuredClone(p), made: false, keys: formsOfRecords(forms, recordOf).get(p.id) ?? [] };
  }
  const form = ref.normalize("NFC").trim();
  if (!form) throw new UsageError("a place: its ID (L0012) or as the facts write it", { code: "place.unknown" });
  const key = foldText(form);
  const p = recordOf(form);
  if (p) return { place: structuredClone(p), made: false, keys: [...new Set([key, ...(formsOfRecords(forms, recordOf).get(p.id) ?? [])])].filter((k) => forms.has(k)) };
  // two records bear the name: which one is the agent's to say (its ID)
  const many = tree.list<Place>("place").filter((x) => !x.retracted && x.names.some((n) => foldText(n.name) === key));
  if (many.length > 1) throw new UsageError(`"${form}" is the name of ${many.length} place records (${many.map((x) => x.id).join(", ")}): give the ID`, { code: "place.ambiguous" });
  if (!forms.has(key)) throw new UsageError(`no fact of the tree has the place "${form}"`, { code: "place.unknown", hint: "strom place list --off-map" });
  const t = now();
  const made: Place = { id: tree.allocate("L"), type: "place", names: [{ name: forms.get(key)!.form }], jurisdictions: [], notes: [], created: t, updated: t };
  return { place: made, made: true, keys: [key] };
}

/**
 * A name added to a place record when it has none like it (any accent folded alike): a form the facts write (K3.2,
 * K4.5) or another name of the place (another language, a historical name). Each name once: a form that is a name of
 * the record already (the same words, or alike with no language) adds nothing; another name of no language the record
 * has already (with a language or without, today's too) adds nothing; another name given to a form of the facts of the
 * same words, or to another name of no language and no years, takes its place (it says more — the language, the years),
 * and the same name of the same language already there (a form, or of no known kind: written before kinds were kept)
 * becomes it, its years filled in where it had none. Today's name (the first) is never changed.
 */
export function addPlaceName(p: Place, name: string, kind: PlaceNameKind, extra: Omit<PlaceName, "name" | "kind"> = {}): void {
  const n = name.normalize("NFC").trim();
  if (!n) return;
  const key = foldText(n);
  const same = p.names.map((x, i) => ({ x, i })).filter(({ x }) => foldText(x.name) === key);
  if (kind === "form") {
    if (!same.some(({ x }) => x.name === n || !x.lang)) p.names.push({ name: n, kind });
    return;
  }
  const whole: PlaceName = { name: n, ...(extra.lang ? { lang: extra.lang } : {}), ...(extra.from !== undefined ? { from: extra.from } : {}), ...(extra.to !== undefined ? { to: extra.to } : {}), kind };
  // a name of no language the record has already (with a language or without, today's too): it says nothing more
  if (!extra.lang && same.length && !same.some(({ x }) => !x.lang)) return;
  const like = same.find(({ x }) => (x.lang ?? "") === (extra.lang ?? ""));
  // the same name already: what it is and its years filled in, never changed
  if (like) {
    if (like.i > 0) p.names[like.i] = { ...like.x, ...(extra.from !== undefined && like.x.from === undefined ? { from: extra.from } : {}), ...(extra.to !== undefined && like.x.to === undefined ? { to: extra.to } : {}), kind };
    return;
  }
  // a form of the facts of the same words, or another name of no language and no years: the one that says more takes its place
  const form = same.find(({ x, i }) => i > 0 && ((x.kind === "form" && x.name === n) || (x.kind === "alt" && !x.lang && x.from === undefined && x.to === undefined)));
  if (form) p.names[form.i] = whole;
  else p.names.push(whole);
}

/**
 * A place's names after today's, each once: a plain one (a form of the facts, no language or years) that is also
 * written as another name of the place is shown as that name alone — the one that says more.
 */
export function otherNames(p: Place): PlaceName[] {
  const rest = p.names.slice(1);
  const plain = (n: PlaceName) => n.kind !== "alt" && !n.lang && n.from === undefined && n.to === undefined;
  return rest.filter((n) => !plain(n) || !rest.some((m) => m !== n && !plain(m) && foldText(m.name) === foldText(n.name)));
}

function addName(p: Place, name: string): void {
  addPlaceName(p, name, "form");
}

/** "<name>[@<lang>][:<from>-<to>]" — a single year (":1844") is the year the name is known from; undefined: no such syntax. */
const ALT = /^(.+?)(?:@(\p{L}{2,3}))?(?::(\d{3,4})?(?:(-)(\d{3,4})?)?)?$/u;

/**
 * Another name of a place as the agent or the person writes it: "Ober Lhota@de:-1945", "Lhotau@de", "Lhotow:1650-1700",
 * "Lhotow@cs:1844" (one year: known so then). A name still carrying the syntax ("…@xx:…" not understood) is refused.
 */
export function parseAltName(a: string): PlaceName {
  const s = a.normalize("NFC").trim();
  const m = ALT.exec(s);
  const name = m?.[1]?.trim();
  if (!m || !name || /@\p{L}*(?::|$)/u.test(name)) throw new UsageError(`invalid name "${a}": <name>[@<lang>][:<from>-<to>]`, { code: "place.name", hint: 'e.g. "Ober Lhota@de:1850-1918", "Lhotau@de", "Lhotow@cs:1654"' });
  const n: PlaceName = { name };
  if (m[2]) n.lang = m[2].toLowerCase();
  const from = m[3] ? Number(m[3]) : undefined;
  const to = m[5] ? Number(m[5]) : undefined;
  if (from !== undefined) n.from = from;
  if (to !== undefined) n.to = to;
  // one year, no dash: the year the name is known from — from and to alike
  else if (from !== undefined && !m[4]) n.to = from;
  if (n.from !== undefined && n.to !== undefined && n.from > n.to) throw new UsageError(`invalid name "${a}": the years ${n.from}-${n.to} go backwards`, { code: "place.name" });
  return n;
}

/** A name written with the syntax of another name as its text ("Lhotow@cs:1844" kept whole by an older strom): parsed, else undefined. */
export function nameWithSyntax(n: PlaceName): PlaceName | undefined {
  if (!/[@:]/u.test(n.name) || n.lang || n.from !== undefined || n.to !== undefined) return undefined;
  try {
    const p = parseAltName(n.name);
    return p.name !== n.name ? { ...p, ...(n.kind ? { kind: n.kind } : {}) } : undefined;
  } catch {
    return undefined;
  }
}

/** The distance of two points, km. */
export function placeKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Two place records nearer than this are one place until the agent says otherwise (--separate). */
export const NEAR_KM = 1.5;

/** The years of the facts writing any name of a place record. */
function yearsOf(p: Place, forms: Map<string, FactForm>): number[] {
  return [...new Set(p.names.map((n) => foldText(n.name)))].flatMap((k) => forms.get(k)?.years ?? []);
}

/**
 * Today's name of a place, when its first is not it: the one other name in use since a year with no end
 * ("Lhotowo@pl:1945-"), while the first is a name of before — it ended before that year, or the facts write it only
 * before then. Undefined where nothing says so plainly (no such name, or two of them, or the first in use still).
 */
export function todayName(p: Place, years: number[]): PlaceName | undefined {
  const first = p.names[0];
  if (!first || (first.from !== undefined && first.to === undefined)) return undefined;
  const open = p.names.slice(1).filter((n) => n.kind === "alt" && n.from !== undefined && n.to === undefined && foldText(n.name) !== foldText(first.name));
  if (open.length !== 1) return undefined;
  const a = open[0]!;
  if (first.to !== undefined) return first.to <= a.from! ? a : undefined;
  return years.every((y) => y < a.from!) ? a : undefined;
}

/** A name made the first (today's); the one first before kept as what it is (a form of the facts, or another name of the place). */
function setFirst(p: Place, today: PlaceName, forms: Map<string, FactForm>): void {
  const was = p.names[0];
  const rest = p.names
    .filter((n) => n !== today)
    .map((n) => (n === was && !n.kind ? { ...n, kind: forms.has(foldText(n.name)) && !n.lang && n.from === undefined && n.to === undefined ? ("form" as const) : ("alt" as const) } : n))
    .filter((n) => !(foldText(n.name) === foldText(today.name) && !n.lang));
  const { kind: _k, ...first } = today;
  p.names = [first, ...rest];
}

/** What the research writes of a place beside its coordinates (identify, verify): names, kind, parent, jurisdictions. */
export interface PlaceDetails {
  /** Today's name, when the record's first is not it. */
  name?: string;
  /** Other names (another language, a historical name, the facts' variants). */
  alt?: PlaceName[];
  kind?: string;
  parent?: string;
  jurisdictions?: Jurisdiction[];
  /** Jurisdictions found wrong ("parish:Lhotov"): taken off the record, the reason in the operation (--why). */
  drop?: { kind: string; name: string }[];
  /** Other forms of the facts that are the same place (K3.2): their names on the record. */
  forms?: string[];
}

/** "<kind>:<name>" of a jurisdiction to take off. */
export function parseDrop(s: string): { kind: string; name: string } {
  const m = /^([^:]+):(.+?)(?::\d{0,4}-\d{0,4}|:\d{3,4})?$/u.exec(s.normalize("NFC").trim());
  if (!m || !(JURISDICTIONS as readonly string[]).includes(m[1]!.trim())) throw new UsageError(`--drop-jurisdiction "${s}": "<kind>:<name>", kind one of ${JURISDICTIONS.join(", ")}`, { code: "place.jurisdiction" });
  return { kind: m[1]!.trim(), name: m[2]!.trim() };
}

/**
 * The details written into a copy of a place record: today's name (given, or the one other name in use since a year
 * with no end), the other names, the forms of the facts, kind, parent, jurisdictions added and taken off. The folded
 * forms it took in (out of the queue too), what it took off, and today's name when it was made the first by itself.
 */
function applyDetails(tree: Tree, p: Place, t: Target, d: PlaceDetails, forms: Map<string, FactForm>): { more: string[]; dropped: Jurisdiction[]; today?: string } {
  if (d.parent) {
    const parent = tree.get<Place>(d.parent);
    if (!parent || parent.type !== "place" || parent.id === p.id) throw new UsageError(`no place ${d.parent} to be its parent`, { code: "place.unknown" });
    p.parent = parent.id;
  }
  const dropped: Jurisdiction[] = [];
  for (const x of d.drop ?? []) {
    const hit = p.jurisdictions.filter((j) => j.kind === x.kind && foldText(j.name) === foldText(x.name));
    if (!hit.length)
      throw new UsageError(`${p.id} has no ${x.kind} "${x.name}" to take off${p.jurisdictions.length ? ` (it has ${p.jurisdictions.map((j) => `${j.kind}:${j.name}`).join(", ")})` : ""}`, { code: "place.jurisdiction" });
    dropped.push(...hit);
    p.jurisdictions = p.jurisdictions.filter((j) => !hit.includes(j));
  }
  if (d.name) {
    const name = text(d.name, 300, "--name")!;
    setFirst(p, nameWithSyntax({ name }) ?? { name }, forms);
  }
  for (const a of d.alt ?? []) addPlaceName(p, a.name, "alt", a);
  for (const k of t.keys) addName(p, forms.get(k)?.form ?? k);
  const more: string[] = [];
  for (const f of d.forms ?? []) {
    const key = foldText(f.normalize("NFC").trim());
    if (!key) continue;
    addName(p, forms.get(key)?.form ?? f.normalize("NFC").trim());
    more.push(key);
  }
  let today: string | undefined;
  if (!d.name) {
    const a = todayName(p, yearsOf(p, forms));
    if (a) {
      setFirst(p, a, forms);
      today = a.name;
    }
  }
  if (d.kind) p.kind = d.kind;
  for (const j of d.jurisdictions ?? [])
    if (!p.jurisdictions.some((x) => x.kind === j.kind && foldText(x.name) === foldText(j.name) && x.from === j.from && x.to === j.to)) p.jurisdictions.push(j);
  return { more, dropped, today };
}

/**
 * The records nearer than NEAR_KM to coordinates (the record itself, its parent, its parts and those said apart
 * left out): the same place written twice, until the agent says it is another.
 */
function nearRecords(tree: Tree, p: Place, at: { lat: number; lon: number }, separate: ReadonlySet<string>): { place: Place; km: number }[] {
  return tree
    .list<Place>("place")
    .filter((o) => !o.retracted && o.id !== p.id && !!o.coords && !separate.has(o.id) && o.id !== p.parent && o.parent !== p.id)
    .map((o) => ({ place: o, km: placeKm(o.coords!, at) }))
    .filter((x) => x.km <= NEAR_KM)
    .sort((a, b) => a.km - b.km);
}

/** Coordinates checked. */
export function checkCoords(lat: number, lon: number): { lat: number; lon: number } {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    throw new UsageError("coordinates: --lat -90…90 and --lon -180…180, e.g. --lat 49.61 --lon 15.23", { code: "place.coords" });
  return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
}

function text(v: string | undefined, max: number, what: string): string | undefined {
  if (v === undefined) return undefined;
  const t = v.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!t) return undefined;
  if (/[\uD800-\uDFFF�]/u.test(v)) throw new UsageError(`${what}: broken characters (U+FFFD or half of a pair)`, { code: "place.text" });
  if ([...t].length > max) throw new UsageError(`${what} is ${[...t].length} characters — at most ${max}`, { code: "place.text" });
  return t;
}

/**
 * Where a place stands when nobody kept who put it there: coordinates are the person's (personsHand) — a question asked
 * of it never makes them the research's; no coordinates, nothing to keep.
 */
function originUnknown(p: Place): PlaceLocating {
  return p.coords ? { by: "person", at: p.updated } : { by: "research", at: now() };
}

/** Coordinates a person gave, or whose origin nobody knows (before identification was kept): the research never changes them. */
export function personsHand(p: Place): boolean {
  return !!p.coords && (!p.locating || p.locating.by === "person");
}

export interface IdentifyInput extends PlaceDetails {
  lat: number;
  lon: number;
  why: string;
  source?: { title: string; url?: string };
  by?: PlaceBy;
  /** Records nearer than NEAR_KM that are another place (a part, a neighbour): said so by the agent. */
  separate?: string[];
}

/** What a step of identification wrote beside the place: today's name made first by itself, jurisdictions taken off. */
export interface PlaceStep {
  place: Place;
  today?: string;
  dropped: Jurisdiction[];
}

/**
 * A step done on a place takes out of the queue every entry that leads to it now — the forms of its facts, and any
 * form the queue keeps whose writing is a name of the record as the step leaves it (the facts written otherwise since,
 * a rewrite, a merge) — and only those. `keys`: forms the step names itself. `only`: which entries go (all by default).
 */
function unqueue(tree: Tree, file: PlacesFile, changed: Place[], keys: string[], only: (e: QueueEntry, p: Place) => boolean = () => true): void {
  const ids = new Set(changed.filter((p) => !p.retracted).map((p) => p.id));
  const byId = new Set(changed.map((p) => p.id));
  const recordOf = recordIndexOf([...tree.list<Place>("place").filter((p) => !byId.has(p.id)), ...changed]);
  for (const [k, e] of Object.entries(file.queue)) {
    const p = recordOf(e.form);
    if ((keys.includes(k) && only(e, changed[0]!)) || (p && ids.has(p.id) && only(e, p))) delete file.queue[k];
  }
}

/**
 * A queue entry whose place was dealt with after it was queued (identified, checked, asked, not located) — what an
 * earlier strom left in the queue when the facts' form of it was written otherwise before the step. An entry the
 * person put back (`back`) is never taken out so.
 */
export function settledBy(p: Place, e: QueueEntry): boolean {
  if (e.back) return false;
  const l = p.locating;
  const asked = !!l?.question && l.question.at >= e.at;
  // checked after it was queued: the time of the check (an earlier strom kept only the day of a check found right — a
  // later day; the same day, or a check undecided of no time, is not known to come after)
  if (e.check) return !!p.coords && (asked || (l?.checked ? l.checked >= e.at : !!l?.verified && l.verified > e.at.slice(0, 10)));
  // a place on the map is never queued to be looked for (queuePlaces): on the map since, it was identified
  return !!p.coords || asked || (!!p.unlocated && (l?.at ?? "") >= e.at);
}

/**
 * The entries of the queue whose place was dealt with already (settledBy) taken out — nothing else: an entry of no
 * record, of a record two places bear, or of a place still to be done stays. One operation; while the person has no
 * step to undo, `strom place undo` puts them back (and they stay then). Inside the tree's lock; the forms taken out.
 */
export function settleQueue(tree: Tree): string[] {
  const file = readPlacesFile(tree);
  if (!Object.keys(file.queue).length) return [];
  const recordOf = recordIndex(tree);
  const gone: Record<string, QueueEntry> = {};
  for (const [k, e] of Object.entries(file.queue)) {
    const p = recordOf(e.form);
    if (p && settledBy(p, e)) gone[k] = e;
  }
  const keys = Object.keys(gone);
  if (!keys.length) return [];
  for (const k of keys) delete file.queue[k];
  const undo = keepUndo(file, { id: undoId(file), at: now(), places: {}, queue: gone });
  const forms = keys.map((k) => gone[k]!.form);
  write(tree, [], file, {
    op: "place.settle",
    targets: [],
    reason: "queue entries of places dealt with already, left by an earlier version; nothing else taken out",
    summary: `out of the queue, dealt with already: ${forms.length === 1 ? `place "${forms[0]}"` : `${forms.length} places (${forms.join(", ").slice(0, 600)})`} — undo: strom place undo ${undo}`,
  });
  return forms;
}

/**
 * A place identified surely (K2.2, K2.4): its coordinates, names, parent and jurisdictions written into its record (made
 * when there is none), who and why and from what; out of the queue, no longer "not located", any question of it closed.
 * Refused where the person's hand is (K2.5). Inside the tree's lock.
 */
export function identifyPlace(tree: Tree, ref: string, input: IdentifyInput): PlaceStep {
  return tree.withTreeLock(() => {
    const forms = factForms(tree);
    const t = target(tree, ref, forms);
    const p = t.place;
    const by = input.by ?? "research";
    if (by !== "person" && personsHand(p))
      throw new UsageError(
        `${p.id} ${p.names[0]?.name}: the coordinates were given by the person${p.locating ? "" : " (or before the research kept who)"} — the research does not change them`,
        { code: "place.manual", params: { place: p.id }, hint: `the records say otherwise: strom place propose ${p.id} --conflict --candidate …; they agree: strom place verify ${p.id} --ok (with --alt, --form, --jurisdiction of what was found)` },
      );
    const coords = checkCoords(input.lat, input.lon);
    const why = text(input.why, 1000, "--why");
    if (!why) throw new UsageError("why it is this place: --why \"…\" (the parish of the records, the district, the years)", { code: "place.why" });
    // one place, one record: another record this near is the same place until the agent says it is not
    if (by !== "person") {
      const near = nearRecords(tree, p, coords, new Set((input.separate ?? []).map((s) => placeIdOf(s) ?? s)));
      if (near.length) {
        const o = near[0]!.place;
        const form = t.made ? p.names[0]!.name : p.id;
        throw new UsageError(
          `${t.made ? `"${form}"` : `${p.id} ${p.names[0]!.name}`} would lie ${near[0]!.km.toFixed(1)} km from ${near.map((x) => `${x.place.id} ${x.place.names[0]!.name}`).join(", ")} — the same place written twice?`,
          {
            code: "place.near",
            params: { place: o.id },
            hint: [
              t.made
                ? `the same place: its record takes the form — strom place verify ${o.id} --ok --form "${form}" --why "…"`
                : `the same place: strom place merge ${p.id} --into ${o.id} --reason "…"`,
              `another place close by (a part of it, a neighbour): the same command with --separate ${near.map((x) => x.place.id).join(" --separate ")}`,
            ].join("\n"),
          },
        );
      }
    }
    const { more, dropped, today } = applyDetails(tree, p, t, input, forms);
    const kept = p.locating?.kept;
    p.coords = coords;
    delete p.unlocated;
    const locating: PlaceLocating = {
      by,
      at: now(),
      why,
      ...(input.source ? { source: { title: text(input.source.title, 300, "--source-title")!, ...(input.source.url ? { url: input.source.url.trim() } : {}) } } : {}),
      ...(kept && kept.lat === coords.lat && kept.lon === coords.lon ? { kept } : {}),
    };
    p.locating = locating;
    p.updated = now();
    const file = readPlacesFile(tree);
    unqueue(tree, file, [p], [...t.keys, ...more]);
    write(tree, [p], file, {
      op: "place.identify",
      targets: [p.id],
      summary: `${p.id} ${p.names[0]!.name} identified (${by}): ${coords.lat}, ${coords.lon} — ${why.slice(0, 80)}${detailsSaid(today, dropped)}`,
      ...(dropped.length ? { reason: why } : {}),
    });
    return { place: p, ...(today ? { today } : {}), dropped };
  });
}

function detailsSaid(today: string | undefined, dropped: Jurisdiction[]): string {
  return `${today ? `; today's name ${today} first` : ""}${dropped.length ? `; taken off as wrong: ${dropped.map((j) => `${j.kind} ${j.name}`).join(", ")}` : ""}`;
}

/** Not determined (K2.2): the one state "not located", with why and what would decide it; out of the queue. */
export function unlocatePlace(tree: Tree, ref: string, why: string, needs?: string, by: PlaceBy = "research"): Place {
  return tree.withTreeLock(() => {
    const forms = factForms(tree);
    const t = target(tree, ref, forms);
    const p = t.place;
    if (p.coords && by !== "person")
      throw new UsageError(`${p.id} ${p.names[0]?.name} is on the map — the research does not take coordinates away`, {
        code: "place.manual",
        hint: `the records say otherwise: strom place propose ${p.id} --conflict …; cannot be decided: strom place verify ${p.id} --undecided "…"`,
      });
    const w = text(why, 300, "--why");
    if (!w) throw new UsageError('why it cannot be determined: --why "…"', { code: "place.why" });
    for (const k of t.keys) addName(p, forms.get(k)?.form ?? k);
    p.unlocated = w;
    const n = text(needs, 300, "--needs");
    const { question: _q, ...rest } = p.locating ?? { by, at: now() };
    p.locating = { ...rest, by, at: now(), context: contextOf(p, t.keys.map((k) => forms.get(k)).find(Boolean)), ...(n ? { needs: n } : {}) };
    if (!n) delete p.locating.needs;
    p.updated = now();
    const file = readPlacesFile(tree);
    unqueue(tree, file, [p], t.keys);
    write(tree, [p], file, { op: "place.unlocated", targets: [p.id], summary: `${p.id} ${p.names[0]!.name} not located: ${w.slice(0, 80)}` });
    return p;
  });
}

/** A candidate as the agent gives it: "<name>|<lat>|<lon>|<why>[|<district>|<country>|<source title>|<url>]". */
export function parseCandidate(s: string, i: number): PlaceCandidate {
  const parts = s.split("|").map((x) => x.trim());
  const [name, lat, lon, why, district, country, title, url] = parts;
  if (!name || lat === undefined || lon === undefined || !why) throw new UsageError(`--candidate "${s}": "<name>|<lat>|<lon>|<why>[|<district>|<country>|<source>|<url>]"`, { code: "place.candidate" });
  const c = checkCoords(Number(lat), Number(lon));
  return {
    id: `c${i + 1}`,
    name: text(name, 300, "a candidate's name")!,
    lat: c.lat,
    lon: c.lon,
    why: text(why, 1000, "a candidate's why")!,
    ...(district ? { district: text(district, 300, "a district")! } : {}),
    ...(country ? { country: text(country, 60, "a country")! } : {}),
    ...(title ? { source: { title: text(title, 300, "a source")!, ...(url ? { url } : {}) } } : {}),
  };
}

/**
 * A question for the person (K2.2 probable, K6.2 a conflict, K3.3 a form): one open question a place, 1–3 candidates;
 * out of the queue. A conflict the person answered "keep" is not asked again while the coordinates stay. Inside the lock.
 */
export function proposePlace(tree: Tree, ref: string, q: Omit<PlaceQuestion, "at">): Place {
  return tree.withTreeLock(() => {
    const forms = factForms(tree);
    const t = target(tree, ref, forms);
    const p = t.place;
    if (q.kind !== "form" && (!q.candidates?.length || q.candidates.length > 3)) throw new UsageError("one to three candidates: --candidate …", { code: "place.candidate" });
    if (q.kind === "conflict") {
      if (!p.coords) throw new UsageError(`${p.id} has no coordinates to be in conflict with: strom place propose ${p.id} --candidate …`, { code: "place.conflict" });
      const kept = p.locating?.kept;
      if (kept && kept.lat === p.coords.lat && kept.lon === p.coords.lon)
        throw new UsageError(`${p.id}: the person kept these coordinates against the research's question — not asked again while they stay`, { code: "place.kept" });
    }
    if (q.kind === "propose" && personsHand(p))
      throw new UsageError(`${p.id}: the person's coordinates — only a conflict may be asked: --conflict`, { code: "place.manual" });
    for (const k of t.keys) addName(p, forms.get(k)?.form ?? k);
    const why = text(q.why, 1000, "--why");
    const question: PlaceQuestion = {
      kind: q.kind,
      at: now(),
      ...(q.candidates?.length ? { candidates: q.candidates } : {}),
      ...(q.kind === "conflict" && p.coords ? { current: { lat: p.coords.lat, lon: p.coords.lon } } : {}),
      ...(q.change ? { change: q.change } : {}),
      ...(why ? { why } : {}),
    };
    p.locating = { ...(p.locating ?? originUnknown(p)), question };
    p.updated = now();
    const file = readPlacesFile(tree);
    unqueue(tree, file, [p], t.keys);
    write(tree, [p], file, { op: "place.propose", targets: [p.id], summary: `${p.id} ${p.names[0]!.name}: a question for the person (${q.kind}${q.candidates ? `, ${q.candidates.length} candidates` : ""})` });
    return p;
  });
}

/**
 * The coordinates checked by the research (K6.6): right (the day kept, and on what), or why it cannot be decided; out
 * of the queue. What the check found of the place beside its coordinates is written too — its other names, the forms
 * of the facts that are it, its jurisdictions (a wrong one taken off, said why) — the coordinates never moved.
 */
export function verifyPlace(
  tree: Tree,
  ref: string,
  result: ({ ok: true; why?: string } | { ok: false; why: string }) & { source?: { title: string; url?: string } },
  details: PlaceDetails = {},
): PlaceStep {
  return tree.withTreeLock(() => {
    const forms = factForms(tree);
    const t = target(tree, ref, forms);
    const p = t.place;
    if (t.made || !p.coords) throw new UsageError(`${t.made ? `"${p.names[0]!.name}"` : p.id} has no coordinates to check: strom place identify ${t.made ? `"${p.names[0]!.name}"` : p.id} …`, { code: "place.coords" });
    const why = text(result.why, 1000, "--why");
    if (details.drop?.length && !why) throw new UsageError('why the jurisdiction is wrong: --why "…" (what the records or the reference say)', { code: "place.why" });
    const { more, dropped, today } = applyDetails(tree, p, t, details, forms);
    const base: PlaceLocating = p.locating ?? { by: "person", at: p.updated };
    const { verifiedSource: _s, ...kept } = base;
    const source = result.source ? { verifiedSource: { title: text(result.source.title, 300, "--source-title")!, ...(result.source.url ? { url: result.source.url.trim() } : {}) } } : {};
    if (result.ok) {
      const { checkWhy: _c, verifiedWhy: _w, ...rest } = kept;
      const at = now();
      p.locating = { ...rest, verified: at.slice(0, 10), checked: at, ...(why ? { verifiedWhy: why } : {}), ...source };
    } else {
      if (!why) throw new UsageError('why it cannot be decided: --undecided "…"', { code: "place.why" });
      p.locating = { ...kept, checkWhy: why, checked: now(), ...source };
    }
    p.updated = now();
    const file = readPlacesFile(tree);
    unqueue(tree, file, [p], [...t.keys, ...more]);
    write(tree, [p], file, {
      op: "place.verify",
      targets: [p.id],
      summary: `${p.id} ${p.names[0]!.name}: ${result.ok ? "checked, right" : `checked, cannot be decided — ${why!.slice(0, 60)}`}${detailsSaid(today, dropped)}`,
      ...(dropped.length ? { reason: why! } : {}),
    });
    return { place: p, ...(today ? { today } : {}), dropped };
  });
}

/**
 * Two records of one place made one (the research sure, with the reason): the duplicate's names, forms and
 * jurisdictions taken into the other, its parts moved under it, the duplicate retracted with where it went. The
 * person's coordinates win: the duplicate's go over when the other has none or only the research's. Two places further
 * apart than NEAR_KM are not merged — that is the person's question. Inside the tree's lock.
 */
export function mergePlaces(tree: Tree, dupRef: string, intoRef: string, reason: string): Place {
  return tree.withTreeLock(() => {
    const get = (ref: string) => {
      const id = placeIdOf(ref);
      const p = id ? tree.get<Place>(id) : undefined;
      if (!p || p.type !== "place" || p.retracted) throw new UsageError(`no place ${ref}: place IDs (L0012)`, { code: "place.unknown", hint: "strom place list" });
      return p;
    };
    const dup = get(dupRef);
    const into = structuredClone(get(intoRef));
    if (dup.id === into.id) throw new UsageError(`${dup.id} is one record`, { code: "place.merge" });
    if (into.parent === dup.id || dup.parent === into.id) throw new UsageError(`${dup.id} and ${into.id}: one is a part of the other — not one place`, { code: "place.merge" });
    const why = text(reason, 1000, "--reason");
    if (!why) throw new UsageError('why it is one place: --reason "…"', { code: "place.why" });
    if (dup.coords && into.coords) {
      const d = placeKm(dup.coords, into.coords);
      if (d > NEAR_KM)
        throw new UsageError(`${dup.id} and ${into.id} lie ${d.toFixed(1)} km apart — not merged by the research`, {
          code: "place.far",
          hint: `the map is wrong on one: strom place propose ${personsHand(into) ? into.id : dup.id} --conflict --candidate …`,
        });
    }
    const forms = factForms(tree);
    if (dup.coords && (!into.coords || (personsHand(dup) && !personsHand(into)))) {
      into.coords = { ...dup.coords };
      if (dup.locating) into.locating = { ...structuredClone(dup.locating) };
      else into.locating = { by: "person", at: dup.updated };
      delete into.unlocated;
    }
    for (const n of dup.names) {
      const plain = !n.lang && n.from === undefined && n.to === undefined;
      addPlaceName(into, n.name, n.kind ?? (plain && forms.has(foldText(n.name)) ? "form" : "alt"), n);
    }
    for (const j of dup.jurisdictions)
      if (!into.jurisdictions.some((x) => x.kind === j.kind && foldText(x.name) === foldText(j.name) && x.from === j.from && x.to === j.to)) into.jurisdictions.push(structuredClone(j));
    if (!into.kind && dup.kind) into.kind = dup.kind;
    if (!into.parent && dup.parent && dup.parent !== into.id) into.parent = dup.parent;
    into.notes = [...into.notes, ...dup.notes.map((n) => structuredClone(n))];
    const t = now();
    into.updated = t;
    const parts = tree
      .list<Place>("place")
      .filter((x) => !x.retracted && x.parent === dup.id && x.id !== into.id)
      .map((x) => ({ ...structuredClone(x), parent: into.id, updated: t }));
    const gone: Place = { ...structuredClone(dup), retracted: { at: t, reason: `the same place as ${into.id}: ${why}` }, mergedInto: into.id, updated: t };
    // the queue's forms of the duplicate lead to the one record now: out where it was dealt with already
    const file = readPlacesFile(tree);
    const was = JSON.stringify(file.queue);
    unqueue(tree, file, [into, gone, ...parts], [], (e, p) => settledBy(p, e));
    write(tree, [into, gone, ...parts], JSON.stringify(file.queue) !== was ? file : undefined, {
      op: "place.merge",
      targets: [into.id, dup.id, ...parts.map((x) => x.id)].sort(),
      summary: `${dup.id} ${dup.names[0]!.name} merged into ${into.id} ${into.names[0]!.name}${parts.length ? ` (its parts ${parts.map((x) => x.id).join(", ")} with it)` : ""}`,
      reason: why,
    });
    return into;
  });
}

// ── the facts' places set right (K3) ────────────────────────────────────────────────────────────────────────────

/**
 * The facts writing a place so set to the record's name (K3.2) — the street or the number into the house (K3.1) — and
 * the form kept as a name of the record (K4.5). A fact whose house says another thing is left (never a house written
 * over by another). The changes, those left and why.
 */
export function formChanges(tree: Tree, form: string, to: { place: string; house?: string }): { changes: FormChange[]; left: { owner: string; event: string; why: "house" }[] } {
  const key = foldText(form.normalize("NFC").trim());
  const f = factForms(tree).get(key);
  const changes: FormChange[] = [];
  const left: { owner: string; event: string; why: "house" }[] = [];
  for (const { owner, event } of f?.events ?? []) {
    const house = to.house?.trim() || undefined;
    if (house && event.house && foldText(event.house) !== foldText(house)) {
      left.push({ owner: owner.id, event: event.id, why: "house" });
      continue;
    }
    const after = { place: to.place, ...(house ?? event.house ? { house: (house ?? event.house)! } : {}) };
    if (event.place === after.place && (event.house ?? "") === (after.house ?? "")) continue;
    changes.push({ owner: owner.id, event: event.id, before: { place: event.place!, ...(event.house ? { house: event.house } : {}) }, after });
  }
  return { changes, left };
}

/** Facts' places changed as the list says, from one side to the other where still so; the records changed and those left. */
function applyChanges(tree: Tree, items: FormChange[], from: "before" | "after"): { records: (Person | Family)[]; done: FormChange[]; left: number } {
  const to = from === "before" ? "after" : "before";
  const records = new Map<string, Person | Family>();
  const ownerOf = new Map<string, Person | Family>();
  for (const o of liveOwners(tree)) for (const e of o.events) ownerOf.set(e.id, o);
  const done: FormChange[] = [];
  let left = 0;
  for (const it of items) {
    const was = ownerOf.get(it.event);
    const rec = was ? (records.get(was.id) ?? (structuredClone(was) as Person | Family)) : undefined;
    const e = rec?.events.find((x) => x.id === it.event);
    if (!rec || !e || e.place !== it[from].place || (e.house ?? "") !== (it[from].house ?? "")) {
      left++;
      continue;
    }
    e.place = it[to].place;
    if (it[to].house) e.house = it[to].house;
    else delete e.house;
    rec.updated = now();
    records.set(rec.id, rec);
    done.push(it);
  }
  return { records: [...records.values()], done, left };
}

/**
 * A form of the facts written as the record says (K3): done now (sure, with the reason), or a question for the person
 * (K3.3: a part of a municipality or another of the same name, a bare number). Inside the tree's lock.
 */
export function rewriteForm(
  tree: Tree,
  form: string,
  to: { place: string; house?: string },
  opts: { reason?: string; propose?: boolean; why?: string },
): { place: Place; changed: number; left: number; asked: boolean } {
  return tree.withTreeLock(() => {
    const id = placeIdOf(to.place);
    const p = id ? tree.get<Place>(id) : recordIndex(tree)(to.place);
    if (!p || p.type !== "place" || p.retracted) throw new UsageError(`no place record "${to.place}" to write the facts by`, { code: "place.unknown", hint: "strom place list" });
    const name = p.names[0]!.name;
    const { changes, left } = formChanges(tree, form, { place: name, ...(to.house ? { house: to.house } : {}) });
    if (!changes.length) throw new UsageError(`no fact writes "${form}" otherwise than ${name}${left.length ? ` (${left.length} left: their house says another thing)` : ""}`, { code: "place.form" });
    const place = structuredClone(p);
    addName(place, form);
    if (opts.propose) {
      const why = text(opts.why ?? opts.reason, 1000, "--why");
      place.locating = {
        ...(place.locating ?? originUnknown(place)),
        question: { kind: "form", at: now(), change: { from: { place: form.normalize("NFC").trim() }, to: { place: name, ...(to.house ? { house: to.house } : {}) }, facts: changes.length }, ...(why ? { why } : {}) },
      };
      place.updated = now();
      write(tree, [place], undefined, { op: "place.propose", targets: [place.id], summary: `${place.id} ${name}: "${form}" → ${name}? (${changes.length} facts, a question for the person)` });
      return { place, changed: 0, left: left.length, asked: true };
    }
    const reason = text(opts.reason, 1000, "--reason");
    if (!reason) throw new UsageError('why the facts write it so: --reason "…"', { code: "place.why" });
    const { records, done, left: gone } = applyChanges(tree, changes, "before");
    place.updated = now();
    // the form's entry of the queue leads to the record now: out where the place was dealt with already
    const file = readPlacesFile(tree);
    const was = JSON.stringify(file.queue);
    unqueue(tree, file, [place], [], (e, x) => settledBy(x, e));
    write(tree, [place, ...records], JSON.stringify(file.queue) !== was ? file : undefined, {
      op: "place.rewrite",
      targets: [place.id, ...records.map((r) => r.id)].sort(),
      summary: `the facts' place "${form}" → ${name}${to.house ? ` (house ${to.house})` : ""}: ${done.length} facts in ${records.length} records${left.length ? `, ${left.length} left (another house)` : ""}`,
      reason,
    });
    return { place, changed: done.length, left: left.length + gone, asked: false };
  });
}

// ── the person's answers ────────────────────────────────────────────────────────────────────────────────────────

export const PLACE_TAKES = ["c1", "c2", "c3", "keep", "unknown", "none", "yes", "no", "first"] as const;
export type PlaceTake = (typeof PLACE_TAKES)[number];

export interface AnswerResult {
  done: string[];
  skipped: { place: string; why: "no-question" | "unknown" | "take" | "changed" }[];
  /** Facts the answers would change (a form's question answered yes). */
  facts: number;
  undo?: string;
}

/** The facts of a place's forms that cite a record. */
function factCount(tree: Tree, p: Place): number {
  const forms = factForms(tree);
  const recordOf = recordIndex(tree);
  let n = 0;
  for (const f of forms.values()) if (recordOf(f.form)?.id === p.id) n += f.events.filter(({ event }) => (event.citations ?? []).length > 0).length;
  return n;
}

/** One answer applied to a copy of the place (and the facts' changes it brings), or why not. */
function answerOne(tree: Tree, p: Place, take: PlaceTake): { place: Place; facts?: FormChange[] } | "no-question" | "take" {
  const q = p.locating?.question;
  if (!q) return "no-question";
  const place = structuredClone(p);
  const loc = { ...place.locating! };
  delete loc.question;
  const t = now();
  const pick = take === "first" ? (q.kind === "form" ? "yes" : q.kind === "conflict" ? "keep" : "c1") : take;
  if (q.kind === "form") {
    if (pick !== "yes" && pick !== "no") return "take";
    place.locating = loc;
    if (pick === "no" || !q.change) return { place };
    return { place, facts: formChanges(tree, q.change.from.place, q.change.to).changes };
  }
  if (/^c[1-3]$/u.test(pick)) {
    const c = q.candidates?.find((x) => x.id === pick);
    if (!c) return "take";
    place.coords = { lat: c.lat, lon: c.lon };
    delete place.unlocated;
    place.locating = { by: "person", at: t, why: c.why, ...(c.source ? { source: c.source } : {}) };
    return { place };
  }
  if (pick === "keep") {
    if (!place.coords) return "take";
    place.locating = { ...loc, kept: { lat: place.coords.lat, lon: place.coords.lon } };
    return { place };
  }
  if (pick === "unknown" || pick === "none") {
    if (place.coords && q.kind === "conflict") return "take";
    place.unlocated = pick === "unknown" ? "the person could not tell which of the candidates" : "none of the candidates, by the person";
    place.locating = { ...loc, at: t, context: contextOf(place, undefined) + factCount(tree, place) };
    return { place };
  }
  return "take";
}

/**
 * The person's answers to questions of places (one, or several at once: `first` takes each one's first candidate, keeps
 * a conflict's coordinates, says yes to a form): one operation, undone as one (undoPlaces). `dry`: what it would do.
 * Inside the tree's lock.
 */
export function answerPlaces(tree: Tree, ids: string[], take: PlaceTake, opts: { dry?: boolean; expect?: Record<string, string> } = {}): AnswerResult {
  return tree.withTreeLock(() => {
    const out: AnswerResult = { done: [], skipped: [], facts: 0 };
    const places: Place[] = [];
    const facts: FormChange[] = [];
    for (const ref of ids) {
      const id = placeIdOf(ref);
      const p = id ? tree.get<Place>(id) : undefined;
      if (!p || p.type !== "place" || p.retracted) {
        out.skipped.push({ place: ref, why: "unknown" });
        continue;
      }
      // the place changed since the person saw it (a sync of the app, the research): asked again — what the person saw
      // is the place as it was (its time of change) or its question (the time it was asked, What waits' `at`)
      const seen = opts.expect?.[p.id];
      if (seen && seen !== p.updated && seen !== p.locating?.question?.at) {
        out.skipped.push({ place: p.id, why: "changed" });
        continue;
      }
      const r = answerOne(tree, p, take);
      if (typeof r === "string") {
        out.skipped.push({ place: p.id, why: r });
        continue;
      }
      r.place.updated = now();
      places.push(r.place);
      facts.push(...(r.facts ?? []));
      out.done.push(p.id);
    }
    out.facts = facts.length;
    if (opts.dry || !places.length) return out;
    const { records, done } = applyChanges(tree, facts, "before");
    const file = readPlacesFile(tree);
    const before = new Map(places.map((p) => [p.id, tree.get<Place>(p.id)!]));
    const undo: PlacesUndo = {
      id: undoId(file),
      at: now(),
      places: Object.fromEntries(places.map((p) => [p.id, { before: before.get(p.id)!, after: p.updated }])),
      ...(done.length ? { facts: done } : {}),
    };
    keepUndo(file, undo);
    write(tree, [...places, ...records], file, {
      op: "place.answer",
      targets: [...places.map((p) => p.id), ...records.map((r) => r.id)].sort(),
      summary: `the person's answer (${take}) to ${places.length === 1 ? `the question of ${places[0]!.id} ${places[0]!.names[0]!.name}` : `${places.length} questions of places`}${done.length ? `: ${done.length} facts' places set right` : ""}`,
    });
    out.undo = undo.id;
    return out;
  });
}

/**
 * A step on places undone by its ID (the person's answers, a whole batch of them; names taken off; the queue tidied —
 * each of the last UNDO_KEPT once): each place as it was where nothing changed it since, the facts' places back where
 * still so, the queue's entries back. Inside the tree's lock.
 */
export function undoPlaces(tree: Tree, id: string): { restored: string[]; left: string[] } {
  return tree.withTreeLock(() => {
    const file = readPlacesFile(tree);
    const u = file.undo?.id === id ? file.undo : file.undos?.find((x) => x.id === id);
    if (!u) throw new UsageError(`nothing to undo of that step (each step on places once, the last ${UNDO_KEPT})`, { code: "places.undo.later" });
    const restored: string[] = [];
    const left: string[] = [];
    const records: (Place | Person | Family)[] = [];
    for (const [pid, { before, after }] of Object.entries(u.places)) {
      const cur = tree.get<Place>(pid);
      if (!cur || cur.updated !== after) {
        left.push(pid);
        continue;
      }
      if (before) records.push({ ...before, updated: now() });
      restored.push(pid);
    }
    if (left.length)
      throw new UsageError(`changed since: ${left.join(", ")} — the step is not undone (a later step on the same place is undone first)`, {
        code: "places.undo.later",
        params: { places: left.join(", ") },
      });
    // an earlier step still to be undone that left a place as this undo puts it back: it knows the place by its new time
    for (const r of records) {
      const was = u.places[r.id]!.before!.updated;
      for (const x of [file.undo, ...(file.undos ?? [])]) if (x && x !== u && x.places[r.id]?.after === was) x.places[r.id] = { ...x.places[r.id]!, after: r.updated };
    }
    const back = applyChanges(tree, u.facts ?? [], "after");
    // the queue's entries the step took out: back, and kept there (never taken out by the tidying again)
    let queued = 0;
    for (const [k, e] of Object.entries(u.queue ?? {})) {
      if (file.queue[k]) continue;
      file.queue[k] = { ...e, back: true };
      queued++;
    }
    // out of the steps to be undone; the one before it the newest again
    if (file.undo === u) {
      const before = file.undos?.pop();
      if (before) file.undo = before;
      else delete file.undo;
    } else file.undos = file.undos!.filter((x) => x !== u);
    if (!file.undos?.length) delete file.undos;
    write(tree, [...records, ...back.records], file, {
      op: "place.undo",
      targets: [...restored, ...back.records.map((r) => r.id)].sort(),
      summary: `a step on places undone (${u.id}): ${restored.length} places${back.done.length ? `, ${back.done.length} facts' places back` : ""}${queued ? `, ${queued} back in the queue` : ""}`,
    });
    return { restored, left };
  });
}

// ── the task and the one state of "not located" ─────────────────────────────────────────────────────────────────

/** What is known of a place: the facts with it that cite a record, its jurisdictions, its parent (K2.3: more = something new). */
export function contextOf(p: Place, f: FactForm | undefined): number {
  return (f?.events ?? []).filter(({ event }) => (event.citations ?? []).length > 0).length + p.jurisdictions.length + (p.parent ? 1 : 0);
}

/** Something new of a place since it was found not located (K2.3). */
function newSince(p: Place, f: FactForm | undefined): boolean {
  const had = p.locating?.context;
  return had !== undefined && contextOf(p, f) > had;
}

/**
 * Once per tree: the places history/places.json says are not located taken into the place records (the one state of
 * "not located"; a record made when there is none) — the entries kept there for an older strom. Inside the tree's lock.
 */
export function convertHistoryUnlocated(tree: Tree, entries: Record<string, { state?: string; why?: string; at?: string }>): number {
  const file = readPlacesFile(tree);
  if (file.converted || !Object.values(entries).some((m) => m?.state === "unlocated")) return 0;
  const forms = factForms(tree);
  const recordOf = recordIndex(tree);
  const records: Place[] = [];
  const t = now();
  for (const [key, m] of Object.entries(entries)) {
    if (m?.state !== "unlocated") continue;
    const p = recordOf(key);
    if (p?.coords || p?.unlocated) continue;
    const why = (m.why ?? "").normalize("NFC").trim().slice(0, 300) || "not identified which place of this name it is";
    if (p) {
      records.push({ ...structuredClone(p), unlocated: why, locating: { ...(p.locating ?? {}), by: "research", at: m.at ?? t, context: contextOf(p, forms.get(foldText(key))) }, updated: t });
      continue;
    }
    const f = forms.get(foldText(key));
    if (!f) continue;
    const made: Place = { id: tree.allocate("L"), type: "place", names: [{ name: f.form }], unlocated: why, locating: { by: "research", at: m.at ?? t }, jurisdictions: [], notes: [], created: t, updated: t };
    made.locating!.context = contextOf(made, f);
    records.push(made);
  }
  file.converted = t;
  write(tree, records, file, { op: "place.convert", targets: records.map((r) => r.id), summary: `places not located in the history taken into the place records: ${records.length}` });
  return records.length;
}

/**
 * The task of identification kept with the queue (inside the tree's lock; never in an archive or a dry run): one open
 * task while anything is queued — the places not located with something new of them queued again first (K2.3) — and
 * the open one done when the queue is empty. Returns the task made, if any.
 */
export function raisePlacesTask(tree: Tree, archive: boolean): string | undefined {
  if (tree.dryRun || archive) return undefined;
  return tree.withTreeLock(() => {
    // what an earlier version left in the queue of places dealt with already: out first, so the count is right
    settleQueue(tree);
    const file = readPlacesFile(tree);
    const forms = factForms(tree);
    const recordOf = recordIndex(tree);
    // K2.3: a place not located comes back by itself once something new is known of it
    const back: string[] = [];
    for (const p of tree.list<Place>("place")) {
      if (p.retracted || p.coords || !p.unlocated || p.locating?.question) continue;
      const key = p.names.map((n) => foldText(n.name)).find((k) => forms.has(k) && recordOf(forms.get(k)!.form)?.id === p.id);
      if (!key || file.queue[key]) continue;
      if (newSince(p, forms.get(key))) back.push(forms.get(key)!.form);
    }
    if (back.length) queuePlaces(tree, { forms: back }, "research");
    const waiting = Object.values(readPlacesFile(tree).queue);
    const queued = waiting.length;
    const tasks = tree.list<Task>("task").filter((t) => t.origin === PLACES_IDENTIFY_ORIGIN);
    const live = tasks.find((t) => t.state === "open" || t.state === "doing" || t.state === "parked");
    if (!queued) {
      for (const t of tasks.filter((x) => x.state === "open" || x.state === "parked"))
        tree.putMany([{ ...t, state: "done", result: phrase(tree.lang, "places.identify.result"), updated: now() } as Task], [], {
          op: "task.done",
          targets: [t.id],
          summary: `${t.id} done: the queue of places is empty`,
        });
      return undefined;
    }
    // in the research's language, the count as the queue is now: the task kept so (one made by an older strom, in
    // English, too), never written again while nothing of it changed
    const text = {
      what: phrase(tree.lang, "places.identify.what", { n: queued }),
      where: waiting.slice(0, 10).map((e) => e.form),
      why: phrase(tree.lang, "places.identify.why"),
      doneWhen: phrase(tree.lang, "places.identify.done"),
    };
    if (live) {
      if (live.what !== text.what || live.why !== text.why || live.doneWhen !== text.doneWhen || (live.where ?? []).join("\n") !== text.where.join("\n"))
        tree.putMany([{ ...live, ...text, updated: now() } as Task], [], { op: "task.edit", targets: [live.id], summary: `${live.id} the queue of places: ${queued}` });
      return undefined;
    }
    const t = now();
    const task: Task = {
      id: tree.allocate("T"),
      type: "task",
      level: "enrich",
      priority: 5,
      ...text,
      subject: [],
      state: "open",
      origin: PLACES_IDENTIFY_ORIGIN,
      notes: [],
      created: t,
      updated: t,
    } as Task;
    tree.putMany([task], [], { op: "task.add", targets: [task.id], summary: `+${task.id} task "identify the places of the facts" (${queued} queued)` });
    return task.id;
  });
}

/**
 * Names of a place record found wrong (a slip of a record kept as a form, another place's name) taken off, with the
 * reason: never today's name (the first), never a name a fact of the tree still writes for this place (set the facts
 * right first: strom place rewrite). One operation; while the person has no step to undo, `strom place undo` puts them
 * back. Inside the tree's lock.
 */
export function dropPlaceNames(tree: Tree, ref: string, names: string[], reason: string): { place: Place; dropped: PlaceName[]; undo: string } {
  return tree.withTreeLock(() => {
    const id = placeIdOf(ref);
    const was = id ? tree.get<Place>(id) : undefined;
    if (!was || was.type !== "place" || was.retracted) throw new UsageError(`no place ${ref}: a place ID (L0012)`, { code: "place.unknown", hint: "strom place list" });
    const why = text(reason, 1000, "--why");
    if (!why) throw new UsageError('why the name is wrong: --why "…"', { code: "place.why" });
    if (!names.length) throw new UsageError('which name: --drop "<name>"', { code: "place.name" });
    const p = structuredClone(was);
    const forms = factForms(tree);
    const recordOf = recordIndex(tree);
    const dropped: PlaceName[] = [];
    for (const raw of names) {
      const n = raw.normalize("NFC").trim();
      const key = foldText(n);
      // the very writing first, else any of the same letters (any accent)
      const exact = p.names.findIndex((x) => x.name === n);
      const hit = exact >= 0 ? exact : p.names.findIndex((x) => foldText(x.name) === key);
      if (hit < 0) throw new UsageError(`${p.id} has no name "${n}" (it has ${p.names.map((x) => x.name).join(", ")})`, { code: "place.name" });
      if (hit === 0) throw new UsageError(`"${n}" is the first name of ${p.id} — today's name is set with --name (strom place verify ${p.id} --ok --name "…")`, { code: "place.name" });
      const f = forms.get(foldText(p.names[hit]!.name));
      if (f && recordOf(f.form)?.id === p.id && !p.names.some((x, i) => i !== hit && foldText(x.name) === foldText(p.names[hit]!.name)))
        throw new UsageError(`${f.facts === 1 ? "a fact" : `${f.facts} facts`} of the tree still write "${f.form}" — set them right first: strom place rewrite "${f.form}" --to ${p.id} --reason "…"`, { code: "place.form" });
      dropped.push(p.names[hit]!);
      p.names.splice(hit, 1);
    }
    p.updated = now();
    const file = readPlacesFile(tree);
    const undo = keepUndo(file, { id: undoId(file), at: now(), places: { [p.id]: { before: was, after: p.updated } } });
    write(tree, [p], file, {
      op: "place.names",
      targets: [p.id],
      reason: why,
      summary: `${p.id} ${p.names[0]!.name}: name${dropped.length === 1 ? "" : "s"} taken off as wrong: ${dropped.map((x) => `${x.name}${x.lang ? `@${x.lang}` : ""}`).join(", ")} — ${why.slice(0, 80)} — undo: strom place undo ${undo}`,
    });
    return { place: p, dropped, undo };
  });
}

/**
 * The other names history's map is told of a place (strom history map --also) written among its record's names too —
 * the record is where the app and the identification read them. Nothing where the facts' place has no one record.
 * Inside the tree's lock.
 */
export function addOtherNames(tree: Tree, form: string, also: string[]): Place | undefined {
  if (!also.length || tree.dryRun) return undefined;
  return tree.withTreeLock(() => {
    const r = recordIndex(tree)(form);
    if (!r) return undefined;
    const p = structuredClone(r);
    for (const a of also) {
      let n: PlaceName;
      try {
        n = parseAltName(a);
      } catch {
        continue;
      }
      addPlaceName(p, n.name, "alt", n);
    }
    if (JSON.stringify(p.names) === JSON.stringify(r.names)) return undefined;
    p.updated = now();
    write(tree, [p], undefined, { op: "place.names", targets: [p.id], summary: `${p.id} ${p.names[0]!.name}: other names ${also.join(", ")}` });
    return p;
  });
}

/** The repairs of the place records done once per tree (repairPlaces): raised when a new one is added. */
export const PLACES_REPAIR = 1;

/** A question asked of coordinates nobody kept the origin of, written by 1.25 as the research's (its origin the question's moment). */
function originByQuestion(p: Place): boolean {
  const l = p.locating;
  const q = l?.question;
  return !!p.coords && !!l && !!q && l.by === "research" && !l.why && !l.source && !l.verified && Math.abs(Date.parse(l.at) - Date.parse(q.at)) < 1000;
}

/**
 * Another name of no language a record has twice (addPlaceName of an older strom): the same words are today's name, or
 * another name with a language whose years are the same or this one has none.
 */
function twiceWithLanguage(p: Place, n: PlaceName): boolean {
  if (n.kind !== "alt" || n.lang) return false;
  const key = foldText(n.name);
  const noYears = n.from === undefined && n.to === undefined;
  return p.names.some((m, i) => m !== n && foldText(m.name) === key && (i === 0 ? noYears : !!m.lang && (noYears || (m.from === n.from && m.to === n.to))));
}

/**
 * Once per tree (PLACES_REPAIR), what earlier versions wrote wrong into the place records set right — nothing taken
 * away: a name kept with its language and years as its text ("Lhotow@cs:1844") read as what it says; coordinates a
 * question made the research's (their origin unknown) the person's again; today's name first on a place the research
 * identified while the old name was first; the other names history's map keeps of a place (strom history map --also)
 * written among the record's names too; a name written twice (once with its language, once of none) kept once. One
 * operation; while the person has no step to undo, `strom place undo` takes it back. Inside the tree's lock.
 */
export function repairPlaces(tree: Tree): string[] {
  const file = readPlacesFile(tree);
  if ((file.repaired ?? 0) >= PLACES_REPAIR) return [];
  const forms = factForms(tree);
  const recordOf = recordIndex(tree);
  const changed = new Map<string, Place>();
  const said: string[] = [];
  const copy = (p: Place) => changed.get(p.id) ?? structuredClone(p);
  for (const p0 of tree.list<Place>("place")) {
    if (p0.retracted) continue;
    let p = copy(p0);
    const notes: string[] = [];
    // a name with its syntax as text
    p.names = p.names.map((n, i) => {
      const parsed = nameWithSyntax(n);
      if (!parsed) return n;
      notes.push(`"${n.name}" read as ${parsed.name}`);
      const { kind: _k, ...name } = parsed;
      return i === 0 ? name : { ...name, kind: n.kind ?? "alt" };
    });
    if (originByQuestion(p)) {
      p.locating = { ...p.locating!, by: "person", at: p.updated };
      notes.push("the coordinates the person's again (a question had made them the research's)");
    }
    if (p.locating && p.locating.by !== "person") {
      const a = todayName(p, yearsOf(p, forms));
      if (a) {
        setFirst(p, a, forms);
        notes.push(`today's name ${a.name} first`);
      }
    }
    if (notes.length) {
      p.updated = now();
      changed.set(p.id, p);
      said.push(`${p.id} ${notes.join("; ")}`);
    }
  }
  // the other names history's map keeps of a place: among the record's names too
  for (const [key, m] of Object.entries(readPlaces(tree))) {
    if (!m?.also?.length) continue;
    const r = recordOf(key);
    if (!r) continue;
    const p = copy(r);
    const before = JSON.stringify(p.names);
    for (const a of m.also) {
      let n: PlaceName;
      try {
        n = parseAltName(a);
      } catch {
        continue;
      }
      addPlaceName(p, n.name, "alt", n);
    }
    if (JSON.stringify(p.names) !== before) {
      p.updated = now();
      changed.set(p.id, p);
      said.push(`${p.id} the names of history's map: ${m.also.join(", ")}`);
    }
  }
  // a name written twice by an older strom: another name of no language (and no years of its own) beside the same words
  // with a language, or the same as today's — the one of no language goes, nothing it said is lost
  for (const p0 of tree.list<Place>("place")) {
    if (p0.retracted) continue;
    const p = copy(p0);
    const twice = p.names.filter((n, i) => i > 0 && twiceWithLanguage(p, n));
    if (!twice.length) continue;
    p.names = p.names.filter((n) => !twice.includes(n));
    p.updated = now();
    changed.set(p.id, p);
    said.push(`${p.id} written twice: ${twice.map((n) => n.name).join(", ")}`);
  }
  const records = [...changed.values()];
  // nothing to set right: nothing written (looked at again next time — a tree that never had places stays without the file)
  if (!records.length) return [];
  file.repaired = PLACES_REPAIR;
  const undo = keepUndo(file, {
    id: undoId(file),
    at: now(),
    places: Object.fromEntries(records.map((p) => [p.id, { before: tree.get<Place>(p.id)!, after: p.updated }])),
  });
  write(tree, records, file, {
    op: "place.repair",
    targets: records.map((p) => p.id).sort(),
    // a name read from its syntax, or written twice, is no name lost: the data check takes the step as reasoned
    reason: "what an earlier version wrote into the place records set right, nothing lost (undo kept)",
    summary: `place records set right (${records.length}): ${said.join(" · ").slice(0, 1500)} — undo: strom place undo ${undo}`,
  });
  return said;
}

/**
 * What a session on the places did, counted by strom from its own log and said in the research's language — the
 * agent's summary follows it. Checked is never identified: a place whose coordinates were right already is "verified".
 */
export function placesSessionCounts(tree: Tree, sessionId: string): string {
  const n = { identified: 0, verified: 0, undecided: 0, asked: 0, unlocated: 0, merged: 0 };
  for (const file of opsLogsOf(tree.dataDir, sessionId)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let op: { op?: string; summary?: string };
      try {
        op = JSON.parse(line);
      } catch {
        continue;
      }
      if (op.op === "place.identify") n.identified++;
      else if (op.op === "place.verify") n[/: checked, right/.test(op.summary ?? "") ? "verified" : "undecided"]++;
      else if (op.op === "place.propose") n.asked++;
      else if (op.op === "place.unlocated") n.unlocated++;
      else if (op.op === "place.merge") n.merged++;
    }
  }
  return (Object.keys(n) as (keyof typeof n)[])
    .filter((k) => n[k] > 0)
    .map((k) => phrase(tree.lang, `places.count.${k}`, { n: n[k] }))
    .join(", ");
}

/**
 * Where tasks are raised (a session's start and end, the frontier applied): history's places not located taken into
 * the records once, what earlier versions wrote wrong set right once, then the task of identification kept with the
 * queue. Never in an archive or a dry run.
 */
export function keepPlacesTask(tree: Tree): string | undefined {
  if (tree.dryRun || actsAsArchive(tree)) return undefined;
  tree.withTreeLock(() => convertHistoryUnlocated(tree, readPlaces(tree)));
  tree.withTreeLock(() => repairPlaces(tree));
  return raisePlacesTask(tree, false);
}

/** The jurisdiction of "<kind>:<name>[:from-to]" — one year (":1899"): known so in that year, from and to alike. */
export function parseJurisdiction(s: string): Jurisdiction {
  const m = /^([^:]+):([^:]+?)(?::(?:(\d{3,4})?-(\d{3,4})?|(\d{3,4})))?$/u.exec(s.normalize("NFC").trim());
  const kind = m?.[1]?.trim();
  if (!m || !kind || !(JURISDICTIONS as readonly string[]).includes(kind))
    throw new UsageError(`--jurisdiction "${s}": "<kind>:<name>[:from-to]" or one year "<kind>:<name>:<year>", kind one of ${JURISDICTIONS.join(", ")}`, { code: "place.jurisdiction" });
  const from = m[3] ?? m[5];
  const to = m[4] ?? m[5];
  if (from && to && Number(from) > Number(to)) throw new UsageError(`--jurisdiction "${s}": the years ${from}-${to} go backwards`, { code: "place.jurisdiction" });
  return { kind: kind as Jurisdiction["kind"], name: m[2]!.trim(), recordsets: [], ...(from ? { from: Number(from) } : {}), ...(to ? { to: Number(to) } : {}) };
}
