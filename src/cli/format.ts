// Compact, token-efficient text output: aligned columns, one row per record,
// no box drawing, IDs first.

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

/** Footer telling the caller how to see more. */
export function moreLine(page: Page<unknown>, command: string): string {
  if (page.page >= page.pages) return "";
  const left = page.total - page.page * page.limit;
  return `… ${left} more: ${command} --page ${page.page + 1}`;
}

export function truncate(text: string, max: number): string {
  const one = text.replace(/\s+/g, " ").trim();
  return [...one].length <= max ? one : [...one].slice(0, max - 1).join("") + "…";
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

/** An argument as it is typed in a shell: quoted when it holds spaces or special characters. */
export function shellArg(arg: string): string {
  return /^[\p{L}\p{M}\p{N}._\/:@+-]+$/u.test(arg) ? arg : `"${arg.replace(/["\\$`]/g, "\\$&")}"`;
}
