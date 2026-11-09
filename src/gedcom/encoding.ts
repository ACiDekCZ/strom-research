// A GEDCOM file's bytes as text, by the same rule as the Strom app (its decodeGedcomBytes): a byte order mark wins,
// valid UTF-8 is UTF-8 whatever the header says, otherwise HEAD > CHAR names the code page (CP1250, WINDOWS-1250,
// ANSEL, ISO-8859-2, …), and "ANSI", no CHAR or a wrong "UTF-8" label decide between Windows-1250 (Central Europe)
// and Windows-1252 (Western Europe) by the words of the file. Czech and Polish Windows programs write "1 CHAR ANSI"
// meaning their own code page; read as Windows-1252 their "ř" came out as "ø".

/** The encodings a GEDCOM file is read in. */
export type GedcomEncoding = "utf-8" | "utf-16le" | "utf-16be" | "ansel" | "windows-1250" | "windows-1252" | "iso-8859-2";

/** A single-byte code page (the encodings a person is told of). */
export type CodePage = Exclude<GedcomEncoding, "utf-8" | "utf-16le" | "utf-16be">;

/** A decoded GEDCOM file and how its encoding was settled. */
export interface GedcomDecoding {
  text: string;
  encoding: GedcomEncoding;
  /** The HEAD > CHAR value as written in the file, or null when it names none. */
  declared: string | null;
  /** bom = byte order mark; declared = CHAR named it; content = told from the bytes. */
  how: "bom" | "declared" | "content";
  /** The file has bytes outside ASCII, i.e. the encoding matters for the text at all. */
  nonAscii: boolean;
  /**
   * Characters the decoding could not make into letters: U+FFFD, a lone surrogate, a C1 control (a byte the code page
   * has no letter for). Never replaced in silence: whoever reads the file says how many.
   */
  unreadable: number;
}

/** ANSEL (ANSI Z39.47 / MARC-8 extended Latin) → Unicode, spacing characters; with the GEDCOM addition 0xCF (ß). */
const ANSEL_SPACING: Record<number, string> = {
  0xa1: "Ł", 0xa2: "Ø", 0xa3: "Đ", 0xa4: "Þ", 0xa5: "Æ",
  0xa6: "Œ", 0xa7: "ʹ", 0xa8: "·", 0xa9: "♭", 0xaa: "®",
  0xab: "±", 0xac: "Ơ", 0xad: "Ư", 0xae: "ʼ",
  0xb0: "ʻ", 0xb1: "ł", 0xb2: "ø", 0xb3: "đ", 0xb4: "þ",
  0xb5: "æ", 0xb6: "œ", 0xb7: "ʺ", 0xb8: "ı", 0xb9: "£",
  0xba: "ð", 0xbc: "ơ", 0xbd: "ư",
  0xc0: "°", 0xc1: "ℓ", 0xc2: "℗", 0xc3: "©", 0xc4: "♯",
  0xc5: "¿", 0xc6: "¡", 0xcf: "ß",
};

/**
 * ANSEL combining diacritics → Unicode combining characters. In ANSEL the mark comes BEFORE its base letter; Unicode
 * puts it after, so the decoder holds pending marks until the base letter arrives.
 */
const ANSEL_COMBINING: Record<number, string> = {
  0xe0: "̉", 0xe1: "̀", 0xe2: "́", 0xe3: "̂", 0xe4: "̃", 0xe5: "̄", 0xe6: "̆",
  0xe7: "̇", 0xe8: "̈", 0xe9: "̌", 0xea: "̊", 0xeb: "︠", 0xec: "︡", 0xed: "̕",
  0xee: "̋", 0xef: "̐", 0xf0: "̧", 0xf1: "̨", 0xf2: "̣", 0xf3: "̤", 0xf4: "̥",
  0xf5: "̳", 0xf6: "̲", 0xf7: "̦", 0xf8: "̜", 0xf9: "̮", 0xfa: "︢", 0xfb: "︣",
  0xfe: "̓",
};

/** ANSEL bytes as NFC text ("caron c" → "č"); a byte ANSEL has no character for: U+FFFD. */
export function decodeAnsel(bytes: Uint8Array): string {
  let out = "";
  let pending = "";
  for (const b of bytes) {
    if (b < 0x80) {
      out += String.fromCharCode(b) + pending;
      pending = "";
    } else if (ANSEL_COMBINING[b]) pending += ANSEL_COMBINING[b];
    else {
      out += (ANSEL_SPACING[b] ?? "\uFFFD") + pending;
      pending = "";
    }
  }
  // a mark with no base letter (a file cut short) is kept; NFC leaves it be
  return (out + pending).normalize("NFC");
}

/** CHAR values (upper case, spaces and underscores dropped) that name one encoding outright. */
const DECLARED: Record<string, GedcomEncoding> = {
  ANSEL: "ansel",
  "UTF-8": "utf-8", UTF8: "utf-8",
  CP1250: "windows-1250", "CP-1250": "windows-1250", "WINDOWS-1250": "windows-1250",
  WINDOWS1250: "windows-1250", WIN1250: "windows-1250", "WIN-1250": "windows-1250", "MS-EE": "windows-1250",
  CP1252: "windows-1252", "CP-1252": "windows-1252", "WINDOWS-1252": "windows-1252",
  WINDOWS1252: "windows-1252", WIN1252: "windows-1252", "WIN-1252": "windows-1252",
  // Latin-1 is read as Windows-1252, as every browser does (a superset for text)
  "ISO-8859-1": "windows-1252", "ISO8859-1": "windows-1252", LATIN1: "windows-1252", "LATIN-1": "windows-1252",
  "ISO-8859-2": "iso-8859-2", "ISO8859-2": "iso-8859-2", LATIN2: "iso-8859-2", "LATIN-2": "iso-8859-2",
};

/**
 * The UTF-8 of the bytes: its well-formed sequences of more than one byte, and the bytes no sequence takes. A text in
 * a single-byte code page has practically none of the first; a UTF-8 file with a stray byte or two has many of them.
 */
function utf8Shape(bytes: Uint8Array): { good: number; bad: number } {
  let good = 0;
  let bad = 0;
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    if (b < 0x80) {
      i++;
      continue;
    }
    const len = b >= 0xc2 && b <= 0xdf ? 2 : b >= 0xe0 && b <= 0xef ? 3 : b >= 0xf0 && b <= 0xf4 ? 4 : 0;
    let ok = len > 0 && i + len <= bytes.length;
    for (let k = 1; ok && k < len; k++) ok = (bytes[i + k]! & 0xc0) === 0x80;
    // the shortest form only, no surrogates, nothing beyond U+10FFFF
    const c1 = bytes[i + 1] ?? 0;
    if (ok && b === 0xe0 && c1 < 0xa0) ok = false;
    if (ok && b === 0xed && c1 > 0x9f) ok = false;
    if (ok && b === 0xf0 && c1 < 0x90) ok = false;
    if (ok && b === 0xf4 && c1 > 0x8f) ok = false;
    if (ok) {
      good++;
      i += len;
    } else {
      bad++;
      i++;
    }
  }
  return { good, bad };
}

// Byte classes for telling Windows-1250 from Windows-1252 when a file only says "ANSI". The two code pages agree on
// á é í ó ú ý ä ö ü ß š ž and differ on the rest.
/** Letters in 1250 (ť ź Ť Ź Ł Ą Ż ł ą ľ Ľ ż), symbols or nothing in 1252 (¹ ³ ¿ £ …): a strong 1250 sign. */
const CP1250_ONLY_LETTERS = new Set([0x8d, 0x8f, 0x9d, 0x9f, 0xa3, 0xa5, 0xaf, 0xb3, 0xb9, 0xbc, 0xbe, 0xbf]);
/** Czech and Slovak letters (č ě ř ů ň ď and capitals) that read as è ì ø ù ò ï in 1252. */
const CP1250_CORE = new Set([0xe8, 0xec, 0xf8, 0xf9, 0xf2, 0xef, 0xc8, 0xcc, 0xd8, 0xd9, 0xd2, 0xcf]);
/** The same byte in both code pages, frequent in Czech and Slovak words: š ž Š Ž á í ý ú Á Í Ý Ú. */
const CENTRAL_COMPANIONS = new Set([0x8a, 0x8e, 0x9a, 0x9e, 0xe1, 0xed, 0xfd, 0xfa, 0xc1, 0xcd, 0xdd, 0xda]);
/** Western companions of è and its kin: à ç ê é À Ç Ê É œ Œ. */
const WESTERN_COMPANIONS = new Set([0xe0, 0xe7, 0xea, 0xe9, 0xc0, 0xc7, 0xca, 0xc9, 0x9c, 0x8c]);
/** Italian and French final grave vowels: à è ì ò ù. */
const WESTERN_FINAL = new Set([0xe0, 0xe8, 0xec, 0xf2, 0xf9]);

/** A byte that is part of a word in either code page (bytes, not text: no letter classes to ask). */
function isWordByte(b: number): boolean {
  return (
    (b >= 0x41 && b <= 0x5a) ||
    (b >= 0x61 && b <= 0x7a) ||
    (b >= 0xc0 && b !== 0xd7 && b !== 0xf7) ||
    b === 0x8a || b === 0x8c || b === 0x8e || b === 0x9a || b === 0x9c || b === 0x9e ||
    CP1250_ONLY_LETTERS.has(b)
  );
}

/**
 * Windows-1250 or Windows-1252, by the words of the file. A word votes 1250 when it holds a letter only 1250 has
 * (ł ą ż ť …) or a Czech or Slovak letter next to š ž á í ý ú; it votes 1252 when è-like letters sit next to Western
 * companions ("Thérèse", "François") or end an Italian or French word ("Niccolò"). Words with neither ("Matěj") do not
 * vote. No votes keeps the GEDCOM meaning of ANSI (1252).
 */
export function guessSingleByteEncoding(bytes: Uint8Array): "windows-1250" | "windows-1252" {
  let votes1250 = 0;
  let votes1252 = 0;
  let i = 0;
  while (i < bytes.length) {
    if (!isWordByte(bytes[i]!)) {
      i++;
      continue;
    }
    const start = i;
    while (i < bytes.length && isWordByte(bytes[i]!)) i++;
    let strong = false;
    let core = false;
    let central = false;
    let western = false;
    for (let j = start; j < i; j++) {
      const b = bytes[j]!;
      if (CP1250_ONLY_LETTERS.has(b)) {
        // a Spanish "¿Quién": ¿ opens a word and a capital follows; a Polish "żona" has a small letter after ż
        const next = bytes[j + 1] ?? 0;
        if (!(b === 0xbf && j === start && !(next >= 0x61 && next <= 0x7a))) strong = true;
      }
      if (CP1250_CORE.has(b)) core = true;
      if (CENTRAL_COMPANIONS.has(b)) central = true;
      if (WESTERN_COMPANIONS.has(b)) western = true;
    }
    const last = bytes[i - 1]!;
    const finalGrave = i - start >= 3 && WESTERN_FINAL.has(last) && bytes[i - 2]! < 0x80;
    if (strong || (core && central)) votes1250++;
    else if (core && (western || finalGrave)) votes1252++;
  }
  return votes1250 > votes1252 ? "windows-1250" : "windows-1252";
}

/** A character a decoding could not make into a letter: U+FFFD, a C1 control, a lone surrogate. */
const UNREADABLE = /\uFFFD|[\u0080-\u009F]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Characters a decoding could not make into letters (see GedcomDecoding.unreadable). */
export function unreadableChars(text: string): number {
  return (text.match(new RegExp(UNREADABLE.source, "g")) ?? []).length;
}

/** The lines (from 1) holding a character that could not be read, the first `max` of them. */
export function unreadableLines(text: string, max = 3): number[] {
  const out: number[] = [];
  const rows = text.split(/\r\n|\r|\n/);
  for (let i = 0; i < rows.length && out.length < max; i++) if (UNREADABLE.test(rows[i]!)) out.push(i + 1);
  return out;
}

function decodeAs(bytes: Uint8Array, encoding: GedcomEncoding): string {
  if (encoding === "ansel") return decodeAnsel(bytes);
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // UTF-16 through Buffer (a trailing odd byte left out), the BOM never part of the text
  if (encoding === "utf-16le") return b.subarray(0, b.length & ~1).toString("utf16le").replace(/^\uFEFF/, "");
  if (encoding === "utf-16be") return Buffer.from(b.subarray(0, b.length & ~1)).swap16().toString("utf16le").replace(/^\uFEFF/, "");
  // TextDecoder drops a UTF-8 BOM by itself
  return new TextDecoder(encoding).decode(bytes);
}

/**
 * A GEDCOM file's bytes as text (see the head of this file). The order: a BOM (UTF-8, UTF-16 LE/BE); UTF-16 without
 * one by its zero bytes; UTF-8 — also when CHAR names a code page: a single-byte text with letters beyond ASCII is
 * practically never valid UTF-8, so such a file was saved again as UTF-8 without its header saying so (a UTF-8 file
 * with a stray byte stays UTF-8, the byte counted unreadable); then the code page CHAR names; then the word vote.
 */
export function decodeGedcom(bytes: Uint8Array): GedcomDecoding {
  const nonAscii = bytes.some((b) => b >= 0x80);
  // HEAD's "1 CHAR <value>": its line is ASCII in every charset GEDCOM allows; zero bytes dropped so a UTF-16 header
  // without a BOM matches too
  const head = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 4096)).toString("latin1").replace(/\0/g, "");
  const declared = /^\s*1\s+CHAR\s+(.+?)\s*$/m.exec(head)?.[1] ?? null;
  const result = (encoding: GedcomEncoding, how: GedcomDecoding["how"]): GedcomDecoding => {
    const text = decodeAs(bytes, encoding);
    return { text, encoding, declared, how, nonAscii, unreadable: unreadableChars(text) };
  };
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return result("utf-8", "bom");
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return result("utf-16le", "bom");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return result("utf-16be", "bom");
  const charset = (declared ?? "").toUpperCase().replace(/[\s_]+/g, "");
  // UTF-16 without a BOM: a GEDCOM opens with ASCII ("0 "), so its zero bytes tell the order
  const ascii = (x: number | undefined) => x !== undefined && x > 0 && x < 0x80;
  const le = bytes.length >= 4 && ascii(bytes[0]) && bytes[1] === 0 && ascii(bytes[2]) && bytes[3] === 0;
  const be = bytes.length >= 4 && bytes[0] === 0 && ascii(bytes[1]) && bytes[2] === 0 && ascii(bytes[3]);
  const sixteen = charset === "UNICODE" || charset === "UTF-16" || charset === "UTF16";
  if (le || be || sixteen) return result(be || (!le && bytes[0] === 0) ? "utf-16be" : "utf-16le", le || be ? "content" : "declared");
  const named = DECLARED[charset];
  if (!nonAscii) return result(named ?? "utf-8", named ? "declared" : "content");
  const utf8 = utf8Shape(bytes);
  // valid UTF-8; or a UTF-8 file with a stray byte or two (its letters UTF-8 all through): UTF-8, the stray bytes said
  // as unreadable — never the whole file read in a code page it is not in
  if (!utf8.bad || utf8.good > utf8.bad) return result("utf-8", named === "utf-8" ? "declared" : "content");
  if (named && named !== "utf-8") return result(named, "declared");
  // ANSI, ASCII, unknown, none, or a "UTF-8" that is not: the words decide
  return result(guessSingleByteEncoding(bytes), "content");
}

/** The encoding to tell a person: a code page (not Unicode) a file with letters beyond ASCII was read in. */
export function saidEncoding(d: Pick<GedcomDecoding, "encoding" | "nonAscii">): CodePage | undefined {
  return d.nonAscii && !d.encoding.startsWith("utf-") ? (d.encoding as CodePage) : undefined;
}

/** What a reader of the file tells: the code page it was read in, the characters it could not read and where. */
export interface DecodingNote {
  encoding?: CodePage;
  unreadable?: number;
  unreadableLines?: number[];
}

export function decodingNote(d: GedcomDecoding): DecodingNote {
  const encoding = saidEncoding(d);
  return { ...(encoding ? { encoding } : {}), ...(d.unreadable ? { unreadable: d.unreadable, unreadableLines: unreadableLines(d.text) } : {}) };
}

/** A code page as people know it ("Windows-1250"). */
export function encodingLabel(e: CodePage): string {
  return e === "ansel" ? "ANSEL" : e === "iso-8859-2" ? "ISO-8859-2" : e.replace("windows", "Windows");
}

/** Bytes that open as a GEDCOM ("0 HEAD", after a BOM or blank space; in UTF-16 too). */
export function looksLikeGedcom(bytes: Uint8Array): boolean {
  const start = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 64)).toString("latin1").replace(/\0/g, "");
  return /^(?:ï»¿|ÿþ|þÿ)?\s*0\s+HEAD/.test(start);
}
