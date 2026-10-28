// What the ancestors lived through (experiments.history): the events of history at the places of the
// tree — wars, epidemics, censuses, changes of the state — and the local ones the research read in its own records.
//
// Where it lies, written by strom alone:
// - <shared>/history/regions/<region>.json: a region's catalog, shared by every tree of the user (under the lock of
//   <shared>/history/), never in a tree's git — its events only ever added, their IDs never given again;
// - <tree>/history/places.json: each place of the tree's facts (as `2 PLAC` of the GEDCOM writes it) → its regions
//   with the years it belonged to them, or not located;
// - <tree>/history/local.json: the local events read in the tree's own sources;
// - <tree>/history/hidden.json: what the person hid, at a place or a person.
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

/** The task of a tree that maps its places to regions (core/queue: level enrich, one a tree). */
export const HISTORY_PLACES_ORIGIN = "history:places";
/** The prefix of a region's task (`history:region:<id>`, one a region). */
export const HISTORY_REGION_ORIGIN = "history:region:";
/** The level the tasks of history take (an existing one: a new value of the list would raise SCHEMA_VERSION). */
export const HISTORY_LEVEL = "enrich";

/** A region's task origin. */
export function regionOrigin(region: string): string {
  return `${HISTORY_REGION_ORIGIN}${region}`;
}

/** Is it a task of the history (history:places, history:region:<id>)? */
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
  state?: "unlocated";
  why?: string;
  at: string;
}

export interface Hide {
  event: string;
  place?: string;
  person?: string;
  at: string;
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
  return /^[a-z0-9](?:[a-z0-9-]{0,23})$/.test(id) && !id.endsWith("-");
}

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
  return Array.isArray(f?.hidden) ? f!.hidden : [];
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

function nfc(t: Texts): Texts {
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

const overlap = (a: { from: number; to: number }, b: { from: number; to: number }) => a.from <= b.to && b.from <= a.to;

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
function sameEvents<E extends { id: string; kind: string; from: number; to: number }>(events: E[], e: { kind: string; from: number; to: number }, s: Sameness, key: (x: E) => boolean = () => true): E[] {
  return events.filter((x) => x.id !== s.replaces && x.kind === e.kind && overlap(x, e) && key(x));
}

function refuseSame(ids: string[], what: string): never {
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
      if ([same.source, ...(same.sources ?? [])].some((x) => x.url === e.source.url && foldText(x.quote) === foldText(e.source.quote))) return { id: same.id, same: true };
      same.sources = [...(same.sources ?? []), e.source];
      writeCatalog(shared, c);
      return { id: same.id, same: true };
    }
    const replaced = s.replaces ? c.events.find((x) => x.id === s.replaces) : undefined;
    if (s.replaces && !replaced) throw new UsageError(`there is no event ${s.replaces} in ${e.region}`, { code: "history.event", params: { event: s.replaces } });
    const same = sameEvents(c.events, e, s);
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
export function refuseBeforePage(shared: string, region: string, e: { kind: string; from: number; to: number }, s: Sameness): void {
  const c = readCatalog(shared, region);
  if (!c) return;
  for (const id of [s.sameAs, s.replaces]) if (id && !c.events.some((x) => x.id === id)) throw new UsageError(`there is no event ${id} in ${region}`, { code: "history.event", params: { event: id } });
  if (s.sameAs || s.distinct) return;
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
    return { id: same.id, same: true };
  }
  const replaced = s.replaces ? f.events.find((x) => x.id === s.replaces) : undefined;
  if (s.replaces && !replaced) throw new UsageError(`there is no local event ${s.replaces}`, { code: "history.event", params: { event: s.replaces } });
  const same = sameEvents(f.events, e, s, (x) => x.local.source === e.source);
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

/** A place of the facts mapped to its regions with years, or said not located (inside the tree's lock). */
export function mapPlace(tree: Tree, place: string, m: { regions: RegionLink[]; also?: string[] } | { unlocated: true; why?: string }): PlaceMap {
  const places = readPlaces(tree);
  const key = lineValue(place);
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

/** An event taken back (it was wrong): never sent again; what was hidden on it stays (and moves to what replaced it). */
export function retractEvent(tree: Tree, shared: string | undefined, id: string, why: string): { id: string; scope: "region" | "local" } {
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
  const region = regionOfEvent(id);
  if (!shared || !region) throw new UsageError(`there is no event ${id}`, { code: "history.event", params: { event: id } });
  withCatalogs(shared, () => {
    const c = readCatalog(shared, region);
    const e = c?.events.find((x) => x.id === id);
    if (!c || !e) throw new UsageError(`there is no event ${id}`, { code: "history.event", params: { event: id } });
    if (e.retracted) return;
    e.retracted = { at, why: reason };
    writeCatalog(shared, c);
  });
  return { id, scope: "region" };
}

/** A region's event ID → its region ("cz-bohemia-0007" → "cz-bohemia"). */
export function regionOfEvent(id: string): string | undefined {
  const m = /^([a-z0-9][a-z0-9-]*)-(\d{4,})$/.exec(id);
  return m && regionIdOk(m[1]!) ? m[1] : undefined;
}

/** A region's catalog finished (strom history done): searched again only on the person's word (redo). */
export function markDone(shared: string, region: string, treeId: string): Catalog {
  requireRegionId(region);
  return withCatalogs(shared, () => {
    const c = readCatalog(shared, region);
    if (!c) throw new UsageError(`there is no region ${region}`, { code: "history.region.missing", params: { region } });
    c.done = { at: new Date().toISOString(), tree: treeId };
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
    c.redo = new Date().toISOString();
    writeCatalog(shared, c);
    return c;
  });
}

/** Does this event exist (any state) — in the tree's local ones or a region's catalog? */
export function eventExists(tree: Tree, shared: string | undefined, id: string): boolean {
  if (/^L\d+$/.test(id)) return readLocal(tree).events.some((e) => e.id === id);
  const region = regionOfEvent(id);
  return !!shared && !!region && !!readCatalog(shared, region)?.events.some((e) => e.id === id);
}

/**
 * An event's ID at the end of its chain of replacements (--replaces, within its catalog or the local ones), and whether
 * that one is taken back with nothing in its place. Each file read once.
 */
function replacements(tree: Tree, shared: string | undefined): (id: string) => { id: string; gone: boolean } {
  const files = new Map<string, Map<string, { retracted?: Retracted }>>();
  const eventsOf = (id: string) => {
    const key = /^L\d+$/.test(id) ? "" : regionOfEvent(id);
    if (key === undefined) return undefined;
    if (!files.has(key)) {
      const list: { id: string; retracted?: Retracted }[] = key === "" ? readLocal(tree).events : ((shared ? readCatalog(shared, key)?.events : undefined) ?? []);
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

/**
 * The person hides an event at a place or a person of this tree, or shows it again (`show`). An unknown place is no
 * error (it may have come from the app); an unknown event or person is. An event replaced (--replaces) is the one that
 * took its place: hidden, shown again or found hidden by its old ID or its new. Inside the tree's lock; the hidden list
 * after as the app reads it (historyAnswer): each at the event that took its place, the person merged into, none taken
 * back for good.
 */
export function hideEvent(tree: Tree, shared: string | undefined, h: { event: string; place?: string; person?: string }, show = false): Hide[] {
  if (!h.event || (h.place === undefined) === (h.person === undefined)) throw new UsageError("an event, and a place or a person (one of them)", { code: "history.body" });
  if (!eventExists(tree, shared, h.event)) throw new UsageError(`there is no event ${h.event}`, { code: "history.event", params: { event: h.event } });
  if (h.person !== undefined && !tree.get<Person>(h.person)) throw new UsageError(`there is no person ${h.person}`, { code: "history.person", params: { person: h.person } });
  const place = h.place === undefined ? undefined : lineValue(h.place);
  const current = replacements(tree, shared);
  const event = current(h.event).id;
  const person = h.person !== undefined ? (resolvePerson(tree, h.person) ?? h.person) : undefined;
  const hidden = readHidden(tree);
  const same = (x: Hide) =>
    current(x.event).id === event &&
    (place !== undefined ? x.place !== undefined && foldText(x.place) === foldText(place) : x.person !== undefined && (resolvePerson(tree, x.person) ?? x.person) === person);
  const had = hidden.some(same);
  if (show ? !had : had) return asRead(tree, hidden, current);
  const next = show ? hidden.filter((x) => !same(x)) : [...hidden, { event, ...(place !== undefined ? { place } : { person: person! }), at: new Date().toISOString() }];
  const where = place !== undefined ? place : person!;
  putTreeFile(tree, HIDDEN_FILE, { hidden: next }, { op: show ? "history.show" : "history.hide", targets: person ? [person] : [], summary: `${show ? "Shown again" : "Hidden"}: event ${event} at ${where}` });
  return asRead(tree, next, current);
}

/** What is hidden as the app reads it: at the event that took its place, the person merged into; once each. */
function asRead(tree: Tree, hidden: Hide[], current: (id: string) => { id: string; gone: boolean }): Hide[] {
  const out: Hide[] = [];
  const seen = new Set<string>();
  for (const h of hidden) {
    const e = current(h.event);
    if (e.gone) continue;
    const person = h.person !== undefined ? resolvePerson(tree, h.person) : undefined;
    if (h.person !== undefined && !person) continue;
    const k = `${e.id}\u0000${h.place !== undefined ? `p:${foldText(h.place)}` : `o:${person}`}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ event: e.id, ...(h.place !== undefined ? { place: h.place } : { person: person! }), at: h.at });
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
  scope: "region" | "local";
  region?: { id: string; name: Texts };
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
}

export type SearchState = "none" | "running" | "done" | "waiting";

export interface HistoryAnswer {
  state: { on: boolean; search: SearchState; why?: string; at?: string; pending: number; rev: string; truncated?: true };
  lang: string;
  events: AppEvent[];
  places: Record<string, AppPlace>;
  hidden: { event: string; place?: string; person?: string; at: string }[];
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

/** What the tree's places are, read once: the facts' places, their mapping, the catalogs of their regions. */
interface Reading {
  facts: Map<string, number[]>;
  maps: Record<string, PlaceMap>;
  /** A map by the folded key: the place written otherwise (decomposed) is the same place. */
  mapOf: (key: string) => PlaceMap | undefined;
  catalogs: Map<string, Catalog | undefined>;
  catalog: (id: string) => Catalog | undefined;
  local: LocalEvent[];
}

function reading(tree: Tree, shared: string | undefined): Reading {
  const facts = factPlaces(tree);
  const maps = readPlaces(tree);
  const folded = new Map<string, PlaceMap>();
  for (const [k, v] of Object.entries(maps)) folded.set(foldText(k), v);
  const catalogs = new Map<string, Catalog | undefined>();
  const catalog = (id: string) => {
    if (!catalogs.has(id)) catalogs.set(id, shared ? readCatalog(shared, id) : undefined);
    return catalogs.get(id);
  };
  return { facts, maps, mapOf: (k) => maps[k] ?? folded.get(foldText(k)), catalogs, catalog, local: readLocal(tree).events };
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

/** The regions the tree's places belong to (any years). */
export function regionsOfTree(tree: Tree): string[] {
  return [...new Set(Object.values(readPlaces(tree)).flatMap((m) => m.regions.map((g) => g.id)))].filter(regionIdOk).sort();
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
function historySessions(tree: Tree): { running: boolean; ended?: string } {
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
export function heldElsewhere(c: Catalog | undefined, treeId: string, now = Date.now()): boolean {
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
  const regional = (m: PlaceMap | undefined): string[] => {
    if (!m || m.state === "unlocated") return [];
    const found: { e: RegionEvent; c: Catalog; reach: number }[] = [];
    for (const g of m.regions) {
      const c = r.catalog(g.id);
      for (const e of c?.events ?? []) {
        if (e.retracted) continue;
        if (!inRegion(e, g)) continue;
        found.push({ e, c: c!, reach: reach.get(g.id) ?? 0 });
      }
    }
    const nearer = [...found].sort((a, b) => a.reach - b.reach);
    const kept: typeof found = [];
    for (const x of nearer) {
      const same = kept.some((k) => k.c.region.id !== x.c.region.id && k.e.kind === x.e.kind && k.e.from === x.e.from && k.e.to === x.e.to && (!k.e.date || !x.e.date || k.e.date === x.e.date));
      if (!same) kept.push(x);
    }
    const keep = new Set(kept.map((x) => x.e.id));
    const ids: string[] = [];
    for (const x of found) {
      if (!keep.has(x.e.id)) continue;
      if (!events.has(x.e.id)) events.set(x.e.id, appRegionEvent(x.e, x.c));
      ids.push(x.e.id);
    }
    return ids;
  };

  // the local events: their source still the research's, its place one of the tree's (or its own name)
  const localAt = new Map<string, string[]>();
  const keys = [...r.facts.keys()];
  const byFold = new Map<string, string>();
  for (const k of keys) byFold.set(foldText(k), k);
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

  for (const key of new Set([...keys, ...localAt.keys()])) {
    const m = r.mapOf(key);
    const state = r.facts.has(key) ? placeState(r, key) : m?.state === "unlocated" ? "unlocated" : undefined;
    const ids = [...new Set([...regional(m), ...(localAt.get(key) ?? [])])];
    if (!ids.length && !state) continue; // a place done with nothing: left out (the app: "nothing found")
    const also = alsoOf(tree, records, key, m);
    places.set(key, { events: ids, ...(also.length ? { also } : {}), ...(state ? { state } : {}) });
  }
  // the replacements, of every catalog read (only now are they all read)
  for (const c of r.catalogs.values()) for (const e of c?.events ?? []) if (e.retracted?.replacedBy) replaced.set(e.id, e.retracted.replacedBy);
  // the 2 PLAC key of a place pending though no region of it is known yet: in `places` already; counted
  const pending = keys.filter((k) => placeState(r, k) === "pending").length;

  // the places with events first, then those waiting, then those not located — within the limits
  const order = (p: AppPlace) => (p.events.length ? 0 : p.state === "pending" ? 1 : 2);
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
    const event = resolveEvent(h.event, known, replaced);
    if (!event || !live.has(event)) continue;
    const person = h.person !== undefined ? resolvePerson(tree, h.person) : undefined;
    if (h.person !== undefined && !person) continue;
    const k = `${event}\u0000${h.place !== undefined ? `p:${foldText(h.place)}` : `o:${person}`}`;
    if (seen.has(k)) continue;
    seen.add(k);
    hidden.push({ event, ...(h.place !== undefined ? { place: h.place } : { person: person! }), at: h.at });
  }

  const search = searchState(tree, r, on, pending);
  return {
    state: { on, ...search, pending, rev: historyRev(tree, shared, settings), ...(truncated ? { truncated: true as const } : {}) },
    lang: tree.lang,
    events: list,
    places: Object.fromEntries(sorted),
    hidden,
  };
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
  const parts = [historyOn(tree, settings) ? "on" : "off"];
  for (const rel of [PLACES_FILE, LOCAL_FILE, HIDDEN_FILE]) parts.push(stat(path.join(tree.root, ...rel.split("/"))));
  if (shared) for (const id of regionsOfTree(tree)) parts.push(`${id}=${stat(regionFile(shared, id))}`);
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
  places: { total: number; pending: string[]; unlocated: number; mapped: number };
  regions: { id: string; name?: Texts; events: number; retracted: number; done?: string; heldBy?: string; tried: number }[];
  local: { events: number; retracted: number };
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
      retracted: c?.events.filter((e) => e.retracted).length ?? 0,
      ...(c?.done ? { done: c.done.at } : {}),
      ...(c && heldElsewhere(c, tree.config.id) ? { heldBy: c.holder!.tree } : {}),
      tried: c?.tried.length ?? 0,
    };
  });
  const kindOf = new Map<string, string>();
  for (const c of r.catalogs.values()) for (const e of c?.events ?? []) kindOf.set(e.id, e.kind);
  for (const e of r.local) kindOf.set(e.id, e.kind);
  const hides = readHidden(tree);
  const byKind: Record<string, number> = {};
  for (const h of hides) {
    const k = kindOf.get(h.event) ?? (shared && regionOfEvent(h.event) ? readCatalog(shared, regionOfEvent(h.event)!)?.events.find((e) => e.id === h.event)?.kind : undefined) ?? "other";
    byKind[k] = (byKind[k] ?? 0) + 1;
  }
  return {
    on: historyOn(tree, settings),
    places: { total: keys.length, pending, unlocated: keys.filter((k) => placeState(r, k) === "unlocated").length, mapped: keys.filter((k) => !!r.mapOf(k)).length },
    regions,
    local: { events: r.local.filter((e) => !e.retracted).length, retracted: r.local.filter((e) => e.retracted).length },
    hidden: { total: hides.length, byKind },
  };
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
    if (!more.length) return { added: 0 };
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
  return [...r.facts.keys()].filter((k) => !r.mapOf(k)).sort((a, b) => a.localeCompare(b));
}

/** A region's name in a language (else English, else its ID). */
export function regionName(c: Pick<Catalog, "region"> | undefined, lang: string, id = c?.region.id ?? ""): string {
  return c?.region.name[lang] ?? c?.region.name.en ?? id;
}

/** The region of a task of history (history:region:<id>), else undefined. */
export function regionOfTask(t: Pick<Task, "origin">): string | undefined {
  return typeof t.origin === "string" && t.origin.startsWith(HISTORY_REGION_ORIGIN) ? t.origin.slice(HISTORY_REGION_ORIGIN.length) || undefined : undefined;
}

/** History is looked for from this year at the earliest. */
const EARLIEST_YEAR = 1600;

/**
 * The period the events of a region are looked for in, for this tree: from the oldest year of the facts at its places
 * (within the years each place belonged to it; never before 1600) to this year — this tree's places only (each tree
 * that shares the region adds its own period when it takes it).
 */
export function regionPeriod(tree: Tree, region: string): { from: number; to: number; places: { place: string; from?: number; to?: number; years: number[] }[] } {
  const r = reading(tree, undefined);
  const places: { place: string; from?: number; to?: number; years: number[] }[] = [];
  for (const [key, years] of r.facts) {
    const m = r.mapOf(key);
    for (const link of m?.regions ?? []) {
      if (link.id !== region) continue;
      const inside = years.filter((y) => y >= (link.from ?? -Infinity) && y <= (link.to ?? Infinity));
      places.push({ place: key, ...(link.from !== undefined ? { from: link.from } : {}), ...(link.to !== undefined ? { to: link.to } : {}), years: inside });
    }
  }
  const to = new Date().getFullYear();
  const oldest = Math.min(...places.flatMap((p) => p.years.length ? p.years : p.from !== undefined ? [p.from] : []));
  const from = Number.isFinite(oldest) ? Math.min(to, Math.max(EARLIEST_YEAR, oldest)) : EARLIEST_YEAR;
  return { from, to, places: places.sort((a, b) => a.place.localeCompare(b.place)) };
}

/**
 * A region taken by this tree for a session on its task: the holder written into the shared catalog (refreshed when it
 * is this tree's already). Another tree's hold within HOLD_DAYS stays: its ID is returned (nothing written).
 */
export function takeRegion(shared: string, region: string, treeId: string): string | undefined {
  if (!regionIdOk(region)) return undefined;
  return withCatalogs(shared, () => {
    const c = readCatalog(shared, region);
    if (!c || c.done) return undefined;
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
  const open = new Map([...tasks.values()].filter((t) => ofRegion(t) && (t.state === "open" || t.state === "doing")).map((t) => [regionOfTask(t)!, t]));
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
  return (t) => {
    if (t.origin === HISTORY_PLACES_ORIGIN) return 0;
    if (turn?.asked?.task === t.id) return 1;
    if (turn?.prefer?.task === t.id) return 2;
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
  return tree.withTreeLock(() => {
    const before = readFirst(tree);
    const task = tree.list<Task>("task").find((t) => t.origin === regionOrigin(id) && LIVE_STATES.has(t.state))?.id;
    if (before[0]?.region === id) return { first: before, ...(task ? { task } : {}) };
    const first = [{ region: id, at: new Date().toISOString() }, ...before.filter((x) => x.region !== id)].slice(0, FIRST_MAX);
    putTreeFile(tree, FIRST_FILE, { first }, { op: "history.first", targets: [], summary: `History first: ${id}` });
    return { first, ...(task ? { task } : {}) };
  });
}

/**
 * What keeps a task of history out of the queue now — nothing written, computed afresh: the experiment off (the tasks
 * stay as they are and come back when it is on again), a research that acts as an archive, or a region another tree
 * builds within HOLD_DAYS. Undefined for a task that may be taken (and for any other task).
 */
export function historyHeld(tree: Tree, shared: string | undefined, settings: Settings = new Settings(tree.env, {})): (t: Task) => "off" | "archive" | "held" | undefined {
  let state: "off" | "archive" | undefined | null = null;
  return (t) => {
    if (!forHistory(t)) return undefined;
    if (state === null) state = !historyOn(tree, settings) ? "off" : actsAsArchive(tree) ? "archive" : undefined;
    if (state) return state;
    const region = regionOfTask(t);
    if (region && shared && heldElsewhere(readCatalog(shared, region), tree.config.id)) return "held";
    return undefined;
  };
}

/**
 * The tasks of history raised while the experiment is on in a research (never in an archive, nor one waiting for its
 * agent, never in a dry run): one to map the places of the facts while any is not mapped, one for each region of the
 * tree's places whose catalog is not finished — level enrich, priority 1, after all the research in the queue. Never a
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
    // the regions of its places
    for (const id of regionsOfTree(tree)) {
      const c = readCatalog(shared, id);
      if (!c) continue;
      const origin = regionOrigin(id);
      const mine = tasks.filter((t) => t.origin === origin);
      if (c.done) {
        // finished meanwhile (another tree, strom history done): its waiting task is done too — one at work closes itself
        for (const t of mine.filter((x) => x.state === "open" || x.state === "parked"))
          update<Task>(tree, t.id, "task", (x) => ({ ...x, state: "done", result: phrase(lang, "history.region.finished", { region: regionName(c, lang, id) }) }), {
            op: "task.done",
            summary: `${t.id} done: the catalog of ${id} is finished`,
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
    return made;
  });
}

/** A region's task finished (strom session close --done): its catalog finished too, when it is not yet. */
export function finishRegionOf(tree: Tree, shared: string | undefined, t: Task): void {
  const region = regionOfTask(t);
  if (!region || !shared || tree.dryRun) return;
  const c = readCatalog(shared, region);
  if (c && !c.done) markDone(shared, region, tree.config.id);
}
