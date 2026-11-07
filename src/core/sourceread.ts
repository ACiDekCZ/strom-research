// A source read again from its original (spec 059 P3, the app's ZADANI_VYZKUM_cteni-modely.md point 6): what the
// research has of the record itself on this computer — the excerpts of its images (each clip with the margin an excerpt
// keeps), its images whole where nobody cut the entry out, else the scan the person gave — read by readers who are
// never shown its transcript. The new reading is kept beside the source as one more reading of it (Source.readings);
// nothing of the source changes: where it differs from the transcript a task holds the two against each other, and
// the user's confirmation of the transcript (spec 022) stays as it was.

import fs from "node:fs";
import path from "node:path";
import type { Input, Media, Source, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { inputPath } from "./media.ts";
import { clipMark, INPUT_MARK, withMargin } from "./excerpt.ts";
import { alive, DOC_PAGES, FINAL_STATES, listReadings, loadState, wordHunks, words, type ReadResult, type Region, type SourceRead } from "./document.ts";
import { create, update } from "./records.ts";
import { phrase } from "./phrases.ts";

/** The origin of the task a reading again that differs from a source's transcript makes. */
export const SOURCE_READ_ORIGIN = "read:source";

/** The kinds of files a reader reads a page from (a photo, a scan, a PDF). */
const PAGE_EXT = /\.(jpe?g|png|hei[cf]|pdf)$/iu;

/** A page of a source's original: its record (an image M…, an input I…), its file here, and the part of it read. */
export interface OriginalPage {
  id: string;
  file: string;
  name: string;
  sha?: string;
  region?: Region;
}

/** Why a source cannot be read again here: none such, no transcript to hold a reading against, no original here. */
export type NotAgain = "none" | "notext" | "noscan";

/** Whether a source is one a reading again is of: a record of the research with a transcript (no family tree, no memory). */
function sourceOk(s: Source | undefined): s is Source {
  return !!s && s.type === "source" && !s.retracted && !s.mergedInto && s.kind !== "family-tree" && s.kind !== "family-memory";
}

/**
 * The pages of a source's original on this computer (`clip`: one excerpt alone, by its mark): its clips on their
 * images (with an excerpt's margin, the clips of an image that meet as one view: joinedClips), else its images whole, else the scan the person gave — at most a reading's pages.
 * None here (an image not on this computer, a clip it has not): an empty list.
 */
export function originalPages(tree: Tree, shared: string | undefined, s: Source, clip?: string): OriginalPage[] {
  const out: OriginalPage[] = [];
  const media = (id: string, region?: Region) => {
    const m = shared ? tree.get<Media>(id) : undefined;
    if (!m || m.type !== "media" || m.retracted || !shared) return;
    const file = path.join(shared, m.file);
    if (!PAGE_EXT.test(file) || !fs.existsSync(file)) return;
    out.push({ id: m.id, file, name: m.id, ...(m.sha ? { sha: m.sha } : {}), ...(region ? { region } : {}) });
  };
  const input = () => {
    const i = s.input ? tree.get<Input>(s.input) : undefined;
    const file = i ? inputPath(tree, i) : undefined;
    if (!i || !file || !PAGE_EXT.test(file) || !fs.existsSync(file)) return;
    out.push({ id: i.id, file, name: i.name, ...(i.sha ? { sha: i.sha } : {}) });
  };
  if (clip === INPUT_MARK) input();
  else if (clip) {
    const c = s.clips?.find((x) => clipMark(x) === clip);
    if (c) media(c.media, margined(c.region));
  } else if (s.clips?.length) for (const c of joinedClips(s.clips)) media(c.media, c.region); else if (s.media?.length) for (const m of s.media) media(m);
  else input();
  return out.slice(0, DOC_PAGES);
}

/** A region with an excerpt's margin, its fractions to three places. */
function margined(r: { x: number; y: number; w: number; h: number }): Region {
  const m = withMargin(r);
  return [m.x, m.y, m.w, m.h].map((n) => Math.round(n * 1000) / 1000) as Region;
}

/**
 * The views of a source's excerpts for its readers: the excerpts of one image that overlap or touch (each with its
 * margin) one view of all of them — one entry cut in parts is read as one, never as pages of its own; excerpts apart
 * and other images each a view of its own, in the order of the excerpts.
 */
export function joinedClips(clips: { media: string; region: { x: number; y: number; w: number; h: number } }[]): { media: string; region: Region }[] {
  const views: { media: string; box: Region }[] = [];
  const meet = (a: Region, b: Region) => a[0] <= b[0] + b[2] && b[0] <= a[0] + a[2] && a[1] <= b[1] + b[3] && b[1] <= a[1] + a[3];
  const join = (a: Region, b: Region): Region => {
    const x = Math.min(a[0], b[0]);
    const y = Math.min(a[1], b[1]);
    return [x, y, Math.max(a[0] + a[2], b[0] + b[2]) - x, Math.max(a[1] + a[3], b[1] + b[3]) - y];
  };
  for (const c of clips) {
    let box = margined(c.region);
    // a view this one meets takes it in — and any other view of the image the larger one meets then
    let at = views.findIndex((v) => v.media === c.media && meet(v.box, box));
    if (at < 0) {
      views.push({ media: c.media, box });
      continue;
    }
    for (;;) {
      box = join(views[at]!.box, box);
      views[at]!.box = box;
      const other = views.findIndex((v, k) => k !== at && v.media === c.media && meet(v.box, box));
      if (other < 0) break;
      box = join(views[other]!.box, box);
      views.splice(other, 1);
      if (other < at) at--;
    }
  }
  return views.map((v) => ({ media: v.media, region: v.box.map((n) => Math.round(n * 1000) / 1000) as Region }));
}

/** Why a source (one excerpt of it) cannot be read again here, or none: it can. */
export function notAgain(tree: Tree, shared: string | undefined, id: string, clip?: string): NotAgain | undefined {
  const s = tree.get<Source>(id);
  if (!sourceOk(s)) return "none";
  if (!s.transcript?.trim()) return "notext";
  return originalPages(tree, shared, s, clip).length ? undefined : "noscan";
}

/** The reading of a source again not ended yet (queued, being read), if one is: one at a time. */
export function readingOfSource(root: string, id: string): string | undefined {
  for (const r of listReadings(root)) {
    if (FINAL_STATES.includes(r.state)) continue;
    const s = loadState(root, r.id);
    if (s?.source?.id === id && !FINAL_STATES.includes(s.state) && (s.state === "queued" || alive(s.pid))) return s.id;
  }
  return undefined;
}

/** Whether a source can be read again from its original here (1 _STROM_ORIG Y for an app that offers it). */
export function readsAgain(tree: Tree, shared: string | undefined, s: Source): boolean {
  return sourceOk(s) && !!s.transcript?.trim() && originalPages(tree, shared, s).length > 0;
}

/** A label at the start of a line (a column's heading of a register: "Dies:", "Vater:", "Hat getauft:"), its line's start before it. */
const LABEL = /(^|[\n|/])([ \t]*)([\p{L}\p{M}][\p{L}\p{M}.]*(?:[ \t]+[\p{L}\p{M}][\p{L}\p{M}.]*)?):(?=\s|$)/gu;

/**
 * A note of the research's own in a transcript: a group in brackets standing alone ("[Copulati]", "[page torn]") or
 * in parentheses — never the marks [?] and [...], never letters added within a word ("Lhotá[ka]").
 */
const EDITORIAL = /(?<![\p{L}\p{M}\p{N}])(?:\[(?!\s*(?:\?|\.{2,}|…)\s*\])[^\[\]\n]*\]|\([^()\n]*\))(?![\p{L}\p{M}\p{N}])/gu;

const keysOf = (t: string) => words(t).map((w) => w.key);

/** The keys of a text, each alone and two or three in a row as one word ("In præsent": "inpraesent" too). */
function keysJoined(t: string): Set<string> {
  const keys = keysOf(t);
  const out = new Set(keys);
  for (let i = 0; i < keys.length; i++) for (let n = 2; n <= 3 && i + n <= keys.length; n++) out.add(keys.slice(i, i + n).join(""));
  return out;
}

/**
 * A text without its labels whose words the other text has none of (a column's heading the other did not write) — a
 * label the other has with its words written apart or together ("Inpraesent:" for "In præsent") is no such label.
 */
function withoutLabels(t: string, other: string, lines: RegExp = LABEL): string {
  const there = keysJoined(other);
  return t.replace(lines, (all, at: string, space: string, label: string) => {
    const keys = keysOf(label);
    return keys.some((k) => there.has(k)) || there.has(keys.join("")) ? all : `${at}${space}`;
  });
}

/** Two texts of the same letters, their words written apart in one and together in the other ("In præsent" × "Inpraesent"). */
const joinedAlike = (a: string, b: string) => keysOf(a).join("") === keysOf(b).join("");

/** A text without its notes in brackets the other has not the words of (the research's own, a reader's: "[col. 2:]"). */
function withoutNotes(t: string, other: string): string {
  const there = ` ${keysOf(other).join(" ")} `;
  return t.replace(EDITORIAL, (all) => {
    const k = keysOf(all).join(" ");
    return k && there.includes(` ${k} `) ? all : " ";
  });
}

/**
 * A transcript without the words of its heading the new reading has not: its first line where it is the research's
 * own heading of the record (at least five words, two thirds of them in the source's locator: "Book 12, fol. 60, 1st
 * entry of November") — never a line of the record itself.
 */
function withoutHeading(t: string, other: string, locator: string | undefined): string {
  if (!locator) return t;
  const lines = t.split("\n");
  const at = lines.findIndex((l) => l.trim());
  if (at < 0) return t;
  const keys = keysOf(lines[at]!);
  const loc = new Set(keysOf(locator));
  if (keys.length < 5 || keys.filter((k) => loc.has(k)).length * 3 < keys.length * 2) return t;
  const there = new Set(keysOf(other));
  lines[at] = lines[at]!.split(/(\s+)/u).map((w) => (/^\s+$/u.test(w) || keysOf(w).every((k) => there.has(k)) ? w : "")).join("");
  return lines.join("\n");
}

/** Words that are nothing read: a mark that the place cannot be read, or none. */
const nothingRead = (t: string) => words(t).every((w) => w.illegible || !w.key);

/** One word as another, written shorter: "Mens." for "Mense". */
function shortFor(a: string, b: string): boolean {
  const [x, y] = [keysOf(a).join(""), keysOf(b).join("")];
  if (x === y) return true;
  const [short, long, text] = x.length < y.length ? [x, y, a] : [y, x, b];
  return short.length >= 2 && text.trimEnd().endsWith(".") && long.startsWith(short);
}

/**
 * The new reading against the source's transcript (at: the transcript, other: the new reading): its words alike, or
 * where they differ. Only the entries of the reading that are the source's record (r.source.entries; a reading that
 * did not tell them apart: all of them). No place that differs: a column's label one wrote and the other not, words
 * written apart in one and together in the other, a note of
 * the research's own in the transcript (its heading of the record too), nothing against a mark that it cannot be read; and read from its excerpts, the
 * words at the very start or end of both that only one has, or more of than the other (a heading of the page above
 * the excerpt, a word of the next entry in its margin) — outside what both read.
 */
export function compareWithSource(s: Pick<Source, "transcript" | "clips"> & Partial<Pick<Source, "locator">>, r: Pick<ReadResult, "entries"> & { source?: Pick<SourceRead, "entries"> }): { agree: "same" | "differ"; variants: { at: string; other: string }[] } {
  const ids = r.source?.entries;
  const read = (ids ? r.entries.filter((e) => ids.includes(e.id)) : r.entries).map((e) => e.transcript).join("\n").normalize("NFC");
  const was = (s.transcript ?? "").normalize("NFC");
  const clipped = !!s.clips?.length;
  const at = withoutNotes(withoutHeading(withoutLabels(was, read), read, s.locator), read);
  const other = withoutNotes(withoutLabels(read, at), at);
  const variants: { at: string; other: string }[] = [];
  for (const v of wordHunks(at, other)) {
    if (!v.at && !v.other) continue;
    if ((!v.at && nothingRead(v.other)) || (!v.other && nothingRead(v.at))) continue;
    if (v.at && v.other && joinedAlike(v.at, v.other)) continue;
    if (clipped && v.edge) {
      if (!v.at || !v.other) continue;
      // both at an edge: as many words of each as the other has, those nearest what both read
      if (v.start !== v.end) {
        const a = v.at.split(/\s+/u);
        const b = v.other.split(/\s+/u);
        const n = Math.min(a.length, b.length);
        const cut = (x: string[]) => (v.start ? x.slice(x.length - n) : x.slice(0, n));
        const [x, y] = [cut(a), cut(b)];
        if (x.every((w, i) => shortFor(w, y[i]!))) continue;
        variants.push({ at: x.join(" "), other: y.join(" ") });
        continue;
      }
    }
    variants.push({ at: v.at, other: v.other });
  }
  return { agree: variants.length ? "differ" : "same", variants };
}

/**
 * A reading of a source again held against its transcript, nothing written: the entries that are the source's, how
 * they compare — or why they cannot be (the source gone, no entry of it read).
 */
export function heldAgainst(tree: Tree, at: SourceRead, r: ReadResult): SourceRead {
  const { agree: _a, variants: _v, failed: _f, entries: _e, ...base } = at;
  const s = tree.get<Source>(at.id);
  if (!sourceOk(s)) return { ...base, failed: { code: "no-source", why: `${at.id} is no source of the research any more (gone, retracted or merged)` } };
  const ids = r.source?.entries ?? at.entries;
  const mine = ids ? r.entries.filter((e) => ids.includes(e.id)) : r.entries;
  if (!mine.length) return { ...base, failed: { code: "no-entry", why: "no entry of the reading is the source's record: nothing read, or only entries beside it" } };
  const c = compareWithSource(s, { entries: mine });
  return { ...base, ...(ids ? { entries: mine.map((e) => e.id) } : {}), agree: c.agree, variants: c.variants };
}

/**
 * A reading of a source again that ended with a result: kept beside the source as one more reading of it (nothing of
 * the source changes — its transcript, who read it, the user's confirmation), compared with its transcript; where they
 * differ, a task to hold the two against each other. What it came to, for the reading's state.
 */
export function keepSourceReading(tree: Tree, at: SourceRead, r: ReadResult): SourceRead {
  const c = heldAgainst(tree, at, r);
  if (c.failed) return c;
  const s = tree.get<Source>(at.id)!;
  // (a source.reading, never a source.edit: the history's edits of a source say who read it — this one changes none)
  update<Source>(tree, s.id, "source", (x) => ({ ...x, readings: [...new Set([...(x.readings ?? []), r.id])] }), { op: "source.reading", summary: `${s.id} read again from its original: ${r.id} (${c.agree === "same" ? "alike its transcript" : "differs from its transcript"})` });
  if (c.agree === "same") return { ...c, variants: [] };
  // read again (strom document again) while its task is still open: that task holds this reading too
  const open = at.task ? tree.get<Task>(at.task) : undefined;
  if (open && open.type === "task" && open.state === "open") return c;
  const lang = tree.lang;
  const where = [...new Set([...(s.clips ?? []).map((x) => x.media), ...(s.media ?? []), ...(s.input ? [s.input] : [])])];
  const list = (ws: string[]) => ws.slice(0, 6).join(" · ") + (ws.length > 6 ? " · …" : "");
  const task = create<Task>(
    tree,
    "task",
    {
      level: "verify",
      priority: 2,
      what: phrase(lang, "read.source.what", { source: s.id, now: r.id }),
      where: [s.id, ...where],
      why: phrase(lang, "read.source.why", { source: s.id, now: r.id, before: list(c.variants!.map((v) => v.at || "—")), after: list(c.variants!.map((v) => v.other || "—")) }),
      doneWhen: phrase(lang, "read.source.done", { source: s.id, now: r.id }),
      subject: [s.id],
      state: "open",
      origin: SOURCE_READ_ORIGIN,
    } as never,
    (id) => `+${id} task "hold the reading ${r.id} against the transcript of ${s.id}"`,
  );
  return { ...c, task: task.id };
}
