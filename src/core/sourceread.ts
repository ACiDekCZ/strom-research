// A source read again from its original (spec 059 P3, the app's ZADANI_VYZKUM_cteni-modely.md point 6): what the
// research has of the record itself on this computer — the excerpts of its images (each clip with the margin an excerpt
// keeps), its images whole where nobody cut the entry out, else the scan the person gave — read by readers who are
// never shown its transcript. The new reading is kept beside the source as one more reading of it (Source.readings);
// nothing of the source changes: where it differs from the transcript in a matter of fact (not trifles alone) a task holds the two against each other, and
// the user's confirmation of the transcript (spec 022) stays as it was.

import fs from "node:fs";
import path from "node:path";
import type { Input, Media, Source, Task } from "./model.ts";
import type { Tree } from "./tree.ts";
import { inputPath } from "./media.ts";
import { clipMark, INPUT_MARK, withMargin } from "./excerpt.ts";
import { alive, DOC_PAGES, FINAL_STATES, listReadings, loadState, resultPath, wordHunks, words, type ReadResult, type Region, type SourceRead } from "./document.ts";
import { create, update } from "./records.ts";
import { phrase } from "./phrases.ts";
import { TRIFLES, variantKind } from "./variantkind.ts";
import { userReading } from "./readers.ts";
import { readingWords } from "./transcriptguard.ts";
import { openProposal, PROPOSAL_ORIGIN, proposeTranscript, rejectedProposal } from "./proposal.ts";

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
  return { ...base, ...(ids ? { entries: mine.map((e) => e.id) } : {}), agree: c.agree, variants: surely(s, r, mine.map((e) => e.id), c.variants) };
}

const keysIn = (t: string) => words(t).filter((w) => !w.illegible).map((w) => w.key).filter(Boolean);
/** Whether keys b stand within keys a, in a row. */
function within(a: string[], b: string[]): boolean {
  if (!b.length) return !a.length;
  for (let i = 0; i + b.length <= a.length; i++) if (b.every((k, j) => a[i + j] === k)) return true;
  return false;
}

/**
 * Each place the new reading differs from the transcript, said not sure (sure: false) where it is no evidence of a
 * matter of fact: the new reading there a mark that it cannot be read or is not sure ([...], [?]) — a word of the
 * transcript the reader could not read is never another word; and, two readers, where the blind one did not read the
 * same against the transcript (the readers disagree: uncertainty, nothing more). A word where the transcript has
 * [...] is a place like any other.
 */
function surely(s: Source, r: ReadResult, ids: string[], variants: { at: string; other: string }[]): SourceRead["variants"] {
  const two = (r.readers?.ran ?? 1) >= 2 || !!r.blind;
  const blind = two ? (r.blind?.entries ?? []).filter((b) => b.of && ids.includes(b.of)) : [];
  const theirs = two && blind.length ? compareWithSource(s, { entries: blind.map((b) => ({ ...b, persons: [], events: [], relations: [] })) as never }).variants : [];
  return variants.map((v) => {
    const unread = !!v.other && (nothingRead(v.other) || UNSURE.test(v.other));
    const agreed = !two || theirs.some((b) => within(keysIn(b.at), keysIn(v.at)) && within(keysIn(b.other), keysIn(v.other)) && (!!b.other === !!v.other) && (!!b.at === !!v.at));
    return unread || !agreed ? { ...v, sure: false as const } : v;
  });
}

/** A mark that a place cannot be read or is not sure: [...], […], [?]. */
const UNSURE = /\[\s*(?:\.{2,}|…|\?)\s*\]/u;

/** What becomes of a reading again that differs in a matter of fact (read.sourceTask): asked of the person, a task, or kept. */
export type SourceTaskWith = "ask" | "always" | "never";

/** The person's word on a reading again that differs (decideReading). */
export type ReadingTake = "now" | "queue" | "keep" | "review";

/**
 * A reading of a source again that ended with a result: kept beside the source as one more reading of it (nothing of
 * the source changes — its transcript, who read it, the user's confirmation), compared with its transcript. Where they
 * differ in a matter of fact both readers are sure of and no task judged yet: with always (read.sourceTask always, an
 * app that cannot ask) a task to hold the two against each other — said in the source's task not ended where there is
 * one (appended) — or, the transcript the person's own reading (they confirmed it), a wording of it with the new
 * reading's places proposed to them for review (their task, never an agent's: core/proposal.ts); with ask or never the
 * places offered to the person (offer: how many — the source not verified until they decide, decideReading), a task
 * not ended of the source taking nothing until they say so. What it came to, for the reading's state.
 */
export function keepSourceReading(tree: Tree, at: SourceRead, r: ReadResult, with_: SourceTaskWith = at.taskWith ?? "always"): SourceRead {
  const c = heldAgainst(tree, at, r);
  if (c.failed) return c;
  const s = tree.get<Source>(at.id)!;
  // (a source.reading, never a source.edit: the history's edits of a source say who read it — this one changes none)
  update<Source>(tree, s.id, "source", (x) => ({ ...x, readings: [...new Set([...(x.readings ?? []), r.id])] }), { op: "source.reading", summary: `${s.id} read again from its original: ${r.id} (${c.agree === "same" ? "alike its transcript" : "differs from its transcript"})` });
  const { taskWith: _w, offer: _o, taskFor: _f, appended: _a, ...base } = c;
  if (c.agree === "same") return { ...base, variants: [] };
  const p = placesOf(tree, s, r.id, c.variants!);
  const held: SourceRead = { ...base, variants: p.variants, taskWith: with_ };
  // read again while a task of the source is not ended, nothing new in it: that task holds this reading too
  const open = openTaskOf(tree, s.id, at.task);
  if (!p.fresh.length) return open && p.matters.length ? { ...held, task: open.id } : held;
  if (with_ !== "always") return { ...held, offer: p.fresh.length };
  if (userReading(s)) {
    // the person's own transcript: never a task of the agent's to change it — a wording for their review
    const made = review(tree, s, r, p.fresh);
    return "refused" in made ? { ...held, offer: p.fresh.length } : { ...held, task: made.task, taskFor: "person", ...(made.appended ? { appended: true as const } : {}) };
  }
  return { ...held, task: handOver(tree, s, r, p.ordered, 2, open).id, ...(open ? { appended: true as const } : {}) };
}

/**
 * A wording for the person's review of a transcript they read or confirmed: the transcript — or the wording proposed to
 * them that waits already — with each place of a matter of fact replaced by the new reading's (found in it whatever its
 * spacing), proposed to them (core/proposal.ts: a note on the source, their task, never an agent's). A place with
 * nothing of the transcript, or not found in it: left out of the wording, said in its why with the others.
 */
function review(tree: Tree, s: Source, r: ReadResult, fresh: { at: string; other: string }[], unsure = false): { task: string; appended: boolean } | { refused: "noproposal" | "declined" | "same"; why: string; task?: string } {
  const wording = wordingOf(tree, s, fresh, unsure);
  if (wording === undefined) return { refused: "noproposal", why: `no place the reading of ${s.id} differs in could be put into a wording of its transcript (none of its words found there${unsure ? ", or the new reading could not read it either" : ""}) — nothing proposed; keep it` };
  const lang = tree.lang;
  const list = (ws: string[]) => ws.slice(0, 6).join(" · ") + (ws.length > 6 ? " · …" : "");
  const why = phrase(lang, unsure ? "read.source.unsure.review" : "read.source.why", { source: s.id, now: r.id, who: whoRead(lang, r), same: sameModel(lang, r), before: list(fresh.map((v) => v.at || "—")), after: list(fresh.map((v) => v.other || "—")) });
  const out = proposeTranscript(tree, s.id, wording, { by: whoRead(lang, r), why, reading: r.id, ...(unsure ? { unsure: true } : {}) });
  if (out.outcome === "proposed" || out.outcome === "appended") return { task: out.task!, appended: out.outcome === "appended" };
  if (out.outcome === "declined") return { refused: "declined", why: `the person declined this wording of the transcript of ${s.id} before and kept theirs — not proposed again` };
  if (out.outcome === "same") return { refused: "same", why: `this wording of the transcript of ${s.id} waits for the person's decision already (${out.task})`, ...(out.task ? { task: out.task } : {}) };
  return { refused: "noproposal", why: `the wording of ${s.id} with the reading's places is its transcript's own — nothing to propose` };
}

/**
 * The wording review would propose of a transcript the person read or confirmed: the transcript — or the wording
 * proposed to them that waits already — with the places put in; places not sure only those the new reading read
 * without a mark ([...], [?] never do). No place found in it: undefined.
 */
function wordingOf(tree: Tree, s: Source, places: { at: string; other: string }[], unsure: boolean): string | undefined {
  const waiting = openProposal(tree, s.id)?.proposal?.text;
  const into = unsure ? places.filter((v) => !v.other || (!nothingRead(v.other) && !UNSURE.test(v.other))) : places;
  return into.length ? replacePlaces((waiting ?? s.transcript ?? "").normalize("NFC"), into) : undefined;
}

/**
 * A text with each place's words (at) replaced by the other reading's (other): found tolerant of whitespace (its words
 * joined by any spacing), a word never within a longer one, places never overlapping; none found: undefined.
 */
export function replacePlaces(text: string, places: { at: string; other: string }[]): string | undefined {
  const spans: { from: number; to: number; with: string }[] = [];
  for (const v of places) {
    const ws = v.at.normalize("NFC").trim().split(/\s+/u).filter(Boolean);
    if (!ws.length) continue;
    const words = ws.map((w) => w.replace(/[.*+?^${}()|[\]\\/]/gu, "\\$&")).join("\\s+");
    const pre = /^[\p{L}\p{M}\p{N}]/u.test(ws[0]!) ? "(?<![\\p{L}\\p{M}\\p{N}])" : "";
    const post = /[\p{L}\p{M}\p{N}]$/u.test(ws.at(-1)!) ? "(?![\\p{L}\\p{M}\\p{N}])" : "";
    for (const m of text.matchAll(new RegExp(pre + words + post, "gu"))) {
      const from = m.index;
      const to = from + m[0].length;
      if (spans.some((x) => from < x.to && x.from < to)) continue;
      spans.push({ from, to, with: v.other.normalize("NFC").trim() });
      break;
    }
  }
  if (!spans.length) return undefined;
  let out = text;
  for (const x of spans.sort((a, b) => b.from - a.from)) {
    const left = out.slice(0, x.from);
    let right = out.slice(x.to);
    // words left out by the new reading: no gap of two spaces where they stood
    if (!x.with && /[ \t]$/u.test(left) && /^[ \t]/u.test(right)) right = right.replace(/^[ \t]+/u, "");
    out = left + x.with + right;
  }
  return out;
}

/**
 * The places a reading again differs from the transcript in, as a task would hold them. Only a matter of fact (a
 * name, number, date, person, a side not read, anything not surely a trifle) both readers are sure of is worth a task:
 * differing in trifles alone (spelling, an abbreviation, punctuation, a label, letter case) the reading is kept beside
 * the source as any other, said to differ, and nothing is asked of anyone. A place an earlier reading of the source put
 * in a task already is judged (variants[].judged) and asked again in none. The matters of fact come first.
 */
function placesOf(tree: Tree, s: Source, now: string, vs: NonNullable<SourceRead["variants"]>) {
  const before = judgedPlaces(tree, s, now);
  const variants: NonNullable<SourceRead["variants"]> = vs.map(({ judged: _j, kind: _k, ...v }) => (before.get(placeKey(v)) ? { ...v, judged: before.get(placeKey(v))! } : v));
  const matters = variants.filter((v) => v.sure !== false && !TRIFLES.includes(variantKind(v.at, v.other)));
  const fresh = matters.filter((v) => !v.judged);
  const ordered = [...fresh, ...variants.filter((v) => !fresh.includes(v) && !v.judged)];
  // places its readers are not sure of (no trifles), judged in no task: a task of them only on the person's word
  const unsure = variants.filter((v) => v.sure === false && !v.judged && !TRIFLES.includes(variantKind(v.at, v.other)));
  return { variants, matters, fresh, ordered, unsure };
}

/** The task a reading's places are held in: said in the source's open one, else a new one (priority as asked). */
function handOver(tree: Tree, s: Source, r: ReadResult, ordered: { at: string; other: string }[], priority: number, open = openTaskOf(tree, s.id), unsure = false): Task {
  const lang = tree.lang;
  // the places not sure: a task asked by the person — each looked at on the scan, corrected where sure, else a note
  const k = unsure ? "read.source.unsure" : "read.source";
  const list = (ws: string[]) => ws.slice(0, 6).join(" · ") + (ws.length > 6 ? " · …" : "");
  const said = { now: r.id, who: whoRead(lang, r), same: sameModel(lang, r), before: list(ordered.map((v) => v.at || "—")), after: list(ordered.map((v) => v.other || "—")) };
  if (open) {
    // one task of a source at a time: the new places said in it, beside the ones it holds
    update<Task>(tree, open.id, "task", (x) => ({ ...x, why: `${x.why} ${phrase(lang, `${k}.again`, { source: s.id, ...said })}` }), { op: "task.edit", summary: `${open.id} holds the reading ${r.id} of ${s.id} too${unsure ? " (its places not sure)" : ""}` });
    return tree.get<Task>(open.id)!;
  }
  const where = [...new Set([...(s.clips ?? []).map((x) => x.media), ...(s.media ?? []), ...(s.input ? [s.input] : [])])];
  return create<Task>(
    tree,
    "task",
    {
      level: "verify",
      priority,
      what: phrase(lang, `${k}.what`, { source: s.id, now: r.id }),
      where: [s.id, ...where],
      why: phrase(lang, `${k}.why`, { source: s.id, ...said }),
      doneWhen: phrase(lang, `${k}.done`, { source: s.id, now: r.id }),
      subject: [s.id],
      state: "open",
      origin: SOURCE_READ_ORIGIN,
    } as never,
    (id) => `+${id} task "${unsure ? `look at the places not sure of the reading ${r.id} of ${s.id} on its scan` : `hold the reading ${r.id} against the transcript of ${s.id}`}"`,
  );
}

/** A reading's result as finish kept it (notes/readings/<id>.json), if there is one. */
function resultOf(tree: Tree, id: string): ReadResult | undefined {
  try {
    return JSON.parse(fs.readFileSync(resultPath(tree.root, id), "utf8")) as ReadResult;
  } catch {
    return undefined;
  }
}

/**
 * The newest reading again of a source that differs in a matter of fact nobody has decided on (read.sourceTask ask or
 * never): its ID, how many places, and the source's task not ended a task chosen now would go into (open) — the source
 * "read again, differs, not verified" until the person decides. The person's word on that reading, or a task that holds
 * it already: none.
 */
export function unverifiedReading(tree: Tree, s: Source): { reading: string; places: number; open?: string } | undefined {
  const id = s.readings?.at(-1);
  if (!id || s.readDecided?.reading === id) return undefined;
  const src = resultOf(tree, id)?.source;
  if (src?.id !== s.id || !src.offer || src.task) return undefined;
  const open = openTaskOf(tree, s.id);
  return { reading: id, places: src.offer, ...(open ? { open: open.id } : {}) };
}

/** A refusal of the person's word on a reading again (its code read.decide.*, the task where one is known). */
const refuse = (why: string, code: string, more: { task?: string; hint?: string } = {}) => Object.assign(new Error(why), { code: `read.decide.${code}`, ...more });

/**
 * The person's word on a reading again of a source that differs (unverifiedReading, or one they name): now — a task
 * to go through with the agent at once; queue — a task in the queue (priority 3); keep — just kept, asked no more; and
 * for a transcript that is the person's own reading (they confirmed it, core/readers.ts), never a task of the agent's
 * but review — a wording with the new reading's places proposed to them (their task, core/proposal.ts). A task of the
 * source not ended takes the places (appended); kept on the source (readDecided). Who may: the caller says (a person alone).
 * unsure — asked of a reading with no matter of fact both readers are sure of left to decide, only places they are not
 * sure of (no trifles, none judged): queue — a task of the agent's to look at each on the scan (correct where sure,
 * else a note at the source), or review (a transcript the person confirmed) — a wording with the places the new
 * reading read proposed to them. Never without their word (always makes none of them).
 */
export function decideReading(tree: Tree, id: string, take: ReadingTake, reading?: string, o: { unsure?: boolean } = {}): { source: string; reading: string; take: ReadingTake; task?: string; taskFor?: "agent" | "person"; appended?: true; unsure?: true; places: number } {
  const unsure = !!o.unsure;
  if (unsure && take !== "queue" && take !== "review") throw refuse(`places not sure are handed over into the queue (a task of the agent's) or, a transcript the person confirmed, for their review — not ${take}`, "invalid", { hint: `strom source reading ${id} --unsure --take queue` });
  const s = tree.get<Source>(id);
  if (!sourceOk(s)) throw refuse(`${id} is no source of the research`, "none");
  const rid = reading ?? s.readings?.at(-1);
  const r = rid && s.readings?.includes(rid) ? resultOf(tree, rid) : undefined;
  if (!rid || !r?.source || r.source.id !== s.id) throw refuse(`${id} has no reading again${reading ? ` ${reading}` : ""} to decide on`, "noreading");
  if (r.source.task) throw refuse(`the reading ${rid} of ${id} is held in the task ${r.source.task} already`, "task", { task: r.source.task });
  const d = s.readDecided?.reading === rid ? s.readDecided : undefined;
  if (d) throw refuse(`the reading ${rid} of ${id} is decided already: ${d.take === "keep" ? "just kept" : `held in the task ${d.task}`}`, d.task ? "task" : "done", d.task ? { task: d.task } : {});
  const confirmed = !!userReading(s);
  if (take === "review" && !confirmed) throw refuse(`the transcript of ${id} is no reading of the person's own (not confirmed): nothing to set aside for their review — now, queue or keep`, "unconfirmed", { hint: `strom source reading ${id} --take queue` });
  if ((take === "now" || take === "queue") && confirmed)
    throw refuse(`the transcript of ${id} is the person's own reading (${readingWords(s)}): no task of the agent's may change it — review (a wording proposed to the person) or keep`, "confirmed", { hint: `strom source reading ${id} --take review` });
  const p = placesOf(tree, s, rid, r.source.variants ?? []);
  if (unsure && p.fresh.length) throw refuse(`the reading ${rid} of ${id} differs in a matter of fact both its readers are sure of: decide on it first (without --unsure) — its places not sure go with it`, "sure", { hint: `strom source reading ${id} --take ${confirmed ? "review" : "queue"}` });
  const places = unsure ? p.unsure : p.fresh;
  if (!places.length) throw refuse(`the reading ${rid} of ${id} differs in nothing to decide on (trifles, ${unsure ? "no place not sure left — each judged in a task already" : "places not sure, places judged already"})`, "nothing");
  let task: string | undefined;
  let appended = false;
  if (take === "now" || take === "queue") {
    const open = openTaskOf(tree, s.id);
    task = handOver(tree, s, r, unsure ? p.unsure : p.ordered, 3, open, unsure).id;
    appended = !!open;
  } else if (take === "review") {
    const made = review(tree, s, r, places, unsure);
    if ("refused" in made) throw refuse(made.why, made.refused === "same" ? "task" : made.refused, made.task ? { task: made.task } : {});
    task = made.task;
    appended = made.appended;
  }
  const decided = { reading: rid, take, at: new Date().toISOString(), ...(task ? { task } : {}), ...(appended ? { appended: true as const } : {}), ...(unsure ? { unsure: true as const } : {}) };
  const said = take === "keep" ? "just kept, by the person's word" : take === "review" ? `a wording of it proposed to the person in ${task}, by their word` : `held in the task ${task}${appended ? " (not ended, the places said in it)" : ""}, by the person's word${take === "now" ? " (now with the agent)" : ""}`;
  update<Source>(tree, s.id, "source", (x) => ({ ...x, readDecided: decided }), { op: "source.reading", summary: `${s.id}: the reading ${rid} ${said}${unsure ? " (its places not sure)" : ""}` });
  return { source: s.id, reading: rid, take, ...(task ? { task, taskFor: take === "review" ? ("person" as const) : ("agent" as const) } : {}), ...(appended ? { appended: true as const } : {}), ...(unsure ? { unsure: true as const } : {}), places: places.length };
}

/** A place told by its words alone (folded keys of both sides), whatever its spacing, accents or punctuation. */
const placeKey = (v: { at: string; other: string }) => `${keysIn(v.at).join(" ")}\u0000${keysIn(v.other).join(" ")}`;

/** Whether a task is not ended (open, being done, put aside, waiting). */
const live = (t: Task | undefined): t is Task => !!t && t.type === "task" && t.state !== "done" && t.state !== "dropped";

/** The task of a source's reading again not ended yet (open, being done, put aside, waiting): one at a time. */
function openTaskOf(tree: Tree, source: string, hint?: string): Task | undefined {
  const h = hint ? tree.get<Task>(hint) : undefined;
  if (live(h) && h.origin === SOURCE_READ_ORIGIN) return h;
  return tree.list<Task>("task").find((t) => live(t) && t.origin === SOURCE_READ_ORIGIN && t.subject?.includes(source));
}

/**
 * The places earlier readings of a source put in a task (its result's source.variants, source.task, or the task the
 * person's word made of it: readDecided), and those of a wording proposed for the person's review that waits for them or
 * that they declined (never offered again): each to its task.
 */
function judgedPlaces(tree: Tree, s: Source, now: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of s.readings ?? []) {
    if (id === now) continue;
    const held = resultOf(tree, id)?.source;
    const task = held?.task ?? (s.readDecided?.reading === id ? (s.readDecided.task ?? (s.readDecided.take === "keep" ? id : undefined)) : undefined); // just kept: judged by the person's word on that reading
    if (held?.id !== s.id || !task) continue;
    // its places not sure handed over by the person's word: judged too
    const unsure = !held.task && s.readDecided?.reading === id && !!s.readDecided.unsure;
    for (const v of held.variants ?? []) if ((v.sure !== false || unsure) && !v.judged) out.set(placeKey(v), task);
  }
  for (const t of tree.list<Task>("task")) {
    const p = t.proposal;
    if (t.origin !== PROPOSAL_ORIGIN || p?.source !== s.id || !p.reading || p.reading === now || !s.readings?.includes(p.reading)) continue;
    if (!(t.state === "waiting" || (t.state === "parked" && t.heldBy === "archive")) && !rejectedProposal(tree, s.id, p.text)) continue;
    for (const v of resultOf(tree, p.reading)?.source?.variants ?? []) if ((v.sure !== false || p.unsure) && !v.judged && !out.has(placeKey(v))) out.set(placeKey(v), t.id);
  }
  return out;
}

/** Who read a reading: each reader's agent · model · effort, the blind one after the first; none kept: said so. */
export function whoRead(lang: string, r: Pick<ReadResult, "readers">): string {
  const who = (r.readers.who ?? []).filter((w) => w.ran !== false);
  return who.length ? who.map((w) => [w.agent, w.model, w.effort].filter(Boolean).join(" · ")).join(" + ") : phrase(lang, "read.source.unknown");
}

/** Two readers of the same model: said, for it is weaker evidence than two models agreeing; else nothing. */
function sameModel(lang: string, r: Pick<ReadResult, "readers">): string {
  const who = (r.readers.who ?? []).filter((w) => w.ran !== false);
  return who.length >= 2 && who[0]!.model && who.every((w) => w.agent === who[0]!.agent && w.model === who[0]!.model) ? phrase(lang, "read.source.same", { model: who[0]!.model! }) : "";
}

/**
 * What became of the newest reading again of a source that differs from its transcript (the Strom app's source viewer,
 * /status readAgain; strom source show): unchecked — places of a matter of fact both readers are sure of wait for the
 * person; saved — just kept by their word, or differing in trifles alone (minorOnly) or only in places its readers are
 * not sure of (unsureOnly, also with trifles); task — held in a task (taskFor agent, or person: a wording proposed for
 * their review), taskOpen while it is not ended, taskQueued while an agent's open one waits in the queue (not taken
 * now with the agent); every matter of fact judged in a task already: that task. proposal: a wording proposed to the
 * person for the transcript that waits for them. unsureOffer: no matter of fact both readers are sure of left to decide,
 * but places they are not sure of that no task holds — the person may hand them over (decideReading unsure; never
 * without their word). None read again, or alike: undefined.
 */
export interface ReadAgain {
  read: string;
  state: "unchecked" | "saved" | "task";
  task?: string;
  taskFor?: "agent" | "person";
  taskOpen?: boolean;
  taskQueued?: boolean;
  minorOnly?: true;
  unsureOnly?: true;
  unsureOffer?: true;
  proposal?: { text: string; by: string; task: string; at: string };
}

export function readAgainOf(tree: Tree, s: Source): ReadAgain | undefined {
  const id = s.readings?.at(-1);
  const src = id ? resultOf(tree, id)?.source : undefined;
  if (!id || src?.id !== s.id || src.agree !== "differ") return undefined;
  const waiting = openProposal(tree, s.id);
  const proposal = waiting?.proposal ? { proposal: { text: waiting.proposal.text, by: waiting.proposal.by, task: waiting.id, at: waiting.proposal.at } } : {};
  const held = (task: string, o: { for?: "agent" | "person"; now?: boolean } = {}): ReadAgain => {
    const t = tree.get<Task>(task);
    const open = live(t);
    const taskFor = o.for ?? (t?.origin === PROPOSAL_ORIGIN ? "person" : "agent");
    return { read: id, state: "task", task, taskFor, taskOpen: open, taskQueued: open && taskFor === "agent" && !o.now, ...proposal };
  };
  const d = s.readDecided?.reading === id ? s.readDecided : undefined;
  if (d) return d.task ? held(d.task, { for: d.take === "review" ? "person" : "agent", now: d.take === "now" }) : { read: id, state: "saved", ...proposal };
  if (src.task) return held(src.task, src.taskFor ? { for: src.taskFor } : {});
  if (src.offer) return { read: id, state: "unchecked", ...proposal };
  const vs = src.variants ?? [];
  const matters = vs.filter((v) => v.sure !== false && !TRIFLES.includes(variantKind(v.at, v.other)));
  if (matters.some((v) => !v.judged)) return { read: id, state: "unchecked", ...proposal };
  const offer = unsureOffered(tree, s, id, src) ? { unsureOffer: true as const } : {};
  // every matter of fact judged before: in a task, or kept by the person's word on an earlier reading (D…)
  const judged = matters[0]?.judged;
  if (judged) return judged.startsWith("D") ? { read: id, state: "saved", ...offer, ...proposal } : { ...held(judged), ...offer };
  return { read: id, state: "saved", ...(vs.some((v) => v.sure === false) ? { unsureOnly: true as const } : { minorOnly: true as const }), ...offer, ...proposal };
}

/**
 * Whether the person may hand over a reading's places not sure (decideReading unsure): nothing decided of it, no task
 * holds it, no matter of fact both its readers are sure of left to decide, and a place not sure (no trifle) no task
 * judged — of a transcript the person confirmed, one review would put into a wording (read by the new reading, not
 * [...] or [?], its words found in the transcript), else review would only refuse it.
 */
function unsureOffered(tree: Tree, s: Source, reading: string, src: SourceRead): boolean {
  if (src.task || s.readDecided?.reading === reading || src.agree !== "differ") return false;
  const p = placesOf(tree, s, reading, src.variants ?? []);
  if (p.fresh.length || !p.unsure.length) return false;
  // a transcript the person confirmed: only what review would propose — a place the new reading read, found in it
  if (!userReading(s)) return true;
  const waiting = openProposal(tree, s.id)?.proposal?.text ?? s.transcript ?? "";
  const wording = wordingOf(tree, s, p.unsure, true);
  return wording !== undefined && wording !== waiting.normalize("NFC");
}

/** Every source whose newest reading again differs from its transcript, what became of it (/status readAgain). */
export function readAgainAll(tree: Tree): Record<string, ReadAgain> {
  const out: Record<string, ReadAgain> = {};
  for (const s of tree.list<Source>("source")) {
    if (!s.readings?.length || s.retracted || s.mergedInto) continue;
    const a = readAgainOf(tree, s);
    if (a) out[s.id] = a;
  }
  return out;
}

/** A reading again as the Strom app is given it (feature read.sourceTask: the app's ZADANI_DEV_ukol-z-cteni.md §1, §2). */
export type SourceReadApp = Omit<SourceRead, "taskWith" | "offer" | "taskFor"> & {
  /** What read.sourceTask was for this reading: ask, always (a task at once), never. */
  taskSetting: SourceTaskWith;
  /** Places of a matter of fact both readers are sure of that nothing decided and no task holds yet: the person may decide. */
  taskOffer: boolean;
  /** Whose the task that holds the reading is (task). */
  taskFor?: "agent" | "person";
  /** The person just kept it. */
  decided?: "saved";
  /** The source's task not ended that a task chosen now would go into (taskOffer, unsureOffer). */
  openTask?: string;
  /**
   * No matter of fact both readers are sure of left to decide, but places they are not sure of that no task holds: the
   * person may hand them over (POST …/task {how: queue|review, unsure: true}); never without their word.
   */
  unsureOffer?: true;
  /** What became of the source's newest reading again (readAgainOf). */
  state?: ReadAgain;
};

/**
 * A reading again as the Strom app is given it (GET /read/<D…>, feature read.sourceTask): its setting (taskSetting —
 * the reading's, else the tree's `setting`), whether the person may decide on it (taskOffer, openTask), the task that
 * holds it and whose (task, taskFor), whether the person just kept it (decided saved), whether its places went into a
 * task not ended (appended), and the source's state (state). Nothing else of it changes.
 */
export function sourceReadForApp(tree: Tree, src: SourceRead, reading: string, setting: SourceTaskWith): SourceReadApp {
  const { taskWith, offer, taskFor, ...rest } = src;
  const s = tree.get<Source>(src.id);
  const d = s?.readDecided?.reading === reading ? s.readDecided : undefined;
  const task = src.task ?? d?.task;
  const offered = !!s && !!offer && !task && !d;
  const unsure = !!s && !offered && !task && unsureOffered(tree, s, reading, src);
  const open = offered || unsure ? openTaskOf(tree, s.id) : undefined;
  const state = s ? readAgainOf(tree, s) : undefined;
  return {
    ...rest,
    taskSetting: taskWith ?? setting,
    taskOffer: offered,
    ...(task ? { task, taskFor: taskFor ?? (d?.take === "review" ? "person" : "agent") } : {}),
    ...(d?.take === "keep" ? { decided: "saved" as const } : {}),
    ...(open ? { openTask: open.id } : {}),
    ...(unsure ? { unsureOffer: true as const } : {}),
    ...(src.appended || d?.appended ? { appended: true as const } : {}),
    ...(state ? { state } : {}),
  };
}
