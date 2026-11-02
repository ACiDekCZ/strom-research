// What the bridge (core/live.ts) makes that takes long: the tree's file for the Strom app with its images (GET
// /tree.ged) and one source's excerpts (GET /excerpt/<S>). Making a new excerpt decodes a whole scan (half a second and
// more each), the file of a big research carries tens of MB: made on a thread of its own (liveged-worker.ts), so the
// bridge answers /status and everything else meanwhile — never the app told the research does not answer while it
// works. What a thread made comes back whole; one that fails is an error of that request alone.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { Env } from "./paths.ts";
import { Tree } from "./tree.ts";
import { Settings } from "./config.ts";
import { exportGedcom } from "../gedcom/export.ts";
import { dataUrl, excerptLevel, excerptMarks, excerptSettings, INPUT_MARK, LEVELS, planExcerpts, sourceExcerpts, turned, type ExcerptOmitted } from "./excerpt.ts";
import { excerptPage } from "./scanlink.ts";
import { appKnowsArchive, appKnowsNoCouple, appShowsHypothesisLinks, appShowsOmittedImages, appShowsReadings, appDecidesConflicts, appOpensLinks, appReadsTitles, appShowsCoupleEvents, appShowsEdges, appShowsFactStatus, appShowsSourceReads, appShowsStoryDrafts, appTurnsExcerpts, appReadsSurnameGroups, appReadsLines, appReadsPlaceRecords } from "./stromapp.ts";
import { surnamesForExport } from "./surnames.ts";
import { lineMarks } from "./lineages.ts";
import { LINK_SCHEME, linkScheme } from "./links.ts";
import { refusal } from "./receive.ts";
import type { Input, Media, Source } from "./model.ts";

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
  const factStatus = appShowsFactStatus(settings, version);
  const archive = appKnowsArchive(settings, version);
  const turnsExcerpts = appTurnsExcerpts(settings, version);
  const noCouple = appKnowsNoCouple(settings, version);
  const titles = appReadsTitles(settings, version);
  const hypothesisLinks = appShowsHypothesisLinks(settings, version);
  const conflictSides = appDecidesConflicts(settings, version);
  const readings = appShowsReadings(settings, version);
  // …and why a source has no image though the research has one, for an app that says so and asks for it
  const omitted = !!images && appShowsOmittedImages(settings, version);
  // …and the groups of surname forms and the suggestions rejected, for an app that reads them (strom sync takes them back)
  const surnameGroups = appReadsSurnameGroups(settings, version) ? surnamesForExport(tree) : undefined;
  // …and the bounds of a lineage the person set, for an app that keeps them (strom sync takes them back)
  const lines = appReadsLines(settings, version) ? lineMarks(tree) : undefined;
  // …and the research's place records with each fact's place pointing to its record, for an app that reads them
  const placeRecords = appReadsPlaceRecords(settings, version);
  const left = {
    head: h,
    level: set?.quality ?? LEVELS[1]!.name,
    sources: images ? tree.list<Source>("source").flatMap((s) => (s.retracted ? [] : [{ source: s, omitted: images.omitted(s) }])).filter((x): x is LeftOut => !!x.omitted) : [],
  };
  const offered = opens ? ask.links : [];
  const text = exportGedcom(tree, { for: "strom", ...(h ? { head: h } : {}), ...(surnameGroups ? { surnameGroups } : {}), ...(lines ? { lines } : {}), ...(placeRecords ? { placeRecords } : {}), ...(images ? { excerpts: images.of } : {}), ...(opens ? { clips: true, research: true } : {}), ...(edges ? { edges } : {}), ...(storyDrafts ? { storyDrafts } : {}), ...(coupleResi ? { coupleResi } : {}), ...(sourceReads ? { sourceReads } : {}), ...(factStatus ? { factStatus } : {}), ...(archive ? { archive } : {}), ...(turnsExcerpts ? { turnsExcerpts } : {}), ...(noCouple ? { noCouple } : {}), ...(titles ? { titles } : {}), ...(hypothesisLinks ? { hypothesisLinks } : {}), ...(conflictSides ? { conflictSides } : {}), ...(readings ? { readings } : {}), ...(omitted ? { omitted: images.omitted } : {}), ...(offered.length ? { links: offered, ...(linkScheme(env) !== LINK_SCHEME ? { linkScheme: linkScheme(env) } : {}) } : {}) }).text;
  // its bytes in a buffer of their own: handed to the bridge's thread without a copy
  const bytes = Buffer.from(new ArrayBuffer(Buffer.byteLength(text)));
  bytes.write(text);
  return { head: h, version: version ?? "", links: offered.join(" "), bytes, left };
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

/** What a thread is asked to do (liveged-worker.ts). */
export type Job = { job: "ged"; ask: GedAsk } | { job: "excerpt"; ask: ExcerptAsk };
/** What it says back: what it made, or why it could not. */
export type Done = { ok: true; made: GedMade | { code: number; text: string } } | { ok: false; message: string; stack?: string };

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

/** One source's excerpts made on a thread of its own: the status and the JSON text. */
export async function excerptOnThread(ask: ExcerptAsk): Promise<{ code: number; text: string }> {
  const done = await onThread({ job: "excerpt", ask });
  return done.made as { code: number; text: string };
}
