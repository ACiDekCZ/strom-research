// The strong models an agent can do the research with — offered in the setup wizard and the settings, the person
// picks one (or leaves it to the agent). Where the agent lists its models without a prompt (Antigravity's `agy
// models`, OpenCode's `opencode models`, Grok Build's `grok models`, Codex's `codex debug models`: its catalog for
// the account logged in), the strong ones are taken from that list; a list that cannot be had in a few seconds (offline,
// not logged in, another version) leaves a small built-in one. Nothing here runs a prompt or costs anything.

import fs from "node:fs";
import path from "node:path";
import type { Env } from "../core/paths.ts";
import { userHome } from "../core/paths.ts";
import { findAgent, withoutAgentMarks } from "../core/which.ts";
import { spawnAgent, stopTree } from "../runners/runner.ts";
import { PROFILES } from "./profiles.ts";

export interface ModelOption {
  /** What the agent takes (--model). */
  id: string;
  /** As the agent names it, when it says so ("Gemini 3.1 Pro (High)"). */
  label?: string;
}

export interface ModelChoices {
  /** Strong ones, the one to suggest first; at most three. */
  models: ModelOption[];
  /** "agent": from the agent's own list; "builtin": strom's list (the agent's could not be had). */
  source: "agent" | "builtin";
  /** The model the agent takes when it is given none, when it says so. */
  agentDefault?: string;
}

/** Claude Code: its aliases (always the newest of each line). */
const CLAUDE: ModelOption[] = [{ id: "opus" }, { id: "sonnet" }];

/**
 * When the agent's own list cannot be had: strong models each agent took when this was written (Codex with a ChatGPT
 * account: gpt-6-sol and gpt-6-astra are in its catalog, gpt-6.1-sol is refused; Antigravity: Gemini 3.1 Pro, Claude
 * Opus 4.6). A model it no longer takes is said by strom run (the agent refuses it).
 */
export const BUILTIN_MODELS: Record<string, ModelOption[]> = {
  claude: CLAUDE,
  codex: [{ id: "gpt-6-astra" }, { id: "gpt-6-sol" }],
  antigravity: [
    { id: "gemini-3.1-pro-high", label: "Gemini 3.1 Pro (High)" },
    { id: "claude-opus-4-6-thinking", label: "Claude Opus 4.6 (Thinking)" },
  ],
  opencode: [{ id: "openai/gpt-6-astra" }, { id: "openai/gpt-6-sol" }],
  grok: [{ id: "grok-4.7" }, { id: "grok-4.6" }],
};

/** How each agent lists its models (none: Claude Code — its aliases are the list). */
const LIST: Record<string, string[]> = {
  codex: ["debug", "models"],
  antigravity: ["models"],
  opencode: ["models"],
  grok: ["models"],
};

/** Words of a model's name (or its maker's description) that say it is the fast, cheap or small one. */
const WEAK = new Set([
  "flash", "mini", "nano", "haiku", "lite", "light", "small", "tiny", "instant", "fast", "ultrafast", "spark", "free", "oss",
  // a lower reasoning effort of a model (Antigravity: gemini-3.1-pro-low)
  "low", "medium",
  // OpenAI's lighter lines beside sol and astra
  "luna", "terra",
  "review", "auto",
]);
/** Words of a maker's description of a lighter or older model (Codex's catalog). */
const WEAK_ABOUT = new Set(["affordable", "easier", "efficient", "legacy", "older", "cheap", "lightweight", "balanced", "fast"]);
/** The strongest line of a maker, then the one below it. */
const TOP = new Set(["opus", "pro", "ultra", "astra", "max"]);
const HIGH = new Set(["sonnet", "sol"]);

function words(s: string): string[] {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** The version numbers in a model's name: gpt-6.1-sol → [6, 1], claude-opus-4-6 → [4, 6]. */
function version(id: string): number[] {
  const m = /\p{N}+(?:[.-]\p{N}+)*/u.exec(id.slice(id.lastIndexOf("/") + 1));
  return m ? m[0].split(/[.-]/).map(Number) : [];
}

function newer(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (b[i] ?? -1) - (a[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

/** The maker's line a model belongs to: openai/gpt-6-sol → openai/gpt, claude-opus-4-6 → claude. */
function family(id: string): string {
  const slash = id.lastIndexOf("/");
  return id.slice(0, slash + 1) + (words(id.slice(slash + 1))[0] ?? "");
}

/**
 * The strong models of a list, in the order to offer them: never a fast, small or cheap one; the strongest line of a
 * maker first (Opus, Pro, Astra), then the one below (Sonnet, Sol), then the rest; makers in the order the agent lists
 * them (its own first), the newest version first, at most two of one line, three in all.
 */
export function strongModels(list: (ModelOption & { about?: string })[], max = 3): ModelOption[] {
  const kept = list.filter((m) => !words(m.id).some((w) => WEAK.has(w)) && !words(m.label ?? "").some((w) => WEAK.has(w)) && !words(m.about ?? "").some((w) => WEAK_ABOUT.has(w)));
  const tier = (m: ModelOption) => {
    const w = [...words(m.id), ...words(m.label ?? "")];
    return w.some((x) => TOP.has(x)) ? 2 : w.some((x) => HIGH.has(x)) ? 1 : 0;
  };
  const families: string[] = [];
  for (const m of kept) if (!families.includes(family(m.id))) families.push(family(m.id));
  const sorted = kept
    .map((m, i) => ({ m, i, tier: tier(m), fam: families.indexOf(family(m.id)), v: version(m.id) }))
    .sort((a, b) => b.tier - a.tier || a.fam - b.fam || newer(a.v, b.v) || a.i - b.i);
  const out: ModelOption[] = [];
  const perLine = new Map<string, number>();
  for (const { m, tier: t } of sorted) {
    const line = `${family(m.id)}|${t}`;
    if ((perLine.get(line) ?? 0) >= 2 || out.some((o) => o.id === m.id)) continue;
    perLine.set(line, (perLine.get(line) ?? 0) + 1);
    out.push(m.label ? { id: m.id, label: m.label } : { id: m.id });
    if (out.length >= max) break;
  }
  return out;
}

/** `agy models`: "<id>\t<name>" a line (after a line that says it fetches). */
export function parseAntigravity(text: string): ModelOption[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.split("\t"))
    .filter((p) => p.length >= 2 && p[0]!.trim() && !/\s/.test(p[0]!.trim()))
    .map((p) => ({ id: p[0]!.trim(), label: p[1]!.trim() }));
}

/** `opencode models`: "<provider>/<model>" a line. */
export function parseOpencode(text: string): ModelOption[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[^\s/]+\/\S+$/.test(l))
    .map((id) => ({ id }));
}

/** `grok models`: "  * <id> (default)" / "  - <id>", and "Default model: <id>". */
export function parseGrok(text: string): { models: ModelOption[]; agentDefault?: string } {
  const models: ModelOption[] = [];
  let agentDefault: string | undefined;
  for (const l of text.split(/\r?\n/)) {
    const m = /^\s*[*-]\s+(\S+)(\s+\(default\))?\s*$/.exec(l);
    if (m) {
      models.push({ id: m[1]! });
      if (m[2]) agentDefault = m[1]!;
    }
    const d = /^\s*Default model:\s*(\S+)/i.exec(l);
    if (d) agentDefault = d[1]!;
  }
  return { models, ...(agentDefault ? { agentDefault } : {}) };
}

/** `codex debug models` (or its models_cache.json): the catalog for the account, hidden ones left out, in its order. */
export function parseCodex(text: string): (ModelOption & { about?: string })[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const list = (data as { models?: unknown })?.models;
  if (!Array.isArray(list)) return [];
  return list
    .filter((m): m is { slug: string; display_name?: string; description?: string; visibility?: string; priority?: number } => typeof m?.slug === "string")
    .filter((m) => m.visibility !== "hide")
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
    .map((m) => ({ id: m.slug, ...(m.display_name ? { label: m.display_name } : {}), ...(m.description ? { about: m.description } : {}) }));
}

/** The model Codex takes when given none: `model = "…"` of its config.toml (before any [section]). */
export function codexConfigModel(env: Env): string | undefined {
  const dir = env.CODEX_HOME || path.join(userHome(env), ".codex");
  let text: string;
  try {
    text = fs.readFileSync(path.join(dir, "config.toml"), "utf8");
  } catch {
    return undefined;
  }
  for (const l of text.split(/\r?\n/)) {
    if (/^\s*\[/.test(l)) break;
    const m = /^\s*model\s*=\s*["']([^"']+)["']/.exec(l);
    if (m) return m[1];
  }
  return undefined;
}

/** Run an agent's list command: its output, or undefined when it fails or takes longer than `ms`. */
function listOutput(program: string, args: string[], env: Env, ms: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    let out = "";
    let done = false;
    const finish = (v: string | undefined) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(v);
    };
    let child: ReturnType<typeof spawnAgent>;
    try {
      child = spawnAgent(program, args, { env: { ...withoutAgentMarks(env), NO_COLOR: "1" }, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    } catch {
      resolve(undefined);
      return;
    }
    const timer = setTimeout(() => {
      stopTree(child);
      finish(undefined);
    }, ms);
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (d: string) => {
      if (out.length < 4_000_000) out += d;
    });
    child.on("error", () => finish(undefined));
    child.on("close", (code) => finish(code === 0 ? out : undefined));
  });
}

/**
 * The strong models to offer for an agent: from its own list when it gives one within `ms` (default 6 s; never
 * hanging the wizard), else strom's built-in list.
 */
export async function modelChoices(agent: string, env: Env, ms = Number(env.STROM_MODELS_TIMEOUT_MS) || 6000): Promise<ModelChoices> {
  const builtin = BUILTIN_MODELS[agent] ?? [];
  const configured = agent === "codex" ? codexConfigModel(env) : undefined;
  const fallback = (): ModelChoices => ({ models: builtin, source: "builtin", ...(configured ? { agentDefault: configured } : {}) });
  const args = LIST[agent];
  if (!args) return fallback();
  const program = findAgent(PROFILES[agent]?.command ?? agent, env);
  if (!program) return fallback();
  const text = await listOutput(program, args, env, ms);
  let list: (ModelOption & { about?: string })[] = [];
  let agentDefault = configured;
  if (text !== undefined) {
    if (agent === "antigravity") list = parseAntigravity(text);
    else if (agent === "opencode") list = parseOpencode(text);
    else if (agent === "codex") list = parseCodex(text);
    else if (agent === "grok") {
      const g = parseGrok(text);
      list = g.models;
      agentDefault = g.agentDefault;
    }
  }
  // Codex keeps its catalog for the account beside its config: read when the command would not say it
  if (!list.length && agent === "codex") {
    try {
      list = parseCodex(fs.readFileSync(path.join(env.CODEX_HOME || path.join(userHome(env), ".codex"), "models_cache.json"), "utf8"));
    } catch {
      // none
    }
  }
  const strong = strongModels(list);
  if (!strong.length) return fallback();
  return { models: strong, source: "agent", ...(agentDefault ? { agentDefault } : {}) };
}
