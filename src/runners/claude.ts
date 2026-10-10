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
// are on only when a connector fetches through the browser (--chrome) — in a run
// only for a session whose task may need them (sessionBrowser), never for a
// reader — and off otherwise (--no-chrome), whatever Claude Code's own default is. Working alone
// (strom run, a reader) it starts without the user's add-ons unless agent.addons
// is on: --strict-mcp-config, --tools <what strom uses>, no auto-memory.

import { randomUUID } from "node:crypto";
import { appendLog, feedStdin, looksLikeLimit, looksLikeModelRejected, mergeLimits, OWN_GROUP, usageNumber, spawnAgent, stopTree, tellUsage, type AgentLimit, type RunOptions, type RunResult, type Runner, type UsageSample } from "./runner.ts";
import { effortArgs } from "../agents/effort.ts";
import type { SessionMetrics } from "../core/model.ts";
import { addResponses, type Responses } from "./jsonl.ts";

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

/**
 * Never in a session nobody watches, whatever its level or add-ons: a question to the user (nobody answers it — what
 * only the user can decide is a task that waits, strom task wait), and the browser's pairing request, which waits for a
 * click in Chrome (several browsers connected: list_connected_browsers, then select_browser).
 */
export const RUN_DISALLOWED = ["AskUserQuestion", "mcp__claude-in-chrome__switch_browser"] as const;

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

const LIMIT_KINDS = ["five_hour", "seven_day"] as const;

/**
 * The limits of the plan in one line of Claude Code's stream (rate_limit_event): each window of `unifiedWindows`
 * (five_hour, seven_day: utilization 0–1, resetsAt in seconds), else the one the event is about; a rejected one is full.
 * Anything else, or a shape not known: nothing — never a number made up.
 */
export function limitsOf(msg: Record<string, unknown>, at: Date = new Date()): AgentLimit[] | undefined {
  if (msg.type !== "rate_limit_event" || !msg.rate_limit_info || typeof msg.rate_limit_info !== "object") return undefined;
  const info = msg.rate_limit_info as Record<string, unknown>;
  const out = new Map<AgentLimit["kind"], AgentLimit>();
  const take = (kind: unknown, w: unknown) => {
    if (!LIMIT_KINDS.includes(kind as AgentLimit["kind"]) || !w || typeof w !== "object") return;
    const { utilization, resetsAt } = w as Record<string, unknown>;
    if (typeof utilization !== "number" || !Number.isFinite(utilization) || utilization < 0) return;
    const reset = typeof resetsAt === "number" && Number.isFinite(resetsAt) && resetsAt > 0 ? new Date(resetsAt * 1000).toISOString() : undefined;
    out.set(kind as AgentLimit["kind"], { kind: kind as AgentLimit["kind"], used: utilization, ...(reset ? { resetsAt: reset } : {}), at: at.toISOString() });
  };
  if (info.unifiedWindows && typeof info.unifiedWindows === "object") for (const [k, w] of Object.entries(info.unifiedWindows)) take(k, w);
  if (!out.has(info.rateLimitType as AgentLimit["kind"])) take(info.rateLimitType, info);
  const hit = out.get(info.rateLimitType as AgentLimit["kind"]);
  if (info.status === "rejected" && hit && hit.used < 1) out.set(hit.kind, { ...hit, used: 1 });
  return out.size ? [...out.values()] : undefined;
}

/**
 * The use of one request of the agent in Claude Code's stream: an assistant message's usage (input, output, cache read
 * and written — for an hour, for five minutes), its model; a subagent's request names the tool call that started it
 * (parent_tool_use_id). Undefined for any other line, or one without usage.
 */
export function claudeUsage(msg: Record<string, unknown>): { id?: string; sample: UsageSample } | undefined {
  if (msg.type !== "assistant" || !msg.message || typeof msg.message !== "object") return undefined;
  const m = msg.message as { id?: unknown; model?: unknown; usage?: Record<string, unknown> };
  const u = m.usage;
  if (!u || typeof u !== "object") return undefined;
  const inp = usageNumber(u.input_tokens);
  const cr = usageNumber(u.cache_read_input_tokens);
  const cw = usageNumber(u.cache_creation_input_tokens);
  const cc = (u.cache_creation ?? {}) as Record<string, unknown>;
  const parts = [inp, cr, cw].filter((n): n is number => n !== undefined);
  const sample: UsageSample = {
    ...(typeof msg.parent_tool_use_id === "string" && msg.parent_tool_use_id ? { sub: msg.parent_tool_use_id } : {}),
    ...(typeof m.model === "string" ? { model: m.model } : {}),
    in: inp,
    out: usageNumber(u.output_tokens),
    cr,
    cw,
    cw1h: usageNumber(cc.ephemeral_1h_input_tokens),
    cw5m: usageNumber(cc.ephemeral_5m_input_tokens),
    ...(parts.length ? { ctx: parts.reduce((a, b) => a + b, 0) } : {}),
  };
  return { ...(typeof m.id === "string" ? { id: m.id } : {}), sample };
}

/** Command-line arguments for a run (exported for tests). */
export function claudeArgs(opts: Pick<RunOptions, "interactive" | "kickoff" | "name" | "model" | "effort" | "extraArgs" | "settingsFile" | "agentsFile" | "chrome" | "permissions" | "remote" | "clean" | "reader">): string[] {
  const level = opts.permissions ?? "auto";
  const mode = level === "full" ? "bypassPermissions" : !opts.interactive ? "dontAsk" : level === "auto" ? "auto" : undefined;
  const args = opts.interactive ? [opts.kickoff] : ["-p", "--output-format", "stream-json", "--verbose"];
  if (mode) args.push("--permission-mode", mode);
  if (opts.settingsFile) args.push("--settings", opts.settingsFile);
  // the tree's scan reader (a file: with --print, --agents takes its path — no JSON through a Windows command line)
  if (opts.agentsFile && !opts.interactive && !opts.reader) args.push("--agents", opts.agentsFile);
  if (opts.name) args.push("--name", opts.name);
  if (opts.model) args.push("--model", opts.model);
  args.push(...effortArgs("claude", opts.effort));
  // a reader never gets the browser, whatever Claude Code's own default is (its views and its report only)
  if (opts.reader && !opts.interactive) args.push("--no-chrome");
  else if (opts.chrome !== undefined) args.push(opts.chrome ? "--chrome" : "--no-chrome");
  // named always: its value is optional, and a bare flag would take the next argument
  if (opts.remote) args.push("--remote-control", opts.name ?? "Strom");
  // working alone without the user's add-ons: no MCP servers of theirs (the browser's, --chrome, stays), the tools strom
  // uses — and so no skills either (no Skill tool). Never --setting-sources, --bare or --safe-mode: they drop the user's
  // model, effort and login, or the tree's own instructions.
  if (opts.clean && !opts.interactive) args.push("--strict-mcp-config", "--tools", cleanTools(opts.reader).join(","));
  // nobody watches: nothing that waits for a person (a reader has neither tool)
  if (!opts.interactive && !opts.reader) args.push("--disallowedTools", RUN_DISALLOWED.join(","));
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
  /** Its own requests' use as it said them one by one (its subagents' apart, as its result counts them). */
  responses: Responses;
  text: string;
  stderr: string;
  isError: boolean;
  denied: string[];
  /** The plan's limits as the agent said them last. */
  limits?: AgentLimit[];
}

function attempt(opts: RunOptions, args: string[], input: string, timeoutMs: number | undefined, sid?: string): Promise<Attempt> {
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
    const a: Attempt = { code: null, timedOut: false, metrics: {}, reported: false, responses: { n: 0 }, text: "", stderr: "", isError: false, denied: [] };
    let buffer = "";
    // One request's message comes in several lines (a line per block, the same id): its last usage is the request's.
    // Kept per stream (the agent's own, each subagent's) until that stream's next request, then said.
    const pending = new Map<string, { id?: string; sample: UsageSample }>();
    const flush = (key?: string) => {
      for (const [k, p] of [...pending]) {
        if (key !== undefined && k !== key) continue;
        pending.delete(k);
        tellUsage(opts, p.sample);
        if (!p.sample.sub) {
          const r = a.responses;
          r.n++;
          for (const key of ["in", "out", "cr", "cw"] as const) if (p.sample[key] !== undefined) r[key] = (r[key] ?? 0) + p.sample[key]!;
        }
      }
    };
    const handle = (line: string) => {
      if (!line.trim()) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line) as Record<string, unknown>;
      } catch {
        return;
      }
      if (msg.type === "system" && msg.subtype === "init" && typeof msg.model === "string") a.metrics.model = msg.model;
      if (msg.type === "system" && msg.subtype === "init" && !opts.interactive) {
        const id = typeof msg.session_id === "string" ? msg.session_id : sid;
        if (id) tellUsage(opts, { agentSession: id, ...(typeof msg.model === "string" ? { model: msg.model } : {}) });
      }
      const use = opts.interactive ? undefined : claudeUsage(msg);
      if (use) {
        const key = use.sample.sub ?? "";
        const had = pending.get(key);
        if (had && had.id !== use.id) flush(key);
        pending.set(key, use);
      }
      if (msg.type === "result") flush();
      const limits = limitsOf(msg);
      if (limits) {
        a.limits = mergeLimits(a.limits, limits);
        opts.onLimits?.(a.limits!);
      }
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
      flush();
      resolve({ ...a, code, timedOut });
    });
  });
}

/**
 * What one start used: its result's totals; stopped before its result (the time limit), the use its requests said
 * one by one, its cost unknown (costPartial: "$x+", never a price made up).
 */
function measured(a: Attempt): SessionMetrics {
  if (a.reported) return a.metrics;
  const m: SessionMetrics = { ...a.metrics, costPartial: true };
  addResponses(m, a.responses);
  return m;
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
    let a = await attempt(opts, id ? [...args, "--session-id", id] : args, opts.prompt, opts.timeoutMs, id);
    if (a.failed) return { exitCode: 127, outcome: "error", text: a.failed, metrics: a.metrics };
    const timedOut = a.timedOut;
    let metrics: SessionMetrics = measured(a);
    const denied = [...a.denied];
    let limits = a.limits;
    if (timedOut) {
      const min = Math.round(opts.timeoutMs! / 60000);
      if (opts.wrapUp && id && !opts.signal?.aborted) {
        opts.onProgress?.(`time limit reached (${min} min) — the agent gets ${Math.round(opts.wrapUp.ms / 60000)} min to write down what it found`);
        const more = await attempt(opts, [...args, "--resume", id], opts.wrapUp.prompt, opts.wrapUp.ms, id);
        if (more.timedOut) opts.onProgress?.("the agent did not finish in time — stopped");
        metrics = { ...together(metrics, measured(more)), costPartial: true };
        denied.push(...more.denied);
        limits = mergeLimits(limits, more.limits);
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
    return { exitCode: code ?? 1, outcome, text: a.text || a.stderr.trim(), metrics, ...(limit.resumeAt ? { resumeAt: limit.resumeAt } : {}), ...(denied.length ? { denied } : {}), ...(outcome === "error" && looksLikeModelRejected(all) ? { modelRejected: true as const } : {}), ...(limits ? { limits } : {}) };
  },
};
