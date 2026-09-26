// Grok Build runner (xAI's `grok`). Headless: `grok --trust --prompt-file <brief>
// --output-format streaming-json` in the tree folder — it reads no stdin, so the
// brief goes in a file beside the run's log. --trust: the tree folder's own files
// (AGENTS.md, .grok/config.toml with the tree's rules) load only in a trusted
// folder. The level: ask and auto — --permission-mode dontAsk (what the rules do
// not allow is refused; Grok still lets harmless commands of its own judgement
// through, so the deny rules are what holds); full — --always-approve (only the
// deny rules count). strom names the session (-s <uuid>) and resumes it by that
// id at the time limit (-r). Events are JSON lines: text, tool_call,
// tool_call_update, end (usage, cost) and error.

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runJsonLines } from "./jsonl.ts";
import type { RunOptions, RunResult, Runner } from "./runner.ts";

/** Command-line arguments of a headless run (exported for tests). */
export function grokArgs(opts: Pick<RunOptions, "model" | "extraArgs" | "permissions">, prompt: string[], session: string[]): string[] {
  return [
    "--trust",
    ...prompt,
    "--output-format",
    "streaming-json",
    ...(opts.permissions === "full" ? ["--always-approve"] : ["--permission-mode", "dontAsk"]),
    ...session,
    ...(opts.model ? ["--model", opts.model] : []),
    "--no-auto-update",
    ...(opts.extraArgs ?? []),
  ];
}

/**
 * The environment of a headless run: a command may take as long as the session and is never sent to the
 * background when its time is up (a headless run ends with its turn, and what it left in the background with it).
 */
export function grokEnv(env: RunOptions["env"], timeoutMs: number | undefined): RunOptions["env"] {
  const secs = Math.max(Math.round((timeoutMs ?? 0) / 1000), 30 * 60);
  return { ...env, GROK_CONFIG: JSON.stringify({ toolset: { bash: { timeout_secs: secs, max_timeout_secs: secs, auto_background_on_timeout: false } } }) };
}

/** What a tool call was, in one line: its command, else the tool and its file. */
function describe(e: Record<string, unknown>): string {
  const input = (e.rawInput ?? {}) as Record<string, unknown>;
  if (typeof input.command === "string") return `$ ${input.command.split("\n")[0]!.slice(0, 140)}`;
  const file = input.target_file ?? input.file_path ?? input.path ?? input.target_directory;
  return typeof file === "string" ? `${String(e.toolName ?? e.title ?? "tool")} ${file}` : String(e.toolName ?? e.title ?? "tool");
}

export const grokRunner: Runner = {
  id: "grok",
  command: "grok",
  run(opts: RunOptions): Promise<RunResult> {
    const promptFile = opts.logFile.replace(/\.log$/, "") + ".prompt.md";
    fs.mkdirSync(path.dirname(promptFile), { recursive: true });
    fs.writeFileSync(promptFile, opts.prompt);
    const id = randomUUID();
    const env = grokEnv(opts.env, opts.timeoutMs);
    // Its text comes in pieces; the last message (after the last tool call) is its answer.
    let said = "";
    const calls = new Map<string, string>();
    const resume = (sid: string, message: string) => ({ args: grokArgs(opts, ["-p", message], ["--resume", sid]), input: "" });
    return runJsonLines("grok", grokArgs(opts, ["--prompt-file", promptFile], ["--session-id", id]), env, opts, resume, (msg, heard) => {
      heard.sessionId ??= id;
      const type = msg.type;
      if (type === "text" && typeof msg.data === "string") {
        said += msg.data;
        heard.text = said.trim();
      } else if (type === "tool_call") {
        if (said.trim()) opts.onProgress?.(said.trim().split("\n")[0]!.slice(0, 160));
        said = "";
        const what = describe(msg);
        if (typeof msg.toolCallId === "string") calls.set(msg.toolCallId, `${msg.toolName === "run_terminal_command" ? "Bash" : String(msg.toolName ?? "tool")}: ${what.replace(/^\$ /, "").slice(0, 120)}`);
        opts.onProgress?.(what);
      } else if (type === "tool_call_update" && msg.status === "failed") {
        // Refused by the rules ("Denied by permission policy") or by dontAsk ("User cancelled the execution").
        const content = JSON.stringify(msg.content ?? "");
        if (/denied by permission|permission policy|user cancelled|not allowed/i.test(content)) heard.denied.push(calls.get(String(msg.toolCallId)) ?? "tool");
      } else if (type === "end") {
        if (typeof msg.sessionId === "string") heard.sessionId = msg.sessionId;
        const u = (msg.usage ?? {}) as Record<string, number>;
        const m = heard.metrics;
        // (a resumed session adds its own)
        m.inputTokens = (m.inputTokens ?? 0) + (u.input_tokens ?? 0);
        m.outputTokens = (m.outputTokens ?? 0) + (u.output_tokens ?? 0) + (u.reasoning_tokens ?? 0);
        m.cacheReadTokens = (m.cacheReadTokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        if (typeof msg.num_turns === "number") m.turns = (m.turns ?? 0) + msg.num_turns;
        // A cost only when Grok knows it whole (a subscription often does not say it).
        if (typeof msg.total_cost_usd === "number") m.costUsd = (m.costUsd ?? 0) + msg.total_cost_usd;
        else if (msg.cost_is_partial === true || msg.usage_is_incomplete === true) m.costPartial = true;
        const models = Object.keys((msg.modelUsage ?? {}) as object);
        if (models[0]) m.model = models[0];
        if (msg.stopReason === "refusal") heard.isError = true;
      } else if (type === "error") {
        heard.isError = true;
        heard.text = String(msg.message ?? "error");
      }
    });
  },
};
