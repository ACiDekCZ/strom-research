// A headless agent that reports as JSON lines (Codex `exec --json`, Antigravity
// `--output-format stream-json`): the brief on stdin, one event per line on
// stdout, a time limit, Ctrl-C, the subscription limit and a missing login
// recognised — the same for every such agent; each runner only reads its own
// events. Stopped at its time limit, an agent that can resume its session gets a
// few minutes to write down what it found (RunOptions.wrapUp).

import type { SessionMetrics } from "../core/model.ts";
import type { Env } from "../core/paths.ts";
import { appendLog, looksLikeLimit, spawnAgent, stopTree, type RunOptions, type RunResult } from "./runner.ts";

/** What a runner learns from its agent's events. */
export interface Heard {
  metrics: SessionMetrics;
  /** The agent's last words. */
  text: string;
  isError: boolean;
  denied: string[];
  /** The agent's own id of this session, when it says it (for resuming it). */
  sessionId?: string;
}

/** How to resume the agent's own session with a message (stopped at its time limit: to write down what it found). */
export type Resume = (sessionId: string, message: string) => { args: string[]; input: string };

export async function runJsonLines(
  command: string,
  args: string[],
  env: Env,
  opts: RunOptions,
  resume: Resume | undefined,
  onEvent: (msg: Record<string, unknown>, heard: Heard) => void,
): Promise<RunResult> {
  const started = Date.now();
  const heard: Heard = { metrics: {}, text: "", isError: false, denied: [] };
  let a = await attempt(command, args, opts.prompt, env, opts, opts.timeoutMs, heard, onEvent);
  if (a.failed) return { exitCode: 127, outcome: "error", text: a.failed, metrics: heard.metrics };
  const timedOut = a.timedOut;
  if (timedOut) {
    const min = Math.round(opts.timeoutMs! / 60000);
    if (opts.wrapUp && resume && heard.sessionId && !opts.signal?.aborted) {
      opts.onProgress?.(`time limit reached (${min} min) — the agent gets ${Math.round(opts.wrapUp.ms / 60000)} min to write down what it found`);
      const r = resume(heard.sessionId, opts.wrapUp.prompt);
      const more = await attempt(command, r.args, r.input, env, opts, opts.wrapUp.ms, heard, onEvent);
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
    const child = spawnAgent(command, args, { cwd: opts.cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    child.stdin?.end(input);
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
