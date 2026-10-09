// Antigravity CLI runner (`agy`, Google's agent CLI after Gemini CLI).
// Headless: `agy --print <first message> --output-format stream-json` in the
// tree folder. agy reads no stdin when the prompt is given as a switch, and it
// keeps only the last ~8 kB of a command's output (`strom brief` would reach it
// without its beginning) — so the brief goes into a file beside the run's log,
// inside the tree (its workspace, read without asking), and the first message
// tells it to read that file whole first. Never the brief itself in argv
// (Windows: 32k characters). A reader's short prompt is its first message.
// Events are {"event": …} lines: init, step_update (a step of the agent: its
// answer in text deltas, a tool with its parameters, ERROR when refused) and
// the result with status, response, usage and denied_actions. Its permissions
// are rules in the user's settings (strom agents install adds `command(strom)`
// there); under ask and auto a headless run gets nothing else (what would ask is
// refused — denied_actions); full skips the permissions.
// Interactive conversations are started by strom chat (agents/launch.ts).

import fs from "node:fs";
import path from "node:path";
import { runJsonLines, type Heard } from "./jsonl.ts";
import type { RunOptions, RunResult, Runner } from "./runner.ts";

/** Command-line arguments of a headless run (exported for tests); `first` is its first message. */
export function antigravityArgs(opts: Pick<RunOptions, "model" | "extraArgs" | "permissions" | "shared" | "timeoutMs">, first: string): string[] {
  return [
    "--print",
    first,
    "--output-format",
    "stream-json",
    ...(opts.permissions === "full" ? ["--dangerously-skip-permissions"] : []),
    ...(opts.shared ? ["--add-dir", opts.shared] : []),
    ...(opts.model ? ["--model", opts.model] : []),
    ...(opts.timeoutMs ? ["--print-timeout", `${Math.round(opts.timeoutMs / 1000)}s`] : []),
    ...(opts.extraArgs ?? []),
  ];
}

/** The first message of a run whose brief is in a file (exported for tests). */
export function antigravityFirstMessage(briefFile: string): string {
  return (
    `Your brief for this strom session is the file ${briefFile}. Read that whole file first, every line of it ` +
    "(in parts if your file viewer shows only some lines): it holds your task, what is already known and how to work, " +
    "and nothing else gives it to you. Then follow it: work only through `strom` commands in this folder, record " +
    "findings as you go, and finish with `strom session close` as the brief says. Your tool keeps only the last ~8 kB " +
    'of a command\'s output: an output cut at its start ("<truncated … lines>") means a narrower command ' +
    "(--limit, --page, one record at a time, `strom help <command>`), never the same one again."
  );
}

/** The file of the brief: beside the run's log (in .strom/runs of the tree, removed with it by strom tidy). */
export function antigravityBriefFile(logFile: string): string {
  return logFile.replace(/\.log$/, "") + ".prompt.md";
}

interface Step {
  step_index?: number;
  state?: string;
  step_type?: string;
  tool_name?: string;
  text_delta?: string;
  tool_info?: { name?: string; parameters?: Record<string, unknown>; error?: { message?: string } };
}

/** What a tool step did, in one line: a command as "$ …", else the tool and its file. */
function describe(s: Step): { line: string; denied: string } {
  const p = s.tool_info?.parameters ?? {};
  const tool = String(s.tool_name ?? s.tool_info?.name ?? "tool");
  if (typeof p.CommandLine === "string") {
    const cmd = p.CommandLine.split("\n")[0]!.slice(0, 140);
    return { line: `$ ${cmd}`, denied: `Bash: ${cmd.slice(0, 120)}` };
  }
  const file = p.AbsolutePath ?? p.TargetFile ?? p.DirectoryPath ?? p.Url;
  const line = typeof file === "string" ? `${tool} ${file}` : tool;
  return { line, denied: `${tool}: ${line.slice(tool.length).trim().slice(0, 120)}`.replace(/: $/, "") };
}

/** A tool step refused by the permissions (headless: what would ask is denied). */
function refused(s: Step): boolean {
  return s.state === "ERROR" && /denied permission|permission check failed|auto-denied/i.test(s.tool_info?.error?.message ?? "");
}

export const antigravityRunner: Runner = {
  id: "antigravity",
  command: "agy",
  run(opts: RunOptions): Promise<RunResult> {
    // A brief (strom run): in a file it reads whole. A reader's prompt is short: it is the first message itself.
    let first = opts.kickoff;
    if (opts.prompt !== opts.kickoff) {
      const file = antigravityBriefFile(opts.logFile);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, opts.prompt);
      first = antigravityFirstMessage(path.resolve(file));
    }
    // (nothing on stdin: agy does not read it beside --print)
    const said = new Map<number, string>();
    // Its events name a conversation, but strom has not resumed one yet: stopped at the time limit, it is just stopped.
    return runJsonLines("agy", antigravityArgs(opts, first), opts.env, { ...opts, prompt: "" }, undefined, (msg, heard) => readEvent(msg, heard, said, opts.onProgress));
  },
};

/** One event of agy's stream (exported for tests). */
export function readEvent(msg: Record<string, unknown>, heard: Heard, said: Map<number, string>, onProgress?: (line: string) => void): void {
  const kind = String(msg.event ?? msg.type ?? "");
  if (kind === "result") {
    const r = (msg.result ?? {}) as {
      status?: string;
      response?: string;
      error?: string;
      num_turns?: number;
      duration_seconds?: number;
      usage?: Record<string, number>;
      denied_actions?: { action?: string; display_name?: string }[];
    };
    if (r.response) heard.text = r.response;
    if (r.status && r.status !== "SUCCESS" && r.status !== "OK") {
      heard.isError = true;
      if (r.error) heard.text = r.error;
    }
    const u = r.usage ?? {};
    const m = heard.metrics;
    if (typeof u.input_tokens === "number") m.inputTokens = u.input_tokens;
    // its output tokens hold its thinking already (input + output = total)
    if (typeof u.output_tokens === "number") m.outputTokens = u.output_tokens;
    if (typeof u.cache_read_tokens === "number") m.cacheReadTokens = u.cache_read_tokens;
    if (typeof r.num_turns === "number") m.turns = r.num_turns;
    if (typeof r.duration_seconds === "number") m.durationMs = r.duration_seconds * 1000;
    // what its permissions refused: those its steps named are listed already, the rest by the kind of action
    const denied = Array.isArray(r.denied_actions) ? r.denied_actions : [];
    for (const d of denied.slice(heard.denied.length)) {
      const what = String(d.display_name ?? d.action ?? "action");
      heard.denied.push(what === "RunCommand" || d.action === "command" ? "Bash: (a command)" : what);
      onProgress?.(`refused by permissions: ${what}`);
    }
    return;
  }
  if (kind !== "step_update") return;
  const s = (msg.step_update ?? {}) as Step;
  const i = typeof s.step_index === "number" ? s.step_index : -1;
  if (s.step_type === "agent_response") {
    // its words come in pieces: the step's first line once it is done
    if (typeof s.text_delta === "string") said.set(i, (said.get(i) ?? "") + s.text_delta);
    if (s.state === "DONE") {
      const text = (said.get(i) ?? "").trim();
      said.delete(i);
      if (text) onProgress?.(text.split("\n")[0]!.slice(0, 160));
    }
    return;
  }
  if (s.step_type !== "tool") return;
  const d = describe(s);
  if (s.state === "ACTIVE") onProgress?.(d.line);
  else if (refused(s)) {
    heard.denied.push(d.denied);
    onProgress?.(`refused by permissions: ${d.line}`);
  }
}
