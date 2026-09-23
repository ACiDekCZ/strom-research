// GEDCOM line writing: levels, the 255-byte limit, CONC/CONT splitting.
//
// CONC continues the same line (joined with nothing), CONT starts a new line.
// Splits never sit next to a space: a value that begins or ends with a space
// gets trimmed by some readers and two words silently glue together.

export const MAX_LINE_BYTES = 255;

/** Tags whose value may be a pointer (@X@) — everywhere else an "@" is text and is doubled. */
const POINTER_TAGS = new Set(["FAMC", "FAMS", "HUSB", "WIFE", "CHIL", "SOUR", "REPO", "ASSO", "SUBM", "SUBN", "OBJE", "NOTE", "ALIA", "ANCI", "DESI"]);

/** GEDCOM 5.5.1 writes a literal "@" as "@@" (so "@I1@ BIRT" in a note is not a pointer). */
export function escapeAt(tag: string, value: string): string {
  if (POINTER_TAGS.has(tag) && /^@[^@\s]+@$/.test(value)) return value;
  return value.replace(/@/g, "@@");
}

const utf8 = (s: string) => Buffer.byteLength(s, "utf8");

/** Longest prefix of `s` (in whole code points) that fits in `bytes`. */
function fit(s: string, bytes: number): number {
  let used = 0;
  let i = 0;
  for (const ch of s) {
    const b = utf8(ch);
    if (used + b > bytes) break;
    used += b;
    i += ch.length;
  }
  return i;
}

/** Split one paragraph into chunks of at most `bytes`, never cutting next to a space. */
export function splitParagraph(text: string, bytes: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (utf8(rest) > bytes) {
    let cut = fit(rest, bytes);
    // never next to a space, never between the two halves of an escaped "@@", never
    // between a letter and its accent (a combining mark with no precomposed form)
    while (cut > 1 && (rest[cut - 1] === " " || rest[cut] === " " || (rest[cut - 1] === "@" && rest[cut] === "@") || /^\p{M}/u.test(rest.slice(cut)))) cut--;
    if (cut <= 1) cut = fit(rest, bytes); // a run of spaces: nothing better possible
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  out.push(rest);
  return out;
}

export class GedWriter {
  readonly lines: string[] = [];

  // Text is written composed (NFC): "č" as one letter, as every reader compares it —
  // whatever form it came in (macOS file names, copied text are often decomposed).
  line(level: number, tag: string, value?: string | number): void {
    const v = value === undefined || value === null ? "" : escapeAt(tag, String(value).normalize("NFC").replace(/[\r\n]+/g, " ").trim());
    this.lines.push(v ? `${level} ${tag} ${v}` : `${level} ${tag}`);
  }

  /** A line whose value is already escaped (continuations of a text). */
  private raw(level: number, tag: string, v: string): void {
    this.lines.push(v ? `${level} ${tag} ${v}` : `${level} ${tag}`);
  }

  /** A record header: "0 @I1@ INDI". */
  record(xref: string, tag: string, value?: string): void {
    this.lines.push(value ? `0 ${xref} ${tag} ${value}` : `0 ${xref} ${tag}`);
  }

  /** A tag with free text of any length: CONT for line breaks, CONC for long lines. */
  text(level: number, tag: string, text: string): void {
    const paragraphs = text
      .normalize("NFC")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((p) => p.replace(/\s+/g, " ").trim().replace(/@/g, "@@"));
    paragraphs.forEach((para, i) => {
      const lineTag = i === 0 ? tag : "CONT";
      const lvl = i === 0 ? level : level + 1;
      const first = splitParagraph(para, MAX_LINE_BYTES - utf8(`${lvl} ${lineTag} `))[0] ?? "";
      this.raw(lvl, lineTag, first);
      const rest = para.slice(first.length);
      for (const chunk of splitParagraph(rest, MAX_LINE_BYTES - utf8(`${level + 1} CONC `))) if (chunk) this.raw(level + 1, "CONC", chunk);
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
