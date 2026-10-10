// A text found in the research's own files (strom grep): inputs/, notes/ and output/ of a tree — never data/, .git,
// .strom or anything outside the tree, never through a symbolic link. Found as it reads: in any case, with accents or
// without, composed or not (foldText), or a regular expression (in any case, Unicode). An agent finds a name in a big
// input in one call, instead of reading the file in pieces (found in a live run: 110 reads of three big files).

import fs from "node:fs";
import path from "node:path";
import { foldText, unfoldIndex } from "./text.ts";

/** The folders searched: the research's own text, as the agent may read it. */
export const GREP_FOLDERS = ["inputs", "notes", "output"] as const;
export type GrepFolder = (typeof GREP_FOLDERS)[number];
/** Searched when nothing is said: what the user gave and what the research wrote down (output/ repeats data/). */
export const GREP_DEFAULT: readonly GrepFolder[] = ["inputs", "notes"];

/** A file bigger than this is left out (said). */
export const GREP_MAX_FILE = 64 * 1024 * 1024;
/** Lines found at most: the search stops there (said with a +). */
export const GREP_MAX_HITS = 10_000;
/** Characters of a line shown: a longer one is cut round its find. */
export const LINE_SHOWN = 240;

/** Files that never hold text worth searching (images, archives, office documents in their zip). */
const BINARY = /\.(jpe?g|png|gif|webp|tiff?|bmp|heic|heif|jp2|jpx|pdf|zip|gz|tgz|bz2|xz|7z|rar|docx?|xlsx?|odt|ods|pptx?|mp3|m4a|wav|ogg|flac|mp4|mov|avi|webm|exe|dll|bin|sqlite|db)$/iu;

export interface GrepLine {
  line: number;
  text: string;
}

export interface GrepHit extends GrepLine {
  file: string;
  before?: GrepLine[];
  after?: GrepLine[];
}

export interface GrepResult {
  hits: GrepHit[];
  /** Lines found in each file (in the order searched). */
  counts: Map<string, number>;
  /** Text files searched. */
  searched: number;
  /** Left out: bigger than GREP_MAX_FILE. */
  tooBig: string[];
  /** The search stopped at GREP_MAX_HITS. */
  capped: boolean;
}

/** A line of a file, tree-relative with forward slashes (the same on Windows). */
const rel = (root: string, file: string) => path.relative(root, file).split(path.sep).join("/");

/**
 * Where a search may look, from what --in says: a folder (inputs, notes, output), all of them, or a file or folder
 * inside one of them (tree-relative). Anything else — outside the tree, data/, .git, .strom, through a symbolic link —
 * is refused with the reason.
 */
export function grepTargets(root: string, wanted: readonly string[]): { targets: string[]; error?: string } {
  const out: string[] = [];
  for (const w of wanted.length ? wanted : GREP_DEFAULT) {
    const v = w.trim().replace(/\\/g, "/").replace(/\/+$/u, "");
    if (v === "all") {
      out.push(...GREP_FOLDERS.map((f) => path.join(root, f)));
      continue;
    }
    if (!v || path.isAbsolute(w) || /^\p{L}:/u.test(v) || v.split("/").some((p) => p === ".." || p === "."))
      return { targets: [], error: `--in ${w}: a folder of the research (${GREP_FOLDERS.join(", ")}, all) or a path inside one, as from the tree's folder` };
    const parts = v.split("/");
    if (!(GREP_FOLDERS as readonly string[]).includes(parts[0]!))
      return { targets: [], error: `--in ${w}: only ${GREP_FOLDERS.map((f) => `${f}/`).join(", ")} are searched (data/ through strom find, the records' commands)` };
    // never through a symbolic link: each step from the tree's folder down is what it says it is
    let at = root;
    for (const p of parts) {
      at = path.join(at, p);
      let st: fs.Stats;
      try {
        st = fs.lstatSync(at);
      } catch {
        // a folder of the research it does not have (yet): nothing in it
        if (parts.length === 1) break;
        return { targets: [], error: `--in ${w}: no such file or folder in the research` };
      }
      if (st.isSymbolicLink()) return { targets: [], error: `--in ${w}: a symbolic link — not followed` };
    }
    out.push(at);
  }
  return { targets: [...new Set(out)] };
}

/** The text files under the targets, in order: no dotfiles, no symbolic links, nothing binary. */
function textFiles(targets: string[]): { files: string[]; tooBig: string[] } {
  const files: string[] = [];
  const tooBig: string[] = [];
  const take = (p: string, size: number) => {
    if (BINARY.test(p)) return;
    if (size > GREP_MAX_FILE) return void tooBig.push(p);
    let fd: number | undefined;
    try {
      fd = fs.openSync(p, "r");
      const head = Buffer.alloc(8192);
      const n = fs.readSync(fd, head, 0, head.length, 0);
      if (!head.subarray(0, n).includes(0)) files.push(p);
    } catch {
      // unreadable: not searched
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  };
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (e.name.startsWith(".") || e.isSymbolicLink()) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) take(p, fs.statSync(p).size);
    }
  };
  for (const t of targets) {
    let st: fs.Stats;
    try {
      st = fs.lstatSync(t);
    } catch {
      continue; // a folder the tree does not have (yet)
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(t);
    else if (st.isFile()) take(t, st.size);
  }
  return { files: [...new Set(files)], tooBig };
}

/**
 * The matcher of the patterns: a line matches when any of them is in it (all: every one of them) — as it reads (folded: case, accents, a
 * decomposed letter, runs of white space), or a regular expression (in any case, Unicode). It returns where the first
 * find starts in the line (NFC), or -1.
 */
export function grepMatcher(patterns: readonly string[], regex: boolean, all = false): (line: string) => number {
  if (regex) {
    const res = patterns.map((p) => new RegExp(p.normalize("NFC"), "iu"));
    return (line) => {
      let best = -1;
      for (const re of res) {
        const m = re.exec(line);
        if (!m && all) return -1;
        if (m && (best < 0 || m.index < best)) best = m.index;
      }
      return best;
    };
  }
  const folded = [...new Set(patterns.map(foldText).filter(Boolean))];
  return (line) => {
    const f = foldText(line);
    let best = -1;
    for (const q of folded) {
      const at = f.indexOf(q);
      // all: a line with every one of them (in any order), shown from the first
      if (at < 0 && all) return -1;
      if (at >= 0 && (best < 0 || at < best)) best = at;
    }
    return best < 0 ? -1 : unfoldIndex(line, best);
  };
}

/** A line as shown: in one piece when short, else cut round where the find is (never inside a letter). */
export function shownLine(line: string, at = 0, max = LINE_SHOWN): string {
  const chars = [...line];
  if (chars.length <= max) return line;
  // the find's place in characters, not in UTF-16 units
  const atChar = [...line.slice(0, Math.max(0, at))].length;
  const from = Math.max(0, Math.min(atChar - Math.floor(max / 3), chars.length - max));
  const to = Math.min(chars.length, from + max);
  return `${from > 0 ? "…" : ""}${chars.slice(from, to).join("")}${to < chars.length ? "…" : ""}`;
}

/** Every line of the targets' text files that matches, with `context` lines before and after it. */
export function grepFiles(root: string, targets: string[], match: (line: string) => number, context = 0): GrepResult {
  const { files, tooBig } = textFiles(targets);
  const hits: GrepHit[] = [];
  const counts = new Map<string, number>();
  let capped = false;
  for (const file of files) {
    if (capped) break;
    let text: string;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const all = text.replace(/^﻿/u, "").split(/\r\n|\n|\r/u);
    const name = rel(root, file);
    for (let i = 0; i < all.length; i++) {
      const line = all[i]!.normalize("NFC");
      const at = match(line);
      if (at < 0) continue;
      const around = (from: number, to: number): GrepLine[] =>
        all.slice(Math.max(0, from), Math.max(0, to)).map((t, k) => ({ line: Math.max(0, from) + k + 1, text: shownLine(t.normalize("NFC")) }));
      hits.push({
        file: name,
        line: i + 1,
        text: shownLine(line, at),
        ...(context ? { before: around(i - context, i), after: around(i + 1, Math.min(all.length, i + 1 + context)) } : {}),
      });
      counts.set(name, (counts.get(name) ?? 0) + 1);
      if (hits.length >= GREP_MAX_HITS) {
        capped = true;
        break;
      }
    }
  }
  return { hits, counts, searched: files.length, tooBig: tooBig.map((f) => rel(root, f)), capped };
}

/**
 * The hits as grep shows them: "file:line: text" for a line found, "file-line- text" for a line round it, "--"
 * between stretches that do not touch; a line round two finds is shown once.
 */
export function grepLines(hits: GrepHit[]): string[] {
  const out: string[] = [];
  const shown = new Map<string, number>(); // "file\nline" → its place in out
  const withContext = hits.some((h) => h.before || h.after);
  let last: { file: string; line: number } | undefined;
  for (const h of hits) {
    const rows = [
      ...(h.before ?? []).map((l) => ({ ...l, hit: false })),
      { line: h.line, text: h.text, hit: true },
      ...(h.after ?? []).map((l) => ({ ...l, hit: false })),
    ];
    for (const r of rows) {
      const key = `${h.file}\n${r.line}`;
      const row = `${h.file}${r.hit ? ":" : "-"}${r.line}${r.hit ? ":" : "-"} ${r.text}`;
      const i = shown.get(key);
      if (i !== undefined) {
        // a line shown round the find before, that is a find itself: marked as one
        if (r.hit) out[i] = row;
        continue;
      }
      if (withContext && last && (last.file !== h.file || r.line > last.line + 1)) out.push("--");
      shown.set(key, out.length);
      out.push(row);
      last = { file: h.file, line: r.line };
    }
  }
  return out;
}
