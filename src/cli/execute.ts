// Finding a command, parsing its options and checking its arguments — shared
// by the CLI entry and `strom batch`. Mistakes get a short error with a
// suggestion, never a wall of help: every extra line costs an agent tokens.

import { parseArgs } from "node:util";
import { UsageError } from "../core/errors.ts";
import { ALL_PREFIXES } from "../core/model.ts";
import { shellArg } from "./format.ts";
import { GLOBAL_OPTIONS, aliasExtends, commands, match, optionsOf, subcommandsOf, usageLine, WRITE_OPTIONS, type CommandDef, type Input, type OptionDef } from "./registry.ts";

const VALUE_GLOBALS = new Set(GLOBAL_OPTIONS.filter((o) => o.type === "string").map((o) => `--${o.name}`));

/** The first word of a command line as typed — a command strom knows or not; the values of global options (--lang cs) are none. */
export function firstWord(argv: string[]): string | undefined {
  const { words, rest } = splitCommand(argv);
  return words[0] ?? rest.find((r, i) => !r.startsWith("-") && !VALUE_GLOBALS.has(rest[i - 1] ?? "") && !rest.slice(0, i).includes("--"));
}

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
      const extends_ = match(candidate)?.used === candidate.length || subcommandsOf(candidate).length > 0 || aliasExtends(candidate);
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
  const near = more.map((c) => `strom ${c}`).join(" · ");
  return new UsageError(`unknown command "strom ${typed}"`, {
    hint: more.length ? `similar command: ${near}` : "strom help   (all commands)",
    ...(more.length ? { code: "command.near", params: { cmd: typed, near } } : { code: "command.unknown", params: { cmd: typed } }),
  });
}

/** One option as the usage under a mistake says it: --name <value>, "…" when repeatable, its limit. */
function optionWord(o: OptionDef): string {
  const value = o.type === "boolean" ? "" : ` ${o.value ?? "<value>"}`;
  return `--${o.name}${value}${o.multiple ? "…" : ""}${o.max ? ` (≤${o.max})` : ""}`;
}

/**
 * The command's synopsis and its own options, compact — said under a mistake in calling it, so the agent tries again
 * without strom help (K2: a help after most such errors).
 */
export function usageOf(def: CommandDef, program = "strom"): string {
  const own = [...(def.options ?? []), ...(def.writes ? WRITE_OPTIONS : [])].filter((o) => !o.hidden);
  const synopsis = usageLine(def).replace(/^strom/, program);
  const args = (def.args ?? []).filter((a) => a.max).map((a) => `<${a.name}> ≤${a.max} characters`);
  const out = [`usage: ${synopsis}${args.length ? `   (${args.join(", ")})` : ""}`];
  let line = " ";
  for (const w of own.map(optionWord)) {
    if (line.length + w.length + 1 > 110 && line.trim()) {
      out.push(line);
      line = " ";
    }
    line += ` ${w}`;
  }
  if (line.trim()) out.push(line);
  return out.join("\n");
}

/** Other names of options (--surnames for --surname) as their own: "--surnames=x" too. */
function withOptionAliases(defs: OptionDef[], rest: string[]): string[] {
  const alias = new Map<string, string>(defs.flatMap((o) => (o.aliases ?? []).map((a): [string, string] => [`--${a}`, `--${o.name}`])));
  if (!alias.size) return rest;
  const end = rest.indexOf("--");
  return rest.map((t, i) => {
    if (end >= 0 && i > end) return t;
    const eq = t.indexOf("=");
    const name = eq > 0 ? t.slice(0, eq) : t;
    const own = alias.get(name);
    return own ? `${own}${eq > 0 ? t.slice(eq) : ""}` : t;
  });
}

/** An ID as an option of IDs takes it ("S0213", "s12"): its letter, upper case. */
function idLetter(v: string): string | undefined {
  return /^(\p{L})\p{N}+$/u.exec(v)?.[1]?.toUpperCase();
}

type Token = { kind: "positional"; index: number; value: string } | { kind: "option"; index: number; name: string; rawName: string; value?: string | undefined; inlineValue?: boolean | undefined } | { kind: "option-terminator"; index: number };

/**
 * More values after an option than the command takes (`--found S0213 S0214`, `--note two words`): agents type them so
 * often (N0180–N0188) that a turn goes on each. Where it is beyond doubt — IDs of the same kind after a repeatable
 * option of IDs, and the command's own arguments all there besides — they are that option's values (`--found S0213
 * --found S0214`); anything else is never guessed: the error then shows the line as it is meant (values with spaces
 * quoted, a repeatable option once per value). A command's arguments are never taken into an option.
 */
function foldSurplus(def: CommandDef, defs: OptionDef[], tokens: Token[], values: Input["opts"], positionals: string[]): { values: Input["opts"]; positionals: string[]; fix?: string } {
  const declared = def.args ?? [];
  if (declared.some((a) => a.variadic) || positionals.length <= declared.length || tokens.some((t) => t.kind === "option-terminator")) return { values, positionals };
  const required = declared.filter((a) => a.required).length;
  // the line in units: an option with what follows it, or a word of no option
  type Unit = { opt?: OptionDef; raw?: string; value?: string; inline?: boolean; ids: string[]; join: string[]; free: string[] };
  const units: Unit[] = [];
  let cur: Unit | undefined;
  for (const t of tokens) {
    if (t.kind === "option") {
      const o = defs.find((d) => d.name === t.name);
      cur = { ...(o ? { opt: o } : {}), raw: t.rawName, ...(t.value !== undefined ? { value: t.value, inline: !!t.inlineValue } : {}), ids: [], join: [], free: [] };
      units.push(cur);
      // a flag takes no value: the words after it are the command's
      if (!o || o.type !== "string") cur = undefined;
      continue;
    }
    if (t.kind !== "positional") continue;
    if (!cur) {
      const last = units.at(-1);
      if (last && !last.raw) last.free.push(t.value);
      else units.push({ ids: [], join: [], free: [t.value] });
      continue;
    }
    const letter = cur.value !== undefined ? idLetter(cur.value) : undefined;
    // IDs of the same kind as the option's own (S… after --found S…), as long as they follow it
    if (cur.opt?.multiple && letter && !cur.join.length && !cur.free.length && idLetter(t.value) === letter) cur.ids.push(t.value);
    // after an option of an ID, or once its IDs ended: the command's words
    else if (letter || cur.ids.length || cur.free.length) cur.free.push(t.value);
    else cur.join.push(t.value);
  }
  const free = units.flatMap((u) => u.free);
  const ids = units.flatMap((u) => u.ids);
  const joined = units.some((u) => u.join.length);
  // beyond doubt: only IDs of the option's kind were too many, and the command's arguments are what is left
  if (ids.length && !joined && free.length >= required && free.length <= declared.length) {
    const out: Input["opts"] = { ...values };
    for (const u of units)
      if (u.opt && u.ids.length) {
        // the option's values in the order typed: the earlier ones, its own, the ones after it
        const before = (out[u.opt.name] as string[] | undefined) ?? [];
        const at = before.lastIndexOf(u.value!);
        out[u.opt.name] = [...before.slice(0, at + 1), ...u.ids, ...before.slice(at + 1)];
      }
    return { values: out, positionals: free };
  }
  // the line as it is meant: each ID its own option, words after an option of text its value, the command's last
  // argument the words of one run (a title, a question) — when that leaves the arguments it takes
  let left = free.length;
  const parts: string[] = [];
  for (const u of units) {
    if (u.raw) {
      const value = u.value === undefined ? undefined : [u.value, ...u.join].join(" ");
      parts.push(value === undefined ? u.raw : u.inline ? `${u.raw}=${shellArg(value)}` : `${u.raw} ${shellArg(value)}`);
      for (const id of u.ids) parts.push(`${u.raw} ${id}`);
    }
    if (!u.free.length) continue;
    // one run of words, more than the arguments it may be: its last words one value
    const keep = Math.max(0, declared.length - (left - u.free.length) - 1);
    if (left > declared.length && u.free.length > keep + 1) {
      parts.push(...u.free.slice(0, keep).map(shellArg), shellArg(u.free.slice(keep).join(" ")));
      left -= u.free.length - keep - 1;
    } else parts.push(...u.free.map(shellArg));
  }
  if (left < required || left > declared.length) return { values, positionals };
  return { values, positionals, fix: [...def.path, ...parts].join(" ") };
}

/** Parse options strictly; Node's messages are replaced by short ones with suggestions. */
export function parseOptions(def: CommandDef, rest: string[], program = "strom"): { values: Input["opts"]; positionals: string[]; fix?: string } {
  const defs: OptionDef[] = optionsOf(def);
  rest = withOptionAliases(defs, rest);
  const usage = usageOf(def, program);
  const options: Record<string, { type: "string" | "boolean"; short?: string; multiple?: boolean }> = {};
  for (const o of defs) {
    options[o.name] = { type: o.type };
    if (o.short) options[o.name]!.short = o.short;
    if (o.multiple) options[o.name]!.multiple = true;
  }
  // (a second installation's own command: strom-beta — "for strom" alone names no command the output could tell)
  const cmd = `${program} ${def.path.join(" ")}`.trim();
  try {
    const r = parseArgs({ args: rest, options, allowPositionals: true, strict: true, tokens: true });
    return foldSurplus(def, defs, r.tokens as Token[], r.values as Input["opts"], r.positionals);
  } catch (err) {
    const e = err as Error & { code?: string };
    const opt = /'(-{1,2}[^' =]+)/.exec(e.message)?.[1] ?? "";
    const own = [...(def.options ?? []), ...(def.writes ? optionsOf(def).filter((o) => o.name === "dry-run" || o.name === "reason") : [])].filter((o) => !o.hidden).map((o) => `--${o.name}`);
    if (e.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
      // "strom brief --task T0003": the task is an argument there, not an option
      const arg = def.args?.find((a) => `--${a.name}` === opt);
      if (arg) throw new UsageError(`${opt.slice(2)} is an argument of ${cmd}, not an option`, { hint: `strom ${def.path.join(" ")} <${arg.name}>`, code: "option.is-arg", params: { opt, cmd, arg: arg.name }, usage });
      // a status asked of a name or a family (N0191): it is a fact's only — said as cite says it (the person's
      // language: the plain unknown option, its code kept)
      if (opt === "--status" && (def.path[0] === "name" || def.path[0] === "family"))
        throw new UsageError(`unknown option ${opt} for ${cmd}`, {
          hint: `a status is a fact's (E…) only, never a name's or a family's: strom cite E… S… --status probable|proven, strom event edit E… --status …`,
          code: "option.unknown", hintCode: "option.unknown.status", params: { opt, cmd, options: own.join(" "), path: def.path.join(" ") }, usage,
        });
      const near = suggest(opt, optionsOf(def).filter((o) => !o.hidden).map((o) => `--${o.name}`));
      const help = `strom help${def.path.length ? ` ${def.path.join(" ")}` : ""}`;
      throw new UsageError(`unknown option ${opt} for ${cmd}`, {
        hint: near.length ? `similar option: ${near.join(" · ")}` : `${own.length ? `options: ${own.join(" ")} · ` : ""}${help}`,
        // (none of its own — strom itself, "strom --bogus": in the person's language too)
        ...(near.length ? { code: "option.near", params: { opt, cmd, near: near.join(" · ") } } : own.length ? { code: "option.unknown", params: { opt, cmd, options: own.join(" "), path: def.path.join(" ") } } : { code: "option.unknown.none", params: { opt, cmd, help } }),
        ...(own.length ? { usage } : {}),
      });
    }
    if (e.code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
      const o = defs.find((d) => `--${d.name}` === opt);
      throw new UsageError(o?.type === "boolean" ? `${opt} takes no value` : `${opt} needs a value${o?.value ? ` ${o.value}` : ""}`, {
        hint: `strom help ${def.path.join(" ")}`,
        ...(o?.type === "boolean" ? { code: "option.no-value", params: { opt } } : o?.value ? { code: "option.needs-value", params: { opt, value: o.value, path: def.path.join(" ") } } : {}),
        usage,
      });
    }
    throw new UsageError(e.message.split("\n")[0] ?? "invalid arguments", { hint: `strom help ${def.path.join(" ")}`, usage });
  }
}

/** The show command of each kind of record, by its ID's letter (strom show goes by it; lessons and events it shows). */
export const SHOW_OF: Record<string, string[]> = {
  G: ["research", "show"],
  P: ["person", "show"],
  F: ["family", "show"],
  S: ["source", "show"],
  R: ["repo", "show"],
  B: ["recordset", "show"],
  L: ["place", "show"],
  Q: ["search", "show"],
  T: ["task", "show"],
  X: ["conflict", "show"],
  H: ["hypothesis", "show"],
  I: ["input", "show"],
  N: ["session", "show"],
  M: ["media", "show"],
};

const RECORD_SHOWS = new Set(Object.values(SHOW_OF).map((p) => p.join(" ")));
const ID_LETTERS = new Set(Object.values(ALL_PREFIXES));

/** A record's ID of any kind as typed (P0001, p1, E0012) or an image by its book and number (B0001:57). */
export function isRecordRef(word: string): boolean {
  const w = word.trim();
  if (/^[Bb]\d+:\d+$/u.test(w)) return true;
  const m = /^([A-Za-z])\d+$/u.exec(w);
  return !!m && ID_LETTERS.has(m[1]!.toUpperCase());
}

/**
 * "person show P0001 P0002" (N0194): the show command of one record given several IDs — each shown in turn by
 * strom show, as if it had been typed (any kind: the one of each ID).
 */
export function severalRecords(def: CommandDef, args: string[]): boolean {
  return RECORD_SHOWS.has(def.path.join(" ")) && args.length > 1 && args.every(isRecordRef);
}

/** Required and surplus positional arguments; `fix`: the line as it is meant (parseOptions), said under a surplus one. */
export function checkArgs(def: CommandDef, args: string[], fix?: string, program = "strom"): void {
  const declared = def.args ?? [];
  const required = declared.filter((a) => a.required);
  if (args.length < required.length) {
    const missing = required[args.length]!;
    throw new UsageError(`missing <${missing.name}>: ${missing.description}`, { hint: `strom help ${def.path.join(" ")}`, code: "arg.missing", params: { arg: missing.name, cmd: def.path.join(" ") }, usage: usageOf(def) });
  }
  if (!declared.some((a) => a.variadic) && args.length > declared.length) {
    const extra = args[declared.length]!;
    // another record's ID after the one shown: never a value to quote — strom show takes several
    if (RECORD_SHOWS.has(def.path.join(" ")) && isRecordRef(extra)) {
      const line = `strom show ${args.filter(isRecordRef).join(" ")}`;
      throw new UsageError(`unexpected argument "${extra}"`, {
        hint: `several records: ${line}`,
        code: "arg.extra",
        hintCode: "arg.extra.several",
        params: { arg: extra, cmd: def.path.join(" "), line },
        usage: usageOf(def),
      });
    }
    const line = fix ? `${program ? `${program} ` : ""}${fix}` : undefined;
    throw new UsageError(`unexpected argument "${extra}"`, {
      // the line as it is meant: quoted values with spaces, a repeatable option once per value
      hint: line ? `as meant: ${line}` : `strom help ${def.path.join(" ")} — quote values with spaces`,
      code: "arg.extra",
      ...(line ? { hintCode: "arg.extra.fix" } : {}),
      params: { arg: extra, cmd: def.path.join(" "), ...(line ? { fix: line } : {}) },
      usage: usageOf(def),
    });
  }
}

/** Split off everything after a bare "--" (passed through to another program). */
export function splitPassthrough(rest: string[]): { rest: string[]; passthrough: string[] } {
  const i = rest.indexOf("--");
  return i < 0 ? { rest, passthrough: [] } : { rest: rest.slice(0, i), passthrough: rest.slice(i + 1) };
}

/** A usage error of a command that is about how it was called: one of its options named, or its help as the hint. */
export function callMistake(e: UsageError, def: CommandDef): boolean {
  if (e.hint?.startsWith(`strom help ${def.path.join(" ")}`)) return true;
  const named = [...e.message.matchAll(/--([\p{L}\p{N}-]+)/gu)].map((m) => m[1]!);
  return named.some((n) => n !== "reason" && optionsOf(def).some((o) => o.name === n && !o.hidden));
}
