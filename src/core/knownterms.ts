// The terms of archives strom ships (assets/archives.json): a curated list of hosts with the level their published
// terms give automated access, the address of the terms and the sentence quoted, checked on a day said. A level from
// the list is a confirmed one — a connector's "allowed" there needs no person's word, a connector taken over there no
// confirmation — and still the strictest of all that is known holds (core/terms.ts). Besides the level an entry may
// give a pace (a site's Crawl-delay: only ever slower), paths no automated request takes (its robots.txt, kept here
// as well), an archive only a person's browser goes to, a note of what the level covers (for the agent), and whether
// the terms quoted expressly allow automated use (`automatedUse`: then a Disallow of the site's robots.txt alone
// yields, carefully — core/net.ts robotsYields; the paths kept here never do).
// Read by core/terms.ts (the levels) and core/net.ts (the pace, the paths) — nothing of either is imported here.

import { assetPath } from "./assets.ts";
import { readJsonIfExists } from "./json.ts";

/** A level as the list gives it (unknown: the terms not found — as restricted). */
export type KnownLevel = "allowed" | "restricted" | "manual" | "forbidden" | "unknown";
export const KNOWN_LEVELS: readonly KnownLevel[] = ["allowed", "restricted", "manual", "forbidden", "unknown"];
const RANK: Record<KnownLevel, number> = { allowed: 0, unknown: 1, restricted: 1, manual: 2, forbidden: 3 };

export interface KnownTerms {
  /** A host, or a site with its subdomains. */
  host: string;
  level: KnownLevel;
  name?: string;
  terms?: string;
  quote?: string;
  /** The quote is the site's robots.txt (its address `terms`), not its terms of use: said so to the person. */
  quoteFrom?: "robots";
  /** The terms page itself, where `terms` is the robots.txt (what it says: termsPageSays). */
  termsPage?: string;
  checked?: string;
  /** The archive lets automated tools in only through a person's browser (no direct request at all). */
  browserOnly?: boolean;
  /** The slowest pace the site asks (its Crawl-delay): a floor of every pace strom keeps there. */
  pace?: { minIntervalMs?: number };
  /** Paths no automated request takes (robots.txt syntax), whatever strom reads of its robots.txt. */
  disallow?: string[];
  /** What the level covers (for the agent): "catalogue only", "public-domain works through the API". */
  scope?: string;
  /** The site's own search, an address the agent's web tools fetch as given ({q} the words, {from} {to} the years, {pid} an item found). */
  search?: KnownSearch[];
  /** What its robots.txt said when it was checked. */
  robots?: string;
  /**
   * Its terms (the quote, word for word, at `terms`) expressly allow automated use — open data, a licence for any use,
   * an interface for programs: a Disallow of its robots.txt alone yields (core/net.ts robotsYields), carefully — one
   * request after another, at least its Crawl-delay, strom's User-Agent, its limits and backoff as ever. Never a
   * robots.txt that names AI agents or strom, never the paths `disallow` keeps off. Optional: none, robots.txt holds.
   */
  automatedUse?: boolean;
  /** A test's own (STROM_ARCHIVES_FILE), not strom's. */
  extra?: boolean;
}

export interface KnownSearch {
  what: string;
  url: string;
}

/**
 * The hosts whose "allowed" came from a test's own list (STROM_ARCHIVES_FILE: this computer only): core/net.ts resolves
 * them again before each request and asks them only while every address is this computer's. `lookup` stands for the
 * system's resolver in a test.
 */
export const loopbackGuard: { hosts: Set<string>; lookup?: (host: string) => string[] } = { hosts: new Set() };

export const bare = (h: string) => h.replace(/^\*\./, "").toLowerCase();

export function within(host: string, of: string): boolean {
  const h = host.toLowerCase();
  const o = bare(of);
  return h === o || h.endsWith(`.${o}`);
}

export function readPack(file: string): KnownTerms[] {
  try {
    const v = readJsonIfExists<{ archives?: unknown }>(file);
    if (!v || !Array.isArray(v.archives)) return [];
    return (v.archives as Record<string, unknown>[])
      .filter((a): a is KnownTerms & Record<string, unknown> => !!a && typeof a.host === "string" && !!a.host && KNOWN_LEVELS.includes(a.level as KnownLevel))
      .map((a) => ({ ...a, host: bare(a.host) }));
  } catch {
    return [];
  }
}

let shipped: KnownTerms[] | undefined;
/** strom's own list. */
export function shippedTerms(): KnownTerms[] {
  return (shipped ??= readPack(assetPath("archives.json")));
}

/**
 * How much stricter entry `b` is than `a` at the same rank (> 0: b): only a person's browser before a direct request,
 * restricted before unknown (it is known), a slower pace, then the more specific host (the archive's own entry before
 * its site's) — never the order of the list, so a site's entry above a host cannot lift what the host's own says.
 */
function stricterAtRank(a: KnownTerms, b: KnownTerms): number {
  const pace = (k: KnownTerms) => (typeof k.pace?.minIntervalMs === "number" && Number.isFinite(k.pace.minIntervalMs) ? k.pace.minIntervalMs : 0);
  return (
    Number(!!b.browserOnly) - Number(!!a.browserOnly) ||
    Number(b.level === "restricted") - Number(a.level === "restricted") ||
    pace(b) - pace(a) ||
    b.host.split(".").length - a.host.split(".").length
  );
}

/** The strictest of entries: the highest level, at the same level the stricter entry (stricterAtRank). */
export function strictestEntry(hits: KnownTerms[]): KnownTerms | undefined {
  if (!hits.length) return undefined;
  return hits.reduce((a, b) => (RANK[b.level] > RANK[a.level] || (RANK[b.level] === RANK[a.level] && stricterAtRank(a, b) > 0) ? b : a));
}

/** The slowest pause strom's list asks of a host (its Crawl-delay; 0: none) — a floor, slower only. */
export function knownPaceMs(host: string): number {
  return Math.max(0, ...shippedTerms().filter((k) => within(host, k.host)).map((k) => k.pace?.minIntervalMs ?? 0));
}

/**
 * An entry whose terms expressly allow automated use: `automatedUse` on an "allowed" one, quoted word for word from its
 * terms (not its robots.txt) and not only for a person's browser — anything less, robots.txt holds as before.
 */
export function openByTerms(k: KnownTerms | undefined): boolean {
  return !!k && k.automatedUse === true && k.level === "allowed" && !k.browserOnly && k.quoteFrom !== "robots" && typeof k.quote === "string" && !!k.quote.trim() && typeof k.terms === "string" && /^https?:\/\//u.test(k.terms);
}

/** strom's own list says a host's terms expressly allow automated use (its strictest entry, a site above it too). */
export function knownOpen(host: string): boolean {
  return openByTerms(strictestEntry(shippedTerms().filter((k) => within(host, k.host))));
}

/** The paths strom's list keeps automated requests off on a host. */
export function knownDisallow(host: string): string[] {
  return [...new Set(shippedTerms().filter((k) => within(host, k.host)).flatMap((k) => (Array.isArray(k.disallow) ? k.disallow.filter((d) => typeof d === "string" && d.startsWith("/")) : [])))];
}

/**
 * The search addresses strom's list gives for a host (its own, else its site's): what an agent tried blind before
 * (a Solr query's brackets and spaces unencoded: HTTP 400; a search page empty without a browser).
 */
export function knownSearch(host: string): KnownSearch[] {
  const seen = new Set<string>();
  return shippedTerms()
    .filter((k) => within(host, k.host) && Array.isArray(k.search))
    .flatMap((k) => k.search!.filter((x): x is KnownSearch => !!x && typeof x.url === "string" && /^https:\/\//.test(x.url) && typeof x.what === "string"))
    .filter((x) => !seen.has(x.url) && !!seen.add(x.url));
}

/** The search addresses as lines for the agent (none: undefined). */
export function searchText(host: string): string | undefined {
  const all = knownSearch(host);
  if (!all.length) return undefined;
  return `strom: ${host}'s own search, fetched as given — {q} the words (a word, or (word OR word)), {from} {to} the years, {pid} an item found; every space %20, ( %28, ) %29, [ %5B, ] %5D, : %3A, " %22: ${all.map((x) => `${x.what}: ${x.url}`).join(" · ")}`;
}
