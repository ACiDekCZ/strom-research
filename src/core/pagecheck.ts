// A page a region's event stands on, read by strom itself (strom history add): the words the agent quotes must be on
// it, the event's year in them. Read politely (core/net.ts: the host's pace, its robots.txt), https only, a page of text
// only (HTML, plain text — never a PDF or an image), at most 5 MB; kept 30 days in <shared>/history/pages/ so the same
// page is asked once. A page strom cannot read is no question to the person (no allow host, no bot check): the agent
// takes another source, or leaves the event out. The agent reads the page as strom does (strom history page: its text in
// parts, the passages with the words it looks for) — the same read the quote is checked on, one request a page.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { politeRequest, NetError } from "./net.ts";
import { foldText } from "./text.ts";
import { UsageError } from "./errors.ts";

/** A page larger than this is no page of text strom reads. */
export const PAGE_MAX_BYTES = 5 * 1024 * 1024;
/** A page read is kept so long, then asked again. */
export const PAGE_CACHE_DAYS = 30;
/** A quote at most so long. */
export const QUOTE_MAX = 300;

const TYPES = ["text/html", "text/plain", "application/xhtml+xml"];

export interface PageText {
  url: string;
  /** When strom read it (ISO). */
  at: string;
  status: number;
  /** Its content type (without parameters). */
  type: string;
  lang?: string;
  title?: string;
  /** SHA-256 of the text. */
  sha: string;
  text: string;
}

/** A page strom could not read: why, in a few words (kept as `tried` of the region's catalog). */
export class PageError extends UsageError {
  readonly why: string;
  /** `tail`: what the command that read it did not do (strom history add: nothing written; strom history page: none). */
  constructor(url: string, why: string, tail = " — nothing written") {
    super(`${url} could not be read: ${why}${tail}`, {
      code: "history.page",
      params: { url, why },
      hint: "take another source of the event (a page strom can read: https, HTML or text), or leave the event out — the person is asked nothing for it",
    });
    this.why = why;
  }
}

export interface PageOptions {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  fetchImpl?: typeof fetch;
}

function loopback(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "::1" || /^127\.\d+\.\d+\.\d+$/.test(h);
}

export function pagesDir(shared: string): string {
  return path.join(shared, "history", "pages");
}

function cacheFile(shared: string, url: string): string {
  return path.join(pagesDir(shared), `${crypto.createHash("sha256").update(url).digest("hex")}.txt.gz`);
}

function readCache(shared: string, url: string, now: number): PageText | undefined {
  try {
    const raw = zlib.gunzipSync(fs.readFileSync(cacheFile(shared, url))).toString("utf8");
    const nl = raw.indexOf("\n");
    const meta = JSON.parse(raw.slice(0, nl)) as Omit<PageText, "text">;
    if (meta.url !== url || !(now - Date.parse(meta.at) < PAGE_CACHE_DAYS * 86_400_000)) return undefined;
    return { ...meta, text: raw.slice(nl + 1) };
  } catch {
    return undefined;
  }
}

function writeCache(shared: string, p: PageText): void {
  const { text, ...meta } = p;
  try {
    fs.mkdirSync(pagesDir(shared), { recursive: true });
    const file = cacheFile(shared, p.url);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, zlib.gzipSync(Buffer.from(`${JSON.stringify(meta)}\n${text}`, "utf8")));
    fs.renameSync(tmp, file);
  } catch {
    // a cache not written: the page is asked again next time
  }
}

/**
 * The page at `url` as text: from the cache within its days, else read now (one request, paced, robots.txt first).
 * Throws PageError when it is no page strom reads.
 */
export async function readPage(url: string, shared: string, env: NodeJS.ProcessEnv, o: PageOptions = {}): Promise<PageText> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new PageError(url, "not an address");
  }
  if (u.protocol !== "https:" && !(u.protocol === "http:" && env.STROM_TEST_HOSTS === "1" && loopback(u.hostname))) throw new PageError(url, "only https pages");
  if (u.username || u.password) throw new PageError(url, "an address with a login");
  const now = (o.now ?? Date.now)();
  const had = readCache(shared, url, now);
  if (had) return had;
  let res;
  try {
    res = await politeRequest(url, {
      stateDir: path.join(shared, "net"),
      hosts: [u.hostname],
      robots: true,
      headers: { accept: "text/html, application/xhtml+xml, text/plain;q=0.9" },
      ...(o.sleep ? { sleep: o.sleep } : {}),
      ...(o.now ? { now: o.now } : {}),
      ...(o.fetchImpl ? { fetchImpl: o.fetchImpl } : {}),
    });
  } catch (e) {
    if (e instanceof NetError) throw new PageError(url, netWhy(e));
    throw new PageError(url, (e as Error).message);
  }
  if (res.status < 200 || res.status >= 300) throw new PageError(url, `HTTP ${res.status}`);
  const type = (res.contentType.split(";")[0] ?? "").trim().toLowerCase();
  if (!TYPES.includes(type)) throw new PageError(url, `not a page of text (${type || "no type"})`);
  if (res.body.length > PAGE_MAX_BYTES) throw new PageError(url, `larger than ${PAGE_MAX_BYTES / 1024 / 1024} MB`);
  const html = type !== "text/plain";
  const raw = decode(res.body, res.contentType, html);
  const page = html ? htmlText(raw) : { text: cleanText(raw) };
  const text = page.text;
  const p: PageText = {
    url,
    at: new Date(now).toISOString(),
    status: res.status,
    type,
    ...(page.lang ? { lang: page.lang } : {}),
    ...(page.title ? { title: page.title } : {}),
    sha: crypto.createHash("sha256").update(text).digest("hex"),
    text,
  };
  writeCache(shared, p);
  return p;
}

function netWhy(e: NetError): string {
  if (e.failure === "robots") return "its robots.txt keeps automated tools off it";
  if (e.failure === "refused") return e.status ? `refused (HTTP ${e.status})` : "refused";
  if (e.failure === "silent") return "no answer";
  // a redirect to another host: a consent or login page as a rule (a news site's) — strom reads only the page asked
  if (e.failure === "host") return `it sends to another site (${e.host}: a consent or login page as a rule), and strom reads only the page asked`;
  return e.status ? `HTTP ${e.status}` : e.message.slice(0, 120);
}

/** The page's bytes as text: the charset of its Content-Type, else of its <meta>, else UTF-8. */
function decode(body: Buffer, contentType: string, html: boolean): string {
  let label = /charset\s*=\s*["']?([\p{L}\p{N}_.:-]+)/iu.exec(contentType)?.[1];
  if (!label && html) {
    const head = body.subarray(0, 4096).toString("latin1");
    label = /<meta[^>]+charset\s*=\s*["']?([\p{L}\p{N}_.:-]+)/iu.exec(head)?.[1];
  }
  if (label) {
    try {
      return new TextDecoder(label.toLowerCase()).decode(body);
    } catch {
      // an unknown charset: UTF-8
    }
  }
  return new TextDecoder("utf-8").decode(body);
}

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "­", ndash: "–", mdash: "—", hellip: "…",
  laquo: "«", raquo: "»", lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„", lsaquo: "‹", rsaquo: "›",
  minus: "−", times: "×", divide: "÷", deg: "°", middot: "·", bull: "•", sect: "§", para: "¶", copy: "©", reg: "®", trade: "™",
  euro: "€", pound: "£", cent: "¢", yen: "¥", frac12: "½", frac14: "¼", frac34: "¾", sup1: "¹", sup2: "²", sup3: "³", ordm: "º", ordf: "ª",
  iexcl: "¡", iquest: "¿", prime: "′", Prime: "″", thinsp: " ", ensp: " ", emsp: " ", zwj: "‍", zwnj: "‌", lrm: "", rlm: "",
  Scaron: "Š", scaron: "š", Zcaron: "Ž", zcaron: "ž", OElig: "Œ", oelig: "œ", Yuml: "Ÿ", fnof: "ƒ", szlig: "ß",
  Ccaron: "Č", ccaron: "č", Dcaron: "Ď", dcaron: "ď", Ecaron: "Ě", ecaron: "ě", Ncaron: "Ň", ncaron: "ň", Rcaron: "Ř", rcaron: "ř",
  Tcaron: "Ť", tcaron: "ť", Uring: "Ů", uring: "ů", Lcaron: "Ľ", lcaron: "ľ", Lstrok: "Ł", lstrok: "ł", Nacute: "Ń", nacute: "ń",
  Sacute: "Ś", sacute: "ś", Zacute: "Ź", zacute: "ź", Zdot: "Ż", zdot: "ż", Aogon: "Ą", aogon: "ą", Eogon: "Ę", eogon: "ę",
  Cacute: "Ć", cacute: "ć", Odblac: "Ő", odblac: "ő", Udblac: "Ű", udblac: "ű", Gbreve: "Ğ", gbreve: "ğ", Abreve: "Ă", abreve: "ă",
};
// the letters of Latin-1 by their names (&aacute; &Ouml; …)
const LATIN1 = [
  ["Agrave", 192], ["Aacute", 193], ["Acirc", 194], ["Atilde", 195], ["Auml", 196], ["Aring", 197], ["AElig", 198], ["Ccedil", 199],
  ["Egrave", 200], ["Eacute", 201], ["Ecirc", 202], ["Euml", 203], ["Igrave", 204], ["Iacute", 205], ["Icirc", 206], ["Iuml", 207],
  ["ETH", 208], ["Ntilde", 209], ["Ograve", 210], ["Oacute", 211], ["Ocirc", 212], ["Otilde", 213], ["Ouml", 214], ["Oslash", 216],
  ["Ugrave", 217], ["Uacute", 218], ["Ucirc", 219], ["Uuml", 220], ["Yacute", 221], ["THORN", 222],
] as const;
for (const [n, c] of LATIN1) {
  NAMED[n] = String.fromCodePoint(c);
  const lower = n === "ETH" ? "eth" : n === "THORN" ? "thorn" : n === "AElig" ? "aelig" : n[0]!.toLowerCase() + n.slice(1);
  NAMED[lower] = String.fromCodePoint(c + 32);
}
NAMED.yuml = "ÿ";

export function decodeEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]{1,6}|#\d{1,7}|[A-Za-z][A-Za-z0-9]{1,31});?/g, (all, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : all;
    }
    return NAMED[e] ?? all;
  });
}

/** Text as strom compares it: NFC, no soft hyphens or zero-width marks, one space between words. */
export function cleanText(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[­​‌‍⁠﻿]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** A page of HTML as its text (no scripts, styles, comments, templates), its title and language. */
export function htmlText(html: string): { text: string; title?: string; lang?: string } {
  const lang = /<html\b[^>]*?\blang\s*=\s*["']?([\p{L}\p{N}-]{2,20})/iu.exec(html)?.[1]?.toLowerCase();
  const titleRaw = /<title\b[^>]*>([\s\S]*?)<\/title>/iu.exec(html)?.[1];
  const body = html
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<(script|style|template|noscript|svg|head)\b[\s\S]*?<\/\1\s*>/giu, " ")
    .replace(/<\/?(?:p|div|br|li|ul|ol|tr|td|th|table|h[1-6]|section|article|header|footer|blockquote|dd|dt|dl|figcaption|caption|main|nav|aside)\b[^>]*>/giu, " \n ")
    .replace(/<[^>]*>/gu, "");
  const title = titleRaw ? cleanText(decodeEntities(titleRaw.replace(/<[^>]*>/gu, ""))) : undefined;
  return { text: cleanText(decodeEntities(body)), ...(title ? { title } : {}), ...(lang ? { lang } : {}) };
}

/** Quotes and dashes as one: „ " “ » … → ", ‘ ’ ‚ … → ', – — − … → -; then folded (core/text.ts). */
function canon(s: string): string {
  return foldText(
    cleanText(s)
      .replace(/[‐-―−⸺⸻]/gu, "-")
      .replace(/[“-‟«»″〝〞]/gu, '"')
      .replace(/[‘-‛‹›′`´]/gu, "'")
      .replace(/\s*-\s*/gu, " - ")
      .replace(/\s*\/\s*/gu, " / "),
  ).replace(/\s+/gu, " ");
}

/** Is the year in the words, as a year (not a part of a longer number)? */
export function hasYear(text: string, year: number): boolean {
  return new RegExp(`(?<!\\d)${year}(?!\\d)`, "u").test(text);
}

/** What is wrong with the quote itself, before any page: empty, too long, the event's years not in it. */
export function quoteShape(quote: string, years: { from: number; to: number }): string | undefined {
  return quotesShape([quote], years);
}

/**
 * What is wrong with the quotes of an event, before any page: one empty or too long; the year it began in none of
 * them; the year it ended (another) in none — a period stands on the words that say both its ends, a quote for each when
 * the page says them apart.
 */
export function quotesShape(quotes: readonly string[], years: { from: number; to: number }): string | undefined {
  const qs = quotes.map(cleanText);
  if (!qs.length) return "the quote is empty";
  const many = qs.length > 1;
  for (const [i, q] of qs.entries()) {
    const which = many ? `quote ${i + 1}` : "the quote";
    if (!q) return `${which} is empty`;
    if ([...q].length > QUOTE_MAX) return `${which} is ${[...q].length} characters — at most ${QUOTE_MAX}`;
  }
  if (!qs.some((q) => hasYear(q, years.from))) return many ? `no quote says the year ${years.from}` : `the quote does not say the year ${years.from}`;
  if (years.to !== years.from && !qs.some((q) => hasYear(q, years.to)))
    return `${many ? "no quote says" : "the quote does not say"} the year ${years.to} — add ${many ? "a" : "a second"} --quote with the year ${years.to} (words of the same page), or give the period the page says`;
  return undefined;
}

/** The quote of an event the app shows (one, ≤ 300): the first that says the year it began. */
export function mainQuote(quotes: readonly string[], from: number): string {
  const qs = quotes.map(cleanText);
  return qs.find((q) => hasYear(q, from)) ?? qs[0] ?? "";
}

/** Are the words on the page — in order, their parts apart where the quote leaves something out ("…", "...")? */
function onPage(page: string, quote: string): string | undefined {
  let at = 0;
  const parts = cleanText(quote).split(/…|\.\.\./u).map(canon).filter((p) => p.length > 0);
  if (!parts.length) return "the quote is empty";
  for (const p of parts) {
    const i = page.indexOf(p, at);
    if (i < 0) return parts.length > 1 ? `"${p.slice(0, 60)}" is not on the page (after what comes before it)` : "these words are not on the page";
    at = i + p.length;
  }
  return undefined;
}

/**
 * Are the quoted words on the page — in order, their parts apart where the quote leaves something out ("…", "...") —
 * with the event's years in them? Undefined when they are; else why not.
 */
export function quoteProblem(pageText: string, quote: string, years: { from: number; to: number }): string | undefined {
  return quotesProblem(pageText, [quote], years);
}

/** Each quote on the page (as quoteProblem), the event's years in them together (quotesShape). */
export function quotesProblem(pageText: string, quotes: readonly string[], years: { from: number; to: number }): string | undefined {
  const own = quotesShape(quotes, years);
  if (own) return own;
  const page = canon(pageText);
  for (const [i, q] of quotes.entries()) {
    const why = onPage(page, q);
    if (why) return quotes.length > 1 ? `quote ${i + 1}: ${why}` : why;
  }
  return undefined;
}

export interface CheckedQuote {
  page: PageText;
  /** The day strom read the page (YYYY-MM-DD). */
  checked: string;
}

/**
 * The page read and the quote found on it. A page strom cannot read → PageError (the caller keeps it as `tried`);
 * words not on it → UsageError history.quote (nothing kept: the agent quotes the page again).
 */
export async function checkQuote(url: string, quote: string, years: { from: number; to: number }, shared: string, env: NodeJS.ProcessEnv, o: PageOptions = {}): Promise<CheckedQuote> {
  return checkQuotes(url, [quote], years, shared, env, o);
}

/** The page read and every quote found on it, the event's years in them together (quotesShape). */
export async function checkQuotes(url: string, quotes: readonly string[], years: { from: number; to: number }, shared: string, env: NodeJS.ProcessEnv, o: PageOptions = {}): Promise<CheckedQuote> {
  const pre = quotesShape(quotes, years);
  if (pre) throw new UsageError(`--quote: ${pre}`, { code: "history.quote", params: { why: pre } });
  const page = await readPage(url, shared, env, o);
  const why = quotesProblem(page.text, quotes, years);
  if (why)
    throw new UsageError(`--quote: ${why} (${url}) — nothing written`, {
      code: "history.quote",
      params: { why },
      hint: `the page's own words, as strom reads it: strom history page ${url} --find "<a few words>" — then quote them word for word (a part left out as …), the year of the event in them; or take another source`,
    });
  return { page, checked: page.at.slice(0, 10) };
}

// ── the page as the agent reads it (strom history page) ────────────────────

/** A part of a page's text so long at most (strom history page --page <n>). */
export const PART_CHARS = 6000;
/** A sentence longer than this is cut into pieces of about this for the passages of --find. */
const PIECE_CHARS = 400;
/** The passage around a match: its neighbours only while it stays within this. */
const PASSAGE_CHARS = 900;

/** The page's text in parts of at most PART_CHARS, each ending at a sentence's end (else a space) where it can. */
export function pageParts(text: string, size = PART_CHARS): { at: number; text: string }[] {
  const out: { at: number; text: string }[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + size);
    if (end < text.length) {
      const window = text.slice(start, end);
      const stop = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
      const space = window.lastIndexOf(" ");
      if (stop > size / 2) end = start + stop + 1;
      else if (space > size / 2) end = start + space;
    }
    out.push({ at: start, text: text.slice(start, end).trim() });
    start = end;
    while (text[start] === " ") start++;
  }
  return out;
}

/** The page's text in sentences (long ones in pieces), each with where it begins. */
function sentences(text: string): { at: number; text: string }[] {
  const out: { at: number; text: string }[] = [];
  const push = (at: number, s: string) => {
    let from = 0;
    while (s.length - from > PIECE_CHARS) {
      const cut = s.lastIndexOf(" ", from + PIECE_CHARS);
      const end = cut > from ? cut : from + PIECE_CHARS;
      out.push({ at: at + from, text: s.slice(from, end) });
      from = end + (s[end] === " " ? 1 : 0);
    }
    if (from < s.length) out.push({ at: at + from, text: s.slice(from) });
  };
  // a sentence ends at . ! ? … (a closing quote or bracket with it) before a capital, a digit or an opening quote
  const end = /[.!?…]["'“”»«)\]]?\s+(?=[\p{Lu}\p{N}„"«‚'(\[])/gu;
  let start = 0;
  for (const m of text.matchAll(end)) {
    const stop = m.index + m[0].trimEnd().length;
    push(start, text.slice(start, stop));
    start = m.index + m[0].length;
  }
  if (start < text.length) push(start, text.slice(start));
  return out;
}

/** The words of a text, folded (core/text.ts) — any script, any accent. */
function words(s: string): string[] {
  return canon(s).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}

export interface Passage {
  /** Where it begins in the page's text. */
  at: number;
  /** The part of the page it is in (strom history page --page <n>). */
  part: number;
  /** The page's own words, as strom compares the quote with them. */
  text: string;
}

/**
 * The passages of the page with the words looked for — as a phrase in any case and accent (quotes and dashes as one);
 * a phrase found nowhere: the passages with all its words. Each the sentence with its neighbours while short.
 */
export function findPassages(text: string, finds: readonly string[], max = 20): { passages: Passage[]; more: number } {
  const ss = sentences(text);
  const folded = ss.map((s) => canon(s.text));
  const parts = pageParts(text);
  const partOf = (at: number) => {
    let n = 1;
    for (const [i, p] of parts.entries()) if (p.at <= at) n = i + 1;
    return n;
  };
  const hits = new Map<number, number>(); // sentence → the last sentence of the match
  for (const f of finds) {
    const phrase = canon(f);
    if (!phrase) continue;
    let found = false;
    for (let i = 0; i < ss.length; i++) {
      if (folded[i]!.includes(phrase)) {
        hits.set(i, Math.max(hits.get(i) ?? i, i));
        found = true;
      } else if (i + 1 < ss.length && !folded[i + 1]!.includes(phrase) && `${folded[i]} ${folded[i + 1]}`.includes(phrase)) {
        hits.set(i, Math.max(hits.get(i) ?? i, i + 1));
        found = true;
      }
    }
    if (found) continue;
    const want = words(f);
    if (!want.length) continue;
    for (let i = 0; i < ss.length; i++) {
      const have = new Set(words(ss[i]!.text));
      if (want.every((w) => have.has(w))) hits.set(i, Math.max(hits.get(i) ?? i, i));
    }
  }
  const order = [...hits.keys()].sort((a, b) => a - b);
  const spans: { from: number; to: number }[] = [];
  for (const i of order) {
    let from = i;
    let to = hits.get(i)!;
    const len = (a: number, b: number) => ss[b]!.at + ss[b]!.text.length - ss[a]!.at;
    if (from > 0 && len(from - 1, to) <= PASSAGE_CHARS) from--;
    if (to + 1 < ss.length && len(from, to + 1) <= PASSAGE_CHARS) to++;
    const last = spans.at(-1);
    if (last && from <= last.to + 1 && len(last.from, to) <= PASSAGE_CHARS * 2) last.to = Math.max(last.to, to);
    else spans.push({ from, to });
  }
  const all = spans.map((sp) => {
    const at = ss[sp.from]!.at;
    return { at, part: partOf(at), text: text.slice(at, ss[sp.to]!.at + ss[sp.to]!.text.length) };
  });
  return { passages: all.slice(0, max), more: Math.max(0, all.length - max) };
}
