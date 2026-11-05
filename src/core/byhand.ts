// An archive only a person's browser reaches (strom's list of archives' terms, or its robots.txt keeping automated
// tools off the whole site), whose person gave no permission "through the browser": its images come by the person's
// hand. Derived from strom's list each time, never written into a book — a book written as online-free before strom
// knew it (or brought in by a GEDCOM) reads right with nothing rewritten.

import path from "node:path";
import type { Tree } from "./tree.ts";
import { archiveLevel } from "./terms.ts";

/** The archive's host and how strom knows, when a book's address leads to an archive only a person's browser reaches. */
export function browserOnlyArchive(tree: Tree, url: string | undefined, shared: string | undefined): { host: string; title?: string; by: "robots" | "terms" } | undefined {
  if (!url || !URL.canParse(url)) return undefined;
  try {
    const net = shared ? path.join(shared, "net") : undefined;
    const a = archiveLevel(tree.env, { url, tree, readOnly: true, ...(net ? { net } : {}) });
    if (!a.browserOnly || a.permission === "browser") return undefined;
    return { host: a.host, ...(a.title ? { title: a.title } : {}), by: a.browserOnly.by };
  } catch {
    return undefined;
  }
}

/** What a book of such an archive says for its access (the agent's words). */
export function browserOnlyAccess(access: string, a: { host: string; title?: string }): string {
  return `${access === "online-free" ? "online, free to view — " : `${access} — `}only through a person's browser (${a.title ?? a.host}, strom's list of archives): its images by the person's hand, strom task wait T… --images B…:<numbers>`;
}
