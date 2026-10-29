// The history of a place and its surroundings (spec 020 K7, the Strom app's R6): the events of one village, its parish
// or estate and its near surroundings (~10 km) — fires, floods, a battle by the next village, a change of the estate or
// the parish, the school, the chronicle — looked for in one session of the agent on the person's word (strom history
// place L…, the app's link history&do=search: the top of the queue, whatever the pace), or by itself for the places
// with coordinates (experiments.historyPlaces, K7.4: at the pace of the history, the places of the most people first).
//
// Where it lies, written by strom alone:
// - <shared>/history/places/<key>.json: a place's catalog — shared by every tree of the user that has the place: the
//   key from its coordinates in hundredths of a degree (PLACE_KEY, p-4962n-1507e); a place without coordinates has a
//   catalog of its tree alone (t-<tree>-l0001) — under the lock of the regions' catalogs, never in a tree's git;
// - <tree>/history/first.json `places`: the places the person asked for (the newest first): their task first of all.
// The events of the regions the place belonged to are never written again for it (sameness against them, the brief
// lists them); the answer for the app shows each event once (core/pastevents.ts historyAnswer). Nothing goes into
// data/, nothing into the GEDCOM: no SCHEMA_VERSION, no gate of the app.

import fs from "node:fs";
import path from "node:path";
import { readJsonIfExists, stringifyCanonical, writeFileAtomic } from "./json.ts";
import { foldText } from "./text.ts";
import { Settings } from "./config.ts";
import { actsAsArchive } from "./state.ts";
import { phrase } from "./phrases.ts";
import { UsageError } from "./errors.ts";
import { create, update } from "./records.ts";
import { factWritten } from "../gedcom/export.ts";
import { dateYears } from "./gdate.ts";
import { lineValue } from "../gedcom/lines.ts";
import {
  checkTexts,
  checkYears,
  deletedByPerson,
  FIRST_FILE,
  heldElsewhere,
  placesOn,
  historyRoot,
  inRegion,
  nfc,
  PLACE_KEY,
  placeRecordOf,
  historyPlaces,
  readCatalog,
  readFirst,
  readPlaces,
  readSkips,
  refuseDeleted,
  refuseNamedDeleted,
  refuseSame,
  REGION_LANGS,
  sameEvents,
  withCatalogs,
  HISTORY_LEVEL,
  type Catalog,
  type EventKind,
  type EventSource,
  type RegionEvent,
  type Sameness,
  type Texts,
} from "./pastevents.ts";
import type { Family, Person, Place, Session, Task } from "./model.ts";
import type { Tree } from "./tree.ts";

/** The origin of a place's task: history:place:<L…> (the place record of the research). */
export const HISTORY_PLACE_ORIGIN = "history:place:";

/** A place record's ID as a link and the bridge take it (never a place's words). */
export const PLACE_ID = /^L\d{1,9}$/u;

/** How far around a place its history reaches by default (the brief, the default area). */
export const AREA_KM = 10;

/** One place's session: its minutes, as the app says them before the person asks (the bridge's /status). */
export const PLACE_MINUTES: [number, number] = [15, 30];

/** How many measured sessions of history give the estimate its price. */
const MEASURED_MIN = 3;

/** The places raised by themselves (experiments.historyPlaces) open at once: the next when one is done. */
const AUTO_OPEN = 3;

/** How many places the research suggests (the app's K7.3) and how many asks it keeps. */
const SUGGEST_MAX = 10;
const ASKS_MAX = 50;

/** The states of a task still to be worked on (or at work). */
const LIVE_STATES = new Set<Task["state"]>(["open", "doing", "parked", "waiting"]);

export interface PlaceCatalog {
  /** The key (its file), the place's names when it was made, its coordinates; a catalog of one tree alone: that tree. */
  place: { key: string; name: Texts; coords?: { lat: number; lon: number }; tree?: string };
  /** What its session looked through: the parish, the estate, the surroundings (cs, en, de). */
  area?: Texts;
  next: number;
  events: RegionEvent[];
  tried: { url: string; at: string; why: string }[];
  done?: { at: string; tree: string };
  holder?: { tree: string; since: string };
  /** When the person asked for it to be looked for again: a task of it dropped before is no answer since. */
  redo?: string;
}

/** A place asked for by the person, and when (the newest first). */
export interface PlaceAsk {
  place: string;
  at: string;
}

export function placeOrigin(id: string): string {
  return `${HISTORY_PLACE_ORIGIN}${id}`;
}

/** The place record of a place's task, or undefined. */
export function placeOfTask(t: Pick<Task, "origin">): string | undefined {
  return t.origin.startsWith(HISTORY_PLACE_ORIGIN) ? t.origin.slice(HISTORY_PLACE_ORIGIN.length) || undefined : undefined;
}

export function placesDir(shared: string): string {
  return path.join(historyRoot(shared), "places");
}

export function placeKeyOk(key: string): boolean {
  return PLACE_KEY.test(key);
}

export function placeFile(shared: string, key: string): string {
  return path.join(placesDir(shared), `${key}.json`);
}

/** A place's key: by its coordinates (shared), else of this tree alone. */
export function placeKeyOf(tree: Tree, p: Pick<Place, "id" | "coords">): string {
  const c = p.coords;
  if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon) && Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180) {
    const lat = Math.round(c.lat * 100);
    const lon = Math.round(c.lon * 100);
    return `p-${Math.abs(lat)}${lat < 0 ? "s" : "n"}-${Math.abs(lon)}${lon < 0 ? "w" : "e"}`;
  }
  return `t-${tree.config.id.replace(/-/gu, "").slice(0, 8).toLowerCase()}-${p.id.toLowerCase()}`;
}

/** A place's catalog, or undefined (none yet, or one unreadable: never thrown at a reader). */
export function readPlaceCatalog(shared: string, key: string): PlaceCatalog | undefined {
  if (!placeKeyOk(key)) return undefined;
  try {
    const c = readJsonIfExists<PlaceCatalog>(placeFile(shared, key));
    if (!c || typeof c !== "object" || !Array.isArray(c.events) || typeof c.place?.key !== "string") return undefined;
    return { ...c, tried: Array.isArray(c.tried) ? c.tried : [], next: Number.isInteger(c.next) ? c.next : c.events.length + 1 };
  } catch {
    return undefined;
  }
}

export function writePlaceCatalog(shared: string, c: PlaceCatalog): void {
  writeFileAtomic(placeFile(shared, c.place.key), stringifyCanonical(c));
}

/** Every place catalog of the shared folder. */
export function placeCatalogKeys(shared: string): string[] {
  try {
    return fs
      .readdirSync(placesDir(shared))
      .filter((n) => n.endsWith(".json"))
      .map((n) => n.slice(0, -5))
      .filter(placeKeyOk)
      .sort();
  } catch {
    return [];
  }
}

/** A place's event ID → its catalog's key ("p-4962n-1507e-0003" → "p-4962n-1507e"). */
export function placeOfEvent(id: string): string | undefined {
  const m = /^(.+)-(\d{4,})$/u.exec(id);
  return m && placeKeyOk(m[1]!) ? m[1] : undefined;
}

/** The research's place record of that ID, not taken back. */
export function placeRecord(tree: Tree, id: string): Place | undefined {
  if (!PLACE_ID.test(id)) return undefined;
  const p = tree.get<Place>(id);
  return p && p.type === "place" && !p.retracted ? p : undefined;
}

export function requirePlace(tree: Tree, id: string): Place {
  const p = placeRecord(tree, id.trim());
  if (!p) throw new UsageError(`there is no place ${id} in the research (strom place list)`, { code: "history.place", params: { place: id } });
  return p;
}

/** A place's names in cs, en and de: the one of that language, else its first. */
export function placeNames(p: Place): Texts {
  const first = lineValue(p.names[0]?.name ?? p.id);
  return Object.fromEntries(REGION_LANGS.map((l) => [l, lineValue(p.names.find((n) => n.lang === l)?.name ?? first) || first]));
}

/** A place's name in a language. */
export function placeLabel(p: Place, lang: string): string {
  const n = placeNames(p);
  return n[lang] ?? n.en ?? p.id;
}

/** The default reach of a place's history before its session says its own (cs, en, de). */
export function defaultArea(p: Place): Texts {
  return Object.fromEntries(REGION_LANGS.map((l) => [l, phrase(l, "history.place.area", { place: placeNames(p)[l] ?? p.id, km: AREA_KM })]));
}

/** What the tree has at each place record: the places of its facts (as written), their years, the people, the facts. */
export interface AtPlace {
  keys: string[];
  years: number[];
  persons: Set<string>;
  facts: number;
}

/** The tree's facts by their place record (a place the person skipped left out: no history through it). */
export function factsByRecord(tree: Tree): Map<string, AtPlace> {
  const recordOf = placeRecordOf(tree.list<Place>("place"));
  const h = historyPlaces(tree);
  const skipped = new Set(readSkips(tree).places.map((x) => foldText(h.keyOf(x.place))));
  const out = new Map<string, AtPlace>();
  const at = (raw: string | undefined) => {
    // a place with a street or a house number: its municipality's
    const key = raw ? h.keyOf(raw) : "";
    if (!key || skipped.has(foldText(key))) return undefined;
    const id = recordOf(key);
    if (!id) return undefined;
    const a = out.get(id) ?? { keys: [], years: [], persons: new Set<string>(), facts: 0 };
    out.set(id, a);
    if (!a.keys.includes(key)) a.keys.push(key);
    return a;
  };
  const count = (who: string[], e: Person["events"][number]) => {
    if (!factWritten(e)) return;
    const a = at(e.place);
    if (!a) return;
    a.facts++;
    for (const p of who) a.persons.add(p);
    if (e.date) a.years.push(...dateYears(e.date));
  };
  const persons = tree.list<Person>("person").filter((p) => !p.retracted && !p.mergedInto);
  const alive = new Set(persons.map((p) => p.id));
  for (const p of persons) for (const e of p.events) count([p.id], e);
  for (const f of tree.list<Family>("family")) {
    const who = f.partners.filter((p) => alive.has(p));
    if (who.length) for (const e of f.events) count(who, e);
  }
  for (const a of out.values()) a.years = [...new Set(a.years)].sort((x, y) => x - y);
  return out;
}

/** The years of a place's people as a span (the brief), or undefined when no fact there has a year. */
export function yearsAt(a: AtPlace | undefined): { from: number; to: number } | undefined {
  if (!a?.years.length) return undefined;
  return { from: a.years[0]!, to: a.years[a.years.length - 1]! };
}

/** Is a place skipped by the person in this tree (any of its names)? */
function placeSkipped(tree: Tree, p: Place): boolean {
  const h = historyPlaces(tree);
  const skipped = new Set(readSkips(tree).places.map((x) => foldText(h.keyOf(x.place))));
  if (!skipped.size) return false;
  const names = new Set(p.names.map((n) => foldText(n.name)));
  const recordOf = placeRecordOf(tree.list<Place>("place"));
  for (const [k] of h.facts) if (skipped.has(foldText(k)) && (names.has(foldText(k)) || recordOf(k) === p.id)) return true;
  return false;
}

/**
 * The events of the regions a place belongs to, in the years it belonged to them (its facts' places mapped, strom
 * history map): what its own history never writes again. Not taken back; the place's own catalog apart.
 */
export function regionEventsAt(tree: Tree, shared: string | undefined, id: string, at = factsByRecord(tree).get(id)): { event: RegionEvent; region: Catalog }[] {
  if (!shared || !at) return [];
  const maps = readPlaces(tree);
  const folded = new Map(Object.entries(maps).map(([k, v]) => [foldText(k), v]));
  const out = new Map<string, { event: RegionEvent; region: Catalog }>();
  for (const key of at.keys) {
    const m = maps[key] ?? folded.get(foldText(key));
    for (const g of m?.regions ?? []) {
      const c = readCatalog(shared, g.id);
      for (const e of c?.events ?? []) if (!e.retracted && inRegion(e, g) && !out.has(e.id)) out.set(e.id, { event: e, region: c! });
    }
  }
  return [...out.values()].sort((a, b) => a.event.from - b.event.from || a.event.id.localeCompare(b.event.id));
}

// ── the person's asks ──────────────────────────────────────────────────────

export function readPlaceAsks(tree: Tree): PlaceAsk[] {
  try {
    const f = readJsonIfExists<{ places?: PlaceAsk[] }>(path.join(tree.root, ...FIRST_FILE.split("/")));
    return Array.isArray(f?.places) ? f!.places.filter((x) => typeof x?.place === "string" && PLACE_ID.test(x.place) && typeof x.at === "string") : [];
  } catch {
    return [];
  }
}

function putAsks(tree: Tree, places: PlaceAsk[], summary: string): void {
  tree.putFile(FIRST_FILE, stringifyCanonical({ first: readFirst(tree), places }), { op: "history.place", targets: [], summary });
}

/** The live task of a place's history, or undefined. */
export function placeTask(tree: Tree, id: string, tasks = tree.list<Task>("task")): Task | undefined {
  return tasks.find((t) => t.origin === placeOrigin(id) && LIVE_STATES.has(t.state));
}

/**
 * What refuses a place's history asked for whoever asks (the history of the places off, an archive): strom history place
 * says it before the person is asked, never after their yes.
 */
export function refusePlaceAsk(tree: Tree, settings: Settings = new Settings(tree.env, {})): void {
  if (!placesOn(tree, settings))
    throw new UsageError("the history of the places is off for this research — nothing is looked for, not even when asked", {
      code: "history.off",
      hint: "the user, in their terminal: strom config set experiments.placeHistory on --for-tree (this research) or strom config set experiments.placeHistory on (every research)",
    });
  if (actsAsArchive(tree)) throw new UsageError("an archive looks for nothing", { code: "history.archive" });
}

/**
 * The person asks for the history of a place and its surroundings (strom history place L…, the app's link
 * history&do=search after the person's yes in the terminal): its task made or kept, at the top of the queue — the next
 * session of strom run whatever the pace; a place looked for already is looked for again (its events stay). Only while
 * the history is on, in a research with its agent; a place record of the research the person did not skip. Inside the
 * tree's lock (the tree's first, then the catalogs').
 */
export function askPlace(tree: Tree, shared: string | undefined, id: string, settings: Settings = new Settings(tree.env, {})): { task: string; key: string; again: boolean; made: boolean } {
  refusePlaceAsk(tree, settings);
  if (!shared) throw new UsageError("no shared folder is set — the catalogs of the places live there", { code: "history.shared", hint: "strom setup" });
  const p = requirePlace(tree, id);
  if (placeSkipped(tree, p))
    throw new UsageError(`the history of ${placeLabel(p, "en")} is not looked for in this research (skipped) — nothing asked`, { code: "history.skipped", params: { place: p.id }, hint: `strom history unskip --place "${lineValue(p.names[0]?.name ?? "")}"` });
  const key = placeKeyOf(tree, p);
  return tree.withTreeLock(() => {
    let again = false;
    withCatalogs(shared, () => {
      const c = readPlaceCatalog(shared, key) ?? newCatalog(tree, p, key);
      if (c.done) {
        again = true;
        delete c.done;
        delete c.holder;
        c.redo = new Date().toISOString();
      }
      writePlaceCatalog(shared, c);
    });
    const live = placeTask(tree, p.id);
    const task = live?.id ?? createPlaceTask(tree, p).id;
    const asks = readPlaceAsks(tree);
    if (asks[0]?.place !== p.id || !live) putAsks(tree, [{ place: p.id, at: new Date().toISOString() }, ...asks.filter((x) => x.place !== p.id)].slice(0, ASKS_MAX), `History of the place asked for: ${p.id}`);
    return { task, key, again, made: !live };
  });
}

function newCatalog(tree: Tree, p: Place, key: string): PlaceCatalog {
  return {
    place: { key, name: nfc(placeNames(p)), ...(p.coords ? { coords: { lat: p.coords.lat, lon: p.coords.lon } } : { tree: tree.config.id }) },
    next: 1,
    events: [],
    tried: [],
  };
}

function createPlaceTask(tree: Tree, p: Place): Task {
  const name = placeLabel(p, tree.lang);
  return create<Task>(
    tree,
    "task",
    {
      level: HISTORY_LEVEL,
      priority: 1,
      subject: [],
      state: "open",
      what: phrase(tree.lang, "history.place.what", { place: name }),
      where: [phrase(tree.lang, "history.place.where", { km: AREA_KM })],
      why: phrase(tree.lang, "history.place.why"),
      doneWhen: phrase(tree.lang, "history.place.done"),
      origin: placeOrigin(p.id),
    },
    (tid) => `+${tid} task "history of the place ${p.id}" (history)`,
  );
}

/** A place's catalog made for its session (the brief, strom history add --place), its names refreshed. */
export function ensurePlaceCatalog(shared: string, tree: Tree, p: Place): PlaceCatalog {
  const key = placeKeyOf(tree, p);
  return withCatalogs(shared, () => {
    const c = readPlaceCatalog(shared, key);
    if (c) return c;
    const made = newCatalog(tree, p, key);
    writePlaceCatalog(shared, made);
    return made;
  });
}

// ── the session's writes ───────────────────────────────────────────────────

export interface PlaceEventInput {
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
 * Before its page is read (strom history add --place): what addPlaceEvent would refuse — an event of the place or of
 * its regions of the same kind and years with nothing said of it, one named that is not there — at once, no request.
 */
export function refusePlaceBeforePage(tree: Tree, shared: string, p: Place, e: { kind: string; from: number; to: number }, s: Sameness, url?: string): void {
  const c = readPlaceCatalog(shared, placeKeyOf(tree, p));
  for (const id of [s.sameAs, s.replaces]) {
    if (!id) continue;
    const named = c?.events.find((x) => x.id === id);
    if (!named) throw new UsageError(`there is no event ${id} of ${p.id}`, { code: "history.event", params: { event: id } });
    refuseNamedDeleted(named);
  }
  if (s.sameAs) return;
  const own = sameEvents(c?.events ?? [], e, s);
  refuseDeleted(own, s, url, "an event of the place");
  if (s.distinct) return;
  if (own.length) refuseSame(own.map((x) => x.id), "an event of the place");
  refuseRegionSame(tree, shared, p, e);
}

/** An event of the place's regions of the same kind and years: the place's history never writes it again. */
function refuseRegionSame(tree: Tree, shared: string, p: Place, e: { kind: string; from: number; to: number }): void {
  const same = regionEventsAt(tree, shared, p.id).filter((x) => x.event.kind === e.kind && x.event.from <= e.to && e.from <= x.event.to);
  if (!same.length) return;
  const ids = same.map((x) => x.event.id);
  throw new UsageError(`an event of the region of ${p.id} of the same kind and years is there already: ${ids.join(", ")} — nothing written`, {
    code: "history.same.region",
    params: { ids: ids.join(", ") },
    hint: `the region's event shows at this place already — leave it out; another event (what happened at the place itself): --distinct "<why it is another>"`,
  });
}

/**
 * A place's event written into its catalog (its source read and checked before: core/pagecheck.ts). The same event
 * again (--same-as) only adds its source; --replaces retracts the old one, pointing to the new. One of its regions'
 * events of the same kind and years is refused unless --distinct says why it is another.
 */
export function addPlaceEvent(tree: Tree, shared: string, p: Place, e: PlaceEventInput, s: Sameness = {}): { id: string; same: boolean; replaced?: string; key: string } {
  checkYears(e.from, e.to, e.date);
  checkTexts("text", e.text, REGION_LANGS);
  if (e.why) checkTexts("why", e.why, REGION_LANGS);
  if (e.tip) checkTexts("tip", e.tip, REGION_LANGS);
  if (!s.sameAs && !s.distinct) refuseRegionSame(tree, shared, p, e);
  const key = placeKeyOf(tree, p);
  return withCatalogs(shared, () => {
    const c = readPlaceCatalog(shared, key) ?? newCatalog(tree, p, key);
    const at = new Date().toISOString();
    if (s.sameAs) {
      const same = c.events.find((x) => x.id === s.sameAs);
      if (!same) throw new UsageError(`there is no event ${s.sameAs} of ${p.id}`, { code: "history.event", params: { event: s.sameAs } });
      refuseNamedDeleted(same);
      if (![same.source, ...(same.sources ?? [])].some((x) => x.url === e.source.url && foldText(x.quote) === foldText(e.source.quote))) {
        same.sources = [...(same.sources ?? []), e.source];
        writePlaceCatalog(shared, c);
      }
      return { id: same.id, same: true, key };
    }
    const replaced = s.replaces ? c.events.find((x) => x.id === s.replaces) : undefined;
    if (s.replaces && !replaced) throw new UsageError(`there is no event ${s.replaces} of ${p.id}`, { code: "history.event", params: { event: s.replaces } });
    refuseNamedDeleted(replaced);
    const same = sameEvents(c.events, e, s);
    refuseDeleted(same, s, e.source.url, "an event of the place");
    if (same.length && !s.distinct) refuseSame(same.map((x) => x.id), "an event of the place");
    const id = `${key}-${String(c.next).padStart(4, "0")}`;
    c.next++;
    c.events.push({
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
      by: tree.config.id,
      at,
    });
    if (replaced) replaced.retracted = { at, why: replaced.retracted?.why ?? `replaced by ${id}`, replacedBy: id };
    writePlaceCatalog(shared, c);
    return { id, same: false, key, ...(replaced ? { replaced: replaced.id } : {}) };
  });
}

/** What a place's session looked through (cs, en and de, each at most 200 characters, impersonal). */
export function setArea(tree: Tree, shared: string, p: Place, area: Texts): PlaceCatalog {
  checkTexts("area", area, REGION_LANGS, 200);
  const key = placeKeyOf(tree, p);
  return withCatalogs(shared, () => {
    const c = readPlaceCatalog(shared, key) ?? newCatalog(tree, p, key);
    c.area = nfc(area);
    writePlaceCatalog(shared, c);
    return c;
  });
}

/** A page strom could not read for a place's event: kept, never asked again for it. */
export function notePlaceTried(shared: string, key: string, url: string, why: string): void {
  if (!placeKeyOk(key)) return;
  withCatalogs(shared, () => {
    const c = readPlaceCatalog(shared, key);
    if (!c) return;
    c.tried = [...c.tried.filter((t) => t.url !== url), { url, at: new Date().toISOString(), why }];
    writePlaceCatalog(shared, c);
  });
}

/** A place's catalog finished (its task done): looked for again only on the person's word (strom history place). */
export function markPlaceDone(shared: string, key: string, treeId: string): PlaceCatalog | undefined {
  return withCatalogs(shared, () => {
    const c = readPlaceCatalog(shared, key);
    if (!c) return undefined;
    c.done = { at: new Date().toISOString(), tree: treeId };
    delete c.holder;
    writePlaceCatalog(shared, c);
    return c;
  });
}

/**
 * A place taken by this tree for a session on its task: the holder written into its catalog. Another tree's hold within
 * HOLD_DAYS stays: its ID is returned (nothing written).
 */
export function takePlace(shared: string, tree: Tree, id: string): string | undefined {
  const p = placeRecord(tree, id);
  if (!p) return undefined;
  const key = placeKeyOf(tree, p);
  return withCatalogs(shared, () => {
    const c = readPlaceCatalog(shared, key) ?? newCatalog(tree, p, key);
    if (heldElsewhere(c, tree.config.id)) return c.holder!.tree;
    c.holder = { tree: tree.config.id, since: new Date().toISOString() };
    writePlaceCatalog(shared, c);
    return undefined;
  });
}

/** A place's task finished (strom session close --done, strom task done): its catalog finished too. */
export function finishPlaceOf(tree: Tree, shared: string | undefined, t: Task): void {
  const id = placeOfTask(t);
  const p = id ? placeRecord(tree, id) : undefined;
  if (!p || !shared || tree.dryRun) return;
  // finished with nothing found (no session wrote into it): its catalog made, empty and done
  ensurePlaceCatalog(shared, tree, p);
  markPlaceDone(shared, placeKeyOf(tree, p), tree.config.id);
}

/** The place catalog of a record now, read once per key. */
export function catalogOfPlace(tree: Tree, shared: string | undefined): (id: string) => { key: string; catalog?: PlaceCatalog; place?: Place } {
  const seen = new Map<string, { key: string; catalog?: PlaceCatalog; place?: Place }>();
  return (id) => {
    if (seen.has(id)) return seen.get(id)!;
    const p = placeRecord(tree, id);
    const key = p ? placeKeyOf(tree, p) : "";
    const catalog = p && shared ? readPlaceCatalog(shared, key) : undefined;
    const got = { key, ...(catalog ? { catalog } : {}), ...(p ? { place: p } : {}) };
    seen.set(id, got);
    return got;
  };
}

// ── the queue ──────────────────────────────────────────────────────────────

/** Why a place's task is not taken now (historyHeld): skipped by the person, another tree builds its catalog. */
export function placeHeld(tree: Tree, shared: string | undefined, t: Task): "skipped" | "held" | undefined {
  const id = placeOfTask(t);
  const p = id ? placeRecord(tree, id) : undefined;
  if (!p) return undefined;
  if (placeSkipped(tree, p)) return "skipped";
  if (shared && heldElsewhere(readPlaceCatalog(shared, placeKeyOf(tree, p)), tree.config.id)) return "held";
  return undefined;
}

/** The place's weight in the tree for its turn: the people with a fact at it, those facts. */
export interface PlaceWeight {
  task: string;
  place: string;
  persons: number;
  facts: number;
}

/**
 * The open tasks of the places' history: the one the person asked for first (the oldest ask still open: its task
 * comes before anything), the others by their weight in the tree (the places of the most people first).
 */
export function placeTurn(tree: Tree, tasks: Task[]): { asked?: { task: string; place: string; at: string }; order: PlaceWeight[] } {
  const open = new Map(tasks.filter((t) => placeOfTask(t) && (t.state === "open" || t.state === "doing")).map((t) => [placeOfTask(t)!, t]));
  if (!open.size) return { order: [] };
  const asks = readPlaceAsks(tree).filter((x) => open.has(x.place) && x.at >= open.get(x.place)!.created);
  const oldest = [...asks].sort((a, b) => a.at.localeCompare(b.at))[0];
  const at = factsByRecord(tree);
  const order = [...open]
    .filter(([id]) => id !== oldest?.place && !asks.some((x) => x.place === id))
    .map(([id, t]) => ({ task: t.id, place: id, persons: at.get(id)?.persons.size ?? 0, facts: at.get(id)?.facts ?? 0 }))
    .sort((a, b) => b.persons - a.persons || b.facts - a.facts || a.place.localeCompare(b.place, "en", { numeric: true }));
  // the other places asked for: after the first, before those raised by themselves, the oldest ask first
  const asked = asks
    .filter((x) => x.place !== oldest?.place)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((x) => ({ task: open.get(x.place)!.id, place: x.place, persons: at.get(x.place)?.persons.size ?? 0, facts: at.get(x.place)?.facts ?? 0 }));
  return { ...(oldest ? { asked: { task: open.get(oldest.place)!.id, place: oldest.place, at: oldest.at } } : {}), order: [...asked, ...order] };
}

/**
 * The tasks of the places' history raised with the others (raiseHistoryTasks, inside its lock): a waiting one whose
 * catalog was finished meanwhile (another tree) is done; with experiments.historyPlaces on, the places with coordinates
 * and people of the tree whose catalog is not finished get theirs — a few open at once (AUTO_OPEN), the places of the
 * most people first; a place without coordinates never by itself (the person asks for it). A task dropped since the
 * place was last asked for again is the answer.
 */
export function raisePlaceTasks(tree: Tree, shared: string, settings: Settings): string[] {
  const lang = tree.lang;
  const tasks = tree.list<Task>("task").filter((t) => !!placeOfTask(t));
  const of = catalogOfPlace(tree, shared);
  for (const t of tasks.filter((x) => x.state === "open" || x.state === "parked")) {
    const got = of(placeOfTask(t)!);
    if (!got.catalog?.done) continue;
    update<Task>(tree, t.id, "task", (x) => ({ ...x, state: "done", result: phrase(lang, "history.place.finished", { place: got.place ? placeLabel(got.place, lang) : placeOfTask(t)! }) }), {
      op: "task.done",
      summary: `${t.id} done: the catalog of the place ${placeOfTask(t)} is finished`,
    });
  }
  if (!settings.historyPlacesAuto(tree.config)) return [];
  const live = new Set(tree.list<Task>("task").filter((t) => placeOfTask(t) && LIVE_STATES.has(t.state)).map((t) => placeOfTask(t)!));
  const asked = new Set(readPlaceAsks(tree).map((x) => x.place));
  let open = [...live].filter((id) => !asked.has(id)).length;
  if (open >= AUTO_OPEN) return [];
  const made: string[] = [];
  const at = factsByRecord(tree);
  const candidates = tree
    .list<Place>("place")
    .filter((p) => !p.retracted && p.coords && !live.has(p.id) && (at.get(p.id)?.persons.size ?? 0) > 0)
    .sort((a, b) => at.get(b.id)!.persons.size - at.get(a.id)!.persons.size || at.get(b.id)!.facts - at.get(a.id)!.facts || a.id.localeCompare(b.id, "en", { numeric: true }));
  for (const p of candidates) {
    if (open >= AUTO_OPEN) break;
    const c = of(p.id).catalog;
    if (c?.done) continue;
    if (tasks.some((t) => placeOfTask(t) === p.id && t.state === "dropped" && t.updated >= (c?.redo ?? ""))) continue;
    made.push(createPlaceTask(tree, p).id);
    open++;
  }
  return made;
}

// ── for the app ────────────────────────────────────────────────────────────

export type PlaceHistoryState = "none" | "first" | "running" | "done" | "empty" | "waiting";

/** A place's own history as the app shows it (places[x]): its state, when, why it waits, the reach of its search. */
export interface PlaceHistory {
  history: PlaceHistoryState;
  at?: string;
  why?: string;
  area: Texts;
}

/** What the app is told of the places' history: each record's state, read once. */
export function placeHistories(tree: Tree, shared: string | undefined, settings: Settings): (id: string) => PlaceHistory | undefined {
  const on = placesOn(tree, settings);
  const archive = actsAsArchive(tree);
  const tasks = tree.list<Task>("task");
  const asks = new Set(readPlaceAsks(tree).map((x) => x.place));
  const open = new Map<string, Session>();
  const byTask = new Map(tasks.map((t) => [t.id, t]));
  for (const s of tree.list<Session>("session")) {
    const t = s.task ? byTask.get(s.task) : undefined;
    if (t && s.state === "open" && placeOfTask(t)) open.set(placeOfTask(t)!, s);
  }
  const of = catalogOfPlace(tree, shared);
  return (id) => {
    const got = of(id);
    if (!got.place) return undefined;
    const area = got.catalog?.area ?? defaultArea(got.place);
    const c = got.catalog;
    const live = placeTask(tree, id, tasks);
    if (live) {
      const s = open.get(id);
      if (s) return { history: "running", at: s.started, area };
      const held = placeHeld(tree, shared, live);
      const why = !on
        ? phrase(tree.lang, "history.place.why.off")
        : archive
          ? phrase(tree.lang, "history.why.archive")
          : held === "held"
            ? phrase(tree.lang, "history.why.held", { region: placeLabel(got.place, tree.lang) })
            : held === "skipped"
              ? phrase(tree.lang, "history.place.why.skipped")
              : undefined;
      if (why) return { history: "waiting", why, area };
      if (asks.has(id)) return { history: "first", area };
      return { history: "waiting", why: phrase(tree.lang, "history.place.why.pace"), area };
    }
    if (c?.done) return { history: c.events.some((e) => !e.retracted) ? "done" : "empty", at: c.done.at, area };
    return { history: "none", area };
  };
}

/**
 * The places the research suggests for their own history (the app's K7.3, only an offer): the records of the most
 * people of the tree with no history of their own (none looked for, none asked) — none while the history is off or in
 * an archive.
 */
export function suggestPlaces(tree: Tree, shared: string | undefined, settings: Settings): string[] {
  if (!placesOn(tree, settings) || actsAsArchive(tree)) return [];
  const at = factsByRecord(tree);
  const states = placeHistories(tree, shared, settings);
  return [...at]
    .filter(([id, a]) => a.persons.size > 0 && states(id)?.history === "none")
    .sort((a, b) => b[1].persons.size - a[1].persons.size || b[1].facts - a[1].facts || a[0].localeCompare(b[0], "en", { numeric: true }))
    .slice(0, SUGGEST_MAX)
    .map(([id]) => id);
}

/**
 * What one place's history takes, as the app says it before the person asks (/status.history.placeEstimate): its
 * minutes; its price only from at least MEASURED_MIN sessions of history this research measured (their middle half —
 * the places' own first when there are enough of them), never guessed.
 */
export function placeEstimate(tree: Tree): { minutes: [number, number]; usd?: [number, number] } {
  const tasks = new Map(tree.list<Task>("task").map((t) => [t.id, t]));
  const costs = (pick: (t: Task) => boolean) =>
    tree
      .list<Session>("session")
      .filter((s) => s.state !== "open" && !s.metrics?.costPartial && (s.metrics?.costUsd ?? 0) > 0 && !!s.task && tasks.has(s.task) && pick(tasks.get(s.task)!))
      .map((s) => s.metrics!.costUsd! + (s.metrics!.readersUsd ?? 0))
      .sort((a, b) => a - b);
  const own = costs((t) => !!placeOfTask(t));
  const any = own.length >= MEASURED_MIN ? own : costs((t) => t.origin.startsWith("history:"));
  if (any.length < MEASURED_MIN) return { minutes: PLACE_MINUTES };
  const q = (f: number) => any[Math.min(any.length - 1, Math.max(0, Math.round((any.length - 1) * f)))]!;
  const round = (x: number) => Math.max(0.1, Math.round(x * 10) / 10);
  return { minutes: PLACE_MINUTES, usd: [round(q(0.25)), round(Math.max(q(0.75), q(0.25)))] };
}

/** The tree's places with coordinates and people: what turning experiments.historyPlaces on would look for (the terminal says it). */
export function placesWithCoords(tree: Tree, shared: string | undefined): { places: number; done: number } {
  const at = factsByRecord(tree);
  const of = catalogOfPlace(tree, shared);
  const all = tree.list<Place>("place").filter((p) => !p.retracted && p.coords && (at.get(p.id)?.persons.size ?? 0) > 0);
  const done = all.filter((p) => !!of(p.id).catalog?.done).length;
  return { places: all.length - done, done };
}

/** The deleted events of a place's catalog (the app's Deleted). */
export function deletedOfPlace(c: PlaceCatalog | undefined): RegionEvent[] {
  return (c?.events ?? []).filter(deletedByPerson);
}

/**
 * Merge a place's catalog from a pack (core/pack.ts): its events added that are not here, never one written over; a
 * catalog of another tree alone (no coordinates) as it is.
 */
export function mergePlaceCatalog(shared: string, given: PlaceCatalog): { added: number } {
  const key = given.place?.key ?? "";
  if (!placeKeyOk(key) || !Array.isArray(given.events)) return { added: 0 };
  return withCatalogs(shared, () => {
    const had = readPlaceCatalog(shared, key);
    if (!had) {
      const { holder: _held, ...rest } = given;
      writePlaceCatalog(shared, { ...rest, tried: Array.isArray(given.tried) ? given.tried : [] });
      return { added: given.events.length };
    }
    const ids = new Set(had.events.map((e) => e.id));
    const more = given.events.filter((e) => typeof e?.id === "string" && !ids.has(e.id));
    if (!more.length) return { added: 0 };
    had.events.push(...more);
    had.events.sort((a, b) => a.id.localeCompare(b.id));
    const top = Math.max(0, ...had.events.map((e) => Number(/-(\d+)$/u.exec(e.id)?.[1] ?? 0)));
    had.next = Math.max(had.next, given.next ?? 0, top + 1);
    writePlaceCatalog(shared, had);
    return { added: more.length };
  });
}
