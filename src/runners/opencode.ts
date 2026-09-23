// OpenCode runner. Headless: `opencode run --format json "<kickoff>"` in the tree
// folder with the brief on stdin (it joins what is piped in with the message).
// The tree's rules are its project config (opencode.json: strom allowed, the
// evidence and git denied); what they would ask about is refused in a run
// nobody watches — under ask and auto that is all; full adds --auto
// (everything the rules do not deny). Events are JSON lines: text, tool_use,
// step_start, step_finish (tokens and cost of a step), error.

import { runJsonLines } from "./jsonl.ts";
import type { RunOptions, RunResult, Runner } from "./runner.ts";

/** Command-line arguments of a headless run (exported for tests). */
export function opencodeArgs(opts: Pick<RunOptions, "model" | "extraArgs" | "permissions" | "kickoff">): string[] {
  return ["run", "--format", "json", ...(opts.permissions === "full" ? ["--auto"] : []), ...(opts.model ? ["--model", opts.model] : []), ...(opts.extraArgs ?? []), opts.kickoff];
}

export const opencodeRunner: Runner = {
  id: "opencode",
  command: "opencode",
  run(opts: RunOptions): Promise<RunResult> {
    const args = opencodeArgs({ ...opts, kickoff: "Your brief is above. Work only through `strom` in this folder, as it says." });
    const tokens = { input: 0, output: 0, cacheRead: 0 };
    return runJsonLines("opencode", args, opts.env, opts, (msg, heard) => {
      const part = (msg.part ?? {}) as Record<string, unknown>;
      if (msg.type === "tool_use") {
        const state = (part.state ?? {}) as { status?: string; input?: Record<string, unknown>; error?: string };
        const input = state.input ?? {};
        const what = typeof input.command === "string" ? `$ ${input.command}` : typeof input.filePath === "string" ? `${String(part.tool)} ${input.filePath}` : String(part.tool ?? "tool");
        opts.onProgress?.(what.split("\n")[0]!.slice(0, 140));
        if (state.status === "error" && /reject|denied|not allowed|permission/i.test(state.error ?? "")) heard.denied.push(`${String(part.tool)}: ${what.slice(0, 120)}`);
      }
      if (msg.type === "text" && typeof part.text === "string" && part.text.trim()) heard.text = part.text;
      if (msg.type === "step_finish") {
        // One step of the conversation; the run's use is their sum.
        const t = (part.tokens ?? {}) as { input?: number; output?: number; reasoning?: number; cache?: { read?: number } };
        tokens.input += t.input ?? 0;
        tokens.output += (t.output ?? 0) + (t.reasoning ?? 0);
        tokens.cacheRead += t.cache?.read ?? 0;
        const m = heard.metrics;
        m.inputTokens = tokens.input;
        m.outputTokens = tokens.output;
        m.cacheReadTokens = tokens.cacheRead;
        m.turns = (m.turns ?? 0) + 1;
      }
      if (msg.type === "error") {
        heard.isError = true;
        const e = (msg.error ?? {}) as { name?: string; data?: { message?: string } };
        heard.text = e.data?.message ?? e.name ?? "error";
      }
    });
  },
};
