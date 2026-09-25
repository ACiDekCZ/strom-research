// The places of the facts on the map: the Strom app draws a fact where its
// place's coordinates are (the GEDCOM export pairs an event's place with a
// place record by name). A place of a fact that has none is off the map — no
// record of it yet, or one without coordinates. The agent completes them as
// the research goes, but only for a place it has identified (its district, its
// parish, today's name): of five villages of one name, the wrong one on the
// map misleads more than none. A place not identified yet says so (unlocated,
// with why) and is left alone until it is.

import type { Family, Person, Place } from "./model.ts";
import { foldText } from "./text.ts";
import type { Tree } from "./tree.ts";

export interface OffMap {
  /** The place as the facts write it. */
  name: string;
  /** How many facts are there. */
  events: number;
  /** Its record, when there is one (without coordinates). */
  place?: Place;
}

/** Places of facts that are not on the map and not marked as not identified yet, the most facts first. */
export function placesOffMap(tree: Tree): OffMap[] {
  const byName = new Map<string, Place>();
  for (const p of tree.list<Place>("place")) if (!p.retracted) for (const n of p.names) if (!byName.has(foldText(n.name)) || p.coords) byName.set(foldText(n.name), p);
  const seen = new Map<string, OffMap>();
  for (const owner of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
    if (owner.retracted) continue;
    for (const e of owner.events) {
      if (e.retracted || !e.place?.trim()) continue;
      const key = foldText(e.place);
      const place = byName.get(key);
      if (place?.coords || place?.unlocated) continue;
      const row = seen.get(key) ?? { name: e.place.trim(), events: 0, ...(place ? { place } : {}) };
      row.events++;
      seen.set(key, row);
    }
  }
  return [...seen.values()].sort((a, b) => b.events - a.events || a.name.localeCompare(b.name));
}

/** One place off the map, and the command that puts it there. */
export function offMapLine(m: OffMap): string {
  return m.place
    ? `${m.name} (${m.events} fact(s), ${m.place.id}): strom place edit ${m.place.id} --lat … --lon …`
    : `${m.name} (${m.events} fact(s), no place yet): strom place add "${m.name}" --kind … --lat … --lon …`;
}

/** What to do about them, in a line. */
export const OFF_MAP_HOW =
  "identify each first (its district, parish, today's name — the facts' records and the books tell); then the coordinates of that village; not sure which it is: --unlocated \"<why>\"";
