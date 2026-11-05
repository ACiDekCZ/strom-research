// OpenAI Codex CLI runner. Headless: `codex exec --json` in the tree folder
// with the brief on stdin. The user's level decides the sandbox: ask and auto
// work in Codex's sandbox on the tree folder (its .git and the shared folder
// writable too, the network on — strom fetches), where what the sandbox refuses simply fails —
// nothing asks, as with Claude Code's dontAsk; full runs without the sandbox.
// Interactive conversations are started by strom chat (agents/launch.ts).

import fs from "node:fs";
import path from "node:path";
import { runJsonLines, type Heard } from "./jsonl.ts";
import { commandLine, looksLikeLimit, shellUnwrapped, usageNumber, tellUsage, tellWeb, type RunOptions, type RunResult, type Runner } from "./runner.ts";
import type { AgentWeb } from "../core/metrics.ts";
import { codexConfigFile, codexModel, effortArgs } from "../agents/effort.ts";
import { CODEX_BROWSER_SERVERS } from "../core/browser.ts";
import { isolated, type Env } from "../core/paths.ts";
import { inRoom, readerRoom } from "./room.ts";
import { refusalMark, SANDBOX_REFUSAL } from "../core/writable.ts";

/**
 * What Codex's sandbox lets it write besides the tree folder: the tree's .git — its sandbox keeps a .git
 * read-only even inside the folder it works in, and every change strom makes is a commit (found live:
 * `strom session note` failed on .git/index.lock) — and the shared folder (inbox, plugins).
 */
export function codexWritable(root: string, shared: string | undefined): string[] {
  return ["-c", `sandbox_workspace_write.writable_roots=${JSON.stringify([path.join(root, ".git"), ...(shared ? [shared] : [])])}`];
}

/**
 * A reader's sandbox: the folder of its report the one place it writes besides the folder it works in (found live: the
 * report in the tree's notes/readings was refused, "writing outside of the project"), and no network — it reads the
 * views it is given, it fetches nothing. Whatever the person's level: a reader opens its views and writes its report.
 * Its report is in its room (runners/room.ts), a folder that holds it alone — never notes/readings itself, where the
 * reports and results of every other reading are.
 */
export function codexReaderWritable(files: NonNullable<RunOptions["readerFiles"]>): string[] {
  return ["-c", `sandbox_workspace_write.writable_roots=${JSON.stringify([path.dirname(path.resolve(files.report))])}`];
}

/**
 * The folder Codex works in, trusted for this process alone in an isolated installation: a session Codex starts in a
 * folder its config does not trust it records as trusted in ~/.codex/config.toml (`[projects."<folder>"]`, found
 * after headless runs) — once per tree in a regular installation; an isolated one writes nothing of the agents'
 * (core/paths.ts), so the folder comes trusted in Codex's configuration for this run (`-c`, nothing written), as
 * written and as the system resolves it (/tmp → /private/tmp).
 */
export function codexTrust(env: Env, cwd: string): string[] {
  if (!isolated(env)) return [];
  let real = cwd;
  try {
    real = fs.realpathSync(cwd);
  } catch {
    // not there (yet): as written
  }
  const folders = [...new Set([path.resolve(cwd), real])];
  return ["-c", `projects={${folders.map((f) => `${JSON.stringify(f)}={trust_level="trusted"}`).join(",")}}`];
}

/**
 * Working alone without the user's add-ons (agent.addons off): Codex's plugins (and the MCP servers they bring), its
 * apps, the user's hooks and memories off for this run — the user's own config, model and login kept (never
 * --ignore-user-config: it drops the model and effort too). An MCP server of the user's own config stays: Codex has no
 * switch for all of them — but its desktop app's browser and computer use (codexBrowserOff).
 */
export const CODEX_CLEAN = ["-c", "features.plugins=false", "-c", "features.apps=false", "-c", "features.hooks=false", "-c", "features.memories=false"] as const;

/**
 * The browser and the computer use the Codex desktop app adds to the user's own config (MCP servers `node_repl` —
 * its in-app browser and Chrome extension — and `computer-use`), off with the user's add-ons: strom keeps no hook before
 * them (an archive only a person's browser goes to stays the person's). Only those the config names: a server it does
 * not name, switched off on the command line, stops Codex ("invalid transport", checked with 0.155.1). Read only.
 * With the user's add-ons (a conversation, a run with agent.addons on) they stay as the user has them.
 */
export function codexBrowserOff(env: Env | undefined): string[] {
  if (!env) return [];
  let text: string;
  try {
    text = fs.readFileSync(codexConfigFile(env), "utf8");
  } catch {
    return [];
  }
  const named = new Set<string>();
  for (const m of text.matchAll(/^\s*\[\s*mcp_servers\s*\.\s*(?:"([^"\n]+)"|'([^'\n]+)'|([A-Za-z0-9_-]+))\s*\]/gmu)) named.add(m[1] ?? m[2] ?? m[3]!);
  return CODEX_BROWSER_SERVERS.filter((n) => named.has(n)).flatMap((n) => ["-c", `mcp_servers.${n}.enabled=false`]);
}

/** Command-line arguments of a headless run (exported for tests). */
export function codexArgs(opts: Pick<RunOptions, "model" | "effort" | "extraArgs" | "permissions" | "shared" | "cwd" | "clean"> & Partial<Pick<RunOptions, "env" | "readerFiles">>): string[] {
  const sandbox = opts.readerFiles
    ? ["--sandbox", "workspace-write", ...codexReaderWritable(opts.readerFiles)]
    : opts.permissions === "full"
      ? ["--dangerously-bypass-approvals-and-sandbox"]
      : ["--sandbox", "workspace-write", "-c", "sandbox_workspace_write.network_access=true", ...codexWritable(opts.cwd, opts.shared)];
  return ["exec", "--json", "--skip-git-repo-check", ...sandbox, ...codexTrust(opts.env ?? {}, opts.cwd), ...(opts.clean ? [...codexBrowserOff(opts.env), ...CODEX_CLEAN] : []), ...(opts.model ? ["--model", opts.model] : []), ...effortArgs("codex", opts.effort), ...(opts.extraArgs ?? []), "-"];
}

/**
 * Arguments that resume a headless session with a message on stdin (exported for tests). `exec resume` has no
 * --sandbox or --add-dir: the same sandbox is set through its configuration.
 */
export function codexResumeArgs(id: string, opts: Pick<RunOptions, "model" | "effort" | "permissions" | "shared" | "cwd" | "clean"> & Partial<Pick<RunOptions, "env" | "readerFiles">>): string[] {
  const sandbox = opts.readerFiles
    ? ["-c", 'sandbox_mode="workspace-write"', ...codexReaderWritable(opts.readerFiles)]
    : opts.permissions === "full"
      ? ["--dangerously-bypass-approvals-and-sandbox"]
      : ["-c", 'sandbox_mode="workspace-write"', "-c", "sandbox_workspace_write.network_access=true", ...codexWritable(opts.cwd, opts.shared)];
  return ["exec", "resume", "--json", "--skip-git-repo-check", ...sandbox, ...codexTrust(opts.env ?? {}, opts.cwd), ...(opts.clean ? [...codexBrowserOff(opts.env), ...CODEX_CLEAN] : []), ...(opts.model ? ["--model", opts.model] : []), ...effortArgs("codex", opts.effort), id, "-"];
}

/**
 * The agent's steps as Codex reports its items: each message and each tool it called. `exec` runs a whole session as
 * one turn, so its turns say nothing of the work — its steps are counted as the session's turns (none said: unknown).
 */
const STEPS = new Set(["agent_message", "command_execution", "file_change", "mcp_tool_call", "web_search", "collab_tool_call"]);

/**
 * What Codex's web search did, from its item (codex 0.155 `exec --json`: a web_search item with its query, and an action
 * as its Responses API says it — search, open_page with its url, find_in_page): a page it opened is a request to that
 * host, a search a search; a find in a page already opened asks nothing more. Exported for tests.
 */
export function codexWeb(item: Record<string, unknown> | undefined): AgentWeb | undefined {
  if (item?.type !== "web_search") return undefined;
  const action = (item.action ?? {}) as { type?: unknown; url?: unknown };
  if (action.type === "find_in_page") return undefined;
  if (action.type === "open_page") return typeof action.url === "string" && action.url ? { via: "web", url: action.url, tool: "web_search" } : undefined;
  return { via: "search", tool: "web_search" };
}

/**
 * strom's own refusal under an agent in what a command printed with the exit code 0 (strom in a pipe: the code is the
 * last program's) — only with the mark of the session it ran in (`<SANDBOX_REFUSAL> (strom session N0042)`,
 * refusalMark): the words quoted — a session's summary in the next strom brief or session show, a note, strom grep,
 * cat, echo — carry another session's mark or none, whatever their lines look like (#8, found 2026-11-05: an agent
 * summed up a refusal in its words, and the next session's strom brief stopped the run). The mark is read in whatever
 * shape a pipe gives strom's error — plain, --json, `jq .` or `jq -r .message`, Windows PowerShell 5.1's own
 * (`strom.cmd : error: …`, wrapped at the console's width: the lines joined again), a dash spoiled by the console's
 * code page (the sentence and the mark are ASCII). No session (a run strom did not start): no refusal read here.
 */
export function codexRefusedStrom(output: string, session: string | undefined): boolean {
  const mark = refusalMark(session);
  return !!mark && output.replace(/\r?\n/g, "").includes(`${SANDBOX_REFUSAL} ${mark}`);
}

/**
 * One string as Rust's Debug writes it (`"…"` with `\"`, `\\`, `\n`, `\u{…}`), read from its opening quote at `at`:
 * its text and where it ended — undefined when it does not end (a line cut short).
 */
function debugString(s: string, at: number): { text: string; end: number } | undefined {
  if (s[at] !== '"') return undefined;
  let text = "";
  for (let i = at + 1; i < s.length; i++) {
    const c = s[i]!;
    if (c === '"') return { text, end: i + 1 };
    if (c !== "\\") {
      text += c;
      continue;
    }
    const e = s[++i];
    if (e === undefined) return undefined;
    if (e === "u") {
      const u = /^\{([0-9a-fA-F]{1,6})\}/u.exec(s.slice(i + 1));
      if (!u) return undefined;
      text += String.fromCodePoint(parseInt(u[1]!, 16));
      i += u[0].length;
    } else text += ({ n: "\n", r: "\r", t: "\t", "0": "\0" } as Record<string, string>)[e] ?? e;
  }
  return undefined;
}

/**
 * A command line as Codex renders it (the shlex crate's join: words '…'-quoted, or "…"-quoted with \ before $ ` " \
 * where a backslash keeps single quotes out — Windows paths) split into its words again.
 */
function shlexWords(line: string): string[] {
  const words: string[] = [];
  let word: string | undefined;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (/\s/u.test(c)) {
      if (word !== undefined) words.push(word);
      word = undefined;
    } else if (c === "'") {
      const close = line.indexOf("'", i + 1);
      if (close < 0) return [];
      word = (word ?? "") + line.slice(i + 1, close);
      i = close;
    } else if (c === '"') {
      word ??= "";
      for (i++; i < line.length && line[i] !== '"'; i++) word += line[i] === "\\" && i + 1 < line.length ? line[++i] : line[i];
      if (i >= line.length) return [];
    } else word = (word ?? "") + (c === "\\" && i + 1 < line.length ? line[++i] : c);
  }
  if (word !== undefined) words.push(word);
  return words;
}

/**
 * A command Codex's own policy refused before it ran, as Codex alone says it — a line of its log on its stderr, never a
 * command_execution item, never what a command printed or the agent wrote (codex-cli 0.166.0 on Windows, found
 * 2026-11-05):
 *   `<time> ERROR codex_core::tools::router: error=exec_command failed: CreateProcess { message: "Rejected(\"`<the
 *   command, its shell around it>` rejected: blocked by policy\")" }`
 * "Blocked by policy" is an approval nobody gives in `codex exec`: with Codex's own Windows sandbox not in use (as where
 * it was found) every part of a command no rule allows is refused — `strom.cmd … | Select-Object`, `Set-Location .; strom.cmd …`:
 * the rule lets strom run, the part after it is refused, and so the whole command (Codex's exec_policy.rs,
 * render_decision_for_unmatched_command). A refusal by a rule of its own (strom's `git`, `strom login`, the person's:
 * its justification) or of Codex's `rm -f` is what the rules say: no such refusal here. The command as the agent meant
 * it (its shell around it taken off); undefined: no such line.
 */
export function codexPolicyRejected(line: string): string | undefined {
  const clean = line.replace(/\u001b\[[0-9;]*m/gu, "");
  const at = /^\s*(?:\S+\s+)?ERROR\s+codex_core::tools::router:\s+error=[\p{L}\p{N}_.-]+ failed: CreateProcess \{ message: "/u.exec(clean);
  if (!at) return undefined;
  const outer = debugString(clean, at.index + at[0].length - 1);
  if (!outer || !/^\s*\}\s*$/u.test(clean.slice(outer.end)) || !outer.text.startsWith('Rejected("')) return undefined;
  const reason = debugString(outer.text, "Rejected(".length);
  if (!reason || outer.text.slice(reason.end) !== ")") return undefined;
  const said = /^`([\s\S]+)` rejected: blocked by policy$/u.exec(reason.text);
  if (!said) return undefined;
  const words = shlexWords(said[1]!);
  // the agent's own command: what its shell was given (-Command, -c, /c, -lc), else the words as they are
  const flag = words.findIndex((w, i) => i > 0 && /^(?:-(?:command|c|lc)|\/[ck])$/iu.test(w));
  const command = flag > 0 && flag < words.length - 1 ? words.slice(flag + 1).join(" ") : words.length ? words.join(" ") : said[1]!;
  return shellUnwrapped(command);
}

/** The error Codex said last, kept when an earlier one said the plan's limit (the later one may only say the turn failed). */
function failure(said: string, had: string): string {
  return looksLikeLimit(had).limit && !looksLikeLimit(said).limit ? had : said || had;
}

export const codexRunner: Runner = {
  id: "codex",
  command: "codex",
  run(opts: RunOptions): Promise<RunResult> {
    // a reader writes its report in its room, a folder of its own (mirrored to its report as it goes)
    return opts.readerFiles ? inRoom(readerRoom(opts, { report: true }), runCodex) : runCodex(opts);
  },
};

/** A run of Codex, a reader's in its room. */
function runCodex(opts: RunOptions): Promise<RunResult> {
  const resume = (id: string, message: string) => ({ args: codexResumeArgs(id, opts), input: message });
  // the model it runs on as strom knows it (Codex says none): started with, else its config.toml's
  const model = codexModel(opts.env, opts.model, opts.extraArgs);
  // the steps since the use was said last (each sample carries its own)
  let steps = 0;
  // A turn's use: Codex says it at the turn's end (turn.completed; a failed turn only if it carries one — 0.155 does not).
  const used = (u: Record<string, number>, heard: Heard) => {
    const m = heard.metrics;
    m.inputTokens = (m.inputTokens ?? 0) + (u.input_tokens ?? 0);
    m.outputTokens = (m.outputTokens ?? 0) + (u.output_tokens ?? 0);
    m.cacheReadTokens = (m.cacheReadTokens ?? 0) + (u.cached_input_tokens ?? 0);
    // a turn's use as a whole — exec runs the session as one turn of many requests, so its input is the sum of theirs,
    // never a context: no ctx (a resumed turn's smaller sum would read as the context cleared); no cost said
    tellUsage(opts, { total: true, in: usageNumber(u.input_tokens), cr: usageNumber(u.cached_input_tokens), out: usageNumber(u.output_tokens), turns: steps || undefined });
    steps = 0;
  };
  // a command its policy refused before it ran is said on its stderr alone (codexPolicyRejected): counted like a denial —
  // strom's own command so refused stops the run as its sandbox's refusal does (#8: on Windows Codex runs every command
  // through PowerShell, and strom in a pipe, after `;` or `&` was refused so — the run went on and put its tasks aside)
  const stderrLine = (line: string, heard: Heard) => {
    const command = codexPolicyRejected(line);
    if (command === undefined) return;
    // refused whole before any of it ran: strom counts refused in any part of it (deniedStrom's `whole`)
    (heard.deniedWhole ??= []).push(heard.denied.length);
    heard.denied.push(`Bash: ${command.slice(0, 120)}`);
  };
  return runJsonLines("codex", codexArgs(opts), opts.env, opts, resume, (msg, heard) => {
    if (msg.type === "thread.started" && typeof msg.thread_id === "string") {
      heard.sessionId = msg.thread_id;
      // its stream names no model: the one strom knows it runs on is the session's (the measure of the reading goes by it)
      if (model) heard.metrics.model = model;
      tellUsage(opts, { agentSession: msg.thread_id, ...(model ? { model } : {}) });
    }
    const item = msg.item as { type?: string; text?: string; command?: string; exit_code?: number | null; aggregated_output?: string; status?: string } | undefined;
    if (msg.type === "item.started" && item?.type === "command_execution" && item.command) opts.onProgress?.(commandLine(shellUnwrapped(item.command)));
    if (msg.type === "item.completed" && item?.type === "agent_message" && item.text) {
      heard.text = item.text;
      opts.onProgress?.(item.text.trim().split("\n")[0]!.slice(0, 160));
    }
    // The sandbox refused a command (a write outside the tree, .git closed, the network off — strom's own refusal says
    // "sandbox", Windows "access is denied"), or Codex did not run it (its rules, an approval nobody gives in exec:
    // "declined"): counted like a denial, the command as the agent meant it (its shell around it taken off). strom's own
    // refusal under an agent counts with the exit code 0 too: in a pipe (`strom … | cat`, `| Select-Object`) the code
    // is the last program's — but then only strom's error with this session's mark, never its words quoted
    // (codexRefusedStrom). (Codex's exec_command gives no item of a command its policy refused before it ran — said on
    // its stderr alone: stderrLine above — nor of one its sandbox stopped within 150 ms; strom itself starts slower and
    // is always said.)
    if (
      msg.type === "item.completed" &&
      item?.type === "command_execution" &&
      (item.status === "declined" ||
        (item.exit_code !== 0 && ((item.aggregated_output ?? "").includes(SANDBOX_REFUSAL) || /operation not permitted|sandbox|read-only file system|access (?:to the path .{1,200} )?is denied/i.test(item.aggregated_output ?? ""))) ||
        (item.exit_code === 0 && codexRefusedStrom(item.aggregated_output ?? "", opts.env?.STROM_SESSION)))
    )
      heard.denied.push(`Bash: ${shellUnwrapped(String(item.command ?? "")).slice(0, 120)}`);
    // its web search, once its item is done (counted after the fact: core/metrics.ts)
    if (msg.type === "item.completed") {
      const w = codexWeb(msg.item as Record<string, unknown> | undefined);
      if (w) tellWeb(opts, w);
    }
    if (msg.type === "item.completed" && item?.type && STEPS.has(item.type)) {
      steps++;
      heard.metrics.turns = (heard.metrics.turns ?? 0) + 1;
    }
    if (msg.type === "turn.completed") used((msg.usage ?? {}) as Record<string, number>, heard);
    if (msg.type === "turn.failed" && msg.usage && typeof msg.usage === "object") used(msg.usage as Record<string, number>, heard);
    else if (msg.type === "turn.failed") {
      // the failed turn's use is not said (a plan's limit, an error of the service): more was used than is known
      heard.metrics.costPartial = true;
      tellUsage(opts, { turns: steps || undefined, partial: true });
      steps = 0;
    }
    if (msg.type === "turn.failed" || msg.type === "error") {
      heard.isError = true;
      const e = msg.error as { message?: string } | undefined;
      heard.text = failure(String(e?.message ?? msg.message ?? ""), heard.text);
    }
  }, { stderrLine });
}
