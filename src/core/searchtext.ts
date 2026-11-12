// The text of a record a full-text search reads (strom find; strom query counts the people who have a word only there).

import type { AnyRecord } from "./model.ts";

/** What was taken back or replaced (spec 016): kept for the history, never searched — at any depth of a record. */
const NOT_SEARCHED = new Set(["retractedNames", "retractedNotes", "edits", "noteEdits"]);

/** Searchable text of a record: every string of it, its parts apart (\u0001). */
export function searchText(r: AnyRecord): string {
  const parts: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach(add);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!NOT_SEARCHED.has(k)) add(x);
  };
  const { id: _i, type: _t, created: _c, updated: _u, ...rest } = r as unknown as Record<string, unknown>;
  // a person's titles ("Ing.", "ml.") are never searched as their name — the Strom app finds nobody by them either
  if (r.type === "person") rest.names = r.names.map(({ prefix: _p, suffix: _s, ...n }) => n);
  add(rest);
  return parts.join(" \u0001 ");
}
