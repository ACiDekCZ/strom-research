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

import fs from "node:fs";
import path from "node:path";
import { UsageError } from "./errors.ts";
import type { Input, Media, Person, Source, Task } from "./model.ts";
import { filesAsked, letGo, live, materialFile, materialPersons, MATERIAL_MOST_EDIT } from "./material.ts";
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
}

const ACTIVE: readonly Task["state"][] = ["open", "doing", "parked", "waiting"];

/** The files asked to be deleted, as they are now: 1–500 files of the material, else refused before anything. */
function deleteAsked(tree: Tree, ids: string[]): Input[] {
  if (ids.length > DELETE_MOST_FILES) throw new UsageError(`at most ${DELETE_MOST_FILES} files at once`, { code: "material.body", params: { most: String(DELETE_MOST_FILES) }, hint: "strom help input delete" });
  return filesAsked(tree, ids);
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
 * The files deleted for good, as deleteImpacts says (checked whole first: nothing is written when one is refused).
 * The caller holds the tree lock and commits; a dry run of the tree deletes nothing on the disk.
 */
export function deleteMaterial(tree: Tree, shared: string | undefined, ids: string[], by: string): Deleted {
  const files = deleteAsked(tree, ids);
  const impacts = deleteImpacts(tree, shared, ids);
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
    // a source made of it keeps its text and citations: only its link to the file goes
    for (const s of tree.list<Source>("source")) {
      if (s.retracted || s.input !== i.id) continue;
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
  if (!tree.dryRun) removeBytes(tree, shared, files.filter((i) => gone.includes(i.id)), [...images].map((id) => tree.get<Media>(id)!).filter(Boolean));
  return { files: files.map((i) => i.id), deleted: files.map((i) => i.id), impacts, tasks, unlinked, images: lostImages };
}

/** The files on the disk: the original (shared store or inputs/), its working copy, the images of it, their previews. */
function removeBytes(tree: Tree, shared: string | undefined, files: Input[], images: Media[]): void {
  const paths = new Set<string>();
  const shas = new Set<string>();
  // never a path that leaves its folder (a record says where its file is)
  const within = (dir: string, file: string): void => {
    if (path.resolve(file).startsWith(path.resolve(dir) + path.sep)) paths.add(file);
  };
  for (const i of files) {
    const own = i.file ? materialFile(tree, shared, i) : undefined;
    if (own) within(i.file!.startsWith("inputs/") ? path.join(tree.root, "inputs") : shared!, own);
    if (shared && i.working) within(shared, path.join(shared, workingRel(shared, i.working)));
    for (const s of shasOf(i)) shas.add(s);
  }
  if (shared) for (const m of images) within(shared, path.join(shared, m.file));
  for (const sha of shas) for (const px of THUMB_SIZES) paths.add(thumbPath(tree.root, sha, px));
  for (const p of paths) {
    try {
      fs.rmSync(p, { force: true });
    } catch {
      // a file that cannot be removed now (held by another program): its record is gone, strom tidy finds it later
    }
  }
}

const CONFIRM_KIND = "material.delete";

/** The mark of a list of impacts (what the person saw): its hash. */
const markOf = (impacts: DeleteImpact[]): string => sha256(JSON.stringify(canonicalize(impacts))).slice(0, 32);

/**
 * The bridge's confirmation of a dry run (POST /material/delete {dryRun: true}): signed with the research's seal key
 * over the files, the impacts the person was shown and when — "<ms>.<mark>.<signature>". Only a strom of this computer
 * makes one; an agent of the research has no key.
 */
export function deleteConfirm(key: Buffer, files: string[], impacts: DeleteImpact[], at = Date.now()): string {
  const mark = markOf(impacts);
  return `${at}.${mark}.${signRecord(key, CONFIRM_KIND, { files, impacts: mark, at })}`;
}

/**
 * A confirmation checked against the impacts now: `ok`; `changed` — signed, but the research changed since the person
 * saw it (material.delete-changed); `invalid` — none, not signed here, or older than 15 minutes (material.body).
 */
export function checkDeleteConfirm(key: Buffer | undefined, files: string[], impacts: DeleteImpact[], token: unknown, now = Date.now()): "ok" | "changed" | "invalid" {
  if (!key || typeof token !== "string" || token.length > 200) return "invalid";
  const m = /^(\d{1,15})\.([0-9a-f]{32})\.([0-9a-f]{64})$/u.exec(token);
  if (!m) return "invalid";
  const at = Number(m[1]);
  if (!(at <= now + 60_000 && now - at <= DELETE_CONFIRM_MS)) return "invalid";
  if (!verifyRecord(key, CONFIRM_KIND, { files, impacts: m[2], at }, m[3])) return "invalid";
  return m[2] === markOf(impacts) ? "ok" : "changed";
}
