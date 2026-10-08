// Originals from the Strom app: a file the user put into the app (a photo of a
// document, a scan of a record) comes to the research as it was, before the app
// made it smaller — through the bridge (PUT <token>/media/<sha256>, the app's
// ZADANI_VYZKUM_app-vstup-dat.md, step C). Each is kept once by its SHA-256 in
// the shared media store, never in git (what nobody has looked at yet stays out
// of the tree's history; its GPS and other metadata too, unchanged): for a
// person an input with an intake task, for a source an image of it (and the
// part the entry is on, as the app cut it out).

import fs from "node:fs";
import path from "node:path";
import { UsageError } from "./errors.ts";
import type { Input, Media, Person, Region, Source, Task } from "./model.ts";
import { mimeOf, sharedMediaPath } from "./media.ts";
import { create, update } from "./records.ts";
import { makeNote } from "./actions.ts";
import { foldText } from "./text.ts";
import { phrase } from "./phrases.ts";
import { imageSizeOfFile, formatOf } from "../image/index.ts";
import { researchRead, VERIFY_ORIGIN } from "./sync.ts";
import { isArchive } from "./mode.ts";
import type { Env } from "./paths.ts";
import type { Tree } from "./tree.ts";

/** How large one original may be (a TIFF of a page at 600 dpi is 50–150 MB). */
export function originalMax(env: Env): number {
  const n = Number(env.STROM_MEDIA_MAX_BYTES);
  return Number.isFinite(n) && n > 0 ? n : 500 * 1024 * 1024;
}

/** What is left free on the disk of the shared store at least, after an original (the system needs room too). */
export const ORIGINAL_RESERVE = 256 * 1024 * 1024;

/** The kinds of files the research takes as originals: what a family keeps and a record is (no programs, keys, archives). */
export const ORIGINAL_TYPES: { mime: string; ext: string[]; kind: Input["kind"]; image?: boolean }[] = [
  { mime: "image/jpeg", ext: [".jpg", ".jpeg"], kind: "document", image: true },
  { mime: "image/png", ext: [".png"], kind: "document", image: true },
  { mime: "image/tiff", ext: [".tif", ".tiff"], kind: "document", image: true },
  { mime: "image/heic", ext: [".heic", ".heif"], kind: "document", image: true },
  { mime: "image/webp", ext: [".webp"], kind: "document", image: true },
  { mime: "image/gif", ext: [".gif"], kind: "document", image: true },
  { mime: "image/jp2", ext: [".jp2"], kind: "document", image: true },
  { mime: "application/pdf", ext: [".pdf"], kind: "document" },
  { mime: "text/plain", ext: [".txt"], kind: "text" },
  { mime: "text/markdown", ext: [".md"], kind: "text" },
  { mime: "text/csv", ext: [".csv"], kind: "text" },
  { mime: "application/rtf", ext: [".rtf"], kind: "text" },
  { mime: "application/msword", ext: [".doc"], kind: "text" },
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: [".docx"], kind: "text" },
  { mime: "application/vnd.oasis.opendocument.text", ext: [".odt"], kind: "text" },
  { mime: "audio/mpeg", ext: [".mp3"], kind: "other" },
  { mime: "audio/mp4", ext: [".m4a"], kind: "other" },
  { mime: "audio/wav", ext: [".wav"], kind: "other" },
];

/** Bytes free for the shared store; undefined when the system does not say. */
export function freeBytes(dir: string): number | undefined {
  try {
    let d = dir;
    while (!fs.existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
    const s = fs.statfsSync(d);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return undefined;
  }
}

/** A file's type by its content (images, PDF), else by its name for what has no mark of its own (texts, sound); undefined: not taken. */
export function originalType(file: string, name: string): (typeof ORIGINAL_TYPES)[number] | undefined {
  const head = Buffer.alloc(32);
  const fd = fs.openSync(file, "r");
  let n = 0;
  try {
    n = fs.readSync(fd, head, 0, 32, 0);
  } finally {
    fs.closeSync(fd);
  }
  const b = head.subarray(0, n);
  const f = formatOf(b);
  const by = (mime: string) => ORIGINAL_TYPES.find((t) => t.mime === mime);
  if (f === "jpeg") return by("image/jpeg");
  if (f === "png") return by("image/png");
  if (f === "tiff") return by("image/tiff");
  if (f === "gif") return by("image/gif");
  if (f === "webp") return by("image/webp");
  if (f === "heic") return by("image/heic");
  if (f === "pdf") return by("application/pdf");
  if ((b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x00 && b[3] === 0x0c && b[4] === 0x6a) || (b[0] === 0xff && b[1] === 0x4f && b[2] === 0xff && b[3] === 0x51)) return by("image/jp2");
  // a file whose name says an image or a PDF but whose content does not is not one
  const ext = path.extname(name).toLowerCase();
  const named = ORIGINAL_TYPES.find((t) => t.ext.includes(ext));
  if (!named || named.image || named.mime === "application/pdf") return undefined;
  // a document of Word or OpenDocument is a ZIP inside; the others have no mark: their name
  if ((ext === ".docx" || ext === ".odt") && !(b[0] === 0x50 && b[1] === 0x4b)) return undefined;
  return named;
}

/**
 * Why a file of that type is not whole (a JPEG or PNG cut short, a PDF without its end), or undefined — the English
 * words and, for the app to say it in its own language, its code (media.too-small {bytes}, media.cut-short {kind}).
 */
export function originalProblem(file: string, mime: string): { text: string; code: string; params: Record<string, string> } | undefined {
  const size = fs.statSync(file).size;
  if (size < 16) return { text: `${size} bytes — too small`, code: "media.too-small", params: { bytes: String(size) } };
  const tail = Buffer.alloc(Math.min(2048, size));
  const fd = fs.openSync(file, "r");
  try {
    fs.readSync(fd, tail, 0, tail.length, size - tail.length);
  } finally {
    fs.closeSync(fd);
  }
  const short = (kind: string, text: string) => ({ text, code: "media.cut-short", params: { kind } });
  if (mime === "image/jpeg" && !tail.includes(Buffer.from([0xff, 0xd9]))) return short("JPEG", "a JPEG cut short (no end marker)");
  if (mime === "image/png" && !tail.includes(Buffer.from("IEND"))) return short("PNG", "a PNG cut short (no end)");
  if (mime === "application/pdf" && !tail.includes(Buffer.from("%%EOF"))) return short("PDF", "a PDF cut short (no end)");
  return undefined;
}

/** What the research has of this content: an input or an image (by SHA-256), with where its file is. */
export function knownOriginal(tree: Tree, shared: string | undefined, sha: string): { id: string; kind: "input" | "media"; mime: string; bytes: number; name?: string; file?: string } | undefined {
  const m = tree.list<Media>("media").find((x) => !x.retracted && x.sha === sha);
  if (m) return { id: m.id, kind: "media", mime: m.mime, bytes: m.size, ...(m.from ? { name: m.from } : {}), ...(shared ? { file: path.join(shared, m.file) } : {}) };
  const i = tree.list<Input>("input").find((x) => x.sha === sha && x.file);
  if (!i) return undefined;
  const file = i.file!.startsWith("inputs/") ? path.join(tree.root, i.file!) : shared && i.file!.startsWith("media:") ? path.join(shared, i.file!.slice(6)) : undefined;
  return { id: i.id, kind: "input", mime: i.mime ?? mimeOf(i.name), bytes: i.size ?? 0, name: i.name, ...(file ? { file } : {}) };
}

/** "0.05,0.40,0.45,0.18" — a part of the image the app gives (fractions of it); undefined when none, an error when it is no part. */
export function parseRegion(text: string | undefined): Region | undefined {
  if (!text?.trim()) return undefined;
  const n = text.split(",").map((x) => Number(x.trim()));
  const [x, y, w, h] = n;
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v)) || x! < 0 || y! < 0 || w! <= 0 || h! <= 0 || x! + w! > 1.001 || y! + h! > 1.001)
    throw new UsageError(`not a part of an image: "${text.slice(0, 60)}"`, { hint: "x,y,w,h as fractions of the image (0–1) from its top left corner", code: "media.bad-region", params: { region: text.slice(0, 60) } });
  return { x: x!, y: y!, w: Math.min(w!, 1 - x!), h: Math.min(h!, 1 - y!) };
}

/** Where an original came from (an input's `from`). */
export const APP_FROM = "the Strom app";

/** Where tasks for what the app sent come from: one intake task gathers what came for the same people within a while. */
export const APP_MEDIA_ORIGIN = "app:media";
/** …and the task to read a scan the user sent of a source. */
export const APP_SCAN_ORIGIN = "app:scan";
const GATHER_MS = 10 * 60_000;
const GATHER_MAX = 30;

export interface OriginalMeta {
  /** The file's name in the app (or on the user's disk). */
  name: string;
  persons: string[];
  source?: string | undefined;
  region?: Region | undefined;
  note?: string | undefined;
  /** A batch of the app it comes in, and its path there: an input with no task of its own (the batch's tasks come when it is closed). */
  batch?: string | undefined;
  path?: string | undefined;
}

export interface TakenOriginal {
  /** What the research already had of this content. */
  known?: string;
  /** …and what was added to it now (its people, the user's note). */
  added?: { persons: string[]; note: boolean };
  input?: string;
  media?: string;
  source?: string;
  /** The part the entry is on became the source's clip. */
  clip?: boolean;
  task?: string;
}

/** The person by ID, through merges; unknown: an error that says it. */
function personOf(tree: Tree, id: string): Person {
  let p = tree.get<Person>(id);
  for (let hops = 0; p?.mergedInto && hops < 10; hops++) p = tree.get<Person>(p.mergedInto);
  if (!p || p.type !== "person" || p.retracted) throw new UsageError(`no person ${id} in this research`, { hint: "the person's REFN in the Strom app", code: "media.no-person", params: { person: id } });
  return p;
}

function sourceOf(tree: Tree, id: string): Source {
  let s = tree.get<Source>(id);
  for (let hops = 0; s?.mergedInto && hops < 10; hops++) s = tree.get<Source>(s.mergedInto);
  if (!s || s.type !== "source" || s.retracted) throw new UsageError(`no source ${id} in this research`, { hint: "the source's REFN in the Strom app", code: "media.no-source", params: { source: id } });
  return s;
}

/** Check what an original is for before it comes: the people and the source the research has, the part of the image. */
export function checkOriginalMeta(tree: Tree, meta: { persons: string[]; source?: string | undefined }): { persons: string[]; source?: string } {
  const persons = [...new Set(meta.persons.map((p) => personOf(tree, p).id))];
  return { persons, ...(meta.source ? { source: sourceOf(tree, meta.source).id } : {}) };
}

const displayOf = (p: Person) => `${[p.names[0]?.given, p.names[0]?.surname].filter(Boolean).join(" ") || p.id} [${p.id}]`;

/**
 * Take an original the bridge received (`file`, its SHA-256 checked): moved into the shared store and registered —
 * of a source: an image of it (its clip from the app's part, when it has none), and a task to read it when the research
 * has not read the record; else: an input for the people, in an intake task with what came for them a while ago.
 * In an archive the tasks wait put aside. The caller holds the tree lock and commits.
 */
export function takeOriginal(tree: Tree, shared: string, file: string, sha: string, metaIn: OriginalMeta): TakenOriginal {
  const meta = { ...metaIn, ...checkOriginalMeta(tree, metaIn) };
  const name = path.basename(metaIn.name.normalize("NFC").replace(/[\\/]+/g, "/")).replace(/[\u0000-\u001f]/g, "").slice(0, 200) || `${sha.slice(0, 12)}`;
  const type = originalType(file, name);
  if (!type) throw new UsageError(`${name}: not a kind of file the research takes`, { hint: `images (JPEG, PNG, TIFF, HEIC, WebP), PDF, texts and documents, sound — ${ORIGINAL_TYPES.map((t) => t.ext[0]).join(" ")}`, code: "media.type", params: { name } });
  const problem = originalProblem(file, type.mime);
  if (problem) throw new UsageError(`${name}: ${problem.text} — not taken; send it again`, { code: problem.code, params: { name, ...problem.params } });
  const lang = tree.lang;
  const known = knownOriginal(tree, shared, sha);
  const s = meta.source && !meta.batch ? tree.get<Source>(meta.source)! : undefined;
  if (known && (!s || known.kind !== "media" || s.media?.includes(known.id))) {
    if (!tree.dryRun) fs.rmSync(file, { force: true });
    // an input of the people: what is said of it now is added (in a batch the batch's tasks see to it)
    if (known.kind === "input" && !meta.batch) {
      const a = amendInput(tree, known.id, { persons: meta.persons, note: meta.note });
      return { known: known.id, ...(a.added.persons.length || a.added.note ? { added: a.added } : {}), ...(a.task ? { task: a.task } : {}) };
    }
    return { known: known.id };
  }
  // into the store, under its hash (a file there already of the same content is that file)
  const dest = sharedMediaPath(shared, sha, type.ext[0]!);
  if (!tree.dryRun) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) fs.rmSync(file, { force: true });
    else {
      try {
        fs.renameSync(file, dest);
      } catch {
        fs.copyFileSync(file, dest);
        fs.rmSync(file, { force: true });
      }
    }
  }
  const rel = path.relative(shared, dest).split(path.sep).join("/");
  const size = tree.dryRun ? fs.statSync(file).size : fs.statSync(dest).size;
  const out: TakenOriginal = {};

  if (s) {
    // an image of the source: the record itself, as the user scanned or photographed it
    const m =
      known?.kind === "media"
        ? tree.get<Media>(known.id)!
        : create<Media>(
            tree,
            "media",
            {
              sha,
              file: rel,
              mime: type.mime,
              size,
              ...(type.image && !tree.dryRun ? (imageSizeOfFile(dest) ?? {}) : {}),
              from: `${APP_FROM}: ${name}`,
              accessed: new Date().toISOString().slice(0, 10),
            } as never,
            (id) => `+${id} image "${name.slice(0, 50)}" of ${s.id} (the Strom app)`,
            [s.id],
          );
    // the part the entry is on, where nobody said it yet (another one waits for the reader's word)
    const clip = !!meta.region && !s.clips?.length && !!type.image;
    update<Source>(
      tree,
      s.id,
      "source",
      (x) => ({ ...x, media: [...new Set([...(x.media ?? []), m.id])], ...(clip ? { clips: [{ media: m.id, region: meta.region! }] } : {}) }),
      { op: "source.media", summary: `${s.id} image ${m.id}${clip ? " with the part the entry is on" : ""} (the Strom app)` },
    );
    Object.assign(out, { media: m.id, source: s.id, ...(clip ? { clip } : {}) });
    // the research reads the record itself when it has not: the user's reading is checked, a mistake found
    const cites = citingPeople(tree, s.id);
    const open = tree.list<Task>("task").some((t) => ["open", "doing", "parked", "waiting"].includes(t.state) && (t.origin === APP_SCAN_ORIGIN || t.origin === VERIFY_ORIGIN) && t.subject.includes(s.id));
    if (!researchRead(tree, s) && !open) {
      const t = create<Task>(
        tree,
        "task",
        {
          level: "verify",
          priority: 3,
          what: phrase(lang, "app.scan.what", { source: s.id, title: s.title.slice(0, 60) }),
          where: [m.id, s.id],
          why: phrase(lang, "app.scan.why"),
          doneWhen: phrase(lang, "app.scan.done", { media: m.id, source: s.id }),
          subject: [s.id, ...cites, ...meta.persons.filter((p) => !cites.includes(p))],
          state: "open",
          origin: APP_SCAN_ORIGIN,
        } as never,
        (id) => `+${id} task "read the scan of ${s.id} the user sent"`,
      );
      out.task = t.id;
    }
    return out;
  }

  // material for the people: an input, in one intake task with what came for them a while ago
  const input = create<Input>(
    tree,
    "input",
    {
      name,
      file: `media:${rel}`,
      sha,
      size,
      mime: type.mime,
      from: APP_FROM,
      kind: type.kind,
      state: "new",
      ...(meta.persons.length ? { persons: meta.persons } : {}),
      ...(meta.batch ? { batch: meta.batch } : {}),
      ...(meta.path ? { path: meta.path } : {}),
      ...(meta.note?.trim() ? { note: meta.note.trim().slice(0, 500) } : {}),
    } as never,
    (id) => `+${id} input ${type.kind} "${name.slice(0, 50)}" (the Strom app)`,
    meta.persons,
  );
  out.input = input.id;
  if (!meta.batch) out.task = gatherTask(tree, input, meta.persons);
  return out;
}

/** The people whose facts or names cite a source. */
function citingPeople(tree: Tree, source: string): string[] {
  return tree
    .list<Person>("person")
    .filter((p) => !p.retracted && (p.events.some((e) => !e.retracted && e.citations.some((c) => c.source === source)) || p.names.some((n) => n.citations?.some((c) => c.source === source))))
    .map((p) => p.id);
}

/** An intake task for an input from the app: the one of the same people made a while ago takes it, else a new one. */
function gatherTask(tree: Tree, input: Input, persons: string[]): string {
  const lang = tree.lang;
  const same = (t: Task) => {
    const theirs = t.subject.filter((x) => x.startsWith("P"));
    return theirs.length === persons.length && persons.every((p) => theirs.includes(p));
  };
  const held = isArchive(tree);
  const recent = tree
    .list<Task>("task")
    .filter((t) => t.origin === APP_MEDIA_ORIGIN && (t.state === "open" || (held && t.state === "parked")) && Date.now() - Date.parse(t.created) < GATHER_MS && t.where.length < GATHER_MAX && same(t))
    .pop();
  const who = persons.map((p) => displayOf(tree.get<Person>(p)!)).join(", ") || phrase(lang, "app.media.nobody");
  if (recent) {
    const where = [...recent.where, input.id];
    update<Task>(
      tree,
      recent.id,
      "task",
      (t) => ({ ...t, where, subject: [...where, ...persons], what: phrase(lang, "app.media.what", { count: where.length, who, first: where[0]!, last: where.at(-1)! }) }),
      { op: "task.edit", summary: `${recent.id} + ${input.id} (the Strom app)` },
    );
    return recent.id;
  }
  const t = create<Task>(
    tree,
    "task",
    {
      level: "intake",
      priority: 4,
      what: phrase(lang, "app.media.what", { count: 1, who, first: input.id, last: input.id }),
      where: [input.id],
      why: phrase(lang, "app.media.why"),
      doneWhen: phrase(lang, "intake.done"),
      subject: [input.id, ...persons],
      state: "open",
      origin: APP_MEDIA_ORIGIN,
    } as never,
    (id) => `+${id} task "the material the user sent from the Strom app"`,
  );
  return t.id;
}

export interface AmendedInput {
  known: string;
  /** What came of it: the people the input lacked, the user's note it had not got. */
  added: { persons: string[]; note: boolean };
  /** The intake task that looks at it again (none held it open). */
  task?: string;
}

/**
 * The same file sent again for the research's input (found live: the app's "Sent" while the research took nothing): what
 * it says now is added — the people the input lacks, the user's note it has not got — and when something came and no
 * task at hand holds the input, an intake task looks at it again (in an archive put aside). Nothing new: nothing written.
 * The caller holds the tree lock and commits.
 */
export function amendInput(tree: Tree, id: string, more: { persons: string[]; note?: string | undefined }): AmendedInput {
  const input = tree.get<Input>(id);
  if (!input || input.type !== "input") throw new UsageError(`no input ${id} in this research`, { hint: "strom input list" });
  const had = input.persons ?? [];
  const persons = checkOriginalMeta(tree, { persons: more.persons }).persons.filter((p) => !had.includes(p));
  const text = more.note?.replace(/[\p{Cc}]/gu, " ").trim().slice(0, 500);
  const note = !!text && !input.notes.some((n) => foldText(n.text) === foldText(text));
  const out: AmendedInput = { known: id, added: { persons, note } };
  if (!persons.length && !note) return out;
  const held = tree.list<Task>("task").some((t) => t.where.includes(id) && (t.state === "open" || t.state === "doing" || t.state === "parked" || t.state === "waiting"));
  const again = !held && !input.batch;
  const next = update<Input>(
    tree,
    id,
    "input",
    (i) => ({
      ...i,
      ...(persons.length ? { persons: [...had, ...persons] } : {}),
      ...(note ? { notes: [...i.notes, makeNote(tree, text!)] } : {}),
      ...(again ? { state: "new" as const } : {}),
    }),
    { op: "input.amend", summary: `${id}: ${[persons.length ? `+ ${persons.join(", ")}` : "", note ? "+ a note" : ""].filter(Boolean).join(", ")} (the Strom app)`, targets: persons },
  );
  if (again) out.task = gatherTask(tree, next, next.persons ?? []);
  return out;
}

/** The originals from the app nobody has worked through yet: what waits in the research (the bridge's inbox.material). */
export function materialWaiting(tree: Tree): number {
  return tree.list<Input>("input").filter((i) => i.state === "new" && i.from === APP_FROM).length;
}
