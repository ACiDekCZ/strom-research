// The places of the facts mapped by another research on this computer (the history of the regions, core/pastevents.ts):
// the regions' catalogs are shared by every tree of the user, the map of a tree's places to them is the tree's alone
// (<tree>/history/places.json) — a second tree would pay the agent again for the places another one mapped already.
//
// Before the places' task is raised (raiseHistoryTasks) and by strom history adopt, each place of this tree's facts that
// has no entry in its map yet is looked for in the maps of the other trees strom knows here — read only, raw: their
// history/places.json and their place records, nothing else of them (no person, family or source crosses trees; only a
// place → its regions), never through their seal or lock, nothing written there; a tree a newer strom wrote, unreadable
// or at work under its lock is left out quietly.
//
// One place in both trees: its key the same by foldText, and its place records agree — coordinates within SAME_KM, the
// same parish, or the same district or county; coordinates both given and more than OTHER_KM apart: another place.
// - unambiguous (one tree at least sure it is the same place, every other that has it maps it the same, every region's
//   catalog here, its entry neither unlocated nor to be determined again): taken into this tree's map as one logged,
//   sealed operation (history.adopt), the entry saying whence (`from`), never the person's word (`manual`) — the agent's
//   strom history map may still change it;
// - otherwise, where another tree maps a place of the name: a suggestion in the brief of the places' task — the agent
//   decides;
// - the rest: the agent maps as before.
// A place this tree's map has an entry for (the agent's, the person's, one skipped or to be determined again) is never
// touched.

import fs from "node:fs";
import path from "node:path";
import { readJsonIfExists, stringifyCanonical } from "./json.ts";
import { foldText } from "./text.ts";
import { Settings } from "./config.ts";
import { knownTreesIn, Tree, TREE_FILE } from "./tree.ts";
import { RECORD_TYPES, type Place } from "./model.ts";
import { PLACES_FILE, placeNamed, readCatalog, readPlaces, regionIdOk, unmappedPlaces, type PlaceMap, type RegionLink } from "./pastevents.ts";

/** Records of one place in two trees within so many km: the same place. */
export const SAME_KM = 2;
/** Records of a place of the name in two trees farther apart: another place, nothing taken nor suggested. */
export const OTHER_KM = 5;

/** What tells it is the same place: the coordinates, the parish, the district or county. */
export type Sure = "coords" | "parish" | "district";

/** What a place record says of where the place is (the brief's suggestion: the agent decides by it). */
export interface PlaceSigns {
  record: string;
  kind?: string;
  parish?: string[];
  district?: string[];
  coords?: { lat: number; lon: number };
}

export interface TakenPlace {
  /** The place as this tree's facts write it. */
  place: string;
  regions: RegionLink[];
  also?: string[];
  /** The other research's id (never its name). */
  tree: string;
  by: Sure;
}

export interface SuggestedPlace {
  place: string;
  /** Each map of a place of the name in another research, with what its record says (none: no record there). */
  options: { regions: RegionLink[]; tree: string; sure?: Sure; signs?: PlaceSigns }[];
}

export interface AdoptPlan {
  taken: TakenPlace[];
  suggested: SuggestedPlace[];
  /** No map of another research helps: the agent maps them. */
  left: string[];
  /** Of the places waiting, those taken were written (false: a dry run, or nothing to take). */
  written: boolean;
}

interface OtherMap {
  key: string;
  map: PlaceMap;
}

interface Other {
  id: string;
  root: string;
  /** Its usable maps by the folded key: regions, not unlocated nor to be determined again. */
  maps: Map<string, OtherMap>;
  /** Its place records, read once asked for. */
  named?: (key: string) => Place | undefined;
  open: () => Tree | undefined;
}

/** Per process: each other tree read once while its strom.json, map and place records stay as they were. */
const memo = new Map<string, { sig: string; other: Other | null }>();

function signature(root: string): string {
  return [TREE_FILE, PLACES_FILE, path.join("data", RECORD_TYPES.place.dir)]
    .map((rel) => {
      try {
        const s = fs.statSync(path.join(root, ...rel.split("/")));
        return `${s.mtimeMs}:${s.size}`;
      } catch {
        return "-";
      }
    })
    .join("|");
}

function linksOk(regions: unknown): regions is RegionLink[] {
  return (
    Array.isArray(regions) &&
    regions.length > 0 &&
    regions.every(
      (r) =>
        !!r &&
        typeof r === "object" &&
        typeof (r as RegionLink).id === "string" &&
        regionIdOk((r as RegionLink).id) &&
        ((r as RegionLink).from === undefined || Number.isInteger((r as RegionLink).from)) &&
        ((r as RegionLink).to === undefined || Number.isInteger((r as RegionLink).to)),
    )
  );
}

/** Another tree's map, raw and read only; null when it is left out (a newer strom's, unreadable). */
function readOther(root: string, id: string, env: Tree["env"]): Other | null {
  let file: { places?: Record<string, PlaceMap> } | undefined;
  try {
    file = readJsonIfExists<{ places?: Record<string, PlaceMap> }>(path.join(root, ...PLACES_FILE.split("/")));
  } catch {
    return null;
  }
  const maps = new Map<string, OtherMap>();
  const places = file && typeof file.places === "object" && file.places ? file.places : {};
  for (const [key, m] of Object.entries(places)) {
    if (!m || typeof m !== "object" || m.state === "unlocated" || m.state === "redo" || !linksOk(m.regions)) continue;
    const k = key.normalize("NFC").replace(/\s+/gu, " ").trim();
    const f = foldText(k);
    const had = maps.get(f);
    // the same place written twice (decomposed, an older strom): the person's word there first, else the latest
    if (had && (!!had.map.manual > !!m.manual || (!!had.map.manual === !!m.manual && (had.map.at ?? "") >= (m.at ?? "")))) continue;
    maps.set(f, { key: k, map: m });
  }
  let tree: Tree | undefined | null;
  const open = () => {
    if (tree === undefined) {
      try {
        tree = Tree.open(root, env);
      } catch {
        tree = null;
      }
    }
    return tree ?? undefined;
  };
  // a newer strom's tree: never read (Tree.open refuses it before anything)
  if (!open()) return null;
  return { id, root, maps, open };
}

function namedIn(o: Other): (key: string) => Place | undefined {
  if (!o.named) {
    let records: Place[] = [];
    try {
      records = o.open()?.list<Place>("place") ?? [];
    } catch {
      records = [];
    }
    o.named = placeNamed(records);
  }
  return o.named;
}

/** The other trees strom knows on this computer (this one, and copies of it, left out), each read once. */
function otherTrees(tree: Tree, settings: Settings): Other[] {
  const here = path.resolve(tree.root);
  const out: Other[] = [];
  let known: ReturnType<typeof knownTreesIn> = [];
  try {
    known = knownTreesIn(settings.trees()?.value, settings.config.extraTrees ?? []);
  } catch {
    return [];
  }
  for (const t of known) {
    if (t.id === tree.config.id || path.resolve(t.root) === here) continue;
    // at work under its lock: left out this time
    if (fs.existsSync(path.join(t.root, ".strom", "tree.lock"))) continue;
    const sig = signature(t.root);
    let m = memo.get(t.root);
    if (!m || m.sig !== sig) memo.set(t.root, (m = { sig, other: readOther(t.root, t.id, tree.env) }));
    if (m.other) out.push(m.other);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function jurisdictionNames(p: Place, kinds: readonly string[]): string[] {
  return [...new Set((p.jurisdictions ?? []).filter((j) => kinds.includes(j.kind) && typeof j.name === "string" && j.name.trim()).map((j) => foldText(j.name.trim())))];
}

const PARISH = ["parish"] as const;
const DISTRICT = ["district", "county"] as const;

/** Two records of a place of the name: the same place (and by what), another place, or nothing tells. */
function identity(mine: Place | undefined, theirs: Place | undefined): Sure | "other" | undefined {
  if (!mine || !theirs) return undefined;
  if (mine.coords && theirs.coords) {
    const d = km(mine.coords, theirs.coords);
    if (d > OTHER_KM) return "other";
    if (d <= SAME_KM) return "coords";
  }
  const meets = (kinds: readonly string[]) => {
    const a = jurisdictionNames(mine, kinds);
    const b = new Set(jurisdictionNames(theirs, kinds));
    return a.some((n) => b.has(n));
  };
  if (meets(PARISH)) return "parish";
  if (meets(DISTRICT)) return "district";
  return undefined;
}

function signsOf(p: Place | undefined): PlaceSigns | undefined {
  if (!p) return undefined;
  const of = (kinds: readonly string[]) => [...new Set((p.jurisdictions ?? []).filter((j) => kinds.includes(j.kind)).map((j) => j.name))];
  const parish = of(PARISH);
  const district = of(DISTRICT);
  return {
    record: p.id,
    ...(p.kind ? { kind: p.kind } : {}),
    ...(parish.length ? { parish } : {}),
    ...(district.length ? { district } : {}),
    ...(p.coords ? { coords: p.coords } : {}),
  };
}

/** Regions with their years, the same however they are ordered. */
function sameKey(regions: RegionLink[]): string {
  return JSON.stringify(regions.map((r) => [r.id, r.from ?? null, r.to ?? null]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

/** The places of this tree's facts with no entry in its map: those another research may help with. */
function waiting(tree: Tree): string[] {
  const unmapped = unmappedPlaces(tree);
  if (!unmapped.length) return [];
  const entries = new Set(Object.keys(readPlaces(tree)).map((k) => foldText(k)));
  return unmapped.filter((k) => !entries.has(foldText(k)));
}

/**
 * What the other trees on this computer say of the places waiting here — nothing written. Another tree is read only
 * when a place waits.
 */
export function adoptionPlan(tree: Tree, shared: string | undefined, settings: Settings = new Settings(tree.env, {})): AdoptPlan {
  const places = waiting(tree);
  const plan: AdoptPlan = { taken: [], suggested: [], left: [], written: false };
  if (!places.length) return plan;
  const others = otherTrees(tree, settings);
  if (!others.length) return { ...plan, left: places };
  const mine = placeNamed(tree.list<Place>("place"));
  const catalogs = new Map<string, boolean>();
  const catalogHere = (id: string) => {
    if (!catalogs.has(id)) catalogs.set(id, !!shared && !!readCatalog(shared, id));
    return catalogs.get(id)!;
  };
  for (const place of places) {
    const f = foldText(place);
    const here = mine(place);
    const found = others.flatMap((o) => {
      const m = o.maps.get(f);
      if (!m) return [];
      const theirs = namedIn(o)(m.key);
      const sure = identity(here, theirs);
      return sure === "other" ? [] : [{ o, m, theirs, sure }];
    });
    // a region with no catalog here: neither taken nor suggested (strom history map would refuse it)
    const usable = found.filter((x) => x.m.map.regions.every((r) => catalogHere(r.id)));
    const ways = new Set(found.map((x) => sameKey(x.m.map.regions)));
    // the research that mapped it itself before one that took it from another
    const sure = usable.filter((x) => x.sure !== undefined).sort((x, y) => Number(!!x.m.map.from) - Number(!!y.m.map.from))[0];
    if (sure && ways.size === 1 && usable.length === found.length) {
      plan.taken.push({
        place,
        regions: sure.m.map.regions.map((r) => ({ id: r.id, ...(r.from !== undefined ? { from: r.from } : {}), ...(r.to !== undefined ? { to: r.to } : {}) })),
        ...(Array.isArray(sure.m.map.also) && sure.m.map.also.length ? { also: sure.m.map.also.filter((a) => typeof a === "string") } : {}),
        tree: sure.o.id,
        by: sure.sure!,
      });
      continue;
    }
    if (usable.length) {
      // one option a way of mapping it, a tree sure of it first
      const options = new Map<string, SuggestedPlace["options"][number]>();
      for (const x of [...usable].sort((a, b) => Number(b.sure !== undefined) - Number(a.sure !== undefined))) {
        const k = sameKey(x.m.map.regions);
        if (options.has(k)) continue;
        const signs = signsOf(x.theirs);
        options.set(k, { regions: x.m.map.regions, tree: x.o.id, ...(x.sure ? { sure: x.sure } : {}), ...(signs ? { signs } : {}) });
      }
      plan.suggested.push({ place, options: [...options.values()] });
      continue;
    }
    plan.left.push(place);
  }
  return plan;
}

/** A region as strom history map takes it (--region <id>[:<from>-<to>]). */
export function regionArg(r: RegionLink): string {
  return r.from === undefined && r.to === undefined ? r.id : `${r.id}:${r.from ?? ""}-${r.to ?? ""}`;
}

/**
 * The places another research maps unambiguously taken into this tree's map (inside its lock, one sealed operation
 * history.adopt): the plan after. Nothing written in a dry run, an archive, or with the history off — the caller asks.
 */
export function adoptPlaces(tree: Tree, shared: string | undefined, settings: Settings = new Settings(tree.env, {})): AdoptPlan {
  return tree.withTreeLock(() => {
    const plan = adoptionPlan(tree, shared, settings);
    if (!plan.taken.length || tree.dryRun) return plan;
    const places = readPlaces(tree);
    const had = new Set(Object.keys(places).map((k) => foldText(k)));
    const at = new Date().toISOString();
    const taken = plan.taken.filter((t) => !had.has(foldText(t.place)));
    if (!taken.length) return plan;
    for (const t of taken) places[t.place] = { regions: t.regions, ...(t.also?.length ? { also: t.also } : {}), from: { tree: t.tree }, at };
    const named = taken.slice(0, 5).map((t) => t.place);
    tree.putFile(PLACES_FILE, stringifyCanonical({ places }), {
      op: "history.adopt",
      targets: [],
      summary: `Places mapped as another research on this computer maps them: ${taken.length} (${named.join(", ")}${taken.length > named.length ? ", …" : ""})`,
    });
    return { ...plan, taken, written: true };
  });
}
