// The command registry: the single source of truth for every command.
// Help, `strom commands --json`, `strom guide` and argument parsing are all
// derived from these declarations.

import type { Context } from "./context.ts";
import type { ShownAppUrl } from "../core/stromapp.ts";

export type OptionType = "string" | "boolean";

export interface OptionDef {
  name: string;
  type: OptionType;
  description: string;
  short?: string;
  multiple?: boolean;
  /** Placeholder shown in help, e.g. "<date>". */
  value?: string;
  /** Taken, but never shown: not in help, strom commands, the guide or a hint of the options. */
  hidden?: boolean;
  /** Other names it is taken by (a mistake agents make often: --surnames for --surname); said once in help. */
  aliases?: string[];
  /**
   * Names agents type meaning it that are not it (--timeout, a shell tool's milliseconds, for strom read --minutes):
   * never taken as it — the unknown option points to it.
   */
  mistaken?: string[];
  /** At most this many characters (said in help and under a mistake). */
  max?: number;
}

export interface ArgDef {
  name: string;
  description: string;
  required?: boolean;
  variadic?: boolean;
  /** At most this many characters (said in help and under a mistake). */
  max?: number;
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
  /**
   * Where each value of a repeatable option was typed: how many arguments came before it, in the order of its values
   * (strom media view B0001:2 --crop … B0001:3 --crop …: each crop of the image named before it).
   */
  after?: Record<string, number[]>;
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
  /**
   * Other words it is run by (what agents type for it: "lesson show" for strom show): no command of their own in help
   * (one line "also: …"), listed as aliases in strom commands --json.
   */
  aliases?: string[][];
  summary: string;
  group: Group;
  description?: string;
  args?: ArgDef[];
  options?: OptionDef[];
  examples?: string[];
  /** What the brief's command sheet says after it — a mistake agents make with it, in a few words. */
  sheet?: string;
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
  { name: "agent", type: "string", value: "<agent>", description: "AI agent: claude, codex, antigravity, opencode, grok (default from config)" },
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
    const names = [def.path, ...(def.aliases ?? [])].map((p) => p.join(" "));
    if (registry.some((c) => [c.path, ...(c.aliases ?? [])].some((p) => names.includes(p.join(" "))))) throw new Error(`duplicate command ${def.path.join(" ")}`);
    registry.push(def);
  }
}

export function commands(): readonly CommandDef[] {
  return registry;
}

export function optionsOf(def: CommandDef): OptionDef[] {
  // a command's own option of a global's name is its own (strom help --agent: the catalog, not an agent's name)
  const own = [...(def.options ?? []), ...(def.writes ? WRITE_OPTIONS : [])];
  return [...own, ...GLOBAL_OPTIONS.filter((g) => !own.some((o) => o.name === g.name))];
}

/** Longest registered command path matching the leading words. */
export function match(words: string[]): { def: CommandDef; used: number } | undefined {
  let best: { def: CommandDef; used: number } | undefined;
  for (const def of registry)
    for (const path of [def.path, ...(def.aliases ?? [])]) {
      const n = path.length;
      if (n > words.length) continue;
      if (n === 0 && words.length > 0) continue; // the root command only matches no words
      if (path.every((w, i) => words[i] === w) && (!best || n > best.used)) best = { def, used: n };
    }
  return best;
}

/** Command groups ("person") that have subcommands but no command of their own. */
export function subcommandsOf(prefix: string[]): CommandDef[] {
  return registry.filter((c) => c.path.length > prefix.length && prefix.every((w, i) => c.path[i] === w));
}

/** An alias's words that begin with these (a group of aliases only: "lesson" has "lesson show" among them). */
export function aliasExtends(prefix: string[]): boolean {
  return registry.some((c) => (c.aliases ?? []).some((a) => a.length > prefix.length && prefix.every((w, i) => a[i] === w)));
}

export function usageLine(def: CommandDef): string {
  const args = (def.args ?? []).map((a) => {
    const name = a.variadic ? `${a.name}...` : a.name;
    return a.required ? `<${name}>` : `[${name}]`;
  });
  return ["strom", ...def.path, ...args, (def.options?.some((o) => !o.hidden) || def.writes) ? "[options]" : ""].filter(Boolean).join(" ");
}

/**
 * A command's description as it is said here: {appUrl} the copy of the Strom app `strom app` opens (stromAppUrl — the
 * beta for a strom of the beta channel, strom.app.url where it says another; found: help app named stromapp.info on the
 * beta).
 */
export function descriptionOf(def: CommandDef, appUrl: ShownAppUrl): string | undefined {
  const said = def.description?.replace(/\{appUrl\}/g, appUrl.url);
  // an address of no Strom app in the setting: the help names the default and says so (B1-b)
  return said && appUrl.invalid && def.description!.includes("{appUrl}") ? `${said}\n${APP_URL_INVALID}` : said;
}

/** What a help says under the address of the Strom app when strom.app.url says no address of it (B1-b). */
export const APP_URL_INVALID =
  "Note: the setting strom.app.url (or STROM_APP_URL) is no address of the Strom app, so the address above is the default.\n" +
  "Set it right (strom config set strom.app.url <address>) or remove it (strom config unset strom.app.url).";

/** What strom config where / config get say under a strom.app.url that is no address of the Strom app (B1-e). */
export const APP_URL_INVALID_SETTING =
  "Note: the setting strom.app.url (or STROM_APP_URL) is no address of the Strom app: strom app refuses it, and where only an address is named, the default is.\n" +
  "Set it right (strom config set strom.app.url <address>) or remove it (strom config unset strom.app.url).";

/** Catalog entry for `strom commands --json`: only what is there (empty fields are left out). */
export function describe(def: CommandDef, appUrl: ShownAppUrl): Record<string, unknown> {
  const out: Record<string, unknown> = { command: def.path.join(" "), usage: usageLine(def), summary: def.summary, group: def.group };
  const description = descriptionOf(def, appUrl);
  if (description) out.description = description;
  if (def.writes) out.writes = true;
  if (def.tree) out.needsTree = true;
  if (def.aliases?.length) out.aliases = def.aliases.map((a) => a.join(" "));
  if (def.args?.length) out.args = def.args;
  const opts = [...(def.options ?? []), ...(def.writes ? WRITE_OPTIONS : [])].filter((o) => !o.hidden);
  if (opts.length)
    out.options = opts.map((o) => ({
      name: `--${o.name}`,
      ...(o.type === "boolean" ? { flag: true } : { value: o.value ?? "<value>" }),
      ...(o.multiple ? { repeatable: true } : {}),
      ...(o.max ? { max: o.max } : {}),
      ...(o.aliases?.length ? { aliases: o.aliases.map((a) => `--${a}`) } : {}),
      description: o.description,
    }));
  if (def.examples?.length) out.examples = def.examples;
  return out;
}
