// Text helpers for matching names across spellings and diacritics.

/** Lowercase, strip diacritics, collapse whitespace: "Víšek  Antonín" -> "visek antonin". */
export function foldText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[łŁ]/g, "l")
    .replace(/[đĐ]/g, "d")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/[œŒ]/g, "oe")
    .replace(/[þÞ]/g, "th")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Words of a folded text — in any script: "Шевчук Іван" has words too. */
export function tokens(s: string): string[] {
  return foldText(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// Named character references of web pages. A Latin letter with a mark is composed from its
// name (&aacute; &scaron; &uring; &odblac; …); the rest are listed.
const MARKS: Record<string, string> = {
  acute: "\u0301", grave: "\u0300", circ: "\u0302", tilde: "\u0303", uml: "\u0308", ring: "\u030a", cedil: "\u0327",
  caron: "\u030c", ogon: "\u0328", dblac: "\u030b", breve: "\u0306", macr: "\u0304", dot: "\u0307",
};
const GREEK = "Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigma Tau Upsilon Phi Chi Psi Omega".split(" ");
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", shy: "\u00ad", ensp: "\u2002", emsp: "\u2003", thinsp: "\u2009",
  zwnj: "\u200c", zwj: "\u200d", lrm: "\u200e", rlm: "\u200f", ndash: "–", mdash: "—", hellip: "…", bull: "•", middot: "·",
  laquo: "«", raquo: "»", lsaquo: "‹", rsaquo: "›", ldquo: "“", rdquo: "”", bdquo: "„", lsquo: "‘", rsquo: "’", sbquo: "‚",
  prime: "′", Prime: "″", copy: "©", reg: "®", trade: "™", deg: "°", plusmn: "±", times: "×", divide: "÷", sect: "§", para: "¶",
  dagger: "†", Dagger: "‡", permil: "‰", euro: "€", pound: "£", cent: "¢", yen: "¥", curren: "¤", brvbar: "¦", not: "¬",
  micro: "µ", ordf: "ª", ordm: "º", sup1: "¹", sup2: "²", sup3: "³", frac14: "¼", frac12: "½", frac34: "¾", iexcl: "¡",
  iquest: "¿", acute: "´", uml: "¨", cedil: "¸", macr: "¯", larr: "←", rarr: "→", uarr: "↑", darr: "↓", harr: "↔",
  szlig: "ß", aelig: "æ", AElig: "Æ", oelig: "œ", OElig: "Œ", oslash: "ø", Oslash: "Ø", eth: "ð", ETH: "Ð", thorn: "þ",
  THORN: "Þ", lstrok: "ł", Lstrok: "Ł", dstrok: "đ", Dstrok: "Đ", hstrok: "ħ", Hstrok: "Ħ", tstrok: "ŧ", Tstrok: "Ŧ",
  eng: "ŋ", ENG: "Ŋ", imath: "ı", inodot: "ı", sigmaf: "ς", sdot: "⋅",
  ...Object.fromEntries(GREEK.flatMap((g, i) => [
    [g, String.fromCodePoint(0x391 + i + (i > 16 ? 1 : 0))],
    [g.toLowerCase(), String.fromCodePoint(0x3b1 + i + (i > 16 ? 1 : 0))],
  ])),
};

function reference(name: string): string | undefined {
  if (name[0] === "#") {
    const cp = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return cp > 0 && cp <= 0x10ffff && (cp < 0xd800 || cp > 0xdfff) ? String.fromCodePoint(cp) : undefined;
  }
  if (Object.hasOwn(NAMED, name)) return NAMED[name];
  const m = /^([A-Za-z])([a-z]+)$/.exec(name);
  // a dot above only on the letters that have one (&odot; is ⊙, not ȯ)
  const mark = m && Object.hasOwn(MARKS, m[2]!) && (m[2] !== "dot" || "cegzCEGIZ".includes(m[1]!)) ? MARKS[m[2]!] : undefined;
  const ch = mark && (m![1]! + mark).normalize("NFC");
  return ch && ch.length === 1 ? ch : undefined;
}

const ESCAPED: Record<string, string> = { "/": "/", "\\": "\\", '"': '"', "'": "'", n: "\n", r: "\r", t: "\t" };

/**
 * A page's text as a person reads it, with where each of its characters is in the page:
 * character references (&aacute; &#237; &#xE1; &nbsp;) and the escapes of scripts and JSON
 * (\u00e1 \/ \") written out. `at[i]` is the page's index of the text's character i, and
 * `at[text.length]` the page's length. Undefined when there is nothing to write out.
 */
export function readable(page: string): { text: string; at: Int32Array } | undefined {
  const at = new Int32Array(page.length + 1); // written out, a text is never longer than its page
  const parts: string[] = [];
  let n = 0;
  let last = 0;
  const keep = (to: number) => {
    for (let i = last; i < to; i++) at[n++] = i;
    parts.push(page.slice(last, to));
  };
  for (const m of page.matchAll(/&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});|\\(u[0-9a-fA-F]{4}|[/\\"'nrt])/g)) {
    const ch = m[1] !== undefined ? reference(m[1]) : m[2]![0] === "u" ? String.fromCharCode(parseInt(m[2]!.slice(1), 16)) : ESCAPED[m[2]!];
    if (ch === undefined) continue;
    keep(m.index);
    for (let k = 0; k < ch.length; k++) at[n++] = m.index;
    parts.push(ch);
    last = m.index + m[0].length;
  }
  if (!parts.length) return undefined;
  keep(page.length);
  at[n] = page.length;
  return { text: parts.join(""), at: at.subarray(0, n + 1) };
}

/** Folder-safe name keeping diacritics (works on Windows, macOS, Linux). */
export function safeFolderName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  const reserved = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
  if (cleaned === "" || reserved.test(cleaned) || cleaned.toLowerCase() === "shared") return `${cleaned || "tree"}-1`;
  return cleaned;
}
