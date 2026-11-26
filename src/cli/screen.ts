// How a screen of the menu is drawn for a person (spec 144): the place in the menu (crumbs), a short summary, the
// options as `[1]  Label   value  extra`, [0] last, the prompt saying what Enter does, a command on a line of its own.
// The meaning is in the shape — `[1]`, `$ `, `! `, `✓ `, `›` — never in a colour: colours only add to it, and only
// on a person's terminal (no NO_COLOR, not dumb, not an agent); off a terminal the same text, never wrapped.
// Windows' old console (conhost): no faint text, ✓ ✗ as ASCII (its font has no such glyph).

export type Role =
  /** a key to press: [1] [d] */
  | "key"
  /** the way to this screen; the last part is crumbLast */
  | "crumb"
  | "crumbLast"
  | "heading"
  /** a state, a count: the column of values */
  | "value"
  /** what an item holds, said by the way */
  | "dim"
  /** a command to type: $ strom … */
  | "command"
  | "ok"
  | "warn"
  | "err"
  | "text";

export interface Span {
  text: string;
  role: Role;
}

export interface Style {
  /** ANSI colours and weights. */
  color: boolean;
  /** Faint text shows (SGR 2; the old Windows console ignores it). */
  faint: boolean;
  /** ✓ ✗ ⛔ said in ASCII (the old Windows console's font has none of them). */
  ascii: boolean;
  /** The terminal's columns now (undefined: not a terminal — nothing is wrapped). */
  columns: () => number | undefined;
}

/** Off a terminal: the text as it is, no colour, no wrapping. */
export const PLAIN: Style = { color: false, faint: false, ascii: false, columns: () => undefined };

/** The widest a screen is drawn, and the narrowest it is taken to be. */
export const MAX_WIDTH = 100;
export const MIN_WIDTH = 60;

/** The width a screen is drawn in: the terminal's, 60…100; Infinity off a terminal (never wrapped). */
export function widthOf(style: Style): number {
  const c = style.columns();
  if (c === undefined || !Number.isFinite(c) || c <= 0) return Infinity;
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(c)));
}

/**
 * The old Windows console (conhost), not Windows Terminal, VS Code's terminal, ConEmu or a terminal of Git Bash/MSYS
 * (they say who they are): no faint text, ✓ ✗ as ASCII.
 */
export function oldConsole(env: Record<string, string | undefined>, platform: NodeJS.Platform): boolean {
  if (platform !== "win32") return false;
  return !env.WT_SESSION && !env.TERM_PROGRAM && !env.ConEmuPID && !env.ConEmuANSI && !env.TERM && !env.ALACRITTY_LOG && !env.WEZTERM_PANE;
}

/**
 * The style of a person's terminal. Colours: a terminal (stdin and stdout), no NO_COLOR, TERM not dumb, not an agent's
 * shell; FORCE_COLOR=0/false turns them off, any other FORCE_COLOR on — on a terminal still (the menu is a person's).
 */
export function terminalStyle(o: { tty: boolean; env: Record<string, string | undefined>; platform: NodeJS.Platform; columns: () => number | undefined; agent: boolean }): Style {
  if (!o.tty) return PLAIN;
  const env = o.env;
  const forced = env.FORCE_COLOR;
  const off = env.NO_COLOR !== undefined && env.NO_COLOR !== "" ? true : forced === "0" || forced === "false" ? true : env.TERM === "dumb";
  const old = oldConsole(env, o.platform);
  return { color: !off && !o.agent, faint: !old, ascii: old, columns: o.columns };
}

const SGR: Partial<Record<Role, string>> = {
  key: "1",
  crumb: "2",
  crumbLast: "1",
  heading: "1",
  dim: "2",
  command: "36",
  ok: "32",
  warn: "1",
  err: "31",
};

/** The marks the old console cannot show, in ASCII. */
export function asciiMarks(s: string): string {
  return s.replace(/✓/gu, "+").replace(/✗/gu, "x").replace(/⛔️?/gu, "!");
}

/** The characters a text takes on the screen (code points; a combining mark takes none). */
export function shown(s: string): number {
  let n = 0;
  for (const ch of s) if (!/\p{M}/u.test(ch)) n++;
  return n;
}

/** Spans as the terminal gets them: coloured only with style.color (faint only where it shows). */
export function paint(spans: readonly Span[], style: Style): string {
  let out = "";
  for (const sp of spans) {
    const text = style.ascii ? asciiMarks(sp.text) : sp.text;
    const code = SGR[sp.role];
    if (!style.color || !code || !text.trim() || (code === "2" && !style.faint)) out += text;
    else out += `\x1b[${code}m${text}\x1b[0m`;
  }
  return out;
}

/** Spans joined to their plain text. */
export function plain(spans: readonly Span[]): string {
  return spans.map((s) => s.text).join("");
}

/**
 * Spans as lines of at most `width` characters: broken between words, a line after the first starting at `hang`
 * (under the text, never under the key). A command is never broken (it is copied whole): a longer one runs over.
 */
export function wrap(spans: readonly Span[], width: number, hang = 0): Span[][] {
  const text = plain(spans);
  if (!Number.isFinite(width) || shown(text) <= width) return [spans.filter((s) => s.text)];
  // the words, each with its role (a span is cut where its words are), commands as one word
  // `space`: the spaces after the word as written (a column's padding kept where the line is not broken)
  type Word = { parts: Span[]; space: string };
  const words: Word[] = [];
  let lead = "";
  let first = true;
  for (const sp of spans) {
    if (!sp.text) continue;
    const pieces = sp.role === "command" ? [sp.text] : sp.text.split(/( +)/u);
    for (const piece of pieces) {
      if (!piece) continue;
      if (/^ +$/u.test(piece)) {
        if (first && !words.length) lead += piece;
        else if (words.length) words[words.length - 1]!.space += piece;
        continue;
      }
      first = false;
      const last = words[words.length - 1];
      if (last && !last.space) last.parts.push({ text: piece, role: sp.role });
      else words.push({ parts: [{ text: piece, role: sp.role }], space: "" });
    }
  }
  // under its text, unless that leaves the rest less than 24 columns
  const h = Math.max(0, Math.min(hang, width - 24));
  const lines: Span[][] = [];
  let line: Span[] = lead ? [{ text: lead, role: "text" }] : [];
  let used = shown(lead);
  let empty = true;
  let gap = "";
  for (const w of words) {
    const size = shown(plain(w.parts));
    if (!empty && used + gap.length + size > width) {
      lines.push(line);
      line = h ? [{ text: " ".repeat(h), role: "text" }] : [];
      used = h;
      empty = true;
    }
    if (!empty) {
      line.push({ text: gap, role: "text" });
      used += gap.length;
    }
    line.push(...w.parts);
    used += size;
    gap = w.space;
    empty = false;
  }
  lines.push(line);
  return lines.map(merge);
}

/** Neighbouring spans of one role as one. */
function merge(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && last.role === s.role) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/** A line of spans drawn: wrapped to the screen (hang under its text), painted. */
export function line(spans: readonly Span[], style: Style, hang = 0): string {
  return wrap(spans, widthOf(style), hang)
    .map((l) => paint(l, style).trimEnd())
    .join("\n");
}

/** One option of a screen. */
export interface Option {
  key: string;
  label: string;
  /** Its state or count: in the column of values. */
  value?: string | undefined;
  /** What it holds, said by the way (faint). */
  extra?: string | undefined;
}

/** The column of values is never further than this from the label's start. */
const LABEL_MAX = 34;

/**
 * The options: `  [1]  Label        value  extra`, the keys aligned right ([9], [10]), the values in one column after
 * the longest label (a longer label: its value after ` · `); [0] last, a blank line before it.
 */
export function optionLines(options: readonly Option[], style: Style): string[] {
  const keyw = Math.max(0, ...options.map((o) => o.key.length + 2));
  const pre = 2 + keyw + 2;
  const valued = options.filter((o) => o.value || o.extra);
  const col = valued.length ? Math.min(LABEL_MAX, Math.max(...valued.map((o) => shown(o.label)))) : 0;
  const out: string[] = [];
  for (const [i, o] of options.entries()) {
    if (o.key === "0" && i === options.length - 1 && i > 0) out.push("");
    const spans: Span[] = [{ text: "  " + " ".repeat(keyw - o.key.length - 2), role: "text" }, { text: `[${o.key}]`, role: "key" }, { text: "  ", role: "text" }, { text: o.label, role: "text" }];
    let hang = pre;
    if (o.value || o.extra) {
      const len = shown(o.label);
      spans.push({ text: len <= col ? " ".repeat(col - len + 2) : " · ", role: "text" });
      if (o.value) spans.push({ text: o.value, role: "value" });
      if (o.extra) spans.push({ text: (o.value ? "  " : "") + o.extra, role: "dim" });
      // what a value or its aside says further: under the column of values
      if (len <= col) hang = pre + col + 2;
    }
    out.push(line(spans, style, hang));
  }
  return out;
}

/** The way to this screen: Strom › Settings › Maintenance — the last part bold, `more` faint after it. */
export function crumbLine(parts: readonly string[], style: Style, more?: string): string {
  const spans: Span[] = [];
  for (const [i, p] of parts.entries()) {
    if (i) spans.push({ text: " › ", role: "crumb" });
    spans.push({ text: p, role: i === parts.length - 1 ? "crumbLast" : "crumb" });
  }
  if (more) spans.push({ text: ` ${more}`, role: "dim" });
  return line(spans, style, 2);
}

/** A heading of a part of a screen, its count (faint) after it. */
export function headingLine(text: string, style: Style, count?: string): string {
  return line([{ text, role: "heading" }, ...(count ? [{ text: `  ${count}`, role: "value" as const }] : [])], style, 2);
}

/** A command to copy, on a line of its own: `    $ strom …`, never wrapped, nothing after it. */
export function commandLine(command: string, style: Style, indent = 4): string {
  return paint([{ text: " ".repeat(indent), role: "text" }, { text: `$ ${command}`, role: "command" }], style);
}

/** The label of an option as Enter's prompt and a crumb say it: up to its first aside (" (", ": ", " · ", " – "). */
export function shortLabel(label: string, max = 28, firstWord = false): string {
  let s = label.split("\n")[0]!;
  const cut = /\s\(|:\s|\s·\s|\s[–—]\s|…|\s\[/u.exec(s);
  if (cut) s = s.slice(0, cut.index);
  s = s.trim();
  if (shown(s) <= max) return s;
  // a prompt says the option's first word (Enter = 1 Continue), whole
  const word = s.split(/\s+/u)[0]!;
  if (firstWord && shown(word) <= max) return word;
  const words = s.split(/\s+/u);
  let out = "";
  for (const w of words) {
    if (shown(out ? `${out} ${w}` : w) > max - 1) break;
    out = out ? `${out} ${w}` : w;
  }
  return `${out || [...s].slice(0, max - 1).join("")}…`;
}

/**
 * Where a text names a command (strom, or the installation's own name: strom-beta) — `strom` and its words up to the
 * first one that is a sentence's again: its subcommand words, then only what a command takes (an option, an ID, a
 * value in quotes or <…>, a word with - . / : = in it, a number, an option's value). [start, end) of each.
 */
export function commandsIn(text: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /(^|[\s"'`(\[→:=„“«»‚‘])(strom(?:-[\p{L}\p{N}]+)?) (?=[\p{Ll}])/gu;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const start = m.index + m[1]!.length;
    let end = start + m[2]!.length;
    let i = end;
    let n = 0;
    let afterOption = false;
    for (;;) {
      const rest = text.slice(i);
      const tok = /^ ("[^"]*"|'[^']*'|<[^>]*>|[^\s,;)]+)/u.exec(rest);
      if (!tok) break;
      let word = tok[1]!;
      const sentenceEnd = /[.!?:]$/u.test(word) && !/^["'<]/u.test(word);
      if (sentenceEnd) word = word.slice(0, -1);
      const commandish =
        (n < 2 && /^[\p{Ll}][\p{Ll}-]*$/u.test(word) && /^[a-z-]+$/u.test(word)) ||
        /^-/u.test(word) ||
        /^["'<]/u.test(word) ||
        /^\p{Lu}{1,2}\d+/u.test(word) ||
        /^\d/u.test(word) ||
        /[-./:=@_\\]/u.test(word) ||
        (afterOption && shown(word) >= 2);
      if (!commandish || !word) break;
      afterOption = /^--?[\p{L}-]+$/u.test(word);
      end = i + 1 + word.length;
      i = end;
      n++;
      if (sentenceEnd) break;
    }
    if (n) out.push([start, end]);
    re.lastIndex = Math.max(re.lastIndex, end);
  }
  return out;
}

/**
 * A line of output as a person's terminal shows it: ✓ … green (the mark and its first word), ✗ … red, ! bold, the
 * commands it names cyan. Lines already coloured, and JSON, stay as they are.
 */
export function decorateLine(text: string, style: Style): string {
  if (!style.color) return style.ascii ? asciiMarks(text) : text;
  if (text.includes("\x1b") || /^\s*[{[]/u.test(text)) return style.ascii ? asciiMarks(text) : text;
  const spans: Span[] = [];
  let at = 0;
  const mark = /^(\s*)(✓|✗|!|⛔️?)( )/u.exec(text);
  if (mark) {
    const firstWord = /^[^\s]+/u.exec(text.slice(mark[0].length))?.[0] ?? "";
    const role: Role = mark[2] === "✓" ? "ok" : mark[2] === "!" ? "warn" : "err";
    spans.push({ text: mark[1]!, role: "text" }, { text: mark[2]! + mark[3]! + (role === "ok" ? firstWord : ""), role });
    at = mark[0].length + (role === "ok" ? firstWord.length : 0);
  }
  const rest = text.slice(at);
  let i = 0;
  for (const [s, e] of commandsIn(rest)) {
    if (s > i) spans.push({ text: rest.slice(i, s), role: "text" });
    spans.push({ text: rest.slice(s, e), role: "command" });
    i = e;
  }
  if (i < rest.length) spans.push({ text: rest.slice(i), role: "text" });
  return paint(spans, style);
}

/** What strom writes to a person's terminal, line by line decorated (decorateLine). */
export function decorate(text: string, style: Style): string {
  if (!style.color && !style.ascii) return text;
  return text
    .split("\n")
    .map((l) => decorateLine(l, style))
    .join("\n");
}

/** A text whose keys ([d], [?], [10-20]) are keys: the rest in `role`. */
export function keyed(text: string, role: Role = "text"): Span[] {
  const out: Span[] = [];
  let i = 0;
  for (const m of text.matchAll(/\[[^\]\s]{1,8}\]/gu)) {
    if (m.index! > i) out.push({ text: text.slice(i, m.index), role });
    out.push({ text: m[0], role: "key" });
    i = m.index! + m[0].length;
  }
  if (i < text.length) out.push({ text: text.slice(i), role });
  return out;
}

/** A row of a list: its key, a name in a column (wrapped within it on a terminal), a count right-aligned, a detail. */
export interface ListRow {
  key: string;
  name: string;
  count: string;
  detail?: string | undefined;
}

/** The widest a name column of a list is. */
const NAME_MAX = 40;

/**
 * A list's rows under headings: `   [1]  Name             2  detail`, the keys aligned right, the counts in one
 * column on the right of the names (a heading's count in it too); a name longer than the column wraps within it on a
 * terminal, off one it stays whole and its count follows after ` · `. The detail is cut to the screen (never off one).
 */
export function listLines(parts: readonly { heading?: { text: string; aside?: string | undefined; count: string } | undefined; rows: readonly ListRow[] }[], style: Style): string[] {
  const all = parts.flatMap((p) => p.rows);
  const keyw = Math.max(3, ...all.map((r) => r.key.length + 2));
  const countw = Math.max(1, ...all.map((r) => shown(r.count)), ...parts.map((p) => (p.heading ? shown(p.heading.count) : 0)));
  const lead = 2 + keyw + 2; // where a name starts
  const width = widthOf(style);
  // a narrow terminal: the names' column gives way, so that what the rows hold keeps room of its own (at least 16)
  const fits = Number.isFinite(width) ? width - lead - 2 - countw - 2 - 16 : NAME_MAX;
  const col = Math.min(NAME_MAX, Math.max(12, fits), Math.max(0, ...all.map((r) => shown(r.name))));
  const out: string[] = [];
  for (const [n, p] of parts.entries()) {
    if (p.heading) {
      if (n) out.push("");
      const h = p.heading;
      const text = h.text + (h.aside ? ` ${h.aside}` : "");
      const end = lead + col + 2 + countw;
      const pad = Math.max(2, end - shown(text) - shown(h.count));
      out.push(paint([{ text: h.text, role: "heading" }, ...(h.aside ? [{ text: ` ${h.aside}`, role: "dim" as const }] : []), { text: " ".repeat(pad), role: "text" }, { text: h.count, role: "value" }], style).trimEnd());
    }
    for (const r of p.rows) {
      const keySpans: Span[] = [{ text: " ".repeat(2 + keyw - r.key.length - 2), role: "text" }, { text: `[${r.key}]`, role: "key" }, { text: "  ", role: "text" }];
      const count = " ".repeat(countw - shown(r.count)) + r.count;
      const room = Number.isFinite(width) ? width - (lead + col + 2 + countw + 2) : Infinity;
      const detail = r.detail === undefined || room < 4 ? undefined : Number.isFinite(room) ? cut(r.detail, room) : r.detail;
      const tail: Span[] = [{ text: count, role: "value" }, ...(detail ? [{ text: `  ${detail}`, role: "dim" as const }] : [])];
      if (shown(r.name) <= col) {
        out.push(paint([...keySpans, { text: r.name + " ".repeat(col - shown(r.name) + 2), role: "text" }, ...tail], style).trimEnd());
        continue;
      }
      if (!Number.isFinite(width)) {
        // off a terminal: the name whole, its count after it
        out.push(paint([...keySpans, { text: r.name, role: "text" }, { text: " · ", role: "text" }, { text: r.count, role: "value" }, ...tail.slice(1)], style).trimEnd());
        continue;
      }
      const lines = wrap([{ text: r.name, role: "text" }], col, 0).map((l) => plain(l));
      out.push(paint([...keySpans, { text: lines[0]! + " ".repeat(Math.max(0, col - shown(lines[0]!)) + 2), role: "text" }, ...tail], style).trimEnd());
      for (const l of lines.slice(1)) out.push(" ".repeat(lead) + l.trimEnd());
    }
  }
  return out;
}

/** A text cut to at most `max` characters, … at its end. */
export function cut(text: string, max: number): string {
  return shown(text) <= max ? text : `${[...text].slice(0, Math.max(1, max - 1)).join("").trimEnd()}…`;
}
