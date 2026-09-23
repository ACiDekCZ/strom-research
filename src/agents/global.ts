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
// OpenCode reads when it has none) and `strom *` allowed there.

import fs from "node:fs";
import path from "node:path";
import type { Env } from "../core/paths.ts";
import { userHome } from "../core/paths.ts";
import { writeFileAtomic } from "../core/json.ts";
import { installation } from "../core/self.ts";

const BEGIN = "<!-- strom: begin (strom agents install; removed by strom agents uninstall) -->";
const END = "<!-- strom: end -->";

export const GLOBAL_TEXT = `# strom — family history research

strom (the \`strom\` command) is installed on this computer: a tool for
researching a family's history with you as the researcher — people, parish
registers, archives, evidence, a family tree the Strom app can import.
Use it whenever the user wants to research their ancestors or family, or
mentions strom, a family tree or the Strom app.

1. Run \`strom\` first. It says where the research stands and what to do next
   (\`strom --json\` for the same as data; \`strom guide\` explains the work).
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
7. Scans come through strom. An archive the research needs has no
   downloader (connector) yet: build one yourself, unasked
   (\`strom connector new\`), and tell the user in a sentence.
8. The Strom app (https://stromapp.info) is strom's companion: a free family
   tree app, no account, the data stay on the user's computer. The research's
   result (\`output/tree-strom.ged\`) opens in it. When the user wants to see
   the tree, suggest it gently — best installed as an app from the browser,
   from https://stromapp.info/run/ (\`strom app install\` opens it there; it
   then works offline); \`strom app\` opens it — with the research, followed
   live while you work, when the app can take it. Without it, the user can ask
   you about anyone in the tree: answer from \`strom person show\` and the like.
`;

export interface GlobalTarget {
  agent: string;
  file: string;
  /** A file of its own (Claude Code skill, OpenCode instructions), a block in the user's file, or a rule allowing strom in its settings. */
  kind: "own" | "block" | "allow";
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
  return commands.flatMap((c) => [`Bash(${c}:*)`, `PowerShell(${c}:*)`]);
}

/** A rule of strom's in Claude Code's or Antigravity's settings, whichever installation wrote it. */
function isStromRule(agent: string, rule: string): boolean {
  if (agent === "antigravity") return rule === "command(strom)";
  return /^(?:Bash|PowerShell)\((?:.*[\\/])?strom(?:\.exe|\.cmd)?:\*\)$/.test(rule);
}
/** OpenCode: the rule that lets it run strom without asking. */
const OPENCODE_STROM = "strom *";

/** OpenCode's global config folder (it follows XDG on every system). */
function opencodeDir(env: Env): string {
  return path.join(env.XDG_CONFIG_HOME ?? path.join(userHome(env), ".config"), "opencode");
}

export function globalTargets(env: Env): GlobalTarget[] {
  const home = userHome(env);
  return [
    { agent: "claude", file: path.join(env.CLAUDE_CONFIG_DIR ?? path.join(home, ".claude"), "skills", "strom", "SKILL.md"), kind: "own" },
    { agent: "claude", file: path.join(env.CLAUDE_CONFIG_DIR ?? path.join(home, ".claude"), "settings.json"), kind: "allow" },
    { agent: "codex", file: path.join(env.CODEX_HOME ?? path.join(home, ".codex"), "AGENTS.md"), kind: "block" },
    // Antigravity CLI reads its global rules where Gemini CLI did, and its permissions from its settings.
    { agent: "antigravity", file: path.join(home, ".gemini", "GEMINI.md"), kind: "block" },
    { agent: "antigravity", file: path.join(home, ".gemini", "antigravity-cli", "settings.json"), kind: "allow" },
    { agent: "opencode", file: path.join(opencodeDir(env), "strom.md"), kind: "own" },
    { agent: "opencode", file: path.join(opencodeDir(env), "opencode.json"), kind: "allow" },
  ];
}

const SKILL = `---
name: strom
description: Family history and genealogy research with the strom command — ancestors, family trees, parish registers and archives, evidence, GEDCOM and the Strom app. Use when the user wants to research their family or mentions strom or the Strom app.
---

${GLOBAL_TEXT}`;

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

function addAllow(t: GlobalTarget, s: Record<string, unknown>): void {
  if (t.agent !== "opencode") {
    const have = allowList(s);
    s.permissions = { ...((s.permissions as object | undefined) ?? {}), allow: [...have, ...allowRules(t.agent).filter((r) => !have.includes(r))] };
    return;
  }
  const perm = isObject(s.permission) ? s.permission : typeof s.permission === "string" ? { "*": s.permission } : {};
  // A plain value for bash ("ask") becomes the general rule; strom's comes after it (the last match counts).
  const bash = isObject(perm.bash) ? perm.bash : typeof perm.bash === "string" ? { "*": perm.bash } : {};
  s.permission = { ...perm, bash: { ...bash, [OPENCODE_STROM]: "allow" } };
  const own = path.join(path.dirname(t.file), "strom.md");
  const list = Array.isArray(s.instructions) ? (s.instructions as unknown[]) : [];
  if (!list.includes(own)) s.instructions = [...list, own];
}

function removeAllow(t: GlobalTarget, s: Record<string, unknown>): void {
  if (t.agent !== "opencode") {
    const rest = allowList(s).filter((r) => !isStromRule(t.agent, r));
    const perms = { ...(s.permissions as object) } as Record<string, unknown>;
    if (rest.length) perms.allow = rest;
    else delete perms.allow;
    if (Object.keys(perms).length) s.permissions = perms;
    else delete s.permissions;
    return;
  }
  const own = path.join(path.dirname(t.file), "strom.md");
  if (Array.isArray(s.instructions)) {
    const rest = s.instructions.filter((i) => i !== own);
    if (rest.length) s.instructions = rest;
    else delete s.instructions;
  }
  if (isObject(s.permission) && isObject(s.permission.bash)) {
    const bash = { ...s.permission.bash };
    delete bash[OPENCODE_STROM];
    const perm = { ...s.permission } as Record<string, unknown>;
    if (Object.keys(bash).length) perm.bash = bash;
    else delete perm.bash;
    if (Object.keys(perm).length) s.permission = perm;
    else delete s.permission;
  }
}

/** Write it for one agent; false when it was already there as it is. */
export function installGlobal(t: GlobalTarget): boolean {
  const cur = read(t.file);
  let next: string;
  if (t.kind === "allow") {
    const s = settingsOf(cur);
    if (!s || hasAllow(t, s)) return false;
    addAllow(t, s);
    next = JSON.stringify(s, null, 2) + "\n";
  } else if (t.kind === "own") next = t.agent === "claude" ? SKILL : GLOBAL_TEXT;
  else {
    const rest = cur ? withoutBlock(cur).replace(/\s+$/, "") : "";
    next = `${rest ? `${rest}\n\n` : ""}${BEGIN}\n${GLOBAL_TEXT}${END}\n`;
  }
  if (cur === next) return false;
  fs.mkdirSync(path.dirname(t.file), { recursive: true });
  writeFileAtomic(t.file, next);
  return true;
}

/** Take it away again; false when there was nothing of strom's. */
export function uninstallGlobal(t: GlobalTarget): boolean {
  const cur = read(t.file);
  if (cur === undefined) return false;
  if (t.kind === "allow") {
    const s = settingsOf(cur);
    // Any of strom's rules, also those another installation of strom wrote.
    const any = t.agent === "opencode" ? s && hasAllow(t, s) : s && allowList(s).some((r) => isStromRule(t.agent, r));
    if (!s || !any) return false;
    removeAllow(t, s);
    writeFileAtomic(t.file, JSON.stringify(s, null, 2) + "\n");
    return true;
  }
  if (t.kind === "own") {
    // The skill is a folder of its own; OpenCode's instructions one file among the user's.
    if (t.agent === "claude") fs.rmSync(path.dirname(t.file), { recursive: true, force: true });
    else fs.rmSync(t.file, { force: true });
    return true;
  }
  if (!cur.includes(BEGIN)) return false;
  const rest = withoutBlock(cur);
  if (rest.trim()) writeFileAtomic(t.file, rest);
  else fs.rmSync(t.file);
  return true;
}

export function isInstalled(t: GlobalTarget): boolean {
  const cur = read(t.file);
  if (cur === undefined) return false;
  if (t.kind === "allow") return hasAllow(t, settingsOf(cur) ?? {});
  return t.kind === "own" || cur.includes(BEGIN);
}
