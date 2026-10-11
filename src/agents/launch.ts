// Starting an agent CLI for a conversation with the user, set up the way the
// user chose once (agent.permissions) — so a person who is not technical never
// has to know an agent's own switches. Each agent names the levels its own way:
//
//   level  Claude Code                 Codex
//   ask    its own mode (it asks)      sandbox on the folder, asks on request
//   auto   --permission-mode auto      sandbox on the folder, own review
//   full   bypassPermissions           no sandbox, no approvals
//
// Antigravity CLI (agy): ask — its own mode; auto — accept-edits; full —
// --dangerously-skip-permissions; `strom` is allowed in its settings (strom agents install).
// OpenCode: ask and auto — the tree's rules (opencode.json), anything else it
// asks (it has no review of its own); full — --auto, everything the rules do not deny.
// Grok Build: always --trust (the tree folder: else it reads neither AGENTS.md nor
// the tree's rules; an isolated installation records no trust — conversationEnv); ask — its own mode; auto — --permission-mode auto (its own
// review); full — --always-approve (only the deny rules count).
//
// Claude Code always gets the tree's allow and deny lists (--settings); Codex
// works in its sandbox on the tree folder with its .git (strom commits) and the
// shared folder writable and the network on (strom fetches).

import { claudeArgs } from "../runners/claude.ts";
import { codexTrust, codexWritable } from "../runners/codex.ts";
import { grokOwnEnv, grokTrust } from "../runners/grok.ts";
import type { Env } from "../core/paths.ts";
import { effortArgs } from "./effort.ts";
import type { AgentPermissions } from "../core/config.ts";

export interface LaunchOptions {
  /** The first message, as if the user typed it. */
  kickoff: string;
  level: AgentPermissions;
  model?: string | undefined;
  /** The reasoning effort the person chose (model.effort): the agent's own switch. */
  effort?: string | undefined;
  /** The tree's Claude Code settings (allow and deny lists). */
  settingsFile: string;
  /** The tree folder the agent works in. */
  root: string;
  /** Shared folder (inbox, plugins) the agent works in besides the tree. */
  shared?: string | undefined;
  /** Browser tools (Claude in Chrome) for connectors that fetch through the browser. */
  chrome?: boolean;
  /** The conversation's name in the agent's list of sessions (Claude Code: --name). */
  name?: string | undefined;
  /** Claude Code's Remote Control (agent.remote). */
  remote?: boolean;
  /** strom's environment: an isolated installation records nothing in the agents' own files (codexTrust, grokTrust). */
  env?: Env;
}

/**
 * What a conversation's agent gets in its environment besides strom's (an isolated installation: Grok's folder trust
 * off, and no skill of another installation's taken in). A conversation keeps the person's add-ons.
 */
export function conversationEnv(agent: string, env: Env): Record<string, string> {
  return agent === "grok" ? grokOwnEnv(env) : {};
}

/** The command line of a conversation with this agent. */
export function conversationArgs(agent: string, o: LaunchOptions): string[] {
  if (agent === "claude")
    return claudeArgs({ interactive: true, kickoff: o.kickoff, permissions: o.level, settingsFile: o.settingsFile, ...(o.name ? { name: o.name } : {}), ...(o.model ? { model: o.model } : {}), ...(o.effort ? { effort: o.effort } : {}), ...(o.chrome !== undefined ? { chrome: o.chrome } : {}), ...(o.remote ? { remote: true } : {}) });
  if (agent === "codex") {
    const args =
      o.level === "full"
        ? ["--dangerously-bypass-approvals-and-sandbox"]
        : [...(o.level === "auto" ? ["--approve-for-me"] : ["--sandbox", "workspace-write", "--ask-for-approval", "on-request"]), "-c", "sandbox_workspace_write.network_access=true", ...codexWritable(o.root, o.shared)];
    return [...args, ...codexTrust(o.env ?? {}, o.root), "--search", ...(o.model ? ["--model", o.model] : []), ...effortArgs("codex", o.effort), o.kickoff];
  }
  if (agent === "antigravity") {
    const mode = o.level === "full" ? ["--dangerously-skip-permissions"] : o.level === "auto" ? ["--mode", "accept-edits"] : [];
    return [...mode, ...(o.shared ? ["--add-dir", o.shared] : []), ...(o.model ? ["--model", o.model] : []), ...effortArgs("antigravity", o.effort), "--prompt-interactive", o.kickoff];
  }
  // (its TUI takes no --model: the model is in the tree's opencode.json)
  if (agent === "opencode") return [...(o.level === "full" ? ["--auto"] : []), "--prompt", o.kickoff];
  if (agent === "grok") return [...grokTrust(o.env ?? {}).args, ...(o.level === "full" ? ["--always-approve"] : o.level === "auto" ? ["--permission-mode", "auto"] : []), ...(o.model ? ["--model", o.model] : []), ...effortArgs("grok", o.effort), o.kickoff];
  throw new Error(`no conversation launcher for agent "${agent}"`);
}
