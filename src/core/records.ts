// Generic create / update for every record type, so commands stay small.
// All writes still go through Tree.put (validation + seal).

import { UsageError } from "./errors.ts";
import { RECORD_TYPES, type AnyRecord, type Conflict, type Hypothesis, type RecordType } from "./model.ts";
import { now, typeOfId, type Tree } from "./tree.ts";
import { makeNote } from "./actions.ts";

type Fields<T> = Omit<T, "id" | "type" | "created" | "updated" | "notes"> & { note?: string | undefined };

/** Create a record of `type` with a fresh ID. */
export function create<T extends AnyRecord>(tree: Tree, type: RecordType, fields: Fields<T>, summary: (id: string) => string, targets: string[] = []): T {
  return tree.withTreeLock(() => {
    const t = now();
    const { note, ...rest } = fields as Record<string, unknown> & { note?: string };
    const rec = {
      id: tree.allocate(RECORD_TYPES[type].prefix),
      type,
      ...stripUndefined(rest),
      notes: note ? [makeNote(tree, note)] : [],
      created: t,
      updated: t,
    } as unknown as T;
    tree.put(rec, { op: `${type}.add`, targets: [rec.id, ...targets], summary: summary(rec.id) });
    return rec;
  });
}

/** Load, change and write a record. `reason` is required when facts change meaning. */
export function update<T extends AnyRecord>(
  tree: Tree,
  id: string,
  expect: RecordType,
  change: (rec: T) => T,
  op: { op: string; summary: string; reason?: string | undefined; targets?: string[] },
): T {
  if (typeOfId(id) !== expect) throw new UsageError(`${id} is not a ${expect}`);
  return tree.withTreeLock(() => {
    const cur = tree.get<T>(id);
    if (!cur) throw new UsageError(`no ${expect} ${id}`, { hint: `strom ${expect === "repository" ? "repo" : expect} list` });
    const next = { ...change(structuredClone(cur)), updated: now() };
    tree.put(next, {
      op: op.op,
      targets: [id, ...(op.targets ?? [])],
      summary: op.summary,
      ...(op.reason ? { reason: op.reason } : {}),
    });
    return next;
  });
}

export function stripUndefined<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    if (Array.isArray(v) || v === null || typeof v !== "object") out[k] = v;
    else out[k] = stripUndefined(v as Record<string, unknown>);
  }
  return out as T;
}

/** Normalize an ID the user typed: "s12" -> "S0012". */
export function normId(ref: string, type?: RecordType): string {
  const m = /^([A-Za-z])(\d+)$/.exec(ref.trim());
  if (!m) return ref.trim();
  const id = m[1]!.toUpperCase() + m[2]!.padStart(4, "0");
  if (type && typeOfId(id) !== type) throw new UsageError(`${ref} is not a ${type} ID (${RECORD_TYPES[type].prefix}0001)`);
  return id;
}

export function requireRecord<T extends AnyRecord>(tree: Tree, ref: string, type: RecordType): T {
  const id = normId(ref, type);
  const rec = tree.get<T>(id);
  if (!rec) throw new UsageError(`no ${type} ${id}`, { hint: `strom ${type === "repository" ? "repo" : type} list` });
  if (rec.mergedInto) throw new UsageError(`${id} was merged into ${rec.mergedInto}`, { hint: `strom ${type === "repository" ? "repo" : type} show ${rec.mergedInto}` });
  return rec;
}

/** Repeatable option → array. Values are kept whole: free text may contain commas. */
export function listOpt(v: unknown): string[] {
  if (v === undefined || v === false) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => String(x).trim()).filter(Boolean);
}

/** Repeatable option whose values may also be comma separated: IDs, kinds, place lists. */
export function csvOpt(v: unknown): string[] {
  return listOpt(v).flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean);
}

/** Read "@file" as the file's text, otherwise the value itself. */
export function textOpt(v: unknown, readFile: (p: string) => string): string | undefined {
  if (typeof v !== "string") return undefined;
  if (v.startsWith("@")) return readFile(v.slice(1));
  return v;
}

/** The people a list of subjects names: the persons in it, and the people of the conflicts and hypotheses in it. */
export function subjectPeople(tree: Tree, ids: string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    const type = typeOfId(id);
    if (type === "person") out.add(id);
    else if (type === "conflict" || type === "hypothesis")
      for (const s of tree.get<Conflict | Hypothesis>(id)?.subject ?? []) if (typeOfId(s) === "person") out.add(s);
  }
  return [...out];
}
