// One document read at once (strom document read): a photo, a scan or a PDF the person hands over — a register entry,
// a letter, a deed, a gravestone, the back of a photo. A reader with a clean context writes what stands on it word for
// word, its translation into the language asked, what its old words, abbreviations and occupations mean, and the people,
// events and relations it names; a second reader, when asked, reads it blind (the transcript, the people and events
// alone) and the two are compared. Nothing is filled in: strom checks that each name a reader gives stands in its
// transcript and comes of its words, marks what the transcript marks uncertain, drops what it marks illegible (K1.2). strom, never a reader,
// says which people of the research's tree a person may be, and which of its places a place is.
//
// A reading is no record of the research: its id is D…, its state lives in .strom/reads/<id>.json (this computer), its
// reports in notes/readings/<id>-<n>.md and its result in notes/readings/<id>.json (in git: it goes with the research).
// Nothing of it enters the tree by itself — what the person confirms comes back as an edit of theirs (strom sync).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { foldText } from "./text.ts";
import { MONTHS, dateYears, normalizeDate } from "./gdate.ts";
import { langName } from "./lang.ts";
import { birthEvent, sameFamilyName, surnameForms } from "./people.ts";
import type { Person, Place } from "./model.ts";
import type { Tree } from "./tree.ts";

/** D + the time it began (UTC, to the second) + 4 hex: D20261019153012-a1b2. */
export const READ_ID = /^D\d{14}-[0-9a-f]{4}$/;

export function newReadId(now = new Date()): string {
  const t = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `D${t}-${crypto.randomBytes(2).toString("hex")}`;
}

export const DOC_KINDS = [
  "register.baptism",
  "register.birth",
  "register.marriage",
  "register.death",
  "register.burial",
  "register.other",
  "letter",
  "deed",
  "gravestone",
  "photo.back",
  "certificate",
  "list",
  "other",
] as const;
export const SCRIPTS = ["kurrent", "fraktur", "latin", "cyrillic", "print", "other"] as const;
/** Why a document cannot be read (whole or in part): no text on it, or a photo of text that cannot be read. */
export const WHY = ["not-text", "blur", "glare", "angle", "cut", "dark", "small", "other"] as const;
export const ROLES = ["child", "father", "mother", "godparent", "witness", "midwife", "priest", "groom", "bride", "deceased", "informant", "writer", "addressee", "mentioned", "other"] as const;
export const TERM_KINDS = ["term", "abbr", "occupation", "place", "symbol"] as const;
export const READ_STATES = ["queued", "reading", "checking", "done", "unreadable", "failed", "cancelled"] as const;
export type ReadStateName = (typeof READ_STATES)[number];
/** A reading over: its result stays as it is. */
export const FINAL_STATES: readonly ReadStateName[] = ["done", "unreadable", "failed", "cancelled"];

/** Pages of one reading at most (a longer PDF: the pages asked). */
export const DOC_PAGES = 10;
/** A page whose shorter side is below this is too small to read: said at once, no reader started. */
export const SMALL_PX = 800;
/** Views one reader opens at most (a dense page is its whole view and its two halves: three). */
export const DOC_VIEWS = 9;

/** The line each block of a report is added at (taken out when its reader ends). */
export const DOC_NEXT = "<!-- next block -->";

export type Region = [number, number, number, number];

// ── the reader's task ───────────────────────────────────────────────────────────────────────────────────────────────

export interface DocPageView {
  /** The page of the document (1 = the first), across all its files. */
  n: number;
  /** The view of the whole page (or of the part asked: --region). */
  view: string;
  /** A dense page: its halves too, each sharper. */
  parts?: { label: string; view: string }[];
  /** Only a part of the page is read (fractions of the page). */
  region?: Region;
}

export function docPrompt(o: { pages: DocPageView[]; report: string; lang: string; note?: string | undefined; blind?: boolean }): string {
  const into = langName(o.lang);
  const blind = !!o.blind;
  return `You are a READER of one document for a family history research: a record from a register, a letter, a deed,
a gravestone, the back of a photo — anything written. You are not the researcher: you decide nothing and you write
nowhere except your report file. Do not run any commands.
${blind ? "\nThis is a BLIND reading: another reader reads the same document; write what YOU read, exactly.\n" : ""}${o.note ? `\nWhat the person said the document is (a description only — never a hint to what is written on it):\n${o.note.replace(/\s*\n\s*/g, " ")}\n` : ""}
THE PAGES (open each file with your image reader, in this order)
${o.pages
  .map((p) => {
    const head = `- page ${p.n}${p.region ? ` (only a part of it: read what this view shows)` : ""}`;
    return p.parts?.length
      ? `${head}: ${p.view}\n    the whole page, to find the entries; read them on its sharper parts:\n${p.parts.map((x) => `    ${x.label}: ${x.view}`).join("\n")}`
      : `${head}: ${p.view}`;
  })
  .join("\n")}

FIRST LOOK
Open the first page. When there is no handwritten or printed text on it at all (a photo of a person, of a house,
a landscape), write only the document block with "legible: no" and "why: not-text", then the done line, and stop.
When there is text but this photo of it cannot be read, say why: blur, glare, angle, cut (the text runs off the
picture), dark, small, other — "legible: no" when nothing can be read (then no entries: nothing of a page that
cannot be read is kept), "partly" when some of it can.

THE REPORT
Write your report to ${o.report} AS YOU GO — after every block, not at the end. Its first lines are strom's, the
last of them this line:
${DOC_NEXT}
Add each block with one edit of the file: replace that line with your block followed by the same line, so that it
stays the last one. Never write the whole file again. The keys of the blocks ("Document", "Entry", "kind",
"transcript", …) stay in English — strom reads them.

First the document block:

## Document
kind: ${DOC_KINDS.join(" | ")}
language: the language(s) of the document, BCP 47 codes, comma separated (e.g. la, de)
script: ${SCRIPTS.join(" | ")}
date: when the document was written, when it says so or it is plain (as text; leave the line out otherwise)
legible: yes | partly | no
why: only when partly or no — ${WHY.join(" | ")}

Then one block for every entry. A page of a register holds several entries: each is a block of its own, in the order
they stand. A letter, a deed, a gravestone, the back of a photo is one entry.

## Entry e1 · page 1
region: x,y,w,h — where the entry stands on its page: fractions (0–1) of the page's whole view, from its top left
transcript: the entry word for word as written — its own language and spelling, abbreviations as written, "|" where
  a line ends; "[?]" right after a word you are not sure of, "[...]" for what you cannot read. Never complete a word,
  a name or a date from what you expect: "[...]" beats a guess.
${
  blind
    ? ""
    : `translation: the transcript in ${into}, as close as it goes; keep "[?]" and "[...]" where they are
term: <a word or abbreviation as written> = <what it means, in ${into}> (term | abbr | occupation | place | symbol)
  — one line each, for the old words, formulas, abbreviations, occupations, and on a gravestone its symbols
`
}person: <ref> | <role> | ${blind ? "" : `<the role in ${into}> | `}written=<the name exactly as it stands in the transcript> | given=<the given
  name in today's form> | surname=<the surname in today's form> | sex=M|F|U | age=<as written> | occupation=<…> |
  residence=<…> — one line each person named; ref p1, p2, … in this entry; role: ${ROLES.join(", ")};
  given and surname only turn the written name into today's form ("Joannes" → "Jan"): never a name the transcript
  does not have — no surname the entry does not write by the person (a child's is not taken from its father's);
  on a form (a certificate) whose fields hold a name apart, written= the words of its fields as written there;
  a name you could not read stays out; leave out what the entry does not say
event: <BIRT | BAPM | MARR | DEAT | BURI | RESI | EVEN> | date=<as on the record, in numbers: 3.4.1846, or a year> |
  place=<the place as written> | persons=<ref>:<principal|father|mother|godparent|witness|groom|bride|deceased|other>,…
relation: parent <ref of the parent> <ref of the child>  — or —  spouse <ref> <ref>
${
  blind
    ? ""
    : `
After the last entry:

## Context
context: in ${into}, a few sentences that explain the document for its kind: of a register entry its form and what its
  columns and formulas say; of a gravestone its inscription and symbols; of a letter who writes to whom, when, and
  what of the family it tells. Only what the document and general knowledge of such documents say — no guesses of
  the family.
`
}
When all pages are done, finish with one line: "done: <n> entries".`;
}

// ── the report, as strom reads it ──────────────────────────────────────────────────────────────────────────────────

export interface DocBlock {
  kind?: string;
  language?: string[];
  script?: string;
  date?: string;
  legible?: "yes" | "partly" | "no";
  why?: string;
}

export interface RawPerson {
  ref: string;
  role: string;
  roleText?: string;
  fields: Record<string, string>;
}

export interface RawEvent {
  type: string;
  fields: Record<string, string>;
}

export interface RawEntry {
  /** As the reader named it (e1); strom numbers the entries of a reading again. */
  id: string;
  page: number;
  region?: Region;
  transcript: string;
  translation?: string;
  terms: { term: string; meaning: string; kind: string }[];
  persons: RawPerson[];
  events: RawEvent[];
  relations: string[][];
}

export interface DocReport {
  doc: DocBlock;
  entries: RawEntry[];
  context?: string;
  /** The reader wrote its done line. */
  done: boolean;
}

const KEY = /^\s*(?:[-*]\s+)?\**(\p{L}+)\**\s*:\**\s*(.*)$/u;
const MULTI = new Set(["transcript", "translation", "context"]);
const ENTRY_KEYS = new Set(["region", "transcript", "translation", "term", "person", "event", "relation"]);
const DOC_KEYS = new Set(["kind", "language", "script", "date", "legible", "why", "context"]);

/** A report without the line its reader added each block at. */
export function withoutDocNext(text: string): string {
  return text
    .split("\n")
    .filter((l) => l.trim() !== DOC_NEXT)
    .join("\n");
}

export function parseRegion(v: string | undefined): Region | undefined {
  if (!v) return undefined;
  const n = v
    .split(/[,;\s]+/u)
    .filter(Boolean)
    .map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x))) return undefined;
  // percentages written for fractions
  const f = n.some((x) => x > 1) && n.every((x) => x <= 100) ? n.map((x) => x / 100) : n;
  let [x, y, w, h] = f.map((z) => Math.min(1, Math.max(0, z))) as Region;
  w = Math.min(w, 1 - x);
  h = Math.min(h, 1 - y);
  return w > 0 && h > 0 ? [round(x), round(y), round(w), round(h)] : undefined;
}

const round = (x: number) => Math.round(x * 1000) / 1000;

function pairs(parts: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of parts) {
    const m = /^([\p{L}]+)\s*=\s*(.*)$/u.exec(p.trim());
    if (m && m[2]!.trim()) out[m[1]!.toLowerCase()] = m[2]!.trim();
  }
  return out;
}

/** The blocks of a document reader's report: the document, each entry, the context. */
export function parseDocReport(text: string): DocReport {
  const out: DocReport = { doc: {}, entries: [], done: /^\s*done:/imu.test(text) };
  const contexts: string[] = [];
  for (const b of withoutDocNext(text).split(/^##\s+/mu).slice(1)) {
    const [head = "", ...body] = b.split("\n");
    const isEntry = /^entry\b/iu.test(head.trim());
    const isDoc = /^document\b/iu.test(head.trim());
    const isContext = /^context\b/iu.test(head.trim());
    if (!isEntry && !isDoc && !isContext) continue;
    const fields = new Map<string, string[]>();
    let at: string | undefined;
    for (const line of body) {
      if (/^\s*done:/iu.test(line)) {
        at = undefined;
        continue;
      }
      const m = KEY.exec(line);
      const key = m?.[1]?.toLowerCase();
      const known = key && (isEntry ? ENTRY_KEYS : DOC_KEYS).has(key);
      if (m && key && known) {
        at = key;
        const list = fields.get(key) ?? [];
        // a repeated key of one value (transcript) goes on; of many (person) is one more
        if (MULTI.has(key) && list.length) list[list.length - 1] += `\n${m[2]!.trim()}`;
        else list.push(m[2]!.trim());
        fields.set(key, list);
      } else if (at && MULTI.has(at) && line.trim()) {
        const list = fields.get(at)!;
        list[list.length - 1] = list[list.length - 1] ? `${list[list.length - 1]}\n${line.trim()}` : line.trim();
      } else if (!line.trim()) at = MULTI.has(at ?? "") ? at : undefined;
    }
    const one = (k: string) => fields.get(k)?.[0]?.trim() || undefined;
    if (isDoc) {
      const kind = one("kind")?.toLowerCase();
      if (kind) out.doc.kind = (DOC_KINDS as readonly string[]).includes(kind) ? kind : kindOf(kind);
      const lang = one("language");
      if (lang)
        out.doc.language = lang
          .split(/[,;/\s]+/u)
          .map((x) => x.trim().toLowerCase())
          .filter((x) => /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/u.test(x));
      const script = one("script")?.toLowerCase();
      if (script) out.doc.script = (SCRIPTS as readonly string[]).includes(script) ? script : "other";
      const date = one("date");
      if (date) out.doc.date = date;
      const legible = one("legible")?.toLowerCase();
      if (legible === "yes" || legible === "partly" || legible === "no") out.doc.legible = legible;
      const why = one("why")?.toLowerCase().replace(/\s+/g, "-");
      if (why) out.doc.why = (WHY as readonly string[]).includes(why) ? why : "other";
      const c = one("context");
      if (c) contexts.push(c);
      continue;
    }
    if (isContext) {
      const c = one("context") ?? body.join("\n").trim();
      if (c) contexts.push(c);
      continue;
    }
    const id = /\b(e\d+)\b/iu.exec(head)?.[1]?.toLowerCase() ?? `e${out.entries.length + 1}`;
    const page = Number(/page\s+(\d+)/iu.exec(head)?.[1] ?? 1);
    const transcript = one("transcript") ?? "";
    const entry: RawEntry = { id, page, transcript, terms: [], persons: [], events: [], relations: [] };
    const region = parseRegion(one("region"));
    if (region) entry.region = region;
    const tr = one("translation");
    if (tr) entry.translation = tr;
    for (const t of fields.get("term") ?? []) {
      const m = /^(.+?)\s*[=–—]\s*(.+?)\s*(?:\((\p{L}+)\))?\s*$/u.exec(t);
      if (m) entry.terms.push({ term: m[1]!.trim(), meaning: m[2]!.trim(), kind: (TERM_KINDS as readonly string[]).includes(m[3]?.toLowerCase() ?? "") ? m[3]!.toLowerCase() : "term" });
    }
    for (const p of fields.get("person") ?? []) {
      const parts = p.split(/\s*\|\s*/u);
      const ref = /^p\d+$/iu.test(parts[0]!.trim()) ? parts.shift()!.trim().toLowerCase() : `p${entry.persons.length + 1}`;
      const role = parts[0] && !parts[0].includes("=") ? parts.shift()!.trim().toLowerCase() : "other";
      const roleText = parts[0] && !parts[0].includes("=") ? parts.shift()!.trim() : undefined;
      entry.persons.push({ ref, role, ...(roleText ? { roleText } : {}), fields: pairs(parts) });
    }
    for (const e of fields.get("event") ?? []) {
      const parts = e.split(/\s*\|\s*/u);
      const type = parts[0] && !parts[0].includes("=") ? parts.shift()!.trim() : "EVEN";
      entry.events.push({ type, fields: pairs(parts) });
    }
    for (const r of fields.get("relation") ?? []) {
      const w = r.split(/[\s,]+/u).filter(Boolean);
      if (w.length >= 3) entry.relations.push(w.slice(0, 3).map((x) => x.toLowerCase()));
    }
    out.entries.push(entry);
  }
  if (contexts.length) out.context = contexts.join("\n\n");
  return out;
}

/** A kind a reader wrote in its own words: the nearest of the list. */
function kindOf(said: string): string {
  const f = foldText(said);
  // a certificate first: a birth certificate is no register of births ("rodný list", "Geburtsurkunde", "odpis aktu")
  if (/certif|urkunde|zaswiadcz|odpis|extrait|auszug|vypis|(?:rodn|oddac|umrtn)\p{L}*\s+list/u.test(f)) return "certificate";
  if (/bapt|krest|tauf|chrzest|christen/u.test(f)) return "register.baptism";
  if (/birth|narozen|geburt|urodzen/u.test(f)) return "register.birth";
  if (/marri|odd|trau|heirat|slub/u.test(f)) return "register.marriage";
  if (/burial|pohreb|begrab|pogrzeb/u.test(f)) return "register.burial";
  if (/death|umrt|tod|sterb|zgon/u.test(f)) return "register.death";
  if (/regist|matri/u.test(f)) return "register.other";
  if (/letter|dopis|brief|list\b/u.test(f)) return "letter";
  if (/grave|nahrob|grab/u.test(f)) return "gravestone";
  if (/photo|fotk|foto/u.test(f)) return "photo.back";
  return "other";
}

// ── nothing filled in (K1.2) ──────────────────────────────────────────────────────────────────────────────────────

/** A word of a transcript: as written, its key (folded, without marks and punctuation), and its marks. */
export interface Word {
  text: string;
  key: string;
  unsure: boolean;
  illegible: boolean;
}

export function words(s: string): Word[] {
  const src = s
    .replace(/\s*\[\?\]/gu, "[?]")
    .replace(/\[\s*(?:\.{2,}|…)\s*\]/gu, " [...] ")
    .replace(/\|/gu, " ");
  return src
    .split(/\s+/u)
    .filter(Boolean)
    .flatMap((t): Word[] => {
      if (t === "[...]") return [{ text: t, key: "[...]", unsure: false, illegible: true }];
      const key = foldText(t.replace(/\[\?\]/gu, "")).replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
      return key ? [{ text: t, key, unsure: t.includes("[?]"), illegible: false }] : [];
    });
}

/** Where the words of `part` stand in `whole`, in a row (its first place), else -1. */
function find(whole: Word[], part: Word[]): number {
  if (!part.length) return -1;
  outer: for (let i = 0; i + part.length <= whole.length; i++) {
    for (let j = 0; j < part.length; j++) if (whole[i + j]!.key !== part[j]!.key) continue outer;
    return i;
  }
  return -1;
}

/**
 * Where the words of `part` stand in `whole` apart — a form's fields, the surname in one and the given names in
 * another —: each at a place of its own, after the word before where it can be; undefined when one is not there
 * (a word not read, "[...]", is never found apart).
 */
function findApart(whole: Word[], part: Word[]): Word[] | undefined {
  if (!part.length || part.some((w) => w.illegible)) return undefined;
  const used = new Set<number>();
  const out: Word[] = [];
  let from = 0;
  for (const w of part) {
    let i = whole.findIndex((x, k) => k >= from && !used.has(k) && x.key === w.key);
    if (i < 0) i = whole.findIndex((x, k) => !used.has(k) && x.key === w.key);
    if (i < 0) return undefined;
    used.add(i);
    out.push(whole[i]!);
    from = i + 1;
  }
  return out;
}

export type Uncertain = "given" | "surname" | "date" | "place" | "age" | "occupation" | "residence";

export interface DocPerson {
  ref: string;
  role: (typeof ROLES)[number];
  roleText?: string;
  written: string;
  given?: string;
  surname?: string;
  /** The given name in today's form as the reader turned it, where its letters are none of the written words: a lead. */
  today?: string;
  sex?: "M" | "F" | "U";
  age?: string;
  occupation?: string;
  residence?: string;
  uncertain?: Uncertain[];
  match?: { person: string; why: string[]; score: number }[];
  /** For the Strom app alone (resultForApp): the role the blind reader gave this person, where it is another. */
  blindRole?: (typeof ROLES)[number];
}

export interface DocEvent {
  type: string;
  label?: string;
  date?: { text: string; gedcom?: string };
  place?: { text: string; known?: string };
  persons: { ref: string; role: string }[];
  uncertain?: Uncertain[];
}

export interface DocEntry {
  id: string;
  page: number;
  region?: Region;
  transcript: string;
  translation?: string;
  glossary?: { term: string; meaning: string; kind: string }[];
  persons: DocPerson[];
  events: DocEvent[];
  relations: ({ type: "parent"; parent: string; child: string } | { type: "spouse"; a: string; b: string })[];
  /** Two readers: where the blind one read otherwise. */
  variants?: { field: string; at: string; other: string }[];
  agree?: "same" | "differ";
}

/** What strom left out of a reader's entry or marked, and why — said with the result, never hidden. */
export interface Check {
  entry: string;
  ref?: string;
  what: string;
  why: "not-in-transcript" | "illegible" | "no-name" | "no-person" | "not-of-its-letters";
}

/** A name's word in letters alone (folded): Latin and old spellings as today's (ph f, th t, w v, y i, j i, ae e). */
function spelled(key: string): string {
  return key
    .replace(/ph/gu, "f")
    .replace(/th/gu, "t")
    .replace(/c(?=[aou]|k|$)/gu, "k")
    .replace(/w/gu, "v")
    .replace(/[yj]/gu, "i")
    .replace(/[ao]e/gu, "e")
    .replace(/(\p{L})\1+/gu, "$1");
}

/** A word without a Latin case's ending (Josephi, Joannes, Mariae, Wenceslaus): a stem of three letters or more. */
function latinStem(s: string): string {
  const m = /^(.{3,}?)(?:ius|ii|us|um|is|es|em|ae|e|i|o|a)$/u.exec(s);
  return m ? m[1]! : s;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}

/**
 * A word of today's form that is the written word in its letters (both folded keys): the same, or the same spelled
 * as today's and without a Latin case's ending, or one with an ending of at most two letters more, or — a given name
 * (`near`) — one letter apart (two in a long word): "Josephi" Josef, "Joannes" Jan, "Mariae" Marie, "Jacobus" Jakub.
 * "Karel" is not "Josephi", nor "Václav" "Wenceslaus": a name of other letters is no reading of the written one.
 */
export function sameNameWord(today: string, written: string, near = true): boolean {
  if (!today || !written) return false;
  if (today === written) return true;
  const [a, b] = [spelled(today), spelled(written)];
  if (a === b) return true;
  const [x, y] = [latinStem(a), latinStem(b)];
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 3 && long.startsWith(short) && long.length - short.length <= 2) return true;
  return near && short.length >= 3 && distance(x, y) <= (short.length >= 6 ? 2 : 1);
}

/** A surname that is the written word: a form of one family name (Novák, Nováková, Nowak) or the same in its letters. */
function sameSurnameWord(surname: string, key: string): boolean {
  return sameFamilyName(surname, key) || sameNameWord(letters(surname), key, false);
}

function letters(s: string): string {
  return foldText(s).replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
}

/** The same word in its letters, old spellings as today's — no ending taken off (Novotná is not Novotný). */
function sameWord(a: string, b: string): boolean {
  return spelled(a) === spelled(b);
}

/**
 * The man's forms of a woman's surname — one with a woman's ending a language tells apart (-ová, -owa, -ówna, -á,
 * -ska, Cyrillic -ова, -ая): Krausová → Kraus, Novotná → Novotný; none for a surname of no such ending (Kalina, Sova).
 */
function mansForms(surname: string): string[] {
  const n = surname.normalize("NFC").trim().toLowerCase();
  const self = letters(surname);
  if (!/^.{2,}(?:ov|ow)n?a$|(?:sk|ck|dzk)a$/u.test(self) && !/(?:á|(?:ов|ев|ёв|ин|ын)а|ая)$/u.test(n)) return [];
  return [...surnameForms(surname)].filter((x) => x !== self);
}

/**
 * A written word that is a woman's form of a surname (Krausová, Novákové, Novákovou, Nowakowa): its man's stem —
 * not in Cyrillic, whose -ова is a man's genitive too (сын Петрова).
 */
function womansStem(key: string): string | undefined {
  return /^(.{2,}?)(?:ova|ove|ovou|owa|owej|owny|owna|ovna|ovny)$/u.exec(key)?.[1];
}

/**
 * A surname of the other sex's form than the written word gives the person — a woman's form for a man written in a
 * man's (Krausová of "Kraus", a man), a man's for a woman written in a woman's (Novák of "Nováková", a woman): no
 * reading of the record, left out as a surname of another family. A woman written in the man's form, as Latin
 * registers write her (Dvořáková of "Dvořák"), is read so.
 */
function ofOtherSex(surname: string, key: string, sex: string | undefined): boolean {
  if (sex === "M") return !sameWord(letters(surname), key) && mansForms(surname).some((m) => sameNameWord(m, key, false));
  if (sex !== "F" || mansForms(surname).length) return false;
  const stem = womansStem(key);
  return !!stem && !sameWord(letters(surname), key) && (sameNameWord(letters(surname), stem, false) || sameFamilyName(surname, stem));
}

const EVENT_WORDS: Record<string, string> = {
  birth: "BIRT",
  born: "BIRT",
  baptism: "BAPM",
  christening: "CHR",
  marriage: "MARR",
  death: "DEAT",
  burial: "BURI",
  residence: "RESI",
};

function eventType(said: string): { type: string; label?: string } {
  const t = said.trim();
  if (/^[A-Z_]{3,5}$/u.test(t)) return { type: t };
  const known = EVENT_WORDS[foldText(t)];
  return known ? { type: known } : { type: "EVEN", label: t };
}

/** A date a reader wrote ("3.4.1846", "3 APR 1846", "1846"), in GEDCOM where it says enough; never of "[...]". */
export function gedcomDate(text: string): string | undefined {
  if (/\[\s*(?:\.{2,}|…)\s*\]/u.test(text)) return undefined;
  const s = text.replace(/\[\?\]/gu, "").trim();
  const plain = normalizeDate(s);
  if (plain) return plain;
  const dmy = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{3,4})$/u.exec(s);
  if (dmy) {
    const g = `${Number(dmy[1])} ${MONTHS[Number(dmy[2]) - 1] ?? ""} ${dmy[3]}`;
    return normalizeDate(g);
  }
  const my = /^(\d{1,2})\.\s*(\d{3,4})$/u.exec(s) ?? /^(\d{1,2})\/(\d{3,4})$/u.exec(s);
  if (my) return normalizeDate(`${MONTHS[Number(my[1]) - 1] ?? ""} ${my[2]}`);
  return undefined;
}

/**
 * A reader's entry as strom gives it on: each person's written name must stand in the transcript (folded — no
 * accents, no case — as words in a row; on a form, `form`, each word in a field of its own), else the person is left
 * out; its surname must be a form of one of those
 * words in the form of the person's sex, else it is left out (a surname of another person, of the parish's head, of
 * nowhere, a woman's form for a man written in a man's); its given name in
 * today's form must be of the letters of the others, else the name is as written and the reader's form a lead
 * (today); a given name or a surname whose words the
 * transcript marks "[?]" is uncertain, one it marks "[...]" all through is left out (the reader cannot have read it);
 * a date of "[...]" has no GEDCOM; references to people left out go too. What was left out is said (checks).
 */
export function checkEntry(raw: RawEntry, id: string, blind = false, form = false): { entry: DocEntry; checks: Check[] } {
  const checks: Check[] = [];
  const text = words(raw.transcript);
  const persons: DocPerson[] = [];
  for (const p of raw.persons) {
    const written = p.fields.written?.trim();
    if (!written) {
      checks.push({ entry: id, ref: p.ref, what: [p.fields.given, p.fields.surname].filter(Boolean).join(" ") || p.role, why: "no-name" });
      continue;
    }
    const w = words(written);
    const at = find(text, w);
    // a form (a certificate) holds a name in its fields apart — the surname in one, the given names in another —:
    // its words each written there are the name; elsewhere a name stands in a row as written
    const span = at >= 0 ? text.slice(at, at + w.length) : form ? findApart(text, w) : undefined;
    if (!span) {
      checks.push({ entry: id, ref: p.ref, what: written, why: "not-in-transcript" });
      continue;
    }
    const role = ((ROLES as readonly string[]).includes(p.role) ? p.role : "other") as DocPerson["role"];
    const person: DocPerson = { ref: p.ref, role, written: span.map((x) => x.text).join(" ") };
    if (p.roleText && !blind) person.roleText = p.roleText;
    const uncertain = new Set<Uncertain>();
    // the surname: a written word it is a form of (the last such), else the last of two or more words, "[...]" ones
    // too; a surname no written word gives — one the reader took from elsewhere — is left out
    // (a surname of the other sex's form than the word written: left out as well, the word still the surname's)
    const surname = p.fields.surname?.replace(/\[\?\]/gu, "").trim();
    const sex = p.fields.sex?.trim().toUpperCase();
    let surnameAt = -1;
    if (surname) {
      surnameAt = span.findLastIndex((x) => !x.illegible && sameSurnameWord(surname, x.key));
      if (surnameAt < 0 && span.length >= 2 && span.at(-1)!.illegible) {
        checks.push({ entry: id, ref: p.ref, what: `surname "${surname}"`, why: "illegible" });
        surnameAt = span.length - 1;
      } else if (surnameAt < 0 || ofOtherSex(surname, span[surnameAt]!.key, sex)) checks.push({ entry: id, ref: p.ref, what: `surname "${surname}"`, why: "not-in-transcript" });
      else {
        person.surname = surname;
        if (span[surnameAt]!.unsure || p.fields.surname!.includes("[?]")) uncertain.add("surname");
      }
    }
    // the given name: the other words; a word of today's form must be one of them in its letters (Josephi → Josef,
    // Joannes → Jan), else the name is as written and the reader's form only a lead (today)
    const givenWords = span.filter((_, i) => i !== surnameAt);
    const given = p.fields.given?.replace(/\[\?\]/gu, "").trim();
    if (given) {
      const legible = givenWords.filter((x) => !x.illegible);
      if (!legible.length) checks.push({ entry: id, ref: p.ref, what: `given "${given}"`, why: givenWords.length ? "illegible" : "not-in-transcript" });
      else {
        const fits = words(given).every((g) => legible.some((x) => sameNameWord(g.key, x.key)));
        if (fits) person.given = given;
        else {
          person.given = legible.map((x) => x.text.replace(/\[\?\]/gu, "").replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, "")).join(" ");
          person.today = given;
          uncertain.add("given");
          checks.push({ entry: id, ref: p.ref, what: `given "${given}" for "${person.given}"`, why: "not-of-its-letters" });
        }
        if (givenWords.some((x) => x.unsure || x.illegible) || p.fields.given!.includes("[?]")) uncertain.add("given");
      }
    }
    if (sex === "M" || sex === "F" || sex === "U") person.sex = sex;
    for (const f of ["age", "occupation", "residence"] as const) {
      const v = p.fields[f]?.trim();
      if (!v) continue;
      if (/^\[\s*(?:\.{2,}|…)\s*\]$/u.test(v)) continue;
      person[f] = v.replace(/\s*\[\?\]/gu, "").trim();
      if (v.includes("[?]") || v.includes("[...]")) uncertain.add(f);
    }
    if (uncertain.size) person.uncertain = [...uncertain];
    persons.push(person);
  }
  const refs = new Set(persons.map((p) => p.ref));
  const events: DocEvent[] = [];
  for (const e of raw.events) {
    const t = eventType(e.type);
    const ev: DocEvent = { type: t.type, ...(t.label ? { label: t.label } : {}), persons: [] };
    const uncertain = new Set<Uncertain>();
    const date = e.fields.date?.trim();
    if (date) {
      const gedcom = gedcomDate(date);
      ev.date = { text: date.replace(/\s*\[\?\]/gu, "").trim() || date, ...(gedcom ? { gedcom } : {}) };
      if (date.includes("[?]") || (!gedcom && /\[/u.test(date))) uncertain.add("date");
    }
    const place = e.fields.place?.trim();
    if (place && !/^\[\s*(?:\.{2,}|…)\s*\]$/u.test(place)) {
      ev.place = { text: place.replace(/\s*\[\?\]/gu, "").trim() };
      // a place the transcript does not have (the parish of the page's head) is kept, but not as read for sure
      if (place.includes("[?]") || find(text, words(place)) < 0) uncertain.add("place");
    }
    for (const x of (e.fields.persons ?? "").split(/[,;\s]+/u).filter(Boolean)) {
      const [ref = "", role = "principal"] = x.split(":");
      if (refs.has(ref.toLowerCase())) ev.persons.push({ ref: ref.toLowerCase(), role: role.toLowerCase() });
    }
    if (uncertain.size) ev.uncertain = [...uncertain];
    events.push(ev);
  }
  const relations: DocEntry["relations"] = [];
  for (const [type, a = "", b = ""] of raw.relations) {
    if (!refs.has(a) || !refs.has(b) || a === b) continue;
    if (type === "parent") relations.push({ type: "parent", parent: a, child: b });
    else if (type === "spouse") relations.push({ type: "spouse", a, b });
  }
  const entry: DocEntry = { id, page: raw.page, transcript: raw.transcript, persons, events, relations };
  if (raw.region) entry.region = raw.region;
  if (!blind && raw.translation) entry.translation = raw.translation;
  if (!blind && raw.terms.length) entry.glossary = raw.terms;
  return { entry, checks };
}

// ── two readers ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The hunks where two transcripts differ, word by word (their keys; the marks [?] are no difference). */
export function wordDiff(a: string, b: string): { at: string; other: string }[] {
  const x = words(a);
  const y = words(b);
  const n = x.length;
  const m = y.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = x[i]!.key === y[j]!.key ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const out: { at: string; other: string }[] = [];
  let i = 0;
  let j = 0;
  let hunk: { at: Word[]; other: Word[] } | undefined;
  const flush = () => {
    if (hunk && (hunk.at.length || hunk.other.length)) out.push({ at: hunk.at.map((w) => w.text).join(" "), other: hunk.other.map((w) => w.text).join(" ") });
    hunk = undefined;
  };
  while (i < n || j < m) {
    if (i < n && j < m && x[i]!.key === y[j]!.key) {
      flush();
      i++;
      j++;
    } else if (j < m && (i >= n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      (hunk ??= { at: [], other: [] }).other.push(y[j++]!);
    } else {
      (hunk ??= { at: [], other: [] }).at.push(x[i++]!);
    }
  }
  flush();
  return out;
}

const same = (a: string | undefined, b: string | undefined) => foldText(a ?? "") === foldText(b ?? "");

/**
 * The people of one reader paired with the other's by the name written, the best match first: the whole name alike,
 * else the most of its words shared, a word of the surname weighing more. A person two match equally well (a father
 * and his son of one given name, two of the same name) is paired with none — missing on one side rather than another
 * one's. Index in `mine` → index in `theirs`.
 */
function pairByName(mine: DocPerson[], theirs: DocPerson[]): Map<number, number> {
  const keys = (p: DocPerson) => words(p.written).filter((x) => !x.illegible).map((x) => x.key);
  const surname = (p: DocPerson) => words(p.surname ?? "").map((x) => x.key);
  const WHOLE = 1000;
  const score = (p: DocPerson, q: DocPerson): number => {
    const a = keys(p);
    const b = keys(q);
    if (a.length && a.join(" ") === b.join(" ")) return WHOLE;
    const other = new Set(b);
    const sur = new Set([...surname(p), ...surname(q)]);
    let n = 0;
    for (const k of new Set(a)) if (other.has(k)) n += sur.has(k) ? 2 : 1;
    return n;
  };
  let open = mine.flatMap((p, i) => theirs.map((q, j) => ({ i, j, s: score(p, q) }))).filter((x) => x.s > 0);
  const out = new Map<number, number>();
  while (open.length) {
    const best = Math.max(...open.map((x) => x.s));
    const top = open.filter((x) => x.s === best);
    const done = { i: new Set<number>(), j: new Set<number>() };
    for (const x of top) {
      // equally good for either side: a tie, neither paired
      if (!top.some((y) => y !== x && (y.i === x.i || y.j === x.j))) out.set(x.i, x.j);
      done.i.add(x.i);
      done.j.add(x.j);
    }
    open = open.filter((x) => !done.i.has(x.i) && !done.j.has(x.j));
  }
  return out;
}

/**
 * The first reader's entries against the blind reader's: paired by page and order; the transcripts word by word, the
 * people by role and order (given name, surname), the events by type and order (date, place). Where they differ is a
 * variant of the entry; an entry only one of them has differs whole.
 */
export function compareReadings(first: DocEntry[], blind: DocEntry[]): { agree: "same" | "differ"; entries: DocEntry[] } {
  let all = true;
  const byPage = (list: DocEntry[]) => {
    const m = new Map<number, DocEntry[]>();
    for (const e of list) m.set(e.page, [...(m.get(e.page) ?? []), e]);
    return m;
  };
  const other = byPage(blind);
  const used = new Map<number, number>();
  const out = first.map((e) => {
    const k = used.get(e.page) ?? 0;
    used.set(e.page, k + 1);
    const b = other.get(e.page)?.[k];
    const variants: { field: string; at: string; other: string }[] = [];
    if (!b) variants.push({ field: "entry", at: e.id, other: "" });
    else {
      for (const d of wordDiff(e.transcript, b.transcript)) variants.push({ field: "transcript", ...d });
      const groups = (ps: DocPerson[]) => {
        const m = new Map<string, DocPerson[]>();
        for (const p of ps) m.set(p.role, [...(m.get(p.role) ?? []), p]);
        return m;
      };
      const theirs = groups(b.persons);
      const seen = new Map<string, number>();
      const fields = (p: DocPerson, q: DocPerson) => {
        for (const f of ["given", "surname"] as const) if (!same(p[f], q[f])) variants.push({ field: `${p.ref}.${f}`, at: p[f] ?? "", other: q[f] ?? "" });
      };
      const alone: DocPerson[] = [];
      for (const p of e.persons) {
        const i = seen.get(p.role) ?? 0;
        seen.set(p.role, i + 1);
        const q = theirs.get(p.role)?.[i];
        if (q) fields(p, q);
        else alone.push(p);
      }
      // a person the blind reader gave another role (other / writer): the same one by the name written, the role a
      // variant as its other fields
      const left = [...theirs].flatMap(([role, qs]) => qs.slice(seen.get(role) ?? 0));
      const pairs = pairByName(alone, left);
      for (const [i, p] of alone.entries()) {
        const j = pairs.get(i);
        if (j === undefined) {
          variants.push({ field: `${p.ref}`, at: [p.given, p.surname].filter(Boolean).join(" ") || p.written, other: "" });
          continue;
        }
        const q = left[j]!;
        variants.push({ field: `${p.ref}.role`, at: p.role, other: q.role });
        fields(p, q);
      }
      const taken = new Set(pairs.values());
      for (const [j, q] of left.entries()) if (!taken.has(j)) variants.push({ field: "person", at: "", other: [q.given, q.surname].filter(Boolean).join(" ") || q.written });
      const evs = new Map<string, number>();
      for (const ev of e.events) {
        const i = evs.get(ev.type) ?? 0;
        evs.set(ev.type, i + 1);
        const q = b.events.filter((x) => x.type === ev.type)[i];
        if (!q) {
          variants.push({ field: ev.type, at: ev.date?.text ?? ev.type, other: "" });
          continue;
        }
        if ((ev.date?.gedcom ?? ev.date?.text) !== (q.date?.gedcom ?? q.date?.text) && !same(ev.date?.text, q.date?.text)) variants.push({ field: `${ev.type}.date`, at: ev.date?.text ?? "", other: q.date?.text ?? "" });
        if (!same(ev.place?.text, q.place?.text)) variants.push({ field: `${ev.type}.place`, at: ev.place?.text ?? "", other: q.place?.text ?? "" });
      }
    }
    const agree = variants.length ? "differ" : "same";
    if (variants.length) all = false;
    return { ...e, agree, ...(variants.length ? { variants } : {}) } as DocEntry;
  });
  // entries only the blind reader has
  for (const [page, list] of other) if (list.length > (used.get(page) ?? 0)) all = false;
  return { agree: all ? "same" : "differ", entries: out };
}

// ── the research's tree: who a person may be, which place a place is ─────────────────────────────────────────────

/** The years a person of a role was likely born in, by the year of the record. */
function bornRange(role: string, year: number, age?: string): [number, number] | undefined {
  const a = Number(/\d+/u.exec(age ?? "")?.[0]);
  if (Number.isFinite(a) && a > 0 && a < 120) return [year - a - 2, year - a + 1];
  switch (role) {
    case "child":
      return [year - 1, year];
    case "father":
    case "mother":
      return [year - 65, year - 14];
    case "groom":
    case "bride":
      return [year - 70, year - 14];
    case "godparent":
    case "witness":
    case "midwife":
      return [year - 90, year - 12];
    default:
      return undefined;
  }
}

/**
 * The people of the tree this person of a document may be (at most 3, the likeliest first): the same first given name
 * and a surname of the same family (Novák/Nováková) are needed; the same sex, a birth year that fits the role and the
 * record's year, and a place of theirs add to it. A suggestion, never a decision: the person chooses.
 */
export function matchPerson(tree: Tree, p: DocPerson, year?: number, place?: string): { person: string; why: string[]; score: number }[] {
  if (!p.given || !p.surname) return [];
  const firstOf = (s: string) => foldText(s).split(" ")[0]!;
  const out: { person: string; why: string[]; score: number }[] = [];
  for (const o of tree.list<Person>("person")) {
    if (o.retracted || o.mergedInto) continue;
    if (p.sex && p.sex !== "U" && o.sex !== "U" && o.sex !== p.sex) continue;
    // the given name as written, else the reader's today's form of it (a lead: less sure)
    let first = firstOf(p.given);
    const fits = () => o.names.filter((n) => foldText(n.given).split(" ").includes(first) && sameFamilyName(n.surname, p.surname!));
    let names = fits();
    let lead = false;
    if (!names.length && p.today) {
      first = firstOf(p.today);
      names = fits();
      lead = true;
    }
    if (!names.length) continue;
    const why = [lead ? "given-today" : "given", "surname"];
    let score = (names.some((n) => foldText(n.given).split(" ")[0] === first) ? 0.7 : 0.6) - (lead ? 0.1 : 0);
    if (p.sex && p.sex !== "U" && o.sex === p.sex) {
      why.push("sex");
      score += 0.1;
    }
    const born = dateYears(birthEvent(o)?.date ?? "")[0];
    const range = year !== undefined ? bornRange(p.role, year, p.age) : undefined;
    if (range && born !== undefined) {
      if (born < range[0] - 2 || born > range[1] + 2) continue;
      why.push("years");
      score += 0.1;
    }
    if (place && o.events.some((e) => e.place && foldText(e.place.split(",")[0]!) === foldText(place))) {
      why.push("place");
      score += 0.1;
    }
    out.push({ person: o.id, why, score: Math.round(Math.min(1, score) * 100) / 100 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

/** The place of the tree a place of a document names (one name of it, folded): its L…, else none. */
export function knownPlace(tree: Tree, text: string): string | undefined {
  const f = foldText(text.split(",")[0]!.replace(/\[\?\]/gu, ""));
  if (!f) return undefined;
  const hits = tree.list<Place>("place").filter((pl) => !pl.retracted && pl.names.some((n) => foldText(n.name.split(",")[0]!) === f));
  return hits.length === 1 ? hits[0]!.id : undefined;
}

/** The people and places of the entries matched against the tree. */
export function withTree(tree: Tree, entries: DocEntry[]): DocEntry[] {
  return entries.map((e) => {
    const ev = e.events.find((x) => x.date?.gedcom);
    const year = ev?.date?.gedcom ? dateYears(ev.date.gedcom)[0] : undefined;
    const place = e.events.find((x) => x.place)?.place?.text;
    const events = e.events.map((x) => {
      if (!x.place) return x;
      const known = knownPlace(tree, x.place.text);
      return known ? { ...x, place: { ...x.place, known } } : x;
    });
    const persons = e.persons.map((p) => {
      const match = matchPerson(tree, p, year, place);
      return match.length ? { ...p, match } : p;
    });
    return { ...e, persons, events };
  });
}

// ── a reading's state and result ──────────────────────────────────────────────────────────────────────────────────

export interface ReadPage {
  /** The page of the document, from 1. */
  n: number;
  /** The research's record of the file: an input I… or an image M…. */
  file: string;
  sha?: string;
  name: string;
  /** The page within its file (a PDF's), from 1. */
  page: number;
  /** The page upright, in pixels. */
  w?: number;
  h?: number;
  /** Only this part of it read (fractions of the page). */
  region?: Region;
}

export interface ReadReport {
  /** notes/readings/<id>-<n>.md */
  n: number;
  group: number;
  blind: boolean;
  version: number;
  outcome?: string;
  usd?: number;
  partial?: boolean;
  /** When the agent says its limit resets (a reader stopped by its usage limit). */
  resets?: string;
}

export interface ReadState {
  id: string;
  state: ReadStateName;
  version: number;
  /** Readers asked: 1, or 2 (the second blind). */
  readers: number;
  lang: string;
  pages: ReadPage[];
  /** The pages each reader reads (a long document in parts). */
  groups: number[][];
  reports: ReadReport[];
  persons?: string[];
  note?: string;
  /** Whoever asked: the agent's worker, the app. */
  from?: string;
  at: string;
  since: string;
  pid?: number;
  why?: string;
  error?: string;
  model?: string;
  agent?: string;
  /** Queued to be read later (strom document read --queue): only the blind reader, against the first one's reading. */
  only?: "blind";
  /** Read again (strom document again): the reading as it stood, back again when the new one is cancelled or gone. */
  before?: ReadBefore;
}

/** What a reading read again was before: its state, version and readers (its reports stay in the list). */
export type ReadBefore = Pick<ReadState, "state" | "version" | "readers" | "since" | "groups"> & Partial<Pick<ReadState, "why" | "error" | "only" | "model">>;

const BEFORE_OPTIONAL = ["why", "error", "only", "model"] as const;

/** A reading as it stands, kept to come back to when it is read again. */
export function beforeOf(s: ReadState): ReadBefore {
  const out: ReadBefore = { state: s.state, version: s.version, readers: s.readers, since: s.since, groups: s.groups };
  for (const k of BEFORE_OPTIONAL) if (s[k] !== undefined) Object.assign(out, { [k]: s[k] });
  return out;
}

/**
 * A reading read again whose new reading was cancelled (or its process gone): the reading before, as it stood — its
 * result is what it was; the reports of the new one stay in the list (their cost counted). None read again: undefined.
 */
export function backBefore(s: ReadState): ReadState | undefined {
  if (!s.before) return undefined;
  const out: ReadState = { ...s, ...s.before };
  for (const k of BEFORE_OPTIONAL) if (s.before[k] === undefined) delete out[k];
  delete out.pid;
  delete out.before;
  return out;
}

/** The version of a reading read again: past every report there is (one cancelled before kept its own). */
export function nextVersion(s: ReadState): number {
  return Math.max(s.version, ...s.reports.map((r) => r.version)) + 1;
}

/** A file's name for a person: its last part, no control characters, at most 200 characters. */
export function shownName(name: string): string {
  return path.basename(name.normalize("NFC").replace(/[\\/]+/gu, "/")).replace(/[\p{Cc}]/gu, "").trim().slice(0, 200);
}

/** Whoever asked a reading from the Strom app (its bridge). */
export const APP_READ_FROM = "app:read";

export function readsDir(root: string): string {
  return path.join(root, ".strom", "reads");
}

export function statePath(root: string, id: string): string {
  return path.join(readsDir(root), `${id}.json`);
}

export function cancelPath(root: string, id: string): string {
  return path.join(readsDir(root), `${id}.cancel`);
}

export function reportPath(root: string, id: string, n: number): string {
  return path.join(root, "notes", "readings", `${id}-${n}.md`);
}

export function resultPath(root: string, id: string): string {
  return path.join(root, "notes", "readings", `${id}.json`);
}

export function loadState(root: string, id: string): ReadState | undefined {
  try {
    const s = JSON.parse(fs.readFileSync(statePath(root, id), "utf8")) as ReadState;
    return s && s.id === id ? s : undefined;
  } catch {
    return undefined;
  }
}

/** Written whole or not at all (a reader of it never sees half). */
export function saveState(root: string, s: ReadState): void {
  fs.mkdirSync(readsDir(root), { recursive: true });
  const tmp = `${statePath(root, s.id)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2) + "\n");
  fs.renameSync(tmp, statePath(root, s.id));
}

/** A process still there (a reading at work in another one). */
export function alive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

export interface ReadResult {
  id: string;
  state: ReadStateName;
  version: number;
  lang: string;
  at: string;
  since: string;
  doc: { kind?: string; language?: string[]; script?: string; date?: string; legible?: "yes" | "partly" | "no"; why?: string | null };
  readers: { asked: number; ran: number; agree: "same" | "differ" | null };
  pages: ReadPage[];
  entries: DocEntry[];
  context?: string;
  /** What strom left out of the readers' entries, and why. */
  checks: Check[];
  /** Pages no reader read to an end (a reader failed, stopped at its limit). */
  incomplete?: number[];
  persons?: string[];
  note?: string;
  cost?: { amount: number; currency: "USD"; partial?: true };
  error?: string;
}

const LEGIBLE_ORDER = { yes: 0, partly: 1, no: 2 } as const;

/** A variant of a person's role (`p2.role`): no words of the transcript. */
const ROLE_VARIANT = /^[\p{L}\p{N}_-]+\.role$/u;

/**
 * The result as the Strom app is given it (GET /read/<id>): a variant of a person's role is no words of the
 * transcript, and the app (3.14) marks each variant where its words stand in the transcript and counts it as a
 * difference — a role code ("other") stood inside "Mother". So the role the blind reader gave goes to the person
 * (`blindRole`) and out of `variants`; the result kept and `strom document show` keep it as a variant.
 */
export function resultForApp(r: ReadResult): ReadResult {
  return {
    ...r,
    entries: r.entries.map((e) => {
      const roles = new Map<string, string>();
      for (const v of e.variants ?? []) if (ROLE_VARIANT.test(v.field)) roles.set(v.field.slice(0, -".role".length), v.other);
      if (!roles.size) return e;
      const variants = (e.variants ?? []).filter((v) => !ROLE_VARIANT.test(v.field));
      const { variants: _, ...rest } = e;
      return {
        ...rest,
        ...(variants.length ? { variants } : {}),
        persons: e.persons.map((p) => {
          const other = roles.get(p.ref);
          return other && (ROLES as readonly string[]).includes(other) ? { ...p, blindRole: other as DocPerson["role"] } : p;
        }),
      };
    }),
  };
}

/**
 * The result of a reading as it stands (while its readers write too: what they wrote so far): the first reader's
 * entries checked and matched with the tree, the blind reader's held against them.
 */
export function buildResult(tree: Tree, s: ReadState): ReadResult {
  const mine = s.reports.filter((r) => r.version === s.version);
  const read = (r: ReadReport): DocReport | undefined => {
    try {
      return parseDocReport(fs.readFileSync(reportPath(tree.root, s.id, r.n), "utf8"));
    } catch {
      return undefined;
    }
  };
  const checks: Check[] = [];
  const firsts = s.groups.map((_, g) => mine.find((r) => r.group === g && !r.blind) ?? reportOfEarlier(s, g, false));
  const blinds = s.groups.map((_, g) => mine.find((r) => r.group === g && r.blind));
  const doc: ReadResult["doc"] = {};
  const contexts: string[] = [];
  const incomplete: number[] = [];
  const entriesOf = (reports: (ReadReport | undefined)[], blind: boolean): DocEntry[] => {
    const out: DocEntry[] = [];
    reports.forEach((r, g) => {
      const rep = r ? read(r) : undefined;
      if (!blind) {
        if (rep) mergeDoc(doc, rep.doc);
        if (rep?.context && rep.doc.legible !== "no") contexts.push(rep.context);
        if (r?.outcome && r.outcome !== "ok" && !rep?.done) incomplete.push(...s.groups[g]!);
      }
      // a reader that says its pages cannot be read wrote nothing of them to go on (K1.2: never a guess)
      if (rep?.doc.legible === "no") {
        if (!blind && rep.entries.length) checks.push({ entry: `page ${s.groups[g]!.join(",")}`, what: `${rep.entries.length === 1 ? "an entry" : `${rep.entries.length} entries`} of pages the reader says cannot be read${rep.doc.why ? ` (${rep.doc.why})` : ""}`, why: "illegible" });
        return;
      }
      for (const e of rep?.entries ?? []) {
        const id = `e${out.length + 1}`;
        const c = checkEntry(e, id, blind, rep?.doc.kind === "certificate");
        if (!blind) checks.push(...c.checks);
        // a region of a part asked (--region): of the whole page
        const page = s.pages.find((p) => p.n === e.page);
        if (c.entry.region && page?.region) c.entry.region = within(page.region, c.entry.region);
        out.push(c.entry);
      }
    });
    return out;
  };
  let entries = entriesOf(firsts, false);
  const blindRan = blinds.some((r) => r);
  // the first reader failed, the blind one read: its entries, untranslated
  if (!entries.length && blindRan) entries = entriesOf(blinds, false);
  let agree: ReadResult["readers"]["agree"] = null;
  if (blindRan && s.readers > 1 && entries.length) {
    const blindEntries = entriesOf(blinds, true);
    const c = compareReadings(entries, blindEntries);
    entries = c.entries;
    agree = c.agree;
  }
  entries = withTree(tree, entries);
  const ran = (firsts.some((r) => r?.outcome === "ok") ? 1 : 0) + (blinds.some((r) => r?.outcome === "ok") ? 1 : 0);
  const usd = s.reports.reduce((n, r) => n + (r.usd ?? 0), 0);
  const partial = s.reports.some((r) => r.outcome !== undefined && (r.usd === undefined || r.partial));
  return {
    id: s.id,
    state: s.state,
    version: s.version,
    lang: s.lang,
    at: s.at,
    since: s.since,
    doc: { ...doc, why: doc.why ?? (s.why || null) },
    readers: { asked: s.readers, ran, agree },
    pages: s.pages,
    entries,
    ...(contexts.length ? { context: contexts.join("\n\n") } : {}),
    checks,
    ...(incomplete.length ? { incomplete: [...new Set(incomplete)].sort((a, b) => a - b) } : {}),
    ...(s.persons?.length ? { persons: s.persons } : {}),
    ...(s.note ? { note: s.note } : {}),
    ...(usd || s.reports.some((r) => r.usd !== undefined) ? { cost: { amount: Math.round(usd * 100) / 100, currency: "USD" as const, ...(partial ? { partial: true as const } : {}) } } : {}),
    ...(s.error ? { error: s.error } : {}),
  };
}

/** The readers of a reading that read to an end, as its result counts them: the first (of this version or before), the blind one. */
export function readersRan(s: ReadState): number {
  const ok = (r: ReadReport) => r.outcome === "ok";
  return (s.reports.some((r) => !r.blind && ok(r) && r.version <= s.version) ? 1 : 0) + (s.reports.some((r) => r.blind && ok(r) && r.version === s.version) ? 1 : 0);
}

/** The newest report of a group read to an end in an earlier version (a blind reader added later reads against it). */
function reportOfEarlier(s: ReadState, group: number, blind: boolean): ReadReport | undefined {
  return [...s.reports].reverse().find((r) => r.group === group && r.blind === blind && r.outcome === "ok" && r.version < s.version);
}

function mergeDoc(into: ReadResult["doc"], d: DocBlock): void {
  if (d.kind && !into.kind) into.kind = d.kind;
  if (d.language?.length) into.language = [...new Set([...(into.language ?? []), ...d.language])];
  if (d.script && !into.script) into.script = d.script;
  if (d.date && !into.date) into.date = d.date;
  if (d.legible) {
    // pages of several readers: the document is legible as far as each of them says
    if (!into.legible) into.legible = d.legible;
    else if (into.legible !== d.legible) into.legible = LEGIBLE_ORDER[d.legible] > LEGIBLE_ORDER[into.legible] && into.legible === "yes" ? "partly" : into.legible === "no" && d.legible !== "no" ? "partly" : into.legible;
  }
  if (d.why && !into.why) into.why = d.why;
}

/** A region of a part, as a region of the whole the part is of. */
export function within(part: Region, r: Region): Region {
  return [round(part[0] + r[0] * part[2]), round(part[1] + r[1] * part[3]), round(r[2] * part[2]), round(r[3] * part[3])];
}

/** The state a reading ends in by what its result says. */
export function endState(r: ReadResult, anyOk: boolean): ReadStateName {
  if (r.doc.legible === "no") return "unreadable";
  if (r.entries.length) return "done";
  return anyOk ? "unreadable" : "failed";
}

/** A reading as a list says it. */
export interface ReadSummary {
  id: string;
  state: ReadStateName;
  version: number;
  readers: number;
  /** Its readers that read to an end (none of a page too small to read). */
  ran: number;
  files: string[];
  pages: number;
  at: string;
  since: string;
  from?: string;
  /** Only its result is here (read on another computer). */
  resultOnly?: true;
}

/** The readings of this research, newest first: their state on this computer, else their result kept in git. */
export function listReadings(root: string): ReadSummary[] {
  const out = new Map<string, ReadSummary>();
  const sum = (s: { id: string; state: ReadStateName; version: number; pages: ReadPage[]; at: string; since: string }, readers: number, ran: number, from?: string): ReadSummary => ({
    id: s.id,
    state: s.state,
    version: s.version,
    readers,
    ran,
    files: [...new Set(s.pages.map((p) => p.file))],
    pages: s.pages.length,
    at: s.at,
    since: s.since,
    ...(from ? { from } : {}),
  });
  const dir = readsDir(root);
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const id = f.replace(/\.json$/u, "");
    if (!f.endsWith(".json") || !READ_ID.test(id)) continue;
    const s = loadState(root, id);
    if (s) out.set(id, sum(s, s.readers, readersRan(s), s.from));
  }
  const notes = path.join(root, "notes", "readings");
  for (const f of fs.existsSync(notes) ? fs.readdirSync(notes) : []) {
    const id = f.replace(/\.json$/u, "");
    if (!f.endsWith(".json") || !READ_ID.test(id) || out.has(id)) continue;
    try {
      const r = JSON.parse(fs.readFileSync(path.join(notes, f), "utf8")) as ReadResult;
      if (r.id === id && Array.isArray(r.pages)) out.set(id, { ...sum(r, r.readers?.asked ?? 1, r.readers?.ran ?? 0), resultOnly: true });
    } catch {
      // not one of ours
    }
  }
  // newest first: by when each began (two begun in one second have ids of that second)
  return [...out.values()].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}
