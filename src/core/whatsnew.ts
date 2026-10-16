// What is new in this strom, for the Strom app (the bridge's GET <token>/whats-new): the points of the running
// version's section of the changelog shipped with strom (CHANGELOG.md, CHANGELOG.cs.md, CHANGELOG.de.md beside
// dist/ and assets/), in the language the app asks for, and where the whole section is on GitHub. Read only; the
// files missing or without the section: no points, the address still said.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { whatsNewUrl, type Channel } from "./update.ts";

/** The folder of strom's package: package.json, the changelogs, dist/ or src/, assets/. */
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The languages with a changelog of their own; any other reads the English one. */
const LANGS = new Set(["cs", "de"]);
export const WHATS_NEW_MAX_POINTS = 20;
export const WHATS_NEW_MAX_CHARS = 1000;

export interface WhatsNew {
  version: string;
  /** The language the points are in (another, or one whose changelog lacks the section: en). */
  lang: string;
  url: string;
  /** Each top-level item of the section, its markdown inline only; empty when there is none. */
  points: string[];
}

function fileOf(lang: string): string {
  return lang === "en" ? "CHANGELOG.md" : `CHANGELOG.${lang}.md`;
}

/**
 * The top-level items of the section `## <X.Y.Z>` (the version without its prerelease part): one string each, its
 * `- ` taken off and its lines joined by a space. Paragraphs (the note in italics under the heading) and anything
 * else are not items; HTML tags are taken out. None: an empty list.
 */
export function changelogPoints(text: string, version: string): string[] {
  const base = (version.split(/[-+]/)[0] ?? version).trim();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const heading = new RegExp(`^##\\s+${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`);
  const start = lines.findIndex((l) => heading.test(l.trim()));
  if (start < 0) return [];
  const points: string[] = [];
  let item: string[] | undefined;
  const close = () => {
    if (item) points.push(item.join(" "));
    item = undefined;
  };
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break;
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      close();
      item = [bullet[1]!.trim()];
    } else if (item && line.trim() && /^\s/.test(line)) item.push(line.trim());
    else close();
  }
  close();
  return points
    .map((p) => p.replace(/<\/?[A-Za-z][^>]*>/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, WHATS_NEW_MAX_POINTS)
    .map((p) => ([...p].length > WHATS_NEW_MAX_CHARS ? [...p].slice(0, WHATS_NEW_MAX_CHARS - 1).join("") + "…" : p));
}

function read(dir: string, lang: string): string | undefined {
  try {
    return fs.readFileSync(path.join(dir, fileOf(lang)), "utf8");
  } catch {
    return undefined;
  }
}

/**
 * What is new in a version, in a language (cs, de; any other: en) — from that language's changelog, else the
 * English one; the address of the section on the branch of the channel (whatsNewUrl).
 */
export function whatsNew(version: string, asked: string | null | undefined, channel: Channel, dir: string = PACKAGE_ROOT): WhatsNew {
  const code = (asked ?? "").trim().toLowerCase().split(/[-_]/)[0] ?? "";
  const lang = LANGS.has(code) ? code : "en";
  for (const from of lang === "en" ? ["en"] : [lang, "en"]) {
    const text = read(dir, from);
    const points = text === undefined ? [] : changelogPoints(text, version);
    if (points.length) return { version, lang: from, url: whatsNewUrl(version, channel, from), points };
  }
  return { version, lang, url: whatsNewUrl(version, channel, lang), points: [] };
}
