// What the Strom app makes of a date and an age it cannot keep as they are (every app before 3.17.0-beta.9,
// APP_KEEPS_PERIODS): a period sent back as a range — FROM x TO y as BET x AND y, FROM x as AFT x, TO y as BEF y — and
// an age without its units of nothing ("0y 2m 26d" as "2m 26d", one of nothing at all as "0y"). It is not the user's
// edit: strom sync takes the research's own form for it from such an app (and from one whose version the file does not
// say), strom fixes app-shapes sets right what an older strom took as one.

/** A date as the app sends it back. */
export function appDate(date: string): string {
  const s = date.trim();
  const both = /^FROM (.+?) TO (.+)$/.exec(s);
  if (both) return `BET ${both[1]} AND ${both[2]}`;
  const from = /^FROM (.+)$/.exec(s);
  if (from) return `AFT ${from[1]}`;
  const to = /^TO (.+)$/.exec(s);
  return to ? `BEF ${to[1]}` : s;
}

/** An age as the app sends it back: its units of nothing left out ("0y 2m 26d" → "2m 26d"); one of nothing at all as "0y" ("0y 0m 0d", "0d"). */
export function appAge(age: string): string {
  const s = age.trim();
  const m = /^([<>]?)(?:(\d+)y)? ?(?:(\d+)m)? ?(?:(\d+)d)?$/.exec(s);
  if (!m || (m[2] === undefined && m[3] === undefined && m[4] === undefined)) return s;
  const units = ([[m[2], "y"], [m[3], "m"], [m[4], "d"]] as const).filter(([n]) => n !== undefined && Number(n) > 0).map(([n, u]) => `${Number(n)}${u}`);
  return `${m[1]}${units.length ? units.join(" ") : "0y"}`;
}

/** A fact's date, age and partners' ages — as the research has them, or as the app sent them back. */
export interface Shaped {
  date?: string | undefined;
  age?: string | undefined;
  ages?: Record<string, string> | undefined;
}

/** The fact as the app sends it back. */
export function inApp<T extends Shaped>(f: T): T {
  const out = { ...f };
  if (f.date) out.date = appDate(f.date);
  if (f.age) out.age = appAge(f.age);
  if (f.ages) out.ages = Object.fromEntries(Object.entries(f.ages).map(([k, a]) => [k, appAge(a)]));
  return out;
}

/** Do the research's `ours` and the app's `theirs` differ only as the app shapes a date or an age? Both said, one differs. */
export function onlyAppShape(ours: Shaped, theirs: Shaped): boolean {
  const key = (f: Shaped) => JSON.stringify([f.date ?? "", f.age ?? "", Object.entries(f.ages ?? {}).sort()]);
  return key(ours) !== key(theirs) && key(inApp(ours)) === key(inApp(theirs));
}
