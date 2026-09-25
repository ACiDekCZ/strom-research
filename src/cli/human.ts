// What a person reads about their family: dates, facts and how sure they are,
// in the research language — for the views of the tree (strom stats, pedigree,
// person card, recent). The GEDCOM forms stay in the data; these are only how
// they are shown.

import { MONTHS } from "../core/gdate.ts";
import { ui, type UIKey } from "./ui.ts";

/**
 * English reads "31 Aug 1830"; the others their own numeric form ("31. 8. 1830", "31.8.1830"). A month and
 * year alone are named ("srpen 1830") — after a word ("před 3/1853") in numbers, which no grammatical case bends.
 */
function format(lang: string, date: Date, parts: "day" | "month" | "monthafter" | "daymonth"): string {
  const en = lang === "en";
  const opts: Intl.DateTimeFormatOptions =
    parts === "month"
      ? { month: "long", year: "numeric" }
      : parts === "monthafter"
        ? { month: en ? "short" : "numeric", year: "numeric" }
        : parts === "daymonth"
        ? { day: "numeric", month: en ? "short" : "numeric" }
        : { day: "numeric", month: en ? "short" : "numeric", year: "numeric" };
  try {
    return new Intl.DateTimeFormat(en ? "en-GB" : lang, { ...opts, timeZone: "UTC" }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(date);
  }
}

/** One date without a qualifier: "31 AUG 1830", "AUG 1830", "1830" — `after` a word ("before", "between"). */
function simple(s: string, lang: string, after = true): string {
  const m = /^(?:(\d{1,2}) )?(?:([A-Z]{3}) )?(\d{3,4})$/.exec(s.trim());
  if (!m) return s;
  const month = m[2] ? MONTHS.indexOf(m[2] as (typeof MONTHS)[number]) : -1;
  if (month < 0) return m[3]!;
  const date = new Date(Date.UTC(2000, month, m[1] ? Number(m[1]) : 1));
  date.setUTCFullYear(Number(m[3]));
  return format(lang, date, m[1] ? "day" : after ? "monthafter" : "month");
}

/** A GEDCOM date as a person says it: "31. 8. 1830", "asi 1830", "před 1853", "mezi 1811 a 1812". */
export function humanDate(date: string | undefined, lang: string): string {
  if (!date) return "";
  const d = date.trim().toUpperCase();
  let m = /^BET (.+) AND (.+)$/.exec(d);
  if (m) return ui(lang, "ui.date.between", { a: simple(m[1]!, lang), b: simple(m[2]!, lang) });
  m = /^FROM (.+) TO (.+)$/.exec(d);
  if (m) return ui(lang, "ui.date.fromto", { a: simple(m[1]!, lang), b: simple(m[2]!, lang) });
  m = /^(FROM|TO|ABT|CAL|EST|BEF|AFT) (.+)$/.exec(d);
  if (m) {
    const key: Record<string, UIKey> = { FROM: "ui.date.from", TO: "ui.date.to", ABT: "ui.date.about", CAL: "ui.date.about", EST: "ui.date.about", BEF: "ui.date.before", AFT: "ui.date.after" };
    return ui(lang, key[m[1]!]!, { date: simple(m[2]!, lang) });
  }
  return simple(d, lang, false);
}

/** A day of the research (an ISO time): "25. 9.", with the year when it is not this one. */
export function humanDay(iso: string, lang: string): string {
  const d = new Date(iso);
  return format(lang, d, d.getUTCFullYear() === new Date().getUTCFullYear() ? "daymonth" : "day");
}

/** An amount in US dollars (what the agents' providers bill). */
export function humanCost(usd: number, lang: string): string {
  try {
    return new Intl.NumberFormat(lang === "en" ? "en-GB" : lang, { style: "currency", currency: "USD" }).format(usd);
  } catch {
    return `$${usd.toFixed(2)}`;
  }
}

const EVENTS: Record<string, UIKey> = {
  BIRT: "ui.ev.BIRT",
  CHR: "ui.ev.CHR",
  BAPM: "ui.ev.CHR",
  DEAT: "ui.ev.DEAT",
  BURI: "ui.ev.BURI",
  CREM: "ui.ev.CREM",
  MARR: "ui.ev.MARR",
  MARB: "ui.ev.MARB",
  ENGA: "ui.ev.ENGA",
  DIV: "ui.ev.DIV",
  OCCU: "ui.ev.OCCU",
  RESI: "ui.ev.RESI",
  EDUC: "ui.ev.EDUC",
  RELI: "ui.ev.RELI",
  TITL: "ui.ev.TITL",
  CENS: "ui.ev.CENS",
  CONF: "ui.ev.CONF",
  EMIG: "ui.ev.EMIG",
  IMMI: "ui.ev.IMMI",
  NATU: "ui.ev.NATU",
  PROB: "ui.ev.PROB",
  WILL: "ui.ev.WILL",
};

/** The name of a kind of fact: "narození", "křest"; an EVEN by its own label. */
export function eventName(kind: string, lang: string, label?: string): string {
  const key = EVENTS[kind];
  return key ? ui(lang, key) : (label ?? kind);
}

const STATUS: Record<string, UIKey> = { proven: "ui.st.proven", probable: "ui.st.probable", possible: "ui.st.possible", lead: "ui.st.lead" };

/** How sure a fact is: "doloženo", "jen stopa". */
export function statusName(status: string, lang: string): string {
  const key = STATUS[status];
  return key ? ui(lang, key) : status;
}

/** A generation of ancestors: 2 the parents, 3 the grandparents, …; farther by its number. */
export function generationName(g: number, lang: string): string {
  const key: Record<number, UIKey> = { 2: "ui.gen.2", 3: "ui.gen.3", 4: "ui.gen.4", 5: "ui.gen.5" };
  return key[g] ? ui(lang, key[g]!) : ui(lang, "ui.gen.n", { n: g });
}

/** Where a fact happened: the place, with the house when the record gives it. */
export function humanPlace(place: string | undefined, house: string | undefined, lang: string): string {
  if (!house) return place ?? "";
  return ui(lang, "ui.card.house", { place: place ?? "", house }).replace(/^[,\s]+/, "");
}
