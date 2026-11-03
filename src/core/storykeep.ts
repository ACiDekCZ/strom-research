// What a story rests on, and that writing it again loses none of it.
//
// A story names its facts (--fact), the sources of its background (--source), and in its text the sources and links
// it was written from (an older story's "rests on" footer with source IDs, a page's address). Written again — more
// facts, a better reading, an agent of another day — the new version used to replace the old one whole: a fact, a
// source or a link the old one had was gone without a word (found 2026-11-03: a story taken over from an older research
// named the page a fire was told on; written again, the fact stayed, but nothing in the story said where it came from).
// Now what the version before had stays, or goes on purpose with a reason (--drop), kept with the story. And the
// sources a story rests on are said wherever it is shown: strom story show, and the Strom file (2 SOUR under _STORY).

import type { Event, Family, Person, Source, Story, StoryDraft } from "./model.ts";
import type { Tree } from "./tree.ts";
import { foldText } from "./text.ts";

/** A version of a story: the story itself or the new one waiting beside it. */
export type StoryVersion = Pick<StoryDraft, "text" | "facts" | "sources" | "title" | "note"> & { dropped?: StoryDrop[] };

/** What a version left out on purpose of the one before it, and why (strom story set --drop). */
export interface StoryDrop {
  /** E…, S… or a link. */
  ref: string;
  why: string;
}

/** A source a story rests on: through its facts (the facts that cite it) or as the background of place and time. */
export interface StorySource {
  id: string;
  title: string;
  url?: string;
  /** The facts of the story that cite it. */
  facts: string[];
  /** Named with --source: the background of place and time. */
  background: boolean;
}

/** What a new version would leave out of the one before it. */
export interface StoryLoss {
  ref: string;
  kind: "fact" | "source" | "link";
  /** A line to show: the fact, the source's title, the link. */
  what: string;
  /** How to keep it. */
  keep: string;
}

// A source's ID in a text: S and digits, neither glued to a letter or digit before nor after (any script).
const SOURCE_ID = /(?<![\p{L}\p{M}\p{N}_])S\d{1,7}(?![\p{L}\p{M}\p{N}_])/gu;
// A link: up to a space or a closing bracket or quote; the punctuation a sentence ends it with is not part of it.
const LINK = /https?:\/\/[^\s<>"'()[\]{}]+/giu;

function words(v: Pick<StoryVersion, "text" | "title" | "note">): string {
  return [v.title, v.text, v.note].filter(Boolean).join("\n");
}

/** The source IDs a text names (those of the tree's sources only). */
export function sourcesNamed(tree: Tree, text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(SOURCE_ID)) {
    const id = `S${m[0].slice(1).padStart(4, "0")}`;
    if (tree.get<Source>(id)?.type === "source") out.add(id);
    else if (tree.get<Source>(m[0])?.type === "source") out.add(m[0]);
  }
  return [...out];
}

/** A link as compared: no punctuation a sentence ended it with, no trailing slash, the scheme and host in lower case. */
export function linkKey(url: string): string {
  const u = url.replace(/[.,;:!?…]+$/u, "").replace(/\/+$/u, "");
  const m = /^(https?:\/\/[^/]+)(.*)$/iu.exec(u);
  return m ? m[1]!.toLowerCase().replace(/^https?:\/\/(www\.)?/u, "") + m[2]! : u;
}

/** The links a text gives, as written (the punctuation ending a sentence left out). */
export function linksIn(text: string): string[] {
  const out = new Map<string, string>();
  for (const m of text.matchAll(LINK)) {
    const url = m[0].replace(/[.,;:!?…]+$/u, "");
    if (!out.has(linkKey(url))) out.set(linkKey(url), url);
  }
  return [...out.values()];
}

/** A fact by its ID, wherever it is (a person's or a family's), or undefined. */
function eventOf(tree: Tree, id: string): Event | undefined {
  for (const t of ["person", "family"] as const)
    for (const r of tree.list<Person | Family>(t)) {
      const e = r.events.find((x) => x.id === id);
      if (e) return e;
    }
  return undefined;
}

/** The sources a version of a story rests on: those its facts cite, then those of its background. */
export function storySources(tree: Tree, v: Pick<StoryVersion, "facts" | "sources">, events?: Map<string, Event>): StorySource[] {
  const out = new Map<string, StorySource>();
  const add = (id: string, fact?: string) => {
    const s = tree.get<Source>(id);
    if (!s || s.type !== "source" || s.retracted) return;
    const row = out.get(id) ?? { id, title: s.title, ...(s.url ? { url: s.url } : {}), facts: [], background: false };
    if (fact && !row.facts.includes(fact)) row.facts.push(fact);
    if (!fact) row.background = true;
    out.set(id, row);
  };
  for (const f of v.facts) {
    const e = events ? events.get(f) : eventOf(tree, f);
    if (!e || e.retracted) continue;
    for (const c of e.citations) add(c.source, e.id);
  }
  for (const s of v.sources ?? []) add(s);
  return [...out.values()];
}

/** A fact as one line: its kind, date and place, how sure it is. */
export function factLine(tree: Tree, id: string): string {
  const e = eventOf(tree, id);
  if (!e) return `${id} (no longer exists)`;
  return `${e.id} ${e.kind}${e.date ? ` ${e.date}` : ""}${e.place ? ` ${e.place}` : ""} [${e.status}]`;
}

/** A source as one line: its ID, title and address. */
export function sourceLine(s: Pick<StorySource, "id" | "title" | "url">): string {
  return `${s.id} ${s.title}${s.url ? ` · ${s.url}` : ""}`;
}

/**
 * What the new version leaves out of the one before it and does not drop on purpose: a fact it named (one taken back
 * since goes by itself), a source of its background or one its text named that no fact of the new one cites, a link
 * its text gave that the new one gives nowhere (in its text, or as the address of a source it rests on).
 */
export function storyLosses(tree: Tree, before: StoryVersion, after: StoryVersion, dropped: string[]): StoryLoss[] {
  const drop = new Set(dropped.map((d) => (/^https?:/iu.test(d) ? linkKey(d) : d.toUpperCase())));
  const out: StoryLoss[] = [];
  for (const f of before.facts) {
    if (after.facts.includes(f) || drop.has(f)) continue;
    const e = eventOf(tree, f);
    if (!e || e.retracted) continue;
    out.push({ ref: f, kind: "fact", what: factLine(tree, f), keep: `--fact ${f}` });
  }
  const kept = storySources(tree, after);
  const keptIds = new Set([...kept.map((s) => s.id), ...sourcesNamed(tree, words(after))]);
  const wanted = new Set([...(before.sources ?? []), ...sourcesNamed(tree, words(before))]);
  for (const id of wanted) {
    if (keptIds.has(id) || drop.has(id)) continue;
    const s = tree.get<Source>(id);
    if (!s || s.type !== "source" || s.retracted) continue;
    out.push({ ref: id, kind: "source", what: sourceLine({ id, title: s.title, ...(s.url ? { url: s.url } : {}) }), keep: `--source ${id}, a fact that cites it, or its ID in the text` });
  }
  const keptLinks = new Set([...linksIn(words(after)), ...kept.flatMap((s) => (s.url ? [s.url] : []))].map(linkKey));
  for (const url of linksIn(words(before))) {
    const key = linkKey(url);
    if (keptLinks.has(key) || drop.has(key)) continue;
    out.push({ ref: url, kind: "link", what: url, keep: "in the text, or a source with that address (--source S…)" });
  }
  return out;
}

/**
 * The facts of a version told from a lead (no record read: an index, an older research, a page not read) whose
 * source the text does not name — by its ID, its address or its title: the reader would not see where it comes from.
 */
export function leadsUnnamed(tree: Tree, v: StoryVersion): { fact: string; sources: StorySource[] }[] {
  const text = words(v);
  const folded = foldText(text);
  const named = new Set(sourcesNamed(tree, text));
  const links = new Set(linksIn(text).map(linkKey));
  const all = storySources(tree, v);
  const out: { fact: string; sources: StorySource[] }[] = [];
  for (const f of v.facts) {
    const e = eventOf(tree, f);
    if (!e || e.retracted || e.status !== "lead") continue;
    const its = all.filter((s) => s.facts.includes(f));
    if (!its.length) continue;
    const said = its.some((s) => named.has(s.id) || (s.url && links.has(linkKey(s.url))) || (foldText(s.title).length >= 6 && folded.includes(foldText(s.title))));
    if (!said) out.push({ fact: f, sources: its });
  }
  return out;
}

/** The version of a story a new one is written over: the new one waiting beside an approved story, else the story. */
export function latestVersion(st: Story | undefined): StoryVersion | undefined {
  return st ? (st.draft ?? st) : undefined;
}
