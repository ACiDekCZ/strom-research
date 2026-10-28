// The person's "not an error" on a finding of the Strom app's validation (spec 021 §D): quality/dismissed.json, written
// whole as a sealed operation of the tree (like quality/surnames.json). Only the person marks or takes a mark back —
// in the Strom app (the bridge, by "app") or in their terminal (strom quality dismiss|undo, by "research"); never an
// agent. The research reads what a mark means for it: a possible duplicate is two people (strom person compare, the
// brief's "Probably already in the tree"), an event after death in that year is no finding of strom check. Every other
// kind is kept and given back as it came.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readJsonIfExists, stringifyCanonical } from "./json.ts";
import { foldText } from "./text.ts";
import { UsageError } from "./errors.ts";
import * as git from "./git.ts";
import type { Person } from "./model.ts";
import type { Tree } from "./tree.ts";

export const DISMISSED_FILE = "quality/dismissed.json";
export const PERSONS_MAX = 20;
export const SUBJECT_MAX = 200;
export const KIND_MAX = 100;

/** The app's kinds the research reads (its ValidationIssue.type): every other is only kept. */
export const POSSIBLE_DUPLICATE = "possibleDuplicate";
export const EVENT_AFTER_DEATH = "eventAfterDeath";
export const MARR_AFTER_DEATH = "weddingAfterDeath";

export interface Dismissal {
  /** The app's kind of finding, as it is (any: kept and given back). */
  kind: string;
  /** The people of the finding (P…), sorted — as they were marked: a person merged since is read as the one merged into. */
  persons: string[];
  /** What the finding is of beyond its people: the year of an event after death, a godparent's name (NFC, trimmed). */
  subject?: string;
  at: string;
  by: "app" | "research";
}

export interface DismissedFile {
  dismissed: Dismissal[];
}

export interface DismissAsk {
  kind: string;
  persons: string[];
  subject?: string;
}

const PERSON_ID = /^P\d{1,9}$/u;

/** A person's ID as the research writes it (P12 → P0012), or undefined when it is none. */
export function personId(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const id = raw.trim().toUpperCase();
  if (!PERSON_ID.test(id)) return undefined;
  return id.length < 5 ? `P${id.slice(1).padStart(4, "0")}` : id;
}

/** The kind as kept: NFC, trimmed, 1–100 characters, no control characters; undefined when it is none. */
export function kindOf(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const k = raw.normalize("NFC").trim();
  if (!k || Array.from(k).length > KIND_MAX || /\p{Cc}/u.test(k)) return undefined;
  return k;
}

/** The subject as kept: NFC, trimmed, at most 200 characters — never cut inside one (a letter with its marks, an emoji). */
export function subjectOf(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.normalize("NFC").trim();
  if (!t) return undefined;
  if (Array.from(t).length <= SUBJECT_MAX) return t;
  let out = "";
  let n = 0;
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(t)) {
    const len = Array.from(segment).length;
    if (n + len > SUBJECT_MAX) break;
    out += segment;
    n += len;
  }
  return out.trim();
}

const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** One string for a finding: its kind, its people sorted, its subject folded. */
export function dismissalKey(kind: string, persons: readonly string[], subject?: string): string {
  return JSON.stringify([kind, [...new Set(persons)].sort(byCodePoint), foldText((subject ?? "").normalize("NFC")).replace(/\s+/gu, " ").trim()]);
}

function entriesOf(v: unknown): Dismissal[] {
  if (!Array.isArray(v)) return [];
  const out = new Map<string, Dismissal>();
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const e = x as Partial<Dismissal>;
    const kind = kindOf(e.kind);
    if (!kind || !Array.isArray(e.persons)) continue;
    const persons = [...new Set(e.persons.map(personId).filter((p): p is string => !!p))].sort(byCodePoint);
    if (!persons.length) continue;
    const subject = subjectOf(e.subject);
    const d: Dismissal = { kind, persons, ...(subject ? { subject } : {}), at: typeof e.at === "string" ? e.at : "", by: e.by === "app" ? "app" : "research" };
    out.set(dismissalKey(kind, persons, subject), d);
  }
  return [...out.values()];
}

export function readDismissed(tree: Tree): DismissedFile {
  try {
    const f = readJsonIfExists<Partial<DismissedFile>>(path.join(tree.root, ...DISMISSED_FILE.split("/")));
    return { dismissed: entriesOf(f?.dismissed) };
  } catch {
    return { dismissed: [] };
  }
}

/** A fingerprint of what GET /quality answers: the research's last commit (`head`: known already) and the file. */
export function qualityRev(tree: { root: string }, head?: string): string {
  let content = "";
  try {
    content = fs.readFileSync(path.join(tree.root, ...DISMISSED_FILE.split("/")), "utf8");
  } catch {
    // none yet
  }
  const h = ((head ?? git.head(tree.root)) || "0000000").slice(0, 7);
  return `${h}-${crypto.createHash("sha256").update(content).digest("hex").slice(0, 4)}`;
}

/** Who a person is now: the one it was merged into (and on), else itself. */
export function personNow(tree: Tree, id: string): string {
  let at = id;
  for (let i = 0; i < 50; i++) {
    const p = tree.get<Person>(at);
    if (!p?.mergedInto || p.mergedInto === at) return at;
    at = p.mergedInto;
  }
  return at;
}

/**
 * What a mark asks, checked against the research: its kind, its people (1–20, each a person of the research — one merged
 * is no error: read as the one merged into), its subject. A wrong shape: quality.body; a person the research has not
 * (or took back): person.no-match with that ID.
 */
export function askOf(tree: Tree, kind: unknown, persons: unknown, subject?: unknown): DismissAsk {
  const shape = `a kind (1–${KIND_MAX} characters), 1–${PERSONS_MAX} people (P…) and a subject of at most ${SUBJECT_MAX} characters`;
  const k = kindOf(kind);
  if (!k) throw new UsageError(`the kind: ${shape}`, { code: "quality.body" });
  if (!Array.isArray(persons) || !persons.length || persons.length > PERSONS_MAX) throw new UsageError(`the people: ${shape}`, { code: "quality.body" });
  const ids: string[] = [];
  for (const raw of persons) {
    const id = personId(raw);
    if (!id) throw new UsageError(`the people: ${shape} — not "${String(raw).slice(0, 40)}"`, { code: "quality.body" });
    const p = tree.get<Person>(id);
    if (!p || (p.retracted && !p.mergedInto)) throw new UsageError(`there is no person ${id} in the research`, { code: "person.no-match", params: { person: id }, hint: "strom person list" });
    ids.push(id);
  }
  if (subject !== undefined && subject !== null && typeof subject !== "string") throw new UsageError(`the subject: ${shape}`, { code: "quality.body" });
  const s = subjectOf(subject);
  return { kind: k, persons: [...new Set(ids)].sort(byCodePoint), ...(s ? { subject: s } : {}) };
}

/** What the history says of a mark. */
export function markSaid(d: { kind: string; persons: string[]; subject?: string }): string {
  return `${d.kind} ${d.persons.join(" ")}${d.subject ? ` (${d.subject})` : ""}`;
}

function write(tree: Tree, next: Dismissal[], op: { op: string; summary: string }): void {
  const sorted = [...next].sort((a, b) => byCodePoint(dismissalKey(a.kind, a.persons, a.subject), dismissalKey(b.kind, b.persons, b.subject)));
  tree.putFile(DISMISSED_FILE, stringifyCanonical({ dismissed: sorted }), { op: op.op, targets: [], summary: op.summary });
}

/** A finding marked "not an error" — the person's. Marked again: nothing changes. */
export function dismiss(tree: Tree, ask: DismissAsk, by: "app" | "research"): { changed: boolean; entry: Dismissal } {
  return tree.withTreeLock(() => {
    const f = readDismissed(tree);
    const key = dismissalKey(ask.kind, ask.persons, ask.subject);
    const had = f.dismissed.find((d) => dismissalKey(d.kind, d.persons, d.subject) === key);
    if (had) return { changed: false, entry: had };
    const entry: Dismissal = { kind: ask.kind, persons: ask.persons, ...(ask.subject ? { subject: ask.subject } : {}), at: new Date().toISOString(), by };
    write(tree, [...f.dismissed, entry], { op: "quality.dismiss", summary: `not an error: ${markSaid(entry)}` });
    return { changed: true, entry };
  });
}

/** A mark taken back — the person's. One that is not there: nothing changes. */
export function undoDismiss(tree: Tree, ask: DismissAsk): { changed: boolean; entry?: Dismissal } {
  return tree.withTreeLock(() => {
    const f = readDismissed(tree);
    const key = dismissalKey(ask.kind, ask.persons, ask.subject);
    const had = f.dismissed.find((d) => dismissalKey(d.kind, d.persons, d.subject) === key);
    if (!had) return { changed: false };
    write(tree, f.dismissed.filter((d) => d !== had), { op: "quality.undo", summary: `an error again: ${markSaid(had)}` });
    return { changed: true, entry: had };
  });
}

/**
 * The marks as the research reads them now — each person as who it is now (merged: the one merged into): a lookup of a
 * finding's kind, people and subject, answering its mark.
 */
export function dismissedLookup(tree: Tree, file: DismissedFile = readDismissed(tree)): (kind: string, persons: readonly string[], subject?: string) => Dismissal | undefined {
  const marks = new Map<string, Dismissal>();
  for (const d of file.dismissed) marks.set(dismissalKey(d.kind, d.persons.map((p) => personNow(tree, p)), d.subject), d);
  return (kind, persons, subject) => (marks.size ? marks.get(dismissalKey(kind, persons.map((p) => personNow(tree, p)), subject)) : undefined);
}

export function isDismissed(tree: Tree, kind: string, persons: readonly string[], subject?: string): boolean {
  return !!dismissedLookup(tree)(kind, persons, subject);
}

/** Two people the person said are two (a possible duplicate marked so): for likelyDuplicates and the brief. */
export function twoPeople(tree: Tree): (a: string, b: string) => boolean {
  const lookup = dismissedLookup(tree);
  return (a, b) => !!lookup(POSSIBLE_DUPLICATE, [a, b]);
}
