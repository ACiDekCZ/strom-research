// Where the agent's browser helps: an archive only a person's browser goes to (strom's list of archives' terms, or its
// robots.txt keeping automated tools off the whole site) lets its images through the agent's browser with the person's
// permission "through the browser" — and only where strom keeps that browser (its hook before each page: Claude Code
// with the Claude in Chrome extension; Codex's browser once the person confirmed strom's hooks of the tree in Codex,
// core/codexhook.ts). Another agent's browser or computer use strom does not see: there the person saves the images by
// hand (strom task wait --images), and the person is told that with Claude Code and Claude in Chrome the agent would
// save them itself (spec 048 story 5). Read only; derived each time, nothing written.

import path from "node:path";
import type { Env } from "./paths.ts";
import type { RecordSet, Repository, Source } from "./model.ts";
import type { Tree } from "./tree.ts";
import { allows, archiveLevel, type ArchiveLevel } from "./terms.ts";
import { knownDisallow } from "./knownterms.ts";
import { claudeInChrome, CLAUDE_IN_CHROME_URL } from "./browser.ts";
import { codexHookState } from "./codexhook.ts";
import { whereToTalk } from "./apps.ts";
import { Settings } from "./config.ts";

/**
 * The agents whose browser strom keeps — its hook runs before each page and each tool on a page (count, pace, an
 * archive only a person's browser goes to, the bridge): Claude Code's Claude in Chrome; Codex's browser in the terminal
 * (its REPLs' js) only in a tree whose hooks the person confirmed in Codex (codexHookState "trusted", strom doc R12.5)
 * — else Codex does not run them —, never the ChatGPT app's (codexInChatgptApp). Any other agent's browser, and every agent's computer use, goes unseen: strom does not
 * recommend it — never of the agent's own accord to such an archive; only the person's explicit request makes it the
 * person's choice (ON_REQUEST). Nothing of it is switched off.
 */
export const GUARDED_BROWSER_AGENTS: readonly string[] = ["claude", "codex"];

/** The agents whose browser strom keeps only once the person confirmed strom's hooks of the tree in the agent. */
const KEPT_WHEN_CONFIRMED: readonly string[] = ["codex"];

/**
 * The person talks with Codex in the ChatGPT app (agent.where app, or only its app here), and this is no agent strom
 * started itself (strom chat in a terminal, strom run: STROM_WORKER, STROM_SESSION — Codex's CLI, its hooks run). The
 * ChatGPT app runs its turns through ChatGPT's cloud since 26.1103 and calls no hook of the tree (found live 8 November
 * 2026; before, 26.1021, its browser was cua_repl's): strom does not keep its browser, whatever Codex says of the hooks
 * — ChatGPT decides on the sites itself (its "cloud browser" dialog). Spec 062 P6.
 */
export function codexInChatgptApp(env: Env): boolean {
  if (env.STROM_WORKER || env.STROM_SESSION) return false;
  try {
    return whereToTalk("codex", new Settings(env, {}).agentWhere(), env) === "app";
  } catch {
    return false;
  }
}

/** Whether strom keeps this agent's browser (its hooks before each page) — in the tree at root (Codex: its hooks confirmed there, never the ChatGPT app's). */
export function browserKept(agent: string | undefined, root?: string, env?: Env): boolean {
  if (!agent || !GUARDED_BROWSER_AGENTS.includes(agent)) return false;
  if (!KEPT_WHEN_CONFIRMED.includes(agent)) return true;
  if (!root || !env) return false;
  if (agent === "codex" && codexInChatgptApp(env)) return false;
  try {
    return codexHookState(root, env) === "trusted";
  } catch {
    return false;
  }
}

/**
 * The agent's browser here: ready (Claude Code, the extension in a browser; Codex, strom's hooks of the tree at root
 * confirmed in it), no extension (Claude Code without it: its address), or an agent whose browser strom does not keep.
 */
export type BrowserState = "ready" | "no-extension" | "agent-without-browser";

export function browserState(env: Env, agent: string | undefined, root?: string): { state: BrowserState; url?: string; browsers?: string[] } {
  if (!browserKept(agent, root, env)) return { state: "agent-without-browser" };
  if (agent !== "claude") return { state: "ready" };
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
export function agentBrowserAdvice(env: Env, agent: string | undefined, a: BrowserArchive, task = "T…", book = "B…", withWait = true, root?: string): string {
  const wait = withWait ? `: strom task wait ${task} --images ${book}:<numbers> --on "<the book, its link, which images — impersonal, in the research language>"` : "";
  const s = browserState(env, agent, root);
  if (s.state === "agent-without-browser")
    return `strom does not keep your browser or computer use (no hook of strom's before a page) and does not recommend them: not of your own accord for ${a.title ?? a.host} — the person saves the images by hand${wait}. ${ON_REQUEST} ${tellClaude}`;
  if (s.state === "no-extension")
    return `the Claude in Chrome extension is in no browser here — the person saves the images by hand${wait}. Tell the user once: with the extension (${s.url}) and the permission "through the browser" the agent would save them itself.`;
  if (!a.permitted)
    return `your browser goes there only with the person's permission "through the browser" (strom allow archive ${a.host} --way browser — the person's, never yours); until then the person saves the images by hand${wait}.`;
  const yours = agent === "claude" ? "Claude in Chrome" : `its address written out in your code, tab.goto("<the page>") — strom's hook sees only an address it can read`;
  return `through your browser (${yours}), one image at a time at a person's pace: strom media save ${task} --image <n> --at <the archive's page of that image> gives the script that saves it in your tab, strom media add --inbox --waiting takes it; else the person saves them by hand${wait}.`;
}

/**
 * A browser or computer use strom does not keep, at an archive only a person's browser goes to: never of the agent's own
 * accord — but nothing is switched off, and the person who asks for it explicitly chooses it (Milan, 5 November 2026).
 */
export const ON_REQUEST =
  "Only if the person explicitly asks you to use them there: the person's choice — say in one sentence that strom does not watch that way and what the archive's terms say; never a way round them, never a check whether a person is there.";

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
export function browserAdviceFor(env: Env, agent: string | undefined, a: ArchiveLevel, task?: string, book?: string, root?: string): string | undefined {
  if (!agent || !a.browserOnly) return undefined;
  if (!browserHelps(a)) return browserKept(agent, root, env) ? undefined : `strom does not keep your browser or computer use and does not recommend them: not of your own accord there. ${ON_REQUEST}`;
  return agentBrowserAdvice(env, agent, { host: a.host, ...(a.title ? { title: a.title } : {}), permitted: a.permission === "browser" }, task, book, false, root);
}

/**
 * The refusal an agent whose browser strom does not keep gets at an archive only a person's browser goes to — its web
 * fetch and its browser alike, whatever the person allowed: the person saves the images by hand.
 */
export function withoutBrowserReason(a: ArchiveLevel, name: string, task: string | undefined, book: string, otherWay: string): string {
  return (
    `strom: ${name} lets automated tools in only through a person's browser, and strom does not keep your browser or computer use (no hook of strom's before a page) and does not recommend them: not of your own accord for it, nor your web fetch. ${ON_REQUEST} ` +
    `The person saves what is needed by hand: strom task wait ${task ?? "T…"} --images ${book}:<numbers> --on "<the book, its link, which images — impersonal, in the research language>" (strom makes the inbox folder they go into; saved there, they bring the task back by themselves). ` +
    `${browserHelps(a) ? `${tellClaude} ` : ""}${otherWay}`
  );
}

/**
 * What the person is told beside images of such an archive saved by hand (strom's menu, the bridge's waiting): a
 * catalogue key and its words — nothing where the agent would save them itself now.
 */
export function personBrowserNote(env: Env, agent: string | undefined, a: BrowserArchive, root?: string): { key: "ui.waiting.browser.agent" | "ui.waiting.browser.noext" | "ui.waiting.browser.permission"; params: Record<string, string> } | undefined {
  const s = browserState(env, agent, root);
  if (s.state === "agent-without-browser") return { key: "ui.waiting.browser.agent", params: { agent: agent ?? "" } };
  if (s.state === "no-extension") return { key: "ui.waiting.browser.noext", params: { url: s.url ?? CLAUDE_IN_CHROME_URL } };
  if (!a.permitted) return { key: "ui.waiting.browser.permission", params: { archive: a.title ?? a.host } };
  return undefined;
}
