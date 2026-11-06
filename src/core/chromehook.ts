// The agent's browser (Claude in Chrome) kept like its web fetch (core/web.ts): the tree's Claude Code settings run
// `strom net web --hook` before the browser's navigate and before each tool that acts on a page, and after a navigate
// ran or failed (agents/files.ts). It answers:
//
//   - navigate (an address; one without its scheme is https://, as the browser takes it): the same decision as a web
//     fetch of it, on the route of a person's browser (core/webgate.ts browserGate) — the bridge's address refused; a
//     closed archive, a refusal of strom's client, a path robots.txt keeps automated tools off, images by hand only:
//     refused with the web fetch's words and the way on; an archive only a person's browser goes to opens to it within
//     its level and the person's permission ("through the browser"), at a person's pace (core/terms.ts humanPace, the
//     slower of it and the host's). Recorded in .strom/metrics/fetch.jsonl (via "web", the tool's own name), counted
//     and paced together with the web fetches of the same site and host (the same thresholds of a session, the same
//     question past web.perHost in a conversation, refused in a run nobody watches). back/forward: as a navigate to the
//     tab's last address known; a tab of none: let go, not counted.
//   - a tool on a page (computer, find, read_page, get_page_text, form_input, javascript_tool, read_network_requests,
//     read_console_messages): it names no address — the host is the one of the tab's last navigate let through (kept in
//     .strom/metrics/chrome-tabs.json by the agent's session and the tab). A host strom must leave alone now — its
//     archive forbids automated access, it refused strom's client, it is left alone after a refusal or its limit —
//     refused; a script that names the bridge refused; the rest let go, never counted: strom's own browser plan runs its
//     requests through javascript_tool at times its limiter reserved, counted there once.
//
// What the hook cannot see: a click or a typed address that leads to another page or another site (the tab's host is
// known from navigate alone), and requests a page makes by itself. The rules say it: from page to page of an archive
// through navigate to the address, never by clicking through a series of pages. Codex's browser is kept by the address
// its code names (core/codexhook.ts, once the person confirmed the tree's hooks in Codex). Agents without strom's hooks
// before a browser (OpenCode, Grok, Antigravity's own browser) are held by their rules alone: strom net web --check <url>
// --browser, and never to an archive only a person's browser goes to (core/browserhelp.ts; checked 4 November 2026:
// none of them has a hook before its browser strom could read an address from).
// The hook never stands in the way by itself: anything wrong lets the call go.
//
// The built-in browser of Claude's desktop app (its browser pane: mcp__Claude_Browser__*, mcp__remote-devices__…) is
// kept the same way (seen 6 November 2026, the app 2.1.317 runs the tree's hooks before its tools): navigate,
// preview_start and tabs_create go to an address (tool_input.url) and are answered as navigate; its page tools by the
// host of their tab (tool_input.tabId — a word like "seed", none: the active one). preview_start opens a new tab and says
// its tabId only after it ran: the hook after it keeps the tab under that id, and the tabs its answer lists (its "Tab
// Context": each tab with its address) by their address now. Its tabs are kept apart from Chrome's (their own key: the
// same tabId never stands for both). An address of this computer (localhost, 127.0.0.1) is nothing of an archive's: let
// go uncounted — the bridge refused first, as everywhere.

import fs from "node:fs";
import path from "node:path";
import { APP_BROWSER_NAVIGATE, APP_BROWSER_PAGE_TOOLS, APP_BROWSER_PREFIXES, CHROME_NAVIGATE, CHROME_PAGE_TOOLS, CHROME_TOOL_PREFIX } from "./browser.ts";
import { bridgeMarks, bridgeRefusal, reachesBridge } from "./bridgeguard.ts";
import { readJsonIfExists, writeJson } from "./json.ts";
import { metricsDir, webHost } from "./metrics.ts";
import { clock } from "./net.ts";
import { Settings } from "./config.ts";
import { currentSession } from "./session.ts";
import { findTreeUpwards, Tree } from "./tree.ts";
import { answerWebEvent, type WebAnswer, type WebEvent } from "./web.ts";
import { browserGate } from "./webgate.ts";
import type { Env } from "./paths.ts";

/** One call of a tool of Claude in Chrome (or of the desktop app's built-in browser) as Claude Code's hook gives it. */
export interface ChromeEvent {
  /** The tool's full name (mcp__claude-in-chrome__navigate). */
  tool: string;
  /** Its own name (navigate, computer, …). */
  name: string;
  /** The built-in browser of Claude's desktop app (mcp__Claude_Browser__…), not Claude in Chrome. */
  app?: true;
  /** Codex's browser (its node_repl's code, core/codexhook.ts): one tab per agent session, the agent named codex. */
  codex?: true;
  tab?: string;
  /** After a call of the built-in browser: the tab it ran in or opened (its answer's tabId). */
  opened?: string;
  /** After a call of the built-in browser: the tabs its answer lists, each with its address now. */
  tabs?: { tab: string; url: string }[];
  /** navigate: the address as given (back, forward too). */
  url?: string;
  /** javascript_tool: its script. */
  text?: string;
  agentSession?: string;
  toolUse?: string;
  cwd?: string;
  phase?: "post" | "failed";
  error?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** The agent's hook event on stdin: a call of Claude in Chrome's navigate or a page tool, else undefined. */
export function chromeEvent(text: string): ChromeEvent | undefined {
  let j: Record<string, unknown>;
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    j = v as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const tool = str(j.tool_name);
  if (!tool) return undefined;
  const appPrefix = APP_BROWSER_PREFIXES.find((p) => tool.startsWith(p));
  let name: string;
  if (tool.startsWith(CHROME_TOOL_PREFIX)) {
    name = tool.slice(CHROME_TOOL_PREFIX.length);
    if (tool !== CHROME_NAVIGATE && !(CHROME_PAGE_TOOLS as readonly string[]).includes(name)) return undefined;
  } else if (appPrefix) {
    name = tool.slice(appPrefix.length);
    if (!(APP_BROWSER_NAVIGATE as readonly string[]).includes(name) && !(APP_BROWSER_PAGE_TOOLS as readonly string[]).includes(name)) return undefined;
  } else return undefined;
  const input = (j.tool_input ?? {}) as Record<string, unknown>;
  const ev: ChromeEvent = { tool, name, ...(appPrefix ? { app: true as const } : {}) };
  const tab = appTab(input.tabId);
  // Claude in Chrome's tabs are numbers; the built-in browser's words ("seed")
  if (tab && (appPrefix || /^\d+$/.test(tab))) ev.tab = tab;
  if (isNavigate(ev)) {
    const url = str(input.url);
    if (!url) return undefined;
    ev.url = url;
  }
  if (name === "javascript_tool") {
    const script = typeof input.text === "string" ? input.text : undefined;
    if (script) ev.text = script;
  }
  const event = (str(j.hook_event_name) ?? "").toLowerCase();
  if (event === "posttooluse") ev.phase = "post";
  else if (event === "posttoolusefailure") {
    ev.phase = "failed";
    const error = str(j.error);
    if (error) ev.error = error;
  }
  const sid = str(j.session_id);
  if (sid) ev.agentSession = sid;
  const use = str(j.tool_use_id);
  if (use) ev.toolUse = use;
  const cwd = str(j.cwd);
  if (cwd) ev.cwd = cwd;
  // after a call of the built-in browser: the tab it opened or ran in, and the tabs it lists with their addresses
  if (appPrefix && ev.phase === "post") {
    const said = responseText(j.tool_response);
    const opened = /"tabId"\s*:\s*(?:"([^"\\]{1,80})"|(\d{1,15}))/u.exec(said) ?? /Executed on tabId:\s*([^\s,;]{1,80})/u.exec(said);
    const id = appTab(opened?.[1] ?? opened?.[2]);
    if (id) ev.opened = id;
    const tabs: { tab: string; url: string }[] = [];
    for (const m of said.matchAll(/^[ \t]*[•*-][ \t]*tabId[ \t]+([^\s:]{1,80}):.*\("([^"\s]+)"\)[ \t]*$/gmu)) {
      const t = appTab(m[1]);
      if (t) tabs.push({ tab: t, url: m[2]! });
    }
    if (tabs.length) ev.tabs = tabs;
  }
  return ev;
}

/** A call that goes to an address: Claude in Chrome's navigate; the built-in browser's navigate, preview_start, tabs_create. */
export function isNavigate(ev: Pick<ChromeEvent, "name" | "app">): boolean {
  return ev.name === "navigate" || (!!ev.app && (APP_BROWSER_NAVIGATE as readonly string[]).includes(ev.name));
}

/** A tab's id as a tool gives it: a number, or a word of the built-in browser's ("seed"); else nothing. */
function appTab(v: unknown): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return /^[\p{L}\p{N}_.:-]{1,80}$/u.test(t) ? t : undefined;
}

/** The text of a tool's answer as the hook after it gives it (a list of text parts, a string, an object of them). */
function responseText(r: unknown, depth = 0): string {
  if (depth > 3 || r === undefined || r === null) return "";
  if (typeof r === "string") return r;
  if (Array.isArray(r)) return r.map((x) => responseText(x, depth + 1)).join("\n");
  if (typeof r === "object") {
    const o = r as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (o.content !== undefined) return responseText(o.content, depth + 1);
    try {
      return JSON.stringify(o);
    } catch {
      return "";
    }
  }
  return "";
}

/** An address of this computer: nothing of an archive's (the bridge is refused before this). */
function loopbackHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  return h === "localhost" || h.endsWith(".localhost") || /^127\./.test(h) || h === "::1" || h === "0.0.0.0" || /^::ffff:127\./.test(h);
}

/** The browser's tabs as the hook last let them go: the agent's session and tab → the address and its host. */
interface TabNote {
  url: string;
  host: string;
  at: number;
}

export const CHROME_TABS = "chrome-tabs.json";
/** A tab's address is forgotten after this (a day): the agent's session is long over. */
const TAB_KEEP_MS = 24 * 3600_000;
/** At most this many tabs kept (the newest). */
const TABS_MAX = 200;

/** A tab's key: the agent's session and the tab — the built-in browser's apart from Chrome's (the same id never both). */
const tabKey = (ev: ChromeEvent, tab = ev.tab) => `${ev.agentSession ?? "-"}#${ev.app ? "app:" : ev.codex ? "codex:" : ""}${tab ?? "?"}`;

function readTabs(root: string): Record<string, TabNote> {
  try {
    const v = readJsonIfExists<Record<string, TabNote>>(path.join(metricsDir(root), CHROME_TABS));
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** The tab's last address let through (a navigate without a tab: the one the browser took for it). */
export function tabOf(root: string, ev: ChromeEvent): TabNote | undefined {
  const tabs = readTabs(root);
  const n = tabs[tabKey(ev)] ?? (ev.tab ? tabs[tabKey(ev, "?")] : undefined);
  return n && typeof n.url === "string" && typeof n.host === "string" ? n : undefined;
}

/** Keep the tab's address (written whole, atomically; old tabs forgotten). */
function keepTab(root: string, ev: ChromeEvent, url: string, host: string, now: number): void {
  keepTabs(root, ev, [{ url, host }], now);
}

/**
 * Keep the addresses of tabs (each its own tab, else the event's): one of no host strom keeps (this computer's, a page of
 * the browser itself) forgets what the tab showed before — its page tools go by nothing known against them.
 */
function keepTabs(root: string, ev: ChromeEvent, notes: { tab?: string; url: string; host?: string }[], now: number): void {
  if (!fs.existsSync(path.join(root, ".strom"))) return;
  const tabs = readTabs(root);
  for (const n of notes) {
    const key = tabKey(ev, n.tab ?? ev.tab);
    if (n.host) tabs[key] = { url: n.url, host: n.host, at: now };
    else delete tabs[key];
  }
  const kept = Object.entries(tabs)
    .filter(([, n]) => typeof n?.at === "number" && now - n.at < TAB_KEEP_MS)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, TABS_MAX);
  writeJson(path.join(metricsDir(root), CHROME_TABS), Object.fromEntries(kept));
}

/** The address the browser goes to: one without its scheme is https://, as Claude in Chrome takes it. */
export function navigateUrl(given: string): string {
  return /^[\p{L}][\p{L}\p{N}+.-]*:/u.test(given) && !/^[^/:]+:\d+(?:[/?#]|$)/u.test(given) ? given : `https://${given}`;
}

/** The host a tab's address keeps (core/net.ts: no port), else nothing: a page of the browser itself, a file, this computer. */
function keptHost(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || !u.hostname || loopbackHost(u.hostname)) return undefined;
    return webHost(url) ? u.hostname.toLowerCase().replace(/\.$/, "") : undefined;
  } catch {
    return undefined;
  }
}

/**
 * After a call of the built-in browser: the tab it opened (preview_start says its tabId only now) at the address it went
 * to, and every tab its answer lists at its address now (a click that led elsewhere too).
 */
function noteAppTabs(root: string, ev: ChromeEvent, now: number): void {
  const notes: { tab: string; url: string; host?: string }[] = [];
  if (ev.opened && isNavigate(ev) && ev.url && !/^(back|forward)$/i.test(ev.url)) {
    const url = navigateUrl(ev.url);
    notes.push({ tab: ev.opened, url, ...(keptHost(url) ? { host: keptHost(url)! } : {}) });
  }
  for (const t of ev.tabs ?? []) notes.push({ tab: t.tab, url: t.url, ...(keptHost(t.url) ? { host: keptHost(t.url)! } : {}) });
  if (notes.length) keepTabs(root, ev, notes, now);
}

/**
 * The hook's work for one call of Claude in Chrome (or of the desktop app's built-in browser): navigate as a web fetch on
 * the browser's route, a page tool kept off a host strom must leave alone. Throws on anything unexpected (the command
 * lets the call go then).
 */
export async function answerChromeEvent(ev: ChromeEvent, o: { env: Env; cwd: string; now?: () => number; sleep?: (ms: number) => Promise<void> }): Promise<WebAnswer> {
  const root = findTreeUpwards(ev.cwd && path.isAbsolute(ev.cwd) ? ev.cwd : o.cwd);
  if (!root) return {};
  const now = o.now ?? Date.now;
  if (ev.app && ev.phase === "post") {
    try {
      noteAppTabs(root, ev, now());
    } catch {
      // the tabs not kept: their page tools go by nothing known against them
    }
  }
  if (isNavigate(ev)) {
    const given = ev.url!;
    let url: string;
    if (/^(back|forward)$/i.test(given)) {
      // back and forward: the tab's last address known stands for it; a tab of none goes uncounted
      const known = tabOf(root, ev);
      if (!known) return {};
      url = known.url;
    } else url = navigateUrl(given);
    // the bridge is the person's: whatever the scheme (a file of its notes too)
    const marks = bridgeMarks(root);
    if (!ev.phase) {
      const why = reachesBridge(url, marks);
      if (why) return { decision: "deny", reason: bridgeRefusal(why) };
    }
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return {};
    }
    // a page of this computer's browser itself (chrome://, about:) or a file: nothing of an archive's
    if (!/^https?:$/.test(u.protocol) || !u.hostname) return {};
    // the built-in browser at a page of this computer (a preview of the agent's own): nothing of an archive's
    if (ev.app && loopbackHost(u.hostname)) return {};
    const host = webHost(url);
    if (!host) return {};
    const web: WebEvent = {
      agent: ev.codex ? "codex" : "claude",
      tool: ev.tool,
      via: "web",
      url,
      host,
      netHost: u.hostname.toLowerCase().replace(/\.$/, ""),
      browser: true,
      ...(ev.agentSession ? { agentSession: ev.agentSession } : {}),
      ...(ev.toolUse ? { toolUse: ev.toolUse } : {}),
      ...(ev.cwd ? { cwd: ev.cwd } : {}),
      ...(ev.phase ? { phase: ev.phase } : {}),
      ...(ev.error ? { error: ev.error } : {}),
    };
    const answer = await answerWebEvent(web, { env: o.env, cwd: o.cwd, ...(o.now ? { now: o.now } : {}), ...(o.sleep ? { sleep: o.sleep } : {}) });
    // the tab's host from now: a navigate let go (or asked — the person's yes takes it there); back/forward keep it
    if (!ev.phase && answer.decision !== "deny" && !/^(back|forward)$/i.test(given)) {
      try {
        keepTab(root, ev, url, web.netHost!, now());
      } catch {
        // the tab not kept: its page tools go by nothing known against them
      }
    }
    return answer;
  }
  if (ev.phase) return {};
  // a script that names the bridge (its address, its secret, its notes)
  if (ev.text) {
    const why = reachesBridge(ev.text, bridgeMarks(root));
    if (why) return { decision: "deny", reason: bridgeRefusal(why) };
  }
  const tab = tabOf(root, ev);
  if (!tab) return {};
  const tree = Tree.open(root, o.env);
  const settings = new Settings(o.env, {});
  const session = currentSession(tree, o.env);
  const g = browserGate({ env: o.env, tree, url: tab.url, shared: settings.shared()?.value, agent: ev.codex ? "codex" : "claude", ...(session?.task ? { task: session.task } : {}), now: now() });
  if (!g.allow && (g.why === "refused" || g.why === "forbidden")) return { decision: "deny", reason: g.reason ?? `strom: ${tab.host} — not through the browser.` };
  if (g.blocked)
    return {
      decision: "deny",
      reason: `strom: ${g.host} is left alone until ${clock(g.blocked.until)}${g.blocked.reason ? ` — ${g.blocked.reason}` : ""}; nothing goes to it before then, through the browser either — its page in this tab neither. Go on with other work.`,
    };
  return {};
}
