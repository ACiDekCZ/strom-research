// Calibrating the size of scan views (strom media calibrate): a sample of the research's own known records — images
// already here of sources a fact proves, read and verified before, with their words (a transcript or a quote) — read
// by the agent's readers at a few sizes, and held against what the research knows. Two questions, as the measurement
// behind the defaults asked them: is the entry found on a whole image, in its place (and none found on a neighbouring
// image without it), and how much of it is read from a half or a page (names, dates, house numbers it gives).
// Nothing here runs a reader or writes anything: the command does (commands/calibrate.ts).

import fs from "node:fs";
import path from "node:path";
import type { Tree } from "./tree.ts";
import type { Citation, Event, Family, Media, Person, Region, Source } from "./model.ts";
import { foldText } from "./text.ts";
import { dateYears } from "./gdate.ts";
import { parentsOf, primaryName } from "./people.ts";
import { imageSize } from "../image/index.ts";
import { saysNothing } from "./reader.ts";

/** Fewer images than this decide nothing: the calibration does not run. */
export const SAMPLE_MIN = 5;
export const SAMPLE_MAX = 8;
/** Neighbouring images without the entry, to catch an entry "found" where it is not. */
export const NEGATIVES_MAX = 4;
/** What a record must give, besides what the question names, to count as a known truth. */
export const KEYS_MIN = 4;
const KEYS_MAX = 12;
/** The sizes compared by default (the ones above what the model takes are left out). */
export const DEFAULT_SIZES = [1400, 1568, 2000];

export interface CalCase {
  /** C1, C2 … */
  id: string;
  source: string;
  media: Media;
  file: string;
  width: number;
  height: number;
  /** The entry as the reader is asked for it (English, the reader's language): its kind, whom, the year. */
  target: string;
  /** What the record gives besides: word stems folded, numbers as "#n". */
  keys: string[];
  /** Where the entry is on the image, from top to bottom (fractions, with a margin); none when no clip says. */
  band?: [number, number];
  /** The book (for a sample over several books). */
  book: string;
}

export interface CalNegative {
  id: string;
  /** The case whose entry is asked for (it is not on this image). */
  of: string;
  media: Media;
  file: string;
  width: number;
  height: number;
  target: string;
}

/** Folded for comparing: no accents, lower case, w as v (the old German spelling of Slavic names). */
export function foldKey(s: string): string {
  return foldText(s.normalize("NFC")).replace(/w/g, "v");
}

/** A word's stem as it is looked for: endings of declension cut off a long word. */
function stem(word: string): string {
  const f = foldKey(word);
  return f.length >= 6 ? f.slice(0, -2) : f;
}

function words(s: string | undefined): string[] {
  return (s ?? "").split(/[^\p{L}\p{M}]+/u).filter((w) => [...w].length >= 3);
}

/** Does an answer carry this key? A number as a whole number, a word's stem anywhere. */
export function hasKey(answer: string, key: string): boolean {
  if (key.startsWith("#")) return new RegExp(`(?<!\\p{N})${key.slice(1)}(?!\\p{N})`, "u").test(answer);
  return answer.includes(key);
}

const KIND_WORD: Record<string, string> = {
  BIRT: "baptism or birth",
  CHR: "baptism",
  BAPM: "baptism",
  DEAT: "death or burial",
  BURI: "burial or death",
  MARR: "marriage",
};
const KIND_ORDER = ["CHR", "BAPM", "BIRT", "MARR", "DEAT", "BURI"];

interface Fact {
  event: Event;
  /** Whose: the person, or a couple's partners. */
  people: Person[];
  citation: Citation;
}

/** The proven facts that cite each source, with whose they are. */
function provenFacts(tree: Tree): Map<string, Fact[]> {
  const out = new Map<string, Fact[]>();
  const add = (e: Event, people: Person[]) => {
    if (e.retracted || e.status !== "proven") return;
    for (const c of e.citations) out.set(c.source, [...(out.get(c.source) ?? []), { event: e, people, citation: c }]);
  };
  for (const p of tree.list<Person>("person")) if (!p.retracted) for (const e of p.events) add(e, [p]);
  for (const f of tree.list<Family>("family"))
    if (!f.retracted) {
      const partners = f.partners.map((id) => tree.get<Person>(id)).filter((p): p is Person => !!p && !p.retracted);
      for (const e of f.events) add(e, partners);
    }
  return out;
}

/** The whole image an entry is on, and where on it (a clip on a sharper part of it: moved into the whole). */
function wholeOf(all: Media[], m: Media, region?: Region): { media: Media; region?: Region } | undefined {
  if (!m.part) return { media: m, ...(region ? { region } : {}) };
  const whole = all.filter((x) => !x.retracted && !x.part && x.recordset === m.recordset && x.image === m.image)[0];
  if (!whole) return undefined;
  const p = m.part;
  return { media: whole, ...(region ? { region: { x: p.x + region.x * p.w, y: p.y + region.y * p.h, w: region.w * p.w, h: region.h * p.h } } : {}) };
}

function sizeOf(m: Media, file: string): { width: number; height: number } | undefined {
  if (m.width && m.height) return { width: m.width, height: m.height };
  try {
    return imageSize(new Uint8Array(fs.readFileSync(file)));
  } catch {
    return undefined;
  }
}

const isScan = (m: Media) => /^image\/(jpeg|png)$/.test(m.mime);

/** The question for a record: its kind, whom, the year — and the words of it a reader is not told. */
function truthOf(tree: Tree, facts: Fact[], text: string): { target: string; keys: string[] } {
  const main = [...facts].sort((a, b) => rank(a.event.kind) - rank(b.event.kind))[0]!;
  const year = main.event.date ? dateYears(main.event.date)[0] : undefined;
  const whom = main.people.map((p) => {
    const n = primaryName(p);
    return [n.given, n.surname].filter(Boolean).join(" ");
  });
  const target = `the ${KIND_WORD[main.event.kind] ?? "record"} entry of ${whom.join(" and ") || "a person"}${year ? ` (${year})` : ""}`;
  const told = new Set([...whom.flatMap((w) => words(w).map(stem)), ...(year ? [`#${year}`] : [])]);
  const folded = foldKey(text);
  const keys: string[] = [];
  const take = (k: string) => {
    if (keys.length >= KEYS_MAX || told.has(k) || keys.includes(k) || !hasKey(folded, k)) return;
    keys.push(k);
  };
  // the names it gives: the people of its facts, their parents, the godparents and witnesses
  const names: string[] = [];
  for (const f of facts) {
    for (const p of f.people) {
      const n = primaryName(p);
      names.push(n.given, n.surname);
      for (const parent of parentsOf(tree, p.id)) names.push(primaryName(parent).given, primaryName(parent).surname);
    }
    for (const x of f.event.participants ?? []) {
      const p = x.person ? tree.get<Person>(x.person) : undefined;
      names.push(p ? `${primaryName(p).given} ${primaryName(p).surname}` : (x.name ?? ""));
    }
  }
  for (const w of names.flatMap(words)) take(stem(w));
  // the numbers it gives: days, house numbers, ages (as the words of the record have them)
  const numbers = [...new Set([...folded.matchAll(/(?<!\p{N})(\p{N}{1,4})(?!\p{N})/gu)].map((m) => `#${Number(m[1])}`))];
  for (const n of numbers.slice(0, 6)) take(n);
  // the place, the occupation
  for (const f of facts) for (const w of [...words(f.event.place?.split(",")[0]), ...words(f.event.value)]) take(stem(w));
  return { target, keys };
}

function rank(kind: string): number {
  const i = KIND_ORDER.indexOf(kind);
  return i < 0 ? KIND_ORDER.length : i;
}

/**
 * The sample: images here of sources a proven fact cites, with their words, where the record gives at least KEYS_MIN
 * things the question does not name — at most SAMPLE_MAX, one per image, taken from as many books as there are.
 * `eligible`: how many such images the research has.
 */
export function pickSample(tree: Tree, shared: string): { cases: CalCase[]; negatives: CalNegative[]; eligible: number } {
  const all = tree.list<Media>("media");
  const byId = new Map(all.map((m) => [m.id, m]));
  const facts = provenFacts(tree);
  const found: Omit<CalCase, "id">[] = [];
  for (const s of tree.list<Source>("source")) {
    if (s.retracted) continue;
    const fs_ = facts.get(s.id);
    if (!fs_?.length) continue;
    const text = [s.transcript, ...fs_.map((f) => f.citation.quote)].filter((t): t is string => !!t?.trim()).join("\n");
    if (!text.trim()) continue;
    // the image: the one its clips are on (where the entry is), else the first it names
    const clip = s.clips?.find((c) => byId.get(c.media));
    const named = s.media?.map((id) => byId.get(id)).find((m): m is Media => !!m);
    const first = clip ? wholeOf(all, byId.get(clip.media)!, clip.region) : named ? wholeOf(all, named) : undefined;
    if (!first || first.media.retracted || !isScan(first.media)) continue;
    const file = path.join(shared, first.media.file);
    if (!fs.existsSync(file)) continue;
    const size = sizeOf(first.media, file);
    if (!size) continue;
    const regions = (s.clips ?? []).map((c) => (byId.get(c.media) ? wholeOf(all, byId.get(c.media)!, c.region) : undefined)).filter((r) => r?.media.id === first.media.id && r.region).map((r) => r!.region!);
    const band: [number, number] | undefined = regions.length
      ? [Math.max(0, Math.min(...regions.map((r) => r.y)) - 0.05), Math.min(1, Math.max(...regions.map((r) => r.y + r.h)) + 0.05)]
      : undefined;
    const truth = truthOf(tree, fs_, text);
    if (truth.keys.length < KEYS_MIN) continue;
    found.push({ source: s.id, media: first.media, file, ...size, ...truth, ...(band ? { band } : {}), book: first.media.recordset ?? first.media.id });
  }
  // one per image; the records that give the most first, then round the books so the sample holds several hands
  const seen = new Set<string>();
  const unique = found.sort((a, b) => b.keys.length - a.keys.length || a.source.localeCompare(b.source)).filter((c) => !seen.has(c.media.id) && seen.add(c.media.id));
  const books = new Map<string, Omit<CalCase, "id">[]>();
  for (const c of unique) books.set(c.book, [...(books.get(c.book) ?? []), c]);
  const picked: Omit<CalCase, "id">[] = [];
  for (let round = 0; picked.length < SAMPLE_MAX && [...books.values()].some((l) => l.length > round); round++)
    for (const list of books.values()) if (list[round] && picked.length < SAMPLE_MAX) picked.push(list[round]!);
  const cases = picked.map((c, i) => ({ ...c, id: `C${i + 1}` }));
  // a neighbouring image of the same book, without the entry: nothing is to be found on it
  const used = new Set(cases.map((c) => c.media.id));
  const negatives: CalNegative[] = [];
  for (const c of cases) {
    if (negatives.length >= NEGATIVES_MAX || c.media.image === undefined || !c.media.recordset) continue;
    const cited = new Set(tree.get<Source>(c.source)?.clips?.map((x) => x.media) ?? []);
    for (const n of [c.media.image + 1, c.media.image - 1]) {
      const m = all.find((x) => !x.retracted && !x.part && x.recordset === c.media.recordset && x.image === n && isScan(x) && !used.has(x.id) && !cited.has(x.id));
      const file = m ? path.join(shared, m.file) : "";
      const size = m && fs.existsSync(file) ? sizeOf(m, file) : undefined;
      if (!m || !size) continue;
      used.add(m.id);
      negatives.push({ id: `N${negatives.length + 1}`, of: c.id, media: m, file, ...size, target: c.target });
      break;
    }
  }
  return { cases, negatives, eligible: unique.length };
}

// ——— the readers' question and their answers ———

const RULES = `You are a READER for a genealogical research. You are not the researcher: you do not decide
anything and you do not write anywhere except your report file. Do not run any commands.`;

export interface CalJob {
  id: string;
  target: string;
  views: { label?: string; view: string }[];
}

/** Find: is the entry on the whole image, and where. Read: the entry's words from a half or a page. */
export function calibrationPrompt(kind: "find" | "read", jobs: CalJob[], report: string): string {
  const task =
    kind === "find"
      ? `Each case below names one entry of a parish register (or another record) and a scan to look for it on — a
whole page or a double page. Open each image (one at a time, in this order) and say whether that entry is on it
and where: from where to where it runs, as fractions (0–1) of the image's height from its top. The entry may be
missing: then say no — never pick another entry instead.`
      : `Each case below names one entry of a parish register (or another record) and the view(s) of its scan to read
it from (a double page may come as its two halves, overlapping at the gutter: an entry may run across both).
Open them (one at a time, in this order), find that entry and write its words as they stand: its own language and
spelling, abbreviations as written, line by line, a table's columns in their order separated by " | ". A letter
you cannot read: [?]; a word: [...]. Only this entry — not the one above or below it.`;
  const blocks = jobs.map((j) => [`### ${j.id} — ${j.target}`, ...j.views.map((v) => `${v.label ? `${v.label}: ` : "image: "}${v.view}`)].join("\n"));
  const format =
    kind === "find"
      ? `## <case id>
found: yes | no
where: from <top> to <bottom>`
      : `## <case id>
found: yes | no
transcript:
<the words, line by line>
illegible: what you could not read (leave the line out when everything was legible)`;
  return `${RULES}

${task}

THE CASES
${blocks.join("\n\n")}

THE REPORT
Write your report to ${report} AS YOU GO — after every case, not at the end:

${format}

The words "found", "yes", "no", "where", "from", "to", "transcript" and "illegible" stay in English: strom reads them.
When all are done, finish with one line: "done: <n> cases".`;
}

export interface CalAnswer {
  id: string;
  found: boolean;
  band?: [number, number];
  transcript?: string;
  illegible?: string;
}

/** The blocks of a report: "## C3" and what follows. */
export function parseCalibration(text: string): CalAnswer[] {
  const out: CalAnswer[] = [];
  for (const b of text.split(/^##\s+/m).slice(1)) {
    const [head = "", ...body] = b.split("\n");
    const id = /\b([CN]\d+)\b/.exec(head)?.[1];
    if (!id) continue;
    const field = (name: string) => new RegExp(`^\\s*(?:[-*]\\s+)?\\**${name}\\**\\s*:\\**\\s*(.*)$`, "imu");
    const found = /^(?:yes|true|ano|ja|found)\b/iu.test((field("found").exec(b)?.[1] ?? "").trim());
    const answer: CalAnswer = { id, found };
    const where = field("where").exec(b)?.[1];
    // "from 0.42 to 0.55", "42 % – 55 %"
    const nums = [...(where ?? "").matchAll(/(\d+(?:[.,]\d+)?)\s*(%)?/gu)].map((m) => {
      const v = Number(m[1]!.replace(",", "."));
      return m[2] || v > 1 ? v / 100 : v;
    });
    if (nums.length >= 2 && nums.every((n) => n >= 0 && n <= 1)) answer.band = [Math.min(nums[0]!, nums[1]!), Math.max(nums[0]!, nums[1]!)];
    // the words: from the line after "transcript:" (or on it) to "illegible:" or the end
    const lines = body;
    const at = lines.findIndex((l) => /^\s*(?:[-*]\s+)?\**transcript\**\s*:/iu.test(l));
    if (at >= 0) {
      const rest: string[] = [];
      const inline = lines[at]!.replace(/^\s*(?:[-*]\s+)?\**transcript\**\s*:\**\s*/iu, "");
      if (inline.trim()) rest.push(inline);
      for (const l of lines.slice(at + 1)) {
        if (/^\s*(?:[-*]\s+)?\**(?:illegible|done)\**\s*:/iu.test(l)) break;
        rest.push(l);
      }
      answer.transcript = rest.join("\n").trim();
    }
    const ill = field("illegible").exec(b)?.[1]?.trim();
    if (ill && !saysNothing(ill)) answer.illegible = ill;
    out.push(answer);
  }
  return out;
}

// ——— scoring and the decision ———

export interface SizeScore {
  kind: "find" | "read";
  size: number;
  /** Cases asked, and answered (a block in a report of a reader that finished). */
  cases: number;
  answered: number;
  /** find: found, and found in its place; negatives asked and found where they are not. */
  found: number;
  located: number;
  negatives: number;
  falseFinds: number;
  /** read: the things of the records read, of all of them; unsure places ([?], [...]) and what was illegible. */
  keys: number;
  keysTotal: number;
  unsure: number;
  /** Per case: found in place (find), things read (read). */
  perCase: Record<string, number>;
  usd?: number;
  /** A reader did not say what it cost. */
  partial: boolean;
  /** Readers that did not finish. */
  failed: number;
}

export function scoreFind(size: number, cases: CalCase[], negatives: CalNegative[], answers: CalAnswer[], failed: number): SizeScore {
  const by = new Map(answers.map((a) => [a.id, a]));
  const perCase: Record<string, number> = {};
  let found = 0;
  let located = 0;
  let answered = 0;
  for (const c of cases) {
    const a = by.get(c.id);
    if (!a) continue;
    answered++;
    if (a.found) found++;
    // in its place: the band said overlaps where the entry is (no clip: found is enough)
    const ok = a.found && (!c.band || (!!a.band && a.band[0] <= c.band[1] && a.band[1] >= c.band[0]));
    perCase[c.id] = ok ? 1 : 0;
    if (ok) located++;
  }
  const falseFinds = negatives.filter((n) => by.get(n.id)?.found).length;
  answered += negatives.filter((n) => by.has(n.id)).length;
  return { kind: "find", size, cases: cases.length + negatives.length, answered, found, located, negatives: negatives.length, falseFinds, keys: 0, keysTotal: 0, unsure: 0, perCase, partial: false, failed };
}

export function scoreRead(size: number, cases: CalCase[], answers: CalAnswer[], failed: number): SizeScore {
  const by = new Map(answers.map((a) => [a.id, a]));
  const perCase: Record<string, number> = {};
  let keys = 0;
  let unsure = 0;
  let answered = 0;
  for (const c of cases) {
    const a = by.get(c.id);
    if (!a) continue;
    answered++;
    const t = foldKey(a.transcript ?? "");
    const hits = a.found ? c.keys.filter((k) => hasKey(t, k)).length : 0;
    perCase[c.id] = hits;
    keys += hits;
    unsure += ((a.transcript ?? "").match(/\[\?\]|\[\.\.\.\]|\[…\]/g) ?? []).length + (a.illegible ? 1 : 0);
  }
  return { kind: "read", size, cases: cases.length, answered, found: 0, located: 0, negatives: 0, falseFinds: 0, keys, keysTotal: cases.reduce((n, c) => n + c.keys.length, 0), unsure, perCase, partial: false, failed };
}

export interface Decision {
  size: number;
  /** Decided on a clear result; else `fallback` (the default) stands. */
  clear: boolean;
  why: "decided" | "failed" | "uninformative";
}

/**
 * The cheapest size that loses nothing against the largest one compared — only on a clear result:
 *   every reader finished and every case was answered, at each size;
 *   the largest size itself worked (found in place at least half of the entries; read at least half of the things);
 *   find: every entry found in place at the largest is found in place at it, with no more false finds;
 *   read: at least as many things read in all, no entry by more than one fewer, no more unsure places.
 * Anything else: the default stands.
 */
export function decide(scores: SizeScore[], fallback: number): Decision {
  const list = [...scores].sort((a, b) => a.size - b.size);
  if (!list.length) return { size: fallback, clear: false, why: "failed" };
  if (list.some((s) => s.failed > 0 || s.answered < s.cases)) return { size: fallback, clear: false, why: "failed" };
  const top = list.at(-1)!;
  const real = top.cases - top.negatives;
  const works = top.kind === "find" ? top.located * 2 >= real : top.keys * 2 >= top.keysTotal;
  if (!works) return { size: fallback, clear: false, why: "uninformative" };
  const holds = (s: SizeScore) =>
    s.kind === "find"
      ? Object.entries(top.perCase).every(([id, ok]) => !ok || s.perCase[id] === 1) && s.falseFinds <= top.falseFinds
      : s.keys >= top.keys && s.unsure <= top.unsure && Object.entries(top.perCase).every(([id, n]) => (s.perCase[id] ?? 0) >= n - 1);
  return { size: list.find(holds)!.size, clear: true, why: "decided" };
}

/**
 * A typical cost of the readings, in USD, from the measurement behind the defaults (a strong model reading scans,
 * 2026): per reader started about 5 cents, per image token about 1 cent a thousand (written and read again while the
 * reader works), per entry written about a cent. An agent's own prices may differ; a subscription pays none of it.
 */
export function estimateUsd(readers: { views: number[]; cases: number; kind: "find" | "read" }[]): number {
  return readers.reduce((sum, r) => sum + 0.05 + r.views.reduce((n, px) => n + px / 750, 0) * 1e-5 + r.cases * (r.kind === "read" ? 0.01 : 0.003), 0);
}
