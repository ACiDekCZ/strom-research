// OpenCode runner. Headless: `opencode run --format json "<kickoff>"` in the tree
// folder with the brief on stdin (it joins what is piped in with the message).
// The tree's rules are its project config (opencode.json: strom allowed, the
// evidence and git denied); under ask and auto a run nobody watches is its
// agent "strom-run" there — the same rules, what would ask refused (OpenCode 2
// ends a headless run at the first question it cannot ask); full adds --auto
// (everything the rules do not deny). Events are JSON lines: text, tool_use,
// step_start, step_finish (tokens and cost of a step), error; each names its
// session (sessionID), which `--session` resumes.

import path from "node:path";
import { runJsonLines, webUse } from "./jsonl.ts";
import { OPENCODE_RUN_AGENT } from "../agents/files.ts";
import { usageNumber, tellUsage, tellWeb, type RunOptions, type RunResult, type Runner } from "./runner.ts";

/** OpenCode's own web tools (OpenCode 2: webfetch with its url, websearch with its query), counted once each call is done. */
export const OPENCODE_WEB = { page: ["webfetch"], search: ["websearch"] } as const;

/** OpenCode's agent of a reader, given for its run alone (OPENCODE_CONFIG_CONTENT): no tree's config is where it works. */
export const OPENCODE_READER_AGENT = "strom-reader";
/** A reader's message: its task comes on stdin, joined with it. */
const READER_KICKOFF = "Your task is above: open the pages it names and write your report as it says.";

/**
 * A reader's agent (exported for tests): it opens its views and edits its report — every other file, the shell, the
 * web, subagents and questions refused (refused, never asked: OpenCode 2 ends a headless run at a question). Paths with
 * forward slashes, as OpenCode matches them.
 */
export function opencodeReaderConfig(files: NonNullable<RunOptions["readerFiles"]>): Record<string, unknown> {
  const abs = (p: string) => path.resolve(p).replace(/\\/g, "/");
  const only = (paths: string[]) => ({ "*": "deny", ...Object.fromEntries(paths.map((p) => [p, "allow"])) });
  const report = abs(files.report);
  const views = files.views.map(abs);
  return {
    agent: {
      [OPENCODE_READER_AGENT]: {
        mode: "primary",
        description: "a reader of strom: opens the views it is given, writes its report — nothing else",
        permission: {
          read: only([...views, report]),
          edit: only([report]),
          external_directory: only([...new Set([...views, report].map((f) => `${path.posix.dirname(f)}/*`))]),
          ...Object.fromEntries(["bash", "webfetch", "websearch", "task", "question", "skill", "todowrite", "glob", "grep", "list"].map((t) => [t, "deny"])),
        },
      },
    },
  };
}

/**
 * Command-line arguments of a reader (exported for tests): a server of its own (--standalone — never the person's
 * background service, which another installation's settings may have started: found live, its port taken), its agent.
 */
export function opencodeReaderArgs(opts: Pick<RunOptions, "model" | "extraArgs">): string[] {
  return ["run", "--standalone", "--format", "json", "--agent", OPENCODE_READER_AGENT, ...(opts.model ? ["--model", opts.model] : []), ...(opts.extraArgs ?? []), READER_KICKOFF];
}

/** Command-line arguments of a headless run (exported for tests). */
export function opencodeArgs(opts: Pick<RunOptions, "model" | "extraArgs" | "permissions" | "kickoff">): string[] {
  const level = opts.permissions === "full" ? ["--auto"] : ["--agent", OPENCODE_RUN_AGENT];
  return ["run", "--format", "json", ...level, ...(opts.model ? ["--model", opts.model] : []), ...(opts.extraArgs ?? []), opts.kickoff];
}

export const opencodeRunner: Runner = {
  id: "opencode",
  command: "opencode",
  run(opts: RunOptions): Promise<RunResult> {
    // a reader: its own agent and rules, given for this run (no tree's opencode.json where it works)
    const reader = opts.readerFiles;
    const env = reader ? { ...opts.env, OPENCODE_CONFIG_CONTENT: JSON.stringify(opencodeReaderConfig(reader)) } : opts.env;
    const args = reader ? opencodeReaderArgs(opts) : opencodeArgs({ ...opts, kickoff: "Your brief is above. Work only through `strom` in this folder, as it says." });
    const tokens = { input: 0, output: 0, cacheRead: 0 };
    let main: string | undefined;
    // the web tools' calls passed on (a call is said again as its state changes)
    const webSeen = new Set<string>();
    // Resumed: its session by id, the message as the prompt.
    const resume = (id: string, message: string) => ({ args: [...(reader ? opencodeReaderArgs(opts) : opencodeArgs({ ...opts, kickoff: message })).slice(0, -1), "--session", id, message], input: "" });
    return runJsonLines("opencode", args, env, opts, resume, (msg, heard) => {
      const part = (msg.part ?? {}) as Record<string, unknown>;
      // the run's own session is the first one named; another one is a subagent's (its scan reader) — the run's own
      // is the one resumed at the time limit, never the subagent's that spoke last
      const sid = typeof msg.sessionID === "string" ? msg.sessionID : undefined;
      if (sid && !main) {
        main = sid;
        heard.sessionId = sid;
        tellUsage(opts, { agentSession: sid });
      }
      if (msg.type === "tool_use") {
        const state = (part.state ?? {}) as { status?: string; input?: Record<string, unknown>; error?: string };
        const input = state.input ?? {};
        const what = typeof input.command === "string" ? `$ ${input.command}` : typeof input.filePath === "string" ? `${String(part.tool)} ${input.filePath}` : String(part.tool ?? "tool");
        opts.onProgress?.(what.split("\n")[0]!.slice(0, 140));
        // (its shell tool: "bash", "shell" from OpenCode 2 — named "Bash" like Claude Code's, so a refused strom stops the run)
        const refused = state.status === "error" && /reject|denied|not allowed|permission/i.test(state.error ?? "");
        if (refused) heard.denied.push(typeof input.command === "string" ? `Bash: ${input.command.slice(0, 120)}` : `${String(part.tool)}: ${what.slice(0, 120)}`);
        // its web tools: a page or a search once done — or failed other than refused (asked of the host all the same)
        const w = state.status === "completed" || (state.status === "error" && !refused) ? webUse(part.tool, input, OPENCODE_WEB) : undefined;
        const call = typeof part.callID === "string" ? part.callID : typeof part.id === "string" ? part.id : undefined;
        if (w && !(call && webSeen.has(call))) {
          if (call) webSeen.add(call);
          tellWeb(opts, w);
        }
      }
      if (msg.type === "text" && typeof part.text === "string" && part.text.trim()) heard.text = part.text;
      if (msg.type === "step_finish") {
        // One step of the conversation; the run's use is their sum.
        const t = (part.tokens ?? {}) as { input?: number; output?: number; reasoning?: number; cache?: { read?: number; write?: number } };
        // the step's use: its cost and the cache written too (OpenCode's input is what the cache did not hold)
        const inp = usageNumber(t.input);
        const cr = usageNumber(t.cache?.read);
        const cw = usageNumber(t.cache?.write);
        const ctxParts = [inp, cr, cw].filter((n): n is number => n !== undefined);
        const out = usageNumber(t.output) === undefined && usageNumber(t.reasoning) === undefined ? undefined : (usageNumber(t.output) ?? 0) + (usageNumber(t.reasoning) ?? 0);
        tellUsage(opts, {
          ...(sid && sid !== main ? { agentSession: sid, sub: sid } : {}),
          in: inp,
          out,
          cr,
          cw,
          ...(ctxParts.length ? { ctx: ctxParts.reduce((a, b) => a + b, 0) } : {}),
          usd: usageNumber(part.cost),
        });
        tokens.input += t.input ?? 0;
        tokens.output += (t.output ?? 0) + (t.reasoning ?? 0);
        tokens.cacheRead += t.cache?.read ?? 0;
        const m = heard.metrics;
        m.inputTokens = tokens.input;
        m.outputTokens = tokens.output;
        m.cacheReadTokens = tokens.cacheRead;
        m.turns = (m.turns ?? 0) + 1;
      }
      if (msg.type === "error") {
        heard.isError = true;
        const e = (msg.error ?? {}) as { name?: string; data?: { message?: string } };
        heard.text = e.data?.message ?? e.name ?? "error";
      }
    });
  },
};
