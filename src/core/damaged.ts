// Characters a file damaged on its way: a character outside the Basic Multilingual Plane (an emoji, a rare CJK sign)
// split on a GEDCOM line's CONC boundary comes back as U+FFFD U+FFFD (found 2026-10-21: the Strom app's export cut the
// pair of a "🔴" in a source's title, the sync took it as the user's rename). Mended only from the same field of the same
// record as the research has it (what the app was given, or the research now), where the text on both sides of the
// damage says unambiguously which characters stood there; else it stays as it came — nothing is guessed from another
// record's text.

/** The replacement character a decoder writes for what it cannot read. */
export const DAMAGED = "�";

const RUNS = /�+/gu;
/** How much text on each side of a damaged run tells where it stood. */
const CONTEXT = 12;
/** Fewer letters of context than this say too little to pick the characters. */
const ENOUGH = 4;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * What a run of n replacement characters stood for: a character split on a line leaves one on each side of the cut
 * (the two halves of a pair, the bytes of a letter), so at most n / 2 characters — none a space or itself damaged.
 */
const most = (n: number) => Math.max(1, Math.floor(n / 2));
const lost = (n: number) => `([^\\s\\uFFFD]{1,${most(n)}})`;

/** The text split into its parts around the damaged runs: [text, run, text, run, …, text]. */
function split(s: string): string[] {
  const out: string[] = [];
  let at = 0;
  for (const m of s.matchAll(RUNS)) {
    out.push(s.slice(at, m.index), m[0]);
    at = m.index + m[0].length;
  }
  out.push(s.slice(at));
  return out;
}

/** The one value all the matches agree on, else none. */
function one(found: Set<string>): string | undefined {
  return found.size === 1 ? [...found][0] : undefined;
}

/**
 * The text with its damaged characters put back from the references (groups in order of trust: the first group that
 * tells is taken). The whole text found in a reference with only those characters in place of the damage gives them
 * all; else each run is mended alone by the text around it, where every reference that has that text agrees. A run
 * nothing tells stays as it came.
 */
export function mendText(s: string, refs: Iterable<string>[]): string {
  if (!s.includes(DAMAGED)) return s;
  // compared as the research keeps its texts (NFC): a file's decomposed letters are the same letters
  const t = s.normalize("NFC");
  const parts = split(t);
  const groups = refs.map((g) => [...g].map((r) => r.normalize("NFC")));
  // the whole text, as the research has it
  const fixed = parts.filter((_, i) => i % 2 === 0);
  const longest = fixed.reduce((a, b) => (b.length > a.length ? b : a), "");
  if (longest.trim().length >= ENOUGH) {
    const whole = new RegExp(`^${parts.map((p, i) => (i % 2 ? lost([...p].length) : escape(p))).join("")}$`, "u");
    for (const g of groups) {
      const found = new Set<string>();
      for (const r of g) {
        if (!r.includes(longest)) continue;
        const m = whole.exec(r);
        if (m) found.add(JSON.stringify(m.slice(1)));
      }
      const hit = one(found);
      if (hit) {
        const chars = JSON.parse(hit) as string[];
        return parts.map((p, i) => (i % 2 ? chars[(i - 1) / 2] : p)).join("");
      }
      if (found.size) break;
    }
  }
  // each run by the text around it (an edit of the rest kept): the most of it on both sides first, then less — always
  // on both sides, so text that only begins or ends alike tells nothing
  const each = parts
    .map((p, i) => {
      if (i % 2 === 0) return p;
      const n = [...p].length;
      const left = [...parts[i - 1]!];
      const right = [...parts[i + 1]!];
      const ways: { before: string; after: string; chars: string }[] = [];
      for (const k of [CONTEXT, 8, 6, ENOUGH]) {
        const before = left.slice(-k).join("");
        const after = right.slice(0, k).join("");
        if (before.trim().length >= ENOUGH / 2 && after.trim().length >= ENOUGH / 2 && (before + after).trim().length >= ENOUGH) ways.push({ before, after, chars: lost(n) });
      }
      for (const w of ways) {
        const near = new RegExp(`${escape(w.before)}${w.chars}${escape(w.after)}`, "gu");
        for (const g of groups) {
          const found = new Set<string>();
          for (const r of g) {
            if (!r.includes(w.before) || !r.includes(w.after)) continue;
            for (const m of r.matchAll(near)) found.add(m[1]!);
          }
          // the references disagree: nothing tells which
          if (found.size > 1) return p;
          if (found.size) return [...found][0]!;
        }
      }
      return p;
    })
    .join("");
  return each === t ? s : each;
}

/** Every string in a value (objects, arrays, maps — their keys too), each once. */
export function textsOf(value: unknown, out = new Set<string>(), seen = new Set<object>()): Set<string> {
  if (typeof value === "string") {
    out.add(value);
    return out;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return out;
  seen.add(value);
  if (value instanceof Map) {
    for (const [k, v] of value) {
      textsOf(k, out, seen);
      textsOf(v, out, seen);
    }
  } else if (Array.isArray(value)) for (const v of value) textsOf(v, out, seen);
  else for (const v of Object.values(value)) textsOf(v, out, seen);
  return out;
}

/** Does any string in the value carry a damaged character. */
export function hasDamage(value: unknown): boolean {
  for (const s of textsOf(value)) if (s.includes(DAMAGED)) return true;
  return false;
}

/**
 * Where a string stands in a value, as the same field of the same record: a map's key and an object's property
 * (`persons/P0001/notes`), a list's place left out (one of a person's notes is any of them), a family of the
 * snapshot's list by its id, else by its partners.
 */
function step(parent: string, v: unknown, i: number): string {
  if (parent === "families" && v && typeof v === "object") {
    const f = v as { id?: unknown; partners?: unknown };
    if (typeof f.id === "string") return f.id;
    if (Array.isArray(f.partners)) return [...f.partners].sort().join("+");
  }
  return i >= 0 ? "*" : "";
}

/** Every string of a value by where it stands (`step`), a map's keys under "<keys>". */
function textsByField(value: unknown): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (at: string, s: string) => {
    if (s.length < ENOUGH) return;
    let set = out.get(at);
    if (!set) out.set(at, (set = new Set()));
    set.add(s);
  };
  walk(value, "", (at, s) => add(at, s), (at, k) => add(`${at}/<keys>`, k));
  return out;
}

/** Calls `onText` for each string of a value with where it stands, `onKey` for each string key of a map. */
function walk(v: unknown, at: string, onText: (at: string, s: string) => void, onKey?: (at: string, k: string) => void, seen = new Set<object>()): void {
  if (typeof v === "string") return onText(at, v);
  if (!v || typeof v !== "object" || seen.has(v)) return;
  seen.add(v);
  const last = at.slice(at.lastIndexOf("/") + 1);
  if (v instanceof Map) {
    for (const [k, x] of v) {
      if (typeof k === "string") onKey?.(at, k);
      walk(x, `${at}/${String(k)}`, onText, onKey, seen);
    }
  } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}/${step(last, x, i)}`, onText, onKey, seen));
  else for (const [k, x] of Object.entries(v)) walk(x, `${at}/${k}`, onText, onKey, seen);
}

/**
 * Mends every damaged string of a value in place (objects, arrays, maps — a map's key too) from the strings standing
 * in the same field of the same record in each reference (values of the same shape, in order of trust): how many were
 * mended. `refs` is asked only when something is damaged.
 */
export function mendAll(value: unknown, refs: () => unknown[]): number {
  if (!hasDamage(value)) return 0;
  const indexes = refs().map(textsByField);
  let mended = 0;
  const fix = (at: string, s: string) => {
    if (!s.includes(DAMAGED)) return s;
    const t = mendText(s, indexes.map((ix) => ix.get(at) ?? []));
    if (t !== s) mended++;
    return t;
  };
  const seen = new Set<object>();
  const visit = (v: unknown, at: string): void => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    const last = at.slice(at.lastIndexOf("/") + 1);
    if (v instanceof Map) {
      for (const [k, x] of [...v]) {
        if (typeof x === "string") v.set(k, fix(`${at}/${String(k)}`, x));
        else visit(x, `${at}/${String(k)}`);
        if (typeof k === "string" && k.includes(DAMAGED)) {
          const nk = fix(`${at}/<keys>`, k);
          if (nk !== k && !v.has(nk)) {
            const x2 = v.get(k);
            v.delete(k);
            v.set(nk, x2);
          }
        }
      }
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        const here = `${at}/${step(last, v[i], i)}`;
        if (typeof v[i] === "string") v[i] = fix(here, v[i]);
        else visit(v[i], here);
      }
    } else {
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        if (typeof o[k] === "string") o[k] = fix(`${at}/${k}`, o[k]);
        else visit(o[k], `${at}/${k}`);
      }
    }
  };
  visit(value, "");
  return mended;
}
