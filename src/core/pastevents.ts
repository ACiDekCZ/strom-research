// What the ancestors lived through (experiments.history): the events of history at the places of the
// tree — wars, epidemics, censuses, changes of the state — and the local ones the research read in its own records.
//
// Where it lies, written by strom alone:
// - <shared>/history/regions/<region>.json: a region's catalog, shared by every tree of the user (under the lock of
//   <shared>/history/), never in a tree's git — its events only ever added, their IDs never given again;
// - <tree>/history/places.json: each place of the tree's facts (as `2 PLAC` of the GEDCOM writes it) → its regions
//   with the years it belonged to them, or not located;
// - <tree>/history/local.json: the local events read in the tree's own sources;
// - <tree>/history/hidden.json: what the person hid, at a place or a person, in the whole tree, a whole region;
// - <tree>/history/skip.json: the regions and places the person does not want looked for in this tree.
// The tree's files are sealed like its records (Tree.putFile, core/integrity.ts): a change without a logged operation
// is an edit outside strom. Nothing goes into data/, nothing into the GEDCOM: no SCHEMA_VERSION, no gate of the app.
// The Strom app reads the answer (historyAnswer) through the bridge and hides through it (hideEvent).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { withLock } from "./lock.ts";
import { readJsonIfExists, stringifyCanonical, writeFileAtomic } from "./json.ts";
import { foldText } from "./text.ts";
import { Settings, type HistoryPace } from "./config.ts";
import { actsAsArchive } from "./state.ts";
import { phrase } from "./phrases.ts";
import { addressesPerson } from "./impersonal.ts";
import { StromError, UsageError } from "./errors.ts";
import { create, update } from "./records.ts";
import { factPlaces, factWritten } from "../gedcom/export.ts";
import { dateYears } from "./gdate.ts";
import { lineValue } from "../gedcom/lines.ts";
import type { Family, Person, Place, Session, Source, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import {
  factsByRecord,
  finishPlaceOf,
  placeFile,
  placeHeld,
  placeHistories,
  placeKeyOf,
  placeOfEvent,
  placeOfTask,
  placeRecord,
  placeTurn,
  raisePlaceTasks,
  readPlaceAsks,
  readPlaceCatalog,
  suggestPlaces,
  writePlaceCatalog,
  type PlaceCatalog,
  type PlaceHistoryState,
  type PlaceWeight,
} from "./placehistory.ts";

/** The task of a tree that maps its places to regions (core/queue: level enrich, one a tree). */
export const HISTORY_PLACES_ORIGIN = "history:places";
/** The prefix of a region's task (`history:region:<id>`, one a region). */
export const HISTORY_REGION_ORIGIN = "history:region:";
/** The prefix of a task that fills the gaps of a region's finished catalog (`history:gaps:<id>`, one a region). */
export const HISTORY_GAPS_ORIGIN = "history:gaps:";
/** The level the tasks of history take (an existing one: a new value of the list would raise SCHEMA_VERSION). */
export const HISTORY_LEVEL = "enrich";

/** A region's task origin. */
export function regionOrigin(region: string): string {
  return `${HISTORY_REGION_ORIGIN}${region}`;
}

/** A region's task to fill the gaps of its finished catalog. */
export function gapsOrigin(region: string): string {
  return `${HISTORY_GAPS_ORIGIN}${region}`;
}

/** Is it a task that fills the gaps of a region's finished catalog (history:gaps:<id>)? */
export function forGaps(t: Pick<Task, "origin">): boolean {
  return typeof t.origin === "string" && t.origin.startsWith(HISTORY_GAPS_ORIGIN);
}

/** Is it a task of the history (history:places, history:region:<id>, history:gaps:<id>)? */
export function forHistory(t: Pick<Task, "origin">): boolean {
  return typeof t.origin === "string" && t.origin.startsWith("history:");
}

export const EVENT_KINDS = ["war", "epidemic", "census", "state", "emigration", "law", "economy", "disaster", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
/** The languages of every text of a region's event. */
export const REGION_LANGS = ["cs", "en", "de"] as const;
/** At most so many characters of a text, a quote. */
export const TEXT_MAX = 300;
/** The answer to the app: at most so many events and places (state.truncated past them). */
export const MAX_EVENTS = 3000;
export const MAX_PLACES = 5000;
/** A region held by another tree for longer is free to be taken (F2). */
export const HOLD_DAYS = 7;
/** Other names of a place in the answer: so many, so long at most. */
const ALSO_MAX = 20;
const ALSO_CHARS = 200;

export const PLACES_FILE = "history/places.json";
export const LOCAL_FILE = "history/local.json";
export const HIDDEN_FILE = "history/hidden.json";
/** The regions and places the person does not want looked for in this tree (strom history skip; the app, POST /history/skip). */
export const SKIP_FILE = "history/skip.json";
/** At most so many characters of the person's note for a place determined again (code points after NFC). */
export const NOTE_MAX = 200;
/** The regions the person asked to be taken first (strom history first; the app's person card, POST /history/first). */
export const FIRST_FILE = "history/first.json";

export type Texts = Record<string, string>;

export interface EventSource {
  title: string;
  publisher?: string;
  url: string;
  /** The page's language. */
  lang?: string;
  /** The day strom read the page (YYYY-MM-DD). */
  checked: string;
  /** The words on the page the event stands on (≤ 300 characters, the year it began in them): the one the app shows. */
  quote: string;
  /** All the quotes of the page when more than one (the year it ended in another): the research's only, never the app's. */
  quotes?: string[];
  /** SHA-256 of the page's text (the research's only, never the app's). */
  sha: string;
}

export interface Retracted {
  at: string;
  why: string;
  /** The event that took its place (--replaces): what was hidden on this one holds on that one. */
  replacedBy?: string;
  /**
   * Deleted by the person (strom history delete, POST /history/delete — R4): gone from every tree on this computer
   * (a local one from this tree), never written again by the research, back with restore; `tree` the one it was deleted from.
   */
  by?: "person";
  tree?: string;
}

/** Deleted by the person (not taken back by the research): restore brings it back. */
export function deletedByPerson(e: { retracted?: Retracted }): boolean {
  return e.retracted?.by === "person" && !e.retracted.replacedBy;
}

export interface RegionEvent {
  id: string;
  from: number;
  to: number;
  date?: string;
  kind: EventKind;
  text: Texts;
  why?: Texts;
  source: EventSource;
  /** More sources of the same event (--same-as). */
  sources?: EventSource[];
  tip?: { text: Texts };
  sensitive?: true;
  /** Why it is another event than one of the same kind and years (--distinct). */
  distinct?: string;
  retracted?: Retracted;
  /** The tree that wrote it. */
  by: string;
  at: string;
}

export interface Catalog {
  region: { id: string; name: Texts };
  next: number;
  events: RegionEvent[];
  /** Pages strom could not read: never asked again for the same event (M3: the person is asked nothing). */
  tried: { url: string; at: string; why: string }[];
  done?: { at: string; tree: string };
  holder?: { tree: string; since: string };
  /** When the person asked for it to be looked for again (redo): a task of it dropped before is no answer since. */
  redo?: string;
  /**
   * The gaps of the finished catalog a session looked at (history:gaps:<id>): never looked for again, whatever it
   * found — another tree's gaps within them neither. Apart from `tried` (pages strom could not read). Gone with redo.
   */
  gaps?: GapTried[];
  /**
   * The years its catalog was looked through for (K2.7): the period of each tree whose session finished it (strom
   * history done), with that tree and when — trees sharing it, their periods joined. A catalog finished before it was
   * kept has none: the tree that finished it writes the period its brief said then (raiseHistoryTasks), any other
   * tree counts it looked through from 1600 to the year it was finished (searchedSpans). Gone with redo.
   */
  searched?: Searched[];
}

/** Years of a region's catalog, both ends in (a gap of it). */
export interface Gap {
  from: number;
  to: number;
}

/** A gap a session filled: its years, when, the tree, how many events it wrote in them. */
export interface GapTried extends Gap {
  at: string;
  tree: string;
  added: number;
}

/** Years a tree's session looked a region's catalog through for: when, the tree, the events it wrote in them (when known). */
export interface Searched extends Gap {
  at: string;
  tree: string;
  added?: number;
}

export interface LocalEvent {
  id: string;
  from: number;
  to: number;
  date?: string;
  kind: EventKind;
  text: Texts;
  local: { source: string; clip?: string; cite: string };
  /** Where it happened: the place of the source (its record set's), as the facts write it. */
  place: string;
  distinct?: string;
  retracted?: Retracted;
  by: string;
  at: string;
}

export interface RegionLink {
  id: string;
  from?: number;
  to?: number;
}

export interface PlaceMap {
  regions: RegionLink[];
  also?: string[];
  /** unlocated: the agent could not locate it; redo: the person asked for it to be determined again (with `note`). */
  state?: "unlocated" | "redo";
  why?: string;
  /** The person's word (strom history assign): the agent never maps it otherwise. */
  manual?: true;
  /** What the research had determined before the person's word: back to it with strom history assign --auto. */
  auto?: Omit<PlaceMap, "auto" | "manual" | "note">;
  /** The person's note for the agent determining it again (data, never an instruction). */
  note?: string;
  at: string;
}

/**
 * What the person hid: an event at a place or a person, an event in the whole tree (`tree`), or every event of a region
 * in this tree, the later ones too (`region`, no event).
 */
export interface Hide {
  event?: string;
  place?: string;
  person?: string;
  tree?: true;
  region?: string;
  at: string;
}

/** The regions and places the person does not want looked for in this tree. */
export interface Skips {
  regions: { region: string; at: string }[];
  places: { place: string; at: string }[];
}

interface PlacesFile {
  places: Record<string, PlaceMap>;
}
interface LocalFile {
  next: number;
  events: LocalEvent[];
}
interface HiddenFile {
  hidden: Hide[];
}

// ── the experiment ─────────────────────────────────────────────────────────

/** Is the experiment on for this tree: the user's config on, the tree's strom.json not off. */
export function historyOn(tree: Tree, settings: Settings = new Settings(tree.env, {})): boolean {
  return settings.experimentsHistory(tree.config);
}

/** Refused while the experiment is off (strom history add, local): one sentence and the way, for the agent. */
export function requireHistoryOn(tree: Tree, settings?: Settings): void {
  if (historyOn(tree, settings)) return;
  throw new UsageError("the history of the places is off for this research — nothing is looked for or written", {
    code: "history.off",
    hint: "the user alone turns it on, in their terminal: strom config set experiments.history on (a tree's own off: strom config unset experiments.history --for-tree)",
  });
}

// ── the shared catalogs ────────────────────────────────────────────────────

export function historyRoot(shared: string): string {
  return path.join(shared, "history");
}

export function regionsDir(shared: string): string {
  return path.join(historyRoot(shared), "regions");
}

export function regionFile(shared: string, id: string): string {
  return path.join(regionsDir(shared), `${id}.json`);
}

/** A region's ID: letters a–z, digits and hyphens, at most 24 (its events' IDs `<region>-<nnnn>` at most 32). */
export function regionIdOk(id: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,23})$/.test(id) && !id.endsWith("-") && !PLACE_KEY.test(id);
}

/**
 * A place's catalog key (core/placehistory.ts): p-<lat>n|s-<lon>e|w from its coordinates in hundredths of a degree
 * (p-4962n-1507e: 49.62° N, 15.07° E — two trees' records of one village meet), or t-<tree>-l<n> for a place without
 * coordinates (that tree's alone). Never a region's ID; its events' IDs `<key>-<nnnn>`.
 */
export const PLACE_KEY = /^(?:p-\d{1,4}[ns]-\d{1,5}[ew]|t-[0-9a-f]{8}-l\d{1,9})$/u;

export function requireRegionId(id: string): void {
  if (!regionIdOk(id))
    throw new UsageError(`"${id}" is no region ID: a–z, 0–9 and hyphens, at most 24 (e.g. cz-bohemia)`, { code: "history.region.id", params: { region: id } });
}

/** A region's catalog, or undefined (none yet, or one unreadable: never thrown at a reader). */
export function readCatalog(shared: string, id: string): Catalog | undefined {
  if (!regionIdOk(id)) return undefined;
  try {
    const c = readJsonIfExists<Catalog>(regionFile(shared, id));
    if (!c || typeof c !== "object" || !Array.isArray(c.events)) return undefined;
    return { ...c, tried: Array.isArray(c.tried) ? c.tried : [], next: Number.isInteger(c.next) ? c.next : c.events.length + 1 };
  } catch {
    return undefined;
  }
}

/** Every catalog of the shared folder (status, pack). */
export function catalogIds(shared: string): string[] {
  try {
    return fs
      .readdirSync(regionsDir(shared))
      .filter((n) => n.endsWith(".json"))
      .map((n) => n.slice(0, -5))
      .filter(regionIdOk)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Change the shared catalogs under their lock (<shared>/history/.lock): read afresh inside, written whole. Inside a
 * tree's lock when a tree's file changes too — the tree's first, then this one, never the other way round.
 */
export function withCatalogs<T>(shared: string, fn: () => T): T {
  return withLock(path.join(historyRoot(shared), ".lock"), { owner: "strom history", waitMs: 20_000, staleMs: 60_000 }, fn);
}

export function writeCatalog(shared: string, c: Catalog): void {
  writeFileAtomic(regionFile(shared, c.region.id), stringifyCanonical(c));
}

/** A region made, or its names changed (cs, en and de: the app shows a region when a person moves). */
export function ensureRegion(shared: string, id: string, name?: Texts): Catalog {
  requireRegionId(id);
  return withCatalogs(shared, () => {
    const had = readCatalog(shared, id);
    if (!had && !name) throw new UsageError(`there is no region ${id} yet: it needs its names`, { code: "history.region.new", params: { region: id }, hint: `strom history region ${id} --name-cs "…" --name-en "…" --name-de "…"` });
    if (name) checkTexts("name", name, REGION_LANGS, 120, false);
    const c: Catalog = had ?? { region: { id, name: {} }, next: 1, events: [], tried: [] };
    if (name) c.region = { id, name: nfc(name) };
    writeCatalog(shared, c);
    return c;
  });
}

// ── the tree's files ───────────────────────────────────────────────────────

function readTreeFile<T>(tree: Tree, rel: string): T | undefined {
  try {
    return readJsonIfExists<T>(path.join(tree.root, ...rel.split("/")));
  } catch {
    return undefined;
  }
}

export function readPlaces(tree: Tree): Record<string, PlaceMap> {
  const f = readTreeFile<PlacesFile>(tree, PLACES_FILE);
  return f && typeof f.places === "object" && f.places ? f.places : {};
}

export function readLocal(tree: Tree): LocalFile {
  const f = readTreeFile<LocalFile>(tree, LOCAL_FILE);
  const events = Array.isArray(f?.events) ? f!.events : [];
  return { next: Number.isInteger(f?.next) ? f!.next : events.length + 1, events };
}

export function readHidden(tree: Tree): Hide[] {
  const f = readTreeFile<HiddenFile>(tree, HIDDEN_FILE);
  return Array.isArray(f?.hidden) ? f!.hidden.filter((h) => !!h && typeof h === "object" && (typeof h.event === "string" || typeof h.region === "string")) : [];
}

export function readSkips(tree: Tree): Skips {
  const f = readTreeFile<Partial<Skips>>(tree, SKIP_FILE);
  return {
    regions: Array.isArray(f?.regions) ? f!.regions.filter((x) => typeof x?.region === "string" && typeof x.at === "string") : [],
    places: Array.isArray(f?.places) ? f!.places.filter((x) => typeof x?.place === "string" && typeof x.at === "string") : [],
  };
}

/** A region the person asked to be taken first, and when (the newest first). */
export interface FirstAsk {
  region: string;
  at: string;
}

export function readFirst(tree: Tree): FirstAsk[] {
  const f = readTreeFile<{ first?: FirstAsk[] }>(tree, FIRST_FILE);
  return Array.isArray(f?.first) ? f!.first.filter((x) => typeof x?.region === "string" && typeof x.at === "string") : [];
}

/** Written whole as a sealed operation of the tree (inside its lock). */
function putTreeFile(tree: Tree, rel: string, value: unknown, op: { op: string; targets: string[]; summary: string }): void {
  tree.putFile(rel, stringifyCanonical(value), op);
}

// ── checks of what an agent writes ─────────────────────────────────────────

export function nfc(t: Texts): Texts {
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.normalize("NFC").replace(/\s+/gu, " ").trim()]));
}

/**
 * Texts a person reads in the app: each given language at most `max` characters, never addressing the person nor
 * speaking as the agent (core/impersonal.ts); `required`: these languages all there.
 */
export function checkTexts(name: string, t: Texts, required: readonly string[], max = TEXT_MAX, impersonal = true): void {
  for (const l of required) if (!t[l]?.trim()) throw new UsageError(`--${name}-${l} is missing: ${name === "name" ? "a region's name" : "the texts of a region's event"} in cs, en and de`, { code: "history.text.missing", params: { option: `${name}-${l}` } });
  for (const [l, v] of Object.entries(nfc(t))) {
    if (!v) throw new UsageError(`--${name}-${l} is empty`, { code: "history.text.missing", params: { option: `${name}-${l}` } });
    if ([...v].length > max) throw new UsageError(`--${name}-${l} is ${[...v].length} characters — at most ${max}`, { code: "history.text.long", params: { option: `${name}-${l}`, max: String(max) } });
    const w = impersonal ? addressesPerson(v, l) : undefined;
    if (w)
      throw new UsageError(`--${name}-${l} addresses the person or speaks as the agent ("${w}") — what a person reads says what is, impersonally ("In the death register, look for …" → "The death register: …")`, {
        code: "history.text.personal",
        params: { option: `${name}-${l}`, word: w },
      });
  }
}

/**
 * A session on a task of history writes the region's events or the places' map alone: no task of the research, no
 * connector (a page of history is read through strom history page, politely, once). Refused there with the way on.
 */
export function refuseInHistorySession(tree: Tree, session: Pick<Session, "task"> | undefined, what: string): void {
  const task = session?.task ? tree.get<Task>(session.task) : undefined;
  if (!task || !forHistory(task)) return;
  throw new UsageError(`${what}: not in a session of history (${task.id}) — it writes the events of history alone, no task and no connector of the research`, {
    code: "history.session",
    hint: "a page for an event: strom history page <url> (--find \"<words>\" for the words to quote); a page strom cannot read: another source, or the event left out",
  });
}

/** Years of an event: whole, from ≤ to, none in the future. */
export function checkYears(from: number, to: number, date?: string): void {
  const now = new Date().getUTCFullYear();
  if (!Number.isInteger(from) || from < 100 || from > now) throw new UsageError(`--from ${from}: a year, at most ${now}`, { code: "history.years" });
  if (!Number.isInteger(to) || to < from || to > now) throw new UsageError(`--to ${to}: a year from ${from} to ${now}`, { code: "history.years" });
  if (date !== undefined) {
    const m = /^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/.exec(date);
    if (!m) throw new UsageError(`--date ${date}: ISO, only when it is sure (1866-07-03, 1866-07)`, { code: "history.date" });
    const y = Number(m[1]);
    if (y < from || y > to) throw new UsageError(`--date ${date} is not within ${from}–${to}`, { code: "history.date" });
  }
}

export function checkKind(kind: string): EventKind {
  if (!(EVENT_KINDS as readonly string[]).includes(kind)) throw new UsageError(`--kind ${kind}: one of ${EVENT_KINDS.join(", ")}`, { code: "history.kind" });
  return kind as EventKind;
}

export const overlap = (a: { from: number; to: number }, b: { from: number; to: number }) => a.from <= b.to && b.from <= a.to;

/** What may make an event the same as one written before: --same-as, --distinct, --replaces. */
export interface Sameness {
  sameAs?: string;
  distinct?: string;
  replaces?: string;
}

/**
 * The events of the same kind and years as a new one (retracted and hidden ones too: a person who hid one never gets
 * it again under another ID) — refused with their IDs unless the agent said which it is.
 */
export function sameEvents<E extends { id: string; kind: string; from: number; to: number }>(events: E[], e: { kind: string; from: number; to: number }, s: Sameness, key: (x: E) => boolean = () => true): E[] {
  return events.filter((x) => x.id !== s.replaces && x.kind === e.kind && overlap(x, e) && key(x));
}

/**
 * The events of the same kind and years the person deleted (R4): a new one is refused with their IDs — --distinct passes
 * only with a source at another address than theirs (`url`; a local event's source is the same record: never), --same-as
 * and --replaces never name one.
 */
export function refuseDeleted<E extends { id: string; retracted?: Retracted; source?: EventSource; sources?: EventSource[] }>(same: E[], s: Sameness, url: string | undefined, what: string, local = false): void {
  const deleted = same.filter(deletedByPerson);
  if (!deleted.length) return;
  const urls = new Set(deleted.flatMap((x) => [x.source, ...(x.sources ?? [])]).filter((x): x is EventSource => !!x).map((x) => x.url));
  if (!local && s.distinct && url !== undefined && urls.size && !urls.has(url)) return;
  const ids = deleted.map((x) => x.id);
  throw new UsageError(`${what} of the same kind and years was deleted by the person: ${ids.join(", ")} — nothing written`, {
    code: "history.deleted",
    params: { ids: ids.join(", ") },
    // a local event's source is the record itself: no other address, --distinct never passes (found 2026-10-28)
    hint: local
      ? "the person does not want it — leave it out; no local event of the same kind and years from this source is written again"
      : "the person does not want it — leave it out; another event of the same kind and years only with --distinct \"<why>\" and a source at another address",
  });
}

/** An event named by --same-as or --replaces the person deleted: refused (R4). */
export function refuseNamedDeleted(e: { id: string; retracted?: Retracted } | undefined): void {
  if (e && deletedByPerson(e))
    throw new UsageError(`${e.id} was deleted by the person — nothing written`, { code: "history.deleted", params: { ids: e.id }, hint: "the person does not want it — leave it out" });
}

export function refuseSame(ids: string[], what: string): never {
  throw new UsageError(`${what} of the same kind and years is there already: ${ids.join(", ")} — nothing written`, {
    code: "history.same",
    params: { ids: ids.join(", ") },
    hint: `the same event (one more source of it): --same-as ${ids[0]}; another event: --distinct "<why it is another>"; it was wrong: strom history retract ${ids[0]} --why "…", or --replaces ${ids[0]}`,
  });
}

// ── writes ─────────────────────────────────────────────────────────────────

export interface RegionEventInput {
  region: string;
  from: number;
  to: number;
  date?: string;
  kind: EventKind;
  text: Texts;
  why?: Texts;
  tip?: Texts;
  sensitive?: boolean;
  source: EventSource;
}

/**
 * A region's event written into its catalog (its source read and checked before: core/pagecheck.ts). The same event
 * again (--same-as) only adds its source; --replaces retracts the old one, pointing to the new.
 */
export function addRegionEvent(shared: string, treeId: string, e: RegionEventInput, s: Sameness = {}): { id: string; same: boolean; replaced?: string } {
  requireRegionId(e.region);
  checkYears(e.from, e.to, e.date);
  checkTexts("text", e.text, REGION_LANGS);
  if (e.why) checkTexts("why", e.why, REGION_LANGS);
  if (e.tip) checkTexts("tip", e.tip, REGION_LANGS);
  return withCatalogs(shared, () => {
    const c = readCatalog(shared, e.region);
    if (!c) throw new UsageError(`there is no region ${e.region} yet`, { code: "history.region.missing", params: { region: e.region }, hint: `strom history region ${e.region} --name-cs "…" --name-en "…" --name-de "…"` });
    const at = new Date().toISOString();
    if (s.sameAs) {
      const same = c.events.find((x) => x.id === s.sameAs);
      if (!same) throw new UsageError(`there is no event ${s.sameAs} in ${e.region}`, { code: "history.event", params: { event: s.sameAs } });
      refuseNamedDeleted(same);
      if ([same.source, ...(same.sources ?? [])].some((x) => x.url === e.source.url && foldText(x.quote) === foldText(e.source.quote))) return { id: same.id, same: true };
      same.sources = [...(same.sources ?? []), e.source];
      writeCatalog(shared, c);
      return { id: same.id, same: true };
    }
    const replaced = s.replaces ? c.events.find((x) => x.id === s.replaces) : undefined;
    if (s.replaces && !replaced) throw new UsageError(`there is no event ${s.replaces} in ${e.region}`, { code: "history.event", params: { event: s.replaces } });
    refuseNamedDeleted(replaced);
    const same = sameEvents(c.events, e, s);
    refuseDeleted(same, s, e.source.url, "an event of the region");
    if (same.length && !s.distinct) refuseSame(same.map((x) => x.id), "an event of the region");
    const id = `${e.region}-${String(c.next).padStart(4, "0")}`;
    c.next++;
    const ev: RegionEvent = {
      id,
      from: e.from,
      to: e.to,
      ...(e.date ? { date: e.date } : {}),
      kind: e.kind,
      text: nfc(e.text),
      ...(e.why ? { why: nfc(e.why) } : {}),
      source: e.source,
      ...(e.tip ? { tip: { text: nfc(e.tip) } } : {}),
      ...(e.sensitive ? { sensitive: true as const } : {}),
      ...(s.distinct ? { distinct: s.distinct.normalize("NFC") } : {}),
      by: treeId,
      at,
    };
    c.events.push(ev);
    if (replaced) replaced.retracted = { at, why: replaced.retracted?.why ?? `replaced by ${id}`, replacedBy: id };
    writeCatalog(shared, c);
    return { id, same: false, ...(replaced ? { replaced: replaced.id } : {}) };
  });
}

/**
 * Before its page is read (strom history add): what addRegionEvent would refuse for the catalog as it is — an event of
 * the same kind and years with nothing said of it, an event named that is not there — refused at once, no request made
 * for it. Checked again under the lock when written.
 */
export function refuseBeforePage(shared: string, region: string, e: { kind: string; from: number; to: number }, s: Sameness, url?: string): void {
  const c = readCatalog(shared, region);
  if (!c) return;
  for (const id of [s.sameAs, s.replaces]) {
    if (id && !c.events.some((x) => x.id === id)) throw new UsageError(`there is no event ${id} in ${region}`, { code: "history.event", params: { event: id } });
    refuseNamedDeleted(id ? c.events.find((x) => x.id === id) : undefined);
  }
  if (s.sameAs) return;
  refuseDeleted(sameEvents(c.events, e, s), s, url, "an event of the region");
  if (s.distinct) return;
  const same = sameEvents(c.events, e, s);
  if (same.length) refuseSame(same.map((x) => x.id), "an event of the region");
}

/** A page strom could not read for a region's event: kept, never asked again for it. */
export function noteTried(shared: string, region: string, url: string, why: string): void {
  if (!regionIdOk(region)) return;
  withCatalogs(shared, () => {
    const c = readCatalog(shared, region);
    if (!c) return;
    c.tried = [...c.tried.filter((t) => t.url !== url), { url, at: new Date().toISOString(), why }];
    writeCatalog(shared, c);
  });
}

export interface LocalEventInput {
  source: string;
  clip?: string;
  from: number;
  to: number;
  date?: string;
  kind: EventKind;
  text: Texts;
  place: string;
  cite: string;
}

/** A local event read in the tree's own source, into history/local.json (inside the tree's lock). */
export function addLocalEvent(tree: Tree, e: LocalEventInput, s: Sameness = {}): { id: string; same: boolean; replaced?: string } {
  checkYears(e.from, e.to, e.date);
  checkTexts("text", e.text, []);
  const f = readLocal(tree);
  if (s.sameAs) {
    const same = f.events.find((x) => x.id === s.sameAs);
    if (!same) throw new UsageError(`there is no local event ${s.sameAs}`, { code: "history.event", params: { event: s.sameAs } });
    refuseNamedDeleted(same);
    return { id: same.id, same: true };
  }
  const replaced = s.replaces ? f.events.find((x) => x.id === s.replaces) : undefined;
  if (s.replaces && !replaced) throw new UsageError(`there is no local event ${s.replaces}`, { code: "history.event", params: { event: s.replaces } });
  refuseNamedDeleted(replaced);
  const same = sameEvents(f.events, e, s, (x) => x.local.source === e.source);
  // of the same source: never another address
  refuseDeleted(same, s, undefined, `a local event of ${e.source}`, true);
  if (same.length && !s.distinct) refuseSame(same.map((x) => x.id), `a local event of ${e.source}`);
  const id = `L${String(f.next).padStart(4, "0")}`;
  const at = new Date().toISOString();
  const ev: LocalEvent = {
    id,
    from: e.from,
    to: e.to,
    ...(e.date ? { date: e.date } : {}),
    kind: e.kind,
    text: nfc(e.text),
    local: { source: e.source, ...(e.clip ? { clip: e.clip } : {}), cite: e.cite.normalize("NFC") },
    place: lineValue(e.place),
    ...(s.distinct ? { distinct: s.distinct.normalize("NFC") } : {}),
    by: tree.config.id,
    at,
  };
  const events = f.events.map((x) => (x.id === replaced?.id ? { ...x, retracted: { at, why: x.retracted?.why ?? `replaced by ${id}`, replacedBy: id } } : x));
  events.push(ev);
  putTreeFile(tree, LOCAL_FILE, { next: f.next + 1, events }, { op: "history.local", targets: [e.source], summary: `Local event ${id} (${e.kind} ${e.from === e.to ? e.from : `${e.from}–${e.to}`}) from ${e.source}` });
  return { id, same: false, ...(replaced ? { replaced: replaced.id } : {}) };
}

/**
 * A place of the facts mapped to its regions with years, or said not located (inside the tree's lock) — the agent's;
 * refused on a place the person mapped (strom history assign: the person's word stays).
 */
export function mapPlace(tree: Tree, place: string, m: { regions: RegionLink[]; also?: string[] } | { unlocated: true; why?: string }): PlaceMap {
  const places = readPlaces(tree);
  const key = lineValue(place);
  const had = placeEntry(places, key);
  if (had?.[1].manual)
    throw new UsageError(`the person mapped "${key}" to its regions themselves (${had[1].regions.map(linkText).join(", ")}) — it stays so`, {
      code: "history.map.manual",
      params: { place: key },
      hint: "leave this place out; the person alone changes it (strom history assign)",
    });
  const at = new Date().toISOString();
  const entry: PlaceMap =
    "unlocated" in m
      ? { regions: [], state: "unlocated", ...(m.why ? { why: m.why.normalize("NFC") } : {}), at }
      : {
          regions: m.regions,
          ...(m.also?.length ? { also: [...new Set(m.also.map((a) => lineValue(a)).filter(Boolean))].slice(0, ALSO_MAX).map((a) => [...a].slice(0, ALSO_CHARS).join("")) } : {}),
          at,
        };
  // the same key written otherwise before (decomposed, other spaces): one place
  for (const k of Object.keys(places)) if (k !== key && foldText(k) === foldText(key) && lineValue(k) === key) delete places[k];
  places[key] = entry;
  putTreeFile(tree, PLACES_FILE, { places }, { op: "history.map", targets: [], summary: "unlocated" in m ? `Place ${key}: not located` : `Place ${key}: ${m.regions.map(linkText).join(", ")}` });
  return entry;
}

function linkText(r: RegionLink): string {
  return r.from === undefined && r.to === undefined ? r.id : `${r.id}:${r.from ?? ""}-${r.to ?? ""}`;
}

/** A place's entry in the map by its key, written otherwise too (decomposed, other spaces): [its key there, the entry]. */
function placeEntry(places: Record<string, PlaceMap>, key: string): [string, PlaceMap] | undefined {
  if (places[key]) return [key, places[key]!];
  const f = foldText(key);
  const k = Object.keys(places).find((x) => foldText(x) === f);
  return k ? [k, places[k]!] : undefined;
}

/** A place's entry written into the map whole, the same place written otherwise before gone (inside the tree's lock). */
function putPlace(tree: Tree, key: string, entry: PlaceMap | undefined, summary: string): void {
  const places = readPlaces(tree);
  const f = foldText(key);
  for (const k of Object.keys(places)) if (foldText(k) === f) delete places[k];
  if (entry) places[key] = entry;
  putTreeFile(tree, PLACES_FILE, { places }, { op: "history.assign", targets: [], summary });
}

/** The person's note for the agent (strom history assign --note): NFC, one line, at most NOTE_MAX code points, no broken text. */
export function checkNote(note: string): string {
  const n = note.normalize("NFC").replace(/\s+/gu, " ").trim();
  // with the u flag a lone half of a pair is a character of its own: matched; a whole pair is not
  if (/[\uD800-\uDFFF\uFFFD]/u.test(note)) throw new UsageError("the note has broken characters (U+FFFD or half of a pair): send it again as it was written", { code: "history.body" });
  if (/[\u0000-\u001f\u007f]/u.test(n)) throw new UsageError("the note: text of one line, no control characters", { code: "history.body" });
  if ([...n].length > NOTE_MAX) throw new UsageError(`the note is ${[...n].length} characters — at most ${NOTE_MAX}`, { code: "history.body", params: { max: String(NOTE_MAX) } });
  return n;
}

/** The years of a place's regions: each from ≤ to, a year of 3–4 digits; the same region's years never overlapping. */
function checkLinks(links: RegionLink[]): void {
  if (!links.length) throw new UsageError("at least one region", { code: "history.body" });
  for (const l of links) {
    for (const y of [l.from, l.to]) if (y !== undefined && (!Number.isInteger(y) || y < 100 || y > 9999)) throw new UsageError(`${l.id}: ${y} is no year`, { code: "history.body" });
    if (l.from !== undefined && l.to !== undefined && l.to < l.from) throw new UsageError(`${l.id}: the later year first (${l.from}–${l.to})`, { code: "history.body" });
  }
  for (const [i, a] of links.entries())
    for (const b of links.slice(i + 1))
      if (a.id === b.id && overlap({ from: a.from ?? -Infinity, to: a.to ?? Infinity }, { from: b.from ?? -Infinity, to: b.to ?? Infinity }))
        throw new UsageError(`${a.id} twice in the same years`, { code: "history.body" });
}

/** What the research determined of a place, without the person's word on it. */
function researchMap(m: PlaceMap): NonNullable<PlaceMap["auto"]> {
  const { auto: _a, manual: _m, note: _n, ...rest } = m;
  return rest;
}

/**
 * The person's word on a place of the facts (strom history assign; the app, POST /history/map), inside the tree's lock:
 * - regions: the place belongs to these regions, with the years — manual: the agent never maps it otherwise; what the
 *   research had determined is kept for auto;
 * - redo: the research determines it again (the places' task, the next session), with the person's note for it;
 * - auto: back to what the research determined — kept from before the person's word, else determined again.
 * Refused: a place no fact writes (history.place), a region with no catalog (history.region), years or a note that do
 * not hold (history.body). The place's entry after, undefined when it waits to be mapped.
 */
export function assignPlace(tree: Tree, shared: string | undefined, place: string, a: { regions: RegionLink[] } | { redo: true; note?: string } | { auto: true }): PlaceMap | undefined {
  const key = factPlaceKey(tree, place);
  if (!key) throw new UsageError(`"${place}" is no place of the tree's facts`, { code: "history.place", params: { place } });
  let note: string | undefined;
  if ("regions" in a) {
    checkLinks(a.regions);
    for (const id of new Set(a.regions.map((l) => l.id)))
      if (!regionIdOk(id) || !shared || !readCatalog(shared, id)) throw new UsageError(`there is no region ${id}`, { code: "history.region", params: { region: id } });
  } else if ("redo" in a && a.note !== undefined) note = checkNote(a.note) || undefined;
  const had = placeEntry(readPlaces(tree), key)?.[1];
  const at = new Date().toISOString();
  if ("regions" in a) {
    const auto = had ? (had.manual ? had.auto : had.state === "redo" ? undefined : researchMap(had)) : undefined;
    const entry: PlaceMap = { regions: a.regions, ...(had?.also?.length ? { also: had.also } : {}), manual: true, ...(auto ? { auto } : {}), at };
    if (had?.manual && JSON.stringify(had.regions) === JSON.stringify(a.regions)) return had;
    putPlace(tree, key, entry, `Place ${key}: ${a.regions.map(linkText).join(", ")} (the person's)`);
    return entry;
  }
  if ("redo" in a) {
    const entry: PlaceMap = { regions: [], ...(had?.also?.length ? { also: had.also } : {}), state: "redo", ...(note ? { note } : {}), at };
    if (had?.state === "redo" && had.note === entry.note) return had;
    putPlace(tree, key, entry, `Place ${key}: to be determined again${note ? ` (the person's note: ${note})` : ""}`);
    return entry;
  }
  // auto: only the person's word goes
  if (!had?.manual) return had && had.state !== "redo" ? had : undefined;
  if (had.auto) {
    putPlace(tree, key, had.auto as PlaceMap, `Place ${key}: back to what the research determined (${had.auto.state === "unlocated" ? "not located" : had.auto.regions.map(linkText).join(", ")})`);
    return had.auto as PlaceMap;
  }
  putPlace(tree, key, { regions: [], ...(had.also?.length ? { also: had.also } : {}), state: "redo", at }, `Place ${key}: back to the research, to be determined`);
  return undefined;
}

/**
 * A region or a place the person does not want looked for in this tree (strom history skip; the app, POST
 * /history/skip), or wants again (`undo`), inside the tree's lock. A region: its task (and its gaps') kept out of the
 * queue, none raised; what was found stays. A place: out of the history of the tree (no event through it, no weight,
 * nothing to map). Refused: a region no place of the tree belongs to (history.region), a place no fact writes
 * (history.place) — unless it is skipped already (undo). The skips after.
 */
export function skipHistory(tree: Tree, what: { region: string } | { place: string }, undo = false): Skips {
  const before = readSkips(tree);
  const at = new Date().toISOString();
  let next: Skips;
  let summary: string;
  if ("region" in what) {
    const id = what.region.trim();
    const had = before.regions.some((x) => x.region === id);
    if (!(undo && had) && (!regionIdOk(id) || !regionsOfMaps(tree).includes(id)))
      throw new UsageError(`no place of the tree belongs to the region ${id} (strom history status lists them)`, { code: "history.region", params: { region: id } });
    if (had !== undo) return before;
    next = { ...before, regions: undo ? before.regions.filter((x) => x.region !== id) : [...before.regions, { region: id, at }] };
    summary = undo ? `History looked for again: region ${id}` : `History not looked for: region ${id}`;
  } else {
    const f = foldText(lineValue(what.place));
    const had = before.places.find((x) => foldText(x.place) === f);
    const key = factPlaceKey(tree, what.place) ?? (undo ? had?.place : undefined);
    if (!key) throw new UsageError(`"${what.place}" is no place of the tree's facts`, { code: "history.place", params: { place: what.place } });
    if (!!had !== undo) return before;
    next = { ...before, places: undo ? before.places.filter((x) => foldText(x.place) !== f) : [...before.places, { place: key, at }] };
    summary = undo ? `History looked for again: place ${key}` : `History not looked for: place ${key}`;
  }
  putTreeFile(tree, SKIP_FILE, next, { op: undo ? "history.unskip" : "history.skip", targets: [], summary });
  return next;
}

/** The regions of every mapped place of the tree's facts — a place the person skipped too. */
export function regionsOfMaps(tree: Tree): string[] {
  const facts = new Set([...factPlaces(tree).keys()].map((k) => foldText(k)));
  return [...new Set(Object.entries(readPlaces(tree)).flatMap(([k, m]) => (facts.has(foldText(k)) ? m.regions.map((g) => g.id) : [])))].filter(regionIdOk).sort();
}

/** An event taken back (it was wrong): never sent again; what was hidden on it stays (and moves to what replaced it). */
export function retractEvent(tree: Tree, shared: string | undefined, id: string, why: string): { id: string; scope: EventScope } {
  const reason = why.normalize("NFC").trim();
  if (!reason) throw new UsageError("--why is missing: why the event is taken back", { code: "history.why" });
  const at = new Date().toISOString();
  if (/^L\d+$/.test(id)) {
    const f = readLocal(tree);
    const e = f.events.find((x) => x.id === id);
    if (!e) throw new UsageError(`there is no local event ${id}`, { code: "history.event", params: { event: id } });
    if (e.retracted) return { id, scope: "local" };
    const events = f.events.map((x) => (x.id === id ? { ...x, retracted: { at, why: reason } } : x));
    putTreeFile(tree, LOCAL_FILE, { next: f.next, events }, { op: "history.retract", targets: [e.local.source], summary: `Local event ${id} taken back: ${reason}` });
    return { id, scope: "local" };
  }
  const scope = sharedScope(id);
  if (!shared || !scope) throw new UsageError(`there is no event ${id}`, { code: "history.event", params: { event: id } });
  withCatalogs(shared, () => {
    const c = eventCatalog(shared, id);
    const e = c?.events.find((x) => x.id === id);
    if (!c || !e) throw new UsageError(`there is no event ${id}`, { code: "history.event", params: { event: id } });
    if (e.retracted) return;
    e.retracted = { at, why: reason };
    c.save();
  });
  return { id, scope };
}

/** Where an event lives: a region's shared catalog, a place's (core/placehistory.ts), the tree's own local ones. */
export type EventScope = "region" | "local" | "place";

/** A shared event's scope by its ID: a region's or a place's; undefined for another (a local one, none). */
function sharedScope(id: string): "region" | "place" | undefined {
  return regionOfEvent(id) ? "region" : placeOfEvent(id) ? "place" : undefined;
}

/** The shared catalog an event's ID names, its events and how to write it back (under withCatalogs); undefined when none. */
function eventCatalog(shared: string, id: string): { events: RegionEvent[]; save: () => void } | undefined {
  const region = regionOfEvent(id);
  if (region) {
    const c = readCatalog(shared, region);
    return c ? { events: c.events, save: () => writeCatalog(shared, c) } : undefined;
  }
  const key = placeOfEvent(id);
  const c = key ? readPlaceCatalog(shared, key) : undefined;
  return c ? { events: c.events, save: () => writePlaceCatalog(shared, c) } : undefined;
}

/**
 * An event deleted by the person (R4: strom history delete, POST /history/delete), or brought back (`restore`): a
 * region's from its shared catalog — from every tree on this computer — a local one (L…) from this tree. Never written
 * again by the research (refuseDeleted) until restored; what was hidden on it comes back with it. One the research took
 * back (strom history retract, --replaces) is no person's: refused (history.retracted). Again: nothing changes. Inside
 * the tree's lock; the person's deletions after as the app reads them (deletedEvents).
 */
export function deleteEvent(tree: Tree, shared: string | undefined, id: string, restore = false): { event: string; scope: EventScope; changed: boolean; deleted: DeletedEvent[] } {
  const at = new Date().toISOString();
  const change = <E extends { id: string; retracted?: Retracted }>(e: E): E | undefined => {
    if (e.retracted && !deletedByPerson(e))
      throw new UsageError(`${id} was taken back by the research (${e.retracted.why}) — not the person's to ${restore ? "restore" : "delete"}`, { code: "history.retracted", params: { event: id } });
    if (restore) {
      if (!e.retracted) return undefined;
      const { retracted: _gone, ...rest } = e;
      return rest as E;
    }
    return e.retracted ? undefined : { ...e, retracted: { at, why: "deleted", by: "person", tree: tree.config.id } };
  };
  let changed = false;
  if (/^L\d+$/u.test(id)) {
    const f = readLocal(tree);
    const e = f.events.find((x) => x.id === id);
    if (!e) throw new UsageError(`there is no local event ${id}`, { code: "history.event", params: { event: id } });
    const next = change(e);
    if (next) {
      changed = true;
      const events = f.events.map((x) => (x.id === id ? next : x));
      putTreeFile(tree, LOCAL_FILE, { next: f.next, events }, { op: restore ? "history.restore" : "history.delete", targets: [e.local.source], summary: `Local event ${id} ${restore ? "restored" : "deleted"} by the person` });
    }
    return { event: id, scope: "local", changed, deleted: deletedEvents(tree, shared) };
  }
  const scope = sharedScope(id);
  if (!shared || !scope) throw new UsageError(`there is no event ${id}`, { code: "history.event", params: { event: id } });
  withCatalogs(shared, () => {
    const c = eventCatalog(shared, id);
    const i = c?.events.findIndex((x) => x.id === id) ?? -1;
    if (!c || i < 0) throw new UsageError(`there is no event ${id}`, { code: "history.event", params: { event: id } });
    const next = change(c.events[i]!);
    if (!next) return;
    c.events[i] = next;
    c.save();
    changed = true;
  });
  return { event: id, scope, changed, deleted: deletedEvents(tree, shared) };
}

/** An event the person deleted as the app shows it under Deleted: what its row needs (as in `events`), and when. */
export type DeletedEvent = Omit<AppEvent, "id" | "place"> & { event: string; at: string; place?: string | AppEvent["place"] };

/**
 * The events the person deleted that this tree would show (R4, the app's P1): of the catalogs of its places' regions —
 * deleted from any tree on this computer — and its own local ones (their source still the research's). The newest first.
 */
export function deletedEvents(tree: Tree, shared: string | undefined): DeletedEvent[] {
  const out: DeletedEvent[] = [];
  const row = (a: AppEvent, at: string, place?: string): DeletedEvent => {
    const { id, ...rest } = a;
    return { event: id, ...rest, ...(place !== undefined ? { place } : {}), at };
  };
  if (shared) {
    for (const id of regionsOfMaps(tree)) {
      const c = readCatalog(shared, id);
      for (const e of c?.events ?? []) if (deletedByPerson(e)) out.push(row(appRegionEvent(e, c!), e.retracted!.at));
    }
    // the places' own (core/placehistory.ts): of the place records of the tree's facts, each catalog once
    const seen = new Set<string>();
    for (const [id, at] of factsByRecord(tree)) {
      const p = placeRecord(tree, id);
      const key = p ? placeKeyOf(tree, p) : "";
      if (!p || seen.has(key)) continue;
      seen.add(key);
      const c = readPlaceCatalog(shared, key);
      for (const e of c?.events ?? []) if (deletedByPerson(e)) out.push(row(appPlaceEvent(e, c!, at.keys[0]!, id), e.retracted!.at));
    }
  }
  const sources = new Map(tree.list<Source>("source").map((s) => [s.id, s]));
  for (const e of readLocal(tree).events) {
    const s = sources.get(e.local.source);
    if (deletedByPerson(e) && s && !s.retracted) out.push(row(appLocalEvent(e), e.retracted!.at, e.place));
  }
  return out.sort((a, b) => b.at.localeCompare(a.at) || a.event.localeCompare(b.event));
}

/** A region's event ID → its region ("cz-bohemia-0007" → "cz-bohemia"). */
export function regionOfEvent(id: string): string | undefined {
  const m = /^([a-z0-9][a-z0-9-]*)-(\d{4,})$/.exec(id);
  return m && regionIdOk(m[1]!) ? m[1] : undefined;
}

/**
 * A region's catalog finished (strom history done): searched again only on the person's word (redo). With the tree's
 * period (regionPeriod) its years are written as looked through (K2.7) — with the events this tree wrote in them since
 * `since` (its task made) when given; a catalog finished before it kept them keeps its earlier years first (legacy).
 */
export function markDone(shared: string, region: string, treeId: string, period?: { spans: Gap[]; legacy?: Gap }, since?: string): Catalog {
  requireRegionId(region);
  return withCatalogs(shared, () => {
    const c = readCatalog(shared, region);
    if (!c) throw new UsageError(`there is no region ${region}`, { code: "history.region.missing", params: { region } });
    const at = new Date().toISOString();
    if (period) {
      const before: Searched[] = c.searched ?? (c.done ? [{ ...(period.legacy ?? legacySpan(c, undefined)), at: c.done.at, tree: c.done.tree }] : []);
      const mine = since !== undefined ? c.events.filter((e) => !e.retracted && e.by === treeId && e.at >= since) : undefined;
      c.searched = [...before, ...period.spans.map((g) => ({ ...g, at, tree: treeId, ...(mine ? { added: mine.filter((e) => overlap(e, g)).length } : {}) }))];
    }
    c.done = { at, tree: treeId };
    delete c.holder;
    writeCatalog(shared, c);
    return c;
  });
}

/** A region to be searched again (the person's word): its events stay, its `done` goes. */
export function redoRegion(shared: string, region: string): Catalog {
  requireRegionId(region);
  return withCatalogs(shared, () => {
    const c = readCatalog(shared, region);
    if (!c) throw new UsageError(`there is no region ${region}`, { code: "history.region.missing", params: { region } });
    delete c.done;
    delete c.holder;
    delete c.gaps;
    delete c.searched;
    c.redo = new Date().toISOString();
    writeCatalog(shared, c);
    return c;
  });
}

/** Does this event exist (any state) — in the tree's local ones or a region's catalog? */
export function eventExists(tree: Tree, shared: string | undefined, id: string): boolean {
  if (/^L\d+$/.test(id)) return readLocal(tree).events.some((e) => e.id === id);
  return !!shared && !!eventCatalog(shared, id)?.events.some((e) => e.id === id);
}

/**
 * An event's ID at the end of its chain of replacements (--replaces, within its catalog or the local ones), and whether
 * that one is taken back with nothing in its place. Each file read once.
 */
function replacements(tree: Tree, shared: string | undefined): (id: string) => { id: string; gone: boolean } {
  const files = new Map<string, Map<string, { retracted?: Retracted }>>();
  const eventsOf = (id: string) => {
    const key = /^L\d+$/.test(id) ? "" : (regionOfEvent(id) ?? placeOfEvent(id));
    if (key === undefined) return undefined;
    if (!files.has(key)) {
      const list: { id: string; retracted?: Retracted }[] = key === "" ? readLocal(tree).events : ((shared ? eventCatalog(shared, id)?.events : undefined) ?? []);
      files.set(key, new Map(list.map((e) => [e.id, e])));
    }
    return files.get(key);
  };
  return (id) => {
    const by = eventsOf(id);
    const seen = new Set<string>();
    let cur = id;
    for (;;) {
      const e = by?.get(cur);
      const next = e?.retracted?.replacedBy;
      seen.add(cur);
      if (!next || seen.has(next)) return { id: cur, gone: !!e?.retracted };
      cur = next;
    }
  };
}

/** How a hide is told apart: the event (at the end of its chain), and where — a place, a person, the tree, a region. */
type HideAt = { event?: string; place?: string; person?: string; tree?: boolean; region?: string };

/**
 * The person hides an event at a place or a person of this tree, in the whole tree (`tree`), or every event of a region
 * in this tree, the later ones too (`region`, no event) — or shows it again (`show`). An unknown place is no error (it
 * may have come from the app); an unknown event or person is, and a region no place of the tree belongs to. An event
 * replaced (--replaces) is the one that took its place: hidden, shown again or found hidden by its old ID or its new.
 * Inside the tree's lock; the hidden list after as the app reads it (historyAnswer): each at the event that took its
 * place, the person merged into, none taken back for good.
 */
export function hideEvent(tree: Tree, shared: string | undefined, h: HideAt, show = false): Hide[] {
  const wheres = [h.place !== undefined, h.person !== undefined, !!h.tree].filter(Boolean).length;
  if (h.region !== undefined ? h.event !== undefined || wheres > 0 : !h.event || wheres !== 1)
    throw new UsageError("an event and where (a place, a person or the whole tree) — or a region alone", { code: "history.body" });
  const current = replacements(tree, shared);
  const hidden = readHidden(tree);
  let add: Hide;
  let same: (x: Hide) => boolean;
  let where: string;
  if (h.region !== undefined) {
    const region = h.region.trim();
    if (!regionIdOk(region) || !regionsOfMaps(tree).includes(region))
      throw new UsageError(`no place of the tree belongs to the region ${region} (strom history status lists them)`, { code: "history.region", params: { region } });
    add = { region, at: new Date().toISOString() };
    same = (x) => x.event === undefined && x.region === region;
    where = `region ${region}`;
  } else {
    if (!eventExists(tree, shared, h.event!)) throw new UsageError(`there is no event ${h.event}`, { code: "history.event", params: { event: h.event! } });
    if (h.person !== undefined && !tree.get<Person>(h.person)) throw new UsageError(`there is no person ${h.person}`, { code: "history.person", params: { person: h.person } });
    const place = h.place === undefined ? undefined : lineValue(h.place);
    const event = current(h.event!).id;
    const person = h.person !== undefined ? (resolvePerson(tree, h.person) ?? h.person) : undefined;
    const at = new Date().toISOString();
    add = { event, ...(place !== undefined ? { place } : person !== undefined ? { person } : { tree: true as const }), at };
    same = (x) =>
      x.event !== undefined &&
      current(x.event).id === event &&
      (place !== undefined
        ? x.place !== undefined && foldText(x.place) === foldText(place)
        : person !== undefined
          ? x.person !== undefined && (resolvePerson(tree, x.person) ?? x.person) === person
          : !!x.tree);
    where = place ?? person ?? "the whole tree";
  }
  const had = hidden.some(same);
  if (show ? !had : had) return asRead(tree, hidden, current);
  const next = show ? hidden.filter((x) => !same(x)) : [...hidden, add];
  const what = add.event !== undefined ? `event ${add.event} at ${where}` : `every event of ${where}`;
  putTreeFile(tree, HIDDEN_FILE, { hidden: next }, { op: show ? "history.show" : "history.hide", targets: add.person ? [add.person] : [], summary: `${show ? "Shown again" : "Hidden"}: ${what}` });
  return asRead(tree, next, current);
}

/** A hide's key: the event and where (once each in what the app reads). */
function hideKey(event: string | undefined, h: Hide, person: string | undefined): string {
  if (event === undefined) return `r:${h.region}`;
  return `${event}\u0000${h.place !== undefined ? `p:${foldText(h.place)}` : h.person !== undefined ? `o:${person}` : "t"}`;
}

/** A hide as the app reads it: {event, place} | {event, person} | {event, tree: true} | {region}, and when. */
function hideRead(event: string | undefined, h: Hide, person: string | undefined): Hide {
  if (event === undefined) return { region: h.region!, at: h.at };
  return { event, ...(h.place !== undefined ? { place: h.place } : h.person !== undefined ? { person: person! } : { tree: true as const }), at: h.at };
}

/** What is hidden as the app reads it: at the event that took its place, the person merged into; once each. */
function asRead(tree: Tree, hidden: Hide[], current: (id: string) => { id: string; gone: boolean }): Hide[] {
  const out: Hide[] = [];
  const seen = new Set<string>();
  for (const h of hidden) {
    let event: string | undefined;
    if (h.event !== undefined) {
      const e = current(h.event);
      if (e.gone) continue;
      event = e.id;
    } else if (!h.region) continue;
    const person = h.person !== undefined ? resolvePerson(tree, h.person) : undefined;
    if (h.person !== undefined && !person) continue;
    const k = hideKey(event, h, person);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(hideRead(event, h, person));
  }
  return out;
}

// ── the answer for the app ─────────────────────────────────────────────────

export interface AppEvent {
  id: string;
  from: number;
  to: number;
  date?: string;
  kind: EventKind;
  scope: EventScope;
  region?: { id: string; name: Texts };
  /** A place's own event (core/placehistory.ts): the key of `places` it shows at, the place record, the place's names. */
  place?: { key: string; id?: string; name: Texts };
  text: Texts;
  why?: Texts;
  source?: { title: string; publisher?: string; url: string; lang?: string; checked: string; quote: string };
  tip?: { text: Texts };
  sensitive?: true;
  local?: { source: string; clip?: string; cite: string };
}

export interface AppPlace {
  events: string[];
  also?: string[];
  state?: "pending" | "unlocated";
  /** The regions it belongs to with the years (mapped by the research or the person; a place skipped too). */
  regions?: RegionLink[];
  /** The people of the tree with a fact at it. */
  persons?: number;
  /** Why the research could not locate it (state unlocated). */
  why?: string;
  /** Mapped by the person (strom history assign): the research never maps it otherwise. */
  manual?: true;
  /** The person asked for it to be determined again (state pending), with their note. */
  redo?: true;
  note?: string;
  /** The person does not want history looked for at it (strom history skip): no event through it. */
  skip?: true;
  /** The research's place record of it (L…), when one bears its name alone. */
  id?: string;
  /** Its own history (core/placehistory.ts, with `id` alone): its state, when it was looked for, the reach of its search. */
  history?: PlaceHistoryState;
  at?: string;
  area?: Texts;
}

export type SearchState = "none" | "running" | "done" | "waiting";

/** A region's state for the app: in the queue, at work, finished, waiting (why), held by its lands, skipped, none yet. */
export type RegionState = "queued" | "running" | "done" | "waiting" | "covered" | "skipped" | "none";

export interface AppRegion {
  name: Texts;
  state: RegionState;
  /** When its catalog was finished (done). */
  at?: string;
  why?: string;
  /** Nobody of the tree lived there in its years (K2.7a): waiting, with why — nothing looked for until a fact falls in them. */
  nobody?: true;
  /** The finished regions that hold its places and years already (covered: it comes last, closed without a search). */
  covered?: string[];
  /** Its place among the tasks of the regions (their gaps too) in the order strom run takes them, 1 = the next. */
  order?: number;
  /** The region the person asked for first. */
  first?: true;
  /** Its catalog's events not taken back (the hidden ones too), those hidden in this tree. */
  events: number;
  hidden: number;
  /** Its weight in the tree (strom history status --json): the places, the people, their facts. */
  places: number;
  persons: number;
  facts: number;
  /** A finished catalog's gaps not looked at yet, and the state of the task filling them. */
  gaps?: Gap[];
  fill?: "queued" | "running";
}

export interface HistoryAnswer {
  /** mapping: a session maps the places of the facts now — so many mapped of so many. */
  state: { on: boolean; search: SearchState; why?: string; at?: string; pending: number; rev: string; truncated?: true; mapping?: { mapped: number; mappable: number } };
  lang: string;
  events: AppEvent[];
  places: Record<string, AppPlace>;
  regions: Record<string, AppRegion>;
  hidden: Hide[];
  /** The events the person deleted (R4), for the app's Deleted: restore brings them back. */
  deleted: DeletedEvent[];
  /** The place records the research suggests for their own history (K7.3, only an offer): IDs alone. */
  suggest?: string[];
}

function appRegionEvent(e: RegionEvent, c: Catalog): AppEvent {
  const s = e.source;
  return {
    id: e.id,
    from: e.from,
    to: e.to,
    ...(e.date ? { date: e.date } : {}),
    kind: (EVENT_KINDS as readonly string[]).includes(e.kind) ? e.kind : "other",
    scope: "region",
    region: { id: c.region.id, name: c.region.name },
    text: e.text,
    ...(e.why ? { why: e.why } : {}),
    source: { title: s.title, ...(s.publisher ? { publisher: s.publisher } : {}), url: s.url, ...(s.lang ? { lang: s.lang } : {}), checked: s.checked, quote: s.quote },
    ...(e.tip ? { tip: { text: e.tip.text } } : {}),
    ...(e.sensitive ? { sensitive: true as const } : {}),
  };
}

function appPlaceEvent(e: RegionEvent, c: PlaceCatalog, key: string, id: string | undefined): AppEvent {
  const s = e.source;
  return {
    id: e.id,
    from: e.from,
    to: e.to,
    ...(e.date ? { date: e.date } : {}),
    kind: (EVENT_KINDS as readonly string[]).includes(e.kind) ? e.kind : "other",
    scope: "place",
    place: { key, ...(id ? { id } : {}), name: c.place.name },
    text: e.text,
    ...(e.why ? { why: e.why } : {}),
    source: { title: s.title, ...(s.publisher ? { publisher: s.publisher } : {}), url: s.url, ...(s.lang ? { lang: s.lang } : {}), checked: s.checked, quote: s.quote },
    ...(e.tip ? { tip: { text: e.tip.text } } : {}),
    ...(e.sensitive ? { sensitive: true as const } : {}),
  };
}

function appLocalEvent(e: LocalEvent): AppEvent {
  return {
    id: e.id,
    from: e.from,
    to: e.to,
    ...(e.date ? { date: e.date } : {}),
    kind: (EVENT_KINDS as readonly string[]).includes(e.kind) ? e.kind : "other",
    scope: "local",
    text: e.text,
    local: e.local,
  };
}

/** Does a region's event belong to a place: its years within those the place belonged to the region? */
export function inRegion(e: { from: number; to: number }, link: RegionLink): boolean {
  return e.from <= (link.to ?? Infinity) && e.to >= (link.from ?? -Infinity);
}

/**
 * What the tree's places are, read once: the facts' places, their mapping, the catalogs of their regions. A place the
 * person skipped (strom history skip) is out of the history of the tree: not among `facts`, no map — no event through
 * it, no weight of its regions, no years lived there, nothing to map.
 */
interface Reading {
  facts: Map<string, number[]>;
  maps: Record<string, PlaceMap>;
  /** A map by the folded key: the place written otherwise (decomposed) is the same place; none for a place skipped. */
  mapOf: (key: string) => PlaceMap | undefined;
  /** The map of a place skipped too (the app is told its regions). */
  anyMapOf: (key: string) => PlaceMap | undefined;
  catalogs: Map<string, Catalog | undefined>;
  catalog: (id: string) => Catalog | undefined;
  local: LocalEvent[];
  skips: Skips;
  /** The places of the facts the person skipped, with their years. */
  skippedFacts: Map<string, number[]>;
  skippedRegions: Set<string>;
}

function reading(tree: Tree, shared: string | undefined): Reading {
  const all = factPlaces(tree);
  const skips = readSkips(tree);
  const skippedFold = new Set(skips.places.map((p) => foldText(p.place)));
  const skipped = (k: string) => skippedFold.size > 0 && skippedFold.has(foldText(k));
  const facts = new Map([...all].filter(([k]) => !skipped(k)));
  const skippedFacts = new Map([...all].filter(([k]) => skipped(k)));
  const maps = readPlaces(tree);
  const folded = new Map<string, PlaceMap>();
  for (const [k, v] of Object.entries(maps)) folded.set(foldText(k), v);
  const catalogs = new Map<string, Catalog | undefined>();
  const catalog = (id: string) => {
    if (!catalogs.has(id)) catalogs.set(id, shared ? readCatalog(shared, id) : undefined);
    return catalogs.get(id);
  };
  const anyMapOf = (k: string) => maps[k] ?? folded.get(foldText(k));
  return {
    facts,
    maps,
    mapOf: (k) => (skipped(k) ? undefined : anyMapOf(k)),
    anyMapOf,
    catalogs,
    catalog,
    local: readLocal(tree).events,
    skips,
    skippedFacts,
    skippedRegions: new Set(skips.regions.map((x) => x.region)),
  };
}

/** A place mapped by the agent or the person: not waiting to be mapped (one the person asked to be determined again is). */
function mapped(m: PlaceMap | undefined): m is PlaceMap {
  return !!m && m.state !== "redo";
}

/** A place's state: mapped and every region's catalog done (undefined), waiting for either (pending), or not located. */
function placeState(r: Reading, key: string): "pending" | "unlocated" | undefined {
  const m = r.mapOf(key);
  if (!m) return "pending";
  if (m.state === "unlocated") return "unlocated";
  if (!m.regions.length) return "pending";
  return m.regions.every((g) => !!r.catalog(g.id)?.done) ? undefined : "pending";
}

/** The places of the tree's facts waiting: not mapped yet, or a region of theirs without a finished catalog. */
export function pendingPlaces(tree: Tree, shared: string | undefined): string[] {
  const r = reading(tree, shared);
  return [...r.facts.keys()].filter((k) => placeState(r, k) === "pending").sort((a, b) => a.localeCompare(b));
}

/** The regions the tree's places belong to (any years) — a place the person skipped not counted. */
export function regionsOfTree(tree: Tree): string[] {
  const skipped = new Set(readSkips(tree).places.map((p) => foldText(p.place)));
  return [...new Set(Object.entries(readPlaces(tree)).flatMap(([k, m]) => (skipped.has(foldText(k)) ? [] : m.regions.map((g) => g.id))))].filter(regionIdOk).sort();
}

/** The other names of a place: the research's place of that name (other languages, historical names) and those mapped. */
function alsoOf(tree: Tree, records: Place[], key: string, m: PlaceMap | undefined): string[] {
  const f = foldText(key);
  const names = new Set<string>();
  for (const p of records) if (!p.retracted && p.names.some((n) => foldText(n.name) === f)) for (const n of p.names) names.add(lineValue(n.name));
  for (const a of m?.also ?? []) names.add(lineValue(a));
  const seen = new Set([f]);
  const out: string[] = [];
  for (const n of names) {
    const k = foldText(n);
    if (!n || seen.has(k)) continue;
    seen.add(k);
    out.push([...n].slice(0, ALSO_CHARS).join(""));
    if (out.length >= ALSO_MAX) break;
  }
  return out;
}

/** An event's ID at the end of its chain of replacements; undefined when it ends taken back with nothing in its place. */
function resolveEvent(id: string, live: Set<string>, replaced: Map<string, string>): string | undefined {
  const seen = new Set<string>();
  let cur: string | undefined = id;
  while (cur && !live.has(cur)) {
    if (seen.has(cur)) return undefined;
    seen.add(cur);
    cur = replaced.get(cur);
  }
  return cur;
}

/** A person hidden at: the one merged into, none when removed. */
function resolvePerson(tree: Tree, id: string): string | undefined {
  const seen = new Set<string>();
  let p = tree.get<Person>(id);
  while (p?.mergedInto && !seen.has(p.id)) {
    seen.add(p.id);
    p = tree.get<Person>(p.mergedInto);
  }
  return p && !p.retracted ? p.id : undefined;
}

/** The sessions on tasks of the history: one at work (running), and when the last one ended. */
export function historySessions(tree: Tree): { running: boolean; ended?: string } {
  const tasks = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  let running = false;
  let ended: string | undefined;
  for (const s of tree.list<Session>("session")) {
    const t = s.task ? tasks.get(s.task) : undefined;
    if (!t || !forHistory(t)) continue;
    if (s.state === "open") running = true;
    else if (s.ended && (!ended || s.ended > ended)) ended = s.ended;
  }
  return { running, ...(ended ? { ended } : {}) };
}

/** Held by another tree within its days (F2: one tree builds a region's catalog). */
export function heldElsewhere(c: Pick<Catalog, "holder" | "done"> | undefined, treeId: string, now = Date.now()): boolean {
  if (!c?.holder || c.holder.tree === treeId || c.done) return false;
  const since = Date.parse(c.holder.since);
  return Number.isFinite(since) && now - since < HOLD_DAYS * 86_400_000;
}

/**
 * The answer the Strom app reads (the bridge's GET /history; ZADANI_VYZKUM_co-predek-zazil.md §B–§E): the events at the
 * places of the tree's facts — a region's by the years each place belonged to it, the local ones by their source's place —
 * the places with their state, what the person hid (moved to what replaced it), and the state of the search. Read in an
 * archive too; the experiment off, what was found stays.
 */
export function historyAnswer(tree: Tree, shared: string | undefined, settings: Settings = new Settings(tree.env, {}), limits: { events?: number; places?: number } = {}): HistoryAnswer {
  const maxEvents = limits.events ?? MAX_EVENTS;
  const maxPlaces = limits.places ?? MAX_PLACES;
  const on = historyOn(tree, settings);
  const r = reading(tree, shared);
  const records = tree.list<Place>("place");
  const sources = new Map(tree.list<Source>("source").map((s) => [s.id, s]));
  const events = new Map<string, AppEvent>();
  const live = new Set<string>();
  const replaced = new Map<string, string>();
  const places = new Map<string, AppPlace>();

  // how many of the tree's places each region has: the one of fewer is the nearer (a land within its state)
  const reach = new Map<string, number>();
  for (const m of Object.values(r.maps)) for (const g of m.regions) reach.set(g.id, (reach.get(g.id) ?? 0) + 1);
  // the region's events of each mapped place, by the years it belonged to the region; the same event of two of its
  // regions (a land's catalog holds its state's events: the same kind and years, the same day or none) once — the
  // nearer region's
  // a place's own events (its record's catalog, core/placehistory.ts) are the nearest of all: one of its region of the
  // same kind and years goes
  const placeCatalogs = new Map<string, PlaceCatalog | undefined>();
  const placeCatalog = (id: string) => {
    if (!placeCatalogs.has(id)) {
      const p = shared ? placeRecord(tree, id) : undefined;
      placeCatalogs.set(id, p ? readPlaceCatalog(shared!, placeKeyOf(tree, p)) : undefined);
    }
    return placeCatalogs.get(id);
  };
  const regional = (m: PlaceMap | undefined, key: string, own?: { id: string; c: PlaceCatalog | undefined }): string[] => {
    const found: { e: RegionEvent; of: string; make: () => AppEvent; reach: number }[] = [];
    for (const e of own?.c?.events ?? []) if (!e.retracted) found.push({ e, of: own!.c!.place.key, make: () => appPlaceEvent(e, own!.c!, key, own!.id), reach: -1 });
    if (m && m.state !== "unlocated")
      for (const g of m.regions) {
        const c = r.catalog(g.id);
        for (const e of c?.events ?? []) {
          if (e.retracted) continue;
          if (!inRegion(e, g)) continue;
          found.push({ e, of: g.id, make: () => appRegionEvent(e, c!), reach: reach.get(g.id) ?? 0 });
        }
      }
    const nearer = [...found].sort((a, b) => a.reach - b.reach);
    const kept: typeof found = [];
    for (const x of nearer) {
      const same = kept.some((k) => k.of !== x.of && k.e.kind === x.e.kind && k.e.from === x.e.from && k.e.to === x.e.to && (!k.e.date || !x.e.date || k.e.date === x.e.date));
      if (!same) kept.push(x);
    }
    const keep = new Set(kept.map((x) => x.e.id));
    const ids: string[] = [];
    for (const x of found) {
      if (!keep.has(x.e.id)) continue;
      if (!events.has(x.e.id)) events.set(x.e.id, x.make());
      ids.push(x.e.id);
    }
    return ids;
  };

  // the local events: their source still the research's, its place one of the tree's (or its own name)
  const localAt = new Map<string, string[]>();
  const keys = [...r.facts.keys()];
  const skippedKeys = [...r.skippedFacts.keys()];
  const byFold = new Map<string, string>();
  for (const k of [...keys, ...skippedKeys]) byFold.set(foldText(k), k);
  for (const k of keys) for (const a of alsoOf(tree, records, k, r.mapOf(k))) if (!byFold.has(foldText(a))) byFold.set(foldText(a), k);
  for (const e of r.local) {
    if (e.retracted) {
      if (e.retracted.replacedBy) replaced.set(e.id, e.retracted.replacedBy);
      continue;
    }
    const s = sources.get(e.local.source);
    if (!s || s.retracted) continue;
    const key = byFold.get(foldText(e.place)) ?? e.place;
    events.set(e.id, appLocalEvent(e));
    localAt.set(key, [...(localAt.get(key) ?? []), e.id]);
  }

  const people = peopleAt(tree);
  const recordOf = placeRecordOf(records);
  const own = placeHistories(tree, shared, settings);
  for (const key of new Set([...keys, ...skippedKeys, ...localAt.keys()])) {
    const skip = r.skippedFacts.has(key);
    const m = skip ? r.anyMapOf(key) : r.mapOf(key);
    const fact = r.facts.has(key) || skip;
    const state = r.facts.has(key) ? placeState(r, key) : !skip && m?.state === "unlocated" ? "unlocated" : undefined;
    const id = recordOf(key);
    // a place skipped: no event of a region or its own through it (the local ones read in the tree's sources stay)
    const ids = [...new Set([...(skip ? [] : regional(m, key, id ? { id, c: placeCatalog(id) } : undefined)), ...(localAt.get(key) ?? [])])];
    if (!fact && !ids.length && !state) continue;
    const also = alsoOf(tree, records, key, m);
    const persons = people.get(foldText(key))?.size ?? 0;
    const history = id && fact ? own(id) : undefined;
    // why: the unlocated one's first (the app shows one sentence), else why its own history waits
    const why = m?.state === "unlocated" && m.why ? m.why : history?.why;
    places.set(key, {
      events: ids,
      ...(also.length ? { also } : {}),
      ...(state ? { state } : {}),
      ...(m?.regions.length ? { regions: m.regions } : {}),
      ...(fact ? { persons } : {}),
      ...(why ? { why } : {}),
      ...(m?.manual ? { manual: true as const } : {}),
      ...(m?.state === "redo" ? { redo: true as const, ...(m.note ? { note: m.note } : {}) } : {}),
      ...(skip ? { skip: true as const } : {}),
      ...(id ? { id } : {}),
      ...(history ? { history: history.history, ...(history.at ? { at: history.at } : {}), area: history.area } : {}),
    });
  }
  // the replacements of the places' own catalogs
  for (const c of placeCatalogs.values()) for (const e of c?.events ?? []) if (e.retracted?.replacedBy) replaced.set(e.id, e.retracted.replacedBy);
  // the replacements, of every catalog read (only now are they all read)
  for (const c of r.catalogs.values()) for (const e of c?.events ?? []) if (e.retracted?.replacedBy) replaced.set(e.id, e.retracted.replacedBy);
  // the 2 PLAC key of a place pending though no region of it is known yet: in `places` already; counted
  const pending = keys.filter((k) => placeState(r, k) === "pending").length;

  // the regions of the tree's places (a place skipped too): their state, order, weight, events — never limited
  const regions = appRegions(tree, shared, settings, r, on, events, readHidden(tree), (id) => resolveEvent(id, new Set(events.keys()), replaced));

  // the places with events first, then those waiting, then those not located, then the rest — within the limits
  const order = (p: AppPlace) => (p.events.length ? 0 : p.state === "pending" ? 1 : p.state === "unlocated" ? 2 : 3);
  let sorted = [...places].sort((a, b) => order(a[1]) - order(b[1]) || a[0].localeCompare(b[0]));
  let truncated = false;
  if (sorted.length > maxPlaces) {
    sorted = sorted.slice(0, maxPlaces);
    truncated = true;
  }
  const used = new Set(sorted.flatMap(([, p]) => p.events));
  let list = [...events.values()].filter((e) => used.has(e.id));
  if (list.length > maxEvents) {
    // the events of the most places kept
    const count = new Map<string, number>();
    for (const [, p] of sorted) for (const id of p.events) count.set(id, (count.get(id) ?? 0) + 1);
    list = list.sort((a, b) => (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0) || a.id.localeCompare(b.id)).slice(0, maxEvents);
    truncated = true;
    const kept = new Set(list.map((e) => e.id));
    for (const [, p] of sorted) p.events = p.events.filter((id) => kept.has(id));
  }
  list.sort((a, b) => a.from - b.from || a.to - b.to || a.id.localeCompare(b.id));
  for (const e of list) live.add(e.id);
  // every event the research has (sent or not) for the chain of replacements: a hide on one replaced moves on
  const known = new Set<string>([...events.keys()]);
  const hidden: HistoryAnswer["hidden"] = [];
  const seen = new Set<string>();
  for (const h of readHidden(tree)) {
    let event: string | undefined;
    if (h.event !== undefined) {
      event = resolveEvent(h.event, known, replaced);
      if (!event || !live.has(event)) continue;
    } else if (!h.region || !regions[h.region]) continue;
    const person = h.person !== undefined ? resolvePerson(tree, h.person) : undefined;
    if (h.person !== undefined && !person) continue;
    const k = hideKey(event, h, person);
    if (seen.has(k)) continue;
    seen.add(k);
    hidden.push(hideRead(event, h, person));
  }

  const search = searchState(tree, r, on, pending);
  const mapping = mappingNow(tree, r);
  const suggest = suggestPlaces(tree, shared, settings);
  return {
    state: { on, ...search, pending, rev: historyRev(tree, shared, settings), ...(truncated ? { truncated: true as const } : {}), ...(mapping ? { mapping } : {}) },
    lang: tree.lang,
    events: list,
    places: Object.fromEntries(sorted),
    regions,
    hidden,
    deleted: deletedEvents(tree, shared).slice(0, maxEvents),
    ...(suggest.length ? { suggest } : {}),
  };
}

/** The people of the tree with a fact at each place (by its folded key): a family's fact counts for its partners. */
export function peopleAt(tree: Tree): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const count = (who: string[], e: Person["events"][number]) => {
    if (!factWritten(e) || !e.place) return;
    const key = foldText(lineValue(e.place));
    if (!key) return;
    const s = out.get(key) ?? new Set<string>();
    out.set(key, s);
    for (const p of who) s.add(p);
  };
  const persons = tree.list<Person>("person").filter((p) => !p.retracted);
  const alive = new Set(persons.map((p) => p.id));
  for (const p of persons) for (const e of p.events) count([p.id], e);
  for (const f of tree.list<Family>("family")) {
    const who = f.partners.filter((p) => alive.has(p));
    if (who.length) for (const e of f.events) count(who, e);
  }
  return out;
}

/**
 * The research's place record of a place of the facts: the one record that bears its name (any of its names, any
 * accent), else the one that bears its first part ("Lhota, okres Horní" → "Lhota"); none when two do.
 */
export function placeRecordOf(records: Place[]): (key: string) => string | undefined {
  const live = records.filter((p) => !p.retracted);
  const named = (f: string) => live.filter((p) => p.names.some((n) => foldText(n.name) === f));
  return (key) => {
    for (const f of [foldText(key), foldText(key.split(",")[0]!.trim())]) {
      const found = named(f);
      if (found.length === 1) return found[0]!.id;
      if (found.length > 1) return undefined;
    }
    return undefined;
  };
}

/** A session mapping the places of the facts at work now: so many mapped of so many (the app's header). */
function mappingNow(tree: Tree, r: Reading): { mapped: number; mappable: number } | undefined {
  const tasks = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  const at = tree.list<Session>("session").some((s) => s.state === "open" && !!s.task && tasks.get(s.task)?.origin === HISTORY_PLACES_ORIGIN);
  if (!at) return undefined;
  const keys = [...r.facts.keys()];
  return { mapped: keys.filter((k) => mapped(r.mapOf(k))).length, mappable: keys.length };
}

/**
 * The regions of the tree's places for the app (R1; a place skipped too): each region's state — skipped by the person,
 * finished (with its gaps not looked at and the task filling them), at work, none (the history off, no task yet),
 * waiting (an archive, another tree builds it), covered (its lands hold it: last, closed without a search), queued —
 * its place in the order strom run takes the tasks of the regions, the one asked first, its events at the tree's places
 * and those hidden, and its weight (regionOrder).
 */
function appRegions(
  tree: Tree,
  shared: string | undefined,
  settings: Settings,
  r: Reading,
  on: boolean,
  events: Map<string, AppEvent>,
  hides: Hide[],
  resolve: (id: string) => string | undefined,
): Record<string, AppRegion> {
  const ids = [...new Set([...r.facts.keys(), ...r.skippedFacts.keys()].flatMap((k) => r.anyMapOf(k)?.regions.map((g) => g.id) ?? []))].filter(regionIdOk).sort();
  if (!ids.length) return {};
  const tasks = tree.list<Task>("task").filter((t) => forHistory(t) && LIVE_STATES.has(t.state));
  const atWork = new Set(tree.list<Session>("session").filter((s) => s.state === "open" && s.task).map((s) => s.task!));
  const own = new Map<string, Task>();
  const fills = new Map<string, Task>();
  for (const t of tasks) {
    const region = regionOfTask(t);
    if (region) (forGaps(t) ? fills : own).set(region, t);
  }
  const held = historyHeld(tree, shared, settings);
  const turn = on ? historyTurn(tree, shared, settings) : undefined;
  const rank = historyOrder(turn);
  const queue = tasks
    .filter((t) => t.origin !== HISTORY_PLACES_ORIGIN && (t.state === "open" || t.state === "doing") && !held(t))
    .sort((a, b) => rank(a) - rank(b) || a.created.localeCompare(b.created));
  const orderOf = new Map(queue.map((t, i) => [t.id, i + 1]));
  const weights = new Map(regionOrder(tree, shared).map((w) => [w.id, w]));
  // the events the person hid, by region
  const hiddenOf = new Map<string, Set<string>>();
  const wholly = new Set<string>();
  for (const h of hides) {
    if (h.event === undefined) {
      if (h.region) wholly.add(h.region);
      continue;
    }
    const id = resolve(h.event);
    const region = id ? events.get(id)?.region?.id : undefined;
    if (!region) continue;
    const s = hiddenOf.get(region) ?? new Set<string>();
    hiddenOf.set(region, s);
    s.add(id!);
  }
  const archive = actsAsArchive(tree);
  const out: Record<string, AppRegion> = {};
  for (const id of ids) {
    const c = r.catalog(id);
    const w = weights.get(id);
    const task = own.get(id);
    const fill = fills.get(id);
    // the catalog's events not taken back (those hidden too); hidden: those hidden in this tree (all of a region hidden)
    const n = c?.events.filter((e) => !e.retracted).length ?? 0;
    // its place in the order: a finished region's by its gaps' task alone
    const counted = c?.done ? fill : task;
    const order = counted ? orderOf.get(counted.id) : undefined;
    const base = {
      name: c?.region.name ?? {},
      events: n,
      hidden: wholly.has(id) ? n : (hiddenOf.get(id)?.size ?? 0),
      places: w?.places ?? 0,
      persons: w?.persons ?? 0,
      facts: w?.facts ?? 0,
      ...(order !== undefined ? { order } : {}),
      ...(turn?.asked?.region === id ? { first: true as const } : {}),
    };
    let state: Pick<AppRegion, "state" | "at" | "why" | "nobody" | "covered" | "gaps" | "fill">;
    if (r.skippedRegions.has(id)) state = { state: "skipped" };
    else if (c?.done) {
      const gaps = regionGaps(tree, shared, id, r);
      state = { state: "done", at: c.done.at, ...(gaps.length ? { gaps } : {}), ...(fill ? { fill: atWork.has(fill.id) ? ("running" as const) : ("queued" as const) } : {}) };
    } else if (task && atWork.has(task.id)) state = { state: "running" };
    else if (!on) state = { state: "none" };
    else if (archive) state = { state: "waiting", why: phrase(tree.lang, "history.why.archive") };
    else if (heldElsewhere(c, tree.config.id)) state = { state: "waiting", why: phrase(tree.lang, "history.why.held", { region: regionName(c, tree.lang, id) }) };
    else if (regionPeriod(tree, id, r).nobody) state = { state: "waiting", why: phrase(tree.lang, "history.why.nobody", { region: regionName(c, tree.lang, id) }), nobody: true };
    else if (w?.covered?.length) state = { state: "covered", covered: w.covered };
    else state = { state: task ? "queued" : "none" };
    out[id] = { ...base, ...state };
  }
  return out;
}

/** none (nothing looked for yet), running (a session of history at work), waiting (with why), done. */
function searchState(tree: Tree, r: Reading, on: boolean, pending: number): { search: SearchState; why?: string; at?: string } {
  const s = historySessions(tree);
  let at = s.ended;
  for (const c of r.catalogs.values()) if (c?.done && (!at || c.done.at > at)) at = c.done.at;
  const when = at ? { at } : {};
  if (s.running) return { search: "running", ...when };
  if (on && pending > 0) {
    if (actsAsArchive(tree)) return { search: "waiting", why: phrase(tree.lang, "history.why.archive"), ...when };
    const held = [...new Set(Object.values(r.maps).flatMap((m) => m.regions.map((g) => g.id)))].map((id) => r.catalog(id)).find((c) => heldElsewhere(c, tree.config.id));
    if (held) return { search: "waiting", why: phrase(tree.lang, "history.why.held", { region: held.region.name[tree.lang] ?? held.region.name.en ?? held.region.id }), ...when };
  }
  const found = r.local.length > 0 || [...r.catalogs.values()].some((c) => !!c?.events.length);
  if (!at && !found) return { search: "none" };
  return { search: "done", ...when };
}

/**
 * A short fingerprint of all the answer is made of — the catalogs of the tree's regions, its local events, places and
 * hides, the experiment on or off, the tree's last commit (its facts, its sessions) — from the files' times and sizes
 * alone: cheap for /status (the app reads GET /history when it changes; a catalog changes outside the tree's commits).
 */
export function historyRev(tree: Tree, shared: string | undefined, settings: Settings = new Settings(tree.env, {})): string {
  const stat = (file: string) => {
    try {
      const s = fs.statSync(file);
      return `${s.size}:${Math.round(s.mtimeMs)}`;
    } catch {
      return "-";
    }
  };
  const parts = [historyOn(tree, settings) ? "on" : "off", settings.historyPlacesAuto(tree.config) ? "auto" : "asked"];
  for (const rel of [PLACES_FILE, LOCAL_FILE, HIDDEN_FILE, SKIP_FILE, FIRST_FILE]) parts.push(stat(path.join(tree.root, ...rel.split("/"))));
  if (shared) {
    for (const id of regionsOfTree(tree)) parts.push(`${id}=${stat(regionFile(shared, id))}`);
    // the places' own catalogs (core/placehistory.ts): of every place record (a record's coordinates change its key)
    for (const p of tree.list<Place>("place")) if (!p.retracted) parts.push(`${p.id}=${stat(placeFile(shared, placeKeyOf(tree, p)))}`);
  }
  parts.push(headStat(tree.root, stat));
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

/** The tree's last commit by its files (no git process): HEAD, the branch it names, the packed refs. */
function headStat(root: string, stat: (f: string) => string): string {
  const git = path.join(root, ".git");
  let ref = "";
  try {
    ref = fs.readFileSync(path.join(git, "HEAD"), "utf8").trim();
  } catch {
    return "nohead";
  }
  const m = /^ref:\s*(.+)$/u.exec(ref);
  return m ? `${m[1]}=${stat(path.join(git, ...m[1]!.split("/")))}+${stat(path.join(git, "packed-refs"))}` : ref;
}

// ── status for the agent ───────────────────────────────────────────────────

export interface HistoryStatus {
  on: boolean;
  places: { total: number; pending: string[]; unlocated: number; mapped: number; skipped: number; manual: number };
  /**
   * period: the years its events are looked for in for this tree (regionPeriod); gaps: a finished catalog's years of the
   * tree's people with no event, not looked at yet (regionGaps); added: its years of the period never looked through (regionNew);
   * nobody: nobody of the tree lived there in its years — no period, nothing looked for (K2.7a).
   */
  regions: { id: string; name?: Texts; events: number; retracted: number; deleted: number; done?: string; heldBy?: string; tried: number; period: Gap[]; nobody?: true; gaps?: Gap[]; added?: Gap[]; skipped?: true }[];
  local: { events: number; retracted: number; deleted: number };
  /** The places' own history (core/placehistory.ts): each place record of the facts with a catalog, a task or an ask. */
  ownPlaces: { id: string; key: string; history: PlaceHistoryState; events: number; deleted: number; done?: string; heldBy?: string }[];
  hidden: { total: number; byKind: Record<string, number> };
}

/** What strom history status says: on?, the places waiting, the tree's regions and their catalogs, the hides by kind. */
export function historyStatus(tree: Tree, shared: string | undefined, settings?: Settings): HistoryStatus {
  const r = reading(tree, shared);
  const keys = [...r.facts.keys()];
  const pending = keys.filter((k) => placeState(r, k) === "pending").sort((a, b) => a.localeCompare(b));
  const regions = regionsOfTree(tree).map((id) => {
    const c = r.catalog(id);
    return {
      id,
      ...(c ? { name: c.region.name } : {}),
      events: c?.events.filter((e) => !e.retracted).length ?? 0,
      retracted: c?.events.filter((e) => e.retracted && !deletedByPerson(e)).length ?? 0,
      deleted: c?.events.filter(deletedByPerson).length ?? 0,
      ...(c?.done ? { done: c.done.at } : {}),
      ...(c && heldElsewhere(c, tree.config.id) ? { heldBy: c.holder!.tree } : {}),
      tried: c?.tried.length ?? 0,
      ...((p) => ({ period: p.spans, ...(p.nobody ? { nobody: true as const } : {}) }))(regionPeriod(tree, id, r)),
      ...(c?.done ? { gaps: regionGaps(tree, shared, id, r), added: regionNew(tree, shared, id, r) } : {}),
      ...(r.skippedRegions.has(id) ? { skipped: true as const } : {}),
    };
  });
  const kindOf = new Map<string, string>();
  for (const c of r.catalogs.values()) for (const e of c?.events ?? []) kindOf.set(e.id, e.kind);
  for (const e of r.local) kindOf.set(e.id, e.kind);
  const hides = readHidden(tree);
  const byKind: Record<string, number> = {};
  for (const h of hides) {
    if (h.event === undefined) continue; // a whole region: no kind
    const k = kindOf.get(h.event) ?? (shared ? eventCatalog(shared, h.event)?.events.find((e) => e.id === h.event)?.kind : undefined) ?? "other";
    byKind[k] = (byKind[k] ?? 0) + 1;
  }
  return {
    on: historyOn(tree, settings),
    places: { total: keys.length, pending, unlocated: keys.filter((k) => placeState(r, k) === "unlocated").length, mapped: keys.filter((k) => mapped(r.mapOf(k))).length, skipped: r.skippedFacts.size, manual: keys.filter((k) => !!r.mapOf(k)?.manual).length },
    regions,
    local: { events: r.local.filter((e) => !e.retracted).length, retracted: r.local.filter((e) => e.retracted && !deletedByPerson(e)).length, deleted: r.local.filter(deletedByPerson).length },
    ownPlaces: ownPlacesOf(tree, shared, settings ?? new Settings(tree.env, {})),
    hidden: { total: hides.length, byKind },
  };
}

/** The place records with a history of their own (strom history status): a catalog, a task or an ask. */
function ownPlacesOf(tree: Tree, shared: string | undefined, settings: Settings): HistoryStatus["ownPlaces"] {
  const states = placeHistories(tree, shared, settings);
  const out: HistoryStatus["ownPlaces"] = [];
  for (const p of tree.list<Place>("place")) {
    if (p.retracted) continue;
    const st = states(p.id);
    const key = placeKeyOf(tree, p);
    const c = shared ? readPlaceCatalog(shared, key) : undefined;
    if (!st || (st.history === "none" && !c)) continue;
    out.push({
      id: p.id,
      key,
      history: st.history,
      events: c?.events.filter((e) => !e.retracted).length ?? 0,
      deleted: c?.events.filter(deletedByPerson).length ?? 0,
      ...(c?.done ? { done: c.done.at } : {}),
      ...(c && heldElsewhere(c, tree.config.id) ? { heldBy: c.holder!.tree } : {}),
    });
  }
  return out;
}

/** A fact place of the tree by its words (decomposed, other spaces): the key as the GEDCOM writes it, or undefined. */
export function factPlaceKey(tree: Tree, place: string): string | undefined {
  const facts = factPlaces(tree);
  const key = lineValue(place);
  if (facts.has(key)) return key;
  const f = foldText(key);
  return [...facts.keys()].find((k) => foldText(k) === f);
}

/** For pack/unpack: catalogs merged — events only added (union by ID), never one written over; the higher `next`. */
export function mergeCatalog(shared: string, given: Catalog): { added: number } {
  requireRegionId(given.region?.id ?? "");
  if (!Array.isArray(given.events)) throw new StromError(`the catalog of ${given.region.id} is damaged`);
  return withCatalogs(shared, () => {
    const had = readCatalog(shared, given.region.id);
    if (!had) {
      // another computer's tree held it there: here nobody does
      const { holder: _held, ...rest } = given;
      writeCatalog(shared, { ...rest, tried: Array.isArray(given.tried) ? given.tried : [] });
      return { added: given.events.length };
    }
    const ids = new Set(had.events.map((e) => e.id));
    const more = given.events.filter((e) => typeof e?.id === "string" && !ids.has(e.id));
    // the gaps another computer's tree looked at: not looked at here again
    const seen = new Set((had.gaps ?? []).map((g) => `${g.from}-${g.to}-${g.tree}`));
    const gaps = (Array.isArray(given.gaps) ? given.gaps : []).filter((g) => Number.isInteger(g?.from) && Number.isInteger(g?.to) && !seen.has(`${g.from}-${g.to}-${g.tree}`));
    // the years another computer's tree looked through: neither
    const known = new Set((had.searched ?? []).map((g) => `${g.from}-${g.to}-${g.tree}`));
    const searched = (Array.isArray(given.searched) ? given.searched : []).filter((g) => Number.isInteger(g?.from) && Number.isInteger(g?.to) && !known.has(`${g.from}-${g.to}-${g.tree}`));
    if (!more.length && !gaps.length && !searched.length) return { added: 0 };
    if (gaps.length) had.gaps = [...(had.gaps ?? []), ...gaps];
    if (searched.length) had.searched = [...(had.searched ?? []), ...searched];
    had.events.push(...more);
    had.events.sort((a, b) => a.id.localeCompare(b.id));
    const top = Math.max(0, ...had.events.map((e) => Number(/-(\d+)$/.exec(e.id)?.[1] ?? 0)));
    had.next = Math.max(had.next, given.next ?? 0, top + 1);
    writeCatalog(shared, had);
    return { added: more.length };
  });
}

// ── the tasks of history (F2) ──────────────────────────────────────────────

/** States of a task still to be worked on (or at work). */
const LIVE_STATES = new Set<Task["state"]>(["open", "doing", "parked", "waiting"]);
/** At most so many places named in the `where` of the places' task (the rest come in the next one). */
const PLACES_NAMED = 300;

/** The places of the tree's facts not mapped yet (a place not located counts as mapped): as the GEDCOM writes them. */
export function unmappedPlaces(tree: Tree): string[] {
  const r = reading(tree, undefined);
  return [...r.facts.keys()].filter((k) => !mapped(r.mapOf(k))).sort((a, b) => a.localeCompare(b));
}

/** The person's notes for the places to be determined again (strom history assign --redo --note): place → note. */
export function placeNotes(tree: Tree): Map<string, string> {
  const r = reading(tree, undefined);
  const out = new Map<string, string>();
  for (const k of r.facts.keys()) {
    const m = r.mapOf(k);
    if (m?.state === "redo" && m.note) out.set(k, m.note);
  }
  return out;
}

/** A region's name in a language (else English, else its ID). */
export function regionName(c: Pick<Catalog, "region"> | undefined, lang: string, id = c?.region.id ?? ""): string {
  return c?.region.name[lang] ?? c?.region.name.en ?? id;
}

/** The region of a task of history (history:region:<id>, its gaps history:gaps:<id>), else undefined. */
export function regionOfTask(t: Pick<Task, "origin">): string | undefined {
  if (typeof t.origin !== "string") return undefined;
  for (const prefix of [HISTORY_REGION_ORIGIN, HISTORY_GAPS_ORIGIN]) if (t.origin.startsWith(prefix)) return t.origin.slice(prefix.length) || undefined;
  return undefined;
}

/** History is looked for from this year at the earliest. */
const EARLIEST_YEAR = 1600;
/**
 * A person's last fact in a region in so many recent years: they live there still — their span reaches this year. The
 * facts of the living are mostly a birth or a marriage, often decades back (nobody writes down the years since); one
 * generation (about 30 years) holds those of the youngest people of a tree, while a stay that ended long ago (a
 * grandfather a few years at a war) keeps only its own years.
 */
export const PRESENT_YEARS = 30;

/** A region's period for a tree (K2.7): the spans its history is looked for in, their first and last year, its places. */
export interface RegionPeriod {
  from: number;
  to: number;
  /** The years the tree's people lived there (regionSpans); one span of the places' years when no fact there has a year. */
  spans: Gap[];
  /** No fact at its places has a year: the years those places belonged to it (to the last of them, else to this year). */
  undated?: true;
  /** Its places' facts have years, none of them while the places belonged to it: nobody of the tree lived there in its years — no period, nothing looked for (K2.7a). */
  nobody?: true;
  places: { place: string; from?: number; to?: number; years: number[]; dated: boolean }[];
}

/**
 * The period the events of a region are looked for in, for this tree (K2.7, Milan 28 Oct 2026 — a grandfather a few
 * years at a war in Italy: those years, not to this one): the years its people lived at its places (regionSpans: each
 * person's facts there, LIVED_MARGIN before and after, to this year only when they reach the last PRESENT_YEARS; the
 * spans apart when more than GAP_YEARS lie between them) — this tree's places only (each tree that shares the region
 * adds its own years: an extension of a finished catalog, regionNew). Facts there with years, none in the years its
 * places belonged to it (a place of facts to 1940 in a state from 1945): nobody of the tree lived there then — no period
 * at all (K2.7a, Milan 28 Oct 2026). Only places whose facts have no year at all give the years they belonged to it,
 * from the oldest (never before 1600) to the region's end (to this year when it lasts).
 */
export function regionPeriod(tree: Tree, region: string, read?: Reading): RegionPeriod {
  const r = read ?? reading(tree, undefined);
  const places: RegionPeriod["places"] = [];
  for (const [key, years] of r.facts) {
    const m = r.mapOf(key);
    for (const link of m?.regions ?? []) {
      if (link.id !== region) continue;
      const inside = years.filter((y) => y >= (link.from ?? -Infinity) && y <= (link.to ?? Infinity));
      places.push({ place: key, ...(link.from !== undefined ? { from: link.from } : {}), ...(link.to !== undefined ? { to: link.to } : {}), years: inside, dated: years.length > 0 });
    }
  }
  places.sort((a, b) => a.place.localeCompare(b.place));
  const spans = regionSpans(tree, region, r);
  if (spans.length) return { from: spans[0]!.from, to: spans.at(-1)!.to, spans, places };
  const now = new Date().getFullYear();
  const undated = places.filter((p) => !p.dated);
  if (!undated.length) {
    const from = oldestYear(places, now);
    return { from, to: from, spans: [], nobody: true, places };
  }
  const to = Math.min(now, Math.max(...undated.map((p) => p.to ?? now)));
  const from = oldestYear(undated, to);
  return { from, to, spans: [{ from, to }], undated: true, places };
}

/** The oldest year of a region's places (their facts' years, else the year a place came to it; never before 1600). */
function oldestYear(places: RegionPeriod["places"], to: number): number {
  const oldest = Math.min(...places.flatMap((p) => (p.years.length ? p.years : p.from !== undefined ? [p.from] : [])));
  return Number.isFinite(oldest) ? Math.min(to, Math.max(EARLIEST_YEAR, oldest)) : EARLIEST_YEAR;
}

/**
 * The period a region's catalog finished before its years were kept was looked through for: what the brief said then —
 * the oldest year of the facts of the tree that finished it (this tree's, when it is that one) to the year it was
 * finished; for another tree's, from 1600 (nothing of its years known: nothing raised again).
 */
export function legacySpan(c: Pick<Catalog, "done" | "region">, tree: Tree | undefined, read?: Reading): Gap {
  const to = Number(c.done?.at.slice(0, 4)) || new Date().getFullYear();
  if (!tree || c.done?.tree !== tree.config.id) return { from: EARLIEST_YEAR, to };
  return { from: Math.min(to, oldestYear(regionPeriod(tree, c.region.id, read).places, to)), to };
}

/** The years a region's catalog was looked through for (searched, else legacySpan; the gaps looked at too), joined. */
export function searchedSpans(tree: Tree, c: Catalog | undefined, read?: Reading): Gap[] {
  if (!c) return [];
  const own: Gap[] = c.searched ?? (c.done ? [legacySpan(c, tree, read)] : []);
  return union([...own, ...(c.gaps ?? [])].map((g) => ({ from: g.from, to: g.to })));
}

// ── the gaps of a finished catalog (K2.6) ──────────────────────────────────

/** A gap: more years than so many in a row the tree's people lived in a region with no event of its catalog. */
export const GAP_YEARS = 15;
/** A person lived in a region so many years before the first fact there and after the last. */
export const LIVED_MARGIN = 5;
/** An event of so many years or more (a state, a period of rule) marks only its beginning and its end, not the years between. */
const LONG_EVENT = GAP_YEARS;
/** About one event in so many years of a gap: what a session filling it looks for. */
export const GAP_DENSITY = 12;

/** A gap's years as a task and the brief write them: 1870–1913. */
export function gapText(g: Gap): string {
  return g.from === g.to ? String(g.from) : `${g.from}–${g.to}`;
}

/** The gaps a task of them was raised for (its `where`: 1870–1913 each). */
export function gapsOfTask(t: Pick<Task, "where">): Gap[] {
  const out: Gap[] = [];
  for (const w of t.where ?? []) {
    const m = /^(\d{3,4})(?:\s*[–-]\s*(\d{3,4}))?$/u.exec(w.trim());
    if (m) out.push({ from: Number(m[1]), to: Number(m[2] ?? m[1]) });
  }
  return out;
}

/** Merged spans, both ends in: touching or overlapping ones joined. */
function union(spans: Gap[]): Gap[] {
  const out: Gap[] = [];
  for (const s of [...spans].sort((a, b) => a.from - b.from)) {
    const last = out.at(-1);
    if (last && s.from <= last.to + 1) last.to = Math.max(last.to, s.to);
    else out.push({ ...s });
  }
  return out;
}

/**
 * The years the tree's people lived in a region: each person from the first year of a fact at its places (in the years
 * each place belonged to it) to the last, LIVED_MARGIN before and after — to this year when the last is one of the
 * last PRESENT_YEARS — within the years of those places' links and never before 1600 or after this year: the spans of
 * all of them joined. A family's fact counts for its partners; a fact without a year counts for nothing.
 */
export function livedSpans(tree: Tree, region: string, read?: Reading): Gap[] {
  const r = read ?? reading(tree, undefined);
  const now = new Date().getFullYear();
  const of = new Map<string, { years: number[]; lo: number; hi: number }>();
  const count = (who: string[], e: Person["events"][number]) => {
    if (!factWritten(e) || !e.place || !e.date) return;
    const key = lineValue(e.place);
    const m = key ? r.mapOf(key) : undefined;
    if (!m) return;
    const years = dateYears(e.date);
    for (const g of m.regions) {
      if (g.id !== region) continue;
      const inside = years.filter((y) => inRegion({ from: y, to: y }, g));
      if (!inside.length) continue;
      for (const p of who) {
        const w = of.get(p) ?? { years: [], lo: Infinity, hi: -Infinity };
        of.set(p, w);
        w.years.push(...inside);
        w.lo = Math.min(w.lo, g.from ?? -Infinity);
        w.hi = Math.max(w.hi, g.to ?? Infinity);
      }
    }
  };
  const persons = tree.list<Person>("person").filter((p) => !p.retracted);
  const alive = new Set(persons.map((p) => p.id));
  for (const p of persons) for (const e of p.events) count([p.id], e);
  for (const f of tree.list<Family>("family")) {
    const who = f.partners.filter((p) => alive.has(p));
    if (who.length) for (const e of f.events) count(who, e);
  }
  const spans: Gap[] = [];
  for (const w of of.values()) {
    const from = Math.max(EARLIEST_YEAR, w.lo, Math.min(...w.years) - LIVED_MARGIN);
    const last = Math.max(...w.years);
    const to = Math.min(now, w.hi, last >= now - PRESENT_YEARS ? now : last + LIVED_MARGIN);
    if (from <= to) spans.push({ from, to });
  }
  return union(spans);
}

/**
 * A region's period as spans (K2.7): the years the tree's people lived there (livedSpans), those GAP_YEARS or fewer
 * apart joined — a run as short is no gap of a catalog either (K2.6), so a region is never looked for in pieces.
 */
export function regionSpans(tree: Tree, region: string, read?: Reading): Gap[] {
  const out: Gap[] = [];
  for (const s of livedSpans(tree, region, read)) {
    const last = out.at(-1);
    if (last && s.from - last.to - 1 <= GAP_YEARS) last.to = Math.max(last.to, s.to);
    else out.push({ ...s });
  }
  return out;
}

/**
 * The years a finished catalog was never looked through for, of this tree's period (K2.7: an ancestor found earlier
 * or later, another tree's people there in other years): the period's years outside searchedSpans, nor of this tree's
 * tasks of them dropped (since the person last asked for the region again). A run counts when it is a span of the
 * period of its own, or at least GAP_DENSITY years long: fewer years beside those looked through would hardly hold an
 * event of their own (they wait until the period grows more). None for a catalog not finished (its own task looks for
 * the whole period). Nothing written.
 */
export function regionNew(tree: Tree, shared: string | undefined, region: string, read?: Reading): Gap[] {
  if (!shared) return [];
  const r = read ?? reading(tree, shared);
  const c = r.catalog(region);
  if (!c?.done) return [];
  const answered = answeredYears(tree, c, region, r);
  const out: Gap[] = [];
  for (const span of regionPeriod(tree, region, r).spans) {
    let start: number | undefined;
    for (let y = span.from; y <= span.to + 1; y++) {
      const open = y <= span.to && !answered.has(y);
      if (open && start === undefined) start = y;
      if (!open && start !== undefined) {
        const run = { from: start, to: y - 1 };
        if (run.to - run.from + 1 >= GAP_DENSITY || (run.from === span.from && run.to === span.to)) out.push(run);
        start = undefined;
      }
    }
  }
  return out;
}

/** The years of a finished catalog answered for this tree: looked through (searchedSpans), its tasks of them dropped. */
function answeredYears(tree: Tree, c: Catalog, region: string, r: Reading): Set<number> {
  const years = new Set<number>();
  const mark = (g: Gap) => {
    for (let y = g.from; y <= g.to; y++) years.add(y);
  };
  for (const g of searchedSpans(tree, c, r)) mark(g);
  for (const t of tree.list<Task>("task"))
    if (t.origin === gapsOrigin(region) && t.state === "dropped" && t.updated >= (c.redo ?? "")) for (const g of gapsOfTask(t)) mark(g);
  return years;
}

/** What a finished catalog's task of years looks for (K2.6, K2.7): the years never looked through and its gaps, in order. */
export function yearsToSearch(tree: Tree, shared: string | undefined, region: string, read?: Reading): { added: Gap[]; gaps: Gap[]; all: Gap[] } {
  const r = read ?? (shared ? reading(tree, shared) : undefined);
  if (!r) return { added: [], gaps: [], all: [] };
  const added = regionNew(tree, shared, region, r);
  const gaps = regionGaps(tree, shared, region, r);
  return { added, gaps, all: [...added, ...gaps].sort((a, b) => a.from - b.from) };
}

/**
 * The gaps of a region's finished catalog for this tree (K2.6, Milan 28 Oct 2026 — a land's catalog with nothing
 * between 1869 and 1914 while the tree's people lived there): the runs of more than GAP_YEARS years the tree's people
 * lived there (livedSpans) with no event of the catalog — nor of the finished catalogs that hold its places and years
 * (coverOf: a state after its lands) — and not looked at before: the gaps a session of any tree looked at (the
 * catalog's `gaps`, noteGaps: a task of them done writes them there), this tree's tasks of them dropped (since the
 * person last asked for the region again). A task strom closed itself (raiseHistoryTasks: filled, looked at elsewhere)
 * is no look: events taken back later, its years are a gap again. An event of LONG_EVENT years or more marks its two
 * ends only. None for a catalog not finished (its own task looks for all), nor without people there. Nothing written.
 */
export function regionGaps(tree: Tree, shared: string | undefined, region: string, read?: Reading): Gap[] {
  if (!shared) return [];
  const r = read ?? reading(tree, shared);
  const c = r.catalog(region);
  if (!c?.done) return [];
  const lived = livedSpans(tree, region, r);
  if (!lived.length) return [];
  const covered = eventYears(r, region);
  const mark = (g: Gap) => {
    for (let y = g.from; y <= g.to; y++) covered.add(y);
  };
  for (const g of c.gaps ?? []) mark(g);
  for (const t of tree.list<Task>("task"))
    if (t.origin === gapsOrigin(region) && t.state === "dropped" && t.updated >= (c.redo ?? "")) for (const g of gapsOfTask(t)) mark(g);
  // years never looked through are no gap: regionNew's (a run too short of them waits)
  const searched = searchedSpans(tree, c, r);
  for (const g of lived) for (let y = g.from; y <= g.to; y++) if (!searched.some((x) => x.from <= y && y <= x.to)) covered.add(y);
  return openRuns(lived, covered);
}

/** The years the events of a region's catalog (and of the finished catalogs that hold it) mark: a long one its ends. */
function eventYears(r: Reading, region: string): Set<number> {
  const covered = new Set<number>();
  for (const id of [region, ...coverOf(r, region)])
    for (const e of r.catalog(id)?.events ?? []) {
      // one the person deleted still marks its years: a deletion raises no paid look for them
      if (e.retracted && !deletedByPerson(e)) continue;
      if (e.to - e.from + 1 >= LONG_EVENT) {
        covered.add(e.from);
        covered.add(e.to);
      } else for (let y = e.from; y <= e.to; y++) covered.add(y);
    }
  return covered;
}

/** The runs of more than GAP_YEARS years of these spans no year of `covered` falls in. */
function openRuns(spans: Gap[], covered: Set<number>): Gap[] {
  const out: Gap[] = [];
  for (const span of spans) {
    let start: number | undefined;
    for (let y = span.from; y <= span.to + 1; y++) {
      const open = y <= span.to && !covered.has(y);
      if (open && start === undefined) start = y;
      if (!open && start !== undefined) {
        if (y - start > GAP_YEARS) out.push({ from: start, to: y - 1 });
        start = undefined;
      }
    }
  }
  return out;
}

/**
 * Why a task of years has nothing left to do (yearsToSearch none of them): its gaps filled by the events of the
 * catalog ("filled"; a task of years never looked through before is never filled so); else looked at by another
 * tree's session (the catalog's `gaps`, or its `searched` since the task was made: "looked", with the events it wrote
 * in them); else no such years for this tree any more — its people's facts there changed ("gone"; `added`: the task
 * had years never looked through).
 */
export function gapsClosed(
  tree: Tree,
  shared: string,
  region: string,
  t: Pick<Task, "where" | "created">,
): { why: "filled" | "looked" | "gone"; added: number; extended: boolean } {
  const r = reading(tree, shared);
  const mine = gapsOfTask(t);
  const c = r.catalog(region);
  // its years never looked through when it was made: what was looked through before it, by any tree
  const before = c ? searchedSpans(tree, { ...c, ...(c.searched ? { searched: c.searched.filter((g) => g.at < (t.created ?? "")) } : {}), gaps: (c.gaps ?? []).filter((g) => g.at < (t.created ?? "")) }, r) : [];
  const extended = mine.some((m) => !before.some((b) => b.from <= m.from && m.to <= b.to));
  if (!extended && !openRuns(mine, eventYears(r, region)).length) return { why: "filled", added: 0, extended };
  const other = (g: { tree: string; from: number; to: number }) => g.tree !== tree.config.id && mine.some((m) => g.from <= m.to && m.from <= g.to);
  const looked = [...(c?.gaps ?? []).filter(other), ...(c?.searched ?? []).filter((g) => g.at >= (t.created ?? "") && other(g))];
  if (looked.length) return { why: "looked", added: looked.reduce((n, g) => n + (g.added || 0), 0), extended };
  return { why: "gone", added: 0, extended };
}

/**
 * A gaps' task finished (strom session close --done): its gaps written into the shared catalog as looked at — with the
 * events this tree wrote in them since the task was made, none too — and the region let go when this tree held it.
 */
export function noteGaps(shared: string, region: string, t: Pick<Task, "where" | "created">, treeId: string): void {
  const gaps = gapsOfTask(t);
  if (!regionIdOk(region) || !gaps.length) return;
  withCatalogs(shared, () => {
    const c = readCatalog(shared, region);
    if (!c) return;
    const at = new Date().toISOString();
    const mine = c.events.filter((e) => !e.retracted && e.by === treeId && e.at >= t.created);
    c.gaps = [...(c.gaps ?? []), ...gaps.map((g) => ({ ...g, at, tree: treeId, added: mine.filter((e) => overlap(e, g)).length }))];
    if (c.holder?.tree === treeId) delete c.holder;
    writeCatalog(shared, c);
  });
}

/**
 * A region taken by this tree for a session on its task (or on its gaps): the holder written into the shared catalog (refreshed when it
 * is this tree's already). Another tree's hold within HOLD_DAYS stays: its ID is returned (nothing written).
 */
export function takeRegion(shared: string, region: string, treeId: string, gaps = false): string | undefined {
  if (!regionIdOk(region)) return undefined;
  return withCatalogs(shared, () => {
    const c = readCatalog(shared, region);
    // a finished catalog is held only while its gaps are filled
    if (!c || (c.done && !gaps)) return undefined;
    if (heldElsewhere(c, treeId)) return c.holder!.tree;
    c.holder = { tree: treeId, since: new Date().toISOString() };
    writeCatalog(shared, c);
    return undefined;
  });
}

// ── how often: history's turn in strom run (experiments.historyPace) ────────

/** About every how many sessions of strom run one is of history, by the pace (idle: only when nothing else is left). */
export const PACE_EVERY: Record<Exclude<HistoryPace, "idle">, number> = { sometimes: 5, rare: 10 };

/** How far before or after its every-th session the turn may come: a share of it, either way (5: 3–7, 10: 6–14). */
const PACE_SPREAD = 0.4;

/** How many of the last sessions are looked at for the places they worked at (a region there first). */
const PREFER_SESSIONS = 10;

/** How many regions asked first are remembered (the newest). */
const FIRST_MAX = 50;

export interface HistoryTurn {
  pace: HistoryPace;
  /** The sessions ended since the last one on a region (none yet: since the first region's task was raised). */
  since: number;
  /** A region's turn is the due-th session after the last one on a region (pace idle: none). */
  due?: number;
  /** The next session is a region's (a session of one at work elsewhere: not now). */
  now: boolean;
  /** Sessions of the family research before a region's turn: 0 — the next one. */
  in?: number;
  /** The region the person asked for last (strom history first, the app's person card): its task first of the regions. */
  asked?: { task: string; region: string; at: string };
  /** A place a recent session worked at whose region has no finished catalog: its task first. */
  prefer?: { task: string; place: string; region: string };
  /** The regions of the open tasks in the order they come, by their weight in the tree (regionOrder). */
  order?: RegionWeight[];
  /** The places of the facts to map, open: the next session's whatever the pace — the cheap step the regions need. */
  places?: string;
  /** The place whose own history the person asked for first (strom history place, core/placehistory.ts): its task the next session's, whatever the pace. */
  placeAsked?: { task: string; place: string; at: string };
  /** The other open tasks of the places' own history, after the regions: those asked for, then by their weight in the tree. */
  placeOrder?: PlaceWeight[];
}

/** The session history's turn comes at after its last one: every, give or take its spread — drawn from the seed. */
export function historyDue(every: number, seed: string): number {
  const spread = Math.floor(every * PACE_SPREAD);
  const n = crypto.createHash("sha256").update(seed).digest().readUInt32BE(0);
  return every - spread + (n % (2 * spread + 1));
}

/**
 * When the tasks of history get a session of strom run. The places of the facts to map: the next session, whatever the
 * pace — a small step, and the regions wait for it (Milan, 28 Oct 2026). The regions (experiments.historyPace): now and
 * then between the sessions of the family research, by chance within the pace — the seed is the tree and the last
 * session on a region, so the turn is the same for the queue, strom plan and the run (nothing written), and moves on
 * with each such session. One at work (another run) holds the next one off. Nothing left of the family research: taken
 * anyway (rankTasks).
 */
export function historyTurn(tree: Tree, shared: string | undefined, settings: Settings = new Settings(tree.env, {})): HistoryTurn {
  const pace = settings.historyPace(tree.config);
  const tasks = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  const sessions = tree
    .list<Session>("session")
    .filter((s) => s.task && tasks.has(s.task))
    .sort((a, b) => a.started.localeCompare(b.started) || a.id.localeCompare(b.id));
  const ofRegion = (t: Task) => forHistory(t) && t.origin !== HISTORY_PLACES_ORIGIN;
  const lastAt = sessions.findLastIndex((s) => ofRegion(tasks.get(s.task!)!));
  const last = lastAt >= 0 ? sessions[lastAt] : undefined;
  // none yet: counted from the first region's task
  const first = last ? undefined : [...tasks.values()].filter(ofRegion).map((t) => t.created).sort()[0];
  const after = last ? sessions.slice(lastAt + 1) : first ? sessions.filter((s) => s.started >= first) : [];
  const ended = after.filter((s) => s.state !== "open");
  const prefer = preferredOf(tree, shared, [...tasks.values()], ended.slice(-PREFER_SESSIONS));
  const places = [...tasks.values()].find((t) => t.origin === HISTORY_PLACES_ORIGIN && (t.state === "open" || t.state === "doing"));
  const skipped = new Set(readSkips(tree).regions.map((x) => x.region));
  const open = new Map([...tasks.values()].filter((t) => ofRegion(t) && !!regionOfTask(t) && (t.state === "open" || t.state === "doing") && !skipped.has(regionOfTask(t)!)).map((t) => [regionOfTask(t)!, t]));
  const own = placeTurn(tree, [...tasks.values()]);
  const asked = readFirst(tree)
    .filter((x) => open.has(x.region))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((x) => ({ task: open.get(x.region)!.id, region: x.region, at: x.at }))[0];
  const order = open.size ? regionOrder(tree, shared).filter((w) => open.has(w.id)) : [];
  const base = {
    pace,
    since: ended.length,
    ...(asked ? { asked } : {}),
    ...(prefer ? { prefer } : {}),
    ...(places ? { places: places.id } : {}),
    ...(order.length ? { order } : {}),
    ...(own.asked ? { placeAsked: own.asked } : {}),
    ...(own.order.length ? { placeOrder: own.order } : {}),
  };
  if (pace === "idle") return { ...base, now: false };
  const due = historyDue(PACE_EVERY[pace], `${tree.config.id}:${last?.id ?? "first"}`);
  const busy = last?.state === "open";
  return { ...base, due, now: !busy && ended.length >= due - 1, in: Math.max(busy ? 1 : 0, due - 1 - ended.length) };
}

/**
 * The region's task a recent session made needed: the latest place it worked at — a person's or a family's fact, a
 * place of the research — that lies in a region with no finished catalog (a place not mapped yet: the places' task goes
 * first anyway). Only a task open now; undefined without one.
 */
function preferredOf(tree: Tree, shared: string | undefined, tasks: Task[], recent: Session[]): HistoryTurn["prefer"] {
  if (!recent.length) return undefined;
  const open = tasks.filter((t) => forHistory(t) && (t.state === "open" || t.state === "doing"));
  if (!open.length) return undefined;
  const since = recent[0]!.started;
  const r = reading(tree, shared);
  const touched: { at: string; places: string[] }[] = [];
  for (const p of tree.list<Person>("person")) if (!p.retracted && p.updated >= since) touched.push({ at: p.updated, places: p.events.map((e) => e.place ?? "") });
  for (const f of tree.list<Family>("family")) if (f.updated >= since) touched.push({ at: f.updated, places: f.events.map((e) => e.place ?? "") });
  for (const p of tree.list<Place>("place")) if (!p.retracted && p.updated >= since) touched.push({ at: p.updated, places: p.names.map((n) => n.name) });
  touched.sort((a, b) => b.at.localeCompare(a.at));
  for (const { places: at } of touched)
    for (const raw of at) {
      const key = lineValue(raw);
      if (!key) continue;
      const m = r.mapOf(key);
      if (!m) continue;
      for (const g of m.regions) {
        if (r.catalog(g.id)?.done) continue;
        const t = open.find((x) => x.origin === regionOrigin(g.id));
        if (t) return { task: t.id, place: key, region: g.id };
      }
    }
  return undefined;
}

/**
 * The order of the tasks of history among themselves: the places to map (the regions need them), the region the
 * person asked for, the region a recent session made needed (prefer), then the regions by their weight in the tree
 * (regionOrder). Smaller first.
 */
export function historyOrder(turn: HistoryTurn | undefined): (t: Task) => number {
  const rank = new Map((turn?.order ?? []).map((w, i) => [w.id, i]));
  const places = new Map((turn?.placeOrder ?? []).map((w, i) => [w.task, i]));
  return (t) => {
    // the place whose history the person asked for: before anything (it needs no region)
    if (turn?.placeAsked?.task === t.id) return -1;
    if (t.origin === HISTORY_PLACES_ORIGIN) return 0;
    if (turn?.asked?.task === t.id) return 1;
    if (turn?.prefer?.task === t.id) return 2;
    // the places' own after the regions, those asked for first, then the places of the most people
    if (placeOfTask(t)) return 4 + rank.size + (places.get(t.id) ?? places.size);
    const region = regionOfTask(t);
    return 3 + (region !== undefined && rank.has(region) ? rank.get(region)! : rank.size);
  };
}

/** A region's weight in the tree: the people with a fact at its places in its years, those facts, the places. */
export interface RegionWeight {
  id: string;
  persons: number;
  facts: number;
  places: number;
  /** The finished regions that hold every place of it in its years already (coveredBy): it comes last. */
  covered?: string[];
}

/**
 * The finished regions that hold every place of the tree's facts in a region for all its years — a state whose lands'
 * catalogs are done, those catalogs having its events already (the history its people lived through). Empty when one
 * place or year is left out, and for a region without places.
 */
function coverOf(r: Reading, region: string): string[] {
  const by = new Set<string>();
  let any = false;
  for (const key of r.facts.keys()) {
    const m = r.mapOf(key);
    const own = m?.regions.find((g) => g.id === region);
    if (!m || !own) continue;
    any = true;
    const holds = m.regions.filter(
      (g) => g.id !== region && !!r.catalog(g.id)?.done && (g.from ?? -Infinity) <= (own.from ?? -Infinity) && (g.to ?? Infinity) >= (own.to ?? Infinity),
    );
    if (!holds.length) return [];
    for (const g of holds) by.add(g.id);
  }
  return any ? [...by].sort() : [];
}

/** The finished regions that hold a region's places and years already (strom's brief of its session says them). */
export function coveredBy(tree: Tree, shared: string | undefined, region: string): string[] {
  return coverOf(reading(tree, shared), region);
}

/**
 * The tree's regions in the order their history is looked for (Milan, 28 Oct 2026 — history turned on late in a large
 * tree): the regions of the most people first (then of the most facts); a region whose places all lie in another's
 * (a land within its state) before it — the state waits for every land of it the tree has; a region of one person (or
 * none) last; at the very end a region whose places and years a finished catalog holds already (coverOf: a state
 * after its lands are done — their catalogs have its events; dirigent's finding of 28 Oct 2026, 19 regions of a real
 * tree). Of the same people and facts, the one of more years first (a land outlasts each of its states). A fact counts
 * for the regions its place belonged to in its year, one without a year for every region of its place; which region
 * lies in which is told by the places of the facts, whatever the years. Nothing written.
 */
export function regionOrder(tree: Tree, shared: string | undefined): RegionWeight[] {
  const r = reading(tree, shared);
  const now = new Date().getFullYear();
  const of = new Map<string, { persons: Set<string>; facts: number; places: Set<string>; span: number }>();
  const count = (who: string[], e: Person["events"][number]) => {
    if (!factWritten(e) || !e.place) return;
    const key = lineValue(e.place);
    const m = key ? r.mapOf(key) : undefined;
    if (!m) return;
    const years = e.date ? dateYears(e.date) : [];
    for (const g of m.regions) {
      if (!regionIdOk(g.id)) continue;
      const w = of.get(g.id) ?? { persons: new Set<string>(), facts: 0, places: new Set<string>(), span: 0 };
      of.set(g.id, w);
      // its places whatever the years (a land within its state), its people and facts in its years
      if (!w.places.has(foldText(key))) w.span += Math.max(0, Math.min(now, g.to ?? now) - Math.max(EARLIEST_YEAR, g.from ?? EARLIEST_YEAR));
      w.places.add(foldText(key));
      if (years.length && !years.some((y) => inRegion({ from: y, to: y }, g))) continue;
      for (const p of who) w.persons.add(p);
      w.facts++;
    }
  };
  const persons = tree.list<Person>("person").filter((p) => !p.retracted);
  const alive = new Set(persons.map((p) => p.id));
  for (const p of persons) for (const e of p.events) count([p.id], e);
  for (const f of tree.list<Family>("family")) {
    const who = f.partners.filter((p) => alive.has(p));
    if (who.length) for (const e of f.events) count(who, e);
  }
  const all = regionsOfTree(tree).map((id) => {
    const w = of.get(id);
    return { id, persons: w?.persons.size ?? 0, facts: w?.facts ?? 0, places: w?.places ?? new Set<string>(), span: w?.span ?? 0, covered: r.catalog(id)?.done ? [] : coverOf(r, id) };
  });
  const heavier = (a: (typeof all)[number], b: (typeof all)[number]) => b.persons - a.persons || b.facts - a.facts || b.span - a.span || a.id.localeCompare(b.id);
  // a above b: every place of b is a's, and a has more
  const above = (a: (typeof all)[number], b: (typeof all)[number]) => b.places.size > 0 && a.places.size > b.places.size && [...b.places].every((k) => a.places.has(k));
  const left = all.filter((w) => w.persons > 1 && !w.covered.length).sort(heavier);
  const out: (typeof all)[number][] = [];
  while (left.length) {
    const i = left.findIndex((a) => !left.some((b) => b !== a && above(a, b)));
    out.push(...left.splice(i < 0 ? 0 : i, 1));
  }
  out.push(...all.filter((w) => w.persons <= 1 && !w.covered.length).sort(heavier));
  out.push(...all.filter((w) => w.covered.length).sort(heavier));
  return out.map((w) => ({ id: w.id, persons: w.persons, facts: w.facts, places: w.places.size, ...(w.covered.length ? { covered: w.covered } : {}) }));
}

/**
 * The person asks for a region's history first (strom history first; the app's person card through the bridge): its
 * task comes first of the regions, still at the turn the pace gives (strom run --task T… takes it now). Only while the
 * history is on, in a research with its agent; a region of the tree's places, not finished. Inside the tree's lock.
 */
export function askFirst(tree: Tree, shared: string | undefined, region: string, settings: Settings = new Settings(tree.env, {})): { first: FirstAsk[]; task?: string } {
  if (!historyOn(tree, settings)) throw new UsageError("the history of the places is off: only the person turns it on (strom config set experiments.history on)", { code: "history.off" });
  if (actsAsArchive(tree)) throw new UsageError("an archive looks for nothing", { code: "history.archive" });
  const id = region.trim();
  if (!regionIdOk(id) || !regionsOfTree(tree).includes(id)) throw new UsageError(`no place of the tree belongs to the region ${id} (strom history status lists them)`, { code: "history.region", params: { region: id } });
  if (shared && readCatalog(shared, id)?.done) throw new UsageError(`the history of ${id} is found already (strom history redo ${id}: look again)`, { code: "history.done", params: { region: id } });
  // the person's word not to look for it stays until they take it back themselves
  if (readSkips(tree).regions.some((x) => x.region === id))
    throw new UsageError(`the history of ${id} is not looked for in this research (skipped) — nothing asked first`, { code: "history.skipped", params: { region: id }, hint: `strom history unskip --region ${id}, then strom history first ${id}` });
  return tree.withTreeLock(() => {
    const before = readFirst(tree);
    const task = tree.list<Task>("task").find((t) => t.origin === regionOrigin(id) && LIVE_STATES.has(t.state))?.id;
    if (before[0]?.region === id) return { first: before, ...(task ? { task } : {}) };
    const first = [{ region: id, at: new Date().toISOString() }, ...before.filter((x) => x.region !== id)].slice(0, FIRST_MAX);
    // the places asked for (core/placehistory.ts) kept beside
    const places = readPlaceAsks(tree);
    putTreeFile(tree, FIRST_FILE, { first, ...(places.length ? { places } : {}) }, { op: "history.first", targets: [], summary: `History first: ${id}` });
    return { first, ...(task ? { task } : {}) };
  });
}

/**
 * What keeps a task of history out of the queue now — nothing written, computed afresh: the experiment off (the tasks
 * stay as they are and come back when it is on again), a research that acts as an archive, a region the person does not
 * want looked for in this tree (strom history skip: back with unskip), a region another tree builds within HOLD_DAYS, or
 * a region nobody of the tree lived in in its years (regionPeriod nobody, K2.7a: its task waiting is closed when the
 * tasks are raised again). Undefined for a task that may be taken (and for any other task).
 */
export function historyHeld(tree: Tree, shared: string | undefined, settings: Settings = new Settings(tree.env, {})): (t: Task) => "off" | "archive" | "held" | "skipped" | "nobody" | undefined {
  let state: "off" | "archive" | undefined | null = null;
  let skipped: Set<string> | undefined;
  let read: Reading | undefined;
  const nobody = new Map<string, boolean>();
  const nobodyIn = (region: string) => {
    if (!nobody.has(region)) nobody.set(region, !!regionPeriod(tree, region, (read ??= reading(tree, undefined))).nobody);
    return nobody.get(region)!;
  };
  return (t) => {
    if (!forHistory(t)) return undefined;
    if (state === null) state = !historyOn(tree, settings) ? "off" : actsAsArchive(tree) ? "archive" : undefined;
    if (state) return state;
    if (placeOfTask(t)) return placeHeld(tree, shared, t);
    const region = regionOfTask(t);
    skipped ??= new Set(readSkips(tree).regions.map((x) => x.region));
    if (region && skipped.has(region)) return "skipped";
    if (region && shared && heldElsewhere(readCatalog(shared, region), tree.config.id)) return "held";
    if (region && nobodyIn(region)) return "nobody";
    return undefined;
  };
}

/**
 * The tasks of history raised while the experiment is on in a research (never in an archive, nor one waiting for its
 * agent, never in a dry run): one to map the places of the facts while any is not mapped, one for each region of the
 * tree's places whose catalog is not finished, one for the gaps of a finished one (regionGaps) — level enrich,
 * priority 1, after all the research in the queue. Never a
 * second one of the same origin open; a places' task again only for a place the last one did not name; a region's task
 * dropped is the answer until the person asks for the region again (redo); one whose catalog was finished meanwhile
 * (another tree, strom history done) is done. Inside the tree's lock, committed by the caller. Returns what it made.
 */
export function raiseHistoryTasks(tree: Tree, shared: string | undefined, settings: Settings = new Settings(tree.env, {})): string[] {
  if (tree.dryRun || !shared || !historyOn(tree, settings) || actsAsArchive(tree)) return [];
  return tree.withTreeLock(() => {
    const lang = tree.lang;
    const tasks = tree.list<Task>("task").filter(forHistory);
    const made: string[] = [];
    const add = (fields: Pick<Task, "what" | "where" | "why" | "doneWhen" | "origin">) =>
      made.push(
        create<Task>(tree, "task", { level: HISTORY_LEVEL, priority: 1, subject: [], state: "open", ...fields }, (id) => `+${id} task "${fields.what.slice(0, 60)}" (history)`).id,
      );
    // a finished catalog with years of the tree's people there never looked through (K2.7: its period grew) or with
    // gaps (K2.6): one task of those years, paced as a region's; none left (filled or looked through meanwhile, by
    // another tree too): its waiting task is done — one at work closes itself
    const raiseGaps = (id: string, c: Catalog) => {
      const origin = gapsOrigin(id);
      const live = tasks.filter((t) => t.origin === origin && LIVE_STATES.has(t.state));
      const { added: fresh, gaps: empty, all: gaps } = yearsToSearch(tree, shared, id);
      if (!gaps.length) {
        // its result says why, truly: filled, looked at by another research (found or not), or no gap here any more
        for (const t of live.filter((x) => x.state === "open" || x.state === "parked")) {
          const { why, added, extended } = gapsClosed(tree, shared, id, t);
          const key =
            why === "looked" ? (added ? "history.gaps.looked.some" : "history.gaps.looked.none") : why === "gone" ? (extended ? "history.extend.gone" : "history.gaps.gone") : "history.gaps.filled";
          const result = phrase(lang, key, { region: regionName(c, lang, id), years: t.where.join(", "), n: added });
          update<Task>(tree, t.id, "task", (x) => ({ ...x, state: "done", result }), {
            op: "task.done",
            summary: `${t.id} done: no gap left in the catalog of ${id} (${why})`,
          });
        }
        return;
      }
      if (live.length) return;
      const region = regionName(c, lang, id);
      const kind = !fresh.length ? "gaps" : empty.length ? "years" : "extend";
      add({
        what: phrase(lang, `history.${kind}.what`, { region, years: gaps.map(gapText).join(", "), added: fresh.map(gapText).join(", "), gaps: empty.map(gapText).join(", ") }),
        where: gaps.map(gapText),
        why: phrase(lang, `history.${kind}.why`),
        doneWhen: phrase(lang, `history.${kind === "gaps" ? "gaps" : "extend"}.done`),
        origin,
      });
    };
    // the places of the facts
    const unmapped = unmappedPlaces(tree);
    const ofPlaces = tasks.filter((t) => t.origin === HISTORY_PLACES_ORIGIN);
    if (unmapped.length && !ofPlaces.some((t) => LIVE_STATES.has(t.state))) {
      const last = ofPlaces.sort((a, b) => b.updated.localeCompare(a.updated))[0];
      const named = new Set((last?.where ?? []).map((w) => foldText(w)));
      if (!last || unmapped.some((p) => !named.has(foldText(p))))
        add({
          what: phrase(lang, "history.places.what", { n: unmapped.length }),
          where: unmapped.slice(0, PLACES_NAMED),
          why: phrase(lang, "history.places.why"),
          doneWhen: phrase(lang, "history.places.done"),
          origin: HISTORY_PLACES_ORIGIN,
        });
    }
    // the regions of its places — one the person skipped: nothing raised, its task kept as it is (historyHeld)
    const skipped = new Set(readSkips(tree).regions.map((x) => x.region));
    for (const id of regionsOfTree(tree)) {
      const c = readCatalog(shared, id);
      if (!c || skipped.has(id)) continue;
      const origin = regionOrigin(id);
      const mine = tasks.filter((t) => t.origin === origin);
      if (c.done) {
        // finished before its years were kept, by this tree: the period its brief said then written down once (K2.7)
        if (!c.searched && c.done.tree === tree.config.id) keepLegacy(shared, id, legacySpan(c, tree));
        // finished meanwhile (another tree, strom history done): its waiting task is done too — one at work closes itself
        for (const t of mine.filter((x) => x.state === "open" || x.state === "parked"))
          update<Task>(tree, t.id, "task", (x) => ({ ...x, state: "done", result: phrase(lang, "history.region.finished", { region: regionName(c, lang, id) }) }), {
            op: "task.done",
            summary: `${t.id} done: the catalog of ${id} is finished`,
          });
        raiseGaps(id, c);
        continue;
      }
      // looked for again (redo): a task of its gaps waiting has nothing of its own left — the region's task looks for all
      for (const t of tasks.filter((x) => x.origin === gapsOrigin(id) && (x.state === "open" || x.state === "parked")))
        update<Task>(tree, t.id, "task", (x) => ({ ...x, state: "done", result: phrase(lang, "history.gaps.redo", { region: regionName(c, lang, id) }) }), {
          op: "task.done",
          summary: `${t.id} done: ${id} is looked for again as a whole`,
        });
      // nobody of the tree lived there in its years (K2.7a): nothing looked for — its task waiting is done, its catalog kept
      if (regionPeriod(tree, id).nobody) {
        for (const t of mine.filter((x) => x.state === "open" || x.state === "parked"))
          update<Task>(tree, t.id, "task", (x) => ({ ...x, state: "done", result: phrase(lang, "history.region.nobody", { region: regionName(c, lang, id) }) }), {
            op: "task.done",
            summary: `${t.id} done: nobody of the tree lived in ${id} in its years`,
          });
        continue;
      }
      if (mine.some((t) => LIVE_STATES.has(t.state))) continue;
      // dropped since the region was last asked for again: that was the answer
      if (mine.some((t) => t.state === "dropped" && t.updated >= (c.redo ?? ""))) continue;
      const name = regionName(c, lang, id);
      add({
        what: phrase(lang, "history.region.what", { region: name }),
        where: [phrase(lang, "history.region.where")],
        why: phrase(lang, "history.region.why"),
        doneWhen: phrase(lang, "history.region.done"),
        origin,
      });
    }
    // the places' own history (core/placehistory.ts): a finished catalog closes its task; by itself only when the person
    // turned it on (experiments.historyPlaces)
    made.push(...raisePlaceTasks(tree, shared, settings));
    return made;
  });
}

/**
 * A region's task finished (strom session close --done): its catalog finished too, when it is not yet; a task of its
 * gaps: those gaps looked at (noteGaps).
 */
export function finishRegionOf(tree: Tree, shared: string | undefined, t: Task): void {
  if (placeOfTask(t)) return finishPlaceOf(tree, shared, t);
  const region = regionOfTask(t);
  if (!region || !shared || tree.dryRun) return;
  if (forGaps(t)) return noteGaps(shared, region, t, tree.config.id);
  const c = readCatalog(shared, region);
  if (c && !c.done) markDone(shared, region, tree.config.id, donePeriod(tree, c), t.created);
}

/** The years a tree's session finishing a region looked through (its period), with a legacy catalog's earlier years. */
export function donePeriod(tree: Tree, c: Catalog): { spans: Gap[]; legacy?: Gap } {
  return { spans: regionPeriod(tree, c.region.id).spans, ...(c.done && !c.searched ? { legacy: legacySpan(c, tree) } : {}) };
}

/** A legacy catalog's years looked through written once (the tree that finished it), unless written meanwhile. */
function keepLegacy(shared: string, region: string, span: Gap): void {
  withCatalogs(shared, () => {
    const c = readCatalog(shared, region);
    if (!c?.done || c.searched) return;
    c.searched = [{ ...span, at: c.done.at, tree: c.done.tree }];
    writeCatalog(shared, c);
  });
}

// ── the history in the stories (K6) ────────────────────────────────────────

/** An event of the history a story may tell as the background of its time (K6.1): what, when, where, its source. */
export interface StoryEvent {
  id: string;
  from: number;
  to: number;
  date?: string;
  kind: EventKind;
  scope: EventScope;
  /** The region's name in the research language (a region's event). */
  region?: string;
  /** The place's name in the research language (a place's own event, core/placehistory.ts). */
  place?: string;
  /** The places of the person's facts it comes through. */
  places: string[];
  /** In the research language (else English, else any). */
  text: string;
  /** The person's age in the year it began: one person, their birth year known, born by then. */
  age?: number;
  sensitive?: true;
  /** Where it is from: a region's page, or the research's own source a local one was read in. */
  source: { title: string; publisher?: string; url: string; quote: string } | { record: string; cite: string };
}

const BIRTH_KINDS = new Set(["BIRT", "CHR", "BAPM"]);
const DEATH_KINDS = new Set(["DEAT", "BURI", "CREM"]);

function textIn(t: Texts, lang: string): string {
  return t[lang] ?? t.en ?? Object.values(t)[0] ?? "";
}

/** The people a story is about: a person, or a couple's partners (F…). */
function storyPeople(tree: Tree, owner: string): string[] {
  const f = /^F\d+$/i.test(owner) ? tree.get<Family>(owner.toUpperCase()) : undefined;
  return f ? f.partners : [owner];
}

/**
 * The events of the history a story of a person or a couple may tell (K6.1): those of the regions of the places of
 * their facts (their own and their marriages') in the years they lived there — each person's facts in the region,
 * LIVED_MARGIN before the first and after the last, never after their death, to this year only when the last is one of
 * the last PRESENT_YEARS (K2.7, as regionSpans for one person) — and the local ones read in the research's sources at
 * those places in those years. Never what the person hid (in the tree, at the person, at every place it comes through,
 * a whole region) nor what is deleted or taken back; a place skipped gives no region's event (as historyAnswer). The same
 * event of two regions once, the nearer one's. A couple's story only of the years both lived — from the later birth to
 * the earlier death, as their facts say them (the decision of 28 Oct 2026: the common years, not each one's); one
 * person's story keeps LIVED_MARGIN before their first fact, the years before the birth too. Read
 * only; the setting (stories.history) is the caller's.
 */
export function storyHistory(tree: Tree, shared: string | undefined, owner: string, read?: Reading): StoryEvent[] {
  const persons = [...new Set(storyPeople(tree, owner).map((id) => resolvePerson(tree, id)).filter((id): id is string => !!id))];
  if (!persons.length) return [];
  const r = read ?? reading(tree, shared);
  const now = new Date().getFullYear();
  const lang = tree.lang;
  const records = tree.list<Place>("place");
  const sources = new Map(tree.list<Source>("source").map((s) => [s.id, s]));
  const current = replacements(tree, shared);
  const hides = readHidden(tree).map((h) => ({
    ...h,
    event: h.event !== undefined ? current(h.event).id : undefined,
    person: h.person !== undefined ? (resolvePerson(tree, h.person) ?? h.person) : undefined,
  }));
  const hiddenRegions = new Set(hides.filter((h) => h.event === undefined && h.region).map((h) => h.region!));
  const hiddenHere = (id: string) => hides.some((h) => h.event === id && (!!h.tree || (h.person !== undefined && persons.includes(h.person))));
  const hiddenAt = (id: string, place: string) => hides.some((h) => h.event === id && h.place !== undefined && foldText(h.place) === foldText(place));
  // how many of the tree's places each region has: the one of fewer is the nearer (a land within its state)
  const reach = new Map<string, number>();
  for (const m of Object.values(r.maps)) for (const g of m.regions) reach.set(g.id, (reach.get(g.id) ?? 0) + 1);

  const found = new Map<string, StoryEvent & { at: Set<string>; reach: number; of?: string }>();
  // the place record of each place of the facts, its own catalog (core/placehistory.ts) read once
  const recordOf = placeRecordOf(records);
  const ownCatalogs = new Map<string, PlaceCatalog | undefined>();
  const ownCatalog = (id: string) => {
    if (!ownCatalogs.has(id)) {
      const p = shared ? placeRecord(tree, id) : undefined;
      ownCatalogs.set(id, p ? readPlaceCatalog(shared!, placeKeyOf(tree, p)) : undefined);
    }
    return ownCatalogs.get(id);
  };
  const families = tree.list<Family>("family").filter((f) => !f.retracted);
  // the years all of them lived — a couple's story only (one not known on a side: no bound there); one person keeps
  // LIVED_MARGIN before the first fact
  const both = { from: -Infinity, to: Infinity };
  for (const pid of persons) {
    const p = tree.get<Person>(pid)!;
    const facts: { kind: string; place?: string; years: number[] }[] = [];
    const add = (e: Person["events"][number]) => {
      if (factWritten(e)) facts.push({ kind: e.kind, ...(e.place ? { place: lineValue(e.place) } : {}), years: e.date ? dateYears(e.date) : [] });
    };
    p.events.forEach(add);
    for (const f of families) if (f.partners.includes(pid)) f.events.forEach(add);
    const born = Math.min(...facts.filter((f) => BIRTH_KINDS.has(f.kind)).flatMap((f) => f.years));
    const died = Math.max(...facts.filter((f) => DEATH_KINDS.has(f.kind)).flatMap((f) => f.years));
    if (persons.length > 1 && Number.isFinite(born)) both.from = Math.max(both.from, born);
    if (persons.length > 1 && Number.isFinite(died)) both.to = Math.min(both.to, died);
    const span = (years: number[], lo = -Infinity, hi = Infinity): Gap | undefined => {
      const last = Math.max(...years);
      const from = Math.max(EARLIEST_YEAR, lo, Math.min(...years) - LIVED_MARGIN);
      const to = Math.min(now, hi, Number.isFinite(died) ? Math.min(died, last + LIVED_MARGIN) : last >= now - PRESENT_YEARS ? now : last + LIVED_MARGIN);
      return from <= to ? { from, to } : undefined;
    };
    const ageAt = (year: number) => (persons.length === 1 && Number.isFinite(born) && year >= born ? { age: year - born } : {});

    // the regions of the places of their facts: the years in each, the places, the bounds of their links
    const regions = new Map<string, { years: number[]; lo: number; hi: number; links: { place: string; link: RegionLink }[] }>();
    for (const f of facts) {
      if (!f.place) continue;
      const m = r.mapOf(f.place);
      if (!m || m.state === "unlocated") continue;
      for (const g of m.regions) {
        const inside = f.years.filter((y) => inRegion({ from: y, to: y }, g));
        const x = regions.get(g.id) ?? { years: [], lo: Infinity, hi: -Infinity, links: [] };
        regions.set(g.id, x);
        x.years.push(...inside);
        x.lo = Math.min(x.lo, g.from ?? -Infinity);
        x.hi = Math.max(x.hi, g.to ?? Infinity);
        if (!x.links.some((l) => l.place === f.place && l.link === g)) x.links.push({ place: f.place, link: g });
      }
    }
    const lived = new Map<string, Gap>();
    for (const [id, x] of regions) {
      if (!x.years.length || hiddenRegions.has(id)) continue;
      const s = span(x.years, x.lo, x.hi);
      if (!s) continue;
      lived.set(id, s);
      const c = r.catalog(id);
      for (const e of c?.events ?? []) {
        if (e.retracted || e.from > s.to || e.to < s.from || hiddenHere(e.id)) continue;
        const at = x.links.filter((l) => inRegion(e, l.link) && !hiddenAt(e.id, l.place)).map((l) => l.place);
        if (!at.length) continue;
        const had = found.get(e.id);
        if (had) {
          for (const a of at) had.at.add(a);
          continue;
        }
        const src = e.source;
        found.set(e.id, {
          id: e.id,
          from: e.from,
          to: e.to,
          ...(e.date ? { date: e.date } : {}),
          kind: (EVENT_KINDS as readonly string[]).includes(e.kind) ? e.kind : "other",
          scope: "region",
          region: regionName(c, lang, id),
          places: [],
          text: textIn(e.text, lang),
          ...ageAt(e.from),
          ...(e.sensitive ? { sensitive: true as const } : {}),
          source: { title: src.title, ...(src.publisher ? { publisher: src.publisher } : {}), url: src.url, quote: src.quote },
          at: new Set(at),
          reach: reach.get(id) ?? 0,
          of: id,
        });
      }
    }

    // the places' own events (core/placehistory.ts): of the record of each place of their facts, in the years they
    // lived there — the nearest of all (a place skipped: none)
    const records_ = new Map<string, { years: number[]; places: Set<string> }>();
    for (const f of facts) {
      if (!f.place || r.skippedFacts.has(f.place)) continue;
      const id = recordOf(f.place);
      if (!id) continue;
      const x = records_.get(id) ?? { years: [], places: new Set<string>() };
      records_.set(id, x);
      x.years.push(...f.years);
      x.places.add(f.place);
    }
    for (const [id, x] of records_) {
      const s = x.years.length ? span(x.years) : undefined;
      const c = s ? ownCatalog(id) : undefined;
      for (const e of c?.events ?? []) {
        if (e.retracted || e.from > s!.to || e.to < s!.from || hiddenHere(e.id)) continue;
        const at = [...x.places].filter((p) => !hiddenAt(e.id, p));
        if (!at.length) continue;
        const had = found.get(e.id);
        if (had) {
          for (const a of at) had.at.add(a);
          continue;
        }
        const src = e.source;
        found.set(e.id, {
          id: e.id,
          from: e.from,
          to: e.to,
          ...(e.date ? { date: e.date } : {}),
          kind: (EVENT_KINDS as readonly string[]).includes(e.kind) ? e.kind : "other",
          scope: "place",
          place: textIn(c!.place.name, lang),
          places: [],
          text: textIn(e.text, lang),
          ...ageAt(e.from),
          ...(e.sensitive ? { sensitive: true as const } : {}),
          source: { title: src.title, ...(src.publisher ? { publisher: src.publisher } : {}), url: src.url, quote: src.quote },
          at: new Set(at),
          reach: -1,
          of: c!.place.key,
        });
      }
    }

    // the local events at the places of their facts (any of their names), in the years they lived there
    const atPlace = new Map<string, Gap[]>();
    for (const f of facts) {
      if (!f.place) continue;
      const own = facts.filter((x) => x.place === f.place).flatMap((x) => x.years);
      const spans = [...(own.length ? [span(own)] : []), ...(r.mapOf(f.place)?.regions ?? []).map((g) => lived.get(g.id))].filter((g): g is Gap => !!g);
      const names = [f.place, ...alsoOf(tree, records, f.place, r.mapOf(f.place))];
      for (const n of names) atPlace.set(foldText(n), [...(atPlace.get(foldText(n)) ?? []), ...spans]);
      if (!atPlace.has(foldText(f.place))) atPlace.set(foldText(f.place), []);
    }
    for (const e of r.local) {
      if (e.retracted || hiddenHere(e.id) || hiddenAt(e.id, e.place)) continue;
      const s = sources.get(e.local.source);
      if (!s || s.retracted) continue;
      const spans = atPlace.get(foldText(e.place));
      if (!spans?.some((g) => e.from <= g.to && e.to >= g.from)) continue;
      const had = found.get(e.id);
      if (had) continue;
      found.set(e.id, {
        id: e.id,
        from: e.from,
        to: e.to,
        ...(e.date ? { date: e.date } : {}),
        kind: (EVENT_KINDS as readonly string[]).includes(e.kind) ? e.kind : "other",
        scope: "local",
        places: [],
        text: textIn(e.text, lang),
        ...ageAt(e.from),
        source: { record: e.local.source, cite: e.local.cite },
        at: new Set([e.place]),
        reach: 0,
      });
    }
  }

  // the same event of two regions (a land's catalog holds its state's), or of a place and its region: once, the nearer one's
  const kept: (StoryEvent & { at: Set<string>; reach: number; of?: string })[] = [];
  for (const x of [...found.values()].sort((a, b) => a.reach - b.reach)) {
    if (x.from > both.to || x.to < both.from) continue;
    const same = x.scope !== "local" && kept.some((k) => k.scope !== "local" && k.of !== x.of && k.kind === x.kind && k.from === x.from && k.to === x.to && (!k.date || !x.date || k.date === x.date));
    if (!same) kept.push(x);
  }
  return kept
    .map(({ at, reach: _r, of: _o, ...e }) => ({ ...e, places: [...at].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.from - b.from || a.to - b.to || a.id.localeCompare(b.id));
}

/** An event of the history by its ID, as a story's sources show it: its years, text and where it is from (none: gone). */
export function historyEventLine(tree: Tree, shared: string | undefined, id: string): string | undefined {
  const lang = tree.lang;
  const yrs = (e: { from: number; to: number }) => (e.from === e.to ? String(e.from) : `${e.from}–${e.to}`);
  if (/^L\d+$/.test(id)) {
    const e = readLocal(tree).events.find((x) => x.id === id);
    return e ? `${yrs(e)} ${textIn(e.text, lang)} — ${e.local.source} ${e.local.cite}${e.retracted ? " (taken back since)" : ""}` : undefined;
  }
  const e = shared ? eventCatalog(shared, id)?.events.find((x) => x.id === id) : undefined;
  return e ? `${yrs(e)} ${textIn(e.text, lang)} — ${e.source.title} ${e.source.url}${e.retracted ? " (taken back since)" : ""}` : undefined;
}

/**
 * The people of the tree an event of the history shows at (their stories, the Strom app's person): those whose facts
 * at its places fall in its years as storyHistory reads them — after strom history add, said to the person (K2.8).
 */
export function whoSees(tree: Tree, shared: string | undefined, id: string): string[] {
  const r = reading(tree, shared);
  // only those with a fact at one of its places are read through (a region's: the places mapped to it; a place's: those of
  // its record; a local one: its place)
  const region = regionOfEvent(id);
  const key = placeOfEvent(id);
  const recordOf = placeRecordOf(tree.list<Place>("place"));
  const local = /^L\d+$/u.test(id) ? readLocal(tree).events.find((e) => e.id === id) : undefined;
  const at = (place: string): boolean => {
    if (region) return !!r.mapOf(place)?.regions.some((g) => g.id === region);
    if (key) {
      const rec = recordOf(place);
      const p = rec ? placeRecord(tree, rec) : undefined;
      return !!p && placeKeyOf(tree, p) === key;
    }
    return !!local && foldText(place) === foldText(local.place);
  };
  const fits = new Map<string, boolean>();
  const near = (place: string | undefined) => {
    const k = place ? lineValue(place) : "";
    if (!k) return false;
    if (!fits.has(k)) fits.set(k, at(k));
    return fits.get(k)!;
  };
  const families = tree.list<Family>("family").filter((f) => !f.retracted);
  return tree
    .list<Person>("person")
    .filter((p) => !p.retracted && !p.mergedInto)
    .filter((p) => p.events.some((e) => near(e.place)) || families.some((f) => f.partners.includes(p.id) && f.events.some((e) => near(e.place))))
    .filter((p) => storyHistory(tree, shared, p.id, r).some((e) => e.id === id))
    .map((p) => p.id);
}

/**
 * The events of the history a story is to cite (story set --history): only with the history in the stories
 * (stories.history, the history on), each one of storyHistory's for its person or couple — never one hidden, deleted,
 * taken back, or of other places and years.
 */
export function checkStoryHistory(tree: Tree, shared: string | undefined, owner: string, ids: string[], settings: Settings = new Settings(tree.env, {})): string[] {
  const given = [...new Set(ids.map((id) => id.trim()).filter(Boolean).map((id) => (/^l\d+$/i.test(id) ? id.toUpperCase() : id)))];
  if (!given.length) return [];
  if (!settings.storyHistory(tree.config))
    throw new UsageError("the history of the places is not in the stories here (stories.history no, or the history of the places off): no --history", { code: "story.history.off" });
  const allowed = new Set(storyHistory(tree, shared, owner).map((e) => e.id));
  for (const id of given)
    if (!allowed.has(id))
      throw new UsageError(`${id} is no event of the history of ${owner}'s places in the years lived there (or the person hid or deleted it)`, { hint: `the brief of the story lists those it may tell`, code: "story.history", params: { event: id } });
  return given;
}
