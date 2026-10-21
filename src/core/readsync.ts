// A reading of a document confirmed in the Strom app (spec 013 U4d): the app writes what the person took of a reading
// into its tree, one source per entry carrying the reading's mark (_STROM_READING D…, the original's _STROM_SHA), and
// sends it as any edit. Here the mark is checked against the reading the research keeps, the source is made the
// research's own (its input, images, the entry's excerpt) and each fact citing it gets its status by what the readers
// read — never by what the app says.

import fs from "node:fs";
import path from "node:path";
import { buildResult, loadState, READ_ID, resultPath, type DocEntry, type DocEvent, type ReadPage, type ReadResult } from "./document.ts";
import { normalizeDate } from "./gdate.ts";
import { Settings } from "./config.ts";
import { exifOrientation, imageSizeOfFile } from "../image/index.ts";
import { shownToFile } from "../image/image.ts";
import { inputPath, mimeOf, storeShared } from "./media.ts";
import { create, update } from "./records.ts";
import { foldText } from "./text.ts";
import type { Clip, Input, Media, Place, Source } from "./model.ts";
import type { Tree } from "./tree.ts";

/** What a source of the app says of the reading it comes from. */
export interface ReadingMark {
  /** The reading: D… as the app wrote it (checked before anything). */
  id: string;
  /** The entry of the reading (e1 …), when the app says it. */
  entry?: string;
  /** The originals the source's excerpts are cut from (_STROM_SHA). */
  shas: string[];
}

/** Why a mark is not the research's reading: the source is then the app's own, as any other. */
export type ReadingRefusal = "reading.none" | "reading.state" | "reading.sha" | "reading.entry";

/** A mark held against the research's reading. */
export interface ReadingCheck {
  id: string;
  ok: boolean;
  code?: ReadingRefusal;
  /** The entry the source is (ok). */
  entry?: DocEntry;
  page?: ReadPage;
  result?: ReadResult;
  /** The person changed the transcript in the app: theirs, the reading's kept beside it. */
  edited?: boolean;
}

/**
 * The reading's result as the research keeps it: read here, from its readers' reports as the app is shown it (GET
 * /read/<id>: a newer strom's checks on reports read before), else its finished result (in git — read on another
 * computer).
 */
export function readingResult(tree: Tree, id: string): ReadResult | undefined {
  if (!READ_ID.test(id)) return undefined;
  const s = loadState(tree.root, id);
  if (s?.state === "done") return buildResult(tree, s);
  try {
    const file = resultPath(tree.root, id);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as ReadResult;
  } catch {
    // an unreadable result is none
  }
  return undefined;
}

/**
 * The readings of an input (Input.read) as an agent is told of them: each one's ID and state here (its state on this
 * computer, else its result kept in git) — one read already is not read again, its result is strom readings D….
 */
export function readingsOf(tree: Tree, input: Pick<Input, "read">): { id: string; state: string }[] {
  return (input.read ?? []).map((id) => ({ id, state: loadState(tree.root, id)?.state ?? readingResult(tree, id)?.state ?? "gone" }));
}

/** One line of an input's readings for an agent: "D… done — strom readings D…, not read again", or nothing. */
export function readingsLine(tree: Tree, input: Pick<Input, "read">): string | undefined {
  const all = readingsOf(tree, input);
  if (!all.length) return undefined;
  const done = all.filter((r) => r.state === "done");
  return `${all.map((r) => `${r.id} ${r.state}`).join(", ")} — ${done.length ? `read already: strom readings ${done[done.length - 1]!.id}; not read again` : `strom readings ${all[all.length - 1]!.id}`}`;
}

/** The words of a transcript as they are compared: NFC, one space, the line breaks (and the reading's " | ") as spaces. */
// the reading writes a line break of the record as " | ", the app may send it as a new line: the same
const plain = (t: string | undefined) => (t ?? "").normalize("NFC").replace(/\s*\|\s*/gu, " ").replace(/\s+/gu, " ").trim();
const tokens = (t: string) => new Set(foldText(t).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean));

/** How much of two transcripts is the same words (0–1). */
function likeness(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return (2 * both) / (x.size + y.size);
}

/**
 * Whether the mark is the research's reading: it exists and is read, one of its pages is the original the source
 * names (by its content), and the source is one entry of it — by the entry the app names, else its words. The
 * person's words changed since are theirs (edited); the source is still that entry.
 */
export function checkReading(tree: Tree, mark: ReadingMark, text: string | undefined): ReadingCheck {
  const id = mark.id;
  const no = (code: ReadingRefusal): ReadingCheck => ({ id, ok: false, code });
  if (!READ_ID.test(id)) return no("reading.none");
  const result = readingResult(tree, id);
  if (!result) return loadState(tree.root, id) ? no("reading.state") : no("reading.none");
  if (result.state !== "done") return no("reading.state");
  const shaOf = (p: ReadPage) => p.sha ?? tree.get<Media | Input>(p.file)?.sha;
  const pages = result.pages.filter((p) => mark.shas.includes(shaOf(p) ?? ""));
  if (!pages.length) return no("reading.sha");
  const on = result.entries.filter((e) => pages.some((p) => p.n === e.page));
  let entry: DocEntry | undefined;
  if (mark.entry) entry = on.find((e) => e.id === mark.entry);
  else {
    const words = plain(text);
    entry = on.find((e) => plain(e.transcript) === words) ?? (on.length === 1 ? on[0] : undefined);
    if (!entry && words) {
      const best = on.map((e) => ({ e, k: likeness(e.transcript, words) })).sort((a, b) => b.k - a.k)[0];
      if (best && best.k >= 0.6) entry = best.e;
    }
  }
  if (!entry) return no("reading.entry");
  const page = result.pages.find((p) => p.n === entry.page)!;
  const edited = !!plain(text) && plain(text) !== plain(entry.transcript);
  return { id, ok: true, entry, page, result, ...(edited ? { edited: true } : {}) };
}

/** The kind of record a kind of document is. */
const KIND_OF_DOC: Record<string, Source["kind"]> = {
  "register.baptism": "baptism",
  "register.birth": "birth",
  "register.marriage": "marriage",
  "register.death": "death",
  "register.burial": "burial",
  "register.other": "church",
  letter: "letter",
  deed: "notarial",
  certificate: "certificate",
  list: "census",
  "photo.back": "photo",
};

/** The source's kind and information by the kind of document the readers said it is. */
export function readingKind(result: ReadResult): { kind?: Source["kind"]; information: Source["information"] } {
  const k = result.doc.kind ?? "";
  const kind = KIND_OF_DOC[k];
  // a register, a certificate, a deed: written at the time by who was there, for most of what it says
  const primary = k.startsWith("register.") || k === "certificate" || k === "deed";
  return { ...(kind ? { kind } : {}), information: primary ? "primary" : "unknown" };
}

/** A fact as the status of it is told: its kind, date, place, value (GEDCOM forms). */
export interface ReadFact {
  kind: string;
  date?: string | undefined;
  place?: string | undefined;
  value?: string | undefined;
}

/** Why a fact has the status it has on a reading. */
export type ReadWhy = "one" | "two" | "differ" | "edited" | "absent" | "uncertain";

export interface ReadGrade {
  status: "lead" | "possible" | "probable";
  why: ReadWhy;
  /** differ: where the readers read otherwise (the first reader's, the blind one's). */
  variants?: { at: string; other: string }[];
}

const kindOf = (k: string) => (k === "CHR" ? "BAPM" : k.toUpperCase());
const firstPart = (s: string | undefined) => foldText((s ?? "").split(",")[0]!.replace(/\[\?\]/gu, ""));

/** Whether a place of the fact is the place the reader read (as written, or a place of the tree it is). */
function samePlace(tree: Tree, fact: string, read: DocEvent["place"]): boolean {
  if (!read) return false;
  const f = firstPart(fact);
  if (!f) return false;
  if (firstPart(read.text) === f) return true;
  const known = read.known ? tree.get<Place>(read.known) : undefined;
  return !!known && known.names.some((n) => firstPart(n.name) === f);
}

function sameDate(fact: string, read: DocEvent["date"]): boolean {
  if (!read) return false;
  const a = normalizeDate(fact) ?? plain(fact).toUpperCase();
  const b = normalizeDate(read.gedcom ?? read.text) ?? plain(read.gedcom ?? read.text).toUpperCase();
  return a === b;
}

/**
 * How sure a fact citing the reading is (the decision of 19 Oct 2026): the person changed the transcript, the
 * reading does not say it, or its reader was unsure — a lead; read by one reader — possible (a check waits); read
 * alike by two readers, blind — probable. Proven only after the research's own look at the record, never here.
 */
export function readingGrade(tree: Tree, check: ReadingCheck, fact: ReadFact): ReadGrade {
  const e = check.entry!;
  if (check.edited) return { status: "lead", why: "edited" };
  const kind = kindOf(fact.kind);
  const two = e.agree !== undefined;
  const varied = (fields: string[]) => (e.variants ?? []).filter((v) => fields.includes(v.field));
  // what a person of it is: an occupation, a residence
  if (kind === "OCCU" || kind === "RESI") {
    const said = foldText(fact.value ?? fact.place ?? "");
    const field = kind === "OCCU" ? "occupation" : "residence";
    const p = e.persons.find((x) => {
      const v = foldText(x[field] ?? "");
      return !!v && !!said && (v === said || v.includes(said) || said.includes(v));
    });
    if (!p) return { status: "lead", why: "absent" };
    if (p.uncertain?.includes(field)) return { status: "lead", why: "uncertain" };
    if (!two) return { status: "possible", why: "one" };
    const words = tokens(p[field] ?? "");
    const other = (e.variants ?? []).filter((v) => v.field === "entry" || (v.field === "transcript" && [...tokens(v.at)].some((w) => words.has(w))));
    return other.length ? { status: "lead", why: "differ", variants: other.map(({ at, other: o }) => ({ at, other: o })) } : { status: "probable", why: "two" };
  }
  const events = e.events.filter((x) => kindOf(x.type) === kind);
  const ev = events.find((x) => (!fact.date || sameDate(fact.date, x.date)) && (!fact.place || samePlace(tree, fact.place, x.place)));
  if (!ev) return { status: "lead", why: "absent" };
  const asked = [fact.date ? "date" : "", fact.place ? "place" : ""].filter(Boolean) as ("date" | "place")[];
  if (asked.some((f) => ev.uncertain?.includes(f))) return { status: "lead", why: "uncertain" };
  if (!two) return { status: "possible", why: "one" };
  const other = varied(["entry", ev.type, ...asked.map((f) => `${ev.type}.${f}`)]);
  return other.length ? { status: "lead", why: "differ", variants: other.map(({ at, other: o }) => ({ at, other: o })) } : { status: "probable", why: "two" };
}

const RANK = { lead: 0, possible: 1, probable: 2 } as const;

/** The best of the grades of a fact's readings (cited twice: the surer one counts). */
export function bestGrade(grades: ReadGrade[]): ReadGrade | undefined {
  return grades.reduce<ReadGrade | undefined>((a, g) => (!a || RANK[g.status] > RANK[a.status] ? g : a), undefined);
}

/** Whether a status is surer than another (proven and the rest above all a reading gives). */
export function surer(a: string, than: string | undefined): boolean {
  const r = (s: string | undefined) => (s && s in RANK ? RANK[s as keyof typeof RANK] : s === "proven" ? 3 : s === "disproven" ? -1 : 0);
  return r(a) > r(than);
}

/** What the research writes with a source of a reading: the record's fields (beside the app's title, page, date). */
export interface ReadingSource {
  kind?: Source["kind"];
  information: Source["information"];
  form: "original";
  transcript: string;
  translation?: string;
  language?: string;
  input?: string;
  reading: string;
  readingEntry: string;
}

export function readingSource(check: ReadingCheck, text: string | undefined): ReadingSource {
  const e = check.entry!;
  const r = check.result!;
  const { kind, information } = readingKind(r);
  const input = check.page?.file.startsWith("I") ? check.page.file : undefined;
  return {
    ...(kind ? { kind } : {}),
    information,
    form: "original",
    // the person's words where they changed them: theirs stand, the reading's beside them (a note)
    transcript: check.edited && text ? text.trim() : e.transcript,
    ...(e.translation ? { translation: e.translation } : {}),
    ...(r.doc.language?.[0] ? { language: r.doc.language[0] } : {}),
    ...(input ? { input } : {}),
    reading: check.id,
    readingEntry: e.id,
  };
}

/** What taking a reading's page as the source's image wrote (to undo it). */
export interface ReadingImages {
  /** The image registered now (else the one there already). */
  added?: string;
  media?: string;
  clip?: Clip;
  /** The input sorted as the source, and how it stood before. */
  input?: { id: string; before: Pick<Input, "state" | "sorted"> };
}

const CLIPPED = new Set(["image/jpeg", "image/png"]);

/**
 * The reading's page the entry is on as the source's image (a picture: registered by its content, the one there
 * already when it is), the entry's region of it as the source's excerpt, and the input sorted as the source.
 */
export function takeReadingImages(tree: Tree, source: Source, check: ReadingCheck, reason: string): ReadingImages {
  const out: ReadingImages = {};
  const page = check.page!;
  const entry = check.entry!;
  const rec = tree.get<Media | Input>(page.file);
  let media: Media | undefined = rec?.type === "media" ? (rec as Media) : undefined;
  const input = rec?.type === "input" ? (rec as Input) : undefined;
  if (input) {
    const sha = input.sha;
    media = sha ? tree.list<Media>("media").find((m) => !m.retracted && m.sha === sha) : undefined;
    const file = inputPath(tree, input);
    const mime = input.mime ?? mimeOf(input.name);
    const shared = new Settings(tree.env, {}).shared()?.value;
    // a picture of one page (a PDF's pages are no image of their own): registered as the record's image
    if (!media && sha && shared && file && fs.existsSync(file) && mime.startsWith("image/") && page.page <= 1) {
      const rel = input.file!.startsWith("media:") ? input.file!.slice(6) : path.relative(shared, tree.dryRun ? file : storeShared(shared, file, sha)).split(path.sep).join("/");
      const size = imageSizeOfFile(file);
      media = create<Media>(
        tree,
        "media",
        {
          sha,
          file: rel,
          mime,
          size: input.size ?? fs.statSync(file).size,
          ...(size ? { width: size.width, height: size.height } : {}),
          from: input.name,
          accessed: new Date().toISOString().slice(0, 10),
        } as never,
        (id) => `+${id} image "${input.name.slice(0, 50)}" of ${source.id} (read ${check.id})`,
        [source.id, input.id],
      );
      out.added = media.id;
    }
  }
  if (media) {
    out.media = media.id;
    const shared = new Settings(tree.env, {}).shared()?.value;
    const file = shared ? path.join(shared, media.file) : undefined;
    // the entry where it lies in the file: the reading's region is of the page upright
    const r = entry.region;
    const clip = r && CLIPPED.has(media.mime) && !source.clips?.length ? { media: media.id, region: shownToFile({ x: r[0], y: r[1], w: r[2], h: r[3] }, file && fs.existsSync(file) ? exifOrientation(file) : undefined) } : undefined;
    if (clip) out.clip = clip;
    update<Source>(tree, source.id, "source", (x) => ({ ...x, media: [...new Set([...(x.media ?? []), media.id])], ...(clip ? { clips: [clip] } : {}) }), {
      op: "source.media",
      summary: `${source.id} image ${media.id}${clip ? " with the part the entry is on" : ""} (${reason})`,
    });
  }
  if (input && input.state !== "processed") {
    out.input = { id: input.id, before: { state: input.state, ...(input.sorted ? { sorted: input.sorted } : {}) } };
    update<Input>(tree, input.id, "input", (x) => ({ ...x, state: "processed", sorted: { as: "source", source: source.id, reason: `read ${check.id}, confirmed in the Strom app`, at: new Date().toISOString(), by: tree.actor } }), {
      op: "input.sort",
      summary: `${input.id} the source ${source.id} (read ${check.id}, ${reason})`,
    });
  }
  return out;
}
