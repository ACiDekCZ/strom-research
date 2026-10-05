// Help text generated from the registry. Short by design: examples first,
// then arguments and options.

import { GROUPS, GLOBAL_OPTIONS, WRITE_OPTIONS, commands, match, subcommandsOf, usageLine, type CommandDef, type OptionDef } from "./registry.ts";
import { table } from "./format.ts";
import { suggest } from "./execute.ts";
import { UI, ui, type UIKey } from "./ui.ts";

function optionRows(opts: OptionDef[]): string[][] {
  return opts.map((o) => [`--${o.name}${o.value ? ` ${o.value}` : ""}${o.multiple ? " (repeatable)" : ""}`, o.description]);
}

/**
 * An archive's help (the tree worked on is one): nothing of an agent or AI (Milan's decision, 2026-10-03) — only the
 * commands an archive uses (its data come from the Strom app: what came, what it holds, its history, its checks, this
 * computer's setup), said without them; the research's own work (tasks, sessions, readers, connectors, searches,
 * hypotheses) left out (found on Windows: session, brief, gate, read offered in an archive).
 */
export const AI_WORDS = /\bagents?\b|\bAI\b|Claude|Codex|OpenCode|Grok|Antigravity|\bmodels?\b/i;
const ARCHIVE_COMMANDS = new Set([
  "help", "menu", "status", "tidy",
  "init", "trees", "trees use", "trees remove", "mode", "lang", "pack", "unpack", "sync", "sync undo", "sync discard",
  "intake", "input list", "input show",
  "person list", "person show", "person card", "family show", "source list", "source show", "media list", "media show",
  "find", "stats", "pedigree", "recent", "history",
  "export gedcom", "gedcom validate", "app", "app install", "live", "live start", "live stop",
  "check", "verify", "repair", "seal adopt",
  "setup", "doctor", "update", "config where", "config get", "config set", "config unset", "uninstall", "shortcut",
  "hook list", "hook on", "hook off", "hook test", "link on", "link off", "link status",
]);
const ARCHIVE_SUMMARY: Record<string, string> = {
  doctor: "Check everything strom needs: the program, git, folders, the Strom app, the current tree",
  mode: "An archive of the data from the Strom app, or a research: show it, or switch (the user alone)",
  recent: "What came in lately: new people, facts added or refined, records, stories",
  stats: "The archive at a glance: people, facts and how sure they are, the ancestors known in each generation",
  pack: "Pack the archive into one ZIP file for someone to go on with it (the tree and the images its records stand on)",
  intake: "Take in material from the family: folders, files, or what they know",
  uninstall: "Take strom off this computer: the shortcut, its own git, its PATH lines and the program — the trees and the settings stay",
};
function inArchive(def: CommandDef): string | undefined {
  const name = def.path.join(" ");
  if (!ARCHIVE_COMMANDS.has(name)) return undefined;
  const own = ARCHIVE_SUMMARY[name];
  if (own) return own;
  return AI_WORDS.test(def.summary) ? undefined : def.summary;
}

export function commandHelp(def: CommandDef, archive = false): string {
  const summary = archive ? inArchive(def) : def.summary;
  if (summary === undefined) return `strom ${def.path.join(" ")}: not in an archive (research is switched on by the user: strom mode research)`;
  const out: string[] = [usageLine(def), "", summary];
  if (def.description && !(archive && AI_WORDS.test(def.description))) out.push("", def.description);
  const examples = (def.examples ?? []).filter((e) => !(archive && AI_WORDS.test(e)));
  if (examples.length) out.push("", "Examples:", ...examples.map((e) => `  ${e}`));
  if (def.args?.length) out.push("", "Arguments:", table(def.args.map((a) => [`  ${a.name}`, a.description])));
  const own = [...(def.options ?? []), ...(def.writes ? WRITE_OPTIONS : [])].filter((o) => !(archive && AI_WORDS.test(o.description)));
  if (own.length) out.push("", "Options:", table(optionRows(own).map(([a, b]) => [`  ${a}`, b ?? ""])));
  out.push("", "Global options: --tree --json --limit --page --lang --yes --debug   (all: strom help)");
  return out.join("\n");
}

export function groupHelp(prefix: string[], archive = false): string {
  const subs = subcommandsOf(prefix).flatMap((c) => {
    const summary = archive ? inArchive(c) : c.summary;
    return summary === undefined ? [] : [[`  ${c.path.join(" ")}`, summary]];
  });
  if (!subs.length) return `strom ${prefix.join(" ")}: not in an archive (research is switched on by the user: strom mode research)`;
  return [
    `strom ${prefix.join(" ")} <command>`,
    "",
    table(subs),
    "",
    `Details: strom help ${prefix.join(" ")} <command>`,
  ].join("\n");
}

/** Words joined with " · ", wrapped to lines of about `width`, the next ones indented. */
function wrapped(head: string, words: string[], width = 110): string {
  const out: string[] = [];
  let line = head;
  for (const w of words) {
    const next = line.endsWith(": ") ? `${line}${w}` : `${line} · ${w}`;
    if (next.length > width && !line.endsWith(": ")) {
      out.push(line);
      line = `    ${w}`;
    } else line = next;
  }
  out.push(line);
  return out.join("\n");
}

/**
 * Overview of all commands, grouped — their names only (an agent reads it whole: a few kB, never the whole catalog);
 * each with its summary: strom commands [<group>], one command: strom help <command>.
 */
export function overview(archive = false): string {
  const out: string[] = [archive ? "strom <command> [options]" : "strom <command> [options]      (strom guide — how to do research with strom)", ""];
  for (const [group, title] of Object.entries(GROUPS)) {
    const names = commands()
      .filter((c) => c.group === group && c.path.length > 0 && (!archive || inArchive(c) !== undefined))
      .map((c) => c.path.join(" "));
    if (names.length === 0) continue;
    out.push(wrapped(`${title} [${group}]: `, names));
  }
  const globals = GLOBAL_OPTIONS.filter((o) => !(archive && AI_WORDS.test(o.description)));
  out.push("", "Global options:", table(optionRows(globals).map(([a, b]) => [`  ${a}`, b ?? ""])));
  out.push(
    "",
    "One command — usage, examples, options: strom help <command>",
    archive ? "Each command with what it does: strom commands <group>" : "Each command with what it does: strom commands [<group>] · with options and examples: strom commands <group> --json",
  );
  return out.join("\n");
}

export function helpFor(input: string[], archive = false): string {
  // "strom help 'research new'" — one quoted argument with several words.
  const words = input.flatMap((w) => w.trim().split(/\s+/)).filter(Boolean);
  if (words.length === 0) return overview(archive);
  const found = match(words);
  if (found && found.used === words.length) return commandHelp(found.def, archive);
  if (subcommandsOf(words).length > 0) return groupHelp(words, archive);
  const all = commands().filter((c) => c.path.length > 0).map((c) => c.path.join(" "));
  const near = suggest(words.join(" "), all.filter((c) => c.split(" ").length === words.length));
  return `unknown command "${words.join(" ")}"${near.length ? ` — similar command: ${near.map((c) => `strom help ${c}`).join(" · ")}` : ""}\nall commands: strom help`;
}

// ── for a person ────────────────────────────────────────────────────────────
// `strom help --human` speaks the research language (Milan, 2026-10-04: "ty používané"): the commands a person uses,
// one sentence each; one of them: its sentence, usage and examples; any other: a command of the agent. Without it,
// `strom help` is the English catalog an agent reads — the default (Milan, 2026-10-04: "výchozí je pro agenta").

/** The commands a person uses, in the order a person meets them. */
export const HUMAN_COMMANDS = [
  "menu", "status", "setup", "doctor", "update", "uninstall", "shortcut",
  "init", "trees", "trees use", "trees remove", "lang", "mode",
  "chat", "run", "session finish", "research new", "research pause", "research resume", "research done", "review",
  "intake", "sync", "sync undo", "sync discard", "task list", "task wake", "story approve", "story discard",
  "stats", "recent", "plan", "history", "person card", "person list", "pedigree", "find",
  "app", "app install", "live start", "live stop", "export gedcom", "pack", "unpack", "tidy", "check",
  "config get", "config set", "login", "connector use", "link on", "link off", "hook on", "hook off",
];

export interface HelpAs {
  archive: boolean;
  /** A person's help in `lang` (strom help --human); else the catalog an agent reads — the default, whoever asks. */
  human: boolean;
  lang: string;
  /** A person at a terminal reads the agent's help: one line at its end, in their language, says how to get theirs. */
  pointer?: boolean;
}

function humanOf(name: string, as: HelpAs): string | undefined {
  if (!HUMAN_COMMANDS.includes(name) || (as.archive && !ARCHIVE_COMMANDS.has(name))) return undefined;
  const k = name.replace(/ /g, ".");
  const own = as.archive && `ui.help.archive.${k}` in UI ? `ui.help.archive.${k}` : `ui.help.cmd.${k}`;
  return ui(as.lang, own as UIKey);
}

function humanOverview(as: HelpAs): string {
  const rows = HUMAN_COMMANDS.flatMap((name) => {
    const said = humanOf(name, as);
    return said ? [[`  strom ${name}`, said]] : [];
  });
  return [ui(as.lang, "ui.help.title"), "", table(rows), "", ui(as.lang, as.archive ? "ui.help.more.archive" : "ui.help.more")].join("\n");
}

function humanCommand(def: CommandDef, as: HelpAs): string {
  const name = def.path.join(" ");
  const said = humanOf(name, as);
  if (!said) return ui(as.lang, as.archive && !ARCHIVE_COMMANDS.has(name) ? "ui.help.notarchive" : "ui.help.agentonly", { cmd: name });
  const examples = (def.examples ?? []).filter((e) => !(as.archive && AI_WORDS.test(e)));
  // an archive says nothing of an agent: the English details not pointed to there
  return [usageLine(def), "", said, ...(examples.length ? ["", ui(as.lang, "ui.help.examples"), ...examples.map((e) => `  ${e}`)] : []), ...(as.archive ? [] : ["", ui(as.lang, "ui.help.details", { cmd: name })])].join("\n");
}

function humanGroup(prefix: string[], as: HelpAs): string {
  const name = prefix.join(" ");
  const rows = subcommandsOf(prefix).flatMap((c) => {
    const said = humanOf(c.path.join(" "), as);
    return said ? [[`  strom ${c.path.join(" ")}`, said]] : [];
  });
  if (!rows.length) return ui(as.lang, as.archive ? "ui.help.notarchive" : "ui.help.agentonly", { cmd: name });
  return [ui(as.lang, "ui.help.group", { cmd: name }), "", table(rows), "", ui(as.lang, as.archive ? "ui.help.more.archive" : "ui.help.more")].join("\n");
}

/** The line at the end of the agent's help a person at a terminal reads: their own help, in their language. */
function pointer(words: string[], as: HelpAs): string {
  // an archive says nothing of an agent
  return as.pointer ? `\n\n${ui(as.lang, as.archive ? "ui.help.human.archive" : "ui.help.human", { cmd: words.length ? ` ${words.join(" ")}` : "" })}` : "";
}

/**
 * Help: the catalog an agent reads, whoever asks (Milan, 2026-10-04: an agent always finds its whole interface, never
 * a person's shorter help — whether strom knows it is an agent or not, with a terminal or without); a person's in
 * their language with --human.
 */
export function helpAs(input: string[], as: HelpAs): string {
  const words = input.flatMap((w) => w.trim().split(/\s+/)).filter(Boolean);
  if (!as.human) return helpFor(words, as.archive) + pointer(words, as);
  if (words.length === 0) return humanOverview(as);
  const found = match(words);
  if (found && found.used === words.length) return humanCommand(found.def, as);
  if (subcommandsOf(words).length > 0) return humanGroup(words, as);
  const all = commands().filter((c) => c.path.length > 0).map((c) => c.path.join(" "));
  const near = suggest(words.join(" "), all.filter((c) => c.split(" ").length === words.length));
  return [ui(as.lang, "ui.help.unknown", { cmd: words.join(" ") }), ...near.map((c) => `  strom help ${c} --human`)].join("\n");
}

/** A group's help (`strom research`): the agent's, the line for a person at a terminal at its end. */
export function groupHelpAs(prefix: string[], as: HelpAs): string {
  return as.human ? humanGroup(prefix, as) : groupHelp(prefix, as.archive) + pointer(prefix, as);
}
