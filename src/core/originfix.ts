// strom fixes origins: before strom ORIGINS_SINCE nothing said where a fact's, a name's or a sex's value came from —
// an imported family tree of another program (a lead an agent changes only on a record), the user (never changed by an
// agent, only proposed) or the research itself (core/origin.ts). Since then an import and the person's own writes mark
// it as they write it; a research an older strom wrote is marked once by rules, ONLY marks added, no value changed:
//
// - a fact or a name citing the source of a family tree of another program (its input a GEDCOM file still readable,
//   its HEAD no `1 SOUR STROM`): the import's, its source given (the source gets `imported`, its key R1, R2…);
// - one citing a send of the Strom app (a sync's source), the Strom app's own file or JSON taken in: the user's;
// - a file no more readable (or of an unknown kind): the user's — a person's value is never taken for an import's;
// - the user wins over an import (a fact citing both); a fact citing an import and records stays the import's;
// - the names of the people such an import made (as its file names them): the import's, the Strom app's the user's;
// - a sex such an import gave with nothing of the user's about the person: the import's; one of the app the user's;
// - anything with an origin already is left as it is;
// - the IDs a person or a family had in such a file (its xref, its _UID, RIN, EXID…: spec 066 K3.2), by the refs the
//   import left (gedcom:<sha12> + the xref): added beside any the record has — never one of the Strom app's file.
//
// Free, one operation and one commit, kept for its undo (ORIGINS_FIX_FILE): the commit before it in the research's
// history and `strom fixes undo origins` are the way back (the marks taken off where they are still as the fix set them).

import fs from "node:fs";
import path from "node:path";
import type { Conflict, Event, Family, Input, Name, OriginalIds, Person, Source, TreeConfig, ValueOrigin } from "./model.ts";
import { entryOf, foreignIds, joinIds } from "./originalids.ts";
import { canonicalize } from "./json.ts";
import { proposalHolds, settleProposals } from "./proposalsettle.ts";
import type { SyncInput } from "./sync.ts";
import { now, VERSION, type Tree } from "./tree.ts";
import { fixedDecision } from "./readers.ts";
import { freshConfig, quiet } from "./hypolinks.ts";
import { writableUnasked } from "./integrity.ts";
import { inputPath } from "./media.ts";
import { decodeText } from "./text.ts";
import { readGedName, readGedSex, stromAppFile } from "./import.ts";
import { gedcomName, sameName } from "./people.ts";
import { children, parseGedcomText, val, type GedNode } from "../gedcom/parse.ts";

/** The strom version from which values carry where they came from. */
export const ORIGINS_SINCE = "1.30.0";
/** The marker in strom.json: the values of an older research marked once. */
export const ORIGINS_SETTLED = "origins-1";
/** Where the fix keeps what it marked, for its undo (sealed like the rest of quality/; travels with the research). */
export const ORIGINS_FIX_FILE = "quality/origins.json";

type By = "import" | "user";

/** One mark the fix adds: a fact's, a name's, a sex's origin — or a source of an import's key. */
export type OriginMark =
  | { kind: "fact"; owner: string; event: string; by: By; source?: string }
  | { kind: "name"; person: string; index: number; name: string; by: By; source?: string }
  | { kind: "sex"; person: string; by: By; source?: string }
  | { kind: "source"; source: string; key: string; title: string; imported: NonNullable<Source["imported"]> }
  | { kind: "ids"; owner: string; entry: OriginalIds };

export interface OriginFindings {
  fixes: OriginMark[];
  left: never[];
}

interface OriginsFile {
  v: 1;
  /** Each time the fix marked, newest last. */
  runs: { at: string; version: string; items: OriginMark[] }[];
}

/** What a source of a family tree taken in is: an import of another program's file, or the user's (the Strom app). */
interface TreeSource {
  by: By;
  source: Source;
  /** The persons' refs of its file (gedcom:<sha12>), where the file is known. */
  system?: string;
  /** The file's people and families by xref (readable GEDCOM files only). */
  people?: Map<string, GedNode>;
  families?: Map<string, GedNode>;
  app?: boolean;
  head?: GedNode;
}

/** The file of an input as text; undefined when it cannot be read. */
function inputText(tree: Tree, input: Input): string | undefined {
  try {
    const file = inputPath(tree, input);
    return file && fs.existsSync(file) ? decodeText(fs.readFileSync(file)) : undefined;
  } catch {
    return undefined;
  }
}

/** The sources of families trees taken in, each with whose its values are. */
function treeSources(tree: Tree): Map<string, TreeSource> {
  const out = new Map<string, TreeSource>();
  for (const s of tree.list<Source>("source")) {
    if (!s.input) continue;
    const input = tree.get<Input>(s.input);
    if (!input || input.type !== "input") continue;
    // a send of the Strom app (strom sync): the user's
    if ((input as SyncInput).sync) {
      out.set(s.id, { by: "user", source: s });
      continue;
    }
    if (input.kind !== "tree") continue;
    const system = input.sha ? `gedcom:${input.sha.slice(0, 12)}` : undefined;
    if (!/\.ged$/i.test(input.name)) {
      // the Strom app's JSON (or a tree of a kind strom does not import): the user's
      out.set(s.id, { by: "user", source: s, ...(system ? { system } : {}), app: true });
      continue;
    }
    const text = inputText(tree, input);
    if (text === undefined) {
      // not readable: never taken for an import's
      out.set(s.id, { by: "user", source: s, ...(system ? { system } : {}) });
      continue;
    }
    let records: GedNode[];
    try {
      records = parseGedcomText(text).records;
    } catch {
      out.set(s.id, { by: "user", source: s, ...(system ? { system } : {}) });
      continue;
    }
    const head = records.find((r) => r.tag === "HEAD");
    const app = stromAppFile(head).app || val(head, "SOUR")?.trim() === "STROM_RESEARCH";
    const people = new Map(records.filter((r) => r.tag === "INDI" && r.xref).map((r) => [r.xref!, r]));
    const families = new Map(records.filter((r) => r.tag === "FAM" && r.xref).map((r) => [r.xref!, r]));
    out.set(s.id, { by: app ? "user" : "import", source: s, ...(system ? { system } : {}), people, families, app, ...(head ? { head } : {}) });
  }
  return out;
}

/** The `imported` of an import's source, from its file's HEAD. */
function importedOf(t: TreeSource, key: string, input: Input | undefined): NonNullable<Source["imported"]> {
  const sour = t.head?.children.find((c) => c.tag === "SOUR");
  const program = (val(sour, "NAME")?.trim() || sour?.value.trim() || "").slice(0, 200);
  const version = val(sour, "VERS")?.trim().slice(0, 100);
  const date = val(t.head, "DATE")?.trim().slice(0, 100);
  return {
    key,
    ...(program ? { program } : {}),
    ...(version ? { version } : {}),
    ...(date ? { date } : {}),
    at: t.source.created.slice(0, 10),
    ...(input?.name ? { file: input.name } : {}),
    ...(input?.sha ? { sha: input.sha } : {}),
  };
}

/** Whose a value is by the sources it cites: the user's wins over an import's; none of them, nobody's (the research's). */
function byCitations(sources: Map<string, TreeSource>, cited: readonly { source: string }[] | undefined): { by: By; source?: string } | undefined {
  const of = (cited ?? []).map((c) => sources.get(c.source)).filter((t): t is TreeSource => !!t);
  if (of.some((t) => t.by === "user")) return { by: "user" };
  const imp = of.find((t) => t.by === "import");
  return imp ? { by: "import", source: imp.source.id } : undefined;
}

/** The names a file gives a person (its INDI): as the import read them. */
function fileNames(t: TreeSource, xref: string): Name[] {
  const r = t.people?.get(xref);
  if (!r) return [];
  const file = stromAppFile(t.head);
  return children(r, "NAME").map((n) => {
    const found = readGedName(n, file).name;
    return { ...found, given: found.given.replace(/\//g, "|"), surname: found.surname.replace(/\//g, "|") };
  });
}

/** What the fix finds: nothing once it ran here (the marker in strom.json). */
export function originFixes(tree: Tree): OriginFindings {
  const out: OriginFindings = { fixes: [], left: [] };
  if (tree.config.settled?.includes(ORIGINS_SETTLED)) return out;
  const sources = treeSources(tree);
  if (!sources.size) return out;
  // the import's sources: their keys (R1, R2… after any there are), in the order they came
  let n = 0;
  for (const s of tree.list<Source>("source")) {
    const m = /^R(\d+)$/u.exec(s.imported?.key ?? "");
    if (m) n = Math.max(n, Number(m[1]));
  }
  const imports = [...sources.values()].filter((t) => t.by === "import").sort((a, b) => a.source.id.localeCompare(b.source.id, undefined, { numeric: true }));
  for (const t of imports)
    if (!t.source.imported) out.fixes.push({ kind: "source", source: t.source.id, key: `R${++n}`, title: t.source.title, imported: importedOf(t, `R${n}`, tree.get<Input>(t.source.input!)) });
  const bySystem = new Map<string, TreeSource[]>();
  for (const t of sources.values()) if (t.system) bySystem.set(t.system, [...(bySystem.get(t.system) ?? []), t]);
  const owners: (Person | Family)[] = [...tree.list<Person>("person"), ...tree.list<Family>("family")].filter((o) => !o.retracted && !o.mergedInto);
  for (const o of owners) {
    for (const e of o.events) {
      if (e.retracted || e.origin) continue;
      const v = byCitations(sources, e.citations);
      if (v) out.fixes.push({ kind: "fact", owner: o.id, event: e.id, ...v });
    }
    // the IDs the record had in another program's file it came from (its xref, the ID lines there), not had yet
    for (const r of o.refs ?? [])
      for (const t of bySystem.get(r.system) ?? []) {
        if (t.by !== "import") continue;
        const node = (o.type === "person" ? t.people : t.families)?.get(r.id);
        const block = node ? foreignIds(node, [], r.id) : undefined;
        if (!block) continue;
        const entry = entryOf(block, t.source.id);
        if (joinIds(o.originalIds, [entry]).changed && !out.fixes.some((f) => f.kind === "ids" && f.owner === o.id && JSON.stringify(f.entry) === JSON.stringify(entry)))
          out.fixes.push({ kind: "ids", owner: o.id, entry });
      }
    if (o.type !== "person") continue;
    // the files this person came from: each ref of a family tree taken in
    const from = (o.refs ?? []).flatMap((r) => (bySystem.get(r.system) ?? []).map((t) => ({ t, xref: r.id })));
    const appPerson = (o.refs ?? []).some((r) => r.system === "strom-app");
    o.names.forEach((name, index) => {
      if (name.origin) return;
      const cited = byCitations(sources, name.citations);
      let v = cited;
      // a name with no citation of its own: the file's (as it names the person), the Strom app's
      if (!v && !name.citations?.length) {
        const of = from.filter(({ t, xref }) => (t.people ? fileNames(t, xref).some((f) => sameName(f, name)) : true));
        if (appPerson || of.some(({ t }) => t.by === "user")) v = { by: "user" };
        else {
          const imp = of.find(({ t }) => t.by === "import");
          if (imp) v = { by: "import", source: imp.t.source.id };
        }
      }
      if (v) out.fixes.push({ kind: "name", person: o.id, index, name: gedcomName(name), ...v });
    });
    // a sex: an unknown one is no value; the user's wins
    if (o.sex !== "U" && !o.sexOrigin) {
      if (appPerson || from.some(({ t }) => t.by === "user")) out.fixes.push({ kind: "sex", person: o.id, by: "user" });
      else {
        const imp = from.find(({ t, xref }) => {
          const r = t.by === "import" ? t.people?.get(xref) : undefined;
          return !!r && readGedSex(r, stromAppFile(t.head)) === o.sex;
        });
        if (imp) out.fixes.push({ kind: "sex", person: o.id, by: "import", source: imp.t.source.id });
      }
    }
  }
  return out;
}

/**
 * The IDs of people the files of earlier imports give and the records do not carry yet (a research of 1.29 before
 * strom fixes run origins): for an intake to know them by — read only, nothing written. None once the fix ran here.
 */
export function pendingIds(tree: Tree): Map<string, OriginalIds[]> {
  const out = new Map<string, OriginalIds[]>();
  for (const f of originFixes(tree).fixes) {
    if (f.kind !== "ids" || tree.get<Person | Family>(f.owner)?.type !== "person") continue;
    out.set(f.owner, [...(out.get(f.owner) ?? []), f.entry]);
  }
  return out;
}

function readFile(tree: Tree): OriginsFile {
  try {
    const f = JSON.parse(fs.readFileSync(path.join(tree.root, ...ORIGINS_FIX_FILE.split("/")), "utf8")) as Partial<OriginsFile>;
    return { v: 1, runs: Array.isArray(f.runs) ? f.runs : [] };
  } catch {
    return { v: 1, runs: [] };
  }
}

const fileContent = (f: OriginsFile) => JSON.stringify(f, null, 2) + "\n";

/** The marker in strom.json, with whatever else the caller changes there (the fix's decision). */
const settledWith = (config?: (c: TreeConfig) => void) => (c: TreeConfig) => {
  c.settled = [...new Set([...(c.settled ?? []), ORIGINS_SETTLED])];
  config?.(c);
};

const originOf = (m: { by: By; source?: string }): ValueOrigin<never> => (m.by === "import" && m.source ? { by: "import", source: m.source } : { by: m.by });
const byId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** The records with the marks set (or taken off), as they are now: only the marks, nothing else of them. */
function marked(tree: Tree, items: OriginMark[], undo: boolean): { records: (Person | Family | Source)[]; done: OriginMark[] } {
  const records = new Map<string, Person | Family | Source>();
  const done: OriginMark[] = [];
  const of = <T extends Person | Family | Source>(id: string): T | undefined => {
    if (!records.has(id)) {
      const r = tree.get<T>(id);
      if (!r) return undefined;
      records.set(id, structuredClone(r));
    }
    return records.get(id) as T;
  };
  const same = (o: ValueOrigin<string> | undefined, m: { by: By; source?: string }) => !!o && o.by === m.by && (o.source ?? "") === (originOf(m).source ?? "") && !o.parts;
  for (const it of items) {
    if (it.kind === "ids") {
      const o = of<Person | Family>(it.owner);
      if (!o || (o.type !== "person" && o.type !== "family")) continue;
      const key = (e: OriginalIds) => `${e.source}\u0000${e.xref ?? ""}`;
      if (undo) {
        // taken off where it is still as the fix added it (compared as stored: the record file orders the keys)
        const at = (o.originalIds ?? []).findIndex((e) => JSON.stringify(canonicalize(e)) === JSON.stringify(canonicalize(it.entry)));
        if (at < 0) continue;
        const rest = o.originalIds!.filter((_, i) => i !== at);
        if (rest.length) o.originalIds = rest;
        else delete o.originalIds;
      } else {
        if ((o.originalIds ?? []).some((e) => key(e) === key(it.entry))) continue;
        const joined = joinIds(o.originalIds, [it.entry]);
        if (!joined.changed) continue;
        o.originalIds = joined.list;
      }
      done.push(it);
    } else if (it.kind === "source") {
      const s = of<Source>(it.source);
      if (!s || s.type !== "source") continue;
      if (undo ? s.imported?.key !== it.key : s.imported) continue;
      if (undo) delete s.imported;
      else s.imported = it.imported;
      done.push(it);
    } else if (it.kind === "fact") {
      const o = of<Person | Family>(it.owner);
      const e = o?.events.find((x) => x.id === it.event);
      if (!e) continue;
      if (undo ? !same(e.origin, it) || e.was : e.origin) continue;
      if (undo) delete e.origin;
      else e.origin = originOf(it) as Event["origin"];
      done.push(it);
    } else if (it.kind === "name") {
      const p = of<Person>(it.person);
      const name = p?.names[it.index];
      if (!name || gedcomName(name) !== it.name) continue;
      if (undo ? !same(name.origin, it) || name.was : name.origin) continue;
      if (undo) delete name.origin;
      else name.origin = originOf(it) as Name["origin"];
      done.push(it);
    } else {
      const p = of<Person>(it.person);
      if (!p || p.type !== "person") continue;
      if (undo ? !same(p.sexOrigin, it) || p.sexWas : p.sexOrigin || p.sex === "U") continue;
      if (undo) delete p.sexOrigin;
      else p.sexOrigin = originOf(it);
      done.push(it);
    }
  }
  // only the records a mark changed (the update time kept: no value of theirs changed)
  const touched = new Set(done.map((d) => (d.kind === "source" ? d.source : d.kind === "fact" || d.kind === "ids" ? d.owner : d.person)));
  return { records: [...records.values()].filter((r) => touched.has(r.id)), done };
}

/**
 * The fix: each value found marked where it came from (only the marks — no value, citation or status changes), the
 * import's sources their keys — the marker in strom.json, what it marked kept for its undo; one operation, even when
 * nothing is found (the marker alone). Inside withTreeLock.
 */
export function applyOrigins(tree: Tree, items: OriginMark[], version: string, config?: (c: TreeConfig) => void): { changed: number; records: number } {
  const found = originFixes(tree);
  const wanted = items.filter((it) => found.fixes.some((f) => JSON.stringify(f) === JSON.stringify(it)));
  const { records, done } = marked(tree, wanted, false);
  if (!done.length) {
    tree.updateConfig(settledWith(config), { op: "tree.settle", summary: "where the values came from: marked as they come from now on (nothing to mark)" });
    return { changed: 0, records: 0 };
  }
  const file = readFile(tree);
  file.runs.push({ at: now(), version, items: done });
  const count = (k: OriginMark["kind"], by?: By) => done.filter((d) => d.kind === k && (!by || (d.kind !== "source" && d.kind !== "ids" && d.by === by))).length;
  tree.putMany(
    records,
    [{ rel: ORIGINS_FIX_FILE, content: fileContent(file) }],
    {
      op: "origins.fix",
      targets: records.map((r) => r.id).sort(byId),
      summary:
        `where the values came from marked: ${count("fact", "import")} facts, ${count("name", "import")} names, ${count("sex", "import")} sexes of an imported family tree (${count("source")} imports given a key), ` +
        `${count("fact", "user")} facts, ${count("name", "user")} names, ${count("sex", "user")} sexes the user's${count("ids") ? `, the IDs of a family tree on ${count("ids")} records` : ""} — only marks, no value changed (fix origins; the commit before is the way back)`,
    },
    settledWith(config),
  );
  return { changed: done.length, records: records.length };
}

/** What the fix marked and is not undone yet. */
export function originsDone(tree: Tree): OriginMark[] {
  return readFile(tree).runs.flatMap((r) => r.items);
}

/** The fix undone: each mark taken off where it is still as the fix set it. One operation; what the fix kept is emptied. */
export function undoOrigins(tree: Tree, config?: (c: TreeConfig) => void): { restored: number; records: number; left: number } {
  const file = readFile(tree);
  const items = file.runs.flatMap((r) => r.items);
  if (!items.length) return { restored: 0, records: 0, left: 0 };
  const { records, done } = marked(tree, items, true);
  const left = items.length - done.length;
  tree.putMany(
    records,
    [{ rel: ORIGINS_FIX_FILE, content: fileContent({ v: 1, runs: [] }) }],
    {
      op: "origins.unfix",
      targets: records.map((r) => r.id).sort(byId),
      summary: `where the values came from: ${done.length} marks taken off in ${records.length} records${left ? `, ${left} changed since left` : ""} (fix origins undone)`,
    },
    config,
  );
  return { restored: done.length, records: records.length, left };
}

/**
 * Once per research, at the first start of this strom (after its backup) and at a bridge's start: the fix applied by
 * itself, its decision kept as the person's fixes are (`decision`: strom fixes undo origins puts it back) — in one
 * commit. Skipped as settleReaders is (somebody at work, another computer's seal, data changed outside strom, a dry run).
 */
export function settleOrigins(tree: Tree, decision: (c: TreeConfig) => void = fixedDecision("origins", VERSION)): { changed: number; records: number } | undefined {
  if (tree.dryRun || tree.config.settled?.includes(ORIGINS_SETTLED) || !quiet(tree)) return undefined;
  let out: { changed: number; records: number } | undefined;
  tree.atomically(() => {
    if (!freshConfig(tree) || tree.config.settled?.includes(ORIGINS_SETTLED) || !writableUnasked(tree)) return;
    const found = originFixes(tree);
    const r = applyOrigins(tree, found.fixes, ORIGINS_SINCE, found.fixes.length ? decision : undefined);
    tree.commit(r.changed ? `Where the values came from marked: ${r.changed} marks in ${r.records} records (only marks, no value changed)` : "Where the values came from: marked as they come from now on");
    out = r;
  });
  return out;
}

/**
 * The open proposals of an agent whose value proposed holds now (written so before a proposal was settled at the write
 * that makes it hold): closed by themselves, no value written — at the first start of this strom and at a bridge's
 * start, as settleOrigins, and skipped as it is (somebody at work, another computer's seal, data changed outside strom,
 * a dry run). A cheap look first: nothing holds, nothing written. The ones closed.
 */
export function settleHeldProposals(tree: Tree): Conflict[] | undefined {
  if (tree.dryRun || !quiet(tree)) return undefined;
  if (!tree.list<Conflict>("conflict").some((c) => c.state === "open" && !c.retracted && c.proposal && proposalHolds(tree, c))) return [];
  let out: Conflict[] | undefined;
  tree.atomically(() => {
    if (!freshConfig(tree) || !writableUnasked(tree)) return;
    const closed = settleProposals(tree);
    if (closed.length) tree.commit(`Proposals settled by themselves: ${closed.map((c) => c.id).join(", ")} (the value proposed holds now)`);
    out = closed;
  });
  return out;
}
