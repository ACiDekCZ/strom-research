// Runners start an AI agent CLI on a prompt in a tree folder and report back.
// Adding an agent = one file implementing Runner.

import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { SessionMetrics } from "../core/model.ts";
import type { Env } from "../core/paths.ts";
import type { AgentPermissions } from "../core/config.ts";
import type { AgentWeb } from "../core/metrics.ts";
import { findAgent } from "../core/which.ts";

export interface RunOptions {
  cwd: string;
  /** The whole prompt (the brief). Headless runners send it on stdin — no command-line length limit. */
  prompt: string;
  /** A one-line prompt for interactive runs, where stdin is the user's terminal. */
  kickoff: string;
  env: Env;
  /** Model override (runner-specific name). */
  model?: string;
  /** The reasoning effort the person chose (model.effort), as the agent's own switch; none: the agent's own settings. */
  effort?: string;
  /** Hand the terminal to the agent instead of running headless. */
  interactive?: boolean;
  /** A display name for the agent's session. */
  name?: string;
  /** Extra arguments for the agent CLI (`strom run -- …`). */
  extraArgs?: string[];
  /** Stop the agent after this long. */
  timeoutMs?: number;
  /**
   * Stopped at its time limit, a headless agent that can be resumed gets this
   * much more time and this message: write down what it found, close the
   * session (core/clock.ts). An agent that cannot be resumed is just stopped.
   */
  wrapUp?: { ms: number; prompt: string };
  /**
   * The tree's agent settings (permissions), passed explicitly: Claude Code
   * ignores the allow rules of a project's .claude/settings.json until the
   * user has trusted the folder interactively — a new tree never is.
   */
  settingsFile?: string;
  /**
   * The tree's own subagents for a headless run (Claude Code: --agents <file>, its scan reader) — given on the command
   * line as the settings are, whatever the agent makes of the folder's own files.
   */
  agentsFile?: string;
  /** Browser tools (Claude in Chrome): on for connectors that fetch through the user's browser, off otherwise. */
  chrome?: boolean;
  /** Claude Code's Remote Control: the session followed and steered from claude.ai or a phone (agent.remote). */
  remote?: boolean;
  /**
   * Without the user's personal add-ons — skills, plugins, MCP servers, memory: a session nobody watches (strom run,
   * a reader) while agent.addons is off (the default). Only where the agent has switches for it (Claude Code, Codex);
   * a conversation (interactive) keeps them always.
   */
  clean?: boolean;
  /** A reader (strom read, clips, transcripts): it opens the views it is given and writes its report — nothing else. */
  reader?: boolean;
  /** What the agent may do without asking (the user's setting agent.permissions). */
  permissions?: AgentPermissions;
  /** The shared folder (inbox, plugins): a workspace folder of the agent besides the tree. */
  shared?: string | undefined;
  /** Raw output of the agent is appended here as it arrives. */
  logFile: string;
  /** One-line progress for the user (tool calls, messages). */
  onProgress?: (line: string) => void;
  /** The limits of the agent's plan as the agent says them while it works (Claude Code only; the latest of each kind). */
  onLimits?: (limits: AgentLimit[]) => void;
  /**
   * The agent's use as it says it while it works (core/metrics.ts): per request, turn or step where its stream says so,
   * else once at the end; and its own id of the session. Never a number the agent did not say.
   */
  onUsage?: (u: UsageSample) => void;
  /**
   * A page the agent fetched or a search it made with its own web tools, heard from its stream after the fact
   * (core/metrics.ts: fetch.jsonl). Claude Code's are counted by its hook, never from its stream (once, not twice).
   */
  onWeb?: (w: AgentWeb) => void;
  /** Stop the agent when this is aborted (the user pressed Ctrl-C). */
  signal?: AbortSignal;
}

export interface RunResult {
  exitCode: number;
  outcome: "ok" | "limit" | "auth" | "timeout" | "stopped" | "error";
  text: string;
  metrics: SessionMetrics;
  /** When the subscription limit resets, if the agent said so. */
  resumeAt?: string;
  /** Tool calls the permissions refused, e.g. "Bash: strom input show I0001". */
  denied?: string[];
  /**
   * Tool calls strom's own hook refused (core/web.ts: a web fetch past WEB_PER_HOST to one server in a run, or while
   * the server is left alone, its limit used up or its hour full), e.g. "WebFetch: https://…" — not the permissions.
   */
  refused?: string[];
  /** The agent refused the model it was started with (one it does not know, or no longer serves). */
  modelRejected?: true;
  /** The limits of the agent's plan as it said them last (Claude Code's rate_limit_event); none from other agents. */
  limits?: AgentLimit[];
}

/**
 * How much of one limit of the agent's plan is used, as the agent itself said it — strom knows no agent's limits
 * beyond this: a window (Claude Code's five-hour and week), its use 0–1, when it resets, when it was said.
 */
export interface AgentLimit {
  kind: "five_hour" | "seven_day";
  used: number;
  resetsAt?: string;
  at: string;
}

/**
 * One thing an agent said of its use: tokens of a request (or a turn, a step) — new input, output, cache read and
 * written, the whole context of the request — its cost when it says one, the model it says it ran on; its own id of
 * the session (Claude Code's UUID, Codex's thread, OpenCode's sessionID, Grok's session, Antigravity's conversation),
 * a subagent's (sub). `total`: the whole session at once (an agent that says its use only at the end).
 */
export interface UsageSample {
  agentSession?: string;
  sub?: string;
  model?: string;
  in?: number;
  out?: number;
  cr?: number;
  cw?: number;
  /** Cache written for an hour / for five minutes (Claude Code). */
  cw1h?: number;
  cw5m?: number;
  ctx?: number;
  usd?: number;
  turns?: number;
  total?: true;
  /** A turn that ended without saying its use (Codex's turn.failed): more was used than the samples say. */
  partial?: true;
}

/** A number the agent said, else nothing. */
export function usageNumber(n: unknown): number | undefined {
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/** The sample without what was not said; nothing when nothing was. */
export function sample(u: UsageSample): UsageSample | undefined {
  const out = Object.fromEntries(Object.entries(u).filter(([, v]) => v !== undefined)) as UsageSample;
  return Object.keys(out).length ? out : undefined;
}

/** Tell the caller of a sample, never failing the run because of it. */
export function tellUsage(opts: Pick<RunOptions, "onUsage">, u: UsageSample): void {
  const s = sample(u);
  if (!s || !opts.onUsage) return;
  try {
    opts.onUsage(s);
  } catch {
    // a measurement is no reason to fail
  }
}

/** A use of the agent's own web tool passed on (a page with its address, a search); a failure is left out. */
export function tellWeb(opts: Pick<RunOptions, "onWeb">, w: AgentWeb): void {
  if (!opts.onWeb || (w.via === "web" && !w.url)) return;
  try {
    opts.onWeb(w);
  } catch {
    // a measurement is no reason to fail
  }
}

/** The latest of each kind: what came later replaces what was said before. */
export function mergeLimits(had: AgentLimit[] | undefined, now: AgentLimit[] | undefined): AgentLimit[] | undefined {
  if (!now?.length) return had;
  const byKind = new Map((had ?? []).map((l) => [l.kind, l]));
  for (const l of now) byKind.set(l.kind, l);
  return [...byKind.values()];
}

export interface Runner {
  id: string;
  /** Executable to find on PATH. */
  command: string;
  run(opts: RunOptions): Promise<RunResult>;
}

/**
 * A tool call refused by strom's own hook, as the agent tells it: every reason core/web.ts gives begins with "strom: ",
 * and the agent puts its own words before it — Claude Code "PreToolUse:WebFetch hook error: strom: …", Grok "Hook
 * denied: strom: …". A hook of the person's own (another reason) is no such thing.
 */
export function refusedByStrom(text: string): boolean {
  return /\bhook (?:error|denied): strom: /i.test(text);
}

/** Recognise a subscription/usage limit in an agent's message. */
export function looksLikeLimit(text: string): { limit: boolean; resumeAt?: string } {
  if (!/(usage|rate|session|weekly|5-hour|daily)\s+limit|limit (reached|exceeded)|quota|too many requests|out of (credits|usage)/i.test(text)) return { limit: false };
  // (Codex: "… or try again at Oct 12th, 2026 3:05 PM." — its time has dots and commas of its own)
  const at = /resets?\s+(?:at\s+)?([^.\n]+)/i.exec(text)?.[1]?.trim() ?? /try again (?:at\s+)?((?:in\s+)?[^\n]+?)\.?[ \t]*$/im.exec(text)?.[1]?.trim();
  return at ? { limit: true, resumeAt: at } : { limit: true };
}

/**
 * Whether an agent that failed said it does not take its model (Codex: HTTP 400 "the model is not supported", OpenCode:
 * 410 "model … no longer available", "unknown model", model_not_found) — any agent's words, never a guess on a failure
 * that names no model.
 */
export function looksLikeModelRejected(text: string): boolean {
  return /\bmodels?\b[^\n]{0,80}?\b(?:not supported|unsupported|not available|no longer (?:available|supported|served)|not found|does not exist|doesn't exist|not valid|invalid|deprecated|retired|gone)\b|\b(?:unsupported|unknown|invalid) model\b|model_not_found|model[_ ]not[_ ]supported/i.test(text);
}

export function appendLog(file: string, chunk: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, chunk);
}

/**
 * The environment with `dir` first on PATH. On Windows the variable is
 * usually spelled "Path"; adding a second "PATH" beside it leaves the child
 * with two, and which one wins is undefined — so the existing key is reused.
 */
export function prependPath(env: Env, dir: string): Env {
  const key = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
  const out: Env = {};
  for (const [k, v] of Object.entries(env)) if (k.toUpperCase() !== "PATH" || k === key) out[k] = v;
  out[key] = `${dir}${path.delimiter}${env[key] ?? ""}`;
  return out;
}

/** Quote one argument for cmd.exe (only used for .cmd/.bat launchers on Windows). */
function cmdQuote(arg: string): string {
  if (/^[\w.\-/:=@]+$/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

/**
 * Start an agent CLI found on PATH. npm installs agents on Windows as .cmd
 * launchers, which Node can only start through cmd.exe.
 */
export function spawnAgent(command: string, args: string[], opts: SpawnOptions & { env: Env }): ChildProcess {
  const found = findAgent(command, opts.env) ?? command;
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(found)) {
    const line = [cmdQuote(found), ...args.map(cmdQuote)].join(" ");
    return spawn(opts.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${line}"`], { ...opts, windowsVerbatimArguments: true, env: opts.env as NodeJS.ProcessEnv });
  }
  return spawn(found, args, { ...opts, env: opts.env as NodeJS.ProcessEnv });
}

/**
 * The prompt on a headless child's stdin. A child that ends before it read it all (an agent that fails at once, a
 * script that reads nothing) closes the pipe: the rest of the write fails with EPIPE, an error on the stream that
 * nobody handled would end strom itself (found 2026-10-07 in npm test: write EPIPE). How the child ended says the rest.
 */
export function feedStdin(child: ChildProcess, input: string): void {
  if (!child.stdin) return;
  child.stdin.on("error", () => undefined);
  child.stdin.end(input);
}

/**
 * A headless agent in a process group of its own (not on Windows, whose console sends Ctrl-C to every process of
 * it): Ctrl-C in the terminal reaches strom alone, which asks the session to finish first (strom run).
 */
export const OWN_GROUP = process.platform !== "win32";

/**
 * After a stop, how long strom waits for the stopped agent's output to close before it stops waiting: a process the agent
 * started outside its own group (a background helper of its own, in a session of its own) keeps the pipe open for as long
 * as it lives, and strom — the agent that ran `strom read` with it — would wait on it (found live: a reader stopped at
 * its limit, the agent waiting minutes more).
 */
export const STOP_RELEASE_MS = 8000;

/** Stop a child and everything it started (Windows: the whole process tree; elsewhere its own group, when it has one). */
export function stopTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  // its pipes let go of (what strom read of them is kept): its end ('close') comes once it has exited — at once when
  // it has, only something it left behind holding them
  const release = () => {
    for (const s of [child.stdin, child.stdout, child.stderr]) if (s && !s.destroyed) s.destroy();
  };
  if (child.exitCode !== null || child.signalCode !== null) return void setTimeout(release, 1000).unref();
  setTimeout(release, STOP_RELEASE_MS).unref();
  if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else {
    const kill = (sig: NodeJS.Signals) => {
      try {
        process.kill(-child.pid!, sig); // its group: what it started too
      } catch {
        child.kill(sig); // no group of its own
      }
    };
    kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) kill("SIGKILL");
    }, 5000).unref();
  }
}
