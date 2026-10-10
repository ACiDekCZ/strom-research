// The commands a task of each level uses, with their exact options and limits — so the agent need not ask
// `strom help` for them in every session (K2/P5). Everything shown comes from the command registry (arguments,
// options, the values an option takes) and from the record schemas (how long a text may be): nothing is written
// twice by hand. Only which commands go with which level, and the few options a task hardly uses, are chosen here.

import { commands, WRITE_OPTIONS, type ArgDef, type CommandDef, type OptionDef } from "../cli/registry.ts";
import { SCHEMAS } from "../core/schema.ts";
import { NOTE_MAX, type RecordType } from "../core/model.ts";
import { INFORMATION } from "../core/evidence.ts";

// (strom grep: a text in the inputs and notes in one call — read in pieces instead, three big files cost a live run
// 110 reads)
const ALL = ["search add", "task add", "note add", "lesson add", "grep"];
const SCANS = ["media view", "read", "fetch"];
// what an entry read in a record writes: its source, its facts and names, the people and families it names
const ENTRY = ["source add", "event add", "event edit", "cite", "name add", "person add", "family add", "family child"];
const LEVELS: Record<string, string[]> = {
  link: [...ALL, ...SCANS, ...ENTRY, "family edit", "recordset add", "hypothesis add", "hypothesis argue", "conflict add", "task wait"],
  verify: [...ALL, ...SCANS, "source add", "source edit", "event edit", "cite", "name add", "conflict add", "hypothesis add", "hypothesis argue"],
  enrich: [...ALL, ...SCANS, ...ENTRY, "hypothesis add", "task wait"],
  locate: [...ALL, "place add", "place jurisdiction", "repo add", "recordset add", "fetch", "task edit", "task wait"],
  intake: [...ALL, "input sort", "input skip", "media view", ...ENTRY.filter((c) => c !== "event edit"), "person merge", "recordset add", "conflict add"],
  request: [...ALL, "task wait"],
  narrate: ["task add", "note add", "story set"],
  // a task that links hypotheses to the tree (METHOD_LINKS): it reads the hypotheses and their people, and links
  links: ["hypothesis show", "hypothesis link", "hypothesis argue", "hypothesis variant", "person show", "family show", "task add", "note add", "search add"],
};
/** Options a task hardly uses (another route, a reader's tuning): left out — strom help <command> has them. */
const RARE: Record<string, string[]> = {
  "search add": ["by"],
  "task add": ["research", "anyway"],
  "media view": ["scale", "max", "grey", "png", "image"],
  read: ["context", "batch", "parallel", "model", "minutes", "max"],
  fetch: ["take", "result"],
  "source add": ["translation", "media"],
  "source edit": ["translation", "media"],
  "recordset add": ["images"],
  grep: ["regex", "files"],
};
/** Where a source is cited — written once as +cite, the same in every command that takes all of it. */
const CITE = ["cite", "locator", "quote", "information"];
/** The values of an option whose description says them in words. */
const VALUES: Record<string, readonly string[]> = { information: INFORMATION };
/**
 * The commands that change what was known: their reason is asked — every writing command whose registry entry says
 * --reason (its summary, description or examples), so the sheet never drifts from what the command requires.
 */
const needsReason = (def: CommandDef) => Boolean(def.writes) && /--reason(?![\p{L}\p{N}-])/u.test([def.summary, def.description ?? "", ...(def.examples ?? [])].join("\n"));
/** The levels that read records and write facts from them: their sheet says what a status is for. */
const RECORDS = new Set(["link", "verify", "enrich", "intake"]);

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
  // what is in brackets says more of a value ("lead (default without --cite)"): the values are the words before it
  const words = o.description.replace(/\s*\([^()]*\)/gu, "").trim().split(/,\s*/u);
  const max = limit(def, o.name);
  if (VALUES[o.name]) return ` ${VALUES[o.name]!.join("|")}`;
  if (words.length > 1 && words.every((w) => /^[\p{L}\p{N}-]+$/u.test(w))) return ` ${words.join("|")}`;
  const v = o.value ?? "<value>";
  return ` ${max ? v.replace(/>$/u, ` ≤${max}>`) : v}`;
}

function arg(def: CommandDef, a: ArgDef): string {
  const max = limit(def, a.name);
  const name = `${a.name}${max ? ` ≤${max}` : ""}`;
  return a.required ? `<${name}>${a.variadic ? "…" : ""}` : `[${name}]${a.variadic ? "…" : ""}`;
}

function option(def: CommandDef, o: OptionDef): string {
  // what an option needs besides, as its description says it ("required with --result found")
  const needs = /required with (--[\p{L}\p{N}-]+(?: [\p{L}\p{N}-]+)?)/u.exec(o.description)?.[1];
  return `--${o.name}${value(def, o)}${o.multiple ? "…" : ""}${needs ? ` (with ${needs})` : ""}`;
}

/**
 * One command in one line: its arguments and its options, as the registry declares them — all of them, or (in the
 * sheet) those a task uses, the citation's written +cite where the command takes all of it.
 */
export function synopsis(def: CommandDef, sheet = false, add?: CommandDef): string {
  const name = def.path.join(" ");
  const reason = needsReason(def) ? WRITE_OPTIONS.filter((o) => o.name === "reason") : [];
  const opts = [...(def.options ?? []), ...reason].filter((o) => !o.hidden && !(sheet && RARE[name]?.includes(o.name)));
  const cites = sheet && CITE.every((c) => opts.some((o) => o.name === c));
  // an edit shown after its add: the options they share said once, as the add's
  const shared = add ? (add.options ?? []).filter((o) => !o.hidden && !(sheet && RARE[add.path.join(" ")]?.includes(o.name)) && opts.some((x) => x.name === o.name)) : [];
  const theirs = add ? (add.options ?? []).filter((o) => !o.hidden && !(sheet && RARE[add.path.join(" ")]?.includes(o.name)) && !shared.includes(o)) : [];
  const shown = opts.filter((o) => !(cites && CITE.includes(o.name)) && !shared.some((x) => x.name === o.name));
  const at = cites ? opts.findIndex((o) => o.name === "cite") : -1;
  const words = shown.map((o) => option(def, o));
  if (cites) words.splice(opts.slice(0, at).filter((o) => !CITE.includes(o.name) && !shared.some((x) => x.name === o.name)).length, 0, "+cite");
  if (add && shared.length) {
    const not = CITE.every((c) => theirs.some((o) => o.name === c)) ? ["+cite", ...theirs.filter((o) => !CITE.includes(o.name)).map((o) => `--${o.name}`)] : theirs.map((o) => `--${o.name}`);
    words.unshift(`[${add.path.join(" ")}'s options${not.length ? `, not ${not.join(" ")}` : ""}]`);
  }
  return ["strom", ...def.path, ...(def.args ?? []).map((a) => arg(def, a)), ...words].join(" ");
}

/** What +cite stands for, from the first command of the sheet that takes it. */
function citeLine(defs: CommandDef[]): string | undefined {
  const def = defs.find((d) => CITE.every((c) => d.options?.some((o) => o.name === c)));
  if (!def) return undefined;
  return `  +cite = ${CITE.map((c) => option(def, def.options!.find((o) => o.name === c)!)).join(" ")} — the record the line writes from`;
}

/** A connector of the task's places (with its archive), or another one installed. */
export interface SheetConnector {
  name: string;
  archive?: string;
  serves: boolean;
}

/** The connectors, in a line after fetch: those of the task's places first, the others by name. */
function connectorLine(list: SheetConnector[]): string {
  const serving = list.filter((c) => c.serves);
  const others = list.filter((c) => !c.serves);
  if (!list.length) return "  connectors: none installed — an archive's own: strom connector new <name> --url <portal>";
  return `  connectors${serving.length ? ` of these places: ${serving.map((c) => `${c.name}${c.archive ? ` = ${c.archive}` : ""}`).join(", ")}${others.length ? ` · others: ${others.map((c) => c.name).join(", ")}` : ""}` : `: ${others.map((c) => c.name).join(", ")}`} — books of a place: strom fetch <connector> --find "<place>" --years <from-to>`;
}

/** The section of the brief: the commands of this level, or nothing (no level, or no registry — a unit test). */
export function commandSheet(level: string | undefined, extra: { connectors?: SheetConnector[]; without?: readonly string[] } = {}): string {
  // (a command that cannot work in this session left out: strom read where no reader can start)
  const names = level ? LEVELS[level]?.filter((n) => !extra.without?.includes(n)) : undefined;
  if (!names) return "";
  const defs = names.map((n) => commands().find((c) => c.path.join(" ") === n)).filter((d): d is CommandDef => !!d);
  if (!defs.length) return "";
  const cite = citeLine(defs);
  return [
    "## Commands for this task (≤n: at most n characters; … repeatable — all options: strom help <command>)",
    // the mistakes that cost a turn most (N0180–N0188): words of one value not quoted, several values after one
    // option, a batch file changed by the shell (refused: only strom changes files from there)
    '  values with spaces in quotes (--note "two words"); a repeatable option once per value (--found S0001 --found S0002); a batch file in notes/: change it with your file-editing tool, not sed',
    // a status asked of a name or a family, proven with no primary information (N0190, N0191): refused, a turn lost
    ...(RECORDS.has(level!) ? ["  --status is a fact's (E…) only, never a name's or a family's; proven only with a record of the time read directly (--information primary), else probable"] : []),
    ...(cite ? [cite] : []),
    ...defs.flatMap((d) => [`  ${synopsis(d, true, d.path[1] === "edit" ? defs.find((x) => x.path[0] === d.path[0] && x.path[1] === "add") : undefined)}${d.sheet ? ` — ${d.sheet}` : ""}`, ...(d.path.join(" ") === "fetch" && extra.connectors ? [connectorLine(extra.connectors)] : [])]),
  ].join("\n");
}
