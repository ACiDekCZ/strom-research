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
// refused — denied_actions); full skips the permissions. agy 1.3.3 ends a
// headless run at a refused command (its answer empty): strom tells it to go on
// in the same conversation (--conversation <its id>) through strom, at the same
// level, while time is left, at most twice (jsonl.ts goOn).
// Interactive conversations are started by strom chat (agents/launch.ts).

import fs from "node:fs";
import path from "node:path";
import { addResponses, heardResponse, runJsonLines, type Heard } from "./jsonl.ts";
import { usageNumber, tellUsage, type RunOptions, type RunResult, type Runner, type UsageSample } from "./runner.ts";
import { effortArgs } from "../agents/effort.ts";

/** Command-line arguments of a headless run (exported for tests); `first` is its first message. */
export function antigravityArgs(opts: Pick<RunOptions, "model" | "effort" | "extraArgs" | "permissions" | "shared" | "timeoutMs">, first: string): string[] {
  return [
    "--print",
    first,
    "--output-format",
    "stream-json",
    ...(opts.permissions === "full" ? ["--dangerously-skip-permissions"] : []),
    ...(opts.shared ? ["--add-dir", opts.shared] : []),
    ...(opts.model ? ["--model", opts.model] : []),
    ...effortArgs("antigravity", opts.effort),
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
    // Stopped at the time limit, it is just stopped. Ended at a refused command (agy 1.3.3 ends a headless run there),
    // it goes on in its conversation, told what is allowed — at the same level, at most AGY_GO_ON times.
    const goOn = {
      max: AGY_GO_ON,
      message: (heard: Heard) => (heard.endedAtRefusal ? antigravityGoOnMessage(heard.endedAtRefusal) : undefined),
      said: (heard: Heard, n: number, max: number) => `the agent stopped at a refused command (${heard.endedAtRefusal}) — it goes on in the same conversation, told to work only through strom (${n} of ${max})`,
      resume: (id: string, message: string, timeoutMs: number | undefined) => ({ args: antigravityGoOnArgs({ ...opts, timeoutMs }, id, message), input: "" }),
    };
    return runJsonLines("agy", antigravityArgs(opts, first), opts.env, { ...opts, prompt: "" }, undefined, (msg, heard) => readEvent(msg, heard, said, opts.onProgress, opts.onUsage), { totalsAtEnd: true, goOn });
  },
};

/** How many times a session's agy is told to go on after it ended at a refused command. */
export const AGY_GO_ON = 2;

/** What agy is told after it ended at a refused command (exported for tests). */
export function antigravityGoOnMessage(refused: string): string {
  return (
    `Your last command (${refused.replace(/^\$ /, "")}) was refused by this research's permissions: here only \`strom …\` commands are ` +
    "allowed, and files are read with your file viewer. Do not try it another way. Go on with your task through strom " +
    "(`strom brief` shows it again, `strom help <command>` how each command works), record what you find as you go, " +
    "and finish with `strom session close` as the brief says."
  );
}

/** The command line that goes on in agy's conversation with a message (exported for tests): the same level and switches. */
export function antigravityGoOnArgs(opts: Pick<RunOptions, "model" | "effort" | "extraArgs" | "permissions" | "shared" | "timeoutMs">, conversation: string, message: string): string[] {
  return [...antigravityArgs(opts, message), "--conversation", conversation];
}

/**
 * What agy says of its use: its conversation's id (init), each answer step's tokens (input, output with its thinking,
 * cache read), the whole run's at its result. No cost.
 */
function usageOf(kind: string, msg: Record<string, unknown>): UsageSample[] {
  if (kind === "init" && typeof msg.conversation_id === "string") return [{ agentSession: msg.conversation_id }];
  const tokens = (u: Record<string, unknown> | undefined, extra: UsageSample): UsageSample[] => {
    if (!u || typeof u !== "object") return [];
    const inp = usageNumber(u.input_tokens);
    const out = usageNumber(u.output_tokens);
    const cr = usageNumber(u.cache_read_tokens);
    if (inp === undefined && out === undefined && cr === undefined) return [];
    // (its input is what the cache did not hold: total_tokens = input + output)
    return [{ ...extra, in: inp, out, cr, ...(!extra.total && (inp !== undefined || cr !== undefined) ? { ctx: (inp ?? 0) + (cr ?? 0) } : {}) }];
  };
  if (kind === "result") {
    const r = (msg.result ?? {}) as { usage?: Record<string, unknown>; num_turns?: unknown };
    return tokens(r.usage, { total: true, turns: usageNumber(r.num_turns) });
  }
  if (kind !== "step_update") return [];
  const s = (msg.step_update ?? {}) as { step_type?: string; state?: string; usage?: Record<string, unknown> };
  return s.step_type === "agent_response" && s.state === "DONE" ? tokens(s.usage, {}) : [];
}

/** One event of agy's stream (exported for tests). */
export function readEvent(msg: Record<string, unknown>, heard: Heard, said: Map<number, string>, onProgress?: (line: string) => void, onUsage?: (u: UsageSample) => void): void {
  const kind = String(msg.event ?? msg.type ?? "");
  for (const u of usageOf(kind, msg)) {
    if (onUsage) tellUsage({ onUsage }, u);
    // an answer step's use (a process stopped before its result keeps it)
    if (!u.total && (u.in !== undefined || u.out !== undefined || u.cr !== undefined)) heardResponse(heard, u);
  }
  // its conversation: the one a process that ended at a refused command goes on in (--conversation)
  if (kind === "init" && typeof msg.conversation_id === "string") heard.sessionId ??= msg.conversation_id;
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
    // it answered after all: it ended where it meant to
    if (r.response?.trim()) heard.endedAtRefusal = undefined;
    if (r.status && r.status !== "SUCCESS" && r.status !== "OK") {
      heard.isError = true;
      if (r.error) heard.text = r.error;
    }
    const u = r.usage ?? {};
    const m = heard.metrics;
    // This process's use, added to the session's (a session may be more than one process): its steps' as they said
    // them — their sum is its result's in every stream seen, and it never counts an earlier process of the same
    // conversation again — else its result's.
    heard.ended = true;
    if (heard.responses?.n) addResponses(m, heard.responses);
    else {
      if (typeof u.input_tokens === "number") m.inputTokens = (m.inputTokens ?? 0) + u.input_tokens;
      // its output tokens hold its thinking already (input + output = total)
      if (typeof u.output_tokens === "number") m.outputTokens = (m.outputTokens ?? 0) + u.output_tokens;
      if (typeof u.cache_read_tokens === "number") m.cacheReadTokens = (m.cacheReadTokens ?? 0) + u.cache_read_tokens;
    }
    if (typeof r.num_turns === "number") m.turns = (m.turns ?? 0) + r.num_turns;
    if (typeof r.duration_seconds === "number") m.durationMs = (m.durationMs ?? 0) + r.duration_seconds * 1000;
    // what its permissions refused in this process: those its steps named are listed already, the rest by the kind of action
    const denied = Array.isArray(r.denied_actions) ? r.denied_actions : [];
    for (const d of denied.slice(heard.denied.length - (heard.deniedBefore ?? 0))) {
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
    // it goes on after a refusal: no end at it
    heard.endedAtRefusal = undefined;
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
  if (s.state === "ACTIVE") {
    heard.endedAtRefusal = undefined;
    onProgress?.(d.line);
  } else if (refused(s)) {
    heard.denied.push(d.denied);
    // (kept unless something comes after it: agy 1.3.3 ends a headless run at a refused command, its answer empty)
    heard.endedAtRefusal = d.line;
    onProgress?.(`refused by permissions: ${d.line}`);
  }
}
