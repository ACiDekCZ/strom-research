// The command registry: the single source of truth for every command.
// Help, `strom commands --json`, `strom guide` and argument parsing are all
// derived from these declarations.

import type { Context } from "./context.ts";

export type OptionType = "string" | "boolean";

export interface OptionDef {
  name: string;
  type: OptionType;
  description: string;
  short?: string;
  multiple?: boolean;
  /** Placeholder shown in help, e.g. "<date>". */
  value?: string;
}

export interface ArgDef {
  name: string;
  description: string;
  required?: boolean;
  variadic?: boolean;
}

export const GROUPS = {
  start: "Orientation",
  research: "Trees and researches",
  inputs: "Inputs (what the research starts from)",
  tasks: "Tasks",
  people: "People, families, facts",
  sources: "Sources, archives, record sets, places",
  analysis: "Searches, conflicts, hypotheses, lessons",
  output: "Output (GEDCOM)",
  history: "Checks and history",
  setup: "Setup and environment",
} as const;

export type Group = keyof typeof GROUPS;

export interface Input {
  args: string[];
  opts: Record<string, string | boolean | string[] | undefined>;
  /** Arguments after a bare "--", for commands that pass them on (strom run). */
  extra?: string[];
}

export interface Result {
  /** Compact text for agents and humans. */
  text: string;
  /** Machine-readable payload for --json. */
  data?: unknown;
  exitCode?: number;
}

export interface CommandDef {
  path: string[];
  summary: string;
  group: Group;
  description?: string;
  args?: ArgDef[];
  options?: OptionDef[];
  examples?: string[];
  /** Writes to the tree: gets --dry-run, is committed automatically. */
  writes?: boolean;
  /**
   * command (default): a writing command holds the tree lock from start to commit;
   * sections: a long one (copying files, the network) locks only while it writes.
   */
  lock?: "command" | "sections";
  /** Needs a tree to work on. */
  tree?: boolean;
  /** Takes arguments after "--" and passes them on (to the agent CLI). */
  passthrough?: boolean;
  run(ctx: Context, input: Input): Promise<Result> | Result;
}

export const GLOBAL_OPTIONS: OptionDef[] = [
  { name: "tree", type: "string", value: "<dir|name>", description: "tree to work on (default: STROM_TREE, the tree you are in, or the only tree)" },
  { name: "json", type: "boolean", description: "machine-readable output" },
  { name: "limit", type: "string", value: "<n>", description: "max rows in listings (default 50)" },
  { name: "page", type: "string", value: "<n>", description: "page of a listing" },
  { name: "lang", type: "string", value: "<code>", description: "research language, e.g. cs, en, de" },
  { name: "home", type: "string", value: "<dir>", description: "Strom home folder (default from config)" },
  { name: "shared", type: "string", value: "<dir>", description: "shared data folder (media, catalog, tools)" },
  { name: "trees", type: "string", value: "<dir>", description: "folder holding the trees" },
  { name: "agent", type: "string", value: "<agent>", description: "AI agent: claude, codex, antigravity, opencode (default from config)" },
  { name: "yes", type: "boolean", description: "accept suggested defaults, never ask" },
  { name: "debug", type: "boolean", description: "show technical details on errors" },
  { name: "version", type: "boolean", description: "print the version of strom" },
  { name: "help", type: "boolean", short: "h", description: "help for a command" },
];

export const WRITE_OPTIONS: OptionDef[] = [
  { name: "dry-run", type: "boolean", description: "show what would change, change nothing" },
  { name: "reason", type: "string", value: "<text>", description: "why (required when changing or retracting facts)" },
];

const registry: CommandDef[] = [];

export function register(...defs: CommandDef[]): void {
  for (const def of defs) {
    if (registry.some((c) => c.path.join(" ") === def.path.join(" "))) throw new Error(`duplicate command ${def.path.join(" ")}`);
    registry.push(def);
  }
}

export function commands(): readonly CommandDef[] {
  return registry;
}

export function optionsOf(def: CommandDef): OptionDef[] {
  return [...(def.options ?? []), ...(def.writes ? WRITE_OPTIONS : []), ...GLOBAL_OPTIONS];
}

/** Longest registered command path matching the leading words. */
export function match(words: string[]): { def: CommandDef; used: number } | undefined {
  let best: { def: CommandDef; used: number } | undefined;
  for (const def of registry) {
    const n = def.path.length;
    if (n > words.length) continue;
    if (n === 0 && words.length > 0) continue; // the root command only matches no words
    if (def.path.every((w, i) => words[i] === w) && (!best || n > best.used)) best = { def, used: n };
  }
  return best;
}

/** Command groups ("person") that have subcommands but no command of their own. */
export function subcommandsOf(prefix: string[]): CommandDef[] {
  return registry.filter((c) => c.path.length > prefix.length && prefix.every((w, i) => c.path[i] === w));
}

export function usageLine(def: CommandDef): string {
  const args = (def.args ?? []).map((a) => {
    const name = a.variadic ? `${a.name}...` : a.name;
    return a.required ? `<${name}>` : `[${name}]`;
  });
  return ["strom", ...def.path, ...args, (def.options?.length || def.writes) ? "[options]" : ""].filter(Boolean).join(" ");
}

/** Catalog entry for `strom commands --json`: only what is there (empty fields are left out). */
export function describe(def: CommandDef): Record<string, unknown> {
  const out: Record<string, unknown> = { command: def.path.join(" "), usage: usageLine(def), summary: def.summary, group: def.group };
  if (def.description) out.description = def.description;
  if (def.writes) out.writes = true;
  if (def.tree) out.needsTree = true;
  if (def.args?.length) out.args = def.args;
  const opts = [...(def.options ?? []), ...(def.writes ? WRITE_OPTIONS : [])];
  if (opts.length)
    out.options = opts.map((o) => ({
      name: `--${o.name}`,
      ...(o.type === "boolean" ? { flag: true } : { value: o.value ?? "<value>" }),
      ...(o.multiple ? { repeatable: true } : {}),
      description: o.description,
    }));
  if (def.examples?.length) out.examples = def.examples;
  return out;
}
