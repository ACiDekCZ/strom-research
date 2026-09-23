// Ages as records state them ("aged 27", "27 let", "3 Monate") in the GEDCOM
// 5.5.1 form: "27y", "27y 3m", "3m 12d", "<1y", ">60y", INFANT, STILLBORN,
// CHILD. An age at an event is the most common clue to a birth year.

const KEYWORDS = new Set(["INFANT", "STILLBORN", "CHILD"]);

/** Words for years, months, weeks and days in the languages of old records and of users. */
const UNITS: [RegExp, "y" | "m" | "w" | "d"][] = [
  [/^(y|yr|yrs|year|years|r|rok|roku|roky|let|l|j|jahr|jahre|jahren|lat|lata|rok[uó]w|an|ans|anni|anno|annorum|annos|años|ano|anos|år|ar|év|ev|ann)\.?$/i, "y"],
  [/^(m|mo|mos|month|months|měs|mes|měsíc|měsíce|měsíců|mesic|mesice|mesicu|monat|monate|monaten|mies|miesiąc|miesiące|miesięcy|mois|mese|mesi|meses|mån|hónap)\.?$/i, "m"],
  [/^(w|wk|wks|week|weeks|t|týd|týden|týdny|týdnů|tyden|tydny|woche|wochen|tydz|tydzień|tygodnie|tygodni|sem|semaine|semaines|settimana|settimane)\.?$/i, "w"],
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

/** Words around an age that carry no amount: "aged", "ve věku", "aetatis", "asi". */
const FILLER = /^(aged|age|at|of|about|circa|ca|c|asi|cca|ve|věku|věk|stáří|v|im|alter|von|etwa|aetatis|aetat|około|w|wieku|environ|âgé|âgée|de|di|età|and|und|a|i|et|e|y)\.?$/i;

/** Normalise an age to GEDCOM form, or undefined when it cannot be read. */
export function normalizeAge(input: string): string | undefined {
  const raw = input.trim().replace(/\s+/g, " ");
  if (!raw) return undefined;
  const up = raw.toUpperCase();
  if (KEYWORDS.has(up)) return up;
  // the keywords in words, as programs write them back ("kojenec", "mrtvě narozené", "Säugling")
  const word = WORDS[raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()];
  if (word) return word;
  if (isGedcomAge(raw)) return raw;
  let rest = raw.replace(/,(?!\d)/g, " ").trim();
  let sign = "";
  if (/^[<>]/.test(rest)) {
    sign = rest[0]!;
    rest = rest.slice(1).trim();
  }
  if (/^\d{1,3}$/.test(rest)) return `${sign}${Number(rest)}y`; // "27" alone means years
  const parts = { y: 0, m: 0, d: 0 };
  let seen = false;
  let pendingUnit: "y" | "m" | "w" | "d" | undefined; // "annorum 25": the unit before the number
  const tokens = rest.match(/\d+(?:[.,]\d+)?|[^\d\s]+/g) ?? [];
  const unitOf = (w: string | undefined) => (w ? UNITS.find(([re]) => re.test(w))?.[1] : undefined);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const n = Number(tok.replace(",", "."));
    if (!Number.isFinite(n)) {
      const u = unitOf(tok);
      if (u) pendingUnit = u;
      else if (!FILLER.test(tok)) return undefined;
      continue;
    }
    let unit = unitOf(tokens[i + 1]);
    if (unit) i++;
    else unit = pendingUnit ?? "y";
    pendingUnit = undefined;
    if (unit === "w") parts.d += Math.round(n * 7);
    else if (unit === "y" && !Number.isInteger(n)) {
      parts.y += Math.floor(n);
      parts.m += Math.round((n % 1) * 12);
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
