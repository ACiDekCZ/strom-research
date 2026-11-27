// What a house says on a source with a web address nobody of the research read (spec 145 T7): a claim taken over from an
// older research — the conversion of an old one, a batch — or written on such a source "not read again", whose source has
// an address on the web (a municipality's history as a PDF, a page). A house's research reads it and writes what it says
// in the claim's place, with the place in the source; an address that does not open is one line of what was gone through.
// Never a task or a question of its own (no noise, T5); the copy of the document is never kept (the address stays).
//
// Known by the data alone, never by words (any language): an item of a house (its timeline, holders, residents, numbers,
// its point) citing a source S… with a web address (the source's or the citation's) and no images (an entry of a
// register is read by the reading of scans), which has no transcript, no reading of a document and no write of a
// session (core/review.ts readersOf: a write of "user" — an import, a batch, the conversion of an old research — is no
// reading of the research's), and which the house's "gone through" does not name yet (its S… or its address). A
// citation by an address alone is not taken: whether a session read it is not known.

import type { House, HouseSource, Source } from "./model.ts";
import { readersOf } from "./review.ts";
import type { Tree } from "./tree.ts";

/** A claim of a house on a source with a web address nobody of the research read. */
export interface UnreadClaim {
  house: string;
  /** The item's ID ("e1"), "location" for the house's point. */
  item: string;
  /** Which list: the timeline, holders, residents, numbers, location. */
  list: "timeline" | "holders" | "residents" | "numbers" | "location";
  /** Its short words: "fire 1905-11", "holder Jan Lhoták 1781–". */
  label: string;
  source: string;
  url: string;
  /** Who wrote the item: only the research's own is read into its place. */
  origin: "research" | "import" | "user";
}

const WEB = /^https?:\/\//iu;

/** The house's items with their sources, by list. */
function items(h: House): { list: UnreadClaim["list"]; item: string; label: string; sources?: HouseSource[]; origin: UnreadClaim["origin"] }[] {
  const span = (x: { from?: string; to?: string }) => (x.from || x.to ? ` ${x.from ?? ""}–${x.to ?? ""}` : "");
  return [
    ...(h.timeline ?? []).map((e) => ({ list: "timeline" as const, item: e.id, label: `${e.kind}${e.date ? ` ${e.date}` : ""}`, sources: e.sources, origin: e.origin })),
    ...(h.holders ?? []).map((x) => ({ list: "holders" as const, item: x.id, label: `holder ${x.name}${span(x)}`, sources: x.sources, origin: x.origin })),
    ...(h.residents ?? []).map((x) => ({ list: "residents" as const, item: x.id, label: `resident ${x.name}${span(x)}`, sources: x.sources, origin: x.origin })),
    ...(h.numbers ?? []).filter((n) => !n.notSame).map((n) => ({ list: "numbers" as const, item: n.id, label: `number ${n.number}${span(n)}`, sources: n.sources, origin: n.origin })),
    ...(h.location ? [{ list: "location" as const, item: "location", label: "its point", sources: h.location.sources, origin: h.location.origin }] : []),
  ];
}

/**
 * The claims of these houses (or municipalities' records) on a source with a web address nobody of the research read,
 * not named in their "gone through" yet — in the houses' order, each source of an item once. The history is read only
 * when a house cites such a source at all.
 */
export function unreadWebClaims(tree: Tree, houses: (House | undefined)[]): UnreadClaim[] {
  const found: UnreadClaim[] = [];
  const sources = new Map<string, Source | undefined>();
  const sourceOf = (id: string) => (sources.has(id) ? sources.get(id) : sources.set(id, tree.get<Source>(id)).get(id));
  for (const h of houses) {
    if (!h) continue;
    const passed = h.passed ?? [];
    const named = (s: string, url: string) => passed.some((p) => p.source === s || p.url === url || (p.what ?? "").includes(url));
    for (const it of items(h)) {
      const seen = new Set<string>();
      for (const c of it.sources ?? []) {
        if (!c.source || seen.has(c.source)) continue;
        const s = sourceOf(c.source);
        // an entry of a register on its images (a book, an image, a crop): read by the reading of scans, not here
        if (!s || s.retracted || s.recordset || s.media?.length || s.clips?.length) continue;
        // its address: the source's, else one the item cites beside it
        const url = [s.url, c.url, ...(it.sources ?? []).filter((x) => !x.source).map((x) => x.url)].find((u): u is string => !!u && WEB.test(u));
        if (!url || s.transcript?.trim() || s.reading || s.app?.read) continue;
        if (named(s.id, url)) continue;
        seen.add(s.id);
        found.push({ house: h.id, item: it.item, list: it.list, label: it.label, source: s.id, url, origin: it.origin });
      }
    }
  }
  if (!found.length) return found;
  // read by a session of the research (its model, or one nobody recorded): not unread
  const readers = readersOf(tree);
  return found.filter((c) => ![...(readers.get(c.source) ?? [])].some((who) => who !== "user"));
}

const ADD: Record<UnreadClaim["list"], string> = { timeline: "event", holders: "holder", residents: "resident", numbers: "number", location: "" };

/** What a house's research does with such a claim: one line for the agent (the brief, the done check). */
export function unreadClaimLine(c: UnreadClaim, ref: string = c.house): string {
  const head = `${c.house} ${c.item} (${c.label}) on ${c.source} <${c.url}>`;
  const passed = `strom house add passed ${ref} --source ${c.source} --url ${c.url}`;
  const into =
    c.origin !== "research"
      ? `the ${c.origin === "user" ? "person's" : "imported"} item stays: what the reading says as an item of its own beside it`
      : c.list === "location"
        ? "its point as the reading says it (strom house add location)"
        : `strom house add ${ADD[c.list]} ${ref} --replaces ${c.item} … --source ${c.source} --locator "<page or section>" --certainty <by the kind of source>`;
  return `${head}: read it, then ${into}, and ${passed} --found yes --what "<read: what it confirms or corrects>"; not reachable (gone, behind a login): ${passed} --found no --what "<unavailable: address, day>"`;
}
