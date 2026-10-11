// Files shipped with strom (method pack, templates). They live in assets/
// next to src/ and dist/, so the same relative path works from both.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "assets");

export function assetPath(...parts: string[]): string {
  return path.join(ROOT, ...parts);
}

const cache = new Map<string, string>();

export function readAsset(...parts: string[]): string | undefined {
  const file = assetPath(...parts);
  if (cache.has(file)) return cache.get(file);
  try {
    const text = fs.readFileSync(file, "utf8");
    cache.set(file, text);
    return text;
  } catch {
    return undefined;
  }
}

/** The pages of the method each level is given, besides the core and its own page. */
export const METHOD_PAGES: Record<string, string[]> = {
  link: ["recording.md", "reading.md"],
  verify: ["recording.md", "reading.md"],
  enrich: ["recording.md", "reading.md"],
  intake: ["reading.md"],
  links: [],
};

/**
 * The method of a task that links hypotheses to the tree (origin hypothesis:links), whatever its level: it reads no
 * records — the core's parts marked for it, no page of a level.
 */
export const METHOD_LINKS = "links";

/**
 * What a part of the method may be given for besides the level: a record set of the brief comes through a connector
 * (`connector`), one that fetches a part of an image sharper (`part`), one of them has none (`no-connector`: build one),
 * or the user saves one's images by hand (`by-hand`: the archive allows no automation, or its connector only finds
 * books) — a brief that names no record set has them all.
 */
export const METHOD_CONDITIONS = ["connector", "part", "no-connector", "by-hand"] as const;
export type MethodCondition = (typeof METHOD_CONDITIONS)[number];

const MARK = /^<!-- for ([^>]*?) -->$/u;
const END = "<!-- end -->";

/**
 * The parts of one page of the method a level is given. A part a level does not use is marked on its page —
 * `<!-- for link verify … -->` … `<!-- end -->` — with the levels it is for and, besides, the conditions it needs
 * (any one of them). Unmarked text is everyone's; marks do not nest. With no level, the whole page but what is for a
 * task linking hypotheses alone (METHOD_LINKS).
 */
export function methodPage(text: string, level: string | undefined, conditions: readonly string[] = []): string {
  const out: string[] = [];
  let keep = true;
  for (const line of text.split("\n")) {
    const mark = MARK.exec(line);
    if (mark) {
      const words = mark[1]!.trim().split(/\s+/u);
      const levels = words.filter((w) => !(METHOD_CONDITIONS as readonly string[]).includes(w));
      const when = words.filter((w) => (METHOD_CONDITIONS as readonly string[]).includes(w));
      // no level (a brief with no task): the whole page, but the part of a task linking hypotheses
      keep = !level ? !levels.length || levels.some((l) => l !== METHOD_LINKS) : ((!levels.length || levels.includes(level)) && (!when.length || when.some((w) => conditions.includes(w))));
      continue;
    }
    if (line === END) {
      keep = true;
      continue;
    }
    if (keep) out.push(line);
  }
  return out.join("\n");
}

/** Method text for a task level: the core plus the level's own page and the pages it works by, each with the parts the level uses. */
export function methodFor(level: string | undefined, conditions: readonly string[] = []): string {
  const pages = ["core.md", ...(level ? [...(level === METHOD_LINKS ? [] : [`${level}.md`]), ...(METHOD_PAGES[level] ?? [])] : [])];
  return pages.map((p) => readAsset("method", p)).filter((t): t is string => !!t).map((t) => methodPage(t, level, conditions)).join("\n");
}
