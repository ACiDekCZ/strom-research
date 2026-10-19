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
import { safeFolderName } from "../core/text.ts";
import type { Tree } from "../core/tree.ts";
import { checkOriginalMeta } from "../core/originals.ts";
import { refuseInArchive } from "../core/state.ts";
import { isValidLang } from "../core/lang.ts";
import { makeView, SPREAD_OVERLAP } from "../core/views.ts";
import { readableFile } from "../core/readable.ts";
import { shownSize } from "../image/index.ts";
import { verifyFast } from "../core/integrity.ts";
import { addReaders } from "../core/session.ts";
import { READER_MINUTES_HELP } from "../core/reader.ts";
import { stamp } from "../core/net.ts";
import { readers } from "./readers.ts";
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
  SMALL_PX,
  withoutDocNext,
  type DocPageView,
  type ReadPage,
  type ReadResult,
  type ReadState,
  type Region,
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

function readersOf(said: unknown, dflt: number): number {
  if (said === undefined) return dflt;
  const n = Number(said);
  if (n !== 1 && n !== 2) throw new UsageError(`invalid --readers "${String(said)}"`, { hint: "1, or 2 (the second reads blind; where they differ is said)" });
  return n;
}

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
      records.push({ id, file, name: "name" in rec && rec.name ? rec.name : path.basename(file), ...(rec.sha ? { sha: rec.sha } : {}) });
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
function pagesOf(tree: Tree, records: { id: string; file: string; name: string; sha?: string }[], regions: Map<number, Region>): ReadPage[] {
  const pages: ReadPage[] = [];
  for (const r of records) {
    const first = readableFile(tree.root, r.file, { env: tree.env });
    for (let p = 1; p <= first.pages; p++) {
      if (pages.length >= DOC_PAGES) throw new UsageError(`more than ${DOC_PAGES} pages: one reading reads at most ${DOC_PAGES}`, { code: "read.pages", params: { pages: String(DOC_PAGES) }, hint: "the pages of one document only, in parts: strom document read <file> … of its first pages, then of the next" });
      const readable = p === 1 ? first : readableFile(tree.root, r.file, { env: tree.env, page: p });
      const size = shownSize(new Uint8Array(fs.readFileSync(readable.file)));
      const n = pages.length + 1;
      const region = regions.get(n);
      pages.push({ n, file: r.id, ...(r.sha ? { sha: r.sha } : {}), name: r.name, page: p, ...(size ? { w: size.width, h: size.height } : {}), ...(region ? { region } : {}) });
    }
  }
  return pages;
}

/** The views of a page for a reader: the page whole (or the part asked), and a dense page in two halves too. */
function viewsOf(tree: Tree, shared: string, page: ReadPage, max: number): DocPageView {
  const file = fileOf(tree, shared, page.file);
  const spec = { max, ...(page.page > 1 ? { page: page.page } : {}) };
  const meta = { reader: true, capFrom: "default" as const };
  if (page.region) {
    const [x, y, w, h] = page.region;
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
  const team = readers(ctx, tree, shared, "document", "1", opts, undefined, { stem: s.id });
  const views = s.pages.map((p) => viewsOf(tree, shared, p, team.viewMax));
  s = { ...s, groups: groupsOf(views), state: "reading", since: now(), pid: process.pid, ...(team.model ? { model: team.model } : {}) };
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
  const runOne = async (job: { group: number; blind: boolean }) => {
    if (stop.signal.aborted) return;
    const n = next++;
    s = { ...s, reports: [...s.reports, { n, group: job.group, blind: job.blind, version: s.version }] };
    saveState(tree.root, s);
    const mine = views.filter((v) => s.groups[job.group]!.includes(v.n));
    const files = mine.flatMap((v) => [v.view, ...(v.parts ?? []).map((x) => x.view)]);
    const head = `# Document ${s.id} · reader ${n}${job.blind ? " (blind)" : ""}\n\nPages: ${mine.map((v) => v.n).join(", ")}\n\n${DOC_NEXT}\n`;
    const r = await team.read(String(n), files, `Document ${s.id}`, (report) => docPrompt({ pages: mine, report, lang: s.lang, note: s.note, blind: job.blind }), { head, signal: stop.signal });
    try {
      fs.writeFileSync(r.report, withoutDocNext(fs.readFileSync(r.report, "utf8")).replace(/\n*$/u, "\n"));
    } catch {
      // the report is what it is
    }
    s = {
      ...s,
      reports: s.reports.map((x) => (x.n === n ? { ...x, outcome: r.outcome, ...(r.costUsd !== undefined ? { usd: r.costUsd } : {}), ...(r.costPartial || r.costUsd === undefined ? { partial: true } : {}), ...(r.resumeAt ? { resets: r.resumeAt } : {}) } : x)),
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
  const spent = { usd: team.cost(), runs: team.runs(), partial: team.partial() };
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
function finish(ctx: Context, tree: Tree, s: ReadState, ran: ReadState["reports"], spent?: { usd: number; runs: number; partial: boolean }, back = false): ReadState {
  if (!back) {
    const draft = buildResult(tree, s);
    const state = s.state === "cancelled" || s.state === "unreadable" ? s.state : endState(draft, ran.some((r) => r.outcome === "ok"));
    const failedWhy = ran.find((r) => r.outcome && r.outcome !== "ok")?.outcome;
    s = { ...s, state, since: now(), ...(state === "failed" && failedWhy ? { error: `the reader ${failedWhy === "timeout" ? "stopped at its time limit" : `ended: ${failedWhy}`}` } : {}) };
  }
  delete s.pid;
  delete s.before;
  saveState(tree.root, s);
  const result = buildResult(tree, s);
  fs.mkdirSync(path.dirname(resultPath(tree.root, s.id)), { recursive: true });
  fs.writeFileSync(resultPath(tree.root, s.id), JSON.stringify(result, null, 2) + "\n");
  if (!tree.dryRun && verifyFast(tree).findings.every((f) => f.level !== "error"))
    tree.withTreeLock(() => {
      const session = spent?.runs ? addReaders(tree, ctx.env, ctx.refs, { usd: spent.usd, runs: spent.runs, partial: spent.partial }) : undefined;
      const files = [resultPath(tree.root, s.id), ...s.reports.map((r) => reportPath(tree.root, s.id, r.n))].filter((f) => fs.existsSync(f)).map((f) => tree.relative(f));
      tree.commit(`Reading of a document ${s.id}${back ? ", read again and cancelled" : ""}${s.version > 1 ? `, version ${s.version}` : ""}: ${s.state}${result.entries.length ? `, ${counted(result.entries.length, "entry", "entries")}` : ""}`, [...files, ...(session ? ["data"] : [])]);
    });
  return s;
}

// ── what an agent reads of it ─────────────────────────────────────────────────────────────────────────────────────

function said(ctx: Context, r: ReadResult): string {
  const cost = r.cost ? ` · $${r.cost.amount.toFixed(2)}${r.cost.partial ? " (at least)" : ""}` : "";
  const files = [...new Set(r.pages.map((p) => p.file))];
  const head = `${r.id} · ${r.state}${r.version > 1 ? ` · version ${r.version}` : ""} · ${counted(r.pages.length, "page")} of ${files.join(", ")} · ${counted(r.readers.ran, "reader")} of ${r.readers.asked}${r.readers.agree ? ` · ${r.readers.agree === "same" ? "they agree" : "they differ"}` : ""}${cost}`;
  const doc = [r.doc.kind, r.doc.language?.join("+"), r.doc.script, r.doc.date, r.doc.legible ? `legible: ${r.doc.legible}` : undefined, r.doc.why ? `why: ${r.doc.why}` : undefined].filter(Boolean).join(" · ");
  const out: (string | undefined)[] = [head, doc ? `document: ${doc}` : undefined];
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
  return lines(...out);
}

function nextOf(r: ReadResult): string[] {
  switch (r.state) {
    case "done": {
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
const ASKED_OPTIONS = ["readers", "into", "region", "note", "person", "queue"];

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
    s = { ...s, pid: process.pid };
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
    "reading queued so is read by strom document read D… — as it was asked.",
  args: [{ name: "files", description: "the document: a photo, scan or PDF, or its input I… or image M… (several: its pages, in order); or a reading queued: D…", variadic: true, required: true }],
  options: [
    { name: "readers", type: "string", value: "1|2", description: "readers: 1 (default), or 2 — the second blind, where they differ is said" },
    { name: "into", type: "string", value: "<code>", description: "the language of the translation and the explanations (default: the research's)" },
    { name: "region", type: "string", multiple: true, value: "[<page>:]x,y,w,h", description: "read only this part of a page: fractions of it from its top left (repeatable, one per page)" },
    { name: "note", type: "string", value: "<text>", description: "what the person says the document is (\"the back of a photo\") — a description only, never names to find" },
    { name: "person", type: "string", multiple: true, value: "<P…>", description: "a person it is of, as the person says (repeatable)" },
    { name: "model", type: "string", value: "<model>", description: "model of the readers (default: model.vision — never weaker for handwriting)" },
    { name: "minutes", type: "string", value: "<n>", description: READER_MINUTES_HELP, mistaken: ["timeout", "time", "time-limit", "max-minutes"] },
    { name: "queue", type: "boolean", description: "keep it to be read later, read nothing now (strom document read D… reads it)" },
  ],
  examples: ["strom document read photo.jpg", "strom document read I0004 --readers 2", 'strom document read back.heic --note "the back of a photo"', "strom document read letter.pdf --into en"],
  run: async (ctx: Context, { args, opts }) => {
    const tree = ctx.tree();
    refuseInArchive(tree, "strom document read");
    if (args.length === 1 && READ_ID.test(args[0]!.trim())) return readQueued(ctx, tree, args[0]!.trim(), opts);
    const asked = readersOf(opts.readers, 1);
    const into = typeof opts.into === "string" ? opts.into.trim().toLowerCase() : tree.lang;
    if (!isValidLang(into)) throw new UsageError(`invalid --into "${String(opts.into)}"`, { hint: "a language code: cs, de, en, pl …" });
    const regions = regionsOf(opts.region);
    const note = typeof opts.note === "string" ? opts.note.replace(/[\p{Cc}]/gu, " ").trim().slice(0, 500) || undefined : undefined;
    const persons = checkOriginalMeta(tree, { persons: (Array.isArray(opts.person) ? opts.person : opts.person ? [opts.person] : []).map((p) => String(p).trim().toUpperCase()) }).persons;
    const id = newReadId();
    // the files first (a new one kept as an input), each input saying it was read — committed before a reader starts
    let pages: ReadPage[] = [];
    tree.withTreeLock(() => {
      try {
        const { records, added } = filesOf(ctx, tree, args, persons, note);
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
    let s: ReadState = { id, state: "queued", version: 1, readers: asked, lang: into, pages, groups: [], reports: [], ...(persons.length ? { persons } : {}), ...(note ? { note } : {}), at, since: at, ...(from ? { from } : {}), ...(opts.queue ? {} : { pid: process.pid }) };
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
    { name: "model", type: "string", value: "<model>", description: "model of the readers (default: model.vision)" },
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
    let s: ReadState = { ...before, state: "queued", version: nextVersion(before), readers: asked, since: now(), before: beforeOf(before), ...(opts.queue ? {} : { pid: process.pid }) };
    delete s.why;
    delete s.error;
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
