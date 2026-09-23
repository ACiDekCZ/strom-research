// Help text generated from the registry. Short by design: examples first,
// then arguments and options.

import { GROUPS, GLOBAL_OPTIONS, WRITE_OPTIONS, commands, match, subcommandsOf, usageLine, type CommandDef, type OptionDef } from "./registry.ts";
import { table } from "./format.ts";
import { suggest } from "./execute.ts";

function optionRows(opts: OptionDef[]): string[][] {
  return opts.map((o) => [`--${o.name}${o.value ? ` ${o.value}` : ""}${o.multiple ? " (repeatable)" : ""}`, o.description]);
}

export function commandHelp(def: CommandDef): string {
  const out: string[] = [usageLine(def), "", def.summary];
  if (def.description) out.push("", def.description);
  if (def.examples?.length) out.push("", "Examples:", ...def.examples.map((e) => `  ${e}`));
  if (def.args?.length) out.push("", "Arguments:", table(def.args.map((a) => [`  ${a.name}`, a.description])));
  const own = [...(def.options ?? []), ...(def.writes ? WRITE_OPTIONS : [])];
  if (own.length) out.push("", "Options:", table(optionRows(own).map(([a, b]) => [`  ${a}`, b ?? ""])));
  out.push("", "Global options: --tree --json --limit --page --lang --yes --debug   (all: strom help)");
  return out.join("\n");
}

export function groupHelp(prefix: string[]): string {
  const subs = subcommandsOf(prefix);
  return [
    `strom ${prefix.join(" ")} <command>`,
    "",
    table(subs.map((c) => [`  ${c.path.join(" ")}`, c.summary])),
    "",
    `Details: strom help ${prefix.join(" ")} <command>`,
  ].join("\n");
}

/** Overview of all commands, grouped. */
export function overview(): string {
  const out: string[] = ["strom <command> [options]      (strom guide — how to do research with strom)", ""];
  for (const [group, title] of Object.entries(GROUPS)) {
    const defs = commands().filter((c) => c.group === group && c.path.length > 0);
    if (defs.length === 0) continue;
    out.push(`${title}:`, table(defs.map((c) => [`  ${c.path.join(" ")}`, c.summary])), "");
  }
  out.push("Global options:", table(optionRows(GLOBAL_OPTIONS).map(([a, b]) => [`  ${a}`, b ?? ""])));
  out.push("", "Help for one command: strom help <command>   ·   machine-readable catalog: strom commands --json");
  return out.join("\n");
}

export function helpFor(input: string[]): string {
  // "strom help 'research new'" — one quoted argument with several words.
  const words = input.flatMap((w) => w.trim().split(/\s+/)).filter(Boolean);
  if (words.length === 0) return overview();
  const found = match(words);
  if (found && found.used === words.length) return commandHelp(found.def);
  if (subcommandsOf(words).length > 0) return groupHelp(words);
  const all = commands().filter((c) => c.path.length > 0).map((c) => c.path.join(" "));
  const near = suggest(words.join(" "), all.filter((c) => c.split(" ").length === words.length));
  return `unknown command "${words.join(" ")}"${near.length ? ` — did you mean: ${near.map((c) => `strom help ${c}`).join(" · ")}` : ""}\nall commands: strom help`;
}
