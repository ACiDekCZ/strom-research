// What the bridge (core/live.ts) makes that takes long: the tree's file for the Strom app with its images (GET
// /tree.ged) and one source's excerpts (GET /excerpt/<S>). Making a new excerpt decodes a whole scan (half a second and
// more each), the file of a big research carries tens of MB: made on a thread of its own (liveged-worker.ts), so the
// bridge answers /status and everything else meanwhile — never the app told the research does not answer while it
// works. What a thread made comes back whole; one that fails is an error of that request alone.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { Env } from "./paths.ts";
import { Tree, VERSION } from "./tree.ts";
import { Settings } from "./config.ts";
import { exportGedcom } from "../gedcom/export.ts";
import { dataUrl, excerptLevel, excerptMarks, excerptSettings, INPUT_MARK, LEVELS, planExcerpts, sourceExcerpts, turned, type ExcerptOmitted } from "./excerpt.ts";
import { excerptPage } from "./scanlink.ts";
import { appKnowsArchive, appKnowsNoCouple, appShowsHypothesisDecider, appShowsHypothesisLinks, appShowsOmittedImages, appShowsReadings, appDecidesConflicts, appOpensLinks, appReadsTitles, appShowsCoupleEvents, appShowsEdges, appShowsFactStatus, appShowsSourceReads, appShowsStoryDrafts, appTurnsExcerpts, appReadsSurnameGroups, appReadsLines, appReadsPlaceRecords, appShowsOrigin, appShowsVerify, appConfirmsTranscripts, appReadsSourcesAgain, stromAppUrl } from "./stromapp.ts";
import { surnamesForExport } from "./surnames.ts";
import { lineMarks } from "./lineages.ts";
import { LINK_SCHEME, linkScheme } from "./links.ts";
import { refusal } from "./receive.ts";
import { actsAsArchive } from "./state.ts";
import { verifyMarks } from "./verify.ts";
import { readsAgain } from "./sourceread.ts";
import type { WidgetTree } from "./widget.ts";
import type { Input, Media, Source } from "./model.ts";
import { putImage, sweepImages } from "./liveimages.ts";

/** How a file for the app carries its images: in it (data URLs, as always) or by reference (spec 071, ?images=ref). */
export type GedImages = "data" | "ref";

/** A source whose excerpts the file leaves out though the research has them (/excerpts?missing=1). */
export interface LeftOut {
  source: Source;
  omitted: ExcerptOmitted;
}

/** The tree's file for one head, version of the app and links offered — and what it left out. */
export interface GedMade {
  head: string;
  version: string;
  links: string;
  bytes: Buffer;
  left: { head: string; level: string; sources: LeftOut[] };
  /** A file with its images by reference: the hashes of the images it names (each kept: core/liveimages.ts). */
  images?: string[];
}

/** What the file is made for: the tree, its head now, the app's version, the links this computer takes (said to an app that opens them). */
export interface GedAsk {
  root: string;
  env: Env;
  head: string;
  version: string | undefined;
  links: string[];
  /** New images made for at most so long (the rest the next time the tree changes). */
  budgetMs: number;
  /** The images by reference (each kept by its hash) or in the file (none: in it). */
  images?: GedImages;
}

/** One source's excerpts asked for (/excerpt/<S>[?clip=…&level=…]). */
export interface ExcerptAsk {
  root: string;
  env: Env;
  version: string | undefined;
  id: string;
  clip: string | undefined;
  level: string | null;
  budgetMs: number;
  /** A source with more excerpts than this is answered without the pictures: the app asks for each (?clip=). */
  atOnce: number;
}

/** An answer of the bridge: its status and its JSON. */
export interface Answer {
  code: number;
  body: unknown;
}

/** The tree for the app at a head, for a version of the app (made where it is called: on a thread of its own in the bridge). */
export function buildGed(ask: GedAsk): GedMade {
  const { root, env, head: h, version } = ask;
  const tree = Tree.open(root, env);
  const settings = new Settings(env, {});
  // the images from the cache; new ones made for a while at most (the rest the next time the tree changes)
  const set = excerptSettings(tree);
  const images = set ? planExcerpts(tree, set.shared, { quality: set.quality, for: set.for, maxBytes: set.mb * 1024 * 1024, budgetMs: ask.budgetMs }) : undefined;
  // an app that opens strom-research:// links: each excerpt's mark, and the links this computer takes
  const opens = appOpensLinks(settings, version);
  // …and where the tree ends, for an app that shows it
  const edges = appShowsEdges(settings, version);
  const storyDrafts = appShowsStoryDrafts(settings, version);
  const coupleResi = appShowsCoupleEvents(settings, version);
  const sourceReads = appShowsSourceReads(settings, version);
  const confirms = sourceReads && appConfirmsTranscripts(settings, version);
  const factStatus = appShowsFactStatus(settings, version);
  const archive = appKnowsArchive(settings, version);
  const turnsExcerpts = appTurnsExcerpts(settings, version);
  const noCouple = appKnowsNoCouple(settings, version);
  const titles = appReadsTitles(settings, version);
  const hypothesisLinks = appShowsHypothesisLinks(settings, version);
  const hypothesisDecider = appShowsHypothesisDecider(settings, version);
  const conflictSides = appDecidesConflicts(settings, version);
  const readings = appShowsReadings(settings, version);
  // …and which sources can be read again from their original here, for an app that offers it (never in an archive)
  const shared = settings.shared()?.value;
  const original = appReadsSourcesAgain(settings, version) && !actsAsArchive(tree) ? (s: Source) => readsAgain(tree, shared, s) : undefined;
  // …and why a source has no image though the research has one, for an app that says so and asks for it
  const omitted = !!images && appShowsOmittedImages(settings, version);
  // …and the groups of surname forms and the suggestions rejected, for an app that reads them (strom sync takes them back)
  const surnameGroups = appReadsSurnameGroups(settings, version) ? surnamesForExport(tree) : undefined;
  // …and the bounds of a lineage the person set, for an app that keeps them (strom sync takes them back)
  const lines = appReadsLines(settings, version) ? lineMarks(tree) : undefined;
  // …and the research's place records with each fact's place pointing to its record, for an app that reads them
  const placeRecords = appReadsPlaceRecords(settings, version);
  // …and where each value came from (an import, the user, the research), for an app that shows it (spec 066)
  const origins = appShowsOrigin(settings, version);
  // …and the verification of facts against their originals, for an app that shows it (spec 065)
  const verify = appShowsVerify(settings, version) ? verifyMarks(tree) : undefined;
  const left = {
    head: h,
    level: set?.quality ?? LEVELS[1]!.name,
    sources: images ? tree.list<Source>("source").flatMap((s) => (s.retracted ? [] : [{ source: s, omitted: images.omitted(s) }])).filter((x): x is LeftOut => !!x.omitted) : [],
  };
  const offered = opens ? ask.links : [];
  // the images by reference: each kept by its content's hash as the file names it (the same bytes the file would carry)
  const named = new Set<string>();
  const imageRef = ask.images === "ref" ? (jpeg: Uint8Array) => {
    const sha = putImage(root, jpeg);
    named.add(sha);
    return sha;
  } : undefined;
  const text = exportGedcom(tree, { for: "strom", ...(imageRef ? { imageRef } : {}), ...(h ? { head: h } : {}), ...(surnameGroups ? { surnameGroups } : {}), ...(lines ? { lines } : {}), ...(placeRecords ? { placeRecords } : {}), ...(origins ? { origins } : {}), ...(verify ? { verify } : {}), ...(images ? { excerpts: images.of } : {}), ...(opens ? { clips: true, research: true } : {}), ...(edges ? { edges } : {}), ...(storyDrafts ? { storyDrafts } : {}), ...(coupleResi ? { coupleResi } : {}), ...(sourceReads ? { sourceReads } : {}), ...(confirms ? { confirms } : {}), ...(factStatus ? { factStatus } : {}), ...(archive ? { archive } : {}), ...(turnsExcerpts ? { turnsExcerpts } : {}), ...(noCouple ? { noCouple } : {}), ...(titles ? { titles } : {}), ...(hypothesisLinks ? { hypothesisLinks } : {}), ...(hypothesisDecider ? { hypothesisDecider } : {}), ...(conflictSides ? { conflictSides } : {}), ...(readings ? { readings } : {}), ...(original ? { original } : {}), ...(omitted ? { omitted: images.omitted } : {}), ...(offered.length ? { links: offered, ...(linkScheme(env) !== LINK_SCHEME ? { linkScheme: linkScheme(env) } : {}) } : {}) }).text;
  // its bytes in a buffer of their own: handed to the bridge's thread without a copy
  const bytes = Buffer.from(new ArrayBuffer(Buffer.byteLength(text)));
  bytes.write(text);
  return { head: h, version: version ?? "", links: offered.join(" "), bytes, left, ...(imageRef ? { images: [...named].sort() } : {}) };
}

/**
 * What a tree's file for the app is made by beyond the research's head: the app's version, the links offered, this
 * strom, and what of this computer changes it (the images' settings and folder, the link scheme, the copy of the app,
 * a research acting as an archive). Two asks of one variant at one head get the same file.
 */
export function gedVariant(root: string, env: Env, version: string | undefined, links: string, images: GedImages = "data"): string {
  const tree = Tree.open(root, env);
  const settings = new Settings(env, {});
  // the images by reference: a variant of its own (its own ETag); the file with them in it as before (its ETag kept)
  return JSON.stringify({ strom: VERSION, app: version ?? "", links, excerpts: settings.excerpts(tree.config), shared: settings.shared()?.value ?? "", scheme: linkScheme(env), copy: stromAppUrl(settings), archive: actsAsArchive(tree), ...(images === "ref" ? { images } : {}) });
}

/**
 * Where the bridge keeps the last file it made of each variant (.strom/cache/live-ged): it outlives the bridge (a
 * restart, a newer strom's bridge taking over), and a research that did not change is never made again for it — a
 * large one takes long (found 2026-11-09: a minute of a research of 30,000 images, at each opening of the app).
 */
export function gedStoreDir(root: string): string {
  return path.join(root, ".strom", "cache", "live-ged");
}

/**
 * The variants kept on disk (each about the size of its file): the newest, the rest go — three, so that an app loading
 * the images by reference keeps its file and the whole one it falls back to beside the file of another window.
 */
const STORED_VARIANTS = 3;

/** What is kept beside a stored file: its variant, head, size, and the excerpts it left out (by their sources' IDs). */
interface GedStamp {
  variant: string;
  head: string;
  version: string;
  links: string;
  bytes: number;
  left: { head: string; level: string; sources: { id: string; omitted: ExcerptOmitted }[] };
  /** A file with its images by reference: the hashes of those it names (kept while the file is). */
  images?: string[];
}

const storedName = (variant: string) => crypto.createHash("sha256").update(variant).digest("hex").slice(0, 16);

/** A file written whole or not at all (beside it, then put in its place). */
async function writeWhole(file: string, data: string | Uint8Array): Promise<void> {
  const part = `${file}.${process.pid}.part`;
  await fs.promises.writeFile(part, data);
  await fs.promises.rename(part, file);
}

/**
 * The file made kept on disk for its variant (written whole: the file first, then its stamp); the other variants beyond
 * the newest STORED_VARIANTS, and those of another strom, go.
 */
export async function storeGed(root: string, variant: string, made: GedMade): Promise<void> {
  const dir = gedStoreDir(root);
  await fs.promises.mkdir(dir, { recursive: true });
  const name = storedName(variant);
  const stamp: GedStamp = {
    variant,
    head: made.head,
    version: made.version,
    links: made.links,
    bytes: made.bytes.length,
    left: { head: made.left.head, level: made.left.level, sources: made.left.sources.map((x) => ({ id: x.source.id, omitted: x.omitted })) },
    ...(made.images ? { images: made.images } : {}),
  };
  await writeWhole(path.join(dir, `${name}.ged`), made.bytes);
  await writeWhole(path.join(dir, `${name}.json`), JSON.stringify(stamp));
  // the variants kept: this one and the newest others of this strom
  const others: { name: string; at: number }[] = [];
  for (const f of await fs.promises.readdir(dir)) {
    const m = /^([0-9a-f]{16})\.json$/.exec(f);
    if (!m || m[1] === name) continue;
    try {
      const was = JSON.parse(await fs.promises.readFile(path.join(dir, f), "utf8")) as GedStamp;
      const strom = (JSON.parse(was.variant) as { strom?: string }).strom;
      others.push({ name: m[1]!, at: strom === VERSION ? (await fs.promises.stat(path.join(dir, f))).mtimeMs : -1 });
    } catch {
      others.push({ name: m[1]!, at: -1 });
    }
  }
  others.sort((a, b) => b.at - a.at);
  for (const o of others.filter((o, i) => o.at < 0 || i >= STORED_VARIANTS - 1)) for (const ext of ["json", "ged"]) await fs.promises.rm(path.join(dir, `${o.name}.${ext}`), { force: true });
  // a part left by a bridge that ended under it
  for (const f of await fs.promises.readdir(dir)) if (f.endsWith(".part")) {
    const at = (await fs.promises.stat(path.join(dir, f)).catch(() => undefined))?.mtimeMs;
    if (at !== undefined && Date.now() - at > 3600_000) await fs.promises.rm(path.join(dir, f), { force: true });
  }
  // the images no kept file names any more (and not named within the hour) go
  await sweepImages(root, await keptImages(root));
}

/** The hashes of the images the files kept on disk name (those with the images by reference). */
export async function keptImages(root: string): Promise<Set<string>> {
  const dir = gedStoreDir(root);
  const keep = new Set<string>();
  let files: string[];
  try {
    files = await fs.promises.readdir(dir);
  } catch {
    return keep;
  }
  for (const f of files) {
    if (!/^[0-9a-f]{16}\.json$/.test(f)) continue;
    try {
      for (const sha of (JSON.parse(await fs.promises.readFile(path.join(dir, f), "utf8")) as GedStamp).images ?? []) keep.add(sha);
    } catch {
      // not whole: its images go once nothing else names them
    }
  }
  return keep;
}

/** The files kept on disk by another strom (its bridge gone, never given again): removed — and the images none names. */
export async function tidyStoredGeds(root: string): Promise<void> {
  const dir = gedStoreDir(root);
  let files: string[];
  try {
    files = await fs.promises.readdir(dir);
  } catch {
    files = [];
  }
  for (const f of files) {
    const m = /^([0-9a-f]{16})\.json$/.exec(f);
    if (!m) continue;
    let strom: string | undefined;
    try {
      strom = (JSON.parse((JSON.parse(await fs.promises.readFile(path.join(dir, f), "utf8")) as GedStamp).variant) as { strom?: string }).strom;
    } catch {
      // not whole: removed
    }
    if (strom !== VERSION) for (const ext of ["json", "ged"]) await fs.promises.rm(path.join(dir, `${m[1]}.${ext}`), { force: true });
  }
  await sweepImages(root, await keptImages(root));
}

/**
 * The file kept on disk for a variant: of that head (`head`), or the last one made whatever its head (none: nothing
 * kept, kept by another strom, or not whole). Its excerpts left out told by the research as it is now.
 */
export async function storedGed(root: string, env: Env, variant: string, head?: string): Promise<GedMade | undefined> {
  const dir = gedStoreDir(root);
  const name = storedName(variant);
  try {
    const stamp = JSON.parse(await fs.promises.readFile(path.join(dir, `${name}.json`), "utf8")) as GedStamp;
    if (stamp.variant !== variant || (head !== undefined && stamp.head !== head)) return undefined;
    const bytes = await fs.promises.readFile(path.join(dir, `${name}.ged`));
    if (bytes.length !== stamp.bytes) return undefined;
    const tree = Tree.open(root, env);
    const sources = stamp.left.sources.flatMap((x) => {
      const source = tree.get<Source>(x.id);
      return source ? [{ source, omitted: x.omitted }] : [];
    });
    return { head: stamp.head, version: stamp.version, links: stamp.links, bytes, left: { head: stamp.left.head, level: stamp.left.level, sources }, ...(stamp.images ? { images: stamp.images } : {}) };
  } catch {
    return undefined;
  }
}

/**
 * One source's excerpts for the app: as its file would carry them (turned for an app that does not turn them), at the
 * research's quality or the one asked for, never made smaller for a limit. Made for `budgetMs` at most: the rest later
 * (202, asked again — the made ones come from the cache).
 */
export function excerptAnswer(ask: ExcerptAsk): Answer {
  const { root, env, version, id, clip } = ask;
  if (!/^S\d{1,9}$/.test(id)) return { code: 400, body: refusal("/excerpt/S… (a source of the research)", "source.id", { source: id.slice(0, 32) }) };
  if (clip !== undefined && clip !== INPUT_MARK && !/^c[0-9a-f]{10}$/.test(clip)) return { code: 400, body: refusal("?clip=<the excerpt's mark, _STROM_CLIP>", "excerpt.mark", { clip: clip.slice(0, 32) }) };
  const tree = Tree.open(root, env);
  const s = tree.get<Source>(id);
  if (!s || s.type !== "source") return { code: 404, body: refusal(`the research has no source ${id}`, "source.unknown", { source: id }) };
  if (s.retracted || s.mergedInto) {
    // merged into another: where it went (that one as it is now)
    let to = s.mergedInto ? tree.get<Source>(s.mergedInto) : undefined;
    for (let hops = 0; to?.mergedInto && hops < 10; hops++) to = tree.get<Source>(to.mergedInto) ?? to;
    return { code: 410, body: { ...refusal(`the source ${id} was taken back`, "source.retracted", { source: id }), ...(to && !to.retracted ? { movedTo: to.id } : {}) } };
  }
  const marks = excerptMarks(s);
  if (clip && !marks.includes(clip)) return { code: 404, body: refusal(`the source ${id} has no excerpt ${clip}`, "excerpt.unknown", { source: id, clip }) };
  const settings = new Settings(env, {});
  // a level this strom does not know (a newer app's) is no refusal: the research's quality, said in the answer
  const level = excerptLevel(ask.level) ?? excerptLevel(settings.excerpts(tree.config).quality) ?? LEVELS[1]!;
  const shared = settings.shared()?.value;
  const got = shared || !s.clips?.length ? sourceExcerpts(tree, shared ?? "", s, { level, clip, budgetMs: ask.budgetMs }) : { excerpts: [], missing: clip ? [clip] : marks, later: [] };
  if (got.later.length) return { code: 202, body: { later: true, source: id, made: got.excerpts.length, left: got.later.length } };
  const turns = appTurnsExcerpts(settings, version);
  const each = !clip && got.excerpts.length > ask.atOnce;
  const excerpts = got.excerpts.map(({ excerpt, region }) => {
    const e = turns ? excerpt : turned(excerpt);
    const original = tree.get<Media | Input>(e.media);
    const page = excerptPage(e.url, s);
    return {
      clip: e.clip,
      ...(original?.sha ? { sha: original.sha } : {}),
      ...(region ? { region } : {}),
      ...(e.orient ? { orient: e.orient } : {}),
      width: e.width,
      height: e.height,
      mime: "image/jpeg",
      bytes: e.jpeg.length,
      ...(page ? { url: page } : {}),
      ...(each ? {} : { dataUrl: dataUrl(e) }),
    };
  });
  return { code: 200, body: { source: id, level: level.name, excerpts, missing: got.missing, ...(each ? { each: true } : {}) } };
}

/** strom's fixes of a research for the app (GET /fixes): who asks, and what they are told. */
export type FixesAsk = { root: string; env: Env };
/** The fixes found, as JSON, and the stamp of what they were found by (`fixesStamp`, the archive or not). */
export type FixesMade = { key: string; text: string };

/** What a thread is asked to do (liveged-worker.ts). */
export type Job = { job: "ged"; ask: GedAsk } | { job: "excerpt"; ask: ExcerptAsk } | { job: "fixes"; ask: FixesAsk } | { job: "widget"; ask: WidgetAsk };
/** What it says back: what it made, or why it could not. */
export type Done = { ok: true; made: GedMade | { code: number; text: string } | FixesMade | WidgetTree | null } | { ok: false; message: string; stack?: string };
/** The overview of a research for the desktop's widget (core/widget.ts widgetTree), as its bridge runs. */
export type WidgetAsk = { root: string; env: Env; now: number };

/** Where the thread's code is: next to this file, the same kind (the sources run as .ts, the package as .js). */
const WORKER = new URL(`./liveged-worker${path.extname(fileURLToPath(import.meta.url))}`, import.meta.url);

/** The threads at work now (ended with the bridge). */
const running = new Set<Worker>();

/** Every thread at work ended (the bridge ends: nothing it made is wanted any more). */
export function endWork(): void {
  for (const w of running) void w.terminate();
  running.clear();
}

/** One job on a thread of its own: what it made, or an error (the thread failed, or ended without a word). */
function onThread(job: Job): Promise<Done & { ok: true }> {
  return new Promise((resolve, reject) => {
    let said = false;
    const env = Object.fromEntries(Object.entries(job.ask.env).filter((e): e is [string, string] => typeof e[1] === "string"));
    const w = new Worker(WORKER, { workerData: job, env });
    running.add(w);
    // nothing to wait for once the bridge ends
    w.unref();
    w.once("message", (done: Done) => {
      said = true;
      if (done.ok) resolve(done);
      else reject(Object.assign(new Error(done.message), done.stack ? { stack: done.stack } : {}));
    });
    w.once("error", (e) => {
      said = true;
      reject(e);
    });
    w.once("exit", (code) => {
      running.delete(w);
      if (!said) reject(new Error(`the thread making it ended (${code}) without a word`));
    });
  });
}

/** The tree's file made on a thread of its own. */
export async function gedOnThread(ask: GedAsk): Promise<GedMade> {
  const done = await onThread({ job: "ged", ask });
  const made = done.made as GedMade;
  // a buffer came over as its bytes (Uint8Array)
  return { ...made, bytes: Buffer.from(made.bytes.buffer, made.bytes.byteOffset, made.bytes.byteLength) };
}

/**
 * strom's fixes of a research found on a thread of its own (they read every person, source and reading: seconds on a
 * large research, after each of its commits, as the app asks for them at each new head — found 2026-11-04).
 */
export async function fixesOnThread(ask: FixesAsk): Promise<FixesMade> {
  return (await onThread({ job: "fixes", ask })).made as FixesMade;
}

/** strom's fixes of a research for the app, found here: the stamp they are found by, and what they say. */
export async function fixesHere(ask: FixesAsk): Promise<FixesMade> {
  const m = await import("../commands/fixchecks.ts");
  const tree = Tree.open(ask.root, ask.env);
  const settings = new Settings(ask.env, {});
  const archive = actsAsArchive(tree);
  const key = `${m.fixesStamp(tree, m.fixEnvOf(settings, ask.env, tree))}|${archive}`;
  return { key, text: JSON.stringify(m.fixesForApp(tree, settings, ask.env, { archive })) };
}

/** The widget's overview of a research worked out on a thread of its own (undefined: an archive, nothing to show). */
export async function widgetOnThread(ask: WidgetAsk): Promise<WidgetTree | undefined> {
  return ((await onThread({ job: "widget", ask })).made as WidgetTree | null) ?? undefined;
}

/** The widget's overview of a research, worked out here (the thread's part). */
export async function widgetHere(ask: WidgetAsk): Promise<WidgetTree | null> {
  const { widgetTree } = await import("./widget.ts");
  return widgetTree(ask.root, ask.env, { running: true, now: ask.now }) ?? null;
}

/** One source's excerpts made on a thread of its own: the status and the JSON text. */
export async function excerptOnThread(ask: ExcerptAsk): Promise<{ code: number; text: string }> {
  const done = await onThread({ job: "excerpt", ask });
  return done.made as { code: number; text: string };
}
