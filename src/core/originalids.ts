// The IDs a record had in a family tree it came from (spec 066 K3.2): the record's xref in that file and the ID lines
// its program gave it (_UID, UID, RIN, EXID with its TYPE, _FSFTID, AFN), kept by the import's source — returned to the
// Strom app as it sent them, and a way to find a person again when the same tree (or one of the same system) comes in.
//
// - read of another program's file: its xref and its bare level-1 ID lines (never `_STROM_IMPORT`, `_STROM_XID`);
// - read of the Strom app's file: only its blocks `1 _STROM_IMPORT Ix` / `1 _STROM_XID Iy` of an import its HEAD names
//   (`2 _XREF`, `2 _UID`…), never a level-1 `_UID` of it, never the app's own xref;
// - kept literally (trimmed, NFC, the xref without @); a line with U+FFFD or a control character is not taken (said);
//   at most IDS_MAX lines in a block and ENTRIES_MAX blocks on a record (more passed, said).
//
// Matching (strom intake of another program's file, the app's person without the research's ID in a sync): a strong ID
// (a UUID — _UID, UID —, FamilySearch's — _FSFTID, an EXID of familysearch.org —, AFN, another EXID of the same TYPE)
// is only a strong hint; the same person when ALL hold: exactly one person of the research has it, the names are alike,
// the sexes are not M × F, the birth years (when both known) differ by YEARS_CLOSE at most, no global ID (all but a
// UUID) differs, and nobody else of the same file took that person. Else a candidate for a person to decide. Weak IDs
// (xref, RIN) only within one program's files, and then a candidate alone.

import { ORIGINAL_IDS_LIMITS, type Family, type OriginalId, type OriginalIds, type Person, type Source } from "./model.ts";
import { dateYears, YEARS_CLOSE } from "./gdate.ts";
import { birthEvent } from "./people.ts";
import { foldText } from "./text.ts";
import type { Tree } from "./tree.ts";
import { children, val, type GedNode } from "../gedcom/parse.ts";

/** The ID lines read and returned. */
export const ID_TAGS: ReadonlySet<string> = new Set(["_UID", "UID", "RIN", "EXID", "_FSFTID", "AFN"]);
/** At most so many ID lines in one block (an import's entry). */
export const IDS_MAX = ORIGINAL_IDS_LIMITS.ids;
/** At most so many entries on one record. */
export const ENTRIES_MAX = ORIGINAL_IDS_LIMITS.entries;
/** The longest value, TYPE and xref taken. */
export const ID_VALUE_MAX = ORIGINAL_IDS_LIMITS.value;
export const ID_TYPE_MAX = ORIGINAL_IDS_LIMITS.type;
export const XREF_MAX = ORIGINAL_IDS_LIMITS.xref;

/** A block of IDs as a file carries it: the import's key (the Strom app's file; none in another program's), the xref, the lines. */
export interface IdBlock {
  key?: string;
  xref?: string;
  ids: OriginalId[];
  xid?: true;
}

/** A key of an import (`I1`, `R2`): letters and digits (core/origin.ts importKeyOk; not imported here, it imports actions). */
const KEY_OK = /^[\p{L}\p{N}]{1,40}$/u;

/** A value as kept: trimmed, NFC — false where it holds a character that cannot be read (U+FFFD) or a control one, or is too long. */
function cleanValue(raw: string | undefined, max: number): string | undefined | false {
  const v = (raw ?? "").trim().normalize("NFC");
  if (!v) return undefined;
  if (/[\p{Cc}�]/u.test(v) || [...v].length > max) return false;
  return v;
}

/** An xref without its @. */
function cleanXref(raw: string | undefined): string | undefined | false {
  return cleanValue((raw ?? "").replace(/@/g, ""), XREF_MAX);
}

const lineKey = (l: OriginalId) => `${l.tag}\u0000${l.value}\u0000${l.type ?? ""}`;

/** The ID lines among the nodes (each once): at most IDS_MAX; what is not taken said in `problems`. */
function readLines(nodes: GedNode[], problems: string[], label: string): OriginalId[] {
  const out: OriginalId[] = [];
  let passed = 0;
  for (const n of nodes) {
    if (!ID_TAGS.has(n.tag)) continue;
    const value = cleanValue(n.value, ID_VALUE_MAX);
    const type = n.tag === "EXID" ? cleanValue(val(n, "TYPE"), ID_TYPE_MAX) : undefined;
    if (value === false || type === false) {
      problems.push(`${label}: ${n.tag} not taken (a character that cannot be read, or too long)`);
      continue;
    }
    if (!value) continue;
    const line: OriginalId = { tag: n.tag, value, ...(type ? { type } : {}) };
    if (out.some((x) => lineKey(x) === lineKey(line))) continue;
    if (out.length >= IDS_MAX) {
      passed++;
      continue;
    }
    out.push(line);
  }
  if (passed) problems.push(`${label}: ${passed} ID line(s) over ${IDS_MAX} passed`);
  return out;
}

/** The xref and the bare level-1 ID lines of a record of another program's file. */
export function foreignIds(r: GedNode, problems: string[], label: string): IdBlock | undefined {
  const xref = cleanXref(r.xref);
  if (xref === false) problems.push(`${label}: its xref not taken (a character that cannot be read, or too long)`);
  const ids = readLines(r.children, problems, label);
  if (!xref && !ids.length) return undefined;
  return { ...(xref ? { xref } : {}), ids };
}

/**
 * The blocks of IDs under a record of the Strom app's file: `1 _STROM_IMPORT Ix` (the record came of that import) and
 * `1 _STROM_XID Iy` (it did not), each of an import its HEAD names (`known`), with `2 _XREF @…@` and the ID lines.
 * A mark of origin with neither is no block.
 */
export function appIdBlocks(r: GedNode, known: (key: string) => boolean, problems: string[], label: string): IdBlock[] {
  const out: IdBlock[] = [];
  let passed = 0;
  for (const c of r.children) {
    if (c.tag !== "_STROM_IMPORT" && c.tag !== "_STROM_XID") continue;
    const key = c.value.trim().split(/\s+/u)[0] ?? "";
    if (!KEY_OK.test(key) || !known(key)) continue;
    const xref = cleanXref(children(c, "_XREF")[0]?.value);
    if (xref === false) problems.push(`${label}: an xref of ${key} not taken (a character that cannot be read, or too long)`);
    const ids = readLines(c.children, problems, label);
    if (!xref && !ids.length) continue;
    if (out.length >= ENTRIES_MAX) {
      passed++;
      continue;
    }
    out.push({ key, ...(xref ? { xref } : {}), ids, ...(c.tag === "_STROM_XID" ? { xid: true as const } : {}) });
  }
  if (passed) problems.push(`${label}: ${passed} block(s) of IDs over ${ENTRIES_MAX} passed`);
  return out;
}

/** An entry of a block, by the import's source. */
export function entryOf(block: IdBlock, source: string): OriginalIds {
  return { source, ...(block.xref ? { xref: block.xref } : {}), ...(block.ids.length ? { ids: block.ids } : {}), ...(block.xid ? { xid: true as const } : {}) };
}

const entryKey = (e: OriginalIds) => `${e.source}\u0000${e.xref ?? ""}`;

/**
 * Entries joined to those a record has: the same import and xref once (its ID lines joined, its `xid` as it was), the
 * others after; at most ENTRIES_MAX entries, IDS_MAX lines each. `changed`: anything added; `passed`: entries left out.
 */
export function joinIds(have: readonly OriginalIds[] | undefined, add: readonly OriginalIds[]): { list: OriginalIds[]; changed: boolean; passed: number } {
  const list = (have ?? []).map((e) => ({ ...e, ...(e.ids ? { ids: [...e.ids] } : {}) }));
  let changed = false;
  let passed = 0;
  for (const a of add) {
    const same = list.find((e) => entryKey(e) === entryKey(a));
    if (!same) {
      if (list.length >= ENTRIES_MAX) {
        passed++;
        continue;
      }
      list.push({ ...a, ...(a.ids ? { ids: a.ids.slice(0, IDS_MAX) } : {}) });
      changed = true;
      continue;
    }
    for (const l of a.ids ?? []) {
      if ((same.ids ?? []).some((x) => lineKey(x) === lineKey(l)) || (same.ids?.length ?? 0) >= IDS_MAX) continue;
      same.ids = [...(same.ids ?? []), l];
      changed = true;
    }
  }
  return { list, changed, passed };
}

/** Entries and lines added to a record (for an undo): `lines` — only lines added to an entry it had already. */
export type AddedIds = OriginalIds & { lines?: true };

/**
 * A record's entries without those of `taken` (an undo): the lines taken off; an entry the undone step made gone when
 * nothing else is left of it, one it only added lines to kept (those added since stay).
 */
export function withoutIds(have: readonly OriginalIds[] | undefined, taken: readonly AddedIds[]): OriginalIds[] {
  const out: OriginalIds[] = [];
  for (const e of have ?? []) {
    const t = taken.find((x) => entryKey(x) === entryKey(e));
    if (!t) {
      out.push(e);
      continue;
    }
    const ids = (e.ids ?? []).filter((l) => !(t.ids ?? []).some((x) => lineKey(x) === lineKey(l)));
    const { ids: _i, ...rest } = e;
    if (ids.length) out.push({ ...rest, ids });
    else if (t.lines) out.push(rest);
  }
  return out;
}

/** What `next` has of entries and lines that `before` has not (to take back). */
export function idsAdded(before: readonly OriginalIds[] | undefined, next: readonly OriginalIds[]): AddedIds[] {
  const out: AddedIds[] = [];
  for (const e of next) {
    const b = (before ?? []).find((x) => entryKey(x) === entryKey(e));
    if (!b) out.push(e);
    else {
      const ids = (e.ids ?? []).filter((l) => !(b.ids ?? []).some((x) => lineKey(x) === lineKey(l)));
      if (ids.length) out.push({ source: e.source, ...(e.xref ? { xref: e.xref } : {}), ids, lines: true });
    }
  }
  return out;
}

/** The entries of a record merged into another one: theirs, as not come of the import (`xid`). */
export function mergedAway(list: readonly OriginalIds[] | undefined): OriginalIds[] {
  return (list ?? []).map((e) => ({ ...e, xid: true as const }));
}

// ── matching ────────────────────────────────────────────────────────────────

/** A strong ID's kind and value as compared: "uuid", "fs", "afn", "exid:<type>". */
export function strongKey(l: OriginalId): { kind: string; value: string } | undefined {
  const tag = l.tag.toUpperCase();
  if (tag === "_UID" || tag === "UID") {
    // without case, dashes, braces and spaces; a MyHeritage/PAF checksum after the 32 hex digits taken off
    let v = l.value.toLowerCase().replace(/[-{}\s]/gu, "");
    if (/^[0-9a-f]{36}$/u.test(v)) v = v.slice(0, 32);
    return v ? { kind: "uuid", value: v } : undefined;
  }
  const upper = l.value.replace(/\s+/gu, "").toUpperCase();
  if (tag === "_FSFTID") return upper ? { kind: "fs", value: upper } : undefined;
  if (tag === "AFN") return upper ? { kind: "afn", value: upper } : undefined;
  if (tag === "EXID") {
    const type = (l.type ?? "").trim().toLowerCase();
    if (type.includes("familysearch.org")) return upper ? { kind: "fs", value: upper } : undefined;
    const v = l.value.trim();
    return v ? { kind: `exid:${type}`, value: v } : undefined;
  }
  return undefined;
}

/** The tag a strong kind is said by. */
const kindWord = (kind: string, lines: readonly OriginalId[]): string => lines.find((l) => strongKey(l)?.kind === kind)?.tag ?? kind;

/** A kind of ID that is the same for the person in every file (all but a UUID): a different one is counter-evidence. */
const isGlobal = (kind: string) => kind !== "uuid";

const strongOf = (lines: readonly OriginalId[] | undefined) => (lines ?? []).map(strongKey).filter((k): k is { kind: string; value: string } => !!k);

/** The weak keys of an entry: its xref and RIN (only within one program's files). */
function weakKeys(e: { xref?: string | undefined; ids?: readonly OriginalId[] | undefined }): string[] {
  return [...(e.xref ? [`xref:${e.xref}`] : []), ...(e.ids ?? []).filter((l) => l.tag.toUpperCase() === "RIN").map((l) => `rin:${l.value.trim()}`)];
}

/** The program that wrote an import (its source's), folded; none unknown. */
function programOf(tree: Tree, source: string): string | undefined {
  const p = tree.get<Source>(source)?.imported?.program;
  return p ? foldText(p) : undefined;
}

/** The person a record of the research is now (one merged since: the one it went into); none withdrawn. */
export function livePerson(tree: Tree, p: Person | undefined): Person | undefined {
  for (let i = 0; p && i < 20; i++) {
    if (!p.mergedInto) return p.retracted ? undefined : p;
    p = tree.get<Person>(p.mergedInto);
  }
  return undefined;
}

/** A word of the names in common (two letters at least, folded, any script), or the same whole name. */
export function namesAlike(ours: Person, names: readonly string[]): boolean {
  const norm = (s: string) => foldText(s.replace(/\//g, " "));
  const words = (s: string) => new Set(norm(s).split(" ").filter((w) => [...w].length > 1));
  return ours.names.some((n) => {
    const mine = `${n.given} ${n.surname}`;
    const w = words(mine);
    return names.some((t) => (!!norm(t) && norm(t) === norm(mine)) || [...words(t)].some((x) => w.has(x)));
  });
}

/** The first year of a person's birth or baptism. */
export function birthYearOf(p: Person): number | undefined {
  const ys = dateYears(birthEvent(p)?.date ?? "");
  return ys.length ? Math.min(...ys) : undefined;
}

/** The research's people by their IDs: each strong key and each weak one (by program) → the live people that have it. */
export interface IdIndex {
  strong: Map<string, Set<string>>;
  weak: Map<string, Set<string>>;
  /** IDs of people not written on them yet: read from the files of earlier imports (a research of 1.29, origins-1 not run). */
  pending?: ReadonlyMap<string, readonly OriginalIds[]>;
}

/** The IDs a person has: those on the record and those of earlier imports' files not written yet. */
const idsOf = (index: IdIndex, p: Person): OriginalIds[] => [...(p.originalIds ?? []), ...(index.pending?.get(p.id) ?? [])];

/**
 * The research's people by their IDs. `pending`: the IDs of people the files of earlier imports give and the records
 * do not carry yet (strom fixes run origins writes them) — matched by as if written, nothing written of them here.
 */
export function personIndex(tree: Tree, pending?: ReadonlyMap<string, readonly OriginalIds[]>): IdIndex {
  const strong = new Map<string, Set<string>>();
  const weak = new Map<string, Set<string>>();
  const index: IdIndex = { strong, weak, ...(pending?.size ? { pending } : {}) };
  const add = (m: Map<string, Set<string>>, k: string, id: string) => m.set(k, (m.get(k) ?? new Set()).add(id));
  for (const p of tree.list<Person>("person")) {
    const all = idsOf(index, p);
    if (!all.length) continue;
    const live = livePerson(tree, p);
    if (!live) continue;
    for (const e of all) {
      for (const k of strongOf(e.ids)) add(strong, `${k.kind}|${k.value}`, live.id);
      const program = programOf(tree, e.source);
      if (program) for (const k of weakKeys(e)) add(weak, `${program}|${k}`, live.id);
    }
  }
  return index;
}

/** A person of a file to find in the research: their names, sex, birth year, ID lines and xref, the program of the file. */
export interface IdQuery {
  names: readonly string[];
  sex?: string | undefined;
  year?: number | undefined;
  ids: readonly OriginalId[];
  xref?: string | undefined;
  program?: string | undefined;
}

/** A person of the research who may be the same as one of a file: who, and why only maybe. */
export interface IdCandidate {
  like: string;
  why: string;
}

/**
 * Who of the research a person of a file is by their IDs: `same` only when every rule holds (see the top of the file);
 * else the candidates, each with why it is only a candidate. `taken`: the research's people others of the file are.
 */
export function matchByIds(tree: Tree, index: IdIndex, q: IdQuery, taken: ReadonlySet<string>): { same?: string; candidates: IdCandidate[] } {
  const candidates: IdCandidate[] = [];
  const mine = strongOf(q.ids);
  const hits = new Map<string, string>(); // the research's person → the kind found by
  for (const k of mine) for (const id of index.strong.get(`${k.kind}|${k.value}`) ?? []) if (!hits.has(id)) hits.set(id, k.kind);
  if (hits.size > 1) {
    for (const [id, kind] of hits) candidates.push({ like: id, why: `same ${kindWord(kind, q.ids)}; more than one person has it` });
  } else if (hits.size === 1) {
    const [id, kind] = [...hits][0]!;
    const p = tree.get<Person>(id)!;
    const why: string[] = [];
    if (!namesAlike(p, q.names)) why.push("name differs");
    if ((q.sex === "M" || q.sex === "F") && (p.sex === "M" || p.sex === "F") && q.sex !== p.sex) why.push("sex differs");
    const y = birthYearOf(p);
    if (q.year !== undefined && y !== undefined && Math.abs(q.year - y) > YEARS_CLOSE) why.push("birth years differ");
    // a global ID both have, none of them alike
    const theirs = strongOf(idsOf(index, p).flatMap((e) => e.ids ?? []));
    for (const kind of new Set(mine.map((k) => k.kind).filter(isGlobal))) {
      const a = new Set(mine.filter((k) => k.kind === kind).map((k) => k.value));
      const b = theirs.filter((k) => k.kind === kind).map((k) => k.value);
      if (b.length && !b.some((v) => a.has(v))) why.push(`${kindWord(kind, q.ids)} differs`);
    }
    if (taken.has(id)) why.push("another person of the file is them already");
    if (!why.length) return { same: id, candidates };
    candidates.push({ like: id, why: `same ${kindWord(kind, q.ids)}; ${why.join(", ")}` });
  }
  // weak IDs: within one program's files, a person of a name alike — a candidate only
  const program = q.program ? foldText(q.program) : undefined;
  if (program)
    for (const k of weakKeys({ xref: q.xref, ids: q.ids }))
      for (const id of index.weak.get(`${program}|${k}`) ?? []) {
        if (hits.has(id) || candidates.some((c) => c.like === id)) continue;
        const p = tree.get<Person>(id);
        if (p && namesAlike(p, q.names)) candidates.push({ like: id, why: `same ${k.startsWith("xref:") ? "xref" : "RIN"} in a file of the same program` });
      }
  return { candidates };
}

/** The ID entries of a record (person or family) as the export writes them: for the Strom app (see export.ts). */
export type WithIds = Pick<Person | Family, "originalIds">;
