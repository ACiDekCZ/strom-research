// A headless agent that reports as JSON lines (Codex `exec --json`, Antigravity
// `--output-format stream-json`): the brief on stdin, one event per line on
// stdout, a time limit, Ctrl-C, the subscription limit and a missing login
// recognised — the same for every such agent; each runner only reads its own
// events. Stopped at its time limit, an agent that can resume its session gets a
// few minutes to write down what it found (RunOptions.wrapUp).

import type { SessionMetrics } from "../core/model.ts";
import type { Env } from "../core/paths.ts";
import { appendLog, feedStdin, looksLikeLimit, looksLikeModelRejected, OWN_GROUP, spawnAgent, stopTree, type RunOptions, type RunResult } from "./runner.ts";

/** What a runner learns from its agent's events. */
export interface Heard {
  metrics: SessionMetrics;
  /** The agent's last words. */
  text: string;
  isError: boolean;
  denied: string[];
  /** The agent's own id of this session, when it says it (for resuming it). */
  sessionId?: string;
  /** This process's responses as the agent said them one by one (heardResponse), for a runner whose totals come at its end. */
  responses?: Responses;
  /** This process said its totals (its end event): its responses are counted in them. */
  ended?: boolean;
  /** This process ended right at an action the permissions refused, without a word after it: that action ("$ ls"). */
  endedAtRefusal?: string;
  /** How many refusals the processes before this one heard (`denied` holds all of the session's). */
  deniedBefore?: number;
}

/** The use of one process's responses added up: how many, and the tokens of each kind any of them said. */
export interface Responses {
  n: number;
  in?: number;
  out?: number;
  cr?: number;
  cw?: number;
  /** Each response is one of the agent's turns as its totals count them (Grok): the turns of a process cut short too. */
  turns?: boolean;
}

/** One response of the agent with its use, as its stream says it (never a number it did not say). */
export function heardResponse(heard: Heard, u: { in?: number | undefined; out?: number | undefined; cr?: number | undefined; cw?: number | undefined }, turns?: boolean): void {
  const r = (heard.responses ??= { n: 0, ...(turns ? { turns: true } : {}) });
  r.n++;
  for (const k of ["in", "out", "cr", "cw"] as const) if (u[k] !== undefined) r[k] = (r[k] ?? 0) + u[k]!;
}

/** The responses of a process added to the session's metrics (a process that ended without its totals). */
export function addResponses(m: SessionMetrics, r: Responses | undefined): void {
  if (!r?.n) return;
  if (r.in !== undefined) m.inputTokens = (m.inputTokens ?? 0) + r.in;
  if (r.out !== undefined) m.outputTokens = (m.outputTokens ?? 0) + r.out;
  if (r.cr !== undefined) m.cacheReadTokens = (m.cacheReadTokens ?? 0) + r.cr;
  if (r.cw !== undefined) m.cacheWriteTokens = (m.cacheWriteTokens ?? 0) + r.cw;
  if (r.turns) m.turns = (m.turns ?? 0) + r.n;
}

/**
 * How a runner reads its agent beyond its events. `totalsAtEnd`: the agent says each response's use as it comes
 * (heardResponse) and the whole process's at its end (heard.ended) — a process that ended without them (stopped at
 * the time limit, killed) keeps the use of its responses, its cost unknown (costPartial: "$x+", never a price made up).
 * `goOn`: a process that ended where it should not have (Antigravity at a refused command: heard.endedAtRefusal) is
 * told to go on in the same conversation while time is left (GO_ON_MIN_MS), at most `max` times, each said in the
 * output and the log — the same level, never one that would allow what was refused.
 */
export interface JsonLinesWays {
  totalsAtEnd?: boolean;
  goOn?: {
    max: number;
    /** What it is told when the process just ended where it should go on; else nothing. */
    message: (heard: Heard) => string | undefined;
    /** The line said (output and log) as it is told to go on, the n-th time of at most max. */
    said: (heard: Heard, n: number, max: number) => string;
    /** The process that goes on: the same conversation, the message, the time left. */
    resume: (sessionId: string, message: string, timeoutMs: number | undefined) => { args: string[]; input: string };
  };
}

/** The least time left to go on in after a process ended early (less: the session ends as it ended). */
export const GO_ON_MIN_MS = 60_000;

/** How to resume the agent's own session with a message (stopped at its time limit: to write down what it found). */
export type Resume = (sessionId: string, message: string) => { args: string[]; input: string };

export async function runJsonLines(
  command: string,
  args: string[],
  env: Env,
  opts: RunOptions,
  resume: Resume | undefined,
  onEvent: (msg: Record<string, unknown>, heard: Heard) => void,
  ways: JsonLinesWays = {},
): Promise<RunResult> {
  const started = Date.now();
  const heard: Heard = { metrics: {}, text: "", isError: false, denied: [] };
  // one start of the agent, and what it used when it ended without saying it
  const once = async (args: string[], input: string, timeoutMs: number | undefined) => {
    heard.responses = undefined;
    heard.ended = false;
    heard.endedAtRefusal = undefined;
    heard.deniedBefore = heard.denied.length;
    const a = await attempt(command, args, input, env, opts, timeoutMs, heard, onEvent);
    // (its events set them while it ran)
    const said = heard.responses as Responses | undefined;
    if (ways.totalsAtEnd && !a.failed && !(heard.ended as boolean)) {
      addResponses(heard.metrics, said);
      if (said?.n || a.timedOut || opts.signal?.aborted) heard.metrics.costPartial = true;
    }
    return a;
  };
  let a = await once(args, opts.prompt, opts.timeoutMs);
  if (a.failed) return { exitCode: 127, outcome: "error", text: a.failed, metrics: heard.metrics };
  const goOn = ways.goOn;
  for (let n = 1; goOn && n <= goOn.max && !a.timedOut && !opts.signal?.aborted && heard.sessionId; n++) {
    const message = goOn.message(heard);
    if (!message) break;
    const left = opts.timeoutMs === undefined ? undefined : opts.timeoutMs - (Date.now() - started);
    if (left !== undefined && left < GO_ON_MIN_MS) break;
    const line = goOn.said(heard, n, goOn.max);
    opts.onProgress?.(line);
    appendLog(opts.logFile, `\n[strom] ${line}\n`);
    const r = goOn.resume(heard.sessionId, message, left);
    const more = await once(r.args, r.input, left);
    if (more.failed) break;
    a = { ...more, stderr: a.stderr + more.stderr };
  }
  const timedOut = a.timedOut;
  if (timedOut) {
    const min = Math.round(opts.timeoutMs! / 60000);
    if (opts.wrapUp && resume && heard.sessionId && !opts.signal?.aborted) {
      opts.onProgress?.(`time limit reached (${min} min) — the agent gets ${Math.round(opts.wrapUp.ms / 60000)} min to write down what it found`);
      const r = resume(heard.sessionId, opts.wrapUp.prompt);
      const more = await once(r.args, r.input, opts.wrapUp.ms);
      if (more.timedOut) opts.onProgress?.("the agent did not finish in time — stopped");
      a = { ...more, stderr: a.stderr + more.stderr };
    } else opts.onProgress?.(`time limit reached (${min} min) — the agent was stopped`);
  }
  const code = a.code;
  heard.metrics.durationMs ??= Date.now() - started;
  if (heard.denied.length) heard.metrics.denied = heard.denied.length;
  const all = `${heard.text}\n${a.stderr}`;
  const limit = looksLikeLimit(all);
  const outcome: RunResult["outcome"] = opts.signal?.aborted
    ? "stopped"
    : timedOut
      ? "timeout"
      : limit.limit
        ? "limit"
        : /log ?in|authenticat|api[ _]?key|unauthori[sz]ed|GEMINI_API_KEY/i.test(all) && ((code ?? 0) !== 0 || heard.isError)
          ? "auth"
          : (code ?? 0) !== 0 || heard.isError
            ? "error"
            : "ok";
  return {
    exitCode: code ?? 1,
    outcome,
    text: heard.text || a.stderr.trim(),
    metrics: heard.metrics,
    ...(limit.resumeAt ? { resumeAt: limit.resumeAt } : {}),
    ...(heard.denied.length ? { denied: heard.denied } : {}),
    ...(outcome === "error" && looksLikeModelRejected(all) ? { modelRejected: true as const } : {}),
  };
}

/** One start of the agent; its events go to `heard`. */
function attempt(
  command: string,
  args: string[],
  input: string,
  env: Env,
  opts: RunOptions,
  timeoutMs: number | undefined,
  heard: Heard,
  onEvent: (msg: Record<string, unknown>, heard: Heard) => void,
): Promise<{ code: number | null; timedOut: boolean; stderr: string; failed?: string }> {
  return new Promise((resolve) => {
    const child = spawnAgent(command, args, { cwd: opts.cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, detached: OWN_GROUP });
    feedStdin(child, input);
    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          stopTree(child);
        }, timeoutMs)
      : undefined;
    const abort = () => stopTree(child);
    opts.signal?.addEventListener("abort", abort, { once: true });
    let buffer = "";
    const handle = (line: string) => {
      if (!line.trim()) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line) as Record<string, unknown>;
      } catch {
        return; // a line of plain text among the events
      }
      onEvent(msg, heard);
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
    const end = () => {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", abort);
    };
    child.on("error", (err) => {
      end();
      resolve({ code: 127, timedOut, stderr, failed: String(err.message) });
    });
    child.on("close", (code) => {
      end();
      if (buffer) handle(buffer);
      resolve({ code, timedOut, stderr });
    });
  });
}
