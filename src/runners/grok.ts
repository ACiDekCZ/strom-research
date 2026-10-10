// Grok Build runner (xAI's `grok`). Headless: `grok --trust --prompt-file <brief>
// --output-format streaming-json` in the tree folder — it reads no stdin, so the
// brief goes in a file beside the run's log. --trust: the tree folder's own files
// (AGENTS.md, .grok/config.toml with the tree's rules) load only in a trusted
// folder (grokTrust: recorded once per tree; an isolated installation records
// nothing, a reader needs no folder's files). The level: ask and auto — --permission-mode dontAsk (what the rules do
// not allow is refused; Grok still lets harmless commands of its own judgement
// through, so the deny rules are what holds); full — --always-approve (only the
// deny rules count). strom names the session (-s <uuid>) and resumes it by that
// id at the time limit (-r). Events are JSON lines: text, tool_call,
// tool_call_update, usage (one per model response: its tokens, so the context of
// each request), end (the whole run's use, cost) and error. A process stopped
// before its end (the time limit) keeps the use of its responses, its cost unknown.

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { heardResponse, runJsonLines, webUse } from "./jsonl.ts";
import { refusedByStrom, usageNumber, tellUsage, tellWeb, type RunOptions, type RunResult, type Runner } from "./runner.ts";
import { effortArgs } from "../agents/effort.ts";
import { isolated, type Env } from "../core/paths.ts";
import type { AgentWeb } from "../core/metrics.ts";

/**
 * Grok's own web tools (grok 1.0.46: web_fetch with its url, web_search with its query — the names from its tool
 * registry, the inputs as the other tools': rawInput), counted after the fact (core/metrics.ts).
 */
export const GROK_WEB = { page: ["web_fetch"], search: ["web_search"] } as const;

/**
 * How Grok reads the folder's own files (AGENTS.md, .grok/config.toml with the tree's rules: loaded only in a trusted
 * folder). `--trust` makes Grok record the folder in its ~/.grok/trusted_folders.toml — once per tree, the folder strom
 * starts it in. An isolated installation writes nothing of the agents' (core/paths.ts): there Grok's folder trust is
 * switched off for this process alone (GROK_FOLDER_TRUST=0, its own switch — nothing recorded, the tree's files read
 * all the same). A reader works in a folder outside the tree on purpose and needs no folder's files: neither.
 */
export function grokTrust(env: Env, reader?: boolean): { args: string[]; env: Record<string, string> } {
  if (reader) return { args: [], env: {} };
  return isolated(env) ? { args: [], env: { GROK_FOLDER_TRUST: "0" } } : { args: ["--trust"], env: {} };
}

/** Command-line arguments of a headless run (exported for tests). */
export function grokArgs(opts: Pick<RunOptions, "model" | "effort" | "extraArgs" | "permissions"> & Partial<Pick<RunOptions, "env" | "reader">>, prompt: string[], session: string[]): string[] {
  return [
    ...grokTrust(opts.env ?? {}, opts.reader).args,
    ...prompt,
    "--output-format",
    "streaming-json",
    ...(opts.permissions === "full" ? ["--always-approve"] : ["--permission-mode", "dontAsk"]),
    ...session,
    ...(opts.model ? ["--model", opts.model] : []),
    ...effortArgs("grok", opts.effort),
    "--no-auto-update",
    ...(opts.extraArgs ?? []),
  ];
}

/**
 * Working alone without the person's add-ons (agent.addons off), as far as Grok has switches for one process: what it
 * takes in of the person's other agents — Claude Code's and Cursor's skills (strom's own skill for Claude Code among
 * them), their MCP servers and hooks — off by its own variables (GROK_<VENDOR>_<SURFACE>_ENABLED, its "harness
 * compatibility"), its memory off (GROK_MEMORY=0). Grok's own skills, plugins and MCP servers (~/.grok) have no such
 * switch: only its user config.toml ([skills] ignore) leaves them out — its GROK_CONFIG overlay drops a [skills] table
 * and a tree's .grok/config.toml is not read for it (grok 1.0.46, `grok inspect`) — so they stay, nothing made up.
 */
export const GROK_CLEAN: Readonly<Record<string, string>> = {
  GROK_CLAUDE_SKILLS_ENABLED: "0",
  GROK_CURSOR_SKILLS_ENABLED: "0",
  GROK_CLAUDE_MCPS_ENABLED: "0",
  GROK_CURSOR_MCPS_ENABLED: "0",
  GROK_CLAUDE_HOOKS_ENABLED: "0",
  GROK_CURSOR_HOOKS_ENABLED: "0",
  GROK_MEMORY: "0",
};

/**
 * An isolated installation's Grok, in a conversation too: Claude Code's skills not taken in — strom's skill for Claude
 * Code there is another installation's (core/paths.ts). (Its skill in ~/.grok/skills has no switch: GROK_CLEAN.)
 */
export const GROK_ISOLATED: Readonly<Record<string, string>> = { GROK_CLAUDE_SKILLS_ENABLED: "0" };

/** What strom sets in Grok's environment: its folder trust (grokTrust), an isolated installation's, a clean run's. */
export function grokOwnEnv(env: Env, o: { reader?: boolean | undefined; clean?: boolean | undefined } = {}): Record<string, string> {
  return { ...grokTrust(env, o.reader).env, ...(isolated(env) ? GROK_ISOLATED : {}), ...(o.clean ? GROK_CLEAN : {}) };
}

/**
 * The environment of a headless run: a command may take as long as the session and is never sent to the
 * background when its time is up (a headless run ends with its turn, and what it left in the background with it).
 */
export function grokEnv(env: RunOptions["env"], timeoutMs: number | undefined, reader?: boolean, clean?: boolean): RunOptions["env"] {
  const secs = Math.max(Math.round((timeoutMs ?? 0) / 1000), 30 * 60);
  return { ...env, ...grokOwnEnv(env, { reader, clean }), GROK_CONFIG: JSON.stringify({ toolset: { bash: { timeout_secs: secs, max_timeout_secs: secs, auto_background_on_timeout: false } } }) };
}

/** What a tool call was, in one line: its command, else the tool and its file (a page: its address). */
function describe(e: Record<string, unknown>): string {
  const input = (e.rawInput ?? {}) as Record<string, unknown>;
  if (typeof input.command === "string") return `$ ${input.command.split("\n")[0]!.slice(0, 140)}`;
  const file = input.target_file ?? input.file_path ?? input.path ?? input.target_directory ?? input.url;
  return typeof file === "string" ? `${String(e.toolName ?? e.title ?? "tool")} ${file}` : String(e.toolName ?? e.title ?? "tool");
}

export const grokRunner: Runner = {
  id: "grok",
  command: "grok",
  run(opts: RunOptions): Promise<RunResult> {
    const promptFile = opts.logFile.replace(/\.log$/, "") + ".prompt.md";
    fs.mkdirSync(path.dirname(promptFile), { recursive: true });
    fs.writeFileSync(promptFile, opts.prompt);
    const id = randomUUID();
    const env = grokEnv(opts.env, opts.timeoutMs, opts.reader, opts.clean);
    // Its text comes in pieces; the last message (after the last tool call) is its answer.
    let said = "";
    const calls = new Map<string, string>();
    // its web tools' calls until they are done (a refused one fetched nothing)
    const web = new Map<string, AgentWeb>();
    const resume = (sid: string, message: string) => ({ args: grokArgs(opts, ["-p", message], ["--resume", sid]), input: "" });
    return runJsonLines("grok", grokArgs(opts, ["--prompt-file", promptFile], ["--session-id", id]), env, opts, resume, (msg, heard) => {
      heard.sessionId ??= id;
      const type = msg.type;
      if (type === "text" && typeof msg.data === "string") {
        said += msg.data;
        heard.text = said.trim();
      } else if (type === "tool_call") {
        if (said.trim()) opts.onProgress?.(said.trim().split("\n")[0]!.slice(0, 160));
        said = "";
        const what = describe(msg);
        if (typeof msg.toolCallId === "string") {
          // "Bash: ls", "web_fetch: https://…" (the tool's name once)
          const name = String(msg.toolName ?? "tool");
          const shown = what.startsWith(`${name} `) ? what.slice(name.length + 1) : what.replace(/^\$ /, "");
          calls.set(msg.toolCallId, `${name === "run_terminal_command" ? "Bash" : name}: ${shown.slice(0, 120)}`);
        }
        const w = webUse(msg.toolName, msg.rawInput as Record<string, unknown> | undefined, GROK_WEB);
        // with its id: the tree's hook (.grok/hooks/strom.json) records the same call by it — counted once
        if (w && typeof msg.toolCallId === "string") web.set(msg.toolCallId, { ...w, toolUse: msg.toolCallId });
        else if (w) tellWeb(opts, w);
        opts.onProgress?.(what);
      } else if (type === "tool_call_update" && msg.status === "failed") {
        // Refused by the rules ("Denied by permission policy"), by dontAsk ("User cancelled the execution"), or by a hook
        // ("Hook denied: …") — strom's own (its web limits: "Hook denied: strom: …") said apart from the permissions
        const content = JSON.stringify(msg.content ?? "");
        const what = calls.get(String(msg.toolCallId)) ?? "tool";
        const byStrom = refusedByStrom(content);
        const refused = byStrom || /denied by permission|permission policy|user cancelled|not allowed|hook denied/i.test(content);
        if (byStrom) (heard.refused ??= []).push(what);
        else if (refused) heard.denied.push(what);
        // a page that failed was asked of its host all the same; a refused one never left
        const w = web.get(String(msg.toolCallId));
        web.delete(String(msg.toolCallId));
        if (w && !refused) tellWeb(opts, w);
      } else if (type === "tool_call_update" && msg.status === "completed") {
        const w = web.get(String(msg.toolCallId));
        web.delete(String(msg.toolCallId));
        if (w) tellWeb(opts, w);
      } else if (type === "usage") {
        // one model response: its tokens (input is what the cache did not hold) — the context of the request is its
        // input, the cache read and the cache written together, so the series shows the context and its clears
        const u = (msg.usage ?? {}) as Record<string, unknown>;
        const inp = usageNumber(u.input_tokens);
        const cr = usageNumber(u.cache_read_input_tokens);
        const cw = usageNumber(u.cache_creation_input_tokens);
        // (its output_tokens hold its reasoning_tokens already: never added again)
        const out = usageNumber(u.output_tokens);
        const ctxParts = [inp, cr, cw].filter((n): n is number => n !== undefined);
        tellUsage(opts, { in: inp, out, cr, cw, ...(ctxParts.length ? { ctx: ctxParts.reduce((a, b) => a + b, 0) } : {}) });
        // (a process stopped before its end keeps these: each response one of its turns, as its end counts them)
        heardResponse(heard, { in: inp, out, cr, cw }, true);
      } else if (type === "end") {
        heard.ended = true;
        if (typeof msg.sessionId === "string") heard.sessionId = msg.sessionId;
        const u = (msg.usage ?? {}) as Record<string, number>;
        const m = heard.metrics;
        // (a resumed session adds its own)
        m.inputTokens = (m.inputTokens ?? 0) + (u.input_tokens ?? 0);
        m.outputTokens = (m.outputTokens ?? 0) + (u.output_tokens ?? 0); // its reasoning_tokens are a part of them
        m.cacheReadTokens = (m.cacheReadTokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        if (usageNumber(u.cache_creation_input_tokens) !== undefined) m.cacheWriteTokens = (m.cacheWriteTokens ?? 0) + u.cache_creation_input_tokens!;
        if (typeof msg.num_turns === "number") m.turns = (m.turns ?? 0) + msg.num_turns;
        // A cost only when Grok knows it whole (a subscription often does not say it).
        if (typeof msg.total_cost_usd === "number") m.costUsd = (m.costUsd ?? 0) + msg.total_cost_usd;
        else if (msg.cost_is_partial === true || msg.usage_is_incomplete === true) m.costPartial = true;
        const models = Object.keys((msg.modelUsage ?? {}) as object);
        if (models[0]) m.model = models[0];
        // the whole run's use besides the series of its responses (above); a cost only when it knows it
        tellUsage(opts, { agentSession: heard.sessionId, ...(models[0] ? { model: models[0] } : {}) });
        const out = usageNumber(u.output_tokens);
        const cw = usageNumber(u.cache_creation_input_tokens);
        if (usageNumber(u.input_tokens) !== undefined || out !== undefined || usageNumber(u.cache_read_input_tokens) !== undefined || cw !== undefined || usageNumber(msg.total_cost_usd) !== undefined)
          tellUsage(opts, { total: true, in: usageNumber(u.input_tokens), out, cr: usageNumber(u.cache_read_input_tokens), cw, usd: usageNumber(msg.total_cost_usd), turns: usageNumber(msg.num_turns), ...(models[0] ? { model: models[0] } : {}) });
        if (msg.stopReason === "refusal") heard.isError = true;
      } else if (type === "error") {
        heard.isError = true;
        heard.text = String(msg.message ?? "error");
      }
    }, { totalsAtEnd: true });
  },
};
