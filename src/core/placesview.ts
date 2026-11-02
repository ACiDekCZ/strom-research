// The places as the Strom app reads them (spec 034; the app's ZADANI_VYZKUM_ztotozneni-mist.md, points 1–3, 5, 7, 16):
// each place record the facts name (and the records they are part of) with its names, jurisdictions, position, who put
// it on the map and why, where it is now (queued, in the session at work, a question, not located, identified); each
// place of the facts as it is written and the record it belongs to; the queue with its sessions and estimate; how many
// places are off the map, on it, asked about, not located. Computed, nothing written — the bridge's GET /places, and the
// questions of places in What waits (kind place).

import { createHash } from "node:crypto";
import type { Place, PlaceBy, PlaceNameKind, PlaceQuestion } from "./model.ts";
import type { Tree } from "./tree.ts";
import { factForms, identifyEstimate, identifyingNow, offMapForms, otherNames, placedForms, placeState, queueBatches, readPlacesFile, recordIndex, type FactForm, type PlaceState, type PlacesFile } from "./placeid.ts";
import { stringifyCanonical } from "./json.ts";

/** One place record as the app reads it (GET /places `places[L…]`). */
export interface PlaceView {
  name: string;
  /** After today's, each once; kind: a form the facts write (form) or another name (alt); none = not known (written before 1.25.0). */
  names: { name: string; lang?: string; from?: number; to?: number; kind?: PlaceNameKind }[];
  country?: string;
  district?: string;
  parish?: string;
  parent?: string;
  jurisdictions: { kind: string; name: string; from?: number; to?: number }[];
  coords?: { lat: number; lon: number };
  state?: PlaceState;
  by?: PlaceBy;
  at?: string;
  why?: string;
  source?: { title: string; url?: string };
  verified?: string;
  checkWhy?: string;
  needs?: string;
  /** A question waits (proposed, conflict): the item of What waits (its id is the place's). */
  waiting?: string;
  /** A conflict: the coordinates now. */
  current?: { lat: number; lon: number; label?: string };
  forms: string[];
  facts: number;
  persons: number;
}

export interface PlacesView {
  rev: string;
  places: Record<string, PlaceView>;
  forms: Record<string, { place: string } | { state: PlaceState } | Record<string, never>>;
  queue: { queued: number; running: number; batches: number; estimate: { minutes: [number, number]; usd?: [number, number] } };
  counts: { offMap: number; placed: number; proposed: number; unlocated: number };
}

/** What the places are read from once: the facts' places, each one's record, the queue and the session at work. */
interface Known {
  file: PlacesFile;
  forms: Map<string, FactForm>;
  recordOf: (form: string) => Place | undefined;
  /** The folded forms of the facts of each record. */
  ofRecord: Map<string, string[]>;
  /** The folded forms in the session at work. */
  running: Set<string>;
}

function known(tree: Tree): Known {
  const file = readPlacesFile(tree);
  const forms = factForms(tree);
  const recordOf = recordIndex(tree);
  const ofRecord = new Map<string, string[]>();
  for (const [key, f] of forms) {
    const p = recordOf(f.form);
    if (p) ofRecord.set(p.id, [...(ofRecord.get(p.id) ?? []), key]);
  }
  const running = identifyingNow(tree) ? new Set((queueBatches(tree, file, forms)[0] ?? []).map(([k]) => k)) : new Set<string>();
  return { file, forms, recordOf, ofRecord, running };
}

/** The jurisdiction of a kind as it is now (one with no end first, else the last). */
function jurisdiction(p: Place, kinds: string[]): string | undefined {
  const of = p.jurisdictions.filter((j) => kinds.includes(j.kind));
  return (of.find((j) => j.to === undefined) ?? of[of.length - 1])?.name;
}

/** Where a record is now: its forms' queue and the session at work, its question, its position. */
function stateOf(k: Known, p: Place): PlaceState | undefined {
  const keys = k.ofRecord.get(p.id) ?? [];
  const entry = keys.map((x) => k.file.queue[x]).find((e) => !!e);
  return placeState(p, entry, keys.some((x) => k.running.has(x)));
}

function view(k: Known, p: Place): PlaceView {
  const keys = k.ofRecord.get(p.id) ?? [];
  const facts = keys.reduce((n, x) => n + (k.forms.get(x)?.facts ?? 0), 0);
  const persons = new Set(keys.flatMap((x) => [...(k.forms.get(x)?.persons ?? [])]));
  const state = stateOf(k, p);
  const loc = p.locating;
  const q = loc?.question;
  const country = jurisdiction(p, ["state"]);
  const district = jurisdiction(p, ["district", "county"]);
  const parish = jurisdiction(p, ["parish"]);
  // who put it on the map: coordinates of no known origin (before identification was kept) are the person's
  const by = loc?.by ?? (p.coords ? "person" : undefined);
  const why = !p.coords && p.unlocated ? p.unlocated : q?.kind === "conflict" ? (q.why ?? loc?.why) : loc?.why;
  const current = q?.kind === "conflict" ? (q.current ?? (p.coords ? { lat: p.coords.lat, lon: p.coords.lon } : undefined)) : undefined;
  return {
    name: p.names[0]?.name ?? p.id,
    names: otherNames(p).map((n) => ({ name: n.name, ...(n.lang ? { lang: n.lang } : {}), ...(n.from !== undefined ? { from: n.from } : {}), ...(n.to !== undefined ? { to: n.to } : {}), ...(n.kind ? { kind: n.kind } : {}) })),
    ...(country ? { country } : {}),
    ...(district ? { district } : {}),
    ...(parish ? { parish } : {}),
    ...(p.parent ? { parent: p.parent } : {}),
    jurisdictions: p.jurisdictions.map((j) => ({ kind: j.kind, name: j.name, ...(j.from !== undefined ? { from: j.from } : {}), ...(j.to !== undefined ? { to: j.to } : {}) })),
    ...(p.coords ? { coords: { lat: p.coords.lat, lon: p.coords.lon } } : {}),
    ...(state ? { state } : {}),
    ...(by ? { by } : {}),
    ...(loc?.at ? { at: loc.at } : {}),
    ...(why ? { why } : {}),
    ...(loc?.source ? { source: loc.source } : {}),
    ...(loc?.verified ? { verified: loc.verified } : {}),
    ...(loc?.checkWhy ? { checkWhy: loc.checkWhy } : {}),
    ...(!p.coords && p.unlocated && loc?.needs ? { needs: loc.needs } : {}),
    ...(q && (state === "proposed" || state === "conflict") ? { waiting: p.id } : {}),
    ...(current ? { current } : {}),
    forms: keys.map((x) => k.forms.get(x)!.form),
    facts,
    persons: persons.size,
  };
}

/** One place as GET /places has it (after a write of the person: the place as it is now), or undefined when it is none. */
export function placeView(tree: Tree, id: string): PlaceView | undefined {
  const p = tree.get<Place>(id);
  if (!p || p.type !== "place" || p.retracted) return undefined;
  return view(known(tree), p);
}

/** The queue as the app reads it: what waits, what the session at work has, its sessions, one session's estimate. */
export function queueView(tree: Tree, k: Known = known(tree)): PlacesView["queue"] {
  const batches = queueBatches(tree, k.file, k.forms).length;
  const running = Object.keys(k.file.queue).filter((x) => k.running.has(x)).length;
  const est = identifyEstimate(tree, batches).session;
  return { queued: Object.keys(k.file.queue).length - running, running, batches, estimate: { minutes: est.minutes, ...(est.usd ? { usd: est.usd } : {}) } };
}

/** Everything the app reads of the places (GET /places). */
export function placesView(tree: Tree): PlacesView {
  const k = known(tree);
  const records = new Map(tree.list<Place>("place").filter((p) => !p.retracted).map((p) => [p.id, p]));
  // the records the facts name, those a question waits on, and the records they are part of
  const shown = new Set<string>();
  const todo = [...records.values()].filter((p) => k.ofRecord.has(p.id) || p.locating?.question).map((p) => p.id);
  while (todo.length) {
    const id = todo.pop()!;
    const p = records.get(id);
    if (!p || shown.has(id)) continue;
    shown.add(id);
    if (p.parent) todo.push(p.parent);
  }
  const places: Record<string, PlaceView> = {};
  for (const id of [...shown].sort()) places[id] = view(k, records.get(id)!);
  const forms: PlacesView["forms"] = {};
  for (const [key, f] of [...k.forms].sort((a, b) => a[1].form.localeCompare(b[1].form))) {
    const p = k.recordOf(f.form);
    forms[f.form] = p ? { place: p.id } : k.running.has(key) ? { state: "running" } : k.file.queue[key] ? { state: "queued" } : {};
  }
  const states = Object.values(places).map((p) => p.state);
  const counts = {
    offMap: offMapForms(tree, k.file).length,
    placed: placedForms(tree, k.file).length,
    proposed: states.filter((s) => s === "proposed" || s === "conflict").length,
    unlocated: states.filter((s) => s === "unlocated").length,
  };
  const queue = queueView(tree, k);
  const rev = createHash("sha256").update(stringifyCanonical({ places, forms, queue, counts })).digest("hex").slice(0, 16);
  return { rev, places, forms, queue, counts };
}

/** A question of a place for What waits: the place, its forms, how many people and which years, the question itself. */
export interface PlaceAsked {
  place: Place;
  question: PlaceQuestion;
  forms: string[];
  persons: number;
  years?: [number, number];
}

/** The open questions of places (one per place), the oldest first. */
export function placeQuestions(tree: Tree): PlaceAsked[] {
  const k = known(tree);
  const out: PlaceAsked[] = [];
  for (const p of tree.list<Place>("place")) {
    const q = p.locating?.question;
    if (p.retracted || !q) continue;
    const keys = k.ofRecord.get(p.id) ?? [];
    const years = keys.flatMap((x) => k.forms.get(x)?.years ?? []);
    out.push({
      place: p,
      question: q,
      forms: keys.map((x) => k.forms.get(x)!.form),
      persons: new Set(keys.flatMap((x) => [...(k.forms.get(x)?.persons ?? [])])).size,
      ...(years.length ? { years: [Math.min(...years), Math.max(...years)] as [number, number] } : {}),
    });
  }
  return out.sort((a, b) => a.question.at.localeCompare(b.question.at) || a.place.id.localeCompare(b.place.id));
}
