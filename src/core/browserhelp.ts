// Where the agent's browser helps: an archive only a person's browser goes to (strom's list of archives' terms, or its
// robots.txt keeping automated tools off the whole site) lets its images through the agent's browser with the person's
// permission "through the browser" — and only where strom keeps that browser (its hook before each page: Claude Code
// with the Claude in Chrome extension). Another agent's browser or computer use strom does not see: there the person
// saves the images by hand (strom task wait --images), and the person is told that with Claude Code and Claude in
// Chrome the agent would save them itself (spec 048 story 5). Read only; derived each time, nothing written.

import path from "node:path";
import type { Env } from "./paths.ts";
import type { RecordSet, Repository, Source } from "./model.ts";
import type { Tree } from "./tree.ts";
import { allows, archiveLevel, type ArchiveLevel } from "./terms.ts";
import { knownDisallow } from "./knownterms.ts";
import { claudeInChrome, CLAUDE_IN_CHROME_URL } from "./browser.ts";

/**
 * The agents whose browser strom keeps — its hook runs before each page and each tool on a page (count, pace, an
 * archive only a person's browser goes to, the bridge): Claude Code's Claude in Chrome. Any other agent's browser or
 * computer use goes unseen: never to such an archive.
 */
export const GUARDED_BROWSER_AGENTS: readonly string[] = ["claude"];

/** Whether strom keeps this agent's browser (its hooks before each page). */
export function browserKept(agent: string | undefined): boolean {
  return !!agent && GUARDED_BROWSER_AGENTS.includes(agent);
}

/**
 * The agent's browser here: ready (Claude Code, the extension in a browser), no extension (Claude Code without it:
 * its address), or an agent whose browser strom does not keep.
 */
export type BrowserState = "ready" | "no-extension" | "agent-without-browser";

export function browserState(env: Env, agent: string | undefined): { state: BrowserState; url?: string; browsers?: string[] } {
  if (!browserKept(agent)) return { state: "agent-without-browser" };
  const found = claudeInChrome(env).extension;
  return found.length ? { state: "ready", browsers: found } : { state: "no-extension", url: CLAUDE_IN_CHROME_URL };
}

/** An archive of the tree only a person's browser goes to, where the agent's browser could fetch its images. */
export interface BrowserArchive {
  host: string;
  title?: string;
  /** The person allowed it "through the browser". */
  permitted: boolean;
}

/**
 * The archives the tree's records name (record sets, their archives, sources with an address) that only a person's
 * browser goes to and where the agent's browser would help: never one by hand only, forbidden, refused, nor one whose
 * pages strom's list keeps every automated tool off ("Disallow: /") — Claude in Chrome would not help there.
 */
export function treeBrowserArchives(tree: Tree, shared: string | undefined): BrowserArchive[] {
  const net = shared ? path.join(shared, "net") : undefined;
  const out = new Map<string, BrowserArchive>();
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const r of [...tree.list<RecordSet>("recordset"), ...tree.list<Repository>("repository"), ...tree.list<Source>("source")])
    if (r.url && !r.retracted && URL.canParse(r.url)) urls.push(r.url);
  for (const url of urls) {
    const host = new URL(url).hostname.toLowerCase();
    if (seen.has(host)) continue;
    seen.add(host);
    try {
      const a = archiveLevel(tree.env, { url, tree, readOnly: true, ...(net ? { net } : {}) });
      if (!a.browserOnly || a.refused || out.has(a.host)) continue;
      // the person's "through the browser" would open it: else the agent's browser never helps there
      if (!allows({ ...a, permission: "browser" }, "images", "browser").ok) continue;
      if (knownDisallow(host).includes("/")) continue;
      out.set(a.host, { host: a.host, ...(a.title ? { title: a.title } : {}), permitted: a.permission === "browser" });
    } catch {
      // what strom keeps of it cannot be read: nothing said
    }
  }
  return [...out.values()];
}

/** The same for one book's address (a waiting task's record set, the brief of a task). */
export function bookBrowserArchive(tree: Tree, url: string | undefined, shared: string | undefined): BrowserArchive | undefined {
  if (!url || !URL.canParse(url)) return undefined;
  const net = shared ? path.join(shared, "net") : undefined;
  try {
    const a = archiveLevel(tree.env, { url, tree, readOnly: true, ...(net ? { net } : {}) });
    if (!a.browserOnly || a.refused || !allows({ ...a, permission: "browser" }, "images", "browser").ok) return undefined;
    if (knownDisallow(new URL(url).hostname.toLowerCase()).includes("/")) return undefined;
    return { host: a.host, ...(a.title ? { title: a.title } : {}), permitted: a.permission === "browser" };
  } catch {
    return undefined;
  }
}

/**
 * For the agent (English): what its browser may do at an archive only a person's browser goes to — Claude Code with
 * the extension and the person's permission: its own browser, page by page; anything else: the person's hand.
 */
export function agentBrowserAdvice(env: Env, agent: string | undefined, a: BrowserArchive, task = "T…", book = "B…", withWait = true): string {
  const wait = withWait ? `: strom task wait ${task} --images ${book}:<numbers> --on "<the book, its link, which images — impersonal, in the research language>"` : "";
  const s = browserState(env, agent);
  if (s.state === "agent-without-browser")
    return `strom does not keep your browser or computer use (no hook of strom's before a page): never use them for ${a.title ?? a.host} — the person saves the images by hand${wait}. ${tellClaude}`;
  if (s.state === "no-extension")
    return `the Claude in Chrome extension is in no browser here — the person saves the images by hand${wait}. Tell the user once: with the extension (${s.url}) and the permission "through the browser" the agent would save them itself.`;
  if (!a.permitted)
    return `your browser goes there only with the person's permission "through the browser" (strom allow archive ${a.host} --way browser — the person's, never yours); until then the person saves the images by hand${wait}.`;
  return `through your browser (Claude in Chrome), one image at a time at a person's pace: strom media save ${task} --image <n> --at <the archive's page of that image> gives the script that saves it in your tab, strom media add --inbox --waiting takes it; else the person saves them by hand${wait}.`;
}

const tellClaude = "Tell the user once: with Claude Code and the Claude in Chrome extension the agent would save them itself (strom agents use claude).";

/** Whether the agent's browser could ever fetch images of this archive (the person's "through the browser" would open it). */
export function browserHelps(a: ArchiveLevel): boolean {
  if (!a.browserOnly || a.refused || !allows({ ...a, permission: "browser" }, "images", "browser").ok) return false;
  return !knownDisallow(a.host).includes("/");
}

/**
 * For an agent running strom at an archive only a person's browser goes to (strom fetch's refusal, net web --check): what
 * its own browser may do there — never anything for an agent whose browser strom does not keep (nor its computer use);
 * none for a person (no agent known).
 */
export function browserAdviceFor(env: Env, agent: string | undefined, a: ArchiveLevel, task?: string, book?: string): string | undefined {
  if (!agent || !a.browserOnly) return undefined;
  if (!browserHelps(a)) return browserKept(agent) ? undefined : "strom does not keep your browser or computer use: never use them there.";
  return agentBrowserAdvice(env, agent, { host: a.host, ...(a.title ? { title: a.title } : {}), permitted: a.permission === "browser" }, task, book, false);
}

/**
 * The refusal an agent whose browser strom does not keep gets at an archive only a person's browser goes to — its web
 * fetch and its browser alike, whatever the person allowed: the person saves the images by hand.
 */
export function withoutBrowserReason(a: ArchiveLevel, name: string, task: string | undefined, book: string, otherWay: string): string {
  return (
    `strom: ${name} lets automated tools in only through a person's browser, and strom does not keep your browser or computer use (no hook of strom's before a page): never use them for it, nor your web fetch. ` +
    `The person saves what is needed by hand: strom task wait ${task ?? "T…"} --images ${book}:<numbers> --on "<the book, its link, which images — impersonal, in the research language>" (strom makes the inbox folder they go into; saved there, they bring the task back by themselves). ` +
    `${browserHelps(a) ? `${tellClaude} ` : ""}${otherWay}`
  );
}

/**
 * What the person is told beside images of such an archive saved by hand (strom's menu, the bridge's waiting): a
 * catalogue key and its words — nothing where the agent would save them itself now.
 */
export function personBrowserNote(env: Env, agent: string | undefined, a: BrowserArchive): { key: "ui.waiting.browser.agent" | "ui.waiting.browser.noext" | "ui.waiting.browser.permission"; params: Record<string, string> } | undefined {
  const s = browserState(env, agent);
  if (s.state === "agent-without-browser") return { key: "ui.waiting.browser.agent", params: { agent: agent ?? "" } };
  if (s.state === "no-extension") return { key: "ui.waiting.browser.noext", params: { url: s.url ?? CLAUDE_IN_CHROME_URL } };
  if (!a.permitted) return { key: "ui.waiting.browser.permission", params: { archive: a.title ?? a.host } };
  return undefined;
}
