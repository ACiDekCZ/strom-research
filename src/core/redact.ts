// Masking of what a report of a problem (strom error, spec 070 K1.3) and the journal of commands carry: nothing of a
// person, a place, a note or a path with the user's name may leave this computer. What strom says of itself (its words,
// the record IDs, numbers, versions, hosts, options) stays readable; every other word becomes a stable code (‹3fa9c›):
// the same word the same code, so that "the same" can be told, never what it was (a keyed hash; the key stays in
// strom's settings folder, never in a report).
//
// Any script, any accent: words are runs of \p{L}\p{M}\p{N}, compared through foldText (NFC and NFD the same).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { foldText } from "./text.ts";
import { configDir, type Env } from "./paths.ts";

/** The key of the codes, in strom's settings folder (never in a report, never in a research). */
export const MASK_KEY_FILE = "report.key";

const keys = new Map<string, Buffer>();

/** The key the codes are made with: made once, kept in the settings folder; none to keep there — one of this process. */
export function maskKey(env: Env): Buffer {
  let dir: string;
  try {
    dir = configDir(env);
  } catch {
    dir = "";
  }
  const known = keys.get(dir);
  if (known) return known;
  const file = dir ? path.join(dir, MASK_KEY_FILE) : "";
  let key: Buffer | undefined;
  try {
    const b = file ? fs.readFileSync(file) : undefined;
    if (b && b.length >= 16) key = b;
  } catch {
    // made below
  }
  if (!key) {
    key = crypto.randomBytes(32);
    if (file) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, key, { mode: 0o600, flag: "wx" });
      } catch {
        // another strom made it a moment ago: its key
        try {
          const b = fs.readFileSync(file);
          if (b.length >= 16) key = b;
        } catch {
          // this process's own key: codes stable within it
        }
      }
    }
  }
  keys.set(dir, key);
  return key;
}

/** A record's ID as strom writes it (P0012, F3, B0003:12, B0003:12-40): never anything of a person. */
const ID = /^[A-Z]{1,2}\d+(?::\d+(?:[-–]\d+)?)?$/;
/** A section of strom's own documentation (strom doc R12.5): kept. */
const SECTION = /^[A-Z]\d+(?:\.\d+)+$/;
/** A number, a range, a version (1.29.0, 12-40, 3.5): kept. */
const NUMBER = /^v?\d+(?:[.,:\-–]\d+)*(?:-(?:beta|rc|alpha)\.\d+)?$/;
/** A date as people write it (2.3.1850, 1850-03-02, 02/03/1850): a person's — masked. */
const DATE = /^(?:\d{1,2}\.\d{1,2}\.\d{2,4}|\d{3,4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4})$/;
/** A time of strom's own (an ISO time with T): kept. */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?$/;
/** An error code of the system (ENOENT, ECONNRESET, EACCES). */
const ERRNO = /^E[A-Z]{3,}$/;
/** A file's ending kept after a masked name (Lhotak.jpg → ‹…›.jpg). */
const EXTENSION = /^(?:jpe?g|png|gif|webp|tiff?|heic|pdf|json|jsonl|txt|log|ged|zip|gz|tgz|md|html?|csv|xml|js|ts|mjs|cjs|ps1|sh|cmd|bat|exe|lock|tmp|bak)$/i;
/** The names of strom's own folders and the system's, kept in a path. */
const FOLDERS = new Set([
  "~", ".", "..", ".strom", ".git", ".config", ".local", "data", "inputs", "media", "notes", "output", "plugins", "connectors", "gates", "hooks", "metrics", "fetch", "runs", "sync", "bin", "node", "lib", "dist", "src", "assets", "views", "cache", "excerpts", "thumbs", "converted", "inbox", "ops", "strom", "strom-research", "users", "home", "tmp", "temp", "var", "usr", "opt", "private", "appdata", "local", "roaming", "program files", "programs", "downloads", "documents", "desktop", "library", "application support", "volumes", "applications", "windows", "system32", "onedrive",
]);

/**
 * The words of a vocabulary: the ASCII words the texts given write in lower case (strom's own English) — a name, which
 * its texts write capitalized (an example's), is none of them.
 */
export function vocabularyOf(texts: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(/(?<![\p{L}\p{M}\p{N}])[a-z]+(?![\p{L}\p{M}\p{N}])/gu)) out.add(m[0]);
  return out;
}

export interface MaskOptions {
  key: Buffer;
  /** The user's home folder: said as ~. */
  home?: string;
  /** The words kept (strom's own English, lower case); a function: made only when a word needs it. */
  vocabulary?: ReadonlySet<string> | (() => ReadonlySet<string>);
  /** The words of the research known to be a person's or a place's (names, places, the research's name, the user). */
  terms?: Iterable<string>;
}

const PROTECT = "\u0000";

/** A code as Masker writes it (‹3fa9c›), anywhere in a text. */
export const MASK_CODE = /‹[0-9a-f]{5}›/g;

/**
 * A word (folded, its letters) is a form of a known one: one stem, each with its own short ending — in any language,
 * no list of endings. Either their common beginning is nearly all of the shorter one (Lhotáka, Lhotákovi, Lhotas of
 * Lhoták, Lhota), or the known word's last letter or two changed (Brna of Brno, Praze of Praha) with an ending no
 * longer than its stem lets: a stem of 3 letters at least, the shorter the stem the shorter the ending, so that a
 * common word that only begins alike stays (pravda is no form of Praha). A known word of 3 letters (Jan) only with
 * one letter more (Jana).
 */
function formOf(f: string[], t: string[]): boolean {
  const len = f.length;
  const tl = t.length;
  let common = 0;
  while (common < len && common < tl && f[common] === t[common]) common++;
  if (len >= 4 && tl >= 4 && common >= Math.max(4, Math.min(len, tl) - 2) && Math.abs(len - tl) <= 4) return true;
  if (common < 3) return false;
  const changed = tl - common;
  const ending = len - common;
  return changed <= (tl >= 5 ? 2 : tl === 4 ? 1 : 0) && ending <= (tl === 3 ? 1 : common >= 5 ? 4 : common === 4 ? 3 : 2);
}

export class Masker {
  private readonly key: Buffer;
  private readonly homes: string[];
  private vocabularyGiven: ReadonlySet<string> | (() => ReadonlySet<string>);
  /** Folded words of the research (3 letters and more). */
  private readonly terms = new Set<string>();
  /** The words by their first 3 letters (a form of one begins as it does). */
  private readonly byPrefix = new Map<string, string[]>();
  /** How many codes were made (each time one was asked). */
  masked = 0;

  constructor(o: MaskOptions) {
    this.key = o.key;
    const home = o.home ? o.home.replace(/[\\/]+$/, "") : "";
    this.homes = home ? [...new Set([home, home.replace(/\\/g, "/"), home.replace(/\//g, "\\")])].sort((a, b) => b.length - a.length) : [];
    this.vocabularyGiven = o.vocabulary ?? new Set();
    if (o.terms) this.addTerms(o.terms);
  }

  private get vocabulary(): ReadonlySet<string> {
    if (typeof this.vocabularyGiven === "function") this.vocabularyGiven = this.vocabularyGiven();
    return this.vocabularyGiven;
  }

  /**
   * Words of the research to find anywhere (a name, a place): each word of 3 letters and more, folded. weak (the title
   * of a book or a source): its words strom says itself too are left out (a "register" of a title masks no "register"
   * of strom's) — a person's name or a place's is masked even when it is a word of strom's.
   */
  addTerms(texts: Iterable<string>, o: { weak?: boolean } = {}): void {
    for (const t of texts) {
      if (typeof t !== "string") continue;
      for (const m of t.normalize("NFC").matchAll(/[\p{L}\p{M}]+/gu)) {
        const f = foldText(m[0]);
        if ([...f].length < 3) continue;
        if (o.weak && this.vocabulary.has(f)) continue;
        if (this.terms.has(f)) continue;
        this.terms.add(f);
        const p = [...f].slice(0, 3).join("");
        const list = this.byPrefix.get(p);
        if (list) list.push(f);
        else this.byPrefix.set(p, [f]);
      }
    }
  }

  /** How many words of the research it knows. */
  get termCount(): number {
    return this.terms.size;
  }

  /** The stable code of a word (NFC, NFD, any case: one code). */
  code(word: string): string {
    this.masked++;
    const h = crypto.createHmac("sha256", this.key).update(foldText(word.normalize("NFC")).trim()).digest("hex").slice(0, 5);
    return `‹${h}›`;
  }

  /** A command's arguments: options, IDs, numbers and strom's words kept; anything else one code each. */
  args(argv: readonly string[]): string[] {
    return argv.map((a) => {
      const s = String(a);
      const opt = /^(--?[A-Za-z][A-Za-z0-9-]*)(=(.*))?$/su.exec(s);
      if (opt) return opt[2] === undefined ? opt[1]! : `${opt[1]}=${this.argValue(opt[3] ?? "")}`;
      return this.argValue(s);
    });
  }

  private argValue(s: string): string {
    if (s === "") return s;
    // several IDs or numbers at once (T0001,T0002; 3,5-9)
    const parts = s.split(",");
    if (parts.every((p) => ID.test(p.trim()) || (NUMBER.test(p.trim()) && !DATE.test(p.trim())))) return s;
    if (/^[a-z][a-z0-9-]{0,30}$/.test(s) && s.split("-").every((w) => this.vocabulary.has(w) || /^\d+$/.test(w)) && !this.isTerm(s)) return s;
    const url = /^([a-z][a-z0-9+.-]*):\/\/([^\s/?#]*)/i.exec(s);
    if (url) return `${url[1]}://${this.host(url[2]!)}${s.length > url[0].length ? "/‹…›" : ""}`;
    return this.code(s);
  }

  private host(h: string): string {
    const at = h.lastIndexOf("@");
    return at >= 0 ? `‹e›@${h.slice(at + 1)}` : h;
  }

  private isTerm(word: string): boolean {
    if (!this.terms.size) return false;
    const f = foldText(word.normalize("NFC"));
    if (this.terms.has(f)) return true;
    // a form of a known word (Lhotákovi, Lhotáka of Lhoták; z Brna, v Praze): never a word of strom's own (its
    // "registry" is no form of a "register")
    const fc = [...f];
    if (fc.length < 4 || this.vocabulary.has(f)) return false;
    for (const t of this.byPrefix.get(fc.slice(0, 3).join("")) ?? []) if (formOf(fc, [...t])) return true;
    return false;
  }

  /** A text strom wrote (an error, a line of a log): its own words kept, anything of a person masked. */
  text(input: string): string {
    if (!input) return input;
    const kept: string[] = [];
    const protect = (s: string) => `${PROTECT}${kept.push(s) - 1}${PROTECT}`;
    let s = input.normalize("NFC");
    // the home folder: ~
    for (const h of this.homes) s = s.split(h).join("~");
    // e-mails
    s = s.replace(/[\p{L}\p{M}\p{N}._%+-]+@[\p{L}\p{M}\p{N}-]+(?:\.[\p{L}\p{M}\p{N}-]+)+/gu, () => protect("‹e›"));
    // addresses: the scheme and the host, never the path (the bridge's secret, a search for a name)
    s = s.replace(/(?<![\p{L}\p{N}])([a-z][a-z0-9+.-]*):\/\/([^\s"'<>/?#]*)([^\s"'<>]*)/giu, (_m, scheme: string, host: string, rest: string) =>
      protect(`${scheme}://${this.host(host)}${rest && rest !== "/" ? "/‹…›" : rest}`),
    );
    // what is quoted is what was typed or read: one code
    s = s.replace(/"([^"\n]*)"|„([^“”\n]*)[“”]|“([^”\n]*)”|«([^»\n]*)»|‘([^’\n]*)’|(?<![\p{L}\p{N}])'([^'\n]+)'(?![\p{L}\p{N}])/gu, (m: string, ...g: (string | undefined)[]) => {
      const inner = g.slice(0, 6).find((x) => x !== undefined) ?? "";
      const open = m[0]!;
      const close = m[m.length - 1]!;
      return protect(`${open}${inner.trim() ? this.quoted(inner) : inner}${close}`);
    });
    // paths: strom's folders kept, the rest of each part masked
    s = s.replace(/(?:~|[A-Za-z]:)?(?:[\\/][^\s\\/"'<>|*?;,]+)+[\\/]?/gu, (m) => {
      if (m.includes(PROTECT)) return m;
      // a sentence's stop after it is no part of it
      const end = /[.:)\]]+$/.exec(m)?.[0] ?? "";
      return protect(this.path(m.slice(0, m.length - end.length))) + end;
    });
    // words
    s = s.replace(/[\p{L}\p{M}\p{N}]+(?:[._'’:-][\p{L}\p{M}\p{N}]+)*/gu, (w) => this.word(w));
    return s.replace(new RegExp(`${PROTECT}(\\d+)${PROTECT}`, "g"), (_m, i: string) => kept[Number(i)] ?? "");
  }

  /**
   * A person's own words (strom error --note): kept readable — only what is known of the research (a name, a place),
   * a date, an e-mail, an address's path and a path's own parts masked; the rest of their words stay as written.
   */
  note(input: string): string {
    if (!input) return input;
    const kept: string[] = [];
    const protect = (s: string) => `${PROTECT}${kept.push(s) - 1}${PROTECT}`;
    let s = input.normalize("NFC");
    for (const h of this.homes) s = s.split(h).join("~");
    s = s.replace(/[\p{L}\p{M}\p{N}._%+-]+@[\p{L}\p{M}\p{N}-]+(?:\.[\p{L}\p{M}\p{N}-]+)+/gu, () => protect("‹e›"));
    s = s.replace(/(?<![\p{L}\p{N}])([a-z][a-z0-9+.-]*):\/\/([^\s"'<>/?#]*)([^\s"'<>]*)/giu, (_m, scheme: string, host: string, rest: string) =>
      protect(`${scheme}://${this.host(host)}${rest && rest !== "/" ? "/‹…›" : rest}`),
    );
    // a path of more than one part (~/Documents/…, C:\Users\…): strom's folders kept, the rest masked
    s = s.replace(/(?:~|[A-Za-z]:)?(?:[\\/][^\s\\/"'<>|*?;,]+){2,}[\\/]?/gu, (m) => {
      const end = /[.:)\]]+$/.exec(m)?.[0] ?? "";
      return protect(this.path(m.slice(0, m.length - end.length))) + end;
    });
    s = s.replace(/[\p{L}\p{M}\p{N}]+(?:[._'’:-][\p{L}\p{M}\p{N}]+)*/gu, (w) => (DATE.test(w) || this.isTerm(w) || w.split(/[._'’:-]/).some((p) => /\p{L}/u.test(p) && this.isTerm(p)) ? this.code(w) : w));
    return s.replace(new RegExp(`${PROTECT}(\\d+)${PROTECT}`, "g"), (_m, i: string) => kept[Number(i)] ?? "");
  }

  private quoted(inner: string): string {
    const t = inner.trim();
    // strom's own command or ID quoted: kept as such
    if (ID.test(t) || (NUMBER.test(t) && !DATE.test(t))) return inner;
    if (/^strom(?:\s+[a-z-]+)+$/.test(t) && t.split(/\s+/).every((w) => this.vocabulary.has(w) || w === "strom")) return inner;
    return this.code(t);
  }

  private path(p: string): string {
    const parts = p.split(/([\\/])/);
    // the folder a user's name gives (/Users/<name>, /home/<name>, C:\Users\<name>): masked, whatever word it is
    const named = (i: number) => {
      const before = parts.slice(0, i).filter((x) => x !== "/" && x !== "\\" && x !== "");
      return before.length >= 1 && /^(?:users|home)$/i.test(before[before.length - 1]!) && (before.length === 1 || (before.length === 2 && /^[A-Za-z]:$/.test(before[0]!)));
    };
    return parts
      .map((part, i) => {
        if (part === "/" || part === "\\" || part === "") return part;
        if (named(i)) return this.code(part);
        if (FOLDERS.has(part.toLowerCase()) || /^[A-Za-z]:$/.test(part)) return part;
        if (ID.test(part) || (NUMBER.test(part) && !DATE.test(part))) return part;
        const ext = /^(.+?)(\.[A-Za-z0-9]{1,5})$/.exec(part);
        if (ext && EXTENSION.test(ext[2]!.slice(1))) {
          const base = ext[1]!;
          if (ID.test(base) || /^[\d._:-]+$/.test(base) || /^(?:active|ended)-[A-Z0-9_.-]+$/.test(base)) return part;
          if (/^[a-z][a-z0-9_-]*$/.test(base) && base.split(/[-_]/).every((w) => this.vocabulary.has(w) || /^\d+$/.test(w)) && !this.isTerm(base)) return part;
          return `${this.code(base)}${ext[2]}`;
        }
        if (/^[a-z][a-z0-9_-]*$/.test(part) && part.split(/[-_]/).every((w) => this.vocabulary.has(w) || /^\d+$/.test(w)) && !this.isTerm(part)) return part;
        return this.code(part);
      })
      .join("");
  }

  private word(w: string): string {
    if (ID.test(w) || SECTION.test(w) || ISO_TIME.test(w) || ERRNO.test(w)) return w;
    if (NUMBER.test(w)) return DATE.test(w) ? this.code(w) : w;
    if (DATE.test(w)) return this.code(w);
    // a host (archive.example.org): never a person's
    if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(w) && /[a-z]/.test(w) && !EXTENSION.test(w.slice(w.lastIndexOf(".") + 1)) && !this.isTerm(w.split(".")[0]!)) return w;
    if (this.isTerm(w)) return this.code(w);
    // a word of several parts (not-committed, file.jpg): each part strom's, or a code
    const parts = w.split(/[._'’:-]/);
    if (parts.length > 1) {
      const ext = /^(.+)\.([A-Za-z0-9]{1,5})$/.exec(w);
      if (ext && EXTENSION.test(ext[2]!) && !parts.slice(0, -1).every((p) => this.plain(p))) return `${this.code(ext[1]!)}.${ext[2]}`;
      return parts.every((p) => this.plain(p) || /^\d+$/.test(p)) ? w : this.code(w);
    }
    return this.plain(w) ? w : this.code(w);
  }

  /** One word strom says itself: ASCII, in its vocabulary (lower case, Capitalized, or a short upper-case one). */
  private plain(w: string): boolean {
    if (!/^[A-Za-z]+$/.test(w)) return false;
    if (w.length <= 2) return true;
    const lower = w.toLowerCase();
    if (!this.vocabulary.has(lower)) return false;
    // a program's name written as its makers write it (OpenCode, ChatGPT, PowerShell, macOS)
    return w === lower || w === lower[0]!.toUpperCase() + lower.slice(1) || w.length <= 5 || w === w.toUpperCase() || /^[A-Za-z][a-z]*(?:[A-Z]+[a-z]*)+$/.test(w);
  }

  /**
   * The last look over anything going out: every word of the research (a name, a place) and the home folder masked
   * wherever it stands, whatever masked it before. A word of strom's own that is a name too is masked as well.
   */
  sweep(input: string): string {
    if (!input) return input;
    let s = input.normalize("NFC");
    for (const h of this.homes) s = s.split(h).join("~");
    s = s.replace(/[\p{L}\p{M}\p{N}._%+-]+@[\p{L}\p{M}\p{N}-]+(?:\.[\p{L}\p{M}\p{N}-]+)+/gu, "‹e›");
    if (!this.terms.size) return s;
    // a code already made stays as it is (the letters of ‹bad12› are no word of a place)
    return s.replace(/‹[0-9a-f]{5}›|[\p{L}\p{M}]+/gu, (w) => (w[0] !== "‹" && this.isTerm(w) ? this.code(w) : w));
  }

  /** sweep over every string of a value (keys too). */
  sweepValue<T>(v: T): T {
    if (typeof v === "string") return this.sweep(v) as T;
    if (Array.isArray(v)) return v.map((x) => this.sweepValue(x)) as T;
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[this.sweep(k)] = this.sweepValue(x);
      return out as T;
    }
    return v;
  }
}
