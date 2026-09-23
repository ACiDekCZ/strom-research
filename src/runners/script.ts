// A runner that executes a local script instead of an AI agent — for tests
// and for scripted, repeatable runs. STROM_RUNNER_SCRIPT names the script
// (run with node); it gets the same environment an agent would, and the
// prompt both on stdin (like a headless agent) and in STROM_PROMPT.

import { spawn } from "node:child_process";
import { appendLog, looksLikeLimit, stopTree, type RunOptions, type RunResult, type Runner } from "./runner.ts";

export const scriptRunner: Runner = {
  id: "script",
  command: process.execPath,
  run(opts: RunOptions): Promise<RunResult> {
    const script = opts.env.STROM_RUNNER_SCRIPT;
    return new Promise((resolve) => {
      if (!script) return resolve({ exitCode: 2, outcome: "error", text: "STROM_RUNNER_SCRIPT is not set", metrics: {} });
      const child = spawn(process.execPath, [script, ...(opts.extraArgs ?? [])], {
        cwd: opts.cwd,
        env: { ...(opts.env as NodeJS.ProcessEnv), STROM_PROMPT: opts.prompt },
        stdio: ["pipe", "pipe", "pipe"],
      });
      child.stdin.end(opts.prompt);
      let timedOut = false;
      const timer = opts.timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            stopTree(child);
          }, opts.timeoutMs)
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
  },
};
