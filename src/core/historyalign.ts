// The history set right with the kinds looked for (strom history align, spec 035 K2): what history.kinds now leaves out
// hidden in this research (reversibly — shown again by align once the kind is looked for), what it adds looked for where
// the history was looked through without it (tasks of those kinds alone), and — only when asked — the events of the
// shared catalogs of the regions no research on this computer wants any more deleted (as the person deletes one:
// strom history restore brings it back). Nothing changes by the setting alone: align says first what it would do.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { EVENT_KINDS, type EventKind } from "./eventkinds.ts";
import { UsageError } from "./errors.ts";
import {
  deleteEvent,
  gapsOrigin,
  gapText,
  HIDDEN_FILE,
  HISTORY_LEVEL,
  joinSpans,
  otherWants,
  placesOn,
  readCatalog,
  readHidden,
  readLocal,
  readSkips,
  regionKindGaps,
  regionKinds,
  regionName,
  regionsOfMaps,
  regionsOfTree,
  regionsOn,
  treeKinds,
  type Gap,
  type Hide,
} from "./pastevents.ts";
import { placeKeyOf, placeKindsDone, placeLabel, placeOrigin, placeSkipped, readPlaceCatalog } from "./placehistory.ts";
import { Settings, type HistoryPace } from "./config.ts";
import { actsAsArchive } from "./state.ts";
import { phrase } from "./phrases.ts";
import { create } from "./records.ts";
import { stringifyCanonical } from "./json.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import type { Place, Task } from "./model.ts";
import type { Tree } from "./tree.ts";

const LIVE = new Set<Task["state"]>(["open", "doing", "parked", "waiting"]);

/** An event align hides or shows again: its ID, kind, and whose — a region's, a place's, the research's own source's. */
export interface AlignEvent {
  id: string;
  kind: EventKind;
  scope: "region" | "place" | "local";
  /** The region's ID, or the place's key (the catalog it is in); the place of a local one. */
  where: string;
}

/** A task of kinds align would raise: a finished region's years looked through without them, or a finished place. */
export interface AlignTask {
  region?: string;
  place?: string;
  kinds: EventKind[];
  years?: Gap[];
}

export interface AlignPlan {
  /** The kinds this research looks for (history.kinds). */
  kinds: EventKind[];
  /** Events of kinds not looked for, shown in this research now: hidden by align (general: the regions'; local: the places' and the sources'). */
  hide: { general: AlignEvent[]; local: AlignEvent[] };
  /** Events align hid before whose kind is looked for again: shown again. */
  show: AlignEvent[];
  /** Tasks of kinds turned on, where the history was looked through without them. */
  backfill: AlignTask[];
  /** Regions and places with a task of history at work: their kinds looked for after it (align again then). */
  busy: string[];
  /** Events of the shared catalogs of this tree's regions no research on this computer looks for (deleted only with --prune-shared). */
  prune: AlignEvent[];
  /** About so many sessions of the agent the tasks take, at the pace of the history. */
  sessions: number;
  pace: HistoryPace;
}

/** The kinds of the events the plan hides or shows, counted (for the texts): "war 3 · law 1". */
export function byKind(events: AlignEvent[]): { kind: EventKind; n: number }[] {
  const n = new Map<EventKind, number>();
  for (const e of events) n.set(e.kind, (n.get(e.kind) ?? 0) + 1);
  return EVENT_KINDS.filter((k) => n.has(k)).map((kind) => ({ kind, n: n.get(kind)! }));
}

/** Hidden in the whole tree already (by the person or by align): no second hide. */
function hiddenInTree(hides: Hide[]): Set<string> {
  return new Set(hides.filter((h) => h.event !== undefined && h.tree).map((h) => h.event!));
}

/**
 * What align would do now in this research; nothing written. `asked`: the kinds it would look for instead of those set
 * (strom history align --kinds, the Strom app's preview of a change before it is made).
 */
export function planAlign(tree: Tree, shared: string | undefined, settings: Settings = new Settings(tree.env, {}), asked?: readonly EventKind[]): AlignPlan {
  const kinds = asked ? EVENT_KINDS.filter((k) => asked.includes(k)) : treeKinds(tree, settings);
  const on = new Set<string>(kinds);
  const hides = readHidden(tree);
  const inTree = hiddenInTree(hides);
  const general: AlignEvent[] = [];
  const local: AlignEvent[] = [];
  const show: AlignEvent[] = [];
  const known = new Map<string, AlignEvent>();
  // the regions' events shown in this research: of the regions of its places
  const regions = regionsOfMaps(tree);
  for (const id of shared ? regions : []) {
    for (const e of readCatalog(shared!, id)?.events ?? []) {
      if (e.retracted) continue;
      const ev: AlignEvent = { id: e.id, kind: e.kind, scope: "region", where: id };
      known.set(e.id, ev);
      if (!on.has(e.kind) && !inTree.has(e.id)) general.push(ev);
    }
  }
  // the places' own catalogs and the events read in the research's sources: the local history
  const places = tree.list<Place>("place").filter((p) => !p.retracted);
  for (const p of shared ? places : []) {
    const key = placeKeyOf(tree, p);
    for (const e of readPlaceCatalog(shared!, key)?.events ?? []) {
      if (e.retracted || known.has(e.id)) continue;
      const ev: AlignEvent = { id: e.id, kind: e.kind, scope: "place", where: key };
      known.set(e.id, ev);
      if (!on.has(e.kind) && !inTree.has(e.id)) local.push(ev);
    }
  }
  for (const e of readLocal(tree).events) {
    if (e.retracted) continue;
    const ev: AlignEvent = { id: e.id, kind: e.kind, scope: "local", where: e.place };
    known.set(e.id, ev);
    if (!on.has(e.kind) && !inTree.has(e.id)) local.push(ev);
  }
  // align's own hides whose kind is looked for again
  for (const h of hides) {
    if (h.by !== "align" || h.event === undefined) continue;
    const ev = known.get(h.event);
    if (ev && on.has(ev.kind) && !show.some((x) => x.id === ev.id)) show.push(ev);
  }
  // the kinds turned on, where the history was looked through without them — never in an archive, never while off
  const backfill: AlignTask[] = [];
  const busy: string[] = [];
  const tasks = tree.list<Task>("task");
  if (shared && kinds.length && !actsAsArchive(tree)) {
    if (regionsOn(tree, settings)) {
      const skipped = new Set(readSkips(tree).regions.map((x) => x.region));
      for (const id of regionsOfTree(tree)) {
        if (skipped.has(id)) continue;
        const missing = regionKindGaps(tree, shared, id, kinds);
        if (!missing.size) continue;
        if (tasks.some((t) => t.origin === gapsOrigin(id) && LIVE.has(t.state))) {
          busy.push(id);
          continue;
        }
        backfill.push({ region: id, kinds: [...missing.keys()], years: joinSpans([...missing.values()].flat()) });
      }
    }
    if (placesOn(tree, settings))
      for (const p of places) {
        const c = readPlaceCatalog(shared, placeKeyOf(tree, p));
        if (!c?.done || placeSkipped(tree, p)) continue;
        const done = placeKindsDone(c);
        const missing = kinds.filter((k) => !done.includes(k));
        if (!missing.length) continue;
        if (tasks.some((t) => t.origin === placeOrigin(p.id) && LIVE.has(t.state))) {
          busy.push(p.id);
          continue;
        }
        backfill.push({ place: p.id, kinds: missing });
      }
  }
  // the shared catalogs: what no research on this computer sharing the region looks for (K1.5, O4)
  const prune: AlignEvent[] = [];
  if (shared) {
    const others = otherWants(tree, settings);
    for (const id of regions) {
      const wanted = new Set<string>(regionKinds(tree, id, settings, others, kinds));
      for (const e of readCatalog(shared, id)?.events ?? []) if (!e.retracted && !wanted.has(e.kind)) prune.push({ id: e.id, kind: e.kind, scope: "region", where: id });
    }
  }
  return { kinds, hide: { general, local }, show, backfill, busy, prune, sessions: backfill.length, pace: settings.historyPace(tree.config) };
}

/** Nothing to do (the shared catalogs aside, which change only when asked). */
export function alignEmpty(plan: AlignPlan): boolean {
  return !plan.hide.general.length && !plan.hide.local.length && !plan.show.length && !plan.backfill.length;
}

export interface AlignDone {
  hidden: number;
  shown: number;
  tasks: string[];
  pruned: string[];
  /** The align as kept (history/aligns.json) when it hid or showed anything: strom history align --undo <it>. */
  undo?: string;
}

/** What align did, kept for its --undo (the newest ALIGNS_KEPT): the hides it wrote are marked with its id. */
export interface AlignRecord {
  id: string;
  at: string;
  kinds: EventKind[];
  /** The events it hid (each hide marked align: id). */
  hidden: string[];
  /** The hides of earlier aligns it took away (their kind looked for again): put back by its undo. */
  shown: Hide[];
  /** The tasks it raised (they stay on undo: strom task drop, the person's). */
  tasks: string[];
  /** When it was taken back. */
  undone?: string;
}

export const ALIGNS_FILE = "history/aligns.json";
/** So many aligns kept to be taken back. */
const ALIGNS_KEPT = 20;

export function readAligns(tree: Tree): AlignRecord[] {
  const file = path.join(tree.root, ALIGNS_FILE);
  try {
    const f = JSON.parse(fs.readFileSync(file, "utf8")) as { aligns?: unknown };
    return Array.isArray(f.aligns) ? (f.aligns as AlignRecord[]).filter((a) => !!a && typeof a.id === "string" && Array.isArray(a.hidden) && Array.isArray(a.shown)) : [];
  } catch {
    return [];
  }
}

/**
 * A short mark of what the plan does (the kinds, the events hidden and shown again, the tasks, the shared catalogs):
 * the app's preview names it when it asks for the plan done — another plan by then (the setting changed, new events
 * found) is refused, history.align.changed, never done unseen.
 */
export function planMark(plan: AlignPlan): string {
  const ids = (events: AlignEvent[]) => events.map((e) => e.id).sort();
  const what = {
    kinds: plan.kinds,
    hide: ids([...plan.hide.general, ...plan.hide.local]),
    show: ids(plan.show),
    backfill: plan.backfill.map((b) => [b.region ?? b.place, b.kinds, (b.years ?? []).map(gapText)]),
    prune: ids(plan.prune),
  };
  return crypto.createHash("sha256").update(JSON.stringify(what)).digest("hex").slice(0, 16);
}

/** The name of a region or a place of the plan, in the research's language (its ID when none is known). */
export function alignLabel(tree: Tree, shared: string | undefined, where: { region?: string; place?: string }): string {
  if (where.region) return regionName(shared ? readCatalog(shared, where.region) : undefined, tree.lang, where.region);
  const p = where.place ? tree.get<Place>(where.place) : undefined;
  return p && !p.retracted ? placeLabel(p, tree.lang) : (where.place ?? "");
}

/**
 * What align would do, as data (strom history align --json, the bridge's GET /history/align): counted by kind, the
 * tasks and the regions and places at work with their names, the shared catalogs apart, the plan's mark. `events`: the
 * IDs too (the bridge leaves them out — the app needs the counts).
 */
export function alignData(tree: Tree, shared: string | undefined, plan: AlignPlan, prune: boolean, events = true) {
  const counts = (list: AlignEvent[]) => Object.fromEntries(byKind(list).map((x) => [x.kind, x.n]));
  const part = (list: AlignEvent[]) => ({ n: list.length, kinds: counts(list), ...(events ? { events: list.map((e) => e.id) } : {}) });
  return {
    kinds: plan.kinds,
    plan: planMark(plan),
    hide: { general: part(plan.hide.general), local: part(plan.hide.local) },
    show: part(plan.show),
    backfill: plan.backfill.map((b) => ({ ...(b.region ? { region: b.region } : { place: b.place }), label: alignLabel(tree, shared, b), kinds: b.kinds, ...(b.years ? { years: b.years.map(gapText) } : {}) })),
    sessions: plan.sessions,
    pace: plan.pace,
    busy: plan.busy.map((id) => ({ id, label: /^L\d+$/u.test(id) ? alignLabel(tree, shared, { place: id }) : alignLabel(tree, shared, { region: id }) })),
    shared: { ...part(plan.prune), prune },
  };
}

/** The kinds said in the research language ("válka, epidemie"). */
export function kindNames(lang: string, kinds: readonly string[]): string {
  return EVENT_KINDS.filter((k) => kinds.includes(k))
    .map((k) => ui(lang, `ui.history.kind.${k}` as UIKey))
    .join(", ");
}

/**
 * The plan done (the person's yes, strom history align): the hides and shows in one change of history/hidden.json, a
 * task for each region and place to look for the kinds turned on, the shared catalogs pruned only with `prune`. Inside
 * the tree's lock; committed by the caller.
 */
export function applyAlign(tree: Tree, shared: string | undefined, plan: AlignPlan, prune: boolean, only?: "hide"): AlignDone {
  return tree.withTreeLock(() => {
    const at = new Date().toISOString();
    const hidden = readHidden(tree);
    const showing = new Set(plan.show.map((e) => e.id));
    const hiding = [...plan.hide.general, ...plan.hide.local];
    const id = `${at.replace(/\D/gu, "").slice(0, 14)}-${crypto.randomBytes(3).toString("hex")}`;
    const shown = hidden.filter((h) => h.by === "align" && h.event !== undefined && showing.has(h.event));
    const next: Hide[] = [...hidden.filter((h) => !shown.includes(h)), ...hiding.map((e): Hide => ({ event: e.id, tree: true, at, by: "align", align: id }))];
    const changes = hiding.length > 0 || shown.length > 0;
    if (changes)
      tree.putFile(HIDDEN_FILE, stringifyCanonical({ hidden: next }), {
        op: "history.align",
        targets: [],
        summary: `History aligned with the kinds looked for (${plan.kinds.length ? plan.kinds.join(", ") : "none"}): ${hiding.length} event(s) hidden, ${plan.show.length} shown again`,
      });
    const lang = tree.lang;
    const tasks: string[] = [];
    for (const b of only === "hide" ? [] : plan.backfill) {
      const names = kindNames(lang, b.kinds);
      const fields = b.region
        ? {
            what: phrase(lang, "history.kinds.what", { kinds: names, region: regionName(shared ? readCatalog(shared, b.region) : undefined, lang, b.region), years: (b.years ?? []).map(gapText).join(", ") }),
            where: (b.years ?? []).map(gapText),
            why: phrase(lang, "history.kinds.why", { kinds: names }),
            doneWhen: phrase(lang, "history.kinds.done"),
            origin: gapsOrigin(b.region),
          }
        : (() => {
            const p = tree.get<Place>(b.place!)!;
            return {
              what: phrase(lang, "history.place.kinds.what", { kinds: names, place: placeLabel(p, lang) }),
              where: [phrase(lang, "history.place.where", { km: 10 })],
              why: phrase(lang, "history.kinds.why", { kinds: names }),
              doneWhen: phrase(lang, "history.kinds.done"),
              origin: placeOrigin(p.id),
            };
          })();
      tasks.push(
        create<Task>(tree, "task", { level: HISTORY_LEVEL, priority: 1, subject: [], state: "open", kinds: [...b.kinds], ...fields }, (id) => `+${id} task "${fields.what.slice(0, 60)}" (history, kinds ${b.kinds.join(", ")})`).id,
      );
    }
    const pruned: string[] = [];
    if (prune && shared && only !== "hide") for (const e of plan.prune) if (deleteEvent(tree, shared, e.id).changed) pruned.push(e.id);
    // kept to be taken back (the newest ALIGNS_KEPT): what it hid, the hides it took away, the tasks it raised
    if (changes || tasks.length) {
      const record: AlignRecord = { id, at, kinds: plan.kinds, hidden: hiding.map((e) => e.id), shown, tasks };
      const aligns = [...readAligns(tree), record].slice(-ALIGNS_KEPT);
      tree.putFile(ALIGNS_FILE, stringifyCanonical({ aligns }), { op: "history.align", targets: [], summary: `History align ${id} kept to be taken back` });
    }
    return { hidden: hiding.length, shown: plan.show.length, tasks, pruned, ...(changes ? { undo: id } : {}) };
  });
}

/**
 * An align taken back (strom history align --undo <id>; the Strom app's Back right after it, POST /history/align/undo):
 * the events it hid shown again, the hides of earlier aligns it took away put back. The tasks it raised stay (strom
 * task drop, the person's); what the person hid or showed since stays as they left it. Inside the tree's lock.
 */
export function undoAlign(tree: Tree, id: string): { shown: number; hidden: number; tasks: string[] } {
  return tree.withTreeLock(() => {
    const aligns = readAligns(tree);
    const record = aligns.find((a) => a.id === id);
    if (!record) throw new UsageError(`no align ${id} to take back`, { code: "history.align.undo", hint: "strom history align --json says what align would do now; the hides of an align: strom history list --hidden" });
    if (record.undone) throw new UsageError(`the align ${id} was taken back already (${record.undone})`, { code: "history.align.undone" });
    const hidden = readHidden(tree);
    const mine = hidden.filter((h) => h.align === id);
    const back = record.shown.filter((h) => h.event !== undefined && !hidden.some((x) => x.event === h.event && x.tree && x.place === undefined && x.person === undefined));
    const at = new Date().toISOString();
    tree.putFile(HIDDEN_FILE, stringifyCanonical({ hidden: [...hidden.filter((h) => h.align !== id), ...back] }), {
      op: "history.align.undo",
      targets: [],
      summary: `History align ${id} taken back: ${mine.length} event(s) shown again, ${back.length} hidden again`,
    });
    const kept = aligns.map((a) => (a.id === id ? { ...a, undone: at } : a));
    tree.putFile(ALIGNS_FILE, stringifyCanonical({ aligns: kept }), { op: "history.align.undo", targets: [], summary: `History align ${id} taken back` });
    return { shown: mine.length, hidden: back.length, tasks: record.tasks };
  });
}
