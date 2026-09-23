// A headless agent that reports as JSON lines (Codex `exec --json`, Antigravity
// `--output-format stream-json`): the brief on stdin, one event per line on
// stdout, a time limit, Ctrl-C, the subscription limit and a missing login
// recognised — the same for every such agent; each runner only reads its own
// events.

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
}

export function runJsonLines(command: string, args: string[], env: Env, opts: RunOptions, onEvent: (msg: Record<string, unknown>, heard: Heard) => void): Promise<RunResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawnAgent(command, args, { cwd: opts.cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    child.stdin?.end(opts.prompt);
    let timedOut = false;
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          opts.onProgress?.(`time limit reached (${Math.round(opts.timeoutMs! / 60000)} min) — stopping the agent`);
          stopTree(child);
        }, opts.timeoutMs)
      : undefined;
    opts.signal?.addEventListener("abort", () => stopTree(child), { once: true });
    const heard: Heard = { metrics: {}, text: "", isError: false, denied: [] };
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
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: 127, outcome: "error", text: String(err.message), metrics: heard.metrics });
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (buffer) handle(buffer);
      heard.metrics.durationMs ??= Date.now() - started;
      if (heard.denied.length) heard.metrics.denied = heard.denied.length;
      const all = `${heard.text}\n${stderr}`;
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
      resolve({
        exitCode: code ?? 1,
        outcome,
        text: heard.text || stderr.trim(),
        metrics: heard.metrics,
        ...(limit.resumeAt ? { resumeAt: limit.resumeAt } : {}),
        ...(heard.denied.length ? { denied: heard.denied } : {}),
      });
    });
  });
}
