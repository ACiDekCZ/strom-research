// The commands a task of each level uses, with their exact options and limits — so the agent need not ask
// `strom help` for them in every session (K2/P5). Everything shown comes from the command registry (arguments,
// options, the values an option takes) and from the record schemas (how long a text may be): nothing is written
// twice by hand. Only which commands go with which level is chosen here.

import { commands, type ArgDef, type CommandDef, type OptionDef } from "../cli/registry.ts";
import { SCHEMAS } from "../core/schema.ts";
import { NOTE_MAX, type RecordType } from "../core/model.ts";

const ALL = ["search add", "task add", "note add", "lesson add"];
const SCANS = ["media view", "read", "fetch"];
const LEVELS: Record<string, string[]> = {
  link: [...ALL, ...SCANS, "hypothesis add", "hypothesis argue", "conflict add", "task wait"],
  verify: [...ALL, ...SCANS, "conflict add", "hypothesis add", "hypothesis argue"],
  enrich: [...ALL, ...SCANS, "hypothesis add", "task wait"],
  locate: [...ALL, "recordset add", "fetch", "task wait"],
  intake: [...ALL, "input sort", "input skip", "media view", "conflict add"],
  request: [...ALL, "task wait", "source add"],
  narrate: [...ALL, "story set"],
};

const camel = (name: string) => name.replace(/-(\p{L})/gu, (_, c: string) => c.toUpperCase());

/** How long a text may be: a note's, or from the schema of the record an "add" writes ("search add <question>" → search.question). */
function limit(def: CommandDef, name: string): number | undefined {
  if (name === "note" || (def.path[0] === "note" && name === "text")) return NOTE_MAX;
  if (def.path[1] !== "add") return undefined;
  const fields = SCHEMAS[def.path[0] as RecordType];
  const spec = fields?.[camel(name)] as { t?: string; max?: number } | undefined;
  return spec?.t === "string" ? spec.max : undefined;
}

/** The values an option takes when its description is just their list ("found, negative, partial"), else its placeholder. */
function value(def: CommandDef, o: OptionDef): string {
  if (o.type === "boolean") return "";
  const words = o.description.replace(/\s*\(default\)/gu, "").trim().split(/,\s*/u);
  const max = limit(def, o.name);
  if (words.length > 1 && words.every((w) => /^[\p{L}\p{N}-]+$/u.test(w))) return ` ${words.join("|")}`;
  const v = o.value ?? "<value>";
  return ` ${max ? v.replace(/>$/u, ` ≤${max}>`) : v}`;
}

function arg(def: CommandDef, a: ArgDef): string {
  const max = limit(def, a.name);
  const name = `${a.name}${max ? ` ≤${max}` : ""}`;
  return a.required ? `<${name}>${a.variadic ? "…" : ""}` : `[${name}]${a.variadic ? "…" : ""}`;
}

/** One command in one line: its arguments and every option, as the registry declares them. */
export function synopsis(def: CommandDef): string {
  const opts = (def.options ?? []).filter((o) => !o.hidden);
  // what an option needs besides, as its description says it ("required with --result found")
  const needs = (o: OptionDef) => /required with (--[\p{L}\p{N}-]+(?: [\p{L}\p{N}-]+)?)/u.exec(o.description)?.[1];
  return ["strom", ...def.path, ...(def.args ?? []).map((a) => arg(def, a)), ...opts.map((o) => `--${o.name}${value(def, o)}${o.multiple ? "…" : ""}${needs(o) ? ` (with ${needs(o)})` : ""}`)].join(" ");
}

/** The section of the brief: the commands of this level, or nothing (no level, or no registry — a unit test). */
export function commandSheet(level: string | undefined): string {
  const names = level ? LEVELS[level] : undefined;
  if (!names) return "";
  const defs = names.map((n) => commands().find((c) => c.path.join(" ") === n)).filter((d): d is CommandDef => !!d);
  if (!defs.length) return "";
  return [
    "## Commands for this task (every option; ≤n: at most n characters; … repeatable — more: strom help <command>)",
    ...defs.map((d) => `  ${synopsis(d)}`),
  ].join("\n");
}
