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
import { inputPath, sharperPart } from "./media.ts";
import { kinship } from "./kin.ts";
import { Settings } from "./config.ts";
import { crop, resize, toGrey, type RawImage } from "../image/image.ts";
import { decodeImage, encodeImage, imageSize } from "../image/index.ts";

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
}

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

/** Not made yet, and there was no time for it now (an export with a time budget): the next export makes it. */
export const LATER = Symbol("later");

/** One clip cut out of its scan at a level (cached in .strom/excerpts); undefined when its image is not on this computer. */
export function renderClip(
  tree: Tree,
  shared: string,
  clip: Clip,
  all: Media[] = tree.list<Media>("media"),
  level: ExcerptLevel = LEVELS[1]!,
  cachedOnly = false,
): Excerpt | typeof LATER | undefined {
  const m = all.find((x) => x.id === clip.media);
  if (!m) return undefined;
  const wanted = withMargin(clip.region);
  // the sharpest image of that place: a part of it fetched sharper, or a bigger copy
  const sharper = sharperPart(all, m, wanted);
  const src = sharper?.part ?? m;
  const region = sharper?.crop ?? wanted;
  const file = path.join(shared, src.file);
  if (!fs.existsSync(file)) return undefined;
  const key = crypto.createHash("sha256").update(JSON.stringify({ sha: src.sha, region, level })).digest("hex").slice(0, 16);
  const cache = path.join(tree.root, ".strom", "excerpts", `${src.id}-${key}.jpg`);
  const url = m.url ?? src.url;
  if (fs.existsSync(cache)) {
    const jpeg = fs.readFileSync(cache);
    const size = imageSize(jpeg);
    if (size) return { media: m.id, from: src.id, jpeg, ...size, url };
  }
  if (cachedOnly) return LATER;
  const img = decodeImage(fs.readFileSync(file));
  const px = { x: Math.round(region.x * img.width), y: Math.round(region.y * img.height), w: Math.round(region.w * img.width), h: Math.round(region.h * img.height) };
  const out = finish(crop(img, px.x, px.y, Math.max(1, Math.min(px.w, img.width - px.x)), Math.max(1, Math.min(px.h, img.height - px.y))), level);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, out.jpeg);
  return { media: m.id, from: src.id, ...out, url };
}

/** The image of a document the user gave (an input), when it is one: JPEG or PNG on this computer. */
function inputImage(tree: Tree, id: string | undefined): { input: Input; file: string } | undefined {
  const input = id ? tree.get<Input>(id) : undefined;
  const file = input ? inputPath(tree, input) : undefined;
  if (!input || !file || !(/^image\/(jpeg|png)$/.test(input.mime ?? "") || /\.(jpe?g|png)$/i.test(file)) || !fs.existsSync(file)) return undefined;
  return { input, file };
}

/** A document the user gave as a scan (the source's input): the whole image is its excerpt (cached in .strom/excerpts). */
export function renderInput(tree: Tree, id: string, level: ExcerptLevel = LEVELS[1]!, cachedOnly = false): Excerpt | typeof LATER | undefined {
  const found = inputImage(tree, id);
  if (!found) return undefined;
  const key = crypto.createHash("sha256").update(JSON.stringify({ sha: found.input.sha ?? found.file, level })).digest("hex").slice(0, 16);
  const cache = path.join(tree.root, ".strom", "excerpts", `${found.input.id}-${key}.jpg`);
  if (fs.existsSync(cache)) {
    const jpeg = fs.readFileSync(cache);
    const size = imageSize(jpeg);
    if (size) return { media: found.input.id, from: found.input.id, jpeg, ...size };
  }
  if (cachedOnly) return LATER;
  const out = finish(decodeImage(fs.readFileSync(found.file)), level);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, out.jpeg);
  return { media: found.input.id, from: found.input.id, ...out };
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
  /** Entries of people outside excerpts.for, and entries nobody in the export cites. */
  outOfScope: number;
  uncited: number;
  /** Clips whose image is not on this computer. */
  missing: string[];
  /** Sources on images with no clip: nobody said where the entry is. */
  unclipped: string[];
  /** Sources whose excerpts there was no time to make now (an export with a time budget): the next one makes them. */
  later: string[];
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
 * The excerpts of an export: the entries of the people the setting excerpts.for names, nearest to the
 * research first, at the quality asked for — made smaller as far as needed to fit under the limit,
 * and only then the farthest left out. Everything it decided is in the report, for the user to hear.
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
): { of: (s: Source) => Excerpt[]; report: ExcerptReport } {
  const all = tree.list<Media>("media");
  const near = sourceNearness(tree, opts.persons);
  const report: ExcerptReport = { sources: 0, excerpts: 0, bytes: 0, asked: opts.quality, level: opts.quality, dropped: [], outOfScope: 0, uncited: 0, missing: [], unclipped: [], later: [] };
  const sources = tree.list<Source>("source").filter((s) => !s.retracted);
  // a document the user gave as a scan is its own excerpt
  const given = (s: Source) => !s.clips?.length && !!inputImage(tree, s.input);
  for (const s of sources) if (!s.clips?.length && s.media?.length && !given(s) && near.has(s.id)) report.unclipped.push(s.id);
  const clipped = sources.filter((s) => s.clips?.length || given(s));
  const rank = (s: Source) => near.get(s.id) ?? 4;
  report.uncited = clipped.filter((s) => !near.has(s.id)).length;
  report.outOfScope = clipped.filter((s) => rank(s) > SCOPE_MAX[opts.for]).length;
  const wanted = clipped.filter((s) => rank(s) <= SCOPE_MAX[opts.for]).sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));

  // at the quality asked for, from the scans
  let at = Math.max(0, LEVELS.findIndex((l) => l.name === opts.quality));
  const started = Date.now();
  const late = () => opts.budgetMs !== undefined && Date.now() - started > opts.budgetMs;
  let made = wanted.map((s) => {
    const out: Excerpt[] = [];
    let later = false;
    const take = (e: Excerpt | typeof LATER | undefined, what: string) => {
      if (e === LATER) later = true;
      else if (e) out.push(e);
      else report.missing.push(`${s.id} ${what}`);
    };
    if (!s.clips?.length) take(renderInput(tree, s.input!, LEVELS[at], late()), s.input!);
    for (const c of s.clips ?? []) take(renderClip(tree, shared, c, all, LEVELS[at], late()), c.media);
    // a source goes in whole or not yet: never half its excerpts
    if (later) {
      report.later.push(s.id);
      return { source: s.id, excerpts: [] as Excerpt[] };
    }
    return { source: s.id, excerpts: out };
  });
  // base64 takes a third more
  const size = (list: typeof made) => list.reduce((n, x) => n + x.excerpts.reduce((m, e) => m + Math.ceil(e.jpeg.length / 3) * 4, 0), 0);
  // over the limit: smaller, as far as it takes
  while (size(made) > opts.maxBytes && at < LEVELS.length - 1) {
    at++;
    const level = LEVELS[at]!;
    made = made.map((x) => ({ source: x.source, excerpts: x.excerpts.map((e) => lower(e, level)) }));
  }
  report.level = LEVELS[at]!.name;
  // still over it: the farthest from the research go
  while (made.length && size(made) > opts.maxBytes) report.dropped.push(made.pop()!.source);
  const bySource = new Map(made.map((x) => [x.source, x.excerpts]));
  for (const x of made)
    if (x.excerpts.length) {
      report.sources++;
      report.excerpts += x.excerpts.length;
    }
  report.bytes = size(made);
  return { of: (s: Source) => bySource.get(s.id) ?? [], report };
}

/** An excerpt as the Strom app takes it: a data URL. */
export function dataUrl(e: Excerpt): string {
  return `data:image/jpeg;base64,${Buffer.from(e.jpeg).toString("base64")}`;
}
