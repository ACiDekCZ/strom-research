// Claude Code runner. Headless: `claude -p --output-format stream-json
// --permission-mode dontAsk --settings <tree>/.claude/settings.json` in the
// tree folder, with the brief on stdin: the tree's permissions decide what is
// allowed and anything else is denied without asking. The settings are passed
// explicitly because Claude Code ignores the allow rules of a project's own
// settings until the user has trusted the folder in an interactive session
// (found in the first live run: every strom call was refused).
// Interactive: `claude "<kickoff>"` with the terminal, in the mode of the user's
// level (agent.permissions): ask — Claude Code's own mode, it asks about what the
// permissions do not decide; auto — its own review decides and asks only when
// it is risky; full — --permission-mode bypassPermissions (only the deny rules
// count), headless or not. Browser tools
// are on only when a connector fetches through the browser (--chrome), and off
// otherwise (--no-chrome), whatever Claude Code's own default is.

import { appendLog, looksLikeLimit, spawnAgent, stopTree, type RunOptions, type RunResult, type Runner } from "./runner.ts";
import type { SessionMetrics } from "../core/model.ts";

function describeTool(block: { name?: string; input?: Record<string, unknown> }): string {
  const input = block.input ?? {};
  if (block.name === "Bash" && typeof input.command === "string") return `$ ${input.command.split("\n")[0]!.slice(0, 140)}`;
  if (typeof input.file_path === "string") return `${block.name} ${input.file_path}`;
  if (typeof input.url === "string") return `${block.name} ${input.url}`;
  if (typeof input.query === "string") return `${block.name} "${input.query}"`;
  return String(block.name ?? "tool");
}

/** Command-line arguments for a run (exported for tests). */
export function claudeArgs(opts: Pick<RunOptions, "interactive" | "kickoff" | "name" | "model" | "extraArgs" | "settingsFile" | "chrome" | "permissions">): string[] {
  const level = opts.permissions ?? "auto";
  const mode = level === "full" ? "bypassPermissions" : !opts.interactive ? "dontAsk" : level === "auto" ? "auto" : undefined;
  const args = opts.interactive ? [opts.kickoff] : ["-p", "--output-format", "stream-json", "--verbose"];
  if (mode) args.push("--permission-mode", mode);
  if (opts.settingsFile) args.push("--settings", opts.settingsFile);
  if (opts.name) args.push("--name", opts.name);
  if (opts.model) args.push("--model", opts.model);
  if (opts.chrome !== undefined) args.push(opts.chrome ? "--chrome" : "--no-chrome");
  args.push(...(opts.extraArgs ?? []));
  return args;
}

/**
 * The environment of a headless run. `claude -p` ends when the model ends its
 * turn, and a command it left in the background dies with it (found in a live
 * run: `strom read` sent to the background, a wake-up scheduled, the session
 * over in 32 s and no reader ever read). So nothing goes to the background, no
 * wake-ups, and one command may take as long as the session.
 */
export function headlessEnv(env: RunOptions["env"], timeoutMs: number | undefined): RunOptions["env"] {
  const long = String(Math.max(timeoutMs ?? 0, 30 * 60_000));
  return {
    ...env,
    CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1",
    CLAUDE_CODE_DISABLE_CRON: "1",
    BASH_DEFAULT_TIMEOUT_MS: long,
    BASH_MAX_TIMEOUT_MS: long,
  };
}

export const claudeRunner: Runner = {
  id: "claude",
  command: "claude",
  run(opts: RunOptions): Promise<RunResult> {
    return new Promise((resolve) => {
      const child = spawnAgent("claude", claudeArgs(opts), {
        cwd: opts.cwd,
        env: opts.interactive ? opts.env : headlessEnv(opts.env, opts.timeoutMs),
        stdio: opts.interactive ? "inherit" : ["pipe", "pipe", "pipe"],
        windowsHide: !opts.interactive,
      });
      // The brief goes in on stdin: no limit on its length on any platform.
      if (!opts.interactive) child.stdin?.end(opts.prompt);
      let timedOut = false;
      const timer = opts.timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            opts.onProgress?.(`time limit reached (${Math.round(opts.timeoutMs! / 60000)} min) — stopping the agent`);
            stopTree(child);
          }, opts.timeoutMs)
        : undefined;
      opts.signal?.addEventListener("abort", () => stopTree(child), { once: true });
      const metrics: SessionMetrics = {};
      let text = "";
      let buffer = "";
      let isError = false;
      const denied: string[] = [];
      const handle = (line: string) => {
        if (!line.trim()) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(line) as Record<string, unknown>;
        } catch {
          return;
        }
        if (msg.type === "system" && msg.subtype === "init" && typeof msg.model === "string") metrics.model = msg.model;
        if (msg.type === "assistant") {
          const content = ((msg.message as { content?: unknown[] })?.content ?? []) as { type: string; text?: string; name?: string; input?: Record<string, unknown> }[];
          for (const b of content) {
            if (b.type === "tool_use") opts.onProgress?.(describeTool(b));
            else if (b.type === "text" && b.text?.trim()) opts.onProgress?.(b.text.trim().split("\n")[0]!.slice(0, 160));
          }
        }
        if (msg.type === "result") {
          text = String(msg.result ?? "");
          isError = Boolean(msg.is_error);
          const u = (msg.usage ?? {}) as Record<string, number>;
          if (u.input_tokens !== undefined) metrics.inputTokens = u.input_tokens;
          if (u.output_tokens !== undefined) metrics.outputTokens = u.output_tokens;
          if (u.cache_read_input_tokens !== undefined) metrics.cacheReadTokens = u.cache_read_input_tokens;
          if (u.cache_creation_input_tokens !== undefined) metrics.cacheWriteTokens = u.cache_creation_input_tokens;
          if (typeof msg.total_cost_usd === "number") metrics.costUsd = msg.total_cost_usd;
          if (typeof msg.num_turns === "number") metrics.turns = msg.num_turns;
          if (typeof msg.duration_ms === "number") metrics.durationMs = msg.duration_ms;
          for (const d of (msg.permission_denials ?? []) as { tool_name?: string; tool_input?: Record<string, unknown> }[]) {
            const input = d.tool_input ?? {};
            const what = typeof input.command === "string" ? input.command : typeof input.file_path === "string" ? input.file_path : typeof input.url === "string" ? input.url : "";
            denied.push(`${d.tool_name ?? "tool"}${what ? `: ${String(what).split("\n")[0]!.slice(0, 120)}` : ""}`);
          }
          if (denied.length) metrics.denied = denied.length;
        }
      };
      child.stdout?.on("data", (d: Buffer) => {
        const s = d.toString("utf8");
        appendLog(opts.logFile, s);
        buffer += s;
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          handle(buffer.slice(0, nl));
          buffer = buffer.slice(nl + 1);
        }
      });
      let stderr = "";
      child.stderr?.on("data", (d: Buffer) => {
        stderr += d.toString("utf8");
        appendLog(opts.logFile, d.toString("utf8"));
      });
      child.on("error", (err) => {
        if (timer) clearTimeout(timer);
        resolve({ exitCode: 127, outcome: "error", text: String(err.message), metrics });
      });
      child.on("close", (code) => {
        if (timer) clearTimeout(timer);
        if (buffer) handle(buffer);
        const all = `${text}\n${stderr}`;
        const limit = looksLikeLimit(all);
        const outcome: RunResult["outcome"] = opts.signal?.aborted
          ? "stopped"
          : timedOut
          ? "timeout"
          : limit.limit
            ? "limit"
            : /log ?in|authenticat|api key|unauthori[sz]ed/i.test(all) && (code ?? 0) !== 0
              ? "auth"
              : (code ?? 0) !== 0 || isError
                ? "error"
                : "ok";
        resolve({ exitCode: code ?? 1, outcome, text: text || stderr.trim(), metrics, ...(limit.resumeAt ? { resumeAt: limit.resumeAt } : {}), ...(denied.length ? { denied } : {}) });
      });
    });
  },
};
