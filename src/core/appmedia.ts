// The files of the Strom app's tree a send brings (its OBJE): a person's portrait and attachments, a couple's photo and
// attachments, an event's, a source's. Each file is one record of the material (data/inputs, spec 108 P1): known by
// its original's hash (_STROM_SHA, the original came by PUT /media) or else by the hash of the bytes the send carries;
// those bytes — the working copy the app shows — are kept exactly as they came in the shared store, under their own
// hash, while the file is read (P8): one image in memory at a time, a hash kept already never written again.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { MATERIAL_KINDS, type Input } from "./model.ts";
import { sharedMediaPath } from "./media.ts";
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
  private note: (n: GedNode) => string;
  /** Read already (the bytes of a data URL hashed once: the same text of it is the same file). */
  private seen = new Map<string, SMediaFile["working"] | null>();

  constructor(records: GedNode[], o: { store?: string | undefined; problems: string[]; note: (n: GedNode) => string }) {
    this.objects = new Map(records.filter((r) => r.tag === "OBJE" && r.xref).map((r) => [r.xref!, r]));
    this.store = o.store;
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
        const format = formatOf(got.bytes);
        const mime = (got.mime && got.mime !== "application/octet-stream" ? got.mime : undefined) ?? BY_FORMAT[format] ?? mimeOfForm(form) ?? "application/octet-stream";
        const ext = EXT[mime] ?? (BY_FORMAT[format] ? EXT[BY_FORMAT[format]!] : undefined) ?? ".bin";
        const size = mime.startsWith("image/") ? imageSize(got.bytes) : undefined;
        working = { sha, mime, bytes: got.bytes.length, ...(size ? size : {}), ext };
        if (this.store) keepBytes(this.store, sha, ext, got.bytes);
        this.seen.set(value, working);
      }
    } else if (!original || !SHA.test(original)) return undefined;
    const orig = original && SHA.test(original) ? original : undefined;
    const key = orig ?? working!.sha;
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
