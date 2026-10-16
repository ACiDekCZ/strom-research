// Compact, token-efficient text output: aligned columns, one row per record,
// no box drawing, IDs first.

import { ui } from "./ui.ts";

export function table(rows: string[][], opts: { header?: string[]; gap?: number } = {}): string {
  const all = opts.header ? [opts.header, ...rows] : rows;
  if (all.length === 0) return "";
  const gap = " ".repeat(opts.gap ?? 2);
  const widths: number[] = [];
  for (const row of all) row.forEach((cell, i) => (widths[i] = Math.max(widths[i] ?? 0, [...cell].length)));
  return all
    .map((row) =>
      row
        .map((cell, i) => (i === row.length - 1 ? cell : cell + " ".repeat((widths[i] ?? 0) - [...cell].length)))
        .join(gap)
        .trimEnd(),
    )
    .join("\n");
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export function paginate<T>(items: T[], limit: number, page: number): Page<T> {
  const pages = Math.max(1, Math.ceil(items.length / limit));
  const p = Math.min(Math.max(1, page), pages);
  return { items: items.slice((p - 1) * limit, p * limit), total: items.length, page: p, pages, limit };
}

/**
 * The most rows a page of a long listing gives, whatever --limit says: a row is at most ~170 bytes, a page under ~20 kB
 * — an agent's tool keeps a longer output in a file and shows only its start (N0280, N0281: the filters never seen).
 */
export const LIST_PAGE_MAX = 100;

/** Footer telling the caller how to see more — in the research's language where the listing is (lang), else English. */
export function moreLine(page: Page<unknown>, command: string, lang?: string): string {
  if (page.page >= page.pages) return "";
  const left = page.total - page.page * page.limit;
  const next = `${command} --page ${page.page + 1}`;
  return lang ? ui(lang, "ui.list.more", { n: String(left), command: next }) : `… ${left} more: ${next}`;
}

export function truncate(text: string, max: number): string {
  const one = text.replace(/\s+/g, " ").trim();
  return [...one].length <= max ? one : [...one].slice(0, max - 1).join("") + "…";
}

/** A count with its noun as English says it: "1 image", "2 images" (`many` where the plural is not one more s). */
export function counted(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function lines(...parts: (string | undefined | false)[]): string {
  return parts.filter((p): p is string => typeof p === "string").join("\n");
}

/** Runs of numbers as ranges: [1, 2, 3, 7] → "1–3, 7". */
export function runs(nums: number[]): string {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j]! + 1) j++;
    out.push(i === j ? `${s[i]}` : `${s[i]}–${s[j]}`);
    i = j + 1;
  }
  return out.join(", ");
}

/**
 * Runs of numbers as a command takes them, one word of the shell: [1, 2, 3, 7] → "1-3,7" (no spaces, no en dash — a
 * hint copied as runs() says it for a person, "1–3, 7", would be three arguments).
 */
export function runsArg(nums: number[]): string {
  return runs(nums).replace(/–/g, "-").replace(/,\s*/g, ",");
}

/** A number as a language writes it (1,4 in Czech, 1.4 in English); a language Intl does not know: English. */
export function numberIn(lang: string, n: number, o: Intl.NumberFormatOptions = { maximumFractionDigits: 1 }): string {
  try {
    return new Intl.NumberFormat(lang, o).format(n);
  } catch {
    return new Intl.NumberFormat("en", o).format(n);
  }
}

/** Seconds of a pace as a language writes them: 0,5 in Czech and German, 0.5 in English (no grouping: 3600, never 3,600). */
export function secondsIn(lang: string, ms: number): string {
  return numberIn(lang, ms / 1000, { maximumFractionDigits: 2, useGrouping: false });
}

/** An argument as it is typed in a shell: quoted when it holds spaces or special characters. */
export function shellArg(arg: string): string {
  return /^[\p{L}\p{M}\p{N}._\/:@+-]+$/u.test(arg) ? arg : `"${arg.replace(/["\\$`]/g, "\\$&")}"`;
}

/**
 * The commands a text names, as a second installation is started (strom-beta doctor, not strom doctor): `strom`
 * before one of strom's own commands (`words`) — never the word in a sentence ("Tento strom ho…"), never a path or a
 * file (strom doctor.txt); at the end of a sentence too (strom chat.).
 */
export function asCommand(text: string, name: string, words: readonly string[]): string {
  if (!words.length) return text;
  const alt = [...new Set(words)].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  // (after an opening quote of any language too: „strom person xyz“, «strom …»)
  return text.replace(new RegExp(`(^|[\\s"'\`(\\[→:=„“«»‚‘])strom(?= (?:${alt})(?![\\p{L}\\p{M}\\p{N}_/\\\\-]|\\.[\\p{L}\\p{M}\\p{N}_]))`, "gu"), `$1${name}`);
}

/** asCommand over a JSON answer: the command lines in it (a value that is one: "strom …") and the hints. */
export function asCommandJson(json: string, name: string, words: readonly string[]): string {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return asCommand(json, name, words);
  }
  const said = new Set(["hint", "message", "text", "why", "next"]);
  const walk = (v: unknown, key?: string): unknown => {
    if (typeof v === "string") return /^strom /.test(v) || (key !== undefined && said.has(key)) ? asCommand(v, name, words) : v;
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  return JSON.stringify(walk(value)) + (json.endsWith("\n") ? "\n" : "");
}
