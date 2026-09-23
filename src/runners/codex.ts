// OpenAI Codex CLI runner. Headless: `codex exec --json` in the tree folder
// with the brief on stdin. The user's level decides the sandbox: ask and auto
// work in Codex's sandbox on the tree folder (the shared folder added, the
// network on — strom fetches), where what the sandbox refuses simply fails —
// nothing asks, as with Claude Code's dontAsk; full runs without the sandbox.
// Interactive conversations are started by strom chat (agents/launch.ts).

import { runJsonLines } from "./jsonl.ts";
import type { RunOptions, RunResult, Runner } from "./runner.ts";

/** Command-line arguments of a headless run (exported for tests). */
export function codexArgs(opts: Pick<RunOptions, "model" | "extraArgs" | "permissions" | "shared">): string[] {
  const sandbox =
    opts.permissions === "full"
      ? ["--dangerously-bypass-approvals-and-sandbox"]
      : ["--sandbox", "workspace-write", "-c", "sandbox_workspace_write.network_access=true", ...(opts.shared ? ["--add-dir", opts.shared] : [])];
  return ["exec", "--json", "--skip-git-repo-check", ...sandbox, ...(opts.model ? ["--model", opts.model] : []), ...(opts.extraArgs ?? []), "-"];
}

export const codexRunner: Runner = {
  id: "codex",
  command: "codex",
  run(opts: RunOptions): Promise<RunResult> {
    return runJsonLines("codex", codexArgs(opts), opts.env, opts, (msg, heard) => {
      const item = msg.item as { type?: string; text?: string; command?: string; exit_code?: number | null; aggregated_output?: string } | undefined;
      if (msg.type === "item.started" && item?.type === "command_execution" && item.command) opts.onProgress?.(`$ ${item.command.replace(/^\S*sh -lc '(.*)'$/s, "$1").split("\n")[0]!.slice(0, 140)}`);
      if (msg.type === "item.completed" && item?.type === "agent_message" && item.text) {
        heard.text = item.text;
        opts.onProgress?.(item.text.trim().split("\n")[0]!.slice(0, 160));
      }
      // The sandbox refused a command (a write outside the tree, the network off): counted like a denial.
      if (msg.type === "item.completed" && item?.type === "command_execution" && item.exit_code !== 0 && /operation not permitted|sandbox|read-only file system/i.test(item.aggregated_output ?? ""))
        heard.denied.push(`Bash: ${String(item.command ?? "").slice(0, 120)}`);
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
