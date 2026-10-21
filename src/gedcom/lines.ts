// GEDCOM line writing: levels, the 255-byte limit, CONC/CONT splitting.
//
// CONC continues the same line (joined with nothing), CONT starts a new line.
// Splits never sit next to a space: a value that begins or ends with a space
// gets trimmed by some readers and two words silently glue together.

export const MAX_LINE_BYTES = 255;

/** Tags whose value may be a pointer (@X@) — everywhere else an "@" is text and is doubled. */
const POINTER_TAGS = new Set(["FAMC", "FAMS", "HUSB", "WIFE", "CHIL", "SOUR", "REPO", "ASSO", "SUBM", "SUBN", "OBJE", "NOTE", "ALIA", "ANCI", "DESI", "_PERS", "_FAM", "_PAR"]);

/** GEDCOM 5.5.1 writes a literal "@" as "@@" (so "@I1@ BIRT" in a note is not a pointer). */
export function escapeAt(tag: string, value: string): string {
  if (POINTER_TAGS.has(tag) && /^@[^@\s]+@$/.test(value)) return value;
  return value.replace(/@/g, "@@");
}

const utf8 = (s: string) => Buffer.byteLength(s, "utf8");

// One character as a reader sees it: a letter with its accents, an emoji with its skin tone, variation selector or
// joined parts, a flag. A line is cut only between two of them, so no reader gets half a UTF-16 pair (U+FFFD) or an
// accent, a skin tone or half a family emoji on a line of its own.
const graphemes = new Intl.Segmenter("und", { granularity: "grapheme" });

/** The first `n` characters of a text, as a reader counts them (never half of one). */
export function clipChars(text: string, n: number): string {
  let out = "";
  let count = 0;
  for (const g of graphemes.segment(text)) {
    if (count++ === n) break;
    out += g.segment;
  }
  return out;
}

/** Split one paragraph into chunks of at most `bytes`, never cutting next to a space. */
export function splitParagraph(text: string, bytes: number): string[] {
  const parts = Array.from(graphemes.segment(text), (g) => g.segment);
  const out: string[] = [];
  // inside an escaped "@@": an odd run of "@" before the cut (readers unescape line by line)
  const inEscape = (cut: number) => {
    let at = 0;
    while (cut - at > 0 && parts[cut - at - 1] === "@") at++;
    return at % 2 === 1;
  };
  const nearSpace = (cut: number) => parts[cut - 1]!.endsWith(" ") || parts[cut]!.startsWith(" ");
  let i = 0;
  while (i < parts.length) {
    let used = 0;
    let end = i;
    while (end < parts.length && used + utf8(parts[end]!) <= bytes) used += utf8(parts[end++]!);
    if (end === parts.length) {
      out.push(parts.slice(i).join(""));
      return out;
    }
    if (end === i) {
      // one character longer than a line (a letter under dozens of marks): only then by code points
      parts.splice(i, 1, ...Array.from(parts[i]!));
      continue;
    }
    let cut = end;
    while (cut > i && (inEscape(cut) || nearSpace(cut))) cut--;
    if (cut === i) for (cut = end; cut > i && inEscape(cut); ) cut--; // a run of spaces: nothing better possible
    if (cut === i) cut = end;
    out.push(parts.slice(i, cut).join(""));
    i = cut;
  }
  return out.length ? out : [""];
}

export class GedWriter {
  readonly lines: string[] = [];

  // Text is written composed (NFC): "č" as one letter, as every reader compares it —
  // whatever form it came in (macOS file names, copied text are often decomposed).
  // A value longer than a line goes on in CONC lines whatever its tag (a long place, name, label): readers join
  // them, the Strom app under PLAC, NAME, TYPE, … too, and a line over 255 bytes is no GEDCOM at all.
  line(level: number, tag: string, value?: string | number): void {
    const v = value === undefined || value === null ? "" : escapeAt(tag, String(value).normalize("NFC").replace(/[\r\n]+/g, " ").trim());
    this.long(level, tag, v);
  }

  /** An escaped value on its line, the rest of it in CONC lines at `conc` (below it; beside a CONT). */
  private long(level: number, tag: string, v: string, conc = level + 1): void {
    if (utf8(`${level} ${tag} ${v}`) <= MAX_LINE_BYTES) return this.raw(level, tag, v);
    const first = splitParagraph(v, MAX_LINE_BYTES - utf8(`${level} ${tag} `))[0] ?? "";
    this.raw(level, tag, first);
    for (const chunk of splitParagraph(v.slice(first.length), MAX_LINE_BYTES - utf8(`${conc} CONC `))) if (chunk) this.raw(conc, "CONC", chunk);
  }

  /** A line whose value is already escaped (continuations of a text). */
  private raw(level: number, tag: string, v: string): void {
    this.lines.push(v ? `${level} ${tag} ${v}` : `${level} ${tag}`);
  }

  /** A record header: "0 @I1@ INDI". */
  record(xref: string, tag: string, value?: string): void {
    this.lines.push(value ? `0 ${xref} ${tag} ${value}` : `0 ${xref} ${tag}`);
  }

  /** A long value with no spaces and no "@" (a data URL): cut into CONC lines of the most that fits. */
  wrapped(level: number, tag: string, value: string): void {
    const first = MAX_LINE_BYTES - utf8(`${level} ${tag} `);
    const next = MAX_LINE_BYTES - utf8(`${level + 1} CONC `);
    this.raw(level, tag, value.slice(0, first));
    for (let i = first; i < value.length; i += next) this.raw(level + 1, "CONC", value.slice(i, i + next));
  }

  /** A tag with free text of any length: CONT for line breaks, CONC for long lines. */
  text(level: number, tag: string, text: string): void {
    const paragraphs = text
      .normalize("NFC")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((p) => p.replace(/\s+/g, " ").trim().replace(/@/g, "@@"));
    paragraphs.forEach((para, i) => {
      if (i === 0) this.long(level, tag, para);
      else this.long(level + 1, "CONT", para, level + 1);
    });
  }

  toString(): string {
    return this.lines.join("\n") + "\n";
  }
}

/** Reassemble a text value from a tag line and its CONC/CONT children (for tests and import). */
export function joinText(value: string, continuation: { tag: string; value: string }[]): string {
  let out = value;
  for (const c of continuation) out += c.tag === "CONT" ? `\n${c.value}` : c.value;
  return out;
}
