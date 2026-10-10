// The delegates strom defines for an agent (Claude Code's strom-scan-reader, agents/scanreader.ts) run on the model strom
// set for them: the person's model.vision, else "inherit" — the model of the agent that starts them. Which model reads
// old handwriting is the person's choice, never the agent's (found in a live run: the main agent on opus called the
// scan reader with its own `model: "sonnet"`). The tree's Claude Code settings run `strom agents delegate --hook` before
// each call of its subagent tool (Task, later Agent): a call naming a strom delegate and another model is refused, with
// the way on (the same call without `model`); a call without one, with the same model, or of a subagent strom did not
// define is left alone. Anything wrong lets the call go — the hook is never in the way by itself.

import fs from "node:fs";
import path from "node:path";
import { Settings } from "./config.ts";
import { currentSession } from "./session.ts";
import { findTreeUpwards, Tree } from "./tree.ts";
import { calibrationKey, loadAliases, resolveKey, splitKey, type Aliases } from "./modelkey.ts";
import type { Env } from "./paths.ts";
import { SCAN_READER, scanReaderModel } from "../agents/scanreader.ts";
import { treeHookCommand } from "./web.ts";

/** Claude Code's subagent tool, by both names it has had. */
export const DELEGATE_TOOLS = ["Task", "Agent"] as const;

/** The hook's own time limit in the agent's settings (seconds): it reads a little and answers at once. */
export const DELEGATE_HOOK_TIMEOUT_S = 15;

/** The delegates strom defines for Claude Code (the subagent types of the tree's .claude/agents and of a run's --agents). */
export const STROM_DELEGATES: readonly string[] = [SCAN_READER];

/** One call of the subagent tool, as the hook gets it. */
export interface DelegateEvent {
  tool: string;
  subagent: string;
  /** The model the call names (none: the delegate's own). */
  model?: string;
  cwd?: string;
  transcript?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** The agent's hook event on stdin: a call of Claude Code's subagent tool before it runs, else undefined. */
export function delegateEvent(text: string): DelegateEvent | undefined {
  let j: Record<string, unknown>;
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    j = v as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const tool = str(j.tool_name);
  if (!tool || !(DELEGATE_TOOLS as readonly string[]).includes(tool)) return undefined;
  const event = str(j.hook_event_name);
  if (event && event !== "PreToolUse") return undefined;
  const input = j.tool_input && typeof j.tool_input === "object" ? (j.tool_input as Record<string, unknown>) : {};
  const subagent = str(input.subagent_type);
  if (!subagent) return undefined;
  const ev: DelegateEvent = { tool, subagent };
  const model = str(input.model);
  if (model) ev.model = model;
  const cwd = str(j.cwd);
  if (cwd) ev.cwd = cwd;
  const transcript = str(j.transcript_path);
  if (transcript) ev.transcript = transcript;
  return ev;
}

/** The last model the main agent ran on, from the tail of its transcript (Claude Code's JSONL); none found: undefined. */
export function transcriptModel(file: string | undefined, tail = 512 * 1024): string | undefined {
  if (!file || !file.endsWith(".jsonl")) return undefined;
  let text: string;
  try {
    const fd = fs.openSync(file, "r");
    try {
      const size = fs.fstatSync(fd).size;
      const start = Math.max(0, size - tail);
      const buf = Buffer.alloc(size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      text = buf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return undefined;
  }
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (!line.includes('"assistant"') || !line.includes('"model"')) continue;
    try {
      const r = JSON.parse(line) as { type?: unknown; isSidechain?: unknown; message?: { model?: unknown } };
      if (r.type !== "assistant" || r.isSidechain === true) continue;
      const m = str(r.message?.model);
      if (m && !m.startsWith("<")) return m;
    } catch {
      // the first line of the tail, cut: the ones after it said nothing
    }
  }
  return undefined;
}

/** A family alias of Claude Code's (no digits: opus, sonnet, haiku) stands for a model whose name holds it as a word. */
const familyOf = (alias: string, model: string) => !/\d/.test(alias) && model.split(/[-_.\s/]+/).includes(alias);

/** Whether two names of a model are the same model: one key (an alias resolved to what it ran on), or an alias of the other's family. */
export function sameModel(agent: string, a: string, b: string, aliases: Aliases = {}): boolean {
  const ka = resolveKey(calibrationKey(agent, a), aliases);
  const kb = resolveKey(calibrationKey(agent, b), aliases);
  if (ka === kb) return true;
  const ma = splitKey(ka).model ?? "";
  const mb = splitKey(kb).model ?? "";
  // an alias nobody saw run yet: its family's name in the other ("opus" of "claude-opus-5-5")
  const ra = splitKey(calibrationKey(agent, a)).model ?? "";
  const rb = splitKey(calibrationKey(agent, b)).model ?? "";
  return (ra === ma && familyOf(ra, mb)) || (rb === mb && familyOf(rb, ma));
}

/** The hook's answer: nothing (the call goes on), or refused with the reason the agent reads. */
export interface DelegateAnswer {
  decision?: "deny";
  reason?: string;
}

/** The model strom set for a delegate of this tree: the person's model.vision, else "inherit". */
export function delegateModel(tree: Tree, subagent: string): string {
  return subagent === SCAN_READER ? (scanReaderModel(tree, "claude") ?? "inherit") : "inherit";
}

/** Answer one call of the subagent tool (never fails: anything wrong is no answer). */
export function answerDelegateEvent(ev: DelegateEvent, o: { env: Env; cwd: string }): DelegateAnswer {
  if (!ev.model || !STROM_DELEGATES.includes(ev.subagent)) return {};
  const root = findTreeUpwards(ev.cwd && path.isAbsolute(ev.cwd) ? ev.cwd : o.cwd);
  if (!root) return {};
  const tree = Tree.open(root, o.env);
  const set = delegateModel(tree, ev.subagent);
  const aliases = loadAliases(root);
  let expected: string | undefined = set;
  if (set === "inherit") {
    if (ev.model.toLowerCase() === "inherit") return {};
    // the model of the agent that starts it: what it runs on (its transcript), else what strom started it with
    expected =
      transcriptModel(ev.transcript) ??
      new Settings(o.env, {}).resolve("model.lead", tree.config, "claude")?.value?.toString() ??
      currentSession(tree, o.env)?.model;
  }
  if (expected && sameModel("claude", ev.model, expected, aliases)) return {};
  const on = set === "inherit" ? `the model you run on${expected ? ` (${expected})` : ""}` : `${set} (model.vision)`;
  return {
    decision: "deny",
    reason:
      `strom: ${ev.subagent} reads on the model strom set for it — ${on}, not ${ev.model}. Which model reads old handwriting is the user's choice (model.vision), never the agent's. ` +
      `Call it again the same way without \`model\`.`,
  };
}

/** The hook's answer as Claude Code reads it on stdout; none: nothing at all. */
export function delegateHookOutput(a: DelegateAnswer): string {
  if (!a.decision) return "";
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: a.decision, permissionDecisionReason: a.reason ?? "" } });
}

/** Claude Code's hook of the tree (its .claude/settings.json) before each call of its subagent tool, by both its names. */
export function claudeDelegateHooks(root: string, platform: NodeJS.Platform = process.platform): { PreToolUse: Record<string, unknown>[] } {
  const { command, shell } = treeHookCommand(root, "agents delegate --hook", platform);
  return { PreToolUse: [{ matcher: DELEGATE_TOOLS.join("|"), hooks: [{ type: "command", command, timeout: DELEGATE_HOOK_TIMEOUT_S, ...(shell ? { shell } : {}) }] }] };
}
