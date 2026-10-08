// Teaching an agent CLI about strom in any folder: a user who opens Claude
// Code, Codex or Antigravity anywhere and says "I want to research my ancestors"
// gets an agent that knows strom is there and how to start. Claude Code gets
// a skill of its own; Codex and Antigravity a marked block in their
// global instruction file (the user's own text around it is kept) — and in
// the settings of Claude Code (also its desktop app) and Antigravity, strom
// allowed: an agent opened anywhere runs strom without asking each time (what
// is the user's — a password, a consent — strom itself keeps for the user).
// OpenCode gets a file of its own named in its global config (a global
// AGENTS.md of strom's would hide the user's ~/.claude/CLAUDE.md, which
// OpenCode reads when it has none) and `strom *` allowed there. Grok Build
// gets a skill of its own, like Claude Code, and strom allowed in its
// config.toml (a marked block; the user's own text around it is kept).
// What strom created to teach them — a file, a folder — it records in the user
// config (agents-taught.json): taking its part away again, a file strom created
// goes when nothing else is left in it, and so does a folder strom created that
// is empty; a file the person had stays, also when it is empty then.

import fs from "node:fs";
import path from "node:path";
import type { Env } from "../core/paths.ts";
import { configDir, isolated, userHome } from "../core/paths.ts";
import { writeFileAtomic } from "../core/json.ts";
import { installation } from "../core/self.ts";
import { agentAppUrl, appSite } from "../core/stromapp.ts";

const BEGIN = "<!-- strom: begin (strom agents install; removed by strom agents uninstall) -->";
const END = "<!-- strom: end -->";

/** What the agents are taught; app: the Strom app's address it names — the one `strom app` opens when it is written (agentAppUrl). */
export const globalText = (app: string): string => `# strom — family history research

strom (the \`strom\` command) is installed on this computer: a tool for
researching a family's history with you as the researcher — people, parish
registers, archives, evidence, a family tree the Strom app can import.
Use it whenever the user wants to research their ancestors or family, or
mentions strom, a family tree or the Strom app.

1. Run \`strom\` first, and before each step: it says where the research
   stands and what to do next (\`strom --json\` for the same as data). Read
   \`strom guide\` before the first step — the rules and the way to work —
   and work only in strom's sessions on its tasks. \`strom help <command>\`
   is any command's help for you (English; \`strom help\`: every command by
   group) — \`--human\` is the user's, in their language.
   Run each strom command on its own — no pipes, no \`;\` or \`&&\` chains: you
   may run strom without asking, but not what is chained to it.
2. Not set up yet: ask the user where to keep the research (suggest
   ~/Documents/Strom) and which language they want, then run
   \`strom setup --home "<folder>" --lang <code> --yes\`, then
   \`strom init "<name of the family tree>"\`.
3. Talk to the user in their language. Ask them before decisions: whom to
   research, what they already know, anything that costs money or needs
   their permission.
4. The research lives in a family tree folder; change it ONLY through
   \`strom\` commands, never by editing its files. In that folder its own
   AGENTS.md says the rest.
5. You work best started by strom: it opens you in the tree folder with the
   right permissions. Tell the user once: next time run \`strom\` in a
   terminal (or the "Strom research" shortcut on the desktop) and choose
   "Continue the research with the agent".
6. When strom needs the user's consent it opens a window on their screen —
   tell them to answer it; you cannot. Exit code 4 means the user must run
   the given command themselves.
7. Old handwriting is read by your strongest model — never a faster or
   cheaper model, subagent or pass; a name or place the next search depends
   on is read again on an enlarged crop before it is recorded.
8. Scans come through strom. An archive the research needs has no
   downloader (connector) yet: build one yourself, unasked
   (\`strom connector new\`), and tell the user in a sentence.
9. The Strom app (${appSite(app)}) is strom's companion: a free family
   tree app, no account, the data stay on the user's computer. The research's
   result (\`output/tree-strom.ged\`) opens in it. When the user wants to see
   the tree (or \`strom\` says to offer it — once), suggest it gently — best installed as an app from the browser,
   from ${app} (\`strom app install\` opens it there; it
   then works offline); \`strom app\` opens it — with the research, followed
   live while you work, when the app can take it. Without it, the user can ask
   you about anyone in the tree: answer from \`strom person show\` and the like.
`;

export interface GlobalTarget {
  agent: string;
  file: string;
  /** A file of its own (Claude Code skill, OpenCode instructions), a block in the user's file, or a rule allowing strom in its settings. */
  kind: "own" | "block" | "allow";
  /** The Strom app's address its text names: the one `strom app` opens (the beta its beta, strom.app.url where it says another). */
  app: string;
  /** Where strom records what it created to teach the agents (agents-taught.json in the user config). */
  made: string;
}

/**
 * The rules that let the agent run strom without asking, in its own settings' words.
 * Claude Code: `strom` on PATH, and the installer's command by its path — right after
 * the installer an agent calls it so, until a new terminal has it on PATH — for each of
 * its shells: Bash, and PowerShell on Windows (a Bash rule does not cover it). Narrow
 * rules like these hold in its auto mode too, where broad ones are dropped.
 */
function allowRules(agent: string): string[] {
  if (agent === "antigravity") return ["command(strom)"];
  const commands = ["strom", ...(installation().launchers ?? [])];
  // Grok Build: one shell tool (its rules know no PowerShell)
  return commands.flatMap((c) => (agent === "grok" ? [`Bash(${c}:*)`] : [`Bash(${c}:*)`, `PowerShell(${c}:*)`]));
}

/**
 * Grok Build's config.toml, strom's lines marked: a [permission] table of strom's when there is none,
 * else strom's allow list in the user's table — when it has no allow list of its own (strom does not
 * rewrite the user's list: Grok then asks before it runs strom, as the user set it).
 */
const TOML_BEGIN = "# strom: begin (strom agents install; removed by strom agents uninstall)";
const TOML_END = "# strom: end";

const isTomlTable = (l: string): boolean => /^\s*\[/.test(l);
const isPermissionHeader = (l: string): boolean => /^\s*\[permission\]\s*(#.*)?$/.test(l);
const hasOwnAllow = (lines: string[]): boolean => lines.some((l) => /^\s*allow\s*=/.test(l));

/** A line of strom's own in config.toml: its [permission] header, or an allow list of nothing but strom's rules. */
function isGrokStromLine(l: string): boolean {
  if (isPermissionHeader(l)) return true;
  const m = /^\s*allow\s*=\s*\[(.*)\]\s*$/.exec(l);
  const rules = m ? [...m[1]!.matchAll(/"([^"]*)"/g)].map((r) => r[1]!) : [];
  return rules.length > 0 && rules.every((r) => isStromRule("grok", r));
}

/** Strom's block among the lines of config.toml (split at \n): the lines of its begin and its end, or undefined. */
function grokBlock(lines: string[]): [number, number] | undefined {
  const b = lines.findIndex((l) => l.trim() === TOML_BEGIN);
  if (b < 0) return undefined;
  const e = lines.findIndex((l, i) => i > b && l.trim() === TOML_END);
  if (e > b) return [b, e];
  // its end line lost: strom's own lines after its begin, never the person's that follow
  let last = b;
  while (last + 1 < lines.length && isGrokStromLine(lines[last + 1]!)) last++;
  return [b, last];
}

/**
 * Strom's block taken out, the person's text before and after it kept as it is — only the blank line an install puts
 * between the person's text and the block it appends goes with it. gap: whether the install that wrote the block put
 * one there (recorded in agents-taught.json); false: no blank line around the block is strom's. Unknown (an
 * installation that recorded nothing, a file strom created): the blank line before the block was strom's, or, the block
 * first in the file, the one after it.
 */
function grokWithout(text: string, gap?: boolean): string {
  let lines = text.split("\n");
  const blank = (i: number) => i >= 0 && i < lines.length && lines[i]!.trim() === "";
  for (let at = grokBlock(lines); at; at = grokBlock(lines)) {
    const [b, e] = at;
    let from = b;
    let to = e + 1;
    if (gap !== false) {
      // a blank line before it, whatever follows (the end of the file, a blank line, the person's text right after its
      // end): that one was strom's
      if (blank(b - 1)) from = b - 1;
      // first in the file, then a blank line and the person's text: that blank line was strom's
      else if (b === 0 && blank(e + 1) && e + 1 < lines.length - 1) to = e + 2;
    }
    // taken to the end of a file with no line break at its end: the CR of the break before it went with it
    const tail = to >= lines.length && from > 0 ? [lines[from - 1]!.replace(/\r$/, "")] : lines.slice(from - 1, from);
    lines = [...lines.slice(0, Math.max(0, from - 1)), ...tail, ...lines.slice(to)];
  }
  return lines.join("\n");
}

/** config.toml with strom's block; gap: whether a new block was put after a blank line (undefined: none put now). */
function grokWith(text: string, rec?: boolean): { text: string; gap?: boolean } | undefined {
  const allow = `allow = [${allowRules("grok").map((r) => JSON.stringify(r)).join(", ")}]`;
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const cr = nl === "\r\n" ? "\r" : "";
  const lines = text.split("\n");
  const at = grokBlock(lines);
  if (at) {
    // strom's block there already: brought to this version where it is, the person's text around it untouched
    const [b, e] = at;
    const header = lines.findIndex((l, i) => (i < b || i > e) && isPermissionHeader(l));
    let inner: string[] | undefined;
    if (header < 0) inner = ["[permission]", allow];
    else if (header < b && !lines.slice(header + 1, b).some(isTomlTable)) {
      // in the person's own table: up to the next table
      let end = lines.findIndex((l, i) => i > e && isTomlTable(l));
      if (end < 0) end = lines.length;
      if (hasOwnAllow([...lines.slice(header + 1, b), ...lines.slice(e + 1, end)])) return undefined;
      inner = [allow];
    }
    if (inner) {
      const last = e === lines.length - 1; // the file ends with strom's end line: no line break after it
      const block = [TOML_BEGIN, ...inner, TOML_END].map((l, i, all) => (last && i === all.length - 1 ? l : l + cr));
      return { text: [...lines.slice(0, b), ...block, ...lines.slice(e + 1)].join("\n") };
    }
    // a table of strom's beside the person's own [permission] table (two would break the file): into theirs
  }
  const rest = at ? grokWithout(text, rec) : text;
  const rl = rest.split("\n");
  const header = rl.findIndex(isPermissionHeader);
  if (header < 0) {
    // appended after a blank line, the person's last line ending as it did (grokWithout takes exactly this away)
    const block = [TOML_BEGIN, "[permission]", allow, TOML_END].join(nl);
    if (!rest) return { text: block + nl, gap: false };
    return { text: rest.endsWith("\n") ? `${rest}${nl}${block}${nl}` : `${rest}${nl}${nl}${block}`, gap: true };
  }
  // the user's table: up to the next table
  let end = rl.findIndex((l, i) => i > header && isTomlTable(l));
  if (end < 0) end = rl.length;
  if (hasOwnAllow(rl.slice(header + 1, end))) return undefined;
  return { text: [...rl.slice(0, header + 1), ...[TOML_BEGIN, allow, TOML_END].map((l) => l + cr), ...rl.slice(header + 1)].join("\n"), gap: false };
}

/** A rule of strom's in Claude Code's or Antigravity's settings, whichever installation wrote it. */
function isStromRule(agent: string, rule: string): boolean {
  if (agent === "antigravity") return rule === "command(strom)";
  return /^(?:Bash|PowerShell)\((?:.*[\\/])?strom(?:\.exe|\.cmd)?:\*\)$/.test(rule);
}
/** Grok Build's folder (GROK_HOME, else ~/.grok). */
function grokDir(env: Env): string {
  return env.GROK_HOME ?? path.join(userHome(env), ".grok");
}

/** OpenCode: the rule that lets it run strom without asking. */
const OPENCODE_STROM = "strom *";

/** OpenCode's global config folder (it follows XDG on every system). */
function opencodeDir(env: Env): string {
  return path.join(env.XDG_CONFIG_HOME ?? path.join(userHome(env), ".config"), "opencode");
}

/** Claude Code starts its own conversations with Remote Control (its setting remoteControlAtStartup, the user's own). */
export function claudeRemoteAtStartup(env: Env): boolean {
  try {
    const file = path.join(env.CLAUDE_CONFIG_DIR ?? path.join(userHome(env), ".claude"), "settings.json");
    return (JSON.parse(fs.readFileSync(file, "utf8")) as { remoteControlAtStartup?: unknown }).remoteControlAtStartup === true;
  } catch {
    return false; // no settings, or not readable: not on
  }
}

export function globalTargets(env: Env): GlobalTarget[] {
  // an isolated installation teaches the agents nothing: they are the person's, and know the person's own strom
  if (isolated(env)) return [];
  const home = userHome(env);
  // the app's address as strom app opens it now: a run of another channel (its first) writes the texts again
  const app = agentAppUrl(env);
  const targets: Omit<GlobalTarget, "app" | "made">[] = [
    { agent: "claude", file: path.join(env.CLAUDE_CONFIG_DIR ?? path.join(home, ".claude"), "skills", "strom", "SKILL.md"), kind: "own" },
    { agent: "claude", file: path.join(env.CLAUDE_CONFIG_DIR ?? path.join(home, ".claude"), "settings.json"), kind: "allow" },
    { agent: "codex", file: path.join(env.CODEX_HOME ?? path.join(home, ".codex"), "AGENTS.md"), kind: "block" },
    // Antigravity CLI reads its global rules where Gemini CLI did, and its permissions from its settings.
    { agent: "antigravity", file: path.join(home, ".gemini", "GEMINI.md"), kind: "block" },
    { agent: "antigravity", file: path.join(home, ".gemini", "antigravity-cli", "settings.json"), kind: "allow" },
    { agent: "opencode", file: path.join(opencodeDir(env), "strom.md"), kind: "own" },
    { agent: "opencode", file: path.join(opencodeDir(env), "opencode.json"), kind: "allow" },
    { agent: "grok", file: path.join(grokDir(env), "skills", "strom", "SKILL.md"), kind: "own" },
    { agent: "grok", file: path.join(grokDir(env), "config.toml"), kind: "allow" },
  ];
  const made = path.join(configDir(env), "agents-taught.json");
  return targets.map((t) => ({ ...t, app, made }));
}

const skill = (app: string): string => `---
name: strom
description: Family history and genealogy research with the strom command — ancestors, family trees, parish registers and archives, evidence, GEDCOM and the Strom app. Use when the user wants to research their family or mentions strom or the Strom app.
---

${globalText(app)}`;

function read(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

function withoutBlock(text: string): string {
  const i = text.indexOf(BEGIN);
  const j = text.indexOf(END);
  if (i < 0 || j < i) return text;
  const before = text.slice(0, i).replace(/\s+$/, "");
  const after = text.slice(j + END.length).replace(/^\s+/, "");
  const rest = before && after ? `${before}\n\n${after}` : before || after;
  return rest ? `${rest.replace(/\s+$/, "")}\n` : "";
}

/** The agent's settings as JSON, or undefined when they are not (strom then leaves them alone). */
function settingsOf(text: string | undefined): Record<string, unknown> | undefined {
  if (text === undefined || !text.trim()) return {};
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function allowList(s: Record<string, unknown>): string[] {
  const p = (s.permissions ?? {}) as { allow?: unknown };
  return Array.isArray(p.allow) ? (p.allow as string[]) : [];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** Is strom allowed in these settings (and, for OpenCode, its instructions named)? */
function hasAllow(t: GlobalTarget, s: Record<string, unknown>): boolean {
  if (t.agent !== "opencode") return allowRules(t.agent).every((r) => allowList(s).includes(r));
  const bash = isObject(s.permission) ? s.permission.bash : undefined;
  const own = path.join(path.dirname(t.file), "strom.md");
  return isObject(bash) && bash[OPENCODE_STROM] === "allow" && Array.isArray(s.instructions) && s.instructions.includes(own);
}

/**
 * What strom made in a settings file (JSON) of the person's: the objects and lists it added — taken away again only
 * they, when empty, so an empty one the person had stays —, the plain values it turned into an object (OpenCode's
 * "ask": turned back), and the whitespace a blank file held (written again when nothing is left).
 */
interface JsonMade {
  made?: string[];
  plain?: string[];
  blank?: string;
}

/** Strom allowed in the settings; what it made there to do it. */
function addAllow(t: GlobalTarget, s: Record<string, unknown>): JsonMade {
  const made: string[] = [];
  const plain: string[] = [];
  if (t.agent !== "opencode") {
    if (!isObject(s.permissions)) made.push("permissions");
    const perms = isObject(s.permissions) ? s.permissions : {};
    if (!Array.isArray(perms.allow)) made.push("permissions.allow");
    const have = allowList(s);
    s.permissions = { ...perms, allow: [...have, ...allowRules(t.agent).filter((r) => !have.includes(r))] };
    return { made };
  }
  if (!isObject(s.permission)) (typeof s.permission === "string" ? plain : made).push("permission");
  const perm = isObject(s.permission) ? s.permission : typeof s.permission === "string" ? { "*": s.permission } : {};
  // A plain value for bash ("ask") becomes the general rule; strom's comes after it (the last match counts).
  if (!isObject(perm.bash)) (typeof perm.bash === "string" ? plain : made).push("permission.bash");
  const bash = isObject(perm.bash) ? perm.bash : typeof perm.bash === "string" ? { "*": perm.bash } : {};
  s.permission = { ...perm, bash: { ...bash, [OPENCODE_STROM]: "allow" } };
  const own = path.join(path.dirname(t.file), "strom.md");
  if (!Array.isArray(s.instructions)) made.push("instructions");
  const list = Array.isArray(s.instructions) ? (s.instructions as unknown[]) : [];
  if (!list.includes(own)) s.instructions = [...list, own];
  return { made, plain };
}

/**
 * Strom's rules out of the settings. What strom made there (rec) goes when empty, and nothing else; a value it turned
 * into an object becomes plain again. Nothing recorded (an installation before the record): every container left
 * empty goes, as before.
 */
function removeAllow(t: GlobalTarget, s: Record<string, unknown>, rec: JsonMade | undefined): void {
  const goes = (p: string) => (rec ? (rec.made ?? []).includes(p) : true);
  const wasPlain = (p: string, v: Record<string, unknown>) => (rec?.plain ?? []).includes(p) && Object.keys(v).length === 1 && "*" in v;
  if (t.agent !== "opencode") {
    if (!isObject(s.permissions)) return;
    const rest = allowList(s).filter((r) => !isStromRule(t.agent, r));
    const perms = { ...s.permissions };
    if (rest.length || !goes("permissions.allow")) perms.allow = rest;
    else delete perms.allow;
    if (Object.keys(perms).length || !goes("permissions")) s.permissions = perms;
    else delete s.permissions;
    return;
  }
  const own = path.join(path.dirname(t.file), "strom.md");
  if (Array.isArray(s.instructions)) {
    const rest = s.instructions.filter((i) => i !== own);
    if (rest.length || !goes("instructions")) s.instructions = rest;
    else delete s.instructions;
  }
  if (isObject(s.permission) && isObject(s.permission.bash)) {
    const bash = { ...s.permission.bash };
    delete bash[OPENCODE_STROM];
    const perm = { ...s.permission } as Record<string, unknown>;
    if (wasPlain("permission.bash", bash)) perm.bash = bash["*"];
    else if (Object.keys(bash).length || !goes("permission.bash")) perm.bash = bash;
    else delete perm.bash;
    if (wasPlain("permission", perm)) s.permission = perm["*"];
    else if (Object.keys(perm).length || !goes("permission")) s.permission = perm;
    else delete s.permission;
  }
}

/** Where a value stands in the text of a JSON file: its start and end, and those of its members. */
interface JsonSpan {
  start: number;
  end: number;
  keys?: Map<string, JsonSpan>;
  items?: JsonSpan[];
}

/** The spans of the JSON value at i of a text JSON.parse read (so nothing here needs to check it). */
function jsonSpan(text: string, i: number): JsonSpan {
  const ws = (k: number) => {
    while (k < text.length && /\s/.test(text[k]!)) k++;
    return k;
  };
  const strEnd = (k: number) => {
    for (k++; text[k] !== '"'; k++) if (text[k] === "\\") k++;
    return k + 1;
  };
  const start = ws(i);
  const c = text[start];
  if (c === '"') return { start, end: strEnd(start) };
  if (c === "{" || c === "[") {
    const keys = new Map<string, JsonSpan>();
    const items: JsonSpan[] = [];
    let k = ws(start + 1);
    while (text[k] !== (c === "{" ? "}" : "]")) {
      if (c === "{") {
        const keyEnd = strEnd(k);
        const key = JSON.parse(text.slice(k, keyEnd)) as string;
        const v = jsonSpan(text, ws(keyEnd) + 1); // after the colon
        keys.set(key, v);
        k = ws(v.end);
      } else {
        const v = jsonSpan(text, k);
        items.push(v);
        k = ws(v.end);
      }
      if (text[k] === ",") k = ws(k + 1);
    }
    return c === "{" ? { start, end: k + 1, keys } : { start, end: k + 1, items };
  }
  let end = start;
  while (end < text.length && !/[\s,\]}]/.test(text[end]!)) end++;
  return { start, end };
}

/** The spaces of a JSON file on one line: around its colons and commas, inside its braces and brackets. */
interface OneLine {
  colon: string;
  comma: string;
  obj: [string, string];
  arr: [string, string];
}

/** How a JSON text on one line spaces it: what each place holds the first time it comes (outside strings), else nothing. */
function oneLineSpacing(body: string): OneLine {
  const seen = new Map<string, string>();
  const note = (k: string, v: string) => {
    if (!seen.has(k)) seen.set(k, v);
  };
  const wsAfter = (i: number) => /^[ \t]*/.exec(body.slice(i + 1))![0];
  const wsBefore = (i: number) => /[ \t]*$/.exec(body.slice(0, i))![0];
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (c === '"') {
      for (i++; i < body.length && body[i] !== '"'; i++) if (body[i] === "\\") i++;
      continue;
    }
    if (c === ":" || c === ",") {
      note(`${c}<`, wsBefore(i));
      note(`${c}>`, wsAfter(i));
    } else if (c === "{" || c === "[") {
      const after = wsAfter(i);
      if (body[i + 1 + after.length] !== (c === "{" ? "}" : "]")) note(`${c}>`, after);
    } else if (c === "}" || c === "]") {
      const before = wsBefore(i);
      if (body[i - 1 - before.length] !== (c === "}" ? "{" : "[")) note(`${c}<`, before);
    }
  }
  const at = (k: string, or = "") => seen.get(k) ?? or;
  // no comma yet (one member): spaced after as its colon is
  return { colon: `${at(":<")}:${at(":>")}`, comma: `${at(",<")},${at(",>", at(":>"))}`, obj: [at("{>"), at("}<")], arr: [at("[>"), at("]<")] };
}

/**
 * The settings written as the person's file is: what did not change exactly as its text has it, what did in its
 * indentation (or on one line as the file is, with its spaces), its line breaks, the whitespace around it. A blank file
 * or none: strom's way, two spaces and a line break at the end.
 */
function formatJson(s: Record<string, unknown>, text: string | undefined): string {
  if (text === undefined || !text.trim()) return JSON.stringify(s, null, 2) + "\n";
  const body = text.trim();
  const nl = body.includes("\r\n") ? "\r\n" : "\n";
  // the first indented line is one level in; all on one line: none, its own spaces below (an empty {} says nothing: strom's way)
  const indent = /\n([ \t]+)\S/.exec(body)?.[1] ?? (body.includes("\n") || /^\{\s*\}$/.test(body) ? "  " : "");
  // on one line: the person's spaces (none: compact)
  const one = indent ? undefined : oneLineSpacing(body);
  const same = (v: unknown, at: JsonSpan) => JSON.stringify(v) === JSON.stringify(JSON.parse(text.slice(at.start, at.end)));
  const write = (v: unknown, at: JsonSpan | undefined, depth: number): string => {
    if (at && same(v, at)) return text.slice(at.start, at.end);
    if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
    const entries: [string | undefined, unknown, JsonSpan | undefined][] = Array.isArray(v)
      ? v.map((x, i) => [undefined, x, at?.items?.[i]])
      : Object.entries(v).map(([k, x]) => [k, x, at?.keys?.get(k)]);
    const [open, close] = Array.isArray(v) ? ["[", "]"] : ["{", "}"];
    if (!entries.length) return open + close;
    const parts = entries.map(([k, x, sub]) => (k === undefined ? "" : JSON.stringify(k) + (one ? one.colon : ": ")) + write(x, sub, depth + 1));
    if (one) {
      const [inOpen, inClose] = Array.isArray(v) ? one.arr : one.obj;
      return open + inOpen + parts.join(one.comma) + inClose + close;
    }
    const pad = (d: number) => indent.repeat(d);
    return open + nl + parts.map((p) => pad(depth + 1) + p).join("," + nl) + nl + pad(depth) + close;
  };
  const lead = text.slice(0, text.length - text.trimStart().length);
  return lead + write(s, jsonSpan(text, 0), 0) + text.slice(text.trimEnd().length);
}

/**
 * What strom created to teach the agents: each file it wrote — created, or the person's that existed before — and the
 * folders it made for them. An installation before this record (1.12.1, the betas before 1.13.0-beta.6) left none: its
 * files are neither (strom cannot tell whose they are) and stay as an uninstall left them before.
 */
interface Made {
  files?: Record<string, "created" | "existed">;
  dirs?: string[];
  /** In each settings file (JSON) strom wrote: what it made there (an installation before 1.13.0-beta.7 recorded none). */
  json?: Record<string, JsonMade>;
  /**
   * In each config.toml strom wrote its block into: whether it put a blank line before the block (gap), so that an
   * uninstall takes away that one and no blank line of the person's (an installation before 1.13.0-beta.7 recorded none).
   */
  toml?: Record<string, { gap: boolean }>;
}

function readMade(file: string): Made {
  try {
    const v = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return isObject(v) ? (v as Made) : {};
  } catch {
    return {}; // none yet, or not readable: nothing known
  }
}

function writeMade(file: string, m: Made): void {
  try {
    const files = m.files && Object.keys(m.files).length ? m.files : undefined;
    const dirs = m.dirs?.length ? [...new Set(m.dirs)].sort() : undefined;
    const json = m.json && Object.keys(m.json).length ? m.json : undefined;
    const toml = m.toml && Object.keys(m.toml).length ? m.toml : undefined;
    if (!files && !dirs && !json && !toml) fs.rmSync(file, { force: true });
    else writeFileAtomic(file, JSON.stringify({ ...(files ? { files } : {}), ...(dirs ? { dirs } : {}), ...(json ? { json } : {}), ...(toml ? { toml } : {}) }, null, 2) + "\n");
  } catch {
    // the user config not writable: the files stay as an uninstall without the record leaves them
  }
}

/** Is any of strom's part in this text of the agent's file? */
function hasStrom(t: GlobalTarget, text: string): boolean {
  if (t.kind === "own") return true;
  if (t.kind === "allow" && t.agent === "grok") return text.includes(TOML_BEGIN);
  if (t.kind === "block") return text.includes(BEGIN);
  const s = settingsOf(text);
  if (!s) return false;
  if (t.agent !== "opencode") return allowList(s).some((r) => isStromRule(t.agent, r));
  const own = path.join(path.dirname(t.file), "strom.md");
  return (Array.isArray(s.instructions) && s.instructions.includes(own)) || (isObject(s.permission) && isObject(s.permission.bash) && OPENCODE_STROM in s.permission.bash);
}

/**
 * Recorded after a write: the file created now, or the person's (one without strom's part); the folders made for it;
 * in a settings file, what strom made in it (json); in config.toml, whether a new block went after a blank line (gap).
 */
function noteWritten(t: GlobalTarget, before: string | undefined, firstDir: string | undefined, json?: JsonMade, gap?: boolean): void {
  const m = readMade(t.made);
  const files = { ...(m.files ?? {}) };
  const dirs = [...(m.dirs ?? [])];
  const jsons = { ...(m.json ?? {}) };
  const tomls = { ...(m.toml ?? {}) };
  // a new block put now (one there already, brought to this version where it is, keeps what is recorded)
  if (gap !== undefined) tomls[t.file] = { gap };
  const fresh = before === undefined || !hasStrom(t, before);
  if (before === undefined) files[t.file] = "created";
  // there without strom's part: the person's — also one recorded created, deleted since and made again by the person
  else if (fresh) files[t.file] = "existed";
  // strom's part already there: what is recorded stands; nothing recorded, an older installation's file — whose, nobody can tell
  const prev = jsons[t.file];
  const both = (a: string[] | undefined, b: string[] | undefined) => [...new Set([...(a ?? []), ...(b ?? [])])];
  const kept = (j: JsonMade): JsonMade => ({ ...(j.made?.length ? { made: j.made } : {}), ...(j.plain?.length ? { plain: j.plain } : {}), ...(j.blank !== undefined ? { blank: j.blank } : {}) });
  if (json && fresh) jsons[t.file] = kept(json);
  else if (json && prev) jsons[t.file] = kept({ ...prev, made: both(prev.made, json.made), plain: both(prev.plain, json.plain) });
  // strom's part there and nothing recorded of it: an older installation's, taken away as it was before the record
  if (firstDir) for (let d = path.dirname(t.file); ; d = path.dirname(d)) {
    dirs.push(d);
    if (d === firstDir || path.dirname(d) === d) break;
  }
  const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b ?? {});
  if (changed(files, m.files) || dirs.length !== (m.dirs ?? []).length || changed(jsons, m.json) || changed(tomls, m.toml))
    writeMade(t.made, { files, dirs, json: jsons, toml: tomls });
}

/** Its part taken away: the file is the person's again (or gone); the folders strom made for it go when empty. */
function noteRemoved(t: GlobalTarget): void {
  const m = readMade(t.made);
  const files = { ...(m.files ?? {}) };
  delete files[t.file];
  const json = { ...(m.json ?? {}) };
  delete json[t.file];
  const toml = { ...(m.toml ?? {}) };
  delete toml[t.file];
  const here = path.dirname(t.file);
  const within = (d: string) => here === d || here.startsWith(d.endsWith(path.sep) ? d : d + path.sep);
  // deepest first: a folder strom made in another it made
  const dirs = [...(m.dirs ?? [])].sort((x, y) => y.length - x.length).filter((d) => {
    if (!within(d)) return true;
    try {
      if (fs.readdirSync(d).length) return true; // something else in it: it stays, and so does the record
      fs.rmdirSync(d);
    } catch {
      // gone already
    }
    return false;
  });
  writeMade(t.made, { files, dirs, json, toml });
}

/**
 * Whether strom put a blank line before its block in this config.toml, as recorded; unknown for an installation that
 * recorded nothing, and for a file strom created (what the person adds to it after its block stands alone again).
 */
function tomlGap(t: GlobalTarget, m: Made): boolean | undefined {
  return m.files?.[t.file] === "created" ? undefined : m.toml?.[t.file]?.gap;
}

/** Write it for one agent; false when it was already there as it is. */
export function installGlobal(t: GlobalTarget): boolean {
  const cur = read(t.file);
  let next: string;
  let json: JsonMade | undefined;
  let gap: boolean | undefined;
  if (t.kind === "allow" && t.agent === "grok") {
    const with_ = grokWith(cur ?? "", tomlGap(t, readMade(t.made)));
    if (with_ === undefined) return false;
    next = with_.text;
    gap = with_.gap;
  } else if (t.kind === "allow") {
    const s = settingsOf(cur);
    if (!s || hasAllow(t, s)) return false;
    json = addAllow(t, s);
    if (cur !== undefined && !cur.trim()) json.blank = cur;
    // written as the person's file is: its indentation, its line breaks, a line break at its end or none
    next = formatJson(s, cur);
  } else if (t.kind === "own") next = t.agent === "claude" || t.agent === "grok" ? skill(t.app) : globalText(t.app);
  else {
    const rest = cur ? withoutBlock(cur).replace(/\s+$/, "") : "";
    next = `${rest ? `${rest}\n\n` : ""}${BEGIN}\n${globalText(t.app)}${END}\n`;
  }
  if (cur === next) return false;
  const firstDir = fs.mkdirSync(path.dirname(t.file), { recursive: true });
  writeFileAtomic(t.file, next);
  noteWritten(t, cur, firstDir, json, gap);
  return true;
}

/** Take it away again; false when there was nothing of strom's. */
export function uninstallGlobal(t: GlobalTarget): boolean {
  const m = readMade(t.made);
  const removed = takeAway(t, m.files?.[t.file], m.json?.[t.file], tomlGap(t, m));
  if (removed) noteRemoved(t);
  return removed;
}

/**
 * Strom's part out of the file. Nothing else left in it: a file strom created goes, the person's stays (empty); one of
 * an installation that recorded nothing stays as it did before the record — a settings file kept as {}, a text file
 * with nothing but strom's part gone.
 */
function takeAway(t: GlobalTarget, made: "created" | "existed" | undefined, rec: JsonMade | undefined, gap: boolean | undefined): boolean {
  const cur = read(t.file);
  if (cur === undefined) return false;
  if (t.kind === "allow" && t.agent === "grok") {
    if (!grokBlock(cur.split("\n"))) return false;
    // the person's text before and after strom's block as it was
    const rest = grokWithout(cur, gap);
    if (rest.trim() || made === "existed") writeFileAtomic(t.file, rest);
    else fs.rmSync(t.file);
    return true;
  }
  if (t.kind === "allow") {
    const s = settingsOf(cur);
    // Any of strom's rules, also those another installation of strom wrote.
    const any = t.agent === "opencode" ? s && hasAllow(t, s) : s && allowList(s).some((r) => isStromRule(t.agent, r));
    if (!s || !any) return false;
    removeAllow(t, s, rec);
    if (!Object.keys(s).length && made === "created") fs.rmSync(t.file);
    // the person's blank file: blank again
    else if (!Object.keys(s).length && rec?.blank !== undefined) writeFileAtomic(t.file, rec.blank);
    // written as the person's file is
    else writeFileAtomic(t.file, formatJson(s, cur));
    return true;
  }
  if (t.kind === "own") {
    // A skill is a folder of its own; OpenCode's instructions one file among the user's.
    if (t.agent === "claude" || t.agent === "grok") fs.rmSync(path.dirname(t.file), { recursive: true, force: true });
    else fs.rmSync(t.file, { force: true });
    return true;
  }
  if (!cur.includes(BEGIN)) return false;
  const rest = withoutBlock(cur);
  if (rest.trim() || made === "existed") writeFileAtomic(t.file, rest);
  else fs.rmSync(t.file);
  return true;
}

/** What strom taught the agents (where it did), brought to this version's text; the agents whose files changed. */
export function refreshGlobal(env: Env): string[] {
  const changed = new Set<string>();
  for (const t of globalTargets(env)) if (isInstalled(t) && installGlobal(t)) changed.add(t.agent);
  return [...changed];
}

export function isInstalled(t: GlobalTarget): boolean {
  const cur = read(t.file);
  if (cur === undefined) return false;
  // strom's block there, wherever the person's text puts it (an install brings it to this version where it is)
  if (t.kind === "allow" && t.agent === "grok") return grokBlock(cur.split("\n")) !== undefined;
  if (t.kind === "allow") return hasAllow(t, settingsOf(cur) ?? {});
  return t.kind === "own" || cur.includes(BEGIN);
}
