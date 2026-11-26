// The map layers the Strom app may draw over a house's place (spec 030 part 2, §4.1 answer 9; K7.2, K4.3): defined in
// data (assets/maplayers.json), never a map server named in code — open services whose host strom's list of archives'
// terms has as allowed for automated use (test/unit/maplayers.test.ts). /status houses.layers gives those whose bounding
// box holds a place of a house of the tree; a house's maps[] item refers to one by its id (layer).

import { readAsset } from "./assets.ts";
import { HOUSE_MAP_KINDS, type Place } from "./model.ts";
import type { HouseRow } from "./houses.ts";
import type { Tree } from "./tree.ts";

/** One layer as assets/maplayers.json defines it. */
export interface MapLayer {
  id: string;
  /** What a house's maps[] item calls such a map (HOUSE_MAP_KINDS). */
  kind?: (typeof HOUSE_MAP_KINDS)[number];
  /** Its name by language (en at least). */
  label: Record<string, string>;
  type: "wms";
  url: string;
  /** The WMS layers to ask for. */
  layers: string;
  format?: string;
  /**
   * The one coordinate system the service draws in, when it draws in no other (a service of S-JTSK alone: "EPSG:5514");
   * left out: it draws in Web Mercator (EPSG:3857) and WGS 84 (EPSG:4326) too. An app that cannot draw in it leaves the layer out.
   */
  crs?: string;
  attribution: string;
  license: string;
  minZoom?: number;
  /** [west, south, east, north], degrees (WGS 84). */
  bbox: [number, number, number, number];
  /** The day its service was checked. */
  checked?: string;
}

/** A layer id: lowercase letters, digits and hyphens. */
export const LAYER_ID = /^[a-z0-9][a-z0-9-]{0,39}$/u;

/** A layer's coordinate system: an EPSG code. */
export const LAYER_CRS = /^EPSG:[0-9]{4,6}$/u;

const okBox = (b: unknown): b is [number, number, number, number] =>
  Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === "number" && Number.isFinite(n)) && b[0] < b[2] && b[1] < b[3];

/** A layer whose definition is whole (one cut short or of another type is left out, never guessed). */
export function layerOk(v: unknown): v is MapLayer {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const l = v as Record<string, unknown>;
  const label = l.label as Record<string, unknown> | undefined;
  return (
    typeof l.id === "string" && LAYER_ID.test(l.id) &&
    (l.kind === undefined || (HOUSE_MAP_KINDS as readonly unknown[]).includes(l.kind)) &&
    !!label && typeof label === "object" && typeof label.en === "string" && Object.values(label).every((x) => typeof x === "string" && !!x.trim()) &&
    l.type === "wms" && typeof l.url === "string" && /^https:\/\//u.test(l.url) &&
    typeof l.layers === "string" && !!l.layers && (l.format === undefined || typeof l.format === "string") &&
    (l.crs === undefined || (typeof l.crs === "string" && LAYER_CRS.test(l.crs))) &&
    typeof l.attribution === "string" && !!l.attribution.trim() && typeof l.license === "string" && !!l.license.trim() &&
    (l.minZoom === undefined || (typeof l.minZoom === "number" && Number.isInteger(l.minZoom) && l.minZoom >= 0 && l.minZoom <= 22)) &&
    okBox(l.bbox)
  );
}

let shipped: MapLayer[] | undefined;
/** The layers strom ships (assets/maplayers.json), read once. */
export function mapLayers(): MapLayer[] {
  if (shipped) return shipped;
  let v: unknown;
  try {
    v = JSON.parse(readAsset("maplayers.json") ?? "{}");
  } catch {
    v = {};
  }
  const list = (v as { layers?: unknown }).layers;
  return (shipped = Array.isArray(list) ? list.filter(layerOk) : []);
}

/** The layer of this id, if strom ships one. */
export const mapLayer = (id: string): MapLayer | undefined => mapLayers().find((l) => l.id === id);

/** Whether a point lies within a layer's bounding box. */
export const inBox = (l: Pick<MapLayer, "bbox">, p: { lat: number; lon: number }): boolean =>
  p.lon >= l.bbox[0] && p.lon <= l.bbox[2] && p.lat >= l.bbox[1] && p.lat <= l.bbox[3];

/** A layer as the app is told it: its label in the research language (else English). */
export function layerView(l: MapLayer, lang: string): Record<string, unknown> {
  return {
    id: l.id,
    ...(l.kind ? { kind: l.kind } : {}),
    label: l.label[lang] ?? l.label.en!,
    type: l.type,
    url: l.url,
    layers: l.layers,
    ...(l.format ? { format: l.format } : {}),
    ...(l.crs ? { crs: l.crs } : {}),
    attribution: l.attribution,
    license: l.license,
    ...(l.minZoom !== undefined ? { minZoom: l.minZoom } : {}),
    bbox: l.bbox,
  };
}

/**
 * The layers for the houses of this tree (/status houses.layers): those whose bounding box holds the point of a
 * municipality of a house (its place record's coords) — none: undefined (the field left out).
 */
export function layersFor(tree: Tree, rows: HouseRow[], layers: MapLayer[] = mapLayers()): Record<string, unknown>[] | undefined {
  if (!layers.length) return undefined;
  const points: { lat: number; lon: number }[] = [];
  for (const id of new Set(rows.map((r) => r.place.id).filter((x): x is string => !!x))) {
    const c = tree.get<Place>(id)?.coords;
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) points.push(c);
  }
  const out = layers.filter((l) => points.some((p) => inBox(l, p))).map((l) => layerView(l, tree.lang));
  return out.length ? out : undefined;
}
