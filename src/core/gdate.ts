// Genealogical dates in GEDCOM 5.5.1 form: "24 JUN 1783", "ABT 1783",
// "BET 1811 AND 1812", "BEF MAR 1850", "FROM 1839 TO 1845".
// ISO input ("1783-06-24", "1783-06") is accepted and converted.

export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

const SIMPLE = /^(?:(\d{1,2}) )?(?:(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC) )?(\d{3,4})$/;
const QUALIFIERS = ["ABT", "CAL", "EST", "BEF", "AFT"];

function daysInMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function validSimple(s: string): boolean {
  const m = SIMPLE.exec(s);
  if (!m) return false;
  const [, day, mon, year] = m;
  if (day && !mon) return false;
  if (day && mon) {
    const monthIndex = MONTHS.indexOf(mon as (typeof MONTHS)[number]) + 1;
    const d = Number(day);
    if (d < 1 || d > daysInMonth(monthIndex, Number(year))) return false;
  }
  return true;
}

function fromIso(s: string): string | undefined {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(s);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  if (!mo) return y;
  const mon = MONTHS[Number(mo) - 1];
  if (!mon) return undefined;
  return d ? `${Number(d)} ${mon} ${y}` : `${mon} ${y}`;
}

/** Normalize user input to GEDCOM form, or return undefined if invalid. */
export function normalizeDate(input: string): string | undefined {
  let s = input.trim().toUpperCase().replace(/\s+/g, " ");
  if (s === "") return undefined;
  s = s.replace(/\b(\d{4}(?:-\d{2}){0,2})\b/g, (iso) => fromIso(iso) ?? iso);

  const bet = /^BET (.+) AND (.+)$/.exec(s);
  if (bet?.[1] && bet[2]) return validSimple(bet[1]) && validSimple(bet[2]) ? s : undefined;
  const fromTo = /^FROM (.+?)(?: TO (.+))?$/.exec(s);
  if (fromTo?.[1]) return validSimple(fromTo[1]) && (!fromTo[2] || validSimple(fromTo[2])) ? s : undefined;
  const to = /^TO (.+)$/.exec(s);
  if (to?.[1]) return validSimple(to[1]) ? s : undefined;
  const q = /^([A-Z]{3}) (.+)$/.exec(s);
  if (q?.[1] && q[2] && QUALIFIERS.includes(q[1])) return validSimple(q[2]) ? s : undefined;
  return validSimple(s) ? s : undefined;
}

/** All years mentioned in a GEDCOM date. */
export function dateYears(date: string): number[] {
  return [...date.matchAll(/\b(\d{3,4})\b/g)].map((m) => Number(m[1])).filter((y) => y >= 100);
}

/** Short year label for listings: "1783", "~1783", "<1850", "1811/1812". */
export function yearLabel(date: string | undefined): string {
  if (!date) return "?";
  const years = dateYears(date);
  if (years.length === 0) return "?";
  if (date.startsWith("BET") || date.startsWith("FROM")) return years.join("/");
  if (/^(ABT|CAL|EST) /.test(date)) return `~${years[0]}`;
  if (date.startsWith("BEF")) return `<${years[0]}`;
  if (date.startsWith("AFT")) return `>${years[0]}`;
  return String(years[0]);
}
