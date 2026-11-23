// The files of the Strom app's tree a send brings (its OBJE): a person's portrait and attachments, a couple's photo and
// attachments, an event's, a source's. Each file is one record of the material (data/inputs, spec 108 P1): known by
// its original's hash (_STROM_SHA, the original came by PUT /media) or else by the hash of the bytes the send carries;
// those bytes — the working copy the app shows — are kept exactly as they came in the shared store, under their own
// hash, while the file is read (P8): one image in memory at a time, a hash kept already never written again.
// Spec 133: a file the research has may come by reference instead (_STROM_DATA <sha> where FILE data:… would be — the
// same file as if those bytes had come), and the research's excerpt with no FILE at all (its data is never read).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { MATERIAL_KINDS, type Input } from "./model.ts";
import { sharedMediaPath } from "./media.ts";
import { recordsBySha } from "./shaindex.ts";
import type { Tree } from "./tree.ts";
import { importDate } from "./import.ts";
import { formatOf, imageSize } from "../image/index.ts";
import { children, val, type GedNode } from "../gedcom/parse.ts";

/** One file of the app's tree, as a send carries it (the same file at several places: one). */
export interface SMediaFile {
  /** The record's key: the original's hash, else the hash of the bytes the send carries. */
  key: string;
  /** The original's hash (_STROM_SHA): the research keeps it (PUT /media) or will. */
  original?: string;
  /** The bytes the send carries (FILE, a data URL), as they came — none: only the original (originalOnly). */
  working?: { sha: string; mime: string; bytes: number; width?: number; height?: number; ext: string };
  /** The file's name (_STROM_NAME, else TITL). */
  name?: string;
  /** Its title, the user's: TITL beside _STROM_NAME (TITL alone is the file's name, no title). */
  title?: string;
  /** What it is (3 TYPE under FORM): photo, document, record, other. */
  kind?: (typeof MATERIAL_KINDS)[number];
  /** When it was made or written (_DATE), a GEDCOM date. */
  date?: string;
  /** Its note (NOTE). */
  note?: string;
  /** The original's EXIF orientation (_STROM_ORIENT). */
  orient?: number;
  /** FORM: jpeg, png, pdf … (a file of the original only says no more of what it is). */
  form?: string;
  /** A character of its name, title or note could not be read (U+FFFD, half a pair): kept as it came, said. */
  garbled?: true;
}

/** A fact a file is of, as the file has it: enough to find the research's event again. */
export interface MediaFact {
  kind: string;
  date?: string;
  place?: string;
  value?: string;
  label?: string;
  /** The research's event the app was given (_STROM_EID). */
  eid?: string;
}

/** A place of a file in the app's tree, kept with whom it is of (a person, a family, a source of the snapshot). */
export interface SMediaPlace {
  /** The file (SMediaFile.key). */
  file: string;
  /** Its order among the files of the place. */
  order: number;
  /** A person's portrait (_STROM_KIND photo). */
  portrait?: true;
  /** A couple's photo (the one marked _PRIM Y; where none of the family's files says _PRIM, its first image). */
  photo?: true;
  /** An event's: the fact as the file has it. */
  fact?: MediaFact;
  /** The sources the file belongs to as well (2 _SOUR under a person's OBJE): their keys in the snapshot. */
  sources?: string[];
}

/** A file of a send that could not be read (its data URL): said, never written (media.unreadable). */
export interface MediaUnreadable {
  name: string;
  person?: string;
  family?: string[];
  source?: string;
}

/** The file of an original-only record, a working copy: where in the shared store its bytes are (media/ab/cd/<sha><ext>). */
export const storeRel = (sha: string, ext: string) => `media/${sha.slice(0, 2)}/${sha.slice(2, 4)}/${sha}${ext.toLowerCase()}`;

const SHA = /^[0-9a-f]{64}$/;

/** A type of file the app sends (a data URL's, FORM's) → the extension its bytes are kept with. */
const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/tiff": ".tif",
  "image/heic": ".heic",
  "image/heif": ".heic",
  "image/bmp": ".bmp",
  "application/pdf": ".pdf",
};
const BY_FORMAT: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", tiff: "image/tiff", heic: "image/heic", pdf: "application/pdf" };
const FORMS: Record<string, string> = { jpeg: "image/jpeg", jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", tif: "image/tiff", tiff: "image/tiff", heic: "image/heic", heif: "image/heic", bmp: "image/bmp", pdf: "application/pdf" };

/** The extension the bytes of a working copy of this type are kept with in the shared store (appmedia's own guess). */
export const extOfMime = (mime: string | undefined) => (mime ? EXT[mime.toLowerCase()] : undefined) ?? ".bin";

/** The type a FORM names (jpeg, png, pdf …): none for a word it does not know. */
export const mimeOfForm = (form: string | undefined) => (form ? FORMS[form.trim().toLowerCase()] : undefined);

/** A character that could not be read: the replacement character, half of a pair. */
const garbledText = (t: string | undefined) => !!t && (/\uFFFD/u.test(t) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(t));

/** Text from the app as strom keeps it (NFC); a character the app could not carry is said, never quietly taken for another. */
function text(s: string | undefined, what: string, problems: string[]): string | undefined {
  const t = s?.normalize("NFC").trim();
  if (!t) return undefined;
  if (garbledText(t)) problems.push(`${what} "${t.slice(0, 60)}": a character of it could not be read — kept as it came`);
  return t;
}

/** The bytes of a data URL; undefined when it is none that can be read (no base64, nothing in it). */
export function dataUrlBytes(value: string): { mime?: string; bytes: Buffer } | undefined {
  const comma = value.indexOf(",");
  if (!/^data:/i.test(value) || comma < 0) return undefined;
  const head = value.slice(5, comma).split(";").map((x) => x.trim().toLowerCase());
  if (!head.slice(1).includes("base64")) return undefined;
  const payload = value.slice(comma + 1).replace(/[\s\r\n]+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!payload || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return undefined;
  const bytes = Buffer.from(payload, "base64");
  if (!bytes.length) return undefined;
  return { ...(head[0] ? { mime: head[0] } : {}), bytes };
}

type Working = NonNullable<SMediaFile["working"]>;

/** A working copy as its bytes make it: the type its data URL says (else its content's, else FORM's), its size, its extension. */
function workingOfBytes(sha: string, bytes: Uint8Array, said: string | undefined, form: string | undefined): Working {
  const format = formatOf(bytes);
  const mime = (said && said !== "application/octet-stream" ? said : undefined) ?? BY_FORMAT[format] ?? mimeOfForm(form) ?? "application/octet-stream";
  const ext = EXT[mime] ?? (BY_FORMAT[format] ? EXT[BY_FORMAT[format]!] : undefined) ?? ".bin";
  const size = mime.startsWith("image/") ? imageSize(bytes) : undefined;
  return { sha, mime, bytes: bytes.length, ...(size ? size : {}), ext };
}

/** The file of these bytes in the shared store (media/ab/cd/<sha>.<any extension>), never one half written. */
export function storedBytes(store: string, sha: string): string | undefined {
  if (!SHA.test(sha)) return undefined;
  const dir = path.dirname(sharedMediaPath(store, sha, ""));
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return undefined;
  }
  const name = names.find((n) => n.startsWith(`${sha}.`) && !n.endsWith(".part") && !n.endsWith(".tmp"));
  return name ? path.join(dir, name) : undefined;
}

/**
 * The bytes of a file a send names by its hash (_STROM_DATA, spec 133): in the shared store (a working copy, an image, an
 * original that came by PUT /media), else the research's own file of that content (inputs/, held in git) — the same
 * places POST /media/known answers from. None: the research does not have it.
 */
export function mediaRefFile(tree: Tree | undefined, store: string | undefined, sha: string): string | undefined {
  const inStore = store ? storedBytes(store, sha) : undefined;
  if (inStore || !tree) return inStore;
  // a file deleted for good (core/materialdelete.ts) is none
  const own = recordsBySha<Input>(tree, "input", sha).find((x) => x.file?.startsWith("inputs/") && x.retracted?.reason !== "deleted");
  const file = own ? path.join(tree.root, own.file!) : undefined;
  return file && fs.existsSync(file) ? file : undefined;
}

/** What a reader makes of a file named by its hash: its working copy as the bytes would have made it (none: not found). */
export type MediaResolve = (sha: string, form: string | undefined) => Working | undefined;

/** The working copy of a file named by its hash, from the bytes the research has of it (the shared store, its own files). */
export function mediaResolver(tree: Tree | undefined, store: string | undefined): MediaResolve {
  return (sha, form) => {
    const file = mediaRefFile(tree, store, sha);
    if (!file) return undefined;
    try {
      // the type FORM says stands where the data URL's would (the app writes FORM from it)
      return workingOfBytes(sha, fs.readFileSync(file), mimeOfForm(form), form);
    } catch {
      return undefined;
    }
  };
}

/** Bytes kept in the shared store under their hash: never written again when there; written whole or not at all. */
export function keepBytes(store: string, sha: string, ext: string, bytes: Uint8Array): string {
  const dest = sharedMediaPath(store, sha, ext);
  if (fs.existsSync(dest)) return dest;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const part = `${dest}.${process.pid}.part`;
  fs.writeFileSync(part, bytes);
  fs.renameSync(part, dest);
  return dest;
}

/**
 * The files of a send's OBJE, read one at a time: each a key (the record it is), the bytes kept in `store` when given.
 * The same file at many places (inline again and again, or one `0 @M1@ OBJE` its places point at) is one file; what a
 * place says that another of the same file did not is added to it.
 */
export class MediaReader {
  files = new Map<string, SMediaFile>();
  problems: string[];
  private objects: Map<string, GedNode>;
  private store: string | undefined;
  private resolve: MediaResolve | undefined;
  private note: (n: GedNode) => string;
  /** Read already (the bytes of a data URL hashed once: the same text of it is the same file). */
  private seen = new Map<string, SMediaFile["working"] | null>();

  /**
   * `store`: the shared store the bytes a send carries are kept in (and a file named by its hash is found in); `resolve`:
   * how a file named by its hash is found otherwise (the research's own files). Neither: a read that keeps nothing (the
   * plan) — a file named by its hash is the file of that hash, as the send says it.
   */
  constructor(records: GedNode[], o: { store?: string | undefined; resolve?: MediaResolve | undefined; problems: string[]; note: (n: GedNode) => string }) {
    this.objects = new Map(records.filter((r) => r.tag === "OBJE" && r.xref).map((r) => [r.xref!, r]));
    this.store = o.store;
    this.resolve = o.resolve;
    this.problems = o.problems;
    this.note = o.note;
  }

  /** One OBJE: the file it is — an excerpt of the research, a file of no data and no original: none; one of no bytes that can be read: unreadable. */
  read(node: GedNode): { key: string; prim?: boolean; portrait: boolean; image: boolean; sources: string[] } | { unreadable: string } | undefined {
    const ref = node.value.trim();
    const rec = /^@[^@]+@$/.test(ref) ? this.objects.get(ref) : undefined;
    if (/^@[^@]+@$/.test(ref) && !rec) return undefined;
    const holders = [node, ...(rec ? [rec] : [])];
    const fileNode = holders.map((h) => h.children.find((c) => c.tag === "FILE")).find((x) => !!x);
    // what the OBJE says, else its record (0 @M1@ OBJE), else under its FILE (GEDCOM 5.5.1's record has FORM, TITL there)
    const field = (tag: string) => holders.map((h) => val(h, tag)).find((x) => x !== undefined) ?? val(fileNode, tag);
    const nodeOf = (tag: string) => holders.map((h) => h.children.find((c) => c.tag === tag)).find((x) => !!x) ?? fileNode?.children.find((c) => c.tag === tag);
    if (field("_STROM_KIND")?.toLowerCase() === "excerpt") return undefined;
    const value = fileNode?.value.trim() ?? "";
    const original = field("_STROM_SHA")?.toLowerCase();
    const strName = text(field("_STROM_NAME"), "the name of a file", this.problems);
    const titl = text(field("TITL"), "the title of a file", this.problems);
    const shownName = strName ?? titl ?? (value && !/^data:/i.test(value) ? path.basename(value.replace(/\\/g, "/")).normalize("NFC") : undefined);
    const formNode = nodeOf("FORM");
    const form = formNode?.value.trim().toLowerCase() || undefined;
    let working: SMediaFile["working"];
    // the bytes by reference (spec 133): the hash of the data URL's bytes the research has, where FILE data:… would be
    const byRef = !/^data:/i.test(value) ? field("_STROM_DATA")?.trim().toLowerCase() : undefined;
    if (/^data:/i.test(value)) {
      const known = this.seen.get(value);
      if (known === null) return { unreadable: shownName ?? "?" };
      working = known;
      if (!working) {
        const got = dataUrlBytes(value);
        if (!got) {
          this.seen.set(value, null);
          return { unreadable: shownName ?? "?" };
        }
        const sha = crypto.createHash("sha256").update(got.bytes).digest("hex");
        working = workingOfBytes(sha, got.bytes, got.mime, form);
        if (this.store) keepBytes(this.store, sha, working.ext, got.bytes);
        this.seen.set(value, working);
      }
    } else if (byRef && SHA.test(byRef)) {
      // the original sent as it is: nothing more to find (as its bytes would be: no working copy of its own)
      if (byRef !== original) {
        const at = `ref:${byRef}`;
        const known = this.seen.get(at);
        if (known === null) return { unreadable: shownName ?? "?" };
        working = known;
        if (!working) {
          // a reader that keeps files finds them (none found: said, never a record of bytes nobody has); one that keeps
          // nothing takes the file as the send names it — its hash, the type FORM says — the same key, record and places
          const mime = mimeOfForm(form) ?? "application/octet-stream";
          working = this.resolve ? this.resolve(byRef, form) : this.store ? mediaResolver(undefined, this.store)(byRef, form) : { sha: byRef, mime, bytes: 0, ext: EXT[mime] ?? ".bin" };
          this.seen.set(at, working ?? null);
          if (!working) return { unreadable: shownName ?? "?" };
        }
      }
    } else if (byRef) return { unreadable: shownName ?? "?" };
    else if (!original || !SHA.test(original)) return undefined;
    const orig = original && SHA.test(original) ? original : undefined;
    const key = orig ?? working?.sha ?? byRef!;
    const typeWord = val(formNode, "TYPE")?.toLowerCase();
    const kind = (MATERIAL_KINDS as readonly string[]).includes(typeWord ?? "") ? (typeWord as SMediaFile["kind"]) : undefined;
    const rawDate = field("_DATE")?.normalize("NFC");
    const date = rawDate ? (importDate(rawDate) ?? rawDate) : undefined;
    const noteText = text(holders.flatMap((h) => children(h, "NOTE")).map(this.note).map((t) => t.trim()).filter(Boolean)[0], "the note of a file", this.problems);
    const o = Number.parseInt(field("_STROM_ORIENT") ?? "", 10);
    const one: SMediaFile = {
      key,
      ...(orig ? { original: orig } : {}),
      // the original sent as it is: no working copy of its own
      ...(working && working.sha !== orig ? { working } : {}),
      ...(shownName ? { name: shownName } : {}),
      ...(strName && titl ? { title: titl } : {}),
      ...(kind ? { kind } : {}),
      ...(date ? { date } : {}),
      ...(noteText ? { note: noteText } : {}),
      ...(o >= 1 && o <= 8 ? { orient: o } : {}),
      ...(form ? { form } : {}),
      ...([strName, titl, noteText].some(garbledText) ? { garbled: true as const } : {}),
    };
    const had = this.files.get(key);
    if (!had) this.files.set(key, one);
    else for (const [k, v] of Object.entries(one)) if ((had as unknown as Record<string, unknown>)[k] === undefined) (had as unknown as Record<string, unknown>)[k] = v;
    const mime = working?.mime ?? mimeOfForm(form);
    // _PRIM Y: the couple's photo, N: one of its attachments; none said: undefined (an older app)
    const prim = field("_PRIM")?.trim();
    return {
      key,
      ...(prim ? { prim: /^y(es)?$/i.test(prim) } : {}),
      portrait: field("_STROM_KIND")?.toLowerCase() === "photo",
      image: !!mime?.startsWith("image/"),
      sources: holders.flatMap((h) => children(h, "_SOUR")).map((s) => s.value.trim()).filter((x) => /^@[^@]+@$/.test(x)),
    };
  }
}

/** The record of the material a file of the app is: by its original's hash or the bytes' — the file's own or its working copy's (V1). */
export function recordOfFile(inputs: readonly Input[], f: Pick<SMediaFile, "original" | "working" | "key">): Input | undefined {
  const shas = [f.original, f.working?.sha, f.key].filter((x): x is string => !!x);
  const live = inputs.filter((i) => !i.retracted && i.kind !== "tree");
  for (const sha of shas) {
    const hit = live.find((i) => i.sha === sha) ?? live.find((i) => i.working?.sha === sha);
    if (hit) return hit;
  }
  return undefined;
}

/** What a send carries of its files (spec 133): the bridge's check before anything is written, and its log. */
export interface MediaRefCheck {
  /** The hashes of files named by reference (_STROM_DATA) the research cannot find, at most MEDIA_REF_UNKNOWN_MAX. */
  unknown: string[];
  /** OBJE that name their bytes by reference (_STROM_DATA). */
  dataRefs: number;
  /** The research's excerpts with no FILE (their data is never read: never unknown). */
  excerptsWithoutFile: number;
  /** OBJE that carry their bytes (FILE data:…). */
  withData: number;
}

/** How many unknown hashes a refusal names (409 sync.media-ref-unknown). */
export const MEDIA_REF_UNKNOWN_MAX = 50;

/**
 * The OBJE of a send's text, line by line (no GEDCOM tree built: a send of 100 MB is mostly its data): how many name
 * their bytes by reference, are excerpts without FILE, carry their data — and the hashes named, in their order.
 */
export function mediaRefsOf(text: string): Omit<MediaRefCheck, "unknown"> & { refs: string[] } {
  const out = { dataRefs: 0, excerptsWithoutFile: 0, withData: 0, refs: [] as string[] };
  const seen = new Set<string>();
  let cur: { level: number; file: boolean; data: boolean; excerpt: boolean; ref?: string } | undefined;
  const close = () => {
    if (!cur) return;
    if (cur.data) out.withData++;
    if (cur.excerpt) {
      if (!cur.file) out.excerptsWithoutFile++;
    } else if (!cur.file && cur.ref !== undefined) {
      out.dataRefs++;
      if (!seen.has(cur.ref)) {
        seen.add(cur.ref);
        out.refs.push(cur.ref);
      }
    }
    cur = undefined;
  };
  const n = text.length;
  let i = 0;
  while (i < n) {
    let end = text.indexOf("\n", i);
    if (end < 0) end = n;
    let p = i;
    i = end + 1;
    // the line: level, an xref, its tag, its value (a BOM, spaces, a CR at its end skipped)
    while (p < end && (text.charCodeAt(p) === 0xfeff || text.charCodeAt(p) === 32 || text.charCodeAt(p) === 9)) p++;
    let level = -1;
    while (p < end) {
      const c = text.charCodeAt(p);
      if (c < 48 || c > 57) break;
      level = (level < 0 ? 0 : level * 10) + c - 48;
      p++;
    }
    if (level < 0) continue;
    // a line under the file's data (CONC) or deeper: nothing to look at
    if (cur && level > cur.level + 1) continue;
    if (cur && level <= cur.level) close();
    while (p < end && text.charCodeAt(p) === 32) p++;
    if (text.charCodeAt(p) === 64 /* @ */) {
      const at = text.indexOf(" ", p);
      p = at < 0 || at > end ? end : at;
      while (p < end && text.charCodeAt(p) === 32) p++;
    }
    let t = p;
    while (t < end && text.charCodeAt(t) !== 32 && text.charCodeAt(t) !== 13) t++;
    const tag = text.slice(p, t);
    const value = () => text.slice(t + 1, end).replace(/\r$/, "").trim();
    if (tag === "OBJE") {
      // a pointer (1 OBJE @M1@) is its record's: counted there
      if (!value().startsWith("@")) cur = { level, file: false, data: false, excerpt: false };
      continue;
    }
    if (!cur || level !== cur.level + 1) continue;
    if (tag === "FILE") {
      cur.file = true;
      cur.data = /^data:/i.test(text.slice(t + 1, Math.min(end, t + 6)));
    } else if (tag === "_STROM_KIND") cur.excerpt = value().toLowerCase() === "excerpt";
    else if (tag === "_STROM_DATA") cur.ref = value().toLowerCase().slice(0, 64);
  }
  close();
  return out;
}

/**
 * The check of a send before the bridge takes it (spec 133 §1.4, §1.5): what it carries of its files, and the hashes it
 * names by reference the research cannot find (the shared store, the research's own files — `mediaRefFile`); any of
 * them: the whole send is refused (409 sync.media-ref-unknown), the app sends it again with the data. An excerpt with no
 * FILE is never unknown. The research is opened only when a hash is not in the store.
 */
export function checkMediaRefs(text: string, research: { tree?: Tree | (() => Tree | undefined); store?: string | undefined }): MediaRefCheck {
  const { refs, ...counts } = mediaRefsOf(text);
  const unknown: string[] = [];
  let tree: Tree | undefined;
  let opened = false;
  const treeOf = () => {
    if (!opened) {
      opened = true;
      try {
        tree = typeof research.tree === "function" ? research.tree() : research.tree;
      } catch {
        tree = undefined;
      }
    }
    return tree;
  };
  for (const sha of refs) {
    if (unknown.length >= MEDIA_REF_UNKNOWN_MAX) break;
    const found = SHA.test(sha) && ((research.store ? storedBytes(research.store, sha) : undefined) ?? mediaRefFile(treeOf(), undefined, sha));
    if (!found) unknown.push(sha);
  }
  return { unknown, ...counts };
}
