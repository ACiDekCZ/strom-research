// "How Strom works" — the documentation of the research and the Strom app (the strom-doc repository, CC BY 4.0) as
// strom carries it: assets/strom-doc, one pinned commit of its published main (scripts/pin-strom-doc.ts, package.json
// "stromDoc"). Read from its Markdown as it is, by the sources and the package alike: no build step, no network.
//
// Every chapter and rule has a number for good (R2, R2.3, R2.3.1; A… the app, S… the two together); the web shows the
// same text at https://stromapp.info/doc/<lang>/<chapter>/#<number>.

import fs from "node:fs";
import { assetPath, readAsset } from "./assets.ts";
import { StromError } from "./errors.ts";
import { foldText } from "./text.ts";

export const DOC_LANGS = ["cs", "en", "de", "pl"] as const;
export type DocLang = (typeof DOC_LANGS)[number];
/** The folder of the documentation in assets/. */
export const DOC_DIR = "strom-doc";
/** Where the web shows it (the build of stromapp.info's /doc/). */
export const DOC_SITE = "https://stromapp.info/doc";
export const DOC_PARTS = ["R", "A", "S"] as const;

/** A number of the documentation: part letter, chapter, up to three levels, a letter for one inserted between two (R2.3a). */
export const DOC_NUMBER = "[ARS][0-9]+[a-z]?(?:\\.[0-9]+[a-z]?){0,3}";
const IS_NUMBER = new RegExp(`^${DOC_NUMBER}$`, "u");
const HEADING = new RegExp(`^(#{1,6})\\s+(${DOC_NUMBER})\\s+(.+?)\\s*$`, "u");
/** A number standing alone in a text (not a part of a file name or an anchor: R5-conflicts.md#R5.6). */
export const BARE_NUMBER = new RegExp(`(?<![\\p{L}\\p{N}./#-])(${DOC_NUMBER})(?![\\p{L}\\p{N}-]|\\.[0-9])`, "gu");
const CHAPTER_FILE = /^([ARS][0-9]+[a-z]?)-.+\.md$/u;

/** The label of a rule's "Why" line in each language. */
const WHY: Record<DocLang, string> = { cs: "Proč", en: "Why", de: "Warum", pl: "Dlaczego" };

export interface DocEntry {
  number: string;
  title: string;
  /** Its chapter's number (a chapter: its own). */
  chapter: string;
  /** 1 a chapter, 2 a rule, 3 a rule under a rule … */
  depth: number;
  /** The text, plain: no HTML, no hidden comments, no anchors; lists and their labels as they are. */
  text: string;
  /** The "Why:" line, when the rule has one. */
  why?: string;
  /** The numbers right under it. */
  children: string[];
  fold?: { title: string; all: string };
}

export interface DocBook {
  lang: DocLang;
  /** The strom-doc commit carried. */
  pin: string;
  /** The documentation's title in the language ("How Strom works"). */
  title: string;
  parts: { id: string; title: string; chapters: string[] }[];
  entries: Map<string, DocEntry>;
  /** Every number in the order of the text: R, A, S, each chapter with its rules. */
  order: string[];
  /** The register of terms (REJSTRIK.md): each term with its definition in this language, and the numbers explaining it. */
  terms: { text: string; numbers: string[]; fold?: string }[];
}

/** The language the documentation is read in: the one asked for, else English (`fallback`: the one asked for). */
export function docLangOf(lang: string | undefined): { lang: DocLang; fallback?: string } {
  const code = (lang ?? "en").toLowerCase().split(/[-_.]/u)[0] ?? "";
  return (DOC_LANGS as readonly string[]).includes(code) ? { lang: code as DocLang } : { lang: "en", fallback: lang };
}

/**
 * A number as typed — R10.1, r4.3, R4-3, R4.3., #R4.3 — as the documentation writes it; undefined when it is not one
 * (the web's short links read the same: resolveDocLink of stromapp.info's scripts/build-doc.mjs).
 */
export function docNumber(input: string): string | undefined {
  const s = input.trim().replace(/[\s/.,;:!?)\]»“"']+$/u, "").replace(/^[#/]+/u, "");
  const m = /^([rasRAS])([0-9][0-9a-zA-Z.-]*)$/u.exec(s);
  if (!m) return undefined;
  const n = m[1]!.toUpperCase() + m[2]!.toLowerCase().replace(/-/gu, ".");
  return IS_NUMBER.test(n) ? n : undefined;
}

/** The page of a number on the web (none: the contents). */
export function docUrl(lang: DocLang, number?: string): string {
  if (!number) return `${DOC_SITE}/${lang}/`;
  const chapter = number.split(".")[0]!;
  return `${DOC_SITE}/${lang}/${chapter}/${number === chapter ? "" : `#${number}`}`;
}

/** The pinned commit (assets/strom-doc/PIN). */
export function docPin(): string {
  return (readAsset(DOC_DIR, "PIN") ?? "").trim();
}

// ── Markdown → plain text ─────────────────────────────────────────────────────

const ESCAPED = /\\([!-/:-@[-`{-~])/gu;
const HIDDEN = (c: string) => `${c.codePointAt(0)!.toString(16)}`;
const UNHIDE = /([0-9a-f]+)/gu;

/** One line's marks: links as their text (a web address beside it), **bold** and *italic* as plain text, `code` kept. */
export function plainLine(line: string): string {
  let s = line.replace(ESCAPED, (_, c: string) => HIDDEN(c));
  s = s.replace(/<a\s[^>]*>|<\/a>/gu, "");
  s = s.replace(/\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/gu, (_, text: string, href: string) => (/^https?:\/\//u.test(href) && text !== href ? `${text} (${href})` : text));
  // code spans stay as they are: the marks are taken out of the text around them only
  s = s
    .split(/(`[^`]*`)/u)
    .map((part) => (part.startsWith("`") ? part : part.replace(/\*\*(.+?)\*\*/gu, "$1").replace(/(?<![\p{L}\p{N}*])\*(?=\S)(.+?)(?<=\S)\*(?![\p{L}\p{N}*])/gu, "$1")))
    .join("");
  return s.replace(UNHIDE, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

/** The text of a section: plain lines, blank lines kept single, none at its ends. */
function plainText(lines: string[]): string {
  const out: string[] = [];
  for (const raw of lines) {
    const line = plainLine(raw).replace(/\s+$/u, "");
    if (!line && (!out.length || !out[out.length - 1])) continue;
    out.push(line);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  return out.join("\n");
}

/** The "Why:" item of a text: its line and the lines that go on under it, as one line. */
function whyOf(text: string, label: string): string | undefined {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^\\s*- ${label}:`, "u").test(l));
  if (start < 0) return undefined;
  const indent = lines[start]!.search(/\S/u);
  const said = [lines[start]!.trim().slice(2 + label.length + 1).trim()];
  for (const l of lines.slice(start + 1)) {
    if (!l.trim() || l.search(/\S/u) <= indent) break;
    said.push(l.trim());
  }
  return said.join(" ").trim() || undefined;
}

// ── reading ───────────────────────────────────────────────────────────────────

const books = new Map<DocLang, DocBook>();

const chapterOrder = (a: string, b: string) => DOC_PARTS.indexOf(a[0] as "R") - DOC_PARTS.indexOf(b[0] as "R") || parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10) || a.localeCompare(b);

function readChapter(md: string, lang: DocLang, entries: Map<string, DocEntry>, order: string[]): void {
  const lines = md.replace(/\r\n?/gu, "\n").replace(/<!--[\s\S]*?-->/gu, "").split("\n");
  let current: { entry: DocEntry; body: string[] } | undefined;
  const flush = () => {
    if (!current) return;
    current.entry.text = plainText(current.body);
    const why = whyOf(current.entry.text, WHY[lang]);
    if (why) current.entry.why = why;
  };
  for (const line of lines) {
    const m = HEADING.exec(line);
    if (!m) {
      current?.body.push(line);
      continue;
    }
    flush();
    const number = m[2]!;
    const entry: DocEntry = { number, title: plainLine(m[3]!), chapter: number.split(".")[0]!, depth: number.split(".").length, text: "", children: [] };
    entries.set(number, entry);
    order.push(number);
    // under the nearest number above it that is there (R10.3.1 under R10.3)
    const segments = number.split(".");
    for (let k = segments.length - 1; k >= 1; k--) {
      const parent = entries.get(segments.slice(0, k).join("."));
      if (parent) {
        parent.children.push(number);
        break;
      }
    }
    current = { entry, body: [] };
  }
  flush();
}

/** The register of terms: for each term, this language's row (term and definition) and its "Čísla" line's numbers. */
function readTerms(md: string, lang: DocLang): DocBook["terms"] {
  const terms: DocBook["terms"] = [];
  let text: string | undefined;
  for (const line of md.replace(/\r\n?/gu, "\n").split("\n")) {
    if (line.startsWith("### ")) text = undefined;
    const cells = line.startsWith("|") ? line.slice(1, line.lastIndexOf("|")).split("|").map((c) => c.trim()) : [];
    if (cells[0] === lang) text = plainLine(cells.slice(1).join(" "));
    if (/^\s*- \*\*Čísla:\*\*/u.test(line) && text) {
      const numbers = [...line.matchAll(BARE_NUMBER)].map((m) => m[1]!);
      terms.push({ text, numbers: [...new Set(numbers)] });
      text = undefined;
    }
  }
  return terms;
}

/** The documentation in one language (read once per process). Throws when strom's copy of it is missing. */
export function docBook(lang: DocLang): DocBook {
  const known = books.get(lang);
  if (known) return known;
  const dir = assetPath(DOC_DIR, lang);
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => CHAPTER_FILE.test(f));
  } catch {
    files = [];
  }
  if (!files.length) throw new StromError(`How Strom works is missing from this installation (${dir})`, { hint: `the same text on the web: ${DOC_SITE}/${lang}/` });
  files.sort((a, b) => chapterOrder(CHAPTER_FILE.exec(a)![1]!, CHAPTER_FILE.exec(b)![1]!));
  const entries = new Map<string, DocEntry>();
  const order: string[] = [];
  for (const f of files) readChapter(readAsset(DOC_DIR, lang, f) ?? "", lang, entries, order);
  const readme = (readAsset(DOC_DIR, lang, "README.md") ?? "").replace(/\r\n?/gu, "\n").split("\n");
  const title = readme.find((l) => l.startsWith("# "))?.slice(2).trim() ?? "How Strom works";
  const chapters = order.filter((n) => !n.includes("."));
  const parts = DOC_PARTS.map((id) => ({
    id,
    title: plainLine(readme.find((l) => l.startsWith(`## ${id} `))?.slice(3).trim() ?? id),
    chapters: chapters.filter((c) => c.startsWith(id)),
  })).filter((p) => p.chapters.length);
  const book: DocBook = { lang, pin: docPin(), title, parts, entries, order, terms: readTerms(readAsset(DOC_DIR, "REJSTRIK.md") ?? "", lang) };
  books.set(lang, book);
  return book;
}

/** A number and everything under it, in the order of the text. */
export function docUnder(book: DocBook, number: string): DocEntry[] {
  const entry = book.entries.get(number);
  if (!entry) return [];
  return entry.children.flatMap((c) => [book.entries.get(c)!, ...docUnder(book, c)]);
}

/** The numbers nearest to one the documentation does not have: its nearest parent and the numbers under it, else the chapters of its part. */
export function docNear(book: DocBook, number: string, max = 8): string[] {
  const segments = number.split(".");
  for (let k = segments.length - 1; k >= 1; k--) {
    const parent = book.entries.get(segments.slice(0, k).join("."));
    if (parent) return [parent.number, ...parent.children].slice(0, max);
  }
  const part = book.parts.find((p) => p.id === number[0]);
  return (part?.chapters ?? book.parts.flatMap((p) => p.chapters)).slice(0, max);
}

/**
 * The numbers whose titles, register terms or text hold every word (folded: any accent, any case, NFD or NFC; a word may
 * be the start or a part of a longer one), best first: the title (3), a term of the register explaining it (2), the
 * text (1); the same score in the order of the text.
 */
export function docSearch(book: DocBook, query: string): { entry: DocEntry; score: number }[] {
  const words = foldText(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  const all = (s: string) => words.every((w) => s.includes(w));
  const byTerm = new Set<string>();
  for (const t of book.terms) {
    t.fold ??= foldText(t.text);
    if (all(t.fold)) for (const n of t.numbers) byTerm.add(n);
  }
  const found: { entry: DocEntry; score: number; at: number }[] = [];
  book.order.forEach((n, at) => {
    const entry = book.entries.get(n)!;
    entry.fold ??= { title: foldText(entry.title), all: foldText(`${entry.number} ${entry.title} ${entry.text}`) };
    const score = all(entry.fold.title) ? 3 : byTerm.has(n) ? 2 : all(entry.fold.all) ? 1 : 0;
    if (score) found.push({ entry, score, at });
  });
  return found.sort((a, b) => b.score - a.score || a.at - b.at).map(({ entry, score }) => ({ entry, score }));
}
