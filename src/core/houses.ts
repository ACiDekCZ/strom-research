// The houses of a family tree (spec 030 "the history of a house"): what the research found of one house — its numbers in
// time, its point on the map, what happened to it, who held it and who lived there, what was gone through and what is
// only in a reading room — kept as a record of its own (data/houses/A…, strom house).
//
// A house is known two ways: as the facts of the tree write it (a place and its house number, "Lhota" + "16"), and as
// a record of the research (A…) once something of it is written — by the agent, by the person (strom house add), or
// by a research of the person's own taken in (strom house import). Both meet in one key, the one the Strom app
// computes: `<placeKey of the municipality>|<houseKey of the number>` (core/streets.ts houseRowKey). The key is never
// stored: the municipality of a record is its place (L…), whose text gives the key, so a place renamed changes the key
// and the record (its stable ID) stays.
//
// The tasks of a house carry an origin of its own: house:<A…> (research of the house), house:import:<A…> (the
// takeover of a research of the person's own), house:town:<L…> (the skeleton of a municipality), house:look:<A…> (the
// look of a house, after its research where its look check says there is more to find: spec 145 T1) — forHouse below.

import { AmbiguousError, UsageError } from "./errors.ts";
import {
  HOUSE_CERTAINTIES,
  HOUSE_EVENT_KINDS,
  HOUSE_HOLDER_HOWS,
  HOUSE_LOCATION_HOWS,
  HOUSE_MAP_KINDS,
  HOUSE_NUMBER_CERTAINTIES,
  HOUSE_RESIDENT_ROLES,
  type Event,
  type Family,
  type House,
  type HouseOrigin,
  type HouseSource,
  type Input,
  type Person,
  type Place,
  type Task,
} from "./model.ts";
import { appHouseKey, appPlaceKey, compareHouses, houseRowKey, splitStreet } from "./streets.ts";
import { foldText } from "./text.ts";
import crypto from "node:crypto";
import { now, type Tree } from "./tree.ts";
import { create, normId, update } from "./records.ts";
import { recordIndex } from "./placeid.ts";
import { effectiveState } from "./queue.ts";
import { Settings } from "./config.ts";

/** What every task of a house begins its origin with. */
export const HOUSE_TASK_PREFIX = "house:";
/** The takeover of a research of the person's own (strom house import): house:import:<A…>. */
export const HOUSE_IMPORT_PREFIX = "house:import:";
/** The skeleton of a municipality's houses (part 2): house:town:<L…>. */
export const HOUSE_TOWN_PREFIX = "house:town:";
/** The look of a house (spec 145 T1), after its research: house:look:<A…>. */
export const HOUSE_LOOK_PREFIX = "house:look:";

/** A task of a house: of a house, of a municipality's houses, a takeover. */
export function forHouse(t: Pick<Task, "origin">): boolean {
  return typeof t.origin === "string" && t.origin.startsWith(HOUSE_TASK_PREFIX);
}

/** The takeover task's origin for a house. */
export const houseImportOrigin = (house: string): string => `${HOUSE_IMPORT_PREFIX}${house}`;

/** What a task of a house works on: a takeover of a research, the house, the houses of a municipality, a house's look. */
export type HouseWork = "takeover" | "house" | "town" | "look";
export function houseWork(t: Pick<Task, "origin">): HouseWork | undefined {
  if (!forHouse(t)) return undefined;
  if (t.origin.startsWith(HOUSE_IMPORT_PREFIX)) return "takeover";
  if (t.origin.startsWith(HOUSE_TOWN_PREFIX)) return "town";
  if (t.origin.startsWith(HOUSE_LOOK_PREFIX)) return "look";
  return "house";
}

/** The house (A… or its key) a task of a house is of; a municipality's task is of none. */
export function houseOfTask(t: Pick<Task, "origin">): string | undefined {
  if (!forHouse(t) || t.origin.startsWith(HOUSE_TOWN_PREFIX)) return undefined;
  const prefix = t.origin.startsWith(HOUSE_IMPORT_PREFIX) ? HOUSE_IMPORT_PREFIX : t.origin.startsWith(HOUSE_LOOK_PREFIX) ? HOUSE_LOOK_PREFIX : HOUSE_TASK_PREFIX;
  return t.origin.slice(prefix.length);
}

/** Every house a task of a house works on: its own and the neighbouring ones it took with it (houses). */
export function housesOfTask(t: Pick<Task, "origin" | "houses">): string[] {
  const own = houseOfTask(t);
  const work = houseWork(t);
  return [...new Set([...(own ? [own] : []), ...(work === "house" || work === "look" ? (t.houses ?? []) : [])])];
}

/** The municipality (L…) a task of a municipality's skeleton is of, else undefined. */
export function townOfTask(t: Pick<Task, "origin">): string | undefined {
  return forHouse(t) && t.origin.startsWith(HOUSE_TOWN_PREFIX) ? t.origin.slice(HOUSE_TOWN_PREFIX.length) : undefined;
}

/** The origin of a house's research (house:<A…>) and of a municipality's skeleton (house:town:<L…>). */
export const houseOrigin = (house: string): string => `${HOUSE_TASK_PREFIX}${house}`;
export const townOrigin = (place: string): string => `${HOUSE_TOWN_PREFIX}${place}`;
export const houseLookOrigin = (house: string): string => `${HOUSE_LOOK_PREFIX}${house}`;

/**
 * A task of a house raised by itself (spec 030 part 2): the research of a house or a municipality's skeleton the
 * person did not ask for — such a one is held while the houses are off. A takeover, an asked one never.
 */
export function houseAutoTask(t: Pick<Task, "origin" | "asked">): boolean {
  const work = houseWork(t);
  return (work === "house" || work === "town" || work === "look") && !t.asked;
}

/**
 * The chain of a house's tasks in its order (spec 145 T1): a house's research comes after its municipality's skeleton
 * alive, a house's look after its research alive — whatever was moved to the top of the queue. The tasks alive ahead of
 * a task (open or at work), none for any other.
 */
export function houseChain(tree: Tree, day: string = today()): (t: Task) => Task[] {
  let live: { towns: Map<string, Task[]>; houses: Map<string, Task[]> } | undefined;
  const add = (m: Map<string, Task[]>, k: string, t: Task) => m.set(k, [...(m.get(k) ?? []), t]);
  const ahead = () => {
    if (live) return live;
    live = { towns: new Map(), houses: new Map() };
    for (const x of tree.list<Task>("task")) {
      if (!forHouse(x) || x.retracted || !["open", "doing"].includes(effectiveState(x, day))) continue;
      const work = houseWork(x);
      if (work === "town") add(live.towns, townOfTask(x)!, x);
      else if (work === "house") for (const h of housesOfTask(x)) add(live.houses, h, x);
    }
    return live;
  };
  return (t) => {
    const work = houseWork(t);
    const of = work === "house" ? housesOfTask(t).flatMap((h) => ahead().towns.get(tree.get<House>(h)?.place ?? "") ?? []) : work === "look" ? housesOfTask(t).flatMap((h) => ahead().houses.get(h) ?? []) : [];
    return [...new Map(of.filter((x) => x.id !== t.id).map((x) => [x.id, x])).values()];
  };
}

const openNow = (t: Task, day: string): boolean => t.state === "open" || (t.state === "parked" && !!t.parkedUntil && t.parkedUntil <= day);

/**
 * Held because the history of the houses is off (spec 030 part 2, as census records): a task of a house raised by
 * itself, open (or parked until a day gone by) or waiting — never one at work, one the person parked, one asked, a
 * takeover, nor one the person gave material to (its files, a material of its houses). Nothing is written: back once on.
 */
export function houseHeld(t: Task, on: boolean, day: string = today(), material: (t: Task) => boolean = () => false): boolean {
  if (on || !houseAutoTask(t) || t.files?.length) return false;
  if (t.state !== "waiting" && !openNow(t, day)) return false;
  return !material(t);
}

/** What shows nowhere now: a held task of a house (none while the houses are on). */
export function houseHidden(tree: Tree, on: boolean, day: string = today()): (t: Task) => boolean {
  if (on) return () => false;
  let withMaterial: Set<string> | undefined;
  const material = (t: Task) => {
    withMaterial ??= new Set(tree.list<Input>("input").filter((i) => !i.retracted && !i.hidden).flatMap((i) => i.houses ?? []));
    return housesOfTask(t).some((h) => withMaterial!.has(h));
  };
  return (t) => houseHeld(t, on, day, material);
}

/** How many tasks of houses are held now (0 while on): the menu's settings and the bridge's counts.held. */
export function housesHeldCount(tree: Tree, on: boolean): number {
  if (on) return 0;
  const hidden = houseHidden(tree, on);
  return tree.list<Task>("task").filter((t) => forHouse(t) && hidden(t)).length;
}

// ── the houses of the facts ─────────────────────────────────────────────────────────────────────────────────────

/** A house as the tree's facts write it: its municipality, its number, who lived there, which years. */
export interface TreeHouse {
  key: string;
  /** The municipality's text the key is of. */
  town: string;
  /** The place record of the municipality, where the facts' place is one. */
  place?: Place;
  /** The number as the facts write it most (NFC). */
  house: string;
  persons: Set<string>;
  years: number[];
  events: { owner: Person | Family; event: Event }[];
}

const liveOwners = (tree: Tree): (Person | Family)[] =>
  [...tree.list<Person>("person"), ...tree.list<Family>("family")].filter((o) => !o.retracted && !(o as Person).mergedInto);

function yearOf(date: string | undefined): number | undefined {
  const m = date ? /(\d{3,4})(?!.*\d{3,4})/u.exec(date) : null;
  return m ? Number(m[1]) : undefined;
}

/** The municipality of a fact's place: its part before a street or a house, else its first part. */
function townOfForm(form: string): string {
  const f = form.normalize("NFC").trim();
  return (splitStreet(f)?.town ?? f.split(",")[0] ?? f).trim();
}

/** What the houses' reading needs of a tree once: its place records by a fact's place, the town text of each record. */
export interface HouseIndex {
  placeOf: (form: string) => Place | undefined;
  /** The municipality's text of a place record: the one the facts write most, else its first name. */
  townOf: (place: Place) => string;
  houses: Map<string, TreeHouse>;
}

/** Every house of the tree's facts, by its key, and how a place record is written. */
export function houseIndex(tree: Tree): HouseIndex {
  const placeOf = recordIndex(tree);
  const facts: { owner: Person | Family; event: Event; town: string; place?: Place }[] = [];
  const written = new Map<string, Map<string, number>>();
  for (const o of liveOwners(tree))
    for (const e of o.events) {
      if (e.retracted || e.status === "retracted" || !e.place?.trim()) continue;
      const town = townOfForm(e.place);
      const place = placeOf(e.place);
      if (place) {
        const m = written.get(place.id) ?? new Map<string, number>();
        m.set(town, (m.get(town) ?? 0) + 1);
        written.set(place.id, m);
      }
      if (e.house?.trim()) facts.push({ owner: o, event: e, town, ...(place ? { place } : {}) });
    }
  const townOf = (p: Place): string => {
    const m = written.get(p.id);
    if (m?.size) return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
    return p.names[0]?.name ?? p.id;
  };
  const houses = new Map<string, TreeHouse & { forms: Map<string, number> }>();
  for (const f of facts) {
    const town = f.place ? townOf(f.place) : f.town;
    const number = f.event.house!.normalize("NFC").trim();
    const key = houseRowKey(town, number);
    let h = houses.get(key);
    if (!h) houses.set(key, (h = { key, town, ...(f.place ? { place: f.place } : {}), house: number, persons: new Set(), years: [], events: [], forms: new Map() }));
    h.forms.set(number, (h.forms.get(number) ?? 0) + 1);
    for (const p of f.owner.type === "person" ? [f.owner.id] : f.owner.partners) h.persons.add(p);
    const y = yearOf(f.event.date);
    if (y !== undefined) h.years.push(y);
    h.events.push({ owner: f.owner, event: f.event });
  }
  const out = new Map<string, TreeHouse>();
  for (const [key, { forms, ...h }] of houses) {
    h.house = [...forms.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))[0]![0];
    out.set(key, h);
  }
  return { placeOf, townOf, houses: out };
}

/** The key of a house record: its municipality's text and its number, as the app computes it. */
export function keyOfHouse(tree: Tree, h: House, index: HouseIndex = houseIndex(tree)): string {
  const p = tree.get<Place>(h.place);
  return houseRowKey(p ? index.townOf(p) : h.place, h.house);
}

// ── the rows: the research's houses and the tree's ──────────────────────────────────────────────────────────────

export const HOUSE_STATES = ["none", "queued", "running", "done", "waiting", "held"] as const;
export type HouseState = (typeof HOUSE_STATES)[number];

/** One house as a list shows it. */
export interface HouseRow {
  /** The research's record (A…), where there is one. */
  id?: string;
  key: string;
  place: { key: string; id?: string; name: string };
  house: string;
  name?: string;
  record?: House;
  tree?: TreeHouse;
  persons: number;
  years?: { from: number; to: number };
  state: HouseState;
  /** The day its last task was done. */
  at?: string;
  task?: string;
  work?: HouseWork;
  question?: { id: string; text: string };
  materials: string[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Where a house's tasks are: at work, waiting for the person, in the queue, put aside (parked, or held while the
 * houses are off), done; none.
 */
function stateOf(tasks: Task[], day: string, held: (t: Task) => boolean): Pick<HouseRow, "state" | "at" | "task" | "work" | "question"> {
  const live = tasks.filter((t) => !t.retracted && t.state !== "dropped");
  const by = (s: Task["state"]) => live.filter((t) => effectiveState(t, day) === s && (s === "doing" || s === "done" || !held(t))).sort((a, b) => a.id.localeCompare(b.id));
  const pick = (t: Task | undefined, state: HouseState) => (t ? { state, task: t.id, ...(houseWork(t) ? { work: houseWork(t)! } : {}) } : undefined);
  const waiting = by("waiting")[0];
  const doneAll = by("done").sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
  const at = doneAll[0]?.updated?.slice(0, 10);
  const row =
    pick(by("doing")[0], "running") ??
    (waiting ? { ...pick(waiting, "waiting")!, question: { id: waiting.id, text: waiting.waitingOn ?? waiting.what } } : undefined) ??
    pick(by("open")[0], "queued") ??
    pick(live.filter(held).sort((a, b) => a.id.localeCompare(b.id))[0], "held") ??
    pick(by("parked")[0], "held") ??
    pick(doneAll[0], "done") ?? { state: "none" as const };
  return { ...row, ...(at ? { at } : {}) };
}

/** The material of each house (I… not retracted, not hidden). */
function materialsByHouse(tree: Tree): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const i of tree.list<Input>("input"))
    if (!i.retracted && !i.hidden) for (const h of i.houses ?? []) out.set(h, [...(out.get(h) ?? []), i.id]);
  return out;
}

/**
 * Every house of the research: its records (A…) and the houses of the tree's facts, one row each by its key, in the
 * order of their municipality and number. `town`: only the houses of one place record.
 */
export function houseRows(tree: Tree, opts: { town?: string; index?: HouseIndex; on?: boolean } = {}): HouseRow[] {
  const index = opts.index ?? houseIndex(tree);
  const day = today();
  const tasks = tree.list<Task>("task").filter(forHouse);
  const materials = materialsByHouse(tree);
  const held = houseHidden(tree, opts.on ?? new Settings(tree.env, {}).houses(tree.config), day);
  const rows = new Map<string, HouseRow>();
  const placeView = (town: string, p: Place | undefined) => ({ key: appPlaceKey(town), ...(p ? { id: p.id } : {}), name: p?.names[0]?.name ?? town });
  for (const h of tree.list<House>("house")) {
    // a municipality's record is no house (its skeleton: townView)
    if (h.retracted || h.town) continue;
    const p = tree.get<Place>(h.place);
    const town = p ? index.townOf(p) : h.place;
    const key = houseRowKey(town, h.house);
    rows.set(key, {
      id: h.id,
      key,
      place: placeView(town, p),
      house: h.house,
      ...(h.name ? { name: h.name } : {}),
      record: h,
      persons: 0,
      state: "none",
      materials: materials.get(h.id) ?? [],
    });
  }
  for (const [key, th] of index.houses) {
    const row = rows.get(key);
    const years = th.years.length ? { from: Math.min(...th.years), to: Math.max(...th.years) } : undefined;
    if (row) Object.assign(row, { tree: th, persons: th.persons.size, ...(years ? { years } : {}) });
    else rows.set(key, { key, place: placeView(th.town, th.place), house: th.house, tree: th, persons: th.persons.size, ...(years ? { years } : {}), state: "none", materials: [] });
  }
  for (const row of rows.values()) {
    const mine = tasks.filter((t) => housesOfTask(t).some((of) => of === row.id || of === row.key));
    Object.assign(row, stateOf(mine, day, held));
  }
  const town = opts.town;
  return [...rows.values()]
    .filter((r) => !town || r.place.id === town)
    .sort((a, b) => a.place.name.localeCompare(b.place.name) || compareHouses(a.house, b.house));
}

// ── finding a house as typed ────────────────────────────────────────────────────────────────────────────────────

/** A house typed as its record (A3, A0003), its key ("lhota|16"), or its municipality and number ("L12 16", "Lhota 16"). */
export function findHouse(tree: Tree, ref: string, rows: HouseRow[] = houseRows(tree)): HouseRow {
  const r = ref.normalize("NFC").trim();
  if (/^[Aa]\d+$/u.test(r)) {
    const id = normId(r, "house");
    const row = rows.find((x) => x.id === id);
    if (!row) throw new UsageError(`no house ${id}`, { code: "house.unknown", hint: "strom house list" });
    return row;
  }
  if (r.includes("|")) {
    const [town, house] = [r.slice(0, r.indexOf("|")), r.slice(r.indexOf("|") + 1)];
    const key = `${appPlaceKey(town)}|${appHouseKey(house)}`;
    const row = rows.find((x) => x.key === key);
    if (!row) throw new UsageError(`no house of the key "${r}"`, { code: "house.unknown", hint: "strom house list" });
    return row;
  }
  const words = r.split(/\s+/u);
  if (words.length < 2) throw new UsageError(`"${r}" is no house: give A…, its key (town|number) or its municipality and number`, { code: "house.body", hint: "strom house list" });
  // the municipality is the first words, the number the rest: the longest municipality that is one wins
  for (let cut = words.length - 1; cut >= 1; cut--) {
    const town = words.slice(0, cut).join(" ");
    const house = words.slice(cut).join(" ");
    const hk = appHouseKey(house);
    const placeId = /^[Ll]\d+$/u.test(town) ? normId(town, "place") : undefined;
    const ft = foldText(town);
    const found = rows.filter((x) => {
      if (appHouseKey(x.house) !== hk && x.key.split("|")[1] !== hk) return false;
      if (placeId) return x.place.id === placeId;
      if (x.place.key === appPlaceKey(town)) return true;
      const p = x.place.id ? tree.get<Place>(x.place.id) : undefined;
      return !!p?.names.some((n) => foldText(n.name) === ft);
    });
    if (found.length === 1) return found[0]!;
    if (found.length > 1)
      throw new UsageError(`"${r}" is more houses: ${found.map((x) => x.id ?? x.key).join(", ")}`, {
        code: "house.ambiguous",
        hint: `name one: ${found.map((x) => `strom house show ${x.id ?? `"${x.key}"`}`).join(" | ")}`,
      });
  }
  throw new UsageError(`no house "${r}"`, { code: "house.unknown", hint: "strom house list" });
}

/** A municipality as typed: a place record (L…) or the one place record of that name. */
export function findTown(tree: Tree, ref: string): Place {
  const r = ref.normalize("NFC").trim();
  if (/^[Ll]\d+$/u.test(r)) {
    const p = tree.get<Place>(normId(r, "place"));
    if (!p || p.retracted) throw new UsageError(`no place ${r}`, { code: "house.unknown", hint: "strom place list" });
    return p;
  }
  const ft = foldText(r);
  const found = tree.list<Place>("place").filter((p) => !p.retracted && p.names.some((n) => foldText(n.name) === ft));
  if (found.length === 1) return found[0]!;
  if (found.length > 1) throw new AmbiguousError(r, found.map((p) => ({ id: p.id, label: p.names.map((n) => n.name).join(" / ") })));
  throw new UsageError(`no place "${r}"`, { code: "house.town", hint: `strom place list — or strom place add "${r}"` });
}

// ── writing ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const EMPTY = (): Pick<House, "numbers" | "timeline" | "holders" | "residents" | "maps" | "passed" | "manual" | "unknown" | "archiveOnly"> => ({
  numbers: [],
  timeline: [],
  holders: [],
  residents: [],
  maps: [],
  passed: [],
  manual: [],
  unknown: [],
  archiveOnly: [],
});

/** Make a house record (strom house add <town> <number>): by the person, it is listed although nobody lived there. */
export function addHouse(tree: Tree, place: Place, house: string, opts: { name?: string; nameBy?: House["nameBy"]; byUser?: boolean } = {}): House {
  const number = house.normalize("NFC").trim();
  if (!number) throw new UsageError("a house needs its number", { code: "house.body" });
  return tree.withTreeLock(() => {
    const index = houseIndex(tree);
    const key = houseRowKey(index.townOf(place), number);
    const had = tree.list<House>("house").find((h) => !h.retracted && !h.town && keyOfHouse(tree, h, index) === key);
    if (had) throw new UsageError(`the house is ${had.id} already`, { code: "house.exists", hint: `strom house show ${had.id}` });
    return create<House>(
      tree,
      "house",
      {
        place: place.id,
        house: number,
        ...(opts.name ? { name: opts.name.normalize("NFC").trim(), nameBy: opts.nameBy ?? "user" } : {}),
        ...EMPTY(),
        ...(opts.byUser ? { byUser: true as const } : {}),
      },
      (id) => `+${id} house ${number} at ${place.id}`,
    );
  });
}

/** The record of a house row: the one it has, or one made for a house of the tree (its municipality a place record). */
export function recordOf(tree: Tree, row: HouseRow): House {
  if (row.record) return tree.get<House>(row.record.id) ?? row.record;
  const place = row.tree?.place;
  if (!place)
    throw new UsageError(`the municipality of the house "${row.key}" is no place record yet`, {
      code: "house.town",
      hint: `strom place add "${row.place.name}" (or strom places identify), then again`,
    });
  return tree.withTreeLock(() => {
    const index = houseIndex(tree);
    return (
      tree.list<House>("house").find((h) => !h.retracted && !h.town && keyOfHouse(tree, h, index) === row.key) ??
      create<House>(tree, "house", { place: place.id, house: row.house, ...EMPTY() }, (id) => `+${id} house ${row.house} at ${place.id}`)
    );
  });
}

/** The record of a municipality's skeleton (town), if there is one. */
export function townRecord(tree: Tree, place: string): House | undefined {
  return tree.list<House>("house").find((h) => !h.retracted && h.town && h.place === place);
}

/** The record of a municipality's skeleton: the one it has, or one made now (no number). */
export function townRecordOf(tree: Tree, place: Place): House {
  return tree.withTreeLock(
    () => townRecord(tree, place.id) ?? create<House>(tree, "house", { place: place.id, house: "", town: true, ...EMPTY() }, (id) => `+${id} municipality ${place.id} (its houses' skeleton)`),
  );
}

/** A municipality's skeleton as a house shows it, and as strom house show --town gives it. */
export function townView(tree: Tree, place: Place, rec: House | undefined = townRecord(tree, place.id)): Record<string, unknown> {
  const tasks = tree.list<Task>("task").filter((t) => townOfTask(t) === place.id && !t.retracted && t.state !== "dropped");
  const live = tasks.find((t) => t.state !== "done");
  return {
    ...(rec ? { id: rec.id } : {}),
    place: { id: place.id, name: place.names[0]?.name ?? place.id },
    ...(rec?.text ? { text: rec.text } : {}),
    passed: rec?.passed ?? [],
    manual: rec?.manual ?? [],
    archiveOnly: rec?.archiveOnly ?? [],
    maps: rec?.maps ?? [],
    unknown: rec?.unknown ?? [],
    pictures: rec?.pictures ?? [],
    fieldNames: rec?.fieldNames ?? [],
    ...(rec?.done ? { done: rec.done } : {}),
    ...(live ? { task: live.id, state: live.state } : {}),
  };
}

/** The lists of a house that hold items, and the letter of their IDs. */
export const HOUSE_ITEM_LETTERS = {
  numbers: "n",
  timeline: "e",
  holders: "h",
  residents: "r",
  maps: "m",
  passed: "p",
  manual: "o",
  unknown: "u",
  archiveOnly: "a",
  // a municipality's (spec 145): its pictures and its field names
  pictures: "i",
  fieldNames: "f",
} as const;
export type HouseList = keyof typeof HOUSE_ITEM_LETTERS;

/** The next free ID of an item of a list in a house ("e4"). */
export function nextItemId(h: House, list: HouseList): string {
  const letter = HOUSE_ITEM_LETTERS[list];
  let max = 0;
  for (const item of (h[list] ?? []) as { id: string }[]) {
    const m = new RegExp(`^${letter}(\\d+)$`, "u").exec(item.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${letter}${max + 1}`;
}

type ItemOf<L extends HouseList> = NonNullable<House[L]>[number];

/** Add an item to a list of a house: its ID given, who wrote it, when. */
export function addHouseItem<L extends HouseList>(tree: Tree, houseId: string, list: L, item: Omit<ItemOf<L>, "id" | "at" | "origin"> & { origin?: HouseOrigin }, what: string): { house: House; id: string } {
  let id = "";
  const house = update<House>(
    tree,
    houseId,
    "house",
    (h) => {
      id = nextItemId(h, list);
      const full = { id, origin: item.origin ?? "research", at: now().slice(0, 10), ...stripEmpty(item) };
      ((h[list] ??= [] as never) as unknown[]).push(full);
      return h;
    },
    { op: "house.item", summary: `${houseId} +${what}` },
  );
  return { house, id };
}

/** Change what is one of a house (its name, its point, its look). */
export function setHouse(tree: Tree, houseId: string, change: (h: House) => void, what: string): House {
  return update<House>(
    tree,
    houseId,
    "house",
    (h) => {
      change(h);
      return h;
    },
    { op: "house.set", summary: `${houseId} ${what}` },
  );
}

function stripEmpty<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length))) as T;
}

/** A house's sources from what was typed: S… (with a page), an address. */
export function houseSources(tree: Tree, opts: { source?: string; page?: string; url?: string }): HouseSource[] | undefined {
  const out: HouseSource[] = [];
  if (opts.source) {
    const id = normId(opts.source, "source");
    if (!tree.get(id)) throw new UsageError(`no source ${id}`, { code: "house.body", hint: "strom source list" });
    out.push({ source: id, ...(opts.page ? { page: opts.page } : {}) });
  } else if (opts.page) throw new UsageError("--page goes with --source", { code: "house.body" });
  if (opts.url) {
    if (!/^https?:\/\//iu.test(opts.url)) throw new UsageError(`"${opts.url}" is no web address`, { code: "house.body" });
    out.push({ url: opts.url });
  }
  return out.length ? out : undefined;
}

/** What the person confirms of a house (strom house confirm, POST /houses/confirm): never an agent. */
export const HOUSE_CONFIRMS = ["renumber", "location", "notSame"] as const;
export type HouseConfirm = (typeof HOUSE_CONFIRMS)[number];

/**
 * The person's word on a house: a renumbering the research proposed holds (renumber <n…>), the house's point is right
 * or where it is (location [lat lon]), the number proposed is not the same house (notSame <n…>: never sent again).
 * The caller makes sure it is the person's (a terminal, the app).
 */
export function confirmHouse(tree: Tree, houseId: string, what: HouseConfirm, opts: { id?: string; lat?: number; lon?: number } = {}): House {
  const day = now().slice(0, 10);
  return tree.withTreeLock(() => {
    const h = tree.get<House>(houseId);
    if (!h || h.retracted) throw new UsageError(`no house ${houseId}`, { code: "house.unknown", hint: "strom house list" });
    if (what === "location") {
      const both = opts.lat !== undefined && opts.lon !== undefined;
      if ((opts.lat === undefined) !== (opts.lon === undefined)) throw new UsageError("a point needs both lat and lon", { code: "house.body" });
      if (both && (!Number.isFinite(opts.lat) || !Number.isFinite(opts.lon) || Math.abs(opts.lat!) > 90 || Math.abs(opts.lon!) > 180))
        throw new UsageError("lat must be within ±90 and lon within ±180", { code: "house.body" });
      if (!both && !h.location) throw new UsageError(`${houseId} has no point to confirm: give lat and lon`, { code: "house.body" });
      return setHouse(
        tree,
        houseId,
        (x) => {
          x.location = both
            ? { lat: opts.lat!, lon: opts.lon!, how: x.location?.how ?? "other", certainty: "high", origin: "user", confirmed: day, ...(x.location?.sources ? { sources: x.location.sources } : {}) }
            : { ...x.location!, certainty: "high", confirmed: day };
        },
        both ? `point ${opts.lat} ${opts.lon} by the person` : "point confirmed",
      );
    }
    if (!opts.id) throw new UsageError(`${what} needs the number's item (n…)`, { code: "house.body", hint: `strom house show ${houseId}` });
    const n = h.numbers.find((x) => x.id === opts.id);
    if (!n) throw new UsageError(`${houseId} has no number ${opts.id}`, { code: "house.body", hint: `strom house show ${houseId}` });
    if (what === "renumber" && n.notSame) throw new UsageError(`${opts.id} was said to be another house`, { code: "house.body" });
    return setHouse(
      tree,
      houseId,
      (x) => {
        const it = x.numbers.find((y) => y.id === opts.id)!;
        if (what === "renumber") {
          it.confirmed = day;
          delete it.notSame;
        } else {
          it.notSame = day;
          delete it.confirmed;
        }
      },
      `${opts.id} ${what === "renumber" ? "renumbering confirmed" : "another house"}`,
    );
  });
}

// ── what a house is, to show ────────────────────────────────────────────────────────────────────────────────────

const sourcesOut = (s: HouseSource[] | undefined) => s?.map((x) => (x.source && !x.page && !x.url ? x.source : x));

/** The material of a house as the app lists it: a research of the person's own taken in, a file, a memory. */
export interface HouseMaterial {
  id: string;
  kind: "own-research" | "file" | "memory";
  title: string;
  at: string;
  file?: string;
}

/** A house whole (strom house show, GET /houses/<key>): spec 030 §2.4 as §4.2 says it. */
export function houseView(tree: Tree, row: HouseRow): Record<string, unknown> {
  const h = row.record ? (tree.get<House>(row.record.id) ?? row.record) : undefined;
  const materials: HouseMaterial[] = row.materials
    .map((id) => tree.get<Input>(id))
    .filter((i): i is Input => !!i)
    .map((i) => ({
      id: i.id,
      kind: i.ownResearch ? "own-research" : i.file ? "file" : "memory",
      title: i.title ?? i.name,
      at: i.created.slice(0, 10),
      ...(i.file ? { file: i.file } : {}),
    }));
  const items = <T extends { sources?: HouseSource[] }>(list: T[] | undefined) => (list ?? []).map((x) => (x.sources ? { ...x, sources: sourcesOut(x.sources) } : x));
  const out: Record<string, unknown> = {
    ...(h ? { id: h.id } : {}),
    key: row.key,
    place: row.place,
    house: row.house,
    ...(row.name ? { name: row.name } : {}),
    ...(h?.nameBy && h.name ? { nameBy: h.nameBy } : {}),
    state: row.state,
    ...(row.at ? { at: row.at } : {}),
    ...(row.task ? { task: row.task } : {}),
    ...workOut(row.work),
    ...(row.question ? { question: row.question } : {}),
    persons: row.tree ? [...row.tree.persons].sort() : [],
    ...(row.years ? { years: row.years } : {}),
    numbers: items(h?.numbers.filter((n) => !n.notSame)),
    ...(h?.location ? { location: { ...h.location, confirmed: h.location.confirmed ?? null, ...(h.location.sources ? { sources: sourcesOut(h.location.sources) } : {}) } } : {}),
    timeline: items(h?.timeline),
    holders: items(h?.holders),
    residents: items(h?.residents),
    ...(h?.look ? { look: h.look } : {}),
    ...(h?.lookCheck ? { lookCheck: h.lookCheck } : {}),
    ...(h?.maps.length ? { maps: h.maps } : {}),
    passed: h?.passed ?? [],
    manual: h?.manual ?? [],
    unknown: (h?.unknown ?? []).map((u) => ({ ...u, question: u.question ?? null })),
    archiveOnly: h?.archiveOnly ?? [],
    materials,
    ...(h?.sensitive?.length ? { sensitive: h.sensitive } : {}),
  };
  // the records of the same house the person joined in the app (its _HOUSE _SAME, core/housesync.ts)
  const same = (h?.same ?? []).map((id) => tree.get<House>(id)).filter((x): x is House => !!x && !x.retracted);
  if (same.length) {
    const index = houseIndex(tree);
    out.same = same.map((x) => ({ id: x.id, key: keyOfHouse(tree, x, index) }));
  }
  // the skeleton of its municipality (spec 030 part 2): what the house's research stands on
  const town = row.place.id ? townRecord(tree, row.place.id) : undefined;
  if (town)
    out.town = {
      id: town.id,
      ...(town.text ? { text: town.text } : {}),
      passed: town.passed,
      manual: town.manual,
      archiveOnly: town.archiveOnly,
      maps: town.maps,
      ...(town.pictures?.length ? { pictures: town.pictures } : {}),
      ...(town.fieldNames?.length ? { fieldNames: town.fieldNames } : {}),
    };
  return out;
}

/** A house's summary for a list: how many of each. */
export function houseSummary(row: HouseRow): { events: number; holders: number; residents: number; unknown: number; materials: number; passed: number } {
  const h = row.record;
  return {
    events: h?.timeline.length ?? 0,
    holders: h?.holders.length ?? 0,
    residents: h?.residents.length ?? 0,
    unknown: h?.unknown.length ?? 0,
    materials: row.materials.length,
    passed: h?.passed.length ?? 0,
  };
}

/**
 * The work of a house's task as the Strom app reads it: takeover, house or town — a house's look (spec 145 T1) is the
 * house's work with look true, so an app that knows the three values loses nothing.
 */
function workOut(work: HouseWork | undefined): Record<string, unknown> {
  if (!work) return {};
  return work === "look" ? { work: "house", look: true } : { work };
}

/** A house as a list gives it (strom house list --json, GET <token>/houses): spec 030 §4.2. */
export function listRow(row: HouseRow): Record<string, unknown> {
  return {
    ...(row.id ? { id: row.id } : {}),
    key: row.key,
    place: row.place,
    house: row.house,
    ...(row.name ? { name: row.name } : {}),
    ...(row.record?.numbers.length ? { numbers: row.record.numbers.filter((n) => !n.notSame).map((n) => ({ number: n.number, ...(n.from ? { from: n.from } : {}), ...(n.to ? { to: n.to } : {}), certainty: n.certainty })) } : {}),
    persons: row.persons,
    ...(row.years ? { years: row.years } : {}),
    state: row.state,
    ...(row.at ? { at: row.at } : {}),
    ...(row.task ? { task: row.task } : {}),
    ...workOut(row.work),
    ...(row.question ? { question: row.question } : {}),
    summary: houseSummary(row),
  };
}

// ── what the bridge tells the Strom app (spec 030 §4.2) ─────────────────────────────────────────────────────────

/** The houses of the research the app lists: a record, a task or a material — a house only of the tree's facts not. */
export const researchHouses = (rows: HouseRow[]): HouseRow[] => rows.filter((r) => r.id || r.task || r.materials.length);

/**
 * The fingerprint of the houses (/status houses.rev, GET /houses): every house record, every task of a house and every
 * material of one, as they are now — any change of them changes it.
 */
export function housesRev(tree: Tree, rows: HouseRow[] = houseRows(tree)): string {
  const hash = crypto.createHash("sha256");
  for (const r of researchHouses(rows)) hash.update(`${r.key}\u0000${r.id ?? ""}\u0000${r.state}\u0000${r.task ?? ""}\u0000${r.at ?? ""}\u0000${r.question?.text ?? ""}\u0000${r.record?.updated ?? ""}\u0000${r.materials.join(",")}\n`);
  for (const t of tree.list<Task>("task").filter(forHouse).sort((a, b) => a.id.localeCompare(b.id))) hash.update(`${t.id}\u0000${t.updated}\u0000${t.state}\n`);
  for (const i of tree.list<Input>("input")) if (i.houses?.length) hash.update(`${i.id}\u0000${i.updated}\n`);
  // the skeletons of the municipalities (GET /houses/<key> town): a house's answer changes with its municipality's
  for (const h of tree.list<House>("house")) if (h.town) hash.update(`town\u0000${h.id}\u0000${h.updated}\u0000${h.retracted ? 1 : 0}\n`);
  return hash.digest("hex").slice(0, 16);
}

/**
 * /status houses (feature house), its part of the houses alone: how many houses in each state — held the tasks of houses
 * the setting off keeps aside (housesHeldCount, as census held) — and the fingerprint; on as the setting says (`on`,
 * never in an archive). The research's own (auto, estimate, layers): core/houseauto.ts housesBridgeStatus.
 */
export function housesStatus(tree: Tree, archive: boolean, on = false, rows: HouseRow[] = houseRows(tree)): { on: boolean; rev: string; counts: Record<Exclude<HouseState, "none">, number> } {
  const counts = { done: 0, running: 0, queued: 0, waiting: 0, held: 0 };
  // an archive: nothing researched, nothing counted (its tasks put aside say nothing of a research)
  if (archive) return { on: false, rev: housesRev(tree, rows), counts };
  for (const r of rows) if (r.state !== "none" && r.state !== "held") counts[r.state]++;
  counts.held = housesHeldCount(tree, on);
  return { on, rev: housesRev(tree, rows), counts };
}

/** A house as an archive shows it: nobody researches there — no state of a research, no task, no question. */
export function archiveRow(row: HouseRow): HouseRow {
  const { at: _at, task: _task, work: _work, question: _question, ...rest } = row;
  return { ...rest, state: "none" };
}

/** A house as the app names it in a path (GET /houses/<key|A…>): its key as the list gives it, else as typed. */
export function houseByRef(tree: Tree, ref: string, rows: HouseRow[] = houseRows(tree)): HouseRow {
  const r = ref.normalize("NFC").trim();
  return rows.find((x) => x.key === r || x.id === r) ?? findHouse(tree, r, rows);
}

/** The key of the house a task is of (a queue's row: house), else undefined (a municipality's task, no house). */
export function houseKeyOfTask(tree: Tree, t: Pick<Task, "origin">, index: () => HouseIndex): string | undefined {
  const of = houseOfTask(t);
  if (!of) return undefined;
  if (!/^A\d+$/u.test(of)) return of;
  const h = tree.get<House>(of);
  return h ? keyOfHouse(tree, h, index()) : undefined;
}

/** The codes an agent may give an item: for help and checks. */
export const HOUSE_CODES = {
  certainty: HOUSE_CERTAINTIES,
  numberCertainty: HOUSE_NUMBER_CERTAINTIES,
  kind: HOUSE_EVENT_KINDS,
  how: HOUSE_HOLDER_HOWS,
  role: HOUSE_RESIDENT_ROLES,
  locationHow: HOUSE_LOCATION_HOWS,
  mapKind: HOUSE_MAP_KINDS,
} as const;
