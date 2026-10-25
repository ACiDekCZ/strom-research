// Help text generated from the registry. Short by design: examples first,
// then arguments and options.

import { GROUPS, GROUP_ALIASES, GLOBAL_OPTIONS, WRITE_OPTIONS, aliasGroup, commands, descriptionOf, match, subcommandsOf, usageLine, type CommandDef, type OptionDef } from "./registry.ts";
import { table } from "./format.ts";
import type { ShownAppUrl } from "../core/stromapp.ts";
import { suggest } from "./execute.ts";
import { UI, ui, type UIKey } from "./ui.ts";

function optionRows(opts: OptionDef[]): string[][] {
  return opts.map((o) => [`--${o.name}${o.value ? ` ${o.value}` : ""}${o.multiple ? " (repeatable)" : ""}`, `${o.description}${o.max ? ` (≤${o.max} characters)` : ""}`]);
}

/** Other names a command and its options are taken by: one line, never commands of their own. */
function aliasLine(def: CommandDef, own: OptionDef[]): string | undefined {
  const names = [...(def.aliases ?? []).map((a) => `strom ${a.join(" ")}`), ...own.flatMap((o) => (o.aliases ?? []).map((a) => `--${a} (= --${o.name})`))];
  return names.length ? `Also: ${names.join(" · ")}` : undefined;
}

/**
 * An archive's help (the tree worked on is one): nothing of an agent or AI (Milan's decision, 2026-10-03) — only the
 * commands an archive uses (its data come from the Strom app: what came, what it holds, its history, its checks, this
 * computer's setup), said without them; the research's own work (tasks, sessions, readers, connectors, searches,
 * hypotheses) left out (found on Windows: session, brief, gate, read offered in an archive).
 */
export const AI_WORDS = /\bagents?\b|\bAI\b|Claude|Codex|OpenCode|Grok|Antigravity|\bmodels?\b/i;
/** The research's own work an archive has none of: its tasks, their queue, sessions (found: intake's task, task wake). */
const WORK_WORDS = /\btasks?\b|\bqueue[ds]?\b|\bsessions?\b/i;
/** Said nowhere in an archive's help (English, strom's own texts: \b is safe here). */
const notInArchive = (text: string): boolean => AI_WORDS.test(text) || WORK_WORDS.test(text);
const ARCHIVE_COMMANDS = new Set([
  "help", "menu", "status", "tidy",
  "init", "trees", "trees use", "trees remove", "mode", "lang", "pack", "unpack", "backup", "sync", "sync undo", "sync discard",
  "intake", "input list", "input show", "conflict list", "conflict show", "conflict resolve",
  "person list", "person show", "person card", "family show", "source list", "source show", "media list", "media show",
  "find", "stats", "pedigree", "recent", "history",
  "export gedcom", "gedcom validate", "app", "app install", "live", "live start", "live stop",
  "check", "verify", "repair", "seal adopt",
  "phone", "phone status", "phone on", "phone qr", "phone off", "phone list", "phone remove",
  "setup", "doctor", "update", "config where", "config get", "config set", "config unset", "uninstall", "shortcut",
  "hook list", "hook on", "hook off", "hook test", "link on", "link off", "link status",
]);
const ARCHIVE_SUMMARY: Record<string, string> = {
  doctor: "Check everything strom needs: the program, git, folders, the Strom app, the current tree",
  mode: "An archive of the data from the Strom app, or a research: show it, or switch (the user alone)",
  recent: "What came in lately: new people, facts added or refined, records, stories",
  stats: "The family tree at a glance: people, facts and how sure they are, the ancestors known in each generation",
  pack: "Pack the family tree into one ZIP file for someone to go on with it (the tree and the images its records stand on)",
  intake: "Take in material from the family: folders, files, or what they know",
  find: "Full-text search across everything (people, sources, transcripts, notes)",
  "conflict list": "Conflicts to decide: the same fact edited differently in the Strom app and here (or in two browsers)",
  "conflict resolve": "Decide a conflict: the value from the Strom app or the archive's (--take user|research), and why",
  uninstall: "Take strom off this computer: the shortcut, its own git, its PATH lines and the program — the trees and the settings stay",
};
/**
 * An archive's own description of a command whose description tells of the research's work ("" = none): the rest of
 * a description that does is left out whole.
 */
const ARCHIVE_DESCRIPTION: Record<string, string> = {
  intake:
    "Every file is registered unchanged as an input (duplicates skipped) and kept with the family tree.\n" +
    "Files up to 20 MB are kept in the tree (and its history); bigger ones in shared/media.\n" +
    "Family trees are imported at once — every person and fact as a lead citing that tree.",
  live:
    "A small web server on this computer only (127.0.0.1, a secret address), that only reads: the Strom app, opened with\n" +
    "strom app --live, takes the tree from it and hears what changes. It ends by itself when nobody asks it anything for\n" +
    "two hours, or with strom live stop. One error does not end it; what it did and what went wrong is in .strom/live.log.\n" +
    "Started again by itself (strom updated) it takes the address it had, so the app following it goes on by itself.",
  phone:
    "A server of its own on this computer's private addresses (Wi-Fi or a cable at home: 10.x, 172.16–31.x, 192.168.x —\n" +
    "never every address, never a VPN's or a virtual machine's), port 47800 (the next free one when another program has\n" +
    "it). It answers only devices of that network that ask it by its own address. On or off is this computer's, the\n" +
    "same for every family tree. Turned on by the user alone (their terminal, or a window of the system); turned off by\n" +
    "anyone, the paired phones stay paired. What it did: phone.log in strom's settings folder.",
};
/** An archive's own words for an option whose usual ones tell of the research's work ("<command> --<option>"). */
const ARCHIVE_OPTION: Record<string, string> = {
  "intake --person": "the person it is of, as the user says (repeatable): kept with them",
  "find --type": "only one record type: person, family, source, repository, place, conflict, input, media",
  "person list --unproven": "only people no record of their own proves: how each stands, the records naming them",
};
/** Options an archive has no use for, though their words say nothing of the work: a research (G…) is the agent's. */
const ARCHIVE_HIDDEN = new Set(["intake --research"]);

function inArchive(def: CommandDef): string | undefined {
  const name = def.path.join(" ");
  if (!ARCHIVE_COMMANDS.has(name)) return undefined;
  const own = ARCHIVE_SUMMARY[name];
  if (own) return own;
  return notInArchive(def.summary) ? undefined : def.summary;
}

/** A command's options as an archive shows them: its own words where it has them, what tells of the work left out. */
function archiveOptions(def: CommandDef, opts: OptionDef[]): OptionDef[] {
  const name = def.path.join(" ");
  return opts.flatMap((o) => {
    const key = `${name} --${o.name}`;
    if (ARCHIVE_HIDDEN.has(key)) return [];
    const own = ARCHIVE_OPTION[key];
    if (own) return [{ ...o, description: own }];
    return notInArchive(o.description) ? [] : [o];
  });
}

/** A command's examples as an archive shows them: none that tells of the work or uses an option it leaves out. */
function archiveExamples(def: CommandDef): string[] {
  const all = [...(def.options ?? []), ...(def.writes ? WRITE_OPTIONS : [])];
  const kept = new Set(archiveOptions(def, all).map((o) => o.name));
  const gone = all.filter((o) => !kept.has(o.name)).map((o) => o.name);
  return (def.examples ?? []).filter((e) => !notInArchive(e) && !gone.some((n) => new RegExp(`(^|\\s)--${n}(\\s|=|$)`).test(e)));
}

/** Said of a command an archive (or a research waiting for its agent) does not use. */
function notHere(name: string, waiting: boolean): string {
  return waiting
    ? `strom ${name}: not while the research waits for its agent (the person installs or chooses it: strom setup)`
    : `strom ${name}: not in an archive (research is switched on by the user: strom mode research)`;
}

export function commandHelp(def: CommandDef, archive: boolean, appUrl: ShownAppUrl, waiting = false): string {
  const summary = archive ? inArchive(def) : def.summary;
  if (summary === undefined) return notHere(def.path.join(" "), waiting);
  const out: string[] = [usageLine(def), "", summary];
  const name = def.path.join(" ");
  const description = archive && name in ARCHIVE_DESCRIPTION ? ARCHIVE_DESCRIPTION[name] : descriptionOf(def, appUrl);
  if (description && !(archive && notInArchive(description))) out.push("", description);
  const examples = archive ? archiveExamples(def) : (def.examples ?? []);
  if (examples.length) out.push("", "Examples:", ...examples.map((e) => `  ${e}`));
  if (def.args?.length) out.push("", "Arguments:", table(def.args.map((a) => [`  ${a.name}`, a.description])));
  const all = [...(def.options ?? []), ...(def.writes ? WRITE_OPTIONS : [])].filter((o) => !o.hidden);
  const own = archive ? archiveOptions(def, all) : all;
  if (own.length) out.push("", "Options:", table(optionRows(own).map(([a, b]) => [`  ${a}`, b ?? ""])));
  const also = aliasLine(def, own);
  if (also) out.push("", also);
  out.push("", "Global options: --tree --json --limit --page --lang --yes --debug   (all: strom help)");
  return out.join("\n");
}

export function groupHelp(prefix: string[], archive = false, waiting = false): string {
  const subs = subcommandsOf(prefix).flatMap((c) => {
    const summary = archive ? inArchive(c) : c.summary;
    return summary === undefined ? [] : [[`  ${c.path.join(" ")}`, summary]];
  });
  if (!subs.length) return notHere(prefix.join(" "), waiting);
  const also = prefix.length === 1 ? Object.entries(GROUP_ALIASES).filter(([, g]) => g === prefix[0]).map(([a]) => `strom ${a} <command>`) : [];
  return [
    `strom ${prefix.join(" ")} <command>`,
    "",
    table(subs),
    "",
    `Details: strom help ${prefix.join(" ")} <command>`,
    ...(also.length ? [`Also: ${also.join(" · ")}`] : []),
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
  const globals = GLOBAL_OPTIONS.filter((o) => !(archive && notInArchive(o.description)));
  out.push("", "Global options:", table(optionRows(globals).map(([a, b]) => [`  ${a}`, b ?? ""])));
  out.push(
    "",
    "One command — usage, examples, options: strom help <command>",
    archive ? "Each command with what it does: strom commands <group>" : "Each command with what it does: strom commands [<group>] · with options and examples: strom commands <group> --json",
  );
  return out.join("\n");
}

export function helpFor(input: string[], archive: boolean, appUrl: ShownAppUrl, waiting = false): string {
  // "strom help 'research new'" — one quoted argument with several words.
  const words = input.flatMap((w) => w.trim().split(/\s+/)).filter(Boolean);
  if (words.length === 0) return overview(archive);
  const found = match(words);
  if (found && found.used === words.length) return commandHelp(found.def, archive, appUrl, waiting);
  if (subcommandsOf(words).length > 0) return groupHelp(words, archive, waiting);
  const real = aliasGroup(words);
  if (real) return groupHelp(real, archive, waiting);
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
  "intake", "sync", "sync undo", "sync discard", "conflict list", "conflict resolve", "task list", "task wake", "story approve", "story discard",
  "stats", "recent", "plan", "history", "person card", "person list", "pedigree", "find",
  "app", "app install", "live", "live start", "live stop", "phone", "phone on", "phone qr", "phone off", "export gedcom", "pack", "unpack", "backup", "tidy", "check", "media calibrate",
  "config get", "config set", "login", "connector use", "link on", "link off", "hook on", "hook off",
];

export interface HelpAs {
  /** Shown as an archive: nothing of an agent or of the research's work (an archive, a research waiting for its agent). */
  archive: boolean;
  /** A research waiting for its agent (not on this computer): an archive's help, said as the research's. */
  waiting?: boolean;
  /** A person's help in `lang` (strom help --human); else the catalog an agent reads — the default, whoever asks. */
  human: boolean;
  lang: string;
  /** The copy of the Strom app `strom app` opens here (appUrlShown): what a command's help names as its address. */
  appUrl: ShownAppUrl;
  /** A person at a terminal reads the agent's help: one line at its end, in their language, says how to get theirs. */
  pointer?: boolean;
}

function humanOf(name: string, as: HelpAs): string | undefined {
  if (!HUMAN_COMMANDS.includes(name) || (as.archive && !ARCHIVE_COMMANDS.has(name))) return undefined;
  const k = name.replace(/ /g, ".");
  const own = as.archive && !as.waiting && `ui.help.archive.${k}` in UI ? `ui.help.archive.${k}` : `ui.help.cmd.${k}`;
  return ui(as.lang, own as UIKey);
}

/** Where strom's source code is: the last line of a person's help (GNU AGPL 3.0 or later, its section 13). */
export const SOURCE_URL = "https://github.com/ACiDekCZ/strom-research";

function humanOverview(as: HelpAs): string {
  const rows = HUMAN_COMMANDS.flatMap((name) => {
    const said = humanOf(name, as);
    return said ? [[`  strom ${name}`, said]] : [];
  });
  const more = ui(as.lang, as.archive ? "ui.help.more.archive" : "ui.help.more");
  return [ui(as.lang, "ui.help.title"), "", table(rows), "", more, ui(as.lang, "ui.help.source", { url: SOURCE_URL })].join("\n");
}

function humanCommand(def: CommandDef, as: HelpAs): string {
  const name = def.path.join(" ");
  const said = humanOf(name, as);
  if (!said) return ui(as.lang, notSaid(name, as), { cmd: name });
  const examples = as.archive ? archiveExamples(def) : (def.examples ?? []);
  // an archive says nothing of an agent: the English details not pointed to there
  return [usageLine(def), "", said, ...(examples.length ? ["", ui(as.lang, "ui.help.examples"), ...examples.map((e) => `  ${e}`)] : []), ...(as.archive ? [] : ["", ui(as.lang, "ui.help.details", { cmd: name })])].join("\n");
}

/**
 * Why a person's help has no sentence for a command: not used here (an archive; a research waiting for its agent), a
 * command an archive uses with its help in English only (never "the agent's" there), or the agent's own.
 */
function notSaid(name: string, as: HelpAs): UIKey {
  if (as.archive && !ARCHIVE_COMMANDS.has(name)) return as.waiting ? "ui.help.notwaiting" : "ui.help.notarchive";
  return as.archive ? "ui.help.english" : "ui.help.agentonly";
}

function humanGroup(prefix: string[], as: HelpAs): string {
  const name = prefix.join(" ");
  const rows = subcommandsOf(prefix).flatMap((c) => {
    const said = humanOf(c.path.join(" "), as);
    return said ? [[`  strom ${c.path.join(" ")}`, said]] : [];
  });
  if (!rows.length) return ui(as.lang, as.archive ? (as.waiting ? "ui.help.notwaiting" : "ui.help.notarchive") : "ui.help.agentonly", { cmd: name });
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
  if (!as.human) return helpFor(words, as.archive, as.appUrl, as.waiting) + pointer(words, as);
  if (words.length === 0) return humanOverview(as);
  const found = match(words);
  if (found && found.used === words.length) return humanCommand(found.def, as);
  if (subcommandsOf(words).length > 0) return humanGroup(words, as);
  const real = aliasGroup(words);
  if (real) return humanGroup(real, as);
  const all = commands().filter((c) => c.path.length > 0).map((c) => c.path.join(" "));
  const near = suggest(words.join(" "), all.filter((c) => c.split(" ").length === words.length));
  return [ui(as.lang, "ui.help.unknown", { cmd: words.join(" ") }), ...near.map((c) => `  strom help ${c} --human`)].join("\n");
}

/** A group's help (`strom research`): the agent's, the line for a person at a terminal at its end. */
export function groupHelpAs(prefix: string[], as: HelpAs): string {
  return as.human ? humanGroup(prefix, as) : groupHelp(prefix, as.archive, as.waiting) + pointer(prefix, as);
}
