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
import type { Event, Family, Jurisdiction, Person, Place, PlaceBy, PlaceCandidate, PlaceLocating, PlaceQuestion, Session, Source, Task } from "./model.ts";
import { JURISDICTIONS } from "./model.ts";
import { readJsonIfExists, stringifyCanonical } from "./json.ts";
import { splitStreet } from "./streets.ts";
import { foldText } from "./text.ts";
import { actsAsArchive } from "./state.ts";
import { readPlaces } from "./pastevents.ts";
import { now, type Tree } from "./tree.ts";
import path from "node:path";

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
}

export interface PlacesFile {
  queue: Record<string, QueueEntry>;
  undo?: PlacesUndo;
  /** When the places not located in history/places.json were taken into the place records (once). */
  converted?: string;
}

export function readPlacesFile(tree: Tree): PlacesFile {
  try {
    const f = readJsonIfExists<Partial<PlacesFile>>(path.join(tree.root, ...PLACE_QUEUE_FILE.split("/")));
    const queue: Record<string, QueueEntry> = {};
    for (const [k, v] of Object.entries(f?.queue ?? {})) if (v && typeof v.form === "string" && v.form.trim()) queue[k] = v;
    return { queue, ...(f?.undo ? { undo: f.undo } : {}), ...(f?.converted ? { converted: f.converted } : {}) };
  } catch {
    return { queue: {} };
  }
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
  const byName = new Map<string, Place[]>();
  for (const p of tree.list<Place>("place")) {
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

/** The queue cut into sessions: the places of one area together, at most BATCH_MAX in each, in the queue's order. */
export function queueBatches(tree: Tree, file: PlacesFile = readPlacesFile(tree), forms: Map<string, FactForm> = factForms(tree)): [string, QueueEntry][][] {
  const byArea = new Map<string, [string, QueueEntry][]>();
  for (const row of queueOrder(file)) {
    const area = areaOf(forms.get(row[0]));
    byArea.set(area, [...(byArea.get(area) ?? []), row]);
  }
  const out: [string, QueueEntry][][] = [];
  for (const rows of byArea.values()) for (let i = 0; i < rows.length; i += BATCH_MAX) out.push(rows.slice(i, i + BATCH_MAX));
  return out;
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
      if ([w.key, ...others].some((k) => file.queue[k])) {
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

/** A name added to a record when it has none like it (any accent folded alike); the facts' forms are its names (K3.2, K4.5). */
function addName(p: Place, name: string, extra: Omit<Place["names"][number], "name"> = {}): void {
  const n = name.normalize("NFC").trim();
  if (!n) return;
  if (p.names.some((x) => foldText(x.name) === foldText(n) && (x.lang ?? "") === (extra.lang ?? ""))) return;
  p.names.push({ name: n, ...extra });
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

/** Coordinates a person gave, or whose origin nobody knows (before identification was kept): the research never changes them. */
export function personsHand(p: Place): boolean {
  return !!p.coords && (!p.locating || p.locating.by === "person");
}

export interface IdentifyInput {
  lat: number;
  lon: number;
  why: string;
  source?: { title: string; url?: string };
  /** Today's name, when the record's first is not it. */
  name?: string;
  /** Other names (another language, a historical name, the facts' variants). */
  alt?: Place["names"];
  kind?: string;
  parent?: string;
  jurisdictions?: Jurisdiction[];
  /** Other forms of the facts that are the same place (K3.2): their names on the record. */
  forms?: string[];
  by?: PlaceBy;
}

/** The forms queued for a place, and the place's forms, out of the queue. */
function unqueue(file: PlacesFile, keys: string[]): void {
  for (const k of keys) delete file.queue[k];
}

/**
 * A place identified surely (K2.2, K2.4): its coordinates, names, parent and jurisdictions written into its record (made
 * when there is none), who and why and from what; out of the queue, no longer "not located", any question of it closed.
 * Refused where the person's hand is (K2.5). Inside the tree's lock.
 */
export function identifyPlace(tree: Tree, ref: string, input: IdentifyInput): Place {
  return tree.withTreeLock(() => {
    const forms = factForms(tree);
    const t = target(tree, ref, forms);
    const p = t.place;
    const by = input.by ?? "research";
    if (by !== "person" && personsHand(p))
      throw new UsageError(
        `${p.id} ${p.names[0]?.name}: the coordinates were given by the person${p.locating ? "" : " (or before the research kept who)"} — the research does not change them`,
        { code: "place.manual", params: { place: p.id }, hint: `the records say otherwise: strom place propose ${p.id} --conflict --candidate …; they agree: strom place verify ${p.id} --ok` },
      );
    const coords = checkCoords(input.lat, input.lon);
    const why = text(input.why, 1000, "--why");
    if (!why) throw new UsageError("why it is this place: --why \"…\" (the parish of the records, the district, the years)", { code: "place.why" });
    if (input.parent) {
      const parent = tree.get<Place>(input.parent);
      if (!parent || parent.type !== "place" || parent.id === p.id) throw new UsageError(`no place ${input.parent} to be its parent`, { code: "place.unknown" });
      p.parent = parent.id;
    }
    if (input.name) {
      const name = text(input.name, 300, "--name")!;
      const rest = p.names.filter((n) => !(foldText(n.name) === foldText(name) && !n.lang));
      p.names = [{ name }, ...rest];
    }
    for (const a of input.alt ?? []) addName(p, a.name, { ...(a.lang ? { lang: a.lang } : {}), ...(a.from !== undefined ? { from: a.from } : {}), ...(a.to !== undefined ? { to: a.to } : {}) });
    for (const k of t.keys) addName(p, forms.get(k)?.form ?? k);
    const more: string[] = [];
    for (const f of input.forms ?? []) {
      const key = foldText(f.normalize("NFC").trim());
      if (!key) continue;
      addName(p, forms.get(key)?.form ?? f);
      more.push(key);
    }
    if (input.kind) p.kind = input.kind;
    for (const j of input.jurisdictions ?? [])
      if (!p.jurisdictions.some((x) => x.kind === j.kind && foldText(x.name) === foldText(j.name) && x.from === j.from && x.to === j.to)) p.jurisdictions.push(j);
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
    unqueue(file, [...t.keys, ...more]);
    write(tree, [p], file, {
      op: "place.identify",
      targets: [p.id],
      summary: `${p.id} ${p.names[0]!.name} identified (${by}): ${coords.lat}, ${coords.lon} — ${why.slice(0, 80)}`,
    });
    return p;
  });
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
    unqueue(file, t.keys);
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
    p.locating = { ...(p.locating ?? { by: "research", at: now() }), question };
    p.updated = now();
    const file = readPlacesFile(tree);
    unqueue(file, t.keys);
    write(tree, [p], file, { op: "place.propose", targets: [p.id], summary: `${p.id} ${p.names[0]!.name}: a question for the person (${q.kind}${q.candidates ? `, ${q.candidates.length} candidates` : ""})` });
    return p;
  });
}

/** The coordinates checked by the research (K6.6): right (the day kept), or why it cannot be decided; out of the queue. */
export function verifyPlace(tree: Tree, ref: string, result: { ok: true; why?: string } | { ok: false; why: string }): Place {
  return tree.withTreeLock(() => {
    const forms = factForms(tree);
    const t = target(tree, ref, forms);
    const p = t.place;
    if (!p.coords) throw new UsageError(`${p.id} has no coordinates to check: strom place identify ${p.id} …`, { code: "place.coords" });
    const why = text(result.why, 1000, "--why");
    const base: PlaceLocating = p.locating ?? { by: "person", at: p.updated };
    if (result.ok) {
      const { checkWhy: _c, ...rest } = base;
      p.locating = { ...rest, verified: now().slice(0, 10) };
    } else {
      if (!why) throw new UsageError('why it cannot be decided: --undecided "…"', { code: "place.why" });
      p.locating = { ...base, checkWhy: why };
    }
    p.updated = now();
    const file = readPlacesFile(tree);
    unqueue(file, t.keys);
    write(tree, [p], file, { op: "place.verify", targets: [p.id], summary: `${p.id} ${p.names[0]!.name}: ${result.ok ? "checked, right" : `checked, cannot be decided — ${why!.slice(0, 60)}`}` });
    return p;
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
        ...(place.locating ?? { by: "research", at: now() }),
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
    write(tree, [place, ...records], undefined, {
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
      id: `u${Date.now().toString(36)}`,
      at: now(),
      places: Object.fromEntries(places.map((p) => [p.id, { before: before.get(p.id)!, after: p.updated }])),
      ...(done.length ? { facts: done } : {}),
    };
    file.undo = undo;
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
 * The person's last step on places undone (answers, a whole batch of them): each place as it was where nothing changed
 * it since, the facts' places back where still so. Inside the tree's lock.
 */
export function undoPlaces(tree: Tree, id: string): { restored: string[]; left: string[] } {
  return tree.withTreeLock(() => {
    const file = readPlacesFile(tree);
    const u = file.undo;
    if (!u || u.id !== id) throw new UsageError("nothing to undo of that step (only the last step on places, once)", { code: "places.undo.later" });
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
    if (left.length) throw new UsageError(`changed since: ${left.join(", ")} — the step is not undone`, { code: "places.undo.later", params: { places: left.join(", ") } });
    const back = applyChanges(tree, u.facts ?? [], "after");
    delete file.undo;
    write(tree, [...records, ...back.records], file, {
      op: "place.undo",
      targets: [...restored, ...back.records.map((r) => r.id)].sort(),
      summary: `the last step on places undone: ${restored.length} places${back.done.length ? `, ${back.done.length} facts' places back` : ""}`,
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
        tree.putMany([{ ...t, state: "done", result: "every place of the queue identified, asked about or found not located", updated: now() } as Task], [], {
          op: "task.done",
          targets: [t.id],
          summary: `${t.id} done: the queue of places is empty`,
        });
      return undefined;
    }
    if (live) return undefined;
    const t = now();
    const task: Task = {
      id: tree.allocate("T"),
      type: "task",
      level: "enrich",
      priority: 5,
      what: `Identify the places of the facts in the queue (${queued})`,
      where: waiting.slice(0, 10).map((e) => e.form),
      why: "The person asked: which place of the name each is, where it lies, its names and jurisdictions — for the map, the history and the houses.",
      doneWhen: "Every place of the queue identified, asked about or found not located.",
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
 * Where tasks are raised (a session's start and end, the frontier applied): history's places not located taken into
 * the records once, then the task of identification kept with the queue. Never in an archive or a dry run.
 */
export function keepPlacesTask(tree: Tree): string | undefined {
  if (tree.dryRun || actsAsArchive(tree)) return undefined;
  tree.withTreeLock(() => convertHistoryUnlocated(tree, readPlaces(tree)));
  return raisePlacesTask(tree, false);
}

/** The jurisdiction of "<kind>:<name>[:from-to]". */
export function parseJurisdiction(s: string): Jurisdiction {
  const m = /^([^:]+):([^:]+?)(?::(\d{3,4})?-(\d{3,4})?)?$/u.exec(s.normalize("NFC").trim());
  const kind = m?.[1]?.trim();
  if (!m || !kind || !(JURISDICTIONS as readonly string[]).includes(kind))
    throw new UsageError(`--jurisdiction "${s}": "<kind>:<name>[:from-to]", kind one of ${JURISDICTIONS.join(", ")}`, { code: "place.jurisdiction" });
  return { kind: kind as Jurisdiction["kind"], name: m[2]!.trim(), recordsets: [], ...(m[3] ? { from: Number(m[3]) } : {}), ...(m[4] ? { to: Number(m[4]) } : {}) };
}
