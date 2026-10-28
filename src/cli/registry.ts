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
  /** Not required with one of these options (strom fetch --status). */
  unless?: string[];
  variadic?: boolean;
  /** At most this many characters (said in help and under a mistake). */
  max?: number;
  /** Options agents type meaning it (--find for strom recordset list <filter>): never taken — the error points to it. */
  mistaken?: string[];
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

/** One word of a command line as typed: an argument, or an option with its value. */
export type Typed = { arg: number } | { opt: string; value?: string };

export interface Input {
  args: string[];
  opts: Record<string, string | boolean | string[] | undefined>;
  /** Arguments after a bare "--", for commands that pass them on (strom run). */
  extra?: string[];
  /**
   * The line as typed, in order: each argument (its index) and each option with its value — a command of several
   * arguments only (strom media view B0001:2 --crop … B0001:3 --half right: each part of the image named before it).
   */
  seq?: Typed[];
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
  /**
   * The user's own, in their terminal: an agent never runs it, whatever options come before it (strom --json seal
   * adopt) — refused before anything is read or written (cli/main.ts). The question, for the agent.
   */
  person?: string;
  /** Takes arguments after "--" and passes them on (to the agent CLI). */
  passthrough?: boolean;
  /**
   * Behind a gate not open yet (an experiment the Strom app has not released): it runs when named, but no help
   * overview, strom commands, the guide, the brief's sheet or the menu shows it.
   */
  hidden?: boolean;
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
  { name: "timing", type: "boolean", description: "say how long each step took and how much of the disk it read (stderr; also STROM_TIMING=1): the line to send when strom is slow" },
  { name: "version", type: "boolean", description: "print the version of strom" },
  { name: "help", type: "boolean", short: "h", description: "help for a command" },
];

export const WRITE_OPTIONS: OptionDef[] = [
  { name: "dry-run", type: "boolean", description: "show what would change, change nothing" },
  { name: "reason", type: "string", value: "<text>", description: "why (required when changing or retracting facts)" },
];

const registry: CommandDef[] = [];

/**
 * Other names of a whole group (what agents type for it: "book show" for strom recordset show): each command of the
 * group is taken by it too — an alias of its own, said in its help ("Also: strom book show") and in strom commands
 * --json, never a command or group of its own in the overview.
 */
export const GROUP_ALIASES: Readonly<Record<string, string>> = { book: "recordset" };

export function register(...defs: CommandDef[]): void {
  for (const given of defs) {
    const others = Object.entries(GROUP_ALIASES).filter(([, g]) => given.path.length > 1 && given.path[0] === g).map(([a]) => [a, ...given.path.slice(1)]);
    const def = others.length ? { ...given, aliases: [...(given.aliases ?? []), ...others] } : given;
    const names = [def.path, ...(def.aliases ?? [])].map((p) => p.join(" "));
    if (registry.some((c) => [c.path, ...(c.aliases ?? [])].some((p) => names.includes(p.join(" "))))) throw new Error(`duplicate command ${def.path.join(" ")}`);
    registry.push(def);
  }
}

/** The commands help, strom commands, the guide and the brief show: every one but those behind a gate (hidden). */
export function commands(): readonly CommandDef[] {
  return registry.filter((c) => !c.hidden);
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
  return registry.filter((c) => !c.hidden && c.path.length > prefix.length && prefix.every((w, i) => c.path[i] === w));
}

/** An alias's words that begin with these (a group of aliases only: "lesson" has "lesson show" among them). */
export function aliasExtends(prefix: string[]): boolean {
  return registry.some((c) => (c.aliases ?? []).some((a) => a.length > prefix.length && prefix.every((w, i) => a[i] === w)));
}

/** The group another name stands for, when the words are one ("book" → "recordset"), else nothing. */
export function aliasGroup(prefix: string[]): string[] | undefined {
  const real = prefix.length === 1 ? GROUP_ALIASES[prefix[0]!] : undefined;
  return real && subcommandsOf([real]).length ? [real] : undefined;
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
  // the user's own, in their terminal: refused to an agent
  if (def.person) out.userOnly = true;
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
