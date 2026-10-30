// Excerpts: the entry itself cut out of its scan, for the Strom app — the row of
// a register next to the words read in it. Made from a source's clips (where a
// reader found the entry), from the sharpest image of that place there is — or,
// for a document the user gave as a scan (an input image), the whole of it. The
// Strom file carries them by default (the setting excerpts.for; none: without);
// made once and kept in .strom/excerpts, so the file after a session is quick.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Clip, ExcerptQuality, ExcerptScope, Family, Input, Media, Person, Region, Source } from "./model.ts";
import type { Tree } from "./tree.ts";
import { clipText, inputPath, sharperPart } from "./media.ts";
import { kinship } from "./kin.ts";
import { convertedDir, readableFile } from "./readable.ts";
import { Settings } from "./config.ts";
import { excerptPage } from "./scanlink.ts";
import { crop, resize, toGrey, upright, type RawImage } from "../image/image.ts";
import { decodeImage, encodeImage, exifOrientation, imageSize } from "../image/index.ts";

/** How an excerpt is made: its longest side, its pixels at most, JPEG quality, grey or in colour. */
export interface ExcerptLevel {
  name: string;
  long: number;
  /** Megapixels at most: a row of a register stays sharp, a whole page is made smaller. */
  mp: number;
  q: number;
  grey: boolean;
}

/** From the sharpest down: the quality asked for is where it starts; over the limit, it goes further down. */
export const LEVELS: ExcerptLevel[] = [
  { name: "sharp", long: 1600, mp: 1.2, q: 85, grey: false },
  { name: "normal", long: 1200, mp: 0.6, q: 80, grey: false },
  { name: "small", long: 1000, mp: 0.3, q: 70, grey: true },
  { name: "smaller", long: 900, mp: 0.2, q: 60, grey: true },
];

/** A margin round the clip, of its longer side: the edge of the entry stays in. */
const MARGIN = 0.03;

export interface Excerpt {
  /** The image the entry is on (M…, or the input I… of a document the user gave) and where the excerpt was cut from (a sharper part of it, or the image). */
  media: string;
  from: string;
  jpeg: Uint8Array;
  width: number;
  height: number;
  /** The page in the online archive. */
  url?: string | undefined;
  /** Which of the source's excerpts it is (_STROM_CLIP): the Strom app asks for it again by it (a link, core/links.ts). */
  clip?: string;
  /** The EXIF orientation of the picture it is cut from (2–8): cut as the picture lies in its file, turned for showing. */
  orient?: number;
}

/** A clip's mark: from where it is (its image and region) — a clip made again is another excerpt; "input": a document the user gave. */
export function clipMark(c: Clip): string {
  return `c${crypto.createHash("sha256").update(clipText(c)).digest("hex").slice(0, 10)}`;
}

export const INPUT_MARK = "input";

/** A clip with the margin an excerpt keeps round it. */
export function withMargin(r: Region): Region {
  const pad = MARGIN * Math.max(r.w, r.h);
  const f = (n: number) => Math.min(1, Math.max(0, n));
  const x = f(r.x - pad);
  const y = f(r.y - pad);
  return { x, y, w: f(r.x + r.w + pad) - x, h: f(r.y + r.h + pad) - y };
}

/** Made smaller to the level's longest side and pixels, grey if it says so, as JPEG. */
function finish(img: RawImage, level: ExcerptLevel): { jpeg: Uint8Array; width: number; height: number } {
  if (level.grey) img = toGrey(img);
  const k = Math.min(1, level.long / Math.max(img.width, img.height), Math.sqrt((level.mp * 1e6) / (img.width * img.height)));
  if (k < 1) img = resize(img, Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)));
  return { jpeg: encodeImage(img, "jpeg", level.q), width: img.width, height: img.height };
}

/** An excerpt turned as its picture is shown (for an app that does not turn it itself): no orientation left to say. */
export function turned(e: Excerpt): Excerpt {
  if (!e.orient || e.orient === 1) return e;
  const img = upright(decodeImage(e.jpeg), e.orient);
  const { orient: _, ...rest } = e;
  return { ...rest, jpeg: encodeImage(img, "jpeg", 90), width: img.width, height: img.height };
}

/** Not made yet, and there was no time for it now (an export with a time budget): the next export makes it. */
export const LATER = Symbol("later");

/** Where a clip's excerpt is cut from at a level: the sharpest image of that place, its region there, its file and the excerpt's place in the cache. */
function clipPlace(tree: Tree, shared: string, clip: Clip, all: Media[], level: ExcerptLevel): { m: Media; src: Media; region: Region; file: string; cache: string } | undefined {
  const m = all.find((x) => x.id === clip.media);
  if (!m) return undefined;
  const wanted = withMargin(clip.region);
  // the sharpest image of that place: a part of it fetched sharper, or a bigger copy
  const sharper = sharperPart(all, m, wanted);
  const src = sharper?.part ?? m;
  const region = sharper?.crop ?? wanted;
  const key = crypto.createHash("sha256").update(JSON.stringify({ sha: src.sha, region, level })).digest("hex").slice(0, 16);
  return { m, src, region, file: path.join(shared, src.file), cache: path.join(tree.root, ".strom", "excerpts", `${src.id}-${key}.jpg`) };
}

/** One clip cut out of its scan at a level (cached in .strom/excerpts); undefined when its image is not on this computer. */
export function renderClip(
  tree: Tree,
  shared: string,
  clip: Clip,
  all: Media[] = tree.list<Media>("media"),
  level: ExcerptLevel = LEVELS[1]!,
  cachedOnly = false,
): Excerpt | typeof LATER | undefined {
  const at = clipPlace(tree, shared, clip, all, level);
  if (!at || !fs.existsSync(at.file)) return undefined;
  const { m, src, region, file, cache } = at;
  const url = m.url ?? src.url;
  const o = exifOrientation(file);
  const orient = o && o !== 1 ? { orient: o } : {};
  if (fs.existsSync(cache)) {
    const jpeg = fs.readFileSync(cache);
    const size = imageSize(jpeg);
    if (size) return { media: m.id, from: src.id, jpeg, ...size, url, clip: clipMark(clip), ...orient };
  }
  if (cachedOnly) return LATER;
  const img = decodeImage(fs.readFileSync(file));
  const px = { x: Math.round(region.x * img.width), y: Math.round(region.y * img.height), w: Math.round(region.w * img.width), h: Math.round(region.h * img.height) };
  const out = finish(crop(img, px.x, px.y, Math.max(1, Math.min(px.w, img.width - px.x)), Math.max(1, Math.min(px.h, img.height - px.y))), level);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, out.jpeg);
  return { media: m.id, from: src.id, ...out, url, clip: clipMark(clip), ...orient };
}

/**
 * The image of a document the user gave (an input), when it is one: JPEG or PNG on this computer, or a HEIC photo
 * this computer converts (the JPEG made of it; the original stays as it is).
 */
function inputImage(tree: Tree, id: string | undefined, convert = true): { input: Input; file: string } | undefined {
  const input = id ? tree.get<Input>(id) : undefined;
  const file = input ? inputPath(tree, input) : undefined;
  if (!input || !file || !fs.existsSync(file)) return undefined;
  if (/^image\/(jpeg|png)$/.test(input.mime ?? "") || /\.(jpe?g|png)$/i.test(file)) return { input, file };
  if (!/^image\/hei[cf]$/.test(input.mime ?? "") && !/\.hei[cf]$/i.test(file)) return undefined;
  if (!convert) {
    // the JPEG made of it when there is one, else the photo itself (its excerpt's cache is told by its hash all the same)
    const made = path.join(convertedDir(tree.root, file), "1.jpg");
    return { input, file: fs.existsSync(made) ? made : file };
  }
  try {
    return { input, file: readableFile(tree.root, file, { env: tree.env }).file };
  } catch {
    return undefined;
  }
}

/** Whether a document the user gave is a picture on this computer (nothing converted to say it). */
function inputHere(tree: Tree, id: string | undefined): boolean {
  const input = id ? tree.get<Input>(id) : undefined;
  const file = input ? inputPath(tree, input) : undefined;
  return !!file && fs.existsSync(file) && (/^image\/(jpeg|png|hei[cf])$/.test(input!.mime ?? "") || /\.(jpe?g|png|hei[cf])$/i.test(file));
}

/** Where the excerpt of a document the user gave is kept at a level. */
function inputCache(tree: Tree, found: { input: Input; file: string }, level: ExcerptLevel): string {
  const key = crypto.createHash("sha256").update(JSON.stringify({ sha: found.input.sha ?? found.file, level })).digest("hex").slice(0, 16);
  return path.join(tree.root, ".strom", "excerpts", `${found.input.id}-${key}.jpg`);
}

/** A document the user gave as a scan (the source's input): the whole image is its excerpt (cached in .strom/excerpts). */
export function renderInput(tree: Tree, id: string, level: ExcerptLevel = LEVELS[1]!, cachedOnly = false): Excerpt | typeof LATER | undefined {
  const found = inputImage(tree, id);
  if (!found) return undefined;
  const cache = inputCache(tree, found, level);
  const o = exifOrientation(found.file);
  const orient = o && o !== 1 ? { orient: o } : {};
  if (fs.existsSync(cache)) {
    const jpeg = fs.readFileSync(cache);
    const size = imageSize(jpeg);
    if (size) return { media: found.input.id, from: found.input.id, jpeg, ...size, clip: INPUT_MARK, ...orient };
  }
  if (cachedOnly) return LATER;
  const out = finish(decodeImage(fs.readFileSync(found.file)), level);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, out.jpeg);
  return { media: found.input.id, from: found.input.id, ...out, clip: INPUT_MARK, ...orient };
}

/** The same excerpt at a lower level, made from the excerpt itself (quick: no scan is opened again). */
function lower(e: Excerpt, level: ExcerptLevel): Excerpt {
  return { ...e, ...finish(decodeImage(e.jpeg), level) };
}

/** What an export with images took in, and what it left out. */
export interface ExcerptReport {
  sources: number;
  excerpts: number;
  bytes: number;
  /** The quality asked for, and the one used (lower when all would not fit under the limit). */
  asked: string;
  level: string;
  /** Left out to keep under the limit, the farthest from the research first. */
  dropped: string[];
  /** Entries of people outside excerpts.for, and entries nobody in the export cites (in the file only with excerpts.for all). */
  outOfScope: number;
  uncited: number;
  /** With excerpts.for all, entries nobody cites left out: they did not fit under the limit beside the cited ones (which are never made smaller for them). */
  uncitedLeft: string[];
  /** Clips whose image is not on this computer. */
  missing: string[];
  /** Sources on images with no clip: nobody said where the entry is. */
  unclipped: string[];
  /** Sources whose excerpts there was no time to make now (an export with a time budget): the next one makes them. */
  later: string[];
}

/** Why a source with an excerpt has none in the export: outside excerpts.for, over the limit, no time now, or its image not on this computer. */
export type ExcerptLeft = "scope" | "limit" | "later" | "missing";

/**
 * A source whose excerpts the export leaves out, though the research has them (1 _STROM_IMG_OMITTED for the Strom app):
 * why, and the marks of the excerpts not in it (2 _STROM_CLIP) — all of them, or, a source that has some, those whose
 * image is not on this computer ("missing", the one reason a source is ever left out in part).
 */
export interface ExcerptOmitted {
  why: ExcerptLeft;
  clips: string[];
}

/** The marks of a source's excerpts: one for each clip, "input" for a document the user gave as a scan. */
export function excerptMarks(s: Source): string[] {
  return s.clips?.length ? s.clips.map(clipMark) : s.input ? [INPUT_MARK] : [];
}

/** Whether the image a clip is cut from is on this computer (nothing opened, nothing made). */
function clipHere(tree: Tree, shared: string, clip: Clip, all: Media[]): boolean {
  const at = clipPlace(tree, shared, clip, all, LEVELS[1]!);
  return !!at && fs.existsSync(at.file);
}

/**
 * How near the research each cited source is: the nearest of the people who cite it — 0 an ancestor, 1 their
 * family, 2 linked further, 3 linked to nobody of the research (a tree with no research yet: all 0). A source
 * nobody cites is not in it. `persons`: only these people count (an export of one research).
 */
export function sourceNearness(tree: Tree, persons?: Set<string>): Map<string, number> {
  const kin = kinship(tree);
  const far = (id: string) => (kin.size ? (kin.get(id) ?? 3) : 0);
  const near = new Map<string, number>();
  const cite = (source: string, person: string) => {
    if (persons && !persons.has(person)) return;
    near.set(source, Math.min(near.get(source) ?? 3, far(person)));
  };
  for (const p of tree.list<Person>("person")) {
    if (p.retracted) continue;
    for (const e of p.events) for (const c of e.citations) cite(c.source, p.id);
    for (const n of p.names) for (const c of n.citations ?? []) cite(c.source, p.id);
  }
  for (const f of tree.list<Family>("family")) {
    if (f.retracted) continue;
    for (const c of [...f.events.flatMap((e) => e.citations), ...(f.citations ?? [])]) for (const p of f.partners) cite(c.source, p);
  }
  return near;
}

/** How far from the research each scope reaches (3: linked to nobody of it, 4: cited by nobody — only with "all"). */
export const SCOPE_MAX: Record<ExcerptScope, number> = { none: -1, line: 0, family: 1, connected: 2, all: 4 };

/** The images the Strom file carries by the settings: undefined with excerpts.for none, or with no shared folder of images. */
export function excerptSettings(tree: Tree, settings: Settings = new Settings(tree.env, {})): { shared: string; quality: ExcerptQuality; for: ExcerptScope; mb: number } | undefined {
  const shared = settings.shared()?.value;
  const set = settings.excerpts(tree.config);
  if (!shared || set.for === "none") return undefined;
  return { shared, ...set };
}

/**
 * The excerpts of an export: the entries cited by the people the setting excerpts.for names, nearest to the
 * research first, at the quality asked for — made smaller as far as needed to fit under the limit, and only then
 * the farthest left out. The entries nobody cites (no person of the research to measure them by) only with "all":
 * after the cited ones, at the quality those got, each where it still fits — never one of the cited made smaller or
 * left out for them. Everything it decided is in the report, for the user to hear, and why each source has no
 * excerpt in `left`.
 */
export function planExcerpts(
  tree: Tree,
  shared: string,
  opts: {
    quality: ExcerptQuality;
    for: ExcerptScope;
    maxBytes: number;
    persons?: Set<string> | undefined;
    /** Make new excerpts for at most this long (the made ones come from the cache): the rest the next export makes. */
    budgetMs?: number | undefined;
  },
): { of: (s: Source) => Excerpt[]; left: (s: Source) => ExcerptLeft | undefined; omitted: (s: Source) => ExcerptOmitted | undefined; report: ExcerptReport } {
  const all = tree.list<Media>("media");
  const near = sourceNearness(tree, opts.persons);
  const report: ExcerptReport = { sources: 0, excerpts: 0, bytes: 0, asked: opts.quality, level: opts.quality, dropped: [], outOfScope: 0, uncited: 0, uncitedLeft: [], missing: [], unclipped: [], later: [] };
  const why = new Map<string, ExcerptLeft>();
  // the excerpts of a source in the export whose image is not on this computer
  const gone = new Map<string, string[]>();
  const sources = tree.list<Source>("source").filter((s) => !s.retracted);
  // a document the user gave as a scan is its own excerpt
  const given = (s: Source) => !s.clips?.length && !!inputImage(tree, s.input);
  for (const s of sources) if (!s.clips?.length && s.media?.length && !given(s) && near.has(s.id)) report.unclipped.push(s.id);
  const clipped = sources.filter((s) => s.clips?.length || given(s));
  const rank = (s: Source) => near.get(s.id)!;
  const byId = (a: Source, b: Source) => a.id.localeCompare(b.id);
  // the entries nobody cites only with "all": the file stays small, the Strom app asks the research for them later
  const uncited = opts.for === "all" ? clipped.filter((s) => !near.has(s.id)).sort(byId) : [];
  const cited = clipped.filter((s) => near.has(s.id));
  report.uncited = clipped.length - cited.length;
  for (const s of cited) if (rank(s) > SCOPE_MAX[opts.for]) why.set(s.id, "scope");
  report.outOfScope = why.size;
  if (opts.for !== "all") for (const s of clipped) if (!near.has(s.id)) why.set(s.id, "scope");
  const wanted = cited.filter((s) => rank(s) <= SCOPE_MAX[opts.for]).sort((a, b) => rank(a) - rank(b) || byId(a, b));

  // at the quality asked for, from the scans
  let at = Math.max(0, LEVELS.findIndex((l) => l.name === opts.quality));
  const started = Date.now();
  const late = () => opts.budgetMs !== undefined && Date.now() - started > opts.budgetMs;
  const render = (s: Source) => {
    const out: Excerpt[] = [];
    let later = false;
    const lost: string[] = [];
    const take = (e: Excerpt | typeof LATER | undefined, what: string, mark: string) => {
      if (e === LATER) later = true;
      else if (e) out.push(e);
      else {
        report.missing.push(`${s.id} ${what}`);
        lost.push(mark);
      }
    };
    if (!s.clips?.length) take(renderInput(tree, s.input!, LEVELS[at], late()), s.input!, INPUT_MARK);
    for (const c of s.clips ?? []) take(renderClip(tree, shared, c, all, LEVELS[at], late()), c.media, clipMark(c));
    if (lost.length) gone.set(s.id, lost);
    // a source goes in whole or not yet: never half its excerpts
    if (later) {
      report.later.push(s.id);
      why.set(s.id, "later");
      return { source: s.id, excerpts: [] as Excerpt[] };
    }
    if (!out.length) why.set(s.id, "missing");
    return { source: s.id, excerpts: out };
  };
  let made = wanted.map(render);
  // base64 takes a third more
  const bytes = (x: (typeof made)[number]) => x.excerpts.reduce((m, e) => m + Math.ceil(e.jpeg.length / 3) * 4, 0);
  const size = (list: typeof made) => list.reduce((n, x) => n + bytes(x), 0);
  // over the limit: smaller, as far as it takes
  while (size(made) > opts.maxBytes && at < LEVELS.length - 1) {
    at++;
    const level = LEVELS[at]!;
    made = made.map((x) => ({ source: x.source, excerpts: x.excerpts.map((e) => lower(e, level)) }));
  }
  report.level = LEVELS[at]!.name;
  // still over it: the farthest from the research go
  while (made.length && size(made) > opts.maxBytes) {
    const gone = made.pop()!;
    report.dropped.push(gone.source);
    why.set(gone.source, "limit");
  }
  // the entries nobody cites: at the quality the cited ones got, each where there is still room
  let room = opts.maxBytes - size(made);
  for (const s of uncited) {
    // no room left at all: not made just to be left out
    const x = room > 0 ? render(s) : undefined;
    if (x && !x.excerpts.length) continue;
    const n = x ? bytes(x) : 0;
    if (!x || n > room) {
      report.uncitedLeft.push(s.id);
      why.set(s.id, "limit");
      continue;
    }
    room -= n;
    made.push(x);
  }
  const bySource = new Map(made.map((x) => [x.source, x.excerpts]));
  for (const x of made)
    if (x.excerpts.length) {
      report.sources++;
      report.excerpts += x.excerpts.length;
    }
  report.bytes = size(made);
  const omitted = (s: Source): ExcerptOmitted | undefined => {
    const reason = why.get(s.id);
    if (!reason) {
      // in the export, but not whole: the excerpts whose image is not here
      const lost = gone.get(s.id);
      return lost?.length && bySource.get(s.id)?.length ? { why: "missing", clips: lost } : undefined;
    }
    const clips = excerptMarks(s);
    // left out by the setting or the limit, none of its images here: nothing the app could ask for
    const here = reason === "missing" ? false : s.clips?.length ? s.clips.some((c) => clipHere(tree, shared, c, all)) : inputHere(tree, s.input);
    return { why: here ? reason : "missing", clips };
  };
  return { of: (s: Source) => bySource.get(s.id) ?? [], left: (s: Source) => why.get(s.id), omitted, report };
}

/** A level by its name (excerpts.quality, ?level=): undefined when there is none of that name. */
export function excerptLevel(name: string | null | undefined): ExcerptLevel | undefined {
  return LEVELS.find((l) => l.name === name);
}

/**
 * One source's excerpts, for the Strom app asking for those its file left out (the bridge's /excerpt/<S>): each at the
 * level asked for, never made smaller for a limit (that is the file's); `clip`: that one alone. New ones are made for
 * `budgetMs` at most — one always, so each ask gets further — the rest `later` (made by the next ask: the made ones
 * come from the cache). `missing`: the marks whose image is not on this computer.
 */
export function sourceExcerpts(
  tree: Tree,
  shared: string,
  s: Source,
  opts: { level: ExcerptLevel; clip?: string | undefined; budgetMs?: number | undefined },
): { excerpts: { excerpt: Excerpt; region?: Region }[]; missing: string[]; later: string[] } {
  const all = tree.list<Media>("media");
  const started = Date.now();
  let made = 0;
  const late = () => made > 0 && opts.budgetMs !== undefined && Date.now() - started > opts.budgetMs;
  const out: { excerpts: { excerpt: Excerpt; region?: Region }[]; missing: string[]; later: string[] } = { excerpts: [], missing: [], later: [] };
  const take = (e: Excerpt | typeof LATER | undefined, cached: boolean, mark: string, region?: Region) => {
    if (e === LATER) out.later.push(mark);
    else if (e) {
      out.excerpts.push({ excerpt: e, ...(region ? { region } : {}) });
      if (!cached) made++;
    } else out.missing.push(mark);
  };
  if (!s.clips?.length) {
    const found = s.input && (!opts.clip || opts.clip === INPUT_MARK) ? inputImage(tree, s.input) : undefined;
    if (found) {
      const cached = fs.existsSync(inputCache(tree, found, opts.level));
      take(renderInput(tree, s.input!, opts.level, late()), cached, INPUT_MARK);
    }
    else if (s.input && (!opts.clip || opts.clip === INPUT_MARK)) out.missing.push(INPUT_MARK);
    return out;
  }
  for (const c of s.clips) {
    const mark = clipMark(c);
    if (opts.clip && opts.clip !== mark) continue;
    const cache = clipPlace(tree, shared, c, all, opts.level)?.cache;
    const cached = !!cache && fs.existsSync(cache); // before it is made
    take(renderClip(tree, shared, c, all, opts.level, late()), cached, mark, c.region);
  }
  return out;
}

/** Bytes of a JPEG excerpt per pixel at each level, about (a page of a register): for a size said before it is made. */
const PER_PIXEL: Record<string, number> = { sharp: 0.3, normal: 0.22, small: 0.12, smaller: 0.1 };

/**
 * How large a source's excerpts are at a level as the bridge sends them (base64, a third more), without making any:
 * those made already by their file, the rest estimated from the size of their image (`estimated`); `ready`: all made.
 * Only those whose image is here count.
 */
export function excerptSizes(tree: Tree, shared: string, s: Source, level: ExcerptLevel, all: Media[] = tree.list<Media>("media")): { clips: string[]; bytes: number; ready: boolean; estimated: boolean } {
  const b64 = (n: number) => Math.ceil(n / 3) * 4;
  const guess = (w?: number, h?: number) => {
    const px = w && h ? w * h : level.mp * 1e6;
    const k = w && h ? Math.min(1, level.long / Math.max(w, h), Math.sqrt((level.mp * 1e6) / px)) : 1;
    return b64(Math.round(px * k * k * (PER_PIXEL[level.name] ?? 0.22)));
  };
  const out = { clips: [] as string[], bytes: 0, ready: true, estimated: false };
  const count = (cache: string, mark: string, estimate: () => number) => {
    out.clips.push(mark);
    if (fs.existsSync(cache)) out.bytes += b64(fs.statSync(cache).size);
    else {
      out.bytes += estimate();
      out.ready = false;
      out.estimated = true;
    }
  };
  if (!s.clips?.length) {
    // nothing converted to say it: a HEIC photo not converted yet is estimated
    const found = inputImage(tree, s.input, false);
    if (found) count(inputCache(tree, found, level), INPUT_MARK, () => guess());
    return out;
  }
  for (const c of s.clips) {
    const at = clipPlace(tree, shared, c, all, level);
    if (!at || !fs.existsSync(at.file)) continue;
    const { src, region } = at;
    count(at.cache, clipMark(c), () => guess(src.width ? src.width * region.w : undefined, src.height ? src.height * region.h : undefined));
  }
  return out;
}

/** An excerpt as the Strom app takes it: a data URL. */
export function dataUrl(e: Excerpt): string {
  return `data:image/jpeg;base64,${Buffer.from(e.jpeg).toString("base64")}`;
}

/** The margin round an excerpt opened in full: the lines round the entry stay in view. */
const FULL_MARGIN = 0.1;

/** An excerpt in full, for the user's own viewer: a file here, the page in the online archive, or why not. */
export type FullExcerpt = { file: string } | { url: string } | { missing: "clip" | "scan" };

/**
 * One excerpt of a source (by its mark) as sharp as the research has it — the region with more round it, from the
 * sharpest image of that place, not made smaller (a strom-research://excerpt link from the Strom app, which keeps
 * them small). A document the user gave: the file itself. Made once, in .strom/excerpts.
 */
export function fullExcerpt(tree: Tree, shared: string, s: Source, mark: string): FullExcerpt {
  if (mark === INPUT_MARK) {
    const found = !s.clips?.length ? inputImage(tree, s.input) : undefined;
    return found ? { file: found.file } : { missing: "clip" };
  }
  const clip = s.clips?.find((c) => clipMark(c) === mark);
  if (!clip) return { missing: "clip" };
  const all = tree.list<Media>("media");
  const m = all.find((x) => x.id === clip.media);
  if (!m) return { missing: "clip" };
  const pad = FULL_MARGIN * Math.max(clip.region.w, clip.region.h);
  const f = (n: number) => Math.min(1, Math.max(0, n));
  const x = f(clip.region.x - pad);
  const y = f(clip.region.y - pad);
  const wanted = { x, y, w: f(clip.region.x + clip.region.w + pad) - x, h: f(clip.region.y + clip.region.h + pad) - y };
  const sharper = sharperPart(all, m, wanted);
  const src = sharper?.part ?? m;
  const region = sharper?.crop ?? wanted;
  const file = path.join(shared, src.file);
  if (!fs.existsSync(file)) {
    const url = excerptPage(m.url ?? src.url, s);
    return url ? { url } : { missing: "scan" };
  }
  const key = crypto.createHash("sha256").update(JSON.stringify({ sha: src.sha, region, full: 1 })).digest("hex").slice(0, 16);
  const cache = path.join(tree.root, ".strom", "excerpts", `full-${s.id}-${src.id}-${key}.jpg`);
  if (fs.existsSync(cache)) return { file: cache };
  const img = decodeImage(fs.readFileSync(file));
  const px = { x: Math.round(region.x * img.width), y: Math.round(region.y * img.height), w: Math.round(region.w * img.width), h: Math.round(region.h * img.height) };
  const cut = crop(img, px.x, px.y, Math.max(1, Math.min(px.w, img.width - px.x)), Math.max(1, Math.min(px.h, img.height - px.y)));
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, encodeImage(cut, "jpeg", 92));
  return { file: cache };
}
