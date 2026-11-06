// Codex's browser kept like Claude in Chrome (core/chromehook.ts), as far as an address can be seen. Codex drives its
// browser (the in-app browser of the ChatGPT app, its Chrome extension) through one tool, its Node REPL's `js`
// (mcp__node_repl__js): JavaScript code, not an address. The tree's .codex/hooks.json runs `strom net web --hook` before
// each call of it (Codex runs a project's hooks once the person trusted the folder and confirmed the hooks in /hooks —
// the person's step, never strom's: no trusted_hash written or passed, no --dangerously-bypass-hook-trust). It answers:
//
//   - an address in the code or its title (a literal http(s) address: tab.goto("…"), browser.tabs.content({ urls }),
//     agent.browsers.getForUrl("…")): the same decision as Claude in Chrome's navigate to it — the bridge refused; an
//     archive only a person's browser goes to opens within its level and the person's permission "through the browser",
//     at a person's pace; recorded in .strom/metrics/fetch.jsonl (agent codex, tool mcp__node_repl__js), counted and
//     paced with the web fetches of the same site. Two addresses of archives in one call: refused (one page at a time).
//   - code that works on a page or goes somewhere without an address strom can read (a click, back, an address made up
//     from parts or kept from an earlier call): the host of the session's last address let through stands for it, as a
//     tab's for Claude in Chrome's page tools (a host strom must leave alone refused); none known: nothing refused, the
//     call written down as unwatched (.strom/metrics/unwatched.jsonl, counted in strom net web), and the agent told once
//     in its session to name the address in tab.goto("…").
//   - computer use (the code drives other apps, `sky.…`, without the browser): nothing — strom neither watches nor
//     records it (Milan's decision, 6 November 2026).
//
// Codex cannot ask the person from a hook ("ask" is not taken): a question strom would ask is a refusal here. Codex's web
// search is a hosted tool no hook sees (counted from its stream, runners/codex.ts). The hook never stands in the way by
// itself: anything wrong lets the call go.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { codexConfigFile } from "../agents/effort.ts";
import { answerChromeEvent, type ChromeEvent } from "./chromehook.ts";
import { bridgeMarks, bridgeRefusal, reachesBridge } from "./bridgeguard.ts";
import { appendMetric, metricsDir, metricsOn, webHost } from "./metrics.ts";
import { currentSession } from "./session.ts";
import { findTreeUpwards, Tree } from "./tree.ts";
import { treeHookCommand, WEB_HOOK_TIMEOUT_S, type WebAnswer } from "./web.ts";
import { browserGate } from "./webgate.ts";
import { Settings } from "./config.ts";
import type { Env } from "./paths.ts";

/** Codex's tool that drives its browser (and its computer use): the Node REPL's `js`. */
export const CODEX_BROWSER_TOOL = "mcp__node_repl__js";
/** The hook's matcher (Codex's matchers are regular expressions). Computer use's own REPL (cua_repl) is left out. */
export const CODEX_HOOK_MATCHER = "^mcp__node_repl__js$";
/** The tree's hook file for Codex. */
export const CODEX_HOOKS = path.join(".codex", "hooks.json");
/** The unwatched calls of an agent's browser: no address strom could read. */
export const UNWATCHED = "unwatched.jsonl";

/** One call of Codex's node_repl `js` as its hook gives it. */
export interface CodexEvent {
  tool: string;
  /** The code and its title, as given. */
  code: string;
  title?: string;
  agentSession?: string;
  toolUse?: string;
  cwd?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** The agent's hook event on stdin: Codex's node_repl `js` before it runs, else undefined. */
export function codexEvent(text: string): CodexEvent | undefined {
  let j: Record<string, unknown>;
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    j = v as Record<string, unknown>;
  } catch {
    return undefined;
  }
  if (str(j.tool_name) !== CODEX_BROWSER_TOOL) return undefined;
  const event = (str(j.hook_event_name) ?? "PreToolUse").toLowerCase();
  if (event !== "pretooluse") return undefined;
  const input = (j.tool_input ?? {}) as Record<string, unknown>;
  const code = typeof input.code === "string" ? input.code : undefined;
  if (!code) return undefined;
  const ev: CodexEvent = { tool: CODEX_BROWSER_TOOL, code };
  const title = str(input.title);
  if (title) ev.title = title;
  const sid = str(j.session_id);
  if (sid) ev.agentSession = sid;
  const use = str(j.tool_use_id);
  if (use) ev.toolUse = use;
  const cwd = str(j.cwd);
  if (cwd) ev.cwd = cwd;
  return ev;
}

/** The literal http(s) addresses in a text, each once, in order (never `\b` or `[a-z]`: any script). */
export function codeUrls(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.normalize("NFC").matchAll(/(?<![\p{L}\p{M}\p{N}])https?:\/\/[^\s'"`<>()[\]{}\\]+/giu)) {
    const url = m[0].replace(/[.,;:!?]+$/u, "");
    try {
      new URL(url);
    } catch {
      continue;
    }
    seen.add(url);
  }
  return [...seen];
}

/** Code that goes somewhere or works on a page of the browser. */
const BROWSER_WORK =
  /\.\s*(?:goto|getForUrl|expectNavigation|reload|back|forward|playwright|dom_cua|cua|screenshot|domSnapshot|content|click|fill|evaluate|locator)\s*[.(]|(?<![\p{L}\p{N}_$])(?:browser|browsers|tab|tabs|page)\s*\.|location\s*\.\s*(?:href|assign|replace)|window\s*\.\s*open\s*\(/u;
/** Computer use: the code drives other apps (`sky.click`, `sky.type_text`…). */
const COMPUTER_USE = /(?<![\p{L}\p{N}_$])sky\s*\./u;

export function browserWork(code: string): boolean {
  return BROWSER_WORK.test(code);
}

export function computerUseOnly(code: string): boolean {
  // its own calls (sky.click(…)) left out before the browser's are looked for
  return COMPUTER_USE.test(code) && !BROWSER_WORK.test(code.replace(/(?<![\p{L}\p{N}_$])sky\s*\.\s*[\p{L}\p{N}_$]+/gu, ""));
}

/** An address of this computer: nothing of an archive's. */
function loopback(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return h === "localhost" || h.endsWith(".localhost") || /^127\./.test(h) || h === "::1" || h === "0.0.0.0";
  } catch {
    return true;
  }
}

const UNWATCHED_HINT =
  "strom: this browser code names no address strom can see, so strom cannot keep the archives' rules for it (recorded as unwatched). Open each page of an archive by its address written out in the call itself — tab.goto(\"https://…\") — one page at a time; never click through a series of an archive's pages.";

/**
 * The hook's work for one call of Codex's node_repl `js` (see the top). Throws on anything unexpected (the command lets
 * the call go then).
 */
export async function answerCodexEvent(ev: CodexEvent, o: { env: Env; cwd: string; now?: () => number; sleep?: (ms: number) => Promise<void> }): Promise<WebAnswer> {
  const root = findTreeUpwards(ev.cwd && path.isAbsolute(ev.cwd) ? ev.cwd : o.cwd);
  if (!root) return {};
  const text = ev.title ? `${ev.code}\n${ev.title}` : ev.code;
  // computer use: neither watched nor recorded
  if (computerUseOnly(ev.code)) return {};
  // the bridge is the person's: its address, its secret, its notes — whatever the code does with them
  const why = reachesBridge(text, bridgeMarks(root));
  if (why) return { decision: "deny", reason: bridgeRefusal(why) };
  const base = { tool: ev.tool, codex: true as const, ...(ev.agentSession ? { agentSession: ev.agentSession } : {}), ...(ev.cwd ? { cwd: ev.cwd } : {}) };
  const opts = { env: o.env, cwd: o.cwd, ...(o.now ? { now: o.now } : {}), ...(o.sleep ? { sleep: o.sleep } : {}) };
  const urls = codeUrls(text).filter((u) => webHost(u) && !loopback(u));
  if (urls.length) {
    // several pages of archives at once (browser.tabs.content({ urls }) opens them all together): one at a time
    if (urls.length > 1) {
      const tree = Tree.open(root, o.env);
      const shared = new Settings(o.env, {}).shared()?.value;
      const archives = urls.filter((url) => browserGate({ env: o.env, tree, url, shared, agent: "codex" }).level);
      if (archives.length > 1)
        return {
          decision: "deny",
          reason: `strom: ${archives.length} pages of archives in one call — one page at a time: tab.goto("<one address>"), the next in a call of its own (an archive's pace). ${[...new Set(archives.map((u) => new URL(u).hostname))].join(", ")}`,
        };
    }
    for (const [i, url] of urls.entries()) {
      const chrome: ChromeEvent = { ...base, name: "navigate", url, ...(ev.toolUse ? { toolUse: i ? `${ev.toolUse}#${i}` : ev.toolUse } : {}) };
      const a = await answerChromeEvent(chrome, opts);
      // Codex takes no question from a hook: what strom would ask the person is refused here
      if (a.decision === "ask")
        return {
          decision: "deny",
          reason: `strom: past the requests to ${new URL(url).hostname} a session may make through your web tools — Codex cannot put strom's question to the person, so nothing more goes to it in this session through the browser. The rest through strom fetch with the site's connector (strom connector new <site> --url https://<host>/).`,
        };
      if (a.decision === "deny") return a;
    }
    return {};
  }
  if (!browserWork(ev.code)) return {};
  // a page of the session's last address let through: kept off a host strom must leave alone, as a tab's page tools
  const page: ChromeEvent = { ...base, name: "javascript_tool", ...(ev.toolUse ? { toolUse: ev.toolUse } : {}) };
  const a = await answerChromeEvent(page, opts);
  if (a.decision) return a;
  // nothing strom can see an address in: never refused — written down as unwatched, the agent told once in its session
  const tree = Tree.open(root, o.env);
  if (!metricsOn(tree)) return {};
  const first = !ev.agentSession || !unwatchedOf(root, { agentSession: ev.agentSession }).total;
  const session = currentSession(tree, o.env);
  appendMetric(root, UNWATCHED, { agent: "codex", tool: ev.tool, ...(session ? { session: session.id } : {}), ...(ev.agentSession ? { agentSession: ev.agentSession } : {}), ...(ev.toolUse ? { toolUse: ev.toolUse } : {}) });
  return first ? { context: UNWATCHED_HINT, event: "PreToolUse" } : {};
}

/** The unwatched calls of a session (a strom session, or the agent's own id of one). */
export function unwatchedOf(root: string, who: { session?: string; agentSession?: string }): { total: number } {
  let text: string;
  try {
    text = fs.readFileSync(path.join(metricsDir(root), UNWATCHED), "utf8");
  } catch {
    return { total: 0 };
  }
  let total = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as { session?: string; agentSession?: string };
      if ((who.session && r.session === who.session) || (who.agentSession && r.agentSession === who.agentSession)) total++;
    } catch {
      // a broken line: left out
    }
  }
  return { total };
}

/** The tree's hook's command for Codex: the tree's own strom; on Windows Codex runs cmd.exe — the shim whose exit is always 0. */
export function codexHookCommand(root: string, platform: NodeJS.Platform = process.platform): string {
  if (platform === "win32") return `"${path.win32.join(root, ".strom", "bin", "strom-hook.cmd")}" net web --hook`;
  return treeHookCommand(root, "net web --hook", platform).command;
}

/**
 * The tree's .codex/hooks.json: strom's hook before Codex's node_repl `js`. Kept the same byte for byte while nothing of
 * it changes — each change makes Codex ask the person to confirm the hooks again. No statusMessage (it is part of what
 * the person confirms).
 */
export function codexHooks(root: string, platform: NodeJS.Platform = process.platform): Record<string, unknown> {
  return {
    description: "strom: the archives' rules before Codex's browser (strom net web --hook)",
    hooks: { PreToolUse: [{ matcher: CODEX_HOOK_MATCHER, hooks: [{ type: "command", command: codexHookCommand(root, platform), timeout: WEB_HOOK_TIMEOUT_S }] }] },
  };
}

/** A value of JSON with its objects' keys sorted (serde_json's sort_all_objects), compact. */
function sortedJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(sortedJson).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${sortedJson((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}

/**
 * The hash Codex keeps of strom's hook once the person confirmed it (codex-rs hooks/src/engine/discovery.rs hook_hash,
 * config/src/fingerprint.rs version_for_toml): SHA-256 of the normalized declaration — the event, the matcher, the one
 * handler (its command for this system, its timeout, async) — as JSON with sorted keys.
 */
export function codexHookHash(root: string, platform: NodeJS.Platform = process.platform): string {
  const identity = { event_name: "pre_tool_use", matcher: CODEX_HOOK_MATCHER, hooks: [{ type: "command", command: codexHookCommand(root, platform), timeout: WEB_HOOK_TIMEOUT_S, async: false }] };
  return `sha256:${crypto.createHash("sha256").update(sortedJson(identity)).digest("hex")}`;
}

/**
 * What Codex says of strom's hook in this tree (read only, from its settings; Codex never started):
 *   trusted — the person confirmed it as it is; modified — confirmed before, changed since; untrusted — never confirmed;
 *   disabled — the person turned it off; off — Codex's hooks are off ([features] hooks = false);
 *   folder — Codex does not trust the research folder (its project hooks do not run there);
 *   missing — the tree has no hook file of strom's as it is now (strom agents sync writes it).
 */
export type CodexHookState = "trusted" | "modified" | "untrusted" | "disabled" | "off" | "folder" | "missing";

export function codexHookState(root: string, env: Env, platform: NodeJS.Platform = process.platform): CodexHookState {
  let file: string;
  try {
    file = fs.readFileSync(path.join(root, CODEX_HOOKS), "utf8");
  } catch {
    return "missing";
  }
  if (file !== JSON.stringify(codexHooks(root, platform), null, 2) + "\n") return "missing";
  const config = readCodexToml(env);
  if (config.features.get("hooks") === "false" || config.features.get("codex_hooks") === "false") return "off";
  const dirs = [root];
  try {
    const real = fs.realpathSync(root);
    if (real !== root) dirs.push(real);
  } catch {
    // as written
  }
  // a folder Codex was told not to trust: its project layer (the hook file with it) is not read
  if (dirs.some((d) => config.projects.get(d) === "untrusted") || !dirs.some((d) => config.projects.get(d) === "trusted")) return "folder";
  const states = dirs.map((d) => config.hooks.get(`${path.join(d, CODEX_HOOKS)}:pre_tool_use:0:0`)).filter((s) => s !== undefined);
  if (states.some((s) => s!.enabled === "false")) return "disabled";
  const hash = codexHookHash(root, platform);
  if (states.some((s) => s!.trusted === hash)) return "trusted";
  return states.some((s) => s!.trusted) ? "modified" : "untrusted";
}

/** A TOML string or bare value of one line (basic strings unescaped, literal strings as they are). */
function tomlScalar(raw: string): string | undefined {
  const s = raw.trim();
  const basic = /^"((?:[^"\\]|\\.)*)"/u.exec(s);
  if (basic) return JSON.parse(`"${basic[1]!.replace(/\\U([0-9A-Fa-f]{8})/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))}"`) as string;
  const literal = /^'([^']*)'/u.exec(s);
  if (literal) return literal[1];
  return /^([^\s#,}]+)/u.exec(s)?.[1];
}

/** The parts of a dotted TOML key: hooks.state."/a/b:pre_tool_use:0:0" → ["hooks", "state", "/a/b:pre_tool_use:0:0"]. */
function tomlKey(raw: string): string[] | undefined {
  const parts: string[] = [];
  const re = /\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([\p{L}\p{N}_-]+))\s*(\.|$)/uy;
  let m: RegExpExecArray | null;
  while (re.lastIndex < raw.length && (m = re.exec(raw))) {
    parts.push(m[1] !== undefined ? (JSON.parse(`"${m[1]}"`) as string) : (m[2] ?? m[3]!));
    if (!m[4]) break;
  }
  return re.lastIndex >= raw.trimEnd().length ? parts : undefined;
}

/** What strom reads of Codex's config.toml for its hook: [features], [projects."…"], [hooks.state."…"]. */
function readCodexToml(env: Env): { features: Map<string, string>; projects: Map<string, string>; hooks: Map<string, { trusted?: string; enabled?: string }> } {
  const features = new Map<string, string>();
  const projects = new Map<string, string>();
  const hooks = new Map<string, { trusted?: string; enabled?: string }>();
  let text = "";
  try {
    text = fs.readFileSync(codexConfigFile(env), "utf8");
  } catch {
    return { features, projects, hooks };
  }
  const put = (keyPath: string[], value: string) => {
    const [a, b, c, d] = keyPath;
    if (a === "features" && b && keyPath.length === 2) features.set(b, value);
    else if (a === "projects" && b && c === "trust_level" && keyPath.length === 3) projects.set(b, value);
    else if (a === "hooks" && b === "state" && c && (d === "trusted_hash" || d === "enabled") && keyPath.length === 4) {
      const s = hooks.get(c) ?? {};
      if (d === "trusted_hash") s.trusted = value;
      else s.enabled = value;
      hooks.set(c, s);
    }
  };
  let table: string[] = [];
  for (const line of text.split(/\r?\n/u)) {
    const header = /^\s*\[\s*([^[\]]+?)\s*\]\s*(?:#.*)?$/u.exec(line);
    if (header) {
      table = tomlKey(header[1]!) ?? ["?"];
      continue;
    }
    const kv = /^\s*((?:"(?:[^"\\]|\\.)*"|'[^']*'|[\p{L}\p{N}_.\s-])+?)\s*=\s*(.*)$/u.exec(line);
    if (!kv) continue;
    const key = tomlKey(kv[1]!);
    if (!key) continue;
    const value = kv[2]!.trim();
    // an inline table: "<key>" = { trusted_hash = "…", enabled = false }
    if (value.startsWith("{")) {
      for (const m of value.matchAll(/([\p{L}\p{N}_-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*'|[^,}\s]+)/gu)) {
        const v = tomlScalar(m[2]!);
        if (v !== undefined) put([...table, ...key, m[1]!], v);
      }
      continue;
    }
    const v = tomlScalar(value);
    if (v !== undefined) put([...table, ...key], v);
  }
  return { features, projects, hooks };
}
