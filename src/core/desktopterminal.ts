// The terminal of Claude's desktop app (mcp__terminal__run_in_terminal) kept like the agent's Bash: the app runs the
// tree's hooks before it (seen 6 November 2026, the app 2.1.317), but not the tree's permission rules — a deny rule of
// Bash(…) does not reach a command typed into the app's terminal, and strom run there sees none of the agent's marks
// (CLAUDECODE …): it cannot tell the agent from the person. So the tree's hook before it (strom agents shell --hook)
// refuses what Bash would have refused — the bridge (core/bridgeguard.ts), each command a deny rule of the tree's
// Bash names (git, strom login, strom seal, strom connector add|remove; curl and wget under full permissions) — and the
// person's own commands of strom (CommandDef.person) and its consents (strom allow …), which through Bash strom refuses
// to the agent itself or asks the person in a window. Everything else goes on, the person asked by the app as before:
// the terminal is never added to the tree's allow rules. The agent is told to run strom through Bash (AGENTS.md).
// The hook never stands in the way by itself: anything wrong lets the command go.

import path from "node:path";
import { GLOBAL_OPTIONS, match } from "../cli/registry.ts";
import { readJsonIfExists } from "./json.ts";
import { ownCommand, type Env } from "./paths.ts";

/** The tools of Claude's desktop app that run a command in its terminal (tool_input.command). */
export const DESKTOP_TERMINAL_TOOLS = ["mcp__terminal__run_in_terminal"] as const;
/** Claude Code's matcher of strom's hook before them. */
export const DESKTOP_TERMINAL_MATCHER = DESKTOP_TERMINAL_TOOLS.join("|");

/** The tree's deny rules of Bash when its settings cannot be read (agents/files.ts treeRules writes the same). */
const DEFAULT_DENY = ["git", "strom login", "strom connector add", "strom connector remove", "strom seal"];

/** Why a rule denies a command, for the agent (the rule's first words). */
const WHY: Record<string, string> = {
  git: "strom keeps the history: never git itself",
  "strom login": "a login to an archive is the user's own, in their terminal",
  "strom seal": "the seal is the user's own, in their terminal",
  "strom connector add": "installing a plugin is the user's own, in their terminal",
  "strom connector remove": "removing a plugin is the user's own, in their terminal",
  curl: "downloads go through strom's limiter (strom fetch), never round it",
  wget: "downloads go through strom's limiter (strom fetch), never round it",
};

/** The deny rules of the tree's Bash (and PowerShell) as their words: Bash(strom login:*) → ["strom", "login"]. */
export function terminalDenyRules(root: string): string[][] {
  let rules: string[] | undefined;
  try {
    const s = readJsonIfExists<{ permissions?: { deny?: unknown } }>(path.join(root, ".claude", "settings.json"));
    const deny = s?.permissions?.deny;
    if (Array.isArray(deny))
      rules = deny
        .filter((r): r is string => typeof r === "string")
        .map((r) => /^(?:Bash|PowerShell)\((.+?)(?::\*|\s\*)?\)$/u.exec(r.trim())?.[1])
        .filter((r): r is string => !!r && !/[*?]/.test(r));
  } catch {
    rules = undefined;
  }
  const words = [...new Set(rules?.length ? rules : DEFAULT_DENY)].map((r) => r.split(/\s+/u).filter(Boolean));
  return words.filter((w) => w.length > 0);
}

/**
 * A shell command as its simple commands, each as its words: split where a shell runs another (; & | newline, a
 * subshell, a substitution), quotes taken off. A sketch of a shell's own reading, enough to find a command's name.
 */
export function simpleCommands(command: string): string[][] {
  const out: string[][] = [];
  let words: string[] = [];
  let word = "";
  let inWord = false;
  let quote: "'" | '"' | undefined;
  // what a closing parenthesis or backtick goes back to: inside double quotes again ($(…) or `…` in "…"), or not
  const opened: ('"' | undefined)[] = [];
  let tickInQuote = false;
  const endWord = () => {
    if (inWord) words.push(word.normalize("NFC"));
    word = "";
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length) out.push(words);
    words = [];
  };
  const text = command;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      if (c === quote) quote = undefined;
      else if (c === "\\" && quote === '"' && /["\\$`]/.test(text[i + 1] ?? "")) word += text[++i];
      else if (quote === '"' && c === "$" && text[i + 1] === "(") {
        // a substitution inside double quotes runs a command of its own
        endCommand();
        opened.push('"');
        quote = undefined;
        i++;
      } else if (quote === '"' && c === "`") {
        endCommand();
        tickInQuote = true;
        quote = undefined;
      } else {
        word += c;
        inWord = true;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
      continue;
    }
    // a backslash before a character a shell would read otherwise (never a Windows path's own: C:\Users)
    if (c === "\\" && /[\s"'\\;&|()`$<>]/.test(text[i + 1] ?? "")) {
      const next = text[++i]!;
      if (next !== "\n") {
        word += next;
        inWord = true;
      }
      continue;
    }
    if (c === "$" && text[i + 1] === "(") {
      endCommand();
      opened.push(undefined);
      i++;
      continue;
    }
    if (c === "(") opened.push(undefined);
    if ((c === ")" && opened.pop() === '"') || (c === "`" && tickInQuote)) {
      // back inside the double quotes the substitution stood in
      endCommand();
      if (c === "`") tickInQuote = false;
      quote = '"';
      continue;
    }
    if (/[;&|()`\n\r{}]/.test(c)) {
      endCommand();
      continue;
    }
    if (/\s/u.test(c)) {
      endWord();
      continue;
    }
    word += c;
    inWord = true;
  }
  endCommand();
  return out;
}

/** What runs another command before its own (env, command, exec …): its words taken off, the command after them is the one. */
const WRAPPERS = new Set(["env", "command", "exec", "nohup", "time", "builtin", "noglob", "nice", "sudo", "doas", "caffeinate", "xargs", "call", "start", "cmd"]);

/** A command's name as a rule names it: no folder, no .cmd/.exe, lowercase. */
const nameOf = (w: string) =>
  (w.split(/[\\/]/u).pop() ?? w)
    .toLowerCase()
    .replace(/\.(?:cmd|exe|bat|ps1)$/u, "");

/** The words of a simple command from its program on: assignments (A=1) and wrappers taken off. */
function programWords(words: string[]): string[] {
  let i = 0;
  while (i < words.length) {
    const w = words[i]!;
    if (/^[\p{L}_][\p{L}\p{N}_]*=/u.test(w)) i++;
    else if (WRAPPERS.has(nameOf(w))) {
      i++;
      // the wrapper's own switches (env -i, nice -n 5: a number after one too; cmd /c)
      while (i < words.length && (/^-/.test(words[i]!) || /^\d+$/.test(words[i]!) || /^\/[ck]$/i.test(words[i]!))) i++;
    } else break;
  }
  return words.slice(i);
}

/** strom's words after its name, its global options (strom --json --tree X seal) taken off. */
function stromWords(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w === "--") break;
    if (out.length === 0 && w.startsWith("-")) {
      const name = w.replace(/^-+/, "").replace(/=.*$/, "");
      const def = GLOBAL_OPTIONS.find((o) => o.name === name || o.short === name);
      if (def?.type === "string" && !w.includes("=")) i++;
      continue;
    }
    out.push(w);
  }
  return out;
}

/** strom under another name: the other channel's (strom-beta), a second installation's (strom-<suffix>), the package's. */
const STROM_NAME = /^strom(?:-[\p{L}\p{N}_.]+)*$/u;

/** A package runner's words before the package it runs (npx -y, npm exec --, pnpm dlx, yarn dlx, bunx). */
const RUNNERS: Record<string, string[]> = { npx: [], bunx: [], pnpx: [], npm: ["exec", "x"], pnpm: ["dlx", "exec"], yarn: ["dlx", "exec"], bun: ["x"] };

/** The package a runner's word names: strom-research@beta, @scope/x@1 — its name without the version. */
const packageOf = (w: string) => w.replace(/^(@?[^@]*)@.*$/u, "$1").toLowerCase();

/**
 * Where strom's own words begin in a simple command's program words, else -1: strom by any of its names or by a path to
 * it, the package run through npx and its kin, node running strom's cli from its folder.
 */
function stromAt(words: string[], own: string | undefined): number {
  const name = nameOf(words[0]!);
  if (STROM_NAME.test(name) || (!!own && name === own)) return 1;
  const sub = RUNNERS[name];
  if (sub) {
    let i = 1;
    if (sub.length) {
      if (!sub.includes(words[i] ?? "")) return -1;
      i++;
    }
    // the runner's switches (-y, --yes, --package=x, -p x): the package named by one counts as well
    let pkg: string | undefined;
    while (i < words.length && words[i]!.startsWith("-")) {
      const w = words[i++]!;
      if (w === "--") break;
      if (w === "-p" || w === "--package") pkg = words[i++];
      else if (w.startsWith("--package=")) pkg = w.slice("--package=".length);
    }
    if (words[i] === "--") i++;
    const run = words[i];
    if (!run) return -1;
    if (packageOf(run) === "strom-research" || STROM_NAME.test(nameOf(run))) return i + 1;
    return pkg && packageOf(pkg) === "strom-research" ? i + 1 : -1;
  }
  if (name === "node" || name === "bun" || name === "tsx") {
    let i = 1;
    while (i < words.length && words[i]!.startsWith("-")) i++;
    const file = (words[i] ?? "").replace(/\\/gu, "/");
    if (/(?:^|\/)strom[^/]*\/(?:dist\/cli\.js|src\/cli\.ts)$/u.test(file) || /(?:^|\/)bin\/strom(?:-[^/]*)?$/u.test(file)) return i + 1;
  }
  return -1;
}

/**
 * Why a command typed into the desktop app's terminal is refused, else undefined: a deny rule of the tree's Bash, a
 * command of strom's that is the person's own, a consent of strom's — strom under any of its names (N1 of 062).
 */
export function desktopTerminalRefusal(root: string, command: string, env: Env): string | undefined {
  const own = ownCommand(env);
  const isStrom = (name: string) => STROM_NAME.test(name) || (!!own && name === own);
  const rules = terminalDenyRules(root);
  for (const raw of simpleCommands(command)) {
    const words = programWords(raw);
    if (!words.length) continue;
    const at = stromAt(words, own);
    const strom = at > 0;
    const name = strom ? "strom" : nameOf(words[0]!);
    const rest = strom ? stromWords(words.slice(at)) : words.slice(1);
    for (const rule of rules) {
      const [head, ...tail] = rule;
      const first = nameOf(head!);
      if (!(first === name || (strom && isStrom(first)))) continue;
      if (tail.every((t, i) => rest[i] === t)) {
        const said = rule.join(" ");
        const why = WHY[said.replace(/^\S+/u, (h) => (isStrom(nameOf(h)) ? "strom" : h))];
        return `strom: ${said} is denied to you in this tree — the app's terminal keeps the tree's rules of Bash${why ? ` (${why})` : ""}. Go another way, or say what was refused.`;
      }
    }
    if (!strom || !rest.length) continue;
    if (rest[0] === "allow")
      return "strom: a consent (strom allow …) never through the app's terminal — there strom cannot tell you from the person. Run strom commands through Bash: strom asks the person in a window there.";
    const def = match(rest)?.def;
    if (def?.person)
      return `strom: ${def.person} — never yours, in the app's terminal neither (there strom cannot tell you from the person). Run strom commands through Bash; what is the person's they run themselves.`;
  }
  return undefined;
}
