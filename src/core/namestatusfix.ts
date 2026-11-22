// The fix name-status (spec 066 P5): before strom 1.36.0 a name had no status — a record that names the person was
// cited by the name and said nothing of how sure it is. Since then a name cited by a record of the research's gets
// probable (core/namestatus.ts); the names of an older research are given it once by rules: never proven (only a reading
// against the original says that), never a name the person confirmed or wrote, never one only an import's citations back.
//
// A citation the import brought — not the research's own reading — is one of a source:
// - of an imported family tree (Source.imported, its key R1…: another program's file) or the family tree it is (QUAY 0);
// - the name's origin names (`origin.source`, the import that gave it) or its earlier words kept (`was.cites`);
// - of the Strom app the research never read (Source.app without a reading: the user's family tree's word for it).
// Of the rest, one of QUAY 2 or 3 that is no index or compiled work (namesThePerson) makes the name probable.
//
// Applied by itself once (settleNameStatus: the first start of this strom after its backup, a bridge's start), also in
// an archive (only how sure a name is: nothing of an agent); strom fixes undo name-status takes the status off each
// name still as the fix left it.

import fs from "node:fs";
import path from "node:path";
import type { Citation, Name, Person, Source, TreeConfig } from "./model.ts";
import { gedcomName } from "./people.ts";
import { namesThePerson, usersName } from "./namestatus.ts";
import { now, VERSION, type Tree } from "./tree.ts";
import { fixedDecision } from "./readers.ts";
import { freshConfig, quiet } from "./hypolinks.ts";
import { writableUnasked } from "./integrity.ts";

/** The strom version from which a name has a status. */
export const NAME_STATUS_SINCE = "1.36.0";
/** The marker in strom.json: the names of an older research given their status once. */
export const NAME_STATUS_SETTLED = "name-status-1";
/** Where the fix keeps what it set, for its undo (sealed like the rest of quality/; travels with the research). */
export const NAME_STATUS_FIX_FILE = "quality/name-status.json";

/** One name made probable: whose, which (its place and words), the records of the research's it rests on. */
export interface NameStatusFix {
  person: string;
  index: number;
  name: string;
  to: "probable";
  sources: string[];
}

interface FixFile {
  v: 1;
  /** Each time the fix set names, newest last. */
  runs: { at: string; version: string; items: NameStatusFix[] }[];
}

/** A citation the import brought (see above): never the research's reading of a record. */
function importsCitation(tree: Tree, n: Name, c: Citation): boolean {
  const s = tree.get<Source>(c.source);
  if (!s || s.imported) return true;
  if (n.origin?.source === c.source) return true;
  if (n.was?.cites?.some((w) => w.source === c.source)) return true;
  return !!s.app && !s.reading;
}

/** The records of the research's that name the person by this name: what makes it probable. */
function researchRecords(tree: Tree, n: Name): string[] {
  return [...new Set((n.citations ?? []).filter((c) => !importsCitation(tree, n, c) && namesThePerson(tree, c)).map((c) => c.source))];
}

/** Each name of a living record with no status that a record of the research's names, not the person's own: probable. */
export function nameStatusFixes(tree: Tree): { fixes: NameStatusFix[]; left: never[] } {
  const fixes: NameStatusFix[] = [];
  for (const p of tree.list<Person>("person")) {
    if (p.retracted || p.mergedInto) continue;
    p.names.forEach((n, index) => {
      if (n.status || usersName(n)) return;
      const sources = researchRecords(tree, n);
      if (sources.length) fixes.push({ person: p.id, index, name: gedcomName(n), to: "probable", sources });
    });
  }
  return { fixes, left: [] };
}

function readFile(tree: Tree): FixFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...NAME_STATUS_FIX_FILE.split("/")), "utf8")) as Partial<FixFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const fileContent = (f: FixFile) => JSON.stringify(f, null, 2) + "\n";
const byId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const settledWith = (config?: (c: TreeConfig) => void) => (c: TreeConfig) => {
  c.settled = [...new Set([...(c.settled ?? []), NAME_STATUS_SETTLED])];
  config?.(c);
};

/**
 * The names with the status set (undo: taken off), as they are now — each only where it is still as found: the same
 * words at the same place, no status (undo: still probable), not the person's own since.
 */
function statused(tree: Tree, items: NameStatusFix[], undo: boolean): { records: Person[]; done: NameStatusFix[] } {
  const records = new Map<string, Person>();
  const done: NameStatusFix[] = [];
  for (const it of items) {
    if (!records.has(it.person)) {
      const p = tree.get<Person>(it.person);
      if (!p || p.type !== "person") continue;
      records.set(it.person, structuredClone(p));
    }
    const p = records.get(it.person)!;
    const n = p.names[it.index];
    if (!n || gedcomName(n) !== it.name || usersName(n)) continue;
    if (undo ? n.status !== it.to : !!n.status) continue;
    if (undo) delete n.status;
    else n.status = it.to;
    done.push(it);
  }
  const touched = new Set(done.map((d) => d.person));
  return { records: [...records.values()].filter((r) => touched.has(r.id)), done };
}

/**
 * The fix: each name found made probable — the marker in strom.json, what it set kept for its undo; one operation,
 * even when nothing is found (the marker alone). Inside withTreeLock.
 */
export function applyNameStatus(tree: Tree, items: NameStatusFix[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number } {
  const found = nameStatusFixes(tree).fixes;
  const wanted = items.filter((it) => found.some((f) => JSON.stringify(f) === JSON.stringify(it)));
  const { records, done } = statused(tree, wanted, false);
  if (!done.length) {
    tree.updateConfig(settledWith(config), { op: "tree.settle", summary: "how sure a name is: given by the records that name the person from now on (nothing to set)" });
    return { changed: 0, records: 0 };
  }
  const file = readFile(tree);
  file.runs.push({ at: now(), version, items: done });
  tree.putMany(
    records,
    [{ rel: NAME_STATUS_FIX_FILE, content: fileContent(file) }],
    {
      op: "name-status.fix",
      targets: records.map((r) => r.id).sort(byId),
      summary: `how sure a name is: ${done.length} names a record of the research's names made probable (fix name-status)`,
      reason: "a record of the research's (an original, or a copy of primary information) names the person so; never proven without a reading against the original, never the user's own name, never on an import's citation alone",
    },
    settledWith(config),
  );
  return { changed: done.length, records: records.length };
}

/** What the fix set and is not undone yet. */
export function nameStatusDone(tree: Tree): NameStatusFix[] {
  return readFile(tree).runs.flatMap((r) => r.items);
}

/** The fix undone: the status taken off each name still as the fix left it. One operation; what the fix kept is emptied. */
export function undoNameStatus(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const items = nameStatusDone(tree);
  if (!items.length) return { restored: 0, records: 0, left: 0 };
  const { records, done } = statused(tree, items, true);
  const left = items.length - done.length;
  tree.putMany(
    records,
    [{ rel: NAME_STATUS_FIX_FILE, content: fileContent({ v: 1, runs: [] }) }],
    {
      op: "name-status.unfix",
      targets: records.map((r) => r.id).sort(byId),
      summary: `how sure a name is: the status taken off ${done.length} names${left ? `, ${left} changed since left` : ""} (fix name-status undone)`,
    },
    config,
  );
  return { restored: done.length, records: records.length, left };
}

/**
 * Once per research, at the first start of this strom (after its backup) and at a bridge's start: the fix applied by
 * itself, its decision kept as the person's fixes are (strom fixes undo name-status puts it back) — in one commit. Also
 * in an archive. Skipped as settleOrigins is (somebody at work, another computer's seal, data changed outside strom, a
 * dry run).
 */
export function settleNameStatus(tree: Tree, decision: (c: TreeConfig) => void = fixedDecision("name-status", VERSION)): { changed: number; records: number } | undefined {
  const settled = () => !!tree.config.settled?.includes(NAME_STATUS_SETTLED);
  if (tree.dryRun || settled() || !quiet(tree)) return undefined;
  let out: { changed: number; records: number } | undefined;
  tree.atomically(() => {
    if (!freshConfig(tree) || settled() || !writableUnasked(tree)) return;
    const found = nameStatusFixes(tree).fixes;
    const r = applyNameStatus(tree, found, NAME_STATUS_SINCE, found.length ? decision : undefined);
    tree.commit(r.changed ? `How sure a name is: ${r.changed} names a record names made probable` : "How sure a name is: given by the records from now on");
    out = r;
  });
  return out;
}
