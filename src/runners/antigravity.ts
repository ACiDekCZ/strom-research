// Antigravity CLI runner (`agy`, Google's agent CLI after Gemini CLI).
// Headless: `agy -p "<run strom brief …>" --output-format stream-json` in the
// tree folder — the agent reads its brief with `strom brief` (how agy takes
// stdin in print mode is not settled); events are {"event": …} lines, the last one the result
// with status, response, turns and usage. Its permissions are rules in the
// user's settings (strom agents install adds `command(strom)` there); under
// ask and auto a headless run gets nothing else (what would ask is refused, or
// stalls — strom's time limit ends it); full skips the permissions.
// Interactive conversations are started by strom chat (agents/launch.ts).

import { runJsonLines } from "./jsonl.ts";
import type { RunOptions, RunResult, Runner } from "./runner.ts";

/** Command-line arguments of a headless run (exported for tests). */
export function antigravityArgs(opts: Pick<RunOptions, "model" | "extraArgs" | "permissions" | "shared" | "timeoutMs" | "kickoff">): string[] {
  return [
    "--print",
    opts.kickoff,
    "--output-format",
    "stream-json",
    ...(opts.permissions === "full" ? ["--dangerously-skip-permissions"] : []),
    ...(opts.shared ? ["--add-dir", opts.shared] : []),
    ...(opts.model ? ["--model", opts.model] : []),
    ...(opts.timeoutMs ? ["--print-timeout", `${Math.round(opts.timeoutMs / 1000)}s`] : []),
    ...(opts.extraArgs ?? []),
  ];
}

export const antigravityRunner: Runner = {
  id: "antigravity",
  command: "agy",
  run(opts: RunOptions): Promise<RunResult> {
    // Its events name no conversation strom could resume: stopped at the time limit, it is just stopped.
    return runJsonLines("agy", antigravityArgs(opts), opts.env, opts, undefined, (msg, heard) => {
      const kind = String(msg.event ?? msg.type ?? "");
      if (kind === "result") {
        const r = (msg.result ?? {}) as { status?: string; response?: string; error?: string; num_turns?: number; duration_seconds?: number; usage?: Record<string, number> };
        if (r.response) heard.text = r.response;
        if (r.status && r.status !== "SUCCESS" && r.status !== "OK") {
          heard.isError = true;
          if (r.error) heard.text = r.error;
        }
        const u = r.usage ?? {};
        const m = heard.metrics;
        if (typeof u.input_tokens === "number") m.inputTokens = u.input_tokens;
        if (typeof u.output_tokens === "number") m.outputTokens = u.output_tokens + (u.thinking_tokens ?? 0);
        if (typeof u.cache_read_tokens === "number") m.cacheReadTokens = u.cache_read_tokens;
        if (typeof r.num_turns === "number") m.turns = r.num_turns;
        if (typeof r.duration_seconds === "number") m.durationMs = r.duration_seconds * 1000;
        return;
      }
      // Other events: a line of progress from whatever names a tool, a command or a text.
      const body = (msg[kind] ?? msg) as Record<string, unknown>;
      const command = body.command ?? (body.input as Record<string, unknown> | undefined)?.command ?? (body.args as Record<string, unknown> | undefined)?.command;
      if (typeof command === "string") opts.onProgress?.(`$ ${command.split("\n")[0]!.slice(0, 140)}`);
      else if (/tool/i.test(kind) && typeof (body.name ?? body.tool) === "string") opts.onProgress?.(String(body.name ?? body.tool));
      else if (/message|text|response/i.test(kind) && typeof (body.text ?? body.content) === "string") {
        const text = String(body.text ?? body.content).trim();
        if (text) opts.onProgress?.(text.split("\n")[0]!.slice(0, 160));
      }
      if (/denied|permission/i.test(kind)) heard.denied.push(`tool: ${JSON.stringify(body).slice(0, 120)}`);
    });
  },
};
