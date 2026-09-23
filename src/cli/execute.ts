// Finding a command, parsing its options and checking its arguments — shared
// by the CLI entry and `strom batch`. Mistakes get a short error with a
// suggestion, never a wall of help: every extra line costs an agent tokens.

import { parseArgs } from "node:util";
import { UsageError } from "../core/errors.ts";
import { GLOBAL_OPTIONS, commands, match, optionsOf, subcommandsOf, type CommandDef, type Input, type OptionDef } from "./registry.ts";

const VALUE_GLOBALS = new Set(GLOBAL_OPTIONS.filter((o) => o.type === "string").map((o) => `--${o.name}`));

/** Split argv into the command words and the remaining arguments. */
export function splitCommand(argv: string[]): { words: string[]; rest: string[] } {
  const words: string[] = [];
  const rest: string[] = [];
  let collecting = true;
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!;
    if (tok === "--") {
      rest.push(...argv.slice(i));
      break;
    }
    if (tok.startsWith("-")) {
      rest.push(tok);
      if (VALUE_GLOBALS.has(tok) && i + 1 < argv.length) rest.push(argv[++i]!);
      continue;
    }
    if (collecting) {
      const candidate = [...words, tok];
      const extends_ = match(candidate)?.used === candidate.length || subcommandsOf(candidate).length > 0;
      if (extends_) {
        words.push(tok);
        continue;
      }
      collecting = false;
    }
    rest.push(tok);
  }
  return { words, rest };
}

/** Edit distance where swapping two neighbouring letters is one typo ("bron" → "born"). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  return d[a.length]![b.length]!;
}

/** The closest candidates to `input` (a prefix, or a few typos), best first — only the best ones. */
export function suggest(input: string, candidates: string[]): string[] {
  const q = input.toLowerCase();
  const scored = candidates
    .map((c) => ({ c, d: c.startsWith(q) || q.startsWith(c) ? 0.5 : distance(q, c.toLowerCase()) }))
    .filter((x) => x.d <= Math.max(2, Math.floor(q.length / 3)))
    .sort((a, b) => a.d - b.d || a.c.length - b.c.length);
  const best = scored[0]?.d;
  return [...new Set(scored.filter((x) => x.d <= (best ?? 0) + 0.5).map((x) => x.c))].slice(0, 3);
}

export interface Resolved {
  def: CommandDef;
  /** Options and arguments after the command words. */
  rest: string[];
}

/** The command named by argv, or a short error with suggestions. */
export function resolveCommand(argv: string[]): Resolved {
  const { words, rest } = splitCommand(argv);
  const found = match(words);
  const leftover = found ? words.slice(found.used) : words;
  // Words that are not options — the values of global options (--lang en) are no stray words.
  const extra = rest.filter((r, i) => !r.startsWith("-") && !VALUE_GLOBALS.has(rest[i - 1] ?? ""));
  if (found && leftover.length === 0) {
    if (found.def.path.length === 0 && extra.length && rest[0] !== "--") throw unknownCommand(extra.slice(0, 2));
    return { def: found.def, rest };
  }
  // A group ("person") with a wrong or missing subcommand.
  const group = found ? [...found.def.path, ...leftover] : words;
  if (group.length && subcommandsOf(group).length) {
    if (!extra.length) throw new GroupOnly(group);
    throw unknownCommand([...group, extra[0]!]);
  }
  throw unknownCommand([...words, ...extra].slice(0, Math.max(words.length + 1, 2)));
}

/** Signal: a group name alone — the caller prints the group's short help. */
export class GroupOnly extends Error {
  readonly group: string[];
  constructor(group: string[]) {
    super(`strom ${group.join(" ")} <command>`);
    this.group = group;
  }
}

function unknownCommand(words: string[]): UsageError {
  const typed = words.join(" ");
  const all = commands().filter((c) => c.path.length > 0).map((c) => c.path.join(" "));
  // A known group narrows the choice ("person ad" → "person add", not "lesson add").
  const inGroup = all.filter((c) => c.startsWith(`${words[0]} `));
  const same = (inGroup.length ? inGroup : all).filter((c) => c.split(" ").length === words.length);
  const hits = suggest(typed, same.length ? same : all);
  const more = hits.length ? hits : suggest(words[0] ?? "", [...new Set(all.map((c) => c.split(" ")[0]!))]);
  return new UsageError(`unknown command "strom ${typed}"`, {
    hint: more.length ? `did you mean: ${more.map((c) => `strom ${c}`).join(" · ")}` : "strom help   (all commands)",
  });
}

/** Parse options strictly; Node's messages are replaced by short ones with suggestions. */
export function parseOptions(def: CommandDef, rest: string[]): { values: Input["opts"]; positionals: string[] } {
  const defs: OptionDef[] = optionsOf(def);
  const options: Record<string, { type: "string" | "boolean"; short?: string; multiple?: boolean }> = {};
  for (const o of defs) {
    options[o.name] = { type: o.type };
    if (o.short) options[o.name]!.short = o.short;
    if (o.multiple) options[o.name]!.multiple = true;
  }
  const cmd = `strom ${def.path.join(" ")}`.trim();
  try {
    const r = parseArgs({ args: rest, options, allowPositionals: true, strict: true });
    return { values: r.values as Input["opts"], positionals: r.positionals };
  } catch (err) {
    const e = err as Error & { code?: string };
    const opt = /'(-{1,2}[^' =]+)/.exec(e.message)?.[1] ?? "";
    const own = [...(def.options ?? []), ...(def.writes ? optionsOf(def).filter((o) => o.name === "dry-run" || o.name === "reason") : [])].map((o) => `--${o.name}`);
    if (e.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
      // "strom brief --task T0003": the task is an argument there, not an option
      const arg = def.args?.find((a) => `--${a.name}` === opt);
      if (arg) throw new UsageError(`${opt.slice(2)} is an argument of ${cmd}, not an option`, { hint: `strom ${def.path.join(" ")} <${arg.name}>` });
      const near = suggest(opt, optionsOf(def).map((o) => `--${o.name}`));
      throw new UsageError(`unknown option ${opt} for ${cmd}`, {
        hint: near.length ? `did you mean ${near.join(" or ")}?` : `${own.length ? `options: ${own.join(" ")} · ` : ""}strom help ${def.path.join(" ")}`,
      });
    }
    if (e.code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
      const o = defs.find((d) => `--${d.name}` === opt);
      throw new UsageError(o?.type === "boolean" ? `${opt} takes no value` : `${opt} needs a value${o?.value ? ` ${o.value}` : ""}`, { hint: `strom help ${def.path.join(" ")}` });
    }
    throw new UsageError(e.message.split("\n")[0] ?? "invalid arguments", { hint: `strom help ${def.path.join(" ")}` });
  }
}

/** Required and surplus positional arguments. */
export function checkArgs(def: CommandDef, args: string[]): void {
  const declared = def.args ?? [];
  const required = declared.filter((a) => a.required);
  if (args.length < required.length) {
    const missing = required[args.length]!;
    throw new UsageError(`missing <${missing.name}>: ${missing.description}`, { hint: `strom help ${def.path.join(" ")}` });
  }
  if (!declared.some((a) => a.variadic) && args.length > declared.length)
    throw new UsageError(`unexpected argument "${args[declared.length]}"`, { hint: `strom help ${def.path.join(" ")} — quote values with spaces` });
}

/** Split off everything after a bare "--" (passed through to another program). */
export function splitPassthrough(rest: string[]): { rest: string[]; passthrough: string[] } {
  const i = rest.indexOf("--");
  return i < 0 ? { rest, passthrough: [] } : { rest: rest.slice(0, i), passthrough: rest.slice(i + 1) };
}
