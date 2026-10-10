// OpenAI Codex CLI runner. Headless: `codex exec --json` in the tree folder
// with the brief on stdin. The user's level decides the sandbox: ask and auto
// work in Codex's sandbox on the tree folder (its .git and the shared folder
// writable too, the network on — strom fetches), where what the sandbox refuses simply fails —
// nothing asks, as with Claude Code's dontAsk; full runs without the sandbox.
// Interactive conversations are started by strom chat (agents/launch.ts).

import fs from "node:fs";
import path from "node:path";
import { runJsonLines, type Heard } from "./jsonl.ts";
import { looksLikeLimit, usageNumber, tellUsage, type RunOptions, type RunResult, type Runner } from "./runner.ts";
import { codexModel, effortArgs } from "../agents/effort.ts";
import { isolated, type Env } from "../core/paths.ts";

/**
 * What Codex's sandbox lets it write besides the tree folder: the tree's .git — its sandbox keeps a .git
 * read-only even inside the folder it works in, and every change strom makes is a commit (found live:
 * `strom session note` failed on .git/index.lock) — and the shared folder (inbox, plugins).
 */
export function codexWritable(root: string, shared: string | undefined): string[] {
  return ["-c", `sandbox_workspace_write.writable_roots=${JSON.stringify([path.join(root, ".git"), ...(shared ? [shared] : [])])}`];
}

/**
 * The folder Codex works in, trusted for this process alone in an isolated installation: a session Codex starts in a
 * folder its config does not trust it records as trusted in ~/.codex/config.toml (`[projects."<folder>"]`, found
 * after headless runs) — once per tree in a regular installation; an isolated one writes nothing of the agents'
 * (core/paths.ts), so the folder comes trusted in Codex's configuration for this run (`-c`, nothing written), as
 * written and as the system resolves it (/tmp → /private/tmp).
 */
export function codexTrust(env: Env, cwd: string): string[] {
  if (!isolated(env)) return [];
  let real = cwd;
  try {
    real = fs.realpathSync(cwd);
  } catch {
    // not there (yet): as written
  }
  const folders = [...new Set([path.resolve(cwd), real])];
  return ["-c", `projects={${folders.map((f) => `${JSON.stringify(f)}={trust_level="trusted"}`).join(",")}}`];
}

/**
 * Working alone without the user's add-ons (agent.addons off): Codex's plugins (and the MCP servers they bring), its
 * apps, the user's hooks and memories off for this run — the user's own config, model and login kept (never
 * --ignore-user-config: it drops the model and effort too). An MCP server of the user's own config stays: Codex has no
 * switch for all of them.
 */
export const CODEX_CLEAN = ["-c", "features.plugins=false", "-c", "features.apps=false", "-c", "features.hooks=false", "-c", "features.memories=false"] as const;

/** Command-line arguments of a headless run (exported for tests). */
export function codexArgs(opts: Pick<RunOptions, "model" | "effort" | "extraArgs" | "permissions" | "shared" | "cwd" | "clean"> & Partial<Pick<RunOptions, "env">>): string[] {
  const sandbox =
    opts.permissions === "full"
      ? ["--dangerously-bypass-approvals-and-sandbox"]
      : ["--sandbox", "workspace-write", "-c", "sandbox_workspace_write.network_access=true", ...codexWritable(opts.cwd, opts.shared)];
  return ["exec", "--json", "--skip-git-repo-check", ...sandbox, ...codexTrust(opts.env ?? {}, opts.cwd), ...(opts.clean ? CODEX_CLEAN : []), ...(opts.model ? ["--model", opts.model] : []), ...effortArgs("codex", opts.effort), ...(opts.extraArgs ?? []), "-"];
}

/**
 * Arguments that resume a headless session with a message on stdin (exported for tests). `exec resume` has no
 * --sandbox or --add-dir: the same sandbox is set through its configuration.
 */
export function codexResumeArgs(id: string, opts: Pick<RunOptions, "model" | "effort" | "permissions" | "shared" | "cwd" | "clean"> & Partial<Pick<RunOptions, "env">>): string[] {
  const sandbox =
    opts.permissions === "full"
      ? ["--dangerously-bypass-approvals-and-sandbox"]
      : ["-c", 'sandbox_mode="workspace-write"', "-c", "sandbox_workspace_write.network_access=true", ...codexWritable(opts.cwd, opts.shared)];
  return ["exec", "resume", "--json", "--skip-git-repo-check", ...sandbox, ...codexTrust(opts.env ?? {}, opts.cwd), ...(opts.clean ? CODEX_CLEAN : []), ...(opts.model ? ["--model", opts.model] : []), ...effortArgs("codex", opts.effort), id, "-"];
}

/**
 * The agent's steps as Codex reports its items: each message and each tool it called. `exec` runs a whole session as
 * one turn, so its turns say nothing of the work — its steps are counted as the session's turns (none said: unknown).
 */
const STEPS = new Set(["agent_message", "command_execution", "file_change", "mcp_tool_call", "web_search", "collab_tool_call"]);

/** The error Codex said last, kept when an earlier one said the plan's limit (the later one may only say the turn failed). */
function failure(said: string, had: string): string {
  return looksLikeLimit(had).limit && !looksLikeLimit(said).limit ? had : said || had;
}

export const codexRunner: Runner = {
  id: "codex",
  command: "codex",
  run(opts: RunOptions): Promise<RunResult> {
    const resume = (id: string, message: string) => ({ args: codexResumeArgs(id, opts), input: message });
    // the model it runs on as strom knows it (Codex says none): started with, else its config.toml's
    const model = codexModel(opts.env, opts.model, opts.extraArgs);
    // the steps since the use was said last (each sample carries its own)
    let steps = 0;
    // A turn's use: Codex says it at the turn's end (turn.completed; a failed turn only if it carries one — 0.155 does not).
    const used = (u: Record<string, number>, heard: Heard) => {
      const m = heard.metrics;
      m.inputTokens = (m.inputTokens ?? 0) + (u.input_tokens ?? 0);
      m.outputTokens = (m.outputTokens ?? 0) + (u.output_tokens ?? 0);
      m.cacheReadTokens = (m.cacheReadTokens ?? 0) + (u.cached_input_tokens ?? 0);
      // a turn's use as a whole — exec runs the session as one turn of many requests, so its input is the sum of theirs,
      // never a context: no ctx (a resumed turn's smaller sum would read as the context cleared); no cost said
      tellUsage(opts, { total: true, in: usageNumber(u.input_tokens), cr: usageNumber(u.cached_input_tokens), out: usageNumber(u.output_tokens), turns: steps || undefined });
      steps = 0;
    };
    return runJsonLines("codex", codexArgs(opts), opts.env, opts, resume, (msg, heard) => {
      if (msg.type === "thread.started" && typeof msg.thread_id === "string") {
        heard.sessionId = msg.thread_id;
        // its stream names no model: the one strom knows it runs on is the session's (the measure of the reading goes by it)
        if (model) heard.metrics.model = model;
        tellUsage(opts, { agentSession: msg.thread_id, ...(model ? { model } : {}) });
      }
      const item = msg.item as { type?: string; text?: string; command?: string; exit_code?: number | null; aggregated_output?: string } | undefined;
      if (msg.type === "item.started" && item?.type === "command_execution" && item.command) opts.onProgress?.(`$ ${item.command.replace(/^\S*sh -lc '(.*)'$/s, "$1").split("\n")[0]!.slice(0, 140)}`);
      if (msg.type === "item.completed" && item?.type === "agent_message" && item.text) {
        heard.text = item.text;
        opts.onProgress?.(item.text.trim().split("\n")[0]!.slice(0, 160));
      }
      // The sandbox refused a command (a write outside the tree, the network off): counted like a denial.
      if (msg.type === "item.completed" && item?.type === "command_execution" && item.exit_code !== 0 && /operation not permitted|sandbox|read-only file system/i.test(item.aggregated_output ?? ""))
        heard.denied.push(`Bash: ${String(item.command ?? "").replace(/^\S*sh -lc '(.*)'$/s, "$1").slice(0, 120)}`);
      if (msg.type === "item.completed" && item?.type && STEPS.has(item.type)) {
        steps++;
        heard.metrics.turns = (heard.metrics.turns ?? 0) + 1;
      }
      if (msg.type === "turn.completed") used((msg.usage ?? {}) as Record<string, number>, heard);
      if (msg.type === "turn.failed" && msg.usage && typeof msg.usage === "object") used(msg.usage as Record<string, number>, heard);
      else if (msg.type === "turn.failed") {
        // the failed turn's use is not said (a plan's limit, an error of the service): more was used than is known
        heard.metrics.costPartial = true;
        tellUsage(opts, { turns: steps || undefined, partial: true });
        steps = 0;
      }
      if (msg.type === "turn.failed" || msg.type === "error") {
        heard.isError = true;
        const e = msg.error as { message?: string } | undefined;
        heard.text = failure(String(e?.message ?? msg.message ?? ""), heard.text);
      }
    });
  },
};
