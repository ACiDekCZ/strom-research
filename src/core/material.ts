// The family's material the research keeps, for the Strom app to show (GET <token>/material): the files sent from the
// app or given by hand — one at a time for people, or in batches — with where each came from, whom it is of and what
// was found of it. An archive keeps them unsorted, and the app is the one place a person sees them again. The file
// itself comes by GET <token>/media/<sha>?file=1 (a thumbnail: ?thumb=<px>, core/thumbs.ts) or the link
// strom-research://media.
//
// What a person does with it in the app — the people a file is of added or taken off (POST <token>/material/assign,
// strom input assign), a file hidden and shown again (POST <token>/material/hide, strom input hide|unskip) — is
// written here, the same in an archive and a research: all of it or nothing, never a file deleted (deleting one for good,
// the person's alone: core/materialdelete.ts).

import fs from "node:fs";
import path from "node:path";
import { UsageError } from "./errors.ts";
import { HIDE_REASONS, MATERIAL_KINDS, type Family, type Input, type Media, type MediaLink, type Person, type Source, type Task } from "./model.ts";
import { listBatches, readBatch, writeBatch } from "./batches.ts";
import { gatherTask, originOf } from "./originals.ts";
import { displayName, lifespan } from "./people.ts";
import { normId, update } from "./records.ts";
import { normalizeDate } from "./gdate.ts";
import { restoreTakenOff } from "./sync.ts";
import { inTree, workingRel } from "./treemedia.ts";
import { mediaRecords } from "./mediaindex.ts";
import { inputsByWorkingSha, recordsBySha } from "./shaindex.ts";
import { storedBytes } from "./appmedia.ts";
import { listSorts, type SortProposal, type SortState } from "./sort.ts";
import type { Tree } from "./tree.ts";
import { houseIndex, houseRefs, type HouseIndex } from "./houses.ts";

export interface MaterialFile {
  id: string;
  name: string;
  /** What a person (or whoever sorted it) called it. */
  title?: string;
  /** What it is: a record, a document, a photo (as it was sorted), other — or a family tree (`?trees=1`, spec 117 K2.1). */
  kind?: (typeof MATERIAL_KINDS)[number] | "tree";
  /** When the document was written or the photo taken (a GEDCOM date). */
  date?: string;
  sha: string;
  mime?: string;
  bytes?: number;
  /** When it came. */
  at: string;
  from?: string;
  /** The people it is of: as the sender said, and as whoever sorted it found. */
  persons: string[];
  batch?: string;
  path?: string;
  /** The notes on it: the sender's own (by "user"), and what whoever sorted it wrote. */
  notes?: { at: string; by: string; text: string }[];
  state: Input["state"];
  sorted?: { as: string; persons?: string[]; source?: string; reason?: string };
  /** The source it became. */
  source?: string;
  /**
   * Hidden (skipped): when, by whom, why. Hidden files stay in the list. A file of the Strom app's tree with no place
   * left in it is hidden as removed (from its places, nothing written): shown again, its places come back.
   */
  hidden?: { at: string; by: string; reason?: (typeof HIDE_REASONS)[number] | "removed" };
  /** A file of the Strom app's tree (in it now, or once): "app". None: material of the research alone. */
  origin?: "app";
  /** Its places in the app's tree, those not taken off (spec 108): a person's, a couple's, an event's, a source's. */
  links?: { type: MediaLink["type"]; ref: string; event?: string }[];
  /**
   * Where the research uses it, which the app does not see (bridge feature material.uses; GET /material/<I…>/uses) —
   * and the sources it is the source of, each with how, its title, the people citing it and whether the app's tree has
   * it (`of`, feature material.sourceOf).
   */
  uses: { excerpts: number; sources: string[]; tasks: number; of: SourceOf[] };
  /**
   * The last sort done that took it proposed nothing of it (its reader said nothing of it, or all it said is there or was
   * left out), or the file took over what it proposed (`accepted`, spec 147 K1: its title, kind and date, its people), or
   * the person decided of its proposal in the Strom app (`accepted`, `refused`: spec 147 K2): not sent to be sorted again
   * unless the person chooses it (feature material.left; accepted, refused: material.accepted). A later sort that
   * proposed something of it takes it off. From the sorts kept here (.strom/sorts): nothing written to the research.
   */
  left?: { at: string; sort: string; why: (typeof LEFT_WHY)[number]; said?: string };
  /** The oldest other file of the material with the same content (the same SHA-256): sorted once (feature material.sameAs). */
  sameAs?: string;
  /**
   * The houses it is material of (Input.houses, spec 145): each house's record and key, as its row of GET /houses has
   * them (bridge feature material.houses). None: no field.
   */
  houses?: { id: string; key: string }[];
  /** Whether the file is on this computer (a research unpacked without its images: not). */
  here: boolean;
}

/**
 * A source a file of the material is the source of (spec 102 K1.14): made or sorted from it (`input`), cut out of an
 * image with its content (`excerpt`), or with an image of its content (`media`) — the most direct way, once a source.
 */
export interface SourceOf {
  source: string;
  via: "input" | "excerpt" | "media";
  title: string;
  /** The people whose facts or names cite it (a duplicate merged away: the one it went into), at most CITED_SHOWN. */
  cited: string[];
  citedCount: number;
  /** Whether the app's tree (/tree.ged) has it: every source that stands but those of a sync from the app. */
  inTree: boolean;
}

/** How many of the people citing a source `of` names (all of them counted). */
export const CITED_SHOWN = 5;

/**
 * Why a file the agent sorted is left (`left`): its reader said nothing of it, all it proposed is there or was left out
 * (SORT_UNPROPOSED); the file took over its proposal, or the person took it or turned it down in the Strom app (spec 147,
 * feature material.accepted).
 */
export const LEFT_WHY = ["nothing-said", "nothing-new", "dropped", "accepted", "refused"] as const;

/** Where the research uses a file of the material (GET /material/<I…>/uses): its excerpts, sources, open tasks. */
export interface MaterialUses {
  /** The excerpts cut from it (a source's clip on an image of its content, or a source read from it as a whole). */
  excerpts: { source: string; recordset?: string; page?: string; sha: string }[];
  /** The sources that refer to it: made from it, read from it, citing an image of its content. */
  sources: { id: string; title: string }[];
  /** The tasks that hold it now (open, begun, put aside, waiting). */
  tasks: { id: string; title: string; state: Task["state"] }[];
  /** The sources it is the source of, each with how (feature material.sourceOf). */
  of: SourceOf[];
  /** The houses it is material of, as MaterialFile.houses (feature material.houses). None: no field. */
  houses?: { id: string; key: string }[];
}

export interface MaterialBatch {
  id: string;
  name?: string;
  at: string;
  done?: string;
  files: number;
  persons: string[];
  note?: string;
}

export interface Material {
  files: MaterialFile[];
  batches: MaterialBatch[];
  /** The names of the people the files and batches are of, as the research knows them ("Jan Novák (1901–1975)"). */
  people: Record<string, string>;
}

/** The kinds of material the app shows (`kind`): what sorting found, a record being a source. */
export { MATERIAL_KINDS };
const KIND_OF_SORT: Record<string, (typeof MATERIAL_KINDS)[number]> = { source: "record", document: "document", photo: "photo" };

/** How many files one write of the app's takes (a whole batch), how many people. */
export const MATERIAL_MOST_FILES = 5000;
export const MATERIAL_MOST_PEOPLE = 50;

/** How many files one edit of their titles, kinds and dates takes (the app's revision of the material). */
export const MATERIAL_MOST_EDIT = 500;
/** The longest title of a file. */
export const MATERIAL_TITLE_MAX = 200;

/** A person as the research knows them now: a duplicate merged away is the one it went into. */
export function live(tree: Pick<Tree, "get">, id: string): string {
  let p = tree.get<Person>(id);
  for (let i = 0; p?.mergedInto && i < 10; i++) p = tree.get<Person>(p.mergedInto);
  return p && !p.retracted ? p.id : id;
}

/**
 * A file of the family's material: an input of a file (never a family tree, or a tree a sync sent), not retracted — a
 * file of the Strom app's tree too whose original is not here yet (its working copy is). Never a portrait alone (the
 * app's own small picture of a person): a record whose places are all portraits and that nobody gave as material.
 */
function isMaterial(i: Input & { sync?: unknown }): boolean {
  return !i.retracted && !!i.sha && (!!i.file || (!!originOf(i) && !!i.working)) && !i.sync && i.kind !== "tree" && !portraitOnly(i);
}

/**
 * A family tree's file the research keeps (spec 117 K2.1): an input of a family tree (GEDCOM, the app's JSON) with its
 * bytes, not one a sync sent, not retracted — listed (GET /material?trees=1) and deleted as the material is.
 */
export function isTreeFile(i: Input & { sync?: unknown }): boolean {
  return !i.retracted && !!i.sha && !!i.file && i.kind === "tree" && !i.sync;
}

function portraitOnly(i: Input): boolean {
  const links = i.links ?? [];
  // the research's own file a portrait was made of (the same bytes) stays material of the research (spec 102 M4)
  if (!originOf(i) || !links.length || i.persons?.length || i.families?.length || i.batch || i.sorted) return false;
  const now = links.filter((l) => !l.retracted);
  return (now.length ? now : links).every((l) => l.type === "personPortrait");
}

/** The people a file of the app's tree is at (a person's place, an event of theirs): its portraits are not. */
function linkedPersons(tree: Tree, i: Input): string[] {
  return (i.links ?? []).filter((l) => !l.retracted && (l.type === "person" || (l.type === "event" && l.ref.startsWith("P")))).map((l) => live(tree, l.ref));
}

/** The people a file is of: as the sender said, as whoever sorted it found, and where the app's tree has it. */
export function materialPersons(tree: Tree, i: Input): string[] {
  return [...new Set([...[...(i.persons ?? []), ...(i.sorted?.persons ?? [])].map((p) => live(tree, p)), ...linkedPersons(tree, i)])];
}

/** Where a file of the material is: the original, else (a file of the app's tree whose original is not here) its working copy. */
export function materialFile(tree: Tree, shared: string | undefined, i: Input): string | undefined {
  if (!i.file) return shared && i.working ? path.join(shared, workingRel(shared, i.working)) : undefined;
  if (i.file.startsWith("inputs/")) return path.join(tree.root, i.file);
  return shared && i.file.startsWith("media:") ? path.join(shared, i.file.slice(6)) : undefined;
}

/** The file of a record of the app's tree whose original is not here (by that original's hash): its working copy. */
export function workingCopyOf(tree: Tree, shared: string | undefined, sha: string): { id: string; kind: "input"; mime: string; bytes: number; name: string; file?: string } | undefined {
  const i = recordsBySha<Input>(tree, "input", sha).find((x) => !x.retracted && !x.file && x.working);
  if (!i) return undefined;
  return { id: i.id, kind: "input", mime: i.working!.mime, bytes: i.working!.bytes, name: i.name, ...(shared ? { file: path.join(shared, workingRel(shared, i.working!)) } : {}) };
}

/**
 * A working copy the research keeps of a file of the app's tree, by the working copy's own hash (spec 133: the app asks
 * POST /media/known by the bytes it would send, then names them by reference): the input it is of, while its bytes are
 * in the shared store — answered as a known file is. None: the app sends those bytes as ever.
 */
export function workingCopyBySha(tree: Tree, shared: string | undefined, sha: string): { id: string; kind: "input"; mime: string; bytes: number; name: string; file: string } | undefined {
  if (!shared) return undefined;
  const i = inputsByWorkingSha(tree, sha).find((x) => !x.retracted && x.working);
  const file = i ? storedBytes(shared, sha) : undefined;
  return i && file ? { id: i.id, kind: "input", mime: i.working!.mime, bytes: i.working!.bytes, name: i.name, file } : undefined;
}

/** What finds the uses of the material's files at once (the sources, images and tasks read once for the whole list). */
interface UsesIndex {
  tree: Tree;
  media: Map<string, Media[]>;
  byMedia: Map<string, Source[]>;
  byInput: Map<string, Source[]>;
  sources: Map<string, Source>;
  tasks: Map<string, Task[]>;
  /** The people citing each source: made once, when a file is the source of one. */
  citing?: Map<string, Set<string>>;
  /** The inputs of syncs from the app: their sources are not in the app's tree. */
  syncs?: Set<string>;
}

function usesIndex(tree: Tree): UsesIndex {
  const idx: UsesIndex = { tree, media: new Map(), byMedia: new Map(), byInput: new Map(), sources: new Map(), tasks: new Map() };
  const add = <T>(m: Map<string, T[]>, k: string, v: T) => {
    const got = m.get(k);
    if (!got) m.set(k, [v]);
    else if (!got.includes(v)) got.push(v);
  };
  // every image record of a long research (tens of thousands): read from the cache while their folder is as it was
  for (const m of mediaRecords(tree)) if (!m.retracted && m.sha) add(idx.media, m.sha, m);
  for (const s of tree.list<Source>("source")) {
    if (s.retracted) continue;
    idx.sources.set(s.id, s);
    for (const m of s.media ?? []) add(idx.byMedia, m, s);
    for (const c of s.clips ?? []) add(idx.byMedia, c.media, s);
    if (s.input) add(idx.byInput, s.input, s);
  }
  for (const t of tree.list<Task>("task"))
    if (!t.retracted && (t.state === "open" || t.state === "doing" || t.state === "parked" || t.state === "waiting")) for (const w of t.where) if (w.startsWith("I")) add(idx.tasks, w, t);
  return idx;
}

/** The people citing each source: their facts (a couple's: its partners) and names. */
function citingIndex(tree: Tree): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const cite = (source: string, who: string) => {
    let got = out.get(source);
    if (!got) out.set(source, (got = new Set()));
    got.add(live(tree, who));
  };
  for (const p of tree.list<Person>("person")) {
    if (p.retracted || p.mergedInto) continue;
    for (const e of p.events) if (!e.retracted) for (const c of e.citations) cite(c.source, p.id);
    for (const n of p.names) for (const c of n.citations ?? []) cite(c.source, p.id);
  }
  for (const f of tree.list<Family>("family")) {
    if (f.retracted) continue;
    const cited = [...f.events.filter((e) => !e.retracted).flatMap((e) => e.citations), ...(f.citations ?? [])];
    for (const c of cited) for (const p of f.partners) cite(c.source, p);
  }
  return out;
}

/** The sources a file is the source of (see SourceOf): made from it, cut out of an image of its content, with one. */
function sourcesOf(idx: UsesIndex, i: Input, images: Map<string, Media>): SourceOf[] {
  const via = new Map<string, SourceOf["via"]>();
  const rank = { input: 0, excerpt: 1, media: 2 } as const;
  const say = (s: Source | undefined, how: SourceOf["via"]) => {
    if (!s) return;
    const had = via.get(s.id);
    if (!had || rank[how] < rank[had]) via.set(s.id, how);
  };
  for (const s of idx.byInput.get(i.id) ?? []) say(s, "input");
  for (const id of [i.source, i.sorted?.source]) if (id) say(idx.sources.get(id), "input");
  for (const m of images.keys())
    for (const s of idx.byMedia.get(m) ?? []) say(s, (s.clips ?? []).some((c) => c.media === m) ? "excerpt" : "media");
  if (!via.size) return [];
  idx.citing ??= citingIndex(idx.tree);
  idx.syncs ??= new Set(idx.tree.list<Input & { sync?: unknown }>("input").filter((x) => x.sync).map((x) => x.id));
  return [...via]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, how]) => {
      const s = idx.sources.get(id)!;
      const cited = [...(idx.citing!.get(id) ?? [])].sort();
      return { source: id, via: how, title: s.title, cited: cited.slice(0, CITED_SHOWN), citedCount: cited.length, inTree: !(s.input && idx.syncs!.has(s.input)) };
    });
}

function usesFrom(idx: UsesIndex, i: Input): MaterialUses {
  const images = new Map<string, Media>();
  for (const sha of [i.sha, i.working?.sha]) for (const m of sha ? (idx.media.get(sha) ?? []) : []) images.set(m.id, m);
  const excerpts: MaterialUses["excerpts"] = [];
  const sources = new Map<string, Source>();
  const cut = (s: Source, m: Media | undefined) => excerpts.push({ source: s.id, ...((s.recordset ?? m?.recordset) ? { recordset: (s.recordset ?? m?.recordset)! } : {}), ...((s.folio ?? m?.page) ? { page: (s.folio ?? m?.page)! } : {}), sha: m?.sha ?? i.sha! });
  for (const s of [...images.keys()].flatMap((m) => idx.byMedia.get(m) ?? []).concat(idx.byInput.get(i.id) ?? [], idx.byMedia.get(i.id) ?? [])) {
    if (sources.has(s.id)) continue;
    sources.set(s.id, s);
    if (s.clips?.length) {
      for (const c of s.clips) if (images.has(c.media) || c.media === i.id) cut(s, images.get(c.media));
    } else if (s.input === i.id) cut(s, undefined);
  }
  for (const id of [i.source, i.sorted?.source]) {
    const s = id ? idx.sources.get(id) : undefined;
    if (s) sources.set(s.id, s);
  }
  const tasks = idx.tasks.get(i.id) ?? [];
  return {
    excerpts,
    sources: [...sources.values()].sort((a, b) => a.id.localeCompare(b.id)).map((s) => ({ id: s.id, title: s.title })),
    tasks: tasks.map((t) => ({ id: t.id, title: t.what, state: t.state })),
    of: sourcesOf(idx, i, images),
  };
}

/** Where the research uses one file of the material (GET /material/<I…>/uses); refused as assign refuses a file. */
export function materialUses(tree: Tree, id: string): MaterialUses {
  const i = filesAsked(tree, [id])[0]!;
  const houses = i.houses?.length ? houseRefs(tree, i.houses, () => houseIndex(tree)) : [];
  return { ...usesFrom(usesIndex(tree), i), ...(houses.length ? { houses } : {}) };
}

/** Why a file is hidden as the app is told it: its own record, else what sorting or an older skip left. */
function hiddenOf(i: Input): MaterialFile["hidden"] | undefined {
  if (i.state !== "skipped") {
    // a file of the app's tree with no place left in it: removed from the tree (by the user in the app, or here)
    if (!originOf(i) || !i.links?.length || inTree(i)) return undefined;
    return { at: i.links.reduce((a, l) => (l.retracted && l.retracted.at > a ? l.retracted.at : a), ""), by: "user", reason: "removed" };
  }
  if (i.hidden) return { at: i.hidden.at, by: i.hidden.by, ...(i.hidden.reason ? { reason: i.hidden.reason } : {}) };
  if (i.sorted?.as === "unrelated") return { at: i.sorted.at, by: i.sorted.by, reason: "unrelated" };
  return { at: i.updated, by: "research" };
}

/**
 * The family's files the research keeps (never the family trees sent, which are the research itself), oldest first —
 * hidden ones too, said so. `files: false`: only the batches (and the people's names), counted as with the files.
 */
export function material(tree: Tree, shared: string | undefined, only: { person?: string; batch?: string; ids?: string[]; files?: boolean; trees?: boolean } = {}): Material {
  const batches = listBatches(tree.root);
  const batchPersons = new Map(batches.map((b) => [b.id, [...new Set((b.persons ?? []).map((p) => live(tree, p)))]]));
  const person = only.person ? live(tree, only.person) : undefined;
  const ids = only.ids ? new Set(only.ids) : undefined;
  const files: MaterialFile[] = [];
  let idx: UsesIndex | undefined;
  const all = tree.list<Input & { sync?: unknown }>("input").filter((i) => isMaterial(i) || (!!only.trees && isTreeFile(i)));
  // the oldest file of each content: the others are the same as it
  const firstOf = new Map<string, Input>();
  for (const i of [...all].sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id))) if (!firstOf.has(i.sha!)) firstOf.set(i.sha!, i);
  let left: Map<string, NonNullable<MaterialFile["left"]>> | undefined;
  let index: HouseIndex | undefined;
  const houseIdx = () => (index ??= houseIndex(tree));
  for (const i of all) {
    if (ids && !ids.has(i.id)) continue;
    if (only.batch && i.batch !== only.batch) continue;
    const persons = materialPersons(tree, i);
    if (person && !persons.includes(person) && !(i.batch && batchPersons.get(i.batch)?.includes(person))) continue;
    const file = materialFile(tree, shared, i);
    const s = i.sorted;
    // what the user said in the app comes before what sorting found
    const kind = isTreeFile(i) ? ("tree" as const) : (i.materialKind ?? (s ? KIND_OF_SORT[s.as] : undefined));
    const hidden = hiddenOf(i);
    const links = (i.links ?? []).filter((l) => !l.retracted).map((l) => ({ type: l.type, ref: l.type === "person" || (l.type === "event" && l.ref.startsWith("P")) ? live(tree, l.ref) : l.ref, ...(l.event ? { event: l.event } : {}) }));
    const used = usesFrom((idx ??= usesIndex(tree)), i);
    const houses = i.houses?.length ? houseRefs(tree, i.houses, houseIdx) : [];
    files.push({
      id: i.id,
      name: i.name,
      ...(originOf(i) ? { origin: "app" as const, links } : {}),
      ...(i.title ? { title: i.title } : {}),
      ...(kind ? { kind } : {}),
      ...(i.date ? { date: i.date } : {}),
      sha: i.sha!,
      ...(i.mime ? { mime: i.mime } : {}),
      ...(typeof i.size === "number" ? { bytes: i.size } : {}),
      at: i.created,
      ...(i.from ? { from: i.from } : {}),
      persons,
      ...(i.batch ? { batch: i.batch } : {}),
      ...(i.path ? { path: i.path } : {}),
      ...(i.notes?.length ? { notes: i.notes.map((n) => ({ at: n.at, by: n.by, text: n.text })) } : {}),
      state: i.state,
      ...(s ? { sorted: { as: s.as, ...(s.persons?.length ? { persons: s.persons.map((p) => live(tree, p)) } : {}), ...(s.source ? { source: s.source } : {}), ...(s.reason ? { reason: s.reason } : {}) } } : {}),
      ...(i.source ? { source: i.source } : {}),
      ...(hidden ? { hidden } : {}),
      uses: { excerpts: used.excerpts.length, sources: used.sources.map((x) => x.id), tasks: used.tasks.length, of: used.of },
      ...((left ??= leftBySorts(tree)).has(i.id) ? { left: left.get(i.id)! } : {}),
      ...(firstOf.get(i.sha!)!.id !== i.id ? { sameAs: firstOf.get(i.sha!)!.id } : {}),
      ...(houses.length ? { houses } : {}),
      here: !!file && fs.existsSync(file),
    });
  }
  files.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const counted = new Map<string, number>();
  for (const f of files) if (f.batch) counted.set(f.batch, (counted.get(f.batch) ?? 0) + 1);
  const out = batches
    .filter((b) => counted.has(b.id))
    .map((b) => ({
      id: b.id,
      ...(b.name ? { name: b.name } : {}),
      at: b.created,
      ...(b.done ? { done: b.done } : {}),
      files: counted.get(b.id)!,
      persons: batchPersons.get(b.id) ?? [],
      ...(b.note ? { note: b.note } : {}),
    }));
  const shown = only.files === false ? [] : files;
  return { files: shown, batches: out, people: peopleOf(tree, [...shown.flatMap((f) => [...f.persons, ...(f.sorted?.persons ?? []), ...f.uses.of.flatMap((o) => o.cited)]), ...out.flatMap((b) => b.persons)]) };
}

/**
 * The files the agent left (MaterialFile.left), by the sorts kept here, oldest first: each file by the last sort done
 * that took it — left when the person decided of its proposal in the Strom app (accepted, refused: spec 147 K2), when it
 * proposed nothing of it for a reason of LEFT_WHY, when the file took over all it proposed (accepted, spec 147 K1); a
 * reader that ended without a word of it, or did not end well, or a proposal not taken (yet) leaves it to be sent again.
 */
export function leftBySorts(tree: Tree, sorts: SortState[] = listSorts(tree.root)): Map<string, NonNullable<MaterialFile["left"]>> {
  const out = new Map<string, NonNullable<MaterialFile["left"]>>();
  for (const s of sorts.filter((x) => x.state === "done").sort((a, b) => a.since.localeCompare(b.since) || a.id.localeCompare(b.id))) {
    for (const id of s.files) {
      const d = s.decided?.find((x) => x.id === id);
      const u = s.unproposed?.find((x) => x.id === id);
      const p = s.proposals?.find((x) => x.id === id);
      if (d && (LEFT_WHY as readonly string[]).includes(d.how)) out.set(id, { at: d.at, sort: s.id, why: d.how });
      else if (u && (LEFT_WHY as readonly string[]).includes(u.why)) out.set(id, { at: s.since, sort: s.id, why: u.why as (typeof LEFT_WHY)[number], ...(u.said ? { said: u.said } : {}) });
      else if (p && takenOver(tree, p)) out.set(id, { at: s.since, sort: s.id, why: "accepted" });
      else out.delete(id);
    }
  }
  return out;
}

/**
 * Whether a file took over what a sort proposed of it (spec 147 K1), as it is now: each of its title, kind and date the
 * same as proposed, each person proposed among its people — a proposal of no person too; one of a file not of the family:
 * the file hidden. A proposal of none of these (only a couple, an event, a source, a back) is never taken over by itself.
 */
function takenOver(tree: Tree, p: SortProposal): boolean {
  const i = tree.get<Input>(p.id);
  if (!i || i.type !== "input" || i.retracted) return false;
  if (p.unrelated) return i.state === "skipped";
  const persons = (p.links ?? []).filter((l) => l.type === "person").map((l) => live(tree, l.ref));
  if (p.title === undefined && p.kind === undefined && p.date === undefined && !persons.length) return false;
  if (p.title !== undefined && i.title !== p.title) return false;
  if (p.kind !== undefined && (i.materialKind ?? (i.sorted ? KIND_OF_SORT[i.sorted.as] : undefined)) !== p.kind) return false;
  if (p.date !== undefined && i.date !== p.date) return false;
  if (!persons.length) return true;
  const has = new Set(materialPersons(tree, i));
  return persons.every((x) => has.has(x));
}

/** The names of people as the research knows them, shortly with their years: for the app, which may not have them yet. */
export function peopleOf(tree: Tree, ids: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of [...new Set(ids)].sort()) {
    const p = tree.get<Person>(id);
    if (!p || p.type !== "person" || p.retracted) continue;
    const span = lifespan(p);
    out[id] = `${displayName(p) || id}${span ? ` (${span})` : ""}`;
  }
  return out;
}

/** A refusal of a write of the material, with the code the app says it by (the bridge's HTTP status: live.ts). */
function refused(code: "material.body" | "material.file" | "material.person" | "material.batch" | "material.date", message: string, params: Record<string, string> = {}): UsageError {
  return new UsageError(message, { code, params, hint: code === "material.body" ? "strom help input assign" : "strom input list — the files of the material; strom person list — its people" });
}

/** The files asked for, as they are now: each a file of the material (`trees`: a family tree's file too) — or the first that is not, refused. */
export function filesAsked(tree: Tree, ids: string[], how: { trees?: boolean } = {}): Input[] {
  if (!ids.length) throw refused("material.body", "give the files (I…)");
  if (ids.length > MATERIAL_MOST_FILES) throw refused("material.body", `at most ${MATERIAL_MOST_FILES} files at once`, { most: String(MATERIAL_MOST_FILES) });
  const out: Input[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = /^I\d{1,9}$/i.test(raw.trim()) ? normId(raw, "input") : undefined;
    if (!id) throw refused("material.body", `${raw.slice(0, 40)} is no file of the material (I…)`, { id: raw.slice(0, 40) });
    if (seen.has(id)) continue;
    seen.add(id);
    const i = tree.get<Input & { sync?: unknown }>(id);
    if (!i || i.type !== "input" || !(isMaterial(i) || (how.trees && isTreeFile(i)))) throw refused("material.file", `the research has no file ${id} of the material${i?.retracted ? " (taken back)" : ""}`, { id });
    out.push(i);
  }
  return out;
}

/** The people asked for, as the research knows them now (a duplicate merged away: the one it went into). */
function peopleAsked(tree: Tree, ids: string[]): string[] {
  if (ids.length > MATERIAL_MOST_PEOPLE) throw refused("material.body", `at most ${MATERIAL_MOST_PEOPLE} people at once`, { most: String(MATERIAL_MOST_PEOPLE) });
  return [
    ...new Set(
      ids.map((raw) => {
        const id = /^P\d{1,9}$/i.test(raw.trim()) ? normId(raw, "person") : undefined;
        if (!id) throw refused("material.body", `${raw.slice(0, 40)} is no person of the research (P…)`, { id: raw.slice(0, 40) });
        const now = live(tree, id);
        const p = tree.get<Person>(now);
        if (!p || p.type !== "person" || p.retracted) throw refused("material.person", `the research has no person ${id}${p?.retracted ? " (taken back)" : ""}`, { id });
        return now;
      }),
    ),
  ];
}

/** The tasks that hold a file now (to sort, to look at): open, begun, put aside or waiting. */
function holding(tree: Tree, id: string): Task[] {
  return tree.list<Task>("task").filter((t) => !t.retracted && t.where.includes(id) && (t.state === "open" || t.state === "doing" || t.state === "parked" || t.state === "waiting"));
}

/** The people the person took off a file (Input.declined), as they are now (one merged into another: that one). */
export function declinedOf(tree: Tree, i: Input): Set<string> {
  return new Set((i.declined ?? []).map((d) => live(tree, d.person)));
}

export interface AssignAsk {
  /** The files (I…), or a whole batch (its mark). */
  files?: string[];
  batch?: string;
  add: string[];
  remove: string[];
}

export interface Assigned {
  /** The files the write was of. */
  files: string[];
  /** Those it changed. */
  changed: string[];
  /** A person taken off a file who stays of it through its batch (the whole batch was said to be theirs). */
  kept: { id: string; person: string; batch: string }[];
  /** The batch whose people changed. */
  batch?: string;
}

/**
 * The people a file is of, added and taken off — of each file asked, or of a whole batch (its people and each of its
 * files). Checked whole first: a file or a person the research does not have, and nothing is written. Adding is
 * without a new task and without a file sorted already going back to new; a file that still waits, its task is of the
 * person too. Taken off a file, a person the whole batch is of stays (`kept`). The same again writes nothing. The
 * caller holds the tree lock and commits.
 */
export function assignMaterial(tree: Tree, ask: AssignAsk): Assigned {
  if (!ask.add.length && !ask.remove.length) throw refused("material.body", "give the people to add or to take off (P…)");
  const add = peopleAsked(tree, ask.add);
  const remove = peopleAsked(tree, ask.remove);
  const both = add.find((p) => remove.includes(p));
  if (both) throw refused("material.body", `${both} both added and taken off`, { id: both });
  let batch = ask.batch ? readBatch(tree.root, ask.batch) : undefined;
  if (ask.batch && !batch) throw refused("material.batch", `the research has no batch ${ask.batch.slice(0, 60)}`, { batch: ask.batch.slice(0, 60) });
  const files = batch ? batch.inputs.map((id) => tree.get<Input & { sync?: unknown }>(id)).filter((i): i is Input => !!i && i.type === "input" && isMaterial(i)) : filesAsked(tree, ask.files ?? []);
  const batchPersons = new Map<string, string[]>();
  const personsOfBatch = (id: string) => {
    if (!batchPersons.has(id)) batchPersons.set(id, (readBatch(tree.root, id)?.persons ?? []).map((p) => live(tree, p)));
    return batchPersons.get(id)!;
  };
  const out: Assigned = { files: files.map((i) => i.id), changed: [], kept: [], ...(batch ? { batch: batch.id } : {}) };
  const tasks = new Map<string, Set<string>>();
  const at = new Date().toISOString();
  let order: Map<string, number> | undefined;
  /** The next place of a person's files in the app's tree (after the last one they have). */
  const nextOrder = (p: string): number => {
    if (!order) {
      order = new Map();
      for (const x of tree.list<Input>("input"))
        for (const l of x.retracted ? [] : (x.links ?? [])) if (!l.retracted && l.type === "person") order.set(l.ref, Math.max(order.get(l.ref) ?? -1, l.order));
    }
    const n = (order.get(p) ?? -1) + 1;
    order.set(p, n);
    return n;
  };
  for (const i of files) {
    const mine = (i.persons ?? []).map((p) => live(tree, p));
    const sorted = (i.sorted?.persons ?? []).map((p) => live(tree, p));
    // a file in the app's tree (spec 102 M4, V1): a person added is a place of the file at them (the app gets it as
    // their attachment); taken off, their places (theirs and their events') are taken off, as the user removed them
    const placed = !batch && inTree(i);
    const linked = linkedPersons(tree, i);
    // a whole batch's people are the batch's: a file of it gets none of its own
    const adding = batch ? [] : add.filter((p) => !mine.includes(p) && !sorted.includes(p) && !linked.includes(p));
    const taking = remove.filter((p) => mine.includes(p) || sorted.includes(p) || linked.includes(p));
    if (!batch && i.batch) for (const p of remove) if (personsOfBatch(i.batch).includes(p)) out.kept.push({ id: i.id, person: p, batch: i.batch });
    // taken off: kept so nothing puts them back (sorting, input sort, intake --person); added back: the mark goes
    const declined = declinedOf(tree, i);
    const undeclining = add.filter((p) => declined.has(p));
    if (!adding.length && !taking.length && !undeclining.length) continue;
    update<Input>(
      tree,
      i.id,
      "input",
      (x) => {
        const persons = [...new Set([...mine.filter((p) => !taking.includes(p)), ...(placed ? [] : adding)])];
        const next: Input = { ...x, persons };
        if (!persons.length) delete next.persons;
        if (x.sorted) {
          const left = sorted.filter((p) => !taking.includes(p));
          next.sorted = { ...x.sorted, ...(left.length ? { persons: left } : {}) };
          if (!left.length) delete next.sorted.persons;
        }
        if (x.links?.length && taking.length)
          next.links = x.links.map((l) =>
            !l.retracted && (l.type === "person" || l.type === "event") && taking.includes(live(tree, l.ref)) ? { ...l, retracted: { at, reason: "removed" as const } } : l,
          );
        if (placed && adding.length) next.links = [...(next.links ?? []), ...adding.map((p) => ({ type: "person" as const, ref: p, order: nextOrder(p), at }))];
        const still = (x.declined ?? []).filter((d) => !add.includes(live(tree, d.person)) && !taking.includes(live(tree, d.person)));
        const marks = [...still, ...taking.map((p) => ({ person: p, at, by: tree.actor }))];
        if (marks.length) next.declined = marks;
        else delete next.declined;
        return next;
      },
      { op: "input.assign", summary: `${i.id}: ${[adding.length ? `+ ${adding.join(", ")}` : "", taking.length ? `− ${taking.join(", ")}` : "", undeclining.filter((p) => !adding.includes(p)).length ? `${undeclining.filter((p) => !adding.includes(p)).join(", ")} no longer taken off` : ""].filter(Boolean).join(", ")}`, targets: [...new Set([...adding, ...taking, ...undeclining])] },
    );
    out.changed.push(i.id);
    // a file that still waits: the task at it is of the people added too
    if (adding.length && i.state === "new") for (const t of holding(tree, i.id)) tasks.set(t.id, new Set([...(tasks.get(t.id) ?? []), ...adding]));
  }
  for (const [id, more] of tasks)
    update<Task>(tree, id, "task", (t) => ({ ...t, subject: [...new Set([...t.subject, ...more])] }), { op: "task.edit", summary: `${id}: of ${[...more].join(", ")} too (the material)`, targets: [...more] });
  if (batch) {
    const had = personsOfBatch(batch.id);
    const persons = [...new Set([...had.filter((p) => !remove.includes(p)), ...add])];
    if (persons.length !== had.length || persons.some((p) => !had.includes(p))) {
      const plus = persons.filter((p) => !had.includes(p));
      const minus = had.filter((p) => !persons.includes(p));
      // the batch is kept in .strom (its people with it): said in the history as a write of its own
      tree.appendOp({ op: "batch.assign", targets: [...plus, ...minus], files: [], summary: `the batch ${batch.name ?? batch.id}: ${[plus.length ? `+ ${plus.join(", ")}` : "", minus.length ? `− ${minus.join(", ")}` : ""].filter(Boolean).join(", ")}` });
      batch = { ...batch, updated: new Date().toISOString(), ...(persons.length ? { persons } : {}) };
      if (!persons.length) delete batch.persons;
      if (!tree.dryRun) writeBatch(tree.root, batch);
      out.changed.push(batch.id);
    }
  }
  return out;
}

export interface Hidden {
  files: string[];
  changed: string[];
  /** Tasks given up or narrowed (the file hidden), or made (a file shown again that waits for nobody). */
  tasks: string[];
}

/**
 * Files hidden from the family's material: skipped, the state each had kept to give back; a task holding one lets it
 * go (given up when nothing else is left of it), so nobody sorts it. Nothing is deleted. Hidden again with another
 * reason: the reason changes. The caller holds the tree lock and commits.
 */
export function hideMaterial(tree: Tree, ids: string[], o: { reason?: (typeof HIDE_REASONS)[number] | undefined; by: string }): Hidden {
  const files = filesAsked(tree, ids);
  const out: Hidden = { files: files.map((i) => i.id), changed: [], tasks: [] };
  const at = new Date().toISOString();
  const gone: string[] = [];
  for (const i of files) {
    if (i.state === "skipped") {
      const now = hiddenOf(i);
      if ((now?.reason ?? undefined) === o.reason) continue;
      update<Input>(tree, i.id, "input", (x) => ({ ...x, hidden: { at, by: o.by, ...(o.reason ? { reason: o.reason } : {}), was: x.hidden?.was ?? (x.source ? "processed" : "new") } }), { op: "input.hide", summary: `${i.id} hidden${o.reason ? ` (${o.reason})` : ""}` });
    } else {
      update<Input>(tree, i.id, "input", (x) => ({ ...x, state: "skipped", hidden: { at, by: o.by, ...(o.reason ? { reason: o.reason } : {}), was: x.state === "processed" ? "processed" : "new" } }), { op: "input.hide", summary: `${i.id} hidden${o.reason ? ` (${o.reason})` : ""}` });
      gone.push(i.id);
    }
    out.changed.push(i.id);
  }
  out.tasks = letGo(tree, gone);
  return out;
}

/** The tasks holding these files let them go: narrowed, or given up when none of their files is left (hidden, or deleted for good). */
export function letGo(tree: Tree, ids: string[], why: "hidden" | "deleted" = "hidden"): string[] {
  if (!ids.length) return [];
  const set = new Set(ids);
  const out: string[] = [];
  for (const t of tree.list<Task>("task")) {
    if (t.retracted || !t.where.some((w) => set.has(w)) || !(t.state === "open" || t.state === "doing" || t.state === "parked" || t.state === "waiting")) continue;
    const where = t.where.filter((w) => !set.has(w));
    const which = t.where.filter((w) => set.has(w));
    if (where.some((w) => w.startsWith("I")))
      update<Task>(tree, t.id, "task", (x) => ({ ...x, where, subject: x.subject.filter((s) => !set.has(s)) }), { op: "task.edit", summary: `${t.id}: without ${which.join(", ")} (${why === "hidden" ? "hidden" : "deleted for good"})` });
    else
      update<Task>(
        tree,
        t.id,
        "task",
        (x) => {
          const next: Task = { ...x, state: "dropped" };
          delete next.parkedUntil;
          delete next.parkedReason;
          delete next.heldBy;
          delete next.heldFrom;
          return next;
        },
        { op: "task.drop", summary: `${t.id} dropped: its files ${why === "hidden" ? "hidden" : "deleted for good"} (${which.join(", ")})`, reason: `the files of the material it was of are ${why === "hidden" ? "hidden" : "deleted for good"}` },
      );
    out.push(t.id);
  }
  return out;
}

/**
 * Hidden files shown again: each the state it had before (new, or processed when a source was made of it); one that
 * waits again and that no task holds gets one with auto (intake.auto on; in an archive put aside), else it waits. Sorted as nothing of the family, that sorting
 * goes (the history keeps it). A file of the app's tree removed from it (spec 102 M3, V5): the places the last write
 * took off come back, and the app's next file of the tree has it again. A file not hidden: nothing. The caller holds
 * the tree lock and commits.
 */
export function unhideMaterial(tree: Tree, ids: string[], o: { auto?: boolean } = {}): Hidden {
  const files = filesAsked(tree, ids);
  const out: Hidden = { files: files.map((i) => i.id), changed: [], tasks: [] };
  for (const i of files) {
    if (i.state !== "skipped") {
      if (originOf(i) && !inTree(i) && restoreTakenOff(tree, i.id, "shown again in the family's material")?.length) out.changed.push(i.id);
      continue;
    }
    const state = i.hidden?.was ?? (i.source ? "processed" : "new");
    const next = update<Input>(
      tree,
      i.id,
      "input",
      (x) => {
        const n: Input = { ...x, state };
        delete n.hidden;
        if (n.sorted?.as === "unrelated") delete n.sorted;
        return n;
      },
      { op: "input.unskip", summary: `${i.id} shown again (${state})` },
    );
    out.changed.push(i.id);
    // an intake task only where the person turned intake.auto on (spec 130 K1.3): else it waits in the material
    if (o.auto && state === "new" && !holding(tree, i.id).length) out.tasks.push(gatherTask(tree, next, next.persons ?? []));
  }
  return out;
}

export interface EditAsk {
  /** A title, a kind, a date — "" takes it off; none: as it is. */
  title?: string | undefined;
  kind?: string | undefined;
  date?: string | undefined;
}

export interface Edited {
  files: string[];
  changed: string[];
  /** What each file changed had before, of the values asked ("" — none): the same edit with them takes it back. */
  was: Record<string, { title?: string; kind?: string; date?: string }>;
  /** A title with a character that could not be read (U+FFFD): written as it came, said. */
  warnings?: { code: "material.unreadable"; params: { field: "title" } }[];
}

/** A lone half of a UTF-16 surrogate pair: text that cannot be kept as it came. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

/**
 * An edit asked of the material's files checked before anything is written: the values as they are kept (a title in
 * NFC, its spaces as one, at most MATERIAL_TITLE_MAX characters; a kind of MATERIAL_KINDS; a GEDCOM date) — the first
 * that is none, refused (material.body, material.date).
 */
export function checkEdit(ask: EditAsk): { title?: string; kind?: (typeof MATERIAL_KINDS)[number] | ""; date?: string } {
  if (ask.title === undefined && ask.kind === undefined && ask.date === undefined) throw refused("material.body", "give a title, a kind or a date (\"\" takes it off)");
  const out: ReturnType<typeof checkEdit> = {};
  if (ask.title !== undefined) {
    if (LONE_SURROGATE.test(ask.title)) throw refused("material.body", "the title has half of a character (a lone surrogate): send it whole", { field: "title" });
    const title = ask.title.replace(/[\p{Cc}]/gu, " ").replace(/\s+/gu, " ").trim().normalize("NFC");
    if ([...title].length > MATERIAL_TITLE_MAX) throw refused("material.body", `the title is longer than ${MATERIAL_TITLE_MAX} characters`, { field: "title", most: String(MATERIAL_TITLE_MAX) });
    out.title = title;
  }
  if (ask.kind !== undefined) {
    const kind = ask.kind.trim();
    if (kind && !(MATERIAL_KINDS as readonly string[]).includes(kind)) throw refused("material.body", `the kind: ${MATERIAL_KINDS.join(", ")} (or "" to take it off)`, { field: "kind" });
    out.kind = kind as (typeof MATERIAL_KINDS)[number] | "";
  }
  if (ask.date !== undefined) {
    const raw = ask.date.normalize("NFC").trim();
    const date = raw ? normalizeDate(raw) : "";
    if (date === undefined) throw refused("material.date", `"${raw.slice(0, 40)}" is no date (GEDCOM: 1932, ABT 1930, 12 MAY 1932)`, { date: raw.slice(0, 40) });
    out.date = date;
  }
  return out;
}

/**
 * The title, kind and date of files of the material (spec 102 M5, V11) — of the research's material and of the app's
 * tree alike (its next file of the tree has them). Checked whole first: a file the research does not have, a value it
 * cannot keep, and nothing is written. A title given is marked whose it is (titled: the user's, or the research's); "" takes
 * a value off. The same again writes nothing. The caller holds the tree lock and commits.
 */
export function editMaterial(tree: Tree, ids: string[], ask: EditAsk, by: string): Edited {
  if (ids.length > MATERIAL_MOST_EDIT) throw refused("material.body", `at most ${MATERIAL_MOST_EDIT} files at once`, { most: String(MATERIAL_MOST_EDIT) });
  const v = checkEdit(ask);
  const files = filesAsked(tree, ids);
  const out: Edited = { files: files.map((i) => i.id), changed: [], was: {} };
  if (v.title?.includes("\uFFFD")) out.warnings = [{ code: "material.unreadable", params: { field: "title" } }];
  const at = new Date().toISOString();
  for (const i of files) {
    const was: Edited["was"][string] = {};
    const said: string[] = [];
    if (v.title !== undefined && (i.title ?? "") !== v.title) {
      was.title = i.title ?? "";
      said.push(v.title ? `title "${v.title.slice(0, 60)}"` : "no title");
    }
    if (v.kind !== undefined && (i.materialKind ?? "") !== v.kind) {
      was.kind = i.materialKind ?? "";
      said.push(v.kind ? `kind ${v.kind}` : "no kind");
    }
    if (v.date !== undefined && (i.date ?? "") !== v.date) {
      was.date = i.date ?? "";
      said.push(v.date ? `date ${v.date}` : "no date");
    }
    if (!said.length) continue;
    update<Input>(
      tree,
      i.id,
      "input",
      (x) => {
        const next: Input = { ...x };
        if (was.title !== undefined) {
          if (v.title) Object.assign(next, { title: v.title, titled: { by: by === "user" || by === "app" ? "user" : "research", at } });
          else {
            delete next.title;
            delete next.titled;
          }
        }
        if (was.kind !== undefined) {
          if (v.kind) next.materialKind = v.kind;
          else delete next.materialKind;
        }
        if (was.date !== undefined) {
          if (v.date) next.date = v.date;
          else delete next.date;
        }
        return next;
      },
      { op: "input.edit", summary: `${i.id}: ${said.join(", ")}` },
    );
    out.changed.push(i.id);
    out.was[i.id] = was;
  }
  return out;
}

/**
 * What a write of the app's asks, checked against the research as it is now before a strom of its own writes it (the
 * bridge): the first file, person or batch it does not have refused as strom input assign|hide would refuse it.
 */
export function checkAsked(tree: Tree, ask: { files?: string[]; batch?: string; add?: string[]; remove?: string[] }): void {
  if (ask.batch !== undefined) {
    if (!readBatch(tree.root, ask.batch)) throw refused("material.batch", `the research has no batch ${ask.batch.slice(0, 60)}`, { batch: ask.batch.slice(0, 60) });
  } else filesAsked(tree, ask.files ?? []);
  const add = peopleAsked(tree, ask.add ?? []);
  const remove = peopleAsked(tree, ask.remove ?? []);
  const both = add.find((p) => remove.includes(p));
  if (both) throw refused("material.body", `${both} both added and taken off`, { id: both });
}
