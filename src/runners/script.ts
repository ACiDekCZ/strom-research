// A runner that executes a local script instead of an AI agent — for tests
// and for scripted, repeatable runs. STROM_RUNNER_SCRIPT names the script
// (run with node); it gets the same environment an agent would, and the
// prompt both on stdin (like a headless agent) and in STROM_PROMPT.

import { spawn } from "node:child_process";
import { appendLog, looksLikeLimit, stopTree, type RunOptions, type RunResult, type Runner } from "./runner.ts";

export const scriptRunner: Runner = {
  id: "script",
  command: process.execPath,
  async run(opts: RunOptions): Promise<RunResult> {
    const first = await once(opts, opts.prompt, opts.timeoutMs, false);
    if (first.outcome !== "timeout" || !opts.wrapUp || opts.signal?.aborted) return first;
    // Stopped at its limit: resumed with the message to write down what it found (STROM_WRAP_UP=1).
    opts.onProgress?.("time limit reached — the agent gets time to write down what it found");
    const more = await once(opts, opts.wrapUp.prompt, opts.wrapUp.ms, true);
    return { ...more, outcome: "timeout" };
  },
};

function once(opts: RunOptions, prompt: string, timeoutMs: number | undefined, wrapUp: boolean): Promise<RunResult> {
  const script = opts.env.STROM_RUNNER_SCRIPT;
  return new Promise((resolve) => {
    if (!script) return resolve({ exitCode: 2, outcome: "error", text: "STROM_RUNNER_SCRIPT is not set", metrics: {} });
    const child = spawn(process.execPath, [script, ...(opts.extraArgs ?? [])], {
      cwd: opts.cwd,
      env: { ...(opts.env as NodeJS.ProcessEnv), STROM_PROMPT: prompt, ...(wrapUp ? { STROM_WRAP_UP: "1" } : {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end(prompt);
    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          stopTree(child);
        }, timeoutMs)
      : undefined;
    opts.signal?.addEventListener("abort", () => stopTree(child), { once: true });
    let out = "";
    const denied: string[] = [];
    const on = (d: Buffer) => {
      for (const l of d.toString("utf8").split("\n")) if (l.startsWith("denied: ")) denied.push(l.slice(8).trim());
      out += d.toString("utf8");
      appendLog(opts.logFile, d.toString("utf8"));
      for (const l of d.toString("utf8").split("\n")) if (l.trim()) opts.onProgress?.(l.trim().slice(0, 160));
    };
    child.stdout.on("data", on);
    child.stderr.on("data", on);
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      const limit = looksLikeLimit(out);
      resolve({
        exitCode: code ?? 1,
        outcome: opts.signal?.aborted ? "stopped" : timedOut ? "timeout" : limit.limit ? "limit" : code === 0 ? "ok" : "error",
        text: out.trim().split("\n").slice(-5).join("\n"),
        metrics: { turns: 1, ...(denied.length ? { denied: denied.length } : {}) },
        ...(limit.resumeAt ? { resumeAt: limit.resumeAt } : {}),
        ...(denied.length ? { denied } : {}),
      });
    });
  });
}
