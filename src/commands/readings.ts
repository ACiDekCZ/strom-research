// strom readings — what earlier readers (strom read) reported, compact: the finds and the unclear entries
// whole, from the blocks with nothing found only what the reader could not read (a possible match hides
// there), and the gaps and parts of the book they saw. One image's block word for word with --image.
// The reports in notes/readings stay as they are; nothing is written.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import { lines, runs, shellArg, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import type { Media, RecordSet, Search } from "../core/model.ts";
import { requireRecord } from "../core/records.ts";
import { parseReport, type Finding } from "../core/reader.ts";
import { foldText } from "../core/text.ts";
import type { Tree } from "../core/tree.ts";

export interface Block extends Finding {
  /** The report it is in (its file name without .md). */
  report: string;
  /** The image number in its record set. */
  num?: number | undefined;
  recordset?: string | undefined;
}

export interface Reading {
  /** The name every report of one strom read shares: notes/readings/<stem>-<n>.md */
  stem: string;
  question?: string | undefined;
  context?: string | undefined;
  reports: string[];
  blocks: Block[];
  mtime: number;
}

/** A line of a report's head: "Question: …". */
function headLine(head: string, key: string): string | undefined {
  return new RegExp(`^${key}:\\s*(.+)$`, "m").exec(head)?.[1]?.trim() || undefined;
}

/** The reports strom read wrote ("# Reading …"), by reading — the newest first. Those of strom clips and transcripts are not readings. */
export function loadReadings(tree: Tree): Reading[] {
  const dir = path.join(tree.root, "notes", "readings");
  if (!fs.existsSync(dir)) return [];
  const media = new Map(tree.list<Media>("media").map((m) => [m.id, m]));
  const byStem = new Map<string, Reading>();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const full = path.join(dir, file);
    let text: string;
    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    if (!text.startsWith("# Reading")) continue;
    const name = file.slice(0, -3);
    const stem = /^(.*)-\d+$/.exec(name)?.[1] ?? name;
    const head = text.split(/^##\s/m)[0] ?? "";
    const book = /^# Reading ([Bb]\d+)-/.exec(head)?.[1]?.toUpperCase();
    const r = byStem.get(stem) ?? { stem, question: headLine(head, "Question"), context: headLine(head, "Context"), reports: [], blocks: [], mtime: 0 };
    r.reports.push(name);
    r.mtime = Math.max(r.mtime, fs.statSync(full).mtimeMs);
    for (const f of parseReport(text)) {
      const m = f.media ? media.get(f.media) : undefined;
      r.blocks.push({ ...f, report: name, num: f.number ?? m?.image, recordset: m?.recordset ?? book });
    }
    byStem.set(stem, r);
  }
  const all = [...byStem.values()];
  for (const r of all) {
    r.reports.sort((a, b) => Number(/-(\d+)$/.exec(a)?.[1] ?? 0) - Number(/-(\d+)$/.exec(b)?.[1] ?? 0));
    r.blocks.sort((a, b) => (a.num ?? 0) - (b.num ?? 0));
  }
  // newest first: the day in the name, then when it was written
  return all.sort((a, b) => b.stem.slice(0, 10).localeCompare(a.stem.slice(0, 10)) || b.mtime - a.mtime || b.stem.localeCompare(a.stem));
}

/** "5-113,130-228" → [[5,113],[130,228]] (en dashes too). */
export function parseRanges(v: string): [number, number][] | undefined {
  const out: [number, number][] = [];
  for (const part of v.split(/[,;\s]+/).filter(Boolean)) {
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(part);
    if (!m) return undefined;
    out.push([Number(m[1]), Number(m[2] ?? m[1])]);
  }
  return out.length ? out : undefined;
}

const within = (n: number | undefined, ranges: [number, number][]) => n !== undefined && ranges.some(([a, b]) => n >= a && n <= b);
const label = (b: Block) => `${b.num ?? b.image}`;
const joined = (v: string[] | undefined, max = 500) => truncate((v ?? []).join(" · "), max);

/**
 * What of a block with nothing found speaks of the words asked for: the pieces of its lines that name them. Words of
 * the question itself are looked for only in what the reader could not read and the remarks — readers repeat the
 * question in a "nothing" block ("no entry of <surname>"); other words (a godparent, a house) in its entries too.
 */
function nothingSays(b: Block, phrases: string[], question: string | undefined): string[] {
  const asked = foldText(question ?? "");
  const out: string[] = [];
  const fields: [string, string[] | undefined][] = [["entries", b.entries], ["illegible", b.illegible], ["certainty", b.certainty], ["gaps", b.gaps], ["section", b.section]];
  for (const [key, values] of fields)
    for (const v of values ?? []) {
      const pieces = v.split(/;\s+|\s+·\s+/u).filter((x) => phrases.some((p) => foldText(x).includes(p) && (key !== "entries" || !asked.includes(p))));
      if (pieces.length) out.push(`${key}: ${pieces.join(" · ")}`);
    }
  return out;
}

export interface Shown {
  block: Block;
  /** Of a block with nothing found: what it says that is shown. */
  said?: string[];
}

/** What of a reading is shown: found and unclear blocks whole, what was illegible where nothing was found (with --match: what mentions it). */
export function select(blocks: Block[], o: { match?: string[] | undefined; question?: string | undefined } = {}): Shown[] {
  const phrases = (o.match ?? []).map(foldText).filter(Boolean);
  const out: Shown[] = [];
  for (const b of blocks) {
    if (b.result !== "nothing") {
      if (!phrases.length || phrases.some((p) => foldText(b.text).includes(p))) out.push({ block: b });
    } else if (phrases.length) {
      const said = nothingSays(b, phrases, o.question);
      if (said.length) out.push({ block: b, said });
    } else if (b.illegible?.length) out.push({ block: b, said: [`illegible: ${b.illegible.join(" · ")}`] });
  }
  return out;
}

/** The lines of what a reading says: found and unclear blocks whole, what was illegible where nothing was found, the gaps. */
export function summary(blocks: Block[], o: { match?: string[] | undefined; question?: string | undefined; maxLines?: number | undefined } = {}): { lines: string[]; more: number; gaps: string[]; shown: Shown[] } {
  const out: string[] = [];
  let more = 0;
  const shown = select(blocks, o);
  for (const { block: b, said } of shown) {
    const ls = said
      ? [`  ${label(b)} [nothing] ${truncate(said.join(" · "), 500)}`]
      : [
          `  ${label(b)} [${b.result}]${b.media && b.num !== undefined ? ` ${b.media}` : ""}${b.pages ? ` · p. ${b.pages}` : ""}`,
          ...(b.entries ?? []).map((e) => `    ${e}`),
          ...(b.certainty?.length ? [`    certainty: ${joined(b.certainty)}`] : []),
          ...(b.illegible?.length ? [`    illegible: ${joined(b.illegible)}`] : []),
        ];
    if (o.maxLines !== undefined && out.length + ls.length > o.maxLines) more++;
    else out.push(...ls);
  }
  const gaps = blocks.flatMap((b) => (b.gaps ?? []).map((g) => `${label(b)}: ${g}`));
  const parts = blocks.flatMap((b) => (b.section ?? []).map((s) => `${label(b)}: ${s}`));
  if (gaps.length) out.push(`gaps in the book (by image): ${gaps.join(" · ")}`);
  if (parts.length) out.push(`parts of the book (by image): ${parts.join(" · ")}`);
  return { lines: out, more, gaps: blocks.flatMap((b) => b.gaps ?? []), shown };
}

/** One reading's head: what it asked and what it found. */
function readingHead(r: Reading, blocks: Block[]): string[] {
  const nums = (res: Finding["result"]) => blocks.filter((b) => b.result === res && b.num !== undefined).map((b) => b.num!);
  const books = [...new Set(blocks.map((b) => b.recordset).filter(Boolean))].join(" ");
  const nothing = blocks.filter((b) => b.result === "nothing").length;
  return [
    `${r.stem} · ${r.reports.length} report(s)${books ? ` · ${books}` : ""} · images ${runs(blocks.map((b) => b.num ?? 0))} · found ${nums("found").length ? runs(nums("found")) : "none"}${nums("unclear").length ? ` · unclear ${runs(nums("unclear"))}` : ""} · nothing ${nothing}`,
    r.question ? `question: ${truncate(r.question, 300)}` : undefined,
    r.context ? `context: ${truncate(r.context, 300)}` : undefined,
  ].filter((l): l is string => Boolean(l));
}

/** Earlier readings and searches by readers of these images — for a word before they are read again. */
export function earlierReadings(tree: Tree, images: Media[]): { readings: { stem: string; question?: string | undefined; images: number[] }[]; searches: { id: string; question: string; pages: string; result: string }[] } {
  const ids = new Set(images.map((m) => m.id));
  const keys = new Set(images.filter((m) => m.recordset && m.image !== undefined).map((m) => `${m.recordset}:${m.image}`));
  const readings = loadReadings(tree)
    .map((r) => ({ stem: r.stem, question: r.question, images: [...new Set(r.blocks.filter((b) => (b.media && ids.has(b.media)) || keys.has(`${b.recordset}:${b.num}`)).map((b) => b.num ?? 0))] }))
    .filter((r) => r.images.length);
  const searches = tree
    .list<Search>("search")
    .filter((s) => s.by === "reader" && s.scope.pages)
    .filter((s) => {
      const ranges = parseRanges(s.scope.pages!);
      return ranges && images.some((m) => m.recordset && s.recordsets.includes(m.recordset) && within(m.image, ranges));
    })
    .map((s) => ({ id: s.id, question: s.question, pages: s.scope.pages!, result: s.result }));
  return { readings, searches };
}

/** Of these images, those an earlier reader reported unclear (strom read gives them to the next reader sharper). */
export function unclearBefore(tree: Tree, images: Media[]): Set<string> {
  const byKey = new Map(images.filter((m) => m.recordset && m.image !== undefined).map((m) => [`${m.recordset}:${m.image}`, m.id]));
  const ids = new Set(images.map((m) => m.id));
  const out = new Set<string>();
  for (const r of loadReadings(tree))
    for (const b of r.blocks) {
      if (b.result !== "unclear") continue;
      const id = b.media && ids.has(b.media) ? b.media : byKey.get(`${b.recordset}:${b.num}`);
      if (id) out.add(id);
    }
  return out;
}

/** The lines strom read says before it sends readers to images read before (a different question is fine). */
export function earlierLines(e: ReturnType<typeof earlierReadings>): string[] {
  return [
    ...e.readings.slice(0, 3).map((r) => `already read: images ${runs(r.images)} on ${r.stem.slice(0, 10)}${r.question ? ` ("${truncate(r.question, 60)}")` : ""} — see it: strom readings ${r.stem}`),
    ...(e.readings.length > 3 ? [`  … and ${e.readings.length - 3} more: strom readings --list`] : []),
    ...e.searches.slice(0, 3).map((s) => `already recorded: ${s.id} [${s.result}] "${truncate(s.question, 60)}" pages ${s.pages} by reader`),
    ...(e.readings.length || e.searches.length ? ["(reading them again is right for another question or a blind check — not for the same one)"] : []),
  ];
}

register({
  path: ["readings"],
  summary: "What earlier readers reported (strom read), compact: finds, unclear entries, what was illegible, gaps in the book",
  group: "sources",
  tree: true,
  description:
    "The readers' reports in notes/readings, without reading them whole: each found and unclear block, from the\n" +
    "blocks with nothing found only what the reader could not read (a possible match is often there), the gaps in\n" +
    "the page numbering and the parts of the book they saw. One image's block word for word: --image N.\n" +
    "Default: the newest reading; with --images, --image or --match all of them. Nothing is written.",
  args: [{ name: "which", description: "a record set (B…), or a reading: its report's name or the start of it (a day)" }],
  options: [
    { name: "images", type: "string", value: "<from-to>", description: "only these image numbers, e.g. 40-69 or 5-113,130-228" },
    { name: "image", type: "string", value: "<n>", description: "that image's whole block, word for word" },
    { name: "match", type: "string", multiple: true, value: "<words>", description: "only blocks that mention it — any spelling of accents (repeatable: variants)" },
    { name: "list", type: "boolean", description: "the readings there are, one line each" },
  ],
  examples: ["strom readings", "strom readings B0001 --images 40-69 --match Novák --match Nowak", "strom readings B0001 --image 57", "strom readings --list"],
  run(ctx, { args, opts }) {
    const tree = ctx.tree();
    let all = loadReadings(tree);
    if (all.length === 0) return { text: "no readings yet (strom read writes them into notes/readings)", data: { readings: [] } };
    const which = args[0]?.trim();
    let book: string | undefined;
    if (which && /^[Bb]\d+$/.test(which)) book = requireRecord<RecordSet>(tree, which, "recordset").id;
    else if (which) {
      const name = path.basename(which).replace(/\.md$/i, "");
      const report = all.find((r) => r.reports.includes(name));
      if (report) all = [{ ...report, reports: [name], blocks: report.blocks.filter((b) => b.report === name) }];
      else {
        all = all.filter((r) => r.stem === name || r.stem.startsWith(name));
        if (all.length === 0) throw new UsageError(`no reading "${which}"`, { hint: "strom readings --list" });
      }
    }
    const ranges = typeof opts.images === "string" ? parseRanges(opts.images) : undefined;
    if (typeof opts.images === "string" && !ranges) throw new UsageError(`invalid --images "${opts.images}"`, { hint: "e.g. 40-69 or 5-113,130-228" });
    const image = opts.image === undefined ? undefined : Number(opts.image);
    if (image !== undefined && !(Number.isInteger(image) && image >= 0)) throw new UsageError(`invalid --image "${String(opts.image)}"`, { hint: "an image number, e.g. 57" });
    const match = (Array.isArray(opts.match) ? opts.match : typeof opts.match === "string" ? [opts.match] : []).map(String).filter((m) => m.trim());
    const pick = (r: Reading) => r.blocks.filter((b) => (!book || b.recordset === book) && (!ranges || within(b.num, ranges)) && (image === undefined || b.num === image));
    const readings = all.map((r) => ({ r, blocks: pick(r) })).filter((x) => x.blocks.length);
    // nothing asked: the newest reading only
    const shown = which || ranges || image !== undefined || match.length || opts.list ? readings : readings.slice(0, 1);
    if (shown.length === 0) return { text: `no reader reported ${image !== undefined ? `image ${image}` : "these images"}${book ? ` of ${book}` : ""} · strom readings --list`, data: { readings: [] } };

    if (opts.list) {
      const text = lines(...shown.flatMap(({ r, blocks }) => readingHead(r, blocks)[0]!.concat(r.question ? ` · "${truncate(r.question, 60)}"` : "")));
      return { text, data: { readings: shown.map(({ r, blocks }) => ({ stem: r.stem, question: r.question, reports: r.reports, images: blocks.map((b) => b.num) })) } };
    }
    if (image !== undefined) {
      const text = lines(...shown.flatMap(({ r, blocks }) => blocks.flatMap((b) => [`${b.report}${b.recordset ? ` · ${b.recordset}` : ""}${r.question ? ` · question: ${truncate(r.question, 120)}` : ""}`, `## ${b.text}`, ""])));
      return { text: text.trimEnd(), data: { blocks: shown.flatMap(({ r, blocks }) => blocks.map((b) => ({ reading: r.stem, report: b.report, recordset: b.recordset, image: b.num, media: b.media, result: b.result, text: `## ${b.text}` }))) } };
    }
    const parts: string[] = [];
    const data = shown.map(({ r, blocks }) => {
      const s = summary(blocks, { match, question: r.question });
      parts.push(...readingHead(r, blocks), ...(s.lines.length ? s.lines : [match.length ? "  (no block mentions it)" : "  (no finds, nothing illegible reported)"]), "");
      const block = ({ block: b, said }: Shown) => ({ image: b.num, media: b.media, report: b.report, result: b.result, pages: b.pages, ...(said ? { said } : { entries: b.entries, certainty: b.certainty, illegible: b.illegible }) });
      return {
        stem: r.stem,
        question: r.question,
        context: r.context,
        reports: r.reports,
        images: blocks.map((b) => b.num),
        found: s.shown.filter((x) => x.block.result === "found").map(block),
        unclear: s.shown.filter((x) => x.block.result === "unclear").map(block),
        nothing: s.shown.filter((x) => x.block.result === "nothing").map(block),
        gaps: blocks.flatMap((b) => (b.gaps ?? []).map((text) => ({ image: b.num, text }))),
        sections: blocks.flatMap((b) => (b.section ?? []).map((text) => ({ image: b.num, text }))),
      };
    });
    const at = book ?? (which ? shellArg(which) : shown[0]!.blocks[0]?.recordset ?? shellArg(shown[0]!.r.stem));
    parts.push(`one image's whole block: strom readings ${at} --image <n>`);
    return { text: lines(...parts), data: { readings: data } };
  },
});
