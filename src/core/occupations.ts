// Occupations as old records name them: one occupation in several languages (assets/terms/occupations.json — a miller
// is mlynář, Müller, molitor, młynarz). A word asked for finds the values that name the occupation in any of them.
//
// Compared folded (foldText: no accents, lower case, ß as ss, ł as l) and by the start of a word of the value: the
// word asked for as typed ("mlynar" finds "mlynáře", "mlynářský" — and "Mlynařík" too: a word that only begins so
// is found, which is why the caller looks in values of a kind, an occupation, not in names), and each form of its
// group by its stem (a form ending in a vowel or in -us without it: "děvečka" finds "děvečky", "colonus" "coloni").
// No transliteration is made up: "Mueller" is a form of the list beside "Müller", never ue read as ü in general —
// the Latin "puer" (a boy) or "poena" would otherwise turn into something else. A word not in the list finds only
// itself; `exact` finds the word asked for as a whole word, without its group.

import { readAsset } from "./assets.ts";
import { foldText } from "./text.ts";

export interface OccupationMatcher {
  /** The word asked for, as typed (NFC). */
  word: string;
  /** The forms of the occupation found by it, as the list writes them (with accents), the word itself when none. */
  variants: string[];
  /** Whether the word is one of the list's occupations. */
  known: boolean;
  /** Does a value (an occupation as a record gives it) name it? */
  matches(text: string | undefined): boolean;
}

type Lang = "cs" | "de" | "la" | "pl";
type Group = Partial<Record<Lang, string[]>>;

interface Entry {
  forms: string[];
  /** Each form folded into words, then stemmed: what a value's words begin with. */
  stems: string[][];
}

let groups: Entry[] | undefined;

const WORD_SPLIT = /[^\p{L}\p{M}\p{N}]+/u;

function words(text: string): string[] {
  return foldText(text).split(WORD_SPLIT).filter(Boolean);
}

/** A folded word without its declension ending: a final vowel (a, e, o, y) or -us, the stem left at least four. */
function stem(w: string): string {
  if (w.length >= 6 && w.endsWith("us")) return w.slice(0, -2);
  if (w.length >= 5 && "aeoy".includes(w.slice(-1))) return w.slice(0, -1);
  return w;
}

function loaded(): Entry[] {
  if (groups) return groups;
  let file: { groups?: Group[] } = {};
  try {
    file = JSON.parse(readAsset("terms", "occupations.json") ?? "{}") as { groups?: Group[] };
  } catch {
    file = {};
  }
  groups = (file.groups ?? []).map((g) => {
    const forms = [...new Set((["cs", "de", "la", "pl"] as const).flatMap((l) => g[l] ?? []).map((f) => f.normalize("NFC")))];
    return { forms, stems: forms.map((f) => words(f).map(stem)).filter((s) => s.length > 0) };
  });
  return groups;
}

/** Do the words of a value hold the needle's words in a row — each the start of a word, or the whole word? */
function holds(text: string[], needle: string[], whole: boolean): boolean {
  if (needle.length === 0) return false;
  for (let i = 0; i + needle.length <= text.length; i++) {
    let all = true;
    for (let j = 0; j < needle.length && all; j++) all = whole ? text[i + j] === needle[j] : text[i + j]!.startsWith(needle[j]!);
    if (all) return true;
  }
  return false;
}

/**
 * What an occupation asked for finds: the word itself at the start of a word of a value and, with the list, every
 * form of its occupation (in any language of the list) the same way; `exact` the word alone, as a whole word.
 */
export function occupationMatcher(word: string, opts: { exact?: boolean } = {}): OccupationMatcher {
  const typed = word.normalize("NFC").trim();
  const asked = words(typed);
  const own = { word: typed, variants: typed ? [typed] : [], known: false };
  if (asked.length === 0) return { ...own, matches: () => false };
  const key = asked.map(stem).join(" ");
  const mine = loaded().filter((g) => g.stems.some((s) => s.join(" ") === key));
  if (opts.exact) return { ...own, known: mine.length > 0, matches: (text) => !!text && holds(words(text), asked, true) };
  if (mine.length === 0) return { ...own, matches: (text) => !!text && holds(words(text), asked, false) };
  const needles = [asked, ...mine.flatMap((g) => g.stems)];
  return {
    word: typed,
    variants: [...new Set(mine.flatMap((g) => g.forms))],
    known: true,
    matches: (text) => {
      if (!text) return false;
      const w = words(text);
      return needles.some((n) => holds(w, n, false));
    },
  };
}
