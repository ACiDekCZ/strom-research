// OpenAI Codex CLI runner. Headless: `codex exec --json` in the tree folder
// with the brief on stdin. The user's level decides the sandbox: ask and auto
// work in Codex's sandbox on the tree folder (its .git and the shared folder
// writable too, the network on — strom fetches), where what the sandbox refuses simply fails —
// nothing asks, as with Claude Code's dontAsk; full runs without the sandbox.
// Interactive conversations are started by strom chat (agents/launch.ts).

import path from "node:path";
import { runJsonLines } from "./jsonl.ts";
import type { RunOptions, RunResult, Runner } from "./runner.ts";

/**
 * What Codex's sandbox lets it write besides the tree folder: the tree's .git — its sandbox keeps a .git
 * read-only even inside the folder it works in, and every change strom makes is a commit (found live:
 * `strom session note` failed on .git/index.lock) — and the shared folder (inbox, plugins).
 */
export function codexWritable(root: string, shared: string | undefined): string[] {
  return ["-c", `sandbox_workspace_write.writable_roots=${JSON.stringify([path.join(root, ".git"), ...(shared ? [shared] : [])])}`];
}

/** Command-line arguments of a headless run (exported for tests). */
export function codexArgs(opts: Pick<RunOptions, "model" | "extraArgs" | "permissions" | "shared" | "cwd">): string[] {
  const sandbox =
    opts.permissions === "full"
      ? ["--dangerously-bypass-approvals-and-sandbox"]
      : ["--sandbox", "workspace-write", "-c", "sandbox_workspace_write.network_access=true", ...codexWritable(opts.cwd, opts.shared)];
  return ["exec", "--json", "--skip-git-repo-check", ...sandbox, ...(opts.model ? ["--model", opts.model] : []), ...(opts.extraArgs ?? []), "-"];
}

/**
 * Arguments that resume a headless session with a message on stdin (exported for tests). `exec resume` has no
 * --sandbox or --add-dir: the same sandbox is set through its configuration.
 */
export function codexResumeArgs(id: string, opts: Pick<RunOptions, "model" | "permissions" | "shared" | "cwd">): string[] {
  const sandbox =
    opts.permissions === "full"
      ? ["--dangerously-bypass-approvals-and-sandbox"]
      : ["-c", 'sandbox_mode="workspace-write"', "-c", "sandbox_workspace_write.network_access=true", ...codexWritable(opts.cwd, opts.shared)];
  return ["exec", "resume", "--json", "--skip-git-repo-check", ...sandbox, ...(opts.model ? ["--model", opts.model] : []), id, "-"];
}

export const codexRunner: Runner = {
  id: "codex",
  command: "codex",
  run(opts: RunOptions): Promise<RunResult> {
    const resume = (id: string, message: string) => ({ args: codexResumeArgs(id, opts), input: message });
    return runJsonLines("codex", codexArgs(opts), opts.env, opts, resume, (msg, heard) => {
      if (msg.type === "thread.started" && typeof msg.thread_id === "string") heard.sessionId = msg.thread_id;
      const item = msg.item as { type?: string; text?: string; command?: string; exit_code?: number | null; aggregated_output?: string } | undefined;
      if (msg.type === "item.started" && item?.type === "command_execution" && item.command) opts.onProgress?.(`$ ${item.command.replace(/^\S*sh -lc '(.*)'$/s, "$1").split("\n")[0]!.slice(0, 140)}`);
      if (msg.type === "item.completed" && item?.type === "agent_message" && item.text) {
        heard.text = item.text;
        opts.onProgress?.(item.text.trim().split("\n")[0]!.slice(0, 160));
      }
      // The sandbox refused a command (a write outside the tree, the network off): counted like a denial.
      if (msg.type === "item.completed" && item?.type === "command_execution" && item.exit_code !== 0 && /operation not permitted|sandbox|read-only file system/i.test(item.aggregated_output ?? ""))
        heard.denied.push(`Bash: ${String(item.command ?? "").replace(/^\S*sh -lc '(.*)'$/s, "$1").slice(0, 120)}`);
      if (msg.type === "turn.completed") {
        const u = (msg.usage ?? {}) as Record<string, number>;
        const m = heard.metrics;
        m.inputTokens = (m.inputTokens ?? 0) + (u.input_tokens ?? 0);
        m.outputTokens = (m.outputTokens ?? 0) + (u.output_tokens ?? 0);
        m.cacheReadTokens = (m.cacheReadTokens ?? 0) + (u.cached_input_tokens ?? 0);
        m.turns = (m.turns ?? 0) + 1;
      }
      if (msg.type === "turn.failed" || msg.type === "error") {
        heard.isError = true;
        const e = msg.error as { message?: string } | undefined;
        heard.text = String(e?.message ?? msg.message ?? heard.text);
      }
    });
  },
};
