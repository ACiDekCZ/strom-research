// A headless agent that reports as JSON lines (Codex `exec --json`, Antigravity
// `--output-format stream-json`): the brief on stdin, one event per line on
// stdout, a time limit, Ctrl-C, the subscription limit and a missing login
// recognised — the same for every such agent; each runner only reads its own
// events. Stopped at its time limit, an agent that can resume its session gets a
// few minutes to write down what it found (RunOptions.wrapUp).

import type { SessionMetrics } from "../core/model.ts";
import type { Env } from "../core/paths.ts";
import type { AgentWeb } from "../core/metrics.ts";
import { RunLog } from "../core/logimages.ts";
import { StringDecoder } from "node:string_decoder";
import { appendLog, feedStdin, looksLikeLimit, looksLikeModelRejected, OWN_GROUP, recoverDelays, spawnAgent, stopTree, transientNetworkError, type RunOptions, type RunResult } from "./runner.ts";

/** What a runner learns from its agent's events. */
export interface Heard {
  metrics: SessionMetrics;
  /** The agent's last words. */
  text: string;
  isError: boolean;
  denied: string[];
  /** Which of `denied` (their places in it) were refused whole before any of it ran (RunResult.deniedWhole). */
  deniedWhole?: number[];
  /** Tool calls strom's own hook refused (RunResult.refused): not the permissions. */
  refused?: string[];
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
  /** This process's error as its events said it, whole (its name, code, message, cause): what recover reads. */
  error?: string;
  /** The last step of this process's own session ended normally, as its events said it (OpenCode: reason "stop"). */
  endedNormally?: boolean;
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

/** The fields an agent's web tool names the address of its page in. */
const URL_FIELDS = ["url", "Url", "URL", "uri", "href"] as const;

/**
 * One of the agent's own web tools by its name (core/metrics.ts AgentWeb): a page with its address from the tool's input,
 * or a search; another tool, or a page whose address its input does not say: undefined.
 */
export function webUse(tool: unknown, input: Record<string, unknown> | undefined, names: { page: readonly string[]; search: readonly string[] }): AgentWeb | undefined {
  if (typeof tool !== "string") return undefined;
  if (names.search.includes(tool)) return { via: "search", tool };
  if (!names.page.includes(tool)) return undefined;
  const url = URL_FIELDS.map((k) => input?.[k]).find((v): v is string => typeof v === "string" && v.trim() !== "");
  return url ? { via: "web", url, tool } : undefined;
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
  /**
   * A process that failed on a passing network error (runner.ts transientNetworkError: of its error event or its
   * stderr) is resumed in the same session after a wait (recoverDelays: 5 s, then 15 s), while its time is left — the
   * waits and the work before count against it (GO_ON_MIN_MS left after the wait, else it ends as it failed). Never
   * after Ctrl-C, its time limit or a signal, nor without its session's id; the same switches, the use of every process
   * added up.
   */
  recover?: {
    resume: (sessionId: string, message: string, timeoutMs: number | undefined) => { args: string[]; input: string };
  };
  /**
   * Each whole line the agent itself wrote on its stderr, as it comes (Codex says there alone a command its rules refused
   * before it ran: runners/codex.ts codexPolicyRejected) — never what its commands printed, never its words.
   */
  stderrLine?: (line: string, heard: Heard) => void;
}

/** What an agent resumed after a passing network error is told. */
export const RECOVER_PROMPT =
  "Your connection to the model's service failed on the way ({why}) and strom resumed this same session. Go on exactly where you " +
  "stopped — do not start over and do not repeat what is already recorded in strom. If your strom session is already closed, just end.";

/** Wait, cut short by Ctrl-C. */
function pause(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(t);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const t = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
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
  // the stderr of the last process alone (a passing error of one before it is no error of the last)
  let lastStderr = "";
  // one start of the agent, and what it used when it ended without saying it
  const once = async (args: string[], input: string, timeoutMs: number | undefined) => {
    heard.responses = undefined;
    heard.ended = false;
    heard.endedAtRefusal = undefined;
    heard.deniedBefore = heard.denied.length;
    heard.error = undefined;
    heard.endedNormally = undefined;
    const a = await attempt(command, args, input, env, opts, timeoutMs, heard, onEvent, ways.stderrLine);
    lastStderr = a.stderr;
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
  // a passing network error: the same session resumed after a wait, while its time is left
  let recovered = 0;
  const delays = recoverDelays(opts.env);
  for (let n = 1; ways.recover && n <= delays.length; n++) {
    if (a.timedOut || a.signal || opts.signal?.aborted || !heard.sessionId) break;
    if ((a.code ?? 0) === 0 && !heard.isError) break;
    const why = transientNetworkError(`${heard.error ?? ""}\n${lastStderr}`);
    if (!why) break;
    const wait = delays[n - 1]!;
    const left = opts.timeoutMs === undefined ? undefined : opts.timeoutMs - (Date.now() - started) - wait;
    if (left !== undefined && left < GO_ON_MIN_MS) break;
    appendLog(opts.logFile, `\n[strom] the agent's connection failed (${why}, exit code ${a.code ?? a.signal}) — its session ${heard.sessionId} resumed in ${Math.round(wait / 1000)} s (${n}/${delays.length})\n`);
    if (opts.onRecover) opts.onRecover({ n, max: delays.length, waitMs: wait, why });
    else opts.onProgress?.(`the agent's connection failed (${why}) — its session resumed in ${Math.round(wait / 1000)} s (${n}/${delays.length})`);
    await pause(wait, opts.signal);
    if (opts.signal?.aborted) break;
    // what the failed process said of its error is no error of the one that goes on
    if (heard.isError) heard.text = "";
    heard.isError = false;
    const r = ways.recover.resume(heard.sessionId, RECOVER_PROMPT.replace("{why}", why), left);
    const more = await once(r.args, r.input, left);
    if (more.failed) break;
    recovered++;
    a = { ...more, stderr: a.stderr + more.stderr };
  }
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
  if (heard.refused?.length) heard.metrics.refused = heard.refused.length;
  const all = `${heard.text}\n${a.stderr}`;
  const limit = looksLikeLimit(all);
  // ended by a signal strom did not send (no exit code): failed, never a clean end
  const failedCode = (code ?? (a.signal ? 1 : 0)) !== 0;
  const outcome: RunResult["outcome"] = opts.signal?.aborted
    ? "stopped"
    : timedOut
      ? "timeout"
      : limit.limit
        ? "limit"
        : /log ?in|authenticat|api[ _]?key|unauthori[sz]ed|GEMINI_API_KEY/i.test(all) && (failedCode || heard.isError)
          ? "auth"
          : failedCode || heard.isError
            ? "error"
            : "ok";
  // failed by its exit code alone (exactly 1, OpenCode after a clean end): said, the caller decides — never a reader's
  const exitOnly =
    outcome === "error" &&
    code === 1 &&
    !a.signal &&
    !opts.reader &&
    !opts.readerFiles &&
    heard.endedNormally === true &&
    !heard.isError &&
    !heard.error &&
    !heard.denied.length &&
    !heard.refused?.length &&
    !looksLikeModelRejected(all) &&
    !/error|exception|fatal|panic|fail|traceback/i.test(lastStderr);
  return {
    exitCode: code ?? 1,
    outcome,
    text: heard.text || a.stderr.trim(),
    metrics: heard.metrics,
    ...(exitOnly ? { exitOnly: true as const } : {}),
    ...(recovered ? { recovered } : {}),
    ...(limit.resumeAt ? { resumeAt: limit.resumeAt } : {}),
    ...(heard.denied.length ? { denied: heard.denied } : {}),
    ...(heard.deniedWhole?.length ? { deniedWhole: heard.deniedWhole } : {}),
    ...(heard.refused?.length ? { refused: heard.refused } : {}),
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
  onStderr?: (line: string, heard: Heard) => void,
): Promise<{ code: number | null; signal?: NodeJS.Signals | null; timedOut: boolean; stderr: string; failed?: string }> {
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
    // the log a whole line at a time, its images left out (core/logimages.ts); the events read from the full line
    const log = new RunLog(opts.logFile);
    const text = new StringDecoder("utf8");
    child.stdout?.on("data", (d: Buffer) => {
      buffer += text.write(d);
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        log.line(line);
        handle(line);
      }
      log.flush();
    });
    let stderr = "";
    // its stderr a whole line at a time too, for a runner that reads it (a line cut between two chunks read whole)
    const errText = new StringDecoder("utf8");
    let errLine = "";
    const errLines = (chunk: string, end = false) => {
      if (!onStderr) return;
      errLine += chunk;
      let nl: number;
      while ((nl = errLine.indexOf("\n")) >= 0) {
        onStderr(errLine.slice(0, nl).replace(/\r$/u, ""), heard);
        errLine = errLine.slice(nl + 1);
      }
      if (end && errLine) onStderr(errLine.replace(/\r$/u, ""), heard);
      if (end) errLine = "";
    };
    child.stderr?.on("data", (d: Buffer) => {
      const t = errText.write(d);
      stderr += t;
      appendLog(opts.logFile, t);
      errLines(t);
    });
    const end = () => {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", abort);
    };
    child.on("error", (err) => {
      end();
      resolve({ code: 127, timedOut, stderr, failed: String(err.message) });
    });
    child.on("close", (code, signal) => {
      end();
      buffer += text.end();
      if (buffer) handle(buffer);
      const errRest = errText.end();
      stderr += errRest;
      errLines(errRest, true);
      log.rest(buffer);
      log.flush();
      resolve({ code, signal, timedOut, stderr });
    });
  });
}
