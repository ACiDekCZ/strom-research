// strom document read · again · cancel · show · list — one document read at once: a photo or a scan of a register
// entry, a letter, a deed, a gravestone, the back of a photo, a PDF. Readers with a clean context read it (core/document.ts:
// what they are asked, how their reports are read, what strom checks); nothing of it enters the tree by itself.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { counted, lines, table, truncate } from "../cli/format.ts";
import { notFound, StromError, UsageError } from "../core/errors.ts";
import type { Input, Media } from "../core/model.ts";
import { fileSha256, inputPath, MAX_IN_TREE, mimeOf, storeShared } from "../core/media.ts";
import { create, normId, requireRecord, update } from "../core/records.ts";
import { foldText, safeFolderName } from "../core/text.ts";
import type { Tree } from "../core/tree.ts";
import { checkOriginalMeta } from "../core/originals.ts";
import { refuseInArchive } from "../core/state.ts";
import { isValidLang } from "../core/lang.ts";
import { makeView, mediaOrient, SPREAD_OVERLAP } from "../core/views.ts";
import { VIEW_MIN } from "../agents/images.ts";
import { fileToShown, shownToFile } from "../image/image.ts";
import { findImage, regionText, sharperCover } from "../core/media.ts";
import { byHandOnly, listConnectors, missingConsents } from "../core/connector.ts";
import { readableFile } from "../core/readable.ts";
import { shownSize } from "../image/index.ts";
import { verifyFast } from "../core/integrity.ts";
import { addReaders } from "../core/session.ts";
import { READER_MINUTES_HELP } from "../core/reader.ts";
import { stamp } from "../core/net.ts";
import { readerAgent, readers, type Readers } from "./readers.ts";
import { RUNNERS } from "../runners/index.ts";
import { EFFORTS } from "../agents/effort.ts";
import { ownModel } from "../agents/models.ts";
import { ui } from "../cli/ui.ts";
import { catalog } from "../core/phrases.ts";
import { readerDefault } from "../core/readchoice.ts";
import { heldAgainst, keepSourceReading, notAgain, originalPages, readingOfSource } from "../core/sourceread.ts";
import type { Source } from "../core/model.ts";
import {
  alive,
  APP_READ_FROM,
  backBefore,
  beforeOf,
  buildResult,
  cancelPath,
  DOC_NEXT,
  DOC_PAGES,
  DOC_VIEWS,
  aboutFor,
  docPrompt,
  endState,
  FINAL_STATES,
  listReadings,
  loadState,
  newReadId,
  nextVersion,
  parseRegion,
  READ_ID,
  reportPath,
  resultPath,
  saveState,
  shownName,
  SMALL_PX,
  withoutDocNext,
  words,
  type DocPageView,
  type ReadFailure,
  type ReadPage,
  type ReadReport,
  type ReaderWho,
  type ReadResult,
  type ReadState,
  type Region,
  type SourceAbout,
  type SourceRead,
} from "../core/document.ts";

/** How often a reading at work looks whether it was cancelled (strom document cancel, from another process). */
const CANCEL_LOOK_MS = 500;
/** The image types a document is read from: a photo, a scan, a PDF (HEIC and PDF converted for the reader). */
const DOC_EXT = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".pdf"]);

const now = () => new Date().toISOString();

function readId(arg: string | undefined): string {
  const id = (arg ?? "").trim();
  if (!READ_ID.test(id)) throw new UsageError(`"${id}" is no reading`, { hint: "a reading's id: D<14 digits>-<4 hex> (strom document list)" });
  return id;
}

function stateOf(tree: Tree, id: string): ReadState {
  const s = loadState(tree.root, id);
  if (s) return settled(tree, s);
  if (fs.existsSync(resultPath(tree.root, id))) throw new UsageError(`${id} was read on another computer: only its result is here`, { hint: `strom document show ${id}` });
  throw new UsageError(`no reading ${id}`, { hint: "strom document list" });
}

/**
 * A reading whose process is gone before it ended (stopped, the computer off): cancelled, with what its readers wrote —
 * read again, the reading before as it stood. One queued to be read later (--queue: no process of its own yet) waits.
 */
function settled(tree: Tree, s: ReadState): ReadState {
  if (FINAL_STATES.includes(s.state) || alive(s.pid) || (s.state === "queued" && !s.pid)) return s;
  const out: ReadState = backBefore(s) ?? { ...s, state: "cancelled", since: now(), error: "its process ended before the reading did" };
  saveState(tree.root, out);
  return out;
}

/** The file of a page's record: an input's, an image's. */
function fileOf(tree: Tree, shared: string, id: string): string {
  if (id.startsWith("M")) return path.join(shared, requireRecord<Media>(tree, id, "media").file);
  const input = requireRecord<Input>(tree, id, "input");
  const file = inputPath(tree, input);
  if (!file || !fs.existsSync(file)) throw new UsageError(`the file of ${id} is missing`, { hint: "the shared folder may have moved: strom config where" });
  return file;
}

/** --region [<page>:]x,y,w,h (fractions of the page, from its top left), per page. */
function regionsOf(said: unknown): Map<number, Region> {
  const out = new Map<number, Region>();
  for (const v of Array.isArray(said) ? said : said === undefined ? [] : [said]) {
    const m = /^\s*(?:(\d+)\s*:)?\s*(.+)$/u.exec(String(v));
    const r = parseRegion(m?.[2]);
    if (!m || !r) throw new UsageError(`invalid --region "${String(v)}"`, { hint: "fractions of the page from its top left: --region 0.1,0.4,0.8,0.3 (page 2 of a PDF: --region 2:0.1,0.4,0.8,0.3)" });
    out.set(Number(m[1] ?? 1), r);
  }
  return out;
}

/** --name [<file>:]<name>: the name each file is shown under in the reading (the first file's without a number). */
function namesOf(said: unknown, files: number): Map<number, string> {
  const out = new Map<number, string>();
  for (const v of Array.isArray(said) ? said : said === undefined ? [] : [said]) {
    const m = /^(\d{1,2}):(.*)$/su.exec(String(v));
    const at = m && Number(m[1]) >= 1 && Number(m[1]) <= files ? Number(m[1]) : 1;
    const name = shownName(m && at === Number(m[1]) ? m[2]! : String(v));
    if (!name) throw new UsageError(`invalid --name "${String(v).slice(0, 60)}"`, { hint: 'the file\'s name as the person knows it: --name "back of the photo.jpg" (the second file\'s: --name 2:<name>)' });
    out.set(at, name);
  }
  return out;
}

/** An image's name for a person: the file it came as (its `from`: "the Strom app: x.jpg", "portal · x.jpg"), else its ID — never its hash. */
function mediaName(m: Media): string {
  const last = m.from?.split(/: | · /u).at(-1)?.trim();
  return (last && !last.includes(m.sha.slice(0, 12)) && shownName(last)) || m.id;
}

function readersOf(said: unknown, dflt: number): number {
  if (said === undefined) return dflt;
  const n = Number(said);
  if (n !== 1 && n !== 2) throw new UsageError(`invalid --readers "${String(said)}"`, { hint: "1, or 2 (the second reads blind; where they differ is said)" });
  return n;
}

/** Whether two readers read alike: the same agent, model and effort (none of either: as the research reads). */
function sameReader(a: ReaderWho | undefined, b: ReaderWho | undefined): boolean {
  return (a?.agent ?? "") === (b?.agent ?? "") && (a?.model ?? "") === (b?.model ?? "") && (a?.effort ?? "") === (b?.effort ?? "");
}

/**
 * Who reads, as asked: the first reader (--agent, --model, --effort; each left out as the research's settings say), the
 * blind one (--blind-agent, --blind-model, --blind-effort; left out as the first, or that agent's own default) — "" for a
 * model or an effort: the agent's own. A choice holds for this reading alone: nothing of it is kept in the settings.
 */
function withOf(ctx: Context, tree: Tree, opts: Record<string, unknown>): ReaderWho[] {
  const research = readerAgent(ctx, tree);
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  const one = (at: 0 | 1, agent: string, model: string | undefined, effort: string | undefined, like?: ReaderWho): ReaderWho => {
    const pre = at ? "--blind-" : "--";
    if (!RUNNERS[agent]) throw new UsageError(`no reader of the agent "${agent.slice(0, 40)}"`, { code: "read.with", params: { at: String(at), field: "agent" }, hint: `${pre}agent ${Object.keys(RUNNERS).filter((a) => a !== "script").join("|")}` });
    const dflt = like && like.agent === agent ? { model: like.model ?? "", effort: like.effort ?? "" } : readerDefault(tree, ctx.settings, agent, research);
    const m = model ?? dflt.model;
    const e = effort ?? dflt.effort;
    // (the script runner of tests takes any effort: it only hands it on)
    if (e && !(EFFORTS[agent]?.includes(e) ?? agent === "script")) throw new UsageError(`${agent} takes no effort "${e.slice(0, 20)}"`, { code: "read.with", params: { at: String(at), field: "effort" }, hint: EFFORTS[agent] ? `${pre}effort ${EFFORTS[agent]!.join("|")}` : `${agent} has no effort to set: leave ${pre}effort out` });
    return { agent, ...(m ? { model: m } : {}), ...(e ? { effort: e } : {}) };
  };
  const first = one(0, research, str(opts.model), str(opts.effort));
  const blindAgent = str(opts["blind-agent"]) || first.agent;
  return [first, one(1, blindAgent, str(opts["blind-model"]), str(opts["blind-effort"]), first)];
}

/** The options naming who reads (as `strom document read` and `again` take them). */
const WITH_OPTIONS = [
  { name: "model", type: "string" as const, value: "<model>", description: "the readers' model (default: model.vision — never weaker for handwriting; \"\": the agent's own)" },
  { name: "effort", type: "string" as const, value: "<level>", description: "the readers' reasoning effort (default: model.effort; \"\": the agent's own)" },
  { name: "blind-agent", type: "string" as const, value: "<agent>", description: "the second, blind reader's agent (default: the first reader's; --agent sets the first)" },
  { name: "blind-model", type: "string" as const, value: "<model>", description: "the blind reader's model (default: the first reader's, or that agent's own default)" },
  { name: "blind-effort", type: "string" as const, value: "<level>", description: "the blind reader's effort (default: the first reader's, or that agent's own default)" },
];

/**
 * What a reading reads: each argument an input (I…), an image (M…) or a file — a file the research has not got
 * becomes an input of it (as strom intake keeps it, without a task of its own: the reading is what it is for).
 */
function filesOf(ctx: Context, tree: Tree, args: string[], persons: string[], note: string | undefined): { records: { id: string; file: string; name: string; sha?: string }[]; added: string[] } {
  const shared = ctx.settings.shared()?.value;
  if (!shared) throw new StromError("no shared folder is set", { hint: "strom setup" });
  const known = new Map(tree.list<Input>("input").filter((i) => i.sha && !i.retracted).map((i) => [i.sha!, i]));
  const records: { id: string; file: string; name: string; sha?: string }[] = [];
  const added: string[] = [];
  for (const a of args) {
    if (/^[IiMm]\d+$/u.test(a.trim())) {
      const id = normId(a.trim(), a.trim().toUpperCase().startsWith("M") ? "media" : "input");
      const file = fileOf(tree, shared, id);
      const rec = id.startsWith("M") ? requireRecord<Media>(tree, id, "media") : requireRecord<Input>(tree, id, "input");
      records.push({ id, file, name: rec.type === "input" ? rec.name : mediaName(rec), ...(rec.sha ? { sha: rec.sha } : {}) });
      continue;
    }
    const p = ctx.resolvePath(a);
    if (!fs.existsSync(p)) throw notFound(a);
    if (fs.statSync(p).isDirectory()) throw new UsageError(`${ctx.display(p)} is a folder: one document is read at once`, { hint: "the files of the document: strom document read <page 1> <page 2> … — a folder of documents: strom intake" });
    if (!DOC_EXT.has(path.extname(p).toLowerCase())) throw new UsageError(`${ctx.display(p)} is no photo, scan or PDF`, { hint: "a JPEG, PNG, HEIC or PDF" });
    const sha = fileSha256(p);
    const had = known.get(sha);
    if (had) {
      records.push({ id: had.id, file: fileOf(tree, shared, had.id), name: had.name, sha });
      continue;
    }
    // kept as strom intake keeps a file: in the tree up to MAX_IN_TREE, else in the shared folder
    const id = tree.peekId("I");
    const size = fs.statSync(p).size;
    let stored: string;
    if (size <= MAX_IN_TREE) {
      const rel = `inputs/${id}-${safeFolderName(path.basename(p))}`;
      tree.remember(path.join(tree.root, rel));
      fs.mkdirSync(path.join(tree.root, "inputs"), { recursive: true });
      fs.copyFileSync(p, path.join(tree.root, rel));
      stored = rel;
    } else stored = `media:${path.relative(shared, storeShared(shared, p, sha))}`;
    const input = create<Input>(
      tree,
      "input",
      { name: path.basename(p), file: stored, sha, size, mime: mimeOf(p), from: ctx.display(p), kind: "document", state: "new", ...(persons.length ? { persons } : {}), ...(note ? { note } : {}) },
      (iid) => `+${iid} input document "${truncate(path.basename(p), 50)}" to read`,
    );
    known.set(sha, input);
    added.push(input.id);
    records.push({ id: input.id, file: fileOf(tree, shared, input.id), name: input.name, sha });
  }
  return { records, added };
}

/** The pages of the files, upright, at most DOC_PAGES (a PDF's own pages counted). */
function pagesOf(tree: Tree, records: { id: string; file: string; name: string; sha?: string; region?: Region }[], regions: Map<number, Region>): ReadPage[] {
  const pages: ReadPage[] = [];
  for (const r of records) {
    const first = readableFile(tree.root, r.file, { env: tree.env });
    for (let p = 1; p <= first.pages; p++) {
      if (pages.length >= DOC_PAGES) throw new UsageError(`more than ${DOC_PAGES} pages: one reading reads at most ${DOC_PAGES}`, { code: "read.pages", params: { pages: String(DOC_PAGES) }, hint: "the pages of one document only, in parts: strom document read <file> … of its first pages, then of the next" });
      const readable = p === 1 ? first : readableFile(tree.root, r.file, { env: tree.env, page: p });
      const size = shownSize(new Uint8Array(fs.readFileSync(readable.file)));
      const n = pages.length + 1;
      const region = regions.get(n) ?? (p === 1 ? r.region : undefined);
      pages.push({ n, file: r.id, ...(r.sha ? { sha: r.sha } : {}), name: r.name, page: p, ...(size ? { w: size.width, h: size.height } : {}), ...(region ? { region } : {}) });
    }
  }
  return pages;
}

/**
 * What a source read again is, for its readers (spec 059 K6.2): its kind, language, date and locator — no transcript,
 * no title (it names people), nothing of a person. None of a reading of no source.
 */
function aboutOf(tree: Tree, s: ReadState): SourceAbout | undefined {
  if (!s.source) return undefined;
  const src = tree.get<Source>(s.source.id);
  if (!src || src.type !== "source") return undefined;
  return {
    kind: src.kind,
    ...(src.language ? { language: src.language } : {}),
    ...(src.date ? { date: src.date } : {}),
    ...(locatorOf(src) ? { locator: locatorOf(src) } : {}),
    ...(s.pages.some((p) => p.region) ? { cut: true } : {}),
  };
}

/**
 * Where a source stands, as its readers are told it: no word of its transcript (a name a locator repeats) — those
 * words left out, numbers kept.
 */
export function locatorOf(src: Pick<Source, "locator" | "transcript">): string | undefined {
  const loc = src.locator?.normalize("NFC").replace(/\s*\n\s*/gu, " ").trim();
  if (!loc) return undefined;
  const known = new Set(words(src.transcript ?? "").map((w) => w.key).filter((k) => /\p{L}/u.test(k) && k.length >= 3));
  const out = loc.replace(/[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*/gu, (w) => (known.has(foldText(w).replace(/[^\p{L}\p{M}\p{N}]+/gu, "")) ? "…" : w)).replace(/(?:…[\s,.;]*){2,}/gu, "… ").trim();
  return /[\p{L}\p{N}]/u.test(out.replace(/…/gu, "")) ? out : undefined;
}

/** Of a source read again, its excerpts on a page that lie in the page's place (fractions of the page, as shown): what must be read of it. */
function excerptsOn(tree: Tree, source: string | undefined, page: ReadPage): { x: number; y: number; w: number; h: number }[] {
  if (!source || !page.region) return [];
  const src = tree.get<Source>(source);
  const [x, y, w, h] = page.region;
  const e = 0.002;
  return (src?.type === "source" ? (src.clips ?? []) : []).filter((c) => c.media === page.file && c.region.x >= x - e && c.region.y >= y - e && c.region.x + c.region.w <= x + w + e && c.region.y + c.region.h <= y + h + e).map((c) => c.region);
}

/**
 * A registered part of an image sharper than it for a page's place (core/media.ts sharperCover): one that holds all of
 * the place, or nearly all of it (cut to it: COVERS), or all of the source's excerpts in it (what it leaves out is only
 * their margin). Never a part that shows only some of what is read.
 */
function sharperOf(tree: Tree, shared: string, page: ReadPage, source?: string): ReturnType<typeof sharperCover>["use"] {
  if (!page.region || !page.file.startsWith("M") || page.page > 1) return undefined;
  const m = tree.get<Media>(page.file);
  if (!m?.width || m.part) return undefined;
  const [x, y, w, h] = page.region;
  const o = mediaOrient(shared, m);
  const holds = excerptsOn(tree, source, page).map((r) => shownToFile(r, o));
  return sharperCover(tree.list<Media>("media"), m, shownToFile({ x, y, w, h }, o), holds).use;
}

/**
 * A sharper crop of a page's place from the archive, offered (never fetched): the place small on its scan (a view of
 * it enlarged more than 1.25× at the default size), no sharper part of it here, its image fetched by a connector that
 * fetches parts and may run now. The command, else nothing.
 */
function sharperFetch(ctx: Context, tree: Tree, page: ReadPage, source?: string): string | undefined {
  const shared = ctx.settings.shared()?.value;
  if (!shared || !page.region || !page.w || !page.h || !page.file.startsWith("M") || page.page > 1) return undefined;
  const [x, y, w, h] = page.region;
  if (Math.max(w * page.w, h * page.h) * 1.25 >= VIEW_MIN) return undefined;
  const m = tree.get<Media>(page.file);
  if (!m || m.part || sharperOf(tree, shared, page, source)) return undefined;
  const whole = m.recordset !== undefined && m.image !== undefined ? findImage(tree.list<Media>("media"), m.recordset, m.image) : undefined;
  const from = whole?.fetched ? listConnectors(shared).find((c) => c.name === whole.fetched!.connector) : undefined;
  if (!from || !from.manifest.can.includes("part") || byHandOnly(from) || missingConsents(ctx.env, from).code) return undefined;
  const inFile = shownToFile({ x, y, w, h }, mediaOrient(shared, m));
  return `strom fetch ${from.name} --recordset ${whole!.recordset} --images ${whole!.image} --crop ${regionText(inFile)}`;
}

/** The views of a page for a reader: the page whole (or the part asked), and a dense page in two halves too. */
function viewsOf(tree: Tree, shared: string, page: ReadPage, max: number, min?: number, liftMax?: number, source?: string): DocPageView {
  const file = fileOf(tree, shared, page.file);
  const spec = { max, ...(min ? { min } : {}), ...(liftMax ? { liftMax } : {}), ...(page.page > 1 ? { page: page.page } : {}) };
  const meta = { reader: true, capFrom: "default" as const };
  if (page.region) {
    const [x, y, w, h] = page.region;
    // a part of the image registered sharper that shows all of the place, or all of it but a margin: the view is made
    // of it (the same place, more detail; cut to it, what the view shows kept to place the reader's regions on the page)
    const s = sharperOf(tree, shared, page, source);
    if (s) {
      const v = makeView(tree, path.join(shared, s.part.file), s.part.id, { ...spec, page: undefined, crop: regionText(fileToShown(s.crop, mediaOrient(shared, s.part))) }, { ...meta, kind: "crop" });
      const m = s.cut ? fileToShown(s.cut, mediaOrient(shared, tree.get<Media>(page.file)!)) : undefined;
      return { n: page.n, view: v.file, region: page.region, ...(m ? { shows: [m.x, m.y, m.w, m.h].map((n) => Math.round(n * 10000) / 10000) as Region } : {}) };
    }
    const v = makeView(tree, file, page.file, { ...spec, crop: `${x},${y},${w},${h}` }, { ...meta, kind: "crop" });
    return { n: page.n, view: v.file, region: page.region };
  }
  const whole = makeView(tree, file, page.file, spec, { ...meta, kind: "whole" });
  const W = whole.original.width;
  const H = whole.original.height;
  // shrunk well below its own pixels: its halves too, each sharper (along its long side, overlapping in the middle)
  if (Math.max(W, H) <= max * 1.25) return { n: page.n, view: whole.file };
  const across = W > H;
  const share = 0.5 + SPREAD_OVERLAP;
  const a = across ? `0,0,${Math.round(W * share)},${H}` : `0,0,${W},${Math.round(H * share)}`;
  const b = across ? `${W - Math.round(W * share)},0,${Math.round(W * share)},${H}` : `0,${H - Math.round(H * share)},${W},${Math.round(H * share)}`;
  const parts = [
    { label: across ? "left half" : "top half", view: makeView(tree, file, page.file, { ...spec, crop: a }, { ...meta, kind: "half" }).file },
    { label: across ? "right half" : "bottom half", view: makeView(tree, file, page.file, { ...spec, crop: b }, { ...meta, kind: "half" }).file },
  ];
  return { n: page.n, view: whole.file, parts };
}

/** The pages each reader reads: in order, at most DOC_VIEWS views each (a long document in parts). */
function groupsOf(views: DocPageView[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  let n = 0;
  for (const v of views) {
    const k = 1 + (v.parts?.length ?? 0);
    if (cur.length && n + k > DOC_VIEWS) {
      out.push(cur);
      cur = [];
      n = 0;
    }
    cur.push(v.n);
    n += k;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * The readers of a reading at work: each group of pages by the first reader (unless only the blind one is asked) and,
 * of two, by the blind one — side by side; cancelled from another process (strom document cancel) they stop. The state
 * is saved after each step, the result written and committed with the reports at the end.
 */
async function readNow(ctx: Context, tree: Tree, s: ReadState, opts: Record<string, unknown>, only?: "blind"): Promise<ReadState> {
  try {
    return await readWith(ctx, tree, s, opts, only);
  } catch (err) {
    // no reader could start (no agent, a sandbox, the session finishing): the reading failed, said why — never left queued
    const now_ = loadState(tree.root, s.id) ?? s;
    if (!FINAL_STATES.includes(now_.state)) {
      const failed: ReadState = { ...now_, state: "failed", since: now(), error: err instanceof Error ? err.message : String(err) };
      delete failed.pid;
      saveState(tree.root, failed);
    }
    throw err;
  }
}

async function readWith(ctx: Context, tree: Tree, s: ReadState, opts: Record<string, unknown>, only?: "blind"): Promise<ReadState> {
  const shared = ctx.settings.shared()?.value;
  if (!shared) throw new StromError("no shared folder is set", { hint: "strom setup" });
  // a page too small to read: said at once, no reader started (free)
  const small = s.pages.filter((p) => p.w && p.h && Math.min(p.w, p.h) < SMALL_PX && !p.region);
  if (small.length) {
    s = { ...s, state: "unreadable", why: "small", since: now() };
    saveState(tree.root, s);
    return finish(ctx, tree, s, []);
  }
  // each reader as asked (s.with: the first, the blind one — its own agent, model, effort), else the research's readers
  const teamOf = (r: ReaderWho | undefined): Readers => readers(ctx, tree, shared, "document", "1", opts, undefined, { stem: s.id, ...(r ? { with: r } : {}) });
  const first = only === "blind" ? undefined : teamOf(s.with?.[0]);
  const blind = s.readers > 1 ? (first && sameReader(s.with?.[0], s.with?.[1]) ? first : teamOf(s.with?.[1])) : undefined;
  const team = (first ?? blind)!;
  const teams = [...new Set([first, blind].filter((x): x is Readers => !!x))];
  const viewsBy = new Map(teams.map((x) => [x, s.pages.map((p) => viewsOf(tree, shared, p, x.viewMax, x.viewMin, x.viewLift, s.source?.id))] as const));
  const views = viewsBy.get(team)!;
  // what each page's view shows where a sharper part cut its place to it: the readers' regions placed by it (core/document.ts)
  s = { ...s, pages: s.pages.map(({ shows: _, ...p }) => { const v = views.find((x) => x.n === p.n); return v?.shows ? { ...p, shows: v.shows } : p; }) };
  // only the blind one after the first: the pages grouped as the first reader read them
  const groups = only === "blind" && s.groups.length ? s.groups : groupsOf(views);
  s = { ...s, groups, state: "reading", since: now(), pid: process.pid, ...(first || !s.agent ? { agent: team.agent, ...(team.model ? { model: team.model } : {}) } : {}) };
  if (first && !team.model) delete s.model;
  saveState(tree.root, s);
  const stop = new AbortController();
  const look = setInterval(() => {
    if (fs.existsSync(cancelPath(tree.root, s.id))) stop.abort();
  }, CANCEL_LOOK_MS);
  look.unref?.();
  const jobs: { group: number; blind: boolean }[] = [];
  s.groups.forEach((_, g) => {
    if (only !== "blind") jobs.push({ group: g, blind: false });
    if (s.readers > 1) jobs.push({ group: g, blind: true });
  });
  let next = Math.max(0, ...s.reports.map((r) => r.n)) + 1;
  // a source read again: what the research knows of it, told both readers (never its transcript, never a name); the
  // entry in the middle of its excerpt and its spelling kept letter by letter a GPT reader alone (SourceAbout.spelling)
  const about = aboutOf(tree, s);

  const runOne = async (job: { group: number; blind: boolean }) => {
    if (stop.signal.aborted) return;
    const n = next++;
    const by = (job.blind ? blind : first)!;
    s = { ...s, reports: [...s.reports, { n, group: job.group, blind: job.blind, version: s.version, agent: by.agent, ...(by.model ? { model: by.model } : {}), ...(by.effort ? { effort: by.effort } : {}), began: now() }] };
    saveState(tree.root, s);
    const mine = viewsBy.get(by)!.filter((v) => s.groups[job.group]!.includes(v.n));
    const files = mine.flatMap((v) => [v.view, ...(v.parts ?? []).map((x) => x.view)]);
    const head = `# Document ${s.id} · reader ${n}${job.blind ? " (blind)" : ""}\n\nPages: ${mine.map((v) => v.n).join(", ")}\n\n${DOC_NEXT}\n`;
    const r = await by.read(String(n), files, `Document ${s.id}`, (report) => docPrompt({ pages: mine, report, lang: s.lang, note: s.note, blind: job.blind, source: about && aboutFor(about, by.agent, by.model) }), { head, signal: stop.signal });
    try {
      fs.writeFileSync(r.report, withoutDocNext(fs.readFileSync(r.report, "utf8")).replace(/\n*$/u, "\n"));
    } catch {
      // the report is what it is
    }
    s = {
      ...s,
      reports: s.reports.map((x) => (x.n === n ? { ...x, outcome: r.outcome, ended: now(), ...(r.costUsd !== undefined ? { usd: r.costUsd } : {}), ...(r.costPartial || r.costUsd === undefined ? { partial: true } : {}), ...(r.resumeAt ? { resets: r.resumeAt } : {}), ...(r.modelRejected ? { rejected: "model" as const } : {}) } : x)),
    };
    saveState(tree.root, s);
  };
  try {
    const queue = [...jobs];
    await Promise.all(
      Array.from({ length: Math.min(queue.length, Math.max(team.parallel, s.readers)) }, async () => {
        for (let job = queue.shift(); job; job = queue.shift()) await runOne(job);
      }),
    );
  } finally {
    clearInterval(look);
  }
  const cancelled = stop.signal.aborted || fs.existsSync(cancelPath(tree.root, s.id));
  fs.rmSync(cancelPath(tree.root, s.id), { force: true });
  const ran = s.reports.filter((r) => r.version === s.version);
  const spent = { usd: teams.reduce((n, x) => n + x.cost(), 0), runs: teams.reduce((n, x) => n + x.runs(), 0), partial: teams.some((x) => x.partial()) };
  // read again and cancelled: the reading before stands (what the new readers wrote stays, their cost counted)
  const back = cancelled ? backBefore(s) : undefined;
  if (back) return finish(ctx, tree, back, ran, spent, true);
  if (cancelled) s = { ...s, state: "cancelled", since: now() };
  else if (s.readers > 1) {
    s = { ...s, state: "checking", since: now() };
    saveState(tree.root, s);
  }
  return finish(ctx, tree, s, ran, spent);
}

/** The end of a reading: its state by its result, the result written, the reports and the result committed. */
/** An error's message on one line, short: for a log. */
const oneLine = (t: string) => t.replace(/\s+/gu, " ").trim().slice(0, 240);

/**
 * The language a reading's failure is said in for the person: the reading's own (the Strom app asks in the language its
 * person reads, --into) where strom has texts in it; else the research's.
 */
function failureLang(tree: Tree, s: ReadState): string {
  return s.lang && (s.lang === "en" || Object.keys(catalog(s.lang)).length > 0) ? s.lang : tree.lang;
}

/** A reading whose reader's agent refused its model: why, for an agent and for the person (Codex: update it, or another model). */
function modelRefused(ctx: Context, tree: Tree, s: ReadState, r: ReadReport): { error: string; failure: ReadFailure } {
  const agent = r.agent ?? s.agent ?? "claude";
  const model = r.model ?? s.model ?? ownModel(agent, ctx.env)?.model ?? "—";
  const codex = agent === "codex";
  const error = codex
    ? `the reader ended: the model ${model} is not available in the Codex CLI installed here — update Codex (npm install -g @openai/codex@latest) or choose another model`
    : `the reader ended: ${agent} does not take the model ${model} — choose another model`;
  const params = { agent, model };
  // which reader (feature read.readerState): the one refused, unless the other reader failed as well
  const others = s.readers > 1 ? s.reports.filter((x) => x.version === s.version && x.blind !== r.blind) : [];
  const alone = s.readers === 1 || others.some((x) => x.outcome === "ok");
  return { error, failure: { code: "model", text: ui(failureLang(tree, s), codex ? "ui.read.model.codex" : "ui.read.model", params), params, ...(alone ? { reader: r.blind ? (2 as const) : (1 as const) } : {}) } };
}

function finish(ctx: Context, tree: Tree, s: ReadState, ran: ReadState["reports"], spent?: { usd: number; runs: number; partial: boolean }, back = false): ReadState {
  if (!back) {
    const draft = buildResult(tree, s);
    const state = s.state === "cancelled" || s.state === "unreadable" ? s.state : endState(draft, ran.some((r) => r.outcome === "ok"));
    const failedWhy = ran.find((r) => r.outcome && r.outcome !== "ok")?.outcome;
    // its agent refused the model (Codex: one its CLI installed here does not have): said with what to do, never only "error"
    const refused = state === "failed" ? ran.find((r) => r.outcome === "error" && r.rejected === "model") : undefined;
    s = { ...s, state, since: now(), ...(refused ? modelRefused(ctx, tree, s, refused) : state === "failed" && failedWhy ? { error: `the reader ${failedWhy === "timeout" ? "stopped at its time limit" : `ended: ${failedWhy}`}` } : {}) };
  }
  delete s.pid;
  delete s.before;
  let result = buildResult(tree, s);
  const write = () => {
    fs.mkdirSync(path.dirname(resultPath(tree.root, s.id)), { recursive: true });
    fs.writeFileSync(resultPath(tree.root, s.id), JSON.stringify(result, null, 2) + "\n");
  };
  const verified = !tree.dryRun && verifyFast(tree).findings.every((f) => f.level !== "error");
  // a source read again from its original: ended only once it is held against the transcript — the app takes the
  // result when it says done, so the state stays as it was until the comparison is in it
  const compares = !back && !!s.source && s.state === "done" && result.entries.length > 0;
  const keeps = verified && compares;
  // held against the transcript all the same where it could not be written to the research: said, never hidden
  const unwritten = (why: string) => {
    if (!s.source || s.source.agree !== undefined || s.source.failed) return;
    const held = heldAgainst(tree, { ...s.source, ...(result.source?.entries ? { entries: result.source.entries } : {}) }, result);
    s = { ...s, source: held.failed ? held : { ...held, failed: { code: "write", why } } };
    result = buildResult(tree, s);
  };
  if (compares && !verified) unwritten(tree.dryRun ? "a dry run: nothing written to the research" : "the research has errors (strom check): the reading not written to its source");
  let persisted = false;
  const persist = () => {
    saveState(tree.root, s);
    write();
    persisted = true;
  };
  if (!keeps) persist();
  if (verified)
    try {
      tree.withTreeLock(() => {
        // the new reading kept beside the source, held against its transcript (a task where they differ) — the source
        // itself, who read it and the user's confirmation never changed
        let kept: SourceRead | undefined;
        if (keeps)
          try {
            kept = keepSourceReading(tree, { ...s.source!, ...(result.source?.entries ? { entries: result.source.entries } : {}) }, result);
            s = { ...s, source: kept };
            result = buildResult(tree, s);
            if (kept.failed) kept = undefined;
          } catch (e) {
            unwritten(oneLine((e as Error).message));
            throw e;
          } finally {
            persist();
          }
        const session = spent?.runs ? addReaders(tree, ctx.env, ctx.refs, { usd: spent.usd, runs: spent.runs, partial: spent.partial }) : undefined;
        const files = [resultPath(tree.root, s.id), ...s.reports.map((r) => reportPath(tree.root, s.id, r.n))].filter((f) => fs.existsSync(f)).map((f) => tree.relative(f));
        tree.commit(`Reading of a document ${s.id}${back ? ", read again and cancelled" : ""}${s.version > 1 ? `, version ${s.version}` : ""}: ${s.state}${result.entries.length ? `, ${counted(result.entries.length, "entry", "entries")}` : ""}${kept ? ` — ${kept.id} read again from its original, ${kept.agree === "same" ? "alike its transcript" : "differs from its transcript"}` : ""}`, [...files, ...(session || kept ? ["data"] : [])]);
      });
    } catch (e) {
      // the tree's lock not had: the reading ends all the same, held against the transcript, said not written
      if (keeps && !persisted) unwritten(oneLine((e as Error).message));
      throw e;
    } finally {
      if (!persisted) persist();
    }
  return s;
}

// ── what an agent reads of it ─────────────────────────────────────────────────────────────────────────────────────

function said(ctx: Context, r: ReadResult): string {
  const cost = r.cost ? ` · $${r.cost.amount.toFixed(2)}${r.cost.partial ? " (at least)" : ""}` : "";
  const files = [...new Set(r.pages.map((p) => p.file))];
  const head = `${r.id} · ${r.state}${r.version > 1 ? ` · version ${r.version}` : ""} · ${counted(r.pages.length, "page")} of ${files.join(", ")} · ${counted(r.readers.ran, "reader")} of ${r.readers.asked}${r.readers.agree ? ` · ${r.readers.agree === "same" ? "they agree" : "they differ"}` : ""}${cost}`;
  const doc = [r.doc.kind, r.readers.kinds ? `the blind reader: ${r.readers.kinds.blind}` : undefined, r.doc.language?.join("+"), r.doc.script, r.doc.date, r.doc.legible ? `legible: ${r.doc.legible}` : undefined, r.doc.why ? `why: ${r.doc.why}` : undefined].filter(Boolean).join(" · ");
  const out: (string | undefined)[] = [head, whoSaid(r), sourceSaid(r), doc ? `document: ${doc}` : undefined];
  for (const e of r.entries) {
    out.push("", `${e.id} · page ${e.page}${e.region ? ` · region ${e.region.join(",")}` : ""}${e.agree ? ` · ${e.agree === "same" ? "both readers alike" : "readers differ"}` : ""}`);
    out.push(`  transcript: ${e.transcript.replace(/\s*\n\s*/g, " | ")}`);
    if (e.translation) out.push(`  translation (${r.lang}): ${e.translation.replace(/\s*\n\s*/g, " ")}`);
    for (const t of e.glossary ?? []) out.push(`  term: ${t.term} = ${t.meaning} (${t.kind})`);
    for (const p of e.persons) {
      const facts = [p.sex, p.age ? `age ${p.age}` : undefined, p.occupation, p.residence].filter(Boolean).join(", ");
      const match = p.match?.length ? ` → ${p.match.map((m) => `${m.person} ${m.score} (${m.why.join("+")})`).join(", ")}` : "";
      out.push(`  ${p.ref} ${p.role}: ${[p.given, p.surname].filter(Boolean).join(" ") || "—"} [written: ${p.written}]${p.today ? ` · today's form by the reader, not of its letters (a lead): ${p.today}` : ""}${facts ? ` · ${facts}` : ""}${p.uncertain?.length ? ` · uncertain: ${p.uncertain.join(", ")}` : ""}${match}`);
    }
    for (const ev of e.events)
      out.push(`  ${ev.type}${ev.label ? ` (${ev.label})` : ""}: ${[ev.date ? `${ev.date.text}${ev.date.gedcom && ev.date.gedcom !== ev.date.text ? ` = ${ev.date.gedcom}` : ""}` : undefined, ev.place ? `${ev.place.text}${ev.place.known ? ` = ${ev.place.known}` : ""}` : undefined, ev.persons.map((p) => `${p.ref}:${p.role}`).join(" ")].filter(Boolean).join(" · ")}${ev.uncertain?.length ? ` · uncertain: ${ev.uncertain.join(", ")}` : ""}`);
    for (const rel of e.relations) out.push(`  ${rel.type === "parent" ? `${rel.parent} parent of ${rel.child}` : `${rel.a} spouse of ${rel.b}`}`);
    for (const v of e.variants ?? []) out.push(`  differs (${v.field}): "${v.at}" / blind reader "${v.other}"`);
  }
  if (r.context) out.push("", `context: ${r.context.replace(/\s*\n\s*/g, " ")}`);
  if (r.checks.length) out.push("", `left out by strom (nothing filled in): ${r.checks.map((c) => `${c.entry}${c.ref ? ` ${c.ref}` : ""} ${c.what} (${c.why})`).join("; ")}`);
  if (r.incomplete?.length) out.push(`NOT read to an end: page ${r.incomplete.join(", ")} — strom document again ${r.id}`);
  if (r.error) out.push(`error: ${r.error}`);
  const result = resultPath(ctx.tree().root, r.id);
  out.push("", `result: ${ctx.display(result)} · reports: ${ctx.display(path.join(path.dirname(result), `${r.id}-<n>.md`))} — no need to open them: strom document show ${r.id}`);
  out.push(...nextOf(r));
  // read again from a small scan: a sharper crop of it from the archive offered, never fetched nor waited for
  if (r.source && FINAL_STATES.includes(r.state)) {
    const fetch = r.pages.map((p) => sharperFetch(ctx, ctx.tree(), p, r.source?.id)).find(Boolean);
    if (fetch) out.push(`sharper: the place is small on its scan — a sharper crop of it from the archive, when the person wants it: ${fetch}; then strom document again ${r.id}`);
  }
  return lines(...out);
}

/** Who read: each reader's agent · model · effort (as readers.who), the blind one said so; none kept: nothing said. */
function whoSaid(r: ReadResult): string | undefined {
  const who = r.readers.who;
  if (!who?.length) return undefined;
  const one = (w: ReaderWho, i: number) => `${[w.agent, w.model, w.effort].filter(Boolean).join(" · ")}${i > 0 ? " (blind)" : ""}${w.ran === false ? " — not read to an end" : ""}`;
  return `who: ${who.map(one).join(" / ")}`;
}

/** A source read again from its original: whether the new reading is alike its transcript, where not and the task. */
function sourceSaid(r: ReadResult): string | undefined {
  const src = r.source;
  if (!src) return undefined;
  const of = `${src.id}${src.clip ? ` (excerpt ${src.clip})` : ""}`;
  // which of the entries read are the source's, where the others are entries beside it
  const again = `read again from its original${src.entries?.length && src.entries.length < r.entries.length ? ` (its entry ${src.entries.join(", ")})` : ""}`;
  const failed = src.failed ? ` — NOT ${src.failed.code === "write" ? "written to the research" : "held against its transcript"}: ${src.failed.why}` : "";
  if (src.agree === "same") return `source: ${of} ${again} — alike its transcript${failed}`;
  if (src.agree === "differ") {
    const v = src.variants ?? [];
    const shown = v.slice(0, 3).map((x) => `"${x.at || "—"}" / "${x.other || "—"}"`).join(", ");
    const more = v.length > 3 ? ` and ${v.length - 3} more` : "";
    return `source: ${of} ${again} — differs from its transcript${shown ? ` (transcript / reading: ${shown}${more})` : ""}${src.task ? ` → task ${src.task}` : ""}${failed}`;
  }
  return `source: ${of} ${again} — ${src.failed ? failed.slice(3) : FINAL_STATES.includes(r.state) ? "not held against its transcript" : "held against its transcript once read"}`;
}

function nextOf(r: ReadResult): string[] {
  switch (r.state) {
    case "done": {
      if (r.source) {
        const src = r.source;
        if (src.failed?.code === "write") return ["", `next: tell the person the reading again of ${src.id} is not written to the research (${src.failed.why}) — the reading itself is kept here (strom document show ${r.id}); strom check says what stops it`];
        if (src.agree === "differ" && src.task) return ["", `next: strom task show ${src.task} — hold this reading against the transcript of ${src.id} there with the person; the source stays as it is, no new source of it`];
        if (src.agree === "same") return ["", `next: tell the person the reading again of ${src.id} from its original is alike its transcript — nothing to record, no new source of it`];
        return ["", `next: look at it yourself against the transcript of ${src.id} (strom source show ${src.id}) — no new source of it`];
      }
      const e = r.entries[0];
      const page = r.pages.find((p) => p.n === e?.page) ?? r.pages[0];
      // the page as strom media view takes it: an image, an input, a page of a PDF (I…:<page>)
      const look = page ? `${page.file}${page.page > 1 ? `:${page.page}` : ""}` : "I…";
      return [
        "",
        `next: tell the person what it says (the translation, the terms, the context). Before anything of it goes into the tree look at it yourself (strom media view ${look}${e?.region ? ` --crop ${e.region.join(",")}` : ""}) and record a source as usual — a reading is no evidence by itself${r.readers.asked < 2 ? `; a second, blind reader: strom document again ${r.id} --readers 2` : ""}`,
      ];
    }
    case "unreadable":
      return ["", r.doc.why === "not-text" ? "next: there is no text on it — tell the person (a photo is kept as it is: strom input show)" : `next: tell the person why it cannot be read (${r.doc.why ?? "illegible"}) — a new photo of it: sharp, straight from above, the whole text in it, no glare`];
    case "cancelled":
    case "failed":
      return ["", `next: read it again when the person wants it: strom document again ${r.id}`];
    default:
      return ["", `next: being read — strom document show ${r.id} (what its readers wrote so far), strom document cancel ${r.id}`];
  }
}

function exitOf(s: ReadState): number {
  return s.state === "failed" || s.state === "cancelled" ? 1 : 0;
}

/**
 * The reading's ID given beforehand (--id, with --queue): the bridge of the Strom app answers the app with it before the
 * reading is queued. A new one only — never the ID of a reading there is.
 */
function givenId(tree: Tree, opts: Record<string, unknown>): string | undefined {
  if (opts.id === undefined) return undefined;
  const id = String(opts.id).trim();
  if (!opts.queue) throw new UsageError("--id is given only with --queue", { hint: "strom document read … --queue --id D…" });
  if (!READ_ID.test(id)) throw new UsageError(`invalid --id "${id.slice(0, 40)}"`, { hint: "a reading's ID: D<yyyymmddhhmmss>-<4 hex>" });
  if (loadState(tree.root, id) || fs.existsSync(resultPath(tree.root, id))) throw new UsageError(`${id} is a reading there is already`, { hint: `strom document show ${id}` });
  return id;
}

/** A reading kept to be read later (--queue): said, nothing read. */
function queuedSaid(ctx: Context, tree: Tree, s: ReadState) {
  const result = buildResult(tree, s);
  return { text: lines(`${s.id} · queued${s.version > 1 ? ` · version ${s.version}` : ""} · ${counted(s.pages.length, "page")} · ${counted(s.readers, "reader")}${s.only ? " (the blind one)" : ""}`, "", `next: strom document read ${s.id} reads it (the bridge of the Strom app reads its queue by itself) — strom document cancel ${s.id}`), data: result };
}

/** A queued reading cancelled before its readers began: nothing read; read again, the reading before stands as it was. */
function cancelQueued(ctx: Context, tree: Tree, s: ReadState): ReadState {
  const back = backBefore(s);
  if (!back) return finish(ctx, tree, { ...s, state: "cancelled", since: now() }, []);
  saveState(tree.root, back);
  return back;
}

/** The options a queued reading was asked with: never given again when it is read. */
const ASKED_OPTIONS = ["readers", "into", "region", "note", "person", "queue", "effort", "blind-agent", "blind-model", "blind-effort", "source", "clip"];

/** A reading queued (--queue) read now, as it was asked: its readers, language, pages; only the blind one when so queued. */
async function readQueued(ctx: Context, tree: Tree, id: string, opts: Record<string, unknown>) {
  const given = ASKED_OPTIONS.filter((o) => opts[o] !== undefined && opts[o] !== false);
  if (given.length) throw new UsageError(`${id} is read as it was asked: --${given[0]} is not given again`, { hint: `strom document read ${id}${typeof opts.model === "string" ? ` --model ${opts.model}` : ""}` });
  let s = stateOf(tree, id);
  if (s.state !== "queued") throw new UsageError(`${id} is not queued (${s.state})`, { hint: FINAL_STATES.includes(s.state) ? `strom document show ${id} — read it anew: strom document again ${id}` : `strom document show ${id}` });
  if (s.pid && s.pid !== process.pid && alive(s.pid)) throw new UsageError(`${id} is being read now`, { hint: `strom document show ${id}` });
  // asked to stop before its reader started: cancelled, nothing read
  if (fs.existsSync(cancelPath(tree.root, id))) {
    fs.rmSync(cancelPath(tree.root, id), { force: true });
    s = cancelQueued(ctx, tree, s);
  } else {
    // its readers as asked; a --model given now is the model of those of the first reader's agent
    const model = typeof opts.model === "string" ? opts.model.trim() : undefined;
    const lead = s.with?.[0]?.agent;
    const withNow = model === undefined || !s.with ? s.with : s.with.map((r) => (r.agent === lead ? { agent: r.agent, ...(model ? { model } : {}), ...(r.effort ? { effort: r.effort } : {}) } : r));
    s = { ...s, pid: process.pid, ...(withNow ? { with: withNow } : {}) };
    saveState(tree.root, s);
    s = await readNow(ctx, tree, s, opts, s.only);
  }
  const result = buildResult(tree, s);
  return { text: said(ctx, result), data: result, exitCode: exitOf(s) };
}

// ── the commands ──────────────────────────────────────────────────────────────────────────────────────────────────

register({
  path: ["document", "read"],
  summary: "Read one document at once (a register entry, a letter, a deed, a gravestone, a photo's back, a PDF): transcript, translation, terms, people",
  group: "inputs",
  tree: true,
  description:
    "A photo or scan the person hands over is read by a reader with a clean context (as strom read): the transcript\n" +
    "word for word, its translation into the research's language (--into another), what its old words, abbreviations\n" +
    "and occupations mean, a few sentences of context, and the people, events and relations it names. Nothing is\n" +
    "filled in: a name a reader gives must stand in its transcript, else strom leaves it out and says so; what the\n" +
    "transcript marks [?] is uncertain, what it marks [...] is left out. strom, never the reader, says which people of\n" +
    "the tree a person may be (same given name and family name; sex, years, place add to it) and which place a place is.\n" +
    "--readers 2: a second reader reads it blind (transcript, people, events alone); where the two differ is said.\n" +
    "No text on it (a photo of a house), or a photo of text that cannot be read: said with why (not-text, blur,\n" +
    `glare, angle, cut, dark, small) — a page whose shorter side is below ${SMALL_PX} px is said small with no reader.\n` +
    `A file not in the research yet becomes an input of it (no task). At most ${DOC_PAGES} pages; HEIC and PDF are converted.\n` +
    "Nothing enters the tree by itself: look at it yourself and record a source as usual. It waits for its reader\n" +
    "(a few minutes): run it in the foreground. The result: strom document show D…; again: strom document again D….\n" +
    "--queue: only kept to be read, nothing read now (the bridge of the Strom app reads its queue one at a time); a\n" +
    "reading queued so is read by strom document read D… — as it was asked.\n" +
    "Who reads: --agent, --model, --effort the first reader, --blind-agent, --blind-model, --blind-effort the blind one\n" +
    "(left out: as the research's settings say); the result says who read (readers.who). Nothing of it is kept as a setting.\n" +
    "--source S…: the record of a source read again from its original here (its excerpts, else its images or its scan;\n" +
    "--clip <mark>: one excerpt), its readers never shown its transcript. The new reading is kept beside the source and\n" +
    "held against its transcript: where they differ, a task to hold the two against each other — the source, who read\n" +
    "it and a transcript the user confirmed stay as they are.",
  args: [{ name: "files", description: "the document: a photo, scan or PDF, or its input I… or image M… (several: its pages, in order); or a reading queued: D…", variadic: true }],
  options: [
    { name: "readers", type: "string", value: "1|2", description: "readers: 1 (default), or 2 — the second blind, where they differ is said" },
    { name: "into", type: "string", value: "<code>", description: "the language of the translation and the explanations (default: the research's)" },
    { name: "region", type: "string", multiple: true, value: "[<page>:]x,y,w,h", description: "read only this part of a page: fractions of it from its top left (repeatable, one per page)" },
    { name: "note", type: "string", value: "<text>", description: "what the person says the document is (\"the back of a photo\") — a description only, never names to find" },
    { name: "person", type: "string", multiple: true, value: "<P…>", description: "a person it is of, as the person says (repeatable)" },
    { name: "name", type: "string", multiple: true, value: "[<file>:]<name>", description: "the name a file is shown under in the reading (default: its input's name, an image's original file name; repeatable, 2:<name> for the second file)" },
    ...WITH_OPTIONS,
    { name: "source", type: "string", value: "<S…>", description: "read a source's record again from its original here, never from its transcript" },
    { name: "clip", type: "string", value: "<mark>", description: "with --source: only this excerpt of it (its mark: c…, or input)" },
    { name: "minutes", type: "string", value: "<n>", description: READER_MINUTES_HELP, mistaken: ["timeout", "time", "time-limit", "max-minutes"] },
    { name: "queue", type: "boolean", description: "keep it to be read later, read nothing now (strom document read D… reads it)" },
    { name: "id", type: "string", value: "<D…>", description: "with --queue: the reading's ID given beforehand (the bridge of the Strom app answers with it at once); a new one, never one there is" },
  ],
  examples: ["strom document read photo.jpg", "strom document read I0004 --readers 2", 'strom document read back.heic --note "the back of a photo"', "strom document read letter.pdf --into en", "strom document read I0004 --readers 2 --blind-model <model>", "strom document read --source S0012 --readers 2"],
  run: async (ctx: Context, { args, opts }) => {
    const tree = ctx.tree();
    refuseInArchive(tree, "strom document read");
    if (args.length === 1 && READ_ID.test(args[0]!.trim())) return readQueued(ctx, tree, args[0]!.trim(), opts);
    const source = typeof opts.source === "string" ? normId(opts.source.trim()) : undefined;
    if (source && args.length) throw new UsageError("--source reads the source's own original: no file is given with it", { hint: `strom document read --source ${source}` });
    if (!source && opts.clip !== undefined) throw new UsageError("--clip is an excerpt of a source: only with --source", { hint: "strom document read --source S… --clip <mark>" });
    if (!source && !args.length) throw new UsageError("what to read: a file, an input I… or image M…, a reading queued D…, or --source S…", { hint: "strom document read <file>" });
    const asked = readersOf(opts.readers, 1);
    const readWho = withOf(ctx, tree, opts);
    const into = typeof opts.into === "string" ? opts.into.trim().toLowerCase() : tree.lang;
    if (!isValidLang(into)) throw new UsageError(`invalid --into "${String(opts.into)}"`, { hint: "a language code: cs, de, en, pl …" });
    const regions = regionsOf(opts.region);
    const note = typeof opts.note === "string" ? opts.note.replace(/[\p{Cc}]/gu, " ").trim().slice(0, 500) || undefined : undefined;
    const persons = checkOriginalMeta(tree, { persons: (Array.isArray(opts.person) ? opts.person : opts.person ? [opts.person] : []).map((p) => String(p).trim().toUpperCase()) }).persons;
    const id = givenId(tree, opts) ?? newReadId();
    // the files first (a new one kept as an input), each input saying it was read — committed before a reader starts
    let pages: ReadPage[] = [];
    // a source read again: its original as the research has it here (nothing added to the research to read it)
    const clip = typeof opts.clip === "string" ? opts.clip.trim() : undefined;
    if (source) {
      const shared = ctx.settings.shared()?.value;
      const no = notAgain(tree, shared, source, clip);
      if (no === "none") throw new UsageError(`no source ${source} to read again`, { code: "read.source.none", params: { source }, hint: "strom source list" });
      if (no === "notext") throw new StromError(`${source} has no transcript to hold a new reading against`, { code: "read.source.notext", params: { source }, hint: `read its record as a document: strom document read <its image>` });
      if (no === "noscan") throw new StromError(`${source} has no original here to read${clip ? ` (excerpt ${clip})` : ""}: no image of its record on this computer`, { code: "read.source.noscan", params: { source, ...(clip ? { clip } : {}) }, hint: `strom source show ${source}` });
      const running = readingOfSource(tree.root, source);
      if (running) throw new StromError(`${source} is being read again now (${running})`, { code: "read.source.running", params: { source, read: running }, hint: `strom document show ${running}` });
      pages = pagesOf(tree, originalPages(tree, shared, tree.get<Source>(source)!, clip), regions);
    } else
    tree.withTreeLock(() => {
      try {
        const { records, added } = filesOf(ctx, tree, args, persons, note);
        for (const [at, name] of namesOf(opts.name, records.length)) records[at - 1]!.name = name;
        pages = pagesOf(tree, records, regions);
        for (const r of new Set(records.map((x) => x.id)))
          if (r.startsWith("I")) update<Input>(tree, r, "input", (i) => ({ ...i, read: [...(i.read ?? []), id] }), { op: "input.read", summary: `${r} read: ${id}` });
        if (!tree.dryRun) tree.commit(`Document ${id} to read: ${[...new Set(records.map((x) => x.id))].join(", ")}${added.length ? ` (${added.join(", ")} added)` : ""}`, ["data", ...(fs.existsSync(path.join(tree.root, "inputs")) ? ["inputs"] : [])]);
      } catch (err) {
        tree.rollback();
        throw err;
      }
    });
    const at = now();
    // whoever asked: the Strom app (its bridge runs this as the person's), else the agent's worker
    const from = ctx.env.STROM_FOR_APP ? APP_READ_FROM : ctx.env.STROM_WORKER;
    // queued to be read later: no process of its own until it is read; read now: this one's (never taken for gone)
    let s: ReadState = { id, state: "queued", version: 1, readers: asked, lang: into, pages, groups: [], reports: [], with: readWho, ...(source ? { source: { id: source, ...(clip ? { clip } : {}) } } : {}), ...(persons.length ? { persons } : {}), ...(note ? { note } : {}), at, since: at, ...(from ? { from } : {}), ...(opts.queue ? {} : { pid: process.pid }) };
    saveState(tree.root, s);
    if (opts.queue) return queuedSaid(ctx, tree, s);
    s = await readNow(ctx, tree, s, opts);
    const result = buildResult(tree, s);
    return { text: said(ctx, result), data: result, exitCode: exitOf(s) };
  },
});

register({
  path: ["document", "again"],
  summary: "Read a document again under its reading: a second, blind reader after one, else all its readers anew",
  group: "inputs",
  tree: true,
  description:
    "After one reader, --readers 2 adds the second, blind reader alone and compares the two (the first reading\n" +
    "stays). Otherwise the document is read anew (a failed or cancelled reading, a new try). Either way its version\n" +
    "goes up by one; the reports before stay. Cancelled before it ends, the reading before stands as it was.\n" +
    "--queue: only kept to be read (strom document read D… reads it).",
  args: [{ name: "reading", description: "the reading: D…", required: true }],
  options: [
    { name: "readers", type: "string", value: "1|2", description: "readers: as before, or 2 — after one, the blind second reader alone" },
    ...WITH_OPTIONS,
    { name: "minutes", type: "string", value: "<n>", description: READER_MINUTES_HELP, mistaken: ["timeout", "time", "time-limit", "max-minutes"] },
    { name: "queue", type: "boolean", description: "keep it to be read later, read nothing now (strom document read D… reads it)" },
  ],
  examples: ["strom document again D20260101120000-ab12 --readers 2"],
  run: async (ctx: Context, { args, opts }) => {
    const tree = ctx.tree();
    refuseInArchive(tree, "strom document again");
    const before = stateOf(tree, readId(args[0]));
    if (!FINAL_STATES.includes(before.state)) throw new UsageError(`${before.id} is being read now`, { hint: `strom document show ${before.id} — or stop it: strom document cancel ${before.id}` });
    const asked = readersOf(opts.readers, before.readers);
    // one reader read it to an end: only the blind one, against it
    const firstOk = before.state === "done" && before.readers === 1 && asked === 2 && before.reports.some((r) => r.version === before.version && !r.blind && r.outcome === "ok");
    // who reads now: as asked now (the first reader's, when only the blind one reads, as it read)
    const asWho = withOf(ctx, tree, opts);
    const readWho = firstOk ? [before.with?.[0] ?? { agent: before.agent ?? asWho[0]!.agent, ...(before.model ? { model: before.model } : {}) }, asWho[1]!] : asWho;
    let s: ReadState = { ...before, state: "queued", version: nextVersion(before), readers: asked, since: now(), before: beforeOf(before), with: readWho, ...(before.source ? { source: { id: before.source.id, ...(before.source.clip ? { clip: before.source.clip } : {}), ...(before.source.task ? { task: before.source.task } : {}) } } : {}), ...(opts.queue ? {} : { pid: process.pid }) };
    delete s.why;
    delete s.error;
    delete s.failure;
    delete s.only;
    if (opts.queue) {
      if (firstOk) s.only = "blind";
      saveState(tree.root, s);
      return queuedSaid(ctx, tree, s);
    }
    saveState(tree.root, s);
    s = await readNow(ctx, tree, s, opts, firstOk ? "blind" : undefined);
    const result = buildResult(tree, s);
    return { text: said(ctx, result), data: result, exitCode: exitOf(s) };
  },
});

register({
  path: ["document", "cancel"],
  summary: "Stop a reading of a document at work: its readers stop, what they wrote stays",
  group: "inputs",
  tree: true,
  args: [{ name: "reading", description: "the reading: D…", required: true }],
  examples: ["strom document cancel D20260101120000-ab12"],
  run: (ctx: Context, { args }) => {
    const tree = ctx.tree();
    const s = stateOf(tree, readId(args[0]));
    if (FINAL_STATES.includes(s.state)) return { text: `${s.id} is not being read (${s.state}): nothing to stop`, data: { id: s.id, state: s.state, cancelled: false } };
    // queued, no reader started: cancelled now (its result written, nothing read)
    if (s.state === "queued" && !alive(s.pid)) {
      const done = cancelQueued(ctx, tree, s);
      const kept = s.before ? ` — the reading before stands (${done.state}${done.version > 1 ? `, version ${done.version}` : ""})` : "";
      return { text: `${s.id}: queued, cancelled — nothing was read${kept}`, data: { id: s.id, state: done.state, cancelled: true } };
    }
    fs.mkdirSync(path.dirname(cancelPath(tree.root, s.id)), { recursive: true });
    fs.writeFileSync(cancelPath(tree.root, s.id), `${now()}\n`);
    return { text: `${s.id}: its readers are being stopped (strom document show ${s.id})`, data: { id: s.id, state: s.state, cancelled: true } };
  },
});

register({
  path: ["document", "show"],
  summary: "A reading of a document: its result, or what its readers wrote so far",
  group: "inputs",
  tree: true,
  args: [{ name: "reading", description: "the reading: D…", required: true }],
  examples: ["strom document show D20260101120000-ab12 --json"],
  run: (ctx: Context, { args }) => showReading(ctx, readId(args[0])),
});

/** A reading of a document as strom document show (and strom readings D…) says it: its result, or what its readers wrote so far. */
export function showReading(ctx: Context, id: string): { text: string; data: ReadResult } {
  const tree = ctx.tree();
  const s = loadState(tree.root, id);
  let result: ReadResult;
  if (s) result = buildResult(tree, settled(tree, s));
  else if (fs.existsSync(resultPath(tree.root, id))) result = JSON.parse(fs.readFileSync(resultPath(tree.root, id), "utf8")) as ReadResult;
  else throw new UsageError(`no reading ${id}`, { hint: "strom document list" });
  return { text: said(ctx, result), data: result };
}

register({
  path: ["document", "list"],
  summary: "The readings of documents of this research, newest first",
  group: "inputs",
  tree: true,
  examples: ["strom document list --json"],
  run: (ctx: Context) => {
    const tree = ctx.tree();
    const all = listReadings(tree.root).map((r) => (FINAL_STATES.includes(r.state) || r.resultOnly ? r : { ...r, state: settled(tree, loadState(tree.root, r.id)!).state }));
    if (!all.length) return { text: "no readings of documents yet (strom document read <file>)", data: [] };
    return {
      text: table(
        all.map((r) => [r.id, r.state, r.files.join(","), counted(r.pages, "page"), `${r.ran} of ${r.readers}`, stamp(Date.parse(r.since))]),
        { header: ["reading", "state", "files", "pages", "readers", "since"] },
      ),
      data: all,
    };
  },
});

export const _test = { regionsOf, groupsOf };
