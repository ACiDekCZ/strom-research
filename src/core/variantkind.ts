// What kind of difference a place two readings differ is (the Strom app's ZADANI_VYZKUM_cteni-vysledek.md §1, feature
// read.variantKind): a matter of fact — another name, number, date, person, a side that cannot be read — or a trifle —
// the same word spelled otherwise, an abbreviation written out, punctuation, a label, letter case. Worked out when a
// result is given to the app (nothing kept), from the words of both sides and the field they are of. A trifle only
// where it is sure: whatever is not sure is a matter of fact ("other" at the least), never the other way round.

import { foldText } from "./text.ts";

export const VARIANT_KINDS = ["name", "number", "date", "person", "spelling", "punctuation", "label", "abbr", "case", "illegible", "other"] as const;
export type VariantKind = (typeof VARIANT_KINDS)[number];

/** The kinds that are trifles (the app folds them away); the others are matters of fact. */
export const TRIFLES: readonly VariantKind[] = ["spelling", "punctuation", "label", "abbr", "case"];

/** A side that cannot be read, or is not sure: [...], […], [?]. */
const UNREAD = /\[\s*(?:\.{2,}|…|\?)\s*\]/u;
/** A word that is a label of a field ("Testes:", "Otec:", "Pater:"): letters, a stop or two, and a colon after them. */
const LABEL = /^[\p{L}\p{M}.]+:$/u;
/** A date written in numbers (1. 3. 1850, 1850-03-01, 3/1/1850). */
const DATE_NUMBERS = /\d{1,2}\s*[./]\s*\d{1,2}\s*[./]\s*\d{2,4}|\d{4}-\d{1,2}-\d{1,2}/u;
const YEAR = /^1\d{3}$/u;

const lettersOf = (s: string) => s.replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
const digitsOf = (s: string) => (s.match(/\p{Nd}+/gu) ?? []).join(" ");
const folded = (s: string) => foldText(lettersOf(s));
/** Old spellings as today's, in a folded word (as the reader's names are compared, core/document.ts): ph f, w v, y i… */
const spelled = (key: string) =>
  key
    .replace(/ph/gu, "f")
    .replace(/th/gu, "t")
    .replace(/c(?=[aou]|k|$)/gu, "k")
    .replace(/w/gu, "v")
    .replace(/[yj]/gu, "i")
    .replace(/[ao]e/gu, "e")
    .replace(/(\p{L})\1+/gu, "$1");
const tokens = (s: string) => s.split(/\s+/u).filter((t) => lettersOf(t));

/**
 * One word an abbreviation of the other: written with a stop, its letters the start of the other's (Jos. Josephus), or
 * both abbreviations, the letters of the one within the other's in order (No. Nro.).
 */
function abbreviation(a: string, b: string): boolean {
  const [x, y] = [spelled(folded(a)), spelled(folded(b))];
  if (!x || !y || x === y || x[0] !== y[0]) return false;
  const dotA = a.trimEnd().endsWith(".");
  const dotB = b.trimEnd().endsWith(".");
  const [short, long, dotted] = x.length <= y.length ? [x, y, dotA] : [y, x, dotB];
  if (!dotted) return false;
  if (long.startsWith(short)) return true;
  if (!(dotA && dotB)) return false;
  let i = 0;
  for (const ch of long) if (ch === short[i]) i++;
  return i === short.length;
}

/** A pair of words that differ: a trifle (spelling, abbr), or the matter of fact they are. */
function wordKind(a: string, b: string, fact: VariantKind): VariantKind | undefined {
  if (folded(a) === folded(b)) return a === b || lettersOf(a) === lettersOf(b) ? undefined : lettersOf(a).toLowerCase() === lettersOf(b).toLowerCase() ? "case" : "spelling";
  if (digitsOf(a) !== digitsOf(b)) return numberKind(a, b);
  if (spelled(folded(a)) === spelled(folded(b))) return "spelling";
  if (abbreviation(a, b)) return "abbr";
  return fact;
}

function numberKind(a: string, b: string): VariantKind {
  if (DATE_NUMBERS.test(a) || DATE_NUMBERS.test(b)) return "date";
  const [x, y] = [digitsOf(a).split(" "), digitsOf(b).split(" ")];
  return [...x, ...y].filter(Boolean).every((d) => YEAR.test(d)) ? "date" : "number";
}

/** The matter of fact two sides of no field differ in, by their words: a name (words with a capital, no stop), else other. */
function factOf(a: string[], b: string[]): VariantKind {
  const named = (t: string) => /^\p{Lu}/u.test(t) && !t.trimEnd().endsWith(".");
  return a.length && b.length && [...a, ...b].every(named) ? "name" : "other";
}

/** The matter of fact a field's difference is (field as entries[].variants say it; none: a source's transcript). */
function factOfField(field: string | undefined): VariantKind | undefined {
  if (!field || field === "transcript") return undefined;
  if (field === "entry") return "other";
  if (field === "person" || /^p\d+$/u.test(field) || /\.role$/u.test(field)) return "person";
  if (/\.(?:given|surname)$/u.test(field)) return "name";
  if (/\.date$/u.test(field)) return "date";
  return "other";
}

/**
 * The kind of a place two readings differ (at: the one, other: the other; field: of entries[].variants — a person's
 * name, an event's date —, none of a source's transcript).
 */
export function variantKind(at: string, other: string, field?: string): VariantKind {
  const a = (at ?? "").normalize("NFC").trim();
  const b = (other ?? "").normalize("NFC").trim();
  const byField = factOfField(field);
  // a person (or a whole entry) one reader has and the other not, a role: what the words are does not matter
  if (byField === "person" || field === "entry") return byField ?? "other";
  // one side cannot be read (or is not sure) and the other reads
  if (UNREAD.test(a) !== UNREAD.test(b)) return "illegible";
  if (!a || !b) {
    const one = a || b;
    if (UNREAD.test(one)) return "illegible";
    if (!lettersOf(one)) return "punctuation";
    if (tokens(one).every((t) => LABEL.test(t))) return "label";
    return byField ?? (digitsOf(one) ? "number" : "other");
  }
  // the same letters: only punctuation and spaces, letter case, or marks over letters (Tichopad, Tichopád)
  if (lettersOf(a) === lettersOf(b)) return "punctuation";
  if (lettersOf(a).toLowerCase() === lettersOf(b).toLowerCase()) return "case";
  if (folded(a) === folded(b)) return "spelling";
  if (digitsOf(a) !== digitsOf(b)) return byField === "date" ? "date" : numberKind(a, b);
  // a label one of them wrote and the other not ("Otec: Jan", "Jan")
  const unlabelled = (s: string) => tokens(s).filter((t) => !LABEL.test(t));
  const [ua, ub] = [unlabelled(a), unlabelled(b)];
  if ((ua.length !== tokens(a).length || ub.length !== tokens(b).length) && folded(ua.join(" ")) === folded(ub.join(" "))) return "label";
  const [ta, tb] = [tokens(a), tokens(b)];
  const fact = byField ?? factOf(ta, tb);
  if (ta.length !== tb.length) return fact;
  const kinds = ta.map((t, i) => wordKind(t, tb[i]!, fact)).filter((k): k is VariantKind => !!k);
  if (!kinds.length) return "punctuation";
  const facts = kinds.filter((k) => !TRIFLES.includes(k));
  if (facts.length) return facts.includes("number") ? "number" : facts.includes("date") ? "date" : facts[0]!;
  return kinds.includes("spelling") ? "spelling" : kinds.includes("abbr") ? "abbr" : kinds[0]!;
}
