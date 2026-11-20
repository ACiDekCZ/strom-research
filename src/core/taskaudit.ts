// How a task's wait is written, checked (spec 109 U2): a wait for images strom can bring back only when it is written as
// strom needs it — the images of one book of the research (--images B…:<numbers>), one book per task, the book a
// record set of the research, its folder of the shared inbox there. What the words of a wait say is read here, nothing
// written but by the fix (applyAuditFix), its undoing (undoAuditFix) and the person's keeping it as it is (keepAudit).
//
// Findings (their codes are a contract with the Strom app — they only grow):
//   images-as-text — images of a book of the research named only in words: images saved by hand would not wake it;
//   several-books  — images of two or more books in one wait;
//   book-unknown   — images of a book the research has no record set of;
//   folder-missing — it waits for images, its folder of the shared inbox is not there.
// (archive-setting is kept for a later check of a wait an archive's setting made stale.)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { UsageError } from "./errors.ts";
import type { RecordSet, Task, TaskAuditFix } from "./model.ts";
import { foldText, unfoldIndex } from "./text.ts";
import { inboxFolderFor, parseImageList } from "./media.ts";
import { inboxWaitOf, singleBook } from "./inboxwait.ts";
import { liveBook } from "./books.ts";
import { runs, runsArg, shellArg, truncate } from "../cli/format.ts";
import { now, type Tree } from "./tree.ts";
import { phrase } from "./phrases.ts";

export const AUDIT_KINDS = ["images-as-text", "several-books", "book-unknown", "folder-missing"] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

/** What the agent checks of a wait for images it writes (strom task wait, session close): one English list. */
export const WAIT_CHECKLIST =
  "the kind matches the words (images saved by hand: --images, not words); images = --images with the book and their numbers (B…:57-58); one book per task; the book is a record set of the research (B…; strom recordset add first); its inbox folder exists";

export interface AuditFinding {
  kind: AuditKind;
  books?: string[];
  unknown?: string[];
  url?: string;
}

export type AuditChange =
  | { op: "wait-images"; task: string; book: string; title: string; images: string; folder: string }
  | { op: "wait-book"; task: string; book: string; title: string; folder: string }
  | { op: "split"; task: null; from: string; book?: string; title: string; images?: string; url?: string; folder?: string; waits: "images" | "book" | "text" }
  | { op: "folder"; task: string; book: string; folder: string };

export interface AuditFix {
  can: "whole" | "part" | "none";
  stamp: string;
  changes: AuditChange[];
  left: AuditKind[];
}

/** A part of a wait's words about one book. */
export interface WaitPart {
  /** The words, as written (NFC), without the list number or the joining word before them. */
  text: string;
  /** Names images (an image word: snímky, Bilder, images, skany…). */
  images: boolean;
  /** The image numbers named right after an image word. */
  numbers: number[];
  /** A book of the research it names (its ID, link, title or call number). */
  book?: string;
  /** A book the research does not have: its name as the words say it, and its link when they give one. */
  unknown?: string;
  url?: string;
  /** Where its words stand in the wait's (NFC): what the fix gives each task of them. */
  span?: Span;
}

export interface TaskAudit {
  task: string;
  at: string;
  findings: AuditFinding[];
  fix: AuditFix;
  /** The person kept it as it is (strom task audit --keep) and it still holds. */
  kept: { at: string; by: string; kinds: string[] } | null;
  /** The audit's fix of it that can still be undone (strom task audit --unfix). */
  fixed: { at: string; made: string[] } | null;
  parts: WaitPart[];
}

const LETTERS = "\\p{L}\\p{M}\\p{N}";
const NB = `(?<![${LETTERS}])`;
const NA = `(?![${LETTERS}])`;
/** Image words (folded): cs/sk, de, en, pl — kept narrow, whole words; "sn." the Czech short form. */
const IMAGE_WORDS =
  "snimek|snimku|snimky|snimka|snimkum|snimcich|snimkach|snimok|snimkov|sken|skeny|skenu|skenech|" +
  "bild|bilder|bildern|aufnahme|aufnahmen|scan|scans|digitalisat|digitalisate|digitalisaten|" +
  "image|images|frame|frames|" +
  "skan|skany|skanow|zdjecie|zdjecia|zdjec|obraz|obrazy|obrazow|klatka|klatki|klatek";
const IMAGE_SRC = `${NB}(?:(?:${IMAGE_WORDS})${NA}|sn\\.)`;
/** Book words (folded): a register book in cs, de, en, pl. */
const BOOK_SRC =
  `${NB}(?:(?:kniha|knihy|knize|knihu|knihou|knih|knihach|matrika|matriky|matrice|matriku|matrikou|matrik|` +
  `buch|buche|buches|buchs|bucher|matrikel|matrikeln|kirchenbuch|kirchenbuches|kirchenbucher|` +
  `book|books|register|registers|ksiega|ksiegi|ksiedze|ksiege|ksiag)${NA}|kn\\.)`;
const IMAGE_RE = new RegExp(IMAGE_SRC, "gu");
const IMAGE_ONE = new RegExp(IMAGE_SRC, "u");
/**
 * A guess right before an image word (folded): "≈ sn. 160", "asi snímek 40", "ca. Bild 12" — no image's number, the
 * number of an image still to be found. (A guess before the number — "snímky asi 160" — is no number right after it.)
 */
const ESTIMATE_BEFORE = new RegExp(
  `(?:[≈~∼]|${NB}(?:asi|cca|priblizne|kolem|okolo|about|approx|approximately|circa|ca|etwa|ungefahr|ok)\\.?)\\s*$`,
  "u",
);
const BOOK_RE = new RegExp(BOOK_SRC, "u");
/** Numbers right after an image word: "57–58", "14", "12, 14", "1, 2 a 3", "č. 9", "Nr. 9". */
const NUMBERS_AFTER = new RegExp(
  `^\\s*(?:(?:c\\.|cislo|nr\\.?|no\\.?|#)\\s*)?(\\d+(?:\\s*(?:[-–—]|\\.\\.\\.?)\\s*\\d+)?(?:\\s*(?:,|&|${NB}(?:a|i|and|und|oraz)${NA})\\s*\\d+(?:\\s*(?:[-–—]|\\.\\.\\.?)\\s*\\d+)?)*)(?![\\p{N}])`,
  "u",
);
/** A joining word or a comma right before an image word: where the words go on to another book's images. */
const LIST_JOIN = new RegExp(`\\s*(?:&|${NB}(?:a|i|and|und|oraz)${NA})\\s*`, "gu");
/** A book's ID with its images' numbers, as --images writes them (folded): "b0001:20-22", "b0002: 5–6". */
const ID_IMAGES_SRC = `${NB}b\\d{4,}\\s*:(?=\\s*\\d)`;
const ID_IMAGES_RE = new RegExp(ID_IMAGES_SRC, "gu");
/**
 * Where the words go on to another book's images: a joining word or a comma before an image word, or before a book's
 * ID with its numbers — the ID with its numbers after a space alone too ("B0001:20-22 B0002:5-6").
 */
const JOIN_RE = new RegExp(`(?:(?<=\\s)(?:a|i|and|und|oraz)\\s+|,\\s*)(?=${IMAGE_SRC}|${ID_IMAGES_SRC})|(?<=\\s)(?<!(?:,|${NB}(?:a|i|and|und|oraz))\\s+)(?=${ID_IMAGES_SRC})`, "gu");
const URL_G = /https?:\/\/[^\s<>"'“”‚‘’)\]]+/giu;
const BOOK_ID_IN = /(?<![\p{L}\p{M}\p{N}])B\d{4,}(?![\p{L}\p{M}\p{N}])/gu;
/** A book's ID alone, as a name: the research has no book of it. */
const ID_ONLY = /^B\d{4,}$/u;
/** A list's numbers: "1) … 2) …", "1. … 2. …". */
const LIST_RE = /(?:^|[\s:;(])(\d{1,2})[.)](?=\s)/gu;
/** Where a book's name begins after its words: "z knihy Vranov 9", "of the book …", "aus dem Buch …". */
const NAME_AFTER = /(?<![\p{L}\p{M}\p{N}])(?:ze? knihy|v knize|knihy|z matriky|v matrice|of the book|from the book|in the book|aus dem buch|im buch|z księgi|w księdze)\s+/iu;
const NAME_AT = /(?<![\p{L}\p{M}\p{N}])(?:kniha|matrika|book|buch|księga)\s+/iu;

const trimUrl = (u: string) => u.replace(/[.,;:!?]+$/u, "");

/** A link compared as a book's: no scheme, no "www.", no "/" at its end. */
function bareUrl(u: string): string {
  return u.trim().replace(/^https?:\/\//iu, "").replace(/^www\./iu, "").replace(/\/+$/u, "").toLowerCase();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The books of a research, as the words of a wait may name them. */
export interface BookIndex {
  byUrl: { url: string; id: string }[];
  /** Each name's pattern (global, without its bounds: asked through nameAt). */
  byText: { re: RegExp; id: string; len: number }[];
  /** The names by their first word (letters, marks, digits up to anything else): a text without it is not asked them. */
  byHead: Map<string, BookIndex["byText"]>;
}

/** The words of a folded text, split where no letter, mark or digit goes on: what a book's name may begin with. */
const WORD_SPLIT = /[^\p{L}\p{M}\p{N}]+/u;
const LEADING_WORD = /^[\p{L}\p{M}\p{N}]*/u;
const LMN = /[\p{L}\p{M}\p{N}]/u;

/**
 * Where a book's name stands in a folded text as words of their own (no letter, mark or digit just before or after it).
 * Its pattern has no classes of letters of every script: such a pattern costs half a millisecond to make and again to
 * run first — hundreds of books, a second and a half for every look of the bridge (found measuring spec 109's audit).
 */
function nameAt(re: RegExp, plain: string): number | undefined {
  re.lastIndex = 0;
  for (let m = re.exec(plain); m; m = re.exec(plain)) {
    const before = m.index > 0 ? String.fromCodePoint([...plain.slice(Math.max(0, m.index - 2), m.index)].at(-1)!.codePointAt(0)!) : "";
    const end = m.index + m[0].length;
    const after = end < plain.length ? String.fromCodePoint(plain.codePointAt(end)!) : "";
    if (!LMN.test(before) && !LMN.test(after)) return m.index;
    re.lastIndex = m.index + 1;
  }
  return undefined;
}

/** The books of the research as they stand (none taken back or merged), by link and by name, once per look. */
export function bookIndex(tree: Tree): BookIndex {
  const books = tree.list<RecordSet>("recordset").filter((b) => !b.retracted && !b.mergedInto);
  const byUrl = books.filter((b) => b.url && URL.canParse(b.url)).map((b) => ({ url: bareUrl(b.url!), id: b.id })).filter((x) => x.url.includes("/"));
  // a name, its part before the first comma, a call number: only one with a letter and a digit ("Lhota 3", not "Lhota")
  const names = new Map<string, Set<string>>();
  for (const b of books) {
    const comma = b.title.indexOf(",");
    for (const n of [b.title, comma > 0 ? b.title.slice(0, comma) : undefined, b.callNumber]) {
      if (!n) continue;
      const key = foldText(n.normalize("NFC")).replace(/[-–—‐‑]+/gu, " ").replace(/\s+/gu, " ").trim();
      if (!key || !/\p{L}/u.test(key) || !/\p{N}/u.test(key)) continue;
      names.set(key, (names.get(key) ?? new Set()).add(b.id));
    }
  }
  const byText: BookIndex["byText"] = [];
  const byHead: BookIndex["byHead"] = new Map();
  for (const [key, ids] of names) {
    // the same words for two books say neither
    if (ids.size !== 1) continue;
    const src = key.split(" ").map(escapeRe).join("[\\s\\-–—‐‑]+");
    byText.push({ re: new RegExp(src, "gu"), id: [...ids][0]!, len: key.length });
    const head = LEADING_WORD.exec(key)![0];
    if (!byHead.has(head)) byHead.set(head, []);
    byHead.get(head)!.push(byText.at(-1)!);
  }
  return { byUrl, byText, byHead };
}

/** The book of the research a link is of: the same link, or one deeper in it. */
function bookOfUrl(index: BookIndex, url: string): string | undefined {
  const u = bareUrl(url);
  let best: { url: string; id: string } | undefined;
  for (const b of index.byUrl) {
    if (u === b.url || (u.startsWith(b.url) && "/?#".includes(u[b.url.length]!))) if (!best || b.url.length > best.url.length) best = b;
  }
  return best?.id;
}

interface Span {
  start: number;
  end: number;
}

/** A wait's words by book: its groups of parts, a list's heading (about all of its books) and whether it is a list. */
interface Layout {
  groups: Span[][];
  heading?: Span;
  list: boolean;
}

/**
 * Where a list's last item ends before words about all of its books ("4) … snímky let 1795–1812. U každé knihy zapsat
 * její id a rozsah."): a sentence's end (no short word's dot: "sv. Jakuba", "r. 1786") after which no image is named
 * and no link given.
 */
function closingAt(text: string, item: Span): number | undefined {
  let depth = 0;
  for (let i = item.start; i < item.end; i++) {
    const c = text[i]!;
    if (c === "(" || c === "[") depth++;
    else if ((c === ")" || c === "]") && depth > 0) depth--;
    else if (depth === 0 && ".!?…".includes(c)) {
      const m = /^\s+(?=\p{Lu})/u.exec(text.slice(i + 1, item.end));
      if (!m) continue;
      const word = /[\p{L}\p{M}\p{N}]*$/u.exec(text.slice(item.start, i))![0];
      if (c === "." && !/^\p{N}+$/u.test(word) && [...word].length < 3 && !/[)\]]$/u.test(text.slice(item.start, i))) continue;
      const tail = text.slice(i + 1, item.end);
      if (/https?:\/\//iu.test(tail)) continue;
      if (!IMAGE_ONE.test(mask(foldText(tail)))) return i + 1 + m[0].length;
    }
  }
  return undefined;
}

/** The text split where it is about another book: a numbered list, ";", a joining word before another image word. */
function spans(text: string): Layout {
  // the list's items, numbered 1, 2, 3… in their order
  const cuts: number[] = [];
  let want = 1;
  for (const m of text.matchAll(LIST_RE)) {
    if (Number(m[1]) !== want) continue;
    cuts.push(m.index! + m[0].indexOf(m[1]!));
    want++;
  }
  const items: Span[] = [];
  // a list's heading ("Images of four books: 1) …") is about all of them: no book of its own
  const list = cuts.length >= 2;
  const heading = list && text.slice(0, cuts[0]!).trim() ? { start: 0, end: cuts[0]! } : undefined;
  const at = list ? [...cuts, text.length] : [0, text.length];
  for (let i = 0; i + 1 < at.length; i++) if (at[i + 1]! > at[i]!) items.push({ start: at[i]!, end: at[i + 1]! });
  // the words after a list's last item about all of its books: a part of their own, of no book
  const last = list ? items.at(-1) : undefined;
  const closing = last ? closingAt(text, last) : undefined;
  if (last && closing !== undefined) items.splice(items.length - 1, 1, { start: last.start, end: closing }, { start: closing, end: last.end });
  // each item at ";" outside brackets
  const pieces: Span[] = [];
  for (const it of items) {
    let depth = 0;
    let from = it.start;
    for (let i = it.start; i < it.end; i++) {
      const c = text[i]!;
      if (c === "(" || c === "[") depth++;
      else if ((c === ")" || c === "]") && depth > 0) depth--;
      else if (c === ";" && depth === 0) {
        pieces.push({ start: from, end: i });
        from = i + 1;
      }
    }
    pieces.push({ start: from, end: it.end });
  }
  // each piece where the words go on to further images ("… a snímek 14 z knihy …"): a group of its own
  const groups = pieces.map((p) => {
    const part = text.slice(p.start, p.end);
    const folded = mask(foldText(part));
    const out: Span[] = [];
    let from = p.start;
    for (const m of folded.matchAll(JOIN_RE)) {
      const cut = p.start + unfoldIndex(part, m.index!);
      if (depthAt(text, p.start, cut) > 0 || cut <= from) continue;
      out.push({ start: from, end: cut });
      from = cut;
    }
    out.push({ start: from, end: p.end });
    return out;
  });
  return { groups, ...(heading ? { heading } : {}), list };
}

function depthAt(text: string, from: number, to: number): number {
  let depth = 0;
  for (let i = from; i < to; i++) {
    const c = text[i]!;
    if (c === "(" || c === "[") depth++;
    else if ((c === ")" || c === "]") && depth > 0) depth--;
  }
  return depth;
}

/** A folded text with its links blanked out (as long as they were): an image word in a link is no image word. */
function mask(folded: string): string {
  return folded.replace(URL_G, (m) => "#".repeat(m.length));
}

/** The words of a part, cleaned: no list number, joining word or punctuation before them, none after; first letter capital. */
function cleaned(s: string): string {
  let t = s.trim().replace(/^\d{1,2}[.)]\s*/u, "").replace(/^[,;:–—-]+\s*/u, "");
  t = t.replace(/^(?:a|i|and|und|oraz)\s+/iu, "").replace(/[\s,;:–—-]+$/u, "").trim();
  const first = [...t][0];
  return first ? first.toLocaleUpperCase() + t.slice(first.length) : t;
}

/** What a part of a wait's words says: its images, their numbers, the book it names. */
interface ReadPart {
  part: WaitPart;
  /** Names a book by a word (kniha, Buch, book, księga…). */
  bookWord: boolean;
  /** The name of a book its words give, when it names none of the research. */
  said?: { name: string; named: boolean };
  /** A link of none of the research's books. */
  foreign?: string;
}

function readPart(text: string, index: BookIndex, tree: Tree): ReadPart {
  const raw = text;
  const folded = mask(foldText(raw));
  const numbers = new Set<number>();
  let images = false;
  for (const m of folded.matchAll(IMAGE_RE)) {
    images = true;
    // "≈ sn. 160", "asi snímek 40": an image still to be found, its number guessed
    if (ESTIMATE_BEFORE.test(folded.slice(0, m.index!))) continue;
    const after = NUMBERS_AFTER.exec(folded.slice(m.index! + m[0].length));
    if (!after) continue;
    const list = after[1]!.replace(LIST_JOIN, ",").replace(/—/gu, "-");
    for (const n of parseImageList(list) ?? []) numbers.add(n);
  }
  // a book's ID with its numbers ("B0001:20-22", as --images writes them): images of that book by their numbers
  for (const m of folded.matchAll(ID_IMAGES_RE)) {
    const after = NUMBERS_AFTER.exec(folded.slice(m.index! + m[0].length));
    if (!after) continue;
    images = true;
    const list = after[1]!.replace(LIST_JOIN, ",").replace(/—/gu, "-");
    for (const n of parseImageList(list) ?? []) numbers.add(n);
  }
  const bookWord = BOOK_RE.test(folded);
  const urls = [...raw.matchAll(URL_G)].map((m) => ({ url: trimUrl(m[0]), at: m.index! }));
  // the book of the research it names first: by its ID, its link, its name or call number
  const found: { id: string; at: number; len: number }[] = [];
  // an ID of no record set of the research at all ("B0009"): a book it does not have, named by that ID alone
  let missingId: string | undefined;
  for (const m of raw.matchAll(BOOK_ID_IN)) {
    const b = liveBook(tree, m[0]);
    if (b) found.push({ id: b.id, at: m.index!, len: m[0].length });
    else if (!tree.get(m[0])) missingId ??= m[0];
  }
  for (const u of urls) {
    const id = bookOfUrl(index, u.url);
    if (id) found.push({ id, at: u.at, len: u.url.length });
  }
  const plain = foldText(raw);
  // a name is asked only of words its first word is among (hundreds of books, each a pattern: found 30 ms a /status);
  // a name beginning with no letter or digit (head "") of every text
  const asked = [...new Set(["", ...plain.split(WORD_SPLIT)])].flatMap((w) => index.byHead.get(w) ?? []);
  for (const n of asked) {
    const at = nameAt(n.re, plain);
    if (at !== undefined) found.push({ id: n.id, at: unfoldIndex(raw, at), len: n.len });
  }
  found.sort((a, b) => a.at - b.at || b.len - a.len);
  const book = found[0]?.id;
  const foreign = urls.find((u) => !bookOfUrl(index, u.url));
  // a book it does not have: a link not of the research's books, or a name after a book word that has a letter and a
  // digit as a book's name does ("Vranov 9, O 1801–1850", "kniha zemřelých Lhoty po r. 1786") — never "knihy narozených"
  const byName = !book && (images || bookWord) ? bookName(raw) : undefined;
  const said = byName && !byName.named && missingId ? { name: missingId, named: true } : byName;
  const unknown = said && (foreign || (said.named && HAS_LETTER.test(said.name) && HAS_DIGIT.test(said.name))) ? said.name : undefined;
  return {
    part: {
      text: cleaned(raw),
      images,
      numbers: [...numbers].sort((a, b) => a - b),
      ...(book ? { book } : {}),
      ...(unknown ? { unknown, ...(foreign ? { url: foreign.url } : {}) } : {}),
    },
    bookWord,
    ...(said ? { said } : {}),
    ...(foreign ? { foreign: foreign.url } : {}),
  };
}

/** Stands in for a link or a bracket's words, as long as they were: where a book's name ends. */
const NAME_END = "\u0001";

/**
 * The name of a book the research does not have, as the words give it: after "z knihy …" up to a link, a bracket or a
 * dash where they stood ("Vranov 9, O 1801–1850 (https://…) k ručnímu uložení" → "Vranov 9, O 1801–1850"), else the words.
 */
function bookName(raw: string): { name: string; named: boolean } {
  // what is said in brackets is a note on the book ("(its number to be found at the parish)"), never its name; a link
  // is where it is, never its name: both blanked out as long as they were, so the name ends where they began
  const marked = raw
    .replace(URL_G, (m) => NAME_END.repeat(m.length))
    .replace(/\([^()]*\)|\[[^[\]]*\]/gu, (m) => NAME_END.repeat(m.length))
    .replace(/[()[\]]/gu, NAME_END);
  const after = NAME_AFTER.exec(marked);
  const at = NAME_AT.exec(marked);
  // the first of them: "4) kniha zemřelých fary Podhradí od 1782 … U každé knihy …" is the book of "kniha", not of "knihy"
  const from = after && (!at || after.index <= at.index) ? after.index + after[0].length : at ? at.index : -1;
  let name = from >= 0 ? nameOnly(marked.slice(from).split(NAME_END)[0]!.split(/\s[–—]\s/u)[0]!) : "";
  const named = !!cleaned(name);
  // no words of a book's name before the first link or bracket: the words of the part, without them
  if (!named) name = marked.split(new RegExp(`${NAME_END}+`, "u")).join(" ");
  name = cleaned(name.replace(/\s+/gu, " "));
  return { name: [...name].length > 80 ? [...name].slice(0, 79).join("").trimEnd() + "…" : name, named };
}

/**
 * What is to be done with the images, after a book's name (folded, whole words): "uložit ručně", "ručně stáhnout",
 * "save by hand", "to be downloaded", "von Hand speichern", "zapisać ręcznie" — never words of the name.
 */
const TO_DO_WORDS =
  "ulozit|ulozeni|ulozi|ulozeny|ulozene|rucne|rucni|rucnimu|rucniho|stahnout|stazeni|stahnuti|stahne|stazeny|stazene|" +
  "stiahnut|stiahnutie|ulozenie|" +
  "save|saved|saving|download|downloaded|downloading|manually|by hand|" +
  "speichern|gespeichert|herunterladen|heruntergeladen|manuell|handisch|von hand|" +
  "zapisac|zapisane|zapisany|zachowac|pobrac|pobrane|pobrany|sciagnac|sciagniete|recznie|reczne";
const TO_DO_RE = new RegExp(`${NB}(?:${TO_DO_WORDS})${NA}`, "u");
/** Words that stand before what is to be done (folded): left off a name with it. */
const BEFORE_TO_DO = new Set(
  "k ke ku pro na a i to be is are must need needs have has for and zu zum zur und muss mussen sollen soll do oraz trzeba nalezy nutno treba potreba musi maji ma je jsou se sa".split(" "),
);

/**
 * A book's name without the words after it of what is to be done with its images ("Lhota 5 uložit ručně" →
 * "Lhota 5"); an ID with its numbers, the ID alone ("B0009:7-9" → "B0009").
 */
function nameOnly(name: string): string {
  const id = /^\s*(B\d{4,})(?![\p{L}\p{M}\p{N}])/u.exec(name);
  if (id) return id[1]!;
  const folded = foldText(name);
  const m = TO_DO_RE.exec(folded);
  if (!m) return name;
  let out = name.slice(0, unfoldIndex(name, m.index));
  for (;;) {
    const last = /[\p{L}\p{M}\p{N}]+[^\p{L}\p{M}\p{N}]*$/u.exec(out);
    if (!last || !BEFORE_TO_DO.has(foldText(last[0]).replace(/[^\p{L}\p{M}\p{N}]+$/u, ""))) break;
    out = out.slice(0, last.index);
  }
  return out;
}

const TO_DO_G = new RegExp(`${NB}(?:${TO_DO_WORDS})${NA}`, "gu");

/**
 * Whether the words given to a book's task say no more than its images by the book's ID with their numbers and what is
 * to be done with them ("B0002:5-6 uložit ručně", "Snímky B0001:20-22"): then the fix says them by the book's title
 * (the task waits for them already) — any other words (a note, another book) are kept as they stood.
 */
function idImagesOnly(words: string, id: string): boolean {
  const raw = words.normalize("NFC");
  const ids = [...raw.matchAll(BOOK_ID_IN)].map((m) => m[0]);
  if (!ids.length || ids.some((x) => x !== id)) return false;
  const folded = mask(foldText(raw));
  let rest = "";
  let from = 0;
  for (const m of folded.matchAll(ID_IMAGES_RE)) {
    const after = NUMBERS_AFTER.exec(folded.slice(m.index! + m[0].length));
    if (!after) return false;
    rest += folded.slice(from, m.index!);
    from = m.index! + m[0].length + after[0].length;
  }
  if (!from) return false;
  rest = `${rest} ${folded.slice(from)}`.replace(IMAGE_RE, " ").replace(TO_DO_G, " ");
  return rest.split(WORD_SPLIT).every((w) => !w || BEFORE_TO_DO.has(w));
}

/** A book's images as the fix says them, in the research language: its title, never its ID. */
function imagesWords(tree: Tree, b: RecordSet, images: string): string {
  return phrase(tree.lang, "audit.wait.images", { images, book: b.title });
}

const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\p{N}/u;

/**
 * A wait's words read by book: each part about one book (a numbered list, ";", "… a snímek 14 z knihy …"), a part of
 * the words naming no book joined to the one before it (else after it). A wait naming images by their numbers but no book
 * at all: the book it is written for, else the book of its link (wait.url) when that is one of the research's, else the
 * one book its where names.
 */
export function readWait(tree: Tree, t: Pick<Task, "waitingOn" | "wait" | "where" | "awaits">, index: BookIndex = bookIndex(tree)): WaitPart[] {
  const text = (t.waitingOn ?? "").normalize("NFC");
  const parts: WaitPart[] = [];
  const read: ReadPart[] = [];
  for (const group of spans(text).groups) {
    let each = group.map((s) => ({ span: s, r: readPart(text.slice(s.start, s.end), index, tree) }));
    const named = (r: ReadPart) => !!(r.part.book || r.part.unknown);
    // a part naming no book belongs to its neighbour
    for (let i = 1; i < each.length; ) {
      if (named(each[i]!.r)) {
        i++;
        continue;
      }
      const span = { start: each[i - 1]!.span.start, end: each[i]!.span.end };
      each.splice(i - 1, 2, { span, r: readPart(text.slice(span.start, span.end), index, tree) });
    }
    if (each.length > 1 && !named(each[0]!.r)) {
      const span = { start: each[0]!.span.start, end: each[1]!.span.end };
      each = [{ span, r: readPart(text.slice(span.start, span.end), index, tree) }, ...each.slice(2)];
    }
    for (const e of each) {
      if (!e.r.part.text) continue;
      e.r.part.span = e.span;
      parts.push(e.r.part);
      read.push(e.r);
    }
  }
  // a wait of several books: a part naming images and a book in words, of no book of the research and with no number in
  // its name ("4) kniha zemřelých fary Podhradí – rejstřík nebo snímky let 1795–1812"), is a book the research does not
  // have — never left of no book
  if (parts.some((p) => p.book || p.unknown))
    for (const r of read) {
      const p = r.part;
      if (!p.images || !r.bookWord || p.book || p.unknown || !r.said?.named) continue;
      p.unknown = r.said.name;
      if (r.foreign) p.url = r.foreign;
    }
  // the book the wait is written for (--images B…, --kind web --book B…): words naming no book of the research and one
  // book alone it does not know are that book's, said in other words ("snímky 1–2 knihy narozených", its archive's link)
  const ownId = t.awaits?.recordset ?? t.wait?.book;
  const own = ownId ? liveBook(tree, ownId)?.id : undefined;
  if (own && !parts.some((p) => p.book)) {
    const others = new Set(parts.filter((p) => p.images && p.unknown).map((p) => foldText(p.unknown!)));
    if (others.size <= 1)
      for (const p of parts) {
        if (!p.unknown) continue;
        delete p.unknown;
        delete p.url;
        if (p.images) p.book = own;
      }
  }
  // images named by their numbers and no book: the book of its link, else the one book its where names — images named
  // without numbers and no book ("a decision on the archive's images") are no wait for images of a book
  if (!parts.some((p) => p.book || p.unknown)) {
    const first = own ? parts.find((p) => p.images) : parts.find((p) => p.images && p.numbers.length);
    const byUrl = t.wait?.url ? bookOfUrl(index, t.wait.url) : undefined;
    const book = own ?? byUrl ?? (t.where ? singleBook(tree, t as Task)?.id : undefined);
    if (first && book) first.book = book;
  }
  return parts;
}

/** A hash of what a task waits for: the person's keeping holds while it is the same. */
export function waitHash(t: Pick<Task, "waitingOn" | "wait" | "awaits">): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ waitingOn: t.waitingOn ?? null, wait: t.wait ?? null, awaits: t.awaits ?? null }))
    .digest("hex")
    .slice(0, 16);
}

/** Whether a task's wait is checked: waiting, not for a check or a decision, its kind not said to be other than images. */
export function audited(t: Task): boolean {
  if (t.state !== "waiting" || t.retracted || t.awaitsCheck || t.awaitsPermission) return false;
  const k = t.wait?.kind;
  return !(k === "letter" || k === "family" || k === "other");
}

/** The images of a book named by a part, the book's parts in order: what the wait wants. */
interface Wanted {
  book?: string;
  unknown?: string;
  url?: string;
  numbers: number[];
  text: string;
}

function wantedOf(parts: WaitPart[]): Wanted[] {
  const out: Wanted[] = [];
  for (const p of parts) {
    if (!p.images || !(p.book || p.unknown)) continue;
    const same = out.find((w) => (p.book ? w.book === p.book : w.unknown !== undefined && foldText(w.unknown) === foldText(p.unknown!)));
    if (same) {
      same.numbers = [...new Set([...same.numbers, ...p.numbers])].sort((a, b) => a - b);
      continue;
    }
    out.push({ ...(p.book ? { book: p.book } : { unknown: p.unknown!, ...(p.url ? { url: p.url } : {}) }), numbers: p.numbers, text: p.text });
  }
  return out;
}

/** A book the research does not have, as a key beside the research's books' IDs. */
const unknownKey = (name: string) => `?${foldText(name)}`;
const keyOf = (p: { book?: string | undefined; unknown?: string | undefined }) => p.book ?? (p.unknown !== undefined ? unknownKey(p.unknown) : undefined);

/**
 * A wait's words given out by the fix (nothing of them lost): `key` a book's (its ID, or unknownKey of one the research
 * does not have) — its parts, after the list's heading; none — the task's own: its book's parts and every part of no book
 * it wants images of (a note, the list's closing words), in their order, as they stood.
 */
function wordsFor(waitingOn: string, parts: WaitPart[], key: string | undefined, own: string | undefined): string {
  const text = waitingOn.normalize("NFC");
  const layout = spans(text);
  const wanted = new Set(wantedOf(parts).map(keyOf));
  const ownerOf = (p: WaitPart) => {
    const k = keyOf(p);
    return k !== undefined && wanted.has(k) ? k : undefined;
  };
  const mine = (p: WaitPart) => (key === undefined ? ownerOf(p) === undefined || ownerOf(p) === own : ownerOf(p) === key);
  // the parts next to each other kept together, as they stood ("1) Lhota 01 (id 7310), snímky 41–60 …, do B0201")
  const ranges: Span[] = [];
  let open: Span | undefined;
  for (const p of parts.filter((x) => x.span).sort((x, y) => x.span!.start - y.span!.start)) {
    if (mine(p)) open = open ? { start: open.start, end: p.span!.end } : { ...p.span! };
    else if (open) {
      ranges.push(open);
      open = undefined;
    }
  }
  if (open) ranges.push(open);
  let out = "";
  for (const r of ranges) {
    const s = text.slice(r.start, r.end).trim().replace(/[\s;,]+$/u, "");
    if (!s) continue;
    out = !out ? s : `${out}${/[.!?…:]$/u.test(out) ? " " : /^\p{Lu}/u.test(s) ? ". " : "; "}${s}`;
  }
  if (!out) return "";
  if (!layout.list) return cleaned(out);
  const heading = layout.heading ? text.slice(layout.heading.start, layout.heading.end).trim() : "";
  const whole = heading ? `${heading} ${out}` : out;
  const first = [...whole][0]!;
  return first.toLocaleUpperCase() + whole.slice(first.length);
}

/** The findings of a task's wait as it is (or as it would be: `t` need not be written). Folder: only with `shared`. */
export function findingsOf(tree: Tree, t: Task, o: { shared?: string | undefined; index?: BookIndex; parts?: WaitPart[] } = {}): AuditFinding[] {
  if (!audited(t)) return [];
  const parts = o.parts ?? readWait(tree, t, o.index);
  const wanted = wantedOf(parts);
  const out: AuditFinding[] = [];
  const known = wanted.filter((w) => w.book).map((w) => w.book!);
  const unknown = wanted.filter((w) => w.unknown);
  const iw = inboxWaitOf(tree, t);
  if (t.awaits) {
    const own = liveBook(tree, t.awaits.recordset)?.id ?? t.awaits.recordset;
    const others = known.filter((b) => b !== own);
    if (others.length || unknown.length) out.push({ kind: "several-books", books: [own, ...others], ...(unknown.length ? { unknown: unknown.map((u) => u.unknown!) } : {}) });
  } else {
    // images of a book in words alone — unless it waits by its one book and its words name no number of that book's
    // images: images saved for that book bring it back (any of them, "Snímky 10–12" too: then its images by their numbers)
    const byBook = iw?.by === "web" && unknown.length === 0 && known.every((b) => b === iw.recordset) && !wanted.some((w) => w.book === iw.recordset && w.numbers.length);
    if (known.length && !byBook) out.push({ kind: "images-as-text", books: known });
    if (wanted.length >= 2) out.push({ kind: "several-books", books: known, ...(unknown.length ? { unknown: unknown.map((u) => u.unknown!) } : {}) });
  }
  if (unknown.length) {
    const url = unknown.find((u) => u.url)?.url;
    out.push({ kind: "book-unknown", unknown: unknown.map((u) => u.unknown!), ...(url ? { url } : {}) });
  }
  // its folder missing: only of a wait otherwise as strom needs it (a wait written again by the fix gets its folder)
  const rewritten = out.some((f) => f.kind === "images-as-text" || f.kind === "several-books");
  if (o.shared && iw && !rewritten && !fs.existsSync(path.join(o.shared, "inbox", iw.folder))) out.push({ kind: "folder-missing", books: [iw.recordset] });
  return out;
}

/** The fix strom proposes for a task's wait: the book it keeps, a task of its own for each other book, the folder. */
export function fixOf(tree: Tree, t: Task, findings: AuditFinding[], parts: WaitPart[]): AuditFix {
  const stamp = `${t.id}@${t.updated}`;
  const kinds = new Set(findings.map((f) => f.kind));
  const changes: AuditChange[] = [];
  const left = new Set<AuditKind>();
  if (!findings.length) return { can: "none", stamp, changes, left: [] };
  const wanted = wantedOf(parts);
  const title = (id: string) => liveBook(tree, id)?.title ?? id;
  const folder = (id: string) => {
    const b = liveBook(tree, id);
    return b ? inboxFolderFor(b) : id;
  };
  const own = t.awaits ? (liveBook(tree, t.awaits.recordset)?.id ?? t.awaits.recordset) : wanted.find((w) => w.book)?.book;
  const rewrites = kinds.has("images-as-text") || kinds.has("several-books");
  if (own && rewrites) {
    const mine = wanted.find((w) => w.book === own);
    // the task's own book: its images by their numbers, else by the book (its words then name that book alone)
    if (t.awaits) changes.push({ op: "wait-images", task: t.id, book: own, title: title(own), images: t.awaits.images, folder: t.awaits.folder });
    else {
      if (mine?.numbers.length) changes.push({ op: "wait-images", task: t.id, book: own, title: title(own), images: runs(mine.numbers), folder: folder(own) });
      else changes.push({ op: "wait-book", task: t.id, book: own, title: title(own), folder: folder(own) });
    }
    for (const w of wanted) {
      if (w.book === own) continue;
      if (w.book)
        changes.push({
          op: "split",
          task: null,
          from: t.id,
          book: w.book,
          title: title(w.book),
          ...(w.numbers.length ? { images: runs(w.numbers) } : {}),
          folder: folder(w.book),
          waits: w.numbers.length ? "images" : "book",
        });
      else {
        changes.push({ op: "split", task: null, from: t.id, title: w.unknown!, ...(w.numbers.length ? { images: runs(w.numbers) } : {}), ...(w.url ? { url: w.url } : {}), waits: "text" });
        left.add("book-unknown");
      }
    }
  } else if (kinds.has("book-unknown") || kinds.has("several-books")) {
    // only books the research does not have: a record set of each first — the agent's work
    for (const k of kinds) if (k !== "folder-missing") left.add(k);
  }
  const iw = inboxWaitOf(tree, t);
  if (kinds.has("folder-missing") && iw && !changes.some((c) => c.op === "wait-images" || c.op === "wait-book"))
    changes.push({ op: "folder", task: t.id, book: iw.recordset, folder: iw.folder });
  // what no change takes away
  if (!changes.length) for (const k of kinds) left.add(k);
  return { can: !changes.length ? "none" : left.size ? "part" : "whole", stamp, changes, left: [...left] };
}

/** The person's keeping, while it holds: the same wait, nothing found it did not know of. */
function keptOf(t: Task, findings: AuditFinding[]): TaskAudit["kept"] {
  const k = t.auditKept;
  if (!k || k.wait !== waitHash(t) || !findings.every((f) => k.kinds.includes(f.kind))) return null;
  return { at: k.at, by: k.by, kinds: k.kinds };
}

/** The audit's fix that can still be undone: none of its tasks changed since. */
export function fixedOf(tree: Tree, t: Task): TaskAudit["fixed"] {
  const f = t.auditFix;
  if (!f) return null;
  return changedSince(tree, f).length ? null : { at: f.at, made: f.made };
}

function changedSince(tree: Tree, f: TaskAuditFix): string[] {
  return Object.entries(f.after)
    .filter(([id, at]) => tree.get<Task>(id)?.updated !== at)
    .map(([id]) => id);
}

/** A task's wait checked: what is found, the fix, whether the person kept it, whether a fix can be undone. */
export function auditOf(tree: Tree, t: Task, o: { shared?: string | undefined; index?: BookIndex } = {}): TaskAudit {
  const parts = audited(t) ? readWait(tree, t, o.index) : [];
  const findings = audited(t) ? findingsOf(tree, t, { ...o, parts }) : [];
  return { task: t.id, at: t.updated, findings, fix: fixOf(tree, t, findings, parts), kept: keptOf(t, findings), fixed: fixedOf(tree, t), parts };
}

/** Every waiting task's wait checked (only the ones with a finding; `all`: the kept ones too). */
export function auditTasks(tree: Tree, o: { shared?: string | undefined; all?: boolean } = {}): { tasks: TaskAudit[]; kept: number } {
  const index = bookIndex(tree);
  const out: TaskAudit[] = [];
  let kept = 0;
  for (const t of tree.list<Task>("task")) {
    if (!audited(t)) continue;
    const a = auditOf(tree, t, { shared: o.shared, index });
    if (!a.findings.length) continue;
    if (a.kept) kept++;
    if (!a.kept || o.all) out.push(a);
  }
  return { tasks: out, kept };
}

/** What the agent is to run for a task's wait, book by book: the exact commands. */
export function waitCommands(tree: Tree, t: Task, parts: WaitPart[]): string[] {
  const wanted = wantedOf(parts);
  const own = t.awaits ? (liveBook(tree, t.awaits.recordset)?.id ?? t.awaits.recordset) : undefined;
  const order = own ? [...wanted.filter((w) => w.book === own), ...wanted.filter((w) => w.book !== own)] : wanted;
  const out: string[] = [];
  const nonBooks = t.where.filter((w) => !/^B\d{4,}$/u.test(w.trim()));
  order.forEach((w, i) => {
    const wait = (id: string) =>
      w.book
        ? w.numbers.length
          ? `strom task wait ${id} --images ${w.book}:${runsArg(w.numbers)} --on ${shellArg(w.text)}`
          : `strom task wait ${id} --kind web --book ${w.book} --on ${shellArg(w.text)}`
        : `strom task wait ${id} --images B…:${w.numbers.length ? runsArg(w.numbers) : "<numbers>"} --on ${shellArg(w.text)}`;
    // a book named by an ID the research has none of: the book by its title (strom gives it its ID)
    const add = w.book
      ? ""
      : ID_ONLY.test(w.unknown!)
        ? `the research has no ${w.unknown}: strom recordset add "<the book's title>"${w.url ? ` --url ${w.url}` : ""} (the book first), then `
        : `strom recordset add ${shellArg(w.unknown!)}${w.url ? ` --url ${w.url}` : ""} (the book first), then `;
    if (i === 0 && !(own && w.book !== own)) {
      out.push(`${add}${wait(t.id)}`);
      return;
    }
    const where = [...nonBooks, ...(w.book ? [w.book] : ["B…"])].map((x) => `--where ${shellArg(x)}`).join(" ");
    const about = t.subject.map((s) => ` --about ${s}`).join("");
    out.push(
      `${add}one book per task: strom task add ${shellArg(t.what)} --level ${t.level} ${where} --why ${shellArg(t.why)} --done-when ${shellArg(t.doneWhen)}${about}${t.research ? ` --research ${t.research}` : ""} --priority ${t.priority} --anyway, then ${wait("<its T…>")}`,
    );
  });
  return out;
}

/**
 * strom task wait / edit before they write a wait (K1.1): a wait for images not as strom needs it is refused — written,
 * images saved by hand would not bring the task back. Nothing found: nothing said. `images`: --images given (only
 * another book's images count).
 */
export function refuseWait(tree: Tree, t: Task): void {
  if (!audited(t)) return;
  const index = bookIndex(tree);
  const parts = readWait(tree, t, index);
  const found = findingsOf(tree, t, { index, parts }).filter((f) => f.kind !== "folder-missing");
  if (!found.length) return;
  const books = [...new Set(found.flatMap((f) => f.books ?? []))];
  const unknown = [...new Set(found.flatMap((f) => f.unknown ?? []))];
  const what = found.map((f) => f.kind).join(", ");
  const said = [
    found.some((f) => f.kind === "images-as-text") ? `images of ${books.join(", ")} named only in words — images saved by hand would not bring ${t.id} back` : undefined,
    found.some((f) => f.kind === "several-books") ? "images of several books in one wait — one book per task" : undefined,
    unknown.length ? `a book the research does not have: ${unknown.map((u) => `"${truncate(u, 60)}"`).join(", ")}` : undefined,
  ].filter(Boolean);
  throw new UsageError(`${t.id} not set waiting (${what}): ${said.join("; ")}`, {
    hint: lines(...waitCommands(tree, t, parts), `a letter, the family, anything else than images: --kind letter|family|other`),
    code: "task.wait-images",
    // params are strings (the catalogs' texts fill them in): the lists whole in details
    params: { task: t.id, books: books.join(", "), unknown: unknown.join("; ") },
    details: { task: t.id, books, unknown },
  });
}

function lines(...xs: (string | undefined)[]): string {
  return xs.filter(Boolean).join("\n");
}

/** One line for the agent of a task whose wait is not as strom needs it (task wait, park, session close). */
export function auditLine(tree: Tree, a: TaskAudit, t: Task): string {
  const cmds = waitCommands(tree, t, a.parts);
  const folder = a.fix.changes.find((c) => c.op === "folder");
  const how = cmds[0] ?? (folder ? `strom task audit ${a.task} --fix (makes the folder ${folder.folder})` : `strom task audit ${a.task}`);
  return `${a.task} wait not as strom needs it: ${a.findings.map((f) => f.kind).join(", ")} — ${how}${a.fix.can !== "none" ? ` (strom task audit ${a.task} --fix does it)` : ""}`;
}

/** The change a fix makes, said in a line (its op's summary). */
function changeSaid(c: AuditChange, made?: string): string {
  switch (c.op) {
    case "wait-images":
      return `${c.task} waits for images ${c.images} of ${c.book}`;
    case "wait-book":
      return `${c.task} waits by ${c.book}`;
    case "folder":
      return `${c.task} inbox folder of ${c.book}`;
    case "split":
      return `${made ?? "T…"} split for ${truncate(c.title, 40)}${c.images ? ` images ${c.images}` : ""}`;
  }
}

/** The fix said for a person or the agent in a few lines (strom task audit). */
export function changesSaid(fix: AuditFix): string[] {
  return fix.changes.map((c) => changeSaid(c));
}

/**
 * The fix of a task's wait written (strom task audit --fix): one operation under the tree's lock — the task waits for
 * one book's images (or by the book), each other book a task of its own (splitFrom), the old wait kept on the task for
 * undoing it. `expect`: the stamp the fix was proposed for; another — the task changed since: refused. The folders it
 * waits on are returned, for the command to make and take what lies there.
 */
export function applyAuditFix(tree: Tree, id: string, o: { by: string; givenIn?: "app" | undefined; expect?: string | undefined; shared?: string | undefined }): { task: Task; made: string[]; folders: string[]; summary: string } {
  return tree.atomically(() => {
    const t = tree.get<Task>(id);
    if (!t || t.retracted) throw new UsageError(`no task ${id}`, { code: "waiting.none", params: { task: id } });
    if (t.state !== "waiting") throw new UsageError(`${id} does not wait (it is ${t.state})`, { code: "task.not-waiting", params: { task: id } });
    const a = auditOf(tree, t, { shared: o.shared });
    if (o.expect !== undefined && o.expect !== a.fix.stamp)
      throw new UsageError(`${id} changed since the fix was proposed (${o.expect}, now ${a.fix.stamp})`, { hint: `strom task audit ${id}`, code: "audit.changed", params: { task: id, stamp: a.fix.stamp } });
    if (!a.findings.length || !a.fix.changes.length)
      throw new UsageError(`${id}: ${a.findings.length ? "nothing strom can fix by itself" : "its wait is as strom needs it"}`, {
        hint: a.findings.length ? auditLine(tree, a, t) : `strom task show ${id}`,
        code: "audit.none",
        params: { task: id },
      });
    const at = now();
    const before: TaskAuditFix["before"] = { ...(t.waitingOn !== undefined ? { waitingOn: t.waitingOn } : {}), ...(t.wait ? { wait: t.wait } : {}), ...(t.awaits ? { awaits: t.awaits } : {}), where: [...t.where] };
    const own = a.fix.changes.find((c) => c.op === "wait-images" || c.op === "wait-book")?.book;
    // the words given out: each task its book's parts, the task the words of no book besides (as they stood, in order)
    const textOf = (key: string | undefined) => wordsFor(t.waitingOn ?? "", a.parts, key, own);
    const nonBooks = t.where.filter((w) => !/^B\d{4,}$/u.test(w.trim()));
    // the wait kept, its kind and book left to the change: --images says the kind, the book is the one of its images
    const rest = (w: Task["wait"]) => {
      const { kind: _k, book: _b, ...r } = w ?? {};
      return Object.keys(r).length ? r : undefined;
    };
    const next: Task = structuredClone(t);
    const made: string[] = [];
    const folders = new Set<string>();
    const said: string[] = [];
    const splits: Task[] = [];
    for (const c of a.fix.changes) {
      if (c.op === "wait-images" || c.op === "wait-book") {
        const b = liveBook(tree, c.book)!;
        const words = textOf(undefined);
        // its images by the book's ID alone in its words ("Snímky B0001:20-22"): said by the book's title instead
        next.waitingOn = c.op === "wait-images" ? (words && !idImagesOnly(words, b.id) ? words : imagesWords(tree, b, c.images)) : words || b.title;
        const kept = rest(t.wait);
        if (c.op === "wait-images") {
          next.awaits = { recordset: b.id, images: c.images, folder: c.folder };
          if (kept) next.wait = kept;
          else delete next.wait;
        } else {
          delete next.awaits;
          next.wait = { ...kept, kind: "web", book: b.id };
        }
        if (!next.where.includes(b.id)) next.where = [...next.where, b.id];
        folders.add(c.folder);
        said.push(changeSaid(c));
      } else if (c.op === "folder") {
        folders.add(c.folder);
        said.push(changeSaid(c));
      } else {
        const sid = tree.allocate("T");
        const b = c.book ? liveBook(tree, c.book) : undefined;
        const words = textOf(c.book ?? unknownKey(c.title));
        // another book's images by its ID and what is to be done with them ("B0002:5-6 uložit ručně"): by its title, as
        // the task's own — the task waits for them already
        const text = b && c.waits === "images" && (!words || idImagesOnly(words, b.id)) ? imagesWords(tree, b, c.images!) : words || c.title;
        const split: Task = {
          id: sid,
          type: "task",
          level: t.level,
          priority: t.priority,
          what: t.what,
          where: b ? [...nonBooks, b.id] : nonBooks.length ? nonBooks : [c.title],
          why: t.why,
          doneWhen: t.doneWhen,
          subject: [...t.subject],
          ...(t.research ? { research: t.research } : {}),
          ...(t.helps ? { helps: t.helps } : {}),
          state: "waiting",
          waitingOn: text,
          ...(c.waits === "images" && b ? { awaits: { recordset: b.id, images: c.images!, folder: c.folder! } } : {}),
          ...(c.waits === "book" && b ? { wait: { kind: "web" as const, book: b.id } } : {}),
          ...(c.waits === "text" ? { wait: { kind: "web" as const, ...(c.url && URL.canParse(c.url) ? { url: new URL(c.url).href } : {}) } } : {}),
          splitFrom: t.id,
          origin: t.origin,
          notes: [],
          created: at,
          updated: at,
        };
        if (c.folder) folders.add(c.folder);
        made.push(sid);
        splits.push(split);
        said.push(changeSaid(c, sid));
      }
    }
    delete next.auditKept;
    next.auditFix = { at, by: o.by, ...(o.givenIn ? { givenIn: o.givenIn } : {}), before, made, after: {} };
    next.updated = at;
    const summary = `${id} wait rewritten by the audit: ${said.join("; ")}`;
    const op = { op: "task.audit-fix", targets: [id, ...made], summary };
    for (const s of splits) tree.put(s, op);
    tree.put(next, op);
    return { task: next, made, folders: [...folders], summary };
  });
}

/**
 * After the fix took what lay in its folders (a task woken by them changed): the tasks as they are now noted on the
 * fixed one — undoing it checks none changed since. Written with the fix's own op, the task's time unchanged.
 */
export function sealAuditFix(tree: Tree, id: string, summary: string): void {
  tree.withTreeLock(() => {
    const t = tree.get<Task>(id);
    if (!t?.auditFix) return;
    const after: Record<string, string> = {};
    for (const x of [id, ...t.auditFix.made]) {
      const r = tree.get<Task>(x);
      if (r) after[x] = r.updated;
    }
    const next = { ...t, auditFix: { ...t.auditFix, after } };
    tree.put(next, { op: "task.audit-fix", targets: [id, ...t.auditFix.made], summary });
  });
}

/**
 * The audit's fix undone (strom task audit --unfix): only while none of its tasks changed since — the task waits as it
 * did, the tasks it made taken back (retracted, never deleted). The images it registered stay.
 */
export function undoAuditFix(tree: Tree, id: string): { task: Task; retracted: string[]; summary: string } {
  return tree.atomically(() => {
    const t = tree.get<Task>(id);
    if (!t || t.retracted) throw new UsageError(`no task ${id}`, { code: "waiting.none", params: { task: id } });
    const f = t.auditFix;
    if (!f) throw new UsageError(`${id}: no fix of the audit to undo`, { hint: `strom task audit ${id}`, code: "audit.none", params: { task: id } });
    const changed = changedSince(tree, f);
    if (changed.length)
      throw new UsageError(`${id}: the fix is not undone — changed since: ${changed.join(", ")}`, { hint: `strom task show ${id}`, code: "audit.changed", params: { task: id, changed: changed.join(", ") }, details: { task: id, changed } });
    const at = now();
    const summary = `${id} audit fix undone${f.made.length ? `: ${f.made.join(", ")} taken back` : ""}`;
    const op = { op: "task.audit-unfix", targets: [id, ...f.made], summary };
    for (const m of f.made) {
      const s = tree.get<Task>(m);
      if (!s || s.retracted) continue;
      const back: Task = { ...s, state: "dropped", retracted: { at, reason: "audit fix undone" }, updated: at };
      delete back.waitingOn;
      delete back.awaits;
      delete back.wait;
      tree.put(back, op);
    }
    const next: Task = { ...t, state: "waiting", where: [...f.before.where], updated: at };
    delete next.auditFix;
    for (const k of ["waitingOn", "wait", "awaits"] as const) {
      if (f.before[k] !== undefined) (next as unknown as Record<string, unknown>)[k] = structuredClone(f.before[k]);
      else delete next[k];
    }
    tree.put(next, op);
    return { task: next, retracted: f.made, summary };
  });
}

/** The person keeps a task's wait as it is (strom task audit --keep), or takes that back (`off`). */
export function keepAudit(tree: Tree, id: string, o: { by: string; givenIn?: "app" | undefined; expect?: string | undefined; off?: boolean; shared?: string | undefined }): { task: Task; summary: string } {
  return tree.atomically(() => {
    const t = tree.get<Task>(id);
    if (!t || t.retracted) throw new UsageError(`no task ${id}`, { code: "waiting.none", params: { task: id } });
    if (o.off) {
      if (!t.auditKept) throw new UsageError(`${id} is not kept as it is`, { code: "audit.none", params: { task: id } });
      const next: Task = { ...t, updated: now() };
      delete next.auditKept;
      const summary = `${id} wait no longer kept as it is`;
      tree.put(next, { op: "task.audit-unkeep", targets: [id], summary });
      return { task: next, summary };
    }
    if (t.state !== "waiting") throw new UsageError(`${id} does not wait (it is ${t.state})`, { code: "task.not-waiting", params: { task: id } });
    const a = auditOf(tree, t, { shared: o.shared });
    if (o.expect !== undefined && o.expect !== a.fix.stamp)
      throw new UsageError(`${id} changed since (${o.expect}, now ${a.fix.stamp})`, { hint: `strom task audit ${id}`, code: "audit.changed", params: { task: id, stamp: a.fix.stamp } });
    if (!a.findings.length) throw new UsageError(`${id}: its wait is as strom needs it — nothing to keep`, { code: "audit.none", params: { task: id } });
    const kinds = a.findings.map((f) => f.kind);
    const next: Task = { ...t, auditKept: { at: now(), by: o.by, ...(o.givenIn ? { givenIn: o.givenIn } : {}), kinds, wait: waitHash(t) }, updated: now() };
    const summary = `${id} wait kept as it is (${kinds.join(", ")})`;
    tree.put(next, { op: "task.audit-keep", targets: [id], summary });
    return { task: next, summary };
  });
}
