// The bounds of a lineage the person set in the Strom app (spec 028; the app's ZADANI_VYZKUM_rody.md): the app computes a
// lineage (the male line from the oldest bearer of the name) and the person may correct it in two ways — a person who
// begins a lineage of their own (a founder: their tie to their father does not count for it), a person who carries
// none (their sons begin lineages). <tree>/quality/lineages.json keeps both lists of people (P…), written whole as a
// sealed operation of the tree like quality/surnames.json (core/integrity.ts): a change outside strom is an error of
// strom guard; strom sync undo and the history take it back.
// Only the person sets them, in the Strom app: strom sync takes them from the app's file (1 _STROM_LINE on a person,
// 1 _STROM_LINES Y in the header), the Strom file gives them back (gate APP_READS_LINES). No evidence and no fact of a
// person: they change no name, no parents, no status — a locked person may have one.
// A person merged since is read as the one merged into (a founder before one who carries none); one taken back has none.

import path from "node:path";
import { readJsonIfExists, stringifyCanonical } from "./json.ts";
import { personNow } from "./quality.ts";
import * as git from "./git.ts";
import type { Person } from "./model.ts";
import type { Tree } from "./tree.ts";

export const LINEAGES_FILE = "quality/lineages.json";

/** A person's bound of a lineage as the Strom file says it: begins one, carries none. */
export type LineMark = "FOUNDER" | "NOCARRY";

export interface LineagesFile {
  /** The people who begin a lineage of their own (the app's lineageOverrides.founders). */
  lineFounders: string[];
  /** The people who carry no lineage (the app's lineageOverrides.notCarriers). */
  lineNotCarriers: string[];
}

const PERSON_ID = /^P\d{1,9}$/u;

/** A person's ID as the research writes it (P12 → P0012); undefined when it is none. */
function idOf(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const id = raw.trim().toUpperCase();
  if (!PERSON_ID.test(id)) return undefined;
  return id.length < 5 ? `P${id.slice(1).padStart(4, "0")}` : id;
}

/** A mark as the Strom file writes it; anything else (a value of a later app) is none. */
export function lineMarkOf(raw: string | undefined): LineMark | undefined {
  const v = raw?.trim().toUpperCase();
  return v === "FOUNDER" || v === "NOCARRY" ? v : undefined;
}

const sorted = (ids: Iterable<string>) => [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

function listOf(raw: unknown): string[] {
  return Array.isArray(raw) ? sorted(raw.map(idOf).filter((x): x is string => !!x)) : [];
}

/** The lists as a file (or a commit's copy of it) holds them; empty when there is none. */
export function lineagesOf(text: string | undefined): LineagesFile {
  if (!text) return { lineFounders: [], lineNotCarriers: [] };
  try {
    const f = JSON.parse(text) as Partial<LineagesFile>;
    return { lineFounders: listOf(f?.lineFounders), lineNotCarriers: listOf(f?.lineNotCarriers) };
  } catch {
    return { lineFounders: [], lineNotCarriers: [] };
  }
}

export function readLineages(tree: Tree): LineagesFile {
  try {
    const f = readJsonIfExists<Partial<LineagesFile>>(path.join(tree.root, ...LINEAGES_FILE.split("/")));
    return { lineFounders: listOf(f?.lineFounders), lineNotCarriers: listOf(f?.lineNotCarriers) };
  } catch {
    return { lineFounders: [], lineNotCarriers: [] };
  }
}

/** The lists at a commit (what the export at it gave the Strom app); undefined when the history has no such commit. */
export function lineagesAt(tree: Tree, head: string): LineagesFile | undefined {
  if (!/^[0-9a-f]{7,40}$/u.test(head)) return undefined;
  if (git.runGit(tree.root, ["cat-file", "-e", `${head}^{commit}`]).status !== 0) return undefined;
  return lineagesOf(git.showFile(tree.root, head, LINEAGES_FILE));
}

/**
 * Each person's mark as the research reads it now: by who they are now (merged: the one merged into), a person taken
 * back (or not in the research) none, a founder before one who carries none.
 */
export function lineMarks(tree: Tree, file: LineagesFile = readLineages(tree)): Map<string, LineMark> {
  const out = new Map<string, LineMark>();
  const live = (id: string): string | undefined => {
    const now = personNow(tree, id);
    const p = tree.get<Person>(now);
    return p && p.type === "person" && !p.retracted ? now : undefined;
  };
  for (const id of file.lineFounders) {
    const p = live(id);
    if (p) out.set(p, "FOUNDER");
  }
  for (const id of file.lineNotCarriers) {
    const p = live(id);
    if (p && !out.has(p)) out.set(p, "NOCARRY");
  }
  return out;
}

/** Written whole as a sealed operation of the tree, inside its lock. */
function writeLineages(tree: Tree, next: LineagesFile, op: { op: string; targets: string[]; summary: string }): void {
  const founders = sorted(next.lineFounders);
  const notCarriers = sorted(next.lineNotCarriers).filter((id) => !founders.includes(id));
  tree.withTreeLock(() => tree.putFile(LINEAGES_FILE, stringifyCanonical({ lineFounders: founders, lineNotCarriers: notCarriers }), { ...op, summary: op.summary.normalize("NFC") }));
}

/** A mark as the history says it. */
export const markSaid = (m: LineMark | null) => (m === "FOUNDER" ? "begins a lineage" : m === "NOCARRY" ? "carries no lineage" : "lineage as computed");

/**
 * One person's mark set (null: none — the lineage as the app computes it): every ID of the file that is this person now
 * (one merged into them) taken out of both lists, the person put in the one of the mark. Undefined when nothing changes;
 * else the mark before, for an undo.
 */
export function setLineMark(tree: Tree, person: string, mark: LineMark | null, why: string, op = "lineage.set"): { was: LineMark | null } | undefined {
  const file = readLineages(tree);
  const was = lineMarks(tree, file).get(person) ?? null;
  const theirs = (id: string) => id === person || personNow(tree, id) === person;
  const founders = file.lineFounders.filter((id) => !theirs(id));
  const notCarriers = file.lineNotCarriers.filter((id) => !theirs(id));
  if (mark === "FOUNDER") founders.push(person);
  if (mark === "NOCARRY") notCarriers.push(person);
  const next = { lineFounders: sorted(founders), lineNotCarriers: sorted(notCarriers) };
  if (JSON.stringify(next) === JSON.stringify({ lineFounders: file.lineFounders, lineNotCarriers: file.lineNotCarriers })) return undefined;
  writeLineages(tree, next, { op, targets: [person], summary: `${person} ${markSaid(mark)} (${why})` });
  return { was };
}

// ── the Strom app's marks (strom sync) ─────────────────────────────────────

/** One person's mark a sync changes: `person` the file's key (P…, or x:… of a new one), `mark` the file's, `was` the research's. */
export interface LineChange {
  person: string;
  mark: LineMark | null;
  was: LineMark | null;
}

/**
 * What the Strom app's marks change in the research. `theirs`: the file's marks by the research's ID (or the file's key
 * of a new person), undefined where the file says nothing of them (no header mark: an older app); `present`: the people
 * the file has (a mark is taken away only from one of them); `base`: the marks the research gave the app at
 * _STROM_HEAD, when it gave them — only what the user changed since counts (a mark they kept as given leaves the
 * research's word); without one the file's list is the truth, an empty one too.
 */
export function planLines(now: Map<string, LineMark>, theirs: Map<string, LineMark> | undefined, present: (id: string) => boolean, base: Map<string, LineMark> | undefined): LineChange[] {
  if (!theirs) return [];
  const out: LineChange[] = [];
  const people = sorted([...theirs.keys(), ...now.keys(), ...(base?.keys() ?? [])]);
  for (const id of people) {
    const t = theirs.get(id) ?? null;
    const n = now.get(id) ?? null;
    if (t === n) continue;
    // taken away only from someone the file has (one it lacks says nothing of them)
    if (!t && !present(id)) continue;
    if (base && t === (base.get(id) ?? null)) continue;
    out.push({ person: id, mark: t, was: n });
  }
  return out;
}

/** A change of a sync taken back: the person's mark before it again — unless it changed since (the newer word stands). */
export function undoLineMark(tree: Tree, person: string, mark: LineMark | null, was: LineMark | null, why: string): boolean {
  if ((lineMarks(tree).get(person) ?? null) !== mark) return false;
  return !!setLineMark(tree, person, was, why, "lineage.undo");
}
