// The sources a house's research goes through (spec 145 T5), by region: data (assets/housesources.json), never a country
// named in code. The brief of a house's task, of a municipality's skeleton and of a house's look lists them for the agent;
// the house gets only what said something, one line of what was gone through ("gone through: …") and the steps by hand
// that belong to it — never the list.

import { readAsset } from "./assets.ts";
import type { Place } from "./model.ts";
import type { Tree } from "./tree.ts";

/** One source of the list: what to go through, where, and who can (the agent itself, or only the person by hand). */
export interface HouseSourceItem {
  id: string;
  what: string;
  where?: string;
  by: "agent" | "hand";
}

/** The parts of the list: a municipality's skeleton, each house, a special house besides, a house's look. */
export const SOURCE_PARTS = ["town", "house", "special", "look"] as const;
export type SourcePart = (typeof SOURCE_PARTS)[number];

export interface SourceRegion extends Partial<Record<SourcePart, HouseSourceItem[]>> {
  id: string;
  name: string;
  /** [west, south, east, north], degrees (WGS 84). */
  bbox: [number, number, number, number];
}

export interface HouseSourceData {
  general: Partial<Record<SourcePart, HouseSourceItem[]>>;
  regions: SourceRegion[];
}

let data: HouseSourceData | undefined;

/** The list strom ships, read once (none readable: empty). */
export function houseSourceData(): HouseSourceData {
  if (data) return data;
  try {
    const raw = JSON.parse(readAsset("housesources.json") ?? "{}") as Partial<HouseSourceData>;
    data = { general: raw.general ?? {}, regions: Array.isArray(raw.regions) ? raw.regions : [] };
  } catch {
    data = { general: {}, regions: [] };
  }
  return data;
}

const inBox = (r: SourceRegion, c: { lat: number; lon: number }) => c.lon >= r.bbox[0] && c.lat >= r.bbox[1] && c.lon <= r.bbox[2] && c.lat <= r.bbox[3];

/** The regions whose box holds a municipality's point (none: no point, or none holds it). */
export function regionsOf(place: Place | undefined, all: SourceRegion[] = houseSourceData().regions): SourceRegion[] {
  const c = place?.coords;
  if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) return [];
  return all.filter((r) => inBox(r, c));
}

/**
 * The items of a part for a municipality: its regions' where they have the part (the general ones else); a special
 * house's and a look's: the general ones and the regions' besides. Each region apart, by its name.
 */
export function sourcesFor(place: Place | undefined, part: SourcePart, src: HouseSourceData = houseSourceData()): { region?: string; items: HouseSourceItem[] }[] {
  const regions = regionsOf(place, src.regions).filter((r) => r[part]?.length);
  const general = src.general[part] ?? [];
  const besides = part === "special" || part === "look";
  if (!regions.length) return general.length ? [{ items: general }] : [];
  return [...(besides && general.length ? [{ items: general }] : []), ...regions.map((r) => ({ region: r.name, items: r[part]! }))];
}

const itemLine = (x: HouseSourceItem) => `  - ${x.by === "hand" ? "by hand: " : ""}${x.what}${x.where ? ` — ${x.where}` : ""}`;

/**
 * The list a session is given (the brief): the skeleton's for a municipality's task, each house's and a special house's
 * for a house's research, the look's for a house's look — with how it is gone through, never into the house.
 */
export function sourceChecklist(tree: Tree, placeId: string | undefined, work: "town" | "house" | "look"): string[] {
  const place = placeId ? tree.get<Place>(placeId) : undefined;
  const parts: { part: SourcePart; head?: string }[] =
    work === "town" ? [{ part: "town" }] : work === "house" ? [{ part: "house" }, { part: "special", head: "a special house (a mill, an inn, a smithy, a parish, a school) besides" }] : [{ part: "look" }];
  const out: string[] = [];
  for (const { part, head } of parts) {
    const groups = sourcesFor(place, part);
    if (!groups.length) continue;
    if (head) out.push(`  ${head}:`);
    for (const g of groups) {
      if (g.region) out.push(`  ${g.region}:`);
      out.push(...g.items.map(itemLine));
    }
  }
  if (!out.length) return [];
  return [
    "## Sources to go through (the list is yours, never the house's)",
    ...out,
    "  Go through each that can say something of this house: what said something is a finding of its own (with its source);",
    "  what said nothing is only named in the one line of what was gone through; a step by hand only where it belongs to",
    `  the house, with its link and what to do. No new tasks or questions from the list. Then: strom house add passed ${work === "town" ? "--town <L…>" : "A…"} --checklist --what "<gone through: …>" (in the research language).`,
  ];
}
