// A file of the family's material deleted for good (spec 102 K1.17, V3): what it takes with it said first, whole
// (deleteImpacts), then done (deleteMaterial) — the person's alone, asked in the Strom app (POST <token>/material/delete,
// a dry run and its confirmation, signed by the bridge) or in the terminal (strom input delete). An agent never does it.
//
// The record of the file is taken back (retracted, "deleted"), its places in the app's tree with it ("removed"); a
// source made of it keeps its text and citations, only its link to the file goes. The bytes go only when nothing else
// keeps the same content: another file of this research (sameAs) or another research of this computer, which shares
// the store of originals (otherResearch). Only then do the source images of the same content and their excerpts go too
// (a source loses the image, never its text). What a task held lets the file go as when it is hidden. The history
// (git) keeps the record; the bytes stay only in a backup or a pack made before.
//
// A family tree's file too (spec 117 K2.1–K2.3): deleted as the material is — unless a source made of it stands
// (blockedBy, 409 material.source-live): then only with that source deleted in the same step (retractSources,
// core/sourceretract.ts), one confirmation over both. Everything is checked first, the sources deleted, the files taken
// back, written — and only then do the bytes go (R7: the caller removes them after its commit).

import fs from "node:fs";
import path from "node:path";
import { UsageError } from "./errors.ts";
import type { Input, Media, Person, Source, Task } from "./model.ts";
import { filesAsked, isTreeFile, letGo, live, materialFile, materialPersons, MATERIAL_MOST_EDIT } from "./material.ts";
import { deletedSource, retractImpacts, retractSources, type SourceImpacts } from "./sourceretract.ts";
import { mediaRecords } from "./mediaindex.ts";
import { update } from "./records.ts";
import { sha256, signRecord, verifyRecord } from "./seal.ts";
import { THUMB_SIZES, thumbPath } from "./thumbs.ts";
import { workingRel } from "./treemedia.ts";
import { Settings } from "./config.ts";
import { knownTreesIn, Tree } from "./tree.ts";
import { canonicalize } from "./json.ts";

/** How many files one deletion takes. */
export const DELETE_MOST_FILES = MATERIAL_MOST_EDIT;

/** How long the bridge's confirmation of a dry run holds (the person read the list and says yes in the app). */
export const DELETE_CONFIRM_MS = 15 * 60_000;

/** What deleting one file does. */
export interface DeleteImpact {
  id: string;
  name: string;
  sha: string;
  /** The sources the file is of: made of it (input), an excerpt on an image of its content (excerpt), its image (media). */
  sources: { id: string; title: string; via: "input" | "excerpt" | "media"; citedCount: number }[];
  /** The excerpts of sources on images of its content (they go only with the bytes). */
  excerpts: number;
  /** The people it is of. */
  people: string[];
  /** Its places in the app's tree (they are taken off). */
  links: number;
  /** The tasks that hold it (narrowed, or given up when nothing else is left of them). */
  tasks: string[];
  /** Whether its bytes go: kept when another file of the research (sameAs) or another research has the same content. */
  bytes: "deleted" | "kept";
  keptWhy?: "sameAs" | "otherResearch";
  sameAs?: string[];
  /** A family tree's file: the sources made of it that stand — it is deleted only with them (spec 117 K2.2). */
  blockedBy?: string[];
}

export interface Deleted {
  files: string[];
  deleted: string[];
  impacts: DeleteImpact[];
  /** Tasks narrowed or given up. */
  tasks: string[];
  /** The sources that lost their link to a file deleted (their text and citations stay). */
  unlinked: { source: string; file: string }[];
  /** The sources that lost images of a content deleted (and their excerpts on them). */
  images: { source: string; images: string[] }[];
  /** The sources deleted with the files (retractSources), and what each took. */
  retracted?: string[];
  sourceImpacts?: SourceImpacts[];
  /** The bytes of the files deleted, removed from the disk: by the caller, after its commit (R7). */
  removeBytes: () => void;
}

const ACTIVE: readonly Task["state"][] = ["open", "doing", "parked", "waiting"];

/** The files asked to be deleted, as they are now: 1–500 files of the material, else refused before anything. */
function deleteAsked(tree: Tree, ids: string[]): Input[] {
  if (ids.length > DELETE_MOST_FILES) throw new UsageError(`at most ${DELETE_MOST_FILES} files at once`, { code: "material.body", params: { most: String(DELETE_MOST_FILES) }, hint: "strom help input delete" });
  return filesAsked(tree, ids, { trees: true });
}

/** The contents of a file: its own, and its working copy's (the picture the app shows of it). */
const shasOf = (i: Input): string[] => [...new Set([i.sha, i.working?.sha].filter((s): s is string => !!s))];

/** Whether another research of this computer keeps any of these contents (they share the store): read once a call. */
function otherResearchKeeps(tree: Tree): (shas: string[]) => boolean {
  let held: Set<string> | undefined;
  let unread = false;
  const read = (): Set<string> => {
    if (held) return held;
    held = new Set();
    const settings = new Settings(tree.env, {});
    const real = (p: string) => {
      try {
        return fs.realpathSync(p);
      } catch {
        return path.resolve(p);
      }
    };
    const here = real(tree.root);
    let known: ReturnType<typeof knownTreesIn> = [];
    try {
      known = knownTreesIn(settings.trees()?.value, settings.config.extraTrees ?? []);
    } catch {
      known = [];
    }
    // a copy of this research in another folder is another research here: its files keep the content too
    for (const t of known) {
      if (real(t.root) === here) continue;
      try {
        const other = Tree.open(t.root, tree.env);
        for (const i of other.list<Input>("input")) if (!i.retracted) for (const s of shasOf(i)) held.add(s);
        for (const m of mediaRecords(other)) if (!m.retracted && m.sha) held.add(m.sha);
      } catch {
        // a research that cannot be read here (a newer strom's): it may keep anything, so nothing is deleted
        unread = true;
      }
    }
    return held;
  };
  return (shas) => {
    const h = read();
    return unread || shas.some((s) => h.has(s));
  };
}

interface Index {
  imagesBySha: Map<string, Media[]>;
  sources: Source[];
  cited: Map<string, number>;
  liveInputs: Input[];
}

function indexOf(tree: Tree): Index {
  const imagesBySha = new Map<string, Media[]>();
  for (const m of mediaRecords(tree)) {
    if (m.retracted || !m.sha) continue;
    const got = imagesBySha.get(m.sha);
    if (got) got.push(m);
    else imagesBySha.set(m.sha, [m]);
  }
  const sources = tree.list<Source>("source").filter((s) => !s.retracted);
  // the people whose facts or names cite each source (a duplicate merged away counts as the one it went into)
  const citing = new Map<string, Set<string>>();
  for (const p of tree.list<Person>("person")) {
    if (p.retracted) continue;
    const who = live(tree, p.id);
    const cites = (id: string) => {
      const set = citing.get(id) ?? new Set<string>();
      set.add(who);
      citing.set(id, set);
    };
    for (const e of p.events) if (!e.retracted) for (const c of e.citations) cites(c.source);
    for (const n of p.names) for (const c of n.citations ?? []) cites(c.source);
  }
  const cited = new Map([...citing].map(([id, set]) => [id, set.size]));
  const liveInputs = tree.list<Input>("input").filter((i) => !i.retracted);
  return { imagesBySha, sources, cited, liveInputs };
}

function impactOf(tree: Tree, idx: Index, i: Input, asked: Set<string>, others: (shas: string[]) => boolean): DeleteImpact {
  const shas = shasOf(i);
  const images = new Set(shas.flatMap((s) => idx.imagesBySha.get(s) ?? []).map((m) => m.id));
  const sources: DeleteImpact["sources"] = [];
  let excerpts = 0;
  for (const s of idx.sources) {
    const clips = (s.clips ?? []).filter((c) => images.has(c.media)).length;
    excerpts += clips;
    const via: DeleteImpact["sources"][number]["via"] | undefined =
      s.input === i.id || i.source === s.id || i.sorted?.source === s.id ? "input" : clips ? "excerpt" : (s.media ?? []).some((m) => images.has(m)) ? "media" : undefined;
    if (via) sources.push({ id: s.id, title: s.title, via, citedCount: idx.cited.get(s.id) ?? 0 });
  }
  sources.sort((a, b) => a.id.localeCompare(b.id));
  const sameAs = idx.liveInputs
    .filter((x) => x.id !== i.id && !asked.has(x.id) && shasOf(x).some((s) => shas.includes(s)))
    .map((x) => x.id)
    .sort();
  const tasks = tree
    .list<Task>("task")
    .filter((t) => !t.retracted && ACTIVE.includes(t.state) && t.where.includes(i.id))
    .map((t) => t.id)
    .sort();
  const keptWhy = sameAs.length ? "sameAs" : others(shas) ? "otherResearch" : undefined;
  // a family tree's file a source standing was made of (source.input, input.source): never deleted without it (K2.2)
  const blockedBy = isTreeFile(i) ? idx.sources.filter((s) => s.input === i.id || i.source === s.id).map((s) => s.id).sort() : [];
  return {
    id: i.id,
    name: i.name,
    sha: i.sha!,
    sources,
    excerpts,
    people: materialPersons(tree, i).sort(),
    links: (i.links ?? []).filter((l) => !l.retracted).length,
    tasks,
    bytes: keptWhy ? "kept" : "deleted",
    ...(keptWhy ? { keptWhy } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(blockedBy.length ? { blockedBy } : {}),
  };
}

/**
 * What deleting these files would do, each said whole (in the order asked): checked first — a file that is no file of
 * the material (material.file), more than 500 or none (material.body) refused. Reads only.
 */
export function deleteImpacts(tree: Tree, _shared: string | undefined, ids: string[]): DeleteImpact[] {
  const files = deleteAsked(tree, ids);
  const idx = indexOf(tree);
  const asked = new Set(files.map((i) => i.id));
  const others = otherResearchKeeps(tree);
  return files.map((i) => impactOf(tree, idx, i, asked, others));
}

/**
 * The sources standing that a family tree's file was made of and that are not deleted with it: refused, 409
 * material.source-live {sources} (spec 117 K2.2) — the person deletes the source with the file (retractSources).
 */
export function refuseLiveSources(impacts: DeleteImpact[], retracting: string[] = []): void {
  const with_ = new Set(retracting);
  const live = [...new Set(impacts.flatMap((i) => i.blockedBy ?? []))].filter((s) => !with_.has(s)).sort();
  if (live.length)
    throw new UsageError(`a source of the research was made of the file and stands (${live.join(", ")}): the file goes only with it — nothing deleted`, {
      code: "material.source-live",
      params: { sources: live.join(",") },
      hint: `the person deletes the source with it: strom input delete <I…> --retract-sources ${live.join(",")}`,
    });
}

/**
 * The sources asked to be deleted with the files: only those made of them (blockedBy) — any other is deleted on its
 * own (strom source retract), never by deleting a file: refused before anything, material.body.
 */
export function checkRetractWith(impacts: DeleteImpact[], retracting: string[]): void {
  const of = new Set(impacts.flatMap((i) => i.blockedBy ?? []));
  const other = retracting.filter((s) => !of.has(s));
  if (other.length)
    throw new UsageError(`not a source made of the files given (${other.join(", ")}): only those are deleted with them — nothing deleted`, {
      code: "material.body",
      params: { sources: other.join(",") },
      hint: "strom input delete <I…> --dry-run — impacts[].blockedBy; another source: strom source retract (the person's)",
    });
}

/** What deleting the sources with the files would take (strom input delete --retract-sources --dry-run): nothing written. */
export function deleteSourceImpacts(tree: Tree, sources: string[]): SourceImpacts[] {
  return sources.length ? retractImpacts(tree, sources) : [];
}

/**
 * The files deleted for good, as deleteImpacts says (checked whole first: nothing is written when one is refused) —
 * with the sources given (`retractSources`) deleted first (spec 117 K2.2): a family tree's file with a source standing
 * that is not among them refused (material.source-live). The caller holds the tree lock, commits, and only then
 * removes the bytes (`removeBytes`, R7); a dry run of the tree deletes nothing on the disk.
 */
export function deleteMaterial(tree: Tree, shared: string | undefined, ids: string[], by: string, how: { retractSources?: string[]; via?: "bridge" | "terminal" } = {}): Deleted {
  const files = deleteAsked(tree, ids);
  const impacts = deleteImpacts(tree, shared, ids);
  const asked = how.retractSources ?? [];
  checkRetractWith(impacts, asked);
  refuseLiveSources(impacts, asked);
  // the sources first, checked whole by core/sourceretract.ts (unknown, deleted already: refused before anything)
  const retracted = asked.length ? retractSources(tree, asked, how.via ? { via: how.via } : {}) : undefined;
  const at = new Date().toISOString();
  const why = by === "app" || by === "user" ? "deleted for good by the user" : `deleted for good (${by})`;
  const gone: string[] = [];
  const images = new Set<string>();
  const unlinked: Deleted["unlinked"] = [];
  const lostImages: Deleted["images"] = [];
  for (const [n, i] of files.entries()) {
    const impact = impacts[n]!;
    update<Input>(
      tree,
      i.id,
      "input",
      (x) => ({
        ...x,
        retracted: { at, reason: "deleted" },
        ...(x.links?.length ? { links: x.links.map((l) => (l.retracted ? l : { ...l, retracted: { at, reason: "removed" as const } })) } : {}),
      }),
      { op: "input.delete", summary: `${i.id} deleted for good ("${i.name.slice(0, 50)}")${impact.bytes === "kept" ? `, its content kept (${impact.keptWhy})` : ""}`, reason: why },
    );
    // a source made of it keeps its text and citations: only its link to the file goes — a source the person deleted
    // too (R8: restored, it is without the file)
    for (const s of tree.list<Source>("source")) {
      if (s.input !== i.id || (s.retracted && !deletedSource(s))) continue;
      update<Source>(
        tree,
        s.id,
        "source",
        (x) => {
          const next = { ...x };
          delete next.input;
          return next;
        },
        { op: "source.edit", summary: `${s.id} without its file ${i.id} (deleted for good)` },
      );
      unlinked.push({ source: s.id, file: i.id });
    }
    if (impact.bytes === "deleted") {
      gone.push(i.id);
      const shas = shasOf(i);
      for (const m of mediaRecords(tree)) if (!m.retracted && shas.includes(m.sha)) images.add(m.id);
    }
  }
  // the images of a content that goes, and the excerpts on them: a source loses the image, never its text
  if (images.size) {
    for (const s of tree.list<Source>("source")) {
      if (s.retracted) continue;
      const media = (s.media ?? []).filter((m) => !images.has(m));
      const clips = (s.clips ?? []).filter((c) => !images.has(c.media));
      if (media.length === (s.media ?? []).length && clips.length === (s.clips ?? []).length) continue;
      const lost = [...new Set([...(s.media ?? []), ...(s.clips ?? []).map((c) => c.media)].filter((m) => images.has(m)))].sort();
      lostImages.push({ source: s.id, images: lost });
      update<Source>(
        tree,
        s.id,
        "source",
        (x) => {
          const next = { ...x, media, clips };
          if (!media.length) delete (next as Partial<Source>).media;
          if (!clips.length) delete (next as Partial<Source>).clips;
          return next;
        },
        { op: "source.edit", summary: `${s.id} without the images ${lost.join(", ")} (their file deleted for good)` },
      );
    }
    for (const id of [...images].sort())
      update<Media>(tree, id, "media", (x) => ({ ...x, retracted: { at, reason: "deleted" } }), { op: "media.retract", summary: `${id} retracted: its file deleted for good`, reason: why });
  }
  const tasks = letGo(tree, files.map((i) => i.id), "deleted");
  const goFiles = files.filter((i) => gone.includes(i.id));
  const goImages = [...images].map((id) => tree.get<Media>(id)!).filter(Boolean);
  // the research's own files go with the commit (its history keeps them: a write that fails puts them back)
  if (!tree.dryRun) removeBytes(tree, shared, goFiles, goImages, "own");
  return {
    files: files.map((i) => i.id),
    deleted: files.map((i) => i.id),
    impacts,
    tasks,
    unlinked,
    images: lostImages,
    ...(retracted ? { retracted: retracted.retracted, sourceImpacts: retracted.impacts } : {}),
    removeBytes: () => {
      if (!tree.dryRun) removeBytes(tree, shared, goFiles, goImages, "rest");
    },
  };
}

/** The files on the disk: the original (shared store or inputs/), its working copy, the images of it, their previews. */
/** The bytes removed: the research's own (inputs/, kept by its history: removed before the commit, committed with it) or the rest (the shared store, previews: after it, R7). */
function removeBytes(tree: Tree, shared: string | undefined, files: Input[], images: Media[], which: "own" | "rest"): void {
  const paths = new Set<string>();
  const shas = new Set<string>();
  // never a path that leaves its folder (a record says where its file is)
  const within = (dir: string, file: string): void => {
    if (path.resolve(file).startsWith(path.resolve(dir) + path.sep)) paths.add(file);
  };
  for (const i of files) {
    const own = i.file ? materialFile(tree, shared, i) : undefined;
    const inTree = i.file?.startsWith("inputs/") ?? false;
    if (own && inTree === (which === "own")) within(inTree ? path.join(tree.root, "inputs") : shared!, own);
    if (which === "own") continue;
    if (shared && i.working) within(shared, path.join(shared, workingRel(shared, i.working)));
    for (const s of shasOf(i)) shas.add(s);
  }
  if (shared && which === "rest") for (const m of images) within(shared, path.join(shared, m.file));
  for (const sha of shas) for (const px of THUMB_SIZES) paths.add(thumbPath(tree.root, sha, px));
  for (const p of paths) {
    try {
      // the research's own: what a command that fails afterwards puts back (its rollback), as any file it wrote
      if (which === "own") tree.remember(p);
      fs.rmSync(p, { force: true });
    } catch {
      // a file that cannot be removed now (held by another program): its record is gone, strom tidy finds it later
    }
  }
}

const CONFIRM_KIND = "material.delete";

/** The sources deleted with the files and what they take (spec 117 K2.2): one confirmation over both. */
export interface WithSources {
  sources: string[];
  impacts: SourceImpacts[];
}

/** The mark of a list of impacts (what the person saw): its hash — with the sources' impacts when they go with the files. */
const markOf = (impacts: DeleteImpact[], sources?: WithSources): string =>
  sha256(JSON.stringify(canonicalize(sources?.sources.length ? { impacts, sourceImpacts: sources.impacts } : impacts))).slice(0, 32);
/** What the signature is over: the files, the mark, when — and the sources deleted with them. */
const signed = (files: string[], mark: string, at: number, sources?: WithSources) => ({ files, impacts: mark, at, ...(sources?.sources.length ? { sources: sources.sources } : {}) });

/**
 * The bridge's confirmation of a dry run (POST /material/delete {dryRun: true}): signed with the research's seal key
 * over the files, the impacts the person was shown and when — "<ms>.<mark>.<signature>"; with the sources deleted with
 * them (retractSources), over those and their impacts too. Only a strom of this computer makes one; an agent of the
 * research has no key.
 */
export function deleteConfirm(key: Buffer, files: string[], impacts: DeleteImpact[], at = Date.now(), sources?: WithSources): string {
  const mark = markOf(impacts, sources);
  return `${at}.${mark}.${signRecord(key, CONFIRM_KIND, signed(files, mark, at, sources))}`;
}

/**
 * A confirmation checked against the impacts now: `ok`; `changed` — signed, but the research changed since the person
 * saw it (material.delete-changed); `invalid` — none, not signed here, or older than 15 minutes (material.body).
 */
export function checkDeleteConfirm(key: Buffer | undefined, files: string[], impacts: DeleteImpact[], token: unknown, now = Date.now(), sources?: WithSources): "ok" | "changed" | "invalid" {
  if (!key || typeof token !== "string" || token.length > 200) return "invalid";
  const m = /^(\d{1,15})\.([0-9a-f]{32})\.([0-9a-f]{64})$/u.exec(token);
  if (!m) return "invalid";
  const at = Number(m[1]);
  if (!(at <= now + 60_000 && now - at <= DELETE_CONFIRM_MS)) return "invalid";
  if (!verifyRecord(key, CONFIRM_KIND, signed(files, m[2]!, at, sources), m[3])) return "invalid";
  return m[2] === markOf(impacts, sources) ? "ok" : "changed";
}
