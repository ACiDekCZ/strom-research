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
//
// Claude Code always gets the tree's allow and deny lists (--settings); Codex
// works in its sandbox on the tree folder with the shared folder added and the
// network on (strom fetches).

import { claudeArgs } from "../runners/claude.ts";
import type { AgentPermissions } from "../core/config.ts";

export interface LaunchOptions {
  /** The first message, as if the user typed it. */
  kickoff: string;
  level: AgentPermissions;
  model?: string | undefined;
  /** The tree's Claude Code settings (allow and deny lists). */
  settingsFile: string;
  /** Shared folder (inbox, plugins) the agent works in besides the tree. */
  shared?: string | undefined;
  /** Browser tools (Claude in Chrome) for connectors that fetch through the browser. */
  chrome?: boolean;
  /** The conversation's name in the agent's list of sessions (Claude Code: --name). */
  name?: string | undefined;
}

/** The command line of a conversation with this agent. */
export function conversationArgs(agent: string, o: LaunchOptions): string[] {
  if (agent === "claude")
    return claudeArgs({ interactive: true, kickoff: o.kickoff, permissions: o.level, settingsFile: o.settingsFile, ...(o.name ? { name: o.name } : {}), ...(o.model ? { model: o.model } : {}), ...(o.chrome !== undefined ? { chrome: o.chrome } : {}) });
  if (agent === "codex") {
    const args =
      o.level === "full"
        ? ["--dangerously-bypass-approvals-and-sandbox"]
        : [...(o.level === "auto" ? ["--approve-for-me"] : ["--sandbox", "workspace-write", "--ask-for-approval", "on-request"]), "-c", "sandbox_workspace_write.network_access=true", ...(o.shared ? ["--add-dir", o.shared] : [])];
    return [...args, "--search", ...(o.model ? ["--model", o.model] : []), o.kickoff];
  }
  if (agent === "antigravity") {
    const mode = o.level === "full" ? ["--dangerously-skip-permissions"] : o.level === "auto" ? ["--mode", "accept-edits"] : [];
    return [...mode, ...(o.shared ? ["--add-dir", o.shared] : []), ...(o.model ? ["--model", o.model] : []), "--prompt-interactive", o.kickoff];
  }
  if (agent === "opencode") return [...(o.level === "full" ? ["--auto"] : []), ...(o.model ? ["--model", o.model] : []), "--prompt", o.kickoff];
  throw new Error(`no conversation launcher for agent "${agent}"`);
}
