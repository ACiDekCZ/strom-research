// The files of the material that are in the Strom app's tree (spec 108, the research's answer, "Návrat"): each record
// with a place not taken back goes to the app in its tree's file (GET /tree.ged?images=ref&media=app) at each place, as
// the app sent it — a person's portrait first, a couple's photo first, then the attachments in their order; a file of an
// event under its event; one of a source too under its person or couple (2 _SOUR), one of a source alone at the source.
// What the app is given of a record is its working copy (or the file itself, an image the app can show of at most 2 MB),
// read from the shared store or the research's own inputs/; else only its name and its original's hash (originalOnly). The bridge gives those bytes
// (POST /images, GET /image/<sha>) — only of records in the tree, never another file of the shared store.

import fs from "node:fs";
import path from "node:path";
import { extOfMime, storeRel } from "./appmedia.ts";
import { formatOf, imageSize } from "../image/index.ts";
import { writeFileAtomic } from "./json.ts";
import type { Input, MediaLink } from "./model.ts";

/** One file at a place of the tree: its record, a portrait or a couple's photo, the sources it belongs to as well. */
export interface TreeMediaItem {
  rec: Input;
  /** A person's portrait (_STROM_KIND photo) or a couple's photo (first at its family). */
  first?: true;
  /** The sources (S…) it belongs to as well: 2 _SOUR under its person's or couple's OBJE. */
  sources: string[];
}

/** The files of the tree by where they go: a person's, a couple's, an event's, a source's (each in its order). */
export interface TreeMediaPlaces {
  persons: Map<string, TreeMediaItem[]>;
  families: Map<string, TreeMediaItem[]>;
  events: Map<string, TreeMediaItem[]>;
  sources: Map<string, TreeMediaItem[]>;
}

/** What the app is given of a record: its working copy or its file (an image it shows), read from the shared store. */
export interface ServedCopy {
  sha: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  /** The file: in the shared store, or the research's own (inputs/). */
  file: string;
}

/** The types of a file the app shows as it is (anything else it gets as its working copy, or by its name alone). */
const SHOWN = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
/** The largest file of its own the app is given as it is (beyond it: originalOnly, as the app sends such a file). */
export const SHOWN_MAX_BYTES = 2 * 1024 * 1024;
const MIME_OF_FORMAT: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };

/** A record in the tree: one place of it not taken back. */
export const inTree = (rec: Input): boolean => !rec.retracted && (rec.links ?? []).some((l) => !l.retracted);

/** A record of a person, family or source: the one it was merged into (a person), none when it is gone. */
type Lookup = (id: string) => { retracted?: unknown; mergedInto?: string } | undefined;
function live(id: string, get: Lookup): string | undefined {
  let at = id;
  let rec = get(at);
  for (let hops = 0; rec?.mergedInto && hops < 10; hops++) rec = get((at = rec.mergedInto));
  return rec && !rec.retracted ? at : undefined;
}

/**
 * Where each record in the tree goes (spec 108 §2/§3): a person's portrait and a couple's photo first, then the
 * attachments by their order (and when they came); an event's under its event; a source's with a person or a couple
 * as _SOUR under it, else at the source.
 */
export function treeMedia(inputs: readonly Input[], get: Lookup): TreeMediaPlaces {
  const out: TreeMediaPlaces = { persons: new Map(), families: new Map(), events: new Map(), sources: new Map() };
  type Placed = TreeMediaItem & { order: number; at: string };
  const placed = new Map<Map<string, TreeMediaItem[]>, Map<string, Placed[]>>();
  const put = (where: Map<string, TreeMediaItem[]>, key: string, item: Placed) => {
    const by = placed.get(where) ?? placed.set(where, new Map()).get(where)!;
    const list = by.get(key) ?? by.set(key, []).get(key)!;
    // one record once at a place (two links of it to one person after a merge)
    if (!list.some((x) => x.rec === item.rec)) list.push(item);
  };
  for (const rec of inputs) {
    if (!inTree(rec)) continue;
    const links = (rec.links ?? []).filter((l) => !l.retracted);
    const sources = [...new Set(links.filter((l) => l.type === "source").map((l) => live(l.ref, get)).filter((s): s is string => !!s))];
    const holds = links.some((l) => l.type === "person" || l.type === "family");
    const item = (l: MediaLink, extra: Partial<TreeMediaItem> = {}): Placed => ({ rec, sources: [], order: l.order, at: l.at, ...extra });
    for (const l of links) {
      if (l.type === "person" || l.type === "personPortrait") {
        const p = live(l.ref, get);
        if (p) put(out.persons, p, item(l, l.type === "personPortrait" ? { first: true } : { sources }));
      } else if (l.type === "family" || l.type === "familyPhoto") {
        const f = live(l.ref, get);
        if (f) put(out.families, f, item(l, l.type === "familyPhoto" ? { first: true } : { sources }));
      } else if (l.type === "event" && l.event) put(out.events, l.event, item(l));
      else if (l.type === "source" && !holds) {
        const s = live(l.ref, get);
        if (s) put(out.sources, s, item(l));
      }
    }
  }
  for (const [where, by] of placed)
    for (const [key, list] of by) {
      list.sort((a, b) => (a.first ? 0 : 1) - (b.first ? 0 : 1) || a.order - b.order || a.at.localeCompare(b.at));
      where.set(key, list.map(({ order: _o, at: _a, ...rest }) => rest));
    }
  return out;
}

/** The file of these bytes in the shared store: where appmedia keeps them, else any extension under their hash. */
function storedFile(shared: string, sha: string, mime: string | undefined): string | undefined {
  const guess = path.join(shared, storeRel(sha, extOfMime(mime)));
  if (fs.existsSync(guess)) return guess;
  const dir = path.join(shared, "media", sha.slice(0, 2), sha.slice(2, 4));
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return undefined;
  }
  const name = names.find((n) => n.startsWith(`${sha}.`) && !n.endsWith(".part") && !n.endsWith(".tmp"));
  return name ? path.join(dir, name) : undefined;
}

/** Where a working copy is in the shared store, relative to it ("media/ab/cd/<sha>.jpg"): found there, else where appmedia keeps it. */
export function workingRel(shared: string | undefined, w: { sha: string; mime: string }): string {
  const found = shared ? storedFile(shared, w.sha, w.mime) : undefined;
  return found ? path.relative(shared!, found).split(path.sep).join("/") : storeRel(w.sha, extOfMime(w.mime));
}

/** A file inside a folder (never a path that leaves it). */
const within = (dir: string, file: string): string | undefined => (path.resolve(file).startsWith(path.resolve(dir) + path.sep) ? file : undefined);

/** The file of a record: in the shared store (media:…) or the research's own (inputs/…, held in git) — never outside them. */
function ownFile(root: string, shared: string | undefined, rec: Input): string | undefined {
  const at = rec.file;
  if (!at) return undefined;
  if (at.startsWith("media:")) return shared ? within(shared, path.join(shared, at.slice("media:".length))) : undefined;
  if (path.isAbsolute(at) || !/^inputs[\\/]/u.test(at)) return undefined;
  return within(path.join(root, "inputs"), path.join(root, at));
}

/**
 * What the app is given of a record (spec 108): its working copy; else its own file, an image the app shows of at most
 * 2 MB — whether the shared store keeps it or the research holds it in git (inputs/); else nothing (originalOnly: its
 * name and its original's hash).
 */
export function servedCopy(root: string, shared: string | undefined, rec: Input): ServedCopy | undefined {
  if (rec.working) {
    const file = shared ? storedFile(shared, rec.working.sha, rec.working.mime) : undefined;
    if (file) return { sha: rec.working.sha, mime: rec.working.mime, bytes: rec.working.bytes, ...(rec.working.width ? { width: rec.working.width, height: rec.working.height! } : {}), file };
    return undefined;
  }
  if (!rec.sha) return undefined;
  const file = ownFile(root, shared, rec);
  if (!file) return undefined;
  let size: number;
  try {
    size = fs.statSync(file).size;
  } catch {
    return undefined;
  }
  if (size > SHOWN_MAX_BYTES) return undefined;
  if (rec.mime && !SHOWN.has(rec.mime.toLowerCase())) return undefined;
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(file);
  } catch {
    return undefined;
  }
  const mime = MIME_OF_FORMAT[formatOf(bytes)];
  if (!mime) return undefined;
  const dims = imageSize(bytes);
  return { sha: rec.sha, mime, bytes: bytes.length, ...(dims ? dims : {}), file };
}

/** The records of the material (data/inputs), read as they are on disk. */
function inputsOf(root: string): Input[] {
  const dir = path.join(root, "data", "inputs");
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out: Input[] = [];
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(dir, n), "utf8")) as Input;
      if (rec?.type === "input") out.push(rec);
    } catch {
      // half written or not a record: not given
    }
  }
  return out;
}

const served = new Map<string, { key: string; index: Map<string, { file: string; mime: string }> }>();

/**
 * The bytes the bridge gives of the records in the tree by their hash (POST /images, GET /image/<sha>): what the app is
 * given of each (servedCopy) — nothing else of the shared store or the research. Made again when the material changes.
 */
export function treeMediaFile(root: string, shared: string | undefined, sha: string): { file: string; mime: string } | undefined {
  const dir = path.join(root, "data", "inputs");
  const stat = fs.statSync(dir, { throwIfNoEntry: false });
  if (!stat) return undefined;
  const key = `${stat.mtimeMs}|${shared ?? ""}`;
  let had = served.get(root);
  if (had?.key !== key) {
    const index = new Map<string, { file: string; mime: string }>();
    for (const rec of inputsOf(root)) {
      if (!inTree(rec)) continue;
      const copy = servedCopy(root, shared, rec);
      if (copy) index.set(copy.sha, { file: copy.file, mime: copy.mime });
    }
    served.set(root, (had = { key, index }));
  }
  return had.index.get(sha);
}

/** The heads the bridge gave the app with the files of its tree (media=app): the base a send's files are compared with. */
const MEDIA_HEADS_KEPT = 500;
const mediaHeadsFile = (root: string) => path.join(root, ".strom", "sync", "media-heads.json");

function mediaHeads(root: string): { head: string; at: string }[] {
  try {
    const got = JSON.parse(fs.readFileSync(mediaHeadsFile(root), "utf8")) as { heads?: unknown };
    return Array.isArray(got?.heads) ? got.heads.filter((h): h is { head: string; at: string } => !!h && typeof h.head === "string" && typeof h.at === "string") : [];
  } catch {
    return [];
  }
}

/** The bridge gave the app the tree of this head with its files (media=app): kept (the last 500), written whole. */
export function markServedWithMedia(root: string, head: string, at = new Date()): void {
  if (!head) return;
  const heads = mediaHeads(root).filter((h) => h.head !== head);
  heads.push({ head, at: at.toISOString() });
  writeFileAtomic(mediaHeadsFile(root), `${JSON.stringify({ heads: heads.slice(-MEDIA_HEADS_KEPT) }, null, 1)}\n`);
}

/** Did the bridge give the app the tree of this head with its files (media=app)? */
export function servedWithMedia(root: string, head: string): boolean {
  return !!head && mediaHeads(root).some((h) => h.head === head);
}
