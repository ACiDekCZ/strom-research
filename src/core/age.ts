// Ages as records state them ("aged 27", "27 let", "3 Monate") in the GEDCOM
// 5.5.1 form: "27y", "27y 3m", "3m 12d", "<1y", ">60y", INFANT, STILLBORN,
// CHILD. An age at an event is the most common clue to a birth year.

import { foldText } from "./text.ts";

const KEYWORDS = new Set(["INFANT", "STILLBORN", "CHILD"]);

/** Words for years, months, weeks and days in the languages of old records and of users. */
const UNITS: [RegExp, "y" | "m" | "w" | "d"][] = [
  [/^(y|yr|yrs|year|years|r|rok|roku|roky|let|léta|l|j|jahr|jahre|jahren|jahres|lat|lata|rok[uó]w|an|ans|anni|anno|annorum|annos|años|ano|anos|år|ar|év|ev|ann)\.?$/i, "y"],
  [/^(m|mo|mos|month|months|měs|mes|měsíc|měsíce|měsíců|mesic|mesice|mesicu|monat|monate|monaten|mies|miesiąc|miesiące|miesięcy|mois|mese|mesi|meses|mån|hónap)\.?$/i, "m"],
  [/^(w|wk|wks|week|weeks|t|týd|týden|týdne|týdny|týdnů|tyden|tydny|woche|wochen|tydz|tydzień|tygodnie|tygodni|sem|semaine|semaines|settimana|settimane)\.?$/i, "w"],
  [/^(d|day|days|den|dny|dní|dni|dnů|tag|tage|tagen|dzień|jour|jours|giorno|giorni|días|dias)\.?$/i, "d"],
];

/** INFANT, STILLBORN, CHILD in words (folded): the forms humanAge writes, and the Strom app's. */
const WORDS: Record<string, string> = {
  infant: "INFANT", kojenec: "INFANT", saugling: "INFANT", niemowle: "INFANT",
  stillborn: "STILLBORN", "mrtve narozene": "STILLBORN", "mrtve narozeny": "STILLBORN", totgeboren: "STILLBORN", "martwo urodzone": "STILLBORN",
  child: "CHILD", dite: "CHILD", kind: "CHILD", dziecko: "CHILD",
};

/** Is `s` a valid GEDCOM 5.5.1 age? */
export function isGedcomAge(s: string): boolean {
  return KEYWORDS.has(s) || /^[<>]?(?:\d{1,3}y(?: \d{1,2}m)?(?: \d{1,3}d)?|\d{1,2}m(?: \d{1,3}d)?|\d{1,3}d)$/.test(s);
}

/** Words around an age that carry no amount: "aged", "ve věku", "aetatis", "asi", "ein (halbes Jahr)". */
const FILLER = /^(aged|age|at|of|about|circa|ca|c|asi|cca|ve|věku|věk|stáří|v|im|alter|von|etwa|ein|eine|eines|einem|einen|einer|aetatis|aetat|około|w|wieku|environ|âgé|âgée|de|di|età|and|und|a|i|et|e|y)\.?$/i;

/** Articles between an amount and its unit: "half a year", "a quarter of a year", "ein halbes Jahr". */
const ARTICLE = /^(a|of|ein|eine|eines|einem|einen|einer|des)$/i;

/** "and" between a whole number and its fraction: "1 a půl", "one and a half", "1 Jahr und ein halbes". */
const AND = /^(a|and|und|i|et|e|y)$/i;

/** The fractions of old records as characters: "½ roku", "1¾ Jahre". */
const FRACTION_CHARS: Record<string, number> = { "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4 };

/** Fractions in words (folded): "půl roku", "čtvrt léta", "ein halbes Jahr", "half a year", "a quarter year", "anderthalb Jahre". */
const FRACTION_WORDS: Record<string, number> = {
  pul: 1 / 2, half: 1 / 2, halb: 1 / 2, halbe: 1 / 2, halbes: 1 / 2, halben: 1 / 2, halber: 1 / 2, pol: 1 / 2, demi: 1 / 2, mezzo: 1 / 2, medio: 1 / 2, meio: 1 / 2,
  ctvrt: 1 / 4, quarter: 1 / 4, viertel: 1 / 4, cwierc: 1 / 4,
  dreiviertel: 3 / 4,
  anderthalb: 3 / 2, eineinhalb: 3 / 2, poltora: 3 / 2, puldruha: 3 / 2, puldruheho: 3 / 2,
};

/** "one" in words (folded), read only before a unit or "and a half": "jeden a půl roku", "ein Jahr", "un an et demi". */
const ONE = new Set(["jeden", "jedna", "jedno", "one", "ein", "eins", "eine", "un", "une", "uno", "una"]);

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉";

/** "1⁄2", "¹⁄₂", "1 / 2" → "1/2", so a fraction is one token. */
function plainFractions(s: string): string {
  return s
    .replace(/([⁰¹²³⁴-⁹]+)\s*[⁄∕/]\s*([₀-₉]+)/gu, (_, a: string, b: string) =>
      ` ${[...a].map((c) => SUPERSCRIPT.indexOf(c)).join("")}/${[...b].map((c) => SUBSCRIPT.indexOf(c)).join("")}`)
    .replace(/(\d)\s*[⁄∕/]\s*(\d)/gu, "$1/$2");
}

type Amount = { n: number; frac: boolean };

/** A token as an amount: "27", "27,5", "1/2", "½", "půl", "anderthalb"; null when it is no amount, undefined when it cannot be one ("27/3"). */
function amountOf(tok: string): Amount | null | undefined {
  if (/^\d+(?:[.,]\d+)?$/.test(tok)) return { n: Number(tok.replace(",", ".")), frac: false };
  const f = /^(\d+)\/(\d+)$/.exec(tok);
  if (f) {
    const a = Number(f[1]), b = Number(f[2]);
    return a >= 1 && b >= 2 && b <= 12 && a < b ? { n: a / b, frac: true } : undefined;
  }
  if (tok in FRACTION_CHARS) return { n: FRACTION_CHARS[tok]!, frac: true };
  const w = FRACTION_WORDS[foldText(tok).replace(/\.$/, "")];
  return w === undefined ? null : { n: w, frac: w < 1 };
}

/** Normalise an age to GEDCOM form, or undefined when it cannot be read. */
export function normalizeAge(input: string): string | undefined {
  const raw = input.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!raw) return undefined;
  const up = raw.toUpperCase();
  if (KEYWORDS.has(up)) return up;
  // the keywords in words, as programs write them back ("kojenec", "mrtvě narozené", "Säugling")
  const word = WORDS[raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()];
  if (word) return word;
  if (isGedcomAge(raw)) return raw;
  let rest = plainFractions(raw.replace(/,(?!\d)/g, " ")).trim();
  let sign = "";
  if (/^[<>]/.test(rest)) {
    sign = rest[0]!;
    rest = rest.slice(1).trim();
  }
  if (/^\d{1,3}$/.test(rest)) return `${sign}${Number(rest)}y`; // "27" alone means years
  const unitOf = (w: string | Amount | undefined) => (typeof w === "string" ? UNITS.find(([re]) => re.test(w))?.[1] : undefined);
  // "Vierteljahr", "Halbjahr": a fraction and its unit in one word
  const words = (rest.match(/\d+(?:[.,]\d+)?(?:\/\d+)?|[½⅓⅔¼¾]|[^\d\s½⅓⅔¼¾]+/g) ?? []).flatMap((t) => {
    const c = /^(.+?)(jahr|jahre|jahres)$/.exec(foldText(t));
    return c && FRACTION_WORDS[c[1]!] !== undefined ? [c[1]!, "jahr"] : [t];
  });
  const items: (string | Amount)[] = [];
  for (const tok of words) {
    const a = amountOf(tok);
    if (a === undefined) return undefined;
    items.push(a ?? tok);
  }
  // "1 ½", "1 1/2", "1 a půl", "jeden a půl", "one and a half", "rok a půl", "a year and a half" → one amount
  const isAmount = (x: string | Amount | undefined): x is Amount => typeof x === "object";
  const isFrac = (x: string | Amount | undefined) => isAmount(x) && x.frac;
  const isOne = (x: string | Amount | undefined) => typeof x === "string" && ONE.has(foldText(x));
  const andFraction = (i: number) => {
    // "a půl", "and a half", "und ein halbes": the index of the fraction, or -1
    if (typeof items[i] !== "string" || !AND.test(items[i] as string)) return -1;
    let j = i + 1;
    while (typeof items[j] === "string" && ARTICLE.test(items[j] as string)) j++;
    return isFrac(items[j]) ? j : -1;
  };
  for (let i = 0; i < items.length; i++) {
    const x = items[i];
    if (isOne(x) && (unitOf(items[i + 1]) || andFraction(i + 1) >= 0)) items[i] = { n: 1, frac: false };
    const y = items[i];
    if (isAmount(y) && !y.frac && Number.isInteger(y.n)) {
      if (isFrac(items[i + 1])) items.splice(i, 2, { n: y.n + (items[i + 1] as Amount).n, frac: false });
      else {
        const j = andFraction(i + 1);
        if (j >= 0) items.splice(i, j - i + 1, { n: y.n + (items[j] as Amount).n, frac: false });
      }
    } else if (unitOf(y) && !isAmount(items[i - 1])) {
      // "rok a půl": a unit with no number, then "and a half" with no unit of its own — one and a half of it
      const j = andFraction(i + 1);
      if (j >= 0 && !unitOf(items[j + 1])) items.splice(i, 0, { n: 1, frac: false });
    }
  }
  const parts = { y: 0, m: 0, d: 0 };
  let seen = false;
  let pendingUnit: "y" | "m" | "w" | "d" | undefined; // "annorum 25": the unit before the number
  let lastUnit: "y" | "m" | "w" | "d" | undefined; // "1 Monat und ein halber": the fraction of the unit before
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (!isAmount(it)) {
      const u = unitOf(it);
      if (u) pendingUnit = u;
      else if (!FILLER.test(it)) return undefined;
      continue;
    }
    const n = it.n;
    // the unit right after the amount, or after its articles ("half a year", "a quarter of a year")
    let j = i + 1;
    if (!unitOf(items[j])) while (typeof items[j] === "string" && ARTICLE.test(items[j] as string)) j++;
    let unit = unitOf(items[j]);
    if (unit) i = j;
    else unit = pendingUnit ?? (it.frac ? lastUnit : undefined) ?? "y";
    pendingUnit = undefined;
    lastUnit = unit;
    if (unit === "w") parts.d += Math.round(n * 7);
    else if (unit === "y" && !Number.isInteger(n)) {
      // 27.99 years is 28 years, never "27y 12m"; ½ year is 6 months, ⅓ is 4
      const months = Math.round((n % 1) * 12);
      parts.y += Math.floor(n) + (months === 12 ? 1 : 0);
      parts.m += months === 12 ? 0 : months;
    } else if (unit === "m" && !Number.isInteger(n)) {
      // ½ month is 15 days, 1½ months 1 month and 15 days
      const days = Math.round((n % 1) * 30);
      parts.m += Math.floor(n) + (days === 30 ? 1 : 0);
      parts.d += days === 30 ? 0 : days;
    } else parts[unit] += Math.round(n);
    seen = true;
  }
  if (!seen) return undefined;
  const out = [parts.y ? `${parts.y}y` : "", parts.m ? `${parts.m}m` : "", parts.d ? `${parts.d}d` : ""].filter(Boolean).join(" ");
  return out && isGedcomAge(`${sign}${out}`) ? `${sign}${out}` : undefined;
}

const HUMAN: Record<string, { y: string; m: string; d: string; INFANT: string; STILLBORN: string; CHILD: string }> = {
  en: { y: "y", m: "m", d: "d", INFANT: "infant", STILLBORN: "stillborn", CHILD: "child" },
  cs: { y: "let", m: "měs.", d: "dní", INFANT: "kojenec", STILLBORN: "mrtvě narozené", CHILD: "dítě" },
  de: { y: "J.", m: "Mon.", d: "Tage", INFANT: "Säugling", STILLBORN: "totgeboren", CHILD: "Kind" },
  pl: { y: "lat", m: "mies.", d: "dni", INFANT: "niemowlę", STILLBORN: "martwo urodzone", CHILD: "dziecko" },
};

/** "27y 3m" → "27 let 3 měs." in the research language (for notes a reader sees). */
export function humanAge(age: string, lang: string): string {
  const t = HUMAN[lang] ?? HUMAN.en!;
  if (KEYWORDS.has(age)) return t[age as "INFANT"];
  return age.replace(/(\d+)([ymd])/g, (_, n: string, u: "y" | "m" | "d") => `${n} ${t[u]}`);
}
