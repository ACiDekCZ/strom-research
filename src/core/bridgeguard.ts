// The agent kept off the bridge: the bridge (strom live, core/live.ts) takes what the person writes in the Strom app —
// an answer to a task that waits for them, a scan for it — and the app is the person. An agent of the research must not
// write there in the person's name: the bridge asks for its secret address and a page of the Strom app (Origin), and
// the tree's hooks of the agent refuse what would reach it: a shell command that reads the bridge's notes
// (.strom/live.json, .strom/live-last.json) or names its address (its secret, or this computer's address with its
// port), and a web fetch of it. A fence, not a vault: an agent without hooks (Codex, OpenCode, Antigravity) is kept
// off by its rules and by the bridge's own checks alone.

import path from "node:path";
import { readJsonIfExists } from "./json.ts";
import { findTreeUpwards } from "./tree.ts";
import { treeHookCommand } from "./web.ts";

/** The bridge's notes in .strom (live.ts liveFile, lastFile). */
export const BRIDGE_NOTES = ["live.json", "live-last.json"] as const;

/** The shell tools whose command is looked at: Claude Code's (Bash, PowerShell on Windows), Grok Build's. */
export const SHELL_TOOLS = ["Bash", "PowerShell", "run_terminal_command", "bash", "shell"] as const;

const HOOK_TIMEOUT_S = 10;

/** One call of a shell tool as the agent's hook gives it. */
export interface ShellEvent {
  tool: string;
  command: string;
  cwd?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

/** The agent's hook event on stdin: a shell tool's call (Claude Code's snake_case, Grok's camelCase), else undefined. */
export function shellEvent(text: string): ShellEvent | undefined {
  let j: Record<string, unknown>;
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    j = v as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const tool = str(j.tool_name) ?? str(j.toolName);
  if (!tool || !(SHELL_TOOLS as readonly string[]).includes(tool)) return undefined;
  const input = (j.tool_input ?? j.toolInput ?? {}) as Record<string, unknown>;
  const command = str(input.command) ?? str(input.cmd) ?? str(input.script);
  if (!command) return undefined;
  const cwd = str(j.cwd) ?? str(j.workspaceRoot);
  return { tool, command, ...(cwd ? { cwd } : {}) };
}

/** What the bridge of a tree was and is: its ports and secrets from its notes (none: no bridge ever ran). */
export interface BridgeMarks {
  ports: number[];
  tokens: string[];
}

export function bridgeMarks(root: string): BridgeMarks {
  const ports = new Set<number>();
  const tokens = new Set<string>();
  for (const name of BRIDGE_NOTES) {
    let note: Record<string, unknown> | undefined;
    try {
      note = readJsonIfExists<Record<string, unknown>>(path.join(root, ".strom", name));
    } catch {
      note = undefined;
    }
    if (!note) continue;
    if (typeof note.port === "number" && Number.isInteger(note.port) && note.port > 0) ports.add(note.port);
    if (typeof note.token === "string" && /^[0-9a-f]{16,}$/i.test(note.token)) tokens.add(note.token.toLowerCase());
  }
  return { ports: [...ports], tokens: [...tokens] };
}

/** A shell glob word as a regular expression of a file name (*, ?, […]). */
function globRe(word: string): RegExp | undefined {
  if (!/[*?[]/.test(word)) return undefined;
  let re = "";
  for (let i = 0; i < word.length; i++) {
    const c = word[i]!;
    if (c === "*") re += ".*";
    else if (c === "?") re += ".";
    else if (c === "[") {
      const end = word.indexOf("]", i + 1);
      if (end < 0) return undefined;
      re += `[${word.slice(i + 1, end).replace(/^!/, "^").replace(/\\/g, "\\\\")}]`;
      i = end;
    } else re += c.replace(/[.+^${}()|\\/]/g, "\\$&");
  }
  try {
    return new RegExp(`^${re}$`, "i");
  } catch {
    return undefined;
  }
}

/** The hosts of this computer as an address names them. */
const LOOPBACK = /(?:^|[^\p{L}\p{N}.-])(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[?::1\]?|\[?::ffff:127(?:\.\d{1,3}){3}\]?|0x7f[0-9a-f]{6}|2130706433|127\.1|0177(?:\.\d+){3})(?::|\s+|%3a)(\d{1,5})(?!\d)/giu;

/**
 * Why a text (a shell command, a fetched address) reaches the bridge — its notes, its secret, this computer's address
 * with its port — else undefined.
 */
export function reachesBridge(text: string, marks: BridgeMarks): string | undefined {
  const t = text.normalize("NFC");
  if (/live(?:-last)?\.json/i.test(t)) return "the bridge's notes";
  // a wildcard that would name a note of the bridge in .strom (cat .strom/li*)
  for (const m of t.matchAll(/\.strom[\\/]+([^\s'"`;|&<>()]+)/gu)) {
    const last = m[1]!.split(/[\\/]+/).filter(Boolean);
    const re = last.length === 1 ? globRe(last[0]!) : undefined;
    if (re && BRIDGE_NOTES.some((n) => re.test(n))) return "the bridge's notes";
  }
  const low = t.toLowerCase();
  if (marks.tokens.some((k) => low.includes(k))) return "the bridge's secret address";
  for (const m of t.matchAll(LOOPBACK)) {
    const port = Number(m[1]);
    if (marks.ports.includes(port)) return "the bridge's address";
  }
  return undefined;
}

/** The refusal the agent reads: the bridge is the person's, what the agent does goes through strom. */
export function bridgeRefusal(what: string): string {
  return (
    `strom: this reaches ${what} — the bridge is the Strom app's, what it sends there is the person's own (an answer, a scan). ` +
    "You never read or call the bridge: what you record goes through strom commands; a task that waits for the person " +
    "is woken by the person (strom task wake is theirs)."
  );
}

/** Answer one call of a shell tool: a refusal when it reaches the bridge, else nothing (never fails). */
export function answerShellEvent(ev: ShellEvent, o: { cwd: string }): { decision?: "deny"; reason?: string } {
  const root = findTreeUpwards(ev.cwd && path.isAbsolute(ev.cwd) ? ev.cwd : o.cwd);
  if (!root) return {};
  const why = reachesBridge(ev.command, bridgeMarks(root));
  return why ? { decision: "deny", reason: bridgeRefusal(why) } : {};
}

/** A web fetch's address that reaches the bridge of the tree: why, else undefined. */
export function fetchReachesBridge(url: string, root: string): string | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const marks = bridgeMarks(root);
  const low = url.toLowerCase();
  if (marks.tokens.some((k) => low.includes(k))) return "the bridge's secret address";
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const loop = host === "localhost" || host.endsWith(".localhost") || /^127\./.test(host) || host === "::1" || host === "0.0.0.0" || /^::ffff:127\./.test(host) || /^::ffff:7f/.test(host);
  if (!loop) return undefined;
  const port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
  // this computer's address: the bridge's port, or any while one is not known (a bridge of this tree that ran elsewhere)
  return marks.ports.includes(port) || /live(?:-last)?\.json/i.test(low) ? "the bridge's address" : undefined;
}

/** The hook's answer as Claude Code and Grok read it on stdout; none: nothing at all. */
export function shellHookOutput(a: { decision?: "deny"; reason?: string }): string {
  if (!a.decision) return "";
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: a.decision, permissionDecisionReason: a.reason ?? "" } });
}

/** Claude Code's hook of the tree (its .claude/settings.json) before each shell command. */
export function claudeShellHooks(root: string, platform: NodeJS.Platform = process.platform): { PreToolUse: Record<string, unknown>[] } {
  const { command, shell } = treeHookCommand(root, "agents shell --hook", platform);
  return { PreToolUse: [{ matcher: "Bash|PowerShell", hooks: [{ type: "command", command, timeout: HOOK_TIMEOUT_S, ...(shell ? { shell } : {}) }] }] };
}

/** Grok Build's own hook before each shell command (its .grok/hooks/strom.json, beside the web hooks). */
export function grokShellHook(root: string, platform: NodeJS.Platform = process.platform): Record<string, unknown> {
  const bin = path.join(root, ".strom", "bin");
  const command = platform === "win32" ? `"${path.win32.join(bin, "strom-hook.cmd")}" agents shell --hook` : treeHookCommand(root, "agents shell --hook", platform).command;
  return { matcher: "run_terminal_command|bash|shell", hooks: [{ type: "command", command, timeout: HOOK_TIMEOUT_S }] };
}

/** What an agent is told of the bridge (strom app): its secret taken out wherever it stands — an address, its encoded copy. */
export function withoutSecret<T>(v: T, token: string): T {
  if (!token) return v;
  return JSON.parse(JSON.stringify(v).split(token).join("…")) as T;
}
