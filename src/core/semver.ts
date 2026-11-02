// Versions of strom compared by semver (a module of its own: core/tree.ts asks it too, and core/update.ts imports tree.ts).

/** One version's parts by semver: its numbers and its prerelease identifiers (none for a release). */
function semver(v: string): { main: number[]; pre: string[] } {
  const [main = "", pre] = v.trim().replace(/^v/, "").split("+")[0]!.split(/-(.*)/s);
  return { main: main.split(".").map((x) => Number.parseInt(x, 10) || 0), pre: pre ? pre.split(".") : [] };
}

/**
 * Semver precedence: < 0 when a is older than b, 0 the same, > 0 newer. The numbers first; a release is newer than
 * any prerelease of it (1.12.0 > 1.12.0-rc.7); prereleases by their identifiers — numbers as numbers, words by their
 * letters, a number before a word, the shorter set first when the rest is equal (beta.2 < beta.10 < rc.1).
 */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if ((x.main[i] ?? 0) !== (y.main[i] ?? 0)) return (x.main[i] ?? 0) - (y.main[i] ?? 0);
  if (!x.pre.length || !y.pre.length) return (x.pre.length ? 0 : 1) - (y.pre.length ? 0 : 1);
  const numeric = /^\d+$/;
  for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i++) {
    const [p, q] = [x.pre[i]!, y.pre[i]!];
    if (p === q) continue;
    const [pn, qn] = [numeric.test(p), numeric.test(q)];
    if (pn && qn) return Number(p) - Number(q);
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return x.pre.length - y.pre.length;
}
