// The reasoning effort of the agent's model — how long it thinks before it answers — the person's choice for the
// sessions strom starts (model.effort, kept per agent like the models: strom run, strom chat, the readers), passed as
// the agent's own switch for that session alone: Codex `-c model_reasoning_effort="…"`, Claude Code and Antigravity
// `--effort`, Grok `--reasoning-effort`. OpenCode has no level of its own (a variant goes with its model:
// provider/model#high in model.lead). Unset: what the agent's own settings say holds — Codex's config.toml is read
// (top level and the profile it selects, CODEX_HOME respected) and said, never written.

import fs from "node:fs";
import path from "node:path";
import { userHome, type Env } from "../core/paths.ts";

/** The levels each agent takes (its own --help; Codex: its config's values). */
export const EFFORTS: Record<string, readonly string[]> = {
  codex: ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"],
  claude: ["low", "medium", "high", "xhigh", "max"],
  antigravity: ["low", "medium", "high", "xhigh", "max"],
  grok: ["low", "medium", "high", "xhigh", "max"],
};

/** Every level any agent takes (a value of model.effort is checked against its agent's when the agent is known). */
export const ALL_EFFORTS: readonly string[] = [...new Set(Object.values(EFFORTS).flat())];

/** What strom recommends: old handwriting read with the best setting a session can afford (the plan's limit runs out sooner). */
export const RECOMMENDED_EFFORT = "high";

/** The levels offered to a person, the recommended first. */
export function offeredEfforts(agent: string): string[] {
  const own = EFFORTS[agent] ?? [];
  return ["high", "xhigh", "medium", "low"].filter((e) => own.includes(e));
}

/** Whether strom can set this agent's effort. */
export function hasEffort(agent: string): boolean {
  return !!EFFORTS[agent];
}

/** The levels from the least thinking to the most: a higher one uses up a plan's limits sooner. */
const EFFORT_ORDER: readonly string[] = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"];

/** What a session runs with where neither strom nor the agent's own settings say a level: the agents' usual default. */
const USUAL_EFFORT = "medium";

/**
 * Whether `next` makes the sessions think more than `now` (each undefined: the agent's own setting, `own` when strom
 * knows it, else the agents' usual default) — raising it is the person's decision alone, lowering it anyone's.
 */
export function raisesEffort(next: string | undefined, now: string | undefined, own?: string): boolean {
  const rank = (e: string | undefined) => EFFORT_ORDER.indexOf((e ?? own ?? USUAL_EFFORT).toLowerCase());
  return rank(next) > rank(now);
}

/** The level a session's own extra arguments set (Codex `-c model_reasoning_effort=…`, `--effort`, `--reasoning-effort`). */
export function effortInArgs(agent: string, extra: readonly string[] | undefined): string | undefined {
  if (agent === "codex") return codexEffortArg(extra);
  const flag = agent === "grok" ? "--reasoning-effort" : agent === "claude" || agent === "antigravity" ? "--effort" : undefined;
  if (!flag || !extra) return undefined;
  let found: string | undefined;
  for (let i = 0; i < extra.length; i++) {
    if (extra[i] === flag && extra[i + 1]) found = extra[i + 1];
    else if (extra[i]!.startsWith(`${flag}=`)) found = extra[i]!.slice(flag.length + 1);
  }
  return found?.trim() || undefined;
}

/** The agent's own setting for its effort where strom knows it (Codex's config.toml; read only). */
export function ownEffort(env: Env, agent: string): string | undefined {
  return agent === "codex" ? readCodexConfig(env).effort : undefined;
}

/** The agent's own switch for a session's effort (none: the agent's own settings hold). */
export function effortArgs(agent: string, effort: string | undefined): string[] {
  if (!effort || !EFFORTS[agent]?.includes(effort)) return [];
  if (agent === "codex") return ["-c", `model_reasoning_effort=${JSON.stringify(effort)}`];
  if (agent === "grok") return ["--reasoning-effort", effort];
  return ["--effort", effort];
}

/** What Codex's own config.toml says of the model and its effort (read only). */
export interface CodexConfig {
  file: string;
  /** The profile it selects (`profile = "…"`, or --profile of the session). */
  profile?: string;
  model?: string;
  effort?: string;
  /** Where each came from: the profile's table or the top level. */
  modelFrom?: "profile" | "top";
  effortFrom?: "profile" | "top";
}

export function codexConfigFile(env: Env): string {
  return path.join(env.CODEX_HOME || path.join(userHome(env), ".codex"), "config.toml");
}

/** A TOML value of one line, as strom needs it: a string (basic or literal), else the bare word. */
function tomlValue(raw: string): string | undefined {
  const s = raw.trim();
  const q = /^"((?:[^"\\]|\\.)*)"/.exec(s) ?? /^'([^']*)'/.exec(s);
  if (q) return q[0]!.startsWith('"') ? q[1]!.replace(/\\(.)/g, "$1") : q[1];
  const bare = /^([^\s#]+)/.exec(s)?.[1];
  return bare;
}

/** The name of a table header: [profiles.fast], [profiles."my profile"] → ["profiles", "fast"]. */
function tableName(header: string): string[] {
  const parts: string[] = [];
  const re = /\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([^.\s"']+))\s*(?:\.|$)/gy;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header)) && m[0]) parts.push(m[1] ?? m[2] ?? m[3] ?? "");
  return parts;
}

/**
 * Codex's config.toml as far as the model and the effort go: the top-level `model`, `model_reasoning_effort` and
 * `profile`, and the selected profile's table `[profiles.<name>]` (which wins). `profile`: one the session selects
 * itself (--profile). Nothing when there is no file.
 */
export function readCodexConfig(env: Env, profile?: string): CodexConfig {
  const file = codexConfigFile(env);
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return { file, ...(profile ? { profile } : {}) };
  }
  const top: Record<string, string> = {};
  const profiles = new Map<string, Record<string, string>>();
  let table: Record<string, string> | undefined = top;
  for (const line of text.split(/\r?\n/)) {
    const header = /^\s*\[\s*([^[\]]+?)\s*\]\s*(?:#.*)?$/.exec(line);
    if (header) {
      const name = tableName(header[1]!);
      if (name[0] === "profiles" && name.length === 2) {
        if (!profiles.has(name[1]!)) profiles.set(name[1]!, {});
        table = profiles.get(name[1]!);
      } else table = undefined;
      continue;
    }
    if (/^\s*\[\[/.test(line)) {
      table = undefined;
      continue;
    }
    const kv = /^\s*("[^"]*"|'[^']*'|[A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(line);
    if (!kv || !table) continue;
    const key = kv[1]!.replace(/^["']|["']$/g, "");
    const value = tomlValue(kv[2]!);
    if (value !== undefined && ["model", "model_reasoning_effort", "profile"].includes(key)) table[key] = value;
  }
  const chosen = profile ?? top.profile;
  const p = chosen ? profiles.get(chosen) : undefined;
  const out: CodexConfig = { file, ...(chosen ? { profile: chosen } : {}) };
  if (p?.model) Object.assign(out, { model: p.model, modelFrom: "profile" });
  else if (top.model) Object.assign(out, { model: top.model, modelFrom: "top" });
  if (p?.model_reasoning_effort) Object.assign(out, { effort: p.model_reasoning_effort, effortFrom: "profile" });
  else if (top.model_reasoning_effort) Object.assign(out, { effort: top.model_reasoning_effort, effortFrom: "top" });
  return out;
}

/** The profile a session selects itself among its extra arguments (strom run -- --profile fast). */
export function codexProfileArg(extra: readonly string[] | undefined): string | undefined {
  const a = extra ?? [];
  for (let i = 0; i < a.length; i++) {
    if ((a[i] === "--profile" || a[i] === "-p") && a[i + 1]) return a[i + 1];
    const m = /^--profile=(.+)$/.exec(a[i]!);
    if (m) return m[1];
  }
  return undefined;
}

/** A key one of the session's extra arguments sets itself (-c <key>=…, the last wins as in Codex): it wins over the rest. */
function codexConfigArg(extra: readonly string[] | undefined, key: string): string | undefined {
  const a = extra ?? [];
  let found: string | undefined;
  for (let i = 0; i < a.length; i++) {
    const kv = a[i] === "-c" || a[i] === "--config" ? a[i + 1] : /^--config=(.+)$/.exec(a[i]!)?.[1];
    const m = kv ? new RegExp(`^${key}\\s*=\\s*(.+)$`).exec(kv) : null;
    if (m) found = tomlValue(m[1]!);
  }
  return found;
}

/** The effort one of the session's extra arguments sets itself (-c model_reasoning_effort=…). */
export function codexEffortArg(extra: readonly string[] | undefined): string | undefined {
  return codexConfigArg(extra, "model_reasoning_effort");
}

/**
 * The model a Codex session runs on as strom knows it — Codex's stream names none: the one it was started with (strom's
 * --model, else one of the session's own arguments: --model, -m, -c model=…), else its config.toml's (the profile it
 * selects first); none known: undefined.
 */
export function codexModel(env: Env, model: string | undefined, extra: readonly string[] | undefined): string | undefined {
  const a = extra ?? [];
  let own: string | undefined;
  for (let i = 0; i < a.length; i++) {
    if ((a[i] === "--model" || a[i] === "-m") && a[i + 1]) own = a[i + 1];
    const m = /^--model=(.+)$/.exec(a[i]!);
    if (m) own = m[1];
  }
  // (strom's --model comes before the session's own arguments on the command line: theirs wins in Codex)
  return own ?? codexConfigArg(extra, "model") ?? model ?? readCodexConfig(env, codexProfileArg(extra)).model;
}

/** Where a session's model or effort comes from: strom's setting, the agent's own settings, its own default. */
export type EffortSource = "strom" | "args" | "config" | "profile" | "default";

/** What a session of this agent runs with, and from where (said in strom run, doctor and the run's log). */
export interface AgentSettingsSaid {
  agent: string;
  model?: string;
  modelFrom: EffortSource;
  effort?: string;
  effortFrom: EffortSource;
  /** The config file the agent's own values come from (Codex). */
  file?: string;
  profile?: string;
}

/**
 * The model and effort a session of `agent` runs with: strom's (the person's settings, passed as switches) first, a
 * session's own extra arguments, then the agent's own settings (Codex's config.toml), else the agent's own default.
 */
export function agentSettingsSaid(env: Env, agent: string, o: { model?: string | undefined; effort?: string | undefined; extraArgs?: readonly string[] | undefined }): AgentSettingsSaid {
  const out: AgentSettingsSaid = { agent, modelFrom: o.model ? "strom" : "default", effortFrom: o.effort ? "strom" : "default", ...(o.model ? { model: o.model } : {}), ...(o.effort ? { effort: o.effort } : {}) };
  if (agent !== "codex") return out;
  const fromArgs = codexEffortArg(o.extraArgs);
  if (fromArgs) Object.assign(out, { effort: fromArgs, effortFrom: "args" });
  const c = readCodexConfig(env, codexProfileArg(o.extraArgs));
  out.file = c.file;
  if (c.profile) out.profile = c.profile;
  if (!out.model && c.model) Object.assign(out, { model: c.model, modelFrom: c.modelFrom === "profile" ? "profile" : "config" });
  if (!out.effort && c.effort) Object.assign(out, { effort: c.effort, effortFrom: c.effortFrom === "profile" ? "profile" : "config" });
  return out;
}
