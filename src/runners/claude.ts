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
// otherwise (--no-chrome), whatever Claude Code's own default is. Working alone
// (strom run, a reader) it starts without the user's add-ons unless agent.addons
// is on: --strict-mcp-config, --tools <what strom uses>, no auto-memory.

import { randomUUID } from "node:crypto";
import { appendLog, feedStdin, looksLikeLimit, looksLikeModelRejected, OWN_GROUP, spawnAgent, stopTree, type RunOptions, type RunResult, type Runner } from "./runner.ts";
import type { SessionMetrics } from "../core/model.ts";

function describeTool(block: { name?: string; input?: Record<string, unknown> }): string {
  const input = block.input ?? {};
  if (block.name === "Bash" && typeof input.command === "string") return `$ ${input.command.split("\n")[0]!.slice(0, 140)}`;
  if (typeof input.file_path === "string") return `${block.name} ${input.file_path}`;
  if (typeof input.url === "string") return `${block.name} ${input.url}`;
  if (typeof input.query === "string") return `${block.name} "${input.query}"`;
  return String(block.name ?? "tool");
}

/**
 * The tools of a session working alone without the user's add-ons (agent.addons off) — what strom's sessions use:
 * the shell (strom), files (notes, views, a connector it builds), the web, subagents (Agent, and SendMessage to ask one
 * again) and ToolSearch: MCP tools — the browser's (--chrome) too — load when needed; without it every schema would be
 * in the prompt (measured: +7.5k tokens with the browser). Windows: its PowerShell too (the tree's rules allow strom
 * there). A name Claude Code does not know is left out without a word: the init event is checked (missingTools).
 */
export const RUN_TOOLS = ["Bash", "Read", "Edit", "Write", "WebFetch", "WebSearch", "Agent", "ToolSearch", "SendMessage"] as const;
/** A reader's tools: it opens its views and writes its report (reader-settings.json allows nothing else). */
export const READER_TOOLS = ["Read", "Edit", "Write"] as const;

/** The tools of a clean session (--tools). */
export function cleanTools(reader: boolean | undefined, platform: NodeJS.Platform = process.platform): string[] {
  return reader ? [...READER_TOOLS] : platform === "win32" ? [...RUN_TOOLS, "PowerShell"] : [...RUN_TOOLS];
}

/**
 * The tools a clean session asked for that Claude Code did not load (its init event's list): a newer Claude Code may
 * have renamed one. The subagent tool is listed as Task; PowerShell only where it is on, Bash's place on Windows.
 */
export function missingTools(asked: string[], loaded: string[]): string[] {
  const has = new Set(loaded);
  return asked.filter((t) => t !== "PowerShell" && !has.has(t) && !(t === "Agent" && has.has("Task")) && !(t === "Bash" && has.has("PowerShell")));
}

/** Command-line arguments for a run (exported for tests). */
export function claudeArgs(opts: Pick<RunOptions, "interactive" | "kickoff" | "name" | "model" | "extraArgs" | "settingsFile" | "agentsFile" | "chrome" | "permissions" | "remote" | "clean" | "reader">): string[] {
  const level = opts.permissions ?? "auto";
  const mode = level === "full" ? "bypassPermissions" : !opts.interactive ? "dontAsk" : level === "auto" ? "auto" : undefined;
  const args = opts.interactive ? [opts.kickoff] : ["-p", "--output-format", "stream-json", "--verbose"];
  if (mode) args.push("--permission-mode", mode);
  if (opts.settingsFile) args.push("--settings", opts.settingsFile);
  // the tree's scan reader (a file: with --print, --agents takes its path — no JSON through a Windows command line)
  if (opts.agentsFile && !opts.interactive && !opts.reader) args.push("--agents", opts.agentsFile);
  if (opts.name) args.push("--name", opts.name);
  if (opts.model) args.push("--model", opts.model);
  if (opts.chrome !== undefined) args.push(opts.chrome ? "--chrome" : "--no-chrome");
  // named always: its value is optional, and a bare flag would take the next argument
  if (opts.remote) args.push("--remote-control", opts.name ?? "Strom");
  // working alone without the user's add-ons: no MCP servers of theirs (the browser's, --chrome, stays), the tools strom
  // uses — and so no skills either (no Skill tool). Never --setting-sources, --bare or --safe-mode: they drop the user's
  // model, effort and login, or the tree's own instructions.
  if (opts.clean && !opts.interactive) args.push("--strict-mcp-config", "--tools", cleanTools(opts.reader).join(","));
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
export function headlessEnv(env: RunOptions["env"], timeoutMs: number | undefined, opts: Pick<RunOptions, "clean" | "reader"> = {}): RunOptions["env"] {
  const long = String(Math.max(timeoutMs ?? 0, 30 * 60_000));
  return {
    ...env,
    CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1",
    CLAUDE_CODE_DISABLE_CRON: "1",
    BASH_DEFAULT_TIMEOUT_MS: long,
    BASH_MAX_TIMEOUT_MS: long,
    // without the user's add-ons: no memory of theirs read, nothing written into it (it would be outside strom)
    ...(opts.clean ? { CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" } : {}),
    // A reader works in one stretch of minutes: the prompt cached for 5 minutes, not an hour (cheaper to write) —
    // no add-on of the user's, so always.
    ...(opts.reader ? { CLAUDE_CODE_PROMPT_CACHE_TTL: "5m" } : {}),
  };
}

/** One start of Claude Code, as it went. */
interface Attempt {
  code: number | null;
  timedOut: boolean;
  /** It could not be started. */
  failed?: string;
  metrics: SessionMetrics;
  /** It said how it ended (the result event): its cost is known. */
  reported: boolean;
  text: string;
  stderr: string;
  isError: boolean;
  denied: string[];
}

function attempt(opts: RunOptions, args: string[], input: string, timeoutMs: number | undefined): Promise<Attempt> {
  return new Promise((resolve) => {
    const child = spawnAgent("claude", args, {
      cwd: opts.cwd,
      env: opts.interactive ? opts.env : headlessEnv(opts.env, opts.timeoutMs, opts),
      stdio: opts.interactive ? "inherit" : ["pipe", "pipe", "pipe"],
      windowsHide: !opts.interactive,
      detached: !opts.interactive && OWN_GROUP,
    });
    // The brief goes in on stdin: no limit on its length on any platform.
    if (!opts.interactive) feedStdin(child, input);
    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          stopTree(child);
        }, timeoutMs)
      : undefined;
    const abort = () => stopTree(child);
    opts.signal?.addEventListener("abort", abort, { once: true });
    const a: Attempt = { code: null, timedOut: false, metrics: {}, reported: false, text: "", stderr: "", isError: false, denied: [] };
    let buffer = "";
    const handle = (line: string) => {
      if (!line.trim()) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line) as Record<string, unknown>;
      } catch {
        return;
      }
      if (msg.type === "system" && msg.subtype === "init" && typeof msg.model === "string") a.metrics.model = msg.model;
      // a tool strom asked for and Claude Code did not load (renamed in a newer version?): said, the session goes on
      if (msg.type === "system" && msg.subtype === "init" && opts.clean && !opts.interactive && Array.isArray(msg.tools)) {
        const missing = missingTools(cleanTools(opts.reader), msg.tools.map(String));
        if (missing.length) {
          const said = `Claude Code did not load ${missing.join(", ")} — the session may not manage without; strom config set agent.addons on runs it with everything, as before`;
          opts.onProgress?.(said);
          appendLog(opts.logFile, `\n[strom] ${said}\n`);
        }
      }
      if (msg.type === "assistant") {
        const content = ((msg.message as { content?: unknown[] })?.content ?? []) as { type: string; text?: string; name?: string; input?: Record<string, unknown> }[];
        for (const b of content) {
          if (b.type === "tool_use") opts.onProgress?.(describeTool(b));
          else if (b.type === "text" && b.text?.trim()) opts.onProgress?.(b.text.trim().split("\n")[0]!.slice(0, 160));
        }
      }
      if (msg.type === "result") {
        a.reported = true;
        a.text = String(msg.result ?? "");
        a.isError = Boolean(msg.is_error);
        const m = a.metrics;
        const u = (msg.usage ?? {}) as Record<string, number>;
        if (u.input_tokens !== undefined) m.inputTokens = u.input_tokens;
        if (u.output_tokens !== undefined) m.outputTokens = u.output_tokens;
        if (u.cache_read_input_tokens !== undefined) m.cacheReadTokens = u.cache_read_input_tokens;
        if (u.cache_creation_input_tokens !== undefined) m.cacheWriteTokens = u.cache_creation_input_tokens;
        if (typeof msg.total_cost_usd === "number") m.costUsd = msg.total_cost_usd;
        if (typeof msg.num_turns === "number") m.turns = msg.num_turns;
        if (typeof msg.duration_ms === "number") m.durationMs = msg.duration_ms;
        for (const d of (msg.permission_denials ?? []) as { tool_name?: string; tool_input?: Record<string, unknown> }[]) {
          const input = d.tool_input ?? {};
          const what = typeof input.command === "string" ? input.command : typeof input.file_path === "string" ? input.file_path : typeof input.url === "string" ? input.url : "";
          a.denied.push(`${d.tool_name ?? "tool"}${what ? `: ${String(what).split("\n")[0]!.slice(0, 120)}` : ""}`);
        }
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
    child.stderr?.on("data", (d: Buffer) => {
      a.stderr += d.toString("utf8");
      appendLog(opts.logFile, d.toString("utf8"));
    });
    const end = () => {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", abort);
    };
    child.on("error", (err) => {
      end();
      resolve({ ...a, failed: String(err.message) });
    });
    child.on("close", (code) => {
      end();
      if (buffer) handle(buffer);
      resolve({ ...a, code, timedOut });
    });
  });
}

/** Two starts as one session: the time's metrics added up. */
function together(first: SessionMetrics, then: SessionMetrics): SessionMetrics {
  const sum = (k: "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens" | "costUsd" | "turns" | "durationMs") =>
    first[k] === undefined && then[k] === undefined ? {} : { [k]: (first[k] ?? 0) + (then[k] ?? 0) };
  return {
    ...((first.model ?? then.model) ? { model: (first.model ?? then.model)! } : {}),
    ...sum("inputTokens"),
    ...sum("outputTokens"),
    ...sum("cacheReadTokens"),
    ...sum("cacheWriteTokens"),
    ...sum("costUsd"),
    ...sum("turns"),
    ...sum("durationMs"),
  };
}

export const claudeRunner: Runner = {
  id: "claude",
  command: "claude",
  async run(opts: RunOptions): Promise<RunResult> {
    // A headless session has an id of strom's choosing: stopped at its limit, it is resumed to write down what it found.
    const id = opts.interactive ? undefined : randomUUID();
    const args = claudeArgs(opts);
    let a = await attempt(opts, id ? [...args, "--session-id", id] : args, opts.prompt, opts.timeoutMs);
    if (a.failed) return { exitCode: 127, outcome: "error", text: a.failed, metrics: a.metrics };
    const timedOut = a.timedOut;
    let metrics: SessionMetrics = { ...a.metrics, ...(a.reported ? {} : { costPartial: true }) };
    const denied = [...a.denied];
    if (timedOut) {
      const min = Math.round(opts.timeoutMs! / 60000);
      if (opts.wrapUp && id && !opts.signal?.aborted) {
        opts.onProgress?.(`time limit reached (${min} min) — the agent gets ${Math.round(opts.wrapUp.ms / 60000)} min to write down what it found`);
        const more = await attempt(opts, [...args, "--resume", id], opts.wrapUp.prompt, opts.wrapUp.ms);
        if (more.timedOut) opts.onProgress?.("the agent did not finish in time — stopped");
        metrics = { ...together(metrics, more.metrics), costPartial: true };
        denied.push(...more.denied);
        a = { ...more, code: more.code, stderr: a.stderr + more.stderr, text: more.text || a.text };
      } else opts.onProgress?.(`time limit reached (${min} min) — the agent was stopped`);
    }
    if (denied.length) metrics.denied = denied.length;
    const all = `${a.text}\n${a.stderr}`;
    const limit = looksLikeLimit(all);
    const code = a.code;
    const outcome: RunResult["outcome"] = opts.signal?.aborted
      ? "stopped"
      : timedOut
        ? "timeout"
        : limit.limit
          ? "limit"
          : /log ?in|authenticat|api key|unauthori[sz]ed/i.test(all) && (code ?? 0) !== 0
            ? "auth"
            : (code ?? 0) !== 0 || a.isError
              ? "error"
              : "ok";
    return { exitCode: code ?? 1, outcome, text: a.text || a.stderr.trim(), metrics, ...(limit.resumeAt ? { resumeAt: limit.resumeAt } : {}), ...(denied.length ? { denied } : {}), ...(outcome === "error" && looksLikeModelRejected(all) ? { modelRejected: true as const } : {}) };
  },
};
