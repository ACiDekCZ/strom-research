// Checks of strom's fixes (strom fixes): a fix of strom's holds from then on — what was done before it stays as it was.
// A check finds in the research's own data, free (no agent, no network), what a fix left behind there, says what it
// is and what setting it right would do, and keeps the person's decision with the research (strom.json "fixes", for
// every computer it goes to). Setting it right that costs (a reading again) only a person starts, in their terminal.
// A check is one entry of FIX_CHECKS: its id, the version that fixed it, what it finds and what sets it right.
// Not only a fix: another model or agent reading now (new-model) offers what earlier readings left open to be read
// again with it — once for each agent and model.

import fs from "node:fs";
import path from "node:path";
import type { Conflict, Family, Media, Person, Region, Source, TreeConfig } from "../core/model.ts";
import type { Tree } from "../core/tree.ts";
import { VERSION } from "../core/tree.ts";
import { sharperCover } from "../core/media.ts";
import { shownToFile } from "../image/image.ts";
import { mediaOrient } from "../core/views.ts";
import { median, readJournal } from "../core/readstats.ts";
import { metricsDir } from "../core/metrics.ts";
import { runGit } from "../core/git.ts";
import { READER_MS_MAX, readExpectDefault } from "../core/live-read.ts";
import { foldText } from "../core/text.ts";
import type { Finding } from "../core/reader.ts";
import { loadReadings, type Block, type Reading } from "./readings.ts";
import { isArchive } from "../core/mode.ts";
import { ui, type UIKey } from "../cli/ui.ts";
import type { Context } from "../cli/context.ts";
import { readerAgent } from "./readers.ts";
import { calibrationKey, fits, keyOf, loadAliases, resolveKey, splitKey, UNKNOWN_KEY, type Aliases } from "../core/modelkey.ts";
import { sameLineNewer } from "../agents/models.ts";
import { kinship } from "../core/kin.ts";
import { listReadings, loadState, resultPath, type ReadResult } from "../core/document.ts";

/** One earlier reading of one place, to be read again. */
export interface FixItem {
  /** What it is known by: the earlier reading, the image, the place. */
  key: string;
  /** The earlier reading (its stem: strom readings <stem>). */
  reading: string;
  /** The whole image read (M…), and its book and number (B…:n). */
  media: string;
  ref?: string;
  /** The place read: fractions of the image as shown, as strom read --crop takes it (none: the whole image, a document). */
  crop?: string;
  question: string;
  context?: string;
  blind: boolean;
  /** The sharper copy a reading reads from now (M…), and its detail against the whole image (blind-reduced). */
  from?: string;
  gain?: number;
  /** The place taken from where the source's entry is on the image, not from strom's record of the reading. */
  estimated: boolean;
  /** The agent and model it was read with (new-model): its key, "unknown" where nothing says. */
  before?: string;
  /** Why it is worth reading again (new-model), the most useful first. */
  reasons?: Reason[];
  /** A source on it is of the direct line: an ancestor of the people the research is for (new-model). */
  direct?: boolean;
  /** Dates or witnesses at stake: a fact citing a source on it has a date or witnesses, a person's name or a date is uncertain. */
  facts?: boolean;
  /** Readers it takes (a document read by two: 2); else one. */
  readers?: number;
  /** A reading of a document (D…): read again as a new reading of the same pages and parts, beside it. */
  document?: { files: string[]; regions: string[]; readers: number; note?: string; persons?: string[] };
  /** Sources of the place (their entry on the image overlaps it). */
  sources: string[];
  /** Places the earlier reading of this image marked uncertain ([?]) or could not read. */
  unclear: number;
  /** When the earlier reading was. */
  at?: string;
}

export interface FixFindings {
  /** Most promising first. */
  items: FixItem[];
  /** Of them, the place known from strom's record of the reading, and taken from the source's entry (an estimate). */
  exact: number;
  estimated: number;
  /** Earlier readings that may be of it, with nothing to tell their place by. */
  unjudged: number;
  /** Earlier readings the items are of. */
  readings: number;
  /** The agent and model reading now and those the earlier readings were read with, how many each (new-model); `newer`: the
   * model now is a newer version of the same line as each of them (agents/models.ts) — never guessed across lines. */
  models?: { now: string; before: { key: string; readings: number }[]; newer: boolean };
}

/** What a check looks with: the shared folder (the images' orientation), the agent and model a reader reads with now. */
export interface FixEnv {
  shared: string | undefined;
  reader?: { agent: string; model: string | undefined };
}

/** The agent and model of strom read's readers here now, and the shared folder. */
export function fixEnv(ctx: Context, tree: Tree): FixEnv {
  const agent = readerAgent(ctx, tree);
  return { shared: ctx.settings.shared()?.value, reader: { agent, model: ctx.settings.models(agent, tree.config).vision } };
}

export interface FixCheck {
  id: string;
  /** The strom version that fixed it. */
  since: string;
  /** Setting it right costs: readers read again. */
  paid: boolean;
  /** How it is set right: read again, as the earlier reading asked (blind-reduced: from the sharper copy). */
  remedy: "read-again";
  /** What it counts: places on images, or readings (each read again whole: all its images, a document). */
  unit: "place" | "reading";
  /** The phrases of the task where a reading again differs (core/phrases.ts): fix.reread, fix.model. */
  phrases: "fix.reread" | "fix.model";
  detect(tree: Tree, env: FixEnv): FixFindings;
  /** Where its decision is kept in strom.json "fixes" (new-model: once for each agent and model): else its id. */
  decisionKey?(tree: Tree, env: FixEnv): string;
}

/** A decision about a check, kept in strom.json: the person's no (left as it is), or set right. */
export interface FixDecision {
  decision: "declined" | "fixed";
  at: string;
  /** The strom it was decided with. */
  version: string;
}

export type FixStateName = "pending" | "declined" | "fixed" | "nothing";

export interface FixState {
  check: FixCheck;
  /** Where its decision is kept (strom.json "fixes"). */
  key: string;
  found: FixFindings;
  decision?: FixDecision;
  state: FixStateName;
}

// ── the first check: a blind reading of a crop read from the whole image, reduced ───────────────────────────────

/**
 * Until 1.19.0-beta.2 (17db636) strom read --crop read a crop of a whole image from the whole image although a part
 * of it fetched sharper held the place: the readers (blind ones above all, the check of what the researcher read) saw
 * it reduced. When a reading began after this, strom read it from the sharper part.
 */
export const BLIND_REDUCED_FIXED_AT = "2026-10-21T13:42:49Z";
/** A view made for a reader this long before its reader began belongs to its reading. */
const VIEW_BEFORE_MS = 30 * 60_000;
const VIEW_AFTER_MS = 2 * 60_000;
/** strom makes a reader's views before it begins it: of a reader whose own start is known, only those (ms rounding). */
const VIEW_EXACT_MS = 100;
/** Views of one reading are made within moments of each other. */
const VIEW_CLUSTER_MS = 10_000;
/** A later reading from a sharper copy that covers this much of a place has read it again. */
const COVERED = 0.8;
/** A reading of so many images at most is one of single entries (an estimate of its crop is taken only for it). */
const FEW_IMAGES = 3;

interface ViewRec {
  t: number;
  key: string;
  region: Region;
  W: number;
  H: number;
  orient?: number;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** Of a region (fractions), the share another covers. */
function covered(r: Region, by: Region): number {
  const w = Math.min(r.x + r.w, by.x + by.w) - Math.max(r.x, by.x);
  const h = Math.min(r.y + r.h, by.y + by.h) - Math.max(r.y, by.y);
  return w > 0 && h > 0 && r.w > 0 && r.h > 0 ? (w * h) / (r.w * r.h) : 0;
}

/** "0.05,0.4,0.45,0.18" → a region (fractions); anything else undefined. */
export function cropRegion(v: string | undefined): Region | undefined {
  const n = (v ?? "").split(",").map((x) => Number(x.trim()));
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x) || x < 0 || x > 1) || !(n[2]! > 0 && n[3]! > 0)) return undefined;
  return { x: n[0]!, y: n[1]!, w: n[2]!, h: n[3]! };
}

const cropText = (r: Region) => [r.x, r.y, r.w, r.h].map((v) => Number(v.toFixed(4))).join(",");

/** The head lines of a report strom wrote of each image read (readHead in read.ts). */
export function headImages(head: string): { id: string; ref?: string; crop?: string; from?: string }[] {
  const out: { id: string; ref?: string; crop?: string; from?: string }[] = [];
  for (const m of head.matchAll(/^Image: (M\d+)(?: \(([Bb]\d+:\d+)\))?(?: · crop ([\d.,]+))?(?: · from (M\d+))?/gmu))
    out.push({ id: m[1]!, ...(m[2] ? { ref: m[2] } : {}), ...(m[3] ? { crop: m[3] } : {}), ...(m[4] ? { from: m[4] } : {}) });
  return out;
}

/** The uncertain and illegible places of a reader's block. */
export function unclearOf(b: Pick<Finding, "entries" | "illegible" | "text">): number {
  return (b.text.match(/\[\?\]/gu)?.length ?? 0) + (b.illegible?.length ?? 0);
}

/** When each report under notes/readings came into the research (git), by its file name — asked once, only when needed. */
function addedTimes(root: string): Map<string, number> {
  const out = new Map<string, number>();
  const r = runGit(root, ["log", "--diff-filter=A", "--format=@%cI", "--name-only", "--", "notes/readings"]);
  if (r.status !== 0) return out;
  let t = NaN;
  for (const line of r.stdout.split("\n")) {
    if (line.startsWith("@")) t = Date.parse(line.slice(1));
    else if (line.trim() && Number.isFinite(t)) out.set(path.basename(line.trim(), ".md"), t);
  }
  return out;
}

function blindReducedDetect(tree: Tree, env: FixEnv): FixFindings {
  const use = useOf(tree);
  const shared = env.shared;
  const media = tree.list<Media>("media");
  const byId = new Map(media.map((m) => [m.id, m]));
  const sources = tree.list<Source>("source").filter((s) => !s.retracted);
  const readings = loadReadings(tree);
  // when each reading began (its readers, this computer)
  const began = new Map<string, number>();
  const capOf = new Map<string, number>();
  // when the reader of each image of a reading began, and every reader's start of an image (any reading)
  const beganImage = new Map<string, number>();
  const startsOf = new Map<string, number[]>();
  for (const r of readJournal(path.join(metricsDir(tree.root), "readers.jsonl"))) {
    if (r.kind !== "read" || typeof r.reader !== "string" || typeof r.at !== "string") continue;
    const stem = r.reader.replace(/^read-/u, "").replace(/-\d+$/u, "");
    const t = Date.parse(r.at) - (num(r.wallMs) ?? num(r.ms) ?? 0);
    if (Number.isFinite(t) && t < (began.get(stem) ?? Infinity)) began.set(stem, t);
    if (num(r.cap)) capOf.set(stem, num(r.cap)!);
    if (!Number.isFinite(t)) continue;
    // the images it read (an older strom's record: those its reading is named after)
    for (const id of Array.isArray(r.imageIds) ? r.imageIds : (stem.match(/M\d+/gu) ?? [])) {
      if (typeof id !== "string") continue;
      const k = `${stem}|${id}`;
      if (t < (beganImage.get(k) ?? Infinity)) beganImage.set(k, t);
      startsOf.set(id, [...(startsOf.get(id) ?? []), t]);
    }
  }
  // the views made for readers (this computer): a crop, the image it is of, when
  const views = new Map<string, ViewRec[]>();
  const viewsFile = path.join(tree.root, ".strom", "views", "views.jsonl");
  if (fs.existsSync(viewsFile))
    for (const v of readJournal(viewsFile)) {
      if (v.reader !== 1 || (v.kind !== "crop" && v.kind !== "split") || typeof v.key !== "string") continue;
      const reg = v.region as Region | undefined;
      const W = num(v.W);
      const H = num(v.H);
      const t = typeof v.at === "string" ? Date.parse(v.at) : NaN;
      if (!reg || !W || !H || !Number.isFinite(t)) continue;
      const list = views.get(v.key) ?? [];
      list.push({ t, key: v.key, region: reg, W, H, ...(num(v.orient) ? { orient: num(v.orient)! } : {}) });
      views.set(v.key, list);
    }
  let added: Map<string, number> | undefined;
  const timeOf = (r: Reading): number | undefined => {
    const b = began.get(r.stem);
    if (b !== undefined) return b;
    added ??= addedTimes(tree.root);
    const times = r.reports.map((n) => added!.get(n)).filter((t): t is number => t !== undefined);
    return times.length ? Math.min(...times) : undefined;
  };
  /**
   * The views of one reading of an image: those made last before its reader began, within moments of each other —
   * never those of another reader of the same image (made before it began). Its reader's own start unknown here and
   * views of more than one moment near: which it read is not sure (an estimate).
   */
  const viewsOf = (stem: string, key: string, t: number): { views: ViewRec[]; estimated: boolean } => {
    const own = beganImage.get(`${stem}|${key}`);
    const at = own ?? t;
    const others = (startsOf.get(key) ?? []).filter((s) => s !== own);
    const after = Math.min(at + (own !== undefined ? VIEW_EXACT_MS : VIEW_AFTER_MS), ...others.filter((s) => s > at));
    const before = Math.max(at - VIEW_BEFORE_MS, ...others.filter((s) => s < at));
    const near = (views.get(key) ?? []).filter((v) => v.t > before && v.t <= after);
    if (!near.length) return { views: [], estimated: false };
    const last = Math.max(...near.map((v) => v.t));
    const cluster = near.filter((v) => v.t >= last - VIEW_CLUSTER_MS);
    return { views: cluster, estimated: own === undefined && cluster.length < near.length };
  };
  // places read again from a sharper copy since (a later reading): by whole image, fractions as the file lies
  const readSharper = new Map<string, { t: number; r: Region }[]>();
  const sharperRead = (whole: string, t: number, r: Region) => readSharper.set(whole, [...(readSharper.get(whole) ?? []), { t, r }]);
  const raw: (FixItem & { t: number; fileRegion: Region })[] = [];
  let unjudged = 0;
  for (const r of readings) {
    const t = timeOf(r) ?? Date.parse(`${r.stem.slice(0, 10)}T23:59:59Z`);
    if (!Number.isFinite(t)) continue;
    const heads = [...r.heads.values()];
    // a reading strom recorded (Strom: in its head): read from the sharper copy where there was one
    if (heads.some((h) => /^Strom: /mu.test(h))) {
      for (const i of heads.flatMap(headImages)) {
        const reg = cropRegion(i.crop);
        const whole = byId.get(i.id);
        if (i.from && reg && whole) sharperRead(i.id, t, shownToFile(reg, mediaOrient(shared, whole)));
      }
      continue;
    }
    // the images it read: its blocks' and its name's
    const ids = new Set<string>([...r.blocks.map((b) => b.media).filter((m): m is string => !!m), ...(r.stem.match(/M\d+/gu) ?? [])]);
    const few = ids.size <= FEW_IMAGES && !/^\d{4}-\d{2}-\d{2}-[Bb]\d+-\d+-\d+/u.test(r.stem);
    for (const id of ids) {
      const m = byId.get(id);
      if (!m || m.retracted) continue;
      const { views: own, estimated: unsure } = viewsOf(r.stem, id, t);
      if (m.part) {
        // a part read: the place in the whole image read sharper (when its views say where)
        if (m.recordset !== undefined && m.image !== undefined) {
          const whole = media.find((x) => !x.part && !x.retracted && x.recordset === m.recordset && x.image === m.image);
          const p = m.part;
          for (const v of own) {
            const f = shownToFile({ x: v.region.x / v.W, y: v.region.y / v.H, w: v.region.w / v.W, h: v.region.h / v.H }, v.orient);
            if (whole) sharperRead(whole.id, t, { x: p.x + f.x * p.w, y: p.y + f.y * p.h, w: f.w * p.w, h: f.h * p.h });
          }
        }
        continue;
      }
      let places: { file: Region; estimated: boolean }[] = [];
      if (own.length) {
        // the crop read: all its views (a big crop is read in overlapping tiles)
        const x0 = Math.min(...own.map((v) => v.region.x));
        const y0 = Math.min(...own.map((v) => v.region.y));
        const x1 = Math.max(...own.map((v) => v.region.x + v.region.w));
        const y1 = Math.max(...own.map((v) => v.region.y + v.region.h));
        const v = own[0]!;
        places = [{ file: shownToFile({ x: x0 / v.W, y: y0 / v.H, w: (x1 - x0) / v.W, h: (y1 - y0) / v.H }, v.orient), estimated: unsure }];
      } else if ((views.size === 0 || !views.has(id)) && r.blind && few && t < Date.parse(BLIND_REDUCED_FIXED_AT)) {
        // no record of its views here (another computer): the places of the sources' entries on the image, an estimate
        places = sources.flatMap((s) => (s.clips ?? []).filter((c) => c.media === id).map((c) => ({ file: c.region, estimated: true })));
        if (!places.length) unjudged++;
      }
      for (const place of places) {
        const then = media.filter((x) => !x.created || Date.parse(x.created) <= t);
        const use = sharperCover(then, m, place.file).use;
        if (!use) continue;
        const block = r.blocks.filter((b) => b.media === id);
        const orient = mediaOrient(shared, m);
        // shown as strom read --crop takes it
        const shown = shownToFile(place.file, orient === 6 ? 8 : orient === 8 ? 6 : orient);
        const crop = cropText(shown);
        raw.push({
          key: `${r.stem}|${id}|${crop}`,
          reading: r.stem,
          media: id,
          ...(m.recordset !== undefined && m.image !== undefined ? { ref: `${m.recordset}:${m.image}` } : {}),
          crop,
          question: r.question ?? "",
          ...(r.context ? { context: r.context } : {}),
          blind: !!r.blind,
          from: use.part.id,
          gain: Math.round(use.gain * 10) / 10,
          estimated: place.estimated,
          sources: sourcesOf(sources, media, m, place.file),
          unclear: block.reduce((n, b) => n + unclearOf(b), 0),
          at: new Date(t).toISOString(),
          t,
          fileRegion: place.file,
        });
      }
    }
  }
  // read again from a sharper copy since: set right already
  const seen = new Set<string>();
  const items = raw
    .filter((i) => !(readSharper.get(i.media) ?? []).some((s) => s.t > i.t && covered(i.fileRegion, s.r) >= COVERED))
    .filter((i) => !seen.has(i.key) && seen.add(i.key))
    .map((i) => withUse(i, use))
    .sort(byUse)
    // an estimate knows the entries on the image, not which one the reading asked of: one place for each reading of an image
    .filter((i) => !i.estimated || (!seen.has(`${i.reading}|${i.media}`) && seen.add(`${i.reading}|${i.media}`)))
    .map(({ t: _t, fileRegion: _f, ...i }) => i);
  return {
    items,
    exact: items.filter((i) => !i.estimated).length,
    estimated: items.filter((i) => i.estimated).length,
    unjudged,
    readings: new Set(items.map((i) => i.reading)).size,
  };
}

/** The sources whose entry on the image overlaps the place (of the whole image or a part of it); else those of the image. */
function sourcesOf(sources: Source[], media: Media[], whole: Media, r: Region): string[] {
  const byId = new Map(media.map((m) => [m.id, m]));
  const inWhole = (c: { media: string; region: Region }): Region | undefined => {
    if (c.media === whole.id) return c.region;
    const m = byId.get(c.media);
    if (!m?.part || m.recordset !== whole.recordset || m.image !== whole.image) return undefined;
    return { x: m.part.x + c.region.x * m.part.w, y: m.part.y + c.region.y * m.part.h, w: c.region.w * m.part.w, h: c.region.h * m.part.h };
  };
  const over = sources.filter((s) => (s.clips ?? []).some((c) => {
    const at = inWhole(c);
    return !!at && (covered(at, r) > 0 || covered(r, at) > 0);
  }));
  return (over.length ? over : sources.filter((s) => (s.media ?? []).includes(whole.id))).map((s) => s.id).sort();
}


export const BLIND_REDUCED: FixCheck = {
  id: "blind-reduced",
  since: "1.19.0",
  paid: true,
  remedy: "read-again",
  unit: "reading",
  phrases: "fix.reread",
  detect: blindReducedDetect,
};

// ── another model or agent reads now: what earlier readings left open, read again with it ────────────────────────

/** What makes an earlier reading worth reading again with the model now. */
export type Reason = "unclear" | "differ" | "conflict" | "unconfirmed";

/** The agent and model strom read's readers read with now, as one key: the model an alias runs on (models.json). */
export function readerKeyNow(tree: Tree, env: FixEnv): string | undefined {
  if (!env.reader) return undefined;
  return resolveKey(calibrationKey(env.reader.agent, env.reader.model), loadAliases(tree.root));
}

/** Of a report's head (strom writes it since 1.19.0): the agent and model it was read with, as one key. */
export function headKey(head: string, aliases: Aliases, at?: string): string | undefined {
  const agent = /^Agent: (\S+)\s*$/mu.exec(head)?.[1];
  if (!agent) return undefined;
  const model = /^Model: (.+)$/mu.exec(head)?.[1]?.trim();
  return keyOf(calibrationKey(agent, model === "default" ? undefined : model), undefined, aliases, at);
}

const DOC_ID = /D\d{14}-[0-9a-f]{4}/u;

/** Of the readers here (readers.jsonl, this computer): the key each report and each document was read with, its crop. */
function readerRecords(root: string, aliases: Aliases): { reports: Map<string, { key: string; crop?: string; at?: number }>; documents: Map<string, string> } {
  const reports = new Map<string, { key: string; crop?: string; at?: number }>();
  const documents = new Map<string, string>();
  for (const r of readJournal(path.join(metricsDir(root), "readers.jsonl"))) {
    if (typeof r.reader !== "string" || typeof r.agent !== "string") continue;
    const at = typeof r.at === "string" ? r.at : undefined;
    const key = keyOf(calibrationKey(r.agent, typeof r.model === "string" ? r.model : undefined), typeof r.reported === "string" ? r.reported : undefined, aliases, at);
    if (r.kind === "read") {
      const t = at ? Date.parse(at) - (num(r.wallMs) ?? num(r.ms) ?? 0) : NaN;
      reports.set(r.reader.replace(/^read-/u, ""), { key, ...(typeof r.crop === "string" ? { crop: r.crop } : {}), ...(Number.isFinite(t) ? { at: t } : {}) });
    } else if (r.kind === "document") {
      const id = DOC_ID.exec(r.reader)?.[0];
      // the model the reader said beats the one asked: the newest reader of it
      if (id && (!documents.has(id) || typeof r.reported === "string")) documents.set(id, key);
    }
  }
  return { reports, documents };
}

/** Who the facts citing each source are of, and whether a fact citing it has a date or witnesses. */
function citedBy(tree: Tree): Map<string, { people: Set<string>; facts: boolean }> {
  const out = new Map<string, { people: Set<string>; facts: boolean }>();
  const add = (source: string, people: string[], facts: boolean) => {
    const c = out.get(source) ?? { people: new Set<string>(), facts: false };
    for (const p of people) c.people.add(p);
    c.facts ||= facts;
    out.set(source, c);
  };
  const events = (list: { citations: { source: string }[]; date?: string; participants?: unknown[]; retracted?: unknown }[], people: string[]) => {
    for (const e of list) if (!e.retracted) for (const c of e.citations ?? []) add(c.source, people, !!e.date || !!e.participants?.length);
  };
  for (const p of tree.list<Person>("person")) {
    if (p.retracted) continue;
    events(p.events ?? [], [p.id]);
    for (const n of p.names ?? []) for (const c of n.citations ?? []) add(c.source, [p.id], false);
  }
  for (const f of tree.list<Family>("family")) {
    if (f.retracted) continue;
    events(f.events ?? [], f.partners);
    for (const c of f.citations ?? []) add(c.source, f.partners, false);
    for (const ch of f.children) for (const c of (ch as { citations?: { source: string }[] }).citations ?? []) add(c.source, [ch.person, ...f.partners], false);
  }
  return out;
}

/** The text of a document's entries, and its uncertain places: [?], what strom found illegible, pages not read to an end. */
function docText(r: ReadResult): { text: string; unclear: number; facts: boolean } {
  const text = r.entries.map((e) => e.transcript).join("\n");
  const unclear =
    (text.match(/\[\?\]/gu)?.length ?? 0) +
    r.checks.filter((c) => c.why === "illegible").length +
    (r.incomplete?.length ?? 0) +
    (r.doc?.legible === "partly" ? 1 : 0) +
    (r.state === "unreadable" && r.doc?.why !== "not-text" && r.doc?.why !== "small" ? 1 : 0);
  const facts = r.entries.some((e) => [...e.persons, ...e.events].some((x) => (x.uncertain ?? []).some((u) => u === "date" || u === "given" || u === "surname")));
  return { text, unclear, facts };
}

/** A reading of a document as kept with the research (notes/readings/D….json). */
export function loadDocResult(root: string, id: string): ReadResult | undefined {
  try {
    const r = JSON.parse(fs.readFileSync(resultPath(root, id), "utf8")) as ReadResult;
    return r && r.id === id && Array.isArray(r.entries) ? r : undefined;
  } catch {
    return undefined;
  }
}

/** How useful reading it again is (both checks): its stage — 1 disputed, 2 the direct line, 3 the rest. */
export type Stage = 1 | 2 | 3;

/**
 * The stage of a place (both checks): 1 where its reading is disputed — blind readers who differed, an open conflict,
 * a reading never confirmed at the source; 2 where a source on it is of the direct line; 3 the rest (places left open
 * among them). Dates and witnesses only order the places within a stage: on a real research nearly every source has
 * them, so they tell nothing apart.
 */
export function useStage(i: FixItem): Stage {
  return i.reasons?.some((r) => r === "differ" || r === "conflict" || r === "unconfirmed") ? 1 : i.direct ? 2 : 3;
}

/**
 * Most useful first (both checks): by its stage, then readers who differed, an open conflict, a reading not confirmed,
 * the direct line, places left open, dates and witnesses; then the number of places open, a source on it, known
 * exactly, the gain in detail.
 */
export function byUse(a: FixItem, b: FixItem): number {
  const has = (i: FixItem, r: Reason) => Number(!!i.reasons?.includes(r));
  return (
    useStage(a) - useStage(b) ||
    has(b, "differ") - has(a, "differ") ||
    has(b, "conflict") - has(a, "conflict") ||
    has(b, "unconfirmed") - has(a, "unconfirmed") ||
    Number(!!b.direct) - Number(!!a.direct) ||
    Number(b.unclear > 0) - Number(a.unclear > 0) ||
    Number(!!b.facts) - Number(!!a.facts) ||
    b.unclear - a.unclear ||
    Number(b.sources.length > 0) - Number(a.sources.length > 0) ||
    Number(a.estimated) - Number(b.estimated) ||
    (b.gain ?? 0) - (a.gain ?? 0) ||
    a.key.localeCompare(b.key)
  );
}

/**
 * The places of each earlier reading together, the most useful reading first (its most useful place, byUse): what is
 * read again is always a whole reading, all its images and places — never a part of one.
 */
export function byReading(items: FixItem[]): FixItem[][] {
  const out = new Map<string, FixItem[]>();
  for (const i of [...items].sort(byUse)) out.set(i.reading, [...(out.get(i.reading) ?? []), i]);
  return [...out.values()];
}

/** The stage of a whole reading: of its most useful place. */
export const readingStage = (g: FixItem[]): Stage => Math.min(...g.map(useStage)) as Stage;

/**
 * The readings up to each stage (byReading puts them in that order): the disputed alone, the disputed with the direct
 * line, all. Offered alone, the narrowest that holds any first.
 */
export function stagesOf(groups: FixItem[][]): { disputed: number; direct: number; all: number } {
  return {
    disputed: groups.filter((g) => readingStage(g) === 1).length,
    direct: groups.filter((g) => readingStage(g) <= 2).length,
    all: groups.length,
  };
}

/** The readings of the narrowest stage that holds any: where a trial is taken from. */
export function defaultStage(groups: FixItem[][]): number {
  const s = stagesOf(groups);
  return s.disputed || s.direct || s.all;
}

/** What the research says of its sources: who cites them (the direct line), dates and witnesses on them, open conflicts. */
interface Use {
  conflicted: Set<string>;
  direct(sources: string[]): boolean;
  facts(sources: string[]): boolean;
}

function useOf(tree: Tree): Use {
  const conflicted = new Set(tree.list<Conflict>("conflict").filter((c) => c.state === "open" && !c.retracted).flatMap((c) => c.claims.map((x) => x.source).filter((s): s is string => !!s)));
  const cites = citedBy(tree);
  let kin: Map<string, number> | undefined;
  return {
    conflicted,
    direct: (src) => {
      kin ??= kinship(tree);
      return src.some((s) => [...(cites.get(s)?.people ?? [])].some((p) => kin!.get(p) === 0));
    },
    facts: (src) => src.some((s) => cites.get(s)?.facts),
  };
}

/** A place of blind-reduced with what makes it useful: places open, a conflict at its sources, the direct line, dates. */
function withUse<I extends FixItem>(i: I, use: Use): I {
  const reasons: Reason[] = [...(i.unclear ? ["unclear" as const] : []), ...(i.sources.some((s) => use.conflicted.has(s)) ? ["conflict" as const] : [])];
  return { ...i, ...(reasons.length ? { reasons } : {}), ...(use.direct(i.sources) ? { direct: true as const } : {}), ...(use.facts(i.sources) ? { facts: true as const } : {}) };
}

function newModelDetect(tree: Tree, env: FixEnv): FixFindings {
  const none: FixFindings = { items: [], exact: 0, estimated: 0, unjudged: 0, readings: 0 };
  const now = readerKeyNow(tree, env);
  if (!now) return none;
  const aliases = loadAliases(tree.root);
  // an alias nobody saw run here yet ("opus", the agent's own): a reading by a model of it may be the model now
  const asked = splitKey(now);
  const unseen = !aliases[now] && now === calibrationKey(env.reader!.agent, env.reader!.model);
  const isNow = (key: string) => {
    if (key === now) return true;
    const k = splitKey(key);
    return unseen && k.agent === asked.agent && !!k.model && fits(asked.agent, asked.model, k.model);
  };
  const media = tree.list<Media>("media").filter((m) => !m.retracted);
  const byId = new Map(media.map((m) => [m.id, m]));
  const sources = tree.list<Source>("source").filter((s) => !s.retracted);
  const confirmed = new Set(sources.map((s) => s.reading).filter((r): r is string => !!r));
  const { conflicted, direct, facts } = useOf(tree);
  // another known model read here before: else nothing says the model changed
  const known = new Set<string>();
  let kin: Map<string, number> | undefined;
  const recs = readerRecords(tree.root, aliases);
  const raw: FixItem[] = [];
  /** Readings again with the model now, after an earlier one: by image (and crop) or the document's pages. */
  const readNow = new Map<string, number[]>();
  const noteNow = (k: string, t: number) => readNow.set(k, [...(readNow.get(k) ?? []), t]);

  // strom read: each image of each reading
  const readings = loadReadings(tree);
  const imagesOf = new Map<string, { r: Reading; t: number; blocks: Block[]; key: string }[]>();
  for (const r of readings) {
    // when it was read: its reader's record, else its file (by its day at the latest)
    const said = Math.min(...r.reports.map((n) => recs.reports.get(n)?.at ?? Infinity));
    const t = Number.isFinite(said) ? said : Math.min(r.mtime || Infinity, Date.parse(`${r.stem.slice(0, 10)}T23:59:59Z`));
    const at = Number.isFinite(t) ? new Date(t).toISOString() : undefined;
    const byImage = new Map<string, Block[]>();
    for (const b of r.blocks) {
      const m = (b.media ? byId.get(b.media) : undefined) ?? media.find((x) => !x.part && x.recordset === b.recordset && b.num !== undefined && x.image === b.num);
      if (m) byImage.set(m.id, [...(byImage.get(m.id) ?? []), b]);
    }
    for (const [id, blocks] of byImage) {
      const report = blocks[0]!.report;
      const key = headKey(r.heads.get(report) ?? "", aliases, at) ?? recs.reports.get(report)?.key ?? UNKNOWN_KEY;
      imagesOf.set(id, [...(imagesOf.get(id) ?? []), { r, t, blocks, key }]);
    }
  }
  for (const [id, list] of imagesOf) {
    const m = byId.get(id)!;
    for (const { r, t, blocks, key } of list) {
      const report = blocks[0]!.report;
      const crop = headImages(r.heads.get(report) ?? "").find((i) => i.id === id)?.crop ?? recs.reports.get(report)?.crop;
      if (isNow(key)) {
        noteNow(`${id}|${crop ?? ""}`, t);
        noteNow(`${id}|`, t);
        continue;
      }
      if (key !== UNKNOWN_KEY) known.add(key);
      const unclear = blocks.reduce((n, b) => n + Math.max(unclearOf(b), b.result === "unclear" ? 1 : 0), 0);
      // a blind reading that reads otherwise than the researcher's reading of the image before it
      const theirs = r.blind ? list.filter((x) => !x.r.blind && x.t <= t && x.r !== r).sort((a, b) => b.t - a.t)[0] : undefined;
      const differ = !!theirs && compareReadings(theirs.blocks, blocks, tree.lang).result === "differ";
      const reg = cropRegion(crop);
      const src = reg && !m.part ? sourcesOf(sources, media, m, shownToFile(reg, mediaOrient(env.shared, m))) : sources.filter((s) => (s.media ?? []).includes(id) || (s.clips ?? []).some((c) => c.media === id)).map((s) => s.id).sort();
      const reasons: Reason[] = [...(unclear ? ["unclear" as const] : []), ...(differ ? ["differ" as const] : []), ...(src.some((s) => conflicted.has(s)) ? ["conflict" as const] : [])];
      // a reading of no known model: only where it left places open (nothing says the model changed since)
      if (!reasons.length || (key === UNKNOWN_KEY && !unclear)) continue;
      raw.push({
        key: `${r.stem}|${id}|${crop ?? ""}`,
        reading: r.stem,
        media: id,
        ...(m.recordset !== undefined && m.image !== undefined ? { ref: `${m.recordset}:${m.image}` } : {}),
        ...(crop ? { crop } : {}),
        question: r.question ?? "",
        ...(r.context ? { context: r.context } : {}),
        blind: !!r.blind,
        estimated: false,
        sources: src,
        unclear,
        ...(Number.isFinite(t) ? { at: new Date(t).toISOString() } : {}),
        before: key,
        reasons,
        ...(direct(src) ? { direct: true } : {}),
        ...(facts(src) ? { facts: true } : {}),
      });
    }
  }

  // strom document read: each reading of a document (its result kept with the research)
  const docs = listReadings(tree.root)
    .filter((d) => d.state === "done" || d.state === "unreadable")
    .flatMap((d) => {
      const r = loadDocResult(tree.root, d.id);
      return r ? [{ d, r }] : [];
    });
  const pagesKey = (r: ReadResult) => r.pages.map((p) => `${p.file}:${p.page}:${p.region?.join(",") ?? ""}`).join(";");
  for (const { d, r } of docs) {
    const state = loadState(tree.root, d.id);
    const agent = r.agent ?? state?.agent;
    const model = r.model ?? state?.model;
    const key = recs.documents.get(d.id) ?? (agent ? keyOf(calibrationKey(agent, model), undefined, aliases, r.at) : UNKNOWN_KEY);
    const t = Date.parse(r.at);
    if (isNow(key)) {
      noteNow(`doc|${pagesKey(r)}`, t);
      continue;
    }
    if (key !== UNKNOWN_KEY) known.add(key);
    const { unclear, facts: atStake } = docText(r);
    const src = sources.filter((s) => s.reading === d.id).map((s) => s.id).sort();
    const reasons: Reason[] = [
      ...(unclear ? ["unclear" as const] : []),
      ...(r.readers?.agree === "differ" ? ["differ" as const] : []),
      ...(src.some((s) => conflicted.has(s)) ? ["conflict" as const] : []),
      ...(r.state === "done" && !confirmed.has(d.id) ? ["unconfirmed" as const] : []),
    ];
    if (!reasons.length || (key === UNKNOWN_KEY && !unclear)) continue;
    kin ??= kinship(tree);
    const people = [...(r.persons ?? []), ...r.entries.flatMap((e) => e.persons.map((p) => p.match?.[0]?.person).filter((p): p is string => !!p))];
    const files = [...new Set(r.pages.map((p) => p.file))];
    raw.push({
      key: `${d.id}|${pagesKey(r)}`,
      reading: d.id,
      media: files[0] ?? "",
      question: "",
      blind: false,
      estimated: false,
      sources: src,
      unclear,
      at: r.at,
      before: key,
      reasons,
      ...(direct(src) || people.some((p) => kin!.get(p) === 0) ? { direct: true } : {}),
      ...(atStake || facts(src) ? { facts: true } : {}),
      readers: Math.max(1, r.readers?.asked ?? 1),
      document: {
        files,
        regions: r.pages.filter((p) => p.region).map((p) => `${p.n}:${p.region!.join(",")}`),
        readers: Math.max(1, r.readers?.asked ?? 1),
        ...(r.note ? { note: r.note } : {}),
        ...(r.persons?.length ? { persons: r.persons } : {}),
      },
    });
  }
  if (!known.size) return none;
  // read again with the model now since: set right already
  const items = raw
    .filter((i) => {
      const t = Date.parse(i.at ?? "");
      const k = i.document ? `doc|${i.key.slice(i.key.indexOf("|") + 1)}` : `${i.media}|${i.crop ?? ""}`;
      return !(readNow.get(k) ?? []).some((x) => x > t);
    })
    .sort(byUse);
  // the readings found, by the model each was read with (one of no recorded model said last)
  const found = new Map<string, Set<string>>();
  for (const i of items) if (i.before) found.set(i.before, (found.get(i.before) ?? new Set()).add(i.reading));
  const said = [...found].map(([key, r]) => ({ key, readings: r.size })).sort((a, b) => Number(a.key === UNKNOWN_KEY) - Number(b.key === UNKNOWN_KEY) || b.readings - a.readings);
  // newer only of the same line, said of every model found (none of them unknown)
  const newer = said.length > 0 && said.every(({ key: k }) => {
    const a = splitKey(k);
    const b = splitKey(now);
    return a.agent === b.agent && !!a.model && !!b.model && sameLineNewer(a.model, b.model);
  });
  return {
    items,
    exact: items.length,
    estimated: 0,
    unjudged: 0,
    readings: new Set(items.map((i) => i.reading)).size,
    models: { now, before: said, newer },
  };
}

/** The agents and models the readings of these items were read with, where anything says (strom fixes run offers another). */
export function readBefore(tree: Tree, items: FixItem[]): Set<string> {
  const out = new Set<string>();
  const recs = readerRecords(tree.root, loadAliases(tree.root));
  const stems = new Set(items.map((i) => i.reading));
  for (const i of items) if (i.before && i.before !== UNKNOWN_KEY) out.add(i.before);
  for (const [report, r] of recs.reports) if (r.key !== UNKNOWN_KEY && stems.has(/^(.*)-\d+$/u.exec(report)?.[1] ?? report)) out.add(r.key);
  return out;
}

export const NEW_MODEL: FixCheck = {
  id: "new-model",
  since: "1.19.0",
  paid: true,
  remedy: "read-again",
  unit: "reading",
  phrases: "fix.model",
  detect: newModelDetect,
  // once for each agent and model: another one reading later is asked again
  decisionKey: (tree, env) => `new-model:${readerKeyNow(tree, env) ?? UNKNOWN_KEY}`,
};

/** Every check strom knows, the oldest fix first. */
export const FIX_CHECKS: readonly FixCheck[] = [BLIND_REDUCED, NEW_MODEL];

export function fixCheck(id: string): FixCheck | undefined {
  return FIX_CHECKS.find((c) => c.id === id);
}

// ── decisions ───────────────────────────────────────────────────────────────────────────────────────────────────

export function decisionOf(config: TreeConfig, key: string): FixDecision | undefined {
  const d = config.fixes?.[key];
  return d && (d.decision === "declined" || d.decision === "fixed") ? d : undefined;
}

/** Where a check's decision is kept (strom.json "fixes"): its id, or of new-model its id with the agent and model now. */
export function decisionKeyOf(tree: Tree, check: FixCheck, env: FixEnv): string {
  return check.decisionKey?.(tree, env) ?? check.id;
}

/** The person's decision kept with the research (strom.json, logged and sealed); undefined takes it back. */
export function decide(tree: Tree, id: string, decision: FixDecision["decision"] | undefined): void {
  tree.updateConfig(
    (c) => {
      const all = { ...(c.fixes ?? {}) };
      if (decision) all[id] = { decision, at: new Date().toISOString(), version: VERSION };
      else delete all[id];
      if (Object.keys(all).length) c.fixes = all;
      else delete c.fixes;
    },
    { op: "fix.decide", summary: decision ? `fix ${id}: ${decision}` : `fix ${id}: asked again` },
  );
}

/**
 * Each check with what it found here and the decision about it. Set right holds for what was read again: what a check
 * still finds after (never read again — a few first, or a place strom took wrongly then) waits again, it alone.
 */
export function fixStates(tree: Tree, env: FixEnv): FixState[] {
  return FIX_CHECKS.map((check) => {
    const found = check.detect(tree, env);
    const key = decisionKeyOf(tree, check, env);
    const decision = decisionOf(tree.config, key);
    const state: FixStateName = decision?.decision === "declined" ? "declined" : found.items.length ? "pending" : decision ? "fixed" : "nothing";
    return { check, key, found, ...(decision ? { decision } : {}), state };
  });
}

// ── what it would take ──────────────────────────────────────────────────────────────────────────────────────────

export type CostLevel = "cheap" | "medium" | "expensive";

export interface FixEstimate {
  level: CostLevel;
  /** The readers it starts (strom read's calls of a reader: a reading of more images than a batch takes more). */
  calls: number;
  /** About how long, readers at once as read.parallel says. */
  minutes: number;
  /** What it is told by: the earlier readers of this agent and model here, or the number of readings alone. */
  basis: "earlier" | "count";
  /** Earlier readers it is told by. */
  earlier: number;
}

/** Of the readers of one image (a crop) of this agent and model here: their cost and how long they took. */
function earlierReaders(root: string, agent: string, model: string | undefined): { usd: number[]; secs: number[] } {
  const usd: number[] = [];
  const secs: number[] = [];
  for (const r of readJournal(path.join(metricsDir(root), "readers.jsonl"))) {
    if (r.kind !== "read" || r.agent !== agent || (model && r.model !== model && r.reported !== model) || r.outcome !== "ok" || num(r.images) !== 1) continue;
    if (num(r.usd) !== undefined && !r.usdPartial) usd.push(num(r.usd)!);
    const ms = num(r.wallMs) ?? num(r.ms);
    if (ms && ms > 0 && ms <= READER_MS_MAX) secs.push(ms / 1000);
  }
  return { usd, secs };
}

/** Cheap, medium, expensive: what the readers cost together as the earlier readers did, else by their number. */
export const COST_USD = { medium: 1, expensive: 5 } as const;
export const COST_COUNT = { medium: 6, expensive: 21 } as const;
/** Earlier readers enough to tell a cost by. */
const EARLIER_MIN = 3;

/**
 * What `calls` readers again would take. The time: rounds of `parallel` readers at once, each as long as the earlier
 * readers here took (else as the agent's readers are expected to); after a trial `perReading`, the real time it took for
 * each of its readers, readers at once and all (never its longest reader). Minutes rounded up.
 */
export function estimateFix(root: string, o: { agent: string; model: string | undefined; calls: number; parallel: number; perReading?: number }): FixEstimate {
  const e = earlierReaders(root, o.agent, o.model);
  const n = o.calls;
  const mUsd = e.usd.length >= EARLIER_MIN ? median(e.usd) : undefined;
  const one = (e.secs.length >= EARLIER_MIN ? median(e.secs) : undefined) ?? readExpectDefault(o.agent);
  const secs = o.perReading !== undefined ? n * o.perReading : Math.ceil(n / Math.max(1, o.parallel)) * one;
  const minutes = Math.max(1, Math.ceil(secs / 60));
  if (mUsd !== undefined) {
    const total = mUsd * n;
    return { level: total >= COST_USD.expensive ? "expensive" : total >= COST_USD.medium ? "medium" : "cheap", calls: n, minutes, basis: "earlier", earlier: e.usd.length };
  }
  return { level: n >= COST_COUNT.expensive ? "expensive" : n >= COST_COUNT.medium ? "medium" : "cheap", calls: n, minutes, basis: "count", earlier: 0 };
}

// ── the reading again against the earlier one ───────────────────────────────────────────────────────────────────

export type Compared = "same" | "refined" | "differ" | "failed";

/** Two readings held against each other: the result, and the facts read that are not in the other one (as written). */
export interface Comparison {
  result: Compared;
  /** What the earlier reading read that the new one does not. */
  before: string[];
  /** What the new reading read that the earlier one does not. */
  now: string[];
}

/**
 * What a reading read: its facts (names, numbers) by their folded key, as first written; all its words; how unclear.
 * `maybe`: of a reader's own words (prose), each capital that may only begin a sentence or be a noun, with the words beside
 * it (a name all the same where the word stands elsewhere as one: then in `facts` too).
 */
interface Read {
  facts: Map<string, string>;
  words: Set<string>;
  unclear: number;
  found: boolean;
  maybe: Maybe[];
}

/** A capital of prose that may be a name: the word, its key, and the keys of the words before and after it ("" at an end). */
interface Maybe {
  word: string;
  key: string;
  prev: string;
  next: string;
}

/**
 * Languages whose prose writes every noun with a capital ("Der Ausschnitt zeigt …"): there a lone capital is no name for
 * sure, and the little words that begin a sentence there (an article, a pronoun) never one.
 */
const NOUNS_CAPITALIZED: Record<string, Set<string>> = {
  de: new Set("der die das dem den des ein eine einen einem einer eines im am vom zum zur beim ins es er sie wir ich man dies diese dieser dieses hier da dort auch und aber oder nur noch so wie was wo nach unter von mit bei auf in an".split(" ")),
};

// a reader's quotation marks: what it quotes of the record is its transcript, the rest its comment
const QUOTED = /[„“”"«»「」『』]([^„“”"«»「」『』]*)[„“”"«»「」『』]/gu;

/** A word as compared: folded, the long s and the ezh of old hands as the letters they are. */
const wordKey = (w: string) => foldText(w).replace(/ſ/gu, "s").replace(/ʒ/gu, "z");

/**
 * The facts of a transcript: the names (a word that begins with a capital, or any word of a script without capitals)
 * and the numbers; a word broken over a line ("Wac- / lawa", "In= / mann", "Wac|lawa") whole, the marks of doubt and an editor's
 * notes in brackets left out (a letter supplied in brackets, "Mi[cha]la", kept). Of a reader's own words (prose: nothing
 * quoted), a capital that only begins a sentence ("The crop shows …", "Výřez ukazuje …") is a name only where the same
 * word stands elsewhere as one; in a language that writes its nouns with a capital (`lang`), so is a lone capital — two or
 * more together ("Jan Novak") and a month after a day ("5. Mai") stay names. Such a word is kept as maybe one.
 */
function readOf(text: string, unclear: number, found: boolean, prose = false, lang = ""): Read {
  const clean = text
    .replace(/\[\?\]|\(\?\)/gu, "")
    .replace(/\[[^\]]*\s[^\]]*\]/gu, " ")
    .replace(/[[\]]/gu, "")
    .replace(/([\p{L}\p{M}])(?:[-=¬]\s*[/|]?\s*|\|)(?=[\p{L}\p{M}])/gu, "$1");
  const facts = new Map<string, string>();
  const words = new Set<string>();
  const tokens = [...clean.matchAll(/[\p{L}\p{M}\p{N}]+/gu)];
  const little = prose ? NOUNS_CAPITALIZED[lang.toLowerCase().split(/[-_]/u)[0]!] : undefined;
  const capital = (i: number) => /^\p{Lu}/u.test(tokens[i]?.[0] ?? "") && !/\p{N}/u.test(tokens[i]![0]) && !little?.has(wordKey(tokens[i]![0]));
  // the word before a token within its sentence (a sentence's end or a line's in between: none)
  const joined = (a: number, b: number) => a >= 0 && b < tokens.length && !/[.!?…:;\n]/u.test(clean.slice(tokens[a]!.index + tokens[a]![0].length, tokens[b]!.index).replace(/^\./u, (d) => (/\p{N}$/u.test(tokens[a]![0]) ? "" : d)));
  const maybeAt: { word: string; key: string; at: number }[] = [];
  tokens.forEach((m, i) => {
    const w = m[0];
    const k = wordKey(w);
    words.add(k);
    const digits = /\p{N}/u.test(w);
    const cased = /[\p{Lu}\p{Ll}]/u.test(w);
    if (!digits && cased && prose && /^\p{Lu}/u.test(w)) {
      if (little?.has(k)) return;
      const lone = little ? !(joined(i - 1, i) && capital(i - 1)) && !(joined(i, i + 1) && capital(i + 1)) && !(joined(i - 1, i) && /^\p{N}+$/u.test(tokens[i - 1]![0])) : opensSentence(clean, m.index, w.length);
      if (lone) {
        maybeAt.push({ word: w, key: k, at: i });
        return;
      }
    }
    if (digits || (w.length > 1 && (!cased || /^\p{Lu}/u.test(w)))) if (!facts.has(k)) facts.set(k, w);
  });
  const near = (i: number) => (i >= 0 && i < tokens.length ? wordKey(tokens[i]![0]) : "");
  const maybe = maybeAt.filter((x) => x.word.length > 1).map((x) => ({ word: x.word, key: x.key, prev: joined(x.at - 1, x.at) ? near(x.at - 1) : "", next: joined(x.at, x.at + 1) ? near(x.at + 1) : "" }));
  return { facts, words, unclear, found, maybe };
}

/**
 * A word that begins a sentence of prose: at a line's start or after a sentence's end (never after a number's dot, "5. Mai"),
 * the next word of its sentence in small letters ("Jan Novak", "Jan, son of" stay names).
 */
function opensSentence(text: string, at: number, length: number): boolean {
  let i = at - 1;
  while (i >= 0 && /\s/u.test(text[i]!) && text[i] !== "\n") i--;
  const start = i < 0 || text[i] === "\n" || (/[.!?…]/u.test(text[i]!) && i > 0 && !/\p{N}/u.test(text[i - 1]!));
  return start && /^\s+\p{Ll}/u.test(text.slice(at + length));
}

/**
 * What a reader read of its blocks: the parts of its entries it quotes from the record (when it quotes any), else its
 * entries — never a line of possible readings with their chances or of letters with theirs (a "%" in it), nor how it
 * describes the hand or how sure it is (hand, certainty); what it could not read only counts as unclear.
 */
function readOfBlocks(blocks: Finding[], lang?: string): Read {
  const lines = blocks.flatMap((b) => b.entries ?? []).filter((l) => !/%/u.test(l));
  const quoted = lines.flatMap((l) => [...l.matchAll(QUOTED)].map((m) => m[1]!));
  const unclear = blocks.reduce((n, x) => n + unclearOf(x), 0);
  const found = blocks.some((b) => b.result === "found");
  return quoted.length ? readOf(quoted.join(" "), unclear, found) : readOf(lines.join("\n"), unclear, found, true, lang);
}

/** What a reading of a document read: the people's names and ages, the events' dates and places (the reader's own fields). */
function readOfDocument(r: ReadResult): Read {
  const { unclear } = docText(r);
  const parts = r.entries.flatMap((e) => [...e.persons.flatMap((p) => [p.given, p.surname, p.age]), ...e.events.flatMap((v) => [v.date?.gedcom ?? v.date?.text, v.place?.text])]);
  // every word of its fields counts: a document's reader says what each one is
  const read = readOf(parts.filter(Boolean).join(" "), unclear, r.entries.length > 0);
  for (const w of read.words) if (!read.facts.has(w)) read.facts.set(w, w);
  return { ...read, maybe: [] };
}

/**
 * The new reading of a place against the earlier one, by what each read — the names and numbers of its transcript:
 * the same (shoda); all the earlier one read with more beside it, fewer places unclear, or found where it was unclear
 * (upřesněno); something the earlier one read that the new one does not — another name, date, number or place (rozchod).
 * Of a reader's own words, a capital that may only begin a sentence or be a noun in another place of the same sentence
 * ("Marie byla …" against "Anna byla …"): not sure, so refined, never the same. Nothing read: failed. `lang`: the language
 * the readers wrote their own words in (the research language).
 */
export function compareReadings(before: Finding[], now: Finding[], lang?: string): Comparison {
  return now.length ? compareRead(readOfBlocks(before, lang), readOfBlocks(now, lang)) : { result: "failed", before: [], now: [] };
}

/** A reading of a document again against the earlier one, as compareReadings (its people and events). */
export function compareDocuments(before: ReadResult, now: ReadResult | undefined): Comparison {
  if (!now || !now.entries.length) return { result: "failed", before: [], now: [] };
  return compareRead(readOfDocument(before), readOfDocument(now));
}

function compareRead(a: Read, b: Read): Comparison {
  const before = [...a.facts].filter(([k]) => !b.words.has(k)).map(([, w]) => w);
  const now = [...b.facts].filter(([k]) => !a.words.has(k)).map(([, w]) => w);
  if (before.length) return { result: "differ", before, now };
  // a maybe-name of one where the other has another between the same words
  const swapped = (x: Read, y: Read) => x.maybe.filter((m) => !x.facts.has(m.key) && !y.words.has(m.key) && y.maybe.some((o) => o.key !== m.key && o.prev === m.prev && o.next === m.next)).map((m) => m.word);
  const maybeNow = swapped(b, a);
  const surer = b.unclear < a.unclear || (b.found && !a.found);
  return { result: now.length || maybeNow.length || surer ? "refined" : "same", before, now: [...now, ...maybeNow] };
}

// ── what waits ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The checks that wait for the person's decision here (none in an archive: nobody reads there). */
export function pendingFixes(tree: Tree, env: FixEnv): FixState[] {
  if (isArchive(tree)) return [];
  try {
    return fixStates(tree, env).filter((s) => s.state === "pending");
  } catch {
    // a check that cannot look (a record it does not know): nothing said, nothing in the way
    return [];
  }
}

/** One line of strom doctor: what waits, else nothing (none in an archive). */
export function fixesDoctorLine(tree: Tree, env: FixEnv, lang: string): { status: "ok" | "warn"; text: string; fix?: string } {
  const pending = pendingFixes(tree, env);
  if (!pending.length) return { status: "ok", text: ui(lang, "ui.doc.fixes.ok") };
  const s = pending[0]!;
  return {
    status: "warn",
    text: ui(lang, s.check.unit === "reading" ? "ui.doc.fixes.pending.readings" : "ui.doc.fixes.pending", { name: ui(lang, `ui.fixes.${s.check.id}.name` as UIKey), count: s.check.unit === "reading" ? s.found.readings : s.found.items.length }),
    fix: `strom fixes show ${s.check.id}`,
  };
}

